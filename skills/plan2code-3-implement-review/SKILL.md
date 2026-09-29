---
name: plan2code-3-implement-review
description: "Plan2Code Step 3: Implementation + Review Mode - user-initiated workflow step. Do not invoke autonomously."
disable-model-invocation: true
---

# ⚡ IMPLEMENT + REVIEW MODE

Start implementation responses with `⚡ [PHASE X: Phase Name]`. Start the review transition and review responses with `🔬 [Review Mode]` as directed by the review workflow. Return to the implementation header for final sign-off.

## Role

Orchestrate one implementation phase and its focused independent review as a single quality-gated workflow. The user approves only after implementation, review, selected fixes, and verification are finished.

## Web Console

The FIRST thing you do, before anything else in this file: Implementation Mode's Interface question — **web console** or **terminal**? On the web console, run `node "<D>/console.mjs" open --workflow implement-review` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-3-implement-review/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then follow <D>/building.md → Implement + Review: the Stage 2 findings go out as the page's fix list, Stage 4 is the only sign-off item, and the Stage 5 `finish` never carries the review offer. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open — resume it (console.md → Launches), then the spec.

## Controlling Contract

This file controls the two referenced workflows. Follow each referenced workflow except where this contract overrides its transition, sign-off, approval, session-end, or scope instructions.

- Follow `./AGENTS.md` if it exists.
- Keep the phase `[/]` until the final reviewed implementation is approved.
- Never treat implementation completion, review completion, or a fix selection as phase approval.
- Never ask for implementation sign-off before review.
- Never invoke another installed skill; load the packaged references below.
- Preserve Implementation Mode's rule that tests run only when explicitly listed as a phase task.
- Track an exact phase change set: files created or modified while implementing this phase, plus implementation artifacts named by its tasks. Do not include unrelated working-tree changes.
- Abort, blockers, and spec conflicts stop or pause the combined workflow exactly as Implementation Mode requires. Do not begin review when implementation cannot reach its self-review gate.

## Stage 1: Implement

Read references/implement.md

Follow Implementation Mode through Process Step 4, including task status writes, the Phase Completion Summary, and the Self-Review Checklist.

Override Implementation Mode at the sign-off boundary:

1. Do not run Process Step 5 yet.
2. Do not render `READY FOR SIGN-OFF` or ask the user to reply `approved`.
3. Do not run `After Approval / Session End`.
4. Keep overview.md at `[/]` and the phase status `In Progress`.
5. Preserve the completion data needed for the final report and transition immediately to Stage 2.

## Stage 2: Review Before Sign-Off

State:

> 🔬 [Review Mode] Implementation complete; reviewing before sign-off.

Read references/review.md

Run Review Mode with this explicit scope:

- Scope is **Focused**.
- Review the exact phase change set tracked in Stage 1, including any relevant tests and documentation changed for the phase.
- Use overview.md and the active phase file for spec-compliance context; they do not broaden scope to other phases.
- Read related callers, dependencies, and project files when needed to verify a finding, but do not turn them into unrelated review targets.
- Review all changed files completely and apply the full focused-review depth required by Review Mode.

Override Review Mode's completion and session-end behavior:

1. Do not provide commit instructions or next-conversation routing.
2. Do not ask the user to approve the review or commit.
3. If there are findings, present Review Mode's normal `H`, `A`, and `S` fix options and wait for the user's choice.
4. If there are zero findings, proceed directly to Stage 4.
5. If the user explicitly declines or defers findings, preserve them as unresolved and proceed to Stage 4.

## Stage 3: Resolve Findings

When the user selects fixes, follow Review Mode's Post-Fix Flow to plan, apply, and verify them.

- Add every review-fix file to the phase change set.
- Re-read every file modified by a fix and check for introduced issues.
- Update the Phase Completion Summary if a fix materially changes the implementation summary or test results.
- Do not mark the phase complete and do not ask for approval during fix processing.
- Ignore Review Mode's `Reply approved to commit` instruction; selected-fix verification transitions directly to Stage 4.
- When selected fixes are verified, preserve any unselected findings as unresolved and proceed to Stage 4.

## Stage 4: Final Implementation Sign-Off

Return to Implementation Mode and render its Completion Report Format with header:

> ⚡ [PHASE X: Phase Name] - REVIEWED AND READY FOR SIGN-OFF

Include the normal implementation completion sections plus:

- **Review Results:** scope, files reviewed, finding totals by severity, and fixes applied.
- **Unresolved Review Findings:** concise numbered list, or `None`.
- **Verify:** include the review-fix verification alongside the implementation checks.

Then ask:

> Reply `approved` to mark this reviewed phase complete, or describe any issues.

Only this prompt can obtain phase approval.

## Stage 5: After Approval

When the user replies `approved` to the final sign-off:

1. Run Implementation Mode's `After Approval / Session End` actions.
2. Mark overview.md `[/]` to `[x]` and set the phase status to `Complete`.
3. Provide the work summary, upcoming phases, commit command, and next pipeline step.
4. Do not suggest `/plan2code-review`; this phase has already passed that gate.
5. Mention `/plan2code-1b-revise-plan` only when it remains relevant.

If the user instead reports an issue, address it, update the phase change set, rerun focused review on the affected files, and return to Stage 4.