# Plan2Code Metrics
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

A recursive self-improvement toolchain for plan2code contributors. Collects run metrics, aggregates by prompt generation, diagnoses weak steps via AI, and proposes surgical prompt edits.

## Metrics Data Flow

```
Collect → Aggregate → Analyze → Improve → Apply
```

1. **Collector** reads project artifacts (`specs/<feature>/`) → writes `RunMetrics` JSON per run
2. **Aggregator** groups runs by prompt SHA fingerprint (cohorts) → `aggregated.json`
3. **Analyzer** invokes AI with aggregated metrics + prompt contents → diagnosis markdown
4. **Improver** invokes AI with diagnosis → validated `PromptEdit[]` proposals (char limit + verbatim checks)
5. **Applier** shows interactive diffs → patches `src/plan2code-*.md` files

## Metrics Commands

```bash
cd plan2code-metrics && npm run build  # Build the CLI
plan2code-metrics                      # Run (fully interactive, no flags)
```

## Metrics CLI Menu

| Option | Action |
|--------|--------|
| Collect | Read spec artifacts → run JSON |
| Import | Copy run JSON from another project |
| View | Display cohort metrics with health indicators |
| Analyze | AI diagnosis of weak metrics |
| Propose | AI improvement proposals with validation |
| Apply | Interactive diff review + file patching |
| Fetch community submissions | List/parse/import open community-feedback GitHub issues from jparkerweb/plan2code, close on success |

Community submissions arrive as GitHub issues labeled `community-feedback` on `jparkerweb/plan2code`, created by the finalize prompt's post-Step-6 submission flow; the "Fetch community submissions" option requires an authenticated `gh` CLI to list/close them.

## Key Source Files

| File | Purpose |
|------|---------|
| `types.ts` | All interfaces (`RunMetrics`, `UserFeedback`, `CohortMetrics`, etc.) + `METRIC_TARGETS` |
| `collector.ts` | Reads project artifacts → run JSON (parses plan drafts, overview.md, loop logs) |
| `aggregator.ts` | Merges runs by prompt generation (SHA cohort) → `aggregated.json` |
| `community.ts` | Lists/parses/closes `community-feedback`-labeled GitHub issues via `gh` CLI |
| `analyzer.ts` | AI diagnosis via `prompts/analyze.md` template |
| `improver.ts` | AI proposals via `prompts/improve.md` + validation (char count, old_text match) |
| `applier.ts` | Interactive diff review + file patching |
| `cli.ts` | Menu-driven interactive CLI (100% prompts, no flags) |
| `invoke-llm.ts` | Unified LLM interface (Claude Code, GitHub Copilot CLI, or Devin CLI) |

## User Feedback

The collector parses an optional `## User Feedback` table from `overview.md`:

```markdown
## User Feedback
| Field | Value |
|-------|-------|
| Rating | 8 |
| Reason | Smooth workflow |
| Went Well | Planning was thorough |
| Went Poorly | Some tasks unclear |
```

Feedback is collected during finalize (Step 5) or retroactively via the CLI. Pipe characters in values are escaped as `\|`. The aggregator computes `avg_user_rating` and `feedback_count` per cohort.

## Supported AI Agents

- **Claude Code** (recommended): `claude` CLI with `--inputFile` for prompt delivery
- **GitHub Copilot CLI**: `copilot` CLI with stdin prompt delivery
- **Devin CLI**: `devin` CLI with `--print --prompt-file <file> --permission-mode dangerous`

## Metric Targets

| Metric | Target | Direction |
|--------|--------|-----------|
| `avg_confidence` | ≥ 90 | higher is better |
| `avg_task_completion_rate` | ≥ 0.95 | higher is better |
| `avg_blocker_count` | ≤ 1.5 | lower is better |
| `avg_completion_marker_success_rate` | ≥ 0.95 | higher is better |
| `avg_verification_failures_found` | ≤ 1.0 | lower is better |
| `archival_success_rate` | ≥ 0.99 | higher is better |
| `avg_user_rating` | ≥ 7.0 | higher is better |

Data stored in `.plan2code-metrics/` (runs/, aggregated.json, proposals/).
