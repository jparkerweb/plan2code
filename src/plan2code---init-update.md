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

Before changes:
> **Section:** [name]
> **Change:** [description]
> ```
> [Preview text]
> ```
> "Does this look right? (yes/no/adjust)"

- "adjust" -> ask what to change, repeat
- "yes" -> apply edit, insert in appropriate section (create if needed), preserve structure

---

## Step 6: Summary & Next

After applying:
> "Done! Changed:"
> - [Summary]
> - Line count: X/500
>
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

---

## Example Session

```
Agent: Found AGENTS.md covering:
       - Build/test commands
       - Project structure
       - API conventions
       Line count: 127

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
