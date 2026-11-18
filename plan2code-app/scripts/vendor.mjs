// Copies the files the page loads from outside ui/ into ui/vendor/, so the page is
// plain files with no bundler: the xterm files from node_modules, and the web
// console's own tokens.css (its colors, type, radii and layers), so the shell
// wears the same ones and cannot drift from them. Run before `tauri dev` and
// `tauri build`.
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'ui', 'vendor');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/@xterm/xterm/lib/xterm.js', 'xterm.js'],
  ['node_modules/@xterm/xterm/css/xterm.css', 'xterm.css'],
  ['node_modules/@xterm/addon-fit/lib/addon-fit.js', 'addon-fit.js'],
  ['node_modules/@xterm/addon-web-links/lib/addon-web-links.js', 'addon-web-links.js'],
  ['../src/web-console/public/styles/tokens.css', 'tokens.css'],
];
for (const [from, to] of files) copyFileSync(join(root, from), join(out, to));
console.log(`vendored ${files.length} files into ui/vendor/`);
