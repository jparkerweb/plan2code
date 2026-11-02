# When Things Go Wrong

| Situation | Do |
| --- | --- |
| `open` fails, or `node` is missing or older than 18 | Say so in one line and carry on in the terminal; install nothing |
| `wait` returns 20 | `open --resume <sid>`, give the new link; nothing they typed is lost |
| They close the tab | Nothing: drafts are saved and the link restores everything |
| Your session ends mid-flight | Their answers stay on disk; a fresh session runs `status` (or `open --resume`, which reports `pendingResult:true`) and `wait` returns them |
| They ask to go back to the terminal | `finish`, then `stop`, and continue; files under `specs/` are unchanged |
| The page is dead, the server will not answer, or the session is abandoned with no finish | `stop --session <sid> --force` (a plain `stop` with no finish is refused, exit 3) |
| Picking up a paused session | `open --resume <sid>` clears the paused `finish` and its open questions; re-ask what you need (`console-stop.md`) |
| The same result arrives twice | Your harness killed `wait` after the hand-over. Handle it once; most of a repeated patch is harmless since items merge by id, but `thread` appends: leave out entries you already sent |
| The same chat arrives twice | Replies merge by `id`: re-post the same reply if it is not on the page yet; do not answer a second time |
| A patch is refused (exit 3) | stderr names the item, the field and the fix; nothing was written. Correct it and post again. A `version` refusal means a stale payload: drop `version` |
| A doc block's `file` is refused | It must be a file inside the project, under 512 KB; `select` only takes `tasks` |
