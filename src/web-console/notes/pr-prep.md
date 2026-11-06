# PR Prep

## Uncommitted changes

Only when a review-scope file's `status` includes `staged`, `unstaged` or `untracked`. One `choice`, `--wait`, the files in `body`:

```jsonc
{"title":"Get a PR ready","headline":{"stage":"Changes","cleared":0,"total":4},"items":[{"id":"uncommitted","kind":"choice","title":"Uncommitted work","allowOther":false,"body":"These files are not committed yet:\n\n- `src/a.js` (unstaged)\n- `notes.txt` (untracked)\n\nRun the checks with them, or commit first?","options":[{"text":"Include them in this run","recommended":true},{"text":"Commit first","detail":"The git skill commits them; then run PR Prep again."}]}]}
```

## Commands, with no test map

One `confirm` listing each command found and the folders it covers, `--wait`, before anything runs. A "Not right" answer carries the corrections in its note; with none, ask for them as a `text` card:

```jsonc
{"id":"commands","kind":"confirm","title":"Commands found","body":"| Command | Folder | Covers |\n| --- | --- | --- |\n| `npm test` | . | everything |\n| `npm run lint` | . | lint |\n\nRun checks with these?","yesLabel":"Use these","noLabel":"Not right"}
```

## The check plan

One `multi`, each check's reason in `detail`, "picked by the agent" on judged ones, and one preset "All of them" naming every check: a card cannot open with its boxes ticked, so the preset is the one press that keeps the whole plan. With more than one runner, group in `body` (a short list per runner) and prefix each option's `text` with its runner. `--wait`:

```jsonc
{"headline":{"stage":"Check plan","cleared":1},"items":[{"id":"plan","kind":"multi","title":"Checks to run","body":"Tick the checks to run, or press All of them. Anything left unticked is skipped and named in the report. Nothing runs until you send.","options":[{"k":"1","text":"Launcher tests","detail":"`node --test scripts/test-launcher.mjs`: covers src/launcher/plan2code.js."},{"k":"2","text":"Lint","detail":"`npm run lint`: project check."}],"presets":[{"label":"All of them","ks":["1","2"]}]}]}
```

A send with nothing ticked runs nothing: every check is trimmed.

## Running

One progress post per check, no `--wait`, with `quietMinutes` sized to its timeout (600 s is 10 minutes, plus a margin):

```jsonc
{"headline":{"stage":"Running","cleared":2},"agent":{"status":"working","activity":"Check 2 of 5: the launcher tests","quietMinutes":12}}
```

Logs go in `<session>/checks/<n>.log`. Run the `chat` check between checks, as a build does.

## The report and the description

Doc `report`: one `md` block with the verdict first (Ready, Ready with notes or Not ready), then the checks grouped by runner (outcome, seconds, reason), then the notes. Doc `description`: one `md` block holding a single ` ```markdown ` fence, so its copy button copies the raw Markdown; the create-a-PR link (or the not-pushed or no-link line) goes in a second block under it, outside the fence. With `needsKind` or a null `url`, that block says the link cannot be built here and names `/plan2code-git`, whose board asks an unknown host's kind once and remembers it; this page cannot save it.

```jsonc
{"headline":{"stage":"Ready","cleared":4},"docs":[{"id":"report","title":"Readiness","blocks":[{"id":"verdict","md":"## Ready with notes\n\n..."}]},{"id":"description","title":"PR description","blocks":[{"id":"text","md":"```markdown\n## Summary\n\n...\n```"},{"id":"link","md":"[Open the pull request](https://...)"}]}]}
```

## The offers

Each a `confirm`, `--wait`, `"doc":"report"`:

- Save: `title` "Save the report", `body` naming `specs/<feature>/PR-READINESS-<date>.md` (and that a same-day file is replaced), `yesLabel` "Save it", `noLabel` "No". `how: "ask"` first asks which folder as a `choice` (one option per candidate, plus "None").
- Hand-off when not pushed: `title` "Not pushed yet", `yesLabel` "Open Git", `noLabel` "Not now". Yes: the finish carries `/plan2code-git` instead of `/plan2code-review`.
- Test map: `title` "Save a test map", the rows as a table in `body`, `yesLabel` "Save it", `noLabel` "No".

## The finish

`headline` is the verdict ("Ready with notes"), `body` the summary and what was saved, `command` `/plan2code-review`, `doc` `report`, `"dashboard":true`, no `commit`. Mention `/plan2code-test` in `body` when untested files were noted.

A stop before the run: `body` says nothing ran and nothing was saved, `"command":"/plan2code-pr-prep"`.
