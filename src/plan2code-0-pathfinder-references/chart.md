# Chart Playbook
> Part of plan2code-0-pathfinder — loaded at the top of MODE A (Chart). Expands the numbered Chart steps.
>
> **Backend note.** Steps 0, 2, and 4 — the gates and the grills — are identical either way, and so is every judgement call below (fog vs question, in scope vs out, the destination test). What differs is where Steps 3 and 5-7 put the bytes: on `**Backend:** github`, `github-issues.md` overrides the `map.md` and question-file templates here, the single-pass rule under *Step 6: Numbering and dependency order*, and the timing of the recon. Read it alongside this file, not instead of it.

Charting produces a map and a set of question files. It resolves nothing by hand. Every judgement below serves one goal: put a sharp question on the map for everything you can phrase now, and leave everything else honestly in the fog.

---

## Step 0: The intent gate

Pathfinder builds an apparatus — a directory, a map, a file per decision. That apparatus earns its keep only when the way to the destination is genuinely foggy. For a small or already-clear ask it is pure overhead, and creating it before the human has agreed to it is the fastest way to make Pathfinder feel heavy and get in the way. So the gate runs **before the first byte hits disk**.

You already have the idea name from Auto-Discovery. Do NOT create the directory yet. Say, in substance:

> "This is Pathfinder. Nothing exists for `<idea>` yet. Pathfinder charts a map of the open decisions when an idea is big or unclear to plan — but that is overhead if this is small or already clear. Three ways to go:
> - **Chart it** — I map the open decisions, one per session, then hand a draft to `/plan2code-1-plan`.
> - **Straight to `/plan2code-1-plan`** — the way looks clear enough to plan now.
> - **`/plan2code-quick-task`** — small enough to just do.
>
> My read: `<recommendation with a one-line reason>`. Which?"

Rules for the gate:

- **It is HITL.** You recommend; the human chooses. Never self-select "chart" and start creating files because it is the default path — that is exactly the failure this gate exists to stop.
- **Read the request honestly.** A one-line bugfix, or a change with no open decisions, is not a charting job — recommend an off-ramp and mean it. Reserve "chart" for real fog: several unsettled decisions, unclear scope, or competing designs.
- **No disk writes.** Naming the idea and talking is free. Creating `specs/<idea>/pathfinder/` is not — it waits for an explicit "chart."
- **On an off-ramp, route and STOP.** Point at `/plan2code-1-plan` or `/plan2code-quick-task`, create nothing, end the session. If `AGENTS.md` is absent, mention `/plan2code-init` first, as with any handoff.

This gate and the Step 4 no-fog off-ramp are the same instinct at two moments: the gate is the human's call before any work; the off-ramp is your call once the breadth-first grill has proven there was no fog after all. Either one ending the session without a map is a success, not a failure.

---

## Step 2: The destination grill

The destination is settled **first** because it fixes scope. Every later judgement — is this a question or fog, is this in scope or past the edge, is this map cleared — is measured against it. A vague destination makes all three unanswerable, and you will spend the rest of the map arguing about boundaries instead of decisions.

A destination is **one or two lines** describing what exists when the map clears. It is not a feature description. It is not a value proposition. It names the artifact and draws the edge.

### The script

Recommend an answer with each probe — the human corrects faster than they compose. Follow the grilling playbook for tone, cadence, and the batching rules; this is the content.

**Six probes, two batches.** They do not all pass the independence test, so they split:

| Batch | Probes | Why they go together |
|---|---|---|
| First | 1 (artifact), 2 (person), 6 (forcing function) | Each stands alone. None reads differently under the others' answers. |
| Second | 3 (sacrificial boundary), 4 (smallest arrival), 5 (arrival signal) | All three presuppose an artifact and an actor. Sending them before batch 1 lands asks the human to draw an edge around something unnamed. |

Two round trips, not six. Three probes each — exactly the cap, so neither batch needs splitting.

Batch 2 bends the independence test on purpose. The arrival signal (5) can shift under the smallest arrival (4), so strictly it should be held back — but holding it costs a third round trip to catch a conflict that is rare and cheap to spot. The trade is to send them together and reconcile at the recap: if the smallest arrival comes back materially smaller than the artifact you were told about, re-check the arrival signal against it before writing the destination. A knowing trade here, not a licence to batch dependent probes elsewhere.

**Both batches go out as numbered Q blocks — this grill is the other standing exception to the tool-first rule.** Probes 2, 3, 4, and 5 need the human's own phrasing — the destination is written into `map.md` verbatim as agreed, so a clicked option label is not something you can write down. That is the detail test's first row, four times over. Probe 6 names categories but the category is the worthless half of the answer: "deadline" changes nothing, "Q3 close, and the SEC audit lands Nov 1" changes the delivery question, the testing posture, and the out-of-scope line at once. Only probe 1 would survive a picker on its own, and it rides in a Q block anyway, because one tripping probe downgrades the whole batch. Do not reach for the structured question tool here.

**Probe 1 — the artifact**

> "When this map is cleared, what exists that does not exist now: a plan you hand to `/plan2code-1-plan`, a decision locked before anyone plans, or a change already made in the codebase? My guess: a plan."

*Fishing for:* the shape of the destination. Push back if the answer is "the feature working" — that is past the edge of every pathfinder map. Say so plainly: "That is the build. The map ends at the plan for the build."

**Probe 2 — the person on the other end**

> "Who uses the result, and what do they do with it the day it lands?"

*Fishing for:* the actor and the moment of use. Vague actors ("users", "the business") produce vague scope. Push until you get a role someone could name in an approval — compliance officer, on-call SRE, tenant admin.

**Probe 3 — the sacrificial boundary**

> "Name one thing a reasonable person would assume is part of this that you are willing to say is NOT part of it."

*Fishing for:* the first `## Out of scope` bullet. This probe does more work than any other. A destination nobody has excluded anything from has not been thought about. If the human cannot name one, offer two candidates and make them reject one.

**Probe 4 — the smallest arrival**

> "What is the smallest version that would still count as arriving? If only that existed, would you call it done or would you feel cheated?"

*Fishing for:* the difference between the destination and the wish list. Everything above the smallest arrival is a candidate for out of scope or for a later effort.

**Probe 5 — the arrival signal**

> "How do you know you have arrived — what do you look at?"

*Fishing for:* a checkable condition. "It feels right" is not one. "Every open decision has an answer and I can hand the draft to planning without re-litigating format" is one.

**Probe 6 — the forcing function**

> "What made this surface now? A deadline, an incident, an audit, a customer?"

*Fishing for:* constraints that will shape half the questions and that nobody volunteers unprompted. A regulatory deadline changes the delivery question, the testing posture question, and the out-of-scope line all at once.

**The probe names above are internal labels, not headings the human reads.** Head each Q block plainly — *What you end up with*, *Who uses it*, *What's not included*, *Smallest version that counts*, *How you know it's done*, *Why now* — and keep the probe text itself as plain as the quotes above. "The sacrificial boundary" and "the arrival signal" mean something to this playbook and nothing to the person answering. Full rule in the grilling playbook, *Say it in plain English*.

### Worked example — same idea, two destinations

**Idea:** "we should let people export audit logs"

**BAD destination**

> Let users export audit logs so they have their data.

Why it fails, concretely:

| Failure | Consequence downstream |
|---|---|
| No artifact named | Nobody knows whether the map clears at a plan or at shipped code |
| "Users" is not a role | The authorization question cannot even be phrased |
| No edge | Live streaming, SIEM push, and a schema redesign all argue their way in |
| No arrival signal | The Clearing Gate has nothing to check against |
| "their data" is a rationale, not a boundary | Every fog bullet reads as in scope |

**GOOD destination**

> A locked implementation plan for a compliance officer to export a filtered range of audit events from the admin UI and receive them as a single downloadable file. The map ends at the plan, not at shipped code. Continuous streaming to external systems is not on the route.

Three sentences, two lines of substance: artifact (a plan), actor (compliance officer), trigger surface (admin UI), shape of the result (one downloadable file), and an explicit edge (no streaming). Every one of those clauses will be cited later when you decide whether something is a question, fog, or out of scope.

**Write the destination into `map.md` verbatim as agreed.** Do not improve it afterwards. If it needs changing, change it with the human present — a silently redrawn destination invalidates every scope call already made.

---

## Step 3: Codebase recon

Recon is `legwork · AFK` — you do it alone, and you write it down **already resolved**. It exists so that no later session re-reads the same directories, and so that the handoff carries the ground truth `/plan2code-1-plan` Phase 2 (System Context Examination) would otherwise have to rediscover.

`questions/00-codebase-context.md` is always `00`. It always exists. It is created with `State: resolved` and a filled `## Answer` in the same write.

### What to explore

| Area | What to establish | Where to look |
|---|---|---|
| **Directory structure** | The map of the repo at the depth that matters for this destination — not every folder, the ones the work will touch | Top-level listing, then two levels into the relevant subtrees |
| **Key components** | The modules that would be read, changed, or called. Name, path, responsibility | Entry points, route/controller registries, service layers |
| **Patterns and conventions** | How this codebase does the thing you are about to plan: error handling, validation, config, module layout, naming, async style | Two or three recent files in the target area, plus `AGENTS.md` |
| **Integration points** | External systems, queues, storage, auth providers, feature-flag services the work will cross | Config files, environment variable references, client wrappers |
| **Technical debt in the blast radius** | Only debt the destination would collide with. Not a repo-wide audit | Long files in the target area, duplicated helpers, stale TODO markers with no owner |
| **System boundaries** | What this effort owns versus what it merely calls. Where the change stops | Package boundaries, ownership files, API contracts |

Two disciplines keep this file useful:

- **Verify behaviour against actual code, never against a filename.** A file called `auditLogger.ts` may log nothing.
- **Scope the recon to the destination.** A recon of the whole repo is unreadable and stale in a week. If a subtree cannot plausibly be touched by the destination, say so in one line and move on.

Record what you could **not** determine as an explicit gap. Gaps at recon time are often the first real fog bullets.

### The literal file

```markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Codebase context

Type: legwork · AFK
State: resolved
Blocked by: none
Claimed: 2026-08-03 09:12
Locked: no

## Question

What does this codebase already provide, constrain, and forbid for an operator-initiated
audit-log export? Establish structure, components, conventions, integrations, debt in the
blast radius, and boundaries — enough that no later session re-reads the same ground and
enough to hand to `/plan2code-1-plan` as its system context.

## Answer

### Directory structure

- `src/api/` — Express routers, one file per resource. `src/api/admin/` is the admin surface.
- `src/services/` — business logic; the only layer allowed to touch `src/db/`.
- `src/db/` — Knex query builders and migrations. `audit_events` lives here.
- `src/jobs/` — BullMQ workers. Existing precedent for long-running work.
- `src/web/admin/` — React admin UI, TanStack Query, colocated route components.
- `test/` — Vitest, mirroring `src/` one-to-one.

Untouched by this destination: `src/billing/`, `src/web/marketing/`.

### Key components

| Component | Path | Responsibility |
|---|---|---|
| `auditEvents.record()` | `src/services/auditEvents.ts` | Sole writer of `audit_events`; called from 31 sites |
| `adminRouter` | `src/api/admin/index.ts` | Mounts admin routes; applies `requireAdmin` |
| `requireAdmin` | `src/api/middleware/auth.ts` | Session check plus role check; no per-tenant scoping today |
| `reportQueue` | `src/jobs/reportQueue.ts` | BullMQ queue used by the existing billing report export |
| `signedUrl()` | `src/services/storage.ts` | S3 pre-signed URL helper, fixed 15-minute expiry |

### Patterns and conventions

- Errors: typed error classes thrown from services, mapped to HTTP by `errorHandler`. Never raw `res.status(500)`.
- Validation: Zod schema per route, exported next to the handler.
- Config: everything through `src/config.ts`; no direct `process.env` reads outside it.
- Async: `async`/`await` throughout. No callback style remains.
- Long-running work: enqueue to BullMQ, return `202` with a job id. Established by billing reports.
- Tests: Vitest, colocated fixtures, no shared mutable state between cases.

### Integration points

- **Postgres 15** via Knex. `audit_events` is ~180M rows, partitioned monthly.
- **Redis** backing BullMQ.
- **S3** for generated artifacts; the billing export already writes there.
- **SES** for transactional mail; templates in `src/mail/templates/`.
- No SIEM, log-shipping, or streaming integration exists today.

### Technical debt in the blast radius

- `audit_events` has an index on `(tenant_id, created_at)` but none on `actor_id`. Any
  actor-filtered export will sequential-scan a partition.
- `requireAdmin` does not scope by tenant — a platform admin currently sees all tenants.
  Any authorization decision here inherits that gap.
- The billing export writes CSV by hand-rolled string concatenation with no escaping.
  Do not copy it.

### System boundaries

Owned by this effort: a read path over `audit_events`, an admin UI surface, an artifact
written to S3, and a delivery notification. Not owned: the write path (`auditEvents.record()`
is untouched), the audit event schema, tenancy semantics in `requireAdmin`.

### Gaps

- Retention policy for `audit_events` is not expressed anywhere in code. Someone outside
  engineering owns it.
- No load figures exist for the largest tenant's monthly event count.

**Gist:** Node/Express/Knex/React with an established BullMQ-to-S3 export precedent from
billing; `audit_events` is 180M rows partitioned monthly with no `actor_id` index, and
`requireAdmin` has no per-tenant scoping.

## Evidence

- `src/api/admin/index.ts`, `src/api/middleware/auth.ts`
- `src/services/auditEvents.ts`, `src/services/storage.ts`
- `src/jobs/reportQueue.ts` and the billing export job it drives
- `src/db/migrations/20240914_partition_audit_events.js`
- `AGENTS.md` (conventions section)
```

---

## Step 4: The breadth-first frontier grill

The destination grill went **deep on one thing**. This grill goes **wide on everything**. They are different activities and mixing them is the most common way to produce a bad map.

| | Destination grill (Step 2) | Frontier grill (Step 4) |
|---|---|---|
| Goal | One or two settled lines | An inventory of open decisions |
| Movement | Drill until it is precise | Fan out until you stop finding new areas |
| Follow-ups | Chase every hedge | One clarifier at most, then move on |
| Success | The human commits to a boundary | You can name the areas, sharp and unsharp alike |
| Failure mode | Accepting a slogan | Solving a question instead of finding the next one |

**You are not resolving anything here.** You are taking inventory. The instant an answer feels satisfying, you are probably going deep.

### Recognising that you have gone deep

Watch for these. Any one of them means stop and pull back:

- You have asked three consecutive probes about the same area.
- You are discussing an implementation detail (a column type, a library, a retry count) rather than a decision.
- You are proposing a design instead of asking what has to be decided.
- The human is enjoying it. Depth is more fun than breadth; that is exactly why it steals the session.
- You have written something down that reads like an answer.

### Pulling back

Say it out loud so the human tracks the move, then jump:

> "Good — that is one for the map, not for now. Parking it as *Export format*. Different corner: who is allowed to run an export at all?"

Two mechanics keep the fan-out honest:

1. **Round-robin the areas.** Before you start, list the axes you intend to cross: data, surface, permissions, volume, delivery, failure, operations, testing. Take one probe per axis before any second probe on any axis.
2. **Ask for the axis you have not touched.** Near the end: "What have I not asked about that would embarrass us to discover in week three?"

**Breadth-first is the ideal batch.** One probe per axis means the probes are independent by construction — that is what breadth-first *means* — so this grill should run as batches of three, not as a stream of singles. Seven axes is three turns. If you catch yourself wanting to batch two probes on the same axis, that is depth wearing a batch's clothes; pull back.

### Sample breadth probes

Each opens a different axis. Send 1-3 as one batch and 4-6 as the next, then probe 7 alongside the "what have I not asked about" closer above; note each answer and move.

**They go out as numbered Q blocks — this grill is one of the two standing exceptions to the tool-first rule.** Several of the probes do name alternatives, so they would pass the detail test on its own terms, and that is exactly the trap: the output of this grill is not a decision, it is a *sort* into sharp question or fog, and sorting takes the elaboration around the answer. A clicked label leaves you nothing to sort with. The structured question tool earns its keep in MODE B, where a claimed question already has named alternatives and the sorting is long done.

1. **Data** — "What is the smallest and largest thing an operator could reasonably ask for in one export? Give me both ends."
2. **Surface** — "Where does this start: a button in the admin UI, a scheduled thing, an API call someone scripts?"
3. **Permissions** — "Who is allowed to run one, and can they export events about people other than themselves?"
4. **Volume and time** — "If an export takes four minutes, is that fine, bad, or a redesign?"
5. **Delivery and failure** — "The export succeeds but the download link expires before they click it. What should have happened?"
6. **Operations** — "Six months from now someone asks who exported what. Does this feature audit itself?"
7. **Testing** — "What would you need to see pass before you would let this near a customer's compliance data?" *(This one always runs — see the mandatory testing-posture question below.)*

Record each answer as one line in your working notes with an area label. At the end of the grill you will have two piles: lines you can turn into a sharp question, and lines you cannot. The second pile is the fog.

---

## The fog-vs-question test

This is the single most important judgement in the skill. Get it wrong toward questions and the map fills with unanswerable stubs that block the frontier. Get it wrong toward fog and the map has nothing takeable on it.

> **The test is whether you can STATE the question precisely now — not whether you can ANSWER it now.**

- **Write a question file** when the question is already sharp — *even if it is blocked and nobody can act on it yet*. Blocked questions are real questions; they get `Blocked by:` and a `[!]` row and they wait. Blocked is not the same as unformed.
- **Leave it in `## Not yet specified`** when you cannot yet phrase it that sharply. You can see there is something there; you cannot say what is being asked.

**Do not pre-slice the fog.** A fog patch is deliberately coarser than a question. One patch may graduate into three questions, or one, or none once the frontier reaches it. Splitting fog into question-shaped fragments before it is sharp invents a structure that the answers will contradict, and it costs a later session the work of deleting your guesses. Write the patch as loosely as the view allows.

A useful forcing check: **could a different person, reading only this line, know what a good answer looks like?** If yes, it is a question. If they would have to ask you what you meant, it is fog.

### Worked examples

| Candidate | Verdict | Reasoning |
|---|---|---|
| "CSV or JSONL for the export file?" | **Question** | Two named options, one decision, one sitting. A reader knows what an answer looks like. `grill · HITL`. |
| "Which roles may export events about other users?" | **Question**, blocked | Sharp today, but it depends on the tenant-scoping decision. Write it, set `Blocked by:`, mark the row `[!]`. Blockedness never demotes a sharp question to fog. |
| "Something about how big exports behave" | **Fog** | "Big" has no meaning until the volume ceiling lands. You cannot say whether the question is about pagination, streaming, timeouts, or refusal. One line in `## Not yet specified`. |
| "There is probably something about PII redaction" | **Fog** | The area is visible, the question is not. Once Legal answers, this may graduate into *which fields are redacted*, *who configures it*, and *does redaction apply to the actor or the subject* — or into nothing, if the answer is "export raw." Slicing it now guesses all three. |
| "How should we architect the export pipeline?" | **Neither — split it** | No single answer closes it; it bundles at least four decisions (sync vs queued, storage target, artifact lifetime, notification). Ask what the parts are. The sharp parts become questions, the rest becomes fog. A candidate no single answer closes is not a question. |

**What never belongs in `## Not yet specified`:** anything already decided (it is a resolved question with a gist on its row), anything that already has a question file, and anything past the destination (that is out of scope).

---

## Out of scope versus fog

Fog gathers **only toward the destination**. The destination fixes the scope, so work beyond it is not dim — it is *excluded*. It is not fog, and it must never sit in `## Not yet specified`, where a later session would try to graduate it.

**The distinction is SCOPE, not sharpness.** This is the part people get wrong. An out-of-scope item can be perfectly sharp — "should the export push to Splunk on a schedule?" is a crisp question with a crisp answer. It is still out of scope, because the destination said the map ends at an operator-initiated export. Sharpness decides *fog versus question*. Position relative to the destination decides *in scope versus out*.

| | Fog (`## Not yet specified`) | Out of scope (`## Out of scope`) |
|---|---|---|
| Position | Before the destination | Past the destination |
| Why it is not a question | Cannot be phrased sharply yet | Could be phrased perfectly — it just is not ours |
| Future | Graduates into questions as the frontier advances | Never graduates |
| Reopening | Automatic, as answers land | Only if the destination is redrawn — and then as a fresh effort, not a resumption |
| The act | An admission of ignorance | A scoping decision |

Ruling something out of scope is a **scoping act, not a step on the route**. When a question you already created turns out to sit past the destination — mis-scoped in during charting, or exposed by a later answer — set `State: out-of-scope`, mark its row `[-]`, and leave one line in `## Out of scope` giving the gist and the reason, linking the question by name. It does not get an `## Answer` and it is not a decision the route walked.

Watch for **stranded** questions: a live question whose `Blocked by:` names something now out of scope will never unblock. Re-frame its `## Question` to drop the dependency, or rule it out too. Never leave it sitting.

---

## Step 6: Numbering and dependency order

Upstream wayfinder creates every unit first and wires the blocking edges in a **second pass**, because a server-side tracker assigns ids and nothing can reference a sibling until it has one. On `**Backend:** local` that constraint does not exist — **you choose `NN` yourself**, so charting is a **single pass**: decide the order, then write each file complete, `Blocked by:` filled at the moment of writing.

(On `**Backend:** github` the constraint comes back, and so does the two-pass shape. Rules 1, 6, 7, and 8 below still hold — they are about dependency reasoning, not about ids. Rules 2-5, which are about `NN`, are replaced by sub-issue order; see `github-issues.md`.)

The rules:

1. **Sort by dependency before you write anything.** Sketch the edges on paper first: which decisions must land before which others can even be discussed.
2. **Blockers get lower numbers.** If *Row-count ceiling* blocks *Delivery channel*, the ceiling is `02` and delivery is `05`. This makes `Blocked by: 02` readable at a glance and makes "lowest `NN` first" on the frontier a sane traversal order.
3. **`00` is always the codebase context.** Never anything else.
4. **`NN` is never reused and never renumbered.** Not when a question is ruled out of scope, not when one is deleted, not to close a gap in the sequence. Links and `Blocked by:` lines would rot silently. Gaps in the numbering are normal and harmless.
5. **The next number is max + 1**, computed from the directory listing, not from the map.
6. **Only depend on what genuinely gates the question.** A `Blocked by:` chain that is really a preference for reading order strangles the frontier. Ask: could this question be answered — badly but honestly — without the blocker? If yes, it is not blocked.
7. **Cycles are a phrasing bug.** If A blocks B and B blocks A, the two are one decision. Merge them or re-frame one to drop the edge.
8. **Refer by name in prose.** Bare numbers appear only on `Blocked by:` lines.

A worked ordering for the audit-log export map:

| `NN` | Name | Type | Blocked by | Why here |
|---|---|---|---|---|
| `00` | Codebase context | `legwork · AFK` | none | Always first, always resolved |
| `01` | Export format | `grill · HITL` | none | Nothing gates it; it gates the artifact shape |
| `02` | Row-count ceiling | `research · AFK` | none | A fact about the data, independent of every preference |
| `03` | Export authorization | `grill · HITL` | none | Independent axis; can be argued today |
| `04` | Testing posture | `grill · HITL` | none | Mandatory; independent of everything else |
| `05` | Delivery channel | `grill · HITL` | `02` | Synchronous download versus queued link turns entirely on volume |
| `06` | SIEM push connector | `grill · HITL` | none | Created, then immediately ruled out of scope during charting — `State: out-of-scope`, no `## Answer` |

---

## The `map.md` template

Below is a complete, realistic map for the audit-log export effort **partway through MODE B**, after two questions have resolved — it shows every marker in use. At Chart Step 5 the same file carries `**Status:** Charting`, an empty `## Question Checklist`, and no `[x]` row except `00`. Copy the structure exactly, including the HTML comments — they are written **for the next session**, which has no memory of this one.

`**Status:**` is `Charting` while Step 5 and Step 6 run, becomes `Working` at Step 7, and becomes `Cleared` only at handoff. It is how the orchestrator routes a fresh session, so it must be accurate before you stop.

Set `**Confidence:**` honestly at Step 5 and re-score it every time a question resolves. Charting scores are low by construction — that is the point. The Clearing Gate needs every dimension at 18/25 or better. Never inflate to make the gate pass.

Write the four dimension labels **hyphenated exactly as shown** — `Requirements-clarity`, `Feasibility-technical`, `Integration-points`, `Risk-assessment` — in the `NN/25` form, with no percent symbol anywhere in the file. The metrics collector scrapes planning documents by regex for a bare dimension word followed by whitespace, a colon, or a pipe and then digits; the hyphen breaks that match. A percent sign or a bare `Requirements 18` would be ingested as a completed planning step's confidence score that no planning step ever produced.

Say once, at Step 5: *"This map lives in gitignored `specs/` — local to you, not shared. `git add -f` it to track it."*

```markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Map: audit-log-export

**Status:** Working
**Updated:** 2026-08-03
**Confidence:** Requirements-clarity 18/25 · Feasibility-technical 14/25 · Integration-points 16/25 · Risk-assessment 14/25

<!-- Status: Charting while the map is being built (Chart Steps 1-6) -> Working once the
     checklist is indexed (Chart Step 7) -> Cleared only when the Clearing Gate passes.
     A fresh session routes on this line, so it must be correct before the session ends. -->

<!-- Confidence: four dimensions, each scored out of 25, re-scored at every resolution.
     The Clearing Gate requires all four at 18/25 or better. Score against evidence. -->

## Destination

A locked implementation plan for a compliance officer to export a filtered range of audit
events from the admin UI and receive them as a single downloadable file. The map ends at the
plan, not at shipped code. Continuous streaming to external systems is not on the route.

<!-- Settled at Chart Step 2 and quoted as agreed. Every question is measured against it:
     in scope or past the edge, still needed or now moot. Change it only with the human
     present — a silent redraw invalidates every scope call already made. -->

## Ground rules

<!-- Standing constraints for every session on this map. Read before choosing a question,
     obeyed while resolving it. Nothing here is re-asked. -->

- `AGENTS.md` exists and governs. Its conventions are not re-litigated by any question here.
- One question _file_ per session. `research` questions may run as parallel subagents.
- Grill probes are batched per the grilling playbook — at most three per turn, through the structured question tool unless the detail test forces prose Q blocks.
- Questions are put to the human in plain English. Technical terms only where the term is the decision.
- HITL questions are answered by the human in their own words. Never self-answered.
- No new runtime dependency is assumed without a `research` question backing it.
- Compliance language is reviewed by Dana before anything user-facing is finalised.
- Sketches are throwaway and live only under `pathfinder/sketch-NN/`.

## Glossary

<!-- Terms this effort uses precisely. Prevents two sessions meaning different things by
     the same word — the cheapest correctness win on the whole map. -->

| Term | Meaning here | Avoid |
|---|---|---|
| Audit event | One row in `audit_events`: actor, tenant, action, target, timestamp, payload | log line, activity record |
| Compliance officer | Tenant-scoped role that reviews activity; not a platform admin | admin, auditor |
| Export | One operator-initiated request producing one artifact for one filtered range | download, dump, extract |
| Retention window | How far back `audit_events` is queryable; owned outside engineering | archive period |
| Signed artifact | The generated file plus a checksum a recipient can verify independently | signed file, bundle |

## Question Checklist

<!-- Rebuilt from questions/ every session — the files are ground truth, this is an index.
     [ ] open (the frontier) · [/] claimed · [x] resolved · [!] open but blocked
     [-] out of scope. Resolved rows carry the one-line gist from the question's Answer. -->

- [x] [Codebase context](./questions/00-codebase-context.md) — Node/Express/Knex/React with a BullMQ-to-S3 export precedent; `audit_events` is 180M rows partitioned monthly, no `actor_id` index, `requireAdmin` has no tenant scoping.
- [x] [Export format](./questions/01-export-format.md) — CSV with a UTF-8 BOM and RFC 4180 quoting, plus a sidecar SHA-256 manifest; JSONL rejected because recipients open these in Excel.
- [/] [Row-count ceiling](./questions/02-row-count-ceiling.md)
- [ ] [Export authorization](./questions/03-export-authorization.md)
- [ ] [Testing posture](./questions/04-testing-posture.md)
- [!] [Delivery channel](./questions/05-delivery-channel.md) — Blocked by 02
- [-] [SIEM push connector](./questions/06-siem-push-connector.md) — out of scope, see below

## Not yet specified

<!-- The fog: in-scope areas you can see but cannot yet phrase as a question. Graduates into
     question files as answers land, and the graduated bullet is deleted from here.
     Do NOT pre-slice these into question-sized pieces — one bullet may become three
     questions, or none. Nothing already decided, already a question, or out of scope. -->

- How far back an export may reach. There is a retention answer somewhere outside engineering
  and nobody has it yet; until then we cannot say whether the question is about a hard limit,
  a warning, or a per-tenant setting.
- Redaction of event payloads. Legal may say "export raw", in which case this evaporates —
  or it may become several decisions about which fields, who configures them, and whether the
  rule follows the actor or the subject. Revisit after Export authorization.
- What happens when an export range straddles a monthly partition that was migrated mid-range.
  Cannot phrase this sharply until Export format is applied to a real query plan.
- Whether the export feature audits itself, and if so at what granularity. Suspect this is one
  small question but it may turn on the authorization model.

## Out of scope

<!-- Work consciously ruled past the destination. Never graduates; returns only if the
     destination is redrawn, and then as a fresh effort. One line each: gist plus why. -->

- [SIEM push connector](./questions/06-siem-push-connector.md) — scheduled push to Splunk or
  similar. The destination ends at an operator-initiated export; anything continuous is a
  different effort with a different owner.
- Redesign of the `audit_events` schema. The write path is untouched by this destination;
  changing it would pull in all 31 call sites of `auditEvents.record()`.
- Adding the missing `actor_id` index. Real, and it will hurt, but it is a database change
  with its own review path. Recorded here so the plan can reference it as a dependency
  rather than absorb it.
```

---

## The question-file template

Five contiguous `Key: value` lines after the H1. Not YAML. No frontmatter delimiters. No `- [ ]` checkboxes anywhere inside a question file — use plain bullets, including for legwork checklists.

`## Question` is written at charting. `## Answer` is appended only when the question resolves. `## Evidence` holds sources, links, and artifacts, and a `research` subagent writes into it during Chart Step 8 without deciding anything.

### An open question

```markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Export authorization

Type: grill · HITL
State: open
Blocked by: none
Claimed: none
Locked: yes

## Question

Who may run an audit-log export, and over whose events?

Three sub-decisions, all of which must land together because any two of them constrain the third:

- Which role gates the export action — the existing `admin` role, a new `compliance` role, or
  a per-tenant grant?
- May an exporter include events where they are the actor, or must self-events be excluded to
  keep the export usable as evidence?
- `requireAdmin` currently does not scope by tenant, so a platform admin sees every tenant's
  events. Does the export inherit that, or does it enforce a tenant scope the rest of the
  admin surface does not?

Recommended answer to react to: a new tenant-scoped `compliance` role; self-events included
but flagged in a column; the export enforces tenant scope even though the surrounding admin
surface does not.

Marked `Locked: yes` — the third sub-decision creates a precedent that later admin features
will follow, and reversing it later means re-auditing every export already delivered.

## Evidence

- `src/api/middleware/auth.ts` — `requireAdmin` checks session and role, no tenant predicate.
- Codebase context records the same gap under technical debt.
```

### A resolved question

```markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Export format

Type: grill · HITL
State: resolved
Blocked by: none
Claimed: 2026-08-03 10:41
Locked: yes

## Question

What file format does an export produce, and what does a recipient need in order to trust the
file has not been altered?

## Answer

**Decision.** CSV, UTF-8 with a byte-order mark, RFC 4180 quoting, one header row, timestamps
in ISO 8601 UTC. Alongside it a sidecar `.sha256` manifest listing the artifact filename and
its digest.

**Rejected.**

- *JSONL* — better for nested payloads and trivially streamable, but every named recipient
  opens these in Excel and would need a conversion step during an audit. The people who
  prefer JSONL are not the people receiving the file.
- *XLSX* — solves the Excel encoding problems outright, but adds a generation library and
  makes byte-level verification of the artifact meaningfully harder.
- *Detached signature instead of a checksum* — real integrity guarantees, but requires key
  management nobody has scoped, and no recipient has asked to verify a signature.

**Consequences.**

- Nested `payload` is flattened to one JSON string column. Anyone needing structure parses
  that column.
- The BOM is required or Excel mangles non-ASCII actor names. This must be an explicit test.
- Do not reuse the billing export's CSV writer — it concatenates strings with no escaping.
  A quoting-correct writer is now in scope for the plan.
- The checksum makes the artifact self-verifying, which lets Delivery channel consider a
  short-lived link without weakening the integrity story.

**Gist:** CSV with a UTF-8 BOM and RFC 4180 quoting, plus a sidecar SHA-256 manifest; JSONL
rejected because recipients open these in Excel.

## Evidence

- RFC 4180, sections 2.5-2.7 (quoting and embedded delimiters).
- `src/jobs/billingExport.ts` — the hand-rolled writer that must not be copied.
- Dana confirmed on 2026-08-03 that external auditors accept a published checksum.
```

---

## Step 4: The no-fog off-ramp

If the breadth-first grill surfaces **no fog** — every area you opened produced either a settled answer or a question you could phrase immediately, and `## Not yet specified` would be empty — then the way to the destination is already visible. The journey is small enough to plan directly and a map would be pure overhead.

Do this, in order:

1. **Keep `questions/00-codebase-context.md`.** This is the important part. It is exactly what `/plan2code-1-plan` Phase 2 (System Context Examination) has to produce anyway, and you have already produced it. Throwing the recon away to "clean up" wastes the most valuable artifact of the session.
2. **Do not create `map.md`.** The off-ramp fires at Step 4 and the map is not written until Step 5, so in the normal flow there is nothing to delete — just stop before writing it. (If you reached Step 4 with a `map.md` already on disk, delete it: a map with empty fog and no open questions will confuse the next session into resuming something that does not exist.)
3. **Tell the user plainly what happened and what to do:**

   > "No fog surfaced — the way to the destination is already visible, so this does not need a map. I kept the codebase recon at `specs/audit-log-export/pathfinder/questions/00-codebase-context.md`; attach that file to a `/plan2code-1-plan` session and it covers Phase 2 outright."

4. **Stop.** Do not chart anyway "just in case", do not create questions, do not start planning in this session.

Be honest about the trigger. If two areas are genuinely unformed, that is fog and the map earns its keep. The off-ramp is for the case where you fanned out across every axis and kept landing on solid ground.

---

## Step 6: The mandatory testing-posture question

**Every map includes a `grill · HITL` question on testing posture.** No exceptions, including maps where testing feels obvious.

The reason is mechanical: `/plan2code-1-plan` Phase 1 asks for three things — testing types, whether tests run after each implementation phase, and a coverage target — and `/plan2code-2-document` **string-matches** that answer, either appending a testing block to every phase, creating a dedicated final testing phase, or omitting testing entirely. A map that clears without this answer hands the human a planning session that stalls on its first question. Ask it while there is still someone in the room.

Record the answer in the literals downstream matches on, not in paraphrase. ("Phase" here names `/plan2code-1-plan`'s implementation phases and is a downstream contract string — it is never a pathfinder unit of work.)

It is almost never blocked. Give it whatever number the dependency ordering leaves free, and expect it to sit on the frontier from day one.

```markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Testing posture

Type: grill · HITL
State: open
Blocked by: none
Claimed: none
Locked: no

## Question

What testing does this work carry, so `/plan2code-1-plan` Phase 1 can be answered without
stalling? Three parts, all needed:

- **Types** — unit, integration, end-to-end, some combination, or none.
- **Phase testing** — record one of the two literals `/plan2code-2-document` matches:
  `Run after each phase` (a testing block closes every implementation phase) or
  `Dedicated phase only` (one final testing phase).
- **Coverage target** — record one of Phase 1's three literals: `Critical paths`,
  `Moderate (~60-80%)`, or `Comprehensive (>80%)`.

Recommended answer to react to: unit plus integration; `Run after each phase`;
`Critical paths`. Rationale — this touches compliance data, so the correctness of the
CSV writer and the authorization predicate must be pinned by tests, but the admin UI is thin
enough that end-to-end coverage would cost more than it catches.

Two specific cases worth naming in the answer regardless of the general posture, because
Codebase context shows both are easy to get wrong here:

- The UTF-8 BOM survives Excel round-tripping for non-ASCII actor names.
- The tenant-scope predicate actually excludes other tenants' events, asserted against seeded
  cross-tenant data rather than a mock.

Note for whoever resolves this: the coverage target is a number the human owns. Do not infer
it from the codebase's current coverage, and do not soften it to whatever the repo already
achieves.

## Evidence

- `AGENTS.md` records Vitest as the runner with fixtures colocated under `test/`.
- Codebase context: no end-to-end harness exists today; adding one is a real cost, not a flag.
```