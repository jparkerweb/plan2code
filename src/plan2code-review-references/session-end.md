# Review — Session End Next-Step Routing

Loaded at the end of a review session to suggest what genuinely helps next.
Principles to reason from, not a lookup table — adapt; when a case doesn't fit
cleanly, say what you verified and ask.

- **Plan2Code Workflow Pipeline:** `/plan2code-1-plan` → `PLAN-*` files · `/plan2code-2-document` → `overview.md` + `phase-*.md` (the "spec docs") in `specs/<feature>/` · `/plan2code-3-implement` → checks off phase tasks, one phase per run · `/plan2code-4-finalize` → archives to `specs--completed/`.
- **Find specs (any OS/shell):** `specs/` is gitignored, and search tools (Glob/Grep/project search) skip gitignored paths on many platforms — an empty search result is not evidence either way. Use `node "<S>/specs.mjs" list` (`<S>`: see Review Mode → Scripts) (feature dir unknown, or to see what is archived in `completed`) and `node "<S>/specs.mjs" status <spec>`: they read the disk directly. Its fields map onto the routing below: `planDrafts` with no `overview` · `overview` with no phases · each phase's `tasks.open` · a name in `completed`. If the script cannot run, read the expected files directly — file reads see gitignored paths. Conclude "no specs" only after `list` or a failed direct read.
- **Reconcile three signals:** session context (what this conversation was doing — a fresh session may have none), user intent (what they asked reviewed), the disk check above. Disk wins on state; context wins on intent and on disk silence; no context → intent + disk decide.
- **plan2code artifact reviewed (a plan, the spec docs, phases) — route on the reviewed feature's own `specs/<feature>/` state (another feature's specs prove nothing here), to the earliest unmet stage, suggesting only a step whose input exists:**
  - `PLAN-*` without `overview.md` → `/plan2code-2-document`
  - `overview.md` without `phase-*.md` → `/plan2code-2-document`
  - Unchecked `- [ ]` tasks in `phase-*.md` → `/plan2code-3-implement` (checkboxes are ground truth; flag overview conflicts)
  - All phase tasks checked → `/plan2code-4-finalize`
  - Archived spec → pipeline complete; summary only
- **Anything else** (code/PRs, logs, docs, tickets, emails, a codebase): no pipeline step — close with the summary; add a next action only if the review makes one obvious and actionable.
- **Gates:** unresolved Criticals → fixing them (H/A/S) is the next step. Signals the rules above can't reconcile, or multiple candidate specs → ask one targeted question.
- **Output:** "Next (NEW conversation): `/plan2code-<step>` — [why + how you know]"; otherwise "Review complete -- [summary]."
