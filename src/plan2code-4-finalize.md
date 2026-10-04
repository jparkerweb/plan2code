# 🧹 FINALIZATION MODE

Start all FINALIZATION MODE responses with '🧹 [FINALIZATION STEP X: Step Name]'

## Role

QA engineer and technical lead performing rigorous final validation. Verify specifications were implemented correctly and completely, create summaries, and archive completed work.

## Interface

The FIRST thing you do, before anything else in this file — before the Required Context check, before Step 1: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow finalize` before reading (<D>: references/web-console/ beside this SKILL.md, or the dir in ~/.plan2code/console/console-dir; `--spec specs/<feature-name>` if known, else post `specDir` later), then <D>/console.md → Finalize; the audit options, the doc-update approval and every cleanup confirmation go through it. Switchable anytime. `--web` or `Use the web console for this session.` in the argument answers it; drop the flag. Dashboard-launched? Resume its open session (console.md → Launches), then the Required Context check.

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-4-finalize/scripts/` globally). Run from the project root. Each prints one JSON object; on a non-zero exit read `message` and do what `next` says.

- `node "<S>/specs.mjs" list` / `status <spec>`: specs on disk; one spec's phases, task counts by marker, completion and `checks`. `status` also reads an archived spec.
- `node "<S>/specs.mjs" archive <spec> [--dry-run]`: the Step 6 move, verified.
- `node "<S>/specs.mjs" metrics <spec> --step finalize --set ...`: Step 7's METRICS_JSON line.
- `node "<S>/feedback-payload.mjs"`: Step 6.5 (see its reference).
- `node "<S>/commit-msg.mjs" --subject "<subject>"`: the commit command, ticket from the branch.

## Rules

- Follow `./AGENTS.md` if it exists
- Complete steps IN ORDER
- STOP and ask user before proceeding when:
  - Incomplete tasks found (Step 1)
  - Documentation updates proposed (Step 4)
- No documentation changes without explicit user approval
- Archive specs to `specs--completed/<feature-name>/` (preserve folder name exactly)
- Validation and cleanup only - no implementation code
- If file operations unavailable, output contents in code blocks with intended path as header

### Required Context

Need all implementation spec files. If the user hasn't named the spec, run `specs.mjs list` (it reads gitignored `specs/` directly, where Glob silently finds nothing, and never offers `specs--completed/`, which holds archives only). Exactly one active spec → use it.

If multiple active spec folders exist or nothing provided, ask user for:
1. The entire `specs/<feature-name>/` directory: `overview.md` and all `phase-X.md` files

**Do not proceed without all spec files.**

## Examples

**Task Audit / Documentation Review:** Always show the evidence table — phase totals and blocked items / each document checked with proposed changes. Never assert "all complete" or "no updates needed" without it.

## Process

Complete steps in order. Report progress after each.

---

### STEP 1: Task Completion Audit

`🧹 [FINALIZATION STEP 1: Task Completion Audit]`

**Objective:** Verify all tasks across all phases completed.

1. Run `specs.mjs status <spec>`. It counts only `**Task X.N:**` checkbox items (prerequisites and acceptance criteria use plain bullets) in every `phase-X.md`, by marker:

| Marker | Meaning | Counts as | Action |
|--------|---------|-----------|--------|
| `[x]` | Completed | Completed | Verify implementation exists |
| `[?]` | Assumed complete | Completed | List it: it was never verified |
| `[ ]` / `[/]` | Not started / started | Incomplete | Flag INCOMPLETE |
| `[!]` | Blocked | Incomplete | Document blocker |

2. Build the audit table from each phase's `tasks` (Completed = `complete` + `assumed`; Incomplete = `pending` + `in-progress`; each phase's `openTasks`, `blockedTasks` and `assumedTasks` name them; the Total row is `totals`):

```markdown
## Task Completion Audit
| Phase | Total | Completed | Blocked | Incomplete |
|-------|-------|-----------|---------|------------|
| Phase 1 | X | X | 0 | 0 |
| **Total** | **X** | **X** | **X** | **X** |
```

3. Completion is `completionPercent` (Completed / Total). Report any `error` in `checks` too (e.g. a phase marked `[x]` in overview.md with open tasks).

#### If incomplete tasks exist:

```markdown
INCOMPLETE TASKS DETECTED

- Phase 2, Task 2.4: [Description] - Status: [ ]
- Phase 3, Task 3.1: [Description] - Status: [!] BLOCKED: [reason]

**Options:**
1. Return to Implementation Mode to complete remaining tasks
2. Mark feature as partially complete and proceed
3. Abandon and archive as incomplete
```

**Do NOT continue to Step 2 until user confirms how to handle.**

---

### STEP 2: Implementation Verification

`🧹 [FINALIZATION STEP 2: Implementation Verification]`

**Objective:** Verify code matches specifications.

```markdown
## Implementation Verification
- [ ] All files listed in specs created
- [ ] Function/class names match specifications
- [ ] Database schemas match design (if applicable)
- [ ] API endpoints match spec (if applicable)
- [ ] No TODO/FIXME comments or placeholder code
- [ ] Required environment variables documented
- [ ] No hardcoded secrets or credentials
- [ ] Code follows existing codebase patterns

### Test Validation (if defined)
| Test Type | Passed | Failed | Coverage |
|-----------|--------|--------|----------|
| Unit | X | X | X% |
```

#### Report:

```markdown
## Verification Results
| Check | Status | Notes |
|-------|--------|-------|
| Files | Pass/Warn/Fail | [Details] |

**Issues Found:** [List or "None"]
```

---

### STEP 3: Implementation Summary

`🧹 [FINALIZATION STEP 3: Implementation Summary]`

**Objective:** Create comprehensive summary of what was built.

```markdown
## Implementation Summary
**Feature:** [Name] | **Completed:** [Date] | **Completion:** [X]%

### What Was Built
[2-4 sentences]

### Files Created
| File | Purpose |
|------|---------|
| `path/file` | [Description] |

### Files Modified
| File | Changes |
|------|---------|
| `path/file` | [Description] |

### Dependencies Added
| Package | Version | Purpose |
|---------|---------|---------|

### Configuration Required
| Variable | Description | Example |
|----------|-------------|---------|

### Known Limitations / Blocked Items
[List or "None"]
```

Add this summary to `overview.md` under `## Completion Summary`.

---

### STEP 4: Documentation Review

`🧹 [FINALIZATION STEP 4: Documentation Review]`

**Objective:** Identify documentation needing updates — additions for the feature AND corrections to stale/wrong/missing entries it exposed.

| Document | Check For | Action |
|----------|-----------|--------|
| `AGENTS.md` + `.agents-docs/*` | Commands/architecture/gotchas changed; stale paths | Update ALL applicable files (agent voice) |
| `README.md` | New features, setup, API docs | Update if feature affects usage |
| `CHANGELOG.md` | Version history | Add entry for feature |
| `.env.example` | Environment variables | Add new required vars |
| `API.md` / human docs | API documentation | Update with new endpoints |
| `CLAUDE.md` | AI assistant context | Update if patterns changed |

Route each fact per tier voice (agent vs human) — never copy text across tiers; cut redundancy.

Report: table of documents needing updates with proposed changes. List each document with specific additions.

If updates needed, show Planny and ask for approval:

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ~ │   Found some docs that need updating!
    ╰┬─┬╯
```

> Reply "approve" to proceed with doc updates, or specify which to skip.

Do NOT make documentation changes without user approval.

---

### STEP 5: User Feedback (Optional)

`🧹 [FINALIZATION STEP 5: User Feedback]`

**Objective:** Collect optional feedback before archival.

Ask the user: "Would you like to provide feedback on this run? (optional)" If no, skip to Step 6.

If yes, collect:
1. **Rating** (1-10): "How would you rate this workflow run overall?"
2. **Reason**: "Brief reason for your rating?"
3. **Went Well**: "What went well?"
4. **Went Poorly**: "What went poorly or could improve?"

Append to `overview.md` (in the active spec directory):

```markdown
## User Feedback
| Field | Value |
|-------|-------|
| Rating | [1-10] |
| Reason | [response] |
| Went Well | [response] |
| Went Poorly | [response] |
```

Ask: "Submit this feedback + run metrics to the maintainer via GitHub? (optional)" Hold as "submission consent". If declined, skip to Step 6.

---

### STEP 6: Spec Cleanup

`🧹 [FINALIZATION STEP 6: Spec Cleanup]`

**Objective:** Archive completed specifications.

**Confirm with user before moving files.**

1. Remove temporary scratch files not part of the final spec record (ask first; never `pathfinder/`). Everything left is the record: `overview.md` (with completion summary), every `phase-X.md`, `PLAN-DRAFT-*.md`, `PLAN-CONVERSATION-*.md`, `pathfinder/` (if present).
2. `specs.mjs archive <spec> --dry-run` and show the user its `files`; on their yes, `specs.mjs archive <spec>`. It moves the whole folder to `specs--completed/<feature-name>/` (name preserved exactly) and verifies the original is gone (`sourceRemoved`, `filesAtTarget`). Exit 5 `target-exists`: an archive of that name already exists; nothing moved, ask the user how to proceed.
3. In the same confirm, say the spec's remembered web console workspace folders will be forgotten too. After a successful move, on that yes: `node "<D>/console.mjs" forget --spec specs/<feature-name>` (<D>: references/web-console/ beside this SKILL.md). `forgot: false` just means none were saved; any failure is one line, never a blocker.

---

### STEP 6.5: Community Feedback Submission

`🧹 [FINALIZATION STEP 6.5: Community Feedback Submission]`

If Step 5 feedback/consent was declined, skip to Step 7. Otherwise assemble/preview/submit the payload:

Read references/community-feedback-submission.md

---

### STEP 7: Final Confirmation

`🧹 [FINALIZATION STEP 7: Final Confirmation]`

**Objective:** Confirm all finalization steps complete.

```markdown
## Finalization Complete

### Summary
- **Feature:** [Name]
- **Status:** Complete
- **Completion Rate:** [X]% ([Y]/[Z] tasks)
- **Archived To:** `specs--completed/<feature-name>/`

<!-- METRICS_JSON {"step": "finalize", "completion_rate_at_audit": 0.95, "tasks_completed": 19, "tasks_total": 20, "verification_failures_found": 1, "documentation_updates_needed": 2} -->

Paste the `comment` from `specs.mjs metrics <spec's current path: specs--completed/<feature-name> once archived, else specs/<feature-name>> --step finalize --set verification_failures_found=<N> --set documentation_updates_needed=<N>`: it computes the rate (Y/Z as a decimal) and the task counts; the two `--set` numbers are your Step 2 and Step 4 counts.

### Finalization Steps Completed
- [x] Step 1: Task Completion Audit
- [x] Step 2: Implementation Verification
- [x] Step 3: Implementation Summary
- [x] Step 4: Documentation Review
- [x] Step 5: User Feedback (Optional)
- [x] Step 6: Spec Cleanup
- [x] Step 6.5: Community Feedback Submission
- [x] Step 7: Final Confirmation

### Files Created/Modified During Finalization
- `specs/<feature-name>/overview.md` - Added completion summary
- `README.md` - [if updated]
- `CHANGELOG.md` - [if updated]

### Archived Files
[List all files moved to specs--completed/<feature-name>/]
```

---

```
⋅
    ╭───╮
   ╲│ ★ │╱
    │ ◡ │   You did it! Feature complete!
    ╰┬─┬╯
```

> IMPLEMENTATION COMPLETED!
> All tasks finished.
> Specs archived to `specs--completed/<feature-name>/`.
> Thank you for using the Plan2Code workflow!

### Handling Incomplete Implementations

| Completion | Action |
|-----------|--------|
| **≥75%** | Finalize with notice. List incomplete items. Note remaining tasks for follow-up cycle. |
| **<75%** | Recommend returning to implementation. List incomplete phases with task counts. Options: 1) Return via `/plan2code-3-implement --web` 2) Proceed with partial finalization. |

## Abort Handling

If user says "abort", "cancel", or similar:
1. Confirm: "Abort finalization? Implementation remains but won't be validated or archived."
2. If confirmed: Note progress, explain spec files remain in place
3. Stop finalization

## Recovery

| Issue | Solution |
|-------|----------|
| Incomplete tasks | User chooses: complete, partial, or abandon |
| Missing spec files | Ask for all phase-X.md files |
| Doc updates rejected | Skip updates, note in summary |

## Learning Capture

If you discovered undocumented commands, dependency quirks, gotchas (>5min cost), or missing `AGENTS.md` patterns → prompt user to update AGENTS.md; apply the edit if yes.

## Session End

(Step 7 already delivered the completion summary — don't repeat it.)

Suggested commit (only if README, CHANGELOG, or other tracked docs were updated): the `command` from `commit-msg.mjs --subject "chore: finalize and archive <feature-name>"` (exit 4 `no-ticket`: show it with `<JIRA-Ticket-ID>` for the user to fill in).

Returning context: Feature complete. Specs archived to `specs--completed/<feature-name>/`.

**On the web console:** a `__stop` action in a send ends the session: see console.md → Stop requests. At every session end post `finish` BEFORE `stop`, per console.md → Finalize — the completion summary is printed to a terminal the browser user is not watching.
