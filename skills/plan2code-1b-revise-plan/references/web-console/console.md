# The Web Console

A local page in the person's browser where they answer your questions, read what
you have drafted, and approve things, instead of typing into the terminal.

> **Not open yet? Open it now, then read on.** Once the person has picked the
> browser (or passed `--web`, or launched this from the dashboard's menu — then
> resume instead, see Launches), `node "<CONSOLE>" open --workflow <yours>` is
> your very next command: before this file, before the project, before any
> thinking about the first question. It returns in well under a second, the
> browser is already on its way while it runs, and the page shows a starting
> screen that names the skill until your first `post` replaces it. Every second
> spent reading first is a second the person stares at a terminal.

**`<SKILL_ROOT>`** below means the directory holding this skill's `SKILL.md`, and
`<CONSOLE>` means `<SKILL_ROOT>/references/web-console/console.mjs`. If you do not
know where the skill was loaded from: a global install puts every Plan2Code
skill under `~/.agents/skills/<skill-name>/` (this file sits at
`~/.agents/skills/<skill-name>/references/web-console/console.md`), and an
earlier session may have left this console's directory in
`~/.plan2code/console/console-dir`. `node "<CONSOLE>" help` prints a summary
of this file. Always quote the path: install paths contain spaces.
Requires Node 18+. Nothing to install, no dependencies, no build step.

**The console changes where you ask, not what you ask.** Every rule of this
workflow still applies: the same questions, the same order, the same gates, the
same cap of three questions at a time, the same recap before anything is recorded.
You are not allowed to answer your own questions just because a form makes it easy.

> **The one rule that keeps the page alive: while the session is open, every
> turn ends on a `wait` call, never on text.** `wait` exit `10` means "nobody
> has answered yet", not "done": relay one line and run `wait` again in the
> same turn, as many times as it takes. A turn that ends without a `wait`
> running strands the person's next click. Details: The wait loop, below.

---

## Deciding whether to use it

### First, whether it can work here

Nothing below is specific to one agent or one harness: it is `node`, a loopback
port, and seven subcommands (`open`, `post`, `wait`, `chat`, `keep`, `status`,
`stop`). But three things have to be true, and two of them
you can check before you offer anything.

1. **Node 18 or newer is on PATH.** `node --version`. Anything older exits with
   a message naming the version it found.
2. **You are running on the person's own machine.** The page is served on
   `127.0.0.1`, so their browser can only reach it if that is their machine too.
   If you know you are in a cloud VM or a remote sandbox, do not offer it at
   all: a link they cannot open is worse than no link. For the cases you cannot
   know, `open` checks for you and adds `"remote": "<signal>"` and a `note` to
   its output when the environment looks like SSH, a dev container, a Codespace
   or Gitpod. It still starts, because a forwarded port often works. When you
   see that field, give them the link, ask whether it opened, and move to the
   terminal if it did not.
3. **You can run a foreground command for a minute at a time** and read its exit
   code. See the wait loop.

If any of those fail, say so in one line and work in the terminal. That path is
fully supported and loses nothing.

### Then, ask

Ask once, at the start, through the structured question tool if you have one.
If you have none, ask it as an ordinary numbered question in prose. Either way
it is one question with two answers:

> **How would you like to work through this?**
>
> - **In your browser** (suggested) — a page opens with the questions laid out,
>   what we have agreed so far, and everything saved as you go. Easier to follow,
>   and far easier if you are walking through this with someone else.
> - **Here in the terminal** — one question at a time, right where you are.

If they pick the terminal, ignore the rest of this file. If the console fails to
start for any reason, say so in one line and carry on in the terminal: never let
this block the session.

Either way, tell them they can switch whenever they like, because they can. The
files under `specs/` are the only source of truth, and neither channel owns them.

---

## Starting it

1. Run `open` — do it now, even before the first question exists, and before
   you have read the project. `--file` is optional, and a session with nothing
   on it shows them a starting screen ("Starting Pathfinder", Planny in
   flight) until your first `post` lands. `--title` is optional too: it
   defaults to the project's folder name, and you can post a real `title`
   once you know what the session is about:
   ```
   node "<CONSOLE>" open --workflow pathfinder
   ```
   `--workflow` is whichever you are running: `dashboard`, `init`,
   `init-update`, `pathfinder`, `quick-task`, `plan`, `revise-plan`,
   `document`, `implement`, `implement-review`, `review`, `finalize` or
   `handoff`. Get it
   right: the page decides from it whether to offer a brief, what stopping
   early costs, and which command resumes the session if you cannot say.
   `dashboard` is the special one: the page draws the skill menu itself, and
   your job is the `menu` payload and the launch hand-off — see the workflow
   notes.
   It prints one line: `{"ok":true,"sid":"...","session":"...","url":"http://127.0.0.1:PORT/s/TOKEN/","terminalLine":"→ Look at the web console: http://127.0.0.1:PORT/s/TOKEN/"}`.
   It also tries to open the browser by itself. When it removed session
   folders or scratch files older than 30 days, the line also carries
   `swept: { sessions, scratch }` — housekeeping, nothing to relay to the
   person.

   To open with questions already on the page instead, write the payload to a
   temporary JSON file first — a file, not a heredoc, because heredocs do not
   work in PowerShell, which is the default shell on Windows — and pass it as
   `--file <payload.json>`. Opening first is the better order: the page is in
   front of them while you work out what to ask, instead of after.

   Write temporary payload files into the session's own folder (the `session`
   path `open` prints), never into the project or into
   `~/.plan2code/console/` directly. The session folder is removed with the
   session after 30 idle days, and stray `.json` / `.mjs` files left in the
   console folder are swept on the same clock.

   **Building?** For `implement`, `implement-review` and `quick-task`, also read
   `building.md` beside this file once the session is open. A build is mostly you
   working rather than asking, and that file covers the progress the page
   shows, the sign-off and the review offer it carries, and the review button
   after a finished quick task.

2. If you opened without `--file`, post the first batch of questions as soon
   as you have them (see Posting an update). If getting there takes a while
   (reading the project, finding the spec), post an `agent.activity` line
   first so the page says what you are doing. Either way, tell the person, in plain
   words, on one line: the link, and how many questions are waiting. Repeat the link in your
   message text, not only in a command output, because terminal scrollback
   gets lost. While a console session is open, end every terminal message
   with the latest `terminalLine` from `open`, `post` or `wait`, verbatim
   (`→ Look at the web console: <url>`).

3. Go into the wait loop below.

Keep `session` (the session id). Every later command needs `--session <sid>`.

---

## The wait loop

This is the part that matters most. **Never try to block for the whole time a
person takes.** Call `wait` in bounded slices and read the exit code.

```
node "<CONSOLE>" wait --session <sid> --seconds 240
```

**Size the slice to your own shell timeout, not to this example.** Use the
longest slice your harness safely allows, with `--seconds` comfortably below
its single-command limit, so the command returns by itself rather than being
killed:

| Your limit on one command | Use |
| --- | --- |
| 5 minutes or more | `--seconds 240`, with the tool timeout set to 300000 ms |
| about 2 minutes | `--seconds 90` |
| 60 seconds, or you cannot tell | `--seconds 45` |

Shorter slices only mean more of them. `wait` is a poller that holds nothing:
killing it mid-slice loses nothing, and neither does starting the next one. A
result that has been handed over is marked collected only after it is printed,
so even a kill at the worst possible moment costs you a repeat, never an answer.

| Exit | Meaning | What you do |
| --- | --- | --- |
| `0` | They pressed Send, or asked a Quick question. stdout is the result JSON, and may carry `workspace` (changes to the folder list, see Workspace). | Handle the cards (if any), the chat (if any) and any `workspace` changes, then post once (below, Quick questions and Workspace). |
| `10` | Still working. stdout has a short progress summary; `pendingWorkspace` counts workspace changes waiting for the next send. | Relay ONE line: the `message` field itself, "Waiting on your answer in the web console", followed by the `terminalLine`. Then call `wait` again. |
| `20` | The server is gone. | `open --resume <sid>`, give them the new link, then keep waiting. |
| `30` | They pressed Cancel. | Stop. Ask what they want to do, in the terminal. |

Do not poll faster than this. Do not spin on `status`. Exit 10 is not a finished
turn: never emit a final response or stop after an arbitrary number of slices;
relay one line and immediately call `wait` again. Do not give up: people step
away from a session and come back. The same holds after a `finish`: keep
waiting (resuming the server on exit `20`) until the dashboard or done press
or about ten minutes with nothing, because the Ask tab stays live and its
messages only arrive through `wait`. Ending your turn earlier strands them.

**The turn never ends on a wait.** While a console session is open, including
after a finish that offers a button (Back to the dashboard, Review it now), the
last thing in every turn you take is a `wait` call, never a line of text. The
line you relay after exit `10` goes in the same turn as the next `wait`, so
write it and call `wait` straight after. A turn that ends with the session open
and no `wait` running is a bug the person feels at once: their button press
sits unread until they ask why. If you catch yourself about to write a closing
summary while the page is still open, call `wait` first.

**Collect promptly.** A question someone has sent is locked on the page for as
long as you are mid-turn on it: they can read, move around and answer the other
open questions, but not that one, because a change made then would reach nobody.
It unlocks the moment your update lands, whether you settled the question or
replied and left it open. Until then a send is also blocked outright, so a slow
turn of yours is a person sitting on their hands. `open` and `status` both
report `pendingResult: true` while one is waiting to be picked up.

### Handling a send

The result looks like this:

```jsonc
{
  "type": "submit",
  "actions": [
    { "i": "q2", "type": "answer", "kind": "choice", "k": "A" },
    { "i": "q3", "type": "answer", "kind": "text", "text": "audit-export" },
    { "i": "q3", "type": "comment", "text": "Please keep the header row.",
      "images": [{ "path": "/home/sam/.plan2code/console/sessions/20260923-101500-ab12cd/uploads/3f2b9c1e-8a4d-4f6e-9b7a-2c5d1e0f4a6b.jpg", "name": "header.png" }],
      "files": [{ "path": "/home/sam/.plan2code/console/sessions/20260923-101500-ab12cd/uploads/7c1d0a4e-5b2f-4e8a-9d3c-1f6e2b8a0c5d.pdf", "name": "api-spec.pdf" }] }
  ],
  "reply": "File format: a\nWhat to call it: audit-export\nNote on What to call it: Please keep the header row.\n  Image: /home/sam/.plan2code/console/sessions/20260923-101500-ab12cd/uploads/3f2b9c1e-8a4d-4f6e-9b7a-2c5d1e0f4a6b.jpg (header.png)\n  File: /home/sam/.plan2code/console/sessions/20260923-101500-ab12cd/uploads/7c1d0a4e-5b2f-4e8a-9d3c-1f6e2b8a0c5d.pdf (api-spec.pdf)"
}
```

**`reply` is the important field.** It is what the person would have typed in the
terminal, one line per question, built from the `token` map you supplied. Treat it
as their typed answer and follow the normal workflow from there.

Every part of an answer survives into it, joined by `; ` when there is more than
one: a verdict and the note that came with it, a checklist state and what they
wrote down, a reordered list and its new order. `actions` carries the same thing
with structure, for when you need the detail.

A `comment` action may carry `images` and `files`, each `[{ path, name }]`:
screenshots in the first, text, code and PDF documents in the second. `reply`
then has one `  Image: <path> (<name>)` or `  File: <path> (<name>)` line per
attachment under the note, in the order they were attached. **Open every path
with your file-read tool before you answer the note** — it is what they are
pointing at. If a file cannot be read (your tool does not read PDF, say), tell
them so in your reply rather than guessing what is in it. The files live in the
session's `uploads/`, outside the project; never copy them into it yourself — see Keeping attachments.

A send is the person talking to you. Act on it in that turn: do not wait for
terminal input to confirm it, do not ask whether to proceed, do not merely
summarise it back.

Then, in ONE `post`, do all of:

- mark each answered item `"status": "answered"` and record its `answer`
- add your replies to any comment threads
- answer any Quick questions that came with it, in `chat.replies` (see Quick
  questions)
- publish the next batch of questions
- set `"agent": { "status": "waiting" }`

One post is one atomic update, so the page never shows a half-changed state.

### Recording the answer

`answer` takes the same shape the item gave back: `{ "k": "A" }`, `{ "ks": ["A","C"] }`,
`{ "text": "audit-export" }`, `{ "yes": true }`, `{ "verdict": "changes", "text": "..." }`,
`{ "done": [0,1], "state": "done" }`, `{ "rows": [...] }`.

A settled question stops being a form and becomes a record: the page states the
answer back in its own words ("A · Continue without it"), marks the option they
picked, and locks everything else. That is the whole point of settling one, so
record the answer every time.

The server writes what they sent onto the item as `submitted` when Send is
pressed, and the page falls back to it, so a question you forget is not a blank
card. Treat that as the safety net it is, not as a reason to leave `answer` out:
`submitted` is the raw click, while `answer` is what you decided it meant, and
only the second survives you reopening or rewording the question.

---

## Keeping attachments

Note attachments live in the session's `uploads/`, which is swept after 30 idle days. Before you write any file under `specs/<idea>/` that links to or cites one (plans, the overview, phase files, Pathfinder question files and the map), keep it first:

```
node "<CONSOLE>" keep --session <sid> --upload <path> --name <name> --spec specs/<idea> --from <the file you are writing>
```

`path` and `name` are the attachment's, from the `comment` action. It prints `{ ok, path, link, image, reused }`. Paste `link` as it is: `![name](link)` for an image, `[name](link)` for a document. The same upload always gets the same name (`attachments/<slug>-<8-char id>.<ext>`), so keeping it again just reuses the copy. Name the kept file in your next update. Leave uncited attachments where they are. Quick-question attachments are never kept. Exit 3 means the path was refused. Say so, and link nothing.

---

## Briefs (Pathfinder only)

The page shows a **Write a brief** button when `workflow` is `pathfinder`,
because that is the workflow with a brief playbook. The person picks a range and
presses it; nothing else about the session changes.

It arrives through the wait loop like any other send:

```jsonc
{
  "type": "submit",
  "actions": [{ "i": "__brief", "type": "brief", "range": "since 2026-09-15" }],
  "reply": "Write a brief covering everything since 2026-09-15."
}
```

`range` is one of `today`, `this week`, `since <YYYY-MM-DD>` or `full`, which is
the range grammar the brief playbook already parses. `reply` says the same thing
in words, so a workflow that only reads `reply` needs no new code path. The
`__brief` id is not an item and matches nothing; it marks the action as being
about the session rather than about a question.

Run your normal brief procedure, write the file where it belongs, and then put
the same report on the page as a doc:

```jsonc
{
  "docs": [{
    "id": "brief",
    "title": "Brief",
    "version": 2,
    "note": "Covers this week",
    "blocks": [{ "id": "body", "state": "settled", "md": "# ...the whole brief..." }]
  }],
  "agent": { "status": "waiting" }
}
```

One block holding the whole report is right here: a brief is read start to
finish, not block by block, and it gets Save as HTML, Print and Save buttons
that work on the document as a whole. Save as HTML appears only on the doc with
the id `brief`. Reuse the id `brief` so a second brief replaces the first
rather than growing a row of tabs, and bump `version`.

Say in chat where the file went, as you always would. The page is a second copy
for reading and printing, never the record.

---

## Stop requests

The page has a **Stop session** button. Pressing it sends, in one submit, any
answers the person had staged plus one more action:

```jsonc
{ "type": "submit",
  "actions": [ /* staged answers and notes, as usual */,
               { "i": "__stop", "type": "stop" } ],
  "reply": "...the answer lines...\nStop here and save my place, so I can pick this up later." }
```

`__stop` is not an item and matches nothing; like `__brief` (and a build's
`__review` and `__done`, see `building.md`, the dashboard's `__launch`,
below, and `__dashboard`, from a finished screen or mid-workflow, see
Finishing and "Back to the dashboard, mid-workflow" below), it marks the
action as being about the session. It arrives through `wait` with exit `0`, like
any send. It is the person ending the session, so act on it in this turn:

1. **Handle the answers under the workflow's own rules, and record only what is
   final.** A confirmed recap, an approval verdict, a finished checklist with its
   values. A pick that still owes its recap is not an answer yet: save it where
   the workflow keeps unfinished work (Pathfinder: the question's `## Evidence`,
   with the probes still outstanding and your recommendation for each) and never
   write a provisional `## Answer`. Do not claim a question the person picked
   from a menu in the same send.
2. **Save your place** the way the workflow does when a session ends.
3. **Post `finish`** (below) with a headline starting "Paused" (the page and
   `open --resume` both key off that word), a body naming what was saved and
   anything still open, and the resume command. Name a question that was left
   mid-way, so they can ask for it by name next time.
4. **`stop`** the server.

Do not publish new questions and do not ask whether they are sure: the page
already asked.

The page only offers Stop on the person's turn. From the moment they press Send
until your reply lands, the button is disabled, so a stop never arrives while
you are halfway through writing their last answers. The one exception is an
agent that has stopped checking in: then Stop comes back, and the request waits
on disk for whichever session collects it next.

### Back to the dashboard, mid-workflow

On every workflow but the dashboard, a triangle left of Stop session takes the
person back to the dashboard. It follows Stop's rules exactly: only on their
turn, a confirm first (with your `stopWarning`), and the staged answers ride
along in the same submit:

```jsonc
{ "type": "submit",
  "actions": [ /* staged answers and notes, as usual */,
               { "i": "__dashboard", "type": "dashboard" } ],
  "reply": "...the answer lines...\nSave my place and take me back to the dashboard, right here in this session." }
```

It is the same `__dashboard` a finished screen sends; with no `finish` on the
page it means "stop, then go home". Act on it in this turn:

1. **Handle the answers** exactly as step 1 above.
2. **Save your place** exactly as step 2 above.
3. **Resume as the dashboard:** `open --resume <sid> --no-open --workflow
   dashboard`, then ONE post with `"finish": null`, the `menu` payload and
   `"agent": { "status": "waiting" }`. Then read the dashboard skill
   (`~/.agents/skills/plan2code/SKILL.md`) and carry on as the dashboard
   from its "The menu" section, in this same conversation.

No `finish` and no `stop` in between: the menu is the ending. Say what you
saved in one terminal line, since no finish card will. A workflow with nothing
to save (a quick task not yet built) just goes home.

### Saying what stopping would cost

Some points in a workflow have nothing on disk yet, and stopping there loses the
answers given so far: Pathfinder before its map exists, Planning before a
checkpoint. The page cannot know where you are, so tell it:

```jsonc
{ "stopWarning": "The map is not written yet, so stopping now loses today's answers." }
```

It is shown in the page's Stop dialog, and the button changes from "Stop and
save" to "Stop anyway". Post `"stopWarning": ""` once stopping is safe again.
For `plan` sessions the page assumes a warning until you post that empty string.

### Say where the files are

Post `"specDir": "specs/<idea>"` once the folder exists (or pass `--spec` to
`open` when it already does). If you ever cannot answer a stop yourself (your
session died, the server went away), the page builds the resume command from
it; without it, the page can only offer the bare command, which asks which
idea.

---

## Quick questions

The page has an **Ask** tab, always the last one, on every workflow. There the
person can ask anything, about this project's files or in general, at any
time, without waiting for a card. Their messages reach you at your next
check-in, through the `wait` you already run (and, in a build, the instant
`chat` check). Chat rides its own channel: a message never blocks a card send,
and a card send never blocks a message. The page handles its own refusals, so
you never see them: `too-long` past 4,000 characters, `limit` after 10
messages, `offline` when no agent is connected or the session has finished,
`stale` after a new conversation started.

### How chat arrives

- `wait` exit `0` may carry `chat: [...]` beside `actions`, or, when no card
  was sent, be `type: "chat"` with `actions: []`. No exit code changes.
- `reply` gains one block per entry after the card lines:

  ```
  Quick question: Where does the export go?
    About: Export format
    Image: /home/sam/.plan2code/console/sessions/20260923-101500-ab12cd/uploads/3f2b9c1e-8a4d-4f6e-9b7a-2c5d1e0f4a6b.jpg (shot.png)
    File: /home/sam/.plan2code/console/sessions/20260923-101500-ab12cd/uploads/9e4b2d7a-1c3f-4a6e-8b5d-0f2c7a9e3b1d.json (config.json)
  Approved: edit r7
    Note: keep the old name working too
  New conversation started. Treat earlier chat as closed.
  ```

  Typed text past its first line is indented, so only a real entry ever
  starts a line.
- Each `chat` entry carries `seq`, `conversation` and `kind`: `message`
  (`text`, optional `about`, `images` and `files`), `decision` (`re`,
  `decision` `approve` or `decline`, optional `text`) or `reset`.
- `about` is set only when the person attached it with **+ Add context**. The
  page never adds one on its own, so a message without it is a general
  question, not one about the card on screen.
- Open every `Image:` and `File:` path with your file-read tool before you
  answer, as for notes.
- `node "<CONSOLE>" chat --session <sid>` checks right now and never sleeps:
  exit `0` with `{ chat, reply, terminalLine }`, `10` with `{ chat: [] }` when
  nothing is waiting, `20` when the server is gone. It never reads or collects
  card sends; those stay with `wait`.

### Answering

**Every message gets a reply, always.** The Ask tab is the person talking to
you, and the page shows "working on the answer" until a reply lands. Never
leave one unanswered, whatever it asks and whatever mid-task you are in. When
a message asks you to do something, do it if you can, then say what happened; if
you will not, the reply says so and why. `post` and `wait` print
`unansweredChat` with a `warning` for every message handed over and not yet
replied to: treat that as a stop-and-reply.

1. Handle any card answers first, under the workflow's own rules.
2. Write the chat replies, in inbox order.
3. Send **one** `post` with the card updates and `chat: { replies: [...] }`.

```jsonc
{ "chat": { "replies": [
  { "id": "r12", "re": 12, "conversation": 3,
    "md": "The export is written by `src/export.js`, into `out/`." }
] } }
```

- `id` is unique per reply (`r` plus the message's `seq` works), `re` is the
  message's `seq`, `conversation` is copied from the entry, `md` is markdown.
- Replies merge by `id`, so re-posting the same reply after a repeated
  delivery replaces it (unlike `thread`, which appends).
- Print one terminal line per exchange: `Quick question: <first ~60 characters
  of the question> — answered in the console`.
- Answer questions about the project by reading files and read-only lookups
  (search, `git log`, reading files); run no other commands.
- Questions about what a Plan2Code skill does, asks or writes: read that
  skill's `SKILL.md` (`~/.agents/skills/<skill>/SKILL.md`, or the table "What
  each skill reads and writes" in `~/.agents/skills/plan2code/SKILL.md`)
  before answering. Never answer from menu text, card blurbs or memory. Name
  files exactly as the skill does; if the skill does not say, say you do not
  know.
- When `about` is set, answer from that context: the card, doc section or
  spec the person was looking at.

### Never steer the workflow

A chat answer never changes a card's answer, a gate, or where the workflow
goes. If a message asks for that ("approve phase 2", "skip the tests
question"), reply by pointing to the card — its note box for a comment, its
answer for a change — and do not act on it. Chat never counts as an answer to
a card and is never recorded under `specs/`.

### A new conversation is a clean slate

After a `reset` entry (New conversation, or a skill switch through the
dashboard) treat earlier chat as closed, and do not bring it up unless the
person does. A conversation holds at most 10 typed messages; the page
enforces it, so never tell someone to keep asking past it.

### Edits need approval first

- A request to change files gets a reply carrying `proposal: { summary,
  files }` — a plain-English summary and every file that will change — and
  **no change yet**. The page shows it with Approve and Decline.
- Only after `Approved: edit <id>`: make exactly the proposed change, then post
  a reply (its `re` is the decision's `seq`) carrying `changed: [{ file,
  added, removed }]`, with line counts from `git diff --numstat -- <files>` (or
  counted by hand for an untracked file). Name the changed files in your next
  progress update or `activity` line.
- `Declined:` (with any note): acknowledge it and change nothing. A revised
  proposal is a new reply.
- Hard limits: never touch the running skill's own files under
  `specs/<idea>/` (`post` rejects a proposal that names them); run no commands
  beyond read-only lookups, except one the person plainly asks you to run in
  their message (a commit they spell out, a test run): run it, then report the
  result in the reply; refuse anything else and say why, in the reply.
- Edits happen only at check-ins, never mid-task in a build.

```jsonc
{ "chat": { "replies": [
  { "id": "r14", "re": 14, "conversation": 3, "md": "I can rename it.",
    "proposal": { "summary": "Write the export to `out/audit.csv` instead of `out/export.csv`",
                  "files": ["src/export.js", "README.md"] } }
] } }
```

---

## Workspace

The person can add folders beside the one the session started in (a shared
library, a design folder), from the footer's folder label. Together they are
the session's **workspace**: context for every skill run in this console
session, each folder addressed by a short `@name`. It outlives dashboard hops;
a new console session starts with the original folder alone.

### What you are told

`open` (fresh or `--resume`) prints the whole list under `workspace`:

```jsonc
{ "ok": true, "sid": "…", "url": "…",
  "workspace": {
    "folders": [
      { "name": "shop", "path": "/home/sam/code/shop", "original": true },
      { "name": "shared", "path": "/home/sam/code/shared-ui", "description": "Button and form styles" }
    ],
    "missing": ["old-docs"]
  } }
```

`missing` (only when there is one) names folders no longer on disk. After
`open`, you hear only of changes, each exactly once:

- `wait` exit `0` carries them beside a send or chat as `workspace: [...]`
  (`{ kind, name, path, description?, from? }`, `kind` one of `added`,
  `renamed`, `described`, `removed`, `missing`, `found`), with one
  `Workspace: …` line each at the end of `reply`
  (`Workspace: added @shared — /home/sam/code/shared-ui`). A change alone never
  ends a slice: exit `10` counts it as `pendingWorkspace` and it rides on the
  next send.
- `chat` hands changes over at once, with or without a Quick question, as
  `{ chat, workspace, reply }`.

Act on a change in the same turn it arrives: drop a removed folder, use the
new name after a rename, note a missing one. No reply is needed unless the
person asked something.

### Rules

- **Resolve `@name` from the workspace list.** `@shared` in an answer, a note
  or a Quick question means that folder's `path`. An `@name` not in the list
  is ordinary text.
- **Added folders are read-only reference.** Read them freely; edit one only
  when the person asks for that change in this conversation. Chat edits still
  need approval (Quick questions → Edits need approval first).
- **Read an added folder's `AGENTS.md` before you first use it** (`CLAUDE.md`
  when there is no `AGENTS.md`), once per folder per skill run. It says how
  that folder is laid out; the original folder's `AGENTS.md` still governs
  this project and the work.

### When a folder cannot be read

When a read of an added folder genuinely fails (refused, not found), post, once
per folder:

```jsonc
{ "folderIssue": { "name": "shared", "reason": "Permission was refused", "hint": "/add-dir /home/sam/code/shared-ui" } }
```

and print one terminal line saying which folder and why. The page marks the
folder and tells the person once. `hint` is optional: an agent that knows it
is Claude Code puts `/add-dir <path>` there. Your harness asking the person
for permission is not a failure; report only a read that failed after it.

---

## Launches (dashboard only)

A `dashboard` session is not a conversation: the page draws a menu of every
Plan2Code skill, and the one send that matters is the pick. It arrives
through the wait loop like any other:

```jsonc
{ "type": "submit",
  "actions": [{ "i": "__launch", "type": "launch",
                "skill": "plan2code-3-implement", "workflow": "implement",
                "spec": "specs/lunch-vote" }],
  "reply": "Start Implement (/plan2code-3-implement) for specs/lunch-vote, right here in this session." }
```

`__launch` names no question; like `__stop` (and `__brief`, `__review`,
`__done` and `__dashboard`) it is about the session. `skill`
is the skill's install name, `workflow` the `--workflow` it runs under, and
`spec` the picker's selected spec dir — present only when the launched skill
takes a spec and the person picked one; absent means "start from scratch".
The dashboard skill's own prompt (src/plan2code.md) drives the hand-off;
the rule that makes it work, for whatever agent holds the session next, is:

**A session handed to you is resumed, never re-opened — and resumed first.**
`open --resume <sid> --no-open --workflow <yours>` (plus `--spec
<action.spec>` when the action carried one, and `--title "<t>"` if you already
know it) comes before reading the skill file: one command both reuses the
live server and turns the page from the menu into your starting screen, so
the person sees the pick land while you read (`--title` and `--spec` are
honored on resume the same way). A resume to or from `dashboard` also
clears the page: the last skill's questions, sections, docs, headline and
finish are dropped, so you start on a blank page and post your own. A skill
run inline from another (a quick task's review) keeps the page it was
handed. A
fresh `open` would strand the page the person is watching on the dashboard's
session while your questions went to a page nobody has open. Then run the
skill normally: its Interface question was already answered by being
launched, so start where its real work starts.

The menu itself is the page's own list — you never send it. The page knows
the repo too: `open` scans `AGENTS.md` and `specs/` into `state.scan`
(`{ hasAgents, specs: [{ dir, name, state, detail, touched }] }`), and the
picker at the top of the menu greys the cards that do not fit the selected
spec's pipeline stage — or hides them outright while the **Hide unavailable
workflows** switch under the picker is on (the default; kept in `looks.json`
as `hideUnavailable`). The scan is a snapshot of that `open` — a spec created
mid-session appears the next time the session resumes as a dashboard, not
live. What a dashboard posts is what it knows about this project:

```jsonc
{
  "menu": {
    "note": "one line under the title — what you made of the project",
    "recommend": "plan2code-init",
    "details": { "plan2code-3-implement": "Phase 2 of 4 is next" }
  },
  "agent": { "status": "waiting" }
}
```

`recommend` flags one card "Suggested", `details` adds a line under a card's
blurb keyed by skill name, `note` sits under the page title. All optional;
leave the field out entirely and the page falls back to the selected spec's
own next step. These fields describe the initially selected spec. If the
person switches specs or starts fresh, the page derives the suggestion and
detail from the project scan instead.

From the click until the resume lands, the page shows a getting-ready screen;
from the resume until your first payload, the new skill's starting screen. Do
the resume first and that first `post` before anything slow.

---

## Workflow notes

What each workflow needs from the page beyond the general rules above. The
workflow's own prompt points here. Builds (`implement`, `implement-review`,
`quick-task`) have their own file, `building.md`.

### Dashboard

The whole file above is the note: open `--workflow dashboard`, post `menu`,
wait, and on `__launch` hand the session to the skill it names. Sends carry
no answers, so there is nothing to record. A `__stop` before a pick ends the
session the usual way — `finish` (paused headline, `"command": "/plan2code"`)
then `stop`.

### Init and Init Update

Setup conversations: every confirmation and Q&A item goes through the page.
For `init` and `init-update` the finished AGENTS.md also lands as a doc so a
browser-only person can read what was written — marked `"saved": "AGENTS.md"`,
since the file itself is already on disk. A completed run finishes with **no**
`command`: the page shows the "All done" line. Nothing is on disk to resume
mid-run, so a stop's finish command is the bare `/plan2code-init` or
`/plan2code-init-update` — the skill starts over either way.

### Documentation (`document`)

The questions are few — which draft, a clarification, the sign-off — but the
docs are the point: post each phase file as a doc as it is written, so a
browser-only person watches the spec take shape. Each one mirrors a file on
disk, so carry its `saved` path. Pass `--spec specs/<feature>`
once the folder is known; it is what the resume command needs. Finish
commands follow the pipeline: the sign-off's is
`/plan2code-3-implement specs/<feature>/overview.md`.

### Review (`review`)

Scope questions up front, then the findings report as a doc (`id: "report"`),
then the pick-what-gets-fixed menu as a `multi` or `choice` keyed by finding
id, carrying `"doc": "report"` so the card links straight to the findings.
Settle that item (`"status": "answered"` plus the `answer` they sent) in
the same post that takes the picks up: left open it stays on the page as a
question still owed, next to whatever you ask next. Post `activity` while you
read — a real review is long stretches of you working, and the page should
say so rather than hint at questions. When the
session was launched from the dashboard, resume the session you were handed
(`open --resume <sid> --no-open --workflow review`), never a fresh `open`. A
review run from a build's review button stays in the build's session, under
its workflow: `building.md` → The review, mid-session. On completion the finish's `command` is the suggested
commit when fixes landed — filled in, in the AGENTS.md format, with
`"where": "When you are happy with it, commit it from your terminal:"` —
otherwise leave `command` out. The completion finish carries `"dashboard": true`
so the finished screen offers **Back to the dashboard**; keep waiting for the
press. A stop mid-review loses nothing on disk, so its finish is the bare
`/plan2code-review` (a pause, so no dashboard button).

### Handoff (`handoff`)

One gate: the next-task confirmation, then the document itself as a doc —
that is what the person is there to download. The finish carries no
`command`: the doc download is the point, and the dashboard button and the
"All done" line cover what comes next.

### Pathfinder

- Every probe, recap and menu goes through the page.
- Post `"stopWarning"` while no map exists (Steps 0 to 4) and `"stopWarning": ""`
  once it does, and `"specDir": "specs/<idea>"` when the folder is created.
- Chart Step 8's research subagents must all report back before the
  finish (Finishing → Nothing of yours may still be running); the finish
  body then names what each one found.
- At every session end, post `finish` (headline, `body`, and Form A's command as
  `command`) BEFORE `stop`. Someone who spent the session in the browser never
  sees the Trail Footer, and without this their last screen promises a question
  that is never coming.
- Post `run` `pathfinder-chart` (id `map`) when a new map is first written,
  and `pathfinder-question` (id = the question's file slug) each time a
  question is resolved (Posting an update → Session meter).
- The scope probe is **Leave for later**: "Which of these features are we
  leaving out this time?" as a `multi` with a recommended preset. Every option
  names a feature, and its `detail` ends "(Leaving this out = …)". Never phrase
  an option as a rule to keep.

### Planning

- Open with `--workflow plan`, first thing. Every question and sign-off gate
  goes through the page, phase breakdowns as an editable `list`.
- Planning has no mid-session save before the Large checkpoint or Phase 7, so for
  a stop before then say plainly in `finish.body` that nothing was kept, and use
  `"command": "/plan2code-1-plan"`. After the checkpoint, post
  `"stopWarning": ""`.
- At every session end, post `finish` BEFORE `stop`; on completion that is
  `"command": "/plan2code-2-document"`, and at the Large checkpoint it is
  `/plan2code-1-plan`. The closing message is printed to a terminal the
  browser user is not watching.
- The Large checkpoint finish is a pause: a headline starting "Paused", no
  `dashboard`, and `stop` at once.

### Revision (`revise-plan`)

Revision is a short run of gates, and each maps onto a kind you already know:

| Step | On the page |
| --- | --- |
| 1, Change Analysis | A `recap` item, "Is this the change?", with the affected-areas table in `summary`. |
| 2, Impact Assessment | The Revision Impact Summary as a doc (`id: "impact"`), and a `review` item "Approve the spec changes" pointing at it: verdicts `approve` ("Approve these spec changes"), `refine` ("Refine the plan") and `abort` ("Abort", `"danger": true`), token equal to the ids, `nothingYet`: "No spec file changes until you approve." |
| 3 to 5 | Nothing to ask. Post `activity` while you edit, then the Revision Complete summary as a doc. |
| 6, Cleanup | A `confirm` per rename or removal, the paths in `consequences`. |

Revision's own rule holds on the page too: **no option, verdict or label ever
offers to execute or implement.** Pass `--spec specs/<feature>` to `open`, or
post `specDir` once you know it. The
finish command is `/plan2code-3-implement specs/<feature>/overview.md`; an
abort's is `/plan2code-1b-revise-plan specs/<feature>/overview.md`.

### Finalize

Finalize is a run of reports and gates, and each maps onto a kind you already
know:

| Step | On the page |
| --- | --- |
| 1, Task Completion Audit | The audit table as a doc (`id: "audit"`). If incomplete tasks exist, a `choice` with the three options — return to implementation, mark partially complete, abandon — with the counts against the thresholds in `body`. |
| 2, Implementation Verification | The verification results as a doc. Nothing to ask unless an issue needs their decision. |
| 3, Implementation Summary | Written to `overview.md` as usual; mirror it as a doc (marked `saved`) so the page reader sees it land. |
| 4, Documentation Review | The proposed-updates table as a doc, and a `multi` naming the documents to update — every option ticked is "approve", unticked ones are skipped. A `review` works instead when the set is all-or-nothing. |
| 5, User Feedback | Optional items, `required: false`: the rating as a `choice` of 1 to 10 or a `text`, the three reasons as `text`. The submit-to-maintainer consent is a `confirm`. |
| 6, Spec Cleanup | A `confirm` before moving anything, the archive paths in `consequences`. |

Pass `--spec specs/<feature>` to `open`, or post `specDir` once you know it.
Stopping mid-finalize loses nothing
— the specs are untouched until Step 3's summary write — so a stop's finish
just says where it paused and uses `"command": "/plan2code-4-finalize
specs/<feature>/overview.md"`. On success the finish's `command` is the
suggested commit when Step 4 doc updates landed (with `"where"` adjusted, as a
quick task's is), otherwise leave `command` out. The
completion summary is printed to a terminal the browser user is not watching,
so put it in `finish.body`.

## Posting an update

```
node "<CONSOLE>" post --session <sid> --file <patch.json>
```

Write `<patch.json>` into the session's own folder (the `session` path `open`
printed), never into the project or into `~/.plan2code/console/` directly:
the session folder goes with the session after 30 idle days, and stray
`.json` / `.mjs` files in the console folder are swept on the same clock.

Set `{"agent":{"status":"working"}}` as soon as you start thinking about a send,
so the page can say so, then send the real update when you are done.
Add `activity` inside `agent` (one plain sentence) when what you are doing
takes a while and is worth naming: the page shows it in place of "thinking",
and it is what moves the page off its starting screen before the first
question or doc lands:
`{"agent":{"status":"working","activity":"Reading the plan"}}`.

The patch merges: scalars replace, `null` deletes a key, `items` / `topics` / `docs`
merge by `id` (an unknown id is added), and `thread` / `comments` append. Send only
what changed. A whole-file rewrite would put the entire session back into your
context on every turn.

**Never write a timestamp.** The server stamps every time you leave out.

If a patch is rejected the exit code is `3`, stderr says exactly why, and nothing
is written. Fix it and post again. The checks are listed under House rules.

### Session meter

The page's top bar shows a meter of how much work this console session has
done (green, yellow, red), so the person knows when a fresh session would be
sharper. It is advice only and never blocks anything. The console counts
launches itself: Plan, Revise plan, Document, Review, Quick task, Init, Init
update and Finalize score when their session opens, and there is nothing to
post for them.

Per-unit work is yours to report, with `run` in any post:

```jsonc
{ "run": { "event": "implement-phase", "id": "phase-2" } }
```

- `event` is one of `pathfinder-chart`, `pathfinder-question`, `plan`,
  `revise-plan`, `document`, `implement-phase`, `implement-review-phase`,
  `review`, `quick-task`, `init`, `init-update`, `finalize`, `handoff`.
  An unknown event is exit `3`.
- `id` names the unit: a question's file slug, `phase-N`, `map`. The same id
  posted again in the same skill run is ignored, so a repeated post never
  counts twice.
- One `run` per post. Which events a workflow reports is in its own notes
  (Workflow notes → Pathfinder; `building.md` for Implement and for the
  review run on the page after a build).

---

## The payload

```jsonc
{
  "title": "Audit export",
  "headline": {
    "stage": "Working",
    "cleared": 4, "total": 9,
    "confidence": "Looking solid, but one area still needs work.",
    "note": "optional sentence shown above the list"
  },
  "topics": [ { "id": "t2", "title": "How it behaves", "status": "current" } ],
  "items": [ /* see kinds below */ ],
  "docs": [ /* see Documents below */ ],
  "finish": { /* only on the last patch -- see Finishing */ },
  "agent": { "status": "waiting" }
}
```

`headline.cleared` / `total` drive the progress bar. Fill them in. "How much
longer is this?" is the first thing anyone asks in a working session, and the
terminal cannot answer it.

`finish` is the session's ending, and the only key that changes what the whole
page means: without it the page can only say "nothing right now", which is a
pause. See [Finishing](#finishing-and-cleaning-up). Leave it out until the last
patch.

`confidence` must be the plain-English sentence, never raw scores.

Two more top-level keys never reach the page state: `run` (Posting an update →
Session meter) and `folderIssue` (Workspace → When a folder cannot be read).
`post` lifts both out of the patch into the session's ledger, and `open
--file` does the same.

### Every item

**Give every new question a new `id`.** An id names one question for the whole session. The server drops a stale `submitted` record if you reword a question under an old id, but never rely on it: a fresh id is the only unambiguous way to ask something new.

```jsonc
{
  "id": "q7",
  "topic": "t2",
  "kind": "choice",
  "title": "Export format",        // 2-4 plain words. A person who has never
                                   // seen this workflow has to understand it.
  "body": "The question, in markdown, with why it matters.",
  "required": true,                // false adds a "Skip this one" link
  "doc": "report",                 // optional: a doc id; the card gets a
                                   // "Read ... in full" button that opens it
  "status": "open",                // open | answered | reopened | skipped
  "fallbackText": "the exact wording you would have printed in the terminal",
  "token": { "A": "a", "B": "b" }  // what each answer means as a typed reply
}
```

Always set `fallbackText` and `token`. They are what let a click mean the same
thing as a typed word, so nothing downstream has to know which channel was used.

### The kinds

| `kind` | Use it for | Extra fields | You get back |
| --- | --- | --- | --- |
| `choice` | one of several | `options[]`, `allowOther` | `{ k }` **or** `{ text }` |
| `multi` | any number of several | `options[]`, `presets[]` | `{ ks[], text? }` |
| `text` | free text | `placeholder`, `help`, `pattern`, `patternHint`, `templates` | `{ text }` |
| `confirm` | yes or no | `yesLabel`, `noLabel`, `danger`, `consequences` | `{ yes, text? }` |
| `recap` | play decisions back for agreement | `summary` (markdown) | `{ ok, text? }` |
| `review` | read something, then approve | `doc` (always, for this kind), `summary`, `verdicts[]` (each `{ id, label, danger? }`: `label`, not `text`), `nothingYet` | `{ verdict, text? }` |
| `checklist` | steps only they can do | `steps[]`, `valuesLabel` | `{ done[], state, text? }` |
| `menu` | what to do next | `options[]`, `command` | `{ k }` |
| `list` | reorder or edit a breakdown | `rows[{id,title,body}]` | `{ rows[] }` |
| `notice` | something to read, no answer | — | nothing |

A `choice` answer carries **one of the two, never both**. The page offers
"Something else, in your own words" as a real option in the same radio group, so
picking an option and writing a sentence are alternatives: the last one touched
wins and the other is dropped. Read `k` if it is there, otherwise read `text`,
and do not treat `text` as a footnote on a pick. Set `"allowOther": false` to
drop that option when the listed ones genuinely are the whole set.

`presets` on a `multi` are quick-pick buttons that tick a named set in one go,
`[{ "label": "Critical and warnings", "ks": ["1","2"] }]`. They only tick
boxes: the answer is still `ks`.

`multi` is the other way round: there, `text` joins the ticks rather than
replacing them, because naming a third thing alongside two you picked is the
point. A note that qualifies an answer without being one belongs in the
question's own note box, and arrives as a `comment` action.

An option is `{ "k": "A", "text": "short label", "detail": "the trade-off", "recommended": true }`.
`detail` is where the trade-off goes, and it is the difference between a person
choosing and a person guessing. At most one option may be `recommended`.

`pattern` is a JavaScript regular expression validated live as they type, with
`patternHint` shown when it does not match. Use it for anything with a shape,
above all kebab-case names. This is something the terminal cannot do at all.

Items appear on the page in the order you send them, and the person walks the
open ones with Previous / Next under the card. Send them in the order you want
them answered.

### A placeholder is an offer, not decoration

On a `text` question the page puts an **Autofill suggestion** button beside the
label, which drops the `placeholder` into the box as a real, editable value. Any
lead-in is stripped first, so `"For example: about 8 of us in one office"` fills
as `"About 8 of us in one office"`.

Write the placeholder so it stands up as an answer on its own: a whole example,
in their voice, not a description of the kind of thing you want. It is the
closest this page gets to answering for them, so make it a good answer to accept
or a bad one to argue with, never a vague one. On a question with a `pattern`,
the example must satisfy the pattern.

### Starter templates

On the `text` card that asks for a **fresh idea** in Pathfinder, Plan and Quick
Task, add `"templates": "idea"`. The page then draws a row of starter templates
above the box: **Blank** first, then that skill's templates in the order the
person's Role puts them. A pick fills the box with editable text. What comes
back is only the text in the box, exactly as if they had typed it. No template
id travels, so read it like any answer.

Set it only when you are asking for a new idea. A resumed map, PLAN-DRAFT or
Plan checkpoint gets no idea card, so there is no flag. Launched with a folder
of notes or an idea as the argument? Still set it, and put a one-line summary of
the notes (or the argument itself) in `placeholder`, so **Autofill suggestion**
offers it. `post` rejects the flag on any other kind, or with any value but
`"idea"` (exit 3). The terminal has no templates: don't mention them there.

### Recommendations are optional, and often wrong to give

Give a `recommended` option when you genuinely have the better answer and can say
why. Leave it out when the answer depends on what the business wants: a
recommendation there is an anchor, and people will rubber-stamp it. "Who is this
for?" is not yours to recommend. "Which format survives contact with Excel?" is.

### Documents

```jsonc
"docs": [{
  "id": "map", "title": "What we've agreed", "version": 2,
  "stale": false, "note": "what changed in this version",
  "saved": "specs/lunch-vote/pathfinder/map.md",
  "blocks": [
    { "id": "b1", "state": "settled", "md": "## Where we're headed\n\n..." },
    { "id": "b2", "state": "assumed", "md": "### File format\n\nAssuming CSV..." },
    { "id": "b3", "state": "draft",   "md": "### Still to work out\n\n- ..." }
  ]
}]
```

Each doc becomes a tab. Patch individual blocks as decisions land rather than
rewriting the whole thing: blocks merge by `id`, so `{ "id": "b2", "state":
"settled" }` settles b2 and keeps its text, blocks you leave out stay as they
are, and a new `id` is added at the end. To remove one, send `{ "id": "b3",
"_delete": true }`.

`state` is the point of this feature:

- `settled` — decided, and it will not move
- `assumed` — you had to pick something to keep going, and it is still open.
  The page marks it "Assumed for now, still open" with a dashed edge.
- `draft` — a placeholder, shown dimmed

Marking assumptions honestly is what stops someone reading a half-finished
document as a set of decisions. Bump `version` and write a one-line `note` when
you change a doc, and set `stale: true` if answers have landed that it does not
reflect yet.

`saved` is the path of the file this doc mirrors, when you already wrote one —
the page drops the Markdown download (on the doc's tab and on the way out) and
shows the path instead, because the file is already there. Leave it off docs
that exist only here: a hand-off's document is the thing they are taking with
them.

---

## House rules the server enforces

A patch that breaks one of these is rejected with exit `3` and a message:

1. **At most three questions open at once.** The cap is the person's attention,
   not the screen size. A screen that can show ten still only gets three.
2. **No internal vocabulary in a title.** Words like *grill*, *frontier*, *fog*,
   *HITL*, *durable*, `Locked:` and `Blocked by:` are bookkeeping. They never
   reach a person.
3. **At most one recommended option per question.**
4. **No loop completion markers** (`TASK_COMPLETE`, `PHASE_COMPLETE` and the rest).
5. **No bare `Requirements` / `Feasibility` / `Integration` / `Risk` followed by a
   number.** The metrics collector scrapes that pattern. Hyphenate it
   (`Requirements-clarity 22/25`) or reword.
6. **Chat replies hold together** (`chat.replies`). Each needs a unique `id`,
   an `re` naming a real message or decision `seq`, an integer `conversation`
   and non-empty `md`. A `proposal` needs a `summary` and project-relative
   `files`, none under the running skill's `specs/<idea>/`. `changed` is a
   list of `{ file, added, removed }`. Rules 4 and 5 cover reply text too.
7. **`run` and `folderIssue` are well formed.** A `run` needs a known `event`
   (Session meter) and a non-empty `id`; a `folderIssue` needs non-empty
   `name` and `reason` strings, and `hint`, when present, is one too. Rules 4
   and 5 cover `reason` and `hint`.

These are workflow rules you already follow. The server just makes them checkable.

---

## Finishing, and cleaning up

Three steps, in this order. **Post the finish, wait up to about ten minutes for
a press, then stop the server.** A pause (below) still stops straight away.
Stopping first leaves the person staring at a page that says "leave this tab
open, the next question will appear here on its own" about a session that is
over, and the one thing they need is a command in a terminal they are not
looking at.

**Nothing of yours may still be running.** Before the finish, every
subagent or background job you started this session must have reported
back. They run inside your terminal's process, not the console's: the page
cannot see them, and the moment it says the session ended, the person is
free to close that terminal and kill them mid-write. While you wait, post
`{"agent":{"status":"working","activity":"Researching 3 questions (1 of 3 back)"}}`
and update the count as each returns. Never write a `finish.body` that says
work "is running in the background" or "will finish on its own".

### 1. Post the finish

The same closer you are about to print in the terminal, as data:

```jsonc
{
  "finish": {
    "headline": "The map is written",
    "body": "Everything you decided is on disk under `specs/lunch-vote/pathfinder/`, one file per decision. The **The map** tab has the whole picture.",
    "command": "/plan2code-0-pathfinder specs/lunch-vote/pathfinder",
    "doc": "map",
    "dashboard": true
  },
  "agent": { "status": "waiting" }
}
```

| Field | | |
| --- | --- | --- |
| `headline` | required | What just happened, in plain words. Becomes the card's title. |
| `command` | optional | The exact thing they run next, when there is one — the same string as your Trail Footer's Form A. Rendered with a Copy button that is always on show. Leave it out when nothing is left to run: the page shows an "All done" line with `/plan2code` instead. **No placeholders**: a rendered command is copied and run verbatim, and a patch carrying `<` or `>` in it is rejected. |
| `dashboard` | optional | `true` puts a **Back to the dashboard** button on the finished screen. Set it on every ending except a pause, and keep waiting for the press (below). |
| `body` | optional | Markdown. Where the files landed, what to read first. |
| `where` | optional | Overrides "Run this in the terminal where you started Plan2Code, in a new conversation:". |
| `doc` | optional | Id of the document to offer as a Markdown download on the way out. Defaults to the first one. |
| `console` | optional | Whether the copied text asks the next session to use the web console. Leave it out: it follows from the command. |
| `review` | optional | A finished `quick-task` only: `true` or `{ "label": "..." }` puts a **Review it now** button on the finished screen. `implement` offers the review on its sign-off card instead — before approval, where it can still change the outcome. See `building.md`. |

**Write the bare command.** Every Plan2Code skill has a console — the
dashboard and all twelve skills behind it — so for any of them the page
appends ` --web` to what it shows and copies, so someone who worked here
lands back here instead of being asked the interface question as though
they were new. Every one of those skills takes that flag in its argument as
the answer. Do not write `Use the web console for this session.` into the
command; if it is there, the page swaps it for `--web`. A command that is not
a Plan2Code skill gets nothing appended. Set `"console": false` if they have
asked to go back to the terminal.

The page then says the session is finished rather than paused, offers the
command, tells them they can close the tab, and stops treating the server going
away as a fault. Send is disabled, and anything they staged and never sent is
named rather than quietly lost.

Settle whatever the session ends on. An item still `open` when the finish
lands freezes exactly as it stands: a send it carries shows as the final word
on it, and one that was never answered shows as a question that ran out of
time. If their last send was a verdict you are closing on — the review's
`approve`, the plan's `yes`, the fixes pick — the finish post is the same post
that marks it `"status": "answered"` with the `answer` they sent, exactly as
"Handling a send" already has you do everywhere else.

Post it even when you are also printing the footer in the terminal. Someone who
has spent the whole session in the browser has no reason to look anywhere else.

The chat stays readable after a finish, and the page disables its Send. A
message sent just before the finish can still arrive: while you wait for the
dashboard press, answer any chat `wait` delivers, as in Quick questions.

### After the finish: the dashboard button

A **pause** is an ending that keeps a place to come back to: a stop request,
an abort that keeps its place to resume, or a checkpoint that saves and ends
(Plan's Large checkpoint). A pause's headline starts with "Paused", it never
carries `dashboard`, and you `stop` at once.

Every other finish carries `"dashboard": true`. Then keep calling `wait` in the
usual slices for up to about ten minutes:

| What arrives | What you do |
| --- | --- |
| An action `{ "i": "__dashboard", "type": "dashboard" }` | `open --resume <sid> --no-open --workflow dashboard` (the resume re-runs the project scan), then ONE post with `"finish": null`, the `menu` payload and `"agent": { "status": "waiting" }`. Then read the dashboard skill (`~/.agents/skills/plan2code/SKILL.md`) and carry on as the dashboard from its "The menu" section, in this same conversation. The same action can also arrive before any finish, from the top bar's triangle: see Stop requests → "Back to the dashboard, mid-workflow". |
| An action `__review` or `__done` | As `building.md` says (quick task only). |
| `wait` exit `20` | The server is gone, not necessarily the tab. `open --resume <sid> --no-open --workflow <yours>`, then keep waiting: their Ask messages and the dashboard button still need you. Give up only when the resume itself fails. |
| Nothing after about ten minutes | `stop` the server. The page swaps the button for the `/plan2code` command. |

### 2. Stop the server

```
node "<CONSOLE>" stop --session <sid>
```

If you forget, it shuts itself down after 30 minutes of silence. Stop it anyway.
The page keeps the hand-off on screen after the server has gone: everything it
needs is already in `state.json`, and the Copy button is the one action that
still works on a page whose server has died.

`node "<CONSOLE>" status` lists sessions for this project, including any whose
answers were submitted but never picked up.

---

## When things go wrong

| Situation | What to do |
| --- | --- |
| `open` fails | Say so in one line, carry on in the terminal. Never block on this. |
| `wait` returns `20` | `open --resume <sid>`, give them the new link. Nothing they typed is lost. |
| They close the tab | Nothing happens. Drafts are saved. Reopening the link restores everything. |
| Your session ends mid-flight | Their answers still land on disk. A fresh session runs `status` (or `open --resume`, which reports `pendingResult: true`), and `wait` returns them. An uncollected result is never discarded. |
| They ask to go back to the terminal | `stop` the session and continue. The files under `specs/` are unchanged. |
| The session ends and they are still in the browser | Post `finish` **before** `stop`, and wait for the dashboard button first unless it is a pause. See Finishing, above. Without it their last screen says the next question is coming, and then says contact was lost. |
| You started subagents or background jobs | Wait for every one to report back before `finish`, posting `working` with a count meanwhile. A finish while they run tells the person it is safe to close the terminal, and that kills them. |
| Any session end, not only the last one | Also post `finish`: an off-ramp that routes elsewhere, a checkpoint that saves and stops, a stop request. Anything that ends the session without it leaves the page promising a question that is not coming. |
| Picking up a paused session | `open --resume <sid>` (or `open --session <sid>`) clears a paused `finish` itself, and the questions left open at the pause with it: the finish body already said what was still open, so re-ask whatever the new session needs in your own words rather than leaving the old asks on the page as duplicates. Settled items stay. For any other ending you are deliberately taking back, post `"finish": null` in your first patch. |
| The same result arrives twice | Your harness killed `wait` after it handed the result over but before it recorded that. Handle it once. Most of a repeated patch is harmless, because items merge by id, but `thread` and `comments` **append**: leave out any thread entry you already sent, or the person sees your reply twice. |
| The same chat arrives twice | Replies merge by `id`, so re-post the same reply if it is not on the page yet; do not answer the question a second time. |
| `node` is missing, or older than 18 | One line, then the terminal. Do not try to install anything. |

---

## Worked example

Opening a pathfinder session with the first two questions:

```json
{
  "workflow": "pathfinder",
  "title": "Audit export",
  "headline": { "stage": "Charting", "cleared": 0, "total": 6,
                "note": "Six quick questions to work out what we're building." },
  "topics": [ { "id": "t1", "title": "What we're building", "status": "current" } ],
  "items": [
    { "id": "q1", "topic": "t1", "kind": "choice", "title": "What you end up with",
      "body": "When this is done, what exists that does not exist now?",
      "options": [
        { "k": "A", "text": "A plan, ready to build from",
          "detail": "We write the decisions down. Nothing is built yet.", "recommended": true },
        { "k": "B", "text": "One decision settled",
          "detail": "We answer the single question blocking everyone, and stop there." },
        { "k": "C", "text": "A change already made",
          "detail": "Small enough to just do. We would skip planning entirely." }
      ],
      "token": { "A": "a", "B": "b", "C": "c" },
      "fallbackText": "Q1 - What you end up with: a) a plan  b) one decision  c) a change already made. My guess: a." },

    { "id": "q2", "topic": "t1", "kind": "text", "title": "Who uses it",
      "body": "Who uses the result, and what do they do with it the day it lands?",
      "placeholder": "For example: compliance reviewers, who open it in Excel every Monday.",
      "fallbackText": "Q2 - Who uses the result, and what do they do with it the day it lands?" }
  ],
  "agent": { "status": "waiting" }
}
```
