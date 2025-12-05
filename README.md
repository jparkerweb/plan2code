# Plan2Code: AI-Assisted Software Development Workflow

A structured 4-step workflow for developing features and projects with AI assistance. This methodology emphasizes thorough planning before implementation, ensuring well-documented, maintainable code.

<img src="docs/plan2code.jpg" alt="Plan2Code Workflow" width="600">

## Overview

```
        🤔                     📝                     ⚡                     🧹
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Step 1        │     │   Step 2        │     │   Step 3        │     │   Step 4        │
│   PLAN          │ --> │   DOCUMENT      │ --> │   IMPLEMENT     │ --> │   FINALIZE      │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
      New Chat               New Chat           New Chat (per phase)        New Chat
```

| Step | File                        | Purpose                                        |
| ---- | --------------------------- | ---------------------------------------------- |
| 1    | `plan2code-1--plan.md`      | Requirements analysis and architecture design  |
| 2    | `plan2code-2--document.md`  | Create structured implementation documentation |
| 3    | `plan2code-3--implement.md` | Execute the implementation phase by phase      |
| 4    | `plan2code-4--finalize.md`  | Validate, summarize, and archive               |

---

## Installation

This repository includes pre-configured workflow files for all major AI coding assistants. Choose your platform and follow the setup instructions below.

### Supported Platforms

| Platform                                   | Directory              | Invocation                                                                                          | Status |
| ------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------- | ------ |
| [Claude Code CLI](#claude-code-cli)        | `.claude/commands/`    | `/plan2code-1--plan`, `/plan2code-2--document`, `/plan2code-3--implement`, `/plan2code-4--finalize` | Ready  |
| [GitHub Copilot CLI](#github-copilot-cli)  | `.github/agents/`      | `--agent=plan2code-1--plan` or `/agent plan2code-1--plan`                                           | Ready  |
| [VS Code Copilot](#vs-code-github-copilot) | `.github/prompts/`     | Slash commands in chat                                                                              | Ready  |
| [Windsurf IDE](#windsurf-ide)              | `.windsurf/workflows/` | `/plan2code-1--plan`, `/plan2code-2--document`, `/plan2code-3--implement`, `/plan2code-4--finalize` | Ready  |
| [Cursor AI](#cursor-ai)                    | `.cursor/rules/`       | Command palette or auto-apply                                                                       | Ready  |
| [Google Antigravity](#google-antigravity)  | `.agent/workflows/`    | `/plan2code-1--plan`, `/plan2code-2--document`, `/plan2code-3--implement`, `/plan2code-4--finalize` | Ready  |
| [Continue](#continue-vs-codejetbrains)     | `.continue/prompts/`   | `/plan2code-1--plan`, `/plan2code-2--document`, `/plan2code-3--implement`, `/plan2code-4--finalize` | Ready  |

### Quick Start

**Option A: Clone and copy to your project**

```bash
# Clone the repository
git clone https://github.com/your-username/plan2code.git

# Copy the platform-specific directory to your project
# Example for Claude Code:
cp -r plan2code/.claude your-project/

# Example for Cursor:
cp -r plan2code/.cursor your-project/
```

**Option B: Copy individual platform directories**

Download only the directories you need for your AI coding tool.

---

<details>
<summary>Claude Code CLI</summary>

**Location:** `.claude/commands/`

**Setup:**

1. Copy the `.claude/commands/` directory to your project root
2. Restart Claude Code or start a new session

**Files:**

```
.claude/commands/
├── plan2code-1--plan.md       # Step 1: Planning
├── plan2code-2--document.md   # Step 2: Documentation
├── plan2code-3--implement.md  # Step 3: Implementation
└── plan2code-4--finalize.md   # Step 4: Finalization
```

**Usage:**

```bash
/plan2code-1--plan           # Start planning a new feature
/plan2code-2--document       # Create implementation docs from plan
/plan2code-3--implement      # Begin/continue implementation
/plan2code-4--finalize       # Wrap up after all phases complete
```

**Documentation:** [Claude Code Slash Commands](https://code.claude.com/docs/en/slash-commands)

</details>

---

<details>
<summary>GitHub Copilot CLI</summary>

**Location:** `.github/agents/`

**Setup:**

1. Copy the `.github/agents/` directory to your project root
2. Ensure GitHub Copilot CLI is installed: `npm install -g @github/copilot@latest`

**Files:**

```
.github/agents/
├── plan2code-1--plan.agent.md       # Step 1: Planning
├── plan2code-2--document.agent.md   # Step 2: Documentation
├── plan2code-3--implement.agent.md  # Step 3: Implementation
└── plan2code-4--finalize.agent.md   # Step 4: Finalization
```

**Usage:**

```bash
# Using --agent flag
copilot --agent=plan2code-1--plan --prompt "I want to build a REST API"

# Using slash commands in interactive mode
copilot
> /agent plan2code-1--plan
```

**Documentation:** [GitHub Copilot CLI Custom Agents](https://docs.github.com/en/copilot/concepts/agents/about-copilot-cli)

</details>

---

<details>
<summary>VS Code GitHub Copilot</summary>

**Location:** `.github/prompts/`

**Setup:**

1. Copy the `.github/prompts/` directory to your project root
2. Open VS Code and ensure GitHub Copilot extension is installed
3. Prompts are automatically recognized

**Files:**

```
.github/prompts/
├── plan2code-1--plan.prompt.md       # Step 1: Planning
├── plan2code-2--document.prompt.md   # Step 2: Documentation
├── plan2code-3--implement.prompt.md  # Step 3: Implementation
└── plan2code-4--finalize.prompt.md   # Step 4: Finalization
```

**File Format:**

```yaml
---
mode: agent
description: "Plan2Code Step 1: Planning Mode"
---
[prompt content]
```

**Usage:**

- Open Copilot Chat (Ctrl+Shift+I or Cmd+Shift+I)
- Type `/` to see available prompts
- Select the desired workflow step

**Documentation:** [VS Code Copilot Prompt Files](https://code.visualstudio.com/docs/copilot/customization/prompt-files)

</details>

---

<details>
<summary>Windsurf IDE</summary>

**Location:** `.windsurf/workflows/`

**Setup:**

1. Copy the `.windsurf/workflows/` directory to your project root
2. Workflows appear automatically in Cascade

**Files:**

```
.windsurf/workflows/
├── plan2code-1--plan.md       # Step 1: Planning
├── plan2code-2--document.md   # Step 2: Documentation
├── plan2code-3--implement.md  # Step 3: Implementation
└── plan2code-4--finalize.md   # Step 4: Finalization
```

**Note:** Windsurf has a 12,000 character limit per workflow file.

**Usage:**

- In Cascade, type `/plan2code-1--plan` to invoke the planning workflow

**Documentation:** [Windsurf Workflows](https://docs.windsurf.com/windsurf/cascade/workflows)

</details>

---

<details>
<summary>Cursor AI</summary>

**Location:** `.cursor/rules/`

**Setup:**

1. Copy the `.cursor/rules/` directory to your project root
2. Rules are recognized automatically

**Files:**

```
.cursor/rules/
├── plan2code-1--plan.mdc       # Step 1: Planning
├── plan2code-2--document.mdc   # Step 2: Documentation
├── plan2code-3--implement.mdc  # Step 3: Implementation
└── plan2code-4--finalize.mdc   # Step 4: Finalization
```

**File Format (MDC):**

```yaml
---
description: "Plan2Code Step 1: Planning Mode"
alwaysApply: false
---
[prompt content]
```

**Usage:**

- Open Command Palette (Cmd+Shift+P)
- Type "New Cursor Rule" to create new rules
- Reference rules by mentioning them in chat
- Use `/Generate Cursor Rules` to create rules from conversation

**Documentation:** [Cursor Rules for AI](https://docs.cursor.com/context/rules)

</details>

---

<details>
<summary>Google Antigravity</summary>

**Location:** `.agent/workflows/`

**Setup:**

1. Copy the `.agent/workflows/` directory to your project root
2. Workflows appear automatically in Antigravity

**Files:**

```
.agent/workflows/
├── plan2code-1--plan.md       # Step 1: Planning
├── plan2code-2--document.md   # Step 2: Documentation
├── plan2code-3--implement.md  # Step 3: Implementation
└── plan2code-4--finalize.md   # Step 4: Finalization
```

**File Format:**

```yaml
---
description: "Plan2Code Step 1: Planning Mode"
---
[prompt content]
```

**Usage:**

- Type `/plan2code-1--plan` in the agent chat to invoke the planning workflow

**Documentation:** [Customize Antigravity](https://atamel.dev/posts/2025/11-25_customize_antigravity_rules_workflows/)

</details>

---

<details>
<summary>Continue (VS Code/JetBrains)</summary>

**Location:** `.continue/prompts/`

**Setup:**

1. Copy the `.continue/prompts/` directory to your project root
2. Install the Continue extension for VS Code or JetBrains
3. Prompts are automatically recognized

**Files:**

```
.continue/prompts/
├── plan2code-1--plan.prompt.md       # Step 1: Planning
├── plan2code-2--document.prompt.md   # Step 2: Documentation
├── plan2code-3--implement.prompt.md  # Step 3: Implementation
└── plan2code-4--finalize.prompt.md   # Step 4: Finalization
```

**File Format:**

```yaml
---
name: plan2code-1--plan
description: "Plan2Code Step 1: Planning Mode"
---
[prompt content]
```

**Usage:**

- In Continue chat, type `/plan2code-1--plan` to invoke the planning workflow
- Use `{{{ input }}}` template variable for user input
- Use `{{{ currentFile }}}` to reference the current file

**Documentation:** [Continue Prompts](https://docs.continue.dev/customize/deep-dives/prompts)

</details>

---

### Manual Installation (Any Platform)

If your AI tool isn't listed above, you can still use Plan2Code:

1. **Copy/Paste Method:** Copy the contents of the appropriate `plan2code-*.md` file and paste it at the start of your conversation.

2. **File Reference Method:** Reference the file directly in your prompt or use the @plan2code-1--plan.md syntax:

   ```
   Please follow the instructions in plan2code-1--plan.md

   I want to build a user authentication system.
   ```

3. **Custom Integration:** Adapt the prompts to your tool's custom instruction format.

---

## Important: Start Fresh Conversations

**Start a new conversation/chat session before each step.** This includes:

- Step 1: New conversation
- Step 2: New conversation
- Step 3: New conversation **for each phase** (Phase 1, Phase 2, etc.)
- Step 4: New conversation

Fresh conversations prevent context pollution and ensure the AI focuses on the current task with the relevant specifications.

---

## The Workflow Steps

### Step 1: Planning Mode 🤔

**Purpose:** Thoroughly analyze requirements and design the solution architecture before writing any code.

**AI Role:** Senior software architect and technical product manager

**Phases (completed one at a time):**

1. **Requirements Analysis** - Extract functional/non-functional requirements, identify ambiguities
2. **System Context Examination** - Review existing codebase, identify integration points
3. **Tech Stack** - Recommend and confirm all technologies (requires user sign-off)
4. **Architecture Design** - Propose patterns, define components, design interfaces/schemas
5. **Technical Specification** - Break down implementation phases, identify risks
6. **Transition Decision** - Finalize plan when confidence reaches 90%+

**Output:** `specs/PLAN-DRAFT-<timestamp>.md` containing the complete implementation plan

**Key Behaviors:**

- AI stops after each phase for clarification
- Must reach 90% confidence before finalizing
- All assumptions are documented
- User must approve tech stack decisions

---

### Step 2: Documentation Mode 📝

**Purpose:** Transform the planning output into structured, actionable implementation documents.

**Required Context:** Attach or reference the `specs/PLAN-DRAFT-<timestamp>.md` from Step 1 (or provide the planning conversation).

**Output Structure:**

```
specs/
└── <feature-name>/
    ├── overview.md          # High-level overview with phase checkboxes
    ├── Phase 1.md           # Detailed tasks for Phase 1
    ├── Phase 2.md           # Detailed tasks for Phase 2
    └── Phase N.md           # ...additional phases
```

**Document Format:**

- Each phase file contains detailed one-story-point tasks
- All tasks have checkboxes `[ ]` for progress tracking
- Each phase is self-contained (developer needs no prior context)
- Unit/E2E testing excluded unless explicitly requested

---

### Step 3: Implementation Mode ⚡

**Purpose:** Execute the implementation following the documented specifications.

**AI Role:** Senior software engineer

**Required Context:** Attach or reference the `specs/<feature-name>/` directory contents:

- `overview.md` (to identify which phase is next)
- The relevant `Phase X.md` file(s)

**Workflow:**

1. Identify the next uncompleted phase (unchecked in `overview.md`)
2. Implement ALL tasks in that phase exactly as specified
3. Update `Phase X.md` checkboxes as tasks complete `[x]`
4. Update `overview.md` phase checkbox when phase completes
5. Perform code review to ensure nothing was missed
6. Add completion summary to the phase document

**Key Rules:**

- **Start a new conversation for EACH phase**
- Work on ONE phase per conversation (unless told otherwise)
- Follow specifications EXACTLY as documented
- Keep checkboxes updated (enables progress tracking across sessions)
- Do NOT run tests unless specified in phase tasks

---

### Step 4: Finalization Mode 🧹

**Purpose:** Validate implementation, create summaries, and archive documentation.

**Required Context:** Attach or reference the `specs/<feature-name>/` directory contents.

**Steps:**

1. **Validation** - Verify all tasks implemented correctly, check for issues
2. **Summary** - Document what was built and list all modified/created files
3. **Documentation Review** - Identify any needed README/CHANGELOG updates
4. **Spec Cleanup** - Move completed specs to `specs/completed/<implementation-name>/`
5. **Final Confirmation** - Confirm completion

---

## How to Use These Prompts

### Option 1: Platform-Specific Slash Commands (Recommended)

This repository includes pre-configured workflow files for all major AI coding assistants. See the [Installation](#installation) section above for platform-specific setup instructions.

**Quick commands after setup:**

```
/plan           # Start planning a new feature
/document       # Create implementation docs from plan
/implement      # Begin/continue implementation
/finalize       # Wrap up after all phases complete
```

### Option 2: Direct File Reference

Reference the prompt files directly in your conversation:

```
Please follow the instructions in plan2code-1--plan.md

I want to build a user authentication system with OAuth support.
```

### Option 3: Copy/Paste

Copy the contents of each prompt file and paste at the beginning of your conversation when starting that step.

---

## Complete Workflow Example

### Starting a New Project

**Session 1 - Planning (New Chat):**

```
User: [Paste or invoke Step 1 prompt]
      I want to build a REST API for a task management application.

AI:   🤔 [REQUIREMENTS ANALYSIS]
      ... asks clarifying questions, works through phases ...

AI:   🤔 [TRANSITION DECISION]
      Confidence: 92%. Creating specs/PLAN DRAFT.md...
```

**Session 2 - Documentation (New Chat):**

```
User: [Paste or invoke Step 2 prompt]
      [Attach: specs/PLAN DRAFT.md]

AI:   📝 [DOCUMENTATION]
      Creating specs/task-api/overview.md...
      Creating specs/task-api/Phase 1.md...
      Creating specs/task-api/Phase 2.md...
      ...
```

**Session 3 - Implementation Phase 1 (New Chat):**

```
User: [Paste or invoke Step 3 prompt]
      [Attach: specs/task-api/overview.md]
      [Attach: specs/task-api/Phase 1.md]

AI:   ⚡ [PHASE 1: Project Setup]
      Implementing tasks...
      ✓ Phase 1 complete. Updated checkboxes in Phase 1.md and overview.md.
```

**Session 4 - Implementation Phase 2 (New Chat):**

```
User: [Paste or invoke Step 3 prompt]
      [Attach: specs/task-api/overview.md]
      [Attach: specs/task-api/Phase 2.md]

AI:   ⚡ [PHASE 2: Database Models]
      Implementing tasks...
      ✓ Phase 2 complete. Updated checkboxes in Phase 2.md and overview.md.
```

**Sessions 5-N - Continue Implementation (New Chat for each phase):**

```
... repeat for each remaining phase ...
```

**Final Session - Finalization (New Chat):**

```
User: [Paste or invoke Step 4 prompt]
      [Attach: specs/task-api/ directory contents]

AI:   🧹 [VALIDATION]
      Verifying implementation...

AI:   🧹 [SPEC CLEANUP]
      Moving to specs/completed/task-api/

      Implementation complete!
```

---

## Progress Tracking

The checkbox system enables seamless progress tracking across multiple sessions:

**overview.md:**

```markdown
## Phases

- [x] Phase 1: Project Setup
- [x] Phase 2: Database Models
- [ ] Phase 3: API Endpoints <- Next phase to implement
- [ ] Phase 4: Authentication
```

**Phase 3.md:**

```markdown
## Tasks

- [x] Create routes file
- [x] Implement GET /tasks
- [ ] Implement POST /tasks <- Current task
- [ ] Implement PUT /tasks/:id
- [ ] Implement DELETE /tasks/:id
```

---

## Best Practices

1. **Start fresh conversations** - New chat for each step and each implementation phase
2. **Always attach specs** - The AI needs the spec files to understand the current state
3. **Don't skip planning** - The upfront investment prevents costly rework later
4. **Confirm tech stack** - Ensure AI gets explicit approval before architecture design
5. **One phase at a time** - Keeps conversations focused and manageable
6. **Update checkboxes immediately** - Maintains accurate progress state
7. **Review phase output** - Verify each phase before moving to the next
8. **Keep spec files** - The completed folder serves as project documentation

---

## What to Attach at Each Step

| Step               | Required Attachments                                 |
| ------------------ | ---------------------------------------------------- |
| Step 1 (Plan)      | None (describe your feature/project)                 |
| Step 2 (Document)  | `specs/PLAN DRAFT.md` or planning conversation       |
| Step 3 (Implement) | `specs/<feature>/overview.md` + current `Phase X.md` |
| Step 4 (Finalize)  | All files in `specs/<feature>/` directory            |

---

## File Structure After Complete Implementation

```
your-project/
├── specs/
│   ├── completed/
│   │   └── feature-name/
│   │       ├── overview.md      # Archived with completion summary
│   │       ├── Phase 1.md       # All checkboxes marked [x]
│   │       ├── Phase 2.md
│   │       └── ...
│   └── another-feature/         # In-progress feature
│       ├── overview.md
│       └── Phase 1.md
|
├── your project files...
└── README.md
```

---

## Customization

Feel free to modify these prompts to fit your workflow:

- **Add testing phases** - Uncomment/add testing requirements in Step 2
- **Adjust confidence threshold** - Change the 90% threshold in Step 1
- **Modify output structure** - Customize the specs folder organization
- **Add code review steps** - Enhance Step 3 with additional review gates

---

## Troubleshooting

**AI jumps ahead to implementation during planning:**

- The prompts explicitly forbid this, but if it happens, remind the AI: "Stay in planning mode. Do not write code yet."

**AI doesn't know what to implement:**

- Make sure you attached the `overview.md` and relevant `Phase X.md` files
- The AI needs these files to understand the current state and tasks

**Lost progress between sessions:**

- Check `overview.md` for phase status
- Review individual phase files for task completion status

**AI not following spec exactly:**

- Reference the specific phase document and ask it to re-read the requirements

**Too many/few phases:**

- Adjust during Step 2 (Documentation) - phases should represent logical groupings of work
