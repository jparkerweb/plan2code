# Metrics &amp; Self-Improvement

`plan2code-metrics` closes the loop on the workflow itself: it collects data from your finished
specs, aggregates it across runs and prompt generations, then uses AI to diagnose which step is
underperforming and propose edits to the workflow prompts.

Aimed at **contributors and heavy users** — you don't need it to use Plan2Code.

← [Back to README](../README.md)

---

## The habit

One thing to remember: **collect after every finished spec.** Everything else is on demand.

```bash
# Install once, from the plan2code root
node install.js     # A  (everything + dev tools)  — or  C → M  (metrics only)

# After finishing a spec (steps 1–4)
cd your-project
plan2code-metrics   # → "Collect metrics" → pick the spec dir → done, ~5 seconds
```

Then, when you're curious or have a few runs banked:

```bash
plan2code-metrics   # → "View metrics status"            the dashboard
                      # → "Run analysis"                   AI diagnosis of weak steps
                      # → "Generate improvement proposal"  concrete prompt edits
                      # → "Review and apply"               patch src/plan2code-*.md
```

## How much data you need

| Runs | What you get |
|------|--------------|
| **1** | Raw data and a basic dashboard. Start here. |
| **3+** | AI analysis unlocks. Pattern detection starts working. |
| **5–10+** | Averages stabilise; generation-over-generation comparisons become meaningful. |

You're looking for trends, not individual scores.

---

## Sending feedback upstream

`/plan2code-4-finalize` can submit an anonymised metrics payload to the maintainers as a
`community-feedback` issue on the repo. Community runs are cohorted by the Plan2Code version that
produced them, so your data improves the prompts everyone installs — without displacing the
maintainer's own measurements.

---

## Full documentation

Data model, aggregation, cohorts, analysis prompts, and the ingestion flow:
[`plan2code-metrics/README.md`](../plan2code-metrics/README.md)
