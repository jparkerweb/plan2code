# Development Commands
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Common Commands

```bash
# Install dev dependencies (sets up husky pre-commit hooks only; each sub-package
# below needs its own npm install. Running `npm test` needs Node 20+; users of
# the installed skills still need only Node 18+)
npm install

# Run the interactive installer
node install.js

# Regenerate skills/ from src/ (non-interactive)
npm run build:skills

# Full check (about 70s): char limits, skills/ build, browser-module parse check,
# dashboard skill-table check, web console + launcher + getting-started node:test suites
npm test

# One web console or launcher test
node --test --test-name-pattern "<regex>" scripts/test-web-console-<area>.mjs

# Web console start-up benchmark (the paint columns use a local Chrome or Edge through
# playwright-core, which `npm install` already provides)
node scripts/bench-web-console.mjs [--runs 7] [--workflow dashboard]

# Refresh the web console screenshots in docs/screenshots/ (needs a local Chrome or Edge).
# Rerun after any change a person would see on the console page, and open every image
# before committing: right screen, both themes, no username or home path in frame.
# PLAN2CODE_TEST_BROWSER=chrome|msedge forces which browser the page tests and these scripts use
node scripts/capture-screenshots.mjs                   # every screen
node scripts/capture-screenshots.mjs --only dashboard  # one screen (dashboard-utilities scrolls to the utility cards)

# Compare every element's computed style on every screen before and after a stylesheet change
# (dev-only, not in npm test): take a baseline first, then compare after each move
node scripts/css-snapshot.mjs --out before.json
node scripts/css-snapshot.mjs --compare before.json

# Plan2Code Loop
cd plan2code-loop && npm install   # First time setup
cd plan2code-loop && npm run build # Build the CLI

# Plan2Code Metrics
cd plan2code-metrics && npm install   # First time setup
cd plan2code-metrics && npm run build # Build the CLI
cd plan2code-metrics && npm test      # vitest (aggregator, community, improver)

# Plan2Code Bot (end-to-end workflow runner, Claude Agent SDK)
cd plan2code-bot && npm install && npm run build
cd plan2code-bot && npm test          # vitest
```

The root `npm test` does not run the metrics or bot vitest suites; run them in their package. `npm run dev` in loop, metrics and bot is `tsup --watch`. The web console and launcher suites isolate themselves with `PLAN2CODE_CONSOLE_HOME`, `PLAN2CODE_MODELS_DIR` and `PLAN2CODE_NO_BROWSER=1` (`scripts/web-console-test-helpers.mjs`), so they never open a browser or touch your real console home. The web console suites are split by area so `node --test` runs them in parallel.

## Test/Dev Env Vars

| Variable | Effect |
|----------|--------|
| `PLAN2CODE_CONSOLE_HOME` | Replaces `~/.plan2code/console`: sessions, `looks.json` and the runtime handle dir all move under it (`src/web-console/files.mjs`). Always set it for scratch runs so `stop --all` cannot reach real sessions. |
| `PLAN2CODE_NO_BROWSER` | `open` does not launch a browser (`NO_BROWSER` also works). |
| `PLAN2CODE_BROWSER` | Browser command line to run with the link appended, instead of the system default. |
| `PLAN2CODE_MODELS_DIR` | Moves the launcher model menus (`bin/models.json`, `models.json`) away from `~/.plan2code`, for tests. |
| `PLAN2CODE_PICKER_ECHO` | Tests only: `/workspace/browse` returns this as the picked folder instead of opening a picker (`-` means canceled). |
| `PLAN2CODE_CONSOLE_TRACE` | Set to `1` on `open` to print a start-up step timeline to stderr. |

## Installer Menu Options

**Main menu:**

| Option | Action |
|--------|--------|
| `I` | Install the Plan2Code skills globally via the `skills` CLI, plus the global `plan2code` command (opens the dashboard in Claude Code, Devin or Codex), then print the getting-started steps. No dev tools |
| `U` | Uninstall Plan2Code: skills + `plan2code` command + `plan2code-loop` + `plan2code-metrics` + `plan2code-bot` + Claude Code status line (confirmation required) |
| `A` | Open the ADVANCED sub-menu |
| `Q` | Quit |

**ADVANCED sub-menu (`A`):**

| Option | Action |
|--------|--------|
| `L` | Install the skills into the current project instead of globally |
| `O` | Install plan2code-loop CLI only |
| `M` | Install plan2code-metrics CLI only |
| `S` | Install Claude Code status line only |
| `B` | Install plan2code-bot CLI only |
| `D` | Install the global `plan2code` command only |
| `E` | Everything: the skills, the `plan2code` command and every dev tool (`plan2code-loop`, `plan2code-bot`, `plan2code-metrics`, the Claude Code status line) |
| `Q` | Return to main menu |

## Non-Interactive Flags

`install.js` takes no arguments for normal use, but exposes two build hooks and the non-interactive update. Any argument other than these three (when none is present) exits 1 with usage; extra arguments beside `--build-skills` or `--verify-skills` are ignored, while `--update` must be the only argument.

| Flag | Action |
|------|--------|
| `--build-skills` | Regenerate `skills/` from `src/`, pruning stale skills and reference files |
| `--verify-skills` | Diff local `skills/` against `src/`; exits 1 on drift. Diagnostic only, the installer rebuilds anyway |
| `--update` | No menu: reinstall what `~/.plan2code/install.json` lists (skills, launcher, statusline, loop, metrics, bot), never uninstalling; with no record, the skills and the `plan2code` command. `plan2code update` runs it through npx |

## How the Installer Works

1. **Builds `skills/` from `src/`** — one Agent Skill per source prompt, including uncommitted source edits.
2. **Checks the skills CLI is reachable** with `npx --yes skills --version`.
3. **Sweeps pre-2.2 install paths** and removes installed `plan2code-*` skills so renamed or retired prompts cannot survive as orphans.
4. **Delegates installation** to `npx --yes skills add "<repo>/skills" -g -s <skill names> -y`.
5. **Installs the global `plan2code` command** (only when step 4 succeeded). Advanced → `L` runs the same flow without `-g` and without the launcher.

The skills CLI owns distribution from step 4 onward. It stores canonical skills under `~/.agents/skills/` and links them into agents that maintain their own skill directory. Plan2Code no longer maintains platform-specific output formats.

**Invocation choices:**

| Choice | Reason |
|--------|--------|
| Explicit space-separated `-s <names>` | Avoids shell expansion and prevents unrelated directories under `skills/` from being installed. |
| No `-a` / `--agent '*'` | Uses the CLI's supported default agent set instead of requesting incompatible scope/agent combinations. |
| Captured output | Suppresses the CLI's duplicated banners while preserving real failures; unsupported-scope noise is filtered. |

## Skill Format

| Item | Value |
|------|-------|
| Path | `skills/<skill-name>/SKILL.md` |
| Skill name | `generateSkillName(prompt)`, such as `plan2code-1-plan` or `plan2code-init` |
| Frontmatter | `name`, `description`, `disable-model-invocation: true` |
| Reference files | `skills/<skill-name>/references/<path>`, copied from `src/<prompt>-references/` and `additionalReferences` (any file type; every skill bundles `web-console/` plus a copy of `version.json`) |
| Scripts | `skills/<skill-name>/scripts/<file>.mjs`, plus `common.mjs` and a generated `version.json` (see Skill Scripts in the architecture doc) |

`disable-model-invocation: true` is unconditional because these workflows are user-initiated. Agents that do not recognize the field ignore it.

## Editing Workflow Prompts

See the `skills/` build-artifact gotcha in [Code Style & Gotchas](./AGENTS-code-style.md).

1. Edit the source file under `src/`.
2. Run `npm run build:skills`.
3. Test the workflow in an AI tool.
4. `skills/` is gitignored, so only the `src/` change is committed.
5. Never edit `skills/` by hand because the next build overwrites it.

## Adding a New Workflow Prompt / Skill

1. Create `src/plan2code-<name>.md` with body content only and keep it under 20,000 characters.
2. Register it in `SOURCE_PROMPTS` in `install.js` (with the web-console `additionalReferences` entry every skill carries); add a `generateStepLabel()` case when needed. List any shared scripts it runs in `scripts: [...]`, and put its own scripts in `src/plan2code-<name>-scripts/` (with a `scripts/test-script-<name>.mjs` added to `package.json`'s `test` list).
3. Register it with the web console. The meter's points and labels, the resume command, Help's card list and `console.mjs help`'s workflow list are all derived from `skills.js`, so the edits are `skills.js`, `install.js` (step 2), the skill's prompt (step 1), its pose and its notes; `npm test` names anything else left out:
   - `src/web-console/public/skills.js`: one entry (workflow, label, start pose, flags, subagents line, the meter's `weight`, `started` and `ran`, and `resume`) with its card (plus `help` when Help's line should differ from the blurb), and the card's `states` and `grayed`. Utilities go in group `"extra"` before Changelog.
   - `src/web-console/public/index.html`: its start pose, an `<svg class="pose pose-<workflow>" data-pose="<workflow>">` in `<template id="start-poses">` (pose CSS in `public/styles/poses.css`), unless its `pose` borrows an existing one (as Implement + Review borrows Implement's).
   - Its help topic: a `src/web-console/notes/<workflow>.md` (named in the skill's Interface line) or a `HELP_TOPICS` alias in `src/web-console/cmd-help.mjs`.
   - `src/plan2code.md`: the skill/workflow table and "What each skill reads and writes" (`scripts/check-skill-table.mjs`: every backticked token must appear in the skill's prompt).
   - `console.md` (the `open --workflow` list and the `notes/<workflow>.md` row).
   - Optional: `STARTER_SET_FOR` in `public/starters.js` (unlisted gets "general").

   **Adding a spec state** is shorter: one entry in `src/web-console/public/spec-states.js`, the detection in `classifySpec()` in `src/web-console/scan.mjs`, the `states` of each card in `skills.js` that takes it, and a line in the dashboard skill (`src/plan2code.md`); then `npm test`.
4. Update command inventories in `README.md` (dashboard-card and command tables), `QUICK-REFERENCE.md`, `.agents-docs/AGENTS-architecture.md` (prompt table, own-script rows, notes list), and `CHANGELOG.md`. Update `docs/index.html` for core pipeline steps, and for a utility only when it is a headline change (its `.utils` block).
5. Run `npm run build:skills` and `npm test`.
