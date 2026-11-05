#!/usr/bin/env node
// coverage.mjs: coverage output read into per-file numbers, for the Test skill.
//
// Reads what a project's own coverage tool already wrote: an lcov file (Node's
// test runner with the lcov reporter, Jest, Vitest, pytest-cov's lcov export)
// or the text `go tool cover -func` prints. It never runs a tool and never
// writes a file; the skill runs the coverage command first, on a yes.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, fail, out, parseArgs, run } from "./common.mjs";

const USAGE = `
coverage.mjs: per-file coverage from a coverage tool's output. JSON on stdout.

  node coverage.mjs read --lcov <file> [--root <dir>] [--cwd <dir>]
  node coverage.mjs read --go-func <file> [--root <dir>]
      Prints { ok, format, files: [{ file, lines, hit, pct }], total },
      files sorted by path, pct with one decimal.
        lcov     SF: / DA:<line>,<hits> / LF: / LH: / end_of_record records.
                 lines is LF (or the DA count when LF is missing), hit is LH
                 (or the DA lines with hits above 0). Paths are made relative
                 to --root (default: the current folder) with forward slashes;
                 an absolute path outside the root is kept as given. A relative
                 SF: path is relative to the runner's folder: pass it as --cwd
                 (relative to the root) to get project-relative paths. total
                 sums every file.
        go-func  "<import path>/<file>.go:<line>:  <func>  <pct>%" lines,
                 grouped by file: pct is the mean of the file's functions,
                 lines and hit are null. The module path of the go.mod that
                 owns each file (any under --root, four folders deep) is
                 swapped for that go.mod's folder, so files read as project
                 paths, a nested module's included. The "total:" line
                 is not a file: it is reported as total.
      A file with no lines has pct null.

Exit: 0 ok · 1 crash · 2 bad arguments · 3 no such file · 4 not lcov or
go tool cover -func output.
`;

const pct1 = (n) => Math.round(n * 10) / 10;
const slash = (p) => p.replace(/\\/g, "/");
const isAbs = (p) => p.startsWith("/") || /^[A-Za-z]:\//.test(p);

/** A path made relative to root when it lies under it; anything else as given (relative paths with forward slashes). */
function relTo(root, file) {
  const f = slash(file.trim());
  if (!isAbs(f)) return f.replace(/^\.\//, "");
  const r = slash(root).replace(/\/+$/, "");
  const drive = /^[A-Za-z]:\//.test(f);
  const under = drive ? f.toLowerCase().startsWith(`${r.toLowerCase()}/`) : f.startsWith(`${r}/`);
  return under ? f.slice(r.length + 1) : file.trim();
}

function byPath(a, b) {
  return a.file < b.file ? -1 : a.file > b.file ? 1 : 0;
}

/* ------------------------------------------------------------------ lcov */

function readLcov(text, root) {
  if (!/^SF:/m.test(text)) return null;
  const files = [];
  let cur = null;
  const close = () => {
    if (!cur) return;
    const lines = cur.lf ?? cur.da.length;
    const hit = cur.lh ?? cur.da.filter((h) => h > 0).length;
    files.push({ file: relTo(root, cur.sf), lines, hit, pct: lines ? pct1((hit / lines) * 100) : null });
    cur = null;
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      close();
      cur = { sf: line.slice(3), da: [], lf: null, lh: null };
    } else if (!cur) continue;
    else if (line.startsWith("DA:")) {
      const hits = Number(line.slice(3).split(",")[1]);
      cur.da.push(Number.isFinite(hits) ? hits : 0);
    } else if (line.startsWith("LF:")) cur.lf = Number(line.slice(3)) || 0;
    else if (line.startsWith("LH:")) cur.lh = Number(line.slice(3)) || 0;
    else if (line === "end_of_record") close();
  }
  close();
  files.sort(byPath);
  const lines = files.reduce((s, f) => s + f.lines, 0);
  const hit = files.reduce((s, f) => s + f.hit, 0);
  return { files, total: { lines, hit, pct: lines ? pct1((hit / lines) * 100) : null } };
}

/* --------------------------------------------------------------- go-func */

const GO_LINE = /^(.+\.go):\d+:\s+\S+\s+([\d.]+)%\s*$/;
const GO_TOTAL = /^total:\s+(?:\(statements\)\s+)?([\d.]+)%\s*$/;

const GO_SKIP = new Set([".git", "node_modules", "vendor", "testdata"]);

// Every Go module under root (four folders deep, as discover walks), longest
// module path first, so a nested module (tools/go.mod) owns its own files.
function goModules(root) {
  const found = [];
  const walk = (dir, depth) => {
    let entries;
    try {
      entries = fs.readdirSync(path.join(root, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.isFile() && e.name === "go.mod") {
        try {
          const m = fs.readFileSync(path.join(root, dir, e.name), "utf8").match(/^\s*module\s+(\S+)/m);
          if (m) found.push({ dir, mod: m[1].replace(/^"|"$/g, "") });
        } catch {}
      } else if (e.isDirectory() && depth < 4 && !GO_SKIP.has(e.name) && !e.name.startsWith(".")) {
        walk(dir ? `${dir}/${e.name}` : e.name, depth + 1);
      }
    }
  };
  walk("", 0);
  return found.sort((a, b) => b.mod.length - a.mod.length);
}

function readGoFunc(text, root) {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  if (!lines.some((l) => GO_LINE.test(l))) return null;
  const mods = goModules(root);
  const groups = new Map();
  let total = null;
  for (const line of lines) {
    const t = line.match(GO_TOTAL);
    if (t) {
      total = { lines: null, hit: null, pct: pct1(Number(t[1])) };
      continue;
    }
    const m = line.match(GO_LINE);
    if (!m) continue;
    let file = slash(m[1]);
    const own = mods.find((g) => file.startsWith(`${g.mod}/`));
    if (own) file = `${own.dir ? `${own.dir}/` : ""}${file.slice(own.mod.length + 1)}`;
    else file = relTo(root, m[1]);
    (groups.get(file) || groups.set(file, []).get(file)).push(Number(m[2]));
  }
  const files = [...groups].map(([file, pcts]) => ({ file, lines: null, hit: null, pct: pct1(pcts.reduce((s, p) => s + p, 0) / pcts.length) }));
  files.sort(byPath);
  return { files, total };
}

/* ------------------------------------------------------------------ main */

async function main(argv) {
  const args = parseArgs(argv, { values: ["lcov", "go-func", "root", "cwd"] });
  const [cmd, ...extra] = args._;
  if (!cmd) fail(EXIT.USAGE, "missing-command", "A subcommand is required: read.", "Run with --help for usage.");
  if (cmd !== "read") fail(EXIT.USAGE, "unknown-command", `Unknown subcommand "${cmd}".`, "Use: read.");
  if (extra.length) fail(EXIT.USAGE, "stray-argument", `Unexpected argument(s): ${extra.join(" ")}.`, "Run with --help for usage.");
  if (!args.lcov === !args["go-func"]) fail(EXIT.USAGE, "one-format", "Give exactly one of --lcov <file> or --go-func <file>.", "Run with --help for usage.");
  const format = args.lcov ? "lcov" : "go-func";
  const file = args.lcov || args["go-func"];
  const rootArg = args.root || process.cwd();
  const root = isAbs(slash(rootArg)) ? rootArg : path.resolve(rootArg);
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    fail(EXIT.NOT_FOUND, "no-file", `Cannot read ${file}.`, "Run the coverage command first, then pass the file it wrote.");
  }
  const read = format === "lcov" ? readLcov(text, root) : readGoFunc(text, root);
  const prefix = path.posix.normalize(slash(args.cwd || ".")).replace(/\/+$/, "").replace(/^\.$/, "");
  if (read && format === "lcov" && prefix) {
    for (const f of read.files) if (!isAbs(f.file)) f.file = path.posix.join(prefix, f.file);
    read.files.sort(byPath);
  }
  if (!read) {
    fail(
      EXIT.INVALID,
      "unreadable-format",
      `${file} is not ${format === "lcov" ? "lcov output (no SF: lines)" : "go tool cover -func output (no .go: lines)"}.`,
      "Check the coverage command's reporter writes lcov, or pass go tool cover -func output with --go-func."
    );
  }
  out({ ok: true, format, ...read });
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
