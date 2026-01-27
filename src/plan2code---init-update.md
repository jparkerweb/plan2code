# 🛞 UPDATE AGENTS MODE

Start all UPDATE AGENTS MODE responses with '🛞'

```
⋅
    ╭───╮
    │ ● │
    │ ◡ │   Time to level up AGENTS.md!
    ╰───╯
```

This prompt guides AI coding agents through an interactive Q&A flow to update an existing `AGENTS.md` file with new learnings, commands, and project knowledge.

---

## Step 1: Pre-flight Check

First, check if `AGENTS.md` exists in the project root.

**If AGENTS.md does NOT exist:**
> "No AGENTS.md found in this project. Would you like to create one from scratch instead? I can analyze the codebase and generate an initial AGENTS.md file."

Then stop and wait for user response. If they want to create one, use the `plan2code---init.md` workflow instead.

**If AGENTS.md EXISTS:**
Read the file and provide a brief summary:
> "I found your AGENTS.md file. Here's what it currently covers:"
> - List the main sections/topics (2-4 bullet points max)
> - Note the current line count

Then proceed to Step 2.

---

## Step 2: Context Detection

Check if there is recent conversation context (work that was just completed in this session).

**If recent work context exists:**
> "I noticed we just worked on [brief description of recent work]. I spotted a few things that might be worth documenting:"
> - [Specific insight #1 - e.g., "The test runner requires the `--no-cache` flag for integration tests"]
> - [Specific insight #2 - e.g., "The `UserService` depends on `AuthProvider` being initialized first"]
> - [Specific insight #3 if applicable]
>
> "Would you like me to add any of these to AGENTS.md?"

**If no recent work context:**
Skip directly to Step 3.

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
> - **7. Something else** - Tell me what you'd like to add
>
> You can also ask me to:
> - **Review for corrections** - Check if any existing content is outdated or wrong
> - **Prune/consolidate** - Trim redundant or verbose sections
>
> "Which would you like to do? (You can pick multiple, e.g., '1 and 3')"

---

## Step 4: Gather Details

Ask targeted follow-up questions based on the user's selection:

| Category | Key Questions |
|----------|---------------|
| **Commands** | What does it do? Important flags? Prerequisites? |
| **Architecture** | Which components? How do they interact? Repeating pattern? |
| **Gotchas** | What was unexpected? Correct approach/workaround? |
| **Testing** | Specific commands? Fixtures? Mocking patterns? |
| **Environment** | Local/CI/deploy? Which env vars or files? |
| **Rules** | Project-wide or specific? "Always do X" or "never do Y"? Why? |
| **Other** | "Tell me what to add, I'll find where it fits." |
| **Review** | Walk through each section: "Still accurate? Anything to update?" |
| **Prune** | Suggest specific trims, ask "Should I make these changes?" |

---

## Step 5: Confirm & Apply

Before making changes, confirm with the user:

> "Here's what I'm going to add/update:"
>
> **Section:** [section name]
> **Change:** [brief description of the change]
> ```
> [Preview of the actual text to be added/modified]
> ```
>
> "Does this look right? (yes/no/adjust)"

If "adjust," ask what to change and repeat. If "yes," apply the edit:
- Insert in the appropriate section (create if needed)
- Preserve existing structure, formatting, and heading styles

---

## Step 6: Summary & Next

After applying the update:

> "Done! Here's what changed:"
> - [Brief summary of the change]
> - Current line count: X/500
>
> "Would you like to add anything else, or are we done for now?"

If the user wants to add more, return to Step 3.

**When the user is done** (responds "no" or similar), proceed to Step 7.

---

## Step 7: AI Agent File Sync

After the user finishes updating AGENTS.md, check for other AI agent configuration files and offer to replace them with references to AGENTS.md.

### Files to Detect

Check if any of these exist:
- `CLAUDE.md` (root) → use `./AGENTS.md`
- `GEMINI.md` (root) → use `./AGENTS.md`
- `.cursorrules` (root) → use `./AGENTS.md`
- `.github/copilot-instructions.md` → use `../AGENTS.md`
- `.cursor/rules/*.md` → use `../../AGENTS.md`
- `.windsurf/rules/*.md` → use `../../AGENTS.md`

**If no files found:** Skip silently and end the workflow.

### User Confirmation

If files are found, display:

> ```
> ⋅
>     ╭───╮
>     │ ● │
>     │ ~ │   Found some other AI agent configs!
>     ╰───╯
> ```
>
> I found these AI agent configuration files that could reference AGENTS.md:
>
> | File | Current Size |
> |------|--------------|
> | `CLAUDE.md` | 45 lines |
> | `.cursor/rules/` | 3 files |
>
> Would you like me to replace them with references to AGENTS.md?
> - **Yes** - Update all listed files
> - **Select** - Choose specific files (I'll list them with numbers)
> - **No** - Keep them as-is

**If "Select":** List files numbered, let user specify which (e.g., "1 and 3").

**Warning:** For files with >10 lines, note: "CLAUDE.md has custom content that will be replaced."

### Reference Template

Replace file contents with (use actual filename, adjust relative path):

```markdown
# CLAUDE.md

See [AGENTS.md](./AGENTS.md) for complete project documentation including:
- Development commands and setup
- Architecture overview
- Environment variables
- Testing patterns
- Deployment guides
```

**For directory configs** (`.cursor/rules/`, `.windsurf/rules/`): Delete all existing `.md` files and create a single `reference.md`.

After Step 7 completes (or is skipped), the update workflow is complete.

---

## Update Rules (for the agent)

When modifying AGENTS.md, follow these rules:

1. **Surgical edits only** - Don't rewrite sections that aren't being updated
2. **Preserve voice and style** - Match the existing formatting and tone
3. **Keep it actionable** - Every entry should help an agent do something
4. **Stay under 500 lines** - Warn user if approaching limit
5. **No generic advice** - If it applies to any project, don't add it
6. **No duplication** - Check if similar content already exists before adding
7. **Group logically** - Place new content near related existing content
8. **Be specific** - Include exact commands, file paths, or component names

---

## Example Session

```
Agent: I found your AGENTS.md file. It currently covers:
       - Build and test commands
       - Project structure overview
       - API conventions
       Current line count: 127

       I noticed we just worked on fixing the authentication flow. 
       I spotted a few things worth documenting:
       - The JWT refresh token must be validated before the access token
       - Tests for auth require the `TEST_SECRET` env variable
       
       Would you like me to add any of these?

User:  Yes, add both of those.

Agent: Got it. Here's what I'm going to add:

       **Section:** Gotchas/Pitfalls
       **Adding:**
       ```
       - JWT refresh token must be validated before the access token in the auth flow
       ```

       **Section:** Testing  
       **Adding:**
       ```
       - Auth tests require `TEST_SECRET` env variable to be set
       ```

       Does this look right?

User:  Yes

Agent: Done! Changes applied.
       - Added 2 entries across Gotchas and Testing sections
       - Current line count: 131/500
       
       Would you like to add anything else?

User:  No, we're good.

Agent: I found a CLAUDE.md file (23 lines). Would you like me to replace it
       with a reference to AGENTS.md?
       - Yes - Update it
       - No - Keep it as-is

User:  Yes

Agent: Done! Updated CLAUDE.md to reference AGENTS.md.

       All set! AGENTS.md is your single source of truth now. Happy coding!
```
