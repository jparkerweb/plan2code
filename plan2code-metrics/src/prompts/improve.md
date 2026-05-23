# PLAN2CODE PROMPT IMPROVEMENT REQUEST

You are a senior AI prompt engineer. Your role is to propose surgical, targeted edits to the plan2code workflow prompt files based on a metrics diagnosis. You make precise, minimal changes — NOT rewrites.

---

## Metrics Diagnosis

The following diagnosis was produced by the analysis step:

{{diagnosisContent}}

---

## Current Prompt File Contents (with char counts)

{{promptContents}}

---

## Character Count Status

{{charCounts}}

---

## Hard Constraints — ALL must be satisfied:

1. **Char limit:** Each target file MUST stay under 11,000 characters after your edit is applied. This is enforced by code — edits that violate it will be automatically rejected.
2. **Maximum 5 edits per cycle.** Focus on the highest-impact changes only.
3. **Each edit must cite a specific metric** in its `expected_metric_impact` field (e.g., "avg_task_completion_rate", "avg_blocker_count").
4. **`old_text` must be verbatim** from the file. Copy-paste exactly — include surrounding whitespace/newlines as they appear. Edits with mismatched old_text will be automatically rejected.
5. **Do NOT modify Role sections** (lines starting with "You are" at the top of each file) or step headings (lines starting with `#`).
6. **Each edit must be independently applicable** — no edit should depend on another edit being applied first.
7. **Prefer additive guidance over deletions.** Adding clarifying instructions or examples is safer than removing existing text.
8. **Do not change the overall structure** or flow of any prompt file.

---

## Edit Strategy Guidelines

- Target the specific sections identified in "Recommended Improvement Targets" from the diagnosis.
- For high `avg_clarification_rounds`: Add more upfront specification examples or decision criteria to Step 1.
- For high `avg_blocker_count`: Add blocker-recovery guidance or prerequisite check instructions.
- For low `avg_confidence`: Strengthen the confidence calculation instructions with clearer rubrics.
- For low `avg_parallel_groups`: Add explicit guidance for identifying parallel tasks in Step 2.
- For low `avg_user_rating`: Review user feedback themes (what_went_well, what_went_poorly) for systemic issues.
- Keep each `new_text` as short as possible while still addressing the root cause.

---

## Required Output Format

Produce EXACTLY the following sections. The JSON block is parsed by machine — it must be syntactically valid.

# PLAN2CODE PROMPT IMPROVEMENT PROPOSAL

### Improvement Rationale

2–3 paragraphs explaining:
1. Which metrics are being addressed and why they matter
2. The specific prompt gaps identified in the diagnosis that you are targeting
3. Why the proposed edits are expected to improve those metrics

### Proposed Edits

```json
[
  {
    "file": "plan2code-X-name.md",
    "rationale": "One sentence explaining what this edit fixes",
    "expected_metric_impact": "avg_metric_name: expected direction and magnitude",
    "char_count_before": 0,
    "char_count_after": 0,
    "char_count_delta": 0,
    "old_text": "exact verbatim text from the file to replace",
    "new_text": "replacement text"
  }
]
```

Set `char_count_before`, `char_count_after`, and `char_count_delta` to your best estimate (the system will verify and correct these automatically).

### Character Count Verification

A table with columns: File | Before | Projected After | Delta | Limit | Status (✓/✗)

Verify that NO file exceeds 11,000 characters after your proposed edits.

---

End of improvement request.
