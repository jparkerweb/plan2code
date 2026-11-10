# Helpers (Subagents)

The console points here when a `Subagents:` block reaches you. On the skills that offer it (`init`, `init-update`, `pathfinder`, `plan`, `revise-plan`, `document`, `implement`, `implement-review`, `quick-task`, `review`, `finalize`, `xray`, `diagnose`, `pr-prep`, `test`, `dead-code`) the person turns helpers on or off from the top bar's Subagents button, per project and skill. It reaches you as a standing instruction, only when it changes.

## What arrives

`Subagents:` lines last in `reply` (on `wait` exit 0, `chat` exit 0 and `open`). A change alone never ends a slice.

```
Subagents: on, balanced strength, at most 3 helpers at once (a console setting, not typed by the person).
  Hand independent tasks in a phase to helpers: tasks that touch different files and do not depend on each other. ...
```

The indented lines are the skill's own instruction (or the person's); follow them. The latest block replaces an earlier one. Off arrives as one line: `Subagents: off. Start no new helpers for the rest of this session.` Nothing arrives: keep doing what the skill says. After a dashboard launch, no block means off for this skill. It never answers a card and is never recorded under `specs/`.

The standing rules:

- **On:** hand independent work to helpers if your tools allow it, at most the stated number at once (advisory: your harness's limit applies). If your tools cannot start helpers at all, report one working-alone entry (below).
- **Strength:** start each helper at the strength and effort `helper-strength.md` (in the skill's `references/`) gives for its job, following its fallback order; read it when you first start a helper. The word in the first line is the person's profile:
  - `balanced`: the table as written (default).
  - `thrifty`: one step lighter in strength and effort; reviews never below standard.
  - `best`: strongest and high effort for every helper except lookups, which stay light.
  - `session`: set no model or effort on any helper.
  When your tools cannot set them, start the helper without.
- **Off:** start no new helpers; let running ones finish and report them.
- **Pathfinder:** research questions always use helpers and are always reported, whatever the switch says. The switch governs recon, sketches and lookups.
- Helpers add no session meter points: post no `run` for them.

## Reporting helpers

Post them at your check-ins so the Subagents tab shows them (one post per change worth seeing, not a stream):

`{"helpers":[{"id":"h1","title":"Read the store helpers","ask":"Find every caller of readSubagentSetting.","state":"running"},{"id":"h2","title":"Check the tests","ask":"Run the subagents tests.","state":"done","result":"All 9 pass.","strength":"light","effort":"low"}]}`

- Required: `id`, `title` (80 characters at most), `ask` (400), `state` (`running`, `done`, `failed`). `result` (200 at most) is the line you add once it ends. `strength` (`light`, `standard`, `strongest`, `inherit`) and `effort` (`low`, `medium`, `high`) are optional: report what it actually ran with, `inherit` when its strength could not be set. Anything else is exit 3.
- Merged by `id`: post it again with the new `state` and `result`. `"helpers":null` clears the list. A dashboard hop clears it; a resume into the same skill keeps it.
- Questions for the person stay with you: a helper cannot ask.
- No way to start helpers at all: post `{"helpers":[{"id":"alone","alone":true}]}` once for the skill run. Reporting a real helper removes it. At most one.
- Before any `finish`, mark every reported helper `done` or `failed` (`console-finish.md`).
