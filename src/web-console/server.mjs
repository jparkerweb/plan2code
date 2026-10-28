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
// This file is start-up and lifecycle: reading the handle and binding through
// the handover, the cached reads the page's frame is built from, SSE, the
// update check, state watching, the heartbeat, the idle deadline and listen.
// Every request goes to routes.mjs, which lists every URL; the page's own
// files are served by static.mjs, and the Workspace and Subagents helpers
// live in workspace.mjs and settings.mjs.
//
// Node built-ins only.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import {
  HERE,
  UPDATE_CHECK_FILE,
  appendEvent,
  ensureDir,
  fileStamp,
  nowIso,
  parseArgs,
  readJson,
  writeJsonAtomic,
} from "./files.mjs";
import { LEDGER_FILE, handleFile, readLedger } from "./sessions.mjs";
import {
  CHAT_CURSOR_FILE,
  CHAT_FILE,
  appendChat,
  chatForFrame,
  currentConversation,
  readChat,
  readCursor,
} from "./inbox.mjs";
import { serverWorkspace } from "./workspace.mjs";
import { serverSubagents } from "./settings.mjs";
import { inAppSignal } from "./in-app.mjs";
import { chatOffline } from "./public/chat.js";
import { meterView } from "./public/meter.js";
import { startsClean } from "./public/hops.js";
import { SERVABLE, asset } from "./static.mjs";
import { handle } from "./routes.mjs";
import { checkForUpdate } from "./update-check.mjs";

const args = parseArgs(process.argv.slice(2));
// Canonicalize before anything derives a path from it: a session dir reached
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

const STARTED = Date.now();
let lastContact = Date.now();
let browsers = 0;
let rev = 0;
let seq = 0;

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

// ledger.ndjson has one writer, console.mjs; re-read only when it has moved.
const LEDGER_PATH = path.join(DIR, LEDGER_FILE);

let ledgerSeen = { stamp: null, entries: [], launches: 0 };
function ledgerEntries() {
  const stamp = fileStamp(LEDGER_PATH);
  if (stamp !== ledgerSeen.stamp) {
    const entries = readLedger(DIR);
    ledgerSeen = { stamp, entries, launches: entries.filter((e) => e.kind === "launch").length };
  }
  return ledgerSeen.entries;
}

// The folder the session runs in: the state's own once it is written, else
// the one `open` passed on the command line. Null while neither is known.
const sessionWorktree = () => stateNow?.worktree || WORKTREE || null;

// The Workspace, kept by workspace.mjs: workspace.json has one writer, this server.
const workspace = serverWorkspace({
  dir: DIR,
  project: PROJECT,
  worktree: sessionWorktree,
  state: () => stateNow,
  ledger: ledgerEntries,
  pushState: () => pushState(),
});

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
  } else if (
    // The same hops `open --resume` treats as a fresh start, by the rule in
    // public/hops.js (a blank page, the agent's replies included). Without a
    // new conversation, the old questions would show as unanswered again.
    startsClean(last.workflow, state.workflow)
  ) {
    entry = appendChat(DIR, {
      kind: "reset",
      conversation: last.conversation + 1,
      workflow: state.workflow,
      reason: "switch",
    });
  }
  if (entry) appendEvent(DIR, { type: "chat-reset", reason: entry.reason });
}

/* ------------------------------------------------------------ subagents */

// The Subagents switch, kept by settings.mjs: subagents-setting.json has one
// writer, this server.
const subagents = serverSubagents({ dir: DIR, worktree: sessionWorktree });

// Whether the agent driving this session is the desktop app: fixed for the
// process's whole life (the env var that says so is set once, at spawn), so
// read once rather than on every frame. The page uses it to drop advice that
// only makes sense in a plain terminal (a command to copy into a new
// conversation) in favor of the app's own Restart and Update skills buttons.
const IN_APP = Boolean(inAppSignal());

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
    workspace: workspace.workspaceView(),
    meter: meterView(ledgerEntries()),
    subagents: subagents.view(state),
    inApp: IN_APP,
    ...(updateInfo ? { update: updateInfo } : {}),
    have: haveKey(),
  };
}

function haveKey() {
  const { pending, stop } = resultFlags();
  chatEntries();
  chatPickedUp();
  workspace.workspaceNow();
  ledgerEntries();
  subagents.settingNow();
  subagents.capsNow();
  return (
    `${STARTED}.${rev}.${pending ? 1 : 0}${stop ? 1 : 0}.${chatSeen.stamp || ""}.${cursorSeen.stamp || ""}` +
    `.${workspace.stamp() || ""}.${ledgerSeen.stamp || ""}.${updateInfo ? updateInfo.latest : ""}` +
    `.${subagents.stamps()}`
  );
}

function touch() {
  lastContact = Date.now();
}

// A tab closing: with no page left, the server stops two minutes from now
// rather than at the end of the idle window.
function closedTab() {
  if (clients.size === 0) lastContact = Date.now() - (IDLE_MS - 2 * 60 * 1000);
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

/* --------------------------------------------------------- update check */

// The version this console was installed as: install.js writes version.json
// beside console.mjs; a dev checkout falls back to the repo root's.
function installedVersion() {
  for (const file of [path.join(HERE, "version.json"), path.join(HERE, "..", "..", "version.json")]) {
    const version = readJson(file, {}).version;
    if (typeof version === "string" && version) return version;
  }
  return null;
}

// Filled in once the boot-time check answers; until then, and whenever it
// fails, the frame carries no `update` and the page shows no banner.
let updateInfo = null;
let updateLatest = null;

// Started at boot and never awaited: git may take up to its 10 s limit, and
// nothing the person sees waits on it. The catch is not optional: a throw in
// pushState() would otherwise be an unhandled rejection, which ends the server.
function startUpdateCheck() {
  const installed = installedVersion();
  if (!installed) return;
  checkForUpdate({ installed, cacheFile: UPDATE_CHECK_FILE })
    .then((result) => {
      updateLatest = result?.latest ?? null;
      updateInfo = result?.updateAvailable ? { installed: result.installed, latest: result.latest } : null;
      if (updateInfo) pushState();
    })
    .catch(() => {});
}

let agentSeenAt = Date.now();
function agentLastSeen() {
  return new Date(agentSeenAt).toISOString();
}

/* --------------------------------------------------------------- routes */

// The port this server answers on. Known before the server is: a handed-over
// socket was bound by console.mjs, so `server.address()` has nothing to say.
let PORT = 0;

// What routes.mjs reads from this server. Getters and setters where the
// value moves, so a handler always sees the live one.
const ctx = {
  sid: SID,
  token: TOKEN,
  dir: DIR,
  project: PROJECT,
  files: { state: STATE_FILE, draft: DRAFT_FILE, result: RESULT_FILE },
  port: () => PORT,
  get rev() {
    return rev;
  },
  set rev(n) {
    rev = n;
  },
  get browsers() {
    return browsers;
  },
  set browsers(n) {
    browsers = n;
  },
  clients,
  touch,
  closedTab,
  sawAgent: () => {
    agentSeenAt = Date.now();
  },
  agentLastSeen,
  readState,
  resultFlags,
  stateText: () => lastStateText,
  adoptStateText,
  stateFrame,
  haveKey,
  pushState,
  broadcast,
  chatEntries,
  chatOffline: chatOfflineNow,
  ensureConversation,
  worktree: sessionWorktree,
  workspace,
  subagents,
  installedVersion,
  updateLatest: () => updateLatest,
};

const server = http.createServer((req, res) => handle(req, res, ctx));

/* ------------------------------------------------------- state watching */

// The agent writes state.json through `console.mjs post`, and the server only
// through /submit; both under the state lock (updateState() in files.mjs), so
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
      try {
        subagents.sync(parsed);
      } catch {}
      try {
        workspace.followSpecDir(parsed);
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
  if (newLaunch) workspace.checkFolders(workspace.workspaceNow());
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
// Windows has no real SIGTERM, Node only synthesizes SIGINT for Ctrl+C on an
// attached console, and this process is detached with no console at all.
// taskkill /F and Task Manager give zero cleanup opportunity. A Job Object with
// KILL_ON_JOB_CLOSE would be the proper fix and needs native code, which is out
// under zero-dependencies. So the only thing that reliably stops an orphan is
// the server deciding to stop. Do not "optimize" this away.
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
    workspace.bootWorkspace();
  } catch {}
  try {
    subagents.sync(readState());
  } catch {}
  process.stdout.write(JSON.stringify({ type: "ready", url, port, sid: SID }) + "\n");
  try {
    startUpdateCheck();
  } catch {}
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
