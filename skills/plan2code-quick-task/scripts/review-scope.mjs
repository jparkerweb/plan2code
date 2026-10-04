#!/usr/bin/env node
// review-scope.mjs: what a branch review would cover, from git.
//
// Review Mode's scope fallback is a fixed command sequence (status, diff, log,
// name-only against the base branch) followed by arithmetic: how many files,
// how many lines, what share are docs (the >70% rule), whether specs/ is in
// scope, whether the change is big enough to batch by risk. This script runs
// the sequence and does the arithmetic. Choosing the scope and the review type
// from the user's words stays with the agent.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXIT, fail, out, parseArgs, run } from "./common.mjs";

const USAGE = `
review-scope.mjs: the branch-review scope from git. JSON on stdout.

  node review-scope.mjs [--base <branch>] [--root <dir>]

  --base   the branch to compare against. Default: main if it exists (local or
           origin), else master. The output says which one it used. With
           neither (and no --base) it stops with no-base; only a repo with no
           commits yet goes on, counting uncommitted changes alone.

Covers commits on this branch since it left the base (base...HEAD), plus
staged, unstaged and untracked changes. Prints the files with their status and
line counts, totals, the share of .md files, the doc/code classification
(docs or code when one side is more than 70% of files, else mixed),
specsInScope, batchByRisk (50+ files) and the commits.

Exit: 0 ok (check "empty") · 2 bad arguments · 3 not a git repository, the
--base branch does not exist, or (no --base) there is no main or master.
`;

function git(root, args, { allowFail = false } = {}) {
  try {
    // core.quotePath=false: a non-ASCII path comes back as itself, not as an escaped, quoted string.
    return execFileSync("git", ["-c", "core.quotePath=false", ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
  } catch (err) {
    if (allowFail) return null;
    throw err;
  }
}

function refExists(root, ref) {
  return git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { allowFail: true }) !== null;
}

function pickBase(root, wanted) {
  const candidates = wanted ? [wanted, `origin/${wanted}`] : ["main", "origin/main", "master", "origin/master"];
  for (const ref of candidates) if (refExists(root, ref)) return ref;
  return null;
}

function parseNumstat(text, into, status) {
  for (const line of (text || "").split("\n")) {
    if (!line.trim()) continue;
    const [a, d, ...rest] = line.split("\t");
    let file = rest.join("\t");
    // Renames print as "old => new" or "dir/{old => new}/f"; keep the new path.
    // A move up a level ("d/{sub => }/f", "{sub => }/f") empties the brace, so
    // the doubled or leading slash it leaves behind is dropped.
    file = file.replace(/\{[^}]*=> ([^}]*)\}/, "$1").replace(/^.* => /, "").replace(/\/{2,}/g, "/").replace(/^\//, "");
    const entry = into.get(file) || { path: file, status: new Set(), added: 0, deleted: 0, binary: false };
    entry.status.add(status);
    if (a === "-" || d === "-") entry.binary = true;
    else {
      entry.added += Number(a);
      entry.deleted += Number(d);
    }
    into.set(file, entry);
  }
}

// Prose docs only: a requirements.txt or CMakeLists.txt is not documentation.
const DOC_RE = /\.(md|mdx|markdown|rst|adoc)$/i;

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { values: ["base", "root"] });
  const root = path.resolve(args.root || ".");
  const top = git(root, ["rev-parse", "--show-toplevel"], { allowFail: true });
  if (!top) fail(EXIT.NOT_FOUND, "not-a-repo", `${root} is not inside a git repository.`, "Ask the user which files to review (Focused scope).");
  const repo = top.trim();
  const branch = (git(repo, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true }) || "").trim() || null;
  const base = pickBase(repo, args.base);
  if (args.base && !base) fail(EXIT.NOT_FOUND, "no-base", `No branch named ${args.base} (or origin/${args.base}).`, "Pass an existing --base, or omit it to use main / master.");
  // No main or master: counting only uncommitted work would hide every commit
  // on the branch, so stop and ask for the trunk. A repo with no commits yet
  // has nothing committed to miss, so it goes on.
  if (!base && refExists(repo, "HEAD")) {
    fail(EXIT.NOT_FOUND, "no-base", "There is no main or master branch (local or origin) to compare this branch with.", "Rerun with --base <trunk> (ask the user which branch is the trunk if unclear).");
  }

  const files = new Map();
  let commits = [];
  if (base) {
    parseNumstat(git(repo, ["diff", "--numstat", "-M", `${base}...HEAD`], { allowFail: true }), files, "committed");
    commits = (git(repo, ["log", "--oneline", "--no-decorate", `${base}..HEAD`], { allowFail: true }) || "").split("\n").filter(Boolean);
  }
  parseNumstat(git(repo, ["diff", "--numstat", "-M", "--cached"], { allowFail: true }), files, "staged");
  parseNumstat(git(repo, ["diff", "--numstat", "-M"], { allowFail: true }), files, "unstaged");
  for (const f of (git(repo, ["ls-files", "--others", "--exclude-standard"], { allowFail: true }) || "").split("\n").filter(Boolean)) {
    let added = 0;
    let binary = false;
    try {
      const buf = fs.readFileSync(path.join(repo, f));
      if (buf.includes(0)) binary = true;
      else if (buf.length) added = buf.toString("utf8").split("\n").length - (buf.at(-1) === 10 ? 1 : 0);
    } catch {}
    files.set(f, { path: f, status: new Set(["untracked"]), added, deleted: 0, binary });
  }

  const list = [...files.values()]
    .map((f) => ({ ...f, status: [...f.status] }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const docs = list.filter((f) => DOC_RE.test(f.path)).length;
  const total = list.length;
  const docShare = total ? docs / total : 0;
  const lines = list.reduce((n, f) => n + f.added + f.deleted, 0);
  out({
    ok: true,
    repo,
    branch,
    base,
    ...(base ? {} : { note: "No commits yet: only uncommitted changes are counted." }),
    empty: total === 0,
    counts: { files: total, lines, added: list.reduce((n, f) => n + f.added, 0), deleted: list.reduce((n, f) => n + f.deleted, 0), docs, code: total - docs },
    docShare: Number(docShare.toFixed(2)),
    mix: !total ? "none" : docShare > 0.7 ? "docs" : 1 - docShare > 0.7 ? "code" : "mixed",
    // specs/ is gitignored, so git rarely sees it: the conversation is the
    // better signal that a spec is under review.
    specsInScope: list.some((f) => /^specs\//.test(f.path)),
    batchByRisk: total >= 50,
    commits,
    files: list,
  });
});
