# GitHub Issues Backend

> Part of plan2code-0-pathfinder — loaded at the top of EVERY session whose map lives on GitHub Issues. It re-expresses the local-file model in issue terms: where the map lives, where a question lives, how blocking, claiming, and resolving are done, and what stays on local disk regardless.
>
> **Local-file maps never load this file.** If `## Ground rules` says `**Backend:** local`, close it and use `questions.md`.

Everything the skill says about *judgement* is unchanged by the backend: the fog-vs-question test, the destination grill, one question at a time, the decide-menu-checkpoint cadence, HITL is never self-answered, the Clearing Gate rubric. This file changes only *where the bytes go*.

---

## Why a second backend exists

Local files are private scratch — `specs/` is gitignored, so the map is yours alone and nobody else can see it, comment on it, or resolve a question in parallel. That is the right default for a solo effort.

A map on GitHub Issues buys three things local files cannot:

| | Local files | GitHub Issues |
|---|---|---|
| Visibility | One machine, one person | Anyone with repo access, in a UI they already have open |
| Blocking | A `Blocked by:` line only an agent reads | Native issue dependencies — GitHub greys out blocked issues in its own UI |
| Concurrency | One session at a time by construction | Several people can work unblocked questions at once; the assignee is a real lock |

It costs three things too, and the human must know all three before they pick it:

1. **Issues on a public repo are public.** The destination, the rejected alternatives, the codebase recon, the technical debt in the blast radius — all of it is world-readable the moment it is written. Never chart to a public repo's tracker anything that would embarrass the project or leak a customer.
2. **It writes to shared state.** A local map costs nothing to abandon. Twelve stale issues labelled `pathfinder:grill-hitl` on a team's tracker is litter someone has to clean.
3. **It needs `gh`, auth, and issues enabled.** More that can break, in a step whose whole job is to remove friction.

---

## Preflight — before the first write

Run these once, at Chart Step 1, **before** offering GitHub as an option. Any failure means GitHub is not offered at all; say why in one line and continue with local files.

| # | Check | Command | On failure |
|---|---|---|---|
| 1 | `gh` is installed | `gh --version` | Not offered — "no `gh` on this machine" |
| 2 | Authenticated | `gh auth status` | Not offered — "`gh` is not logged in" |
| 3 | Inside a repo with a GitHub remote | `gh repo view --json nameWithOwner,visibility,hasIssuesEnabled` | Not offered — "no GitHub remote here" |
| 4 | Issues are enabled | same call, `hasIssuesEnabled` | Not offered — "issues are disabled on this repo" |
| 5 | Write access | `gh api repos/<owner>/<repo> --jq .permissions.push` | Not offered — read-only access cannot chart |

Record `nameWithOwner` and `visibility` from check 3 — **`visibility` is not optional detail.** If it is `PUBLIC`, the offer must say so in the same breath, e.g. *"GitHub Issues — note `jparkerweb/plan2code` is public, so the whole map is world-readable."*

Once a map exists, preflight shrinks to checks 1 and 2. A session that cannot reach `gh` cannot work a GitHub map: say so and stop, rather than silently starting a local one.

### Labels

Create the label set at **Chart Step 5**, with the map issue — never during preflight, which must stay read-only until the human has actually picked `github`. `--force` makes it idempotent, so it is safe to re-run every session:

```bash
gh label create "pathfinder:map"           --color 5319E7 --description "Pathfinder map" --force
gh label create "pathfinder:grill-hitl"    --color 1D76DB --description "Decision only the human can make" --force
gh label create "pathfinder:research-afk"  --color 0E8A16 --description "Fact-finding, agent alone" --force
gh label create "pathfinder:sketch-hitl"   --color FBCA04 --description "Human reacts to something concrete" --force
gh label create "pathfinder:legwork-hitl"  --color D93F0B --description "Manual work needing a human" --force
gh label create "pathfinder:legwork-afk"   --color D93F0B --description "Manual work the agent can do" --force
gh label create "pathfinder:locked"        --color B60205 --description "Hard to reverse; consequences recorded" --force
gh label create "pathfinder:out-of-scope"  --color CFD3D7 --description "Ruled past the destination" --force
```

**Type and mode share one label** — `grill-hitl`, not `grill` plus `hitl` — for the same reason the local `Type:` line is one token: two labels can drift apart, and a `research` question that has quietly become HITL is a question nobody is driving.

---

## The equivalence table

This is the whole mapping. Everything below expands a row.

| Local file model | GitHub Issues model |
|---|---|
| `specs/<idea>/pathfinder/map.md` | One issue, labelled `pathfinder:map`, titled `Map: <idea>` |
| `questions/NN-<slug>.md` | A **sub-issue** of the map, titled with the question name |
| `NN` ordering | The map's sub-issue order — the order they were created, which is dependency order |
| `## Question` in the file | The issue body |
| `## Answer` appended | A comment on the issue, opening `## Answer` |
| `## Evidence` | A comment opening `## Evidence` (a research subagent writes its own) |
| `Type:` line | The `pathfinder:<type>-<mode>` label |
| `State: open` | Issue open, **no assignee** |
| `State: claimed` | Issue open, **assigned** |
| `State: resolved` | Issue **closed as completed**, with an `## Answer` comment |
| `State: out-of-scope` | Issue **closed as not planned**, labelled `pathfinder:out-of-scope`, no `## Answer` |
| `Blocked by: 02, 04` | Native issue dependencies (`dependencies/blocked_by`) |
| `Locked: yes` | The `pathfinder:locked` label |
| `Claimed: <timestamp>` | GitHub's own assignment event in the timeline |
| `Resolved: <YYYY-MM-DD>` | The issue's own close timestamp (`closedAt`) — nothing to write, nothing to backfill |
| `## Question Checklist` in `map.md` | **Nothing** — the frontier is a live query, not a written list |
| `## Not yet specified`, `## Out of scope`, `## Ground rules`, `## Destination`, `## Glossary` | The same sections, in the map issue body |
| `sketch-NN/` | Still local disk — see *What stays on local disk* |
| `PLAN-DRAFT-<YYYYMMDD>.md` | Still local disk — see *Handoff* |

### The checklist is deleted, not ported

In local mode `map.md` carries a `## Question Checklist` because a directory of files has no queryable state. GitHub has queryable state, so **the map issue body carries no checklist at all.** Closed questions get one line each under `## Decisions so far`; open questions are not listed anywhere.

This kills the single largest source of drift in the local backend — a checklist that disagrees with the files — and it is why Work Step 2's reconcile pass is much shorter here.

---

## Refer by name

Unchanged, and harder to get right here because GitHub hands you a number for everything. In prose the human reads, write `[Export format](https://github.com/o/r/issues/42)` — never `#42`, never "issue 42", never a bare number. A wall of `#42, #43, #44` is illegible; names read at a glance.

Bare `#<n>` appears in exactly two places: inside a fallback `Blocked by:` body line when native dependencies are unavailable, and inside a `gh` command.

---

## Chart Steps 3-4 — hold the recon, protect the off-ramp

In `local` mode Step 3 writes `questions/00-codebase-context.md` the moment the recon is done, because a file in gitignored scratch costs nothing if the session then takes the Step 4 off-ramp. **On a shared tracker it costs something**: a stray issue nobody asked for, on a repo other people are watching.

So on `github`, Step 3 does the recon and **holds it in the session**. It becomes an issue at Step 6, alongside the other questions.

If the Step 4 breadth-first grill surfaces **no fog**, the off-ramp fires before anything has been created:

1. Write the recon to `specs/<idea>/pathfinder/questions/00-codebase-context.md` — a **local file**, exactly as the local backend would. It is what `/plan2code-1-plan` Phase 2 needs, and it is too valuable to throw away.
2. Create **nothing** on the tracker. No map issue, no question issues, no labels.
3. Tell the user plainly and STOP.

The tracker only ever sees an effort that earned a map.

---

## Creating the map (Chart Step 5)

Title is `Map: <idea>` — the kebab-case idea name, verbatim, so `gh issue list --label pathfinder:map` reads as an index of efforts.

```bash
gh issue create --label "pathfinder:map" --title "Map: audit-log-export" --body-file - <<'EOF'
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

**Status:** Charting
**Updated:** 2026-08-08
**Confidence:** Requirements-clarity 8/25 · Feasibility-technical 6/25 · Integration-points 6/25 · Risk-assessment 5/25

<!-- Status: Charting (Chart Steps 5-6) -> Working (Chart Step 7) -> Cleared at the gate.
     A fresh session routes on this line, so it must be correct before the session ends. -->

## Destination

A locked implementation plan for a compliance officer to export a filtered range of audit
events from the admin UI and receive them as a single downloadable file. The map ends at the
plan, not at shipped code. Continuous streaming to external systems is not on the route.

## Ground rules

- **Backend:** github — this issue is the map; questions are its sub-issues.
- `AGENTS.md` exists and governs. Its conventions are not re-litigated by any question here.
- One question _issue_ at a time; the fork-menu between decisions; a fresh session recommended after ~3. `research` questions may run as parallel subagents.
- Every user-facing question uses the structured question tool when available; probes batch at most three. Prose Q blocks are fallback only when the tool is unavailable.
- HITL questions are answered by the human in their own words. Never self-answered.
- Sketches are throwaway and live on local disk only, under `specs/audit-log-export/pathfinder/sketch-<issue>/`.

## Glossary

| Term | Meaning here | Avoid |
|---|---|---|
| Audit event | One row in `audit_events`: actor, tenant, action, target, timestamp, payload | log line |

## Decisions so far

<!-- The index — one line per CLOSED question: enough to judge relevance, then open the
     issue for the detail. Open questions are NOT listed; they are open sub-issues. -->

## Not yet specified

<!-- The fog: in-scope areas you can see but cannot yet phrase as a question. Graduates into
     sub-issues as answers land, and the graduated bullet is deleted from here. -->

## Out of scope

<!-- Work consciously ruled past the destination. Never graduates. One line each: gist plus why. -->
EOF
```

Two things that must be exact:

- **`**Status:**` is still a literal line in the body.** It is how a fresh session routes, exactly as in local mode. `Charting` → `Working` → `Cleared`.
- **`**Backend:** github` is the first `## Ground rules` bullet.** It is how a fresh session knows to load this file at all. Without it, a session that opens the map issue has no way to know which playbook it is in.

Confidence keeps the hyphenated `Requirements-clarity 8/25` form for the same reason it does in local mode — the metrics collector scrapes bare dimension words followed by digits, and would ingest a planning confidence nobody scored.

**Say once, at Step 5:** *"The map lives on `<owner>/<repo>`'s issue tracker — `<PUBLIC or PRIVATE>`, so `<world-readable / visible to anyone with repo access>`. Everything charted here is visible there."*

---

## Creating the questions (Chart Step 6) — two passes, not one

The local backend charts in a **single pass** because you choose `NN` yourself and can write `Blocked by: 02` into a file before `02` exists. **On GitHub that is impossible** — an issue has no id until the server assigns one, and a dependency edge needs the blocker's id. So charting here reverts to upstream's shape:

**Pass 1 — create every question issue, in dependency order.** Blockers first. The creation order becomes the sub-issue order, which becomes the reading order for the frontier and the trail, so it is doing the job `NN` does locally. Capture each new issue's number *and* database id as you go.

```bash
# Create, capturing the URL; the number is its last path segment.
gh issue create --label "pathfinder:grill-hitl" --title "Export format" --body-file - <<'EOF'
> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.

## Question

What file format does an export produce, and what does a recipient need in order to trust
the file has not been altered?

Recommended answer to react to: CSV with a UTF-8 BOM plus a sidecar SHA-256 manifest.
EOF

# The database id — needed for BOTH wiring steps below. Not the #number, not the node_id.
gh api repos/<owner>/<repo>/issues/<number> --jq .id
```

**Pass 2 — wire the structure.** Two edges per question, both keyed on **database ids**:

```bash
# a) Attach as a sub-issue of the map. sub_issue_id is the CHILD's database id.
gh api --method POST repos/<owner>/<repo>/issues/<map-number>/sub_issues \
  -F sub_issue_id=<child-db-id>

# b) Add each blocking edge. issue_id is the BLOCKER's database id.
gh api --method POST repos/<owner>/<repo>/issues/<blocked-number>/dependencies/blocked_by \
  -F issue_id=<blocker-db-id>
```

**The database id is the single most common failure in this backend.** `gh api repos/o/r/issues/42 --jq .id` returns something like `2716143027`. The `42` is the *number*; `I_kwDO...` is the *node id*. The node id is rejected outright. The *number* is worse: a small integer like `42` is itself a perfectly valid database id — of some unrelated issue created years ago — so the call can succeed and silently attach the wrong thing. Fetch `.id` for every issue you are about to reference, and never hand-assemble one.

Charting still writes `00-codebase-context`'s equivalent — the Step 3 recon you held. Create it **first**, labelled `pathfinder:legwork-afk`, post the recon as an `## Answer` comment, and close it as completed in the same pass. It is resolved on arrival, exactly as in local mode, and it is what the handoff's `## System Context` is built from.

### If the endpoints are unavailable

Sub-issues and dependencies are recent GitHub features. On an instance that rejects either endpoint, fall back in the body — and say plainly, once, that the frontier will not render in GitHub's UI:

| Missing | Fallback |
|---|---|
| Sub-issues | Put `Part of #<map>` on the first line of each question body, and a task list of the questions in the map body |
| Dependencies | Put `Blocked by: #12, #14` on its own line at the top of the question body |

Prefer the native mechanisms every time they work. The whole reason to pay GitHub's costs is that the human sees the frontier in the UI without opening the map.

---

## The frontier query (Work Step 3)

The frontier is every question that is **open, unblocked, and unassigned**. Lowest position in sub-issue order wins — the same traversal `lowest NN first` gives locally.

```bash
# 1. The map's children, in order, with the state you need to filter on.
gh api repos/<owner>/<repo>/issues/<map-number>/sub_issues \
  --jq '.[] | {number, title, state, assignee: .assignee.login,
               blocked: .issue_dependencies_summary.blocked_by,
               labels: [.labels[].name]}'
```

Then, in order:

1. Drop anything `state: closed` — that is resolved or out of scope.
2. Drop anything with an `assignee` — claimed by another session.
3. Drop anything still blocked.
4. The first survivor is the next question.

For step 3, `issue_dependencies_summary.blocked_by` counts **open** blockers, which is exactly the live gate — a blocker that closes drops the count without anyone editing anything. **Treat it as a fast pre-filter, not the authority.** If it comes back `null` or absent from the list response, or you need to *name* the blockers for the trail footer or a fully-blocked report, ask the endpoint that owns the answer:

```bash
gh api repos/<owner>/<repo>/issues/<n>/dependencies/blocked_by --jq '.[] | {number, title, state, reason: .state_reason}'
```

A question is unblocked when every blocker listed there is closed. That call is also the only way to see the next trap:

**A blocker closed as `not planned` is out of scope and will never resolve.** Its dependent is not merely blocked, it is *stranded* — the same trap as locally. Re-frame the dependent's body to drop the dependency, cut the edge, or rule it out too. Never leave it sitting: the summary count cannot tell you the difference, so this check is on you.

```bash
# Cut a dependency edge. The blocker's database id goes in the PATH here, not the body.
gh api --method DELETE \
  repos/<owner>/<repo>/issues/<blocked-number>/dependencies/blocked_by/<blocker-db-id>
```

---

## Claim (Work Step 4)

```bash
gh issue edit <n> --add-assignee "@me"
```

**The session's first write, before any work.** The assignee *is* the claim — GitHub timestamps it for you, so there is no `Claimed:` line to maintain. An open, unassigned question is unclaimed; that is the whole protocol.

Unlike the local backend, other people may genuinely be working this map at the same time. Re-read the issue immediately after assigning; if someone else's login is on it, you lost the race — release yours and take the next frontier item.

---

## Resolve (Work Step 7)

Three writes, in this order. The order matters: the answer must exist before the issue closes, or a crash between them leaves a closed question with no decision in it.

```bash
# 1. The answer, as a comment. Same anatomy as a local ## Answer:
#    decision, rejected alternatives with reasons, consequences, one-line **Gist:**.
gh issue comment <n> --body-file - <<'EOF'
## Answer

**Decision.** CSV, UTF-8 with a byte-order mark, RFC 4180 quoting, one header row.
Alongside it a sidecar `.sha256` manifest.

**Rejected.**

- *JSONL* — trivially streamable, but every named recipient opens these in Excel.
- *XLSX* — fixes Excel encoding, but adds a library and makes byte-level verification harder.

**Consequences.**

- Do not reuse the billing export's CSV writer; it concatenates strings with no escaping.
- Makes [Delivery channel](https://github.com/o/r/issues/45) sharper — the artifact is
  self-verifying, so a short-lived link no longer weakens the integrity story.

**Gist:** CSV with a UTF-8 BOM and RFC 4180 quoting, plus a sidecar SHA-256 manifest;
JSONL rejected because recipients open these in Excel.
EOF

# 2. Close as completed.
gh issue close <n> --reason completed

# 3. Append the gist to the map's Decisions so far (read body, edit, write back).
gh issue view <map-number> --json body --jq .body > /tmp/map.md
#    ...append: - [Export format](<issue-url>) — <gist> *(YYYY-MM-DD)*
gh issue edit <map-number> --body-file /tmp/map.md
```

Then bump `**Updated:**` and re-score `**Confidence:**` in the same map edit.

**The close date IS the `Resolved:` date.** There is no line to set and none to backfill — `closedAt` is written by GitHub the moment step 2 runs, and a brief filters on it. Stamp the same date in italics on the `## Decisions so far` line so the map reads as a dated record on its own.

**Never edit the question body to hold the answer.** The body is the question as asked; the comment is the answer. Editing the body rewrites history and destroys the record of what was actually put to the human — which is half of why the answer is defensible three weeks later.

### Editing the map body safely

Every map mutation is read-modify-write on a body other sessions may be editing concurrently. Read it fresh immediately before the edit, apply your change to *that* text, and write it straight back. Never edit from a copy you read at the top of the session — you will silently revert whatever landed in between.

---

## Ruling a question out of scope (Work Step 8)

```bash
gh issue edit <n> --add-label "pathfinder:out-of-scope"
gh issue close <n> --reason "not planned"
```

Then one line under the map's `## Out of scope`, giving the name as a link plus the reason. **No `## Answer` comment** — there is no decision here, only a scope boundary. Add one comment saying why it is out, so the closed issue explains itself.

`not planned` versus `completed` is the load-bearing distinction: it is how a later session tells a decision that was made from a question that was ruled off the route, and it is what GitHub's UI shows at a glance. Getting it backwards puts a scope boundary into the Provenance table of the plan.

---

## Reconcile (Work Step 2)

Much shorter here — the tracker holds the state, so there is no checklist to rebuild. Four checks:

| Check | Symptom | Repair |
|---|---|---|
| Crashed mid-answer | Open, assigned, and an `## Answer` comment already exists | The comment wins. Close as completed, add the gist to Decisions so far, say so. |
| Stale claim | Open, assigned, no `## Answer`, and the assignee is you from a dead session | Unassign, say so, put it back on the frontier. **If it is someone else's login, leave it** — that is a live session, not a crash. |
| Interrupted research | An open `research` question with no `## Evidence` comment ending in `**Research complete:**` | Re-fire its subagent (`resolve.md` → Interrupted research), say so in one line. |
| Index drift | A closed, completed question with no line under `## Decisions so far` | Read its `## Answer` comment, append the gist. |

Then re-read `## Not yet specified` in full — that part is identical to local mode, and the bullet left behind after its question exists is just as corrosive here.

Local mode's `Resolved:` backfill has no counterpart here: `closedAt` cannot be absent on a closed issue. If a `## Decisions so far` line is missing its date, take the date from `closedAt` during the index-drift repair above.

---

## What stays on local disk

Three things never move to the tracker, whatever the backend:

| Artifact | Where | Why |
|---|---|---|
| Runnable sketches | `specs/<idea>/pathfinder/sketch-<issue-number>/` | Throwaway code has no business in an issue, and the quarantine rule (never in the project's own source tree) is unchanged. Link the path from the issue and note the reader needs the repo checked out. |
| `PLAN-DRAFT-<YYYYMMDD>.md` | `specs/<idea>/` | `/plan2code-1-plan` reads a **file**. This is a hard downstream contract — see Handoff. |
| Anything secret | Nowhere | Credentials, tokens, customer data. A `legwork` checklist says *where* a credential lives, never what it is — and on a public tracker that rule stops being a convention and starts being an incident. |

Sketch directories are named for the issue number rather than a local `NN`, so `sketch-42` belongs to the question at `#42`. Same rules otherwise: throwaway, one command to run, never merged.

Research subagents work the same way with one substitution: the brief carries the **issue URL** instead of a file path, and the instruction is to post findings as a comment opening `## Evidence` via `gh issue comment` — and to decide nothing. The comment ends with the `**Research complete:** <YYYY-MM-DD>` line, and the firing session waits for every subagent before Session End, exactly as on local disk. `## Answer` and the close are still written by the session that fired it.

---

## The trail footer

Identical in shape; the inputs come from the query instead of the checklist.

- **Heading** — `🧭 <idea> · <Status> · <closed>/<total> cleared`, where `<total>` excludes anything labelled `pathfinder:out-of-scope`.
- **Glyph order** — sub-issue order, the same order Chart Step 6 created them in.
- **Glyphs** — `●` closed as completed · `◉` open and assigned to you · `○` open, unassigned, unblocked · `⊘` open with `blocked_by > 0` · `⊝` closed as not planned.
- **Named legend** — names, never `#numbers`. `(blocked:<name>)` names the blocker rather than numbering it, since there is no stable `NN` to point at.
- **Confidence** — the plain-English line, from the map body's `**Confidence:**`.

Form A's resume command changes, because there is no local path to resume from:

```
NEXT STEP · start a new conversation and run:
`/plan2code-0-pathfinder https://github.com/<owner>/<repo>/issues/<map-number>`
```

Form B is unchanged — a turn that asks the human something still says `WAITING ON YOU`, still names the outstanding probes, and still emits no resume command.

Form C — the fork-menu after a recorded decision — is unchanged in shape, with two substitutions: the takeable options come from the frontier query rather than the checklist rows, and the `OR START FRESH` command carries the map issue URL. The `RECOMMENDED` marker and the ~3-decision checkpoint work exactly as `trail.md` describes.

---

## BRIEF mode

The report is identical either way, and the file still lands on **local disk** at `specs/<idea>/pathfinder/briefs/brief-<YYYYMMDD>.md` — a brief is a plain-English artifact for people, not tracker state, and writing it as an issue comment would bury it. Three substitutions against `brief.md`:

| `brief.md` says | Here |
|---|---|
| Filter resolved questions by `Resolved:` in range | Filter the map's sub-issues closed as completed by `closedAt` in range |
| Reconcile backfills absent `Resolved:` dates | Nothing to backfill; run the four reconcile checks above instead |
| Open / blocked / out-of-scope sections read the checklist | They read the frontier query — unassigned-unblocked, `blocked_by > 0`, and `pathfinder:out-of-scope` respectively |

`## Not yet specified`, `## Destination`, and `**Confidence:**` come from the map issue body, same as always. The no-machinery rule tightens rather than relaxes: no `#numbers`, no label names, no `gh` commands in the file. The reader may never have opened the tracker either.

---

## Handoff (The Clearing Gate)

The gate's four dimensions, the 18/25 bar, the hard caps, and the honesty rules are unchanged. Only the preflight and the plumbing differ.

**Preflight, GitHub form:**

| # | Check |
|---|---|
| 1 | Reconcile pass run (above) |
| 2 | Zero open sub-issues — `gh api .../sub_issues --jq '[.[] \| select(.state=="open")] \| length'` returns `0` |
| 3 | `## Not yet specified` in the map body is empty |
| 4 | Every completed question has an `## Answer` comment carrying a `**Gist:**` |
| 5 | `ls specs/<idea>/` shows no existing `PLAN-DRAFT-*.md` |
| 6 | No `## Answer` defers a choice to "whoever implements this" |

**The draft is written to local disk**, at `specs/<idea>/PLAN-DRAFT-<YYYYMMDD>.md`, with the byte-exact status line `**Status:** Phase 3 Complete - Resume at Phase 4`. This is not a preference. `/plan2code-1-plan` discovers its input with `ls specs/`; it has no notion of an issue tracker, and a draft that exists only as an issue is a draft the rest of plan2code cannot see. Create `specs/<idea>/` if charting never needed it.

Three substitutions inside the template:

| Local | GitHub |
|---|---|
| `**Planning record:** specs/<idea>/pathfinder/map.md` | `**Planning record:** <map issue URL>` |
| `[Export format](./pathfinder/questions/01-export-format.md)` | `[Export format](https://github.com/o/r/issues/42)` |
| `## Out of scope` copied line for line, only the link prefix changing | Copied line for line, links already absolute — **nothing changes at all** |

Everything else — the mapping table, Section 5 left empty, the two load-bearing `**Next:**` bullets, no scrapable confidence numbers — is unchanged.

**Freeze the map:**

1. Set `**Status:** Cleared` in the map issue body.
2. Bump `**Updated:**`.
3. Add `**Plan:** specs/<idea>/PLAN-DRAFT-<YYYYMMDD>.md` under the status line.
4. `gh issue close <map-number> --reason completed`.
5. **Close nothing else, delete nothing, edit no answers.** Every question issue stays exactly as it is — it is the rationale record behind the plan.

Closing the map is the one addition over local mode, and it earns its place: `gh issue list --label pathfinder:map --state open` then reads as *the efforts still being charted*, which is the question a person scanning the tracker actually has.

A later session that opens a map issue reading `Status: Cleared` must not resume it. Point at the PLAN-DRAFT and `/plan2code-1-plan`, and stop. A redrawn destination is a fresh effort with a fresh map issue.

---

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `Not Found` from a `sub_issues` or `dependencies` POST | An issue *number* was passed where a database *id* is required | `gh api repos/o/r/issues/<n> --jq .id`, retry with that |
| The wrong issue got attached | A number from another repo happened to be a valid id | Detach, re-fetch `.id` from the right repo, re-attach |
| Frontier is empty but open questions remain | Every one is blocked, or every one is assigned | Name the chain and stop — or, if the assignees are stale claims from your own dead sessions, reconcile first |
| A blocked question never unblocks | Its blocker was closed as `not planned` | Stranded. Re-frame to drop the dependency and cut the edge, or rule it out too |
| Two sessions resolved the same question | The claim was written after the work, not before | Claim is the *first* write. Merge the two answers into one comment, keep one close |
| A map edit lost someone's line | The body was edited from a stale copy read earlier in the session | Re-read the body immediately before every map write |
| `/plan2code-1-plan` finds nothing to resume | The PLAN-DRAFT was posted as an issue instead of written to `specs/<idea>/` | Write the file. The draft is always local |
| Secrets in the tracker | A `legwork` answer pasted a credential | Rotate the credential first, then delete the comment. Editing it is not enough — GitHub keeps the edit history |
