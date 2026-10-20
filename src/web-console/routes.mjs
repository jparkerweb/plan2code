// Plan2Code Web Console - every URL the page can call, in one list.
//
// server.mjs hands each request to handle() below, which walks ROUTES in
// order: the first entry that matches answers. The order is today's and it
// matters, since several routes match by prefix and the token gate sits
// between the two open routes and the rest. Each handler reads what it needs
// from the server through `ctx` (built in server.mjs), never from module
// scope, and calls into the by-job files for the work.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  LOOKS_FILE,
  PUBLIC_DIR,
  SHIPPED_MODELS_FILE,
  USER_MODELS_FILE,
  appendEvent,
  ensureDir,
  fileStamp,
  nowIso,
  readJson,
  withStateLock,
  writeJsonAtomic,
} from "./files.mjs";
import { checkDocument, cleanupFindings, readOverview, removeCleanup } from "./sessions.mjs";
import { SHOTS_DIR_NAME, SHOT_NAME, shotType } from "./patches.mjs";
import { appendChat, currentConversation, pendingChatCount, typedCount } from "./inbox.mjs";
import { specKey } from "./workspace.mjs";
import {
  PR_HOST_KINDS,
  readSubagentSetting,
  sameSetting,
  saveSubagentStoreEntry,
  savePrHost,
  writeSubagentSetting,
} from "./settings.mjs";
import { DOC_TYPES, MAX_ATTACHMENTS, MAX_DOC_BYTES, docExt, workflowLabel, workflowTitle } from "./public/answers.js";
import { CHAT_LIMIT, CHAT_MAX_CHARS } from "./public/chat.js";
import { cleanSetting, offered } from "./public/subagents.js";
import { ACCENTS, DEFAULT_ACCENT, DEFAULT_CARD_WIDTH, cardWidth } from "./public/palette.js";
import { SERVABLE, TYPES, asset } from "./static.mjs";
import { handoffsDir, isHandoffId } from "./handoffs.mjs";
import {
  NotepadError,
  addImage,
  addThumb,
  createTab,
  defaultTabId,
  deleteTab,
  imagePath,
  readNotepad,
  removeImage,
  renameTab,
  reorderTabs,
  saveNote,
  setLastTab,
} from "./notepads.mjs";

/* ---------------------------------------------------------------- routes */

// Every URL, in the order it is tried. `path` matches exactly and `match`
// any other way; `method` narrows either; `open` routes answer before the
// token gate; `origin` routes refuse a foreign Origin before anything else.
const WORKSPACE_EDITS = { "/workspace/add": "addFolder", "/workspace/edit": "editFolder", "/workspace/remove": "removeFolder" };

const ROUTES = [
  { path: "/health", open: true, run: health },
  { match: (p) => p.startsWith("/s/"), open: true, run: signIn },
  { path: "/", method: "GET", run: page },
  { match: (p, req) => req.method === "GET" && SERVABLE.has(p.slice(1)), run: publicFile },
  { path: "/overview", method: "GET", run: overview },
  { path: "/handoff", method: "GET", run: handoffDoc },
  { path: "/version", method: "GET", run: version },
  { path: "/state", method: "GET", run: stateGet },
  { path: "/events", method: "GET", run: events },
  { path: "/draft", method: "POST", origin: true, run: draft },
  { path: "/looks", method: "GET", run: looksGet },
  { path: "/looks", method: "POST", origin: true, run: looksPost },
  { path: "/subagents", method: "POST", origin: true, run: subagentsPost },
  { path: "/pr-host", method: "POST", origin: true, run: prHost },
  { path: "/models", method: "GET", run: modelsGet },
  { path: "/models", method: "POST", origin: true, run: modelsPost },
  { path: "/cleanup", method: "POST", origin: true, run: cleanup },
  { path: "/upload", method: "POST", origin: true, run: upload },
  { path: "/notepad", method: "GET", run: notepadGet },
  { path: "/notepad/text", method: "POST", origin: true, run: notepadText },
  { path: "/notepad/image", method: "POST", origin: true, run: notepadImage },
  { path: "/notepad/thumb", method: "POST", origin: true, run: notepadThumb },
  { path: "/notepad/image/delete", method: "POST", origin: true, run: notepadDelete },
  { path: "/notepad/tab", method: "POST", origin: true, run: notepadTabNew },
  { path: "/notepad/tab/rename", method: "POST", origin: true, run: notepadTabRename },
  { path: "/notepad/tab/delete", method: "POST", origin: true, run: notepadTabDelete },
  { path: "/notepad/tab/order", method: "POST", origin: true, run: notepadTabOrder },
  { path: "/notepad/tab/last", method: "POST", origin: true, run: notepadTabLast },
  { match: (p, req) => p.startsWith("/notepad/images/") || req.url.startsWith("/notepad/images/"), method: "GET", run: notepadImageGet },
  { match: (p, req) => p.startsWith("/attachments/") || req.url.startsWith("/attachments/"), run: attachment },
  { match: (p, req) => p.startsWith("/shots/") || req.url.startsWith("/shots/"), run: shot },
  { match: (p, req) => p.startsWith("/uploads/") || req.url.startsWith("/uploads/"), run: uploads },
  { path: "/submit", method: "POST", origin: true, run: submit },
  { path: "/chat", method: "POST", origin: true, run: chat },
  { path: "/chat/decision", method: "POST", origin: true, run: chatDecision },
  { path: "/workspace", method: "GET", run: workspaceGet },
  { match: (p) => Object.hasOwn(WORKSPACE_EDITS, p), method: "POST", origin: true, run: workspaceEdit },
  { path: "/workspace/scope", method: "POST", origin: true, run: workspaceScope },
  { path: "/workspace/browse", method: "POST", origin: true, run: workspaceBrowse },
  { path: "/cancel", method: "POST", origin: true, run: cancel },
  { path: "/ping", method: "POST", run: ping },
  { path: "/bye", origin: true, run: bye },
];

export function handle(req, res, ctx) {
  const port = ctx.port();
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const pathname = url.pathname;

  if (!hostOk(req, port)) return send(res, 403, "", "text/plain");

  let gated = false;
  for (const route of ROUTES) {
    if (!route.open && !gated) {
      if (!authed(req, ctx)) return send(res, 403, "Open the link the terminal printed.", "text/plain");
      ctx.touch();
      gated = true;
    }
    if (route.path !== undefined ? pathname !== route.path : !route.match(pathname, req)) continue;
    if (route.method && req.method !== route.method) continue;
    if (route.origin && !originOk(req, port)) return json(res, 403, { error: "bad origin" });
    return route.run(req, res, ctx, url);
  }
  return json(res, 404, { error: "not found" });
}

/* ------------------------------------------------------- the open routes */

// /health is the liveness probe the CLI uses to distinguish "our server"
// from a process that merely inherited the PID. Deliberately unauthenticated
// and deliberately tells you nothing but the session id.
function health(req, res, ctx) {
  ctx.touch();
  ctx.sawAgent();
  return json(res, 200, { ok: true, sid: ctx.sid, browsers: ctx.browsers, rev: ctx.rev, phase: ctx.readState()?.phase || "unknown" });
}

// Token in the PATH, not the query string. Two reasons: a query string would
// put an `&` in the URL, and `cmd /c start <url>` on Windows parses `&` as a
// command separator; and the 302 below gets the secret out of the address bar,
// out of history, and out of any screenshot the user pastes into a ticket.
function signIn(req, res, ctx, url) {
  const given = url.pathname.slice(3).replace(/\/$/, "");
  if (!ctx.token || !timingSafeEq(given, ctx.token)) return send(res, 403, "Not found", "text/plain");
  ctx.touch();
  res.writeHead(
    302,
    baseHeaders({
      location: "/",
      "set-cookie": `${cookieName(ctx)}=${ctx.token}; HttpOnly; SameSite=Strict; Path=/`,
    })
  );
  return res.end();
}

/* -------------------------------------------------------- the page itself */

function page(req, res, ctx) {
  let html;
  try {
    html = renderIndex(ctx);
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

function publicFile(req, res, ctx, url) {
  const rel = url.pathname.slice(1);
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
function renderIndex(ctx) {
  if (indexTemplate === null) indexTemplate = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"), "utf8");
  const state = ctx.readState();
  const looks = savedLooks();
  const boot = {
    ...ctx.stateFrame(state),
    draft: readJson(ctx.files.draft, {}),
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
      () => `<title>${escHtml(title)} · #${escHtml(String(ctx.sid).slice(-6))} · Plan2Code</title>`
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

/* ------------------------------------------------------ read-only routes */

// The spec's overview.md, read-only. A dashboard honours ?spec= only for a
// spec its own scan found; every other workflow reads its own specDir.
// readOverview() keeps the read inside the project root.
function overview(req, res, ctx, url) {
  const state = ctx.readState() || {};
  const asked = url.searchParams.get("spec");
  const spec =
    state.workflow === "dashboard"
      ? (state.scan?.specs || []).some((s) => s && s.dir === asked)
        ? asked
        : ""
      : state.specDir;
  // Most specs have no overview.md yet, which is normal, not an error: 204
  // keeps the browser console free of a failed request per pick.
  const noOverview = () => {
    res.writeHead(204, baseHeaders({ "cache-control": "no-store" }));
    res.end();
  };
  readOverview(state.worktree || state.project, spec)
    .then((text) =>
      typeof text === "string"
        ? send(res, 200, text, "text/markdown; charset=utf-8", { "cache-control": "no-store" })
        : noOverview()
    )
    .catch(noOverview);
}

// A handoff's document, read-only, for the dashboard's "Read it all". Only a
// dashboard serves it, and only an id its own scan listed: a used or unknown
// id, or anything that is not a bare handoff id, is a 404.
function handoffDoc(req, res, ctx, url) {
  const state = ctx.readState() || {};
  const id = url.searchParams.get("id");
  const listed = state.workflow === "dashboard" && isHandoffId(id) && (state.scan?.handoffs || []).some((h) => h && h.id === id);
  if (!listed) return send(res, 404, "", "text/plain");
  fs.readFile(path.join(handoffsDir(), id + ".md"), "utf8", (err, text) => {
    if (err) return send(res, 404, "", "text/plain");
    send(res, 200, text, "text/markdown; charset=utf-8", { "cache-control": "no-store" });
  });
}

function version(req, res, ctx) {
  const installed = ctx.installedVersion();
  if (installed) return json(res, 200, { version: installed, latest: ctx.updateLatest() });
  return json(res, 404, { error: "no version" });
}

function stateGet(req, res, ctx) {
  const state = ctx.readState();
  if (!state) return json(res, 404, { error: "no state" });
  return json(res, 200, { ...ctx.stateFrame(state), draft: readJson(ctx.files.draft, {}) });
}

function events(req, res, ctx, url) {
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
  ctx.clients.add(res);
  ctx.browsers = ctx.clients.size;
  res.write(`retry: 2000\n\n`);
  const state = ctx.readState();
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
  if (state && url.searchParams.get("have") !== ctx.haveKey()) {
    res.write(`event: state\ndata: ${JSON.stringify(ctx.stateFrame(state))}\n\n`);
  }
  req.on("close", () => {
    ctx.clients.delete(res);
    ctx.browsers = ctx.clients.size;
  });
}

/* ---------------------------------------------------- settings and drafts */

function draft(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
    // Debounced client-side; this is just the durable mirror. Twenty minutes
    // of someone's structured answers must not die with a closed tab.
    try {
      writeJsonAtomic(ctx.files.draft, { at: nowIso(), rev: ctx.rev, ...body });
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    return json(res, 200, { ok: true });
  });
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

// The person's colors and theme, kept by the server rather than the browser:
// localStorage is tied to the origin and the origin carries the ephemeral
// port, so a new session on a new port starts on defaults. This file is the
// copy that follows the app instead of the port.
function looksGet(req, res) {
  const saved = readJson(LOOKS_FILE, null);
  if (!saved || !saved.looks) return json(res, 404, { error: "no looks saved" });
  return json(res, 200, saved);
}

function looksPost(req, res) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
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

// The Subagents switch for the session's workflow. Saved per project folder
// for the next session, and applied to this one with a bumped revision, which
// is what console.mjs hands the agent at its next pickup. Never blocked by,
// and never blocking, a card send.
function subagentsPost(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
    const state = ctx.readState();
    if (!state || !offered(state.workflow)) return json(res, 400, { error: "not-offered" });
    const clean = cleanSetting(body);
    if (clean.error) return json(res, 400, { error: clean.error });
    const { on, instruction, max } = clean;
    const current = readSubagentSetting(ctx.dir);
    const next = { workflow: state.workflow, on, instruction, max };
    // The store is per project, so another session may have moved it since
    // this one synced: it always takes the person's latest pick. Only a
    // real change to this session's setting bumps what the agent hears.
    const unchanged = Boolean(current && sameSetting(current, next));
    try {
      saveSubagentStoreEntry(ctx.worktree(), state.workflow, { on, instruction, max });
      if (!unchanged) writeSubagentSetting(ctx.dir, { ...next, revision: (current ? current.revision : 0) + 1 });
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    if (unchanged) return json(res, 200, { ok: true, setting: current });
    const setting = readSubagentSetting(ctx.dir);
    appendEvent(ctx.dir, { type: "subagents", on, revision: setting.revision });
    ctx.pushState();
    return json(res, 200, { ok: true, setting });
  });
}

// What an unknown git host is, for the git board's pull-request link. Saved
// to pr-hosts.json for every project; nothing is written under the project.
// The page follows it with a __git pr-host action, and the agent's reread
// rebuilds the link.
function prHost(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
    const { host: raw, kind } = body && typeof body === "object" ? body : {};
    if (typeof raw !== "string" || !raw || raw.length > 253 || !/^[a-z0-9.-]+$/i.test(raw)) {
      return json(res, 400, { error: "bad-host" });
    }
    // Hosts are looked up lowercased (git-repo.mjs parseRemoteUrl).
    const host = raw.toLowerCase();
    if (!PR_HOST_KINDS.has(kind)) return json(res, 400, { error: "bad-kind" });
    const state = ctx.readState();
    if (!state || state.workflow !== "git") return json(res, 400, { error: "not-git" });
    try {
      savePrHost(host, kind);
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    appendEvent(ctx.dir, { type: "pr-host", host, kind });
    return json(res, 200, { ok: true });
  });
}

// The CLIs the launcher reads a model list for (src/launcher/plan2code.js listModels).
const MODEL_CLIS = ["claude", "devin", "codex"];
const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/;
// Devin's XHigh and Max efforts are never offered, curated or added.
const MODEL_EFFORT_BLOCKED = /-(xhigh|max)$/i;

/**
 * The user's added models: { claude: [{id,label}], devin: [...], codex: [...] }. Returns { models } or
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

// The launcher's model menu: what ships (read-only here) and what the user added.
function modelsGet(req, res) {
  const saved = readJson(USER_MODELS_FILE, null) || {};
  const { models } = cleanModels(saved);
  return json(res, 200, { shipped: shippedModels(), user: models || Object.fromEntries(MODEL_CLIS.map((cli) => [cli, []])) });
}

function modelsPost(req, res) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
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

// User Preferences -> Cleanup. `{ scan: true }` lists what is not needed in
// ~/.plan2code and the project's old completed specs; `{ delete: [id] }`
// removes those of the ids a fresh scan still finds. Never this session,
// never a path the page sent.
function cleanup(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
    if (body && Array.isArray(body.delete)) {
      return removeCleanup(body.delete, { skipSid: ctx.sid, project: ctx.worktree() || ctx.project })
        .then((done) => json(res, 200, { ok: true, ...done }))
        .catch((e) => json(res, 500, { error: String(e.message) }));
    }
    return cleanupFindings({ skipSid: ctx.sid, project: ctx.worktree() || ctx.project })
      .then(({ items, bytes }) => json(res, 200, { ok: true, bytes, items: items.map(({ path: _p, ...item }) => item) }))
      .catch((e) => json(res, 500, { error: String(e.message) }));
  });
}

/* ---------------------------------------------------------------- notepad */

// The person's private notepad for the folder this session runs in, kept by
// notepads.mjs outside the session. Nothing here writes to ctx.dir or the
// event log: the agent reads both, and the notepad is never the agent's.
const notepadRoot = (ctx) => ctx.worktree() || ctx.project;

function notepadFail(res, e) {
  if (e instanceof NotepadError) return json(res, e.status, { error: e.code });
  return json(res, 500, { error: "bad" });
}

function notepadGet(req, res, ctx, url) {
  try {
    return json(res, 200, readNotepad(notepadRoot(ctx), url.searchParams.get("tab")));
  } catch (e) {
    return notepadFail(res, e);
  }
}

// The tab a text or picture request means: the `tab` query value when there
// is one (the store refuses an unknown or malformed id), else the last tab
// used, else the first. With no tab at all, `create` makes the first one,
// Notes, so a page that never sends `tab` keeps working; the rest refuse.
function notepadTab(ctx, url, create) {
  const given = url.searchParams.get("tab");
  if (given !== null) return given;
  const root = notepadRoot(ctx);
  return defaultTabId(root) ?? (create ? createTab(root, "Notes").id : null);
}

function notepadText(req, res, ctx, url) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too-long" : "bad" });
    try {
      return json(res, 200, { ok: true, ...saveNote(notepadRoot(ctx), notepadTab(ctx, url, true), body && body.text) });
    } catch (e) {
      return notepadFail(res, e);
    }
  });
}

// A picture's bytes, raw: JPEG only (the page re-encodes everything first).
function readJpeg(req, res, then) {
  if (!String(req.headers["content-type"] || "").startsWith("image/jpeg")) {
    req.resume();
    return json(res, 415, { error: "not-jpeg" });
  }
  return readRaw(req, MAX_BODY, (err, buf) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too-large" : "bad" });
    return then(buf);
  });
}

function notepadImage(req, res, ctx, url) {
  return readJpeg(req, res, (buf) => {
    try {
      return json(res, 200, { ok: true, ...addImage(notepadRoot(ctx), notepadTab(ctx, url, true), buf) });
    } catch (e) {
      return notepadFail(res, e);
    }
  });
}

function notepadThumb(req, res, ctx, url) {
  return readJpeg(req, res, (buf) => {
    try {
      addThumb(notepadRoot(ctx), notepadTab(ctx, url, false), url.searchParams.get("id"), buf);
      return json(res, 200, { ok: true });
    } catch (e) {
      return notepadFail(res, e);
    }
  });
}

function notepadDelete(req, res, ctx, url) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: "bad" });
    try {
      removeImage(notepadRoot(ctx), notepadTab(ctx, url, false), body && body.id);
      return json(res, 200, { ok: true });
    } catch (e) {
      return notepadFail(res, e);
    }
  });
}

// The tab routes: each reads a small JSON body, calls the store and answers
// `{ ok, ... }`. Like the rest of the notepad they write nothing under
// ctx.dir and add nothing to the event log.
function notepadTabRoute(act) {
  return (req, res, ctx) =>
    readBody(req, (err, body) => {
      if (err) return json(res, err.tooBig ? 413 : 400, { error: "bad" });
      try {
        return json(res, 200, { ok: true, ...act(notepadRoot(ctx), body && typeof body === "object" ? body : {}) });
      } catch (e) {
        return notepadFail(res, e);
      }
    });
}

// Declarations, not consts: ROUTES above names them before this line runs.
function notepadTabNew(req, res, ctx) {
  return notepadTabRoute((root, body) => createTab(root, body.name))(req, res, ctx);
}
function notepadTabRename(req, res, ctx) {
  return notepadTabRoute((root, body) => renameTab(root, body.id, body.name))(req, res, ctx);
}
function notepadTabDelete(req, res, ctx) {
  return notepadTabRoute((root, body) => deleteTab(root, body.id))(req, res, ctx);
}
function notepadTabOrder(req, res, ctx) {
  return notepadTabRoute((root, body) => reorderTabs(root, body.order))(req, res, ctx);
}
function notepadTabLast(req, res, ctx) {
  return notepadTabRoute((root, body) => setLastTab(root, body.id))(req, res, ctx);
}

// Matched on the raw request line too, as /uploads/ is: URL parsing folds
// `..` away, and nothing that needed folding is a notepad picture.
const NOTEPAD_IMAGE_ROUTE = /^\/notepad\/images\/([0-9a-f]{12})\/([0-9a-f-]{36})(\.thumb)?\.jpg$/;

function notepadImageGet(req, res, ctx, url) {
  const m = NOTEPAD_IMAGE_ROUTE.exec(req.url);
  const file = m && m[0] === url.pathname ? imagePath(notepadRoot(ctx), m[1], m[2], Boolean(m[3])) : null;
  if (!file) return json(res, 404, { error: "not-found" });
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return json(res, 404, { error: "not-found" });
  }
  return send(res, 200, buf, "image/jpeg");
}

/* ------------------------------------------- uploads, shots, attachments */

// Images and documents attached to notes and quick questions. Only ever named
// by the server (a UUID, plus `jpg` or an extension from DOC_TYPES), and only
// ever resolved inside the session's uploads/: the client's file name is a
// label. Images are served back as JPEG. A document is served under a fixed
// type (PDF, or text/plain for everything else, sandboxed and never sniffed),
// so the page can link it without ever letting a browser run it.
const uploadsDir = (ctx) => path.join(ctx.dir, "uploads");
const UPLOAD_EXTS = ["jpg", ...Object.keys(DOC_TYPES)];
const EXT_ALT = UPLOAD_EXTS.join("|");
const UPLOAD_ANY_ROUTE = new RegExp(`^/uploads/([0-9a-f-]{36})\\.(${EXT_ALT})$`);
const UPLOAD_NAME = new RegExp(`^[0-9a-f-]{36}\\.(${EXT_ALT})$`);

// Screenshots the agent saved for a doc's image block (Show me it working),
// only ever directly inside <session>/shots/ under SHOT_NAME's plain shape.
const SHOT_TYPES = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

function shotPath(ctx, name) {
  const shotsDir = path.join(ctx.dir, SHOTS_DIR_NAME);
  if (!SHOT_NAME.test(name)) return null;
  const file = path.resolve(shotsDir, name);
  if (!file.startsWith(path.resolve(shotsDir) + path.sep)) return null;
  try {
    const real = fs.realpathSync.native(file);
    const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
    if (fold(path.dirname(real)) !== fold(fs.realpathSync.native(shotsDir))) return null;
    return fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

// A kept attachment's name, as attachmentName() in sessions.mjs writes it:
// <slug>-<first 8 of the upload id>.<the upload's extension>.
const KEPT_ROUTE = new RegExp(`^/attachments/([a-z0-9-]{1,40}-[0-9a-f-]{8}\\.(${EXT_ALT}))$`);

function keptPath(ctx, name) {
  const state = ctx.readState() || {};
  if (typeof state.specDir !== "string" || !state.specDir.trim()) return null;
  const root = path.resolve(state.worktree || process.cwd());
  const dir = path.resolve(root, state.specDir, "attachments");
  const file = path.join(dir, name);
  try {
    const real = fs.realpathSync.native(file);
    const realDir = fs.realpathSync.native(dir);
    const realRoot = fs.realpathSync.native(root);
    const inside = (p, base) => {
      const rel = path.relative(base.toLowerCase(), p.toLowerCase());
      return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
    };
    if (path.dirname(real).toLowerCase() !== realDir.toLowerCase() || !inside(real, realRoot)) return null;
    return fs.statSync(real).isFile() ? real : null;
  } catch {
    return null;
  }
}

function uploadPath(ctx, id, ext = "jpg") {
  if (!UPLOAD_EXTS.includes(ext)) return null;
  const result = path.join(uploadsDir(ctx), id + "." + ext);
  return path.resolve(result).startsWith(path.resolve(uploadsDir(ctx)) + path.sep) ? result : null;
}

// "image" for one of this session's JPEGs, "file" for one of its documents,
// false for anything else.
function isOwnUpload(ctx, p) {
  if (typeof p !== "string") return false;
  const fold = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
  const abs = path.resolve(p);
  const base = fold(path.basename(abs));
  if (fold(path.dirname(abs)) !== fold(path.resolve(uploadsDir(ctx))) || !UPLOAD_NAME.test(base)) return false;
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
function attachmentsOk(ctx, images, files) {
  const listOk = (list, kind) =>
    list === undefined ||
    (Array.isArray(list) &&
      list.every(
        (a) =>
          a &&
          typeof a === "object" &&
          isOwnUpload(ctx, a.path) === kind &&
          fs.existsSync(a.path) &&
          (a.name === undefined || typeof a.name === "string")
      ));
  const count = (Array.isArray(images) ? images.length : 0) + (Array.isArray(files) ? files.length : 0);
  return { images: listOk(images, "image"), files: listOk(files, "file"), count: count <= MAX_ATTACHMENTS };
}

function upload(req, res, ctx) {
  const contentType = String(req.headers["content-type"] || "");
  const store = (buf, ext) => {
    const id = crypto.randomUUID();
    const file = uploadPath(ctx, id, ext);
    try {
      ensureDir(uploadsDir(ctx));
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
      appendEvent(ctx.dir, { type: "upload", id, kind: "image", bytes: buf.length });
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
      appendEvent(ctx.dir, { type: "upload", id, kind: "file", bytes: buf.length });
      return json(res, 200, { ok: true, id, kind: "file", path: file, name, size: buf.length });
    });
  }

  return readRaw(req, 0, () => json(res, 415, { error: "type" }));
}

// A note attachment the agent kept into the spec (`console.mjs keep`), so a
// doc citing `attachments/<name>` shows the image or opens the file. Read
// only, and only one exact name shape (the one `keep` writes) directly
// inside <worktree>/<specDir>/attachments/: nothing else in the project.
function attachment(req, res, ctx, url) {
  const pathname = url.pathname;
  if (req.method !== "GET") return json(res, 405, { error: "method" });
  const m = KEPT_ROUTE.exec(req.url);
  const file = m && m[0] === pathname ? keptPath(ctx, m[1]) : null;
  if (!file) return json(res, 404, { error: "not found" });
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return json(res, 404, { error: "not found" });
  }
  const ext = m[2].toLowerCase();
  if (ext === "jpg") return send(res, 200, buf, "image/jpeg", { "cache-control": "private, max-age=3600" });
  const pdf = DOC_TYPES[ext].kind === "pdf";
  return send(res, 200, buf, pdf ? "application/pdf" : "text/plain; charset=utf-8", {
    ...(pdf ? {} : { "content-security-policy": "sandbox" }),
    "cache-control": "private, max-age=3600",
  });
}

// A screenshot for a doc's image block. Matched on the raw request line too,
// like uploads: anything URL parsing had to fold (`..`) is not a shot.
function shot(req, res, ctx, url) {
  const pathname = url.pathname;
  if (req.method !== "GET") return json(res, 405, { error: "method" });
  const name = pathname.slice("/shots/".length);
  const file = req.url === pathname ? shotPath(ctx, name) : null;
  if (!file) return json(res, 404, { error: "not found" });
  let buf;
  try {
    buf = fs.readFileSync(file);
  } catch {
    return json(res, 404, { error: "not found" });
  }
  // The bytes, not the name, pick the type: the file may have changed since it was posted.
  const type = SHOT_TYPES[shotType(buf)];
  if (!type) return json(res, 404, { error: "not found" });
  return send(res, 200, buf, type, { "cache-control": "no-store" });
}

// Matched on the raw request line as well as the parsed path: URL parsing
// folds `..` segments away, and nothing that needed folding is an upload.
// GET and DELETE take images and documents alike.
function uploads(req, res, ctx, url) {
  const pathname = url.pathname;
  if (req.method === "GET") {
    const m = UPLOAD_ANY_ROUTE.exec(req.url);
    const file = m && m[0] === pathname ? uploadPath(ctx, m[1], m[2]) : null;
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
    if (!originOk(req, ctx.port())) return json(res, 403, { error: "bad origin" });
    const m = UPLOAD_ANY_ROUTE.exec(req.url);
    const file = m && m[0] === pathname ? uploadPath(ctx, m[1], m[2]) : null;
    if (!file || !fs.existsSync(file)) return json(res, 404, { error: "not found" });
    try {
      fs.rmSync(file);
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    appendEvent(ctx.dir, { type: "upload-delete", id: m[1] });
    res.writeHead(204, baseHeaders());
    return res.end();
  }
  return json(res, 404, { error: "not found" });
}

/* ------------------------------------------------------------- the send */

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
      // The person's side of the Notes thread. Left to the agent it was never
      // written, so a question asked in a note vanished once it was picked up
      // and the reply under it answered nothing on the page.
      if (item.sentNote.text.trim() || item.sentNote.images.length || item.sentNote.files.length) {
        item.thread = [...(Array.isArray(item.thread) ? item.thread : []), { who: "user", ...item.sentNote }];
      }
      continue;
    }
    const { i, type, ...rest } = action;
    // JSON.parse makes "__proto__" an own property, and it would then be
    // written back into state.json and re-read forever.
    if (Object.prototype.hasOwnProperty.call(rest, "__proto__")) delete rest["__proto__"];
    // A skip says so on the record, so settling it can record a skip.
    item.submitted = { at, ...rest, ...(type === "skip" ? { skipped: true } : {}) };
  }
}

function submit(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err) return json(res, err.tooBig ? 413 : 400, { error: err.tooBig ? "too large" : "body must be JSON" });
    if (!body || !Array.isArray(body.actions) || body.actions.length === 0) {
      return json(res, 400, { error: "actions must be a non-empty array" });
    }
    const badAttachments = body.actions.some((a) => {
      if (!a || typeof a !== "object" || a.type !== "comment") return false;
      const ok = attachmentsOk(ctx, a.images, a.files);
      return !(ok.images && ok.files && ok.count);
    });
    if (badAttachments) {
      return json(res, 400, { error: "a comment carries at most 5 attachments, each uploaded to this session" });
    }
    const result = {
      type: "submit",
      at: nowIso(),
      sid: ctx.sid,
      rev: ctx.rev,
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
      written = withStateLock(ctx.dir, () => {
        // One send is one agent turn. Writing over a result the agent has not
        // collected yet destroys everything in it, and the loss is silent: two
        // tabs, or one impatient second press, and an approval disappears.
        if (ctx.resultFlags().pending) {
          refused = "pending";
          return null;
        }
        try {
          // Atomic: the waiter polls this file and will land mid-write eventually.
          writeJsonAtomic(ctx.files.result, result);
        } catch (e) {
          refused = String(e.message);
          return null;
        }
        try {
          // Read fresh from disk, never from the cache: an agent write the
          // watcher has not reached yet is in the file and must be kept.
          const text = fs.readFileSync(ctx.files.state, "utf8");
          const state = JSON.parse(text);
          agentWrote = text !== ctx.stateText();
          state.phase = "submitted";
          recordSubmitted(state, body.actions);
          return { state, text: writeJsonAtomic(ctx.files.state, state) };
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
    appendEvent(ctx.dir, { type: "submit", rev: ctx.rev, count: body.actions.length });
    if (written) {
      // Account for our own write here rather than letting the watcher find
      // it: the watcher reads a changed state.json as proof the AGENT is
      // alive, and this write is not that. An agent write it swept up on the
      // way is, and is handled as the watcher would have handled it.
      ctx.adoptStateText(written.text, written.state);
      ctx.rev++;
      if (agentWrote) {
        ctx.sawAgent();
        try {
          ctx.ensureConversation(written.state);
        } catch {}
        try {
          ctx.subagents.sync(written.state);
        } catch {}
      }
    }
    // Name the items that went. A page with OTHER answers staged should drop
    // only what was sent, and a brief request is a submit carrying no answers
    // at all, so a blanket "everything is gone" is wrong for both.
    ctx.broadcast("submitted", {
      rev: ctx.rev,
      ids: body.actions.map((a) => a && a.i).filter(Boolean),
    });
    ctx.pushState();
    return json(res, 200, { ok: true });
  });
}

/* ------------------------------------------------------------- the chat */

// A Quick question, or New conversation ({ reset: true }). Its own channel:
// this route never looks at result.json, so a card send waiting to be
// collected never holds up a question, and a question never holds up a card.
function chat(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err && err.tooBig) return json(res, 413, { error: "too large" });
    if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
    const state = ctx.readState() || {};
    const current = currentConversation(ctx.chatEntries()).conversation;

    if (body.reset === true) {
      if (ctx.chatOffline(state)) return json(res, 409, { error: "offline" });
      if (body.conversation !== current) return json(res, 409, { error: "stale", conversation: current });
      const entry = appendChat(ctx.dir, {
        kind: "reset",
        conversation: current + 1,
        workflow: state.workflow,
        reason: "button",
      });
      appendEvent(ctx.dir, { type: "chat-reset", reason: "button" });
      ctx.rev++;
      ctx.pushState();
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
    const ok = attachmentsOk(ctx, body.images, body.files);
    if (!ok.images) return json(res, 400, { error: "image" });
    if (!ok.files) return json(res, 400, { error: "file" });
    if (!ok.count) return json(res, 400, { error: body.files ? "file" : "image" });

    if (ctx.chatOffline(state)) return json(res, 409, { error: "offline" });
    if (body.conversation !== current) return json(res, 409, { error: "stale", conversation: current });
    if (typedCount(ctx.chatEntries(), current) >= CHAT_LIMIT) return json(res, 409, { error: "limit" });

    const entry = appendChat(ctx.dir, {
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
    appendEvent(ctx.dir, { type: "chat", seq: entry.seq });
    ctx.rev++;
    ctx.pushState();
    return json(res, 200, { ok: true, seq: entry.seq, conversation: current });
  });
}

// Approve or Decline on an edit the agent proposed in the chat. `re` is the
// proposing reply's id. Decisions never count toward the message limit.
function chatDecision(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err && err.tooBig) return json(res, 413, { error: "too large" });
    if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
    if (body.decision !== "approve" && body.decision !== "decline") return json(res, 400, { error: "bad" });
    if (body.text !== undefined && typeof body.text !== "string") return json(res, 400, { error: "bad" });
    const text = (body.text || "").trim();
    if (text.length > CHAT_MAX_CHARS) return json(res, 400, { error: "too-long" });

    const state = ctx.readState() || {};
    const entries = ctx.chatEntries();
    const current = currentConversation(entries).conversation;
    if (ctx.chatOffline(state)) return json(res, 409, { error: "offline" });
    if (body.conversation !== current) return json(res, 409, { error: "stale", conversation: current });

    const reply = (state.chat?.replies || []).find((r) => r && r.id === body.re);
    const decided = entries.some((e) => e.kind === "decision" && e.re === body.re);
    if (typeof body.re !== "string" || !reply || !reply.proposal || reply.conversation !== current || decided) {
      return json(res, 400, { error: "bad" });
    }

    const entry = appendChat(ctx.dir, {
      kind: "decision",
      conversation: current,
      re: body.re,
      decision: body.decision,
      text: text || undefined,
    });
    appendEvent(ctx.dir, { type: "chat-decision", decision: body.decision });
    ctx.rev++;
    ctx.pushState();
    return json(res, 200, { ok: true, seq: entry.seq });
  });
}

/* --------------------------------------------------------- the workspace */

// The Workspace: the original folder plus any the person adds as context.
// The page changes it only through these routes; the agent hears of each
// change once, through console.mjs.
function workspaceGet(req, res, ctx, url) {
  try {
    if (url.searchParams.get("check") === "1") ctx.workspace.checkFolders(ctx.workspace.workspaceNow());
  } catch (e) {
    return json(res, 500, { error: String(e.message) });
  }
  return json(res, 200, ctx.workspace.workspaceView());
}

function workspaceEdit(req, res, ctx, url) {
  return readBody(req, (err, body) => {
    if (err && err.tooBig) return json(res, 413, { error: "too large" });
    if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
    let answer;
    try {
      answer = ctx.workspace[WORKSPACE_EDITS[url.pathname]](ctx.workspace.workspaceNow(), body);
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    return json(res, answer[0], answer[1]);
  });
}

// Which list the workspace is: a spec's, or the project's (`spec` empty).
// The dashboard's picker sends it as the selection moves and before a
// launch, so a skill opens on the list of the spec it was launched for.
function workspaceScope(req, res, ctx) {
  return readBody(req, (err, body) => {
    if (err && err.tooBig) return json(res, 413, { error: "too large" });
    if (err || !body || typeof body !== "object" || Array.isArray(body)) return json(res, 400, { error: "bad" });
    const spec = typeof body.spec === "string" ? body.spec : "";
    if (spec && !/^specs\/[^/\\]+$/.test(specKey(spec))) return json(res, 400, { reason: "bad-spec" });
    try {
      ctx.workspace.setScope(ctx.workspace.workspaceNow(), spec, "project");
    } catch (e) {
      return json(res, 500, { error: String(e.message) });
    }
    return json(res, 200, ctx.workspace.workspaceView());
  });
}

// Only ever returns a path: the page then adds it through /workspace/add.
function workspaceBrowse(req, res, ctx) {
  return readBody(req, () => {
    ctx.workspace.browse().then(([code, body]) => json(res, code, body));
  });
}

/* ------------------------------------------------ the session's own pulse */

function cancel(req, res, ctx) {
  const result = { type: "cancel", at: nowIso(), sid: ctx.sid, rev: ctx.rev, actions: [], reply: "" };
  // Under the state lock like a send, so `open` clearing a collected result
  // can never take this one with it. As /submit: a cancel that never reached
  // disk must not tell the page it did, or the page stands down while the
  // agent waits on forever.
  let pending = false;
  try {
    withStateLock(ctx.dir, () => {
      pending = ctx.resultFlags().pending;
      if (!pending) writeJsonAtomic(ctx.files.result, result);
    });
  } catch (e) {
    return json(res, 500, { error: String(e.message) });
  }
  if (pending) return json(res, 409, { error: "pending", message: "A send is still on its way." });
  appendEvent(ctx.dir, { type: "cancel", rev: ctx.rev });
  ctx.broadcast("cancelled", { rev: ctx.rev });
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
function ping(req, res, ctx) {
  const { pending, stop } = ctx.resultFlags();
  return json(res, 200, {
    ok: true,
    rev: ctx.rev,
    agentLastSeen: ctx.agentLastSeen(),
    pendingResult: pending,
    pendingStop: stop,
    pendingChat: pendingChatCount(ctx.dir, ctx.readState()),
  });
}

// Treat a departure as "shorten the deadline", never as "exit now": the user
// may simply be reloading. It moves the shutdown deadline, so only the page
// itself may send it.
function bye(req, res, ctx) {
  ctx.closedTab();
  return json(res, 200, { ok: true });
}

/* ---------------------------------------------------------- the plumbing */

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
const cookieName = (ctx) => `p2c_console_${ctx.port()}`;

function cookieToken(req, ctx) {
  const raw = req.headers.cookie || "";
  const name = cookieName(ctx);
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function authed(req, ctx) {
  if (!ctx.token) return true;
  const c = cookieToken(req, ctx);
  return c ? timingSafeEq(c, ctx.token) : false;
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
    // Drain past the cap rather than destroy, exactly like readRaw: a
    // destroyed request emits 'close', never 'end' or 'error', so cb would
    // never run and the page would see a reset instead of the 413 that names
    // the problem.
    if (size > MAX_BODY) {
      tooBig = true;
      chunks.length = 0;
      return;
    }
    chunks.push(c);
  });
  req.on("end", () => {
    if (tooBig) return cb(Object.assign(new Error("too large"), { tooBig: true }));
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
