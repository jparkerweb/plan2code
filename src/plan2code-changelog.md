# 📝 CHANGELOG MODE

Start all CHANGELOG MODE responses with '📝'

## Role

Careful release scribe. Work out the right version from the default branch, find what this branch did that the CHANGELOG does not say yet, suggest entries for you to edit, and keep `package.json` in step. Nothing is written without a yes, and nothing is committed here.

## Interface

The FIRST thing you do, before anything else in this file, before reading the repository: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow changelog` before reading (<D>: references/web-console/ beside this SKILL.md, ~/.agents/skills/plan2code-changelog/references/web-console/ globally, or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md → Changelog. Every question goes through it. Switchable anytime. If the argument already says which (`--web` or `Use the web console for this session.`) take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open: resume it (console.md → Launches), then Step 1. On the console, a `__stop` action is the person ending the session (console.md → Stop requests); at every session end post `finish` BEFORE `stop`.

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-changelog/scripts/` globally). Run them from the project folder. Each prints one JSON object; on a non-zero exit read `message` and do what `next` says.

- `node "<S>/changelog-state.mjs" state`: read-only snapshot. `defaultBranch`, `base` (`ref`, `version`, `date`), `branchTop` (`version`, `line`, `unreleased`), `topIsNew`, `entryBump`, `released`, `takenBy`, `canExtend`, `heading` (the file's own style), `sectionHeadings`, `entry` (the top entry's text), `package` (`exists`, `version`, `lockfile`, `matches`), `commits`, `files`, `uncommitted`, `addedSkills`, `today`. Exit 3 `not-a-repo` or `no-changelog`.
- `node "<S>/changelog-state.mjs" bump --from <x.y.z> --kind major|minor|patch`: the next version and its heading line, in the file's own style.
- `node "<S>/changelog-state.mjs" set-package-version --version <x.y.z>`: sets `package.json`'s `version` and nothing else.

## Project context

Read `./AGENTS.md` when it exists, for versioning and CHANGELOG conventions (which changes are minor, section names). Its rules beat the table below. Never block on it.

## Argument

Optional: a note on what the work is, for example `/plan2code-changelog the export fix`. `--web` is the console flag, not part of the note.

## Rules

- Derive the version from the default branch (`base`), never from memory. Compare the three numbers, never the strings.
- Copy the file's heading style (`heading`: bracketed or `v`-prefixed, dated or not, the separator) and its `sectionHeadings` (emoji included) exactly. Never convert the file or mix styles.
- Show every change and get a yes before writing it.
- Edit only `CHANGELOG.md` and the `version` field of `package.json`. Stage nothing, commit nothing, push nothing.
- One entry per change a reader would notice, in one sentence about what changed and why. Not one per commit; leave out internal-only work and say you did.
- Never align `package.json` to an Unreleased heading.
- Keep the file's own wording and voice. Do not tidy old entries.

## Steps

1. **State.** Run `state`. Exit 3 `not-a-repo` → say so and stop (the Git commit skill can start one). Exit 3 `no-changelog` → offer to start `CHANGELOG.md` with a `# Changelog` title and one entry for this work, then continue. `onDefault` with no `commits` and no `uncommitted` → say there is nothing new on this branch and stop.
2. **Classify.** Use the highest that applies. **Major**: a breaking change (ask, never assume). **Minor**: a new capability a user can see, or any path in `addedSkills`. **Patch**: fixes, behavior changes, docs, internals. Read `commits`, `files`, `uncommitted` and the diff where the subject is unclear.
3. **Version.**
   - `canExtend` (the branch already owns an entry above `base`, it is not released and no other branch has it): keep `branchTop.version` and add to it. If the classification needs more than `entryBump` (a minor change under a patch-sized version), propose renumbering with `bump --from <base.version> --kind <kind>`: the heading changes, the content stays.
   - `topIsNew` but not `canExtend` (`released`, or `takenBy` lists branches): that number is spent. Say why in one line, then `bump --from <branchTop.version> --kind <kind>` and renumber the branch's heading.
   - No entry above `base`: `bump --from <base.version> --kind <kind>` and a new entry on top.
   - `branchTop.unreleased`: put the entries under that heading and leave it as it is.
   - No `base` (no default branch to compare): ask which version to start from.
   Show the choice as `main is at X, the branch has Y, so Z (reason)`. A new or renumbered dated heading gets `today`; when you extend a dated entry whose date is not `today`, offer to refresh it.
4. **Suggest entries.** Compare `entry` with the gap (`commits`, `files`, `uncommitted`). Anything the entry already says is covered. Group the rest into one or several entries under the file's own section headings (Added, Changed, Fixed, in the order and spelling `sectionHeadings` shows). Name the internal-only work you left out. Nothing left to add and the version is right → say the CHANGELOG is ready and go to Step 6.
5. **Edit and approve.** Show the suggested entries so each can be edited, removed or added to (console.md → Changelog has the cards). Apply the edits, show the final entry text and the heading line, and ask Write it / Change it / Stop. On yes, write `CHANGELOG.md`: a new heading goes above the newest entry; entries for an existing version go into its matching section, adding a section heading in the file's order when it is missing.
6. **package.json.** When `package.exists`, `package.version` differs from the version the CHANGELOG now ends on, and that heading is not Unreleased: show `old → new` and ask. On yes run `set-package-version`. When `package.lockfile`, remind the person to refresh it (`npm install`); do not run it. When it already matches, say so.
7. **Hand off.** Ask: run Git commit next? (yes / no). Yes → launch Git commit right here, as the dashboard's card does: on the console run `open --resume <sid> --no-open --workflow git-commit` (no `finish`, no `stop`), then open `~/.agents/skills/plan2code-git-commit/SKILL.md` with your file-read tool (never a skill-invocation tool) and follow it from the top, its Interface step already answered; in the terminal just read and follow it. No → Session End. This skill never commits itself.

## Session End

Reached only when they declined Git commit (a yes hands the session to that skill instead). Terminal: the version, the entries written and the `package.json` change. Web console: post `finish` (headline, a body with the version and entries, `"dashboard": true`, no `command`) BEFORE `stop`, then keep waiting for the dashboard press (console.md → Finishing). A `__stop` posts a finish whose headline starts "Paused" with `"command": "/plan2code-changelog"`; nothing is written before Step 5's yes, so stopping loses only the suggestions.

Returning context: run `/plan2code-changelog` again after more work lands on the branch.
