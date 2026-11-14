# Test map
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

Which checks cover which files, read by PR Prep and Test (`test-map.mjs read` checks every path and command). Per-area web console suites and the new-skill checklist do not fit one row: see "Targeted tests first" in [Development Commands](./AGENTS-development-commands.md).

| Area | Paths | Run | Shared |
|---|---|---|---|
| Activities games | `src/web-console/public/activities/**`, `src/web-console/public/tones.js`, `src/web-console/public/music.js` | `node --test scripts/test-web-console-tones.mjs scripts/test-web-console-activities.mjs` | no |
| Launcher | `src/launcher/**` | `node --test scripts/test-launcher.mjs` | no |
| Dead Code script | `src/plan2code-dead-code-scripts/**`, `scripts/fixtures/dead-code/**` | `npm run build:skills && node scripts/node-test.mjs scripts/test-script-dead-code.mjs` | no |
| Update Dependencies script | `src/plan2code-deps-scripts/**`, `scripts/fixtures/deps/**` | `npm run build:skills && node scripts/node-test.mjs scripts/test-script-deps.mjs` | no |
| UI Prototype script and shell | `src/skill-scripts/ui-prototype*.mjs`, `src/plan2code-ui-prototype-references/**`, `scripts/fixtures/ui-prototype/**` | `npm run build:skills && node scripts/node-test.mjs scripts/test-script-ui-prototype.mjs scripts/test-ui-prototype-page.mjs` | no |
| Lessons script | `src/skill-scripts/lessons.mjs`, `src/web-console/learning.mjs` | `npm run build:skills && node scripts/node-test.mjs scripts/test-script-lessons.mjs` | no |
| Learning on the console | `src/web-console/learning.mjs`, `src/web-console/public/screens/learning-row.js`, `src/web-console/public/styles/learning.css` | `node scripts/node-test.mjs scripts/test-web-console-learning.mjs scripts/test-web-console-page-learning.mjs` | no |
| Workflow prompts | `src/plan2code-*.md` | `node scripts/validate-char-count.js && node scripts/check-skill-table.mjs` | no |
| Desktop app | `plan2code-app/**` | `cd plan2code-app && cargo test` | no |
| Metrics | `plan2code-metrics/**` | `cd plan2code-metrics && npm test` | no |
| Bot | `plan2code-bot/**` | `cd plan2code-bot && npm test` | no |
| Shared code | `install.js`, `src/web-console/public/skills.js`, `src/web-console/console.mjs`, `src/web-console/routes.mjs`, `src/web-console/static.mjs`, `scripts/*-helpers.mjs` | `npm test` | yes |
| Docs only | `**/*.md` | `node --test scripts/test-us-english.mjs scripts/test-line-endings.mjs` | no |
