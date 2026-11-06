# Launches (the Dashboard)

Read when you are the dashboard. The dashboard skill's own prompt (`plan2code/SKILL.md`) has the menu judgment and launch steps; this is what the page does around them.

## A launch

A pick arrives with `session:[{"i":"__launch","skill":"plan2code-3-implement","workflow":"implement","spec":"specs/lunch-vote"}]`, plus `resume` and `skillFile`. `spec` is present only when the skill takes one and the person picked it. Run `resume` first, before reading anything: it reuses the live server and turns the page from the menu into the skill's starting screen while you read. Then read `skillFile` (absent outside an install: `~/.agents/skills/<skill>/SKILL.md`) with your own file-read tool and follow it from the top. Never hand it to a skill-invocation tool: every skill below the dashboard ships `disable-model-invocation: true`, and the call errors out.

A session handed to you is resumed, never re-opened (`--title` and `--spec` are honored on resume). A resume to or from `dashboard`, or into `git` from any skill, clears the page; a skill run inline from another (a quick task's review) never resumes. Its Interface step is already answered by the launch, and you have read the card: read only the notes or building files its Interface names. Post before anything slow.

## What the page knows

`state.scan` is `{hasAgents,isGit,pending,specs:[{dir,name,state,detail,touched}],handoffs,handoffsDir}`, a snapshot of the last `open` (a spec created mid-session appears at the next dashboard resume). `pending` is the count a commit would take (`null` when git cannot say). The `menu` you post (`note`, `recommend`, `details`) describes the initially selected spec; leave any field out and the page falls back to that spec's own next step, and derives them again when the person switches specs. Post it with `--wait`.

A `__stop` before a pick ends the session the usual way: `finish` (headline "Paused", `"command":"/plan2code"`), then `stop` (`console-stop.md`).

`handoffs` is this checkout's unused handoffs, newest first (`[{id,title,next,written,spec,skill,workflow}]`, read from `~/.plan2code/handoffs/`), shown as dashed Handoff chips.

## A pick-up

**Pick it up here** sends `session:[{"i":"__pickup","handoff":"2026-10-17-1152-handoff"}]` with `resume`, `skillFile` and `handoffFile`. `wait` already read the handoff's stored skill and spec and marked it used. Run `resume`, read `skillFile`, then `handoffFile`, follow the skill from where its real work starts, and carry on from the handoff's **Next task**. With `"fallback":true` (the named skill or spec was gone, or the Handoff skill wrote it) say so in one line, since Quick Task is picking it up.

## A delete

The ✕ on a chip (after the page's two-step confirm) sends `session:[{"i":"__delete","type":"delete","spec":"specs/<name>"}]` (a handoff has `handoff` where a spec has `spec`). It is no hop: no `resume`, you stay the dashboard. Delete through `node "<CONSOLE>" delete-spec --spec <spec>` or `delete-handoff --handoff <id>`, never your own `rm`; exit 3 with `message` means refused with nothing touched. Then `open --resume <sid> --no-open --workflow dashboard` to rescan, and post the menu again with `--wait`, its note saying what went or why not.
