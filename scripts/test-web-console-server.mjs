// Web console tests, independent sessions: first paint, streams, hand-off, cleanup, overview.
// Run with: node --test scripts/test-web-console-server.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import {
  ACCENTS,
  CARD_WIDTHS,
  cardWidth,
  DEFAULT_ACCENT,
  DEFAULT_CARD_WIDTH,
} from "../src/web-console/public/palette.js";
import { activityLabel, BUILD_WORKFLOWS, taskLabel, workingLine } from "../src/web-console/public/labels.js";
import {
  bindLoopback,
  cleanupFindings,
  handOff,
  PROTECTED_CONSOLE_FILES,
  readOverview,
  readSpecFile,
  removeCleanup,
  removeScratch,
  removeSessions,
  repoRoots,
  SESSION_MAX_AGE_MS,
  staleScratch,
  STRAY_GRACE_MS,
  staleSessions,
  terminalLine,
} from "../src/web-console/sessions.mjs";
import { validate } from "../src/web-console/patches.mjs";
import { joinedCss } from "./css-helpers.mjs";
import {
  ROOT,
  HANDOFFS_DIR,
  HOME,
  ENV,
  cookieFor,
  cli,
  payload,
  BASE,
  backdate,
  cliIn,
  sessionUrl,
  readState,
  sleep,
} from "./web-console-test-helpers.mjs";

// Every page load used to fetch /state, then /looks, then open the stream,
// before drawing anything real. The first state now rides in the page.
test("the page carries its first state, title and badge, so the first paint needs no fetch", async () => {
  const hostile = "Lunch </script><script>alert(1)</script> $& $' app";
  const res = cli(["open", "--workflow", "implement", "--title", hostile, "--no-open"]);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const html = await (await fetch(m[1] + "/", { headers: { cookie: cookieFor(m[1], m[2]) } })).text();

  const block = html.match(/<script type="application\/json" id="boot">([\s\S]*?)<\/script>/);
  assert.ok(block, "the boot block is in the page");
  const boot = JSON.parse(block[1]);
  assert.equal(boot.state.sid, res.json.sid);
  assert.equal(boot.state.title, hostile, "the title survives the round trip exactly");
  assert.equal(typeof boot.rev, "number");
  assert.ok(boot.have, "the page gets the key it hands back to /events");
  assert.ok("draft" in boot && "looks" in boot);

  // Agent-written text cannot close the data block or start a script: every
  // `<` inside it is escaped, so the only </script> is the block's own.
  assert.equal(block[1].includes("<"), false);
  assert.equal((html.match(/<script\b/g) || []).length, 2, "the boot block and app.js, nothing else");
  // Written into the markup, escaped, with `$&` and `$'` left as typed.
  assert.ok(html.includes(`<h1 id="title">Lunch &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; $&amp; $&#39; app</h1>`));
  assert.ok(html.includes('<span class="badge" id="badge">Building</span>'));
  assert.ok(html.includes("Starting Implement"), "the static starting screen names the skill");
  assert.ok(html.includes('rel="modulepreload" href="/app.js"'));
  cli(["stop", "--session", res.json.sid]);
});

test("open without --title names the session after the project folder", () => {
  const res = cli(["open", "--workflow", "pathfinder", "--no-open"]);
  const state = JSON.parse(fs.readFileSync(path.join(res.json.session, "state.json"), "utf8"));
  assert.equal(state.title, path.basename(ROOT));
  cli(["stop", "--session", res.json.sid]);
});

// A saved dark theme and accent used to flash the default light accent for as
// long as it took the script to fetch /looks. The server paints them now.
test("saved looks are painted by the server before any script runs", async () => {
  const looksFile = path.join(HOME, "looks.json");
  const before = fs.existsSync(looksFile) ? fs.readFileSync(looksFile) : null;
  fs.writeFileSync(
    looksFile,
    JSON.stringify({ looks: { theme: "dark", accent: "violet", sound: true, width: "wide" } })
  );
  try {
    const res = cli(["open", "--workflow", "plan", "--no-open"]);
    const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
    const cookie = cookieFor(m[1], m[2]);
    const html = await (await fetch(m[1] + "/", { headers: { cookie } })).text();
    assert.match(html, /<html lang="en" data-theme="dark" data-looks-accent="violet" data-width="wide">/);
    const css = await (await fetch(m[1] + "/app.css", { headers: { cookie } })).text();
    assert.ok(css.includes(`:root[data-looks-accent="violet"][data-theme="dark"]{--accent:${ACCENTS.violet.dark[0]}`));
    assert.ok(!css.includes(`data-looks-accent="${DEFAULT_ACCENT}"`), "the default needs no rule");
    const boot = JSON.parse(html.match(/id="boot">([\s\S]*?)<\/script>/)[1]);
    assert.equal(boot.looks.accent, "violet");
    cli(["stop", "--session", res.json.sid]);
  } finally {
    if (before) fs.writeFileSync(looksFile, before);
    else fs.rmSync(looksFile, { force: true });
  }
});

test("static assets revalidate with an ETag instead of downloading again", async () => {
  const res = cli(["open", "--workflow", "review", "--no-open"]);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const cookie = cookieFor(m[1], m[2]);
  const first = await fetch(m[1] + "/app.js", { headers: { cookie } });
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "no-cache");
  const etag = first.headers.get("etag");
  assert.ok(etag);
  await first.arrayBuffer();
  const again = await fetch(m[1] + "/app.js", { headers: { cookie, "if-none-match": etag } });
  assert.equal(again.status, 304);
  cli(["stop", "--session", res.json.sid]);
});

// The page drew from the inline state; the stream's opening frame would only
// make it draw the same screen again. It is skipped when the page's `have`
// still matches, and sent whenever anything differs.
test("the stream skips its opening frame only when the page already has that exact state", async () => {
  const res = cli(["open", "--file", payload("have.json", BASE), "--no-open"]);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:(\d+))\/s\/([^/]+)\//);
  const cookie = cookieFor(m[1], m[3]);
  await (await fetch(m[1] + "/state", { headers: { cookie } })).json();

  const firstChunk = (have) =>
    new Promise((resolve, reject) => {
      const req = http.request(
        {
          host: "127.0.0.1",
          port: Number(m[2]),
          path: "/events" + (have ? "?have=" + encodeURIComponent(have) : ""),
          headers: { cookie },
        },
        (r) => {
          let buf = "";
          r.setEncoding("utf8");
          r.on("data", (c) => (buf += c));
          setTimeout(() => {
            req.destroy();
            resolve(buf);
          }, 300);
        }
      );
      req.on("error", reject);
      req.end();
    });

  assert.match(await firstChunk(null), /event: state/, "no key: the frame goes");
  assert.match(await firstChunk("0.0.00"), /event: state/, "a stale key: the frame goes");
  // The ledger poll's first tick pushes a frame to every connected client
  // whatever the key (the newLaunch check in checkLedger), and it lands inside
  // the 300 ms read above when the connection is mid-window. Wait that tick
  // out and re-read the key, or its broadcast reads as the skipped frame.
  await sleep(1200);
  const still = await (await fetch(m[1] + "/state", { headers: { cookie } })).json();
  assert.doesNotMatch(await firstChunk(still.have), /event: state/, "the page's own key: skipped");
  cli(["stop", "--session", res.json.sid]);
});

// `open` binds the port and sends the browser before the server has booted.
// Whatever connects in that gap must be served, not refused: queued requests
// wait in the socket, and one `open` already accepted is passed across.
test("a request that arrives before the server takes the socket is still answered", async () => {
  const dir = fs.mkdtempSync(path.join(HOME, "handoff-"));
  fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify({ sid: path.basename(dir), phase: "collecting" }));
  const pre = await bindLoopback();
  const port = pre.address().port;
  // In flight before the server process even exists.
  const early = fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
  await new Promise((r) => setTimeout(r, 50));
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "src", "web-console", "server.mjs"), "--session", dir, "--token", "t", "--project", dir, "--handoff"],
    { env: ENV, stdio: ["ignore", "ignore", "ignore", "ipc"], windowsHide: true }
  );
  try {
    await handOff(child, pre);
    assert.equal((await early).sid, path.basename(dir));
    const late = await (await fetch(`http://127.0.0.1:${port}/health`)).json();
    assert.equal(late.sid, path.basename(dir), "the server kept the port after the handover");
  } finally {
    child.kill();
  }
});

// Each skill's Interface step has to put `open` before any reading: a skill
// that says "read console.md" first costs the person a whole model turn of
// staring at a terminal before the page appears.
test("every skill opens the console before it reads anything", () => {
  const skills = fs.readdirSync(path.join(ROOT, "src")).filter((f) => /^plan2code(-.*)?\.md$/.test(f));
  assert.ok(skills.length >= 13);
  for (const f of skills) {
    const text = fs.readFileSync(path.join(ROOT, "src", f), "utf8");
    const open = text.search(/console\.mjs" open(?! --resume)/);
    assert.ok(open > -1, `${f} names the open command`);
    const firstRead = text.search(/read (?:<D>\/)?console\.md/i);
    if (firstRead > -1) assert.ok(open < firstRead, `${f} opens before it reads console.md`);
  }
});

/* ------------------------------------------- polish 2: plumbing (phase 1) */



test("the card-width presets validate a saved width and fall back to comfortable", () => {
  for (const key of Object.keys(CARD_WIDTHS)) assert.equal(cardWidth(key), key);
  for (const junk of [undefined, "huge", "__proto__", 42]) assert.equal(cardWidth(junk), "comfortable");
  assert.equal(DEFAULT_CARD_WIDTH, "comfortable");
  assert.deepEqual(
    Object.values(CARD_WIDTHS).map((w) => w.px),
    [720, 880, 1080]
  );
});

test("a build's phase-numbered task label is rewritten to count within the phase", () => {
  assert.equal(taskLabel("Task 4.2 of 6: x"), "Task 2 of 6: x");
  assert.equal(taskLabel("Task 12.10 of 14"), "Task 10 of 14");
  for (const same of ["Task 2 of 6: x", "Reading files", "", null]) assert.equal(taskLabel(same), same);
  assert.deepEqual([...BUILD_WORKFLOWS].sort(), ["implement", "implement-review"]);
});

test("only a build's activity line is rewritten", () => {
  assert.equal(activityLabel("Task 4.2 of 6: x", "implement"), "Task 2 of 6: x");
  assert.equal(activityLabel("Task 4.2 of 6: x", "implement-review"), "Task 2 of 6: x");
  assert.equal(activityLabel("Task 4.2 of 6: x", "plan"), "Task 4.2 of 6: x");
  assert.equal(activityLabel("Task 4.2 of 6: x", "quick-task"), "Task 4.2 of 6: x");
  assert.equal(activityLabel("Task 4.2 of 6: x", "dashboard"), "Task 4.2 of 6: x");
});

test("a working agent's line falls back to its headline note", () => {
  const working = { status: "working" };
  assert.equal(workingLine({ ...working, activity: " Task 4.2 of 6: x " }, { note: "n" }, "implement"), "Task 2 of 6: x");
  assert.equal(workingLine(working, { stage: "Writing the spec", note: " Turning the plan into files. " }, "document"), "Turning the plan into files.");
  assert.equal(workingLine(working, { stage: "Writing the spec" }, "document"), "");
  assert.equal(workingLine({ status: "waiting", activity: "x" }, { note: "n" }, "document"), "");
  assert.equal(workingLine(undefined, undefined, "document"), "");
});

test("the terminal line is the exact text every command hands back", () => {
  assert.equal(terminalLine("http://127.0.0.1:1/s/abc/"), "→ Look at the web console: http://127.0.0.1:1/s/abc/");
  // Under the desktop app the page is beside the terminal: no address to print.
  const inApp = terminalLine("http://127.0.0.1:1/s/abc/", { PLAN2CODE_IN_APP: "1" });
  assert.equal(inApp.includes("127.0.0.1"), false, "no address under the app");
  assert.equal(terminalLine("http://127.0.0.1:1/s/abc/", {}), "→ Look at the web console: http://127.0.0.1:1/s/abc/");
});

test("repoRoots reads the branch off disk: named, detached, a linked worktree's own, and none", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-branch-"));
  try {
    const named = path.join(base, "named");
    fs.mkdirSync(path.join(named, ".git"), { recursive: true });
    fs.writeFileSync(path.join(named, ".git", "HEAD"), "ref: refs/heads/feature/x\n");
    assert.equal(repoRoots(named).branch, "feature/x");

    const detached = path.join(base, "detached");
    fs.mkdirSync(path.join(detached, ".git"), { recursive: true });
    fs.writeFileSync(path.join(detached, ".git", "HEAD"), "a".repeat(40) + "\n");
    assert.equal(repoRoots(detached).branch, "");

    // A linked worktree: `.git` is a file naming its own git dir, whose HEAD
    // is on a different branch from the main checkout's.
    const wtGit = path.join(named, ".git", "worktrees", "wt");
    fs.mkdirSync(wtGit, { recursive: true });
    fs.writeFileSync(path.join(wtGit, "HEAD"), "ref: refs/heads/other\n");
    fs.writeFileSync(path.join(wtGit, "commondir"), "../..\n");
    const wt = path.join(base, "wt");
    fs.mkdirSync(wt);
    fs.writeFileSync(path.join(wt, ".git"), `gitdir: ${wtGit}\n`);
    assert.equal(repoRoots(wt).branch, "other");

    const plain = path.join(base, "plain");
    fs.mkdirSync(plain);
    assert.equal(repoRoots(plain).branch, "");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

// With git's relocation variables set, repoRoots asks git. A repository with
// no commits yet must still key on the right project and name its branch.
test("repoRoots asks git when GIT_DIR is set, even before the first commit", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-gitdir-"));
  const repo = path.join(base, "repo");
  fs.mkdirSync(repo);
  execFileSync("git", ["init", "-q", "-b", "fresh-start"], { cwd: repo, stdio: "ignore" });
  const before = process.env.GIT_DIR;
  process.env.GIT_DIR = path.join(repo, ".git");
  try {
    const roots = repoRoots(repo);
    const full = fs.realpathSync.native(repo);
    assert.deepEqual(roots, { project: full, worktree: full, branch: "fresh-start" });
  } finally {
    if (before === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = before;
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("the session sweep removes only month-old session dirs, never the one being opened", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-sessions-"));
  try {
    const make = (name, { stale = true, state = true } = {}) => {
      const d = path.join(dir, name);
      fs.mkdirSync(d, { recursive: true });
      if (state) {
        fs.writeFileSync(path.join(d, "state.json"), "{}");
        if (stale) backdate(path.join(d, "state.json"));
      }
      return d;
    };
    const old = make("20250801-101010-aaaaaa");
    const fresh = make("20260920-101010-bbbbbb", { stale: false });
    const skip = make("20250801-101010-cccccc");
    const notes = make("notes");
    const noState = make("20250801-101010-dddddd", { state: false });
    const plainFile = path.join(dir, "20250801-101010-eeeeee");
    fs.writeFileSync(plainFile, "x");
    backdate(plainFile);

    const stale = staleSessions(dir, Date.now(), SESSION_MAX_AGE_MS, "20250801-101010-cccccc");
    assert.deepEqual(stale, ["20250801-101010-aaaaaa"]);
    assert.deepEqual(await removeSessions(dir, [...stale, "../escape", "notes"]), ["20250801-101010-aaaaaa"]);
    assert.equal(fs.existsSync(old), false);
    for (const p of [fresh, skip, notes, noState, plainFile]) assert.ok(fs.existsSync(p), p);
    assert.deepEqual(staleSessions(path.join(dir, "missing"), Date.now(), SESSION_MAX_AGE_MS, ""), []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("the scratch sweep removes old patches and helpers, never looks, the pointer, the update cache or a directory", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-scratch-"));
  try {
    const file = (name, stale = true) => {
      const p = path.join(dir, name);
      fs.writeFileSync(p, "{}");
      if (stale) backdate(p);
      return p;
    };
    const removable = [file("p2.json"), file("helper.mjs")];
    const kept = [
      file("looks.json"),
      file("workspaces.json"),
      file("subagents.json"),
      file("pr-hosts.json"),
      file("console-dir"),
      file("update-check.json"),
      file("notes.txt"),
      file("p3.json", false),
    ];
    const subdir = path.join(dir, "x.json");
    fs.mkdirSync(subdir);
    backdate(subdir);
    kept.push(subdir);

    const stale = staleScratch(dir, Date.now(), SESSION_MAX_AGE_MS).sort();
    assert.deepEqual(stale, ["helper.mjs", "p2.json"]);
    assert.deepEqual(
      (await removeScratch(dir, [...stale, "looks.json", "workspaces.json", "subagents.json", "pr-hosts.json", "../p.json", "console-dir", "update-check.json"])).sort(),
      ["helper.mjs", "p2.json"]
    );
    for (const p of removable) assert.equal(fs.existsSync(p), false, p);
    for (const p of kept) assert.ok(fs.existsSync(p), p);
    assert.deepEqual([...PROTECTED_CONSOLE_FILES].sort(), [
      "console-dir",
      "looks.json",
      "pr-hosts.json",
      "subagents.json",
      "update-check.json",
      "workspaces.json",
    ]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("cleanup finds old sessions and strays in both folders, and keeps every protected name and this session", async () => {
  const plan2code = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-cleanup-"));
  const consoleDir = path.join(plan2code, "console");
  try {
    // Strays count only once they have sat for the grace period, so every one
    // this test expects to be found is backdated.
    const put = (p, body = "{}") => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body);
      return p;
    };
    const stray = (p, body) => {
      put(p, body);
      backdate(p);
      return p;
    };
    const session = (sid, stale) => {
      const state = put(path.join(consoleDir, "sessions", sid, "state.json"));
      if (stale) backdate(state);
      return path.dirname(state);
    };
    const old = session("20250801-101010-aaaaaa", true);
    const current = session("20250801-101010-bbbbbb", true);
    const fresh = session("20260920-101010-cccccc", false);
    // A month-old state.json, but a draft saved today: still in use.
    const drafted = session("20250801-101010-dddddd", true);
    put(path.join(drafted, "draft.json"));
    const kept = [
      ...["looks.json", "workspaces.json", "subagents.json", "console-dir", "update-check.json"].map((n) =>
        put(path.join(consoleDir, n))
      ),
      put(path.join(plan2code, "launcher.json")),
      put(path.join(plan2code, "models.json")),
      put(path.join(plan2code, "bin", "plan2code.js"), "x"),
      current,
      fresh,
      drafted,
    ];
    stray(path.join(consoleDir, "p1.json"), "12345");
    put(path.join(consoleDir, "runtime", "x.json"));
    backdate(put(path.join(plan2code, "console-dev", "sessions", "x.txt"), "abc"));
    backdate(path.join(plan2code, "console-dev"));
    // An old folder with a file rewritten just now: the folder's own mtime
    // never moves for that, so only its contents show it is in use.
    const busy = put(path.join(plan2code, "busy", "log.txt"));
    backdate(path.join(plan2code, "busy"));
    kept.push(busy);
    stray(path.join(plan2code, "notes.txt"));
    // Handoffs are Plan2Code's own, however old: swept by age on open, never offered here.
    backdate(put(path.join(plan2code, "handoffs", "2025-01-01-0900-handoff.md")));
    backdate(path.join(plan2code, "handoffs"));
    // The desktop app and its settings are Plan2Code's own too, however old.
    backdate(put(path.join(plan2code, "app", "plan2code-app"), "x"));
    backdate(path.join(plan2code, "app"));
    backdate(put(path.join(plan2code, "app.json")));
    backdate(put(path.join(plan2code, "agents.json")));
    // In use right now: a held lock and a temp between its write and rename.
    const live = [put(path.join(consoleDir, "workspaces.json.lock"), ""), put(path.join(plan2code, "models.json.123.tmp"))];
    kept.push(...live);
    stray(path.join(consoleDir, "looks.json.456.tmp"));

    const opts = { consoleDir, plan2codeDir: plan2code, skipSid: "20250801-101010-bbbbbb" };
    const { items, bytes } = await cleanupFindings(opts);
    assert.deepEqual(items.map((i) => i.id).sort(), [
      "console:looks.json.456.tmp",
      "console:p1.json",
      "root:console-dev",
      "root:notes.txt",
      "session:20250801-101010-aaaaaa",
    ]);
    assert.equal(items.some((i) => i.id === "root:handoffs"), false, "the handoffs folder is never a stray");
    for (const id of ["root:app", "root:app.json", "root:agents.json"]) assert.equal(items.some((i) => i.id === id), false, `${id} is never a stray`);
    assert.equal(STRAY_GRACE_MS, 60 * 60 * 1000);
    assert.equal(items.find((i) => i.id === "console:p1.json").bytes, 5);
    assert.equal(items.find((i) => i.id === "root:console-dev").kind, "folder");
    assert.equal(bytes, items.reduce((n, i) => n + i.bytes, 0));

    // A console running from another home never reaches the folder above it.
    const elsewhere = await cleanupFindings({ ...opts, plan2codeDir: path.join(plan2code, "other") });
    assert.deepEqual(elsewhere.items.map((i) => i.where).sort(), ["console", "console", "session"]);

    // Only ids a fresh scan still finds are removed; anything else is ignored.
    const done = await removeCleanup(
      ["console:p1.json", "session:20250801-101010-aaaaaa", "session:20250801-101010-dddddd", "root:busy", "root:console-dev", "console:looks.json", "root:bin", "session:20250801-101010-bbbbbb", "console:workspaces.json.lock", "root:models.json.123.tmp", "console:../escape", 7],
      opts
    );
    assert.deepEqual(done.removed.sort(), ["console:p1.json", "root:console-dev", "session:20250801-101010-aaaaaa"]);
    assert.deepEqual(done.failed, []);
    assert.equal(done.bytes, 5 + 3 + 2);
    assert.equal(fs.existsSync(old), false);
    assert.equal(fs.existsSync(path.join(plan2code, "console-dev")), false);
    assert.ok(fs.existsSync(path.join(plan2code, "notes.txt")), "not asked for, so not removed");
    for (const p of kept) assert.ok(fs.existsSync(p), p);
    assert.ok(fs.existsSync(path.join(consoleDir, "runtime", "x.json")));
  } finally {
    fs.rmSync(plan2code, { recursive: true, force: true });
  }
});

test("cleanup lists the project's completed specs untouched for 30 days, and removes only those", async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-cleanup-completed-"));
  const consoleDir = path.join(base, "home", "console");
  const project = path.join(base, "project");
  const completed = path.join(project, "specs--completed");
  try {
    const put = (p, body = "{}") => {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, body);
      return p;
    };
    fs.mkdirSync(consoleDir, { recursive: true });
    const opts = { consoleDir, plan2codeDir: path.join(base, "home"), skipSid: "x", project };

    // No specs--completed/ at all is just nothing to list.
    assert.deepEqual((await cleanupFindings(opts)).items, []);

    backdate(put(path.join(completed, "old-spec", "overview.md"), "abc"));
    backdate(path.join(completed, "old-spec"));
    put(path.join(completed, "fresh-spec", "overview.md"));
    // An old folder with one file finalized today: still recent.
    backdate(put(path.join(completed, "touched-spec", "phase-1.md")));
    put(path.join(completed, "touched-spec", "overview.md"));
    backdate(put(path.join(completed, "README.md")));
    backdate(put(path.join(project, "specs", "live-spec", "overview.md")));

    const { items } = await cleanupFindings(opts);
    assert.deepEqual(items.map((i) => i.id), ["completed:old-spec"]);
    assert.equal(items[0].where, "completed");
    assert.equal(items[0].kind, "folder");
    assert.equal(items[0].bytes, 3);

    // Without a project, the archive is never looked at.
    const { project: _p, ...noProject } = opts;
    assert.deepEqual((await cleanupFindings(noProject)).items, []);

    const done = await removeCleanup(["completed:old-spec", "completed:fresh-spec", "completed:../specs", "completed:README.md"], opts);
    assert.deepEqual(done.removed, ["completed:old-spec"]);
    assert.equal(fs.existsSync(path.join(completed, "old-spec")), false);
    for (const p of ["fresh-spec", "touched-spec", "README.md"]) assert.ok(fs.existsSync(path.join(completed, p)), p);
    assert.ok(fs.existsSync(path.join(project, "specs", "live-spec")));
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("User Preferences: wider, its body scrolls and the button bar stays put, without touching dialogs that borrow .looks", () => {
  const html = fs.readFileSync(path.join(ROOT, "src", "web-console", "public", "index.html"), "utf8");
  const css = joinedCss();
  const dialog = html.match(/<dialog class="modal looks prefs" id="looks-modal"[^>]*>([\s\S]*?)<\/dialog>/);
  assert.ok(dialog, "the Preferences dialog carries the prefs class");
  const body = dialog[1].indexOf('<div class="prefs-body">');
  const actions = dialog[1].indexOf('<div class="modal-actions">');
  assert.ok(body >= 0 && actions > body, "the fieldsets sit in .prefs-body, before the actions");
  assert.ok(dialog[1].lastIndexOf("</fieldset>") < actions, "every fieldset is inside the scrolling body");
  assert.match(css, /\.modal\.prefs \{ max-width: 880px; \}/);
  assert.match(css, /\.prefs-body \{[^}]*overflow-y: auto/);
  assert.match(css, /\.modal\.prefs \.modal-actions \{[^}]*flex: none/);
  assert.match(html, /<dialog class="modal looks subagents" id="subagents-modal"/, "Subagents keeps its own classes");
});

// A temp project with specs/a (overview) and specs/b (no overview), and a
// file outside the root for escapes to aim at.
function overviewProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-overview-"));
  const root = path.join(base, "project");
  fs.mkdirSync(path.join(root, "specs", "a"), { recursive: true });
  fs.mkdirSync(path.join(root, "specs", "b"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "a", "overview.md"), "# Overview A\n");
  fs.writeFileSync(path.join(root, "specs", "a", "phase-1.md"), "- [ ] **Task 1.1:** x\n");
  fs.writeFileSync(path.join(root, "specs", "b", "notes.md"), "notes\n");
  // Planned, not documented: a Pathfinder map and a live draft beside the
  // copy Revise plan keeps of the last one.
  fs.mkdirSync(path.join(root, "specs", "c", "pathfinder"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs", "c", "pathfinder", "map.md"), "# Map C\n");
  fs.writeFileSync(path.join(root, "specs", "c", "PLAN-DRAFT-20261020.md"), "# Draft C\n");
  fs.writeFileSync(path.join(root, "specs", "c", "PLAN-DRAFT-20261020-prev.md"), "# Old draft C\n");
  fs.mkdirSync(path.join(base, "outside"));
  fs.writeFileSync(path.join(base, "outside", "overview.md"), "# SECRET\n");
  return { base, root };
}

test("readOverview reads a spec's overview and nothing outside the root", async () => {
  const { base, root } = overviewProject();
  try {
    assert.equal(await readOverview(root, "specs/a"), "# Overview A\n");
    assert.equal(await readOverview(root, "specs/b"), null);
    assert.equal(await readOverview(root, "../outside"), null);
    assert.equal(await readOverview(root, path.join(base, "outside")), null);
    assert.equal(await readOverview(root, ""), null);
    assert.equal(await readOverview("", "specs/a"), null);
    let linked = true;
    try {
      fs.symlinkSync(path.join(base, "outside"), path.join(root, "specs", "link"), "junction");
    } catch (err) {
      if (err.code !== "EPERM") throw err;
      linked = false;
    }
    if (linked) assert.equal(await readOverview(root, "specs/link"), null);

    // A root that is the drive (or filesystem) root itself still contains
    // its own files: the root already ends in a separator.
    const driveRoot = path.parse(root).root;
    assert.equal(await readOverview(driveRoot, path.relative(driveRoot, path.join(root, "specs", "a"))), "# Overview A\n");
    // A folder whose name merely starts with ".." is inside the root.
    fs.mkdirSync(path.join(root, "..dots"));
    fs.writeFileSync(path.join(root, "..dots", "overview.md"), "# Dots\n");
    assert.equal(await readOverview(root, "..dots"), "# Dots\n");
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("readSpecFile reads a spec's map and live plan draft, and names the file", async () => {
  const { base, root } = overviewProject();
  try {
    assert.deepEqual(await readSpecFile(root, "specs/c", "map"), { file: "pathfinder/map.md", text: "# Map C\n" });
    assert.deepEqual(await readSpecFile(root, "specs/c", "draft"), { file: "PLAN-DRAFT-20261020.md", text: "# Draft C\n" });
    assert.deepEqual(await readSpecFile(root, "specs/a", "overview"), { file: "overview.md", text: "# Overview A\n" });
    assert.equal(await readSpecFile(root, "specs/c", "overview"), null);
    assert.equal(await readSpecFile(root, "specs/a", "map"), null);
    assert.equal(await readSpecFile(root, "specs/a", "draft"), null);
    assert.equal(await readSpecFile(root, "specs/c", "phase-1.md"), null, "only the known kinds");
    assert.equal(await readSpecFile(root, "../outside", "draft"), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("GET /overview serves the session's spec, and on the dashboard only a scanned one", async () => {
  const { base, root } = overviewProject();
  const sids = [];
  try {
    const get = (s, q = "", cookie = s.cookie) =>
      fetch(`${s.base}/overview${q}`, { headers: cookie ? { cookie, connection: "close" } : { connection: "close" } });

    const plan = cliIn(root, ["open", "--workflow", "plan", "--spec", "specs/a", "--no-open"]);
    sids.push(plan.json.sid);
    const p = sessionUrl(plan.json.url);
    const ok = await get(p, "?spec=specs/b");
    assert.equal(ok.status, 200);
    assert.match(ok.headers.get("content-type"), /^text\/markdown/);
    assert.equal(ok.headers.get("cache-control"), "no-store");
    assert.equal(await ok.text(), "# Overview A\n", "the spec query is ignored outside the dashboard");
    assert.equal((await get(p, "", null)).status, 403);

    const noOverview = cliIn(root, ["open", "--workflow", "plan", "--spec", "specs/b", "--no-open"]);
    sids.push(noOverview.json.sid);
    assert.equal((await get(sessionUrl(noOverview.json.url))).status, 204, "no overview.md is normal: 204, not a failed request in the console");

    const dash = cliIn(root, ["open", "--workflow", "dashboard", "--no-open"]);
    sids.push(dash.json.sid);
    const d = sessionUrl(dash.json.url);
    assert.equal((await get(d, "?spec=specs/a")).status, 200);
    // A scanned spec with no overview.md: the page hides the tab on this 204 (anything but a 200).
    assert.ok(readState(dash.json.session).scan.specs.some((s) => s.dir === "specs/b"), "specs/b is in the scan");
    assert.equal((await get(d, "?spec=specs/b")).status, 204);
    assert.equal((await get(d, "?spec=specs/../..")).status, 204);
    assert.equal((await get(d, "?spec=specs/not-scanned")).status, 204);
    // ?file= picks the map or the live draft, and names it for the page.
    const map = await get(d, "?spec=specs/c&file=map");
    assert.equal(map.status, 200);
    assert.equal(map.headers.get("x-spec-file"), encodeURIComponent("pathfinder/map.md"));
    assert.equal(await map.text(), "# Map C\n");
    const draft = await get(d, "?spec=specs/c&file=draft");
    assert.equal(draft.headers.get("x-spec-file"), "PLAN-DRAFT-20261020.md");
    assert.equal(await draft.text(), "# Draft C\n");
    assert.equal((await get(d, "?spec=specs/c")).status, 204, "no overview.md yet");
    assert.equal((await get(d, "?spec=specs/c&file=nope")).status, 204);
  } finally {
    for (const s of sids) cliIn(root, ["stop", "--session", s]);
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("open records worktree and branch, and wakes only a freshly opened dashboard", () => {
  const dash = cli(["open", "--workflow", "dashboard", "--no-open"]);
  try {
    assert.equal(dash.json.terminalLine, terminalLine(dash.json.url));
    const state = readState(dash.json.session);
    assert.equal(state.wake, true);
    assert.equal(state.worktree, repoRoots(ROOT).worktree);
    assert.equal(state.branch, repoRoots(ROOT).branch);

    cli(["open", "--resume", dash.json.sid, "--workflow", "plan", "--no-open"]);
    assert.equal("wake" in readState(dash.json.session), false);
    cli(["open", "--resume", dash.json.sid, "--workflow", "dashboard", "--no-open"]);
    assert.equal("wake" in readState(dash.json.session), false, "a return to the dashboard never replays");
    cli(["open", "--resume", dash.json.sid, "--no-open"]);
    assert.equal("wake" in readState(dash.json.session), false);
  } finally {
    cli(["stop", "--session", dash.json.sid]);
  }

  const plan = cli(["open", "--workflow", "plan", "--no-open"]);
  assert.equal("wake" in readState(plan.json.session), false);
  cli(["stop", "--session", plan.json.sid]);
});

test("open reports a month-old session under swept and removes it after printing", async () => {
  const quiet = cli(["open", "--workflow", "plan", "--no-open"]);
  assert.equal("swept" in quiet.json, false, "nothing old, nothing reported");
  cli(["stop", "--session", quiet.json.sid]);

  const oldSid = "20250101-101010-abcdef";
  const oldDir = path.join(HOME, "sessions", oldSid);
  fs.mkdirSync(oldDir, { recursive: true });
  fs.writeFileSync(path.join(oldDir, "state.json"), "{}");
  backdate(path.join(oldDir, "state.json"));
  const res = cli(["open", "--workflow", "plan", "--no-open"]);
  cli(["stop", "--session", res.json.sid]);
  assert.deepEqual(res.json.swept.sessions, [oldSid]);
  for (let i = 0; i < 20 && fs.existsSync(oldDir); i++) await new Promise((r) => setTimeout(r, 100));
  assert.equal(fs.existsSync(oldDir), false);
});

test("open reports a month-old handoff under swept.handoffs and removes both its files", async () => {
  const id = "2025-01-01-0900-handoff";
  fs.mkdirSync(HANDOFFS_DIR, { recursive: true });
  const files = [path.join(HANDOFFS_DIR, id + ".md"), path.join(HANDOFFS_DIR, id + ".json")];
  fs.writeFileSync(files[0], "# Handoff: old\n");
  fs.writeFileSync(files[1], "{}");
  for (const f of files) backdate(f);
  const res = cli(["open", "--workflow", "plan", "--no-open"]);
  cli(["stop", "--session", res.json.sid]);
  assert.deepEqual(res.json.swept.handoffs, [id]);
  for (let i = 0; i < 20 && files.some((f) => fs.existsSync(f)); i++) await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(files.filter((f) => fs.existsSync(f)), []);
});

test("post and wait hand back the terminal line; the collected result on disk does not carry it", async () => {
  const res = cli(["open", "--file", payload("tl.json", BASE), "--no-open"]);
  const s = sessionUrl(res.json.url);
  try {
    const posted = cli(["post", "--session", res.json.sid, "--file", payload("tl2.json", { agent: { status: "waiting" } })]);
    assert.equal(posted.json.terminalLine, terminalLine(res.json.url));

    const waiting = cli(["wait", "--session", res.json.sid, "--seconds", "5"]);
    assert.equal(waiting.status, 10);
    assert.equal(waiting.json.message, "Waiting on your answer in the web console");
    assert.match(waiting.json.next, /run this same wait command again/);
    assert.equal(waiting.json.terminalLine, terminalLine(res.json.url));

    const sent = await fetch(`${s.base}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
      body: JSON.stringify({ actions: [{ i: "q1", type: "answer", kind: "choice", k: "A" }], reply: "Export format: a" }),
    });
    assert.equal(sent.status, 200);
    const done = cli(["wait", "--session", res.json.sid, "--seconds", "10"]);
    assert.equal(done.status, 0);
    assert.equal(done.json.terminalLine, terminalLine(res.json.url));
    const onDisk = JSON.parse(fs.readFileSync(path.join(res.json.session, "result.json"), "utf8"));
    assert.equal("terminalLine" in onDisk, false);
    assert.ok(onDisk.consumedAt);

    const js = await fetch(`${s.base}/labels.js`, { headers: { cookie: s.cookie, connection: "close" } });
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type"), /javascript/);
  } finally {
    cli(["stop", "--session", res.json.sid]);
  }
});

test("notes/quick-task.md has a quick-task build tick the Plan tab's steps live", () => {
  const md = fs.readFileSync(path.join(ROOT, "src", "web-console", "notes", "quick-task.md"), "utf8");
  const section = md.slice(md.indexOf("## Quick task (`quick-task`)"), md.indexOf("## Stop requests during a build"));
  assert.ok(!section.includes('"title": "Build progress"'), "no separate progress tab");
  assert.match(section, /post after every step/i);
  assert.ok(section.includes('{ "id": "steps", "state": "settled", "md": "## Steps\\n\\n- [ ] **1.**'), "the plan's Steps start as a checklist");
  assert.ok(section.includes('"docs": [{ "id": "plan", "blocks": [\n      { "id": "steps"'), "a step post reposts the plan's steps block, its version moving by itself");
  assert.ok(section.includes("- [x] **1.** Step one"));
});

test("notes/quick-task.md has the finished quick task offer Back to the dashboard as well as the review", () => {
  const md = fs.readFileSync(path.join(ROOT, "src", "web-console", "notes", "quick-task.md"), "utf8");
  const section = md.slice(md.indexOf("## Quick task (`quick-task`)"));
  const bullet = section.slice(section.indexOf("**The finish after the build:**"), section.indexOf("**Escalated / aborted:**"));
  assert.ok(bullet.includes('"dashboard": true'));
  assert.ok(bullet.includes("Review it now"));
});

// Show me it working: a screenshot saved under <session>/shots/ posts as an
// image block and is served back; nothing else is reachable through /shots/.
test("an image block under the session's shots folder round-trips, and /shots/ serves nothing else", async () => {
  const res = cli(["open", "--workflow", "implement", "--no-open"]);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const cookie = cookieFor(m[1], m[2]);
  try {
    const shots = path.join(res.json.session, "shots");
    fs.mkdirSync(shots, { recursive: true });
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 7)]);
    fs.writeFileSync(path.join(shots, "home-page.png"), png);
    const patch = { docs: [{ id: "shown", title: "Shown working", blocks: [{ id: "s1", image: "shots/home-page.png", alt: "The home page with the new button" }] }] };
    cli(["post", "--session", res.json.sid, "--file", payload("shots-ok.json", patch)]);
    const block = readState(res.json.session).docs.find((d) => d.id === "shown").blocks[0];
    assert.equal(block.image, "shots/home-page.png", "stored session-relative");
    assert.equal(block.md, undefined);

    // Its alt text is a caption, held to the same vocabulary rule as a title.
    const jargon = { docs: [{ id: "shown", blocks: [{ id: "s1", image: "shots/home-page.png", alt: "Grilling the home page" }] }] };
    const refused = cli(["post", "--session", res.json.sid, "--file", payload("shots-jargon.json", jargon)], { expectFail: true });
    assert.equal(refused.status, 3);
    assert.match(refused.stderr, /alt text contains internal vocabulary/);
    // A changed picture or caption is a new version of the doc.
    const before = readState(res.json.session).docs.find((d) => d.id === "shown").version;
    const recaption = { docs: [{ id: "shown", blocks: [{ id: "s1", image: "shots/home-page.png", alt: "The home page, after the fix" }] }] };
    cli(["post", "--session", res.json.sid, "--file", payload("shots-recaption.json", recaption)]);
    assert.equal(readState(res.json.session).docs.find((d) => d.id === "shown").version, before + 1);

    const got = await fetch(m[1] + "/shots/home-page.png", { headers: { cookie } });
    assert.equal(got.status, 200);
    assert.equal(got.headers.get("content-type"), "image/png");
    assert.equal(got.headers.get("cache-control"), "no-store");
    assert.deepEqual(Buffer.from(await got.arrayBuffer()), png);

    const anon = await fetch(m[1] + "/shots/home-page.png");
    assert.equal(anon.status, 403, "the cookie is still required");
    await anon.arrayBuffer();

    // Raw request lines: fetch would fold the `..` away before sending.
    const raw = (p) =>
      new Promise((resolve, reject) => {
        const req = http.request({ host: "127.0.0.1", port: Number(new URL(m[1]).port), path: p, headers: { cookie } }, (r) => {
          r.resume();
          r.on("end", () => resolve(r.statusCode));
        });
        req.on("error", reject);
        req.end();
      });
    for (const p of ["/shots/../state.json", "/shots/..%2fstate.json", "/shots/missing.png", "/shots/home-page.png?x=1"]) {
      assert.equal(await raw(p), 404, p);
    }
  } finally {
    cli(["stop", "--session", res.json.sid]);
  }
});

// /app.css is the files under public/styles/ joined in CSS_ORDER (one newline
// after each), then the accent rules. The files themselves are never served.
test("/app.css is the style files joined in CSS_ORDER with the accent rules last", async () => {
  const { CSS_ORDER, asset, etagOf } = await import("../src/web-console/static.mjs");
  const dir = path.join(ROOT, "src", "web-console", "public", "styles");
  const res = cli(["open", "--workflow", "review", "--no-open"]);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const cookie = cookieFor(m[1], m[2]);
  try {
    const r = await fetch(m[1] + "/app.css", { headers: { cookie } });
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type"), /^text\/css/);
    const body = await r.text();
    // One newline between files: each file's own last newline is that one.
    const joined = CSS_ORDER.map((f) => fs.readFileSync(path.join(dir, f), "utf8").replace(/\n$/, "")).join("\n") + "\n";
    assert.ok(body.startsWith(joined), "the body opens with the files, in CSS_ORDER, one newline between");
    const accents = body.slice(joined.length);
    assert.match(accents, /^\n*\/\* Generated by server\.mjs from palette\.js/, "the accent rules come last");
    assert.ok(accents.includes(`:root[data-looks-accent="violet"]`));
    // The tests' helper joins through the server's own function, so the two agree.
    assert.equal(body, joinedCss() + accents, "joinedCss() plus the accent rules is the body the server returns");
    // The ETag is a hash of the whole body, so a change to any one file moves it.
    assert.equal(r.headers.get("etag"), etagOf(Buffer.from(body)));
    assert.equal(asset("app.css").etag, etagOf(Buffer.from(body)));
    for (const f of CSS_ORDER) {
      const text = fs.readFileSync(path.join(dir, f), "utf8").replace(/\n$/, "");
      assert.notEqual(etagOf(Buffer.from(body.replace(text, text + "\n/* changed */"))), r.headers.get("etag"), `a change to ${f} moves the ETag`);
    }
    for (const f of CSS_ORDER) {
      const own = await fetch(m[1] + "/styles/" + f, { headers: { cookie } });
      assert.equal(own.status, 404, `/styles/${f} is not served on its own`);
      await own.arrayBuffer();
    }
  } finally {
    cli(["stop", "--session", res.json.sid]);
  }
});

// The skills the build writes carry public/styles/ with every file in CSS_ORDER,
// and a console started from that tree serves the same /app.css as this one.
test("the built skills tree serves the same /app.css as the source console", async (t) => {
  const { CSS_ORDER, asset } = await import("../src/web-console/static.mjs");
  const built = path.join(ROOT, "skills", "plan2code", "references", "web-console");
  // npm test builds first; a bare run of this file may not have.
  if (!fs.existsSync(path.join(built, "console.mjs"))) return t.skip("skills/ is not built: run npm run build:skills");
  for (const f of CSS_ORDER) assert.ok(fs.existsSync(path.join(built, "public", "styles", f)), `the build is missing public/styles/${f}`);
  const out = execFileSync(process.execPath, [path.join(built, "console.mjs"), "open", "--workflow", "review", "--no-open"], { env: ENV, encoding: "utf8", cwd: ROOT });
  const json = JSON.parse(out.trim().split("\n").pop());
  const m = json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  try {
    const res = await fetch(m[1] + "/app.css", { headers: { cookie: cookieFor(m[1], m[2]) } });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), asset("app.css").body.toString("utf8"));
  } finally {
    execFileSync(process.execPath, [path.join(built, "console.mjs"), "stop", "--session", json.sid], { env: ENV, cwd: ROOT });
  }
});

// The desktop app's webview opens no new windows, so a link the page shows
// there goes through /open-link, which hands it to the default browser. Only
// http and https: anything else would be the page asking the machine to run
// whatever a link names.
test("/open-link takes an http or https link and refuses every other kind", async () => {
  const res = cli(["open", "--workflow", "git", "--no-open"]);
  const m = res.json.url.match(/^(http:\/\/127\.0\.0\.1:\d+)\/s\/([^/]+)\//);
  const cookie = cookieFor(m[1], m[2]);
  const open = (url) =>
    fetch(`${m[1]}/open-link`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: m[1], connection: "close" },
      body: JSON.stringify({ url }),
    });
  try {
    const ok = await open("https://github.com/jparkerweb/plan2code/compare/main...feature?expand=1");
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, url: "https://github.com/jparkerweb/plan2code/compare/main...feature?expand=1" });
    for (const bad of ["javascript:alert(1)", "file:///C:/Windows/System32/calc.exe", "ms-settings:", "not a link", "", 42]) {
      const no = await open(bad);
      assert.equal(no.status, 400, `${JSON.stringify(bad)} was not refused`);
    }
    const foreign = await fetch(`${m[1]}/open-link`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie, origin: "https://evil.example", connection: "close" },
      body: JSON.stringify({ url: "https://example.com/" }),
    });
    assert.notEqual(foreign.status, 200, "another site's page cannot open links through the console");
  } finally {
    cli(["stop", "--session", res.json.sid]);
  }
});
