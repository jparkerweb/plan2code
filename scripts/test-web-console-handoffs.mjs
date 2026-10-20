// Web console tests, the handoff store: ids, writing, listing, marking,
// removing and sweeping ~/.plan2code/handoffs/, and the console commands
// built on it.
// Run with: node --test scripts/test-web-console-handoffs.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top. Every handoff here
// lands in its throwaway HANDOFFS_DIR, never the real home folder.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { CONSOLE_CLI, ENV, HANDOFFS_DIR, cli, safeJson, sessionUrl } from "./web-console-test-helpers.mjs";

process.env.PLAN2CODE_HANDOFFS_DIR = HANDOFFS_DIR;
const store = await import("../src/web-console/handoffs.mjs");
const { HANDOFF_ID, handoffsDir, isHandoffId } = store;

test("isHandoffId takes only a bare handoff id", () => {
  assert.ok(isHandoffId("2026-10-17-1152-handoff"));
  assert.ok(isHandoffId("2026-10-17-1152-handoff-3"));
  for (const bad of ["../x", "2026-10-17-1152-handoff.md", "a/2026-10-17-1152-handoff", "", null, undefined, 7, {}]) {
    assert.equal(isHandoffId(bad), false, String(bad));
  }
  assert.ok(HANDOFF_ID.test("2026-10-17-1152-handoff"));
});

test("handoffsDir follows PLAN2CODE_HANDOFFS_DIR at call time", () => {
  assert.equal(handoffsDir(), HANDOFFS_DIR);
  const saved = process.env.PLAN2CODE_HANDOFFS_DIR;
  try {
    process.env.PLAN2CODE_HANDOFFS_DIR = path.join(HANDOFFS_DIR, "elsewhere");
    assert.equal(handoffsDir(), path.join(HANDOFFS_DIR, "elsewhere"));
  } finally {
    process.env.PLAN2CODE_HANDOFFS_DIR = saved;
  }
});

// A link at `at`: a file symlink to `file` where the machine allows one, else
// a junction to the folder `dir`, which needs no privilege on Windows and
// which lstat reports as a link all the same. False when neither can be made.
function link(file, dir, at) {
  try {
    fs.symlinkSync(file, at, "file");
    return true;
  } catch (err) {
    if (err.code !== "EPERM") throw err;
  }
  try {
    fs.symlinkSync(dir, at, "junction");
    return true;
  } catch {
    return false;
  }
}

// A clean folder per test that writes handoffs, and the pinned clock it asks for.
function fresh(nowPinned) {
  fs.rmSync(HANDOFFS_DIR, { recursive: true, force: true });
  if (nowPinned === undefined) delete process.env.PLAN2CODE_NOW;
  else process.env.PLAN2CODE_NOW = nowPinned;
}

const WORKTREE = path.join(HANDOFFS_DIR, "..", "repo");
const REC = {
  worktree: WORKTREE,
  project: WORKTREE,
  spec: "specs/lunch-vote",
  workflow: "quick-task",
  skill: "plan2code-quick-task",
  title: "Lunch vote",
  fromStop: true,
};

test("newHandoff claims the next free id for the minute and writes only the .json", () => {
  fresh("2026-10-17 11:52");
  try {
    const a = store.newHandoff(REC);
    const b = store.newHandoff({ ...REC, spec: undefined, fromStop: false });
    assert.equal(a.id, "2026-10-17-1152-handoff");
    assert.equal(b.id, "2026-10-17-1152-handoff-2");
    assert.equal(a.path, path.join(HANDOFFS_DIR, a.id + ".md"));
    assert.equal(fs.existsSync(a.path), false, "the agent writes the .md");
    const meta = JSON.parse(fs.readFileSync(path.join(HANDOFFS_DIR, a.id + ".json"), "utf8"));
    assert.deepEqual(Object.keys(meta), ["v", "id", "title", "worktree", "project", "spec", "workflow", "skill", "written", "fromStop", "usedAt"]);
    assert.deepEqual(
      { ...meta, written: undefined },
      { v: 1, id: a.id, title: "Lunch vote", worktree: WORKTREE, project: WORKTREE, spec: "specs/lunch-vote", workflow: "quick-task", skill: "plan2code-quick-task", written: undefined, fromStop: true, usedAt: null }
    );
    assert.ok(!Number.isNaN(Date.parse(meta.written)));
    assert.deepEqual(a.meta, meta);
    assert.equal(b.meta.spec, null);
    assert.equal(b.meta.fromStop, false);
  } finally {
    fresh();
  }
});

test("newHandoff refuses a bad workflow, skill or spec and leaves no file", () => {
  fresh("2026-10-17 11:52");
  try {
    for (const [field, value] of [["workflow", "Quick Task"], ["workflow", undefined], ["skill", "../x"], ["spec", "../x"], ["spec", "specs/a/b"]]) {
      assert.throws(() => store.newHandoff({ ...REC, [field]: value }), new RegExp(field));
    }
    assert.deepEqual(fs.existsSync(HANDOFFS_DIR) ? fs.readdirSync(HANDOFFS_DIR) : [], []);
  } finally {
    fresh();
  }
});

test("readHandoffMeta round-trips, markHandoffUsed stamps usedAt and leaves the .md alone", () => {
  fresh("2026-10-17 11:52");
  try {
    const { id, path: md, meta } = store.newHandoff(REC);
    fs.writeFileSync(md, "# Handoff: Lunch vote\n");
    const before = fs.readFileSync(md);
    assert.deepEqual(store.readHandoffMeta(id), meta);
    const used = store.markHandoffUsed(id, new Date("2026-10-18T09:00:00Z"));
    assert.equal(used.usedAt, "2026-10-18T09:00:00.000Z");
    assert.deepEqual(store.readHandoffMeta(id), used);
    assert.deepEqual(fs.readFileSync(md), before);
    assert.equal(store.readHandoffMeta("../x"), null);
    assert.equal(store.readHandoffMeta("2026-10-17-1152-handoff-9"), null);
    assert.equal(store.markHandoffUsed("2026-10-17-1152-handoff-9"), null);
    fs.writeFileSync(path.join(HANDOFFS_DIR, "2026-10-17-1152-handoff-7.json"), "not json");
    assert.equal(store.readHandoffMeta("2026-10-17-1152-handoff-7"), null);
    fs.writeFileSync(path.join(HANDOFFS_DIR, "2026-10-17-1152-handoff-8.json"), JSON.stringify({ ...meta, v: 2 }));
    assert.equal(store.readHandoffMeta("2026-10-17-1152-handoff-8"), null);
  } finally {
    fresh();
  }
});

test("readHandoffMeta refuses a linked .json", (t) => {
  fresh("2026-10-17 11:52");
  try {
    const { meta } = store.newHandoff(REC);
    const linkId = "2026-10-17-1152-handoff-5";
    const outside = path.join(HANDOFFS_DIR, "..", "outside-dir");
    fs.mkdirSync(outside, { recursive: true });
    if (!link(path.join(HANDOFFS_DIR, meta.id + ".json"), outside, path.join(HANDOFFS_DIR, linkId + ".json"))) {
      t.skip("this machine can make neither a symlink nor a junction");
      return;
    }
    assert.equal(store.readHandoffMeta(linkId), null);
  } finally {
    fresh();
  }
});

// A handoff with a document, as the agent would leave it.
function written(rec, md, when) {
  const h = store.newHandoff(rec, when);
  if (md !== null) fs.writeFileSync(h.path, md);
  return h;
}

const DOC = `# Handoff: Lunch vote

## Context

Some context.

## Next task

Wire the vote button
to the tally,   then test it.

## Notes

x
`;

test("listHandoffs lists only this checkout's unused handoffs that have both files, newest first", () => {
  fresh();
  try {
    const mine = written(REC, DOC, new Date("2026-10-17T10:00:00Z"));
    const newer = written({ ...REC, title: "Second" }, "# Handoff - Second try\n\n## Next task\n\n" + "word ".repeat(80) + "\n", new Date("2026-10-17T12:00:00Z"));
    written({ ...REC, worktree: path.join(HANDOFFS_DIR, "..", "other") }, DOC, new Date("2026-10-17T10:01:00Z"));
    const used = written(REC, DOC, new Date("2026-10-17T10:02:00Z"));
    store.markHandoffUsed(used.id);
    // A .json with no .md, and a .md with no .json.
    written(REC, null, new Date("2026-10-17T10:03:00Z"));
    fs.writeFileSync(path.join(HANDOFFS_DIR, "2026-10-01-0900-handoff.md"), DOC);

    const list = store.listHandoffs(WORKTREE);
    assert.deepEqual(list.map((h) => h.id), [newer.id, mine.id]);
    assert.deepEqual(list[1], {
      id: mine.id,
      title: "Lunch vote",
      next: "Wire the vote button to the tally, then test it.",
      written: mine.meta.written,
      spec: "specs/lunch-vote",
      skill: "plan2code-quick-task",
      workflow: "quick-task",
    });
    assert.equal(list[0].title, "Second try");
    assert.equal(list[0].next.length, 280);
    assert.ok(list[0].next.endsWith("…"));
  } finally {
    fresh();
  }
});

test("listHandoffs falls back to the stored title and lists nothing for a missing folder", () => {
  fresh();
  try {
    assert.deepEqual(store.listHandoffs(WORKTREE), []);
    const h = written(REC, "No heading here.\n", new Date("2026-10-17T10:00:00Z"));
    assert.deepEqual(store.listHandoffs(WORKTREE).map((x) => [x.id, x.title, x.next]), [[h.id, "Lunch vote", ""]]);
    // Only the word "Handoff" is a prefix: "Handoffs" is part of the title.
    const plural = written(REC, "# Handoffs page redesign\n", new Date("2026-10-17T09:00:00Z"));
    assert.equal(store.listHandoffs(WORKTREE).find((x) => x.id === plural.id).title, "Handoffs page redesign");
  } finally {
    fresh();
  }
});

test("listHandoffs matches the worktree whatever its case on win32 and darwin", { skip: process.platform !== "win32" && process.platform !== "darwin" }, () => {
  fresh();
  try {
    const h = written(REC, DOC, new Date("2026-10-17T10:00:00Z"));
    assert.deepEqual(store.listHandoffs(WORKTREE.toUpperCase()).map((x) => x.id), [h.id]);
  } finally {
    fresh();
  }
});

test("removeHandoff removes both files, or a lone one, and refuses anything else", () => {
  fresh();
  try {
    const both = written(REC, DOC, new Date("2026-10-17T10:00:00Z"));
    assert.deepEqual(store.removeHandoff(both.id), { ok: true, removed: [both.id + ".md", both.id + ".json"] });
    assert.deepEqual(fs.readdirSync(HANDOFFS_DIR), []);

    fs.writeFileSync(path.join(HANDOFFS_DIR, "2026-10-01-0900-handoff.md"), DOC);
    assert.deepEqual(store.removeHandoff("2026-10-01-0900-handoff").removed, ["2026-10-01-0900-handoff.md"]);
    const lone = written(REC, null, new Date("2026-10-17T10:01:00Z"));
    assert.deepEqual(store.removeHandoff(lone.id).removed, [lone.id + ".json"]);

    assert.throws(() => store.removeHandoff("../evil"), /not a handoff id: \.\.\/evil/);
    assert.throws(() => store.removeHandoff("2026-10-01-0900-handoff"), /there is no handoff 2026-10-01-0900-handoff/);
  } finally {
    fresh();
  }
});

test("removeHandoff refuses a linked .md and leaves everything in place", (t) => {
  fresh();
  try {
    const h = written(REC, null, new Date("2026-10-17T10:00:00Z"));
    const outside = path.join(HANDOFFS_DIR, "..", "outside.md");
    const outsideDir = path.join(HANDOFFS_DIR, "..", "outside-dir");
    fs.writeFileSync(outside, "keep me");
    fs.mkdirSync(outsideDir, { recursive: true });
    fs.writeFileSync(path.join(outsideDir, "keep.txt"), "keep me too");
    if (!link(outside, outsideDir, h.path)) {
      t.skip("this machine can make neither a symlink nor a junction");
      return;
    }
    assert.throws(() => store.removeHandoff(h.id), /link/);
    assert.ok(fs.existsSync(path.join(HANDOFFS_DIR, h.id + ".json")));
    assert.ok(fs.lstatSync(h.path).isSymbolicLink(), "the link itself stays");
    assert.equal(fs.readFileSync(outside, "utf8"), "keep me");
    assert.equal(fs.readFileSync(path.join(outsideDir, "keep.txt"), "utf8"), "keep me too");
  } finally {
    fresh();
  }
});

test("staleHandoffs lists only month-old handoffs and removeHandoffs takes both files", async () => {
  fresh();
  try {
    const old = written(REC, DOC, new Date("2026-09-01T10:00:00Z"));
    const recent = written(REC, DOC, new Date("2026-10-16T10:00:00Z"));
    const oldMdOnly = "2026-08-01-0900-handoff";
    fs.writeFileSync(path.join(HANDOFFS_DIR, oldMdOnly + ".md"), DOC);
    fs.writeFileSync(path.join(HANDOFFS_DIR, "notes.txt"), "not mine");
    const DAY = 24 * 60 * 60 * 1000;
    const age = (file, days) => {
      const t = (Date.now() - days * DAY) / 1000;
      fs.utimesSync(file, t, t);
    };
    age(path.join(HANDOFFS_DIR, old.id + ".json"), 31);
    age(old.path, 31);
    age(path.join(HANDOFFS_DIR, recent.id + ".json"), 1);
    age(path.join(HANDOFFS_DIR, oldMdOnly + ".md"), 40);
    age(path.join(HANDOFFS_DIR, "notes.txt"), 90);

    const stale = store.staleHandoffs(Date.now(), 30 * DAY);
    assert.deepEqual(stale.sort(), [oldMdOnly, old.id].sort());
    assert.deepEqual((await store.removeHandoffs([...stale, "../evil", "notes.txt"])).sort(), [oldMdOnly, old.id].sort());
    assert.deepEqual(fs.readdirSync(HANDOFFS_DIR).sort(), [recent.id + ".json", recent.id + ".md", "notes.txt"].sort());
  } finally {
    fresh();
  }
});

/* ------------------------------------------------------- console commands */

// A throwaway git checkout to run the CLI in, so repoRoots() names it.
const REPO = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-handoff-repo-"));
spawnSync("git", ["init", "-q", REPO], { env: ENV });
const REPO_REAL = fs.realpathSync.native(REPO);

function run(args) {
  const res = spawnSync(process.execPath, [CONSOLE_CLI, ...args], { env: ENV, encoding: "utf8", cwd: REPO });
  return { status: res.status, stderr: res.stderr, json: safeJson(res.stdout) };
}

test("handoff new claims a handoff for this checkout and prints where to write it", () => {
  fresh();
  try {
    const res = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task", "--spec", "specs/lunch-vote", "--title", "Lunch vote", "--from-stop"]);
    assert.equal(res.status, 0, res.stderr);
    assert.equal(res.json.ok, true);
    assert.ok(store.isHandoffId(res.json.id));
    assert.equal(path.dirname(res.json.path), HANDOFFS_DIR);
    assert.ok(res.json.path.endsWith(".md"));
    assert.equal(fs.existsSync(res.json.path), false);
    const meta = JSON.parse(fs.readFileSync(path.join(HANDOFFS_DIR, res.json.id + ".json"), "utf8"));
    assert.equal(meta.worktree, REPO_REAL);
    assert.equal(meta.project, REPO_REAL);
    assert.equal(meta.spec, "specs/lunch-vote");
    assert.equal(meta.fromStop, true);
    assert.deepEqual(res.json.meta, meta);
  } finally {
    fresh();
  }
});

test("handoff new refuses bad usage with 2 and a bad value with 3", () => {
  fresh();
  try {
    assert.equal(run(["handoff", "new", "--workflow", "quick-task"]).status, 2);
    assert.equal(run(["handoff", "new", "--skill", "plan2code-quick-task"]).status, 2);
    assert.equal(run(["handoff", "list"]).status, 2);
    assert.equal(run(["handoff"]).status, 2);
    // A name newHandoff() would take (lowercase and dashes) but no workflow
    // the console knows: refused as usage before anything is written (FR-5).
    const before = fs.existsSync(HANDOFFS_DIR) ? fs.readdirSync(HANDOFFS_DIR).sort() : [];
    const unknown = run(["handoff", "new", "--workflow", "x-ray", "--skill", "plan2code-xray"]);
    assert.equal(unknown.status, 2, unknown.stderr);
    assert.match(unknown.stderr, /unknown workflow "x-ray"; one of: .*, xray, /);
    assert.deepEqual(fs.existsSync(HANDOFFS_DIR) ? fs.readdirSync(HANDOFFS_DIR).sort() : [], before, "no new file in the handoffs folder");
    const bad = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task", "--spec", "../x"]);
    assert.equal(bad.status, 3);
    assert.equal(bad.json.ok, false);
    assert.match(bad.json.message, /spec/);
    assert.deepEqual(fs.existsSync(HANDOFFS_DIR) ? fs.readdirSync(HANDOFFS_DIR) : [], []);
  } finally {
    fresh();
  }
});

test("delete-handoff removes both files and refuses a bad id or no flag", () => {
  fresh();
  try {
    const made = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task"]).json;
    fs.writeFileSync(made.path, DOC);
    const done = run(["delete-handoff", "--handoff", made.id]);
    assert.equal(done.status, 0, done.stderr);
    assert.deepEqual(done.json, { ok: true, removed: [made.id + ".md", made.id + ".json"] });
    assert.deepEqual(fs.readdirSync(HANDOFFS_DIR), []);

    const bad = run(["delete-handoff", "--handoff", "../evil"]);
    assert.equal(bad.status, 3);
    assert.equal(bad.json.ok, false);
    assert.match(bad.json.message, /not a handoff id/);
    assert.equal(run(["delete-handoff"]).status, 2);
    assert.equal(run(["delete-handoff", "--handoff"]).status, 2);
  } finally {
    fresh();
  }
});

/* ------------------------------------------------- the dashboard's scan */

// Open a dashboard in REPO (and stop it after), returning its state and a getter for pages.
async function withDashboard(fn) {
  const opened = run(["open", "--no-open", "--workflow", "dashboard"]);
  assert.equal(opened.status, 0, opened.stderr);
  const s = sessionUrl(opened.json.url);
  const get = (pathname) => fetch(`${s.base}${pathname}`, { headers: { cookie: s.cookie, connection: "close" } });
  try {
    return await fn({ sid: opened.json.sid, session: opened.json.session, get });
  } finally {
    run(["stop", "--session", opened.json.sid]);
  }
}

const readStateOf = (session) => JSON.parse(fs.readFileSync(path.join(session, "state.json"), "utf8"));

test("a dashboard open scans this checkout's handoffs and the folder; other workflows do not", async () => {
  fresh();
  try {
    const made = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task", "--title", "Lunch vote"]).json;
    fs.writeFileSync(made.path, DOC);
    await withDashboard(({ session }) => {
      const scan = readStateOf(session).scan;
      assert.equal(scan.handoffs.length, 1);
      assert.equal(scan.handoffs[0].id, made.id);
      assert.equal(scan.handoffs[0].title, "Lunch vote");
      assert.equal(scan.handoffs[0].next, "Wire the vote button to the tally, then test it.");
      assert.equal(scan.handoffsDir, HANDOFFS_DIR);
    });
    const quick = run(["open", "--no-open", "--workflow", "quick-task"]);
    try {
      assert.equal(readStateOf(quick.json.session).scan, undefined, "no scan, so no handoffs, off the dashboard");
    } finally {
      run(["stop", "--session", quick.json.sid]);
    }
  } finally {
    fresh();
  }
});

test("GET /handoff serves a scanned handoff's document and nothing else", async () => {
  fresh();
  try {
    const made = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task", "--title", "Lunch vote"]).json;
    fs.writeFileSync(made.path, DOC);
    const unscanned = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task"]).json;
    fs.writeFileSync(unscanned.path, DOC);
    await withDashboard(async ({ get }) => {
      // The two above were both on disk when the dashboard opened, so use a third made afterwards as "unscanned".
      const later = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task"]).json;
      fs.writeFileSync(later.path, DOC);
      const ok = await get(`/handoff?id=${made.id}`);
      assert.equal(ok.status, 200);
      assert.match(ok.headers.get("content-type"), /^text\/markdown/);
      assert.equal(ok.headers.get("cache-control"), "no-store");
      assert.equal(await ok.text(), DOC);
      assert.equal((await get(`/handoff?id=${later.id}`)).status, 404, "valid but not scanned");
      assert.equal((await get("/handoff?id=../x")).status, 404);
      assert.equal((await get("/handoff")).status, 404);
    });
    // A used handoff drops out of the next scan, so it is no longer served.
    store.markHandoffUsed(made.id);
    await withDashboard(async ({ get }) => {
      assert.equal((await get(`/handoff?id=${made.id}`)).status, 404, "used");
    });
  } finally {
    fresh();
  }
});

test("a __pickup round trip prints the hop, marks the handoff used, and the next dashboard scan drops it", async () => {
  fresh();
  try {
    const made = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task", "--title", "Lunch vote"]).json;
    fs.writeFileSync(made.path, DOC);
    const opened = run(["open", "--no-open", "--workflow", "dashboard"]);
    const s = sessionUrl(opened.json.url);
    try {
      const res = await fetch(`${s.base}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
        body: JSON.stringify({ actions: [{ i: "__pickup", type: "pickup", handoff: made.id }], reply: "pick up" }),
      });
      assert.equal(res.status, 200);
      const got = run(["wait", "--session", opened.json.sid, "--seconds", "10"]);
      assert.equal(got.status, 0, got.stderr);
      assert.match(got.json.resume, /--workflow quick-task$/);
      assert.equal(got.json.handoffFile, made.path);
      assert.ok(JSON.parse(fs.readFileSync(path.join(HANDOFFS_DIR, made.id + ".json"), "utf8")).usedAt, "the .json now has usedAt");
      assert.ok(fs.existsSync(made.path), "the document stays until the sweep");
      const back = run(["open", "--resume", opened.json.sid, "--no-open", "--workflow", "dashboard"]);
      assert.equal(back.status, 0, back.stderr);
      assert.deepEqual(readStateOf(opened.json.session).scan.handoffs, [], "a used handoff is no longer listed");
    } finally {
      run(["stop", "--session", opened.json.sid]);
    }
  } finally {
    fresh();
  }
});

test("a __delete with a handoff round-trips like a spec delete: no resume, no skillFile", async () => {
  fresh();
  try {
    const made = run(["handoff", "new", "--workflow", "quick-task", "--skill", "plan2code-quick-task"]).json;
    fs.writeFileSync(made.path, DOC);
    const opened = run(["open", "--no-open", "--workflow", "dashboard"]);
    const s = sessionUrl(opened.json.url);
    try {
      const res = await fetch(`${s.base}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
        body: JSON.stringify({ actions: [{ i: "__delete", type: "delete", handoff: made.id }], reply: "delete it" }),
      });
      assert.equal(res.status, 200);
      const got = run(["wait", "--session", opened.json.sid, "--seconds", "10"]);
      assert.equal(got.status, 0, got.stderr);
      assert.equal(got.json.actions[0].handoff, made.id);
      assert.equal(got.json.resume, undefined);
      assert.equal(got.json.skillFile, undefined);
      assert.equal(got.json.handoffFile, undefined);
    } finally {
      run(["stop", "--session", opened.json.sid]);
    }
  } finally {
    fresh();
  }
});

test.after(() => fs.rmSync(REPO, { recursive: true, force: true }));
