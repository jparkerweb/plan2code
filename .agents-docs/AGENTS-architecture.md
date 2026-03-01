# Architecture
> Part of [AGENTS.md](../AGENTS.md) — project guidance for AI coding agents.

## Directory Structure

```
plan2code/
├── src/                        # Source workflow prompts (8 markdown files)
├── plan2code-loop/           # Autonomous loop CLI tool (Node.js/TypeScript)
│   ├── src/                    # TypeScript source
│   └── dist/                   # Built output (tsup)
├── plan2code-metrics/        # Recursive self-improvement toolchain
│   ├── src/                    # TypeScript source
│   │   └── prompts/            # Internal AI prompt templates (no char limit)
│   └── dist/                   # Built output (tsup)
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

## Workflow Prompts (in `src/`)

| File | Step | Purpose |
|------|------|---------|
| `plan2code---init.md` | Init | Generate AGENTS.md as index + `.agents-docs/` section files (progressive discovery) |
| `plan2code---init-update.md` | Update | Update AGENTS.md with learnings; detects and routes edits to `.agents-docs/` files |
| `plan2code---quick-task.md` | 0 | Lightweight planning for small tasks |
| `plan2code-1--plan.md` | 1 | Requirements analysis & architecture |
| `plan2code-1b--revise-plan.md` | 1b | Mid-implementation revisions |
| `plan2code-2--document.md` | 2 | Create implementation specs |
| `plan2code-3--implement.md` | 3 | Execute implementation (phase by phase) |
| `plan2code-4--finalize.md` | 4 | Validate, summarize, feedback, archive (7 steps) |

## Naming Convention

Workflow files follow a strict naming pattern:
- **Utilities:** `plan2code---<name>.md` (triple dash)
- **Numbered steps:** `plan2code-<N>--<name>.md` (single dash, number, double dash)

Examples:
- `plan2code---init.md` (utility)
- `plan2code-1--plan.md` (step 1)
- `plan2code-1b--revise-plan.md` (step 1b)
