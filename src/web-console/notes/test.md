# Test

## Scope

Every run, one `choice`, `--wait`:

```jsonc
{"title":"Write missing tests","headline":{"stage":"Scope","cleared":0,"total":5},"items":[{"id":"scope","kind":"choice","title":"Where to look","allowOther":false,"body":"Which code should I look for missing tests in?","options":[{"text":"This branch's changes","recommended":true},{"text":"A folder or file","detail":"You name it next."},{"text":"The whole project"}]}]}
```

"A folder or file" gets a follow-up `text`, `--wait`: `{"id":"scope-path","kind":"text","title":"Which folder","body":"Which folder or file should I look in?","placeholder":"src/billing"}`.

## Commands and the built-in runner

With no test map: one `confirm` listing each command found and the folders it covers, `--wait`, before anything runs. A "Not right" answer carries the corrections in its note; with none, ask for them as a `text` card:

```jsonc
{"id":"commands","kind":"confirm","title":"Commands found","body":"| Command | Folder | Covers |\n| --- | --- | --- |\n| `npm test` | . | everything |\n\nWrite and run tests with these?","yesLabel":"Use these","noLabel":"Not right"}
```

No runner at all and a `builtin` found: one `confirm` naming the runner and the command it adds, `--wait`: `{"id":"builtin","kind":"confirm","title":"No test runner","body":"This project has no test runner. Node has one built in: I would add `\"test\": \"node --test\"` to `package.json` and nothing else. Use it?","yesLabel":"Add it","noLabel":"No"}`. No runner and no `builtin`: no card; the finish says why nothing was written.

## Coverage

Only when `discover` lists a `coverage` entry for a runner in scope. One `confirm`, `--wait`, naming the command and what it covers; never run without a yes:

```jsonc
{"headline":{"stage":"Gaps","cleared":2},"items":[{"id":"coverage","kind":"confirm","title":"Run coverage","body":"This project already has coverage: `npx jest --coverage --coverageReporters=lcov` in `.` covers every Jest test. Run it to find files the tests barely touch? Without it I match files to tests by name, folder and imports only.","yesLabel":"Run it","noLabel":"Skip it"}]}
```

The output file goes in the `session` folder `open` printed.

## Size

Only past a limit (8 source files, 8 new test files, 2 runners). One `choice`, `--wait`, the counts in `body`:

```jsonc
{"id":"size","kind":"choice","title":"A big job","allowOther":false,"body":"- Source files: 14/8\n- New test files: 11/8\n- Runners: 1/2\n\nContinue with the top 8 gaps this run, or write a plan draft and plan it properly?","options":[{"text":"Continue","detail":"The top 8 gaps by rank, this run only.","recommended":true},{"text":"Escalate","detail":"Writes a PLAN-DRAFT for Plan."}]}
```

Escalate: a `text` card for the kebab-case name (`pattern` `^[a-z0-9]+(-[a-z0-9]+)*$`, `patternHint` "kebab-case, like billing-tests"), then the finish below.

## The plan

Doc `plan`: one `md` block per runner group (`id` `group-1`, `group-2` ...), each opening with its "How this project writes tests" notes, then its gaps (method, test file, cases marked unit or integration). Then one `review` over it, `--wait`:

```jsonc
{"headline":{"stage":"Plan","cleared":3},"docs":[{"id":"plan","title":"Test plan","blocks":[{"id":"group-1","md":"## node --test\n\n### How this project writes tests\n\n- Folder: `scripts/`\n- ...\n\n### Gaps\n\n| File | Found by | Test file | Cases |\n| --- | --- | --- | --- |\n| `src/a.js` | matching | `scripts/test-a.mjs` (new) | unit: ... |"}]}],"items":[{"id":"plan-ok","kind":"review","title":"Approve the plan","doc":"plan","body":"Check the style notes and the plan together. Nothing is written until you approve.","verdicts":[{"id":"approve","label":"Write these tests"},{"id":"changes","label":"I want changes"}],"nothingYet":"Nothing is written until you approve."}]}
```

`changes`: revise the doc, reopen the item with a `thread` reply.

## Writing and running

One progress post per runner group's run, no `--wait`, with `quietMinutes` sized to its timeout (600 s is 10 minutes, plus a margin):

```jsonc
{"headline":{"stage":"Running","cleared":4},"agent":{"status":"working","activity":"Running the new launcher tests","quietMinutes":12}}
```

Logs go in `<session>/runs/<n>.log`. Run the `chat` check between runs, as a build does.

## A real bug

Per bug, one `confirm`, `--wait`: `{"id":"bug-1","kind":"confirm","title":"Found a bug","body":"`scripts/test-a.mjs` › *rounds totals* fails because `src/a.js` truncates instead of rounding. Keep the test as the reproduction for Diagnose, or remove it?","yesLabel":"Keep it","noLabel":"Remove it"}`.

## Test map

`confirm`, `--wait`: `title` "Save a test map", the rows as a table in `body`, `yesLabel` "Save it", `noLabel` "No".

## The finish

`headline` the tests added and their results ("6 tests added, all passing"); `body` the summary (scope, coverage run or skipped, files written, gaps left), ending "Commit the new tests with `/plan2code-git`."; `"dashboard":true`; no `commit`. `command` `/plan2code-diagnose` when a bug was kept (its file and case in `body`), `/plan2code-1-plan` when escalated (the PLAN-DRAFT's path in `body`), else none.

A stop before anything was written: `body` says no tests were written, `"command":"/plan2code-test"`.
