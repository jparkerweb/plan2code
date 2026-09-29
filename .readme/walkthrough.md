# Walkthrough: one feature, start to finish

A REST API for task management, from a sentence to archived specs. Every block below is a **separate
conversation** — that's the whole trick.

← [Back to README](../README.md)

> **Prefer a page to a terminal?** Every skill can run in your browser — start at the
> `/plan2code` dashboard, add `--web` to a direct command (e.g. `/plan2code-1-plan --web`),
> or choose the console when offered. Questions, sign-offs and build progress stay on the page.
> See [web-console.md](web-console.md).

---

## Session 1 — Plan

```
You:  /plan2code-1-plan
      I want to build a REST API for a task management application.

AI:   🤔 [REQUIREMENTS ANALYSIS]
      Six questions. Four of them I need answered before I can size this.
      ...

AI:   🤔 [TECH STACK]
      Proposing Fastify + Postgres + Zod. I don't pick this alone — sign off?

You:  approved

AI:   🤔 [ARCHITECTURE DESIGN]
      ...

AI:   🤔 [TRANSITION DECISION]
      Confidence: 92% (gate is 90%). Assumptions written to the draft: 3.
      → specs/task-api/PLAN-DRAFT-20260804.md
```

Two files land: the draft, and a `PLAN-CONVERSATION-*.md` log of how you got there.

> **Started foggy instead?** Run `/plan2code-0-pathfinder` first. When its map clears it writes a
> `PLAN-DRAFT` that Step 1 picks up at Phase 4, with requirements and scope already answered.

---

## Session 2 — Document

```
You:  /plan2code-2-document
      specs/task-api/PLAN-DRAFT-20260804.md

AI:   📝 [DOCUMENTATION]
      Creating specs/task-api/overview.md
      Creating specs/task-api/Phase 1.md   Project setup           (6 tasks)
      Creating specs/task-api/Phase 2.md   Data model              (8 tasks)
      Creating specs/task-api/Phase 3.md   API endpoints          (11 tasks)
      Creating specs/task-api/Phase 4.md   Authentication          (7 tasks)

      Parallel execution groups: Phase 3 and Phase 4 don't share files.
```

---

## Sessions 3…N — Implement, one phase each

```
You:  /plan2code-3-implement
      specs/task-api/overview.md

AI:   ⚡ [PHASE 1: Project setup]
      (Phase 1 is the next unchecked phase.)
      ...
      ✓ 6/6 tasks. Checkboxes updated in Phase 1.md and overview.md.
      Next: Phase 2 — Data model (8 tasks). New conversation.
```

Repeat. New conversation each time. It always finds the next open phase itself.

When you reach a parallel group, it offers you the choice — open a second agent, take the other
phase, and the `[/]` marks keep them from colliding.

Use `/plan2code-3-implement-review` instead when review should run automatically before phase approval. `/plan2code-review` remains available for an independent second opinion at any other time.

---

## Final session — Finalize

```
You:  /plan2code-4-finalize
      specs/task-api/overview.md

AI:   🧹 [VALIDATION]
      All 32 tasks verified against the phase specs. 2 gaps found and fixed.

AI:   🧹 [DOCUMENTATION REVIEW]
      README needs the new /tasks endpoints. AGENTS.md is current.

AI:   🧹 [SPEC CLEANUP]
      Moved specs/task-api/ → specs--completed/task-api/

      Implementation complete.
```

---

## If requirements move mid-build

Don't patch the code and hope the specs catch up. Run `/plan2code-1b-revise-plan` — it edits the
specs (and only the specs), so the drawing and the build stay in agreement.
