# Standing Instructions: Helpers on the Web Console

Part of the web console contract (`console.md`). Read when a `Subagents:` block
arrives, or when your workflow notes say to report helpers.

On the skills that offer it (`implement`, `implement-review`, `quick-task`,
`review`, `pathfinder`, `plan`, `revise-plan`), the person can turn **helpers** (subagents) on or off
from the top bar's Subagents button. Their pick is saved per project and per
skill, on until switched off, and reaches you as a standing instruction, only when it
changes.

## What arrives

A `subagents` field beside `reply`, and `Subagents:` lines last in `reply`,
after the card lines, the `Quick question:` blocks and the `Workspace:` lines.
It rides on `wait` exit `0`, `chat` exit `0` and `open` output. A setting
change alone never ends a `wait` slice: it waits for the next send, or for
your next `chat` check.

```
Subagents: on (revision 2) — a console setting, not typed by the person.
  Hand independent work to helpers if your tools allow it; otherwise carry on alone.
  Report each helper on the page (console-subagents.md); questions for the person stay with you.
  If your tools cannot start helpers at all, report one "working alone" entry for this skill run instead; a real helper report removes it.
  Match each helper's strength and effort to its job, as helper-strength.md says; when your tools cannot set them, start the helper without them.
  Hand independent tasks in a phase to helpers: tasks that touch different files and do not depend on each other. Keep tasks that share files, the phase's tests and the sign-off with you. Pick each helper's strength and effort from helper-strength.md's table: light for a 1-2 file task the task file spells out, standard for multi-file or debugging work.
  Helper strength: balanced (the table in helper-strength.md as written).
  At most 3 helpers at once.
```

beside `"subagents": { "state": "on", "revision": 2, "max": 3, "instruction": "…", "strength": "balanced" }`.
The `Helper strength:` line carries the person's profile, and replaces the
Balanced default when they pick another:

- `balanced`: the table in `helper-strength.md` as written (the default).
- `thrifty`: one step lighter in strength and effort; reviews never below standard.
- `best`: strongest and high effort for every helper except lookups, which stay light.
- `session`: set no model or effort on any helper.

An edit while on arrives as `Subagents: on (revision 3, replaces revision 2) — …`
with the whole block again; switching off arrives as one line:
`Subagents: off (revision 4) — don't start new helpers for the rest of this session.`

It is a console setting, not something the person typed. It never answers a
card, and it is never recorded under `specs/`.

## Obeying it

- **On:** hand independent work to helpers if your tools allow it, at most
  `max` at once, following the instruction lines. `max` is advisory: your
  harness's own limit still applies.
- **Strength:** start each helper at the strength and effort
  `helper-strength.md` (in the skill's `references/`) gives for its job,
  following its fallback order. Read it when you first start a helper.
- **A higher revision replaces a lower one.** Follow the latest block only.
- **Off:** start no new helpers for the rest of the session. Let running ones
  finish and report them.
- **Nothing arrives:** keep doing what the skill says.
- **Scope is the skill run it arrived in.** After a dashboard launch, no block
  means the switch is off for this skill, even if an earlier skill in the same
  conversation was told "on": `open` starts the count again, and a launch with
  the switch off sends nothing.

## Reporting helpers

Post them, at your check-ins, so the page's Subagents tab can show them. The
page never hears from a helper directly:

```jsonc
{ "helpers": [
  { "id": "h1", "title": "Read the store helpers", "ask": "Find every caller of readSubagentSetting.", "state": "running" },
  { "id": "h2", "title": "Check the tests", "ask": "Run the subagents tests and report failures.", "state": "done", "result": "All 9 pass.", "strength": "light", "effort": "low" }
] }
```

- `id` (non-empty), `title` (at most 80 characters), `ask` (at most 400) and
  `state` (`running`, `done` or `failed`) are required; `result` (at most 200)
  is the one line you add once a helper ends. `strength` (`light`,
  `standard`, `strongest` or `inherit`) and `effort` (`low`, `medium` or
  `high`) are optional: report what the helper actually ran with, and
  `inherit` when its strength could not be set. Anything else is exit `3`, and
  the house rules on completion markers and metric-like words cover `title`,
  `ask` and `result`.
- Merged by `id`: post a helper again with its new `state` and `result` and it
  updates in place. `"helpers": null` clears the list. A dashboard hop clears it
  too; a resume into the same skill keeps it.
- One post per change worth seeing, not a stream.
- Questions for the person stay with you, never with a helper: most harnesses
  give helpers no way to ask, and an answer only reaches the agent holding the
  session.
- **No way to start helpers at all?** Post one `{ "id": "alone", "alone": true }`
  entry for the skill run instead. The tab then says you are working alone.
  It is a claim about your tools, not about the moment — post it only when no
  helper mechanism exists. Reporting a real helper removes it, so an early
  `alone` can never hide a later helper. At most one `alone` entry.
- **Pathfinder:** research questions always use helpers and are always
  reported, whatever the switch says. The switch governs recon, sketches and
  lookups beside the conversation.
- Helpers add no session meter points. Post no `run` for them.
- Before any `finish`, mark every reported helper `done` or `failed`
  (`console-finish.md`).
