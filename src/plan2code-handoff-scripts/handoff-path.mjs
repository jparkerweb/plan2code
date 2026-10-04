#!/usr/bin/env node
// handoff-path.mjs: where the handoff document goes, and whether git would pick it up.
//
// The handoff skill names its file <dir>/<YYYY-MM-DD-HHmm>-handoff.md, takes the
// timestamp from the clock rather than a guess, creates the folder, and checks
// whether the file would be tracked by git (is this a repo, is the path
// ignored). That is a fixed sequence with one right answer per machine, so it
// lives here. Whether to add an ignore line is the user's call.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXIT, fail, out, parseArgs, run, isoDate, now } from "./common.mjs";

const USAGE = `
handoff-path.mjs: pick the handoff file path and check it against git. JSON on stdout.

  node handoff-path.mjs [--dir temp|<path>] [--root <dir>] [--dry-run]

  --dir      temp (the default): the OS temporary directory. Anything else is a
             folder, relative to --root (default: the current directory), e.g.
             handoffs (a project folder literally named temp: ./temp).
             Created if missing (not with --dry-run).

Prints { path, dir, created, timestamp, git: { repo, inRepo, ignored,
ignoreLine }, warning? }. The file name is <YYYY-MM-DD-HHmm>-handoff.md; if one
already exists for this minute, -2, -3... is appended so earlier handoffs are
never overwritten. git.ignored is null when the file is outside a repo (nothing
to ignore); false means it would show up in git status, and then git.ignoreLine
is the .gitignore line to offer and the top-level warning says so.

Exit: 0 ok · 2 bad arguments · 5 the folder cannot be created, or --dir names
an existing file (not-a-folder).
`;

function git(cwd, args) {
  try {
    return { ok: true, out: execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch (err) {
    return { ok: false, status: err.status };
  }
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { booleans: ["dry-run"], values: ["dir", "root"] });
  const root = path.resolve(args.root || ".");
  const choice = args.dir || "temp";
  const dir = choice === "temp" ? os.tmpdir() : path.resolve(root, choice);
  let created = false;
  if (fs.existsSync(dir) && !fs.statSync(dir).isDirectory()) {
    fail(EXIT.REFUSED, "not-a-folder", `${dir} exists and is a file, not a folder.`, "Pass a folder for --dir (a new one is created), or use --dir temp.");
  }
  if (!fs.existsSync(dir)) {
    if (!args["dry-run"]) {
      try {
        fs.mkdirSync(dir, { recursive: true });
        created = true;
      } catch (err) {
        fail(EXIT.REFUSED, "mkdir-failed", `Could not create ${dir}: ${err.message}`, "Pick another folder, or use --dir temp.");
      }
    }
  }
  const d = now();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp = `${isoDate(d)}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  let file = path.join(dir, `${timestamp}-handoff.md`);
  for (let n = 2; fs.existsSync(file); n++) file = path.join(dir, `${timestamp}-${n}-handoff.md`);

  // Compare real paths: git prints the repo's real top level, while the folder
  // may arrive as an 8.3 short name (C:\Users\JOHN~1\...) or through a symlink
  // (macOS /tmp -> /private/tmp). A folder not created yet (--dry-run) resolves
  // through its nearest existing ancestor. Git runs from that ancestor too, so
  // the file is checked against the repo it would actually land in.
  const existing = (() => {
    let p = dir;
    while (!fs.existsSync(p) && path.dirname(p) !== p) p = path.dirname(p);
    return p;
  })();
  const realDir = path.join(fs.realpathSync.native(existing), path.relative(existing, dir));
  const realFile = path.join(realDir, path.basename(file));
  const top = git(existing, ["rev-parse", "--show-toplevel"]);
  const gitInfo = { repo: top.ok || git(root, ["rev-parse", "--show-toplevel"]).ok, inRepo: false, ignored: null };
  if (top.ok) {
    const repoRoot = fs.realpathSync.native(path.resolve(top.out));
    const relToRepo = path.relative(repoRoot, realFile);
    gitInfo.inRepo = !!relToRepo && !relToRepo.startsWith("..") && !path.isAbsolute(relToRepo);
    if (gitInfo.inRepo) {
      // check-ignore exits 0 when ignored, 1 when not; it honours global and nested ignore files.
      const ci = git(repoRoot, ["check-ignore", "-q", relToRepo.split(path.sep).join("/")]);
      gitInfo.ignored = ci.ok;
      const relDir = path.relative(repoRoot, realDir).split(path.sep).join("/");
      // The repo root itself is never the line to ignore: offer the handoff files instead.
      gitInfo.ignoreLine = relDir ? `${relDir}/` : "*-handoff.md";
    }
  }
  out({
    ok: true,
    path: file,
    dir,
    created,
    dryRun: !!args["dry-run"],
    timestamp,
    git: gitInfo,
    ...(gitInfo.inRepo && gitInfo.ignored === false ? { warning: `This file would be tracked by git. Offer to add "${gitInfo.ignoreLine}" to .gitignore; do not add it without asking.` } : {}),
  });
});
