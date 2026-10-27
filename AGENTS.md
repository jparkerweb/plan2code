# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Project Overview

Plan2Code is a structured 4-step workflow methodology for AI-assisted software development. It provides prompt templates that can be installed globally or per-project for various AI coding tools (Claude Code, Cursor, Copilot, Continue, Windsurf, Codeium, Devin, Zed).

**Version:** Check `version.json` for current version
**Author:** Justin Parker
**License:** MIT

Plan2Code is started from the project the person works in (`cd` into it, then run `plan2code`), not from this repository; every newcomer doc says so, next to the Node.js 18+ requirement.

## How to Use This File

This file is an index — each section below contains a brief summary and a link to a detail file in `.agents-docs/`. Read only the sections relevant to your current task. Full details (commands, tables, file lists) are in the linked files. The sections "Project Overview", "How to Use This File", "Mascot", and "Keeping this file current" / "Failure log" are fully inline here and are never split into `.agents-docs/`.

## Architecture

High-level directory structure, key files, workflow prompt inventory, and file naming conventions.

Details: [Architecture](./.agents-docs/AGENTS-architecture.md)

## Plan2Code Loop

Autonomous CLI tool (`plan2code-loop/`) that implements specs by looping through tasks. Covers loop architecture, modes (one-task vs one-phase), completion markers, and key source files.

Details: [Plan2Code Loop](./.agents-docs/AGENTS-plan2code-loop.md)

## Plan2Code Metrics

Recursive self-improvement toolchain (`plan2code-metrics/`) for collecting run metrics, aggregating by prompt generation, diagnosing weak steps, and proposing prompt edits.

Details: [Plan2Code Metrics](./.agents-docs/AGENTS-plan2code-metrics.md)

## Plan2Code Status Line (Claude CLI)

Optional CLI status bar (`src/statusline-claude/`) for Claude Code. Displays model (+ effort), project/worktree, branch, git diff stats, duration + session cost, context usage, and usage stats (rate limits or token counts). Reads data directly from Claude Code's stdin JSON (plus timeout-bounded git calls): no API calls, no auth, no background processes.

Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Status Line section)

## Web Console

Optional local browser UI (`src/web-console/`, zero dependencies, detached `node` server on `127.0.0.1`) bundled into every skill via `additionalReferences`. The bare `plan2code` skill opens its dashboard, a card menu that launches any skill in the same session. Pages cover questions, sign-off gates (with an in-page code review), build progress, the living document, an **Ask** chat, a read-only **Workspace** of extra folders (remembered per folder and spec in `~/.plan2code/console/workspaces.json`), a session meter, a **git board** for the `git` workflow (three tabs, Changes, Branches and Sync, opening on the likely next step; branches, pull, push, commits and pull-request links, drawn from `state.git`; contract in `notes/git.md`), **Stop with a handoff** (handoffs live in `~/.plan2code/handoffs/`, owned by `handoffs.mjs`, swept after 30 days, and offered as dashboard chips to pick up in the same session), a private **Notebook** in the top bar (named tabs of Markdown and pictures, a live-preview CodeMirror editor, one notepad per folder in `~/.plan2code/notepads/`, owned by `notepads.mjs`, never shown to the agent, removed only through Cleanup once a month untouched), a built-in 18-topic Help, a first-run Welcome, User Preferences (gear) and a bug/idea link to GitHub issues. On opted-in skills (builds, review, Pathfinder, Plan, Revise plan) a **Subagents** button in the top bar turns helpers on or off per project and skill (on by default for those skills until switched off, saved in `~/.plan2code/console/subagents.json`), and a Helper strength choice (Balanced, Thrifty, Best, Match my session; rules in `src/shared-references/helper-strength.md`, shipped in the seven helper skills); the agent hears of it as a standing instruction only when it changes, and reports its helpers in a **Subagents** tab beside Ask (contract in `console-subagents.md`). Per-skill facts live in one list, `public/skills.js`, from which the meter, the resume command, Help's card list and the CLI's workflow list are derived; task files are read through `spec-files.mjs` (shared with the `specs.mjs` skill script), and the rule for which hops start the page clean is `startsClean()` in `public/hops.js`. The agent contract is read in pieces: `console.md` once per conversation, then a topic file (`console-*.md`, `notes/<workflow>.md`, `building*.md`) only when its moment comes; the server never writes into a project.
Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Web Console section) and [.readme/web-console.md](./.readme/web-console.md)

## Skill Scripts

Deterministic workflow steps run as Node scripts shipped in each skill's `scripts/` (shared ones in `src/skill-scripts/`, a skill's own in `src/<skill>-scripts/`, listed per skill in `SOURCE_PROMPTS` → `scripts`). Prose keeps the judgment. JSON on stdout, documented exit codes, tests run against the built `skills/` tree.

Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Skill Scripts section)

## Development Commands

Build commands, installer menu options, non-interactive skill-build verification, skills CLI delegation, skill format, and how to edit workflow prompts.

Details: [Development Commands](./.agents-docs/AGENTS-development-commands.md)

## Code Style & Gotchas

Language/toolchain conventions for `install.js` vs TypeScript packages, US English spelling, and pitfalls to avoid (version sync, `.gitignore` pre-flight, character limits, User Feedback table format).

Details: [Code Style & Gotchas](./.agents-docs/AGENTS-code-style.md)

## Mascot

The project has a mascot called "Planny": a box with a star for an eye, stick arms and two small feet. He appears in installer output, workflow prompts, the loop, the Claude Code status line (box, star and feet, no arms) and the web console. ASCII variants are defined in the `MASCOT` constant in `install.js` (and `plan2code-loop/src/utils/logger.ts`) and appear in workflow markdown files: arms down at rest, one arm waving when he is asking something, both arms up when he is celebrating. The eye is always the star.

The web console draws him as inline SVG in `src/web-console/public/index.html`, where he doubles as the page's state indicator: his star lights in the highlight color and he waves when something is yours to do, the star turns and his feet walk while the agent works, it goes green when all is done, he shows no arms at all when the agent is not answering, and he fades with his star shut when the connection drops. The parts are classed (`shell`, `eye`, `smile`, `foot`, and one `arms a-<mood>` set per mood) and `screens/core.js` switches mood with a single class, so the drawing stays in the markup and the styling in `styles/planny.css`. The nine skill start poses, the dashboard wake-up, `favicon.svg` / `favicon.js` and `src/launcher/plan2code.ico` all use the same design.

```
    ╭───╮
    │ ★ │╱
   ╱│ ◡ │
    ╰┬─┬╯
```

## Keeping this file current

The `Failure log` section below is a recording of mistakes made by previous AI Agents while working with this code base.

When you make a mistake, get corrected, or discover something about this codebase that wasn't written down:

1. Add one line to the `Failure log` below, in the imperative, describing the correct behavior.
2. Keep it specific to this repo. General advice belongs nowhere.
3. If this fix is a workflow rather than a rule, put it in `.claude/skills/` and link it from here.
4. Include the change in the same commit and mention it in your summary.
5. A skill rule broken twice becomes a script check (a `scripts/` test or a skill-script check), not more prose.
6. Before adding a line, look for one on the same topic: sharpen or extend that one rather than adding a near-duplicate.
7. Keep the log to 17 entries at most. Over the cap, first merge entries that share a cause, then drop the lowest-value ones: one-offs unlikely to recur, rules a test or script now enforces, and entries about code that no longer exists.

## Failure log

- Do not audit `CHANGELOG.md` headings through PowerShell — the emoji come back as `?`. See the gotcha for the correct approach.
- Sync upstream only through `/sync-repo`, and verify its baseline against the real tree before porting: an earlier sync silently skipped a whole upstream release (the `3-implement-review` skill) while the recorded version froze. Update the baseline with `.claude/skills/sync-repo/set-synced.mjs`, never with a shell pipe over the decrypted body.
- After a sync merge, run `npm test` before trusting a "clean" file: when upstream and plan2code fixed the same bug, `git merge-file` keeps both copies without a conflict (a sync once left `let pattern` declared twice in `app.js`, caught only by `parse-check`).
- When extracting upstream files in Git Bash, run `git show <ref>:<path>` with `MSYS_NO_PATHCONV=1` and `C:/` style paths (never `/c/`): path conversion rewrites `origin/main:.readme/x.md` into `origin\main;.readme\x.md`, the show fails, and the merge silently runs against an empty "theirs". Check every extracted file is non-empty before merging.
- After a sync, grep the result for every upstream name the rebrand map can miss (the `/sync-repo` body lists them): the owner slug and company name in any case, the bare brand word inside identifiers and fixtures, and the ticket key followed by anything, not only digits. Each slipped through once: an owner slug in `feedback-payload.mjs` and its test (fixed by hand to `jparkerweb/plan2code`); in v2.7.0 a `KEPT_<BRAND>_ENTRIES` constant, a `<brand>Dir` option, a `"<brand>"` test folder and an owner slug in a git remote URL; in v2.8.0 git board fixtures built as `` `feature/<KEY>-${11000 + i}-…` `` template literals, which a digits-only rewrite to `ABC-<n>` misses. No upstream name may appear in plain text anywhere in this repo.
- Keep plan2code's ticket-free `commit-msg.mjs` (`<subject>`, `AI Assisted`) in every `/sync-repo`: upstream's ticket-from-branch rule was ported by mistake once and removed in v2.6.0.
- When a new first-run dialog is added to the web console, set its seen flag in `scripts/capture-screenshots.mjs`'s `looks.json` too: the Welcome dialog once covered the regenerated dashboard screenshots until `welcomeSeen: true` was added.
- Import `scripts/skill-script-helpers.mjs` in any test that builds git fixtures for a skill script or `git-repo.mjs`: it scrubs the whole test process's git config, so fixtures, imported modules and spawned scripts agree. Mixed configs broke `git plan switch` once (a global `core.autocrlf=true` checked fixtures out with CRLF the scrubbed script read as changed).
- Before deleting a test file that upstream split or removed, diff plan2code's copy against the rebranded upstream base and port the plan2code-only tests: v2.7.0's split of the web console suite would otherwise have dropped seven hardening tests (now in `scripts/test-web-console-hardening.mjs`).
- Register a new skill in `install.js` `SOURCE_PROMPTS` before running its `scripts/test-script-<name>.mjs`: importing `scripts/skill-script-helpers.mjs` rebuilds `skills/` and prunes any skill folder `install.js` does not list, so the script under test vanishes.
- When a `CHANGELOG.md` heading gets a version number, set the same number in `version.json` (with its `releaseDate`), the root `package.json` and README's `Version X.Y.Z` line in the same change, then run `npm run build:skills`. The changelog skill only touches `package.json`: v2.9.0 nearly shipped with `version.json` at 2.8.1, and README's line sat at 2.6.0 for three releases.
- When a page test (`scripts/test-web-console-page-*.mjs`) fails only on CI or only in a full run, look for a race with a redraw before suspecting the change, and fix the test, not the timeout: read styles and set scrolls through `styleOf()`, `stylesOf()` and `scrollCard()` in `page-test-helpers.mjs` (a card a redraw replaced reads "" for every style and scrolls nothing; `test-web-console-shape.mjs` now fails a raw `locator.evaluate` that does either), and wait for the page to hold what the next step needs before acting (the workspace frame before typing `@`, the notepad's drawn marks, a newly selected tab). Keep `npm test`'s file concurrency under `scripts/node-test.mjs`'s cap of one file per spare core: a flat `--test-concurrency=8` ran 8 browsers on 3 and 4 core runners and failed a different page test on every CI run. On a busy local machine, rerun the failing files alone first; the chat stress test and the session suite's "no submitted frame within 5s" cascade still fail that way under load.
- Run `npm test` and `cargo test` from a terminal outside the desktop app, or with `PLAN2CODE_IN_APP`, `PLAN2CODE_APP_TOKEN`, `PLAN2CODE_APP_VERSION`, `PLAN2CODE_APP_ANNOUNCE`, `PLAN2CODE_EMBED_ORIGIN` and `PLAN2CODE_CONSOLE_SID` unset (`env -u ... npm test`): inherited from the app they fail about 34 tests that check behavior outside the app (the update banner, the terminal line, cookies, open's browser launch), and a test console announces itself to the live window. A `cargo test` run mid-build once took the window over that way, then left an agent-less dashboard in it, and the build's question was never seen. The app now ignores sessions outside its console store (`take_announced` in `main.rs`), and the Rust console tests scrub the variables, but the JS suites do not. Before pushing a change under `plan2code-app/`, also run `cargo fmt --check` and `cargo clippy --workspace --all-targets -- -D warnings` there, not only `cargo test`: CI's `app` workflow fails on either, and the Rust code once reached a PR never formatted (20 files) with three clippy errors, one only macOS and Linux could see (see plan2code-app/README.md "Tests").
- Post a helper as `done` or `failed` in the same turn its completion notice arrives: its row stays `running` on the Subagents tab until a post says otherwise (a build once reached its sign-off with one row spinning). A `finish` is now refused while any helper is `running`.
- Bring the Windows folder picker (`picker.mjs`, copied into `src/launcher/plan2code.js`) to the front with an Alt tap before `SetForegroundWindow`, never with `windowsHide`, the owner form's `TopMost`, `HWND_TOPMOST` or `AttachThreadInput`: measured on Windows 11, `SetWindowPos(HWND_TOPMOST)` returns true while the dialog stays non-topmost behind the browser, and only the Alt tap made it the foreground window. Check with `GetForegroundWindow` from a second process, since no test can see it.
- Add any new file or folder Plan2Code writes at the top of `~/.plan2code/` to `KEPT_PLAN2CODE_ENTRIES` in `src/web-console/sessions.mjs` and to the Cleanup test in `scripts/test-web-console-server.mjs`: User Preferences → Cleanup offers every other entry there for deletion once it is an hour old, and the desktop app's `app/` and `app.json` were about to be listed.
- When a test checks how `cmd.exe` finds a `.cmd`/`.bat` (current folder before PATH), clear `NoDefaultCurrentDirectoryInExePath` for the run under test (`env_remove` in Rust, `undefined` in a `test-launcher.mjs` `box.run` env): some shells (Claude Code's among them) already set it, and the decoy `.cmd` test for custom agents passed without its fix until it did.
