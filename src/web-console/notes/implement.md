# Implement

`implement` and `implement-review`. Read `building.md` first.

## First post of a phase

```jsonc
{"headline":{"stage":"Phase 3: API layer","cleared":0,"total":9},"docs":[{"id":"phasefile","title":"phase-3.md","blocks":[{"id":"body","file":"specs/<feature>/phase-3.md"}]}],"agent":{"status":"working","activity":"Checking the prerequisites","quietMinutes":15}}
```

`phasefile` is the whole file, so its task list is already on the page; no separate tasks doc is posted. A later phase posts the same doc with the new title and file.

## After every task

With the checkbox write:

```jsonc
{"headline":{"cleared":4},"docs":[{"id":"phasefile","refresh":true}],"agent":{"activity":"Task 5 of 9: the rate limiter"}}
```

The Phase Completion Summary lands in `phasefile` the same way. Then the `chat` check.

## Sign-off

Loop mode (`notes/loop.md`) posts `loopOutcome` instead. Otherwise the Completion Report is a doc and the approval a `review` pointing at it; the review offer is a verdict here, not on the finish:

```jsonc
{"docs":[{"id":"report","title":"Completion report","blocks":[{"id":"summary","state":"settled","md":"## Summary\n\n..."},{"id":"files","state":"settled","md":"## Files\n\n..."},{"id":"verify","state":"settled","md":"## How to check it\n\n..."}]}],"items":[{"id":"signoff","kind":"review","title":"Approve this phase","doc":"report","body":"Phase 3 is built. Read the report, try the checks, then approve it, review the code first, see it running, or say what to change.","verdicts":[{"id":"review","label":"Review the code first"},{"id":"approve","label":"Approve this phase"},{"id":"show","label":"Show me it working"},{"id":"changes","label":"I want changes"}],"token":{"approve":"approved","changes":"needs changes","show":"show me"},"nothingYet":"Nothing is marked complete until you approve.","gate":{"id":"signoff","authoritative":true}}]}
```

Posted with `--wait`. An approval whose note asks for a change: do the change first and ask again. `changes`: address it, update the report, reopen the item with a `thread` reply. `review`: read `building-review.md`. `show`: below.

A later phase in the same session asks with a new id (`signoff-phase-2`, title "Approve Phase 2"); the old card is a record.

### Show me it working

On `show`, run the workflow's **Show me it working** paragraph. Save screenshots under the session's `shots/`, never `specs/`, and post them as image blocks in a `shown` doc with what was run in a `md` block above (no browser tool: that block alone says what the command printed). Then reopen the same card without the `show` verdict, with a `thread` reply naming what was seen. Same on Finalize's card and the one `building-review.md` reopens; Quick Task's card is settled instead.

## After approval: the finish

Do what the workflow does on approval and print it in the terminal as usual, then:

```jsonc
{"settle":true,"run":{"event":"implement-phase","id":"phase-3","tasks":9},"finish":{"headline":"Phase 3 is done","body":"9 of 9 tasks, all on disk.\n\n| Phase | Tasks | Goal |\n| --- | --- | --- |\n| Phase 4: ... | 6 | ... |\n\nCommit it with:\n\n```\ngit add -- src/vote.js && git commit -m \"...\" -m \"AI Assisted\"\n```","command":"/plan2code-3-implement specs/lunch-vote/overview.md","doc":"report","commit":true,"dashboard":true}}
```

`commit:true` only when the body prints a commit. `command` is the next step: `/plan2code-3-implement specs/<feature>/overview.md`, or `/plan2code-4-finalize specs/<feature>/overview.md` after the last phase. No `review` on the finish.

`run` takes over what `cleared` counted, never adds: `implement-phase` (Implement) or `implement-review-phase` (Implement + Review), id `phase-N`, `tasks` the completed ones (`[x]`, not `[!]`); without `tasks` every phase weighs the same.

## Manual check-off (`next.action` is `checkoff`)

Open tasks under approved phases, one `confirm` each, `--wait`:

```jsonc
{"headline":{"stage":"Manual check-off","cleared":0,"total":2},"items":[{"id":"checkoff-3.4","kind":"confirm","title":"Task 3.4","body":"**Configure the SSO app in Okta**\n\nBLOCKED: needs admin access.\n\nIs this done?","yesLabel":"Done, check it off","noLabel":"Not yet"}]}
```

Yes: `specs.mjs tick`, `{"headline":{"cleared":N}}` with the next item. After the last: finish with `command` `/plan2code-4-finalize specs/<feature>/overview.md` when `tick` said `remaining` is empty, else `/plan2code-3-implement ...`; `body` lists what is open. No `run`, no `commit` unless the body prints one.

## Implement + Review (`implement-review`)

Stage 2 publishes findings as in `building-review.md` (The findings). Stage 3 has no "Check the fixes" item. The post starting Stage 2 carries `"run":{"event":"review","id":"review"}` (scores 1 point; the final `run` leaves it out). Stage 4 is the sign-off above, `show` included, without the `review` verdict, with review results and unresolved findings in the report and "Reviewed and ready for sign-off" in `body`. Its finish `run` is `implement-review-phase`.
