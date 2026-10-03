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

Run `plan2code-loop` in a project (fully interactive, no flags). Build commands: see [Development Commands](./AGENTS-development-commands.md).

The CLI auto-detects specs in `./specs/`, prompts for selection if multiple found, and handles session continuation interactively. Only `specs/<feature>/overview.md` is detected; archived specs in `specs--completed/` are ignored. Session state is stored per-spec in `specs/<feature>/.plan2code-loop/`.

Exit codes: 0 all complete, 1 max iterations, 2 interrupted (SIGINT/SIGTERM saves state), 3 error. The state dir holds `config.json`, `scratchpad.md` (LLM notes), `iteration.log` (NDJSON) and `spec.hash` (a mismatch prompts "Start fresh?"). Defaults: 100 max iterations, 3 min timeout, 5 retries.

## Supported Agents

Claude Code, GitHub Copilot CLI, Devin CLI, defined in `plan2code-loop/src/agents/` (one file each, registered in `agents/index.ts`).

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
- `PREREQ_COMPLETE: P1.1 - Description` - Prerequisite verified
- `PREREQ_ASSUMED: P2.1 - Description` - Prerequisite that cannot be verified, assumed met

Parsing is in `utils/completion.ts` and is lenient: `TASK_COMPLETE: 1.1: x` and `TASK_COMPLETE[1.1]: x` also match.

## Key Source Files

| File | Purpose |
|------|---------|
| `plan2code-loop/src/controller.ts` | Main loop orchestrator |
| `plan2code-loop/src/prompt/templates.ts` | Prompt templates for both loop modes |
| `plan2code-loop/src/utils/git.ts` | `createTaskCommit()` — handles task-mode commits with footer |
| `plan2code-loop/src/cli.ts` | Interactive session setup (spec, agent, JIRA ID, loop mode, max iterations, resume/fresh) |
| `plan2code-loop/src/utils/completion.ts` | Marker parsing (`checkForCompletion` task mode, `checkForAllCompletions` phase mode) |
| `plan2code-loop/src/state/manager.ts` | Per-spec state dir, spec hash, iteration log |
| `plan2code-loop/src/agents/` | Agent adapters (claude-code, copilot-cli, devin-cli) |
