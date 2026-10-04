# Step 7 — AI Agent File Sync

Check for other AI agent config files and offer to replace them with AGENTS.md
references, so AGENTS.md stays the single source of truth. Detection and the
replacement text are fixed, so a script does both; the choice is the user's.

## Detect

```
node "<S>/agent-files.mjs" detect
```

It looks for `CLAUDE.md`, `GEMINI.md` and `.cursorrules` (root),
`.github/copilot-instructions.md`, and the `.cursor/rules/` and `.windsurf/rules/`
folders (each folder is one entry). Per entry: `id`, `lines`, `custom` (over 10
lines), `alreadyPointer` (already the AGENTS.md pointer: nothing to offer) and
`linkedToAgents` (a symlink or hard link to AGENTS.md: it is AGENTS.md).

Leave out `alreadyPointer` entries, and `linkedToAgents` entries too (they are
AGENTS.md). **Nothing left:** skip silently, end workflow.

## If Files Found

```
    +---+
    | o |
    | ~ |   Found other AI agent configs!
    +---+
```

> Found AI config files that could reference AGENTS.md:
>
> | File | Size |
> |------|------|
> | `CLAUDE.md` | 45 lines |
>
> Replace with AGENTS.md references?
> - **Yes** - Update all
> - **Select** - Choose specific (numbered list)
> - **No** - Keep as-is

Relay each `warnings` line ("[file] has custom content that will be replaced.").

## Apply the confirmed ones

```
node "<S>/agent-files.mjs" apply <id> [<id> ...]     # Select
node "<S>/agent-files.mjs" apply --all               # Yes
```

Only ids the user confirmed. `--dry-run` previews the `actions` without writing.
It writes:

- **`CLAUDE.md`**: the special template, because Claude Code auto-loads it. It opens
  with the `CRITICAL — MANDATORY FIRST STEP` directive to read AGENTS.md before
  answering anything, then points at AGENTS.md for full documentation.
- **Every other file**: `# <Title>` plus the "See AGENTS.md for complete project
  documentation including:" pointer and bullet list, with the right relative path (`./`, `../` or `../../` by location).
- **Rules folders** (`.cursor/rules/`, `.windsurf/rules/`): deletes the existing `.md`
  files (and `.mdc` for Cursor) and creates a single `reference.md`.

Exit 3 means AGENTS.md is missing or an id was not among those detected. Exit 5
`linked-to-agents` means a named id is AGENTS.md through a link: leave it as it
is (`--all` skips such entries as `skipped-linked`).
