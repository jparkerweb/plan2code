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
import { CONSOLE_CLI, ENV, HOME, cli } from "./web-console-test-helpers.mjs";
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
