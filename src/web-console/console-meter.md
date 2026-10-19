# The Session Meter on the Web Console

Part of the web console contract (`console.md`). Your workflow notes give the
exact `run` to post; read this only if one is refused.

### Session meter

The page's top bar shows a meter of how much work this console session has
done (green, yellow, red), so the person knows when a fresh session would be
sharper. It is advice only and never blocks anything. The console counts
launches itself: Plan, Revise plan, Document, Review, Quick task, Init, Init
update, Finalize, Git, Changelog, X-ray and Diagnose score when their session opens, and there is nothing to
post for them.

It counts answers itself too: every card the person answers in a send adds to
the skill run's tally when `wait` hands the send to you, and every 2 answers
score a point, so a long back-and-forth weighs more than a short one. Notes,
Quick questions and buttons such as Stop or the dashboard do not count.

Per-unit work is yours to report, with `run` in any post:

```jsonc
{ "run": { "event": "implement-phase", "id": "phase-2", "tasks": 9 } }
```

- `event` is one of `pathfinder-chart`, `pathfinder-question` (scores
  nothing now: answers count instead), `pathfinder-research`, `plan`,
  `revise-plan`, `document`, `implement-phase`, `implement-review-phase`,
  `review`, `quick-task`, `init`, `init-update`, `finalize`, `handoff`,
  `git`, `changelog`, `xray`, `diagnose`, `git-commits` and `git-conflict` (Git's own, see
  `notes/git.md`).
  An unknown event is exit `3`. Post only the events your notes name: a skill
  that scores when its session opens (the list above this one) already has its
  points, and a `run` for it scores the same work twice.
- `id` names the unit: a question's file slug, `phase-N`, `map`. The same id
  posted again in the same skill run is ignored, so a repeated post never
  counts twice. It must be non-empty.
- `tasks` goes only with `implement-phase` and `implement-review-phase`: the
  number of tasks the phase completed (marked `[x]`; blocked `[!]` tasks do
  not count), a whole number from 1 to 999. A built phase scores by its size,
  one point per 3 tasks rounded up, and Implement + Review one more for the
  review. Always send it: without it a phase scores a flat 2 (or 3), however
  big it was. On any other event it is exit `3`. The console already counts a
  build's tasks from `headline.cleared` as they are ticked off; the phase's
  `run` takes that count over with the final score, so it never counts twice.
- `commits` goes only with `git-commits`: how many commits Git just made, a
  whole number from 1 to 999. A Git run scores one point per 2 commits,
  rounded down; on any other event it is exit `3`.
- One `run` per post. Which events a workflow reports is in its own notes
  (`notes/pathfinder.md`, `notes/git.md`; `building.md` for Implement and for
  the review run on the page after a build).

`run` never reaches the page state: `post` (and `open --file`) lift it into the
session's ledger.

---
