---
name: plan2code-changelog
description: "Validate and fix the CHANGELOG.md version number before opening a PR. Reads main branch to determine the current latest version, classifies changes on the current branch, and proposes the correct next semver. Use this skill when the user mentions changelog, version number, preparing a PR, release version, semver check, or says 'check the changelog', 'what version should this be', 'prepare for PR', or 'fix the version'. Also use proactively when you notice a CHANGELOG entry that may have an incorrect version number."
---

# Plan2Code Changelog Validator

Ensure the CHANGELOG.md entry for the current branch has the correct semver version before a PR is opened. This skill exists because parallel branches independently pick version numbers that collide or leap-frog when merged — this validates against main's actual state right before the PR.

## Workflow

### Step 1 — Gather state

Run these commands to understand the current situation:

```bash
# 1. Current latest version on main
git show main:CHANGELOG.md | head -20

# 2. Current branch name (for ticket ID extraction)
git branch --show-current

# 3. What this branch changed (commit subjects)
git log main...HEAD --oneline

# 4. Files changed on this branch
git diff main...HEAD --name-only
```

Extract from main's CHANGELOG:
- The **latest version number** (first `## vX.Y.Z` line)

Note: on Windows, PowerShell's console encoding mangles the emoji in the `###` headings to `?`. Read `CHANGELOG.md` with the file-read or grep tool rather than `Get-Content` / `Select-String` when you need to see them.

Extract from the branch:
- The **list of changed files** to classify the change type
- The **commit messages** for changelog entry content

### Step 2 — Classify the change

Determine the change type by examining what was modified on this branch:

| Signal | Classification | Version Bump | Heading |
|--------|---------------|--------------|---------|
| An install target removed, or an existing workflow's contract broken | Breaking change | **Major** (X.0.0) | `### 💥 Breaking` |
| New workflow prompt (`.md` file under `src/`) | New workflow | **Minor** (x.Y.0) | `### ✨ Added` |
| New capability added to an existing prompt, or a new `.claude/skills/` skill | New capability | **Patch** (x.y.Z) | `### ✨ Added` |
| Behavioral changes to existing prompt(s), installer, or docs | Behavior change | **Patch** (x.y.Z) | `### 🔧 Changed` |
| Bug fix to existing prompt(s) or tooling | Bug fix | **Patch** (x.y.Z) | `### 🐛 Fixed` |
| A prompt, target, or file deleted | Removal | **Patch** (x.y.Z) | `### 🗑️ Removed` |
| README / `.readme/` / docs-site only | Documentation | **Patch** (x.y.Z) | `### 📚 Documentation` |
| Mix of the above | Use the **highest** bump (major > minor > patch) | Combine headings |

Use only the headings in this table — the CHANGELOG has historical one-off variants (`🎁 Added`, `📦 Updated`, `📝 Documentation`, `🏎️ Improved`, `🧪 Testing`) that should not be introduced in new entries.

### Step 3 — Compute the correct version

Starting from main's latest version:
- **Major bump:** increment the first number, reset the rest (e.g., `1.16.1` → `2.0.0`)
- **Minor bump:** increment the middle number, reset patch to 0 (e.g., `2.0.0` → `2.1.0`)
- **Patch bump:** increment the last number (e.g., `2.1.0` → `2.1.1`)

### Step 4 — Check the current branch's CHANGELOG

Read the current `CHANGELOG.md` on the branch. Look for:

0. **You are on `main` with no diff** — there is no branch to validate. Instead, compare the top CHANGELOG version against `git log` since the commit that released it: if commits have landed on `main` without a CHANGELOG entry, treat those commits as the change set and continue from Step 2. Say so explicitly rather than reporting "nothing to do."

1. **No entry exists yet for this branch's work** — the branch hasn't added a version entry above main's latest. Proceed to Step 5 to draft one.

2. **An entry exists but the version is wrong** — the branch has a version entry, but it doesn't match the computed correct version (common when branches were rebased or other PRs merged first). Report the discrepancy:

   ```
   Version check for branch: {branch-name}

   Main is at:      {main-version}
   Branch claims:   {branch-version}  
   Correct version: {computed-version} ({classification})

   The version needs to be updated: {branch-version} → {computed-version}
   ```

   Ask: "Update the version to {computed-version}? (yes / no)"

3. **An entry exists and the version is correct** — report success:

   ```
   Version check for branch: {branch-name}

   Main is at:      {main-version}
   Branch version:  {branch-version} ({classification})

   Version is correct. CHANGELOG is ready for PR.
   ```

   Stop here unless the user asks for content changes.

### Step 5 — Draft or fix the CHANGELOG entry

**If no entry exists**, draft a new one based on the commits and changed files. Match this repo's house format exactly — a bare `## vX.Y.Z` heading with **no date**, emoji `###` headings from the Step 2 table, and a blank line between bullets:

```markdown
## {computed-version-with-v-prefix}

### ✨ Added

- **{prompt-or-area}** — {what changed, and why it matters to someone installing it}

### 🔧 Changed

- **{prompt-or-area}** — {what changed}
```

Conventions to follow, drawn from existing entries:

- Bold lead-in naming the prompt, file, or area, then an em dash (`—`), then the description.
- Reference prompts by their command (`/plan2code-1-plan`) or path (`src/plan2code-init.md`), not by informal name.
- One paragraph per bullet is fine — this CHANGELOG favours substantive entries over terse one-liners, and a bullet may carry extra indented paragraphs for detail.
- A release with a big theme may open with a one-line summary paragraph directly under the `## vX.Y.Z` heading, before the first `###`.

Insert the new section directly below the `All notable changes...` line and above the previous version's heading.

Present the draft and ask for approval before writing.

**If the version is wrong**, update only the version number — preserve the existing content unless the user asks for content changes too.

After any changes, show the final CHANGELOG entry for confirmation.

### Step 6 — Sync `package.json` and `version.json` versions

After writing or updating the CHANGELOG entry, update the `version` field in `package.json` at the repo root to match the computed version:

1. Read `package.json` and `version.json` then check the current `version` value.
2. If it already matches the computed version, skip — no change needed.
3. If it differs, update the `"version"` field in both files to the computed version (e.g., `"version": "2.1.1"`).
4. Set `releaseDate` in `version.json` to today's date in `YYYY-MM-DD`. This is the only place a date is recorded — the CHANGELOG headings carry no date.
5. Include `package.json` and `version.json` in the same commit as the CHANGELOG changes.

This keeps `package.json`, `version.json`, and `CHANGELOG.md` in lockstep so `npm pkg get version` always reflects the latest release.

## Rules

- Never create a version entry without checking main first — the whole point is to derive the version from main's current state
- Always present changes before writing — the user should see and approve the CHANGELOG entry
- Match the existing file's format — `## vX.Y.Z` with no date, emoji `###` headings. Do not introduce Keep a Changelog's `## [x.y.z] - date` style
- Write for someone reading the release notes, not for someone reading the diff — say what the change lets them do
- If multiple change types exist (Added + Changed), use multiple headings under the same version
- `version.json`'s `releaseDate` is today's date, i.e. when the release is being prepared, not when the work started
- If the branch has no meaningful changes vs main (e.g., only non-shipping files changed), say so and ask if a CHANGELOG entry is actually needed
