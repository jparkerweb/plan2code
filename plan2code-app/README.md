# plan2code-app

The Plan2Code desktop app (v3.0): one window with the dashboard, a terminal panel for the agent, and a **New Session** button. Built with Tauri 2 (Rust and a web view).

The app is optional. The Node web console and the skills never depend on it, so running `/plan2code` inside an agent with no app works exactly as before.

## Agents and the taskbar

**Agent picker.** The launch card lists Claude Code, Devin and Codex, then any custom agents from `~/.plan2code/agents.json` (added in the console's User Preferences → Agents, the same list the `plan2code` command uses). The app starts on an agent that is installed (your last pick when it still is), never assumes Claude Code, and a custom agent has no effort row; New Session reuses whichever agent you started. Custom agents offer their own models, and `/plan2code` only does something in an agent that loads the installed Plan2Code skills.

**No agent installed.** The first-run checklist and the launch card show what an agent CLI is, each built-in's install command and an **Install page** link, and a note that other agents are added under Agents. Install one, press **Check again** (the app looks at `PATH` and `agents.json` again), and Start works without restarting the app.

**Taskbar signal.** The console page tells the app when it is busy, your move, or needs attention (the same states as its tab icon), and the app shows it:

| System | Your move | Needs attention |
|---|---|---|
| Windows | green dot on the taskbar button, and one short burst of flashes when the window is not focused (the button then stays lit until focused) | red dot, and the same burst when not focused |
| macOS | no badge (the system badge cannot be green), one bounce when not focused | red `!` dock badge, and one bounce when not focused |
| Linux | the urgency hint when not focused | a count badge of 1 where the desktop supports it, and the urgency hint |

There is no dot while busy or finished. The dot clears when the agent ends, the page reloads or the page stops answering, and a lit taskbar button goes back to normal when the window gets focus. **User Preferences → Desktop app** (shown only inside the app) has the switch **Show on the taskbar when Plan2Code needs me**, on by default; off clears the dot and stops flashes. It is saved as `taskbarSignal` in the app's own `~/.plan2code/app.json`.

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
cargo test --workspace
```

Real Claude, Devin and Codex are never started by a test. The real window and terminal panel are checked by hand before each release.
