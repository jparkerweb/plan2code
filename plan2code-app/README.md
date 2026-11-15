# plan2code-app

The Plan2Code desktop app (v3.0): one window with the dashboard, a terminal panel for the agent, and a **New Session** button. Built with Tauri 2 (Rust and a web view).

The app is optional. The Node web console and the skills never depend on it, so running `/plan2code` inside an agent with no app works exactly as before.

## Agents and the taskbar

**Agent picker.** The launch card lists Claude Code, Devin and Codex, then any custom agents from `~/.plan2code/agents.json` (added in the console's User Preferences → Agents & models, the same list the `plan2code` command uses). The app starts on an agent that is installed (your last pick when it still is), never assumes Claude Code, and a custom agent has no effort row; New Session reuses whichever agent you started. The Model dropdown offers the same list the `plan2code` launcher's model question does (the shipped `models.json` plus anything you added in User Preferences), a custom agent its own `models`, and it hides for an agent with none; `/plan2code` only does something in an agent that loads the installed Plan2Code skills.

**Project picker.** The app takes its folder from `--project` (what the `plan2code` command and the desktop shortcut pass) and never reopens the last one by itself. Started with no folder, and from **Change project**, it shows one picker: **Choose a folder** (focused, the default; it opens the system folder dialog) with the recent folders under it, newest first, leaving out the folder already open. The list is `recentFolders` in `~/.plan2code/launcher.json`, shared with the `plan2code` command, which keeps it by the same rule: `recent_folders` and `open_recent_folder` in `src-tauri/src/main.rs` over `project.rs`, held to `scripts/fixtures/recent-folders-cases.json` (the launcher's JS runs the same cases). A recent folder that has gone away is left out of the list (one that vanishes between the listing and the click shows an error on the picker), and Change project is refused while an Implementation Loop runs.

**No agent installed.** The first-run checklist and the launch card show what an agent CLI is, each built-in's install command and an **Install page** link, and a note that other agents are added under Agents. Install one, press **Check again** (the app looks at `PATH` and `agents.json` again), and Start works without restarting the app.

**Taskbar signal.** The console page tells the app when it is busy, your move, or needs attention (the same states as its tab icon), and the app shows it:

| System | Your move | Needs attention |
|---|---|---|
| Windows | green dot on the taskbar button, and one short burst of flashes when the window is not focused (the button then stays lit until focused) | red dot, and the same burst when not focused |
| macOS | no badge (the system badge cannot be green), one bounce when not focused | red `!` dock badge, and one bounce when not focused |
| Linux | the urgency hint when not focused | a count badge of 1 where the desktop supports it, and the urgency hint |

There is no dot while busy or once a finished step has nothing left to press; a finished screen that still offers a button (back to the dashboard, a review) keeps the green dot. The dot clears when the agent ends, the page reloads or the page stops answering, and a lit taskbar button goes back to normal when the window gets focus. **User Preferences → System → Desktop app** (shown only inside the app) has the switch **Show on the taskbar when Plan2Code needs me**, on by default; off clears the dot and stops flashes. It is saved as `taskbarSignal` in the app's own `~/.plan2code/app.json`.

## Layout

| Path | What it is |
|---|---|
| `src-tauri/` | The Rust app |
| `ui/` | The app page (plain HTML, CSS and JavaScript, no framework) |
| `fake-agent/` | A stand-in agent program the tests run in a real pseudo-terminal |
| `package.json` | The app's own npm packages (xterm, the Tauri CLI). Separate from the repo root so the root and the console stay dependency-free |

## Build and run

Needs the Rust toolchain pinned in `rust-toolchain.toml`, Node 18+, and the Tauri 2 system packages for your system (WebView2 on Windows, WebKitGTK on Linux).

```
cd plan2code-app
npm install
npm run dev        # run the app
npm run build      # build the installable bundle
```

## Tests

```
cd plan2code-app
node scripts/vendor.mjs    # once: the xterm files cargo builds against
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
```

The `app` workflow runs all three on Ubuntu for every pull request and push to main (and on Windows and macOS too for a manual run or a pull request labeled `full-matrix`), and fails on any rustfmt difference or clippy warning, so run them before pushing, not only `cargo test`. Clippy on one system does not see code for another: an import used only inside a `#[cfg(windows)]` test is clean on Windows and an unused-import error on macOS and Linux, so put such imports inside the `cfg`'d item.

Real Claude, Devin and Codex are never started by a test. The real window and terminal panel are checked by hand before each release.
