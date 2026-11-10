# Architecture: layout, prompts and install
> Part of [AGENTS.md](../AGENTS.md) and the [Architecture index](./AGENTS-architecture.md): project guidance for AI coding agents.

## Directory Structure

```
plan2code/
├── src/                        # Source workflow prompts (19 markdown files)
│   ├── plan2code-0-pathfinder-references/ # Reference files for pathfinder skill
│   │   ├── brief.md                        # Dated plain-English decision briefs
│   │   ├── chart.md                        # MODE A: destination + frontier grills, templates
│   │   ├── github-issues.md                # Issue-backed map (loaded only when Backend is github)
│   │   ├── grilling.md                     # Folded-in grilling + domain-modeling
│   │   ├── questions.md                    # On-disk question-file format + markers
│   │   ├── resolve.md                      # Per-type resolution + graduating the fog
│   │   ├── handoff.md                      # Clearing gate + PLAN-DRAFT handoff
│   │   └── trail.md                        # Every-response map visual + pathed resume command
│   ├── shared-references/              # Reference files shared across skills
│   │   ├── building-habits.md              # Find the cause, test first, pin behavior (quick-task, implement, implement-review, test)
│   │   ├── helper-strength.md              # How strong a model and how much effort each helper gets (init, init-update, pathfinder, plan, revise-plan, document, quick-task, implement, implement-review, review, finalize, xray, diagnose, pr-prep, test)
│   │   └── test-runs.md                    # Choosing what tests to run: targeted per task and phase, full suite only where the plan puts it (document, implement, implement-review, quick-task, review, finalize, pr-prep, test, dead-code)
│   ├── plan2code-review-references/     # Reference files for review skill
│   │   ├── verification-protocol.md        # Deep verification + confidence calibration
│   │   ├── dimensions.md                   # 11 dimensions with detailed checklists
│   │   ├── false-positives.md              # Known false-positive patterns
│   │   ├── reviewer-brief.md               # Fill-in brief for the one fresh helper that runs the analysis
│   │   └── session-end.md                  # Next-step routing at review session end
│   ├── plan2code-init-update-references/ # Reference files for init-update skill
│   │   └── ai-agent-file-sync.md           # Step 7: replace AI configs with AGENTS.md refs
│   ├── plan2code-4-finalize-references/ # Reference files for finalize skill
│   │   └── community-feedback-submission.md # STEP 6.5 payload schema + submission tiers
│   ├── skill-scripts/                # Scripts shared across skills: install.js copies the ones a skill lists into skills/<skill>/scripts/ (specs, commit-msg, review-scope, agents-md, agent-files, glob, test-map, test-match, test-commands, run-check, common)
│   └── plan2code-<skill>-scripts/    # A skill's own scripts, same copy rule (pathfinder, finalize, changelog, git, xray, pr-prep and test each have one)
├── plan2code-bot/            # Autonomous end-to-end workflow test runner (TypeScript, tsup, Claude Agent SDK, vitest); user docs in .readme/test-bot.md
├── plan2code-metrics/        # Recursive self-improvement toolchain
│   ├── src/                    # TypeScript source
│   │   └── prompts/            # Internal AI prompt templates (no char limit)
│   └── dist/                   # Built output (tsup)
├── plan2code-app/            # Desktop app (Rust + Tauri): wraps the console in a window, agent-less setup screen; cargo fmt/clippy/test, see its README
├── src/statusline-claude/       # Claude CLI status line (Node.js, zero deps, single file)
│   ├── statusline.js           # Self-contained: config, git, formatters, render
│   └── statusline-config.json  # Default config template
├── src/launcher/               # Global `plan2code` command (Node.js, zero deps)
│   ├── plan2code.js            # Opens /plan2code in Claude Code or Devin in the cwd (or a picked folder)
│   ├── agents.json             # Shipped agent list (built-ins + starter templates with per-OS install data), copied to ~/.plan2code/bin/ on install
│   ├── models.json             # Curated model menu, copied to ~/.plan2code/bin/ on install
│   └── plan2code.ico           # Desktop shortcut icon (Windows)
├── src/web-console/            # Local browser UI bundled into every skill (Node.js, zero deps, no build)
│   ├── console.mjs             # CLI the agent drives: open, post, wait, chat, keep, status, stop, help
│   ├── server.mjs, routes.mjs, static.mjs, cmd-*.mjs, picker.mjs, and the by-job files (files, sessions, patches, scan, inbox, workspace, settings, agents, agent-lookup, git-repo, handoffs, in-app, loop-setup, notepads, open-link, pointers, spec-files, update-check)
│   ├── console.md, console-*.md, notes/, building*.md # Agent-facing contract (console.md read once, the rest on demand)
│   └── public/                 # Page assets served to the browser
├── scripts/                    # Development scripts
│   ├── bench-web-console.mjs   # Start-path timing
│   ├── capture-screenshots.mjs # Stages web console screens and saves the docs screenshots (needs a local Chrome or Edge, through `playwright-core`)
│   ├── browser.mjs             # The one place a browser is launched (Chrome, then Edge, through `playwright-core`; `PLAN2CODE_TEST_BROWSER` forces one); page tests, the screenshots and the bench use it
│   ├── css-snapshot.mjs        # Dev-only: every element's computed style on every screen, both themes; take one before a stylesheet move and `--compare` after
│   ├── vendor-codemirror.mjs   # Dev-only: bundles the pinned CodeMirror 6 packages with esbuild into `public/vendor/codemirror.esm.js` (installed in a temp folder from `vendor-codemirror-lock.json`, never in the repo)
│   ├── check-skill-table.mjs   # src/plan2code.md "What each skill reads and writes" table vs each skill's prompt and references
│   ├── parse-check.mjs         # Imports every shipped browser module as real ESM
│   ├── screenshots/            # JSON payloads posted per shot (`ask` reuses `question.json`; `finish` follows `signoff.json`)
│   ├── test-web-console-*.mjs, web-console-test-helpers.mjs  # Web console suites, split by area (the page tests are `-page-*`, the source shape `-shape`), and their shared setup
│   ├── node-test.mjs, page-test-helpers.mjs  # `npm test`'s `node --test`, files at once capped at one per spare core; the page tests' browser sessions and their redraw-safe `styleOf()`, `stylesOf()`, `scrollCard()`
│   ├── test-launcher.mjs, test-getting-started.mjs  # Launcher suite; newcomer docs kept in step
│   ├── test-skill-scripts.mjs, test-script-<skill>.mjs, test-git-repo.mjs, skill-script-helpers.mjs, fixture-helpers.mjs  # Skill script suites and fixtures
│   ├── set-version.mjs, check-doc-size.mjs, check-test-lanes.mjs, test-fast.mjs  # Writes one version into every carrier; holds each .agents-docs file under a size limit; the fast test lane and its two-list check (test-lanes.json)
│   ├── check-versions.mjs, fix-line-endings.mjs, play.mjs  # Version sync across every file that carries it (twelve places, also run by npm test); restores LF everywhere (also pretest + pre-commit); tries the games from src/
│   ├── measure-console-wire.mjs, css-helpers.mjs, ghoul-test-helpers.mjs, fixtures/, console-wire-runs/  # Wire-size probe and its captured runs; shared CSS and Ghoul Rush test helpers; skill-script fixtures
│   └── validate-char-count.js  # Pre-commit character count validator
├── skills/                     # Generated, gitignored build output — one Agent Skill per src/ prompt
│   └── plan2code-<name>/       # SKILL.md plus references/ and scripts/ where present
│                               # Generated by npm run build:skills; consumed by skills add
├── .husky/                     # Git hooks (husky)
│   └── pre-commit              # Runs fix-line-endings, then character count validation
├── .agents-docs/               # The detail files AGENTS.md links to (this file and its siblings)
├── .claude/                    # Repo-local Claude Code config (NOT installed by install.js)
│   └── skills/                 # Maintainer-only dev skills, e.g. plan2code-publish/, plan2code-launcher-update/
├── .github/ISSUE_TEMPLATE/      # bug.yml, idea.yml, config.yml (target of the console's feedback button)
├── .readme/                    # User guides linked from README (web-console.md, web-console-design.md, walkthrough.md, metrics.md, status-line.md, test-bot.md)
├── docs/                       # Landing page `index.html` served at plan2code.jparkerweb.com (GitHub Pages, `CNAME`) and assets
│   └── screenshots/            # Web console screenshots, <shot>-light.webp and <shot>-dark.webp (generated)
├── specs/                      # Feature specs (if any in-progress)
├── install.js                  # Interactive installer (Node.js)
├── package.json                # Root package (husky only, private: true)
├── version.json                # Version metadata
├── CHANGELOG.md, QUICK-REFERENCE.md, LICENSE
├── .gitattributes, .editorconfig  # Pin LF (see Code Style & Gotchas)
├── prototypes/, specs--completed/, dist/  # Local only, gitignored: design prototypes, archived specs, stale pre-2.2 build output. Ignore root dist/.
└── README.md                   # User documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `install.js` | Interactive installer — builds `skills/` from `src/`, then delegates installation to the skills CLI |
| `src/plan2code-*.md` | Source workflow prompts (the "source of truth") |
| `skills/` | Generated Agent Skills, gitignored build output regenerated by the installer (and `npm run build:skills`) before every `skills add` |
| `scripts/validate-char-count.js` | Pre-commit validator ensuring all source prompts ≤ 20,000 chars |
| `version.json` | Version metadata (name, version, description) |
| `QUICK-REFERENCE.md` | User quick-reference card |
| `src/statusline-claude/` | Claude CLI status bar (see [the status line file](./AGENTS-architecture-statusline.md)) |
| `src/launcher/plan2code.js` | Global `plan2code` command that opens the dashboard skill in Claude Code, Devin or Codex (installed by `I` and Advanced → `E`; also via Advanced → `D`). When the desktop app is installed (`~/.plan2code/app/plan2code-app[.exe]`, or the file `PLAN2CODE_APP` names) and a display exists (Windows and macOS always; Linux needs `DISPLAY` or `WAYLAND_DISPLAY`), it opens the app after the agent and model questions with `--project <folder> --agent <id> [--model <id>]` and exits; `--classic` (never forwarded to the CLI) and a failed spawn keep the terminal flow. The app reads all three (`project::launch_choice`): the picker starts on `--agent`, and `--model` applies to that agent on every start and Restart (`AgentManager::set_model`); a model never applies to another agent. Its menu, lookup and no-agent flow come from `agents.json` through `agent-lookup.mjs`, loaded by dynamic `import()` from `~/.plan2code/bin/` (the launcher's one stated exception to its Node-built-ins-only rule; a missing copy falls back to the plain printed install steps) |
| `plan2code-app/` | Tauri desktop app (Rust host, xterm panel, the console's dashboard in a frame; its own README). `RELEASE-CHECKLIST.md` lists the by-hand checks before each release. `src-tauri/src/versions.rs` compares the app's version (`tauri.conf.json`) with the installed skills' (`~/.plan2code/bin/version.json`) for the bar's **Update skills** line, which runs `node ~/.plan2code/bin/plan2code.js update` only when pressed |
| `plan2code-app/src-tauri/src/attention.rs` | The taskbar signal's rules, pure and knowing nothing about Tauri: `Signal` (`busy`, `ready`, `attention`, `plain`), `badge_for(signal, os, enabled)` (Windows: green dot on `ready`, red on `attention`; macOS: red `!` on `attention` only; Linux: count 1 on `attention`), `should_flash(prev, next, focused, enabled)` (once, only on a change into `ready` or `attention` while unfocused) and `dot_rgba()` (the dot's pixels, in the favicon's colors, which a test checks against `public/favicon.js`). `main.rs` applies the result through `set_attention`, `set_taskbar_signal` and `clear_attention_cmd`; the page asks with the `attention` and `taskbar` messages (`public/app-bridge.js`) and the switch is `taskbarSignal` in the app's own `~/.plan2code/app.json`. |
| `plan2code-app/src-tauri/src/quit_prompt.rs`, `task_dialog.rs` | The quit check shown while an agent runs. `quit_prompt(last_signal)` is pure: the page's last taskbar signal `ready` or `plain` is the waiting case ("Done for now?", Info icon), and `busy`, `attention` or none yet is the working case ("Leave while your agent is busy?", Warning icon). `task_dialog.rs` (Windows only) draws it with `TaskDialogIndirect` through `winapi`: a heading, Stay as the default, and the app's icon in the title bar, since the dialog plugin has no heading and Windows copies its icon into the title bar (the warning once showed twice). `confirm_quit` in `main.rs` runs it on its own thread; macOS and Linux use the plugin box with the same words, where Quit stays the default button (putting Stay first would make Esc quit). A page reload or an unanswered page clears the signal to none (`clear_attention`), so the box stays on the working words until the page reports again; `QUIT_OPEN` keeps a second box from stacking |
| `plan2code-app/src-tauri/src/loop_driver.rs` | The Implementation Loop's driver. Its decisions are pure functions and carry the unit tests: `phase_prompt()` (the prompt each fresh phase session starts on), `judge_outcome()` (the skill's `loopOutcome` against the spec's marks and the setup), `expect_patch()` (the `loopExpect` judging criteria stamped into the session so the console refuses a bad report at post time), `silence_expired()`, `should_retry()` (one retry for a crash or silence, never for a real failure), `open_question()` and `stop_line()`. Around them sit the running record (app memory only), the watch thread and the stop and resume entry points. **The app, not the agent, marks a loop phase done and commits it**; the skill only builds and reports |
| `plan2code-app/src-tauri/src/loop_commit.rs` | The loop's commit step, called by `handle_outcome` in a fixed order: prepare (subject, message), stage and check the staged names and sizes against a denylist (`.env*` except `.example`, `.sample`, `.template`; oversized files; a bad list unstages all and stops), save the phase file text, mark done, commit with its own limit, and on a failed commit restore the saved text only if the file still equals what the loop wrote (else stop with "marked, not committed", kept in the reports store). Stop now never commits; `judge_outcome` refuses missing task data and failed tests; the watcher runs under `catch_unwind` and counts unreadable sessions as silence; `loop_state` in `main.rs` redraws the strip after a reload |
| `plan2code-app/src-tauri/src/loop_notify.rs` | The loop's notification: `NotifyKind` (query string, JSON body, Discord, Slack, Teams, Google Chat; its comment lists what a new service needs), `valid_url()`, `valid_param()` (mirrored in `loop-setup.mjs` and `screens/loop-setup.js`), `request_for()` (each kind's address and body) and `send()`, with a 10 second limit and errors that never hold the address. The driver writes the message and calls it from `observe()`, `stop_loop()` and `finish()`. |
| `plan2code-app/src-tauri/src/loop_report.rs` | The loop's report on everything done for the person: one `LoopReport` per build, entries in order (passed, stopped, retried) with findings fixed, skipped and left open, assumptions read from the phase file, and reported decisions. Saved in the console's `loop-reports.json` after every entry, because a project file would dirty the tree Resume needs clean; `finish()` writes it to `LOOP-SUMMARY-<date>.md` and removes the entry. |
| `plan2code-app/src-tauri/src/loop_tools.rs` | What the loop runs on its own, each call with a time limit and its output kept: the spec scripts (`specs.mjs status`, `mark --to done`), `commit-msg.mjs`, git (`add`, `commit`, `status`, the short head), the console's `post` and `open --resume`, and the person's quick check. No shell runs here except the quick check, whose text comes only from `loop-setup.json`, never from a page message |
| `plan2code-app/src-tauri/src/agents.rs` | Agents in the app: `CustomAgent`, the `Agent` handle over built-ins and custom entries, `load_custom_agents`, reading the Agents file below; the shipped `agents.json` read at run time with the baked copy as fallback; `find_on_path`, the Rust twin of `agent-lookup.mjs`'s `findAgent` (PATH, PATHEXT, the saved PATH from `node_check::resolved_path()`, npm's global folder, the install folders), held to `scripts/fixtures/agent-lookup-cases.json`. The console side is `src/web-console/agents.mjs` |
| Desktop app install (`install.js`) | `installDesktopApp()` downloads `plan2code-app-<version>-<windows\|macos\|linux>-<x64\|arm64>[.exe]` and `plan2code-app-<version>-SHA256SUMS.txt` from the GitHub release (`PLAN2CODE_RELEASE_BASE` replaces the URL; the tests serve a stand-in), checks the SHA-256 and places the file in `~/.plan2code/app/` (the old file is renamed aside first, since Windows cannot overwrite a running exe). `app` is an install piece (`INSTALL_PIECES`, after `launcher`), so `plan2code update` updates it with the rest. `install()` asks for it after the command (default yes; a no is kept as `skipped` in `install.json`); unattended it installs it unless it is already recorded or was declined. A failed app never fails the install. `.github/workflows/release-app.yml` builds one file per system (`tauri build --no-bundle`) and the checksum list on a published release, after `scripts/check-versions.mjs --tag` |

### Agents file

`~/.plan2code/agents.json` holds the person's custom agent CLIs. The web console is its only writer (User Preferences → Agents & models, through `POST /agents`); the `plan2code` launcher and the desktop app only read it. Each reader carries its own copy of the rules (`src/web-console/agents.mjs` for the console, a copy in `src/launcher/plan2code.js`, `agents.rs` in the app), and `scripts/fixtures/agents-cases.json` is the contract all three readers' tests load: file normalization with its warnings, `buildArgs` command lines and `makeId` ids. Change a rule in the fixture first.

`src/launcher/agents.json` is the shipped list: `kind: "builtin"` entries (Claude Code, Devin, Codex) with `installUrl`, per-OS `install` lines and `installDirs`, and `kind: "template"` entries other CLIs can be saved from. `install.js` copies it to `~/.plan2code/bin/agents.json` beside `agent-lookup.mjs`, which all JS readers share: `loadAgentList()` reads it, `findAgent()` gives a command its `found` / `outside` / `missing` state (PATH, the saved Windows PATH, npm's global bin, the entry's `installDirs`). The app reads the same JSON with `serde_json` at run time (`include_str!` of the repo file baked in as fallback) and `find_on_path` in `agents.rs` is its Rust twin: `scripts/fixtures/agent-lookup-cases.json`, loaded by `scripts/test-agent-lookup.mjs` and by `cargo test` through `include_str!`, is the contract both lookups are held to.

- **File:** `{ "schema": 1, "agents": [...] }`. Any other schema, text that is not JSON, or `agents` that is not a list gives no custom agents and one warning. A missing file is an empty list with no warning. More than 50 entries: the first 50 are used. Unknown keys, in the file and in an entry, are kept when the console saves.
- **Entry:** `id`, `name` and `command` are required; `args` (default `[]`), `prompt` (default `"/plan2code"`, blank allowed), `bypassArgs` (`[]`), `modelArgs` (`["--model", "{model}"]`) and `models` (`[]`, each `{ id, label? }`) are optional. The three argument fields are lists of text, one list item per argument.
- **Rules:** `id` matches `^[a-z0-9][a-z0-9-]{0,31}$`, is not `claude`, `devin` or `codex`, and is unique; `name` is at most 60 characters and unique ignoring case; `command` is not blank. `makeId(name, taken)` makes the id from the name in kebab case (`agent` when nothing is left), with `-2`, `-3` on a clash, at most 32 characters.
- **Bad entries:** a bad entry is skipped with a warning naming it (`agents[i]`, 0-based) and the rest still load, in all three readers. `POST /agents` instead refuses the save with `{ error, index, field }`, and answers `409` while the file holds something `GET /agents` could not read, unless the body says `replace: true`.
- **Command line:** `buildArgs` returns `args` with `{prompt}` filled (the prompt is appended when no argument holds it, and a blank prompt drops an argument that is exactly `{prompt}`), then `modelArgs` with `{model}` filled when a model is chosen, then `bypassArgs` when checks are off. Arguments travel as a list, never through a shell; the Windows `cmd` wrapper for a `.cmd` or `.bat` belongs to the launcher and the app.

## Workflow Prompts (in `src/`)

| File | Step | Purpose |
|------|------|---------|
| `plan2code.md` | — | The dashboard: opens the web console's skill menu and launches the picked skill into its own session |
| `plan2code-init.md` | Init | Generate AGENTS.md as index + `.agents-docs/` section files (progressive discovery) |
| `plan2code-init-update.md` | Update | Update AGENTS.md with learnings; detects and routes edits to `.agents-docs/` files |
| `plan2code-0-pathfinder.md` | 0 | Chart a foggy idea as a map (local files, or GitHub Issues) of decision questions under `specs/<idea>/pathfinder/`, resolve them one at a time, hand a seeded PLAN-DRAFT to Step 1 |
| `plan2code-quick-task.md` | quick | Lightweight planning for small tasks (standalone — not a pipeline step) |
| `plan2code-1-plan.md` | 1 | Requirements analysis & architecture |
| `plan2code-1b-revise-plan.md` | 1b | Mid-implementation revisions |
| `plan2code-2-document.md` | 2 | Create implementation specs |
| `plan2code-3-implement.md` | 3 | Execute implementation (phase by phase) |
| `plan2code-3-implement-review.md` | 3 | Execute one phase, run focused review and fixes, then request approval |
| `plan2code-review.md` | review | Post-implementation comprehensive review, analyzed by one fresh helper when the tool has one (verified in session; the report says who reviewed) |
| `plan2code-4-finalize.md` | 4 | Validate, summarize, feedback, archive (steps 1–7, +optional 6.5) |
| `plan2code-handoff.md` | handoff | Compact the conversation into a self-contained handoff document for a fresh session |
| `plan2code-xray.md` | xray | Explain how and why an area works (files, commits, PRs via `gh` when present), or rank the rough spots worth fixing into `ARCHITECTURE-BRIEF-<date>.md` for Pathfinder or Plan; never edits code |
| `plan2code-diagnose.md` | diagnose | Find a bug's cause under the find-the-cause-first habit (`references/building-habits.md`) and write it up as `specs/<bug-name>/DIAGNOSIS-<YYYYMMDD>.md` without fixing it, then offer Quick Task to fix it, or Plan when the fix is big. The dashboard scan reports such a folder as spec state `diagnosed` ("Bug diagnosed"), which lights Quick Task (suggested) and Plan. Once Quick Task marks the diagnosis `Fixed` (nothing past it in the folder) the state is `fixed` ("Bug fixed"): no pipeline card lights, the picker never pre-selects it, and Quick Task offers to archive it with `specs.mjs archive` |
| `plan2code-pr-prep.md` | pr-prep | Get a branch ready for review: pick the checks its changes need from the project's `## Test map` (or its config files), let the person trim the plan, run it, give Ready, Ready with notes or Not ready, and write a PR description to copy (following the repo's template) with the create-a-PR link; offers to save `PR-READINESS-<date>.md` into the branch's spec folder; never commits, pushes or opens the PR |
| `plan2code-test.md` | test | Write missing tests: ask where to look, find source files no test covers (matching, plus real coverage when the project already has a coverage tool, offered first), show a plan opening with how this project writes tests, then write and run unit and integration tests; escalates past 8 source files, 8 new test files or 2 runners to a PLAN-DRAFT for Plan, hands a real bug to Diagnose, never changes source code |
| `plan2code-dead-code.md` | dead-code | Find unused code and dead code: use the project's own dead-code tools, one per language that has files (Knip, vulture, cargo check and others), or search by itself, check every item for callers across the project (`references/caller-search.md`), label each Safe to remove, Check first or Warning, remove only what the person picks, then run the tests and build and put back anything that breaks them, then offer a final review of the removals in the same session (Step 7.5, recommended yes; ships `review.md`, `review-in-build.md`, `test-runs.md` and the review references, as Finalize does); never commits, never installs a tool. Scripts: `dead-code.mjs` (own), `test-map.mjs`, `glob.mjs`, `test-commands.mjs`, `run-check.mjs`, `specs.mjs`, `commit-msg.mjs`, `review-scope.mjs` |
| `plan2code-changelog.md` | changelog | Check the CHANGELOG version against the default branch, suggest editable entries for new work, keep `package.json` aligned, offer to commit the result through Git |
| `plan2code-git.md` | git | Branches, pull (with conflict help), push, publish and commits (clear message, suggested splits) on the web console's git board, or plain instructions in the terminal (`switch to main`, `commit and push`); asks before every push, publish and delete |

## Naming Convention

Workflow files follow a strict naming pattern:
- **The hub:** `plan2code.md` (bare name — `bare: true` in `SOURCE_PROMPTS`, no suffix; it is the dashboard the rest hang off, not a step)
- **Utilities:** `plan2code-<name>.md` (single dash)
- **Numbered steps:** `plan2code-<N>-<name>.md` (single dash, number, single dash)

Examples:
- `plan2code-init.md` (utility)
- `plan2code-1-plan.md` (step 1)
- `plan2code-1b-revise-plan.md` (step 1b)

## Reference Files

Some workflows use companion reference files for depth that does not need to load on every invocation. The orchestrator (main workflow file) loads them via `Read` directives during execution.

**Pattern:** `src/<source-filename-without-extension>-references/` (e.g., `plan2code-review-references/`). A file several skills read lives in `src/shared-references/` instead and ships to each through `additionalReferences` (e.g., `building-habits.md` into Quick Task, Implement and Implement + Review).

**How the installer handles them:** the directory is copied verbatim to `skills/<skill-name>/references/`, so `Read references/<file>.md` resolves consistently for every agent. There is one output format, with no flat-file sibling directory or path rewrite.

Reference files are NOT subject to the 20,000 character limit. The review workflow pioneered this pattern (`verification-protocol`, `dimensions`, `false-positives`, `session-end`); the init-update workflow also uses it (`ai-agent-file-sync` for its Step 7), `plan2code-4-finalize.md` uses it for STEP 6.5 (`community-feedback-submission`), and `plan2code-0-pathfinder.md` leans on it hardest (`brief`, `chart`, `github-issues`, `grilling`, `questions`, `resolve`, `handoff`, `trail` — the orchestrator is a dispatcher, the depth lives in the references). Other workflows can adopt it when a source file carries detail that is only needed some of the time. The implement-review skill is a generated composition: `additionalReferences` in `SOURCE_PROMPTS` packages the canonical implement prompt, review prompt, and review reference directory into its own `references/` directory so those workflows are reused without source duplication.

## Shared Console

The web console is built once into `skills/_console/<version>/` and installed by `installSharedConsole()` in `install.js` to `<console home>/<version>/` (`~/.plan2code/console`, or `PLAN2CODE_CONSOLE_HOME`, which tests set). Each skill carries only `src/web-console-stub/console.mjs`, with the version baked in at build. The stub tries `<home>/<version>/` first, then the `console-dir` pointer, and needs a matching `version.txt`; with neither it prints one line and exits 5. Only an installed console's `open` writes `console-dir` (a source checkout's does not, or every stub would point at the checkout). `install()` and `installProjectSkills()` call `installSharedConsole({ sweep: false })` before `skills add` and `sweepOldConsoles()` only after it succeeds, so a failed update leaves the old stubs able to find their old console. A test that runs a built skill's `console.mjs` must point `PLAN2CODE_CONSOLE_HOME` at a folder whose `console-dir` names `skills/_console/<version>/`, and a shared console finds skill files in `~/.agents/skills/`.

## Repo-Local Skills (`.claude/skills/`)

Maintainer-only skills committed to the repo but deliberately excluded from the generated `skills/` product artifact:

- `plan2code-publish/` — publishes a GitHub Release after version files agree.
- `plan2code-changelog/` — validates release classification and keeps version files synchronized.
- `plan2code-launcher-update/`: refreshes the launcher's shipped data: the curated model menu (`src/launcher/models.json`) from `devin models list` and Claude Code's documented model aliases, and the agent list's install data (`src/launcher/agents.json`) re-checked against each vendor's docs, including a re-check of the agents left out as templates (Cursor CLI, Aider) against the template rule. Shows a diff, applies only the changes the maintainer approves, validates both files and runs `npm test`. Terminal only, and it never commits.
- `sync-repo/` — decrypts the protected upstream-sync workflow in memory.

Do not run `skills add` against the repository root: recursive discovery also finds these maintainer skills. `install.js` targets `skills/` and passes explicit workflow names instead. Global install/uninstall cleanup removes `plan2code-*` workflow skills from user skill directories; it never operates on this repository's `.claude/skills/` directory, and `sync-repo` intentionally has no `plan2code-` prefix.

## Global `plan2code` Command

Typing `plan2code` in any directory opens the dashboard skill against the current project, **in that directory**, in one of the built-in CLIs (the shipped `src/launcher/agents.json`, plus any custom entries in `~/.plan2code/agents.json`):

| CLI | Runs |
| --- | --- |
| Claude Code | `claude /plan2code [--permission-mode bypassPermissions] [args]` |
| Devin | `devin [--permission-mode bypass] [args] -- /plan2code` |
| Codex | `codex [--dangerously-bypass-approvals-and-sandbox] [args] $plan2code` (Codex starts a skill with `$name`; the launch line follows Codex's documentation) |

The bracketed flags (each entry's `bypassArgs`; a custom agent's own `bypassArgs`) go in only when permission prompts are off. Right after the agent is chosen, and only when it has such a flag, `chooseBypass()` asks `Turn <CLI>'s permission prompts off?` (Codex: `approval prompts and its sandbox`, worded by `bypassQuestion()`) on every launch, with Yes as the default and no answer remembered; `--keep-permissions` answers no and `--bypass-permissions` answers yes (neither is forwarded; keep wins when both are given), and with no TTY on stdin the prompts stay on unless `--bypass-permissions` is given. When the desktop app will take over, the question is skipped (its launch card has its own tick) and asked only if the app fails to start. The installer prints no warning about it.

On a terminal it first prints a Planny banner (`renderBanner()`). With more than one on `PATH` it asks `Plan2Code opens inside an AI coding agent. Pick which one to use:` as a numbered menu, the last pick pre-selected and marked `(last used)` (Enter keeps it; a number or a CLI id also works); with one installed it uses that without asking, printing `Opening with <CLI>…` (as does a `--cli` pick); with none it runs the setup flow when a person can see a page (`hasDisplay()` and a TTY or the shortcut; the desktop app first when it is installed, else the console's agent-less `setup` page in the browser) and otherwise prints the install steps (`printNoAgentGuidance()`: each built-in's install command and page, how to add another agent in `~/.plan2code/agents.json`, and to run `plan2code` again) and exits 127. An uninstalled `--cli` pick goes to the same setup flow on that agent when a page can open, else prints that CLI's own steps after its error. `--cli claude` / `devin` / `codex` (or `--cli=<name>`) skips the menu and is never forwarded; an unknown name exits 2, an uninstalled one 127. The pick is saved as `lastCli` in `~/.plan2code/launcher.json`, merged beside `lastFolder`. Before spawning, unless the forwarded args carry `--model` / `--model=` (or, for Codex, `-m`), it asks `Which model should <CLI> use?` from `models.json` plus the user's additions, Enter keeping the model the CLI last used — Ctrl+C at any launcher prompt exits 130. With no TTY on stdin there is no menu (last pick, else the first installed) and no model question: it prints that the CLI will use the model last used in it (switch it in that CLI on its own, or pass `--model <name>`). Headings, numbers, defaults, retry lines and the `plan2code:` error prefixes are colored with `paint()` (the escape values of `install.js`'s `COLORS`, copied), stdout only when stdout is a TTY and stderr only when stderr is, and never when `NO_COLOR` is set; piped runs print plain text and no banner. Other arguments are forwarded to the CLI (`plan2code --model opus`), and its exit code is passed back. `plan2code update` and `plan2code uninstall [--yes] [--purge]` are the two subcommands: neither is forwarded and neither opens an agent. Update runs `npx --yes --allow-git=all git+https://github.com/jparkerweb/plan2code.git --update`, so `install.js --update` reinstalls what `~/.plan2code/install.json` lists; uninstall runs the same npx line with `--uninstall` (an unknown flag exits 2 before npx runs), and `install.js` confirms, removes everything the menu's U option does, then asks about `~/.plan2code` (see `--uninstall` in Development Commands). On every other start, before spawning the CLI, it prints one line when a newer release is out (`Plan2Code v<latest> is out (you have v<installed>). Run: plan2code update`), compared against `~/.plan2code/bin/version.json` and read from the console's cached release check (`~/.plan2code/console/update-check.json`); it never waits on the network, and when the cache is missing or stale it refreshes it in a detached background process so the next start knows. Tests: `scripts/test-launcher.mjs` (run by `npm test`) spawns the launcher against stand-in `claude`/`devin`/`codex` commands and a temp home.

**Design constraints:**
- **Stable copy, not the package dir** — the installer normally runs from an npx cache directory npm may delete, so `installLauncher()` copies `src/launcher/plan2code.js` to `~/.plan2code/bin/plan2code.js` and the shims point there. Beside it go `update-check.mjs` (the web console's release check, for the terminal notice), `agents.json` and `agent-lookup.mjs` (the shared agent list and lookup rule; `plan2code update` restores a missing copy) and a `version.json` (the installed version). (The metrics/bot wrappers point into `__dirname` and don't have this protection.)
- **The setup flow and hand-over.** With no runnable agent, `runSetupFlow()` finds `console.mjs` (the order the app's `find_console_dir` uses) and runs `open --workflow setup [--for-cli <id>]` as a child process, then `wait` in 240-second slices (the agent-less console keeps its app variables out, NFR-2). An `__start` action ends the wait with the pick; the launcher spawns that agent with `PLAN2CODE_SETUP_ANNOUNCE` (the setup server's base URL) and `PLAN2CODE_SETUP_TOKEN`, and the new agent's `open` POSTs its sign-in URL to `POST /handover` on the setup server, which broadcasts a `move` event the waiting tab follows. The post failing or the wait ending unmoved falls back to opening a browser / the printed steps.
- **npm-style shims** — written into npm's global bin (`npm config get prefix`; `<prefix>/bin` off Windows): an sh shim everywhere, plus `.cmd` and `.ps1` on Windows, so cmd.exe, PowerShell and Git Bash all resolve it. On macOS/Linux, when the npm bin isn't writable (system Node), it falls back to `~/.local/bin`.
- **Marker-based ownership** — every shim contains `plan2code-launcher`; `uninstallLauncher()` removes only files carrying it, leaving any other `plan2code` bin alone.
- **Resolving the CLI** — `findAgent()` in the shared `agent-lookup.mjs` does the lookup: `PATH` (+ `PATHEXT` on Windows), the saved Windows PATH from the registry (`addSavedWindowsPath()`), npm's global bin and each entry's `installDirs`, giving `found` / `outside` / `missing` (the desktop app's `find_on_path` in `agents.rs` is its twin, held to `scripts/fixtures/agent-lookup-cases.json`). An `.exe` is spawned directly; a `.cmd`/`.bat` wrapper goes through `cmd.exe /d /s /c` with quoted args, since Node refuses to spawn batch files without a shell. The installer warns only when neither `claude` nor `devin` is on `PATH`.
- **No bin-name overlap** — the installer's own bin in `package.json` is `plan2code-install` (→ `install.js`), so `plan2code` belongs to the launcher alone. npx runs a package's only bin whatever it's named, so the README's `npx … plan2code.git` command is unaffected; keep it the only bin, or npx will need `-c plan2code-install`.
- **`--pick-folder` is shortcut-only** — the launcher strips it before building the CLI's args. The shortcut runs the CLI menu, then the folder picker, then the model menu. With it, a native folder picker chooses the cwd instead: on Windows, the Explorer-style `IFileOpenDialog` (`FOS_PICKFOLDERS`) via `powershell -STA -EncodedCommand`, its C# interop (`WINDOWS_PICKER_SOURCE`) passed in an env var and compiled with `Add-Type` (~0.5s), with a TopMost owner form so it doesn't open behind the console — Windows PowerShell's `FolderBrowserDialog` is the old tree-only dialog, and is kept only as the fallback when `Add-Type` is blocked (Constrained Language Mode, AppLocker); `osascript choose folder` on macOS, and `zenity` then `kdialog` on Linux (only when `DISPLAY`/`WAYLAND_DISPLAY` is set). If there's no picker, or the picker fails, it falls back to a typed `Project folder [last]:` prompt. A picker that exits 0/1 with nothing printed means the person canceled, so the launcher exits 0. The picker starts on the last pick, stored in `~/.plan2code/launcher.json`. From the shortcut, a non-zero exit other than Ctrl+C (130 / `0xC000013A`) waits for Enter so the error doesn't vanish with the window. Typed in a terminal, `plan2code` behaves exactly as before.

**Desktop shortcut** — after the shims are written, `installLauncher()` (now async) calls `offerDesktopShortcut()`. It asks `Also add a Plan2Code shortcut to your desktop? (y/N)`, skips the question when stdin isn't a TTY, and refreshes an existing marked shortcut without asking. `installDesktopShortcut()` writes it to the real desktop (`[Environment]::GetFolderPath('Desktop')` on Windows, which covers OneDrive redirection; `xdg-user-dir DESKTOP` on Linux; `~/Desktop` otherwise):

| OS | File | Runs |
| --- | --- | --- |
| Windows | `Plan2Code.lnk` (written by `WScript.Shell`) | `pwsh.exe` (else Windows PowerShell) `-NoLogo -ExecutionPolicy Bypass -File "<bin>\plan2code.ps1" --pick-folder`, icon `src/launcher/plan2code.ico` (the web console's Peek-a-boo favicon, 16–256 px) copied to `~/.plan2code/bin/plan2code.ico` |
| macOS | `Plan2Code.command` (0755) | `exec "<bin>/plan2code" --pick-folder` in Terminal |
| Linux | `plan2code.desktop` (0755, `Terminal=true`, `gio … metadata::trusted`) | `"<bin>/plan2code" --pick-folder`, `Icon=` the web console's `favicon.png` copied to `~/.plan2code/bin/plan2code.png` |

The macOS and Linux shortcuts carry the `plan2code-launcher` marker as a comment line. A `.lnk` has nowhere to hide one (its Description is the hover tooltip), so it's recognized by what it runs: the UTF-16 strings `plan2code.ps1` and `--pick-folder` stored in the file (`plan2code.cmd` also matches, so shortcuts from before the PowerShell switch get refreshed). `uninstallLauncher()` removes only a recognized shortcut, plus the icons (`plan2code.ico`, `plan2code.png`), `bin/models.json` and `launcher.json` (never the user's `~/.plan2code/models.json`). A shortcut failure prints a warning and never fails the command install.

**Installer integration** lives in `install.js` under the `PLAN2CODE COMMAND` section (`installLauncher`, `uninstallLauncher`, plus the shortcut helpers). `install()` awaits it after a successful skills install (so `I` and Advanced → `E` get it), `U` removes it, and Advanced → `D` installs it alone. Every global install writes `~/.plan2code/install.json`, the install record listing the pieces installed (skills, launcher, statusline, loop, metrics, bot); `install.js --update` (what `plan2code update` runs) reinstalls those (metrics and bot only when run from a git checkout), with no menu and never uninstalling, or with no record the skills and the `plan2code` command. After an install, `printGettingStarted()` prints the three steps (cd into the project, start Plan2Code, pick a card) and, when no agent CLI is on `PATH`, how to get one.
