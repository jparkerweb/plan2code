
# Plan2Code

<img src="https://raw.githubusercontent.com/jparkerweb/plan2code/main/docs/banner.png" alt="banner" data="object-fit:contain;" style="max-width:1024px;">

**A spec-driven workflow for AI coding agents. Send the plan — the build follows.**

An AI agent is a fine builder and a terrible client. Plan2Code stops making it both: you approve a
plan, the plan becomes a set of phase documents in your repo, and the agent builds to those documents
one phase at a time. Progress lives in files instead of chat history — so the next session, the next
agent, and the next engineer all start from the same specs.

Six commands, each posted separately. Two of them are optional.

Version 2.2.0 · MIT · 📖 [plan2code.jparkerweb.com](https://plan2code.jparkerweb.com)

---

## Install

Requires [Node.js](https://nodejs.org/) 18 or later and network access — installation runs through
the [skills CLI](https://skills.sh). Re-run any time to update.

```bash
npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git
```

This fetches the installer to a temp directory, builds the workflow as Agent Skills, delegates
installation to `skills add`, and cleans up after itself. The installed skills work independently
from then on.

Either route lands you on the same menu:

```
╔═════════════════════════════════════════════════════════╗
║ INSTALL PLAN2CODE                                       ║
╠═════════════════════════════════════════════════════════╣
║  I.  INSTALL    Install Plan2Code skills everywhere     ║
║  A.  ALL        Install Plan2Code + dev tools           ║
║  U.  UNINSTALL  Remove Plan2Code skills and dev tools   ║
║  C.  CUSTOM     Advanced options                        ║
║  Q.  QUIT       Exit                                    ║
╚═════════════════════════════════════════════════════════╝
```

**Supported tools:** every agent supported by the skills CLI, including Claude Code · Cursor ·
GitHub Copilot · Windsurf · Codex · Continue · Codeium · Zed · Amp · OpenCode · Devin · Crush · Pi ·
Gemini CLI · Cline · Roo · Kilo · Goose · Trae · Qwen Code.

The installer keeps one canonical copy of each skill under `~/.agents/skills/` and links it into
agents that maintain their own directory. Update later with `npx skills update -g`.

Use the installer rather than calling `skills add` against the repository root: recursive discovery
would also find maintainer-only skills under `.claude/skills/`. The installer targets `skills/`
explicitly.

<details>
<summary>Prefer to clone?</summary>

```bash
git clone https://github.com/jparkerweb/plan2code.git
cd plan2code
node install.js

# Only if you plan to modify or contribute to Plan2Code itself
npm install && npx husky
```
</details>

---

## The workflow

```
 ┌╴╴╴╴╴╴╴╴╴╴╴╴┐
 ╎0 PATHFINDER╎ optional · new in 2.0 · for an idea too big or unclear to plan
 └╴╴╴╴╴╴┬╴╴╴╴╴┘
        ▼
 ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌╴╴╴╴╴╴╴╴╴╴╴╴┐  ┌────────────┐
 │  1  PLAN   │─>│ 2 DOCUMENT │─>│3 IMPLEMENT │─>╎   REVIEW   ╎─>│ 4 FINALIZE │
 │decide what │  │ draw it as │  │build to the│  ╎  optional  ╎  │verify, sum,│
 │  to build  │  │phase specs │  │  drawing   │  ╎  any time  ╎  │  archive   │
 └────────────┘  └────────────┘  └────────────┘  └╴╴╴╴╴╴╴╴╴╴╴╴┘  └────────────┘
    new chat        new chat     new chat/phase     new chat        new chat
 ├◀─────────────── one feature, start to archive ──────────────────▶┤
```

Every box is its own conversation. That is not a style preference — planning context leaking into
implementation is where most agent drift starts.

| Command | Use it when |
|---------|-------------|
| `/plan2code-0-pathfinder` | The idea is too big and unclear to plan. Charts it as decisions, clears one per session, hands a hot plan draft to Step 1 |
| `/plan2code-1-plan` | Starting a feature. Full requirements → architecture pass |
| `/plan2code-2-document` | Planning is done. Turn the plan into phase specs |
| `/plan2code-3-implement` | Build the next phase (one per conversation) |
| `/plan2code-review` | Independent second opinion on local changes, then optional fixes |
| `/plan2code-4-finalize` | All phases done. Validate, summarize, archive |
| `/plan2code-init` | Generate this repo's `AGENTS.md` so every agent starts informed |
| `/plan2code-init-update` | Fold what you learned this session back into `AGENTS.md` |
| `/plan2code-quick-task` | A small change that doesn't warrant the full sequence |
| `/plan2code-1b-revise-plan` | Requirements moved mid-build. Revise the specs, not the code |
| `/plan2code-handoff` | Compact this conversation into a doc the next one resumes from |

---

## The four rules that do most of the work

**1 · A fresh conversation for each step, and each implementation phase.**
Step 3 gets a new chat per phase, not one chat for all of them.

**2 · No code until the plan hits 90% confidence.**
Step 1 will not finalize below the threshold. Under it, the agent keeps asking and keeps reading your
code — and writes every assumption down where you can argue with it.

**3 · Checkboxes are the state, not the chat.**
Progress lives in the spec files. Any agent, any session, resumes cold from them.

**4 · Reply `approved` to close a phase.**
Nothing advances on a guess about what you meant.

---

## What lands in your repo

```
your-project/
├── specs/
│   └── task-api/                     ← in progress
│       ├── pathfinder/               ← only if you charted it in Step 0
│       │   ├── map.md                    the destination, the decisions, the fog
│       │   └── questions/NN-<slug>.md    one decision per file
│       ├── PLAN-DRAFT-20260804.md    ← Step 1: the verified plan
│       ├── PLAN-CONVERSATION-*.md    ← Step 1: how you got there
│       ├── overview.md               ← Step 2: phase list + parallel groups
│       └── Phase 1.md … Phase N.md   ← Step 2: one-point tasks, self-contained
├── specs--completed/
│   └── auth-refresh/                 ← Step 4 files finished work here
└── ...your code
```

`specs/` is gitignored by default — it's your working drawing, not a deliverable. Share a folder
deliberately with `git add -f` when you want to.

### Progress marks

| Mark | Status | Meaning |
|------|--------|---------|
| `[ ]` | Open | Unclaimed. Any agent picks it up cold. |
| `[/]` | In progress | Claimed right now — which is how two agents run parallel phases without colliding. |
| `[x]` | Done | Built, self-reviewed against the spec, approved by you. |

```markdown
## Phases

- [x] Phase 1: Project setup
- [x] Phase 2: Data model
- [/] Phase 3: API endpoints        ← an agent is on this now
- [ ] Phase 4: Authentication       ← next available
```

Step 2 marks which phases don't share files. Open a second agent on one of those, and the `[/]` marks
keep the two out of each other's way.

---

## The six steps in detail

Each one travels on its own — a fresh conversation, opened and closed, with the specs on disk as the
only thing carried between them.

### 0 · Pathfinder 🧭 — optional, new in 2.0

Some ideas are too big and unclear to plan: you can feel the shape of the work but you can't write
it as requirements, so planning would just invent the answers. Pathfinder finds the *way* to the
destination; Step 1 then walks it.

1. **Name the destination** — one or two lines fixing what this effort is finding its way to. Settled
   first, because it fixes scope. It also asks where the map should live: **local files** under
   gitignored `specs/` (private, solo — the default), or **GitHub Issues** (a map issue with one
   sub-issue per decision, native blocking, so your team can see and work the frontier in the tracker).
2. **Chart the map** — a breadth-first grilling surfaces the open decisions. Anything you can phrase
   *sharply* becomes a question file; anything you can only sense stays listed as fog.
3. **Clear one question per session** — resolving a question burns off the fog behind it, graduating
   whatever just became sharp into new questions.
4. **Hand off** — when nothing is left to decide, it writes a `PLAN-DRAFT` that
   `/plan2code-1-plan` resumes from at Phase 4, with requirements, context, and scope already
   answered.

**Question types:** `grill` (a decision only you can make — the default) · `research` (a fact gates
it; background agents resolve these, several in parallel) · `sketch` (you need something concrete to
react to) · `legwork` (manual work that has to happen before a decision is possible).

It never answers its own questions, and it **plans, it never builds.** When the urge to just build it
arrives, the map is done. Skip Step 0 entirely when you already know what you're building.

**Out:** `specs/<feature>/pathfinder/map.md` + `questions/` (or a `pathfinder:map` issue and its
sub-issues) → `PLAN-DRAFT-<date>.md`. The draft is always a local file — that is what Step 1 reads.

### 1 · Plan 🤔

The agent works as a senior architect through six phases, stopping for you after each: requirements
analysis · system context (reading your actual codebase) · tech stack (needs your explicit sign-off) ·
architecture design · technical specification · transition decision.

It won't finalize below **90% confidence**, and every assumption it makes is written into the draft.

**In:** a description of the feature. **Out:** `PLAN-DRAFT-<date>.md` + `PLAN-CONVERSATION-<date>.md`

### 2 · Document 📝

The plan becomes the drawing. One `overview.md` with the phase checklist, plus one file per phase of
one-story-point tasks. Each phase is **self-contained** — an agent opening `Phase 3.md` cold needs
nothing else to build it. Unit and E2E tests are excluded unless you ask for them.

The overview also identifies the **parallel execution groups**: phases with no shared files or
dependencies, safe to run in separate agents at once.

**In:** the `PLAN-DRAFT`. **Out:** `overview.md` + `Phase 1…N.md`

### 3 · Implement ⚡

Point it at `overview.md` and it does the rest: finds the next unchecked phase, implements every task
exactly as specified, ticks tasks off as they land, then reviews its own work against the spec and
writes a completion summary.

One phase per conversation. It won't run tests unless the phase says to.

**In:** `specs/<feature>/overview.md`. **Out:** working code, and updated checkboxes.

### Review 🔬 — optional, any time

An independent second opinion, not a rubber stamp. It figures out its own scope (conversation
context, your instruction, or the git diff as a fallback), analyses across 11 dimensions, and ranks
findings Critical / Warning / Suggestion. Every finding cites a file and a line, or it gets dropped —
and the review pass is read-only. It fixes things only if you ask, and verifies each fix afterwards.

Spec-aware when `specs/` exists, and works fine without it. Most useful right after a planning or
implementation step, but there's no wrong time to run it.

### 4 · Finalize 🧹

Validates every task against its phase spec, writes the summary and the list of files touched, flags
the docs that drifted (`README`, `CHANGELOG`, `AGENTS.md`), then archives the whole spec folder —
`pathfinder/` included — to `specs--completed/`. That folder is the record of *why* the code looks
like this.

**In:** `specs/<feature>/overview.md`. **Out:** archived specs.

---

## What to bring to each step

| Step | Required input |
|------|----------------|
| 0 · Pathfinder | Nothing to start — just describe the idea. To continue: the feature name; it finds its own map |
| 1 · Plan | Nothing — describe the feature |
| 2 · Document | `specs/<feature>/PLAN-DRAFT-<date>.md`, or the planning conversation |
| 3 · Implement | `specs/<feature>/overview.md` — it detects the phase itself |
| Review | Scope guidance, e.g. "the last two phases", "just the auth module", "the whole PR". Auto-detects if you give none |
| 4 · Finalize | `specs/<feature>/overview.md` |

---

## Troubleshooting

**The skills aren't recognised.** Re-run the installer and restart your AI tool. Confirm the global
install with `npx skills list -g`. For a project install, check the generated directories aren't
gitignored.

**Your tool doesn't read Agent Skills.** Since v2.2.0, Plan2Code ships only as skills. If your tool
has no skill support, paste the relevant `src/plan2code-*.md` manually or point it at the installed
copy under `~/.agents/skills/`.

**The agent starts coding during planning.** The prompts forbid it, but models drift. Say: "Stay in
planning mode. Do not write code yet."

**The agent doesn't know what to implement.** Give it the path to `overview.md` — it reads the phase
file itself from there.

**You lost track between sessions.** `overview.md` has the phase status; the phase files have the
task status. That's the whole state.

**The agent isn't following the spec.** Point at the specific phase document and tell it to re-read
the requirements.

**Too many or too few phases.** Fix it in Step 2 — a phase should be a logical grouping of work, not
a fixed size.

---

## Customizing

The prompts are yours to edit. Common changes: add testing requirements in Step 2, move the 90%
confidence threshold in Step 1, restructure the `specs/` layout, or add review gates to Step 3.
Source files live in `src/`; run `npm run build:skills`, then re-run `node install.js` to push your
edits out through the skills CLI.

---

## Dive deeper

Core reference:

- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** — the one-page card: commands, inputs, outputs, decision tree
- **[.readme/walkthrough.md](.readme/walkthrough.md)** — one feature from a sentence to archived specs, session by session
- **[AGENTS.md](AGENTS.md)** — architecture and contributor guide for this repo
- **[CHANGELOG.md](CHANGELOG.md)** — what changed, and why

Optional tooling — none of it is required to use the workflow:

- **[.readme/autonomous-loop.md](.readme/autonomous-loop.md)** — `plan2code-loop`, a hands-off alternative to Step 3
- **[.readme/status-line.md](.readme/status-line.md)** — three-line Claude Code status bar: model, context, quota, diff
- **[.readme/metrics.md](.readme/metrics.md)** — `plan2code-metrics`, measuring and improving the prompts themselves
- **[.readme/test-bot.md](.readme/test-bot.md)** — `plan2code-bot`, maintainer harness that runs the whole workflow unattended
