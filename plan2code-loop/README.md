# Plan2Code Loop

An autonomous CLI tool that implements Plan2Code specs by looping through tasks automatically.

> **Note:** This is an **alternative** to `/plan2code-3--implement`, not a replacement. Use the manual Step 3 workflow when you want interactive control over each phase, or use this loop when you prefer hands-off autonomous execution.

## Installation

```bash
# From the plan2code root directory:

# Option 1: Install everything (recommended)
node install.js  # Select option A

# Option 2: Install loop only
node install.js  # Select option O

# Option 3: Manual build and link
cd plan2code-loop
npm install
npm run build
npm link
```

## Usage

Simply run the command - everything is interactive:

```bash
plan2code-loop
```

The CLI will:
1. Auto-detect specs in `./specs/` directory
2. Let you select a spec if multiple are found
3. Prompt to continue if an existing session is found
4. Ask for JIRA ticket ID, agent selection, and max iterations

## How It Works

The loop uses an **LLM-driven discovery** approach:

1. **Spec Selection** - Interactive menu to select from discovered specs
2. **Task Discovery** - The AI reads `overview.md` and phase files to find unchecked tasks
3. **Implementation** - The AI implements ONE task per iteration
4. **Checkbox Update** - The AI marks the task complete in the markdown file
5. **Scratchpad Update** - The AI appends notes to the per-spec scratchpad
6. **Completion Marker** - The AI outputs a structured marker (e.g., `TASK_COMPLETE: 1.1 - description`)
7. **Loop** - Repeat until all tasks done or max iterations reached

### Why LLM-Driven?

The Node app does NOT parse markdown to find tasks. Instead, the AI reads the spec files directly and decides what to work on. This is:

- **More flexible** - Works with any reasonable markdown format
- **Smarter** - AI can handle edge cases and ambiguity
- **Simpler** - Node code is just orchestration, not parsing

## Completion Markers

The AI must output one of these markers at the end of each iteration:

```
TASK_COMPLETE: 1.1 - Initialize project structure
TASK_BLOCKED: 2.3 - Missing API credentials
LOOP_COMPLETE
```

| Marker | Meaning |
|--------|---------|
| `TASK_COMPLETE: X.X - desc` | Task implemented and marked complete |
| `TASK_BLOCKED: X.X - reason` | Cannot complete task (explains why) |
| `LOOP_COMPLETE` | All phases finished |

## Session Files

Session state is stored **per-spec** inside the spec directory:

```
specs/my-feature/
├── overview.md
├── phase-1.md
├── phase-2.md
└── .plan2code-loop/        # Per-spec session state
    ├── config.json           # Session configuration
    ├── scratchpad.md         # LLM-managed progress notes
    ├── iteration.log         # JSON log of each iteration
    └── spec.hash             # Hash for detecting spec changes
```

The scratchpad is managed by the LLM itself - after each task, the AI appends notes about what was done, decisions made, and files changed. This helps future iterations skip exploration.

## Supported Agents

| Agent | Status |
|-------|--------|
| Claude Code | Supported |
| GitHub Copilot CLI | Supported |

The loop uses your configured default model for each agent.

## Example Session

```
$ plan2code-loop

    ╭──────────────────────────────────────╮
    │                                      │
    │   🔮  Plany's Loop               │
    │       Autonomous Implementation      │
    │                                      │
    ╰──────────────────────────────────────╯

Found spec: specs/todo-app
  Feature: Todo App
  Phases: 0/3
  Tasks: 0/15

══════════════════════════════════════════════
Spec: Todo App
══════════════════════════════════════════════
Phases: 0/3
Tasks: 0/15

? JIRA Ticket ID (optional): PROJ-123
? Select AI agent: Claude Code
? Maximum iterations: 100

Starting Plan2Code Loop
══════════════════════════════════════════════
Agent: Claude Code
Model: default
Spec: C:\projects\my-app\specs\todo-app
Max iterations: 100

Iteration 1/100
[1/100] Task 1.1: Initialize project with Vite (45s)
✓ Completed: Task 1.1: Initialize project with Vite

Iteration 2/100
[2/100] Task 1.2: Configure TypeScript (32s)
✓ Completed: Task 1.2: Configure TypeScript

...

Session Summary
══════════════════════════════════════════════
Total iterations: 12
Tasks completed: 12
Exit reason: all_complete

Session files saved to specs/todo-app/.plan2code-loop:
  - config.json (session configuration)
  - scratchpad.md (LLM-managed notes)
  - iteration.log (history)
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Link for global usage
npm link

# Unlink
npm unlink
```

## Architecture

```
src/
├── bin/plan2code-loop.ts   # CLI entry point
├── index.ts                  # Main exports
├── controller.ts             # Loop orchestration
├── cli.ts                    # Interactive prompts
├── agents/                   # Agent implementations
│   ├── claude-code.ts
│   └── copilot-cli.ts
├── prompt/                   # Prompt building
│   ├── templates.ts
│   └── builder.ts
├── state/                    # Session state management
│   └── manager.ts
├── spec/                     # Spec utilities (for CLI display)
│   └── utils.ts
└── utils/                    # Utilities
    ├── completion.ts         # Marker parsing
    └── logger.ts
```
