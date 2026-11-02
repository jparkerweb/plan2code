# X-ray

## The mode question

An argument naming mode and area skips it. Otherwise one `--wait` batch:

```jsonc
{"title":"Codebase X-ray","headline":{"stage":"Choosing","cleared":0,"total":2},"items":[{"id":"mode","kind":"choice","title":"What you want to know","allowOther":false,"body":"Explain one area, or rank what makes this code hard to change.","options":[{"text":"Explain an area","detail":"How it works and why, citing files and commits."},{"text":"Find the rough spots","detail":"Ranked spots that make change hard. You pick the ones worth fixing; they become a brief for Pathfinder or Plan."}]},{"id":"area","kind":"text","title":"Which area","required":false,"body":"A folder, file or feature. Needed to explain; empty surveys the whole repository."}]}
```

Explain with the area empty: ask again as a required `text`.

## Explain mode

Doc `answer`, one block per section (`In one paragraph`, `How it works`, `Why it is this way`, `Worth knowing`), `Sources:` line atop the first. Then:

```jsonc
{"id":"keep","kind":"confirm","title":"Keep this answer","doc":"answer","body":"Save it as `specs/exporter/XRAY-exporter-20261016.md`, as input for Pathfinder or Plan?","yesLabel":"Save it","noLabel":"No, just reading"}
```

When the folder name is not obvious, ask it in the same batch as a `text` with `pattern` `^[a-z0-9]+(-[a-z0-9]+)*$`. Once written, re-send the doc with `"saved":"specs/<name>/XRAY-<area-slug>-<date>.md"`.

## Rough-spots mode

Doc `spots`, one block per spot (files, why it hurts, the "to change X today" example). Pick, `--wait`:

```jsonc
{"id":"pick","kind":"multi","title":"Worth fixing","doc":"spots","required":false,"body":"Tick the spots worth fixing. Only ticked spots go into the brief.","options":[{"text":"Exporter and its formatter always change together"}]}
```

Nothing ticked: nothing written. Otherwise write the brief and add it as a second doc with `"saved":"specs/<name>/ARCHITECTURE-BRIEF-<date>.md"` and a `file` block.

## The finish

`command` is `/plan2code-0-pathfinder` (big or unclear) or `/plan2code-1-plan` (settled); none when nothing was kept. `doc` is the brief or saved answer. `"dashboard":true`.

A stop before anything was written: `body` says nothing was kept, `"command":"/plan2code-xray"`.
