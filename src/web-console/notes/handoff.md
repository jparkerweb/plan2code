# Handoff on the Web Console

Workflow notes for `handoff`, part of the web console contract (`console.md`).

One gate: the next-task confirmation, then the document itself as a doc —
that is what the person is there to download. Give it no `saved` and paste it
as `md`: the handoff file often sits outside the project (the OS temp folder),
where a `file` block is refused, and the download is the point. The finish carries no
`command`: the doc download is the point, and the dashboard button and the
"All done" line cover what comes next. Unless it is a pause, the finish carries
`"dashboard": true` and you keep waiting for the press (`console-finish.md`).
