# Documents on the Web Console

The console points here at your first patch with `docs`. A doc is a tab of blocks the person reads beside the questions.

`{"docs":[{"id":"map","title":"What we've agreed","note":"what changed in this version","saved":"specs/lunch-vote/pathfinder/map.md","blocks":[{"id":"b1","md":"## Where we're headed\n\n..."},{"id":"b2","state":"assumed","md":"### File format\n\nAssuming CSV..."},{"id":"b4","file":"specs/lunch-vote/overview.md"}]}]}`

Docs and their blocks merge by `id`; a new id is added at the end. Patch blocks as decisions land:

- `{"id":"b2","state":"settled"}` settles b2 and keeps its text; blocks you leave out stay.
- `{"id":"b3","_delete":true}` removes a block; a doc entry with `"_delete":true` removes the tab.

## Block content: one of three

- `md`: markdown you write.
- `file`: the console reads the text from that project file (inside the project, 512 KB at most). Re-send the block, or the doc with `"refresh":true`, after the file changes. `"select":"tasks"` keeps only its `- [ ] **Task N.M:**` lines. Never paste a file you can name.
- `image`: `{"id":"s1","image":"shots/run.png","alt":"..."}`: a PNG, JPEG or WebP (5 MB at most) saved directly in the session's `shots/` folder (the `session` path `open` printed), named with letters, digits, `.`, `_` or `-`. Anything else is exit 3.

## State

`state` is `settled` (decided; the default), `assumed` (picked to keep going, still open: shown dashed) or `draft` (dimmed). Mark assumptions honestly so a half-finished doc does not read as decisions.

## Doc fields

- `note`: one line saying what changed; write one whenever you change a doc.
- `stale`: `true` while answers the doc does not reflect have landed.
- `saved`: the path of the file the doc mirrors, when one exists; leave it off docs that exist only here.
- `version`: moves by itself when content changes and never goes back; leave it out.
