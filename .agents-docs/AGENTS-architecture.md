# Architecture
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Directory Structure

```
plan2code/
├── src/                        # Source workflow prompts (9 markdown files)
│   └── plan2code-review-references/     # Reference files for review skill
│       ├── verification-protocol.md        # Deep verification + confidence calibration
│       ├── dimensions.md                   # 11 dimensions with detailed checklists
│       └── false-positives.md              # Known false-positive patterns
├── plan2code-loop/           # Autonomous loop CLI tool (Node.js/TypeScript)
│   ├── src/                    # TypeScript source
│   └── dist/                   # Built output (tsup)
├── plan2code-metrics/        # Recursive self-improvement toolchain
│   ├── src/                    # TypeScript source
│   │   └── prompts/            # Internal AI prompt templates (no char limit)
│   └── dist/                   # Built output (tsup)
├── src/statusline-claude/       # Claude CLI status line (Node.js, zero deps, single file)
│   ├── statusline.js           # Self-contained: config, git, formatters, render
│   └── statusline-config.json  # Default config template
├── scripts/                    # Development scripts
│   └── validate-char-count.js  # Pre-commit character count validator
├── dist/                       # Generated distribution files (auto-generated)
│   ├── global-commands/        # For global installation (~/.claude/, etc.)
│   └── local-commands/         # For per-project installation (.claude/, etc.)
├── .husky/                     # Git hooks (husky)
│   └── pre-commit              # Runs character count validation
├── docs/                       # Documentation and assets
├── specs/                      # Feature specs (if any in-progress)
├── install.js                  # Interactive installer (Node.js)
├── package.json                # Root package (husky only, private: true)
├── version.json                # Version metadata
└── README.md                   # User documentation
```

## Key Files

| File | Purpose |
|------|---------|
| `install.js` | Main installer - generates and installs workflow files to AI tool directories |
| `src/plan2code-*.md` | Source workflow prompts (the "source of truth") |
| `scripts/validate-char-count.js` | Pre-commit validator ensuring all source prompts ≤ 11,000 chars |
| `version.json` | Version metadata (name, version, description) |
| `QUICK-REFERENCE.md` | User quick-reference card |
| `src/statusline-claude/` | Claude CLI status bar (included in `A` Install All + dev tools; also via Custom → S) |

## Workflow Prompts (in `src/`)

| File | Step | Purpose |
|------|------|---------|
| `plan2code-init.md` | Init | Generate AGENTS.md as index + `.agents-docs/` section files (progressive discovery) |
| `plan2code-init-update.md` | Update | Update AGENTS.md with learnings; detects and routes edits to `.agents-docs/` files |
| `plan2code-quick-task.md` | 0 | Lightweight planning for small tasks |
| `plan2code-1-plan.md` | 1 | Requirements analysis & architecture |
| `plan2code-1b-revise-plan.md` | 1b | Mid-implementation revisions |
| `plan2code-2-document.md` | 2 | Create implementation specs |
| `plan2code-3-implement.md` | 3 | Execute implementation (phase by phase) |
| `plan2code-review.md` | review | Post-implementation comprehensive review |
| `plan2code-4-finalize.md` | 4 | Validate, summarize, feedback, archive (7 steps) |

## Naming Convention

Workflow files follow a strict naming pattern:
- **Utilities:** `plan2code-<name>.md` (single dash)
- **Numbered steps:** `plan2code-<N>-<name>.md` (single dash, number, single dash)

Examples:
- `plan2code-init.md` (utility)
- `plan2code-1-plan.md` (step 1)
- `plan2code-1b-revise-plan.md` (step 1b)

## Reference Files

Some workflows use companion reference files for depth that exceeds the 11k char limit. The orchestrator (main workflow file) loads them via `Read` directives during execution.

**Pattern:** `src/<source-filename-without-extension>-references/` (e.g., `plan2code-review-references/`)

**How the installer handles them:**
- **Skill-directory platforms** (Claude Code, Agents, Crush, Devin): reference files are nested as `<skill-name>/references/`. Read paths use canonical `references/<file>.md`.
- **Flat-file platforms** (Windsurf, Cursor, Copilot, Continue): reference files are placed as a sibling directory. The installer rewrites Read paths to the sibling directory name (e.g., `plan2code-review-references/<file>.md`).
- **TOML platforms** (Gemini CLI): reference files are skipped — TOML embeds content inline, so Read directives won't resolve. The orchestrator's inline fallback text covers this.

Reference files are NOT subject to the 11,000 character limit. Currently only the review workflow uses this pattern — it serves as the POC for potential adoption by other workflows.

## Status Line

Optional Claude Code status bar living in `src/statusline-claude/`. Three-line bar (icon + content per line) showing model, project, branch, uncommitted diff stats, session duration + cost, context window usage, and plan/quota usage.

**Design constraints:**
- **Zero runtime dependencies** — `statusline.js` is self-contained (config loader, git helpers, formatters, render). Copied verbatim to `~/.claude/plan2code-statusline.js` on install; no bundler step.
- **Stdin-driven** — all data comes from Claude Code's stdin JSON (`model`, `workspace`, `context_window`, `rate_limits`, `cost`). No API calls, no auth, no background processes.
- **Silent failure** — outer `try/catch` around `main()` plus `process.exit(0)` on missing stdin guarantees the script never crashes the CLI. All git ops are timeout-bounded (1.5s) and non-git workspaces short-circuit via `fs.existsSync('.git')`.
- **Atomic settings writes** — installer writes `~/.claude/settings.json` via temp file + rename so a crash never leaves the file truncated.
- **Custom-config respect** — installer detects non-plan2code `statusLine` entries, prompts before replacing, and backs up to `statusline-previous.json`. Uninstall only removes `settings.statusLine` if it points to the plan2code bundle.

**Layout:**

```
src/statusline-claude/
├── statusline.js           # Self-contained: config, git, formatters, render
├── statusline-config.json  # Default config template
└── README.md               # User docs: install, config, debugging
```

**Adaptive plan-usage display:** the formatter auto-selects between `5h/7d` rate-limit percentages (Pro/Max/Teams — when `rate_limits` present in stdin) and `Nk in · Nk out` session-token counts (Bedrock/Vertex/PAYG — when `rate_limits` absent). Segment is hidden when neither shape is available.

**Installer integration** lives in `install.js` under the `STATUS LINE INSTALLATION` section (`installStatusLine`, `uninstallStatusLine`). Included in `A` (Install All + dev tools); also available individually via Custom → `S`.
