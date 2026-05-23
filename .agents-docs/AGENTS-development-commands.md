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
| `I` | Install Plan2Code for all platforms + loop CLI |
| `U` | Uninstall Plan2Code files + loop CLI (confirmation required) |
| `C` | Open CUSTOM sub-menu |
| `Q` | Quit |

**CUSTOM sub-menu (`C`):**

| Option | Action |
|--------|--------|
| `L` | Show local (per-project) install instructions |
| `O` | Install plan2code-loop CLI only |
| `M` | Install plan2code-metrics CLI only |
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
| Agent Skills (Amp · Devin · Gemini CLI · OpenCode) | `SKILL.md` in subdir | `.agents/skills/<skill-name>/` | `~/.agents/skills/<skill-name>/` | YAML frontmatter (no disable flag) |
| Crush | `SKILL.md` in subdir | — (global only) | `~/.config/crush/skills/<skill-name>/` (Unix) / `%LOCALAPPDATA%\crush\skills\<skill-name>\` (Windows) | YAML frontmatter |
| Gemini CLI (TOML) | `.toml` | `.gemini/commands/` | `~/.gemini/commands/` | None (TOML fields: `description`, `prompt`) |
| Pi (pi.dev) | `.md` | `.pi/prompts/` | `~/.pi/agent/prompts/` | YAML frontmatter (`description`) |

## Editing Workflow Prompts

When modifying workflow prompts in `src/`:

1. Edit the source file in `src/`
2. Run `node install.js` to regenerate distribution files
3. Test the workflow in your AI tool of choice
4. The `dist/` folder is regenerated automatically — don't edit files there directly
