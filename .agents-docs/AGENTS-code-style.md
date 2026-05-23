# Code Style & Gotchas
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Code Style

- **install.js:** CommonJS, Node.js built-ins only (no external deps), ANSI colors via `COLORS` constant, readline-based prompts
- **plan2code-loop & plan2code-metrics:** TypeScript + ESM, built with tsup (target ES2022, moduleResolution: bundler)
  - External deps: `@inquirer/prompts`, `chalk`, `execa`, `ora`
  - Interactive CLI via `@inquirer/prompts` (select, input, confirm)
- **File operations:** Synchronous fs in all packages

## Gotchas / Pitfalls

- **Version sync:** When adding a new version to `CHANGELOG.md`, also update `version.json` and `package.json` to match. The installer displays the version from `version.json` in its header.
- **Loop `.gitignore` setup:** `ensureGitignore()` runs at startup in `Controller.run()` as a pre-flight step, not just inside `createTaskCommit()`. This is critical for phase mode where the Node controller doesn't handle commits — without it, `git add -A` would stage spec files.
- **Workflow file character limit:** All `src/plan2code-*.md` files must be ≤ 11,000 characters. A husky pre-commit hook enforces this. The 11,000 limit leaves buffer for platform-specific YAML headers (106-142 chars) to stay under Windsurf's 12,000 char limit.
- **Metrics internal prompts have no char limit:** Files in `plan2code-metrics/src/prompts/` are NOT subject to the 11,000 char limit — only `src/plan2code-*.md` consumer-facing prompts are.
- **User Feedback table format:** The `## User Feedback` markdown table in `overview.md` has a strict format the collector regex depends on. Field names must be exactly `Rating`, `Reason`, `Went Well`, `Went Poorly`. Pipe characters in values must be escaped as `\|`.
- **Reference file sizing guideline:** Files in `src/plan2code-*-references/` directories target ~100-200 lines each (soft guideline; evaluate splitting above 300). They are NOT subject to the 11,000 character limit. The pre-commit hook (`validate-char-count.js`) only checks `src/plan2code-*.md` flat files — subdirectory contents are automatically excluded.
