# Implement on the Web Console

Workflow notes for `implement` and `implement-review`, part of the web console
contract (`console.md`). Read `building.md` first.

## The first post of a phase

```jsonc
{
  "headline": { "stage": "Phase 3: API layer", "cleared": 0, "total": 9 },
  "docs": [
    { "id": "phase", "title": "Phase 3 tasks", "blocks": [
      { "id": "tasks", "file": "specs/<feature>/phase-3.md", "select": "tasks" }
    ]},
    { "id": "phasefile", "title": "phase-3.md", "blocks": [
      { "id": "body", "file": "specs/<feature>/phase-3.md" }
    ]}
  ],
  "agent": { "status": "working", "activity": "Checking the prerequisites", "quietMinutes": 15 }
}
```

`phase` is the task list, `phasefile` the whole `phase-X.md` as its own tab —
the person can read the prerequisites and task specs while you build. Both are
read from disk by the console: never paste the file. It renders as markdown, so
the file's checkboxes show as ticks exactly as they stand on disk.

A later phase in the same session posts the same two docs with the new phase's
title and file: their content changed, so their versions move up by themselves
(a doc's version never goes back, and you no longer have to track it). Leave
`version` out.

## After every task

In the same breath as writing the task's checkbox to disk:

```jsonc
{
  "headline": { "cleared": 4 },
  "docs": [ { "id": "phase", "refresh": true }, { "id": "phasefile", "refresh": true } ],
  "agent": { "activity": "Task 5 of 9: the rate limiter" }
}
```

`refresh` re-reads the file the checkbox write just changed, so both tabs tick
in place; the Phase Completion Summary lands in `phasefile` the same way at the
end. Then the `chat` check (`building.md` → Quick questions between tasks).

---

## Sign-off

Put the Completion Report on the page as a doc, then ask for approval as a
`review` item pointing at it. The review offer rides on this card, as a verdict
ahead of the approval buttons — not on the finish after it, where it could
only ever be offered once nothing could come of it:

```jsonc
{
  "docs": [{ "id": "report", "title": "Completion report", "blocks": [
    { "id": "summary", "state": "settled", "md": "## Summary\n\n..." },
    { "id": "files", "state": "settled", "md": "## Files\n\n..." },
    { "id": "verify", "state": "settled", "md": "## How to check it\n\n..." }
  ]}],
  "items": [{
    "id": "signoff", "kind": "review", "title": "Approve this phase", "doc": "report",
    "body": "Phase 3 is built. Read the report, try the checks, then approve it, review the code first, or say what to change.",
    "verdicts": [
      { "id": "review", "label": "Review the code first" },
      { "id": "approve", "label": "Approve this phase" },
      { "id": "changes", "label": "I want changes" }
    ],
    "token": { "approve": "approved", "changes": "needs changes" },
    "nothingYet": "Nothing is marked complete until you approve.",
    "gate": { "id": "signoff", "authoritative": true }
  }]
}
```

Posted with `--wait`. `reply` carries `Approve this phase: approved`, which is
the terminal's `approved`. If the note that came with an approval asks for a
change, treat it as "describe any issues": do the change first and ask again.
`changes` means exactly what it says: address it, update the report, and reopen
the item (`"status": "reopened"`) with a reply in its `thread`. `review` is the
person asking for the code review before they approve anything — read
`building-review.md`.

`gate` marks the one approval that counts. The server refuses a second open
authoritative gate, which is what keeps a composed workflow from asking for
sign-off twice. A later phase in the same session asks with a new id
(`signoff-phase-2`, its title naming the phase, "Approve Phase 2", so the rail tells
the two apart), since the last phase's approved card is a record: the same
id posted again would only edit that record.

---

## After approval: the finish

Do everything the workflow does on approval (the checkboxes, the summary, the
upcoming phases, the commit command) and print it in the terminal as usual.
Then post the finish, wait for the dashboard button as `console-finish.md`
says, and `stop`:

```jsonc
{
  "settle": true,
  "run": { "event": "implement-phase", "id": "phase-3", "tasks": 9 },
  "finish": {
    "headline": "Phase 3 is done",
    "body": "9 of 9 tasks, all on disk.\n\n| Phase | Tasks | Goal |\n| --- | --- | --- |\n| Phase 4: ... | 6 | ... |\n\nCommit it with:\n\n```\ngit add -A && git commit -m \"...\" -m \"AI Assisted\"\n```",
    "command": "/plan2code-3-implement specs/lunch-vote/overview.md",
    "doc": "report",
    "commit": true,
    "dashboard": true
  }
}
```

`"commit": true` is there because the body prints a git command: the finished
screen gets a **Commit it now** button, and its `__commit` press is handled as
`console-finish.md` says (resume as `git` and open its commit flow, same
session). Leave it out when the body prints no commit.

`finish.command` is the next pipeline step, the same one the terminal names:
the next `/plan2code-3-implement specs/<feature>/overview.md`, or
`/plan2code-4-finalize specs/<feature>/overview.md` after the last phase. An `implement` finish never carries `review`: the offer was on the
sign-off card, and approving past it was the answer. `implement-review` ends
the same way; that phase was reviewed already.

`run` gives the approved phase its final score on the session meter
(`console-meter.md`), in the same post that records the approval; it takes over
what the build already counted from `cleared`, never adds to it:
`implement-phase` for Implement, `implement-review-phase` for Implement +
Review, id `phase-N`, and `tasks`: how many of the phase's tasks were
completed (`[x]`, not blocked `[!]`). The phase scores by its size, so a
twelve-task phase weighs four times a three-task one; leave `tasks` out and
every phase weighs the same. A review run on the page after a build reports its
own (`building-review.md`).

---

## Implement + Review (`implement-review`)

The same build, then Stage 2 publishes the findings exactly as
`building-review.md` → The findings (the `review` doc and the `fixes` item).
Stage 3 fixes, with no "Check the fixes" item: Stage 4 is the only gate. The
post that starts Stage 2's review carries `"run": { "event": "review", "id":
"review" }`: in this workflow it scores the review stage's 1 point on the meter
as it begins, and the phase's final `run` leaves that point out. Stage 4 is the
sign-off above **without the review verdict** — the phase was already reviewed
— with the review results and unresolved findings in the report doc, header
"Reviewed and ready for sign-off" in the item's `body`. The finish never
carries `review`, and its post carries `"run": { "event":
"implement-review-phase", "id": "phase-N", "tasks": N }` with the count of
completed tasks.
