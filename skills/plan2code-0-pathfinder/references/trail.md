# Trail Footer

> Loaded at the top of the skill. Read once; it applies to EVERY response in both modes. Defines the map visual and the pathed resume command that close each turn.
>
> **Backend note.** The glyphs, the two forms, and the discipline are identical either way. On `**Backend:** github` the inputs come from the sub-issue query rather than the checklist, and Form A's command is the map issue URL — see `github-issues.md`. `pathfinder.mjs` reads local files only, so on `github` do each script step below except `lint` by hand with `gh`, as `github-issues.md` describes.

The trail is how a human with no memory of the last session sees, at a glance, how far the map has come and what is left — and copies the exact command to resume without hunting for a path that lives in gitignored `specs/`. It closes every response once a map exists.

It is **presentation only**, rebuilt fresh from the files every response and never written to disk. The script draws it; you choose its form.

```
node "<S>/pathfinder.mjs" trail specs/<idea>/pathfinder --form A|B|C [--item "<probe>" ...] --text
```

`--text` prints the footer itself: paste it verbatim as the last thing in the response. Use it for Forms A and B. For Form C leave `--text` off: the JSON carries the same `text` plus the `menu` the question tool needs. Run `reconcile` first in a session (Work Step 2) so the files it reads are settled.

---

## When it renders, and which form

The **turn type** picks the form, never the map's status. This is the one decision the script cannot make for you.

| Situation | Footer |
|---|---|
| `map.md` exists and the turn **ends the session** — Session End, a cleared map, a fully blocked frontier, a parked grill | **Form A**: the trail, then the resume command |
| `map.md` exists and the turn **asks the human something** — a probe batch, a sketch put up for reaction, a `legwork · HITL` checklist, the Chart Step 2 destination grill, the Chart Step 4 frontier grill | **Form B**: the trail, then the waiting notice. Never a resume command |
| `map.md` exists and the turn **offers the menu after a recorded decision** — the continue-or-stop fork of the Work cadence | **Form C**: the trail, the `OR START FRESH` command, then the question tool |
| Intent Gate (Step 0), the no-fog off-ramp, or any route-and-stop before Step 5 | **None** — no map on disk yet, and no path to resume |

One idea per session, so there is only ever one trail.

### What the script draws (so you can read it, not build it)

```
🧭 audit-log-export · Working · 2/6 cleared
  START ●━●━◉··○··○··⊘··⊝ ····⚑
  ● done · ◉ here · ○ open · ⊘ blocked · ⊝ out of scope · ⚑ destination · ~4 fog
  1 Codebase context ✔ · 2 Export format ✔ · 3 Row-count ceiling ◀ here · 4 Export authorization
  5 Testing posture · 6 Delivery channel (blocked:3) · 7 SIEM push (out of scope)
  Confidence: solid, but Risk is borderline.

WAITING ON YOU · answer here, in this conversation:
Q2 Ceiling behaviour past the cap (re-ask) · Q3 Who sees the truncation warning
```

- The heading counts resolved questions over every question except out-of-scope ones.
- One glyph per question in `NN` order: `●` resolved, `◉` claimed, `○` open, `⊘` blocked, `⊝` out of scope. A solid `━` leads into a walked stop (`●`, `◉`); `··` leads into one still ahead. `····⚑` stands for the fog; with no fog the path ends `━⚑` once every stop is walked (or ruled out) and `··⚑` while any is still ahead. A cleared map ends `━⚑  arrived` and drops both legend lines.
- The named legend numbers stops by position, and `(blocked:3)` points at stop 3.
- The confidence line is the map's four internal scores reduced to plain English: `solid` (all ≥ 20), `solid, but <Dimension> is borderline` (all ≥ 18, some at 18-19), `not yet — <Dimension(s)> still need work` (any < 18). The raw numbers never reach the human. No `**Confidence:**` line on the map, no confidence line in the trail.

---

## Form A — the turn ends the session

The command follows the map's status: `/plan2code-0-pathfinder specs/<idea>/pathfinder --web` while `Charting` / `Working`; `/plan2code-1-plan --web` once `Cleared`; and `/plan2code-init` first when `## Ground rules` records `AGENTS.md` absent and it still is. The path is the exact argument Auto-Discovery resolves an idea from, so the human pastes it back with zero edits.

## Form B — the turn asks the human something

Pass every outstanding item as `--item`, at its stable number (`--item "Q1 Duration model"`), so a partial reply is cheap and a dropped probe is visible to both of you. The script refuses more than three: the three-probe cap.

**Emit no resume command on a Form B turn.** There is nothing to resume — the session is alive and holding a claim. A resume command here reads as *we're done*, and the human either walks away mid-decision or burns the next turn asking what you meant. This is the single most common way the footer misfires, and it costs the batch the round trips batching was introduced to save.

One exception: `grilling.md`'s unreachable-human procedure. Parking a mid-grill question and stopping IS a session end — use Form A, and say in the body that the question is parked mid-grill with its batch outstanding.

## Form C — the menu after a recorded decision

Used ONLY on the Work cadence's fork-menu turn (resolve.md §Cadence), immediately after `resolve` recorded an `## Answer`. The script refuses it while a question is claimed or once the map is `Cleared`. Pass `--resolved-this-session <N>`, and `--heavy` when the decision just recorded was heavy, contested, or `Locked: yes`.

It prints the stop branch, labeled `OR START FRESH · new conversation, paste:`, and returns `menu`: the header, the question text, up to three takeable questions plus `Start fresh`, and which option to mark `RECOMMENDED` (a question early in the session; `Start fresh` after ~3 resolved or a heavy decision, with the reason in the question text, "to keep me sharp").

Then invoke the structured question tool with that menu. Put each question's gist or newly-unblocked note (from `resolve`'s `unblocked`) in its description. The automatic `Other` path lets the human name a frontier question not shown (`menu.more`).

Rules for Form C:

- **The command label is mandatory and exact.** It makes the command the stop branch, not a farewell. Never render a bare command on a menu turn.
- **The choice itself always uses the structured tool.** Never print `NEXT UP` as a prose menu when the tool exists.
- **Form C never replaces Form B.** A turn that asks probes, shows a sketch, or hands over a checklist is Form B, no command. Form C fires only between decisions, when nothing is claimed.
- If the human walks away mid-menu, nothing is stranded: no claim is open, and the command to come back is already on screen.

---

## Discipline

- **Never print a bare resume command on a turn that asks a question.** Before you choose the form, ask whether the response above it ends with something for them to answer: mid-question (probes, sketch, checklist) → Form B, no exceptions but the parked-grill one; between decisions at the fork-menu → Form C.
- **Draw it, never type it.** A hand-built trail drifts from the files; the script reads them every time. If the trail disagrees with the checklist above it, run `reconcile`, but only at session start or while nothing is claimed: `reconcile` resets a claim with no answer to `open`, so mid-question it would drop your own live claim. With a claim open, finish that question instead; `resolve` rebuilds the checklist, and the next trail is drawn from it. On `github` (the script cannot read the tracker), build it by hand from the sub-issue query, following "What the script draws" exactly.
- **One trail.** Never render two ideas' trails, and never invent a stop the map does not list.
