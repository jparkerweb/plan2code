# plan2code-bot

Autonomous workflow test runner for plan2code. Uses the Claude Agent SDK to simulate a human running through the entire plan2code workflow (init, plan, document, implement, finalize) end-to-end.

## Two Modes (Auto-Detected)

1. **New Project Mode** — No `AGENTS.md` in cwd: generates an app idea, creates a subdirectory, writes IDEA.md, runs init, then all 4 steps.
2. **Enhancement Mode** — `AGENTS.md` exists in cwd: scans the existing codebase and proposes a realistic enhancement, writes IDEA.md, then runs plan through finalize.

## Installation

From the plan2code root:

```bash
node install.js
# Select C > B to install bot only, or I to install everything
```

Or manually:

```bash
cd plan2code-bot
npm install
npm run build
npm link
```

## Usage

```bash
# New project mode (run from an empty directory)
mkdir /tmp/test-bot && cd /tmp/test-bot
plan2code-bot

# Enhancement mode (run from an existing project with AGENTS.md)
cd my-project
plan2code-bot

# Seed the idea generator with a specific concept
plan2code-bot --idea "web app that displays the current weather as vector images"

# Resume a previous incomplete run
plan2code-bot --resume
```

### `--idea`

Pass a quoted string after `--idea` to seed the idea generator with a specific concept. The AI will use it as inspiration rather than generating a completely random idea. Wrap the value in double quotes so the shell treats it as a single argument.

```bash
# Specific app concept
plan2code-bot --idea "web app that displays the current weather as vector images"

# Short keyword to nudge the category
plan2code-bot --idea "markdown editor"

# Detailed constraint
plan2code-bot --idea "CLI tool that converts CSV files to SQLite databases with type inference"

# Works in enhancement mode too — guides what kind of enhancement to propose
cd my-existing-project
plan2code-bot --idea "add dark mode support"
```

Without `--idea`, the bot picks a random category (CLI tool or web app) and invents something on its own.

### `--resume`

Resume a previous incomplete run. The bot searches for a `.plan2code-bot-state.json` file in the current directory (enhancement mode) or in immediate subdirectories (new-project mode). If found, it restores the idea, config, and progress — skipping steps that already succeeded and continuing from where it left off.

```bash
# A run failed at the implement step — resume it
plan2code-bot --resume

# Can combine with --idea (idea is ignored when resuming since it's restored from state)
plan2code-bot --resume --idea "ignored when state exists"
```

If no state file is found, the bot starts a fresh run.

## How It Works

1. Detects mode based on presence of `AGENTS.md`
2. Generates an idea (new app or enhancement) via Claude, optionally guided by `--idea` seed
3. Writes `IDEA.md` to the project directory
4. Installs bot-friendly copies of plan2code skills (strips `disable-model-invocation` so sessions can invoke them)
5. Runs each workflow step as a separate Claude Agent SDK session:
   - **init** — generates `AGENTS.md` (new-project mode only)
   - **plan** — creates plan draft in `specs/<feature>/`
   - **document** — produces `overview.md` and `phase-*.md` files
   - **implement** — loops until all phases are complete (max 10 passes)
   - **finalize** — validates and archives to `specs--completed/`
6. Validates expected artifacts after each step (aborts on missing artifacts)
7. Moves `IDEA.md` into `specs/<feature>/` after the plan step so it stays with its feature
8. Auto-responds to `AskUserQuestion` prompts (approvals, testing gates, name questions)
9. Saves state to `.plan2code-bot-state.json` after each step

## State File

After each step, the bot saves its state to `.plan2code-bot-state.json` in the project directory. This includes the config, all step results, and progress tracking.

- **On full success** — the state file is automatically deleted (clean finish)
- **On failure/incomplete** — the state file is preserved so you can `--resume` later

## Development

```bash
npm run build    # Build with tsup
npm run dev      # Watch mode
npm test         # Run tests (vitest)
```
