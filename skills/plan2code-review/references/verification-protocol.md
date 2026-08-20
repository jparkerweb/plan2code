# Verification Protocol
> Part of plan2code-review — loaded during Step 3 (Analyze).

Apply this protocol to every finding before presenting it. Findings that fail verification are dropped. No exceptions.

## Code Finding Verification

1. **Re-read the source.** Open the file and read the actual line(s) cited. Do not rely on memory or earlier reads.
2. **Read surrounding context.** At least 20 lines above and below. Many "bugs" are handled by guards, defaults, or patterns in surrounding code.
3. **Verify the issue is real.** Trace the variable/function's actual usage. Is the edge case reachable? Does a try/catch or guard upstream already handle this?
4. **Verify the fix doesn't break callers.** Search all call sites. Check if any caller depends on the current behavior. Verify the fix maintains the function's contract.
5. **Check the test suite.** Do tests cover this case (making the "bug" intentional)? Would your fix break existing tests?

## Architectural Finding Verification

Architectural findings carry the highest false-positive risk.

1. **Identify all consumers.** Search the entire codebase — imports, requires, config files, build scripts, documentation, dynamic references (string-based requires, Read directives).
2. **Trace a concrete use case end-to-end.** Start at the entry point, follow execution through every module, document where the component you want to change is touched. If you can't trace a complete use case, you don't understand the system well enough to recommend changes.
3. **Simulate the change.** Walk the same use case with your change applied. At each step: can it still complete successfully? Pay attention to steps that load data, read config, or reference files.
4. **Check indirect dependencies.** Reference data loaded by agents at runtime via Read directives. Config consumed by external tools or CI/CD. Exports consumed by other packages.
5. **Verify the motivation.** Am I improving correctness, or satisfying an aesthetic preference? Is the complexity I'm flagging intentional?

## Design Finding Verification

1. **Check project conventions.** Read AGENTS.md, README, existing patterns. Is the "inconsistency" a deliberate choice?
2. **Simulate across all consumers.** Does the change improve their code, or just move complexity? Would it require coordinated updates across files?
3. **Evaluate migration cost.** Is the current design causing actual bugs, or merely suboptimal?
4. **Check platform constraints.** Does the recommendation work across all supported platforms?

## Confidence Calibration

| Level | Definition | Action |
|-------|-----------|--------|
| **High** | Verified in source code AND use-case traced (for arch/design). Issue confirmed real, fix confirmed safe. | Present. |
| **Not High** | Any doubt remains. | Investigate further or drop entirely. |

No Medium or Low tier. A finding is verified or it isn't.

## Adversarial Self-Check

Run against EVERY finding. If any question raises doubt, re-investigate or drop.

1. **Am I optimizing for the wrong metric?** Reducing file count, context size, or complexity when the structure serves correctness or platform compatibility?
2. **Does my fix remove something the system depends on?** Verified by searching ALL consumers, not just the current file?
3. **Have I traced a real use case end-to-end with my fix applied?**
4. **Am I recommending removal because I don't understand the purpose?**
5. **Would a domain expert disagree with this finding?**

## Escalation Rules

- **One question uncertain:** Re-investigate. If doubt persists, drop.
- **Two+ questions uncertain:** Drop entirely.
- **Cannot investigate:** Drop entirely. Note the gap in Step 4 if the dimension matters.

## Verification Examples

**Finding survives (real bug):** Reviewer finds `processItems()` at line 47 accesses `items[0].id` with no empty-array check. Re-reads source — confirmed no guard. Traces callers — `orchestrator.js:82` can pass empty array. Adversarial check passes (correctness issue, additive fix). Presented at High.

**Finding dropped (pcweb-jira false positive):** Reviewer recommends removing `jira-api-catalog.md` from consumer loading to "reduce context." Adversarial check: "Does my fix remove something the system depends on?" YES — agents Read these files at runtime to construct valid API calls. Four of five checks fail. Dropped.

**Finding dropped (false consolidation):** Reviewer flags per-platform config files as "duplicates." Adversarial check: "Am I optimizing for the wrong metric?" YES — platforms have distinct values and will diverge further. Separation is a design choice. Dropped.

## Review Discipline (Reinforcement)

These rules are restated here for reinforcement at analysis time — they are critical and must not drift:

- **Every finding must reference actual code at file:line.** Never fabricate. If you can't cite it, don't report it.
- **High confidence required.** No Low confidence findings. Investigate until verified or drop entirely.
- **Read every changed file completely before flagging.** Context missed = false positive generated.
- **Never silently narrow scope.** Review what was asked, not what's convenient.
- **Verify docs match code.** Documentation that contradicts implementation is a finding.
