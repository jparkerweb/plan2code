# Release checklist

Run this before every release of the desktop app, on each system the release builds for: Windows
x64, macOS Apple silicon and Linux x64. Automated tests cover the logic and never start a real
window, a real terminal panel, or a real Claude, Devin or Codex, so everything here is by hand.

Work from the pre-release build: publish a GitHub pre-release so `release-app.yml` attaches the files,
then install from it. Tick each box per system and note anything that is a rough edge rather than a
failure.

## Before you start

- [ ] `node scripts/check-versions.mjs --tag v<version>` passes (version.json, package.json,
      CHANGELOG.md and the app's tauri.conf.json, package.json and Cargo.toml all agree)
- [ ] `npm test` passes at the repo root, with the app absent
- [ ] `cargo test --workspace` passes in `plan2code-app/`, and the `app` workflow is green on all
      three systems
- [ ] The pre-release has one `plan2code-app-<version>-<os>-<arch>` file per system and a
      `plan2code-app-<version>-SHA256SUMS.txt`

## Install and launch (each system)

- [ ] Run the installer from the pre-release: it offers the app, downloads it, verifies the checksum
      and places it in `~/.plan2code/app/`
- [ ] A deliberately corrupted download is rejected with the checksum message, and the skills and
      the `plan2code` command are still installed
- [ ] `plan2code` in a project asks for the agent and model, then opens the app on that folder
- [ ] The agent and model picked in the launcher are the ones the app starts at once, with no
      launch card or checklist shown first, and New Session keeps them
- [ ] `plan2code --classic` runs the agent in the terminal with the app installed
- [ ] Linux only: with `DISPLAY` and `WAYLAND_DISPLAY` unset, `plan2code` runs the terminal flow
- [ ] The desktop shortcut opens the folder picker and then the app
- [ ] macOS: the first start is stopped by Gatekeeper, **Open Anyway** in System Settings (Privacy &
      Security) lets it through, and `docs/desktop-app.md` describes what you saw
- [ ] macOS and Linux: start the app from the Dock, Finder or a `.desktop` file (not a terminal) on
      a machine where Node is only on PATH through nvm, Homebrew or Volta: the first-run checklist
      still finds Node and the installed CLIs, and the console and an agent still start
- [ ] Windows: SmartScreen's **More info**, then **Run anyway**, lets it through, and
      `docs/desktop-app.md` describes what you saw
- [ ] `plan2code update` updates the skills, the command and the app, including while the app is
      running (Windows replaces the file by renaming the old one aside)

## The window (each system)

- [ ] The dashboard shows in the frame and the terminal panel is visible beneath it
- [ ] Resizing the window keeps both usable; dragging the handle resizes the panel
- [ ] The bar shows the project folder; the permission note appears only while an agent started
      with checks off is running, never otherwise
- [ ] The OS window title (and so the taskbar entry) reads **Plan2Code - &lt;folder name&gt;**,
      not just **Plan2Code**; open a second window on a different folder and confirm they read
      apart in the taskbar without needing to restore either one
- [ ] The first run (no `firstRunDone` saved yet) shows the checklist (Node, an agent CLI, the
      project folder, the skills version) before the launch card; a later launch goes straight to
      the launch card
- [ ] The launch card offers agent, model, effort (Claude and Codex only) and permission mode
      (checks off is ticked by default, matching the plain `plan2code` launcher; untick it for
      an agent that keeps its normal approval prompts); a CLI it could not find is named, not
      just disabled
- [ ] **Dock the terminal to the right**: the splitter becomes vertical, the toolbar stacks, and the
      dashboard keeps the rest of the width; dock it back to the bottom
- [ ] **Collapse** the terminal to a thin strip (either dock) and **Expand** it back; its size from
      before collapsing is remembered
- [ ] Docked right, collapsed: the **Expand** label reads top-to-bottom and fits inside the strip,
      not sideways text running off the edge
- [ ] Collapse the terminal (or shrink it small), let the agent go quiet for a while mid-answer: the
      "agent may need you" badge appears on the strip; expanding it clears the badge
- [ ] The top bar's project and agent menus open under their name, close on a click elsewhere (the
      console frame and the terminal included) or Escape, and are not cut off by the bar
- [ ] **Change project** in the top bar's project menu, with an agent running: it asks first, then the folder
      picker opens; cancelling the picker leaves the running agent and its project untouched
- [ ] Change project, pick a different folder: the old agent and console stop, the new folder opens
      on the launch card (or the checklist, if its own first run has not passed yet)
- [ ] Reload the window (or navigate away and back) while an agent is running: the terminal redraws
      from where it was, not blank, and the dashboard reconnects to the same session
- [ ] When the app and the installed skills differ in version, the bar's right end offers **Update
      skills**, and nothing updates until it is pressed; with the console stopped as well, Reconnect
      the console shows first and "+1 more" names the update

## The terminal panel, with each real agent (each system)

Do each of Claude Code, Devin and Codex for a few minutes:

- [ ] Startup screen draws correctly
- [ ] Typing a prompt and getting an answer
- [ ] A long streamed answer scrolls and stays readable
- [ ] Resizing the window reflows the agent's screen
- [ ] Pasting several lines
- [ ] A line with Unicode and emoji
- [ ] Select text in the terminal: it copies on its own; Ctrl+Shift+C (Windows, Linux) or Cmd+C
      (macOS) copies the selection too; Ctrl+V / Cmd+V pastes
- [ ] Exiting the agent: the agent menu reads "ended" with the reason beside it, and New Session stays
      just left of it

## Agent lifecycle

- [ ] Start, then **New Session**: it confirms once, with Planny on a coffee break and no claim about unsaved
      work, then a fresh agent starts on the same agent, model, effort and permission mode, and the
      dashboard shows the pick-up chip with a brief that matches the session
- [ ] An agent that ends by itself leaves the app asking nothing until New Session or **Change agent**
      (in the agent menu) is pressed; Change agent reopens the launch card with a real choice to make again
- [ ] Closing the window while an agent runs asks first, and "no" keeps the window open
- [ ] Cmd+Q on macOS asks the same
- [ ] Windows only: start a CLI installed through npm (a `.cmd` shim), then New Session; check Task
      Manager and confirm no leftover `node.exe` (or the CLI's own process) is left running

## Standalone path

- [ ] `/plan2code` typed inside an agent with the app closed opens the dashboard exactly as before
- [ ] `npm test` still passes with the app installed on this machine
