# Changelog

## 1.1.0

### Resume support
- Add `--resume` flag to continue incomplete runs from saved state
- Skip previously succeeded steps when resuming (init, plan, document, implement, finalize)
- Restore idea name, description, project directory, and implement pass counter from state
- Auto-detect state files in current directory (enhancement mode) or subdirectories (new-project mode)
- Delete state file automatically after a fully successful run
- Preserve state file on failure for later resume
- Add `deleteState()` and `findExistingState()` utilities to bot-state module
- Add bot-state unit tests (saveState, loadState, deleteState, findExistingState)

### Idea generation improvements
- Expand idea categories from binary CLI/web-app coin flip to 12 diverse categories (games, dashboards, browser extensions, desktop utilities, etc.)
- Add guidance to avoid defaulting to developer-centric tools (git analyzers, code formatters)
- Strengthen `--idea` seed clause so the LLM stays aligned with the user's theme instead of ignoring it
- Update system prompt to encourage creative, cross-domain ideas

### Init step overhaul (new projects)
- Init now creates a minimal AGENTS.md stub (name, description, status) instead of running the full `/plan2code-init` skill
- Prevents hallucinated architecture, commands, and `.agents-docs/` files before the plan step runs
- Init evaluation criteria updated to reward minimalism and penalize premature detail

### Implement step overhaul
- Implement step now works directly with Read/Write/Edit/Glob/Grep tools instead of delegating to Skill sub-session
- Inlined step-by-step process: find specs, pick phase, implement tasks, mark checkboxes
- Fixes issue where Skill sub-sessions did all work invisibly, causing zero tool observations

### Observation tracking fix
- Capture `tool_use` blocks from the assistant message stream in session-runner as a fallback when `canUseTool` callback doesn't fire
- Add deduplication in ObservationCollector to prevent double-counting from both sources
- Fixes all steps reporting 0 tools used / 0 files created in BOT-NOTES and evaluations

### Evaluator improvements
- Increase evaluator `maxTurns` from 3 to 30 so it has room for tool calls before producing the scored response
- Add warning log when evaluation parser can't find SCORE in output (was silently defaulting to 50)

## 1.0.0

- Initial release
- Two auto-detected modes: new-project and enhancement
- `--idea` flag to seed the idea generator
- Full workflow execution: init → plan → document → implement → finalize
- Artifact validation after each step
- State persistence to `.plan2code-bot-state.json`
- Auto-responder for autonomous Claude Agent SDK sessions
- Bot-friendly skill installation (strips `disable-model-invocation`)
