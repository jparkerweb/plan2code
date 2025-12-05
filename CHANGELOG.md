# Changelog

All notable changes to Plan2Code will be documented in this file.

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
