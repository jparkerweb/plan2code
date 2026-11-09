# Quick Task

Read `building.md` first.

- Clarifying questions are `text` or `choice`. The first (what to build) carries `"templates":"idea"`, `"fill":"note"`.
- A note on an open question: reword it, `"_delete":true` it or send `"stands":true` (still fits), with your reply.
- Post `"stopWarning":"A quick task saves nothing until it is built, so stopping now loses what we have worked out."` at the start and `""` once the build is under way.
- **Scope check:** `choice` "Too big for a quick task?": `1` Continue (lightweight format), `2` Escalate to a full plan; measured counts against thresholds in `body`.
- **Feature name** (escalating): `text`, `"pattern":"^[a-z0-9]+(-[a-z0-9]+)*$"`, kebab-case placeholder.
- **The plan:** doc `plan`, one block per section, Steps as a checklist, plus `review` "Build this plan?" (`"doc":"plan"`) with verdicts `yes` ("Build it"), `modify` ("Change the plan"), `escalate` ("Plan it properly instead"), `abort` ("Stop here", `danger`):

  ```jsonc
  {"id":"plan","title":"Plan","blocks":[{"id":"summary","state":"settled","md":"## Summary\n\n..."},{"id":"files","state":"settled","md":"## Files to change\n\n- `src/a.ts` - ..."},{"id":"steps","state":"settled","md":"## Steps\n\n- [ ] **1.** Step one\n- [ ] **2.** Step two"},{"id":"verify","state":"settled","md":"## Verify\n\n- [ ] ..."}]}
  ```

  A `modify` reposts the changed blocks.
- **Building** after `yes`: the Plan tab is the live task list; steps are the tasks. Settle the verdict in the post that starts it:

  ```jsonc
  {"stopWarning":"","settle":true,"headline":{"stage":"Building","cleared":0,"total":4},"agent":{"status":"working","activity":"Task 1 of 4: step one","quietMinutes":10}}
  ```

  After each step (`building.md` → While you build), repost the `steps` block alone, as `md` since the plan lives only on the page:

  ```jsonc
  {"headline":{"cleared":1},"docs":[{"id":"plan","blocks":[{"id":"steps","state":"settled","md":"## Steps\n\n- [x] **1.** Step one\n- [ ] **2.** Step two"}]}],"agent":{"activity":"Task 2 of 4: step two"}}
  ```

  A step that cannot be done is `- [!]` with the reason, not counted in `cleared`. A step added mid-build raises `headline.total` in the same post. Tick Verify boxes in the post that reports the checks. Do not `wait` until the build is done.
- **See it running, before the finish:** once built, post `review` "See it running" (`"doc":"plan"`, verdicts `show` ("Show me it working"), `fine` ("No need, finish up"), tokens `show me` / `no`) with `--wait`. On `show`, see `notes/implement.md` → Show me it working; its one line goes in the finish `body`. `fine` settles the card in the finish post. After `show`, settle it in the post that shows it, then post `review` "Does it look right?" (`"doc":"shown"`, verdicts `fine` ("Looks right, finish up"), `changes` ("I want changes"), tokens `approved` / `needs changes`) with `--wait`. `changes`: make it, reshow if visible, reopen with a `thread` reply, wait again. Only `fine` leads to the finish.
- **Archive a fixed bug:** launched on a diagnosed folder and now Fixed with nothing past the diagnosis, post `confirm` "Archive this bug?" in the same post as "See it running": dry run's `files` in `body`, `yesLabel` "Archive it", `noLabel` "Keep it in specs/", `consequences` naming `specs--completed/<bug>/`. Yes: `node "<S>/specs.mjs" archive <spec>`, and say where it went in the finish `body`.
- **Finish after the build:** `command` is the filled-in commit command in the project's format (AGENTS.md), `"where":"When you are happy with it, commit it from your terminal:"`, with `review` (**Review it now**), `"commit":true`, `"changelog":true` and `"dashboard":true`. Review and dashboard are required. Whichever button is pressed, what follows is `building-review.md`.
- **Escalated / aborted:** settle the verdict in the finish post: `"command":"/plan2code-1-plan"` with the PLAN-DRAFT's path in `body`, no review; or `"command":"/plan2code-quick-task"`. Both `"dashboard":true`.

Stop requests during a build: `building.md`.
