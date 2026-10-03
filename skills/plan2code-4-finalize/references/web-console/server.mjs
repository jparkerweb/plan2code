#!/usr/bin/env node
// Plan2Code Web Console - the HTTP server.
//
// Spawned DETACHED by console.mjs, never as a harness-managed background task:
// those get killed on compaction, on a new prompt, and at assorted timeouts,
// which would take the human's half-finished answers with them.
//
// It owns no durable state of its own. Everything lives in the session
// directory, which is what makes the console survivable: the human can finish
// the form even if the agent session died, and a fresh agent picks the result up.
//
// Node built-ins only.

import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import {
  CHAT_CURSOR_FILE,
  CHAT_FILE,
  LEDGER_FILE,
  HERE,
  LOOKS_FILE,
  PUBLIC_DIR,
  SHIPPED_MODELS_FILE,
  USER_MODELS_FILE,
  WORKSPACE_FILE,
  appendChat,
  appendEvent,
  chatForFrame,
  checkDocument,
  currentConversation,
  ensureDir,
  fileStamp,
  handleFile,
  initialWorkspace,
  nowIso,
  parseArgs,
  pendingChatCount,
  readChat,
  readCursor,
  readJson,
  readLedger,
  readOverview,
  readWorkspace,
  remoteWarning,
  typedCount,
  withStateLock,
  writeJsonAtomic,
  writeWorkspace,
} from "./lib.mjs";
import { DOC_TYPES, MAX_ATTACHMENTS, MAX_DOC_BYTES, docExt, workflowLabel, workflowTitle } from "./public/answers.js";
import { CHAT_LIMIT, CHAT_MAX_CHARS, chatOffline } from "./public/chat.js";
import { meterView } from "./public/meter.js";
import { ACCENTS, DEFAULT_ACCENT, DEFAULT_CARD_WIDTH, cardWidth } from "./public/palette.js";
import { defaultName, freeName, nameProblem } from "./public/workspace.js";
import { WORKSPACE_PICKER_PROMPT, pickFolder, pickerCommand } from "./picker.mjs";

const args = parseArgs(process.argv.slice(2));
// Canonicalise before anything derives a path from it: a session dir reached
// through a junction or a subst'd drive is watched under the wrong spelling,
// which is the libuv assert described below. The native realpath resolves
// those AND expands 8.3 short names, which lets the watcher run in a TEMP
// spelled C:\Users\JUSTIN~1.PAR; the JS one is the fallback, and the watcher
// still checks what it was given.
const DIR = (() => {
  for (const real of [fs.realpathSync.native, fs.realpathSync]) {
    try {
      return real(args.session);
    } catch {}
  }
  return args.session;
})();
if (!DIR) {
  process.stderr.write("server: --session <dir> is required\n");
  process.exit(2);
}

const SID = path.basename(DIR);
// No token, no server: authed() waves everything through on an empty one. A
// bare `--token` (or one whose value parseArgs took for a flag) arrives as
// `true`, so anything but a non-empty string is refused here, at boot.
if (typeof args.token !== "string" || !args.token) {
  process.stderr.write("server: --token=<token> is required (a non-empty string)\n");
  process.exit(2);
}
const TOKEN = args.token;
const PROJECT = args.project || process.cwd();
// The checkout this session runs in, from `open`. PROJECT is the folder that
// holds .git, which for a linked worktree is the MAIN checkout: the wrong
// folder to seed the workspace with or resolve a typed path against. A fresh
// `open` starts this server before it writes the state, so until the state is
// there this is the only place the worktree can come from.
const WORKTREE = typeof args.worktree === "string" ? args.worktree : "";
const IDLE_MS = Number(args["idle-ms"] || 30 * 60 * 1000);
const MAX_LIFE_MS = Number(args["max-life-ms"] || 4 * 60 * 60 * 1000);

const STATE_FILE = path.join(DIR, "state.json");
const DRAFT_FILE = path.join(DIR, "draft.json");
const RESULT_FILE = path.join(DIR, "result.json");
const CHAT_PATH = path.join(DIR, CHAT_FILE);
const CURSOR_PATH = path.join(DIR, CHAT_CURSOR_FILE);

// Images and documents attached to notes and quick questions. Only ever named
// by the server (a UUID, plus `jpg` or an extension from DOC_TYPES), and only
// ever resolved inside this directory: the client's file name is a label.
// Images are served back as JPEG. A document is served under a fixed type
// (PDF, or text/plain for everything else, sandboxed and never sniffed), so
// the page can link it without ever letting a browser run it.
const UPLOADS_DIR = path.join(DIR, "uploads");
const UPLOAD_EXTS = ["jpg", ...Object.keys(DOC_TYPES)];
const EXT_ALT = UPLOAD_EXTS.join("|");
const UPLOAD_ANY_ROUTE = new RegExp(`^/uploads/([0-9a-f-]{36})\\.(${EXT_ALT})$`);
const UPLOAD_NAME = new RegExp(`^[0-9a-f-]{36}\\.(${EXT_ALT})$`);

function uploadPath(id, ext = "jpg") {
  if (!UPLOAD_EXTS.includes(ext)) return null;
  const result = path.join(UPLOADS_DIR, id + "." + ext);
  return path.resolve(result).startsWith(path.resolve(UPLOADS_DIR) + path.sep) ? result : null;
}

// "image" for one of this session's JPEGs, "file" for one of its documents,
// false for anything else.
function isOwnUpload(p) {
  if (typeof p !== "string") return false;
  const fold = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
  const abs = path.resolve(p);
  const base = fold(path.basename(abs));
  if (fold(path.dirname(abs)) !== fold(path.resolve(UPLOADS_DIR)) || !UPLOAD_NAME.test(base)) return false;
  return base.endsWith(".jpg") ? "image" : "file";
}

// A client-supplied label, safe to put on a reply line: control characters
// become spaces, since a newline in a file name would split the line in two.
function cleanLabel(name, fallback) {
  return (
    (typeof name === "string" ? name : "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 200) || fallback
  );
}

// The file name the page sent, decoded but not yet cleaned or cut short.
function rawUploadName(req) {
  try {
    return decodeURIComponent(req.headers["x-p2c-name"] || "");
  } catch {
    return "";
  }
}

function uploadLabel(req, fallback) {
  return cleanLabel(rawUploadName(req), fallback);
}

// Whether a send's `images` and `files` are this session's uploads of the
// right kind, within the combined cap. Absent lists are fine.
function attachmentsOk(images, files) {
  const listOk = (list, kind) =>
    list === undefined ||
    (Array.isArray(list) &&
      list.every(
        (a) =>
          a &&
          typeof a === "object" &&
          isOwnUpload(a.path) === kind &&
          fs.existsSync(a.path) &&
          (a.name === undefined || typeof a.name === "string")
      ));
  const count = (Array.isArray(images) ? images.length : 0) + (Array.isArray(files) ? files.length : 0);
  return { images: listOk(images, "image"), files: listOk(files, "file"), count: count <= MAX_ATTACHMENTS };
}

const STARTED = Date.now();
let lastContact = Date.now();
let browsers = 0;
let rev = 0;
let seq = 0;

/* ------------------------------------------------------------ mime types */

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".png": "image/png",
};

// A hardcoded allow-list, not a filesystem lookup. Nothing to traverse.
const SERVABLE = new Set([
  "app.js",
  "answers.js",
  "app.css",
  "render.js",
  "palette.js",
  "labels.js",
  "boot.js",
  "chat.js",
  "help.js",
  "starters.js",
  "workspace.js",
  "meter.js",
  "mentions.js",
  "favicon.js",
  "start-stop.mp3",
  "next.mp3",
  "insert.mp3",
  "sleeping.mp3",
  "bootup.mp3",
  "start-skill.mp3",
  "favicon.svg",
  "favicon.png",
  "vendor/marked.esm.js",
]);

/* -------------------------------------------------------------- helpers */

// The state as last read, re-read only when its file has changed. Every
// request, every SSE frame and the one-second poll used to read and parse
// state.json afresh, and the state grows with the session (whole documents
// live in it). A stat says whether anything moved; refreshing through
// checkState also means a request that sees a new state first still counts
// it as a new revision and tells every other tab. Callers must not mutate
// what this returns -- /submit edits a fresh read of its own, under the lock.
function readState() {
  checkState();
  return stateNow;
}

// Both facts about result.json from one read, cached the same way. The page's
// heartbeat, every state frame and /submit's guard each asked for them, and
// each used to read and parse the file twice.
//
// An answered-but-not-yet-collected result: while one exists the session is
// mid-handoff, and the page must not send again and must say why.
// A stop the person asked for that nothing has collected yet. Reported from
// here rather than remembered by the page, because the page's memory is per
// origin and a resumed session comes back on a new port: the one place that
// still knows a stop is on its way is the result sitting on this disk.
let resultSeen = { stamp: null, pending: false, stop: false };
function resultFlags() {
  const stamp = fileStamp(RESULT_FILE);
  if (stamp !== resultSeen.stamp) {
    let text = null;
    try {
      text = stamp ? fs.readFileSync(RESULT_FILE, "utf8") : null;
    } catch (err) {
      // There but unreadable for now (an antivirus lock, say). Never cached,
      // so the next call reads it again, and meanwhile it counts as pending:
      // a result nobody could read is exactly the one /submit must not
      // overwrite.
      if (err.code !== "ENOENT") return { ...resultSeen, pending: true };
    }
    let r = null;
    try {
      r = text ? JSON.parse(text) : null;
    } catch {}
    const pending = Boolean(r && !r.consumedAt);
    resultSeen = {
      stamp,
      pending,
      stop: pending && Array.isArray(r.actions) && r.actions.some((a) => a && a.type === "stop"),
    };
  }
  return resultSeen;
}

const pendingResult = () => resultFlags().pending;
const pendingStop = () => resultFlags().stop;

// The chat inbox as last parsed, re-read only when the file has moved: every
// frame carries the conversation, and frames go out on every change.
let chatSeen = { stamp: null, entries: [] };
function chatEntries() {
  const stamp = fileStamp(CHAT_PATH);
  if (stamp !== chatSeen.stamp) chatSeen = { stamp, entries: readChat(DIR) };
  return chatSeen.entries;
}

// How far the agent has collected the inbox. console.mjs writes the cursor
// when it hands entries over, so this is the "picked up, answering" signal the
// Ask pane shows a spinner for.
let cursorSeen = { stamp: null, seq: 0 };
function chatPickedUp() {
  const stamp = fileStamp(CURSOR_PATH);
  if (stamp !== cursorSeen.stamp) cursorSeen = { stamp, seq: readCursor(DIR) };
  return cursorSeen.seq;
}

function chatOfflineNow(state) {
  return chatOffline({
    finish: state && state.finish,
    agent: state && state.agent,
    agentLastSeenMs: agentSeenAt,
    now: Date.now(),
  });
}

/* ------------------------------------------------------------ workspace */

// workspace.json has one writer, this server; ledger.ndjson has one,
// console.mjs. Both are re-read only when their file has moved.
const WORKSPACE_PATH = path.join(DIR, WORKSPACE_FILE);
const LEDGER_PATH = path.join(DIR, LEDGER_FILE);
const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";
const foldPath = (p) => (FOLD_CASE ? p.toLowerCase() : p);

let workspaceSeen = { stamp: null, ws: null };

// The folder the session runs in: the state's own once it is written, else
// the one `open` passed on the command line. Null while neither is known.
const sessionWorktree = () => stateNow?.worktree || WORKTREE || null;

// The session's workspace, created with just the original folder when absent.
function workspaceNow() {
  const stamp = fileStamp(WORKSPACE_PATH);
  if (stamp && stamp === workspaceSeen.stamp) return workspaceSeen.ws;
  const ws = (stamp && readWorkspace(DIR)) || null;
  if (ws) {
    workspaceSeen = { stamp, ws };
    return ws;
  }
  const root = sessionWorktree();
  const fresh = { ...initialWorkspace(root || PROJECT), remote: remoteWarning().remote || "" };
  // There but unreadable for now (a scanner's lock): never written over, and
  // never cached, so the next call reads it again.
  if (stamp) return workspaceSeen.ws || fresh;
  // Nor saved while the session's folder is unknown: PROJECT is only a guess
  // (the main checkout, for a linked worktree), and the file, once written,
  // is what every later read trusts.
  if (!root) return fresh;
  try {
    saveWorkspace(fresh);
  } catch {}
  return fresh;
}

function saveWorkspace(ws) {
  writeWorkspace(DIR, ws);
  workspaceSeen = { stamp: fileStamp(WORKSPACE_PATH), ws };
}

// One change: a new version, an entry in the change log the agent is handed,
// the file, and every open page.
function bumpWorkspace(ws, change) {
  ws.version = (ws.version || 0) + 1;
  ws.changes = [...(ws.changes || []), { ...change, version: ws.version }];
  saveWorkspace(ws);
  pushState();
}

function isFolder(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

// A folder deleted on disk is marked missing, and unmarked when it comes back.
function checkFolders(ws) {
  ws.missing = ws.missing || [];
  for (const f of ws.folders) {
    const there = isFolder(f.path);
    const marked = ws.missing.includes(f.id);
    if (!there && !marked) {
      ws.missing = [...ws.missing, f.id];
      bumpWorkspace(ws, { kind: "missing", name: f.name, path: f.path });
    } else if (there && marked) {
      ws.missing = ws.missing.filter((id) => id !== f.id);
      bumpWorkspace(ws, { kind: "found", name: f.name, path: f.path });
    }
  }
}

let ledgerSeen = { stamp: null, entries: [], launches: 0 };
function ledgerEntries() {
  const stamp = fileStamp(LEDGER_PATH);
  if (stamp !== ledgerSeen.stamp) {
    const entries = readLedger(DIR);
    ledgerSeen = { stamp, entries, launches: entries.filter((e) => e.kind === "launch").length };
  }
  return ledgerSeen.entries;
}

// What the agent reported it could not read during the current skill run:
// folder-issue entries after the last launch, the latest per folder name.
function folderIssues(entries) {
  let from = 0;
  entries.forEach((e, i) => e.kind === "launch" && (from = i + 1));
  const latest = new Map();
  for (const e of entries.slice(from)) {
    if (e.kind !== "folder-issue") continue;
    latest.set(e.name, { name: e.name, reason: e.reason, ...(e.hint ? { hint: e.hint } : {}) });
  }
  return [...latest.values()];
}

function workspaceView() {
  const { folders, missing, remote } = workspaceNow();
  return { folders, missing: missing || [], remote: remote || "", issues: folderIssues(ledgerEntries()) };
}

// Whether child sits strictly under parent.
function within(parent, child) {
  const rel = path.relative(foldPath(parent), foldPath(child));
  return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !path.isAbsolute(rel);
}

const cleanDescription = (d) => (typeof d === "string" ? d.trim().slice(0, 200) : "");

function nextFolderId(ws) {
  const ns = ws.folders.map((f) => Number.parseInt(String(f.id).slice(1), 10)).filter(Number.isInteger);
  return "f" + (Math.max(-1, ...ns) + 1);
}

// Each route below answers with [status, body]; validation always comes
// before any change, so a refusal leaves the file as it was.
function addFolder(ws, body) {
  const raw = typeof body.path === "string" ? body.path.trim().replace(/^(["'])(.*)\1$/, "$2").trim() : "";
  const input = raw.replace(/^~(?=$|[\\/])/, () => os.homedir());
  const resolved = raw ? path.resolve(sessionWorktree() || PROJECT, input) : "";
  if (!resolved || !isFolder(resolved)) return [400, { reason: "not-a-folder" }];
  const same = ws.folders.find((f) => foldPath(path.resolve(f.path)) === foldPath(resolved));
  if (same) return [400, { reason: "duplicate", name: same.name }];
  const nested = ws.folders.some((f) => within(f.path, resolved));
  const name = typeof body.name === "string" && body.name ? body.name : defaultName(resolved);
  if (nameProblem(name)) return [400, { reason: "bad-name" }];
  const taken = new Set(ws.folders.map((f) => f.name));
  if (taken.has(name)) return [400, { reason: "name-taken", suggest: freeName(name, taken) }];
  const entry = { id: nextFolderId(ws), path: resolved, name, description: cleanDescription(body.description), nested };
  ws.folders = [...ws.folders, entry];
  bumpWorkspace(ws, { kind: "added", name, path: resolved, description: entry.description });
  return [200, entry];
}

function editFolder(ws, body) {
  const entry = ws.folders.find((f) => f.id === body.id);
  if (!entry) return [404, { reason: "unknown" }];
  const rename = typeof body.name === "string" && body.name !== entry.name;
  if (rename) {
    if (nameProblem(body.name)) return [400, { reason: "bad-name" }];
    const taken = new Set(ws.folders.filter((f) => f !== entry).map((f) => f.name));
    if (taken.has(body.name)) return [400, { reason: "name-taken", suggest: freeName(body.name, taken) }];
  }
  const description = typeof body.description === "string" ? cleanDescription(body.description) : entry.description;
  if (rename) {
    const from = entry.name;
    entry.name = body.name;
    bumpWorkspace(ws, { kind: "renamed", from, name: entry.name, path: entry.path });
  }
  if (description !== entry.description) {
    entry.description = description;
    bumpWorkspace(ws, { kind: "described", name: entry.name, path: entry.path, description });
  }
  return [200, entry];
}

function removeFolder(ws, body) {
  const entry = ws.folders.find((f) => f.id === body.id);
  if (entry && entry.original) return [400, { reason: "original" }];
  if (!entry) return [404, { reason: "unknown" }];
  ws.folders = ws.folders.filter((f) => f !== entry);
  ws.missing = (ws.missing || []).filter((id) => id !== entry.id);
  bumpWorkspace(ws, { kind: "removed", name: entry.name, path: entry.path });
  return [200, { ok: true }];
}

// Where the picker opens: beside the last folder added, else the original.
function pickerStart(ws) {
  const added = ws.folders.filter((f) => !f.original);
  return added.length ? path.dirname(added[added.length - 1].path) : ws.folders[0]?.path || sessionWorktree() || PROJECT;
}

// One picker at a time. Spawned, never spawnSync: the dialog can sit open for
// minutes, and every poll, chat message and `wait` health check has to keep
// being answered meanwhile.
let pickerBusy = false;

function bootWorkspace() {
  // Nothing to check yet: the first read once the state is written makes it.
  if (!sessionWorktree() && !fileStamp(WORKSPACE_PATH)) return;
  const ws = workspaceNow();
  const remote = remoteWarning().remote || "";
  if ((ws.remote || "") !== remote) {
    ws.remote = remote;
    saveWorkspace(ws);
  }
  checkFolders(ws);
}

/**
 * Open a conversation when there is none, and a new one whenever the page
 * passes through the dashboard. The reset line carries the workflow it was
 * opened under, so a server that restarts across a hop still sees the switch.
 * A resume that keeps its workflow keeps its conversation.
 */
function ensureConversation(state) {
  if (!state) return;
  const last = currentConversation(readChat(DIR));
  let entry = null;
  if (!last.conversation) {
    entry = appendChat(DIR, { kind: "reset", conversation: 1, workflow: state.workflow, reason: "start" });
  } else if (last.workflow !== state.workflow && (last.workflow === "dashboard" || state.workflow === "dashboard")) {
    entry = appendChat(DIR, {
      kind: "reset",
      conversation: last.conversation + 1,
      workflow: state.workflow,
      reason: "switch",
    });
  }
  if (entry) appendEvent(DIR, { type: "chat-reset", reason: entry.reason });
}

// What the page needs to draw itself, in the shape of the SSE state frame.
// `have` names that exact view, for the page to hand back when it opens its
// stream (see /events).
function stateFrame(state) {
  const { pending, stop } = resultFlags();
  return {
    rev,
    state,
    agentLastSeen: agentLastSeen(),
    pendingResult: pending,
    pendingStop: stop,
    chat: { ...chatForFrame(chatEntries(), state), pickedUp: chatPickedUp(), offline: chatOfflineNow(state) },
    workspace: workspaceView(),
    meter: meterView(ledgerEntries()),
    have: haveKey(),
  };
}

function haveKey() {
  const { pending, stop } = resultFlags();
  chatEntries();
  chatPickedUp();
  workspaceNow();
  ledgerEntries();
  return (
    `${STARTED}.${rev}.${pending ? 1 : 0}${stop ? 1 : 0}.${chatSeen.stamp || ""}.${cursorSeen.stamp || ""}` +
    `.${workspaceSeen.stamp || ""}.${ledgerSeen.stamp || ""}`
  );
}

/**
 * Write what the person sent onto the item itself.
 *
 * The page shows a settled question's answer back to them, and the agent is
 * supposed to record one when it settles the question. This is the belt to that
 * braces: a model that forgets the `answer` field leaves someone staring at a
 * card marked "Settled" with nothing in it, and they cannot tell what they said.
 *
 * It never touches `status`. Only the agent decides when a question is settled,
 * and this must not look like an answer the agent has read.
 */
function recordSubmitted(state, actions) {
  if (!Array.isArray(state.items)) return;
  const at = nowIso();
  for (const action of actions) {
    if (!action || typeof action !== "object") continue;
    const item = state.items.find((i) => i && i.id === action.i);
    if (!item) continue;
    if (action.type === "comment") {
      const pick = (list) => (Array.isArray(list) ? list.map(({ path, name }) => ({ path, name })) : []);
      item.sentNote = { at, text: String(action.text || ""), images: pick(action.images), files: pick(action.files) };
      continue;
    }
    const { i, type, ...rest } = action;
    // JSON.parse makes "__proto__" an own property, and it would then be
    // written back into state.json and re-read forever.
    if (Object.prototype.hasOwnProperty.call(rest, "__proto__")) delete rest["__proto__"];
    item.submitted = { at, ...rest };
  }
}

function baseHeaders(extra = {}) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...extra,
  };
}

function send(res, code, body, type = "application/json", extra = {}) {
  res.writeHead(code, baseHeaders({ "content-type": type, ...extra }));
  res.end(body);
}

function json(res, code, obj, extra = {}) {
  send(res, code, JSON.stringify(obj), "application/json", extra);
}

function timingSafeEq(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

// One cookie per port. Browsers scope cookies by host and ignore the port, so
// with one shared name every session on 127.0.0.1 wrote over the one before
// it, and the first session's tab went on sending the second one's token and
// got nothing but 403s. The port is what makes a session's origin its own, and
// a resumed server on a new port is reached again only through its /s/ link,
// which sets the cookie under the new name.
const cookieName = () => `p2c_console_${PORT}`;

function cookieToken(req) {
  const raw = req.headers.cookie || "";
  const name = cookieName();
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function authed(req) {
  if (!TOKEN) return true;
  const c = cookieToken(req);
  return c ? timingSafeEq(c, TOKEN) : false;
}

/**
 * The DNS-rebinding defence, and the highest-value check in this file.
 *
 * Without it, any page the user visits can resolve its own hostname to
 * 127.0.0.1 and then talk to this server as same-origin. That is not
 * theoretical: it is the exact shape of Vite's GHSA-vg6x-rcgg-rjx6.
 */
function hostOk(req, port) {
  const host = req.headers.host;
  if (!host) return false;
  return host === `127.0.0.1:${port}` || host === `localhost:${port}`;
}

function originOk(req, port) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin fetches and plain navigations send none
  return origin === `http://127.0.0.1:${port}` || origin === `http://localhost:${port}`;
}

function touch() {
  lastContact = Date.now();
}

const MODEL_CLIS = ["claude", "devin"];
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
// Devin's XHigh and Max efforts are never offered, curated or added.
const MODEL_EFFORT_BLOCKED = /-(xhigh|max)$/i;

/**
 * The user's added models: { claude: [{id,label}], devin: [...] }. Returns { models } or
 * { error }. Blank rows are dropped; ids are trimmed and made unique per CLI; a label
 * defaults to the id. Nothing else in the body survives.
 */
function cleanModels(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "models must be an object" };
  const models = {};
  for (const cli of MODEL_CLIS) {
    const list = input[cli] == null ? [] : input[cli];
    if (!Array.isArray(list) || list.length > 50) return { error: `${cli} must be a list of at most 50 models` };
    const seen = new Set();
    models[cli] = [];
    for (const row of list) {
      const id = String((row && row.id) ?? "").trim();
      if (!id) continue;
      if (!MODEL_ID.test(id)) return { error: `"${id}" is not a valid model id` };
      if (MODEL_EFFORT_BLOCKED.test(id)) return { error: `"${id}": only Low, Medium and High efforts are allowed` };
      if (seen.has(id)) continue;
      seen.add(id);
      const label = String((row && row.label) ?? "").trim().slice(0, 80) || id;
      models[cli].push({ id, label });
    }
  }
  return { models };
}

function shippedModels() {
  const file = readJson(SHIPPED_MODELS_FILE, null) || {};
  const out = {};
  for (const cli of MODEL_CLIS) {
    out[cli] = (Array.isArray(file[cli]) ? file[cli] : []).filter((m) => m && typeof m.id === "string");
  }
  return out;
}

/**
 * Whittle a POSTed settings object down to what a settings file may hold.
 * The page only sends { theme, accent } today, but the file is shared and
 * forward-compatible: any flat string/number/boolean may live in it. Nested
 * objects, arrays and a hundred-key dump may not — this is a preference file,
 * not free storage, and it is read back into the page unfiltered.
 */
function cleanLooks(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    if (k === "__proto__" || k.length > 64) continue;
    const t = typeof v;
    if (t === "number" || t === "boolean" || (t === "string" && v.length <= 256)) out[k] = v;
    if (Object.keys(out).length > 40) return null;
  }
  return Object.keys(out).length ? out : null;
}

/* ---------------------------------------------------------------- assets */

// Read once per server, from memory after that. Held for the server's whole
// life on purpose: a skill reinstalled under a running session must not hand
// one page a new app.js beside the old answers.js it imports.
//
// Revalidated rather than stored: `no-cache` plus an ETag makes a reload a
// round of 304s instead of 400KB again. Every session is a new port, and so a
// new origin with a cold cache, which is why the first load is made cheap by
// other means (preload hints, the inline boot state) rather than by caching.
const assets = new Map();

function asset(rel) {
  let a = assets.get(rel);
  if (!a) {
    let body = fs.readFileSync(path.join(PUBLIC_DIR, rel));
    if (rel === "app.css") body = Buffer.concat([body, Buffer.from(accentCss())]);
    const etag = `"${crypto.createHash("sha1").update(body).digest("base64url").slice(0, 20)}"`;
    a = { body, etag, type: TYPES[path.extname(rel)] || "application/octet-stream" };
    assets.set(rel, a);
  }
  return a;
}

// The saved highlight color, painted from the very first frame. The page's
// script owns the colors once it runs (applyLooks clears the attribute these
// hang off), but until then the only way to avoid flashing the default ocean
// at someone who picked violet is a stylesheet rule the server can switch on
// with an attribute: the CSP forbids inline styles, and the colors live in
// palette.js, so they are generated from there rather than copied into CSS.
function accentCss() {
  const vars = (shades) =>
    ["--accent", "--accent-soft", "--accent-ink", "--accent-line"].map((n, i) => `${n}:${shades[i]}`).join(";");
  let css = "\n/* Generated by server.mjs from palette.js: the saved accent before app.js runs. */\n";
  for (const [id, a] of Object.entries(ACCENTS)) {
    if (id === DEFAULT_ACCENT) continue;
    const sel = `:root[data-looks-accent="${id}"]`;
    css += `${sel}{${vars(a.light)}}\n`;
    css += `@media (prefers-color-scheme: dark){${sel}:not([data-theme="light"]){${vars(a.dark)}}}\n`;
    css += `${sel}[data-theme="dark"]{${vars(a.dark)}}\n`;
  }
  return css;
}

// looks.json, re-read only when it changes: it is read into every page load.
let looksSeen = { stamp: null, looks: null };
function savedLooks() {
  const stamp = fileStamp(LOOKS_FILE);
  if (stamp !== looksSeen.stamp) {
    const saved = stamp ? readJson(LOOKS_FILE, null) : null;
    looksSeen = { stamp, looks: saved && saved.looks && typeof saved.looks === "object" ? saved.looks : null };
  }
  return looksSeen.looks;
}

const escHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

let indexTemplate = null;

/**
 * The page, with everything the first paint needs already in it.
 *
 * The page used to arrive as a blank template that said "Pathfinder" and
 * "Connecting…" whatever the session was, then fetch /state, then /looks, and
 * only then draw anything real. Now the server writes the session's name,
 * badge and theme into the markup and the whole first state into an inline
 * JSON block, so the script draws the real screen the moment it runs, with no
 * round trip in between. The block is data, not script: `application/json`
 * is never executed, so the CSP's ban on inline script stands untouched.
 * Every `<` in it is escaped, which is what keeps a `</script>` inside some
 * agent-written text from closing the block early.
 */
function renderIndex() {
  if (indexTemplate === null) indexTemplate = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  const state = readState();
  const looks = savedLooks();
  const boot = {
    ...stateFrame(state),
    draft: readJson(DRAFT_FILE, {}),
    looks,
  };
  let htmlAttrs = "";
  if (looks && (looks.theme === "light" || looks.theme === "dark")) htmlAttrs += ` data-theme="${looks.theme}"`;
  if (looks && looks.accent !== DEFAULT_ACCENT && Object.hasOwn(ACCENTS, String(looks.accent))) {
    htmlAttrs += ` data-looks-accent="${looks.accent}"`;
  }
  // The same first-paint reasoning as the accent: a Wide user never sees the
  // column jump from the default width. The value is one of the fixed preset
  // keys, so there is nothing to escape.
  if (looks && cardWidth(looks.width) !== DEFAULT_CARD_WIDTH) {
    htmlAttrs += ` data-width="${cardWidth(looks.width)}"`;
  }
  const title = (state && state.title) || "Session";
  const workflow = state && state.workflow;
  const json = JSON.stringify(boot).replace(/</g, "\\u003c");
  // Function replacements throughout: a string replacement reads `$&` and
  // `$'` in the inserted text as patterns, and titles and state are free text.
  return indexTemplate
    .replace('<html lang="en">', () => `<html lang="en"${htmlAttrs}>`)
    .replace(
      "<title>Plan2Code Console</title>",
      () => `<title>${escHtml(title)} · #${escHtml(String(SID).slice(-6))} · Plan2Code</title>`
    )
    .replace('<h1 id="title">Plan2Code Console</h1>', () => `<h1 id="title">${escHtml(title)}</h1>`)
    .replace(
      '<span class="badge" id="badge">Pathfinder</span>',
      () => `<span class="badge" id="badge">${escHtml(workflowLabel(workflow))}</span>`
    )
    .replace(
      '<h2 class="launch-title" id="boot-title">Opening the console</h2>',
      () =>
        `<h2 class="launch-title" id="boot-title">${escHtml(
          workflow === "dashboard" ? "Opening the dashboard" : `Starting ${workflowTitle(workflow)}`
        )}</h2>`
    )
    .replace("<!-- p2c:boot -->", () => `<script type="application/json" id="boot">${json}</script>`);
}

/* ------------------------------------------------------------------ SSE */

// Exactly one stream per page. Browsers cap HTTP/1.1 at ~6 connections per
// origin, and an open stream holds one permanently; a second stream per tab
// across three tabs wedges the origin with no error and no timeout. Everything
// is multiplexed through this one channel with a `type` field.
const clients = new Set();

function broadcast(type, data) {
  seq++;
  const payload = `id: ${seq}\nevent: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(payload);
    } catch {
      clients.delete(res);
    }
  }
}

function pushState() {
  if (stateNow) broadcast("state", stateFrame(stateNow));
}

let agentSeenAt = Date.now();
function agentLastSeen() {
  return new Date(agentSeenAt).toISOString();
}

/* --------------------------------------------------------------- routes */

// The port this server answers on. Known before the server is: a handed-over
// socket was bound by console.mjs, so `server.address()` has nothing to say.
let PORT = 0;

const server = http.createServer((req, res) => {
  const port = PORT;
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname;

  if (!hostOk(req, port)) return send(res, 403, "", "text/plain");

  // /health is the liveness probe the CLI uses to distinguish "our server"
  // from a process that merely inherited the PID. Deliberately unauthenticated
  // and deliberately tells you nothing but the session id.
  if (pathname === "/health") {
    touch();
    agentSeenAt = Date.now();
    return json(res, 200, { ok: true, sid: SID, browsers, rev, phase: readState()?.phase || "unknown" });
  }

  // Token in the PATH, not the query string. Two reasons: a query string would
  // put an `&` in the URL, and `cmd /c start <url>` on Windows parses `&` as a
  // command separator; and the 302 below gets the secret out of the address bar,
  // out of history, and out of any screenshot the user pastes into a ticket.
  if (pathname.startsWith("/s/")) {
    const given = pathname.slice(3).replace(/\/$/, "");
    if (!TOKEN || !timingSafeEq(given, TOKEN)) return send(res, 403, "Not found", "text/plain");
    touch();
    res.writeHead(
      302,
      baseHeaders({
        location: "/",
        "set-cookie": `${cookieName()}=${TOKEN}; HttpOnly; SameSite=Strict; Path=/`,
      })
    );
    return res.end();
  }

  if (!authed(req)) return send(res, 403, "Open the link the terminal printed.", "text/plain");
  touch();

  if (pathname === "/" && req.method === "GET") {
    let html;
    try {
      html = renderIndex();
    } catch {
      return send(res, 500, "index.html missing", "text/plain");
    }
    // No 'unsafe-inline'. That is why the client is separate .js/.css files
    // rather than one inlined page: it makes an injected inline <script> or
    // onerror= attribute inert even if the renderer has a bug.
    const csp =
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
      "font-src 'self'; connect-src 'self'; media-src 'self'; " +
      "base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
    return send(res, 200, html, TYPES[".html"], { "content-security-policy": csp });
  }

  if (req.method === "GET" && SERVABLE.has(pathname.slice(1))) {
    const rel = pathname.slice(1);
    const abs = path.join(PUBLIC_DIR, rel);
    if (!abs.startsWith(PUBLIC_DIR)) return send(res, 403, "", "text/plain");
    let a;
    try {
      a = asset(rel);
    } catch {
      return send(res, 404, "", "text/plain");
    }
    const headers = { "cache-control": "no-cache", etag: a.etag };
    if (req.headers["if-none-match"] === a.etag) {
      res.writeHead(304, baseHeaders(headers));
      return res.end();
    }
    return send(res, 200, a.body, a.type, headers);
  }

  // The spec's overview.md, read-only. A dashboard honours ?spec= only for a
  // spec its own scan found; every other workflow reads its own specDir.
  // readOverview() keeps the read inside the project root.
  if (pathname === "/overview" && req.method === "GET") {
    const state = readState() || {};
    const asked = url.searchParams.get("spec");
    const spec =
      state.workflow === "dashboard"
        ? (state.scan?.specs || []).some((s) => s && s.dir === asked)
          ? asked
          : ""
        : state.specDir;
    readOverview(state.worktree || state.project, spec)
      .then((text) =>
        typeof text === "string"
          ? send(res, 200, text, "text/markdown; charset=utf-8", { "cache-control": "no-store" })
          : json(res, 404, { error: "no overview" })
      )
      .catch(() => json(res, 404, { error: "no overview" }));
    return;
  }

  if (pathname === "/version" && req.method === "GET") {
    for (const file of [path.join(HERE, "version.json"), path.join(HERE, "..", "..", "version.json")]) {
      const version = readJson(file, {}).version;
      if (typeof version === "string" && version) return json(res, 200, { version });
    }
    return json(res, 404, { error: "no version" });
  }

  if (pathname === "/state" && req.method === "GET") {
    const state = readState();
    if (!state) return json(res, 404, { error: "no state" });
    return json(res, 200, { ...stateFrame(state), draft: readJson(DRAFT_FILE, {}) });
  }

  if (pathname === "/events" && req.method === "GET") {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    // Without flushHeaders the browser sits on buffered headers and
    // EventSource never fires onopen.
    res.flushHeaders();
    res.setTimeout(0);
    clients.add(res);
    browsers = clients.size;
    res.write(`retry: 2000\n\n`);
    const state = readState();
    // pendingResult belongs in the FIRST frame as much as in every later one.
    // The page decides from it whether a send is still in flight; leaving it
    // out of the opening frame made a reconnecting tab briefly believe its last
    // answers had already been dealt with.
    //
    // Unless the page already holds exactly this: it says what it drew from
    // (`have`, from the state inlined into the page it was served), and a
    // frame that matches it would only make it redraw the same screen. The
    // server's start time is in the key, so a restarted server whose counter
    // happens to land on the same number is never mistaken for this one.
    if (state && url.searchParams.get("have") !== haveKey()) {
      res.write(`event: state\ndata: ${JSON.stringify(stateFrame(state))}\n\n`);
    }
    req.on("close", () => {
      clients.delete(res);
      browsers = clients.size;
    });
    return;
  }

  if (pathname === "/draft" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err) return json(res, 400, { error: "body must be JSON" });
      // Debounced client-side; this is just the durable mirror. Twenty minutes
      // of someone's structured answers must not die with a closed tab.
      try {
        writeJsonAtomic(DRAFT_FILE, { at: nowIso(), rev, ...body });
      } catch (e) {
        return json(res, 500, { error: String(e.message) });
      }
      return json(res, 200, { ok: true });
    });
  }

  // The person's colors and theme, kept by the server rather than the browser:
  // localStorage is tied to the origin and the origin carries the ephemeral
  // port, so a new session on a new port starts on defaults. This file is the
  // copy that follows the app instead of the port.
  if (pathname === "/looks" && req.method === "GET") {
    const saved = readJson(LOOKS_FILE, null);
    if (!saved || !saved.looks) return json(res, 404, { error: "no looks saved" });
    return json(res, 200, saved);
  }

  if (pathname === "/looks" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err) return json(res, 400, { error: "body must be JSON" });
      // `set` carries only the keys one tab changed, merged onto what is on
      // disk, so a tab holding stale settings cannot undo another tab's change.
      const set = body && body.set !== undefined ? cleanLooks(body.set) : null;
      const looks = set ? { ...(readJson(LOOKS_FILE, null)?.looks || {}), ...set } : cleanLooks(body && body.looks);
      if (!looks) return json(res, 400, { error: "looks must be an object of simple settings" });
      try {
        ensureDir(path.dirname(LOOKS_FILE));
        writeJsonAtomic(LOOKS_FILE, { at: nowIso(), looks });
      } catch (e) {
        return json(res, 500, { error: String(e.message) });
      }
      return json(res, 200, { ok: true });
    });
  }

  // The launcher's model menu: what ships (read-only here) and what the user added.
  if (pathname === "/models" && req.method === "GET") {
    const saved = readJson(USER_MODELS_FILE, null) || {};
    const { models } = cleanModels(saved);
    return json(res, 200, { shipped: shippedModels(), user: models || { claude: [], devin: [] } });
  }

  if (pathname === "/models" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err) return json(res, 400, { error: "body must be JSON" });
      const { models, error } = cleanModels(body && body.models);
      if (error) return json(res, 400, { error });
      try {
        ensureDir(path.dirname(USER_MODELS_FILE));
        writeJsonAtomic(USER_MODELS_FILE, models);
      } catch (e) {
        return json(res, 500, { error: String(e.message) });
      }
      return json(res, 200, { ok: true, user: models });
    });
  }

  if (pathname === "/upload" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    const contentType = String(req.headers["content-type"] || "");
    const store = (buf, ext) => {
      const id = crypto.randomUUID();
      const file = uploadPath(id, ext);
      try {
        ensureDir(UPLOADS_DIR);
        fs.writeFileSync(file, buf, { flag: "wx" });
      } catch (e) {
        json(res, 500, { error: String(e.message) });
        return null;
      }
      return { id, file };
    };

    if (contentType.startsWith("image/jpeg")) {
      return readRaw(req, MAX_BODY, (err, buf) => {
        if (err) return err.tooBig ? json(res, 413, { error: "too large" }) : json(res, 400, { error: String(err.message) });
        if (buf.length < 3 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
          return json(res, 415, { error: "JPEG only" });
        }
        const saved = store(buf, "jpg");
        if (!saved) return;
        const { id, file } = saved;
        appendEvent(DIR, { type: "upload", id, kind: "image", bytes: buf.length });
        return json(res, 200, {
          ok: true,
          id,
          kind: "image",
          path: file,
          url: "/uploads/" + id + ".jpg",
          name: uploadLabel(req, "image.jpg"),
          size: buf.length,
        });
      });
    }

    // A document: the extension comes from the allow-list via its name, and
    // the bytes have to agree with it. No `url` comes back: the page builds
    // the link from the path, as it does for the delete route.
    if (contentType.startsWith("application/octet-stream")) {
      // The extension comes from the whole name: the label is cut at 200
      // characters, and a long name would lose it there.
      const name = uploadLabel(req, "");
      const ext = docExt(rawUploadName(req));
      // Refused on its name alone, but drained first, so the page gets the 415.
      if (!ext) return readRaw(req, 0, () => json(res, 415, { error: "type" }));
      return readRaw(req, MAX_DOC_BYTES, (err, buf) => {
        if (err) return err.tooBig ? json(res, 413, { error: "too large" }) : json(res, 400, { error: String(err.message) });
        if (checkDocument(buf, ext)) return json(res, 415, { error: "type" });
        const saved = store(buf, ext);
        if (!saved) return;
        const { id, file } = saved;
        appendEvent(DIR, { type: "upload", id, kind: "file", bytes: buf.length });
        return json(res, 200, { ok: true, id, kind: "file", path: file, name, size: buf.length });
      });
    }

    return readRaw(req, 0, () => json(res, 415, { error: "type" }));
  }

  // Matched on the raw request line as well as the parsed path: URL parsing
  // folds `..` segments away, and nothing that needed folding is an upload.
  // GET and DELETE take images and documents alike.
  if (pathname.startsWith("/uploads/") || req.url.startsWith("/uploads/")) {
    if (req.method === "GET") {
      const m = UPLOAD_ANY_ROUTE.exec(req.url);
      const file = m && m[0] === pathname ? uploadPath(m[1], m[2]) : null;
      if (!file) return json(res, 404, { error: "not found" });
      let buf;
      try {
        buf = fs.readFileSync(file);
      } catch {
        return json(res, 404, { error: "not found" });
      }
      const ext = m[2];
      if (ext === "jpg") return send(res, 200, buf, "image/jpeg", { "cache-control": "private, max-age=86400" });
      const pdf = DOC_TYPES[ext].kind === "pdf";
      // A sandboxed PDF cannot load the browser's viewer, and one needs no
      // sandbox: text is the only thing a browser might otherwise run.
      return send(res, 200, buf, pdf ? "application/pdf" : "text/plain; charset=utf-8", {
        ...(pdf ? {} : { "content-security-policy": "sandbox" }),
        "cache-control": "private, max-age=86400",
      });
    }
    if (req.method === "DELETE") {
      if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
      const m = UPLOAD_ANY_ROUTE.exec(req.url);
      const file = m && m[0] === pathname ? uploadPath(m[1], m[2]) : null;
      if (!file || !fs.existsSync(file)) return json(res, 404, { error: "not found" });
      try {
        fs.rmSync(file);
      } catch (e) {
        return json(res, 500, { error: String(e.message) });
      }
      appendEvent(DIR, { type: "upload-delete", id: m[1] });
      res.writeHead(204, baseHeaders());
      return res.end();
    }
    return json(res, 404, { error: "not found" });
  }

  if (pathname === "/submit" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err) return json(res, 400, { error: "body must be JSON" });
      if (!body || !Array.isArray(body.actions) || body.actions.length === 0) {
        return json(res, 400, { error: "actions must be a non-empty array" });
      }
      const badAttachments = body.actions.some((a) => {
        if (!a || typeof a !== "object" || a.type !== "comment") return false;
        const ok = attachmentsOk(a.images, a.files);
        return !(ok.images && ok.files && ok.count);
      });
      if (badAttachments) {
        return json(res, 400, { error: "a comment carries at most 5 attachments, each uploaded to this session" });
      }
      const result = {
        type: "submit",
        at: nowIso(),
        sid: SID,
        rev,
        actions: body.actions,
        reply: body.reply || "",
      };
      // The result and the state change together, under the state lock: a
      // `post` or an `open` landing in the middle of a send would otherwise
      // write back a state read before it, and the send's record would go, or
      // this write would carry an older state over the agent's new one.
      let refused = null;
      let written = null;
      let agentWrote = false;
      try {
        written = withStateLock(DIR, () => {
          // One send is one agent turn. Writing over a result the agent has not
          // collected yet destroys everything in it, and the loss is silent: two
          // tabs, or one impatient second press, and an approval disappears.
          if (pendingResult()) {
            refused = "pending";
            return null;
          }
          try {
            // Atomic: the waiter polls this file and will land mid-write eventually.
            writeJsonAtomic(RESULT_FILE, result);
          } catch (e) {
            refused = String(e.message);
            return null;
          }
          try {
            // Read fresh from disk, never from the cache: an agent write the
            // watcher has not reached yet is in the file and must be kept.
            const text = fs.readFileSync(STATE_FILE, "utf8");
            const state = JSON.parse(text);
            agentWrote = text !== lastStateText;
            state.phase = "submitted";
            recordSubmitted(state, body.actions);
            return { state, text: writeJsonAtomic(STATE_FILE, state) };
          } catch {
            // The answers are safe in result.json; the stamp is only a courtesy.
            return null;
          }
        });
      } catch (e) {
        refused = String(e.message);
      }
      if (refused === "pending") {
        return json(res, 409, {
          error: "pending",
          message:
            "Your last answers have not been picked up yet. Nothing is lost, they are still on their way.",
        });
      }
      if (refused) return json(res, 500, { error: refused });
      appendEvent(DIR, { type: "submit", rev, count: body.actions.length });
      if (written) {
        // Account for our own write here rather than letting the watcher find
        // it: the watcher reads a changed state.json as proof the AGENT is
        // alive, and this write is not that. An agent write it swept up on the
        // way is, and is handled as the watcher would have handled it.
        adoptStateText(written.text, written.state);
        rev++;
        if (agentWrote) {
          agentSeenAt = Date.now();
          try {
            ensureConversation(written.state);
          } catch {}
        }
      }
      // Name the items that went. A page with OTHER answers staged should drop
      // only what was sent, and a brief request is a submit carrying no answers
      // at all, so a blanket "everything is gone" is wrong for both.
      broadcast("submitted", {
        rev,
        ids: body.actions.map((a) => a && a.i).filter(Boolean),
      });
      pushState();
      return json(res, 200, { ok: true });
    });
  }

  // A Quick question, or New conversation ({ reset: true }). Its own channel:
  // this route never looks at result.json, so a card send waiting to be
  // collected never holds up a question, and a question never holds up a card.
  if (pathname === "/chat" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
      const state = readState() || {};
      const current = currentConversation(chatEntries()).conversation;

      if (body.reset === true) {
        if (chatOfflineNow(state)) return json(res, 409, { error: "offline" });
        if (body.conversation !== current) return json(res, 409, { error: "stale", conversation: current });
        const entry = appendChat(DIR, {
          kind: "reset",
          conversation: current + 1,
          workflow: state.workflow,
          reason: "button",
        });
        appendEvent(DIR, { type: "chat-reset", reason: "button" });
        rev++;
        pushState();
        return json(res, 200, { ok: true, seq: entry.seq, conversation: entry.conversation });
      }

      const text = typeof body.text === "string" ? body.text.trim() : "";
      if (!text) return json(res, 400, { error: "bad" });
      if (text.length > CHAT_MAX_CHARS) return json(res, 400, { error: "too-long" });
      const a = body.about;
      const aboutOk =
        a === undefined ||
        (a &&
          typeof a === "object" &&
          ["card", "section", "spec"].includes(a.kind) &&
          typeof a.id === "string" &&
          typeof a.label === "string");
      if (!aboutOk) return json(res, 400, { error: "bad" });
      const ok = attachmentsOk(body.images, body.files);
      if (!ok.images) return json(res, 400, { error: "image" });
      if (!ok.files) return json(res, 400, { error: "file" });
      if (!ok.count) return json(res, 400, { error: body.files ? "file" : "image" });

      if (chatOfflineNow(state)) return json(res, 409, { error: "offline" });
      if (body.conversation !== current) return json(res, 409, { error: "stale", conversation: current });
      if (typedCount(chatEntries(), current) >= CHAT_LIMIT) return json(res, 409, { error: "limit" });

      const entry = appendChat(DIR, {
        kind: "message",
        conversation: current,
        text,
        about: a ? { kind: a.kind, id: a.id, label: a.label } : undefined,
        // Names cleaned as /upload cleans them: a newline would split the line.
        images: body.images
          ? body.images.map((img) => ({ path: img.path, name: cleanLabel(img.name, "image.jpg") }))
          : undefined,
        files: body.files ? body.files.map((f) => ({ path: f.path, name: cleanLabel(f.name, "file") })) : undefined,
      });
      appendEvent(DIR, { type: "chat", seq: entry.seq });
      rev++;
      pushState();
      return json(res, 200, { ok: true, seq: entry.seq, conversation: current });
    });
  }

  // Approve or Decline on an edit the agent proposed in the chat. `re` is the
  // proposing reply's id. Decisions never count toward the message limit.
  if (pathname === "/chat/decision" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
      if (body.decision !== "approve" && body.decision !== "decline") return json(res, 400, { error: "bad" });
      if (body.text !== undefined && typeof body.text !== "string") return json(res, 400, { error: "bad" });
      const text = (body.text || "").trim();
      if (text.length > CHAT_MAX_CHARS) return json(res, 400, { error: "too-long" });

      const state = readState() || {};
      const entries = chatEntries();
      const current = currentConversation(entries).conversation;
      if (chatOfflineNow(state)) return json(res, 409, { error: "offline" });
      if (body.conversation !== current) return json(res, 409, { error: "stale", conversation: current });

      const reply = (state.chat?.replies || []).find((r) => r && r.id === body.re);
      const decided = entries.some((e) => e.kind === "decision" && e.re === body.re);
      if (typeof body.re !== "string" || !reply || !reply.proposal || reply.conversation !== current || decided) {
        return json(res, 400, { error: "bad" });
      }

      const entry = appendChat(DIR, {
        kind: "decision",
        conversation: current,
        re: body.re,
        decision: body.decision,
        text: text || undefined,
      });
      appendEvent(DIR, { type: "chat-decision", decision: body.decision });
      rev++;
      pushState();
      return json(res, 200, { ok: true, seq: entry.seq });
    });
  }

  // The Workspace: the original folder plus any the person adds as context.
  // The page changes it only through these routes; the agent hears of each
  // change once, through console.mjs.
  if (pathname === "/workspace" && req.method === "GET") {
    try {
      if (url.searchParams.get("check") === "1") checkFolders(workspaceNow());
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    return json(res, 200, workspaceView());
  }

  const workspaceRoutes = { "/workspace/add": addFolder, "/workspace/edit": editFolder, "/workspace/remove": removeFolder };
  if (Object.hasOwn(workspaceRoutes, pathname) && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, (err, body) => {
      if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
      let answer;
      try {
        answer = workspaceRoutes[pathname](workspaceNow(), body);
      } catch (e) {
        return json(res, 500, { error: String(e.message) });
      }
      return json(res, answer[0], answer[1]);
    });
  }

  // Only ever returns a path: the page then adds it through /workspace/add.
  if (pathname === "/workspace/browse" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return readBody(req, () => {
      const ws = workspaceNow();
      if (ws.remote) return json(res, 404, { reason: "no-picker" });
      if (pickerBusy) return json(res, 409, { reason: "busy" });
      // Tests only: stands in for the person, so no dialog ever opens.
      const echo = process.env.PLAN2CODE_PICKER_ECHO;
      if (echo) return json(res, 200, echo === "-" ? { cancelled: true } : { path: echo });
      const start = pickerStart(ws);
      if (!pickerCommand(start, WORKSPACE_PICKER_PROMPT)) return json(res, 404, { reason: "no-picker" });
      pickerBusy = true;
      pickFolder(start, WORKSPACE_PICKER_PROMPT)
        .then((picked) => (picked.error ? json(res, 500, { reason: "picker-failed" }) : json(res, 200, picked)))
        .catch(() => json(res, 500, { reason: "picker-failed" }))
        .finally(() => {
          pickerBusy = false;
        });
    });
  }

  if (pathname === "/cancel" && req.method === "POST") {
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    const result = { type: "cancel", at: nowIso(), sid: SID, rev, actions: [], reply: "" };
    // Under the state lock like a send, so `open` clearing a collected result
    // can never take this one with it. As /submit: a cancel that never reached
    // disk must not tell the page it did, or the page stands down while the
    // agent waits on forever.
    let pending = false;
    try {
      withStateLock(DIR, () => {
        pending = pendingResult();
        if (!pending) writeJsonAtomic(RESULT_FILE, result);
      });
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    if (pending) return json(res, 409, { error: "pending", message: "A send is still on its way." });
    appendEvent(DIR, { type: "cancel", rev });
    broadcast("cancelled", { rev });
    return json(res, 200, { ok: true });
  }

  // The heartbeat answers with the two facts that change without state.json
  // changing, and so reach the page no other way.
  //
  // The watcher only fires on state.json, which is the agent POSTING. An agent
  // that merely collects a result touches result.json, and one that is alive
  // but thinking touches nothing at all -- so a page could sit for minutes
  // insisting nobody had picked its answers up when something already had.
  // This request was already going out every five seconds carrying nothing.
  if (pathname === "/ping" && req.method === "POST") {
    const { pending, stop } = resultFlags();
    return json(res, 200, {
      ok: true,
      rev,
      agentLastSeen: agentLastSeen(),
      pendingResult: pending,
      pendingStop: stop,
      pendingChat: pendingChatCount(DIR, readState()),
    });
  }

  // Treat a departure as "shorten the deadline", never as "exit now": the user
  // may simply be reloading.
  if (pathname === "/bye") {
    // It moves the shutdown deadline, so only the page itself may send it.
    if (!originOk(req, port)) return json(res, 403, { error: "bad origin" });
    if (clients.size === 0) lastContact = Date.now() - (IDLE_MS - 2 * 60 * 1000);
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: "not found" });
});

const MAX_BODY = 4 * 1024 * 1024;

function readBody(req, cb) {
  // Collect Buffers and decode once at the end. Appending each chunk to a
  // string decodes it in isolation, so a multi-byte character split across a
  // chunk boundary becomes U+FFFD. Rare, silent, and impossible to reproduce
  // on demand, which is the worst combination.
  const chunks = [];
  let size = 0;
  let tooBig = false;
  req.on("data", (c) => {
    size += c.length;
    if (size > MAX_BODY) {
      tooBig = true;
      req.destroy();
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (tooBig) return cb(new Error("too large"));
    try {
      cb(null, JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch (e) {
      cb(e);
    }
  });
  req.on("error", (e) => cb(e));
}

// The binary sibling of readBody, for image and document uploads, each with
// its own cap. Past the cap it stops keeping chunks but drains the rest
// instead of destroying the request: a destroyed socket reaches the page as a
// network error, never as the 413 that lets it say the file was too large.
function readRaw(req, limit, cb) {
  const chunks = [];
  let size = 0;
  let tooBig = false;
  req.on("data", (c) => {
    size += c.length;
    if (size > limit) {
      tooBig = true;
      chunks.length = 0;
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (tooBig) return cb(Object.assign(new Error("too large"), { tooBig: true }));
    cb(null, Buffer.concat(chunks));
  });
  req.on("error", (e) => cb(e));
}

/* ------------------------------------------------------- state watching */

// The agent writes state.json through `console.mjs post`, and the server only
// through /submit; both under the state lock (updateState() in lib.mjs), so
// neither can write back a state read before the other's. Watch the DIRECTORY,
// not the file: on Windows a watch on a file breaks the moment that file is
// replaced by rename, which is exactly what an atomic write does.
let watchTimer = null;
let lastStateText = "";
let lastStateStamp = null;
let stateNow = null;

// A stat first, and a read only when the file has moved. The one-second poll
// used to read and compare the whole file every second for the whole session.
function checkState() {
  const stamp = fileStamp(STATE_FILE);
  if (stamp === lastStateStamp) return;
  try {
    const text = fs.readFileSync(STATE_FILE, "utf8");
    if (text !== lastStateText) {
      const parsed = JSON.parse(text); // ignore a torn read; we will catch it on the next tick
      lastStateText = text;
      stateNow = parsed;
      rev++;
      agentSeenAt = Date.now();
      try {
        ensureConversation(parsed);
      } catch {}
      pushState();
    }
    lastStateStamp = stamp;
  } catch {}
}

function adoptStateText(text, state) {
  lastStateText = text;
  lastStateStamp = fileStamp(STATE_FILE);
  stateNow = state;
}

// On Windows, fs.watch can ABORT the process outright: libuv asserts that the
// name a change is reported under starts with the dir it was asked to watch,
// and a dir spelled with an 8.3 short name (a TEMP like C:\Users\JUSTIN~1.PAR)
// reports the long form instead. An assert is not a JS exception -- no catch
// reaches it -- so the only safe move is not to watch such a path. The 1s
// poll below keeps the page current regardless; the watch only saves a beat.
// A segment that merely looks like ~N costs nothing: we poll instead.
const WIN_SHORT_NAME = /(^|[\\/])[^\\/]*~\d/;
if (process.platform !== "win32" || !WIN_SHORT_NAME.test(DIR)) {
  try {
    fs.watch(DIR, { persistent: false }, (_e, name) => {
      if (name === "state.json") {
        clearTimeout(watchTimer);
        watchTimer = setTimeout(checkState, 25);
      }
    });
  } catch {}
}
// The cursor has no watcher of its own: the next poll tick pushes a pickup.
function checkCursor() {
  const before = cursorSeen.stamp;
  chatPickedUp();
  if (cursorSeen.stamp !== before) pushState();
}
// The ledger likewise: a moved stamp is a new meter count or folder issue, and
// a new launch is a new skill run, which re-checks that every folder is there.
// Measured against what this check last handled, not against the read cache:
// every frame refreshes that cache, and `open` writes state.json just before
// it appends the launch, so the frame that change pushes has usually read the
// launch already.
let ledgerChecked = { stamp: null, launches: 0 };
function checkLedger() {
  ledgerEntries();
  if (ledgerSeen.stamp === ledgerChecked.stamp) return;
  const newLaunch = ledgerSeen.launches > ledgerChecked.launches;
  ledgerChecked = { stamp: ledgerSeen.stamp, launches: ledgerSeen.launches };
  if (newLaunch) checkFolders(workspaceNow());
  pushState();
}
setInterval(() => {
  checkState();
  checkCursor();
  try {
    checkLedger();
  } catch {}
}, 1000).unref();

/* ------------------------------------------------------------ heartbeat */

setInterval(() => {
  for (const res of clients) {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clients.delete(res);
    }
  }
  browsers = clients.size;
}, 15000).unref();

/* ------------------------------------------------------- idle deadline */

// This is the mechanism, not a nicety.
//
// Windows has no real SIGTERM, Node only synthesises SIGINT for Ctrl+C on an
// attached console, and this process is detached with no console at all.
// taskkill /F and Task Manager give zero cleanup opportunity. A Job Object with
// KILL_ON_JOB_CLOSE would be the proper fix and needs native code, which is out
// under zero-dependencies. So the only thing that reliably stops an orphan is
// the server deciding to stop. Do not "optimise" this away.
setInterval(() => {
  const idle = Date.now() - lastContact;
  // Answers nobody has collected yet keep the server up (bounded by MAX_LIFE_MS):
  // exiting would strand the tab and the send it holds.
  if (idle > IDLE_MS && !resultFlags().pending) {
    appendEvent(DIR, { type: "exit", reason: "idle", idleMs: idle });
    process.exit(0);
  }
  if (Date.now() - STARTED > MAX_LIFE_MS) {
    appendEvent(DIR, { type: "exit", reason: "max-life" });
    process.exit(0);
  }
}, 20000).unref();

for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  try {
    process.on(sig, () => process.exit(0));
  } catch {}
}

// Every exit that gets to run code takes its handle file with it, so a pid
// left behind in the runtime dir cannot later be mistaken for this server once
// the number is reused. Only while the file still names THIS process: a
// resume may already have started a replacement that wrote its own handle.
// A hard kill skips this, and reapHandles() plus stop's /health check cover it.
process.on("exit", () => {
  try {
    const file = handleFile(PROJECT, SID);
    if (readJson(file)?.pid === process.pid) fs.rmSync(file, { force: true });
  } catch {}
});

/* --------------------------------------------------------------- listen */

server.on("error", (err) => {
  process.stderr.write(`server: ${err.message}\n`);
  process.exit(1);
});

// Node's default keep-alive is 5s, which is exactly the page's ping interval.
// A client that reuses a socket the server just closed gets an ECONNRESET, so
// hold idle sockets open comfortably longer than any interval we run.
// headersTimeout must stay above keepAliveTimeout or Node closes them anyway.
server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;
// No response timeout: the SSE stream is meant to stay open indefinitely.
server.timeout = 0;

// Ephemeral port from the OS (RFC 8252 section 7.3, and Jupyter's pattern).
// A fixed port would be silently wrong the moment two worktrees of one repo
// run a session at the same time.
//
// Usually the port is already chosen by the time this runs. `open` binds the
// socket itself and hands it over the IPC channel (--handoff), so it can send
// the browser on its way before this process has even booted: the browser
// takes most of a second to show up, and its request simply waits in the
// socket's queue until this server takes the socket. A connection that
// reached `open` before the handover arrives here as a socket of its own.
// With no channel, or no socket within a few seconds, it picks its own port,
// and `open` sees the different port in the handle and says so.
let listening = false;

function onListening(port) {
  if (listening) return;
  listening = true;
  PORT = port;
  const url = TOKEN ? `http://127.0.0.1:${port}/s/${TOKEN}/` : `http://127.0.0.1:${port}/`;
  const handle = {
    v: 1,
    sid: SID,
    pid: process.pid,
    port,
    token: TOKEN,
    url,
    project: PROJECT,
    stateDir: DIR,
    startedAt: nowIso(),
  };
  ensureDir(path.dirname(handleFile(PROJECT, SID)));
  writeJsonAtomic(handleFile(PROJECT, SID), handle);
  appendEvent(DIR, { type: "listening", port, pid: process.pid });
  checkState();
  // A resume through a fresh server still starts a new conversation on a hop.
  try {
    ensureConversation(readState());
  } catch {}
  try {
    bootWorkspace();
  } catch {}
  process.stdout.write(JSON.stringify({ type: "ready", url, port, sid: SID }) + "\n");
  try {
    process.send?.({ type: "listening", port });
  } catch {}
  // Warm the asset cache while the browser is still on its way.
  setImmediate(() => {
    for (const rel of SERVABLE) {
      try {
        asset(rel);
      } catch {}
    }
  });
}

function listenOwn() {
  if (listening) return;
  server.listen(0, "127.0.0.1", () => onListening(server.address().port));
}

if (args.handoff && typeof process.send === "function") {
  const fallback = setTimeout(listenOwn, 3000);
  process.on("message", (msg, handle) => {
    if (msg && msg.type === "own") {
      clearTimeout(fallback);
      return listenOwn();
    }
    if (!msg || !handle) return;
    if (msg.type === "listen" && !listening) {
      clearTimeout(fallback);
      server.listen(handle, () => onListening(Number(msg.port) || handle.address().port));
    } else if (msg.type === "conn") {
      server.emit("connection", handle);
      handle.resume();
      // `open` waits for this before it lets go of the channel.
      try {
        process.send({ type: "conn-held" });
      } catch {}
    }
  });
  // `open` lets go of the channel once the handover is done. That is the end
  // of the conversation, not of this server.
  process.on("disconnect", () => {});
  process.channel?.unref?.();
} else {
  listenOwn();
}
