#!/usr/bin/env node
// pr-prep.mjs: the facts only PR Prep needs.
//
// Where the repository's pull-request template is and which headings it asks
// for, the create-a-pull-request link (through git-repo.mjs, the same code the
// git skill uses, so the two never disagree), and which spec folder belongs to
// the branch, for the save offer. It only reads: it never commits, pushes or
// writes a file.

import fs from "node:fs";
import path from "node:path";
import { EXIT, consoleModule, fail, gitRepo, out, parseArgs, run } from "./common.mjs";

const USAGE = `
pr-prep.mjs: read-only facts for PR Prep. JSON on stdout.

  node pr-prep.mjs template [--root <dir>]
      The pull-request template, looked for in this order (names compared
      case-insensitively): .github/pull_request_template.md,
      .github/PULL_REQUEST_TEMPLATE.md, PULL_REQUEST_TEMPLATE.md,
      docs/pull_request_template.md, then the first .md in
      .github/PULL_REQUEST_TEMPLATE/, docs/PULL_REQUEST_TEMPLATE/ and
      .gitlab/merge_request_templates/.
      Prints { ok, found, path, headings, hasTesting, others }.
        headings    the template's # to ### headings in order, text only,
                    outside code fences
        hasTesting  a heading is about testing (test, verify, how it was
                    checked, QA)
        others      every further template found, to mention to the person

  node pr-prep.mjs pr-url [--branch <b>] [--base <b>] [--root <dir>]
      The create-a-pull-request link for --branch (the current branch) into
      --base (the default branch). Prints { ok, pushed: true, url, host, kind,
      needsKind, branch, base, ahead }; needsKind: the host is unknown and has
      no saved answer, so url is null. A branch not on a remote yet prints
      { ok, pushed: false, branch, next } with exit 0.

  node pr-prep.mjs spec [--branch <b>] [--base <b>] [--root <dir>]
      The branch's spec folder, for the save offer. Prints { ok, branch,
      match, candidates, how }.
        how  branch: a folder in specs/ (then specs--completed/) whose name
                     is a whole dash-separated run of the branch name
             recent: no name matched; the one folder with a file changed
                     since the branch left --base (default main, else master)
             ask:    several folders fit; candidates lists them
             none:   nothing fits; match is null

Exit: 0 ok · 1 crash · 2 bad arguments · 3 not a git repository (pr-url,
spec) · 4 no such branch, no base, or the branch is the base (pr-url) ·
5 detached HEAD or git too old (pr-url).
`;

/* ------------------------------------------------------------- template */

const TEMPLATE_FILES = [
  ".github/pull_request_template.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  "PULL_REQUEST_TEMPLATE.md",
  "docs/pull_request_template.md",
];
const TEMPLATE_DIRS = [".github/PULL_REQUEST_TEMPLATE", "docs/PULL_REQUEST_TEMPLATE", ".gitlab/merge_request_templates"];
const TESTING = /test|testing|verif|how .*checked|qa/i;

function entries(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** `relPath` under root with every segment matched case-insensitively (an exact match first); the real relative path, or null. */
function findCI(root, relPath, want) {
  let at = "";
  const parts = relPath.split("/");
  for (let i = 0; i < parts.length; i++) {
    const list = entries(path.join(root, at));
    const last = i === parts.length - 1;
    const fits = (e) => (last ? (want === "dir" ? e.isDirectory() : e.isFile()) : e.isDirectory());
    const hit = list.find((e) => e.name === parts[i] && fits(e)) || list.find((e) => e.name.toLowerCase() === parts[i].toLowerCase() && fits(e));
    if (!hit) return null;
    at = at ? `${at}/${hit.name}` : hit.name;
  }
  return at;
}

function headingsOf(text) {
  const headings = [];
  let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const m = line.match(/^\s{0,3}#{1,3}\s+(.*?)\s*#*\s*$/);
    if (m && m[1]) headings.push(m[1]);
  }
  return headings;
}

function template({ root }) {
  const found = [];
  for (const f of TEMPLATE_FILES) {
    const hit = findCI(root, f, "file");
    if (hit && !found.includes(hit)) found.push(hit);
  }
  for (const d of TEMPLATE_DIRS) {
    const dir = findCI(root, d, "dir");
    if (!dir) continue;
    const mds = entries(path.join(root, dir))
      .filter((e) => e.isFile() && /\.md$/i.test(e.name))
      .map((e) => `${dir}/${e.name}`)
      .sort((a, b) => a.localeCompare(b));
    for (const m of mds) if (!found.includes(m)) found.push(m);
  }
  if (!found.length) return out({ ok: true, found: false, path: null, headings: [], hasTesting: false, others: [] });
  const headings = headingsOf(fs.readFileSync(path.join(root, found[0]), "utf8"));
  out({ ok: true, found: true, path: found[0], headings, hasTesting: headings.some((h) => TESTING.test(h)), others: found.slice(1) });
}

/* --------------------------------------------------------------- the repo */

let R;

function repoRoot(root) {
  const top = R.git(["rev-parse", "--show-toplevel"], root);
  if (!top.ok || !top.out) fail(EXIT.NOT_FOUND, "not-a-repo", `${root} is not inside a git repository.`, "Run PR Prep from inside the project's git repository.");
  return path.resolve(top.out);
}

async function prUrlCmd({ root, branch, base }) {
  const floor = R.gitFloor();
  if (!floor.ok) fail(EXIT.REFUSED, "git-too-old", floor.message, "Install or update git (2.23 or newer), then try again.");
  const repo = repoRoot(root);
  let link;
  try {
    link = R.prLink(repo, { branch, base, prHosts: (await consoleModule("settings.mjs")).readPrHosts() });
  } catch (e) {
    if (!R.PR_LINK_CODES.has(e?.code)) throw e;
    if (e.code === "not-pushed") {
      return out({ ok: true, pushed: false, branch: e.branch, next: "Say the branch is not pushed yet, and offer to hand over to the git skill (/plan2code-git), which asks before it pushes." });
    }
    fail(e.code === "detached" ? EXIT.REFUSED : EXIT.INVALID, e.code, e.message, e.next);
  }
  out({ ok: true, pushed: true, ...link });
}

/* ------------------------------------------------------------------- spec */

const SPEC_DIRS = ["specs", "specs--completed"];
const PREFIX = /^(feature|fix|bugfix|chore|hotfix)\//i;

/** The branch name as one kebab-case run, with a leading feature/, fix/ ... or <user>/ segment dropped. */
function branchKebab(branch) {
  let b = branch.replace(PREFIX, "");
  if (b === branch && b.includes("/")) b = b.slice(b.indexOf("/") + 1).replace(PREFIX, "");
  return b.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function specFolders(repo) {
  const all = [];
  for (const d of SPEC_DIRS) {
    const names = entries(path.join(repo, d)).filter((e) => e.isDirectory()).map((e) => e.name).sort((a, b) => a.localeCompare(b));
    for (const name of names) all.push({ dir: d, name, path: `${d}/${name}` });
  }
  return all;
}

function newestMtime(dir, depth = 4) {
  let newest = 0;
  for (const e of entries(dir)) {
    const p = path.join(dir, e.name);
    if (e.isFile()) {
      try {
        newest = Math.max(newest, fs.statSync(p).mtimeMs);
      } catch {}
    } else if (e.isDirectory() && depth > 1) newest = Math.max(newest, newestMtime(p, depth - 1));
  }
  return newest;
}

function pickBase(repo, wanted) {
  const candidates = wanted ? [wanted, `origin/${wanted}`] : ["main", "origin/main", "master", "origin/master"];
  return candidates.find((ref) => R.git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], repo).ok) || null;
}

/** When `branch` (HEAD when it is not a local branch) left its base, in ms; null when there is no base or no shared commit. */
function branchStart(repo, base, branch) {
  const ref = pickBase(repo, base);
  if (!ref) return null;
  const local = branch && `refs/heads/${branch}`;
  const tip = local && R.git(["rev-parse", "--verify", "--quiet", `${local}^{commit}`], repo).ok ? local : "HEAD";
  const mb = R.git(["merge-base", tip, ref], repo);
  if (!mb.ok || !mb.out) return null;
  const t = R.git(["show", "-s", "--format=%ct", mb.out], repo);
  return t.ok && /^\d+$/.test(t.out) ? Number(t.out) * 1000 : null;
}

function spec({ root, branch, base }) {
  const repo = repoRoot(root);
  let b = (branch || "").trim();
  if (!b) {
    const head = R.git(["symbolic-ref", "-q", "--short", "HEAD"], repo);
    b = head.ok ? head.out : "";
  }
  const folders = specFolders(repo);
  const verdict = (hits, how) =>
    hits.length === 1 ? { match: hits[0].path, candidates: [], how } : { match: null, candidates: hits.map((h) => h.path), how: "ask" };

  const kebab = b ? branchKebab(b) : "";
  if (kebab) {
    const named = folders.filter((f) => `-${kebab}-`.includes(`-${f.name.toLowerCase()}-`));
    const open = named.filter((f) => f.dir === "specs");
    const hits = open.length ? open : named;
    if (hits.length) return out({ ok: true, branch: b || null, ...verdict(hits, "branch") });
  }

  const since = branchStart(repo, base, b);
  const recent = since === null ? [] : folders.filter((f) => newestMtime(path.join(repo, f.path)) > since);
  if (recent.length) return out({ ok: true, branch: b || null, ...verdict(recent, "recent") });
  out({ ok: true, branch: b || null, match: null, candidates: [], how: "none" });
}

/* ------------------------------------------------------------------ main */

const COMMANDS = { template, "pr-url": prUrlCmd, spec };

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { values: ["root", "branch", "base"] });
  const [cmd, ...extra] = args._;
  const names = Object.keys(COMMANDS).join(", ");
  if (!cmd) fail(EXIT.USAGE, "missing-command", `A subcommand is required: ${names}.`, "Run with --help for usage.");
  if (!Object.hasOwn(COMMANDS, cmd)) fail(EXIT.USAGE, "unknown-command", `Unknown subcommand "${cmd}".`, `Use one of: ${names}.`);
  if (extra.length) fail(EXIT.USAGE, "stray-argument", `Unexpected argument(s): ${extra.join(" ")}.`, "Run with --help for usage.");
  args.root = path.resolve(args.root || ".");
  if (cmd !== "template") R = await gitRepo();
  return COMMANDS[cmd](args);
});
