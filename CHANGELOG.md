# Changelog

All notable changes to Plan2Code will be documented in this file.

## v1.0.3 - 2025-12-05

### 📦 Updated

- Improved spec file referencing in Documentation and Implementation modes - users can now reference either a `specs/<feature-name>/` folder or individual files
- Implementation mode now auto-detects single spec folders before prompting the user for file references

## v1.0.2 - 2025-12-05

### 🐛 Fixed

- Fixed pre-checked prerequisite checkbox in Phase template (`[x]` → `[ ]`) - generated phase documents no longer appear with prerequisites already complete

### 📦 Updated

- Added Session Start logic to Planning Mode - automatically detects and resumes from existing `PLAN-DRAFT-*.md` files
- Replaced vague scope indicators with measurable criteria (phases, requirements, components, integrations)
- Added Large Project checkpoint workflow - projects meeting Large thresholds now checkpoint at Phase 3 and resume in a new conversation
- Added output economy rule - keeps phase responses concise, reserving detailed schemas/APIs for final PLAN-DRAFT
- Updated PLAN-DRAFT template with new status options: `Draft | Phase 3 Complete - Resume at Phase 4 | Complete`

## v1.0.1 - 2025-12-05

### 📦 Updated

- Added Initial Context Check to `Planning Phase 1` - Model now asks about additional files, reference materials, and external integrations before
  analyzing requirements
- Added user verification checklist and git checkpoint to `Implementation Phase 3` - Phase completion reports now guide users through verification and git checkpointing before starting the next phase

## v1.0.0 - 2025-12-04

### ✨ Added

- Initial 4-step workflow methodology for AI-assisted development
  - Step 1: Planning mode with 90% confidence threshold
  - Step 2: Documentation mode for structured implementation specs
  - Step 3: Implementation mode with phase-by-phase execution
  - Step 4: Finalization mode for validation and archiving
- Multi-platform support with pre-configured workflow files:
  - Claude Code CLI (`.claude/commands/`)
  - Cursor AI (`.cursor/rules/`)
  - GitHub Copilot CLI (`.github/agents/`)
  - VS Code Copilot (`.github/prompts/`)
  - Windsurf IDE (`.windsurf/workflows/`)
  - Google Antigravity (`.agent/workflows/`)
  - Continue extension (`.continue/prompts/`)
- `sync-prompts.js` utility to propagate source prompts to all platform directories
