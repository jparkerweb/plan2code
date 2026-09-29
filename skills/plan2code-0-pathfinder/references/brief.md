# Brief Playbook

> Loaded when the user's argument asks for a brief. Produces one plain-English report file for a date range — the artifact a PM pastes into Slack or reads aloud in a meeting. The only mutation BRIEF mode ever performs is the Work Step 2 reconcile; it never claims, resolves, or answers a question.

> **Backend note.** The report is IDENTICAL either way — same sections, same plain-English rules — and the brief file always lands on **local disk** under `specs/<idea>/pathfinder/briefs/`, even on `**Backend:** github`. What differs is where the inputs come from: on `github` the range filter reads each question issue's close date instead of a `Resolved:` line, and the open / blocked / out-of-scope sections come from the frontier query rather than the checklist — see `github-issues.md`.

## When it fires

The argument (or message) asks for a `brief`, `summary`, `recap`, or `minutes` for an idea, with an optional range:

```
/plan2code-0-pathfinder write a brief for today for specs/<idea>/pathfinder
/plan2code-0-pathfinder brief since 2026-08-15 for specs/<idea>/pathfinder
/plan2code-0-pathfinder full brief for specs/<idea>/pathfinder
```

Range grammar is deliberately loose: `today` (the default when unstated) · `this week` · `since <date>` · an explicit `<date>..<date>` · `full` (everything since the map was created). Get today's date from the shell — never guess it.

No `map.md` for the idea? There is nothing to brief — say so and route to charting. `**Status:** Cleared`? A brief is still legitimate: cover the full history and point at the PLAN-DRAFT in `## Next step`.

## Procedure

1. **Resolve the idea** exactly as Auto-Discovery does (shell only — `specs/` is gitignored, Glob silently fails).
2. **Reconcile first, in full** (Work Step 2): files win over markers, stale claims reset to `open`, absent `Resolved:` dates backfilled from `Claimed:`. Save the repaired map. A brief must never disagree with the map it summarizes — this is why BRIEF mode reconciles rather than reporting drift.
3. **Filter**: resolved questions whose `Resolved:` date falls in the range. Out-of-scope rulings are NOT date-filtered — they are standing scope boundaries and appear in every brief.
4. **Write** `specs/<idea>/pathfinder/briefs/brief-<YYYYMMDD>.md` (create `briefs/` if absent). The filename carries today's date regardless of range — the `**Covers:**` line disambiguates. Same-day re-runs overwrite: a brief is a report, not a record; the question files remain the record.
5. **Report** in chat: the file path, the range, one line on any reconcile repairs. Then the Trail Footer, Form A (the session is over; the command routes by map status as usual).

## The template

Substitute real content; keep the section order. `<in range>` reads naturally per range: "Decided today", "Decided this week", "Decided so far" (full).

```markdown
# Audit log export - decisions brief

**Covers:** 2026-09-02 · **Map:** 6 of 9 decisions made

## Where this is headed

<The destination, verbatim from the map.>

## Decided today

- **Export format** - CSV with a UTF-8 BOM plus a SHA-256 manifest file.
  Rejected: JSONL (recipients open these in Excel); XLSX (harder to verify byte-for-byte).
  *Recorded as hard to reverse.*
- **Export authorization** - new tenant-scoped compliance role; self-events included but flagged.
  Rejected: reusing the admin role (no tenant scoping today).

## Ruled out

- **SIEM push connector** - continuous streaming is a separate effort with its own owner.

## Open - ready to decide next

- **Delivery channel** - can now be decided; the row-count ceiling it was waiting on landed today.
- **Testing posture** - needs Product and Engineering together.

## Open - waiting on something first

- **Redaction rules** - waiting on Legal's answer about exporting raw payloads.

## Still taking shape

- How far back an export may reach - depends on a retention answer nobody has yet.

## How solid is this?

Solid overall, but risk handling is borderline - one limit has no decided behavior past it yet.

## Next step

Run: `/plan2code-0-pathfinder specs/audit-log-export/pathfinder`

---
*Full reasoning behind every decision: `specs/audit-log-export/pathfinder/questions/`*
```

**How each section is built:**

| Section | Source | Rendering rule |
|---|---|---|
| Heading + `**Covers:**` | Idea name in words; the range; `<resolved>/<total>` using the trail's counting rule (out-of-scope rows excluded from the total) | |
| Where this is headed | `## Destination`, verbatim | Never paraphrase it |
| Decided `<in range>` | Resolved files with `Resolved:` in range | Question name bold, gist as the first line, rejected alternatives compressed to ONE line each with the why in parentheses. `Locked: yes` renders as *Recorded as hard to reverse.* — never the word "locked" |
| Ruled out | `## Out of scope`, all of it | One line each: name + why |
| Open - ready to decide next | The frontier (open, unclaimed, unblocked) | Flag anything a resolution in range just unblocked: "can now be decided; X landed <day>" |
| Open - waiting on something first | `[!]` blocked rows | Name the blocker in plain words ("waiting on the export format decision"), never `Blocked by: 02` |
| Still taking shape | `## Not yet specified` | Lightly rephrase each bullet into one plain sentence |
| How solid is this? | The map's `**Confidence:**` line | ONLY via trail.md's plain-English mapping (solid / solid-but-borderline / not yet). Omit the section if the map has no confidence line |
| Next step | Map status | `Working`/`Charting` → the pathed resume command; `Cleared` → point at the PLAN-DRAFT and `/plan2code-1-plan` |

Nothing decided in the range? Keep the file honest: "No decisions were recorded in this period." under Decided, and render the open sections as usual — a meeting that only surfaced questions still gets minutes.

## Rules

- **Zero pathfinder machinery in the file.** No `NN` numbers, no markers, no `Type:`/`State:` tokens, no fog/frontier/grill vocabulary, no `Locked:`. Questions are referred to by name only, no links. The audience may never open a terminal.
- **Scraper safety, same as the PLAN-DRAFT:** no `%`, no raw `NN/25` scores, and no bare `Requirements` / `Feasibility` / `Integration` / `Risk` followed by a number anywhere in the file. The plain-English confidence line is the only rendering permitted.
- **Standing `specs/` rules apply:** no loop tokens, no `- [ ]` checkboxes, no `METRICS_JSON`.
- **Rejections are one line each.** The brief summarizes; the question file argues. The closing pointer line covers readers who want the full reasoning.
- **BRIEF mode does not count as question work.** It does not count toward the session's decision cadence; no claim is ever taken.
- **Do not edit an old brief to "update" it.** Yesterday's brief reflects yesterday's map — write today's instead. Same-day overwrite only.
