# Architecture
> Part of [AGENTS.md](../AGENTS.md): project guidance for AI coding agents.

This file is an index. The architecture notes are split by area so each file stays small enough to read whole (`scripts/check-doc-size.mjs` holds every file in `.agents-docs/` under a size limit). Read only the area you are changing.

| Area | File | Holds |
|---|---|---|
| Layout, prompts, install | [AGENTS-architecture-install.md](./AGENTS-architecture-install.md) | Directory Structure, Key Files, the Agents file, Workflow Prompts, Naming Convention, Reference Files, Repo-Local Skills, the Global `plan2code` Command (launcher) |
| Skill scripts | [AGENTS-architecture-skill-scripts.md](./AGENTS-architecture-skill-scripts.md) | the Node scripts shipped in each skill's `scripts/` |
| Status line | [AGENTS-architecture-statusline.md](./AGENTS-architecture-statusline.md) | the Claude Code status bar |
| Web console: server and contract | [AGENTS-architecture-console.md](./AGENTS-architecture-console.md) | overview and the files table for the server, the CLI and the agent-facing contract files |
| Web console: page | [AGENTS-architecture-console-page.md](./AGENTS-architecture-console-page.md) | the files table for every `public/` file except the games |
| Web console: design points | [AGENTS-architecture-console-design.md](./AGENTS-architecture-console-design.md) | why the console is built as it is: preferences, the wait, the transport, notebook, handoffs, tests, adding a page file |
| Activities | [AGENTS-architecture-activities.md](./AGENTS-architecture-activities.md) | every game but Ghoul Rush, and the rules every game follows ("Building an Activities game") |
| Ghoul Rush | [core](./AGENTS-architecture-ghoul-core.md), [stages](./AGENTS-architecture-ghoul-stages.md), [rides](./AGENTS-architecture-ghoul-rides.md) | the files table for the Ghoul Rush game |

The web console's files tables run across six files (server and contract, page, activities, and the three Ghoul Rush files); `scripts/test-web-console-shape.mjs` reads them all and fails when a console file has no row in any of them.
