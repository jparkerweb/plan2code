# Plan2Code Web Console: design proposal

**Status:** implemented in v2.4.0. Kept as the design record, because it explains
*why* the thing is shaped the way it is. For how to use it, see
[web-console.md](./web-console.md); for where the code lives, see
[AGENTS-architecture.md](../.agents-docs/AGENTS-architecture.md).
**Date:** 2026-09-20
**Scope:** an optional local browser UI that `plan2code-0-pathfinder` and `plan2code-1-plan` can offer at startup, built as a shared component other workflow steps can adopt later.

---

## 1. Why this is smaller than it looks

Pathfinder is already written against a *delivery-channel abstraction*. Its rules say:

> AskUserQuestion when available; prose Q blocks only as fallback.

and `grilling.md` specifies the question object in full: a plain two-or-three-word header, the probe with its why-it-matters, two to four genuine options each described by its trade-off with exactly one named as the recommendation, plus an automatic `Other` escape hatch.

That is a form. The console is not a new workflow, it is a **third delivery channel** alongside the structured tool and prose. The methodology, the file formats, the gates and the rules are untouched.

Plan is the opposite: pure prose Q and A with seven phases and four named approval gates. But every one of its gates already resolves to a literal typed token (`approved`, `needs changes`, `approve / refine / abort`). That gives us the second half of the idea.

### The keystone: answers map back to the literal token

Every console request carries two extra fields:

| Field | Purpose |
| --- | --- |
| `fallbackText` | the exact terminal phrasing the prompt would have printed |
| `token` | what each button resolves to: `approved`, `H`, `A`, `S 1,3,5`, `yes`, `skip` |

Clicking **Approve** in the browser is then byte-identical to typing `approved` in the terminal. No prompt logic ever forks. If the console is absent, refused, or times out, the agent prints `fallbackText` and the session continues in the terminal with nothing lost. Mid-session switching in either direction is free, because the markdown files under `specs/` remain the only source of truth.

This one decision is what keeps the integration from metastasising across twelve prompt files.

---

## 2. Hard constraints found during research

These are verified, not assumed. They shape everything below.

### 2.1 The character limit is the binding constraint

`scripts/validate-char-count.js` caps every flat `src/plan2code-*.md` at 11,500 characters (11,000 when the numbers below were measured), enforced by a husky pre-commit hook. Measured today:

```
10995      5  plan2code-0-pathfinder.md   <- 5 characters of headroom
10676    324  plan2code-1-plan.md
10835    165  plan2code-2-document.md
```

Neither target prompt can absorb the integration inline. **Trimming pathfinder by roughly 250 characters is a prerequisite task, not a nice-to-have.** Reference files are exempt from the limit, so all of the console contract lives in one.

### 2.2 Packaging needs zero installer code changes

`computeExpectedSkills()` in `install.js` copies `additionalReferences` directories verbatim through `listFilesRecursive()`, which has no extension filter. The initial implementation fanned one shared source directory into two skills; the current installer fans it into every skill.

Current packaging constraints:

- Reference files are copied as `Buffer`s, so binary assets are supported; the shipped MP3 chimes exercise this path. Browser-served assets must also be added to the server's `SERVABLE` allow-list and covered by a test.
- `skills/` is generated build output (committed, and checked for drift by `npm test`) and `buildSkills()` prunes files it doesn't expect. Assets must originate in `src/` and never be hand-placed.

### 2.3 `specs/` is gitignored, which is an argument *for* the server

Three prompts repeat the warning that Glob silently fails on `specs/` and only a shell listing works. A Node server enumerating candidate spec directories server-side and handing the page a list is strictly better than either a terminal listing or a browser file input.

### 2.4 Formats that must round-trip byte for byte

- `<!-- METRICS_JSON {...} -->` comments
- the `## User Feedback` table (exact field names `Rating`, `Reason`, `Went Well`, `Went Poorly`, pipes escaped as `\|`)
- the five-state checkbox alphabet `[ ]` `[/]` `[x]` `[?]` `[!]`, with the invariant "never reset `[/]` to `[ ]`"
- the handoff string `**Status:** Phase 3 Complete - Resume at Phase 4`, plain ASCII hyphen, single spaces

The console carries all of these as opaque strings and never reformats them.

### 2.5 Two regex landmines

- `plan2code-metrics` scrapes confidence with patterns like `/[Rr]equirements?[:\s|]+(\d{1,2})/` that **do not require a percent sign**. Nothing the console writes under `specs/` may contain bare `Requirements` / `Feasibility` / `Integration` / `Risk` followed by a number.
- The loop parses `TASK_COMPLETE`, `PHASE_COMPLETE` and friends. Pathfinder already forbids these tokens under `specs/`.

Both are cheap to enforce mechanically in the server's write path.

---

## 3. Architecture

### 3.1 Placement

```
src/web-console/
  console.mjs             CLI: open | post | wait | status | stop
  server.mjs              the HTTP server (spawned detached by `open`)
  lib.mjs                 paths, atomic writes, patch merge, validate()
  console.md              the agent-facing contract
  public/index.html       markup shell only
  public/app.js           the client (no inline script, see CSP below)
  public/app.css
  public/render.js        markdown tokens to DOM nodes
  public/vendor/marked.esm.js   pinned 15.0.7, MIT, lexer only
```

Wired in with one data entry per consumer:

```js
{
  source: 'plan2code-0-pathfinder.md',
  // ...
  additionalReferences: [{ source: 'web-console', target: 'web-console' }]
}
```

Lands at `~/.agents/skills/<skill>/references/web-console/` on all ~28 target agents. The server finds its own siblings via `path.dirname(fileURLToPath(import.meta.url))`.

The agent needs an absolute path to invoke it. `ai-assist-git-pr` already establishes the convention, proven on Windows, and we reuse its wording:

> `<SKILL_ROOT>` = the directory containing this `SKILL.md` (its install location). Use the absolute path you loaded it from.

### 3.2 The transport, which is the genuinely hard part

A turn-based agent must wait up to twenty minutes for a human. Claude Code's Bash tool caps at 600s and **harness-managed background tasks are not a safe place to wait**: there are open issues documenting them being killed at 5 to 20 minutes, killed on compaction, killed when a new prompt arrives, and leaked with no handle when spawned by subagents. Detached processes are explicitly immune.

So: **split into two processes with deliberately different lifetimes.**

```
# once, at handoff
node <SKILL_ROOT>/references/web-console/console.mjs open --file request.json
  -> spawns server.mjs DETACHED, prints URL + session id, exits in under 300ms

# repeatedly, until done
node ... console.mjs wait --seconds 240
  exit 0  -> stdout is the result JSON. Done.
  exit 10 -> {"status":"waiting","elapsed":"6m12s","answered":3,"total":7,...}
             Agent relays one line to the user and calls wait again.
  exit 20 -> server is dead. Agent restarts it, re-reports the URL.
  exit 30 -> human hit Cancel.
```

Why bounded rather than a single long block:

- The deadline lives in our code, not the harness's. `--seconds 240` covers a 20-minute session in five turns. Drop to `--seconds 90` for harnesses with a 120s default (Cursor auto-backgrounds and cannot be told not to).
- Every return is a free heartbeat: "still waiting, 3 of 7 answered, 6 minutes in" beats silence.
- Interruption is survivable. Ctrl-C the agent, compact the context, restart: the next `wait` re-attaches, because state is on disk.

The waiter uses `fs.watch` on the session **directory** (watching a file breaks on Windows when the file is replaced by rename) with a 500ms `stat` fallback as the authority, and pings `/health` every 5s for liveness. The result is delivered **through the filesystem**, not HTTP, which decouples the waiter from the server and is also the resumability story.

**Optional push accelerator, Claude Code only:** at `start`, also fire a backgrounded `until [ -f <dir>/result.json ]; do sleep 2; done`. If it survives, submit-to-agent latency drops to near zero. If it gets killed, nothing breaks, because the poll loop is the source of truth.

### 3.3 Port, lifecycle, security

| Concern | Decision |
| --- | --- |
| Port | `listen(0, '127.0.0.1')`, handle file in `os.tmpdir()/<tool>/<sha1(cwd).slice(0,8)>/`. This is Jupyter's `jpserver-<pid>.json` pattern and RFC 8252 §7.3. A fixed port is fatal here: you run git worktrees, so two agents in two checkouts of one repo is routine, and a fixed port makes that silently wrong. |
| Bind | the literal `127.0.0.1`, never `0.0.0.0`, never the string `localhost` (which may resolve to `::1` and produce the classic "server is up but the browser gets ECONNREFUSED" bug on Windows). |
| Auto-open | best-effort, never fatal. Skip when `DISPLAY` and `WAYLAND_DISPLAY` are both unset, or `SSH_CONNECTION` / `REMOTE_CONTAINERS` is set. Honour `BROWSER=` and `--no-open`. |
| Orphan prevention | a **server-side idle deadline** (30 min, bumped by any authenticated request) is the mechanism, not a nicety. Windows has no real SIGTERM, and a detached server with no console never sees `SIGINT`, so signal handlers cannot be relied on. Plus a 4h absolute cap, a `pagehide` beacon, an explicit `stop`, and a reap sweep on every `start`. |
| Liveness test | `process.kill(pid, 0)` **and** a `/health` check whose returned session id matches the handle. PID reuse is real; the sid match is what disambiguates. |

Security, six controls, about 60 lines:

1. Bind `127.0.0.1`.
2. **`Host` header allowlist.** This is the DNS-rebinding defence and the highest-value line in the server. Vite shipped GHSA-vg6x-rcgg-rjx6 for exactly this omission.
3. 128-bit token **in the URL path**, not the query string. Path placement also kills the Windows `cmd /c start` `&`-injection hazard, because the URL then contains no `&`.
4. First `GET /s/<token>/` sets `HttpOnly; SameSite=Strict` cookie and 302s to `/`. Token leaves the address bar, history and pasted screenshots; CSRF protection comes free.
5. `Origin` check on every mutating request.
6. Strict CSP with no `unsafe-inline`, which is why JS and CSS are separate files rather than one inlined HTML.

**On whether XSS matters here.** The tempting argument is "it is the user's own machine and the model would not write `<script>`". That misses the real risk. The page is same-origin with a server that reads and writes the user's files and holds the session token, so script in that page can post arbitrary answers back to the agent, which then acts on them with the agent's full tool permissions. And the markdown is only nominally agent-authored: in practice the agent is summarising a dependency README, a scraped page, a PR description, a log. Treat it as attacker-controlled.

The structural fix, rather than a filter: **vendor `marked` for `lexer()` only and render tokens to the DOM with `createElement` and `textContent`.** No HTML string is ever produced, so there is nothing for a sanitiser bypass to bypass, and the strict CSP holds. Roughly 120 lines of renderer. Hand-rolling the parser instead is a trap: hand-rolled markdown fails exactly where agent-authored technical documents live (a table inside a list item, a fenced block containing backticks) and its failure mode is usually an injection hole.

### 3.4 Browser transport

SSE primary (about fifteen lines on Node's built-in `http`), with automatic fallback to 3s interval polling after three consecutive errors. **Exactly one `EventSource` per page, ever**: browsers cap HTTP/1.1 at ~6 connections per origin, and a second stream per tab across three tabs wedges the origin with no error and no timeout. Multiplex everything through one stream with a `type` field.

The page shows the **agent's** liveness, not the server's. If the agent's turn crashed, the server is still happily up and a naive spinner lies forever. Stamp `agentLastSeen` on every waiter ping; when stale past two minutes the page says so plainly: "The agent has not checked in for 4 minutes. Your answers are saved. Check your terminal."

### 3.5 State on disk

The filesystem is the database and the result transport.

```
~/.plan2code/console/sessions/<sid>/
  session.json        sid, cwd, workflow, title, phase
  request-<rev>.json  the agent's payload, immutable per revision
  draft.json          in-progress answers, debounced ~500ms write
  result.json         written ATOMICALLY on submit (temp + fsync + rename)
  events.ndjson       append-only, doubles as SSE Last-Event-ID replay
```

Deliberately **not** under `specs/`: that keeps the console clear of the metrics scraper and the loop's marker parser, and survives a `git clean`.

Draft persistence is the highest-value feature in the tool and among the cheapest. Twenty minutes of a product manager's structured answers must never be lost to a closed tab. Server-side debounced write plus a `localStorage` mirror keyed by `sid + rev`.

Recovery matrix:

| Failure | Recovery |
| --- | --- |
| Tab closed or browser crashed | Reopen the URL, draft restored, agent never notices |
| Server died, agent alive | `wait` returns exit 20, agent runs `start --resume <sid>`, new port, same session dir |
| **Agent session died, human still working** | Human submits, `result.json` lands on disk. A fresh session runs `status`, finds the unconsumed result, picks up where it left off |
| Machine rebooted | Handle file is gone (correct), session dir survives, `--resume` works |

---

## 4. The interaction contract

### 4.1 Item envelope

```jsonc
{
  "id": "i7", "topic": "t2", "kind": "choice",
  "title": "Export format",              // PLAIN 2-4 words, never internal jargon
  "body": "markdown: the probe plus its why-it-matters",
  "options": [ { "k": "A", "text": "CSV", "detail": "trade-off", "recommended": true } ],
  "allowOther": true,
  "required": true,
  "status": "open",
  "answer": null,
  "thread": [],
  "fallbackText": "the exact terminal phrasing",
  "token": { "A": "a", "B": "b" }        // maps a click back to the literal reply
}
```

Note `recommended` is **optional per option**. Handoff explicitly wants its inferred task offered as the recommendation; the `.gitignore` question in handoff explicitly does not ("present it, don't force it").

### 4.2 Primitives

Tier 1, needed for pathfinder and plan, build now:

| Kind | Covers |
| --- | --- |
| `choice` | Step 0 intent gate, all six destination probes, the 14 frontier axes, plan's coverage and scope questions |
| `multi` | plan's testing types (Unit / Integration / E2E / None) |
| `text` | sacrificial boundary, the embarrassment question, kebab-case feature name **with live pattern validation the terminal cannot do** |
| `confirm` | the Tier-2 sketch gate, the lock offer, abort confirmations |
| `recap` | the recap-and-confirm turn. Non-skippable by design |
| `review` | plan's four approval gates, `1b`'s spec-update gate, paper-sketch reactions |
| `checklist` | `legwork · HITL`: numbered steps plus Done / Blocked / Need help / Defer plus a values field |
| `menu` | the fork menu: up to three takeable questions plus Start fresh, one recommended, with the resume command as copy-to-clipboard |
| `list` | orderable and editable rows, for plan Phase 6's implementation phases |

Tier 2, design the schema to admit them but do not build yet: `findings-triage`, `table-review`, `form`, `path-picker`, `command-handoff`, `notice`, `progress`.

### 4.3 Rules the server enforces mechanically

Several prose rules become checks, which is the quiet advantage of routing through a server at all:

- **Reject a patch leaving more than three open required items.** Grilling says "the cap is three regardless of what the environment allows. The ceiling is the human's attention, not the tool's schema." A web UI tempts you to show ten. Make the rule mechanical.
- **Reject internal jargon in `title`**: `grill`, `frontier`, `fog`, `HITL`, `Locked:`, `Blocked by:`. There is an explicit do-not-say list in `grilling.md`; this is where to enforce it.
- **One authoritative gate per session.** `plan2code-3-implement-review` proves several prompts each carry an approval gate while only one may fire when composed. A `gate: { id, authoritative }` field plus a server guard.
- **Defer is a third verb**, distinct from reject.
- Reject forbidden tokens and bare confidence-word-plus-number patterns in anything written under `specs/`.
- Stamp every timestamp server-side. Models do not reliably know the time.

---

## 5. The UI

Three panes, plus view tabs, closer to pathfinder's own vocabulary than to a grilling UI.

```
┌──────────────────────────────────────────────────────────────────────┐
│ 🧭 audit-export · Pathfinder · Working     4 of 9 cleared  ▓▓▓▓░░░░░  │
│ ● Waiting on you · 3 questions          [Questions] [Map] [Draft]     │
├───────────────┬──────────────────────────────┬───────────────────────┤
│ THE MAP       │  What you end up with        │  DISCUSSION           │
│               │                              │                       │
│ ✓ Destination │  Why this matters: ...       │  thread on this item  │
│ ✓ Codebase    │                              │                       │
│ ● Export fmt  │  ○ A  CSV, ...               │                       │
│ ○ Size cap    │  ◉ B  Parquet  RECOMMENDED   │                       │
│ ⊘ Retention   │  ○ C  Both, ...              │                       │
│               │  ○ Something else ______     │                       │
│ NOT YET CLEAR │                              │                       │
│  · fog item   │  Not sure, skip for now      │                       │
├───────────────┴──────────────────────────────┴───────────────────────┤
│ 2 staged · Export format → B · +1 comment       ⌘↩  [Send to Agent]  │
└──────────────────────────────────────────────────────────────────────┘
```

### What to take from grill-with-ui

- **Batch staging with one explicit Send.** Everything is local and reversible until one deliberate press. For a non-technical user this removes the terror of "did I just commit to that?"
- **The three-tier commitment vocabulary**: staged (amber, removable) → sent and pending (dashed, spinner) → recorded (green check). Honoured consistently on every surface.
- **The whole stuck-agent apparatus**: live elapsed counter, disabled Send while working, a five-minute grace that re-enables Send with an explanation, server-gone detection with self-reconnect. About 40 lines, and more honest about agent latency than most commercial agent UIs.
- **Assumed regions.** The best idea in that repo: the generated artifact marks regions that depend on still-open questions with a dashed outline and "assumed, pending Q3". This transplants directly onto a plan taking shape.
- **Versioned artifacts with a staleness flag** and a one-line change note.
- `withInputs()` focus preservation, raw-string diffing before re-render, and the `prefers-reduced-motion` handling that keeps progress indicators legible rather than freezing them.

### What to change

- **Topics, not rounds.** Grill groups the nav by round, which is a temporal artifact: "questions the agent happened to ask on turn 4". Its own sample data has one round containing three unrelated subjects. Product people cannot use that. Group by topic, stable and nameable.
- **Show real progress.** Grill has no "N of M" counter at all. Pathfinder's trail footer already computes `4/9 cleared` and a plain-English confidence line. Put both in the header. In a 45-minute session with a PM, "how much longer is this" is the first question asked.
- **Recommendations become optional.** Grill always leads with one, which is right when the agent has an opinion and you are pushing on it. In discovery the agent frequently should not have an opinion, and pre-filling one anchors a PM into rubber-stamping. Neutral mode: no `rec`, or reframed as "what similar products do".
- **Real, accessible form controls.** Grill's options are `<li>` with `onclick`, so they are unreachable by keyboard and invisible to screen readers. Non-negotiable to fix if non-technical stakeholders are in scope.
- **Markdown actually renders.** Grill escapes everything and sets `white-space: pre-line`; there is no markdown at all. A plan document cannot be shown that way.
- **Rename everything.** "Grill", "durable", "Defer", "Reopen", "Why A." is a vocabulary for interrogating an engineer who already has a plan.
- **Do not dim rejected options to 45%.** In discovery the rejected options are often the most valuable thing in the room, and an engineer joining late needs to see why B lost.

### Two things the console unlocks that the terminal cannot

- **Tier-2 UI sketches.** `resolve.md` already sanctions building 3 to 5 structurally different UI variants switched by "a URL search param plus a small floating bar". The console can host them in a sandboxed iframe with a proper variant switcher. This is already in the methodology and currently awkward.
- **Anchored reactions.** `resolve.md` insists every sketch probe "names its row or element". With `anchors: { "row5": "b3" }`, clicking the probe highlights the row. That is the inline-commenting capability, scoped to something the methodology already demands.

### Room-screen polish (v2.4.0)

Built for a mixed product and engineering room reading one screen together.

- **One width variable.** `--card-width` on `:root` in `app.css` sets the column the card, the pager and the document tabs share (`max-width: min(var(--card-width), 100%)`, so a narrow window still wins); no fixed `720px` column rule is left outside a media query. Three presets, picked under *Card width* in the looks panel and saved as `looks.width`: `narrow` 720px, `comfortable` 880px (the default, and the variable's own value), `wide` 1080px, applied as `:root[data-width="…"]`. `CARD_WIDTHS` in `palette.js` is the same list for the page's validation and the server's first-paint `data-width`; **`palette.js` and `app.css` must agree**, which is the one place the number is written twice. The dashboard keeps its own 860px layout. Inside the card the `62ch` / `68ch` measure caps come off (`.card .md, .card .prompt { max-width: none; }`) so a wider card is not a narrow column in a wide frame; documents keep `.md`'s 68ch.
- **One box grows.** On the primary card, the answer box that is being typed in — a `text` question's box, a choice's *Something else* box once picked, or the note under a verdict / confirm / recap once shown — is `textarea.grow`, and the card takes the column's full height above the pager (`.card.is-primary.has-grow { flex: 1 1 auto; }`). `fitGrowBox()` in `app.js` writes the card's free height as the box's `min-height`, **never under 160px**; a `ResizeObserver` watches the main column rather than the box, so the box growing can never retrigger it, and it writes only on a change over 1px. `resize: vertical` with that moving floor makes the handle taller-only; past the fill the card scrolls. Every other box keeps its ordinary size, and the notes panel is untouched.
- **A switch per sound.** Every cue is an event in `SOUND_EVENTS` (`palette.js`), each naming its file and rank: `startSkill` (`start-skill.mp3`, played once the dashboard's **Start** is accepted) 5, `bootup` 4, `sessionStart` / `sessionEnd` (`start-stop.mp3`) 3, `question` / `skillReady` / `chatReply` (`next.mp3`) 2, `newTab` (`insert.mp3`) 1, `snore` (`sleeping.mp3`, looped by the wake-up outside the queue) 0. The queue, the held slot and the one-at-a-time rule in `app.js` work on events, one `Audio` per file shared by the events that use it. User Preferences shows a *Play sounds* master (`looks.sound`) over one box per event, saved flat as `sound<Event>` (`soundStartSkill`, …) because `looks.json` only holds flat values; `soundPrefs()` turns any missing or non-boolean switch on, so a file from before the switches keeps every sound. A cue plays only while the master and its own switch are both on; the master off greys the boxes but keeps their ticks, and ticking a box plays it.
- **Send breathes.** `#btn-send:not(:disabled)` runs `send-pulse`, a soft accent ring that spreads and fades every 2.4s; a disabled Send is still, and reduced motion switches it off.
- **Per-tab scroll memory.** An in-memory `Map` keyed by view id holds the scroller's position (the main column on a document or the Overview, the card on the questions view, with the item it belonged to), restored when the tab comes back. Page-local, never persisted, cleared when the session turns into or out of the dashboard.
- **The Overview tab.** Appears only while `GET /overview` returns a file for the session's spec (on the dashboard: the picker's spec; gone for *start from scratch*), fetched with `no-store` on load, on a spec change and on every tab click, so it always shows the file as it is on disk. Rendered through the same DOM-only markdown path as every doc, captioned read-only. It never becomes a doc: the page is not the record.
- **The footer slot.** The workspace label sits centred in the footer's middle track, 12px and muted: `footerLabel()` in `public/workspace.js` builds `folder · branch` (from the workspace's original folder and `state.branch`), or `folder + N folders · branch` once folders are added, and `renderWhere()` steps down through its narrower tiers (`FOOTER_TIERS`) until the text fits. A warning dot marks a missing or unreadable folder. A click opens the Workspace dialog (`#workspace-modal`), where each folder has its own **Copy path**. The notification pill is fixed over the same spot and covers it while it shows, on purpose: nothing there needs pressing while the pill is up. The dashboard keeps the footer for this label alone: `renderFooter()` puts `is-dash` on it, which hides the summary and Send (and on a narrow screen keeps the label, the one thing left in the bar); the footer only disappears there when there is no label to show.
- **The wake-up.** A fresh dashboard (`state.wake`, plus a per-sid `sessionStorage` guard) plays Planny powering on centre stage, as proven in `pathfinder/sketch-01`. The wake layer hides the dashboard behind a solid `var(--bg)` backdrop (`.wake::before`, so it follows the theme) whose opacity fades out over the same 0.6s as the glide, revealing the menu as he lands; the notification pill (`.banner`, z-index 46) stays above the layer (45). Before the first click or key he sleeps there on loop under a "Click to wake Planny" hint (`.wake.dormant`): Z's rising, slow breathing, slack arms swaying out of step, his feet pulsing like a standby light. While he sleeps the page tries to loop `sleeping.mp3` (browsers usually refuse until the first click, so this is normally silent). That click fades the hint and nudges him (`.wake.stirring`): he rocks gently about his feet (`wake-nudge`) while exactly one snore plays from the top, via the `stir()` callback `playWake()` awaits — timed by the snore's `ended`, capped at 6s, or a 2.6s timer when sounds are off or refused. Then the boot starts to `bootup.mp3` (in place of the opening chime; outranked only by the Start-skill cue, which cannot coincide with it because the wake layer swallows every click and key until the run ends), which fades out over 0.5s the moment the run ends or is aborted. The boot pops the Z's outward: 0.4s power-on and his feet blink · 1.35s feet plant · 1.5s / 1.9s arms lift off his sides · 2.5s the star opens lit, with a scan · 2.85s he glances left, right, then ahead · 3.2s smile · 3.6s hop and a cheer, star back to ink · 4.3s a 0.6s glide into the rail, measured once by `boot.js` and handed to CSS as `--wake-glide` · the menu groups rise in 60ms apart as he lands, and the note types in. Done by 5s (a fallback timer covers a hidden tab whose transition never fires). The beats are CSS keyframes on delays under `.wake.booting`, all inside `@media (prefers-reduced-motion: no-preference)`; there is no skip: from the waking click on, clicks and plain keys (no Ctrl/Meta/Alt) are swallowed so the nudge, boot and sound always play out; only a launch mid-run aborts it (snore stopped, boot-up faded), and under reduced motion `playWake()` resolves at once and the awake dashboard is simply there.

---

## 6. The startup question

Both prompts open with one ask. Pathfinder already uses `AskUserQuestion`, so this costs almost nothing:

> Run this session in the **web console** (a local page in your browser, better for walking through decisions with someone) or **here in the terminal**?

Recommended default is an open decision (see §8). Because the markdown files stay the source of truth, the user can switch either way mid-session at no cost, and the prompt should say so.

---

## 7. Work plan

| # | Task | Notes |
| --- | --- | --- |
| 0 | **Trim `plan2code-0-pathfinder.md` by ~250 characters** | Hard prerequisite. 5 characters of headroom today. Candidates: the `grilling.md` fallback blockquote, the Rules list. |
| 1 | `src/web-console/` skeleton: `console.mjs` start/wait/status/stop, detached spawn, handle file, reap sweep | The transport is the risky part, build and prove it first |
| 2 | `server.mjs`: the six security controls, SSE, atomic result write with Windows `EPERM` retry | |
| 3 | `index.html` + `app.js` + `app.css` + vendored `marked` lexer, token-to-DOM renderer | |
| 4 | Tier 1 primitives, staging, drafts, Send | |
| 5 | `console.md`: the agent contract | The only file the prompts point at |
| 6 | `SOURCE_PROMPTS` entries + `npm run build:skills` + commit `skills/` | Zero installer code changes |
| 7 | Pathfinder integration: startup ask, channel rule, `Read` line | ~250 chars, funded by task 0 |
| 8 | Plan integration | 324 chars headroom, fits, trim ~150 for margin |
| 9 | CHANGELOG + `version.json` + `package.json` in lockstep | `plan2code-publish` refuses to release on mismatch |

### Three things most likely to bite during implementation

1. **Forgetting `windowsHide: true` on the detached spawn.** It defaults to `false`, and `detached` on Windows forces a console window that "once enabled, cannot be disabled". Every handoff flashes a black box at the user.
2. **`fs.rename` `EPERM` from antivirus and search indexers on Windows.** Intermittent, unreproducible on demand, looks exactly like a logic bug. Retry three times with backoff from day one.
3. **Relying on `SIGTERM` for cleanup on Windows.** It does not arrive. Build the idle deadline first, not last, and comment why.

### Non-obvious portability notes

- grill-with-ui's heredoc idiom (`patch <<'EOF'`) is **not portable to PowerShell**, which is the default shell for Claude Code on Windows. Use a `--file <path>` form as the primary documented interface.
- `nohup ... &` is bash-only. Backgrounding happens inside `console.mjs start`, never in the shell command the agent writes.
- Always emit `node "<abs>/console.mjs"` quoted. Install paths contain spaces.

---

## 8. Open decisions

1. **Default channel.** Terminal (lower ceremony for an engineer working solo) or console (better for the cross-functional sessions that motivated this)? Recommendation: console marked as recommended in the ask, terminal as the low-ceremony alternative.
2. **Vendoring `marked`.** It is MIT and dependency-free, but it is the first vendored third-party code in the repo, against a house style of "Node built-ins only". The alternative, a hand-rolled parser, is materially worse on both correctness and security. Recommendation: vendor it, pin the version, record the SHA-256.
3. **Single-driver or multi-user.** Everything above assumes one browser, one driver, no identity or attribution. A facilitated workshop with one person at the keyboard works fine. Two people answering independently is a different product and reaches into the state model. Recommendation: single-driver for v1, say so explicitly.
4. **Third consumer.** After pathfinder and plan, `/plan2code-review` is the strongest case: two of its rules exist only because output goes to a terminal ("for 15+ findings, present top 10", "output tables as direct markdown, NOT inside code blocks") and a browser deletes both. Its `S 1,3,5` fix selection is literally a checkbox list compressed into a CLI token, and one findings UI serves both `/plan2code-review` and `/plan2code-3-implement-review`.

---

## 9. Honest assessment of size

This is not a weekend. Rough shape: `console.mjs` plus `server.mjs` around 700 to 900 lines, the client around 900 to 1,200, the contract file 300 to 400 lines of prose, plus the prompt trims and build wiring. The transport and lifecycle work (tasks 1 and 2) is where the risk concentrates, and it is worth proving end to end on one primitive before building the other eight.

A smaller first cut that still tests the whole idea: pathfinder only, `choice` and `text` and `recap` only, no artifact pane. That exercises the transport, the token mapping, the fallback path and the three-probe cap, which are the parts most likely to be wrong.

---

## Credits

The architecture owes a large debt to `grill-with-ui`, whose file-ownership model, staged-then-send interaction, commitment tiers and assumed-region idea are all borrowed here. The implementation is independent.
