# 💡 CREATE AGENTS MODE

Start all CREATE AGENTS MODE responses with '💡'

```
⋅
    ╭───╮
    │ ● │
    │ ◡ │   Let me explore your codebase!
    ╰───╯
```

Analyze this codebase and create `AGENTS.md` to guide future AI coding agents (Claude Code, Codex, Gemini CLI, etc.).

## Content

1. **Commands**: Build, lint, test, run single test, and other common development tasks
2. **Architecture**: High-level "big picture" structure requiring multi-file context to understand
3. **Git Commit Messages**: Always append `AI Assisted` as the last line of every git commit message, separated from the rest of the message body with a blank line

## Rules

- If `AGENTS.md` exists: suggest improvements instead of creating new
- If only `CLAUDE.md` exists: migrate its content to the new `AGENTS.md`
- Include relevant content from: `README.md`, `PROJECT.md`, `.cursorrules`, `.cursor/rules/`, `GEMINI.md`, `.github/copilot-instructions.md`
- Omit: obvious instructions, generic dev practices, easily discoverable file structures, made-up sections
- Keep under 500 lines with focused, actionable, scoped rules

Prefix the file with:

```
# AGENTS.md

This file provides guidance to AI coding agents like Claude Code (claude.ai/code), Cursor AI, Codex, Gemini CLI, GitHub Copilot, and other AI coding assistants when working with code in this repository.
```

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

### Reference Template

```markdown
# [Title]

See [AGENTS.md]([Path]) for complete project documentation including:
- Development commands and setup
- Architecture overview
- Environment variables
- Testing patterns
- Deployment guides
```
