# Review on the Web Console

Workflow notes for `review`, part of the web console contract (`console.md`).
A review run from a build's review button stays in the build's session, under
its workflow: `building-review.md` governs it instead.

Scope questions up front — run standalone with nothing named, the first is
a `choice`, "What should I review?", built from a quick scan (branch changes,
uncommitted changes, specs, files you name; each option with its size),
never an assumed target; a build's review skips it (`building-review.md`). Then the
findings report as a doc (`id: "report"`), then the pick-what-gets-fixed menu
as a `multi` or `choice` keyed by finding id, carrying `"doc": "report"` so the
card links straight to the findings. Settle that item (`"settle": true`) in the
same post that takes the picks up: left open it stays on the page as a question
still owed, next to whatever you ask next. Post `activity` while you read — a
real review is long stretches of you working, and the page should say so rather
than hint at questions.

When the session was launched from the dashboard, resume the session you were
handed (`open --resume <sid> --no-open --workflow review`), never a fresh
`open`.

Review Mode's closing gate ("Reply approved to commit, or request changes")
is a `review` item titled "Check the fixes", `doc: "report"`, `"nothingYet":
false` (the fixes are already on disk), verdicts `approve` and `changes`.

On completion the finish's `command` is the suggested commit when fixes
landed — filled in, in the AGENTS.md format, with
`"where": "When you are happy with it, commit it from your terminal:"` —
otherwise leave `command` out; with one, `"commit": true` puts **Commit it
now** beside it. The completion finish carries `"dashboard": true`
so the finished screen offers **Back to the dashboard**; keep waiting for the
press. A stop mid-review loses nothing on disk, so its finish is the bare
`/plan2code-review` (a pause, so no dashboard button).
