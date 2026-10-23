# The Web Console

A local page in the person's browser where they answer your questions, read what
you have drafted, and approve things, instead of typing into the terminal.

> **Not open yet?** `node "<CONSOLE>" open --workflow <yours>` first (launched
> from the dashboard: its `resume` instead), then read on.

**Read this file once per conversation.** Every Plan2Code skill ships the same
copy (`version.json` beside it says which). If you already read it in this
conversation — from the dashboard, or from another skill's copy — do not read it
again after a hop; carry on. The topic files below are read only when their
moment comes, also once each.

**`<SKILL_ROOT>`** means the directory holding this skill's `SKILL.md`, and
`<CONSOLE>` means `<SKILL_ROOT>/references/web-console/console.mjs` (globally:
`~/.agents/skills/<skill-name>/references/web-console/`; an earlier session may
have left the directory in `~/.plan2code/console/console-dir`). `node
"<CONSOLE>" help <topic>` prints any topic file below. Always quote the path:
install paths contain spaces. Requires Node 18+; nothing to install.

**The console changes where you ask, not what you ask.** Every rule of this
workflow still applies: the same questions, the same order, the same gates, the
same cap of three questions at a time, the same recap before anything is recorded.
You are not allowed to answer your own questions just because a form makes it easy.

> **The one rule that keeps the page alive: while the session is open, every
> turn ends on a `wait` (or `post --wait`) call, never on text.** Exit `10` means
> "nobody has answered yet", not "done": relay one line and wait again in the
> same turn, as many times as it takes. A turn that ends without a `wait`
> running strands the person's next click.

## What to read, and when

All beside this file. Read one when its moment first comes, not before; when
several are due at once (a build's start), read them in one batch.

| File (`help` topic) | Read it when |
| --- | --- |
| `building.md` (`building`) | You run `implement`, `implement-review` or `quick-task`: right after `open`, then `notes/implement.md` or `notes/quick-task.md`. |
| `building-review.md` (`building-review`) | A build's review is asked for on the page (a `review` verdict, `__review`, Implement + Review's Stage 2). |
| `notes/<workflow>.md` (`<workflow>`) | Right after `open`: `init` (also init-update), `pathfinder`, `plan`, `revise-plan`, `document`, `implement` (also implement-review), `quick-task`, `review`, `finalize`, `handoff`, `changelog`, `git`, `xray`, `diagnose`. The dashboard's is `console-launches.md`. |
| `console-launches.md` (`launches`) | You are the dashboard. |
| `console-finish.md` (`finish`) | Before your first `finish` post, and when a send carries `__commit`, or `__dashboard` from a finished screen. |
| `console-stop.md` (`stop`) | A send carries `__stop`, or `__dashboard` with no finish up; or your notes say to post a `stopWarning`. |
| `console-chat.md` (`chat`) | The first time `wait` or `chat` hands you a Quick question (`chat: [...]`). |
| `console-workspace.md` (`workspace`) | `open` lists more than one folder, a `Workspace:` line arrives, or someone writes `@name`. |
| `console-subagents.md` (`subagents`) | A `Subagents:` block arrives, or your workflow notes say to report helpers. |
| `console-meter.md` (`meter`) | Only if a `run` is refused: your notes give the exact `run` to post. |
| `console-attachments.md` (`attachments`) | A file you write under `specs/` cites a note's attachment. |
| `console-trouble.md` (`trouble`) | Something goes wrong: `open` fails, a repeat delivery, a dead server. |

---

## Starting it

It needs Node 18+ on PATH (anything older exits naming the version), the
person's own machine (the page is on `127.0.0.1`; in a cloud VM or remote
sandbox do not offer it), and a foreground command of a minute at a time. When
`open` thinks the machine is remote (SSH, a dev container, a Codespace) it adds
`"remote"` and a `note`: give them the link, ask whether it opened, and move to
the terminal if not. If anything fails, say so in one line and carry on in the
terminal — that path loses nothing, and they can switch either way at any time.

1. `node "<CONSOLE>" open --workflow <w>`, where `<w>` is one of `dashboard`,
   `init`, `init-update`, `pathfinder`, `quick-task`, `plan`, `revise-plan`,
   `document`, `implement`, `implement-review`, `review`, `finalize`,
   `handoff`, `git`, `changelog`, `xray`, `diagnose`. Get it right: the page decides from it what
   to offer and what stopping costs. `--title` defaults to the folder name;
   `--spec specs/<idea>` when you already know the spec. It prints
   `{"ok":true,"sid":"...","session":"...","url":"...","terminalLine":"→ Look at the web console: ..."}`
   and opens the browser itself. `swept` is housekeeping, `workspace` and
   `subagents` are explained in their topic files.
2. Pass each patch on stdin with `--file -` (The turn, below). Where you cannot
   (PowerShell), write it to a file in the `session` folder `open` printed —
   never into the project or `~/.plan2code/console/` itself — and pass that
   path. `open --file <payload>` opens with a first payload the same way.
3. Post the first questions as soon as you have them. If getting there takes a
   while, post `{"agent":{"status":"working","activity":"Reading the plan"}}`
   first so the page says what you are doing.
4. Tell the person, in one line, the link and how many questions are waiting.
   While the session is open, end every terminal message with the latest
   `terminalLine`, verbatim.

Keep `sid`: every later command takes `--session <sid>`.

---

## The turn

```
node "<CONSOLE>" post --session <sid> --file - --wait 240 <<'EOF'
{ "settle": true, "items": [ ... ] }
EOF
```

`--file -` reads the patch from stdin: in bash or zsh a quoted heredoc
(`<<'EOF'`) saves writing a file first. PowerShell has no heredoc and its pipe
can mangle non-ASCII text, so there write the patch to a file in the session
folder and pass `--file <path>`. `post --wait <N>` posts, then waits up to `N`
seconds in the same command: use it for every post that hands the turn to the
person, so a turn costs one command. It prints the post's line (its `open` is
the required questions still open; optional cards and notices are not
counted), then the wait's; the exit code is the wait's, and exit `3` means the post was refused
and nothing waited. `--wait` with no number takes `--seconds`, else 240, so
always give one; slices under 5 seconds count as 5. Plain
`wait --session <sid> --seconds <N>` waits without posting.

**Size the slice to your shell timeout**, comfortably below its limit, so the
command returns by itself rather than being killed:

| Your limit on one command | Use |
| --- | --- |
| 5 minutes or more | `240`, with the tool timeout set to 300000 ms |
| about 2 minutes | `90` |
| 60 seconds, or you cannot tell | `45` |

Killing a wait mid-slice loses nothing; a result is marked collected only after
it is printed, so the worst case is a repeat, never a lost answer.

| Exit | Meaning | What you do |
| --- | --- | --- |
| `0` | They pressed Send, asked a Quick question, or both. stdout is the result. | Handle it (below), then post once, with `--wait`. |
| `10` | Nobody has answered yet. | Relay one line, the `message` followed by the `terminalLine`, and wait again in the same turn. |
| `20` | The server is gone. | `open --resume <sid> --workflow <yours>` (no `--no-open`: the restart has a new link, and the browser opens it), give them the new link, keep waiting. |
| `30` | They pressed Cancel. | Stop. Ask what they want, in the terminal. |
| `3` | (`post --wait` only) the post was refused; stderr says why. | Fix the patch and post again. |
| `2` | Bad usage: a flag missing its value, or a patch that is not one readable JSON object. Nothing was posted. | Fix the command or the patch and run it again. |

Do not poll faster, do not spin on `status`, and never stop after some number
of slices: people step away and come back. After a finish, keep waiting the
same way (`console-finish.md`). **Collect promptly:** a sent question is locked
on the page, and a second send is blocked, until your next post lands.

### Handling a send

```jsonc
{ "type": "submit",
  "actions": [
    { "i": "q2", "type": "answer", "kind": "choice", "k": "A" },
    { "i": "q3", "type": "comment", "text": "Please keep the header row.",
      "images": [{ "path": "/home/sam/.plan2code/console/sessions/<sid>/uploads/3f2b9c1e.jpg", "name": "header.png" }] }
  ],
  "reply": "File format: a\nNote on What to call it: Please keep the header row.\n  Image: /home/sam/.plan2code/console/sessions/<sid>/uploads/3f2b9c1e.jpg (header.png)" }
```

**`reply` is the important field**: what they would have typed in the terminal,
one line per question, every part of an answer joined by `; `. Treat it as their
typed answer and follow the workflow from there; `actions` has the same with
structure. Collecting it already set the page to "working" for you: do not post
a status first. Act on it in that turn — no asking whether to proceed, no
summary back.

A `comment` may carry `images` and `files` (`[{ path, name }]`), listed under the
note in `reply` as `Image:` / `File:` lines. **Open every path with your
file-read tool before you answer** — or say you could not read it. They live in
the session's `uploads/`; never copy one into the project yourself
(`console-attachments.md`).

An action whose `i` starts with `__` is about the session, not a question:

| Action | Read |
| --- | --- |
| `__stop` (plain, or with `handoff: true`), `__dashboard` (no finish up) | `console-stop.md` |
| `__commit`, `__dashboard` (from a finished screen) | `console-finish.md` |
| `__launch` | `console-launches.md` |
| `__delete` | `console-launches.md` (the dashboard only) |
| `__brief` | `notes/pathfinder.md` |
| `__review`, `__done` | `building-review.md` |
| `__git` | `notes/git.md` |

A hop (`__launch`, `__dashboard`, `__commit`) arrives with `resume`, the exact
command that resumes the session under the new workflow — run it as given —
and, in an installed skill, `skillFile`, the `SKILL.md` to follow next.

Then, in ONE post (with `--wait`):

- settle what they answered: `"settle": true` (below)
- reply to every note in that item's `thread`
- reply to any Quick question (`console-chat.md`)
- publish the next batch of questions

You never post the status for a turn: a post that asks a new question, and any
`wait` started with a question open (or a finish, the dashboard menu, the git
board), hands the turn over by itself (`agent.status` becomes `waiting`). Say
`"agent": { "status": "working" }` only while you work on with nothing for them
to answer, and `"agent": { "status": "waiting" }` yourself when you go back to
waiting with nothing open for them (only a doc or a notice on the page, a
brief just delivered): `wait` leaves a working agent working then, since
that is also how an agent waiting out its subagents looks.

### Replying to a note

```jsonc
{ "items": [{ "id": "p4", "thread": [
  { "who": "agent", "text": "A proxy is the server some company networks route traffic through. **Markdown** is fine." }
] }] }
```

`{ "who": "agent", "text": "<markdown>" }` — `text`, not `md`. The server already
wrote their note into the thread: send only your new entries (`thread`
appends). Answer what they asked in the thread, even when you also change a doc
or re-ask; "I've updated the doc" alone leaves their question unanswered.

### Recording the answer

`"settle": true` marks every card from their latest send `answered`, with the
answer they sent. `"settle": ["q2"]` names the cards instead — use it when only
some are final (a pick that still owes its recap stays open). A card the same
post reopens is never settled. To record a
reading of your own, also send the item with its `answer` (it wins):
`{ "k": "A" }`, `{ "ks": ["A","C"] }`, `{ "text": "audit-export" }`,
`{ "yes": true }`, `{ "verdict": "changes", "text": "..." }`,
`{ "done": [0,1], "state": "done" }`, `{ "rows": [...] }`. A settled card turns
into a record ("A · Continue without it"), so settle every card you are done
with — one left open stays on the page as a question still owed.

---

## Posting an update

```
node "<CONSOLE>" post --session <sid> --file <patch.json | -> [--wait <N>]
```

The patch merges: scalars replace, `null` deletes a key, `items` / `topics` /
`docs` and a doc's `blocks` merge by `id` (an unknown id is added), `thread`
appends. **Send only what changed.** Never write a timestamp: the server stamps
them. A refused patch is exit `3` with the reason on stderr; nothing is
written.

While you work through a long stretch, say so:
`{"agent":{"status":"working","activity":"Reading the plan"}}` — one plain
sentence, shown in place of "thinking". The page calls a working agent stuck
after two silent minutes: expecting longer, add `"quietMinutes": <1-60>` to
`agent`. It only counts while you are working, so set it once.

`run` (session meter, `console-meter.md`), `folderIssue`
(`console-workspace.md`) and `helpers` (`console-subagents.md`) are top-level
keys too; `run` and `folderIssue` go to the session's ledger, never the page.

---

## The payload

```jsonc
{
  "title": "Audit export",
  "headline": { "stage": "Working", "cleared": 4, "total": 9,
                "confidence": "Looking solid, but one area still needs work.",
                "note": "optional sentence shown above the list" },
  "topics": [ { "id": "t2", "title": "How it behaves", "status": "current" } ],
  "items": [ /* the kinds below */ ],
  "docs": [ /* Documents, below */ ],
  "finish": { /* only at the end: console-finish.md */ },
  "agent": { "status": "waiting" }
}
```

Fill in `headline.cleared` / `total`: the progress bar is the first thing anyone
looks at. `confidence` is a plain-English sentence, never raw scores. Post
`"specDir": "specs/<idea>"` once the folder exists (or pass `--spec` to
`open`): the page builds a resume command from it if you ever cannot answer a
stop. `stopWarning` is in `console-stop.md`.

### Every item

**Every new question gets a new `id`**, for the whole session.

```jsonc
{
  "id": "q7",
  "topic": "t2",
  "kind": "choice",
  "title": "Export format",        // 2-4 plain words a newcomer understands
  "body": "The question, in markdown, with why it matters.",
  "required": true,                // false adds a "Skip this one" link
  "doc": "report",                 // optional: a "Read ... in full" button for that doc
  "status": "open",                // open | answered | reopened | skipped
  "token": { "A": "approved" }     // optional: the typed word an answer stands for
}
```

`token` is only needed where the terminal word differs from the option's `k`
or verdict `id`: without it, `reply` uses the key itself.

### The kinds

| `kind` | Use it for | Extra fields | You get back |
| --- | --- | --- | --- |
| `choice` | one of several | `options[]`, `allowOther` | `{ k }` **or** `{ text }` |
| `multi` | any number of several | `options[]`, `presets[]` | `{ ks[], text? }` |
| `text` | free text | `placeholder`, `help`, `pattern`, `patternHint`, `templates` | `{ text }` |
| `confirm` | yes or no | `yesLabel`, `noLabel`, `danger`, `consequences` | `{ yes, text? }` |
| `recap` | play decisions back for agreement | `summary` (markdown) | `{ ok, text? }` |
| `review` | read something, then approve | `doc` (always), `summary`, `verdicts[]` (each `{ id, label, danger? }`: `label`, not `text`), `nothingYet` (the line under the buttons; defaults to "Nothing has been changed yet…", so `false` when the change is already on disk) | `{ verdict, text? }` |
| `checklist` | steps only they can do | `steps[]`, `valuesLabel` | `{ done?[], state?, text? }` (each left out when nothing was ticked or picked) |
| `menu` | what to do next | `options[]`, `command` | `{ k }` |
| `list` | reorder or edit a breakdown | `rows[{id,title,body}]` | `{ rows[] }`, or `{ text }` when they changed nothing; `reply` names renames, additions and removals |
| `notice` | something to read, no answer | — | nothing |

An option is `{ "k": "A", "text": "short label", "detail": "the trade-off", "recommended": true }`.
`detail` is the difference between a person choosing and a person guessing.

- **`choice`**: one of the two, never both. The page offers "Something else, in
  your own words" in the same radio group; read `k` if it is there, otherwise
  `text`. `"allowOther": false` drops it when the options are the whole set.
- **`multi`**: `text` joins the ticks rather than replacing them. `presets`
  (`[{ "label": "Critical and warnings", "ks": ["1","2"] }]`) only tick boxes.
- **`pattern`** is a JavaScript regex checked as they type, with `patternHint`
  shown when it fails. Use it for anything with a shape, above all kebab-case.
- **A placeholder is an offer.** The **Autofill suggestion** button drops it
  into the box as a real answer (a lead-in like "For example:" is stripped), so
  write a whole example in their voice, one that satisfies any `pattern`.
- **Starter templates:** on the `text` card that asks for a **fresh idea** in
  Pathfinder, Plan and Quick Task, add `"templates": "idea"` (any other kind or
  value is exit 3). Launched with notes or an idea as the argument? Still set
  it, with a one-line summary in `placeholder`. A resumed map, PLAN-DRAFT or
  checkpoint gets no idea card. Only the box's text comes back; never mention
  templates in the terminal.
- **Recommend only when you genuinely know better and can say why.** "Which
  format survives Excel?" is yours; "Who is this for?" is not — there a
  recommendation is an anchor people rubber-stamp. At most one per question.

Items appear in the order you send them, and the person walks the open ones with
Previous / Next: send them in the order you want them answered.

### Documents

```jsonc
"docs": [{
  "id": "map", "title": "What we've agreed",
  "note": "what changed in this version",
  "saved": "specs/lunch-vote/pathfinder/map.md",
  "blocks": [
    { "id": "b1", "state": "settled", "md": "## Where we're headed\n\n..." },
    { "id": "b2", "state": "assumed", "md": "### File format\n\nAssuming CSV..." },
    { "id": "b3", "state": "draft",   "md": "### Still to work out\n\n- ..." },
    { "id": "b4", "file": "specs/lunch-vote/overview.md" }
  ]
}]
```

Each doc is a tab. Patch blocks as decisions land: `{ "id": "b2", "state":
"settled" }` settles b2 and keeps its text, blocks you leave out stay, a new id
goes at the end, `{ "id": "b3", "_delete": true }` removes one (a doc entry
with `"_delete": true` removes the whole tab).

- **`state`**: `settled` (decided), `assumed` (picked to keep going, still open:
  shown dashed, "Assumed for now"), `draft` (dimmed). Marking assumptions
  honestly is what stops a half-finished doc reading as decisions.
- **`file`** instead of `md`: the console reads the block's text from that file
  (relative to the project, never outside it). Re-send the block, or the doc
  with `"refresh": true`, after the file changes. `"select": "tasks"` keeps only
  its `- [ ] **Task N.M:**` lines. Never paste a file you could name.
- **`image`** instead of `md`: `{ "id", "image": "shots/run.png", "alt": "..." }`
  shows a PNG, JPEG or WebP (5 MB at most) saved directly in the session's
  `shots/` folder (the `session` path `open` printed), named with letters,
  digits, `.`, `_` or `-`; anything else is exit `3`.
- **`version`** moves by itself: a known doc whose content changed is the next
  version. Send one only to jump; it never goes back. Write a one-line `note`
  when you change a doc, and `"stale": true` while answers it does not reflect
  have landed.
- **`saved`** is the path of the file the doc mirrors, when one exists: the page
  shows the path instead of a download. Leave it off docs that exist only here.

---

## House rules the server enforces

A patch that breaks one is refused, exit `3`, with the reason:

1. **At most three questions open at once.**
2. **No internal vocabulary in a title**: *grill*, *frontier*, *fog*, *HITL*,
   *durable*, `Locked:`, `Blocked by:`.
3. **At most one recommended option per question.**
4. **No loop completion markers** (`TASK_COMPLETE`, `PHASE_COMPLETE` and the rest).
5. **No bare `Requirements` / `Feasibility` / `Integration` / `Risk` followed by a
   number** (the metrics collector scrapes that): hyphenate or reword. Rules 4
   and 5 skip `file` blocks: those words are already on disk.
6. **Chat replies hold together** (`console-chat.md`).
7. **`run`, `folderIssue` and `helpers` are well formed** (their topic files).
8. **A doc's `version` never goes back.**
9. **A finish `command` has no placeholders** (`<` or `>`).
10. **Every note gets a reply.** A card whose thread ends with the person's own
    words stays that way until a patch adds an agent reply to it; settling or
    reopening it does not count. Exempt once the item is deleted, or the whole
    session is ending.

---

## Ending

Every session end — done, a pause, a stop request, an off-ramp — posts a
`finish` **before** `stop`, and every ending but a pause keeps waiting for the
person's last button. Read `console-finish.md` before your first finish post:
it has the fields, the dashboard button and the order. Before any finish, every
subagent or background job you started must have reported back.

---

## Worked example

The first questions of a pathfinder session, piped in with `post --file - --wait 240`:

```json
{
  "title": "Audit export",
  "headline": { "stage": "Charting", "cleared": 0, "total": 6 },
  "items": [
    { "id": "q1", "kind": "choice", "title": "What you end up with",
      "body": "When this is done, what exists that does not exist now?",
      "options": [
        { "k": "A", "text": "A plan, ready to build from", "detail": "We write the decisions down. Nothing is built yet.", "recommended": true },
        { "k": "B", "text": "A change already made", "detail": "Small enough to just do. We would skip planning entirely." }
      ] },
    { "id": "q2", "kind": "text", "title": "Who uses it",
      "body": "Who uses the result, and what do they do with it the day it lands?",
      "placeholder": "For example: compliance reviewers, who open it in Excel every Monday." }
  ]
}
```

It lands and waits in one command; the new questions make it the person's turn.
