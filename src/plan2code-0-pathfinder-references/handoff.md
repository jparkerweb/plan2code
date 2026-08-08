# Handoff Playbook — Clearing the Map into a PLAN-DRAFT

Loaded at The Clearing Gate. Turns a cleared map into `specs/<idea>/PLAN-DRAFT-<YYYYMMDD>.md` that `/plan2code-1-plan` resumes from at Phase 4, then freezes `pathfinder/` as the rationale record.

Nothing here is creative. The gate is scored, the mapping is fixed, the template is literal. Follow it exactly or the resuming plan session silently loses work.

## Preflight — before scoring anything

| # | Check | If it fails |
|---|---|---|
| 1 | Re-run the reconcile pass: read every file in `questions/`, rebuild every map marker from the files | Fix the map first. Markers are derived, never authored. |
| 2 | Zero `[ ]`, zero `[/]`, zero `[!]` rows in `## Question Checklist` | Not cleared. Return to the frontier. |
| 3 | `## Not yet specified` is empty | Not cleared. Graduate the fog into questions, or admit it is out of scope. |
| 4 | Every `[x]` row's file has a real `## Answer` with a `**Gist:**` | The file wins over the marker. Repair, then re-check. |
| 5 | `ls specs/<idea>/` shows no existing `PLAN-DRAFT-*.md` | One already exists — read it. Update it in place; never add a second dated draft. |
| 6 | The destination is reachable with nothing left to decide — no `## Answer` defers a choice to "whoever implements this" | Not cleared. Name the open decision and graduate it into a question. |

Only after all six pass do you score the four dimensions.

## The clearing-gate scoring rubric

Four dimensions, 0-25 each, scored against **written evidence in `questions/`** — never against your recollection of the conversation. The gate needs **every dimension at 18/25 or better**. There is no averaging: 25/25/25/14 fails.

### Band scale (applies to all four)

| Band | Meaning |
|---|---|
| 23-25 | Decided, written down, and consequences recorded. A developer could act on it without asking a question. |
| 18-22 | Decided and written down. Residual detail remains, but it is *specification* detail that Phase 5/6 settles — not a decision anyone still has to make. |
| 12-17 | A real decision is still open, or an answer exists with no evidence behind it. **Gate fails.** |
| 0-11 | The area was never charted. **Gate fails**, and the map was cleared prematurely. |

The 18-boundary is the honest line between *"needs designing"* and *"needs deciding"*. Pathfinder owns deciding. If someone still has to decide, you are not done.

### What each dimension scores

| Dimension | Scores | Raises it | Lowers it |
|---|---|---|---|
| **Requirements Clarity** | Are the requirements unambiguous? | Every resolved `grill` answer states the decision AND what was rejected; the testing-posture answer names types, cadence, and coverage | Answers phrased as preferences ("probably NDJSON") instead of decisions; a requirement that only exists in the map gist and not in a question file |
| **Technical Feasibility** | Do we know HOW to build each component? | Resolved `sketch` questions with a real artifact under `sketch-NN/`; `research` answers citing primary sources under `## Evidence`; `00-codebase-context.md` naming the actual files that change | A mechanism nobody has exercised in this codebase; a research answer whose `## Evidence` is empty or cites only a blog post |
| **Integration Points** | Are all external dependencies identified? | Every system named in `## Destination` has a resolved question touching it; auth, quota, and failure behavior named per integration | An integration mentioned in an answer but never questioned; a config store that was read but never written to during a sketch |
| **Risk Assessment** | Are blockers documented with mitigations? | Answers that record consequences; `Locked: yes` answers that say what breaks if reversed; ceilings with a stated behavior at the ceiling | A recorded limit with no decided behavior past it; a `Locked: yes` answer with no consequences section |

### Hard caps

A cap overrides your judgment. While a cap condition holds, the dimension **cannot** exceed 17, so the gate cannot pass.

| Cap | Condition |
|---|---|
| Requirements ≤ 17 | The testing-posture question is not `resolved`, or its answer omits any of types / cadence / coverage |
| Feasibility ≤ 17 | Any `research` question is `resolved` with an empty `## Evidence` |
| Integration ≤ 17 | A system named in `## Destination` has no resolved question touching it |
| Risk ≤ 17 | Any `Locked: yes` answer records no consequences |

### Honesty rules

- Score the **written record**, not the conversation. If the human agreed to something in a session and nobody wrote it into a `## Answer`, it does not exist and it does not earn points.
- A filled `## Answer` is not automatically 25. An answer that decides but records no consequences tops out around 20.
- Never round up to clear the gate. A 17 that "feels like an 18" is the exact case the gate exists to catch.
- Never move a decision to `## Out of scope` to raise a score. Out-of-scope is a scoping act with a reason; scope-cutting to pass a gate is score inflation with extra steps.
- If two dimensions are borderline, write the one-line justification for each score into the Session End report. Justifications that cannot be written are scores that cannot be defended.

### Worked example — idea `audit-log-s3-export`

Destination: *"A spec a developer can implement: nightly export of tenant audit logs to customer-owned S3 buckets, with a signed manifest per run."*

Resolved questions: [Codebase context](./questions/00-codebase-context.md), [Export format](./questions/01-export-format.md), [Scheduling model](./questions/02-scheduling-model.md), [Destination auth](./questions/03-destination-auth.md), [Retention and replay](./questions/04-retention-and-replay.md), [Testing posture](./questions/05-testing-posture.md), [Throughput ceiling](./questions/06-throughput-ceiling.md). Ruled out: [Failure notification](./questions/07-failure-notification.md).

**First scoring pass:**

| Dimension | Score | Justification against evidence |
|---|---|---|
| Requirements Clarity | 22/25 | Four `grill` answers state decisions and rejections (NDJSON chosen, CSV rejected for nested actor payloads). Testing posture settled: integration + unit, run after each phase, moderate coverage. Minus 3: the manifest's exact field list is unspecified — a Phase 5 spec detail, not an open decision. |
| Technical Feasibility | 21/25 | `sketch-02` uploaded a 400 MB multipart object to a real bucket end to end. `00-codebase-context.md` names `AuditExportJob` and the existing Hangfire registration as the extension points. Minus 4: no component in this codebase has ever assumed a cross-account IAM role; the pattern is documented in AWS docs cited under `## Evidence` but unexercised here. |
| Integration Points | 23/25 | Three integrations, each with a resolved question: S3 (Destination auth), Hangfire (Scheduling model), tenant config store (Codebase context). Auth and quota named per integration. Minus 2: the tenant config store's write path was read but never exercised by a sketch. |
| Risk Assessment | **16/25** | Consequences recorded on Export format and Destination auth. But Throughput ceiling establishes 200 MB per tenant per day at p95 and **records no decided behavior above it** — truncate, spill to the next run, or fail the run is still undecided. |

**Gate result: FAIL** on Risk Assessment (16 < 18), and the orchestrator third clearing condition — the destination reachable with nothing left to decide — fails with it: a decision is genuinely still open. Do not write a PLAN-DRAFT. Name the failure, graduate `questions/08-overflow-behavior.md` (`grill · HITL`, `Blocked by: none`) from the gap, and end the session on the frontier.

**Second scoring pass, one session later**, with [Overflow behavior](./questions/08-overflow-behavior.md) resolved (spill to the next run, alarm at three consecutive spills):

| Dimension | Score |
|---|---|
| Requirements Clarity | 22/25 |
| Technical Feasibility | 21/25 |
| Integration Points | 23/25 |
| Risk Assessment | 20/25 |

All four at 18 or better. Gate passes. Proceed to the mechanism.

## The mechanism, stated plainly

Pathfinder writes `specs/<idea>/PLAN-DRAFT-<YYYYMMDD>.md` with the header line:

`**Status:** Phase 3 Complete - Resume at Phase 4`

`/plan2code-1-plan` **already recognises that exact string.** Its "Check for Existing Progress" block, which runs before Phase 1, reads:

`- Status "Phase 3 Complete - Resume at Phase 4": Resume at Phase 4`

That is the whole handoff. The string is the contract, and it needs **zero changes to the planning skill** — pathfinder is impersonating the Large-project Context Checkpoint that 1-plan's own Phase 3 performs, which writes the same status for the same reason.

Consequences of that being a literal string match:

- Copy it byte for byte. Plain ASCII hyphen-minus surrounded by single spaces. An en dash, a colon, or "Phase 3 complete" in lower case breaks the match and 1-plan starts over at Phase 1 — throwing away every decision the map holds.
- It goes on its own `**Status:**` line in the header block, not buried in prose.
- The file must be named `PLAN-DRAFT-<YYYYMMDD>.md` and live directly in `specs/<idea>/`. `PLAN-DRAFT-*.md` is a reserved name inside `pathfinder/` — never write it there.
- Get the date from the shell (`date +%Y%m%d` in Bash, `Get-Date -Format yyyyMMdd` in PowerShell). Do not guess it.

**Discovery is shell-only.** `specs/` is gitignored, so Glob silently returns nothing and every downstream skill would report "no PLAN-DRAFT found". Use `ls specs/` and `ls specs/<idea>/` (Bash) or `Get-ChildItem specs/` (PowerShell) — the same rule 1-plan and `/plan2code-2-document` follow when they look for the file you are about to write.

**Do not append `## Planning Metrics` or any metrics comment.** Pathfinder is not a metered step. 1-plan's Phase 7 owns that block and will add it when it finishes the plan. Do not emit any of the loop's completion tokens listed in the skill's Rules anywhere under `specs/`.

## Map to PLAN-DRAFT mapping

Everything in the draft traces to something on the map. Nothing is invented at handoff time — if a section has no source, that is a gate failure you missed, not a paragraph to write from imagination.

| Source on the cleared map | Becomes |
|---|---|
| `## Destination` | Section 1 Executive Summary (2-3 sentences, present tense) and Section 7 Success Criteria (the destination restated as checkable outcomes) |
| Resolved `grill` answers describing behavior | Section 2.1 Functional Requirements, one `FR-N` per decided behavior |
| Resolved `grill` answers describing performance, security, scale, operability | Section 2.2 Non-Functional Requirements, one `NFR-N` each |
| `## Out of scope` | Section 2.3 Out of Scope — copied line for line, wording and order intact. The ONLY permitted change is the link prefix: `./questions/` becomes `./pathfinder/questions/`, because the draft sits one level above the map. Do not re-word, re-order, or summarise; a re-worded scope boundary is a re-litigated one. |
| The testing-posture question's answer | Section 2.4 Testing Strategy table (Types / Phase Testing / Coverage) |
| Resolved `research` answers and their `## Evidence` | Section 3 Tech Stack — the cited source becomes the Justification cell |
| `questions/00-codebase-context.md` | The `## System Context` section, and the components table in 4.3 |
| Answers with `Locked: yes` | Section 4 Architecture (4.1 Pattern rationale, 4.4 Data Model, 4.5 API Design) **and** Section 9 Assumptions — a locked decision is an assumption downstream work is allowed to rely on |
| Consequences recorded across all `## Answer` sections | Section 6 Risks and Mitigations — the consequence is the Risk, the decision that bounds it is the Mitigation |
| `## Ground rules` | The `AGENTS.md` line in `## System Context`; conventions the plan must not violate |
| The shape of the map (question count, integrations touched, components named) | The `## Scope Assessment` section |
| Resolved `sketch` questions and their artifacts | Section 3 Justification cells and Section 6 Mitigation cells ("proven by `pathfinder/sketch-02/`") |
| Every resolved question, by name | `## Pathfinder Provenance` |
| — | **Section 5 Implementation Phases stays empty.** 1-plan Phase 6 breaks the work into phases. Pathfinder decides; it does not slice. Leave the placeholder note in place and do not put implementation checkboxes there. |

Questions ruled `out-of-scope` never appear in Provenance and never become requirements. Their one line in `## Out of scope` is their only trace — that is the point of the marker.

## The PLAN-DRAFT template

Write this literally, substituting real content. Keep the section numbering exactly as shown — 1-plan and `/plan2code-2-document` both address sections by number.

````markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Audit Log Export - Implementation Plan

**Created:** 2026-08-03
**Status:** Phase 3 Complete - Resume at Phase 4
**Charted by:** `/plan2code-0-pathfinder` over 9 sessions
**Planning record:** `specs/audit-log-s3-export/pathfinder/map.md` (no PLAN-CONVERSATION - this plan was charted, not conversed)
**Confidence (pathfinder):** Requirements-clarity 22/25 · Feasibility-technical 21/25 · Integration-points 23/25 · Risk-assessment 20/25

---

## 1. Executive Summary

Tenants can have their audit logs exported nightly to an S3 bucket they own, with a
signed manifest per run so they can prove completeness. Export runs on the existing
Hangfire schedule, writes NDJSON, and assumes a customer-provided cross-account IAM
role with an external ID. Runs that exceed the per-tenant daily ceiling spill into the
next run rather than truncating.

## 2. Requirements

### 2.1 Functional Requirements

- [ ] **FR-1:** Export each tenant's prior-day audit events as newline-delimited JSON, one object per event, UTF-8, no BOM
- [ ] **FR-2:** Write a per-run manifest listing object keys, event counts, byte counts, and a SHA-256 per object
- [ ] **FR-3:** Sign the manifest with the platform export key; publish the public key at a stable URL
- [ ] **FR-4:** Assume the tenant-configured IAM role with the tenant's external ID; never use platform-owned credentials against a customer bucket
- [ ] **FR-5:** Allow an operator to replay any run within a 7-day window without duplicating manifest sequence numbers
- [ ] **FR-6:** Spill events above the per-tenant daily ceiling into the next scheduled run, oldest first
- [ ] **FR-7:** Raise an alarm after three consecutive spilling runs for the same tenant

### 2.2 Non-Functional Requirements

- [ ] **NFR-1:** Sustain 200 MB per tenant per day at p95 without extending the nightly window past 04:00 UTC
- [ ] **NFR-2:** Never log tenant event bodies, bucket names, or assumed-role ARNs above debug level
- [ ] **NFR-3:** A failed run must leave no partial objects visible in the customer bucket
- [ ] **NFR-4:** Export must add no schema changes to the audit event write path

### 2.3 Out of Scope

<!-- copied line for line from pathfinder/map.md ## Out of scope; only the link prefix changes -->

- [Failure notification](./pathfinder/questions/07-failure-notification.md) — email/webhook delivery of run failures belongs to the platform alerting effort, not this export. The alarm in FR-7 is raised, not delivered.
- **On-demand export from the tenant UI** — the destination is the scheduled export. A user-triggered export is a separate effort with its own map.
- **Log formats other than NDJSON** — Parquet was raised and ruled past the destination.

### 2.4 Testing Strategy

| Aspect | Decision |
|---|---|
| Types | Unit + Integration |
| Phase Testing | Run after each phase |
| Coverage | Moderate (~60-80%) |

## System Context

**Project type:** Existing codebase — .NET 8 service, `src/Platform.Audit/`

| Aspect | Finding | Source |
|---|---|---|
| Entry points to change | `AuditExportJob`, registered in `HangfireStartup.ConfigureRecurringJobs()` | [Codebase context](./pathfinder/questions/00-codebase-context.md) |
| Existing patterns to follow | Jobs resolve tenant scope via `ITenantScopeFactory`; no job reads config directly | [Codebase context](./pathfinder/questions/00-codebase-context.md) |
| Integration surfaces | S3 (customer-owned), Hangfire scheduler, `TenantConfigStore` | [Destination auth](./pathfinder/questions/03-destination-auth.md), [Scheduling model](./pathfinder/questions/02-scheduling-model.md) |
| Technical debt in the path | `AuditQuery` materialises full result sets; streaming reader needed before FR-1 | [Codebase context](./pathfinder/questions/00-codebase-context.md) |
| System boundaries | Read-only against the audit store; writes only to customer buckets and the run-log table | [Retention and replay](./pathfinder/questions/04-retention-and-replay.md) |
| Conventions in force | `AGENTS.md` present and read; its logging and DI conventions govern | `pathfinder/map.md` ## Ground rules |

## Scope Assessment

**Assessment: Medium** — 11 requirements across 3 integrations, 5 components touched. No Large threshold is met.

| Indicator | Value |
|---|---|
| Requirements decided | 11 (7 FR + 4 NFR) |
| Components | 5 (`AuditExportJob`, `NdjsonWriter`, `ManifestSigner`, `S3RoleAssumer`, `ExportRunLog`) |
| Integrations | 3 (S3, Hangfire, `TenantConfigStore`) |
| Decisions charted | 8 resolved, 1 ruled out of scope |

## 3. Tech Stack

<!-- Phase 4 completes this table. Rows below are decided; do not re-open them. -->

| Category | Technology | Version | Justification |
|---|---|---|---|
| Serialization | `System.Text.Json` NDJSON writer | .NET 8 | [Export format](./pathfinder/questions/01-export-format.md) — no new dependency; CSV rejected for nested actor payloads |
| Object storage | `AWSSDK.S3` multipart upload | 3.7.x | [Throughput ceiling](./pathfinder/questions/06-throughput-ceiling.md) — proven in `pathfinder/sketch-02/` against a real bucket at 400 MB |
| Cross-account auth | STS `AssumeRole` + external ID | — | [Destination auth](./pathfinder/questions/03-destination-auth.md) — AWS confused-deputy guidance cited in that file's `## Evidence` |
| Scheduling | Existing Hangfire recurring job | in-repo | [Scheduling model](./pathfinder/questions/02-scheduling-model.md) — a new scheduler was rejected |

## 4. Architecture

### 4.1 Pattern

Pipeline inside the existing job host: query → stream → chunk → upload → manifest → sign.
Chosen because the audit store is the only source and the export is strictly one-way.
[Locked] A separate export microservice was rejected — see [Scheduling model](./pathfinder/questions/02-scheduling-model.md).

### 4.2 System Context Diagram

<!-- Phase 5 refines. Boundaries above are settled. -->

### 4.3 Components

| Component | Responsibility | Inputs | Outputs | Depends on |
|---|---|---|---|---|
| `AuditExportJob` | Orchestrates one tenant-run | Tenant id, run date | Run result | `TenantConfigStore` |
| `NdjsonWriter` | Streams events to chunked NDJSON | Event stream | Byte stream, counts | — |
| `S3RoleAssumer` | Assumes the tenant role, returns a scoped client | Role ARN, external ID | `IAmazonS3` | STS |
| `ManifestSigner` | Builds and signs the run manifest | Object metadata | Signed manifest | Platform export key |
| `ExportRunLog` | Records runs for replay and spill detection | Run result | Run rows | Platform DB |

### 4.4 Data Model

Manifest sequence numbers are per tenant, monotonic, and reused on replay.
[Locked] See [Retention and replay](./pathfinder/questions/04-retention-and-replay.md).

### 4.5 API Design

<!-- Phase 5 fills. No public API surface was decided during pathfinding. -->

## 5. Implementation Phases

<!-- Intentionally empty. Phase 6 of /plan2code-1-plan breaks the requirements
     above into implementation phases. Pathfinder decides; it does not slice. -->

## 6. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-account role assumption is unexercised in this codebase | Medium | High | Spike `S3RoleAssumer` against a second AWS account before any other component |
| A tenant exceeds the daily ceiling indefinitely | Medium | Medium | Spill oldest-first plus a three-run alarm — [Overflow behavior](./pathfinder/questions/08-overflow-behavior.md) |
| Partial objects visible after a failed run | Low | High | Upload to a run-scoped prefix, publish the manifest last — the manifest is the commit point |
| `AuditQuery` materialises full result sets | High | High | Streaming reader is a prerequisite, not an optimisation |
| Customer revokes the role mid-run | Low | Medium | Fail the run whole; replay window covers recovery |

## 7. Success Criteria

- [ ] A tenant with a configured role receives NDJSON and a signed manifest for the prior day, nightly
- [ ] The published public key verifies the manifest signature
- [ ] A 250 MB tenant-day completes without extending the window past 04:00 UTC
- [ ] A replay inside 7 days reproduces the run without a new sequence number
- [ ] A failed run leaves nothing visible in the customer bucket

## 8. Open Questions

<!-- 1-plan's template removes this section when empty; pathfinder keeps it with "None" so a
     resuming session can see the map cleared clean, rather than that the section was forgotten. -->

None. The map cleared with zero open questions.

## 9. Assumptions

- Tenants can create an IAM role in their own account — [Destination auth](./pathfinder/questions/03-destination-auth.md) [Locked]
- The nightly Hangfire window remains available and is not contended by other jobs — [Scheduling model](./pathfinder/questions/02-scheduling-model.md) [Locked]
- Manifest sequence reuse on replay is acceptable to tenant compliance teams — [Retention and replay](./pathfinder/questions/04-retention-and-replay.md) [Locked]
- Audit events are immutable once written, so a replay reproduces byte-identical output

## Pathfinder Provenance

Charted over 9 sessions. Each requirement above traces to a decision below; open the
question for what was rejected, why, and what it costs.

| Question | Gist |
|---|---|
| [Codebase context](./pathfinder/questions/00-codebase-context.md) | `AuditExportJob` and `HangfireStartup` are the extension points; `AuditQuery` needs a streaming reader first |
| [Export format](./pathfinder/questions/01-export-format.md) | NDJSON with a per-run signed manifest; CSV rejected for nested actor payloads |
| [Scheduling model](./pathfinder/questions/02-scheduling-model.md) | Reuse the existing Hangfire recurring job; a dedicated export service was rejected |
| [Destination auth](./pathfinder/questions/03-destination-auth.md) | Customer-owned bucket via assumed role plus external ID; no platform-held customer credentials |
| [Retention and replay](./pathfinder/questions/04-retention-and-replay.md) | 7-day replay window, sequence numbers reused on replay |
| [Testing posture](./pathfinder/questions/05-testing-posture.md) | Unit + integration, run after each phase, moderate coverage |
| [Throughput ceiling](./pathfinder/questions/06-throughput-ceiling.md) | 200 MB per tenant per day at p95; multipart upload proven in `pathfinder/sketch-02/` |
| [Overflow behavior](./pathfinder/questions/08-overflow-behavior.md) | Spill oldest-first into the next run; alarm after three consecutive spills |

Ruled out of scope: [Failure notification](./pathfinder/questions/07-failure-notification.md) — recorded in 2.3.

---

**Next:** Resume with `/plan2code-1-plan` at Phase 4 (Tech Stack).

- **Phase 7 verification:** sections 1, 2, System Context and Scope Assessment are already settled — their source of truth is `specs/audit-log-s3-export/pathfinder/map.md`, not this conversation. Verify sections 3-7 only.
- **Phase 7:** replace THIS file in place. Do not create a second PLAN-DRAFT in this folder.
````

### Two things in that template that are not optional

**No scrapable confidence numbers anywhere in the file.** Write the confidence as `Requirements-clarity 22/25 · Feasibility-technical 21/25 · Integration-points 23/25 · Risk-assessment 20/25` — hyphenated dimension labels, sub-scores over 25, no total, no percent sign.

The reason is exact. When a PLAN-DRAFT carries no `METRICS_JSON` comment, the metrics collector falls back to scraping it by regex: an overall-confidence pattern that requires a literal `%`, and four breakdown patterns that match a bare `Requirements` / `Feasibility` / `Integration` / `Risk` followed directly by whitespace, a colon, or a pipe and then digits. **The breakdown patterns do not require a percent sign.** A pathfinder-written draft always lacks that comment until `/plan2code-1-plan` Phase 7 appends one, so both the percent sign *and* the bare dimension words have to be kept off the page — otherwise the pipeline records a planning-step confidence that no planning step ever produced. The hyphen in `Requirements-clarity` breaks the match; a table row reading `| Requirements | 11 |` does not, which is why the Scope Assessment row is labelled `Requirements decided`.

**The `**Next:**` footer must ship with both bullets.** Pathfinder cannot edit the planning skill, so those two instructions travel inside the artifact:

- *Without the verification bullet*, 1-plan's Phase 7 does exactly what it is told to do — "re-read conversation as source of truth" — finds a fresh conversation that starts at Phase 4 and contains no requirements discussion at all, concludes sections 1 and 2 are unsupported, and silently drops the requirements that N pathfinder sessions produced. The bullet redirects the source of truth for the settled sections to `map.md`.
- *Without the replace-in-place bullet*, 1-plan's Phase 7 creates `PLAN-DRAFT-<its own date>.md` alongside yours. `/plan2code-2-document` then finds two drafts in the folder, hits its "Multiple found: List all, ask which to document" branch, and asks the user to disambiguate between a pathfinder draft and a plan draft that partially supersedes it.

Never drop the footer to make the file tidier. It is load-bearing.

## System Context and Scope Assessment — why they buy you Phase 4

These two named, unnumbered sections are what make "Resume at Phase 4" legitimate rather than a shortcut. They stand in for the phases pathfinder already did the work of:

| Draft section | Satisfies | Because pathfinder already |
|---|---|---|
| Sections 1 and 2 (including 2.4 Testing Strategy) | 1-plan **Phase 1: Requirements Analysis** | Grilled every functional and non-functional decision, and always charted a testing-posture question — that question exists specifically so Phase 1's testing prompt is already answered |
| `## System Context` | 1-plan **Phase 2: System Context Examination** | Wrote `questions/00-codebase-context.md` at Chart Step 3: directory structure, key components verified against actual code, patterns and conventions, integration points, technical debt, boundaries — Phase 2's own checklist, item for item |
| `## Scope Assessment` | 1-plan **Phase 3: Scope Assessment** | Produced the counts Phase 3 measures — requirements, components, integrations — as a byproduct of charting. Map the totals onto Phase 3's Small / Medium / Large table and state the verdict |

Populate `## System Context` from `00-codebase-context.md` and nothing else. It is the one question guaranteed to exist on every map, it was resolved on the spot with the codebase open, and it is a `legwork · AFK` answer — factual, not preferential. Cite it in the Source column so a skeptical reader can check the finding against the file.

Populate `## Scope Assessment` from the shape of the map. Count resolved questions that produced requirements (not `00-codebase-context.md`, not out-of-scope ones), count distinct components named across the answers, count distinct external systems. Apply Phase 3's thresholds honestly: Large if **any** threshold is met. Score the counts, never the session count — a map can take nine sessions to clear and still be Medium, and the `Phase 3 Complete - Resume at Phase 4` status string works regardless of the verdict, so there is nothing to gain by inflating it. Pathfinder cannot count implementation phases (Section 5 is deliberately left empty), so assess on requirements, components, and integrations only.

If the charting session found `AGENTS.md` absent, say so in the `Conventions in force` row rather than leaving it blank. The plan session needs to know the conventions were never available, not guess that they were checked.

## Freeze the map

Once the PLAN-DRAFT is written and saved:

1. Set `**Status:** Cleared` in `map.md`.
2. Bump `**Updated:**` to today.
3. Add a plan pointer line under the status: `**Plan:** ../PLAN-DRAFT-20260803.md`.
4. Leave **everything** under `pathfinder/` exactly where it is — `map.md`, every file in `questions/`, every `sketch-NN/` directory.

**Never delete `pathfinder/`.** It is the rationale record behind the plan: what was decided, what was rejected, why, and what it costs. It sits in the same class as `PLAN-CONVERSATION-*.md` — the transcript a plan is defensible against — and `/plan2code-4-finalize` archives it alongside `PLAN-DRAFT.md` and `PLAN-CONVERSATION-*.md` into `specs--completed/<idea>/`. Deleting it turns every locked decision in the plan into an unexplained constraint six months from now.

Do not tidy it either. Do not collapse resolved questions into the map, do not prune `## Evidence`, do not remove sketch directories because the code is throwaway. The sketch is the proof behind a feasibility score.

**A later session that finds `Status: Cleared` must not resume work on it.** The map is finished; there is nothing left to decide inside it. Point at the PLAN-DRAFT and `/plan2code-1-plan`, and stop. If the destination has been redrawn — the scope grew, an out-of-scope item came back, the goal changed — that is a **fresh effort with a fresh map**, not a resumption: a new kebab-case idea name, a new `specs/<new-idea>/pathfinder/`, charting from Step 1. The frontier stops at the destination, so a new destination gets a new frontier. Reopening a cleared map silently invalidates the PLAN-DRAFT that was built from it, and nothing downstream would notice.

## What to tell the user

Session End for the cleared case reports six things, in this order:

| # | Report |
|---|---|
| 1 | The destination, restated — what the map was finding its way to, now reached |
| 2 | How many decisions were made, and the headline ones **by name** |
| 3 | What was ruled out of scope, and why (one line each) |
| 4 | The four confidence scores, with a one-line justification for any below 21 |
| 5 | The PLAN-DRAFT path |
| 6 | The next command — carried by the Trail Footer, which at `Cleared` routes to `/plan2code-1-plan` |

Example:

> **Destination reached:** a spec a developer can implement for nightly audit-log export to customer-owned S3 buckets with a signed manifest.
>
> **8 decisions made** across 9 sessions. The load-bearing ones: [Export format](./questions/01-export-format.md) settled on NDJSON with a signed manifest; [Destination auth](./questions/03-destination-auth.md) settled on assumed roles with an external ID so we never hold customer credentials; [Overflow behavior](./questions/08-overflow-behavior.md) settled on spilling rather than truncating.
>
> **Ruled out of scope:** failure-notification delivery (belongs to the platform alerting effort), on-demand export from the tenant UI (its own effort), Parquet output (past the destination).
>
> **Confidence:** Requirements-clarity 22/25 · Feasibility-technical 21/25 · Integration-points 23/25 · Risk-assessment 20/25. Feasibility is held at 21 because cross-account role assumption is unexercised in this codebase — it is a documented pattern, not a proven one here, and it is the first thing to spike.
>
> **Written:** `specs/audit-log-s3-export/PLAN-DRAFT-20260803.md`. It resumes planning at Phase 4 — sections 1, 2, System Context and Scope Assessment are already settled. The reasoning behind every one of them stays in `specs/audit-log-s3-export/pathfinder/`; do not delete it.

Then the closing block from the skill's Session End — the mascot with the message *The way is clear! Time to plan!* followed by the Trail Footer, whose trail shows every stop walked to the `⚑` destination and whose command is `/plan2code-1-plan`.

**One branch.** If `## Ground rules` records `AGENTS.md` as **absent**, recommend `/plan2code-init` FIRST, and offer `questions/00-codebase-context.md` as its input:

> Before planning: this project has no `AGENTS.md`, and `/plan2code-1-plan` blocks on that. Run `/plan2code-init` first and attach `specs/audit-log-s3-export/pathfinder/questions/00-codebase-context.md` — the recon pass already established the structure, conventions, and integration points it asks for. Then `/plan2code-1-plan`.

Nothing to commit — `specs/` is gitignored. Say so once, then stop.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| 1-plan starts at Phase 1 and re-asks for requirements | The status string does not match byte for byte | Compare against the quoted line above; watch for en dashes and casing |
| 1-plan cannot find the draft at all | Glob was used to discover `specs/` | Shell only: `ls specs/` |
| `/plan2code-2-document` asks which of two drafts to use | The replace-in-place bullet was dropped from the footer | Merge the two drafts into the pathfinder-dated one, delete the other, restore the footer |
| The finished plan is missing requirements the map decided | The verification bullet was dropped from the footer | Re-derive 2.1 and 2.2 from the resolved answers, restore the footer |
| Metrics report a planning confidence nobody scored | A percent sign, or a bare dimension word followed by a number, reached the file | Hyphenate the dimension labels and drop the percent sign |
| A locked decision in the plan has no visible reason | `pathfinder/` was deleted or pruned | Unrecoverable. This is why the freeze step exists |
| Gate passes but the first implementation session immediately hits an undecided question | A dimension was rounded up | The gate was the check. Score the written record, not the feeling |