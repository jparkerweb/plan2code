# Finalize on the Web Console

Workflow notes for `finalize`, part of the web console contract (`console.md`).

Finalize is a run of reports and gates, and each maps onto a kind you already
know:

| Step | On the page |
| --- | --- |
| 1, Task Completion Audit | The audit table as a doc (`id: "audit"`). If incomplete or blocked tasks exist (`totals.incomplete + totals.blocked > 0`), a `choice` with the three options — return to implementation, mark partially complete, abandon — with the counts against the thresholds in `body`. |
| 2, Implementation Verification | The verification results as a doc. Nothing to ask unless an issue needs their decision. |
| 3, Implementation Summary | Written to `overview.md` as usual; mirror it as a doc (marked `saved`, as a `file` block on `overview.md`) so the page reader sees it land. |
| 4, Documentation Review | The proposed-updates table as a doc, and a `multi` naming the documents to update — every option ticked is "approve", unticked ones are skipped. A `review` works instead when the set is all-or-nothing. |
| 5, User Feedback | Optional items, `required: false`: the rating as a `choice` of 1 to 10 or a `text`, the three reasons as `text`. The submit-to-maintainer consent is a `confirm`. |
| 6, Spec Cleanup | A `review` item before moving anything (`doc`: Step 3's summary), verdicts `yes` ("Archive it"), `show` ("Show me it working", token `show me`) and `no`, the archive paths in `body`, and a line that the spec's remembered workspace folders are forgotten too (`console.mjs forget --spec specs/<feature>` after the move). On `show`, run it as `notes/implement.md` → Show me it working says (the summary line goes into `overview.md`'s Completion Summary), then reopen the card without `show`. |

Post `activity` as each step starts, before its doc or question lands — reading
the spec, running `specs.mjs status` or `archive --dry-run`, checking the
implementation — the same way Review does. A step with no card of its own
(2, 3) is otherwise a stretch of silence the page can only show as "Starting
Finalize".

Pass `--spec specs/<feature>` to `open`, or post `specDir` once you know it.
Stopping mid-finalize loses nothing — the specs are untouched until Step 3's
summary write — so a stop's finish just says where it paused and uses
`"command": "/plan2code-4-finalize specs/<feature>/overview.md"`. On success
the finish's `command` is the suggested commit when Step 4 doc updates landed
(with `"where": "When you are happy with it, commit it from your terminal:"`), otherwise leave `command` out.
When the finish prints that suggested commit, it also carries `"commit": true`,
so the finished screen offers **Commit it now** (`console-finish.md`). The
completion summary is printed to a terminal the browser user is not watching,
so put it in `finish.body`.
