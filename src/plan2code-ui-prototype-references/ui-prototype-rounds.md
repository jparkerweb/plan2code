# After the Paste
> Part of plan2code-ui-prototype: read at Step 6, right after `read-block` and before the read-back. Never invoked as a skill.

The pasted block is the record of the round: it names the prototype, the page, the round, the pick, every dial and the note. Each next step below works from the block alone, so it also works in a new conversation, as long as the drafts are still there (30 days).

## Reading the block

`read-block` returns `fields`:

| Field | From the line | Use |
| --- | --- | --- |
| `prototype` | Prototype | The name for `new-round` and `save` |
| `file` | File | The page this block came from |
| `round` | Round | Compared with the newest draft (`latest`) |
| `chosen`, `others` | Chosen | The pick, and the variants not chosen (letter and name) |
| `carried`, `freed` | Carried over, Freed up | The carry-over choices of that round |
| `direction`, `preset`, `note` | Direction, Preset, Note | Present only when the person had something there |
| `dials` | Screen size to Content length (a terminal: Window size to Content length) | Each `{ label, value, changedFrom }`; `changedFrom` is null for a dial left alone |
| `extras` | Extra, `<label>` | Each extra the same way |
| `unknown` | any other line | Lines the script does not know (below) |

Lines may come in another order, inside a code fence, or edited by hand: the script reads them all the same.

**The round folder.** A round's files sit in `round-<N>` beside its page (`<name>-round-<N>.html`, the File line). Its `round.json` holds the request, the carry-over lists, the images and the fonts; `choice.txt` and `rejected.txt` for a save go there too. In a new conversation, find it from the File line. When it is gone, ask the person for the request in a line.

## Save

Step 7 in the prompt holds the steps. In short:

1. The spec folder: the existing ones under `specs/` (the launched one first) plus **New spec**. Run from another skill: that skill's folder, no question.
2. A short lowercase hyphenated name, proposed from what the prototype is; the person may change it.
3. Why each variant not chosen lost, in one line each, unless already said.
4. `choice.txt` (the block exactly as pasted) and `rejected.txt` (one line per variant not chosen: letter, name, what it was, why it lost) in the round folder, then `save`.
5. Error `exists`: ask, and use `--replace` only on a yes.

`save` keeps only the page of the round the block came from (`--file` is its File line, or the newest page when the File line is gone) and removes every other draft of that prototype. The decisions file holds the request, the block with its File line set to the saved page, and the lines from `rejected.txt`.

## Narrow from my pick

A new round, narrower than the last.

1. `new-round --project . --name <prototype>`: the next round number.
2. **Variant A is the pick** with the note applied. When the note asks for no change to the pick (or there is no note), copy the picked variant's file from the old round folder as `variant-a.html` instead of rewriting it. When the note changes it, start from that file and change only what the note asks.
3. **Variants B and C are close alternatives**: each keeps the pick's structure and changes one thing the note or the moved dials point at (denser rows, the panel on the other side, a different heading scale). The "how different" level for this round is Subtle unless the person says otherwise. More or fewer only if the person asks.
4. **The tuning carries over.** Each dial line in the block becomes the new round's `starts`, by its value now (not its "changed from" value):

   | Block line | `starts` key | Example |
   | --- | --- | --- |
   | Screen size | `screen` | `"Desktop 1280"` |
   | Theme | `theme` | `"dark"` (lower case) |
   | Accent color, Neutral color | `accent`, `neutral` | `"#2f6fed"` |
   | Font set | `fontSet` | `"Humanist"`; for `App font`, keep the old round's `fonts` list and `fontSet` |
   | Text size | `textSize` | `16` (drop the `px`) |
   | Spacing | `space` | `1.25` |
   | Corners | `radius` | `8` (drop the `px`) |
   | State, Content length | `state`, `length` | `"ready"`, `"typical"` (lower case; Very long is `"long"`) |
   | Window size, Palette, Density | `window`, `palette`, `density` | terminal only |
   | Extra, `<label>` | that extra's `start` | a pick's choice as `round.json` spells it (`"soft"` for Soft), a toggle's On as `true`; keep the same extras, same names |

5. **Carried, freed and not found, `kind`, `images` and `fonts` stay as they were** (a copied variant still names its images). A freed-up item's dial that the person moved now has one value for all: put it in the shared `starts` and give each variant `{}` for it. One left unmoved keeps the pick's own start for variant A and the alternatives' own for B and C.
6. Keep the request and the direction; add the note to the direction only if it is a standing wish ("calmer overall"), not a one-off change.
7. Then Steps 4 and 5: assemble, check, look, open, and the three closing lines (say A is their pick).

## Fresh set

For when nothing in the round was right.

1. **Show the brief first**, so it can be changed: the carry-over ticks, the direction and the "how different" level (Radical is worth suggesting when Balanced missed). Keep each as it was unless the person changes it. Images stay as they were read.
2. `new-round --project . --name <prototype>`: the next round number, same prototype.
3. **No variant carries over.** Write new variants from new plans (the design reference), avoiding the structures the person just turned down.
4. **The dials go back to the start**: `starts` as Step 3 would set them from the carry-over, not from the block. Extras may change to fit the new variants.
5. Then Steps 4 and 5.

## Done

Nothing is saved. Say that the draft stays for 30 days and give the page's path once more (the block's File line). The person can open it again, or paste the block in a later conversation to save or narrow.

## Unusual blocks

- **From an older round** (`latest` false): say so first ("This is from round 1; round 3 is the newest"). Ask whether to carry on from it. Narrow or Fresh set from it still makes the next round number; Save keeps that older round's page if it is still there.
- **Edited, with lines the script does not know** (`unknown` not empty): read them as part of the person's note and mention them in the read-back. Never drop them silently.
- **Its page is gone** (`fileExists` false): say so. Narrow and Fresh set still work from the block (when the round folder is gone too, the pick is drawn again from its name, the dial lines and the note). Save needs a page: offer to draw the pick again as a new round and save that one.
- **From a saved page** (`saved` true, the File line under `specs/`): say it is already saved there. Save again only from a new round (Narrow or Fresh set), whose save asks before replacing. Its drafts are gone, so Narrow draws the pick again from its name, the dial lines and the note, and takes the request from the saved decisions file beside the page.
- **Missing lines** (no Chosen, no Prototype): ask the person to press Copy again and paste the whole block.
