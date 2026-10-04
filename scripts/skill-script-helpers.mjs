// Shared helpers for the skill-script tests (scripts/test-*script*.mjs).
//
// The tests run the scripts the way an agent does: as `node <skill>/scripts/x.mjs`
// from the built skills/ tree, against throwaway fixtures in the OS temp dir,
// with the clock pinned by PLAN2CODE_NOW. They live in scripts/ so nothing
// here ships.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const SKILLS = path.join(ROOT, "skills");
export const NOW = "2026-08-03 14:05";

// Rebuild skills/ on every import, not only when it is missing: a test file run
// directly after an edit to src/ must not test a stale tree. The build is
// idempotent and takes well under a second.
execFileSync(process.execPath, [path.join(ROOT, "install.js"), "--build-skills"], { stdio: "ignore" });

export function runScript(skill, script, args, { cwd, env } = {}) {
  const r = spawnSync(process.execPath, [path.join(SKILLS, skill, "scripts", script), ...args], {
    cwd: cwd || ROOT,
    encoding: "utf8",
    env: { ...process.env, PLAN2CODE_NOW: NOW, GIT_CONFIG_NOSYSTEM: "1", ...env },
  });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

export function tmp(name) {
  return fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), `p2c-${name}-`));
}

export function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  return p;
}

export const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");

export function gitInit(dir, branch = "main") {
  const g = (...a) => execFileSync("git", a, { cwd: dir, stdio: "pipe", encoding: "utf8" });
  g("init", "-q", "-b", branch);
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "Test");
  g("config", "commit.gpgsign", "false");
  return g;
}

/** A phase-N.md in the Documentation template's shape. tasks: [[marker, id], ...] */
export function phase(n, status, tasks, extra = "") {
  return `# Phase ${n}: Name ${n}\n\n**Status:** ${status}\n**Estimated Tasks:** ${tasks.length}\n\n## Overview\n\nPhase ${n} builds the thing. More words here.\n\n## Prerequisites\n\n- Something exists\n\n## Tasks\n\n${tasks.map(([m, id]) => `- [${m}] **Task ${id}:** Do ${id}`).join("\n")}\n${extra}\n## Acceptance Criteria\n\n- It works\n`;
}
