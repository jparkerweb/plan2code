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
  const start = text.search(/^#{2,3} Before you start$|<h3>Before you start<\/h3>|<summary>Before you start<\/summary>/m);
  assert.ok(start >= 0, `${file} has no "Before you start" block`);
  const rest = text.slice(start);
  const body = rest.indexOf('\n') + 1;
  const closers = ['</details>', '</div>'].map((tag) => rest.indexOf(tag)).filter((i) => i > 0);
  const next = file.endsWith('.html') ? Math.min(...closers) : rest.slice(body).search(/^#{1,3} /m);
  const end = file.endsWith('.html') ? next : next < 0 ? -1 : body + next;
  return end > 0 ? rest.slice(0, end) : rest;
}

for (const file of DOCS) {
  test(`${file} tells a newcomer how to get started`, () => {
    const block = blockOf(file);
    // Git is a prerequisite too: npm fetches the installer with it (git+https).
    for (const needle of ['Node.js 18', 'node --version', 'nodejs.org', 'git --version', 'git-scm.com', '/plan2code', '$plan2code']) {
      assert.ok(block.includes(needle), `${file} is missing "${needle}" in its "Before you start" block`);
    }
    assert.match(block, /project you want to (work on|work in)/, `${file} does not say to start from your project`);
    assert.ok(!block.includes(EM_DASH), `${file} has an em dash in its "Before you start" block`);
  });

  if (!WITH_INSTALL.has(file)) continue;
  // The command leads (README's "See it" picture, the site's hero); the guidance follows in a
  // block of its own, and the line beside the command names the two requirements.
  test(`${file} leads with the install command and names what it needs`, () => {
    const text = read(file);
    const install = text.indexOf('npx --allow-git');
    assert.ok(install >= 0 && text.includes('Before you start'), `${file} is missing the install command or "Before you start"`);
    if (file === 'README.md') {
      const first = text.split('\n').slice(0, 60).join('\n');
      assert.ok(first.includes('**Plan it. Approve it. Let it build.**'), 'README.md: the tagline must open it');
      assert.ok(first.includes('npx --allow-git'), 'README.md: the install command must be in its first 60 lines, under "See it"');
      assert.ok(first.indexOf('## See it') >= 0 && first.indexOf('## See it') < first.indexOf('npx --allow-git'), 'README.md: the install command must sit under "See it"');
      assert.ok(first.includes('Needs Node.js 18+ and Git'), 'README.md: the first lines must name Node.js and Git');
    }
    if (file === 'docs/index.html') {
      assert.ok(install < text.indexOf('id="install"'), 'docs/index.html: the command must also be in the hero, before #install');
      assert.ok(text.includes('Needs Node 18+ and Git'), 'docs/index.html: #install must say what it needs in one line');
    }
  });

  test(`${file} installs from the release branch, never from main`, () => {
    const text = read(file);
    const commands = text.match(/npx --allow-git=all git\+https:\/\/github\.com\/jparkerweb\/plan2code\.git\S*/g) || [];
    assert.ok(commands.length > 0, `${file} has no install command`);
    for (const command of commands) assert.match(command, /\.git#release(?![\w.-])/, `${file}: ${command} must end in #release`);
  });

  test(`${file} says what a silent install means and how to see why`, () => {
    const text = read(file);
    assert.match(text, /no output at all/, `${file} does not say what no output means`);
    assert.ok(text.includes('git ls-remote https://github.com/jparkerweb/plan2code.git'), `${file} is missing the git ls-remote check`);
  });
}
