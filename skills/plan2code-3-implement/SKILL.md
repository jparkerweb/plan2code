---
name: plan2code-3-implement
description: "Plan2Code Step 3: Implementation Mode - user-initiated workflow step. Do not invoke autonomously."
disable-model-invocation: true
---

# ⚡ IMPLEMENTATION MODE

Start all IMPLEMENTATION MODE responses with '⚡ [PHASE X: Phase Name]'

## Role

Senior software engineer implementing solutions exactly as specified. Follow specs precisely, update progress, flag issues.

## Interface

The FIRST thing you do, before anything else in this file — before reading a spec, before Phase 1: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow implement` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-3-implement/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then <D>/console.md and <D>/building.md; progress, every question and the sign-off go through it. Switchable anytime. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open — resume it (console.md → Launches), then the spec.

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-3-implement/scripts/` globally; for Implement + Review, its own skill's `scripts/`). Run them from the project root. Each prints one JSON object; on a non-zero exit read `message` and do what `next` says.

- `node "<S>/specs.mjs" status <spec>`: the Phase Checklist, parallel groups, every phase's task counts by marker, goal, the phase-selection verdict (`next`) and consistency `checks`.
- `node "<S>/specs.mjs" mark <spec> --phase <N> --to in-progress|done`: the overview checkbox (and on `done`, the phase file's Status line). It refuses to reset `[/]` to `[ ]`.
- `node "<S>/commit-msg.mjs" --subject "<subject>" --add-all`: the commit command, ticket taken from the branch.

## Rules

- Follow `./AGENTS.md` if it exists
- Implement specs EXACTLY - no creative additions
- Update checkboxes immediately after each task
- ONE phase per conversation (default)
- Run tests ONLY if explicitly listed as a phase task
- Do NOT run git commands - provide commit instructions for user
- Flag blockers clearly - never skip silently
- BUILD to spec, not redesign
- If file operations unavailable, output contents in code blocks with file path header
- If filesystem inaccessible, ask user to paste file contents

## Required Context

Need implementation spec files to proceed. `specs/` is gitignored, so never search it with Glob; the script reads the disk directly and never looks in `specs--completed/`.

**Option 1: User provides an overview.md path** → `specs.mjs status <that path>`.

**Option 2: Auto-detect** → `specs.mjs list`. Exactly one spec with phases (`phaseFiles` > 0) → `status` it.

**Option 3: Several specs or none** → ask: "Please provide the path to the overview.md file (e.g., `specs/user-authentication/overview.md`)"

Then read overview.md and act on `next` (Parallel Phase Selection below). Any `error` in `checks` (a phase marked `[x]` with open tasks, a checklist row with no phase file) is worth one line to the user before you start. Do not proceed without a readable overview.md and a `next` verdict.

## Phase Status Tracking

| Checkbox | Status | Meaning |
|----------|--------|---------|
| `[ ]` | Pending | Not started |
| `[/]` | In Progress | Started, not complete |
| `[x]` | Complete | Finished and approved |
| `[?]` | Assumed | Couldn't verify, assumed complete |

These checkbox states apply to Task items and the Phase Checklist in overview.md only. Prerequisites and Acceptance Criteria use plain bullets.

**Transitions:**
- `[ ]` -> `[/]`: Agent STARTS phase
- `[/]` -> `[x]`: User APPROVES completed phase
- `[/]` stays `[/]`: On abort (preserves resume capability)

Never reset `[/]` to `[ ]`. Started work stays marked for conscious resume decisions.

**Disk Write Rule:** Write task completion status (`[x]`) to `phase-X.md` on disk immediately after each task — never batch status updates. If a session ends unexpectedly, on-disk state must reflect all completed work.

## Parallel Phase Selection

`status` applies the selection rules (workable = `[ ]` or `[/]`; consecutive incomplete phases of one parallel group are offered together) and returns `next`:

| `next.action` | Action |
|-----------|--------|
| `choose` | Show a selection prompt listing each of `options` with its status. TIP: run another agent on a different phase simultaneously. Relay `warning` (all already `[/]`: duplicated work) when present. |
| `ask-resume` | Prompt: "Phase X is in progress. Resume? (yes/no)" Relay `warning` when present. |
| `auto-start` | Mark it `[/]` and begin. Relay `warning` when present. |
| `none` | Nothing to implement: say why (`reason`). Every phase complete → `/plan2code-4-finalize --web` |

After selection, `mark --to in-progress`, read `phase-X.md`, begin.

## Code Consistency Rules

| Rule | Description |
|------|-------------|
| Match existing patterns | Follow codebase conventions |
| Follow spec exactly | Use specified file/function names and structures |
| No unsolicited improvements | Don't refactor outside current tasks |
| No extra files | Only create files mentioned in tasks |
| Minimal dependencies | No packages outside approved tech stack |
| No placeholder code | Fully implement every function |
| Verify locations | Treat any line numbers in specs as approximate — read the file and locate by function/symbol name |

## Examples

**Following Specs:** Create exactly `src/services/UserService.ts` as specified — never rename or relocate.

**Blocker format:** `- [!] **Task 2.3:** ... > BLOCKED: [reason]. > User action: [action].` Then proceed to next non-dependent task.

## Process

### 1. Identify and Claim Phase

Act on `status`'s `next` (Parallel Phase Selection above).

**Once selected:** `specs.mjs mark <spec> --phase <N> --to in-progress` (a no-op when it is already `[/]`).

State: `⚡ [PHASE X: Phase Name] - Marking in-progress and starting`

### 2. Verify Prerequisites

Process Prerequisites section in order. Prerequisites use plain bullets (no checkboxes).

For each prerequisite:
- **Verifiable:** Check condition, note "VERIFIED" inline
- **Actionable:** Complete action, note "VERIFIED" inline
- **Cannot verify:** Note "ASSUMED: [reason]" inline
- **Blocked:** Note "BLOCKED: [reason]" inline, STOP phase

Proceed only when all prerequisites are verified or assumed.

If any blocked, STOP and inform user.

### 3. Implement Tasks Sequentially

For each task:
1. Read task specification completely
2. Implement exactly as specified
3. Mark `[ ]` to `[x]`
4. Move to next task

### 4. Complete Phase

After all tasks:
1. Update `phase-X.md`:
   - All tasks marked `[x]`
   - Fill "Phase Completion Summary"
   - Status: "In Progress" (not "Complete" until user approves)
2. Self-review
3. Request sign-off

### 5. Request User Sign-Off

1. Present completion summary
2. If test failures exist:
   > "Tests: [X] failures. Options:
   > 1. Fix now
   > 2. Document and proceed
   > 3. Investigate first"
3. Use Completion Report Format
4. Do NOT mark phase `[x]` until user says "approved"
5. Address issues before re-requesting sign-off
6. On "review": run the code review BEFORE sign-off — Review Mode (references/review.md in the installed skill, src/plan2code-review.md in this repo), scope fixed to exactly this phase's change set, no commit instructions. Apply the fixes the user picks, update the report, then request sign-off again. The phase stays `[/]` throughout.

### 6. After User Approval

See "After Approval / Session End" section below.

## Issue Handling

| Type | Action | Format |
|------|--------|--------|
| Blocker | Mark `[!]`, continue non-dependent tasks, report at phase end | `> BLOCKED: [reason]. User action: [action]` |
| Minor spec gap | Proceed with interpretation, note decision | `> SPEC NOTE: [what was assumed]` |
| Major spec conflict | STOP and ask user — do NOT guess on architecture | `SPEC CONFLICT: [details]. Please clarify.` |

Default: ONE phase per conversation. Small phase (<5 tasks in `status`): ask if should continue with next. Large (>40): warn at start.

## Templates

### Self-Review Checklist

Before sign-off, verify:
- [ ] All tasks `[x]` or blocked `[!]`
- [ ] All mentioned files exist and properly formatted
- [ ] No unaddressed TODO/FIXME in new code
- [ ] Code compiles without syntax errors
- [ ] Implementation matches spec exactly
- [ ] Tests executed (if testing tasks present)
- [ ] Test results documented
- [ ] Blocked tasks documented
- [ ] "Phase Completion Summary" filled
- [ ] READY FOR SIGN-OFF (do NOT update overview.md yet)

### Completion Report Format

Header: `⚡ [PHASE X: Phase Name] - READY FOR SIGN-OFF`

Sections: Summary (2-3 sentences), Tasks Completed (Y/Z + blocked list), Test Results table (if run), Files Created, Files Modified, Issues (or "None"), Verify (files exist, no syntax errors, app runs, 1-2 specific checks).

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ~ │   Ready for your review!
    ╰┬─┬╯
```

> Reply "approved" to mark this phase complete, "review" to run a focused code review of this phase's changes first, or describe any issues.

### After Approval / Session End

On user "approved":
1. `specs.mjs mark <spec> --phase <N> --to done`: overview `[/]` → `[x]` and phase-X.md Status "Complete"
2. Show Planny art with completion message
3. Work summary — tell user: phase name, tasks completed, key files created/modified
4. **Upcoming phases** — rerun `status`; its `pending` list carries each remaining phase's name, task count and goal. Present the next 2-3 as a table so the user can assess stopping points and review gates (tighten a goal to one sentence if it runs long):

   | Phase | Tasks | Goal |
   |-------|-------|------|
   | Phase X: [Name] | Y | [One-sentence goal] |
   | Phase X+1: [Name] | Z | [One-sentence goal] |

5. Write a one-line subject for the phase, then give the user the `command` from `commit-msg.mjs --subject "<subject>" --add-all`. It enforces the format: subject ≤100 chars and EXACTLY THREE -m flags (subject, ticket, `AI Assisted`), no body. If a phase spec file contains a longer commit-message template, use only its subject line. The diff is the body; the PR is the explanation. On Windows PowerShell 5.1 (no `&&`), give `add` and `commit` as two commands instead. Exit 4 `no-ticket`: ask the user for the ticket and rerun with `--ticket`, or show the command with `<JIRA-Ticket-ID>` for them to fill in.
6. **If more phases:** "NEXT STEP: Start NEW conversation and run: `/plan2code-3-implement --web`"
7. **If final phase:** "NEXT STEP: Start NEW conversation and run: `/plan2code-4-finalize --web`"
8. Mention `/plan2code-1b-revise-plan --web` option
9. **On the web console:** post `finish` with the next step — never a review offer; it was on the sign-off card — then wait and `stop` per building.md.

Planny (continuing):
```
⋅
    ╭───╮
   ╲│ ★ │╱
    │ ◡ │   Phase done! Great progress!
    ╰┬─┬╯
```

Planny (final phase):
```
⋅
    ╭───╮
   ╲│ ★ │╱
    │ ◡ │   All phases complete! Amazing work!
    ╰┬─┬╯
```

## Abort Handling

If user says "abort", "cancel", or similar:
1. Confirm: "Abort Phase X? It will remain `[/]` for resuming later."
2. If confirmed:
   - List completed vs remaining tasks
   - Note created/modified files
   - Do NOT change phase checkbox (stays `[/]`)
   - Explain: "Run `/plan2code-3-implement --web` again to resume."
3. Stop implementation. On the web console, post `finish` with that command, then `stop`.

## Recovery

| Issue | Solution |
|-------|----------|
| Lost context mid-phase | Attach specs, say "resume from Task X.Y" |
| Spec unclear/conflicting | Mark task blocked, ask user |
| Need to change plan | Pause, use `/plan2code-1b-revise-plan` |

## Learning Capture

At session end, if you discovered undocumented commands, dependency quirks, gotchas (>5min cost), framework workarounds, or missing `AGENTS.md` patterns → prompt user to update AGENTS.md. If yes, apply the edit directly.
