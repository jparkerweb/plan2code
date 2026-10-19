# X-ray on the Web Console

Workflow notes for `xray`, part of the web console contract (`console.md`).

## The mode question

A typed argument that names the mode and area skips it. Otherwise ask both in
one batch, posted with `--wait`:

```jsonc
{
  "title": "Codebase X-ray",
  "headline": { "stage": "Choosing", "cleared": 0, "total": 2 },
  "items": [
    { "id": "mode", "kind": "choice", "title": "What you want to know", "allowOther": false,
      "body": "Explain one area, or rank what makes this code hard to change.",
      "options": [
        { "k": "1", "text": "Explain an area", "detail": "How it works and why it is that way, citing files and the commits behind it." },
        { "k": "2", "text": "Find the rough spots", "detail": "Ranked spots that make change hard. You pick the ones worth fixing; they become a brief for Pathfinder or Plan." }
      ] },
    { "id": "area", "kind": "text", "title": "Which area", "required": false,
      "body": "A folder, file or feature. Needed to explain; leave it empty to survey the whole repository.",
      "placeholder": "src/exporter, the code that builds the CSV reports" }
  ]
}
```

Explain picked with the area left empty: ask for it again as a required `text`
card. No recommendation on the mode: only the person knows what they came for.

## Explain mode

The answer is a doc, `id` `"answer"`, one block per section (`In one paragraph`,
`How it works`, `Why it is this way`, `Worth knowing`), with the `Sources:` line
at the top of the first. Then the save offer as a `confirm` card pointing at it:

```jsonc
{ "id": "keep", "kind": "confirm", "title": "Keep this answer", "doc": "answer",
  "body": "Save it as `specs/exporter/XRAY-exporter-20261016.md`, as input for Pathfinder or Plan?",
  "yesLabel": "Save it", "noLabel": "No, just reading" }
```

Ask the folder name in the same batch as a `text` card with `pattern`
`^[a-z0-9]+(-[a-z0-9]+)*$` when it is not obvious. Once written, re-send the doc
with `"saved": "specs/<name>/XRAY-<area-slug>-<date>.md"`.

## Rough-spots mode

The ranked list is a doc, `id` `"spots"`, one block per spot (its files, why it
hurts, the "to change X today" example). The pick is one `multi` card pointing
at it, posted with `--wait`:

```jsonc
{ "id": "pick", "kind": "multi", "title": "Worth fixing", "doc": "spots", "required": false,
  "body": "Tick the spots worth fixing. Add a note for any of them in the box (\"1: the exporter part only\"). Only ticked spots go into the brief.",
  "options": [
    { "k": "1", "text": "Exporter and its formatter always change together", "detail": "src/export.ts, src/format.ts: together in 14 of 16 commits." }
  ] }
```

Nothing ticked: nothing is written. Otherwise write the brief, then add it as a
second doc with `"saved": "specs/<name>/ARCHITECTURE-BRIEF-<date>.md"` and a
`file` block.

## The finish

`command` is `/plan2code-0-pathfinder` (big or unclear) or `/plan2code-1-plan`
(settled), never with a placeholder; leave it out when nothing was kept. `doc`
is the brief or the saved answer when there is one. `"dashboard": true`, then
keep waiting for the press (`console-finish.md`).

A stop before anything was written ends on a finish whose `body` says nothing
was kept, with `"command": "/plan2code-xray"` (`console-stop.md`).
