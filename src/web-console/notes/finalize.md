# Finalize

| Step | Card |
| --- | --- |
| 1, Audit | Table as doc `audit`. If `totals.incomplete + totals.blocked > 0`, a `choice` (return, mark partial, abandon) with counts against thresholds in `body`. |
| 2, Verification | Results as a doc; ask only on an issue. Unless Full Suite is `Never` or `At Phase N`: `confirm` "Run the full suite" (`yesLabel` "Run it", `noLabel` "Skip it", reason in `body`); a failure is the building notes' `choice`. |
| 3, Summary | Written to `overview.md`; mirror it as a doc (`saved`, `file` block). |
| 4, Docs review | Proposed-updates table as a doc, plus a `multi` of documents (ticked = approved, `required:false` so Skip means no doc changes); a `review` if all-or-nothing. |
| 5, Feedback | `required:false`: rating as `choice` 1 to 10 or `text`, three reasons as `text`, maintainer consent as `confirm`. |
| 6, Cleanup | `review` (`doc` Step 3's summary), verdicts `yes` ("Archive it"), `show` (token `show me`), `no`; archive paths in `body`, and a line that remembered workspace folders are forgotten too (`console.mjs forget --spec specs/<feature>` after the move). On `show`, see `notes/implement.md`, then reopen without `show`. |

Post `activity` as each step starts. Pass `--spec specs/<feature>` or post `specDir`.

Finish: the completion summary goes in `body`. `command` is the suggested commit when Step 4 updates landed (`"where":"When you are happy with it, commit it from your terminal:"`, `"commit":true`, `"changelog":true`), else none. A stop loses nothing before Step 3's write: `command` `/plan2code-4-finalize specs/<feature>/overview.md`.
