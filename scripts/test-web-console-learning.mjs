// Web console tests, Learning on the server: the dashboard scan's `learning`
// field, Pause for me (`POST /learning/pause`) and the two read-only routes
// (`GET /learning/state`, `GET /learning/lessons`). Run with:
// node --test scripts/test-web-console-learning.mjs
//
// Each session opens in a throwaway project folder, so the repository this runs
// in is never read or written. Learning's store on this machine is the test
// home's (PLAN2CODE_LEARNING_DIR, set by web-console-test-helpers.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { ENV, HOME, LEARNING_DIR, ROOT, cli, postPatch, readState, sessionUrl } from "./web-console-test-helpers.mjs";
import { learningScan, storeDir, writePause, writeWaiting } from "../src/web-console/learning.mjs";
import { sessionActions } from "../src/web-console/cmd-post-wait.mjs";
import { indentReply, learningAction, learningBannerText, learningReply, lessonsReply } from "../src/web-console/public/answers.js";

const LESSONS = path.join(ROOT, "src", "skill-scripts", "lessons.mjs");

let projects = 0;
function project(files = {}) {
  const dir = path.join(HOME, "learning-projects", `p${++projects}`);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
  return fs.realpathSync(dir);
}

const SETTINGS = (learning) => ({ ".plan2code/settings.json": JSON.stringify({ format: 1, learning }) + "\n" });

// Every file under a folder, relative, so a test can say nothing was written.
function listing(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(path.relative(dir, p).split(path.sep).join("/"));
    }
  };
  walk(dir);
  return out.sort();
}

// A dashboard session opened from `dir`, the way an agent opens one.
function dashboard(t, dir) {
  const opened = cli(["open", "--workflow", "dashboard", "--no-open"], { cwd: dir }).json;
  const s = { ...opened, ...sessionUrl(opened.url) };
  s.post = (pathname, body, headers = {}) =>
    fetch(`${s.base}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, connection: "close", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body ?? {}),
    });
  s.get = (pathname) => fetch(`${s.base}${pathname}`, { headers: { cookie: s.cookie, connection: "close" } });
  t.after(() => cli(["stop", "--session", s.sid, "--force"], { cwd: dir }));
  return s;
}

/* ------------------------------------------------------------ the scan */

test("scan.learning: not set up, off, on and paused, with the waiting count", (t) => {
  const none = project();
  const s1 = dashboard(t, none);
  assert.deepEqual(readState(s1.session).scan.learning, { state: "not-set-up", pausedSince: null, waiting: 0, oldestDays: 0 });

  const off = project(SETTINGS("off"));
  assert.equal(readState(dashboard(t, off).session).scan.learning.state, "off");

  const on = project(SETTINGS("on"));
  const noted = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 - 60000).toISOString();
  writeWaiting(on, { id: "20261111-120000-abcdef", type: "lesson", text: "A lesson.", noted });
  writeWaiting(on, { id: "20261112-120000-abcdef", type: "lesson", text: "Another.", noted: new Date().toISOString() });
  assert.deepEqual(readState(dashboard(t, on).session).scan.learning, { state: "on", pausedSince: null, waiting: 2, oldestDays: 2 });

  const paused = project(SETTINGS("on"));
  const pause = writePause(paused, true, "2026-11-13T09:00:00.000Z");
  const scan = readState(dashboard(t, paused).session).scan.learning;
  assert.equal(scan.state, "paused");
  assert.equal(scan.pausedSince, pause.since);
});

test("scan.learning is absent for a settings format this console does not know", (t) => {
  const dir = project({ ".plan2code/settings.json": JSON.stringify({ format: 99, learning: "on" }) });
  const scan = readState(dashboard(t, dir).session).scan;
  assert.ok(scan, "the dashboard still scans");
  assert.equal("learning" in scan, false, "no learning field, so the page draws no row");
});

test("a failure in Learning's core never fails the scan", () => {
  const boom = () => {
    throw new Error("the core broke");
  };
  assert.equal(learningScan(project(), { read: boom }), null);
  assert.equal(learningScan(project(), { read: () => ({ state: "unknown", waiting: { count: 1 } }) }), null);
});

test("an unreadable learning store reads as empty: on, not paused, nothing waiting", (t) => {
  // A file where the store's folder should be: every read under it fails, and
  // the core treats that as an empty store rather than throwing.
  const dir = project(SETTINGS("on"));
  const store = storeDir(dir);
  fs.mkdirSync(path.dirname(store), { recursive: true });
  fs.writeFileSync(store, "not a folder");
  t.after(() => fs.rmSync(store, { force: true }));
  const s = dashboard(t, dir);
  assert.deepEqual(readState(s.session).scan.learning, { state: "on", pausedSince: null, waiting: 0, oldestDays: 0 });
});

test("the scan reads without pruning: an old waiting item stays on disk", (t) => {
  const dir = project(SETTINGS("on"));
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  writeWaiting(dir, { id: "20261001-120000-aaaaaa", type: "lesson", text: "Old.", noted: old });
  const learning = readState(dashboard(t, dir).session).scan.learning;
  assert.equal(learning.waiting, 0, "an item past 30 days is not counted");
  assert.ok(fs.existsSync(path.join(storeDir(dir), "waiting", "20261001-120000-aaaaaa.json")), "the console deleted nothing");
});

/* ----------------------------------------------------------- the pause */

test("POST /learning/pause: a foreign Origin is 403 and a bad body is 400", async (t) => {
  const s = dashboard(t, project(SETTINGS("on")));
  assert.equal((await s.post("/learning/pause", { paused: true }, { origin: "http://evil.example" })).status, 403);
  assert.equal((await s.post("/learning/pause", "{not json")).status, 400);
  const bad = await s.post("/learning/pause", { paused: "yes" });
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "bad-request" });
});

test("POST /learning/pause is 409 when the project is not on", async (t) => {
  for (const files of [{}, SETTINGS("off")]) {
    const s = dashboard(t, project(files));
    const res = await s.post("/learning/pause", { paused: true });
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "not-on" });
  }
});

test("POST /learning/pause writes pause.json on this machine, nothing in the project, and patches the scan", async (t) => {
  const dir = project(SETTINGS("on"));
  const before = listing(dir);
  const s = dashboard(t, dir);
  const res = await s.post("/learning/pause", { paused: true });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.ok, true);
  assert.equal(body.learning.state, "paused");
  const pauseFile = path.join(storeDir(dir), "pause.json");
  assert.ok(pauseFile.startsWith(LEARNING_DIR), "the pause lives under the learning store");
  assert.equal(JSON.parse(fs.readFileSync(pauseFile, "utf8")).paused, true);
  assert.equal(readState(s.session).scan.learning.state, "paused", "the row repaints from the patched scan");
  assert.deepEqual(listing(dir), before, "nothing was written inside the project");

  const back = await (await s.post("/learning/pause", { paused: false })).json();
  assert.equal(back.learning.state, "on");
  assert.equal(fs.existsSync(pauseFile), false);
  assert.equal(readState(s.session).scan.learning.state, "on");
});

/* ------------------------------------------------------ the read routes */

test("GET /learning/state answers the scan's object, worked out now", async (t) => {
  const dir = project(SETTINGS("on"));
  const s = dashboard(t, dir);
  writeWaiting(dir, { id: "20261113-120000-bbbbbb", type: "lesson", text: "New.", noted: new Date().toISOString() });
  const res = await s.get("/learning/state");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { state: "on", pausedSince: null, waiting: 1, oldestDays: 0 });

  const unknown = dashboard(t, project({ ".plan2code/settings.json": "{}" }));
  assert.deepEqual(await (await unknown.get("/learning/state")).json(), {});
});

test("GET /learning/lessons: general first, then the rest by name; no sub-folders or links out", async (t) => {
  const dir = project({
    ...SETTINGS("on"),
    ".plan2code/lessons/web-console.md": "# Web console\n\nA lesson.\n",
    ".plan2code/lessons/general.md": "# General\n\nAnother.\n",
    ".plan2code/lessons/activities.md": "No heading here.\n",
    ".plan2code/lessons/notes.txt": "not markdown\n",
    ".plan2code/lessons/deeper/inside.md": "# Inside\n",
  });
  // A link pointing outside the folder is never followed.
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "p2c-learn-out-")), "secret.md");
  fs.writeFileSync(outside, "# Secret\n");
  let linked = true;
  try {
    fs.symlinkSync(outside, path.join(dir, ".plan2code", "lessons", "linked.md"), "file");
  } catch {
    linked = false; // Windows without the symlink right: the rest still holds
  }
  const s = dashboard(t, dir);
  const res = await s.get("/learning/lessons");
  assert.equal(res.status, 200);
  const { files } = await res.json();
  assert.deepEqual(
    files.map((f) => f.name),
    ["general.md", "activities.md", "web-console.md"]
  );
  assert.equal(files[0].title, "General");
  assert.equal(files[1].title, "activities", "no heading: the file's name");
  assert.match(files[2].text, /A lesson\./);
  if (linked) assert.equal(files.some((f) => f.name === "linked.md"), false, "the link out was not followed");

  const empty = dashboard(t, project(SETTINGS("on")));
  assert.deepEqual(await (await empty.get("/learning/lessons")).json(), { files: [] });
});

/* ------------------------------------------------- the action and reply */

test("a Learning action reaches the agent whole, and a launch keeps fromBanner", () => {
  for (const what of ["review", "switch-on", "switch-off", "move-log", "remove"]) {
    const action = learningAction(what);
    assert.deepEqual(action, { i: "__learning", type: "learning", do: what });
    assert.deepEqual(sessionActions({ actions: [action] }), [{ i: "__learning", do: what }]);
    assert.ok(learningReply(what).length > 0, `${what} has a reply`);
    assert.doesNotMatch(learningReply(what), /—/);
  }
  assert.throws(() => learningAction("delete-everything"));
  const launch = { i: "__launch", type: "launch", skill: "plan2code-quick-task", workflow: "quick-task", fromBanner: true };
  assert.equal(sessionActions({ actions: [launch] })[0].fromBanner, true);
});

test("the waiting banner's line shows only while lessons wait and Learning is on or not set up", () => {
  assert.equal(learningBannerText({ state: "on", waiting: 3, oldestDays: 2 }), "3 lessons are waiting for your review (oldest 2 days).");
  assert.equal(learningBannerText({ state: "not-set-up", waiting: 1, oldestDays: 1 }), "1 lesson is waiting for your review (oldest 1 day).");
  assert.equal(learningBannerText({ state: "on", waiting: 0, oldestDays: 0 }), "");
  assert.equal(learningBannerText({ state: "paused", waiting: 4, oldestDays: 0 }), "");
  assert.equal(learningBannerText({ state: "off", waiting: 4, oldestDays: 0 }), "");
  assert.equal(learningBannerText(undefined), "");
});

/* ---------------------------------------------- the lessons card, end to end */

test("the lessons card from lessons.mjs list goes up on the dashboard, and a Keep comes back as a Keep line and a decisions file decide takes", async (t) => {
  const dir = project(SETTINGS("on"));
  writeWaiting(dir, { id: "20261113-120000-abcdef", type: "lesson", text: "Run a page test alone first.", why: "A full run hides the race.", kind: "command", about: ["scripts/node-test.mjs"], source: "said", noted: new Date().toISOString() });
  const lessons = (args) => {
    const res = spawnSync(process.execPath, [LESSONS, ...args], { cwd: dir, env: ENV, encoding: "utf8" });
    return { code: res.status, json: JSON.parse(res.stdout || "null"), stderr: res.stderr };
  };
  const list = lessons(["list"]);
  assert.equal(list.code, 0, list.stderr);
  const card = list.json.card;
  assert.equal(card.kind, "lessons");
  assert.deepEqual(card.rows.map((r) => [r.id, r.type, r.choices]), [["20261113-120000-abcdef", "lesson", ["Keep", "Reword", "Drop"]]]);

  const s = dashboard(t, dir);
  const posted = postPatch(s, { items: [card], agent: { status: "waiting" } }, { cwd: dir });
  assert.equal(posted.status, 0, posted.stderr);
  const item = readState(s.session).items.find((i) => i.id === card.id);
  assert.equal(item.status, "open", "the dashboard takes the lessons card");

  // What the page's Send carries: the answer, and the reply its words make.
  const v = { type: "answer", kind: "lessons", decisions: [{ id: card.rows[0].id, choice: "Keep" }] };
  const reply = `${card.title}: ${indentReply(lessonsReply(item, v))}`;
  const res = await s.post("/submit", { actions: [{ i: card.id, ...v }], reply });
  assert.equal(res.status, 200);
  const waited = cli(["wait", "--session", s.sid, "--seconds", "5"], { cwd: dir });
  assert.equal(waited.status, 0, waited.stderr);
  const lines = waited.json.reply.split("\n").map((l) => l.trim());
  assert.ok(lines.some((l) => l === "Keep: Run a page test alone first."), waited.json.reply);

  // The Decisions line is the file lessons.mjs decide takes, unchanged.
  const json = lines.find((l) => l.startsWith("Decisions: ")).slice("Decisions: ".length);
  const file = path.join(s.session, "decisions.json");
  fs.writeFileSync(file, json);
  const decided = lessons(["decide", "--file", file]);
  assert.equal(decided.code, 0, decided.stderr);
  assert.match(decided.json.closing, /^Kept 1\./, JSON.stringify(decided.json));
  assert.match(fs.readFileSync(path.join(dir, ".plan2code", "lessons", "general.md"), "utf8"), /Run a page test alone first\./);
});
