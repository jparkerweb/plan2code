# Revision

| Step | Card |
| --- | --- |
| 1, Change Analysis | `recap` "Is this the change?", affected-areas table in `summary`. A waiting `**Plan change:**` brief is quoted atop `summary` and no "what should change" card goes first; with none, the first card is `text` "What should change", `"fill":"note"`. |
| 2, Impact | Doc `impact`, plus `review` "Approve the spec changes": verdicts `approve`, `refine`, `abort` (`danger`), `nothingYet` "No spec file changes until you approve." |
| 3 to 5 | Nothing to ask: `activity` while you edit, then the Revision Complete summary as a doc. |
| 6, Cleanup | `confirm` per rename or removal, paths in `consequences`. |

No option, verdict, label, or helper `title`, `ask` or `result` ever offers to execute or implement. Pass `--spec specs/<feature>` to `open` or post `specDir`. Finish `command`: `/plan2code-3-implement specs/<feature>/overview.md`; abort: `/plan2code-1b-revise-plan specs/<feature>/overview.md`.

Helpers: lookup helpers report before the Step 2 review goes up; phase-file helpers before the Step 4 check.
