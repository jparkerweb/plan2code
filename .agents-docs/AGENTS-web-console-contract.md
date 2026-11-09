# Web Console Contract: the Why
> Part of [AGENTS.md](../AGENTS.md): project guidance for AI coding agents.

Maintainer notes for the agent-facing console docs in `src/web-console/`. Installed skills never ship or load this file (nothing under `.agents-docs/` is in `install.js` `additionalReferences`), and the shipped files carry only what an agent must do. Put an explanation here, not there. If a shipped file starts to explain, move the sentence into this file and keep the instruction.

The shape: a short card (`console.md`) read once per session, topic files the console names in its own `read` output at the moment each is due, and refusals for the silent slips the console can see. Size budgets in `npm test` stop the docs growing back (Phase 7 of `specs--completed/console-wire-format`).

## Why pointers and refusals instead of repeated rules

A rule stated in six files is read six times and still skipped. The console sees most slips (a `stop` with no `finish`, a `finish` with `stopWarning` set, a reply left unanswered), so it refuses them and says the fix, and it names a topic file once per session per topic when that topic's moment arrives. The card states each silent rule once. A rule that was broken twice in repeated prose becomes a check in the console, not another sentence.

## console.md (the card)

- **Print then stamp.** `wait` prints a result and only then marks it collected (`advanceCursor`). A kill between the two repeats a delivery and never loses one. That is why "handle it once" is in `console-trouble.md`, and why `thread` (which appends) needs care on a repeat.
- **Bounded slices.** A wait runs for a limited number of seconds sized under the agent's shell timeout, so the command returns by itself. A killed wait loses nothing. People step away for hours, so there is no cap on the number of slices.
- **Every turn ends on a `wait`.** The page tells the person "the next question will appear here on its own". A turn that ends on text leaves that promise unkept and strands their next click. The console cannot see this slip, which is why the card states it.
- **Three open questions at most.** More than three open cards turns the page into a form to fill in, not a conversation, and people answer the first three and skip the rest. The server enforces the cap.
- **`settle`.** The server records a send on an item but only the agent decides it is final (a pick that still owes its recap is not). `settle` marks cards answered in the same post that moves on; a card left open stays on the page as a question still owed.
- **Defaults are filled by the console** (`status`, `required`, `allowOther`, empty `options` and `thread`, option keys by position, doc `version` and `stale`): an obvious default costs tokens every patch and carries no decision. A default the console fills is the only thing the card may leave out.
- **Recommend sparingly.** "Which format survives Excel?" is the agent's to recommend; "Who is this for?" is not, because a recommendation there is an anchor people rubber-stamp.
- **A placeholder is an offer.** The Autofill button drops it into the box as a real answer, so it must be a whole answer in the person's voice and satisfy any `pattern`.
- **Titles in plain words.** Internal vocabulary (grill, frontier, fog) means nothing to a newcomer and the server refuses it. The metric words rule exists because the metrics collector scrapes `Requirements`, `Feasibility`, `Integration` and `Risk` followed by a number.
- **Completion markers refused.** `TASK_COMPLETE`, `PHASE_COMPLETE` and the rest are reserved signals; one in page text could read as a finished run.
- **The page owns its stream.** The agent never writes timestamps, versions or `agent.status` for a turn: the server stamps them, and collecting a send already sets the page to working. A second source of truth for them would drift.
- **Quoted heredoc.** Unquoted `<<EOF` lets the shell eat JSON backslashes. PowerShell has no heredoc and its pipe can mangle non-ASCII, so the patch goes through a file in the session folder, never in the project.
- **No link in the app.** Inside the desktop app the page is already in the window; printing the link sends the person to a browser tab they do not need.
- **Skill invocation tools.** Every skill below the dashboard ships `disable-model-invocation: true`, so a hop reads `skillFile` with a file tool and follows it.

## console-docs.md

Documents are read from `file` blocks rather than pasted so the page and the disk cannot disagree, and a progress post only has to ask for `refresh`. `assumed` and `draft` exist so a half-finished doc is not read as decisions. A doc `version` never goes back because the page keys its "new version" marker on it.

## Noted questions

A person's note on an open question may change what it asks, and the agent's reply in the thread does not say what happens to the question. The server therefore records the fact (`noted`) when the note lands, and `validate()` refuses a new open required question until each noted one is reworded, deleted or confirmed with `stands: true`. A thread cannot answer this: it stays true forever after one reply. The page shows the same flag as a tag, and keeps the arrival notice and a New mark until the new question is opened, since eight seconds is easy to miss mid-sentence.

## console-finish.md and console-stop.md

- **Finish before stop.** The page tells the person to leave the tab open until the next question appears. Stopping first leaves them looking at a promise about a session that is over, and the one thing they need, a command to run in a terminal they are not looking at, never reaches them. The console refuses a `stop` with no `finish` (`--force` for a dead page).
- **Every ending posts a finish**, not only the last: an off-ramp, a checkpoint that saves and stops, a stop request.
- **Nothing of yours still running.** Subagents and background jobs run inside the agent's terminal. When the page says the session ended the person is free to close it, which kills them mid-write. A `finish` is refused while any reported helper is `running`.
- **Keep waiting after a finish.** The dashboard, Commit it now and review buttons live exactly as long as the agent listens, so a press an hour later works like one a minute later. A pause is the exception: it keeps a place to come back to and stops at once.
- **The paused word.** A headline starting "Paused" is what the page and `open --resume` both key off.
- **`stopWarning`.** Some points have nothing on disk yet and stopping loses answers. The page cannot know where the agent is, so the agent says so. A paused `finish` clears it in the same patch, and the console refuses one posted while it is set.
- **Stop is offered on the person's turn only,** so a stop never arrives while the agent is halfway through writing their last answers.
- **Write the bare command.** The page appends `--web` to a Plan2Code command it shows and copies, so someone who worked here lands back here. Placeholders (`<` or `>`) are refused because a rendered command is copied and run verbatim.
- **Continue here and Commit it now** are buttons the page derives from `command` and `commit`, so the agent writes nothing extra for them.

## console-chat.md

- **Every message gets a reply.** The Ask tab shows "working on the answer" until one lands. The console warns on `post` and `wait` about unanswered Quick questions for that reason.
- **Chat never steers the workflow.** A chat answer that approved a gate would make the record under `specs/` depend on a side channel.
- **Edits need approval first** and happen only at check-ins, so a change cannot land mid-task.
- **Prompts to carry away** start with prose because the page treats a fenced block whose first line looks like a shell command as a command, not a prompt.
- **Replies merge by `id`,** so a repeated delivery is answered by re-posting the same reply, not by answering twice.

## console-workspace.md

Added folders are read-only reference because the person added them as context, not as a place to work. The first read of a folder's `AGENTS.md` is once per folder per skill run so layout rules are known without re-reading. A `folderIssue` goes to the ledger, not the page state, so a failed read is reported once.

## console-subagents.md

The setting arrives as a standing instruction only when it changes, so a long session is not repeated at. Pathfinder research always uses helpers whatever the switch says; the switch governs recon and lookups. Questions for the person stay with the agent, because a helper has no way to ask and an answer only reaches the agent holding the session. Helpers add no session meter points.

## building.md and building-review.md

A build is mostly the agent working, so each task's checkbox write is posted at once (the Disk Write Rule): a session that dies mid-phase must leave disk true. `quietMinutes` exists because the page calls a working agent stuck after two silent minutes and a task can honestly take twenty. A question stops the build because the page reads `working` as "not your turn". The review runs inside the build's session and scores itself once on the meter, so it never resumes under `--workflow review` as well. The way back from a review lands on the sign-off without the review verdict, because re-offering a review that just ran reads as though nothing happened.

## console-launches.md and console-trouble.md

A session handed over by the dashboard is resumed, never re-opened, because a fresh `open` strands the page the person is watching. The console never writes into a project, so deletes go through `delete-spec` and `delete-handoff`, which refuse links and anything outside `specs/<name>`.

## console-meter.md

The meter is advice, not a gate: it tells the person when a fresh session would be sharper. Per-unit work is reported by the agent with `run`; the same `id` is ignored in the same run so a repeat never double counts.

## console-attachments.md

Attachments live in the session folder and are swept with it, so a spec file that cites one keeps it first through `keep`: the file is copied under `specs/<idea>/` and the link the console returns is the durable one. Uncited attachments stay with the session on purpose: a picture sent to answer a question was context for it, not a deliverable. A refused `keep` links nothing, because a spec must never point at a path the sweep removes.

## Wire format (outputs)

Outputs carry what the agent acts on and nothing else. Anything kept in the session files (`type`, `at`, `rev`, answer actions, full chat entries, structured workspace and subagents objects) is dropped from stdout. The desktop app reads `sid`, `url`, `pid`, `port` and `embed` from `open` in every context, so those stay. See `specs--completed/console-wire-format/overview.md` (API Design) for the table.
