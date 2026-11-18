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
    const code = await installer.update({ steps, cleanShims: () => {} });
    return { code, out: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
  } finally {
    console.log = log;
  }
}

test("install record: recordInstalled and forgetInstalled round trip a sorted set", () => {
  clearRecord();
  assert.equal(installer.INSTALL_RECORD, RECORD);
  assert.equal(installer.readInstallRecord(), null);
  installer.recordInstalled("metrics");
  installer.recordInstalled("skills");
  installer.recordInstalled("skills");
  installer.recordInstalled("not-a-piece");
  assert.deepEqual(installer.readInstallRecord(), { version: VERSION, scope: "global", pieces: ["metrics", "skills"] });
  installer.forgetInstalled("metrics");
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
  assert.match(out, /No install record found; updating the skills and the plan2code command\./);
  assert.doesNotMatch(out, /installed before v/);
  // install() covers the command with the skills, so the launcher step does not run again.
  assert.deepEqual(fake.ran(), ["skills"]);
  assert.match(out, /Skills: updated/);
  assert.match(out, /plan2code command: updated/);
});

test("update: a partial record runs only the listed pieces, in order, unattended", async () => {
  writeRecord(["bot", "statusline"]);
  const fake = fakeSteps();
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.deepEqual(fake.ran(), ["statusline", "bot"]);
  for (const call of fake.calls) assert.equal(call.options.unattended, true, call.piece);
  assert.doesNotMatch(out, /No install record/);
  assert.doesNotMatch(out, /Skills:/);
});

test("update: a failing piece exits 1 naming it, and the others still run", async () => {
  writeRecord(["skills", "launcher", "statusline", "metrics", "bot"]);
  const fake = fakeSteps({ codes: { statusline: 1 }, throws: { metrics: "npm exploded" } });
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 1, out);
  assert.deepEqual(fake.ran(), ["skills", "statusline", "metrics", "bot"]);
  assert.match(out, /Status line: failed: /);
  assert.match(out, /Metrics: failed: npm exploded/);
  assert.match(out, /Bot: updated/);
  assert.match(out, /Update failed for: Status line, Metrics/);
});

test("update: when the skills install leaves the command out, the launcher step runs on its own", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps({ launcherWithSkills: false });
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.deepEqual(fake.ran(), ["skills", "launcher"]);
  // install() returned 1 for the command alone: the skills still read as updated.
  assert.match(out, /Skills: updated/);
  assert.match(out, /plan2code command: updated/);
});

test("update: a command that fails on the retry is the only piece named", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps({ launcherWithSkills: false, codes: { launcher: 1 } });
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 1, out);
  assert.match(out, /Skills: updated/);
  assert.match(out, /Update failed for: plan2code command\b/);
  // A failed update says how to go back (the record's old version here).
  assert.match(out, /To go back to a release, run: plan2code update --tag v1\.0\.0/);
});

test("update: prints the version change, one line per piece by name, the release notes link and the restart hint", async () => {
  writeRecord(["skills", "launcher", "app", "statusline"]);
  const fake = fakeSteps();
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.match(out, new RegExp(`^Updating 1\\.0\\.0 -> ${VERSION.replace(/\./g, "\\.")}$`, "m"));
  // The compact summary: human names only, never the internal piece names.
  assert.match(out, /Skills: updated/);
  assert.match(out, /plan2code command: updated/);
  assert.match(out, /Desktop app: updated/);
  assert.match(out, /Status line: updated/);
  assert.doesNotMatch(out, /[✓✗] (skills|launcher|statusline|app|metrics|bot): /);
  assert.equal((out.match(/Update summary/g) || []).length, 1, "one summary");
  assert.match(out, new RegExp(`^What's new: https://github\\.com/jparkerweb/plan2code/releases/tag/v${VERSION.replace(/\./g, "\\.")}$`, "m"));
  assert.match(out, /Close any open Plan2Code console or app and start `plan2code` again\./);
  assert.doesNotMatch(out, /Happy coding|PARAMETERS|To go back to a release/);
});

test("update: already on the new version it says so and stops, until --force", async () => {
  fs.mkdirSync(path.dirname(RECORD), { recursive: true });
  fs.writeFileSync(RECORD, JSON.stringify({ version: VERSION, scope: "global", pieces: ["skills", "launcher"] }));
  const idle = fakeSteps();
  const stopped = await runUpdate(idle.steps);
  assert.equal(stopped.code, 0, stopped.out);
  assert.match(stopped.out, new RegExp(`Already on ${VERSION.replace(/\./g, "\\.")}`));
  assert.match(stopped.out, /plan2code update --force/);
  assert.deepEqual(idle.ran(), [], "nothing was reinstalled");
  assert.doesNotMatch(stopped.out, /Update summary/);

  const forced = fakeSteps();
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  let code;
  try {
    code = await installer.update({ steps: forced.steps, cleanShims: () => {}, force: true });
  } finally {
    console.log = log;
  }
  const out = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
  assert.equal(code, 0, out);
  assert.deepEqual(forced.ran(), ["skills"]);
  assert.match(out, new RegExp(`Updating ${VERSION.replace(/\./g, "\\.")} -> ${VERSION.replace(/\./g, "\\.")}`));
});

test("update: a step's own output stays out of the summary, except its warnings and its failures", async () => {
  writeRecord(["skills", "statusline", "bot"]);
  const fake = fakeSteps();
  fake.steps.skills = async (options) => {
    console.log("Installing skills");
    console.log("  ✓ Built 23 skills from src/");
    console.log("  ! heads up from the skills step");
    options.outcome.skills = true;
    options.outcome.launcher = true;
    return 0;
  };
  fake.steps.statusline = async () => {
    console.log("  ✗ could not write settings.json");
    return 1;
  };
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 1, out);
  assert.doesNotMatch(out, /Installing skills|Built 23 skills/);
  assert.match(out, /! heads up from the skills step/);
  assert.match(out, /✗ could not write settings\.json/);
});

test("update: a failed update puts the old version back in the record, so a retry runs instead of stopping at Already on", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps({ codes: { skills: 1 } });
  // As the real launcher step: it works, and recording it stamps the version being installed.
  fake.steps.launcher = async () => {
    installer.recordInstalled("launcher");
    return 0;
  };
  const failed = await runUpdate(fake.steps);
  assert.equal(failed.code, 1, failed.out);
  assert.match(failed.out, /To try again, run: plan2code update/);
  assert.match(failed.out, /To go back to a release, run: plan2code update --tag v1\.0\.0/);
  assert.equal(installer.readInstallRecord().version, "1.0.0", "the record stays on the old version");
  assert.deepEqual(installer.readInstallRecord().pieces, ["launcher", "skills"], "and keeps every piece");

  const retry = await runUpdate(fakeSteps().steps);
  assert.equal(retry.code, 0, retry.out);
  assert.doesNotMatch(retry.out, /Already on/);
  assert.match(retry.out, /Plan2Code is up to date/);
});

test("update: an app kept because the release has no app file yet leaves the old version on the record, so the next update fetches it", async () => {
  writeRecord(["skills", "launcher", "app"]);
  const fake = fakeSteps();
  fake.steps.app = async (options) => {
    installer.recordInstalled("app");
    options.outcome.appMissing = true;
    return 0;
  };
  const kept = await runUpdate(fake.steps);
  assert.equal(kept.code, 0, kept.out);
  assert.match(kept.out, /Desktop app: kept \(no new desktop app file yet\)/);
  assert.equal(installer.readInstallRecord().version, "1.0.0", "the record stays on the old version");

  const next = await runUpdate(fakeSteps().steps);
  assert.equal(next.code, 0, next.out);
  assert.doesNotMatch(next.out, /Already on/);
  assert.match(next.out, /Desktop app: updated/);
});

test("update: a failed desktop app install inside the skills step is shown, and does not fail the update", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps();
  fake.steps.skills = async (options) => {
    console.log("  Built 23 skills from src/");
    console.log("  ✗ The desktop app was not installed: the download did not match its checksum.");
    options.outcome.skills = true;
    options.outcome.launcher = true;
    options.outcome.app = false;
    return 0;
  };
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.match(out, /✗ The desktop app was not installed: the download did not match its checksum\./);
  assert.doesNotMatch(out, /Built 23 skills/);
});

test("update: the app's size is in its summary line when the skills step brought it in", async () => {
  writeRecord(["skills", "launcher"]);
  const fake = fakeSteps();
  fake.steps.skills = async (options) => {
    options.outcome.skills = true;
    options.outcome.launcher = true;
    options.outcome.app = true;
    options.outcome.appSize = 3 * 1024 * 1024;
    return 0;
  };
  const { code, out } = await runUpdate(fake.steps);
  assert.equal(code, 0, out);
  assert.match(out, /Desktop app: updated \(3\.0 MB\)/);
});

test("uninstall: printKeptData names the folder and lists each entry with its size", async () => {
  const data = path.join(HOME, ".plan2code");
  fs.mkdirSync(path.join(data, "handoffs"), { recursive: true });
  fs.writeFileSync(path.join(data, "handoffs", "h.md"), "y".repeat(3000));
  const { out } = await captured(() => installer.printKeptData());
  assert.match(out, /Your data in .* was kept/);
  assert.match(out, /Handoffs: 3 KB/);
  fs.rmSync(path.join(data, "handoffs"), { recursive: true, force: true });
});

test("install.js --update: an option other than --force is refused", () => {
  const refused = spawnSync(process.execPath, [INSTALL, "--update", "--nope"], { encoding: "utf8", env: { ...process.env, HOME, USERPROFILE: HOME } });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /Unknown option\(s\): --update --nope/);
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

test("install.js: --update and --uninstall are in the usage line, and an unknown option still exits 1", () => {
  const result = spawnSync(process.execPath, [INSTALL, "--bogus"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes("Usage: node install.js [--build-skills | --verify-skills | --update [--force] | --uninstall [--yes] [--purge]]"), result.stderr);
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
      // As GitHub does, the size is sent, so the download can show it.
      res.writeHead(200, { "Content-Length": Buffer.byteLength(files[name]) });
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
    assert.match(out, /Downloading the desktop app \(1 KB\)\.\.\./, "piped: the size, on one plain line");
    assert.match(out, /not code-signed/);
    assert.ok(out.includes(`Installed: ${installer.APP_DEST}`), out);
    assert.ok(out.includes(installer.APP_GUIDE_URL), out);
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
    const { result, out } = await captured(() => installer.update({ steps: installer.UPDATE_STEPS, cleanShims: () => {} }));
    assert.equal(result, 0, out);
    assert.match(out, /Desktop app: updated/);
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
    const { result, out } = await captured(() => installer.update({ steps: installer.UPDATE_STEPS, cleanShims: () => {} }));
    assert.equal(result, 1);
    assert.match(out, /Update failed for: Desktop app/);
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
    const { result, out } = await captured(() => installer.update({ steps: installer.UPDATE_STEPS, cleanShims: () => {} }));
    assert.equal(result, 0, out);
    assert.match(out, /Desktop app: kept/);
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

test("shared console install: the new version is placed, old versions go, and every other entry is left byte-identical", () => {
  const SHARED = path.join(ROOT, "skills", installer.CONSOLE_SHARED_DIR, VERSION, "console.mjs");
  if (!fs.existsSync(SHARED)) spawnSync(process.execPath, [INSTALL, "--build-skills"], { stdio: "ignore" });
  const home = installer.consoleHomeDir();
  assert.equal(home, path.join(HOME, ".plan2code", "console"), "the default home is under the temp HOME");
  fs.rmSync(home, { recursive: true, force: true });
  const put = (rel, body) => {
    const p = path.join(home, ...rel.split("/"));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
    return p;
  };
  put("2.9.9/console.mjs", "old");
  put("2.9.9/public/core.js", "old");
  put("10.0.0/console.mjs", "an older or newer version folder goes too");
  put(`${VERSION}/stale.txt`, "a leftover inside the folder being replaced");
  const kept = {
    "sessions/20261108-101010-aaaaaa/state.json": '{"a":1}',
    "sessions/20261108-101010-aaaaaa/shots/x.png": "png",
    "looks.json": '{"theme":"dark"}',
    "workspaces.json": "{}",
    "subagents.json": "[]",
    "runtime/x.json": "{}",
    "notes.txt": "not ours",
    "3.0/keep.txt": "not a version folder",
  };
  for (const [rel, body] of Object.entries(kept)) put(rel, body);

  const lines = [];
  const log = console.log;
  console.log = (...a) => lines.push(a.join(" "));
  let ok;
  try {
    ok = installer.installSharedConsole({ quiet: false });
  } finally {
    console.log = log;
  }
  assert.equal(ok, true);

  assert.equal(fs.existsSync(path.join(home, "2.9.9")), false, "an old version folder is gone");
  assert.equal(fs.existsSync(path.join(home, "10.0.0")), false, "every other version folder is gone");
  assert.ok(fs.existsSync(path.join(home, VERSION, "console.mjs")), "the new version is present");
  assert.equal(fs.readFileSync(path.join(home, VERSION, "version.txt"), "utf8").trim(), VERSION);
  assert.equal(fs.existsSync(path.join(home, VERSION, "stale.txt")), false, "the folder is replaced, not merged");
  assert.equal(fs.readFileSync(path.join(home, "console-dir"), "utf8").trim(), path.join(home, VERSION));
  for (const [rel, body] of Object.entries(kept)) {
    assert.equal(fs.readFileSync(path.join(home, ...rel.split("/")), "utf8"), body, rel + " is untouched");
  }
  assert.ok(lines.some((line) => line.includes("Removed old console 2.9.9")), lines.join("\n"));

  // A second run changes nothing it should not.
  assert.equal(installer.installSharedConsole({ quiet: true }), true);
  assert.equal(fs.readFileSync(path.join(home, "looks.json"), "utf8"), kept["looks.json"]);
  assert.ok(fs.existsSync(path.join(home, VERSION, "console.mjs")));
});

test("shared console install: sweep false keeps old versions until sweepOldConsoles runs", () => {
  const SHARED = path.join(ROOT, "skills", installer.CONSOLE_SHARED_DIR, VERSION, "console.mjs");
  if (!fs.existsSync(SHARED)) spawnSync(process.execPath, [INSTALL, "--build-skills"], { stdio: "ignore" });
  const home = installer.consoleHomeDir();
  fs.rmSync(home, { recursive: true, force: true });
  fs.mkdirSync(path.join(home, "2.9.9"), { recursive: true });
  fs.writeFileSync(path.join(home, "2.9.9", "console.mjs"), "old");
  fs.writeFileSync(path.join(home, "2.9.9", "version.txt"), "2.9.9\n");
  assert.equal(installer.installSharedConsole({ quiet: true, sweep: false }), true);
  assert.ok(fs.existsSync(path.join(home, "2.9.9", "console.mjs")), "a failed skills add leaves the old version for the old stubs");
  assert.ok(fs.existsSync(path.join(home, VERSION, "console.mjs")), "the new version is placed");
  installer.sweepOldConsoles({ quiet: true });
  assert.equal(fs.existsSync(path.join(home, "2.9.9")), false, "swept once skills add worked");
  assert.ok(fs.existsSync(path.join(home, VERSION, "console.mjs")), "the current version stays");
});

test("shared console install: a missing build fails plainly and removes nothing", () => {
  const home = installer.consoleHomeDir();
  fs.mkdirSync(home, { recursive: true });
  fs.writeFileSync(path.join(home, "looks.json"), "{}");
  const errors = [];
  const error = console.error;
  console.error = (...a) => errors.push(a.join(" "));
  try {
    // An empty folder stands in for a build that did not happen; the real build is never touched.
    const empty = fs.mkdtempSync(path.join(HOME, "no-build-"));
    assert.equal(installer.installSharedConsole({ quiet: true, source: empty }), false);
  } finally {
    console.error = error;
  }
  assert.ok(errors.join("\n").includes("Could not install the shared console"));
  assert.ok(fs.existsSync(path.join(home, "looks.json")), "what was there stays");
});

test("the skills CLI is pinned to one exact version, and every doc line that runs it names that version", () => {
  const source = fs.readFileSync(INSTALL, "utf8");
  const pinned = source.match(/const SKILLS_CLI_VERSION = '(\d+\.\d+\.\d+)';/);
  assert.ok(pinned, "install.js pins SKILLS_CLI_VERSION to an exact x.y.z");
  assert.ok(source.includes("npx --yes skills@${SKILLS_CLI_VERSION}"), "SKILLS_CLI runs the pinned version");
  assert.ok(!/npx (--yes )?skills( |')/.test(source), "no unpinned `npx skills` in install.js");
  for (const doc of ["README.md", ".agents-docs/AGENTS-development-commands.md"]) {
    const text = fs.readFileSync(path.join(ROOT, doc), "utf8");
    assert.ok(!/npx (--yes )?skills (add|list|remove|--version)/.test(text), `${doc} has an unpinned \`npx skills\` command`);
    for (const m of text.matchAll(/npx (?:--yes )?skills@(\d+\.\d+\.\d+)/g)) {
      assert.equal(m[1], pinned[1], `${doc} names skills@${m[1]}, install.js pins ${pinned[1]}`);
    }
  }
});

/** Run uninstall() with console output captured and the answers to its y/N questions scripted. */
async function runUninstall(options, answers = []) {
  const lines = [];
  const asked = [];
  const calls = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const code = await installer.uninstall({
      ask: async (prompt) => {
        asked.push(prompt.replace(/\x1b\[[0-9;]*m/g, ""));
        return answers.shift() ?? false;
      },
      remove: () => (calls.push("remove"), 0),
      purgeIt: () => (calls.push("purge"), 0),
      purgeWebview: () => (calls.push("webview"), 0),
      running: () => false,
      ...options,
    });
    return { code, asked, calls, out: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
  } finally {
    console.log = log;
  }
}

test("uninstall: a no at the confirmation removes nothing", async () => {
  const r = await runUninstall({}, [false]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.calls, []);
  assert.equal(r.asked.length, 1);
  assert.match(r.out, /CANCELED/);
});

test("uninstall: a yes removes everything, then asks about the data and keeps it on a no", async () => {
  const r = await runUninstall({}, [true, false]);
  assert.equal(r.code, 0);
  assert.deepEqual(r.calls, ["remove"]);
  assert.equal(r.asked.length, 2);
  assert.match(r.asked[1], /Also delete your Plan2Code data/);
  assert.match(r.out, /data in .* was kept/);
});

test("uninstall: a yes to the data question purges it", async () => {
  const r = await runUninstall({}, [true, true]);
  assert.deepEqual(r.calls, ["remove", "purge", "webview"]);
});

test("uninstall: --yes skips both questions and keeps the data", async () => {
  const r = await runUninstall({ yes: true });
  assert.deepEqual(r.asked, []);
  assert.deepEqual(r.calls, ["remove"]);
});

test("uninstall: --yes --purge deletes the data without a question", async () => {
  const r = await runUninstall({ yes: true, purge: true });
  assert.deepEqual(r.asked, []);
  assert.deepEqual(r.calls, ["remove", "purge", "webview"]);
});

test("uninstall: --purge alone still confirms the uninstall but never asks about the data", async () => {
  const r = await runUninstall({ purge: true }, [true]);
  assert.equal(r.asked.length, 1);
  assert.deepEqual(r.calls, ["remove", "purge", "webview"]);
});

test("uninstall: a failing removal or purge makes the exit code non-zero", async () => {
  assert.equal((await runUninstall({ yes: true, remove: () => 1 })).code, 1);
  assert.equal((await runUninstall({ yes: true, purge: true, purgeIt: () => 1 })).code, 1);
});

test("purgeData: deletes the folder and everything in it, and copes with it missing", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-purge-"));
  fs.mkdirSync(path.join(dir, "notepads"));
  fs.writeFileSync(path.join(dir, "notepads", "a.json"), "{}");
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(installer.purgeData(dir), 0);
    assert.equal(fs.existsSync(dir), false);
    assert.equal(installer.purgeData(dir), 0);
  } finally {
    console.log = log;
  }
});

test("install.js --uninstall: an unknown extra option is refused", () => {
  const r = spawnSync(process.execPath, [INSTALL, "--uninstall", "--nuke"], { encoding: "utf8", env: { ...process.env, HOME, USERPROFILE: HOME } });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /Unknown option\(s\): --uninstall --nuke/);
});

test("install.js --uninstall: with no terminal and no --yes it explains, exits 1 and removes nothing", () => {
  fs.mkdirSync(path.join(HOME, ".plan2code"), { recursive: true });
  const r = spawnSync(process.execPath, [INSTALL, "--uninstall"], { encoding: "utf8", input: "", env: { ...process.env, HOME, USERPROFILE: HOME } });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stdout, /Run plan2code uninstall --yes/);
  assert.ok(fs.existsSync(path.join(HOME, ".plan2code")));
});

test("install: the Node guard names the version on Node older than 18", () => {
  assert.equal(installer.nodeVersionProblem("16.20.2"), "Plan2Code needs Node.js 18 or newer; you have v16.20.2. Get it from nodejs.org");
  assert.equal(installer.nodeVersionProblem("17.9.1").startsWith("Plan2Code needs Node.js 18 or newer"), true);
  assert.equal(installer.nodeVersionProblem("18.0.0"), null);
  assert.equal(installer.nodeVersionProblem("26.1.0"), null);
});

test("install: an old Node fails fast with the guard's sentence before installing anything", () => {
  const code = `Object.defineProperty(process.versions, "node", { value: "16.20.2" }); require(${JSON.stringify(INSTALL)});`;
  const result = spawnSync(process.execPath, ["-e", code], { encoding: "utf8", env: { ...process.env, HOME, USERPROFILE: HOME } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Plan2Code needs Node\.js 18 or newer; you have v16\.20\.2\. Get it from nodejs\.org/);
});

test("uninstall: --purge also removes the app's webview data, and a failure there is non-zero", async () => {
  assert.equal((await runUninstall({ yes: true, purge: true, purgeWebview: () => 1 })).code, 1);
  const kept = await runUninstall({ yes: true });
  assert.deepEqual(kept.calls, ["remove"]);
});

test("uninstall: a running app is named before anything is removed", async () => {
  const r = await runUninstall({ yes: true, running: () => true });
  assert.match(r.out, /Plan2Code is running: close it first/);
  const quiet = await runUninstall({ yes: true });
  assert.doesNotMatch(quiet.out, /is running/);
});

test("appWebviewDirs: the webview data folder for com.plan2code.desktop on each OS", () => {
  const home = path.join(path.sep, "h");
  // The last folder on each OS is the app's config folder, where the window-state file lives.
  assert.deepEqual(installer.appWebviewDirs({ platform: "win32", home, env: { LOCALAPPDATA: path.join(home, "Local"), APPDATA: path.join(home, "Roaming") } }), [
    path.join(home, "Local", "com.plan2code.desktop"),
    path.join(home, "Roaming", "com.plan2code.desktop"),
  ]);
  assert.deepEqual(installer.appWebviewDirs({ platform: "win32", home, env: {} }), [
    path.join(home, "AppData", "Local", "com.plan2code.desktop"),
    path.join(home, "AppData", "Roaming", "com.plan2code.desktop"),
  ]);
  assert.deepEqual(installer.appWebviewDirs({ platform: "linux", home, env: {} }), [
    path.join(home, ".local", "share", "com.plan2code.desktop"),
    path.join(home, ".cache", "com.plan2code.desktop"),
    path.join(home, ".config", "com.plan2code.desktop"),
  ]);
  assert.deepEqual(installer.appWebviewDirs({ platform: "linux", home, env: { XDG_DATA_HOME: path.join(home, "d"), XDG_CACHE_HOME: path.join(home, "c"), XDG_CONFIG_HOME: path.join(home, "g") } }), [
    path.join(home, "d", "com.plan2code.desktop"),
    path.join(home, "c", "com.plan2code.desktop"),
    path.join(home, "g", "com.plan2code.desktop"),
  ]);
  assert.deepEqual(installer.appWebviewDirs({ platform: "darwin", home, env: {} }), [
    path.join(home, "Library", "WebKit", "com.plan2code.desktop"),
    path.join(home, "Library", "WebKit", "plan2code-app"),
    path.join(home, "Library", "Caches", "com.plan2code.desktop"),
    path.join(home, "Library", "Caches", "plan2code-app"),
    path.join(home, "Library", "Application Support", "com.plan2code.desktop"),
  ]);
});

test("purgeAppWebview: removes the folders that exist and skips the rest", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-webview-"));
  const there = path.join(dir, "com.plan2code.desktop");
  fs.mkdirSync(path.join(there, "EBWebView"), { recursive: true });
  const log = console.log;
  console.log = () => {};
  try {
    assert.equal(installer.purgeAppWebview([there, path.join(dir, "missing")]), 0);
    assert.equal(fs.existsSync(there), false);
  } finally {
    console.log = log;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("appRunning: asks tasklist on Windows and pgrep elsewhere by the program's name", () => {
  const seen = [];
  const run = (cmd, args) => (seen.push([cmd, ...args]), { status: 0, stdout: cmd === "tasklist" ? "plan2code-app.exe  1234 Console" : "" });
  assert.equal(installer.appRunning({ platform: "win32", run }), true);
  assert.equal(installer.appRunning({ platform: "win32", run: () => ({ status: 0, stdout: "INFO: No tasks are running" }) }), false);
  assert.equal(installer.appRunning({ platform: "linux", run }), true);
  assert.equal(installer.appRunning({ platform: "darwin", run: () => ({ status: 1 }) }), false);
  assert.equal(installer.appRunning({ platform: "linux", run: () => { throw new Error("no pgrep"); } }), false);
  assert.deepEqual(seen[1], ["pgrep", "-x", "plan2code-app"]);
});

// ---------------------------------------------------------------------------------------------
// The next steps after an install: on or off PATH, with or without the desktop app.
// ---------------------------------------------------------------------------------------------

/** printGettingStarted's output with colors stripped. */
async function gettingStarted(options) {
  const { out } = await captured(() => installer.printGettingStarted({ commandInstalled: true, agents: { found: ["Claude Code"], builtins: [] }, ...options }));
  return out;
}

const POSIX_BIN = "/home/me/.local/bin";

test("next steps: on PATH without the app, plan2code opens the agent and no PATH line is printed", async () => {
  const out = await gettingStarted({ pathMissing: false, appInstalled: false, platform: "linux" });
  assert.match(out, /plan2code\s+opens your AI agent on the Plan2Code dashboard/);
  assert.match(out, /page that opens in your browser/);
  assert.doesNotMatch(out, /not on your PATH|export PATH|open a new terminal/);
});

test("next steps: on PATH with the app, steps 2 and 3 name the Plan2Code app", async () => {
  const out = await gettingStarted({ pathMissing: false, appInstalled: true, platform: "linux" });
  assert.match(out, /plan2code\s+opens the Plan2Code app/);
  assert.match(out, /3\. Pick a card on the dashboard: plan2code opens the Plan2Code app/);
  assert.doesNotMatch(out, /page that opens in your browser|export PATH/);
});

test("next steps: off PATH without the app, the shell's PATH line, a new terminal and the full path", async () => {
  const out = await gettingStarted({ pathMissing: true, binDir: POSIX_BIN, appInstalled: false, platform: "linux", shell: "/bin/zsh" });
  assert.match(out, /export PATH="[^"]*\.local\/bin:\$PATH"' >> ~\/\.zshrc/);
  assert.match(out, /open a new terminal/);
  assert.ok(out.includes(`"${POSIX_BIN}/plan2code"`), out);
  assert.match(out, /opens your AI agent on the Plan2Code dashboard/);
});

test("next steps: off PATH with the app on Windows, the PowerShell line, a new terminal, the .cmd path and the app", async () => {
  const bin = "C:\\Users\\me\\AppData\\Roaming\\npm";
  const out = await gettingStarted({ pathMissing: true, binDir: bin, appInstalled: true, platform: "win32" });
  assert.ok(out.includes(`[Environment]::SetEnvironmentVariable('Path', [Environment]::GetEnvironmentVariable('Path', 'User') + ';${bin}', 'User')`), out);
  assert.match(out, /open a new terminal/);
  assert.ok(out.includes(`& "${bin}\\plan2code.cmd"`), out);
  assert.match(out, /opens the Plan2Code app/);
});

test("pathFixLine: bash and other shells get ~/.bashrc, a folder under home is written with $HOME", () => {
  const fix = installer.pathFixLine("/home/me/.local/bin", { platform: "linux", shell: "/bin/bash", home: "/home/me" });
  assert.equal(fix.file, "~/.bashrc");
  assert.equal(fix.line, `echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc`);
  assert.equal(installer.pathFixLine("/home/me/.local/bin", { platform: "darwin", shell: "/bin/zsh", home: "/home/me" }).file, "~/.zshrc");
  assert.equal(installer.pathFixLine("/opt/bin", { platform: "linux", shell: "/bin/bash", home: "/home/me" }).line, `echo 'export PATH="/opt/bin:$PATH"' >> ~/.bashrc`);
});

test("next steps: with no agent found, plan2code's setup page is the lead and custom agents go to User Preferences", async () => {
  const builtins = [{ name: "Claude Code", installUrl: "https://example.test/claude", install: { linux: [{ run: "curl -fsSL https://example.test/install.sh | bash" }] } }];
  const out = await gettingStarted({ agents: { found: [], builtins }, platform: "linux" });
  assert.match(out, /No agent yet\? Just run plan2code: its setup page installs one with you\./);
  assert.ok(out.includes("curl -fsSL https://example.test/install.sh | bash (https://example.test/claude)"), out);
  assert.match(out, /User Preferences, Agents & models/);
  assert.doesNotMatch(out, /NO AI AGENT FOUND|agents\.json/);
});

test("detectAgents: reads the shipped list and lookup, and finds a custom agent by its command", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-agents-"));
  try {
    const userFile = path.join(dir, "user-agents.json");
    fs.writeFileSync(userFile, JSON.stringify({ schema: 1, agents: [{ id: "mine", name: "Mine", command: process.execPath }] }));
    const nowhere = { path: "", savedPath: "", npmBin: "", home: dir, vars: {} };
    const result = await installer.detectAgents({ binDir: dir, userAgentsFile: userFile, env: nowhere });
    assert.ok(result.builtins.some((entry) => entry.id === "claude"), "falls back to src/ when nothing is installed");
    assert.deepEqual(result.found, ["Mine"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("desktopAppState: installed, failed, or skipped when declined, not offered or not built yet", () => {
  assert.equal(installer.desktopAppState({ app: true }), "installed");
  assert.equal(installer.desktopAppState({ app: false }), "failed");
  assert.equal(installer.desktopAppState({ app: false, appMissing: "no file yet" }), "skipped");
  assert.equal(installer.desktopAppState({}), "skipped");
});

test("launcher shim: a plan2code without the launcher marker is saved as .bak, ours is replaced in place", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-shim-"));
  const foreign = "#!/bin/sh\necho another tool\n";
  try {
    const file = path.join(dir, "plan2code");
    const shim = { file, content: `#!/bin/sh\n# ${installer.LAUNCHER_MARKER}\nexit 0\n` };
    fs.writeFileSync(file, foreign);
    assert.equal(installer.isOurLauncherShim(file), false);
    assert.deepEqual(installer.writeLauncherShim(shim), { backup: `${file}.bak` });
    assert.equal(fs.readFileSync(`${file}.bak`, "utf8"), foreign);
    assert.equal(installer.isOurLauncherShim(file), true);
    assert.deepEqual(installer.writeLauncherShim(shim), { backup: null }, "our own shim is never backed up");
    assert.equal(fs.readFileSync(`${file}.bak`, "utf8"), foreign);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("install.js: with no terminal the menu is not shown; it says how to install and exits 1", () => {
  const r = spawnSync(process.execPath, [INSTALL], { encoding: "utf8", input: "", env: { ...process.env, HOME, USERPROFILE: HOME } });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.equal(r.stdout.trim(), installer.NO_TERMINAL_MESSAGE);
  assert.equal(installer.NO_TERMINAL_MESSAGE, "Run this in a terminal, or use `--update` for an unattended install.");
});

test("install.js: piped output carries no escape codes and no boxes", () => {
  const code = `require(${JSON.stringify(INSTALL)}).printGettingStarted({ commandInstalled: true, agents: { found: [], builtins: [] } })`;
  const piped = spawnSync(process.execPath, ["-e", code], { encoding: "utf8", env: { ...process.env, HOME, USERPROFILE: HOME } });
  assert.equal(piped.status, 0, piped.stderr);
  assert.match(piped.stdout, /How to use Plan2Code/);
  assert.doesNotMatch(piped.stdout, /\x1b\[|╭|╰/);
});

test("createSpinner: piped, it prints its label once as a plain line and draws nothing", () => {
  const writes = [];
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  try {
    const spinner = installer.createSpinner("Running skills add...", { stream: { isTTY: false, write: (s) => writes.push(s) } }).start();
    spinner.stop();
  } finally {
    console.log = log;
  }
  assert.deepEqual(lines, ["  Running skills add..."]);
  assert.deepEqual(writes, []);
});

test("createSpinner: on a terminal it redraws one line with the seconds and clears it on stop", () => {
  const writes = [];
  const spinner = installer.createSpinner("Running skills add...", { stream: { isTTY: true, write: (s) => writes.push(s) } }).start();
  spinner.stop();
  assert.match(writes[0], /^\r {2}\S+ Running skills add\.\.\. 0s/);
  assert.equal(writes.at(-1), "\r\x1b[K");
});

test("detectAgents: an agent only in npm's folder or an install folder off PATH is not present, as the launcher sees it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-agents-off-"));
  try {
    for (const name of ["claude", "claude.cmd"]) fs.writeFileSync(path.join(dir, name), "");
    if (process.platform !== "win32") fs.chmodSync(path.join(dir, "claude"), 0o755);
    const none = path.join(dir, "none.json");
    const off = { path: "", savedPath: "", npmBin: dir, home: dir, pathext: ".CMD", vars: {} };
    assert.deepEqual((await installer.detectAgents({ binDir: dir, userAgentsFile: none, env: off })).found, []);
    const on = { ...off, npmBin: "", path: dir };
    assert.deepEqual((await installer.detectAgents({ binDir: dir, userAgentsFile: none, env: on })).found, ["Claude Code"]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("detectAgents: a custom agents file with the wrong schema is ignored, as the launcher ignores it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-agents-schema-"));
  try {
    const userFile = path.join(dir, "user-agents.json");
    fs.writeFileSync(userFile, JSON.stringify({ schema: 99, agents: [{ id: "mine", name: "Mine", command: process.execPath }] }));
    const nowhere = { path: "", savedPath: "", npmBin: "", home: dir, vars: {} };
    assert.deepEqual((await installer.detectAgents({ binDir: dir, userAgentsFile: userFile, env: nowhere })).found, []);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("next steps: without the plan2code command, no line tells the person to run it", async () => {
  const { out } = await captured(() => installer.printGettingStarted({ commandInstalled: false, agents: { found: [], builtins: [] }, platform: "linux" }));
  assert.doesNotMatch(out, /run plan2code|Just run plan2code/);
  assert.match(out, /type \/plan2code/);
});

// ---------------------------------------------------------------------------------------------
// Uninstall: works without the skills CLI, prints only what was installed, removes the console,
// lists what stays, and always ends with the Removed / Could not remove / To finish block.
// Everything runs against the temp HOME above; the steps that would reach the real machine (the
// npm global bin, the desktop folder) are replaced.
// ---------------------------------------------------------------------------------------------

const CLAUDE_DIR = path.join(HOME, ".claude");
const SKILL_STORE = path.join(HOME, ".agents", "skills");

/** The legacy sweep reads %APPDATA% and %LOCALAPPDATA% on Windows: point them into the temp HOME while `fn` runs. */
function withAppData(fn) {
  const saved = { APPDATA: process.env.APPDATA, LOCALAPPDATA: process.env.LOCALAPPDATA };
  process.env.APPDATA = path.join(HOME, "AppData", "Roaming");
  process.env.LOCALAPPDATA = path.join(HOME, "AppData", "Local");
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function makeSkill(name) {
  fs.mkdirSync(path.join(SKILL_STORE, name), { recursive: true });
  fs.writeFileSync(path.join(SKILL_STORE, name, "SKILL.md"), "---\nname: x\n---\n");
}

test("uninstall without the skills CLI: the plan2code skill folders go directly, others stay, and the block says links may remain", () => {
  fs.rmSync(SKILL_STORE, { recursive: true, force: true });
  for (const name of ["plan2code", "plan2code-plan", "plan2code-3-implement", "someone-elses-skill"]) makeSkill(name);
  const report = installer.newUninstallReport();
  const result = withAppData(() => installer.uninstallSkillsPiece(report, { cli: { ensure: () => false, remove: () => assert.fail("the CLI is unreachable") } }));
  assert.equal(result.removed, 3);
  assert.deepEqual(result.failed, []);
  assert.deepEqual(fs.readdirSync(SKILL_STORE), ["someone-elses-skill"]);
  assert.equal(report.finish.length, 1);
  assert.match(report.finish[0], /could not be reached/);
  assert.match(report.finish[0], /may remain/);
  assert.deepEqual(installer.removeSkillsDirectly(SKILL_STORE), { removed: [], failed: [] }, "nothing left to remove, no error");
});

test("uninstall with the skills CLI: it does the removing and no folder is touched by hand", () => {
  fs.rmSync(SKILL_STORE, { recursive: true, force: true });
  makeSkill("plan2code");
  const calls = [];
  const report = installer.newUninstallReport();
  const result = withAppData(() =>
    installer.uninstallSkillsPiece(report, {
      cli: { ensure: () => true, remove: (scope, options) => (calls.push([scope, options.quiet]), 1) },
    })
  );
  assert.deepEqual(calls, [["global", true]]);
  assert.equal(result.removed, 1);
  assert.deepEqual(report.finish, [], "nothing is left to do");
  assert.ok(fs.existsSync(path.join(SKILL_STORE, "plan2code")), "the stand-in CLI removed nothing, and nothing else did");
  fs.rmSync(SKILL_STORE, { recursive: true, force: true });
});

/** uninstallAll() with every step replaced by one that records itself; `results` says what each reports. */
function uninstallWith({ pieces, results = {}, probes = {} }) {
  if (pieces) writeRecord(pieces);
  else clearRecord();
  const ran = [];
  const steps = {};
  for (const piece of installer.INSTALL_PIECES) {
    steps[piece] = () => (ran.push(piece), results[piece] || { removed: 1, failed: [] });
  }
  const report = installer.newUninstallReport();
  const lines = [];
  const log = console.log;
  console.log = (...args) => lines.push(args.join(" "));
  let code;
  try {
    code = installer.uninstallAll({ report, steps, probes, removeConsole: () => {} });
  } finally {
    console.log = log;
  }
  return { code, ran, report, out: lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "") };
}

const NO_STRAYS = { skills: () => false, launcher: () => false, app: () => false, statusline: () => false };

test("uninstall: only the recorded pieces are removed and named, never ones that were not installed", () => {
  const r = uninstallWith({ pieces: ["skills", "launcher"], probes: NO_STRAYS, results: { skills: { removed: 23, failed: [], detail: "23" } } });
  assert.equal(r.code, 0, r.out);
  assert.deepEqual(r.ran, ["skills", "launcher"]);
  assert.match(r.out, /Removed Skills \(23\)/);
  assert.match(r.out, /Removed plan2code command/);
  assert.doesNotMatch(r.out, /Status line|Metrics|Bot|Desktop app|UNINSTALL|plan2code-metrics|plan2code-bot/);
  assert.deepEqual(r.report.removed, ["Skills (23)", "plan2code command"]);
});

test("uninstall: a piece missing from the record but found on disk is removed, and a piece found nowhere is not run", () => {
  const r = uninstallWith({ pieces: null, probes: { ...NO_STRAYS, statusline: () => true } });
  assert.deepEqual(r.ran, ["statusline"]);
  assert.match(r.out, /Removed Status line/);
});

test("uninstall: the real probes look at the temp HOME and find nothing there", () => {
  fs.rmSync(path.join(CLAUDE_DIR, "plan2code-statusline.js"), { force: true });
  fs.rmSync(SKILL_STORE, { recursive: true, force: true });
  fs.rmSync(installer.APP_DEST, { force: true });
  assert.equal(installer.UNINSTALL_PROBES.skills(), false);
  assert.equal(installer.UNINSTALL_PROBES.app(), false);
  assert.equal(installer.UNINSTALL_PROBES.statusline(), false);
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CLAUDE_DIR, "plan2code-statusline.js"), "// ours");
  assert.equal(installer.UNINSTALL_PROBES.statusline(), true);
  fs.rmSync(path.join(CLAUDE_DIR, "plan2code-statusline.js"), { force: true });
});

test("uninstall: the status line says it kept statusline-config.json only when that file exists", async () => {
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.rmSync(path.join(CLAUDE_DIR, "statusline-config.json"), { force: true });
  const quiet = (await captured(() => installer.uninstallStatusLine())).out;
  assert.doesNotMatch(quiet, /Preserved: statusline-config\.json/);
  fs.writeFileSync(path.join(CLAUDE_DIR, "statusline-config.json"), "{}");
  const kept = (await captured(() => installer.uninstallStatusLine())).out;
  assert.match(kept, /Preserved: statusline-config\.json/);
  fs.rmSync(path.join(CLAUDE_DIR, "statusline-config.json"), { force: true });
});

test("uninstall: a piece that fails is named, makes the exit code 1, and the others still run", () => {
  const r = uninstallWith({ pieces: ["skills", "launcher", "app"], probes: NO_STRAYS, results: { launcher: { removed: 0, failed: ["EBUSY: file in use"] } } });
  assert.equal(r.code, 1, r.out);
  assert.deepEqual(r.ran, ["skills", "launcher", "app"]);
  assert.deepEqual(r.report.failed, ["plan2code command: EBUSY: file in use"]);
  assert.match(r.out, /plan2code command: EBUSY: file in use/);
});

test("uninstall: the console's version folders and pointer are removed, a running console is stopped first, and sessions stay", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-console-home-"));
  process.env.PLAN2CODE_CONSOLE_HOME = home;
  try {
    for (const version of ["3.0.2", "3.1.0"]) {
      fs.mkdirSync(path.join(home, version, "public"), { recursive: true });
      fs.writeFileSync(path.join(home, version, "console.mjs"), "// console");
    }
    fs.writeFileSync(path.join(home, "console-dir"), path.join(home, "3.1.0"));
    fs.mkdirSync(path.join(home, "sessions", "s1"), { recursive: true });
    fs.writeFileSync(path.join(home, "looks.json"), "{}");
    const stopped = [];
    const report = installer.newUninstallReport();
    const lines = [];
    const log = console.log;
    console.log = (...args) => lines.push(args.join(" "));
    try {
      installer.removeConsoleFolders(report, { stop: (dir) => (stopped.push(dir), 1) });
    } finally {
      console.log = log;
    }
    const out = lines.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    assert.deepEqual(stopped, [home]);
    assert.match(out, /Stopped 1 running Plan2Code console first/);
    assert.deepEqual(fs.readdirSync(home).sort(), ["looks.json", "sessions"]);
    assert.deepEqual(report.removed, ["Console files"]);
    assert.deepEqual(report.failed, []);
  } finally {
    delete process.env.PLAN2CODE_CONSOLE_HOME;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test("uninstall: a console folder that cannot be removed is reported with what to do, and a missing console home is fine", () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-console-busy-"));
  process.env.PLAN2CODE_CONSOLE_HOME = home;
  const realRm = fs.rmSync;
  try {
    fs.mkdirSync(path.join(home, "3.0.2"), { recursive: true });
    fs.mkdirSync(path.join(home, "3.1.0"), { recursive: true });
    fs.rmSync = (target, options) => {
      if (String(target).endsWith("3.0.2")) throw new Error("EBUSY: resource busy");
      return realRm(target, options);
    };
    const report = installer.newUninstallReport();
    const log = console.log;
    console.log = () => {};
    try {
      installer.removeConsoleFolders(report, { stop: () => 0 });
    } finally {
      console.log = log;
      fs.rmSync = realRm;
    }
    assert.deepEqual(report.failed, ["Console files 3.0.2: EBUSY: resource busy"]);
    assert.deepEqual(report.finish, ["Close any open Plan2Code console or app, then run plan2code uninstall again."]);
    assert.deepEqual(report.removed, ["Console files"]);
    assert.ok(fs.existsSync(path.join(home, "3.0.2")) && !fs.existsSync(path.join(home, "3.1.0")));
    process.env.PLAN2CODE_CONSOLE_HOME = path.join(home, "nowhere");
    assert.doesNotThrow(() => installer.removeConsoleFolders(installer.newUninstallReport(), { stop: () => 0 }));
  } finally {
    fs.rmSync = realRm;
    delete process.env.PLAN2CODE_CONSOLE_HOME;
    realRm(home, { recursive: true, force: true });
  }
});

test("uninstall: what stays in the data folder is listed by name with its size, and the closing block always prints", async () => {
  const data = path.join(HOME, ".plan2code");
  fs.rmSync(path.join(data, "notepads"), { recursive: true, force: true });
  fs.mkdirSync(path.join(data, "notepads"), { recursive: true });
  fs.writeFileSync(path.join(data, "notepads", "a.json"), "x".repeat(2048));
  fs.mkdirSync(path.join(data, "handoffs"), { recursive: true });
  const listed = installer.listKeptData(data);
  const notebooks = listed.find((item) => item.name === "notepads");
  assert.equal(notebooks.label, "Notebooks");
  assert.equal(notebooks.bytes, 2048);
  assert.ok(listed.some((item) => item.name === "handoffs" && item.label === "Handoffs"));

  const kept = await runUninstall({ yes: true });
  assert.equal(kept.code, 0);
  assert.match(kept.out, /Your data in .* was kept/);
  assert.match(kept.out, /Notebooks: 2 KB/);
  assert.match(kept.out, /Removed: nothing/);
  assert.match(kept.out, /Could not remove: nothing/);
  assert.match(kept.out, /To finish: nothing, you are done/);
  assert.match(kept.out, /Plan2Code is uninstalled/);

  // A failed run still ends on the block, says that something failed, and leaves no cheerful closing line.
  const failed = await runUninstall({ yes: true, remove: () => 1 });
  assert.equal(failed.code, 1);
  assert.match(failed.out, /Removed: nothing/);
  assert.match(failed.out, /Could not remove:\n\s+✗ One or more pieces/);
  assert.match(failed.out, /To finish:/);
  assert.doesNotMatch(failed.out, /Plan2Code is uninstalled/);

  // With the data deleted there is nothing to list, and the block names the data as removed.
  const purged = await runUninstall({ yes: true, purge: true });
  assert.doesNotMatch(purged.out, /Notebooks:/);
  assert.match(purged.out, /Removed: Your Plan2Code data/);
  fs.rmSync(path.join(data, "notepads"), { recursive: true, force: true });
  fs.rmSync(path.join(data, "handoffs"), { recursive: true, force: true });
});
