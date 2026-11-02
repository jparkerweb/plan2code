# The Review, Mid-Session

The console points here on `__review`, or on a `review` card answered with a verdict. Part of the build contract (`building.md`). The same focused review runs from three doors:

- **`implement`:** the `review` verdict on the sign-off card, before anything is approved. A note sent with it is focus for the review. Settle the card in the post that goes back to work: `{"settle":true,"headline":{"stage":"Reviewing Phase 3","cleared":0,"total":0},"run":{"event":"review","id":"review"},"agent":{"status":"working","activity":"Reviewing the 7 files this phase changed","quietMinutes":15}}`
- **`quick-task`:** the **Review it now** button on the finished screen (`finish.review`), arriving as `__review`. Take it up with the same post minus `settle`, plus `"finish":null`.
- **`implement-review`:** Stage 2 (`notes/implement.md`).

Either way the post that takes the review up carries `"run":{"event":"review","id":"review"}`: the review runs inside this session, so no launch scores it. Never also resume under `--workflow review`, or it counts twice.

A quick-task finish carries `review` and `dashboard:true` and waits for whichever comes first:

| Arrives | Do |
| --- | --- |
| `__review` | Take the review up (below) |
| `__dashboard` | Take the session back as the dashboard (`console-finish.md`) |
| `__done` | `stop` the server: the session is over |
| `wait` exit 20 | `open --resume <sid> --workflow <yours>`, give the new link, keep waiting |

**Read `references/review.md`** and run Review Mode with these overrides:

- Scope is Focused and decided: the exact change set of this session (files created or modified by the phase or the quick task, plus the tests and docs changed for it). Do not ask about scope. `overview.md` and the phase file give spec compliance; they do not widen scope.
- The helper rule applies: a fresh helper runs the analysis when available, you verify every finding, and the report carries its Reviewed by line.
- No commit instructions and no next-conversation routing mid-review; the way back out carries both.
- The page takes the whole report: the "top 10 of 15+" rule does not apply, and tables go in the doc.

## The findings

In loop mode the pick comes from `--fix`: post the findings and the pick as settled `handledBy:"loop"` items and ask nothing (`notes/loop.md`).

Post the full report as a doc, and the fix choice as one `multi` item, with `--wait`:

`{"docs":[{"id":"review","title":"Review findings","blocks":[{"id":"report","md":"## Overview\n\n...\n\n## Findings\n\n| # | Severity | Issue | File |\n..."}]}],"items":[{"id":"fixes","kind":"multi","title":"Which to fix","required":false,"doc":"review","body":"Tick what should be fixed now. Anything unticked is written up as still open. Nothing changes until you send.","options":[{"k":"1","text":"Critical: token is logged in plain text","detail":"src/auth.ts:42. Fix: redact before logging."},{"k":"2","text":"Warning: missing null check on the user lookup","detail":"src/users.ts:88. Fix: ..."}],"presets":[{"label":"Critical and warnings","ks":["1","2"]},{"label":"All of them","ks":["1","2","3"]}]}]}`

Findings keep numeric `k` (they are not lettered). `"doc":"review"` puts a "Read in full" button on the card: always carry it. Read the reply as Review Mode's fix choice: `Which to fix: 1, 2` is `S 1,2`, all ticked is `A`, `skip` or nothing ticked is "fix none, keep them as unresolved". Leave out a `preset` a set would not change. With zero findings there is no item: say so in the doc and go to the way back out.

## Fixing

Settle `fixes` (`"settle":true`) in the same post that goes back to work. A send with nothing ticked settles as `{"ks":[]}`. Then follow Review Mode's Post-Fix Flow, posting `activity` per fix ("Fix 2 of 3: the null check") and `quietMinutes` as in a build. In loop mode: one fix round, then a fresh re-check of only the fixes; with `--fix smart` a triage helper picks the findings first (`notes/loop.md`).

## The way back out

In loop mode the way out is the `loopOutcome` post, not a sign-off.

**`implement` and `implement-review`: back to the sign-off.** Fold the review results and still-open findings into the report doc, then reopen the sign-off without the review verdict and post the build's `headline` back:

`{"headline":{"cleared":9,"total":9},"items":[{"id":"signoff","status":"reopened","body":"Reviewed and ready for sign-off. The review found 3 issues: 2 fixed, 1 still open in the Review findings tab.","verdicts":[{"id":"approve","label":"Approve this phase"},{"id":"show","label":"Show me it working"},{"id":"changes","label":"I want changes"}],"token":{"approve":"approved","changes":"needs changes","show":"show me"},"thread":[{"who":"agent","text":"Review done: 2 of 3 findings fixed; the rest is in the findings tab."}]}]}`

`show` runs as `notes/implement.md` says and reopens this card without it. Approving now covers the fixes: there is no separate "Check the fixes" step. On approval continue at `notes/implement.md` (the finish).

**`quick-task`: the closing gate, then the finish.** Post a `review` item "Check the fixes": `doc:"review"`, `"nothingYet":false`, verdicts `approve` ("The fixes look right") and `changes`, token `approved` / `needs changes`. When it clears, settle it in the same post as the new finish, posted without `review` and with `dashboard:true`; keep waiting for its buttons, `stop` only on `__done`. The finish:

- `headline`: "The review is done"
- `body`: findings by severity, what was fixed, what is still open, and the commit command for the fixes
- `command`: one commit for the whole quick task (changes and fixes together) in the project's commit format, with `commit:true` and `changelog:true`
- `doc`: `"review"`. The `headline` object goes back to the quick task's own (`{"cleared":4,"total":4}`).
