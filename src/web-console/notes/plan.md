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
