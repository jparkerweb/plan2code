# Trail Footer

> Loaded at the top of the skill. Read once; it applies to EVERY response in both modes. Defines the map visual and the pathed resume command that close each turn.
>
> **Backend note.** The glyphs, the two forms, and the discipline are identical either way. On `**Backend:** github` the inputs come from the sub-issue query rather than the checklist, and Form A's command is the map issue URL — see `github-issues.md`.

The trail is how a human with no memory of the last session sees, at a glance, how far the map has come and what is left — and copies the exact command to resume without hunting for a path that lives in gitignored `specs/`. It closes every response once a map exists.

It is **presentation only**. Rebuild it fresh from `map.md` each response; never write it to disk, and never let it emit a loop token (`TASK_COMPLETE`, `PHASE_COMPLETE`, and the rest). It is an index of an index — the question files remain ground truth.

---

## When it renders

| Situation | Footer? |
|---|---|
| `map.md` exists and the turn **ends the session** — Session End, a cleared map, a fully blocked frontier | **Yes**, both parts: the trail, then the resume command (Form A) |
| `map.md` exists and the turn **asks the human something** — a probe batch, a sketch put up for reaction, a `legwork · HITL` checklist | **Yes**, but with the waiting form of Part 2 (Form B). Never a resume command — see below |
| `map.md` exists and the turn **offers the menu after a recorded decision** — the continue-or-stop fork of the Work cadence | **Yes**, the fork form of Part 2 (Form C): the takeable questions AND the resume command as the stop branch |
| Intent Gate (Step 0), the no-fog off-ramp, or any route-and-stop before Step 5 | **No** — no map on disk yet, and no path to resume. There is nothing to draw. |

One idea per session, so there is only ever one trail. Draw the trail for the active idea and no other.

---

## The two parts

Always in this order, after everything else in the response:

1. **The trail** — the horizontal path plus its legend and confidence line. Identical on every turn.
2. **The next line** — either the pathed resume command or the waiting notice, chosen by turn type.

### Part 1 — the trail

```
🧭 audit-log-export · Working · 2/7 cleared
  START ●━●━◉··○··○··⊘··⊝ ····⚑
  ● done · ◉ here · ○ open · ⊘ blocked · ⊝ out of scope · ⚑ destination · ~4 fog
  1 Codebase context ✔ · 2 Export format ✔ · 3 Row-count ceiling ◀ here
  4 Export authorization · 5 Testing posture · 6 Delivery channel (blocked:3) · 7 SIEM push (out of scope)
  Confidence: solid, but Risk is borderline.
```

How each line is built, top to bottom:

- **Heading** — `🧭 <idea> · <Status> · <resolved>/<total> cleared`. `<Status>` is the map's `**Status:**` verbatim (`Charting` / `Working` / `Cleared`). `<resolved>` counts `[x]` rows; `<total>` counts every question row **except** out-of-scope `[-]` rows (a ruled-out question is off the route, not an unfinished stop).
- **The path** — one glyph per question row in `NN` order, left to right, from `START` to the `⚑` destination. Connectors carry meaning: solid `━` joins stops already walked (everything up to and including `◉ here`); dashed `··` joins stops still ahead. After the last question glyph, a fog stretch `····` then `⚑` — drop both if there is no fog and join straight to `⚑` with `━`.
- **The legend** — only the glyphs actually on this path, so a map with no blocked question does not advertise `⊘`. Append `~N fog` when `## Not yet specified` holds N bullets.
- **The named legend** — the same `NN` order, `<NN> <Name>` each, `·`-separated, wrapping across lines as needed. Tag each: `✔` resolved, `◀ here` the claimed one, `(blocked:NN)` with its blocker, `(out of scope)`. Names come straight from the checklist rows.
- **Confidence** — the map's four internal scores (Requirements / Feasibility / Integration / Risk, each out of 25) exist for the Clearing Gate, not the human. Never print the raw numbers or the `R·F·I·K` letters. Instead, reduce them to one plain-English line:

  | Scores | Line |
  |---|---|
  | All four ≥ 20 | `Confidence: solid.` |
  | All four ≥ 18, one or more sitting at 18-19 | `Confidence: solid, but <Dimension> is borderline.` (name every dimension in that range, comma-separated) |
  | Any dimension < 18 | `Confidence: not yet — <Dimension(s)> still need work.` |

  Omit the whole line if the map has no `**Confidence:**` line yet.

### Glyph reference

| Glyph | Map marker | Meaning |
|---|---|---|
| `●` | `[x]` | resolved — a stop already walked |
| `◉` | `[/]` | the claimed question — you are here |
| `○` | `[ ]` | open, on the frontier |
| `⊘` | `[!]` | open but blocked |
| `⊝` | `[-]` | ruled out of scope |
| `⚑` | — | the destination |
| `····` | — | the fog still between the last question and the destination |

### Part 2 — the next line

Part 2 answers exactly one question for the human: **is this turn over, or is it my move?** It has three forms, and the **turn type** picks between them — not the map's status.

#### Form A — the turn ends the session

```
NEXT STEP · start a new conversation and run:
`/plan2code-0-pathfinder specs/audit-log-export/pathfinder --web`
```

The path is always relative and always ends `/pathfinder` — that is exactly the argument this skill's Auto-Discovery resolves an idea from, so the human pastes it back with zero edits. Fill `<idea>` from the active map's directory; never leave the `<spec-folder>` placeholder in a rendered footer.

The command target follows the map's status, but the sentence is always the same shape — `start a new conversation and run:` followed by the command on its own line:

| Status | Command |
|---|---|
| `Charting` / `Working` | `/plan2code-0-pathfinder specs/<idea>/pathfinder --web` |
| `Cleared` | `/plan2code-1-plan --web` — point at the PLAN-DRAFT the Clearing Gate wrote |
| `Cleared`, but `## Ground rules` records `AGENTS.md` **absent** | `/plan2code-init` FIRST (offer `questions/00-codebase-context.md`), then `/plan2code-1-plan --web` |

#### Form B — the turn asks the human something

Any turn whose next move is theirs and happens **in this same conversation**: a batch of grill probes, a sketch put up for reaction, a `legwork · HITL` checklist, the Chart Step 2 destination grill, the Chart Step 4 frontier grill.

```
WAITING ON YOU · answer here, in this conversation:
Q1 Duration model · Q2 Contract while held · Q3 Placement & restore
```

Name every outstanding item at its stable number so a partial reply is cheap to give and a dropped probe is visible to both of you. `·`-separated on one line; one per line if the names run long. Never more items than the three-probe cap allows.

**Emit no resume command on a Form B turn.** There is nothing to resume — the session is alive and holding a claim. A resume command here reads as *we're done*, and the human either walks away mid-decision or burns the next turn asking what you meant. This is the single most common way the footer misfires, and it costs the batch the round trips batching was introduced to save.

One exception: `grilling.md`'s unreachable-human procedure. Parking a mid-grill question and stopping IS a session end — use Form A, and say in the body that the question is parked mid-grill with its batch outstanding.

#### Form C — the menu after a recorded decision

Used ONLY on the Work cadence's fork-menu turn (resolve.md §Cadence), immediately after an `## Answer` landed and the map row flipped `[x]`. It is the one legitimate hybrid: an *explicit* continue-or-stop fork where the resume command IS the stop branch, not a farewell.

First print the stop branch, clearly labeled:

```
OR START FRESH · new conversation, paste:
`/plan2code-0-pathfinder specs/audit-log-export/pathfinder --web`
```

Then invoke the structured question tool (header `Next step`) asking: "Continue here, or start fresh? Everything is saved." Options: up to three takeable question names, then `Start fresh`. Put each question's gist / newly-unblocked note in its description. The automatic `Other` path lets the human name another frontier question not shown. Mark one option's description `RECOMMENDED` — early in the session that is a question; at the checkpoint it is `Start fresh`.

Rules for Form C:

- **The command label is mandatory and exact:** `OR START FRESH · new conversation, paste:`. It makes the command the stop branch, not a farewell. Never render a bare command on a menu turn.
- **The choice itself always uses the structured tool.** Never print `NEXT UP` as a prose menu when the tool exists.
- Options come from the map's checklist rows (names + gists), takeable questions only. Flag anything the decision just recorded unblocked. The fourth slot is `Start fresh`; `Other` covers a frontier question omitted from the top three.
- **The recommendation carries the checkpoint** (resolve.md §Cadence): early in a session recommend a question; after ~3 resolved this session — or after a heavy, contested, or `Locked: yes` decision — recommend `Start fresh`, with the reason said in the question text ("to keep me sharp").
- **Form C never replaces Form B.** A turn that asks probes, shows a sketch, or hands over a checklist is Form B, no command. Form C fires only between decisions, when nothing is claimed.
- If the human walks away mid-menu, nothing is stranded: no claim is open, and the command to come back is already on screen.

---

## State-by-state examples

**Charting, mid-grill, no question claimed yet** (`◉` is omitted; the frontier head is the first `○`). The Chart Step 4 frontier grill is a Form B turn — the batch is above, so the footer says stay:

```
🧭 audit-log-export · Charting · 1/5 cleared
  START ●··○··○··○··○ ····⚑
  ● done · ○ open · ⚑ destination · ~6 fog
  1 Codebase context ✔ · 2 Export format · 3 Export authorization · 4 Testing posture · 5 Row-count ceiling
  Confidence: not yet — Requirements, Feasibility, Integration, Risk still need work.

WAITING ON YOU · answer here, in this conversation:
Q1 Data · Q2 Surface · Q3 Permissions
```

**Working, a claimed question mid-grill** — probes are out, the claim is held, nothing is resolved yet. Same trail, Form B again. Note that Q2 is a re-ask carried over at its original number from a batch that came back partial:

```
🧭 audit-log-export · Working · 2/7 cleared
  START ●━●━◉··○··○··⊘··⊝ ····⚑
  ● done · ◉ here · ○ open · ⊘ blocked · ⊝ out of scope · ⚑ destination · ~4 fog
  1 Codebase context ✔ · 2 Export format ✔ · 3 Row-count ceiling ◀ here
  4 Export authorization · 5 Testing posture · 6 Delivery channel (blocked:3) · 7 SIEM push (out of scope)
  Confidence: not yet — Feasibility, Integration, Risk still need work.

WAITING ON YOU · answer here, in this conversation:
Q2 Ceiling behaviour past the cap (re-ask) · Q3 Who sees the truncation warning
```

**Frontier fully blocked** — report the chain in the body; the trail shows why nothing is takeable. Work Step 4 stops the session here, so Form A:

```
🧭 audit-log-export · Working · 5/7 cleared
  START ●━●━●━●━●━⊘··⊘ ⚑
  ● done · ⊘ blocked · ⚑ destination
  6 Delivery channel (blocked:2) · 7 Notification (blocked:6)
  Confidence: not yet — Feasibility, Risk still need work.

NEXT STEP · start a new conversation and run:
`/plan2code-0-pathfinder specs/audit-log-export/pathfinder --web`
```

**Cleared** — every stop walked, fog empty, command hands off:

```
🧭 audit-log-export · Cleared · 8/8 cleared
  START ●━●━●━●━●━●━●━●━⚑  arrived
  Confidence: solid.

NEXT STEP · start a new conversation and run:
`/plan2code-1-plan --web`
```

At `Cleared` the named legend is optional — the destination is reached and the PLAN-DRAFT is the thing to point at. Keep the confidence line; the Clearing Gate leaned on it.

---

## Discipline

- **Never print a bare resume command on a turn that asks a question.** The footer must not tell the human to leave a conversation you are still waiting in. Before you write Part 2, ask whether the response above it ends with something for them to answer: mid-question (probes, sketch, checklist) → Form B, no command, no exceptions but the parked-grill one; between decisions at the fork-menu → Form C, where the command appears ONLY under its `OR START FRESH` label as the explicit stop branch.
- **Alignment is not the point.** Glyphs sit in `NN` order and the legend names them in the same order; do not burn effort column-aligning numbers under waypoints across variable-width glyphs. Legibility over pixels.
- **Rebuild, never cache.** The markers come from the current `map.md`, which Work Step 2 has already reconciled against the question files this session. A footer that disagrees with the checklist above it means you drew from memory.
- **One trail.** Never render two ideas' trails, and never invent a stop the map does not list.
