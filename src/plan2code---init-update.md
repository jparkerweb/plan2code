# 🛞 UPDATE AGENTS MODE

Start all UPDATE AGENTS MODE responses with '🛞'

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

Wait for user response before proceeding.

**If no recent work context:**
Skip directly to Step 3.

---

## Step 3: Update Menu

Present the user with update options:

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

Wait for user response.

---

## Step 4: Gather Details

Based on the user's selection, ask targeted follow-up questions.

### If Commands:
> "What command(s) would you like to document?"
> - What does the command do?
> - Are there important flags or variations?
> - Any prerequisites or context needed?

### If Architecture:
> "What architectural insight did you learn?"
> - Which components or modules are involved?
> - How do they interact?
> - Is this a pattern that repeats elsewhere in the codebase?

### If Gotchas/Pitfalls:
> "What's the gotcha you encountered?"
> - What was the unexpected behavior?
> - What's the correct approach or workaround?
> - Where in the codebase does this apply?

### If Testing:
> "What testing knowledge should be captured?"
> - Specific test commands or patterns?
> - Test data or fixture setup?
> - Mocking/stubbing approaches used in this project?

### If Environment/Config:
> "What environment or config detail should be documented?"
> - Is this about local dev setup, CI, or deployment?
> - Are there specific env variables or files involved?

### If General Rules:
> "What rule or convention should future agents follow?"
> - Does this apply project-wide or to specific areas?
> - Is this a "always do X" or "never do Y" type rule?
> - Why does this rule exist? (brief context helps agents follow it)

### If Something Else:
> "Tell me what you'd like to add, and I'll figure out where it fits best."

### If Review for Corrections:
> "I'll walk through the current AGENTS.md sections. For each, let me know if anything is outdated or incorrect."
> 
> Then iterate through each section, asking:
> - "Is this still accurate?"
> - "Anything to update here?"

### If Prune/Consolidate:
> "I'll review AGENTS.md for redundancy and verbosity. Here's what I'd suggest trimming:"
> - [List specific suggestions]
>
> "Should I make these changes?"

---

## Step 5: Confirm Understanding

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

If the user says "adjust," ask what to change and repeat Step 5.

---

## Step 6: Apply Update

Make the targeted edit to AGENTS.md:
- Insert new content in the appropriate section
- If a relevant section doesn't exist, create it in a logical location
- Preserve existing structure and formatting style
- Use the same heading levels and list styles as the existing file

---

## Step 7: Summary & Next

After applying the update:

> "Done! Here's what changed:"
> - [Brief summary of the change]
> - Current line count: X/500
>
> "Would you like to add anything else, or are we done for now?"

If the user wants to add more, return to Step 3.

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

Agent: Great! AGENTS.md is updated. Happy coding!
```
