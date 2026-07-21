---
name: plan2code-publish
description: "Publish a GitHub Release for jparkerweb/plan2code whenever CHANGELOG.md's top version is ahead of the latest published release on GitHub — after verifying CHANGELOG.md, version.json, and package.json all agree on the version. Use this skill when the user says 'publish a release', 'create a GitHub release', 'cut a release', 'tag a release', 'tag and release', 'is the changelog published', or otherwise mentions publishing/releasing/tagging this repo."
---

# Plan2Code Release Publisher

Publish a GitHub Release for `jparkerweb/plan2code` whenever `CHANGELOG.md`'s top version is ahead of the latest published release on GitHub. This turns the merged CHANGELOG entry on `main` into an actual GitHub Release (which also creates the `vX.Y.Z` git tag).

**Repo-local by design.** This skill lives in the repo's `.claude/skills/` and is intentionally NOT wired into `install.js` — it is a maintainer dev tool, not part of the shipped product, so it is never installed to `~/.claude/skills/`. Do **not** copy it there: the uninstaller (`uninstallFiles()` in `install.js`) and every re-install's pre-copy cleanup in `install()` both delete every entry matching `/^plan2code-/` under `~/.claude/skills/`, so a copy placed there would be silently removed.

## Workflow

### Step 1 — Preflight: clean working tree

Run `git status --porcelain`. If the output is non-empty, stop immediately — do not switch branches or take any other action. Tell the user:

> Working tree has uncommitted changes. Commit or stash them, then re-run this skill.

### Step 2 — Switch to main and pull

If the working tree is clean, switch to `main` and pull latest. Run these as two separate, non-chained commands (never `&&`/`;`-chain `git`/`gh` commands — Windows PowerShell 5.1 rejects `&&`):

```bash
git checkout main
git pull origin main
```

### Step 3 — Read the three version sources

Read all three files at the repo root and extract each version:

- `CHANGELOG.md` — parse the first `## vX.Y.Z` heading. Strip the leading `v` → `$CHANGELOG_VERSION`. Note: plan2code CHANGELOG headings are `## vX.Y.Z` (v-prefixed, **no** date and **no** brackets) — different from a `## [x.y.z] - YYYY-MM-DD` format.
- `version.json` — the `version` field → `$VERSION_JSON`. Also read its `releaseDate` field → `$RELEASE_DATE` (informational only — shown at the confirm step, never part of the sync gate; use `(none)` if absent).
- `package.json` (root) → the `version` field → `$PACKAGE_JSON`.

Also capture from `CHANGELOG.md` the **section body** for the top version: everything from the `## vX.Y.Z` heading line itself (heading **included**) up to — but not including — the next `## v` heading, or end-of-file if there is none. Call this `$SECTION`. Keep the `## vX.Y.Z` heading in `$SECTION`; plan2code release bodies include it.

### Step 4 — Version-sync preflight (STOP on mismatch)

All three versions must be identical. This enforces the repo's documented invariant (`.agents-docs/AGENTS-code-style.md` → "Version sync"): `CHANGELOG.md`, `version.json`, and `package.json` must always show the same version number.

If `$CHANGELOG_VERSION`, `$VERSION_JSON`, and `$PACKAGE_JSON` are **not** all equal, **stop** — do not read the release, do not publish. Report exactly which files disagree:

> ⚠️ Version files are out of sync — refusing to publish. The repo requires `CHANGELOG.md`, `version.json`, and `package.json` to match.
>
> - **CHANGELOG.md:** $CHANGELOG_VERSION
> - **version.json:** $VERSION_JSON
> - **package.json:** $PACKAGE_JSON
>
> Fix the mismatch first, then re-run this skill. To realign: pick the intended version (normally the highest / newest CHANGELOG entry) and update the other two files to match — see the "Version sync" gotcha in `.agents-docs/AGENTS-code-style.md`.

This skill never modifies these files — it only reads and compares them.

### Step 5 — Determine the highest published release

List every published (non-draft) release and take the numerically-highest semver tag. Do **not** rely on `gh release view` / GitHub's "Latest" flag: that flag returns whatever release is *marked* latest — normally the newest semver, but a maintainer can manually pin it to an older release, which would make the Step 6 ahead-comparison misfire.

```bash
gh release list --repo jparkerweb/plan2code --json tagName,isDraft -q '.[] | select(.isDraft==false) | .tagName'
```

Strip any leading `v` from each returned tag, compare them as numeric `(major, minor, patch)` tuples (the same rule as Step 6), and take the maximum → `$RELEASE_VERSION`. If the command returns no tags or exits non-zero for **any** reason (no releases yet, transient error, etc.), set `$RELEASE_VERSION = "0.0.0"` — no error-text matching is needed.

### Step 6 — Compare versions

Compare `$CHANGELOG_VERSION` vs `$RELEASE_VERSION` as a numeric `(major, minor, patch)` tuple. Never do a plain string/lexicographic compare — e.g. `"1.9.0" > "1.10.0"` is true as strings but wrong numerically.

### Step 7 — Not ahead: no-op

If `$CHANGELOG_VERSION` ≤ `$RELEASE_VERSION`, print a simple status message showing both versions and stop:

> CHANGELOG top version ($CHANGELOG_VERSION) is not ahead of the latest published release ($RELEASE_VERSION). Nothing to publish.

No error is raised and no release is created.

### Step 8 — Ahead: compute and confirm

If `$CHANGELOG_VERSION` > `$RELEASE_VERSION`, compute:

- `tag = "v$CHANGELOG_VERSION"`
- `title = "v$CHANGELOG_VERSION"` (plan2code keeps the `v` prefix in release titles)
- `notes` = the header line `# What's New 🎉`, then one blank line, then `$SECTION` verbatim (`$SECTION` already starts with the `## vX.Y.Z` heading). Build this as a real multi-line string with **actual newlines** — the `\n\n` shorthand shown elsewhere means "a blank line," never the literal two-character sequence `\` + `n`. Getting this wrong would run the header and the first CHANGELOG heading together with a stray `\n\n` in the published body.

Present all three to the user and wait for an explicit answer before any write. Offer the optional decorative title suffix — a plain `vX.Y.Z` title is the default, but a release may append one (e.g. `v1.14.0 - 🔍 Review workflow`):

> 🚀 [Publish Plan2Code Release]
>
> CHANGELOG is ahead of the latest published release:
> - **Current release:** $RELEASE_VERSION
> - **CHANGELOG top version:** $CHANGELOG_VERSION
> - **version.json releaseDate:** $RELEASE_DATE (informational — read from `version.json`)
>
> Proposed release:
> - **Tag:** $tag
> - **Title:** $title
> - **Notes:**
> ```
> $notes
> ```
>
> Publish this release? Reply **yes** to publish as-is, **no** to cancel, or provide a decorative suffix to append to the title (e.g. `⇢ 🎆 Feature Name` or `- 🔍 Feature Name`).

If the user supplies a suffix, set `title = "v$CHANGELOG_VERSION " + <suffix>` (single space join) and proceed to publish. The tag and notes are unaffected by the suffix.

### Step 9 — Publish (on approval)

On approval, write `$notes` to a temp file — never pass multiline text inline via `--notes`, that regresses into a quoting bug — then create the release targeting `main`. Two requirements for the temp file: `$notes` must already hold **real newlines** (per Step 8) because `printf '%s'` / `WriteAllText` write it byte-for-byte — a literal `\n` in the string lands literally in the release body; and it MUST be **UTF-8** because the notes contain emoji (`🎉`, `🐛`, `✨`, `🔧`).

**bash (preferred in this environment):**

```bash
NOTES_FILE=$(mktemp)
printf '%s' "$notes" > "$NOTES_FILE"
gh release create "$tag" --repo jparkerweb/plan2code --title "$title" --notes-file "$NOTES_FILE" --target main
rm -f "$NOTES_FILE"
```

**PowerShell:** do NOT use `Set-Content` — under Windows PowerShell 5.1 it writes ANSI/UTF-16 by default and mangles the emoji into `??`. Write UTF-8 **without BOM** (a BOM would leak into the release body):

```powershell
$NotesFile = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($NotesFile, $notes, [System.Text.UTF8Encoding]::new($false))
gh release create "$tag" --repo jparkerweb/plan2code --title "$title" --notes-file "$NotesFile" --target main
Remove-Item -Path $NotesFile
```

Always delete the temp file afterward, regardless of whether `gh release create` succeeded or failed.

**Failure handling — already-exists classification:** if `gh release create` exits non-zero, inspect the error text.

- If and only if it contains the substring `already exists` (real output: `HTTP 422: Validation Failed` / `Release.tag_name already exists`), report this to the user as already published, not as a raw CLI error:

  > This version ($CHANGELOG_VERSION) was already published as a release — nothing more to do.

- Every other failure (auth, network, permissions, etc.) must be surfaced to the user verbatim. Never silently reclassify a genuine failure as "already published."

### Step 10 — Verify

Confirm the release now exists and report its URL:

```bash
gh release view "$tag" --repo jparkerweb/plan2code
```

Report the release URL to the user.

## Rules

- **Repo-local only** — this skill is not part of the installed product; never add it to `install.js`, and never copy it to `~/.claude/skills/` (the uninstaller deletes `plan2code-*` entries there).
- **Read-only on version files** — never modify `CHANGELOG.md`, `version.json`, or `package.json`; this skill only reads and compares them.
- **Version-sync gate is hard** (Step 4) — if the three version sources disagree, stop and report; do not publish a release from an inconsistent repo.
- **Never run a local `git tag` or `git push`** — tag creation is delegated entirely to `gh release create --target main`.
- **Always use `--notes-file`**, never inline multiline `--notes`, and always write the notes file as UTF-8 (no BOM) so emoji survive.
- **Always clean up the temp notes file**, even on a mid-run error.
- **Always get explicit approval before any write** (Step 8) — no release is created without a yes (or a yes-with-suffix).
- **Derive the current version from the highest published semver tag** (Step 5), never from GitHub's manually-pinnable "Latest" flag. On an empty or failed release list, treat it as "no prior release" (baseline `0.0.0`) — no error-text matching needed.
- **On a `gh release create` failure** (Step 9), only reclassify as already-published when the error contains `already exists` — every other failure must be shown verbatim, never swallowed.
- **Idempotent and safe to re-run** at any time — re-running after a successful publish hits the Step 7 no-op; re-running after a race-lost publish hits the Step 9 already-exists handling.
