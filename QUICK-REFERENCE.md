# Plan2Code Quick Reference

## Launch

The web console is the main way in: a local page where questions, documents, build progress and sign-offs live.

| How                       | Command                              | What happens                                                                           |
| ------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| From your project (shell) | `plan2code`                          | Opens Claude Code or Devin on the dashboard (`--cli claude` / `--cli devin` to choose) |
| Inside any agent          | `/plan2code`                         | Opens the dashboard: a card for every skill, launched on the same page                 |
| Install / update          | `npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git` | Installs the skills and the `plan2code` command; re-run it to update |
| Straight into a skill     | `/plan2code-1-plan --web` (any step) | Skips the "web console or terminal?" question and opens the page                       |

Pick a skill on the dashboard and the same page becomes that session. Details: [.readme/web-console.md](.readme/web-console.md) · worked example: [.readme/walkthrough.md](.readme/walkthrough.md).

## Commands

Every command below is what a dashboard card runs. Typed on its own, each one asks "web console or terminal?" first.

| Step       | Command                       | Input           | Output                                                                                                        |
| ---------- | ----------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| —          | /plan2code                    | None            | Web console dashboard — a menu of every skill below, launched on the page                                     |
| Init       | /plan2code-init               | None            | AGENTS.md file                                                                                                |
| Update     | /plan2code-init-update        | AGENTS.md       | Updated AGENTS.md                                                                                             |
| 0          | /plan2code-0-pathfinder       | A foggy idea    | pathfinder/map.md *or* GitHub Issues + PLAN-DRAFT-<date>.md                                                   |
| quick      | /plan2code-quick-task         | Requirements    | A short plan, then the change built (standalone, not a pipeline step)                                         |
| review     | /plan2code-review             | Scope guidance  | Review findings + fixes                                                                                       |
| 1          | /plan2code-1-plan             | Requirements    | PLAN-CONVERSATION-<date>.md + PLAN-DRAFT-<date>.md                                                            |
| 1b         | /plan2code-1b-revise-plan     | Specs + changes | Updated specs                                                                                                 |
| 2          | /plan2code-2-document         | PLAN-DRAFT.md   | overview.md + Phase files                                                                                     |
| 3          | /plan2code-3-implement        | overview.md     | Implemented code                                                                                              |
| 3+review   | /plan2code-3-implement-review | overview.md     | Reviewed implementation ready for approval (alternative to `/plan2code-3-implement`)                          |
| 4          | /plan2code-4-finalize         | overview.md     | Archived specs                                                                                                |
| handoff    | /plan2code-handoff            | Conversation    | Self-contained handoff doc (OS temp dir by default, or a folder you pick such as `handoffs/`)                 |
| git-commit | /plan2code-git-commit         | Your changes    | A commit (`<subject>` / `AI Assisted`): suggested splits, a branch offer on the default branch, optional push |

**Terminal instead:** run any command without `--web` and answer the interface question with **terminal**. Nothing is lost: same questions, same gates, same files under `specs/`. You can switch between the two mid-feature.

## File Structure

```
specs/
└── <feature-name>/
    ├── pathfinder/                   # From Step 0 (optional, if charted locally)
    │   ├── map.md                    #   the map: destination, decisions, fog
    │   ├── questions/NN-<slug>.md    #   one decision question per file
    │   └── briefs/brief-<date>.md    #   on-demand plain-English decision briefs
    │                                 #   (GitHub Issues backend: map issue + sub-issues instead)
    ├── PLAN-DRAFT-<date>.md          # From Step 1 (verified plan)
    ├── PLAN-CONVERSATION-<date>.md   # From Step 1 (conversation log)
    ├── overview.md                   # From Step 2
    └── phase-X.md                    # From Step 2

specs--completed/                     # After Step 4
└── <feature-name>/                   # Archived specs
```

Note: `<date>` uses YYYYMMDD format (e.g., `20250204`)

## Key Rules

- Keep sessions short: fresh console session when the meter turns red, and before a big plan or build step
- ONE phase per conversation (but parallel phases can run in separate instances)
- Approve phases on the sign-off card (or reply "approved" in the terminal)
- 90% confidence required before planning completes
- Never look in `specs--completed/` (it's archived specs)

## Phase Status

| Checkbox | Status | Meaning |
|----------|--------|---------|
| `[ ]` | Pending | Not started |
| `[/]` | In Progress | Agent working (or paused) |
| `[x]` | Complete | Approved |
| `[!]` | Blocked | Couldn't be done; the line says why and what you need to do |
| `[?]` | Assumed | Couldn't be verified, assumed complete; check it |

## Parallel Execution

When phases have no file conflicts or dependencies, they can run simultaneously:

1. Documentation Mode auto-detects parallel-eligible phases
2. Implementation Mode asks which phase to take (a card on the web console), with the status of each
3. Run multiple `/plan2code-3-implement` instances on different phases
4. `[/]` status shows which phases are actively being worked on

## Quick Troubleshooting

| Issue                  | Solution                                         |
| ---------------------- | ------------------------------------------------ |
| Lost context mid-phase | Attach spec files, say "resume from Task X.Y"    |
| Wrong phase started    | Say "abort", start correct phase                 |
| Need to change plan    | Use `/plan2code-1b-revise-plan`                |
| Multiple spec folders  | Specify which: "Continue with specs/user-auth/"  |
| Need AGENTS.md file    | Use `/plan2code-init` to generate one          |
| Update AGENTS.md       | Use `/plan2code-init-update` after sessions    |
| Run phases in parallel | Check Parallel Execution Groups in overview.md   |

## Workflow Decision

```
New to a project?
└── /plan2code-init → Generate AGENTS.md for project-specific guidance

Learned something during a session?
└── /plan2code-init-update → Add learnings to AGENTS.md

Too foggy to plan? (big idea, don't yet know what the questions are)
└── /plan2code-0-pathfinder → chart it, clear one decision at a time
    ├── continue-or-stop menu between decisions; fresh session recommended after ~3
    └── then → /plan2code-1-plan (resumes at Phase 4)

Is it a quick, small task?
├── Yes → /plan2code-quick-task (standalone)
└── No → /plan2code-1-plan (full workflow)
         ├── /plan2code-2-document
         ├── /plan2code-3-implement (repeat per phase)
         │   ├── OR: /plan2code-3-implement-review (review gate before approval)
         │   └── OR: plan2code-loop (autonomous alternative)
         └── /plan2code-4-finalize

Need to revise mid-implementation?
└── /plan2code-1b-revise-plan
```

## Autonomous Loop (Alternative)

`plan2code-loop` is a hands-off alternative to Step 3. See [.readme/autonomous-loop.md](.readme/autonomous-loop.md).
