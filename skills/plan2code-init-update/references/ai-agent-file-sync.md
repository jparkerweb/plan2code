# Step 7 — AI Agent File Sync

Check for other AI agent config files and offer to replace them with AGENTS.md
references, so AGENTS.md stays the single source of truth.

## Files to Detect

| File | Reference Path |
|------|----------------|
| `CLAUDE.md` (root) | `./AGENTS.md` |
| `GEMINI.md` (root) | `./AGENTS.md` |
| `.cursorrules` (root) | `./AGENTS.md` |
| `.github/copilot-instructions.md` | `../AGENTS.md` |
| `.cursor/rules/*.md` | `../../AGENTS.md` |
| `.windsurf/rules/*.md` | `../../AGENTS.md` |

**No files found:** Skip silently, end workflow.

## If Files Found

```
    +---+
    | o |
    | ~ |   Found other AI agent configs!
    +---+
```

> Found AI config files that could reference AGENTS.md:
>
> | File | Size |
> |------|------|
> | `CLAUDE.md` | 45 lines |
>
> Replace with AGENTS.md references?
> - **Yes** - Update all
> - **Select** - Choose specific (numbered list)
> - **No** - Keep as-is

**Warning** for files >10 lines: "[file] has custom content that will be replaced."

## CLAUDE.md Template

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

## Reference Template (all other files)

Use title and path from the detection table:

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

**For directory configs** (`.cursor/rules/`, `.windsurf/rules/`): Delete existing `.md` files, create single `reference.md`.
