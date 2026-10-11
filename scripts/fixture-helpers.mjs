// Copy-on-use fixtures for the tests in scripts/.
//
// Building a git fixture means a run of git processes (init, config, add,
// commit, remote, push), and on Windows each one costs a few hundred
// milliseconds. copyFixture builds a fixture once per test file and hands
// every caller its own copy of it, so a test can still change its repo freely.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const templates = new Map();
const madeDirs = [];

const tempDir = (name) => {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), `p2c-${name}-`));
  madeDirs.push(dir);
  return dir;
};
export const slashed = (p) => p.replace(/\\/g, "/");

/** Every .git/config in the copied tree, bounded two levels down (repo at the root or `repo/` + `origin.git/` beside it). */
function gitConfigs(dir, depth = 2) {
  const out = [];
  const walk = (d, left) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory() && entry.name === ".git") out.push(path.join(p, "config"));
      else if (entry.isDirectory() && left > 0) walk(p, left - 1);
    }
  };
  walk(dir, depth);
  return out;
}

/** Remove the temp dirs copyFixture made. Suites call this in test.after. */
export function fixtureCleanup() {
  for (const dir of madeDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
}

/**
 * A fresh copy, in its own temp dir named for `name`, of the fixture `build`
 * makes. `build(dir)` runs once per `key` per process, into an empty dir.
 *
 * A remote that points inside the fixture (a bare origin beside the repo)
 * must be added with forward slashes, as `slashed()` gives it: every copied
 * .git/config (found by a bounded walk, so a repo a folder or two down still
 * gets it) has the template's path swapped for the copy's, so the copy pushes
 * to its own origin.
 */
export function copyFixture(name, key, build) {
  let template = templates.get(key);
  if (!template) {
    template = tempDir("template");
    build(template);
    templates.set(key, template);
  }
  const dir = tempDir(name);
  fs.cpSync(template, dir, { recursive: true, preserveTimestamps: true });
  for (const config of gitConfigs(dir)) {
    if (!fs.existsSync(config)) continue;
    const text = fs.readFileSync(config, "utf8");
    if (text.includes(slashed(template))) fs.writeFileSync(config, text.split(slashed(template)).join(slashed(dir)));
  }
  return dir;
}
