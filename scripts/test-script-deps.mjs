// Tests for plan2code-deps's scripts/deps.mjs: the command dispatch, the run
// folder, version math, the manifest reader and one-string edits, the label
// rules and the batch planner. See skill-script-helpers.mjs for how these run.
// The pure pieces are imported from the built script and fed fixture manifests
// and records under scripts/fixtures/deps/. The commands that run tools (detect,
// scan, apply, restore, notes) run against stub npm, pnpm, yarn, cargo, pip, uv, go, dotnet (and their plugins) and git in a temp
// folder used as the whole PATH, replaying recorded tool output, so the suite
// passes on a machine with none of the tools installed.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ROOT, SKILLS, NOW, runScript, tmp, write, fixtureCleanup } from "./skill-script-helpers.mjs";

after(fixtureCleanup);

// The script runs from the built skill, beside the shared scripts it imports
// (skill-script-helpers.mjs rebuilds skills/ when this file loads it).
const SCRIPT = path.join(SKILLS, "plan2code-deps", "scripts", "deps.mjs");

const deps = await import(pathToFileURL(SCRIPT).href);
const FIXTURES = path.join(ROOT, "scripts", "fixtures", "deps");
const MANIFESTS = path.join(FIXTURES, "manifests");
const readJson = (...p) => JSON.parse(fs.readFileSync(path.join(FIXTURES, ...p), "utf8"));

const runDeps = (args, opts) => runScript("plan2code-deps", "deps.mjs", args, opts);

const made = [];
after(() => {
  for (const dir of made) fs.rmSync(dir, { recursive: true, force: true });
});

/** A run folder as detect will make one (named plan2code-deps-...), with files in it. */
function runFolder(files = {}) {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), "plan2code-deps-test-"));
  made.push(dir);
  for (const [name, value] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  return dir;
}

/** A manifest fixture copied into a temp folder (edits never touch the fixture). */
function copyManifest(rel, { crlf = false } = {}) {
  const dir = tmp("deps-manifest");
  const dest = path.join(dir, path.basename(rel));
  let text = fs.readFileSync(path.join(MANIFESTS, rel), "utf8");
  if (crlf) text = text.replace(/\r?\n/g, "\r\n");
  fs.writeFileSync(dest, text);
  return dest;
}

/* -------------------------------------------------------------- dispatch */

test("deps --help names every command and every exit code", () => {
  const r = runDeps(["--help"]);
  assert.equal(r.code, 0, r.stderr);
  for (const command of ["detect", "scan", "notes", "label", "batches", "backup", "apply", "restore", "handoff", "cleanup"]) {
    assert.match(r.stdout, new RegExp(`deps\\.mjs ${command}\\b`), command);
  }
  for (const exit of ["0 ok", "1 crash", "2 bad arguments", "3 not found", "4 invalid", "5 refused"]) assert.ok(r.stdout.includes(exit), exit);
});

test("deps: an unknown command and a missing one exit 2 naming the commands", () => {
  const unknown = runDeps(["sweep"]);
  assert.equal(unknown.code, 2);
  assert.equal(unknown.json.error, "unknown-command");
  for (const command of ["detect", "label", "batches", "cleanup"]) assert.match(unknown.json.next, new RegExp(command));
  const missing = runDeps([]);
  assert.equal(missing.code, 2);
  assert.equal(missing.json.error, "missing-command");
  assert.match(missing.json.next, /handoff/);
});

test("deps: an unknown flag exits 2", () => {
  const r = runDeps(["cleanup", "--nope", "x"]);
  assert.equal(r.code, 2);
  assert.equal(r.json.error, "unknown-flag");
});

test("deps: notes and handoff need a run folder and their row ids", () => {
  for (const command of ["notes", "handoff"]) {
    const r = runDeps([command]);
    assert.equal(r.code, 2, command);
    assert.equal(r.json.error, "missing-run", command);
  }
  const dir = runFolder({ "scan.json": { lockfiles: [] } });
  assert.equal(runDeps(["notes", "--run", dir]).json.error, "missing-id");
  assert.equal(runDeps(["handoff", "--run", dir]).json.error, "missing-ids");
});

/* ------------------------------------------------------------ run folder */

test("newRun makes a plan2code-deps-<date>-<random> folder under temp; readRun and writeRun round-trip", () => {
  const dir = deps.newRun();
  made.push(dir);
  assert.ok(fs.statSync(dir).isDirectory());
  assert.equal(path.dirname(dir), os.tmpdir());
  assert.match(path.basename(dir), /^plan2code-deps-\d{8}-[0-9a-f]{8}$/);
  assert.equal(deps.readRun(dir, "scan.json"), null);
  deps.writeRun(dir, "scan.json", { rows: [1, 2] });
  assert.deepEqual(deps.readRun(dir, "scan.json"), { rows: [1, 2] });
  const second = deps.newRun();
  made.push(second);
  assert.notEqual(second, dir, "each run gets its own folder");
});

test("cleanup removes a run folder", () => {
  const dir = runFolder({ "scan.json": {} });
  const r = runDeps(["cleanup", "--run", dir]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.removed, dir.split(path.sep).join("/"));
  assert.equal(fs.existsSync(dir), false);
});

test("cleanup refuses a folder that is not a deps run, and a run that is not there", () => {
  const foreign = tmp("deps-foreign");
  fs.writeFileSync(path.join(foreign, "keep.txt"), "x");
  const r = runDeps(["cleanup", "--run", foreign]);
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "not-a-run");
  assert.ok(fs.existsSync(path.join(foreign, "keep.txt")), "the foreign folder is untouched");

  const gone = path.join(os.tmpdir(), "plan2code-deps-19990101-deadbeef");
  const missing = runDeps(["cleanup", "--run", gone]);
  assert.equal(missing.code, 3);
  assert.equal(missing.json.error, "run-missing");

  const lookalike = path.join(tmp("deps-project"), "src", "plan2code-deps-scripts");
  fs.mkdirSync(lookalike, { recursive: true });
  fs.writeFileSync(path.join(lookalike, "deps.mjs"), "// source");
  const outside = runDeps(["cleanup", "--run", lookalike]);
  assert.equal(outside.code, 3, "a plan2code-deps- folder outside the temp folder is not a run");
  assert.equal(outside.json.error, "not-a-run");
  assert.ok(fs.existsSync(path.join(lookalike, "deps.mjs")), "and it is left in place");

  const none = runDeps(["cleanup"]);
  assert.equal(none.code, 2);
  assert.equal(none.json.error, "missing-run");
});

/* ---------------------------------------------------------- version math */

test("compareVersions: semver precedence with prereleases and build metadata", () => {
  const c = (a, b) => deps.compareVersions("npm", a, b);
  assert.equal(c("1.2.3", "1.2.3"), 0);
  assert.equal(c("1.2.3", "1.2.10"), -1);
  assert.equal(c("2.0.0", "1.99.99"), 1);
  assert.equal(c("1.0.0-alpha", "1.0.0"), -1);
  assert.equal(c("1.0.0-alpha", "1.0.0-alpha.1"), -1);
  assert.equal(c("1.0.0-alpha.1", "1.0.0-alpha.beta"), -1);
  assert.equal(c("1.0.0-beta.2", "1.0.0-beta.11"), -1);
  assert.equal(c("1.0.0-rc.1", "1.0.0-beta.11"), 1);
  assert.equal(c("1.0.0+build.1", "1.0.0+build.2"), 0, "build metadata is ignored");
  assert.equal(deps.compareVersions("cargo", "0.8.2", "0.8.23"), -1);
});

test("compareVersions: Go drops a leading v and +incompatible, NuGet takes four parts", () => {
  assert.equal(deps.compareVersions("go", "v1.2.3", "1.2.3"), 0);
  assert.equal(deps.compareVersions("go", "v2.0.0+incompatible", "v2.0.1"), -1);
  assert.equal(deps.compareVersions("go", "v0.0.0-20240101000000-abcdef123456", "v0.0.1"), -1);
  assert.equal(deps.compareVersions("nuget", "1.2.3.4", "1.2.3"), 1);
  assert.equal(deps.compareVersions("nuget", "1.2", "1.2.0"), 0);
  assert.equal(deps.compareVersions("nuget", "13.0.1", "13.0.3"), -1);
  assert.equal(deps.compareVersions("npm", "1.2.3.4", "1.2.3"), null, "four parts are NuGet only");
});

test("compareVersions: the PEP 440 subset orders epoch, dev, pre, release and post", () => {
  const c = (a, b) => deps.compareVersions("python", a, b);
  assert.equal(c("1.0.dev1", "1.0a1"), -1, "a dev-only release sorts before its pre-releases");
  assert.equal(c("1.0a1", "1.0b1"), -1);
  assert.equal(c("1.0b2", "1.0rc1"), -1);
  assert.equal(c("1.0rc1", "1.0"), -1);
  assert.equal(c("1.0", "1.0.post1"), -1);
  assert.equal(c("1.0.post1.dev1", "1.0.post1"), -1);
  assert.equal(c("1.0", "1.0.0"), 0, "trailing zeros do not count");
  assert.equal(c("1!0.1", "2.0"), 1, "the epoch wins");
  assert.equal(c("1.0-alpha1", "1.0a1"), 0, "alternate spellings normalize");
  assert.equal(c("2.31.0+local.1", "2.31.0"), 0, "a local label is ignored");
});

test("parseVersion and compareVersions return null on unreadable input and never throw", () => {
  for (const eco of ["npm", "cargo", "go", "nuget", "python"]) {
    for (const bad of ["", "latest", "1.2.x", "^1.2.3", null, undefined, 42]) {
      assert.equal(deps.parseVersion(eco, bad), null, `${eco} ${bad}`);
    }
  }
  assert.equal(deps.parseVersion("maven", "1.2.3"), null);
  assert.equal(deps.compareVersions("npm", "1.2.3", "nope"), null);
});

test("jumpOf: patch, minor, major, and 0.x for moves under 1.0", () => {
  assert.equal(deps.jumpOf("npm", "1.2.3", "1.2.9"), "patch");
  assert.equal(deps.jumpOf("npm", "1.2.3", "1.3.0"), "minor");
  assert.equal(deps.jumpOf("npm", "9.6.1", "10.2.1"), "major");
  assert.equal(deps.jumpOf("npm", "0.8.2", "0.9.0"), "0.x");
  assert.equal(deps.jumpOf("npm", "0.0.3", "0.0.4"), "0.x");
  assert.equal(deps.jumpOf("cargo", "0.8.2", "0.8.23"), "patch");
  assert.equal(deps.jumpOf("cargo", "0.9.1", "1.0.0"), "major");
  assert.equal(deps.jumpOf("npm", "1.0.0-beta.1", "1.0.0"), "patch");
  assert.equal(deps.jumpOf("go", "v1.8.0", "v1.9.0"), "minor");
  assert.equal(deps.jumpOf("nuget", "13.0.1.0", "13.0.1.5"), "patch");
  assert.equal(deps.jumpOf("python", "2.31.0", "2.32.3"), "minor");
  assert.equal(deps.jumpOf("python", "0.13.7", "0.14.0"), "0.x");
  assert.equal(deps.jumpOf("npm", "1.2.3", "bogus"), null);
});

test("inRange: npm caret, tilde, exact, comparator pairs, x wildcards, * and ||", () => {
  const r = (range, v) => deps.inRange("npm", range, v);
  assert.equal(r("^1.2.3", "1.9.0"), true);
  assert.equal(r("^1.2.3", "2.0.0"), false);
  assert.equal(r("^1.2.3", "1.2.2"), false);
  assert.equal(r("^0.2.3", "0.2.9"), true);
  assert.equal(r("^0.2.3", "0.3.0"), false, "a 0.x caret holds the minor");
  assert.equal(r("^0.0.3", "0.0.4"), false);
  assert.equal(r("^1.2", "1.9.9"), true);
  assert.equal(r("~1.2.3", "1.2.9"), true);
  assert.equal(r("~1.2.3", "1.3.0"), false);
  assert.equal(r("~1", "1.9.0"), true);
  assert.equal(r("1.2.3", "1.2.3"), true);
  assert.equal(r("1.2.3", "1.2.4"), false);
  assert.equal(r("=1.2.3", "1.2.3"), true);
  assert.equal(r(">=2 <4", "3.5.0"), true);
  assert.equal(r(">=2 <4", "4.0.0"), false);
  assert.equal(r(">= 2.1.0 < 3", "2.5.0"), true);
  assert.equal(r("1.x", "1.4.0"), true);
  assert.equal(r("1.2.x", "1.3.0"), false);
  assert.equal(r("*", "9.9.9"), true);
  assert.equal(r("", "9.9.9"), true);
  assert.equal(r("^1.0.0 || ^2.0.0", "2.5.0"), true);
  assert.equal(r("1.0.0 - 2.0.0", "2.0.0"), true);
  assert.equal(r("^1.2.3", "1.3.0-beta.1"), false, "a prerelease needs a prerelease comparator on its version");
  assert.equal(r("^1.3.0-beta.1", "1.3.0-beta.2"), true);
  assert.equal(r("latest", "1.0.0"), null);
  assert.equal(r("^1.2.3", "nope"), null);
});

test("inRange: Cargo's default caret and =, PEP 440, NuGet bare and brackets, Go", () => {
  assert.equal(deps.inRange("cargo", "1.2", "1.9.9"), true);
  assert.equal(deps.inRange("cargo", "1.2.3", "2.0.0"), false);
  assert.equal(deps.inRange("cargo", "0.8.2", "0.8.23"), true);
  assert.equal(deps.inRange("cargo", "0.8.2", "0.9.0"), false);
  assert.equal(deps.inRange("cargo", "=1.2.3", "1.2.4"), false);
  assert.equal(deps.inRange("cargo", ">=1.2, <1.5", "1.4.0"), true);
  assert.equal(deps.inRange("cargo", "1.2.*", "1.2.9"), true, "a Cargo wildcard is an x-range");
  assert.equal(deps.inRange("cargo", "1.2.*", "1.5.0"), false);
  assert.equal(deps.inRange("cargo", "1.*", "1.9.0"), true);
  assert.equal(deps.inRange("cargo", "1.*", "2.0.0"), false);
  assert.equal(deps.inRange("cargo", "*", "9.0.0"), true);

  assert.equal(deps.inRange("python", "==1.2.3", "1.2.3"), true);
  assert.equal(deps.inRange("python", "==1.2.*", "1.2.9"), true);
  assert.equal(deps.inRange("python", "~=1.4.2", "1.4.9"), true);
  assert.equal(deps.inRange("python", "~=1.4.2", "1.5.0"), false);
  assert.equal(deps.inRange("python", "~=1.4", "1.9"), true);
  assert.equal(deps.inRange("python", ">=1.0,<2.0", "1.5"), true);
  assert.equal(deps.inRange("python", ">=1.0,<2.0", "2.0"), false);
  assert.equal(deps.inRange("python", ">=1.0,!=1.5", "1.5"), false);
  assert.equal(deps.inRange("python", "requests", "1.0"), null);

  assert.equal(deps.inRange("nuget", "13.0.1", "13.0.3"), true, "a bare NuGet version is a minimum");
  assert.equal(deps.inRange("nuget", "13.0.1", "12.0.0"), false);
  assert.equal(deps.inRange("nuget", "[1.0,2.0)", "1.9"), true);
  assert.equal(deps.inRange("nuget", "[1.0,2.0)", "2.0"), false);
  assert.equal(deps.inRange("nuget", "[1.0,2.0]", "2.0"), true);
  assert.equal(deps.inRange("nuget", "(1.0,)", "1.0"), false);
  assert.equal(deps.inRange("nuget", "(,1.0]", "0.5"), true);
  assert.equal(deps.inRange("nuget", "[1.2.3]", "1.2.3"), true);
  assert.equal(deps.inRange("nuget", "[1.2.3]", "1.2.4"), false);

  assert.equal(deps.inRange("go", "v1.8.0", "v1.8.0"), true);
  assert.equal(deps.inRange("go", "v1.8.0", "v1.9.0"), false);
});

test("raiseRange keeps the operator style and the range's precision", () => {
  const raise = (eco, range, target) => deps.raiseRange(eco, range, target);
  assert.deepEqual(raise("npm", "^9.6.1", "10.2.1"), { rewritten: true, from: "^9.6.1", to: "^10.2.1" });
  assert.deepEqual(raise("npm", "~1.2.3", "1.4.0"), { rewritten: true, from: "~1.2.3", to: "~1.4.0" });
  assert.deepEqual(raise("npm", "1.64.1", "1.66.0"), { rewritten: true, from: "1.64.1", to: "1.66.0" }, "an exact pin stays exact");
  assert.deepEqual(raise("npm", "=1.2.3", "2.0.0"), { rewritten: true, from: "=1.2.3", to: "=2.0.0" });
  assert.deepEqual(raise("npm", "^1.2", "2.3.4"), { rewritten: true, from: "^1.2", to: "^2.3" });
  assert.deepEqual(raise("cargo", "1.2", "2.0.5"), { rewritten: true, from: "1.2", to: "2.0" });
  assert.deepEqual(raise("cargo", "=0.8.2", "0.9.1"), { rewritten: true, from: "=0.8.2", to: "=0.9.1" });
  assert.deepEqual(raise("python", ">=1.2", "2.0.1"), { rewritten: true, from: ">=1.2", to: ">=2.0" });
  assert.deepEqual(raise("python", "==13.7.1", "14.0.0"), { rewritten: true, from: "==13.7.1", to: "==14.0.0" });
  assert.deepEqual(raise("python", "~=1.4", "2.1.0"), { rewritten: true, from: "~=1.4", to: "~=2.1" });
  assert.deepEqual(raise("python", "==1.2", "2.0.1"), { rewritten: true, from: "==1.2", to: "==2.0.1" }, "== names one version, so it takes the whole target");
  assert.deepEqual(raise("nuget", "13.0", "13.0.3"), { rewritten: true, from: "13.0", to: "13.0.3" }, "a NuGet minimum takes the whole target");
  for (const [eco, range, target] of [["python", "==1.2", "2.0.1"], ["nuget", "13.0", "13.0.3"], ["cargo", "1.2", "2.0.5"], ["npm", "^1.2", "2.3.4"], ["python", ">=1.2", "2.0.1"]]) {
    assert.equal(deps.inRange(eco, raise(eco, range, target).to, target), true, `${eco} ${range} raised still holds ${target}`);
  }
  assert.deepEqual(raise("python", ">=1.2", "2.0rc1"), { rewritten: true, from: ">=1.2", to: ">=2.0rc1" }, "a prerelease target is kept whole");
  assert.deepEqual(raise("nuget", "13.0.1", "13.0.3"), { rewritten: true, from: "13.0.1", to: "13.0.3" });
  assert.deepEqual(raise("go", "v1.8.0", "v1.9.0"), { rewritten: true, from: "v1.8.0", to: "v1.9.0" });
  assert.deepEqual(raise("npm", "^1.0.0-beta.1", "2.0.0-rc.1"), { rewritten: true, from: "^1.0.0-beta.1", to: "^2.0.0-rc.1" });
});

test("raiseRange leaves hand-written ranges alone: fits, or range not rewritten", () => {
  const notRewritten = { rewritten: false, reason: "range not rewritten" };
  const fits = { rewritten: false, fits: true };
  assert.deepEqual(deps.raiseRange("npm", ">=2 <4", "3.1.0"), fits);
  assert.deepEqual(deps.raiseRange("npm", ">=2 <4", "4.0.0"), notRewritten);
  assert.deepEqual(deps.raiseRange("npm", "1.x", "1.5.0"), fits);
  assert.deepEqual(deps.raiseRange("npm", "1.x", "2.0.0"), notRewritten);
  assert.deepEqual(deps.raiseRange("npm", "*", "9.0.0"), fits);
  assert.deepEqual(deps.raiseRange("npm", "^1.0.0 || ^2.0.0", "3.0.0"), notRewritten);
  assert.deepEqual(deps.raiseRange("cargo", ">=1.2, <1.5", "1.6.0"), notRewritten);
  assert.deepEqual(deps.raiseRange("cargo", "1.2.*", "1.5.0"), notRewritten);
  assert.deepEqual(deps.raiseRange("cargo", "1.2.*", "1.2.7"), fits);
  assert.deepEqual(deps.raiseRange("python", ">=1.0,<2.0", "1.5"), fits);
  assert.deepEqual(deps.raiseRange("nuget", "[1.0,2.0)", "2.1"), notRewritten);
  assert.deepEqual(deps.raiseRange("npm", "latest", "2.0.0"), notRewritten, "an unreadable range is not rewritten");
  assert.deepEqual(deps.raiseRange("npm", "^1.0.0", "nope"), notRewritten);
});

/* ------------------------------------------------------------- manifests */

test("readKeys reads each runtime and hold key from its one line", () => {
  const at = (rel) => deps.readKeys(path.join(MANIFESTS, rel));
  assert.deepEqual(at("package.json"), { ecosystem: "npm", enginesNode: ">=18" });
  assert.deepEqual(at("pyproject.toml"), { ecosystem: "python", requiresPython: ">=3.9" }, "only [project] counts");
  assert.deepEqual(at("Cargo.toml"), { ecosystem: "cargo", rustVersion: "1.75", patch: ["crates-io", "https://github.com/example/repo"] });
  assert.deepEqual(at("workspace/Cargo.toml"), { ecosystem: "cargo", rustVersion: "1.80", patch: [] });
  assert.deepEqual(at("go.mod"), { ecosystem: "go", go: "1.22" });
  assert.deepEqual(at("App.csproj"), { ecosystem: "nuget", targetFramework: "net8.0", targetFrameworks: null });
  assert.deepEqual(at("multi/Lib.csproj"), { ecosystem: "nuget", targetFramework: null, targetFrameworks: ["net8.0", "net6.0"] });
});

test("readKeys reads a key spread over several lines, or not a plain string, as null", () => {
  const at = (rel) => deps.readKeys(path.join(MANIFESTS, rel));
  assert.deepEqual(at("multiline/pyproject.toml"), { ecosystem: "python", requiresPython: null });
  assert.deepEqual(at("multiline/Cargo.toml"), { ecosystem: "cargo", rustVersion: null, patch: [] });
  assert.deepEqual(at("multiline/App.csproj"), { ecosystem: "nuget", targetFramework: null, targetFrameworks: null });
  assert.equal(deps.readKeys(path.join(MANIFESTS, "nope.json")), null);
  const other = copyManifest("go.mod");
  const txt = path.join(path.dirname(other), "notes.txt");
  fs.writeFileSync(txt, "go 1.22\n");
  assert.equal(deps.readKeys(txt), null, "a file it does not know");
});

test("readKeys reads CRLF manifests the same", () => {
  assert.deepEqual(deps.readKeys(copyManifest("Cargo.toml", { crlf: true })), { ecosystem: "cargo", rustVersion: "1.75", patch: ["crates-io", "https://github.com/example/repo"] });
  assert.deepEqual(deps.readKeys(copyManifest("go.mod", { crlf: true })), { ecosystem: "go", go: "1.22" });
});

/** Assert file now equals before with exactly one `from` -> `to` at the place that follows `anchor`. */
function assertOneChange(file, before, anchor, from, to) {
  const at = before.indexOf(from, before.indexOf(anchor) + anchor.length);
  const expected = before.slice(0, at) + to + before.slice(at + from.length);
  assert.equal(fs.readFileSync(file, "utf8"), expected);
}

test("editVersion changes only the one literal, in every manifest kind", () => {
  const cases = [
    ["package.json", { name: "chalk", from: "^5.6.2", to: "^6.0.1" }, '"chalk"'],
    ["pyproject.toml", { name: "requests", from: "2.31.0", to: "2.32.3" }, '"requests'],
    ["Cargo.toml", { name: "toml", from: "0.8.2", to: "0.8.23" }, "toml ="],
    ["Cargo.toml", { name: "serde", from: "1.0.200", to: "1.0.215" }, "serde ="],
    ["go.mod", { name: "github.com/spf13/cobra", from: "v1.8.0", to: "v1.9.1" }, "cobra"],
    ["App.csproj", { name: "Serilog", from: "3.1.1", to: "4.0.0" }, '"Serilog"'],
  ];
  for (const [rel, edit, anchor] of cases) {
    const file = copyManifest(rel);
    const before = fs.readFileSync(file, "utf8");
    const r = deps.editVersion(file, edit);
    assert.equal(r.ok, true, `${rel} ${edit.name}: ${r.reason}`);
    assert.equal(r.from, edit.from);
    assert.equal(r.to, edit.to);
    assertOneChange(file, before, anchor, edit.from, edit.to);
  }
});

test("editVersion matches the package name whole: chalk never edits chalk-template", () => {
  const file = copyManifest("package.json");
  const r = deps.editVersion(file, { name: "chalk", from: "^5.6.2", to: "^6.0.1" });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.line, 6);
  const text = fs.readFileSync(file, "utf8");
  assert.match(text, /"chalk": "\^6\.0\.1"/);
  assert.match(text, /"chalk-template": "\^5\.6\.2"/);
});

test("editVersion keeps CRLF line endings byte for byte", () => {
  const file = copyManifest("package.json", { crlf: true });
  const before = fs.readFileSync(file);
  const r = deps.editVersion(file, { name: "execa", from: "^9.6.1", to: "^10.2.1" });
  assert.equal(r.ok, true, r.reason);
  const after = fs.readFileSync(file);
  const expected = Buffer.from(before.toString("utf8").replace('"execa": "^9.6.1"', '"execa": "^10.2.1"'), "utf8");
  assert.ok(after.equals(expected));
  assert.equal(after.toString("utf8").split("\r\n").length, before.toString("utf8").split("\r\n").length);
  assert.ok(!/[^\r]\n/.test(after.toString("utf8")), "no bare LF appears");
});

test("editVersion refuses and leaves the file as it was: no match, several matches, nothing to change", () => {
  const file = copyManifest("package.json");
  const before = fs.readFileSync(file);
  assert.equal(deps.editVersion(file, { name: "left-pad", from: "^1.0.0", to: "^2.0.0" }).ok, false);
  assert.match(deps.editVersion(file, { name: "chalk", from: "^4.0.0", to: "^6.0.0" }).reason, /no line names chalk/);
  assert.match(deps.editVersion(file, { name: "chalk", from: "^5.6.2", to: "^5.6.2" }).reason, /same/);
  assert.match(deps.editVersion(path.join(path.dirname(file), "missing.json"), { name: "a", from: "1", to: "2" }).reason, /not found/);
  assert.ok(fs.readFileSync(file).equals(before));

  const twice = path.join(path.dirname(file), "twice.json");
  const text = '{\n  "dependencies": { "zod": "^3.0.0" },\n  "devDependencies": { "zod": "^3.0.0" }\n}\n';
  fs.writeFileSync(twice, text);
  const r = deps.editVersion(twice, { name: "zod", from: "^3.0.0", to: "^4.0.0" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /2 lines name zod/);
  assert.equal(fs.readFileSync(twice, "utf8"), text);
});

test("editVersion matches the from literal whole: 1.2 never edits inside 1.2.3", () => {
  const file = copyManifest("go.mod");
  const r = deps.editVersion(file, { name: "github.com/spf13/cobra", from: "v1.8", to: "v1.9" });
  assert.equal(r.ok, false);
  assert.match(r.reason, /no line names/);
});

test("editVersion: a refused write leaves the file untouched", { skip: typeof process.getuid === "function" && process.getuid() === 0 ? "root ignores read-only files" : false }, () => {
  const file = copyManifest("Cargo.toml");
  const before = fs.readFileSync(file);
  fs.chmodSync(file, 0o444);
  try {
    const r = deps.editVersion(file, { name: "toml", from: "0.8.2", to: "0.8.23" });
    assert.equal(r.ok, false);
    assert.match(r.reason, /could not write/);
  } finally {
    fs.chmodSync(file, 0o644);
  }
  assert.ok(fs.readFileSync(file).equals(before));
});

/* ---------------------------------------------------------------- labels */

const SCAN = readJson("label", "scan.json");
const RECORDS = readJson("label", "records.json");
const labeled = (scan = SCAN, records = RECORDS) => Object.fromEntries(deps.label(scan, records).map((l) => [l.id, l]));

test("label: Safe is an in-range patch or minor, notes read with no breaking lines, checks covering it", () => {
  const l = labeled();
  assert.equal(l.r1.label, "safe");
  assert.deepEqual(l.r1.reasons, ["used in 2 files"]);
});

test("label: every major and 0.x move is Check first at best, with its range change", () => {
  const l = labeled();
  assert.equal(l.r3.label, "check-first");
  assert.ok(l.r3.reasons.includes("0.x"), "0.x is worked out from the versions when jump is missing");
  assert.ok(l.r3.reasons.includes("range ^0.8.2 → ^0.9.0"));
  assert.equal(l.r4.label, "check-first");
  assert.ok(l.r4.reasons.includes("major"));
  assert.ok(l.r4.reasons.includes("range ^9.6.1 → ^10.2.1"));
});

test("label: breaking notes, notes not read, notes that could not be read and a missing record keep a minor at Check first", () => {
  const l = labeled();
  assert.equal(l.r2.label, "check-first");
  assert.ok(l.r2.reasons.includes("breaking notes"));
  assert.equal(l.r8.label, "check-first");
  assert.ok(l.r8.reasons.includes("notes not read"), "a row with no record counts as notes not read");
  assert.equal(l.r9.label, "check-first");
  assert.ok(l.r9.reasons.includes("notes could not be read"));
  const notRead = labeled(SCAN, RECORDS.map((r) => (r.id === "r1" ? { ...r, notes: "not read" } : r)));
  assert.equal(notRead.r1.label, "check-first");
  assert.ok(notRead.r1.reasons.includes("notes not read"));
});

test("label: a major whose changed API the code calls is a Warning", () => {
  const l = labeled();
  assert.equal(l.r5.label, "warning");
  assert.ok(l.r5.reasons.includes("calls a changed API"));
  assert.ok(l.r5.reasons.includes("used in 14 files"));
});

test("label: a major with unreadable notes is a Warning at 5 or more importing files, Check first below", () => {
  const l = labeled();
  assert.equal(deps.WIDE_USE_FILES, 5);
  assert.equal(l.r6.label, "warning");
  assert.ok(l.r6.reasons.includes("notes could not be read"));
  assert.ok(l.r6.reasons.includes("used in 7 files"));
  assert.equal(l.r7.label, "check-first");
  const atFive = labeled(SCAN, RECORDS.map((r) => (r.id === "r7" ? { ...r, files: 5 } : r)));
  assert.equal(atFive.r7.label, "warning");
  const unticked = labeled(SCAN, RECORDS.map((r) => (r.id === "r6" ? { ...r, notes: "not read" } : r)));
  assert.equal(unticked.r6.label, "warning", "notes not read (fetching unticked) count as unreadable notes");
  assert.ok(unticked.r6.reasons.includes("notes not read"));
  assert.equal(labeled().r14.label, "check-first", "a major with no record has no file count and stays Check first");
});

test("label: a hand-written range the target does not fit is Check first with range not rewritten", () => {
  const l = labeled();
  assert.equal(l.r10.label, "check-first");
  assert.ok(l.r10.reasons.includes("range not rewritten"));
  const minor = labeled({ ...SCAN, lockfiles: [{ ...SCAN.lockfiles[0], rows: [{ id: "x", current: "1.2.0", target: "1.3.0", jump: "minor", inRange: false, range: { from: "1.2.x", to: null } }] }] }, [{ id: "x", notes: "read", breaking: [], files: 1, calls: [] }]);
  assert.equal(minor.x.label, "check-first");
  assert.ok(minor.x.reasons.includes("range not rewritten"));
});

test("label: a minor needing a range raise is Check first, not Safe", () => {
  const l = labeled();
  assert.equal(l.r16.label, "check-first");
  assert.ok(l.r16.reasons.includes("range ~1.2.0 → ~1.3.0"));
});

test("label: exact pins are normal rows with a pinned note; a pinned major is Check first", () => {
  const l = labeled();
  assert.equal(l.r11.label, "safe");
  assert.ok(l.r11.reasons.includes("pinned 1.64.1 → 1.66.0"));
  assert.ok(!l.r11.reasons.some((r) => r.startsWith("range ")), "a pin shows as pinned, not as a range change");
  assert.equal(l.r12.label, "check-first");
  assert.ok(l.r12.reasons.includes("pinned 6.0.0 → 7.0.0"));
  assert.ok(l.r12.reasons.includes("major"));
});

test("label: security rows keep their label and carry a security reason first", () => {
  const l = labeled();
  assert.equal(l.r13.label, "safe");
  assert.equal(l.r13.reasons[0], "security (high)");
  assert.equal(l.r14.label, "check-first");
  assert.equal(l.r14.reasons[0], "security");
  assert.ok(l.r14.reasons.includes("notes not read"));
});

test("label: unreadable tool output is Check first with a could not read note naming the tool", () => {
  const l = labeled();
  assert.equal(l.r15.label, "check-first");
  assert.ok(l.r15.reasons.includes("could not read npm audit output"));
});

test("label: a move whose size cannot be worked out is never Safe", () => {
  const rows = [
    { id: "u1", current: "1.2.3", target: "2.0.0", inRange: true },
    { id: "u2", current: "abc", target: "def", inRange: true },
  ];
  const scan = { noChecks: false, lockfiles: [{ lockfile: "pnpm-lock.yaml", ecosystem: "pnpm", checks: { rows: ["Root"], discovered: [] }, rows }] };
  const records = rows.map(({ id }) => ({ id, notes: "read", breaking: [], files: 1, calls: [] }));
  const l = labeled(scan, records);
  for (const id of ["u1", "u2"]) {
    assert.equal(l[id].label, "check-first", id);
    assert.ok(l[id].reasons.includes("could not read the versions"), id);
  }
  const npm = labeled({ ...scan, lockfiles: [{ ...scan.lockfiles[0], ecosystem: "npm" }] }, records);
  assert.equal(npm.u2.label, "check-first", "unparseable versions under a known ecosystem too");
});

test("label: a row whose runtime fit was not checked is never Safe and says which runtime", () => {
  const scan = structuredClone(SCAN);
  const row = scan.lockfiles.flatMap((l) => l.rows).find((r) => r.id === "r1");
  row.runtimeNotChecked = ">=3.10";
  const l = labeled(scan);
  assert.equal(l.r1.label, "check-first");
  assert.ok(l.r1.reasons.includes("runtime fit not checked (>=3.10)"));
});

test("label: a lockfile no check covers tops out at Check first", () => {
  const l = labeled();
  assert.equal(l.r20.label, "check-first");
  assert.ok(l.r20.reasons.includes("no checks cover this lockfile"));
});

test("label: no checks at all caps every row at Check first with no checks to run; Warnings stay", () => {
  const l = labeled({ ...SCAN, noChecks: true });
  for (const id of ["r1", "r11", "r13"]) {
    assert.equal(l[id].label, "check-first", id);
    assert.ok(l[id].reasons.includes("no checks to run"), id);
  }
  assert.equal(l.r5.label, "warning");
  assert.ok(Object.values(l).every((x) => x.label !== "safe"));
});

test("label is pure: same input, same output, inputs untouched, scan order kept", () => {
  const scan = structuredClone(SCAN);
  const records = structuredClone(RECORDS);
  const a = deps.label(scan, records);
  const b = deps.label(scan, records);
  assert.deepEqual(a, b);
  assert.deepEqual(scan, SCAN);
  assert.deepEqual(records, RECORDS);
  assert.deepEqual(a.map((x) => x.id), SCAN.lockfiles.flatMap((lf) => lf.rows.map((r) => r.id)));
  assert.deepEqual(deps.label({}, []), []);
});

test("label --run --records writes labels.json and prints the labels", () => {
  const dir = runFolder({ "scan.json": SCAN });
  const r = runDeps(["label", "--run", dir, "--records", path.join(FIXTURES, "label", "records.json")]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  assert.deepEqual(r.json.labels, deps.label(SCAN, RECORDS));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "labels.json"), "utf8")), r.json.labels);

  const wrapped = path.join(dir, "wrapped.json");
  fs.writeFileSync(wrapped, JSON.stringify({ records: RECORDS }));
  assert.equal(runDeps(["label", "--run", dir, "--records", wrapped]).code, 0);
});

test("label: a missing scan.json exits 3, an unreadable records file exits 4", () => {
  const empty = runFolder();
  const noScan = runDeps(["label", "--run", empty, "--records", path.join(FIXTURES, "label", "records.json")]);
  assert.equal(noScan.code, 3);
  assert.equal(noScan.json.error, "scan-missing");

  const dir = runFolder({ "scan.json": SCAN });
  const bad = path.join(dir, "bad.json");
  fs.writeFileSync(bad, "{ not json");
  const r = runDeps(["label", "--run", dir, "--records", bad]);
  assert.equal(r.code, 4);
  assert.equal(r.json.error, "records-invalid");
  const shape = path.join(dir, "shape.json");
  fs.writeFileSync(shape, JSON.stringify({ rows: [] }));
  assert.equal(runDeps(["label", "--run", dir, "--records", shape]).code, 4);
  assert.equal(runDeps(["label", "--run", dir]).code, 2);
});

/* --------------------------------------------------------------- batches */

/** A scan with lockfiles of rows; each row spec is [id, pair?]. */
function batchScan(lockfiles) {
  return {
    noChecks: false,
    lockfiles: Object.entries(lockfiles).map(([lockfile, rows]) => ({
      lockfile,
      ecosystem: "npm",
      checks: { rows: ["Root"], discovered: [] },
      rows: rows.map(([id, pair = null]) => ({ id, package: id, current: "1.0.0", target: "1.0.1", pair })),
    })),
  };
}
const labelsOf = (map) => Object.entries(map).map(([id, l]) => ({ id, label: l }));

test("planBatches: one Safe batch per lockfile, each Check first and Warning pick alone, Safe batches first", () => {
  const scan = batchScan({
    "a/package-lock.json": [["a1"], ["a2"], ["a3"], ["a4"]],
    "b/package-lock.json": [["b1"], ["b2"], ["b3"]],
  });
  const labels = labelsOf({ a1: "safe", a2: "check-first", a3: "safe", a4: "warning", b1: "safe", b2: "safe", b3: "check-first" });
  const { batches, unknown } = deps.planBatches(scan, labels, ["b3", "a4", "b2", "a1", "a2", "b1", "a3"]);
  assert.deepEqual(unknown, []);
  assert.deepEqual(batches, [
    { id: "b1", lockfile: "a/package-lock.json", picks: ["a1", "a3"] },
    { id: "b2", lockfile: "b/package-lock.json", picks: ["b1", "b2"] },
    { id: "b3", lockfile: "a/package-lock.json", picks: ["a2"] },
    { id: "b4", lockfile: "a/package-lock.json", picks: ["a4"] },
    { id: "b5", lockfile: "b/package-lock.json", picks: ["b3"] },
  ]);
});

test("planBatches keeps pairs in one batch, in the riskier pick's place; unpicked partners and unknown ids", () => {
  const scan = batchScan({ "package-lock.json": [["s1", "p1"], ["c1", "p1"], ["s2", "s3"], ["s3"], ["s4", "x9"], ["w1"]] });
  const labels = labelsOf({ s1: "safe", c1: "check-first", s2: "safe", s3: "safe", s4: "safe", w1: "warning" });
  const { batches, unknown } = deps.planBatches(scan, labels, ["s1", "c1", "s2", "s3", "s4", "w1", "zz"]);
  assert.deepEqual(unknown, ["zz"]);
  assert.deepEqual(batches, [
    { id: "b1", lockfile: "package-lock.json", picks: ["s2", "s3", "s4"] },
    { id: "b2", lockfile: "package-lock.json", picks: ["s1", "c1"] },
    { id: "b3", lockfile: "package-lock.json", picks: ["w1"] },
  ]);
  const half = deps.planBatches(scan, labels, ["c1"]);
  assert.deepEqual(half.batches, [{ id: "b1", lockfile: "package-lock.json", picks: ["c1"] }], "a partner not picked is left out");
});

const many = (n, prefix = "s") => Array.from({ length: n }, (_, i) => [`${prefix}${i + 1}`]);

test("splitBatch: a batch of 7 or more is halved", () => {
  const scan = batchScan({ "package-lock.json": many(8) });
  const eight = { id: "b1", lockfile: "package-lock.json", picks: many(8).map(([id]) => id) };
  assert.deepEqual(deps.splitBatch(scan, eight), [
    { id: "b1.1", lockfile: "package-lock.json", picks: ["s1", "s2", "s3", "s4"] },
    { id: "b1.2", lockfile: "package-lock.json", picks: ["s5", "s6", "s7", "s8"] },
  ]);
  const seven = { ...eight, picks: eight.picks.slice(0, 7) };
  assert.deepEqual(deps.splitBatch(scan, seven).map((b) => b.picks), [["s1", "s2", "s3", "s4"], ["s5", "s6", "s7"]]);
});

test("splitBatch never splits a pair when halving", () => {
  const rows = [["s1"], ["s2"], ["s3"], ["s4", "p"], ["s5", "p"], ["s6"], ["s7"]];
  const scan = batchScan({ "package-lock.json": rows });
  const batch = { id: "b2", lockfile: "package-lock.json", picks: rows.map(([id]) => id) };
  const parts = deps.splitBatch(scan, batch);
  assert.equal(parts.length, 2);
  assert.ok(parts.some((b) => b.picks.includes("s4") && b.picks.includes("s5")), JSON.stringify(parts));
  assert.deepEqual(parts.flatMap((b) => b.picks).sort(), batch.picks.slice().sort());
});

test("splitBatch: 2 to 6 picks become one batch per pick, a pair as one", () => {
  const scan = batchScan({ "package-lock.json": [["s1"], ["s2", "s3"], ["s3"], ["s4"]] });
  const batch = { id: "b1", lockfile: "package-lock.json", picks: ["s1", "s2", "s3", "s4"] };
  assert.deepEqual(deps.splitBatch(scan, batch), [
    { id: "b1.1", lockfile: "package-lock.json", picks: ["s1"] },
    { id: "b1.2", lockfile: "package-lock.json", picks: ["s2", "s3"] },
    { id: "b1.3", lockfile: "package-lock.json", picks: ["s4"] },
  ]);
  const six = batchScan({ "package-lock.json": many(6) });
  assert.equal(deps.splitBatch(six, { id: "b3", lockfile: "package-lock.json", picks: many(6).map(([id]) => id) }).length, 6);
  const two = deps.splitBatch(six, { id: "b1.2", lockfile: "package-lock.json", picks: ["s1", "s2"] });
  assert.deepEqual(two.map((b) => b.id), ["b1.2.1", "b1.2.2"]);
});

test("splitBatch: a single pair that failed is retried as the pair; a single pick cannot be split", () => {
  const scan = batchScan({ "package-lock.json": [["s1", "s2"], ["s2"], ["s3"]] });
  assert.deepEqual(deps.splitBatch(scan, { id: "b4", lockfile: "package-lock.json", picks: ["s1", "s2"] }), [{ id: "b4.1", lockfile: "package-lock.json", picks: ["s1", "s2"] }]);
  assert.equal(deps.splitBatch(scan, { id: "b5", lockfile: "package-lock.json", picks: ["s3"] }), null);
});

test("batches --picks and --split write batches.json; --split replaces the batch in place", () => {
  const scan = batchScan({ "package-lock.json": [...many(8), ["c1"]] });
  const labels = labelsOf({ ...Object.fromEntries(many(8).map(([id]) => [id, "safe"])), c1: "check-first" });
  const dir = runFolder({ "scan.json": scan, "labels.json": labels });
  const planned = runDeps(["batches", "--run", dir, "--picks", "c1,s1,s2,s3,s4,s5,s6,s7,s8"]);
  assert.equal(planned.code, 0, planned.stderr);
  assert.deepEqual(planned.json.batches.map((b) => [b.id, b.picks.length]), [["b1", 8], ["b2", 1]]);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "batches.json"), "utf8")).batches, planned.json.batches);

  const split = runDeps(["batches", "--run", dir, "--split", "b1"]);
  assert.equal(split.code, 0, split.stderr);
  assert.equal(split.json.split, "b1");
  assert.deepEqual(split.json.batches.map((b) => b.id), ["b1.1", "b1.2"]);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, "batches.json"), "utf8")).batches;
  assert.deepEqual(saved.map((b) => b.id), ["b1.1", "b1.2", "b2"]);

  const again = runDeps(["batches", "--run", dir, "--split", "b1.1"]);
  assert.deepEqual(again.json.batches.map((b) => b.picks), [["s1"], ["s2"], ["s3"], ["s4"]]);

  const single = runDeps(["batches", "--run", dir, "--split", "b2"]);
  assert.equal(single.code, 4);
  assert.equal(single.json.error, "cannot-split");
});

test("batches: usage and lookup failures", () => {
  const scan = batchScan({ "package-lock.json": [["s1"]] });
  const dir = runFolder({ "scan.json": scan, "labels.json": labelsOf({ s1: "safe" }) });
  assert.equal(runDeps(["batches", "--run", dir]).code, 2);
  assert.equal(runDeps(["batches", "--run", dir, "--picks", "s1", "--split", "b1"]).code, 2);
  const unknown = runDeps(["batches", "--run", dir, "--picks", "s1,nope"]);
  assert.equal(unknown.code, 3);
  assert.deepEqual(unknown.json.unknown, ["nope"]);
  assert.equal(runDeps(["batches", "--run", dir, "--split", "b1"]).json.error, "batches-missing");
  runDeps(["batches", "--run", dir, "--picks", "s1"]);
  assert.equal(runDeps(["batches", "--run", dir, "--split", "b9"]).json.error, "unknown-batch");
  const noLabels = runFolder({ "scan.json": scan });
  assert.equal(runDeps(["batches", "--run", noLabels, "--picks", "s1"]).json.error, "labels-missing");
});

/* ------------------------------------------------- npm family: stubs on PATH */

// Recorded with npm 11.20.0 from a small workspace (npm-11.20.0/project): a
// direct vulnerability (semver), a transitive one (minimist via mkdirp), a pin
// (left-pad), an override (ms) and a member (packages/app). pnpm and Yarn 1 do
// not run on the recording machine, so pnpm-docs/ and yarn1-docs/ follow their
// documented output shapes.
const NPM = path.join(FIXTURES, "npm-11.20.0");
const fx = (...p) => path.join(FIXTURES, ...p);

/** Env additions that set PATH to exactly `dir`, every case variant of the key overridden. */
function withPath(dir, extra = {}) {
  const env = { ...extra };
  for (const key of Object.keys(process.env)) if (/^path$/i.test(key)) env[key] = dir;
  env.PATH = dir;
  return env;
}

// Every stub folder made, so the last test can read every call any stub got.
const stubDirs = [];

/**
 * The stub every tool shares: it logs its arguments to calls.log, then plays
 * the first rule in plan.json for its name whose `has` strings each match an
 * argument (equal, or its start): prints `out` (a fixture path), `outs` (one
 * per call, in order), `err` (on stderr) or `text`,
 * exits with `code`, and for `writes` copies a fixture over a file in its
 * working folder or moves npm lockfile entries (`bump`).
 */
const STUB = [
  'import fs from "node:fs";',
  'import path from "node:path";',
  'import { fileURLToPath } from "node:url";',
  "const self = fileURLToPath(import.meta.url);",
  "const here = path.dirname(self);",
  'const name = path.basename(self).replace(/-stub\\.mjs$/, "");',
  "const args = process.argv.slice(2);",
  'fs.appendFileSync(path.join(here, "calls.log"), JSON.stringify({ tool: name, args, cwd: process.cwd() }) + "\\n");',
  'const plan = JSON.parse(fs.readFileSync(path.join(here, "plan.json"), "utf8"))[name] || [];',
  "const rule = plan.find((r) => (r.has || []).every((h) => args.some((a) => a === h || a.startsWith(h))));",
  'if (!rule) { process.stderr.write("stub: no rule for " + args.join(" ")); process.exit(9); }',
  "for (const w of rule.writes || []) {",
  "  const file = path.join(process.cwd(), w.file);",
  "  if (w.copy) fs.copyFileSync(w.copy, file);",
  "  if (w.bump) {",
  '    const lock = JSON.parse(fs.readFileSync(file, "utf8"));',
  "    for (const [key, v] of Object.entries(w.bump)) lock.packages[key].version = v;",
  '    fs.writeFileSync(file, JSON.stringify(lock, null, 2) + "\\n");',
  "  }",
  "}",
  'if (rule.out) process.stdout.write(fs.readFileSync(rule.out, "utf8"));',
  // outs: one fixture per call of the rule, in order, the last repeating (a tool whose answer changes, as pip freeze after an install).
  "if (rule.outs) {",
  "  const counter = path.join(here, `count-${name}-${plan.indexOf(rule)}.txt`);",
  '  const n = fs.existsSync(counter) ? Number(fs.readFileSync(counter, "utf8")) : 0;',
  "  fs.writeFileSync(counter, String(n + 1));",
  '  process.stdout.write(fs.readFileSync(rule.outs[Math.min(n, rule.outs.length - 1)], "utf8"));',
  "}",
  // err: a fixture printed on stderr, where the tool prints it (cargo update --dry-run).
  'if (rule.err) process.stderr.write(fs.readFileSync(rule.err, "utf8"));',
  "if (rule.text) process.stdout.write(rule.text);",
  "process.exitCode = rule.code || 0;",
  "",
].join("\n");

/** A folder of stub tools (each a node script, .cmd wrapped on Windows) playing `plan`. */
function stubPath(plan) {
  const dir = tmp("deps-stubs");
  stubDirs.push(dir);
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify(plan));
  for (const name of Object.keys(plan)) {
    const js = path.join(dir, `${name}-stub.mjs`);
    fs.writeFileSync(js, STUB);
    if (process.platform === "win32") {
      fs.writeFileSync(path.join(dir, `${name}.cmd`), `@"${process.execPath}" "${js}" %*\r\n@exit /b %errorlevel%\r\n`);
    } else {
      const sh = path.join(dir, name);
      fs.writeFileSync(sh, `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`);
      fs.chmodSync(sh, 0o755);
    }
  }
  return dir;
}

const callsOf = (dir) => {
  const file = path.join(dir, "calls.log");
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
};

// Run folders detect makes in the system temp folder, removed after the suite.
const runFolders = [];
after(() => {
  for (const dir of runFolders) fs.rmSync(dir, { recursive: true, force: true });
});

/** deps.mjs with `pathDir` as the whole PATH. */
function runStubbed(args, pathDir) {
  const r = runDeps(args, { env: withPath(pathDir) });
  if (r.json && r.json.run) runFolders.push(r.json.run);
  return r;
}

/** The recorded project copied into a temp folder (extra files on top), so a run never touches the fixture. */
function project(extra = {}) {
  const dir = tmp("deps-project");
  fs.cpSync(path.join(NPM, "project"), dir, { recursive: true });
  for (const [rel, content] of Object.entries(extra)) write(dir, rel, typeof content === "string" ? content : JSON.stringify(content, null, 2) + "\n");
  return dir;
}

/** npm rules replaying the recordings: outdated, audit and one view per package; `over` rules come first. */
const npmRules = (over = []) => [
  ...over,
  { has: ["outdated"], out: path.join(NPM, "outdated.json"), code: 1 },
  { has: ["audit"], out: path.join(NPM, "audit.json"), code: 1 },
  { has: ["view", "minimist@^1.2.5"], out: path.join(NPM, "view-minimist.json") },
  ...["chalk", "left-pad", "mkdirp", "semver", "is-number", "ms"].map((p) => ({ has: ["view", `${p}@>`], out: path.join(NPM, `view-${p}.json`) })),
];

/** git that says root is a repository with these porcelain lines, tracking only `tracked`. */
const gitRules = (root, { status = [], tracked = [] } = {}) => [
  { has: ["rev-parse", "--show-toplevel"], text: root },
  { has: ["status"], text: status.map((l) => `${l}\0`).join("") },
  ...tracked.map((t) => ({ has: ["ls-files", t], text: `${t}\n` })),
  { has: ["ls-files"], code: 1 },
];

/** detect, then scan, on a project with stub tools playing `plan`. */
function detectAndScan(root, plan, scanArgs = []) {
  const bin = stubPath(plan);
  const d = runStubbed(["detect", "--root", root], bin);
  assert.equal(d.code, 0, d.stderr || d.stdout);
  const s = runStubbed(["scan", "--run", d.json.run, ...scanArgs], bin);
  const scan = s.code === 0 ? JSON.parse(fs.readFileSync(path.join(d.json.run, "scan.json"), "utf8")) : null;
  return { bin, detect: d, scanRun: s, run: d.json.run, scan };
}

test("detect finds lockfiles, workspace members, noLockfile, dirty, tracked and missing tools", () => {
  const root = project({
    "loose/package.json": { name: "loose", dependencies: { chalk: "^4.0.0" } },
    "empty/package.json": { name: "empty", type: "module" },
    "web/package.json": { name: "web", dependencies: { chalk: "^4.0.0" } },
    "web/pnpm-lock.yaml": "lockfileVersion: '9.0'\n",
    "node_modules/x/package.json": { name: "x", dependencies: { y: "1" } },
    "specs/s/package.json": { name: "s", dependencies: { y: "1" } },
  });
  const bin = stubPath({
    npm: npmRules(),
    git: gitRules(root, { status: [" M package-lock.json", " M src/index.js", "?? notes.txt"], tracked: ["web/pnpm-lock.yaml"] }),
  });
  const r = runStubbed(["detect", "--root", root], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.git, true);
  const [rootLock, web] = r.json.lockfiles;
  assert.equal(rootLock.lockfile, "package-lock.json");
  assert.equal(rootLock.manager, "npm");
  assert.deepEqual(rootLock.members, [".", "packages/app"]);
  assert.equal(rootLock.tracked, false);
  assert.deepEqual(rootLock.dirty, ["package-lock.json"]);
  assert.equal(rootLock.updates, 6);
  assert.equal(rootLock.install, "npm ci");
  assert.equal(web.lockfile, "web/pnpm-lock.yaml");
  assert.equal(web.manager, "pnpm");
  assert.equal(web.tracked, true);
  assert.equal(web.updates, null, "no pnpm on PATH, no count");
  assert.deepEqual(r.json.missingTools, [{ tool: "pnpm", lockfiles: ["web/pnpm-lock.yaml"] }]);
  assert.deepEqual(r.json.noLockfile.map((n) => n.manifest), ["loose/package.json"], "empty, node_modules and specs manifests are never listed");
  assert.match(r.json.noLockfile[0].reason, /no lockfile/);
  assert.equal(r.json.unrelatedChanges, 2);
  assert.deepEqual(r.json.notCovered, []);
  const saved = JSON.parse(fs.readFileSync(path.join(r.json.run, "detect.json"), "utf8"));
  assert.equal(saved.root, root);
  assert.ok(path.basename(r.json.run).startsWith("plan2code-deps-"));
});

test("detect outside a git repository leaves tracked, dirty and unrelatedChanges unknown", () => {
  const r = runStubbed(["detect", "--root", project()], stubPath({ npm: npmRules() }));
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.git, false);
  assert.equal(r.json.lockfiles[0].tracked, null);
  assert.equal(r.json.lockfiles[0].dirty, null);
  assert.equal(r.json.unrelatedChanges, null);
});

test("detect reads pnpm-workspace.yaml members and marks a Yarn 2+ lockfile", () => {
  const root = tmp("deps-ws");
  write(root, "package.json", JSON.stringify({ name: "r" }));
  write(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  write(root, "pnpm-workspace.yaml", "packages:\n  - 'apps/*'\n  - \"libs/**\"\n  - '!apps/skip'\n");
  for (const m of ["apps/a", "apps/skip", "libs/x/y"]) write(root, `${m}/package.json`, JSON.stringify({ name: m }));
  write(root, "berry/package.json", JSON.stringify({ name: "b" }));
  write(root, "berry/yarn.lock", "__metadata:\n  version: 8\n");
  const r = runStubbed(["detect", "--root", root], stubPath({ npm: npmRules() }));
  assert.equal(r.code, 0, r.stderr);
  const byLock = Object.fromEntries(r.json.lockfiles.map((l) => [l.lockfile, l]));
  assert.deepEqual(byLock["pnpm-lock.yaml"].members, [".", "apps/a", "libs/x/y"]);
  assert.equal(byLock["berry/yarn.lock"].berry, true);
  assert.equal(byLock["berry/yarn.lock"].manager, "yarn");
});

test("scan builds rows: target, jump, in range, range raise, pin, via row, security and the runtime cut", () => {
  const { scanRun, scan } = detectAndScan(project(), { npm: npmRules() }, ["--notes"]);
  assert.equal(scanRun.code, 0, scanRun.stderr);
  assert.deepEqual(scanRun.json.lockfiles, [{ lockfile: "package-lock.json", rows: 6, held: 1, notScanned: 0, stillOpen: 0, audited: true, checks: 0 }]);
  assert.equal(scan.noChecks, true, "no AGENTS.md, no test map rows");
  const lock = scan.lockfiles[0];
  const rows = Object.fromEntries(lock.rows.map((r) => [r.package, r]));
  assert.ok(lock.rows[0].security && lock.rows[1].security, "vulnerability fixes lead");
  // engines.node >=12: chalk 5 and 6 need a newer Node, so the newest that fits is 4.1.2.
  assert.equal(rows.chalk.id, "package-lock.json#chalk");
  assert.equal(rows.chalk.target, "4.1.2");
  assert.equal(rows.chalk.jump, "patch");
  assert.equal(rows.chalk.inRange, true);
  assert.deepEqual(rows.chalk.range, { from: "^4.1.0", to: "^4.1.0" });
  assert.equal(rows.chalk.newerNotFitting[0], "6.0.1");
  assert.ok(rows.chalk.newerNotFitting.includes("5.0.0"));
  assert.equal(rows.chalk.repo, "https://github.com/chalk/chalk");
  assert.deepEqual(rows["is-number"].range, { from: "^6.0.0", to: "^7.0.0" });
  assert.equal(rows["is-number"].jump, "major");
  assert.equal(rows["is-number"].inRange, false);
  assert.deepEqual(rows["is-number"].declaredIn, [{ file: "packages/app/package.json", range: "^6.0.0" }]);
  assert.equal(rows["left-pad"].pinned, true);
  assert.deepEqual(rows["left-pad"].range, { from: "1.1.0", to: "1.3.0" });
  assert.equal(rows.mkdirp.jump, "major");
  assert.deepEqual(rows.semver.security, { severity: "high", ids: ["GHSA-c2qf-rxjj-qqgw"] });
  assert.equal(rows.semver.target, "7.8.6");
  assert.equal(rows.minimist.via, "mkdirp");
  assert.equal(rows.minimist.lockfileOnly, true);
  assert.equal(rows.minimist.current, "1.2.5");
  assert.equal(rows.minimist.target, "1.2.8");
  assert.equal(rows.minimist.inRange, true);
  assert.deepEqual(rows.minimist.security, { severity: "critical", ids: ["GHSA-xvch-5gv4-984h"] });
  assert.deepEqual(lock.held, [{ id: "package-lock.json#ms", package: "ms", current: "2.1.2", latest: "2.1.3", reason: "held by overrides in package.json", file: "package.json", security: null }]);
  assert.deepEqual(lock.runtime, { declared: ">=12", source: "engines", machine: process.version.replace(/^v/, "") });
  assert.equal(deps.label(scan, []).length, 6, "every row takes a label");
});

test("scan without --notes leaves repo null, and --no-audit skips the audit", () => {
  const { scan, bin } = detectAndScan(project(), { npm: npmRules() }, ["--no-audit"]);
  const lock = scan.lockfiles[0];
  assert.equal(lock.audited, false);
  assert.ok(lock.rows.every((r) => r.repo === null && r.security === null && !r.via));
  assert.ok(!callsOf(bin).some((c) => c.args.includes("audit")), "no audit run");
});

test("scan: a package with no version that runs on the project's declared Node is held with the reason", () => {
  // engines >=8: no chalk after 4.1.0 runs on Node 8 (4.1.2 needs >=10).
  const root = project();
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  pkg.engines.node = ">=8";
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
  const { scan } = detectAndScan(root, { npm: npmRules() }, ["--no-audit"]);
  const held = scan.lockfiles[0].held.find((h) => h.package === "chalk");
  assert.ok(held, "chalk held");
  assert.match(held.reason, /needs Node .*the project declares >=8/);
  assert.ok(!scan.lockfiles[0].rows.some((r) => r.package === "chalk"));
});

test("scan: an engines.node with no lower bound fits against this machine's Node, not 0.0.0", () => {
  for (const range of ["*", "<99"]) {
    const root = project();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    pkg.engines.node = range;
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
    const { scan } = detectAndScan(root, { npm: npmRules() }, ["--no-audit"]);
    const lock = scan.lockfiles[0];
    assert.ok(!lock.held.some((h) => h.package === "chalk"), `${range}: chalk is not held`);
    assert.ok(lock.rows.some((r) => r.package === "chalk"), `${range}: chalk is a row`);
    assert.equal(lock.runtime.declared, range);
  }
});

/** The recorded audit with `change` applied, saved to a temp file for a stub to print. */
function auditWith(change) {
  const audit = JSON.parse(fs.readFileSync(path.join(NPM, "audit.json"), "utf8"));
  change(audit.vulnerabilities);
  const file = path.join(tmp("deps-audit"), "audit.json");
  fs.writeFileSync(file, JSON.stringify(audit));
  return file;
}

test("scan: an override holding a vulnerable package badges the hold and lists it as still open", () => {
  const file = auditWith((v) => {
    v.ms = { ...v.semver, name: "ms", isDirect: false, nodes: ["node_modules/ms"], via: [{ ...v.semver.via[0], name: "ms", url: "https://github.com/advisories/GHSA-test-ms00-0000" }] };
  });
  const lock = detectAndScan(project(), { npm: npmRules([{ has: ["audit"], out: file, code: 1 }]) }).scan.lockfiles[0];
  assert.deepEqual(lock.held.find((h) => h.package === "ms").security, { severity: "high", ids: ["GHSA-test-ms00-0000"] });
  assert.deepEqual(lock.stillOpen, [{ package: "ms", severity: "high", ids: ["GHSA-test-ms00-0000"], reason: "held by overrides in package.json" }]);
});

test("scan: a finding only a parent major fixes badges the parent's row; one nothing fixes is still open", () => {
  const file = auditWith((v) => {
    v.minimist.fixAvailable = { name: "mkdirp", version: "1.0.0", isSemVerMajor: true };
    v["has-flag"] = { name: "has-flag", severity: "low", isDirect: false, via: [{ source: 1, name: "has-flag", url: "https://github.com/advisories/GHSA-test-none-0000", severity: "low", range: "<9" }], effects: [], nodes: ["node_modules/has-flag"], fixAvailable: false };
  });
  const lock = detectAndScan(project(), { npm: npmRules([{ has: ["audit"], out: file, code: 1 }]) }).scan.lockfiles[0];
  const mkdirp = lock.rows.find((r) => r.package === "mkdirp");
  assert.deepEqual(mkdirp.fixes, ["minimist"]);
  assert.equal(mkdirp.security.severity, "critical");
  assert.ok(!lock.rows.some((r) => r.package === "minimist"), "no via row when only a major fixes it");
  assert.deepEqual(lock.stillOpen, [{ package: "has-flag", severity: "low", ids: ["GHSA-test-none-0000"], reason: "no fixed version published yet" }]);
});

test("scan: a lookup the registry refuses puts that package in notScanned with the reason", () => {
  const plan = { npm: npmRules([{ has: ["view", "is-number@>"], out: path.join(NPM, "view-e404.json"), code: 1 }]) };
  const lock = detectAndScan(project(), plan, ["--no-audit"]).scan.lockfiles[0];
  assert.deepEqual(lock.notScanned.map((n) => n.package), ["is-number"]);
  assert.match(lock.notScanned[0].reason, /^Not Found - GET https:\/\/registry\.npmjs\.org\//);
  assert.ok(!lock.rows.some((r) => r.package === "is-number"));
  assert.ok(lock.rows.length > 0, "everything else scanned");
});

test("scan exits 3 with no registry answered when every lookup fails", () => {
  const bin = stubPath({ npm: [{ has: ["outdated"], out: path.join(NPM, "view-e404.json"), code: 1 }] });
  const d = runStubbed(["detect", "--root", project()], bin);
  const r = runStubbed(["scan", "--run", d.json.run], bin);
  assert.equal(r.code, 3);
  assert.equal(r.json.ok, false);
  assert.equal(r.json.reason, "no registry answered");
  assert.ok(!fs.existsSync(path.join(d.json.run, "scan.json")));
});

test("scan: an unknown --folders entry exits 3; a known one scans only that lockfile", () => {
  const bin = stubPath({ npm: npmRules() });
  const d = runStubbed(["detect", "--root", project()], bin);
  assert.equal(runStubbed(["scan", "--run", d.json.run, "--folders", "nope"], bin).code, 3);
  const r = runStubbed(["scan", "--run", d.json.run, "--folders", ".", "--no-audit"], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.lockfiles.length, 1);
});

test("scan attaches the test map rows covering a lockfile's members; a Shared row means the full suite", () => {
  const root = project({
    "AGENTS.md": "# A\n\n## Test map\n\n| Area | Paths | Run | Shared |\n| --- | --- | --- | --- |\n| App | `packages/app/**` | `npm test -w app` | no |\n| Web | `web/**` | `x` | no |\n| Build | `scripts/**` | `npm test` | yes |\n",
    "web/package.json": { name: "web", dependencies: { chalk: "^4.0.0" } },
    "web/package-lock.json": JSON.stringify({ lockfileVersion: 3, packages: {} }),
  });
  const { scan } = detectAndScan(root, { npm: npmRules() }, ["--no-audit"]);
  const byLock = Object.fromEntries(scan.lockfiles.map((l) => [l.lockfile, l.checks]));
  // The root lockfile resolves the root folder, so every row falls in it.
  assert.deepEqual(byLock["package-lock.json"], { rows: ["App", "Web", "Build"], commands: ["npm test -w app", "x", "npm test"], discovered: [], full: true });
  assert.deepEqual(byLock["web/package-lock.json"], { rows: ["Web"], commands: ["x"], discovered: [], full: false });
  assert.equal(scan.noChecks, false);
});

test("scan reads pnpm's outdated JSON and Yarn 1's JSON lines; their transitive findings stay open", () => {
  const root = tmp("deps-pm");
  for (const dir of ["p", "y"]) write(root, `${dir}/package.json`, JSON.stringify({ name: dir, engines: { node: ">=12" }, dependencies: { chalk: "^4.1.0", "is-number": "^6.0.0" } }));
  write(root, "p/pnpm-lock.yaml", "lockfileVersion: '9.0'\n");
  write(root, "y/yarn.lock", "# yarn lockfile v1\n");
  const plan = {
    npm: npmRules().filter((r) => r.has[0] === "view"),
    pnpm: [
      { has: ["outdated"], out: fx("pnpm-docs", "outdated.json"), code: 1 },
      { has: ["audit"], out: fx("pnpm-docs", "audit.json"), code: 1 },
    ],
    yarn: [
      { has: ["outdated"], out: fx("yarn1-docs", "outdated.jsonl"), code: 1 },
      { has: ["audit"], out: fx("yarn1-docs", "audit.jsonl"), code: 16 },
    ],
  };
  const { scan, scanRun } = detectAndScan(root, plan);
  assert.equal(scanRun.code, 0, scanRun.stderr);
  assert.deepEqual(scan.lockfiles.map((l) => l.manager), ["pnpm", "yarn"]);
  for (const lock of scan.lockfiles) {
    const rows = Object.fromEntries(lock.rows.map((r) => [r.package, r]));
    assert.equal(rows.chalk.target, "4.1.2", lock.lockfile);
    assert.equal(rows.chalk.inRange, true, lock.lockfile);
    assert.equal(rows["is-number"].target, "7.0.0", lock.lockfile);
    assert.equal(lock.audited, true, lock.lockfile);
    assert.equal(lock.stillOpen.length, 1, lock.lockfile);
    assert.equal(lock.stillOpen[0].package, "minimist");
    assert.match(lock.stillOpen[0].reason, /does not say whether the parent's range allows the fix/);
  }
});

test("scan: Yarn 2+ has no outdated list, so its lockfile is listed as not scanned", () => {
  const root = tmp("deps-berry");
  write(root, "package.json", JSON.stringify({ name: "b", dependencies: { chalk: "^4.1.0" } }));
  write(root, "yarn.lock", "__metadata:\n  version: 8\n");
  const { scan, scanRun } = detectAndScan(root, { npm: [], yarn: [{ has: ["npm", "audit"], text: "" }] });
  assert.equal(scanRun.code, 0, scanRun.stderr);
  assert.match(scan.lockfiles[0].notScanned[0].reason, /Yarn 2\+ has no outdated list/);
  assert.equal(scan.lockfiles[0].berry, true, "scan.json keeps the Yarn 2+ mark, so install and apply pick Berry's flags");
});

/** detect, scan, label and plan batches for picks; returns the run folder, its stub PATH and the batches. */
function planned(root, picks, plan) {
  const { run, bin } = detectAndScan(root, plan, ["--no-audit"]);
  const records = path.join(run, "records.json");
  fs.writeFileSync(records, "[]");
  assert.equal(runStubbed(["label", "--run", run, "--records", records], bin).code, 0);
  const b = runStubbed(["batches", "--run", run, "--picks", picks.map((p) => `package-lock.json#${p}`).join(",")], bin);
  assert.equal(b.code, 0, b.stderr);
  return { run, bin, batches: b.json.batches };
}

const bytesOf = (root, files) => Object.fromEntries(files.map((f) => [f, fs.readFileSync(path.join(root, f))]));
const batchFor = (batches, pkg) => batches.find((b) => b.picks.includes(`package-lock.json#${pkg}`));

test("apply moves the picks with the package manager's own command and reports changed and unpicked moves", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["chalk"], {
    npm: npmRules([{ has: ["update", "chalk"], writes: [{ file: "package-lock.json", bump: { "node_modules/chalk": "4.1.2", "node_modules/is-number": "7.0.0" } }] }]),
  });
  const b = batchFor(batches, "chalk");
  assert.equal(runStubbed(["backup", "--run", run, "--batch", b.id], bin).code, 0);
  const manifest = fs.readFileSync(path.join(root, "package.json"));
  const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.command, "npm update chalk --package-lock-only --ignore-scripts --no-audit --no-fund");
  assert.equal(r.json.failed, false);
  assert.deepEqual(r.json.changed.map((c) => [c.package, c.from, c.to]), [["chalk", "4.1.0", "4.1.2"], ["is-number", "6.0.0", "7.0.0"]]);
  assert.deepEqual(r.json.rangeRaised, [], "in range: the manifest stays as it is");
  assert.ok(fs.readFileSync(path.join(root, "package.json")).equals(manifest));
  assert.deepEqual(r.json.unpicked.map((u) => u.package), ["is-number"], "a package that moved without being picked");
  assert.deepEqual(r.json.offTarget, []);
});

test("apply raises an out-of-range pick's range and a pin in the manifest that declares it, one literal each", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["is-number", "left-pad"], {
    npm: npmRules([{ has: ["update"], writes: [{ file: "package-lock.json", bump: { "node_modules/is-number": "7.0.0", "node_modules/left-pad": "1.3.0" } }] }]),
  });
  const app = fs.readFileSync(path.join(root, "packages/app/package.json"), "utf8");
  const top = fs.readFileSync(path.join(root, "package.json"), "utf8");
  for (const b of batches) {
    runStubbed(["backup", "--run", run, "--batch", b.id], bin);
    const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
    assert.equal(r.code, 0, r.stderr);
    assert.equal(r.json.rangeRaised.length, 1);
  }
  assert.equal(fs.readFileSync(path.join(root, "packages/app/package.json"), "utf8"), app.replace('"is-number": "^6.0.0"', '"is-number": "^7.0.0"'));
  assert.equal(fs.readFileSync(path.join(root, "package.json"), "utf8"), top.replace('"left-pad": "1.1.0"', '"left-pad": "1.3.0"'), "the override is never touched");
});

test("apply refuses a batch with no backup (exit 5) and reports a pick that never landed", () => {
  const { run, bin, batches } = planned(project(), ["chalk"], { npm: npmRules([{ has: ["update"], text: "up to date\n" }]) });
  const refused = runStubbed(["apply", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(refused.code, 5);
  assert.equal(refused.json.error, "no-backup");
  runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", batches[0].id], bin);
  assert.deepEqual(r.json.changed, []);
  assert.deepEqual(r.json.offTarget, [{ id: "package-lock.json#chalk", package: "chalk", target: "4.1.2", now: [] }]);
});

test("backup then restore --verify puts an untracked CRLF lockfile and a tracked one back byte for byte", () => {
  const root = project({
    "web/package.json": fs.readFileSync(path.join(NPM, "project", "package.json"), "utf8"),
    "web/package-lock.json": fs.readFileSync(path.join(NPM, "project", "package-lock.json"), "utf8"),
  });
  // The root lockfile is untracked and written with CRLF, as some Windows tools leave one: put back exactly as found.
  const lockPath = path.join(root, "package-lock.json");
  fs.writeFileSync(lockPath, fs.readFileSync(lockPath, "utf8").replace(/\n/g, "\r\n"));
  const bin = stubPath({
    npm: npmRules([{ has: ["update"], writes: [{ file: "package-lock.json", copy: path.join(NPM, "lock-after-update-chalk.json") }] }]),
    git: gitRules(root, { tracked: ["web/package-lock.json"] }),
  });
  const d = runStubbed(["detect", "--root", root], bin);
  assert.deepEqual(d.json.lockfiles.map((l) => [l.lockfile, l.tracked]), [["package-lock.json", false], ["web/package-lock.json", true]]);
  const run = d.json.run;
  runStubbed(["scan", "--run", run, "--no-audit"], bin);
  const records = path.join(run, "records.json");
  fs.writeFileSync(records, "[]");
  runStubbed(["label", "--run", run, "--records", records], bin);
  const plannedBoth = runStubbed(["batches", "--run", run, "--picks", "package-lock.json#chalk,web/package-lock.json#chalk"], bin);
  assert.equal(plannedBoth.json.batches.length, 2);
  for (const b of plannedBoth.json.batches) {
    const dir = path.posix.dirname(b.lockfile);
    const entry = d.json.lockfiles.find((l) => l.lockfile === b.lockfile);
    const files = [b.lockfile, ...entry.members.map((m) => (m === "." ? "package.json" : `${m}/package.json`))];
    const before = bytesOf(root, files);
    const backed = runStubbed(["backup", "--run", run, "--batch", b.id], bin);
    assert.deepEqual(backed.json.files, files);
    const applied = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
    assert.ok(applied.json.changed.some((c) => c.package === "chalk"), b.lockfile);
    assert.ok(!fs.readFileSync(path.join(root, b.lockfile)).equals(before[b.lockfile]), "the batch changed the lockfile");
    const r = runStubbed(["restore", "--run", run, "--batch", b.id, "--verify"], bin);
    assert.equal(r.code, 0, r.stderr);
    assert.deepEqual(r.json.restored, files);
    assert.equal(r.json.verified, true);
    assert.deepEqual(r.json.mismatched, []);
    assert.deepEqual(r.json.reinstall, { cmd: "npm", args: ["ci"], cwd: dir, command: "npm ci" });
    for (const f of files) assert.ok(fs.readFileSync(path.join(root, f)).equals(before[f]), `${f} byte for byte`);
  }
});

test("restore without --verify leaves verified null; a batch never backed up exits 3", () => {
  const { run, bin, batches } = planned(project(), ["chalk"], { npm: npmRules() });
  assert.equal(runStubbed(["restore", "--run", run, "--batch", batches[0].id], bin).json.error, "backup-missing");
  runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(runStubbed(["restore", "--run", run, "--batch", batches[0].id], bin).json.verified, null);
  assert.equal(runStubbed(["apply", "--run", run, "--batch", "b9"], bin).json.error, "unknown-batch");
});

test("restore removes a file the batch made that was not there before", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["chalk"], { npm: npmRules() });
  fs.rmSync(path.join(root, "packages/app/package.json"));
  const backed = runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  assert.deepEqual(backed.json.missing, ["packages/app/package.json"]);
  write(root, "packages/app/package.json", "{}");
  const r = runStubbed(["restore", "--run", run, "--batch", batches[0].id, "--verify"], bin);
  assert.deepEqual(r.json.deleted, ["packages/app/package.json"]);
  assert.equal(r.json.verified, true);
  assert.ok(!fs.existsSync(path.join(root, "packages/app/package.json")));
});

/* ------------------------------------------------- final review fixes */

test("scan without node_modules reads current from the lockfile; a package the lockfile lacks is not scanned", () => {
  const file = outdatedWith((o) => {
    delete o.chalk.current;
    o.ghost = { wanted: "1.0.0", latest: "1.0.0", dependent: "fixture", type: "dependencies" };
  });
  const { scan } = detectAndScan(project(), { npm: npmRules([{ has: ["outdated"], out: file, code: 1 }]) }, ["--no-audit"]);
  const lock = scan.lockfiles[0];
  const chalk = lock.rows.find((r) => r.package === "chalk");
  assert.equal(chalk.current, "4.1.0", "the lockfile's version");
  assert.equal(chalk.target, "4.1.2", "the runtime cut still applies");
  const ghost = lock.notScanned.find((n) => n.package === "ghost");
  assert.ok(ghost, "a package with no current version anywhere is listed, not offered");
  assert.match(ghost.reason, /run the install, then scan again/);
  assert.ok(!lock.rows.some((r) => r.package === "ghost"));
});

test("scan: a failed npm audit marks every row not audited, so none is Safe", () => {
  const { scan } = detectAndScan(project(), { npm: npmRules([{ has: ["audit"], text: "", code: 1 }]) });
  const lock = scan.lockfiles[0];
  assert.equal(lock.audited, false);
  assert.match(lock.auditNote, /^not checked for vulnerabilities/);
  assert.ok(lock.rows.length && lock.rows.every((r) => r.notAudited === true));
  for (const l of deps.label(scan, [])) {
    assert.notEqual(l.label, "safe", l.id);
    assert.ok(l.reasons.includes("not checked for vulnerabilities"), l.id);
  }
});

test("apply fails a batch whose pick, held below latest for the runtime, went past its target", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["chalk"], {
    npm: npmRules([{ has: ["update", "chalk"], writes: [{ file: "package-lock.json", bump: { "node_modules/chalk": "5.0.0" } }] }]),
  });
  const b = batchFor(batches, "chalk");
  runStubbed(["backup", "--run", run, "--batch", b.id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.failed, true);
  assert.deepEqual(r.json.overshot.map((o) => [o.package, o.target, o.now]), [["chalk", "4.1.2", ["5.0.0"]]]);
  assert.match(r.json.overshot[0].reason, /runtime/);
});

test("apply: a pick with no runtime cut that lands off target is reported, not failed", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["left-pad"], {
    npm: npmRules([{ has: ["update", "left-pad"], writes: [{ file: "package-lock.json", bump: { "node_modules/left-pad": "1.2.0" } }] }]),
  });
  const b = batchFor(batches, "left-pad");
  runStubbed(["backup", "--run", run, "--batch", b.id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
  assert.equal(r.json.failed, false);
  assert.deepEqual(r.json.overshot, []);
  assert.deepEqual(r.json.offTarget.map((o) => o.package), ["left-pad"]);
});

test("restore names a file it cannot put back with its reason and verified false, never a crash", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["chalk"], { npm: npmRules() });
  runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  // A folder where the lockfile was: no copy can land there, on any platform or user.
  const lockPath = path.join(root, "package-lock.json");
  fs.rmSync(lockPath);
  fs.mkdirSync(lockPath);
  fs.writeFileSync(path.join(lockPath, "keep"), "x");
  const r = runStubbed(["restore", "--run", run, "--batch", batches[0].id, "--verify"], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.ok, true);
  assert.equal(r.json.verified, false);
  assert.equal(r.json.mismatched.length, 1);
  assert.equal(r.json.mismatched[0].path, "package-lock.json");
  assert.ok(r.json.mismatched[0].reason, "the OS's reason");
  assert.ok(!r.json.restored.includes("package-lock.json"));
  assert.ok(fs.existsSync(path.join(run, "backups", batches[0].id, "files", "package-lock.json")), "the as-found copy is kept");
  // Even without --verify, a file that could not be put back is never a silent success.
  const again = runStubbed(["restore", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(again.json.verified, false);
});

/* ------------------------------------------------- review fixes */

/** The recorded outdated JSON with `change` applied, saved for a stub to print. */
function outdatedWith(change) {
  const json = JSON.parse(fs.readFileSync(path.join(NPM, "outdated.json"), "utf8"));
  change(json);
  const file = path.join(tmp("deps-outdated"), "outdated.json");
  fs.writeFileSync(file, JSON.stringify(json));
  return file;
}

test("scan: a prerelease ahead of the latest release is never offered as a downgrade", () => {
  const file = outdatedWith((o) => {
    o.chalk = { ...o.chalk, current: "7.0.0-beta.1", wanted: "7.0.0-beta.1", latest: "6.0.1" };
  });
  const plan = { npm: npmRules([{ has: ["outdated"], out: file, code: 1 }, { has: ["view", "chalk@>"], text: "" }]) };
  const lock = detectAndScan(project(), plan, ["--no-audit"]).scan.lockfiles[0];
  assert.ok(!lock.rows.some((r) => r.package === "chalk"), "no chalk row");
  assert.ok(lock.rows.some((r) => r.package === "semver"), "the rest still scanned");
});

test("overrideNames reads scoped, nested and Yarn path keys, holding a nested key's parent only with a dot entry", () => {
  const names = (obj) => [...deps.overrideNames(obj)].sort();
  assert.deepEqual(names({ foo: "1", "bar@2": "3", "@scope/baz@^2": "4" }), ["@scope/baz", "bar", "foo"]);
  assert.deepEqual(names({ "**/@types/react": "18", "react-scripts/@babel/core": "7", "**/left-pad": "1" }), ["@babel/core", "@types/react", "left-pad"]);
  assert.deepEqual(names({ "parent>@scope/foo": "1", "a>b": "2" }), ["@scope/foo", "b"]);
  assert.deepEqual(names({ baz: { bar: "1" } }), ["bar"], "only bar is overridden under baz");
  assert.deepEqual(names({ baz: { ".": "2", bar: "1" } }), ["bar", "baz"], "a dot entry overrides baz itself");
});

test("scan: an advisory the target clears badges the row, one it does not stays open beside it", () => {
  const file = auditWith((v) => {
    v.semver.via.push({ source: 2, name: "semver", url: "https://github.com/advisories/GHSA-test-semv-0000", severity: "moderate", range: "<8.0.0" });
  });
  const lock = detectAndScan(project(), { npm: npmRules([{ has: ["audit"], out: file, code: 1 }]) }).scan.lockfiles[0];
  const semver = lock.rows.find((r) => r.package === "semver");
  assert.deepEqual(semver.security, { severity: "high", ids: ["GHSA-c2qf-rxjj-qqgw"] });
  assert.deepEqual(lock.stillOpen, [{ package: "semver", severity: "moderate", ids: ["GHSA-test-semv-0000"], reason: "7.8.6 is still affected" }]);
});

test("apply in a pnpm workspace updates every member: --recursive, never --force", () => {
  const root = tmp("deps-pnpm-ws");
  write(root, "package.json", JSON.stringify({ name: "w", engines: { node: ">=12" }, dependencies: { chalk: "^4.1.0" } }));
  write(root, "pnpm-lock.yaml", "lockfileVersion: '9.0'\n\npackages:\n\n  chalk@4.1.0:\n    resolution: {integrity: x}\n");
  write(root, "pnpm-workspace.yaml", "packages:\n  - 'packages/*'\n");
  write(root, "packages/app/package.json", JSON.stringify({ name: "app", dependencies: { "is-number": "^6.0.0" } }));
  const plan = {
    npm: npmRules().filter((r) => r.has[0] === "view"),
    pnpm: [
      { has: ["outdated"], out: fx("pnpm-docs", "outdated.json"), code: 1 },
      { has: ["update"], text: "" },
    ],
  };
  const { run, bin } = detectAndScan(root, plan, ["--no-audit"]);
  const records = path.join(run, "records.json");
  fs.writeFileSync(records, "[]");
  runStubbed(["label", "--run", run, "--records", records], bin);
  const b = runStubbed(["batches", "--run", run, "--picks", "pnpm-lock.yaml#chalk"], bin).json.batches[0];
  runStubbed(["backup", "--run", run, "--batch", b.id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.command, "pnpm update chalk@4.1.2 --lockfile-only --no-save --recursive");
  const update = callsOf(bin).find((c) => c.tool === "pnpm" && c.args[0] === "update");
  assert.deepEqual(update.args, ["update", "chalk@4.1.2", "--lockfile-only", "--no-save", "--recursive"]);
});

test("a package two members declare is pinned when either pins it, and apply raises each declaration that needs it", () => {
  const root = project();
  // The member pins chalk where the root takes a caret range.
  const appFile = path.join(root, "packages/app/package.json");
  const app = JSON.parse(fs.readFileSync(appFile, "utf8"));
  app.dependencies.chalk = "4.1.0";
  fs.writeFileSync(appFile, JSON.stringify(app, null, 2) + "\n");
  const file = outdatedWith((o) => {
    o.chalk = [o.chalk, { ...o.chalk, wanted: "4.1.0", dependent: "app", dependedByLocation: "packages/app" }];
  });
  const plan = { npm: npmRules([{ has: ["outdated"], out: file, code: 1 }, { has: ["update"], writes: [{ file: "package-lock.json", bump: { "node_modules/chalk": "4.1.2" } }] }]) };
  const { run, bin, scan } = detectAndScan(root, plan, ["--no-audit"]);
  const chalk = scan.lockfiles[0].rows.find((r) => r.package === "chalk");
  assert.deepEqual(chalk.declaredIn, [{ file: "package.json", range: "^4.1.0" }, { file: "packages/app/package.json", range: "4.1.0" }]);
  assert.equal(chalk.pinned, true);
  assert.equal(chalk.inRange, false);
  const records = path.join(run, "records.json");
  fs.writeFileSync(records, "[]");
  runStubbed(["label", "--run", run, "--records", records], bin);
  const b = runStubbed(["batches", "--run", run, "--picks", "package-lock.json#chalk"], bin).json.batches[0];
  const top = fs.readFileSync(path.join(root, "package.json"));
  runStubbed(["backup", "--run", run, "--batch", b.id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.rangeRaised, [{ id: "package-lock.json#chalk", package: "chalk", file: "packages/app/package.json", from: "4.1.0", to: "4.1.2" }]);
  assert.ok(fs.readFileSync(path.join(root, "package.json")).equals(top), "the root's ^4.1.0 already takes 4.1.2 and stays");
  assert.match(fs.readFileSync(appFile, "utf8"), /"chalk": "4\.1\.2"/);
});

test("detect through a linked root still finds the already-changed lockfile", () => {
  const root = project();
  const link = path.join(tmp("deps-link"), "linked");
  fs.symlinkSync(root, link, process.platform === "win32" ? "junction" : "dir");
  const bin = stubPath({ npm: npmRules(), git: gitRules(root, { status: [" M package-lock.json", " M src/x.js"] }) });
  const r = runStubbed(["detect", "--root", link], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.lockfiles[0].dirty, ["package-lock.json"]);
  assert.equal(r.json.unrelatedChanges, 1);
});

test("apply skips a pick one declaration cannot take before raising any other declaration", () => {
  const root = project();
  // The member takes chalk as "latest", which no range can be raised from; the root pins it.
  const appFile = path.join(root, "packages/app/package.json");
  const app = JSON.parse(fs.readFileSync(appFile, "utf8"));
  app.dependencies.chalk = "latest";
  fs.writeFileSync(appFile, JSON.stringify(app, null, 2) + "\n");
  const topFile = path.join(root, "package.json");
  const top = JSON.parse(fs.readFileSync(topFile, "utf8"));
  top.dependencies.chalk = "4.1.0";
  fs.writeFileSync(topFile, JSON.stringify(top, null, 2) + "\n");
  const file = outdatedWith((o) => {
    o.chalk = [o.chalk, { ...o.chalk, dependent: "app", dependedByLocation: "packages/app" }];
  });
  const plan = { npm: npmRules([{ has: ["outdated"], out: file, code: 1 }, { has: ["update"], writes: [{ file: "package-lock.json", bump: { "node_modules/chalk": "4.1.2" } }] }]) };
  const { run, bin, scan } = detectAndScan(root, plan, ["--no-audit"]);
  const chalk = scan.lockfiles[0].rows.find((r) => r.package === "chalk");
  assert.deepEqual(chalk.declaredIn.map((d) => d.range), ["4.1.0", "latest"]);
  const records = path.join(run, "records.json");
  fs.writeFileSync(records, "[]");
  runStubbed(["label", "--run", run, "--records", records], bin);
  const b = runStubbed(["batches", "--run", run, "--picks", "package-lock.json#chalk"], bin).json.batches[0];
  const before = bytesOf(root, ["package.json", "packages/app/package.json", "package-lock.json"]);
  runStubbed(["backup", "--run", run, "--batch", b.id], bin);
  const updatesBefore = callsOf(bin).filter((c) => c.tool === "npm" && c.args[0] === "update").length;
  const r = runStubbed(["apply", "--run", run, "--batch", b.id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.skipped.map((s) => [s.id, s.file]), [["package-lock.json#chalk", "packages/app/package.json"]]);
  assert.deepEqual(r.json.rangeRaised, [], "the root's pin is not raised when the member cannot follow");
  assert.deepEqual(r.json.changed, []);
  assert.equal(r.json.command, null, "no command is reported when nothing ran");
  assert.equal(r.json.exit, null);
  assert.equal(r.json.cwd, null);
  assert.equal(r.json.failed, false);
  assert.deepEqual(r.json.undoFailed, []);
  assert.deepEqual(r.json.offTarget.map((o) => [o.id, o.now]), [["package-lock.json#chalk", []]], "a skipped pick did not land");
  assert.equal(callsOf(bin).filter((c) => c.tool === "npm" && c.args[0] === "update").length, updatesBefore, "no update ran");
  for (const [rel, bytes] of Object.entries(before)) assert.ok(fs.readFileSync(path.join(root, rel)).equals(bytes), rel);
});

test("backup refuses a batch that already has one (exit 5), keeping the as-found copy", () => {
  const root = project();
  const { run, bin, batches } = planned(root, ["chalk"], { npm: npmRules() });
  const b = batches[0];
  assert.equal(runStubbed(["backup", "--run", run, "--batch", b.id], bin).code, 0);
  const lock = fs.readFileSync(path.join(root, "package-lock.json"));
  write(root, "package-lock.json", "{}\n");
  const again = runStubbed(["backup", "--run", run, "--batch", b.id], bin);
  assert.equal(again.code, 5);
  assert.equal(again.json.error, "backup-exists");
  const r = runStubbed(["restore", "--run", run, "--batch", b.id, "--verify"], bin);
  assert.equal(r.json.verified, true);
  assert.ok(fs.readFileSync(path.join(root, "package-lock.json")).equals(lock), "the first backup put back");
});

test("installCommand is a frozen install for every npm-family manager", () => {
  const npmFamily = deps.ADAPTERS.find((a) => a.id === "npm");
  const line = (entry) => {
    const c = npmFamily.installCommand({ lockfile: "x/lock", members: ["x"], ...entry }, "/r");
    return [c.cmd, ...c.args].join(" ");
  };
  assert.equal(line({ manager: "npm" }), "npm ci");
  assert.equal(line({ manager: "pnpm" }), "pnpm install --frozen-lockfile");
  assert.equal(line({ manager: "yarn" }), "yarn install --frozen-lockfile");
  assert.equal(line({ manager: "yarn", berry: true }), "yarn install --immutable");
});

/* ------------------------------------------------- Cargo, pip and uv: stubs on PATH */

// Recorded with cargo 1.99.1, pip 26.3 (Python 3.13.17) and uv 0.13.7 from
// scratch projects: Cargo with itoa and hex behind in range and bitflags and
// cfg-if behind out of range (plus a two-member workspace for metadata); pip
// with five == pins; uv with requests and urllib3 under capped ranges.
// cargo-outdated, cargo-audit and pip-audit are never installed (NFR-1), so
// their *-docs.json files follow the shapes their source prints, with the
// recorded packages and versions.
const CARGO = fx("cargo-1.99.1");
const PIP = fx("pip-26.3");
const UV = fx("uv-0.13.7");

/** A recorded project folder copied into a temp folder, extra files on top. */
function copyFrom(src, extra = {}) {
  const dir = tmp("deps-eco");
  fs.cpSync(src, dir, { recursive: true });
  for (const [rel, content] of Object.entries(extra)) write(dir, rel, content);
  return dir;
}

const cargoRules = (over = []) => [
  ...over,
  { has: ["metadata"], out: path.join(CARGO, "metadata.json") },
  { has: ["outdated"], out: path.join(CARGO, "outdated-docs.json") },
  { has: ["audit"], out: path.join(CARGO, "audit-docs.json"), code: 1 },
  { has: ["update", "--dry-run"], err: path.join(CARGO, "dry-run.txt") },
  { has: ["update", "-p"], text: "" },
];
const rustcRules = [{ has: ["--version"], out: path.join(CARGO, "rustc-version.txt") }];
const pythonRules = [{ has: ["--version"], out: path.join(PIP, "python-version.txt") }];
const pipRules = (over = []) => [...over, { has: ["list", "--outdated"], out: path.join(PIP, "outdated.json") }, { has: ["freeze"], out: path.join(PIP, "freeze.txt") }, { has: ["install"], text: "" }, { has: ["uninstall"], text: "" }];
const uvRules = (over = []) => [...over, { has: ["tree", "--outdated"], out: path.join(UV, "tree-outdated.txt") }, { has: ["audit"], out: path.join(UV, "audit.json"), code: 1 }];

/** Text saved to a temp file, for a stub rule to print. */
function textFile(text) {
  const file = path.join(tmp("deps-out"), "out.txt");
  fs.writeFileSync(file, text);
  return file;
}

const rowsOf = (lock) => Object.fromEntries(lock.rows.map((r) => [r.package, r]));

test("Cargo detect: the lockfile with its Cargo.toml, workspace members from cargo metadata, and cargo fetch --locked", () => {
  const single = runStubbed(["detect", "--root", copyFrom(path.join(CARGO, "project"))], stubPath({ cargo: cargoRules(), rustc: rustcRules }));
  assert.equal(single.code, 0, single.stderr);
  assert.deepEqual(single.json.lockfiles.map((l) => [l.lockfile, l.manifest, l.manager, l.members, l.install]), [["Cargo.lock", "Cargo.toml", "cargo", ["."], "cargo fetch --locked"]]);
  assert.equal(single.json.lockfiles[0].updates, null, "no cargo-outdated, no quick count");

  const ws = runStubbed(["detect", "--root", copyFrom(path.join(CARGO, "workspace"))], stubPath({ cargo: cargoRules([{ has: ["metadata"], out: path.join(CARGO, "metadata-workspace.json") }]) }));
  assert.equal(ws.code, 0, ws.stderr);
  assert.deepEqual(ws.json.lockfiles[0].members, [".", "crates/a", "crates/b"]);

  const none = runStubbed(["detect", "--root", copyFrom(path.join(CARGO, "project"))], stubPath({ git: [{ has: ["rev-parse"], code: 128 }] }));
  assert.deepEqual(none.json.missingTools, [{ tool: "cargo", lockfiles: ["Cargo.lock"] }]);
  assert.deepEqual(none.json.lockfiles[0].members, ["."], "without cargo the lockfile's own folder is its one member");
});

test("Cargo scan without cargo-outdated or cargo-audit: the dry run gives rows, each plugin is named once with its install line, every row is not audited", () => {
  const { scanRun, scan, bin } = detectAndScan(copyFrom(path.join(CARGO, "project")), { cargo: cargoRules(), rustc: rustcRules });
  assert.equal(scanRun.code, 0, scanRun.stderr);
  assert.deepEqual(scan.missingTools, [
    { tool: "cargo-outdated", step: "outdated", install: "cargo install cargo-outdated" },
    { tool: "cargo-audit", step: "audit", install: "cargo install cargo-audit" },
  ]);
  const lock = scan.lockfiles[0];
  assert.deepEqual(lock.runtime, { declared: null, source: "machine", machine: "1.99.1" });
  assert.equal(lock.audited, false);
  assert.match(lock.auditNote, /cargo-audit is not installed/);
  const rows = rowsOf(lock);
  assert.deepEqual(Object.keys(rows), ["bitflags", "cfg-if", "hex", "itoa"]);
  assert.deepEqual([rows.itoa.current, rows.itoa.target, rows.itoa.jump, rows.itoa.inRange], ["1.0.9", "1.0.19", "patch", true]);
  assert.deepEqual(rows.itoa.range, { from: "1.0", to: "1.0" });
  assert.deepEqual(rows.itoa.declaredIn, [{ file: "Cargo.toml", range: "1.0" }]);
  assert.deepEqual([rows.bitflags.target, rows.bitflags.jump, rows.bitflags.inRange], ["2.13.2", "major", false]);
  assert.deepEqual(rows.bitflags.range, { from: "1", to: "2" });
  assert.deepEqual([rows["cfg-if"].target, rows["cfg-if"].jump], ["1.0.5", "major"]);
  assert.deepEqual([rows.hex.target, rows.hex.inRange], ["0.4.3", true]);
  assert.ok(lock.rows.every((r) => r.notAudited === true && !r.couldNotRead));
  const calls = callsOf(bin).filter((c) => c.tool === "cargo").map((c) => c.args.join(" "));
  assert.ok(calls.includes("update --dry-run --verbose"));
  assert.ok(!calls.some((c) => /^(outdated|audit)/.test(c)), "a plugin that is not installed is never called");
});

test("Cargo dry run: a line it cannot read flags the row it names, or every row when it names none", () => {
  const dry = fs.readFileSync(path.join(CARGO, "dry-run.txt"), "utf8");
  const named = detectAndScan(copyFrom(path.join(CARGO, "project")), { cargo: cargoRules([{ has: ["update", "--dry-run"], err: textFile(`${dry}  Repinning itoa v1.0.9 => v1.0.20\n`) }]), rustc: rustcRules }, ["--no-audit"]);
  const rows = rowsOf(named.scan.lockfiles[0]);
  assert.equal(rows.itoa.couldNotRead, "cargo update --dry-run");
  assert.equal(rows.hex.couldNotRead, undefined);
  const nameless = detectAndScan(copyFrom(path.join(CARGO, "project")), { cargo: cargoRules([{ has: ["update", "--dry-run"], err: textFile(`${dry}   Something new happened here\n`) }]), rustc: rustcRules }, ["--no-audit"]);
  assert.ok(nameless.scan.lockfiles[0].rows.every((r) => r.couldNotRead === "cargo update --dry-run"));
  assert.ok(deps.label(nameless.scan, []).every((l) => l.label !== "safe"));
});

test("Cargo scan with cargo-outdated and cargo-audit: rows from its JSON, a fixed advisory badges the row, nothing missing", () => {
  const { scanRun, scan, bin } = detectAndScan(copyFrom(path.join(CARGO, "project")), { cargo: cargoRules(), rustc: rustcRules, "cargo-outdated": [], "cargo-audit": [] });
  assert.equal(scanRun.code, 0, scanRun.stderr);
  assert.deepEqual(scan.missingTools, []);
  const lock = scan.lockfiles[0];
  assert.equal(lock.audited, true);
  const rows = rowsOf(lock);
  assert.deepEqual(Object.keys(rows).sort(), ["bitflags", "cfg-if", "hex", "itoa"]);
  assert.equal(rows.itoa.inRange, true, "compat equal to latest is the tool's own in-range answer");
  assert.equal(rows.bitflags.inRange, false);
  assert.deepEqual(rows.itoa.security.ids, ["RUSTSEC-2099-0001"], "1.0.19 is in the patched range >=1.0.11");
  assert.equal(lock.rows[0].package, "itoa", "vulnerability fixes lead");
  assert.ok(lock.rows.every((r) => !r.notAudited));
  assert.deepEqual(lock.stillOpen, []);
  const calls = callsOf(bin).filter((c) => c.tool === "cargo").map((c) => c.args.join(" "));
  assert.ok(calls.includes("outdated --format json --root-deps-only"));
  assert.ok(calls.includes("audit --json"));
  assert.ok(!calls.some((c) => c.includes("--dry-run")), "no dry run when cargo outdated answers");
});

test("Cargo: a crate a [patch] section replaces is held, naming Cargo.toml", () => {
  const root = copyFrom(path.join(CARGO, "project"));
  fs.appendFileSync(path.join(root, "Cargo.toml"), '\n[patch.crates-io]\nitoa = { path = "../itoa" }\n');
  const { scan } = detectAndScan(root, { cargo: cargoRules(), rustc: rustcRules }, ["--no-audit"]);
  const lock = scan.lockfiles[0];
  assert.ok(!lock.rows.some((r) => r.package === "itoa"));
  assert.deepEqual(lock.held.map((h) => [h.package, h.reason, h.file]), [["itoa", "held by [patch] in Cargo.toml", "Cargo.toml"]]);
  assert.deepEqual(deps.cargoPatched('[patch.crates-io]\nserde = "1"\n[patch.crates-io.tokio]\ngit = "x"\n[dependencies]\nrand = "1"\n'), ["serde", "tokio"]);
});

/** detect, scan, label and plan batches for row ids, on any ecosystem's project. */
function plannedIds(root, ids, plan) {
  const { run, bin } = detectAndScan(root, plan, ["--no-audit"]);
  const records = path.join(run, "records.json");
  fs.writeFileSync(records, "[]");
  assert.equal(runStubbed(["label", "--run", run, "--records", records], bin).code, 0);
  const b = runStubbed(["batches", "--run", run, "--picks", ids.join(",")], bin);
  assert.equal(b.code, 0, b.stderr);
  return { run, bin, batches: b.json.batches };
}

test("Cargo apply: an out-of-range pick raises Cargo.toml, then cargo update -p --precise, one command per pick", () => {
  const root = copyFrom(path.join(CARGO, "project"));
  const { run, bin, batches } = plannedIds(root, ["Cargo.lock#bitflags", "Cargo.lock#itoa"], {
    cargo: cargoRules([{ has: ["update", "-p", "itoa"], writes: [{ file: "Cargo.lock", copy: path.join(CARGO, "lock-after-update-itoa.lock") }] }]),
    rustc: rustcRules,
  });
  const before = fs.readFileSync(path.join(root, "Cargo.toml"), "utf8");
  const results = {};
  for (const b of batches) {
    assert.equal(runStubbed(["backup", "--run", run, "--batch", b.id], bin).code, 0);
    results[b.picks[0]] = runStubbed(["apply", "--run", run, "--batch", b.id], bin).json;
  }
  const bitflags = results["Cargo.lock#bitflags"];
  assert.equal(bitflags.command, "cargo update -p bitflags@1.3.2 --precise 2.13.2", "the locked version names it, in case the lockfile holds two");
  assert.deepEqual(bitflags.rangeRaised.map((r) => [r.file, r.from, r.to]), [["Cargo.toml", "1", "2"]]);
  assert.equal(fs.readFileSync(path.join(root, "Cargo.toml"), "utf8"), before.replace('bitflags = "1"', 'bitflags = "2"'));
  const itoa = results["Cargo.lock#itoa"];
  assert.equal(itoa.command, "cargo update -p itoa@1.0.9 --precise 1.0.19");
  assert.deepEqual(itoa.rangeRaised, [], "in range: Cargo.toml stays as it is");
  assert.deepEqual(itoa.changed.map((c) => [c.package, c.from, c.to]), [["itoa", "1.0.9", "1.0.15"]]);
  const adapter = deps.ADAPTERS.find((a) => a.id === "cargo");
  const entry = { lockfile: "Cargo.lock", members: ["."] };
  const calls = adapter.applyCommand({ rows: [{ package: "itoa", current: "1.0.9", target: "1.0.19" }, { package: "hex", current: "0.4.2", target: "0.4.3" }] }, entry, root);
  assert.deepEqual(calls.map((c) => [c.cmd, ...c.args].join(" ")), ["cargo update -p itoa@1.0.9 --precise 1.0.19", "cargo update -p hex@0.4.2 --precise 0.4.3"]);
  assert.deepEqual(adapter.files({ lockfile: "Cargo.lock", members: [".", "crates/a"] }), ["Cargo.lock", "Cargo.toml", "crates/a/Cargo.toml"]);
});

test("pip detect: a requirements file pinning every line is the lockfile, constraints beside it or named by -c are held, loose requirements list as noLockfile", () => {
  const root = copyFrom(path.join(PIP), {
    "constraints.txt": "idna<4\n",
    "requirements-dev.txt": "pytest>=8\n",
    "tools/requirements.txt": "-c ../shared/limits.txt\nblack==24.1.0\n",
    "shared/limits.txt": "black<25\n",
  });
  const r = runStubbed(["detect", "--root", root], stubPath({ pip: pipRules(), python: pythonRules }));
  assert.equal(r.code, 0, r.stderr);
  const byLock = Object.fromEntries(r.json.lockfiles.map((l) => [l.lockfile, l]));
  assert.deepEqual(Object.keys(byLock).sort(), ["requirements.txt", "tools/requirements.txt"]);
  assert.deepEqual(byLock["requirements.txt"].constraints, ["constraints.txt"]);
  assert.deepEqual(byLock["tools/requirements.txt"].constraints, ["shared/limits.txt"]);
  assert.equal(byLock["requirements.txt"].install, "pip install -r requirements.txt");
  assert.equal(byLock["requirements.txt"].updates, 5);
  assert.deepEqual(r.json.noLockfile.map((n) => [n.manifest, n.ecosystem]), [["requirements-dev.txt", "python"]]);
  assert.match(r.json.noLockfile[0].reason, /no lockfile/);
});

test("pip scan: rows for the file's pins only, constraints hold theirs, pip-audit missing marks every row not audited", () => {
  const root = copyFrom(PIP, { "constraints.txt": "idna<4\n" });
  const { scan } = detectAndScan(root, { pip: pipRules(), python: pythonRules });
  const lock = scan.lockfiles[0];
  assert.deepEqual(scan.missingTools, [{ tool: "pip-audit", step: "audit", install: "pip install pip-audit" }]);
  assert.deepEqual(lock.runtime, { declared: null, source: "machine", machine: "3.13.17" });
  const rows = rowsOf(lock);
  assert.deepEqual(Object.keys(rows), ["certifi", "charset-normalizer", "requests", "urllib3"]);
  assert.deepEqual(lock.held.map((h) => [h.package, h.reason]), [["idna", "held by constraints in constraints.txt"]]);
  assert.deepEqual([rows.requests.current, rows.requests.target, rows.requests.jump, rows.requests.pinned], ["2.31.0", "2.34.2", "minor", true]);
  assert.deepEqual(rows.requests.range, { from: "==2.31.0", to: "==2.34.2" });
  assert.equal(rows.urllib3.jump, "major");
  assert.ok(lock.rows.every((r) => r.notAudited === true));
  assert.ok(lock.rows.every((r) => !r.runtimeNotChecked), "no requires-python declared: nothing to check against");
});

test("pip scan with pip-audit: a fix on the target's own release line badges the row", () => {
  const { scan } = detectAndScan(copyFrom(PIP), { pip: pipRules(), python: pythonRules, "pip-audit": [{ has: ["--format", "json"], out: path.join(PIP, "pip-audit-docs.json"), code: 1 }] });
  const lock = scan.lockfiles[0];
  assert.deepEqual(scan.missingTools, []);
  assert.equal(lock.audited, true);
  const rows = rowsOf(lock);
  assert.deepEqual(rows.requests.security.ids, ["GHSA-9wx4-h78v-vm56"]);
  assert.deepEqual(rows.urllib3.security.ids, ["GHSA-34jh-p97f-mpxf"], "2.8.0 is past 2.2.2, the fix on its own major line");
  assert.deepEqual(lock.stillOpen, []);
});

test("pip put-back: backup snapshots pip freeze, restore reinstalls it and uninstalls what the batch added", () => {
  const root = copyFrom(PIP);
  const after = textFile(`${fs.readFileSync(path.join(PIP, "freeze.txt"), "utf8")}six==1.16.0\n`);
  const { run, bin, batches } = plannedIds(root, ["requirements.txt#requests"], {
    pip: pipRules([{ has: ["freeze"], outs: [path.join(PIP, "freeze.txt"), after] }]),
    python: pythonRules,
  });
  const id = batches[0].id;
  const backup = runStubbed(["backup", "--run", run, "--batch", id], bin);
  assert.equal(backup.code, 0, backup.stderr);
  assert.deepEqual(backup.json.snapshot, { ok: true, file: "pip-freeze.txt", packages: 5 });
  const snap = path.join(run, "backups", id, "pip-freeze.txt");
  assert.equal(fs.readFileSync(snap, "utf8"), fs.readFileSync(path.join(PIP, "freeze.txt"), "utf8"));
  const req = fs.readFileSync(path.join(root, "requirements.txt"), "utf8");

  const applied = runStubbed(["apply", "--run", run, "--batch", id], bin);
  assert.equal(applied.json.command, "pip install -r requirements.txt");
  assert.equal(fs.readFileSync(path.join(root, "requirements.txt"), "utf8"), req.replace("requests==2.31.0", "requests==2.34.2"));
  assert.deepEqual(applied.json.changed.map((c) => [c.package, c.from, c.to]), [["requests", "2.31.0", "2.34.2"]]);

  const restored = runStubbed(["restore", "--run", run, "--batch", id, "--verify"], bin);
  assert.equal(restored.code, 0, restored.stderr);
  assert.equal(restored.json.verified, true);
  assert.equal(fs.readFileSync(path.join(root, "requirements.txt"), "utf8"), req);
  assert.deepEqual(restored.json.extra, { ok: true, uninstalled: ["six"] });
  const pip = callsOf(bin).filter((c) => c.tool === "pip").map((c) => c.args);
  const reinstall = pip.findIndex((a) => a[0] === "install" && a[2] && a[2].endsWith("pip-freeze.txt"));
  assert.ok(reinstall !== -1, "pip install -r pip-freeze.txt");
  assert.deepEqual(pip[pip.length - 1], ["uninstall", "-y", "six"], "then the package the batch added goes");
  assert.equal(restored.json.reinstall.command, "pip install -r requirements.txt");
});

test("uv scan: rows from uv tree --outdated with each range, audit fixes badge rows, transitive findings stay open", () => {
  const { scanRun, scan } = detectAndScan(copyFrom(path.join(UV, "project")), { uv: uvRules(), python: pythonRules });
  assert.equal(scanRun.code, 0, scanRun.stderr);
  const lock = scan.lockfiles[0];
  assert.deepEqual([lock.lockfile, lock.manager, lock.install], ["uv.lock", "uv", "uv sync --frozen"]);
  assert.equal(lock.audited, true);
  const rows = rowsOf(lock);
  assert.deepEqual(Object.keys(rows).sort(), ["requests", "urllib3"]);
  assert.deepEqual([rows.requests.current, rows.requests.target, rows.requests.inRange], ["2.31.0", "2.34.2", true]);
  assert.deepEqual(rows.requests.range, { from: ">=2.31,<3", to: ">=2.31,<3" });
  assert.deepEqual([rows.urllib3.target, rows.urllib3.inRange], ["2.8.0", false]);
  assert.deepEqual(rows.urllib3.range, { from: ">=1.26,<2", to: null }, "a compound range is never rewritten");
  assert.ok(rows.requests.security.ids.length > 0);
  assert.deepEqual([...new Set(lock.stillOpen.map((s) => s.package))].sort(), ["certifi", "idna"]);
  assert.ok(lock.stillOpen.every((s) => s.reason === "no upgrade on the list pulls it in"));
  const adapter = deps.ADAPTERS.find((a) => a.id === "uv");
  const call = adapter.applyCommand({ rows: [{ package: "requests", target: "2.34.2" }] }, { lockfile: "uv.lock", members: ["."] }, "/p");
  assert.deepEqual([call.cmd, ...call.args], ["uv", "lock", "--upgrade-package", "requests==2.34.2"]);
});

test("uv: an audit in a shape it does not know sets couldNotRead on the audit only; an unreadable tree line flags its row", () => {
  const shape = detectAndScan(copyFrom(path.join(UV, "project")), { uv: uvRules([{ has: ["audit"], text: '{"schema":{"version":"2"},"findings":[]}', code: 0 }]), python: pythonRules });
  const lock = shape.scan.lockfiles[0];
  assert.equal(lock.audited, false);
  assert.equal(lock.auditCouldNotRead, "uv audit");
  assert.match(lock.auditNote, /could not read uv audit output/);
  assert.ok(lock.rows.length === 2 && lock.rows.every((r) => r.notAudited === true && !r.couldNotRead), "the rows' versions were read; only the audit was not");

  const tree = `${fs.readFileSync(path.join(UV, "tree-outdated.txt"), "utf8")}└── requests ~ 2.31.0 -> latest 2.34.2\n`;
  const lines = detectAndScan(copyFrom(path.join(UV, "project")), { uv: uvRules([{ has: ["tree"], out: textFile(tree) }]), python: pythonRules }, ["--no-audit"]);
  const rows = rowsOf(lines.scan.lockfiles[0]);
  assert.equal(rows.requests.couldNotRead, "uv tree");
  assert.equal(rows.urllib3.couldNotRead, undefined);
});

test("label: couldNotRead and notAudited rows are Check first with their reasons, never Safe", () => {
  const base = { id: "x", current: "1.0.0", target: "1.0.1", jump: "patch", inRange: true, range: { from: "^1.0.0", to: "^1.0.0" }, pinned: false, security: null };
  const scan = {
    noChecks: false,
    lockfiles: [
      {
        lockfile: "Cargo.lock",
        ecosystem: "cargo",
        checks: { rows: ["App"], discovered: [] },
        rows: [
          { ...base, id: "Cargo.lock#safe" },
          { ...base, id: "Cargo.lock#unread", couldNotRead: "cargo update --dry-run" },
          { ...base, id: "Cargo.lock#unaudited", notAudited: true },
        ],
      },
    ],
  };
  const records = ["safe", "unread", "unaudited"].map((n) => ({ id: `Cargo.lock#${n}`, notes: "read", breaking: [], files: 1, calls: [] }));
  const byId = Object.fromEntries(deps.label(scan, records).map((l) => [l.id, l]));
  assert.equal(byId["Cargo.lock#safe"].label, "safe", "the control row, same in every other way, is Safe");
  assert.equal(byId["Cargo.lock#unread"].label, "check-first");
  assert.ok(byId["Cargo.lock#unread"].reasons.some((r) => /could not read/.test(r)));
  assert.equal(byId["Cargo.lock#unaudited"].label, "check-first");
  assert.ok(byId["Cargo.lock#unaudited"].reasons.includes("not checked for vulnerabilities"));
});

test("Cargo: cargo outdated --workspace lists a crate two members use once, declared in each", () => {
  const root = copyFrom(path.join(CARGO, "workspace"));
  fs.appendFileSync(path.join(root, "crates/b/Cargo.toml"), 'itoa = "1.0"\n');
  const outdated = [
    { crate_name: "a", dependencies: [{ name: "itoa", project: "1.0.9", compat: "1.0.19", latest: "1.0.19", kind: "Normal", platform: null }] },
    { crate_name: "b", dependencies: [{ name: "itoa", project: "1.0.9", compat: "1.0.19", latest: "1.0.19", kind: "Normal", platform: null }] },
  ];
  const { scan, bin } = detectAndScan(root, {
    cargo: cargoRules([{ has: ["metadata"], out: path.join(CARGO, "metadata-workspace.json") }, { has: ["outdated"], out: textFile(outdated.map((o) => JSON.stringify(o)).join("\n") + "\n") }]),
    rustc: rustcRules,
    "cargo-outdated": [],
  }, ["--no-audit"]);
  const itoa = scan.lockfiles[0].rows.filter((r) => r.id === "Cargo.lock#itoa");
  assert.equal(itoa.length, 1, "one row per id");
  assert.deepEqual(itoa[0].declaredIn.map((d) => d.file).sort(), ["crates/a/Cargo.toml", "crates/b/Cargo.toml"]);
  assert.ok(callsOf(bin).some((c) => c.tool === "cargo" && c.args.includes("--workspace")), "a workspace asks for every member");
});

test("pyprojectDeps finds the array's end outside quoted strings, so extras keep every later entry", () => {
  const text = '[project]\ndependencies = [\n  "uvicorn[standard]>=0.30",\n  "PyYAML==6.0.1",\n]\n[dependency-groups]\ndev = ["pytest[cov]>=8", "ruff==0.6.0"]\n';
  assert.deepEqual(deps.pyprojectDeps(text).map((d) => [d.name, d.spec, d.group]), [
    ["uvicorn", ">=0.30", "project"],
    ["PyYAML", "==6.0.1", "project"],
    ["pytest", ">=8", "dev"],
    ["ruff", "==0.6.0", "dev"],
  ]);
});

test("uv: tree and audit run --frozen, so a scan never rewrites uv.lock", () => {
  const { bin } = detectAndScan(copyFrom(path.join(UV, "project")), { uv: uvRules(), python: pythonRules });
  const uv = callsOf(bin).filter((c) => c.tool === "uv");
  assert.ok(uv.length >= 3, "detect's count, the scan's tree and the audit");
  for (const c of uv) assert.ok(c.args.includes("--frozen"), c.args.join(" "));
});

test("uv apply: a pin declared as PyYAML is raised in the file's own spelling while the row keeps uv's name", () => {
  const root = copyFrom(path.join(UV, "project"));
  const py = fs.readFileSync(path.join(root, "pyproject.toml"), "utf8").replace(/dependencies = \[/, 'dependencies = [\n  "PyYAML==6.0.1",');
  fs.writeFileSync(path.join(root, "pyproject.toml"), py);
  const tree = `${fs.readFileSync(path.join(UV, "tree-outdated.txt"), "utf8")}└── pyyaml v6.0.1 (latest: v6.0.2)\n`;
  const { run, bin, batches } = plannedIds(root, ["uv.lock#pyyaml"], { uv: uvRules([{ has: ["tree"], out: textFile(tree) }, { has: ["lock"], text: "" }]), python: pythonRules });
  assert.equal(runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin).code, 0);
  const r = runStubbed(["apply", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.skipped, []);
  assert.deepEqual(r.json.rangeRaised.map((x) => [x.package, x.file, x.from, x.to]), [["pyyaml", "pyproject.toml", "==6.0.1", "==6.0.2"]]);
  assert.equal(r.json.command, "uv lock --upgrade-package pyyaml==6.0.2");
  assert.equal(fs.readFileSync(path.join(root, "pyproject.toml"), "utf8"), py.replace('"PyYAML==6.0.1"', '"PyYAML==6.0.2"'));
});

test("pip: a requirements file pinned with hashes is list only with its own reason, continuations joined", () => {
  const hashed = "requests==2.32.3 \\\n    --hash=sha256:aaaa \\\n    --hash=sha256:bbbb\nidna==3.7 \\\n    --hash=sha256:cccc\n";
  const lines = deps.requirementLines(hashed).reqs;
  assert.deepEqual(lines.map((q) => [q.name, q.spec, q.hashed, q.line]), [["requests", "==2.32.3", true, 1], ["idna", "==3.7", true, 4]]);
  const root = tmp("deps-hashed");
  write(root, "requirements.txt", hashed);
  const r = runStubbed(["detect", "--root", root], stubPath({ pip: pipRules() }));
  assert.deepEqual(r.json.lockfiles, []);
  assert.deepEqual(r.json.noLockfile, [{ manifest: "requirements.txt", ecosystem: "python", reason: "pinned with hashes: regenerate the file to update it" }]);
});

test("pip apply refuses a batch whose backup has no environment snapshot (exit 5), and moves nothing", () => {
  const root = copyFrom(PIP);
  const { run, bin, batches } = plannedIds(root, ["requirements.txt#requests"], { pip: pipRules([{ has: ["freeze"], code: 1, text: "" }]), python: pythonRules });
  const backup = runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(backup.json.snapshot.ok, false);
  const req = fs.readFileSync(path.join(root, "requirements.txt"), "utf8");
  const r = runStubbed(["apply", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(r.code, 5);
  assert.equal(r.json.error, "no-snapshot");
  assert.equal(fs.readFileSync(path.join(root, "requirements.txt"), "utf8"), req);
  assert.ok(!callsOf(bin).some((c) => c.tool === "pip" && c.args[0] === "install"));
});

test("pip put-back: a failed reinstall of the snapshot is reported with the command to run by hand", () => {
  const root = copyFrom(PIP);
  const { run, bin, batches } = plannedIds(root, ["requirements.txt#requests"], { pip: pipRules([{ has: ["install", "-r", "requirements.txt"], text: "" }, { has: ["install"], code: 1, text: "" }]), python: pythonRules });
  const id = batches[0].id;
  runStubbed(["backup", "--run", run, "--batch", id], bin);
  const r = runStubbed(["restore", "--run", run, "--batch", id, "--verify"], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.verified, true, "the files are back");
  assert.equal(r.json.extra.ok, false, "but the environment is not");
  assert.match(r.json.extra.command, /^pip install -r .*pip-freeze\.txt$/);
});

test("uv without an audit command: rows are not audited, the rest of the scan stands", () => {
  const { scan } = detectAndScan(copyFrom(path.join(UV, "project")), { uv: uvRules([{ has: ["audit"], code: 2, err: textFile("error: unrecognized subcommand 'audit'\n") }]), python: pythonRules });
  const lock = scan.lockfiles[0];
  assert.equal(lock.audited, false);
  assert.match(lock.auditNote, /no audit command/);
  assert.equal(lock.rows.length, 2);
  assert.ok(lock.rows.every((r) => r.notAudited === true));
  assert.deepEqual(scan.missingTools, [], "not a plugin to install");
});

test("raiseRange keeps the space in a spaced PEP 440 pin, so apply can raise it", () => {
  assert.deepEqual(deps.raiseRange("python", "== 2.31.0", "2.34.2"), { rewritten: true, from: "== 2.31.0", to: "== 2.34.2" });
  assert.deepEqual(deps.raiseRange("python", "==2.31.0", "2.34.2"), { rewritten: true, from: "==2.31.0", to: "==2.34.2" });
});

/* ------------------------------------------------- Go and .NET: stubs on PATH */

// Go recorded with go 1.27.3 from a scratch module (go-1.27.3/project):
// golang.org/x/mod and x/net required directly, x/text indirect, five more
// modules in the graph. go-1.27.3/go.mod-after-get-mod is the real go get of
// x/mod v0.43.0, which rewrote the go directive 1.22 => 1.26.0. govulncheck is
// never installed (NFR-1) and no .NET SDK runs on the recording machine, so
// govulncheck-docs.json and dotnet-docs/ follow their documented shapes.
const GO = fx("go-1.27.3");
const DOTNET = fx("dotnet-docs");

const goRules = (over = []) => [
  ...over,
  { has: ["list", "-m"], out: path.join(GO, "list-m-u-json-all.json") },
  { has: ["version"], out: path.join(GO, "go-version.txt") },
  { has: ["mod", "tidy"], text: "" },
  { has: ["get"], text: "" },
];
const govulncheckRules = [{ has: ["-json"], out: path.join(GO, "govulncheck-docs.json") }];
const dotnetRules = (over = []) => [
  ...over,
  { has: ["list", "App.csproj", "package", "--outdated"], out: path.join(DOTNET, "outdated.json") },
  { has: ["list", "App.csproj", "package", "--vulnerable"], out: path.join(DOTNET, "vulnerable.json") },
  { has: ["add"], text: "" },
];

test("Go scan: rows for direct requirements only, the go directive as runtime, govulncheck missing leaves every row not audited", () => {
  const { scanRun, scan, detect, bin } = detectAndScan(copyFrom(path.join(GO, "project")), { go: goRules() });
  assert.equal(scanRun.code, 0, scanRun.stderr);
  assert.deepEqual(detect.json.lockfiles.map((l) => [l.lockfile, l.manifest, l.manager, l.members, l.install, l.updates]), [["go.sum", "go.mod", "go", ["."], "go mod download", 2]]);
  const lock = scan.lockfiles[0];
  assert.deepEqual(lock.runtime, { declared: "1.22", source: "go", machine: null });
  const rows = rowsOf(lock);
  assert.deepEqual(Object.keys(rows), ["golang.org/x/mod", "golang.org/x/net"], "indirect modules (x/text, x/crypto, ...) are never rows");
  const mod = rows["golang.org/x/mod"];
  assert.deepEqual([mod.id, mod.current, mod.target, mod.jump, mod.inRange, mod.lockfileOnly], ["go.sum#golang.org/x/mod", "v0.17.0", "v0.43.0", "0.x", true, true]);
  assert.deepEqual(mod.range, { from: "v0.17.0", to: "v0.43.0" }, "go get rewrites the require line");
  assert.deepEqual(scan.missingTools, [{ tool: "govulncheck", step: "audit", install: "go install golang.org/x/vuln/cmd/govulncheck@latest" }]);
  assert.equal(lock.audited, false);
  assert.match(lock.auditNote, /govulncheck is not installed/);
  assert.ok(lock.rows.every((r) => r.notAudited === true));
  assert.ok(!callsOf(bin).some((c) => c.tool === "govulncheck"));
  assert.ok(deps.label(scan, []).every((l) => l.label !== "safe" && l.reasons.includes("not checked for vulnerabilities")));
});

test("Go scan with govulncheck: a finding the target fixes badges its row, one with no fix on an indirect module stays open", () => {
  const { scan, bin } = detectAndScan(copyFrom(path.join(GO, "project")), { go: goRules(), govulncheck: govulncheckRules });
  const lock = scan.lockfiles[0];
  assert.equal(lock.audited, true);
  assert.deepEqual(scan.missingTools, []);
  const rows = rowsOf(lock);
  assert.deepEqual(rows["golang.org/x/net"].security, { severity: null, ids: ["GO-2099-0001"] }, "v0.62.0 is past the fix v0.23.0; the repeated finding counts once");
  assert.equal(rows["golang.org/x/mod"].security, null);
  assert.equal(lock.rows[0].package, "golang.org/x/net", "vulnerability fixes lead");
  assert.deepEqual(lock.stillOpen.map((s) => [s.package, s.ids, s.reason]), [["golang.org/x/text", ["GO-2099-0002"], "no fixed version published yet"]]);
  assert.deepEqual(callsOf(bin).find((c) => c.tool === "govulncheck").args, ["-json", "./..."]);
});

test("Go apply: a go get that raises the go directive marks needsNewerRuntime and fails; restore --verify puts the line back", () => {
  const root = copyFrom(path.join(GO, "project"));
  const { run, bin, batches } = plannedIds(root, ["go.sum#golang.org/x/mod"], {
    go: goRules([{ has: ["get", "golang.org/x/mod@v0.43.0"], writes: [{ file: "go.mod", copy: path.join(GO, "go.mod-after-get-mod") }, { file: "go.sum", copy: path.join(GO, "go.sum-after-get-mod") }] }]),
  });
  const id = batches[0].id;
  const backup = runStubbed(["backup", "--run", run, "--batch", id], bin);
  assert.deepEqual(backup.json.files, ["go.sum", "go.mod"]);
  const r = runStubbed(["apply", "--run", run, "--batch", id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.command, "go get golang.org/x/mod@v0.43.0 && go mod tidy");
  assert.deepEqual(r.json.rangeRaised, [], "go get writes go.mod itself");
  assert.deepEqual(r.json.changed.map((c) => [c.package, c.from, c.to]), [["golang.org/x/mod", "v0.17.0", "v0.43.0"]]);
  assert.deepEqual(r.json.needsNewerRuntime, [{ id: "go.sum#golang.org/x/mod", package: "golang.org/x/mod", file: "go.mod", from: "1.22", to: "1.26.0" }]);
  assert.equal(r.json.failed, true, "a raised go directive is never kept");
  assert.match(fs.readFileSync(path.join(root, "go.mod"), "utf8"), /^go 1\.26\.0$/m);
  const back = runStubbed(["restore", "--run", run, "--batch", id, "--verify"], bin);
  assert.equal(back.json.verified, true);
  assert.equal(back.json.reinstall.command, "go mod download");
  assert.equal(fs.readFileSync(path.join(root, "go.mod"), "utf8"), fs.readFileSync(path.join(GO, "project", "go.mod"), "utf8"));
  assert.match(fs.readFileSync(path.join(root, "go.mod"), "utf8"), /^go 1\.22$/m);
});

test("Go apply: a go directive written into a go.mod that had none counts as raised from Go's implicit 1.16", () => {
  const plain = fs.readFileSync(path.join(GO, "project", "go.mod"), "utf8").replace(/^go 1\.22\r?\n\r?\n/m, "");
  assert.ok(!/^go /m.test(plain), "the fixture copy has no go directive");
  const root = copyFrom(path.join(GO, "project"), { "go.mod": plain });
  const { run, bin, batches } = plannedIds(root, ["go.sum#golang.org/x/mod"], {
    go: goRules([{ has: ["get", "golang.org/x/mod@"], writes: [{ file: "go.mod", copy: path.join(GO, "go.mod-after-get-mod") }, { file: "go.sum", copy: path.join(GO, "go.sum-after-get-mod") }] }]),
  });
  runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.needsNewerRuntime, [{ id: "go.sum#golang.org/x/mod", package: "golang.org/x/mod", file: "go.mod", from: null, to: "1.26.0" }]);
  assert.equal(r.json.failed, true);
  assert.equal(runStubbed(["restore", "--run", run, "--batch", batches[0].id, "--verify"], bin).json.verified, true);
  assert.equal(fs.readFileSync(path.join(root, "go.mod"), "utf8"), plain);
});

test("Go apply: an update that leaves the go directive alone has no needsNewerRuntime", () => {
  const root = copyFrom(path.join(GO, "project"));
  const { run, bin, batches } = plannedIds(root, ["go.sum#golang.org/x/net"], {
    go: goRules([{ has: ["get", "golang.org/x/net@"], writes: [{ file: "go.mod", copy: path.join(GO, "go.mod-after-get-net") }, { file: "go.sum", copy: path.join(GO, "go.sum-after-get-net") }] }]),
  });
  runStubbed(["backup", "--run", run, "--batch", batches[0].id], bin);
  const r = runStubbed(["apply", "--run", run, "--batch", batches[0].id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.needsNewerRuntime, []);
  assert.equal(r.json.failed, false);
  assert.deepEqual(r.json.changed.map((c) => [c.package, c.to]), [["golang.org/x/net", "v0.21.0"]]);
  assert.deepEqual(r.json.unpicked, []);
});

test(".NET detect: packages.lock.json beside each project, a project without one listed as noLockfile and still scanned", () => {
  const root = copyFrom(path.join(DOTNET, "project"), { "lib/Lib.fsproj": '<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFrameworks>net8.0;net10.0</TargetFrameworks>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include="FSharp.Core" Version="8.0.400" />\n  </ItemGroup>\n</Project>\n' });
  const r = runStubbed(["detect", "--root", root], stubPath({ dotnet: dotnetRules() }));
  assert.equal(r.code, 0, r.stderr);
  const byManifest = Object.fromEntries(r.json.lockfiles.map((l) => [l.manifest, l]));
  assert.deepEqual(Object.keys(byManifest), ["App.csproj", "lib/Lib.fsproj"]);
  assert.deepEqual([byManifest["App.csproj"].lockfile, byManifest["App.csproj"].install, byManifest["App.csproj"].updates], ["packages.lock.json", "dotnet restore App.csproj --locked-mode", 2]);
  const lib = byManifest["lib/Lib.fsproj"];
  assert.deepEqual([lib.lockfile, lib.noLockfile, lib.install], ["lib/Lib.fsproj", true, "dotnet restore Lib.fsproj"]);
  assert.deepEqual(r.json.noLockfile.map((n) => [n.manifest, n.ecosystem]), [["lib/Lib.fsproj", "nuget"]]);
  assert.match(r.json.noLockfile[0].reason, /no packages\.lock\.json/);
  const adapter = deps.ADAPTERS.find((a) => a.id === "dotnet");
  assert.deepEqual(adapter.runtime({ manifest: "lib/Lib.fsproj" }, root), { declared: "net8.0;net10.0", source: "TargetFramework", machine: null, floor: "8.0" });
});

test(".NET scan: rows from --outdated, implicit packages skipped; a vulnerability with no fix version badges its row and stays open", () => {
  const { scanRun, scan, bin } = detectAndScan(copyFrom(path.join(DOTNET, "project")), { dotnet: dotnetRules() });
  assert.equal(scanRun.code, 0, scanRun.stderr);
  const lock = scan.lockfiles[0];
  assert.deepEqual(lock.runtime, { declared: "net8.0", source: "TargetFramework", machine: null });
  const rows = rowsOf(lock);
  assert.deepEqual(Object.keys(rows), ["Newtonsoft.Json", "Serilog"], "autoReferenced Microsoft.NET.ILLink.Tasks is not a row");
  assert.ok(lock.rows.every((r) => r.runtimeNotChecked === "net8.0"), "no target is cut by TargetFramework yet: never Safe");
  const nj = rows["Newtonsoft.Json"];
  assert.deepEqual([nj.id, nj.current, nj.target, nj.jump, nj.inRange, nj.lockfileOnly], ["packages.lock.json#Newtonsoft.Json", "13.0.1", "13.0.4", "patch", true, true]);
  assert.deepEqual(nj.range, { from: "13.0.1", to: "13.0.4" });
  assert.deepEqual([rows.Serilog.jump, rows.Serilog.range], ["major", { from: "3.1.1", to: "4.3.0" }]);
  assert.equal(lock.audited, true);
  assert.deepEqual(nj.security, { severity: "high", ids: ["https://github.com/advisories/GHSA-0000-fixture-0001"] });
  assert.deepEqual(lock.stillOpen.map((s) => [s.package, s.severity]), [["Newtonsoft.Json", "high"], ["System.Text.RegularExpressions", "moderate"]]);
  assert.match(lock.stillOpen[0].reason, /does not say which version fixes it/);
  const calls = callsOf(bin).filter((c) => c.tool === "dotnet").map((c) => c.args.join(" "));
  assert.ok(calls.includes("list App.csproj package --outdated --format json"));
  assert.ok(calls.includes("list App.csproj package --vulnerable --include-transitive --format json"), "never combined with --outdated");
});

test(".NET apply: dotnet add package per pick writes the project and the lock; restore --verify puts both back", () => {
  const root = copyFrom(path.join(DOTNET, "project"));
  const { run, bin, batches } = plannedIds(root, ["packages.lock.json#Newtonsoft.Json"], {
    dotnet: dotnetRules([{ has: ["add", "App.csproj", "package", "Newtonsoft.Json"], writes: [{ file: "App.csproj", copy: path.join(DOTNET, "App.csproj-after-add-newtonsoft") }, { file: "packages.lock.json", copy: path.join(DOTNET, "packages.lock-after-add-newtonsoft.json") }] }]),
  });
  const id = batches[0].id;
  assert.deepEqual(runStubbed(["backup", "--run", run, "--batch", id], bin).json.files, ["packages.lock.json", "App.csproj"]);
  const r = runStubbed(["apply", "--run", run, "--batch", id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.command, "dotnet add App.csproj package Newtonsoft.Json --version 13.0.4");
  assert.deepEqual(r.json.rangeRaised, [], "dotnet add writes the PackageReference itself");
  assert.deepEqual(r.json.changed.map((c) => [c.package, c.from, c.to]), [["Newtonsoft.Json", "13.0.1", "13.0.4"]]);
  assert.deepEqual([r.json.unpicked, r.json.offTarget, r.json.failed], [[], [], false]);
  const back = runStubbed(["restore", "--run", run, "--batch", id, "--verify"], bin);
  assert.equal(back.json.verified, true);
  assert.equal(fs.readFileSync(path.join(root, "App.csproj"), "utf8"), fs.readFileSync(path.join(DOTNET, "project", "App.csproj"), "utf8"));
  const adapter = deps.ADAPTERS.find((a) => a.id === "dotnet");
  const calls = adapter.applyCommand({ rows: [{ package: "A", target: "1.1.0" }, { package: "B", target: "2.0.0" }] }, { manifest: "src/App.csproj" }, root);
  assert.deepEqual(calls.map((c) => [c.cmd, ...c.args].join(" ")), ["dotnet add App.csproj package A --version 1.1.0", "dotnet add App.csproj package B --version 2.0.0"]);
});

test(".NET apply without a packages.lock.json: the project file is the record, read for the move and put back byte for byte", () => {
  const csproj = (v) => `<Project Sdk="Microsoft.NET.Sdk">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n  <ItemGroup>\n    <PackageReference Include="FSharp.Core" Version="${v}" />\n  </ItemGroup>\n</Project>\n`;
  const root = tmp("deps-dotnet-nolock");
  write(root, "lib/Lib.fsproj", csproj("8.0.400"));
  const outdated = { version: 1, parameters: "--outdated", projects: [{ path: "Lib.fsproj", frameworks: [{ framework: "net8.0", topLevelPackages: [{ id: "FSharp.Core", requestedVersion: "8.0.400", resolvedVersion: "8.0.400", latestVersion: "8.0.403" }] }] }] };
  const { run, bin, batches } = plannedIds(root, ["lib/Lib.fsproj#FSharp.Core"], {
    dotnet: [
      { has: ["list", "Lib.fsproj", "package", "--outdated"], out: textFile(JSON.stringify(outdated)) },
      { has: ["add", "Lib.fsproj", "package", "FSharp.Core"], writes: [{ file: "Lib.fsproj", copy: textFile(csproj("8.0.403")) }] },
    ],
  });
  const id = batches[0].id;
  assert.deepEqual(runStubbed(["backup", "--run", run, "--batch", id], bin).json.files, ["lib/Lib.fsproj"]);
  const r = runStubbed(["apply", "--run", run, "--batch", id], bin);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.command, "dotnet add Lib.fsproj package FSharp.Core --version 8.0.403");
  assert.deepEqual(r.json.changed.map((c) => [c.package, c.from, c.to]), [["FSharp.Core", "8.0.400", "8.0.403"]]);
  assert.deepEqual([r.json.offTarget, r.json.unpicked, r.json.failed], [[], [], false]);
  const back = runStubbed(["restore", "--run", run, "--batch", id, "--verify"], bin);
  assert.equal(back.json.verified, true);
  assert.equal(back.json.reinstall.command, "dotnet restore Lib.fsproj", "no --locked-mode without a lockfile");
  assert.equal(fs.readFileSync(path.join(root, "lib/Lib.fsproj"), "utf8"), csproj("8.0.400"));
});

test("detect lists a pom.xml and a Gemfile in notCovered with folder and ecosystem, and scan makes no rows for them", () => {
  const root = tmp("deps-uncovered");
  write(root, "pom.xml", "<project></project>\n");
  write(root, "ruby/Gemfile", 'source "https://rubygems.org"\ngem "rails", "~> 7.1"\n');
  write(root, "node_modules/x/composer.json", "{}\n");
  write(root, "vendor/acme/lib/composer.json", "{}\n");
  write(root, "ruby/vendor/bundle/gems/rake/Gemfile", "\n");
  const bin = stubPath({ git: [{ has: ["rev-parse"], code: 128 }] });
  const d = runStubbed(["detect", "--root", root], bin);
  assert.equal(d.code, 0, d.stderr);
  assert.deepEqual(d.json.notCovered, [
    { folder: ".", manifest: "pom.xml", ecosystem: "Maven" },
    { folder: "ruby", manifest: "ruby/Gemfile", ecosystem: "Ruby (Bundler)" },
  ], "skipped folders (node_modules) and dependency copies under vendor/ are never listed");
  assert.deepEqual(d.json.lockfiles, []);
  const s = runStubbed(["scan", "--run", d.json.run], bin);
  assert.equal(s.code, 0, s.stderr);
  const scan = JSON.parse(fs.readFileSync(path.join(d.json.run, "scan.json"), "utf8"));
  assert.deepEqual(scan.lockfiles, []);
  assert.deepEqual(scan.notCovered, d.json.notCovered);
});

/** Runs `fn` with PATH (every case of the key) set to `dir` in this process, for spawnTool. */
function withProcessPath(dir, fn) {
  const saved = Object.fromEntries(Object.keys(process.env).filter((k) => /^path$/i.test(k)).map((k) => [k, process.env[k]]));
  for (const k of Object.keys(saved)) process.env[k] = dir;
  process.env.PATH = dir;
  try {
    return fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) process.env[k] = v;
  }
}

test("spawnTool refuses an argument cmd.exe cannot quote safely, before the tool starts", { skip: process.platform !== "win32" && "cmd.exe only" }, () => {
  const bin = stubPath({ npm: [{ has: [], text: "ran" }] });
  for (const bad of ['1" & echo x & "', "%PATH%", "a!b", "a\nb"]) {
    const r = withProcessPath(bin, () => deps.spawnTool("npm", ["view", bad]));
    assert.equal(r.code, null);
    assert.match(r.stderr, /cannot be quoted safely/);
  }
  assert.deepEqual(callsOf(bin), [], "the stub never ran");
  const ok = withProcessPath(bin, () => deps.spawnTool("npm", ["view", "a b", ">=1.0.0 <2"]));
  assert.equal(ok.code, 0, ok.stderr);
  assert.deepEqual(callsOf(bin)[0].args, ["view", "a b", ">=1.0.0 <2"]);
});

test("a timed-out .cmd tool is stopped with its whole tree, so it writes nothing afterward", { skip: process.platform !== "win32" && "cmd.exe only" }, async () => {
  const dir = tmp("deps-slow");
  const marker = path.join(dir, "late.txt");
  const js = path.join(dir, "slow.mjs");
  fs.writeFileSync(js, `import fs from "node:fs";\nsetTimeout(() => fs.writeFileSync(${JSON.stringify(marker)}, "late"), 3000);\n`);
  fs.writeFileSync(path.join(dir, "npm.cmd"), `@"${process.execPath}" "${js}" %*\r\n`);
  const r = withProcessPath(dir, () => deps.spawnTool("npm", ["update"], { timeoutMs: 1000 }));
  assert.equal(r.timedOut, true);
  assert.equal(r.code, null);
  await new Promise((done) => setTimeout(done, 4000));
  assert.ok(!fs.existsSync(marker), "the tool kept running after the timeout");
});

test("spawnTool refuses --force before anything runs", () => {
  assert.throws(() => deps.spawnTool("npm", ["audit", "fix", "--force"]), /--force/);
  assert.throws(() => deps.spawnTool("npm", ["install", "--force=true"]), /--force/);
});

/* --------------------------------------------------------------- notes */

// Saved HTTP responses under fixtures/deps/http/, served by a local server in
// a child process (runDeps blocks this process while the script runs, so a
// server here could never answer). PLAN2CODE_DEPS_HTTP_BASE sends the script's
// requests to it as <base>/<host><path>; any other path answers 404.
const HTTP_FX = path.join(FIXTURES, "http");
const HTTP_SERVER = [
  'import http from "node:http";',
  'import fs from "node:fs";',
  'const routes = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));',
  "const server = http.createServer((req, res) => {",
  '  const route = routes[new URL(req.url, "http://x").pathname];',
  '  if (!route) { res.writeHead(404); res.end("not found"); return; }',
  "  if (route.hang) return;",
  "  const body = route.big",
  '    ? JSON.stringify([{ tag_name: "v2.0.0", name: "v2.0.0", body: "x".repeat(route.big) }])',
  "    : route.bare",
  '      ? JSON.stringify(["v1.3.0", "v1.2.0"].map((t) => ({ tag_name: t, name: t, draft: false, body: null })))',
  "      : fs.readFileSync(route.file);",
  "  res.writeHead(200); res.end(body);",
  "});",
  'server.listen(0, "127.0.0.1", () => process.stdout.write(server.address().port + "\\n"));',
  "",
].join("\n");

const HTTP_ROUTES = {
  "/api.github.com/repos/chalk/chalk/releases": { file: path.join(HTTP_FX, "releases-chalk.json") },
  "/raw.githubusercontent.com/left-pad/left-pad/HEAD/CHANGELOG.md": { file: path.join(HTTP_FX, "changelog-left-pad.md") },
  "/crates.io/api/v1/crates/serde": { file: path.join(HTTP_FX, "crates-serde.json") },
  "/pypi.org/pypi/requests/json": { file: path.join(HTTP_FX, "pypi-requests.json") },
  "/api.github.com/repos/big/notes/releases": { big: 40000 },
  "/api.github.com/repos/bare/pad/releases": { bare: true },
  "/raw.githubusercontent.com/bare/pad/HEAD/CHANGELOG.md": { file: path.join(HTTP_FX, "changelog-left-pad.md") },
  "/hang": { hang: true },
};

async function httpServer(routes) {
  const dir = tmp("deps-http");
  fs.writeFileSync(path.join(dir, "server.mjs"), HTTP_SERVER);
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify(routes));
  const child = spawn(process.execPath, [path.join(dir, "server.mjs"), path.join(dir, "routes.json")], { stdio: ["ignore", "pipe", "inherit"] });
  after(() => child.kill());
  const port = await new Promise((resolve, reject) => {
    child.stdout.once("data", (d) => resolve(Number(String(d).trim())));
    child.once("exit", (code) => reject(new Error(`the test HTTP server exited (${code})`)));
  });
  return `http://127.0.0.1:${port}`;
}

const HTTP = await httpServer(HTTP_ROUTES);

const noteRow = (lockfile, pkg, current, target, extra = {}) => ({ id: `${lockfile}#${pkg}`, package: pkg, current, target, jump: deps.jumpOf("npm", current, target), inRange: true, range: null, pinned: false, security: null, repo: null, pair: null, ...extra });

/** A scan.json for notes: npm rows with and without a repo, a Cargo row and a pip row, each found through a registry. */
function notesScan(root) {
  const checks = { rows: ["Root"], commands: ["npm test"], discovered: [], full: false };
  return {
    ok: true,
    root,
    noChecks: false,
    lockfiles: [
      {
        lockfile: "package-lock.json",
        adapter: "npm",
        ecosystem: "npm",
        manager: "npm",
        members: ["."],
        checks,
        rows: [
          noteRow("package-lock.json", "chalk", "4.1.0", "5.3.0", { repo: "https://github.com/chalk/chalk" }),
          noteRow("package-lock.json", "left-pad", "1.1.0", "1.3.0", { repo: "git+https://github.com/left-pad/left-pad.git" }),
          noteRow("package-lock.json", "ms", "2.1.2", "2.1.3"),
          noteRow("package-lock.json", "big-notes", "1.0.0", "2.0.0", { repo: "https://github.com/big/notes" }),
          noteRow("package-lock.json", "bare-pad", "1.1.0", "1.3.0", { repo: "https://github.com/bare/pad" }),
          noteRow("package-lock.json", "gone", "1.0.0", "1.1.0", { repo: "https://github.com/gone/gone" }),
        ],
      },
      { lockfile: "Cargo.lock", adapter: "cargo", ecosystem: "cargo", manager: "cargo", members: ["."], checks, rows: [noteRow("Cargo.lock", "serde", "1.0.200", "1.0.210")] },
      { lockfile: "requirements.txt", adapter: "pip", ecosystem: "python", manager: "pip", members: ["."], checks, rows: [noteRow("requirements.txt", "requests", "2.31.0", "2.32.3")] },
    ],
  };
}

/** notes for one row, with `plan` as the stub tools on PATH (none by default, so no gh) and the test server as every host. */
function notesFor(id, plan = {}) {
  const dir = runFolder({ "scan.json": notesScan(tmp("deps-notes")) });
  const r = runDeps(["notes", "--run", dir, "--id", id], { env: withPath(stubPath(plan), { PLAN2CODE_DEPS_HTTP_BASE: HTTP }) });
  assert.equal(r.code, 0, r.stderr || r.stdout);
  return { ...r.json, dir };
}

test("githubRepo reads URLs, git remotes and shorthands as owner/name; other hosts are null", () => {
  assert.equal(deps.githubRepo("https://github.com/chalk/chalk"), "chalk/chalk");
  assert.equal(deps.githubRepo("git+https://github.com/left-pad/left-pad.git"), "left-pad/left-pad");
  assert.equal(deps.githubRepo("git@github.com:serde-rs/serde.git"), "serde-rs/serde");
  assert.equal(deps.githubRepo("https://github.com/babel/babel/tree/main/packages/babel-core"), "babel/babel");
  assert.equal(deps.githubRepo("github:vercel/ms"), "vercel/ms");
  assert.equal(deps.githubRepo("vercel/ms"), "vercel/ms");
  assert.equal(deps.githubRepo("github.com/pkg/errors/v2"), "pkg/errors");
  assert.equal(deps.githubRepo("https://gitlab.com/a/b"), null);
  assert.equal(deps.githubRepo("https://notgithub.com/a/b"), null);
  assert.equal(deps.githubRepo("golang.org/x/text"), null);
  assert.equal(deps.githubRepo(null), null);
});

test("tagVersion reads v, bare, prefixed and monorepo tags; another package's tag is null", () => {
  assert.equal(deps.tagVersion("npm", "v5.0.0", "chalk"), "5.0.0");
  assert.equal(deps.tagVersion("npm", "release-1.2.3", "x"), "1.2.3");
  assert.equal(deps.tagVersion("npm", "chalk@5.0.0", "chalk"), "5.0.0");
  assert.equal(deps.tagVersion("npm", "@babel/core@7.24.0", "@babel/core"), "7.24.0");
  assert.equal(deps.tagVersion("npm", "chalk-template@1.0.0", "chalk"), null);
  assert.equal(deps.tagVersion("npm", "nightly", "chalk"), null);
  assert.equal(deps.tagVersion("npm", "pubsub-v1.2.0", "pubsub"), "1.2.0", "the package's own dash tag");
  assert.equal(deps.tagVersion("npm", "storage-v7.0.0", "pubsub"), null, "a sibling package's dash tag");
  assert.equal(deps.tagVersion("npm", "Version 2.0.0", "x"), "2.0.0");
  assert.equal(deps.tagVersion("npm", "core-v1.0.0", "@babel/core"), "1.0.0", "a scoped package's last segment");
});

test("notes: releases in range with no body fall through to the changelog", () => {
  const r = notesFor("package-lock.json#bare-pad");
  assert.equal(r.source, "changelog");
  assert.equal(r.url, "https://github.com/bare/pad/blob/HEAD/CHANGELOG.md");
  assert.match(r.text, /^## \[1\.3\.0\]/);
  assert.equal(deps.sliceReleases([{ tag_name: "v1.3.0", body: "  " }], { ecosystem: "npm", package: "x", current: "1.0.0", target: "1.3.0" }), "");
});

test("notes: GitHub releases sliced to after current and up to target, newest first, drafts and other tags left out", () => {
  const r = notesFor("package-lock.json#chalk");
  assert.equal(r.source, "fetch");
  assert.equal(r.repo, "chalk/chalk");
  assert.equal(r.url, "https://github.com/chalk/chalk/releases");
  assert.equal(r.truncated, false);
  const titles = [...r.text.matchAll(/^## (\S+)/gm)].map((m) => m[1]);
  assert.deepEqual(titles, ["v5.3.0", "v5.2.0", "v5.0.0", "v4.1.2"]);
  assert.match(r.text, /Chalk is now ESM only/);
  assert.doesNotMatch(r.text, /level option|Not published yet|Another package|hex colors|Not a version/);
});

test("notes: gh api reads the releases when gh is installed; a failing gh falls back to a fetch", () => {
  const releases = path.join(HTTP_FX, "releases-chalk.json");
  const viaGh = notesFor("package-lock.json#chalk", { gh: [{ has: ["api", "repos/chalk/chalk/releases"], out: releases }] });
  assert.equal(viaGh.source, "gh");
  assert.match(viaGh.text, /^## v5\.3\.0/);
  const broken = notesFor("package-lock.json#chalk", { gh: [{ has: ["api"], code: 1, text: "" }] });
  assert.equal(broken.source, "fetch");
  assert.equal(broken.text, viaGh.text);
});

test("notes: with no release in range, CHANGELOG.md from the default branch is sliced between the two versions", () => {
  const r = notesFor("package-lock.json#left-pad");
  assert.equal(r.source, "changelog");
  assert.equal(r.repo, "left-pad/left-pad");
  assert.equal(r.url, "https://github.com/left-pad/left-pad/blob/HEAD/CHANGELOG.md");
  const versions = [...r.text.matchAll(/^## \[([\d.]+)\]/gm)].map((m) => m[1]);
  assert.deepEqual(versions, ["1.3.0", "1.2.0", "1.1.3"]);
  assert.match(r.text, /### Added\n\n- TypeScript types\./, "subheadings stay inside their version");
  assert.match(r.text, /A heading inside a code block/, "a fenced heading is not a version heading");
  assert.doesNotMatch(r.text, /Unreleased|First release/);
});

test("notes: the repo comes from npm view, crates.io or PyPI when the row has none", () => {
  const npm = notesFor("package-lock.json#ms", { npm: [{ has: ["view", "ms", "repository.url"], text: '"git+https://github.com/vercel/ms.git"' }] });
  assert.equal(npm.repo, "vercel/ms");
  assert.equal(notesFor("Cargo.lock#serde").repo, "serde-rs/serde");
  assert.equal(notesFor("requirements.txt#requests").repo, "psf/requests");
});

test("notes: a 404 everywhere is source none, and that row labels Check first, not Safe", () => {
  const r = notesFor("package-lock.json#gone");
  assert.equal(r.source, "none");
  assert.equal(r.url, null);
  assert.equal(r.text, "");
  const records = path.join(r.dir, "helper-records.json");
  fs.writeFileSync(records, JSON.stringify([{ id: r.id, notes: r.source === "none" ? "could not read" : "read", breaking: [], files: 1, calls: [] }]));
  const l = runDeps(["label", "--run", r.dir, "--records", records]);
  assert.equal(l.code, 0, l.stderr);
  const gone = l.json.labels.find((x) => x.id === r.id);
  assert.equal(gone.label, "check-first");
  assert.ok(gone.reasons.includes("notes could not be read"));
  const read = deps.label(notesScan("."), [{ id: r.id, notes: "read", breaking: [], files: 1, calls: [] }]).find((x) => x.id === r.id);
  assert.equal(read.label, "safe", "the same row with its notes read is Safe");
});

test("notes: no repo found is source none; an unknown row exits 3", () => {
  const r = notesFor("package-lock.json#ms");
  assert.equal(r.repo, null, "npm is not on PATH, so no registry answer");
  assert.equal(r.source, "none");
  const dir = runFolder({ "scan.json": notesScan(".") });
  const unknown = runDeps(["notes", "--run", dir, "--id", "package-lock.json#nope"]);
  assert.equal(unknown.code, 3);
  assert.equal(unknown.json.error, "unknown-row");
});

test("notes: text over 32 KB is cut and marked truncated", () => {
  const r = notesFor("package-lock.json#big-notes");
  assert.equal(r.source, "fetch");
  assert.equal(r.truncated, true);
  assert.ok(Buffer.byteLength(r.text, "utf8") <= deps.NOTES_CAP_BYTES);
  assert.ok(Buffer.byteLength(r.text, "utf8") > deps.NOTES_CAP_BYTES - 16);
});

test("fetchText and fetchJson stop at the timeout and return null on a 404 or a refused connection, never throwing", async () => {
  assert.equal(deps.NOTES_TIMEOUT_MS, 15000);
  const started = Date.now();
  assert.equal(await deps.fetchText(`${HTTP}/hang`, { timeoutMs: 300 }), null);
  assert.ok(Date.now() - started < 5000, "the timeout ends the request");
  assert.equal(await deps.fetchJson(`${HTTP}/missing`), null);
  assert.deepEqual(await deps.fetchJson(`${HTTP}/crates.io/api/v1/crates/serde`).then((j) => j.crate.name), "serde");
  assert.equal(await deps.fetchText("http://127.0.0.1:1/closed", { timeoutMs: 2000 }), null);
  assert.equal(await deps.fetchJson(`${HTTP}/raw.githubusercontent.com/left-pad/left-pad/HEAD/CHANGELOG.md`), null, "a body that is not JSON");
});

/* ------------------------------------------------------------- hand-off */

/** A run folder with scan.json for handoff: chalk (out of range), react and react-dom (a pair), @types/node; labels come from label. */
function handoffRun() {
  const root = tmp("deps-handoff");
  const lock = "package-lock.json";
  const decl = (range) => [{ file: "package.json", range }];
  const scan = {
    ok: true,
    root,
    noChecks: false,
    lockfiles: [
      {
        lockfile: lock,
        adapter: "npm",
        ecosystem: "npm",
        manager: "npm",
        members: ["."],
        checks: { rows: ["Root"], commands: ["npm test"], discovered: [], full: false },
        rows: [
          noteRow(lock, "chalk", "4.1.0", "5.3.0", { inRange: false, range: { from: "^4.1.0", to: "^5.3.0" }, declaredIn: decl("^4.1.0") }),
          noteRow(lock, "react", "18.3.1", "19.0.0", { inRange: false, range: { from: "^18.3.1", to: "^19.0.0" }, declaredIn: decl("^18.3.1"), pair: `${lock}#react-dom` }),
          noteRow(lock, "react-dom", "18.3.1", "19.0.0", { inRange: false, range: { from: "^18.3.1", to: "^19.0.0" }, declaredIn: decl("^18.3.1") }),
          noteRow(lock, "@types/node", "20.0.0", "22.0.0", { inRange: false, range: { from: "^20.0.0", to: "^22.0.0" }, declaredIn: decl("^20.0.0") }),
        ],
      },
    ],
  };
  const dir = runFolder({ "scan.json": scan });
  const records = [
    { id: `${lock}#chalk`, notes: "read", source: "fetch", url: "https://github.com/chalk/chalk/releases", breaking: ["Chalk is now ESM only. Use chalk 4 from CommonJS."], files: 2, calls: [{ file: "src/color.js", line: 3, api: "chalk.red" }] },
    { id: `${lock}#react`, notes: "could not read", source: "none", breaking: [], files: 9, calls: [] },
  ];
  const helper = path.join(tmp("deps-records"), "records.json");
  fs.writeFileSync(helper, JSON.stringify(records));
  const l = runDeps(["label", "--run", dir, "--records", helper]);
  assert.equal(l.code, 0, l.stderr);
  return { root, dir, lock };
}

const BRIEF_DATE = NOW.slice(0, 10).replace(/-/g, "");

test("label saves the helper records in the run folder for handoff", () => {
  const { dir, lock } = handoffRun();
  const saved = JSON.parse(fs.readFileSync(path.join(dir, "records.json"), "utf8"));
  assert.deepEqual(saved.map((r) => r.id), [`${lock}#chalk`, `${lock}#react`]);
});

test("handoff writes one brief per package in the 4.5 format, every section present", () => {
  const { root, dir, lock } = handoffRun();
  const r = runDeps(["handoff", "--run", dir, "--ids", `${lock}#chalk`]);
  assert.equal(r.code, 0, r.stderr);
  const file = `specs/chalk-upgrade/UPGRADE-${BRIEF_DATE}.md`;
  assert.deepEqual(r.json.written, [{ file, folder: "specs/chalk-upgrade", ids: [`${lock}#chalk`], packages: ["chalk"] }]);
  assert.equal(
    fs.readFileSync(path.join(root, file), "utf8"),
    [
      "# Upgrade chalk 4.1.0 to 5.3.0",
      "",
      "**Status:** Ready",
      "**Ecosystem:** npm",
      "**Folder:** .",
      "",
      "## Why it was held back",
      "",
      "- **chalk**: Warning (major, range ^4.1.0 → ^5.3.0, breaking notes, calls a changed API, used in 2 files)",
      "",
      "## What the notes say changed",
      "",
      "> Chalk is now ESM only. Use chalk 4 from CommonJS.",
      "",
      "Source: fetch, https://github.com/chalk/chalk/releases",
      "",
      "## Where the code calls it",
      "",
      "- `src/color.js:3` (chalk.red)",
      "",
      "## Checks that cover it",
      "",
      "- `npm test`",
      "",
      "## How to apply",
      "",
      "- Raise the chalk range in package.json: `^4.1.0` to `^5.3.0`.",
      "- In `.`, run:",
      "",
      "```",
      "npm update chalk --package-lock-only --ignore-scripts --no-audit --no-fund",
      "```",
      "",
    ].join("\n"),
  );
});

test("handoff: a pair shares one brief listing both packages; a scoped name gets scope-name; a second run replaces the brief", () => {
  const { root, dir, lock } = handoffRun();
  const ids = [`${lock}#react`, `${lock}#react-dom`, `${lock}#@types/node`];
  const r = runDeps(["handoff", "--run", dir, "--ids", ids.join(",")]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.written.map((w) => [w.folder, w.packages]), [["specs/react-upgrade", ["react", "react-dom"]], ["specs/types-node-upgrade", ["@types/node"]]]);
  assert.deepEqual(fs.readdirSync(path.join(root, "specs")).sort(), ["react-upgrade", "types-node-upgrade"], "exactly two folders");
  const pair = fs.readFileSync(path.join(root, "specs", "react-upgrade", `UPGRADE-${BRIEF_DATE}.md`), "utf8");
  assert.match(pair, /^# Upgrade react 18\.3\.1 to 19\.0\.0 and react-dom 18\.3\.1 to 19\.0\.0\n/);
  for (const section of ["Why it was held back", "What the notes say changed", "Where the code calls it", "Checks that cover it", "How to apply"]) assert.match(pair, new RegExp(`^## ${section}$`, "m"), section);
  assert.match(pair, /^\*\*Status:\*\* Ready$/m);
  assert.match(pair, /- \*\*react\*\*: Warning \(major, .*used in 9 files/, "a major with unreadable notes in 9 files");
  assert.match(pair, /- \*\*react-dom\*\*: Check first \(major/);
  assert.match(pair, /### react\n\nThe notes could not be read\./);
  assert.match(pair, /### react-dom\n\nThe notes were not read\./);
  assert.match(pair, /npm update react react-dom --package-lock-only/, "one command moves both");

  const stale = path.join(root, "specs", "types-node-upgrade", `UPGRADE-${BRIEF_DATE}.md`);
  fs.writeFileSync(stale, "old brief\n");
  assert.equal(runDeps(["handoff", "--run", dir, "--ids", `${lock}#@types/node`]).code, 0);
  assert.match(fs.readFileSync(stale, "utf8"), /^# Upgrade @types\/node 20\.0\.0 to 22\.0\.0\n/);
  assert.deepEqual(fs.readdirSync(path.dirname(stale)), [`UPGRADE-${BRIEF_DATE}.md`]);
});

test("handoff: one package ticked in two lockfiles gets a brief each, the later one naming its folder", () => {
  const root = tmp("deps-handoff-two");
  const checks = { rows: ["Root"], commands: ["npm test"], discovered: [], full: false };
  const lockOf = (lockfile, member) => ({ lockfile, adapter: "npm", ecosystem: "npm", manager: "npm", members: [member], checks, rows: [noteRow(lockfile, "chalk", "4.1.0", "5.3.0")] });
  const dir = runFolder({ "scan.json": { ok: true, root, noChecks: false, lockfiles: [lockOf("package-lock.json", "."), lockOf("web/package-lock.json", "web")] } });
  const helper = path.join(tmp("deps-records"), "records.json");
  fs.writeFileSync(helper, "[]");
  assert.equal(runDeps(["label", "--run", dir, "--records", helper]).code, 0);
  const r = runDeps(["handoff", "--run", dir, "--ids", "package-lock.json#chalk,web/package-lock.json#chalk"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.written.map((w) => w.folder), ["specs/chalk-upgrade", "specs/chalk-web-upgrade"]);
  assert.match(fs.readFileSync(path.join(root, "specs", "chalk-upgrade", `UPGRADE-${BRIEF_DATE}.md`), "utf8"), /^\*\*Folder:\*\* \.$/m);
  assert.match(fs.readFileSync(path.join(root, "specs", "chalk-web-upgrade", `UPGRADE-${BRIEF_DATE}.md`), "utf8"), /^\*\*Folder:\*\* web$/m);
});

test("upgradeBrief quotes every line of a breaking note that spans lines", () => {
  const lock = { lockfile: "package-lock.json", ecosystem: "npm", manager: "npm", checks: {} };
  const row = noteRow("package-lock.json", "chalk", "4.1.0", "5.3.0");
  const brief = deps.upgradeBrief([{ row, lock, label: { label: "warning", reasons: ["major"] }, record: { notes: "read", breaking: ["Chalk is now ESM only.\nUse chalk 4 from CommonJS.\r\n\r\n- Drops Node 12."] } }]);
  assert.match(brief, /\n> Chalk is now ESM only\.\n> Use chalk 4 from CommonJS\.\n>\n> - Drops Node 12\.\n/);
});

test("handoff refuses an id not in labels.json (exit 3) and writes nothing; upgradeFolder never leaves specs/", () => {
  const { root, dir, lock } = handoffRun();
  const r = runDeps(["handoff", "--run", dir, "--ids", `${lock}#chalk,${lock}#nope`]);
  assert.equal(r.code, 3);
  assert.equal(r.json.error, "unknown-id");
  assert.deepEqual(r.json.unknown, [`${lock}#nope`]);
  assert.equal(fs.existsSync(path.join(root, "specs")), false, "not even the known id's brief");
  fs.rmSync(path.join(dir, "labels.json"));
  assert.equal(runDeps(["handoff", "--run", dir, "--ids", `${lock}#chalk`]).json.error, "labels-missing");

  assert.equal(deps.upgradeFolder("@types/node"), "types-node-upgrade");
  assert.equal(deps.upgradeFolder("github.com/pkg/errors"), "github.com-pkg-errors-upgrade");
  assert.equal(deps.upgradeFolder("../../etc"), "etc-upgrade");
  assert.equal(deps.upgradeFolder(".."), "package-upgrade");
});

test("no stub ever received --force or an audit fix", () => {
  const calls = stubDirs.flatMap(callsOf);
  assert.ok(calls.length > 20, "the stubbed tests ran first");
  for (const c of calls) {
    assert.ok(!c.args.some((a) => /^--force/.test(a)), `${c.tool} ${c.args.join(" ")}`);
    assert.ok(!(c.args.includes("audit") && c.args.includes("fix")), "never audit fix");
  }
});
