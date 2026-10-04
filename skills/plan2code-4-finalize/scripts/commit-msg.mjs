#!/usr/bin/env node
// commit-msg.mjs: the team's commit message, built from the branch name.
//
// Every Plan2Code skill that suggests a commit uses one format:
//
//   <subject>
//
//   <JIRA-Ticket-ID>
//   AI Assisted
//
// and derives the ticket from a branch named <prefix>/<TICKET-ID>-description,
// where the ticket is an uppercase project key, a hyphen and an integer
// (ABC-10968). This script reads the branch, extracts the ticket and prints
// the exact command, so no prompt re-implements the rule by eye.

import { execFileSync } from "node:child_process";
import { EXIT, fail, out, parseArgs, run } from "./common.mjs";

const USAGE = `
commit-msg.mjs: build the team's commit command from the current branch. JSON on stdout.

  node commit-msg.mjs --subject "<subject>" [--add-all | --files <path> ...] [--ticket <ID>]

  --subject   the one-line description (at most 100 characters). No double
              quotes (straight or curly), backticks, $, backslashes or ! in it,
              so the command pastes unchanged into bash, zsh and PowerShell.
  --add-all   prefix the command with "git add -A &&".
  --files     prefix it with "git add -- <files> &&" (repeat --files per path).
  --ticket    use this ticket ID instead of reading the branch.

Prints { ok, branch, ticket, subject, message, command, add, commit }. The
commit is three -m flags, exactly: subject, ticket, "AI Assisted". command is
add && commit, one line for bash, zsh and PowerShell 7+. Windows PowerShell 5.1
has no &&: run add (null when nothing is staged) and then commit as two
commands. Nothing is run.

Exit: 0 ok · 2 bad arguments (including a stray argument: one --files per
path) · 3 not a git repository / no branch (detached HEAD) · 4 the branch
carries no ticket ID, --ticket is not KEY-123, the subject breaks a rule, or a
path cannot be quoted safely.
`;

// The ticket is the first <KEY>-<number> path segment start after a "/" (or the
// branch start), ended by "-", "_", "/" or the end of the name.
const TICKET_RE = /(?:^|\/)([A-Z][A-Z0-9]*-\d+)(?=[-_/]|$)/;

function ticketFromBranch(branch) {
  const m = String(branch || "").match(TICKET_RE);
  return m ? m[1] : null;
}

function git(args) {
  try {
    return { ok: true, out: execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() };
  } catch {
    return { ok: false };
  }
}

function currentBranch() {
  if (!git(["rev-parse", "--git-dir"]).ok) {
    fail(EXIT.NOT_FOUND, "not-a-repo", "This directory is not inside a git repository.", "Run from the project root, or skip the commit suggestion.");
  }
  // symbolic-ref names the branch even before the first commit, where
  // rev-parse --abbrev-ref HEAD fails; it fails only on a detached HEAD.
  const ref = git(["symbolic-ref", "--short", "-q", "HEAD"]);
  if (!ref.ok || !ref.out) fail(EXIT.NOT_FOUND, "detached-head", "HEAD is detached, so there is no branch name to read a ticket from.", "Ask the user for the ticket ID and pass --ticket <ID>.");
  return ref.out;
}

// A path goes into the command as-is when it is plainly safe, in single quotes
// otherwise (literal in bash, zsh and PowerShell alike). Backslashes become
// forward slashes, which git accepts on every platform. A leading @ or - is
// quoted too: unquoted, PowerShell reads @types as a splat and the path
// vanishes. The command's `git add --` means a leading - is never an option.
function quoteFile(f) {
  const p = f.replace(/\\/g, "/");
  if (/^[\w./:+][\w./:@+-]*$/.test(p)) return p;
  // PowerShell treats the curly single quotes as quote characters too.
  if (/['\u2018-\u201B]/.test(p)) fail(EXIT.INVALID, "unsafe-path", `The path ${p} contains a single quote, which cannot be quoted the same way in bash and PowerShell.`, "Use --add-all, or leave that file out and stage it by hand.");
  return `'${p}'`;
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { booleans: ["add-all"], values: ["subject", "ticket"], lists: ["files"] });
  if (args._.length) fail(EXIT.USAGE, "stray-argument", `Unexpected argument(s): ${args._.join(" ")}.`, "Each path needs its own --files (e.g. --files a.js --files b.js); quote a subject with spaces.");
  const subject = (args.subject || "").trim();
  if (!subject) fail(EXIT.USAGE, "missing-subject", "--subject is required.", 'Example: --subject "Add the export endpoint"');
  if (/[\r\n]/.test(subject)) fail(EXIT.INVALID, "multiline-subject", "The subject must be one line.", "The diff is the body; keep the subject to one line.");
  if (subject.length > 100) fail(EXIT.INVALID, "subject-too-long", `The subject is ${subject.length} characters; the limit is 100.`, "Shorten it; the diff is the body and the PR is the explanation.");
  // Inside "...": PowerShell ends the string at a curly double quote too,
  // bash and zsh treat \ as an escape, and ! is history expansion in an
  // interactive bash or zsh.
  if (/["`$\\!\u201C-\u201F]/.test(subject)) fail(EXIT.INVALID, "unsafe-subject", "The subject contains a double quote (straight or curly), backtick, $, backslash or !, which bash, zsh and PowerShell read differently inside double quotes.", "Rephrase without those characters (single quotes are fine).");
  if (args["add-all"] && args.files) fail(EXIT.USAGE, "add-conflict", "Use --add-all or --files, not both.", "Pick one.");

  let branch = null;
  let ticket = args.ticket ? args.ticket.trim() : null;
  if (ticket && !/^[A-Z][A-Z0-9]*-\d+$/.test(ticket)) fail(EXIT.INVALID, "bad-ticket", `"${ticket}" is not an uppercase KEY-123 ticket ID.`, "Pass a ticket like ABC-10968.");
  if (!ticket) {
    branch = currentBranch();
    ticket = ticketFromBranch(branch);
    if (!ticket) {
      fail(EXIT.INVALID, "no-ticket", `The branch "${branch}" has no <prefix>/<TICKET-ID>-description ticket in it.`, "Ask the user for the ticket ID, then rerun with --ticket <ID>; or show the command with <JIRA-Ticket-ID> for them to fill in.");
    }
  }

  const add = args["add-all"] ? "git add -A" : args.files ? `git add -- ${args.files.map(quoteFile).join(" ")}` : null;
  const commit = `git commit -m "${subject}" -m "${ticket}" -m "AI Assisted"`;
  out({
    ok: true,
    branch,
    ticket,
    subject,
    message: `${subject}\n\n${ticket}\nAI Assisted`,
    command: add ? `${add} && ${commit}` : commit,
    add,
    commit,
  });
});
