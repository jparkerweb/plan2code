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
├── plan2code-metrics/      # Recursive self-improvement toolchain
│   ├── src/                # TypeScript source
│   │   └── prompts/        # Internal AI prompt templates (no char limit)
│   └── dist/               # Built output (tsup)
├── scripts/                # Development scripts
│   └── validate-char-count.js  # Pre-commit character count validator
├── dist/                   # Generated distribution files (auto-generated)
│   ├── global-commands/    # For global installation (~/.claude/, etc.)
│   └── local-commands/     # For per-project installation (.claude/, etc.)
├── .husky/                 # Git hooks (husky)
│   └── pre-commit          # Runs character count validation
├── docs/                   # Documentation and assets
├── specs/                  # Feature specs (if any in-progress)
├── install.js              # Interactive installer (Node.js)
├── package.json            # Root package (husky only, private: true)
├── version.json            # Version metadata
└── README.md               # User documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `install.js` | Main installer - generates and installs workflow files to AI tool directories |
| `src/plan2code-*.md` | Source workflow prompts (the "source of truth") |
| `scripts/validate-char-count.js` | Pre-commit validator ensuring all source prompts ≤ 11,000 chars |
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
| `plan2code-4--finalize.md` | 4 | Validate, summarize, feedback, archive (7 steps) |

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

## Plan2Code Metrics (`plan2code-metrics/`)

A recursive self-improvement toolchain for plan2code contributors. Collects run metrics, aggregates by prompt generation, diagnoses weak steps via AI, and proposes surgical prompt edits.

### Metrics Data Flow

```
Collect → Aggregate → Analyze → Improve → Apply
```

1. **Collector** reads project artifacts (`specs/<feature>/`) → writes `RunMetrics` JSON per run
2. **Aggregator** groups runs by prompt SHA fingerprint (cohorts) → `aggregated.json`
3. **Analyzer** invokes AI with aggregated metrics + prompt contents → diagnosis markdown
4. **Improver** invokes AI with diagnosis → validated `PromptEdit[]` proposals (char limit + verbatim checks)
5. **Applier** shows interactive diffs → patches `src/plan2code-*.md` files

### Metrics Commands

```bash
cd plan2code-metrics && npm run build  # Build the CLI
plan2code-metrics                      # Run (fully interactive, no flags)
```

### Metrics CLI Menu

| Option | Action |
|--------|--------|
| Collect | Read spec artifacts → run JSON |
| Import | Copy run JSON from another project |
| View | Display cohort metrics with health indicators |
| Analyze | AI diagnosis of weak metrics |
| Propose | AI improvement proposals with validation |
| Apply | Interactive diff review + file patching |

### Key Files

| File | Purpose |
|------|---------|
| `types.ts` | All interfaces (`RunMetrics`, `UserFeedback`, `CohortMetrics`, etc.) + `METRIC_TARGETS` |
| `collector.ts` | Reads project artifacts → run JSON (parses plan drafts, overview.md, loop logs) |
| `aggregator.ts` | Merges runs by prompt generation (SHA cohort) → `aggregated.json` |
| `analyzer.ts` | AI diagnosis via `prompts/analyze.md` template |
| `improver.ts` | AI proposals via `prompts/improve.md` + validation (char count, old_text match) |
| `applier.ts` | Interactive diff review + file patching |
| `cli.ts` | Menu-driven interactive CLI (100% prompts, no flags) |
| `invoke-llm.ts` | Unified LLM interface (Claude Code or Copilot CLI) |

### User Feedback

The collector parses an optional `## User Feedback` table from `overview.md`:

```markdown
## User Feedback
| Field | Value |
|-------|-------|
| Rating | 8 |
| Reason | Smooth workflow |
| Went Well | Planning was thorough |
| Went Poorly | Some tasks unclear |
```

Feedback is collected during finalize (Step 5) or retroactively via the CLI. Pipe characters in values are escaped as `\|`. The aggregator computes `avg_user_rating` and `feedback_count` per cohort.

### Supported AI Agents

- **Claude Code** (recommended): `claude` CLI with `--inputFile` for prompt delivery
- **GitHub Copilot CLI**: `copilot` CLI with stdin prompt delivery

### Metric Targets

| Metric | Target | Direction |
|--------|--------|-----------|
| `avg_confidence` | ≥ 90 | higher is better |
| `avg_task_completion_rate` | ≥ 0.95 | higher is better |
| `avg_blocker_count` | ≤ 1.5 | lower is better |
| `avg_completion_marker_success_rate` | ≥ 0.95 | higher is better |
| `avg_verification_failures_found` | ≤ 1.0 | lower is better |
| `archival_success_rate` | ≥ 0.99 | higher is better |
| `avg_user_rating` | ≥ 7.0 | higher is better |

Data stored in `.plan2code-metrics/` (runs/, aggregated.json, proposals/).

## Development Commands

```bash
# Install dev dependencies (sets up husky pre-commit hooks)
npm install

# Run the interactive installer (always interactive — any CLI args are silently ignored)
node install.js

# Plan2Code Loop
cd plan2code-loop && npm install   # First time setup
cd plan2code-loop && npm run build # Build the CLI

# Plan2Code Metrics
cd plan2code-metrics && npm install   # First time setup
cd plan2code-metrics && npm run build # Build the CLI
```

### Installer Menu Options

**Main menu:**

| Option | Action |
|--------|--------|
| `I` | Install Plan2Code for all platforms + loop CLI |
| `U` | Uninstall Plan2Code files + loop CLI (confirmation required) |
| `C` | Open CUSTOM sub-menu |
| `Q` | Quit |

**CUSTOM sub-menu (`C`):**

| Option | Action |
|--------|--------|
| `L` | Show local (per-project) install instructions |
| `O` | Install plan2code-loop CLI only |
| `M` | Install plan2code-metrics CLI only |
| `Q` | Return to main menu |

## How the Installer Works

1. **Reads source prompts** from `src/plan2code-*.md`
2. **Generates platform-specific files** with appropriate headers (YAML frontmatter for some platforms)
3. **Writes to `dist/`** subdirectories organized by destination type
4. **Copies to target directories** (global: `~/.claude/commands/`, etc.)

### Platform-Specific File Formats

| Platform | Extension / File | Local Dir | Global Dir | Header |
|----------|-----------------|-----------|------------|--------|
| Claude Code | `.md` | — | — | None |
| Cursor | `.md` | — | — | None |
| Copilot CLI | `.md` | — | — | YAML frontmatter |
| Continue | `.prompt.md` | — | — | YAML frontmatter |
| Windsurf | `.md` | — | — | YAML frontmatter |
| VS Code Copilot | `.prompt.md` | — | — | YAML frontmatter |
| Codeium | `.md` | — | — | YAML frontmatter |
| Claude Code (Skills) | `SKILL.md` in subdir | `.claude/skills/<skill-name>/` | `~/.claude/skills/<skill-name>/` | YAML frontmatter + `disable-model-invocation: true` |
| Agent Skills (Amp · Gemini CLI · OpenCode) | `SKILL.md` in subdir | `.agents/skills/<skill-name>/` | `~/.agents/skills/<skill-name>/` | YAML frontmatter (no disable flag) |
| Crush | `SKILL.md` in subdir | — (global only) | `~/.config/crush/skills/<skill-name>/` (Unix) / `%LOCALAPPDATA%\crush\skills\<skill-name>\` (Windows) | YAML frontmatter |
| Gemini CLI (TOML) | `.toml` | `.gemini/commands/` | `~/.gemini/commands/` | None (TOML fields: `description`, `prompt`) |

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

- **install.js:** CommonJS, Node.js built-ins only (no external deps), ANSI colors via `COLORS` constant, readline-based prompts
- **plan2code-loop & plan2code-metrics:** TypeScript + ESM, built with tsup (target ES2022, moduleResolution: bundler)
  - External deps: `@inquirer/prompts`, `chalk`, `execa`, `ora`
  - Interactive CLI via `@inquirer/prompts` (select, input, confirm)
- **File operations:** Synchronous fs in all packages

## Gotchas/Pitfalls

- **Version sync:** When adding a new version to `CHANGELOG.md`, also update `version.json` and `package.json` to match. The installer displays the version from `version.json` in its header.
- **Loop `.gitignore` setup:** `ensureGitignore()` runs at startup in `Controller.run()` as a pre-flight step, not just inside `createTaskCommit()`. This is critical for phase mode where the Node controller doesn't handle commits — without it, `git add -A` would stage spec files.
- **Workflow file character limit:** All `src/plan2code-*.md` files must be ≤ 11,000 characters. A husky pre-commit hook enforces this. The 11,000 limit leaves buffer for platform-specific YAML headers (106-142 chars) to stay under Windsurf's 12,000 char limit.
- **Metrics internal prompts have no char limit:** Files in `plan2code-metrics/src/prompts/` are NOT subject to the 11,000 char limit — only `src/plan2code-*.md` consumer-facing prompts are.
- **User Feedback table format:** The `## User Feedback` markdown table in `overview.md` has a strict format the collector regex depends on. Field names must be exactly `Rating`, `Reason`, `Went Well`, `Went Poorly`. Pipe characters in values must be escaped as `\|`.

## Git Commit Messages

- **AI Assisted footer:** All git commit messages must include `AI Assisted` as the final line, separated from the message body by a blank line
- **Commit paths:** This is enforced across all commit surfaces:
  - Loop task mode: `createTaskCommit()` in `plan2code-loop/src/utils/git.ts` appends the footer automatically
  - Loop phase mode: Prompt template instructs the LLM to add `-m "AI Assisted"` as the final flag
  - Implement mode: User-facing commit suggestions in `src/plan2code-3--implement.md` include the footer
- **Init workflow:** `src/plan2code---init.md` generates AGENTS.md files with a Git Commit Messages section that includes this convention by default

## Mascot

The project has a mascot called "Planny" - an ASCII art robot that appears in installer output and workflow prompts. Mascot variants are defined in `MASCOT` constant in `install.js` and appear in workflow markdown files.

```
   ╭───╮
   │ ● │
   │ ◡ │
   ╰───╯
```
