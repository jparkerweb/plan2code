# Planning on the Web Console

Workflow notes for `plan`, part of the web console contract (`console.md`).

- Open with `--workflow plan`, first thing. Every question and sign-off gate
  goes through the page, phase breakdowns as an editable `list`.
- The fresh-idea card carries `"templates": "idea"` (`console.md` → The kinds).
- Planning has no mid-session save before the Large checkpoint or Phase 7, so for
  a stop before then say plainly in `finish.body` that nothing was kept, and use
  `"command": "/plan2code-1-plan"`. After the checkpoint, post
  `"stopWarning": ""` (`console-stop.md`).
- At every session end, post `finish` BEFORE `stop`; on completion that is
  `"command": "/plan2code-2-document"`, and at the Large checkpoint it is
  `/plan2code-1-plan`. The closing message is printed to a terminal the
  browser user is not watching.
- The Large checkpoint finish is a pause: a headline starting "Paused", no
  `dashboard`, and `stop` at once.
- Plan offers the Subagents switch. A `Subagents:` block may arrive on `open`
  output or a `wait` / `chat` pickup: follow `console-subagents.md` and the
  skill's Helpers section, and report each helper as `helpers`. Post a helper
  as `done` or `failed` before the sign-off it feeds, and every one before a
  `finish`. Questions, sign-offs and the PLAN-DRAFT stay with you.
