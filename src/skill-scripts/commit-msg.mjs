#!/usr/bin/env node
// commit-msg.mjs: the commit command every Plan2Code skill suggests.
//
// Every skill that suggests a commit uses one format:
//
//   <subject>
//
//   AI Assisted
//
// This script checks the subject and prints the exact command, so no prompt
// re-implements the rule by eye. It reads no git state and needs no repository.

import { EXIT, fail, out, parseArgs, run } from "./common.mjs";

const USAGE = `
commit-msg.mjs: build the commit command from a subject. JSON on stdout.

  node commit-msg.mjs --subject "<subject>" [--add-all | --files <path> ...]

  --subject   the one-line description (at most 100 characters). No double
              quotes (straight or curly), backticks, $, backslashes or ! in it,
              so the command pastes unchanged into bash, zsh and PowerShell.
  --add-all   prefix the command with "git add -A &&".
  --files     prefix it with "git add -- <files> &&" (repeat --files per path).

Prints { ok, subject, message, command, add, commit }. The commit is two -m
flags, exactly: subject, "AI Assisted". command is add && commit, one line for
bash, zsh and PowerShell 7+. Windows PowerShell 5.1 has no &&: run add (null
when nothing is staged) and then commit as two commands. Nothing is run.

Exit: 0 ok · 2 bad arguments (a stray argument, or an unknown flag such as
--ticket) · 4 the subject breaks a rule, or a path cannot be quoted safely.
`;

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
  const args = parseArgs(argv, { booleans: ["add-all"], values: ["subject"], lists: ["files"] });
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

  const add = args["add-all"] ? "git add -A" : args.files ? `git add -- ${args.files.map(quoteFile).join(" ")}` : null;
  const commit = `git commit -m "${subject}" -m "AI Assisted"`;
  out({
    ok: true,
    subject,
    message: `${subject}\n\nAI Assisted`,
    command: add ? `${add} && ${commit}` : commit,
    add,
    commit,
  });
});
