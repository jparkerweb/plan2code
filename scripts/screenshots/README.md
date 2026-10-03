# Screenshot payloads

Each JSON file here stages one web console screen for the docs, with no agent
involved. `node scripts/capture-screenshots.mjs` opens a console session in a
throwaway sample project, posts these files, and saves the screens as light
and dark WebP images in `docs/screenshots/`.

| File | Stages |
| --- | --- |
| `dashboard.json` | The dashboard menu, suggesting the next build phase |
| `question.json` | A Plan session with three questions open (also the base of the Ask shot) |
| `doc.json` | A living document with settled, assumed and draft sections, and its review card |
| `build.json` | A phase being built: the progress bar, the task list and the current task |
| `signoff.json` | The completion report and the sign-off card |
| `finish.json` | The finished screen after sign-off (posted after `signoff.json`) |

Refresh every image with `node scripts/capture-screenshots.mjs`, or one with
`--only <shot>`.
