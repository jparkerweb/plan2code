# Development Commands
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Common Commands

```bash
# Install dev dependencies (sets up husky pre-commit hooks)
npm install

# Run the interactive installer (always interactive — any CLI args are silently ignored)
node install.js

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
| `I` | Install Plan2Code workflow prompts for all platforms, plus `plan2code-loop` CLI |
| `A` | Everything in `I` plus `plan2code-bot`, `plan2code-metrics` (dev tools), and Claude Code status line |
| `U` | Uninstall Plan2Code files: prompts + `plan2code-loop` + `plan2code-metrics` + `plan2code-bot` + Claude Code status line (confirmation required) |
| `C` | Open CUSTOM sub-menu |
| `Q` | Quit |

**CUSTOM sub-menu (`C`):**

| Option | Action |
|--------|--------|
| `L` | Show local (per-project) install instructions |
| `O` | Install plan2code-loop CLI only |
| `M` | Install plan2code-metrics CLI only |
| `S` | Install Claude Code status line only |
| `B` | Install plan2code-bot CLI only |
| `Q` | Return to main menu |

## How the Installer Works

1. **Reads source prompts** from `src/plan2code-*.md`
2. **Generates platform-specific files** with appropriate headers (YAML frontmatter for some platforms)
3. **Writes to `dist/`** subdirectories organized by destination type
4. **Copies to target directories** (global: `~/.claude/commands/`, etc.)

## Platform-Specific File Formats

| Platform | Extension / File | Local Dir | Global Dir | Header |
|----------|-----------------|-----------|------------|--------|
| Claude Code | `.md` | — | — | None |
| Cursor | `.md` | — | — | None |
| Copilot CLI | `.md` | — | — | YAML frontmatter |
| Continue | `.prompt.md` | — | — | YAML frontmatter |
| Windsurf | `.md` | — | — | YAML frontmatter |
| VS Code Copilot | `.prompt.md` | — | — | YAML frontmatter |
| Codeium | `.md` | — | — | YAML frontmatter |
| Claude Code (Skills) | `SKILL.md` in subdir | `.claude/skills/<skill-name>/` | `~/.claude/skills/<skill-name>/` | YAML frontmatter + `disable-model-invocation: true` |
| Agent Skills (Amp · Devin · Gemini CLI · OpenCode · Zed) | `SKILL.md` in subdir | `.agents/skills/<skill-name>/` | `~/.agents/skills/<skill-name>/` | YAML frontmatter (no disable flag) |
| Crush | `SKILL.md` in subdir | — (global only) | `~/.config/crush/skills/<skill-name>/` (Unix) / `%LOCALAPPDATA%\crush\skills\<skill-name>\` (Windows) | YAML frontmatter |
| Gemini CLI (TOML) | `.toml` | `.gemini/commands/` | `~/.gemini/commands/` | None (TOML fields: `description`, `prompt`) |
| Pi (pi.dev) | `.md` | `.pi/prompts/` | `~/.pi/agent/prompts/` | YAML frontmatter (`description`) |

## Editing Workflow Prompts

When modifying workflow prompts in `src/`:

1. Edit the source file in `src/`
2. Run `node install.js` to regenerate distribution files
3. Test the workflow in your AI tool of choice
4. The `dist/` folder is regenerated automatically — don't edit files there directly

## Adding a New Workflow Prompt / Skill

Adding a new prompt to `src/` is more than dropping in a file — the installer is
driven by an explicit registry and several docs enumerate the command set. When
you add a `src/plan2code-<name>.md`, do **all** of the following so nothing drifts:

1. **Create the source file** `src/plan2code-<name>.md` — body content **only**,
   no YAML frontmatter (the installer generates frontmatter per platform). Keep
   it **under 11,000 characters** (`npm test` enforces this).
2. **Register it in the installer.** Add an entry to the `SOURCE_PROMPTS` array in
   `install.js` (`source`, `stepNumber`, `name`, `displayName`, `description`, and
   `isUtility: true` for non-numbered utilities). If `stepNumber` is a non-numeric
   label (e.g. `'handoff'`), add a matching case to `generateStepLabel()` so the
   generated description reads correctly.
3. **Update every doc that lists the command set** — keep these in sync, they are
   the canonical inventories:
   - `README.md` — command table ("When to Use")
   - `QUICK-REFERENCE.md` — Commands table
   - `.agents-docs/AGENTS-architecture.md` — "Workflow Prompts (in `src/`)" table
   - `CHANGELOG.md` — add an entry under the current version
   - `docs/index.html` — **only** if the new prompt belongs to the core pipeline
     shown there; utilities (like `init`, `quick-task`, `handoff`) are deliberately
     omitted from that curated marketing list.
4. **Regenerate and validate:** run `node install.js` (regenerates `dist/`) and
   `npm test` (character-count validator now covers the new file).
