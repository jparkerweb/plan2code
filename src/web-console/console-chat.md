# Quick Questions (the Ask tab)

The console points here the first time a Quick question reaches you. The person can ask anything on the Ask tab at any time, about this project's files or in general, without waiting for a card. A message never blocks a card send and a card send never blocks a message.

## How they arrive

`wait` exit 0 (or `chat`) carries them in `reply`, after the card lines, plus `chat`: the seq number of each question, the ids your replies need as `re`.

```
Quick question (12): Where does the export go?
  About: Export format
  Image: /home/sam/.plan2code/console/sessions/<sid>/uploads/3f2b9c1e.jpg (shot.png)
  File: /home/sam/.plan2code/console/sessions/<sid>/uploads/9e4b2d7a.json (config.json)
Declined (14): edit r7
  Note: keep the old name working too
Approved (15): edit r9
New conversation started. Treat earlier chat as closed.
```

- Open every `Image:` and `File:` path with your file-read tool before you answer.
- `About:` is set only when the person attached that context; without it the question is general, not about the card on screen.
- After "New conversation started" treat earlier chat as closed and do not raise it unless they do.
- `node "<CONSOLE>" chat --session <sid>` checks now and never sleeps: exit 0 with the same `reply` and `chat`, 10 nothing waiting, 20 server gone. It never reads card sends.

## Answering

**Every message gets a reply**, whatever it asks and whatever you are mid-task on. `post` and `wait` print `unansweredChat` with a `warning` for each message not yet replied to: stop and reply. When a message asks you to do something, do it if you can, then say what happened; if you will not, say so and why.

1. Handle any card answers first, under the workflow's own rules.
2. Write the replies, in order.
3. Send one `post` with the card updates and the replies.

`{"chat":{"replies":[{"re":12,"md":"The export is written by `src/export.js`, into `out/`."}]}}`

- `re` is the message's seq; `md` is markdown and non-empty. `id` is optional (default `r<re>`): give one only for two replies to the same message. Replies merge by `id`, so re-posting the same reply replaces it.
- Print one terminal line per exchange: `Quick question: <first ~60 characters> (answered in the console)`.
- Answer questions about the project from files and read-only lookups (search, `git log`, reading); run nothing else.
- For what a Plan2Code skill does, asks or writes, read that skill's `SKILL.md` (`~/.agents/skills/<skill>/SKILL.md`, or the table "What each skill reads and writes" in `~/.agents/skills/plan2code/SKILL.md`) first. Name files exactly as it does; if it does not say, say you do not know.
- With `About:`, answer from that context.

## A prompt to carry away

When the right answer is a separate task (a new Plan, Quick Task or another skill), explain first, then give ONE self-contained prompt in a fenced block with no info string (the page adds a **Copy** button). The block:

- opens with plain prose, never a command word: a first line that looks like a shell command (`git`, `npm`, `node`, `rm`, `#!`, or an everyday verb like Make, Go, Source, Export, Cat, Echo, Zip, Tar, Cd, Ls; case-insensitive) gets a "paste into the Ask tab" hint. Start with "In this repo, ..." or "Using the Quick Task skill, ...". A leading `/plan2code-quick-task ...` is fine.
- names the skill to paste it into, the files to read first, the task, and what is out of scope.
- stands alone: it assumes nothing said in this session.

## Never steer the workflow

A chat message never answers a card, passes a gate or changes where the workflow goes ("approve phase 2"): point to the card (its note box, its answer) and do not act. Chat is never recorded under `specs/`. A conversation holds at most 10 typed messages; the page enforces it.

## Edits need approval

- A request to change files gets a reply with `proposal` (a plain-English `summary` and every file that will change) and **no change yet**: `{"chat":{"replies":[{"re":14,"md":"I can rename it.","proposal":{"summary":"Write the export to `out/audit.csv`","files":["src/export.js","README.md"]}}]}}`. The page shows Approve and Decline.
- `Approved (<seq>): edit <id>`: make exactly the proposed change, then reply (its `re` is that seq) with `changed:[{file,added,removed}]`, line counts from `git diff --numstat -- <files>` (counted by hand for an untracked file). Name the changed files in your next update.
- `Declined (<seq>)`, with any note: acknowledge and change nothing; a revised proposal is a new reply.
- Never touch the running skill's own files under `specs/<idea>/` (a proposal naming them is refused). Run no commands beyond read-only lookups, except one they plainly ask for in their message (a commit they spell out, a test run): run it and report. Refuse anything else, saying why.
- Edits happen at check-ins, never mid-task in a build.
