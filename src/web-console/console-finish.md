# Finishing a Session

The console points here on `__commit`, or on `__dashboard` from a finished screen. Read it before your first `finish` post too. A stop request or the way home mid-workflow is `console-stop.md`.

Three steps, in order: post the finish, keep waiting for a button (no timeout), `stop` the server. Every session end posts one, not only the last. A pause (below) stops at once.

Every helper or background job you started must have reported back first. While you wait, post `{"agent":{"status":"working","activity":"Researching 3 questions (1 of 3 back)"}}`. Mark each reported helper `done` or `failed` in the turn its notice arrives: a `finish` is refused while any row is `running`. Never write a `finish.body` saying work "is running in the background".

## 1. Post the finish

`{"settle":true,"finish":{"headline":"The map is written","body":"Everything is on disk under `specs/lunch-vote/pathfinder/`.","command":"/plan2code-0-pathfinder specs/lunch-vote/pathfinder","doc":"map","dashboard":true}}`

| Field | Use |
| --- | --- |
| `headline` | required: what happened, in plain words |
| `command` | the exact next thing to run (your Trail Footer's Form A), copied verbatim: no `<` or `>` (refused). Leave it out when nothing is left to run. Write it bare: the page appends `--web` itself, and swaps a written `Use the web console for this session.` for it. `"console":false` if they asked to go back to the terminal |
| `dashboard` | `true` on every ending except a pause: the **Back to the dashboard** button |
| `body` | markdown: where files landed, what to read first |
| `where` | overrides "Run this in the terminal where you started Plan2Code, in a new conversation:" |
| `doc` | id of the doc to offer as a download (default: the first) |
| `commit` | `true` when the finish prints a git command (`quick-task`, `implement`, `implement-review`, `review`, `finalize`): **Commit it now** |
| `changelog` | `true` with `commit:true` on `quick-task` or `finalize`: **Update CHANGELOG first** (exit 3 on any other workflow) |
| `review` | `quick-task` only: `true` or `{"label":"..."}` puts **Review it now** on the screen (`building-review.md`) |

A finish whose `command` starts with a Plan2Code skill and is not a pause gets a **Continue here** button (unless the meter is red). You only handle the `__launch` it sends.

Settle whatever the session ends on in the same post (`"settle":true`): an item still `open` freezes as it stands. Post the finish even when you also print the footer in the terminal. Answer any chat `wait` delivers while you wait for a button (`console-chat.md`).

## 2. The buttons

A **pause** (a stop request, an abort that keeps its place, a checkpoint that saves and ends) has a headline starting "Paused", no `dashboard`, and is posted without `--wait`: `stop` at once. Every other finish goes up with `post --wait`; keep waiting in the usual slices.

| Arrives | Do |
| --- | --- |
| `__dashboard` | Run its `resume` (it re-scans and clears the page, the finish included), read the dashboard skill (`skillFile`, or `~/.agents/skills/plan2code/SKILL.md`), post its `menu` with `--wait`, and carry on as the dashboard in this conversation |
| `__changelog` | Run its `resume` (no `finish`, no `stop`), read the Changelog skill (`skillFile`, or `~/.agents/skills/plan2code-changelog/SKILL.md`) and follow it (`notes/changelog.md`). Leave the commit command where it is |
| `__launch` | Continue here: run its `resume`, read `skillFile` with your file-read tool (never a skill-invocation tool), follow it from the top. No `stop`. Into a different skill the page is cleared; when the `resume` keeps your own workflow (a phase finish into the same Implement), your first post of the new run carries `"finish":null` |
| `__review` or `__done` | `building-review.md` (quick task only) |
| `__commit` | Run its `resume` (`--workflow git`; no `finish`, no `stop`), read the Git skill (`skillFile`, or `~/.agents/skills/plan2code-git/SKILL.md`), start with its commit flow over the board (they pressed Commit it now), then the board with Push lit. Leave the printed commit command where it is |
| `wait` exit 20 | `open --resume <sid> --workflow <yours>`, give the new link, keep waiting; give up only if the resume fails |
| Session ends without a press | Nothing for you: an unfetched press stays on disk (`pendingResult`) for a resumed session |

## 3. Stop the server

`node "<CONSOLE>" stop --session <sid>`

A session with no finish is refused (exit 3); `--force` stops it anyway (`console-trouble.md`). `node "<CONSOLE>" status` lists this project's sessions, including any whose answers were never picked up.
