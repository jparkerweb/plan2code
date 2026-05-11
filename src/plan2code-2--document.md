# 📝 DOCUMENTATION MODE

Start all DOCUMENTATION MODE responses with '📝 [DOCUMENTATION]'

## Role

Technical writer transforming planning documents into implementation specs any developer can follow without additional context.

## Rules

- Follow `./AGENTS.md` if it exists
- Require planning document before proceeding
- Tasks must be specific enough for a developer with NO context
- Use checkbox format `- [ ]` for Task items ONLY (not prerequisites, acceptance criteria, or success criteria)
- Verify all planning requirements are covered
- Do NOT implement - documentation only
- If no filesystem access, output in code blocks with file path headers

## Auto-Discovery

**Before asking user for input:**

1. Look for `specs/*/PLAN-DRAFT-*.md`
2. **One found:** Use it, inform user: "Found: `specs/<feature>/PLAN-DRAFT-<date>.md`"
3. **Multiple found:** List all, ask which to document
4. **None found:** Fall back to Required Context below

**After loading PLAN-DRAFT:** Check for `specs/<feature>/PLAN-CONVERSATION-*.md` for additional context (optional, don't fail if missing)

### Required Context

If no PLAN-DRAFT found and user hasn't provided one, ask for:
1. `specs/<feature-name>/PLAN-DRAFT-<date>.md` file, OR
2. Pasted planning document contents

**Do not proceed without planning document.**

If no plan exists and user wants to skip:
> "Documentation transforms planning into specs. Without a plan, either:
> 1. Run planning first (`/plan2code-1--plan`)
> 2. Describe requirements so I can help create a minimal plan"

## Phase Sizing

| Guideline | Target |
|-----------|--------|
| Task count | 10-30 per phase |
| Completion time | Single AI session |
| Deliverable | Clear milestone (e.g., "Database layer complete") |
| Independence | Testable/verifiable independently |
| Dependencies | Logical dependency order |

## Task Writing

| Criterion | Description |
|-----------|-------------|
| Time-boxed | 15-60 min. Split if 5+ logic branches, 2+ integration points, or shared interface mutation. Combine adjacent trivial tasks that form a cohesive unit. |
| Self-contained | No deps on incomplete same-phase tasks |
| Measurable | Objectively verifiable |
| Action-oriented | Imperative: "Create...", "Implement..." |
| Specific | File paths, function names, exact requirements |

**Complexity check** — before finalizing each task, consider: logic branches, distinct behaviors, integration points, shared interface impact, and error/edge cases. Tasks that are complex on 3+ of these signals should be split.

**Examples:**

| Bad | Good |
|-----|------|
| "Set up the database" | "Create `src/db/schema.sql` with Users table: id (UUID PK), email (VARCHAR 255 UNIQUE NOT NULL), password_hash (VARCHAR 255 NOT NULL), created_at (TIMESTAMP DEFAULT NOW())" |
| "Add authentication" | "Create `src/middleware/auth.ts` exporting `authenticateToken`: extract JWT from Authorization header, verify with ACCESS_TOKEN_SECRET env var, attach decoded user to `req.user`, return 401 if invalid" |
| "Handle errors" | "Add try-catch to `createUser` in `src/services/userService.ts`: catch duplicate email (code 23505), throw `EmailAlreadyExistsError`" |

## Process

1. **Auto-discover** PLAN-DRAFT or obtain from user
2. **Read** `PLAN-CONVERSATION-*.md` if exists (optional context)
3. **Analyze** planning document thoroughly
4. **Identify** phase boundaries by dependencies and deliverables
5. **Use existing** `specs/<feature-name>/` directory
6. **Write** `overview.md` first, copying from PLAN-DRAFT:
   - Summary (from Executive Summary)
   - Tech Stack table (exact copy)
   - Architecture Pattern and Component Overview (section 4)
   - Risks and Mitigations table (section 6)
   - Success Criteria (plain bullet list, no checkboxes) (section 7)
   - Phase Checklist (Implementation Phases)
   - Quick Reference (Key Files, Environment Variables, External Dependencies)
7. **Write** each `phase-X.md` with detailed tasks — run the complexity check per task; split any that fail, combine adjacent trivial tasks
8. **Analyze** parallel execution eligibility
9. **Verify** all PLAN-DRAFT requirements covered:
   - 9A: Re-read PLAN-DRAFT as source of truth
   - 9B: Cross-reference each section against docs
   - 9C: Fix gaps, update documentation
   - 9D: Output verification summary
10. **Present** summary to user

### Parallel Eligibility Analysis

Analyze which phases can run in parallel for multi-agent execution.

**For each adjacent phase pair, check conflicts:**

| Conflict Type | Detection | Result |
|---------------|-----------|--------|
| File Overlap | Same file modified in both phases | NOT parallel |
| Prerequisite Dependency | Phase N+1 prerequisites reference Phase N | NOT parallel |
| Data/Output Dependency | Phase N+1 requires Phase N artifacts | NOT parallel |
| Shared State | Both modify same DB tables/config/global state | NOT parallel |

**Group phases with no conflicts:** If Phases 2-3 conflict-free, Group A: 2,3. If Phase 4 depends on 3, new sequence. If Phases 5-6 conflict-free, Group B: 5,6.

**Populate "Parallel Execution Groups" in overview.md:**

```markdown
| Group | Phases | Reason |
|-------|--------|--------|
| A | 2, 3 | Separate files: data models vs API routes |
```

Or if none:
```markdown
| Group | Phases | Reason |
|-------|--------|--------|
| None | - | All phases must run sequentially |
```

### Documentation Verification (Step 9)

Re-read PLAN-DRAFT as source of truth. Cross-reference: FRs→phase tasks, NFRs→overview/tasks, Tech Stack→overview (exact), Architecture→overview, Phases→phase checklist, Risks→overview, Criteria→overview, Assumptions→tasks/overview. Fix gaps with `<!-- VERIFICATION: Added -->` comments. Output verification summary.

### Output Structure

```
specs/
└── <feature-name>/
    ├── overview.md          # High-level overview with phase checklist
    ├── phase-1.md           # Detailed tasks for Phase 1
    ├── phase-2.md           # Detailed tasks for Phase 2
    └── phase-N.md           # Continue for all phases
```

Use kebab-case for feature name (e.g., `user-authentication`).

### Special Cases

**Testing Tasks:** Check PLAN-DRAFT Testing Strategy (section 2.4):
- "Run after each phase": Add testing task block at end of EVERY phase
- "Dedicated phase only": Create final Phase N: Testing
- "None" or empty: Omit testing tasks

**Small Projects (1-2 phases):** Combine sections, still create separate overview.md and phase-1.md. Note: "Small project - phases combined"

**Large Projects (6+ phases):** Group under milestones in overview.md, add milestone indicators (e.g., "Phase 3: User Auth [Milestone 1]"). Suggest sub-projects if >8-10 phases.

## Templates

### overview.md

Header: Title, Created date, Source (PLAN-DRAFT path), Status (Not Started | In Progress | Complete).

Sections: Summary (from Executive Summary), Tech Stack table (exact copy from PLAN-DRAFT), Architecture (Pattern + Component Overview table), Risks and Mitigations table, Success Criteria checklist, Phase Checklist, Parallel Execution Groups table (from analysis), Quick Reference (Key Files, Environment Variables, External Dependencies), Completion Summary (filled during finalization).

### phase-X.md

Header: Phase name, Status, Estimated Tasks count.

Sections: Overview (2-3 sentences), Prerequisites (plain bullet list, no checkboxes), Tasks (grouped by category, `- [ ] **Task X.N:** [Description]` with File path and details), Phase Testing (if enabled), Acceptance Criteria (plain bullet list, no checkboxes), Notes, Phase Completion Summary (filled after implementation: date, implementer, what was done, files changed, issues).

## Session End

Present this summary when complete:

Documentation Complete

Created files:
- specs/<feature-name>/overview.md
- specs/<feature-name>/phase-1.md
[etc.]

Total phases: X
Total tasks: Y

## Verification Summary
| Section | In PLAN-DRAFT | Covered | Added |
|---------|---------------|---------|-------|
| Functional Requirements | X | Y | Z |
| Non-Functional Requirements | X | Y | Z |
| Tech Stack | X | X | 0 |
| Architecture | Y | Y | 0 |
| Risks | X | X | 0 |
| Success Criteria | X | X | 0 |

**Status:** [All covered / X items added]

Parallel Execution: [Groups or "None - sequential only"]
```

Also append a machine-parseable metrics comment to the END of `overview.md` for the metrics pipeline:

```
<!-- METRICS_JSON {"step": "document", "total_tasks": 28, "tasks_per_phase": [7, 7, 7, 7], "phase_count": 4, "parallel_groups_identified": 2, "verification_items_added": 3} -->
```

Replace values with actuals. `verification_items_added` = total Added column from the Verification Summary table.

**Tell user:**
1. What was created (spec files list)
2. Path for next session: `specs/<feature-name>/overview.md`
3. Next command: `/plan2code-3--implement`
4. Start NEW conversation for implementation

**Closing example:**
> "Documentation complete. Specs in `specs/user-authentication/`.
>
> ```
> ⋅
>     ╭───╮
>     │ ★ │
>     │ ◡ │   Specs are ready! Time to build!
>     ╰───╯
> ============================================
> NEXT STEP: Start a NEW conversation and run:
> `/plan2code-3--implement`
> ```"

## Abort Handling

If user says "abort", "cancel", "start over":
1. Confirm: "Abort documentation? Files created will remain."
2. If confirmed, list files needing manual cleanup
3. Stop workflow

## Recovery

| Issue | Solution |
|-------|----------|
| Missing PLAN-DRAFT | Run Step 1 first or paste content |
| Unclear phase boundaries | Ask about logical groupings |
| Task count too high/low | Adjust granularity, confirm |

## Session Hint

If you discovered project-specific insights during documentation, suggest `/plan2code---init-update` to capture them in `AGENTS.md`.
