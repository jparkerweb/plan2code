// Web console tests, helper hops, concurrent writers, bad usage, foreign origins.
// Run with: node --test scripts/test-web-console-concurrency.mjs
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
import { meterView } from "../src/web-console/public/meter.js";
import { STATE_LOCK_FILE } from "../src/web-console/files.mjs";
import { cwdHash, readLedger, repoRoots } from "../src/web-console/sessions.mjs";
import { validate } from "../src/web-console/patches.mjs";
import { WORKSPACE_FILE } from "../src/web-console/workspace.mjs";
import {
  ROOT,
  CONSOLE_CLI,
  HOME,
  ENV,
  cookieFor,
  cli,
  payload,
  BASE,
  cliIn,
  readState,
  openSession,
  sleep,
  postPatch,
  until,
  EXPORT_A,
  consoleSession,
  tempFolder,
  reportedHelper,
} from "./web-console-test-helpers.mjs";

test("helpers: a dashboard hop clears them, a same-workflow or paused resume keeps them, and the meter never moves", async () => {
  const s = consoleSession(["--workflow", "implement"]);
  try {
    const meterBefore = (await s.get("/state")).meter;
    assert.equal(postPatch(s, { helpers: [reportedHelper("h1"), reportedHelper("h2")] }).status, 0);
    assert.deepEqual((await s.get("/state")).meter, meterBefore, "helper reports add nothing to the meter");
    assert.equal(readLedger(s.session).some((e) => JSON.stringify(e).includes("h1")), false, "nothing about helpers reaches the ledger");

    cli(["open", "--resume", s.sid, "--no-open"]);
    assert.equal(readState(s.session).helpers.length, 2, "a resume with no --workflow keeps them");
    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "implement"]);
    assert.equal(readState(s.session).helpers.length, 2, "a resume into the same workflow keeps them");

    // A finish is refused while a helper still shows as running, so the pause settles them.
    assert.equal(
      postPatch(s, { helpers: [reportedHelper("h1", { state: "done" }), reportedHelper("h2", { state: "failed" })], finish: { headline: "Paused at Task 2" } }).status,
      0
    );
    cli(["open", "--resume", s.sid, "--no-open"]);
    const resumed = readState(s.session);
    assert.equal("finish" in resumed, false, "the pause came down");
    assert.equal(resumed.helpers.length, 2, "taking a pause down keeps them");

    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "dashboard"]);
    assert.equal("helpers" in readState(s.session), false, "the hop to the dashboard drops them");
    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "implement"]);
    assert.equal("helpers" in readState(s.session), false, "and the hop back brings none");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("meter: a repeated run counts once, a bad one appends nothing, and neither reaches state.json", async () => {
  const s = openSession();
  try {
    const points = () => meterView(readLedger(s.session)).points;
    assert.equal(points(), 0, "a pathfinder launch scores only through its runs");
    assert.equal(postPatch(s, { run: { event: "pathfinder-chart", id: "chart" } }).status, 0);
    assert.equal(postPatch(s, { run: { event: "pathfinder-chart", id: "chart" }, agent: { status: "waiting" } }).status, 0);
    assert.equal(points(), 2, "the same run posted twice counts once");
    assert.ok(readLedger(s.session).some((e) => e.kind === "run" && e.id === "L1:chart" && e.workflow === "pathfinder"));

    const before = readLedger(s.session).length;
    const unknown = postPatch(s, { run: { event: "nap", id: "x" } }, { expectFail: true });
    assert.equal(unknown.status, 3);
    assert.match(unknown.stderr, /run: unknown event "nap"/);
    const noId = postPatch(s, { run: { event: "plan" } }, { expectFail: true });
    assert.equal(noId.status, 3);
    assert.match(noId.stderr, /run: id required/);
    const badTasks = postPatch(s, { run: { event: "implement-phase", id: "phase-1", tasks: 0 } }, { expectFail: true });
    assert.equal(badTasks.status, 3);
    assert.match(badTasks.stderr, /run: tasks must be a whole number/);
    const strayTasks = postPatch(s, { run: { event: "plan", id: "p", tasks: 4 } }, { expectFail: true });
    assert.equal(strayTasks.status, 3);
    assert.match(strayTasks.stderr, /run: tasks only goes with/);
    const badIssue = postPatch(s, { folderIssue: { name: "docs" } }, { expectFail: true });
    assert.equal(badIssue.status, 3);
    const bait = postPatch(s, { folderIssue: { name: "docs", reason: "TASK_COMPLETE" } }, { expectFail: true });
    assert.equal(bait.status, 3);
    const badState = postPatch(s, { run: { event: "plan", id: "p" }, items: [{ id: "q1", title: "grilling" }] }, { expectFail: true });
    assert.equal(badState.status, 3, "a patch the state rejects appends nothing either");
    assert.equal(readLedger(s.session).length, before, "rejected posts appended nothing");

    assert.equal(postPatch(s, { run: { event: "implement-phase", id: "phase-1", tasks: 7 } }).status, 0);
    assert.ok(readLedger(s.session).some((e) => e.id === "L1:phase-1" && e.tasks === 7), "tasks reach the ledger");
    assert.equal(points(), 5, "a 7-task phase adds 3");

    const state = readState(s.session);
    assert.equal("run" in state, false);
    assert.equal("folderIssue" in state, false);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("meter: open --file takes run and folderIssue as post does, scoped to the new launch, never into state.json", () => {
  const good = cli([
    "open",
    "--no-open",
    "--workflow",
    "pathfinder",
    "--file",
    payload("open-run.json", { run: { event: "pathfinder-chart", id: "chart" }, folderIssue: { name: "docs", reason: "denied" } }),
  ]);
  try {
    const ledger = readLedger(good.json.session);
    assert.deepEqual(
      ledger.map((e) => [e.kind, e.id]),
      [["launch", "L1"], ["run", "L1:chart"], ["folder-issue", "L1:docs"]]
    );
    assert.equal(meterView(ledger).points, 2);
    const state = readState(good.json.session);
    assert.equal("run" in state, false);
    assert.equal("folderIssue" in state, false);
  } finally {
    cli(["stop", "--session", good.json.sid]);
  }
  const bad = cli(["open", "--no-open", "--file", payload("open-run-bad.json", { run: { event: "nap", id: "x" } })], { expectFail: true });
  assert.equal(bad.status, 3);
  assert.match(bad.stderr, /run: unknown event "nap"/);
});

test("meter: a folder issue shows in the frame's workspace.issues until the next launch", async () => {
  const s = consoleSession(["--workflow", "pathfinder"]);
  try {
    assert.equal(postPatch(s, { folderIssue: { name: "docs", reason: "permission denied" } }).status, 0);
    assert.equal(postPatch(s, { folderIssue: { name: "docs", reason: "still denied", hint: "run /add-dir" } }).status, 0);
    const issue = [{ name: "docs", reason: "still denied", hint: "run /add-dir" }];
    assert.deepEqual((await s.get("/workspace")).issues, issue, "the latest report per folder");
    assert.deepEqual((await s.get("/state")).workspace.issues, issue);

    cli(["open", "--resume", s.sid, "--no-open", "--workflow", "implement"]);
    assert.deepEqual((await s.get("/workspace")).issues, [], "a new skill run starts clean");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

/* ------------------------------------------- review fixes: two writers, one page */

// Browsers scope a cookie by host and ignore the port. With one shared name,
// the second session's link overwrote the first session's token, and the
// first tab got nothing but 403s from then on.
test("two sessions keep their own cookies: each server reads only the one named for its port", async () => {
  const a = openSession();
  const b = openSession();
  try {
    for (const s of [a, b]) {
      const token = s.url.match(/\/s\/([^/]+)\//)[1];
      const res = await fetch(s.url, { redirect: "manual" });
      assert.ok(res.headers.get("set-cookie").startsWith(`${cookieFor(s.base, token)};`));
    }
    // What a browser holding both sends to either server.
    const both = `${a.cookie}; ${b.cookie}`;
    for (const s of [a, b]) {
      assert.equal((await fetch(`${s.base}/state`, { headers: { cookie: both, connection: "close" } })).status, 200);
    }
    // The old shared name is no longer a key to anything.
    const aToken = a.url.match(/\/s\/([^/]+)\//)[1];
    const shared = await fetch(`${a.base}/state`, { headers: { cookie: `p2c_console=${aToken}`, connection: "close" } });
    assert.equal(shared.status, 403);
    // Another session's cookie opens nothing here either.
    const crossed = b.cookie.replace(/^p2c_console_\d+/, `p2c_console_${new URL(a.base).port}`);
    assert.equal((await fetch(`${a.base}/state`, { headers: { cookie: crossed, connection: "close" } })).status, 403);
  } finally {
    cli(["stop", "--session", a.sid]);
    cli(["stop", "--session", b.sid]);
  }
});

// state.json has two writers, `post` and the server's /submit. Both are held
// at the lock here until each has read nothing yet, then let go together:
// whichever writes second must be building on the first one's write.
test("a post and a submit that overlap both survive: the state lock serialises them", async () => {
  const s = openSession();
  try {
    const lock = path.join(s.session, STATE_LOCK_FILE);
    fs.writeFileSync(lock, String(process.pid));
    const patchFile = payload(`overlap-${Date.now()}.json`, {
      items: [{ id: "q2", kind: "text", title: "Team name", required: false }],
      agent: { status: "waiting", activity: "Asking about the team" },
    });
    const posting = new Promise((resolve) => {
      const child = spawn(process.execPath, [CONSOLE_CLI, "post", "--session", s.sid, "--file", patchFile], { env: ENV, cwd: ROOT });
      let err = "";
      child.stderr.on("data", (c) => (err += c));
      child.on("exit", (code) => resolve({ code, err }));
    });
    const submitting = s.send("/submit", EXPORT_A);
    await sleep(400);
    assert.ok(fs.existsSync(lock), "nobody broke a live, young lock");
    fs.rmSync(lock);
    const [posted, submitted] = await Promise.all([posting, submitting]);
    assert.equal(posted.code, 0, posted.err);
    assert.equal(submitted.status, 200);

    const state = readState(s.session);
    const q1 = state.items.find((i) => i.id === "q1");
    assert.ok(state.items.some((i) => i.id === "q2"), "the post's new question is kept");
    assert.equal(state.agent.activity, "Asking about the team");
    assert.equal(q1.submitted && q1.submitted.k, "A", "the send's record is kept");
    assert.equal(state.phase, "submitted");
    assert.equal(fs.existsSync(lock), false, "and the lock is let go");
    assert.equal(cli(["wait", "--session", s.sid, "--seconds", "5"]).status, 0);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a lock left by a writer that died is broken rather than waited on for good", () => {
  const s = openSession();
  try {
    const lock = path.join(s.session, STATE_LOCK_FILE);
    // A pid no process has: the holder is gone.
    fs.writeFileSync(lock, "999999999");
    const res = postPatch(s, { agent: { status: "working" } });
    assert.equal(res.status, 0, res.stderr);
    assert.equal(readState(s.session).agent.status, "working");
    assert.equal(fs.existsSync(lock), false);
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

// A young handle and a live pid are what a server that died a minute ago
// leaves behind for any process to inherit. Only /health is proof.
test("stop never kills a live process that does not answer /health as ours", () => {
  const bystander = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const sidForged = "20000101-000000-beef01";
  // Under the test home, as the CLI sees it: this process has no override of
  // its own, and files.mjs would name the real runtime dir.
  const dir = path.join(HOME, "runtime", cwdHash(repoRoots(ROOT).project));
  fs.mkdirSync(dir, { recursive: true });
  const forged = path.join(dir, `${sidForged}.json`);
  try {
    fs.writeFileSync(
      forged,
      JSON.stringify({ v: 1, sid: sidForged, pid: bystander.pid, port: 1, url: "http://127.0.0.1:1/", startedAt: new Date().toISOString() })
    );
    const res = cli(["stop", "--session", sidForged]);
    assert.equal(res.json.stopped, 0);
    assert.equal(res.json.skippedStaleHandles, 1);
    assert.equal(fs.existsSync(forged), false, "the handle goes");
    assert.doesNotThrow(() => process.kill(bystander.pid, 0), "the process stays");
  } finally {
    bystander.kill();
    fs.rmSync(forged, { force: true });
  }
});

// A fresh `open` starts the server before it writes the state. The server used
// to seed workspace.json at boot from the folder holding .git, which for a
// linked worktree is the main checkout.
test("open from a linked worktree seeds the workspace with the worktree, not the main checkout", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-wt-"));
  const repo = path.join(base, "repo");
  const wt = path.join(base, "wt");
  fs.mkdirSync(repo);
  const git = (cwd, ...a) => execFileSync("git", a, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  git(repo, "init", "-q");
  git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "x");
  git(repo, "worktree", "add", "-q", wt);
  const { worktree, project } = repoRoots(wt);
  assert.notEqual(worktree, project);
  let sidOpened = null;
  try {
    const res = cliIn(wt, ["open", "--workflow", "plan", "--no-open"]);
    sidOpened = res.json.sid;
    assert.deepEqual(res.json.workspace.folders.map((f) => f.path), [worktree]);
    const onDisk = JSON.parse(fs.readFileSync(path.join(res.json.session, WORKSPACE_FILE), "utf8"));
    assert.deepEqual(onDisk.folders.map((f) => f.path), [worktree], "workspace.json names the worktree");
  } finally {
    if (sidOpened) cliIn(wt, ["stop", "--session", sidOpened]);
    // A stopped server can take a while to let go of its working directory on
    // Windows, and longer while other test files load the machine: under a
    // full-suite run this needed more than the 5s a 20x250ms retry gave it.
    fs.rmSync(base, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 });
  }
});

/* ------------------------------------------- review fixes: the CLI's edges */

test("validate refuses a text pattern that does not compile, and post exits 3 on it", () => {
  const item = (pattern) => ({ items: [{ id: "t1", kind: "text", title: "Ticket number", pattern }] });
  assert.deepEqual(validate(item("^[A-Z]+-\\d+$")), []);
  assert.match(validate(item("([")).join("\n"), /"pattern" is not a valid JavaScript regular expression/);
  assert.match(validate(item(7)).join("\n"), /"pattern" must be a string/);

  const s = openSession();
  try {
    const before = fs.readFileSync(path.join(s.session, "state.json"), "utf8");
    const bad = postPatch(s, { items: [{ id: "t1", kind: "text", title: "Ticket number", pattern: "([", required: false }] }, { expectFail: true });
    assert.equal(bad.status, 3);
    assert.match(bad.stderr, /pattern/);
    assert.equal(fs.readFileSync(path.join(s.session, "state.json"), "utf8"), before, "nothing was written");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("a flag that needs a value and has none is bad usage, exit 2, never a crash", () => {
  for (const argv of [
    ["open", "--resume"],
    ["open", "--session", "--no-open"],
    ["wait", "--session"],
    ["post", "--session", "20260101-000000-abcdef", "--file"],
    ["keep", "--session", "20260101-000000-abcdef", "--upload", "x", "--name", "--spec", "specs/x"],
    ["status", "--session"],
    ["stop", "--session"],
  ]) {
    const res = cli(argv, { expectFail: true });
    assert.equal(res.status, 2, argv.join(" "));
    assert.match(res.stderr, /needs a value/, argv.join(" "));
    assert.doesNotMatch(res.stderr, /TypeError|at .*\.mjs/, argv.join(" "));
  }
});

test("wait reads --seconds 6s as six seconds, not as nothing", () => {
  const s = openSession();
  try {
    const t0 = Date.now();
    const res = cli(["wait", "--session", s.sid, "--seconds", "6s"]);
    assert.equal(res.status, 10);
    assert.ok(Date.now() - t0 >= 5000, "the slice ran its length");
  } finally {
    cli(["stop", "--session", s.sid]);
  }
});

test("only open leaves the console-dir pointer; status, help and a bad command do not", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-pointer-"));
  const env = { PLAN2CODE_CONSOLE_HOME: home, PLAN2CODE_MODELS_DIR: path.join(home, "plan2code") };
  const pointer = path.join(home, "console-dir");
  fs.writeFileSync(path.join(home, "update-check.json"), JSON.stringify({ checkedAt: Date.now(), latest: null }));
  try {
    cli(["status"], { env });
    cli(["help"], { env });
    const usage = cli(["nope"], { env, expectFail: true });
    assert.match(usage.stderr, /keep/, "the usage line names every command");
    assert.equal(fs.existsSync(pointer), false);
    const opened = cli(["open", "--no-open"], { env });
    assert.equal(fs.readFileSync(pointer, "utf8").trim(), path.join(ROOT, "src", "web-console"));
    cli(["stop", "--session", opened.json.sid], { env });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
});

/* ------------------------------------------- review fixes: the Origin guard */

// Every route that changes something refuses a foreign Origin before it reads
// a byte of the body. /workspace/browse is the one that could open a native
// dialog; the echo stands in for it, so a guard that failed would answer 200
// here rather than put a picker on the screen.
test("every state-changing route refuses a foreign Origin, and nothing changes", async () => {
  const picked = tempFolder();
  const s = consoleSession(["--workflow", "plan", "--file", payload(`origin-${Date.now()}.json`, BASE)], {
    env: { PLAN2CODE_PICKER_ECHO: picked },
  });
  const files = ["state.json", "result.json", "draft.json", WORKSPACE_FILE, "chat.ndjson"];
  const snapshot = () =>
    Object.fromEntries(
      [...files.map((f) => path.join(s.session, f)), path.join(HOME, "looks.json")].map((f) => [
        f,
        fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null,
      ])
    );
  const routes = [
    ["POST", "/submit", EXPORT_A],
    ["POST", "/cancel", {}],
    ["POST", "/chat", { text: "Why CSV?", conversation: 1 }],
    ["POST", "/chat/decision", { re: "r1", decision: "approve", conversation: 1 }],
    ["POST", "/draft", { staged: { q1: { k: "B" } } }],
    ["POST", "/looks", { looks: { theme: "light" } }],
    ["POST", "/models", { models: { devin: [{ id: "x" }] } }],
    ["POST", "/workspace/add", { path: picked }],
    ["POST", "/workspace/edit", { id: "f0", name: "renamed" }],
    ["POST", "/workspace/remove", { id: "f0" }],
    ["POST", "/workspace/browse", {}],
    ["POST", "/bye", {}],
    ["POST", "/upload", null],
    ["DELETE", "/uploads/00000000-0000-0000-0000-000000000000.jpg", null],
  ];
  try {
    await s.get("/workspace");
    const before = snapshot();
    for (const [method, route, body] of routes) {
      const res = await fetch(`${s.base}${route}`, {
        method,
        headers: { "content-type": "application/json", cookie: s.cookie, origin: "http://evil.example.com", connection: "close" },
        body: body === null ? undefined : JSON.stringify(body),
      });
      assert.equal(res.status, 403, `${method} ${route}`);
    }
    assert.deepEqual(snapshot(), before, "no file moved");
    // And the same requests from the page's own origin do get through, so the
    // 403s above are the guard and not something else.
    const own = await fetch(`${s.base}/workspace/browse`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, origin: s.base, connection: "close" },
      body: "{}",
    });
    assert.equal(own.status, 200);
    assert.deepEqual(await own.json(), { path: picked });
  } finally {
    cli(["stop", "--session", s.sid]);
    fs.rmSync(picked, { recursive: true, force: true });
  }
});
