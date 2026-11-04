# Choosing what to run
> Read by Document, Implement, Implement + Review, Quick Task, Review and Finalize before they write, run or offer tests. Never invoked as a skill.

## Three tiers

1. **Per task:** run the tests that cover what the task touched.
2. **Phase end:** run the phase file's `## Phase Testing` lines, plus tests for any other file the phase changed.
3. **Full suite:** only where the plan put it: a `Full suite:` line in a phase file, or Finalize's offer. A project's `AGENTS.md` saying "run `npm test`" (or any whole-suite command) does not put a full run in a phase.

## Finding the tests that cover a file

In this order:

1. `AGENTS.md`'s `## Test map` table (`Area`, `Paths`, `Run`, `Shared`; it may sit behind one link to `.agents-docs/AGENTS-test-map.md`), read with `test-map.mjs read` when the skill ships it, plus the "run single test" command.
2. Otherwise match by name, folder and imports of the changed files; `test-match.mjs` does this when the skill ships it.

A runner's own related-tests flag may be used when `AGENTS.md` records it. It is never required.

## Quick checks

Lint, a type check, a size check: run them at phase end only when the project or `AGENTS.md` shows them to be fast.

## Shared ground

A test helper or fixture, build or test config, a widely imported module, a shared type or schema. A test map row marked `Shared: yes` is shared ground by definition. Touching any of these is the moment to offer a wider run: say what was touched and why it reaches wide, and let the person choose.

## Ask when unsure

When you cannot tell whether a check is fast, whether a change is shared ground, or which tests cover a file, ask the person. Never guess.

## Record honestly

Say which tests ran and which were skipped. Never report "tests pass" for a run that did not happen.
