# Development Commands
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Common Commands

```bash
# Install dev dependencies (sets up husky pre-commit hooks)
npm install

# Run the interactive installer
node install.js

# Regenerate skills/ from src/ (non-interactive)
npm run build:skills

# Character-count validation + skills/ drift check
npm test

# Refresh the web console screenshots in docs/screenshots/ (needs a local Chrome or Edge).
# Rerun after any change a person would see on the console page, and open every image
# before committing: right screen, both themes, no username or home path in frame.
npm i --no-save puppeteer-core                         # once; never added to package.json
node scripts/capture-screenshots.mjs                   # every screen
node scripts/capture-screenshots.mjs --only dashboard  # one screen

# Plan2Code Loop
cd plan2code-loop && npm install   # First time setup
cd plan2code-loop && npm run build # Build the CLI

# Plan2Code Metrics
cd plan2code-metrics && npm install   # First time setup
cd plan2code-metrics && npm run build # Build the CLI
```

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

`install.js` takes no arguments for normal use, but exposes two build hooks. Any other argument exits 1 with usage.

| Flag | Action |
|------|--------|
| `--build-skills` | Regenerate `skills/` from `src/`, pruning stale skills and reference files |
| `--verify-skills` | Compare committed `skills/` with `src/`; exits 1 on drift and is run by `npm test` |

## How the Installer Works

1. **Builds `skills/` from `src/`** — one Agent Skill per source prompt, including uncommitted source edits.
2. **Checks the skills CLI is reachable** with `npx --yes skills --version`.
3. **Sweeps pre-2.2 install paths** and removes installed `plan2code-*` skills so renamed or retired prompts cannot survive as orphans.
4. **Delegates installation** to `npx --yes skills add "<repo>/skills" -g -s <skill names> -y`.

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
| Reference files | `skills/<skill-name>/references/<file>.md` |

`disable-model-invocation: true` is unconditional because these workflows are user-initiated. Agents that do not recognize the field ignore it.

## Editing Workflow Prompts

`src/` is the source of truth; `skills/` is a committed build artifact.

1. Edit the source file under `src/`.
2. Run `npm run build:skills`.
3. Test the workflow in an AI tool.
4. Commit regenerated `skills/` beside the source change; `npm test` fails on drift.
5. Never edit `skills/` by hand because the next build overwrites it.

## Adding a New Workflow Prompt / Skill

1. Create `src/plan2code-<name>.md` with body content only and keep it under 11,500 characters.
2. Register it in `SOURCE_PROMPTS` in `install.js`; add a matching `generateStepLabel()` case when needed.
3. Update command inventories in `README.md`, `QUICK-REFERENCE.md`, `.agents-docs/AGENTS-architecture.md`, and `CHANGELOG.md`. Update `docs/index.html` only for core pipeline steps.
4. Run `npm run build:skills` and `npm test`.
