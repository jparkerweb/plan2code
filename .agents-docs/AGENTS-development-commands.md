# Development Commands
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Common Commands

```bash
# Install dev dependencies (sets up husky pre-commit hooks only; each sub-package
# below needs its own npm install, Node 18+)
npm install

# Run the interactive installer
node install.js

# Regenerate skills/ from src/ (non-interactive)
npm run build:skills

# Full check (about 70s): char limits, skills/ build, browser-module parse check,
# dashboard skill-table check, web console + launcher node:test suites
npm test

# One web console or launcher test
node --test --test-name-pattern "<regex>" scripts/test-web-console.mjs

# Web console start-up benchmark (puppeteer-core optional)
node scripts/bench-web-console.mjs [--runs 7] [--workflow dashboard]

# Refresh the web console screenshots in docs/screenshots/ (needs a local Chrome or Edge).
# Rerun after any change a person would see on the console page, and open every image
# before committing: right screen, both themes, no username or home path in frame.
npm i --no-save puppeteer-core                         # once; never added to package.json
node scripts/capture-screenshots.mjs                   # every screen
node scripts/capture-screenshots.mjs --only dashboard  # one screen (dashboard-utilities scrolls to the utility cards)

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

The root `npm test` does not run the metrics or bot vitest suites; run them in their package. `npm run dev` in loop, metrics and bot is `tsup --watch`. The web console and launcher suites isolate themselves with `PLAN2CODE_CONSOLE_HOME`, `PLAN2CODE_MODELS_DIR` and `PLAN2CODE_NO_BROWSER=1` (`scripts/test-web-console.mjs:191`), so they never open a browser or touch your real console home. Almost all of the ~70s is the web console suite.

## Test/Dev Env Vars

| Variable | Effect |
|----------|--------|
| `PLAN2CODE_CONSOLE_HOME` | Replaces `~/.plan2code/console`: sessions, `looks.json` and the runtime handle dir all move under it (`src/web-console/lib.mjs`). Always set it for scratch runs so `stop --all` cannot reach real sessions. |
| `PLAN2CODE_NO_BROWSER` | `open` does not launch a browser (`NO_BROWSER` also works). |
| `PLAN2CODE_BROWSER` | Browser command line to run with the link appended, instead of the system default. |
| `PLAN2CODE_MODELS_DIR` | Moves the launcher model menus (`bin/models.json`, `models.json`) away from `~/.plan2code`, for tests. |
| `PLAN2CODE_PICKER_ECHO` | Tests only: `/workspace/browse` returns this as the picked folder instead of opening a picker (`-` means cancelled). |
| `PLAN2CODE_CONSOLE_TRACE` | Set to `1` on `open` to print a start-up step timeline to stderr. |

## Installer Menu Options

**Main menu:**

| Option | Action |
|--------|--------|
| `I` | Install the Plan2Code skills globally via the `skills` CLI, plus the global `plan2code` command (opens the dashboard in Claude Code or Devin) — no dev tools |
| `A` | Everything in `I` plus every dev tool: `plan2code-loop`, `plan2code-bot`, `plan2code-metrics`, and the Claude Code status line |
| `U` | Uninstall Plan2Code: skills + `plan2code` command + `plan2code-loop` + `plan2code-metrics` + `plan2code-bot` + Claude Code status line (confirmation required) |
| `C` | Open CUSTOM sub-menu |
| `Q` | Quit |

**CUSTOM sub-menu (`C`):**

| Option | Action |
|--------|--------|
| `L` | Install the skills into the current project instead of globally |
| `O` | Install plan2code-loop CLI only |
| `M` | Install plan2code-metrics CLI only |
| `S` | Install Claude Code status line only |
| `B` | Install plan2code-bot CLI only |
| `D` | Install the global `plan2code` command only |
| `Q` | Return to main menu |

## Non-Interactive Flags

`install.js` takes no arguments for normal use, but exposes two build hooks. Any argument other than these two (when neither is present) exits 1 with usage; extra arguments beside either flag are ignored.

| Flag | Action |
|------|--------|
| `--build-skills` | Regenerate `skills/` from `src/`, pruning stale skills and reference files |
| `--verify-skills` | Diff local `skills/` against `src/`; exits 1 on drift. Diagnostic only, the installer rebuilds anyway |

## How the Installer Works

1. **Builds `skills/` from `src/`** — one Agent Skill per source prompt, including uncommitted source edits.
2. **Checks the skills CLI is reachable** with `npx --yes skills --version`.
3. **Sweeps pre-2.2 install paths** and removes installed `plan2code-*` skills so renamed or retired prompts cannot survive as orphans.
4. **Delegates installation** to `npx --yes skills add "<repo>/skills" -g -s <skill names> -y`.
5. **Installs the global `plan2code` command** (only when step 4 succeeded). Custom → `L` runs the same flow without `-g` and without the launcher.

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
2. Register it in `SOURCE_PROMPTS` in `install.js` (with the web-console `additionalReferences` entry every skill carries); add a `generateStepLabel()` case when needed. List any shared scripts it runs in `scripts: [...]`, and put its own scripts in `src/plan2code-<name>-scripts/`. Add it to the skill/workflow table and the "What each skill reads and writes" table in `src/plan2code.md` (the latter is checked by `scripts/check-skill-table.mjs`), and to the workflow lists in `src/web-console/public/answers.js`, `public/meter.js` and the `console.mjs` usage text.
3. Update command inventories in `README.md`, `QUICK-REFERENCE.md`, `.agents-docs/AGENTS-architecture.md`, and `CHANGELOG.md`. Update `docs/index.html` only for core pipeline steps.
4. Run `npm run build:skills` and `npm test`.
