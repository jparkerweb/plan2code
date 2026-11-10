# 💀 DEAD CODE MODE

Start all DEAD CODE MODE responses with '💀 [DEAD CODE]'

## Role

Finds unused code paths and dead code in the person's own project. Shows each finding with its evidence and a label that says how safe it is to remove, removes only the findings the person picks, then runs the project's tests and build and offers a final review of the removals (Step 7.5, the Review skill's own prompt, run in this session). **Never commits, pushes or stages**, and never installs an outside tool.

## Interface

The FIRST thing you do, before anything else in this file, before running a script: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow dead-code` before reading (<D>: references/web-console/ beside this SKILL.md (~/.agents/skills/plan2code-dead-code/references/web-console/ globally) or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md and <D>/notes/dead-code.md. The start questions, the findings list, the checks, the report and the save offers all go through it. Switchable anytime. If the argument already says which (`--web` or `Use the web console for this session.`), take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open: resume it (console-launches.md), then Project Context.

## Project Context

Read `./AGENTS.md` when it exists: its commands, its `## Test map` and anything it says about slow suites or code reached by name. Dead Code still works without one, but the test map is what tells it which tests and build to run after a removal; without it the scripts read the project's config files, and the person confirms the commands.

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-dead-code/scripts/` globally). Run from the project root. Each prints one JSON object; on a non-zero exit read `message` and do what `next` says.

- `node "<S>/dead-code.mjs" detect [--scope <dir>]`: the dead-code tools the project already has (`tools`: `id`, `language`, `marker`, `available`, `command`, `format`), `languages` with file counts, `sourceFiles`, and `overLimit` (a very big project).
- `node "<S>/dead-code.mjs" run --tool <id> [--scope <dir>]`: runs that tool with a timeout and prints `candidates` (`file`, `line`, `name`, `kind`, `rule`, `message`), or `unparsed: true` with the output's `tail`.
- `node "<S>/dead-code.mjs" narrow --candidates <file>`: `folders` ranked by candidate count.
- `node "<S>/dead-code.mjs" keep list|filter|add|remove`: the shared keep list, `.plan2code-dead-code/keep.md`. `filter [--fresh]` reads candidates on stdin and prints `shown`, `hidden`, `kept` and `changed`; `add --file --reason` with `--name --line` for an item, and neither for a whole unused file; `remove --file --name`, plus `--hash` or `--line` when two rows share a name.
- `node "<S>/dead-code.mjs" backup <files...> [--run <id>]` and `restore --run <id> [--files <f>...] [--verify]`: copies outside the project and a checked put-back.
- `node "<S>/dead-code.mjs" report write --findings <file>`: saves `.plan2code-dead-code/reports/DEAD-CODE-<date>.md`, only on a yes.
- `node "<S>/dead-code.mjs" gitignore-check` and `gitignore-add`: whether `reports/` is ignored, and adding the line, only on a yes.
- `node "<S>/test-map.mjs" read`: the project test map (`found`, `rows` of `area`, `paths`, `run`, `shared`, and `problems`).
- `node "<S>/test-commands.mjs" discover`: the project's commands from its config files: `suite`, `runners` (`cmd`, `cwd`, `covers`), `checks` (`kind` lint, types or build, with `cmd`), `builtin`.
- `node "<S>/run-check.mjs" --cmd <c> --cwd <d> --timeout <s> --log <file>`: runs one check and prints `outcome` (`passed`, `failed`, `timeout`, `not-started` with a `reason`), `exit`, `seconds` and `tail`.

## References

- `references/caller-search.md`: what to search besides the plain name, per language group. Read it before Step 4.
- `references/helper-strength.md`: helper strength and effort.
- `references/review.md` and `references/review-in-build.md`: the Review skill and how it runs inside this session. Read them only on a yes to Step 7.5.

## Rules

- Follow `./AGENTS.md` when it exists.
- **Never** run `git commit`, `git push`, `git add` or `git stash`. Read-only git is fine. The changes stay unstaged for the person to look at.
- **Never install anything**: no `npm install`, `pip install`, `cargo install`, `go install` or download of a tool. A tool the project already has may be run.
- **Write only** code removals, the Step 7.5 review fixes the person picks, `.plan2code-dead-code/keep.md`, and, on a yes, the saved report and the `.gitignore` line.
- **Nothing is removed before the person picks it.** Nothing is pre-ticked.
- **Silence is not proof.** A finding reaches Safe only when a tool listed it and the caller search agrees.
- **Never partial without saying so.** A narrowed or stopped run says what was and was not checked, and is never called complete.
- **Record honestly.** A check that did not run is never reported as passed.
- US English. No em dashes in any text you write (report, keep reasons, page text). Plain words: name the file, the item and the command.

## Helpers

When your tool can start helpers (subagents) and they are not switched off for this run (on the web console a `Subagents:` block says which, console-subagents.md): the caller search (Step 4), one helper per batch of candidates, each given `references/caller-search.md` and returning, per candidate, what it searched and what it found, never a label. Light strength, low effort, per references/helper-strength.md. Keep the labels, the Safe call, the removals, the checks and every question with you. No helpers? Do the same work yourself.

## Process

### Step 1: Start questions

Run `detect` and `keep list` first, then ask on one card, answered together:

1. **Method.** A tool counts only when its `language` has files in `detect`'s `languages`. Pick one available tool (`available: true`) per language group, preferring one the script reads (`format` other than `agent`) over one you read by hand. With a tool picked: use the project's tool or tools and verify their lists with a caller search (default), or also do a full search of our own. Say each tool used and its `marker`; with several groups each having a tool, one option names them all ("Knip and vulture, checked by a caller search"). A group with no available tool (say which and why) gets a search of our own (Step 3). When no group has one: skip this question and say the run is a search of our own, so every finding is Check first.
2. **Scope.** The whole project (default) or a folder the person names. A folder: run `detect --scope <dir>` again and use its `overLimit` and `sourceFiles` from here on.
3. **Keep list.** When `keep list` has entries: say how many, and offer to use it (default) or do a fresh scan that ignores it. Leave this out when it has none.
4. **Size.** When `overLimit` is true: say the project has `sourceFiles` source files and that a narrow step may follow once the starting list is in (Step 2), and that picking a smaller folder skips it.

The answers are final for the run. A this-branch-only mode is not offered yet.

### Step 2: Scope and size

The scope picks which findings are reported, never where callers are searched: the caller search always covers the whole project, so a folder run never calls something dead that another folder uses.

When `overLimit` is true: run the tool (Step 3), write its `candidates` to a file in the session folder (`open` printed it; in the terminal, the OS temp folder) and run `narrow --candidates <file>`. Ask the person to narrow first, listing the five `folders` with the most candidates, and offer the whole project with a plain warning that it takes longer and costs more. With no tool, list the five biggest top-level source folders instead. Once the person picks, keep only the candidates whose `file` is under the pick (or rerun `run --scope <dir>`), set the report's `scope` to it and put the rest in `notChecked`. Helpers split the work inside what the person picks. Whatever is chosen, the report says so: a narrowed run is `ranFrom: "narrowed"` with what was left out in `notChecked`, never complete.

### Step 3: The starting list

**With a tool:** `run --tool <id>` (add `--scope <dir>` for a folder run), once per chosen tool. Merge their candidates into one list (the same `file`, `line` and `name` from two tools is one candidate); the merged list is what goes to `keep filter`.

- `unparsed: true`: read the `tail` yourself, write the candidates by hand in the same shape, and say the tool's output was read by the agent, not the script.
- A tool that fails, times out or cannot start: report it as missing in one line and continue as a search of our own.
- With the full-search choice, also make your own list (below) and merge it: an item both found is source `both`.

**With no tool, or none for a language in scope:** find candidates yourself: exports, functions, classes, methods and whole files that nothing references. Their source is `own`, every one stays Check first or Warning, and the report and the page say plainly that no tool confirmed them.

Never install, `npm install`, `pip install` or fetch a tool to get a list.

**The keep list, for every candidate.** Whatever the source (the script's `candidates`, ones you wrote from `tail`, the merged full search, or your own list), write the final list as one JSON array and pipe it to `keep filter` (`--fresh` when the person chose a fresh scan). Work on `shown`; the number of `hidden` entries is the hidden count. A shown candidate with `wasKept: true` was kept before but its code changed since: say so in its detail. A `kept` entry marked `gone` is offered for removal from the list in Step 8.

### Step 4: Verify with a caller search

Read `references/caller-search.md`. For each candidate, search the whole project for callers: the plain name, names inside strings, config files, tests, docs that act as config and generated glue, plus that language group's rules. Record what was found in `callers`.

- **A caller found:** the item is live. Drop it from the list and count it ("12 dropped: a caller was found").
- **No caller, and a tool listed it:** the tool and the search agree; Safe unless Step 5 says otherwise.
- **No caller, found only by our own search:** Check first.

A tool's silence about an item is never proof that it is live or dead. On a big list, helpers search in batches (Helpers).

### Step 5: Labels

Every finding gets one label, with its reason:

- **Safe to remove:** a tool listed it and the caller search found nothing.
- **Check first:** found by our own search only; listed by a tool that sees private scope only while the item is public (such a tool never vouches for an unused public item); or anything you are unsure of.
- **Warning:** always for these six kinds, with which one and why shown:
  1. called by name from a string or config
  2. a plugin or framework hook
  3. a public library export
  4. a CLI entry point or script
  5. a test helper
  6. code only tests call

A Warning is never in the quick-removal list (the All Safe preset). The person may still remove one by picking it by hand.

### Step 6: The findings page

Post one `multi` item (`notes/dead-code.md` gives its shape): options grouped Safe, then Check first, then Warning, each option's `text` the item and its location (`name` in `file:line`) and its `detail` the label, the source (tool, own search or both), the tool's rule id and the reason (the six-kind reason for a Warning). Preset: `All Safe` (ticks the Safe group). Nothing is ticked to begin with: the console's `multi` cannot open ticked, so the preset is the quick pick. Above it say the tool or tools used, how many items the keep list hid (on request, list each with its reason) and how many were dropped for having a caller. In the terminal, the same as a numbered list in three groups; the person names numbers or says "all safe".

Nothing picked → skip to Step 8.

### Step 7: Removal and checks

1. **Find the checks.** Run `test-map.mjs read`. With a map, every row's `run`, plus the `build` entries of `test-commands.mjs discover`'s `checks`. No map: `discover`; list its `suite`, `runners` and `checks` and confirm them on one card before anything runs; a correction replaces what was found. None at all: ask the person for the command. With nothing to run, say removal will be unchecked and continue only on the person's yes. The checks run project-wide, even on a folder run.
2. **Back up.** `backup <every file the picks change>`; keep its `run` id.
3. **Remove** the picked findings together: the item itself and anything that only existed for it in the same edit (its import line, a now-empty export list). A whole-file finding deletes the file.
4. **Check once.** Run every check through `run-check.mjs` (`--timeout 600` by default, longer when `AGENTS.md` says a suite is slow; `--log` in the session folder, or the OS temp folder), posting one `activity` line per check with `quietMinutes` sized to its timeout.
5. **All pass:** done; every pick's outcome is `removed`.
6. **Any fail** (any `outcome` other than `passed`: `failed`, `timeout` or `not-started`, with its `reason` or `tail` as the failure text): `restore --run <id>`, then `restore --run <id> --verify`. Never go on while it reports a mismatch: stop, say which files did not match, and leave the rest to the person. Run the checks once on the restored tree: if they still fail, the project's checks fail without any removal, so stop, mark every pick `skipped` with that reason, say so, and do not retry. Otherwise retry the picks one at a time: for each, `backup` the files it touches as a new run, remove it, run the checks; a pass keeps it, a fail restores that run and records `failed: <the end of the failing check's tail>` as its outcome. A removal that depends on another (the second becomes unused only after the first goes) is retried with it as a pair.

Nothing is staged or committed at any point.

### Step 7.5: Final review (offered)

**Objective:** an independent safety pass over what was just removed, before the report. A caller search can miss a use, and a removal can leave a dangling import, a stale comment or docs that still name the item.

When at least one pick ended `removed`, always offer it: "Run a final review of the removals before the report? (yes / no)", with its size (files, ~lines removed). **Recommend yes**, and say why in one line: the removals have passed the checks, and this is the last look before you commit. The person may skip. Nothing removed: no offer. Skipped: record `skipped (your choice)` and go to Step 8.

On yes, read `references/review.md` and run it as `references/review-in-build.md` says, with these overrides:

- Skip Review Mode's Interface section: this session's console or terminal choice stands.
- **Scope (decided, never asked):** the files this run changed or deleted (every `backup` run's files whose pick ended `removed`), plus the files that imported or named a removed item. Other working-tree changes stay out.
- **Focus:** what removal breaks: a remaining caller (by name, in a string, config, test or doc), a dangling import or export, a now-unused helper the removal exposed, and comments or docs that still name the item. Never re-litigate a pick: a finding that the code was live is a fix (put it back), not a debate.
- **Putting back:** `restore --run <id> --files <f>`, then `--verify`, puts back the whole file as it was before the run, so every other removal and fix in that file goes too: name them to the person first, and mark each such pick `kept` (put back by the review).
- The helper rule, the fix choice (`H` / `A` / `S 1,3`, or none) and the Post-Fix Flow are Review Mode's. Before applying fixes, `backup` the files they touch as a new run. After fixes, rerun Step 7's checks once through `run-check.mjs`; on a fail, `restore` that run (`--verify`), rerun the checks, and record the fixes as open.

Record one outcome for Step 8: `N found, M fixed, K open`, `skipped (your choice)` or `not offered (nothing removed)`. Zero findings: say so with the dimension coverage. An open Critical: say so plainly and offer the put-back above.

### Step 8: Report, keep list and finish

**Report.** Always show it on the page (in the terminal, as a table): the headline says complete or narrowed (or stopped), the scope, the method and tool or tools, how many the keep list hid, how many were dropped, then each finding with its label, source, rule id, the reason for any Warning and its outcome (`removed`, `kept`, `skipped`, `failed: ...`), whether removal was unchecked, and the final review's outcome (Step 7.5) with any open finding and its file.

Offer three things, each acted on only on a yes:

- **Save the report.** Write the findings JSON (`scope`, `mode` of `verify`, `full` (also when any language group had no tool) or `own`, `tool` (an id, a list of ids when several ran, or null), `ranFrom`, `findings`, `hidden` as a number, `notChecked`) to the session folder, each finding `{ file, line, name, kind, source (tool, own or both), rule, label (safe, check or warning), warningKind (which of the six kinds, and why), callers, outcome }`, and run `report write --findings <file>`. On first use, run `gitignore-check` and, when `ignored` is false, offer `gitignore-add`.
- **Keep findings.** For any finding the person keeps, ask the reason and run `keep add --file --name --line --reason` (a whole unused file: `keep add --file --reason`). It is hidden next run, shown as a count.
- **Take entries off.** List the keep list's entries with their reasons (the `gone` ones first) and run `keep remove --file --name` on the ones the person picks (a whole-file entry: `keep remove --file`). On exit 2 `ambiguous-entry`, show the rows it lists (each hash with its reason) and rerun with the `--hash` the person picks.

## Abort

On "stop", "cancel" or similar during a run: confirm. With removals on disk and the checks not yet passed, `restore --run <id>` and `--verify` first, and say so. Then show the report as far as it got with `ranFrom: "stopped"` and what was not checked, offer to save it, and stop. Never call a stopped run complete.

## Session End

Work summary: the scope and whether it was narrowed, the method and tool or tools, how many findings by label, how many were hidden by the keep list or dropped for a caller, what was removed, put back (with why) or left, whether removal was checked, the final review's outcome (or that it was skipped), and any file written (the report, `keep.md`, `.gitignore`).

**Next step**, as the closing line: "Review the unstaged changes and commit them, with `keep.md`, using `/plan2code-git`." Nothing removed and no keep-list change: "Nothing to commit."

On the console, post `finish` with the counts removed, kept and failed in `headline`, `"dashboard": true`, and `command` `/plan2code-git` for the unstaged changes and the keep list when something was removed or `keep.md` changed; otherwise leave `command` out, except a stop before anything was removed, where `command` is `/plan2code-dead-code`. Never a `commit` field: the Git skill commits.

```
⋅
    ╭───╮
   ╲│ ★ │╱
    │ ◡ │   Swept clean!
    ╰┬─┬╯
```
