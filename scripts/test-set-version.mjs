// Tests for scripts/set-version.mjs, the one writer of the version carriers.
// Run with: node --test scripts/test-set-version.mjs
//
// Every run works on a scratch copy of the carriers (plus CHANGELOG.md, which check-versions reads
// and the script leaves to a person), never on the real tree.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkVersions } from "./check-versions.mjs";
import { CARRIER_FILES } from "./set-version.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, "..");
const SET = path.join(here, "set-version.mjs");

const made = [];
after(() => {
  for (const d of made) fs.rmSync(d, { recursive: true, force: true });
});

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "setver-"));
  made.push(dir);
  for (const file of [...CARRIER_FILES, "CHANGELOG.md"]) {
    const to = path.join(dir, file);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), to);
  }
  return dir;
}
const read = (dir, file) => fs.readFileSync(path.join(dir, file), "utf8");
const run = (...args) => spawnSync(process.execPath, [SET, ...args], { encoding: "utf8" });
// A person writes the changelog heading; the script never does.
function writeHeading(dir, version) {
  const file = path.join(dir, "CHANGELOG.md");
  fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace(/^##\s+v?\d+\.\d+\.\d+/m, `## v${version}`));
}
const changedLines = (a, b) => {
  const x = a.split("\n");
  const y = b.split("\n");
  assert.equal(x.length, y.length, "the line count does not change");
  return x.filter((line, i) => line !== y[i]).length;
};

test("it names all the carriers, and the tree's own versions agree before the test starts", () => {
  assert.equal(CARRIER_FILES.length, 9);
  assert.ok(checkVersions(ROOT).ok, checkVersions(ROOT).problems.join("\n"));
});

test("after it runs, check-versions passes on the scratch copy", () => {
  const dir = scratch();
  const before = Object.fromEntries(CARRIER_FILES.map((f) => [f, read(dir, f)]));
  const r = run("9.8.7", "--date", "2030-01-02", "--root", dir);
  assert.equal(r.status, 0, r.stderr);
  writeHeading(dir, "9.8.7");
  const check = checkVersions(dir);
  assert.deepEqual(check.problems, []);
  assert.ok(check.versions.every((v) => v.version === "9.8.7"));
  assert.match(read(dir, "version.json"), /"releaseDate": "2030-01-02"/);
  assert.match(read(dir, "README.md"), /^Version 9\.8\.7\b/m);
  // Only the version lines changed: the carriers keep their formatting.
  const expected = {
    "version.json": 2, "package.json": 1, "README.md": 1, "plan2code-app/package.json": 1,
    "plan2code-app/src-tauri/tauri.conf.json": 1, "plan2code-app/package-lock.json": 2,
    "plan2code-app/src-tauri/Cargo.toml": 1, "plan2code-app/fake-agent/Cargo.toml": 1, "plan2code-app/Cargo.lock": 2,
  };
  for (const f of CARRIER_FILES) assert.equal(changedLines(before[f], read(dir, f)), expected[f], f);
});

test("a second run for another version replaces the first, and the date defaults to today", () => {
  const dir = scratch();
  assert.equal(run("1.2.3", "--root", dir).status, 0);
  assert.equal(run("1.2.4", "--root", dir).status, 0);
  writeHeading(dir, "1.2.4");
  assert.deepEqual(checkVersions(dir).problems, []);
  const { releaseDate } = JSON.parse(read(dir, "version.json"));
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  assert.equal(releaseDate, today);
});

test("a Cargo.lock with CRLF line endings is still edited, and keeps them", () => {
  const dir = scratch();
  const lock = path.join(dir, "plan2code-app/Cargo.lock");
  fs.writeFileSync(lock, fs.readFileSync(lock, "utf8").replace(/\n/g, "\r\n"));
  assert.equal(run("4.5.6", "--root", dir).status, 0);
  writeHeading(dir, "4.5.6");
  assert.deepEqual(checkVersions(dir).problems, []);
  assert.ok(read(dir, "plan2code-app/Cargo.lock").includes("\r\n"));
});

test("it never touches CHANGELOG.md", () => {
  const dir = scratch();
  const before = read(dir, "CHANGELOG.md");
  assert.equal(run("7.7.7", "--root", dir).status, 0);
  assert.equal(read(dir, "CHANGELOG.md"), before);
});

test("a missing carrier fails, names it, and writes nothing", () => {
  const dir = scratch();
  fs.rmSync(path.join(dir, "plan2code-app/fake-agent/Cargo.toml"));
  const before = Object.fromEntries(CARRIER_FILES.filter((f) => !f.includes("fake-agent/")).map((f) => [f, read(dir, f)]));
  const r = run("6.6.6", "--root", dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /fake-agent\/Cargo\.toml: file is missing/);
  assert.match(r.stderr, /Nothing was written/);
  for (const [f, text] of Object.entries(before)) assert.equal(read(dir, f), text, `${f} is unchanged`);
});

test("a carrier with no version in it fails and writes nothing", () => {
  const dir = scratch();
  fs.writeFileSync(path.join(dir, "README.md"), "# Plan2Code\n\nNo version line here.\n");
  const r = run("6.6.6", "--root", dir);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /README\.md: no "Version X\.Y\.Z" line found/);
  assert.match(read(dir, "version.json"), /"version": "[^"]+"/);
  assert.ok(!read(dir, "version.json").includes("6.6.6"));
});

test("bad arguments exit 2 and write nothing", () => {
  const dir = scratch();
  for (const args of [[], ["3.0"], ["v3.0.1"], ["3.0.1-beta"], ["3.0.1", "extra"], ["3.0.1", "--date", "yesterday"], ["3.0.1", "--root"]]) {
    const r = run(...args, ...(args.includes("--root") ? [] : ["--root", dir]));
    assert.equal(r.status, 2, `${args.join(" ")}: ${r.stderr}`);
    assert.match(r.stderr, /Usage: node scripts\/set-version\.mjs/);
  }
  assert.ok(!read(dir, "version.json").includes("3.0.1"));
});

test("an impossible date is refused", () => {
  const dir = scratch();
  const r = run("3.0.1", "--date", "2030-99-99", "--root", dir);
  assert.equal(r.status, 2);
  assert.equal(run("3.0.1", "--date", "2030-02-30", "--root", dir).status, 2);
  assert.equal(run("3.0.1", "--date", "2028-02-29", "--root", dir).status, 0);
});

test("a write that fails part way puts back the files already written", () => {
  const dir = scratch();
  const last = path.join(dir, "plan2code-app/Cargo.lock");
  fs.chmodSync(last, 0o444);
  const before = Object.fromEntries(CARRIER_FILES.map((f) => [f, read(dir, f)]));
  const r = run("5.5.5", "--root", dir);
  fs.chmodSync(last, 0o644);
  if (r.status === 0) return; // running as a user who can write a read-only file: nothing to test
  assert.equal(r.status, 1);
  assert.match(r.stderr, /restored the files already written/);
  for (const f of CARRIER_FILES) assert.equal(read(dir, f), before[f], `${f} is back as it was`);
});
