# The Web Console

## New here? A two-minute tour

**Launch it.** After installing, run `plan2code` in your project folder. It starts Claude Code or
Devin on the dashboard, and the page opens in your browser. In any other agent, run `/plan2code`
inside it, or add `--web` to a skill (`/plan2code-1-plan --web plan a lunch voting app`).

**What you see.**

- **The dashboard** has a card for every skill. The one it suggests next is flagged. Pick a card and
  that skill starts on the same page.
- **Questions** come laid out with the trade-offs next to each option and a progress bar on top.
  Nothing is sent until you press **Send**, and half-typed answers survive a closed tab.
- **Tabs** show the document taking shape, the build progress and, always last, **Ask**, where you can
  put a quick question to the running agent.
- **Sign-off** asks for your approval at the end of a phase. You can run the code review first from
  the same card.

**Where next.** [walkthrough.md](walkthrough.md) follows one feature from the first idea to the
last phase. The rest of this file is the reference: every card, button and rule. Prefer the terminal?
Run the same commands without `--web` and answer there; the files under `specs/` are identical.

---

The web console is the main way to use Plan2Code: a local page in your browser
where you pick a step, answer its questions, watch the documents and the build
take shape, and approve the work. Every skill runs on it, and `/plan2code` is
the front door: it opens a dashboard of all of them, and whichever you pick
starts right there on the same page.

It exists because the hardest part of adopting Plan2Code is not the engineering.
It is getting the person who actually knows what the product should do into the
room. Pathfinder and Planning are the two steps where that person matters most,
and they were the two steps that looked like a wall of terminal text.

## Quick start

1. Install Plan2Code (see [Install and start](../README.md#install-and-start) in the README).
2. Run `plan2code` in your project, or `/plan2code` inside your agent. The dashboard opens in your
   browser.
3. Pick a card. The same page becomes that step's session.
4. Answer on the page and press **Send to Plan2Code**.

Starting a step by its own command instead? Add `--web` (for example `/plan2code-1-plan --web`) and
it opens on the page without asking.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/screenshots/dashboard-dark.webp">
  <img src="../docs/screenshots/dashboard-light.webp" alt="The Plan2Code dashboard: a Set up card, then the steps in order as cards, one of them marked Suggested.">
</picture>

---

## What you get

- **Every question laid out**, with the trade-offs written next to each option
  instead of scrolling past in your history.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/screenshots/question-dark.webp">
  <img src="../docs/screenshots/question-light.webp" alt="A Plan question card, How tasks are paged, with three options, the first marked Suggested, each with its trade-off underneath.">
</picture>

- **A progress bar.** "4 of 9 settled" answers the first thing anybody asks.
- **Previous and Next under each card**, walking the questions still waiting, so
  the list on the left is somewhere to jump from rather than the only way round.
- **An example you can accept.** Where a question comes with one, an *Autofill
  suggestion* button puts it in the box as a real answer for you to edit. It
  disappears as soon as you have typed anything of your own.
- **Answers you have settled read as answers**, not as a form you might still be
  able to change: what you chose, stated in words, with everything else locked.
- **A question you have sent is held** until Plan2Code answers it, showing
  what you sent. The rest of the page carries on working, so you can read ahead
  or answer the next question while you wait.
- **The document taking shape**, in a tab, with the parts that are still guesses
  clearly marked as guesses.
- **A brief, on demand** (Pathfinder). Press *Write a brief*, choose how far back,
  and what comes back is a plain-English report of what has been decided, what is
  still open and what happens next, in its own tab with Print and Save buttons.
  It is the thing you take to a meeting.
- **Nothing is sent until you press Send.** Everything before that is local and
  reversible, so nobody has to worry about committing to something by accident.
- **Nothing gets lost.** Close the tab, reload, restart your machine: your
  half-typed answers are still there. Once you press Send, what you sent is
  held until Plan2Code actually collects it, so it cannot be written over.
- **It tells you when the other half stops listening.** The terminal and this
  page are two programs that fail separately, and a page that sat there saying
  "one moment" forever was the worst way to find that out. Now it says so, and
  says what to do: answering anyway still works, because what you send is held
  on disk until something comes for it.
- **Starters picked for your role.** Tell *User Preferences* what you do
  (engineer, product lead, architect, designer, QA, engineering manager) and
  the starter templates on an idea card and the starter questions on the Ask
  tab put the most useful ones first. It changes the order, never the
  questions a skill asks (see *Your role* below).
- **Light or dark, and a highlight color you pick.** The gear button at the
  top right opens *User Preferences*: your role first, then these. It follows
  your system by default; set it to one or the other if
  you would rather it stayed put. Remembered on your machine, so it carries
  over to every session.
- **A card as wide as you want it.** The same panel has a *Card width*
  setting — **Narrow** (720px), **Comfortable** (880px, the default) or
  **Wide** (1080px) — that widens the question card, the Previous / Next pager
  and the document tabs together. The dashboard keeps its own layout, and on a
  small window the column simply fits the window. Remembered with the colors,
  so it follows you into every session.
- **Text that uses the card.** A question's text runs the full width of the
  card rather than stopping in a narrow column, and the answer box you are
  typing in grows to fill the card's free height: the box of a text question,
  the *Something else* box once you pick it, or the note under a verdict,
  yes/no or recap once it shows. Other boxes stay small. Drag the handle to
  make it taller; it never shrinks below the space it was given, and on a short
  window the card scrolls instead of squeezing the box under 160px.
- **Send tells you it is ready.** While there is something to send, the Send
  button pulses gently; it goes still when there is nothing to send.
- **Each tab remembers where you were.** Scroll halfway down a document,
  jump to the questions, come back: you are where you left off. The same goes
  for a long question card. It lasts as long as the tab is open.
- **The spec's overview, one click away.** When the session is working on a
  spec that has an `overview.md`, an **Overview** tab shows it — read-only,
  and read fresh from disk each time you open the tab, so an edit shows up
  straight away. No file, no tab. On the dashboard it follows the spec picked
  at the top, and disappears for *start from scratch*.
- **Where you are, at the bottom.** The footer names the folder the session
  was launched from and its git branch (`plan2code · feature/…`), muted in
  the middle. Click it to open the Workspace dialog (see *Your workspace*).
  Outside a git repo it shows only the folder.
- **A chime when it's your turn.** The page plays a sound when new questions
  arrive, when a new tab (a document, the overview) joins the strip, and when
  the session opens or closes, so you can look away without missing your cue.
  Starting a skill from the dashboard plays its own sound too. The same panel
  has a *Play sounds* switch for all of them, and a box per moment (Planny
  snoring, Planny waking up, starting a skill, session opens, skill is ready,
  session ends, new questions, a reply on Ask, a new tab), so you can keep only
  the ones you want. Ticking a box plays its sound; everything is remembered
  like the colors.
- **Files in your notes.** Show instead of describe: attach a screenshot, a
  photo or a document to any note or quick question (see *Attachments in notes
  and questions* below).
- **A nudge when it might be waiting on you.** Your agent may stop in the
  terminal to ask permission for something, and the page cannot see that. So
  the dashboard and every starting screen carry a one-line tip about hands-off
  modes (`auto` mode in Claude Code, `smart` mode in Devin) that can cut down
  on those stops, though they may still need your attention, and when the agent
  has been working and silent for about 30 seconds, Planny's line asks
  *"Still working, or waiting on an approval in your terminal?"* — well before
  the two-minute *"Still working on it"* line.
- **The tab icon says whose turn it is.** A bar along the bottom of Planny's
  favicon follows the line beside him: dashed amber while Plan2Code is
  working or picking up your answers, solid green when it is your move, solid
  red when it has gone quiet or the connection is lost (busy is dashed so the
  states differ by pattern, not only color). A finished session goes back to
  the plain icon, so a console left in a background tab can be checked at a
  glance.
- **Help.** The **?** at the top right opens a Help dialog with 16 topics,
  one per tab down the left (across the top on a narrow window), opening on
  the one for where you are. It is part of the page itself, so it still reads
  fully when the page has lost its program.
- Works offline, on your own machine only. No account, no install, no network.

An Implement phase ends on a sign-off card: read the completion report, then
review the code first, approve the phase, or ask for changes. Implement +
review has already reviewed the code, so its card has no review button.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/screenshots/signoff-dark.webp">
  <img src="../docs/screenshots/signoff-light.webp" alt="The Approve this phase card, with a button to read the completion report and three choices: Review the code first, Approve this phase, and I want changes.">
</picture>

The **Ask** tab is a chat beside the cards, for a quick question at any point.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="../docs/screenshots/ask-dark.webp">
  <img src="../docs/screenshots/ask-light.webp" alt="The Ask tab: the question Where are tasks paged? and Plan2Code's answer naming the file.">
</picture>

## Using it

The easy way in is the dashboard:

```
/plan2code
```

A page opens with every skill laid out as cards — the setup pair, the pipeline
in order, and the utilities alongside — with a note about what it made of your
project (no AGENTS.md yet, a spec waiting on Phase 2) and a *Suggested* flag on
the card it would pick. Click one and Planny flies while it gets ready; a few
seconds later the same page is that skill's console, already running. No
command names to remember.

A freshly opened dashboard starts with Planny asleep in the middle of the page.
Click to wake him: he snores once while he gets a gentle shake side to side,
then about five seconds of him powering on to a boot-up sound (arms lifting
off his sides, his star opening, a hop and a cheer) before he glides into his spot at
the top and the menu rises in. (Browsers stay silent until your first click,
so the snoring usually starts with it; with *Sounds* off, the same wake-up
plays without audio.)
It plays only on a fresh `/plan2code`: not on a reload, not when you come
back with **Back to the dashboard**, and not after a launch. To skip it — from
the asleep screen or mid-animation — press the muted **Skip** button at the
bottom right or hit Escape; either goes straight to the dashboard, silent.
With reduced motion switched on in your system settings you get the awake
dashboard at once.

Or start any step directly by its command (the full list is in the README's
[Prefer the terminal?](../README.md#prefer-the-terminal) section).

The first thing it asks is how you would like to work:

> **How would you like to work through this?**
>
> - **In your browser** (suggested)
> - **Here in the terminal**

Pick the browser and a page opens at a `127.0.0.1` address, straight away:
opening the page is the first thing the skill does, before it reads your
project, so for the first few seconds you see a starting screen naming the step
("Starting Pathfinder") while it gets its bearings — for the core steps, with
Planny acting that step out. The questions replace it the
moment they are ready. Answer what is there, press **Send to Plan2Code**, and
it carries on. You can switch back to the
terminal at any point by saying so: the files under `specs/` are the same either
way, and neither side owns them.

While the page is open, the agent's messages in the terminal end with a
pointer back to it — `→ Look at the web console: http://127.0.0.1:…` — and
while it is waiting on you it says so in those words: *Waiting on your answer
in the web console*. Glance at the terminal, and it always tells you where to
look.

Know you want the page already? Pass `--web` with the command —
`/plan2code-1-plan --web plan a lunch voting app` — and it opens the console
without asking. The flag is dropped before the rest of the argument is read, so
it never becomes part of the request.

Sharing the link with a colleague on another machine will not work, and that is
deliberate. It is bound to your own machine only. To work through a session
together, share your screen.

For the same reason, the web console is only offered when the agent is running
on your own machine. An agent working in a cloud VM, a container or over SSH
stays in the terminal: a `127.0.0.1` link from somewhere else is a link you
cannot open.

### Your role

The first control in *User Preferences* (the gear button) is **Role**:
Engineer, Product lead / PM, Architect / tech lead, Designer (UX), QA / test
engineer, Engineering manager, or **Not set / none of these**, the default.
It only reorders things: the starter templates on an idea card and the starter
questions on the Ask tab. It never changes what a skill asks or does. It is
kept in `looks.json` with your colors, so it follows you into every session,
and **Back to default** sets it back to *Not set*.

Until you have chosen, the dashboard shows a one-line banner at the top —
*Pick your role to get starter templates ordered for you.* — with **Set up
preferences** and **Not now**. Choosing any role, *Not set* included, or
pressing *Not now* puts it away for good.

### Starter templates

The first "What's the idea?" box in Pathfinder, Plan and Quick Task has a row
of starter templates above it: **Blank** first, then outlines to fill in (an
engineering spec, product requirements, a design decision, a bug
investigation, and so on), in the order your role puts
them. With a role chosen, the first one carries a *For your role* pill. Pick
one and the box fills with editable text, `[blanks]` marked; if you have
already typed something, a strip asks **Replace** or **Keep mine** first.
Only what is in the box is sent, exactly as if you had typed it.

The templates live in the page (`public/starters.js`), not in the prompts. A
skill only marks its fresh-idea card with `"templates": "idea"`, and `post`
refuses that flag on anything but a `text` card. A resumed map or plan asks
no idea question, so it shows no templates, and the terminal never has them.

### Leave for later (Pathfinder)

Pathfinder's scope question is **Leave for later** — *"Which of these features
are we leaving out this time?"* It is a tick-any list of 3–5 features someone
might expect, each ending with what leaving it out means ("Scheduled exports
(Leaving this out = someone runs each export by hand)"), with a recommended
set to tick in one go. The features you tick become the first lines of the
map's *Out of scope*. Every option names a feature, never a rule to keep, so a
tick always means "not this time".

### Skipping a question

**Skip this one**, on an optional question, now moves you straight on: the card
reads *Skipped* for a beat (about a quarter of a second) and the next open
question comes up. On the last one, focus goes to **Send to Plan2Code**
instead. A click or a key press in that beat cancels the move. **Do not skip**
on a skipped card brings it back.

### Your workspace

The folder label in the middle of the footer — `shop · main`, or
`shop + 2 folders · main` once you have added some (shorter on a narrow
window) — opens the **Workspace** dialog: the folders the agent uses as
context for this console session.

- **The folder you started in** is always first. It can be renamed and given a
  description, but not removed.
- **Add a folder** by pasting a path (`../shared-ui` counts from the folder
  you started in; `~` is your home folder) or with **Browse…**, which opens
  your system's own folder picker. Browse… is hidden when the page looks like
  it is being reached from another machine (SSH, a dev container, a
  Codespace). A path that is not a folder, one already in the list, and a name
  already taken are each refused with a message (a taken name comes with a
  **Use @name-2** button); a folder inside another one in the list is
  accepted, with a note.
- **Every folder has an `@name`** (lowercase letters, numbers and hyphens) and
  an optional one-line *What is it?*. Type `@` in the Ask box, a note or a
  typed answer and a list of names pops up; the agent reads `@shared-ui` as
  that folder.
- **What the agent does with them.** It is told the list when its session
  opens and each change once after that. Added folders are read-only
  reference: it reads them, reads each one's `AGENTS.md` (or `CLAUDE.md`)
  before first using it, and changes one only if you ask. Your harness may
  ask permission the first time it reads outside the project.
- **Marks.** *This folder no longer exists* when it is gone from disk; *The
  agent can't read this yet* when the agent reported a failed read (in Claude
  Code with a copyable `/add-dir <path>` to run); *Inside another folder in
  the list* for a nested one.

The workspace carries across skills you start from the dashboard and back, and
it is remembered for next time:

- **Saved on every change**, in `~/.plan2code/console/workspaces.json` (beside
  `looks.json`, never in the project, since the paths are your machine's),
  keyed by the folder you started in.
- **One list per spec.** *Start from scratch* on the dashboard shows the
  project's list. Picking a spec loads its own; the first time, it starts as a
  copy of the project's, and after that the two are separate. A spec created
  mid-run (Pathfinder, Plan) takes the list in force with it. The line under
  the dialog's title says whose list it is.
- **Forgotten on archive.** Finalize's Spec Cleanup step says it will forget
  the spec's list and runs `console.mjs forget --spec specs/<name>` after the
  move.

### Session meter

A small ring pill in the top bar — **Session: fresh** (green), **Session:
getting long** (yellow), **Session: time for a fresh start** (red) — counts the
work this console session has done. Click it for the count, a list of each
step that added points and what it added (for example *Quick task started +1*),
and a **What is this?** link to Help.

Each skill run adds points (`WEIGHTS` in `public/meter.js`): Plan, Document,
Review, Init and Init update 2; Revise plan, Quick task and Finalize 1; a
Pathfinder map 2 and each question its research subagents settle 1; a built phase by its size,
one point per 3 tasks it completed (rounded up), plus 1 for Implement + Review
(a flat 2, or 3, if the agent did not report a task count); Handoff and the dashboard 0.
A build counts while it runs: each task the progress bar ticks off adds to the
build's row (*Implement + Review: 9 tasks built so far*), Implement + Review's
review stage adds its 1 as it starts, and the approved phase takes the row over
with its final score, so the meter never waits for the sign-off to catch up.
On top of that, every 2 questions you answer on the page add 1 point to the
skill run you answered them in (`ANSWERS_PER_POINT`), so a long Pathfinder or a
Plan with many clarifying questions weighs more than a short one. A review run on the
page after a quick task or a phase sign-off counts as a Review too. Green is
under 5, yellow from 5, red from 10, and the ring is full at 15. At red the dashboard
also shows a banner: starting a **new console session** keeps the agent sharp
(resuming this one carries the count along). It is a rule of thumb, not a
reading of the agent's real context, and it never blocks anything.

### While something is being built

Implementation, Implement + Review and a Quick Task spend most of their time
building rather than asking, so the page shows the build instead:

- **What it is doing right now**, beside Planny ("Task 5 of 9: the rate
  limiter"), and the progress bar counting tasks done. Tasks are counted
  within the phase, to match the bar — the phase is already named in the
  headline — so you never see "Task 4.2 of 6"; the page rewrites that form if
  an agent still sends it.
- **The phase's task list** in its own tab, ticking as each task lands on
  disk, and **the phase file itself** (`phase-3.md`) rendered in the next —
  the prerequisites and task specs, not just the checklist.
- **Any question the build needs answered** (which phase, a spec conflict,
  failing tests) appears as an ordinary question, and the sign-off is a
  **Completion report** tab with an *Approve this phase* card.
- A long task is not mistaken for a stall. The build says how long it may go
  quiet, and the page only calls it stuck after that.

### Review before you approve

The *Approve this phase* card carries a **Review the code first** button beside
the approval. Press it and the same session runs a focused code review of
exactly the files the phase changed, before you are asked to approve anything.
The findings come back as a tab, and a *Which to fix* card lists every one with
its severity: tick the ones to fix (or use the *Critical and warnings* / *All
of them* quick picks), press Send, and it fixes and re-checks them before the
approval card comes back.

A quick task has no approval step, so its offer sits on the finished screen
instead: a large **Review it now** button above the next step, with **No
thanks, I am done** beside it. If the session has already closed, the button
turns into the `/plan2code-review` command to run in the terminal.

Implement + Review shows neither: it reviews every phase before sign-off
already.

### When a session ends

A finished session says so, and ends in one of three shapes:

- **A next step.** What happened, and the exact command to run next (with a
  Copy button) — the next phase, Finalize, a commit.
- **All done.** Nothing is left to run, so there is no command to copy:
  *"All done, nothing left to run."* Init, Init update and Handoff end this
  way, and so do Review and Finalize when nothing landed that needs committing.
- **Paused.** You pressed *Stop session*. The card names what was saved and
  gives the command that picks it up later. Nothing else is offered.

The first two also carry a **Back to the dashboard** button (beside the next
step, or as the main button under "All done"). Press it and the same page turns
back into the skill menu, in the same conversation, so the next skill starts
right there. The agent keeps listening for it for about ten minutes after the
session ends; after that, or once the session has closed, the button turns into
the `/plan2code` command instead. That command is on both of these screens
anyway, for starting the dashboard in a fresh conversation — the better choice
after a long skill, since a fresh conversation starts with a clean context.

You don't have to finish first. On every skill but the dashboard itself, a
small **triangle** pointing left, in your highlight color, sits beside *Stop
session*. Press it, confirm, and the agent saves your place exactly as a stop
would, with any answers you have ready going along. Then the page turns into
the dashboard instead of showing a finish card. Pick the same skill again to
carry on, or pick another one. Like Stop, it only works on your turn, and where
nothing is saved yet (early in a plan) the confirm says what would be lost.

### Attachments in notes and questions

Any note, any quick question on the Ask tab, and the fresh-idea box on
Pathfinder, Plan and Quick Task can carry files (on a card they travel with your
answer as a note attachment), three ways:

- the **+ Attach file** button beside the box (pick one or more files),
- **paste** a screenshot or a copied file straight into the box,
- **drag and drop** files onto the notes panel or the Ask composer.

Two kinds are allowed:

- **Images.** Each is shrunk and re-encoded in your browser (JPEG, 2000 px on
  the long edge at most, phone-photo rotation kept) and shows as a thumbnail.
- **Documents**: text, code and PDF (`.md`, `.txt`, `.json`, `.yaml`, `.csv`,
  `.log`, `.js`, `.ts`, `.py`, `.sql`, `.pdf` and the like), up to 10 MB each.
  They upload exactly as they are and show as a chip with the file type, name
  and size. The server checks the contents match the type (a PDF header, or
  UTF-8 text with no NUL bytes), and a document is never opened from the page.

Up to 5 attachments per note and 5 per question, images and documents counted
together. Anything else (`.docx`, a file over 10 MB, a dotfile such as `.env`)
picked or dropped is refused with a message naming the file; a paste only
picks up the files it can attach, and leaves any text to paste as usual. Each
file uploads straight away while you carry on typing, and sits in a tray with a
remove button; removing one deletes its file. A failed upload offers retry or
remove and holds back only that note, so the rest of your answers still send.

The files are stored with the session, in
`~/.plan2code/console/sessions/<id>/uploads/`, never in your project, under a
random name the server picks. When you send, each note is followed by one line
per attachment:

```
Note on Header row: Please keep the header row.
  Image: /home/sam/.plan2code/console/sessions/<id>/uploads/<uuid>.jpg (header.png)
  File: /home/sam/.plan2code/console/sessions/<id>/uploads/<uuid>.pdf (api-spec.pdf)
```

and the agent opens those paths with its own file reader. Uploads from sessions
untouched for 30 days are swept away the next time a session opens.

**Keeping the ones a spec cites.** When the agent is about to write a file
under `specs/<idea>/` that links to one of your note attachments (a plan, the
overview, a phase file, a Pathfinder question or the map), it first copies the
attachment into `specs/<idea>/attachments/` with `console.mjs keep` and links
the copy, so the spec still shows it after the session is swept. The copy is
named `<slug of your file name>-<8 characters of the upload id>.<ext>`, so
keeping the same upload twice reuses it. Attachments nothing cites stay in the
session, and quick-question attachments are never kept. `keep` is run by the
agent, in its own shell; the server itself still never writes into your
project.

### Ask a quick question

The **Ask** tab, always the last tab, on the dashboard and in every skill,
opens a **Quick question** chat. Ask anything about the project's files, or
anything at all, without waiting for a card. The agent running the skill
answers at its next check-in (in a build, after the task it is on), and the
workflow carries on meanwhile. Asking never holds up a card send, and a card
send never holds up a question.

- **Context only when you add it.** A question starts with no context, so it
  reads as a general question. **+ Add context**, beside *+ Attach file*,
  lists the last 3 places you visited (question cards, document sections, a
  spec picked on the dashboard) plus *This spec*; pick one and an *About: …*
  chip sits above the box. × removes it, and it clears after the question is
  sent.
- **Starter questions.** An empty conversation offers a few questions to start
  from, chosen for the skill you are in and ordered by your role; the ones
  that need context appear once you have added some. Clicking one fills the
  box without sending it.
- **Pictures.** The same as notes: the button, paste, or drag and drop, up to 5
  per question.
- **Ten questions per conversation.** The `N of 10` counter is always in view.
  After the tenth is answered, **New conversation** starts a clean one. So does
  switching skills through the dashboard.
- **Edits need your approval.** Ask for a change to a file and the agent
  replies with a summary and the list of files it would touch, with
  **Approve** and **Decline**. Nothing changes until you approve. Afterwards
  it lists what changed, with line counts, and nothing is committed unless you
  spell out a commit in your message. It never edits the running skill's own
  files under `specs/`, and a chat message never answers a card or moves the workflow on: that is what the cards are for.
- **When you cannot send.** Two different lines explain it: "That's 10
  questions in this conversation" means start a new one, and "No agent is
  connected right now" means the session has finished or the agent has gone
  quiet, so resume it to ask. Either way the conversation above stays
  readable.

A reply that lands while you are on another tab puts a dot on **Ask** and
chimes once (if sounds are on).

### When an update is out

When a newer Plan2Code release is out, the dashboard shows an **UPDATE
AVAILABLE** banner at the top. Click it for the details: the version you
have, the new one (linked to its Releases page) and the exact command that
updates you, with a Copy button. **×** hides the banner for this session; the
next dashboard shows it again until you update.

The check uses your own git login to read the repo's release tags, once an
hour at most. If git cannot reach the repo (no git, no access, offline), you
simply see no banner, and nothing waits on it. The version in Help always
links to the Releases page.

### Keyboard

| Key | Does |
| --- | --- |
| `Ctrl` + `Enter` (`⌘` + `Enter` on a Mac) | Send |
| `Tab` / `Space` | Move between options and pick one |
| In the Ask box: `Enter` / `Ctrl` + `Enter` (`⌘` + `Enter`) | `Enter` is a new line; `Ctrl` + `Enter` sends the quick question, never the cards |
| `Esc` | Closes whichever dialog is open; on the dashboard, backs out of a pick |
| In Help: arrow keys, `Home`, `End` | Move between topics (the arrows wrap). `Ctrl` + `Enter` does nothing inside Help |

Every control is a real button, radio or checkbox, so screen readers and
keyboard-only navigation work.

## Models in User Preferences

The `plan2code` launcher's model menu comes from `models.json`, which every install overwrites with the authors' curated list. **User Preferences → Models** (Claude and Devin tabs) lets you add a model that came out before Plan2Code was updated; additions are kept in `~/.plan2code/models.json`, and **Reset to default** removes them. Restart `plan2code` to see a change. You can always run `plan2code --model <id>`, or switch model inside your agent before running a skill. Devin ids ending `-xhigh` or `-max` are refused. Maintainers refresh the curated list with the repo-local `/plan2code-model-update` skill, which shows a diff and changes only what they approve.

---

## Troubleshooting

| What happened | What to do |
| --- | --- |
| You closed the tab | Open the link again. Everything is where you left it. After about two minutes with no tab open the link stops working: ask the agent to resume the session for a new one. |
| The link stopped working | Tell the agent. It restarts the session and gives you a new link. |
| Your agent session died while you were mid-answer | Press Send anyway. Your answers are written to disk and are never discarded, including when the session is restarted. The next session picks them up. |
| The page says Plan2Code is not running | It has not checked in for a few minutes. Look at the terminal: it may have finished its turn, hit an error, or be waiting on you there. If it is idle, type `continue` in the terminal and it picks your answers up. Answering here still works, and what you send is held for it. |
| You are not sure anything is connected | The **?** at the top right opens Help. Its *What this page is* tab says what keeps the page alive and whether both halves are talking at that moment, and *When something looks stuck* covers what to check. |
| You would rather use the terminal after all | Say so. Nothing is lost. |

---

## How it works

Nothing is installed. The skills ship a small zero-dependency Node server
(`references/web-console/`), and the workflow step starts it when you say yes.

```
agent                          server (detached)              your browser
  |                                  |                             |
  |-- open (binds the port, starts ->|                             |
  |   the server AND the browser) ---|---------------------------->|
  |<-- http://127.0.0.1:PORT/s/TOK/  |<---- the page, first state -|
  |                                  |      already inside it      |
  |-- post the first questions ----->|---- pushed to the page ---->|
  |-- wait --seconds 240 ----------->|                             |
  |   (returns every 4 minutes with  |                             |
  |    progress, then waits again)   |<---- you press Send --------|
  |<-- your answers -----------------|                             |
```

The server runs detached rather than as a background task of the agent, because
agent background tasks get killed at various timeouts, and that would take your
half-finished answers with them.

**It is built to show you something fast.** A browser takes most of a second to
turn up after it is asked, so `open` binds the page's port itself and sends the
browser there before the server has even finished starting; the server takes
the port over a moment later, and the browser's request waits for it rather
than being refused. The page arrives with the session already inside it, so it
draws the real screen without asking for anything first, in your own theme and
colors from the first frame. On a Windows laptop the page is in front of you in
roughly the time the browser itself takes to open.

**It stays up while the page is open.** The page pings it every few seconds, so
the idle clock never runs down while you are there. Close the tab and it shuts
itself down about two minutes later; it stops after four hours regardless, and
the agent stops it outright when the session ends.

That also means **the server routinely outlives the agent**. It is the agent, not
the server, that reads your answers, and the two fail separately. The page tells
the two apart: the **?** button at the top right opens Help, whose *What this
page is* tab says which halves are talking right now (and *When something
looks stuck* covers what to check), and Planny stops looking busy once
nothing is listening rather than spinning at you indefinitely.

**State lives in three places**, and none of them is your repository (the one
exception being the note attachments the agent keeps for a spec, above):

| Where | What | Survives |
| --- | --- | --- |
| `~/.plan2code/console/sessions/<id>/` | the questions, your draft, your answers | 30 days after the session was last touched |
| `~/.plan2code/console/sessions/<id>/workspace.json`, `ledger.ndjson`, `workspace-cursor.json` | the workspace's folders (paths, names, descriptions — never their contents), the session meter's events, and how far the agent has been told of workspace changes. Kept beside the session, so they outlive every dashboard hop | with the session |
| `~/.plan2code/console/sessions/<id>/uploads/` | images and documents attached to notes and quick questions | 30 days after the session was last touched |
| `~/.plan2code/console/looks.json` | your role, theme, colors, sounds and card width | always |
| your system temp directory | the port, process id and session token | until reboot |

Each of the workspace and meter files has exactly one writer: the server owns
`workspace.json` (the page changes it only through the `/workspace` routes
under Security), and `console.mjs` owns `ledger.ndjson` and
`workspace-cursor.json`. The meter's count is never stored; it is folded from
the ledger every time (`public/meter.js`), so a repeated `post` never counts
twice. The logic lives in small pure modules the tests import directly —
`public/workspace.js` (names, the footer label, the change lines the agent
reads), `public/meter.js` and `public/mentions.js` (the `@name` popover) — and
**Browse…** runs the per-OS picker in `picker.mjs`, copied from the
`plan2code` launcher and kept in step with it by a test.

**Old sessions clean themselves up.** Each time a session opens, whole session
folders nobody has touched for 30 days are deleted — questions, drafts,
answers, uploads and all, paused or not — along with stray scratch files
(`.json` / `.mjs`) left at the top of `~/.plan2code/console/` for as long.
Your `looks.json` and the `console-dir` pointer are never touched, and neither
is the session being opened. Nothing of value goes with them: the page is
never the record, `specs/` in your project is.

**Or clean up on demand.** *User Preferences → Cleanup* → **Find files to
clean up** lists, with sizes, everything in `~/.plan2code/` that is not
needed: sessions untouched for 30 days (never the one you are in), anything at
the top of `~/.plan2code/console/` other than `sessions/`, `looks.json`,
`workspaces.json`, `console-dir` and `update-check.json`, and anything at the top of `~/.plan2code/` other than
`console/`, `bin/`, `launcher.json` and `models.json`. A stray is listed once
it has sat untouched for an hour, so a lock or temp file another session is
writing right now is never caught. **Delete these** removes
that list and nothing else. A console running from another home
(`PLAN2CODE_CONSOLE_HOME`) only ever looks inside that home.

---

## Security

It is a local dev server that reads files in your project (never writing to it)
and keeps its own state in your home folder, so it is built to be boring about
this:

- Bound to `127.0.0.1` only, never `0.0.0.0`. Not reachable from your network.
- A `Host` header allow-list, which is what stops a website you happen to be
  visiting from talking to it through a DNS rebinding trick.
- A 128-bit token in the link, swapped for an `HttpOnly; SameSite=Strict` cookie
  on first load so it leaves your address bar, your history and any screenshot.
- A strict Content Security Policy with no inline script allowed.
- Markdown written by the agent is turned into page elements directly and never
  into an HTML string, so a document that quotes a hostile README cannot run
  anything. It shows up as text, which is what it is.
- Uploads are named by the server (`<uuid>.jpg`, or `<uuid>.<ext>` with the
  extension taken from the allow-list, via `crypto.randomUUID()`), never by the
  file name you sent, and live only under the session's own `uploads/`. The
  server checks the bytes: a JPEG header for images (4 MB cap), and for
  documents a `%PDF-` header or strict UTF-8 with no NUL byte (10 MB cap).
  Documents are served back only under a fixed type (`application/pdf`, or
  `text/plain` for text and code) with `nosniff` (and `sandbox` on text), so
  the Sent box can link them. A send may only point at
  uploads inside that session's `uploads/`, images in `images` and documents
  in `files`.

### Routes

The upload routes, the send, the overview read and the workspace. Like every page route, they are on `127.0.0.1`
behind the session cookie, and the ones that write also check the request's
origin.

| Route | Does |
| --- | --- |
| `POST /upload` | Raw bytes, original name in `x-p2c-name`. `Content-Type: image/jpeg`: writes `uploads/<uuid>.jpg` and answers `{ ok, id, kind: "image", path, url, name, size }`; not a JPEG → 415, over 4 MB → 413. `Content-Type: application/octet-stream`: a document, its extension from the name's allow-listed extension; writes `uploads/<uuid>.<ext>` and answers `{ ok, id, kind: "file", path, name, size }` with no `url`; not an allowed extension or contents that do not match → 415 `type`, over 10 MB → 413. Any other content type → 415. |
| `GET /uploads/<id>.<ext>` | Serves an upload: an image as `image/jpeg` (the thumbnail after a reload), a document as `application/pdf` or `text/plain; charset=utf-8` with `nosniff` and, on text, `Content-Security-Policy: sandbox`. Only `<uuid>.<allowed ext>` names under `uploads/`; anything else is 404. |
| `DELETE /uploads/<id>.<ext>` | Deletes an image or document removed before sending. 204, or 404 if it is not there. |
| `POST /submit` | The Send. A note may carry `images` and `files`, each `[{ path, name }]`: at most 5 together, images in `images` and documents in `files`, every path inside this session's `uploads/`, otherwise 400. |
| `POST /chat` | A Quick question `{ text, about?, images?, files?, conversation }`, or `{ reset: true, conversation }` for New conversation. Appended to the session's `chat.ndjson`. 400 `too-long` (over 4,000 characters), `image`, `file` or `bad`; 409 `offline`, `stale` or `limit` (10 per conversation). Never refused because a card send is still uncollected. |
| `POST /chat/decision` | Approve or Decline on an edit the agent proposed: `{ re, decision, text?, conversation }`. Once per proposal; does not count toward the 10. |
| `GET /overview?spec=specs/<name>` | The Overview tab's read of `<spec>/overview.md`, as `text/markdown` with `cache-control: no-store`. On the dashboard `spec` must be one of the scanned specs; elsewhere the session's own spec is used. The file's real path must stay inside the project, so `../`, absolute paths and symlinks pointing out all get 404. |
| `GET /workspace` | The Workspace dialog's list: folders, `missing`, `remote` and the agent's folder `issues`. `?check=1` re-checks every folder on disk first. |
| `POST /workspace/add` | `{ path, name?, description? }`. The path is resolved against the folder the session started in (`~` expanded) and must be a folder: 400 `not-a-folder`, `duplicate` (with its `name`; compared case-insensitively on Windows and macOS), `bad-name`, or `name-taken` with a `suggest`. Answers the new entry, `nested: true` when it sits inside another folder in the list. |
| `POST /workspace/edit` | `{ id, name?, description? }`. Renames or re-describes one folder: 400 `bad-name` / `name-taken`, 404 `unknown`. |
| `POST /workspace/remove` | `{ id }`. 400 `original` for the folder the session started in, 404 `unknown`. |
| `POST /workspace/browse` | Opens the system folder picker and answers `{ path }` or `{ cancelled: true }`; never adds anything itself. 409 `busy` while one is open, 404 `no-picker` when the session looks remote or no picker exists. |

## For maintainers

| | |
| --- | --- |
| Source | `src/web-console/` |
| Ships as | `skills/<every skill>/references/web-console/` |
| Wiring | one `additionalReferences` entry per skill in `install.js`; the dashboard's menu lives in `public/answers.js` (`SKILL_CATALOG`) |
| Agent contract | `src/web-console/console.md`, plus `building.md` for the build steps |
| Tests | `node --test scripts/test-web-console.mjs`, also run by `npm test` |
| Start-up benchmark | `node scripts/bench-web-console.mjs` (needs `puppeteer-core` and a local Chrome or Edge for the paint columns; `--browser-delay 900` models a real browser launch, `--roundtrip` times Send→agent and post→page) |
| Screenshots | `node scripts/capture-screenshots.mjs` (needs `puppeteer-core` and a local Chrome or Edge) |
| Dependencies | none at runtime. `marked` 15.0.7 (MIT) is vendored for its lexer only |

Edit `src/` only. `skills/` is a committed build artifact: regenerate it with
`npm run build:skills` and commit it with the source change, since `npm test`
(via `--verify-skills`) fails when it drifts from `src/`.

### Driving it by hand

You do not need an agent to poke at the console. Point `PLAN2CODE_CONSOLE_HOME`
somewhere disposable first, so you never touch a real session:

```bash
export PLAN2CODE_CONSOLE_HOME=/tmp/p2c-play     # Windows: $env:PLAN2CODE_CONSOLE_HOME

cat > /tmp/payload.json <<'JSON'
{ "workflow": "pathfinder", "title": "Playing about",
  "items": [ { "id": "q1", "kind": "choice", "title": "Export format",
    "body": "Pick one.",
    "options": [ { "k": "A", "text": "CSV", "recommended": true },
                 { "k": "B", "text": "Excel" } ],
    "token": { "A": "a", "B": "b" } } ],
  "agent": { "status": "waiting" } }
JSON

node src/web-console/console.mjs open --file /tmp/payload.json   # prints the URL, opens the browser
node src/web-console/console.mjs wait --session <sid> --seconds 60
node src/web-console/console.mjs stop --all
```

`node src/web-console/console.mjs help` prints the same command summary an
agent gets when it finds the binary before the docs.

`wait` exits `0` with the answers, `10` if nobody has finished yet, `20` if the
server died, `30` on Cancel. Pick `--seconds` to sit under whatever your harness
allows a single command: it is a poller, so killing it costs nothing, and a
collected result is printed before it is marked collected, which means an
interrupted handover can only repeat itself, never lose an answer. `status`
lists sessions and flags any whose answers were submitted but never collected.

When something misbehaves, the session directory is the whole story:
`state.json` (what the agent published), `draft.json` (what the person has typed
but not sent), `result.json` (what they sent), `events.ndjson` (an append-only
log you can `cat`), and `server.log`.

Set `--idle-ms 60000` on `open` if you want the server to shut itself down
quickly while experimenting.

Two environment variables help when the start is what you are looking at:

| Variable | Does |
| --- | --- |
| `PLAN2CODE_CONSOLE_TRACE=1` | `open` prints a timeline of its steps to stderr (roots found, server spawned, port bound, browser sent, state written, server listening). |
| `PLAN2CODE_BROWSER` | The command that opens the link instead of the system default, run through the shell with the link appended, e.g. `PLAN2CODE_BROWSER='firefox --new-tab'`. |

Every `console.mjs open` also writes its own directory to
`$PLAN2CODE_CONSOLE_HOME/console-dir` (or `~/.plan2code/console/console-dir`
when the override is unset): it is how an agent finds the console on a later
session without searching the skill install dirs.

The vendored file is `src/web-console/public/vendor/marked.esm.js`,
sha256 `7a7d9a521ac9384e0c3a075120a7c486cbd0c3c32cc5601bbb79a23e97403690`.
Only `marked.lexer()` is used; the rendering is ours, in `public/render.js`, and
builds DOM nodes rather than HTML so nothing needs sanitising.

### Refreshing the screenshots

The docs and the landing page show the console through the images in
`docs/screenshots/`, one light and one dark WebP per screen. Rerun the capture
after any change a person would see on the page: a new layout, a renamed
button, a different colour.

```bash
npm i --no-save puppeteer-core                           # once; never added to package.json
node scripts/capture-screenshots.mjs                     # every screen
node scripts/capture-screenshots.mjs --only dashboard    # one screen
```

Each screen is staged with no agent, from the payloads in
`scripts/screenshots/` (its README names the file behind each screen), in a
throwaway sample project and console home that the script removes when it is
done. It prints each file's size and warns over 300 KB.

Open every image before you commit it: the right screen, both themes, nothing
cut off, and no username, home path or real project name anywhere on it.
