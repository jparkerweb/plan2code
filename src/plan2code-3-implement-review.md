# ⚡ IMPLEMENT + REVIEW MODE

Start implementation responses with `⚡ [PHASE X: Phase Name]`. Start the review transition and review responses with `🔬 [Review Mode]` as directed by the review workflow. Return to the implementation header for final sign-off.

## Role

Orchestrate one implementation phase and its focused independent review as a single quality-gated workflow. The user approves only after implementation, review, selected fixes, and verification are finished.

## Web Console

The FIRST thing you do, before anything else in this file: Implementation Mode's Interface question — **web console** or **terminal**? On the web console, run `node "<D>/console.mjs" open --workflow implement-review` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-3-implement-review/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md, <D>/building.md and <D>/notes/implement.md in one batch (all of it; its Implement + Review section covers Stages 2–5), and <D>/building-review.md when Stage 2 starts: the Stage 2 findings go out as the page's fix list, Stage 4 is the only sign-off item, and the Stage 5 `finish` never carries the review offer. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. `--loop` (only inside the desktop app): read <D>/notes/loop.md after console.md; it replaces the sign-off, marking and git steps, and Stages 2 to 4 run as its review section says. Launched by the dashboard? Its session is already open — resume it (console-launches.md), then the spec.

## Controlling Contract

This file controls the two referenced workflows. Follow each referenced workflow except where this contract overrides its transition, sign-off, approval, session-end, or scope instructions.

- Follow `./AGENTS.md` if it exists.
- Keep the phase `[/]` until the final reviewed implementation is approved.
- Never treat implementation completion, review completion, or a fix selection as phase approval.
- Never ask for implementation sign-off before review.
- Never invoke another installed skill; load the packaged references below.
- Preserve Implementation Mode's tests rule: after each task the tests covering what it touched; at phase end the phase file's `## Phase Testing` lines plus tests for any other file the phase changed; never the full suite unless the phase file lists a `Full suite:` line. Read `references/test-runs.md` before the first test run of a phase.
- Track an exact phase change set: files created or modified while implementing this phase, plus implementation artifacts named by its tasks. Do not include unrelated working-tree changes.
- Abort, blockers, and spec conflicts stop or pause the combined workflow exactly as Implementation Mode requires. Do not begin review when implementation cannot reach its self-review gate.

## Stage 1: Implement

Read references/implement.md

The habits in `references/building-habits.md` apply exactly as Implementation Mode reads them.

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

Read references/review.md and references/review-in-build.md

Run Review Mode as `references/review-in-build.md` says, over the exact phase change set tracked in Stage 1 (including the relevant tests and documentation changed for the phase). Findings go to the person as Review Mode's `H`, `A` and `S` options; zero findings go straight to Stage 4, and declined or deferred findings stay unresolved.

## Stage 3: Resolve Findings

When the user selects fixes, apply and verify them as `references/review-in-build.md` says (Fixing). Every review-fix file joins the phase change set. Selected-fix verification goes straight to Stage 4 with any unselected findings kept as unresolved; do not mark the phase complete or ask for approval here.

## Stage 4: Final Implementation Sign-Off

Return to Implementation Mode and render its Completion Report Format with header:

> ⚡ [PHASE X: Phase Name] - REVIEWED AND READY FOR SIGN-OFF

Include the normal implementation completion sections plus:

- **Review Results:** scope, files reviewed, the Reviewed by line, finding totals by severity, and fixes applied.
- **Unresolved Review Findings:** concise numbered list, or `None`.
- **Verify:** include the review-fix verification alongside the implementation checks.

Then ask:

> Reply `approved` to mark this reviewed phase complete, `show me` to see it running first (Implementation Mode's Show me it working, references/implement.md), or describe any issues.

Only this prompt can obtain phase approval.

## Stage 5: After Approval

When the user replies `approved` to the final sign-off:

1. Run Implementation Mode's `After Approval / Session End` actions.
2. Mark overview.md `[/]` to `[x]` and set the phase status to `Complete` (`specs.mjs mark --to done`, per Implementation Mode's Scripts; `<S>` is this skill's own `scripts/`).
3. Provide the work summary, upcoming phases, commit command, and next pipeline step.
4. Do not suggest `/plan2code-review`; this phase has already passed that gate.
5. Mention `/plan2code-1b-revise-plan` only when it remains relevant.

If the user instead reports an issue, address it, update the phase change set, rerun focused review on the affected files, and return to Stage 4.