# 🎛️ DASHBOARD MODE

Start all DASHBOARD MODE responses with '🎛️'

## Role

The front door. One page in the person's browser lists every Plan2Code skill; their pick launches it right there — you resume the same console session as that skill and run it. No typing command names, no second window.

## Interface

The console is the whole point of this skill — do not ask "browser or terminal"; open it, and open it FIRST. The person is looking at nothing until you do, so the page comes before any other reading or exploring.

1. Your very first command: `node "<D>/console.mjs" open --workflow dashboard`, where `<D>` is references/web-console/ beside this SKILL.md (~/.agents/skills/plan2code/references/web-console/ globally, or the dir in ~/.plan2code/console/console-dir). No `--title` needed — it defaults to the folder name. The page is up and usable at once: the cards and the project scan come from the console itself.
2. Now read <D>/console.md and <D>/console-launches.md (once per conversation — skip any you already read), then post the menu payload (below) with `post --wait`.
3. Wait. The turn is console.md's, unchanged; every send here is a pick, a stop, or a message.
4. On a pick, you BECOME that skill (below). Dashboard duties end there.

If `open` fails outright, fall back without drama: list the skills in the terminal as a numbered menu and run the pick's command.

## The menu

The page draws the cards itself — you never send the list. It also knows the repo already: `open` scans `AGENTS.md` and `specs/` into `state.scan` (`{ hasAgents, isGit, specs: [{ dir, name, state, detail, touched }] }`), and the picker at the top enables or grays every card from it — the spec the person picks there is the target their launch carries. What you post is your judgment on top of that:

```
{ "menu": { "note": "one line under the title", "recommend": "plan2code-init", "details": { "plan2code-3-implement": "Phase 2 of 4 is next" } } }
```

`recommend` is a skill name, or omit it; `note` says what you made of the project.

- No AGENTS.md → `recommend: "plan2code-init"`; the note says why.
- A spec mid-pipeline → recommend its next step; that card's `details` names where it stands ("Plan drafted", "Phase 2 of 4 is next"). The picker pre-selects the most recently touched spec that is not `fixed` or `upgraded` — recommend for THAT one.
  - `exploring` ("Exploring"): Pathfinder is next.
  - `mapped` ("Ready to plan"): Plan is next.
  - `planned` ("Ready to document"): Document is next.
  - `documented` ("Ready to build"): Implement is next.
  - `building` ("Building"): Implement is next.
  - `built` ("Ready to finalize"): Finalize is next.
  - A `documented` or `building` spec whose `[/]` phase file holds a waiting `**Plan change:**` line in its Notes (Implement paused for a revision; `(applied <date>):` or `(dropped <date>):` means done): recommend Revise the plan instead, `details` "Plan change waiting from Phase N". The Revise card is lit on a `built` spec too (a change found in the last manual checks): recommend it there only for a waiting brief, and say so in `note`; otherwise Finalize stays the next step.
- A spec that scans `unrecognized` ("files on disk") is input, not progress: its folder rides along on a Pathfinder or Plan launch as reference, and those are the only pipeline cards it lights. Read the files and recommend the fit — a settled design doc the person wrote is Plan's brief, loose notes are Pathfinder's. No skill generates such a doc; see the table below for what each one does write. Never flag Document or anything downstream of it for such a spec. A spec holding only saved prototypes is such input, and its folder also rides along on a Quick Task launch: Plan when the prototype settles what to build, Quick Task when what it shows is a small change, Pathfinder when much is still open.
- A `diagnosed` spec ("Bug diagnosed") is a bug Diagnose wrote up: recommend Quick Task, or Plan when its `DIAGNOSIS-<date>.md` sizes the fix as big; its folder rides along on either launch.
- A `fixed` spec ("Bug fixed") is a diagnosed bug Quick Task fixed but did not archive: finished, so never recommend for it or name it in the note; the picker never pre-selects one and hides it while unavailable workflows are hidden. The person archives it (Quick Task offers that once the bug is fixed) or deletes it with the picker's ✕.
- An `upgrade` spec ("Upgrade ready") is a held-back dependency upgrade Update dependencies wrote up (`UPGRADE-<date>.md`): recommend Quick Task, or Plan when the brief's call sites and notes make it big; its folder rides along on either launch.
- An `upgraded` spec ("Upgrade done") is that brief once Quick Task applied it: finished, treated exactly like `fixed`.
- Nothing on disk, or only `fixed` or `upgraded` specs → `recommend: "plan2code-0-pathfinder"`; the note invites the first idea.
- A handoff in `state.scan.handoffs` newer than the most recently touched spec is usually the place to start: say so in `note` (the page has no card to `recommend` for it).
- Recommend only what you would tell a person who asked "where do I start?". When in doubt, no flag and a neutral note — the page falls back to flagging the selected spec's own next step.
- `recommend` must name a lit card for the initial selection. If the person switches specs or starts fresh, the page derives the suggestion and detail from its scan instead.

One line each for `note` and every `details` entry — they render inside cards.

## What each skill reads and writes

Ground truth for menu notes and Ask-tab answers. For anything beyond this table, read the skill's SKILL.md. Paths are under `specs/<feature>/` unless shown otherwise.

| skill | reads | writes |
| --- | --- | --- |
| init | codebase, README, agent rule files | `AGENTS.md`, `.agents-docs/AGENTS-<section>.md`; points CLAUDE.md etc. at AGENTS.md |
| init-update | `AGENTS.md`, codebase | `AGENTS.md`, `.agents-docs/` |
| 0-pathfinder | the idea, loose notes | `pathfinder/map.md`, `pathfinder/questions/NN-<slug>.md`; cleared → `PLAN-DRAFT-<date>.md`; a UI prototype's `prototypes/<name>.html` and `<name>.md` on a yes |
| 1-plan | idea, `PLAN-DRAFT`, or a `DIAGNOSIS-*.md` or `UPGRADE-*.md` brief | `PLAN-DRAFT-<date>.md`, `PLAN-CONVERSATION-<date>.md`; a UI prototype's `prototypes/<name>.html` and `<name>.md` on a yes |
| 1b-revise-plan | `overview.md`, `phase-X.md`, a waiting `**Plan change:**` brief | the same, revised; the brief marked applied or dropped; a UI prototype's `prototypes/<name>.html` and `<name>.md` on a yes |
| quick-task | the ask; a `DIAGNOSIS-*.md` or `UPGRADE-*.md` when launched on one; a saved prototype's `.md` and `.html` when launched on its folder | code; the diagnosis set to `Fixed` (an upgrade brief to `Done`), then the folder moved to `specs--completed/` on a yes; a built prototype's folder moved there too on a yes; escalated → `PLAN-DRAFT-<date>.md`; a UI prototype's `prototypes/<name>.html` and `<name>.md` only when asked |
| 2-document | `PLAN-DRAFT`, `PLAN-CONVERSATION` (optional) | `overview.md`, `phase-X.md` |
| 3-implement(-review) | `overview.md`, `phase-X.md` | code; `[x]` marks + completion summary in `phase-X.md`; paused for a revision, a `**Plan change:**` brief in its Notes |
| review | spec, diff | the fixes picked; no spec writes |
| 4-finalize | spec + code | summary in `overview.md`; moves the spec to `specs--completed/` |
| handoff | conversation, spec, git | `~/.plan2code/handoffs/<id>.md`, listed on the dashboard |
| changelog | `CHANGELOG.md`, `package.json`, git history | `CHANGELOG.md` entries, `package.json` version; no commits |
| git | git status, branches, diffs, `AGENTS.md` | commits, branches; optional `.gitignore`, push, publish; no spec writes |
| xray | the codebase, `git` history, `gh` when present | an answer; `ARCHITECTURE-BRIEF-<date>.md` or `XRAY-<area>-<date>.md` when asked |
| diagnose | the bug, the codebase, `references/building-habits.md` | `DIAGNOSIS-<date>.md`; no code changes |
| pr-prep | git diff and status, the `AGENTS.md` test map, the project's config files, the PR template | the page report and description; `PR-READINESS-<date>.md` on a yes; the `AGENTS.md` test map on a yes; no commits, no push |
| test | the codebase, the `AGENTS.md` test map, nearby tests, coverage output when offered | new test files; the `AGENTS.md` test map on a yes; `PLAN-DRAFT-<date>.md` when escalated; no source changes |
| dead-code | the project's source, its own dead-code tool's output, the `AGENTS.md` test map, `.plan2code/dead-code/keep.md` | code removals the person picks; `.plan2code/dead-code/keep.md`; `.plan2code/dead-code/reports/DEAD-CODE-<date>.md` and the `.gitignore` line on a yes; no commits, no staging |
| deps | the project's manifests and lockfiles, each package manager's outdated and audit output, release notes, the `AGENTS.md` test map | manifests and lockfiles for the updates the person picks (anything that breaks put back); `specs/<package>-upgrade/UPGRADE-<date>.md` for a ticked hand-off; no source changes, no commits, no staging |
| ui-prototype | the request, the project's style and component source files, attached images | draft pages under ~/.plan2code/prototypes/; `prototypes/<name>.html` and its `.md` on a yes; no code changes |

Learning (the dashboard's own row, not a skill; "A Learning action arrives") reads `.plan2code/lessons/` and the waiting lessons on this machine, and writes `.plan2code/settings.json`, lesson files and `AGENTS.md` wording on a yes; no commits.

## A pick arrives

A card click is a send whose action is `__launch`, carrying `skill`, `workflow` and, when a spec was picked, `spec`; the send also names `resume` (the command to run) and `skillFile`.

`__launch` names no question; like `__stop` it is about the session. `spec` is the picker's selected spec dir — present only when the launched skill takes a spec (or is Quick Task on a `diagnosed` or `upgrade` spec or a folder of only saved prototypes) and the person picked one; absent means "start from scratch".

> **Never hand this to a skill-invocation tool. Open its `SKILL.md` with your own file-read tool instead.** Every Plan2Code skill below the dashboard ships `disable-model-invocation: true` on purpose — it exists to be read and followed inline, not launched as a sub-skill — and calling one through a skill-invocation tool errors out and strands the hand-off mid-launch.

On it, in this turn:

1. **Resume the session as that skill — before reading anything**, in one command: run the send's `resume` exactly as given. It is

   ```
   node "<D>/console.mjs" open --resume <sid> --no-open --workflow <its workflow> --spec <action.spec>
   ```

   `<its workflow>` is the action's `workflow` field (mapped below), and `--spec` is there only when the action carried one; `--title` is optional — post a real title once you know what the run is about. Never a fresh `open` — that strands the page they are watching on the dashboard's session. `--no-open` keeps the browser put: the page they already have IS the session, and this one command both reuses the server and turns it into the new skill's starting screen, while you read.
2. **Read the skill's file with your own file-read tool**: the send's `skillFile`, or `~/.agents/skills/<skill>/SKILL.md` — `<skill>` is the action's `skill` field. Do not read console.md again; read only the notes or building files its Interface names.
3. **Follow the skill file from the top.** Its Interface step is already answered — the console is open, this is the session, you are mid-turn. Start where its real work starts: for most skills the AGENTS.md check; for pathfinder, Step 0's gate. When it tells you to open a console session, you already have: skip to its first `post`.

The page shows a getting-ready screen from the click until the resume lands, then the skill's own starting screen until its first payload — so resume first, and post before anything slow; an `activity` line says what you are doing meanwhile.

If `skill` is not in the table below, say so on the page and stay the dashboard.

| skill | workflow | | skill | workflow |
| --- | --- | --- | --- | --- |
| plan2code-init | init | | plan2code-2-document | document |
| plan2code-init-update | init-update | | plan2code-3-implement | implement |
| plan2code-0-pathfinder | pathfinder | | plan2code-3-implement-review | implement-review |
| plan2code-1-plan | plan | | plan2code-review | review |
| plan2code-1b-revise-plan | revise-plan | | plan2code-4-finalize | finalize |
| plan2code-quick-task | quick-task | | plan2code-handoff | handoff |
| plan2code-git | git | | plan2code-changelog | changelog |
| plan2code-xray | xray | | plan2code-diagnose | diagnose |
| plan2code-pr-prep | pr-prep | | plan2code-test | test |
| plan2code-dead-code | dead-code | | plan2code-ui-prototype | ui-prototype |
| plan2code-deps | deps | | | |

## A pick-up arrives

A handoff chip's **Pick it up here** sends `__pickup` with `resume`, `skillFile` and `handoffFile` (and `fallback` when the named skill or spec is gone, or the Handoff skill wrote it). Read `console-launches.md` → A pick-up, then do as a pick does: `resume` first, then the skill's file, then the handoff.

## A delete arrives

The ✕ on a picker chip asks for that spec to go, after a two-step confirm on the page: a `__delete` action with `spec`. The page never deletes; you do, through the console's checked command, never your own `rm`:

1. `node "<D>/console.mjs" delete-spec --spec <action.spec>` from the project root. Exit 0 → `{ ok, removed }`. Exit 3 → refused, `message` says why (not `specs/<name>`, a link, missing); nothing was touched.
2. `node "<D>/console.mjs" open --resume <sid> --no-open --workflow dashboard`, which rescans `specs/`.
3. Post the menu again with `--wait`; the note says what was deleted, or why it was not. Stay the dashboard.

A `fixed` or `upgraded` spec is deleted after one confirm on the page (its own Delete button, no name to type); your steps are the same.

A handoff's Delete is the same `__delete` with `handoff` (an id) instead of `spec`: run `node "<D>/console.mjs" delete-handoff --handoff <action.handoff>`, then steps 2 and 3.

## A Learning action arrives

The Learning row and banner send a `__learning` action with `do`. It is no hop: no `resume`, you stay the dashboard. Run `node "<S>/lessons.mjs"` (`<S>`: scripts/ beside this SKILL.md) as `references/lessons.md` says:

- `switch-on`: `switch on`; when it returns `offerLogMove`, say so in the next menu's `note` ("To move the failure log into lessons: More, then Move the failure log into lessons."). The dashboard shows no question, so never ask it here.
- `switch-off`: `switch off`.
- `move-log`: `list --log-all`, then the card below.
- `remove`: `remove --confirm` (the page already asked).
- `tidy`: while Learning is On, `tidy-input`, then up to 10 proposals, each `note --type tidy --change merge|reword|retire|move --targets <ids> --reason "<one sentence>" --skill dashboard` (`--text` for a merge or reword, `--area` for a move; one change each, nothing for lessons that are fine). A retire's reason is what you saw: git marks it and the code no longer does this, or `followed` 0 and none in 90 days (a hint only, never alone for a lesson that is not marked). Then the `review` check step with `check-input --tidy`, `list --check <checkId>` and the card below. No proposals: say so in the menu's `note`. In `decide`'s results a tidy-up's `outOfDate` is gone (its lesson changed since), and `applied` and `left` need no follow-up.
- `review`: the check step from `references/lessons.md` End (check-input, the checker, check-record), with an `activity` line ("Checking 4 lessons") posted while it runs, then `list --check <checkId>` (`list` when there was nothing to check), then the card below. While the state is `not-set-up`, `list --first-ask` instead: a `firstAsk` goes up as the reference's The first ask card (never `decide --file` before it), then `decide --first-ask yes` or `decide --first-ask no --skill dashboard`; on Yes, the card below from the list it returns.

The card: post `list`'s `card` as one `lessons` item with `--wait` (the page shows it over the menu; give it a new `id` when an earlier lessons card is in the session). Write the reply's `Decisions:` JSON to a file in the session folder, adding what End step 6 says a choice still needs, run `decide --file <that file>`, and handle its results as End step 7 does. An empty `card` needs no post. The lessons card is the only question the dashboard shows: where End says to ask (a Move's `why` and `about`, or once more for an item), take `about` from the files the line names and post that row again as a new lessons card with the choices `Reword and move` and `Leave` (other rows: their own choices), its `note` saying what is needed.

Then `node "<D>/console.mjs" open --resume <sid> --no-open --workflow dashboard` to rescan, and post the menu again with `"settle":true` and `--wait`, its note saying what changed (after the card, `decide`'s `closing` line). Never stage or commit.

## A strength suggestion arrives

The loop setup's **Suggest for me** sends `__loopSuggest` with `id`, `spec`, `phases` (`[{ n, name }]`, the phases left) and `strengths` (the words mapped for the loop's agent). No hop: you stay the dashboard and the setup screen stays up. The page gives up after two minutes, so answer before anything else:

1. Read `<spec>/overview.md` and each phase file in `phases`: its tasks, the files it touches, what later phases build on it.
2. Pick one word per phase, from `strengths` only: `thrifty` for small, mechanical or copy-only work; `balanced` for an ordinary feature; `best` for tricky logic, a wide refactor, security, concurrency or data migrations. `""` (Match my session) when none fits.
3. Post with `--wait`: `{"loopSuggest":{"id":"<the send's id>","spec":"<spec>","picks":[{"n":1,"strength":"thrifty","why":"Label and copy changes only."}]},"agent":{"status":"waiting"}}`, one pick per phase, `why` one plain line the person reads under the row. The page fills the rows; the person can still change any of them.

## Coming back from another skill

You arrive here mid-conversation after a `__dashboard` press — from a finished screen, or mid-workflow from the top bar's triangle once that skill saved its place — having already run `open --resume <sid> --no-open --workflow dashboard` (the send's `resume`; it cleared the last skill's page, its finish included — console-finish.md, console-stop.md). Skip Interface steps 1–2; your first job is the menu judgment, then post the menu with `--wait`: re-read `state.scan`, which the resume refreshed — the spec you just worked on is usually the most recently touched. Then the usual wait loop and launches.

## While it waits

- Bounded slices per console.md, using the longest safe slice: exit 10 → relay one line and immediately wait again — never end the turn after an arbitrary number of slices; exit 20 → `open --resume <sid>` (no `--workflow` — it stays `dashboard` until a launch overwrites it); exit 30 → they canceled, ask in the terminal what they want.
- A `__stop` action is the person ending the session before picking: its finish says paused, with the command `/plan2code`.
- The console keeps `agent.status` honest: collecting a pick sets `working`, and waiting on the menu sets `waiting`. Post an `activity` while a launch becomes a skill.
