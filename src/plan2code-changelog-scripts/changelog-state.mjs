#!/usr/bin/env node
// changelog-state.mjs: what the Changelog skill needs to know about CHANGELOG.md.
//
// The skill's questions about versions have one correct answer each: which
// version is the default branch at, does this branch already own an entry above
// it, has that entry been released or claimed by another branch, what is the
// next version, what has the branch done since the entry was last touched. They
// live here so no prompt works them out by eye or per shell. This script only
// reads, except `set-package-version`, which changes the one `version` field of
// package.json and nothing else. The agent writes CHANGELOG.md itself, behind a
// yes.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXIT, fail, isoDate, out, parseArgs, run } from "./common.mjs";

const USAGE = `
changelog-state.mjs: read-only facts about CHANGELOG.md and its versions. JSON on
stdout. It never changes CHANGELOG.md.

  node changelog-state.mjs state
  node changelog-state.mjs bump --from <x.y.z> --kind major|minor|patch
  node changelog-state.mjs set-package-version --version <x.y.z>

state         Run from inside a repository. Prints { ok, root, branch,
              defaultBranch, base, onDefault, today, changelog, base,
              branchTop, topIsNew, entryBump, released, takenBy, canExtend,
              heading, sectionHeadings, entry, package, commits, files,
              uncommitted, addedSkills }.
                base          { ref, version, date } the default branch's top
                              version (origin/<default> when it exists).
                branchTop     { version, line, unreleased } this branch's top
                              entry in the working file, else null.
                topIsNew      the branch's top version is above the base's.
                entryBump     major, minor, patch or none: how far the branch's
                              top version is above the base's.
                released      the top version is a tag or already in the base.
                takenBy       other branches whose CHANGELOG has that version.
                canExtend     topIsNew and not released and not takenBy: new
                              entries can go under that version, no new one.
                heading       { style, bracket, v, dated, separator, example }
                              the file's own heading style, to be copied.
                sectionHeadings
                              the "###" lines the file uses, in first-seen order.
                entry         the branch's own top entry (up to 200 lines); empty
                              when the top entry is the default branch's.
                package       { exists, version, lockfile, matches }.
                commits       [{ hash, subject }] since the entry was last
                              touched on this branch (else since the base).
                files         paths changed in those commits.
                uncommitted   paths changed in the working tree, CHANGELOG.md
                              left out.
                addedSkills   SKILL.md files the branch adds against the base.
bump          The next version: { ok, from, kind, version, heading } where
              heading is the new "## ..." line in the file's own style.
set-package-version
              Set package.json's "version" and nothing else (the file's
              formatting is kept). Exit 4 when it has no version field.

Exit: 0 ok · 1 crash · 2 bad arguments · 3 not a git repository or no
CHANGELOG.md · 4 invalid version · 5 package.json's first "version" is not the
top-level field.
`;

const CHANGELOG = "CHANGELOG.md";
const HEADING = /^##[ \t]+(\[)?(v)?(\d+)\.(\d+)\.(\d+)(\])?(.*)$/;
const UNRELEASED = /^##[ \t]+\[?unreleased\]?/i;
const LIST_CAP = 300;

function git(args, cwd, { raw = false } = {}) {
  try {
    const stdout = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0" },
    });
    return { ok: true, out: raw ? stdout : stdout.trim() };
  } catch {
    return { ok: false, out: "" };
  }
}

const lines = (s) => s.split(/\r?\n/).filter(Boolean);

function requireRepo() {
  const top = git(["rev-parse", "--show-toplevel"], process.cwd());
  if (!top.ok || !top.out) {
    fail(EXIT.NOT_FOUND, "not-a-repo", "This directory is not inside a git repository.", "Run the Git commit skill to start one, then come back.");
  }
  return top.out;
}

/* --------------------------------------------------------------- versions */

const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const str = (v) => v.join(".");

function parseVersion(text, what = "version") {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(text || "").trim());
  if (!m) fail(EXIT.INVALID, "bad-version", `"${text}" is not a ${what} like 1.2.3.`, "Use three numbers joined by dots.");
  return [+m[1], +m[2], +m[3]];
}

function bumpOf(from, to) {
  if (cmp(to, from) <= 0) return "none";
  if (to[0] > from[0]) return "major";
  if (to[1] > from[1]) return "minor";
  return "patch";
}

function nextVersion(from, kind) {
  if (kind === "major") return [from[0] + 1, 0, 0];
  if (kind === "minor") return [from[0], from[1] + 1, 0];
  return [from[0], from[1], from[2] + 1];
}

/* -------------------------------------------------------------- changelog */

// Every version heading in a CHANGELOG, top to bottom, with the style it uses.
function readHeadings(text) {
  const found = [];
  const all = text.split(/\r?\n/);
  all.forEach((line, i) => {
    const m = HEADING.exec(line);
    if (!m) return;
    const rest = m[7] || "";
    const dateM = /^\s*([-–—]|\()\s*(\d{4}-\d{2}-\d{2})\)?\s*$/.exec(rest);
    found.push({
      line: i,
      text: line,
      version: [+m[3], +m[4], +m[5]],
      bracket: !!m[1],
      v: !!m[2],
      dated: !!dateM,
      separator: dateM ? dateM[1] : null,
      date: dateM ? dateM[2] : null,
    });
  });
  return { all, found };
}

// The style most of the headings share; ties go to the topmost.
function dominantStyle(found) {
  if (!found.length) return { style: "v-prefixed", bracket: false, v: true, dated: false, separator: null, example: null };
  const tally = new Map();
  for (const h of found) {
    const key = `${h.bracket}|${h.v}|${h.dated}|${h.separator}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  let best = found[0];
  let bestN = 0;
  for (const h of found) {
    const n = tally.get(`${h.bracket}|${h.v}|${h.dated}|${h.separator}`);
    if (n > bestN) [best, bestN] = [h, n];
  }
  const style = best.bracket ? "bracketed" : best.v ? "v-prefixed" : "bare";
  return { style, bracket: best.bracket, v: best.v, dated: best.dated, separator: best.separator, example: best.text };
}

function headingFor(style, version, date) {
  const core = `${style.v ? "v" : ""}${str(version)}`;
  const shown = style.bracket ? `[${core}]` : core;
  let head = `## ${shown}`;
  if (style.dated) head += style.separator === "(" ? ` (${date})` : ` ${style.separator} ${date}`;
  return head;
}

function sectionHeadings(all) {
  const seen = [];
  let versions = 0;
  for (const line of all) {
    if (HEADING.test(line) || UNRELEASED.test(line)) {
      if (++versions > 3) break;
      continue;
    }
    if (/^###[ \t]/.test(line) && !seen.includes(line.trim())) seen.push(line.trim());
  }
  return seen;
}

function entryText(all, startLine) {
  const end = all.findIndex((l, i) => i > startLine && (HEADING.test(l) || UNRELEASED.test(l) || /^##[ \t]/.test(l)));
  const slice = all.slice(startLine, end === -1 ? undefined : end);
  return slice.slice(0, 200).join("\n").trimEnd();
}

function showAt(root, ref, file) {
  const res = git(["show", `${ref}:${file}`], root);
  return res.ok ? res.out : null;
}

/* ----------------------------------------------------------------- branch */

function defaultBranch(root, branch) {
  const head = git(["symbolic-ref", "-q", "--short", "refs/remotes/origin/HEAD"], root);
  if (head.ok && head.out) return head.out.replace(/^origin\//, "");
  if (git(["show-ref", "--verify", "-q", "refs/heads/main"], root).ok) return "main";
  if (git(["show-ref", "--verify", "-q", "refs/heads/master"], root).ok) return "master";
  return branch === "main" || branch === "master" ? branch : null;
}

function baseRef(root, def) {
  if (!def) return null;
  if (git(["show-ref", "--verify", "-q", `refs/remotes/origin/${def}`], root).ok) return `origin/${def}`;
  if (git(["show-ref", "--verify", "-q", `refs/heads/${def}`], root).ok) return def;
  return null;
}

// Other branches (remote and local) whose CHANGELOG already holds `version`.
function claimedBy(root, version, skip) {
  const refs = lines(git(["for-each-ref", "--format=%(refname:short)", "refs/remotes", "refs/heads"], root).out)
    .filter((r) => !r.endsWith("/HEAD") && !skip.has(r))
    .slice(0, 80);
  const hits = [];
  for (const ref of refs) {
    const text = showAt(root, ref, CHANGELOG);
    if (!text) continue;
    if (!readHeadings(text).found.some((h) => cmp(h.version, version) === 0)) continue;
    // A branch that is only part of this one's history shares its entry; it is no claim.
    if (!git(["merge-base", "--is-ancestor", ref, "HEAD"], root).ok) hits.push(ref);
  }
  return hits;
}

function readPackage(root) {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return { exists: false, version: null, lockfile: false };
  let version = null;
  try {
    version = JSON.parse(fs.readFileSync(file, "utf8")).version ?? null;
  } catch {
    // an unreadable package.json is reported as having no version
  }
  return { exists: true, version, lockfile: fs.existsSync(path.join(root, "package-lock.json")) };
}

/* --------------------------------------------------------------- commands */

function state() {
  const root = requireRepo();
  const file = path.join(root, CHANGELOG);
  if (!fs.existsSync(file)) {
    fail(EXIT.NOT_FOUND, "no-changelog", `There is no ${CHANGELOG} at ${root}.`, "Ask whether to start one, in the Keep a Changelog layout.");
  }
  const branchRef = git(["symbolic-ref", "--short", "-q", "HEAD"], root);
  const branch = branchRef.ok && branchRef.out ? branchRef.out : null;
  const def = defaultBranch(root, branch);
  const base = baseRef(root, def);

  const working = readHeadings(fs.readFileSync(file, "utf8"));
  const style = dominantStyle(working.found);
  const top = working.found[0] || null;
  const topLine = working.all.findIndex((l) => UNRELEASED.test(l));
  const unreleased = topLine !== -1 && (!top || topLine < top.line);
  const branchTop = unreleased
    ? { version: null, line: working.all[topLine], unreleased: true }
    : top
      ? { version: str(top.version), line: top.text, unreleased: false }
      : null;

  let baseInfo = null;
  let baseVersion = null;
  if (base) {
    const text = showAt(root, base, CHANGELOG);
    const h = text ? readHeadings(text).found[0] : null;
    baseInfo = { ref: base, version: h ? str(h.version) : null, date: h ? h.date : null };
    baseVersion = h ? h.version : null;
  }

  const topVersion = top ? top.version : null;
  const topIsNew = !!(topVersion && !unreleased && (!baseVersion || cmp(topVersion, baseVersion) > 0));
  const entryBump = topIsNew ? (baseVersion ? bumpOf(baseVersion, topVersion) : "major") : "none";

  let released = false;
  let takenBy = [];
  if (topIsNew) {
    const tagged = git(["tag", "-l", `v${str(topVersion)}`, str(topVersion)], root).out;
    released = !!tagged;
    const upstream = branch ? git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], root).out : "";
    const skip = new Set([base, branch, upstream, branch ? `origin/${branch}` : null].filter(Boolean));
    takenBy = claimedBy(root, topVersion, skip);
  }
  const canExtend = topIsNew && !released && takenBy.length === 0;

  // The gap: what the branch did since its top entry was last touched.
  const range = base ? `${base}..HEAD` : "HEAD";
  let sinceRef = base;
  const touched = base ? git(["log", "-1", "--format=%H", range, "--", CHANGELOG], root) : { ok: false, out: "" };
  if (touched.ok && touched.out) sinceRef = touched.out;
  const gapRange = sinceRef ? `${sinceRef}..HEAD` : "HEAD";
  const commits = lines(git(["log", "--format=%h%x09%s", gapRange], root).out)
    .slice(0, LIST_CAP)
    .map((l) => {
      const [hash, ...subject] = l.split("\t");
      return { hash, subject: subject.join("\t") };
    });
  const filesList = sinceRef ? lines(git(["diff", "--name-only", `${sinceRef}..HEAD`], root).out) : [];
  const files = filesList.filter((f) => f !== CHANGELOG).slice(0, LIST_CAP);

  const uncommitted = [];
  const porcelain = git(["status", "--porcelain=v1", "-z", "--untracked-files=normal"], root, { raw: true });
  const fields = porcelain.out.split("\0");
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (f.length < 4) continue;
    if (/[RC]/.test(f.slice(0, 2))) i++; // a rename or copy carries its old path as the next field
    const p = f.slice(3);
    if (p !== CHANGELOG) uncommitted.push(p);
  }

  const added = base
    ? lines(git(["diff", "--name-only", "--diff-filter=A", `${base}...HEAD`], root).out).filter((p) => /(^|\/)SKILL\.md$/.test(p))
    : [];

  const pkg = readPackage(root);
  // package.json tracks the newest concrete version heading, never Unreleased.
  pkg.matches = pkg.exists && !!pkg.version && !!top && !unreleased && pkg.version === str(top.version);

  out({
    ok: true,
    root,
    branch,
    defaultBranch: def,
    onDefault: !!branch && !!def && branch === def,
    today: isoDate(),
    changelog: CHANGELOG,
    base: baseInfo,
    branchTop,
    topIsNew,
    entryBump,
    released,
    takenBy,
    canExtend,
    heading: style,
    sectionHeadings: sectionHeadings(working.all),
    entry: unreleased ? entryText(working.all, topLine) : topIsNew ? entryText(working.all, top.line) : "",
    package: pkg,
    commits,
    files,
    uncommitted: uncommitted.slice(0, LIST_CAP),
    addedSkills: added,
  });
}

function bump(args) {
  if (!args.from) fail(EXIT.USAGE, "missing-from", "--from is required.", "Example: bump --from 2.5.1 --kind minor");
  if (!["major", "minor", "patch"].includes(args.kind)) {
    fail(EXIT.USAGE, "bad-kind", "--kind must be major, minor or patch.", "Example: bump --from 2.5.1 --kind minor");
  }
  const from = parseVersion(args.from);
  const next = nextVersion(from, args.kind);
  const root = git(["rev-parse", "--show-toplevel"], process.cwd()).out;
  let style = dominantStyle([]);
  if (root && fs.existsSync(path.join(root, CHANGELOG))) {
    style = dominantStyle(readHeadings(fs.readFileSync(path.join(root, CHANGELOG), "utf8")).found);
  }
  out({ ok: true, from: str(from), kind: args.kind, version: str(next), heading: headingFor(style, next, isoDate()) });
}

function setPackageVersion(args) {
  if (!args.version) fail(EXIT.USAGE, "missing-version", "--version is required.", "Example: set-package-version --version 2.6.0");
  const next = str(parseVersion(args.version));
  const root = requireRepo();
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) fail(EXIT.NOT_FOUND, "no-package", "There is no package.json here.", "Nothing to align.");
  const text = fs.readFileSync(file, "utf8");
  const re = /^(\s*"version"\s*:\s*")([^"]*)(")/m;
  const m = re.exec(text);
  if (!m) fail(EXIT.INVALID, "no-version-field", 'package.json has no "version" field.', "Leave it alone.");
  const before = m[2];
  let declared;
  try {
    declared = JSON.parse(text).version;
  } catch {
    // reported below
  }
  if (declared !== before) {
    fail(EXIT.REFUSED, "ambiguous-version", 'The first "version" in package.json is not the top-level field.', "Edit package.json by hand.");
  }
  if (before !== next) fs.writeFileSync(file, text.replace(re, `$1${next}$3`));
  out({ ok: true, file: "package.json", from: before, to: next, changed: before !== next, lockfile: fs.existsSync(path.join(root, "package-lock.json")) });
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { values: ["from", "kind", "version"] });
  const [cmd, ...extra] = args._;
  if (!cmd) fail(EXIT.USAGE, "missing-command", "A subcommand is required: state, bump or set-package-version.", "Run with --help for usage.");
  if (extra.length) fail(EXIT.USAGE, "stray-argument", `Unexpected argument(s): ${extra.join(" ")}.`, "Run with --help for usage.");
  if (cmd === "state") return state();
  if (cmd === "bump") return bump(args);
  if (cmd === "set-package-version") return setPackageVersion(args);
  fail(EXIT.USAGE, "unknown-command", `Unknown subcommand "${cmd}".`, "Use state, bump or set-package-version.");
});
