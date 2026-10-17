# Diagnose on the Web Console

Workflow notes for `diagnose`, part of the web console contract (`console.md`).

## The bug

A typed argument that already describes the bug skips the cards it answers.
Otherwise ask in one batch (at most three open), posted with `--wait`:

```jsonc
{
  "title": "Diagnose a bug",
  "headline": { "stage": "The bug", "cleared": 0, "total": 3 },
  "items": [
    { "id": "bug", "kind": "text", "title": "What is wrong",
      "body": "The bug, in a sentence or two.",
      "placeholder": "The CSV export drops the last row when the report has more than 100 rows." },
    { "id": "expected", "kind": "text", "title": "Expected and actual",
      "body": "What should happen, and what happens instead.",
      "placeholder": "Expected 150 rows in the file; it has 149, and the last order is missing." },
    { "id": "see-it", "kind": "text", "title": "How to see it",
      "body": "The steps, command, page or input that shows it, and since when if you know.",
      "placeholder": "Run npm run export -- --month 2026-09 and count the rows. It worked last month." }
  ]
}
```

No `"templates"` on these cards: the starter templates are for a fresh idea,
and a bug report is not one. A follow-up the answers leave open is a new card
with a new id.

## The cause

Post the cause as a doc, `id` `"cause"`, as soon as there is something to show,
and grow it as evidence lands, with `"agent": { "status": "working",
"activity": "..." }` while you reproduce and narrow:

```jsonc
"docs": [{ "id": "cause", "title": "The cause", "note": "Reproduced; narrowing", "blocks": [
  { "id": "repro", "state": "settled", "md": "## Reproduction\n\n`node scripts/export-check.mjs` fails: 149 rows, expected 150." },
  { "id": "found", "state": "settled", "md": "## The cause\n\n`src/export.ts` `writeRows()`: the loop stops at `rows.length - 1`. **Proven** by the reproduction." },
  { "id": "fix", "state": "settled", "md": "## Suggested fix\n\nLoop to `rows.length`. **Size:** Small (Quick Task)." }
]}]
```

- **Unproven** guesses are `assumed` blocks, one per guess, ranked, each with
  its evidence and what would confirm it. A guess the evidence proves becomes
  `settled`; one it rules out is removed (`"_delete": true`).
- Keeping a failing test inside the project is a `confirm` card pointing at
  the doc (`"doc": "cause"`), `yesLabel` "Keep it", `noLabel` "Throw it away".

## The bug name

With the cause written, ask the folder name, posted with `--wait`:

```jsonc
{ "id": "name", "kind": "text", "title": "Name for the write-up", "doc": "cause",
  "body": "The diagnosis is saved as `specs/<name>/DIAGNOSIS-<date>.md`. Lowercase words joined by dashes.",
  "placeholder": "csv-export-drops-rows",
  "pattern": "^[a-z0-9]+(-[a-z0-9]+)*$",
  "patternHint": "Lowercase letters, numbers and dashes, like csv-export-drops-rows." }
```

Once written, re-send the doc with
`"saved": "specs/<name>/DIAGNOSIS-<date>.md"` and its blocks replaced by one
`file` block for that path (delete the old ids).

## The finish

`command` is `/plan2code-quick-task specs/<name>` (small fix) or
`/plan2code-1-plan specs/<name>` (big fix) with the real folder filled in
(`/plan2code-quick-task specs/csv-export-drops-rows`), never a placeholder: a
copied command must reach the diagnosis. `body` names the cause, how sure, and that the
next step reads the diagnosis first. `doc` is `"cause"`. `"dashboard": true`,
then keep waiting for the press (`console-finish.md`): back on the dashboard
the folder shows as "Bug diagnosed", with that card lit.

Nothing kept (the bug did not reproduce and no guess held up): leave
`command` out and say so in `body`.

A stop before the file is written ends on a finish whose `body` says nothing
was kept (and names any throwaway script or kept test you wrote), with
`"command": "/plan2code-diagnose"` (`console-stop.md`).
