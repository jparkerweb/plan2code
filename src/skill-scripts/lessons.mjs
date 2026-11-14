#!/usr/bin/env node
// lessons.mjs: Learning's one script.
//
// Skills and the dashboard agent run it for every read, write, check and state
// answer about a project's lessons, so a skill never reads the settings or the
// pause files itself. Whether Learning is active is decided in one place, the
// web console's learning.mjs (`learningState()`), which this script loads at
// run time through consoleModule("learning.mjs"), the way specs.mjs loads
// scan.mjs, so the dashboard and the skills never disagree.
//
// It writes only the project's `.plan2code/` files (and, through the core, the
// store on this machine). It never stages or commits.

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError, consoleModule, eol, EXIT, fail, isDir, isoDate, now, out, parseArgs, readText, rel, run, writeIfChanged } from "./common.mjs";
import { matchGlob, toPosix, unsupported } from "./glob.mjs";
import { readTestMap, renderTable, rowFromLine, spliceTable, tableFile, validRows } from "./test-map.mjs";

const USAGE = `
lessons.mjs: Learning's lessons, the team switch and the personal pause. JSON on stdout.
Every answer carries state (not-set-up, off, on, paused, unknown) and active.

--root (default: the current folder) is resolved to its checkout's top level.

  node lessons.mjs state [--root <dir>]
      Reads only: state, pausedSince, waiting { count, oldestDays }, hasAgents
      (AGENTS.md at the root), onDefaultBranch.

  node lessons.mjs switch on|off [--dry-run] [--root <dir>]
      The team switch: writes .plan2code/settings.json and adds (on) or
      removes (off) the pointer line and the upkeep sentence in AGENTS.md,
      every other byte left as it was. Never stages or commits. written lists
      the files changed (empty when nothing changed or --dry-run). No
      AGENTS.md: skipped "no-agents" and next "plan2code-init". On also gives
      offerLogMove (it turned the project on and the failure log has unmarked
      lines) and firstOn (no commit records the settings file as on yet).

  node lessons.mjs pause on|off [--root <dir>]
      The personal pause, on this machine only. Refused unless the project is on.

  node lessons.mjs read [--paths a,b] [--run <handle>] [--from-banner]
      Reads only: the lessons that fit this run, general.md plus the areas
      matching the named paths and the branch's changed files, each as
      { id, text, why, marked, gone }. run is the handle for the next read,
      which returns only areas not handed over yet; line is printed as is.
      The first read adds headsUp (left out with --from-banner) and logLines
      (the failure log lines log-lines would offer).

  node lessons.mjs note --type lesson --text <sentence> --kind <kind> --about a,b
                   --source said|inferred [--seen a,b] --skill <name>
                   [--why <sentence>] [--area <name>] [--dry-run]
      Check the lesson, then hold it on this machine until a person decides.
      kind: correction (needs --why), convention, how-it-works, command.
      about: one to three files, or one folder. --source inferred needs --seen.
      Does nothing (noted: false) while Learning is off or paused for you.
      Exit 4 invalid-lesson with problems; exit 5 secret with pattern and part.

  node lessons.mjs note --type area --name <Area name> --paths <glob,glob>
                   --skill <name> [--dry-run]
      Propose a new area: a name plus one to eight globs inside the repository.

  node lessons.mjs note --type doubt --target <lesson id> --found <sentence>
                   --skill <name> [--dry-run]
      A saved lesson that may no longer be true, for the person to decide.
      One per lesson: a second is not written (noted: false, already: true).

  node lessons.mjs note --type agents-fix --before <exact text> --after <new text>
                   [--file .agents-docs/<name>.md] --skill <name> [--dry-run]
  node lessons.mjs note --type agents-fix --test-map-row <json> --skill <name>
      A fix to AGENTS.md (or the .agents-docs/ file named): the before must
      occur exactly once (exit 4 no-match). A test map row is
      { area, paths: [..], run, shared }, replacing the row of that area or
      added. The new text is checked: a secret exits 5, writing nothing.

  node lessons.mjs check --text <sentence> [--why <sentence>]
      Reads only: the check note and decide run. refused { pattern, part }
      (a named secret pattern, its text cut to four characters) or null, and
      flags [{ pattern, part }] (email, handle, person-name). Always exit 0.

  node lessons.mjs list [--first-ask] [--log-all]
      Reads only: the approval list of everything waiting: items, opening
      (the main-branch line), card (the console's lessons item) and rounds
      (the items grouped by type for a question tool). While on, it adds
      the new failure log lines (--log-all: every unmarked one). With
      --first-ask while not set up and a lesson is waiting, firstAsk is the
      first-ask card: { lesson, sentences, yes, no, later }.

  node lessons.mjs decide --file <decisions.json> [--dry-run]
      Apply a person's choices, [{ id, choice, text?, why?, area?, name?, paths? }]:
      Keep, Reword, Drop for a lesson; Create, Rename, Drop for an area;
      Keep, Reword, Retire for a doubt or a lesson whose files are gone;
      Apply, Reword (after, or row), Drop for an AGENTS.md fix; Move (why,
      about, area?), Reword and move (lessons: [{ text, why, about, area? }]),
      Leave in the log for a failure log line. Writes .plan2code/lessons/
      and, for fixes and log lines, AGENTS.md or the .agents-docs/ file;
      never stages or commits. A fix whose before no longer matches, or a
      log line no longer in the file, is outOfDate. Returns written,
      stillWaiting, results [{ id, outcome }] and the closing line.

  node lessons.mjs decide --first-ask yes|no [--skill <name>] [--dry-run]
      The first ask, only while not set up. yes: switch on, then the list
      with offerLogMove. no (needs --skill): switch off, and each waiting
      correction the skill noted today goes to the failure log as one line.

  node lessons.mjs log-lines [--all]
      Reads only: failure log lines added since the first commit that
      switched Learning on, without the (kept in the log) mark; --all gives
      every unmarked line. lines [{ n, text, incidents }]. None outside git.

  node lessons.mjs areas --suggest
      Reads only: first areas from the AGENTS.md test map.

  node lessons.mjs report
      Reads only: lessons per area, the oldest, marked and gone ones.

  node lessons.mjs remove --confirm [--dry-run]
      Delete .plan2code/lessons/ (removed lists its files). Leaves
      settings.json, AGENTS.md and this machine's store; stages nothing.
      Without --confirm, exit 2.

Exit: 0 ok · 1 crash · 2 bad arguments · 3 not found (no-console: the web
console files are missing; carry on without lessons) · 4 invalid input or a
check that failed · 5 refused.
`;

/* ------------------------------------------------------------------- git */

/**
 * One read-only git call in `root`, bounded by a 5 second timeout:
 * `{ code, out }`, where `code` is git's exit status (null when git could not
 * run or timed out) and `out` the untrimmed stdout of a successful call.
 */
function gitRun(root, args) {
  try {
    const out = execFileSync("git", args, { cwd: root, encoding: "utf8", timeout: 5000, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    return { code: 0, out };
  } catch (err) {
    return { code: typeof err.status === "number" ? err.status : null, out: null };
  }
}

/** One read-only git call in `root`; the trimmed output, or null on any failure. */
function git(root, args) {
  const r = gitRun(root, args);
  return r.code === 0 ? r.out.trim() : null;
}

/** The repository's default branch: origin/HEAD's branch, else main when it exists, else master. Null outside git. */
function defaultBranch(root) {
  const remoteHead = git(root, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"]);
  if (remoteHead) return remoteHead.replace(/^origin\//, "");
  if (git(root, ["rev-parse", "--verify", "--quiet", "refs/heads/main"]) !== null) return "main";
  return "master";
}

/** Whether the checkout at `root` is on the repository's default branch. False outside git. */
function onDefaultBranch(root) {
  const current = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  if (!current || current === "HEAD") return false;
  return current === defaultBranch(root);
}

/** Every path `git status` lists (both sides of a rename), untrimmed so a leading space is kept. Null outside git. */
function statusPaths(root) {
  // --no-optional-locks: a read never refreshes the index.
  const r = gitRun(root, ["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  if (r.code !== 0) return null;
  const parts = r.out.split("\0");
  const paths = [];
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i];
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    // A rename or copy, in the index or the work tree, carries its old path as the next entry.
    if ("RC".includes(entry[0]) || "RC".includes(entry[1])) {
      if (parts[i + 1]) paths.push(parts[i + 1]);
      i++;
    }
  }
  return paths;
}

/**
 * The files this branch has changed (FR-49): on a branch other than the
 * default one, what changed since its merge base with the default branch plus
 * whatever `git status` lists; on the default branch, or with no merge base,
 * the `git status` paths only; outside git, an empty list. Repository-relative,
 * forward slashes, sorted, each once.
 */
export function changedFiles(root) {
  const status = statusPaths(root);
  if (status === null) return [];
  const found = new Set(status.map(toPosix));
  const current = currentBranch(root);
  const main = defaultBranch(root);
  if (current && current !== main) {
    const base = git(root, ["merge-base", main, "HEAD"]) || git(root, ["merge-base", `origin/${main}`, "HEAD"]);
    if (base) {
      const diff = gitRun(root, ["-c", "core.quotepath=off", "diff", "--name-only", "-z", `${base}...HEAD`]);
      if (diff.code === 0) for (const p of diff.out.split("\0")) if (p) found.add(toPosix(p));
    }
  }
  return [...found].sort();
}

/* ------------------------------------------------- git history as the clock */

// A lesson is marked when one of its About files changed in a commit that is
// not an ancestor of (or equal to) the commit that last touched its block
// (FR-25). The block's commit comes from `git blame`, the changes from one
// `git log`; any git failure leaves lessons unmarked (NFR-7).

const ZERO_ID = /^0+$/;

/** Exit 0 of `git merge-base --is-ancestor a b`: true, exit 1: false, anything else: null. */
function isAncestor(root, a, b, cache) {
  if (a === b) return true;
  const key = `${a} ${b}`;
  if (cache && cache.has(key)) return cache.get(key);
  const { code } = gitRun(root, ["merge-base", "--is-ancestor", a, b]);
  const answer = code === 0 ? true : code === 1 ? false : null;
  if (cache) cache.set(key, answer);
  return answer;
}

/** Final line number -> `{ commit, time, boundary }` from `git blame --porcelain` output. */
function parseBlame(out) {
  const commits = new Map();
  const lines = new Map();
  const rows = out.split("\n");
  for (let i = 0; i < rows.length; i++) {
    const head = rows[i].match(/^([0-9a-f]{40,64}) \d+ (\d+)(?: \d+)?$/);
    if (!head) continue;
    const sha = head[1];
    const info = commits.get(sha) || { time: 0, boundary: false };
    commits.set(sha, info);
    // Metadata (only the first time a commit appears), then the line itself.
    for (i++; i < rows.length && !rows[i].startsWith("\t"); i++) {
      if (rows[i].startsWith("committer-time ")) info.time = Number(rows[i].slice(15)) || 0;
      else if (rows[i] === "boundary") info.boundary = true;
    }
    lines.set(Number(head[2]), sha);
  }
  return { commits, lines };
}

/**
 * Per block of an area file, the newest commit among its (non-blank) lines:
 * `[{ commit, time, uncommitted, boundary }]`, in the order of `blocks`.
 * `uncommitted` when a line is not committed yet, `boundary` when a line
 * blames to the edge of a shallow history. One `git blame` for the whole file;
 * null when it fails (no git, a timeout, an untracked file).
 */
export function blockCommits(root, areaFile, blocks, cache = new Map()) {
  const file = toPosix(path.relative(root, areaFile));
  const r = gitRun(root, ["blame", "--porcelain", "--", file]);
  if (r.code !== 0) return null;
  const { commits, lines } = parseBlame(r.out);
  // Blame marks a repository's first commit as a boundary too (--root would
  // hide a shallow clone's edge as well): only a shallow history's counts.
  if ([...commits.values()].some((c) => c.boundary) && git(root, ["rev-parse", "--is-shallow-repository"]) !== "true") {
    for (const c of commits.values()) c.boundary = false;
  }
  return blocks.map((block) => {
    let newest = null;
    let uncommitted = false;
    let boundary = false;
    block.lines.forEach((text, k) => {
      if (!text.trim()) return; // a blank line moves with its neighbors
      const sha = lines.get(block.startLine + k);
      if (!sha) return;
      if (ZERO_ID.test(sha)) {
        uncommitted = true;
        return;
      }
      const info = commits.get(sha);
      if (info.boundary) boundary = true;
      if (!newest || sha === newest.commit) {
        newest ||= { commit: sha, time: info.time };
        return;
      }
      const later = info.time > newest.time || (info.time === newest.time && isAncestor(root, newest.commit, sha, cache) === true);
      if (later) newest = { commit: sha, time: info.time };
    });
    return { commit: newest ? newest.commit : null, time: newest ? newest.time : 0, uncommitted, boundary };
  });
}

const cleanPath = (p) => toPosix(String(p)).replace(/\/+$/, "");

/** A block's About paths, cleaned, without any that are unsafe (absolute, `..`), which git would refuse. */
const aboutOf = (block) =>
  (block.about || [])
    .map(cleanPath)
    .filter((p) => p && !pathProblem(p));

/** Whether a changed path is one of the About entries: the file itself, or any file under a folder. */
const touches = (about, changed) => about.some((a) => changed === a || changed.startsWith(a + "/"));

/** `sha -> parents` for every commit in `base..HEAD`, from one `git rev-list --parents`; null on failure. */
function commitGraph(root, base) {
  const r = gitRun(root, ["rev-list", "--parents", `${base}..HEAD`]);
  if (r.code !== 0) return null;
  const graph = new Map();
  for (const line of r.out.split("\n")) {
    const [sha, ...parents] = line.trim().split(" ");
    if (sha) graph.set(sha, parents);
  }
  return graph;
}

/** The commits of `graph` that are `commit` or its ancestors (empty when `commit` lies at or below the range's base). */
function ancestorsIn(graph, commit) {
  const seen = new Set();
  const stack = [commit];
  while (stack.length) {
    const sha = stack.pop();
    if (seen.has(sha) || !graph.has(sha)) continue;
    seen.add(sha);
    stack.push(...graph.get(sha));
  }
  return seen;
}

/**
 * Mark the lessons `[{ id, file, block }]` in place and return them, each with
 * `marked` and `gone`. A fixed handful of git calls: one `git blame` per area
 * file, then one `merge-base` (when the blocks have more than one commit), one
 * `rev-list` and one `git log`. Never marked: a block not committed yet, a
 * block on a shallow history's boundary, and every lesson of a file git cannot
 * blame. `gone` when none of a lesson's About paths exist on disk.
 */
export function markLessons(root, lessons) {
  const cache = new Map();
  for (const l of lessons) {
    l.marked = false;
    const about = aboutOf(l.block);
    l.gone = about.length > 0 && !about.some((p) => fs.existsSync(path.join(root, p)));
  }
  const byFile = new Map();
  for (const l of lessons) {
    if (!byFile.has(l.file)) byFile.set(l.file, []);
    byFile.get(l.file).push(l);
  }
  const candidates = [];
  for (const [file, list] of byFile) {
    const commits = blockCommits(root, file, list.map((l) => l.block), cache);
    if (!commits) continue;
    list.forEach((l, n) => {
      const c = commits[n];
      if (c.commit && !c.uncommitted && !c.boundary) candidates.push({ lesson: l, ...c });
    });
  }
  if (!candidates.length) return lessons;
  // The range starts at the common base of every block's commit, so an edit
  // on a branch beside one lesson's commit is seen whichever areas are read.
  const distinct = [...new Set(candidates.map((c) => c.commit))];
  const base = distinct.length === 1 ? distinct[0] : git(root, ["merge-base", "--octopus", ...distinct]);
  if (!base) return lessons;
  const graph = commitGraph(root, base);
  if (!graph) return lessons;
  const aboutPaths = [...new Set(candidates.flatMap((c) => aboutOf(c.lesson.block)))];
  if (!aboutPaths.length) return lessons;
  // The About paths narrow the log; a very long list is left out of the command line.
  const spec = aboutPaths.length <= 200 ? ["--", ...aboutPaths] : [];
  const log = gitRun(root, ["--literal-pathspecs", "-c", "core.quotepath=off", "log", "--full-history", "--name-only", "--format=%H", `${base}..HEAD`, ...spec]);
  if (log.code !== 0) return lessons;
  const changedBy = new Map();
  let sha = null;
  for (const line of log.out.split("\n")) {
    if (/^[0-9a-f]{40,64}$/.test(line)) sha = line;
    else if (line && sha) {
      const p = toPosix(line);
      if (!changedBy.has(p)) changedBy.set(p, []);
      changedBy.get(p).push(sha);
    }
  }
  const ancestors = new Map();
  for (const c of candidates) {
    const about = aboutOf(c.lesson.block);
    const after = new Set();
    for (const [p, shas] of changedBy) if (touches(about, p)) for (const s of shas) after.add(s);
    if (!ancestors.has(c.commit)) ancestors.set(c.commit, ancestorsIn(graph, c.commit));
    const own = ancestors.get(c.commit);
    // Every changing commit is in the range, so outside `own` means not an ancestor-or-equal.
    c.lesson.marked = [...after].some((s) => graph.has(s) && !own.has(s));
  }
  return lessons;
}

/** The checkout's current branch, or "" outside git or on a detached HEAD. */
function currentBranch(root) {
  const b = git(root, ["rev-parse", "--abbrev-ref", "HEAD"]);
  return b && b !== "HEAD" ? b : "";
}

/** The current branch, or "" when its name holds what looks like a secret, so it is never stored or echoed. */
function safeBranch(root) {
  const b = currentBranch(root);
  return b && secretIn(b) ? "" : b;
}

/* ------------------------------------------------------------ the record */

// An area file is `# <Area name>`, a `Paths: <glob>, <glob>` line (absent in
// general.md), a blank line, then blocks. A block is a `### <sentence>`
// heading, then `- Kind:`, `- About:`, `- Why:` (optional except for a
// correction) and `- Noted:` lines, then a blank line. Blocks are kept in
// alphabetical order by heading, so two branches adding lessons rarely touch
// the same lines.
//
// A parse keeps every line as it was (`head`, and each block's `lines`), so
// rendering an unchanged parse gives back the same bytes, and an edit touches
// only the block it changes.

export const LESSONS_DIR = path.join(".plan2code", "lessons");
export const GENERAL = "general";
export const GENERAL_MAX = 25;
export const KINDS = ["correction", "convention", "how-it-works", "command"];

const FIELD = /^- (Kind|About|Why|Noted):[ \t]?(.*)$/;
const NOTED = /^(.*?)(?:,\s*checked\s+(\d{4}-\d{2}-\d{2}))?\s*$/;

const splitList = (s) =>
  String(s || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

// A list of globs: split on commas outside braces, so `src/{web,api}/**`
// stays one glob (glob.mjs supports one level of `{a,b}`).
function splitGlobs(s) {
  const parts = [];
  let cur = "";
  let depth = 0;
  for (const ch of String(s || "")) {
    if (ch === "{") depth++;
    else if (ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

function parseBlock(lines, startLine) {
  const block = { heading: lines[0].slice(4).trim(), kind: "", about: [], why: "", noted: "", checked: null, lines, startLine, endLine: startLine + lines.length - 1 };
  for (const line of lines.slice(1)) {
    const m = line.match(FIELD);
    if (!m) continue;
    const value = m[2].trim();
    if (m[1] === "Kind") block.kind = value;
    else if (m[1] === "About") block.about = splitList(value);
    else if (m[1] === "Why") block.why = value;
    else {
      const n = value.match(NOTED);
      block.noted = n[1].trim();
      block.checked = n[2] || null;
    }
  }
  return block;
}

/** `{ name, paths, blocks, head, eol }` from an area file's text. Line numbers are 1-based. */
export function parseAreaFile(text) {
  const lineEnd = eol(text);
  const lines = String(text).split(/\r?\n/);
  const head = [];
  const blocks = [];
  let i = 0;
  while (i < lines.length && !lines[i].startsWith("### ")) head.push(lines[i++]);
  while (i < lines.length) {
    const start = i;
    i++;
    while (i < lines.length && !lines[i].startsWith("### ")) i++;
    blocks.push(parseBlock(lines.slice(start, i), start + 1));
  }
  const title = head.find((l) => /^# /.test(l));
  const pathsLine = head.find((l) => /^Paths:/.test(l));
  return {
    name: title ? title.slice(2).trim() : "",
    paths: pathsLine ? splitGlobs(pathsLine.slice(6)) : [],
    blocks,
    head,
    eol: lineEnd,
  };
}

/** A block's lines in the fixed shape, ending with its blank line. */
export function renderBlock(block) {
  const lines = [`### ${block.heading}`, `- Kind: ${block.kind}`, `- About: ${block.about.join(", ")}`];
  if (block.why) lines.push(`- Why: ${block.why}`);
  lines.push(`- Noted: ${block.noted}${block.checked ? `, checked ${block.checked}` : ""}`);
  lines.push("");
  return lines;
}

/** The file's text. Unchanged parts come back byte for byte. */
export function renderAreaFile(area) {
  const head = area.head || [`# ${area.name}`, ...(area.paths && area.paths.length ? [`Paths: ${area.paths.join(", ")}`] : []), ""];
  const lines = [...head];
  area.blocks.forEach((b, n) => {
    const own = b.lines || renderBlock(b);
    // A block that is followed by another always ends with its blank line.
    const needsGap = n < area.blocks.length - 1 && own[own.length - 1] !== "";
    lines.push(...own, ...(needsGap ? [""] : []));
  });
  return lines.join(area.eol || "\n");
}

/** A new, empty area: a title, its Paths line (none for general.md) and a blank line. */
export function newArea(name, paths) {
  return { name, paths: paths || [], blocks: [], head: null, eol: "\n" };
}

/** Lowercase, runs of anything but a-z and 0-9 to `-`, trimmed, at most 60 characters. */
export function slugOf(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
}

/** A lesson's identity: `<area-slug>/<heading-slug>`. Nothing extra is stored. */
export function lessonId(areaSlug, heading) {
  return `${areaSlug}/${slugOf(heading)}`;
}

/** The absolute path of an area's file: `<root>/.plan2code/lessons/<area-slug>.md`. */
export function areaFilePath(root, areaSlug) {
  return path.join(root, LESSONS_DIR, `${areaSlug}.md`);
}

/** The file slug for a new area's name. Exit 4 `bad-area` for an empty slug or the reserved `general`. */
export function areaSlug(name) {
  const slug = slugOf(name);
  if (!slug || slug === GENERAL || /[\r\n]/.test(String(name))) {
    fail(
      EXIT.INVALID,
      "bad-area",
      !slug ? `The area name ${JSON.stringify(String(name || ""))} has no letters or digits to name its file by.` : slug === GENERAL ? "General is reserved for general.md." : "An area name is one line.",
      "Give the area a plain name such as Web console server."
    );
  }
  return slug;
}

const blockSlug = (b) => slugOf(b.heading);
const idSlug = (id) => String(id).split("/").pop();
const byHeading = (a, b) => a.toLowerCase().localeCompare(b.toLowerCase());

/**
 * Insert a block at its alphabetical place. Returns `{ full: true }` when the
 * area is general.md and already holds 25 blocks, `{ duplicate: true }` when
 * the heading is already there, else `{ inserted: true, index }`.
 */
export function insertBlock(area, block, { general = false } = {}) {
  if (general && area.blocks.length >= GENERAL_MAX) return { full: true };
  if (area.blocks.some((b) => blockSlug(b) === slugOf(block.heading))) return { duplicate: true };
  let index = area.blocks.findIndex((b) => byHeading(b.heading, block.heading) > 0);
  if (index === -1) index = area.blocks.length;
  area.blocks.splice(index, 0, { ...block, lines: null });
  return { inserted: true, index };
}

/** Remove the block whose id (or heading slug) is `id`. Returns whether one went. */
export function removeBlock(area, id) {
  const at = area.blocks.findIndex((b) => blockSlug(b) === idSlug(id));
  if (at === -1) return false;
  area.blocks.splice(at, 1);
  return true;
}

/** Replace a block, re-sorting it when its heading changed. Refuses a heading another block holds. */
export function replaceBlock(area, id, block) {
  const at = area.blocks.findIndex((b) => blockSlug(b) === idSlug(id));
  if (at === -1) return { missing: true };
  if (area.blocks.some((b, n) => n !== at && blockSlug(b) === slugOf(block.heading))) return { duplicate: true };
  if (blockSlug(area.blocks[at]) === slugOf(block.heading)) {
    area.blocks[at] = { ...block, lines: null };
    return { replaced: true, index: at };
  }
  area.blocks.splice(at, 1);
  return insertBlock(area, block);
}

/* ------------------------------------------------------------- validation */

// Text inside backtick code spans, blanked out (same length) so a sentence or
// flag check ignores it.
const blankCode = (s) => String(s).replace(/`[^`]*`/g, (m) => " ".repeat(m.length));

function sentenceProblems(field, value) {
  const problems = [];
  const s = String(value);
  if (!s.trim()) problems.push({ field, message: `${field} is empty.` });
  if (/[\r\n]/.test(s)) problems.push({ field, message: `${field} must be one line.` });
  if (/[.!?]\s+[A-Z]/.test(blankCode(s))) problems.push({ field, message: `${field} must be one sentence.` });
  if (s.length > 200) problems.push({ field, message: `${field} is ${s.length} characters; at most 200.` });
  return problems;
}

/** Why a repository path is unsafe or malformed, or null when it is a plain relative path inside the root. */
function pathProblem(p) {
  const s = String(p);
  if (!s.trim()) return "is empty";
  if (s.includes("\\")) return "uses backslashes; use forward slashes";
  if (/^[A-Za-z]:/.test(s) || s.startsWith("/")) return "is absolute; give it relative to the repository root";
  if (s.split("/").some((part) => part === "..")) return "climbs out with ..";
  if (/[\r\n\0]/.test(s)) return "holds a line break";
  return null;
}

/**
 * The problems with a lesson, `[{ field, message }]` (empty when it is fine):
 * one sentence of at most 200 characters for text and why, a known kind, a
 * why for a correction, and one to three files or exactly one folder inside
 * the repository.
 */
export function validateLesson({ text, why, kind, about }, root) {
  const problems = [];
  problems.push(...sentenceProblems("text", text ?? ""));
  if (why) problems.push(...sentenceProblems("why", why));
  // A rejected kind is never echoed: it has not been through the secret check.
  if (!KINDS.includes(kind)) problems.push({ field: "kind", message: `kind must be one of ${KINDS.join(", ")}.` });
  if (kind === "correction" && !String(why || "").trim()) problems.push({ field: "why", message: "A correction needs a why." });
  const list = Array.isArray(about) ? about : splitList(about);
  if (!list.length) problems.push({ field: "about", message: "about names one to three files, or one folder." });
  for (const p of list) {
    if (typeof p !== "string") {
      problems.push({ field: "about", message: "An about entry is not a path." });
      continue;
    }
    const bad = pathProblem(p);
    if (bad) problems.push({ field: "about", message: `${p} ${bad}.` });
  }
  const folders = list.filter((p) => typeof p === "string" && (p.endsWith("/") || (root && !pathProblem(p) && isDir(path.join(root, p)))));
  if (folders.length && list.length > 1) problems.push({ field: "about", message: "about names one folder on its own, or one to three files." });
  else if (list.length > 3) problems.push({ field: "about", message: `about names ${list.length} files; at most 3.` });
  return problems;
}

/* -------------------------------------------------------------- the check */

// Refused outright, wherever they appear (code spans too): nothing matching
// one of these is ever written to the waiting store or to a lesson file.
export const SECRET_PATTERNS = [
  { name: "private-key-block", re: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/ },
  { name: "aws-access-key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "github-token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/ },
  { name: "slack-token", re: /\bxox[a-z]-[A-Za-z0-9-]{8,}/ },
  { name: "stripe-key", re: /\b[rs]k_live_[A-Za-z0-9]{10,}/ },
  { name: "google-api-key", re: /\bAIza[0-9A-Za-z_-]{35}/ },
  { name: "sk-key", re: /\bsk-(?:[A-Za-z0-9]+-)*[A-Za-z0-9_]{20,}/ },
  { name: "jwt", re: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}/ },
  { name: "url-credentials", re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]*:[^\s/@]+@/i },
  // The keyword may end a longer name (DB_PASSWORD=, dbPassword=, authToken=,
  // AWS_SECRET_ACCESS_KEY=); the \b after it keeps tokenizer: and PASSWORD_FILE= out.
  { name: "assigned-secret", re: /(?:password|passwd|secret(?:[ _-]?(?:access[ _-]?)?key)?|private[ _-]?key|access[ _-]?key|token|api[ _-]?key)\b["'`]?\s*[=:]\s*["'`]?([^\s"'`]{8,})/gi, value: true },
];

// A value after `password =` that only stands in for one: <...>, xxx, ***,
// ..., an environment variable name, or a reference to one.
function placeholder(value) {
  const v = value.replace(/[.,;)]+$/, "");
  if (/^<[^>]*>$/.test(v) || /^\{\{.*\}\}$/.test(v) || /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?$/.test(v)) return true;
  // Only when the whole value is filler: a real value that merely holds xxx or ... is a value.
  if (/^[x*._-]+$/i.test(v)) return true;
  // A variable's name: all letters, or words joined by `_` (GITHUB_TOKEN,
  // HOME). Uppercase letters mixed with digits (HUNTER2HUNTER2) are a value.
  if (/^[A-Z]+$/.test(v) || /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(v)) return true;
  if (/^(?:process\.env|os\.environ|env)[.[]/.test(v)) return true;
  return false;
}

/** The matched text cut to its first four characters, so output never repeats a secret. */
export const maskPart = (s) => (String(s).length > 4 ? String(s).slice(0, 4) + "…" : String(s));

function findSecret(text) {
  for (const p of SECRET_PATTERNS) {
    if (p.value) {
      for (const m of String(text).matchAll(p.re)) {
        if (!placeholder(m[1])) return { pattern: p.name, match: m[0] };
      }
      continue;
    }
    const m = String(text).match(p.re);
    if (m) return { pattern: p.name, match: m[0] };
  }
  return null;
}

// Raised for the person to look at, never refused. Never inside a code span.
export const FLAG_PATTERNS = [
  { name: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g },
  { name: "handle", re: /(?<![\w@.])@[A-Za-z0-9][A-Za-z0-9_-]*/g },
  // A run of capitalized words; the first word of a sentence does not count
  // ("Ask Jane Doe" flags "Jane Doe"), and what is left must be two or more.
  { name: "person-name", re: /\b[A-Z][a-z]+(?: [A-Z][a-z]+)+\b/g, names: true },
];

// The person-name part of a run, without a sentence's first word; null when
// fewer than two words are left.
function namePart(prose, m) {
  let words = m[0].split(" ");
  const before = prose.slice(0, m.index);
  if (!before.trim() || /[.!?:]\s*$/.test(before)) words = words.slice(1);
  return words.length >= 2 ? words.join(" ") : null;
}

/** `{ refused: { pattern, part } | null, flags: [{ pattern, part }] }` for one piece of text. */
export function checkText(text) {
  const s = String(text ?? "");
  const hit = findSecret(s);
  const refused = hit ? { pattern: hit.pattern, part: maskPart(hit.match) } : null;
  // Flags read the masked text, so a flag never shows what the refusal cut
  // (an email flag on the password half of a credential URL).
  const prose = blankCode(hit ? masked(s) : s);
  const flags = [];
  const emails = [];
  for (const f of FLAG_PATTERNS) {
    for (const m of prose.matchAll(f.re)) {
      // An email's own @domain is not a second, handle flag.
      if (f.name === "handle" && emails.some(([a, b]) => m.index >= a && m.index < b)) continue;
      if (f.name === "email") emails.push([m.index, m.index + m[0].length]);
      const part = f.names ? namePart(prose, m) : m[0];
      if (part && !flags.some((x) => x.pattern === f.name && x.part === part)) flags.push({ pattern: f.name, part });
    }
  }
  return { refused, flags };
}

/** The first secret in any of the values (names, paths, the skill), masked; null when there is none. */
function secretIn(...values) {
  for (const v of values.flat()) {
    if (v === undefined || v === null || v === "") continue;
    const hit = findSecret(String(v));
    if (hit) return { pattern: hit.pattern, part: maskPart(hit.match) };
  }
  return null;
}

/** checkText over several pieces (text and why): the first refusal, every flag once. */
function checkAll(...pieces) {
  let refused = null;
  const flags = [];
  for (const piece of pieces) {
    if (!piece) continue;
    const r = checkText(piece);
    refused ||= r.refused;
    for (const f of r.flags) if (!flags.some((x) => x.pattern === f.pattern && x.part === f.part)) flags.push(f);
  }
  return { refused, flags };
}

// The text with every secret match cut down, for an item listed as refused.
function masked(text) {
  let s = String(text ?? "");
  for (let hit = findSecret(s), guard = 0; hit && guard < 20; hit = findSecret(s), guard++) s = s.split(hit.match).join(maskPart(hit.match));
  return s;
}

/* ------------------------------------------------------------- the areas */

/** Every area file under .plan2code/lessons/: Map slug -> { slug, file, area, existed }. general.md included. */
function loadAreas(root) {
  const dir = path.join(root, LESSONS_DIR);
  const areas = new Map();
  let names = [];
  try {
    names = fs.readdirSync(dir);
  } catch {}
  for (const name of names.sort()) {
    if (!name.endsWith(".md")) continue;
    const file = path.join(dir, name);
    const text = readText(file);
    if (text === null) continue;
    const slug = name.slice(0, -3);
    areas.set(slug, { slug, file, area: parseAreaFile(text), existed: true, dirty: false });
  }
  return areas;
}

/** An area's lessons as `[{ id, slug, file, block }]`, in file order. */
const lessonsOf = (entry) => entry.area.blocks.map((block) => ({ id: lessonId(entry.slug, block.heading), slug: entry.slug, file: entry.file, block }));

/** Every saved lesson of the named area slugs (every area when `slugs` is left out). */
export function readLessons(root, slugs) {
  const found = [];
  for (const entry of loadAreas(root).values()) if (!slugs || slugs.includes(entry.slug)) found.push(...lessonsOf(entry));
  return found;
}

/** The saved lesson `<area-slug>/<heading-slug>` names: `{ entry, block }`, or null. */
function findLesson(loaded, id) {
  const at = String(id).indexOf("/");
  if (at < 1) return null;
  const entry = loaded.get(String(id).slice(0, at));
  const block = entry && entry.area.blocks.find((b) => blockSlug(b) === idSlug(id));
  return block ? { entry, block } : null;
}

// The literal prefix of a glob: everything before its first wildcard or brace.
const literalPrefix = (glob) => toPosix(glob).split(/[*?{]/)[0].length;

/**
 * The most specific area an item's `about` paths fall in: the one whose
 * matching glob has the longest literal prefix (ties: the alphabetically first
 * name), or `{ slug: "general" }` when nothing matches. `areas` are
 * `{ slug, name, paths, proposed? }`.
 */
export function matchArea(root, about, waitingAreas = [], areas = null) {
  const known = areas || [...loadAreas(root).values()].filter((a) => a.slug !== GENERAL).map((a) => ({ slug: a.slug, name: a.area.name, paths: a.area.paths }));
  const candidates = [...known, ...waitingAreas.map((w) => ({ slug: slugOf(w.name), name: w.name, paths: w.paths || [], proposed: true }))];
  let best = null;
  for (const a of candidates) {
    if (!a.slug || a.slug === GENERAL) continue;
    for (const glob of a.paths || []) {
      if (unsupported(glob)) continue;
      for (const p of about || []) {
        if (!matchGlob(glob, String(p).replace(/\/+$/, ""))) continue;
        const score = literalPrefix(glob);
        if (!best || score > best.score || (score === best.score && byHeading(a.name, best.area.name) < 0)) best = { score, area: a };
      }
    }
  }
  return best ? { slug: best.area.slug, name: best.area.name, proposed: !!best.area.proposed } : { slug: GENERAL, name: "General", proposed: false };
}

/* -------------------------------------------------------------- AGENTS.md */

// The wording that follows the team switch (FR-37), word for word.
export const POINTER_LINE =
  "Lessons: approved lessons about this codebase live in `.plan2code/lessons/`, one file per area plus `general.md`. Each file lists the paths it covers; read the matching file before changing that code.";
export const UPKEEP_SENTENCE =
  "During a Plan2Code skill run, mistakes are offered as lessons at the end of the run, not written here. Outside a skill run, add one line to the failure log as before.";
// The mark on a failure log line a person chose to leave there (FR-36).
export const KEPT_MARK = "(kept in the log)";

export const KEEPING_HEADING = /^## +keeping this file current\s*$/i;
export const FAILURE_LOG_HEADING = /^## +failure log\s*$/i;
const FENCE_LINE = /^\s*(```|~~~)/;
const SETTINGS_REL = ".plan2code/settings.json";

// A file as segments, each one line's text (`body`) and its own line ending
// (`end`, "" for a last line with none), so an edit keeps every other line's
// bytes, mixed line endings included.
function segmentsOf(text) {
  return (String(text).match(/[^\n]*\n|[^\n]+$/g) || []).map((s) => {
    const body = s.replace(/\r?\n$/, "");
    return { body, end: s.slice(body.length) };
  });
}
const joinSegments = (segs) => segs.map((s) => s.body + s.end).join("");
const isBlank = (seg) => !!seg && seg.body.trim() === "";
const bodiesOf = (segs) => segs.map((s) => s.body);

/** Which lines sit inside a code fence, the fence lines included. */
function fencedOf(lines) {
  let inFence = false;
  return lines.map((l) => {
    if (FENCE_LINE.test(l)) {
      inFence = !inFence;
      return true;
    }
    return inFence;
  });
}

/**
 * The `## ` section whose heading matches `headingRe`, outside code fences:
 * `{ heading, start, end }` (0-based line indexes; the body is [start, end),
 * ending at the next `#` or `##` heading), or null.
 */
export function findSection(lines, headingRe) {
  const fenced = fencedOf(lines);
  const at = lines.findIndex((l, i) => !fenced[i] && headingRe.test(l));
  if (at === -1) return null;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    if (!fenced[i] && /^#{1,2} /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { heading: at, start: at + 1, end };
}

const lineIndex = (segs, text) => segs.findIndex((s) => s.body.trim() === text);

// Insert `text` as its own paragraph before segment `at` (segs.length: the
// end): with a blank line after it when the line before is blank or there is
// none, else with a blank line before it. removeParagraph() takes back
// exactly what this added.
function insertParagraph(segs, at, text, nl) {
  const last = segs[segs.length - 1];
  if (!last) {
    segs.push({ body: text, end: nl });
    return;
  }
  if (at >= segs.length && last.end === "") {
    last.end = nl;
    segs.push({ body: "", end: nl }, { body: text, end: "" });
    return;
  }
  const prevBlank = at === 0 || isBlank(segs[at - 1]);
  segs.splice(at, 0, ...(prevBlank ? [{ body: text, end: nl }, { body: "", end: nl }] : [{ body: "", end: nl }, { body: text, end: nl }]));
}

// Insert `text` as the first paragraph under the heading at `h`.
function insertUnder(segs, h, text, nl) {
  const head = segs[h];
  if (h === segs.length - 1) {
    if (head.end === "") {
      head.end = nl;
      segs.push({ body: text, end: "" });
    } else segs.push({ body: text, end: nl });
    return;
  }
  segs.splice(isBlank(segs[h + 1]) ? h + 2 : h + 1, 0, { body: text, end: nl }, { body: "", end: nl });
}

// Remove the line holding `text` and the one blank line it brought: the one
// after it, else the one before it.
function removeParagraph(segs, text) {
  const j = lineIndex(segs, text);
  if (j === -1) return false;
  if (isBlank(segs[j + 1])) segs.splice(j, 2);
  else if (j === segs.length - 1 && segs[j].end === "") {
    segs.splice(j, 1);
    if (isBlank(segs[j - 1])) segs.splice(j - 1, 1);
    if (segs.length) segs[segs.length - 1].end = "";
  } else if (isBlank(segs[j - 1])) segs.splice(j - 1, 2);
  else segs.splice(j, 1);
  return true;
}

/**
 * Add (on) or remove (off) the pointer line and the upkeep sentence in the
 * project's AGENTS.md (FR-37). On: the pointer as its own paragraph directly
 * above `## Keeping this file current` (else above `## Failure log`, else at
 * the end), the upkeep sentence as the first paragraph under `## Keeping this
 * file current` (skipped, `skipped: "no-keeping-section"`, when that heading
 * is missing); a text already there is left alone. Off: exactly those two
 * texts and the blank line each brought. Every other line stays
 * byte-identical. No AGENTS.md: nothing changes, and `next` points at Init.
 */
export function syncAgentsWording(root, on, { dryRun = false } = {}) {
  const file = path.join(root, "AGENTS.md");
  const text = readText(file);
  if (text === null) return { written: [], skipped: "no-agents", next: "plan2code-init" };
  const nl = eol(text);
  const segs = segmentsOf(text);
  let skipped = null;
  if (on) {
    if (lineIndex(segs, POINTER_LINE) === -1) {
      const lines = bodiesOf(segs);
      const anchor = findSection(lines, KEEPING_HEADING) || findSection(lines, FAILURE_LOG_HEADING);
      insertParagraph(segs, anchor ? anchor.heading : segs.length, POINTER_LINE, nl);
    }
    if (lineIndex(segs, UPKEEP_SENTENCE) === -1) {
      const keeping = findSection(bodiesOf(segs), KEEPING_HEADING);
      if (keeping) insertUnder(segs, keeping.heading, UPKEEP_SENTENCE, nl);
      else skipped = "no-keeping-section";
    }
  } else {
    removeParagraph(segs, UPKEEP_SENTENCE);
    removeParagraph(segs, POINTER_LINE);
  }
  const next = joinSegments(segs);
  const written = !dryRun && writeIfChanged(file, next) ? ["AGENTS.md"] : [];
  return skipped ? { written, skipped } : { written };
}

/* ------------------------------------------------------- the failure log */

// A sentence end followed by a capital (or a code span or bold) starts a new
// incident; text inside code spans never splits.
function splitIncidents(text) {
  const blanked = blankCode(text);
  const parts = [];
  let from = 0;
  for (const m of blanked.matchAll(/[.!?]["')\]]*\s+(?=[A-Z`*])/g)) {
    const at = m.index + m[0].length;
    parts.push(text.slice(from, at).trim());
    from = at;
  }
  parts.push(text.slice(from).trim());
  return parts.filter(Boolean).map((t) => ({ text: t, kind: "correction" }));
}

/**
 * The top-level `- ` bullets of `## Failure log` in segments `segs`:
 * `[{ n, start, end, text, marked, incidents }]`, where n is the first line
 * (1-based), [start, end) the bullet's lines (an indented line continues it),
 * text its words joined into one line, and marked whether it ends with the
 * script's mark (trusted only at the very end of the bullet).
 */
function bulletsOf(segs) {
  const lines = bodiesOf(segs);
  const section = findSection(lines, FAILURE_LOG_HEADING);
  if (!section) return [];
  const fenced = fencedOf(lines);
  const found = [];
  let cur = null;
  for (let i = section.start; i < section.end; i++) {
    const l = lines[i];
    if (!fenced[i] && /^- /.test(l)) {
      cur = { n: i + 1, start: i, end: i + 1, parts: [l.slice(2).trim()] };
      found.push(cur);
    } else if (cur && !fenced[i] && /^\s+\S/.test(l)) {
      cur.parts.push(l.trim());
      cur.end = i + 1;
    } else cur = null;
  }
  return found.map(({ parts, ...b }) => {
    const text = parts.join(" ").trim();
    return { ...b, text, marked: text.endsWith(KEPT_MARK), incidents: splitIncidents(text) };
  });
}

/**
 * Every failure log line in the project's AGENTS.md (none without one). An
 * empty bullet (Init's `- ` placeholder) is not a line.
 */
export function failureLogLines(root) {
  const text = readText(path.join(root, "AGENTS.md"));
  return text === null ? [] : bulletsOf(segmentsOf(text)).filter((b) => b.text);
}

/**
 * The first commit in which `.plan2code/settings.json` says on: the oldest in
 * `git log --reverse` whose version of the file parses with learning "on".
 * Null outside git, when it was never committed on, or on any git failure.
 */
export function firstOnCommit(root) {
  const log = git(root, ["log", "--reverse", "--format=%H", "--", SETTINGS_REL]);
  if (!log) return null;
  for (const sha of log.split("\n").map((s) => s.trim())) {
    if (!/^[0-9a-f]{40,64}$/.test(sha)) continue;
    const r = gitRun(root, ["show", `${sha}:${SETTINGS_REL}`]);
    if (r.code !== 0) continue;
    try {
      if (JSON.parse(r.out).learning === "on") return sha;
    } catch {}
  }
  return null;
}

/**
 * The unmarked failure log lines added since Learning was first switched on
 * (FR-36): a line any of whose lines is uncommitted or blames to a commit
 * that is neither that first switch-on commit nor one of its ancestors. With
 * no switch-on commit, outside git or on any git failure: none (NFR-7).
 */
export function newLogLines(root) {
  // No unmarked line, no git call: a read in a project without a failure log costs nothing.
  const lines = failureLogLines(root).filter((l) => !l.marked);
  if (!lines.length) return [];
  const first = firstOnCommit(root);
  if (!first) return [];
  const r = gitRun(root, ["blame", "--porcelain", "--", "AGENTS.md"]);
  if (r.code !== 0) return [];
  const blamed = parseBlame(r.out).lines;
  const cache = new Map();
  return lines.filter((l) => {
    for (let n = l.start + 1; n <= l.end; n++) {
      const sha = blamed.get(n);
      if (!sha) continue;
      if (ZERO_ID.test(sha) || isAncestor(root, sha, first, cache) === false) return true;
    }
    return false;
  });
}

const logLineOut = (l) => ({ n: l.n, text: l.text, incidents: l.incidents });
const LOG_PREFIX = "log:";
/** A failure log line's list id: `log:` and 12 hex of its text's hash, so a decision finds it by its text. */
const logId = (text) => LOG_PREFIX + crypto.createHash("sha256").update(text).digest("hex").slice(0, 12);

/** The text with the bullet whose text is `text` taken out, or null when no bullet has it. */
function withoutBullet(text, bullet) {
  const segs = segmentsOf(text);
  const b = bulletsOf(segs).find((x) => x.text === bullet);
  if (!b) return null;
  const wasLast = b.end === segs.length;
  segs.splice(b.start, b.end - b.start);
  if (wasLast && segs.length && segs[segs.length - 1].end !== "" && !/\n$/.test(text)) segs[segs.length - 1].end = "";
  return joinSegments(segs);
}

/** The text with the mark added at the end of that bullet's last line, or null when no bullet has it. */
function withMark(text, bullet) {
  const segs = segmentsOf(text);
  const b = bulletsOf(segs).find((x) => x.text === bullet);
  if (!b) return null;
  const last = segs[b.end - 1];
  last.body = `${last.body.replace(/\s+$/, "")} ${KEPT_MARK}`;
  return joinSegments(segs);
}

const sentence = (s) => {
  const t = String(s || "").trim();
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
};

/** The text with `line` added as the failure log's last bullet, or null when there is no `## Failure log`. */
function withLogLine(text, line) {
  const nl = eol(text);
  const segs = segmentsOf(text);
  const lines = bodiesOf(segs);
  const section = findSection(lines, FAILURE_LOG_HEADING);
  if (!section) return null;
  const bullets = bulletsOf(segs);
  let at;
  let add;
  if (bullets.length) {
    at = bullets[bullets.length - 1].end;
    add = [{ body: `- ${line}`, end: nl }];
  } else {
    // Below the section's last words (its heading when it has none), after a blank line.
    at = section.start;
    for (let i = section.start; i < section.end; i++) if (lines[i].trim()) at = i + 1;
    add = [{ body: "", end: nl }, { body: `- ${line}`, end: nl }];
  }
  if (at >= segs.length && segs[segs.length - 1].end === "") {
    segs[segs.length - 1].end = nl;
    add[add.length - 1].end = "";
  }
  segs.splice(at, 0, ...add);
  return joinSegments(segs);
}

const occurrences = (text, part) => (part ? text.split(part).length - 1 : 0);

/** Where an AGENTS.md fix may point: AGENTS.md, or a Markdown file under .agents-docs/. Null when the path is not one of those. */
function fixFile(file) {
  if (file === undefined) return "AGENTS.md";
  const f = String(file).trim();
  if (f === "AGENTS.md") return f;
  if (pathProblem(f) || !/^\.agents-docs\/[^/].*\.md$/i.test(f)) return null;
  return f;
}

/** A test map row's one table line, as test-map.mjs renders it. */
const rowLine = (row) => renderTable([row])[2];
const sameArea = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

/* ------------------------------------------------------------ the core */

async function core() {
  try {
    return await consoleModule("learning.mjs");
  } catch (err) {
    if (err instanceof CliError) {
      fail(
        EXIT.NOT_FOUND,
        "no-console",
        "The web console files were not found, so Learning's state cannot be read.",
        "Carry on without lessons; reinstall the Plan2Code skills (node install.js) to bring them back."
      );
    }
    throw err;
  }
}

const stateOf = (L, root) => L.learningState(root, now());

/* ------------------------------------------------------------- commands */

async function cmdState(L, root) {
  const s = stateOf(L, root);
  out({
    ok: true,
    state: s.state,
    active: s.active,
    pausedSince: s.pausedSince,
    waiting: s.waiting,
    hasAgents: fs.existsSync(path.join(root, "AGENTS.md")),
    onDefaultBranch: onDefaultBranch(root),
  });
}

/**
 * Flip the team switch: settings.json plus the AGENTS.md wording. Files only,
 * never staged. `{ written, skipped?, next?, offerLogMove?, firstOn? }`; the
 * last two only for on: offerLogMove when this call turns a project that was
 * not set up or off on and its failure log has an unmarked line, firstOn when
 * no commit yet records the settings file as on.
 */
function applySwitch(L, root, value, dryRun) {
  const before = stateOf(L, root);
  if (before.state === "unknown") {
    fail(
      EXIT.REFUSED,
      "unknown-format",
      "The project's .plan2code/settings.json is from a newer Plan2Code, or is not one this script can read.",
      "Update the Plan2Code skills (node install.js), then try again.",
      { state: before.state, active: before.active }
    );
  }
  const file = path.join(root, ".plan2code", "settings.json");
  const body = JSON.stringify({ format: L.FORMAT, learning: value }, null, 2) + "\n";
  const written = [];
  if (!dryRun && writeIfChanged(file, body)) written.push(rel(root, file));
  const sync = syncAgentsWording(root, value === "on", { dryRun });
  written.push(...sync.written);
  const result = { written };
  if (sync.skipped) result.skipped = sync.skipped;
  if (sync.next) result.next = sync.next;
  if (value === "on") {
    const turnedOn = before.state === "not-set-up" || before.state === "off";
    result.offerLogMove = turnedOn && failureLogLines(root).some((l) => !l.marked);
    if (firstOnCommit(root) === null) result.firstOn = true;
  }
  return result;
}

async function cmdSwitch(L, root, args) {
  const value = args._[1];
  if (value !== "on" && value !== "off") fail(EXIT.USAGE, "missing-value", "switch needs on or off.", "Run: lessons.mjs switch on, or lessons.mjs switch off.");
  const { written, ...rest } = applySwitch(L, root, value, !!args["dry-run"]);
  const s = stateOf(L, root);
  out({ ok: true, state: s.state, active: s.active, written, dryRun: !!args["dry-run"], ...rest });
}

async function cmdLogLines(L, root, args) {
  const s = L.learningState(root, now(), { prune: false });
  const lines = args.all ? failureLogLines(root).filter((l) => !l.marked) : newLogLines(root);
  out({ ok: true, state: s.state, active: s.active, lines: lines.map(logLineOut) });
}

async function cmdRemove(L, root, args) {
  if (!args.confirm) {
    fail(EXIT.USAGE, "needs-confirm", "remove deletes every saved lesson in the project's lessons (.plan2code/lessons/), so it needs --confirm.", "Ask the person first, then run: lessons.mjs remove --confirm.");
  }
  const s = L.learningState(root, now(), { prune: false });
  const dir = path.join(root, LESSONS_DIR);
  let removed = [];
  try {
    removed = fs
      .readdirSync(dir, { recursive: true })
      .map(String)
      .filter((f) => !isDir(path.join(dir, f)))
      .map((f) => toPosix(path.join(LESSONS_DIR, f)))
      .sort();
  } catch {}
  if (!args["dry-run"] && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  out({ ok: true, state: s.state, active: s.active, removed, dryRun: !!args["dry-run"] });
}

async function cmdPause(L, root, args) {
  const value = args._[1];
  if (value !== "on" && value !== "off") fail(EXIT.USAGE, "missing-value", "pause needs on or off.", "Run: lessons.mjs pause on, or lessons.mjs pause off.");
  const before = stateOf(L, root);
  if (before.state !== "on" && before.state !== "paused") {
    fail(
      EXIT.REFUSED,
      "not-on",
      "A pause is only available while Learning is on for the project.",
      "Turn Learning on first (lessons.mjs switch on), or leave it as it is.",
      { state: before.state, active: before.active }
    );
  }
  if (value === "on" ? before.state !== "paused" : before.state === "paused") L.writePause(root, value === "on", now());
  const s = stateOf(L, root);
  out({ ok: true, state: s.state, active: s.active, pausedSince: s.pausedSince });
}

async function cmdCheck(L, root, args) {
  if (typeof args.text !== "string") fail(EXIT.USAGE, "missing-value", "check needs --text.", "Run: lessons.mjs check --text <sentence> [--why <sentence>].");
  const s = stateOf(L, root);
  const { refused, flags } = checkAll(args.text, args.why);
  out({ ok: true, state: s.state, active: s.active, refused, flags });
}

const SOURCES = ["said", "inferred"];

/** Fail with exit 4 and the list when a check found problems. */
function refuseProblems(error, problems, what) {
  if (!problems.length) return;
  fail(EXIT.INVALID, error, `The ${what} was not noted: ${problems.map((p) => p.message).join(" ")}`, "Fix what problems lists and note it again.", { problems });
}

const MAX_EXPANSIONS = 64;

// Every path a glob's braces spell out, `{..,src}/**` giving `../**` and
// `src/**`; null when there are more than MAX_EXPANSIONS. Assumes the glob
// passed unsupported(), so braces are one level deep and matched.
function braceExpansions(glob) {
  let all = [glob];
  for (;;) {
    const next = [];
    let grew = false;
    for (const g of all) {
      const m = g.match(/\{([^{}]*)\}/);
      if (!m) {
        next.push(g);
        continue;
      }
      grew = true;
      for (const alt of m[1].split(",")) next.push(g.slice(0, m.index) + alt + g.slice(m.index + m[0].length));
    }
    if (next.length > MAX_EXPANSIONS) return null;
    all = next;
    if (!grew) return all;
  }
}

function globProblems(paths) {
  const problems = [];
  if (paths.length < 1 || paths.length > 8) problems.push({ field: "paths", message: `An area has one to eight globs; got ${paths.length}.` });
  for (const g of paths) {
    let bad = pathProblem(g) || unsupported(g);
    if (!bad) {
      // Each brace alternative stays inside the repository too.
      const each = braceExpansions(g);
      bad = each ? each.map(pathProblem).find(Boolean) : `spells out more than ${MAX_EXPANSIONS} paths`;
    }
    if (bad) problems.push({ field: "paths", message: `${g}: ${bad}.` });
  }
  return problems;
}

async function cmdNote(L, root, args) {
  const type = args.type;
  if (type !== "lesson" && type !== "area" && type !== "doubt" && type !== "agents-fix") {
    fail(EXIT.USAGE, "missing-value", type ? "That note type is not one of lesson, area, doubt or agents-fix." : "note needs --type lesson, area, doubt or agents-fix.", "Run: lessons.mjs note --type lesson ..., --type area, --type doubt or --type agents-fix.");
  }
  if (typeof args.skill !== "string" || !args.skill.trim()) fail(EXIT.USAGE, "missing-value", "note needs --skill, the skill noting it.", "Add --skill <name>, for example --skill Implement.");
  const s = stateOf(L, root);
  // Not set up still holds the first lesson, for the first-ask card (FR-46).
  if (s.state !== "on" && s.state !== "not-set-up") {
    out({ ok: true, state: s.state, active: s.active, noted: false });
    return;
  }
  const when = now();
  const branch = safeBranch(root);
  const id = L.newWaitingId(when);
  const refuseSecret = (refused, what) => {
    if (!refused) return;
    fail(EXIT.REFUSED, "secret", `The ${what} holds what looks like a secret (${refused.pattern}), so it was not noted.`, "Leave the secret out and note it again.", { pattern: refused.pattern, part: refused.part, state: s.state, active: s.active });
  };
  // Names, paths and the skill are checked before anything is echoed back in
  // a problem message; the lesson's text and why after validation, as before.
  const lists = { about: splitList(args.about), seen: splitList(args.seen), paths: splitGlobs(args.paths) };
  refuseSecret(secretIn(args.skill, args.name, args.area, args.target, args.file, lists.about, lists.seen, lists.paths), type);
  const skillProblems = /[\r\n]/.test(args.skill) || args.skill.trim().length > 40 ? [{ field: "skill", message: "skill is one line of at most 40 characters, the skill's name." }] : [];
  let item;
  if (type === "doubt") {
    if (typeof args.target !== "string" || typeof args.found !== "string") fail(EXIT.USAGE, "missing-value", "note --type doubt needs --target and --found.", "Add --target <lesson id> --found <one sentence>.");
    const problems = [...skillProblems, ...sentenceProblems("found", args.found)];
    const saved = findLesson(loadAreas(root), args.target.trim());
    if (!saved) problems.push({ field: "target", message: "No saved lesson has that id; use an id read returned." });
    refuseProblems("invalid-doubt", problems, "doubt");
    // Stored as the lesson's own id, so the one-per-lesson check always meets it.
    const target = lessonId(saved.entry.slug, saved.block.heading);
    const { refused, flags } = checkAll(args.found);
    refuseSecret(refused, "doubt");
    // One doubt per lesson: a second one adds nothing for the person to decide.
    const already = L.listWaiting(root, when).find((w) => w.type === "doubt" && w.target === target);
    if (already) {
      out({ ok: true, state: s.state, active: s.active, noted: false, id: already.id, line: "", already: true });
      return;
    }
    item = { id, type, target, found: args.found.trim(), skill: args.skill.trim(), branch, noted: when.toISOString(), flags };
  } else if (type === "agents-fix") {
    item = agentsFixItem(root, args, { id, skillProblems, refuseSecret, branch, when });
  } else if (type === "area") {
    if (typeof args.name !== "string") fail(EXIT.USAGE, "missing-value", "note --type area needs --name.", "Add --name <Area name> --paths <glob,glob>.");
    areaSlug(args.name);
    const paths = lists.paths.map(toPosix);
    refuseProblems("invalid-area", [...skillProblems, ...globProblems(paths)], "area");
    item = { id, type, name: args.name.trim(), paths, skill: args.skill.trim(), branch, noted: when.toISOString() };
  } else {
    const about = lists.about.map((p) => p.replace(/\/{2,}/g, "/"));
    const seen = lists.seen;
    const lesson = { text: args.text ?? "", why: args.why || "", kind: args.kind, about };
    const problems = [...skillProblems, ...validateLesson(lesson, root)];
    if (args.area !== undefined && /[\r\n]/.test(args.area)) problems.push({ field: "area", message: "area is one line, the area's name." });
    if (!SOURCES.includes(args.source)) problems.push({ field: "source", message: "source must be said or inferred." });
    if (args.source === "inferred" && !seen.length) problems.push({ field: "seen", message: "An inferred lesson names the files it was seen in (--seen)." });
    for (const p of seen) {
      const bad = pathProblem(p);
      if (bad) problems.push({ field: "seen", message: `${p} ${bad}.` });
    }
    refuseProblems("invalid-lesson", problems, "lesson");
    const { refused, flags } = checkAll(lesson.text, lesson.why);
    refuseSecret(refused, "lesson");
    item = { id, type, kind: lesson.kind, text: lesson.text, why: lesson.why, about, source: args.source, seen, skill: args.skill.trim(), branch, noted: when.toISOString(), area: (args.area || "").trim(), flags };
  }
  if (!args["dry-run"]) L.writeWaiting(root, item);
  out({
    ok: true,
    state: s.state,
    active: s.active,
    noted: true,
    id,
    flags: item.flags || [],
    line: `Noted for the end of the run: ${type === "area" ? `a new area, ${item.name}` : type === "doubt" ? `a doubt about ${item.target}` : type === "agents-fix" ? `a fix to ${item.file}` : item.text}`,
    dryRun: !!args["dry-run"],
  });
}

/**
 * The waiting item for `note --type agents-fix`: a before and after in
 * AGENTS.md or a file under .agents-docs/ (`--file`), the before found
 * exactly once (exit 4 `no-match`), or a test map row (`--test-map-row`,
 * validated as test-map.mjs write validates one). New text goes through the
 * check: a refusal exits 5 and writes nothing.
 */
function agentsFixItem(root, args, { id, skillProblems, refuseSecret, branch, when }) {
  refuseProblems("invalid-fix", skillProblems, "fix");
  const base = { id, type: "agents-fix", skill: args.skill.trim(), branch, noted: when.toISOString() };
  if (args["test-map-row"] !== undefined) {
    let raw;
    try {
      raw = JSON.parse(args["test-map-row"]);
    } catch {
      fail(EXIT.INVALID, "invalid-rows", "--test-map-row is not JSON.", "Pass one row as JSON: { area, paths: [..], run, shared }.");
    }
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) fail(EXIT.INVALID, "invalid-rows", "--test-map-row is one row, a JSON object.", "Pass one row as JSON: { area, paths: [..], run, shared }.");
    // Secrets first: a validation message names the bad glob.
    refuseSecret(secretIn(raw.area, raw.run, Array.isArray(raw.paths) ? raw.paths : []), "fix");
    let row;
    try {
      [row] = validRows([raw]);
    } catch (err) {
      if (!(err instanceof CliError)) throw err;
      fail(EXIT.INVALID, "invalid-rows", err.message.replace(/^Row 0 /, "The row "), "Fix the --test-map-row JSON and note it again.");
    }
    const { refused, flags } = checkAll(row.area, row.run, row.paths.join(", "));
    refuseSecret(refused, "fix");
    const map = readTestMap(root);
    return { ...base, file: map.source && map.source !== "AGENTS.md" ? map.source : "AGENTS.md", row, flags };
  }
  if (typeof args.before !== "string" || typeof args.after !== "string") fail(EXIT.USAGE, "missing-value", "note --type agents-fix needs --before and --after, or --test-map-row.", "Add --before <exact text> --after <new text>, or --test-map-row <json>.");
  const file = fixFile(args.file);
  if (!file) fail(EXIT.INVALID, "bad-file", "--file names AGENTS.md or a Markdown file under .agents-docs/.", "Leave --file out for AGENTS.md, or name the .agents-docs/ file.");
  refuseSecret(secretIn(args.before), "fix");
  const { refused, flags } = checkAll(args.after);
  refuseSecret(refused, "fix");
  const text = readText(path.join(root, file));
  if (text === null || occurrences(text, args.before) !== 1) {
    fail(EXIT.INVALID, "no-match", `The before text must occur exactly once in ${file}; it occurs ${text === null ? "nowhere (no such file)" : occurrences(text, args.before) === 0 ? "nowhere" : "more than once"}.`, "Copy the before text exactly from the file, with enough of it to be unique.");
  }
  return { ...base, file, before: args.before, after: args.after, flags };
}

async function cmdAreas(L, root, args) {
  if (!args.suggest) fail(EXIT.USAGE, "missing-value", "areas needs --suggest.", "Run: lessons.mjs areas --suggest.");
  const s = stateOf(L, root);
  const existing = loadAreas(root);
  const map = readTestMap(root);
  const areas = [];
  for (const row of map.rows || []) {
    const slug = slugOf(row.area);
    if (row.shared || !slug || slug === GENERAL || existing.has(slug) || !row.paths.length) continue;
    if (areas.some((a) => slugOf(a.name) === slug)) continue;
    areas.push({ name: row.area, paths: row.paths });
  }
  out({ ok: true, state: s.state, active: s.active, areas });
}

/* ---------------------------------------------------------------- reading */

const RUN_PREFIX = "r1.";

/** The run handle: `r1.` and base64url of the JSON list of area slugs already handed over. Nothing is saved for it. */
export function encodeRun(areas) {
  return RUN_PREFIX + Buffer.from(JSON.stringify([...new Set(areas)])).toString("base64url");
}

/** The area slugs a handle holds. Exit 2 `bad-run` when it does not decode. */
export function decodeRun(handle) {
  const bad = () => fail(EXIT.USAGE, "bad-run", "The --run handle is not one read gave.", "Pass the run value from the last read exactly, or leave --run out to start over.");
  const s = String(handle || "");
  if (!s.startsWith(RUN_PREFIX) || !/^[A-Za-z0-9_-]*$/.test(s.slice(RUN_PREFIX.length))) bad();
  let list;
  try {
    list = JSON.parse(Buffer.from(s.slice(RUN_PREFIX.length), "base64url").toString("utf8"));
  } catch {
    bad();
  }
  if (!Array.isArray(list) || list.length > 1000 || list.some((x) => typeof x !== "string" || !x || x.length > 100 || /[\\/\0]/.test(x))) bad();
  return list;
}

const joinNames = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);

/**
 * The line a skill prints after a read, word for word (FR-23). `first` is a
 * read without a handle; `areas` are `[{ name, count }]` newly handed over;
 * `empty` when the record holds no lesson at all.
 */
export function readLine({ first, general, areas, empty }) {
  const named = areas.filter((a) => a.count > 0);
  const m = named.reduce((n, a) => n + a.count, 0);
  if (!first) return m ? `Read ${m} more for ${joinNames(named.map((a) => a.name))}.` : "";
  if (empty) return "No lessons yet.";
  const g = plural(general, "general lesson", "general lessons");
  if (!m) return `Read ${g}; none yet for these files.`;
  return `Read ${g} and ${m} for ${joinNames(named.map((a) => a.name))}.`;
}

/** The heads-up line for items waiting from an earlier run (FR-12). */
export function headsUpLine(count, oldestDays) {
  return `${plural(count, "lesson", "lessons")} waiting from an earlier run (oldest ${plural(oldestDays, "day", "days")}). Review now or Later.`;
}

/** A path as the run named it, repository-relative with forward slashes; null when it lies outside the root. */
function runPath(root, p) {
  let s = String(p).trim();
  if (!s) return null;
  if (path.isAbsolute(s)) {
    s = path.relative(root, s);
    if (!s || s.startsWith("..") || path.isAbsolute(s)) return null;
  }
  s = toPosix(s).replace(/^(\.\/)+/, "").replace(/\/+$/, "");
  return s && s !== "." && !s.split("/").includes("..") ? s : null;
}

/** Whether an area's globs take in a path: the glob matches it, or the path is a folder holding the glob's fixed part. */
function areaTakes(root, globs, p) {
  const folder = isDir(path.join(root, p));
  return globs.some((g) => {
    if (unsupported(g)) return false;
    if (matchGlob(g, p)) return true;
    const fixed = toPosix(g).split(/[*?{]/)[0];
    return folder && fixed.toLowerCase().startsWith(p.toLowerCase() + "/");
  });
}

const handOver = (l) => ({ id: l.id, text: l.block.heading, why: l.block.why || "", marked: !!l.marked, gone: !!l.gone });

async function cmdRead(L, root, args) {
  const handle = args.run !== undefined ? decodeRun(args.run) : null;
  // A read never writes, not even the waiting store's 30-day cleanup (NFR-3).
  const s = L.learningState(root, now(), { prune: false });
  if (s.state !== "on") {
    const answer = { ok: true, state: s.state, active: false, line: s.state === "paused" ? "Learning is paused for you." : "" };
    if (s.state === "not-set-up") answer.run = encodeRun(handle || []);
    out(answer);
    return;
  }
  const given = handle || [];
  const named = splitList(args.paths)
    .map((p) => runPath(root, p))
    .filter(Boolean);
  const paths = [...new Set([...named, ...changedFiles(root)])];
  const loaded = loadAreas(root);
  const matched = [...loaded.values()].filter((e) => e.slug !== GENERAL && !given.includes(e.slug) && paths.some((p) => areaTakes(root, e.area.paths, p)));
  const generalEntry = loaded.get(GENERAL);
  const withGeneral = !given.includes(GENERAL);
  const returned = [...(withGeneral && generalEntry ? lessonsOf(generalEntry) : []), ...matched.flatMap(lessonsOf)];
  markLessons(root, returned);
  const of = (slug) => returned.filter((l) => l.slug === slug).map(handOver);
  const areas = matched.map((e) => ({ name: e.area.name, slug: e.slug, lessons: of(e.slug) }));
  const general = withGeneral ? of(GENERAL) : null;
  const first = handle === null;
  const empty = ![...loaded.values()].some((e) => e.area.blocks.length);
  const answer = {
    ok: true,
    state: s.state,
    active: s.active,
    run: encodeRun([...given, GENERAL, ...matched.map((e) => e.slug)]),
    line: readLine({ first, general: general ? general.length : 0, areas: areas.map((a) => ({ name: a.name, count: a.lessons.length })), empty }),
    general,
    areas,
  };
  if (first) {
    if (!args["from-banner"]) {
      // Only what the approval list would show: a doubt whose lesson is gone since is left out there too.
      const shown = L.listWaiting(root, now(), { prune: false }).filter((w) => listable(w, loaded));
      if (shown.length) {
        const oldestDays = Math.max(0, Math.floor((now().getTime() - Date.parse(shown[0].noted)) / 86400000)) || 0;
        answer.headsUp = { count: shown.length, oldestDays, line: headsUpLine(shown.length, oldestDays) };
      }
    }
    answer.logLines = newLogLines(root).map(logLineOut);
  }
  out(answer);
}

/** The earliest `Noted` date among an area's blocks, or null. */
const oldestNoted = (blocks) =>
  blocks
    .map((b) => (String(b.noted).match(/\d{4}-\d{2}-\d{2}/) || [])[0])
    .filter(Boolean)
    .sort()[0] || null;

async function cmdReport(L, root) {
  const s = stateOf(L, root);
  const loaded = loadAreas(root);
  const all = markLessons(root, [...loaded.values()].flatMap(lessonsOf));
  const areas = [...loaded.values()].filter((e) => e.slug !== GENERAL).map((e) => ({ name: e.area.name, slug: e.slug, paths: e.area.paths, count: e.area.blocks.length, oldest: oldestNoted(e.area.blocks) }));
  const generalEntry = loaded.get(GENERAL);
  out({
    ok: true,
    state: s.state,
    active: s.active,
    areas,
    general: { count: generalEntry ? generalEntry.area.blocks.length : 0, limit: GENERAL_MAX },
    marked: all.filter((l) => l.marked).map((l) => l.id),
    gone: all.filter((l) => l.gone).map((l) => l.id),
  });
}

const CHOICES = {
  lesson: ["Keep", "Reword", "Drop"],
  area: ["Create", "Rename", "Drop"],
  doubt: ["Keep", "Reword", "Retire"],
  gone: ["Keep", "Reword", "Retire"],
  "agents-fix": ["Apply", "Reword", "Drop"],
  "log-line": ["Move", "Reword and move", "Leave in the log"],
};
const ROUND_ORDER = ["area", "lesson", "doubt", "gone", "agents-fix", "log-line"];
const LOG_ORIGIN = "From the failure log in AGENTS.md.";

// The first-ask card's words (FR-30), from "What a person is told".
export const FIRST_ASK = {
  sentences: [
    "Plan2Code can keep lessons like this with the repository (in `.plan2code/lessons/`), so your next run, and your teammates', starts out knowing them.",
    "Nothing is saved without your approval.",
    "Lessons are about the code, never about you.",
  ],
  yes: "Switch Learning on",
  no: "Not for this project",
  later: "You can change this later on the dashboard.",
};
const DOUBT_HEADING = "This lesson may no longer be true:";
const GONE_HEADING = "Its files no longer exist.";
const GONE_PREFIX = "gone:";

/**
 * Whether the approval list shows a waiting item: a lesson or an area, or a
 * doubt whose lesson is still in the record (one retired since ages out), or
 * an AGENTS.md fix.
 */
function listable(w, loaded) {
  if (w.type === "lesson" || w.type === "area" || w.type === "agents-fix") return true;
  if (w.type === "doubt") return !!findLesson(loaded, w.target);
  return false;
}

/**
 * Saved lessons whose About files no longer exist, as list items with the id
 * `gone:<lesson id>`, leaving out any a waiting doubt already names.
 */
function goneItems(root, loaded, waiting) {
  const doubted = new Set(waiting.filter((w) => w.type === "doubt").map((w) => w.target));
  const items = [];
  for (const entry of loaded.values()) {
    for (const l of lessonsOf(entry)) {
      const about = aboutOf(l.block);
      if (!about.length || about.some((p) => fs.existsSync(path.join(root, p))) || doubted.has(l.id)) continue;
      items.push({ id: GONE_PREFIX + l.id, type: "gone", target: l.id });
    }
  }
  return items;
}

/** Waiting areas proposed and not yet decided, as `{ name, paths }`. */
const proposedAreas = (items) => items.filter((i) => i.type === "area").map((i) => ({ name: i.name, paths: i.paths || [] }));

/** The area a waiting lesson lands in: the one named at noting when it exists or is proposed, else the best match. */
function areaFor(root, item, areaList, proposed) {
  if (item.area) {
    const slug = slugOf(item.area);
    if (slug === GENERAL) return { slug: GENERAL, name: "General", proposed: false };
    const hit = areaList.find((a) => a.slug === slug) || proposed.map((p) => ({ slug: slugOf(p.name), name: p.name, proposed: true })).find((a) => a.slug === slug);
    if (hit) return { slug: hit.slug, name: hit.name, proposed: !!hit.proposed };
  }
  return matchArea(root, item.about, proposed, areaList);
}

const areaListOf = (loaded) => [...loaded.values()].filter((a) => a.slug !== GENERAL).map((a) => ({ slug: a.slug, name: a.area.name, paths: a.area.paths }));

/**
 * An AGENTS.md fix as the list shows it: the file, the before and the after.
 * A test map row's before is the row it replaces ("" for a new one), read now.
 */
function fixItem(root, w, note) {
  let file = w.file;
  let before = w.before;
  let after = w.after;
  if (w.row) {
    const map = readTestMap(root);
    file = map.source && map.source !== "AGENTS.md" ? map.source : "AGENTS.md";
    const old = (map.rows || []).find((r) => sameArea(r.area, w.row.area));
    before = old ? rowLine(old) : "";
    after = rowLine(w.row);
    // decide holds the fix back while the table cannot be read whole; say so here too.
    if (map.problems && map.problems.length) note = `${note ? `${note} ` : ""}The test map has problems to fix by hand first: ${map.problems.join("; ")}.`;
  }
  const { refused } = checkAll(after);
  const shown = refused ? masked(after) : after;
  return {
    id: w.id,
    type: "agents-fix",
    file,
    before,
    after: shown,
    // A test map row fix says so: its Reword takes `row`, or `after` as one table line.
    ...(w.row && !refused ? { row: w.row } : {}),
    text: shown,
    why: "",
    origin: before ? `A fix to ${file}, replacing: ${before}` : `A fix to ${file}, a new test map row.`,
    note,
    flags: w.flags || [],
    refused,
    area: "",
    choices: refused ? CHOICES["agents-fix"].filter((c) => c !== "Apply") : CHOICES["agents-fix"],
  };
}

/** A failure log line as the list shows it, with the lessons it would become. */
function logItem(l) {
  const { refused, flags } = checkAll(l.text);
  return {
    id: logId(l.text),
    type: "log-line",
    text: refused ? masked(l.text) : l.text,
    why: "",
    lessons: refused ? [] : l.incidents,
    origin: LOG_ORIGIN,
    note: "",
    flags,
    refused,
    area: "",
    choices: refused ? CHOICES["log-line"].filter((c) => c !== "Move") : CHOICES["log-line"],
  };
}

async function cmdList(L, root, args) {
  out(buildList(L, root, args));
}

/** The approval list (see list in the usage). */
function buildList(L, root, args) {
  const s = stateOf(L, root);
  const waiting = L.listWaiting(root, now());
  const loaded = loadAreas(root);
  const areaList = areaListOf(loaded);
  const proposed = proposedAreas(waiting);
  const branch = safeBranch(root);
  const items = [];
  for (const w of waiting) {
    if (!listable(w, loaded)) continue;
    if (w.type === "area") {
      items.push({ id: w.id, type: "area", name: w.name, paths: w.paths || [], note: branchNote(root, w, branch, null), choices: CHOICES.area });
      continue;
    }
    if (w.type === "agents-fix") {
      items.push(fixItem(root, w, branchNote(root, w, branch, null)));
      continue;
    }
    if (w.type === "doubt") {
      const saved = findLesson(loaded, w.target);
      const { refused } = checkAll(w.found);
      items.push(savedItem({ id: w.id, type: "doubt", target: w.target }, saved, { found: refused ? masked(w.found) : w.found, note: branchNote(root, w, branch, null) }));
      continue;
    }
    const about = Array.isArray(w.about) ? w.about : [];
    const { refused, flags } = checkAll(w.text, w.why);
    const seen = Array.isArray(w.seen) && w.seen.length ? w.seen : about;
    items.push({
      id: w.id,
      type: "lesson",
      text: refused ? masked(w.text) : w.text,
      why: refused ? masked(w.why) : w.why || "",
      kind: w.kind,
      about,
      area: areaFor(root, w, areaList, proposed).name,
      origin: w.source === "inferred" ? `Seen in the code, in ${seen.join(", ")}.` : "You said this.",
      note: branchNote(root, w, branch, about),
      flags,
      refused,
      choices: refused ? CHOICES.lesson.filter((c) => c !== "Keep") : CHOICES.lesson,
    });
  }
  for (const g of goneItems(root, loaded, waiting)) items.push(savedItem(g, findLesson(loaded, g.target), { note: "" }));
  // Failure log lines only while Learning is on (FR-33): new ones, or every unmarked one with --log-all.
  if (s.state === "on") {
    const lines = args["log-all"] ? failureLogLines(root).filter((l) => !l.marked) : newLogLines(root);
    for (const l of lines) items.push(logItem(l));
  }
  const opening = s.state !== "unknown" && onDefaultBranch(root) ? `You are on ${branch}: kept lessons will be uncommitted changes here.` : null;
  // The areas a lesson may be saved in, for the card's Reword: General, every
  // area file, and the areas waiting in this same list.
  const areaNames = [...new Set(["General", ...areaList.map((a) => a.name), ...proposed.map((p) => p.name)].filter(Boolean))];
  // What the card draws beyond the shared fields: the before and after of a fix,
  // the lessons a log line would become, what a doubt found, and where a lesson may go.
  const extra = (i) => {
    if (i.type === "agents-fix") return { file: i.file, before: i.before, after: i.after, ...(i.row ? { row: i.row } : {}) };
    if (i.type === "log-line") return { lessons: (i.lessons || []).map((inc) => inc.text).filter(Boolean) };
    if (i.type === "doubt" || i.type === "gone") return { heading: i.heading, ...(i.found ? { found: i.found } : {}), areas: areaNames };
    if (i.type === "lesson") return { kind: i.kind, about: i.about, areas: areaNames };
    return {};
  };
  const rows = items.map((i) =>
    i.type === "area"
      ? { id: i.id, type: i.type, text: i.name, why: `Paths: ${i.paths.join(", ")}`, name: i.name, paths: i.paths, origin: "", note: i.note, flags: [], refused: null, area: i.name, choices: i.choices }
      : { id: i.id, type: i.type, text: i.text, why: i.why, origin: i.origin, note: i.note, flags: i.flags, refused: i.refused, area: i.area, ...extra(i), choices: i.choices }
  );
  const card = items.length
    ? {
        id: "lessons",
        kind: "lessons",
        title: "Lessons to keep",
        body: "Choose for each one. Nothing is kept unless you choose it, and anything you leave keeps waiting.",
        opening,
        rows,
      }
    : null;
  const rounds = ROUND_ORDER.map((type) => ({ type, choices: CHOICES[type], items: items.filter((i) => i.type === type) })).filter((r) => r.items.length);
  const answer = { ok: true, state: s.state, active: s.active, items, opening, card, rounds };
  // The first ask (FR-30): only while not set up, led by the newest waiting lesson.
  if (args["first-ask"] && s.state === "not-set-up") {
    const newest = items.filter((i) => i.type === "lesson" && !i.refused).pop();
    if (newest) answer.firstAsk = { lesson: { id: newest.id, text: newest.text, why: newest.why, kind: newest.kind }, ...FIRST_ASK };
  }
  return answer;
}

/**
 * A list item about a saved lesson (a doubt, or one whose files are gone):
 * the heading the person reads first, the lesson as saved, and for a doubt
 * the one sentence the skill found.
 */
function savedItem(base, saved, { found, note }) {
  const doubt = base.type === "doubt";
  const heading = doubt ? DOUBT_HEADING : GONE_HEADING;
  return {
    ...base,
    heading,
    text: saved.block.heading,
    why: saved.block.why || "",
    ...(doubt ? { found } : {}),
    kind: saved.block.kind,
    about: saved.block.about,
    area: saved.entry.area.name || (saved.entry.slug === GENERAL ? "General" : saved.entry.slug),
    origin: doubt ? `${heading} ${found}` : heading,
    note,
    flags: [],
    refused: null,
    choices: CHOICES[base.type],
  };
}

/** "Noted on <branch>." when it came from another branch, plus whether its files are here. */
function branchNote(root, item, branch, about) {
  if (!item.branch || item.branch === branch) return "";
  let note = `Noted on ${item.branch}.`;
  if (about && about.length && !about.some((p) => fs.existsSync(path.join(root, String(p).replace(/\/+$/, ""))))) note += " Its files are not on this branch.";
  return note;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * The closing line, from counts in a fixed order with zero counts left out:
 * "Kept 2 (1 reworded), retired 1, applied 1 fix, moved 1 from the failure
 * log, created 1 area, dropped 1. 1 still waiting."
 */
export function closingLine(c, stillWaiting) {
  const parts = [];
  if (c.kept) parts.push(`kept ${c.kept}${c.reworded ? ` (${c.reworded} reworded)` : ""}`);
  if (c.retired) parts.push(`retired ${c.retired}`);
  if (c.applied) parts.push(`applied ${plural(c.applied, "fix", "fixes")}`);
  if (c.moved) parts.push(`moved ${c.moved} from the failure log`);
  if (c.created) parts.push(`created ${plural(c.created, "area", "areas")}`);
  if (c.dropped) parts.push(`dropped ${c.dropped}`);
  if (!parts.length) return `Nothing decided. ${stillWaiting} still waiting.`;
  const first = parts.join(", ");
  return `${first[0].toUpperCase()}${first.slice(1)}. ${stillWaiting} still waiting.`;
}

/**
 * Apply Keep, Reword or Retire to a saved lesson a doubt or a gone item names,
 * in `loaded` (written by the caller). Keep moves the checked date on the
 * Noted line and changes nothing else; Reword replaces the block, re-sorted,
 * in the same area unless `area` names another; Retire removes it and marks an
 * emptied area file (never general.md) for deletion. `{ outcome, ... }`.
 */
function decideSaved(root, loaded, droppedAreas, item, d, today) {
  const saved = findLesson(loaded, item.target);
  if (!saved) return { outcome: "missing" };
  const { entry, block } = saved;
  if (d.choice === "Keep") {
    block.checked = today;
    const at = block.lines ? block.lines.findIndex((l) => /^- Noted:/.test(l)) : -1;
    if (at === -1 || !block.noted) block.lines = null;
    else block.lines = block.lines.map((l, n) => (n === at ? `- Noted: ${block.noted}, checked ${today}` : l));
    entry.dirty = true;
    return { outcome: "kept", lesson: item.target, file: rel(root, entry.file) };
  }
  if (d.choice === "Retire") {
    removeBlock(entry.area, item.target);
    entry.dirty = true;
    if (!entry.area.blocks.length && entry.slug !== GENERAL) entry.remove = true;
    return { outcome: "retired", lesson: item.target, file: rel(root, entry.file) };
  }
  // Reword: the final wording is checked as a new lesson's is.
  const final = {
    text: typeof d.text === "string" ? d.text : block.heading,
    why: typeof d.why === "string" ? d.why : block.why || "",
    kind: typeof d.kind === "string" ? d.kind : block.kind,
    about: d.about ? (Array.isArray(d.about) ? d.about : splitList(d.about)) : block.about,
  };
  const fieldSecret = secretIn(final.about.filter((p) => typeof p === "string"), typeof d.area === "string" ? d.area : "");
  if (fieldSecret) return { outcome: "refused", pattern: fieldSecret.pattern, part: fieldSecret.part };
  const problems = validateLesson(final, root);
  if (problems.length) return { outcome: "invalid", problems };
  const { refused } = checkAll(final.text, final.why);
  if (refused) return { outcome: "refused", pattern: refused.pattern, part: refused.part };
  let target = entry;
  if (typeof d.area === "string" && d.area.trim()) {
    const slug = slugOf(d.area);
    if (slug === GENERAL) {
      target = loaded.get(GENERAL);
      if (!target) {
        target = { slug: GENERAL, file: areaFilePath(root, GENERAL), area: newArea("General", []), existed: false, dirty: false };
        loaded.set(GENERAL, target);
      }
    } else if (loaded.has(slug) && !droppedAreas.has(slug)) target = loaded.get(slug);
    else return { outcome: "invalid", problems: [{ field: "area", message: "No area by that name; name an existing area or General." }] };
  }
  const next = { heading: final.text.trim(), kind: final.kind, about: final.about, why: final.why.trim(), noted: block.noted, checked: today };
  if (target === entry) {
    const r = replaceBlock(entry.area, item.target, next);
    if (r.duplicate) return { outcome: "duplicate", area: entry.area.name };
  } else {
    const r = insertBlock(target.area, next, { general: target.slug === GENERAL });
    if (r.full) return { outcome: "needsRoom", area: "General" };
    if (r.duplicate) return { outcome: "duplicate", area: target.area.name };
    removeBlock(entry.area, item.target);
    entry.dirty = true;
  }
  target.dirty = true;
  return { outcome: "reworded", area: target.area.name, lesson: lessonId(target.slug, next.heading), file: rel(root, target.file) };
}

function readDecisions(file) {
  const text = readText(file);
  if (text === null) fail(EXIT.NOT_FOUND, "no-file", `The decisions file ${file} was not found.`, "Write the person's choices to a JSON file and pass it with --file.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    // Not the parser's message: newer Node quotes the text around the error,
    // which may be a reworded lesson that has not been checked yet.
    fail(EXIT.INVALID, "invalid-file", "The decisions file is not JSON.", "Write a JSON array of { id, choice, text?, why?, area? }.");
  }
  if (data && !Array.isArray(data) && Array.isArray(data.decisions)) data = data.decisions;
  if (!Array.isArray(data) || data.some((d) => !d || typeof d !== "object" || typeof d.id !== "string" || typeof d.choice !== "string")) {
    fail(EXIT.INVALID, "invalid-file", "The decisions file must be a JSON array of { id, choice, ... }.", "Write a JSON array of { id, choice, text?, why?, area? }.");
  }
  return data;
}

/**
 * Place the lessons a failure log line becomes, all or none: each piece
 * `{ text, why, about, area?, kind? }` (kind correction unless given) is
 * checked as a new lesson is, then inserted into its area. On any problem
 * nothing is placed and `{ outcome, ... }` says why; else `{ outcome: "moved", lessons }`.
 */
function placeLessons(root, loaded, droppedAreas, pieces, noted) {
  if (!pieces.length) return { outcome: "invalid", problems: [{ field: "lessons", message: "Reword and move needs lessons: [{ text, why, about }]." }] };
  const finals = [];
  for (const p of pieces) {
    const final = {
      text: typeof p.text === "string" ? p.text : "",
      why: typeof p.why === "string" ? p.why : "",
      kind: typeof p.kind === "string" ? p.kind : "correction",
      about: Array.isArray(p.about) ? p.about : splitList(p.about),
    };
    const named = typeof p.area === "string" ? p.area : "";
    const fieldSecret = secretIn(final.about.filter((x) => typeof x === "string"), named);
    if (fieldSecret) return { outcome: "refused", pattern: fieldSecret.pattern, part: fieldSecret.part };
    const problems = validateLesson(final, root);
    if (problems.length) return { outcome: "invalid", problems };
    const { refused } = checkAll(final.text, final.why);
    if (refused) return { outcome: "refused", pattern: refused.pattern, part: refused.part };
    finals.push({ final, named });
  }
  const saved = new Map();
  const created = [];
  const restore = () => {
    for (const [entry, was] of saved) {
      entry.area.blocks = was.blocks;
      entry.dirty = was.dirty;
    }
    for (const slug of created) loaded.delete(slug);
  };
  const placed = [];
  for (const { final, named } of finals) {
    let slug;
    if (named && slugOf(named) === GENERAL) slug = GENERAL;
    else if (named && loaded.has(slugOf(named)) && !droppedAreas.has(slugOf(named))) slug = slugOf(named);
    else slug = matchArea(root, final.about, [], areaListOf(loaded)).slug;
    let entry = loaded.get(slug);
    if (!entry) {
      entry = { slug, file: areaFilePath(root, slug), area: newArea(slug === GENERAL ? "General" : slug, []), existed: false, dirty: false };
      loaded.set(slug, entry);
      created.push(slug);
    }
    if (!saved.has(entry)) saved.set(entry, { blocks: [...entry.area.blocks], dirty: entry.dirty });
    const block = { heading: final.text.trim(), kind: final.kind, about: final.about, why: final.why.trim(), noted, checked: null };
    const r = insertBlock(entry.area, block, { general: slug === GENERAL });
    if (r.full || r.duplicate) {
      restore();
      return { outcome: r.full ? "needsRoom" : "duplicate", area: r.full ? "General" : entry.area.name };
    }
    entry.dirty = true;
    placed.push({ area: entry.area.name, lesson: lessonId(slug, block.heading), file: rel(root, entry.file) });
  }
  return { outcome: "moved", lessons: placed };
}

/**
 * `decide --first-ask yes|no` (FR-30, FR-31, FR-47). Yes switches Learning on
 * and answers with the normal list plus offerLogMove. No switches it off and
 * sends each waiting correction this run noted (--skill, today) to the
 * failure log as one line, deleting it from the waiting store.
 */
function decideFirstAsk(L, root, args) {
  const answer = args._[1];
  if (answer !== "yes" && answer !== "no") fail(EXIT.USAGE, "missing-value", "decide --first-ask needs yes or no.", "Run: lessons.mjs decide --first-ask yes, or --first-ask no --skill <name>.");
  if (answer === "no" && (typeof args.skill !== "string" || !args.skill.trim())) fail(EXIT.USAGE, "missing-value", "decide --first-ask no needs --skill, the skill that asked.", "Add --skill <name>, for example --skill Implement.");
  const dryRun = !!args["dry-run"];
  const before = stateOf(L, root);
  if (before.state !== "not-set-up") {
    fail(EXIT.REFUSED, "not-first-ask", "The first ask is only for a project where Learning is not set up yet.", "Use lessons.mjs switch on or off to change it from here.", { state: before.state, active: before.active });
  }
  if (answer === "yes") {
    const { written, ...rest } = applySwitch(L, root, "on", dryRun);
    out({ ...buildList(L, root, {}), written, dryRun, ...rest });
    return;
  }
  const { written, ...rest } = applySwitch(L, root, "off", dryRun);
  const today = isoDate(now());
  const skill = args.skill.trim();
  const mine = L.listWaiting(root, now()).filter((w) => w.type === "lesson" && w.kind === "correction" && w.skill === skill && Number.isFinite(Date.parse(w.noted)) && isoDate(new Date(w.noted)) === today);
  const file = path.join(root, "AGENTS.md");
  const original = readText(file);
  let text = original;
  const logged = [];
  const results = [];
  for (const w of mine) {
    if (checkAll(w.text, w.why).refused) {
      results.push({ id: w.id, outcome: "refused" });
      continue;
    }
    const next = text === null ? null : withLogLine(text, `${sentence(w.text)}${w.why ? ` ${sentence(w.why)}` : ""}`);
    if (next === null) {
      results.push({ id: w.id, outcome: "skipped", reason: text === null ? "no-agents" : "no-failure-log" });
      continue;
    }
    text = next;
    logged.push(w.id);
    results.push({ id: w.id, outcome: "logged" });
  }
  if (!dryRun && text !== original && writeIfChanged(file, text)) written.push("AGENTS.md");
  if (!dryRun) for (const id of logged) L.removeWaiting(root, id);
  const s = stateOf(L, root);
  const stillWaiting = L.listWaiting(root, now(), { prune: false }).length;
  out({ ok: true, state: s.state, active: s.active, written, results, logged: logged.length, stillWaiting, dryRun, ...rest });
}

async function cmdDecide(L, root, args) {
  if (args["first-ask"]) return decideFirstAsk(L, root, args);
  if (typeof args.file !== "string") fail(EXIT.USAGE, "missing-value", "decide needs --file.", "Run: lessons.mjs decide --file <decisions.json>.");
  const decisions = readDecisions(path.resolve(args.file));
  const dryRun = !!args["dry-run"];
  const s = stateOf(L, root);
  const waiting = L.listWaiting(root, now());
  const loaded = loadAreas(root);
  // Failure log lines are decided only while Learning is on (FR-33); any unmarked one, so a --log-all list works too.
  const logOn = s.state === "on";
  const logItems = logOn ? failureLogLines(root).filter((l) => !l.marked).map((l) => ({ id: logId(l.text), type: "log-line", text: l.text, incidents: l.incidents })) : [];
  const byId = new Map([...waiting, ...goneItems(root, loaded, waiting), ...logItems].map((w) => [w.id, w]));
  // Files outside .plan2code/lessons/ (AGENTS.md, .agents-docs/), edited in memory and written with the rest.
  const docs = new Map();
  const docText = (file) => {
    if (!docs.has(file)) {
      const text = readText(file);
      docs.set(file, { original: text, text });
    }
    return docs.get(file).text;
  };
  const setDoc = (file, text) => {
    docText(file);
    docs.get(file).text = text;
  };
  const agentsFile = path.join(root, "AGENTS.md");
  let map = null;
  let tableRows = null;
  const removed = new Set();
  const settledGone = new Set();
  const droppedAreas = new Set();
  const results = [];
  const counts = { kept: 0, reworded: 0, retired: 0, applied: 0, moved: 0, created: 0, dropped: 0 };
  const today = isoDate(now());

  // Waiting items go only after every file is written (below), so a failure
  // part way through never loses a lesson the person kept.
  const drop = (id) => removed.add(id);
  const refusedResult = (id, refused) => results.push({ id, outcome: "refused", pattern: refused.pattern, part: refused.part });

  // Areas first, so a lesson can land in an area created in the same call.
  const ordered = [...decisions].sort((a, b) => (byId.get(a.id)?.type === "area" ? 0 : 1) - (byId.get(b.id)?.type === "area" ? 0 : 1));
  for (const d of ordered) {
    const item = byId.get(d.id);
    if (!item && logOn && d.id.startsWith(LOG_PREFIX) && !removed.has(d.id)) {
      // Found by its text: a line edited or moved away since the list was read is out of date.
      results.push({ id: d.id, outcome: "outOfDate" });
      continue;
    }
    if (!item || removed.has(d.id) || settledGone.has(d.id)) {
      results.push({ id: d.id, outcome: "unknown" });
      continue;
    }
    const choices = CHOICES[item.type];
    if (!choices || !choices.includes(d.choice)) {
      results.push({ id: d.id, outcome: "invalid-choice", message: `That choice does not fit this item${choices ? `; use ${choices.join(", ")}` : ""}.` });
      continue;
    }
    if (item.type === "doubt" || item.type === "gone") {
      const settle = () => (item.type === "doubt" ? drop(d.id) : settledGone.add(d.id));
      const r = decideSaved(root, loaded, droppedAreas, item, d, today);
      if (r.outcome === "kept" || r.outcome === "reworded" || r.outcome === "retired" || r.outcome === "missing") settle();
      if (r.outcome === "kept" || r.outcome === "reworded") counts.kept++;
      if (r.outcome === "reworded") counts.reworded++;
      if (r.outcome === "retired") counts.retired++;
      results.push({ id: d.id, ...r });
      continue;
    }
    if (item.type === "log-line") {
      removed.add(d.id); // decided once per call; never a waiting file
      const text = docText(agentsFile);
      if (text === null || !bulletsOf(segmentsOf(text)).some((b) => b.text === item.text)) {
        results.push({ id: d.id, outcome: "outOfDate" });
        continue;
      }
      if (d.choice === "Leave in the log") {
        setDoc(agentsFile, withMark(text, item.text));
        results.push({ id: d.id, outcome: "left", file: "AGENTS.md" });
        continue;
      }
      const pieces =
        d.choice === "Move"
          ? item.incidents.map((inc) => ({ text: inc.text, why: d.why, about: d.about, area: d.area, kind: "correction" }))
          : Array.isArray(d.lessons)
            ? d.lessons.filter((p) => p && typeof p === "object")
            : [];
      const r = placeLessons(root, loaded, droppedAreas, pieces, `${today}, Failure log`);
      if (r.outcome !== "moved") {
        removed.delete(d.id);
        results.push({ id: d.id, ...r });
        continue;
      }
      setDoc(agentsFile, withoutBullet(text, item.text));
      counts.moved++;
      results.push({ id: d.id, ...r });
      continue;
    }
    if (item.type === "agents-fix" && d.choice !== "Drop") {
      const reword = d.choice === "Reword";
      if (item.row) {
        // A Reword brings `row`, or `after` as the card sends it: the row's table line, edited.
        let given = item.row;
        if (reword) {
          given = d.row && typeof d.row === "object" && !Array.isArray(d.row) ? d.row : rowFromLine(d.after);
          if (!given) {
            results.push({ id: d.id, outcome: "invalid", problems: [{ field: "row", message: "Reword of a test map row needs row ({ area, paths, run, shared }), or after as one table line: | Area | Paths | Run | yes or no |." }] });
            continue;
          }
        }
        // Checked at the decision whichever way it came (FR-20): the noted row too, not only a reworded one.
        const fieldSecret = given && typeof given === "object" ? secretIn(given.area, given.run, Array.isArray(given.paths) ? given.paths : []) : null;
        if (fieldSecret) {
          refusedResult(d.id, fieldSecret);
          continue;
        }
        let row;
        try {
          [row] = validRows([given]);
        } catch (err) {
          if (!(err instanceof CliError)) throw err;
          results.push({ id: d.id, outcome: "invalid", problems: [{ field: "row", message: err.message }] });
          continue;
        }
        const rowCheck = checkAll(row.area, row.run, row.paths.join(", "));
        if (rowCheck.refused) {
          refusedResult(d.id, rowCheck.refused);
          continue;
        }
        map ||= readTestMap(root);
        if (!map.agentsMd || map.linkOutside) {
          results.push({ id: d.id, outcome: "outOfDate", reason: !map.agentsMd ? "no-agents" : "link-outside" });
          continue;
        }
        // The table is written back from the rows read: with any row, column or glob
        // the read could not take, writing would lose it, so the fix keeps waiting.
        if (map.problems.length) {
          results.push({ id: d.id, outcome: "outOfDate", reason: "test-map-problems", problems: map.problems });
          continue;
        }
        tableRows ||= [...map.rows];
        const at = tableRows.findIndex((r) => sameArea(r.area, row.area));
        if (at === -1) tableRows.push(row);
        else tableRows[at] = row;
        const file = tableFile(root, map);
        setDoc(file, spliceTable(root, map, docText(file), renderTable(tableRows)));
        drop(d.id);
        counts.applied++;
        results.push({ id: d.id, outcome: "applied", file: rel(root, file) });
        continue;
      }
      const after = reword ? d.after : item.after;
      if (typeof after !== "string") {
        results.push({ id: d.id, outcome: "invalid", problems: [{ field: "after", message: "Reword needs after, the new text." }] });
        continue;
      }
      const { refused } = checkAll(after);
      if (refused) {
        refusedResult(d.id, refused);
        continue;
      }
      const file = path.join(root, item.file);
      const current = fixFile(item.file) ? docText(file) : null;
      // FR-52: applied only while the before text still occurs exactly once.
      if (current === null || occurrences(current, item.before) !== 1) {
        results.push({ id: d.id, outcome: "outOfDate", file: item.file });
        continue;
      }
      const at = current.indexOf(item.before);
      setDoc(file, current.slice(0, at) + after + current.slice(at + item.before.length));
      drop(d.id);
      counts.applied++;
      results.push({ id: d.id, outcome: "applied", file: item.file });
      continue;
    }
    if (d.choice === "Drop") {
      if (item.type === "area") droppedAreas.add(slugOf(item.name));
      drop(d.id);
      counts.dropped++;
      results.push({ id: d.id, outcome: "dropped" });
      continue;
    }
    if (item.type === "area") {
      const name = String(d.choice === "Rename" ? d.name ?? "" : item.name).trim();
      const nameSecret = secretIn(name, d.paths ?? [], item.paths || []);
      if (nameSecret) {
        refusedResult(d.id, nameSecret);
        continue;
      }
      let slug;
      try {
        slug = areaSlug(name);
      } catch (err) {
        if (!(err instanceof CliError)) throw err;
        results.push({ id: d.id, outcome: "invalid", problems: [{ field: "name", message: err.message }] });
        continue;
      }
      const paths = (Array.isArray(d.paths) ? d.paths : d.paths ? splitGlobs(d.paths) : item.paths || []).map(toPosix);
      const problems = globProblems(paths);
      if (problems.length) {
        results.push({ id: d.id, outcome: "invalid", problems });
        continue;
      }
      if (loaded.has(slug)) {
        drop(d.id);
        results.push({ id: d.id, outcome: "exists", area: loaded.get(slug).area.name });
        continue;
      }
      loaded.set(slug, { slug, file: areaFilePath(root, slug), area: newArea(name, paths), existed: false, dirty: true });
      drop(d.id);
      counts.created++;
      results.push({ id: d.id, outcome: "created", area: name, file: rel(root, areaFilePath(root, slug)) });
      continue;
    }
    // A lesson: Keep or Reword. The final wording is checked again.
    const reword = d.choice === "Reword";
    const final = {
      text: reword && typeof d.text === "string" ? d.text : item.text,
      why: reword && typeof d.why === "string" ? d.why : item.why || "",
      kind: reword && typeof d.kind === "string" ? d.kind : item.kind,
      about: reword && d.about ? (Array.isArray(d.about) ? d.about : splitList(d.about)) : Array.isArray(item.about) ? item.about : [],
    };
    const named = reword && typeof d.area === "string" && d.area.trim() ? d.area : item.area;
    const skill = String(item.skill || "Plan2Code").replace(/\s+/g, " ").trim().slice(0, 40);
    // Paths, the area and the skill first: a problem message would echo them.
    const fieldSecret = secretIn(final.about.filter((p) => typeof p === "string"), named || "", skill);
    if (fieldSecret) {
      refusedResult(d.id, fieldSecret);
      continue;
    }
    const problems = validateLesson(final, root);
    if (problems.length) {
      results.push({ id: d.id, outcome: "invalid", problems });
      continue;
    }
    const { refused } = checkAll(final.text, final.why);
    if (refused) {
      refusedResult(d.id, refused);
      continue;
    }
    const areaList = areaListOf(loaded);
    let target;
    if (named && slugOf(named) === GENERAL) target = { slug: GENERAL };
    else if (named && loaded.has(slugOf(named)) && !droppedAreas.has(slugOf(named))) target = { slug: slugOf(named) };
    else target = matchArea(root, final.about, [], areaList); // FR-52: a dropped or undecided proposed area falls back to what exists
    let entry = loaded.get(target.slug);
    if (!entry) {
      entry = { slug: target.slug, file: areaFilePath(root, target.slug), area: newArea(target.slug === GENERAL ? "General" : target.slug, []), existed: false, dirty: false };
      loaded.set(target.slug, entry);
    }
    const block = { heading: final.text.trim(), kind: final.kind, about: final.about, why: final.why.trim(), noted: `${today}, ${skill}`, checked: null };
    const r = insertBlock(entry.area, block, { general: target.slug === GENERAL });
    if (r.full) {
      results.push({ id: d.id, outcome: "needsRoom", area: "General" });
      continue;
    }
    if (r.duplicate) {
      results.push({ id: d.id, outcome: "duplicate", area: entry.area.name });
      continue;
    }
    entry.dirty = true;
    drop(d.id);
    counts.kept++;
    if (reword) counts.reworded++;
    results.push({ id: d.id, outcome: reword ? "reworded" : "kept", area: entry.area.name, lesson: lessonId(target.slug, block.heading), file: rel(root, entry.file) });
  }

  const written = [];
  for (const entry of loaded.values()) {
    if (entry.remove && !entry.area.blocks.length) {
      // Retired down to nothing: the area file goes (general.md never does).
      if (entry.existed && !dryRun) {
        fs.rmSync(entry.file, { force: true });
        written.push(rel(root, entry.file));
      }
      continue;
    }
    if (!entry.dirty) continue;
    const text = renderAreaFile(entry.area);
    if (dryRun) continue;
    if (writeIfChanged(entry.file, text)) written.push(rel(root, entry.file));
  }
  for (const [file, doc] of docs) {
    if (dryRun || doc.text === null || doc.text === doc.original) continue;
    if (writeIfChanged(file, doc.text)) written.push(rel(root, file));
  }
  if (!dryRun) for (const id of removed) if (!id.startsWith(LOG_PREFIX)) L.removeWaiting(root, id);
  const stillWaiting = waiting.filter((w) => !removed.has(w.id)).length;
  out({ ok: true, state: s.state, active: s.active, written: written.sort(), stillWaiting, results, closing: closingLine(counts, stillWaiting), dryRun });
}

const COMMANDS = {
  state: cmdState,
  switch: cmdSwitch,
  pause: cmdPause,
  read: cmdRead,
  check: cmdCheck,
  note: cmdNote,
  list: cmdList,
  decide: cmdDecide,
  "log-lines": cmdLogLines,
  areas: cmdAreas,
  report: cmdReport,
  remove: cmdRemove,
};

async function main(argv) {
  const args = parseArgs(argv, {
    values: ["root", "type", "text", "why", "kind", "about", "source", "seen", "skill", "area", "name", "paths", "file", "run", "target", "found", "before", "after", "test-map-row"],
    booleans: ["dry-run", "suggest", "first-ask", "from-banner", "all", "log-all", "confirm"],
  });
  const start = path.resolve(args.root || process.cwd());
  const cmd = args._[0];
  const handler = COMMANDS[cmd];
  if (!handler) {
    const known = Object.keys(COMMANDS).join(", ");
    const message = !cmd ? "No command given." : `Unknown command "${cmd}".`;
    fail(EXIT.USAGE, "unknown-command", message, `Commands: ${known}. Run with --help.`);
  }
  const L = await core();
  // The checkout's top level, the folder the core reads the switch from, so a
  // run started in a subfolder writes and reads the same settings.json.
  const root = L.worktreeOf(start);
  await handler(L, root, args);
}

// Run as a script; imported (by its tests, for the record functions), do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
