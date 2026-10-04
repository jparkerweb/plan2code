# Community Feedback Submission (STEP 6.5 detail)

> Loaded by `src/plan2code-4-finalize.md` STEP 6.5. This file has no character limit (see `AGENTS-architecture.md` Reference Files).

Everything in the payload is read from files, so a script builds it: the metrics from the `METRICS_JSON` comments the pipeline already wrote, the task counts from the phase files, your Step 5 answers from overview.md's `## User Feedback` table, the installed version, and a sha256 prefix of each prompt. Your part is the two judgment counts, the preview, and the user's approval.

## 1. Build the payload

Step 6 has already archived the spec, so point at the archive:

```
node "<S>/feedback-payload.mjs" build specs--completed/<feature-name> --set verification_failures_found=<N> --set documentation_updates_needed=<N>
```

If Step 6 did not archive (the archive target already existed), the spec is still in `specs/`: pass `specs/<feature-name>` instead. A bare `<feature-name>` that exists in both folders stops with exit 5 `ambiguous-spec` rather than guessing, because `specs--completed/<feature-name>` would be the older run.

The two counts are the ones Step 7's METRICS_JSON carries (your Step 2 and Step 4 findings). It prints:

| Field | Use |
|---|---|
| `title`, `body`, `label` | The exact issue to preview. The body ends with the full payload as `<!-- METRICS_JSON {...} -->` |
| `payload` | The schema-1.0 object: a fresh `run_id`, `plan2code_version`, `prompt_versions_short` (12-character sha256 prefixes), `step1`-`step4`, `user_feedback`. It never includes `project.name` or bulky arrays |
| `notes` | Missing METRICS_JSON blocks (that step is `null`, which the ingest side reads as not present). Mention them in one line |
| `oversize`, `urlBytes`, `next` | The prefilled browser URL is over ~8 KB. Offer to shorten the free-text answers; on yes, rebuild with `--truncate` (trims `rating_reason` first, then `what_went_well` / `what_went_poorly`). Tier 1 (`gh`) has no limit, so declining is fine only when `gh` is installed and signed in (`gh auth status`): if `gh` fails, `submit` stops with exit 4 `oversize` instead of falling back to the browser |
| `dir` | Where `payload.json` and `body.md` were written; `submit` needs it |

| Exit | Meaning | Do |
|---|---|---|
| 2 `missing-set` | A judgment count is missing | Pass both `--set` values |
| 3 `no-feedback` | overview.md has no `## User Feedback` table | Nothing to submit: skip to Step 7 |
| 3 `spec-not-found` | Wrong name or not archived | Check `specs--completed/` |
| 4 `bad-rating` | The Rating row is not 1-10 | Fix the row, rebuild |
| 5 `ambiguous-spec` | A bare name exists in both `specs/` and `specs--completed/` | Pass the exact path: `specs/<feature-name>` if Step 6 did not archive this run |

## 2. Preview and approval gate

Display the exact `title`, the full `body` (including the `METRICS_JSON` block), and the label to the user, mirroring the Step 4 Documentation Review pattern:

```
⋅
    ╭───╮
    │ ★ │╱
   ╱│ ~ │   Ready to submit your feedback to the maintainer!
    ╰┬─┬╯
```

> Reply "approve" to proceed with submission, or "skip" to cancel.

Do NOT proceed to submission without an explicit "approve" reply. A "skip" or any non-approval reply cancels this sub-step entirely and proceeds to Step 7 with no submission.

## 3. Submit

On approval only:

```
node "<S>/feedback-payload.mjs" submit --from <dir>
```

It tries each tier in order and reports the one that worked:

| `tier` | What happened | Tell the user |
|---|---|---|
| 1 | `gh issue create` succeeded | The issue URL (`issue`) |
| 2 | `gh` missing or not signed in (`ghError`); the system was asked to open the prefilled new-issue page | If it opened, they still need to click **Submit new issue**, signed in to GitHub. If nothing opened (a remote or headless session), give them `url` as in tier 3 |
| 3 | No browser could be opened (headless or remote session) | "Please open this URL in your browser and click 'Submit new issue' to share your feedback:" plus `url` |

| Exit | Meaning | Do |
|---|---|---|
| 3 `no-payload` | `--from` has no `payload.json` / `body.md` | Pass the `dir` that `build` printed |
| 4 `oversize` | `gh` failed (`message` says why) and the URL is over ~8 KB, too long for tiers 2 and 3, so neither ran | Offer to shorten the free-text answers: on yes, rebuild with `--truncate` and submit again. Or have the user install `gh` and run `gh auth login`, then submit again |

`--dry-run` shows the tiers without running them, plus `urlBytes` and `oversize` (when `oversize` is true, only tier 1 can submit). After any tier succeeds (or the user confirms a tier 3 submission), proceed to Step 7 as normal.
