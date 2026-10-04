# 🎛️ DASHBOARD MODE

Start all DASHBOARD MODE responses with '🎛️'

## Role

The front door. One page in the person's browser lists every Plan2Code skill; their pick launches it right there — you resume the same console session as that skill and run it. No typing command names, no second window.

## Interface

The console is the whole point of this skill — do not ask "browser or terminal"; open it, and open it FIRST. The person is looking at nothing until you do, so the page comes before any other reading or exploring.

1. Your very first command: `node "<D>/console.mjs" open --workflow dashboard`, where `<D>` is references/web-console/ beside this SKILL.md (~/.agents/skills/plan2code/references/web-console/ globally, or the dir in ~/.plan2code/console/console-dir). No `--title` needed — it defaults to the folder name. The page is up and usable at once: the cards and the project scan come from the console itself.
2. Now read <D>/console.md, then post the menu payload (below).
3. Wait. The wait loop is console.md's, unchanged; every send here is a pick, a stop, or a message.
4. On a pick, you BECOME that skill (below). Dashboard duties end there.

If `open` fails outright, fall back without drama: list the skills in the terminal as a numbered menu and run the pick's command.

## The menu

The page draws the cards itself — you never send the list. It also knows the repo already: `open` scans `AGENTS.md` and `specs/` into `state.scan` (`{ hasAgents, specs: [{ dir, name, state, detail, touched }] }`), and the picker at the top enables or greys every card from it — the spec the person picks there is the target their launch carries. What you post is your judgment on top of that:

```jsonc
{
  "menu": {
    "note": "one line under the title — what you made of the project",
    "recommend": "plan2code-init",          // a skill name, or omit
    "details": { "plan2code-3-implement": "Phase 2 of 4 is next" }
  },
  "agent": { "status": "waiting" }
}
```

- No AGENTS.md → `recommend: "plan2code-init"`; the note says why.
- A spec mid-pipeline → recommend its next step; that card's `details` names where it stands ("Plan drafted", "Phase 2 of 4 is next"). The picker pre-selects the most recently touched spec — recommend for THAT one.
- A spec that scans `unrecognized` ("files on disk") is input, not progress: its folder rides along on a Pathfinder or Plan launch as reference, and those are the only pipeline cards it lights. Read the files and recommend the fit — a settled design doc the person wrote is Plan's brief, loose notes are Pathfinder's. No skill generates such a doc; see the table below for what each one does write. Never flag Document or anything downstream of it for such a spec.
- Nothing on disk → `recommend: "plan2code-0-pathfinder"`; the note invites the first idea.
- Recommend only what you would tell a person who asked "where do I start?". When in doubt, no flag and a neutral note — the page falls back to flagging the selected spec's own next step.
- `recommend` must name a lit card for the initial selection. If the person switches specs or starts fresh, the page derives the suggestion and detail from its scan instead.

One line each for `note` and every `details` entry — they render inside cards.

## What each skill reads and writes

Ground truth for menu notes and Ask-tab answers. For anything beyond this table, read the skill's SKILL.md. Paths are under `specs/<feature>/` unless shown otherwise.

| skill | reads | writes |
| --- | --- | --- |
| init | codebase, README, agent rule files | `AGENTS.md`, `.agents-docs/AGENTS-<section>.md`; points CLAUDE.md etc. at AGENTS.md |
| init-update | `AGENTS.md`, codebase | `AGENTS.md`, `.agents-docs/` |
| 0-pathfinder | the idea, loose notes | `pathfinder/map.md`, `pathfinder/questions/NN-<slug>.md`; cleared → `PLAN-DRAFT-<date>.md` |
| 1-plan | idea or `PLAN-DRAFT` | `PLAN-DRAFT-<date>.md`, `PLAN-CONVERSATION-<date>.md` |
| 1b-revise-plan | `overview.md`, `phase-X.md` | the same, revised |
| quick-task | the ask | code; escalated → `PLAN-DRAFT-<date>.md` |
| 2-document | `PLAN-DRAFT`, `PLAN-CONVERSATION` (optional) | `overview.md`, `phase-X.md` |
| 3-implement(-review) | `overview.md`, `phase-X.md` | code; `[x]` marks + completion summary in `phase-X.md` |
| review | spec, diff | the fixes picked; no spec writes |
| 4-finalize | spec + code | summary in `overview.md`; moves the spec to `specs--completed/` |
| handoff | conversation, spec, git | `<timestamp>-handoff.md` (OS temp or `handoffs/`) |

## A pick arrives

A card click is a send whose action carries the skill:

```jsonc
{ "type": "submit",
  "actions": [{ "i": "__launch", "type": "launch",
                "skill": "plan2code-3-implement", "workflow": "implement",
                "spec": "specs/lunch-vote" }],
  "reply": "Start Implement (/plan2code-3-implement) for specs/lunch-vote, right here in this session." }
```

`__launch` names no question; like `__stop` it is about the session. `spec` is the picker's selected spec dir — present only when the launched skill takes a spec and the person picked one; absent means "start from scratch". On it, in this turn:

1. **Resume the session as that skill — before reading anything**, in one command:

   ```
   node "<D>/console.mjs" open --resume <sid> --no-open --workflow <its workflow> --spec <action.spec>
   ```

   `<its workflow>` is the action's `workflow` field (mapped below). Pass `--spec` only when the action carried one; `--title` is optional — post a real title once you know what the run is about. Never a fresh `open` — that strands the page they are watching on the dashboard's session. `--no-open` keeps the browser put: the page they already have IS the session, and this one command both reuses the server and turns it into the new skill's starting screen, while you read.
2. **Read the skill's file.** Installs put every skill beside this one at `~/.agents/skills/<skill>/SKILL.md` — `<skill>` is the action's `skill` field.
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

## Coming back from another skill

You arrive here mid-conversation after a `__dashboard` press — from a finished screen, or mid-workflow from the top bar's triangle once that skill saved its place — having already run `open --resume <sid> --no-open --workflow dashboard` and posted `"finish": null` with the menu (console.md → Finishing; Stop requests → "Back to the dashboard, mid-workflow"). Skip Interface steps 1–2; your first job is the menu judgment: re-read `state.scan`, which the resume refreshed — the spec you just worked on is usually the most recently touched. Then the usual wait loop and launches.

## While it waits

- Bounded slices per console.md, using the longest safe slice: exit 10 → relay one line and immediately wait again — never end the turn after an arbitrary number of slices; exit 20 → `open --resume <sid>` (no `--workflow` — it stays `dashboard` until a launch overwrites it); exit 30 → they cancelled, ask in the terminal what they want.
- A `__stop` action is the person ending the session before picking: post `finish` (a headline that says paused, `"command": "/plan2code"`) then `stop`, per console.md → Stop requests.
- Keep `agent.status` honest: `waiting` while the menu is theirs, `working` with `activity` while a launch becomes a skill.
