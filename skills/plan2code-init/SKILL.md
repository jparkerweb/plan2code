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
    │ ● │
    │ ◡ │   Let me explore your codebase!
    ╰───╯
```

Analyze this codebase and create `AGENTS.md` to guide future AI coding agents (Claude Code, Codex, Devin, Zed, etc.).

## Content

1. **Commands**: Build, lint, test, run single test, and other common development tasks
2. **Architecture**: High-level "big picture" structure requiring multi-file context to understand
3. **How to Use This File**: A short paragraph explaining that sections below contain brief summaries and agents should follow the markdown links to `.agents-docs/` for full details — only read what's relevant to the current task.
4. **Failure Log**: running list of mistakes and/or corrections that went wrong via the AI Agent at least once. 

## Rules

- If `AGENTS.md` exists: suggest improvements instead of creating new
- If only `CLAUDE.md` exists: migrate its content to the new `AGENTS.md`
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

- **Index format** — each section in AGENTS.md: heading, brief summary, then `Details: [Section Name](./.agents-docs/AGENTS-<section-name>.md)`
- **Detail files** — named `AGENTS-<section-name>.md` using kebab-case from the section header (e.g., "Development Commands" → `AGENTS-development-commands.md`)
- **Detail file header** — each file starts with:
  ```
  # <Section Name>
  > Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.
  ```

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

- Create `.agents-docs/` directory in the project root
- Each file: `AGENTS-<section-name>.md` where `<section-name>` is kebab-case of the section header
- Each file starts with `# <Section Name>` followed by breadcrumb: `> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.`

### Grouping Heuristics

- Combine related subsections into a single detail file (e.g., "Architecture" with its subsections → one file)
- Sections under ~10 lines of content should stay inline in AGENTS.md rather than being split out
- Decide grouping dynamically based on the project's actual content — heuristics guide, not prescribe

### Existing AGENTS.md Without `.agents-docs/`

If AGENTS.md exists but `.agents-docs/` does not, offer to restructure: "Your AGENTS.md uses a single-file format. Want to restructure it for progressive discovery? This splits detailed sections into `.agents-docs/` files and converts AGENTS.md to a lightweight index." Only restructure if the user confirms — never auto-restructure.

---

## AI Agent File Sync

After creating `AGENTS.md`, check for these files and offer to replace with references:

| File | Title | Path |
|------|-------|------|
| `CLAUDE.md` | CLAUDE.md | `./AGENTS.md` |
| `GEMINI.md` | GEMINI.md | `./AGENTS.md` |
| `.cursorrules` | .cursorrules | `./AGENTS.md` |
| `.github/copilot-instructions.md` | Copilot Instructions | `../AGENTS.md` |
| `.cursor/rules/*.md` | Project Rules | `../../AGENTS.md` |
| `.windsurf/rules/*.md` | Project Rules | `../../AGENTS.md` |

For `.cursor/rules/` and `.windsurf/rules/`: delete existing `.md` files, create single `reference.md`.

### Confirmation Prompt

If files found, show:

```
⋅
    ╭───╮
    │ ● │
    │ ~ │   Found some other AI agent configs!
    ╰───╯

I found these AI agent configuration files:
- [list files found]

Update them to reference AGENTS.md? (Yes / Select / No)
```

Only modify confirmed files.

### CLAUDE.md Template

CLAUDE.md gets a special template because Claude Code auto-loads it — the `CRITICAL — MANDATORY FIRST STEP` directive ensures AGENTS.md is always read:

```markdown
# CLAUDE.md

**CRITICAL — MANDATORY FIRST STEP: You MUST read [AGENTS.md](./AGENTS.md) before responding to ANY user message, including simple questions. Do NOT skip this step regardless of how trivial the request appears. No exceptions.**

See AGENTS.md for complete project documentation including:
- Development commands and setup
- Architecture overview
- Environment variables
- Testing patterns
- Deployment guides
- Keeping this file current / Failure log
- Section details in .agents-docs/

This file exists for Claude Code auto-loading. All AI coding agents should reference AGENTS.md.
```

### Reference Template (all other files)

```markdown
# [Title]

See [AGENTS.md]([Path]) for complete project documentation including:
- Development commands and setup
- Architecture overview
- Environment variables
- Testing patterns
- Deployment guides
- Keeping this file current / Failure log
- Section details in .agents-docs/
```
