# The Workspace

The console points here when a `Workspace:` change arrives. Read it also when `open` lists more than one folder or someone writes `@name`.

The person can add folders beside the one the session started in (a shared library, a design folder). Together they are the session's workspace: context for every skill run in it, each folder addressed by a short `@name`. It follows dashboard hops. There is nothing to load: `open` prints the list, and a spec switch on a resume reaches you as ordinary changes.

## What you are told

`open` prints `workspace` when it holds more than the folder you started in: `{"folders":[{"name":"shop","path":"/home/sam/code/shop","original":true},{"name":"shared","path":"/home/sam/code/shared-ui","description":"Button and form styles"}],"missing":["old-docs"]}` (`missing` only when a folder is no longer on disk).

After `open`, you hear only of changes, each once, as `Workspace:` lines last in `reply` of `wait` exit 0 or `chat`: `Workspace: added @shared`, then the folder path. The kinds are added, renamed, described, removed, missing and found. A change alone never ends a slice. Act on it in the same turn: drop a removed folder, use a new name, note a missing one. No reply is needed unless they asked something.

## Rules

- Resolve `@name` from the list: `@shared` in an answer, note or Quick question means that folder's `path`. An `@name` not in the list is ordinary text.
- Added folders are read-only reference. Edit one only when they ask for that change in this conversation (chat edits still need approval, `console-chat.md`).
- Read an added folder's `AGENTS.md` (`CLAUDE.md` without one) before first using it, once per folder per skill run. The original folder's `AGENTS.md` still governs the project.

## A folder you cannot read

When a read of an added folder fails (refused, not found), post once per folder, and print one terminal line saying which and why:

`{"folderIssue":{"name":"shared","reason":"Permission was refused","hint":"/add-dir /home/sam/code/shared-ui"}}`

`name` and `reason` are required non-empty strings; `hint` is optional (Claude Code: `/add-dir <path>`). Your harness asking the person for permission is not a failure; report only a read that failed after it.
