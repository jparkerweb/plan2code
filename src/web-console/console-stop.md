# Stop Requests on the Web Console

Part of the web console contract (`console.md`). Read when a send carries
`__stop` or `__dashboard`, or your workflow notes say to post a `stopWarning`.

## Stop requests

The page has a **Stop session** button. Pressing it sends, in one submit, any
answers the person had staged plus one more action:

```jsonc
{ "type": "submit",
  "actions": [ /* staged answers and notes, as usual */,
               { "i": "__stop", "type": "stop" } ],
  "reply": "...the answer lines...\nStop here and save my place, so I can pick this up later." }
```

`__stop` is not an item and matches nothing; like every `__` action it is
about the session. It arrives through `wait` with exit `0`, like any send. It is
the person ending the session, so act on it in this turn:

1. **Handle the answers under the workflow's own rules, and record only what is
   final.** A confirmed recap, an approval verdict, a finished checklist with its
   values. A pick that still owes its recap is not an answer yet: save it where
   the workflow keeps unfinished work (Pathfinder: the question's `## Evidence`,
   with the probes still outstanding and your recommendation for each) and never
   write a provisional `## Answer`. Do not claim a question the person picked
   from a menu in the same send. Settle only the final cards (`"settle": [...]`).
2. **Save your place** the way the workflow does when a session ends.
3. **Post `finish`** (`console-finish.md`) with a headline starting "Paused"
   (the page and `open --resume` both key off that word), a body naming what
   was saved and anything still open, and the resume command, without
   `--wait`. Name a question that was left mid-way, so they can ask for it by
   name next time.
4. **`stop`** the server.

Do not publish new questions and do not ask whether they are sure: the page
already asked.

The page only offers Stop on the person's turn. From the moment they press Send
until your reply lands, the button is disabled, so a stop never arrives while
you are halfway through writing their last answers. The one exception is an
agent that has stopped checking in: then Stop comes back, and the request waits
on disk for whichever session collects it next.

## Stop with a handoff

Off the dashboard, the Stop dialog offers **Stop with a handoff** first and
**Just stop and save** second. The handoff choice sends the same `__stop`, with
`handoff: true`, and `wait` adds `handoffSkill` (the Handoff skill's `SKILL.md`,
present in a built skill):

```jsonc
{ "type": "submit",
  "actions": [ /* staged answers and notes, as usual */,
               { "i": "__stop", "type": "stop", "handoff": true } ],
  "reply": "...the answer lines...\nStop here, save my place and write a handoff, so the dashboard can pick this up later.",
  "handoffSkill": "…/plan2code-handoff/SKILL.md" }
```

Act on it in this turn, in this order:

1. **Handle the answers** exactly as in "Stop requests" step 1.
2. **Save your place** exactly as step 2 there.
3. **Make the handoff file:**
   `node "<CONSOLE>" handoff new --workflow <yours> --skill <your skill> [--spec <spec>] --title "<short title>" --from-stop`
   It prints the `path` to write.
4. **Write the handoff.** Open `handoffSkill` with your file-read tool (never a
   skill-invocation tool) and write the document it describes to that `path`.
   Skip its questions and its "Where to write it" step: infer the Next task
   from where the work stands, and say in the document that it was inferred.
5. **Post `finish`** (`console-finish.md`) with a headline starting "Paused", a
   `body` that names the handoff path and says the dashboard will offer it, and
   the resume command, without `--wait`.
6. **`stop`** the server.

With no `handoffSkill` (a source checkout), use the structure in
`~/.agents/skills/plan2code-handoff/SKILL.md`. Do not ask whether they are
sure: the page already asked.

## Back to the dashboard, mid-workflow

On every workflow but the dashboard, a triangle left of Stop session takes the
person back to the dashboard. It follows Stop's rules exactly: only on their
turn, a confirm first (with your `stopWarning`), and the staged answers ride
along in the same submit:

```jsonc
{ "type": "submit",
  "actions": [ /* staged answers and notes, as usual */,
               { "i": "__dashboard", "type": "dashboard" } ],
  "reply": "...the answer lines...\nSave my place and take me back to the dashboard, right here in this session.",
  "resume": "node \"…/console.mjs\" open --resume <sid> --no-open --workflow dashboard" }
```

It is the same `__dashboard` a finished screen sends; with no `finish` on the
page it means "stop, then go home". Act on it in this turn:

1. **Handle the answers** exactly as step 1 above.
2. **Save your place** exactly as step 2 above.
3. **Go home:** run the `resume` the send carried (it turns the page back into
   the dashboard and drops this skill's page), read the dashboard skill
   (`skillFile`, or `~/.agents/skills/plan2code/SKILL.md`), then post its
   `menu` with `--wait` and carry on as the dashboard from its "Coming back
   from another skill", in this same conversation.

No `finish` and no `stop` in between: the menu is the ending. Say what you
saved in one terminal line, since no finish card will. A workflow with nothing
to save (a quick task not yet built) just goes home.

## Saying what stopping would cost

Some points in a workflow have nothing on disk yet, and stopping there loses the
answers given so far: Pathfinder before its map exists, Planning before a
checkpoint. The page cannot know where you are, so tell it:

```jsonc
{ "stopWarning": "The map is not written yet, so stopping now loses today's answers." }
```

It is shown in the page's Stop dialog, and the button changes from "Stop and
save" to "Stop anyway". Post `"stopWarning": ""` once stopping is safe again.
For `plan` sessions the page assumes a warning until you post that empty string.

## Picking up a paused session

`open --resume <sid>` (or `open --session <sid>`) clears a paused `finish`
itself, and the questions left open at the pause with it: the finish body
already said what was still open, so re-ask whatever the new session needs in
your own words rather than leaving the old asks on the page as duplicates.
Settled items stay. For any other ending you are deliberately taking back, post
`"finish": null` in your first patch.
