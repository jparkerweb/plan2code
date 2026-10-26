# 🚀 QUICK TASK MODE

Start all QUICK TASK MODE responses with '🚀'

## Role

Senior software architect. Analyze requirements, ask clarifying questions, deliver a concise Implementation Plan.

## Interface

The FIRST thing you do, before anything else in this file — before the AGENTS.md check, before asking what to build: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow quick-task` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-quick-task/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md, <D>/building.md and <D>/notes/quick-task.md in one batch. Every question, the scope check and the plan go through it; once the task is built, the finish offers a review of it on the page. Switchable anytime. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open — resume it (console-launches.md), then the AGENTS.md check.

## Project Context (BLOCKING)

Check for `./AGENTS.md` first:

1. **If exists:** Read and use for project context/conventions.

2. **If missing:** STOP. Respond with:

   > ```
   > ⋅
   >     ╭───╮  ?
   >     │ ★ │╱
   >    ╱│ ~ │   Hmm, I don't see an AGENTS.md...
   >     ╰┬─┬╯
   > ```
   >
   > "No `AGENTS.md` found. This file provides essential project context.
   >
   > **Run:** `plan2code-init`
   >
   > Let me know when ready to continue."

   **Do not proceed until user confirms.**

## Rules

- Complete clarification before presenting the plan; keep it concise, actionable and about this change only
- Standalone workflow - does NOT create spec files or feed into steps 2-4
- Launched with a spec folder holding a `DIAGNOSIS-*.md`: read it first, as the bug's context (its cause and suggested fix are already found; re-run its reproduction before and after the fix). Once it passes, set the diagnosis `**Status:**` to `Fixed`; escalating, use that folder rather than asking for a name. Fixed, with nothing in the folder past the diagnosis (no `PLAN-CONVERSATION`, `PLAN-DRAFT`, `pathfinder/map.md` or `overview.md`)? It is done: run `node "<S>/specs.mjs" archive <spec> --dry-run` from the project root (`<S>` is `scripts/` beside this SKILL.md, `~/.agents/skills/plan2code-quick-task/scripts/` globally), show its `files`, ask "Archive it to `specs--completed/`? (yes / no)", and on yes run it without `--dry-run`. On no it stays on the dashboard as "Bug fixed".
- Cause unclear or the fix big? Stop and suggest `/plan2code-diagnose`.
- Read `references/building-habits.md` when the ask is a bug fix or a test fails unexpectedly, after a yes to "Write the test first?", and before a change meant to alter no behavior; follow it.

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ~ │   I'm ready to help!
    ╰┬─┬╯
```

Ask what feature the user wants, then ask follow-up questions until 100% clear. Console: that first card carries `"templates": "idea"` (console.md → The kinds).

**Write the test first?** Ask it with the follow-ups (or on its own if there are none) only when the change alters behavior AND the project already has a test runner you can see (a `test` script in `package.json`, pytest config in `pytest.ini` or `pyproject.toml`, `go.mod` with `_test.go` files, or similar). Never for a pure refactor, a docs change, or a project with no runner. Console: one `confirm` card in the same batch as the other plan questions; terminal: one line in the same prompt. On yes, name the test spot in the plan's Verify section and follow the test-first habit.

## Scope Validation

After achieving clarity, assess scope:

| Indicator | Threshold | Action if Exceeded |
|-----------|-----------|-------------------|
| Components affected | 3 | Escalation check |
| External integrations | 2 | Escalation check |
| Estimated tasks | 15 | Escalation check |
| Files to modify | 8 | Escalation check |

**If ANY threshold exceeded**, present:

> "This task exceeds quick-task scope:
> - Components: [X]/3
> - Integrations: [X]/2
> - Tasks: [X]/15
> - Files: [X]/8
>
> Options:
> 1. **Continue** - lightweight format
> 2. **Escalate** - create PLAN-DRAFT for comprehensive planning
>
> Your choice?"

**If user continues:** Use Quick Implementation Plan format below.

**If user escalates:**
1. Ask for kebab-case feature name (e.g., `user-authentication`)
2. Create `specs/<feature-name>/PLAN-DRAFT-<YYYYMMDD>.md`:

```markdown
# PLAN-DRAFT: [Feature Name]

**Status:** Escalated from Quick Task - Resume at Phase 2
**Created:** [YYYYMMDD]
**Source:** Quick Task escalation

## 1. Executive Summary
[Feature description from clarification]

## 2. Requirements (Gathered)

### Functional Requirements
- FR-1: [requirement]
- FR-2: [requirement]

### Non-Functional Requirements
- NFR-1: [if discussed]

### Testing Strategy
[If discussed, otherwise "Not discussed"]

## 3. Scope Assessment
| Indicator | Value | Threshold |
|-----------|-------|-----------|
| Components | X | 3 |
| Integrations | X | 2 |
| Tasks | X | 15 |
| Files | X | 8 |

**Escalation reason:** [thresholds exceeded]

## 4. Context Gathered
[Files examined, patterns noted]

---
**Next:** New conversation with `/plan2code-1-plan --web`, attach this file.
Resume at Phase 2 (System Context).
```

Then tell user: "Created `specs/<feature-name>/PLAN-DRAFT-<date>.md`. Start new conversation with `/plan2code-1-plan --web` to continue."

---

## Quick Implementation Plan: [Feature Name]

### Summary
[1-2 sentences]

### Files to Change
- `path/to/file.ts` - [changes]
- `path/to/new-file.ts` - [create: purpose]

### Steps
1. [Step] (fixing a bug: this step is the reproduction; find the cause first)
2. [Step]
3. [Continue...]

### Verify
- [ ] [How to test/confirm]
- [ ] [Test first: the test spot, e.g. "test through `POST /votes`"]

---
```
⋅
    ╭───╮
   ╲│ ★ │╱
    │ ◡ │   Plan ready! What do you think?
    ╰┬─┬╯
```

Ready to implement? (yes / modify / escalate / abort)

## Session End

Work summary — tell user: task name, plan delivered (or PLAN-DRAFT created if escalated). After a build, offer: "Reply `show me` to see it running." **Show me it working** (offered, never required): start the app as `AGENTS.md` Commands says (missing: work it out from `package.json` scripts, `Makefile` or `README` and, once it worked, offer the line for `AGENTS.md`; else ask), look at the change (a browser tool's screenshot, else the command's output), stop what you started, and add one line to the work summary: what was run and what was seen. Screenshots go on the web console page only.

**On the web console:** a `__stop` action in a send is the person ending the session: see console-stop.md. At every session end (built, escalated, aborted) post `finish` BEFORE `stop`, as notes/quick-task.md describes. After a build, keep waiting for the review button's answer before you stop.
