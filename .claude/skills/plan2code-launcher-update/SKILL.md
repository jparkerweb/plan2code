---
name: plan2code-launcher-update
description: "Refresh the plan2code launcher's shipped data: the curated model menu in src/launcher/models.json from `devin models list` and Claude Code's documented model aliases, and the agent list's install data in src/launcher/agents.json re-checked against each vendor's docs, with the maintainer approving every change before anything is written. Use this skill when the user says 'update the models', 'refresh models.json', 'new Claude model', 'devin models changed', 'update the agents', 'refresh agents.json', 'agent install commands changed', 're-check the agent list', or otherwise asks to bring the launcher's model menu or agent install data up to date."
---

# Plan2Code Launcher Update

Bring the launcher's shipped data up to date: the curated model menu (`src/launcher/models.json`) with the models each CLI offers today, and the agent list (`src/launcher/agents.json`) with what each vendor's docs say today. Discover the current facts, show the maintainer a diff against the shipped files, apply only the changes they approve, validate both files, and run `npm test`. This skill never commits.

**Repo-local by design.** This skill lives in the repo's `.claude/skills/` and is intentionally NOT wired into `install.js` — it is a maintainer dev tool, not part of the shipped product, so it is never installed to `~/.claude/skills/`. Do **not** copy it there: the uninstaller (`uninstallSkills()` in `install.js`) and every re-install (`install()`) both run `cleanLegacyPaths()`, which deletes every entry matching `/^plan2code-/` under `~/.claude/skills/` (the `LEGACY_PATHS` row for Claude Code skills), so a copy placed there would be silently removed.

**Terminal only.** This skill runs in the terminal, with no web console session. Ask every question here.

## Workflow

### Step 1 — Preflight

Run from the repo root (the folder holding `install.js` and `src/launcher/`). Run `git status --porcelain -- src/launcher/models.json src/launcher/agents.json`. If it prints anything, warn — do not stop:

> The shipped launcher files already have uncommitted changes. The diff below compares against the files as they stand on disk, including those changes.

### Step 2 — Read the current files

Read `src/launcher/models.json`. It has four keys: `_note` (a string), `claude`, `devin` and `codex` (each an array of `{ "id", "label" }`; `codex` is empty today, because Codex's docs name no models to verify and the launcher skips the model question for it). Keep the `_note` text exactly as read — Step 9 writes it back verbatim and the Validation rules check it.

Read `src/launcher/agents.json`. It has `schema` (currently `1`) and `agents`, a list of entries. Each entry carries `id`, `name`, `kind` (`builtin` or `template`), `command`, `prompt`, `args`, `bypassArgs`, `modelArgs`, and optional `note`. A `builtin` entry also carries `installUrl`, `install` (lists under `win`, `mac` and `linux`, each `{ label, run, note? }`) and `installDirs` (the same OS keys). Keep the file's shape and order exactly as read.

### Step 3 — Discover Devin's models

If `devin` is on PATH (`command -v devin` in bash, `Get-Command devin` in PowerShell), run:

```bash
devin models list
```

Show its raw output to the maintainer before any interpretation — the format is not a stable contract. The output is long (hundreds of ids across about twenty families), so save it to a scratch file outside the repo, say where, and show the family headings in full. From it, take the explicit ids at Low, Medium and High effort only, plus `adaptive`. Skip every id the Validation rules forbid (`xhigh`, `max`, `fast`, `priority` endings), and also skip `none`-effort ids, ids with no effort suffix (such as `swe-1-7`, which is a Max model), and `fusion-*` combinations.

The 30-entry cap means the file can never hold every family at three efforts. Propose additions by family — newest and most-used first — and say how many entries that leaves.

If `devin` is not on PATH or the command fails, say so with the error, and switch to **guided manual edits** for Devin: ask the maintainer which ids to add, remove or relabel, one at a time, and carry those into Step 7 as the proposed list.

### Step 4 — Discover Claude Code's models

Look up Claude Code's current model documentation — the model configuration page in the Claude Code docs. Locate it on each run (search the Claude Code docs for model configuration) rather than using a remembered URL; docs move. List the documented model aliases (for example `default`, `sonnet`, `opus`, `haiku`, `opusplan`) and what each one means, and name the page you used. Keep `default` as the file's first entry even though the docs call it a special value rather than an alias. Bracketed aliases such as `opus[1m]` are valid ids; propose them only when the maintainer wants them in the menu.

If the lookup fails or the page does not list aliases, say so, and switch to **guided manual edits** for Claude, exactly as in Step 3.

### Step 4b: Check Codex's models

Look up Codex's current model documentation (locate it on each run). Propose `codex` entries only for model ids the docs name explicitly. If they name none, say so and leave `codex` empty. If entries are added, the `_note` sentence about Codex goes stale; keep `_note` verbatim as everywhere else, but tell the maintainer so they can reword it by hand. If the lookup fails, use guided manual edits as in Step 3.

### Step 5: Re-check the agent list against vendor docs

For each entry in `agents.json`, locate the vendor's current install documentation on each run (search for it; do not use a remembered URL, since docs move and `installUrl` itself may be stale). Compare the file against what the docs say today:

- **Built-ins** (`claude`, `devin`, `codex`): `installUrl`, every `install` line per OS (`label`, `run`, `note`), and `installDirs` per OS. Keep the lead-installer order: the vendor's native installer first, then npm where it exists, with requirement notes (like Claude Code's Node 22+ npm note) carried on their lines. Also re-check `command`, `prompt`, `args`, `bypassArgs` and `modelArgs` against the vendor's CLI reference.
- **Templates** (`copilot`, `opencode`, `gemini`, `pi`): `command`, the first-prompt form (`prompt` plus where `{prompt}` sits in `args`), `bypassArgs`, `modelArgs`, and any `note`. Confirm the template rule still holds: the docs must confirm both that the agent loads the installed Plan2Code skills (the skills folders the vendor documents) and that it starts an interactive session with a first prompt. A template that no longer passes the rule is proposed for removal, and the maintainer is told why.

Name the docs page used for each entry. If an entry's docs cannot be found or read, say so, and carry nothing for that entry into Step 7. Never propose a change from memory.

### Step 6: Re-check Cursor CLI and Aider

Cursor CLI and Aider were left out of the templates for want of one confirmation each: Cursor CLI's skills loading in the CLI (its editor docs list skills folders, the CLI's did not), and Aider's skills support and an interactive first prompt. Re-check both against the same template rule as Step 5: the docs must confirm both that the agent loads the installed Plan2Code skills and that it starts an interactive session with a first prompt.

Propose a new `template` entry only when both are confirmed, in the shape of the existing entries (`id`, `name`, `command`, `prompt` worded for that agent's skill invocation, `args` with the prompt in the vendor's documented first-prompt form, `bypassArgs`, `modelArgs`). When one side is still unconfirmed, say which and propose nothing.

### Step 7 — Show the diff

For `models.json`, compare the discovered list with the current one by `id` and show one table:

| Change | id | Current label | Proposed label | Source |
| --- | --- | --- | --- | --- |
| added | `new-id` | — | New label | `devin models list` |
| gone | `old-id` | Old label | — | not in `devin models list` |
| relabeled | `same-id` | Old label | New label | Claude Code docs: <page> |

- **added:** offered by the CLI, not in the file.
- **gone:** in the file, no longer offered.
- **relabeled:** same `id`, a better or changed label. Propose a label in the file's existing style.

For `agents.json`, show one table with one row per changed field:

| Change | Entry | Field | Current | Proposed | Source |
| --- | --- | --- | --- | --- | --- |
| changed | `claude` | `install.win[0].run` | old command | new command | <vendor docs page> |
| added | `cursor` | new template | | template entry | <vendor docs page> |
| gone | `gemini` | whole entry | template | | skills no longer confirmed |

Summarize unchanged entries as a count under each table ("19 Devin entries unchanged", "3 built-ins unchanged") instead of listing them. If approving every **added** Devin row would take the list past 30 entries, say so above the table and by how many. Call out any likely rename before approval (see the rename warning under Validation rules). If all tables are empty, say the files are current and stop.

### Step 8 — Approve each change

Ask about each row, one at a time: **yes**, **no**, or **edit** (they type the value to use). Write nothing until every row has an answer. A "no" leaves that entry exactly as it is today.

### Step 9 — Edit the files

Apply only the approved rows:

- Keep `_note` in `models.json` and `schema` in `agents.json` verbatim.
- Keep the existing order. Remove a **gone** entry where it stands, change a **changed** or **relabeled** value in place, and append each **added** entry at the end of its list.
- Write two-space-indented JSON with a trailing newline, matching each file's current formatting.

### Step 10 — Validate

Check the edited files against every rule under Validation rules. On a failure, show the rule and the entry that broke it, and go back to Step 8 for the affected rows. Do not run tests on a file that fails validation.

### Step 11 — Test

Run `npm test` from the repo root and report the result honestly: pass, or the failing suite and its output. Never describe a failing run as passing.

### Step 12 — Remind about the release

A launcher data change reaches people only with the next release. Remind the maintainer to add a `CHANGELOG.md` line and keep `CHANGELOG.md`, `version.json` and `package.json` on the same version — `/plan2code-changelog` does both.

### Step 13 — Suggest a commit

Suggest a one-line commit message that says what changed, and do not run it:

```bash
git add src/launcher/models.json src/launcher/agents.json
git commit -m "Refresh the launcher's model menu and agent install data"
```

Give `add` and `commit` as two separate commands (Windows PowerShell 5.1 has no `&&`).

## Validation rules

Check every rule before `npm test` (Step 10). They mirror the shipped-file tests in `scripts/test-launcher.mjs` ("the shipped models.json is curated Devin at low/medium/high only") and `scripts/test-agent-lookup.mjs` (the shipped `agents.json` loads clean) plus the menus' own needs:

**`models.json`:**

- The file is valid JSON.
- `_note` is present and unchanged from what Step 2 read.
- `claude` and `devin` are both non-empty arrays; `codex` is an array (empty is allowed).
- `devin` has at most 30 entries.
- Every entry in `claude`, `devin` and `codex` has a non-empty string `id` and a non-empty string `label`.
- Ids are unique within each list, and labels are unique within each list.
- No Devin id ends in `xhigh`, `max`, `fast` or `priority`.

**`agents.json`:**

- The file is valid JSON, `schema` is `1`, and `agents` is a non-empty array.
- Ids are unique, and `kind` is `builtin` or `template` on every entry.
- The `builtin` entries are exactly `claude`, `devin` and `codex`, and each carries a non-empty `installUrl`, an `install` list under each of `win`, `mac` and `linux` (every line a non-empty `label` and `run`), and `installDirs` under the same keys.
- Every entry has a non-empty `id`, `name` and `command`; `name` is at most 60 characters.
- Every `template` entry would pass `normalizeAgents()` in `src/web-console/agents.mjs` with no warnings (the check `scripts/test-agent-lookup.mjs` runs): a kebab-case `id` that is not a built-in id, `args`, `bypassArgs` and `modelArgs` lists of strings when present.
- Every `template` entry's docs still confirm both skill loading and an interactive first prompt (Steps 5 and 6); the maintainer approved any removal this breaks.

**Warn on renames.** When an entry is **gone** and a near-identical id is **added** in the same list (a changed version number or suffix, say `glm-5-3-high` → `glm-5-4-high`), call the pair out before approval as a likely rename. People's own lists in `~/.plan2code/models.json` merge with the shipped one by id (`mergeModels()` in `src/launcher/plan2code.js`), so a renamed id can bring back a user's old copy of the entry beside the new one. Approve the pair knowingly, or keep the old id.

## Rules

- **Never commit and never push** — Step 13 suggests the commit; the maintainer runs it.
- **Touch only `src/launcher/models.json` and `src/launcher/agents.json`**, plus `CHANGELOG.md` only if the maintainer asks for the release line.
- **Nothing is written before every row is answered** (Step 8).
- **Never install this skill** — never add it to `install.js`, and never copy it to `~/.claude/skills/` (the uninstaller deletes `plan2code-*` entries there).
