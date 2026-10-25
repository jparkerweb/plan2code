# plan2code-app

The Plan2Code desktop app (v3.0): one window with the dashboard, a terminal panel for the agent, and a **New Session** button. Built with Tauri 2 (Rust and a web view).

The app is optional. The Node web console and the skills never depend on it, so running `/plan2code` inside an agent with no app works exactly as before.

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
