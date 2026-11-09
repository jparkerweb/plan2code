# The Plan2Code desktop app

One window for working with an AI agent. The app opens the Plan2Code dashboard as its main surface,
runs your agent (Claude Code, Devin or Codex) in a terminal panel it owns, and has a **New Session**
button that replaces the agent with a fresh one on a brief the app builds from its own record of the
session. The fresh agent gets a console session of its own, so the Session meter starts over with it.
It is an addition: `/plan2code` typed inside an agent works exactly as before, with or
without the app.

## Get it

The installer offers the app after the skills and the `plan2code` command:

```
npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git
```

Answer **Y** to "Also install the Plan2Code desktop app?" (it is the default). It downloads the file
for your system from the GitHub release, checks it against the release's checksum list and puts it in
`~/.plan2code/app/`. If a checksum does not match, the file is thrown away and nothing is installed.
If the download fails, the skills and the `plan2code` command are still installed; the installer says
so, and you can run the installer again later.

Releases carry one file per system:

| System | File |
| --- | --- |
| Windows (64-bit Intel or AMD) | `plan2code-app-<version>-windows-x64.exe` |
| macOS (Apple silicon) | `plan2code-app-<version>-macos-arm64` |
| macOS (Intel) | `plan2code-app-<version>-macos-x64` |
| Linux (64-bit Intel or AMD) | `plan2code-app-<version>-linux-x64` |

On any other system the installer says there is no build for it and carries on without the app.

Each of those is a plain executable, not an OS-level installer package (no `.msi`, no NSIS `.exe`
setup, no `.dmg` with a drag-to-Applications step): the installer above places it directly, already
verified. `plan2code-app`'s own `npm run build` can produce `.msi`/NSIS/`.dmg`/`.deb` bundles locally
(Tauri's bundler is on), but the release workflow does not build or publish them; nothing today
downloads or runs one.

You also need Node.js 18 or newer (the app checks at start and says what to install) and:

- **Windows:** the WebView2 runtime, which comes with Windows 11 and current Windows 10.
- **Linux:** WebKitGTK 4.1 (`libwebkit2gtk-4.1`) and a desktop session.

## Start it

Run `plan2code` in your project, as always. When the app is installed and a window can open,
`plan2code` asks which agent and model (as before) and then opens the app on that folder instead of
running the agent in your terminal. The desktop shortcut the installer can create runs the same
command, so it opens the app too.

Three things keep today's terminal flow:

- **`plan2code --classic`** runs the agent in your terminal even when the app is installed.
- **No display.** On Linux without a display (over SSH, in a container) `plan2code` falls back to the
  terminal flow by itself.
- **An SSH or service session on macOS or Windows.** The same fallback applies there, since neither
  has a desktop to open a window on either.
- **Not a project folder.** If the folder is not a git repository and has no `AGENTS.md` or `specs/`,
  `plan2code` asks you to confirm before opening the app on it.

## What's in the window

The first time the app opens on a folder, a checklist confirms Node, the agent CLI, the project
folder and the skills version before anything else shows; a later launch skips straight past it.

A **launch card** then asks which agent, model and effort (Claude and Codex only) to start on. The
picker lists Claude Code, Devin and Codex, then any custom agents you added in the web console's
**User Preferences → Agents & models** (saved in `~/.plan2code/agents.json`, shared with the `plan2code`
command), and starts on one that is actually installed, so a machine with only Devin or Codex is ready
to go. Permission checks off is its own tick, on by default (see below; New Session keeps whatever
you picked, and reuses the same agent); a CLI the app cannot find is named, with how to install it,
instead of just being grayed out. The card is skipped when the launcher already passed an agent to
start.

With no agent installed at all, the checklist and the launch card each show a **Set up an agent**
button. It opens the same setup page the `plan2code` command uses, inside the app's window: every
built-in listed as found, found outside PATH or not found, with its install commands for your
system, an **Install page** link, **Check again**, **Use it from here** for one found outside
PATH, and the starter templates for other agent CLIs. When the page reports an agent found, the
app returns to where it was (the checklist or the launch card), re-checks, and picks that agent on
the launch card ready for Start. A **Back** button leaves the page at any time. When the saved
(last used) agent is gone but another works, a one-line notice on the launch card says so and the
card carries on with the working one.

The window's own title (and so its taskbar entry) reads **Plan2Code - &lt;folder name&gt;** once a
project is open, so two or more windows on different projects read apart without opening each one
to check.

The taskbar entry also shows when Plan2Code needs you, the same states as the console's tab icon in
a browser. On Windows a green dot means it is your move and a red dot means it needs attention, with
one short burst of flashes when the window is not focused; on macOS the dock shows a red `!` badge on
needs attention and bounces once; on Linux a count badge appears where the desktop supports it. There
is no dot while the agent is busy or once a finished step has nothing left to press (a finished screen
that still offers a button, such as back to the dashboard, keeps the green dot), and it clears when
the agent ends or the page reloads. Turn it off with **Show on the taskbar when Plan2Code needs
me** under **User Preferences → System → Desktop app** (shown only inside the app). The per-system details are in
[plan2code-app/README.md](../plan2code-app/README.md#agents-and-the-taskbar).

A slim top bar reads, left to right: the project folder's name, a menu holding its full path and
**Change project**; **New Session**, whenever an agent exists; the agent's own menu, with a dot for its
state, an amber **checks off** badge while permission checks are off, and **Change agent** once it has
ended; a short line (why the agent ended, a New Session's brief, or what went wrong); and, at the right
end, the one next step for the console or the skills when there is one (**Reconnect the console**,
**Update skills**), with "+N more" if anything else is waiting behind it. The console itself, opening inside the
window (not only the dashboard — every console page, including Ask, Workspace, Notebook, Help,
Preferences and Git), already shows which page is open and its own **Session** meter (how much plan2code
work this session has done) in its own bar, so the app's bar does not repeat either. That Session meter
is the one place for "is this session getting long" under the app, too: the app does not keep a second,
separate context-window meter of its own, so there is only ever one gauge to read and only one place its
threshold is tuned. The terminal panel has its own toolbar: dock it to the bottom or the right, collapse
it to a thin strip, or maximize it; its size is remembered. An "agent may need you" badge appears on a
collapsed or small panel once the agent has sat quiet for a while. **Change project** (in the project
menu) asks first if an agent is running, then stops it and the console before opening the new folder.

If the console itself ever needs reconnecting (it stopped, or the skills were just updated), every path
to that offers the same **Reconnect the console** button — never "Restart the console" in one place and
"Start it again" in another for the same action — and only one shows at a time.

The console also knows when it is running inside the app (the agent it talks to carries that signal):
its session meter, the "Before you close this" guide on a finished step, and the dashboard's red-session
banner all point at the app's own **New Session** button instead of a command to paste into a new
conversation, since New Session already does that in one click; and the console's own "update available"
banner never shows, since the app's **Update skills** button (below) already covers it with no shell
involved. A slash command still offered to continue a step (such as `/plan2code-4-finalize`) stays
exactly as it would in a terminal: paste it into the app's own terminal panel, which runs the real
agent CLI.

## Implementation Loop

The Implementation Loop builds every remaining phase of a documented spec for you, one after another,
while you do something else. It is in the app only: the dashboard shows an **Implementation Loop**
card there, and nowhere else. Pick a spec, answer a short setup, press **Start the loop**, and the app
confirms it once in its own window before anything runs.

**How it runs.** Each phase gets a fresh agent session, so a long spec never grows one tired
conversation. The app, not the agent, decides when a phase counts: it reads the spec's marks, runs the
quick check, marks the phase done and commits it. With commits on, it commits to the branch you are on and never
pushes. With commits on, Start needs a clean working tree (the setup offers the Git board when it is
not), so your own edits never end up inside a phase's commit.

**The setup.** The fields and their defaults:

- **Review each phase** (on): a fresh agent reviews the phase before it counts.
- **Fix findings**: **Smart pick** (the default) has a fresh agent read the findings and fix only the
  ones worth fixing, recording every skip. A skipped Critical stops the phase. **By level** fixes the
  Critical, Warning and Suggestion findings you tick (all three start ticked).
- **Strength per phase** (off): turn on **Set strength per phase** to pick **Thrifty**, **Balanced**, **Best** or **Match my session** for each phase still to build (or **Set all to** one pick). A phase you leave untouched runs on the model the app was launched with, as before. A phase whose agent crashes or goes quiet gets its one retry (when the retry tick is on) one step up (Thrifty to Balanced, Balanced to Best; Best stays Best; **Match my session** runs on the launch model and its retry stays there), and the phase's helpers follow the same strength. Which model each word means for your agent is set in User Preferences, **Agents & models**, under **Strengths in the loop**; an agent with nothing mapped shows the toggle off with a link there. The picks are remembered per project and spec, and a pick for a phase that is done or gone is dropped.
- **When a phase asks something**: **Take the agent's best guess** (the default), which records the
  assumption as a `[?]` task, **Pause and wait for me**, or **Stop the loop**.
- **After the last phase**: **Stop and offer Finalize** (the default) or **Run Finalize automatically**.
- **Quick check**: a command run after each phase, pre-filled from the project (for example
  `npm run build`). Clearing it still lets you start; the setup warns that nothing is checked.
- **If a phase crashes or goes quiet**: **Retry it once** (on), and how many minutes with no file changes, in the project or the agent's
  session, count the agent as stuck (20). Waiting on your answer does not count.
- **Send a notification** (no address, so off): a message from the loop when it waits on your answer or
  ends. Send it to a Discord, Slack, Microsoft Teams or Google Chat webhook, or to any `http` or `https`
  address with the message in its query string or a JSON body. With an address set, **Also tell me when each
  phase is complete** (off) adds a message after every phase that passes.
- **Commit each phase** (on): one local commit per phase, with the subject and `AI Assisted`.

The last setup is remembered per project in `~/.plan2code/console/loop-setup.json`, so the next loop
starts from it. The quick check is typed text the page never runs: the app reads it from that file
itself and names it in its own window before the loop begins. The notification gets the same treatment,
and Resume asks again if either one changed.

**The notification.** The loop says a question is waiting, that it is complete, or why it stopped, and,
when you turn on **Also tell me when each phase is complete**, that a phase passed. Nothing is sent when you
stopped it yourself, and with **Take the agent's best guess** no question ever waits on you. Every message
names the project and spec and the phase as `Phase 2 of 4 (name)`, and, except the finish message (run time only), ends with the time the phase and the
whole run have taken. A phase message also says how many tasks are done, the commit's subject and short id,
and what comes next, for example: `Plan2Code loop on plan2code / lunch-vote: Phase 2 of 4 (Votes) is complete.
Done: 5 tasks, committed "Add votes" (abc1234). Next: Phase 3, Results. Elapsed: phase 6m, run 14m.` What the app sends depends on the **Send to** choice:

| Send to | Request | Where the message goes |
| --- | --- | --- |
| A web address, query string | GET | A parameter you name (`message` by default), added to the address's own |
| Discord webhook | POST JSON | `content`, with mentions turned off |
| Slack webhook | POST JSON | `text` |
| Microsoft Teams webhook | POST JSON | An Adaptive Card, for a Workflows "when a webhook request is received" trigger |
| Google Chat webhook | POST JSON | `text` |
| A web address, JSON body | POST JSON | A field you name (`message` by default) |

**Send a test** saves the setup and sends a test message right away, after the app names the address in its
own window, so a wrong address shows up before a long run. A name can use letters, digits and `- _ . ~`. Pasting a Discord, Slack, Teams or Google Chat address picks
its choice for you, since a plain GET to a Discord webhook answers 200 and posts nothing. The call has 10
seconds and any 2xx answer counts. One that fails never changes what the loop does: the finish line or the
stop screen's evidence says so, without repeating the address, which is stored in `loop-setup.json` and
usually holds a token.

**It uses the app's agent.** The loop starts every phase on the agent and model you launched the app
with, and it needs permission checks off. With them on, an agent would wait on a prompt that nobody
sees, so **Start the loop** stays grayed out until you turn them off (see
[Permission checks are off by default](#permission-checks-are-off-by-default-same-as-the-terminal)).

**What is locked while it drives.** Answers, sign-offs, launches, Workspace, Helpers, **Back** and
**New Session** are read-only, and Ask is off, except for a question the loop is waiting on. Activities, Notebook, Help, Preferences, the documents
and the code review stay usable, so you can watch, play, or read along.

**You can always see it's running.** From the moment you confirm Start until the loop ends, a banner runs
across the top of the window, outside the console page, so it stays put as each phase's session comes and
goes. It says what the loop is doing right now (starting, building, between phases, stopping), with the
phase, its name and step, a pip per phase, the time so far and any retries. It turns amber when a question
needs your answer. The window title says the same, for the taskbar. While the loop works, the page's Send
button and "Nothing to send" line go away, and they come back when a question waits.

**Stopping it.** Two buttons on the banner: **Stop after this phase** lets the phase finish its
review, mark and commit, then ends the loop; **Stop now** ends the agent at once, after you confirm, and never commits, retries or finishes the build (a commit already begun finishes first). Stop after can be canceled by pressing it again. After a window reload the banner and both buttons come back, and Change project and Change agent are blocked while the loop runs.
Quitting the app ends the loop too, and the quit check says which phases are already committed.

**A question holds the loop.** When a phase needs an answer (with **Pause and wait for me**), the loop
waits with no time limit and nothing is lost. The app calls you back with the taskbar dot, a flash
of the window and the question sound, and carries on once you answer.

**When it stops by itself.** The loop ends on a stop screen, saying what failed and showing the
evidence, when:

- the phase's named tests or the quick check fail;
- Critical or Warning findings are left after the re-check, at a level the setup said to fix (a leftover Suggestion does not stop it);
- a task is blocked or the spec conflicts with itself;
- a commit is refused, for example by a pre-commit hook (the app puts the phase file back as it was, so the spec and git agree, and stops with the hook's first line; if the undo fails too, it says so and remembers it across a restart);
- a staged file looks like a secret (`.env` and the like; `.example`, `.sample` and `.template` are fine) or is oversized (nothing stays staged, and the stop line names the file);
- the project is on a detached HEAD (the loop will not start);
- the agent's report is missing task data or says its tests failed (the phase is refused);
- the watcher cannot read the session or hits an internal error (it ends on a stop screen, never a hang);
- the Smart pick skipped a Critical finding.

A crashed or silent agent gets exactly one retry per phase when the retry tick is on, and none when it is off.
It never retries a real failure. On a stop screen, **Ask a question** (first in the row, offered whenever Resume is) wakes an ordinary agent on the stopped phase on the same page, so the Ask tab answers; it starts no loop and changes nothing, and **Resume the loop** is still there afterwards. **Resume the loop** carries on from the stopped
phase and **Fix it by hand** opens an ordinary Implement session on it.

**The report.** One report follows the whole build, across stops and Resume. For every phase it says what
was built and committed, the tests, the findings fixed, the findings it chose not to fix and why, the
findings left open, each assumption with its note, and any other decisions the agent reported, plus every
retry and stop, in order. The agent writes most of this, so it holds what the agent noticed; the task marks,
the quick check and the commits are the app's own. The finish screen counts each kind per phase, and **Read
the full report** opens it, saved as `specs/<feature>/LOOP-SUMMARY-<date>.md` (`-2` and so on for another
the same day). After a stop, **Read why, and the report so far** shows it on the stop screen. While a build
is unfinished it lives in `~/.plan2code/console/loop-reports.json`, not the project, because Resume needs a
clean tree. The in-app **Help** has a matching topic, **Implementation Loop**, which the loop card links to as "How the loop works".

## Keep it up to date

`plan2code update` brings the skills, the `plan2code` command and the app up together. If the app
and the installed skills ever differ in version, the app's top bar says so and offers **Update
skills**, which runs that same update when you press it. It never updates on its own.

To remove the app along with the skills and the command, run `plan2code uninstall`. It asks first,
then asks whether your own data in `~/.plan2code/` (notebooks, handoffs, settings) goes too.
`--yes` skips both questions and keeps that data; add `--purge` to delete it. Close the app first:
Windows cannot delete a running file.

## The first release is unsigned

The app is not code-signed yet, so your system may stop it the first time it starts. It is the same
file the installer verified against the release's checksum list.

**macOS.** If macOS says the app "cannot be opened because Apple cannot check it for malicious
software": open **System Settings**, then **Privacy & Security**, scroll to the message about
`plan2code-app`, and press **Open Anyway**. Start `plan2code` again and confirm.

**Windows.** If SmartScreen shows "Windows protected your PC": press **More info**, then **Run
anyway**.

**Linux.** Nothing to allow. If the file is not executable, run
`chmod +x ~/.plan2code/app/plan2code-app`.

## Permission checks are off by default, same as the terminal

The launch card's permission-mode tick is **on by default** (checks off), matching `plan2code` run the
plain way, where the same question defaults to prompts off: the agent starts with checks off (`--permission-mode bypassPermissions` in Claude Code,
`--permission-mode bypass` in Devin, `--dangerously-bypass-approvals-and-sandbox` in Codex), reading,
writing and running commands in your project folder without asking; the agent's amber **checks off** badge in
the top bar says so while that agent runs. Untick it before pressing Start agent to keep the agent's normal approval prompts instead.
New Session keeps the same choice. Work in a folder you are happy for the agent to change, and keep it under
version control.

## Remove it

Choose **Uninstall** in the installer menu: it removes the app with everything else Plan2Code
installed. To remove only the app, delete the `~/.plan2code/app/` folder.
