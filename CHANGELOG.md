# Changelog

All notable changes to Plan2Code will be documented in this file.

## v2.4.1

### ✨ Added

- **Screenshots of the web console**: seven screens (dashboard, question, living document, build, sign-off, finish, Ask tab) in light and dark, as WebP in `docs/screenshots/`. Readers see the theme that matches their system, on GitHub and on the site.
- **`scripts/capture-screenshots.mjs`**: stages each screen from the JSON payloads in `scripts/screenshots/`, in a throwaway sample project and console home, and captures it with puppeteer-core and a local Chrome or Edge. One command refreshes every image; `--only <shot>` refreshes one. `puppeteer-core` is installed with `--no-save` and never added to `package.json`.
- **New landing page**: `docs/index.html` rebuilt in the console's look, with the console above the fold.
- **Web console welcome**: the first dashboard a person sees opens a Welcome dialog with Planny waving, four tips and a **Start building** button. Closing it by any route saves `looks.welcomeSeen` in `looks.json`; Help's first tab has **Show the welcome again**.
- **Report a bug or idea from the console**: a megaphone button at the right of the top bar opens GitHub's new-issue chooser for `jparkerweb/plan2code`, with new **Bug** and **Idea** issue templates in `.github/ISSUE_TEMPLATE/` (blank issues off).
- **Version in Help**: the Help dialog's footer shows the running Plan2Code version, served by a new `GET /version` route. The skill build copies `version.json` into each skill's `references/web-console/` so the console can find it.
- **skills**: skill scripts. Every step a workflow decides with one correct answer now runs as a script the agent calls instead of prose it follows: Node 18+ built-ins only, one JSON object on stdout, documented exit codes, `--help`, `--dry-run` on writes. They install beside each `SKILL.md` in `scripts/`: shared ones from `src/skill-scripts/` (named per skill in `SOURCE_PROMPTS` → `scripts`), a skill's own from `src/<skill>-scripts/`, plus `common.mjs` and the release's `version.json`.
- **specs.mjs** (plan, revise-plan, document, implement, implement-review, review, quick-task, finalize, handoff): `list`, `status`, `metrics`, `mark`, `archive`. It reads gitignored `specs/` directly, parses the Phase Checklist and Parallel Execution Groups in the formats real specs use, counts tasks by marker (including `3.6a` and named `1.T` tasks), applies Implementation Mode's phase-selection table, and flags drift such as a phase marked `[x]` with open tasks. It shares the dashboard's spec classifier by importing the bundled `web-console/lib.mjs`.
- **pathfinder.mjs**: `reconcile`, `frontier`, `claim`, `resolve`, `rule-out`, `trail`, `gate`, `lint`, `brief-data` for maps on the `local` backend. The map's markers, the Trail Footer, the Clearing Gate's mechanical checks and hard caps, the standing-rule lint (loop tokens, checkboxes, reserved names, schema lines, `Blocked by:` cycles, the metrics collector's own scrape patterns) and a brief's date filtering are computed from the question files. Reconcile keeps each map row's own wording and only changes what the files contradict. Maps on the `github` backend keep doing these steps with `gh`, as `github-issues.md` describes.
- **feedback-payload.mjs** (finalize STEP 6.5): builds the payload from the archive, with real 12-character sha256 prompt hashes (the prose admitted the agent could not compute them), renders the issue, checks the 8 KB URL limit with `--truncate`, and runs the gh / browser / print tiers against `jparkerweb/plan2code`.
- **commit-msg.mjs**, **review-scope.mjs**, **agents-md.mjs**, **agent-files.mjs**, **handoff-path.mjs**: the commit command from the branch's ticket, Review's git scope and doc share, AGENTS.md's structure and orphans, the AI agent file sync, and the handoff's timestamped path and git ignore check.
- **tests**: `scripts/test-skill-scripts.mjs` and `scripts/test-script-<skill>.mjs`, run by `npm test` against the built `skills/` tree. One test fails if a `SKILL.md` names a script its skill does not ship.
- **web console**: the Workspace dialog's folders are remembered across console sessions, in `~/.plan2code/console/workspaces.json` beside `looks.json` (never in the project), keyed by the folder a session runs in and then by spec. Every change is saved. *Start from scratch* on the dashboard shows the project's list; picking a spec loads its own, which starts as a copy of the project's and is separate after that, and a spec created mid-run takes the list in force with it. The dialog says whose list it is. New `console.mjs forget --spec specs/<name>`, which Finalize's Spec Cleanup runs after archiving a spec.

### 🔧 Changed

- **skills**: the character limit for `src/plan2code-*.md` rises from 11,500 to 20,000 (about 5k tokens). It no longer guards Windsurf's old limit; it is a size discipline, applied by `validate-char-count.js` and the metrics improver alike.
- **finalize**: a run at exactly 75% complete now finalizes with notice (the table said >75% and <75%). Assumed `[?]` tasks count as completed and are listed; started `[/]` tasks count as incomplete. `verification_items_added` and Step 7's two judgment counts are passed to the script, which computes the rest.
- **finalize**: the community feedback issue title reads `[Feedback] v<version> - rating N/10`; ingestion matches on the `[Feedback]` prefix and is unaffected.
- **init**, **init-update**: both write the same pointer templates, from `agent-files.mjs`. Replacing `.cursor/rules/` now also removes Cursor's own `.mdc` rule files, so AGENTS.md really is the single source there, and files that already point at AGENTS.md are no longer offered again.
- **revise-plan**: re-opening a phase (`specs.mjs mark --to open`) also sets its phase file's Status back to In Progress.
- **review**: the branch scope compares `base...HEAD` (what this branch added since it left the base) rather than `main..HEAD`, and a trunk other than `main` / `master` is passed with `--base`.
- **pathfinder**: the Trail Footer's named legend numbers stops by position (`(blocked:3)` points at stop 3), and a brief's range is given as `this-week`, `since:<date>` or `<date>..<date>`.
- **init**, **init-update**: a CLAUDE.md (or other agent file) that is a symlink or hard link to AGENTS.md is reported as `linkedToAgents` and never replaced, since writing the pointer through it would overwrite AGENTS.md. A pointer file checked out with CRLF line endings still counts as already pointing.
- **review**: with no `main` or `master` and no `--base`, `review-scope.mjs` now stops with `no-base` instead of quietly counting only uncommitted changes.
- **commit-msg.mjs**: the add step is `git add -- <paths>`, paths starting with `@` or `-` are quoted, and subjects with `\`, `!` or curly quotes are refused. The output also carries `add` and `commit` separately for Windows PowerShell 5.1, which has no `&&`.
- **specs.mjs**: `mark` reads a Status line written as `Status:` or `**Status**:` too, and warns when a phase file has none; a path that is not a folder directly under `specs/` is refused (`not-a-spec`).
- **pathfinder**: the map header carries `**Next NN:**`, so a deleted question's number is never handed out again. `claim`, `resolve` and `rule-out` honour `--dry-run`. Notes indented under a map row survive a marker change. Research questions are fired unclaimed; the one-claim rule is for the questions a person works through.
- **finalize**: `feedback-payload.mjs` counts the same phase files `specs.mjs` does, `submit` refuses an oversize URL when `gh` is unavailable (`oversize`), and a bare spec name present in both `specs/` and `specs--completed/` is refused as ambiguous.
- Every script was checked against real specs and Pathfinder maps in other repositories and by four independent reviews; each issue found has a regression test.

- **install.js**: the closing message beside Planny now names the dashboard first: `plan2code` from any project, or `/plan2code` in your agent when the command could not be installed. The docs link moves to the line under it.
- **web-console**: User Preferences opens from a gear button instead of the three swatches, and the default highlight color is now ocean blue instead of rust.
- **web-console**: the dashboard rail marks the suggested next step with a small dot, since the center pane's Suggested pill can scroll out of view. Send pulses only while it is the primary button.
- **web-console**: when the agent stops checking in, the status line and Help now say to type **continue** in an idle terminal so it picks your answers up.
- **web-console**: `wait` exit 10 now carries a `next` instruction (relay one line, then wait again), and `console.md` opens with the one rule that keeps the page alive: every turn ends on a `wait` call, never on text.
- **web-console**: a finished quick task offers **Back to the dashboard** as well as **Review it now**, so the finished screen is never a dead end.
- **Windows**: the folder picker (the launcher's desktop shortcut and the Workspace **Browse…** button) now opens centred and in front of other windows instead of behind the terminal.
- **Launcher**: before asking which CLI to use, `plan2code` says what it is about to do and that running `/plan2code` inside your agent works too.
- **web-console**: the session meter now weighs the work a session actually did instead of a flat amount per step. A built phase scores one point per 3 tasks it completed (rounded up), plus 1 for Implement + Review, so a twelve-task phase weighs four times a three-task one; the agent reports the count as `run.tasks`. Every 2 questions you answer on the page add a point to the skill you answered them in, so a long back-and-forth in Plan or Pathfinder counts for more than a short one. Each Pathfinder research question adds 1 through a new `pathfinder-research` event, since research fills the context with nobody answering anything. The levels move to match: yellow from 5 points, red from 10, and the ring is full at 15.
- **web-console**: while a build runs, the waiting screen's pointer to the tasks list is now clickable. **Task** and the tab's own name (say **Phase 6 tasks**) show bold in the highlight color, and either one opens that phase's tasks tab.

### 🐛 Fixed

- **pathfinder**: charting no longer ends the session, or shows "Session ended" in the web console, while its research subagents are still running. They live in the terminal's process, so closing it on a "done" page killed them mid-write. The session now waits for every one (the page shows a running count), each subagent ends `## Evidence` with a `**Research complete:**` line, and Work Step 2 re-fires any research question missing it. `console.md` makes the same rule general: no `finish` while any subagent or background job is still out.
- **web-console**: reusing a settled question id for a different kind of question (say a multi-select turned confirm) now opens it as a new question instead of keeping the old answer.
- **web-console**: Send no longer stays disabled when an agent posts a question mid-build while still marked `working` (seen on Implement + Review, where the question said "I'm carrying on while you decide"). Once an open question has an answer or a note staged, Send unlocks at once with "Still working · it reads this next", instead of waiting out the agent's `quietMinutes` (up to an hour); the server holds the send until the agent next looks. `building.md` now says a question stops the build: set `waiting` in the same post as the question and wait, never keep working with a question open.

### 📚 Documentation

- **Web console first**: README, QUICK-REFERENCE, the walkthrough and the console guide now open on the browser flow (install, run `plan2code`, pick a card) with screenshots, and keep every slash command in a "Prefer the terminal?" section. The walkthrough follows the task API through the web console, session by session, and the console guide opens with a Quick start and has Troubleshooting ahead of the internals.
- **Rule 1 is now "Keep each session short"**, worded the same in README, QUICK-REFERENCE, the walkthrough and the landing page: chain a couple of small skills on the dashboard, and start a fresh console session when the session meter turns red or before a big planning or build step.
- **Web console guide** opens with a two-minute tour; **QUICK-REFERENCE** opens with a Launch table (shell, inside an agent, straight into a skill with `--web`) and a "Terminal instead" note; the walkthrough mentions the Ask tab during a build and ends with links onward.

## v2.4.0

### ✨ Added

- **Web console**: an optional local browser UI that every skill offers at the start of a session ("web console or terminal?"). Questions, recaps, sign-off gates, build progress and the document taking shape are laid out in a page instead of scrolling past in the terminal, so the workflow is usable by product people and not only engineers. Zero dependencies, no build step: a detached `node server.mjs` bound to `127.0.0.1`, bundled into each skill as `references/web-console/`. Answers carry the literal terminal token they stand for (`approved`, `a`, `skip`), so declining the console or losing it mid-session falls straight back to the terminal with nothing lost. Full guide in `.readme/web-console.md`.
- **`plan2code` dashboard skill**: a new bare-named skill that opens the console as a card menu of every skill, with a spec picker, and launches the pick on the same page. **Back to the dashboard** works from finished screens and, mid-workflow, from a triangle beside **Stop session**.
- **Global `plan2code` command**: installed with the skills (`I` and `A`; alone via Custom → `D`; removed by `U`). Typed in any project it opens the dashboard in Claude Code or Devin, asking which when both are installed and remembering the last pick in `~/.plan2code/launcher.json`. `--cli claude|devin` skips the question and `--model <name>` skips the model notice; other arguments are forwarded. It starts the agent with permission prompts off (`--permission-mode bypassPermissions` in Claude Code, `--permission-mode bypass` in Devin); run `claude /plan2code` yourself if you want prompts. The launcher lives in `~/.plan2code/bin/` with npm-style shims (sh, plus `.cmd` and `.ps1` on Windows).
- **Desktop shortcut** (opt-in, asked after the command installs): `Plan2Code.lnk` on Windows, `Plan2Code.command` on macOS, `plan2code.desktop` on Linux. It opens a native folder picker first, starting on the last folder picked.
- **`plan2code-3-implement-review`**: a quality-gated Step 3 that implements one phase, runs a focused review and the selected fixes before sign-off, and marks the phase complete only after the reviewed result is approved. Step 2's hand-off now offers it first, with `/plan2code-3-implement` as the review-free alternative.
- **`--web` flag**: `/plan2code-1-plan --web plan a lunch voting app` opens the console without asking. Every next-step command the workflow prints (resume footers, NEXT STEP lines, the loop's completion banner) now carries `--web`.
- **Console pages for builds and reviews**: a build shows the current task, a task-count progress bar and the phase's task list ticking as tasks land. After an approved phase or a finished quick task, **Review it now** runs `/plan2code-review` on the page, with *Which to fix* presets for critical-and-warnings or everything.
- **Console conveniences**: nine question shapes with live validation and drag-to-reorder phases; drafts that survive a closed tab, reload, server restart or agent crash; an **Ask** tab for quick questions the agent answers at its next check-in (file edits need approval); image and document attachments; a read-only **Overview** tab; a **Workspace** of extra read-only folders addressed as `@name`; a green / yellow / red **session meter**; a **Role** preference that orders starter templates; nineteen highlight colours, light / dark themes and card widths; audio cues with per-event toggles; and a 16-topic Help dialog.
- **Planny in the console**: drawn in SVG in his own dock above the question list, where he carries the page's state: his star lights and he waves when it is your turn, the star turns and he walks on the spot while the agent works, it goes green when all is caught up, he shows no arms when the agent is not answering, and he fades with his star shut when disconnected. He flies through a starfield while the agent thinks, wakes up on a fresh dashboard, and acts out each skill on its starting screen, arms holding that step's prop. The tab icon adds a busy, ready or attention bar, and the desktop shortcut uses him too.
- **Tests**: `scripts/test-web-console.mjs` and `scripts/test-launcher.mjs` (run by `node --test`), `scripts/parse-check.mjs` (every shipped browser module parses as an ES module) and `scripts/check-skill-table.mjs` (the dashboard's "What each skill reads and writes" table matches the skills), all wired into `npm test`. `scripts/bench-web-console.mjs` measures time to first paint.
- **install.js**: an animated progress indicator during the two long install phases, so the installer no longer looks hung.
- **Curated launcher models**: the `plan2code` launcher's model menu reads `src/launcher/models.json` (copied to `~/.plan2code/bin/` and refreshed by every install) instead of asking the CLI, so Devin offers a short verified list at Low, Medium and High effort. **User Preferences → Models** (Claude and Devin tabs) adds models released after an install, kept in `~/.plan2code/models.json`, with **Reset to default**. `--model <id>` still skips the menu.
- **Quick-task build progress on the console**: an approved quick-task plan opens a **Build progress** tab that ticks each step, raises the progress bar and updates the activity line, as an Implement phase does.
- **Console extras**: sent notes and their attachments stay listed in the Sent box after a reload or in a second tab; the fresh-idea box on Pathfinder, Plan and Quick Task has **+ Attach file** (and takes a paste); clicking the session meter lists what each step added; git code blocks get a **Run it** button; the Ask tab may run one command the person spells out (a commit, a test run) and report the result; the wake-up animation has a **Skip** button.

### 🔧 Changed

- **Planny has a new look everywhere**: a box with a star for an eye, stick arms and two small feet, chosen from twenty studies. Every ASCII Planny in the workflow prompts, the installer, `plan2code-loop` and the Claude Code status line is redrawn to match: the eye is always the star, one arm waves when he is asking something, both go up when he is celebrating, and the status line shows his box, star and feet without arms.
- **Character limit raised from 11,000 to 11,500** for `src/plan2code-*.md` (`scripts/validate-char-count.js`, and the same number in `plan2code-metrics`'s `improver.ts` and `applier.ts`), so the console's Interface lines fit without cutting workflow rules.
- **package.json**: the installer's bin is renamed `plan2code` → `plan2code-install`, leaving the `plan2code` name to the launcher. The `npx` install command is unchanged.
- **install.js**: skills bundle the shared `src/web-console/` directory through `additionalReferences`, copied as bytes so the bundled chimes survive the build. Installed skills are listed by reading the skills store directly instead of `skills list` (seconds instead of over a minute on Windows), and removal is one variadic `skills remove`.
- **plan2code-0-pathfinder**: the duplicated Trail Footer forms fold into the fallback line, since `references/trail.md` defines them in full; the GitHub Issues backend is unchanged.
- **`.gitattributes`**: `*.mp3` is binary. `.editorconfig` pins LF for editors. `prototypes/` is gitignored.
- **Finished screens**: Review, Init, Init Update and Handoff end with **Back to the dashboard**, as Quick Task does; only a pause leaves it off.
- **Console sturdiness**: `wait` reports the server gone only after three missed health checks in a row, so a busy server is not taken for a dead one; a reused question id no longer inherits the old answer; polling stops redrawing an unchanged page and returns to the live stream (with backoff) once the server answers; `stop` gives a busy server a second, longer health check before leaving it alone; a fresh session in a linked worktree records the worktree as its folder; a text question whose `pattern` does not compile is refused at `post`.
- **scripts/validate-char-count.js**: the dashboard prompt `src/plan2code.md` is size-checked too.

## v2.3.0

### ✨ Added

- **`plan2code-0-pathfinder`: `Resolved:` date on question files** — a sixth schema line recording the day each decision landed. Reconcile backfills older maps from `Claimed:` (today if unclaimed), and resolved map rows now carry the date in italics beside the gist. On the GitHub Issues backend the issue's own close date fills this role, so there is nothing to write and nothing to backfill.

- **`plan2code-0-pathfinder`: BRIEF mode** — asking for a `brief`, `recap`, or `minutes` writes a dated, plain-English report to `pathfinder/briefs/brief-<YYYYMMDD>.md`: what was decided in the range, what was ruled out, what is ready to decide next, what is still blocked, and what is next. Zero pathfinder machinery in the file — no numbers, markers, or jargon — so it doubles as meeting minutes for a joint Product and Engineering session. New `references/brief.md`; BRIEF mode never claims or resolves a question. The brief file stays on local disk on both backends.

### 🔧 Changed

- **`plan2code-0-pathfinder`: MODE B cadence is now decide → menu → checkpoint** — questions still resolve strictly one at a time, but a session no longer ends after one. Recording a decision leads to a continue-or-stop fork-menu (new Trail Footer **Form C**, with the resume command always visible as the stop branch), and a fresh session is *recommended* after about three decisions — or after a heavy, contested, or locked one — to protect context quality rather than forced by the rules.

- **`plan2code-0-pathfinder`: every user-facing question uses the structured question UI when available** — intent gate, destination and frontier grills, recap confirmations, sketch reactions, `legwork · HITL` completion, and the new fork-menu. The old detail test that routed gnarly questions to prose Q blocks is gone: trade-offs go in option descriptions, composed answers come back through `Other`, and an artifact is shown in prose immediately before the tool rather than replacing it. Prose Q blocks are now fallback only, for when the tool does not exist.

- **`plan2code-0-pathfinder`: the breadth-first frontier grill gains seven product axes** — user value, success measurement, target user, rollout, analytics, support and docs, and legal/compliance, each with a sample probe. Inapplicable axes are named and skipped up front, and with Product in the room engineering and product batches alternate so neither team spectates. New group-session grilling rules: address the room, record who broke a tie, and never record a contested pick as decided — both positions go under `## Evidence` and the question stays open.

## v2.2.0

### ✨ Added

- **Committed Agent Skills build** — each workflow under `src/` now builds to `skills/<skill-name>/SKILL.md`, with companion references nested under `references/`. `npm run build:skills` regenerates the artifact, and `npm test` verifies that committed skills have not drifted from their source prompts.

- **Project-scoped skill installation** — Custom → `L` now installs Plan2Code directly into the current project through the skills CLI instead of printing manual copy instructions.

### 🔧 Changed

- **Installation now delegates to the skills CLI** — Plan2Code ships one canonical Agent Skill format instead of maintaining separate command, prompt, workflow, and skill outputs for individual tools. The installer builds `skills/`, checks `npx --yes skills`, removes stale Plan2Code skills, and runs `skills add` with an explicit workflow list. Installation now requires Node.js 18+ and network access; installed skills can be updated with `npx skills update -g`.

- **Legacy installation cleanup is automatic** — install and uninstall sweep files written by earlier per-tool installers so old commands cannot shadow the canonical skills. This includes the Gemini CLI files retained exclusively for uninstall compatibility.

- **Default installation is skills-only** — main-menu option `I` no longer installs `plan2code-loop`. The loop remains part of `A` and is still available separately through Custom → `O`.

- **One frontmatter contract serves every agent** — generated `SKILL.md` files always include `name`, `description`, and `disable-model-invocation: true`. Reference files remain nested under their owning skill, eliminating the old flat-file path rewrite and its column-position constraint.

## v2.1.1

### ✨ Added

- **Failure Log convention in the init prompts** — `/plan2code-init` now generates a `## Keeping this file current` / `## Failure log` pair at the end of `AGENTS.md`, so agents record repo-specific corrections as one imperative line each instead of relearning them. The section is always-inline (never split to `.agents-docs/`) and is listed in the generated `CLAUDE.md` pointer block. `/plan2code-init-update` gains a matching **Failure Log Audit** step that flags the section as missing on existing `AGENTS.md` files and offers to add it.

- **`plan2code-changelog` skill** (`.claude/skills/plan2code-changelog/`) — validates the CHANGELOG version before a PR is opened. Reads `main` for the current latest version, classifies the branch's changes to pick minor vs patch, and keeps `CHANGELOG.md`, `package.json`, and `version.json` in lockstep. Exists because parallel branches pick colliding version numbers independently.

### 🔧 Changed

- **`AGENTS.md` preamble shortened** in the init template — the generated header no longer enumerates specific agents (Claude Code, Cursor, Codex, Copilot, Devin, Zed) and reads "AI coding agents working with code in this repository."

- **`CLAUDE.md` added at the repo root** — a pointer file to `AGENTS.md`, matching what `/plan2code-init` now tells agents to generate.

- **`CLAUDE.md` template reconciled between the two init prompts** — `/plan2code-init` emitted the `CRITICAL — MANDATORY FIRST STEP` directive followed by a seven-item bullet list, while `/plan2code-init-update`'s Step 7 reference emitted the directive followed by a single prose line. Running one workflow after the other rewrote `CLAUDE.md` back and forth. `src/plan2code-init-update-references/ai-agent-file-sync.md` now carries the bullet-list form for both the `CLAUDE.md` and the generic reference template.

### 🐛 Fixed

- **Typos in the Failure Log template** — the template shipped in `src/plan2code-init.md` and `src/plan2code-init-update.md` said `AGETNS.md`, `mistage`, and "mistakes make by". Since agents copy this block verbatim into generated `AGENTS.md` files, the errors propagated into every project initialized with it.

## v2.1.0

### ✨ Added

- **GitHub Issues backend for Pathfinder** — `/plan2code-0-pathfinder` no longer assumes local files. Chart Step 1 now asks, HITL and never self-picked, where the map should live: **local** (the default — files under gitignored `specs/<idea>/pathfinder/`, private and solo) or **github** (a `pathfinder:map` issue whose decision questions are its sub-issues, driven by the `gh` CLI). The pick is recorded as the first `## Ground rules` bullet, never re-asked and never switched mid-map, and Auto-Discovery resolves either backend — an issue URL or number as the argument routes straight to `github`.

  On `github`, the local model maps onto the tracker's own primitives rather than being simulated in issue bodies: a question is a **sub-issue** (`sub_issues` endpoint), blocking is GitHub's **native issue dependencies** (`dependencies/blocked_by`, so the frontier renders in GitHub's UI without opening the map), the claim is the **assignee**, `Type:` becomes a single `pathfinder:<type>-<mode>` label so type and mode cannot drift, `Locked: yes` becomes `pathfinder:locked`, and resolution is an `## Answer` comment followed by a close — `completed` for a decision, `not planned` for a question ruled out of scope. Both wiring calls key on the issue's **database id**, not its `#number`. The map body therefore carries no question checklist at all: the frontier is a live query, which removes the single largest source of drift in the local backend.

  Three things stay on local disk whatever the backend: runnable sketches (`specs/<idea>/pathfinder/sketch-NN/`), anything secret, and the `PLAN-DRAFT-<date>.md` — `/plan2code-1-plan` discovers its input with `ls specs/` and has no notion of a tracker, so a draft that existed only as an issue would be invisible to the rest of the pipeline.

  Guardrails carried over from the local backend's assumptions: `github` is only offered after a five-check preflight (`gh` present, authenticated, GitHub remote, issues enabled, push access), and the offer must name the repo's **visibility** in the same breath, because a map on a public tracker publishes the destination, the rejected alternatives, and the codebase recon. The Step 3 recon is held in-session and published at Step 6, so the Step 4 no-fog off-ramp leaves no litter on a shared tracker. A `gh` failure mid-session stops the session rather than falling back to local files, which would fork the map.

  Depth lives in a seventh reference file, `src/plan2code-0-pathfinder-references/github-issues.md` — preflight, label set, the local↔GitHub equivalence table, create-then-wire charting, the frontier query, resolve and out-of-scope flows, reconcile, the trail footer, handoff, and a failure-mode table. Adapted from the GitHub tracker doc behind Matt Pocock's [`wayfinder`](https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder) skill (MIT).

### 🔧 Changed

- **`src/plan2code-0-pathfinder.md` recompressed** to absorb the new `## Backend` section within the 11,000-character workflow-file limit — duplication between the orchestrator and its reference files was removed (the local layout and marker legend now live only in `questions.md`; Form A/B footer detail only in `trail.md`), and step text tightened. No behaviour was dropped.

## v2.0.0

Ports upstream v1.17.0 and v2.0.0 into Plan2Code.

### 💥 Breaking

- **Gemini CLI is no longer an install target.** The `.gemini/commands/*.toml` surface is removed, along with the build-time machinery it required: `generateTomlContent()`, `writeTomlToDestination()`, `inlineReferenceContent()`, and the `dest.type === 'toml'` branch in `syncPrompts()`. Every remaining target resolves `Read references/*.md` directives at runtime, so reference content no longer needs inlining at build time.

  **Uninstall still cleans up Gemini files.** The `.gemini/commands` entry is deliberately retained in the uninstall target list (labelled `Gemini CLI (legacy — uninstall only)`) behind a new `uninstallOnly` flag, so `.toml` files written by v1.x installs can still be removed. Do not add it back to `LOCAL_DESTINATIONS` / `GLOBAL_DESTINATIONS`.

  All other platforms are unaffected — Claude Code (skills *and* commands), Cursor, Windsurf, Continue, Codeium, GitHub Copilot, VS Code Copilot, Pi, Crush, Amp, Devin, OpenCode, and Zed all install exactly as before.

### ✨ Added

- **Pathfinder workflow** — new `/plan2code-0-pathfinder` command, an optional Step 0 for an idea too big and unclear to plan yet: where you can feel the shape of the work but can't write it down as requirements. Adapted from Matt Pocock's [`wayfinder`](https://github.com/mattpocock/skills/tree/main/skills/engineering/wayfinder) skill (MIT), reworked for Plan2Code's local `specs/` workflow.

  Pathfinder names a **destination**, then charts the way to it as a map of decision **questions** under `specs/<idea>/pathfinder/` — `map.md` as the index plus one `questions/NN-<slug>.md` file per decision. It resolves **one question per session** (research excepted), and each resolution clears the fog ahead of it, graduating whatever became specifiable into fresh questions. When nothing is left to decide, it writes `specs/<idea>/PLAN-DRAFT-<date>.md` carrying the status string `/plan2code-1-plan` already recognizes, so planning resumes at Phase 4 in the same folder with Requirements, System Context, and Scope pre-answered.

  **Grilling is batched** — up to three *independent* probes per turn instead of one probe per round trip, delivered either through the environment's structured question tool or as numbered prose Q blocks, chosen per batch by a detail test. Probes are written in plain English, and any probe you skip is re-asked rather than quietly dropped. It **plans, it never builds**: four question types — `grill` (HITL, the default), `research` (AFK, resolved by background subagents in parallel), `sketch` (HITL), and `legwork`.

  Map state uses the house checkbox vocabulary — `[ ]` open (the frontier), `[/]` claimed, `[x]` resolved, `[!]` blocked, `[-]` out of scope. `questions/` is ground truth and `map.md` is a rebuildable index: every Work session reconciles the two before choosing, which self-heals drift and recovers claims left by a crashed session. Every response ends with a **Trail Footer** — a one-line path from `START` to the `⚑` destination, a numbered legend, a plain-English confidence line, and exactly one closer chosen by turn type (a turn that asks you something never emits a resume command).

  Depth lives in six new reference files under `src/plan2code-0-pathfinder-references/` (`chart`, `grilling`, `questions`, `resolve`, `handoff`, `trail`), so the orchestrator stays a dispatcher and the skill has no external skill dependencies.

- **Community feedback submission** — `/plan2code-4-finalize` gains STEP 6.5: after archival, assembles a METRICS_JSON payload from the completed run and submits it as a `community-feedback`-labeled GitHub issue on `jparkerweb/plan2code`, with a tiered fallback (`gh` CLI issue create → browser-opened prefilled issue → printed URL) for environments without `gh`. Payload schema and submission tiers live in the new `plan2code-4-finalize-references/community-feedback-submission.md`. Step 5 now asks for explicit submission consent and skips straight to Step 6 when declined.

- **Community submission ingestion in plan2code-metrics** — new "Fetch community submissions" CLI flow (`community.ts`) lists open feedback issues via `gh`, validates and parses each `METRICS_JSON` payload (type-only validation; malformed submissions are skipped and logged, not fixed up), imports them into the local run store deduped by `run_id`, re-aggregates, and closes each imported issue. Matches an open issue by the `community-feedback` label OR the `[Feedback]` title prefix OR the `METRICS_JSON` marker, so browser/print-tier submissions from outside contributors are still picked up; paginates fully (`--limit 1000`); and closes issues idempotently even on the duplicate path.

- **Community runs cohort by Plan2Code version** — ingested community runs are keyed into cohorts by their `plan2code_version` rather than by a prompt-file fingerprint, since community submissions carry the installed, platform-transformed prompts and an LLM-generated payload. Runs now carry a `source` (`local`/`community`) tag, and `current_cohort_key` prefers local cohorts so ingested feedback never displaces the maintainer's current prompt generation.

- **Devin CLI as an AI backend** for both `plan2code-metrics` (`invoke-llm.ts`) and `plan2code-loop` (`agents/devin-cli.ts`) — `devin --print --prompt-file <file> --permission-mode dangerous`. Unlike upstream, which replaced GitHub Copilot CLI with Devin, Plan2Code keeps **both**: Claude Code, GitHub Copilot CLI, and Devin CLI are all selectable. Existing Copilot CLI selections keep working.

### 🔧 Changed

- **README rebuilt** around a shorter, task-first structure, with the deep material split into a new `.readme/` folder: `walkthrough.md`, `autonomous-loop.md`, `status-line.md`, `metrics.md`, `test-bot.md`.
- **Docs site and README redesigned** around an "airmail" postcard theme — a fixed four-sided airmail-chevron page frame, sticky header, and the workflow presented as six posted letters, with Pathfinder and the optional Review step both surfaced. Adds a postage-stamp favicon set (`favicon.svg` / `.ico` / `.png` / `apple-touch-icon.png`) and a new README banner; removes three orphaned images (`desk.jpg`, `install-script.jpg`, `plan2code.jpg`).
- **`/plan2code-4-finalize` archives `pathfinder/` with the spec** — STEP 6 now names `pathfinder/` in the move list and no longer describes the cleanup target as "research or scratch files," wording that pointed an agent straight at `pathfinder/questions/`. The map is the rationale record behind the plan, in the same class as `PLAN-CONVERSATION-*.md`.
- **`/plan2code-1b-revise-plan` no longer deletes `pathfinder/`** — its Step 6 cleanup had the same "research or scratch files" wording.
- **`/plan2code-quick-task` is no longer labelled "Step 0"** — pathfinder now owns step 0, and quick-task was never a pipeline step. It registers as a utility (like `init`, `review`, and `handoff`), so its generated description reads `Plan2Code Quick Task: Quick Task Mode`. Filename, skill name, and command path are unchanged.
- **`/plan2code-handoff` asks where to save** — the OS temp directory is now the default, with `./handoffs/` or any other path available on request. Adds a spec-awareness section: when the session worked inside `specs/<feature>/`, the handoff cites the in-progress `phase-X.md` and its actual checkbox state rather than relying on conversation memory.
- **`/plan2code-init-update` Step 7 offloaded to a reference file** — the AI Agent File Sync detail moves to `plan2code-init-update-references/ai-agent-file-sync.md` with an inline fallback. The `CLAUDE.md` MANDATORY-FIRST-STEP template is unchanged.
- **`/plan2code-review` Session End offloaded to a reference file** — next-step routing moves to `plan2code-review-references/session-end.md` with an inline fallback.
- **Status line: context-bar token count suppressed on token-usage accounts** — the bar's `(84k)` reads the same `context_window.total_input_tokens` the `in`/`out` usage segment already shows on Enterprise/Bedrock/Vertex/PAYG accounts. It now renders only on Pro/Max/Teams (rate-limit) accounts, where no other segment carries an absolute token count. The `items.contextTokens` flag still turns it off entirely.
- **`aggregator.ts` refactor** — extracted `writeRunFile()` (dedup-by-`run_id` write) out of `importRun()` so the community ingestion path can reuse it without a source file path; `collector.ts` now exports `extractMetricsJson()` for the same reason.
- **`.agents-docs/AGENTS-code-style.md`** documents a metrics gotcha: when a `PLAN-DRAFT-*.md` carries no `METRICS_JSON` comment, `collector.ts` scrapes it by regex, and the four confidence-*breakdown* patterns match a bare dimension word plus a number **without** requiring a `%` — so even a table row like `| Requirements | 11 |` gets ingested as a planning confidence score.
- **`.agents-docs/AGENTS-architecture.md`** documents the column-0 requirement for `Read references/*.md` directives — `install.js` anchors its flat-file path-rewrite regex at `^`, so an indented `Read` line is silently skipped.

### 🐛 Fixed

- Broken review-command row and column alignment in `QUICK-REFERENCE.md`.
- `plan2code-loop` banner misspelled the mascot as "Plany".

## v1.16.1

### ✨ Added

- **Status line: git worktree awareness** — a session running in a linked git worktree now renders the project segment as `repo ⑂ worktree` (e.g. `plan2code ⑂ spike`) instead of only the worktree's directory name, which previously made the session look like an unrelated project
  - Repo identity resolved from `git rev-parse --git-common-dir`, so it is correct regardless of how the worktree directory was named (bare `<name>.git` main repos included)
  - A leading repo prefix is stripped from the worktree name (`plan2code-user-auth` → `user-auth`), and the name collapses to a bare `⑂` when it merely restates the branch already on screen — matched across `/ _ . -` separators and type prefixes like `feature/`, and only when the branch is actually displayed
  - Toggleable via the new `items.worktree` config flag (default on); one extra timeout-bounded `git` call, skipped outside git repos

## v1.16.0

### ✨ Added

- **`/plan2code-handoff` skill** — compacts the current conversation into a self-contained handoff document (written to gitignored `./handoffs/<timestamp>-handoff.md`) so a fresh session or another agent can resume the work
  - Always captures a confirmed **Next task**: infers a candidate from context and requires the user to confirm or fill it in before the file is written
  - References plan specs, logs, and files by path rather than copying them; strips secrets; suggests follow-on skills and verification steps
  - Repo-safe: checks `git check-ignore` and warns (without silently editing `.gitignore`) when `handoffs/` isn't ignored in an arbitrary repo
- **Repo-local release publisher skill** — new `/plan2code-publish` maintainer skill in `.claude/skills/` cuts a GitHub Release from the top `CHANGELOG.md` entry once `CHANGELOG.md`, `version.json`, and `package.json` agree and the version is ahead of the latest published release. Dev tooling only — deliberately excluded from `install.js`, never installed to `~/.claude/skills/`.

### 🐛 Fixed

- **Review workflow next-step suggestion made context-aware** — `/plan2code-review` Session End now reconciles three signals: session context (what preceded the review in the conversation), the user's review intent, and on-disk spec state gathered shell-agnostically — a file-search tool's empty result is never treated as proof that no specs exist. Suggestions render only at actual session end, cite their evidence and its source, and conflicting signals ask one targeted question instead of guessing.

## v1.15.4

### ✨ Added

- **Status line: reasoning effort + context token count** — model segment now appends the current reasoning effort level (e.g. `Sonnet 5 | High`, hidden when the model doesn't support an effort parameter); context bar now shows raw input tokens used alongside the percentage (e.g. `42% (84k)`), independently toggleable via new `items.effort` / `items.contextTokens` config flags

## v1.15.3

### ✨ Added

- **Session-end summaries across workflows** — consistent closing context in implement, document, finalize, init-update, quick-task, review, and revise-plan
  - Implement: work summary + upcoming-phases table (task counts, goals) after each phase approval
  - Document: phase-overview table at close to help plan sessions and review gates
- **Sync & Maintain in init-update** — new unified doc-surface sync option (menu item #9)
  - Covers `AGENTS.md`, `.agents-docs/`, active `specs/`, README, and human docs; tier-voice routing, never duplicates across tiers
  - Adaptive to repo conventions — detects the human-docs tree, never assumes
- **Research steps in plan** — domain research (Phase 1), tech-options research (Phase 4), and an investigate-to-close-gaps rule on the 90% confidence gate

### 🔧 Changed

- **Spec auto-discovery hardened** — replaced Glob (silently fails on gitignored `specs/`) with explicit shell `ls` across document, implement, finalize, init-update, and revise-plan
- **Revision-mode guardrails** — `1b-revise-plan` edits restricted to `specs/` paths only; execution-shaped language removed; cleanup step added
- **Commit-message enforcement in implement** — subject ≤100 chars, exactly three `-m` flags, no body
- **Finalize documentation review expanded** — audits `AGENTS.md` + `.agents-docs/`, mandates corrections (not just additions), routes facts per tier voice
- **Quality language pass** — plan demands edge cases/failure modes and measurable criteria; document and finalize role statements sharpened

### 🐛 Fixed

- **Review workflow next-step guard** — Review mode no longer suggests `/plan2code-3-implement` when `overview.md` and `phase-*.md` files don't exist. If the document step hasn't been run yet, it now correctly directs users to `/plan2code-2-document` first.

## v1.15.2

### 🔧 Changed

- **Review workflow renamed** — `/plan2code-3b-review` → `/plan2code-review`
  - Removed `3b` step-number prefix; review is now a standalone utility workflow (like `init` and `quick-task`)
  - Source file: `src/plan2code-review.md` (was `plan2code-3b-review.md`)
  - Reference directory: `src/plan2code-review-references/` (was `plan2code-3b-review-references/`)
  - Updated all docs, installer config, architecture docs, and cross-references

## v1.15.1

### 🔧 Changed

- **Zed agent support** — Added Zed to all agent support documentation
  - `README.md` Supported Platforms list
  - `AGENTS.md` intro and Project Overview
  - `.agents-docs/AGENTS-development-commands.md` Platform-Specific File Formats table
  - `install.js` Agent Skills platform label
  - `src/plan2code-init.md` AGENTS.md template text

## v1.15.0

### ✨ Added

- **Claude CLI status line** — Persistent three-line status bar for Claude Code, displaying model, project, git branch, uncommitted diff stats, session duration, context window usage bar, and plan/quota usage. Reads all data from Claude Code's stdin JSON — no API calls, no auth, no background processes.
  - `src/statusline-claude/statusline.js` — self-contained: stdin parsing, config loader, ANSI formatting, orchestration
  - `src/statusline-claude/statusline-config.json` — distributed default config
  - `src/statusline-claude/README.md` — user docs: install, config, usage modes, troubleshooting
  - **Planny mascot icons** on each line (`╭─╮`, `│★│`, `╰─╯`) in brand colors, with monochrome fallback
  - **Context window bar** (12-cell `▰▱`) with configurable `autocompactBuffer` (default 33000 tokens) so the percentage reflects *usable* context, not the raw window
  - **Adaptive plan usage segment** — auto-detects data shape:
    - Pro/Max/Teams (rate_limits present) → `5h: NN% · 7d: NN%`
    - Bedrock / Vertex / PAYG (no rate_limits) → `NNk in · NNk out` session tokens
    - Segment hidden when neither is available
  - **Real uncommitted diff stats** via `git diff HEAD --numstat` → `+NN -NN`
  - **Color-coded thresholds** — green / yellow / red for context bar and rate limits
  - **Separator line** rendered at fixed 55-character width for consistent alignment
  - **Session cost display** — Estimated session cost shown next to duration (e.g. `49m ($4.62)`) via new `items.sessionCost` config (default on); reads `cost.total_cost_usd` from Claude Code stdin; hidden when zero or unavailable
  - **Compact mode redesigned** — `"compact": true` now renders two content lines (no mascot icons, no separator) instead of one cramped single line. The single-line variant truncated in narrow terminals — the exact case compact mode was meant to help. Default remains `false`.
  - **Silent failure** on all errors — never crashes, never blocks the CLI; 1.5s per-call timeouts on git operations; non-git workspaces short-circuit without spawning subprocesses
- **Installer integration** — Status line included in `Install All + dev tools` (`A`); also available via `Custom → S` (opt-in).
  - Copies `statusline.js` verbatim to `~/.claude/plan2code-statusline.js` (single-file design, no bundling)
  - Registers in `~/.claude/settings.json` under `statusLine` via atomic temp-file + rename write
  - Preserves existing `statusline-config.json` on reinstall
  - Detects non-plan2code custom `statusLine` configs — prompts before replacing; auto-backs up to `statusline-previous.json`
  - Uninstall (`U`) removes bundled script + `settings.json` entry; preserves `statusline-config.json`. Only removes `settings.statusLine` if it points to the plan2code bundle — non-plan2code entries are left intact.

## v1.14.0

### ✨ Added

- **Review workflow (Step 3b)** — New `/plan2code-3b-review` command for comprehensive post-implementation code review
  - 5-step process: scope detection, context analysis, 11-dimension review, spec/test assessment, summary with fix options
  - Adaptive scope: focused (named files), branch (git diff), or full (subsystem) — auto-detected with user override
  - 3 severity levels (Critical, Warning, Suggestion) with High-confidence-only findings
  - Reference file architecture: orchestrator (≤11k chars) + 3 companion reference files loaded via Read directives
  - Deep verification protocol with use-case tracing for architectural findings and adversarial self-check
  - Detailed dimension checklists (8 non-obvious items per dimension with anti-patterns and "don't flag" guidance)
  - False-positive catalog with detection shortcuts to prevent common false findings
  - Finding verification gate — re-reads source at each cited line before presenting
  - Mnemonic fix options: `H` (high-priority), `A` (all), `S` (specify by number)
  - Post-fix Plan/Apply/Verify pipeline — enterprise-grade fix quality with full validation
  - Doc review mode — >70% doc changes triggers editorial critique
  - Graceful degradation for agents that can't read external files
  - Spec-aware when `specs/` exists; works standalone for any codebase
  - Context-aware session end with pipeline state detection
  - Registered in installer for all 14+ platform destinations
  - Installer copies reference directories for all 13+ platform targets
  - Reference content inlined into TOML output (Gemini CLI) so platforms that cannot resolve runtime file reads still get full workflow depth
  - Uninstall now removes orphaned `*-references/` directories even when prompt files were already removed manually
  - Implement workflow session-end now suggests review after each phase

## v1.13.0

### 🔧 Changed

- **Simplified workflow naming convention** — All workflow and skill files unified to single-dash naming, eliminating double-dash (`--`) and triple-dash (`---`) conventions
  - Renamed 8 source prompt files in `src/` (e.g., `plan2code---init.md` → `plan2code-init.md`, `plan2code-1--plan.md` → `plan2code-1-plan.md`)
  - Updated `install.js` `SOURCE_PROMPTS` metadata and `generateFilename()` to emit single-dash names
  - Updated all cross-references inside workflow prompt markdown content
  - Updated documentation: `README.md`, `QUICK-REFERENCE.md`, `AGENTS.md`, `.agents-docs/AGENTS-architecture.md`
  - Updated tooling references in `plan2code-loop/`, `plan2code-bot/`, and `plan2code-metrics/`
  - Fixed pre-existing broken test assertion in `plan2code-bot` step-instructions test
  - Repaired Windows-1252 / U+FFFD encoding artifacts (em-dashes) in `plan2code-loop` and `plan2code-bot` source files

### 🎁 Added

- **Devin platform support** — Added Devin to supported platforms list across `README.md`, `AGENTS.md`, `install.js` Agent Skills targets, `.agents-docs/AGENTS-development-commands.md`, and the `/plan2code-init` prompt
- **CLAUDE.md MANDATORY FIRST STEP template** — `/plan2code-init` and `/plan2code-init-update` now generate a CLAUDE.md template containing a `CRITICAL — MANDATORY FIRST STEP` directive that forces Claude Code to read AGENTS.md before responding to any user message

## v1.12.0

### 🔧 Changed

- **Resilient code references in workflow prompts** — Workflow prompts now explicitly guide AI agents to use semantic anchors (function names, class names, code patterns) instead of line numbers, which become stale as tasks modify files during implementation
  - **Document mode** (`plan2code-2-document.md`) — New "Code references" block in Task Writing section lists four preferred anchor types with examples; line numbers allowed only as supplemental context
  - **Revise-plan mode** (`plan2code-1b-revise-plan.md`) — Matching code reference rule added to Step 3 (Execute Revisions) so revised and new tasks follow the same convention
  - **Implement mode** (`plan2code-3-implement.md`) — New "Verify locations" row in Code Consistency Rules table instructs agents to treat line numbers as approximate and locate by function/symbol name

## v1.11.1

### 🔧 Changed

- **Task complexity check in Document workflow** — Enhanced task writing guidance with lightweight cognitive complexity heuristics (inspired by PR #26)
  - "Time-boxed" criterion now includes explicit split triggers: 5+ logic branches, 2+ integration points, or shared interface mutation
  - New "Complexity check" prompt: before finalizing each task, LLM considers logic branches, distinct behaviors, integration points, shared interface impact, and error/edge cases
  - Tasks complex on 3+ signals must be split; adjacent trivial tasks forming a cohesive unit should be combined
  - Process step 7 updated to reinforce the complexity check during phase file authoring

## v1.11.0

### ✨ Added

- **plan2code-bot** — New autonomous workflow test runner (`plan2code-bot/`) that uses the Claude Agent SDK to simulate a human running the entire plan2code workflow end-to-end
  - Two auto-detected modes: **new-project** (generates an app idea, creates a subdirectory, runs init through finalize) and **enhancement** (scans existing codebase, proposes a realistic enhancement)
  - `--idea` flag to seed the idea generator with a specific concept
  - `--resume` flag to continue incomplete runs from saved state — skips previously succeeded steps and restores idea, config, and implement pass counter
  - State file (`.plan2code-bot-state.json`) saved after each step; automatically deleted on full success, preserved on failure for later resume
  - Resume auto-detects state files in current directory (enhancement mode) or immediate subdirectories (new-project mode)
  - Artifact validation after each step (aborts on missing expected outputs)
  - **LLM-as-judge evaluation system** — Always-on quality assessment that transforms bot from "yes-man" to authentic QA agent
    - **Intelligent decision making**: Uses LLM to answer `AskUserQuestion` prompts based on current observations (tools used, files created, errors) instead of hardcoded keyword matching
    - **Post-step evaluation**: Comprehensive quality assessment after each step using step-specific criteria (score 0-100, strengths, weaknesses, suggestions, critical issues)
    - **Observation tracking**: Full execution history captured (tools, files, messages, errors, questions with LLM reasoning)
    - **Quality gate**: Blocks finalization if average score < 60, ensuring minimum quality standards
    - **Evaluation artifacts**: Creates `BOT-EVALUATION.md` (quality assessments) and `BOT-NOTES.md` (execution observations) for metrics analysis
    - **Color-coded output**: Green (≥85), yellow (70-84), red (<70) score display in console
    - **Honest scoring**: Evaluation criteria emphasize realistic assessment (most work scores 70-85, not inflated)
    - **Metrics-ready data**: Structured `EvaluationResult` and `ExecutionObservation` in state file for `plan2code-metrics` analysis
  - Bot-friendly skill installation (copies plan2code skills with `disable-model-invocation` stripped)
  - Implement step loops up to 10 passes until all phases are complete
  - Installer integration: `C > B` menu option to install bot CLI only

## v1.10.0

### ✨ Added

- **Retry logic with escalating timeouts in loop controller** — Timed-out iterations now retry automatically instead of silently continuing
  - Default base timeout reduced from 30 minutes to 3 minutes per attempt
  - Up to 5 retry attempts per iteration (configurable via `maxRetries`)
  - Each retry escalates timeout by +30 seconds (attempt 0 = base, attempt 1 = base + 30s, etc.)
  - New `executeWithRetry()` method wraps `executeIteration()` with retry loop
  - Fatal timeout (all attempts exhausted) stops the loop cleanly with a logged error
  - Spinner displays elapsed seconds during each attempt; retries show attempt count
  - `maxRetries` field added to `SessionConfig` and `DEFAULT_CONFIG`

### 🔧 Changed

- **Append-only scratchpad enforcement in loop prompt templates** — Both task-mode and phase-mode templates now explicitly prohibit editing or reorganizing existing scratchpad content
  - Instruction changed from "append to scratchpad.md" to "add a new entry at the **bottom**"
  - Added rule: "Never edit, reorganize, or insert into existing content — only append new entries to the end of the file"
- **AGENTS.md restructured into progressive discovery format** — AGENTS.md converted to a lightweight index with summaries and markdown links; full detail moved to `.agents-docs/` section files
  - `.agents-docs/AGENTS-architecture.md` — Architecture overview and key design decisions
  - `.agents-docs/AGENTS-code-style.md` — Code style conventions
  - `.agents-docs/AGENTS-development-commands.md` — Development commands and setup
  - `.agents-docs/AGENTS-plan2code-loop.md` — Loop CLI architecture and commands
  - `.agents-docs/AGENTS-plan2code-metrics.md` — Metrics toolchain details
  - `init-update` prompt updated with `.agents-docs/` detection in pre-flight check
- **Agents mode emoji updated** — Loop controller agents-mode indicator changed from wheel to hammer

## v1.9.1

### ✨ Added

- **Pi (pi.dev) platform support** — New target for the Pi terminal-based coding agent
  - Local prompt templates installed to `.pi/prompts/` (flat `.md` with YAML `description` frontmatter)
  - Global prompt templates installed to `~/.pi/agent/prompts/`
  - Pi users already get skill support via existing `.agents/skills/` target; this adds native slash command access
  - No new helper functions needed — Pi uses the same flat-file-with-YAML pattern as Windsurf, Copilot CLI, and Codeium

### 📚 Documentation

- `AGENTS.md` Platform-Specific File Formats table updated with Pi row
- `README.md` Supported Platforms list updated with Pi (pi.dev)
## v1.9.0

### ✨ Added

- **Progressive discovery for AGENTS.md** — Init and init-update prompts now generate AGENTS.md as a lightweight index with summaries and markdown links, plus `.agents-docs/` section files containing full detail
  - **Init prompt** — New `## Progressive Discovery` section defines index format, always-inline sections (Project Overview, Git Commit Messages, How to Use This File), `.agents-docs/` directory setup, grouping heuristics, and opt-in restructure offer for existing single-file AGENTS.md
  - **Init-update prompt** — `.agents-docs/` detection in pre-flight check, legacy migration offer, edit routing (inline sections → AGENTS.md, detailed sections → `.agents-docs/` files), section file lifecycle (create, delete, orphan cleanup), enhanced summary with file count, new update rule 9 (route edits to correct file)
  - **Reference templates** updated in both prompts to include `.agents-docs/` in the bullet list
  - **"How to Use This File"** added as a required content section in generated AGENTS.md files

## v1.8.2

### 🐛 Fixed

- **Inflated metrics task counts** — Metrics collector regex now matches only `**Task X.N:**` checkbox items instead of all checkboxes, fixing ~100-200% count inflation from prerequisite and acceptance criteria checkboxes
  - `collectStep2` (`tasks_per_phase`) uses Task-pattern-only regex
  - `collectStep3` (`phaseTotal`, `phaseCompleted`, `blockerCount`) all use Task-pattern-only regex
  - Step 4 overview fallback left unchanged (correctly counts Phase Checklist checkboxes)

### 🔧 Changed

- **Document workflow** — Checkbox format `- [ ]` now restricted to Task items only; Prerequisites, Acceptance Criteria, and Success Criteria use plain bullet lists (no checkboxes)
- **Implement workflow** — Prerequisite verification changed from checkbox-based (`[x]`/`[?]`/`[!]`) to inline annotation approach (`VERIFIED`/`ASSUMED: [reason]`/`BLOCKED: [reason]`); added clarifying note that checkbox states apply to Task items and Phase Checklist only
- **Finalize workflow** — Task completion audit now specifies counting only `**Task X.N:**` checkbox items
- **Loop prompt templates** — Both task-mode and phase-mode templates updated: prerequisites use plain bullets with inline annotations instead of checkboxes; Checkbox States section scoped to "Task items only"

## v1.8.1

### ✨ Added

- **User feedback collection** — Optional 1-10 rating with reason, what went well, and what went poorly
  - Finalize prompt (Step 5) asks for optional feedback before archival, writes structured table to `overview.md`
  - Collector parses `## User Feedback` table from `overview.md` into `RunMetrics.user_feedback`
  - Aggregator computes `avg_user_rating` and `feedback_count` per cohort
  - CLI offers interactive feedback collection if none found during metrics collection
  - Analysis and improvement prompts reference `avg_user_rating` metric target (≥ 7.0)
  - `UserFeedback` type exported from public API
- **Pipe-safe feedback parsing** — User text containing `|` characters is escaped on write and correctly unescaped on parse using negative lookbehind regex

### 🐛 Fixed

- **Duplicate run files** — Interactive feedback no longer creates a second run JSON; the original is deleted before re-collecting
- **Finalize step ordering** — Feedback collection moved to Step 5 (before archival at Step 6), ensuring `overview.md` is written while still in the active spec directory

## v1.8.0

### ✨ Added

- **plan2code-metrics** — New recursive self-improvement toolchain for plan2code contributors (`plan2code-metrics/`)
  - Fully interactive menu-driven CLI — no flags, all inputs collected via prompts
  - **Collect** metrics from completed project specs (plan, document, implement, finalize steps)
  - **Import** run data from other projects for cross-project aggregation
  - **View** metrics status with health indicators and generation-over-generation deltas
  - **Analyze** weak steps via AI-powered diagnosis (Claude Code or GitHub Copilot CLI)
  - **Generate** surgical improvement proposals with automatic validation (char count limits, edit verification)
  - **Review and apply** proposals with interactive diff review
  - Cohort-based aggregation groups runs by prompt generation (SHA fingerprint of prompt files)
  - Supports both Claude Code and GitHub Copilot CLI as AI backends
  - Standalone TypeScript package with tsup build (ESM), installed via `npm link`

### 🔧 Changed

- **plan2code-4--finalize.md** — Added "Metrics Capture (Contributors)" note in Step 6 directing contributors to run `plan2code-metrics` after finalization
- **plan2code-loop index.ts** — Added dim hint "run plan2code-metrics" after session summary

## v1.7.0

### ✨ Added

- **4 new platform targets** — Gemini CLI, Crush, Amp, and OpenCode now supported
  - Gemini CLI installs as TOML commands (`.gemini/commands/plan2code-*.toml`)
  - Crush installs as skill subdirs (`~/.config/crush/skills/` on Unix, `%LOCALAPPDATA%\crush\skills\` on Windows)
  - Amp and OpenCode covered via shared Agent Skills target (`.agents/skills/`)
- **Claude Code Skills format** — Migrated from flat `.claude/commands/*.md` to `.claude/skills/<skill-name>/SKILL.md` with `disable-model-invocation: true` frontmatter
- **Agent Skills cross-tool target** — Single `.agents/skills/` install covers Amp, Gemini CLI, and OpenCode simultaneously
- **Legacy cleanup** — Old `.claude/commands/plan2code-*.md` files automatically removed on install and uninstall
- **TOML generation** — New `generateTomlContent()` produces Gemini CLI command files using TOML literal multi-line strings

### 🔧 Changed

- `AGENTS.md` Platform-Specific File Formats table expanded to 5 columns with 4 new platform rows
- `docs/index.html` hero section updated with 4 new platform pills
- `README.md` Supported Platforms list updated with 4 new platforms

## v1.6.2

### 🔧 Changed

- **Installer menu simplified** — Replaced the 7-platform picker with a clean 4-option menu (I/U/C/Q)
  - `I` — Install Plan2Code for all platforms + loop CLI
  - `U` — Uninstall (with confirmation prompt)
  - `C` — CUSTOM sub-menu: `L` (local install instructions), `O` (loop CLI only), `Q` (back)
  - `Q` — Quit
  - Any CLI arguments (e.g. `--dry-run`, `--platform`) are now silently ignored; installer always runs interactively
- **README installation section** — npx install method promoted to primary recommended install path; updated menu example

### 🗑️ Removed

- CLI flags `--dry-run`, `--platform`, `--local`, `--uninstall`, `--help`, `--loop`, `--uninstall-loop` (all removed; installer is always interactive)
- `displayHelp()` function removed from `install.js`

## v1.6.1

### ✨ Added

- **NPX installation support** - Team members can now install directly from GitHub without cloning
  - Added `name`, `version`, and `bin` fields to `package.json` for npm compatibility
  - Installation via `npx git+ssh://git@github.com/jparkerweb/plan2code.git` (SSH)
  - Installation via `npx git+https://github.com/jparkerweb/plan2code.git` (HTTPS)
  - Installer runs from temporary location and cleans up automatically
  - Updated README.md with Quick Start section showing both authentication methods
  - Added `.npmignore` file to suppress npm warnings during npx execution

## v1.6.0

### 🏎️ Improved

- **Reduced workflow file sizes** - All 4 over-target source prompts compressed to ≤ 11,000 characters for Windsurf IDE compatibility (12,000 char limit minus header buffer)
  - `plan2code-3--implement.md` - 14,806 → 8,533 chars (42% reduction)
  - `plan2code-1--plan.md` - 13,587 → 10,348 chars (24% reduction)
  - `plan2code-4--finalize.md` - 12,012 → 8,586 chars (29% reduction)
  - `plan2code-2--document.md` - 11,842 → 9,031 chars (24% reduction)
  - All functional workflow behavior preserved
  - Compression techniques: template-to-section-list specs, removed bad examples, consolidated redundant sections, simplified decorative boxes, imperative directives

### 🧪 Testing

- **Pre-commit character count validation** - Husky pre-commit hook prevents workflow files from exceeding 11,000 characters
  - `scripts/validate-char-count.js` - Cross-platform Node.js validation script using only built-in modules
  - `.husky/pre-commit` - Git hook trigger calling the validation script
  - Root `package.json` with husky as sole devDependency (`private: true`)
  - `.gitignore` updated with `node_modules/` and `package-lock.json`

## v1.5.4

### ✨ Added

- **AI Assisted commit attribution** - All git commit messages now include an `AI Assisted` footer for transparency
  - **Init mode** - Generated AGENTS.md files include a Git Commit Messages section instructing agents to always append `AI Assisted`
  - **Init-update mode** - New "Git Commit Messages" menu option (option 7) for adding or modifying commit message conventions
  - **Loop task mode** - `createTaskCommit()` automatically appends `AI Assisted` footer to every commit
  - **Loop phase mode** - Prompt template instructs LLM to include `-m "AI Assisted"` as final flag on every commit
  - **Implement mode** - User-facing git commit suggestions after phase approval include `-m "AI Assisted"`

### 🔧 Changed

- **README loop install instructions** - Replaced inline text with formatted code block showing both install options

## v1.5.3

### ✨ Added

- **Loop mode selection** - Plan2Code Loop now asks users to choose between two loop modes:
  - **One task per loop** (default) - Each agent invocation implements exactly one task. Node controller handles git commits after each task. Same behavior as before.
  - **One phase per loop** - Each agent invocation implements all remaining tasks in the current phase. The LLM handles git commits after each task (with JIRA ticket ID). Ideal for related tasks and smart models with higher context windows.
- **Phase-mode prompt template** - New `LOOP_PROMPT_TEMPLATE_PHASE` instructs the LLM to complete all tasks in the current phase, create git commits per task, and output `TASK_COMPLETE` markers for each
- **Multi-marker completion detection** - New `checkForAllCompletions()` function parses all `TASK_COMPLETE`, `TASK_BLOCKED`, and `PREREQ_COMPLETE` markers from a single agent output
- **`PHASE_COMPLETE` marker** - New completion marker for phase mode indicating current phase is done (distinct from `LOOP_COMPLETE` which means all phases done)
- **`loopMode` config field** - New `SessionConfig.loopMode` field (`'task' | 'phase'`) persisted in session state for resume support
- **Documentation auto-discovery** - Documentation workflow now auto-discovers features to document
  - Automatically finds `specs/*/PLAN-DRAFT-*.md` files
  - If only one feature exists, uses it without prompting
  - If multiple features exist, presents list and asks user to choose
  - Automatically reads `PLAN-CONVERSATION-*.md` if present (optional, for context)
- **Documentation Verification Pass** - Documentation workflow now cross-references against PLAN-DRAFT before finalizing
  - New Process Step 7 with sub-steps: 7A (re-read PLAN-DRAFT), 7B (cross-reference sections), 7C (fix gaps), 7D (output summary)
  - New "Documentation Verification Pass" section with mapping table showing which PLAN-DRAFT sections to verify against which spec files
  - Gap handling: Missing items added with `<!-- VERIFICATION: Added - FR-X from PLAN-DRAFT -->` markers
  - Session end output now includes verification summary table showing Items in PLAN-DRAFT / Covered / Added per section
  - Added reminders: "Always run verification pass before finalizing" and "PLAN-DRAFT is the source of truth"
- **Conversation Logging** - Planning workflow now saves the full planning conversation before creating PLAN-DRAFT
  - New file: `specs/<feature-name>/PLAN-CONVERSATION-<YYYYMMDD>.md` created in Phase 7
  - Contains full conversation transcript organized by phase with speaker attribution (`[AGENT]` vs `[USER RESPONSE]`)
  - Decision summary tables with user quotes, confirmed requirements, approved technologies, and assumptions
  - Serves as source of truth for plan verification
- **PLAN-DRAFT Verification Pass** - New STEP 7C verifies PLAN-DRAFT against conversation log
  - Cross-references all requirements, tech decisions, risks, and assumptions
  - Missing items added with `<!-- VERIFICATION: Added from Phase X -->` markers
  - Outputs verification summary showing what was captured vs added
- **Conversation Log field in PLAN-DRAFT** - New header field links to the conversation log file

### 🔧 Changed

- **Installer default option** - Pressing Enter without selecting an option now defaults to `A` (Install to ALL platforms + loop CLI) instead of quitting
- **Planning output location changed** - PLAN-DRAFT and conversation log now created in feature subdirectory
  - New location: `specs/<feature-name>/PLAN-DRAFT-<date>.md` and `specs/<feature-name>/PLAN-CONVERSATION-<date>.md`
  - Date format: YYYYMMDD (e.g., `20250204`) instead of full timestamp
  - Uppercase `PLAN-CONVERSATION` for consistency with `PLAN-DRAFT`
  - Feature directory created during planning (Step 1) instead of documentation (Step 2)
  - Documentation step no longer archives PLAN-DRAFT (already in correct location)
- **Planning Phase 7 restructured** - Now has three sub-steps:
  - STEP 7A: Save Conversation Log (new)
  - STEP 7B: Create PLAN-DRAFT (existing behavior, uses same timestamp)
  - STEP 7C: Verification Pass (new)
- **Session End example updated** - Now shows both conversation log and PLAN-DRAFT files
- **Important Reminders expanded** - Added reminders about conversation log and verification pass

### 🐛 Fixed

- **`.gitignore` missing `specs/` entries in phase mode** - `ensureGitignore()` only ran inside `createTaskCommit()`, which is never called in phase mode. Moved `ensureGitRepo()` and `ensureGitignore()` to run once at startup in `Controller.run()` as a pre-flight step, ensuring `.gitignore` entries are set before the first iteration regardless of loop mode

## v1.5.2

### ✨ Added

- **AI Agent File Sync** - Init and Init-Update workflows now detect and sync other AI agent config files
  - Detects 6 file types: CLAUDE.md, GEMINI.md, .cursorrules, .github/copilot-instructions.md, .cursor/rules/, .windsurf/rules/
  - Offers to replace with references to AGENTS.md as single source of truth
  - User confirmation required before any modifications
  - Correct relative paths for each file location (./AGENTS.md, ../AGENTS.md, ../../AGENTS.md)
- **Knowledge Transfer** - Init mode now uses existing CLAUDE.md content as context when creating new AGENTS.md
  - Preserves project knowledge during migration to AGENTS.md

## v1.5.1

### ✨ Added

- **Prerequisite verification workflow** - Agents now verify/complete prerequisites before starting phase tasks
  - Implementation mode processes prerequisites in order: verify, complete, or mark assumed
  - Loop prompt treats prerequisites as "Task 0.X" - one per iteration before tasks
  - New completion markers: `PREREQ_COMPLETE` and `PREREQ_ASSUMED`
- **New checkbox state `[?]`** - "Assumed complete, couldn't verify" for prerequisites that can't be validated
  - Use when prerequisite cannot be programmatically verified (e.g., "Design approved by stakeholder")
  - Agents skip `[?]` items like `[x]` items
- **Re-opened phase handling in Revision mode** - Properly handle adding tasks to completed phases
  - New "Re-opening" impact type (Medium-High risk) in impact assessment
  - New tasks in completed phases get `🆕 ADDED` flag
  - Phase checkbox changes from `[x]` to `[ ]` in overview.md when new tasks added
  - "Phases Re-opened" section in revision summary
  - Consistency check now verifies phase completion status matches task completion

### 🔧 Changed

- **Installer UI refresh** - Cleaner, narrower layout for better terminal compatibility
  - Narrower menu boxes (65 characters instead of 76)
  - Smaller mascot display at end of installation
  - Added first-time user documentation link after successful install
  - Updated menu descriptions to show "+ loop CLI" for relevant options
- **Planning workflow guardrails** - Prevent users from skipping the documentation step
  - Added critical reminder after Phase 7 to direct to `/plan2code-2--document`
  - Added workflow order reminder in Session End section: Plan → Document → Implement → Finalize
  - Updated example closing message to emphasize documentation as next step
  - Added workflow order to Important Reminders section
- **AGENTS.md pre-flight message** - Improved guidance for new projects
  - Message now explains that new projects can continue without AGENTS.md
  - Suggests creating basic AGENTS.md first with rules can still be valuable

## v1.5.0 - 2026-01-22

### ✨ Added

- **Plan2Code Loop** - New autonomous CLI tool for hands-off spec implementation
  - Separate Node.js/TypeScript tool in `plan2code-loop/` directory
  - LLM-driven task discovery - AI reads spec files and finds unchecked tasks
  - Iterates through tasks one at a time, marking checkboxes as complete
  - Structured completion markers: `TASK_COMPLETE: 1.1 - description`
  - Session persistence with scratchpad and iteration logging
  - Supports Claude Code and GitHub Copilot CLI agents
- **Installer integration** for loop CLI
  - Option `A` now installs prompts to all platforms AND builds/links the loop CLI
  - Option `O` builds and links plan2code-loop CLI only
  - Option `U` uninstalls prompts AND unlinks the loop CLI

### 📝 Documentation

- Updated README.md with "Autonomous Loop" section explaining when to use loop vs manual Step 3
- Updated QUICK-REFERENCE.md with loop commands and decision tree
- Updated AGENTS.md with loop architecture, commands, and completion markers

## v1.4.0 - 2026-01-09

### ✨ Added

- **Parallel Phase Execution** - Run multiple implementation phases simultaneously in separate agent instances
  - Documentation Mode auto-detects parallel-eligible phases based on file conflicts and dependencies
  - Implementation Mode presents phase selection UI when parallel options are available
  - New "Parallel Execution Groups" section in `overview.md` tracks which phases can run together
  - Conflict detection criteria: file overlap, prerequisite dependencies, data/output dependencies, shared state
  - Users can start multiple `/plan2code-3--implement` sessions to work on different parallel phases
- **In-Progress Phase Tracking** - Track which phases are actively being worked on
  - New `[/]` checkbox status indicates a phase is in-progress (between `[ ]` pending and `[x]` complete)
  - Phases marked `[/]` when an agent starts working, `[x]` when user approves completion
  - Aborted phases stay `[/]` to enable resume - never reset back to `[ ]`
  - Parallel selection UI shows `[IN PROGRESS]` vs `[AVAILABLE]` status for each phase
  - Single in-progress phase prompts user to confirm resume (prevents accidental overlap)
  - Supports multiple agent sessions on parallel phases with clear visibility of what's active

### 🔧 Changed

- **Documentation Mode process** - Added step 6 "Analyze phases for parallel execution eligibility"
- **Implementation Mode detection** - Now checks for parallel siblings before starting phase
- **Implementation Mode phase selection** - 4-case decision logic for parallel, resume, auto-start scenarios
- **Session end summaries** - Documentation Mode now reports parallel execution groups
- **Abort handling** - Phases remain `[/]` on abort with clear resume instructions

## v1.3.3 - 2025-12-30

### ✨ Added

- **Learning Capture Protocol** - Replaced simple "Session Hint" with structured learning capture
  - Auto-capture triggers checklist (undocumented commands, gotchas, patterns, workarounds)
  - Formatted capture template with category, learning, and context
  - Inline `AGENTS.md` updates without requiring init-update mode switch
  - Applied to Implementation (Step 3) and Finalize (Step 4) modes

### 🔧 Changed

- **Archive path includes timestamp** - Specs now archived to `specs--completed/<feature-name>-<timestamp>/`
  - Prevents overwriting when re-implementing same feature
  - Preserves history of multiple implementation attempts
- **Clearer session end instructions** - Planning mode (Step 1) now explicitly says "ALWAYS tell the user"
- **Simplified next command reference** - Removed "or equivalent" from next step instructions

## v1.3.2 - 2025-12-25


### 🔧 Changed

- **Phase file naming convention** - Changed from `Phase X.md` to `phase-X.md` (lowercase, hyphen instead of space)
  - Affects generated spec files in `specs/<feature-name>/`
  - Updated references in documentation, implementation, and finalization modes
- **PLAN-DRAFT auto-archiving** - Planning documents are now automatically archived without prompting
  - Moves `specs/PLAN-DRAFT-<timestamp>.md` to `specs/<feature-name>/PLAN-DRAFT.md` after documentation step
  - Removed user prompt asking to delete/archive/keep

### 📦 Updated

- Improved uniformity of Prompt files

## v1.3.1 - 2025-12-19

### ✨ Added

- **Init-update mode** (`/plan2code---init-update`) - Interactive workflow to update existing AGENTS.md files
  - Detects recent work context and suggests relevant additions
  - Menu-driven update options: Commands, Architecture, Gotchas, Testing, Environment, General Rules
  - Review and prune options for existing content
  - Confirms changes before applying
  - Prefix: None (utility command)
- **Session hints** in Steps 2, 3, 4 - Prompts to run `/plan2code---init-update` after discovering project insights
- **AGENTS.md pre-flight check** in Quick Task and Planning modes
  - Checks for `./AGENTS.md` at session start
  - Offers to run `/plan2code---init` before continuing if not found
- **VS Code Copilot global support** - New platform for VS Code's custom prompts feature
  - Files installed to platform-specific VS Code config directory:
    - Windows: `%APPDATA%\Code\User\prompts\`
    - macOS: `~/Library/Application Support/Code/User/prompts/`
    - Linux: `~/.config/Code/User/prompts/`
  - Uses VS Code custom prompt format with `agent: agent` header
  - File extension: `.prompt.md`
  - Platform ID: `vscode-copilot`
- **Dynamic path resolution in install.js** - Added helper functions for targets with platform-specific paths
  - `getVSCodeCopilotDir()` - Returns correct VS Code config path per platform
  - `resolveTargetDir()` - Handles both static and dynamic directory configurations
  - `getDisplayPath()` - Returns human-readable path for display

### 🔧 Changed

- **install.js interactive menu** - Now shows 6 platforms (added VS Code Copilot)
- **Help text updated** - Valid platform IDs now include `vscode-copilot`
- **Merged `sync-prompts.js` into `install.js`** - Distribution files are now generated on-the-fly
  - No longer need to run a separate sync script before installation
  - `dist/` folder is now gitignored (generated dynamically)
  - Removed `src/sync-prompts.js` (functionality merged into `install.js`)
- **Added `--local` option** - Show instructions for project-level (local) installation
  - Generates `dist/local-commands/` and displays copy/paste instructions
  - Available via `node install.js --local` or interactive menu option `L`
- **Updated interactive menu** - Added "L. LOCAL" option for local installation instructions

### 🗑️ Removed

- **`src/sync-prompts.js`** - No longer needed; functionality merged into `install.js`
- **`dist/` from version control** - Now generated dynamically during installation

## v1.3.0 - 2025-12-18

### ✨ Added

- **AGENTS.md Integration** - All workflow prompts now check for and follow project-specific agent instructions
  - Added rule: "If a `./AGENTS.md` file exists, follow the rules, guidelines and documentation in it"
  - Applied to Steps 1, 2, 3, and 4 (plan, document, implement, finalize)
  - Enables project-specific customization while maintaining consistent workflow methodology
- **Init mode** (`/plan2code---init`) - New command to generate AGENTS.md files for projects
  - Analyzes codebase structure and common development commands
  - Extracts important details from existing docs (README, PROJECT.md, etc.)
  - Creates focused, actionable guidance for AI agents (under 500 lines)
  - Prefix: None (utility command)

### 🔧 Changed

- **Moved source prompts to `src/` directory** - Cleaner project structure separating source files from distribution
  - All `plan2code-*.md` files now live in `src/`
  - `sync-prompts.js` moved to `src/sync-prompts.js`
  - Run with `node src/sync-prompts.js` (was `node sync-prompts.js`)
  - `install.js` remains in project root
- **Sync script now cleans dist folders before syncing** - Ensures no orphaned files from previous syncs
  - Deletes `dist/local-commands/` and `dist/global-commands/` before regenerating
  - Prevents old/renamed files from lingering in distribution
- **Added `version.json`** - Centralized project metadata file
  - Contains name, version, description, author, license, etc.
  - Version displayed in install.js TUI header
- **Renamed Quick Task command** - `plan2code-0--quick-task` → `plan2code---quick-task`
  - Removed number prefix for better categorization (utility/standalone mode)
  - Maintains same functionality (lightweight planning for small tasks)
- **Renamed Revision command** - `plan2code-1b--revise` → `plan2code-1b--revise-plan`
  - Clearer name indicating it revises planning specs
  - Maintains same functionality (modify specs mid-implementation)

### 📚 Documentation

- Commands table updated to reflect new naming convention
- README.md updated with new command references and `src/` paths
- QUICK-REFERENCE.md updated with new command names
- CLAUDE.md updated with new development commands and file locations
- **Landing page updated** (`docs/index.html`)
  - Added terminal UI screenshot showing the interactive installer
  - Added code block with full installation steps (clone, cd, run)

## v1.2.1 - 2025-12-17

### 🔧 Changed

- **Reorganized distribution files into `dist/` folder** - Cleaner project structure separating source from generated files
  - `local-commands/` → `dist/local-commands/`
  - `global-commands/` → `dist/global-commands/`
- **Updated `sync-prompts.js`** - Now outputs to `dist/local-commands/` and `dist/global-commands/`
- **Updated `install.js`** - Now reads from `dist/global-commands/`
- **Simplified implement/finalize workflow** - Now only requires `overview.md` path instead of both `overview.md` and `Phase X.md`
  - Auto-detects next uncompleted phase from Phase Checklist in overview.md
  - Automatically reads corresponding `Phase X.md` file
  - Reduces user friction when continuing between phases
- **Updated Next Steps sections** across all prompts to show simplified workflow
  - Step 2 (Document): Now instructs to provide only `overview.md`
  - Step 1b (Revise): Now instructs to provide only `overview.md`
  - Step 3 (Implement): Session end boxes updated with auto-detect messaging
  - Step 4 (Finalize): Incomplete implementation box updated

### 📚 Documentation

- Updated CLAUDE.md with new `dist/` paths for all references
- Updated README.md installation commands (30+ path references updated for both Unix and Windows)
- Updated QUICK-REFERENCE.md commands table (Steps 3 & 4 now show `overview.md` as input)
- Updated README.md workflow examples to show new `[Provide: overview.md]` pattern
- Updated README.md "What to Attach" table with simplified requirements
- Updated README.md troubleshooting section

## v1.2.0 - 2025-12-14

### ✨ Added

- **Quick Task mode** (`/plan2code-0--quick-task`) - Lightweight planning for small tasks that don't need the full 4-step workflow
  - Standalone mode (doesn't create spec files)
  - Conversational output with implementation plan
  - **Scope validation** with thresholds (≤3 components, ≤2 integrations, ≤15 tasks, ≤8 files)
  - **Escalation path** to full planning - creates PLAN-DRAFT and hands off to Step 1
  - Prefix: `🚀`
- **Revision mode** (`/plan2code-1b--revise`) - Structured way to modify specs mid-implementation
  - 5-step formal process: Change Analysis → Impact Assessment → Execute Revisions → Consistency Check → Summary
  - Batch approval workflow
  - Tracks revision history in overview.md
  - Prefix: `🔄 [REVISION]`
- **Requirements Sign-Off gate** in Planning Phase 1 - User must explicitly approve requirements before Phase 2
- **Escalated PLAN-DRAFT recognition** - Planning mode detects and resumes from Quick Task escalations
- **Good/bad examples** added to Steps 1, 3, and 4 for clearer AI guidance
- **Clarification loop protocol** in Step 1 with max 3 rounds per phase
- **Devil's Advocate check** in Planning Phase 5 (Architecture Design)
- **Error recovery tables** in all prompts' Abort Handling sections
- **Quick Reference card** (`QUICK-REFERENCE.md`) for at-a-glance command reference
- **Revision reminders** in Step 3 completion messages
- **Copilot CLI global support** - Now installs to `~/.copilot/agents/` for global access
- **`install.js`** - New interactive installation script for global setup
  - Interactive menu when run without arguments
  - Select individual platforms (1-5), multiple (comma-separated), or ALL (A)
  - Uninstall option (U) to remove installed files
  - Non-interactive flags: `--platform X`, `--dry-run`, `--uninstall`
- **`local-commands/`** directory - Pre-formatted files for project installation
- **`global-commands/`** directory - Pre-formatted files for home directory installation

### 🔧 Changed

- **Standardized section headers** across all prompts:
  - Role → Rules → Examples → Process → Templates → Session End → Abort Handling → Recovery → Important Reminders
- **Condensed templates** for token efficiency (~30% reduction in template verbosity)
- **`sync-prompts.js` restructured** - Now only writes to `local-commands/` and `global-commands/` (removed project root platform directories)
- **Removed platform directories from project root** - No longer syncs to `.claude/`, `.cursor/`, etc. in project root; users copy from `local-commands/` or `global-commands/` instead
- Updated README.md with Quick Reference section and new commands table
- Updated CLAUDE.md with new commands and response prefixes

### 📚 Documentation

- Added QUICK-REFERENCE.md with commands table, mode prefixes, file structure, and troubleshooting
- Expanded README.md workflow table to include Steps 0, 1b
- Updated all installation instructions to use `local-commands/` and `global-commands/`
- Added interactive mode documentation for `install.js`
- Documented Copilot CLI global installation at `~/.copilot/agents/`

## v1.1.1 - 2025-12-11

### 🔧 Changed

- **Phase approval prompt now uses ASCII box** - The "Reply approved" request during implementation sign-off now matches the visual style of other important prompts
- **Cursor: Switched from Rules to Commands** - Now uses `.cursor/commands/` (slash commands) instead of `.cursor/rules/` (MDC rules)
  - Commands support global installation at `~/.cursor/commands/`
  - Better aligns with how other tools handle workflows/slash commands
- **Archived specs folder renamed** - Changed from `specs/completed/` to `specs--completed/`
  - Simplifies folder structure by avoiding nested directories
  - Eliminates need for exclusion rules when searching `specs/`

### 📚 Documentation

- **Corrected global installation support** - Verified which tools actually support global installation:
  - ✅ **Claude Code**: `~/.claude/commands/`
  - ✅ **Cursor**: `~/.cursor/commands/` (commands, not rules)
  - ✅ **Continue**: `~/.continue/prompts/`
  - ✅ **Windsurf**: `~/.codeium/windsurf/global_workflows/`
  - ❌ **GitHub Copilot**: Project-only (`.github/agents/` and `.github/prompts/`)
  - ❌ **Antigravity**: Project-only (`.agent/workflows/`) - global path not well documented
- Updated Quick Start commands to only include tools that support global installation
- Added Windows-specific installation commands (PowerShell and Command Prompt)
- Added troubleshooting entry for unrecognized slash commands/workflows

## v1.1.0 - 2025-12-11

### ✨ Added

- **Testing Strategy support** - Optional testing preferences during planning phase
  - Test types selection (Unit, Integration, E2E, or None)
  - Phase testing option (run tests at end of each phase)
  - Coverage target selection (Critical paths, Moderate, Comprehensive)
  - Testing tasks automatically added to phase specs when enabled
- **User sign-off requirement** for implementation phases
  - Phases marked "Ready for Sign-Off" instead of auto-completing
  - User must reply "approved" before phase is marked complete
  - Test failure handling: user chooses to fix, document, or investigate
- **Enhanced overview.md structure** - Now includes:
  - Architecture Pattern and Component Overview sections
  - Risks and Mitigations table
  - Success Criteria checklist
- **Improved "Next Steps" formatting** - ASCII box format for clearer guidance at workflow transitions

### 🔧 Changed

- Implementation mode no longer auto-marks phases complete; requires explicit user approval
- Self-review checklist now includes test execution verification
- Completion report format updated to show test results table when applicable
- Spec auto-detection now explicitly excludes `specs--completed/` folder

### 📚 Documentation

- Added Testing Strategy section (2.4) to PLAN-DRAFT template
- Added Phase Testing task block template for phase specs
- Expanded special cases documentation for testing task generation

## v1.0.4 - 2025-12-07

### 📦 Updated

- Added explicit transition check to `Planning Phase 6` - when confidence >= 90%, the model now asks the user for confirmation before proceeding to create the PLAN-DRAFT document

## v1.0.3 - 2025-12-05

### 📦 Updated

- Improved spec file referencing in Documentation and Implementation modes - users can now reference either a `specs/<feature-name>/` folder or individual files
- Implementation mode now auto-detects single spec folders before prompting the user for file references

## v1.0.2 - 2025-12-05

### 🐛 Fixed

- Fixed pre-checked prerequisite checkbox in Phase template (`[x]` → `[ ]`) - generated phase documents no longer appear with prerequisites already complete

### 📦 Updated

- Added Session Start logic to Planning Mode - automatically detects and resumes from existing `PLAN-DRAFT-*.md` files
- Replaced vague scope indicators with measurable criteria (phases, requirements, components, integrations)
- Added Large Project checkpoint workflow - projects meeting Large thresholds now checkpoint at Phase 3 and resume in a new conversation
- Added output economy rule - keeps phase responses concise, reserving detailed schemas/APIs for final PLAN-DRAFT
- Updated PLAN-DRAFT template with new status options: `Draft | Phase 3 Complete - Resume at Phase 4 | Complete`

## v1.0.1 - 2025-12-05

### 📦 Updated

- Added Initial Context Check to `Planning Phase 1` - Model now asks about additional files, reference materials, and external integrations before
  analyzing requirements
- Added user verification checklist and git checkpoint to `Implementation Phase 3` - Phase completion reports now guide users through verification and git checkpointing before starting the next phase

## v1.0.0 - 2025-12-04

### ✨ Added

- Initial 4-step workflow methodology for AI-assisted development
  - Step 1: Planning mode with 90% confidence threshold
  - Step 2: Documentation mode for structured implementation specs
  - Step 3: Implementation mode with phase-by-phase execution
  - Step 4: Finalization mode for validation and archiving
- Multi-platform support with pre-configured workflow files:
  - Claude Code CLI (`.claude/commands/`)
  - Cursor AI (`.cursor/rules/`)
  - GitHub Copilot CLI (`.github/agents/`)
  - VS Code Copilot (`.github/prompts/`)
  - Windsurf IDE (`.windsurf/workflows/`)
  - Google Antigravity (`.agent/workflows/`)
  - Continue extension (`.continue/prompts/`)
- `sync-prompts.js` utility to propagate source prompts to all platform directories
