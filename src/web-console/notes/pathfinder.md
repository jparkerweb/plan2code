# Pathfinder

- Post `"stopWarning"` while no map exists (Steps 0 to 4), `""` once it does, and `"specDir":"specs/<idea>"` when the folder is created.
- The menu after a decision is a `menu` card: `options` are `trail --form C`'s, the `Start fresh` one keeps `"fresh":true`. Set the card's `command` to the resume command printed under `OR START FRESH`. A declined confirm leaves you the pick: carry on as for `Start fresh`.
- The fresh-idea card carries `"templates":"idea"`, `"fill":"note"`.
- A doc that is a file as written (the map, a brief) is a `file` block (`{"id":"body","file":"specs/<idea>/pathfinder/map.md"}`). Keep `md` where `assumed` / `draft` state matters.
- Step 8 research subagents all report before the finish; the finish `body` names what each found. Report every one as a helper, whatever the Subagents switch says.
- Every session end `finish`es with Form A's command as `command`.
- Post `run` `pathfinder-chart` (id `map`) when a map is first written, and `pathfinder-research` (id the question's file slug; on `github`, `q<issue-number>`) as each research subagent reports or when you resolve a `research` question yourself. Other questions score through answers.
- The scope probe is **Leave for later**: "Which of these features are we leaving out this time?" as a `multi` with a recommended preset. Each option names a feature, its `detail` ends "(Leaving this out = ...)". Never phrase an option as a rule to keep.

## Briefs

The page shows **Write a brief** for this workflow. It arrives as a send:

```jsonc
{"reply":"Write a brief covering everything since 2026-09-15.","session":[{"i":"__brief","range":"since 2026-09-15"}]}
```

`range` is `today`, `this week`, `since <YYYY-MM-DD>` or `full`. `__brief` matches no item. Run your brief procedure, write the file, then post it as one `file` block in doc `brief` (reused, so a second replaces the first; Save as HTML appears only on that id):

```jsonc
{"docs":[{"id":"brief","title":"Brief","note":"Covers this week","blocks":[{"id":"body","file":"specs/<idea>/pathfinder/briefs/<the brief>.md"}]}]}
```

Say in chat where the file went.
