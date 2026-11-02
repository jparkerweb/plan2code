# Changelog

`changelog`: post `activity` while you read the history and diff. One card per step, each only when needed:

| Step | Card |
| --- | --- |
| Version | `choice` "Which version?": the computed version (recommended, reason in `body`), "Keep Y" when the branch's entry could stay, "Another version" (`allowOther`). Typed text is unchecked: anything but `X.Y.Z` gets the card again with a `thread` reply. Skipped when the entry is right. |
| Entries | `list` "Entries to add": `title` the entry line, `body` its section. `reply` names renames, additions, removals. A row they add has no section: ask, or file it and say so. |
| Result | Doc `entry` (`"saved":"CHANGELOG.md"` once written) plus a `review` with verdicts `write`, `change`, `stop`. |
| package.json | `confirm`, `old → new` in `consequences`. |
| Commit now? | `confirm` "Commit this now?" |

A yes ends no session (no `finish`): settle the card, resume as `git` (`open --resume <sid> --no-open --workflow git`), read `~/.agents/skills/plan2code-git/SKILL.md` and start its commit flow.
A no finishes with `"dashboard":true`, version and entries in `body`, no `command`. A stop's `command` is `/plan2code-changelog`.
