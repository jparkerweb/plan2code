# General

### A document-level key handler that must ignore typing has to read e.composedPath(): the Markdown editors live in a shadow root, so e.target is their .md-host element, not the contenteditable inside.
- Kind: how-it-works
- About: src/web-console/public/md-field.js, src/web-console/public/screens/core.js
- Noted: 2026-11-17, implement-review

### A new dialog wider than 440px needs max-width: none next to its width, sized like the Notebook dialog (min(1200px, 90vw)); the base .modal caps every dialog at 440px, so a width alone has no effect.
- Kind: correction
- About: src/web-console/public/styles/learning.css, src/web-console/public/styles/pieces.css
- Why: The Lessons dialog declared width: min(720px, ...) without max-width: none and rendered about 440px wide.
- Noted: 2026-11-15, quick-task

### A new file under src/web-console/ needs a row in the AGENTS-architecture console files tables; run scripts/test-web-console-shape.mjs after adding one, since it fails until the row exists.
- Kind: convention
- About: scripts/test-web-console-shape.mjs, .agents-docs/AGENTS-architecture-console-page.md
- Noted: 2026-11-14, implement-review

### A no-hop dashboard request goes as a __<name> send; the agent answers with a top-level patch key checked in validate() (patches.mjs), and pointersForSend() maps it to console-launches.md.
- Kind: convention
- About: src/web-console/patches.mjs, src/web-console/pointers.mjs
- Noted: 2026-11-17, quick-task

### A test run of node install.js with a temp HOME still writes the plan2code shims into the real npm global bin, because npm's prefix does not follow HOME; also set npm_config_prefix to a temp folder.
- Kind: correction
- About: install.js
- Why: A piped --update test run repointed the real plan2code shims at a temp folder until they were fixed by hand.
- Noted: 2026-11-17, implement-review

### Before adding a class to the git board, grep styles/git.css for it: short names like git-tools and git-path are already taken (the Branches search row, the file path cell).
- Kind: correction
- About: src/web-console/public/styles/git.css
- Why: The new tools fold-out reused git-tools and the Branches row's flex rule laid it out side by side.
- Noted: 2026-11-17, quick-task

### Each recordInstalled() in install.js stamps the version being installed into install.json, so a failed update must restore the old one with setRecordVersion(), or a retry says Already on.
- Kind: how-it-works
- About: install.js
- Noted: 2026-11-17, implement-review

### In a Markdown field (md-field.js), CodeMirror's scroller and content are only as tall as the text, not the bordered host: code that hit-tests the scroller must not assume it fills the box.
- Kind: how-it-works
- About: src/web-console/public/md-field.js
- Noted: 2026-11-17, quick-task

### In a node:test file, start fixtures such as a test server in a root before hook, never with a top-level await after the first test(), which lets the runner run after hooks early
- Kind: correction
- About: scripts/test-script-deps.mjs
- Why: test-script-deps.mjs awaited its server mid-file and 7 tests failed on Ubuntu and macOS CI only.
- Noted: 2026-11-15, Failure log

### Playwright counts aria-disabled as disabled: a page test pressing an aria-disabled button (Stop session, Back) uses click({ force: true }) and reads .disabled via evaluate().
- Kind: command
- About: scripts/test-web-console-page-session.mjs
- Noted: 2026-11-17, implement-review

### The Agents & models tab shows a model in two places, the cards (agents/agents-summary.js) and the strengths panel (agents/agents-strengths.js); check a models.json label change in both.
- Kind: how-it-works
- About: src/web-console/public/screens/agents
- Noted: 2026-11-17, implement-review

### The app's webview data sits outside ~/.plan2code, in Tauri's app_local_data_dir() on Windows and Linux (%LOCALAPPDATA%/com.plan2code.desktop); appWebviewDirs() in install.js lists it per OS.
- Kind: how-it-works
- About: install.js
- Noted: 2026-11-17, implement-review

### The desktop app's CSP allows no inline script, so anything that must run before the first paint (the saved theme and accent) goes in the classic head script ui/theme-early.js, not in app.js.
- Kind: convention
- About: plan2code-app/ui/theme-early.js
- Noted: 2026-11-17, implement-review

### The launcher's prompts each open a new readline on stdin, so a test piping several answers at once loses all but the first; drive a multi-prompt flow by writing each answer after a short delay.
- Kind: how-it-works
- About: src/launcher/plan2code.js
- Noted: 2026-11-15, implement-review

### To drive launcher prompts in scripts/test-launcher.mjs, use runAtTerminal(): it marks stdin as a terminal with a preload file and answers each prompt only once it shows on stdout.
- Kind: convention
- About: scripts/test-launcher.mjs
- Noted: 2026-11-17, implement-review

### When a card in src/plan2code-deps.md changes (what it lists or asks), change the same card in src/web-console/notes/deps.md in the same edit: the console builds the card from the notes.
- Kind: correction
- About: src/plan2code-deps.md, src/web-console/notes/deps.md
- Why: A review fix widened the code-changes card in the prompt only, and the re-check found the notes still listing the old rows.
- Noted: 2026-11-14, implement-review
