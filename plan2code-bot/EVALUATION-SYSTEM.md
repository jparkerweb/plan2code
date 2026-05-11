# LLM-as-Judge Evaluation System

## Overview

The plan2code-bot now includes an **always-on LLM-as-judge evaluation system** that transforms it from a "yes-man" into an authentic QA agent. This provides realistic quality signals for `plan2code-metrics` to analyze and drive recursive self-improvement.

## Key Features

### 1. Intelligent Decision Making (Real-Time)

**What:** During execution, when `AskUserQuestion` is called, the bot uses an LLM to make thoughtful decisions based on current observations.

**How it works:**
- Collects observations up to the current point (tools used, files created, errors)
- Queries LLM with context: "Given what you've seen, should you approve this plan?"
- LLM inspects current artifacts using Read/Glob/Grep
- Returns evidence-based answer with reasoning
- All decisions are recorded for metrics analysis

**Example:**
```
Question: "Approve this plan?"
Observations: Created PLAN-DRAFT.md, 3 phases, 42s duration, no errors
LLM reads PLAN-DRAFT.md, evaluates quality
LLM decides: "Yes, approve - phases are well-scoped and realistic"
```

### 2. Post-Step Evaluation

**What:** After each step completes, the bot evaluates quality using step-specific criteria.

**How it works:**
- Collects complete execution observations
- Queries LLM with evaluation criteria for the step
- LLM inspects final artifacts
- Returns structured evaluation (score, strengths, weaknesses, suggestions)
- Writes `specs/<feature>/BOT-EVALUATION.md` and `specs/<feature>/BOT-NOTES.md` (falls back to project root if no spec folder exists yet, e.g. during `init`)

**Example output:**
```markdown
# Evaluation: plan Step

**Score:** 78/100

## Strengths
- Clear phase breakdown with realistic scope
- Tech stack choices appropriate

## Weaknesses
- Phase 3 description too vague
- No testing strategy mentioned

## Suggestions
- Expand Phase 3 with concrete tasks
- Add explicit testing phase
```

### 3. Quality Gate

**What:** Before finalize, checks that average quality score is acceptable.

**How it works:**
- Calculates average score across all evaluated steps
- If average < 60, blocks finalization
- Displays clear message about quality issues
- User must review `specs/<feature>/BOT-EVALUATION.md` and fix problems

## Files Created

### New Files

1. **`src/observation-collector.ts`**
   - Tracks execution details (tools, files, messages, errors, questions)
   - Provides snapshots for real-time decisions
   - Captures complete history for evaluation

2. **`src/intelligent-responder.ts`**
   - Replaces hardcoded auto-responder
   - Uses LLM to answer AskUserQuestion prompts
   - Provides reasoning for all decisions
   - Falls back gracefully if LLM unavailable

3. **`src/prompts/evaluation-criteria.ts`**
   - Step-specific evaluation criteria (init, plan, document, implement, finalize)
   - Quality checks, common pitfalls, scoring guidance
   - Emphasizes honest scoring (most work should score 70-85)

4. **`src/evaluator.ts`**
   - Post-step evaluation using LLM-as-judge
   - Queries LLM with observations and criteria
   - Parses structured evaluation output
   - Writes `specs/<feature>/BOT-EVALUATION.md` and `specs/<feature>/BOT-NOTES.md`

### Modified Files

1. **`src/types.ts`**
   - Added interfaces: `ToolObservation`, `QuestionContext`, `ExecutionObservation`, `EvaluationResult`
   - Extended `StepResult` with `evaluation` and `observations` fields

2. **`src/session-runner.ts`**
   - Added `collector` parameter to `SessionOptions`
   - Returns `observations` in `SessionResult`
   - Records all messages for observation tracking
   - Uses intelligent responder instead of auto-responder

3. **`src/cli.ts`**
   - Creates `ObservationCollector` for each step
   - Always runs evaluation after successful steps
   - Displays scores with color coding (green/yellow/red)
   - Implements quality gate before finalize
   - Shows evaluation summary in step output

4. **`src/bin/plan2code-bot.ts`**
   - Updated help text to mention LLM-as-judge evaluation
   - No new CLI flags (evaluation is always on)

### Deleted Files

1. **`src/auto-responder.ts`** - Replaced by intelligent-responder.ts
2. **`src/auto-responder.test.ts`** - No longer needed

## Output Files (Created During Execution)

Both files are written to `specs/<feature>/` so they stay co-located with the feature they describe. If no spec folder exists yet (e.g. during `init`), they fall back to the project root.

### BOT-EVALUATION.md

Contains evaluation results for each step:
- Score (0-100)
- Strengths identified
- Weaknesses found
- Suggestions for improvement
- Critical issues (if any)
- Full reasoning from LLM

### BOT-NOTES.md

Contains execution observations:
- Duration, tool counts, file changes
- Questions asked and LLM reasoning for answers
- Tool usage timeline
- Files created/modified
- Assistant output summary

## Data Structure for Metrics

All evaluation data is structured in `StepResult`:

```typescript
{
  step: 'plan',
  success: true,
  duration: 42000,
  evaluation: {
    score: 78,
    strengths: ["Clear phases", "Realistic scope"],
    weaknesses: ["Phase 3 too vague"],
    suggestions: ["Add specific tasks to Phase 3"],
    criticalIssues: [],
    reasoning: "...",
    timestamp: 1234567890,
    evaluatorModel: 'claude-sonnet-4-5'
  },
  observations: {
    tools: [{ toolName, input, output, timestamp }, ...],
    questionsAsked: [
      {
        question: "Approve plan?",
        selectedAnswer: "Yes, approve",
        llmReasoning: "Phases are well-scoped...",
        timestamp: 1234567890
      }
    ],
    filesCreated: [...],
    filesModified: [...],
    errors: []
  }
}
```

## Benefits for Recursive Improvement

1. **Authentic Signals:** Real quality scores identify actual problem areas
2. **Detailed Context:** Observations + reasoning explain WHY failures happen
3. **Correlation Analysis:** Link patterns (tool usage, duration, errors) to quality
4. **Continuous Loop:** Better metrics → improved workflows → higher scores → repeat

## Usage

No special flags needed - evaluation is always on:

```bash
# New project
plan2code-bot --idea "todo app"

# Enhancement
cd my-project && plan2code-bot

# Resume with evaluation data preserved
plan2code-bot --resume
```

## Verification

After running the bot, check:

1. **`specs/<feature>/BOT-EVALUATION.md`** - Should show realistic scores (not all 100s)
2. **`specs/<feature>/BOT-NOTES.md`** - Should show LLM reasoning for decisions
3. **Console output** - Should display color-coded scores after each step
4. **State file** (`.plan2code-bot-state.json`) - Should include evaluation data

## Trade-offs

### Latency
- Adds ~2-3s per AskUserQuestion call (~15-20s total per run)
- Worth it for authentic evaluation

### Token Cost
- ~20-26K tokens per run (~$0.60 with Opus 4.6)
- Investment pays off through metrics-driven improvement

### Determinism
- LLM decisions vary between runs (non-deterministic)
- Realistic - humans vary too
- Metrics average over many runs

## Future Enhancements

Potential improvements:
- Model selection per step (use Haiku for simple decisions)
- Configurable quality gate threshold
- Historical score tracking across runs
- Comparison with previous evaluations
- More sophisticated scoring (weighted by step importance)
