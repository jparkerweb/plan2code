# Build Sessions

For `implement`, `implement-review` and `quick-task`; read right after `open`, then `notes/implement.md` or `notes/quick-task.md`. `building-review.md` is named by `read` when a review is asked for on the page. The workflow's rules stand: the same specs, the same checkbox writes to disk after every task, the same sign-off wording, no git commands. The files under `specs/` and the code are the record; the page is a window onto them.

## Opening

Open before reading the spec; the page shows a starting screen meanwhile.

| Workflow | `--workflow` | `--spec` |
| --- | --- | --- |
| `/plan2code-3-implement` | `implement` | `specs/<feature>` |
| `/plan2code-3-implement-review` | `implement-review` | `specs/<feature>` |
| `/plan2code-quick-task` | `quick-task` | leave out |

Without `--spec` at `open`, post `"specDir":"specs/<feature>"` and a real `title` ("<feature>: Phase 3") once the phase is chosen. Launched from the dashboard? The session is open: run the `resume` the launch carried (`open --resume <sid> --no-open --workflow <yours>`, plus `--spec` once known).

## While you build

Post after every task, in the same breath as writing its checkbox to disk, with no `--wait`. Every post carries:

- `headline.cleared` / `total`: tasks done of tasks in the run. Start every phase at `"cleared":0`; raise `total` if the list grows. On Implement and Implement + Review the meter counts a build's tasks from `cleared`; a quick task scores once, when it opens.
- `agent.activity`: one plain sentence, no internal vocabulary or loop markers. Number tasks by position in the run (`Task 5 of 9`), not the file's `5.5` labels.
- `agent.quietMinutes` (on the post that starts the build): the longest gap you expect, usually 10 to 30 (the page calls you stuck after two silent minutes otherwise). Set it once.
- the doc blocks that mirror the spec are `file` blocks: re-read them with `"refresh":true`, never repeat the text (`notes/implement.md`). A quick task's steps block stays `md`.

Do not call `wait` while building. After each progress post, run `node "<CONSOLE>" chat --session <sid>` before the next task: exit 0 means answer everything waiting, under `console-chat.md`, in one post, then continue (a `Workspace:` change takes effect from the next task); 10 nothing waiting; 20 server gone, `open --resume <sid> --workflow <yours>`, give the link, carry on. An approved chat edit is made here, between tasks.

A blocker (`[!]`), a `SPEC NOTE` and a verified or assumed prerequisite are not questions: put them in the phase doc and the report. A `Subagents:` block: hand independent tasks to helpers as `console-subagents.md` says; keep the progress posts, checkbox writes, chat checks and sign-off with you.

## When the workflow asks something

Publish it with `post --wait`. A question stops the build: never post `"status":"working"` with a question open, and finish any work the answer does not touch before you ask.

| Moment | `kind` | Notes |
| --- | --- | --- |
| Several phases can be picked | `choice` | one option per phase, `detail` = status and task count, `token` = the phase number; put the "run another agent on a different phase" tip in `body` |
| A phase is in progress | `confirm` | "Resume Phase 3?" |
| `SPEC CONFLICT` | `choice` or `text` | the conflict in `body`, clear readings as options; never guess on architecture |
| Test failures | `choice` | `1` Fix now, `2` Document and proceed, `3` Investigate first |
| Shared ground touched | `choice` | run the full suite, run a wider named set, or approve without it; `body` says what was touched and why it is wide |
| A small phase, continue with the next? | `confirm` | |
| A spec gap only they can close | `text` | |
| Something learned for AGENTS.md | `confirm` | proposed lines in `consequences` |

Titles stay plain: "Which phase next", "Tests are failing", "Keep going?". In loop mode (`notes/loop.md`) a question is held or stopped by the app, never answered by it; the findings pick and fixes are `handledBy:"loop"` cards. A `loopOutcome` refused at post time names the missing piece against the app's `loopExpect`: do that step and post again.

## Stop during a build

Stop only arrives on the person's turn, never mid-task. On `__stop` (`console-stop.md`):

- **implement / implement-review:** Implementation Mode's abort without the "are you sure": the phase stays `[/]`, list completed and remaining tasks, post `finish` with headline starting "Paused" and the resume command (`/plan2code-3-implement specs/<feature>/overview.md`), no `dashboard`, then `stop`.
- **quick-task:** say in `finish.body` what was worked out and that nothing was saved unless built; `"command":"/plan2code-quick-task"`.

A mid-build `__dashboard` lands the same way: save as for `__stop`, but post no finish and do not `stop`; resume as the dashboard, with one terminal line naming what was saved and the resume command.
