# Claude Code Status Line

A persistent three-line status bar for Claude Code: model, project, git branch, uncommitted diff
stats, session duration and cost, context-window usage, and plan quota.

It reads everything from the JSON Claude Code already sends on stdin — **no API calls, no auth, no
background processes.** Optional, and unrelated to the workflow itself.

← [Back to README](../README.md)

---

## What it looks like

On Pro / Max / Teams accounts, where rate limits are available:

```
◦ ◦  Opus 5 / high │ plan2code │ feature/pathfinder-github-iss │ +12 -3
╭●╮  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
├■┤  3h 5m ($4.62) │ ▰▰▰▰▰▱▱▱▱▱▱▱ 42% (84K) │ 5h: 28% · 7d: 61%
```

On Enterprise / Bedrock / Vertex / pay-as-you-go, where they aren't, the last segment becomes session
token counts instead:

```
◦ ◦  Sonnet 5 │ plan2code │ main │ +12 -3
╭●╮  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
├■┤  2m ($0.18) │ ▰▰▱▱▱▱▱▱▱▱▱▱ 18% │ 88k in · 3k out
```

The icons down the left are Planny, the project mascot.

---

## Install

```bash
node install.js     # A  (everything + dev tools)  — or  C → S  (status line only)
```

That copies the script to `~/.claude/plan2code-statusline.js`, writes a default config to
`~/.claude/statusline-config.json` (an existing config is preserved), and registers it in
`~/.claude/settings.json`.

If you already have a custom `statusLine` entry, the installer asks before replacing it and backs the
old one up. Uninstalling removes the script and the settings entry but leaves your config file alone.

---

## Full documentation

Config options, compact mode, thresholds, and troubleshooting:
[`src/statusline-claude/README.md`](../src/statusline-claude/README.md)
