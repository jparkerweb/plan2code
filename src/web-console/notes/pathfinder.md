# Pathfinder on the Web Console

Workflow notes for `pathfinder`, part of the web console contract (`console.md`).

- Every probe, recap and menu goes through the page.
- Post `"stopWarning"` while no map exists (Steps 0 to 4) and `"stopWarning": ""`
  once it does, and `"specDir": "specs/<idea>"` when the folder is created
  (`console-stop.md` → Saying what stopping would cost).
- The menu after a decision is a `menu` card: its `options` are `trail --form C`'s, and the `Start fresh` one keeps its `"fresh": true` (the page words it "Start New Session" under the desktop app and asks the app for one on Send). Set the card's `command` to the resume command printed under `OR START FRESH`: the page copies it first. A declined confirm leaves you the pick: carry on as for any `Start fresh`.
- The fresh-idea card carries `"templates": "idea"` (`console.md` → The kinds).
- A doc that is a file exactly as written (the map once it is on disk, a
  brief) goes up as a `file` block (`{ "id": "body", "file":
  "specs/<idea>/pathfinder/map.md" }`) rather than pasted. Keep `md` blocks
  where a block's `assumed` / `draft` state carries meaning.
- Chart Step 8's research subagents must all report back before the
  finish (`console-finish.md` → Nothing of yours may still be running); the
  finish body then names what each one found.
- Report every research subagent as a helper, whatever the Subagents switch
  says (`console-subagents.md` → Reporting helpers).
- At every session end, post `finish` (headline, `body`, and Form A's command as
  `command`) BEFORE `stop`. Someone who spent the session in the browser never
  sees the Trail Footer, and without this their last screen promises a question
  that is never coming.
- Post `run` `pathfinder-chart` (id `map`) when a new map is first written,
  and `pathfinder-research` (id = the question's file slug; on `github`, `q<issue-number>`) as each research
  subagent reports back, or when you resolve a `research` question yourself
  (`console-meter.md`). Other questions score through their answers, so there is
  nothing to post for them.
- The scope probe is **Leave for later**: "Which of these features are we
  leaving out this time?" as a `multi` with a recommended preset. Every option
  names a feature, and its `detail` ends "(Leaving this out = …)". Never phrase
  an option as a rule to keep.

## Briefs

The page shows a **Write a brief** button when `workflow` is `pathfinder`,
because that is the workflow with a brief playbook. The person picks a range and
presses it; nothing else about the session changes.

It arrives through the wait loop like any other send:

```jsonc
{
  "type": "submit",
  "actions": [{ "i": "__brief", "type": "brief", "range": "since 2026-09-15" }],
  "reply": "Write a brief covering everything since 2026-09-15."
}
```

`range` is one of `today`, `this week`, `since <YYYY-MM-DD>` or `full`, which is
the range grammar the brief playbook already parses. `reply` says the same thing
in words, so a workflow that only reads `reply` needs no new code path. The
`__brief` id is not an item and matches nothing; it marks the action as being
about the session rather than about a question.

Run your normal brief procedure, write the file where it belongs, and then put
the same report on the page as a doc, as a `file` block on the file you wrote:

```jsonc
{
  "docs": [{
    "id": "brief",
    "title": "Brief",
    "note": "Covers this week",
    "blocks": [{ "id": "body", "file": "specs/<idea>/pathfinder/briefs/<the brief>.md" }]
  }]
}
```

One block holding the whole report is right here: a brief is read start to
finish, not block by block, and it gets Save as HTML, Print and Download buttons
that work on the document as a whole. Save as HTML appears only on the doc with
the id `brief`. Reuse the id `brief` so a second brief replaces the first
rather than growing a row of tabs; its version moves up by itself.

Say in chat where the file went, as you always would. The page is a second copy
for reading and printing, never the record.
