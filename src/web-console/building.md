# Build Sessions on the Web Console

For `/plan2code-3-implement`, `/plan2code-3-implement-review` and
`/plan2code-quick-task`. Read `console.md` first: everything there still
applies (the wait loop, one post per send, `finish` before `stop`, the house
rules). This file adds what a build needs, because a build is mostly you
working, and the page has to be told so.

**The console changes where you ask, not what you build.** Every rule of the
workflow stands: the same specs, the same checkbox writes to disk after every
task, the same sign-off wording, the same "no git commands". The files under
`specs/` and the code are the record. The page is a window onto them.

---

## Opening

Open first, before reading the spec — the page shows a starting screen while
you work out the phase:

```
node "<CONSOLE>" open --workflow implement
```

| Workflow you are running | `--workflow` | `--spec` |
| --- | --- | --- |
| `/plan2code-3-implement` | `implement` | `specs/<feature>` |
| `/plan2code-3-implement-review` | `implement-review` | `specs/<feature>` |
| `/plan2code-quick-task` | `quick-task` | leave it out |

`--spec` is what the page builds a resume command from if you ever cannot
answer a stop yourself. Pass it to `open` when you already know the spec;
otherwise post `"specDir": "specs/<feature>"` and a real `title` ("<feature>:
Phase 3") in your first update, once the phase is chosen, or with the phase
question as its first item if there is one to ask. `--file` works on `open`
too, but opening bare and posting the task list as your first update gets
them the page while you are still composing.

**Launched from the dashboard?** Then the session is already open and the
person is watching it — `open --resume <sid> --no-open --workflow <yours>`
(plus `--spec` once known) instead of a fresh `open`, exactly as console.md →
Launches says. Everything below is unchanged; the only difference is whose
session it was a minute ago.

The first payload for a phase you are about to build:

```jsonc
{
  "headline": { "stage": "Phase 3: API layer", "cleared": 0, "total": 9 },
  "docs": [
    { "id": "phase", "title": "Phase 3 tasks", "version": 1, "blocks": [
      { "id": "tasks", "state": "settled", "md": "- [ ] **Task 3.1:** ...\n- [ ] **Task 3.2:** ..." }
    ]},
    { "id": "phasefile", "title": "phase-3.md", "version": 1, "blocks": [
      { "id": "body", "state": "settled", "md": "...the whole phase-3.md file, verbatim..." }
    ]}
  ],
  "agent": { "status": "working", "activity": "Checking the prerequisites", "quietMinutes": 15 }
}
```

`headline.cleared` / `total` are tasks done out of tasks in the phase: the
progress bar is the first thing someone watching a build looks at.

`phasefile` is the whole `phase-X.md`, verbatim from disk, as its own tab —
the person can read the prerequisites and task specs while you build. Re-post
it whenever the file changes, which is every task: the checkbox write that
ticks the list above ticks the file too, and the Phase Completion Summary
lands in it at the end. It renders as markdown, so the file's checkboxes show
as ticks exactly as they stand on disk.

---

## While you build

Post after every task, in the same breath as writing its checkbox to disk.
Write the patch file into the session's own folder (the `session` path `open`
printed), never into the project or into `~/.plan2code/console/` directly:

```jsonc
{
  "headline": { "cleared": 4 },
  "docs": [
    { "id": "phase", "version": 5, "blocks": [ { "id": "tasks", "state": "settled", "md": "...the whole list, 4 ticked..." } ] },
    { "id": "phasefile", "version": 5, "blocks": [ { "id": "body", "state": "settled", "md": "...phase-3.md as it now stands on disk..." } ] }
  ],
  "agent": { "activity": "Task 5 of 9: the rate limiter" }
}
```

- **`activity`** is one plain sentence saying what you are doing now. The page
  shows it beside Planny and in place of "questions coming". No internal
  vocabulary, no loop completion markers. Number tasks by their position in
  the phase, of the phase's task count (`Task 5 of 9`), not by the file's
  `5.5`-style labels: the phase is already in the headline. The page rewrites
  the old form as a safety net.
- **`quietMinutes`** is how long you might go without posting (1 to 60). The
  page calls a working agent stuck after two minutes of silence unless you say
  otherwise, and a build task can honestly take twenty. Set it to the longest
  gap you expect, usually 10 to 30. Every post is also a heartbeat. **Clear it
  (`"quietMinutes": null`) whenever you go back to waiting**: it only counts
  while you are `working`, but leaving it set invites a stale value later.
- `blocks` inside a doc are replaced whole, so post the whole task list each
  time. It is small. The same goes for `phasefile`: re-read `phase-X.md` and
  post it fresh, because the checkbox write just changed it.
- If the task list grows mid-build, raise `headline.total` in the same post;
  the page never shows more done than the total, but the bar reads truer when
  you keep it current.
- Do not call `wait` while building. There is nothing to collect, and the page
  holds anything the person sends until you next look.

### Quick questions between tasks

The person can ask a Quick question on the Ask tab at any point in a build
(console.md → Quick questions). After each task's progress post, check for
one before starting the next task:

```
node "<CONSOLE>" chat --session <sid>
```

| Exit | What you do |
| --- | --- |
| `0` | Answer everything waiting, under console.md → Quick questions, in one post, then start the next task. A `workspace` list in the output is a change to the session's folders (console.md → Workspace): take it into account from the next task on; it needs no reply. |
| `10` | Nothing waiting. Carry on. |
| `20` | The server is gone: `open --resume <sid>` as usual, then carry on. |

This is an instant check, not a wait: it never sleeps and never touches card
sends. It does not replace `wait` at a gate, and no build calls `wait`
mid-build for cards. An approved chat edit is made here, between tasks, never
in the middle of one.

A blocker (`[!]`), a `SPEC NOTE` and a verified or assumed prerequisite are
not questions. Put them in the phase doc as they happen, and in the report.

### When the workflow asks something

Publish it, set `"agent": { "status": "waiting", "quietMinutes": null }` in
the SAME post, and go into the wait loop. When the answer lands, set `working`
again and carry on.

A question stops the build. Never leave yourself `working` with a question
open, and never "carry on while you decide": the page reads `working` as "not
your turn", and the person is left looking at a question they cannot answer.
If there is other work the answer does not touch, finish it before you ask,
then ask and wait.

| Moment | `kind` | Notes |
| --- | --- | --- |
| Several phases can be picked | `choice` | One option per phase, `detail` = status and task count, `token` = the phase number. Put the "run another agent on a different phase" tip in `body`. |
| A phase is already in progress | `confirm` | "Resume Phase 3?" `yes` / `no`. |
| `SPEC CONFLICT` | `choice` or `text` | The conflict in `body`, the readings as options where there are clear ones. Never guess on architecture. |
| Test failures | `choice` | `1` Fix now, `2` Document and proceed, `3` Investigate first. |
| A small phase, continue with the next? | `confirm` | |
| A spec gap only they can close | `text` | |
| Something learned for AGENTS.md | `confirm` | The proposed lines in `consequences`. |

Titles stay plain: "Which phase next", "Tests are failing", "Keep going?".

---

## Sign-off

Put the Completion Report on the page as a doc, then ask for approval as a
`review` item pointing at it. The review offer rides on this card, as a verdict
ahead of the approval buttons — not on the finish after it, where it could
only ever be offered once nothing could come of it:

```jsonc
{
  "docs": [{ "id": "report", "title": "Completion report", "version": 1, "blocks": [
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
    "token": { "review": "review", "approve": "approved", "changes": "needs changes" },
    "nothingYet": "Nothing is marked complete until you approve.",
    "gate": { "id": "signoff", "authoritative": true },
    "fallbackText": "Reply \"approved\" to mark this phase complete, \"review\" to run the code review first, or describe any issues."
  }],
  "agent": { "status": "waiting", "quietMinutes": null }
}
```

`reply` carries `Approve this phase: approved`, which is the terminal's
`approved`. If the note that came with an approval asks for a change, treat it
as "describe any issues": do the change first and ask again. `changes` means
exactly what it says: address it, bump the report's version, and reopen the
item (`"status": "reopened"`) with a reply in its `thread`. `review` is the
person asking for the code review before they approve anything — see "The
review, mid-session" below.

`gate` marks the one approval that counts. The server refuses a second open
authoritative gate, which is what keeps a composed workflow from asking for
sign-off twice.

---

## After approval: the finish

Do everything the workflow does on approval (the checkboxes, the summary, the
upcoming phases, the commit command) and print it in the terminal as usual.
Then post the finish, wait for the dashboard button as console.md → Finishing
says, and `stop`:

```jsonc
{
  "items": [{ "id": "signoff", "status": "answered", "answer": { "verdict": "approve" } }],
  "run": { "event": "implement-phase", "id": "phase-3", "tasks": 9 },
  "finish": {
    "headline": "Phase 3 is done",
    "body": "9 of 9 tasks, all on disk.\n\n| Phase | Tasks | Goal |\n| --- | --- | --- |\n| Phase 4: ... | 6 | ... |\n\nCommit it with:\n\n```\ngit add -A && git commit -m \"...\" -m \"AI Assisted\"\n```",
    "command": "/plan2code-3-implement specs/lunch-vote/overview.md",
    "doc": "report",
    "dashboard": true
  },
  "agent": { "status": "waiting" }
}
```

`finish.command` is the next pipeline step, the same one the terminal names:
the next `/plan2code-3-implement`, or `/plan2code-4-finalize` after the last
phase. An `implement` finish never carries `review`: the offer was on the
sign-off card, and approving past it was the answer. `implement-review` ends
the same way; that phase was reviewed already. Only a finished `quick-task`
still offers the review on its finish — see below.

`run` scores the approved phase on the session meter (console.md → Posting an
update → Session meter), in the same post that records the approval:
`implement-phase` for Implement, `implement-review-phase` for Implement +
Review, id `phase-N`, and `tasks`: how many of the phase's tasks were
completed (`[x]`, not blocked `[!]`). The phase scores by its size, so a
twelve-task phase weighs four times a three-task one; leave `tasks` out and
every phase weighs the same. Quick task and a standalone Review are counted when
their session opens, so they post no `run` for that; a review run on the page
after a build reports its own (below).

---

## The review, mid-session

The same focused review runs from either of two doors:

- **`implement`:** the `review` verdict on the sign-off card, before anything
  is approved. A note sent with it is theirs — read it as focus for the
  review. Settle the card with it in the same post that goes back to work:

  ```jsonc
  {
    "items": [{ "id": "signoff", "status": "answered", "answer": { "verdict": "review" } }],
    "headline": { "stage": "Reviewing Phase 3", "cleared": 0, "total": 0 },
    "run": { "event": "review", "id": "review" },
    "agent": { "status": "working", "activity": "Reviewing the 7 files this phase changed", "quietMinutes": 15 }
  }
  ```

- **`quick-task`:** the **Review it now** button on the finished screen, which
  `finish.review` puts there. It arrives through the wait loop as an action
  `{ "i": "__review", "type": "review" }`, like any send. Take it up with the
  same post minus the `items` line, plus `"finish": null` — that takes the
  session off its ending and back to work.

Either way, the post that takes the review up carries `"run": { "event":
"review", "id": "review" }`: the review runs inside this skill's session, so no
launch scores it on the session meter. Never resume the session under
`--workflow review` for it as well, or it counts twice.

A finish carrying `review` keeps the session alive for the answer, so a
`quick-task` that just posted one keeps waiting, for up to about ten minutes.
A quick-task finish carries both `review` and `"dashboard": true` and waits
for whichever comes first:

| What arrives | What you do |
| --- | --- |
| An action `{ "i": "__review", "type": "review" }` | Take the review up (below). |
| An action `{ "i": "__dashboard", "type": "dashboard" }` | Take the session back as the dashboard (console.md → Finishing). |
| An action `{ "i": "__done", "type": "done" }` | `stop` the server. The session is over. |
| `wait` exit `20` | The server is gone, not necessarily the tab. Resume it (`open --resume <sid> --no-open --workflow <yours>`) and keep waiting. |
| Nothing after about ten minutes | `stop` the server. The page then shows the terminal command for a review instead of a button that would go nowhere. |

**Read references/review.md** and run Review Mode with these overrides:

- **Scope is Focused, and already decided:** the exact change set of this
  session (files created or modified by the phase or the quick task, plus the
  tests and docs changed for it). Do not ask about scope. Use overview.md and
  the phase file for spec compliance; they do not widen the scope.
- **No commit instructions and no next-conversation routing** mid-review. The
  way back out carries both.
- The page takes the whole report, so the "top 10 of 15+" rule does not apply,
  and tables go in the doc.

### The findings

The full Review Mode report as a doc, and the fix choice as one `multi` item:

```jsonc
{
  "docs": [{ "id": "review", "title": "Review findings", "version": 1, "blocks": [
    { "id": "report", "state": "settled", "md": "## Overview\n\n...\n\n## Findings\n\n| # | Severity | Issue | File |\n..." }
  ]}],
  "items": [{
    "id": "fixes", "kind": "multi", "title": "Which to fix", "required": false, "doc": "review",
    "body": "Tick what should be fixed now. Anything left unticked is written up as still open. Nothing changes until you send.",
    "options": [
      { "k": "1", "text": "Critical: token is logged in plain text", "detail": "src/auth.ts:42. Fix: redact before logging." },
      { "k": "2", "text": "Warning: missing null check on the user lookup", "detail": "src/users.ts:88. Fix: ..." },
      { "k": "3", "text": "Suggestion: repeated query could be batched", "detail": "src/report.ts:17. Fix: ..." }
    ],
    "presets": [
      { "label": "Critical and warnings", "ks": ["1", "2"] },
      { "label": "All of them", "ks": ["1", "2", "3"] }
    ],
    "token": { "1": "1", "2": "2", "3": "3" },
    "fallbackText": "Reply H to fix Critical + Warning findings, A to fix all findings, or S 1,3,5 to fix specific findings."
  }],
  "agent": { "status": "waiting", "quietMinutes": null }
}
```

`"doc": "review"` puts a **Read "Review findings" in full** button on the
card, so the report is one click from the list rather than behind a tab
nobody notices. Always carry it.

Read the reply as Review Mode's fix choice: `Which to fix: 1, 2` is `S 1,2`,
every finding ticked is `A`, and `skip` (or nothing ticked) is "fix none,
keep them as unresolved". Leave out `presets` a set would not change (no
warnings, one finding). With **zero findings** there is no item: say so in the
doc and go straight to the way back out.

### Fixing

Settle the `fixes` item in the same post that goes back to work —
`"status": "answered"` with the `answer` they sent (`{ "ks": ["1", "2"] }`,
or `{ "ks": [] }` when nothing was ticked). The server records their send on
the item, but only you decide it is settled; left open it stays on the page
as an outstanding question, beside the card you ask next. Then follow Review
Mode's Post-Fix Flow, posting `activity` per fix ("Fix 2 of 3: the null
check") and `quietMinutes` as in a build.

### The way back out

**`implement` — back to the sign-off.** The review was the preamble to an
approval that has not happened yet, so this is where it lands. Fold the review
results and any still-open findings into the report doc and bump it, then
reopen the sign-off **without the review verdict** — re-offering a review that
just ran reads as though nothing happened:

```jsonc
{
  "items": [{ "id": "signoff", "status": "reopened",
    "body": "Reviewed and ready for sign-off. The review found 3 issues: 2 fixed, 1 still open in the Review findings tab. The report is updated.",
    "verdicts": [
      { "id": "approve", "label": "Approve this phase" },
      { "id": "changes", "label": "I want changes" }
    ],
    "thread": [{ "who": "agent", "text": "Review done: 2 of 3 findings fixed; the rest is written up in the findings tab." }]
  }],
  "agent": { "status": "waiting", "quietMinutes": null }
}
```

Review Mode's own closing gate ("Reply approved to commit") is this card:
approving the phase now covers the fixes too, so there is no separate "Check
the fixes" step. On approval, continue at "After approval: the finish".

**`quick-task` — the closing gate, then the finish.** Review Mode's closing
gate ("Reply approved to commit, or request changes") becomes a `review` item
titled "Check the fixes", `doc: "review"`, verdicts `approve` ("The fixes look
right") and `changes`, token `approved` / `needs changes`. When it clears,
settle it in the same post as the new finish — `"status": "answered"` plus
`"answer": { "verdict": "approve" }` (or `"changes"`) — post the finish
**without** `review`, then `stop`. An item left open survives on the page as
a question still owed, above the ending itself:

- `headline`: "The review is done"
- `body`: findings by severity, what was fixed, what is still open, and the
  commit command for the fixes, in the project's commit format.
- `command`: the same next step as the finish before it.
- `doc`: `"review"`.

---

## Implement + Review (`implement-review`)

The same build, then Stage 2 publishes the findings exactly as above (the
`review` doc and the `fixes` item). Stage 3 fixes, with no "Check the fixes"
item: Stage 4 is the only gate. Stage 4 is the sign-off above **without the
review verdict** — the phase was already reviewed — with the review results
and unresolved findings in the report doc, header "Reviewed and ready for
sign-off" in the item's `body`. The finish never carries `review`, and its
post carries `"run": { "event": "implement-review-phase", "id": "phase-N", "tasks": N }`
with the count of completed tasks.

---

## Quick task (`quick-task`)

- Open with the first clarifying question. Clarifying questions go out as
  `text` or `choice`, at most three at a time.
- Post `"stopWarning": "A quick task saves nothing until it is built, so stopping now loses what we have worked out."`
  at the start, and `"stopWarning": ""` once the build is under way.
- **Scope check:** a `choice`, "Too big for a quick task?", options
  `1` Continue (lightweight format) and `2` Escalate to a full plan, with the
  measured counts against the thresholds in `body`.
- **Feature name** (escalating): `text` with
  `"pattern": "^[a-z0-9]+(-[a-z0-9]+)*$"` and a kebab-case placeholder.
- **The plan:** a `plan` doc (Summary, Files to change, Steps, Verify) and a
  `review` item "Build this plan?" with verdicts `yes` ("Build it"), `modify`
  ("Change the plan"), `escalate` ("Plan it properly instead") and `abort`
  ("Stop here", `"danger": true`), token equal to the ids.
- **Building** after `yes`: settle the verdict (`"status": "answered"` plus
  `"answer": { "verdict": "yes" }`) in the post that starts the build, and
  open a **Build progress** tab in that same post, the way an Implement phase
  gets its tasks tab. The plan's steps are the task list and `total` is their
  number:

  ```jsonc
  {
    "stopWarning": "",
    "items": [{ "id": "<the Build this plan? item's id>", "status": "answered", "answer": { "verdict": "yes" } }],
    "headline": { "stage": "Building", "cleared": 0, "total": 4 },
    "docs": [{ "id": "tasks", "title": "Build progress", "version": 1, "blocks": [
      { "id": "tasks", "state": "settled", "md": "- [ ] Step one\n- [ ] Step two\n- [ ] Step three\n- [ ] Step four" }
    ]}],
    "agent": { "status": "working", "activity": "Step 1 of 4: step one", "quietMinutes": 10 }
  }
  ```

  Then post after every step, exactly as "While you build": bump the doc's
  `version` and repost the whole list with that step ticked, raise
  `headline.cleared`, and set `agent.activity` to the next step ("Step 2 of 4:
  step two"). Never go silent for the whole build: a quick task with many steps
  is the case this tab is for. Check for a Quick question between steps, and do
  not call `wait` until the build is done.
- **The finish after the build:** `command` is the commit command, filled in,
  in the project's commit format (AGENTS.md), with
  `"where": "When you are happy with it, commit it from your terminal:"`, and
  `review` on offer — the **Review it now** button, since a quick task has no
  sign-off card to put it on — and `"dashboard": true`, so the finished screen
  also offers **Back to the dashboard**. Both are required: a finish without
  `dashboard` leaves the person on a dead end. Keep waiting for whichever
  button is pressed, and everything after that is "The review, mid-session"
  above.
- **Escalated / aborted:** settle the verdict the same way in the finish post —
  finish with `"command": "/plan2code-1-plan"` and the
  PLAN-DRAFT's path in `body`, no review; or `"command": "/plan2code-quick-task"`.
  Both set `"dashboard": true`: an abort of a quick task saves nothing to
  resume, so it is not a pause.

---

## Stop requests during a build

The Stop button only works on the person's turn, so it never lands mid-task.
When `__stop` arrives:

- **implement / implement-review:** Implementation Mode's abort, without the
  "are you sure" (the page asked): the phase stays `[/]`, list completed and
  remaining tasks, post `finish` with the resume command
  (`/plan2code-3-implement specs/<feature>/overview.md`), then `stop`. An
  implement abort is a pause: a headline starting "Paused", no `dashboard`,
  `stop` at once.
- **quick-task:** say in `finish.body` what was worked out, and that nothing was
  saved unless it was built; `"command": "/plan2code-quick-task"`.

A mid-build `__dashboard` (the top bar's triangle, console.md → Stop requests →
"Back to the dashboard, mid-workflow") lands the same way, only on the person's
turn. Save exactly as for `__stop` above (an implement phase stays `[/]`), but
post no finish and do not `stop`: resume as the dashboard instead, with one
terminal line naming what was saved and the resume command.
