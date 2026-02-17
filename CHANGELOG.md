# Changelog

All notable changes to Plan2Code will be documented in this file.

## v1.5.4

### ✨ Added

- **AI Assisted commit attribution** - All git commit messages now include an `AI Assisted` footer for transparency
  - **Init mode** - Generated AGENTS.md files include a Git Commit Messages section instructing agents to always append `AI Assisted`
  - **Init-update mode** - New "Git Commit Messages" menu option (option 7) for adding or modifying commit message conventions
  - **Loop task mode** - `createTaskCommit()` automatically appends `AI Assisted` footer to every commit
  - **Loop phase mode** - Prompt template instructs LLM to include `-m "AI Assisted"` as final flag on every commit
  - **Implement mode** - User-facing git commit suggestions after phase approval include `-m "AI Assisted"`

### 🔧 Changed

- **README loop install instructions** - Replaced inline text with formatted code block showing both install options

## v1.5.3

### ✨ Added

- **Loop mode selection** - Plan2Code Loop now asks users to choose between two loop modes:
  - **One task per loop** (default) - Each agent invocation implements exactly one task. Node controller handles git commits after each task. Same behavior as before.
  - **One phase per loop** - Each agent invocation implements all remaining tasks in the current phase. The LLM handles git commits after each task (with JIRA ticket ID). Ideal for related tasks and smart models with higher context windows.
- **Phase-mode prompt template** - New `LOOP_PROMPT_TEMPLATE_PHASE` instructs the LLM to complete all tasks in the current phase, create git commits per task, and output `TASK_COMPLETE` markers for each
- **Multi-marker completion detection** - New `checkForAllCompletions()` function parses all `TASK_COMPLETE`, `TASK_BLOCKED`, and `PREREQ_COMPLETE` markers from a single agent output
- **`PHASE_COMPLETE` marker** - New completion marker for phase mode indicating current phase is done (distinct from `LOOP_COMPLETE` which means all phases done)
- **`loopMode` config field** - New `SessionConfig.loopMode` field (`'task' | 'phase'`) persisted in session state for resume support
- **Documentation auto-discovery** - Documentation workflow now auto-discovers features to document
  - Automatically finds `specs/*/PLAN-DRAFT-*.md` files
  - If only one feature exists, uses it without prompting
  - If multiple features exist, presents list and asks user to choose
  - Automatically reads `PLAN-CONVERSATION-*.md` if present (optional, for context)
- **Documentation Verification Pass** - Documentation workflow now cross-references against PLAN-DRAFT before finalizing
  - New Process Step 7 with sub-steps: 7A (re-read PLAN-DRAFT), 7B (cross-reference sections), 7C (fix gaps), 7D (output summary)
  - New "Documentation Verification Pass" section with mapping table showing which PLAN-DRAFT sections to verify against which spec files
  - Gap handling: Missing items added with `<!-- VERIFICATION: Added - FR-X from PLAN-DRAFT -->` markers
  - Session end output now includes verification summary table showing Items in PLAN-DRAFT / Covered / Added per section
  - Added reminders: "Always run verification pass before finalizing" and "PLAN-DRAFT is the source of truth"
- **Conversation Logging** - Planning workflow now saves the full planning conversation before creating PLAN-DRAFT
  - New file: `specs/<feature-name>/PLAN-CONVERSATION-<YYYYMMDD>.md` created in Phase 7
  - Contains full conversation transcript organized by phase with speaker attribution (`[AGENT]` vs `[USER RESPONSE]`)
  - Decision summary tables with user quotes, confirmed requirements, approved technologies, and assumptions
  - Serves as source of truth for plan verification
- **PLAN-DRAFT Verification Pass** - New STEP 7C verifies PLAN-DRAFT against conversation log
  - Cross-references all requirements, tech decisions, risks, and assumptions
  - Missing items added with `<!-- VERIFICATION: Added from Phase X -->` markers
  - Outputs verification summary showing what was captured vs added
- **Conversation Log field in PLAN-DRAFT** - New header field links to the conversation log file

### 🔧 Changed

- **Installer default option** - Pressing Enter without selecting an option now defaults to `A` (Install to ALL platforms + loop CLI) instead of quitting
- **Planning output location changed** - PLAN-DRAFT and conversation log now created in feature subdirectory
  - New location: `specs/<feature-name>/PLAN-DRAFT-<date>.md` and `specs/<feature-name>/PLAN-CONVERSATION-<date>.md`
  - Date format: YYYYMMDD (e.g., `20250204`) instead of full timestamp
  - Uppercase `PLAN-CONVERSATION` for consistency with `PLAN-DRAFT`
  - Feature directory created during planning (Step 1) instead of documentation (Step 2)
  - Documentation step no longer archives PLAN-DRAFT (already in correct location)
- **Planning Phase 7 restructured** - Now has three sub-steps:
  - STEP 7A: Save Conversation Log (new)
  - STEP 7B: Create PLAN-DRAFT (existing behavior, uses same timestamp)
  - STEP 7C: Verification Pass (new)
- **Session End example updated** - Now shows both conversation log and PLAN-DRAFT files
- **Important Reminders expanded** - Added reminders about conversation log and verification pass

### 🐛 Fixed

- **`.gitignore` missing `specs/` entries in phase mode** - `ensureGitignore()` only ran inside `createTaskCommit()`, which is never called in phase mode. Moved `ensureGitRepo()` and `ensureGitignore()` to run once at startup in `Controller.run()` as a pre-flight step, ensuring `.gitignore` entries are set before the first iteration regardless of loop mode

## v1.5.2

### ✨ Added

- **AI Agent File Sync** - Init and Init-Update workflows now detect and sync other AI agent config files
  - Detects 6 file types: CLAUDE.md, GEMINI.md, .cursorrules, .github/copilot-instructions.md, .cursor/rules/, .windsurf/rules/
  - Offers to replace with references to AGENTS.md as single source of truth
  - User confirmation required before any modifications
  - Correct relative paths for each file location (./AGENTS.md, ../AGENTS.md, ../../AGENTS.md)
- **Knowledge Transfer** - Init mode now uses existing CLAUDE.md content as context when creating new AGENTS.md
  - Preserves project knowledge during migration to AGENTS.md

## v1.5.1

### ✨ Added

- **Prerequisite verification workflow** - Agents now verify/complete prerequisites before starting phase tasks
  - Implementation mode processes prerequisites in order: verify, complete, or mark assumed
  - Loop prompt treats prerequisites as "Task 0.X" - one per iteration before tasks
  - New completion markers: `PREREQ_COMPLETE` and `PREREQ_ASSUMED`
- **New checkbox state `[?]`** - "Assumed complete, couldn't verify" for prerequisites that can't be validated
  - Use when prerequisite cannot be programmatically verified (e.g., "Design approved by stakeholder")
  - Agents skip `[?]` items like `[x]` items
- **Re-opened phase handling in Revision mode** - Properly handle adding tasks to completed phases
  - New "Re-opening" impact type (Medium-High risk) in impact assessment
  - New tasks in completed phases get `🆕 ADDED` flag
  - Phase checkbox changes from `[x]` to `[ ]` in overview.md when new tasks added
  - "Phases Re-opened" section in revision summary
  - Consistency check now verifies phase completion status matches task completion

### 🔧 Changed

- **Installer UI refresh** - Cleaner, narrower layout for better terminal compatibility
  - Narrower menu boxes (65 characters instead of 76)
  - Smaller mascot display at end of installation
  - Added first-time user documentation link after successful install
  - Updated menu descriptions to show "+ loop CLI" for relevant options
- **Planning workflow guardrails** - Prevent users from skipping the documentation step
  - Added critical reminder after Phase 7 to direct to `/plan2code-2--document`
  - Added workflow order reminder in Session End section: Plan → Document → Implement → Finalize
  - Updated example closing message to emphasize documentation as next step
  - Added workflow order to Important Reminders section
- **AGENTS.md pre-flight message** - Improved guidance for new projects
  - Message now explains that new projects can continue without AGENTS.md
  - Suggests creating basic AGENTS.md first with rules can still be valuable

## v1.5.0 - 2026-01-22

### ✨ Added

- **Plan2Code Loop** - New autonomous CLI tool for hands-off spec implementation
  - Separate Node.js/TypeScript tool in `plan2code-loop/` directory
  - LLM-driven task discovery - AI reads spec files and finds unchecked tasks
  - Iterates through tasks one at a time, marking checkboxes as complete
  - Structured completion markers: `TASK_COMPLETE: 1.1 - description`
  - Session persistence with scratchpad and iteration logging
  - Supports Claude Code and GitHub Copilot CLI agents
- **Installer integration** for loop CLI
  - Option `A` now installs prompts to all platforms AND builds/links the loop CLI
  - Option `O` builds and links plan2code-loop CLI only
  - Option `U` uninstalls prompts AND unlinks the loop CLI

### 📝 Documentation

- Updated README.md with "Autonomous Loop" section explaining when to use loop vs manual Step 3
- Updated QUICK-REFERENCE.md with loop commands and decision tree
- Updated AGENTS.md with loop architecture, commands, and completion markers

## v1.4.0 - 2026-01-09

### ✨ Added

- **Parallel Phase Execution** - Run multiple implementation phases simultaneously in separate agent instances
  - Documentation Mode auto-detects parallel-eligible phases based on file conflicts and dependencies
  - Implementation Mode presents phase selection UI when parallel options are available
  - New "Parallel Execution Groups" section in `overview.md` tracks which phases can run together
  - Conflict detection criteria: file overlap, prerequisite dependencies, data/output dependencies, shared state
  - Users can start multiple `/plan2code-3--implement` sessions to work on different parallel phases
- **In-Progress Phase Tracking** - Track which phases are actively being worked on
  - New `[/]` checkbox status indicates a phase is in-progress (between `[ ]` pending and `[x]` complete)
  - Phases marked `[/]` when an agent starts working, `[x]` when user approves completion
  - Aborted phases stay `[/]` to enable resume - never reset back to `[ ]`
  - Parallel selection UI shows `[IN PROGRESS]` vs `[AVAILABLE]` status for each phase
  - Single in-progress phase prompts user to confirm resume (prevents accidental overlap)
  - Supports multiple agent sessions on parallel phases with clear visibility of what's active

### 🔧 Changed

- **Documentation Mode process** - Added step 6 "Analyze phases for parallel execution eligibility"
- **Implementation Mode detection** - Now checks for parallel siblings before starting phase
- **Implementation Mode phase selection** - 4-case decision logic for parallel, resume, auto-start scenarios
- **Session end summaries** - Documentation Mode now reports parallel execution groups
- **Abort handling** - Phases remain `[/]` on abort with clear resume instructions

## v1.3.3 - 2025-12-30

### ✨ Added

- **Learning Capture Protocol** - Replaced simple "Session Hint" with structured learning capture
  - Auto-capture triggers checklist (undocumented commands, gotchas, patterns, workarounds)
  - Formatted capture template with category, learning, and context
  - Inline `AGENTS.md` updates without requiring init-update mode switch
  - Applied to Implementation (Step 3) and Finalize (Step 4) modes

### 🔧 Changed

- **Archive path includes timestamp** - Specs now archived to `specs--completed/<feature-name>-<timestamp>/`
  - Prevents overwriting when re-implementing same feature
  - Preserves history of multiple implementation attempts
- **Clearer session end instructions** - Planning mode (Step 1) now explicitly says "ALWAYS tell the user"
- **Simplified next command reference** - Removed "or equivalent" from next step instructions

## v1.3.2 - 2025-12-25


### 🔧 Changed

- **Phase file naming convention** - Changed from `Phase X.md` to `phase-X.md` (lowercase, hyphen instead of space)
  - Affects generated spec files in `specs/<feature-name>/`
  - Updated references in documentation, implementation, and finalization modes
- **PLAN-DRAFT auto-archiving** - Planning documents are now automatically archived without prompting
  - Moves `specs/PLAN-DRAFT-<timestamp>.md` to `specs/<feature-name>/PLAN-DRAFT.md` after documentation step
  - Removed user prompt asking to delete/archive/keep

### 📦 Updated

- Improved uniformity of Prompt files

## v1.3.1 - 2025-12-19

### ✨ Added

- **Init-update mode** (`/plan2code---init-update`) - Interactive workflow to update existing AGENTS.md files
  - Detects recent work context and suggests relevant additions
  - Menu-driven update options: Commands, Architecture, Gotchas, Testing, Environment, General Rules
  - Review and prune options for existing content
  - Confirms changes before applying
  - Prefix: None (utility command)
- **Session hints** in Steps 2, 3, 4 - Prompts to run `/plan2code---init-update` after discovering project insights
- **AGENTS.md pre-flight check** in Quick Task and Planning modes
  - Checks for `./AGENTS.md` at session start
  - Offers to run `/plan2code---init` before continuing if not found
- **VS Code Copilot global support** - New platform for VS Code's custom prompts feature
  - Files installed to platform-specific VS Code config directory:
    - Windows: `%APPDATA%\Code\User\prompts\`
    - macOS: `~/Library/Application Support/Code/User/prompts/`
    - Linux: `~/.config/Code/User/prompts/`
  - Uses VS Code custom prompt format with `agent: agent` header
  - File extension: `.prompt.md`
  - Platform ID: `vscode-copilot`
- **Dynamic path resolution in install.js** - Added helper functions for targets with platform-specific paths
  - `getVSCodeCopilotDir()` - Returns correct VS Code config path per platform
  - `resolveTargetDir()` - Handles both static and dynamic directory configurations
  - `getDisplayPath()` - Returns human-readable path for display

### 🔧 Changed

- **install.js interactive menu** - Now shows 6 platforms (added VS Code Copilot)
- **Help text updated** - Valid platform IDs now include `vscode-copilot`
- **Merged `sync-prompts.js` into `install.js`** - Distribution files are now generated on-the-fly
  - No longer need to run a separate sync script before installation
  - `dist/` folder is now gitignored (generated dynamically)
  - Removed `src/sync-prompts.js` (functionality merged into `install.js`)
- **Added `--local` option** - Show instructions for project-level (local) installation
  - Generates `dist/local-commands/` and displays copy/paste instructions
  - Available via `node install.js --local` or interactive menu option `L`
- **Updated interactive menu** - Added "L. LOCAL" option for local installation instructions

### 🗑️ Removed

- **`src/sync-prompts.js`** - No longer needed; functionality merged into `install.js`
- **`dist/` from version control** - Now generated dynamically during installation

## v1.3.0 - 2025-12-18

### ✨ Added

- **AGENTS.md Integration** - All workflow prompts now check for and follow project-specific agent instructions
  - Added rule: "If a `./AGENTS.md` file exists, follow the rules, guidelines and documentation in it"
  - Applied to Steps 1, 2, 3, and 4 (plan, document, implement, finalize)
  - Enables project-specific customization while maintaining consistent workflow methodology
- **Init mode** (`/plan2code---init`) - New command to generate AGENTS.md files for projects
  - Analyzes codebase structure and common development commands
  - Extracts important details from existing docs (README, PROJECT.md, etc.)
  - Creates focused, actionable guidance for AI agents (under 500 lines)
  - Prefix: None (utility command)

### 🔧 Changed

- **Moved source prompts to `src/` directory** - Cleaner project structure separating source files from distribution
  - All `plan2code-*.md` files now live in `src/`
  - `sync-prompts.js` moved to `src/sync-prompts.js`
  - Run with `node src/sync-prompts.js` (was `node sync-prompts.js`)
  - `install.js` remains in project root
- **Sync script now cleans dist folders before syncing** - Ensures no orphaned files from previous syncs
  - Deletes `dist/local-commands/` and `dist/global-commands/` before regenerating
  - Prevents old/renamed files from lingering in distribution
- **Added `version.json`** - Centralized project metadata file
  - Contains name, version, description, author, license, etc.
  - Version displayed in install.js TUI header
- **Renamed Quick Task command** - `plan2code-0--quick-task` → `plan2code---quick-task`
  - Removed number prefix for better categorization (utility/standalone mode)
  - Maintains same functionality (lightweight planning for small tasks)
- **Renamed Revision command** - `plan2code-1b--revise` → `plan2code-1b--revise-plan`
  - Clearer name indicating it revises planning specs
  - Maintains same functionality (modify specs mid-implementation)

### 📚 Documentation

- Commands table updated to reflect new naming convention
- README.md updated with new command references and `src/` paths
- QUICK-REFERENCE.md updated with new command names
- CLAUDE.md updated with new development commands and file locations
- **Landing page updated** (`docs/index.html`)
  - Added terminal UI screenshot showing the interactive installer
  - Added code block with full installation steps (clone, cd, run)

## v1.2.1 - 2025-12-17

### 🔧 Changed

- **Reorganized distribution files into `dist/` folder** - Cleaner project structure separating source from generated files
  - `local-commands/` → `dist/local-commands/`
  - `global-commands/` → `dist/global-commands/`
- **Updated `sync-prompts.js`** - Now outputs to `dist/local-commands/` and `dist/global-commands/`
- **Updated `install.js`** - Now reads from `dist/global-commands/`
- **Simplified implement/finalize workflow** - Now only requires `overview.md` path instead of both `overview.md` and `Phase X.md`
  - Auto-detects next uncompleted phase from Phase Checklist in overview.md
  - Automatically reads corresponding `Phase X.md` file
  - Reduces user friction when continuing between phases
- **Updated Next Steps sections** across all prompts to show simplified workflow
  - Step 2 (Document): Now instructs to provide only `overview.md`
  - Step 1b (Revise): Now instructs to provide only `overview.md`
  - Step 3 (Implement): Session end boxes updated with auto-detect messaging
  - Step 4 (Finalize): Incomplete implementation box updated

### 📚 Documentation

- Updated CLAUDE.md with new `dist/` paths for all references
- Updated README.md installation commands (30+ path references updated for both Unix and Windows)
- Updated QUICK-REFERENCE.md commands table (Steps 3 & 4 now show `overview.md` as input)
- Updated README.md workflow examples to show new `[Provide: overview.md]` pattern
- Updated README.md "What to Attach" table with simplified requirements
- Updated README.md troubleshooting section

## v1.2.0 - 2025-12-14

### ✨ Added

- **Quick Task mode** (`/plan2code-0--quick-task`) - Lightweight planning for small tasks that don't need the full 4-step workflow
  - Standalone mode (doesn't create spec files)
  - Conversational output with implementation plan
  - **Scope validation** with thresholds (≤3 components, ≤2 integrations, ≤15 tasks, ≤8 files)
  - **Escalation path** to full planning - creates PLAN-DRAFT and hands off to Step 1
  - Prefix: `🚀`
- **Revision mode** (`/plan2code-1b--revise`) - Structured way to modify specs mid-implementation
  - 5-step formal process: Change Analysis → Impact Assessment → Execute Revisions → Consistency Check → Summary
  - Batch approval workflow
  - Tracks revision history in overview.md
  - Prefix: `🔄 [REVISION]`
- **Requirements Sign-Off gate** in Planning Phase 1 - User must explicitly approve requirements before Phase 2
- **Escalated PLAN-DRAFT recognition** - Planning mode detects and resumes from Quick Task escalations
- **Good/bad examples** added to Steps 1, 3, and 4 for clearer AI guidance
- **Clarification loop protocol** in Step 1 with max 3 rounds per phase
- **Devil's Advocate check** in Planning Phase 5 (Architecture Design)
- **Error recovery tables** in all prompts' Abort Handling sections
- **Quick Reference card** (`QUICK-REFERENCE.md`) for at-a-glance command reference
- **Revision reminders** in Step 3 completion messages
- **Copilot CLI global support** - Now installs to `~/.copilot/agents/` for global access
- **`install.js`** - New interactive installation script for global setup
  - Interactive menu when run without arguments
  - Select individual platforms (1-5), multiple (comma-separated), or ALL (A)
  - Uninstall option (U) to remove installed files
  - Non-interactive flags: `--platform X`, `--dry-run`, `--uninstall`
- **`local-commands/`** directory - Pre-formatted files for project installation
- **`global-commands/`** directory - Pre-formatted files for home directory installation

### 🔧 Changed

- **Standardized section headers** across all prompts:
  - Role → Rules → Examples → Process → Templates → Session End → Abort Handling → Recovery → Important Reminders
- **Condensed templates** for token efficiency (~30% reduction in template verbosity)
- **`sync-prompts.js` restructured** - Now only writes to `local-commands/` and `global-commands/` (removed project root platform directories)
- **Removed platform directories from project root** - No longer syncs to `.claude/`, `.cursor/`, etc. in project root; users copy from `local-commands/` or `global-commands/` instead
- Updated README.md with Quick Reference section and new commands table
- Updated CLAUDE.md with new commands and response prefixes

### 📚 Documentation

- Added QUICK-REFERENCE.md with commands table, mode prefixes, file structure, and troubleshooting
- Expanded README.md workflow table to include Steps 0, 1b
- Updated all installation instructions to use `local-commands/` and `global-commands/`
- Added interactive mode documentation for `install.js`
- Documented Copilot CLI global installation at `~/.copilot/agents/`

## v1.1.1 - 2025-12-11

### 🔧 Changed

- **Phase approval prompt now uses ASCII box** - The "Reply approved" request during implementation sign-off now matches the visual style of other important prompts
- **Cursor: Switched from Rules to Commands** - Now uses `.cursor/commands/` (slash commands) instead of `.cursor/rules/` (MDC rules)
  - Commands support global installation at `~/.cursor/commands/`
  - Better aligns with how other tools handle workflows/slash commands
- **Archived specs folder renamed** - Changed from `specs/completed/` to `specs--completed/`
  - Simplifies folder structure by avoiding nested directories
  - Eliminates need for exclusion rules when searching `specs/`

### 📚 Documentation

- **Corrected global installation support** - Verified which tools actually support global installation:
  - ✅ **Claude Code**: `~/.claude/commands/`
  - ✅ **Cursor**: `~/.cursor/commands/` (commands, not rules)
  - ✅ **Continue**: `~/.continue/prompts/`
  - ✅ **Windsurf**: `~/.codeium/windsurf/global_workflows/`
  - ❌ **GitHub Copilot**: Project-only (`.github/agents/` and `.github/prompts/`)
  - ❌ **Antigravity**: Project-only (`.agent/workflows/`) - global path not well documented
- Updated Quick Start commands to only include tools that support global installation
- Added Windows-specific installation commands (PowerShell and Command Prompt)
- Added troubleshooting entry for unrecognized slash commands/workflows

## v1.1.0 - 2025-12-11

### ✨ Added

- **Testing Strategy support** - Optional testing preferences during planning phase
  - Test types selection (Unit, Integration, E2E, or None)
  - Phase testing option (run tests at end of each phase)
  - Coverage target selection (Critical paths, Moderate, Comprehensive)
  - Testing tasks automatically added to phase specs when enabled
- **User sign-off requirement** for implementation phases
  - Phases marked "Ready for Sign-Off" instead of auto-completing
  - User must reply "approved" before phase is marked complete
  - Test failure handling: user chooses to fix, document, or investigate
- **Enhanced overview.md structure** - Now includes:
  - Architecture Pattern and Component Overview sections
  - Risks and Mitigations table
  - Success Criteria checklist
- **Improved "Next Steps" formatting** - ASCII box format for clearer guidance at workflow transitions

### 🔧 Changed

- Implementation mode no longer auto-marks phases complete; requires explicit user approval
- Self-review checklist now includes test execution verification
- Completion report format updated to show test results table when applicable
- Spec auto-detection now explicitly excludes `specs--completed/` folder

### 📚 Documentation

- Added Testing Strategy section (2.4) to PLAN-DRAFT template
- Added Phase Testing task block template for phase specs
- Expanded special cases documentation for testing task generation

## v1.0.4 - 2025-12-07

### 📦 Updated

- Added explicit transition check to `Planning Phase 6` - when confidence >= 90%, the model now asks the user for confirmation before proceeding to create the PLAN-DRAFT document

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
