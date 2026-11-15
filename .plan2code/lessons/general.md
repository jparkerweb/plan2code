# General

### A new file under src/web-console/ needs a row in the AGENTS-architecture console files tables; run scripts/test-web-console-shape.mjs after adding one, since it fails until the row exists.
- Kind: convention
- About: scripts/test-web-console-shape.mjs, .agents-docs/AGENTS-architecture-console-page.md
- Noted: 2026-11-14, implement-review

### When a card in src/plan2code-deps.md changes (what it lists or asks), change the same card in src/web-console/notes/deps.md in the same edit: the console builds the card from the notes.
- Kind: correction
- About: src/plan2code-deps.md, src/web-console/notes/deps.md
- Why: A review fix widened the code-changes card in the prompt only, and the re-check found the notes still listing the old rows.
- Noted: 2026-11-14, implement-review
