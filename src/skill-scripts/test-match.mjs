#!/usr/bin/env node
// test-match.mjs: files to tests, in both directions.
//
// pr-prep asks which checks cover a branch's changed files; test asks which
// source files no test covers, and which existing tests to read for style.
// Both answers come from the same rules, in the same order: the project's
// test map first, then name, folder and import matching. Anything these rules
// cannot settle (a path alias, a bare package name) is left unmatched for the
// agent to judge, never guessed.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXIT, HERE, fail, out, parseArgs, run, readText, isDir, now } from "./common.mjs";
import { toPosix, matchGlob } from "./glob.mjs";
import { readTestMap } from "./test-map.mjs";

const USAGE = `
test-match.mjs: match files to tests, both ways. JSON on stdout.

  node test-match.mjs covers (--files <a,b,...> | --stdin) [--root <dir>]
      Changed files to the checks that cover them. --stdin takes
      review-scope.mjs JSON (files[].path). matched: test map rows that cover
      at least one file, in table order. unmatched: { file, tests, method }
      for every file no row covers; tests and method come from the name,
      folder and import rules (method null when nothing was found).
      sharedHits: { file, why }: why is "row" (a Shared: yes row) or a hint
      for the agent to judge ("config", "test-helper", "fixture").

  node test-match.mjs gaps --scope branch|all|path [--path <p>] [--base <b>] [--root <dir>]
      Source files no test covers: { file, area, runner, commits90d,
      lastTouched }, newest first, then by commits in the last 90 days.
      branch: the files review-scope.mjs reports; all: every tracked file;
      path: every file under --path. Capped at 2,000 source files (capped).

  node test-match.mjs nearest --file <f> [--root <dir>]
      Up to 3 existing test files to read for the project's test style.

Exit: 0 ok · 2 bad arguments · 3 not a git repository, or review-scope.mjs
not beside this script (gaps --scope branch).
`;

/* ------------------------------------------------------------- files */

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor", "target", ".venv"]);
const TEST_DIRS = new Set(["test", "tests", "__tests__", "spec"]);
const CODE_EXT = new Set(["js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "go", "rs", "java", "kt", "cs", "rb", "php", "swift"]);
const SOURCE_SKIP = new Set(["node_modules", "vendor", "dist", "build", "target", ".venv", "specs", "specs--completed"]);
const CAP = 2000;

const fold = (s) => (process.platform === "win32" ? s.toLowerCase() : s);
const extOf = (p) => (path.posix.extname(p).slice(1) || "").toLowerCase();
const baseOf = (p) => path.posix.basename(p);
const dirOf = (p) => {
  const d = path.posix.dirname(p);
  return d === "." ? "" : d;
};
const segs = (d) => (d ? d.split("/") : []);

function git(root, args) {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return null;
  }
}

const inGit = (root) => git(root, ["rev-parse", "--show-toplevel"]) !== null;

function walk(root) {
  const found = [];
  const visit = (dir, relDir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const r = relDir ? `${relDir}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (!SKIP_DIRS.has(e.name)) visit(path.join(dir, e.name), r);
      } else if (e.isFile()) found.push(r);
    }
  };
  visit(root, "");
  return found;
}

// Every file in the project, once per run: tracked plus untracked files git
// does not ignore, or a walk outside git. Paths relative to root.
const fileLists = new Map();
function allFiles(root) {
  if (!fileLists.has(root)) {
    let list;
    if (inGit(root)) {
      const tracked = (git(root, ["ls-files"]) || "").split("\n");
      const untracked = (git(root, ["ls-files", "--others", "--exclude-standard"]) || "").split("\n");
      list = [...new Set([...tracked, ...untracked].filter(Boolean))].filter((f) => fs.existsSync(path.join(root, f)));
    } else list = walk(root);
    fileLists.set(root, list.map(toPosix).sort());
  }
  return fileLists.get(root);
}

/** Is this path a test file by name or by folder? */
export function isTestFile(p) {
  const file = toPosix(p);
  const base = baseOf(file);
  if (/\.(test|spec)\.[^./]+$/i.test(base)) return true;
  if (/^test_.+\.py$/i.test(base) || /_test\.py$/i.test(base) || /_test\.go$/i.test(base)) return true;
  if (/Tests?\.(java|kt|cs)$/.test(base)) return true;
  return segs(dirOf(file)).some((s) => TEST_DIRS.has(s));
}

/** The project's test files with a code extension. */
export function listTestFiles(root) {
  return allFiles(root).filter((f) => isTestFile(f) && (CODE_EXT.has(extOf(f)) || JS_EXT.has(extOf(f))));
}

/* ------------------------------------------------------- name and folder */

// A file's name without its extension and without test markers:
// foo.test.js, test_foo.py, foo_test.go and FooTests.cs all give "foo"/"Foo".
function stemOf(p) {
  const base = baseOf(p);
  const dot = base.lastIndexOf(".");
  let stem = dot > 0 ? base.slice(0, dot) : base;
  stem = stem.replace(/\.(test|spec)$/i, "");
  if (/^test_/i.test(stem) && extOf(p) === "py") stem = stem.slice(5);
  stem = stem.replace(/_test$/i, "");
  if (/^(java|kt|cs)$/.test(extOf(p))) stem = stem.replace(/Tests?$/, "");
  return stem;
}

function nameMatch(source, test) {
  const ext = extOf(source);
  const stem = stemOf(source);
  const base = baseOf(test);
  const tdot = base.lastIndexOf(".");
  const tname = tdot > 0 ? base.slice(0, tdot) : base;
  const same = (a, b) => fold(a) === fold(b);
  if (ext === "py") return extOf(test) === "py" && (same(tname, `test_${stem}`) || same(tname, `${stem}_test`));
  if (ext === "go") return same(test, `${dirOf(source) ? `${dirOf(source)}/` : ""}${stem}_test.go`);
  if (ext === "cs" || ext === "java" || ext === "kt") return extOf(test) === ext && (same(tname, `${stem}Tests`) || same(tname, `${stem}Test`));
  const text = extOf(test);
  if (JS_EXT.has(ext) ? !JS_EXT.has(text) : text !== ext) return false;
  return same(tname, `${stem}.test`) || same(tname, `${stem}.spec`);
}

// Does the test file sit in a test folder that mirrors the source file's
// folder? src/a/b.js mirrors to src/a/__tests__/, tests/a/, test/src/a/ and
// the like: the part of the path before the test folder must be an ancestor of
// the source, and the part after it the rest of the source's folder (with a
// leading src/ or lib/ optional).
function mirrors(source, test) {
  const sd = segs(dirOf(source)).map(fold);
  const td = segs(dirOf(test)).map(fold);
  const k = td.findIndex((s) => TEST_DIRS.has(s));
  if (k === -1) return false;
  const prefix = td.slice(0, k);
  const rest = td.slice(k + 1);
  if (prefix.some((s, i) => sd[i] !== s)) return false;
  const remaining = sd.slice(prefix.length);
  const eq = (a, b) => a.length === b.length && a.every((s, i) => s === b[i]);
  if (eq(remaining, rest)) return true;
  return (remaining[0] === "src" || remaining[0] === "lib") && eq(remaining.slice(1), rest);
}

const folderMatch = (source, test) => mirrors(source, test) && fold(stemOf(source)) === fold(stemOf(test));

/* --------------------------------------------------------------- imports */

const JS_EXT = new Set(["js", "mjs", "cjs", "ts", "tsx", "jsx", "mts", "cts"]);
const JS_TRY = ["", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"];
const JS_PATTERNS = [
  /\bimport\s+(?:[\w*{}\s,$]+?\s+from\s+)?["']([^"'\n]+)["']/g,
  /\bexport\s+[\w*{}\s,$]+?\s+from\s+["']([^"'\n]+)["']/g,
  /\brequire\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
  /\bimport\s*\(\s*["']([^"'\n]+)["']\s*\)/g,
];

const isFile = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};

// Repo-relative path for `p` (already posix, relative to root), or null when
// it climbs out of the project.
const inside = (p) => {
  const n = path.posix.normalize(p);
  return n === ".." || n.startsWith("../") || path.posix.isAbsolute(n) ? null : n;
};

function resolveJs(root, test, spec) {
  if (!spec.startsWith("./") && !spec.startsWith("../")) return [];
  const target = inside(path.posix.join(dirOf(test) || ".", spec));
  if (!target) return [];
  for (const ext of JS_TRY) if (isFile(path.join(root, target + ext))) return [target + ext];
  for (const ext of JS_TRY.slice(1)) if (isFile(path.join(root, `${target}/index${ext}`))) return [`${target}/index${ext}`];
  return [];
}

function resolvePyModule(root, bases, dotted) {
  const rel = dotted.split(".").filter(Boolean).join("/");
  if (!rel) return [];
  for (const base of bases) {
    const p = inside(base ? `${base}/${rel}` : rel);
    if (!p) continue;
    if (isFile(path.join(root, `${p}.py`))) return [`${p}.py`];
    if (isFile(path.join(root, `${p}/__init__.py`))) return [`${p}/__init__.py`];
  }
  return [];
}

function pythonImports(root, test, text) {
  const found = [];
  const own = dirOf(test);
  for (const m of text.matchAll(/^[ \t]*import[ \t]+([\w.]+(?:[ \t]*,[ \t]*[\w.]+)*)/gm)) {
    for (const name of m[1].split(",")) found.push(...resolvePyModule(root, ["", own], name.trim()));
  }
  for (const m of text.matchAll(/^[ \t]*from[ \t]+(\.*)([\w.]*)[ \t]+import[ \t]+\(?([\w\s,]+)/gm)) {
    const dots = m[1].length;
    const mod = m[2];
    const names = m[3].split(",").map((s) => s.trim().split(/\s+/)[0]).filter(Boolean);
    let bases;
    if (dots) {
      let base = own;
      for (let i = 1; i < dots; i++) base = dirOf(base);
      bases = [base];
    } else bases = ["", own];
    if (mod) found.push(...resolvePyModule(root, bases, mod));
    for (const n of names) found.push(...resolvePyModule(root, bases, mod ? `${mod}.${n}` : n));
  }
  return found;
}

// The module path and folder of the go.mod nearest to `file`, walking up.
const goMods = new Map();
function goModFor(root, file) {
  let dir = dirOf(file);
  for (;;) {
    const key = `${root}\0${dir}`;
    if (!goMods.has(key)) {
      const text = readText(path.join(root, dir, "go.mod"));
      const m = text && text.match(/^module\s+(\S+)/m);
      goMods.set(key, m ? { module: m[1], dir } : null);
    }
    if (goMods.get(key)) return goMods.get(key);
    if (!dir) return null;
    dir = dirOf(dir);
  }
}

// Go imports name packages: the result is folders, prefixed "dir:".
function goImports(root, test, text) {
  const mod = goModFor(root, test);
  if (!mod) return [];
  const specs = [];
  for (const m of text.matchAll(/^\s*import\s+(?:[\w.]+\s+)?"([^"]+)"/gm)) specs.push(m[1]);
  for (const m of text.matchAll(/^\s*import\s*\(([\s\S]*?)\)/gm)) {
    for (const l of m[1].matchAll(/(?:^|\n)\s*(?:[\w.]+\s+)?"([^"]+)"/g)) specs.push(l[1]);
  }
  const found = [];
  for (const s of specs) {
    if (s !== mod.module && !s.startsWith(`${mod.module}/`)) continue;
    const sub = s.slice(mod.module.length).replace(/^\//, "");
    const dir = inside([mod.dir, sub].filter(Boolean).join("/") || ".");
    if (dir) found.push(`dir:${dir === "." ? "" : dir}`);
  }
  return found;
}

// Source path (or "dir:<folder>" for Go) to the test files that import it,
// built once per root from every test file.
const importIndexes = new Map();
function importIndex(root, testFiles) {
  if (importIndexes.has(root)) return importIndexes.get(root);
  const index = new Map();
  const add = (target, test) => {
    const k = fold(target);
    if (!index.has(k)) index.set(k, new Set());
    index.get(k).add(test);
  };
  for (const test of testFiles) {
    const ext = extOf(test);
    if (!JS_EXT.has(ext) && ext !== "py" && ext !== "go") continue;
    const text = readText(path.join(root, test));
    if (text === null || text.length > 2 * 1024 * 1024) continue;
    if (JS_EXT.has(ext)) {
      for (const re of JS_PATTERNS) for (const m of text.matchAll(re)) for (const t of resolveJs(root, test, m[1])) add(t, test);
    } else if (ext === "py") for (const t of pythonImports(root, test, text)) add(t, test);
    else for (const t of goImports(root, test, text)) add(t, test);
  }
  importIndexes.set(root, index);
  return index;
}

/**
 * The tests that cover `file` after the test map: by name, then by mirrored
 * folder, then by imports. `{ tests, method }`, method null when none did.
 */
export function findTests(root, file, testFiles = listTestFiles(root)) {
  const f = toPosix(file);
  const others = testFiles.filter((t) => fold(t) !== fold(f));
  const byName = others.filter((t) => nameMatch(f, t));
  if (byName.length) return { tests: byName, method: "name" };
  const byFolder = others.filter((t) => folderMatch(f, t));
  if (byFolder.length) return { tests: byFolder, method: "folder" };
  const index = importIndex(root, testFiles);
  const hits = new Set([...(index.get(fold(f)) || [])]);
  if (extOf(f) === "go" && !isTestFile(f)) for (const t of index.get(fold(`dir:${dirOf(f)}`)) || []) hits.add(t);
  hits.delete(f);
  if (hits.size) return { tests: [...hits].sort(), method: "imports" };
  return { tests: [], method: null };
}

/* ---------------------------------------------------------------- covers */

const CONFIG_NAMES = new Set(["package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "jsconfig.json", "pytest.ini", "pyproject.toml", "setup.cfg", "tox.ini", "go.mod", "go.sum", "cargo.toml", "makefile", "directory.build.props"]);

/** A shared-ground hint for a file the agent should judge, or null. */
export function hintFor(file) {
  const f = toPosix(file);
  const base = baseOf(f);
  const lower = base.toLowerCase();
  const dirs = segs(dirOf(f));
  if (CONFIG_NAMES.has(lower) || /^tsconfig.*\.json$/i.test(base) || /\.config\.(js|cjs|mjs|ts)$/i.test(base) || /^\.babelrc/i.test(base) || /\.csproj$/i.test(base)) return "config";
  if (dirs.some((d) => ["fixtures", "__fixtures__", "testdata"].includes(d))) return "fixture";
  if (dirs.some((d) => ["helpers", "test-utils", "testutils", "support"].includes(d))) return "test-helper";
  if (/helpers/i.test(base) && /\.(js|mjs|ts|py|go)$/i.test(base) && dirs.some((d) => TEST_DIRS.has(d))) return "test-helper";
  return null;
}

const rowMatches = (row, file) => row.paths.some((g) => matchGlob(g, file));

function covers(root, files) {
  const map = readTestMap(root);
  const rows = map.found ? map.rows : [];
  const matched = rows.map((r) => ({ area: r.area, run: r.run, shared: r.shared, files: [] }));
  const unmatched = [];
  const sharedHits = [];
  let testFiles;
  for (const file of files) {
    let hit = false;
    let sharedRow = false;
    rows.forEach((r, i) => {
      if (!rowMatches(r, file)) return;
      hit = true;
      matched[i].files.push(file);
      if (r.shared) sharedRow = true;
    });
    if (!hit) {
      testFiles ||= listTestFiles(root);
      const { tests, method } = findTests(root, file, testFiles);
      unmatched.push({ file, tests, method });
    }
    const why = sharedRow ? "row" : hintFor(file);
    if (why) sharedHits.push({ file, why });
  }
  return { ok: true, mapFound: map.found, matched: matched.filter((m) => m.files.length), unmatched, sharedHits };
}

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ gaps */

/**
 * The branch's changed files, relative to root, from review-scope.mjs, which
 * every skill that ships this script ships beside it. One list, never a copy
 * of its git commands that could drift from it.
 */
export function branchFiles(root, base) {
  const top = git(root, ["rev-parse", "--show-toplevel"]);
  if (top === null) fail(EXIT.NOT_FOUND, "not-a-repo", `${root} is not inside a git repository.`, "Use --scope all or --scope path, or ask which files to look at.");
  const prefix = (git(root, ["rev-parse", "--show-prefix"]) || "").trim();
  const scope = path.join(HERE, "review-scope.mjs");
  if (!fs.existsSync(scope)) fail(EXIT.NOT_FOUND, "review-scope-missing", "review-scope.mjs is not beside test-match.mjs.", "Reinstall the skill, or use --scope all or --scope path.");
  let stdout;
  try {
    stdout = execFileSync(process.execPath, [scope, "--root", root, ...(base ? ["--base", base] : [])], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    stdout = err.stdout;
  }
  let json;
  try {
    json = JSON.parse(stdout);
  } catch {
    fail(EXIT.CRASH, "review-scope-failed", "review-scope.mjs printed no JSON.", "Run review-scope.mjs on its own to see why.");
  }
  if (!json.ok) fail(EXIT.NOT_FOUND, json.error, json.message, json.next);
  const list = json.files.map((f) => f.path);
  return [...new Set(list.map(toPosix))]
    .filter((f) => f.startsWith(prefix))
    .map((f) => f.slice(prefix.length))
    .filter((f) => fs.existsSync(path.join(root, f)));
}

function isSource(file) {
  const f = toPosix(file);
  if (!CODE_EXT.has(extOf(f)) || /\.d\.ts$/i.test(f) || isTestFile(f)) return false;
  return !segs(dirOf(f)).some((s) => SOURCE_SKIP.has(s));
}

// Commits in the last 90 days per file, and the newest commit time, from one
// git log read. Paths relative to root.
function churn(root) {
  const prefix = (git(root, ["rev-parse", "--show-prefix"]) || "").trim();
  const since = new Date(now().getTime() - 90 * 24 * 3600 * 1000).toISOString();
  const text = git(root, ["log", `--since=${since}`, "--name-only", "--format=%x00%ct"]) || "";
  const stats = new Map();
  for (const chunk of text.split("\0")) {
    const lines = chunk.split("\n");
    const ts = Number(lines[0]);
    if (!ts) continue;
    for (const raw of new Set(lines.slice(1).filter(Boolean))) {
      if (!raw.startsWith(prefix)) continue;
      const f = raw.slice(prefix.length);
      const s = stats.get(f) || { commits: 0, newest: 0 };
      s.commits++;
      s.newest = Math.max(s.newest, ts);
      stats.set(f, s);
    }
  }
  return stats;
}

function gaps(root, { scope, sub, base }) {
  const repo = inGit(root);
  let files;
  if (scope === "branch") files = branchFiles(root, base);
  else {
    files = allFiles(root);
    if (scope === "path") {
      const p = path.posix.normalize(toPosix(sub)).replace(/\/+$/, "");
      // The project root (".") is every file.
      if (p !== "." && p !== "") files = files.filter((f) => fold(f) === fold(p) || fold(f).startsWith(`${fold(p)}/`));
    }
  }
  let sources = [...new Set(files)].filter(isSource).sort();
  const capped = sources.length > CAP;
  if (capped) sources = sources.slice(0, CAP);
  const map = readTestMap(root);
  const rows = map.found ? map.rows : [];
  const testFiles = listTestFiles(root);
  const stats = repo ? churn(root) : null;
  const list = [];
  let covered = 0;
  for (const file of sources) {
    // Any matching row with a run command covers the file, as in covers, so
    // a gap's area is set only by a row that names it without one.
    const row = rows.find((r) => rowMatches(r, file));
    if (rows.some((r) => r.run && rowMatches(r, file)) || findTests(root, file, testFiles).tests.length) {
      covered++;
      continue;
    }
    const s = stats && stats.get(file);
    list.push({
      file,
      area: row ? row.area : null,
      runner: row && row.run ? row.run : null,
      commits90d: stats ? (s ? s.commits : 0) : null,
      lastTouched: s ? new Date(s.newest * 1000).toISOString().slice(0, 10) : null,
    });
  }
  list.sort((a, b) => {
    if (a.lastTouched !== b.lastTouched) {
      if (a.lastTouched === null) return 1;
      if (b.lastTouched === null) return -1;
      return a.lastTouched < b.lastTouched ? 1 : -1;
    }
    if ((b.commits90d || 0) !== (a.commits90d || 0)) return (b.commits90d || 0) - (a.commits90d || 0);
    return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
  });
  return { ok: true, scope, gaps: list, scanned: sources.length, covered, capped };
}

/* --------------------------------------------------------------- nearest */

// Path tokens in a Run command that name a file or folder in the project.
function runPaths(root, cmd) {
  return (cmd || "")
    .split(/\s+/)
    .map((t) => toPosix(t.replace(/^["']|["']$/g, "")).replace(/\/+$/, ""))
    .filter((t) => t && !t.startsWith("-") && inside(t) && fs.existsSync(path.join(root, t)));
}

function nearest(root, file) {
  const f = toPosix(file);
  const testFiles = listTestFiles(root).filter((t) => fold(t) !== fold(f));
  const picked = [];
  const take = (list) => {
    for (const t of list) {
      if (picked.length >= 3) return;
      if (!picked.includes(t)) picked.push(t);
    }
  };
  take(findTests(root, f, testFiles).tests);
  take(testFiles.filter((t) => fold(dirOf(t)) === fold(dirOf(f))));
  take(testFiles.filter((t) => mirrors(f, t)));
  if (picked.length < 3) {
    const map = readTestMap(root);
    const row = map.found ? map.rows.find((r) => rowMatches(r, f)) : null;
    if (row) {
      for (const p of runPaths(root, row.run)) {
        take(isDir(path.join(root, p)) ? testFiles.filter((t) => t.startsWith(`${p}/`)) : testFiles.filter((t) => t === p));
      }
    }
  }
  if (picked.length < 3) {
    const mine = segs(dirOf(f));
    const shared = (t) => {
      const ts = segs(dirOf(t));
      let n = 0;
      while (n < mine.length && n < ts.length && fold(mine[n]) === fold(ts[n])) n++;
      return n;
    };
    // Same language first: a Python test teaches nothing about a JS file's style.
    const lang = (p) => (JS_EXT.has(extOf(p)) ? "js" : extOf(p));
    const other = (t) => (lang(t) === lang(f) ? 0 : 1);
    take([...testFiles].sort((a, b) => other(a) - other(b) || shared(b) - shared(a) || (a < b ? -1 : a > b ? 1 : 0)));
  }
  return { ok: true, file: f, tests: picked };
}

/* ------------------------------------------------------------------ main */

const listArg = (s) => String(s).split(",").map((x) => toPosix(x.trim())).filter(Boolean);

async function main(argv) {
  const args = parseArgs(argv, { values: ["root", "files", "scope", "path", "base", "file"], booleans: ["stdin"] });
  const root = path.resolve(args.root || ".");
  const cmd = args._[0];
  if (cmd === "covers") {
    let files;
    if (args.files) files = listArg(args.files);
    else if (args.stdin) {
      let json;
      try {
        json = JSON.parse(readStdin());
      } catch {
        fail(EXIT.USAGE, "bad-stdin", "--stdin needs review-scope.mjs JSON.", "Pipe review-scope.mjs output in, or pass --files.");
      }
      if (!json || !Array.isArray(json.files)) fail(EXIT.USAGE, "bad-stdin", "The JSON on stdin has no files list.", "Pipe review-scope.mjs output in, or pass --files.");
      files = json.files.filter((f) => f && typeof f.path === "string" && f.path).map((f) => toPosix(f.path)).filter(Boolean);
    } else fail(EXIT.USAGE, "missing-files", "covers needs --files <a,b,...> or --stdin.", "Run with --help for usage.");
    out(covers(root, [...new Set(files)]));
    return;
  }
  if (cmd === "gaps") {
    if (!["branch", "all", "path"].includes(args.scope)) fail(EXIT.USAGE, "bad-scope", "gaps needs --scope branch, all or path.", "Run with --help for usage.");
    if (args.scope === "path" && !args.path) fail(EXIT.USAGE, "missing-path", "--scope path needs --path <p>.", "Run with --help for usage.");
    out(gaps(root, { scope: args.scope, sub: args.path, base: args.base }));
    return;
  }
  if (cmd === "nearest") {
    if (!args.file) fail(EXIT.USAGE, "missing-file", "nearest needs --file <f>.", "Run with --help for usage.");
    out(nearest(root, args.file));
    return;
  }
  fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: covers, gaps, nearest. Run with --help.");
}

const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
