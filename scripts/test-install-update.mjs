// Tests for `node install.js --update` and the install record (~/.plan2code/install.json).
// Run with: node --test scripts/test-install-update.mjs
//
// install.js reads the home directory once, at load, so HOME and USERPROFILE point at a temp
// folder before it is required. update() takes its install steps as an argument: the tests
// pass stand-ins that record their calls, so nothing reaches the skills CLI, npm or the network.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
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

// ---------------------------------------------------------------------------------------------
// The desktop app: downloaded from a release, checked against its checksum list, placed in
// ~/.plan2code/app/. A stand-in release server stands in for GitHub; PLAN2CODE_RELEASE_BASE
// points the installer at it, and nothing here reaches the network.
// ---------------------------------------------------------------------------------------------

const ASSET = installer.appAssetName(VERSION);
const SUMS = `plan2code-app-${VERSION}-SHA256SUMS.txt`;
const APP_DIR = path.dirname(installer.APP_DEST);
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

/** A release server for `files` (`{ path: Buffer | string }`); `hits` lists every path asked for. */
async function releaseServer(files) {
  const hits = [];
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.slice(1));
    hits.push(name);
    if (name in files) {
      res.writeHead(200);
      res.end(files[name]);
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  process.env.PLAN2CODE_RELEASE_BASE = `http://127.0.0.1:${server.address().port}/release`;
  return {
    hits,
    close: () => {
      delete process.env.PLAN2CODE_RELEASE_BASE;
      server.close();
    },
  };
}

/** A release serving `bytes` as this system's app, listed under `listedHash` (default: its real hash). */
function goodRelease(bytes, listedHash = sha(bytes)) {
  return {
    [`release/${ASSET}`]: bytes,
    [`release/${SUMS}`]: `${listedHash}  ${ASSET}\n${"0".repeat(64)}  plan2code-app-other\n`,
  };
}

/** Run `fn` with console output captured; resolves `{ result, out }`. */
async function captured(fn) {
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const result = await fn();
    return { result, out: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
  } finally {
    console.log = log;
  }
}

function freshApp() {
  fs.rmSync(APP_DIR, { recursive: true, force: true });
  clearRecord();
}

test("app: the release file is named by system and cpu, and an unbuilt system has none", () => {
  assert.equal(installer.appAssetName("3.0.0", "win32", "x64"), "plan2code-app-3.0.0-windows-x64.exe");
  assert.equal(installer.appAssetName("3.0.0", "darwin", "arm64"), "plan2code-app-3.0.0-macos-arm64");
  assert.equal(installer.appAssetName("3.0.0", "darwin", "x64"), "plan2code-app-3.0.0-macos-x64");
  assert.equal(installer.appAssetName("3.0.0", "linux", "x64"), "plan2code-app-3.0.0-linux-x64");
  assert.equal(installer.appAssetName("3.0.0", "freebsd", "x64"), null);
  assert.equal(installer.appAssetName("3.0.0", "linux", "ia32"), null);
});

test("app: checksumFor reads text and binary mode lines and wants the exact name", () => {
  const hex = "ab".repeat(32);
  const list = `${hex}  plan2code-app-1-linux-x64\n${"cd".repeat(32)} *plan2code-app-1-macos-arm64\r\nnot a checksum line\n`;
  assert.equal(installer.checksumFor(list, "plan2code-app-1-linux-x64"), hex);
  assert.equal(installer.checksumFor(list, "plan2code-app-1-macos-arm64"), "cd".repeat(32));
  assert.equal(installer.checksumFor(list, "plan2code-app-1-linux"), null);
  assert.equal(installer.checksumFor("", "x"), null);
});

test("app installed: the file is downloaded, verified, placed and recorded", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["skills", "launcher"]);
  const bytes = Buffer.from("pretend this is an executable");
  const server = await releaseServer(goodRelease(bytes));
  try {
    const outcome = {};
    const { result, out } = await captured(() => installer.installDesktopApp({ quiet: true, outcome }));
    assert.equal(result, 0, out);
    assert.equal(outcome.app, true);
    assert.deepEqual(fs.readFileSync(installer.APP_DEST), bytes);
    assert.deepEqual(installer.readInstallRecord().pieces, ["app", "launcher", "skills"]);
    assert.deepEqual(fs.readdirSync(APP_DIR), [path.basename(installer.APP_DEST)], "no temp or .old file is left");
    assert.match(out, /unsigned/);
    assert.deepEqual(server.hits, [`release/${SUMS}`, `release/${ASSET}`]);
  } finally {
    server.close();
  }
});

test("app checksum mismatch: the file is rejected, nothing is placed and the old app stays", { skip: !ASSET }, async () => {
  freshApp();
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(installer.APP_DEST, "the app that was already here");
  writeRecord(["skills", "launcher", "app"]);
  const server = await releaseServer(goodRelease(Buffer.from("tampered bytes"), "1".repeat(64)));
  try {
    const outcome = {};
    const { result, out } = await captured(() => installer.installDesktopApp({ quiet: true, outcome }));
    assert.equal(result, 1);
    assert.equal(outcome.app, false);
    assert.match(out, /does not match its checksum/);
    // Said plainly: the rest is installed and --classic is today's flow.
    assert.match(out, /skills and the plan2code command are installed/);
    assert.equal(fs.readFileSync(installer.APP_DEST, "utf8"), "the app that was already here");
    assert.deepEqual(fs.readdirSync(APP_DIR), [path.basename(installer.APP_DEST)]);
  } finally {
    server.close();
  }
});

test("app: a release without the file, or without a checksum entry, fails plainly and places nothing", { skip: !ASSET }, async () => {
  for (const files of [{}, { [`release/${SUMS}`]: `${"2".repeat(64)}  some-other-file\n` }]) {
    freshApp();
    writeRecord(["skills", "launcher"]);
    const server = await releaseServer(files);
    try {
      const outcome = {};
      const { result, out } = await captured(() => installer.installDesktopApp({ quiet: true, outcome }));
      assert.equal(result, 1, out);
      assert.equal(outcome.app, false);
      assert.match(out, /The desktop app was not installed: /);
      assert.equal(fs.existsSync(installer.APP_DEST), false);
      assert.deepEqual(installer.readInstallRecord().pieces, ["skills", "launcher"], "a failed install leaves the record as it was");
    } finally {
      server.close();
    }
  }
});

test("app: a server that is not there fails plainly", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["skills", "launcher"]);
  process.env.PLAN2CODE_RELEASE_BASE = "http://127.0.0.1:1/release";
  try {
    const { result, out } = await captured(() => installer.installDesktopApp({ quiet: true }));
    assert.equal(result, 1);
    assert.match(out, /could not download it/);
  } finally {
    delete process.env.PLAN2CODE_RELEASE_BASE;
  }
});

test("app update: plan2code update replaces an older app and reports it", { skip: !ASSET }, async () => {
  freshApp();
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(installer.APP_DEST, "an older app");
  writeRecord(["app"]);
  const bytes = Buffer.from("the newer app");
  const server = await releaseServer(goodRelease(bytes));
  try {
    // The real app step, in the real update loop; the record lists only the app.
    const { result, out } = await captured(() => installer.update({ steps: installer.UPDATE_STEPS }));
    assert.equal(result, 0, out);
    assert.match(out, /app: updated/);
    assert.deepEqual(fs.readFileSync(installer.APP_DEST), bytes);
    assert.deepEqual(fs.readdirSync(APP_DIR), [path.basename(installer.APP_DEST)]);
  } finally {
    server.close();
  }
});

test("app update: a checksum mismatch fails the update naming the app, nothing else", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["app"]);
  const server = await releaseServer(goodRelease(Buffer.from("tampered bytes"), "1".repeat(64)));
  try {
    const { result, out } = await captured(() => installer.update({ steps: installer.UPDATE_STEPS }));
    assert.equal(result, 1);
    assert.match(out, /Update failed for: app/);
  } finally {
    server.close();
  }
});

test("app update: a release with no app file yet keeps the installed app and does not fail the update", { skip: !ASSET }, async () => {
  freshApp();
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(installer.APP_DEST, "the installed app");
  writeRecord(["app"]);
  // main moves to a new version before the release's files are attached: every file is a 404.
  const server = await releaseServer({});
  try {
    const { result, out } = await captured(() => installer.update({ steps: installer.UPDATE_STEPS }));
    assert.equal(result, 0, out);
    assert.match(out, /app: kept/);
    assert.doesNotMatch(out, /Update failed/);
    assert.equal(fs.readFileSync(installer.APP_DEST, "utf8"), "the installed app");
  } finally {
    server.close();
  }
});

test("app: interactively, a release with no app file is a plain failure, and a placement error is not called a download error", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["skills", "launcher"]);
  let server = await releaseServer({});
  try {
    const { result, out } = await captured(() => installer.installDesktopApp({ quiet: true }));
    assert.equal(result, 1);
    assert.match(out, /has no desktop app file for/);
  } finally {
    server.close();
  }

  // The download is fine but the folder cannot be made: a file sits where the app folder goes.
  fs.mkdirSync(path.dirname(APP_DIR), { recursive: true });
  fs.writeFileSync(APP_DIR, "in the way");
  server = await releaseServer(goodRelease(Buffer.from("a good file")));
  try {
    const { result, out } = await captured(() => installer.installDesktopApp({ quiet: true }));
    assert.equal(result, 1);
    assert.match(out, /the file was verified but could not be put in/);
    assert.doesNotMatch(out, /could not download/);
  } finally {
    server.close();
    fs.rmSync(APP_DIR, { force: true });
  }
});

test("app offered: a system with no build is never asked about, never downloaded for and says nothing red", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["skills", "launcher"]);
  const server = await releaseServer(goodRelease(Buffer.from("never fetched")));
  const arch = Object.getOwnPropertyDescriptor(process, "arch");
  Object.defineProperty(process, "arch", { value: "ia32", configurable: true });
  try {
    for (const unattended of [true, false]) {
      const { out } = await captured(() => installer.offerDesktopApp({ unattended, outcome: {} }));
      assert.doesNotMatch(out, /was not installed/);
    }
    assert.deepEqual(server.hits, []);
    assert.equal(fs.existsSync(installer.APP_DEST), false);
  } finally {
    Object.defineProperty(process, "arch", arch);
    server.close();
  }
});

test("app offered: unattended with no app file in the release yet is a dim note, not a failure", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["skills", "launcher"]);
  const server = await releaseServer({});
  try {
    const outcome = {};
    const { out } = await captured(() => installer.offerDesktopApp({ unattended: true, outcome }));
    assert.match(out, /No desktop app update/);
    assert.doesNotMatch(out, /was not installed/);
    assert.equal(outcome.app, false);
    assert.equal(fs.existsSync(installer.APP_DEST), false);
  } finally {
    server.close();
  }
});

test("app skipped: an unattended offer downloads nothing when the app is recorded or was declined", { skip: !ASSET }, async () => {
  const server = await releaseServer(goodRelease(Buffer.from("never fetched")));
  try {
    // Recorded: the update loop owns it. Declined: the person said no once.
    for (const record of [{ pieces: ["skills", "app"] }, { pieces: ["skills"], skipped: ["app"] }]) {
      freshApp();
      fs.mkdirSync(path.dirname(RECORD), { recursive: true });
      fs.writeFileSync(RECORD, JSON.stringify({ version: "1.0.0", scope: "global", ...record }));
      await captured(() => installer.offerDesktopApp({ unattended: true, outcome: {} }));
      assert.equal(fs.existsSync(installer.APP_DEST), false, JSON.stringify(record));
    }
    assert.deepEqual(server.hits, []);
  } finally {
    server.close();
  }
});

test("app offered: unattended with nothing recorded about it means yes, and installing clears an old no", { skip: !ASSET }, async () => {
  freshApp();
  writeRecord(["skills", "launcher"]);
  const bytes = Buffer.from("first time app");
  const server = await releaseServer(goodRelease(bytes));
  try {
    const outcome = {};
    await captured(() => installer.offerDesktopApp({ unattended: true, outcome }));
    assert.equal(outcome.app, true);
    assert.deepEqual(fs.readFileSync(installer.APP_DEST), bytes);
  } finally {
    server.close();
  }
  // A recorded decline is dropped once the piece is installed, and the key leaves the file when empty.
  fs.writeFileSync(RECORD, JSON.stringify({ version: "1.0.0", scope: "global", pieces: ["skills"], skipped: ["app"] }));
  installer.recordInstalled("app");
  assert.deepEqual(installer.readInstallRecord(), { version: VERSION, scope: "global", pieces: ["app", "skills"] });
});

test("app declined: the no is remembered next to the pieces, and needs a record to be kept", () => {
  clearRecord();
  installer.recordSkipped("app");
  assert.equal(installer.readInstallRecord(), null, "no record is invented for a decline");
  writeRecord(["skills"]);
  installer.recordSkipped("app");
  assert.deepEqual(installer.readInstallRecord(), { version: VERSION, scope: "global", pieces: ["skills"], skipped: ["app"] });
  installer.recordInstalled("launcher");
  assert.deepEqual(installer.readInstallRecord().skipped, ["app"], "other writes keep the decline");
});
