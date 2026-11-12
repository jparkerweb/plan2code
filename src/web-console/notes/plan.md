# Planning

- Phase breakdowns are an editable `list`. The fresh-idea card carries `"templates":"idea"`, `"fill":"note"`.
- A note on an open question: reword it, `"_delete":true` it or send `"stands":true` (still fits), with your reply.
- Nothing is saved before the Large checkpoint or Phase 7: a stop before then has `finish.body` say nothing was kept, `"command":"/plan2code-1-plan"`. After the checkpoint post `"stopWarning":""`.
- Completion finish `command`: `/plan2code-2-document`. The Large checkpoint finish is a pause: headline starts "Paused", `command` `/plan2code-1-plan`, no `dashboard`.
- Helpers are reported as `helpers`, each `done` or `failed` before the sign-off it feeds. Questions, sign-offs and the PLAN-DRAFT stay with you.
- A UI prototype run inside this skill posts `{"run":{"event":"ui-prototype-round","id":"<name>-round-<N>"}}` once per round drawn, uses a `text` card to paste the choice into, and opens its page in a separate browser tab.
