# The six steps in detail

Back to the [README](../README.md#the-workflow). Each step is its own run, and the specs on disk are the only thing carried from one to the next.
Chain a small one onto the last, or start a fresh session for a big one (rule 1).

## 0 · Pathfinder 🧭 (optional)

On the page: one question at a time with the options and their trade-offs, the map growing in its own
tab, and a **Write a brief** button for a printable summary.

Some ideas are too big and unclear to plan: you can feel the shape of the work but you can't write
it as requirements, so planning would just invent the answers. Pathfinder finds the *way* to the
destination; Step 1 then walks it.

1. **Name the destination** — one or two lines fixing what this effort is finding its way to. Settled
   first, because it fixes scope. It also asks where the map should live: **local files** under
   gitignored `specs/` (private, solo — the default), or **GitHub Issues** (a map issue with one
   sub-issue per decision, native blocking, so your team can see and work the frontier in the tracker).
2. **Chart the map** — a breadth-first grilling surfaces the open decisions. Anything you can phrase
   *sharply* becomes a question file; anything you can only sense stays listed as fog.
3. **Clear the questions one at a time** — resolving one burns off the fog behind it, graduating
   whatever just became sharp into new questions. After each decision it offers a menu: take the next
   question here, or start fresh — recommended after about three, to keep the agent sharp.
   Ask for a **brief** at any point and you get a dated, plain-English summary of what has been
   decided, what is still open, and what is next — meeting minutes, with no jargon in them.
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

## 1 · Plan 🤔

On the page: questions in batches of up to three, the phase breakdown as a list you can reorder and
edit, and a sign-off at each stage.

The agent works as a senior architect through seven phases, stopping for you after each: requirements
analysis · system context (reading your actual codebase) · scope assessment (a large project saves and
resumes in a fresh session) · tech stack (needs your explicit sign-off) · architecture design ·
technical specification · transition decision.

It won't finalize below **90% confidence**, and every assumption it makes is written into the draft.

**In:** a description of the feature. **Out:** `PLAN-DRAFT-<date>.md` + `PLAN-CONVERSATION-<date>.md`

## 2 · Document 📝

On the page: a question only where the plan leaves something open, each phase file appearing as its
own tab as it is written, and one sign-off at the end.

The plan becomes the drawing. One `overview.md` with the phase checklist, plus one file per phase of
one-story-point tasks. Each phase is **self-contained** — an agent opening `phase-3.md` cold needs
nothing else to build it. Unit and E2E tests are excluded unless you ask for them.

The overview also identifies the **parallel execution groups**: phases with no shared files or
dependencies, safe to run in separate agents at once.

**In:** the `PLAN-DRAFT`. **Out:** `overview.md` + `phase-1…N.md`

## 3 · Implement ⚡

On the page: a progress bar and the phase's task list ticking over as tasks land, then the completion
report and a sign-off card where you approve, ask for changes, or have the code reviewed first.

Point it at `overview.md` and it does the rest: finds the next unchecked phase, implements every task
exactly as specified, ticks tasks off as they land, then reviews its own work against the spec and
writes a completion summary.

One phase per conversation. It won't run tests unless the phase says to.

**In:** `specs/<feature>/overview.md`. **Out:** working code, and updated checkboxes.

Want a second pair of eyes before you sign off? `/plan2code-3-implement-review` builds the phase the
same way, runs a focused review and the fixes you pick, and only then asks for approval.

## Review 🔬 — optional, any time

On the page: a few questions on scope, the findings as a report you can read in full, and a list
where you tick what gets fixed.

An independent second opinion, not a rubber stamp. It figures out its own scope (conversation
context, your instruction, or the git diff as a fallback), analyses across 11 dimensions, and ranks
findings Critical / Warning / Suggestion. Every finding cites a file and a line, or it gets dropped —
and the review pass is read-only. It fixes things only if you ask, and verifies each fix afterwards.

Spec-aware when `specs/` exists, and works fine without it. Most useful right after a planning or
implementation step, but there's no wrong time to run it.

## 4 · Finalize 🧹

On the page: the task audit and the summary as reports, a list of the doc updates to approve, and a
confirmation before anything is archived.

Validates every task against its phase spec, writes the summary and the list of files touched, flags
the docs that drifted (`README`, `CHANGELOG`, `AGENTS.md`), then archives the whole spec folder —
`pathfinder/` included — to `specs--completed/`. That folder is the record of *why* the code looks
like this.

**In:** `specs/<feature>/overview.md`. **Out:** archived specs.
