// Tests for the shared test-map.mjs (shipped in plan2code-init) and glob.mjs.
//
// See skill-script-helpers.mjs for how these run.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runScript, tmp, write, read } from "./skill-script-helpers.mjs";
import { toPosix, globToRegExp, matchGlob, unsupported } from "../src/skill-scripts/glob.mjs";

const T = (cwd, args) => runScript("plan2code-init", "test-map.mjs", args, { cwd });

const TABLE = "| Area | Paths | Run | Shared |\n|---|---|---|---|\n| Launcher | `src/launcher/**` | `node --test scripts/test-launcher.mjs` | no |\n";

function project(agents, files = {}) {
  const dir = tmp("test-map");
  if (agents !== null) write(dir, "AGENTS.md", agents);
  for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
  return dir;
}

function rowsFile(dir, rows) {
  return write(dir, "rows.json", JSON.stringify(rows));
}

const NEW_TABLE =
  "| Area | Paths | Run | Shared |\n|---|---|---|---|\n| Console | `src/web-console/**`, `scripts/test-web-console-*.mjs` | `node --test scripts/test-web-console-logic.mjs` | no |\n| Helpers | `scripts/*-helpers.mjs` | `npm test` | yes |\n";

const ROWS = [
  { area: "Console", paths: ["src/web-console/**", "scripts/test-web-console-*.mjs"], run: "node --test scripts/test-web-console-logic.mjs", shared: false },
  { area: "Helpers", paths: ["scripts/*-helpers.mjs"], run: "npm test", shared: true },
];

/* ------------------------------------------------------------------ read */

test("test-map read: a table in AGENTS.md", () => {
  const dir = project(`# Project\n\n## Test map\n\nWhich checks cover what.\n\n${TABLE}\n## Next\n\nMore.\n`);
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, {
    ok: true,
    found: true,
    source: "AGENTS.md",
    rows: [{ area: "Launcher", paths: ["src/launcher/**"], run: "node --test scripts/test-launcher.mjs", shared: false }],
    problems: [],
  });
});

test("test-map read: a section linking to .agents-docs/AGENTS-test-map.md reads that file", () => {
  const dir = project("# P\n\n## Test map\n\nDetails: [Test map](./.agents-docs/AGENTS-test-map.md)\n", {
    ".agents-docs/AGENTS-test-map.md": `# Test map\n\n> Part of [AGENTS.md](../AGENTS.md).\n\nSee [other](./AGENTS-other.md).\n\n${TABLE}`,
    ".agents-docs/AGENTS-other.md": `# Other\n\n${TABLE.replace("Launcher", "Wrong")}`,
  });
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.source, ".agents-docs/AGENTS-test-map.md");
  assert.equal(r.json.rows.length, 1);
  assert.equal(r.json.rows[0].area, "Launcher", "follows exactly one link, never a link from the linked file");
  const bare = project("## Test map\n\nSee [map](.agents-docs/AGENTS-test-map.md).\n", { ".agents-docs/AGENTS-test-map.md": TABLE });
  assert.equal(T(bare, ["read"]).json.source, ".agents-docs/AGENTS-test-map.md", "the ](.agents-docs/...) form works too");
});

test("test-map read and write: a link outside .agents-docs/ is a problem, and write refuses", () => {
  const dir = project("## Test map\n\nSee [map](./docs/test-map.md).\n", { "docs/test-map.md": TABLE });
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.found, true);
  assert.deepEqual(r.json.rows, []);
  assert.match(r.json.problems[0], /outside \.agents-docs\//);
  rowsFile(dir, ROWS);
  const w = T(dir, ["write", "--rows", "rows.json"]);
  assert.equal(w.code, 5);
  assert.equal(w.json.error, "link-outside");
});

test("test-map read: headers in any order and case, extra columns ignored", () => {
  const dir = project("## Test Map\n\n| run | SHARED | Notes | paths | area |\n|:---|---|---|---|---:|\n| `npm t` | Yes | x | `a/**`, b/*.js , `c/{d,e}.ts` | Core |\n");
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.rows, [{ area: "Core", paths: ["a/**", "b/*.js", "c/{d,e}.ts"], run: "npm t", shared: true }]);
  assert.deepEqual(r.json.problems, []);
});

test("test-map read: a missing Run column is a problem and no rows are returned", () => {
  const dir = project("## Test map\n\n| Area | Paths | Shared |\n|---|---|---|\n| A | `a/**` | no |\n");
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.rows, []);
  assert.match(r.json.problems[0], /no Run column/);
});

test("test-map read: Shared values, unsupported globs and escaped pipes", () => {
  const dir = project(
    "## Test map\n\n| Area | Paths | Run | Shared |\n|---|---|---|---|\n| One | `a/**` | `x \\| y` | Yes |\n| Two | b/** | y | no |\n| Three | c/** | z | maybe |\n| Four | `src/[ab]/*.js`, `ok/**` | w | NO |\n| Five | `src/[ab]/*.js` | v | no |\n"
  );
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  const [one, two, three, four, five] = r.json.rows;
  assert.equal(one.shared, true);
  assert.equal(one.run, "x | y", "an escaped pipe stays inside its cell");
  assert.equal(two.shared, false);
  assert.equal(three.shared, false);
  assert.deepEqual(four.paths, ["ok/**"], "the unsupported glob is dropped from the row");
  assert.equal(four.shared, false);
  assert.deepEqual(five.paths, [], "a row left with no paths");
  assert.equal(r.json.problems.length, 3);
  assert.ok(r.json.problems.some((p) => /Row 3 \(Three\).*"maybe"/.test(p)));
  assert.ok(r.json.problems.some((p) => /Row 4 \(Four\).*src\/\[ab\]\/\*\.js/.test(p)));
});

test("test-map read: a table inside a code fence is ignored, and so is a heading there", () => {
  const fenced = project("# P\n\n```md\n## Test map\n\n" + TABLE + "```\n");
  assert.equal(T(fenced, ["read"]).json.found, false, "a heading inside a fence is not the section");
  const dir = project("## Test map\n\n```\n" + TABLE + "```\n\n" + TABLE.replace("Launcher", "Real"));
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.equal(r.json.rows.length, 1);
  assert.equal(r.json.rows[0].area, "Real");
});

test("test-map read: no heading is found: false; no AGENTS.md is exit 3", () => {
  const r = T(project("# P\n\n## Commands\n\nnpm test\n"), ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json, { ok: true, found: false, source: null, rows: [], problems: [] });
  const none = T(project(null), ["read"]);
  assert.equal(none.code, 3);
  assert.equal(none.json.error, "no-agents-md");
});

/* ----------------------------------------------------------------- write */

// Every line of `before` outside the table is in `after`, in order and unchanged.
function outsideTableUnchanged(before, after) {
  const strip = (t) => t.split("\n").filter((l) => !/^\|/.test(l));
  const b = strip(before);
  const a = strip(after);
  let i = 0;
  for (const line of a) if (line === b[i]) i++;
  assert.equal(i, b.length, "every line outside the table is kept");
}

function roundTrip(dir) {
  const r = T(dir, ["read"]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(r.json.rows, ROWS);
  assert.deepEqual(r.json.problems, []);
}

test("test-map write: no heading appends a Test map section", () => {
  const before = "# P\n\n## Commands\n\nnpm test\n";
  const dir = project(before);
  rowsFile(dir, ROWS);
  const w = T(dir, ["write", "--rows", "rows.json"]);
  assert.equal(w.code, 0, w.stderr);
  assert.deepEqual(w.json, { ok: true, written: true, source: "AGENTS.md", dryRun: false });
  const after = read(dir, "AGENTS.md");
  assert.ok(after.startsWith(before), "the old text is untouched");
  assert.equal(
    after.slice(before.length),
    "\n## Test map\n\n| Area | Paths | Run | Shared |\n|---|---|---|---|\n| Console | `src/web-console/**`, `scripts/test-web-console-*.mjs` | `node --test scripts/test-web-console-logic.mjs` | no |\n| Helpers | `scripts/*-helpers.mjs` | `npm test` | yes |\n"
  );
  roundTrip(dir);
});

test("test-map write: a heading with no table gets one after its first paragraph", () => {
  const before = "# P\n\n## Test map\n\nWhich checks cover\nwhich files.\n\nA second paragraph.\n\n## Next\n\nMore.\n";
  const dir = project(before);
  rowsFile(dir, ROWS);
  assert.equal(T(dir, ["write", "--rows", "rows.json"]).code, 0);
  const after = read(dir, "AGENTS.md");
  assert.match(after, /which files\.\n\n\| Area \| Paths \| Run \| Shared \|\n[\s\S]*\| yes \|\n\nA second paragraph\./);
  outsideTableUnchanged(before, after);
  roundTrip(dir);
  const bare = project("## Test map\n\n## Next\n");
  rowsFile(bare, ROWS);
  assert.equal(T(bare, ["write", "--rows", "rows.json"]).code, 0);
  assert.match(read(bare, "AGENTS.md"), /^## Test map\n\n\| Area [\s\S]*\| yes \|\n\n## Next\n$/, "directly under a heading with no paragraph");
});

test("test-map write: an existing table is replaced in place, every other line byte-identical", () => {
  const before = `# P\n\nIntro.\n\n## Test map\n\nWhich checks.\n\n${TABLE}| Old | \`old/**\` | \`x\` | no |\n\nAfter the table.\n\n## Next\n\nMore.\n`;
  const dir = project(before);
  rowsFile(dir, ROWS);
  assert.equal(T(dir, ["write", "--rows", "rows.json"]).code, 0);
  const after = read(dir, "AGENTS.md");
  assert.equal(after, before.replace(`${TABLE}| Old | \`old/**\` | \`x\` | no |\n`, NEW_TABLE), "only the table changed");
  roundTrip(dir);
  const again = T(dir, ["write", "--rows", "rows.json"]);
  assert.equal(again.json.written, false, "unchanged rows write nothing");
});

test("test-map write: a CRLF AGENTS.md keeps its line endings", () => {
  const before = `# P\r\n\r\n## Test map\r\n\r\nWhich checks.\r\n\r\n${TABLE.replace(/\n/g, "\r\n")}\r\n## Next\r\n\r\nMore.\r\n`;
  const dir = project(before);
  rowsFile(dir, ROWS);
  assert.equal(T(dir, ["write", "--rows", "rows.json"]).code, 0);
  const after = read(dir, "AGENTS.md");
  assert.ok(!/[^\r]\n/.test(after), "every line ends in CRLF");
  assert.equal(after, before.replace(TABLE.replace(/\n/g, "\r\n"), NEW_TABLE.replace(/\n/g, "\r\n")), "only the table changed");
  roundTrip(dir);
});

test("test-map write: a linked file's table is replaced there, AGENTS.md untouched", () => {
  const agents = "# P\n\n## Test map\n\nDetails: [Test map](./.agents-docs/AGENTS-test-map.md)\n";
  const linked = `# Test map\n\n> Part of [AGENTS.md](../AGENTS.md).\n\n${TABLE}\nTrailing note.\n`;
  const dir = project(agents, { ".agents-docs/AGENTS-test-map.md": linked });
  rowsFile(dir, ROWS);
  const w = T(dir, ["write", "--rows", "rows.json"]);
  assert.equal(w.code, 0, w.stderr);
  assert.equal(w.json.source, ".agents-docs/AGENTS-test-map.md");
  assert.equal(read(dir, "AGENTS.md"), agents);
  outsideTableUnchanged(linked, read(dir, ".agents-docs/AGENTS-test-map.md"));
  roundTrip(dir);
});

test("test-map write: --dry-run writes nothing", () => {
  const before = "# P\n";
  const dir = project(before);
  rowsFile(dir, ROWS);
  const w = T(dir, ["write", "--rows", "rows.json", "--dry-run"]);
  assert.equal(w.code, 0, w.stderr);
  assert.deepEqual(w.json, { ok: true, written: false, source: "AGENTS.md", dryRun: true });
  assert.equal(read(dir, "AGENTS.md"), before);
});

test("test-map write: invalid rows are exit 4 with the row index; no AGENTS.md is exit 3", () => {
  const dir = project("# P\n");
  rowsFile(dir, [ROWS[0], { area: "B", paths: [], run: "x" }]);
  const w = T(dir, ["write", "--rows", "rows.json"]);
  assert.equal(w.code, 4);
  assert.equal(w.json.row, 1);
  assert.equal(read(dir, "AGENTS.md"), "# P\n");
  const none = project(null);
  rowsFile(none, ROWS);
  assert.equal(T(none, ["write", "--rows", "rows.json"]).code, 3);
  assert.ok(!fs.existsSync(path.join(none, "AGENTS.md")));
  assert.equal(T(dir, ["write"]).code, 2, "--rows is required");
});

/* ------------------------------------------------------------------ glob */

test("glob: ** at the start, middle and end", () => {
  assert.ok(matchGlob("**/test/**", "test/a.js"));
  assert.ok(matchGlob("**/test/**", "a/b/test/c/d.js"));
  assert.ok(matchGlob("**/*.md", "README.md"));
  assert.ok(matchGlob("**/*.md", "docs/x/y.md"));
  assert.ok(matchGlob("src/**/a.js", "src/a.js"));
  assert.ok(matchGlob("src/**/a.js", "src/x/y/a.js"));
  assert.ok(!matchGlob("src/**/a.js", "src/xa.js"));
  assert.ok(matchGlob("src/**", "src/a.js"));
  assert.ok(matchGlob("src/**", "src/x/y/a.js"));
  assert.ok(!matchGlob("src/**", "srcx/a.js"));
  assert.ok(matchGlob("**", "any/thing.js"));
});

test("glob: * and ? stay inside one folder; a bare name matches only at the root", () => {
  assert.ok(matchGlob("src/*.js", "src/a.js"));
  assert.ok(!matchGlob("src/*.js", "src/x/a.js"));
  assert.ok(matchGlob("src/?.js", "src/a.js"));
  assert.ok(!matchGlob("src/?.js", "src/ab.js"));
  assert.ok(!matchGlob("src/?.js", "src//.js"));
  assert.ok(matchGlob("package.json", "package.json"));
  assert.ok(!matchGlob("package.json", "a/package.json"));
  assert.ok(matchGlob("**/package.json", "a/package.json"));
});

test("glob: {a,b} alternation, literal dots and parentheses", () => {
  assert.ok(matchGlob("src/*.{js,ts}", "src/a.ts"));
  assert.ok(matchGlob("{lib,src}/**", "lib/x.js"));
  assert.ok(!matchGlob("src/*.{js,ts}", "src/a.tsx"));
  assert.ok(!matchGlob("a.js", "axjs"), "a dot is literal");
  assert.ok(matchGlob("docs/(old)/a+b.md", "docs/(old)/a+b.md"), "parentheses and + are literal");
  assert.ok(!matchGlob("docs/(old)/a+b.md", "docs/old/aab.md"));
  assert.ok(globToRegExp("a.js") instanceof RegExp);
});

test("glob: Windows backslash input and unsupported syntax", () => {
  assert.equal(toPosix("src\\a\\b.js"), "src/a/b.js");
  assert.equal(toPosix("./src/a.js"), "src/a.js");
  assert.ok(matchGlob("src/**", "src\\a\\b.js"));
  assert.ok(matchGlob("src\\*.js", "src/a.js"));
  assert.match(unsupported("src/[ab]/*.js"), /character classes/);
  assert.match(unsupported("!src/**"), /negation/);
  assert.match(unsupported("{a,{b,c}}"), /nested/);
  assert.match(unsupported("src/***"), /\*\*\*/);
  assert.equal(unsupported("src/**/*.{js,ts}"), null);
  assert.ok(!matchGlob("src/[ab].js", "src/a.js"), "an unsupported glob matches nothing");
  assert.throws(() => globToRegExp("src/[ab].js"));
});
