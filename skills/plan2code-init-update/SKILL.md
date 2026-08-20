---
name: plan2code-init-update
description: "Plan2Code Update: Init Update Mode - user-initiated workflow step. Do not invoke autonomously."
disable-model-invocation: true
---

# 🛞 UPDATE AGENTS MODE

Start all UPDATE AGENTS MODE responses with '🛞'

```
⋅
    ╭───╮
    │ ● │
    │ ◡ │   Time to level up AGENTS.md!
    ╰───╯
```

Interactive Q&A flow to update an existing `AGENTS.md` with new learnings and project knowledge.

---

## Awareness Context

Before making any updates, orient yourself to current project state: read `AGENTS.md` and `README.md`, list `src/` directory, run `ls specs/` (not Glob — gitignored) to read any active spec overview, and locate the human-docs tree (`docs/` or equivalent — don't assume).

---

## Step 1: Pre-flight Check

Check if `AGENTS.md` exists in project root.

**If missing:** "No AGENTS.md found. Create one from scratch? I can analyze the codebase and generate an initial file." Stop and wait. If yes, use `plan2code-init.md` workflow.

**If exists:** Read and summarize:
- Main sections (bullets)
- Current line count

Check for `.agents-docs/` directory:

**If `.agents-docs/` exists:**
```
Structure: Progressive discovery (index + N section files)
Section files:
- .agents-docs/AGENTS-architecture.md
- .agents-docs/AGENTS-development.md
[etc.]
```

**If `.agents-docs/` does not exist:** Note: `Structure: Single-file (no .agents-docs/ directory)`

**IMPORTANT — you MUST offer restructuring.** Stop and ask:
> "Your AGENTS.md uses a single-file format. Want to restructure for progressive discovery? This splits detailed sections into `.agents-docs/` files and converts AGENTS.md to a lightweight index with summaries and links."

Wait for user response before continuing. If user accepts, restructure existing content: create `.agents-docs/` directory with section files, convert AGENTS.md to index with summaries and links. Always-inline sections (Project Overview, Git Commit Messages, How to Use This File) stay in AGENTS.md. If user declines, continue with single-file editing.

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
>     │ ● │ 
>     │ ~ │   What should we update?
>     ╰───╯
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
> - **7. Git Commit Messages** - Commit message conventions, AI attribution rules
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
| Git Commit Messages | Format? Attribution? Conventions? |
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
- Always-inline sections (Project Overview, Git Commit Messages, How to Use This File) → edit AGENTS.md directly
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

- **New section (>~10 lines):** Create `.agents-docs/AGENTS-<section-name>.md` with breadcrumb header, add summary + link in AGENTS.md
- **New section (<~10 lines):** Keep inline in AGENTS.md
- **Delete section:** Remove the `.agents-docs/` file and its summary + link from AGENTS.md
- **Orphan cleanup:** After all edits, check for `.agents-docs/` files with no corresponding AGENTS.md section — offer to remove them

---

## Step 6: Summary & Next

After applying:
> "Done! Changed:"
> - [Summary]

If `.agents-docs/` exists:
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

> Fallback: for each detected file, offer Yes/Select/No to replace it with a pointer to AGENTS.md (warn when a file >10 lines has custom content that would be replaced). `CLAUDE.md` gets a special template opening with a `CRITICAL — MANDATORY FIRST STEP` directive to always read `AGENTS.md` (Claude Code auto-loads it); all other files get a "See AGENTS.md for complete project documentation including:" pointer with the same bullet list, using the correct relative path (`./`, `../`, or `../../` by location). For directory configs (`.cursor/rules/`, `.windsurf/rules/`), delete existing `.md` files and create a single `reference.md`.

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

Suggested commit:
```
git commit -m "docs: update AGENTS.md with new learnings" -m "<JIRA-Ticket-ID>" -m "AI Assisted"
```

Returning context: Run `/plan2code-init-update` again to make additional updates.
