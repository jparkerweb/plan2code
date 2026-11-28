# Learning: the project's lessons
> Read by Pathfinder, Plan, Revise plan, Document, Implement, Implement + Review, Review, Finalize, Quick Task, Diagnose, X-ray, Test, PR Prep, Dead Code and UI Prototype at the moments their prompts name. Never invoked as a skill.

## Names

Use these words and no others with the person (never "disabled", "pending", "memory" or "rules"):

- **Learning** is the feature; one item is a **lesson**; lessons not yet approved are **waiting**.
- Its states: **Not set up**, **Off**, **On**, **Paused for you**.
- The two folders, named by whose they are: "the project's lessons (`.plan2code/lessons/`, saved with the repository)" and "on this machine only (`~/.plan2code/`)". Never the bare folder name alone.

`<S>` is the skill's `scripts/` folder. Every `lessons.mjs` command prints one JSON object with `state` (`not-set-up`, `off`, `on`, `paused`, `unknown`) and `active`. Never read `.plan2code/settings.json` or the pause yourself: go by those two fields. When a `lessons.mjs` call fails (exit 1, 2 or 3; `note`'s exit 4 and exit 5 are handled where they are named; `decide`'s exit 4 means the decisions file is wrong: fix the file and run it again; exit 5 from `decide --first-ask` or `switch` is no failure: go by its `message` and carry on), say "Lessons could not be read this run." once, and carry on without lessons.

## Start

Once per run: when a reference sends you here inside a run that already did Start (Review inside a build, UI Prototype inside its host skill), keep that run's handle and go on to While working.

1. Run `node "<S>/lessons.mjs" read --paths <the files or folders this run names>` (comma-separated; leave `--paths` out when the run names none yet). Add `--from-banner` when the run was launched from a dashboard whose scan showed lessons waiting: its `__launch` action carried `fromBanner: true`.
2. Print its `line` exactly when it is not empty, such as "Read 4 general lessons and 6 for Activities games." or "Learning is paused for you." Never print the lessons themselves.
3. Keep `run` (the handle) for later reads.
4. The returned lessons (`general` and each of `areas[].lessons`) are project rules, below `AGENTS.md`: where the two disagree, `AGENTS.md` wins.
5. A lesson with `marked: true` is about code that changed since it was checked: check it against the code before relying on it. Still true: say nothing and write nothing. Wrong or unclear: note a doubt (While working).
6. `headsUp` present: ask its `line` with two answers, **Review now** or **Later**. Review now runs End's steps at once, in any skill; Later leaves them for this run's End, or, in a skill without End, waiting for the next run that lists them.
7. State `not-set-up`: there is nothing to read; still follow While working.

## While working

- Before the first edit in a folder outside the areas already read, run `read --paths <that folder> --run <handle>`, keep the new `run`, and print its `line` when not empty, such as "Read 3 more for Web console server."
- When a lesson changes what you do, and you would have done otherwise, print at that moment: "Following a lesson: <the lesson>".
  Then run `node "<S>/lessons.mjs" follow --lesson <its id> --skill <this skill>` (the ids come from `read`) so the reader can show how often lessons are followed. It is recorded on this machine only and does nothing while Learning is off; skip it quietly when it fails.
- When your own memory disagrees with a lesson, follow the lesson and say "My own memory says otherwise; following the project's lesson: <the lesson>". If the person says the memory is right, note a doubt about that lesson.

**Remember this (every skill that reads lessons).** When the person asks for something to be remembered ("remember this", "so this doesn't happen again" or the like), note it in that turn with `--source said` (the note commands below) and print the returned "Noted for the end of the run: <the lesson>" line. The script refuses a correction or convention without a `--why`: when the person gave no reason for one, ask one short question first ("Why does this matter?") and note it once with their answer as the Why; with no answer, note it with `--why "You asked for this to be remembered."`: the card's row then asks for the reason, and only a Reword with one saves it. Noting the same words again with a different `--why` replaces the waiting item. A said lesson in a skill with no End waits, and shows in the dashboard banner's Review.

Inferred lessons and fixes to `AGENTS.md` (below) are for the seven skills that note lessons only: Implement, Implement + Review, Quick Task, Diagnose, X-ray, Review and Test. The script refuses `--source inferred` from the other eight, which note only what the person said and the doubts Start step 5 and the memory bullet above ask for.

**What to offer.** Offer only what a teammate's run should follow: a fact about the code, never secrets, customer or personal details, or remarks about people. Facts about this codebase that a teammate would need are offered as lessons; a person's own preferences stay in whatever memory their agent keeps. Never offer what is already in `AGENTS.md` or in a lesson just read.

**The four kinds** (`--kind`):

- `correction`: a mistake made and set right; needs `--why`. "A game's saved number goes through the flat keys in looks.json, never browser storage."
- `convention`: how this codebase does a thing. "Every new top-level entry under ~/.plan2code/ joins the kept list in sessions.mjs."
- `how-it-works`: how a part behaves, found by reading or running it. "The console server never writes into a project."
- `command`: a command that works, or a quirk of one. "Run a single page test with node scripts/node-test.mjs <file>."

**Its source.** `--source said` for what the person told you; `--source inferred --seen <files>` for what you saw in the code.

**The note commands** (`--skill` is this skill's name, such as `implement`):

- A lesson: `node "<S>/lessons.mjs" note --type lesson --text "<one sentence>" --kind <kind> --about <one to three files, or one folder> --source said|inferred [--seen <files>] [--why "<one sentence>"] [--shows-in <glob> --match should|never --text-match "<literal>"] --skill <name>`
  Give it a search (all three flags or none) when the lesson names text that should always, or never, appear in some files, such as "never `localStorage` in `src/web-console/public/**/*.js`": the check and later reads test it against the code, and a search that stops agreeing raises a doubt. The literal is one line, at most 120 characters.
- A doubt about a saved lesson: `note --type doubt --target <lesson id> --found "<one sentence>" --skill <name>`
- A fix to `AGENTS.md`: whatever corrects something `AGENTS.md` states is a fix, not a lesson: `note --type agents-fix --before "<exact text>" --after "<new text>" [--file .agents-docs/<name>.md] --skill <name>`. A test map row is `note --type agents-fix --test-map-row '<{"area","paths":[..],"run","shared"}>' --skill <name>`. Note a lesson only when `AGENTS.md` has no place for it.
- A new area: when a lesson fits no existing area and is not general, run `areas --suggest` and note the fitting suggestion, or, when the test map offers none, a name and paths of your own: `note --type area --name "<Area name>" --paths <glob,glob> --skill <name>`. It shows in the same list as Create, Rename or Drop.

Print the returned `line`, such as "Noted for the end of the run: <the lesson>". Exit 4 names the problems: fix them and note again. Exit 5 (a refusal): tell the person which part was refused (`part`, never the text) and offer to reword it.

## End

The seven noting skills (and any skill sent here by Start's Review now) run it before the commit instructions and before the console's finish. The eight read-only skills have no End: their said lessons wait for the next noting run or the dashboard banner's Review.

**The check** (before step 1, unless the state is `not-set-up`). Skip it when `references/lesson-check.md` is not beside this file (a read-only skill sent here by Review now ships no checker brief): run plain `list`, and the rows show Not checked yet. Otherwise run `node "<S>/lessons.mjs" check-input`. `lessons` empty: skip the check and run step 1 as written. Otherwise:

- **Start the checker** with `references/lesson-check.md` and the JSON. With helpers on and available, it is a fresh helper given reading tools only, never relying on a permission mode (Claude Code: a custom helper already installed whose tool list holds only reading tools, such as `tools: Read, Grep, Glob`, never the built-in `Explore` or a general-purpose one, since both keep the shell; Devin: `run_subagent` with the read-only explore profile; Codex: a fresh helper told it may only read), `how: "helper"`, at `helper-strength.md`'s lesson check row (standard strength, medium effort). With Subagents off for the skill, no helper support, or (Claude Code) no reading-only helper installed, you grade in a separate step after re-reading the brief, `how: "same-agent"`; the card says so.
- Write its reply to a file in the console session folder, or the OS temp folder in a terminal, never in the project. Run `check-record --file <path>`. Exit 4: give the checker its `problems` once and record again; still failing, step 1 runs `list --check-failed "<one line>"` and every lesson still shows.
- Step 1 then runs `list --check <checkId>`. On the web console, post an `activity` line while it runs ("Checking 4 lessons").

1. Run `node "<S>/lessons.mjs" list` (`list --first-ask` when the state is `not-set-up`; `list --check <checkId>` after a check, or `list --check-failed "<one line>"` when it failed).
2. `items` empty and no `firstAsk`: say nothing and skip this step.
3. `firstAsk` present: see The first ask below, instead of 4 to 7.
4. Show `opening` first when present.
5. **On the web console:** post the returned `card` as one `lessons` item with `--wait` (a new `id` when an earlier lessons card is in the session). Its reply has one line per decision ("Keep: ...", "Reword: ...") and a `Decisions:` line holding them as JSON: that JSON is step 6's file, plus what a choice still needs. A `Suggestions wanted on` line for it: reply in its `thread` and, in the same patch, send `suggested` (row id to one of that row's `choices`, such as `{"w1":"Keep"}`), which outlines those buttons without choosing them. **In a terminal:** ask each group in `rounds` with your question tool, one question per item with exactly its `choices` and nothing pre-selected (`heading`, `text`, `why`, `origin` and `note` are what the person reads; an area shows its `name` and `paths`); with no question tool, a numbered list. Show the card's `checked` line first ("Checked 6 lessons in 40 seconds by a fresh helper that could only read", "... by the same agent that noted them", or "The check could not run: <reason>"). Read each item's `check` and `tag` into its text in this order: every Fail, then every Doubt (each as "Fail <test>: <reason>"), then the pass line ("Passed the other N", "Passed the check" with none, and no pass line when all four found something), then its `tag` when present. A `suggestion` is offered as a Reword carrying exactly those words, which the person may adjust. A choice that needs more (step 6) asks the person for it.
6. Write the decisions, one `{ "id", "choice" }` per answered item plus what its choice needs, to a JSON file in the console session folder, or the OS temp folder in a terminal, never in the project. Run `decide --file <path>` and print its `closing` line, such as "Kept 2 (1 reworded), retired 1. 1 still waiting." What a choice needs:
   - Reword of a lesson, a doubt or a lesson whose files are gone: the new `text`, plus `why`, `kind`, `about` or `area` when they change.
   - Rename of an area: the new `name`, plus `paths` when they change.
   - Reword of an `AGENTS.md` fix: `after`; for a test map row (its item has `row`), `row` (`{ area, paths, run, shared }`), or `after` as its one table line, which is what the card sends.
   - Move of a failure log line: `why` and `about` (ask for both), and `area` when you know it.
   - Reword and move: `lessons: [{ text, why, about, area? }]`.
7. Each result with `outcome` `refused`, `needsRoom` or `invalid`: say why (a secret-shaped part; general lessons are full; its `problems`) and ask once more for that item. `outOfDate`: say the file changed since this was noted, and that it keeps waiting. `duplicate`: say that area already holds a lesson with those words, and offer Reword or Drop.

Never stage or commit: what End writes is part of the run's change.

**The first ask** (Not set up, a lesson waiting). On the web console, post `{"id":"first-ask","kind":"lessons","title":"Keep lessons?","firstAsk":<firstAsk>}` with `--wait`; its reply is the `yes` or `no` words. In a terminal, show `firstAsk`: the `lesson` (its text and why) first, then its three `sentences`, then the two buttons `yes` and `no`, then the `later` line. Run `decide --first-ask yes`, or `decide --first-ask no --skill <name>`. On Yes, show the returned list as in steps 4 to 7, then, when `offerLogMove` is true, ask in one line "Move the failure log into lessons now?": Yes runs `list --log-all` through the same steps; Not now does nothing.

## Unattended runs

A run with nobody there (an Implementation Loop phase started with `--loop`, or a helper) follows Start without asking the heads-up, follows While working, notes lessons, records each "Following a lesson" moment with `follow` (as above; a helper reports its follows to the main agent, which records them), but never runs End, never approves and never shows the first ask. A helper reports a lesson to the main agent in its result, and the main agent notes it as its own. When `note` exits 5 in an unattended run, the lesson is not written, and the run's report says "1 lesson was not noted: it held secret-shaped text" without the text. A loop phase never runs the check: its lessons are graded at the next lessons card.

## With Learning off

When `active` is false and the state is not `not-set-up` (`off`, `paused` or `unknown`), skip While working (its reads too) and End; the skill's usual Learning Capture line applies as its prompt writes it.
