# Quick Questions on the Web Console

Part of the web console contract (`console.md`). Read the first time `wait` or
`chat` hands you a Quick question.

The page has an **Ask** tab, always the last one, on every workflow. There the
person can ask anything, about this project's files or in general, at any
time, without waiting for a card. Their messages reach you at your next
check-in, through the `wait` you already run (and, in a build, the instant
`chat` check). Chat rides its own channel: a message never blocks a card send,
and a card send never blocks a message. The page handles its own refusals, so
you never see them: `too-long` past 4,000 characters, `limit` after 10
messages, `offline` when no agent has checked in for a few minutes (a finish alone does
not end the chat: you may still be waiting on its buttons),
`stale` after a new conversation started.

## How chat arrives

- `wait` exit `0` may carry `chat: [...]` beside `actions`, or, when no card
  was sent, be `type: "chat"` with `actions: []`. No exit code changes.
- `reply` gains one block per entry after the card lines:

  ```
  Quick question: Where does the export go?
    About: Export format
    Image: /home/sam/.plan2code/console/sessions/<sid>/uploads/3f2b9c1e.jpg (shot.png)
    File: /home/sam/.plan2code/console/sessions/<sid>/uploads/9e4b2d7a.json (config.json)
  Declined: edit r7
    Note: keep the old name working too (only a decline carries one)
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

## Answering

**Every message gets a reply, always.** The Ask tab is the person talking to
you, and the page shows "working on the answer" until a reply lands. Never
leave one unanswered, whatever it asks and whatever mid-task you are in. When
a message asks you to do something, do it if you can, then say what happened; if
you will not, the reply says so and why. `post` and `wait` print
`unansweredChat` with a `warning` for every message handed over and not yet
replied to: treat that as a stop-and-reply.

1. Handle any card answers first, under the workflow's own rules.
2. Write the chat replies, in inbox order.
3. Send **one** `post` with the card updates and `chat: { replies: [...] }`
   (`chat.replies`).

```jsonc
{ "chat": { "replies": [
  { "re": 12, "conversation": 3,
    "md": "The export is written by `src/export.js`, into `out/`." }
] } }
```

- `re` is the message's `seq`, `conversation` is copied from the entry, `md` is
  markdown. `id` is optional: left out, it is `r<re>`. Give one only when you
  send two replies to the same message.
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

## Never steer the workflow

A chat answer never changes a card's answer, a gate, or where the workflow
goes. If a message asks for that ("approve phase 2", "skip the tests
question"), reply by pointing to the card — its note box for a comment, its
answer for a change — and do not act on it. Chat never counts as an answer to
a card and is never recorded under `specs/`.

## A new conversation is a clean slate

After a `reset` entry (New conversation, or a skill switch through the
dashboard) treat earlier chat as closed, and do not bring it up unless the
person does. A conversation holds at most 10 typed messages; the page
enforces it, so never tell someone to keep asking past it.

## Edits need approval first

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

## What the server checks

Each reply needs a unique `id` (or none, to take `r<re>`), an `re` naming a real
message or decision `seq`, an integer `conversation` and non-empty `md`. A
`proposal` needs a `summary` and project-relative `files`, none under the
running skill's `specs/<idea>/`. `changed` is a list of `{ file, added,
removed }`. The house rules on completion markers and metric-like words cover
reply text too.

## The same chat twice

Replies merge by `id`, so re-post the same reply if it is not on the page yet;
do not answer the question a second time.
