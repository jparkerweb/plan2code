// Refuse a commit that stages a file named `nul`.
//
// On Windows a stray `> nul` in a Git Bash or Unix-style command (where nul is
// not the null device) writes a real file called `nul`, which Windows tools
// then cannot open, move or delete, and which breaks a checkout there. The
// repo used to hide it with a `nul` line in .gitignore; this pre-commit check
// (run from .husky/pre-commit) refuses it instead, so one never lands.
//
//   node scripts/check-staged-nul.mjs     exit 1 and name them when any staged
//                                         path is nul (or nul.<ext>)

import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/** The paths whose file name is the Windows device name nul, with or without an extension. */
export function nulPaths(paths) {
  return paths.filter((p) => /^nul(\.[^/\\]*)?$/i.test(p.split(/[/\\]/).pop()));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const staged = execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACR", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const bad = nulPaths(staged);
  if (bad.length) {
    process.stderr.write(`pre-commit: refusing to commit a file named nul (a Windows device name): ${bad.join(", ")}\nUnstage and delete it: git rm --cached -- <path>, then remove the file.\n`);
    process.exit(1);
  }
}
