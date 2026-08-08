# Grilling Playbook
> Part of plan2code-0-pathfinder — loaded once per session, used by Chart and Work alike.

Grilling is how a `grill · HITL` question resolves, how Chart Step 2 names the destination, and how Chart Step 4 maps the frontier. It is also the fallback for any question whose type gives you no better route. The output of a grill is a decision in the human's own words — never a decision you made on their behalf.

**Probe ≠ question file.** A *probe* is one turn of the interrogation; a *question file* is one `questions/NN-<slug>.md` on the map. Batching applies to probes only. **One question file per session still holds** — resolving three question files in one sitting is not what this is.

## The interview protocol

**Grilling is batched.** Put up to **three independent probes** to the human per turn, then wait. Never more than three, and never two probes where one's wording depends on the other's answer.

The old rule here was one probe per turn. It was safe and it was unusably slow: a charted map carries a dozen open questions, and a decision that costs one round trip per probe is a decision the human abandons half-finished. Batching is the default now; the discipline moved from *ask one* to *prove they are independent, then send three*.

| Rule | Why |
|---|---|
| Up to 3 probes per turn, never more | Past three the human skims, and a skimmed answer is worse than none. Three is a ceiling, not a quota — send two if only two are independent. |
| Only batch mutually independent probes | The independence test below. A probe whose wording or recommendation shifts based on another probe's answer waits for the next turn. |
| Reach for the structured question tool first | It is the intended channel, not the leftover bin. Shape the batch so it fits — three probes, plain headers, options a description can carry — and fall back to prose only when the detail test genuinely trips. |
| A probe that needs detail goes in prose, never in options | The detail test below. Batching buys round trips; it must never buy them by shrinking a decision to fit a picker. |
| Wait for the whole batch before sending the next | Their answers reshape what comes next. Pre-writing turn 2 wastes it. |
| Recommend an answer with every probe | A bare question makes the human do all the work. A recommendation gives them something to push against, which is faster and sharper. |
| Write it in plain English; keep the technical word only where that word IS the decision | A probe the human has to decode is a probe they answer approximately. See *Say it in plain English*. |
| Track the batch; re-ask what came back unanswered | This is what buys the batch. Dropped probes going unnoticed was the entire case for asking one at a time. |
| Walk one branch of the decision tree at a time | Batch across the branch's width, never down its depth. Do not ask about export scheduling before you know whether exports exist. |
| Do not act until they confirm shared understanding | Recap, get the confirmation, then write. No `## Answer` before the confirmation. |
| Never write implementation code during a grill | Grilling produces decisions. If you feel the pull to build, you have reached the edge of the map — say so and hand off. |

Shape of a single probe, batched or not:

```
Question   — one decision, stated so it can be answered in a sentence.
Why it     — one line: what it blocks, what breaks if it goes the other way.
matters
Recommend  — your pick, with the reason. One line.
Options    — the genuine alternatives, if there are more than two.
```

Worked probe, from a grill on `[Export format](./questions/04-export-format.md)`:

> **Q:** When a custodian exports a conversation that includes a 40 MB video attachment, does the export bundle the file or link to it?
> **Why it matters:** Bundling sets the size ceiling on an export job and decides whether exports can stream; linking makes the export useless once retention expires the blob.
> **Recommendation:** Bundle, with a per-job size cap of 2 GB and an automatic split into part files above that — reviewers open exports offline in tools that cannot follow links.
> **Alternatives:** Link-only (smaller, breaks offline); hybrid by MIME type (two code paths, two failure modes).

Batching does not shrink a probe. Three probes means three of these, each with its own why-it-matters and its own recommendation. Three bare questions in a list is not a batch, it is a form to fill in.

### Say it in plain English

Every probe gets read once, by a busy human, in a terminal. Write it the way you would say it out loud to a colleague who knows the product but has never read this skill. Plain is not vague — the two failures are opposite and both cost you the decision: woolly wording gets a woolly answer, dense wording gets a guessed one.

**Default to everyday words.** Short sentences, concrete nouns. "What should happen when the export is too big to email?" beats "what are the failure semantics of the artifact delivery path under a size-limit violation?" Same decision, one of them answerable on the first read.

**Keep the technical term where that term IS the decision.** A format name, a real file path, a column name, a version number, a limit, a `## Glossary` term the map already settled — those are load-bearing, and softening them makes the probe unanswerable. `.eml`-in-a-ZIP versus NDJSON *is* the choice; "normal email files versus one big machine-readable stream" is the gloss you put beside it, never the replacement for it.

> The test: would swapping the term for a plain phrase lose information the human needs in order to choose? Lose information — keep the term and gloss it. Lose nothing — cut it.

**Gloss an unavoidable term once, inline, then use it freely:** "…stored under Object Lock (S3's write-once mode — once it is set, even we cannot delete early)." Once per session, not once per probe. Re-explaining a term to the person who owns the system is its own insult.

**Never put Pathfinder's machinery in front of the human.** They are deciding something about their product; the vocabulary below is internal bookkeeping and buys them nothing:

| Do not say | Say |
|---|---|
| "this is a `grill · HITL`" | "this one is yours to call" |
| "the frontier holds two takeable questions" | "two things we can decide right now" |
| "graduating this out of the fog" | "this is sharp enough to write down as a real question now" |
| "the sacrificial boundary" | "name one thing people would assume is included that you are willing to cut" |
| "shall I set `Locked: yes`?" | "worth recording why we picked this, so nobody re-opens it in six months?" |
| "Q3 is blocked by 02" | "the export format question has to land before this one" |
| "this batch trips the detail test" | nothing — that call is yours, not theirs |

**Refer to questions by name, never by number** — "[Export format](./questions/04-export-format.md)", not "04". The number means something to the file system and to nobody else.

**No metaphor where a fact fits.** Maps, fog, and trails belong in the footer and the mascot. Inside a probe they cost a translation step: "three things here are still undecided" beats "the fog is thick in this quarter of the map."

The same discipline covers everything else the human reads — the recap turn in *Landing the grill*, the option labels and descriptions in the structured tool, the sketch probes, and the HITL checklists in the resolution playbook. Plain in the question, precise in the term that carries the decision.

### The independence test

A probe may join the current batch only if **all three** hold:

| Test | Fails when |
|---|---|
| Its wording would not change under any answer to another probe in the batch | "How do we name the part files?" reads differently if the format turns out to be a single stream |
| Its recommendation would not change either | You would recommend a 2 GB cap under ZIP parts and no cap under NDJSON |
| It does not presuppose another probe's answer | "How often do scheduled exports run?" assumes scheduled exports exist |

In doubt, hold it back. A held probe costs one extra round trip. A dependent probe sent early costs a wrong answer recorded as a decision, and you will not find out until the plan contradicts itself.

Independent probes are usually the ones that came from **different areas** — data, interface, security, operations, testing. Dependent probes are usually consecutive steps down one thread.

### Delivering a batch: choosing the channel

Two channels — the environment's structured question tool, or numbered Q blocks in prose. **Choose before you write a word, and choose per batch, not per probe.** One channel per turn: a batch split across a tool popup and a loose prose question loses the prose half every time, because the human answers in the tool and never scrolls back.

**The tool is where you start.** Assemble the batch for it — three probes, a plain two-or-three-word header each, alternatives a sentence or two of description can carry — and only then run the detail test to see whether anything forces you out. Prose is the exception you fall back to, not the safe default you retreat to. Two things make the tool worth the effort: a skipped probe comes back *visibly* skipped, and a picker is answerable in one pass by a human who has thirty seconds. Neither survives the move to prose.

The two failure directions are opposite and both real. Retreating to prose out of caution costs you the visible skip and the fast reply. Forcing a genuinely gnarly decision into a picker costs you the reasoning, which is worse. The detail test below is where that line sits — run it honestly in both directions.

**Whichever channel you pick, the turn closes with the waiting footer.** A turn that sends a batch is a **Form B turn** in `trail.md`: the Trail Footer under it names the outstanding probes after `WAITING ON YOU` and carries **no** resume command. Emitting "start a NEW conversation" above an unanswered batch tells the human to leave the session you are sitting in — they walk, and the batch you built to save round trips costs you the whole decision instead. Same for the recap turn below, which is also waiting on them.

#### The detail test — the only things that force you out of the tool

Numbered Q blocks are **required, not merely permitted**, if *any* probe in the batch trips *any* row below. One tripping probe downgrades the whole batch.

These four rows are the whole list. Nothing else forces prose — not a long question, not a hard decision, not a `Locked: yes`, not your discomfort with the widget.

| Trip | Looks like | Not this |
|---|---|---|
| The answer must be composed, not picked | "Name one thing a reasonable person would assume is in scope that you are willing to cut." There is no option set, because inventing one puts words in their mouth. | A decision with genuine named alternatives, however weighty. Write the options. |
| The probe needs an artifact inline to be answerable | A state table, a fake request/response pair, an ASCII UI, a worked example with real numbers — effectively every `sketch` probe | A probe that merely *mentions* a file path, a format, or a number. Those go in the question text. |
| An option cannot be conveyed even in its description | Each alternative needs a worked paragraph before it means anything — a migration path, a failure sequence, a schema | An alternative that needs one or two sentences of trade-off. That is what the description field is for. |
| The alternatives themselves are unknown to you | You cannot name the losing options at all, because the frame is theirs — a contract, an old incident, an org politics fact | You can name them but cannot say why each loses. Name them, recommend one, and let the recap turn supply the reasoning. |

Three things that look like trips and are not:

- **One label bundling several decisions** — "authentic counts, one-use per attempt, restored on death" is three answers wearing one coat. The fix is to **split it into separate probes**, not to write prose. Three separated probes is exactly one batch.
- **Two probes colliding on the tool's short header limit** (16 characters in Claude Code) — `Export scope` twice is unanswerable, but the fix is to rename them (`Date range`, `Who can run`) or to hold one for the next turn. Reword before you retreat.
- **A hybrid is possible** — the free-text escape hatch takes "the header from B with the list from C" fine. Trip only when you can already predict the answer *will* be a composition, which is the first row.

**`Locked: yes` on its own does not trip the test.** A lock's `## Answer` owes every alternative and the reason each lost — but if *you* can already name the alternatives, you have written the options, and the recap turn turns the pick into words the human said. A lock trips only on the fourth row, where you cannot name them at all. Treating every lock as an automatic downgrade sends almost every MODE B decision worth grilling to prose, which defeats the point — MODE B is exactly where a claimed question already has named alternatives and the tool earns its keep.

**Nothing tripped? Use the structured tool.** Not "may" — do. It is the intended channel, and it is where the visible-skip guarantee behind the partial-answer discipline below comes from.

**Never reshape a probe to fit the tool.** Reaching for the tool first is not licence to shrink a decision into it. The failure mode is not that the tool rejects a gnarly probe — it is that it *accepts* one. You compress a decision with real texture into three tidy options, the human clicks the least-bad one, and you have recorded a decision with no reasoning behind it. That answer cannot satisfy `## Answer`'s obligation to name what was rejected and why, and nobody finds out until handoff, when the PLAN-DRAFT's Architecture section turns out to have nothing to say. Splitting a bundled probe or renaming a colliding header is reshaping the *batch* and is always right. Cutting a real alternative, or thinning a description until the trade-off disappears, is reshaping the *decision* and is always wrong. When the honest choice is between paragraphs and dishonest options, write the paragraphs.

#### The structured tool

The default channel, and the one you build the batch for. One question object per probe, up to three in a single call:

- **Header** — the decision in two or three plain words (`Export format`, `Size cap`). Not a type, not a marker, not a number.
- **Question** — the probe, with its why-it-matters. This is prose and it is not rationed; the same sentences you would have written in a Q block go here.
- **Options** — the genuine alternatives, each described by its trade-off, with the recommended one named as such in its description. Two to four; the free-text escape hatch covers the rest. Label plainly, then let the description carry the precise term: `One file per message` labelling the `.eml`-in-a-ZIP option, with `.eml` named in the description.

A short *label* is not a short *decision*. The label is a handle — `Fixed tick count` — and the description carries the trade-off that makes it choosable. A probe only trips the third detail-test row when even that description cannot hold the option. A label bundling several independent answers is not that row — it is a probe that wants splitting.

**A click is a decision, not a sentence.** The HITL rule wants an `## Answer` traceable to something the human actually said, and a selected option label is thin evidence on its own. What makes tool-delivered answers legitimate is the recap turn in *Landing the grill* — you play the choices back in prose and they confirm or correct in their own words. Never skip the recap on the grounds that the tool already captured the answer; the tool captured the *pick*, and the recap captures the *agreement*.

**If a reply comes back thinner than the decision** — a bare click on something you now realise carries weight — do not paper over it. Fold the why into the recap turn as one more probe before writing the `## Answer`.

#### Numbered Q blocks

The mandatory channel for anything the detail test catches, and the fallback anywhere the structured tool does not exist. Give each probe the room the tool would have denied it.

**Copy this shape exactly.** The blank lines are load-bearing, not decoration:

````markdown
Three independent decisions are open. Answer in any order, skip any you want to punt — "Q2: b, Q3: the hybrid" is a perfectly good reply.

---

**Q1 — Export format**

When a custodian exports a year of a channel, what do they get back?

*Why it matters:* fixes the size ceiling, decides whether exports can stream, and determines whether the review vendors can ingest without a conversion step.

*Recommendation:* **(a)** — both vendors named in Codebase context read `.eml` natively.

- **a)** ZIP of one `.eml` per message, plus `manifest.csv`
- **b)** A single NDJSON stream — compact and streamable, but nobody downstream parses it
- **c)** PST — what Legal asked for by name, but single-writer with a ~50 GB ceiling

---

**Q2 — What's not included**

Name one thing a reasonable person would assume is part of this that you are willing to say is NOT part of it.

*Why it matters:* this becomes the first thing written down as out of scope, and every later "is that in or out?" call is measured against it. A destination nobody has excluded anything from has not been thought about.

*Recommendation:* none — this one is yours. If nothing comes to mind, I will offer two candidates and you reject one.

*(free text — no options on this one)*
````

Number them, keep the numbers stable across turns and sessions, and say out loud that partial answers are welcome — the invitation is what makes the skip visible instead of silent.

#### Formatting rules for a Q block

A batch is only worth sending if the human can read it. These are mechanical, and getting them wrong turns three careful probes into one unreadable paragraph:

| Rule | Why |
|---|---|
| **A blank line between every element** — the `**Qn — Name**` line, the question, *Why it matters*, *Recommendation*, and the option list | Markdown joins consecutive non-blank lines into a single paragraph. Without blank lines the entire batch renders as a wall of text and the human skims it, which is the failure the three-probe cap exists to prevent. |
| **Never hard-wrap a sentence across source lines** | The wrap is invisible to the renderer, so it buys nothing and costs you the paragraph break. Write each sentence as one logical line however long it is; the terminal wraps it. |
| **Options are a bullet list, one option per bullet** — `- **a)** …` | Indented continuation lines are the specific thing that collapses: under four spaces the indent is stripped, at four or more it becomes a code block. A bullet list survives every renderer and keeps the options scannable. |
| **`---` between probes** | Three probes run together is one block of text. The rule gives the eye a stop and makes "answer Q2 and Q3" easy to aim at. |
| **The question itself gets its own line, not a run-on with the heading** | `**Q1 — Export format.** When a custodian…` buries the decision inside a paragraph. Name it, break, then ask it. |
| **Never use spaces to convey structure** | Whatever hierarchy you indent by hand disappears on render. Structure comes from blank lines, bullets, and bold — nothing else. |

The same applies to the recap turn in *Landing the grill*: it is prose the human has to check line by line, so give each recapped decision its own bullet.

### When answers come back partial

Assume they will. The human answers two and drops one, and the dropped one is often the hardest and most valuable.

1. **Diff what came back against what you sent.** Skipped, answered with "Other: skip", or silently omitted all count as unanswered.
2. **Lead the next turn with the unanswered probes**, at their original numbers, restated in full. Not "you missed Q3" — the whole probe again, with its recommendation, because they have lost the context by now. Unanswered probes come *before* any new probe, and they count against the cap of three.
3. **Skipped twice, stop pushing.** Record it under `## Evidence` as an open probe with your recommendation verbatim, then either narrow it into something answerable or spin it out — a fresh question file if you can phrase it sharply, a `## Not yet specified` line if you cannot.
4. **Never promote your own recommendation into `## Answer`.** A probe the human declined twice is unanswered, not decided. Writing it up as decided is self-answering a HITL question, which breaks the skill.

Never let a dropped probe fall off the end of the session unrecorded.

## Facts you look up, decisions you ask

This is the single rule that keeps a grill from feeling like an interrogation. If a **fact** can be found by exploring the environment — filesystem, codebase, tools, docs, config, git history, the map's own resolved questions — go find it. The **decisions** are the human's; put each one to them and wait.

| You look it up | You ask |
|---|---|
| Which Postgres version the app runs against | Whether the export index is allowed to add a new table |
| Whether `ExportJob` already has a `status` column | What states that column is allowed to hold |
| How the current retention sweep is scheduled | Whether exports must survive a retention sweep |
| Whether the repo uses Vitest or Jest | Whether these paths get unit tests, integration tests, or neither |
| What the S3 bucket lifecycle rule is today | Whether we are allowed to change it |
| What `AGENTS.md` says about naming conventions | Anything `AGENTS.md` does not already answer |

Look first, then ask. A question that opens with "I checked `src/export/job.ts` — it already has a `status` enum with `queued | running | failed`. Does a partial success need a fourth state?" is worth three of "how should export status work?"

**Never ask what `AGENTS.md`, the map's `## Ground rules`, or a resolved question already answers.** Re-asking a settled decision reopens it by accident and costs you the human's trust for the rest of the session.

**When the lookup is expensive**, that is not a grill — it is a `research · AFK` or `legwork` question. Say so, note it, and keep grilling the decisions you can still put to the human.

## The HITL rule, stated hard

An agent that answers its own grill has broken the skill.

A `grill · HITL` question resolves **only** through live exchange with the human. Not from the codebase, not from a plausible default, not from "the obvious industry standard," not from what you would have picked. The whole value of the question is that a human with context you do not have chose one branch over another.

Signs you are about to break it:

- You wrote a recommendation and then wrote the `## Answer` without a reply in between.
- You wrote "assuming the user would want X" anywhere.
- You resolved a question in a session where the human said nothing but "go".
- The `## Answer` contains no sentence traceable to something the human actually said.

**When the human goes unreachable mid-grill:**

1. The claim **stays**. `State: claimed` and `Claimed:` are left exactly as they are.
2. Append to `## Evidence` — never `## Answer` — the exchange so far: the probes already answered, **every probe of the last batch still outstanding**, and your recommendation for each, verbatim.
3. End the session. Report the question by name and say it is mid-grill and waiting on the human. This one IS a session end, so the Trail Footer takes **Form A** — the pathed resume command, not `WAITING ON YOU`.
4. Invent nothing. No provisional answer, no "pending confirmation" answer, no default recorded as a decision.

The next session picks the claim back up and re-sends the outstanding batch. If the session was truly abandoned rather than paused, Work Step 2 reconciliation resets it to `open` on its own — that is its job, not yours.

## The four disciplines

Run all four continuously during any grill. They are not stages; they fire whenever the trigger appears in what the human just said.

### Challenge against the glossary

When a term conflicts with the map's `## Glossary`, call it out immediately, mid-sentence if necessary.

> "The glossary defines **Export** as a completed archive file delivered to a custodian. You just used it for the background job that builds one. Which do you mean — or do we need a second term?"

### Sharpen fuzzy or overloaded language

When a term is vague or carries two meanings, propose a precise canonical term and get a ruling.

> "You keep saying 'account.' Sometimes you mean the organization paying us, sometimes the individual login. Those are a **Customer** and a **User** and they have different retention rules. Which one owns the export quota?"

### Stress-test relationships with concrete invented scenarios

Do not ask abstractly whether a relationship holds. Invent a specific scenario that probes the edge and force a precise boundary.

> "A custodian leaves the company on the 3rd. Their retention policy expires their messages on the 5th. Legal opens a hold on the 4th. On the 6th, does the export still contain those messages?"

Invent the numbers, names, and dates. Vague scenarios get vague answers.

### Cross-reference claims against the actual code

When the human states how something works, check whether the code agrees, and surface contradictions instead of quietly picking a side.

> "You said retention deletes rows. `RetentionSweep.run()` sets `deleted_at` and leaves the row in place — a soft delete. Which is the behavior we are designing against?"

A contradiction is a finding, not an embarrassment. Surface it in the same turn you found it.

## The glossary

Domain modeling would write a `CONTEXT.md`. Pathfinder does **not** — plan2code owns `AGENTS.md`, and a competing root glossary file would collide with it. The map's `## Glossary` section is the one place resolved terms live.

Entry format — one row in the map's `## Glossary` table: the term, a one-or-two-sentence definition, and the rejected synonyms in the Avoid column:

```
| Term | Meaning here | Avoid |
|---|---|---|
| Export | A completed, immutable archive file delivered to a custodian. Always the artifact, never the process that produces it. | download, extract, dump |
| Export Job | The background unit of work that produces an Export. Has states; an Export does not. | export run |
| Custodian | The person whose communications an Export contains. Not necessarily the person who requested it. | user, owner, subject |
```

Rules:

| Rule | Detail |
|---|---|
| Update inline, never defer | The moment a term is resolved, write it into `## Glossary` and save. A term you meant to add at the end of the session is a term you lost. |
| Be opinionated | When several words compete, pick one and put the rest in the Avoid column. A glossary that lists synonyms as equals has decided nothing. |
| Keep definitions tight | One or two sentences. Define what it **is**, not what it does. |
| Only project-specific terms | "Retention Policy" belongs. "Timeout", "retry", "DTO" do not, however heavily the project uses them. |
| It is a glossary and nothing else | No implementation details, no open questions, no scratch notes, no decisions. Decisions live in question files. |
| Group under sub-bullets only when clusters emerge | A flat list is fine for one cohesive area. |

Every term you resolve is a term no later session re-litigates. That is the whole return on the discipline.

## The Lock test

Domain modeling would offer an ADR here. Pathfinder sets `Locked: yes` on the question instead — the decision record and the question are the same file.

Offer `Locked: yes` **only** when all three hold:

| Test | Meaning | Fails when |
|---|---|---|
| Hard to reverse | Changing your mind later costs real time or migration | You could flip it in an afternoon |
| Surprising without context | A future reader will ask "why did they do it this way?" | It is the obvious choice anyone would make |
| A real trade-off | There were genuine alternatives and one was picked for specific reasons | There was only ever one option |

If any one is missing, skip it. An easy-to-reverse decision will just get reversed. An unsurprising one raises no questions to answer. One with no alternative records nothing beyond "we did the obvious thing."

**What earns a lock:** architectural shape ("the export index is a materialized view, not a table"); integration patterns between components ("retention and export communicate by event, never by direct call"); technology choices carrying lock-in (database, message bus, auth provider — not every library, just the ones that would take a quarter to swap); boundary and scope decisions, including the explicit no-s; deliberate deviations from the obvious path ("hand-written SQL here, not the ORM, because the ORM cannot express the retention join"); constraints invisible in the code ("no cross-region replication — the data residency contract forbids it"); and non-obvious rejections ("we considered and rejected GraphQL, for reasons someone will otherwise re-propose in six months").

**What `Locked: yes` obliges the `## Answer` to contain:**

1. The decision itself, in one or two sentences.
2. **Every alternative genuinely considered, and why each was rejected.** This is the part that makes a lock worth having. "We rejected X" with no reason is not a lock.
3. The consequences a later reader would not guess.
4. The one-line `**Gist:**` that Work Step 7 requires, same as any answer.

Offer it, do not impose it: *"This one looks hard to reverse and the reasoning will not be obvious in six months. Lock it?"* The human decides.

**Where locks go at handoff:** the handoff playbook lifts every `Locked: yes` question into the PLAN-DRAFT's **Architecture** section, and their rejected alternatives and standing constraints into **Assumptions**. Unlocked answers still inform the draft, but locks are the ones that survive verbatim into planning. Grill them harder for that reason.

## The one grill every map must resolve, and the lens applied to all of them

### 1. Testing posture — `grill · HITL`

Chart Step 6 requires this question. It exists because `/plan2code-1-plan` Phase 1 asks for exactly three things and stalls without them: testing types, whether tests run after each phase, and the coverage target. A map that clears without answering them hands the human a plan session that immediately re-asks.

The first three probes below pass the independence test against each other — none reads differently under another's answer — so **send all three as one batch**. This is the canonical worked example of a full batch, and it is the canonical case for the structured tool: every one of the three has named alternatives you can already write, the answers are fixed literals rather than prose, and nothing in the batch trips the detail test.

| Probe | Recommend by default |
|---|---|
| Which types are in scope — unit, integration, E2E, or none? | Unit plus integration; E2E only where a real browser or real broker is the only honest test |
| Does the suite run after each implementation phase, or once at the end? | `Run after each phase` — work that cannot be verified when it lands cannot be signed off |
| Coverage target: critical paths, moderate (~60-80%), or comprehensive (>80%)? | Critical paths, named explicitly, rather than a percentage nobody defends |
| What is deliberately not tested, and why? | **Fourth probe, and it does not ride in the batch.** It has no option set — the explicit no-s have to be composed — and it reads differently once the types are settled. Fold it into the recap turn, where you are already waiting on them. |
| What is already there — runner, fixtures, CI wiring? | **Not a probe.** Look it up before you send the batch, and cite it in the probes above |

Record the answer in the exact literals `/plan2code-2-document` string-matches: the types; `Run after each phase` or `Dedicated phase only`; and `Critical paths`, `Moderate (~60-80%)`, or `Comprehensive (>80%)`. Not prose — a paraphrase matches no branch downstream.

### 2. Test seams and verifiability — a lens, not a question file

For each major decision on the map, ask the same question: **how will anyone know it works?** A decision nobody can verify is a decision that silently rots.

This is not a question of its own and never gets a file or an `NN`. Run it inside whatever grill is claimed; anything it surfaces that needs deciding separately becomes a new question at Work Step 8.

These six all interrogate one decision from different sides, so they batch cleanly — but they ride along inside the claimed grill rather than owning a turn. Fold the two or three that bite into the batch you were already sending; never spend a whole turn on all six.

| Probe | What it flushes out |
|---|---|
| What observable behavior changes if this decision is implemented correctly? | Decisions with no observable effect — usually a sign the question was about implementation, not design |
| What is the cheapest thing that fails when it breaks? | The seam. If the answer is "a customer complains," there is no seam yet |
| Can this be tested without a live third-party account, a real S3 bucket, a wall-clock sleep? | Untestable-by-construction designs, while they are still cheap to change |
| Where does the boundary go so a test can stand at it — an interface, a queue, an HTTP edge, a pure function? | The seam the plan will need to name |
| What does the failure look like in production — log line, metric, alert, dead-letter queue? | Verifiability after ship, not just in CI |
| If we get this wrong, how long before we find out? | Decisions that need a canary or a feature flag rather than a test |

If a decision survives all six with no answer, it is not ready to leave the map. Either re-frame the question, or add the seam as a constraint in the `## Answer` so the plan inherits it.

## Anti-patterns

| Failure mode | What it looks like | Fix |
|---|---|---|
| Batching **dependent** probes | "What format, what do we name the part files, and how big is a part?" | Only the first is independent. Send it; hold the other two — they are unanswerable until format lands. |
| Drip-feeding one probe at a time | Twelve open questions on the map, one probe per response, the human gives up on session four | Batch up to three independent probes. On a charted map the human's round trips are the scarce resource, not your token budget. |
| Losing a probe the human skipped | Sent three, got two back, moved on and never mentioned the third | Diff the batch. Lead the next turn with what came back empty, restated in full. |
| A batch of naked questions | Three one-liners with no recommendations and no why-it-matters | Every probe in a batch carries its own recommendation and its own stake. Otherwise you have offloaded the thinking, not the round trips. |
| Sending a batch as a wall of text | Three probes hard-wrapped across source lines with their options indented, all collapsing into one paragraph on render | Blank line between every element, options as a bullet list, `---` between probes. The three-probe cap exists so the human reads all three; an unreadable batch gets skimmed, and a skimmed answer is worse than none. |
| Flattening a gnarly probe into a picker | An architectural decision reduced to three option labels because the batch was already going through the structured tool | Run the detail test. One tripping probe sends the whole batch to numbered Q blocks. A clicked option records no reasoning, and the `## Answer` needs reasoning. |
| Defaulting to prose when nothing tripped | A clean three-probe batch written as Q blocks "to be safe", or downgraded just because the question will be `Locked: yes` | The detail test is a test, not a preference, and it is four rows long. Nothing tripped means the tool: you gain visibly skipped probes, and the recap turn still captures the reasoning a lock needs. |
| Retreating to prose over a fixable batch | Two probes collided on the 16-character header, or one option label was bundling three answers, so the whole batch went to Q blocks | Neither is a detail-test trip. Rename the headers; split the bundled probe. Reshape the batch, never the decision. |
| Sending four probes because the tool accepts four | A fourth probe added to a clean batch of three because there was room in the call | The cap is three regardless of what the environment allows. The ceiling is the human's attention, not the tool's schema. |
| Grilling in Pathfinder's own vocabulary | "The frontier has one takeable `grill · HITL` — shall we graduate 02 out of the fog and lock it?" | Plain English. Markers, types, `NN` numbers, and fog are your bookkeeping; the human is deciding about their product. |
| Plain-washing the load-bearing term | "Do you want the friendly file or the compact one?" where the real choice is `.eml`-in-a-ZIP versus NDJSON | Plain wording, precise nouns. Name the formats and gloss them; a decision made on a euphemism cannot be written into `## Answer`. |
| Asking what the codebase already answers | "Do you use Postgres or MySQL?" | Look. Every avoidable question spends trust you need for the hard ones. |
| Accepting a vague answer and moving on | "Handle it sensibly" → recorded as the decision | Push once more, concretely: "Sensibly meaning we drop the attachment, or fail the whole job?" A vague answer is not an answer. |
| Leading the human to your preferred answer | "You'd want Postgres here, right?" | Recommend openly, then present the real alternatives with their real merits. A recommendation invites a fight; a leading question suppresses one. |
| Grilling past the decision into implementation | "Should the retry helper take a callback or return a promise?" | That is the plan's job, or the implementer's. Stop at the decision. The pull to keep going is the edge of the map. |
| Drifting off the claimed question | Claimed `[Export format](./questions/04-export-format.md)`, forty minutes later deep in auth | Name the drift out loud, capture the new thread as a fresh question or as a line in `## Not yet specified`, and return. One question _file_ per session. |
| Self-answering a HITL question | An `## Answer` with no words the human said | Delete it. Reopen the question. See the HITL rule. |
| Recording the decision but not the rejections | "We chose event-driven." | Rejections are half the record — and mandatory when `Locked: yes`. Ask what else was on the table before you close. |
| Grilling a fact | "How long does the retention sweep take?" | If it is measurable, measure it — or make it a `research · AFK` question. Do not make the human guess at their own system. |
| Letting the glossary go stale | Three terms resolved, none written down | Write each one the moment it lands. Deferring loses them. |
| Closing without confirmation | Answer written straight after the last reply | Recap the whole chain of decisions, get the explicit confirm, then write. |

## Landing the grill

When the branch is walked out. **Steps 1-3 are ONE turn, not three** — recap, confirmation request, and lock offer go out together, because a lock offer sent after a separate confirmation costs a round trip to ask a yes/no the human could have answered alongside the recap.

1. Recap the decisions in order, in the human's own terms, using glossary vocabulary. Include anything a structured-tool reply left implicit, so the confirmation covers the reasoning and not just the picks.
2. Ask for the confirmation. Do not skip this — the recap is where the human catches the one thing you misheard, and where a clicked option becomes words they said.
3. Apply the Lock test in the same message. Offer, do not impose.
4. Write `## Answer` per Work Step 7: the decision, what was rejected and why, consequences, and a one-line `**Gist:**`. Evidence, links, and transcript fragments go under `## Evidence`.
5. Anything the grill surfaced that belongs to a different question goes to the map — a fresh question if you can phrase it sharply, `## Not yet specified` if you cannot, `## Out of scope` if it sits past the destination.