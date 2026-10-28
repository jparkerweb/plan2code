// Web console tests: the desktop app's in-app signal for `open`. Under the app
// (PLAN2CODE_IN_APP=1) `open` never launches a browser, reuses the app's
// session and tells the app's announce URL which page to show; with the
// variable unset it behaves as it always did. Shared setup:
// ./web-console-test-helpers.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { CONSOLE_CLI, ENV, HOME, cli, until } from "./web-console-test-helpers.mjs";
import { openSession, pageSuite } from "./page-test-helpers.mjs";
import { announcePage, inAppSignal } from "../src/web-console/in-app.mjs";

// A stand-in for the app's announce endpoint: records every POST it accepts.
// `current` is the session the window shows now: what `GET /session` answers.
async function announceServer(token, current = null) {
  const seen = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      if (req.headers["x-plan2code-token"] !== token) {
        res.writeHead(403).end();
        return;
      }
      if (req.method === "GET" && req.url === "/session") {
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(current));
        return;
      }
      seen.push(JSON.parse(body));
      res.writeHead(204).end();
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { seen, url: `http://127.0.0.1:${server.address().port}/page`, close: () => server.close() };
}

// `open` run asynchronously (the announce server lives in this process, so a
// blocking spawn would deadlock). Resolves { status, json }.
function openAsync(args, { cwd, env }) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CONSOLE_CLI, ...args], { cwd, env: { ...ENV, ...env }, windowsHide: true });
    let out = "";
    child.stdout.on("data", (c) => (out += c));
    child.on("close", (status) => {
      const line = out.trim().split("\n").filter((l) => l.startsWith("{")).pop();
      resolve({ status, json: line ? JSON.parse(line) : null });
    });
  });
}

function project(name) {
  const dir = fs.mkdtempSync(path.join(HOME, `${name}-`));
  return dir;
}

// A browser stand-in: PLAN2CODE_BROWSER runs this with the link appended.
function browserRecorder() {
  const log = path.join(HOME, `browser-${Date.now()}-${Math.random().toString(16).slice(2)}.log`);
  const script = path.join(HOME, `record-${path.basename(log)}.mjs`);
  fs.writeFileSync(script, `import fs from "node:fs"; fs.appendFileSync(${JSON.stringify(log)}, process.argv[2] + "\\n");`);
  const command = `"${process.execPath}" "${script}"`;
  return { command, calls: () => (fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : []) };
}

const withBrowser = (recorder) => {
  const env = { PLAN2CODE_BROWSER: recorder.command, PLAN2CODE_NO_BROWSER: "" };
  return env;
};

test("inAppSignal is null unless PLAN2CODE_IN_APP is 1", () => {
  assert.equal(inAppSignal({}), null);
  assert.equal(inAppSignal({ PLAN2CODE_IN_APP: "0" }), null);
  assert.deepEqual(
    inAppSignal({ PLAN2CODE_IN_APP: "1", PLAN2CODE_CONSOLE_SID: "s", PLAN2CODE_APP_ANNOUNCE: "http://127.0.0.1:1/x", PLAN2CODE_APP_TOKEN: "t" }),
    { sid: "s", announce: "http://127.0.0.1:1/x", token: "t" }
  );
});

test("announcePage sends the token, and fails quietly on a wrong token, a dead port and a non-loopback host", async () => {
  const app = await announceServer("good");
  try {
    assert.equal(await announcePage({ announce: app.url, token: "good" }, { url: "u" }), true);
    assert.deepEqual(app.seen, [{ url: "u" }]);
    assert.equal(await announcePage({ announce: app.url, token: "bad" }, { url: "u" }), false);
    assert.equal(await announcePage({ announce: "http://127.0.0.1:1/x", token: "t" }, { url: "u" }), false);
    assert.equal(await announcePage({ announce: "http://example.com/x", token: "t" }, { url: "u" }), false);
    assert.equal(await announcePage({ announce: "not a url", token: "t" }, { url: "u" }), false);
  } finally {
    app.close();
  }
});

test("under the app, open reuses the app's session, announces the page and launches no browser", async () => {
  const cwd = project("inapp");
  const first = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd });
  const appSid = first.json.sid;
  const app = await announceServer("tok", { sid: appSid, url: first.json.url, workflow: "dashboard" });
  const browser = browserRecorder();
  try {
    const res = await openAsync(["open", "--workflow", "dashboard"], {
      cwd,
      env: {
        ...withBrowser(browser),
        PLAN2CODE_IN_APP: "1",
        PLAN2CODE_APP_ANNOUNCE: app.url,
        PLAN2CODE_APP_TOKEN: "tok",
      },
    });
    assert.equal(res.status, 0);
    assert.equal(res.json.sid, appSid, "the window's own session is reused, not a second console");
    assert.equal(res.json.reused, true);
    assert.equal(res.json.inApp, true);
    assert.equal(res.json.announced, true);
    assert.equal(app.seen.length, 1);
    assert.equal(app.seen[0].sid, appSid);
    assert.equal(app.seen[0].url, first.json.url);
    assert.equal(app.seen[0].workflow, "dashboard");
    await new Promise((r) => setTimeout(r, 700));
    assert.deepEqual(browser.calls(), [], "no browser is launched under the app");
  } finally {
    app.close();
    cli(["stop", "--session", appSid], { cwd, expectFail: true });
  }
});

test("under the app, a hop on the app's session keeps the same url and reports the new workflow", async () => {
  const cwd = project("inapp-hop");
  const first = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd });
  const app = await announceServer("tok", { sid: first.json.sid, url: first.json.url, workflow: "dashboard" });
  try {
    const res = await openAsync(["open", "--workflow", "pathfinder"], {
      cwd,
      env: { PLAN2CODE_IN_APP: "1", PLAN2CODE_APP_ANNOUNCE: app.url, PLAN2CODE_APP_TOKEN: "tok" },
    });
    assert.equal(res.json.url, first.json.url);
    assert.equal(app.seen[0].workflow, "pathfinder");
  } finally {
    app.close();
    cli(["stop", "--session", first.json.sid], { cwd, expectFail: true });
  }
});

test("under the app, a wrong token is reported and the page is not sent to a browser", async () => {
  const cwd = project("inapp-bad");
  const first = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd });
  const app = await announceServer("right");
  const browser = browserRecorder();
  try {
    const res = await openAsync(["open", "--workflow", "dashboard"], {
      cwd,
      env: {
        ...withBrowser(browser),
        PLAN2CODE_IN_APP: "1",
        PLAN2CODE_CONSOLE_SID: first.json.sid,
        PLAN2CODE_APP_ANNOUNCE: app.url,
        PLAN2CODE_APP_TOKEN: "wrong",
      },
    });
    assert.equal(res.json.inApp, true);
    assert.equal(res.json.announced, false);
    assert.equal(app.seen.length, 0);
    await new Promise((r) => setTimeout(r, 700));
    assert.deepEqual(browser.calls(), []);
  } finally {
    app.close();
    cli(["stop", "--session", first.json.sid], { cwd, expectFail: true });
  }
});

test("under the app, a session that is gone gets a fresh one and its address announced", async () => {
  const cwd = project("inapp-gone");
  const app = await announceServer("tok");
  try {
    const res = await openAsync(["open", "--workflow", "dashboard"], {
      cwd,
      env: { PLAN2CODE_IN_APP: "1", PLAN2CODE_CONSOLE_SID: "20200101-000000-nothere", PLAN2CODE_APP_ANNOUNCE: app.url, PLAN2CODE_APP_TOKEN: "tok" },
    });
    assert.equal(res.status, 0);
    assert.notEqual(res.json.sid, "20200101-000000-nothere");
    assert.equal(app.seen[0].url, res.json.url);
    cli(["stop", "--session", res.json.sid], { cwd, expectFail: true });
  } finally {
    app.close();
  }
});

test("two app windows never receive each other's pages", async () => {
  const cwdA = project("win-a");
  const cwdB = project("win-b");
  const a = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd: cwdA });
  const b = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd: cwdB });
  const appA = await announceServer("ta", { sid: a.json.sid, url: a.json.url, workflow: "dashboard" });
  const appB = await announceServer("tb", { sid: b.json.sid, url: b.json.url, workflow: "dashboard" });
  try {
    const envFor = (r, app, token) => ({ PLAN2CODE_IN_APP: "1", PLAN2CODE_APP_ANNOUNCE: app.url, PLAN2CODE_APP_TOKEN: token });
    await openAsync(["open", "--workflow", "plan"], { cwd: cwdA, env: envFor(a, appA, "ta") });
    await openAsync(["open", "--workflow", "quick-task"], { cwd: cwdB, env: envFor(b, appB, "tb") });
    assert.deepEqual(appA.seen.map((p) => [p.sid, p.workflow]), [[a.json.sid, "plan"]]);
    assert.deepEqual(appB.seen.map((p) => [p.sid, p.workflow]), [[b.json.sid, "quick-task"]]);
  } finally {
    appA.close();
    appB.close();
    cli(["stop", "--session", a.json.sid], { cwd: cwdA, expectFail: true });
    cli(["stop", "--session", b.json.sid], { cwd: cwdB, expectFail: true });
  }
});

test("without the signal, open still launches the browser and reports nothing about an app", async () => {
  const cwd = project("bare");
  const browser = browserRecorder();
  const res = await openAsync(["open", "--workflow", "dashboard"], { cwd, env: withBrowser(browser) });
  try {
    assert.equal(res.status, 0);
    assert.equal(res.json.inApp, undefined);
    assert.equal(res.json.announced, undefined);
    let calls = [];
    for (let i = 0; i < 30 && calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 100));
      calls = browser.calls();
    }
    assert.ok(calls.length >= 1, "the browser command ran");
    assert.match(calls[0], /^http:\/\/127\.0\.0\.1:\d+\/s\//);
  } finally {
    cli(["stop", "--session", res.json.sid], { cwd, expectFail: true });
  }
});

test("the window's session, not the environment's, decides what open resumes", async () => {
  const cwd = project("inapp-ask");
  const stale = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd });
  const live = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd });
  const app = await announceServer("tok", { sid: live.json.sid, url: live.json.url, workflow: "dashboard" });
  try {
    const res = await openAsync(["open", "--workflow", "plan"], {
      cwd,
      env: { PLAN2CODE_IN_APP: "1", PLAN2CODE_CONSOLE_SID: stale.json.sid, PLAN2CODE_APP_ANNOUNCE: app.url, PLAN2CODE_APP_TOKEN: "tok" },
    });
    assert.equal(res.json.sid, live.json.sid);
    assert.equal(app.seen[0].sid, live.json.sid);
  } finally {
    app.close();
    cli(["stop", "--session", stale.json.sid], { cwd, expectFail: true });
    cli(["stop", "--session", live.json.sid], { cwd, expectFail: true });
  }
});

test("with nothing shown in the window yet, open makes the first session and announces it", async () => {
  const cwd = project("inapp-first");
  const app = await announceServer("tok", null);
  const browser = browserRecorder();
  try {
    const res = await openAsync(["open", "--workflow", "dashboard"], {
      cwd,
      env: { ...withBrowser(browser), PLAN2CODE_IN_APP: "1", PLAN2CODE_APP_ANNOUNCE: app.url, PLAN2CODE_APP_TOKEN: "tok" },
    });
    assert.equal(res.status, 0);
    assert.equal(res.json.announced, true);
    assert.equal(app.seen.length, 1);
    assert.equal(app.seen[0].sid, res.json.sid);
    assert.equal(app.seen[0].url, res.json.url);
    await new Promise((r) => setTimeout(r, 700));
    assert.deepEqual(browser.calls(), [], "the first page goes to the app too, not a browser");
    cli(["stop", "--session", res.json.sid], { cwd, expectFail: true });
  } finally {
    app.close();
  }
});

// The page inside the app's frame: the taskbar's two messages. Driven in a
// real browser (page-test-helpers.mjs), with a parent that keeps every
// message posted to it.
const pages = pageSuite(test);
const FAKE_APP_FRAME = () => {
  window.__toApp = [];
  Object.defineProperty(window, "parent", { configurable: true, get: () => ({ postMessage: (m) => window.__toApp.push(m) }) });
};
const toApp = (s, kind) => s.page.evaluate((k) => window.__toApp.filter((m) => m.plan2code === k), kind);
const ASKING = { items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name." }], agent: { status: "waiting" } };

test("framed, the page tells the app its state once per change, never on a redraw, and plain when it goes away", async (t) => {
  const s = await openSession(await pages.browser(), { t, workflow: "implement", clock: true, payload: ASKING, env: { PLAN2CODE_IN_APP: "1" }, init: FAKE_APP_FRAME });
  await until(async () => (await toApp(s, "attention")).length >= 1, 5000);
  assert.deepEqual((await toApp(s, "attention")).at(-1), { plan2code: "attention", state: "ready" }, "a question waiting is the person's move, as a named request");
  const before = (await toApp(s, "attention")).length;
  await s.page.clock.fastForward(5_000);
  assert.equal((await toApp(s, "attention")).length, before, "the status line's tick redraws without telling the app again");

  s.post({ settle: true, items: [{ id: "q1", status: "answered", answer: { text: "x" } }], agent: { status: "working", activity: "Task 1 of 2" } });
  await until(async () => (await toApp(s, "attention")).at(-1).state !== "ready", 5000);
  const states = (await toApp(s, "attention")).map((m) => m.state);
  assert.ok(states.every((state) => ["busy", "ready", "attention", "plain"].includes(state)), states.join(", "));
  assert.ok(states.every((state, i) => i === 0 || state !== states[i - 1]), `no state is told twice in a row: ${states.join(", ")}`);

  await s.page.evaluate(() => dispatchEvent(new Event("pagehide")));
  assert.deepEqual((await toApp(s, "attention")).at(-1), { plan2code: "attention", state: "plain" });
});

test("framed, a finished screen with a button still to press is the person's move; one with nothing left is plain", async (t) => {
  const browser = await pages.browser();
  const last = async (s) => (await toApp(s, "attention")).at(-1)?.state;
  // The finished screen that waits on a press once told the app plain, so the
  // taskbar showed no dot while the person was needed.
  // Both start busy, so the state read after the finish's line shows is the
  // finish's own (the line and the message come from the same redraw).
  const WORKING = { agent: { status: "working", activity: "Task 1 of 2" } };
  const offered = await openSession(browser, { t, workflow: "quick-task", payload: WORKING, env: { PLAN2CODE_IN_APP: "1" }, init: FAKE_APP_FRAME });
  await until(async () => (await last(offered)) === "busy", 5000);
  offered.post({ finish: { headline: "Quick task done", command: "git add -A && git commit -m x -m y", dashboard: true } });
  await until(async () => (await offered.page.locator("#agent-text").textContent()).includes("Head back to the dashboard"), 5000);
  assert.equal(await last(offered), "ready", "a finish offering the dashboard is the person's move");

  const paused = await openSession(browser, { t, workflow: "implement", payload: WORKING, env: { PLAN2CODE_IN_APP: "1" }, init: FAKE_APP_FRAME });
  await until(async () => (await last(paused)) === "busy", 5000);
  paused.post({ finish: { headline: "Paused at Phase 2", command: "/plan2code-3-implement specs/audit-export/overview.md" } });
  await until(async () => (await paused.page.locator("#agent-text").textContent()).startsWith("Paused"), 5000);
  assert.equal(await last(paused), "plain", "a paused finish has nothing left to press");
});

test("the Desktop app group shows only in the app's frame, reflects the app's saved switch and tells the app when it changes", async (t) => {
  const browser = await pages.browser();
  const plain = await openSession(browser, { t, workflow: "implement", payload: ASKING });
  await plain.page.locator("#btn-looks").click();
  assert.equal(await plain.page.locator("#looks-desktop").isVisible(), false, "not in a browser tab");

  const s = await openSession(browser, { t, workflow: "implement", payload: ASKING, env: { PLAN2CODE_IN_APP: "1" }, init: FAKE_APP_FRAME });
  await s.page.locator("#btn-looks").click();
  const box = s.page.locator("#looks-taskbar");
  assert.ok(await s.page.locator("#looks-desktop").isVisible(), "shown inside the app");
  assert.ok(await box.isChecked(), "on until the app says otherwise");

  // The app's answer to the page's hello, from a real window standing in as
  // the parent. The same answer from anywhere else is ignored.
  await s.page.evaluate(() => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const app = frame.contentWindow;
    app.postMessage = (m) => window.__toApp.push(m);
    Object.defineProperty(window, "parent", { configurable: true, get: () => app });
    window.__app = app;
    dispatchEvent(new MessageEvent("message", { data: { plan2code: "taskbar-state", on: false }, source: window }));
  });
  assert.equal(await box.isChecked(), true, "a taskbar-state from anywhere but the parent changes nothing");
  await s.page.evaluate(() => {
    dispatchEvent(new MessageEvent("message", { data: { plan2code: "taskbar-state", on: false }, source: window.__app }));
  });
  assert.equal(await box.isChecked(), false, "the parent's saved value");

  await box.check();
  assert.deepEqual(await toApp(s, "taskbar"), [{ plan2code: "taskbar", on: true }], "a named request with one boolean");
});
