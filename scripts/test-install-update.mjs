// Tests for `node install.js --update` and the install record (~/.plan2code/install.json).
// Run with: node --test scripts/test-install-update.mjs
//
// install.js reads the home directory once, at load, so HOME and USERPROFILE point at a temp
// folder before it is required. update() takes its install steps as an argument: the tests
// pass stand-ins that record their calls, so nothing reaches the skills CLI, npm or the network.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INSTALL = path.join(ROOT, "install.js");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8")).version;

const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-install-update-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
const installer = require(INSTALL);
test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const RECORD = path.join(HOME, ".plan2code", "install.json");

function writeRecord(pieces) {
  fs.mkdirSync(path.dirname(RECORD), { recursive: true });
  fs.writeFileSync(RECORD, JSON.stringify({ version: "1.0.0", scope: "global", pieces }));
}

function clearRecord() {
  fs.rmSync(RECORD, { force: true });
}

/** Stand-in install steps: each logs its piece and options, then returns `codes[piece]` (default 0) or throws `throws[piece]`. */
function fakeSteps({ codes = {}, throws = {}, launcherWithSkills = true } = {}) {
  const calls = [];
  const steps = {};
  for (const piece of installer.INSTALL_PIECES) {
    steps[piece] = async (options) => {
      calls.push({ piece, options });
      if (throws[piece]) throw new Error(throws[piece]);
      let code = codes[piece] ?? 0;
      if (piece === "skills") {
        // As the real install(): the skills first, then the command, and 1 if either failed.
        options.outcome.skills = code === 0;
        options.outcome.launcher = code === 0 && launcherWithSkills;
        if (code === 0 && !launcherWithSkills) code = 1;
      }
      return code;
    };
  }
  return { steps, calls, ran: () => calls.map((c) => c.piece) };
}

/** Run update() with console output captured: `{ code, out }`. */
async function runUpdate(steps) {
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const code = await installer.update({ steps });
    return { code, out: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
  } finally {
    console.log = log;
  }
}

test("install record: recordInstalled and forgetInstalled round trip a sorted set", () => {
  clearRecord();
  assert.equal(installer.INSTALL_RECORD, RECORD);
  assert.equal(installer.readInstallRecord(), null);
  installer.recordInstalled("loop");
  installer.recordInstalled("skills");
  installer.recordInstalled("skills");
  installer.recordInstalled("not-a-piece");
  assert.deepEqual(installer.readInstallRecord(), { version: VERSION, scope: "global", pieces: ["loop", "skills"] });
  installer.forgetInstalled("loop");
  assert.deepEqual(installer.readInstallRecord().pieces, ["skills"]);
  installer.forgetInstalled("skills");
  assert.deepEqual(installer.readInstallRecord().pieces, []);
  // No temp file is left beside the record.
  assert.deepEqual(fs.readdirSync(path.dirname(RECORD)), ["install.json"]);
});

test("install record: a missing or unparsable record reads as null, and forgetting needs none", () => {
  clearRecord();
  installer.forgetInstalled("skills");
  assert.equal(fs.existsSync(RECORD), false);
  fs.writeFileSync(RECORD, "{ not json");
  assert.equal(installer.readInstallRecord(), null);
  fs.writeFileSync(RECORD, JSON.stringify({ pieces: "skills" }));
  assert.equal(installer.readInstallRecord(), null);
});

test("update: with no record it says so and updates the skills and the plan2code command", async () => {
  clearRecord();
  const fake = fakeSteps();
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.match(out, new RegExp(`No install record found \\(installed before v${VERSION.replace(/\./g, "\\.")}\\); updating the skills and the plan2code command\\.`));
  // install() covers the command with the skills, so the launcher step does not run again.
  assert.deepEqual(fake.ran(), ["skills"]);
  assert.match(out, /skills: updated/);
  assert.match(out, /launcher: updated/);
});

test("update: a partial record runs only the listed pieces, in order, unattended", async () => {
  writeRecord(["loop", "statusline"]);
  const fake = fakeSteps();
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.deepEqual(fake.ran(), ["statusline", "loop"]);
  for (const call of fake.calls) assert.equal(call.options.unattended, true, call.piece);
  assert.doesNotMatch(out, /No install record/);
  assert.doesNotMatch(out, /skills:/);
});

test("update: a failing piece exits 1 naming it, and the others still run", async () => {
  writeRecord(["skills", "launcher", "loop", "metrics", "bot"]);
  const fake = fakeSteps({ codes: { loop: 1 }, throws: { metrics: "npm exploded" } });
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 1, out);
  assert.deepEqual(fake.ran(), ["skills", "loop", "metrics", "bot"]);
  assert.match(out, /loop: failed: /);
  assert.match(out, /metrics: failed: npm exploded/);
  assert.match(out, /bot: updated/);
  assert.match(out, /Update failed for: loop, metrics/);
});

test("update: when the skills install leaves the command out, the launcher step runs on its own", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps({ launcherWithSkills: false });
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.deepEqual(fake.ran(), ["skills", "launcher"]);
  // install() returned 1 for the command alone: the skills still read as updated.
  assert.match(out, /skills: updated/);
  assert.match(out, /launcher: updated/);
});

test("update: a command that fails on the retry is the only piece named", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps({ launcherWithSkills: false, codes: { launcher: 1 } });
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 1, out);
  assert.match(out, /skills: updated/);
  assert.match(out, /Update failed for: launcher\b/);
});

test("update: the real status line step keeps a custom statusLine without asking", async () => {
  const claudeDir = path.join(HOME, ".claude");
  const settingsFile = path.join(claudeDir, "settings.json");
  fs.mkdirSync(claudeDir, { recursive: true });
  const settings = JSON.stringify({ statusLine: { type: "command", command: "my-own-status-line" } }, null, 2);
  fs.writeFileSync(settingsFile, settings);
  clearRecord();
  // stdin is not a TTY here: a prompt would hang the test until it times out.
  const log = console.log;
  console.log = () => {};
  let code;
  try {
    code = await installer.UPDATE_STEPS.statusline({ quiet: true, unattended: true });
  } finally {
    console.log = log;
  }
  assert.equal(code, 0);
  assert.equal(fs.readFileSync(settingsFile, "utf8"), settings);
  assert.ok(fs.existsSync(path.join(claudeDir, "plan2code-statusline.js")));
  assert.deepEqual(installer.readInstallRecord().pieces, ["statusline"]);
});

test("update: every step is an install function, never an uninstall", () => {
  assert.deepEqual(Object.keys(installer.UPDATE_STEPS), installer.INSTALL_PIECES);
  for (const [piece, fn] of Object.entries(installer.UPDATE_STEPS)) {
    assert.match(fn.name, /^install/, piece);
  }
});

test("install.js: --update is in the usage line, and an unknown option still exits 1", () => {
  const result = spawnSync(process.execPath, [INSTALL, "--bogus"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("Usage: node install.js [--build-skills | --verify-skills | --update]"), result.stderr);
});
