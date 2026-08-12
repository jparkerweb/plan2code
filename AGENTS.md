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

## Development Commands

Build commands, installer menu options, how the installer generates platform-specific files, platform format table, and how to edit workflow prompts.

Details: [Development Commands](./.agents-docs/AGENTS-development-commands.md)

## Code Style & Gotchas

Language/toolchain conventions for `install.js` vs TypeScript packages, and pitfalls to avoid (version sync, `.gitignore` pre-flight, character limits, User Feedback table format).

Details: [Code Style & Gotchas](./.agents-docs/AGENTS-code-style.md)

## Mascot

The project has a mascot called "Planny" — an ASCII art robot that appears in installer output and workflow prompts. Mascot variants are defined in the `MASCOT` constant in `install.js` and appear in workflow markdown files.

```
   ╭───╮
   │ ● │
   │ ◡ │
   ╰───╯
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
