# Git

Launched from the dashboard or a hand-off: resume the session. The main column is the git board, from `state.git`. **Never post `git`** (exit 3). Your cards sit in the board's card slot.

A click arrives as one session action per send, and the board locks until your next post lands:

```jsonc
{"reply":"Create feature/export-csv from origin/main.","session":[{"i":"__git","op":"create","name":"feature/export-csv","from":"origin/main","then":"commit","files":["src/a.js"],"ignore":["dist/"]}]}
```

| `op` | Fields |
| --- | --- |
| `refresh`, `pull`, `push`, `abort`, `continue`, `done` | none (`refresh` with no remote: `plan refresh` gives no commands, just post `reread`) |
| `publish` | `remote?` (absent with several: `plan publish` asks) |
| `switch`, `delete` | `branch` (remote-only row is `<remote>/<name>`) |
| `create` | `name`, `from`; `then:"commit"` with `files` (and `ignore`) from the commit panel's branch offer |
| `cleanup` | `branches[]` |
| `commit` | `files[]`, `ignore[]` (folders for `.gitignore`). `files[]` may be empty when `ignore[]` is not (held-back offer): add the paths to `.gitignore` and commit only `.gitignore`. |
| `pr-host` | `host`, `kind` (already saved by `POST /pr-host`) |

**After an action**, ONE post with `--wait`:

```jsonc
{"reread":true,"items":[{"id":"git-result","kind":"notice","title":"Pushed 2 commits to origin/feature/x","body":"a1b2c3d, e4f5a6b. [Open pull request](https://github.com/...)"}],"board":{"describe":"export-csv-button"}}
```

- `reread` is `true`, or `{"refreshFailed":true}` after a failed Refresh. Only with the `git` workflow, else exit 3.
- `git-result` is one `notice` replaced every action: what happened, short hashes, the `pr-url` link after a push or publish. A failure quotes git's stderr verbatim with `classify-error`'s `next`.
- `board.describe`: short kebab-case description of the changes still on the tree (prefills Create); leave out when none remain.

**Cards per `plan`** (`git.mjs plan <op>`):

| `plan` says | On the page |
| --- | --- |
| `confirm` | `confirm` with `title`, `body`, `danger`, `consequences` verbatim; named files as `files:[{"path","state"}]`. |
| `card.kind:"switch"` | `choice` "Bring your changes?", exactly the given `options`: **Switch and bring them** (`bring`), **Commit first** (`commit-first`), **Cancel** (`cancel`); files in `body`, `reason` when git refuses (no `bring` then). `allowOther:false`. |
| `card.kind:"dirty"` | Same `choice`, **Commit first** / **Cancel**, `reason` in `body`. |
| `card.kind:"remote"` | `choice` "Publish to which remote?", one option per remote, `preset` recommended; then `plan publish --remote <it>` and its `confirm`. |
| `ask:false` | No card: run on the click. |
| exit 4 or 5 | Nothing run: `message` and `next` as the `git-result` notice. |

An `auth` failure: a `notice` saying the tool never handles logins, with `next`.

| Commit step | On the page |
| --- | --- |
| One commit | `text` card, `placeholder` the drafted subject, `pattern` capping it at 100 characters, then `confirm` "Commit this?" with files in `consequences` and `files:[{"path","state"}]` (modified, new, deleted, renamed). No card when the subject was the argument. |
| A split | Doc `commits` (each group's subject and files, files mixing concerns) plus `review` with verdicts `approve`, `change`, `single` ("One commit instead"). Asked even with a subject argument. |
| Push | Not asked after a board commit (the board lights Push). `commit and push` or a Push click asks `plan push` / `plan publish`'s `confirm`. |
| `git init` | `confirm` naming folder and first branch (`init-check`'s `branch`, `danger:false`), `consequences` its `commands`. Run those, not a bare `git init`. |
| `.gitignore` | The proposed file, or a `commit`'s `ignore[]` lines, as a doc plus `review`. |

Risky files (`sensitive`, `large`) go in the card's `body`. There is no branch-offer card: the commit panel's **You're on main** asks, answered as `create` with `then:"commit"`.

**Conflict help.** A pull, rebase or merge stopped on conflicts: `choice` "Resolve them for me?": **Yes**, **I'll fix it**, **Abort pull**. On yes, each stop is doc `conflict` (replaced per stop: step N of M, the commit replayed, each file with a one-line reason, per-file diff) plus a `review` with a fresh id per stop, `"nothingYet":false`, verdicts `continue`, `change`, `abort` ("Abort pull", `danger`). Only **Continue** runs `plan continue`'s commands; **Abort pull** runs `plan abort`. A file you cannot resolve confidently keeps its markers, as does **I'll fix it**. A `continue` click from the board's banner means the files are fixed: run `plan continue`; on exit 5 (markers left) post a `reread` with its `message` as the `git-result`. End with a `notice` summary (commits replayed, each resolved file with its reason, "N commits ready to push").

**Meter.** Post `run:{"event":"git-commits","id":"<first short hash>","commits":N}` after each commit step, and `run:{"event":"git-conflict","id":"conflict-<n>"}` once per conflict help.

**Finishing.** **Done with git** is `op:"done"`. A `done` while one of your cards is open cancels it: record it `{"items":[{"id":"<id>","status":"answered","answer":{"text":"Canceled by Done with git"}}]}` (not `settle`) in the finish post, or, with nothing done, before resuming as the dashboard. Never run what that card asked. Something done: `finish` with a headline and the commits (hashes), pushes and branches created or deleted in `body`, no `command`, `"dashboard":true`. Nothing done: no finish screen; resume as `dashboard` (`open --resume <sid> --no-open --workflow dashboard`), read `~/.agents/skills/plan2code/SKILL.md`, post its `menu` with `--wait`, carry on from "Coming back from another skill". A stop's finish is a pause, "Paused ...", bare `/plan2code-git`.
