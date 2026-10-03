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

Optional CLI status bar (`src/statusline-claude/`) for Claude Code. Displays model, project, branch, context usage, usage stats (rate limits or token counts), git diff stats, and duration. Reads data directly from Claude Code's stdin JSON — no API calls, no auth, no background processes. Included in `Install All + dev tools` (`A`); also available via `install.js` Custom → S (opt-in).

Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Status Line section)

## Web Console

Optional local browser UI (`src/web-console/`) that every skill offers at the start of a session, so questions, sign-off gates, build progress and the document taking shape can be worked through in a page instead of the terminal. The bare `plan2code` skill is the front door: it opens the console's dashboard — a card menu of every skill — and a pick launches that skill on the same page by resuming the session under its workflow. A phase's sign-off card offers to run the code review first — before approval — and a finished quick task's hand-off offers a **Review it now** button; either runs `plan2code-review` on the page in the same session. Finished (not paused) screens offer **Back to the dashboard**, and notes and quick questions can carry image and document (text, code, PDF) attachments (stored in the session dir, never the project). An **Ask** tab, always last, opens a Quick question chat the running agent answers at its next check-in, on its own channel beside the cards (edits only after the person approves them); context is attached only on purpose, through **+ Add context**, and an empty conversation offers starter questions. A Role in User Preferences (asked for by a dashboard banner until set) orders the starter templates on Pathfinder, Plan and Quick Task's fresh-idea card (`"templates": "idea"`, wording in `public/starters.js`) and the Ask starters; it never changes what a skill asks. Note attachments a spec file cites are copied into `specs/<idea>/attachments/` by the agent with `console.mjs keep`; the server itself never writes into a project. The footer's folder label opens a **Workspace** dialog where the person adds more folders as read-only context for the whole console session, each addressed as `@name` in answers, notes and Ask (contract in `console.md` → Workspace). A green / yellow / red **session meter** in the top bar counts weighted points as one console session chains skill runs (`public/meter.js`; agents report per-unit work with `run` in a post) and suggests a fresh console session at red. The **?** at the top right opens a 16-topic Help dialog built into the page, so it reads even with the server gone. Zero dependencies, detached `node` server on `127.0.0.1`, bundled into each skill via `additionalReferences`.

Details: [Architecture](./.agents-docs/AGENTS-architecture.md) (see Web Console section) and [.readme/web-console.md](./.readme/web-console.md)

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
