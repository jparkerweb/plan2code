# The web console, inside

For people who change the console or drive it by hand: how it works, the security model, every route, and how to refresh the screenshots. Using the console? Read [the web console guide](web-console.md) instead.

## How it works

Nothing is installed. The skills ship a small zero-dependency Node server
(`references/web-console/`), and the workflow step starts it when you say yes.

```
agent                          server (detached)              your browser
  |                                  |                             |
  |-- open (binds the port, starts ->|                             |
  |   the server AND the browser) ---|---------------------------->|
  |<-- http://127.0.0.1:PORT/s/TOK/  |<---- the page, first state -|
  |                                  |      already inside it      |
  |-- post the first questions ----->|---- pushed to the page ---->|
  |-- wait --seconds 240 ----------->|                             |
  |   (returns every 4 minutes with  |                             |
  |    progress, then waits again)   |<---- you press Send --------|
  |<-- your answers -----------------|                             |
```

The server runs detached rather than as a background task of the agent, because
agent background tasks get killed at various timeouts, and that would take your
half-finished answers with them.

**It is built to show you something fast.** A browser takes most of a second to
turn up after it is asked, so `open` binds the page's port itself and sends the
browser there before the server has even finished starting; the server takes
the port over a moment later, and the browser's request waits for it rather
than being refused. The page arrives with the session already inside it, so it
draws the real screen without asking for anything first, in your own theme and
colors from the first frame. On a Windows laptop the page is in front of you in
roughly the time the browser itself takes to open.

**It stays up while the page is open.** The page pings it every few seconds, so
the idle clock never runs down while you are there. Close the tab and it shuts
itself down about two minutes later; it stops after four hours unless answers
you sent are still waiting for the agent, and the agent stops it outright when
the session ends.

**The setup session hands its tab to the agent it finds.** A `setup` session is
agent-less: nothing reads its sends, so the page's agent-silence and question
rules are switched off and only the idle deadline ends it. The `plan2code`
launcher started the session and polls it for a pick; **Start with this agent**
posts an `__start` action the launcher collects, and it spawns that agent with
two environment variables, `PLAN2CODE_SETUP_ANNOUNCE` (the setup server's
address) and `PLAN2CODE_SETUP_TOKEN` (a per-session token). The new agent's own
`open` then POSTs its sign-in URL to `POST /handover` on the setup server
instead of opening a browser; the token guards the route, the setup page gets a
`move` event on its `/events` stream carrying the URL, and the tab follows it
onto the new session. Inside the desktop app none of this runs: `open` finds no
setup variables (the launcher scrubs the app ones from the setup console it
starts), the page tells the app `agent-found` instead, and the app closes the
setup page and picks the agent itself.

That also means **the server routinely outlives the agent**. It is the agent, not
the server, that reads your answers, and the two fail separately. The page tells
the two apart: the **?** button at the top right opens Help, whose *What this
page is* tab says which halves are talking right now (and *When something
looks stuck* covers what to check), and Planny stops looking busy once
nothing is listening rather than spinning at you indefinitely.

**State lives in three places**, and none of them is your repository (the one
exception being the note attachments the agent keeps for a spec, above):

| Where | What | Survives |
| --- | --- | --- |
| `~/.plan2code/console/sessions/<id>/` | the questions, your draft, your answers | 30 days after the session was last touched |
| `~/.plan2code/console/sessions/<id>/workspace.json`, `ledger.ndjson`, `workspace-cursor.json` | the workspace's folders (paths, names, descriptions — never their contents), the session meter's events, and how far the agent has been told of workspace changes. Kept beside the session, so they outlive every dashboard hop | with the session |
| `~/.plan2code/console/sessions/<id>/uploads/` | images and documents attached to notes and quick questions | 30 days after the session was last touched |
| `~/.plan2code/handoffs/<id>.md`, `<id>.json` | each handoff's document, and which checkout, spec and skill it belongs to and whether it was picked up (`handoffs.mjs` is their one owner) | 30 days after it was last touched, picked up or not |
| `~/.plan2code/notepads/<folder-name>-<12 hex>/` | your notebook for one folder: `meta.json`, `tabs.json` and, per tab, `tabs/<id>/note.md` and `tabs/<id>/images/` (`notepads.mjs` is their one owner; the agent never reads them, except a tab you send) | until you delete it through Cleanup, which offers it once its newest file is 30 days old |
| `~/.plan2code/console/looks.json` | your role, theme, colors, sounds and card width, the Show Activities and Play activity sounds switches (`hideActivities`, `activitySounds`), the last activity picked (`lastActivity`), best scores (flat `activityBest<Id>` keys: `activityBestSnake`, one per Mini golf course from `activityBestGolfPirate` to `activityBestGolfFrost`, `activityBestTrails`, `activityBestBugs`, `activityBestDrive`, `activityBestStack`, `activityBestBumper`, `activityBestRapids`, `activityBestFuse`, `activityBestHop`, `activityBestBounce`, `activityBestGhoul`, `activityBestFlock`) and each game's memo (`activityMemo<Id>`: Snake's surprises found, Light Trails' furthest arena, Bug Hunt's bugs, bosses and power-ups found, Sunset Drive's roads found, Stack Deploy's highest floor, Bumper Ring's furthest arena, Rapids Run's furthest dam, Hot Potato's furthest venue, Crossing Rush's furthest zone, Bounce Road's furthest stage, Ghoul Rush's most stages cleared in a run, Flock Dash's furthest stage) | always |
| `~/.plan2code/console/subagents.json` | your Subagents switch, instruction and limit, per project folder and skill | always |
| `~/.plan2code/console/sessions/<id>/subagents-setting.json`, `subagents-cursor.json` | this session's copy of the switch, and how far the agent has been told of it | with the session |
| `~/.plan2code/agents.json` | your custom agent CLIs (User Preferences → Agents & models), read by the `plan2code` command and the desktop app | always |
| your system temp directory | the port, process id and session token | until reboot |

Each of the workspace and meter files has exactly one writer: the server owns
`workspace.json` (the page changes it only through the `/workspace` routes
under Security), and `console.mjs` owns `ledger.ndjson` and
`workspace-cursor.json`. The meter's count is never stored; it is folded from
the ledger every time (`public/meter.js`), so a repeated `post` never counts
twice. The logic lives in small pure modules the tests import directly —
`public/workspace.js` (names, the footer label, the change lines the agent
reads), `public/meter.js` and `public/mentions.js` (the `@name` popover) — and
**Browse…** runs the per-OS picker in `picker.mjs`, copied from the
`plan2code` launcher and kept in step with it by a test.

**Old sessions clean themselves up.** Each time a session opens, whole session
folders nobody has touched for 30 days are deleted — questions, drafts,
answers, uploads and all, paused or not — along with stray scratch files
(`.json` / `.mjs`) left at the top of `~/.plan2code/console/` for as long, and
handoffs in `~/.plan2code/handoffs/` untouched for as long, both files each.
Your `looks.json` and the `console-dir` pointer are never touched, and neither
is the session being opened. Nothing of value goes with them: the page is
never the record, `specs/` in your project is.

**Or clean up on demand.** *User Preferences → System → Cleanup* → **Find files to
clean up** lists, with sizes, everything in `~/.plan2code/` that is not
needed: sessions untouched for 30 days (never the one you are in), anything at
the top of `~/.plan2code/console/` other than `sessions/`, `runtime/`,
`looks.json`, `workspaces.json`, `loop-setup.json`, `loop-reports.json`,
`subagents.json`, `pr-hosts.json`, `console-dir` and `update-check.json`, and
anything at the top of `~/.plan2code/` other than `console/`, `bin/`,
`launcher.json`, `install.json` (what you installed, which `plan2code update`
reads), `models.json`, `handoffs/` (old handoffs go by age, above),
`notepads/`, `app/` and `app.json` (the desktop app and its settings) and
`agents.json` (your custom agents). Each notebook whose newest file is 30 days old or
more is listed as one item, *Notebook for* its folder, and goes whole; no
automatic sweep ever removes one. It also lists each
folder in the project's `specs--completed/` whose newest file is more than 30
days old: archived specs Finalize moved there. Only a folder git tracks is
deleted: `specs--completed/` is usually gitignored, so git couldn't restore
it, and Cleanup keeps it and says why instead. A stray is listed once
it has sat untouched for an hour, so a lock or temp file another session is
writing right now is never caught. **Delete N items** removes
only the rows you left ticked. A console running from another home
(`PLAN2CODE_CONSOLE_HOME`) only ever looks inside that home.

---

## Security

It is a local dev server that reads files in your project (never writing to it)
and keeps its own state in your home folder, so it is built to be boring about
this:

- Bound to `127.0.0.1` only, never `0.0.0.0`. Not reachable from your network.
- A `Host` header allow-list, which is what stops a website you happen to be
  visiting from talking to it through a DNS rebinding trick.
- A 128-bit token in the link, swapped for an `HttpOnly; SameSite=Strict` cookie
  on first load so it leaves your address bar, your history and any screenshot.
- A strict Content Security Policy with no inline script allowed.
- Markdown written by the agent is turned into page elements directly and never
  into an HTML string, so a document that quotes a hostile README cannot run
  anything. It shows up as text, which is what it is.
- Uploads are named by the server (`<uuid>.jpg`, or `<uuid>.<ext>` with the
  extension taken from the allow-list, via `crypto.randomUUID()`), never by the
  file name you sent, and live only under the session's own `uploads/`. The
  server checks the bytes: a JPEG header for images (4 MB cap), and for
  documents a `%PDF-` header or strict UTF-8 with no NUL byte (10 MB cap).
  Documents are served back only under a fixed type (`application/pdf`, or
  `text/plain` for text and code) with `nosniff` (and `sandbox` on text), so
  the Sent box can link them. A send may only point at
  uploads inside that session's `uploads/`, images in `images` and documents
  in `files`.

### Routes

The upload routes, the send, the overview and handoff reads, the workspace and the notebook. Like every page route, they are on `127.0.0.1`
behind the session cookie, and the ones that write also check the request's
origin.

| Route | Does |
| --- | --- |
| `POST /upload` | Raw bytes, original name in `x-p2c-name`. `Content-Type: image/jpeg`: writes `uploads/<uuid>.jpg` and answers `{ ok, id, kind: "image", path, url, name, size }`; not a JPEG → 415, over 4 MB → 413. `Content-Type: application/octet-stream`: a document, its extension from the name's allow-listed extension; writes `uploads/<uuid>.<ext>` and answers `{ ok, id, kind: "file", path, name, size }` with no `url`; not an allowed extension or contents that do not match → 415 `type`, over 10 MB → 413. Any other content type → 415. |
| `GET /uploads/<id>.<ext>` | Serves an upload: an image as `image/jpeg` (the thumbnail after a reload), a document as `application/pdf` or `text/plain; charset=utf-8` with `nosniff` and, on text, `Content-Security-Policy: sandbox`. Only `<uuid>.<allowed ext>` names under `uploads/`; anything else is 404. |
| `DELETE /uploads/<id>.<ext>` | Deletes an image or document removed before sending. 204, or 404 if it is not there. |
| `POST /submit` | The Send. A note may carry `images` and `files`, each `[{ path, name }]`: at most 5 together, images in `images` and documents in `files`, every path inside this session's `uploads/`, otherwise 400. |
| `POST /chat` | A Quick question `{ text, about?, images?, files?, conversation }`, or `{ reset: true, conversation }` for New conversation. Appended to the session's `chat.ndjson`. 400 `too-long` (over 4,000 characters), `image`, `file` or `bad`; 409 `offline`, `stale` or `limit` (10 per conversation). Never refused because a card send is still uncollected. |
| `POST /chat/decision` | Approve or Decline on an edit the agent proposed: `{ re, decision, text?, conversation }`. Once per proposal; does not count toward the 10. |
| `GET /overview?spec=specs/<name>[&file=map\|draft]` | The Overview tab's read of `<spec>/overview.md` (or, with `file=`, the Map tab's `pathfinder/map.md` or the Plan draft tab's live `PLAN-DRAFT-*.md`), as `text/markdown` with `cache-control: no-store` and the file's spec-relative name, URL-encoded, in `x-spec-file`. A missing file is a 204. On the dashboard `spec` must be one of the scanned specs; elsewhere the session's own spec is used. The file's real path must stay inside the project, so `../`, absolute paths and symlinks pointing out all get the same 204 as a missing file, as does an unscanned `spec` or an unknown `file`. |
| `GET /agents-doc[?file=<name>]` | The Dashboard's AGENTS.md tab: `AGENTS.md` (the default) or one `.agents-docs/<name>.md`, as `text/markdown` with `cache-control: no-store`. A dashboard only; any other file name, a missing file or a path that leaves the project is a 204. |
| `GET /prototypes?spec=specs/<name>` | The Prototypes tab's list: `{ files: [{ name, kind }] }` (`kind` `md` or `html`) for the files directly in `<spec>/prototypes/`, or a 204 when there are none. The spec is chosen as for `/overview`. |
| `GET /prototype?spec=specs/<name>&name=<file>.md` | One `.md` from `<spec>/prototypes/`, as `text/markdown` with `cache-control: no-store`; any other name, a missing file or a path that leaves the folder is a 204. |
| `POST /open-prototype` | `{ spec, name }`: opens one `.html` from `<spec>/prototypes/` in the person's default browser. 404 for any other name, 500 when no browser could start. |
| `GET /handoff?id=<id>` | *Read it all*: the handoff's `.md` from `~/.plan2code/handoffs/`, as `text/markdown` with `cache-control: no-store`. A dashboard only, and only an id its own scan listed: a used, unknown or malformed id is 404. |
| `POST /learning/pause` | Pause for me: `{ paused: boolean }` (origin-checked; anything else is 400 `bad-request`, and 409 `not-on` unless Learning is On or Paused for you). Writes the personal pause on this machine only (`pause.json` under `~/.plan2code/learning/<key>/`), the server's only write for Learning, and repaints the row with no agent. |
| `GET /learning/state` | The Learning row's state worked out now, `{ state, pausedSince, waiting, oldestDays }` (`{}` when the project's settings file is from a format it cannot read), with `cache-control: no-store`. |
| `GET /learning/lessons` | Open the lessons, read only: `{ files: [{ name, title, text }] }` from the project's lessons (`.plan2code/lessons/`, saved with the repository), `general.md` first, then the other `.md` files in name order (plain files only, at most 100 of 512 KB each), with `cache-control: no-store`. |
| `GET /workspace` | The Workspace dialog's list: folders, `missing`, `remote` and the agent's folder `issues`. `?check=1` re-checks every folder on disk first. |
| `POST /workspace/add` | `{ path, name?, description? }`. The path is resolved against the folder the session started in (`~` expanded) and must be a folder: 400 `not-a-folder`, `duplicate` (with its `name`; compared case-insensitively on Windows and macOS), `bad-name`, or `name-taken` with a `suggest`. Answers the new entry, `nested: true` when it sits inside another folder in the list. |
| `POST /workspace/edit` | `{ id, name?, description? }`. Renames or re-describes one folder: 400 `bad-name` / `name-taken`, 404 `unknown`. |
| `POST /workspace/remove` | `{ id }`. 400 `original` for the folder the session started in, 404 `unknown`. |
| `POST /workspace/browse` | Opens the system folder picker and answers `{ path }` or `{ cancelled: true }`; never adds anything itself. 409 `busy` while one is open, 404 `no-picker` when the session looks remote or no picker exists. |
| `GET /notepad[?tab=<id>]` | The notepad for the folder this session runs in: `{ tabs: [{ id, name, sent? }], last, tab: { id, text, savedAt, images: [{ id, url, thumb }] } | null }`, with the tab's `text`, `savedAt` and `images` repeated at the top. Without `tab` it answers the last one used; 404 `no-such-tab` for an id it does not have. A notepad in the first shape answers one virtual tab, Notes. Reading never creates or moves a file. |
| `POST /notepad/text?tab=<id>` | `{ text }`. Saves that tab's `note.md` and answers `{ ok, savedAt }`; 400 `bad`, 404 `no-such-tab`, 413 `too-long` (over 1 MB). |
| `POST /notepad/image?tab=<id>` | Raw `image/jpeg` (the page re-encodes every picture first). Writes the tab's `images/<uuid>.jpg` and answers `{ ok, id, url }`; 415 `not-jpeg`, 413 `too-large` (over 4 MB), 409 `too-many` (200 pictures in the tab). |
| `POST /notepad/thumb?id=<uuid>&tab=<id>` | Raw `image/jpeg`: that picture's thumbnail. 404 `not-found` or `no-such-tab`, 415 `not-jpeg`, 413 `too-large`. |
| `POST /notepad/image/delete?tab=<id>` | `{ id }`. Deletes a picture and its thumbnail; 404 `not-found` or `no-such-tab`. |
| `POST /notepad/tab` | `{ name }`. Makes a tab, which becomes the last one used, and answers `{ ok, id, name }`; 400 `bad-name`, 409 `duplicate-name` (any case) or `too-many-tabs` (20). |
| `POST /notepad/tab/rename` | `{ id, name }`. Answers `{ ok, id, name }`; 400 `bad-name`, 404 `no-such-tab`, 409 `duplicate-name`. |
| `POST /notepad/tab/delete` | `{ id }`. Removes the tab from the index, then its folder (text and pictures); 404 `no-such-tab`. |
| `POST /notepad/tab/order` | `{ order: [id] }`, every current id exactly once; 400 `bad` otherwise. |
| `POST /notepad/tab/last` | `{ id }`. Remembers the open tab; 404 `no-such-tab`. |
| `POST /notepad/tab/sent` | `{ id, workflow, spec? }`. Records that the tab was sent (`workflow` one of `pathfinder`, `plan`, `quick-task`, `revise-plan`, `diagnose`, `ui-prototype`; `spec` like `specs/<name>`) as `sent: { workflow, spec?, at }` on its `tabs.json` entry, shown back in `GET /notepad`'s `tabs`. The page posts it only after the Send that carried the filled box; 400 `bad-sent`, 404 `no-such-tab`. |
| `GET /notepad/images/<tab>/<uuid>.jpg`, `<uuid>.thumb.jpg` | Serves a picture or its thumbnail as `image/jpeg`, only by a tab id and a UUID name, a regular file (never a link) whose real path stays inside `~/.plan2code/notepads/`; anything else is 404. |
| `POST /subagents` | `{ on, instruction, max }` (`instruction: null` for the shipped default). Saves the switch for this project and skill and answers `{ ok, setting }`; 400 `not-offered` on a skill without the switch, `bad`, `too-long` (over 2,000 characters) or `max` (outside 1 to 20). |
| `GET /agents` | The agents view's data: your custom agents and the shipped built-ins and templates, each entry merged with its lookup result `{ state, path, where, folder }`: `state` is `found` (on PATH), `outside` (saved Windows PATH, npm's global folder or an install folder) or `missing`, and `where` says which search found it. Built-ins carry their `install` lines for the server's OS only. |
| `POST /agents` | `{ agents, replace? }`. Saves the custom-agent list to `~/.plan2code/agents.json`, validated first (400 `{ error, index, field }`); 409 while the file holds entries `GET /agents` could not read, unless `replace: true`. |
| `POST /agents/test` | `{ command }`. Where a command would run from (`{ found, path }`), for the form's Test button; never runs it. |
| `POST /agents/use-path` | `{ id }`. "Use it from here": saves the location the lookup found off PATH as the agent's `command` (a built-in becomes a new custom entry; 404 unknown, 409 `not-found`). |
| `POST /handover` | Setup sessions only, and only with the session's setup token in `x-plan2code-token`: the new agent's `open` posts `{ url }` here, the server broadcasts a `move` event with it and the setup tab follows. 409 `moved` once it has happened. |

## For maintainers

| | |
| --- | --- |
| Source | `src/web-console/` (one row per file in the files tables of the `.agents-docs/AGENTS-architecture-*.md` area files; a test keeps it complete) |
| Ships as | `skills/<every skill>/references/web-console/` |
| Wiring | one `additionalReferences` entry per skill in `install.js`; the dashboard's menu lives in `public/skills.js` (each entry's `card`; `SKILL_CATALOG` in `public/answers.js` is a lookup on it) |
| Agent contract | a card, `src/web-console/console.md` (read once), plus pointers: the console names a topic file (`console-*.md`, `notes/<workflow>.md`, `building.md` / `building-review.md`) in its own `read` output, once per session per topic, when its moment comes; `console.mjs help <topic>` prints any of them. A `stop` with no `finish`, or a `finish` while `stopWarning` is set, is refused with the fix; `stop --session <sid> --force` ends a dead page or an abandoned session anyway. Patches are one line, with lettered options and the console's own defaults filled in; a refused patch names the field and the fix. Byte budgets keep the card, the notes and a sample session's outputs from growing back (`scripts/test-console-wire-budgets.mjs`) |
| Tests | `node --test scripts/test-web-console-*.mjs` (split by area, shared setup in `scripts/web-console-test-helpers.mjs`), also run by `npm test` |
| Start-up benchmark | `node scripts/bench-web-console.mjs` (needs a local Chrome or Edge for the paint columns, driven through `playwright-core` from `npm install`; `--browser-delay 900` models a real browser launch, `--roundtrip` times Send→agent and post→page) |
| Screenshots | `node scripts/capture-screenshots.mjs` (needs a local Chrome or Edge, driven through `playwright-core` from `npm install`; `PLAN2CODE_TEST_BROWSER=chrome|msedge` forces one) |
| Dependencies | none at runtime. `marked` 15.0.7 (MIT) is vendored for its lexer only, and CodeMirror 6 (MIT) for the notebook's editor as one bundled file, `public/vendor/codemirror.esm.js`, made by the dev-only `node scripts/vendor-codemirror.mjs` from a pinned lock (about 500 KB, loaded only when the Notebook is first opened); the page's policy blocks the `<style>` element CodeMirror writes, so the editor lives in a shadow root where it adopts its rules as a constructed stylesheet (steps in the architecture doc's Notebook point) |

Edit `src/` only. `skills/` is a committed build artifact: regenerate it with
`npm run build:skills` and commit it with the source change, since `npm test`
(via `--verify-skills`) fails when it drifts from `src/`.

### Driving it by hand

You do not need an agent to poke at the console. Point `PLAN2CODE_CONSOLE_HOME`
somewhere disposable first, so you never touch a real session:

```bash
export PLAN2CODE_CONSOLE_HOME=/tmp/p2c-play     # Windows: $env:PLAN2CODE_CONSOLE_HOME

cat > /tmp/payload.json <<'JSON'
{ "workflow": "pathfinder", "title": "Playing about",
  "items": [ { "id": "q1", "kind": "choice", "title": "Export format",
    "body": "Pick one.",
    "options": [ { "k": "A", "text": "CSV", "recommended": true },
                 { "k": "B", "text": "Excel" } ],
    "token": { "A": "a", "B": "b" } } ],
  "agent": { "status": "waiting" } }
JSON

node src/web-console/console.mjs open --file /tmp/payload.json   # prints the URL, opens the browser
node src/web-console/console.mjs wait --session <sid> --seconds 60
node src/web-console/console.mjs stop --all
```

`node src/web-console/console.mjs help` prints the same command summary an
agent gets when it finds the binary before the docs.

`wait` exits `0` with the answers, `10` if nobody has finished yet, `20` if the
server died, `30` on Cancel. Pick `--seconds` to sit under whatever your harness
allows a single command: it is a poller, so killing it costs nothing, and a
collected result is printed before it is marked collected, which means an
interrupted handover can only repeat itself, never lose an answer. `status`
lists sessions and flags any whose answers were submitted but never collected.

When something misbehaves, the session directory is the whole story:
`state.json` (what the agent published), `draft.json` (what the person has typed
but not sent), `result.json` (what they sent), `events.ndjson` (an append-only
log you can `cat`), and `server.log`.

Set `--idle-ms 60000` on `open` if you want the server to shut itself down
quickly while experimenting.

Two environment variables help when the start is what you are looking at:

| Variable | Does |
| --- | --- |
| `PLAN2CODE_CONSOLE_TRACE=1` | `open` prints a timeline of its steps to stderr (roots found, server spawned, port bound, browser sent, state written, server listening). |
| `PLAN2CODE_BROWSER` | The command that opens the link instead of the system default, run through the shell with the link appended, e.g. `PLAN2CODE_BROWSER='firefox --new-tab'`. |

Every `console.mjs open` of an installed console (one run from a version folder
under `~/.plan2code/console/`) also writes its own directory to
`$PLAN2CODE_CONSOLE_HOME/console-dir` (or `~/.plan2code/console/console-dir`
when the override is unset): it is how an agent finds the console on a later
session without searching the skill install dirs. A console run from a source
checkout leaves the pointer alone.

The vendored file is `src/web-console/public/vendor/marked.esm.js`,
sha256 `7a7d9a521ac9384e0c3a075120a7c486cbd0c3c32cc5601bbb79a23e97403690`.
Only `marked.lexer()` is used; the rendering is ours, in `public/render.js`, and
builds DOM nodes rather than HTML so nothing needs sanitizing.

### Refreshing the screenshots

The docs and the landing page show the console through the images in
`docs/screenshots/`, one light and one dark WebP per screen. Rerun the capture
after any change a person would see on the page: a new layout, a renamed
button, a different color.

```bash
node scripts/capture-screenshots.mjs                     # every screen
node scripts/capture-screenshots.mjs --only dashboard    # one screen
```

Each screen is staged with no agent, from the payloads in
`scripts/screenshots/` (its README names the file behind each screen), in a
throwaway sample project and console home that the script removes when it is
done. It prints each file's size and warns over 300 KB.

Open every image before you commit it: the right screen, both themes, nothing
cut off, and no username, home path or real project name anywhere on it.
