# Helper Strength
> Shared by the skills that start helpers (subagents): Pathfinder, Quick Task, Implement, Implement + Review and Review. Read it when you first start a helper in a session. Never invoked as a skill.

## The words

- **Strength:** `light`, `standard`, `strongest` or `inherit`.
  - `light`: your tool's fastest, cheapest model class.
  - `strongest`: its most capable model class.
  - `standard`: the one between them, often your tool's default.
  - `inherit`: the helper runs with the session's own model.
- **Effort:** `low`, `medium` or `high`, where your tool lets you set how hard a model thinks.

Never write a model or vendor name in a brief, a report or a file, and never invent a model id: map the word to whatever your tool offers.

## Picking a strength

| Helper's job | Strength | Effort |
|---|---|---|
| Lookups, reading code, checking docs, recon | light | low |
| Build task in 1 or 2 files, with the change spelled out in the task | light | medium |
| Build task across several files, integration work, debugging | standard | medium |
| Build task needing a design decision the spec leaves open | strongest (or keep it yourself) | high |
| Pathfinder research question, sketch | standard | medium |
| Review analysis, focused scope | standard | high |
| Review analysis, branch or full scope, or touching security, auth or data | strongest | high |

Decide from these signals: how many files the job touches, whether the task spells out the change, whether a design decision is still open, and the review's scope and risk. Never decide from how hard the task feels.

## Floor and escalation

- A review helper never runs below `standard`.
- A retry, after a helper fails or after its work fails the phase's tests, goes one strength up and at least `medium` effort. Never retry at the same strength.
- When a `strongest` helper fails, its task comes back to you.

## Setting it

In this order:

1. Your tool accepts a model or effort setting when it starts a helper: set the closest match.
2. It lets you choose a helper profile or agent type instead: pick the one that matches.
3. Neither: start the helper without one, and it inherits.

Set it explicitly wherever you can. A helper left unset usually inherits the session's most capable and most expensive model.

## The person's choice (web console)

On the web console the person picks a profile in the Subagents dialog. A `Helper strength:` line in a `Subagents:` block replaces the Balanced default:

| Choice | Effect |
|---|---|
| Balanced (default) | The table as written |
| Thrifty | One step lighter in strength and effort; reviews never below standard |
| Best | Strongest and high effort for everything except lookups, which stay light |
| Match my session | No model or effort set on any helper, whatever the skill files say |

## Reporting

On the web console, report each helper's `strength` and `effort` as it actually ran (`console-subagents.md`, Reporting helpers). Report `inherit` when you could not set it. When `console-subagents.md` does not list those two fields yet, your console is older than this file: leave them out, since it ignores them.
