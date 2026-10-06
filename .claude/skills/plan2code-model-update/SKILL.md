---
name: plan2code-model-update
description: "Refresh the plan2code launcher's curated model menu in src/launcher/models.json from `devin models list` and Claude Code's documented model aliases, with the maintainer approving every change before anything is written. Use this skill when the user says 'update the models', 'refresh models.json', 'new Claude model', 'devin models changed', or otherwise asks to bring the launcher's model list up to date."
---

# Plan2Code Model Update

Bring the launcher's curated model menu (`src/launcher/models.json`) up to date with the models each CLI offers today. Discover what Devin and Claude Code currently offer, show the maintainer a diff against the shipped file, apply only the changes they approve, validate the file, and run `npm test`. This skill never commits.

**Repo-local by design.** This skill lives in the repo's `.claude/skills/` and is intentionally NOT wired into `install.js` — it is a maintainer dev tool, not part of the shipped product, so it is never installed to `~/.claude/skills/`. Do **not** copy it there: the uninstaller (`uninstallSkills()` in `install.js`) and every re-install (`install()`) both run `cleanLegacyPaths()`, which deletes every entry matching `/^plan2code-/` under `~/.claude/skills/` (the `LEGACY_PATHS` row for Claude Code skills), so a copy placed there would be silently removed.

**Terminal only.** This skill runs in the terminal, with no web console session. Ask every question here.

## Workflow

### Step 1 — Preflight

Run from the repo root (the folder holding `install.js` and `src/launcher/`). Run `git status --porcelain -- src/launcher/models.json`. If it prints anything, warn — do not stop:

> `src/launcher/models.json` already has uncommitted changes. The diff below compares against the file as it stands on disk, including those changes.

### Step 2 — Read the current file

Read `src/launcher/models.json`. It has three keys: `_note` (a string), `claude` and `devin` (each an array of `{ "id", "label" }`). Keep the `_note` text exactly as read — Step 7 writes it back verbatim and the Validation rules check it.

### Step 3 — Discover Devin's models

If `devin` is on PATH (`command -v devin` in bash, `Get-Command devin` in PowerShell), run:

```bash
devin models list
```

Show its raw output to the maintainer before any interpretation — the format is not a stable contract. The output is long (hundreds of ids across about twenty families), so save it to a scratch file outside the repo, say where, and show the family headings in full. From it, take the explicit ids at Low, Medium and High effort only, plus `adaptive`. Skip every id the Validation rules forbid (`xhigh`, `max`, `fast`, `priority` endings), and also skip `none`-effort ids, ids with no effort suffix (such as `swe-1-7`, which is a Max model), and `fusion-*` combinations.

The 30-entry cap means the file can never hold every family at three efforts. Propose additions by family — newest and most-used first — and say how many entries that leaves.

If `devin` is not on PATH or the command fails, say so with the error, and switch to **guided manual edits** for Devin: ask the maintainer which ids to add, remove or relabel, one at a time, and carry those into Step 5 as the proposed list.

### Step 4 — Discover Claude Code's models

Look up Claude Code's current model documentation — the model configuration page in the Claude Code docs. Locate it on each run (search the Claude Code docs for model configuration) rather than using a remembered URL; docs move. List the documented model aliases (for example `default`, `sonnet`, `opus`, `haiku`, `opusplan`) and what each one means, and name the page you used. Keep `default` as the file's first entry even though the docs call it a special value rather than an alias. Bracketed aliases such as `opus[1m]` are valid ids; propose them only when the maintainer wants them in the menu.

If the lookup fails or the page does not list aliases, say so, and switch to **guided manual edits** for Claude, exactly as in Step 3.

### Step 5 — Show the diff

For each CLI, compare the discovered list with the current one by `id` and show one table:

| Change | id | Current label | Proposed label | Source |
| --- | --- | --- | --- | --- |
| added | `new-id` | — | New label | `devin models list` |
| gone | `old-id` | Old label | — | not in `devin models list` |
| relabelled | `same-id` | Old label | New label | Claude Code docs: <page> |

- **added:** offered by the CLI, not in the file.
- **gone:** in the file, no longer offered.
- **relabelled:** same `id`, a better or changed label. Propose a label in the file's existing style.

Summarise unchanged entries as a count under the table ("19 Devin entries unchanged") instead of listing them. If approving every **added** Devin row would take the list past 30 entries, say so above the table and by how many. Call out any likely rename before approval (see the rename warning under Validation rules). If both tables are empty, say the file is current and stop.

### Step 6 — Approve each change

Ask about each row, one at a time: **yes**, **no**, or **edit the label** (they type the label to use). Write nothing until every row has an answer. A "no" leaves that entry exactly as it is today.

### Step 7 — Edit `models.json`

Apply only the approved rows:

- Keep `_note` verbatim.
- Keep the existing order. Remove a **gone** entry where it stands, change a **relabelled** label in place, and append each **added** entry at the end of its list.
- Write two-space-indented JSON with a trailing newline, matching the file's current formatting.

### Step 8 — Validate

Check the edited file against every rule under Validation rules. On a failure, show the rule and the entry that broke it, and go back to Step 6 for the affected rows. Do not run tests on a file that fails validation.

### Step 9 — Test

Run `npm test` from the repo root and report the result honestly: pass, or the failing suite and its output. Never describe a failing run as passing.

### Step 10 — Remind about the release

A launcher model change reaches people only with the next release. Remind the maintainer to add a `CHANGELOG.md` line and keep `CHANGELOG.md`, `version.json` and `package.json` on the same version — `/plan2code-changelog` does both.

### Step 11 — Suggest a commit

Suggest a one-line commit message that says what changed, and do not run it:

```bash
git add src/launcher/models.json
git commit -m "Refresh the launcher's model menu"
```

Give `add` and `commit` as two separate commands (Windows PowerShell 5.1 has no `&&`).

## Validation rules

Check every rule before `npm test` (Step 8). They mirror the shipped-file test in `scripts/test-launcher.mjs` ("the shipped models.json is curated Devin at low/medium/high only") plus the menu's own needs:

- The file is valid JSON.
- `_note` is present and unchanged from what Step 2 read.
- `claude` and `devin` are both non-empty arrays.
- `devin` has at most 30 entries.
- Every entry has a non-empty string `id` and a non-empty string `label`.
- Ids are unique within each list, and labels are unique within each list.
- No Devin id ends in `xhigh`, `max`, `fast` or `priority`.

**Warn on renames.** When an entry is **gone** and a near-identical id is **added** in the same list (a changed version number or suffix, say `glm-5-3-high` → `glm-5-4-high`), call the pair out before approval as a likely rename. People's own lists in `~/.plan2code/models.json` merge with the shipped one by id (`mergeModels()` in `src/launcher/plan2code.js`), so a renamed id can bring back a user's old copy of the entry beside the new one. Approve the pair knowingly, or keep the old id.

## Rules

- **Never commit and never push** — Step 11 suggests the commit; the maintainer runs it.
- **Touch only `src/launcher/models.json`**, plus `CHANGELOG.md` only if the maintainer asks for the release line.
- **Nothing is written before every row is answered** (Step 6).
- **Never install this skill** — never add it to `install.js`, and never copy it to `~/.claude/skills/` (the uninstaller deletes `plan2code-*` entries there).
