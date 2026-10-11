# When Things Go Wrong on the Web Console

Part of the web console contract (`console.md`). Read when something goes wrong.

| Situation | What to do |
| --- | --- |
| `open` fails | Say so in one line, carry on in the terminal. Never block on this. |
| `wait` returns `20` | `open --resume <sid>`, give them the new link. Nothing they typed is lost. |
| They close the tab | Nothing happens. Drafts are saved. Reopening the link restores everything. |
| Your session ends mid-flight | Their answers still land on disk. A fresh session runs `status` (or `open --resume`, which reports `pendingResult: true`), and `wait` returns them. An uncollected result is never discarded. |
| They ask to go back to the terminal | `stop` the session and continue. The files under `specs/` are unchanged. |
| The session ends and they are still in the browser | Post `finish` **before** `stop`, and wait for the dashboard button first unless it is a pause (`console-finish.md`). Without it their last screen says the next question is coming, and then says contact was lost. |
| You started subagents or background jobs | Wait for every one to report back before `finish`, posting `working` with a count meanwhile. A finish while they run tells the person it is safe to close the terminal, and that kills them. |
| Any session end, not only the last one | Also post `finish`: an off-ramp that routes elsewhere, a checkpoint that saves and stops, a stop request. Anything that ends the session without it leaves the page promising a question that is not coming. |
| Picking up a paused session | `open --resume <sid>` clears a paused `finish` and the questions left open at it; re-ask what you still need (`console-stop.md` → Picking up a paused session). |
| The same result arrives twice | Your harness killed `wait` after it handed the result over but before it recorded that. Handle it once. Most of a repeated patch is harmless, because items merge by id, but `thread` **appends**: leave out any thread entry you already sent, or the person sees your reply twice. |
| The same chat arrives twice | Replies merge by `id`, so re-post the same reply if it is not on the page yet; do not answer the question a second time. |
| A patch is refused (exit `3`) | stderr names every problem; nothing was written. Fix them and post again. A `version` refusal means the payload is stale: drop `version` and let it move by itself. |
| A doc block's `file` is refused | It must be a file inside the project, under 512 KB; `select` only takes `tasks`. |
| `node` is missing, or older than 18 | One line, then the terminal. Do not try to install anything. |
