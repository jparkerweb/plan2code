# UI Prototype

## Starting card

One `--wait` batch after Step 1. A card cannot open with its boxes ticked, so the carry-over card's preset ticks every found item in one press, and a Skip on it keeps everything found (all ticked is the default); leave the card out for a project with no screens:

```jsonc
{"title":"UI prototype","headline":{"stage":"Start","cleared":0,"total":3},"items":[{"id":"carry","kind":"multi","title":"Carry over","required":false,"body":"Ticked items look the same in every variant; unticked ones are where each variant tries its own take. Skip keeps everything found; tick only what should stay the same to free the rest. Attach screenshots or images in this card's note.","options":[{"k":"1","text":"Colors","detail":"src/styles/theme.css: accent #0f766e, gray #64748b"},{"k":"2","text":"Fonts","detail":"none found"}],"presets":[{"label":"Everything found","ks":["1"]}]},{"id":"spread","kind":"choice","title":"How different","allowOther":false,"body":"How far apart should the variants be?","options":[{"text":"Subtle","detail":"Same layout, different treatment"},{"text":"Balanced","detail":"One layout difference each","recommended":true},{"text":"Radical","detail":"Different layouts"}]},{"id":"direction","kind":"text","title":"Direction","required":false,"body":"Anything every variant should stay inside.","placeholder":"Calmer colors, bigger type, room around the totals."}]}
```

A "none found" option is never in the preset. Attached files arrive as `Image:` and `File:` paths in `reply`: open each, then say per image, in your next post, whether it goes in the page or is a look to match (a `notice`, or the line in the paste card's `body`).

## The page

The prototype opens in its own browser tab through `open`; it is never a doc or an image on the console. Post one `{"run":{"event":"ui-prototype-round","id":"<name>-round-<N>"}}` for each round drawn, with the paste card.

## Paste card

A `text` item, `--wait`, `"title":"Paste your choice"`, a new id per round (`paste-2`). `body`: the three closing lines, the page's path, and the plain line when `check` left findings. `placeholder`: `Plan2Code UI prototype choice` and a few lines of the block. The answer arrives as `Paste your choice: Plan2Code UI prototype choice` with the rest indented: drop the `Paste your choice: ` prefix and the two-space indent before `read-block` and `choice.txt`.

## Next steps

After the read-back, a `menu`, `--wait`: Save, Narrow from my pick, Fresh set, Done, each with a one-line `detail`; the read-back is its `body`. Fresh set's brief goes back up as the three starting cards with new ids (`carry-2`, `spread-2`, `direction-2`), each choice as it stood marked `recommended` or in the preset.

## Save questions

One batch, `--wait`: a `choice` "Save where" (the spec folders, the launched one first and `recommended`, then "New spec", whose name comes in the note or a follow-up `text`), a `text` "Prototype name" (the proposed name in `placeholder`, `"pattern":"^[a-z0-9]+(-[a-z0-9]+)*$"`, `"patternHint":"lowercase words joined by hyphens"`), and a `text` "Why the others lost" (`required:false`, left out when already said). `exists`: a `confirm` "Replace it?", `"yesLabel":"Replace","noLabel":"Pick another name"`.

## The finish

`headline` "Prototype saved" or "Prototype done"; `body` the saved paths and the `specs/` git line, or the draft's path and that it stays for 30 days; `"dashboard":true`; `command` `/plan2code-1-plan` or `/plan2code-0-pathfinder` as fits, none when nothing was saved; never `commit`. A stop before a save: `body` says the draft is kept for 30 days and gives its path, `"command":"/plan2code-ui-prototype"`.
