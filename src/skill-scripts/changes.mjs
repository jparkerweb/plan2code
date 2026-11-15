#!/usr/bin/env node
// changes.mjs: what this run changed, for the sign-off page's Changes tab.
//
// `start` snapshots the working tree into a git tree object (through a
// temporary index, so the real index, HEAD, branches and working tree stay
// exactly as they were) and remembers its id in the session folder. `diff`
// snapshots the tree as it is now, compares the two and writes the unified diff
// to <session>/changes.diff, with counts on stdout. Work done before `start`
// never shows up, and nothing has to be committed.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { EXIT, fail, gitRepo, out, parseArgs, run } from "./common.mjs";

const USAGE = `
changes.mjs: snapshot the working tree, then diff against the snapshot. JSON on stdout.

  node changes.mjs start --session <folder> [--root <dir>]
  node changes.mjs diff  --session <folder> [--root <dir>] [--cap 524288]

  start    Snapshots the working tree (tracked, modified and new files, never
           .gitignore'd ones) into a git tree object and writes
           <session>/changes-start.json. The real index, HEAD and branches are
           not touched. Run it again to take a new snapshot.
  diff     Compares the snapshot with the tree now and writes
           <session>/changes.diff plus the counts:
           { ok, files, added, removed, truncated, hidden, file }.
  --cap    Largest patch to keep, in bytes (default 524288). A bigger one is cut
           at a file boundary with a plain notice; every file stays named.

Lines of files that may hold a secret are hidden (name and counts stay).

Exit: 0 ok · 2 bad arguments · 3 not a git repository, no snapshot, or the
snapshot is gone · 4 git could not snapshot the working tree.
`;

const DEFAULT_CAP = 524288;
const START_FILE = "changes-start.json";
const DIFF_FILE = "changes.diff";
const TOO_LARGE = "\\ No more lines shown: this change is too large to show in full.";
const HIDDEN_LINE = "Lines hidden: this file may hold a secret.";

/* ------------------------------------------------------------------ git */

function git(root, args, { env, allowFail = false } = {}) {
  try {
    // core.quotePath=false: a non-ASCII path comes back as itself, not as an escaped, quoted string.
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      env: env || process.env,
    });
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function notARepo(root) {
  fail(EXIT.NOT_FOUND, "not-a-repo", `${root} is not inside a git repository, so there is no way to tell what changed.`, "Tell the person the Changes tab has no starting point in a folder without git.");
}

/** The top of the working tree `root` is in, or a not-a-repo failure. */
function topLevel(root) {
  const top = git(root, ["rev-parse", "--show-toplevel"], { allowFail: true });
  if (top === null || !top.trim()) notARepo(root);
  return top.trim();
}

/**
 * The tree id of the working tree as it is now, built in a temporary index:
 * seeded with a copy of the real one so `git add -A` only re-hashes what
 * changed. The real index is never written.
 */
export function snapshotTree(root) {
  const top = topLevel(root);
  const real = git(top, ["rev-parse", "--git-path", "index"], { allowFail: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-changes-"));
  try {
    const indexFile = path.join(dir, "index");
    if (real && real.trim()) {
      const source = path.resolve(top, real.trim());
      if (fs.existsSync(source)) fs.copyFileSync(source, indexFile);
    }
    const env = { ...process.env, GIT_INDEX_FILE: indexFile };
    try {
      git(top, ["add", "-A"], { env });
      return git(top, ["write-tree"], { env }).trim();
    } catch (err) {
      fail(EXIT.INVALID, "snapshot-failed", `Git could not snapshot the working tree: ${String((err && err.stderr) || err.message).trim().split("\n")[0]}`, "Check that the repository is healthy (git status), then run again.");
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** `<session>/changes-start.json` as an object with a hex `tree`, or null. */
export function readStart(session) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(session, START_FILE), "utf8"));
    if (data && typeof data === "object" && typeof data.tree === "string" && /^([0-9a-f]{40}|[0-9a-f]{64})$/.test(data.tree)) return data;
  } catch {}
  return null;
}

/* ---------------------------------------------------------------- patch */

/** Split a patch into one string per file, each starting at its `diff --git` line. */
function splitSections(patch) {
  if (!patch) return [];
  return patch.split(/^(?=diff --git )/m).filter((s) => s.startsWith("diff --git "));
}

/** Old and new paths of a file's section (a rename has two). */
function sectionPaths(section) {
  const paths = new Set();
  for (const line of section.split("\n")) {
    if (line.startsWith("@@")) break;
    let m = line.match(/^rename (?:from|to) (.+)$/);
    if (m) paths.add(unquote(m[1]));
    // Git adds a trailing tab after a name that holds a space.
    m = line.match(/^(?:--- a|\+\+\+ b)\/(.+?)\t?$/) || line.match(/^(?:--- |\+\+\+ )"[ab]\/(.+)"\t?$/);
    if (m) paths.add(unquote(m[1]));
  }
  if (!paths.size) {
    const m = section.split("\n", 1)[0].match(/^diff --git "?a\/(.+?)"? "?b\/(.+?)"?$/);
    if (m) {
      paths.add(unquote(m[1]));
      paths.add(unquote(m[2]));
    }
  }
  return [...paths];
}

/** Undo git's C-style quoting of an odd name (backslash-t, -n, -quote, -backslash). */
function unquote(p) {
  return p.replace(/\\(["\\tn])/g, (_, c) => (c === "t" ? "\t" : c === "n" ? "\n" : c));
}

/** Old and new paths per changed file, from `git diff --name-status -z`, in patch order. */
function nameEntries(text) {
  const tok = (text || "").split("\0");
  const entries = [];
  for (let i = 0; i < tok.length && tok[i]; ) {
    const n = /^[RC]/.test(tok[i]) ? 2 : 1;
    entries.push(tok.slice(i + 1, i + 1 + n));
    i += 1 + n;
  }
  return entries;
}

/** The lines of a section that name the file and how it moved, no content. */
function headerOnly(section) {
  const keep = /^(diff --git |rename (from|to) |similarity index |new file mode |deleted file mode |old mode |new mode )/;
  return (
    section
      .split("\n")
      .filter((l) => keep.test(l))
      .join("\n") + "\n"
  );
}

/** Only the `diff --git` line and any rename lines: what a cut file keeps. */
function nameOnly(section) {
  return (
    section
      .split("\n")
      .filter((l) => /^(diff --git |rename (from|to) )/.test(l))
      .join("\n") + "\n"
  );
}

const bytes = (s) => Buffer.byteLength(s, "utf8");

/**
 * Cut `patch` to at most `cap` bytes at a file boundary, never mid-line: the
 * files that fit stay whole, the rest shrink to their header lines under one
 * plain notice, so the file list stays complete. `headerOf` says what a cut
 * file keeps (default: its `diff --git` line and any rename lines). A patch
 * within the cap comes back unchanged. The result's size can pass the cap only
 * when the headers alone do.
 */
export function capPatch(patch, cap, headerOf = nameOnly) {
  if (bytes(patch) <= cap) return { patch, truncated: false };
  const sections = splitSections(patch);
  const sizes = sections.map(bytes);
  const heads = sections.map((s) => headerOf(s));
  const headSizes = heads.map(bytes);
  const notice = TOO_LARGE + "\n";
  let kept = 0;
  let total = 0;
  let cutSize = headSizes.reduce((a, b) => a + b, 0);
  // Largest k whose whole sections plus the cut ones' headers fit.
  let best = 0;
  for (let k = 0; k <= sections.length; k++) {
    if (k > 0) {
      total += sizes[k - 1];
      cutSize -= headSizes[k - 1];
    }
    if (total + (k < sections.length ? bytes(notice) + cutSize : 0) <= cap) best = k;
    else if (k > 0) break;
  }
  kept = best;
  let text = sections.slice(0, kept).join("");
  if (kept < sections.length) {
    if (text && !text.endsWith("\n")) text += "\n";
    text += notice + heads.slice(kept).join("");
  }
  return { patch: text, truncated: kept < sections.length };
}

/** Replace the lines of every sensitive file's section; returns the paths hidden. */
function hideSensitive(patch, isSensitive, entries) {
  const hidden = [];
  const split = splitSections(patch);
  // The NUL-delimited name list is exact and comes in patch order. A count
  // mismatch falls back to the patch text, and a section whose name cannot be
  // read at all is hidden: never show lines of a file that cannot be named.
  const exact = entries && entries.length === split.length;
  const sections = split.map((section, i) => {
    const paths = exact ? entries[i] : sectionPaths(section);
    const secret = paths.filter((p) => isSensitive(p));
    if (!secret.length && paths.length) return section;
    for (const p of paths) if (!hidden.includes(p) && isSensitive(p)) hidden.push(p);
    return headerOnly(section) + HIDDEN_LINE + "\n";
  });
  return { patch: sections.join(""), hidden };
}

function sumNumstat(text) {
  let added = 0;
  let removed = 0;
  for (const line of (text || "").split("\n")) {
    if (!line.trim()) continue;
    const [a, d] = line.split("\t");
    // A binary file prints "-" for both counts: it adds nothing.
    if (/^\d+$/.test(a)) added += Number(a);
    if (/^\d+$/.test(d)) removed += Number(d);
  }
  return { added, removed };
}

/** Per-file counts from `numstat -z`, keyed by the new path; a binary file counts 0. */
function fileCounts(text) {
  const tok = (text || "").split("\0");
  const counts = new Map();
  for (let i = 0; i < tok.length && tok[i]; ) {
    const m = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(tok[i]);
    if (!m) break;
    const renamed = m[3] === "";
    const key = renamed ? tok[i + 2] : m[3];
    counts.set(key, [/^\d+$/.test(m[1]) ? Number(m[1]) : 0, /^\d+$/.test(m[2]) ? Number(m[2]) : 0]);
    i += renamed ? 3 : 1;
  }
  return counts;
}

/* ------------------------------------------------------------- commands */

function sessionFolder(args) {
  if (!args.session) fail(EXIT.USAGE, "missing-session", "--session <folder> is required.", "Pass the console session folder (the `session` path `console.mjs open` printed).");
  return path.resolve(args.session);
}

function startCommand(args) {
  const session = sessionFolder(args);
  const root = path.resolve(args.root || process.cwd());
  const tree = snapshotTree(root);
  fs.mkdirSync(session, { recursive: true });
  fs.writeFileSync(path.join(session, START_FILE), JSON.stringify({ tree, at: new Date().toISOString() }) + "\n");
  out({ ok: true, tree });
}

async function diffCommand(args) {
  const session = sessionFolder(args);
  const root = path.resolve(args.root || process.cwd());
  let cap = DEFAULT_CAP;
  if (args.cap !== undefined) {
    if (!/^[1-9]\d*$/.test(String(args.cap))) fail(EXIT.USAGE, "bad-cap", `--cap must be a positive whole number of bytes, not "${args.cap}".`, "Pass --cap 524288, or leave it out.");
    cap = Number(args.cap);
  }
  const start = readStart(session);
  if (!start) fail(EXIT.NOT_FOUND, "no-start", "No snapshot was taken at the start of this run.", "Run changes.mjs start first, or tell the person the Changes tab has no starting point.");
  const top = topLevel(root);
  if (git(top, ["cat-file", "-e", `${start.tree}^{tree}`], { allowFail: true }) === null) {
    fail(EXIT.NOT_FOUND, "start-missing", "The snapshot taken at the start of this run is gone from the repository (git cleaned it up).", "Tell the person the Changes tab has no starting point, or run changes.mjs start and redo the comparison from there.");
  }
  const now = snapshotTree(root);
  // Fixed prefixes: a user's diff.noprefix or diff.mnemonicPrefix must not change the headers.
  const diffArgs = ["diff", "--no-color", "-M", "--no-ext-diff", "--src-prefix=a/", "--dst-prefix=b/"];
  const entries = nameEntries(git(top, ["diff", "--name-status", "-z", "-M", "--no-ext-diff", start.tree, now]));
  const numstat = git(top, ["diff", "--numstat", "-M", "--no-ext-diff", start.tree, now]);
  const { added, removed } = sumNumstat(numstat);
  let patch;
  let oversize = false;
  try {
    patch = git(top, [...diffArgs, start.tree, now]);
  } catch (err) {
    if (!(err && (err.code === "ENOBUFS" || err.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER"))) throw err;
    // Too big to even read: keep only the names, so the file list stays complete.
    oversize = true;
    patch = entries.map((e) => `diff --git a/${e[0]} b/${e[e.length - 1]}\n${e.length > 1 ? `rename from ${e[0]}\nrename to ${e[1]}\n` : ""}`).join("");
  }
  const files = (patch.match(/^diff --git /gm) || []).length;

  const { isSensitive } = await gitRepo();
  const shown = hideSensitive(patch, isSensitive, entries);
  const capped = oversize ? { patch: shown.patch + TOO_LARGE + "\n", truncated: true } : capPatch(shown.patch, cap);
  let text = capped.patch;
  const trailer = [];
  if (capped.truncated) trailer.push("# truncated: true");
  for (const p of shown.hidden) trailer.push(`# hidden: ${p}`);
  // Hidden and cut files carry no lines for the page to count: give it their counts.
  if (shown.hidden.length || capped.truncated) {
    const counts = fileCounts(git(top, ["diff", "--numstat", "-z", "-M", "--no-ext-diff", start.tree, now]));
    for (const [p, [a, d]] of counts) {
      if ((capped.truncated || shown.hidden.includes(p)) && !/[\t\n]/.test(p)) trailer.push(`# counts: ${a}\t${d}\t${p}`);
    }
  }
  if (trailer.length) text += (text && !text.endsWith("\n") ? "\n" : "") + trailer.join("\n") + "\n";

  fs.mkdirSync(session, { recursive: true });
  fs.writeFileSync(path.join(session, DIFF_FILE), text);
  out({ ok: true, files, added, removed, truncated: capped.truncated, hidden: shown.hidden, file: DIFF_FILE });
}

// Run only as a script: the tests import capPatch without starting it.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) {
  run(USAGE, async (argv) => {
    const args = parseArgs(argv, { values: ["session", "root", "cap"] });
    const [command] = args._;
    if (command === "start") return startCommand(args);
    if (command === "diff") return diffCommand(args);
    fail(EXIT.USAGE, "unknown-command", command ? `Unknown command "${command}".` : "No command given.", "Use `start` or `diff` (changes.mjs --help).");
  });
}
