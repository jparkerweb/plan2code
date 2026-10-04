# Autonomous Loop

`plan2code-loop` is a CLI that works through your spec's tasks on its own, one agent call at a
time. It is an **alternative to Step 3**, not a replacement — the four-step workflow and the specs it
produces are unchanged.

← [Back to README](../README.md)

---

## When to use it instead of Step 3

| Approach | Best for |
|----------|----------|
| `/plan2code-3-implement` | Interactive control, reviewing each phase, logic that needs your judgment |
| `/plan2code-3-implement-review` | The same interactive control, with a focused review and its fixes applied before you approve the phase |
| `plan2code-loop` | Straightforward implementations, batch work, overnight runs |

The loop reads the same `overview.md` and phase files. You can start with the loop and finish by
hand, or the reverse — the checkboxes are the only handoff.

---

## Install

```bash
# From the plan2code root directory
node install.js     # A  (everything + dev tools)  — or  C → O  (loop only)
```

## Run

```bash
plan2code-loop    # fully interactive
```

It will:

1. Find specs in `./specs/`
2. Let you pick one if there are several
3. Offer to resume an existing session
4. Ask for a JIRA ticket ID, which agent to drive, the loop mode, and a max iteration count

Then, per iteration: read `overview.md` and the phase files, find the first unchecked task (or
phase), implement it, mark the checkbox, repeat — until everything is done or it hits the iteration
cap.

---

## Loop modes

| Mode | Each agent call | Git commits | Best for |
|------|-----------------|-------------|----------|
| **One task per loop** (default) | Implements a single task | The Node controller commits after each task | Smaller models, cautious execution |
| **One phase per loop** | Implements every task in a phase | The agent commits after each task, with the JIRA ID | Larger context windows, tightly related tasks |

Session state lives per-spec in `specs/<feature>/.plan2code-loop/`, so each feature's progress
stays isolated.

---

## Full documentation

Architecture, completion markers, agent adapters, and configuration:
[`plan2code-loop/README.md`](../plan2code-loop/README.md)
