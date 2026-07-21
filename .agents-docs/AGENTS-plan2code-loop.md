# Plan2Code Loop
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

A separate Node.js CLI tool that autonomously implements specs by looping through tasks.

## Loop Architecture

The loop uses an **LLM-driven discovery** approach:
- Node app just orchestrates iterations and parses completion markers
- The LLM reads spec files (`overview.md`, `phase-X.md`) to discover tasks
- The LLM finds unchecked checkboxes, implements ONE task per iteration, marks it complete
- No regex parsing of markdown in Node - the AI handles all task discovery

## Loop Commands

```bash
# Build the loop CLI
cd plan2code-loop && npm run build

# Run the loop (after linking) - fully interactive
plan2code-loop
```

The CLI auto-detects specs in `./specs/`, prompts for selection if multiple found, and handles session continuation interactively. Session state is stored per-spec in `specs/<feature>/.plan2code-loop/`.

## Loop Modes

The CLI asks users to choose a loop mode:
- **One task per loop** (default) - Each agent invocation implements exactly one task. The Node controller handles git commits.
- **One phase per loop** - Each agent invocation implements all remaining tasks in the current phase. The LLM handles git commits (with JIRA ticket ID if provided). The controller parses multiple completion markers from a single iteration.

## Completion Markers

The LLM must output one of these formats:
- `TASK_COMPLETE: 1.1 - Task description` - Task done successfully
- `TASK_BLOCKED: 1.1 - Reason` - Cannot complete task
- `PHASE_COMPLETE` - Current phase finished (phase mode only)
- `LOOP_COMPLETE` - All phases finished

## Key Source Files

| File | Purpose |
|------|---------|
| `plan2code-loop/src/controller.ts` | Main loop orchestrator |
| `plan2code-loop/src/prompt/templates.ts` | Prompt templates for both loop modes |
| `plan2code-loop/src/utils/git.ts` | `createTaskCommit()` — handles task-mode commits with footer |
| `plan2code-loop/src/cli.ts` | Interactive CLI entry point |
