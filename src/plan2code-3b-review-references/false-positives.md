# False-Positive Catalog
> Part of plan2code-3b-review — loaded before presenting findings in Step 3 (Analyze).

Check every finding against this catalog before presenting it. These patterns represent common categories of false findings that waste reviewer and developer time. Each entry includes the bias, a concrete example, why it's wrong, and how to verify before flagging.

---

## 1. Optimization Bias

**Pattern:** Recommending removal or reduction of something to optimize a metric (context size, file count, memory, line count) when the thing being removed is necessary for correctness.

**Example:** Reviewer recommends removing `jira-api-catalog.md` and `jira-field-schema.md` from agent read loading to "reduce context overhead." The reviewer sees large files being loaded and assumes smaller context = better performance.

**Why it's wrong:** Agents consume these files at runtime to know which API endpoints exist and what fields are available. Without them, agents construct invalid API calls. The "overhead" is actually essential working knowledge. Optimizing for context size sacrificed correctness.

**How to check before flagging:**
1. Identify what metric you're optimizing (file count, context size, line count, memory).
2. Ask: "What happens if this is removed?" Trace the downstream impact.
3. Search for all consumers of the thing you want to remove — not just direct imports, but Read directives, config references, and runtime loading.
4. If any consumer depends on it for correct execution, the finding is invalid.

---

## 2. Simplification Bias

**Pattern:** Recommending consolidation or simplification of something that is intentionally structured for separation of concerns, different consumers, or independent evolution.

**Example:** Reviewer flags that `config/platforms/windsurf.json` and `config/platforms/cursor.json` have "similar structure" and recommends consolidating into `flat-file-platforms.json` to "reduce duplication."

**Why it's wrong:** The per-platform files exist deliberately. Each platform has distinct frontmatter requirements, path conventions, and feature flags. They share a common schema but contain different values. Consolidation would require conditionals everywhere and make per-platform changes harder. The separation is a design choice, not an oversight.

**How to check before flagging:**
1. Ask: "Why are these separate?" Read the commit history or documentation for context.
2. Check if the "duplicated" files serve different consumers or contexts.
3. Verify whether the files are expected to diverge further over time.
4. If separation serves independent evolution, different consumers, or different deployment targets, the finding is invalid.

---

## 3. Duplication False Alarm

**Pattern:** Flagging intentional redundancy as a DRY violation when the similar-looking code serves genuinely different purposes or domains.

**Example:** Reviewer flags that `handleTicketCreate()` and `handleTicketUpdate()` share 80% of their code and recommends extracting a common `handleTicketMutation()`. Both functions validate input, call the API, and format the response — but they use different validation rules, different API endpoints, different error messages, and different response transformations.

**Why it's wrong:** The structural similarity is coincidental. Each function handles a distinct domain operation with distinct requirements. Extracting a common function would create a complex conditional monster that's harder to maintain than two clear, self-contained handlers. DRY applies to shared knowledge, not shared structure.

**How to check before flagging:**
1. Compare the "duplicate" functions at the detail level, not the structural level.
2. Ask: "If I change one, should the other change identically?" If no, they're not duplicates.
3. Check if the functions handle different domain concepts, even if the code shape is similar.
4. If combining them would require conditionals or parameters to differentiate behavior, the separation is likely intentional.

---

## 4. Performance Theater

**Pattern:** Flagging operations as "too expensive" when the operation is not in a hot path, runs infrequently, or when the "cost" is actually necessary for correctness.

**Example:** Reviewer flags that the installer reads 15 platform configuration files at startup and recommends lazy loading. The installer runs once during setup, takes <200ms total, and needs all configurations to determine which platforms to install.

**Why it's wrong:** The installer is a one-shot CLI tool, not a server handling concurrent requests. Startup performance of a tool that runs once per install is irrelevant. The "optimization" would add complexity (lazy loading, caching, error handling for deferred loads) with zero user-visible benefit.

**How to check before flagging:**
1. Determine the execution context: Is this a hot path (server request handler, tight loop) or a cold path (startup, CLI command, migration script)?
2. Measure or estimate the actual cost. "Reads many files" is not a performance issue if total I/O is <1 second.
3. Ask: "Would a user notice the difference?" If the answer is no, the optimization is theater.
4. Check whether the "expensive" operation is necessary for correctness — if so, optimization means finding a faster way to do it, not skipping it.

---

## 5. Missing Context

**Pattern:** Flagging something as wrong, unused, or unnecessary because the reviewer didn't read all related files, packages, or documentation before forming a conclusion.

**Example:** Reviewer flags `export function formatJiraKey()` in `utils/jira.ts` as "unused export — remove or make private." The function is not imported in any file within the current package.

**Why it's wrong:** The function is consumed by a different package in the monorepo (`packages/cli/src/commands/jira.ts`). The reviewer only searched the current package directory, not the entire workspace. Cross-package consumption is common in monorepos and multi-package projects.

**How to check before flagging:**
1. Search the ENTIRE codebase for references, not just the current package or directory.
2. Check for dynamic imports, string-based requires, and config-driven module loading.
3. For exports: search all packages in the workspace, not just the current one.
4. For files: check build scripts, installation scripts, CI/CD configs, and documentation references.
5. If you can't find all consumers, state that explicitly rather than assuming there are none.

---

## Detection Shortcuts

Quick checks to run against any finding before presenting. If a check triggers, investigate further before flagging.

- **Does the finding recommend removing or simplifying something?** Trace who consumes it first. Search all packages, config files, scripts, and documentation for references. "I didn't find references in this file" is not "nothing references this."

- **Does the finding flag duplication?** Check if the "duplicates" serve different consumers, contexts, or domain concepts. Ask: "If I change one, must the other change identically?" If no, they aren't duplicates.

- **Does the finding flag performance?** Verify the operation is actually in a hot path. CLI tools, installers, migration scripts, and one-shot operations don't need the same performance treatment as request handlers.

- **Does the finding flag unused code?** Search ALL packages, consumers, and entry points — not just the current file or directory. Check for dynamic loading, Read directives, and cross-package imports.

- **Does the finding assume a different architecture?** Verify against AGENTS.md, README, and actual project conventions. The project may have deliberately chosen a pattern that differs from your preferred approach.

- **Does the finding flag complexity?** Check if the complexity maps to genuine domain complexity. Not all complex code is accidental complexity — some problems are inherently complex.

- **Does the finding recommend a "modern" replacement?** Verify the replacement is compatible with the project's runtime targets, platform constraints, and dependency policies. "Newer" is not always "better" for the specific context.
