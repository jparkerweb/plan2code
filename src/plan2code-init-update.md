# 🛞 UPDATE AGENTS MODE

Start all UPDATE AGENTS MODE responses with '🛞'

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ◡ │   Time to level up AGENTS.md!
    ╰┬─┬╯
```

Interactive Q&A flow to update an existing `AGENTS.md` with new learnings and project knowledge.

## Interface

The FIRST thing you do, before anything else in this file — before the Awareness Context: ask **web console** (browser page, suggested) or **terminal**? Console → run `node "<D>/console.mjs" open --workflow init-update` before reading (<D>: references/web-console/ beside this SKILL.md — ~/.agents/skills/plan2code-init-update/references/web-console/ globally — or the dir in ~/.plan2code/console/console-dir), then read <D>/console.md. Every question in the Q&A flow and the restructure offer go through it. Switchable anytime. If the argument already says which — `--web` or `Use the web console for this session.` — take it and do not ask; drop the flag. Launched by the dashboard? Its session is already open — resume it (console.md → Launches), then Awareness Context. On the console, a `__stop` action is the person ending the session (console.md → Stop requests); at every session end post `finish` BEFORE `stop`; unless it is a pause, the finish carries `"dashboard": true` (the Back to the dashboard button) and you keep waiting for the press (console.md → Finishing).

## Scripts

`<S>` is `scripts/` beside this SKILL.md (`~/.agents/skills/plan2code-init-update/scripts/` globally). Run from the project root; each prints one JSON object, and on a non-zero exit `next` says what to do.

- `node "<S>/agents-md.mjs" inspect`: AGENTS.md's facts (exists, `lines` and `budget` against 500, `structure`, `sections` with their `details` link, `.agents-docs/` files, `brokenLinks`, `orphans`, `problems`).
- `node "<S>/agents-md.mjs" filename "<Section Name>"`: a new section file's name, link line and header.
- `node "<S>/agent-files.mjs" detect` / `apply <id> ...`: Step 7.
- `node "<S>/commit-msg.mjs" --subject "<subject>"`: the Session End commit.

---

## Awareness Context

Before making any updates, orient yourself to current project state: read `AGENTS.md` and `README.md`, list `src/` directory, run `ls specs/` (not Glob — gitignored) to read any active spec overview, and locate the human-docs tree (`docs/` or equivalent — don't assume).

---

## Step 1: Pre-flight Check

Run `agents-md.mjs inspect`.

**If `exists` is false:** "No AGENTS.md found. Create one from scratch? I can analyze the codebase and generate an initial file." Stop and wait. If yes, use `plan2code-init.md` workflow.

**If exists:** Read it and summarize:
- Main sections (bullets, from `sections`)
- Current line count (`budget`)
- Anything in `problems` (broken links, orphan section files, a missing breadcrumb, an always-inline section split out)

**If `structure` is `progressive`** (list `agentsDocs`):
```
Structure: Progressive discovery (index + N section files)
Section files:
- .agents-docs/AGENTS-architecture.md
- .agents-docs/AGENTS-development.md
[etc.]
```

**If `structure` is `single-file`:** Note: `Structure: Single-file (no .agents-docs/ directory)`

**IMPORTANT — you MUST offer restructuring.** Stop and ask:
> "Your AGENTS.md uses a single-file format. Want to restructure for progressive discovery? This splits detailed sections into `.agents-docs/` files and converts AGENTS.md to a lightweight index with summaries and links."

Wait for user response before continuing. If user accepts, restructure existing content: create `.agents-docs/` directory with section files, convert AGENTS.md to index with summaries and links. Always-inline sections (Project Overview, How to Use This File, Keeping this file current / Failure log) stay in AGENTS.md. If user declines, continue with single-file editing.

### Failure Log Audit

Check AGENTS.md for a `## Keeping this file current` section at the end of the file describing this format:

```
## Keeping this file current

The `Failure log` section below is a recording of mistakes made by previous AI Agents while working with this code base.

When you make a mistake, get corrected, or discover something about this codebase that wasn't written down:

1. Add one line to the `Failure log` below, in the imperative, describing the correct behaviour.
2. Keep it specific to this repo. General advice belongs nowhere.
3. If this fix is a workflow rather than a rule, put it in `.claude/skills/` and link it from here.
4. Include the change in the same commit and mention it in your summary.

## Failure log

- 

```

If the section is missing, flag it:
> "Your Keeping this file current section is missing. Want me to add it?"

If user confirms, add/update the section before proceeding. If user declines, continue.

Proceed to Step 2.

---

## Step 2: Context Detection

Check for recent conversation context.

**If recent work exists:** "I noticed we just worked on [description]. Worth documenting:"
- [Insight #1]
- [Insight #2]
- [Insight #3 if applicable]

"Add any of these to AGENTS.md?"

**If no context:** Skip to Step 3.

---

## Step 3: Update Menu

Present the user with update options:

> ```
> ⋅
>     ╭───╮
>     │ ★ │╱
>    ╱│ ~ │   What should we update?
>     ╰┬─┬╯
> ```
>
> "What would you like to add or update in AGENTS.md?"
>
> **Options:**
> - **1. Commands** - Build, test, run, lint, or other CLI commands
> - **2. Architecture** - How components interact, data flow, key patterns
> - **3. Gotchas/Pitfalls** - Traps to avoid, non-obvious behaviors
> - **4. Testing** - Test patterns, how to run specific tests, fixtures
> - **5. Environment/Config** - Setup quirks, env variables, configuration
> - **6. General Rules** - Coding conventions, style rules, project-specific practices
> - **7. Failure Log** - Record a mistake or correction in the Failure log
> - **8. Something else** - Tell me what you'd like to add
> - **9. Sync & Maintain** - Audit & sync all doc surfaces — AGENTS.md, `.agents-docs/`, `specs/`, README, human docs: fix stale/wrong/missing, cut redundancy
>
> You can also ask me to:
> - **Review for corrections** - Check if any existing content is outdated or wrong
> - **Prune/consolidate** - Trim redundant or verbose sections
>
> "Which would you like to do? (You can pick multiple, e.g., '1 and 3')"

---

## Step 4: Gather Details

| Category | Questions |
|----------|-----------|
| Commands | Purpose? Flags? Prerequisites? |
| Architecture | Components? Interactions? Pattern? |
| Gotchas | What was unexpected? Workaround? |
| Testing | Commands? Fixtures? Mocking? |
| Environment | Local/CI/deploy? Env vars/files? |
| Rules | Project-wide or specific? Why? |
| Failure Log | What went wrong? Correct behaviour (imperative, one line)? |
| Other | "Tell me what to add." |
| Sync & Maintain | Scope: all surfaces or specific? Then follow the Sync & Maintain section. |
| Review | Per section: "Still accurate?" |
| Prune | Suggest trims, confirm before applying |

---

## Sync & Maintain

Keep every doc surface accurate and in sync. **Deep-audit surfaces this session touched; staleness-scan the rest.** Verify against actual code — never assume or fabricate.

| Surface | Tier | Voice |
|---------|------|-------|
| `AGENTS.md` + ALL applicable `.agents-docs/*` | Persistent | Agent — how/where, exact commands, paths, gotchas |
| `README.md` + human docs | Persistent | Human — what/why, scannable |
| Active `specs/<feature>/` | Transient | Session knowledge — status, decisions, next steps. No bloat |

**Adaptive:** `AGENTS.md`/`.agents-docs/`/`specs/` are plan2code conventions — expected, but verify. `README.md` is standard. Human-docs tree varies (`docs/` or other) — detect, don't assume.

**Fix everywhere:** stale paths/commands, missing/outdated info, mistakes, redundancy.

**Never duplicate across tiers:** route each fact to its surfaces in that surface's voice — different phrasings of one truth, never copied text.

---

## Step 5: Confirm & Apply

Before changes, route edits to the correct file when `.agents-docs/` exists:
- Always-inline sections (Project Overview, How to Use This File, Keeping this file current / Failure log) → edit AGENTS.md directly
- All other sections → edit the corresponding `.agents-docs/AGENTS-<section-name>.md` file
- Sync & Maintain: human-voice facts → README/human docs; session knowledge → active spec's `overview.md`

Preview format:
> **File:** `.agents-docs/AGENTS-architecture.md` (or `AGENTS.md` for inline sections)
> **Section:** [name]
> **Change:** [description]
> ```
> [Preview text]
> ```
> "Does this look right? (yes/no/adjust)"

- "adjust" -> ask what to change, repeat
- "yes" -> apply edit, insert in appropriate section (create if needed), preserve structure

### Section File Lifecycle (when `.agents-docs/` exists)

- **New section (>~10 lines):** Create the file `agents-md.mjs filename "<Section Name>"` names, starting with its `header` lines; add a summary + its `link` line in AGENTS.md
- **New section (<~10 lines):** Keep inline in AGENTS.md
- **Delete section:** Remove the `.agents-docs/` file and its summary + link from AGENTS.md
- **Orphan cleanup:** After all edits, rerun `inspect`: offer to remove each file in `orphans` (no link from AGENTS.md), and fix any `brokenLinks`

---

## Step 6: Summary & Next

After applying:
> "Done! Changed:"
> - [Summary]

From a fresh `inspect` (`budget` is the X/500; warn if `nearLimit`), when `structure` is `progressive`:
> Structure: AGENTS.md (index) + N section files in .agents-docs/
> Index line count: X/500

Otherwise:
> Line count: X/500

> "Add anything else?"

If yes, return to Step 3. If done, proceed to Step 7.

---

## Step 7: AI Agent File Sync

Check for other AI agent config files (`CLAUDE.md`, `GEMINI.md`, `.cursorrules`, `.github/copilot-instructions.md`, `.cursor/rules/*.md`, `.windsurf/rules/*.md`) and offer to replace them with AGENTS.md references. **No files found:** skip silently, end workflow.

Read references/ai-agent-file-sync.md

> Fallback: `agent-files.mjs detect`, then offer Yes/Select/No for what it found (relay its `warnings`), then `agent-files.mjs apply <confirmed ids>`; it writes the CLAUDE.md template and the relative-path pointers itself.

---

## Update Rules

1. **Surgical edits** - Don't rewrite unchanged sections
2. **Preserve style** - Match existing formatting/tone
3. **Actionable only** - Every entry helps agents do something
4. **Under 500 lines** - Warn if approaching limit
5. **No generic advice** - Must be project-specific
6. **No duplication** - Check for similar content first
7. **Group logically** - Place near related content
8. **Be specific** - Include exact commands, paths, names
9. **Route edits to correct file** - Inline sections edit AGENTS.md directly, detailed sections edit the corresponding .agents-docs/ file

---

## Example Session

```
Agent: Found AGENTS.md (127 lines, single-file). Restructure for
       progressive discovery?
User:  No, just update it.
Agent: Recent work on auth flow. Worth documenting:
       - Auth tests require TEST_SECRET env var
       Add it?
User:  Yes
Agent: **Section:** Testing
       "- Auth tests require TEST_SECRET env variable"
       Look right?
User:  Yes
Agent: Done! Line count: 128/500. Add anything else?
User:  No
Agent: Found CLAUDE.md (23 lines). Replace with AGENTS.md reference?
User:  Yes
Agent: Updated CLAUDE.md. AGENTS.md is your single source of truth now!
```

## Session End

Work summary — tell user: sections updated, entries added/changed, files modified (`AGENTS.md` or `.agents-docs/` files).

Suggested commit: the `command` from `commit-msg.mjs --subject "docs: update AGENTS.md with new learnings"` (exit 4 `no-ticket`: show it with `<JIRA-Ticket-ID>` for the user to fill in).

Returning context: Run `/plan2code-init-update` again to make additional updates.
