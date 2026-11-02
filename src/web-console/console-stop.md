# Stop Requests

The console points here when a send carries `__stop`, or `__dashboard` with no `finish` up. Your workflow notes also say when to post a `stopWarning`.

## `__stop`

The person is ending the session: act on it in this turn. It arrives in `session` (`[{"i":"__stop"}]`) with any answers they had staged in `reply`.

1. Handle the answers under the workflow's own rules and record only what is final: a confirmed recap, an approval verdict, a finished checklist. A pick that still owes its recap is not an answer yet: save it where the workflow keeps unfinished work (Pathfinder: the question's `## Evidence`, with the probes outstanding and your recommendation) and never write a provisional `## Answer`. Do not claim a question they picked from a menu in the same send. Settle only the final cards (`"settle":[...]`).
2. Save your place the way the workflow does when a session ends.
3. Post `finish` (`console-finish.md`) without `--wait`: a headline starting "Paused", a body naming what was saved and anything open (name a question left mid-way), and the resume command. If `stopWarning` is set, clear it in the same patch (`"stopWarning":""`): a finish posted while it is set is refused.
4. `stop` the server.

Publish no new questions and do not ask whether they are sure: the page asked. Stop is only offered on their turn; the exception is an agent that stopped checking in, then the request waits on disk.

## `__stop` with a handoff

`{"session":[{"i":"__stop","handoff":true}],"handoffSkill":"…/plan2code-handoff/SKILL.md"}`. In order:

1. Handle the answers as above.
2. Save your place as above.
3. `node "<CONSOLE>" handoff new --workflow <yours> --skill <your skill> [--spec <spec>] --title "<short title>" --from-stop` prints the `path` to write.
4. Open `handoffSkill` with your file-read tool and write the document it describes to that `path`. Skip its questions and its "Where to write it" step: infer the Next task from where the work stands and say so in the document. With no `handoffSkill`, use `~/.agents/skills/plan2code-handoff/SKILL.md`.
5. Post `finish` as above, its body naming the handoff path and saying the dashboard will offer it; clear any `stopWarning` in the same patch.
6. `stop` the server.

## `__dashboard` with no finish up (home, mid-workflow)

Same rules as Stop: their turn only, staged answers ride along.

1. Handle the answers as above.
2. Save your place as above. A workflow with nothing to save (a quick task not yet built) just goes home.
3. Run the `resume` the send carried, read the dashboard skill (`skillFile`, or `~/.agents/skills/plan2code/SKILL.md`), post its `menu` with `--wait`, and carry on as the dashboard in this conversation.

No `finish` and no `stop`: the menu is the ending. Say what you saved in one terminal line.

## `stopWarning`

Where stopping loses answers (Pathfinder before its map exists, Plan before a checkpoint), post `{"stopWarning":"The map is not written yet, so stopping now loses today's answers."}`. The Stop dialog shows it and says "Stop anyway". Post `"stopWarning":""` once stopping is safe, or in the same patch as a paused `finish`. For `plan` the page assumes a warning until you post the empty string.

## Picking up a paused session

`open --resume <sid>` clears a paused `finish` and the questions left open at it; re-ask what you need in your own words. Settled items stay. For any other ending you are taking back, post `"finish":null` in your first patch.
