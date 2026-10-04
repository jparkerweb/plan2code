# Workflow Test Bot

`plan2code-bot` drives the whole workflow end to end with no human in the loop — init, plan,
document, implement, finalize — to test that the prompts still hold together.

Built for **maintainers**. If you're using Plan2Code to ship features, you don't need this.

← [Back to README](../README.md)

---

## Two modes, auto-detected

| Condition | Mode | What it does |
|-----------|------|--------------|
| No `AGENTS.md` in the working directory | **New project** | Invents an app idea, creates a subdirectory, writes `IDEA.md`, runs init, then all four steps |
| `AGENTS.md` present | **Enhancement** | Reads the existing codebase, proposes a realistic enhancement, writes `IDEA.md`, then runs plan → finalize |

## Install

```bash
node install.js     # A  (everything + dev tools)  — or  C → B  (bot only)
```

## Run

```bash
# New project mode — start from an empty directory
mkdir /tmp/test-bot && cd /tmp/test-bot
plan2code-bot

# Enhancement mode — start from a project that has an AGENTS.md
cd my-project
plan2code-bot

# Or seed the idea generator yourself
plan2code-bot --idea "web app that renders the current weather as vector images"
```

---

## Full documentation

Agent SDK wiring, run evaluation, and scoring:
[`plan2code-bot/README.md`](../plan2code-bot/README.md) ·
[`plan2code-bot/EVALUATION-SYSTEM.md`](../plan2code-bot/EVALUATION-SYSTEM.md)
