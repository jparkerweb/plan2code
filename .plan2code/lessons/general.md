# General

### A new dialog wider than 440px needs max-width: none next to its width, sized like the Notebook dialog (min(1200px, 90vw)); the base .modal caps every dialog at 440px, so a width alone has no effect.
- Kind: correction
- About: src/web-console/public/styles/learning.css, src/web-console/public/styles/pieces.css
- Why: The Lessons dialog declared width: min(720px, ...) without max-width: none and rendered about 440px wide.
- Noted: 2026-11-15, quick-task

### A new file under src/web-console/ needs a row in the AGENTS-architecture console files tables; run scripts/test-web-console-shape.mjs after adding one, since it fails until the row exists.
- Kind: convention
- About: scripts/test-web-console-shape.mjs, .agents-docs/AGENTS-architecture-console-page.md
- Noted: 2026-11-14, implement-review

### In a node:test file, start fixtures such as a test server in a root before hook, never with a top-level await after the first test(), which lets the runner run after hooks early
- Kind: correction
- About: scripts/test-script-deps.mjs
- Why: test-script-deps.mjs awaited its server mid-file and 7 tests failed on Ubuntu and macOS CI only.
- Noted: 2026-11-15, Failure log

### The launcher's prompts each open a new readline on stdin, so a test piping several answers at once loses all but the first; drive a multi-prompt flow by writing each answer after a short delay.
- Kind: how-it-works
- About: src/launcher/plan2code.js
- Noted: 2026-11-15, implement-review

### When a card in src/plan2code-deps.md changes (what it lists or asks), change the same card in src/web-console/notes/deps.md in the same edit: the console builds the card from the notes.
- Kind: correction
- About: src/plan2code-deps.md, src/web-console/notes/deps.md
- Why: A review fix widened the code-changes card in the prompt only, and the re-check found the notes still listing the old rows.
- Noted: 2026-11-14, implement-review
