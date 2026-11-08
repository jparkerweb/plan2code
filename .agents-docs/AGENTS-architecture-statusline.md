# Architecture: status line
> Part of [AGENTS.md](../AGENTS.md) and the [Architecture index](./AGENTS-architecture.md): project guidance for AI coding agents.


Optional Claude Code status bar living in `src/statusline-claude/`. Three-line bar beside a Planny icon: two content lines with a dashed rule between, showing model (+ effort), project/worktree, branch, uncommitted diff stats, session duration + cost, context window usage, and plan/quota usage.

**Design constraints:**
- **Zero runtime dependencies** — `statusline.js` is self-contained (config loader, git helpers, formatters, render). Copied verbatim to `~/.claude/plan2code-statusline.js` on install; no bundler step.
- **Stdin-driven** — all data comes from Claude Code's stdin JSON (`model`, `workspace`, `context_window`, `rate_limits`, `cost`). No API calls, no auth, no background processes.
- **Silent failure** — outer `try/catch` around `main()` plus `process.exit(0)` on missing stdin guarantees the script never crashes the CLI. All git ops are timeout-bounded (1.5s) and non-git workspaces short-circuit via `isGitRepo()` (walks up to 10 parent dirs looking for `.git`).
- **Atomic settings writes** — installer writes `~/.claude/settings.json` via temp file + rename so a crash never leaves the file truncated.
- **Custom-config respect** — installer detects non-plan2code `statusLine` entries, prompts before replacing, and backs up to `statusline-previous.json`. Uninstall only removes `settings.statusLine` if it points to the plan2code bundle.

**Layout:**

```
src/statusline-claude/
├── statusline.js           # Self-contained: config, git, formatters, render
├── statusline-config.json  # Default config template
└── README.md               # User docs: install, config, debugging
```

**Adaptive plan-usage display:** the formatter auto-selects between `5h/7d` rate-limit percentages (Pro/Max/Teams — when `rate_limits` present in stdin) and `Nk in · Nk out` session-token counts (Bedrock/Vertex/PAYG — when `rate_limits` absent). Segment is hidden when neither shape is available.

**Installer integration** lives in `install.js` under the `STATUS LINE INSTALLATION` section (`installStatusLine`, `uninstallStatusLine`). Included in Advanced → `E` (Everything); also available individually via Advanced → `S`.
