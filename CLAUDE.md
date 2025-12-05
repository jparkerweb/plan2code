# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

Plan2Code is a structured 4-step workflow methodology for AI-assisted software development. It contains prompt templates, not executable code. The workflow emphasizes thorough planning before implementation.

## Development Commands

```bash
# Sync source prompts to all platform-specific directories
node sync-prompts.js

# Preview changes without writing
node sync-prompts.js --dry-run
```

## Repository Architecture

**Source prompts** (root directory) are the canonical versions:
- `plan2code-1--plan.md` - Planning mode prompt
- `plan2code-2--document.md` - Documentation mode prompt
- `plan2code-3--implement.md` - Implementation mode prompt
- `plan2code-4--finalize.md` - Finalization mode prompt

**sync-prompts.js** copies these to platform-specific directories with appropriate YAML headers:
- `.claude/commands/` - Claude Code CLI (no headers)
- `.cursor/rules/` - Cursor AI (`.mdc` extension, `alwaysApply: false`)
- `.github/prompts/` - VS Code Copilot (`mode: agent`)
- `.github/agents/` - GitHub Copilot CLI
- `.continue/prompts/` - Continue extension
- `.windsurf/workflows/` - Windsurf IDE
- `.agent/workflows/` - Google Antigravity

**Always edit source prompts in root, then run `node sync-prompts.js` to propagate changes.**

## Workflow Steps

1. **Plan** (`plan2code-1--plan.md`) - Requirements analysis and architecture design as a senior architect
2. **Document** (`plan2code-2--document.md`) - Transform planning output into structured implementation docs
3. **Implement** (`plan2code-3--implement.md`) - Execute implementation phase by phase
4. **Finalize** (`plan2code-4--finalize.md`) - Validate, summarize, and archive

## Key Behavioral Rules

- Start a **new conversation** before each step (and for each implementation phase)
- Complete only **one planning/implementation phase at a time**, then stop
- Must reach **90% confidence** before finalizing plans
- **Tech stack decisions require explicit user approval**
- Keep **checkboxes updated** in spec files for progress tracking
- Follow specifications **exactly as documented**
- Do NOT run tests unless explicitly included in phase tasks

## Response Prefixes

Each mode has a required prefix:

- Planning: `🤔 [CURRENT PLANNING PHASE]`
- Documentation: `📝 [CURRENT DOCUMENTATION PHASE]`
- Implementation: `⚡ [CURRENT IMPLEMENTATION PHASE]`
- Finalization: `🧹 [FINALIZATION STEP]`

## Output Structure

Specs are stored in `specs/` folder:

```
specs/
├── PLAN-DRAFT-<timestamp>.md    # From Step 1
├── <feature-name>/
│   ├── overview.md              # Phase checklist
│   └── Phase X.md               # Detailed tasks per phase
└── completed/                   # Archived after finalization
```

## Using as Slash Commands

In Claude Code, invoke with:
- `/plan2code-1--plan` - Start planning
- `/plan2code-2--document` - Create implementation docs
- `/plan2code-3--implement` - Execute implementation
- `/plan2code-4--finalize` - Validate and archive
