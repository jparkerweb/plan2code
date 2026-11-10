# The Session Meter

Read only if a `run` was refused; your workflow notes give the exact `run` to post.

The meter is advice and never blocks. The console scores these launches itself when their session opens (post nothing for them): Plan, Revise plan, Document, Review, Quick task, Init, Init update, Finalize, Git, Changelog, X-ray, Diagnose, PR Prep, Test. It also counts answers: every 2 cards answered in a send add a point; notes, Quick questions and buttons do not count.

Per-unit work is yours: `{"run":{"event":"implement-phase","id":"phase-2","tasks":9}}`, one `run` per post, never reaching the page state.

- `event`: `pathfinder-chart`, `pathfinder-question` (scores nothing now), `pathfinder-research`, `plan`, `revise-plan`, `document`, `implement-phase`, `implement-review-phase`, `review`, `quick-task`, `init`, `init-update`, `finalize`, `handoff`, `git`, `changelog`, `xray`, `diagnose`, `pr-prep`, `test`, `dead-code`, `git-commits`, `git-conflict`. An unknown event is exit 3. Post only the events your notes name: a launch the console scores already has its points.
- `id`: the unit (a question's slug, `phase-N`, `map`), non-empty. The same id in the same skill run is ignored.
- `tasks`: only with `implement-phase` and `implement-review-phase`; the tasks completed (`[x]`, not blocked), a whole number 1 to 999. A phase scores one point per 3 tasks rounded up (Implement + Review one more for the review); without it, a flat 2 (or 3). It takes over the count from `headline.cleared`, never adding to it.
- `commits`: only with `git-commits`; commits made, 1 to 999, one point per 2 rounded down.
