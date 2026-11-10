# The Web Console (the card)

A local page where the person answers your questions, reads your drafts and approves things. Read this card once per session. Read a topic file only when your workflow notes or the console's `read` output name it.

`<CONSOLE>` is `<SKILL_ROOT>/references/web-console/console.mjs` (globally `~/.agents/skills/<skill-name>/references/web-console/`; `~/.plan2code/console/console-dir` may hold the folder). Always quote the path. `node "<CONSOLE>" help <topic>` prints any topic file.

## Start

`node "<CONSOLE>" open --workflow <w>` (add `--spec specs/<idea>` when known). `<w>` is one of `dashboard`, `init`, `init-update`, `pathfinder`, `quick-task`, `plan`, `revise-plan`, `document`, `implement`, `implement-review`, `review`, `finalize`, `handoff`, `git`, `changelog`, `xray`, `diagnose`, `pr-prep`, `test`, `dead-code`. Launched from the dashboard? The session is open: run the `resume` command the launch carried instead.

Keep `sid`: every later command takes `--session <sid>`. `open` failing: carry on in the terminal. When `open` adds `remote` and a `note`, give the link, ask whether it opened, and move to the terminal if not. Tell the person the link (with `"inApp":true`, never print it: only how many questions are waiting) and end every terminal message with the latest `terminalLine`, verbatim.

Right after `open`, read `building.md` (implement, implement-review, quick-task only) and `notes/<workflow>.md`.

## The turn

```
node "<CONSOLE>" post --session <sid> --file - --wait 240 <<'EOF'
{"settle":true,"items":[...]}
EOF
```

Keep the heredoc quoted (`<<'EOF'`). PowerShell has no heredoc: write the patch to a file in the `session` folder `open` printed (never in the project) and pass `--file <path>`. Size the `--wait` slice to your shell limit: 5 minutes or more `240` (tool timeout 300000 ms), about 2 minutes `90`, 60 seconds or unsure `45`.

With nothing to post, `node "<CONSOLE>" wait --session <sid> --seconds 240` waits alone (same slice sizes).

**Every turn ends on a `wait` (or `post --wait`), never on text.** 

| Exit | Meaning | Do |
| --- | --- | --- |
| 0 | A send arrived | Handle it (below), then one `post --wait` |
| 10 | Nobody answered yet | Relay one line of your own, ending with the latest `terminalLine`, and wait again, same turn, without limit |
| 20 | `{"gone":true,"fix":...}` | Run its `fix` (replace `<yours>` with your workflow), give the new link, keep waiting |
| 30 | They canceled | Stop; ask what they want in the terminal |
| 3 | Patch refused | stderr names the item, the field and the fix; correct it and post again |
| 2 | Patch unreadable | stderr gives line, column and the spot; fix it and post again |

## A send

`reply` is what they would have typed: one line per question, parts joined with `; `. Act on it as their typed answer, in that turn, with no summary back. Open every `Image:` and `File:` path in it with your file-read tool before you answer.

A `Suggestions wanted on <title>:` line asks your recommendation for that item: reply in its `thread`, list each suggestion and why, and re-post the item (reworded, `recommended`) only when that helps.

Other fields, when present: `session` (actions about the session, dispatch on `i`: `__launch` and `__pickup` run `resume`, then read `skillFile` and follow it in this conversation; `__stop`, `__dashboard`, `__commit`, `__changelog`, `__delete`, `__brief`, `__review`, `__done`, `__git` are covered by the topic file `read` names, or by your notes), `chat` (the seq numbers of Quick questions that need a reply), `read` (open each path now, before acting), `resume`, `skillFile`, `handoffFile`, `fallback` (hop fields: run `resume` as given).

## A patch

One-line JSON, only what changed; the patch merges (`items`, `topics`, `docs` and blocks by `id`; `thread` appends; `null` deletes a key). The console fills `status:"open"`, `required:true`, `allowOther:true`, empty `options` and `thread`, and option keys `A`, `B`, `C` by position, so leave them out.

`{"title":"Audit export","headline":{"stage":"Working","cleared":4,"total":9,"confidence":"One area still needs work."},"items":[...],"agent":{"status":"working","activity":"Reading the plan"}}`

`headline.cleared`/`total` drive the progress bar: always fill them. `agent.activity` is one plain sentence; add `quietMinutes` (1 to 60) when a stretch may go silent. Say `status:"working"` only while you work on with nothing for the person to answer. A new open question hands the turn over by itself; with only a doc or notice up, post `"agent":{"status":"waiting"}` yourself before you wait.

Every item: `id` (new for each question, whole session), `kind`, `title` (2 to 4 plain words), `body` (markdown: the question and why it matters), optional `topic`, `doc`, `required:false` (adds Skip), `token` (`{"A":"approved"}`: the typed word an answer stands for).

- `choice`: `{"id":"q1","kind":"choice","title":"Export format","body":"Which format?","options":[{"text":"CSV","detail":"Opens in Excel","recommended":true},{"text":"JSON","detail":"For scripts"}]}`. Back: `{k}` or `{text}`; `allowOther:false` drops the free-text row.
- `text`: `{"id":"q2","kind":"text","title":"Who uses it","body":"Who, and for what?","placeholder":"For example: reviewers, in Excel every Monday."}`. Back: `{text}`. `pattern` plus `patternHint` checks shape (kebab-case). The placeholder is an offer, so write a whole answer. On the fresh-idea card in Pathfinder, Plan and Quick Task add `"templates":"idea"` (also when the idea came as the argument, with a one-line summary in `placeholder`; a resumed map, PLAN-DRAFT or checkpoint gets no idea card; never mention templates in the terminal); a Notebook tab fills a box marked `"fill":"note"`.
- `confirm`: `{"id":"q3","kind":"confirm","title":"Keep going","body":"Continue?","yesLabel":"Yes","noLabel":"Not yet"}`. Back: `{yes,text?}`.
- `recap`: `{"id":"q4","kind":"recap","title":"What we heard","body":"Is this right?","summary":"- ..."}`. Back: `{ok,text?}`.
- `menu`: `{"id":"q5","kind":"menu","title":"Next step","body":"What now?","options":[{"text":"Plan it"}],"command":"/plan2code-1-plan"}`. Back: `{k}`.

| Kind | Use | Extra fields | Back |
| --- | --- | --- | --- |
| `multi` | any number of several | `options`, `presets:[{label,ks}]` | `{ks,text?}` |
| `review` | read, then approve | `doc` (required), `summary`, `verdicts:[{id,label,danger?}]`, `nothingYet` (false once the change is on disk) | `{verdict,text?}` |
| `checklist` | steps only they can do | `steps`, `valuesLabel` | `{done?,state?,text?}` |
| `list` | reorder or edit a breakdown | `rows:[{id,title,body}]` | `{rows}` or `{text}` |
| `notice` | read, no answer | none | none |

Items show in the order sent: send them in the order you want them answered.

**Documents:** the first patch that carries `docs` is answered with a `read` pointer to `console-docs.md`.

## Settling and notes

`"settle":true` marks every card in their latest send answered with what they sent; `"settle":["q2"]` names cards. A card the same post reopens is never settled. To record your own reading, send the item with `answer` (`{k}`, `{ks}`, `{text}`, `{yes}`, `{verdict,text}`, `{rows}`).

Every note in an item's `thread` gets a reply: `{"id":"p4","thread":[{"who":"agent","text":"..."}]}`. Send only new entries.

After the person's note on an open question, reword it (same `id`), retire it with `"_delete":true`, or send `"stands":true` if it still applies, in the patch with your reply or your next question. Until you do, a new open required question is refused. Do the same when an Ask reply or your own finding changes what a question assumed.

## What the console refuses (exit 3)

- more than three open required questions at once (optional cards and notices do not count)
- internal vocabulary in a title (grill, frontier, fog, HITL, AFK, durable, `Locked:`, `Blocked by:`, `State:`)
- more than one recommended option on a question
- loop completion markers, reserved so agent text can never fake a done signal (`TASK_COMPLETE`, `PHASE_COMPLETE` and the rest)
- a bare Requirements, Feasibility, Integration or Risk followed by a number (hyphenate or reword)
- a doc `version` that goes back (leave `version` out)
- a finish `command` with `<` or `>` in it
- a note left without a reply
- a `finish` while `stopWarning` is set or a helper is still `running`
- a `stop` with no `finish` (`stop --session <sid> --force` for a dead page)

It cannot see these two: every turn ends on a `wait`, and no new open question after a `finish`.

Ending: every session end posts `finish` (`{"settle":true,"finish":{"headline":"Phase 3 is done","body":"...","command":"/plan2code-3-implement specs/x/overview.md","dashboard":true}}`, with `--wait`, then keep waiting for the button), then `stop`. A pause (headline starting "Paused") has no `dashboard` and stops at once. Your notes give your workflow's finish; read `console-finish.md` for every field.

## Read when

| File | When |
| --- | --- |
| `notes/<workflow>.md` | right after `open` |
| `building.md` | right after `open`: implement, implement-review, quick-task |
| `console-launches.md` | you are the dashboard |
| `console-meter.md` | a `run` was refused |
| `console-attachments.md` | a file you write under `specs/` cites a note's attachment |
| `console-trouble.md` | something breaks (a failed `open`, a repeat delivery, a dead server) |
