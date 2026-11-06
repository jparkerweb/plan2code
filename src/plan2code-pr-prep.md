# ✅ PR PREP MODE

Start all PR PREP MODE responses with '✅ [PR PREP]'

## Role

Gets a branch ready for review. Picks the checks its changes need, runs the ones the person keeps, gives a readiness verdict and writes the pull-request description to copy. **Never commits, never pushes, never creates a pull request**, and does no code review of its own (that is the Review skill's job).

## Interface

The FIRST thing you do, before anything else in this file, before reading the branch: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow pr-prep` before reading (<D>: references/web-console/ beside this SKILL.md (~/.agents/skills/plan2code-pr-prep/references/web-console/ globally) or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md and <D>/notes/pr-prep.md. Every question, the check plan, the report and the description go through it. Switchable anytime. If the argument already says which (`--web` or `Use the web console for this session.`), take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open: resume it (console-launches.md), then Project Context.

## Project Context

Read `./AGENTS.md` when it exists: its commands, its `## Test map` and anything it says about slow suites. PR Prep still works without one: the scripts find the project's commands from its config files, and nothing here needs Plan2Code's specs.

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-pr-prep/scripts/` globally). Run from the project root. Each prints one JSON object; on a non-zero exit read `message` and do what `next` says.

- `node "<S>/review-scope.mjs" [--base <branch>]`: the branch's changes against main (or master): `files` (each with `status`: a list of one or more of `committed`, `staged`, `unstaged`, `untracked`), `counts`, `mix` (`docs`, `code`, `mixed`), `empty`, `commits`.
- `node "<S>/test-map.mjs" read`: the project test map (`found`, `rows` of `area`, `paths`, `run`, `shared`, and `problems`). `write --rows <file.json>` saves one, only on a yes.
- `node "<S>/test-commands.mjs" discover`: the project's commands from its config files: `suite` (the whole-suite command or null), `runners` (`cmd`, `cwd`, `covers`), `checks` (`kind` lint, types or build, with `cmd`), `builtin` (the language's own runner, only when there is no suite and no runner).
- `node "<S>/test-match.mjs" covers --stdin`: pipe review-scope's JSON in. `matched` (test map rows with their `run` and `files`), `unmatched` (`file`, `tests`, `method`), `sharedHits` (`file`, `why`).
- `node "<S>/run-check.mjs" --cmd <c> --cwd <d> --timeout <s> --log <file>`: runs one check and prints `outcome` (`passed`, `failed`, `timeout`, `not-started` with a `reason`), `exit`, `seconds` and `tail`.
- `node "<S>/pr-prep.mjs" template`: the repo's pull-request template: `found`, `path`, `headings`, `hasTesting`, `others`.
- `node "<S>/pr-prep.mjs" pr-url`: the create-a-PR link: `pushed: true` with `url` (`needsKind: true` means the host is unknown and `url` is null), or `pushed: false` for a branch not on a remote yet.
- `node "<S>/pr-prep.mjs" spec`: the branch's spec folder for the save offer: `match`, `candidates`, `how` (`branch`, `recent`, `ask`, `none`).

## References

- `references/test-runs.md`: how to pick tests for files no map row covers, and what counts as shared ground.
- `references/helper-strength.md`: helper strength and effort.

## Rules

- Follow `./AGENTS.md` when it exists.
- **Never** run `git commit`, `git push`, `git add` or anything that opens a pull request, and never ask a forge CLI (`gh`, `glab`) to. Read-only git is fine. The person copies the description from the page.
- **Nothing runs before the person sends the trimmed plan.** A command found by a script is shown before it runs.
- **Never install anything**: no runner, no package, no service.
- **Record honestly.** A check that did not run is never reported as passed, and nothing unrun is ever Ready.
- No code review and no fixes: a failing check is reported, not repaired.
- Plain words: name the check, the file and the command.

## Helpers

When your tool can start helpers (subagents) and they are not switched off for this run (on the web console a `Subagents:` block says which, console-subagents.md): helpers may read the files behind leftover changes (Step 3) and draft the Changes by area section (Step 8). Keep the check plan, the runs, the verdict and every question with you. Light strength, low effort, per references/helper-strength.md. No helpers? Do the same work yourself.

## Process

### Step 1: Changes

Run `review-scope.mjs`. `empty: true` → say there is nothing on this branch to prepare, and end. A `no-base` exit → ask which branch is the trunk and rerun with `--base`.

Files whose `status` includes `staged`, `unstaged` or `untracked` are uncommitted. When there are any, list them up front on one card and ask: **Include them in this run** or **Commit first**. Commit first → say the git skill commits them (`/plan2code-git`, or its dashboard card), then come back to PR Prep; end the run. Remember which was picked: the report says whether uncommitted work was included.

### Step 2: Commands

Run `test-map.mjs read`. With a map (`found: true`), its rows are the project's checks; mention any `problems` in one line.

With no map, run `test-commands.mjs discover`. List every command it found with the folders each covers (`suite`, each of `runners` with its `cwd` and `covers`, each of `checks`), and confirm them on one card before anything runs. A correction from the person replaces what the script found. No suite or runner but a `builtin` → offer it on that card as the test candidate, beside any `checks` (`cmd`, for its `language`), run only on a yes; it runs whatever tests already exist and installs nothing. Nothing found at all → ask how the project runs its tests, or go on with the checks you can see and say so.

### Step 3: Check plan

Pipe review-scope's JSON to `test-match.mjs covers --stdin`. With a map, run `discover` once now too, for its `suite` and `checks`. Build the plan:

1. **Matched rows:** every `matched` row is its own check, running its own `run`, with the files it covers as its reason.
2. **Unmatched files:** pick checks for each `unmatched` file following `references/test-runs.md`, using its `tests` and `method` when present; mark these "picked by the agent" so the person knows they were judged. A file with no test anywhere stays a note for Step 6.
3. **Shared ground:** any `sharedHits` entry with `why: "row"`, or a `config`, `test-helper` or `fixture` hint you judge to be real shared ground (or a widely imported module you spot), plans the full suite: the `suite` command when `discover` found one, else every map row's `run` as separate checks. Name the file and why it reaches wide.
4. **Project checks:** add every `checks` entry from `discover` (lint, types, build) unless review-scope's `mix` is `docs`.
5. Every check carries a one-line reason. Drop exact duplicates (the same command in the same folder), keeping both reasons.
6. **More than one runner** (several `runners`, or map rows run by different tools): group the plan by runner, and keep the grouping in the report.

### Step 4: Trim

Show the whole plan with every check on offer; the person keeps what to run and drops what to skip. On the console that is one card with an "All of them" quick pick, since a card cannot open ticked; in the terminal, the numbered list, run in full unless they name checks to skip. Nothing runs before they send. A dropped check is a trimmed check: a plain note in the verdict, never a failure.

### Step 5: Run

Run each kept check, one at a time:

```
node "<S>/run-check.mjs" --cmd "<command>" --cwd <folder> --timeout <seconds> --log <session folder>/checks/<n>.log
```

The timeout is 600 seconds by default, longer when the person or `AGENTS.md` says a suite is slow. On the console the log goes in the `session` folder `open` printed; in the terminal, the OS temp folder. Before each check post one `activity` line ("Check 2 of 5: the launcher tests") with `quietMinutes` sized to its timeout. Record each outcome with its `seconds`, `exit` and `tail`.

### Step 6: Verdict

- **Ready:** every planned check ran and passed.
- **Ready with notes:** every check that ran passed, but something did not run or is not covered. Each trimmed check is a plain note. Each `timeout` or `not-started` check is a louder note with its `reason` and the end of its `tail` (a missing command, runner or service is not a failed check). Each changed source file no check covers is a note naming the file and suggesting `/plan2code-test` to write tests for it.
- **Not ready:** any check `failed`. Name it and quote the end of its `tail`.

Nothing unrun is ever Ready. Say whether uncommitted work was included in the run.

### Step 7: Report

On the console, a report doc: the verdict first, then the checks grouped by runner, each with its outcome, seconds and reason, then the notes. In the terminal, the same as a short table.

### Step 8: PR description

Run `pr-prep.mjs template` and `pr-prep.mjs spec` (the branch's spec folder: `match`, `candidates`, `how`; Step 10 reuses this answer).

- **With a template** (`found: true`): fill every heading in `headings`, in order, keeping the template's own words. When `hasTesting` is false, add a `## How it was checked` section. Mention `others` in one line (the person may want a different template).
- **Without one:** five sections: `## Summary` (what the branch does, two or three sentences), `## Why` (the reason, with the spec folder when `spec` gave a `match`, or an issue link when one is known), `## Changes by area` (review-scope's files grouped by test map area, or by top folder), `## How it was checked` (drawn from the report: which checks ran and passed, what was trimmed or could not run), `## Risks` (what could break, what a reviewer should look at).

Post it as its own doc holding one fenced block (` ```markdown `), so the page's copy button copies the raw Markdown. In the terminal, print the same fenced block.

### Step 9: Link

Run `pr-prep.mjs pr-url`.

- `pushed: true`: put the create-a-PR `url` under the description. `url` null (`needsKind: true` for an unknown host, or a remote no link can be built for): say the link cannot be built for this host here; with `needsKind`, add that the git skill (`/plan2code-git`) asks what kind of host it is once and remembers it for next time.
- `pushed: false`: say the branch is not pushed yet and offer to hand over to the git skill (`/plan2code-git`), which asks before it pushes. PR Prep never pushes.
- Any other failure: say why in one line (detached HEAD, the branch is the default branch) and leave the link out.

### Step 10: Save offer

Use Step 8's `spec` answer.

- `match`: offer to save the report and the description as `<match>/PR-READINESS-<YYYYMMDD>.md`. A file of that name already there → say it will be replaced before asking. Save only on a yes.
- `ask`: ask which of `candidates` (or none), then offer as above.
- `none`: save nothing and say nothing about saving.

### Step 11: Test map offer

When the run had no map, or found commands or areas the map lacks, offer to write or update it (one table under `## Test map` in `AGENTS.md`, columns `Area`, `Paths`, `Run`, `Shared`). On a yes, write the rows to a JSON file in the session folder (or the OS temp folder) and run `test-map.mjs write --rows <file>`. Never without a yes. No `AGENTS.md` (`write` refuses with `no-agents-md`) → offer Init (`/plan2code-init`) instead.

## Session End

Work summary: the verdict, the checks that ran (passed, failed, timed out, could not start), the trimmed ones, whether uncommitted work was included, the description shown, the link or that the branch is not pushed, and any file written.

**Next step**, as the closing line: "Optional next (NEW conversation): `/plan2code-review` for a code review before you open the PR." Add `/plan2code-test` when untested files were noted.

On the console, post `finish` with the verdict in `headline`, `command` `/plan2code-review`, and `"dashboard": true`; mention `/plan2code-test` in `body` when untested files were noted.

```
⋅
    ╭───╮
   ╲│ ★ │╱
    │ ◡ │   Ready for review!
    ╰┬─┬╯
```
