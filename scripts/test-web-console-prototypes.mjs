// The Prototypes tab: which files the server lists, reads and opens from a
// spec's prototypes/ folder.
// Run with: node --test scripts/test-web-console-prototypes.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listPrototypes, readPrototype, prototypeHtmlPath } from "../src/web-console/sessions.mjs";

const SPEC = "specs/picker";

function project(files) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-prototypes-"));
  const root = path.join(base, "project");
  fs.mkdirSync(root, { recursive: true });
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  fs.writeFileSync(path.join(base, "secret.md"), "outside\n");
  fs.writeFileSync(path.join(base, "secret.html"), "<p>outside</p>\n");
  return { base, root };
}

const clean = (base) => fs.rmSync(base, { recursive: true, force: true });

test("listPrototypes lists the .md and .html files directly in prototypes/, by name", async () => {
  const { base, root } = project({
    [`${SPEC}/prototypes/picker.md`]: "# Picker\n",
    [`${SPEC}/prototypes/picker.html`]: "<p>picker</p>\n",
    [`${SPEC}/prototypes/Another One.htm`]: "<p>two</p>\n",
    [`${SPEC}/prototypes/notes.txt`]: "not shown\n",
    [`${SPEC}/prototypes/shots/deep.md`]: "not shown\n",
    [`${SPEC}/overview.md`]: "not shown\n",
  });
  try {
    assert.deepEqual(await listPrototypes(root, SPEC), [
      { name: "Another One.htm", kind: "html" },
      { name: "picker.html", kind: "html" },
      { name: "picker.md", kind: "md" },
    ]);
  } finally {
    clean(base);
  }
});

test("listPrototypes is empty with no prototypes folder, and for a spec outside the root", async () => {
  const { base, root } = project({ [`${SPEC}/overview.md`]: "# O\n" });
  try {
    assert.deepEqual(await listPrototypes(root, SPEC), []);
    assert.deepEqual(await listPrototypes(root, "../"), []);
    assert.deepEqual(await listPrototypes(root, base), []);
    assert.deepEqual(await listPrototypes(root, ""), []);
    assert.deepEqual(await listPrototypes("", SPEC), []);
  } finally {
    clean(base);
  }
});

test("readPrototype reads one .md in prototypes/ and refuses everything else", async () => {
  const { base, root } = project({
    [`${SPEC}/prototypes/picker.md`]: "# Picker\n",
    [`${SPEC}/prototypes/picker.html`]: "<p>picker</p>\n",
    [`${SPEC}/overview.md`]: "# O\n",
  });
  try {
    assert.deepEqual(await readPrototype(root, SPEC, "picker.md"), { file: "picker.md", text: "# Picker\n" });
    const refused = ["picker.html", "../overview.md", "..\\overview.md", "../../../secret.md", "missing.md", path.join(base, "secret.md"), "", null];
    for (const name of refused) assert.equal(await readPrototype(root, SPEC, name), null, String(name));
    assert.equal(await readPrototype(root, "../", "secret.md"), null);
  } finally {
    clean(base);
  }
});

test("prototypeHtmlPath names one .html in prototypes/ and refuses everything else", async () => {
  const { base, root } = project({
    [`${SPEC}/prototypes/picker.md`]: "# Picker\n",
    [`${SPEC}/prototypes/picker.html`]: "<p>picker</p>\n",
  });
  try {
    const found = await prototypeHtmlPath(root, SPEC, "picker.html");
    assert.equal(found, fs.realpathSync(path.join(root, SPEC, "prototypes", "picker.html")));
    const refused = ["picker.md", "../../../secret.html", "missing.html", path.join(base, "secret.html"), "picker.html.exe", "", undefined];
    for (const name of refused) assert.equal(await prototypeHtmlPath(root, SPEC, name), null, String(name));
  } finally {
    clean(base);
  }
});

test("prototype files do not follow a link out of the project", async (t) => {
  const { base, root } = project({ [`${SPEC}/prototypes/picker.md`]: "# Picker\n" });
  try {
    try {
      fs.symlinkSync(path.join(base, "secret.md"), path.join(root, SPEC, "prototypes", "leak.md"));
      fs.symlinkSync(path.join(base, "secret.html"), path.join(root, SPEC, "prototypes", "leak.html"));
    } catch {
      return t.skip("symlinks are not allowed here");
    }
    assert.equal(await readPrototype(root, SPEC, "leak.md"), null);
    assert.equal(await prototypeHtmlPath(root, SPEC, "leak.html"), null);
    assert.deepEqual(
      (await listPrototypes(root, SPEC)).map((f) => f.name),
      ["picker.md"]
    );
  } finally {
    clean(base);
  }
});
