# Community Feedback Submission (STEP 6.5 detail)

> Loaded by `src/plan2code-4-finalize.md` STEP 6.5. This file has no character limit (see `AGENTS-architecture.md` Reference Files).

## 1. Generate a fresh `run_id`

Compute your own current timestamp and a freshly generated random 4-character hex string — do not reuse the example value shown below or anywhere in this spec. Format: `run-<YYYYMMDD>-<HHMMSS>-<4-hex-chars>` (e.g. `run-20260715-143000-a1b2`).

## 2. Assemble the payload

Read `PLAN-DRAFT-*.md`, `phase-*.md`, and `overview.md` in `specs--completed/<feature-name>/` (STEP 6 has already archived them there) and reason over their content to gather:

- `step1`: `final_confidence`, `confidence_breakdown` (`{requirements, feasibility, integration, risk}`), `clarification_rounds`, `tech_stack_revision_rounds`, `verification_gaps_found`, `functional_requirements_count`, `non_functional_requirements_count`, `risk_count`, `phase_count`
- `step2`: `total_tasks`, `phase_count`, `parallel_groups_identified`, `requirement_coverage_percent`, `verification_items_added`
- `step3`: `task_completion_rate`, `tasks_completed`, `tasks_total`, `blocker_count`
- `step4`: `completion_rate_at_audit`, `verification_failures_found`, `documentation_updates_needed`, `archival_succeeded` (safe to read now that Step 6 has run)
- `plan2code_version` — from `version.json`
- `prompt_versions_short` — first 12 characters of each of the 8 prompt file names' content (`plan`, `revise_plan`, `document`, `implement`, `finalize`, `init`, `init_update`, `quick_task`). You do not have `sha256File()` available — note these as best-effort/approximate if you cannot compute a real hash, or omit the field entirely if you cannot.

**Never include** `project.name` or any bulky arrays (e.g. `tasks_per_phase`).

Include the feedback collected at Step 5 as `user_feedback`: `overall_rating`, `rating_reason`, `what_went_well`, `what_went_poorly`.

Assemble the full nested JSON object matching this schema exactly:

```json
{
  "schema_version": "1.0",
  "run_id": "run-<YYYYMMDD>-<HHMMSS>-<4-hex>",
  "plan2code_version": "<from version.json>",
  "prompt_versions_short": { "plan": "...", "revise_plan": "...", "document": "...", "implement": "...", "finalize": "...", "init": "...", "init_update": "...", "quick_task": "..." },
  "step1": { "final_confidence": 0, "confidence_breakdown": { "requirements": 0, "feasibility": 0, "integration": 0, "risk": 0 }, "clarification_rounds": 0, "tech_stack_revision_rounds": 0, "verification_gaps_found": 0, "functional_requirements_count": 0, "non_functional_requirements_count": 0, "risk_count": 0, "phase_count": 0 },
  "step2": { "total_tasks": 0, "phase_count": 0, "parallel_groups_identified": 0, "requirement_coverage_percent": 0, "verification_items_added": 0 },
  "step3": { "task_completion_rate": 0, "tasks_completed": 0, "tasks_total": 0, "blocker_count": 0 },
  "step4": { "completion_rate_at_audit": 0, "verification_failures_found": 0, "documentation_updates_needed": 0, "archival_succeeded": true },
  "user_feedback": { "overall_rating": 0, "rating_reason": "...", "what_went_well": "...", "what_went_poorly": "..." }
}
```

## 3. Render the GitHub Issue

- **Title:** `` `[Feedback] v<plan2code_version> — rating <N>/10` `` (e.g. `[Feedback] v1.15.3 — rating 8/10`)
- **Body:** a short human-readable markdown summary (version, rating, headline numbers such as completion rate and confidence), followed by the full payload as `<!-- METRICS_JSON {...} -->` (same HTML-comment convention used in Step 7's own summary block)
- **Label:** `community-feedback`

Estimate the combined URL-encoded size of `title` + `body` + `labels`. If it exceeds roughly 8KB, warn the user and offer to truncate the longest free-text `user_feedback` field(s) — starting with `rating_reason`, then `what_went_well`/`what_went_poorly` — before proceeding. This size limit only affects the browser/print fallback tiers (below), not the `gh` CLI tier.

## 4. Preview and approval gate

Display the exact rendered title, full body (including the `METRICS_JSON` block), and label(s) to the user, mirroring the Step 4 Documentation Review pattern:

```
⋅
    ╭───╮
    │ ● │
    │ ~ │   Ready to submit your feedback to the maintainer!
    ╰───╯
```

> Reply "approve" to proceed with submission, or "skip" to cancel.

Do NOT proceed to submission without an explicit "approve" reply. A "skip" or any non-approval reply cancels this sub-step entirely and proceeds to Step 7 with no submission.

## 5. Tiered submission

On approval, attempt each tier in order until one succeeds:

1. **Tier 1 (primary):** Attempt `gh issue create --repo jparkerweb/plan2code --title "<title>" --body "<body>" --label community-feedback` via your shell tool. If it succeeds, report the created issue URL to the user and stop.
2. **Tier 2 (secondary):** If `gh` is not installed or not authenticated (command fails), construct the URL `https://github.com/jparkerweb/plan2code/issues/new?title=<url-encoded title>&body=<url-encoded body>&labels=community-feedback` and attempt to open it in the user's default browser using the OS-appropriate command (`start "<url>"` on Windows, `open "<url>"` on macOS, `xdg-open "<url>"` on Linux). Tell the user they still need to click "Submit issue" themselves since they must be logged in.
3. **Tier 3 (tertiary):** If no browser can be opened (e.g. no shell tool access, headless/remote session), print the same URL from Tier 2 to the terminal/chat: "Please open this URL in your browser and click 'Submit issue' to share your feedback: `<url>`".

After any tier succeeds (or the user manually confirms Tier 3 submission), proceed to Step 7 as normal.
