# Review Inside a Build
> Read by Review, Implement, Implement + Review and Quick Task when a review runs inside a build: before a phase is signed off, or after a quick task is built. Never invoked as a skill. The web console's `building-review.md` adds only what the page does differently.

Run Review Mode (`references/review.md`, or this skill's own SKILL.md in Review) with these rules. They win over Review Mode's own scope questions, completion and session-end steps.

## Scope

- Scope is **Focused** and already decided. Do not ask about it.
- The change set is exact: files created or modified in this build (the phase or the quick task), the artifacts its tasks name, and the tests and docs changed for it. Unrelated working-tree changes are not in it.
- `overview.md` and the phase file give spec-compliance context. They never widen the scope to other phases.
- Read callers, dependencies and project files when you need them to verify a finding. They are not review targets.
- Review every changed file completely, at the full Focused depth Review Mode requires.

## Who reviews

A fresh helper runs the analysis when your tool can start one and helpers are not switched off, at the strength `references/helper-strength.md` gives (standard and high; strongest and high when the change touches security, auth or data). This session verifies every finding. The report carries the Reviewed by line. The helper's brief holds the phase file (when there is one) and the change set only, never the build's work notes.

## Ending the review

- No commit instructions, no next-conversation routing, and no request to approve the review or a commit. Ignore Review Mode's `Reply approved to commit`.
- Findings: offer Review Mode's `H`, `A` and `S` fix options and wait. Zero findings: go straight back to the build's report. Findings the person declines or defers stay as unresolved.

## Fixing

Follow Review Mode's Post-Fix Flow. Add every fixed file to the change set, re-read each one and check it for new problems, and run the tests that cover the fixes (`references/test-runs.md`). Update the completion summary only when a fix changes what it says. Choosing fixes is never approval.

## Back to the build

- The phase stays `[/]` and no checkbox moves. Only the build's own sign-off prompt, asked after the review, can approve.
- The final report adds **Review Results** (scope, files reviewed, the Reviewed by line, totals by severity, fixes applied) and **Unresolved Review Findings** (a short numbered list, or `None`), and its Verify section includes the fix checks.
- A quick task has no sign-off: its summary carries the same review results and the commit command for the task and its fixes together.
