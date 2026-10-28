# Quick Task on the Web Console

Workflow notes for `quick-task`, part of the web console contract
(`console.md`). Read `building.md` first.

## Quick task (`quick-task`)

- Open with the first clarifying question. Clarifying questions go out as
  `text` or `choice`, at most three at a time. The first, asking what to build,
  carries `"templates": "idea"` and `"fill": "note"` (`console.md` → The kinds): the page fills that box from a Notebook tab when the person started with one.
- Post `"stopWarning": "A quick task saves nothing until it is built, so stopping now loses what we have worked out."`
  at the start, and `"stopWarning": ""` once the build is under way.
- **Scope check:** a `choice`, "Too big for a quick task?", options
  `1` Continue (lightweight format) and `2` Escalate to a full plan, with the
  measured counts against the thresholds in `body`.
- **Feature name** (escalating): `text` with
  `"pattern": "^[a-z0-9]+(-[a-z0-9]+)*$"` and a kebab-case placeholder.
- **The plan:** a `plan` doc titled "Plan", one block per section, with the
  Steps written as a checklist so the build can tick them in place, and a
  `review` item "Build this plan?" (`"doc": "plan"`) with verdicts `yes`
  ("Build it"), `modify` ("Change the plan"), `escalate` ("Plan it properly
  instead") and `abort` ("Stop here", `"danger": true`):

  ```jsonc
  { "id": "plan", "title": "Plan", "blocks": [
    { "id": "summary", "state": "settled", "md": "## Summary\n\n..." },
    { "id": "files", "state": "settled", "md": "## Files to change\n\n- `src/a.ts` - ..." },
    { "id": "steps", "state": "settled", "md": "## Steps\n\n- [ ] **1.** Step one\n- [ ] **2.** Step two\n- [ ] **3.** Step three\n- [ ] **4.** Step four" },
    { "id": "verify", "state": "settled", "md": "## Verify\n\n- [ ] ..." }
  ]}
  ```

  A `modify` reposts the changed blocks, Steps still a checklist; the version
  moves up by itself.
- **Building** after `yes`: the Plan tab is the build's live task list, the
  way an Implement phase has its tasks tab. There is no separate progress tab.
  Settle the verdict (`"settle": true`) in the post that starts the build; the
  plan's steps are the tasks and `total` is their number:

  ```jsonc
  {
    "stopWarning": "",
    "settle": true,
    "headline": { "stage": "Building", "cleared": 0, "total": 4 },
    "agent": { "status": "working", "activity": "Task 1 of 4: step one", "quietMinutes": 10 }
  }
  ```

  Then post after every step, as `building.md` → While you build says, in the
  same breath as finishing it: repost the plan's `steps` block alone (blocks
  merge by id, so Summary, Files and Verify stay as they are) with that step
  ticked; raise `headline.cleared`; set `agent.activity` to the next step
  ("Task 2 of 4: step two"). The plan lives only on the page, so this block is
  `md`, not `file`:

  ```jsonc
  {
    "headline": { "cleared": 1 },
    "docs": [{ "id": "plan", "blocks": [
      { "id": "steps", "state": "settled", "md": "## Steps\n\n- [x] **1.** Step one\n- [ ] **2.** Step two\n- [ ] **3.** Step three\n- [ ] **4.** Step four" }
    ]}],
    "agent": { "activity": "Task 2 of 4: step two" }
  }
  ```

  A step that cannot be done is `- [!]` with the reason after it, and is not
  counted in `cleared`. A step added mid-build goes into the list and raises
  `headline.total` in the same post. Tick each step the moment it is done,
  never in a batch at the end: the person is watching the Plan tab fill in.
  Check for a Quick question between steps, and do not call `wait` until the
  build is done. Tick the Verify block's boxes too as the checks pass, in the
  post that reports them.
- **See it running, before the finish:** a finished screen freezes every open
  card, so ask first. Once the build is done, post a `review` item "See it
  running" (`"doc": "plan"`, verdicts `show` ("Show me it working") and `fine`
  ("No need, finish up"), token `show me` / `no`) with `--wait`. On `show`, run
  it as `notes/implement.md` → Show me it working says, its one line going into
  the work summary (the finish's `body`); then, or on `fine`, settle the card in
  the same post as the finish.
- **Archive a fixed bug, before the finish:** launched on a diagnosed folder
  and now Fixed with nothing past the diagnosis, post a `confirm` card
  "Archive this bug?" in the same post as "See it running": the dry run's
  `files` in `body`, `yesLabel` "Archive it", `noLabel` "Keep it in specs/",
  and `consequences` naming `specs--completed/<bug>/`. On yes, run
  `node "<S>/specs.mjs" archive <spec>` (the skill file says where `<S>` is),
  and say where it went in the finish's `body`. On no, the
  dashboard lists the folder as "Bug fixed", never pre-selected.
- **The finish after the build:** `command` is the commit command, filled in,
  in the project's commit format (AGENTS.md), with
  `"where": "When you are happy with it, commit it from your terminal:"`, and
  `review` on offer — the **Review it now** button, since a quick task has no
  sign-off card to put it on — `"commit": true` (the **Commit it now** button;
  `console-finish.md`), `"changelog": true` (**Update CHANGELOG first**, beside
  it; it hops into Changelog and on to Git) and `"dashboard": true`, so the finished screen
  also offers **Back to the dashboard**. Review and dashboard are required: a finish without
  `dashboard` leaves the person on a dead end. Keep waiting for whichever
  button is pressed, and everything after that is `building-review.md`.
- **Escalated / aborted:** settle the verdict the same way in the finish post —
  finish with `"command": "/plan2code-1-plan"` and the
  PLAN-DRAFT's path in `body`, no review; or `"command": "/plan2code-quick-task"`.
  Both set `"dashboard": true`: an abort of a quick task saves nothing to
  resume, so it is not a pause.

## Stop requests during a build

See `building.md` → Stop requests during a build.
