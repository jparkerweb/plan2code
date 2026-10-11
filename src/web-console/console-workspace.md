# The Workspace on the Web Console

Part of the web console contract (`console.md`). Read when `open` lists more
than one folder, a `Workspace:` line arrives, or someone writes `@name`.

The person can add folders beside the one the session started in (a shared
library, a design folder), from the footer's folder label. Together they are
the session's **workspace**: context for every skill run in this console
session, each folder addressed by a short `@name`. It outlives dashboard hops,
and it is remembered: every change is saved to `workspaces.json` beside
`looks.json` (never into the project), keyed by the folder the session runs
in and then by spec. A session with a spec opens on that spec's list, one with
none on the project's; a spec with nothing saved starts as a copy of the
project's list. The dashboard's picker swaps the list as the selection moves,
and a `specDir` you post mid-run takes the current list with it. There is
nothing for you to load: `open` prints the list, and a switch of spec on a
resume reaches you as ordinary workspace changes on your next `wait`.

## What you are told

`open` (fresh or `--resume`) prints the whole list under `workspace`:

```jsonc
{ "ok": true, "sid": "…", "url": "…",
  "workspace": {
    "folders": [
      { "name": "shop", "path": "/home/sam/code/shop", "original": true },
      { "name": "shared", "path": "/home/sam/code/shared-ui", "description": "Button and form styles" }
    ],
    "missing": ["old-docs"]
  } }
```

`missing` (only when there is one) names folders no longer on disk. After
`open`, you hear only of changes, each exactly once:

- `wait` exit `0` carries them beside a send or chat as `workspace: [...]`
  (`{ kind, name, path, description?, from? }`, `kind` one of `added`,
  `renamed`, `described`, `removed`, `missing`, `found`), with one
  `Workspace: …` line each at the end of `reply`
  (`Workspace: added @shared — /home/sam/code/shared-ui`). A change alone never
  ends a slice: exit `10` counts it as `pendingWorkspace` and it rides on the
  next send.
- `chat` hands changes over at once, with or without a Quick question, as
  `{ chat, workspace, reply }`.

Act on a change in the same turn it arrives: drop a removed folder, use the
new name after a rename, note a missing one. No reply is needed unless the
person asked something.

## Rules

- **Resolve `@name` from the workspace list.** `@shared` in an answer, a note
  or a Quick question means that folder's `path`. An `@name` not in the list
  is ordinary text.
- **Added folders are read-only reference.** Read them freely; edit one only
  when the person asks for that change in this conversation. Chat edits still
  need approval (`console-chat.md` → Edits need approval first).
- **Read an added folder's `AGENTS.md` before you first use it** (`CLAUDE.md`
  when there is no `AGENTS.md`), once per folder per skill run. It says how
  that folder is laid out; the original folder's `AGENTS.md` still governs
  this project and the work.

## When a folder cannot be read

When a read of an added folder genuinely fails (refused, not found), post, once
per folder:

```jsonc
{ "folderIssue": { "name": "shared", "reason": "Permission was refused", "hint": "/add-dir /home/sam/code/shared-ui" } }
```

and print one terminal line saying which folder and why. The page marks the
folder and tells the person once. `hint` is optional: an agent that knows it
is Claude Code puts `/add-dir <path>` there. Your harness asking the person
for permission is not a failure; report only a read that failed after it.

A `folderIssue` needs non-empty `name` and `reason` strings, and `hint`, when
present, is one too; anything else is exit `3`. It goes to the session's
ledger, never into the page state.
