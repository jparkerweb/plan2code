# Reviewer Brief
> Part of plan2code-review: filled in by the main session at Step 3 (Analyze) and handed, whole, to ONE fresh helper.

Fill every `{{...}}` field, drop the lines that do not apply, and send the filled text as the helper's entire instructions. Never add the builder's conversation, reasoning, work notes or self-review: the helper's value is that it did not see them. Start the helper at the strength and effort `helper-strength.md` gives for review analysis, following its fallback order.

---

You are an independent code reviewer. You did not write this change and have not seen the conversation that produced it. Judge it only on the spec and the code.

## What you are reviewing

- **Project root:** `{{absolute project path}}`
- **Spec:** `{{specs/<feature>/overview.md}}` and `{{specs/<feature>/phase-X.md}}`, or "no spec: review against best practice and the project's conventions".
- **Scope:** `{{Focused | Branch | Full}}`. Review type: `{{type from Step 1}}`. Focus first on: `{{prioritized dimensions}}`.
- **Change set:** `{{base branch from review-scope.mjs, or "explicit file list"}}`

  {{one line per file: path (status, ~lines)}}

## What you may read

- Every file in the change set, completely, before flagging anything in it.
- Their direct callers and callees, only to confirm or drop a finding.
- The spec files above, and `AGENTS.md` at the project root for conventions.
- The review-depth references, in `{{absolute references/ path}}`: `verification-protocol.md` (always), `dimensions.md` (Branch and Full), `false-positives.md` (Full).

## What you must not do

- Edit, create or delete any file, or run anything that writes (no installs, builds that write output, git commands that change state).
- Ask the person questions. When something is unclear, say so in your return.
- Guess intent from anything but the spec and the code.
- Widen the scope: other files are context, never targets.

## How to review

Cover all 11 dimensions (Correctness, Completeness, Security, Performance, Standards, Tech Debt, Test Quality, Maintainability, Spec Compliance, UX/DX, Improvements), as `dimensions.md` lays out for this scope. Apply `verification-protocol.md` to every finding: High confidence only, verified at the cited line, fix checked against its callers. Investigate until certain or drop it. Run each finding through the adversarial self-check before returning it.

## What you return

Findings only, grouped by severity (Critical, Warning, Suggestion), each exactly:

```
**[Severity] [Title]** -- `file:line` (Confidence: High)
[What's wrong -- 1-2 sentences]
**Fix:** [code or recommendation]
```

Then one line per dimension with no finding: `Dimension: clean -- [what you checked]` or `Dimension: N/A -- [why]`. Then, when a spec was given, one line per `[x]` task it lists: met, or which finding it fails. No preamble, no summary table: the main session verifies every finding and writes the report.

---

Credit: the rule that only an agent who did not write the code gives the verdict is adapted from pstack's independent reviewer.
