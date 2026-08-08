# Resolution Playbook

> Loaded at the top of MODE B. Work Step 6 routes here by `Type:`; Work Step 8 uses the fog procedure at the end.

Every question resolves into the SAME shape — a filled `## Answer` plus whatever `## Evidence` backs it. The type only decides how you get there.

| `Type:` | Who drives | Parallel? | What "resolved" means |
|---|---|---|---|
| `research · AFK` | Subagent, alone | **Yes** — many at once | Facts found and cited; no decision made |
| `sketch · HITL` | Agent builds, human reacts | No | The human reacted and chose |
| `legwork · AFK` | Agent, alone | No | The work is done; resulting facts recorded |
| `legwork · HITL` | Human does, agent waits | No | The human confirmed it is done |
| `grill · HITL` | Human decides, agent interrogates | No — but probes batch, up to 3 per turn | The human said it in their own words |

**One question _file_ per session** holds for every row except `research`. HITL rows are never self-answered — an agent that writes its own `## Answer` on a `grill` has broken the skill.

Every file you create along the way — question files, sketch READMEs — opens with the banner:

`> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.`

---

## `research · AFK`

The only type an agent resolves alone, and the only type that may run several at once. Charting fires them in a batch at Chart Step 8; MODE B fires any that appear later the same way.

### Spin up a subagent

One subagent per research question. Do not read the docs yourself in the main session — the point is that the main session's context stays clean for the decision work.

The subagent's brief must carry, verbatim:

1. The absolute path of the question file it owns.
2. The `## Question` text.
3. The instruction to write into `## Evidence` of THAT file and nothing else — `## Answer` and `State:` are written by the session that fired it, at Work Step 7.
4. The primary-source rule below.
5. The no-deciding rule below.

### Primary sources only

Investigate against **primary sources** — official documentation, the library's own source code, the RFC or spec text, the first-party API reference, the vendor's own pricing page, the actual response from a live endpoint. Never a secondary write-up of them. A blog post, a Stack Overflow answer, or a model's recollection is a *lead*, not a source: follow every claim back to the source that owns it, and cite that.

| Claim about | Source that owns it |
|---|---|
| A library's behavior | That library's source or its own docs for the installed version |
| An HTTP API's shape | The vendor's API reference, or a real captured request/response |
| A file format | The format specification |
| A limit or quota | The vendor's own limits page, dated |
| This project's behavior | The code in this repo, by path |

If no primary source can be found, say so explicitly in `## Evidence` and mark the claim UNVERIFIED. An honest gap is worth more than a confident secondhand sentence — the gap becomes a `legwork` question (go run it and see) or a `grill` (the human decides under uncertainty).

**Version-pin everything.** "Node supports it" is not a finding. "Node 20.11 supports it; the project's `.nvmrc` pins 18.19, which does not" is.

### It does not decide

A research question's `## Answer` states the FACTS FOUND and what they imply. It never picks. The moment the findings enable a choice, that choice becomes a **separate `grill`** question, written at Work Step 8.

This split is the whole reason research is safe to run AFK. An agent that reads three storage options and then declares a winner has quietly made an architectural decision the human never saw.

### The dropped git branch

Upstream captures each prototype and research run on a throwaway git branch. **Pathfinder deliberately drops that.** `specs/` is already untracked scratch space, and plan2code never touches git during pathfinder. The question file IS the durable capture. Do not create branches, do not commit, do not mention branches in the `## Answer`.

### Worked example

`questions/04-object-lock-retention.md` after Work Step 7 recorded its subagent findings:

```markdown
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

# Object Lock retention semantics for the archive bucket

Type: research · AFK
State: resolved
Blocked by: none
Claimed: 2026-08-03 14:02
Locked: no

## Question

If archived messages land in S3 under Object Lock, what retention modes exist,
which of them can be shortened or lifted after the fact, and what does each
require of the bucket at creation time? We need the facts before deciding
whether a 7-year hold can coexist with a customer's right-to-delete request.

## Answer

**Facts found**

1. Object Lock supports two retention modes: GOVERNANCE and COMPLIANCE.
2. Under GOVERNANCE, a principal holding `s3:BypassGovernanceRetention` can
   shorten or remove a retention period on an object version.
3. Under COMPLIANCE, no principal — including the account root — can shorten
   or remove it until the retain-until date passes.
4. Object Lock can only be enabled at bucket creation, and enabling it forces
   versioning on permanently.
5. A legal hold is independent of retention mode, has no expiry, and is
   toggled by any principal with `s3:PutObjectLegalHold`.

**What this implies**

- A right-to-delete request is satisfiable under GOVERNANCE and is NOT
  satisfiable under COMPLIANCE before the retain-until date. These two
  obligations cannot both be met on the same object version.
- Retrofitting Object Lock onto the existing `archive-prod` bucket is not
  possible; it would require a new bucket and a full copy.

**Decision this enables (not made here)**

Which mode the archive uses, and how right-to-delete is honored under it,
is now a sharp question — see Work Step 8, spun off as a grill.

**Gist:** COMPLIANCE mode is irreversible even for root; GOVERNANCE is
bypassable — and Object Lock cannot be added to the existing bucket.

## Evidence

- Two modes, and the governance-bypass permission —
  AWS S3 User Guide, "Object Lock overview", section "Retention modes".
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-overview.html
  (retrieved 2026-08-03)
- COMPLIANCE cannot be shortened by any user including the root user —
  same page, "Compliance mode" paragraph, verbatim: "no user can overwrite or
  delete the object version during the retention period."
- Enable-at-creation-only, and forced versioning —
  AWS S3 User Guide, "Enabling Object Lock", first note block.
  https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock-configure.html
- Legal hold independence and no expiry —
  same guide, "Legal holds" section.
- Existing bucket has Object Lock disabled — verified against this account:
  `aws s3api get-object-lock-configuration --bucket archive-prod`
  returns `ObjectLockConfigurationNotFoundError`. (run 2026-08-03)
- UNVERIFIED: whether our compliance counsel treats GOVERNANCE as sufficient
  for the SEC 17a-4 attestation. No primary source exists for this — it is a
  human judgment, not a fact. Belongs in a grill.
```

Note what the example does: every claim carries its own citation, a live command counts as a primary source, and the one thing that cannot be sourced is flagged rather than smoothed over.

---

## `sketch · HITL`

Raise the fidelity of the discussion by making something cheap and concrete for the human to react to. "How should this behave?" and "what should this look like?" produce vague answers in the abstract and sharp ones in front of an artifact.

Two tiers. **Start at Tier 1 every time.**

### Tier 1 — paper sketch (the default)

No executable code. You write a concrete thing into the question's `## Evidence`, show it to the human, and they react. Most sketch questions never need more than this.

Shapes that work:

| Shape | Use when the question is |
|---|---|
| Outline | "What are the steps, and in what order?" |
| State table | "What states exist and which transitions are legal?" |
| Worked example with real numbers | "Does this rule produce sane results?" |
| Fake request/response pair | "What should this API actually look like?" |
| ASCII UI | "What goes on this screen and what is primary?" |
| Decision table | "Under which conditions do we do which thing?" |

Rules for a paper sketch: use REAL-looking content, never placeholders. Real customer names, real message counts, real timestamps, real error strings. A table full of `foo` and `item 1` gets nodded at; a table with `retention_expired` in it gets argued with, and the argument is the point.

Present it, then ask the pointed questions the sketch actually opens — up to three, batched, in the same turn as the artifact. A sketch is the one place where several probes come free: the human has the whole picture in front of them, so a second and third question cost them almost nothing, and a state table with three questionable rows should not take three sessions.

Pointed is the discipline that survives batching. Never "thoughts?" — every probe names its row or element: "row 5 says a flagged message still archives when retention expires. Right, or does the hold pin it in place?" Sketches always trip the detail test's second row — the artifact has to sit inline, and a picker cannot carry it — so this is a numbered Q block below the sketch, never a structured tool call. This is the one place the tool-first rule is settled in advance; do not re-litigate it per sketch.

Follow the Q-block formatting rules in `grilling.md` for the probes below the artifact — blank line between every element, options as a bullet list, `---` between probes. A sketch batch is the easiest one to render as a wall of text, because the artifact above it already ate the human's attention.

Putting up a sketch is a **Form B turn** in `trail.md`: close it with `WAITING ON YOU` naming the probes, never a resume command. The human is meant to react to the artifact in this conversation, and a footer telling them to start a new one throws the sketch away.

#### Paper sketch example A — state table

For `questions/06-review-lifecycle.md`:

```markdown
| From         | Event                | To           | Legal?      |
|--------------|----------------------|--------------|-------------|
| ingested     | policy match         | flagged      | yes         |
| ingested     | no match, 24h passes | archived     | yes         |
| flagged      | reviewer clears      | archived     | yes         |
| flagged      | reviewer escalates   | escalated    | yes         |
| flagged      | retention expires    | archived     | ← QUESTION  |
| escalated    | case closed          | archived     | yes         |
| escalated    | retention expires    | escalated    | stays put   |
| archived     | legal hold applied   | held         | yes         |
| held         | hold released        | archived     | yes         |
| held         | retention expires    | held         | hold wins   |

Open on this sketch: an item sitting in `flagged` when its retention window
expires. Row 5 currently drops it to `archived` unreviewed. The alternative is
that expiry cannot fire while a human review is outstanding — retention pauses.
```

#### Paper sketch example B — fake request/response pair

For `questions/09-export-job-api.md`:

```markdown
POST /v1/exports
{
  "channel_ids": ["ms-teams-legal", "ms-teams-trading"],
  "from": "2025-01-01T00:00:00Z",
  "to":   "2025-12-31T23:59:59Z",
  "format": "eml",
  "include_attachments": true
}

202 Accepted
{
  "export_id": "exp_9fK2mQ",
  "state": "queued",
  "estimated_messages": 418377,
  "estimated_bytes": 12884901888,
  "poll_url": "/v1/exports/exp_9fK2mQ",
  "expires_at": "2026-08-10T14:00:00Z"
}

GET /v1/exports/exp_9fK2mQ
200 OK
{
  "export_id": "exp_9fK2mQ",
  "state": "partial_failure",
  "messages_written": 418202,
  "messages_failed": 175,
  "failure_manifest_url": "https://.../exp_9fK2mQ-failures.csv",
  "download_urls": ["https://.../exp_9fK2mQ-part-001.zip", "..."]
}

Open on this sketch: `partial_failure` hands back a download plus a manifest of
what is missing. The alternative is all-or-nothing — 175 failures void the whole
12 GB export. Which does a compliance officer actually want at 4pm on a Friday?
```

#### Paper sketch example C — ASCII UI

For `questions/11-reviewer-queue-layout.md`:

```markdown
+----------------------------------------------------------------+
| Review Queue          [ Mine 42 ] [ Team 318 ] [ Overdue 7 ]   |
+---------------------------+------------------------------------+
| ! 2d  K. Ondrusek         | From: Kamil Ondrusek               |
|       "…move the block…"  | To:   trading-desk (14 members)    |
|       trading-desk        | 2026-08-01 09:14  MS Teams         |
|---------------------------|                                    |
|   1d  A. Whitfield        | Policy hit: BLOCK-TRADE-LANGUAGE   |
|       "confirming size"   | Confidence: 0.91                   |
|       trading-desk        |                                    |
|---------------------------| > can you move the block before    |
|   4h  R. Iyer             |   the close? size is 40k           |
|       "attached the deck" |                                    |
|       legal-general       | [ Clear ]  [ Escalate ]  [ Hold ]  |
+---------------------------+------------------------------------+

Open on this sketch: the policy hit and its confidence sit in the detail pane,
so the list gives no reason to pick one item over another beyond age. Should the
list rank by confidence instead of age, and show the rule name per row?
```

### Tier 2 — runnable sketch (available, and gated)

Every other plan2code step forbids writing code during planning. **Pathfinder is the one exception**, because some questions genuinely cannot be settled on paper: "does this state model actually hold once you push it through the ugly cases?", "what should this feel like?" A paper state table always looks fine. Driving it by hand for ninety seconds is where it falls over.

**All three gates must open before you write a line of code:**

1. The paper sketch was tried and did not settle it. Not skipped — tried. Say what the paper sketch failed to resolve.
2. There is an obvious way to run it in this project — an existing runtime and task runner. Do not add a package manager, language, or framework for a sketch.
3. The user says go. Ask explicitly: *"Paper didn't settle row 5. I can build a throwaway terminal app under `specs/audit-export/pathfinder/sketch-01/` that lets you drive the state machine by hand — about 60 lines, one command, deleted after. Go?"*

Any gate that stays shut: stay on paper, or convert the question to a `grill`.

#### Rules for a runnable sketch

1. **Throwaway from day one, and clearly marked.** Its README's first line is the banner, and its second says what question it exists to answer.
2. **It lives ONLY at `specs/<idea>/pathfinder/sketch-NN/`** — never in the project's own source tree, never beside the module it is sketching for. This is where pathfinder deliberately departs from upstream: upstream co-locates prototypes with the real code; pathfinder quarantines them, because `specs/` is gitignored scratch and the project tree is not.
3. **One command to run.** Print the exact command to the user. They must not have to remember a path or a flag. If the project has a task runner, use the runner's own idiom, but keep the entry point inside `sketch-NN/`.
4. **No persistence.** State lives in memory. Persistence is what the sketch is checking, not something it leans on. If the question is specifically about storage, use a local file named so its disposability is obvious.
5. **Skip all polish.** No tests, no error handling beyond what makes it run, no abstractions, no "we might want X later."
6. **Surface the full relevant state after every action** (logic) **or on every variant switch** (UI). The user must see the whole picture change, not a delta.
7. **Never merged.** The sketch is not lifted into the project. Only the validated decision it produced survives, in the `## Answer`. Reference the sketch directory from `## Evidence` so a later reader can re-run it, but the code is scaffolding, not output.

#### Pick the branch: logic or UI

| Question shape | Branch | Artifact |
|---|---|---|
| "Does this state model / data model / rule hold?" | **Logic** | One tiny interactive terminal app |
| "What should this look like?" | **UI** | Several radically different variations, switchable |

Getting this wrong wastes the entire sketch. If the question is genuinely ambiguous and the user is unreachable, default by what the question touches — a backend module or a rules engine points to logic, a page or component points to UI — and **state the assumption in the first lines of the sketch's README**, so the human can reject the framing before reading the code.

**Logic branch.** Build the smallest interactive terminal app that pushes the machine through the cases that are hard to reason about on paper. Keep the logic itself pure — a reducer, a state machine, or a small set of pure functions over a plain data type — with the terminal shell as a thin wrapper that imports it and never the reverse. Each frame: clear the screen, print the whole current state one field per line, then print the key legend, e.g. `[f] flag  [c] clear  [e] escalate  [h] hold  [t] advance clock 1d  [q] quit`. Re-render the entire frame after every keystroke; never append to scrollback. The whole frame fits on one screen. The interesting moment is the user saying "wait, that shouldn't have been possible" — that is a bug in the *idea*, which is the entire point. Add actions on request; sketches evolve.

**UI branch.** Generate **several radically different variations side by side, switchable** — not one polished take. Default to 3, cap at 5. They must disagree about structure: different layout, different information hierarchy, different primary affordance. Three tweaked card grids is wallpaper, not a sketch. If two drafts come out similar, redo one with an explicit constraint against the shape they share. Switch by a URL search param plus a small floating bar (previous / current variant name / next), following whatever routing convention the project already uses — but with the files under `sketch-NN/`. Wire variants to stubbed data, never to real mutations; the question is what it should look like, not whether the backend works. The most valuable feedback is usually "I want the header from B with the list from C" — that hybrid IS the answer, and it goes in the `## Answer`.

#### After a runnable sketch

Record the verdict and the question it settled in `## Answer`. Record the sketch path, the run command, and what the user actually said while driving it in `## Evidence`. Leave the directory in place — it is gitignored scratch, it costs nothing, and the next session may want to re-run it. Never copy any of it into the project.

---

## `legwork · HITL` or `legwork · AFK`

The one type that DOES rather than decides. There is nothing here to research, sketch, or grill — a decision is simply blocked until some manual work happens.

Typical: provisioning access to a system, signing up for a service so its API can actually be judged, moving a data sample somewhere it can be looked at, requesting a sandbox tenant, reading the codebase (`questions/00-codebase-context.md` is always this type).

**It earns its place only by unblocking a decision, never by delivering the destination.**

### AFK or HITL

| Mode | When | How it resolves |
|---|---|---|
| `legwork · AFK` | The agent can do it with the tools it has — read the code, run a query, count rows, inspect a config | Do it, record the facts, resolve |
| `legwork · HITL` | It needs a human's hands, credentials, card, or signature | Hand over a precise numbered checklist and WAIT |

Drive it alone wherever you can. Do not hand a human a checklist for work you could have done yourself.

### The HITL checklist

Numbered, specific, and verifiable — every line names the exact place to click, the exact value to use, and what the human should see when it worked. Plain English throughout: exact names and values where they carry the work, no Pathfinder vocabulary anywhere (see *Say it in plain English* in the grilling playbook). No `- [ ]` checkboxes; question files never carry them.

```markdown
1. Go to https://console.vendor.example/settings/api and sign in with the
   shared ops account (credentials in 1Password, item "Vendor Ops").
2. Create an API key named `pathfinder-eval-2026-08`. Scope it to
   read-only — untick "Write" and "Admin".
3. Copy the key into 1Password as a NEW item named "Vendor Eval Key".
   Do not paste it into this chat or into any file under specs/.
4. On the same page, note the "Rate limit" value shown for the key
   and tell me the number.
5. Under Settings > Data, note whether "Historical backfill" is listed
   as included or as a paid add-on, and tell me which.

Tell me when 1-5 are done, plus the two values from steps 4 and 5.
```

Then stop and wait. Do not guess the answers, do not proceed to the next question, do not mark it resolved on the assumption it went fine.

Handing over a checklist is a **Form B turn** in `trail.md` — close with `WAITING ON YOU` naming the checklist and the values you asked for, and no resume command. The human may be gone for hours, but the session is still theirs to come back to; only park it as a session end (Form A) once you are actually stopping.

### What its `## Answer` records

Two parts: **what was done**, and **the resulting facts later questions depend on**. Credentials locations (never the credentials), new URLs, row counts, version numbers, quota limits, table shapes, file paths.

```markdown
## Answer

**Done.** Read-only API key provisioned against the shared ops account and
stored in 1Password as "Vendor Eval Key". No key material is stored under specs/.

**Facts other questions depend on**

- Key location: 1Password item "Vendor Eval Key" (ops vault).
- Rate limit: 600 requests/minute per key, burst 1000.
- Historical backfill beyond 90 days is a paid add-on, not included in the
  eval tier — so any evaluation against real 2024 traffic needs a purchase.
- Base URL for the eval tenant: https://eval-3f2.vendor.example/api/v2
  (differs from the production host in their docs).

**Consequences** — the 90-day eval ceiling means the volume question cannot be
answered against real historical data on this tier; it has to be extrapolated
or the add-on has to be bought. That is a fresh decision, not one to make here.

**Gist:** Read-only eval key in 1Password; 600 rpm; history capped at 90 days
without a paid add-on.
```

### The guard

If the legwork turns out to BE the deliverable rather than an unblocker — you are migrating the data, not sampling it; you are building the integration, not evaluating it — **it is out of scope for pathfinder.** Stop. Say so plainly:

> "This has stopped being legwork that unblocks a decision and become the work itself. Pathfinder plans; it doesn't build. I'm ruling this out of scope and it belongs in planning."

Rule the question `out-of-scope`, mark the map row `[-]`, add one line to `## Out of scope` naming what it turned into, and hand off to `/plan2code-1-plan` for that piece. Never let pathfinder quietly become the implementation.

---

## `grill · HITL`

The default type: a decision only the human can make. Route to **the grilling playbook** — it owns the interrogation technique, the batching rules (up to three independent probes per turn), the detail test that decides whether the batch goes through the structured question tool (the default) or numbered Q blocks (the fallback), and the recommend-then-ask pattern.

Three things this playbook adds on top:

- **Zoom before you grill.** Work Step 5 already had you read the claimed question plus anything it references. Bring the resolved neighbors' gists into the first message so the human is not re-litigating settled ground.
- **Batch probes, not question files.** One question file per session is unchanged. A batch of three probes resolves ONE `questions/NN-*.md`; it is not licence to close three of them.
- **The human's own words.** A `grill` resolves only through live exchange. Never write the `## Answer` from what you inferred they would probably say — and a probe they skipped twice is unanswered, not decided.

A good grill `## Answer` contains four things:

1. **The decision** — stated flatly, in the human's terms, not hedged.
2. **What was rejected and why** — the alternatives that were live during the conversation, each with the reason it lost. This is the part that stops the decision from being reopened in three weeks.
3. **The consequences for other questions** — which open questions this constrains, which fog patches it just made sharp, which resolved answers it complicates. Name them; never number them in prose.
4. **A one-line bold Gist.**

---

## Writing the `## Answer`

Same anatomy for every type. Append it at Work Step 7; never edit `## Question` to match the answer.

| Part | Required | Content |
|---|---|---|
| The decision (or, for `research`, the facts found) | Always | What was settled, stated flatly |
| Rejected alternatives, with reasons | When alternatives existed | Each option that lost, and why |
| Consequences | Always | Effects on other questions, named not numbered |
| `**Gist:**` | Always | One line, last |
| `## Evidence` | When there is any | Sources, sketch paths, transcript quotes, commands run |

Worked example — `questions/03-export-format.md`:

```markdown
## Answer

**Decision.** Exports are written as one `.eml` file per message inside a ZIP,
with a top-level `manifest.csv` giving message id, channel, participants,
timestamp, SHA-256, and relative path. One ZIP per 2 GB, numbered `part-001`.

**Rejected**

- **Single NDJSON file.** Compact and trivially streamable, but the review
  vendors named in Codebase context both ingest `.eml` natively and neither
  parses NDJSON. Rejected because it moves the conversion cost onto the
  customer's e-discovery team.
- **PST.** What the legal team asked for by name, but PST is a single-writer
  format with a practical 50 GB ceiling and no first-party writer outside
  Outlook. Rejected on the ceiling alone — the 2025 trading-desk export is
  ~12 GB and growing 40% year over year, so the ceiling is 3 years out.
- **One ZIP, no parts.** Rejected because S3 presigned downloads over 5 GB
  fail on several corporate proxies the support team has already seen.

**Consequences**

- Makes [Export job API](./questions/09-export-job-api.md) sharper: the
  response must return an ARRAY of download URLs, not one.
- Constrains [Integrity attestation](./questions/12-integrity-attestation.md) —
  a per-message SHA-256 already exists in the manifest, so attestation can hang
  off the manifest rather than needing a separate hash pass.
- Kills the "streaming export" fog bullet: parts and streaming are exclusive.
  Removed from `## Not yet specified`.

**Gist:** One `.eml` per message in 2 GB ZIP parts, with a manifest.csv
carrying per-message SHA-256.
```

### The gist

The gist is what gets copied into the map row. It is not a summary of the answer — it is the one line that lets a future session decide, at a glance, whether to open the file.

- One line. Fits in a table row without wrapping twice.
- Says what was DECIDED, not what was discussed. "Chose ZIP parts" is weak; "One `.eml` per message in 2 GB ZIP parts" is judgeable.
- Carries the number or name that matters, if there is one.
- Never the full answer. If it needs a semicolon and a subordinate clause, cut it.

The map row it produces:

```markdown
- [x] [Export format](./questions/03-export-format.md) — one `.eml` per message in 2 GB ZIP parts, manifest.csv carries SHA-256
```

---

## Graduating the fog (Work Step 8)

`## Not yet specified` is the fog: in-scope questions you can *see* coming but could not phrase sharply when you wrote the map. Resolving a question clears the fog immediately ahead of it. Step 8 is where you collect what just became visible.

**The test is whether you can state the question precisely NOW — not whether you can answer it.** A question you cannot act on for weeks still gets a file, with `Blocked by:` filled in. A question you could answer this minute but cannot phrase without hand-waving stays fog.

### Procedure

1. **Re-read `## Not yet specified` in full.** Every bullet, every session, after every resolution. Not the ones you remember — you are assuming no memory of prior sessions, and the bullet that graduates is usually the one you forgot was there.
2. **Ask of each bullet: did the answer just make this sharp?** Can you now write a `## Question` paragraph a stranger could act on, without "we'll need to figure out" anywhere in it?
3. **If yes, write the question file NOW** — in this same session, before Work Step 9. Next `NN` = max existing + 1, never reused. Fill all five metadata lines, with `Blocked by:` wired in the same pass. Add its `[ ]` or `[!]` row to `## Question Checklist`.
4. **DELETE the bullet from `## Not yet specified`.** Immediately, in the same edit as writing the file.
5. **If no, leave the bullet alone** — untouched, not reworded into something that merely sounds sharper.
6. **Re-check the counts.** One fog patch may graduate into three questions, or into none. Both are normal. A patch that graduates into three was written at the right coarseness; a patch that graduates into exactly one every time was probably a question all along.

### The bullet you left behind

**A fog bullet still sitting in `## Not yet specified` after its question file exists is the single most common drift in this skill.** It is quiet — nothing errors, the map still renders — and it is corrosive:

- The Clearing Gate requires `## Not yet specified` to be EMPTY. A stale bullet blocks the gate forever, so the map never clears even when every question is resolved.
- A later session reads the bullet, does not recognize the question file as the same thing under a different phrasing, and writes a duplicate. Now two files hold half a decision each.
- It violates the rule that detail lives in exactly one place.

Detection is cheap: after writing any graduated question file, re-read `## Not yet specified` top to bottom and confirm the bullet is gone. If a bullet reads like a question you have already written a file for, delete the bullet — the file always wins.

### Ruling a question out of scope mid-work

The destination fixes the scope. When a resolution reveals that a question — the one you just claimed, or another on the map — sits past the destination:

1. Set that file's `State: out-of-scope`. Do NOT write a `## Answer`; there is no decision, only a scope boundary. Add one line under `## Question` saying why it is out.
2. Set its map row to `[-]`.
3. Add one line to `## Out of scope`: the name as a link, plus the reason.
4. Check for **stranded** questions — anything whose `Blocked by:` names it. A blocker that is `out-of-scope` will never be `resolved`, so the dependent is permanently blocked. Re-frame its `## Question` to drop the dependency, or rule it out too. Never leave it sitting.

Out-of-scope work never graduates back. The frontier stops at the destination. It returns only if the destination is redrawn, and then as a fresh effort with a fresh map.

```markdown
## Out of scope

- [Slack connector](./questions/08-slack-connector.md) — the destination names
  MS Teams only; Slack is a separate effort with its own compliance posture.
```

### Re-framing or deleting a question the answer invalidated

An answer can also break questions that already exist. Three cases:

| What happened | Do this |
|---|---|
| The question still matters but is asked wrong | **Re-frame.** Rewrite `## Question` in place. Keep `NN`, keep the file, keep the links. Add one line noting which answer forced the re-frame. |
| The question no longer exists — the answer subsumed it | **Delete the file and its map row.** Add one line to the answering question's `## Answer` consequences saying what it absorbed. Do not renumber anything. |
| The question is now two questions | **Re-frame the original to the narrower half; write a new file at max+1 for the other.** Wire `Blocked by:` between them if one gates the other. |

Never leave a question standing that you know is wrong on the theory that a later session will notice. It will not — it assumes no memory, and a well-formed `## Question` reads as intentional.

Two hard constraints on all three cases: **`NN` is never reused and never renumbered** — links and `Blocked by:` lines would rot silently. And every re-frame or deletion is reflected in the map's `## Question Checklist` in the same edit, so the index never disagrees with the files.