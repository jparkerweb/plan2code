// Tests for the shared lessons.mjs (shipped in plan2code-quick-task and, from
// Phase 6, every skill that reads or notes lessons) and the core it loads,
// src/web-console/learning.mjs.
//
// See skill-script-helpers.mjs for how these run. Every test gets its own
// PLAN2CODE_LEARNING_DIR, so nothing reaches ~/.plan2code/learning.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { runScript, tmp, write, read, gitInit, gitIn, copyFixture, fixtureCleanup, scrubbedEnv, slashed, SKILLS, NOW } from "./skill-script-helpers.mjs";
import * as core from "../src/web-console/learning.mjs";
// The record functions, imported straight from the source (the script runs
// its CLI only when started as a script).
import * as record from "../src/skill-scripts/lessons.mjs";

after(fixtureCleanup);

const learningDir = () => tmp("learning-store");

function L(cwd, args, learning) {
  return runScript("plan2code-quick-task", "lessons.mjs", args, { cwd, env: { PLAN2CODE_LEARNING_DIR: learning } });
}

// A repository with one commit on main, copied fresh for each caller.
const repo = () =>
  copyFixture("lessons-repo", "one-commit", (dir) => {
    const g = gitInit(dir);
    write(dir, "README.md", "# Fixture\n");
    g("add", "-A");
    g("commit", "-q", "-m", "init");
  });

// The same clock the scripts run on (PLAN2CODE_NOW, local time).
const nowDate = () => {
  const m = NOW.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
};
const daysBefore = (n) => new Date(nowDate().getTime() - n * 24 * 60 * 60 * 1000);

// Write a waiting item through the core, into a given store.
function waiting(cwd, learning, noted, id) {
  const before = process.env.PLAN2CODE_LEARNING_DIR;
  process.env.PLAN2CODE_LEARNING_DIR = learning;
  try {
    return core.writeWaiting(cwd, { id: id || core.newWaitingId(noted), type: "lesson", text: "A lesson.", noted: noted.toISOString() });
  } finally {
    if (before === undefined) delete process.env.PLAN2CODE_LEARNING_DIR;
    else process.env.PLAN2CODE_LEARNING_DIR = before;
  }
}

const settings = (dir, body) => write(dir, ".plan2code/settings.json", typeof body === "string" ? body : JSON.stringify(body));

/* ----------------------------------------------------------------- state */

test("lessons state: not set up, off, on, paused, and unknown for another format", () => {
  const dir = repo();
  const store = learningDir();
  const s0 = L(dir, ["state"], store);
  assert.equal(s0.code, 0, s0.stderr);
  assert.deepEqual(s0.json, {
    ok: true,
    state: "not-set-up",
    active: false,
    pausedSince: null,
    waiting: { count: 0, oldestDays: 0 },
    hasAgents: false,
    onDefaultBranch: true,
  });

  settings(dir, { format: 1, learning: "off" });
  assert.equal(L(dir, ["state"], store).json.state, "off");

  settings(dir, { format: 1, learning: "on" });
  const on = L(dir, ["state"], store).json;
  assert.equal(on.state, "on");
  assert.equal(on.active, true);

  assert.equal(L(dir, ["pause", "on"], store).code, 0);
  const paused = L(dir, ["state"], store).json;
  assert.equal(paused.state, "paused");
  assert.equal(paused.active, false);
  assert.ok(paused.pausedSince, "a paused state says since when");

  settings(dir, { format: 2, learning: "on" });
  const unknown = L(dir, ["state"], store).json;
  assert.equal(unknown.state, "unknown");
  assert.equal(unknown.active, false);
  settings(dir, "{ not json");
  assert.equal(L(dir, ["state"], store).json.state, "unknown");
  settings(dir, { format: 1, learning: "maybe" });
  assert.equal(L(dir, ["state"], store).json.state, "unknown");
});

test("lessons state: a pause file is ignored unless the project is on", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  assert.equal(L(dir, ["pause", "on"], store).code, 0);
  settings(dir, { format: 1, learning: "off" });
  assert.equal(L(dir, ["state"], store).json.state, "off");
});

test("lessons state: hasAgents and onDefaultBranch", () => {
  const dir = repo();
  const store = learningDir();
  write(dir, "AGENTS.md", "# Agents\n");
  const g = gitIn(dir);
  const s = L(dir, ["state"], store).json;
  assert.equal(s.hasAgents, true);
  assert.equal(s.onDefaultBranch, true, "main is the default branch with no origin");
  g("checkout", "-q", "-b", "feature/x");
  assert.equal(L(dir, ["state"], store).json.onDefaultBranch, false);
  const outside = tmp("lessons-nogit");
  assert.equal(L(outside, ["state"], store).json.onDefaultBranch, false, "outside git it is false");

  // origin/HEAD names the default branch when it is set, with origin/ removed.
  g("checkout", "-q", "-b", "trunk");
  g("update-ref", "refs/remotes/origin/trunk", "HEAD");
  g("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
  assert.equal(L(dir, ["state"], store).json.onDefaultBranch, true, "trunk, from origin/HEAD");
  g("checkout", "-q", "main");
  assert.equal(L(dir, ["state"], store).json.onDefaultBranch, false, "main is not the default once origin/HEAD says trunk");

  // No origin/HEAD and no main: master.
  const old = tmp("lessons-master");
  const gm = gitInit(old, "master");
  write(old, "README.md", "# Old\n");
  gm("add", "-A");
  gm("commit", "-q", "-m", "init");
  assert.equal(L(old, ["state"], store).json.onDefaultBranch, true, "master when there is no main");
});

test("lessons state: a second worktree of the same repository shares the waiting store", () => {
  const dir = repo();
  const store = learningDir();
  const wt = path.join(tmp("lessons-wt"), "second");
  gitIn(dir)("worktree", "add", "-q", "-b", "second", wt);
  waiting(dir, store, daysBefore(2));
  waiting(dir, store, daysBefore(1));
  const main = L(dir, ["state"], store).json;
  const other = L(wt, ["state"], store).json;
  assert.equal(main.waiting.count, 2);
  assert.deepEqual(other.waiting, main.waiting, "same repository key, same store");
  assert.equal(other.waiting.oldestDays, 2);
});

test("lessons state: a waiting item older than 30 days is deleted, a 29-day-old one is counted", () => {
  const dir = repo();
  const store = learningDir();
  const old = waiting(dir, store, daysBefore(31));
  waiting(dir, store, daysBefore(29));
  const s = L(dir, ["state"], store).json;
  assert.deepEqual(s.waiting, { count: 1, oldestDays: 29 });
  const files = fs.readdirSync(path.join(store), { recursive: true }).map(String);
  assert.equal(files.some((f) => f.includes(old.id)), false, "the old item's file is gone");
});

/* ---------------------------------------------------------------- switch */

test("lessons switch: on then off write only settings.json and never stage it", () => {
  const dir = repo();
  const store = learningDir();
  const on = L(dir, ["switch", "on"], store);
  assert.equal(on.code, 0, on.stderr);
  assert.deepEqual(on.json, { ok: true, state: "on", active: true, written: [".plan2code/settings.json"], dryRun: false, skipped: "no-agents", next: "plan2code-init", offerLogMove: false, firstOn: true });
  assert.equal(fs.readFileSync(path.join(dir, ".plan2code", "settings.json"), "utf8"), '{\n  "format": 1,\n  "learning": "on"\n}\n');
  const g = gitIn(dir);
  assert.equal(g("status", "--porcelain", "--untracked-files=all").trim(), "?? .plan2code/settings.json");

  assert.deepEqual(L(dir, ["switch", "on"], store).json.written, [], "nothing changed, nothing written");

  g("add", "-A");
  g("commit", "-q", "-m", "learning on");
  const off = L(dir, ["switch", "off"], store);
  assert.equal(off.code, 0, off.stderr);
  assert.equal(off.json.state, "off");
  assert.deepEqual(off.json.written, [".plan2code/settings.json"]);
  assert.equal(g("status", "--porcelain").trim(), "M .plan2code/settings.json", "modified, not staged");
});

test("lessons switch: --dry-run writes nothing", () => {
  const dir = repo();
  const store = learningDir();
  const r = L(dir, ["switch", "on", "--dry-run"], store);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.written, []);
  assert.equal(r.json.dryRun, true);
  assert.equal(r.json.state, "not-set-up");
  assert.equal(fs.existsSync(path.join(dir, ".plan2code")), false);
});

test("lessons switch: run from a subfolder writes and reads the checkout's top-level settings", () => {
  const dir = repo();
  const store = learningDir();
  const sub = path.join(dir, "packages", "app");
  fs.mkdirSync(sub, { recursive: true });
  write(dir, "AGENTS.md", "# Agents\n");
  const on = L(sub, ["switch", "on"], store);
  assert.equal(on.code, 0, on.stderr);
  assert.equal(on.json.state, "on");
  assert.deepEqual(on.json.written, [".plan2code/settings.json", "AGENTS.md"], "the pointer line lands in the top-level AGENTS.md");
  assert.ok(fs.existsSync(path.join(dir, ".plan2code", "settings.json")));
  assert.equal(fs.existsSync(path.join(sub, ".plan2code")), false, "no stray settings in the subfolder");
  const viaRoot = L(dir, ["state", "--root", sub], store).json;
  assert.equal(viaRoot.state, "on");
  assert.equal(viaRoot.hasAgents, true, "AGENTS.md is read at the top level too");
});

test("lessons switch: refused while the settings file is of another format", () => {
  const dir = repo();
  const store = learningDir();
  const body = JSON.stringify({ format: 2, learning: "on" });
  settings(dir, body);
  const r = L(dir, ["switch", "off"], store);
  assert.equal(r.code, 5);
  assert.equal(r.json.error, "unknown-format");
  assert.equal(r.json.state, "unknown");
  assert.equal(fs.readFileSync(path.join(dir, ".plan2code", "settings.json"), "utf8"), body, "the newer file is left as it is");
});

test("lessons switch: needs on or off", () => {
  const dir = repo();
  const r = L(dir, ["switch"], learningDir());
  assert.equal(r.code, 2);
  assert.equal(r.json.error, "missing-value");
});

/* ----------------------------------------------------------------- pause */

test("lessons pause: refused with exit 5 when not set up and when off", () => {
  const dir = repo();
  const store = learningDir();
  const notSetUp = L(dir, ["pause", "on"], store);
  assert.equal(notSetUp.code, 5);
  assert.equal(notSetUp.json.error, "not-on");
  assert.match(notSetUp.json.message, /only available while Learning is on/);
  settings(dir, { format: 1, learning: "off" });
  const off = L(dir, ["pause", "on"], store);
  assert.equal(off.code, 5);
  assert.equal(off.json.error, "not-on");
  assert.equal(fs.existsSync(store) && fs.readdirSync(store).length > 0, false, "nothing written on this machine");
});

test("lessons pause: on gives paused with pausedSince, off clears it, off again is a no-op", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const p = L(dir, ["pause", "on"], store);
  assert.equal(p.code, 0, p.stderr);
  assert.equal(p.json.state, "paused");
  assert.equal(p.json.active, false);
  assert.equal(p.json.pausedSince, nowDate().toISOString(), "the pinned clock");
  const s = L(dir, ["state"], store).json;
  assert.equal(s.state, "paused");
  assert.equal(s.pausedSince, p.json.pausedSince);
  const off = L(dir, ["pause", "off"], store);
  assert.deepEqual(off.json, { ok: true, state: "on", active: true, pausedSince: null });
  const again = L(dir, ["pause", "off"], store);
  assert.equal(again.code, 0);
  assert.equal(again.json.state, "on");
});

/* ----------------------------------------------------------- the rest */

test("lessons: unknown commands exit 2", () => {
  const dir = repo();
  const store = learningDir();
  for (const cmd of ["frobnicate", "unlearn"]) {
    const r = L(dir, [cmd], store);
    assert.equal(r.code, 2, cmd);
    assert.equal(r.json.error, "unknown-command", cmd);
  }
  assert.equal(L(dir, [], store).code, 2);
});

test("lessons: a missing console folder gives exit 3 no-console", () => {
  const base = tmp("lessons-alone");
  const scripts = path.join(base, "skill", "scripts");
  fs.mkdirSync(scripts, { recursive: true });
  for (const f of ["lessons.mjs", "common.mjs", "glob.mjs", "test-map.mjs"]) fs.copyFileSync(path.join(SKILLS, "plan2code-quick-task", "scripts", f), path.join(scripts, f));
  const emptyHome = tmp("lessons-console-home");
  const r = spawnSync(process.execPath, [path.join(scripts, "lessons.mjs"), "state"], {
    cwd: repo(),
    encoding: "utf8",
    env: scrubbedEnv({ PLAN2CODE_NOW: NOW, PLAN2CODE_CONSOLE_HOME: emptyHome, PLAN2CODE_LEARNING_DIR: learningDir() }),
  });
  assert.equal(r.status, 3, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.equal(json.error, "no-console");
  assert.match(json.next, /without lessons/);
});

/* -------------------------------------------------------------- the core */

test("learning core: the repository key matches projectKey's shape and removeWaiting refuses paths", () => {
  const dir = repo();
  const store = learningDir();
  const before = process.env.PLAN2CODE_LEARNING_DIR;
  process.env.PLAN2CODE_LEARNING_DIR = store;
  try {
    const key = core.repositoryKey(dir);
    assert.match(key, /^[a-z0-9-]{1,40}-[0-9a-f]{12}$/);
    assert.equal(core.storeDir(dir), path.join(store, key));
    assert.match(core.newWaitingId(nowDate()), /^20260803-140500-[0-9a-f]{6}$/);
    for (const bad of ["../x", "a/b", "a\\b", "..", "", "a:b", ".hidden", "a b"]) assert.throws(() => core.removeWaiting(dir, bad), /Refused/, bad);
    const item = core.writeWaiting(dir, { id: "20260803-140500-abcdef", type: "lesson", text: "x", noted: nowDate().toISOString() });
    assert.equal(item.format, 1);
    assert.equal(core.listWaiting(dir, nowDate()).length, 1);
    fs.writeFileSync(path.join(core.storeDir(dir), "waiting", "bad.json"), "{ nope");
    fs.writeFileSync(path.join(core.storeDir(dir), "waiting", "v2.json"), JSON.stringify({ format: 2, id: "v2", noted: nowDate().toISOString() }));
    assert.equal(core.listWaiting(dir, nowDate()).length, 1, "unreadable and other-format files are skipped");
    assert.equal(core.removeWaiting(dir, "20260803-140500-abcdef"), true);
    assert.equal(core.removeWaiting(dir, "20260803-140500-abcdef"), false);
  } finally {
    if (before === undefined) delete process.env.PLAN2CODE_LEARNING_DIR;
    else process.env.PLAN2CODE_LEARNING_DIR = before;
  }
});

/* ------------------------------------------------------------ the record */

const AREA_TEXT = [
  "# Web console",
  "Paths: src/web-console/**, scripts/test-web-console-*.mjs",
  "",
  "### A first lesson about the server",
  "- Kind: convention",
  "- About: src/web-console/server.mjs",
  "- Noted: 2026-11-01, Implement",
  "",
  "### Cut the page test's wait, never the timeout",
  "- Kind: correction",
  "- About: scripts/a.mjs, scripts/b.mjs",
  "- Why: a redraw raced the read once.",
  "- Noted: 2026-11-02, Quick Task, checked 2026-11-10",
  "",
].join("\n");

test("lessons record: parse and render round trip byte for byte, LF and CRLF", () => {
  for (const text of [AREA_TEXT, AREA_TEXT.replace(/\n/g, "\r\n"), AREA_TEXT.replace(/\n$/, "")]) {
    const area = record.parseAreaFile(text);
    assert.equal(record.renderAreaFile(area), text);
    assert.equal(area.name, "Web console");
    assert.deepEqual(area.paths, ["src/web-console/**", "scripts/test-web-console-*.mjs"]);
    assert.equal(area.blocks.length, 2);
    const [a, b] = area.blocks;
    assert.equal(a.heading, "A first lesson about the server");
    assert.equal(a.kind, "convention");
    assert.deepEqual(a.about, ["src/web-console/server.mjs"]);
    assert.equal(a.why, "");
    assert.equal(a.noted, "2026-11-01, Implement");
    assert.equal(a.checked, null);
    assert.equal(a.startLine, 4);
    assert.deepEqual(b.about, ["scripts/a.mjs", "scripts/b.mjs"]);
    assert.equal(b.why, "a redraw raced the read once.");
    assert.equal(b.noted, "2026-11-02, Quick Task");
    assert.equal(b.checked, "2026-11-10");
  }
  assert.equal(record.parseAreaFile(AREA_TEXT.replace(/\n/g, "\r\n")).eol, "\r\n");
});

test("lessons record: an insert lands at its alphabetical place and leaves every other line alone", () => {
  for (const eolText of ["\n", "\r\n"]) {
    const text = AREA_TEXT.replace(/\n/g, eolText);
    const area = record.parseAreaFile(text);
    const r = record.insertBlock(area, { heading: "Build the skills before the tests", kind: "command", about: ["install.js"], why: "", noted: "2026-11-13, Implement" });
    assert.deepEqual(r, { inserted: true, index: 1 });
    const outText = record.renderAreaFile(area);
    const added = ["### Build the skills before the tests", "- Kind: command", "- About: install.js", "- Noted: 2026-11-13, Implement", ""].join(eolText) + eolText;
    const at = text.indexOf("### Cut");
    assert.equal(outText, text.slice(0, at) + added + text.slice(at));
    assert.deepEqual(record.insertBlock(area, { heading: "build the skills before the tests", kind: "command", about: ["x"], noted: "x" }), { duplicate: true });
    assert.equal(record.removeBlock(area, "web-console/build-the-skills-before-the-tests"), true);
    assert.equal(record.renderAreaFile(area), text, "removing it gives the file back");
  }
  const general = record.newArea("General", []);
  for (let i = 0; i < 25; i++) assert.equal(record.insertBlock(general, { heading: `Lesson ${String(i).padStart(2, "0")}`, kind: "convention", about: ["a"], noted: "x" }, { general: true }).inserted, true);
  assert.deepEqual(record.insertBlock(general, { heading: "One more", kind: "convention", about: ["a"], noted: "x" }, { general: true }), { full: true });
  assert.ok(record.renderAreaFile(general).startsWith("# General\n\n### Lesson 00\n"), "general.md has no Paths line");
});

test("lessons record: slugs, ids and file paths", () => {
  assert.equal(record.slugOf("  Web Console: server (v2)!  "), "web-console-server-v2");
  assert.equal(record.slugOf("x".repeat(80)).length, 60);
  assert.equal(record.lessonId("activities-games", "Set the seen flag for a new first-run dialog"), "activities-games/set-the-seen-flag-for-a-new-first-run-dialog");
  assert.equal(record.areaFilePath("/repo", "web-console"), path.join("/repo", ".plan2code", "lessons", "web-console.md"));
});

/* ------------------------------------------------------------- the check */

// Fixture secrets are assembled from parts so a scanner on this repository
// never sees one whole.
const SECRETS = {
  "private-key-block": ["-----BEGIN " + "RSA PRIVATE KEY-----", "-----BEGIN PUBLIC KEY-----"],
  "aws-access-key": ["AK" + "IA" + "0".repeat(16), "AK" + "IA" + "0".repeat(10)],
  "github-token": ["gh" + "p_" + "a".repeat(36), "gh" + "p_short"],
  "slack-token": ["xo" + "xb-" + "1".repeat(12), "xox-plain-words"],
  "stripe-key": ["sk" + "_live_" + "a".repeat(24), "sk" + "_test_" + "a".repeat(24)],
  "google-api-key": ["AI" + "za" + "A".repeat(35), "AI" + "za" + "A".repeat(10)],
  "sk-key": ["sk" + "-" + "a1".repeat(12), "the sk-short-name flag"],
  jwt: ["ey" + "JhbGciOi.eyJzdWIi.c2lnbmF0dXJl", "eyJhbGciOi alone"],
  "url-credentials": ["https://" + "user:hunter22" + "@example.com", "https://user@example.com"],
  "assigned-secret": ["password = " + "hunter2hunter2", "password = <your-password>"],
};

test("lessons check: each secret pattern refuses its shape and passes its near miss", () => {
  for (const [name, [bad, near]] of Object.entries(SECRETS)) {
    const r = record.checkText(`Set it to ${bad} in the config`);
    assert.equal(r.refused && r.refused.pattern, name, `${name} refuses`);
    assert.ok(!r.refused.part.includes(bad.slice(5)), `${name}: the output never repeats the secret`);
    assert.ok(r.refused.part.length <= 5, name);
    assert.equal(record.checkText(`Set it to ${near} in the config`).refused, null, `${name} near miss passes`);
  }
  for (const placeholder of ["token: GITHUB_TOKEN", "secret = xxxxxxxxxx", "api key: ********", "password=${DB_PASSWORD}", "token: <api-token-here>"]) {
    assert.equal(record.checkText(placeholder).refused, null, placeholder);
  }
});

test("lessons check: prefixed assignments and a user-less credential URL are refused", () => {
  for (const [bad, name] of [
    ["DB_PASS" + "WORD=hunter2hunter2", "assigned-secret"],
    ["OPENAI_API" + "_KEY=abcd1234efgh5678", "assigned-secret"],
    ["CLIENT_SEC" + "RET: abcd1234efgh5678", "assigned-secret"],
    ["redis://" + ":hunter2hunter2@localhost:6379", "url-credentials"],
    // Uppercase letters with digits are a value, not a variable's name.
    ["API_" + "KEY=K8J2H4G6F9D3S1A5", "assigned-secret"],
    ["pass" + "word: HUNTER2HUNTER2", "assigned-secret"],
    // A keyword that ends a camelCase name, and the key names that follow secret.
    ["dbPass" + "word=hunter2hunter2", "assigned-secret"],
    ["authTo" + "ken=abcd1234efgh5678", "assigned-secret"],
    ["clientSec" + 'ret: "abcd1234efgh5678"', "assigned-secret"],
    ["SECRET" + "_KEY=abcd1234efgh5678", "assigned-secret"],
    ["AWS_SECRET_ACCESS" + "_KEY=wJalrXUtnFEMIabcd1234", "assigned-secret"],
    ["private" + "Key: abcd1234efgh5678", "assigned-secret"],
    // A real value that merely holds filler characters is still a value.
    ["pass" + "word=Sup3rS3cretxxx1", "assigned-secret"],
    ["to" + "ken: abcd1234...efgh", "assigned-secret"],
  ]) {
    assert.equal(record.checkText(`Set ${bad} first`).refused?.pattern, name, bad);
  }
  for (const fine of ["PASSWORD_FILE=/run/secrets/db", "the tokenizer: abcdefghijk", "http://localhost:8080/x"]) assert.equal(record.checkText(fine).refused, null, fine);
});

test("lessons check: no output ever repeats a fixture secret, flags included", () => {
  const dir = repo();
  const store = learningDir();
  for (const [bad] of Object.values(SECRETS)) {
    const r = L(dir, ["check", "--text", `Connect with ${bad}/db`], store);
    assert.equal(r.code, 0, r.stderr);
    assert.ok(r.json.refused, bad);
    assert.ok(!r.stdout.includes(bad), `stdout repeats ${bad}`);
  }
  const url = record.checkText("Connect with https://" + "user:hunter22" + "@example.com/db");
  assert.equal(url.refused.pattern, "url-credentials");
  assert.ok(!url.flags.some((f) => f.part.includes("hunter22")), "the email flag never shows the password half");
});

test("lessons check: flags fire in prose and never inside backticks", () => {
  const prose = record.checkText("Ask Jane Doe or @alice, or write to jane@example.com.");
  assert.deepEqual(prose.flags.map((f) => f.pattern).sort(), ["email", "handle", "person-name"]);
  assert.equal(prose.refused, null);
  const code = record.checkText("Import `@scope/pkg` and call `Jane Doe` with `jane@example.com`.");
  assert.deepEqual(code.flags, []);
});

test("lessons check: the command reports and always exits 0", () => {
  const dir = repo();
  const store = learningDir();
  const r = L(dir, ["check", "--text", "Use the flat keys.", "--why", SECRETS["aws-access-key"][0]], store);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.refused.pattern, "aws-access-key");
  assert.ok(!r.stdout.includes(SECRETS["aws-access-key"][0]), "stdout never repeats the secret");
  const clean = L(dir, ["check", "--text", "Ask Jane Doe."], store).json;
  assert.equal(clean.refused, null);
  assert.deepEqual(clean.flags, [{ pattern: "person-name", part: "Jane Doe" }]);
});

/* ----------------------------------------------------------------- note */

const waitingFiles = (store) =>
  fs.existsSync(store)
    ? fs
        .readdirSync(store, { recursive: true })
        .map(String)
        .filter((f) => /waiting[\\/][^\\/]+\.json$/.test(f))
    : [];

const lesson = (text, extra = []) => ["note", "--type", "lesson", "--text", text, "--kind", "convention", "--about", "src/a.js", "--source", "said", "--skill", "Implement", ...extra];

test("lessons note: each rule refuses with exit 4 invalid-lesson", () => {
  const dir = repo();
  const store = learningDir();
  const cases = [
    ["two sentences", lesson("Use the flat keys. Never browser storage.")],
    ["201 characters", lesson("a".repeat(201))],
    ["unknown kind", ["note", "--type", "lesson", "--text", "One rule", "--kind", "rule", "--about", "src/a.js", "--source", "said", "--skill", "I"]],
    ["a correction with no why", ["note", "--type", "lesson", "--text", "One rule", "--kind", "correction", "--about", "src/a.js", "--source", "said", "--skill", "I"]],
    ["four files", ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", "a.js,b.js,c.js,d.js", "--source", "said", "--skill", "I"]],
    ["a path with ..", ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", "../outside.js", "--source", "said", "--skill", "I"]],
    ["inferred with no seen files", ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", "src/a.js", "--source", "inferred", "--skill", "I"]],
  ];
  for (const [what, args] of cases) {
    const r = L(dir, args, store);
    assert.equal(r.code, 4, `${what}: ${r.stdout}`);
    assert.equal(r.json.error, "invalid-lesson", what);
    assert.ok(r.json.problems.length >= 1, what);
  }
  assert.equal(L(dir, lesson("Call `a.b()` first. Then `c()`, as in `x. Y`"), store).code, 4, "a second sentence outside code still counts");
  assert.equal(L(dir, lesson("Call `x. Y` before the build"), store).code, 0, "a stop inside a code span is not a sentence end");
  write(dir, "src/web/a.js", "");
  assert.equal(L(dir, ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", "src/web,src/a.js", "--source", "said", "--skill", "I"], store).code, 4, "a folder stands alone");
});

test("lessons note: a refused secret exits 5 and writes nothing anywhere", () => {
  const dir = repo();
  const store = learningDir();
  for (const [bad] of Object.values(SECRETS)) {
    const r = L(dir, lesson(`Set it to ${bad} first`), store);
    assert.equal(r.code, 5, r.stdout);
    assert.equal(r.json.error, "secret");
    assert.ok(!r.stdout.includes(bad), "the output never repeats the secret");
  }
  const why = L(dir, lesson("Set the key first", ["--why", `the key is ${SECRETS["github-token"][0]}`]), store);
  assert.equal(why.code, 5);
  const secret = SECRETS["assigned-secret"][0];
  const fields = [
    ["note", "--type", "area", "--name", secret, "--paths", "src/**", "--skill", "Implement"],
    ["note", "--type", "area", "--name", "Web", "--paths", `src/${SECRETS["aws-access-key"][0]}/**`, "--skill", "Implement"],
    lesson("One rule", ["--area", secret]),
    ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", `src/${SECRETS["aws-access-key"][0]}.js`, "--source", "said", "--skill", "Implement"],
    ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", "src/a.js", "--source", "said", "--skill", secret],
  ];
  for (const args of fields) {
    const r = L(dir, args, store);
    assert.equal(r.code, 5, r.stdout);
    assert.equal(r.json.error, "secret");
    assert.ok(!r.stdout.includes(SECRETS["aws-access-key"][0]) && !r.stdout.includes("hunter2hunter2"), r.stdout);
  }
  assert.deepEqual(waitingFiles(store), [], "the waiting folder stays empty");
});

test("lessons note: a skill name with a line break or over 40 characters is refused", () => {
  const dir = repo();
  const store = learningDir();
  for (const skill of ["Implement\n### Injected heading", "x".repeat(41)]) {
    const r = L(dir, ["note", "--type", "lesson", "--text", "One rule", "--kind", "convention", "--about", "src/a.js", "--source", "said", "--skill", skill], store);
    assert.equal(r.code, 4, r.stdout);
    assert.equal(r.json.error, "invalid-lesson");
  }
  assert.deepEqual(waitingFiles(store), []);
});

test("lessons note: does nothing while off or paused, holds the lesson while not set up and on", () => {
  const dir = repo();
  const store = learningDir();
  const notSetUp = L(dir, lesson("Use the flat keys", ["--why", "Ask Jane Doe"]), store);
  assert.equal(notSetUp.code, 0, notSetUp.stderr);
  assert.equal(notSetUp.json.noted, true);
  assert.equal(notSetUp.json.line, "Noted for the end of the run: Use the flat keys");
  assert.deepEqual(notSetUp.json.flags, [{ pattern: "person-name", part: "Jane Doe" }]);
  assert.equal(waitingFiles(store).length, 1);

  settings(dir, { format: 1, learning: "off" });
  const off = L(dir, lesson("Another one"), store);
  assert.deepEqual(off.json, { ok: true, state: "off", active: false, noted: false });
  settings(dir, { format: 1, learning: "on" });
  L(dir, ["pause", "on"], store);
  const paused = L(dir, lesson("Another one"), store);
  assert.equal(paused.code, 0);
  assert.equal(paused.json.noted, false);
  assert.equal(waitingFiles(store).length, 1, "nothing more was written");

  L(dir, ["pause", "off"], store);
  const dry = L(dir, lesson("A dry one", ["--dry-run"]), store);
  assert.equal(dry.json.noted, true);
  assert.equal(waitingFiles(store).length, 1, "--dry-run writes nothing");
});

test("lessons note: an area needs a plain name and supported globs inside the repository", () => {
  const dir = repo();
  const store = learningDir();
  const area = (name, paths) => L(dir, ["note", "--type", "area", "--name", name, "--paths", paths, "--skill", "Implement"], store);
  for (const name of ["General", "!!!"]) {
    const r = area(name, "src/**");
    assert.equal(r.code, 4, name);
    assert.equal(r.json.error, "bad-area", name);
  }
  for (const paths of ["../x/**", "src/[ab]/**", "/abs/**", Array.from({ length: 9 }, (_, i) => `p${i}/**`).join(",")]) {
    const r = area("Web", paths);
    assert.equal(r.code, 4, paths);
    assert.equal(r.json.error, "invalid-area", paths);
  }
  // Each brace alternative must stay inside the repository too.
  for (const paths of ["{..,src}/**", "{/etc,src}/**", "src/{a,..}/**"]) {
    const r = area("Web", paths);
    assert.equal(r.code, 4, paths);
    assert.equal(r.json.error, "invalid-area", paths);
  }
  const ok = area("Web console", "src/web-console/**, scripts/test-web-console-*.mjs");
  assert.equal(ok.code, 0, ok.stderr);
  assert.equal(ok.json.line, "Noted for the end of the run: a new area, Web console");
  assert.equal(waitingFiles(store).length, 1);
  // A brace glob is one glob, not split on its inner comma.
  const brace = area("Apps", "src/{web,api}/**, bin/**");
  assert.equal(brace.code, 0, brace.stdout + brace.stderr);
  const proposed = L(dir, ["list"], store).json.items.find((i) => i.name === "Apps");
  assert.deepEqual(proposed.paths, ["src/{web,api}/**", "bin/**"]);
});

test("lessons record: a Paths line with a brace glob parses whole, round trips and matches", () => {
  const text = "# Apps\nPaths: src/{web,api}/**, bin/**\n\n";
  const area = record.parseAreaFile(text);
  assert.deepEqual(area.paths, ["src/{web,api}/**", "bin/**"]);
  assert.equal(record.renderAreaFile(area), text);
  const dir = repo();
  write(dir, ".plan2code/lessons/apps.md", text);
  assert.equal(record.matchArea(dir, ["src/web/a.js"]).slug, "apps");
  assert.equal(record.matchArea(dir, ["src/other/a.js"]).slug, "general");
});

test("lessons: a rejected kind, source, type, choice or about entry is never echoed", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const secret = SECRETS["aws-access-key"][0];
  const runs = [
    L(dir, ["note", "--type", "lesson", "--text", "A lesson", "--kind", secret, "--about", "src/a.js", "--source", "said", "--skill", "Implement"], store),
    L(dir, ["note", "--type", "lesson", "--text", "A lesson", "--kind", "convention", "--about", "src/a.js", "--source", secret, "--skill", "Implement"], store),
    L(dir, ["note", "--type", secret, "--skill", "Implement"], store),
  ];
  for (const r of runs) {
    assert.notEqual(r.code, 0);
    assert.ok(!(r.stdout + r.stderr).includes(secret), r.stdout + r.stderr);
  }
  assert.equal(waitingFiles(store).length, 0);
  L(dir, lesson("First lesson"), store);
  L(dir, lesson("Second lesson"), store);
  L(dir, lesson("Third lesson"), store);
  const [a, b, c] = idsOf(dir, store, "First lesson", "Second lesson", "Third lesson");
  const r = decide(dir, store, [
    { id: a, choice: secret },
    { id: b, choice: "Reword", text: "Second lesson", kind: secret },
    { id: c, choice: "Reword", text: "Third lesson", about: [{ k: secret }] },
  ]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.deepEqual(
    r.json.results.map((x) => x.outcome),
    ["invalid-choice", "invalid", "invalid"]
  );
  assert.ok(!(r.stdout + r.stderr).includes(secret), r.stdout);
  assert.equal(r.json.stillWaiting, 3);
  const broken = path.join(tmp("lessons-broken"), "d.json");
  fs.writeFileSync(broken, `[{ "id": "x", "choice": "Reword", "text": "${secret}" `);
  const bad = L(dir, ["decide", "--file", broken], store);
  assert.equal(bad.json.error, "invalid-file");
  assert.ok(!(bad.stdout + bad.stderr).includes(secret), "a broken decisions file is never quoted back");
});

test("lessons note: a branch name holding a secret is never stored", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const branch = "fix/tok" + "en=abcdefgh123";
  gitIn(dir)("checkout", "-q", "-b", branch);
  const r = L(dir, lesson("A lesson"), store);
  assert.equal(r.code, 0, r.stderr);
  const files = waitingFiles(store);
  assert.equal(files.length, 1);
  const item = JSON.parse(fs.readFileSync(path.join(store, files[0]), "utf8"));
  assert.equal(item.branch, "");
  assert.ok(!L(dir, ["list"], store).stdout.includes("abcdefgh123"));
});

test("lessons areas --suggest: unshared test map rows that are not area files yet", () => {
  const dir = repo();
  const store = learningDir();
  assert.deepEqual(L(dir, ["areas", "--suggest"], store).json.areas, [], "no AGENTS.md, no suggestions");
  write(
    dir,
    "AGENTS.md",
    [
      "# Agents",
      "",
      "## Test map",
      "",
      "| Area | Paths | Run | Shared |",
      "| --- | --- | --- | --- |",
      "| Web console | `src/web-console/**` | npm test | no |",
      "| Launcher | `src/launcher/**`, `bin/**` | npm test | no |",
      "| Helpers | `scripts/*-helpers.mjs` | npm test | yes |",
      "",
    ].join("\n")
  );
  write(dir, ".plan2code/lessons/launcher.md", "# Launcher\nPaths: src/launcher/**\n");
  const r = L(dir, ["areas", "--suggest"], store);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.areas, [{ name: "Web console", paths: ["src/web-console/**"] }]);
});

/* ------------------------------------------------------- list and decide */

const ids = (dir, store) => L(dir, ["list"], store).json.items.map((i) => i.id);
// Items noted under the pinned clock share one time, so their order is the
// random part of the id: find them by their text (or an area's name).
const idsOf = (dir, store, ...texts) => {
  const items = L(dir, ["list"], store).json.items;
  return texts.map((t) => items.find((i) => i.text === t || i.name === t).id);
};
const decide = (dir, store, decisions, extra = []) => {
  const file = path.join(tmp("lessons-decide"), "decisions.json");
  fs.writeFileSync(file, JSON.stringify(decisions));
  return L(dir, ["decide", "--file", file, ...extra], store);
};

test("lessons list: origin lines, the other-branch note and the main-branch opening", () => {
  const dir = repo();
  const store = learningDir();
  const g = gitIn(dir);
  settings(dir, { format: 1, learning: "on" });
  g("checkout", "-q", "-b", "feature/x");
  write(dir, "src/only-here.js", "x\n");
  g("add", "-A");
  g("commit", "-q", "-m", "feature file");
  L(dir, ["note", "--type", "lesson", "--text", "Keep it short", "--kind", "convention", "--about", "src/only-here.js", "--source", "inferred", "--seen", "src/only-here.js,src/b.js", "--skill", "Implement"], store);
  const onFeature = L(dir, ["list"], store).json;
  assert.equal(onFeature.opening, null, "not on the default branch");
  assert.equal(onFeature.items[0].note, "");
  assert.equal(onFeature.items[0].origin, "Seen in the code, in src/only-here.js, src/b.js.");

  g("checkout", "-q", "main");
  L(dir, lesson("Said aloud"), store);
  const r = L(dir, ["list"], store);
  assert.equal(r.code, 0, r.stderr);
  const inferred = r.json.items.find((i) => i.text === "Keep it short");
  const said = r.json.items.find((i) => i.text === "Said aloud");
  assert.equal(r.json.opening, "You are on main: kept lessons will be uncommitted changes here.");
  assert.equal(inferred.note, "Noted on feature/x. Its files are not on this branch.");
  assert.deepEqual(inferred.choices, ["Keep", "Reword", "Drop"]);
  assert.equal(said.origin, "You said this.");
  assert.equal(said.note, "");
  assert.equal(said.area, "General");
  assert.equal(r.json.card.kind, "lessons");
  assert.equal(r.json.card.opening, r.json.opening);
  assert.deepEqual(
    r.json.card.rows.map((row) => row.id),
    r.json.items.map((i) => i.id)
  );
  assert.deepEqual(
    r.json.rounds.map((round) => round.type),
    ["lesson"]
  );

  const empty = L(repo(), ["list"], learningDir()).json;
  assert.deepEqual(empty.items, []);
  assert.equal(empty.card, null);
});

test("lessons list: an item whose text is now refused is listed without Keep and without the secret", () => {
  const dir = repo();
  const store = learningDir();
  waiting(dir, store, daysBefore(1), "20260802-140500-aaaaaa");
  const file = fs
    .readdirSync(store, { recursive: true })
    .map(String)
    .find((f) => f.endsWith("aaaaaa.json"));
  const full = path.join(store, file);
  const item = JSON.parse(fs.readFileSync(full, "utf8"));
  fs.writeFileSync(full, JSON.stringify({ ...item, text: `Use ${SECRETS["stripe-key"][0]} here`, kind: "convention", about: ["a.js"], source: "said", skill: "Implement" }));
  const r = L(dir, ["list"], store);
  assert.equal(r.json.items[0].refused.pattern, "stripe-key");
  assert.deepEqual(r.json.items[0].choices, ["Reword", "Drop"]);
  assert.ok(!r.stdout.includes(SECRETS["stripe-key"][0]));
});

test("lessons decide: Keep writes a block at its alphabetical place, nothing staged", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  write(dir, ".plan2code/lessons/web-console.md", AREA_TEXT);
  L(dir, ["note", "--type", "lesson", "--text", "Build the skills before the tests", "--kind", "command", "--about", "src/web-console/x.mjs", "--source", "said", "--skill", "Implement"], store);
  const r = decide(dir, store, [{ id: ids(dir, store)[0], choice: "Keep" }]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.written, [".plan2code/lessons/web-console.md"]);
  assert.equal(r.json.results[0].outcome, "kept");
  assert.equal(r.json.results[0].lesson, "web-console/build-the-skills-before-the-tests");
  assert.equal(r.json.closing, "Kept 1. 0 still waiting.");
  const text = read(dir, ".plan2code/lessons/web-console.md");
  const at = AREA_TEXT.indexOf("### Cut");
  assert.equal(text, AREA_TEXT.slice(0, at) + "### Build the skills before the tests\n- Kind: command\n- About: src/web-console/x.mjs\n- Noted: 2026-08-03, Implement\n\n" + AREA_TEXT.slice(at));
  assert.deepEqual(waitingFiles(store), []);
  assert.equal(gitIn(dir)("diff", "--cached", "--name-only").trim(), "", "nothing staged");
});

test("lessons decide: two branches keeping different lessons in one area merge without a conflict", () => {
  const dir = repo();
  const store = learningDir();
  const g = gitIn(dir);
  settings(dir, { format: 1, learning: "on" });
  write(dir, ".plan2code/lessons/web-console.md", "# Web console\nPaths: src/web-console/**\n\n### Middle lesson\n- Kind: convention\n- About: src/web-console/m.mjs\n- Noted: 2026-11-01, Implement\n");
  g("add", "-A");
  g("commit", "-q", "-m", "area");
  const keepOn = (branch, text) => {
    g("checkout", "-q", "-b", branch, "main");
    L(dir, ["note", "--type", "lesson", "--text", text, "--kind", "convention", "--about", "src/web-console/a.mjs", "--source", "said", "--skill", "Implement"], store);
    assert.equal(decide(dir, store, [{ id: ids(dir, store)[0], choice: "Keep" }]).json.results[0].outcome, "kept");
    g("commit", "-q", "-am", branch);
  };
  keepOn("a", "Alpha lesson first");
  keepOn("b", "Zulu lesson last");
  g("checkout", "-q", "a");
  g("merge", "-q", "--no-edit", "b");
  const headings = read(dir, ".plan2code/lessons/web-console.md").match(/^### .*$/gm);
  assert.deepEqual(headings, ["### Alpha lesson first", "### Middle lesson", "### Zulu lesson last"]);
});

test("lessons decide: the 26th general lesson comes back as needsRoom and keeps waiting", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const blocks = Array.from({ length: 25 }, (_, i) => `### General lesson ${String(i).padStart(2, "0")}\n- Kind: convention\n- About: a.js\n- Noted: 2026-11-01, Implement\n`);
  write(dir, ".plan2code/lessons/general.md", "# General\n\n" + blocks.join("\n"));
  L(dir, lesson("One lesson too many"), store);
  const r = decide(dir, store, [{ id: ids(dir, store)[0], choice: "Keep" }]);
  assert.equal(r.json.results[0].outcome, "needsRoom");
  assert.equal(r.json.stillWaiting, 1);
  assert.deepEqual(r.json.written, []);
  assert.equal(r.json.closing, "Nothing decided. 1 still waiting.");
  assert.equal(read(dir, ".plan2code/lessons/general.md").match(/^### /gm).length, 25);
});

test("lessons decide: a lesson whose proposed area is dropped lands in a matching area, else general.md", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  write(dir, ".plan2code/lessons/source.md", "# Source\nPaths: src/**\n");
  L(dir, ["note", "--type", "area", "--name", "Web", "--paths", "src/web/**", "--skill", "Implement"], store);
  L(dir, ["note", "--type", "lesson", "--text", "Web lesson", "--kind", "convention", "--about", "src/web/a.js", "--source", "said", "--skill", "Implement", "--area", "Web"], store);
  L(dir, ["note", "--type", "lesson", "--text", "Docs lesson", "--kind", "convention", "--about", "docs/a.md", "--source", "said", "--skill", "Implement", "--area", "Web"], store);
  const listed = L(dir, ["list"], store).json;
  assert.deepEqual(
    listed.rounds.map((round) => round.type),
    ["area", "lesson"]
  );
  assert.equal(listed.items.find((i) => i.text === "Web lesson").area, "Web", "the proposed area, while it waits");
  const [areaId, webId, docsId] = idsOf(dir, store, "Web", "Web lesson", "Docs lesson");
  // Lessons first in the file: areas are still decided first.
  const r = decide(dir, store, [
    { id: webId, choice: "Keep" },
    { id: docsId, choice: "Keep" },
    { id: areaId, choice: "Drop" },
  ]);
  assert.equal(r.code, 0, r.stderr);
  const by = Object.fromEntries(r.json.results.map((x) => [x.id, x]));
  assert.equal(by[areaId].outcome, "dropped");
  assert.equal(by[webId].area, "Source");
  assert.equal(by[docsId].area, "General");
  assert.deepEqual(r.json.written, [".plan2code/lessons/general.md", ".plan2code/lessons/source.md"]);
  assert.equal(r.json.closing, "Kept 2, dropped 1. 0 still waiting.");
});

test("lessons decide: Create then Keep into the new area, Rename, and unknown ids", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  L(dir, ["note", "--type", "area", "--name", "Web", "--paths", "src/web/**", "--skill", "Implement"], store);
  L(dir, ["note", "--type", "area", "--name", "Docs", "--paths", "docs/**", "--skill", "Implement"], store);
  L(dir, ["note", "--type", "lesson", "--text", "Web lesson", "--kind", "convention", "--about", "src/web/a.js", "--source", "said", "--skill", "Implement"], store);
  const [web, docs, one] = idsOf(dir, store, "Web", "Docs", "Web lesson");
  const r = decide(dir, store, [
    { id: one, choice: "Keep" },
    { id: web, choice: "Create" },
    { id: docs, choice: "Rename", name: "Written docs" },
    { id: "20200101-000000-ffffff", choice: "Keep" },
  ]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.results.find((x) => x.id === one).area, "Web");
  assert.equal(r.json.results.find((x) => x.id === "20200101-000000-ffffff").outcome, "unknown");
  assert.equal(read(dir, ".plan2code/lessons/written-docs.md"), "# Written docs\nPaths: docs/**\n");
  assert.ok(read(dir, ".plan2code/lessons/web.md").startsWith("# Web\nPaths: src/web/**\n\n### Web lesson\n"));
  assert.equal(r.json.closing, "Kept 1, created 2 areas. 0 still waiting.");
});

test("lessons decide: Reword with a secret is refused and keeps waiting while another item is kept", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  L(dir, lesson("First lesson"), store);
  L(dir, lesson("Second lesson"), store);
  const [first, second] = ids(dir, store);
  const r = decide(dir, store, [
    { id: first, choice: "Reword", text: `Use ${SECRETS["github-token"][0]} for the push` },
    { id: second, choice: "Reword", text: "Second lesson, reworded", why: "it read badly" },
  ]);
  assert.equal(r.code, 0, r.stderr);
  const by = Object.fromEntries(r.json.results.map((x) => [x.id, x]));
  assert.equal(by[first].outcome, "refused");
  assert.equal(by[first].pattern, "github-token");
  assert.equal(by[second].outcome, "reworded");
  assert.ok(!r.stdout.includes(SECRETS["github-token"][0]));
  assert.equal(r.json.stillWaiting, 1);
  assert.equal(r.json.closing, "Kept 1 (1 reworded). 1 still waiting.");
  assert.ok(!read(dir, ".plan2code/lessons/general.md").includes("ghp"), "the secret never reached the file");
});

test("lessons decide: a Rename holding a secret is refused, and a bad about in one item never loses another", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  L(dir, ["note", "--type", "area", "--name", "Web", "--paths", "src/web/**", "--skill", "Implement"], store);
  L(dir, lesson("Kept lesson"), store);
  L(dir, lesson("Broken lesson"), store);
  const [area, kept, broken] = idsOf(dir, store, "Web", "Kept lesson", "Broken lesson");
  const r = decide(dir, store, [
    { id: area, choice: "Rename", name: SECRETS["assigned-secret"][0] },
    { id: kept, choice: "Keep" },
    { id: broken, choice: "Reword", text: "Broken lesson", about: [1] },
  ]);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  const by = Object.fromEntries(r.json.results.map((x) => [x.id, x]));
  assert.equal(by[area].outcome, "refused");
  assert.equal(by[kept].outcome, "kept");
  assert.equal(by[broken].outcome, "invalid");
  assert.ok(!r.stdout.includes("hunter2hunter2"));
  assert.equal(r.json.stillWaiting, 2);
  assert.deepEqual(r.json.written, [".plan2code/lessons/general.md"]);
  assert.equal(fs.readdirSync(path.join(dir, ".plan2code", "lessons")).length, 1, "no area file named after the secret");
});

test("lessons decide: --dry-run changes no file and no waiting item", () => {
  const dir = repo();
  const store = learningDir();
  const g = gitIn(dir);
  settings(dir, { format: 1, learning: "on" });
  g("add", "-A");
  g("commit", "-q", "-m", "on");
  L(dir, ["note", "--type", "area", "--name", "Web", "--paths", "src/web/**", "--skill", "Implement"], store);
  L(dir, lesson("A lesson"), store);
  const before = waitingFiles(store).sort();
  const [area, one] = idsOf(dir, store, "Web", "A lesson");
  const r = decide(
    dir,
    store,
    [
      { id: area, choice: "Create" },
      { id: one, choice: "Keep" },
    ],
    ["--dry-run"]
  );
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.dryRun, true);
  assert.deepEqual(r.json.written, []);
  assert.equal(r.json.closing, "Kept 1, created 1 area. 0 still waiting.");
  assert.equal(g("status", "--porcelain", "--untracked-files=all").trim(), "");
  assert.deepEqual(waitingFiles(store).sort(), before);
});

test("lessons decide: a bad decisions file and a choice that does not fit", () => {
  const dir = repo();
  const store = learningDir();
  assert.equal(L(dir, ["decide", "--file", path.join(tmp("lessons-none"), "missing.json")], store).code, 3);
  const bad = path.join(tmp("lessons-bad"), "d.json");
  fs.writeFileSync(bad, "{ nope");
  assert.equal(L(dir, ["decide", "--file", bad], store).json.error, "invalid-file");
  L(dir, lesson("A lesson"), store);
  const r = decide(dir, store, [{ id: ids(dir, store)[0], choice: "Create" }]);
  assert.equal(r.json.results[0].outcome, "invalid-choice");
  assert.equal(r.json.stillWaiting, 1);
});


/* ------------------------------------------- marking: git history as the clock */

// One area file with one lesson about src/app.js. Each fixture is built once
// (copyFixture) and copied per test.
const WEB_AREA = "# Web\nPaths: src/**\n\n### Keep the handler small\n- Kind: convention\n- About: src/app.js\n- Noted: 2026-11-01, Implement\n";
const WEB_FILE = ".plan2code/lessons/web.md";
const commitAll = (g, msg) => {
  g("add", "-A");
  g("commit", "-q", "-m", msg);
};
// A base commit with src/app.js and README.md on main.
const baseRepo = (dir) => {
  const g = gitInit(dir);
  write(dir, "README.md", "# Fixture\n");
  write(dir, "src/app.js", "export const app = 1;\n");
  commitAll(g, "base");
  return g;
};
const marks = (dir) => Object.fromEntries(record.markLessons(dir, record.readLessons(dir)).map((l) => [l.id, { marked: l.marked, gone: l.gone }]));
const LESSON_ID = "web/keep-the-handler-small";

// (a) the lesson, then an edit to its file in a later commit.
const markA = () =>
  copyFixture("mark-a", "mark-a", (dir) => {
    const g = baseRepo(dir);
    write(dir, WEB_FILE, WEB_AREA);
    commitAll(g, "lesson");
    write(dir, "src/app.js", "export const app = 2;\n");
    commitAll(g, "edit");
  });

test("lessons marking (a): an edit committed after the lesson marks it", () => {
  assert.deepEqual(marks(markA())[LESSON_ID], { marked: true, gone: false });
});

test("lessons marking (b): the lesson and the edit in one commit do not mark it", () => {
  const dir = copyFixture("mark-b", "mark-b", (d) => {
    const g = baseRepo(d);
    write(d, WEB_FILE, WEB_AREA);
    write(d, "src/app.js", "export const app = 2;\n");
    commitAll(g, "lesson and edit");
  });
  assert.deepEqual(marks(dir)[LESSON_ID], { marked: false, gone: false });
});

test("lessons marking (c): a squash merge of a branch that kept the lesson and then edited does not mark it on main", () => {
  const dir = copyFixture("mark-c", "mark-c", (d) => {
    const g = baseRepo(d);
    g("checkout", "-q", "-b", "feature");
    write(d, WEB_FILE, WEB_AREA);
    commitAll(g, "lesson");
    write(d, "src/app.js", "export const app = 2;\n");
    commitAll(g, "edit");
    g("checkout", "-q", "main");
    write(d, "README.md", "# Fixture moved\n");
    commitAll(g, "main moves");
  });
  const g = gitIn(dir);
  g("checkout", "-q", "feature");
  assert.equal(marks(dir)[LESSON_ID].marked, true, "marked on the branch, where the edit came after the lesson");
  g("checkout", "-q", "main");
  g("merge", "-q", "--squash", "feature");
  g("commit", "-q", "-m", "squash feature");
  assert.equal(marks(dir)[LESSON_ID].marked, false, "one squash commit holds both");
});

test("lessons marking (d): a rebase alone does not mark a lesson; a later edit does", () => {
  const dir = copyFixture("mark-d", "mark-d", (d) => {
    const g = baseRepo(d);
    g("checkout", "-q", "-b", "feature");
    write(d, "src/app.js", "export const app = 2;\n");
    commitAll(g, "edit");
    write(d, WEB_FILE, WEB_AREA);
    commitAll(g, "lesson");
    g("checkout", "-q", "main");
    write(d, "README.md", "# Fixture moved\n");
    commitAll(g, "main moves");
    g("checkout", "-q", "feature");
  });
  const g = gitIn(dir);
  assert.equal(marks(dir)[LESSON_ID].marked, false, "before the rebase");
  g("rebase", "-q", "main");
  assert.equal(marks(dir)[LESSON_ID].marked, false, "after the rebase");
  write(dir, "src/app.js", "export const app = 3;\n");
  commitAll(g, "later edit");
  assert.equal(marks(dir)[LESSON_ID].marked, true, "after a later edit");
});

test("lessons marking (e): a shallow clone leaves the lesson unmarked", () => {
  const source = markA();
  const clone = path.join(tmp("mark-e"), "clone");
  gitIn(path.dirname(clone))("clone", "-q", "--depth", "1", `file:///${slashed(source).replace(/^\/+/, "")}`, clone);
  const blame = record.blockCommits(clone, path.join(clone, WEB_FILE), record.readLessons(clone).map((l) => l.block));
  assert.equal(blame[0].boundary, true, "the shallow history's edge");
  assert.deepEqual(marks(clone)[LESSON_ID], { marked: false, gone: false });
});

test("lessons marking (f): an uncommitted new block beside a committed edit is not marked", () => {
  const dir = markA();
  write(dir, WEB_FILE, WEB_AREA + "\n### Name the handler after its route\n- Kind: convention\n- About: src/app.js\n- Noted: 2026-11-02, Implement\n");
  const m = marks(dir);
  assert.deepEqual(m["web/name-the-handler-after-its-route"], { marked: false, gone: false });
  assert.equal(m[LESSON_ID].marked, true, "the committed block beside it still is");
  const blame = record.blockCommits(dir, path.join(dir, WEB_FILE), record.readLessons(dir).map((l) => l.block));
  assert.deepEqual(
    blame.map((b) => b.uncommitted),
    [false, true]
  );
});

test("lessons marking (g): a folder with no .git is not marked and raises no error", () => {
  const dir = tmp("mark-g");
  write(dir, WEB_FILE, WEB_AREA);
  write(dir, "src/app.js", "x\n");
  assert.equal(record.blockCommits(dir, path.join(dir, WEB_FILE), record.readLessons(dir).map((l) => l.block)), null);
  assert.deepEqual(marks(dir)[LESSON_ID], { marked: false, gone: false });
});

test("lessons marking (h): a lesson whose only About file was deleted is gone", () => {
  const dir = markA();
  const g = gitIn(dir);
  g("rm", "-q", "src/app.js");
  g("commit", "-q", "-m", "delete app");
  assert.equal(marks(dir)[LESSON_ID].gone, true);
});

test("lessons marking: a folder About is marked by an edit to a file under it", () => {
  const dir = copyFixture("mark-folder", "mark-folder", (d) => {
    const g = baseRepo(d);
    write(d, WEB_FILE, WEB_AREA.replace("- About: src/app.js", "- About: src/"));
    commitAll(g, "lesson");
    write(d, "src/other.js", "x\n");
    commitAll(g, "add a file under src");
  });
  assert.equal(marks(dir)[LESSON_ID].marked, true);
});

test("lessons marking: a lesson in a repository's first commit is a real commit, not a boundary", () => {
  const dir = copyFixture("mark-root", "mark-root", (d) => {
    const g = gitInit(d);
    write(d, "src/app.js", "x\n");
    write(d, WEB_FILE, WEB_AREA);
    commitAll(g, "first");
    write(d, "src/app.js", "y\n");
    commitAll(g, "edit");
  });
  assert.equal(marks(dir)[LESSON_ID].marked, true);
});

/* ------------------------------------------------------------------ read */

const block = (heading, about, why = "") => `### ${heading}\n- Kind: convention\n- About: ${about}\n${why ? `- Why: ${why}\n` : ""}- Noted: 2026-11-01, Implement\n`;
// Learning on, committed on main: two general lessons, one for Web (src/web/**)
// and two for Source (src/**), which overlap.
const readRepo = () =>
  copyFixture("lessons-read", "read-repo", (dir) => {
    const g = gitInit(dir);
    write(dir, ".plan2code/settings.json", JSON.stringify({ format: 1, learning: "on" }));
    write(dir, "src/web/page.js", "x\n");
    write(dir, "src/core.js", "x\n");
    write(dir, "docs/a.md", "x\n");
    write(dir, ".plan2code/lessons/general.md", "# General\n\n" + block("Answer in US English", "README.md") + "\n" + block("Run the targeted suites", "scripts/", "The full run is slow."));
    write(dir, ".plan2code/lessons/web.md", "# Web\nPaths: src/web/**\n\n" + block("Draw the page from state", "src/web/page.js"));
    write(dir, ".plan2code/lessons/source.md", "# Source\nPaths: src/**\n\n" + block("Keep modules small", "src/core.js") + "\n" + block("Name files in kebab case", "src/"));
    write(dir, "README.md", "# R\n");
    write(dir, "scripts/x.mjs", "x\n");
    commitAll(g, "init");
  });

const storeListing = (store) => (fs.existsSync(store) ? fs.readdirSync(store, { recursive: true }).map(String).sort() : []);

test("lessons read: no paths and no changes give general only, and read writes nothing", () => {
  const dir = readRepo();
  const store = learningDir();
  const before = { status: gitIn(dir)("status", "--porcelain"), store: storeListing(store) };
  const r = L(dir, ["read"], store);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.state, "on");
  assert.deepEqual(r.json.areas, []);
  assert.deepEqual(r.json.general, [
    { id: "general/answer-in-us-english", text: "Answer in US English", why: "", marked: false, gone: false },
    { id: "general/run-the-targeted-suites", text: "Run the targeted suites", why: "The full run is slow.", marked: false, gone: false },
  ]);
  assert.equal(r.json.line, "Read 2 general lessons; none yet for these files.");
  assert.deepEqual(r.json.logLines, []);
  assert.equal(r.json.headsUp, undefined, "nothing waiting");
  assert.deepEqual(record.decodeRun(r.json.run), ["general"]);
  assert.deepEqual({ status: gitIn(dir)("status", "--porcelain"), store: storeListing(store) }, before, "read writes nothing");
});

test("lessons read: overlapping areas both return, and a second call hands over only the new area", () => {
  const dir = readRepo();
  const store = learningDir();
  const first = L(dir, ["read", "--paths", "src/web/page.js"], store).json;
  assert.deepEqual(
    first.areas.map((a) => [a.name, a.slug, a.lessons.length]),
    [
      ["Source", "source", 2],
      ["Web", "web", 1],
    ]
  );
  assert.equal(first.line, "Read 2 general lessons and 3 for Source and Web.");
  const lesson = first.areas[1].lessons[0];
  assert.deepEqual(Object.keys(lesson).sort(), ["gone", "id", "marked", "text", "why"], "two lines of content and the two marks, nothing else");

  // Only Source first, then the web folder: Web alone, with no general list.
  const one = L(dir, ["read", "--paths", "src/core.js"], store).json;
  assert.deepEqual(
    one.areas.map((a) => a.slug),
    ["source"]
  );
  assert.equal(one.line, "Read 2 general lessons and 2 for Source.");
  const two = L(dir, ["read", "--paths", "src/web/", "--run", one.run], store).json;
  assert.deepEqual(
    two.areas.map((a) => a.slug),
    ["web"]
  );
  assert.equal(two.general, null);
  assert.equal(two.line, "Read 1 more for Web.");
  assert.equal(two.logLines, undefined, "a later call carries no first-call extras");
  const three = L(dir, ["read", "--paths", "src/web/page.js", "--run", two.run], store).json;
  assert.deepEqual(three.areas, []);
  assert.equal(three.line, "", "nothing new matched");
});

test("lessons read: the changed files on the branch pick the areas", () => {
  const dir = readRepo();
  const store = learningDir();
  const g = gitIn(dir);
  g("checkout", "-q", "-b", "feature/x");
  write(dir, "src/web/page.js", "changed\n");
  commitAll(g, "change the page");
  const r = L(dir, ["read"], store).json;
  assert.deepEqual(
    r.areas.map((a) => a.slug),
    ["source", "web"]
  );
});

test("lessons read: changedFiles on a feature branch and on the default branch", () => {
  const dir = readRepo();
  const g = gitIn(dir);
  write(dir, "docs/new.md", "x\n");
  assert.deepEqual(record.changedFiles(dir), ["docs/new.md"], "on main: git status only");
  g("checkout", "-q", "-b", "feature/x");
  commitAll(g, "add docs");
  write(dir, "src/core.js", "changed\n");
  fs.renameSync(path.join(dir, "docs/a.md"), path.join(dir, "docs/b.md"));
  assert.deepEqual(record.changedFiles(dir), ["docs/a.md", "docs/b.md", "docs/new.md", "src/core.js"], "the merge base diff plus git status");
  assert.deepEqual(record.changedFiles(tmp("changed-nogit")), [], "outside git");
});

test("lessons read: every form of the line, singular and plural", () => {
  assert.equal(record.readLine({ first: true, general: 1, areas: [], empty: false }), "Read 1 general lesson; none yet for these files.");
  assert.equal(record.readLine({ first: true, general: 3, areas: [], empty: false }), "Read 3 general lessons; none yet for these files.");
  assert.equal(record.readLine({ first: true, general: 1, areas: [{ name: "Web", count: 1 }], empty: false }), "Read 1 general lesson and 1 for Web.");
  assert.equal(
    record.readLine({
      first: true,
      general: 4,
      areas: [
        { name: "A", count: 2 },
        { name: "B", count: 0 },
        { name: "C", count: 1 },
        { name: "D", count: 3 },
      ],
      empty: false,
    }),
    "Read 4 general lessons and 6 for A, C and D."
  );
  assert.equal(record.readLine({ first: true, general: 0, areas: [], empty: true }), "No lessons yet.");
  assert.equal(record.readLine({ first: false, general: 0, areas: [{ name: "Web", count: 1 }] }), "Read 1 more for Web.");
  assert.equal(
    record.readLine({
      first: false,
      general: 0,
      areas: [
        { name: "Web", count: 2 },
        { name: "API", count: 1 },
      ],
    }),
    "Read 3 more for Web and API."
  );
  assert.equal(record.readLine({ first: false, general: 0, areas: [{ name: "Web", count: 0 }] }), "");
  assert.equal(record.headsUpLine(1, 1), "1 lesson waiting from an earlier run (oldest 1 day). Review now or Later.");
  assert.equal(record.headsUpLine(3, 0), "3 lessons waiting from an earlier run (oldest 0 days). Review now or Later.");
  assert.equal(record.headsUpLine(2, 12), "2 lessons waiting from an earlier run (oldest 12 days). Review now or Later.");

  const empty = repo();
  settings(empty, { format: 1, learning: "on" });
  assert.equal(L(empty, ["read"], learningDir()).json.line, "No lessons yet.");
});

test("lessons read: headsUp on the first call, left out under --from-banner and on a later call", () => {
  const dir = readRepo();
  const store = learningDir();
  waiting(dir, store, daysBefore(3));
  waiting(dir, store, daysBefore(1));
  const r = L(dir, ["read"], store).json;
  assert.deepEqual(r.headsUp, { count: 2, oldestDays: 3, line: "2 lessons waiting from an earlier run (oldest 3 days). Review now or Later." });
  assert.equal(L(dir, ["read", "--from-banner"], store).json.headsUp, undefined);
  assert.equal(L(dir, ["read", "--run", r.run], store).json.headsUp, undefined);
});

test("lessons read: not on returns no lessons; paused says so; not set up still returns run; a bad handle is exit 2", () => {
  const dir = readRepo();
  const store = learningDir();
  assert.equal(L(dir, ["pause", "on"], store).code, 0);
  assert.deepEqual(L(dir, ["read"], store).json, { ok: true, state: "paused", active: false, line: "Learning is paused for you." });
  settings(dir, { format: 1, learning: "off" });
  assert.deepEqual(L(dir, ["read"], store).json, { ok: true, state: "off", active: false, line: "" });
  fs.rmSync(path.join(dir, ".plan2code/settings.json"));
  const fresh = L(dir, ["read"], store).json;
  assert.equal(fresh.state, "not-set-up");
  assert.equal(fresh.line, "");
  assert.deepEqual(record.decodeRun(fresh.run), []);
  assert.equal(fresh.general, undefined);
  const enc = (s) => "r1." + Buffer.from(s).toString("base64url");
  for (const bad of ["nope", "r1.!!", enc("{}"), enc(JSON.stringify(["../x"]))]) {
    const r = L(dir, ["read", "--run", bad], store);
    assert.equal(r.code, 2, bad);
    assert.equal(r.json.error, "bad-run", bad);
  }
});

test("lessons read: with no git to find, lessons come back unmarked and exit 0", () => {
  const dir = markA();
  settings(dir, { format: 1, learning: "on" });
  const env = scrubbedEnv({ PLAN2CODE_NOW: NOW, PLAN2CODE_LEARNING_DIR: learningDir() });
  for (const k of Object.keys(env)) if (/^path$/i.test(k)) delete env[k];
  env.PATH = "";
  const r = spawnSync(process.execPath, [path.join(SKILLS, "plan2code-quick-task", "scripts", "lessons.mjs"), "read", "--paths", "src/app.js"], { cwd: dir, encoding: "utf8", env });
  assert.equal(r.status, 0, r.stderr);
  const json = JSON.parse(r.stdout);
  assert.deepEqual(json.areas[0].lessons[0], { id: LESSON_ID, text: "Keep the handler small", why: "", marked: false, gone: false });
  assert.equal(L(dir, ["read", "--paths", "src/app.js"], learningDir()).json.areas[0].lessons[0].marked, true, "with git, the same lesson is marked");
});

/* ------------------------------------------------ doubts, gone and report */

const doubt = (target, found = "The handler now does three things.") => ["note", "--type", "doubt", "--target", target, "--found", found, "--skill", "Implement"];

test("lessons note doubt: validated, written once per lesson, and listed with the saved lesson", () => {
  const dir = markA();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const missing = L(dir, doubt("web/no-such-lesson"), store);
  assert.equal(missing.code, 4);
  assert.equal(missing.json.error, "invalid-doubt");
  const two = L(dir, doubt(LESSON_ID, "It grew. It now routes too."), store);
  assert.equal(two.code, 4, "found is one sentence");
  const secret = L(dir, doubt(LESSON_ID, `It reads ${SECRETS["stripe-key"][0]} now.`), store);
  assert.equal(secret.code, 5);
  assert.ok(!secret.stdout.includes(SECRETS["stripe-key"][0]));
  assert.deepEqual(waitingFiles(store), [], "nothing written for a refused doubt");

  const r = L(dir, doubt(LESSON_ID), store);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.noted, true);
  assert.equal(r.json.line, `Noted for the end of the run: a doubt about ${LESSON_ID}`);
  const again = L(dir, doubt(LESSON_ID, "Something else."), store);
  assert.equal(again.json.noted, false);
  assert.equal(again.json.already, true);
  assert.equal(again.json.id, r.json.id);
  assert.equal(waitingFiles(store).length, 1, "a second doubt for the same lesson is not written");

  const list = L(dir, ["list"], store).json;
  assert.equal(list.items.length, 1);
  const item = list.items[0];
  assert.equal(item.type, "doubt");
  assert.equal(item.heading, "This lesson may no longer be true:");
  assert.equal(item.text, "Keep the handler small");
  assert.equal(item.found, "The handler now does three things.");
  assert.deepEqual(item.choices, ["Keep", "Reword", "Retire"]);
  assert.equal(item.area, "Web");
  assert.deepEqual(
    list.rounds.map((round) => round.type),
    ["doubt"]
  );
  assert.equal(list.card.rows[0].origin, "This lesson may no longer be true: The handler now does three things.");
});

test("lessons list: a saved lesson whose files are gone is listed with nothing waiting", () => {
  const dir = markA();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  fs.rmSync(path.join(dir, "src/app.js"));
  const list = L(dir, ["list"], store).json;
  assert.deepEqual(
    list.items.map((i) => [i.id, i.type, i.heading, i.choices.join(",")]),
    [[`gone:${LESSON_ID}`, "gone", "Its files no longer exist.", "Keep,Reword,Retire"]]
  );
  // A waiting doubt about the same lesson stands in for it.
  fs.writeFileSync(path.join(dir, "src/app.js"), "back\n");
  L(dir, doubt(LESSON_ID), store);
  fs.rmSync(path.join(dir, "src/app.js"));
  assert.deepEqual(
    L(dir, ["list"], store).json.items.map((i) => i.type),
    ["doubt"]
  );
});

test("lessons decide: a doubt kept moves the checked date and nothing else, and the commit unmarks it", () => {
  const dir = markA();
  const store = learningDir();
  const g = gitIn(dir);
  settings(dir, { format: 1, learning: "on" });
  write(dir, WEB_FILE, WEB_AREA.replace("- Noted: 2026-11-01, Implement", "- Noted: 2026-11-01, Implement, checked 2026-11-05"));
  commitAll(g, "an earlier check");
  write(dir, "src/app.js", "export const app = 9;\n");
  commitAll(g, "edit after the check");
  assert.equal(marks(dir)[LESSON_ID].marked, true);
  L(dir, doubt(LESSON_ID), store);
  const r = decide(dir, store, [{ id: ids(dir, store)[0], choice: "Keep" }]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.results[0].outcome, "kept");
  assert.equal(r.json.closing, "Kept 1. 0 still waiting.");
  assert.deepEqual(r.json.written, [WEB_FILE]);
  assert.equal(read(dir, WEB_FILE), WEB_AREA.replace("- Noted: 2026-11-01, Implement", "- Noted: 2026-11-01, Implement, checked 2026-08-03"));
  assert.deepEqual(waitingFiles(store), []);
  commitAll(g, "keep the lesson");
  assert.equal(marks(dir)[LESSON_ID].marked, false, "the block's own line moved past the edit");
});

test("lessons decide: Reword a doubted lesson re-sorts it, and Retire empties and removes the area file", () => {
  const dir = markA();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  write(dir, WEB_FILE, WEB_AREA + "\n### Name the handler after its route\n- Kind: convention\n- About: src/app.js\n- Noted: 2026-11-02, Implement\n");
  L(dir, doubt(LESSON_ID), store);
  const reworded = decide(dir, store, [{ id: ids(dir, store)[0], choice: "Reword", text: "Answer from one small handler" }]);
  assert.equal(reworded.json.results[0].outcome, "reworded", JSON.stringify(reworded.json.results));
  assert.equal(reworded.json.results[0].lesson, "web/answer-from-one-small-handler");
  assert.deepEqual(read(dir, WEB_FILE).match(/^### .*$/gm), ["### Answer from one small handler", "### Name the handler after its route"]);
  assert.match(read(dir, WEB_FILE), /### Answer from one small handler\n- Kind: convention\n- About: src\/app.js\n- Noted: 2026-11-01, Implement, checked 2026-08-03\n/);

  fs.rmSync(path.join(dir, "src/app.js"));
  const gone = L(dir, ["list"], store).json.items.map((i) => i.id);
  assert.equal(gone.length, 2);
  const r = decide(
    dir,
    store,
    gone.map((id) => ({ id, choice: "Retire" }))
  );
  assert.deepEqual(
    r.json.results.map((x) => x.outcome),
    ["retired", "retired"]
  );
  assert.equal(r.json.closing, "Retired 2. 0 still waiting.");
  assert.deepEqual(r.json.written, [WEB_FILE]);
  assert.equal(fs.existsSync(path.join(dir, WEB_FILE)), false, "an emptied area file is removed");
  assert.deepEqual(L(dir, ["list"], store).json.items, []);
});

test("lessons decide: Retire never removes general.md", () => {
  const dir = readRepo();
  const store = learningDir();
  fs.rmSync(path.join(dir, "README.md"));
  fs.rmSync(path.join(dir, "scripts"), { recursive: true });
  const items = L(dir, ["list"], store).json.items;
  assert.deepEqual(
    items.map((i) => i.id),
    ["gone:general/answer-in-us-english", "gone:general/run-the-targeted-suites"]
  );
  const r = decide(
    dir,
    store,
    items.map((i) => ({ id: i.id, choice: "Retire" }))
  );
  assert.equal(r.json.closing, "Retired 2. 0 still waiting.");
  assert.equal(read(dir, ".plan2code/lessons/general.md"), "# General\n");
});

test("lessons report: works while off, with counts, the oldest date, marked and gone", () => {
  const dir = markA();
  const store = learningDir();
  settings(dir, { format: 1, learning: "off" });
  write(dir, ".plan2code/lessons/general.md", "# General\n\n" + block("Answer in US English", "missing.md"));
  write(dir, WEB_FILE, WEB_AREA + "\n### Name the handler after its route\n- Kind: convention\n- About: src/app.js\n- Noted: 2026-10-20, Implement, checked 2026-11-09\n");
  const r = L(dir, ["report"], store);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    state: "off",
    active: false,
    areas: [{ name: "Web", slug: "web", paths: ["src/**"], count: 2, oldest: "2026-10-20" }],
    general: { count: 1, limit: 25 },
    marked: [LESSON_ID],
    gone: ["general/answer-in-us-english"],
  });
});

/* ------------------------------------------------------ review fixes */

test("lessons marking: a fixed handful of git calls, however often the About file changed", () => {
  const dir = copyFixture("mark-busy", "mark-busy", (d) => {
    const g = baseRepo(d);
    write(d, ".plan2code/lessons/general.md", "# General\n\n" + block("Answer in US English", "README.md"));
    commitAll(g, "an older general lesson");
    for (let i = 0; i < 12; i++) {
      write(d, "src/app.js", `export const app = ${i};\n`);
      commitAll(g, `edit ${i}`);
    }
    write(d, WEB_FILE, WEB_AREA);
    commitAll(g, "lesson");
  });
  settings(dir, { format: 1, learning: "on" });
  const trace = path.join(tmp("git-trace"), "trace.txt");
  const r = runScript("plan2code-quick-task", "lessons.mjs", ["read", "--paths", "src/app.js"], { cwd: dir, env: { PLAN2CODE_LEARNING_DIR: learningDir(), GIT_TRACE: trace } });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.areas[0].lessons[0].marked, false, "every edit came before the lesson");
  const calls = fs
    .readFileSync(trace, "utf8")
    .split("\n")
    .map((l) => (l.match(/trace: built-in: git (.*)$/) || [])[1])
    .filter(Boolean);
  const count = (re) => calls.filter((c) => re.test(c)).length;
  assert.equal(count(/--is-ancestor/), 0, "no ancestry check per commit");
  assert.equal(count(/^blame /), 2, "one blame per returned area file");
  assert.equal(count(/^merge-base .*--octopus/), 1);
  assert.equal(count(/^rev-list /), 1);
  assert.equal(count(/ log /) + count(/^log /), 1);
});

test("lessons marking: an About edit on a branch beside another lesson's commit marks it whichever areas are read", () => {
  const dir = copyFixture("mark-parallel", "mark-parallel", (d) => {
    const g = baseRepo(d);
    g("checkout", "-q", "-b", "feature");
    write(d, "src/app.js", "export const app = 2;\n");
    commitAll(g, "X: edit app on the branch");
    write(d, ".plan2code/lessons/lib.md", "# Lib\nPaths: lib/**\n\n" + block("Keep lib pure", "lib/x.js"));
    write(d, "lib/x.js", "x\n");
    commitAll(g, "C1: a lib lesson after X");
    g("checkout", "-q", "main");
    write(d, WEB_FILE, WEB_AREA);
    commitAll(g, "C2: the web lesson on main");
    g("merge", "-q", "--no-edit", "feature");
  });
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const webAlone = L(dir, ["read", "--paths", "src/app.js"], store).json;
  const both = L(dir, ["read", "--paths", "src/app.js,lib/x.js"], store).json;
  assert.equal(webAlone.areas.find((a) => a.slug === "web").lessons[0].marked, true);
  assert.equal(both.areas.find((a) => a.slug === "web").lessons[0].marked, true, "the same answer with Lib read too");
  assert.equal(both.areas.find((a) => a.slug === "lib").lessons[0].marked, false);
  assert.deepEqual(L(dir, ["report"], store).json.marked, [LESSON_ID]);
});

test("lessons marking: an About path outside the repository does not unmark the others", () => {
  const dir = markA();
  write(dir, WEB_FILE, WEB_AREA + "\n" + block("Look outside", "../outside.js"));
  gitIn(dir)("commit", "-q", "-am", "a hand-edited block");
  const m = marks(dir);
  assert.equal(m[LESSON_ID].marked, true);
  assert.deepEqual(m["web/look-outside"], { marked: false, gone: false });
});

test("lessons read: changedFiles reads a work-tree rename's two paths", () => {
  const dir = readRepo();
  fs.renameSync(path.join(dir, "docs/a.md"), path.join(dir, "docs/b.md"));
  gitIn(dir)("add", "-N", "docs/b.md");
  assert.deepEqual(record.changedFiles(dir), ["docs/a.md", "docs/b.md"]);
});

test("lessons read: headsUp leaves out a doubt list would not show, and read never prunes the store", () => {
  const dir = readRepo();
  const store = learningDir();
  const noted = L(dir, doubt("web/draw-the-page-from-state", "The page draws itself now."), store);
  assert.equal(noted.code, 0, noted.stderr);
  assert.equal(L(dir, ["read"], store).json.headsUp.count, 1);
  fs.rmSync(path.join(dir, ".plan2code/lessons/web.md"));
  assert.equal(L(dir, ["read"], store).json.headsUp, undefined, "its lesson was retired since");
  assert.deepEqual(L(dir, ["list"], store).json.items, []);

  // An item past 30 days: a read leaves the file; state (which prunes) removes it.
  waiting(dir, store, daysBefore(31), "20260702-140500-bbbbbb");
  const before = storeListing(store);
  L(dir, ["read"], store);
  assert.deepEqual(storeListing(store), before, "read writes nothing on the machine");
  L(dir, ["state"], store);
  assert.ok(!storeListing(store).some((f) => f.includes("bbbbbb")), "the store's own reads still prune");
});

test("lessons note doubt: the target is stored as the lesson's own id", () => {
  const dir = markA();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const r = L(dir, doubt("web/extra/keep-the-handler-small"), store);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.line, `Noted for the end of the run: a doubt about ${LESSON_ID}`);
  assert.equal(L(dir, doubt(LESSON_ID, "Something else."), store).json.already, true, "the same lesson, however it was named");
});

/* ------------------------------------------- AGENTS.md and the failure log */

const KEEPING = "## Keeping this file current";
const agentsDoc = ({ keeping = true, log = ["- Old line one.", "- Old line two. A second incident here."] } = {}) =>
  [
    "# AGENTS.md",
    "",
    "Intro.",
    "",
    "## Code style",
    "",
    "Use two spaces.",
    "",
    ...(keeping ? [KEEPING, "", "When you make a mistake, add a line below.", ""] : []),
    "## Failure log",
    "",
    ...log,
  ].join("\n") + "\n";
const crlf = (s) => s.replace(/\r?\n/g, "\r\n");
const readBytes = (dir, rel) => fs.readFileSync(path.join(dir, rel));

test("lessons switch: on adds the pointer line and the upkeep sentence, off gives back the same bytes", () => {
  const shapes = {
    "LF with Keeping": agentsDoc(),
    "CRLF with Keeping": crlf(agentsDoc()),
    "LF without Keeping": agentsDoc({ keeping: false }),
    "CRLF without Keeping": crlf(agentsDoc({ keeping: false })),
    "neither section": "# AGENTS.md\n\nIntro.\n",
    "neither, no last line break": "# AGENTS.md\n\nIntro.",
    "neither, ends on a blank line": "# AGENTS.md\n\nIntro.\n\n",
    "heading right under text": "# AGENTS.md\nIntro.\n## Keeping this file current\nAdd a line.\n",
    "Keeping is the last line": "# AGENTS.md\n\n## Keeping this file current",
    "mixed line endings": "# AGENTS.md\r\n\nIntro.\r\n\n## Keeping this file current\n\nAdd a line.\r\n",
    "empty file": "",
  };
  for (const [name, text] of Object.entries(shapes)) {
    const dir = tmp("lessons-wording");
    write(dir, "AGENTS.md", text);
    const original = readBytes(dir, "AGENTS.md");
    const on = record.syncAgentsWording(dir, true);
    const after = read(dir, "AGENTS.md");
    assert.deepEqual(on.written, ["AGENTS.md"], name);
    assert.ok(after.includes(record.POINTER_LINE), `${name}: the pointer line`);
    const lines = after.split(/\r?\n/);
    if (text.includes(KEEPING)) {
      assert.ok(after.includes(record.UPKEEP_SENTENCE), `${name}: the upkeep sentence`);
      const k = lines.indexOf(KEEPING);
      assert.equal(lines.slice(0, k).filter((l) => l.trim()).pop(), record.POINTER_LINE, `${name}: the pointer sits directly above the heading`);
      assert.equal(lines.slice(k + 1).find((l) => l.trim()), record.UPKEEP_SENTENCE, `${name}: the upkeep sentence is the first paragraph under it`);
    } else {
      assert.equal(on.skipped, "no-keeping-section", name);
      assert.ok(!after.includes(record.UPKEEP_SENTENCE), name);
      if (text.includes("## Failure log")) assert.ok(after.indexOf(record.POINTER_LINE) < after.indexOf("## Failure log"), `${name}: above the failure log`);
    }
    if (text.includes("\r\n") && !text.includes("\r\n\n")) assert.ok(!/[^\r]\n/.test(after), `${name}: CRLF kept`);
    assert.deepEqual(record.syncAgentsWording(dir, true).written, [], `${name}: on twice adds nothing`);
    record.syncAgentsWording(dir, false);
    assert.ok(readBytes(dir, "AGENTS.md").equals(original), `${name}: off gives back the original bytes`);
  }
});

test("lessons switch: on writes AGENTS.md too, off takes it back; no AGENTS.md points at Init and still switches", () => {
  const dir = repo();
  const store = learningDir();
  write(dir, "AGENTS.md", agentsDoc());
  const original = read(dir, "AGENTS.md");
  const on = L(dir, ["switch", "on"], store);
  assert.equal(on.code, 0, on.stderr);
  assert.deepEqual(on.json.written, [".plan2code/settings.json", "AGENTS.md"]);
  assert.equal(on.json.next, undefined);
  const off = L(dir, ["switch", "off"], store);
  assert.deepEqual(off.json.written, [".plan2code/settings.json", "AGENTS.md"]);
  assert.equal(read(dir, "AGENTS.md"), original);
  assert.equal(gitIn(dir)("diff", "--cached", "--name-only").trim(), "", "nothing staged");

  const bare = repo();
  const r = L(bare, ["switch", "on"], store);
  assert.equal(r.json.next, "plan2code-init");
  assert.equal(r.json.skipped, "no-agents");
  assert.equal(r.json.state, "on");
  assert.ok(fs.existsSync(path.join(bare, ".plan2code", "settings.json")));
  assert.equal(fs.existsSync(path.join(bare, "AGENTS.md")), false);
});

test("lessons switch: offerLogMove only when this call turns it on and the log has an unmarked line; firstOn until a commit says on", () => {
  const dir = repo();
  const store = learningDir();
  const g = gitIn(dir);
  write(dir, "AGENTS.md", agentsDoc());
  const first = L(dir, ["switch", "on"], store).json;
  assert.equal(first.offerLogMove, true);
  assert.equal(first.firstOn, true);
  assert.equal(L(dir, ["switch", "on"], store).json.offerLogMove, false, "already on");
  commitAll(g, "learning on");
  L(dir, ["switch", "off"], store);
  const again = L(dir, ["switch", "on"], store).json;
  assert.equal(again.offerLogMove, true, "off to on offers again");
  assert.equal(again.firstOn, undefined, "a commit already records it on");
  assert.equal(L(dir, ["switch", "off"], store).json.offerLogMove, undefined, "off never offers");

  const none = repo();
  write(none, "AGENTS.md", agentsDoc({ log: ["- Only line. (kept in the log)"] }));
  assert.equal(L(none, ["switch", "on"], store).json.offerLogMove, false, "every line is marked");
});

// A repository whose AGENTS.md failure log holds two old lines, then Learning
// switched on and committed, then one new line committed.
const logRepo = () =>
  copyFixture("lessons-log", "log-history", (d) => {
    const g = gitInit(d);
    write(d, "AGENTS.md", agentsDoc());
    write(d, "src/a.js", "a\n");
    commitAll(g, "old log");
    write(d, ".plan2code/settings.json", '{\n  "format": 1,\n  "learning": "on"\n}\n');
    commitAll(g, "learning on");
    write(d, "AGENTS.md", read(d, "AGENTS.md") + "- A new line.\n");
    commitAll(g, "new line");
  });
const texts = (lines) => lines.map((l) => l.text);

test("lessons log-lines: only lines added since the first switch-on commit; --all gives every unmarked line", () => {
  const dir = logRepo();
  const store = learningDir();
  const r = L(dir, ["log-lines"], store);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(texts(r.json.lines), ["A new line."]);
  assert.deepEqual(r.json.lines[0].incidents, [{ text: "A new line.", kind: "correction" }]);
  assert.equal(r.json.lines[0].n, 17);
  const all = L(dir, ["log-lines", "--all"], store).json.lines;
  assert.deepEqual(texts(all), ["Old line one.", "Old line two. A second incident here.", "A new line."]);
  assert.deepEqual(
    all[1].incidents.map((i) => i.text),
    ["Old line two.", "A second incident here."]
  );

  // An uncommitted line is new too, and read's first call carries the same lines.
  write(dir, "AGENTS.md", read(dir, "AGENTS.md") + "- Uncommitted line.\n");
  const first = L(dir, ["read"], store).json;
  assert.deepEqual(texts(first.logLines), ["A new line.", "Uncommitted line."]);
  assert.equal(L(dir, ["read", "--run", first.run], store).json.logLines, undefined, "only the first read");

  // list: one item per new line; --log-all every unmarked one.
  const list = L(dir, ["list"], store).json;
  const items = list.items.filter((i) => i.type === "log-line");
  assert.deepEqual(texts(items), ["A new line.", "Uncommitted line."]);
  assert.deepEqual(items[0].choices, ["Move", "Reword and move", "Leave in the log"]);
  assert.deepEqual(items[0].lessons, [{ text: "A new line.", kind: "correction" }]);
  assert.match(items[0].id, /^log:[0-9a-f]{12}$/);
  assert.equal(list.rounds.find((x) => x.type === "log-line").items.length, 2);
  assert.equal(L(dir, ["list", "--log-all"], store).json.items.filter((i) => i.type === "log-line").length, 4);

  // Off: the list offers no line.
  settings(dir, { format: 1, learning: "off" });
  assert.deepEqual(L(dir, ["list"], store).json.items, []);
});

test("lessons log-lines: a line written while switched off is still new later; outside git or never committed on, none", () => {
  const dir = logRepo();
  const store = learningDir();
  const g = gitIn(dir);
  settings(dir, { format: 1, learning: "off" });
  commitAll(g, "off");
  write(dir, "AGENTS.md", read(dir, "AGENTS.md") + "- Written while off.\n");
  commitAll(g, "while off");
  settings(dir, { format: 1, learning: "on" });
  commitAll(g, "on again");
  assert.deepEqual(texts(L(dir, ["log-lines"], store).json.lines), ["A new line.", "Written while off."]);

  const outside = tmp("lessons-log-nogit");
  write(outside, "AGENTS.md", agentsDoc());
  settings(outside, { format: 1, learning: "on" });
  assert.deepEqual(L(outside, ["log-lines"], store).json.lines, [], "outside git no line is offered");
  assert.equal(L(outside, ["log-lines", "--all"], store).json.lines.length, 2, "the by-hand move still sees them");
  assert.deepEqual(L(outside, ["read"], store).json.logLines, []);

  const uncommitted = repo();
  write(uncommitted, "AGENTS.md", agentsDoc());
  settings(uncommitted, { format: 1, learning: "on" });
  assert.deepEqual(L(uncommitted, ["log-lines"], store).json.lines, [], "the switch is not committed on yet");
});

test("lessons decide: Leave in the log marks the line once and it is never offered again; a hand-typed mark mid-line is not trusted", () => {
  const dir = logRepo();
  const store = learningDir();
  const before = read(dir, "AGENTS.md");
  const id = L(dir, ["list"], store).json.items.find((i) => i.text === "A new line.").id;
  const r = decide(dir, store, [{ id, choice: "Leave in the log" }]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.results, [{ id, outcome: "left", file: "AGENTS.md" }]);
  assert.deepEqual(r.json.written, ["AGENTS.md"]);
  assert.equal(read(dir, "AGENTS.md"), before.replace("- A new line.\n", "- A new line. (kept in the log)\n"), "only that line changed");
  assert.deepEqual(L(dir, ["log-lines"], store).json.lines, []);
  assert.ok(!texts(L(dir, ["log-lines", "--all"], store).json.lines).some((t) => t.startsWith("A new line")), "--all leaves it out too");

  write(dir, "AGENTS.md", read(dir, "AGENTS.md") + "- Typed (kept in the log) by hand, mid-line.\n");
  assert.ok(texts(L(dir, ["log-lines"], store).json.lines).includes("Typed (kept in the log) by hand, mid-line."));
});

test("lessons decide: Move turns a two-incident line into two lessons and takes the line out; a changed line is out of date", () => {
  const dir = logRepo();
  const store = learningDir();
  const before = read(dir, "AGENTS.md");
  const item = L(dir, ["list", "--log-all"], store).json.items.find((i) => i.text.startsWith("Old line two."));
  const missing = decide(dir, store, [{ id: item.id, choice: "Move" }]);
  assert.equal(missing.json.results[0].outcome, "invalid", "a correction needs a why and about");
  assert.equal(read(dir, "AGENTS.md"), before, "nothing changed");

  const r = decide(dir, store, [{ id: item.id, choice: "Move", why: "It broke a build once.", about: "src/a.js" }]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.results[0].outcome, "moved");
  assert.equal(r.json.results[0].lessons.length, 2);
  assert.deepEqual(r.json.written, [".plan2code/lessons/general.md", "AGENTS.md"]);
  assert.equal(read(dir, "AGENTS.md"), before.replace("- Old line two. A second incident here.\n", ""), "only the bullet went");
  const general = read(dir, ".plan2code/lessons/general.md");
  assert.match(general, /### A second incident here\.\n- Kind: correction\n- About: src\/a\.js\n- Why: It broke a build once\.\n- Noted: 2026-08-03, Failure log\n/);
  assert.match(general, /### Old line two\./);
  assert.match(r.json.closing, /^Moved 1 from the failure log\./);
  assert.equal(gitIn(dir)("diff", "--cached", "--name-only").trim(), "", "nothing staged");

  // An id whose line changed since the list was read is out of date; Reword and move takes the person's lessons.
  const one = L(dir, ["list", "--log-all"], store).json.items.find((i) => i.text === "Old line one.");
  write(dir, "AGENTS.md", read(dir, "AGENTS.md").replace("- Old line one.", "- Old line one, edited."));
  assert.deepEqual(decide(dir, store, [{ id: one.id, choice: "Leave in the log" }]).json.results, [{ id: one.id, outcome: "outOfDate" }]);
  const edited = L(dir, ["list", "--log-all"], store).json.items.find((i) => i.text === "Old line one, edited.");
  const rw = decide(dir, store, [{ id: edited.id, choice: "Reword and move", lessons: [{ text: "Say it plainly", why: "It was unclear.", about: "src/a.js" }] }]);
  assert.equal(rw.json.results[0].outcome, "moved");
  assert.ok(!read(dir, "AGENTS.md").includes("Old line one"));
  assert.match(read(dir, ".plan2code/lessons/general.md"), /### Say it plainly\n- Kind: correction/);
});

test("lessons note agents-fix: the before must match once, the after is checked, and the list shows file, before and after", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  write(dir, "AGENTS.md", "# AGENTS.md\n\nRun `npm test` for everything.\nUse two spaces.\nUse two spaces.\n");
  write(dir, ".agents-docs/AGENTS-x.md", "# X\n\nThe build is `npm run old`.\n");
  const fix = (extra) => L(dir, ["note", "--type", "agents-fix", "--skill", "Implement", ...extra], store);
  assert.equal(fix(["--before", "nowhere", "--after", "x"]).json.error, "no-match");
  assert.equal(fix(["--before", "Use two spaces.", "--after", "x"]).code, 4, "twice is not once");
  assert.equal(fix(["--before", "npm", "--after", "x", "--file", "../outside.md"]).json.error, "bad-file");
  assert.equal(fix(["--before", "x"]).code, 2, "after is required");
  const secret = fix(["--before", "Run `npm test` for everything.", "--after", `Use ${SECRETS["github-token"][0]}`]);
  assert.equal(secret.code, 5);
  assert.equal(secret.json.error, "secret");
  assert.ok(!secret.stdout.includes(SECRETS["github-token"][0]));
  assert.equal(waitingFiles(store).length, 0, "nothing written");

  const ok = fix(["--before", "Run `npm test` for everything.", "--after", "Run `npm run test:fast` while working."]);
  assert.equal(ok.code, 0, ok.stderr);
  assert.equal(ok.json.line, "Noted for the end of the run: a fix to AGENTS.md");
  assert.equal(fix(["--before", "`npm run old`", "--after", "`npm run build`", "--file", ".agents-docs/AGENTS-x.md"]).code, 0);
  const items = L(dir, ["list"], store).json.items;
  const a = items.find((i) => i.file === "AGENTS.md");
  assert.equal(a.type, "agents-fix");
  assert.equal(a.before, "Run `npm test` for everything.");
  assert.equal(a.after, "Run `npm run test:fast` while working.");
  assert.deepEqual(a.choices, ["Apply", "Reword", "Drop"]);
  assert.ok(items.some((i) => i.file === ".agents-docs/AGENTS-x.md"));
});

test("lessons decide agents-fix: Apply replaces the before once, an edited-away before is out of date and keeps waiting", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  write(dir, "AGENTS.md", "# AGENTS.md\r\n\r\nRun `npm test` for everything.\r\nKeep this line.\r\n");
  write(dir, ".agents-docs/AGENTS-x.md", "# X\n\nThe build is `npm run old`.\n");
  const fix = (extra) => L(dir, ["note", "--type", "agents-fix", "--skill", "Implement", ...extra], store);
  fix(["--before", "Run `npm test` for everything.", "--after", "Run `npm run test:fast` while working."]);
  fix(["--before", "`npm run old`", "--after", "`npm run build`", "--file", ".agents-docs/AGENTS-x.md"]);
  const items = L(dir, ["list"], store).json.items;
  const inAgents = items.find((i) => i.file === "AGENTS.md").id;
  const inDocs = items.find((i) => i.file !== "AGENTS.md").id;

  write(dir, ".agents-docs/AGENTS-x.md", "# X\n\nThe build is `make`.\n");
  const r = decide(dir, store, [
    { id: inAgents, choice: "Apply" },
    { id: inDocs, choice: "Apply" },
  ]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(
    r.json.results.map((x) => x.outcome),
    ["applied", "outOfDate"]
  );
  assert.equal(read(dir, "AGENTS.md"), "# AGENTS.md\r\n\r\nRun `npm run test:fast` while working.\r\nKeep this line.\r\n");
  assert.equal(r.json.stillWaiting, 1, "the out-of-date fix keeps waiting");
  assert.match(r.json.closing, /^Applied 1 fix\. 1 still waiting\.$/);

  // Reword applies the person's after, checked first.
  write(dir, ".agents-docs/AGENTS-x.md", "# X\n\nThe build is `npm run old`.\n");
  const refused = decide(dir, store, [{ id: inDocs, choice: "Reword", after: `Use ${SECRETS["aws-access-key"][0]}` }]);
  assert.equal(refused.json.results[0].outcome, "refused");
  assert.equal(read(dir, ".agents-docs/AGENTS-x.md"), "# X\n\nThe build is `npm run old`.\n");
  const rw = decide(dir, store, [{ id: inDocs, choice: "Reword", after: "`npm run build:all`" }]);
  assert.equal(rw.json.results[0].outcome, "applied");
  assert.equal(read(dir, ".agents-docs/AGENTS-x.md"), "# X\n\nThe build is `npm run build:all`.\n");
});

test("lessons agents-fix: a test map row fix leaves every line outside the table byte-identical", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const doc = [
    "# AGENTS.md",
    "",
    "## Test map",
    "",
    "Which checks cover which files.",
    "",
    "| Area | Paths | Run | Shared |",
    "|---|---|---|---|",
    "| Web | `src/web/**` | `npm run test:web` | no |",
    "| Docs | `docs/**` | `npm run docs` | no |",
    "",
    "## After",
    "",
    "Text   with  odd   spacing.",
    "",
  ].join("\n");
  write(dir, "AGENTS.md", doc);
  const row = (r) => L(dir, ["note", "--type", "agents-fix", "--skill", "Test", "--test-map-row", JSON.stringify(r)], store);
  assert.equal(row({ area: "Web", paths: [], run: "x" }).json.error, "invalid-rows");
  assert.equal(row({ area: "Web", paths: ["src/**"], run: `deploy ${SECRETS["stripe-key"][0]}` }).code, 5);
  assert.equal(row({ area: "Web", paths: ["src/web/**"], run: "npm run test:web:fast", shared: false }).code, 0);
  assert.equal(row({ area: "Api", paths: ["src/api/**"], run: "npm run test:api", shared: true }).code, 0);
  const items = L(dir, ["list"], store).json.items;
  const web = items.find((i) => i.after.includes("Web"));
  assert.equal(web.before, "| Web | `src/web/**` | `npm run test:web` | no |");
  assert.equal(web.after, "| Web | `src/web/**` | `npm run test:web:fast` | no |");
  assert.equal(items.find((i) => i.after.includes("Api")).before, "");
  const r = decide(
    dir,
    store,
    items.map((i) => ({ id: i.id, choice: "Apply" }))
  );
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.written, ["AGENTS.md"]);
  const lines = read(dir, "AGENTS.md").split("\n");
  const was = doc.split("\n");
  assert.deepEqual(lines.slice(0, 8), was.slice(0, 8), "everything above the rows");
  assert.deepEqual(lines.slice(-5), was.slice(-5), "everything below the table");
  assert.deepEqual(lines.slice(8, 11), ["| Web | `src/web/**` | `npm run test:web:fast` | no |", "| Docs | `docs/**` | `npm run docs` | no |", "| Api | `src/api/**` | `npm run test:api` | yes |"]);
  assert.match(r.json.closing, /^Applied 2 fixes\./);
});

test("lessons failure log: Init's empty placeholder line is not a line", () => {
  const dir = repo();
  const store = learningDir();
  write(dir, "AGENTS.md", agentsDoc({ log: ["- "] }));
  const on = L(dir, ["switch", "on"], store).json;
  assert.equal(on.offerLogMove, false, "nothing to move");
  assert.deepEqual(L(dir, ["log-lines", "--all"], store).json.lines, []);
  assert.deepEqual(L(dir, ["list", "--log-all"], store).json.items, []);
});

test("lessons agents-fix: a test map the read cannot take whole holds a row fix back, and a bad row names the note", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const doc = "# AGENTS.md\n\n## Test map\n\n| Area | Paths | Run |\n|---|---|---|\n| Web | `src/web/**` | `npm run test:web` |\n";
  write(dir, "AGENTS.md", doc);
  const bad = L(dir, ["note", "--type", "agents-fix", "--skill", "Test", "--test-map-row", JSON.stringify({ area: "Web", paths: [], run: "x" })], store);
  assert.equal(bad.json.error, "invalid-rows");
  assert.match(bad.json.next, /--test-map-row/);
  assert.equal(L(dir, ["note", "--type", "agents-fix", "--skill", "Test", "--test-map-row", JSON.stringify({ area: "Api", paths: ["src/api/**"], run: "npm run test:api" })], store).code, 0);
  const item = L(dir, ["list"], store).json.items[0];
  assert.match(item.note, /test map has problems/);
  const r = decide(dir, store, [{ id: item.id, choice: "Apply" }]);
  assert.equal(r.json.results[0].outcome, "outOfDate");
  assert.equal(r.json.results[0].reason, "test-map-problems");
  assert.equal(read(dir, "AGENTS.md"), doc, "the table is left as it was");
  assert.equal(r.json.stillWaiting, 1);
});

test("lessons agents-fix: a test map row is reworded with row, or with after as its table line, and checked again at Apply", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const head = "# AGENTS.md\n\n## Test map\n\n| Area | Paths | Run | Shared |\n|---|---|---|---|\n";
  write(dir, "AGENTS.md", head + "| Web | `src/web/**` | `npm run test:web` | no |\n");
  const note = (r) => L(dir, ["note", "--type", "agents-fix", "--skill", "Test", "--test-map-row", JSON.stringify(r)], store);
  assert.equal(note({ area: "Web", paths: ["src/web/**"], run: "npm run test:web:fast", shared: false }).code, 0);
  assert.equal(note({ area: "Api", paths: ["src/api/**"], run: "npm run test:api", shared: false }).code, 0);
  assert.equal(note({ area: "Docs", paths: ["docs/**"], run: "npm run docs", shared: false }).code, 0);
  const list = L(dir, ["list"], store).json;
  const by = (name) => list.items.find((i) => i.after.includes(`| ${name} |`));
  assert.deepEqual(by("Web").row, { area: "Web", paths: ["src/web/**"], run: "npm run test:web:fast", shared: false }, "the item says it is a row");
  assert.deepEqual(list.card.rows.find((r) => r.id === by("Api").id).row, by("Api").row, "and so does its card row");

  // A line that is no table row, and a row with no run command, are invalid and keep waiting.
  const bad = decide(dir, store, [
    { id: by("Web").id, choice: "Reword", after: "Run the fast web tests" },
    { id: by("Api").id, choice: "Reword", after: "| Api | `src/api/**` |  | yes |" },
  ]);
  assert.deepEqual(bad.json.results.map((r) => r.outcome), ["invalid", "invalid"]);
  assert.match(bad.json.results[0].problems[0].message, /one table line/);
  assert.equal(bad.json.stillWaiting, 3);
  // A reworded row is secret-checked whichever way it comes.
  const leaked = decide(dir, store, [{ id: by("Web").id, choice: "Reword", after: `| Web | \`src/web/**\` | \`deploy ${SECRETS["stripe-key"][0]}\` | no |` }]);
  assert.equal(leaked.json.results[0].outcome, "refused");
  assert.ok(!leaked.stdout.includes(SECRETS["stripe-key"][0]));

  // The card sends `after`, the edited table line; an agent may send `row`.
  const r = decide(dir, store, [
    { id: by("Web").id, choice: "Reword", after: "| Web | `src/web/**`, `scripts/web-*.mjs` | `npm run test:web:quick` | yes |" },
    { id: by("Api").id, choice: "Reword", row: { area: "Api", paths: ["src/api/**"], run: "npm run test:api:all", shared: true } },
  ]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.results.map((x) => x.outcome), ["applied", "applied"]);
  assert.equal(read(dir, "AGENTS.md"), head + "| Web | `src/web/**`, `scripts/web-*.mjs` | `npm run test:web:quick` | yes |\n| Api | `src/api/**` | `npm run test:api:all` | yes |\n");

  // Apply reads the waiting file as it is now: one changed by hand since it was noted is checked again.
  const files = fs.readdirSync(store, { recursive: true }).map((f) => path.join(store, String(f))).filter((f) => f.endsWith(`${by("Docs").id}.json`));
  assert.equal(files.length, 1, "the Docs fix's waiting file");
  const saved = JSON.parse(fs.readFileSync(files[0], "utf8"));
  fs.writeFileSync(files[0], JSON.stringify({ ...saved, row: { ...saved.row, run: `deploy ${SECRETS["stripe-key"][0]}` } }));
  const before = read(dir, "AGENTS.md");
  const tampered = decide(dir, store, [{ id: by("Docs").id, choice: "Apply" }]);
  assert.equal(tampered.json.results[0].outcome, "refused");
  assert.ok(!tampered.stdout.includes(SECRETS["stripe-key"][0]));
  fs.writeFileSync(files[0], JSON.stringify({ ...saved, row: { ...saved.row, paths: [] } }));
  assert.equal(decide(dir, store, [{ id: by("Docs").id, choice: "Apply" }]).json.results[0].outcome, "invalid");
  assert.equal(read(dir, "AGENTS.md"), before, "nothing written");
});

test("lessons decide: a missing decisions file, a lesson an area already holds, and a fix note with a bad --skill", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  const missing = L(dir, ["decide", "--file", path.join(tmp("lessons-decide"), "nothing.json")], store);
  assert.equal(missing.code, 3);
  assert.equal(missing.json.error, "no-file");

  assert.equal(L(dir, lesson("Build the skills before the script tests"), store).code, 0);
  let item = L(dir, ["list"], store).json.items[0];
  assert.equal(decide(dir, store, [{ id: item.id, choice: "Keep" }]).json.results[0].outcome, "kept");
  // The same words noted again: Keep finds them in the area and leaves the item waiting.
  const again = L(dir, lesson("Build the skills before the script tests"), store);
  assert.equal(again.code, 0, again.stderr);
  item = L(dir, ["list"], store).json.items.find((i) => i.type === "lesson");
  const dup = decide(dir, store, [{ id: item.id, choice: "Keep" }]);
  assert.equal(dup.json.results[0].outcome, "duplicate");
  assert.equal(dup.json.stillWaiting, 1);
  assert.deepEqual(dup.json.written, []);

  write(dir, "AGENTS.md", "# AGENTS.md\n\nThe build is `npm run build`.\n");
  const fix = L(dir, ["note", "--type", "agents-fix", "--before", "npm run build", "--after", "npm run build:all", "--skill", "x".repeat(41)], store);
  assert.equal(fix.code, 4);
  assert.equal(fix.json.error, "invalid-fix");
});

const correction = (text, extra = []) => ["note", "--type", "lesson", "--text", text, "--kind", "correction", "--why", "It broke once.", "--about", "src/a.js", "--source", "said", "--skill", "Implement", ...extra];

test("lessons first ask: list --first-ask leads with the newest lesson; Yes switches on and lists with offerLogMove", () => {
  const dir = repo();
  const store = learningDir();
  write(dir, "AGENTS.md", agentsDoc());
  L(dir, lesson("An older lesson"), store);
  // A minute later, so the newest is not left to the ids' random part.
  const later = runScript("plan2code-quick-task", "lessons.mjs", correction("Run the fixer for line endings"), { cwd: dir, env: { PLAN2CODE_LEARNING_DIR: store, PLAN2CODE_NOW: "2026-08-03 14:06" } });
  assert.equal(later.code, 0, later.stderr);
  const ask = L(dir, ["list", "--first-ask"], store).json;
  assert.equal(ask.firstAsk.lesson.text, "Run the fixer for line endings", "the newest waiting lesson");
  assert.deepEqual(ask.firstAsk.sentences, [
    "Plan2Code can keep lessons like this with the repository (in `.plan2code/lessons/`), so your next run, and your teammates', starts out knowing them.",
    "Nothing is saved without your approval.",
    "Lessons are about the code, never about you.",
  ]);
  assert.equal(ask.firstAsk.yes, "Switch Learning on");
  assert.equal(ask.firstAsk.no, "Not for this project");
  assert.equal(ask.firstAsk.later, "You can change this later on the dashboard.");
  assert.equal(L(dir, ["list"], store).json.firstAsk, undefined, "only with --first-ask");

  const yes = L(dir, ["decide", "--first-ask", "yes"], store);
  assert.equal(yes.code, 0, yes.stderr);
  assert.equal(yes.json.state, "on");
  assert.equal(yes.json.offerLogMove, true);
  assert.deepEqual(yes.json.written, [".plan2code/settings.json", "AGENTS.md"]);
  assert.equal(yes.json.items.length, 2, "the normal list follows");
  assert.equal(yes.json.firstAsk, undefined);
  assert.ok(read(dir, "AGENTS.md").includes(record.POINTER_LINE));
  assert.equal(L(dir, ["list", "--first-ask"], store).json.firstAsk, undefined, "once on, list --first-ask is the list");
  assert.equal(L(dir, ["decide", "--first-ask", "yes"], store).json.error, "not-first-ask");
});

test("lessons first ask: No switches off and sends this run's correction to the failure log", () => {
  const dir = repo();
  const store = learningDir();
  write(dir, "AGENTS.md", agentsDoc());
  const before = read(dir, "AGENTS.md");
  L(dir, correction("Run the fixer for line endings"), store);
  L(dir, lesson("A convention that waits"), store);
  L(dir, correction("Another skill's correction", ["--skill", "Review"]), store);
  assert.equal(L(dir, ["decide", "--first-ask", "no"], store).code, 2, "needs --skill");
  const no = L(dir, ["decide", "--first-ask", "no", "--skill", "Implement"], store);
  assert.equal(no.code, 0, no.stderr);
  assert.equal(no.json.state, "off");
  assert.equal(no.json.logged, 1);
  assert.deepEqual(no.json.written, [".plan2code/settings.json", "AGENTS.md"]);
  assert.equal(read(dir, "AGENTS.md"), before + "- Run the fixer for line endings. It broke once.\n");
  assert.equal(no.json.stillWaiting, 2, "the convention and the other skill's correction wait");
  assert.deepEqual(
    L(dir, ["list"], store)
      .json.items.map((i) => i.text)
      .sort(),
    ["A convention that waits", "Another skill's correction"]
  );

  // No failure log: the correction keeps waiting.
  const bare = repo();
  write(bare, "AGENTS.md", "# AGENTS.md\n");
  L(bare, correction("Keep me"), store);
  const r = L(bare, ["decide", "--first-ask", "no", "--skill", "Implement"], store).json;
  assert.equal(r.results[0].outcome, "skipped");
  assert.equal(r.results[0].reason, "no-failure-log");
  assert.equal(read(bare, "AGENTS.md"), "# AGENTS.md\n");
});

test("lessons remove: needs --confirm, then deletes only .plan2code/lessons/ and stages nothing", () => {
  const dir = repo();
  const store = learningDir();
  settings(dir, { format: 1, learning: "on" });
  write(dir, "AGENTS.md", "# AGENTS.md\n");
  write(dir, ".plan2code/lessons/general.md", "# General\n");
  write(dir, ".plan2code/lessons/web.md", WEB_AREA);
  L(dir, lesson("Still waiting"), store);
  const no = L(dir, ["remove"], store);
  assert.equal(no.code, 2);
  assert.equal(no.json.error, "needs-confirm");
  assert.ok(fs.existsSync(path.join(dir, ".plan2code/lessons/web.md")), "nothing deleted");
  const dry = L(dir, ["remove", "--confirm", "--dry-run"], store);
  assert.deepEqual(dry.json.removed, [".plan2code/lessons/general.md", ".plan2code/lessons/web.md"]);
  assert.ok(fs.existsSync(path.join(dir, ".plan2code/lessons/web.md")), "a dry run deletes nothing");
  const r = L(dir, ["remove", "--confirm"], store);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.removed, [".plan2code/lessons/general.md", ".plan2code/lessons/web.md"]);
  assert.equal(fs.existsSync(path.join(dir, ".plan2code/lessons")), false);
  assert.ok(fs.existsSync(path.join(dir, ".plan2code/settings.json")));
  assert.equal(read(dir, "AGENTS.md"), "# AGENTS.md\n");
  assert.equal(waitingFiles(store).length, 1, "the machine store is left");
  assert.equal(gitIn(dir)("diff", "--cached", "--name-only").trim(), "");
});

/* --------------------------------------------- the reference's wording */

test("lessons.md: every line it tells a skill to print is a line the script prints", () => {
  // The built reference, as a skill reads it: its quoted examples of printed lines.
  const ref = fs.readFileSync(path.join(SKILLS, "plan2code-quick-task", "references", "lessons.md"), "utf8");
  const quoted = [...ref.matchAll(/"((?:Read |Noted for the end of the run: |Learning is paused|Kept )[^"]*)"/g)].map((m) => m[1]);
  const pick = (prefix) => {
    const found = quoted.filter((q) => q.startsWith(prefix));
    assert.ok(found.length, `lessons.md shows a line starting "${prefix}"`);
    return found;
  };

  // "Learning is paused for you.", word for word from a paused read.
  const dir = readRepo();
  const store = learningDir();
  assert.equal(L(dir, ["pause", "on"], store).code, 0);
  const paused = L(dir, ["read"], store).json.line;
  assert.deepEqual(pick("Learning is paused"), [paused]);
  L(dir, ["pause", "off"], store);

  // "Read ...": each example is what readLine gives for its own counts, and the CLI prints readLine.
  for (const line of pick("Read ")) {
    const more = line.match(/^Read (\d+) more for (.+)\.$/);
    const start = line.match(/^Read (\d+) general lessons? and (\d+) for (.+)\.$/);
    assert.ok(more || start, `an example read line the script can print: ${line}`);
    const expected = more
      ? record.readLine({ first: false, general: 0, areas: [{ name: more[2], count: +more[1] }], empty: false })
      : record.readLine({ first: true, general: +start[1], areas: [{ name: start[3], count: +start[2] }], empty: false });
    assert.equal(line, expected);
  }
  const first = L(dir, ["read", "--paths", "src/web/page.js"], store).json;
  assert.match(first.line, /^Read \d+ general lessons? and \d+ for .+\.$/);
  assert.equal(first.line, record.readLine({ first: true, general: first.general.length, areas: first.areas.map((a) => ({ name: a.name, count: a.lessons.length })), empty: false }));

  // "Noted for the end of the run: <the lesson>", from a real note.
  const [noted] = pick("Noted for the end of the run: ");
  const note = L(dir, ["note", "--type", "lesson", "--text", "Draw the page from the state object", "--kind", "convention", "--about", "src/web/page.js", "--source", "said", "--skill", "Implement"], store);
  assert.equal(note.code, 0, note.stderr);
  assert.equal(note.json.line, noted.replace("<the lesson>", "Draw the page from the state object"));

  // The closing line: the example is closingLine's own wording, and decide prints closingLine.
  const [closing] = pick("Kept ");
  assert.equal(closing, record.closingLine({ kept: 2, reworded: 1, retired: 1 }, 1));
  const r = decide(dir, store, [{ id: ids(dir, store)[0], choice: "Keep" }]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.closing, record.closingLine({ kept: 1 }, 0));
});

test("lessons.mjs: no output string says pending or queued (the fixed word is waiting)", () => {
  // The built script, whole: it never says either word, comments included,
  // so no string it prints can. Then the output of a real run.
  const BANNED = /\b(pending|queued)\b/i;
  const src = fs.readFileSync(path.join(SKILLS, "plan2code-quick-task", "scripts", "lessons.mjs"), "utf8");
  assert.ok(src.length > 1000, "the built script was read");
  assert.doesNotMatch(src, BANNED, "lessons.mjs never says pending or queued");

  const dir = repo();
  const store = learningDir();
  const outputs = [L(dir, ["state"], store), L(dir, ["list", "--first-ask"], store)];
  settings(dir, { format: 1, learning: "on" });
  outputs.push(
    L(dir, ["note", "--type", "lesson", "--text", "Draw the page from the state object", "--kind", "convention", "--about", "README.md", "--source", "said", "--skill", "Implement"], store),
    L(dir, ["read"], store),
    L(dir, ["list"], store),
    L(dir, ["remove"], store)
  );
  for (const out of outputs) assert.doesNotMatch(out.stdout + out.stderr, BANNED);
});
