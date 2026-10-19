#!/usr/bin/env node
// xray.mjs: what git history says about the code, for the X-ray skill.
//
// Two reads, both fixed sequences over git with one right answer per repo:
// hotspots (which files change most, which change together, which hot source
// files have no test) and history (one file's commits, who wrote its lines,
// and the pull requests behind it). The script only reads. What the numbers
// mean for the code is the agent's call.

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { EXIT, fail, out, parseArgs, run } from "./common.mjs";

const USAGE = `
xray.mjs: churn, co-change and one file's history from git. JSON on stdout.
It never changes the repository.

  node xray.mjs hotspots [--root <dir>] [--path <area>] [--max-commits 500] [--top 20]
  node xray.mjs history <path> [--root <dir>] [--max-commits 50]

hotspots   Reads the last --max-commits commits (merges skipped), scoped to
           --path when given. Only files tracked at HEAD count (renamed,
           deleted and untracked generated files drop out); lockfiles, dist/,
           build/ and node_modules/ are left out too. Prints { ok, root,
           window: { commits, capped }, churn, pairs, untested }.
             churn     [{ file, commits }], most changed first.
             pairs     [{ a, b, together, support }]: files changed together in
                       at least 3 commits; support is together divided by the
                       smaller of the two files' commit counts. Highest support
                       first. Commits touching more than 50 files are left out
                       of pairs (bulk renames and formatting sweeps).
             untested  [{ file, commits }]: source files changed in at
                       least 2 commits, with no test file
                       anywhere in the repo whose name contains the file's base
                       name.
           capped is true when older commits fell outside the window. Each list
           holds at most --top entries.
history    One file's story. Prints { ok, path, commits, blame, prs, sources }.
             commits   [{ hash, date, author, subject }] from git log --follow,
                       newest first, at most --max-commits.
             blame     { lines, authors: [{ author, lines, share }], oldest,
                       newest } at HEAD; null when the file is gone at HEAD.
             prs       [{ number, subject, title, summary }] parsed from commit
                       and merge subjects (#123, Merge pull request #123).
                       title and summary (the body's first paragraph) come from
                       gh pr view, for at most 10, when gh is installed and
                       signed in; otherwise they are null.
             sources   { git: true, blame: true|false,
                       gh: "used"|"missing"|"unauthenticated"|"timed-out" }.

Exit: 0 ok · 2 bad arguments · 3 not a git repository (not-a-repo), or the
path has no history (no-history).
`;

const GH_TIMEOUT_MS = 5000;
const GH_MAX_PRS = 10;
const PAIR_MIN = 3;
const PAIR_MAX_FILES = 50;
const UNTESTED_MIN = 2;

/** Run git with an args array (never a shell). { ok, out }. */
function git(cwd, args) {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
      // Without this, some reads refresh the index on disk: a write.
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return { ok: true, out: stdout };
  } catch {
    return { ok: false, out: "" };
  }
}

function count(value, flag, fallback) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) fail(EXIT.USAGE, "bad-number", `--${flag} needs a whole number above 0, got "${value}".`, "Run with --help for usage.");
  return n;
}

/** The repository's top level for --root, or the not-a-repo failure. */
function repoTop(root) {
  const top = fs.existsSync(root) ? git(root, ["rev-parse", "--show-toplevel"]) : { ok: false };
  if (!top.ok) {
    fail(EXIT.NOT_FOUND, "not-a-repo", `${root} is not inside a git repository.`, "X-ray needs git history; explain mode can still read the code.");
  }
  return path.resolve(top.out.trim());
}

/** A path from the person (relative to --root) as a forward-slash path relative to the repo top. */
function repoPath(root, top, p) {
  const abs = path.resolve(root, p);
  // Compare real paths: git prints the real top level, while --root may be an
  // 8.3 short name or arrive through a symlink. A path that does not exist
  // any more (a deleted file) resolves through its nearest existing ancestor.
  let existing = abs;
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) existing = path.dirname(existing);
  const real = path.join(fs.realpathSync.native(existing), path.relative(existing, abs));
  return path.relative(fs.realpathSync.native(top), real).split(path.sep).join("/");
}

const hasCommits = (top) => git(top, ["rev-parse", "--verify", "-q", "HEAD"]).ok;

/* -------------------------------------------------------------- hotspots */

const LOCKFILES = new Set([
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "bun.lock",
  "Cargo.lock",
  "Gemfile.lock",
  "poetry.lock",
  "Pipfile.lock",
  "composer.lock",
  "go.sum",
  "uv.lock",
  "flake.lock",
  "packages.lock.json",
]);

function skipped(file) {
  const base = file.slice(file.lastIndexOf("/") + 1);
  if (LOCKFILES.has(base) || base.endsWith(".lock")) return true;
  return /(^|\/)(dist|build|node_modules)\//.test(file);
}

const SOURCE_EXT = /\.(m?[jt]sx?|cjs|cts|mts|py|rb|go|rs|java|kt|kts|scala|cs|fs|php|swift|m|mm|c|cc|cpp|cxx|h|hpp|ex|exs|erl|clj|dart|lua|pl|r|jl|hs|ml|vue|svelte|sh|ps1)$/i;
const TEST_DIR = /(^|\/)(tests?|__tests__|specs?|e2e)\//i;
const TEST_NAME = /([._-](test|spec)s?\.[^/]+$)|(^tests?_)|(_tests?\.[^/]+$)/i;

const baseName = (file) => file.slice(file.lastIndexOf("/") + 1);
const stem = (file) => baseName(file).replace(/\.[^.]+$/, "");
const isTest = (file) => TEST_DIR.test(file) || TEST_NAME.test(baseName(file)) || /^test-/i.test(baseName(file));

/** [hash, [file...]] per commit, newest first, merges skipped. */
function commitFiles(top, limit, scope) {
  if (!hasCommits(top)) return [];
  const args = ["-c", "core.quotepath=off", "log", "--no-merges", "--no-renames", `-n${limit}`, "--name-only", "--format=%x01%H"];
  if (scope) args.push("--", scope);
  const log = git(top, args);
  if (!log.ok) return [];
  return log.out
    .split("\x01")
    .slice(1)
    .map((block) => {
      const [hash, ...files] = block.split("\n").map((l) => l.trim());
      return [hash, files.filter(Boolean)];
    });
}

function hotspots(argv) {
  const args = parseArgs(argv, { values: ["root", "path", "max-commits", "top"] });
  const root = path.resolve(args.root || ".");
  const max = count(args["max-commits"], "max-commits", 500);
  const topN = count(args.top, "top", 20);
  const top = repoTop(root);
  const scope = args.path ? repoPath(root, top, args.path) || "." : null;

  // One commit past the window says whether anything older was cut off.
  let commits = commitFiles(top, max + 1, scope);
  const capped = commits.length > max;
  if (capped) commits = commits.slice(0, max);

  // Only files tracked at HEAD count: a renamed or deleted file's history
  // would otherwise crowd live files out of the top lists, and untracked
  // build output (a gitignored skills/) drops out on its own.
  const tracked = git(top, ["-c", "core.quotepath=off", "ls-files"]);
  const files = tracked.ok ? tracked.out.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  const present = new Set(files);

  const churn = new Map();
  const together = new Map();
  for (const [, all] of commits) {
    const files = [...new Set(all.filter((f) => present.has(f) && !skipped(f)))].sort();
    for (const f of files) churn.set(f, (churn.get(f) || 0) + 1);
    if (files.length > PAIR_MAX_FILES) continue;
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const key = `${files[i]}\n${files[j]}`;
        together.set(key, (together.get(key) || 0) + 1);
      }
    }
  }

  const byChurn = [...churn].map(([file, n]) => ({ file, commits: n })).sort((x, y) => y.commits - x.commits || x.file.localeCompare(y.file));

  const pairs = [];
  for (const [key, n] of together) {
    if (n < PAIR_MIN) continue;
    const [a, b] = key.split("\n");
    const support = Math.round((n / Math.min(churn.get(a), churn.get(b))) * 100) / 100;
    pairs.push({ a, b, together: n, support });
  }
  pairs.sort((x, y) => y.support - x.support || y.together - x.together || x.a.localeCompare(y.a) || x.b.localeCompare(y.b));

  // Tests are looked for across the whole repo, not only inside --path: a
  // file under src/ is usually tested from a sibling tests/ folder.
  const testNames = files.filter(isTest).map((f) => baseName(f).toLowerCase());
  const untested = byChurn.filter(({ file, commits: n }) => {
    if (n < UNTESTED_MIN || !SOURCE_EXT.test(file) || isTest(file)) return false;
    const name = stem(file).toLowerCase();
    return !testNames.some((t) => t.includes(name));
  });

  out({
    ok: true,
    root: top,
    ...(scope ? { path: scope } : {}),
    window: { commits: commits.length, capped },
    churn: byChurn.slice(0, topN),
    pairs: pairs.slice(0, topN),
    untested: untested.slice(0, topN),
  });
}

/* --------------------------------------------------------------- history */

function blameSummary(top, file) {
  const r = git(top, ["blame", "--line-porcelain", "HEAD", "--", file]);
  if (!r.ok) return null;
  const authors = new Map();
  let lines = 0;
  let oldest = Infinity;
  let newest = -Infinity;
  let author = null;
  for (const line of r.out.split("\n")) {
    if (line.startsWith("author ")) author = line.slice(7);
    else if (line.startsWith("author-time ")) {
      const t = Number(line.slice(12));
      if (t < oldest) oldest = t;
      if (t > newest) newest = t;
    } else if (line.startsWith("\t")) {
      lines++;
      authors.set(author, (authors.get(author) || 0) + 1);
    }
  }
  const day = (t) => (Number.isFinite(t) ? new Date(t * 1000).toISOString().slice(0, 10) : null);
  return {
    lines,
    authors: [...authors]
      .map(([name, n]) => ({ author: name, lines: n, share: Math.round((n / lines) * 100) / 100 }))
      .sort((x, y) => y.lines - x.lines || x.author.localeCompare(y.author)),
    oldest: day(oldest),
    newest: day(newest),
  };
}

const PR_PATTERNS = [/Merge pull request #(\d+)/gi, /#(\d+)\b/g];

function prNumbers(subjects) {
  const seen = new Map();
  for (const subject of subjects) {
    for (const pattern of PR_PATTERNS) {
      for (const m of subject.matchAll(pattern)) {
        const n = Number(m[1]);
        if (!seen.has(n)) seen.set(n, subject);
      }
    }
  }
  return [...seen].map(([number, subject]) => ({ number, subject, title: null, summary: null }));
}

/** "used", "missing", "unauthenticated" or "timed-out", filling in prs as it goes. */
function ghDetails(top, prs) {
  const gh = (args) => spawnSync("gh", args, { cwd: top, encoding: "utf8", timeout: GH_TIMEOUT_MS, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  const timedOut = (r) => r.error?.code === "ETIMEDOUT" || (r.signal && r.status === null);
  const auth = gh(["auth", "status"]);
  if (auth.error?.code === "ENOENT") return "missing";
  if (timedOut(auth)) return "timed-out";
  if (auth.error || auth.status !== 0) return "unauthenticated";
  let status = "used";
  for (const pr of prs.slice(0, GH_MAX_PRS)) {
    const r = gh(["pr", "view", String(pr.number), "--json", "title,body"]);
    if (timedOut(r)) {
      status = "timed-out";
      break;
    }
    if (r.status !== 0) continue; // an issue number, or a PR this remote does not know
    try {
      const { title, body } = JSON.parse(r.stdout);
      pr.title = title || null;
      // The first paragraph that says something, minus any heading lines on
      // top of it: GitHub's template puts "## Summary" right above the text.
      const paragraphs = (body || "").replace(/\r\n/g, "\n").split(/\n\s*\n/).map((p) => p.replace(/^(#{1,6}\s[^\n]*(\n|$))+/, "").trim());
      pr.summary = paragraphs.find(Boolean) || null;
    } catch {}
  }
  return status;
}

function history(argv) {
  const args = parseArgs(argv, { values: ["root", "max-commits"] });
  const target = args._[0];
  if (!target) fail(EXIT.USAGE, "missing-path", "history needs the file to read.", "Run: node xray.mjs history <path>");
  const root = path.resolve(args.root || ".");
  const max = count(args["max-commits"], "max-commits", 50);
  const top = repoTop(root);
  const file = repoPath(root, top, target);

  const log = hasCommits(top) ? git(top, ["log", "--follow", `-n${max}`, "--format=%H%x1f%aI%x1f%an%x1f%s", "--", file]) : { ok: false };
  const commits = (log.ok ? log.out.split("\n") : [])
    .filter(Boolean)
    .map((line) => {
      const [hash, date, author, subject] = line.split("\x1f");
      return { hash, date, author, subject };
    });
  if (!commits.length) {
    fail(EXIT.NOT_FOUND, "no-history", `${file} has no commits in this repository.`, "Check the path (relative to --root), or run hotspots to see which files have history.");
  }

  // Merges hide from a file's own log; the first-parent merges that touched
  // it carry the "Merge pull request #N" subjects.
  const merges = git(top, ["log", "--first-parent", "--merges", `-n${max}`, "--format=%s", "--", file]);
  const subjects = [...commits.map((c) => c.subject), ...(merges.ok ? merges.out.split("\n").filter(Boolean) : [])];
  const prs = prNumbers(subjects);

  const blame = blameSummary(top, file);
  const gh = ghDetails(top, prs);
  out({ ok: true, path: file, commits, blame, prs, sources: { git: true, blame: blame !== null, gh } });
}

run(USAGE, async (argv) => {
  const [command, ...rest] = argv;
  if (command === "hotspots") return hotspots(rest);
  if (command === "history") return history(rest);
  fail(EXIT.USAGE, "unknown-command", command ? `Unknown command "${command}".` : "No command given.", "Run with --help: the commands are hotspots and history.");
});
