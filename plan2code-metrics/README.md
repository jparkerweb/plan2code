# plan2code-metrics

Recursive self-improvement toolchain for plan2code contributors. Collects metrics from completed project specs, aggregates them across runs and prompt generations, then uses AI to diagnose weak steps and propose targeted edits to the workflow prompts.

## Quick Reference

```bash
# Install (one-time, from the plan2code root)
node install.js            # → "A" (Install All + dev tools) includes metrics
                           # → or "M" (Metrics only) under the CUSTOM sub-menu

# After finishing any project spec (steps 1-4):
cd your-project
plan2code-metrics          # → "Collect metrics" → pick your spec dir → done (5 sec)

# When you're curious or have 3+ runs:
plan2code-metrics          # → "View metrics status" to see the dashboard
                           # → "Run analysis" for AI diagnosis of weak spots
                           # → "Generate improvement proposal" for prompt edits
                           # → "Review and apply" to patch src/plan2code-*.md
```

**One habit:** collect after every finished spec. Everything else is on-demand.

### How Many Runs Do I Need?

| Runs | What You Get |
|------|-------------|
| **1** | Raw data and basic dashboard. Start here. |
| **3+** | AI analysis unlocks (warns below 3 that results may be unreliable). Pattern detection starts working. |
| **5-10+** | Averages stabilize. Generation-over-generation comparisons become meaningful. |

More is always better — each run adds a data point. You're looking for trends, not individual scores.

### The Feedback Loop

```
Use plan2code on a project (steps 1-4)
     |
     v
Collect metrics from the finished spec       <-- do this every time
     |
     v
Aggregate across runs (automatic)
     |
     v
Analyze weak spots (AI-powered, 3+ runs)
     |
     v
Generate prompt improvements
     |
     v
Apply edits to src/plan2code-*.md
     |
     v
Prompts have new SHA hashes = new "generation"
     |
     v
Use improved prompts on next project
     |
     v
Collect again, compare generations            <-- the loop closes
```

After applying edits, the prompt file SHA hashes change. The next collected run falls into a **new cohort** (generation). The dashboard then shows generation-over-generation deltas — "Did confidence go up? Did blockers decrease?" — so you can measure whether your edits actually helped.

---

## Installation

Requires Node.js >= 18.

### Via the plan2code installer (recommended)

From the plan2code repo root:

```bash
node install.js
```

Choose **A** (Install All + dev tools) to install prompts, loop CLI, bot, metrics, and status line together. Or choose **C** (Custom) then **M** (Metrics) to install just the metrics CLI.

The installer handles `npm install`, `npm run build`, and global linking automatically. After install, `plan2code-metrics` is available from any directory.

### Manual install

If you prefer to install manually or are developing on the metrics package:

```bash
cd plan2code-metrics
npm install
npm run build
npm link
```

To run without linking:

```bash
npm start
# or
node dist/bin/plan2code-metrics.js
```

## Usage

Run `plan2code-metrics` from inside (or near) a plan2code repository. The CLI is fully interactive — no flags, all inputs collected via prompts.

```
plan2code-metrics
```

### Main Menu

| Option | Description |
|--------|-------------|
| **Collect metrics** | Parse a completed project spec and extract step-by-step metrics into a run JSON |
| **Import run data** | Copy a run JSON from another project into the local metrics store |
| **View metrics status** | Show aggregated metrics with health indicators and generation deltas |
| **Run analysis** | AI-powered diagnosis of weak steps (requires Claude Code, GitHub Copilot CLI, or Devin CLI) |
| **Generate improvement proposal** | AI generates surgical prompt edits based on a diagnosis |
| **Review and apply** | Interactive diff review to accept/reject individual edits |
| **Fetch community submissions** | List open community-feedback GitHub issues, parse + validate their METRICS_JSON payload, import into the local run store, and close them |

### Each Time You Finish a Spec

After completing Step 4 (finalize) on any project:

```bash
cd your-project
plan2code-metrics
```

Pick **"Collect metrics"** and point it at your spec directory (`specs/<feature>/` or `specs--completed/<feature>/`). It reads your artifacts, extracts ~30 metrics, and writes a run JSON. Takes about 5 seconds.

The data stays local to that project in `.plan2code-metrics/runs/`. To aggregate across multiple projects, use **"Import"** to copy run files into one central location.

### Cross-Project Aggregation

If you use plan2code across several repos, you can consolidate all run data in one place:

```bash
# From your central repo (e.g., the plan2code repo itself):
plan2code-metrics
# → "Import run data"
# → Paste path to: /path/to/other-project/.plan2code-metrics/runs/run-xxx.json
```

Imported runs are copied locally and included in all future aggregations, analyses, and comparisons.

## What It Measures

Each collection scrapes your spec files and extracts:

### Step 1 (Plan) — from `PLAN-DRAFT-*.md` and `PLAN-CONVERSATION-*.md`

- **Confidence score** — overall planning confidence percentage
- **Confidence breakdown** — requirements, feasibility, integration, risk sub-scores
- **Clarification rounds** — how many rounds of Q&A occurred
- **Verification gaps found** — missing requirements caught during verification
- **Functional/non-functional requirement counts** — FR- and NFR- headings
- **Risk count** — risk table entries
- **Phase count** — number of implementation phases planned

### Step 2 (Document) — from `overview.md` and `phase-*.md`

- **Total tasks** — checkbox count across all phases
- **Tasks per phase** — distribution of work
- **Phase count** — number of phase files
- **Parallel groups** — parallel execution groups identified
- **Requirement coverage** — coverage percentage if present
- **Verification items** — verification checklist items added

### Step 3 (Implement) — from `.plan2code-loop/` data (loop mode only)

- **Task completion rate** — completed / total tasks
- **Blocker count** — tasks marked TASK_BLOCKED
- **Blocker categories** — normalized reasons for blocks
- **Total iterations** — loop iteration count
- **Avg iteration duration** — mean time per iteration
- **Exit code distribution** — process exit codes
- **Completion marker success rate** — valid markers / total iterations

### Step 4 (Finalize) — from `overview.md` and directory structure

- **Completion rate at audit** — tasks done at finalization time
- **Verification failures** — tasks marked with `[!]`
- **Documentation updates needed** — TODO/FIXME/update markers
- **Archival success** — whether spec was moved to `specs--completed/`

### Health Targets

The dashboard compares key metrics against targets:

| Metric | Target | Direction |
|--------|--------|-----------|
| avg_confidence | 90 | >= |
| avg_clarification_rounds | 2.0 | <= |
| avg_verification_gaps_found | 2.0 | <= |
| avg_parallel_groups | 0.5 | >= |
| avg_task_completion_rate | 0.95 | >= |
| avg_blocker_count | 1.5 | <= |
| avg_completion_marker_success_rate | 0.95 | >= |
| avg_verification_failures_found | 1.0 | <= |
| archival_success_rate | 0.99 | >= |

Green checkmark = meeting target. Red X = below target (with the target shown).

## How It Works

### 1. Collect

Reads completed project artifacts from `specs/` or `specs--completed/` and extracts metrics for each workflow step. Output: `.plan2code-metrics/runs/run-<timestamp>.json`

### 2. Aggregate

Merges all run files into `aggregated.json`, grouped by **prompt generation** — a SHA fingerprint of the 8 workflow prompt files. Two runs that used identical prompt files belong to the same cohort.

### 3. Analyze

Sends aggregated metrics to an AI model with an analyst prompt. The AI produces a diagnosis identifying the weakest workflow steps and root causes. No edits are proposed at this stage.

Output: `.plan2code-metrics/proposals/<timestamp>-diagnosis.md`

### 4. Improve

Sends the diagnosis plus current prompt file contents to an AI model. The AI proposes surgical `old_text -> new_text` edits, each validated against:

- The `old_text` actually exists in the target file
- The edited file stays under the 11,000 character limit

Output: `.plan2code-metrics/proposals/prop-<timestamp>.json`

### 5. Apply

Interactive diff review for each proposed edit. Accept, reject, or skip individual changes. Applied edits are patched directly into `src/plan2code-*.md`.

## Data Directory

All metrics data lives in `.plan2code-metrics/` (add to `.gitignore` if desired):

```
.plan2code-metrics/
├── runs/                  # Individual run JSONs
│   ├── run-20260215-120000-a1b2.json
│   └── run-20260220-090000-c3d4.json
├── aggregated.json        # Merged cohort data
└── proposals/             # Diagnoses and improvement proposals
    ├── 20260220-diagnosis.md
    └── prop-20260220.json
```

## AI Backends

The analysis and improvement steps require an AI agent. Two backends are supported:

| Backend | Command | Notes |
|---------|---------|-------|
| **Claude Code** | `claude` | Uses `--print` mode. Recommended. |
| **GitHub Copilot CLI** | `copilot` | Uses stdin piping with `--allow-all-tools -s`. |
| **Devin CLI** | `devin` | Uses `--print --prompt-file <file> --permission-mode dangerous`. |

Model selection is interactive — choose from available models when prompted.

## Architecture

```
src/
├── bin/plan2code-metrics.ts   # Entry point
├── cli.ts                     # Interactive menu (main loop)
├── types.ts                   # RunMetrics, PromptProposal, CohortMetrics, etc.
├── collector.ts               # Reads project artifacts → run JSON
├── aggregator.ts              # Merges runs → aggregated.json (cohort grouping)
├── analyzer.ts                # AI diagnosis via LLM invocation
├── improver.ts                # AI improvement proposal + validation
├── applier.ts                 # Interactive diff review + file patching
├── community.ts               # Community-feedback issue parsing + ingestion
├── invoke-llm.ts              # Unified LLM invocation (Claude / Copilot / Devin)
├── index.ts                   # Public API exports
└── prompts/
    ├── analyze.md             # AI prompt template for diagnosis
    └── improve.md             # AI prompt template for improvement proposals
```

## Development

```bash
npm run dev      # Watch mode (rebuilds on change)
npm run build    # Production build
npm test         # Run unit tests
npm run test:watch  # Watch mode tests
npm start        # Run the CLI
```
