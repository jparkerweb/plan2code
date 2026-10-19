# The Review, Mid-Session, on the Web Console

Part of the build contract (`building.md`). Read when the person asks for the
review on the page: the `review` verdict on Implement's sign-off card, the
**Review it now** button on a finished quick task, or Implement + Review's
Stage 2.

The same focused review runs from either of two doors:

- **`implement`:** the `review` verdict on the sign-off card, before anything
  is approved. A note sent with it is theirs — read it as focus for the
  review. Settle the card with it in the same post that goes back to work:

  ```jsonc
  {
    "settle": true,
    "headline": { "stage": "Reviewing Phase 3", "cleared": 0, "total": 0 },
    "run": { "event": "review", "id": "review" },
    "agent": { "status": "working", "activity": "Reviewing the 7 files this phase changed", "quietMinutes": 15 }
  }
  ```

- **`quick-task`:** the **Review it now** button on the finished screen, which
  `finish.review` puts there. It arrives through the wait loop as an action
  `{ "i": "__review", "type": "review" }`, like any send. Take it up with the
  same post minus `settle`, plus `"finish": null` — that takes the session off
  its ending and back to work.

Either way, the post that takes the review up carries `"run": { "event":
"review", "id": "review" }`: the review runs inside this skill's session, so no
launch scores it on the session meter. Never resume the session under
`--workflow review` for it as well, or it counts twice.

A finish carrying `review` keeps the session alive for the answer, so a
`quick-task` that just posted one keeps waiting — there is no timeout after
a finish.
A quick-task finish carries both `review` and `"dashboard": true` and waits
for whichever comes first:

| What arrives | What you do |
| --- | --- |
| An action `{ "i": "__review", "type": "review" }` | Take the review up (below). |
| An action `{ "i": "__dashboard", "type": "dashboard" }` | Take the session back as the dashboard (`console-finish.md` → After the finish). |
| An action `{ "i": "__done", "type": "done" }` | `stop` the server. The session is over. |
| `wait` exit `20` | The server is gone. Resume it (`open --resume <sid> --workflow <yours>`), give them the new link, and keep waiting. |
| The session ends without a press (the terminal closes) | The server sweeps itself after its idle window; the page then shows the terminal command for a review instead of a button that would go nowhere. |

**Read references/review.md** and run Review Mode with these overrides:

- **Scope is Focused, and already decided:** the exact change set of this
  session (files created or modified by the phase or the quick task, plus the
  tests and docs changed for it). Do not ask about scope. Use overview.md and
  the phase file for spec compliance; they do not widen the scope.
- **The helper rule still applies:** a fresh helper runs the analysis when
  available, you verify every finding, and the report carries its Reviewed by
  line.
- **No commit instructions and no next-conversation routing** mid-review. The
  way back out carries both.
- The page takes the whole report, so the "top 10 of 15+" rule does not apply,
  and tables go in the doc.

## The findings

The full Review Mode report as a doc, and the fix choice as one `multi` item,
posted with `--wait`:

```jsonc
{
  "docs": [{ "id": "review", "title": "Review findings", "blocks": [
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
    ]
  }]
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

## Fixing

Settle the `fixes` item (`"settle": true`) in the same post that goes back to
work. The server records their send on the item, but only you decide it is
settled; left open it stays on the page as an outstanding question, beside the
card you ask next. A send with nothing ticked settles as `{ "ks": [] }`. Then
follow Review Mode's Post-Fix Flow, posting `activity` per fix ("Fix 2 of 3: the
null check") and `quietMinutes` as in a build.

## The way back out

**`implement` — back to the sign-off.** The review was the preamble to an
approval that has not happened yet, so this is where it lands. Fold the review
results and any still-open findings into the report doc, then reopen the
sign-off **without the review verdict** — re-offering a review that just ran
reads as though nothing happened — and post the build's `headline` back (the
review set it to its own stage):

```jsonc
{
  "headline": { "cleared": 9, "total": 9 },
  "items": [{ "id": "signoff", "status": "reopened",
    "body": "Reviewed and ready for sign-off. The review found 3 issues: 2 fixed, 1 still open in the Review findings tab. The report is updated.",
    "verdicts": [
      { "id": "approve", "label": "Approve this phase" },
      { "id": "show", "label": "Show me it working" },
      { "id": "changes", "label": "I want changes" }
    ],
    "token": { "approve": "approved", "changes": "needs changes", "show": "show me" },
    "thread": [{ "who": "agent", "text": "Review done: 2 of 3 findings fixed; the rest is written up in the findings tab." }]
  }]
}
```

`show` runs as `notes/implement.md` → Show me it working says, then reopens
this card without it. Review Mode's own closing gate ("Reply approved to commit") is this card:
approving the phase now covers the fixes too, so there is no separate "Check
the fixes" step. On approval, continue at `notes/implement.md` → After
approval: the finish.

**`quick-task` — the closing gate, then the finish.** Review Mode's closing
gate ("Reply approved to commit, or request changes") becomes a `review` item
titled "Check the fixes", `doc: "review"`, `"nothingYet": false` (the fixes are already made), verdicts `approve` ("The fixes look
right") and `changes`, token `approved` / `needs changes`. When it clears,
settle it (`"settle": true`) in the same post as the new finish, post the finish
**without** `review` (and with `dashboard: true`), then keep waiting for its
buttons as `console-finish.md` says; `stop` only on `__done`. An item left open survives on the page as
a question still owed, above the ending itself:

- `headline`: "The review is done"
- `body`: findings by severity, what was fixed, what is still open, and the
  commit command for the fixes, in the project's commit format.
- `command`: one commit for the whole quick task, its changes and the fixes
  together, in the project's commit format (not a second command beside the
  first), with `commit: true` so **Commit it now** is still on offer.
- `headline`: the quick task's own again, e.g. `{ "cleared": 4, "total": 4 }`.
- `doc`: `"review"`.
