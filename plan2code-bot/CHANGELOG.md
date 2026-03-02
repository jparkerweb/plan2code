# Changelog

## 1.1.0

- Add `--resume` flag to continue incomplete runs from saved state
- Skip previously succeeded steps when resuming (init, plan, document, implement, finalize)
- Restore idea name, description, project directory, and implement pass counter from state
- Auto-detect state files in current directory (enhancement mode) or subdirectories (new-project mode)
- Delete state file automatically after a fully successful run
- Preserve state file on failure for later resume
- Add `deleteState()` and `findExistingState()` utilities to bot-state module
- Add bot-state unit tests (saveState, loadState, deleteState, findExistingState)

## 1.0.0

- Initial release
- Two auto-detected modes: new-project and enhancement
- `--idea` flag to seed the idea generator
- Full workflow execution: init → plan → document → implement → finalize
- Artifact validation after each step
- State persistence to `.plan2code-bot-state.json`
- Auto-responder for autonomous Claude Agent SDK sessions
- Bot-friendly skill installation (strips `disable-model-invocation`)
