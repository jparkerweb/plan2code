# Revision on the Web Console

Workflow notes for `revise-plan`, part of the web console contract (`console.md`).

Revision is a short run of gates, and each maps onto a kind you already know:

| Step | On the page |
| --- | --- |
| 1, Change Analysis | A `recap` item, "Is this the change?", with the affected-areas table in `summary`. |
| 2, Impact Assessment | The Revision Impact Summary as a doc (`id: "impact"`), and a `review` item "Approve the spec changes" pointing at it: verdicts `approve` ("Approve these spec changes"), `refine` ("Refine the plan") and `abort` ("Abort", `"danger": true`), `nothingYet`: "No spec file changes until you approve." |
| 3 to 5 | Nothing to ask. Post `activity` while you edit, then the Revision Complete summary as a doc. |
| 6, Cleanup | A `confirm` per rename or removal, the paths in `consequences`. |

Revision's own rule holds on the page too: **no option, verdict or label ever
offers to execute or implement.** Pass `--spec specs/<feature>` to `open`, or
post `specDir` once you know it. The finish command is
`/plan2code-3-implement specs/<feature>/overview.md`; an abort's is
`/plan2code-1b-revise-plan specs/<feature>/overview.md`.
