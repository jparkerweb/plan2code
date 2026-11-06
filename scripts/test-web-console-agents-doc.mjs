// The Dashboard's AGENTS.md tab: which files the server will read for it.
// Run with: node --test scripts/test-web-console-agents-doc.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readAgentsDoc } from "../src/web-console/sessions.mjs";

function project(files) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-agents-doc-"));
  const root = path.join(base, "project");
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(base, "secret.md"), "outside\n");
  return { base, root };
}

test("readAgentsDoc reads AGENTS.md and one markdown file under .agents-docs", async () => {
  const { base, root } = project({ "AGENTS.md": "# Guide\n", ".agents-docs/AGENTS-x.md": "# X\n" });
  try {
    assert.deepEqual(await readAgentsDoc(root, "AGENTS.md"), { file: "AGENTS.md", text: "# Guide\n" });
    assert.deepEqual(await readAgentsDoc(root, ".agents-docs/AGENTS-x.md"), { file: ".agents-docs/AGENTS-x.md", text: "# X\n" });
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("readAgentsDoc is null for a missing file and for any other path", async () => {
  const { base, root } = project({ "AGENTS.md": "# Guide\n", "README.md": "readme\n", ".agents-docs/sub/deep.md": "deep\n", ".agents-docs/notes.txt": "t\n" });
  try {
    const refused = [
      "README.md",
      "agents.md",
      "../secret.md",
      ".agents-docs/../secret.md",
      ".agents-docs/sub/deep.md",
      ".agents-docs/notes.txt",
      ".agents-docs/missing.md",
      ".agents-docs\AGENTS-x.md",
      path.join(base, "secret.md"),
      "",
      null,
    ];
    for (const rel of refused) assert.equal(await readAgentsDoc(root, rel), null, String(rel));
    assert.equal(await readAgentsDoc("", "AGENTS.md"), null);
    fs.rmSync(path.join(root, "AGENTS.md"));
    assert.equal(await readAgentsDoc(root, "AGENTS.md"), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test("readAgentsDoc does not follow a link out of the project root", async (t) => {
  const { base, root } = project({ "AGENTS.md": "# Guide\n" });
  try {
    fs.mkdirSync(path.join(root, ".agents-docs"), { recursive: true });
    try {
      fs.symlinkSync(path.join(base, "secret.md"), path.join(root, ".agents-docs", "leak.md"));
    } catch {
      return t.skip("symlinks are not allowed here");
    }
    assert.equal(await readAgentsDoc(root, ".agents-docs/leak.md"), null);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});
