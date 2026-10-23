# The Plan2Code desktop app

One window for working with an AI agent. The app opens the Plan2Code dashboard as its main surface,
runs your agent (Claude Code, Devin or Codex) in a terminal panel it owns, and has a **Restart**
button that replaces the agent with a fresh one on a brief the app builds from its own record of the
session. It is an addition: `/plan2code` typed inside an agent works exactly as before, with or
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

A **launch card** then asks which agent (Claude, Devin or Codex), model and effort (Claude and Codex
only) to start on. Permission checks off is its own tick, unchanged unless you choose it (Restart
keeps whatever you picked); a CLI the app cannot find is named, with how to install it, instead of
just being greyed out. The card is skipped when the launcher already passed an agent to start.

Once an agent is running, a slim top bar holds the project name, **Restart** and **Change project**,
and a status strip beneath it shows the page the agent opened (not only the dashboard — every console
page, including Ask, Workspace, Notebook, Help, Preferences and Git, opens inside the window), the
agent's name and status, a context meter once one is readable, and the permission mode in use. The
terminal panel has its own toolbar: dock it to the bottom or the right, collapse it to a thin strip,
or maximize it; its size is remembered. An "agent may need you" badge appears on a collapsed or small
panel once the agent has sat quiet for a while. **Change project** asks first if an agent is running,
then stops it and the console before opening the new folder.

## Keep it up to date

`plan2code update` brings the skills, the `plan2code` command and the app up together. If the app
and the installed skills ever differ in version, the app's top bar says so and offers **Update
skills**, which runs that same update when you press it. It never updates on its own.

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

## Permission checks are off, if you choose it

The launch card's permission-mode tick is off by default: leave it off and the agent keeps its normal
approval prompts. Turn it on and the agent starts with checks off instead
(`--permission-mode bypassPermissions` in Claude Code, `--permission-mode bypass` in Devin,
`--dangerously-bypass-approvals-and-sandbox` in Codex), reading, writing and running commands in your
project folder without asking; the status strip says so while that agent runs. Restart keeps the same
choice. Work in a folder you are happy for the agent to change, and keep it under version control,
before turning checks off.

## Remove it

Choose **Uninstall** in the installer menu: it removes the app with everything else Plan2Code
installed. To remove only the app, delete the `~/.plan2code/app/` folder.
