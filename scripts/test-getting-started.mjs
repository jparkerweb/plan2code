// Keeps the "Before you start" guidance identical in meaning across the newcomer docs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DOCS = ['README.md', 'docs/index.html', 'QUICK-REFERENCE.md', '.readme/walkthrough.md'];
// Docs that carry the install command themselves; the walkthrough links to the README for it.
const WITH_INSTALL = new Set(['README.md', 'docs/index.html', 'QUICK-REFERENCE.md']);
const EM_DASH = String.fromCharCode(0x2014);

function read(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

// The first "Before you start" block: from its heading to the next heading (Markdown)
// or the end of its container (HTML).
function blockOf(file) {
  const text = read(file);
  const start = text.search(/^#{2,3} Before you start$|<h3>Before you start<\/h3>/m);
  assert.ok(start >= 0, `${file} has no "Before you start" block`);
  const rest = text.slice(start);
  const body = rest.indexOf('\n') + 1;
  const next = file.endsWith('.html') ? rest.indexOf('</div>') : rest.slice(body).search(/^#{1,3} /m);
  const end = file.endsWith('.html') ? next : next < 0 ? -1 : body + next;
  return end > 0 ? rest.slice(0, end) : rest;
}

for (const file of DOCS) {
  test(`${file} tells a newcomer how to get started`, () => {
    const block = blockOf(file);
    for (const needle of ['Node.js 18', 'node --version', 'nodejs.org', '/plan2code', '$plan2code']) {
      assert.ok(block.includes(needle), `${file} is missing "${needle}" in its "Before you start" block`);
    }
    assert.match(block, /project you want to (work on|work in)/, `${file} does not say to start from your project`);
    assert.ok(!block.includes(EM_DASH), `${file} has an em dash in its "Before you start" block`);
  });

  if (!WITH_INSTALL.has(file)) continue;
  test(`${file} puts the guidance before the install command`, () => {
    const text = read(file);
    const guide = text.indexOf('Before you start');
    const install = text.indexOf('npx --allow-git');
    assert.ok(guide >= 0 && install >= 0 && guide < install, `${file}: "Before you start" must come before the npx line`);
  });

  test(`${file} says what a silent install means and how to see why`, () => {
    const text = read(file);
    assert.match(text, /no output at all/, `${file} does not say what no output means`);
    assert.ok(text.includes('git ls-remote https://github.com/jparkerweb/plan2code.git'), `${file} is missing the git ls-remote check`);
  });
}
