# Git on the Web Console

Workflow notes for `git`, part of the web console contract (`console.md`).

Open with `--workflow git` (launched from the dashboard, or by a **Commit it
now** or Changelog hand-off: resume the session instead). Like the dashboard,
the main column is drawn by the page itself: the git board, from `state.git`,
which `open` and every `reread` snapshot through `git-repo.mjs`. **You never
post `git`** (exit 3: `state.git` is the console's own). Your cards sit in
the board's card slot, under its tab strip.

**A click** arrives as one session action, one per send, and the board locks
until your next post lands:

```jsonc
{ "type": "submit",
  "actions": [{ "i": "__git", "type": "git", "op": "create",
                "name": "feature/export-csv", "from": "origin/main",
                "then": "commit", "files": ["src/a.js"], "ignore": ["dist/"] }],
  "reply": "Create feature/export-csv from origin/main. ..." }
```

| `op` | Fields |
| --- | --- |
| `refresh`, `pull`, `push`, `abort`, `continue`, `done` | none (a `refresh` with no remote is "look again": `plan refresh` gives no commands, so just post `reread`) |
| `publish` | `remote?` (left out when there are several: `plan publish` asks which) |
| `switch`, `delete` | `branch` (a remote-only row is `<remote>/<name>`) |
| `create` | `name`, `from`; `then: "commit"` with `files` (and `ignore`, when any) when it came from the commit panel's branch offer |
| `cleanup` | `branches[]` |
| `commit` | `files[]` (paths and untracked folders), `ignore[]` (folders to add to `.gitignore`). `files[]` may be empty when `ignore[]` is not: the board's held-back offer (**Add … to .gitignore**). Then add the paths to `.gitignore` and commit only `.gitignore`. |
| `pr-host` | `host`, `kind` (already saved by the page's `POST /pr-host`) |

`reply` is the plain instruction the terminal would get, so it reads like any
answer. `__git` names no question, like `__stop`.

**After an action**, in ONE post (with `--wait`):

```jsonc
{ "reread": true,
  "items": [{ "id": "git-result", "kind": "notice", "status": "open",
              "title": "Pushed 2 commits to origin/feature/x",
              "body": "a1b2c3d, e4f5a6b. [Open pull request](https://github.com/...)" }],
  "board": { "describe": "export-csv-button" } }
```

- `reread` is `true`, or `{ "refreshFailed": true }` after a Refresh that
  failed (the board then says so beside the last refreshed time and keeps the
  last data). It goes only with the `git` workflow; anywhere else, or in any
  other shape, it is exit `3`. The console takes the snapshot inside the same
  locked write as your cards, so the result line and the fresh board land
  together.
- `git-result` is a `notice` replaced every action (same id). The board shows
  it under its header, not in the card slot: what happened, with short hashes
  and, after a push or publish, the `pr-url` link. On a failure it quotes
  git's stderr verbatim with `classify-error`'s `next`.
- `board.describe` is yours: a short kebab-case description of the changes
  still on the tree, which the Create prompt pre-fills. Post it with the
  reread whenever changes remain; leave it out otherwise.
- The board is the person's to click whenever you wait, so `wait` hands the
  turn back by itself; no `agent` status is needed.

**Cards per `plan`.** `git.mjs plan <op>` decides whether to ask:

| `plan` says | On the page |
| --- | --- |
| `confirm` | A `confirm` card with its `title`, `body`, `danger` and `consequences` verbatim (the consequences end with the exact command). Where the plan names files, add them as `files: [{ "path", "state" }]`. |
| `card.kind: "switch"` | A `choice`, "Bring your changes?": exactly the `options` given, labelled **Switch and bring them** (`bring`), **Commit first** (`commit-first`), **Cancel** (`cancel`); the files in `body`, and `reason` when git would refuse (then there is no `bring`). `allowOther: false`. |
| `card.kind: "dirty"` | The same `choice` for a pull that needs a clean tree: **Commit first** / **Cancel**, `reason` in `body`. |
| `card.kind: "remote"` | A `choice`, "Publish to which remote?": one option per remote, `preset` recommended. Then `plan publish --remote <it>` and its `confirm`. |
| `ask: false` | No card: run it on the click. |
| exit 4 or 5 | No card and nothing run: the `message` and `next` as the `git-result` notice. |

An `auth` failure gets a `notice` card saying the tool never handles logins,
with `next`. The commit flow's own cards (message, groups, `git init`,
`.gitignore`) are the rows below.

| Commit step | On the page |
| --- | --- |
| One commit | A `text` card whose `placeholder` is the drafted subject and whose `pattern` caps it at 100 characters, then a `confirm` "Commit this?" with the files in `consequences` and, as `files: [{ "path": "src/a.js", "state": "modified" }]` (states: modified, new, deleted, renamed), a collapsed **Show the N files** table on the card. With the subject given as the argument there is no card. |
| A split | The groups as a doc (`id: "commits"`: each group's subject and files, and any file that mixes concerns) plus a `review` card with verdicts `approve`, `change` and `single` ("One commit instead"). Asked even when the subject came as the argument. |
| Push | Not asked after a commit on the board: the board lights Push. `commit and push` (or a Push click) asks `plan push` / `plan publish`'s `confirm`. |
| `git init` | A `confirm` naming the folder and its first branch (`init-check`'s `branch`, `danger: false`), its `consequences` `init-check`'s `commands`. Run those, not a bare `git init`. |
| `.gitignore` | The proposed file, or the lines a `commit`'s `ignore[]` adds, as a doc plus a `review` card. |

Risky files (`sensitive`, `large`) are named in the card's `body`. On the
board there is no branch-offer card: the commit panel's **You're on main**
line asks it, and the answer arrives as `create` with `then: "commit"`.

**Conflict help.** A pull, rebase or merge stopped on conflicts asks first, a
`choice` "Resolve them for me?": **Yes**, **I'll fix it**, **Abort pull**.
On yes, every stop is a doc (`id: "conflict"`, replaced per stop, its version moving by itself: step N of M,
the commit being replayed, each file with a one-line reason, then a per-file
diff) plus a `review` card, fresh id per stop, `"nothingYet": false` (the resolution is already on disk), with the verdicts `continue`
("Continue"), `change` ("Change it") and `abort` ("Abort pull", `danger`).
Only **Continue** runs `plan continue`'s commands; **Abort pull** runs
`plan abort` and the board is back on the exact original HEAD. A file you
cannot resolve with confidence is named and left with its markers; **I'll fix
it** leaves the markers too. The board's banner always offers Continue: a
`continue` click is the person saying the files are fixed, so run `plan
continue`; when it refuses (exit 5, markers left), post a `reread` with its
`message` as the `git-result` notice, which also refreshes the banner's file
list. Nothing is pushed during conflict help. At the end, a `notice`
summary (commits replayed, each resolved file with its reason, "N commits
ready to push").

**Meter events** (`console-meter.md`). Git scores on launch.
Post `run: { "event": "git-commits", "id": "<first short hash>", "commits": N }`
after each commit step (N commits made), and `run: { "event": "git-conflict",
"id": "conflict-<n>" }` once per conflict help, resolved or aborted.

**Finishing** (`console-finish.md`). **Done with git** (`op: "done"`). A `done`
that arrives while one of your cards is still open is the person cancelling it:
record that card as cancelled (`{ "items": [{ "id": "<id>", "status":
"answered", "answer": { "text": "Cancelled by Done with git" } }] }`, not
`settle`, which refuses a card nothing was sent to) in the same post as the
finish, or, with nothing done, before resuming as the dashboard. Never run what
the card was asking for. With something done this session: a `finish` with a
headline, the commits with hashes, pushes and branches created or deleted in
`body`, no `command`, and `"dashboard": true`; keep waiting for the press. Done
with nothing done: no finish screen — resume as `dashboard` at once (`open
--resume <sid> --no-open --workflow dashboard`), read the dashboard skill
(`~/.agents/skills/plan2code/SKILL.md`), post its `menu` with `--wait` and
carry on from its "Coming back from another skill". A stop's finish is a pause,
headline "Paused …", the bare `/plan2code-git`, then `stop`.
