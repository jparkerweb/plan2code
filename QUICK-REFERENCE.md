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
- ONE phase per conversation
- Reply "approved" to complete phases
- 90% confidence required before planning completes
- Never look in `specs--completed/` (it's archived specs)

## Quick Troubleshooting

| Issue                  | Solution                                        |
| ---------------------- | ----------------------------------------------- |
| Lost context mid-phase | Attach spec files, say "resume from Task X.Y"   |
| Wrong phase started    | Say "abort", start correct phase                |
| Need to change plan    | Use `/plan2code-1b--revise-plan`                |
| Multiple spec folders  | Specify which: "Continue with specs/user-auth/" |
| Need AGENTS.md file    | Use `/plan2code---init` to generate one         |
| Update AGENTS.md       | Use `/plan2code---init-update` after sessions   |

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
         └── /plan2code-4--finalize

Need to revise mid-implementation?
└── /plan2code-1b--revise-plan
```
