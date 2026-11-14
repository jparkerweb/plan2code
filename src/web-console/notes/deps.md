# Update Dependencies

## Start screen

One `--wait` batch after `detect`. The notes box is a `choice`, on as the recommended option; leave out the dirty confirm when no lockfile has `dirty` files. Missing tools, no-lockfile manifests, ecosystems not covered and untracked lockfiles go in `body` lines, one each:

```jsonc
{"title":"Update dependencies","headline":{"stage":"Start","cleared":0,"total":4},"items":[{"id":"notes","kind":"choice","title":"Release notes","allowOther":false,"body":"Safe needs the notes read. 3 other changed files stay as they are.\n\n- cargo is not on this machine: `plan2code-app` is not scanned.","options":[{"text":"Read each update's release notes","recommended":true},{"text":"Skip the notes","detail":"Every row counts as notes not read: nothing can be Safe."}]},{"id":"dirty","kind":"confirm","title":"Already changed","body":"`package.json` already has changes. They are backed up as found and put back as found.","yesLabel":"Carry on","noLabel":"Stop"}]}
```

## The folder card

One `multi`, `--wait`: one option per folder holding a lockfile, `text` the folder, `detail` the ecosystem and the quick count. All are suggested: preset `All folders` with every key. A send with none ticked means every folder.

## Not scanned, no registry

`scan` exit 3: a `confirm` "No registry answered", `body` with the sign-in command, `"yesLabel":"Scan again","noLabel":"Stop"`.

## Checks

For lockfiles with no test map row: one `confirm` listing each discovered command and the folder it runs in, `"yesLabel":"Use these","noLabel":"Not right"`; a "Not right" note replaces what was found. No checks anywhere: a `text` card for a command (`required:false`), then, left empty, a `confirm` "Apply unchecked" (`"yesLabel":"Apply unchecked","noLabel":"Stop"`).

## The pick list

One `multi`, `--wait`, `required:false`. Options in five groups, in order: Safe, Check first, Warning, Held back, Not scanned; `security` rows first in their group. `k` is a number in order; keep a key-to-row-id map in the run folder. `text` is `package current → target`; `detail` the jump, folder and reasons; `more` the notes link and source, quoted breaking lines, call sites and newer versions the runtime holds back. `batch` is `safe:<lockfile>` for a Safe row, the row id (or its pair's first id) otherwise. Held back and Not scanned rows are `locked`. Rows cannot open ticked, so `All Safe` is the suggested pick; leave it out with no Safe rows. `body` also lists missing scan plugins with their `install` lines and `stillOpen` with reasons.

```jsonc
{"headline":{"stage":"Pick list","cleared":2},"items":[{"id":"picks","kind":"multi","title":"What to update","required":false,"body":"- Safe: 2 (the suggested pick: press All Safe)\n- Check first: 1\n- Warning: 1\n- Held back: 1\n\nNothing is updated until you send.","counter":{"rounds":"check rounds"},"options":[{"k":"1","group":"Safe","text":"vite 7.1.2 → 7.1.9","detail":"patch · plan2code-app · in range","batch":"safe:plan2code-app/package-lock.json","more":"Notes: [GitHub releases](https://github.com/vitejs/vite/releases), no breaking lines."},{"k":"2","group":"Safe","text":"tsup 8.3.0 → 8.5.1","detail":"minor · plan2code-metrics · in range","batch":"safe:plan2code-metrics/package-lock.json"},{"k":"3","group":"Check first","text":"eslint 9.6.1 → 10.2.1","detail":"major · plan2code-bot · range ^9.6.1 → ^10.2.1","batch":"plan2code-bot/package-lock.json#eslint"},{"k":"4","group":"Warning","text":"commander 12.1.0 → 14.0.0","detail":"major · plan2code-metrics · the code calls a changed API in 3 files","batch":"plan2code-metrics/package-lock.json#commander","more":"> Removed `program.storeOptionsAsProperties()`\n\n- src/cli.ts:14"},{"k":"5","group":"Held back","text":"glob 10.4.5","detail":"held by `overrides` in package.json","locked":true}],"presets":[{"label":"All Safe","ks":["1","2"]}]}]}
```

## Progress

One post per install and check, no `--wait`: `headline.stage` `Batch 2 of 5`, `activity` naming the batch and the command (`Installing for plan2code-app`, then `Running npm test in plan2code-app`), `quietMinutes` sized to the timeout plus a margin. After the first batch, `activity` ends with the time left. A put-back says so: `Putting back eslint`.

The first batch that stays with a pick updated posts `{"run":{"event":"deps","id":"apply"}}`, once per run.

Helpers are reported as `helpers`, each `done` or `failed`, before the pick list goes up.

## Stop

On `__stop`: a `confirm` "Stop the run", `"yesLabel":"Stop","noLabel":"Keep going"`, `body` naming what stays and what is put back. Yes: put back the live batch, then the report and the finish.

## The hand-off card

One `multi`, `--wait`, `required:false`, after the last batch: every Warning row and every Check first major that failed and was put back, nothing ticked, `detail` what blocks it.

## The report

Doc `report`: one `md` block, the headline first (Complete, Narrowed or Stopped), then the folders scanned, the rows table with each label, reasons and outcome, still-open vulnerabilities, missing tools with install lines, folders the test map lacks (point to PR Prep or Test), changes already there before the run, and each brief written. After an unfinished put-back: the mismatched files or the hand-run command, and `<run>/backups/<b>/files/`.

## The finish

`headline` the counts updated, failed and not tried; `body` the summary and any brief written; `"dashboard":true`; `command` `/plan2code-git` when something changed; never `commit`. A stop before any apply: `body` says nothing changed, `"command":"/plan2code-deps"`. An unfinished put-back: no `command`; `body` names what the report does.
