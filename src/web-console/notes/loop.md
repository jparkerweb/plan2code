# Loop Mode on the Web Console

Workflow notes for Implement and Implement + Review started by the desktop app's
Implementation Loop with `--loop`, part of the web console contract
(`console.md`). Read `building.md` and `notes/implement.md` first: this note says
only where loop mode differs. The app judges the result, so you report and never
approve.

## Flags

- `--loop`: this run is one phase of an unattended loop. The skill's first step
  already ran a plain `open`; run it again now, before any post, as
  `node "<CONSOLE>" open --workflow <implement|implement-review> --spec specs/<feature> --loop`.
  Inside the app it resumes the app's session and locks the page; without it,
  `loopOutcome` and `handledBy` are refused. If it exits 3, the run is not inside
  the app: say "Loop mode runs only inside the Plan2Code desktop app." in the
  terminal and continue as an ordinary run with the person's sign-off. Skip
  nothing below unless that `open` succeeded. Every later `open --resume` in
  this run (the server went away: `chat` or `wait` exit 20) carries `--loop`
  too, as `open --resume <sid> --workflow <yours> --loop`: a resume without it
  unlocks the session, and the `loopOutcome` post is then refused.
- `--phase <N>`: the phase the app is building. Build exactly that one (see
  Choosing the phase); the app refuses a report that names another.
- `--fix <levels>`: a comma list from `critical`, `warning`, `suggestion`, the
  levels to fix in the one fix round. Absent means findings are reported, not
  fixed.
- `--fix smart`: Smart pick. A triage step chooses which findings to fix, in
  place of a level list (see Triage). The one fix round and the fresh re-check
  are unchanged.
- `--guess`: when a task needs a decision the spec does not make, take the best
  guess, mark the task `[?]` with a one-line note as an indented line right under
  it in the phase file (`  - Assumed: what you chose and why`), and carry on. The
  app copies that note into the person's report. Without `--guess`, ask the question as an ordinary open card
  (see Questions and cards).

## What changes in loop mode

- Build the phase `--phase` names, without asking (Choosing the phase).
- No sign-off card, no "Approve this phase", no Show me it working, no Continue
  offer.
- Never run `specs.mjs mark --to done`, and never set `[x]` on the phase in
  `overview.md`. Tasks inside the phase file are still checked off as they
  finish: `[x]`, `[!]` when blocked, `[?]` when assumed.
- Never run `git` in any form (no add, commit, stash, checkout), and never
  `commit-msg.mjs`.
- No Stop-with-handoff, no `__dashboard`, no finish screen: the app ends the
  session.
- Where the prompt would stop and ask, report instead of posting a card:
  - A spec conflict: list it in `conflicts`, report `failed`, reason `conflict`.
  - A blocked prerequisite or task: mark the task `[!]`, list it in
    `tasks.blocked`, report `failed`, reason `blocked`.
  - Failing tests: try one fix, then report `tests.passed: false`, `failed`,
    reason `tests`. Never post the Fix now, Document or Investigate options.
  - A waiting `**Plan change:**` line in the phase's Notes: do not ask Revise
    first or Resume; report `failed`, reason `other`, and say so in `summary`.
- Run only the tests the phase file names, as the Implement prompt's tests rule
  says: a phase task or a task's `Test:` line (a `## Phase Testing` block counts
  when it lists them as tasks). Never the full suite unless the phase file names it.

## Headline stages

Post `headline.stage` as each begins, using only these words: `Build`, `Review`,
`Fixes`, `Re-check`, `Reporting`. The app's strip reads them, and any other word
shows as Build, so do not invent new ones in loop mode. Keep `cleared` and
`total` as in any build.

## Choosing the phase

The phase is N from `--phase N`, whatever `next` in `specs.mjs status` would
pick. Never post the "Resume?" question or the parallel-phase pick. Run
`node "<S>/specs.mjs" status specs/<feature>` and find phase N in `phases`:

- Its `checklist` is `pending` or `in-progress`: build it. Set it in progress with
  `specs.mjs mark <spec> --phase N --to in-progress`, exactly as an ordinary run
  does: that mark is allowed, and only `--to done` is the app's.
- It is `blocked` (`[!]`): build nothing; post a `loopOutcome` with
  `result: "failed"`, `reason: "blocked"`, its `blockedTasks` ids (like `2.4`)
  in `tasks.blocked` and `summary: "Phase N is marked blocked in overview.md"`.
- It is `complete` or `assumed`, or not in the checklist: build nothing; post
  `result: "failed"`, `reason: "other"` and
  `summary: "Phase N is not an open phase in this spec"`.

No `--phase` (an older app): take `next.phase.number` (the first of
`next.options` when `next.action` is `choose`), and when `next.action` is `none`
or `checkoff` post `result: "failed"`, `reason: "other"` and
`summary: "No open phase left in this spec"`.

## Questions and cards the loop handles

- A real question (a decision the spec does not make, without `--guess`) is an
  ordinary open card, waited on with `post --wait` as usual. The app sees it open
  and holds or stops the loop. Do not mark it `handledBy`.
- The review stage's findings pick and the fix confirmation are answered by this
  run itself from `--fix` (with `--fix smart`, from the triage). Post them for the record as settled items with
  `"handledBy": "loop"` and the answer filled in, so the page shows "The loop
  handles this", for example
  `{ "id": "fixes", "kind": "multi", "title": "Which to fix", "options": [ ... ], "status": "answered", "answer": { "ks": ["1", "2"] }, "handledBy": "loop" }`.
- Ask (chat) questions do not arrive while the loop drives. If one does, answer
  it briefly as usual.

## Review, one fix round and the re-check

Implement + Review only. Run the review as `building-review.md` describes. Fix
only the findings at the `--fix` levels, in one round. Then start one fresh
reviewer helper (a new subagent with no memory of the fix round, or a fresh read
when helpers are off) that re-checks only the fixes: each finding at a chosen
level is fixed, and nothing new was introduced. Count what is left, by level,
after the re-check. Suggestions left or newly found on the re-check are listed
but never fail the phase. Do not run a second fix round.

## Triage (`--fix smart`)

Implement + Review only, after the review lists its findings and before the fix
round. Start one fresh triage helper (a new subagent with no memory of the build
or the review, or a fresh read when helpers are off). Its brief holds the
findings, the phase's tasks in `phase-X.md` and the project's `AGENTS.md`. For
each finding it answers `fix` or `skip` with one line of reason, at most 200
characters. Skip is for a finding that is not real once the code is read, is
outside this phase's tasks, contradicts `AGENTS.md` or the spec, or asks for a
change out of proportion to the gain. Every skip carries a reason.

The app stops the phase on any skipped Critical, so the triage must not skip a
Critical it merely dislikes: skip one only when it is plainly not a defect, and
say why. Post the triage's answers for the record as the settled `fixes` item (its `ks` are the findings marked `fix`, posted before the fix round)
(`handledBy: "loop"`), with one `thread` entry per skip carrying its reason.

Then run the one fix round on the findings marked `fix`, and the fresh re-check
of only those fixes, as above. `left` counts the picked findings still open after
the re-check. Smart pick always reports `triage.ran: true` and `review.recheck: true`, even when no finding was raised or none was picked (an empty re-check). The triage runs under the `Review` stage; the stage words do not
change.

## Reporting the outcome

At the end of the run, post once a top-level `loopOutcome`:

```json
{ "loopOutcome": {
  "phase": 2, "result": "passed", "reason": null,
  "summary": "Built the setup screen; 6 of 6 tasks",
  "tests": { "ran": true, "passed": true, "summary": "14 pass" },
  "decisions": ["Kept the old /votes route so existing callers still work"],
  "review": { "ran": true, "recheck": true,
    "fixed": [ { "level": "warning", "title": "Close the file handle", "file": "src/z.js" } ],
    "triage": { "ran": true, "skipped": [ { "level": "warning", "title": "Rename the helper", "file": "src/y.js", "reason": "Outside this phase's tasks" } ] },
    "left": { "critical": 0, "warning": 0, "suggestion": 2 },
    "unfixed": [ { "level": "suggestion", "title": "Name the timer", "file": "src/x.js" } ] },
  "tasks": { "blocked": [], "assumed": ["2.4"] },
  "conflicts": [],
  "subject": "Add the loop setup screen" } }
```

- `result` is `"passed"` only when every task is `[x]` (or `[?]` with `--guess`),
  the named tests pass, and, with review, no Critical or Warning is left at a
  chosen level (every level in Smart pick) after the re-check, and, in Smart pick,
  the triage skipped no Critical (otherwise `failed`, reason `findings`). Otherwise `"failed"`, with the first matching
  `reason`: `tests`, `findings`, `blocked`, `conflict` or `other`. A passed
  outcome has `"reason": null`.
- `review.triage` is present only with `--fix smart`: `ran: true` and `skipped` listing
  every skipped finding with its reason (an empty list when nothing was skipped).
  A picked Critical or Warning still left after the re-check fails the phase with
  reason `findings`. `unfixed` lists only picked findings still open after the
  re-check; skipped findings go only in `triage.skipped` (the app adds them to the
  summary), and the 50-entry limits of the two lists are separate.
- `review.fixed` lists every finding the fix round fixed (an empty list when none,
  or with no review), at most 50.
- `decisions` lists, at most 50, one line of at most 200 characters each, every
  other judgment call this run made on the person's behalf that the spec did not
  settle and the `Assumed:` notes do not already cover: a library or approach
  chosen between real options, scope left out or added, a behavior changed outside
  the task. The person reads these to check the work, so say what you chose and
  why, and leave nothing out because it seems small. Do not list the routine steps
  of building. An empty list means you made none.
- `review.ran` and `review.recheck` are `false` when the run did no review or no
  re-check (plain Implement, or no `--fix` level; never with `--fix smart`). `tasks.blocked` and
  `tasks.assumed` list task ids like `"2.4"`. `conflicts` holds one line per
  spec conflict.
- `subject` is one imperative line under 100 characters saying what changed (it
  becomes the commit subject). `summary` is one line under 200 characters.

The app stamps `loopExpect` into the session as the phase starts: the criteria
it will judge the report by (`review`, `fix` as `"smart"` or the level list,
`guess`). It is the app's field, never yours to post. The console holds every
`loopOutcome` to it, so a report missing a required piece (`review.ran: false`
on a review run, no `review.triage.ran` under Smart pick, a skipped Critical in
the triage, no re-check with fixes chosen, assumed tasks without `--guess`) is
refused at post time with the field named, while the run can still do that
step and repost.

Then post `{"agent":{"status":"waiting"}}` and keep waiting with the usual
bounded `wait` slices until the app ends the session. Never end the turn on text.
If the post is refused (exit 3), fix the field it names and post again.
