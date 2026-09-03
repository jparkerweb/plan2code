# Questions & Map Format
> Part of plan2code-0-pathfinder — the on-disk format both modes share: directory layout, `NN` numbering, the question-file schema, `Type:` vocabulary, and the marker / blocking rules. The main file keeps only the marker legend and a layout gist; the authority is here.
>
> **This file describes the `local` backend only.** If `## Ground rules` says `**Backend:** github`, the equivalence table in `github-issues.md` replaces every rule below — there are no files, no `NN`, no schema lines, and no checklist.

## Layout

```
specs/<idea>/
├── pathfinder/
│   ├── map.md                      <- the index
│   ├── questions/NN-<slug>.md      <- 00-codebase-context.md always exists
│   ├── briefs/brief-<YYYYMMDD>.md  <- plain-English reports, written by BRIEF mode only
│   └── sketch-NN/                  <- optional runnable sketch, throwaway
└── PLAN-DRAFT-<YYYYMMDD>.md        <- written ONLY when the map clears
```

`questions/` is ground truth; `map.md` is a rebuildable index that gists and links. A filled `## Answer` beats any `State:` line. Detail lives in exactly one place — the question file.

## Numbering

`NN` is zero-padded from `00`, assigned in dependency order (blockers lower), **never reused or renumbered** — links and `Blocked by:` would rot silently. Next = max + 1. `00` is always `00-codebase-context.md`, never anything else. Gaps in the sequence are normal and harmless.

## The six schema lines

Each question file carries six contiguous `Key: value` lines after its H1 — NOT YAML frontmatter, no `---` delimiters:

| Line | Values |
|---|---|
| `Type:` | `grill · HITL` \| `research · AFK` \| `sketch · HITL` \| `legwork · HITL` \| `legwork · AFK` — one token, so type and mode cannot drift |
| `State:` | `open` \| `claimed` \| `resolved` \| `out-of-scope` |
| `Blocked by:` | `none` \| `02, 04` |
| `Claimed:` | `none` \| `<YYYY-MM-DD HH:mm>` — a work-in-progress lock, not a completion record |
| `Resolved:` | `none` \| `<YYYY-MM-DD>` — set in the same write as `State: resolved` (Work Step 7). The date the decision landed; briefs filter on it |
| `Locked:` | `yes` only when hard to reverse AND surprising without context AND a real trade-off |

**Backfill (older maps):** a file with a filled `## Answer` but `Resolved: none` (or no `Resolved:` line at all) gets the line backfilled at reconcile — from the `Claimed:` date, or today if `Claimed: none`. Say so once in the session report.

**Type meanings.** **grill** (default) — a decision only the human can make. **research** — a fact outside this directory gates it. **sketch** — the human needs something concrete to react to. **legwork** — manual work that must happen before a decision is possible.

## Markers and blocking

**Map markers**, rebuilt from the files every session: `[ ]` open — **these rows ARE the frontier** · `[/]` claimed · `[x]` resolved · `[!]` open but blocked · `[-]` out of scope. Resolved rows carry the gist plus the `Resolved:` date in italics: `— <gist> *(YYYY-MM-DD)*`.

**Unblocked** ⟺ every `NN` in `Blocked by:` is `resolved`. **Stranded:** a blocker gone `out-of-scope` never resolves — the question is not merely blocked. Re-frame its `## Question` to drop the dependency, or rule it out too. Never leave it sitting.
