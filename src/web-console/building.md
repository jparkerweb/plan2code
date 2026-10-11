# Build Sessions on the Web Console

For `/plan2code-3-implement`, `/plan2code-3-implement-review` and
`/plan2code-quick-task`. Everything in `console.md` still applies (the turn,
one post per send, `finish` before `stop`, the house rules). This file adds what
a build needs, because a build is mostly you working, and the page has to be
told so. Then read your workflow's own notes: `notes/implement.md` (Implement
and Implement + Review) or `notes/quick-task.md`. `building-review.md` is read
only when a review is asked for on the page.

**The console changes where you ask, not what you build.** Every rule of the
workflow stands: the same specs, the same checkbox writes to disk after every
task, the same sign-off wording, the same "no git commands". The files under
`specs/` and the code are the record. The page is a window onto them.

---

## Opening

Open first, before reading the spec — the page shows a starting screen while
you work out the phase:

| Workflow you are running | `--workflow` | `--spec` |
| --- | --- | --- |
| `/plan2code-3-implement` | `implement` | `specs/<feature>` |
| `/plan2code-3-implement-review` | `implement-review` | `specs/<feature>` |
| `/plan2code-quick-task` | `quick-task` | leave it out |

`--spec` is what the page builds a resume command from if you ever cannot
answer a stop yourself. Pass it to `open` when you already know the spec;
otherwise post `"specDir": "specs/<feature>"` and a real `title` ("<feature>:
Phase 3") in your first update, once the phase is chosen, or with the phase
question as its first item if there is one to ask.

**Launched from the dashboard?** Then the session is already open and the
person is watching it — run the `resume` the launch carried (`open --resume
<sid> --no-open --workflow <yours>`, plus `--spec` once known) instead of a
fresh `open`, exactly as `console-launches.md` says. Everything below is
unchanged; the only difference is whose session it was a minute ago.

---

## While you build

Post after every task, in the same breath as writing its checkbox to disk,
with no `--wait`. Your notes file shows the exact post; every one carries:

- **`headline.cleared` / `total`**: tasks done out of tasks in the run. The
  progress bar is the first thing someone watching a build looks at, and on
  Implement (and Implement + Review) the session meter counts the build's tasks
  from `cleared` as it rises; a quick task scores once, when it opens. Start every
  phase (a second one in the same run too) at `"cleared": 0`. If the task list
  grows mid-build, raise `headline.total` in the same post.
- **`agent.activity`**: one plain sentence saying what you are doing now. The
  page shows it beside Planny and in place of "questions coming". No internal
  vocabulary, no loop completion markers. Number tasks by their position in
  the run, of the task count (`Task 5 of 9`), not by the file's `5.5`-style
  labels: the phase is already in the headline. The page rewrites the old form
  as a safety net.
- **`agent.quietMinutes`** (on the post that starts the build): how long you
  might go without posting (1 to 60; the page always allows at least two). The page calls a working agent stuck
  after two minutes of silence unless you say otherwise, and a build task can
  honestly take twenty. Set it to the longest gap you expect, usually 10 to 30.
  Every post is also a heartbeat. It only counts while you are working, so it
  holds across the questions you ask: set it once.
- **The task list re-read from disk** (Implement): the doc blocks that mirror
  the spec are `file` blocks, so a progress post re-reads them with
  `"refresh": true` rather than repeating the text. A quick task's plan lives
  only on the page, so its steps block stays `md` (`notes/quick-task.md`).
  Versions move by themselves.

Do not call `wait` while building. There is nothing to collect, and the page
holds anything the person sends until you next look.

A build may receive a `Subagents:` standing instruction, on `open` output or a
`chat` check between tasks. Follow `console-subagents.md` for handing
independent tasks to helpers and reporting them as `helpers`. Keep the
per-task progress posts, the checkbox writes, the chat checks and the sign-off
with you.

### Quick questions between tasks

The person can ask a Quick question on the Ask tab at any point in a build
(`console-chat.md`). After each task's progress post, check for one before
starting the next task:

```
node "<CONSOLE>" chat --session <sid>
```

| Exit | What you do |
| --- | --- |
| `0` | Answer everything waiting, under `console-chat.md`, in one post, then start the next task. A `workspace` list in the output is a change to the session's folders (`console-workspace.md`): take it into account from the next task on; it needs no reply. |
| `10` | Nothing waiting. Carry on. |
| `20` | The server is gone: `open --resume <sid> --workflow <yours>`, give them the new link, then carry on. |

This is an instant check, not a wait: it never sleeps and never touches card
sends. It does not replace `wait` at a gate, and no build calls `wait`
mid-build for cards. An approved chat edit is made here, between tasks, never
in the middle of one.

A blocker (`[!]`), a `SPEC NOTE` and a verified or assumed prerequisite are
not questions. Put them in the phase doc as they happen, and in the report.

### When the workflow asks something

Publish it with `post --wait`: a new question hands the turn over by itself
(status `waiting`). When the answer lands, collecting it
sets you `working` again; carry on.

A question stops the build. Never post `"status": "working"` with a question
open, and never "carry on while you decide": the page reads `working` as "not
your turn", and the person is left looking at a question they cannot answer.
If there is other work the answer does not touch, finish it before you ask,
then ask and wait.

| Moment | `kind` | Notes |
| --- | --- | --- |
| Several phases can be picked | `choice` | One option per phase, `detail` = status and task count, `token` = the phase number. Put the "run another agent on a different phase" tip in `body`. |
| A phase is already in progress | `confirm` | "Resume Phase 3?" `yes` / `no`. |
| `SPEC CONFLICT` | `choice` or `text` | The conflict in `body`, the readings as options where there are clear ones. Never guess on architecture. |
| Test failures | `choice` | `1` Fix now, `2` Document and proceed, `3` Investigate first. |
| A small phase, continue with the next? | `confirm` | |
| A spec gap only they can close | `text` | |
| Something learned for AGENTS.md | `confirm` | The proposed lines in `consequences`. |

Titles stay plain: "Which phase next", "Tests are failing", "Keep going?".

---

## Stop requests during a build

The Stop button only works on the person's turn, so it never lands mid-task.
When `__stop` arrives (`console-stop.md`):

- **implement / implement-review:** Implementation Mode's abort, without the
  "are you sure" (the page asked): the phase stays `[/]`, list completed and
  remaining tasks, post `finish` with the resume command
  (`/plan2code-3-implement specs/<feature>/overview.md`), then `stop`. An
  implement abort is a pause: a headline starting "Paused", no `dashboard`,
  `stop` at once.
- **quick-task:** say in `finish.body` what was worked out, and that nothing was
  saved unless it was built; `"command": "/plan2code-quick-task"`.

A mid-build `__dashboard` (the top bar's triangle, `console-stop.md` → "Back
to the dashboard, mid-workflow") lands the same way, only on the person's
turn. Save exactly as for `__stop` above (an implement phase stays `[/]`), but
post no finish and do not `stop`: resume as the dashboard instead, with one
terminal line naming what was saved and the resume command.
