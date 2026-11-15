# Update Dependencies

Every card, headline and activity line is read by a person: use the plain words of `plan2code-deps.md` (version list, package list, small fix, new features, big change, group, upgrade brief, saved in git, undone, locked to one exact version, size of the change), never the field names.

## Start screen

One `--wait` batch after `detect`, no question: a `confirm` whose Start button begins the run, with a summary body: what was found (folders, counts), the one line "I will read what each update changes before judging it.", and one line each for missing tools, packages with no version list, ecosystems not covered and files not saved in git. The "Already changed" `confirm` is its own card, only when a lockfile has `dirty` files.

```jsonc
{"title":"Update dependencies","headline":{"stage":"Start","cleared":0,"total":4},"items":[{"id":"start","kind":"confirm","title":"What I found","yesLabel":"Start","noLabel":"Stop","body":"3 folders have updates to look at, 14 updates in all.\n\nI will read what each update changes before judging it. 3 other changed files stay as they are.\n\n- `cargo` is not installed here, so `plan2code-app` is not checked.\n- `plan2code-web` has no version list, so I list it but cannot update it."},{"id":"dirty","kind":"confirm","title":"Already changed","body":"`package.json` already has changes. I back them up as they are and undo to exactly that.","yesLabel":"Carry on","noLabel":"Stop"}]}
```

## The folder card

One `multi`, `--wait`: one option per folder with a version list, `text` the folder, `detail` the ecosystem and how many updates. All are suggested: preset `All folders` with every key. A send with none ticked means every folder.

## Not scanned, no registry

`scan` exit 3: a `confirm` "No package server answered", `body` with the sign-in command, `"yesLabel":"Look again","noLabel":"Stop"`.

## Install a missing scanner

One `confirm` per plugin in `missingTools`, after the folder card, `--wait`: `title` "Install <tool>?", `body` the step it adds, the exact `command` from `install-tool` in a code block, and "This changes this machine, not the project.", `"yesLabel":"Install it","noLabel":"Skip that check"`.

## Checks

For folders with no test map row: one `confirm` "I found these checks" listing each command and the folder it runs in, `"yesLabel":"Use these","noLabel":"Not right"`; a "Not right" note replaces what was found. No checks anywhere: a `text` card for a command (`required:false`), then, left empty, a `confirm` "Update without checks" (`"yesLabel":"Update without checks","noLabel":"Stop"`).

## The pick list

One `multi`, `--wait`, `required:false`. Options in six sections, in order: Safe, Check first, Warning, Locked in place, Needs a newer Node, Not looked at; `security` rows first in their section. `k` is a number in order; keep a key-to-row-id map in the run folder. `text` is `package current → new version`; `detail` the size of the change (small fix, new features, big change), folder and `reasonsPlain`; `more` the notes link and source, quoted breaking lines, call sites and newer versions the runtime holds back. `batch` is `safe:<lockfile>` for a Safe row, the row id (or its pair's first id) otherwise. A row whose exact version a project file names says so in `detail` (its `reasonsPlain`). Needs a newer Node rows: `detail` the held reason and its `raise`. Locked in place, Needs a newer Node and Not looked at rows are `locked`. Rows cannot open ticked, so `All Safe` is the suggested pick; leave it out with no Safe rows. `body` also lists `stillOpen` with reasons.

```jsonc
{"headline":{"stage":"Pick list","cleared":2},"items":[{"id":"picks","kind":"multi","title":"What to update","required":false,"body":"- Safe (should just work): 2, the suggested pick: press All Safe\n- Check first (likely fine, worth a look): 2\n- Warning (your code probably needs changing): 1\n- Locked in place: 1\n- Needs a newer Node: 1\n\nNothing is updated until you send.","counter":{"rounds":"check rounds"},"options":[{"k":"1","group":"Safe","text":"vite 7.1.2 → 7.1.9","detail":"small fix · plan2code-app · fits the allowed range","batch":"safe:plan2code-app/package-lock.json","more":"Notes: [GitHub releases](https://github.com/vitejs/vite/releases), nothing removed or changed."},{"k":"2","group":"Safe","text":"tsup 8.3.0 → 8.5.1","detail":"new features · plan2code-metrics · fits the allowed range","batch":"safe:plan2code-metrics/package-lock.json"},{"k":"3","group":"Check first","text":"eslint 9.6.1 → 10.2.1","detail":"big change · plan2code-bot · the allowed range widens from ^9.6.1 to ^10.2.1","batch":"plan2code-bot/package-lock.json#eslint"},{"k":"4","group":"Warning","text":"commander 12.1.0 → 14.0.0","detail":"big change · plan2code-metrics · your code uses something that changed, in 3 files","batch":"plan2code-metrics/package-lock.json#commander","more":"> Removed `program.storeOptionsAsProperties()`\n\n- src/cli.ts:14"},{"k":"5","group":"Check first","text":"playwright-core 1.64.1 → 1.66.0","detail":"new features · root · scripts/test-browser-helper.mjs names this exact version (1.64.1), and the update does not change that file","batch":"package-lock.json#playwright-core"},{"k":"6","group":"Locked in place","text":"glob 10.4.5","detail":"locked by an override in package.json","locked":true},{"k":"7","group":"Needs a newer Node","text":"chalk 4.1.2","detail":"needs Node >=20 (you declare >=18) · change engines.node in package.json","locked":true}],"presets":[{"label":"All Safe","ks":["1","2"]}]}]}
```

## Progress

The baseline, before the pick list: one post per check, `headline.stage` `Before any change`, `activity` `Running npm test before any change`. Tests failing there are named in the report, never a stop.

One post per install and check, no `--wait`: `headline.stage` `Group 2 of 5`, `activity` naming the group and the command (`Installing for plan2code-app`, then `Running npm test in plan2code-app`), `quietMinutes` sized to the timeout plus a margin. After the first group, `activity` ends with the time left. A fix and an undo say so: `Fixing scripts/test-browser-helper.mjs`, `Putting back the update and the fix`, `Undoing eslint`.

After the last group, when `checks` lists a `full` suite: one `confirm` "Run the full suite", `body` naming the commands, `"yesLabel":"Run the full suite","noLabel":"Skip"`.

The first group that stays with a pick updated posts `{"run":{"event":"deps","id":"apply"}}`, once per run.

Helpers are reported as `helpers`, each `done` or `failed`, before the pick list goes up.

## The fix card

One `choice` per change, `--wait`, when `compare` blames a group and the cause is small: `title` "Fix this to keep the update"; `body` the file, the failing check in one plain line, and the exact change as a fenced `diff` (the line before, the line after). "Other" carries an edited replacement: apply that instead.

```jsonc
{"items":[{"id":"fix-1","kind":"choice","title":"Fix this to keep the update","body":"`scripts/test-browser-helper.mjs` still names the old version, so `npm test` fails.\n\n```diff\n- const BUILD = \"1.64.1\";\n+ const BUILD = \"1.65.1\";\n```","options":[{"text":"Make this change","recommended":true},{"text":"Skip it and undo the update"}]}]}
```

## Stop

On `__stop`: a `confirm` "Stop the run", `"yesLabel":"Stop","noLabel":"Keep going"`, `body` naming what stays and what is undone. Yes: undo the live group, then the report and the finish.

## The code-changes card

One `multi`, `title` "Packages that need your code changed", `--wait`, `required:false`, after the last group: every Warning row, every Check first big change that broke and was undone, and every pick not applied for needing a bigger change, nothing ticked, `detail` what blocks it. Ticked rows get an upgrade brief.

## The report

Doc `report`: one `md` block, a headline sentence first that says what happened ("Nothing was changed. 1 update broke the tests and was undone; 3 were not tried"), then folders looked at, the rows table with each label, reason and outcome in plain words, still-open security problems, missing tools with install lines, folders the test map lacks (point to PR Prep or Test), changes already there before the run, and each upgrade brief written. After an undo that did not finish: the files that differ or the command to run by hand, and `<run>/backups/<b>/files/`.

## The finish

`headline` a sentence saying what happened first (counts updated, broke and not tried); `body` the summary and any upgrade brief written; `"dashboard":true`; `command` `/plan2code-git` when something changed; never `commit`. A stop before any apply: `body` says nothing was changed, `"command":"/plan2code-deps"`. An undo that did not finish: no `command`; `body` names what the report does.
