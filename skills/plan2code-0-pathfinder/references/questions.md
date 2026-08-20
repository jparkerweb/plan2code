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
│   └── sketch-NN/                  <- optional runnable sketch, throwaway
└── PLAN-DRAFT-<YYYYMMDD>.md        <- written ONLY when the map clears
```

`questions/` is ground truth; `map.md` is a rebuildable index that gists and links. A filled `## Answer` beats any `State:` line. Detail lives in exactly one place — the question file.

## Numbering

`NN` is zero-padded from `00`, assigned in dependency order (blockers lower), **never reused or renumbered** — links and `Blocked by:` would rot silently. Next = max + 1. `00` is always `00-codebase-context.md`, never anything else. Gaps in the sequence are normal and harmless.

## The five schema lines

Each question file carries five contiguous `Key: value` lines after its H1 — NOT YAML frontmatter, no `---` delimiters:

| Line | Values |
|---|---|
| `Type:` | `grill · HITL` \| `research · AFK` \| `sketch · HITL` \| `legwork · HITL` \| `legwork · AFK` — one token, so type and mode cannot drift |
| `State:` | `open` \| `claimed` \| `resolved` \| `out-of-scope` |
| `Blocked by:` | `none` \| `02, 04` |
| `Claimed:` | `none` \| `<YYYY-MM-DD HH:mm>` |
| `Locked:` | `yes` only when hard to reverse AND surprising without context AND a real trade-off |

**Type meanings.** **grill** (default) — a decision only the human can make. **research** — a fact outside this directory gates it. **sketch** — the human needs something concrete to react to. **legwork** — manual work that must happen before a decision is possible.

## Markers and blocking

**Map markers**, rebuilt from the files every session: `[ ]` open — **these rows ARE the frontier** · `[/]` claimed · `[x]` resolved · `[!]` open but blocked · `[-]` out of scope.

**Unblocked** ⟺ every `NN` in `Blocked by:` is `resolved`. **Stranded:** a blocker gone `out-of-scope` never resolves — the question is not merely blocked. Re-frame its `## Question` to drop the dependency, or rule it out too. Never leave it sitting.
