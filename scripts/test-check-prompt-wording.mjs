import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { BANNED, findBanned } from "./check-prompt-wording.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-wording-"));
  for (const [name, text] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, text);
  }
  return dir;
}

test("a clean tree has no hits", () => {
  const dir = fixture({ "a/SKILL.md": "Ask with the question tool. Run `glob` or grep in a shell.\n" });
  assert.deepEqual(findBanned(dir), []);
});

test("every banned name is found, with its file and line", () => {
  for (const name of BANNED) {
    const dir = fixture({ "x/references/r.md": `fine\nuse ${name} here\n` });
    assert.deepEqual(findBanned(dir), [{ file: "x/references/r.md", line: 2, name }], name);
  }
});

test("a longer word that contains a banned name is not a hit", () => {
  const dir = fixture({ "a.md": "Globals and Grepping and AskUserQuestionnaire\n" });
  assert.deepEqual(findBanned(dir), []);
});

test("the CLI exits 1 on a hit and 0 on a clean tree", () => {
  const bad = fixture({ "a.md": "never use Glob\n" });
  const r = spawnSync(process.execPath, [path.join(HERE, "check-prompt-wording.mjs"), bad], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /a\.md:1 names a product tool: Glob/);
  const ok = fixture({ "a.md": "list the folder\n" });
  assert.equal(spawnSync(process.execPath, [path.join(HERE, "check-prompt-wording.mjs"), ok]).status, 0);
});

test("the built skills tree names no product tool", { skip: !fs.existsSync(path.join(ROOT, "skills")) }, () => {
  assert.deepEqual(findBanned(path.join(ROOT, "skills")), []);
});
