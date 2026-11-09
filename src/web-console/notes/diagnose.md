# Diagnose

## The bug

An argument that already describes the bug skips the cards it answers. Otherwise one `--wait` batch, no `templates`; the first card carries `"fill":"note"` (a Notebook tab fills it):

```jsonc
{"title":"Diagnose a bug","headline":{"stage":"The bug","cleared":0,"total":3},"items":[{"id":"bug","kind":"text","title":"What is wrong","fill":"note","body":"The bug, in a sentence or two."},{"id":"expected","kind":"text","title":"Expected and actual","required":false,"body":"What should happen, and what happens instead."},{"id":"see-it","kind":"text","title":"How to see it","required":false,"body":"The steps, command, page or input that shows it, and since when if known."}]}
```

A follow-up the answers leave open is a new card with a new id. A skipped card is no answer: work from the rest, never guess the missing steps, and ask again when you cannot show someone else the bug without it.

## The cause

Doc `cause`, posted as soon as there is something to show and grown as evidence lands, with `agent` `working` while you reproduce:

```jsonc
{"docs":[{"id":"cause","title":"The cause","note":"Reproduced; narrowing","blocks":[{"id":"repro","state":"settled","md":"## Reproduction\n\n..."},{"id":"found","state":"settled","md":"## The cause\n\n..."},{"id":"fix","state":"settled","md":"## Suggested fix\n\n... **Size:** Small (Quick Task)."}]}]}
```

- Unproven guesses are `assumed` blocks, ranked, each with its evidence and what would confirm it. Proven: `settled`. Ruled out: `"_delete":true`.
- Keeping a failing test in the project: `confirm` with `"doc":"cause"`, `yesLabel` "Keep it", `noLabel` "Throw it away".

## The bug name

After the cause, `--wait`:

```jsonc
{"id":"name","kind":"text","title":"Name for the write-up","doc":"cause","body":"Saved as `specs/<name>/DIAGNOSIS-<date>.md`. Lowercase words joined by dashes.","placeholder":"csv-export-drops-rows","pattern":"^[a-z0-9]+(-[a-z0-9]+)*$","patternHint":"Lowercase letters, numbers and dashes."}
```

Once written, re-send `cause` with `"saved":"specs/<name>/DIAGNOSIS-<date>.md"` and one `file` block for that path (delete the old block ids).

## The finish

`command` is `/plan2code-quick-task specs/<name>` (small fix) or `/plan2code-1-plan specs/<name>` (big fix), real folder filled in. `body`: the cause, how sure, and that the next step reads the diagnosis first. `"doc":"cause"`, `"dashboard":true`. Nothing kept (did not reproduce, no guess held): no `command`, say so in `body`.

A stop before the file is written: `body` says nothing was kept (and names any throwaway script or kept test), `"command":"/plan2code-diagnose"`.
