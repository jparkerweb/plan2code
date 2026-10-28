# Revision on the Web Console

Workflow notes for `revise-plan`, part of the web console contract (`console.md`).

Revision is a short run of gates, and each maps onto a kind you already know:

| Step | On the page |
| --- | --- |
| 1, Change Analysis | A `recap` item, "Is this the change?", with the affected-areas table in `summary`. Found a waiting `**Plan change:**` brief? Quote it at the top of that `summary` and post no open "what should change" card first. With none waiting, the first card is a `text` item titled "What should change", `"fill": "note"`, asking what to change; its answer feeds the "Is this the change?" recap. |
| 2, Impact Assessment | The Revision Impact Summary as a doc (`id: "impact"`), and a `review` item "Approve the spec changes" pointing at it: verdicts `approve` ("Approve these spec changes"), `refine` ("Refine the plan") and `abort` ("Abort", `"danger": true`), `nothingYet`: "No spec file changes until you approve." |
| 3 to 5 | Nothing to ask. Post `activity` while you edit, then the Revision Complete summary as a doc. |
| 6, Cleanup | A `confirm` per rename or removal, the paths in `consequences`. |

Revision's own rule holds on the page too: **no option, verdict or label ever
offers to execute or implement.** Pass `--spec specs/<feature>` to `open`, or
post `specDir` once you know it. The finish command is
`/plan2code-3-implement specs/<feature>/overview.md`; an abort's is
`/plan2code-1b-revise-plan specs/<feature>/overview.md`.

Revision offers the Subagents switch. A `Subagents:` block may arrive on
`open` output or a `wait` / `chat` pickup: follow `console-subagents.md` and
the skill's Helpers section, and report each helper as `helpers`. Lookup
helpers report back before the Step 2 review item goes up; phase-file helpers
report back before the Step 4 check. Every gate stays with you, and a helper's
`title`, `ask` and `result` follow the same rule as every label: nothing
offers to execute or implement.
