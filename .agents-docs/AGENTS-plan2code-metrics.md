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

Run `plan2code-metrics` (fully interactive, no flags). Build and test commands: see [Development Commands](./AGENTS-development-commands.md).

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
| Delete metrics data | Delete selected runs, all runs + aggregated data, or everything including proposals |

Community submissions arrive as GitHub issues labeled `community-feedback` on `jparkerweb/plan2code`, created by the finalize prompt's post-Step-6 submission flow; the "Fetch community submissions" option requires an authenticated `gh` CLI to list/close them.

## Key Source Files

| File | Purpose |
|------|---------|
| `types.ts` | All interfaces (`RunMetrics`, `UserFeedback`, `CohortMetrics`, etc.) + `METRIC_TARGETS` |
| `collector.ts` | Reads project artifacts → run JSON (parses plan drafts, overview.md, phase files) and fingerprints every `src/plan2code-*.md` prompt |
| `metrics-pattern.json` | The scrape shapes the collector reads, a byte-for-byte copy of `src/web-console/metrics-pattern.json` |
| `aggregator.ts` | Merges runs by prompt generation (SHA cohort) → `aggregated.json` |
| `community.ts` | Lists/parses/closes `community-feedback`-labeled GitHub issues via `gh` CLI |
| `analyzer.ts` | AI diagnosis via `prompts/analyze.md` template |
| `improver.ts` | AI proposals via `prompts/improve.md` + validation (char count, old_text match) |
| `applier.ts` | Interactive diff review + file patching |
| `cli.ts` | Menu-driven interactive CLI (100% prompts, no flags) |
| `invoke-llm.ts` | Unified LLM interface (Claude Code, GitHub Copilot CLI, or Devin CLI) |
| `*.test.ts` | vitest suites for aggregator, collector, community, improver (`npm test` in `plan2code-metrics/`) |

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

- **Claude Code** (recommended): `claude --print --dangerously-skip-permissions`, prompt written to a temp file and piped to stdin (execa `inputFile`)
- **GitHub Copilot CLI**: `copilot --allow-all-tools -s`, prompt on stdin (default model `claude-sonnet-4`)
- **Devin CLI**: `devin` CLI with `--print --prompt-file <file> --permission-mode dangerous`

## Metric Targets

| Metric | Target | Direction |
|--------|--------|-----------|
| `avg_confidence` | ≥ 90 | higher is better |
| `avg_clarification_rounds` | ≤ 2.0 | lower is better |
| `avg_verification_gaps_found` | ≤ 2.0 | lower is better |
| `avg_parallel_groups` | ≥ 0.5 | higher is better |
| `avg_verification_items_added` | ≤ 1.5 | lower is better |
| `avg_task_completion_rate` | ≥ 0.95 | higher is better |
| `avg_blocker_count` | ≤ 1.5 | lower is better |
| `avg_verification_failures_found` | ≤ 1.0 | lower is better |
| `archival_success_rate` | ≥ 0.99 | higher is better |
| `avg_user_rating` | ≥ 7.0 | higher is better |

On start the CLI asks for the plan2code repo path (default: saved `plan2codeRepoPath` in `~/.plan2code-metrics.json`, else auto-detected up to 5 parent dirs) and the project path (default: cwd). Data is stored in `<project>/.plan2code-metrics/` (runs/, aggregated.json, proposals/).

## Prompt fingerprints and the one-time regrouping

`collectPromptVersions` reads every `src/plan2code-*.md` file from the folder (so a new skill is covered with no code change) and keys each hash by name: the eight prompts recorded earlier keep their keys (`plan`, `revise_plan`, `document`, `implement`, `finalize`, `init`, `init_update`, `quick_task`), any other file becomes its name without `plan2code-` and `.md`, dashes as underscores (`3_implement_review`, `git`).

The cohort key hashes every fingerprint that is not the `sha256:missing` sentinel, so the first run recorded after this change has more entries than any earlier one and starts a new cohort. Runs recorded before stay as they are and group together as the previous prompt generation; nothing is rewritten or dropped. This happens once, at the change, and again only when a prompt file is edited or added.

## The scrape pattern (one source)

What the collector reads from a plan draft (the `METRICS_JSON` comment, the confidence labels and the four breakdown labels) lives in `src/web-console/metrics-pattern.json`. The console's bait scanner (`src/web-console/patches.mjs`) reads it, `plan2code-metrics/src/metrics-pattern.json` is its copy (bundled by tsup), and `SCRAPE` in `src/skill-scripts/common.mjs` mirrors it for `specs.mjs check`. `scripts/test-web-console-hardening.mjs` fails when any copy differs. After editing the pattern, copy the file to `plan2code-metrics/` and update `SCRAPE`. A breakdown label then a number counts in prose, and in a table row only when the number ends the row, so an ordinary risk-register row is not refused.
