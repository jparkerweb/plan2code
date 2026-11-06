# Review

Standalone with nothing named: first a `choice` "What should I review?" from a quick scan (branch changes, uncommitted changes, specs, files you name; each with its size). A build's review skips it. Launched from the dashboard: `open --resume <sid> --no-open --workflow review`. Post `activity` while you read.

Findings are doc `report`; the fix menu is a `multi` or `choice` keyed by finding id with `"doc":"report"`, settled (`"settle":true`) in the post that takes the picks up.

Closing gate: `review` "Check the fixes", `"doc":"report"`, `"nothingYet":false`, verdicts `approve`, `changes`.

Completion finish: `command` is the suggested commit when fixes landed (AGENTS.md format, `"where":"When you are happy with it, commit it from your terminal:"`, `"commit":true`), else none; `"dashboard":true`. A stop's `command` is the bare `/plan2code-review`, no dashboard.
