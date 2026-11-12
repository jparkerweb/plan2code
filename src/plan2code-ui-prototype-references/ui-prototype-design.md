# Designing Variants
> Part of plan2code-ui-prototype: read while planning and writing variants, before any HTML. Never invoked as a skill.

An unguided model lands on the statistical center of what it has seen, so its pages look alike. The counter is a process, not a style: plan each variant in writing, review the plan against the known giveaways, then build. The shared values and marks are in `ui-prototype-contract.md`; this file is about making what you draw look considered.

## 1. Plan each variant first

Write a short plan per variant, in your head or your notes, before its HTML. Each variant gets its own plan, or the variants converge.

| Line | Holds |
| --- | --- |
| For | Who uses this screen, and in what moment ("a bookkeeper closing the month") |
| Make easy | The one thing the screen must make easy ("spot what is overdue") |
| Structure | A one-line layout concept, with alignment stated; a tiny wireframe if it helps |
| Type scale | Three to five sizes as multiples of `--p2c-text-size`, and the weights |
| Accent | The one place the accent is spent, and why there |

A tiny wireframe is enough:

```
[ filters ][ 14 overdue, $8,420 ]
[ table: client | due | amount ]
```

Then review the plan. Strike anything you would produce for any similar page, and replace it with a choice this product's content asks for. Only then write HTML.

## 2. Giveaways of an AI-made page

Check every plan against these. One alone can be right for a brief; reaching for it by default is the problem.

- **Warm cream**: a cream background near `#F4F1EA`, a high-contrast serif display, a terracotta accent.
- **Near-black with one acid accent**: a dark page with a single acid green or vermilion.
- **Hairline broadsheet**: thin rules, square corners, dense columns, newspaper styling with no reason.
- **The SaaS-card kit**: identical rounded cards, one radius everywhere, the same soft shadow under each, gradient washes as decoration.
- **Template chrome**: tracked-out all-caps eyebrows above every heading, meta strings joined with middle dots, monospace for small data labels, a trailing arrow on every link and button.
- **Also**: a big-number hero with a small label and a gradient accent; fade-and-slide-up entrances on each section; one accented word in a headline; all-caps labels; labels above content that needs none; purple gradients on white.

## 3. Real content

- Write for this product: plausible names, numbers and dates ("Halvorsen Dental, due Oct 14, $1,240.00"), never "Lorem ipsum", "Item 1" or "John Doe".
- Name things the way the people using it would.
- Buttons say exactly what happens: "Send reminder", "Save changes", never "Submit" or "Continue".
- One name per action through a flow: a "Publish" button leads to a "Published" notice, not "Saved".
- Numerals for counts ("8 invoices"), consistent date and money formats, sentence case, plain verbs, active voice.
- Every text that varies is written three times with `data-p2c-text`: short (about 6 letters), typical, and long (about 60 characters, to test wrapping). Let containers wrap or truncate cleanly; flex children that truncate need `min-width: 0`.

## 4. Drawn states

Mark each with `data-p2c-when`, and draw each one for real.

| State | Draw |
| --- | --- |
| `ready` | The filled screen with the real content |
| `empty` | What to do next: one line on why it is empty and a button that starts it ("Create your first invoice") |
| `loading` | A skeleton shaped like the content (rows, blocks where text will be), not a lone spinner; a loading label ends in "…" |
| `error` | What happened and what to do ("Couldn’t reach the bank. Check the connection and try again."), next to the part that failed; never apologize, never vague |

- Focus is always visible: a `:focus-visible` outline in the accent, never `outline: none` without a replacement.
- Hover and pressed are drawn and stronger than rest. Motion only answers an action, and honors `prefers-reduced-motion`.

## 5. Typography

- `font-family: var(--p2c-font)` on the body: the font set dial supplies the family. One family, or two clearly distinct ones (a second `--p2c-font-set-...` for headings only when the plan calls for it).
- A clear scale derived from the dial: `--t-small: calc(var(--p2c-text-size) * 0.875)`, `--t-h2: calc(var(--p2c-text-size) * 1.5)`, `--t-h1: calc(var(--p2c-text-size) * 2.25)`. Hierarchy by size, weight and color; real contrast between levels.
- Lines under about 80 characters (`max-width: 70ch` on text blocks).
- `font-variant-numeric: tabular-nums` in number columns; right-align money.
- `text-wrap: balance` on headings.
- Real characters: "…" not "...", curly quotes and apostrophes, a non-breaking space in units ("10&nbsp;MB").

## 6. Color

- Build every color from the shared values: `--p2c-bg`, `--p2c-surface`, `--p2c-text`, `--p2c-muted`, `--p2c-border`, `--p2c-accent`, `--p2c-on-accent`. They follow the light and dark dial for you; add local shades with `color-mix(in oklab, var(--p2c-accent) 15%, var(--p2c-surface))`.
- One dominant surface, the rest quiet. Spend your boldness in one place: the accent marks the one thing the screen must make easy, not every button and border.
- Text contrast at least 4.5:1 (3:1 for large text and for control outlines). Muted text is for secondary lines, never for anything a person must read to act.
- Status colors (overdue, failed) carry a word or an icon too, never color alone.

## 7. Spacing, corners and structure

- Every gap and padding from `--p2c-space-1` to `--p2c-space-6`; a local value is a `calc()` of them. Group related things tight and separate groups wide.
- Corners from `--p2c-radius`; a nested element takes a smaller radius (`calc(var(--p2c-radius) / 2)`), so one radius is not stamped on everything.
- Structure encodes something about the content. Borders, dividers, numbering and labels mean something; numbered markers (01, 02, 03) only for a real sequence.
- Targets at least 24 by 24 px (44 on a phone screen is better).

## 8. Icons

- Draw icons inline as small hand-written `<svg>` markup (a `viewBox="0 0 24 24"`, one or two `<path>`s, `stroke="currentColor"`, `fill="none"`), sized in `em` so they follow the text.
- Never an icon set, icon font or image from the network: the page loads nothing from the network.
- Give an icon-only button an `aria-label`; hide decorative icons with `aria-hidden="true"`.

## 9. How different: Subtle, Balanced, Radical

| Level | In practice |
| --- | --- |
| Subtle | Same structure in every variant; they differ in treatment (type scale, density, where the accent goes, corners, surface contrast) |
| Balanced (default) | Each variant makes one structural difference (a table vs a list of cards, a side panel vs a stacked page, filters on top vs at the side) |
| Radical | The variants disagree about structure: different primary layout, different idea of what comes first, different way through the task |

At every level, each variant still has its own plan, real content and all four states. Write the difference into each variant's `what` line in `round.json`.

## 10. Checklist per variant

Run this over each variant before writing the next one.

- [ ] Its own plan, reviewed against section 2, with nothing a similar page would have by default.
- [ ] It differs from the variants already written at the level asked for.
- [ ] Real names, numbers and dates; buttons say what happens; one name per action.
- [ ] Short, typical and long text marked with `data-p2c-text`, and the long one wraps cleanly.
- [ ] `ready`, `empty`, `loading` and `error` drawn and marked; the error says what to do.
- [ ] Visible focus; targets at least 24 by 24 px; text contrast at least 4.5:1 in light and dark.
- [ ] Sizes from `--p2c-text-size`, gaps from `--p2c-space-1..6`, corners from `--p2c-radius`, colors from the shared values.
- [ ] The accent spent in one place; tabular numerals in number columns; balanced headings.
- [ ] Icons drawn inline; no URL, script or `@import` anywhere.

Sources: Anthropic's frontend-design skill and frontend aesthetics cookbook, Vercel's Web Interface Guidelines, WCAG 2.2, Apple Human Interface Guidelines.
