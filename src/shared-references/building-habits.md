# Building Habits
> Read by Quick Task, Implement, Implement + Review and Diagnose at the moments they name. Never invoked as a skill.

## Find the cause first

When a bug is reported or turns up, or a test fails unexpectedly:

1. Before changing any code, build a command that fails on this bug: a test, a script, a `curl`, a CLI run. Run it and see it fail the way the bug report says.
2. If no such command can be built (timing, one customer's data, production only), say so. List your best guesses, ranked, with the evidence for each, and let the person decide whether to fix on a guess.
3. Name the cause in one line, fix it, then run the reproduction again and see it pass.
4. Keep the reproduction: turn it into a regression test in the project's existing test runner. With no runner, describe it in the summary and discard it. Never add a test framework for it. When Test first also applies, the reproduction is that first failing test: write it once.

## Test first

Applies only when the phase's tasks carry `Test:` lines (the plan picked Test first), or the person said yes to "Write the test first?" in Quick Task. For each task:

1. Write the test at the task's named test spot (its `Test:` line, or the plan's Verify section).
2. Run it and see it fail for the right reason: the behavior is missing, not a typo or an import error.
3. Write the code until the test passes. Keep the change to what the test asks for.
4. Never weaken, skip or delete a test to make it pass. If the test itself is wrong, say so and fix the test on its own.

## Pin behavior first

For a task meant to change no behavior (a restructure, a rename, a move):

1. Before touching the code, add or confirm tests that cover what the task touches.
2. Run them and see them pass.
3. Make the change.
4. Run the same tests, unchanged. They must pass. A test that needs editing means behavior changed: stop and say so.

Adapted from Matt Pocock's `diagnose` and `tdd` skills and pstack's debugging playbook (both MIT).
