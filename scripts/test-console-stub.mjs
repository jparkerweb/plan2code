// Tests for the shared console: each skill's forwarding stub (src/web-console-stub/console.mjs)
// and what the build leaves in skills/.
// Run with: node --test scripts/test-console-stub.mjs
//
// The stubs run from the built skills/ tree against a scratch PLAN2CODE_CONSOLE_HOME holding a
// fake shared copy, so nothing here starts a console server or touches ~/.plan2code.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

import { ROOT, SKILLS } from "./skill-script-helpers.mjs";

const require = createRequire(import.meta.url);
const HOME = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-console-stub-"));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
const { SOURCE_PROMPTS, generateSkillName, CONSOLE_SHARED_DIR } = require(path.join(ROOT, "install.js"));
test.after(() => fs.rmSync(HOME, { recursive: true, force: true }));

const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "version.json"), "utf8")).version;
const MESSAGE = "The Plan2Code console is missing or out of date. Run: plan2code update";

const consoleSkills = SOURCE_PROMPTS.filter((p) => (p.additionalReferences || []).some((r) => r.source === "web-console")).map(
  (p) => ({ name: generateSkillName(p), target: p.additionalReferences.find((r) => r.source === "web-console").target })
);

// A stand-in shared console: prints the arguments it was given and the exit code asked for.
function fakeConsole({ version = VERSION, pointer = true, entry = true } = {}) {
  const home = fs.mkdtempSync(path.join(HOME, "home-"));
  const dir = path.join(home, version);
  fs.mkdirSync(dir, { recursive: true });
  if (entry) {
    fs.writeFileSync(
      path.join(dir, "console.mjs"),
      'console.log(JSON.stringify({ args: process.argv.slice(2), home: process.env.PLAN2CODE_CONSOLE_HOME }));\nprocess.exitCode = Number(process.env.FAKE_EXIT || 0);\n'
    );
  }
  fs.writeFileSync(path.join(dir, "version.txt"), version + "\n");
  if (pointer) fs.writeFileSync(path.join(home, "console-dir"), dir + "\n");
  return { home, dir };
}

function runStub(skill, home, args = [], env = {}) {
  const stub = path.join(SKILLS, skill.name, "references", skill.target, "console.mjs");
  return spawnSync(process.execPath, [stub, ...args], {
    encoding: "utf8",
    env: { ...process.env, PLAN2CODE_CONSOLE_HOME: home, ...env },
  });
}

test("every skill that lists the console carries a stub", () => {
  assert.ok(consoleSkills.length >= 19, `expected the 19 skills, found ${consoleSkills.length}`);
  for (const skill of consoleSkills) {
    const stub = path.join(SKILLS, skill.name, "references", skill.target, "console.mjs");
    assert.ok(fs.existsSync(stub), `${skill.name} has no stub`);
    const text = fs.readFileSync(stub, "utf8");
    assert.ok(text.includes(`const VERSION = "${VERSION}";`), `${skill.name}: the version is not baked in`);
    assert.ok(!text.includes("__PLAN2CODE_VERSION__"), `${skill.name}: the version token is left in`);
  }
});

test("every stub forwards its arguments and exit code to the shared copy", () => {
  const { home } = fakeConsole();
  for (const skill of consoleSkills) {
    const args = ["open", "--workflow", skill.name, "--spec", "specs/x y"];
    const ok = runStub(skill, home, args);
    assert.equal(ok.status, 0, `${skill.name}: ${ok.stderr}`);
    assert.deepEqual(JSON.parse(ok.stdout).args, args, `${skill.name}: arguments`);
    const coded = runStub(skill, home, ["wait"], { FAKE_EXIT: "30" });
    assert.equal(coded.status, 30, `${skill.name}: the shared copy's exit code`);
    assert.equal(coded.stderr, "", `${skill.name}: nothing is added on stderr`);
  }
});

test("a missing or stale shared copy prints the one plain line and exits 5, naming no path", () => {
  const cases = {
    "no console-dir at all": () => fs.mkdtempSync(path.join(HOME, "empty-")),
    "a pointer to a folder that is gone": () => {
      const { home, dir } = fakeConsole();
      fs.rmSync(dir, { recursive: true, force: true });
      return home;
    },
    "a pointer to a source checkout with no version.txt": () => {
      const home = fs.mkdtempSync(path.join(HOME, "source-pointer-"));
      const source = fs.mkdtempSync(path.join(HOME, "source-"));
      fs.writeFileSync(path.join(source, "console.mjs"), "");
      fs.writeFileSync(path.join(home, "console-dir"), `${source}\n`);
      return home;
    },
    "a copy of another version": () => fakeConsole({ version: "0.0.1" }).home,
    "a copy with no console.mjs": () => fakeConsole({ entry: false }).home,
    "an empty pointer": () => {
      const home = fs.mkdtempSync(path.join(HOME, "empty-pointer-"));
      fs.writeFileSync(path.join(home, "console-dir"), "\n");
      return home;
    },
  };
  for (const [what, make] of Object.entries(cases)) {
    const home = make();
    for (const skill of consoleSkills) {
      const r = runStub(skill, home, ["open"]);
      assert.equal(r.status, 5, `${what} (${skill.name}): exit code`);
      assert.equal(r.stdout, "", `${what} (${skill.name}): stdout`);
      assert.equal(r.stderr, MESSAGE + "\n", `${what} (${skill.name}): the line`);
      assert.ok(!r.stderr.includes(home) && !/[\\/]/.test(r.stderr), `${what} (${skill.name}): names no path`);
    }
  }
});

test("a stub finds its own version folder even when console-dir names a console that is not this version", () => {
  const { home } = fakeConsole({ pointer: false });
  const elsewhere = fs.mkdtempSync(path.join(HOME, "elsewhere-"));
  fs.writeFileSync(path.join(home, "console-dir"), `${elsewhere}\n`);
  const res = runStub(consoleSkills[0], home, ["status"]);
  assert.equal(res.status, 0, res.stderr);
  assert.deepEqual(JSON.parse(res.stdout).args, ["status"]);
});

test("a stub finds the copy through console-dir under PLAN2CODE_CONSOLE_HOME and passes the home on", () => {
  const { home } = fakeConsole();
  const skill = consoleSkills[0];
  const r = runStub(skill, home, ["status"], { PLAN2CODE_CONSOLE_HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).home, home);
});

test("no built skill holds the large console files; the shared copy keeps every game, sound and vendor file", () => {
  const forbidden = new Set(["public", "activities", "vendor"]);
  const found = [];
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = path.join(rel, e.name);
      if (e.isDirectory()) {
        if (forbidden.has(e.name)) found.push(next);
        walk(path.join(dir, e.name), next);
      } else if (/\.(mp3|png|svg)$/.test(e.name) || /^(server|routes|files|sessions)\.mjs$/.test(e.name)) found.push(next);
    }
  };
  for (const entry of fs.readdirSync(SKILLS, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === CONSOLE_SHARED_DIR) continue;
    walk(path.join(SKILLS, entry.name), entry.name);
  }
  assert.deepEqual(found, [], "console files left inside a skill");

  const shared = path.join(SKILLS, CONSOLE_SHARED_DIR, VERSION);
  assert.equal(fs.readFileSync(path.join(shared, "version.txt"), "utf8").trim(), VERSION);
  const src = path.join(ROOT, "src", "web-console");
  const sourceFiles = [];
  const collect = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const next = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) collect(path.join(dir, e.name), next);
      else sourceFiles.push(next);
    }
  };
  collect(src, "");
  for (const rel of sourceFiles) {
    const built = path.join(shared, ...rel.split("/"));
    assert.ok(fs.existsSync(built), `the shared console lacks ${rel}`);
    assert.ok(fs.readFileSync(built).equals(fs.readFileSync(path.join(src, ...rel.split("/")))), `${rel} differs from src/`);
  }
  assert.ok(fs.existsSync(path.join(shared, "public", "vendor", "codemirror.esm.js")), "codemirror ships");
  assert.ok(fs.readdirSync(path.join(shared, "public")).filter((f) => f.endsWith(".mp3")).length >= 3, "every sound ships");
});

test("the shared copy ships a module for every game listed in public/activities.js", async () => {
  const { ACTIVITIES } = await import(pathToFileURL(path.join(ROOT, "src", "web-console", "public", "activities.js")).href);
  assert.ok(ACTIVITIES.length >= 13, `expected the thirteen games, found ${ACTIVITIES.length}`);
  const shared = path.join(SKILLS, CONSOLE_SHARED_DIR, VERSION, "public");
  for (const game of ACTIVITIES) {
    assert.ok(fs.existsSync(path.join(shared, ...game.module.split("/").filter(Boolean))), `${game.id}: ${game.module} is not in the shared console`);
  }
});

test("a skill keeps the markdown the agent reads by path, and notes/", () => {
  for (const skill of consoleSkills) {
    const dir = path.join(SKILLS, skill.name, "references", skill.target);
    for (const file of ["console.md", "building.md", "console-finish.md"]) assert.ok(fs.existsSync(path.join(dir, file)), `${skill.name}: ${file}`);
    assert.ok(fs.existsSync(path.join(dir, "notes", "implement.md")), `${skill.name}: notes/implement.md`);
  }
});
