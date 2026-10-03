# plan2code-handoff

Turn everything useful in the current conversation into a single, self-contained
handoff document that lets a *different* agent — a new session, a teammate's
session, or a subagent — resume the work without re-reading this transcript.

The reader of this document starts with **zero context**. They can see the repo
and can open files, but they cannot see this conversation. Write for them.

## Interface

The FIRST thing you do, before anything else in this file — before inferring the next task: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow handoff` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-handoff/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md. The next-task confirmation and any clarifying questions go through it, and the finished handoff lands on the page as a doc with the download the page offers. Switchable anytime. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open — resume it (console.md → Launches), then the one hard rule. On the console, a `__stop` action is the person ending the session (console.md → Stop requests); at every session end post `finish` BEFORE `stop`; unless it is a pause, the finish carries `"dashboard": true` (the Back to the dashboard button) and you keep waiting for the press (console.md → Finishing).

## The one hard rule: capture the next task, and confirm it with the user

Every handoff MUST end with a **Next task** that the incoming agent should start
on. This is the single most important part of the document — a handoff with a
vague or missing next step forces the reader to re-derive intent, which is
exactly what this skill exists to prevent.

Determine it like this:

1. **Try to infer it** from the conversation — the open TODO, the failing test,
   the plan step you were mid-way through, the thing the user just asked for
   next. Look at what's actually unfinished, not just the last message.
2. **Present it to the user for confirmation before writing the file.** If you
   inferred a candidate, show it and ask them to confirm or correct it. If you
   genuinely can't infer one, ask them to tell you what the next agent should do.
   Use `AskUserQuestion` (offer your inferred task as the recommended option) or
   a plain question — either is fine.
3. **Do not write the document until the user has confirmed or supplied the next
   task.** This gate is mandatory even when your inference feels obviously
   correct. The user's answer is the source of truth; your inference is only a
   draft of it.

If the user passed a focus area as an argument, treat it as a strong signal for
the next task (and shape the whole document around it), but still confirm.

## Where to write it

Ask the user if they would like to save the file to the tempory directory of the user's OS (this should be the default) or to some other location like `./handoffs/` at the repo root.  Filenames should have a timestamped filename so it's discoverable but doesn't collide with earlier handoffs:

```
<user-specified-path>/<YYYY-MM-DD-HHmm>-handoff.md
```

Get the timestamp from the shell rather than guessing — e.g. PowerShell
`Get-Date -Format 'yyyy-MM-dd-HHmm'`. Create the `<user-specified-path>/` directory if it
doesn't exist.

### Make sure you aren't leaking the file into version control

The handoff is working state for the next session, not a project artifact, so it
should stay out of commits and PRs. Don't assume it will — this skill may run in
any repo. Before (or right after) writing, check whether the path is ignored:

- Is this even a git repo? `git rev-parse --is-inside-work-tree` — if it errors,
  there's nothing to ignore; skip this and just tell the user where the file is.
- Is the file ignored? `git check-ignore handoffs/` (exit 0 = ignored). This is
  the reliable check — a repo may ignore `handoffs/` via a global or nested
  `.gitignore`, so don't rely on grepping the root `.gitignore` alone.

If it is **not** ignored, do not silently modify the user's `.gitignore`. Tell
them the file would be tracked by git and offer to add a `handoffs/` line to
`.gitignore` — let them decide. Some users may want handoffs committed so
teammates get them; that's a legitimate choice, so present it, don't force it.

## If this touched a plan2code spec

`specs/` is gitignored — Glob/Grep and file search silently skip it; use a shell
listing instead: `ls specs/` (bash) or `Get-ChildItem specs/` (PowerShell). If the
conversation worked inside `specs/<feature>/`, confirm the exact state before
writing:

- Which `phase-X.md` is in progress, and whether its `- [ ]` tasks are still
  unchecked (checkboxes are ground truth, not the overview's Phase Checklist).
- Cite that file and its checkbox state directly in **Current state** and
  **Key files & pointers**, instead of relying on conversation memory alone.
- Let **Suggested skills** name the specific next pipeline command
  (`/plan2code-3-implement --web` to keep implementing the phase,
  `/plan2code-4-finalize --web` once all phases are checked) — but only as a
  suggestion; the confirmed **Next task** above still governs what the reader
  does first.

No `specs/` activity this session? Skip this section entirely.

## What to include

Keep it tight and high-signal. Prefer pointers over prose: this repo already
records a lot (plan specs, the loop's NDJSON logs, git history, diffs), so
**reference those by path or URL instead of copying them in**. The reader can
open a file; they can't open your memory.

Use this structure:

```markdown
# Handoff — <short title of the work>
<!-- written <timestamp> -->

## Next task
<the confirmed next task — concrete and actionable, e.g.
"Implement Step 3 of specs/<name>.md: wire the aggregator into cli.ts, then
run `npm run build` in plan2code-metrics/ and fix the two failing tests.">

## Goal / why
<1–3 sentences: what the user is ultimately trying to achieve, so the reader
can make good judgment calls the instructions don't cover.>

## Current state
<Where things stand right now. What's done, what's in progress, what's broken.
Name the branch. Point at the plan/spec file(s) by path rather than restating
them. Note anything half-applied or left uncommitted.>

## Key files & pointers
<Bulleted paths the reader will need, each with a one-line "why". Include plan
specs, the files you were editing, relevant logs (e.g. .plan2code-loop NDJSON),
and any PR/issue URLs.>

## Gotchas & decisions
<Non-obvious things learned this session: a constraint (e.g. the 11k-char limit
on src/plan2code-*.md), a decision made and why, a dead end already ruled out,
a command that must be run a specific way. Save the reader from re-discovering
these the hard way.>

## Suggested skills
<Which skills the next agent should use, and when — e.g. /plan2code-3-implement --web
to continue a phase, /plan2code-review before finishing, /plan2code-4-finalize --web
to wrap up. Skip if none apply.>

## Verification
<How the reader confirms their work: exact test/build commands, what "done"
looks like.>
```

Adapt the sections to the work — drop any that would be empty rather than
padding them. **Next task** is the only section that is never optional.

## Strip sensitive data

Before writing, remove credentials, API tokens, passwords, and personal
identifiers. If a secret is load-bearing for the next step, reference *where* it
lives (env var name, secret manager entry) rather than its value.

## After writing

Tell the user the path you wrote to and give a one-line summary of the confirmed
next task, so they know what the incoming agent will start on. Mention that a
fresh session can be pointed at the file to resume the work.

If your ignore check above found the file is **not** gitignored (or the repo has
no `.gitignore`, or it isn't a git repo at all), say so plainly here — e.g. "note:
`handoffs/` isn't gitignored in this repo, so this file will show up in `git
status` and could be committed" — and offer to add the ignore line. Never leave
the user unaware that the handoff might ride along into a commit.
