// Shared setup for the web console tests (scripts/test-web-console-*.mjs).
//
// Lives in scripts/ rather than src/web-console/ on purpose: everything under
// src/web-console/ is copied verbatim into two skills, and tests should not ship.
//
// node --test runs each test file in its own process, and this module is
// evaluated once per process, so every file gets its own console home: the
// remembered workspaces, subagent switches, looks and sessions of one file
// never reach another file running beside it. Importing it also registers the
// cleanup that stops every server the file started and removes that home.
//
// PLAN2CODE_PICKER_ECHO (tests only, beside PLAN2CODE_NO_BROWSER): when set
// in the server's environment, /workspace/browse returns it as the picked
// folder instead of opening a picker, and "-" as a canceled one.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { readChat } from "../src/web-console/inbox.mjs";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CONSOLE_CLI = path.join(ROOT, "src", "web-console", "console.mjs");

// Canonicalized the same way server.mjs canonicalizes a session dir (DIR,
// server.mjs): on a machine whose %TEMP% itself resolves through an 8.3
// short name (seen in the wild on Windows), a server started later writes
// `state.worktree` in its realpath'd form, while anything in a test that
// builds a path under HOME without this would use the short one. Two
// spellings of the same folder hash to two different keys wherever a test
// writes through a path-keyed store (notepads.mjs, workspace.mjs,
// settings.mjs) ahead of the server itself touching that path, so the
// server's own later read finds nothing there. Resolving it once, here,
// keeps every path this file hands out consistent with what the server
// will compute.
const rawHome = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-console-test-"));
export const HOME = (() => {
  for (const real of [fs.realpathSync.native, fs.realpathSync]) {
    try {
      return real(rawHome);
    } catch {}
  }
  return rawHome;
})();
export const MODELS_DIR = path.join(HOME, "plan2code");
// Handoffs are written outside every repo, under ~/.plan2code/handoffs, so
// each test file gets its own throwaway folder for them too.
export const HANDOFFS_DIR = path.join(HOME, "handoffs");
// Notepads likewise live under ~/.plan2code/notepads. Set here for this
// process too, so a test importing notepads.mjs directly never reaches the
// real folder (notepadsDir() reads the variable on every call).
export const NOTEPADS_DIR = path.join(HOME, "notepads");
process.env.PLAN2CODE_NOTEPADS_DIR = NOTEPADS_DIR;
// A spawned console server or CLI must not inherit relocation vars (an
// exported GIT_DIR would redirect the board's reads), SSH markers (they set
// `remote` in open output) or leftover PLAN2CODE_* knobs.
const AMBIENT_ENV_KEYS = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_COMMON_DIR",
  "GIT_OBJECT_DIRECTORY",
  "GIT_CONFIG",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "GIT_CONFIG_NOSYSTEM",
  "SSH_CONNECTION",
  "PLAN2CODE_PICKER_ECHO",
  "PLAN2CODE_NOW",
];
const scrubbed = { ...process.env };
for (const k of AMBIENT_ENV_KEYS) delete scrubbed[k];
// GIT_CONFIG_GLOBAL wants a real path: os.devNull is `\\.\nul` here, which git
// cannot open. An empty file is the portable "no global config".
const EMPTY_GITCONFIG = path.join(HOME, "empty-gitconfig");
fs.writeFileSync(EMPTY_GITCONFIG, "");
export const ENV = { ...scrubbed, PLAN2CODE_CONSOLE_HOME: HOME, PLAN2CODE_MODELS_DIR: MODELS_DIR, PLAN2CODE_HANDOFFS_DIR: HANDOFFS_DIR, PLAN2CODE_NOTEPADS_DIR: NOTEPADS_DIR, PLAN2CODE_NO_BROWSER: "1", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: EMPTY_GITCONFIG };
// Every server these tests start runs the release check at boot. A fresh
// cached failure keeps the whole suite off the network and bannerless.
fs.writeFileSync(path.join(HOME, "update-check.json"), JSON.stringify({ checkedAt: Date.now(), latest: null }));

// The session cookie is named for the server's port: browsers ignore the port
// when they scope a cookie, so one shared name let each session's server
// overwrite the one before it.
export const cookieFor = (base, tok) => `p2c_console_${new URL(base).port}=${tok}`;

export function cli(args, { expectFail = false, env, cwd = ROOT } = {}) {
  const res = spawnSync(process.execPath, [CONSOLE_CLI, ...args], {
    env: env ? { ...ENV, ...env } : ENV,
    encoding: "utf8",
    cwd,
  });
  if (!expectFail && res.status !== 0 && res.status !== 10 && res.status !== 20 && res.status !== 30) {
    throw new Error(`console ${args.join(" ")} failed (${res.status}): ${res.stderr}`);
  }
  return { ...res, json: safeJson(res.stdout) };
}

export function safeJson(s) {
  const line = String(s).trim().split("\n").filter(Boolean).pop();
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

export function payload(file, obj) {
  const p = path.join(HOME, file);
  fs.writeFileSync(p, JSON.stringify(obj));
  return p;
}

// HTTP to a session a file keeps in its own variables: `get()` returns its
// current { baseUrl, token }, read on every call.
export function clientFor(get) {
  async function post(pathname, body) {
    const { baseUrl, token } = get();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await fetch(baseUrl + pathname, {
          method: "POST",
          headers: { "content-type": "application/json", cookie: cookieFor(baseUrl, token), connection: "close" },
          body: JSON.stringify(body ?? {}),
        });
      } catch (err) {
        if (attempt === 2) throw err;
      }
    }
  }

  // Over a raw socket, like rawGet in -session: fetch() folds `..` out of a URL
  // before it leaves, which would make every traversal test assert nothing.
  function raw(method, pathname, body, headers = {}) {
    const { baseUrl, token } = get();
    const port = Number(new URL(baseUrl).port);
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port,
          path: pathname,
          method,
          headers: { cookie: cookieFor(baseUrl, token), origin: baseUrl, connection: "close", ...headers },
        },
        (res) => {
          const chunks = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => {
            const buf = Buffer.concat(chunks);
            resolve({ status: res.statusCode, headers: res.headers, body: buf, json: safeJson(buf.toString("utf8")) });
          });
        }
      );
      req.on("error", reject);
      req.end(body);
    });
  }

  return { post, raw };
}

export const BASE = {
  workflow: "pathfinder",
  title: "Test session",
  items: [
    {
      id: "q1",
      kind: "choice",
      title: "Export format",
      body: "Pick one.",
      options: [
        { k: "A", text: "CSV", recommended: true },
        { k: "B", text: "Excel" },
      ],
      token: { A: "a", B: "b" },
    },
  ],
  agent: { status: "waiting" },
};

// The console's agent contract: console.md and every topic file it indexes
// (console-*.md, building*.md, notes/*.md), as one text. A rule an agent must
// learn has to be written somewhere in here; which file it lives in is the
// index's business.
export const WEB_CONSOLE_DIR = path.join(ROOT, "src", "web-console");
export function consoleDocFiles() {
  const top = fs.readdirSync(WEB_CONSOLE_DIR).filter((f) => f.endsWith(".md"));
  const notes = fs.readdirSync(path.join(WEB_CONSOLE_DIR, "notes")).filter((f) => f.endsWith(".md")).map((f) => `notes/${f}`);
  return [...top, ...notes].sort();
}
export const consoleDoc = (name) => fs.readFileSync(path.join(WEB_CONSOLE_DIR, name), "utf8");
export const consoleDocs = () => consoleDocFiles().map(consoleDoc).join("\n\n");

export const helpTemplate = () => {
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const tpl = html.match(/<template id="help-content">([\s\S]*?)<\/template>/);
  assert.ok(tpl, "index.html has the help-content template");
  return tpl[1];
};

// The Planny poses each skill's starting screen clones, from index.html.
export const poseTemplate = () => {
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const tpl = html.match(/<template id="start-poses">([\s\S]*?)<\/template>/);
  assert.ok(tpl, "index.html has the start-poses template");
  return tpl[1];
};

// The server checks magic bytes only, so a JPEG header and some padding will do.
export const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7), Buffer.from([0xff, 0xd9])]);

export const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(200, 0x20), Buffer.from("\n%%EOF\n")]);

export const DAY_MS = 24 * 60 * 60 * 1000;
export const backdate = (p, days = 31) => {
  const t = (Date.now() - days * DAY_MS) / 1000;
  fs.utimesSync(p, t, t);
};

// The console CLI run from another folder, for sessions whose project root
// is a temp project rather than this repo.
export function cliIn(cwd, args) {
  const res = spawnSync(process.execPath, [CONSOLE_CLI, ...args], { env: ENV, encoding: "utf8", cwd });
  if (![0, 10, 20, 30].includes(res.status)) {
    throw new Error(`console ${args.join(" ")} failed (${res.status}): ${res.stderr}`);
  }
  return { ...res, json: safeJson(res.stdout) };
}

export const sessionUrl = (url) => {
  const m = url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  return { base: m[1], cookie: cookieFor(m[1], m[2]) };
};
export const readState = (session) => JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));

export function openSession(extra = {}) {
  // A fresh page, and no folders remembered from an earlier test.
  fs.rmSync(path.join(HOME, "workspaces.json"), { force: true });
  const res = cli(["open", "--file", payload(`pin-${Date.now()}.json`, { ...BASE, ...extra }), "--no-open"]);
  const s = sessionUrl(res.json.url);
  const send = (pathname, body) =>
    fetch(`${s.base}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
      body: JSON.stringify(body ?? {}),
    });
  return { sid: res.json.sid, session: res.json.session, url: res.json.url, ...s, send };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let chatPayloads = 0;
export const postPatch = (s, obj, opts) =>
  cli(["post", "--session", s.sid, "--file", payload(`chat-post-${++chatPayloads}.json`, obj)], opts);
export const chatFrame = async (s) =>
  (await (await fetch(`${s.base}/state`, { headers: { cookie: s.cookie, connection: "close" } })).json()).chat;
export const ask = async (s, text, extra = {}) => {
  const res = await s.send("/chat", { text, conversation: 1, ...extra });
  return { status: res.status, body: await res.json() };
};
export const resetsIn = (s) => readChat(s.session).filter((e) => e.kind === "reset");
export async function until(fn, ms = 5000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(50);
  }
  return false;
}
export const EXPORT_A = { actions: [{ i: "q1", type: "answer", kind: "choice", k: "A" }], reply: "Export format: a" };

// The folders remembered across console sessions (workspaces.json) are
// cleared for every new test session unless it asks to keep them, so one
// test's additions never seed the next one's workspace.
export const REMEMBERED = path.join(HOME, "workspaces.json");

export function consoleSession(openArgs, opts = {}) {
  if (!opts.keepRemembered) fs.rmSync(REMEMBERED, { force: true });
  const res = cli(["open", "--no-open", ...openArgs], opts);
  const s = sessionUrl(res.json.url);
  const send = (pathname, body) =>
    fetch(`${s.base}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
      body: JSON.stringify(body ?? {}),
    });
  const get = async (pathname) =>
    (await fetch(`${s.base}${pathname}`, { headers: { cookie: s.cookie, connection: "close" } })).json();
  return { opened: res.json, sid: res.json.sid, session: res.json.session, ...s, send, get };
}

export const addFolder = async (s, body) => {
  const res = await s.send("/workspace/add", body);
  return { status: res.status, body: await res.json() };
};
export const tempFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), "p2c-ws-"));

export const reportedHelper = (id, extra = {}) => ({ id, title: `Helper ${id}`, ask: "Find the callers of applyPatch", state: "running", ...extra });

// The pids of console servers still running against this file's home. `stop
// --all` reaches only the servers of the folder it runs in (the git tests run
// theirs from temp repos), and leaves alone one too busy to answer /health,
// which a parallel run makes common. Left running, each idles for 30 minutes
// and slows every later run. Every server names its session dir, under HOME,
// on its command line, so that is how they are found.
function serversUsingHome() {
  const list =
    process.platform === "win32"
      ? spawnSync(
          "powershell",
          ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ForEach-Object { \"$($_.ProcessId) $($_.CommandLine)\" }"],
          { encoding: "utf8", windowsHide: true }
        ).stdout
      : spawnSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" }).stdout;
  const mark = path.basename(HOME);
  return String(list || "")
    .split(/\r?\n/)
    .filter((line) => line.includes("server.mjs") && line.includes(mark))
    .map((line) => Number(line.trim().split(/\s+/)[0]))
    .filter((pid) => pid && pid !== process.pid);
}

test.after(() => {
  try {
    execFileSync(process.execPath, [CONSOLE_CLI, "stop", "--all"], { env: ENV, cwd: ROOT });
  } catch {}
  // No session dir, no server: a file that opened none skips the process scan.
  const pids = fs.existsSync(path.join(HOME, "sessions")) ? serversUsingHome() : [];
  for (const pid of pids) {
    try {
      process.kill(pid);
    } catch {}
  }
  try {
    fs.rmSync(HOME, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  } catch {}
});
