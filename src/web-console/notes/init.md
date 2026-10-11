# Init and Init Update on the Web Console

Workflow notes for `init` and `init-update`, part of the web console contract
(`console.md`).

Setup conversations: every confirmation and Q&A item goes through the page.
For `init` and `init-update` the finished AGENTS.md also lands as a doc so a
browser-only person can read what was written — marked `"saved": "AGENTS.md"`,
since the file itself is already on disk (or as a `file` block:
`{ "id": "body", "file": "AGENTS.md" }`, instead of pasting it). A completed run
finishes with **no** `command`: the page shows the "All done" line. Nothing is
on disk to resume mid-run, so a stop's finish command is the bare
`/plan2code-init` or `/plan2code-init-update` — the skill starts over
either way.
