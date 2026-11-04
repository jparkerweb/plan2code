#!/usr/bin/env node
// test-commands.mjs: find a project's test and check commands from its config.
//
// Reads package.json, workspace files and runner configs (go.mod, Cargo.toml,
// pyproject.toml, *.csproj, Makefile, ...) and reports the whole-suite
// command, one runner per folder, lint/type/build checks, the coverage
// commands the project can already run, and the built-in runner to offer when
// it has none. It only reads files: it never runs a command, installs anything
// or touches the network. Which of these to run stays the agent's call, and
// every command is shown to the person before it runs.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, fail, out, parseArgs, run, readText, isDir } from "./common.mjs";
import { matchGlob } from "./glob.mjs";

const USAGE = `
test-commands.mjs: a project's test and check commands. JSON on stdout.

  node test-commands.mjs discover [--root <dir>]
      { ok, suite, runners, checks, coverage, builtin }
      suite     { cmd, why } the whole-suite command, or null
      runners   [{ cmd, cwd, covers[] }] one per folder with its own runner
                (workspaces, go.mod, Cargo.toml, Python configs, .NET, Makefile);
                the root folder's is cwd "." and covers "**"
      checks    [{ kind, cmd }] kind is lint, types or build
      coverage  [{ runner, cmd, cwd, reads }] only for tools already present;
                <out> in cmd is a placeholder for the output file; reads is
                lcov or go-func
      builtin   { language, cmd, others? } the language's own runner, only when
                there is no suite and no runner; otherwise null

Only reads files. Exit: 0 ok · 2 bad arguments · 3 no such folder.
`;

const SKIP = new Set(["node_modules", ".git", "vendor", "dist", "build", "target", ".venv"]);
const MAX_DEPTH = 4;
const PLACEHOLDER = /no test specified/;
const LANG_EXT = {
  node: [".js", ".mjs", ".cjs", ".jsx", ".ts", ".mts", ".cts", ".tsx"],
  python: [".py"],
  go: [".go"],
  rust: [".rs"],
};
const BUILTIN = { node: "node --test", python: "python -m unittest", go: "go test ./...", rust: "cargo test" };

function readJson(file) {
  const text = readText(file);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Every folder to depth 4 (forward-slash, "." for the root) with its file names, and source counts. */
function walk(root) {
  const dirs = new Map();
  const counts = { node: 0, python: 0, go: 0, rust: 0 };
  const extLang = new Map(Object.entries(LANG_EXT).flatMap(([lang, exts]) => exts.map((e) => [e, lang])));
  const visit = (abs, rel, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
      return;
    }
    const files = [];
    dirs.set(rel, files);
    for (const e of entries) {
      if (e.isDirectory()) {
        if (depth < MAX_DEPTH && !SKIP.has(e.name)) visit(path.join(abs, e.name), rel === "." ? e.name : `${rel}/${e.name}`, depth + 1);
      } else if (e.isFile()) {
        files.push(e.name);
        const lang = extLang.get(path.extname(e.name).toLowerCase());
        if (lang) counts[lang]++;
      }
    }
  };
  visit(root, ".", 0);
  return { dirs, counts };
}

/** The package manager the lockfile names. */
function packageManager(files) {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("bun.lockb") || files.includes("bun.lock")) return "bun";
  return "npm";
}

const realTest = (pkg) => {
  const t = pkg && pkg.scripts && pkg.scripts.test;
  return typeof t === "string" && t.trim() && !PLACEHOLDER.test(t) ? t : null;
};
const deps = (pkg) => ({ ...(pkg && pkg.dependencies), ...(pkg && pkg.devDependencies), ...(pkg && pkg.peerDependencies), ...(pkg && pkg.optionalDependencies) });
const hasMakeTest = (text) => text !== null && /^test\s*:/m.test(text);
const covers = (cwd) => (cwd === "." ? ["**"] : [`${cwd}/**`]);
const ancestors = (rel) => {
  const list = rel === "." ? [] : ["."];
  const parts = rel === "." ? [] : rel.split("/");
  for (let i = 1; i < parts.length; i++) list.push(parts.slice(0, i).join("/"));
  return list;
};

/** Workspace folders from package.json workspaces and pnpm-workspace.yaml, matched against the folders on disk. */
function workspaceFolders(root, pkg, dirs) {
  let globs = [];
  const ws = pkg && pkg.workspaces;
  if (Array.isArray(ws)) globs = ws;
  else if (ws && Array.isArray(ws.packages)) globs = ws.packages;
  const pnpm = readText(path.join(root, "pnpm-workspace.yaml"));
  if (pnpm !== null) {
    let inPackages = false;
    for (const line of pnpm.split(/\r?\n/)) {
      if (/^packages\s*:/.test(line)) inPackages = true;
      else if (/^\S/.test(line)) inPackages = false;
      else if (inPackages) {
        const m = line.match(/^\s*-\s*['"]?([^'"#]+?)['"]?\s*(?:#.*)?$/);
        if (m) globs.push(m[1]);
      }
    }
  }
  globs = globs.filter((g) => typeof g === "string" && g.trim()).map((g) => g.trim().replace(/\/+$/, ""));
  const include = globs.filter((g) => !g.startsWith("!"));
  const exclude = globs.filter((g) => g.startsWith("!")).map((g) => g.slice(1));
  return [...dirs.keys()].filter((d) => d !== "." && include.some((g) => matchGlob(g, d)) && !exclude.some((g) => matchGlob(g, d))).sort();
}

/** pytest is configured or listed in this folder's Python files. */
function usesPytest(abs, files) {
  if (files.includes("pytest.ini")) return true;
  const pyproject = readText(path.join(abs, "pyproject.toml"));
  if (pyproject !== null && (/\[tool\.pytest/.test(pyproject) || /\bpytest\b/i.test(pyproject))) return true;
  const setup = readText(path.join(abs, "setup.cfg"));
  if (setup !== null && /\bpytest\b/i.test(setup)) return true;
  const tox = readText(path.join(abs, "tox.ini"));
  if (tox !== null && /\bpytest\b/i.test(tox)) return true;
  return files.some((f) => /^requirements.*\.txt$/i.test(f) && /^\s*pytest\b/im.test(readText(path.join(abs, f)) || ""));
}

/** The Python files of this folder or a folder above it mention pytest-cov. */
function usesPytestCov(root, cwd, dirs) {
  return [cwd, ...ancestors(cwd)].some((d) => {
    const files = dirs.get(d) || [];
    return ["pyproject.toml", "setup.cfg", "tox.ini", ...files.filter((f) => /^requirements.*\.txt$/i.test(f))]
      .some((f) => files.includes(f) && /pytest-cov/i.test(readText(path.join(root, d, f)) || ""));
  });
}

export function discover(root) {
  const { dirs, counts } = walk(root);
  const rootFiles = dirs.get(".") || [];
  const pkg = readJson(path.join(root, "package.json"));
  const pm = packageManager(rootFiles);
  const runners = [];
  const coverage = [];
  const checks = [];
  const add = (list, item) => {
    if (!list.some((x) => x.cmd === item.cmd && x.cwd === item.cwd)) list.push(item);
  };

  let suite = null;
  if (realTest(pkg)) suite = { cmd: `${pm} test`, why: "package.json scripts.test" };
  else if (hasMakeTest(readText(path.join(root, "Makefile")))) suite = { cmd: "make test", why: "Makefile test target" };

  if (pkg && pkg.scripts) {
    const s = pkg.scripts;
    if (s.lint) checks.push({ kind: "lint", cmd: `${pm} run lint` });
    const types = ["typecheck", "type-check", "types", "tsc"].find((n) => s[n]);
    if (types) checks.push({ kind: "types", cmd: `${pm} run ${types}` });
    else if (rootFiles.includes("tsconfig.json")) checks.push({ kind: "types", cmd: "npx tsc --noEmit" });
    if (s.build) checks.push({ kind: "build", cmd: `${pm} run build` });
  } else if (rootFiles.includes("tsconfig.json")) checks.push({ kind: "types", cmd: "npx tsc --noEmit" });

  // Node: the root package and each workspace with a test script.
  const nodeFolders = [{ cwd: ".", pkg }, ...workspaceFolders(root, pkg, dirs).map((cwd) => ({ cwd, pkg: readJson(path.join(root, cwd, "package.json")) }))];
  for (const { cwd, pkg: p } of nodeFolders) {
    const test = realTest(p);
    if (!test) continue;
    add(runners, { cmd: `${pm} test`, cwd, covers: covers(cwd) });
    const d = deps(p);
    if (/\bnode\s+--test\b/.test(test)) {
      add(coverage, { runner: "node", cmd: "node --test --experimental-test-coverage --test-reporter=lcov --test-reporter-destination=<out>", cwd, reads: "lcov" });
    }
    if (d.jest || /\bjest\b/.test(test)) add(coverage, { runner: "jest", cmd: "npx jest --coverage --coverageReporters=lcov", cwd, reads: "lcov" });
    if (Object.keys(d).some((k) => k.startsWith("@vitest/coverage-"))) add(coverage, { runner: "vitest", cmd: "npx vitest run --coverage --coverage.reporter=lcov", cwd, reads: "lcov" });
  }

  // Nested runner configs, walked in folder order.
  const cargoWorkspaces = new Set();
  const solutions = new Set();
  for (const [cwd, files] of [...dirs].sort(([a], [b]) => (a === "." ? -1 : b === "." ? 1 : a.localeCompare(b)))) {
    const abs = path.join(root, cwd);
    const before = runners.length;
    if (files.includes("go.mod")) {
      add(runners, { cmd: "go test ./...", cwd, covers: covers(cwd) });
      add(coverage, { runner: "go", cmd: "go test -coverprofile=<out> ./... && go tool cover -func=<out>", cwd, reads: "go-func" });
    }
    if (files.includes("Cargo.toml")) {
      const cargo = readText(path.join(abs, "Cargo.toml")) || "";
      const isWorkspace = /^\[workspace\]/m.test(cargo);
      // A member of a Cargo workspace already runs from the workspace root.
      const inWorkspace = ancestors(cwd).some((a) => cargoWorkspaces.has(a));
      if (isWorkspace) cargoWorkspaces.add(cwd);
      if (!inWorkspace && (isWorkspace || /^\[package\]/m.test(cargo))) add(runners, { cmd: "cargo test", cwd, covers: covers(cwd) });
    }
    if (["pyproject.toml", "setup.cfg", "pytest.ini", "tox.ini"].some((f) => files.includes(f))) {
      if (usesPytest(abs, files)) {
        add(runners, { cmd: "python -m pytest", cwd, covers: covers(cwd) });
        if (usesPytestCov(root, cwd, dirs)) add(coverage, { runner: "pytest", cmd: "python -m pytest --cov --cov-report=lcov:<out>", cwd, reads: "lcov" });
      } else add(runners, { cmd: "python -m unittest", cwd, covers: covers(cwd) });
    }
    const dotnet = files.some((f) => /\.(csproj|sln)$/i.test(f));
    // Projects under a solution already run from the solution's folder.
    if (dotnet && !ancestors(cwd).some((a) => solutions.has(a))) {
      if (files.some((f) => /\.sln$/i.test(f))) solutions.add(cwd);
      add(runners, { cmd: "dotnet test", cwd, covers: covers(cwd) });
      const prefix = cwd === "." ? "" : `${cwd}/`;
      const coverlet = [...dirs].some(([d, fs2]) => (cwd === "." || d === cwd || d.startsWith(prefix)) && fs2.some((f) => /\.csproj$/i.test(f) && /coverlet\.collector/i.test(readText(path.join(root, d, f)) || "")));
      if (coverlet) add(coverage, { runner: "dotnet", cmd: 'dotnet test --collect:"XPlat Code Coverage"', cwd, reads: "lcov" });
    }
    // make test is the folder's runner only when nothing else runs there.
    const hasNode = runners.slice(0, before).some((r) => r.cwd === cwd);
    if (runners.length === before && !hasNode && files.includes("Makefile") && hasMakeTest(readText(path.join(abs, "Makefile")))) {
      add(runners, { cmd: "make test", cwd, covers: covers(cwd) });
    }
  }

  let builtin = null;
  if (!suite && !runners.length) {
    const present = [];
    if (pkg || rootFiles.includes("package.json")) present.push("node");
    if (counts.python) present.push("python");
    if ([...dirs.values()].some((f) => f.includes("go.mod"))) present.push("go");
    if ([...dirs.values()].some((f) => f.includes("Cargo.toml"))) present.push("rust");
    if (present.length) {
      present.sort((a, b) => counts[b] - counts[a]);
      const [first, ...rest] = present;
      builtin = { language: first, cmd: BUILTIN[first] };
      if (rest.length) builtin.others = rest.map((language) => ({ language, cmd: BUILTIN[language] }));
    }
  }

  return { ok: true, suite, runners, checks, coverage, builtin };
}

async function main(argv) {
  const args = parseArgs(argv, { values: ["root"] });
  const cmd = args._[0];
  if (cmd !== "discover") fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: discover. Run with --help.");
  const root = path.resolve(args.root || ".");
  if (!isDir(root)) fail(EXIT.NOT_FOUND, "no-root", `No folder at ${root}.`, "Pass the project folder with --root, or run from the project root.");
  out(discover(root));
}

// Run as a script; imported, do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
