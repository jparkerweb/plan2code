# Plan2Code Quick Reference

## Commands

| Step   | Command                    | Input           | Output                    |
| ------ | ---------------------------| --------------- | ------------------------- |
| Init   | /plan2code---init          | None            | AGENTS.md file            |
| Update | /plan2code---init-update   | AGENTS.md       | Updated AGENTS.md         |
| 0      | /plan2code---quick-task    | Requirements    | Conversational plan       |
| 1      | /plan2code-1--plan         | Requirements    | PLAN-DRAFT.md             |
| 1b     | /plan2code-1b--revise-plan | Specs + changes | Updated specs             |
| 2      | /plan2code-2--document     | PLAN-DRAFT.md   | overview.md + Phase files |
| 3      | /plan2code-3--implement    | overview.md     | Implemented code          |
| 4      | /plan2code-4--finalize     | overview.md     | Archived specs            |

## File Structure

```
specs/
├── PLAN-DRAFT-<timestamp>.md    # From Step 1
└── <feature-name>/
    ├── overview.md              # From Step 2
    └── Phase X.md               # From Step 2

specs--completed/                # After Step 4
└── <feature-name>/              # Archived specs
```

## Key Rules

- Start NEW conversation for each step (and each implementation phase)
- ONE phase per conversation (but parallel phases can run in separate instances)
- Reply "approved" to complete phases
- 90% confidence required before planning completes
- Never look in `specs--completed/` (it's archived specs)

## Phase Status
| Checkbox | Status | Meaning |
|----------|--------|---------|
| `[ ]` | Pending | Not started |
| `[/]` | In Progress | Agent working (or paused) |
| `[x]` | Complete | Approved |
## Parallel Execution
When phases have no file conflicts or dependencies, they can run simultaneously:
1. Documentation Mode auto-detects parallel-eligible phases
2. Implementation Mode shows selection UI with status for each phase
3. Run multiple `/plan2code-3--implement` instances on different phases
4. `[/]` status shows which phases are actively being worked on
## Quick Troubleshooting

| Issue                  | Solution                                        |
| ---------------------- | ------------------------------------------------- |
| Lost context mid-phase | Attach spec files, say "resume from Task X.Y"   |
| Wrong phase started    | Say "abort", start correct phase                |
| Need to change plan    | Use `/plan2code-1b--revise-plan`                |
| Multiple spec folders  | Specify which: "Continue with specs/user-auth/" |
| Need AGENTS.md file    | Use `/plan2code---init` to generate one         |
| Update AGENTS.md       | Use `/plan2code---init-update` after sessions   |
| Run phases in parallel | Check Parallel Execution Groups in overview.md    |

## Workflow Decision

```
New to a project?
└── /plan2code---init → Generate AGENTS.md for project-specific guidance

Learned something during a session?
└── /plan2code---init-update → Add learnings to AGENTS.md

Is it a quick, small task?
├── Yes → /plan2code---quick-task (standalone)
└── No → /plan2code-1--plan (full workflow)
         ├── /plan2code-2--document
         ├── /plan2code-3--implement (repeat per phase)
         │   └── OR: plan2code-loop (autonomous alternative)
         └── /plan2code-4--finalize

Need to revise mid-implementation?
└── /plan2code-1b--revise-plan
```
## Autonomous Loop (Alternative)
The `plan2code-loop` CLI is an **alternative** to Step 3, not a replacement.
| Approach | Use When |
|----------|----------|
| `/plan2code-3--implement` | You want interactive control per phase |
| `plan2code-loop` | You want hands-off autonomous execution |
```bash
plan2code-loop   # Fully interactive - auto-detects specs, prompts for options
```
Session state stored per-spec in `specs/<feature>/.plan2code-loop/`
