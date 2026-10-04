---
name: plan2code-init
description: "Plan2Code Init: Init Mode - user-initiated workflow step. Do not invoke autonomously."
disable-model-invocation: true
---

# 💡 CREATE AGENTS MODE

Start all CREATE AGENTS MODE responses with '💡'

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ◡ │   Let me explore your codebase!
    ╰┬─┬╯
```

Analyze this codebase and create `AGENTS.md` to guide future AI coding agents (Claude Code, Codex, Devin, Zed, etc.).

## Interface

The FIRST thing you do, before anything else in this file — before exploring the codebase: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow init` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-init/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md. Every confirmation — the restructure offer, the AI-agent file-sync prompt — goes through it, and the finished AGENTS.md lands on the page as a doc marked `saved` (the file is already on disk — no download offered). Switchable anytime. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open — resume it (console.md → Launches), then Content. On the console, a `__stop` action is the person ending the session (console.md → Stop requests); at every session end post `finish` BEFORE `stop`; unless it is a pause, the finish carries `"dashboard": true` (the Back to the dashboard button) and you keep waiting for the press (console.md → Finishing).

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-init/scripts/` globally). Run from the project root; each prints one JSON object, and on a non-zero exit `next` says what to do.

- `node "<S>/agents-md.mjs" inspect`: does AGENTS.md exist, its line count against 500, `structure` (`progressive` or `single-file`), sections, `.agents-docs/` files, broken links, orphans. Run it first.
- `node "<S>/agents-md.mjs" filename "<Section Name>"`: a section's detail file name, its `Details:` link line and its two header lines.
- `node "<S>/agent-files.mjs" detect` / `apply <id> ... [--dry-run]`: AI Agent File Sync (below).

## Content

1. **Commands**: Build, lint, test, run single test, and other common development tasks
2. **Architecture**: High-level "big picture" structure requiring multi-file context to understand
3. **How to Use This File**: A short paragraph explaining that sections below contain brief summaries and agents should follow the markdown links to `.agents-docs/` for full details — only read what's relevant to the current task.
4. **Failure Log**: running list of mistakes and/or corrections that went wrong via the AI Agent at least once. 

## Rules

- If `AGENTS.md` exists (`inspect` → `exists`): suggest improvements instead of creating new
- If only `CLAUDE.md` exists (`inspect` → `otherFiles`): migrate its content to the new `AGENTS.md`
- Include relevant content from: `README.md`, `PROJECT.md`, `.cursorrules`, `.cursor/rules/`, `GEMINI.md`, `.github/copilot-instructions.md`
- Omit: obvious instructions, generic dev practices, easily discoverable file structures, made-up sections
- Keep under 500 lines with focused, actionable, scoped rules

Prefix the file with:

```
# AGENTS.md

This file provides guidance to AI coding agents working with code in this repository.
```

---

## Progressive Discovery

Generate AGENTS.md as an **index file** — each section gets a 2-3 line summary with a markdown link to a detail file. Full content goes in `.agents-docs/` directory files.

- **Index format** — each section in AGENTS.md: heading, brief summary, then its `Details:` link line
- **Detail files** — `agents-md.mjs filename "<Section Name>"` gives the file (`AGENTS-<kebab-case>.md`, e.g. "Development Commands" → `.agents-docs/AGENTS-development-commands.md`), the `Details:` link and the two header lines (`# <Section Name>` plus the "Part of AGENTS.md" breadcrumb) to start it with

### Always Inline

These sections must remain fully inline in AGENTS.md (never split to separate files):
- Project Overview
- How to Use This File
- Keeping this file current / Failure log

### Failure Log section template

When creating or modifying `AGENTS.md`, always ensure this section is included at the end:

```
## Keeping this file current

The `Failure log` section below is a recording of mistakes made by previous AI Agents while working with this code base.

When you make a mistake, get corrected, or discover something about this codebase that wasn't written down:

1. Add one line to the `Failure log` below, in the imperative, describing the correct behaviour.
2. Keep it specific to this repo. General advice belongs nowhere.
3. If this fix is a workflow rather than a rule, put it in `.claude/skills/` and link it from here.
4. Include the change in the same commit and mention it in your summary.

## Failure log

- 

```

### Directory Setup

- Create `.agents-docs/` directory in the project root, one file per split section, named and headed as `filename` prints
- After writing, rerun `inspect`: `problems` must be empty (no broken link, no orphan, no missing breadcrumb, nothing always-inline split out)

### Grouping Heuristics

- Combine related subsections into a single detail file (e.g., "Architecture" with its subsections → one file)
- Sections under ~10 lines of content should stay inline in AGENTS.md rather than being split out
- Decide grouping dynamically based on the project's actual content — heuristics guide, not prescribe

### Existing AGENTS.md Without `.agents-docs/`

If `inspect` reports `structure: "single-file"`, offer to restructure: "Your AGENTS.md uses a single-file format. Want to restructure it for progressive discovery? This splits detailed sections into `.agents-docs/` files and converts AGENTS.md to a lightweight index." Only restructure if the user confirms — never auto-restructure.

---

## AI Agent File Sync

After creating `AGENTS.md`, run `agent-files.mjs detect`. It finds `CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`, and the `.cursor/rules/` and `.windsurf/rules/` folders, with each one's line count and `custom` (more than 10 lines). Leave out entries with `alreadyPointer: true` (already the AGENTS.md pointer) and `linkedToAgents: true` (a symlink or hard link: they are AGENTS.md); nothing left: skip this step silently.

### Confirmation Prompt

If files found, show:

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ~ │   Found some other AI agent configs!
    ╰┬─┬╯

I found these AI agent configuration files:
- [each `found` id, with its line count]

Update them to reference AGENTS.md? (Yes / Select / No)
```

Relay every `warnings` line (custom content that would be replaced). A rules folder is one entry: replacing it deletes its `.md` files (and `.mdc` for Cursor) and leaves one `reference.md`.

Only modify confirmed files: `agent-files.mjs apply <id> ...` with the ids the user confirmed (`--all` for Yes). It writes the pointer templates itself: `CLAUDE.md` gets the `CRITICAL — MANDATORY FIRST STEP` directive that makes Claude Code read AGENTS.md first (it auto-loads CLAUDE.md); every other file gets the "See AGENTS.md for complete project documentation including:" pointer with the same bullet list and the right relative path. Rerunning is harmless (`unchanged`).
