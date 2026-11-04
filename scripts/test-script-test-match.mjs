// Tests for the shared test-match.mjs.
//
// No skill ships test-match.mjs yet, so these run it from src/skill-scripts/,
// where common.mjs, glob.mjs, test-map.mjs and review-scope.mjs sit beside it.
// See skill-script-helpers.mjs for the fixtures and the scrubbed git config.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync, execFileSync } from "node:child_process";
import { ROOT, NOW, scrubbedEnv, tmp, write, gitInit, gitIn, copyFixture, fixtureCleanup } from "./skill-script-helpers.mjs";

after(fixtureCleanup);

const SCRIPT = path.join(ROOT, "src", "skill-scripts", "test-match.mjs");
const SCOPE = path.join(ROOT, "src", "skill-scripts", "review-scope.mjs");

function runShared(args, { cwd, input } = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: cwd || ROOT, encoding: "utf8", input, env: scrubbedEnv({ PLAN2CODE_NOW: NOW }) });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch {}
  return { code: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

// A commit with pinned author and committer dates.
function commitAt(dir, date, msg, files = {}) {
  for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
  const env = { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date };
  execFileSync("git", ["add", "-A"], { cwd: dir, env, stdio: "pipe" });
  execFileSync("git", ["commit", "-q", "-m", msg], { cwd: dir, env, stdio: "pipe" });
}

const MAP = `# Project

## Test map

| Area | Paths | Run | Shared |
|---|---|---|---|
| Launcher | \`src/launcher/**\` | \`node --test scripts/test-launcher.mjs\` | no |
| Console | \`src/web-console/**\`, \`src/launcher/shared.js\` | \`node --test tests/console\` | yes |
`;

// One repo for covers and nearest: a test map, and tests found by name,
// by mirrored folder and by imports (JS, Python, Go).
function matchRepo() {
  return copyFixture("match", "match", (dir) => {
    gitInit(dir);
    commitAt(dir, "2026-07-01T12:00:00Z", "Start", {
      "AGENTS.md": MAP,
      "package.json": "{}\n",
      "src/launcher/a.js": "a\n",
      "src/launcher/shared.js": "s\n",
      "src/web-console/x.js": "x\n",
      "tests/console/server.test.js": "t\n",
      "tests/console/page.test.js": "t\n",
      "src/app/util.js": "u\n",
      "src/app/util.test.js": "t\n",
      "src/app/other.test.js": "t\n",
      "tests/app/mirror.test.js": "t\n",
      "tests/app/second.test.js": "t\n",
      "src/widget/button.js": "b\n",
      "src/widget/__tests__/button.js": "t\n",
      "src/lib/math.js": "m\n",
      "src/lib/alias.js": "al\n",
      "src/pkgdir/index.js": "i\n",
      "tests/calc.test.js": 'import { add } from "../src/lib/math";\nconst p = require("../src/pkgdir");\nimport x from "@/lib/alias";\nimport fs from "node:fs";\n',
      "pkg/__init__.py": "",
      "pkg/mod.py": "def thing(): pass\n",
      "tests/test_calc.py": "from pkg.mod import thing\n",
      "go.mod": "module example.com/m\n\ngo 1.21\n",
      "gosrc/util/u.go": "package util\n",
      "gotests/check_test.go": 'package gotests\n\nimport (\n\t"testing"\n\tu "example.com/m/gosrc/util"\n)\n',
      "fixtures/sample.json": "{}\n",
      "test/helpers/setup.js": "h\n",
    });
  });
}

/* ---------------------------------------------------------------- covers */

test("test-match covers: map rows, shared hits, hints and the fallback rules", () => {
  const dir = matchRepo();
  const files = ["src/launcher/a.js", "src/launcher/shared.js", "src/web-console/x.js", "src/app/util.js", "src/widget/button.js", "src/lib/math.js", "src/pkgdir/index.js", "src/lib/alias.js", "pkg/mod.py", "gosrc/util/u.go", "package.json", "fixtures/sample.json", "test/helpers/setup.js"];
  const r = runShared(["covers", "--files", files.join(",")], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.mapFound, true);
  assert.deepEqual(r.json.matched, [
    { area: "Launcher", run: "node --test scripts/test-launcher.mjs", shared: false, files: ["src/launcher/a.js", "src/launcher/shared.js"] },
    { area: "Console", run: "node --test tests/console", shared: true, files: ["src/launcher/shared.js", "src/web-console/x.js"] },
  ]);
  const un = Object.fromEntries(r.json.unmatched.map((u) => [u.file, u]));
  assert.deepEqual(Object.keys(un).sort(), files.slice(3).sort(), "every file no row covers is unmatched");
  assert.deepEqual(un["src/app/util.js"], { file: "src/app/util.js", tests: ["src/app/util.test.js"], method: "name" });
  assert.deepEqual(un["src/widget/button.js"], { file: "src/widget/button.js", tests: ["src/widget/__tests__/button.js"], method: "folder" });
  assert.deepEqual(un["src/lib/math.js"], { file: "src/lib/math.js", tests: ["tests/calc.test.js"], method: "imports" }, "an extensionless relative import");
  assert.deepEqual(un["src/pkgdir/index.js"], { file: "src/pkgdir/index.js", tests: ["tests/calc.test.js"], method: "imports" }, "a folder import resolves to its index");
  assert.deepEqual(un["src/lib/alias.js"], { file: "src/lib/alias.js", tests: [], method: null }, "an @/ alias is never guessed");
  assert.deepEqual(un["pkg/mod.py"], { file: "pkg/mod.py", tests: ["tests/test_calc.py"], method: "imports" });
  assert.deepEqual(un["gosrc/util/u.go"], { file: "gosrc/util/u.go", tests: ["gotests/check_test.go"], method: "imports" }, "a Go import through go.mod");
  assert.deepEqual(r.json.sharedHits, [
    { file: "src/launcher/shared.js", why: "row" },
    { file: "src/web-console/x.js", why: "row" },
    { file: "package.json", why: "config" },
    { file: "fixtures/sample.json", why: "fixture" },
    { file: "test/helpers/setup.js", why: "test-helper" },
  ]);
});

test("test-match covers: Windows-style --files input", () => {
  const dir = matchRepo();
  const r = runShared(["covers", "--files", "src\\launcher\\a.js"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.matched[0].files, ["src/launcher/a.js"]);
});

test("test-match covers --stdin: real review-scope.mjs output", () => {
  const dir = matchRepo();
  gitIn(dir)("checkout", "-q", "-b", "feature");
  commitAt(dir, "2026-07-02T12:00:00Z", "Change", { "src/launcher/a.js": "a2\n" });
  write(dir, "src/app/util.js", "u2\n");
  const scope = spawnSync(process.execPath, [SCOPE], { cwd: dir, encoding: "utf8", env: scrubbedEnv() });
  assert.equal(scope.status, 0, scope.stderr);
  const r = runShared(["covers", "--stdin"], { cwd: dir, input: scope.stdout });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.matched.map((m) => m.area), ["Launcher"]);
  assert.deepEqual(r.json.unmatched, [{ file: "src/app/util.js", tests: ["src/app/util.test.js"], method: "name" }]);
  assert.equal(runShared(["covers", "--stdin"], { cwd: dir, input: "not json" }).code, 2);
  assert.equal(runShared(["covers"], { cwd: dir }).code, 2);
});

test("test-match covers: no test map leaves every file unmatched, still exit 0", () => {
  const dir = tmp("match-nomap");
  write(dir, "a.js", "a\n");
  write(dir, "a.test.js", "t\n");
  const r = runShared(["covers", "--files", "a.js,b.js"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.mapFound, false);
  assert.deepEqual(r.json.matched, []);
  assert.deepEqual(r.json.unmatched, [
    { file: "a.js", tests: ["a.test.js"], method: "name" },
    { file: "b.js", tests: [], method: null },
  ]);
});

/* ------------------------------------------------------------------ gaps */

// Untested files changed on pinned dates: c newest, then a (two commits) and
// b (one) on the same day, then old (outside the 90-day window).
function gapsRepo() {
  return copyFixture("gaps", "gaps", (dir) => {
    gitInit(dir);
    commitAt(dir, "2026-01-01T12:00:00Z", "Old", { "src/old.js": "o\n", "src/d.js": "d\n", "src/d.test.js": "t\n", "src/types.d.ts": "x\n", "specs/x/a.js": "s\n", "vendor/v.js": "v\n", "README.md": "r\n" });
    commitAt(dir, "2026-07-01T12:00:00Z", "A", { "src/a.js": "a1\n" });
    commitAt(dir, "2026-07-20T12:00:00Z", "A and B", { "src/a.js": "a2\n", "src/b.js": "b1\n" });
    commitAt(dir, "2026-07-25T12:00:00Z", "C", { "src/sub/c.js": "c1\n" });
  });
}

test("test-match gaps --scope all: untested source files ranked by last change, then churn", () => {
  const dir = gapsRepo();
  const r = runShared(["gaps", "--scope", "all"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.gaps, [
    { file: "src/sub/c.js", area: null, runner: null, commits90d: 1, lastTouched: "2026-07-25" },
    { file: "src/a.js", area: null, runner: null, commits90d: 2, lastTouched: "2026-07-20" },
    { file: "src/b.js", area: null, runner: null, commits90d: 1, lastTouched: "2026-07-20" },
    { file: "src/old.js", area: null, runner: null, commits90d: 0, lastTouched: null },
  ]);
  assert.equal(r.json.scope, "all");
  assert.equal(r.json.scanned, 5, "tests, .d.ts, specs/, vendor/ and docs are not source files");
  assert.equal(r.json.covered, 1);
  assert.equal(r.json.capped, false);
});

test("test-match gaps --scope path and --scope branch", () => {
  const dir = gapsRepo();
  const p = runShared(["gaps", "--scope", "path", "--path", "src/sub"], { cwd: dir });
  assert.equal(p.code, 0, p.stderr);
  assert.deepEqual(p.json.gaps.map((x) => x.file), ["src/sub/c.js"]);
  assert.equal(runShared(["gaps", "--scope", "path"], { cwd: dir }).code, 2, "--scope path needs --path");

  gitIn(dir)("checkout", "-q", "-b", "feature");
  commitAt(dir, "2026-07-30T12:00:00Z", "Feature", { "src/feat.js": "f\n", "src/feat2.js": "g\n" });
  write(dir, "src/new.js", "n\n");
  const b = runShared(["gaps", "--scope", "branch"], { cwd: dir });
  assert.equal(b.code, 0, b.stderr);
  assert.deepEqual(b.json.gaps, [
    { file: "src/feat.js", area: null, runner: null, commits90d: 1, lastTouched: "2026-07-30" },
    { file: "src/feat2.js", area: null, runner: null, commits90d: 1, lastTouched: "2026-07-30" },
    { file: "src/new.js", area: null, runner: null, commits90d: 0, lastTouched: null },
  ]);
});

test("test-match gaps: a non-git folder walks the tree; --scope branch is exit 3", () => {
  const dir = tmp("match-nogit");
  write(dir, "src/a.js", "a\n");
  write(dir, "node_modules/x/i.js", "x\n");
  const r = runShared(["gaps", "--scope", "all"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.gaps, [{ file: "src/a.js", area: null, runner: null, commits90d: null, lastTouched: null }]);
  const b = runShared(["gaps", "--scope", "branch"], { cwd: dir });
  assert.equal(b.code, 3);
  assert.equal(b.json.error, "not-a-repo");
  assert.equal(runShared(["gaps"], { cwd: dir }).code, 2);
});

test("test-match gaps: any matching row with a run covers a file; a row without one only names its area", () => {
  const dir = tmp("match-rows");
  write(dir, "AGENTS.md", "## Test map\n\n| Area | Paths | Run | Shared |\n|---|---|---|---|\n| Source | `src/**` |  | no |\n| X | `src/x.js` | `npm t` | no |\n");
  write(dir, "src/x.js", "x\n");
  write(dir, "src/y.js", "y\n");
  write(dir, "src/m.ts", "m\n");
  write(dir, "src/m.test.mts", "t\n");
  const r = runShared(["gaps", "--scope", "all"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.gaps, [{ file: "src/y.js", area: "Source", runner: null, commits90d: null, lastTouched: null }]);
  assert.equal(r.json.covered, 2, "x.js by the second row, m.ts by its .mts test");
});

test("test-match gaps: capped at 2,000 source files", () => {
  const dir = tmp("match-cap");
  for (let i = 0; i < 2005; i++) write(dir, `src/f${String(i).padStart(4, "0")}.js`, "x\n");
  const r = runShared(["gaps", "--scope", "all"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.capped, true);
  assert.equal(r.json.scanned, 2000);
  assert.equal(r.json.gaps.length, 2000);
  assert.equal(r.json.gaps.at(-1).file, "src/f1999.js", "the first 2,000 by path");
});

/* --------------------------------------------------------------- nearest */

test("test-match nearest: own tests, then the same folder, then the mirrored folder, at most 3", () => {
  const dir = matchRepo();
  const r = runShared(["nearest", "--file", "src/app/util.js"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, file: "src/app/util.js", tests: ["src/app/util.test.js", "src/app/other.test.js", "tests/app/mirror.test.js"] });
  const m = runShared(["nearest", "--file", "src/app/new.js"], { cwd: dir });
  assert.deepEqual(m.json.tests, ["src/app/other.test.js", "src/app/util.test.js", "tests/app/mirror.test.js"]);
  assert.equal(runShared(["nearest"], { cwd: dir }).code, 2);
});

test("test-match nearest: the area's run path, then the nearest by shared folders", () => {
  const dir = matchRepo();
  const r = runShared(["nearest", "--file", "src/web-console/x.js"], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.tests.slice(0, 2), ["tests/console/page.test.js", "tests/console/server.test.js"], "the Console row's run names tests/console");
  assert.equal(r.json.tests.length, 3);
  const deep = runShared(["nearest", "--file", "src/widget/deep/z.js"], { cwd: dir });
  assert.equal(deep.json.tests[0], "src/widget/__tests__/button.js", "the test file sharing the most folders");
});

/* ------------------------------------------------- the project's own map */

test("test-match covers: AGENTS.md's Targeted tests first table, saved as a test map", () => {
  const dir = tmp("match-targeted");
  write(
    dir,
    "AGENTS.md",
    `## Test map

| Area | Paths | Run | Shared |
|---|---|---|---|
| Activities | \`src/web-console/public/activities/**\`, \`src/web-console/public/tones.js\`, \`src/web-console/public/music.js\` | \`node --test scripts/test-web-console-tones.mjs scripts/test-web-console-activities.mjs\` | no |
| Music prototype | \`prototypes/music/**\` | \`node prototypes/music/check.cjs\` | no |
| Web console area | \`src/web-console/**\` | \`node --test scripts/test-web-console-logic.mjs\` | no |
| Launcher | \`src/launcher/**\` | \`node --test scripts/test-launcher.mjs\` | no |
| Skill script | \`src/skill-scripts/**\`, \`src/plan2code-*-scripts/**\` | \`node --test scripts/test-skill-scripts.mjs\` | no |
| Workflow prompt | \`src/plan2code-*.md\` | \`node scripts/validate-char-count.js\` | no |
| Docs | \`**/*.md\` | \`node --test scripts/test-us-english.mjs scripts/test-line-endings.mjs\` | no |
`
  );
  const samples = {
    Activities: "src/web-console/public/activities/snake.js",
    "Music prototype": "prototypes/music/ghoul/index.html",
    "Web console area": "src/web-console/routes.mjs",
    Launcher: "src/launcher/plan2code.js",
    "Skill script": "src/plan2code-git-scripts/git.mjs",
    "Workflow prompt": "src/plan2code-3-implement.md",
    Docs: ".readme/web-console.md",
  };
  const r = runShared(["covers", "--files", Object.values(samples).join(",")], { cwd: dir });
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.unmatched, []);
  for (const [area, file] of Object.entries(samples)) {
    const row = r.json.matched.find((m) => m.area === area);
    assert.ok(row && row.files.includes(file), `${area} covers ${file}`);
  }
});
