# Launches: the Dashboard on the Web Console

Part of the web console contract (`console.md`). Read when you are the
dashboard. The dashboard skill's own prompt (`plan2code/SKILL.md`) has the
menu judgment and the launch steps; this is what the page does around them.

## A launch

```jsonc
{ "type": "submit",
  "actions": [{ "i": "__launch", "type": "launch",
                "skill": "plan2code-3-implement", "workflow": "implement",
                "spec": "specs/lunch-vote" }],
  "reply": "Start Implement (/plan2code-3-implement) for specs/lunch-vote, right here in this session.",
  "resume": "node \"…/console.mjs\" open --resume <sid> --no-open --workflow implement --spec specs/lunch-vote",
  "skillFile": "…/plan2code-3-implement/SKILL.md" }
```

`spec` is the picker's selected spec dir, present only when the launched skill
takes a spec (or is Quick Task on a `diagnosed` spec) and the person picked one. `resume` is the one command to run
first, before reading anything: it reuses the live server and turns the page
from the menu into the skill's starting screen while you read. `skillFile` is
the skill to read next (absent outside an install: then
`~/.agents/skills/<skill>/SKILL.md`).

**A session handed to you is resumed, never re-opened.** A fresh `open` would
strand the page the person is watching on the dashboard's session while your
questions went to a page nobody has open. `--title` and `--spec` are honored on
resume. A resume to or from `dashboard`, or into `git` from any skill, clears
the page: the last skill's questions, sections, docs, headline and finish are
dropped, so the new skill starts blank and posts its own. A skill run inline
from another (a quick task's review) never resumes, and keeps the page it was
handed.

> **Never hand this to a skill-invocation tool. Open its `SKILL.md` with your
> own file-read tool and follow it from the top.** Every Plan2Code skill below
> the dashboard ships `disable-model-invocation: true` on purpose, and calling
> one through a skill-invocation tool errors out and strands the hand-off.

Its Interface step is already answered by having been launched. You have read
`console.md` already: do not read it again; read only the notes or building
files its Interface names.

From the click until the resume lands, the page shows a getting-ready screen;
from the resume until the skill's first payload, its starting screen. Resume
first, and post before anything slow.

## What the page already knows

`state.scan` is `{ hasAgents, isGit, pending, specs: [{ dir, name, state, detail, touched }], handoffs, handoffsDir }`,
a snapshot of the last `open` (a spec created mid-session appears the next time
the session resumes as a dashboard). `pending` is how many files a commit would
take (`null` when git cannot say): the Git card never greys out, shows the count
when there is one, and outside a repository says Git can start one. The picker
greys the cards that do not fit the selected spec — or hides them, while the
**Hide unavailable workflows** switch under it is on (the default).

The `menu` you post (`note`, `recommend`, `details`) describes the initially
selected spec; leave any field out and the page falls back to that spec's own
next step, and it derives both again from the scan when the person switches
specs or starts fresh. Post it with `--wait`; waiting on the menu is the
person's turn by itself.

A `__stop` before a pick ends the session the usual way: `finish` (paused
headline, `"command": "/plan2code"`) then `stop` (`console-stop.md`).

`handoffs` is this checkout's unused handoffs, newest first (`[{ id, title,
next, written, spec, skill, workflow }]`, read from `~/.plan2code/handoffs/`
by `open`, a dashboard only), and `handoffsDir` is that folder. The picker shows
them as dashed **Handoff** chips after the specs.

## A pick-up

Selecting a handoff chip shows a preview and hides the skill cards. **Pick it up
here** sends a hop like a launch, naming only the id:

```jsonc
{ "type": "submit",
  "actions": [{ "i": "__pickup", "type": "pickup", "handoff": "2026-10-17-1152-handoff" }],
  "reply": "Pick up the handoff \"Lunch vote\" right here in this session.",
  "resume": "node \"…/console.mjs\" open --resume <sid> --no-open --workflow quick-task --spec specs/lunch-vote",
  "skillFile": "…/plan2code-quick-task/SKILL.md",
  "handoffFile": "~/.plan2code/handoffs/2026-10-17-1152-handoff.md" }
```

`wait` has already read the handoff's stored skill and spec, marked the handoff
used (the next scan no longer lists it) and put the command in `resume`. Run
`resume`, read `skillFile` with your file-read tool, then read `handoffFile`,
follow the skill from where its real work starts, and carry on from the
handoff's **Next task**. When the send carries `"fallback": true` the named
skill or spec was gone, or the Handoff skill wrote it: say so in one line,
since Quick Task is picking it up.
The handoff's document stays on disk until the 30-day sweep.

## A delete

The ✕ on a picker chip, after the page's two-step confirm (what goes, then
the spec's name typed), sends `{ "i": "__delete", "type": "delete", "spec":
"specs/<name>" }` with a `reply` saying it is for good. It is no hop: it
carries no `resume`, and you stay the dashboard. The console never writes into
a project, so the page only asks; delete through
`node "<CONSOLE>" delete-spec --spec <spec>`, never your own `rm`. It takes
only an existing `specs/<name>` folder inside the worktree (never a link,
never deeper, never `specs--completed/`), exits 3 with `message` on a refusal
having touched nothing, and drops the workspace remembered for that spec.
Then `open --resume <sid> --no-open --workflow dashboard` to rescan, and post
the menu again with `--wait`, its note saying what went or why it did not.
The page shows the chip as "Deleting…" until that rescan lands.

A handoff's **Delete** sends the same `__delete`, with `handoff` (its id) where a
spec has `spec`. Delete it through
`node "<CONSOLE>" delete-handoff --handoff <id>` (exit 3 with `message` when it
refuses, nothing touched), then rescan and post the menu as for a spec.
