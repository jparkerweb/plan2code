# AGENTS.md

This file provides guidance to AI coding agents like Claude Code (claude.ai/code), Cursor AI, Codex, Gemini CLI, GitHub Copilot, and other AI coding assistants when working with code in this repository.

## Project Overview

Plan2Code is a structured 4-step workflow methodology for AI-assisted software development. It provides prompt templates that can be installed globally or per-project for various AI coding tools (Claude Code, Cursor, Copilot, Continue, Windsurf, Codeium).

**Version:** Check `version.json` for current version
**Author:** Justin Parker
**License:** MIT

## Architecture

```
plan2code/
├── src/                    # Source workflow prompts (8 markdown files)
├── plan2code-loop/         # Autonomous loop CLI tool (Node.js/TypeScript)
│   ├── src/                # TypeScript source
│   └── dist/               # Built output (tsup)
├── dist/                   # Generated distribution files (auto-generated)
│   ├── global-commands/    # For global installation (~/.claude/, etc.)
│   └── local-commands/     # For per-project installation (.claude/, etc.)
├── docs/                   # Documentation and assets
├── specs/                  # Feature specs (if any in-progress)
├── install.js              # Interactive installer (Node.js)
├── version.json            # Version metadata
└── README.md               # User documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `install.js` | Main installer - generates and installs workflow files to AI tool directories |
| `src/plan2code-*.md` | Source workflow prompts (the "source of truth") |
| `version.json` | Version metadata (name, version, description) |
| `QUICK-REFERENCE.md` | User quick-reference card |

## Workflow Prompts (in `src/`)

| File | Step | Purpose |
|------|------|---------|
| `plan2code---init.md` | Init | Generate AGENTS.md for projects |
| `plan2code---init-update.md` | Update | Update AGENTS.md with learnings |
| `plan2code---quick-task.md` | 0 | Lightweight planning for small tasks |
| `plan2code-1--plan.md` | 1 | Requirements analysis & architecture |
| `plan2code-1b--revise-plan.md` | 1b | Mid-implementation revisions |
| `plan2code-2--document.md` | 2 | Create implementation specs |
| `plan2code-3--implement.md` | 3 | Execute implementation (phase by phase) |
| `plan2code-4--finalize.md` | 4 | Validate, summarize, archive |

## Plan2Code Loop (`plan2code-loop/`)

A separate Node.js CLI tool that autonomously implements specs by looping through tasks.

### Loop Architecture

The loop uses an **LLM-driven discovery** approach:
- Node app just orchestrates iterations and parses completion markers
- The LLM reads spec files (`overview.md`, `phase-X.md`) to discover tasks
- The LLM finds unchecked checkboxes, implements ONE task per iteration, marks it complete
- No regex parsing of markdown in Node - the AI handles all task discovery

### Loop Commands

```bash
# Build the loop CLI
cd plan2code-loop && npm run build

# Run the loop (after linking) - fully interactive
plan2code-loop
```

The CLI auto-detects specs in `./specs/`, prompts for selection if multiple found, and handles session continuation interactively. Session state is stored per-spec in `specs/<feature>/.plan2code-loop/`.

### Loop Modes

The CLI asks users to choose a loop mode:
- **One task per loop** (default) - Each agent invocation implements exactly one task. The Node controller handles git commits.
- **One phase per loop** - Each agent invocation implements all remaining tasks in the current phase. The LLM handles git commits (with JIRA ticket ID if provided). The controller parses multiple completion markers from a single iteration.

### Completion Markers

The LLM must output one of these formats:
- `TASK_COMPLETE: 1.1 - Task description` - Task done successfully
- `TASK_BLOCKED: 1.1 - Reason` - Cannot complete task
- `PHASE_COMPLETE` - Current phase finished (phase mode only)
- `LOOP_COMPLETE` - All phases finished

## Development Commands

```bash
# Run the interactive installer
node install.js

# Install to specific platform only
node install.js --platform claude
node install.js --platform cursor
node install.js --platform copilot
node install.js --platform continue
node install.js --platform windsurf
node install.js --platform codeium
node install.js --platform vscode-copilot

# Preview changes without installing
node install.js --dry-run

# Show local (per-project) installation instructions
node install.js --local

# Uninstall all Plan2Code files
node install.js --uninstall

# Plan2Code Loop
cd plan2code-loop && npm install   # First time setup
cd plan2code-loop && npm run build # Build the CLI
```

### Installer Menu Options

| Option | Action |
|--------|--------|
| `A` | Install to ALL platforms + build & link loop CLI |
| `O` | Build & link plan2code-loop CLI only |
| `U` | Uninstall prompts from all platforms + unlink loop CLI |
| `L` | Show local (per-project) install instructions |
| `1-7` | Install to specific platform |

## How the Installer Works

1. **Reads source prompts** from `src/plan2code-*.md`
2. **Generates platform-specific files** with appropriate headers (YAML frontmatter for some platforms)
3. **Writes to `dist/`** subdirectories organized by destination type
4. **Copies to target directories** (global: `~/.claude/commands/`, etc.)

### Platform-Specific File Formats

| Platform | Extension | Header |
|----------|-----------|--------|
| Claude Code | `.md` | None |
| Cursor | `.md` | None |
| Copilot CLI | `.md` | YAML frontmatter |
| Continue | `.prompt.md` | YAML frontmatter |
| Windsurf | `.md` | YAML frontmatter |
| VS Code Copilot | `.prompt.md` | YAML frontmatter |
| Codeium | `.md` | YAML frontmatter |

## Naming Convention

Workflow files follow a strict naming pattern:
- **Utilities:** `plan2code---<name>.md` (triple dash)
- **Numbered steps:** `plan2code-<N>--<name>.md` (single dash, number, double dash)

Examples:
- `plan2code---init.md` (utility)
- `plan2code-1--plan.md` (step 1)
- `plan2code-1b--revise-plan.md` (step 1b)

## Editing Workflow Prompts

When modifying workflow prompts in `src/`:

1. Edit the source file in `src/`
2. Run `node install.js` to regenerate distribution files
3. Test the workflow in your AI tool of choice
4. The `dist/` folder is regenerated automatically - don't edit files there directly

## Code Style

- **JavaScript:** CommonJS modules (Node.js built-ins only - no external dependencies)
- **Console output:** Uses ANSI color codes via the `COLORS` constant
- **User interaction:** Readline-based interactive prompts
- **File operations:** Synchronous fs operations for simplicity

## Gotchas/Pitfalls

- **Version sync:** When adding a new version to `CHANGELOG.md`, also update `version.json` to match. The installer displays the version from `version.json` in its header.
- **Loop `.gitignore` setup:** `ensureGitignore()` runs at startup in `Controller.run()` as a pre-flight step, not just inside `createTaskCommit()`. This is critical for phase mode where the Node controller doesn't handle commits — without it, `git add -A` would stage spec files.

## Git Commit Messages

- **AI Assisted footer:** All git commit messages must include `AI Assisted` as the final line, separated from the message body by a blank line
- **Commit paths:** This is enforced across all commit surfaces:
  - Loop task mode: `createTaskCommit()` in `plan2code-loop/src/utils/git.ts` appends the footer automatically
  - Loop phase mode: Prompt template instructs the LLM to add `-m "AI Assisted"` as the final flag
  - Implement mode: User-facing commit suggestions in `src/plan2code-3--implement.md` include the footer
- **Init workflow:** `src/smarsh2code---init.md` generates AGENTS.md files with a Git Commit Messages section that includes this convention by default

## Mascot

The project has a mascot called "Smarshy" - an ASCII art robot that appears in installer output and workflow prompts. Mascot variants are defined in `MASCOT` constant in `install.js` and appear in workflow markdown files.

```
   ╭───╮
   │ ● │
   │ ◡ │
   ╰───╯
```
