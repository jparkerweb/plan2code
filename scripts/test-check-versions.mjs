// Tests for scripts/check-versions.mjs. Run with: node --test scripts/test-check-versions.mjs
//
// Each test builds a small tree in a temp folder holding every file that carries the version,
// so the check is exercised without depending on what the real repo says today.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkVersions } from "./check-versions.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "check-versions.mjs");

/** A Cargo.lock whose two workspace entries sit among others that carry their own versions. */
function cargoLock(app, fake) {
  return `[[package]]\nname = "chrono"\nversion = "0.4.0"\n\n[[package]]\nname = "fake-agent"\nversion = "${fake}"\n\n[[package]]\nname = "plan2code-app"\nversion = "${app}"\n`;
}

/** A tree with every version file at `version`, each overridable by its path in `over`. */
function tree(t, version = "3.0.0", over = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-versions-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    "version.json": JSON.stringify({ name: "Plan2Code", version }),
    "package.json": JSON.stringify({ name: "plan2code", version }),
    "CHANGELOG.md": `# Changelog\n\n## v${version}\n\n### Added\n\n- something\n\n## v0.0.1\n`,
    "plan2code-app/src-tauri/tauri.conf.json": JSON.stringify({ productName: "Plan2Code", version }),
    "README.md": `# Plan2Code\n\nVersion ${version} · MIT\n`,
    "plan2code-app/package.json": JSON.stringify({ name: "plan2code-app", version }),
    "plan2code-app/package-lock.json": JSON.stringify({
      name: "plan2code-app",
      version,
      packages: { "": { name: "plan2code-app", version } },
    }),
    "plan2code-app/src-tauri/Cargo.toml": `[package]\nname = "plan2code-app"\nversion = "${version}"\n\n[dependencies]\nserde = { version = "1" }\n`,
    "plan2code-app/fake-agent/Cargo.toml": `[package]\nname = "fake-agent"\nversion = "${version}"\n`,
    "plan2code-app/Cargo.lock": cargoLock(version, version),
    ...over,
  };
  for (const [file, content] of Object.entries(files)) {
    if (content === null) continue;
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

test("versions: every file at one version passes, and each place is listed", (t) => {
  const result = checkVersions(tree(t));
  assert.equal(result.ok, true, result.problems.join("; "));
  assert.equal(result.versions.length, 12);
  assert.ok(result.versions.every((v) => v.version === "3.0.0"));
});

test("versions: the app's tauri.conf.json disagreeing is named", (t) => {
  const root = tree(t, "3.0.0", {
    "plan2code-app/src-tauri/tauri.conf.json": JSON.stringify({ version: "2.11.0" }),
  });
  const result = checkVersions(root);
  assert.equal(result.ok, false);
  assert.deepEqual(result.problems, ["plan2code-app/src-tauri/tauri.conf.json says 2.11.0, version.json says 3.0.0"]);
});

test("versions: Cargo.toml's package version counts, a dependency's does not", (t) => {
  const root = tree(t, "3.0.0", {
    "plan2code-app/src-tauri/Cargo.toml": '[package]\nname = "x"\nversion = "3.1.0"\n',
  });
  assert.match(checkVersions(root).problems[0], /Cargo\.toml says 3\.1\.0/);
});

test("versions: README's line, a lockfile line and a fake-agent entry each disagree by name", (t) => {
  const readme = checkVersions(tree(t, "3.0.0", { "README.md": "# Plan2Code\n\nVersion 2.6.0 · MIT\n" }));
  assert.deepEqual(readme.problems, ["README.md says 2.6.0, version.json says 3.0.0"]);

  const lock = checkVersions(
    tree(t, "3.0.0", {
      "plan2code-app/package-lock.json": JSON.stringify({ version: "3.0.0", packages: { "": { version: "2.9.0" } } }),
    }),
  );
  assert.deepEqual(lock.problems, ['plan2code-app/package-lock.json (packages[""]) says 2.9.0, version.json says 3.0.0']);

  const fake = checkVersions(
    tree(t, "3.0.0", { "plan2code-app/fake-agent/Cargo.toml": '[package]\nname = "fake-agent"\nversion = "2.9.0"\n' }),
  );
  assert.deepEqual(fake.problems, ["plan2code-app/fake-agent/Cargo.toml says 2.9.0, version.json says 3.0.0"]);
});

test("versions: each Cargo.lock entry is read by its own name", (t) => {
  const stale = checkVersions(tree(t, "3.0.0", { "plan2code-app/Cargo.lock": cargoLock("3.0.0", "2.9.0") }));
  assert.deepEqual(stale.problems, ["plan2code-app/Cargo.lock (fake-agent) says 2.9.0, version.json says 3.0.0"]);
  const other = checkVersions(tree(t, "3.0.0", { "plan2code-app/Cargo.lock": cargoLock("2.9.0", "3.0.0") }));
  assert.deepEqual(other.problems, ["plan2code-app/Cargo.lock (plan2code-app) says 2.9.0, version.json says 3.0.0"]);
  const gone = checkVersions(
    tree(t, "3.0.0", { "plan2code-app/Cargo.lock": '[[package]]\nname = "chrono"\nversion = "0.4.0"\n' }),
  );
  assert.equal(gone.problems.length, 2);
  assert.match(gone.problems[0], /Cargo\.lock \(plan2code-app\): no version found/);
});

test("versions: the changelog's top heading is the one read", (t) => {
  const root = tree(t, "3.0.0", { "CHANGELOG.md": "# Changelog\n\n## v3.1.0\n\n## v3.0.0\n" });
  assert.match(checkVersions(root).problems[0], /CHANGELOG\.md says 3\.1\.0/);
});

test("versions: a missing file or an unreadable version is a problem, not a throw", (t) => {
  const root = tree(t, "3.0.0", { "plan2code-app/package.json": null, "CHANGELOG.md": "# Changelog\n" });
  const problems = checkVersions(root).problems;
  assert.ok(problems.some((p) => p.startsWith("plan2code-app/package.json: cannot be read")), problems.join("; "));
  assert.ok(problems.includes("CHANGELOG.md: no version found"), problems.join("; "));
});

test("versions: a release tag must name the same version, with or without the v", (t) => {
  const root = tree(t);
  assert.equal(checkVersions(root, { tag: "v3.0.0" }).ok, true);
  assert.equal(checkVersions(root, { tag: "3.0.0" }).ok, true);
  const bad = checkVersions(root, { tag: "v3.0.1" });
  assert.equal(bad.ok, false);
  assert.match(bad.problems[0], /release tag v3\.0\.1 names 3\.0\.1/);
});

test("versions: the command exits 0 on agreement and 1 on a mismatch", () => {
  // The real tree: the exit code and the output agree with each other, whatever it says today.
  const real = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(real.status, real.stderr.includes("MISMATCH") ? 1 : 0);
  const noTag = spawnSync(process.execPath, [SCRIPT, "--tag"], { encoding: "utf8" });
  assert.equal(noTag.status, 2);
});
