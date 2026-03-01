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

## Step 1: Pre-flight Check

Check if `AGENTS.md` exists in project root.

**If missing:** "No AGENTS.md found. Create one from scratch? I can analyze the codebase and generate an initial file." Stop and wait. If yes, use `plan2code---init.md` workflow.

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

### Git Commit Messages Audit

Check AGENTS.md for a `## Git Commit Messages` section describing this format:
```
<description>

<JIRA-Ticket-ID>
AI Assisted
```
Required rules:
1. **JIRA ticket ID from branch** — derive from branch name format `<prefix>/<TICKET-ID>-description` (uppercase project key + hyphen + integer, e.g., `PCWEB-10968`)
2. **AI Assisted footer** — always the last line, on its own line directly after the ticket ID

If the section is missing or either rule is absent, flag it:
> "Your Git Commit Messages section is missing [missing items]. Want me to add them?"

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
| Review | Per section: "Still accurate?" |
| Prune | Suggest trims, confirm before applying |

---

## Step 5: Confirm & Apply

Before changes, route edits to the correct file when `.agents-docs/` exists:
- Always-inline sections (Project Overview, Git Commit Messages, How to Use This File) → edit AGENTS.md directly
- All other sections → edit the corresponding `.agents-docs/AGENTS-<section-name>.md` file

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

Check for other AI agent config files and offer to replace with AGENTS.md references.

### Files to Detect

| File | Reference Path |
|------|----------------|
| `CLAUDE.md` (root) | `./AGENTS.md` |
| `GEMINI.md` (root) | `./AGENTS.md` |
| `.cursorrules` (root) | `./AGENTS.md` |
| `.github/copilot-instructions.md` | `../AGENTS.md` |
| `.cursor/rules/*.md` | `../../AGENTS.md` |
| `.windsurf/rules/*.md` | `../../AGENTS.md` |

**No files found:** Skip silently, end workflow.

### If Files Found

```
   o     o
    \   /
    +---+
    | o |
    | ~ |   Found other AI agent configs!
    +---+
```

> Found AI config files that could reference AGENTS.md:
>
> | File | Size |
> |------|------|
> | `CLAUDE.md` | 45 lines |
>
> Replace with AGENTS.md references?
> - **Yes** - Update all
> - **Select** - Choose specific (numbered list)
> - **No** - Keep as-is

**Warning** for files >10 lines: "[file] has custom content that will be replaced."

### Reference Template

```markdown
# CLAUDE.md

See [AGENTS.md](./AGENTS.md) for complete project documentation including:
- Development commands and setup
- Architecture overview
- Environment variables
- Testing patterns
- Deployment guides
- Section details in .agents-docs/
```

**For directory configs** (`.cursor/rules/`, `.windsurf/rules/`): Delete existing `.md` files, create single `reference.md`.

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
Agent: Found AGENTS.md covering:
       - Build/test commands
       - Project structure
       - API conventions
       Line count: 127
       Structure: Single-file (no .agents-docs/ directory)

       Your AGENTS.md uses a single-file format. Want to
       restructure for progressive discovery?

User:  No thanks, just update it.

Agent: OK, keeping single-file format.

       Recent work on auth flow. Worth documenting:
       - JWT refresh token must validate before access token
       - Auth tests require TEST_SECRET env var

       Add these?

User:  Yes, both.

Agent: Adding:

       **Section:** Gotchas
       ```
       - JWT refresh token must validate before access token in auth flow
       ```

       **Section:** Testing
       ```
       - Auth tests require TEST_SECRET env variable
       ```

       Look right?

User:  Yes

Agent: Done! Added 2 entries to Gotchas and Testing.
       Line count: 131/500

       Add anything else?

User:  No

Agent: Found CLAUDE.md (23 lines). Replace with AGENTS.md reference?

User:  Yes

Agent: Updated CLAUDE.md. AGENTS.md is your single source of truth now!
```
