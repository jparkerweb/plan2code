# Finishing a Web Console Session

Part of the web console contract (`console.md`). Read before your first `finish`
post, and when a send carries `__commit` or a finished screen's `__dashboard`.
A stop request or the mid-workflow way home is `console-stop.md`.

Three steps, in this order. **Post the finish, keep waiting for a press —
there is no timeout — and stop the server when the session ends.** A pause
(below) still stops straight away.
Stopping first leaves the person staring at a page that says "leave this tab
open, the next question will appear here on its own" about a session that is
over, and the one thing they need is a command in a terminal they are not
looking at. Post it on every session end, not only the last one: an off-ramp
that routes elsewhere, a checkpoint that saves and stops, a stop request.

**Nothing of yours may still be running.** Before the finish, every
subagent or background job you started this session must have reported
back. They run inside your terminal's process, not the console's: the page
cannot see them, and the moment it says the session ended, the person is
free to close that terminal and kill them mid-write. While you wait, post
`{"agent":{"status":"working","activity":"Researching 3 questions (1 of 3 back)"}}`
and update the count as each returns. Never write a `finish.body` that says
work "is running in the background" or "will finish on its own". Mark every
reported helper `done` or `failed` before the finish, so the Subagents tab
never ends on a row still running: post each one's `done` in the same turn its
notice arrives, and a `finish` is refused (exit `3`, naming the helper) while
any row is still `running`.

## 1. Post the finish

The same closer you are about to print in the terminal, as data:

```jsonc
{
  "settle": true,
  "finish": {
    "headline": "The map is written",
    "body": "Everything you decided is on disk under `specs/lunch-vote/pathfinder/`, one file per decision. The **The map** tab has the whole picture.",
    "command": "/plan2code-0-pathfinder specs/lunch-vote/pathfinder",
    "doc": "map",
    "dashboard": true
  }
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
| `commit` | optional | `true` on a finished `quick-task`, `implement`, `implement-review`, `review` or `finalize` whose finish prints a git command puts a **Commit it now** button on the finished screen. The press arrives as `__commit` (below). |
| `review` | optional | A finished `quick-task` only: `true` or `{ "label": "..." }` puts a **Review it now** button on the finished screen (`notes/quick-task.md`, `building-review.md`). `implement` offers the review on its sign-off card instead — before approval, where it can still change the outcome. |

**Write the bare command.** Every Plan2Code skill has a console — the
dashboard and every skill behind it — so for any of them the page
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
that settles it (`"settle": true`).

Post it even when you are also printing the footer in the terminal. Someone who
has spent the whole session in the browser has no reason to look anywhere else.

The chat stays open after a finish for as long as you are still listening (the
review and dashboard buttons live as long as you do); the page only turns Send
off once you have gone quiet. So while you wait for a button press, answer any
chat `wait` delivers (`console-chat.md`).

## 2. After the finish: the buttons

A **pause** is an ending that keeps a place to come back to: a stop request,
an abort that keeps its place to resume, or a checkpoint that saves and ends
(Plan's Large checkpoint). A pause's headline starts with "Paused", it never
carries `dashboard`, and you post it without `--wait` and `stop` at once.

Every other finish carries `"dashboard": true` and goes up with `post --wait`;
keep waiting in the usual slices. There is no timeout after a finish: the
buttons live exactly as long as you are listening, so a press an hour later
works like a press a minute later.

| What arrives | What you do |
| --- | --- |
| An action `{ "i": "__dashboard", "type": "dashboard" }` | Run the `resume` it carries (`open --resume <sid> --no-open --workflow dashboard`; it re-runs the project scan and clears the page, the finish included), read the dashboard skill (`skillFile`, or `~/.agents/skills/plan2code/SKILL.md`), then post its `menu` with `--wait` and carry on as the dashboard from its "Coming back from another skill", in this same conversation. |
| An action `__review` or `__done` | As `building-review.md` says (quick task only). |
| An action `{ "i": "__commit", "type": "commit" }` | Commit it now: run the `resume` it carries (`open --resume <sid> --no-open --workflow git`; no `finish`, no `stop`; the resume gives Git a clean page, the finish included, as a dashboard launch does), then open the Git skill (`skillFile`, or `~/.agents/skills/plan2code-git/SKILL.md`) with your file-read tool and follow it, starting with the commit flow over the board (the person pressed Commit it now), then the board with Push lit. Leave the commit command you printed in the finish where it is for the terminal. |
| `wait` exit `20` | The server is gone. `open --resume <sid> --workflow <yours>` (it gets a new link: give it to them; the browser opens it), then keep waiting: their Ask messages and the dashboard button still need you. Give up only when the resume itself fails. |
| The session ends without a press (the terminal closes, the conversation ends) | The server sweeps itself once its idle window passes, and the page swaps the buttons for the matching commands — nothing pressable dies silently. A press that lands in the meantime is kept on disk (`pendingResult`) for a resumed session. |

## 3. Stop the server

```
node "<CONSOLE>" stop --session <sid>
```

If you forget, it shuts itself down after 30 minutes of silence. Stop it anyway.
The page keeps the hand-off on screen after the server has gone: everything it
needs is already in `state.json`, and the Copy button is the one action that
still works on a page whose server has died.

`node "<CONSOLE>" status` lists sessions for this project, including any whose
answers were submitted but never picked up.
