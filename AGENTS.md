# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.

## Project Overview

Plan2Code is a structured 4-step workflow methodology for AI-assisted software development. It provides prompt templates that can be installed globally or per-project for various AI coding tools (Claude Code, Cursor, Copilot, Continue, Windsurf, Codeium, Devin, Zed).

**Version:** Check `version.json` for current version
**Author:** Justin Parker
**License:** MIT

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

Optional local browser UI (`src/web-console/`, zero dependencies, detached `node` server on `127.0.0.1`) bundled into every skill via `additionalReferences`. The bare `plan2code` skill opens its dashboard, a card menu that launches any skill in the same session. Pages cover questions, sign-off gates (with an in-page code review), build progress, the living document, an **Ask** chat, a read-only **Workspace** of extra folders (remembered per folder and spec in `~/.plan2code/console/workspaces.json`), a session meter, a built-in 17-topic Help, a first-run Welcome, User Preferences (gear) and a bug/idea link to GitHub issues. On opted-in skills (builds, review, Pathfinder) a **Subagents** button in the top bar turns helpers on or off per project and skill (off by default, saved in `~/.plan2code/console/subagents.json`); the agent hears of it as a standing instruction only when it changes, and reports its helpers in a **Subagents** tab beside Ask (contract in `console.md` → Standing instructions). The agent-facing contract is `console.md` / `building.md`; the server never writes into a project.

Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Web Console section) and [.readme/web-console.md](./.readme/web-console.md)

## Skill Scripts

Deterministic workflow steps run as Node scripts shipped in each skill's `scripts/` (shared ones in `src/skill-scripts/`, a skill's own in `src/<skill>-scripts/`, listed per skill in `SOURCE_PROMPTS` → `scripts`). Prose keeps the judgment. JSON on stdout, documented exit codes, tests run against the built `skills/` tree.

Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Skill Scripts section)

## Development Commands

Build commands, installer menu options, non-interactive skill-build verification, skills CLI delegation, skill format, and how to edit workflow prompts.

Details: [Development Commands](./.agents-docs/AGENTS-development-commands.md)

## Code Style & Gotchas

Language/toolchain conventions for `install.js` vs TypeScript packages, and pitfalls to avoid (version sync, `.gitignore` pre-flight, character limits, User Feedback table format).

Details: [Code Style & Gotchas](./.agents-docs/AGENTS-code-style.md)

## Mascot

The project has a mascot called "Planny": a box with a star for an eye, stick arms and two small feet. He appears in installer output, workflow prompts, the loop, the Claude Code status line (box, star and feet, no arms) and the web console. ASCII variants are defined in the `MASCOT` constant in `install.js` (and `plan2code-loop/src/utils/logger.ts`) and appear in workflow markdown files: arms down at rest, one arm waving when he is asking something, both arms up when he is celebrating. The eye is always the star.

The web console draws him as inline SVG in `src/web-console/public/index.html`, where he doubles as the page's state indicator: his star lights in the highlight colour and he waves when something is yours to do, the star turns and his feet walk while the agent works, it goes green when all is done, he shows no arms at all when the agent is not answering, and he fades with his star shut when the connection drops. The parts are classed (`shell`, `eye`, `smile`, `foot`, and one `arms a-<mood>` set per mood) and `app.js` switches mood with a single class, so the drawing stays in the markup and the styling in `app.css`. The nine skill start poses, the dashboard wake-up, `favicon.svg` / `favicon.js` and `src/launcher/plan2code.ico` all use the same design.

```
    ╭───╮
    │ ★ │╱
   ╱│ ◡ │
    ╰┬─┬╯
```

## Keeping this file current

The `Failure log` section below is a recording of mistakes made by previous AI Agents while working with this code base.

When you make a mistake, get corrected, or discover something about this codebase that wasn't written down:

1. Add one line to the `Failure log` below, in the imperative, describing the correct behaviour.
2. Keep it specific to this repo. General advice belongs nowhere.
3. If this fix is a workflow rather than a rule, put it in `.claude/skills/` and link it from here.
4. Include the change in the same commit and mention it in your summary.

## Failure log

- Do not audit `CHANGELOG.md` headings through PowerShell — the emoji come back as `?`. See the gotcha for the correct approach.
- Sync upstream only through `/sync-repo`, and verify its baseline against the real tree before porting: an earlier sync silently skipped a whole upstream release (the `3-implement-review` skill) while the recorded version froze. Update the baseline with `.claude/skills/sync-repo/set-synced.mjs`, never with a shell pipe over the decrypted body.
- After a sync merge, run `npm test` before trusting a "clean" file: when upstream and plan2code fixed the same bug, `git merge-file` keeps both copies without a conflict (a sync once left `let pattern` declared twice in `app.js`, caught only by `parse-check`).
- When extracting upstream files in Git Bash, run `git show <ref>:<path>` with `MSYS_NO_PATHCONV=1` and `C:/` style paths (never `/c/`): path conversion rewrites `origin/main:.readme/x.md` into `origin\main;.readme\x.md`, the show fails, and the merge silently runs against an empty "theirs". Check every extracted file is non-empty before merging.
- After a sync, grep the result for the upstream owner slug and company name in any case (the `/sync-repo` body lists them): the rebrand map only rewrites URLs, so a bare owner slug once slipped through into `feedback-payload.mjs` (and its test) until it was fixed by hand to `jparkerweb/plan2code`. No upstream name may appear in plain text anywhere in this repo.
- Keep plan2code's ticket-free `commit-msg.mjs` (`<subject>`, `AI Assisted`) in every `/sync-repo`: upstream's ticket-from-branch rule was ported by mistake once and removed in v2.6.0.
- When a new first-run dialog is added to the web console, set its seen flag in `scripts/capture-screenshots.mjs`'s `looks.json` too: the Welcome dialog once covered the regenerated dashboard screenshots until `welcomeSeen: true` was added.
