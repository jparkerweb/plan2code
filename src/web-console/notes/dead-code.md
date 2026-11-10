# Dead Code

## Start questions

One `--wait` batch, after `detect` and `keep list`. Only the first card is required; leave out any the prompt says to skip (no method card with no tool, no keep card with an empty list):

```jsonc
{"title":"Clear out dead code","headline":{"stage":"Start","cleared":0,"total":5},"items":[{"id":"method","kind":"choice","title":"How to look","allowOther":false,"body":"This project has Knip (`knip.json`).","options":[{"text":"Knip, checked by a caller search","recommended":true},{"text":"Knip plus a full search of my own","detail":"Slower; finds what Knip cannot see."}]},{"id":"scope","kind":"choice","title":"Where to look","required":false,"body":"Callers are always searched across the whole project.","options":[{"text":"The whole project","recommended":true},{"text":"One folder","detail":"Name it in the note."}]},{"id":"keep","kind":"choice","title":"The keep list","required":false,"allowOther":false,"body":"3 findings were kept on earlier runs.","options":[{"text":"Hide them again","recommended":true},{"text":"A fresh scan that ignores them"}]}]}
```

## Narrow first

Only when `overLimit` is true. One `choice`, `--wait`: the five folders from `narrow` (or the biggest top-level folders with no tool), each with its count in `detail`, then the whole project with the time and cost warning in its `detail`.

## The findings

One `multi`, `--wait`, `required:false`. Options in three groups, in this order: Safe, Check first, Warning. Each option's `text` is `name` in `file:line`; its `detail` starts with the label, then the source (tool, own search or both), the rule id and the reason (the six-kind reason for a Warning). The `body` gives each group's count, how many the keep list hid and how many were dropped for a caller. Nothing starts ticked: the quick pick is the preset `All Safe` (the Safe group's keys). Leave out a preset with no keys (no Safe findings, or a `None`): the page drops it, and a pressed preset clears when pressed again.

```jsonc
{"headline":{"stage":"Findings","cleared":2},"items":[{"id":"findings","kind":"multi","title":"What to remove","required":false,"body":"- Safe to remove: 2\n- Check first: 1\n- Warning: 1\n\n4 hidden by the keep list; 9 dropped: a caller was found. Nothing is removed until you send.","options":[{"k":"1","text":"formatDate in src/dates.js:14","detail":"Safe. Knip (exports): no caller found."},{"k":"2","text":"src/old/legacy.js","detail":"Safe. Knip (files): no caller found."},{"k":"3","text":"parseRow in src/csv.js:40","detail":"Check first. Own search only."},{"k":"4","text":"onLoad in src/plugin.js:8","detail":"Warning. A framework hook: the host calls it by name."}],"presets":[{"label":"All Safe","ks":["1","2"]}]}]}
```

## Checks

With no test map: one `confirm` listing each command and the folder it runs in, `--wait`, `"yesLabel":"Use these","noLabel":"Not right"`, before anything runs. A "Not right" note replaces what was found; with none, ask for the commands as a `text` card.

One progress post per check, no `--wait`, its `activity` naming the check and `quietMinutes` sized to its timeout (600 s is 10 minutes, plus a margin). Run the `chat` check between checks, as a build does.

## Final review

Once Step 7 ends with at least one pick `removed` (Step 7.5): `confirm` "Run a final review", `--wait`, `"yesLabel":"Review it","noLabel":"Skip it"`, files and ~lines removed in `body` with the one-line reason to say yes. Yes: read `<D>/building-review.md`, the `dead-code` door.

## The report and the offers

Doc `report`: one `md` block, the headline first (Complete, Narrowed or Stopped), then scope, method and tools, the hidden and dropped counts, and the findings table with each outcome. Then each offer as a `confirm`, `--wait`, `"doc":"report"`: "Save the report" (naming `.plan2code-dead-code/reports/DEAD-CODE-<date>.md`), "Keep these findings" (the reasons asked as a `text` card after a yes), and on first save ".gitignore line".

Helpers are reported as `helpers`, each `done` or `failed` before the findings page goes up. Labels, picks and questions stay with you.

## The finish

`headline` the counts removed, kept and failed; `body` the summary and any file written; `"dashboard":true`; `command` `/plan2code-git` when something was removed or `keep.md` changed, otherwise none; never `commit`. A stop before removal: `body` says nothing was removed, `"command":"/plan2code-dead-code"`.
