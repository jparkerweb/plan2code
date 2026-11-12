# The Variant Contract

Read this before writing any variant. It is the one written source of the rules between a variant you write and the page the skill builds around it. The page's tool part (top bar, dials, Copy) is shipped and never changes; you write only the variants and the `round.json` that describes them. `base.css` (placed inside every frame) implements the values and attributes named here, and `ui-prototype.mjs check` verifies the rules in section 5.

## 1. Shared style values

Each variant takes its look from shared values. The dials set them on the root of every frame, so one move of a dial restyles every variant at once. Use them through `var(...)`.

**Dial inputs** (set by the dials):

| Value | Holds | Example |
| --- | --- | --- |
| `--p2c-accent` | The accent color | `#2f6fed` |
| `--p2c-neutral` | The neutral (gray) color the surfaces are tinted from | `#6b7280` |
| `--p2c-font` | The font family (one of the six font sets, section 6) | `var(--p2c-font-set-humanist)` |
| `--p2c-text-size` | The body text size | `16px` |
| `--p2c-space` | The spacing unit, a plain number (1 is normal) | `1.25` |
| `--p2c-radius` | The corner radius | `8px` |
| `--p2c-screen-width` | The Screen size dial's width (a screen's frame is this wide; each flow step is too) | `390px` |
| `--p2c-x-<name>` | One per extra in `round.json` (section 4) | `--p2c-x-shadows` |

**Derived values** (worked out by `base.css` from the inputs, for light and dark):

| Value | Use it for |
| --- | --- |
| `--p2c-bg` | The page background |
| `--p2c-surface` | Cards, panels, inputs |
| `--p2c-text` | Body text |
| `--p2c-muted` | Secondary text, captions, placeholders |
| `--p2c-border` | Lines and outlines |
| `--p2c-on-accent` | Text on an accent-colored fill |
| `--p2c-space-1` to `--p2c-space-6` | The spacing scale: 4, 8, 12, 16, 24 and 32 px at a `--p2c-space` of 1 |

The values fall into four groups, and a screen or flow variant must use at least one value from each:

| Group | Values |
| --- | --- |
| Color | `--p2c-accent`, `--p2c-neutral`, `--p2c-bg`, `--p2c-surface`, `--p2c-text`, `--p2c-muted`, `--p2c-border`, `--p2c-on-accent` |
| Font | `--p2c-font`, `--p2c-text-size`, any `--p2c-font-set-...` |
| Spacing | `--p2c-space`, `--p2c-space-1` to `--p2c-space-6` |
| Corners | `--p2c-radius` |

You may add your own local values on top of the shared ones (`--card-gap: calc(var(--p2c-space-4) * 1.5)`, a second shade of the accent, a shadow). The contract asks that the shared values be used, not that nothing else is. A freed-up carry-over item (one the person left unticked) is where each variant shows its own take; a ticked item must look the same in every variant, so take it from the shared values only.

**Extras.** Each extra in `round.json` sets `--p2c-x-<name>` on the root, and also a `data-p2c-x-<name>` attribute so a variant can select on it:

| Type | `--p2c-x-<name>` | `data-p2c-x-<name>` |
| --- | --- | --- |
| `slider` | The number, with no unit (`calc(var(--p2c-x-columns) * 1)`, `calc(var(--p2c-x-lift) * 1px)`) | The number |
| `pick` | The chosen text | The chosen text (`[data-p2c-x-shadows="soft"]`) |
| `toggle` | `1` when on, `0` when off | `on` or `off` |

## 2. Root attributes

The page sets these on each frame's `<html>`. Do not write them yourself; style with them.

| Attribute | Values | Set by |
| --- | --- | --- |
| `data-p2c-theme` | `light`, `dark` | The light and dark dial |
| `data-p2c-state` | `ready`, `empty`, `loading`, `error` | The states dial |
| `data-p2c-length` | `short`, `typical`, `long` | The content length dial |
| `data-p2c-kind` | `screen`, `flow`, `terminal` | `round.json`'s `kind`, fixed for the round |

## 3. The marks a variant writes

- **States.** Put `data-p2c-when="<state>"` on each part that belongs to one state: the filled list on `ready`, the "No invoices yet" message on `empty`, the skeleton rows on `loading`, the failure notice on `error`. A part shared by two states lists both, separated by a space (`data-p2c-when="empty error"`). `check` counts marks on elements only, never in your `<style>` block. Parts with no mark show in every state. `base.css` hides every marked part whose list does not hold the root's state. Draw all four states for real: an empty state that guides, a loading state shaped like the content, an error that says what to do.
- **Content length.** Write each text that varies three times, side by side, marked `data-p2c-text="short"`, `data-p2c-text="typical"` and `data-p2c-text="long"` (a 6-letter name, an ordinary one, a 60-character one that tests wrapping). `base.css` shows only the root's length. A mark may list two lengths with a space, as for states.
- **Flow steps.** In a flow, each screen is an element directly inside `<body>` carrying `data-p2c-step="<label>"` (`data-p2c-step="1. Sign in"`). `base.css` lays the screens in one row that scrolls sideways and shows each label above its screen. A flow needs at least two steps. Each step is `--p2c-screen-width` wide (`base.css` passes it on as `--p2c-step-width`), and the frame grows to hold the whole row.

## 4. Terminal values

A terminal variant (`kind` is `terminal`) draws a text screen in the frame. In place of the font and corner values it takes:

| Value | Holds |
| --- | --- |
| `--p2c-term-bg` | The terminal background |
| `--p2c-term-fg` | The text color |
| `--p2c-term-accent` | Highlights, prompts, the selected row |
| `--p2c-density` | The line height, a plain number (1.4 is normal) |

A terminal variant uses at least one palette value (`--p2c-term-bg`, `--p2c-term-fg` or `--p2c-term-accent`) and `--p2c-density`. `base.css` sets the monospace font set, the palette and the line height on `<body>`. The four palettes are in section 6; the page sets the three palette values for the chosen palette and theme.

## 5. What `check` verifies

`node "<S>/ui-prototype.mjs" check --file <page>` reads the built page and reports each problem as `{ rule, variant, message }`. Exit 0 means clean; exit 4 means findings.

| Rule | A finding when |
| --- | --- |
| `outside-link` | A variant or the page holds an `http:`, `https:` or `file://` URL, a `//` URL anywhere (`//cdn.example.com/a.png` or `//localhost/a.png`, in an attribute, a `srcset`, a meta refresh or a CSS string), `@import`, or a `url(...)` that is not a `data:` URL or a `#` reference inside the same document. (An `xmlns` attribute on inline SVG is allowed: it names a format and loads nothing.) |
| `script` | A variant holds a `<script` tag, an `on...=` attribute (`onclick`, `onload`) or a `javascript:` URL |
| `state-missing` | A variant has no `data-p2c-when` mark for one of `ready`, `empty`, `loading`, `error` |
| `length-missing` | A variant has no `data-p2c-text` mark for one of `short`, `typical`, `long` |
| `value-unused` | A screen or flow variant uses no `var(--p2c-...)` from one of the color, font, spacing and corners groups; a terminal variant uses none from the palette values, or not `--p2c-density` |
| `step-missing` | A flow variant has fewer than two `data-p2c-step` screens |
| `frame-missing` | A variant named in the round facts has no frame in the page (only a hand-edited page; run `assemble` again) |
| `image-type` | A variant holds a `data:` image that is not PNG, JPEG, WebP or SVG |
| `image-size` | A variant holds a `data:` image over 1 MB once decoded (run `assemble` again so it becomes a placeholder) |
| `image-missing` | A variant names a `p2c-image:<name>` that `round.json`'s `images` does not list, so nothing was put in |
| `size` | The page is over the 5 MB soft ceiling. Reported as `overCeiling: true`, never as a finding |

## 6. What a variant file is

A variant file (`variant-a.html`) is one `<style>` block followed by markup:

- No `<html>`, `<head>` or `<body>` tags: the page wraps the file in its own frame document.
- No `<script>`, no `on...` attributes, no `javascript:` links. The frame cannot run script, so nothing would happen anyway.
- No `http:`, `https:`, `file://` or `//` URLs, no `@import`, no `url(...)` except a `data:` URL. Write an example web address as text without its scheme (`example.com/invoices`).
- Images only through `<img src="p2c-image:<name>" alt="...">`, where `<name>` is an image's `name` in `round.json`. The page puts the image in. Never write an SVG image as markup; small inline icons drawn with `<svg>` are fine.
- Real content: real names, numbers and labels for the screen in question, never "Lorem ipsum" or "Item 1".

## 7. `round.json`

One file per round, beside the variant files, written by you and checked by `assemble`.

| Field | Type | Holds |
| --- | --- | --- |
| `name` | text | The prototype's name: lowercase letters and digits joined by single hyphens (`invoices-screen`) |
| `round` | whole number, 1 or more | The round number `new-round` printed. `assemble` refuses a `name` or `round` that differs from the round's folder |
| `kind` | `screen`, `flow` or `terminal` | What is drawn |
| `request` | text, not empty | The person's original request, in a line or two |
| `direction` | text | Any typed direction; `""` when none |
| `carried` | list | Carry-over items kept the same in every variant |
| `freed` | list | Carry-over items each variant takes its own way |
| `notFound` | list | Carry-over items looked for and not found |
| `variants` | list, 2 to 5 | One entry per variant (below) |
| `starts` | object | Where each shared dial starts (below) |
| `extras` | list, at most 6 | The extra dials (below); `[]` when none |
| `images` | list | Each `{ "name", "path" }`: an image for the page, its path absolute or relative to the round folder; `[]` when none |
| `fonts` | list | Paths of the app's font files, absolute or relative to the round folder; `[]` when none |

The carry-over items are `colors`, `fonts`, `spacing`, `components` and `layout`.

**Freed-up items and the dials.** When an item is in `freed`, each variant starts the dials below from its own `starts`, the page gives each frame its own value until the person moves the dial, and the dial's reset gives each variant its own back. When the item is carried over (or not found), every variant shares the round's `starts` and a variant's own value for that dial is ignored.

| Item | Screen or flow dials | Terminal dials |
| --- | --- | --- |
| `colors` | `accent`, `neutral` | `palette` |
| `fonts` | `fontSet`, `textSize` | none |
| `spacing` | `space` | `density` |
| `components` | `radius` (the corners) | none |
| `layout` | none | none |

**A variant:** `letter` (`A` to `E`, in order, no gaps), `name` (two or three words), `file` (the variant's file name in the round folder), `what` (one line on what it is), and `starts` (its own starting values for the dials of freed-up items, with the same keys and types as the shared `starts`; `{}` when it has none).

**`starts` for a screen or a flow:**

| Key | Type |
| --- | --- |
| `screen` | One of the screen sizes in section 8 (`"Desktop 1280"`) |
| `theme` | `light` or `dark` |
| `accent`, `neutral` | A color as `#rrggbb` |
| `fontSet` | One of the font sets in section 8 (`"Humanist"`) |
| `textSize` | Pixels, a number from 12 to 24 |
| `space` | A number from 0.5 to 2 |
| `radius` | Pixels, a number from 0 to 32 |
| `state` | `ready`, `empty`, `loading` or `error` |
| `length` | `short`, `typical` or `long` |

**`starts` for a terminal:** `window` (one of the terminal sizes, `"120x30"`), `theme`, `palette` (one of the four palettes), `density` (a number from 1 to 2), `state` and `length`.

**An extra:** `name` (lowercase letters, digits and hyphens: it becomes `--p2c-x-<name>`), `label` (optional: the dial's label, the name when left out; no colon), `type` (`slider`, `pick` or `toggle`), then for a slider `min`, `max`, `step` and a number `start`; for a pick `choices` (two or more texts, none holding a double quote or a backslash) and a `start` among them; for a toggle a `true` or `false` `start`. `look` is `true` when Surprise me may move it (a look, like shadows) and `false` when it may not (a structure, like column count).

A complete example:

```json
{
  "name": "invoices-screen",
  "round": 1,
  "kind": "screen",
  "request": "A screen listing a customer's invoices, with what is overdue easy to spot.",
  "direction": "calm, plenty of room around totals",
  "carried": ["colors", "fonts", "spacing"],
  "freed": ["components", "layout"],
  "notFound": [],
  "variants": [
    { "letter": "A", "name": "Dense table", "file": "variant-a.html", "what": "A sortable table with overdue rows tinted", "starts": { "radius": 4 } },
    { "letter": "B", "name": "Split view", "file": "variant-b.html", "what": "A list on the left, the open invoice on the right", "starts": { "radius": 10 } },
    { "letter": "C", "name": "Cards", "file": "variant-c.html", "what": "One card per invoice, overdue ones first", "starts": { "radius": 16 } }
  ],
  "starts": {
    "screen": "Desktop 1280",
    "theme": "light",
    "accent": "#2f6fed",
    "neutral": "#6b7280",
    "fontSet": "System UI",
    "textSize": 16,
    "space": 1,
    "radius": 8,
    "state": "ready",
    "length": "typical"
  },
  "extras": [
    { "name": "shadows", "label": "Shadows", "type": "pick", "choices": ["none", "soft", "strong"], "start": "soft", "look": true },
    { "name": "columns", "label": "Columns", "type": "slider", "min": 1, "max": 4, "step": 1, "start": 2, "look": false },
    { "name": "dividers", "label": "Row dividers", "type": "toggle", "start": true, "look": true }
  ],
  "images": [],
  "fonts": []
}
```

## 8. Fixed names

| What | Names |
| --- | --- |
| Font sets | System UI, Humanist, Transitional, Slab Serif, Rounded Sans, Monospace Code (`base.css` names them `--p2c-font-set-system-ui`, `-humanist`, `-transitional`, `-slab-serif`, `-rounded-sans`, `-monospace-code`) |
| Screen sizes | Phone 390, Tablet 820, Desktop 1280 (the frame's width in pixels) |
| Terminal sizes | 80x24, 120x30, 160x48 (columns by rows) |
| Terminal palettes | Graphite, Amber, Phosphor, Ocean (`base.css` holds each one's background, text and accent for light and dark as `--p2c-palette-<slug>-<theme>-<bg, fg or accent>`) |
| Presets | Compact, Balanced, Airy, Bold |

## 9. Limits

| Limit | Value | Past it |
| --- | --- | --- |
| Variants in a round | 2 to 5 (3 by default) | `assemble` refuses the round |
| Extras | 6 | `assemble` refuses the round |
| One image | 1 MB | A labeled placeholder, named in the report |
| All images | 3 MB | The page is still made; the report names the largest |
| App font | 4 files, 2 MB together | The closest system set is used and the skill says so |
| Whole page | 5 MB, a soft ceiling | A warning that says what takes the space; it never blocks |

## 10. Writing a round

The order of work, so a round passes `check` the first time:

1. **Facts first.** Write `round.json`: the name, kind, request, direction, the three carry-over lists, one entry per variant (letter, name, file, `what`, its own `starts` for freed-up items), the shared `starts`, the extras, images and fonts. Every later file follows from it.
2. **One variant file at a time**, in letter order: its `<style>` block (shared values only for carried items), then its markup with all four states and the three lengths marked. Finish one before starting the next, and check it against the list below.
3. **Assemble, then check.** Fix what `check` names in the variant files, never in the page.

A complete small variant that passes `check` (it is `variant-a.html` of the test fixture `contract-example`, so it is checked on every test run):

```html
<style>
  .team { padding: var(--p2c-space-5); font-family: var(--p2c-font); font-size: var(--p2c-text-size); color: var(--p2c-text); background: var(--p2c-bg); }
  .team h1 { font-size: calc(var(--p2c-text-size) * 1.5); margin: 0 0 var(--p2c-space-4); text-wrap: balance; }
  .team ul { list-style: none; margin: 0; padding: 0; background: var(--p2c-surface); border: 1px solid var(--p2c-border); border-radius: var(--p2c-radius); }
  .team li { display: flex; justify-content: space-between; gap: var(--p2c-space-3); padding: var(--p2c-space-3) var(--p2c-space-4); border-top: 1px solid var(--p2c-border); }
  .team li:first-child { border-top: 0; }
  .team .role { color: var(--p2c-muted); }
  .team .bar { height: calc(var(--p2c-text-size) * 1.2); margin: var(--p2c-space-3) var(--p2c-space-4); border-radius: var(--p2c-radius); background: color-mix(in oklab, var(--p2c-neutral) 18%, var(--p2c-surface)); }
  .team button { background: var(--p2c-accent); color: var(--p2c-on-accent); border: 0; border-radius: var(--p2c-radius); padding: var(--p2c-space-2) var(--p2c-space-4); font: inherit; }
  .team button:focus-visible { outline: 2px solid var(--p2c-accent); outline-offset: 2px; }
</style>
<section class="team">
  <h1>Team members</h1>
  <ul data-p2c-when="ready">
    <li>
      <span data-p2c-text="short">Ana Ruiz</span>
      <span data-p2c-text="typical">Ana Ruiz-Okafor</span>
      <span data-p2c-text="long">Anastasia Ruiz-Okafor, Regional Accounts Lead, Northern Office</span>
      <span class="role">Admin</span>
    </li>
    <li><span>Tomas Berg</span><span class="role">Editor</span></li>
  </ul>
  <div data-p2c-when="loading" aria-label="Loading team members"><div class="bar"></div><div class="bar"></div></div>
  <p data-p2c-when="empty">No one else is on this team yet. Invite a teammate to share the work.</p>
  <p data-p2c-when="error">The team list did not load. Check your connection, then reload this page.</p>
  <button data-p2c-when="ready empty">Invite a teammate</button>
</section>
```

It takes color, font, spacing and corners from the shared values, marks all four states (the button shows in two), and writes the first name in three lengths. A second row with one plain name is fine: only the text that varies needs the three lengths.

The three most common findings, and their fix:

| Finding | Usual cause | Fix |
| --- | --- | --- |
| `state-missing` | The loading or error state was left out, or named only in the `<style>` block | Draw it in the markup with `data-p2c-when` on an element |
| `length-missing` | Only one version of the text that varies | Write it three times, side by side, marked `short`, `typical` and `long` |
| `outside-link` | An example web address with its scheme, or a picture or font loaded from the web | Write the address as text without `https://`; use `p2c-image:<name>`, a `data:` URL or an inline drawing |

A terminal variant differs in six ways:

- `kind` is `terminal`, and `starts` holds `window`, `theme`, `palette`, `density`, `state` and `length`.
- Colors come from `--p2c-term-bg`, `--p2c-term-fg` and `--p2c-term-accent`, not the screen values.
- Line spacing comes from `--p2c-density`; `base.css` already sets the monospace font, so set no font of your own.
- Write text as the terminal shows it, in a `<pre>` or fixed-width rows, sized to the window (80, 120 or 160 columns).
- No corners, shadows or images: draw boxes with characters (`+--+`, `│`) and highlight with the accent.
- States and lengths are marked exactly as for a screen.
