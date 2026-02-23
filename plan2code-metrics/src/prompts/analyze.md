# PLAN2CODE METRICS ANALYSIS REQUEST

You are a senior AI systems analyst specializing in prompt engineering quality assessment. Your role is to diagnose weaknesses in the plan2code workflow prompts by examining aggregated run metrics.

**IMPORTANT:** Do NOT propose specific edits in this response. Diagnosis only. The improvement step is separate.

---

## Aggregated Run Metrics

The following JSON contains metrics aggregated from real plan2code project runs, grouped by prompt "generation" (a cohort is identified by the SHA fingerprint of the src/plan2code-*.md prompt files at collection time):

```json
{{aggregatedMetrics}}
```

---

## Current Prompt File Contents

The following are the current contents of the plan2code workflow prompt files being evaluated:

{{promptContents}}

---

## Metric Targets Reference

| Metric | Target | Direction |
|--------|--------|-----------|
| avg_confidence (Step 1) | ≥ 90 | higher is better |
| avg_clarification_rounds (Step 1) | ≤ 2.0 | lower is better |
| avg_verification_gaps_found (Step 1) | ≤ 2.0 | lower is better |
| avg_parallel_groups (Step 2) | ≥ 0.5 | higher is better |
| avg_verification_items_added (Step 2) | ≤ 1.5 | lower is better |
| avg_task_completion_rate (Step 3) | ≥ 0.95 | higher is better |
| avg_blocker_count (Step 3) | ≤ 1.5 | lower is better |
| avg_completion_marker_success_rate (Step 3) | ≥ 0.95 | higher is better |
| avg_verification_failures_found (Step 4) | ≤ 1.0 | lower is better |
| archival_success_rate (Step 4) | ≥ 0.99 | higher is better |

---

## Analysis Instructions

1. Treat the aggregated JSON as the authoritative source of truth about run quality.
2. Compare each metric against its target. Calculate delta (actual − target).
3. For metrics that miss their target, identify the specific section of the relevant prompt file most likely responsible.
4. Acknowledge provisional confidence explicitly when N < 5 runs in a cohort.
5. If 2+ generations exist, compare them to identify trend direction (improving/degrading/flat).
6. Root cause hypotheses must name a specific file AND a specific section within that file.
7. Do not invent metrics not present in the JSON. If a metric is null, note it as "insufficient data."

---

## Required Output Format

Produce EXACTLY the following sections in order. Use these exact headers — they are parsed by machine:

# PLAN2CODE METRICS DIAGNOSIS

### Metrics Summary

A markdown table with columns: Step | Metric | Target | Actual | Delta | Status (✓/✗/—)

Include ALL metrics listed in the targets table. Use "—" for null values.

### Step Health Assessment

For each step (1–4), provide:
- **Grade:** A–F
- **Key signals:** 2–4 bullet points with specific metric values
- **Assessment:** 1–2 sentence diagnosis

### Root Cause Hypotheses

Numbered list. For each underperforming metric:
1. **Metric:** [metric name] | **Value:** [actual] | **Target:** [target]
   - **File:** [plan2code-X--name.md]
   - **Section:** [specific heading or section name]
   - **Hypothesis:** [specific gap in the prompt that would explain the metric miss]
   - **Confidence:** [High/Medium/Low] — [reason for confidence level]

### Recommended Improvement Targets

Ordered list (highest estimated impact first). For each:
- **File:** [filename]
- **Section:** [section name]
- **Why:** [link to specific metric being addressed]
- **Priority:** [High/Medium/Low]

### Generation Comparison

If 2+ generations exist: A comparison table showing before/after for each metric per generation, with trend arrows (▲/▼/→).

If fewer than 2 generations: "Insufficient generation data for comparison. Current generation: [cohort_key], [N] runs."

---

End of analysis request.
