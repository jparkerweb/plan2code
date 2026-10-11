# Changelog on the Web Console

Workflow notes for `changelog`, part of the web console contract (`console.md`).

Open with `--workflow changelog` (launched from the dashboard: resume the
session instead). Post `activity` while you read the history and the diff. One
card per step, each asked only when the step needs it:

| Step | On the page |
| --- | --- |
| Version | A `choice`, "Which version?": the computed version (recommended) with its reason in `body` (main is at X, the branch has Y), "Keep Y" when the branch's own entry could stay, and "Another version" (`allowOther`). A `choice` does not check what is typed, so check it yourself: anything that is not `X.Y.Z` gets the card again with a `thread` reply saying so. Left out when the entry is already right. |
| Entries | A `list` titled "Entries to add": one row per suggested entry, `title` the entry line itself (the part they can edit) and `body` its section (`Added`, `Fixed`…). Removable and reorderable; `reply` names renames, additions and removals. A row they add has no section: ask, or file it where it reads best and say so. |
| The result | The final entry as a doc (`id: "entry"`, marked `"saved": "CHANGELOG.md"` once written) plus a `review` card with verdicts `write` ("Write it"), `change` and `stop`. |
| package.json | A `confirm` with the `old → new` in `consequences`. |
| Commit this now? | A `confirm`, "Commit this now?". |

A yes to "Commit this now?" ends no session (no `finish`, no `stop`): settle
the card, resume as `git` (`open --resume <sid> --no-open --workflow git`),
then read `~/.agents/skills/plan2code-git/SKILL.md` with your file-read tool
and start with its commit flow, in this same session, as a dashboard launch
does (`console-launches.md`); the resume clears Changelog's page for it.
Finish, on a no: `"dashboard": true` and the version and entries in `body`,
with no `command`. A stop's finish is the bare `/plan2code-changelog`.
