#!/usr/bin/env node
// Builds the one vendored CodeMirror file the Notebook's live-preview editor
// imports. Dev-only: lives in scripts/ so it never ships inside a skill.
//
//   node scripts/vendor-codemirror.mjs                 rebuild from the lock file
//   node scripts/vendor-codemirror.mjs --update-lock   after changing a version below
//
// The console has no dependencies and no build step for users, so CodeMirror 6
// is bundled once, here, into src/web-console/public/vendor/codemirror.esm.js
// (Markdown only, minified, one ES module). The packages and esbuild are
// installed into a throwaway folder under the OS temp directory, never into
// the repo. Only the six packages below are named; everything they pull in
// (@lezer/*, style-mod, w3c-keyname, crelt) is pinned by
// scripts/vendor-codemirror-lock.json, installed with npm ci, so the same
// lock gives the same bytes. Needs Node 18+, npm and network access.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "src", "web-console", "public", "vendor", "codemirror.esm.js");
const LOCK = path.join(ROOT, "scripts", "vendor-codemirror-lock.json");

export const VERSIONS = Object.freeze({
  esbuild: "0.28.2",
  "@codemirror/state": "6.7.6",
  "@codemirror/view": "6.43.15",
  "@codemirror/language": "6.13.1",
  "@codemirror/commands": "6.11.1",
  "@codemirror/lang-markdown": "6.5.2",
});

export const HEADER =
  "/* CodeMirror 6 (state, view, language, commands, lang-markdown), MIT licence, (c) Marijn Haverbeke and others.\n" +
  " * https://codemirror.net/ . Bundled by scripts/vendor-codemirror.mjs; do not edit by hand.\n" +
  " * Versions: " +
  Object.entries(VERSIONS)
    .filter(([name]) => name !== "esbuild")
    .map(([name, version]) => name + " " + version)
    .join(", ") +
  " */\n";

// What the page may import: exactly what notepad-editor.js uses, since an
// entry export is never tree-shaken. indentWithTab is left out on purpose: it
// would trap the Tab key and keyboard users could not leave the editor.
export const ENTRY = `export { Compartment, EditorState } from "@codemirror/state";
export { Decoration, EditorView, ViewPlugin, WidgetType, keymap } from "@codemirror/view";
export { markdown, markdownLanguage } from "@codemirror/lang-markdown";
export { syntaxTree } from "@codemirror/language";
export { defaultKeymap, history, historyKeymap, redo } from "@codemirror/commands";
`;

// npm is a .cmd file on Windows, which only a shell can start; node never needs one
// (its path may hold spaces).
function run(cmd, args, cwd) {
  const res = spawnSync(cmd, args, { cwd, encoding: "utf8", shell: process.platform === "win32" && cmd === "npm" });
  if (res.status !== 0) {
    process.stderr.write((res.stdout || "") + (res.stderr || ""));
    throw new Error(`${cmd} ${args.join(" ")} failed (${res.status})`);
  }
  return res.stdout;
}

export function build({ updateLock = false } = {}) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "plan2code-codemirror-"));
  try {
    fs.writeFileSync(path.join(work, "package.json"), JSON.stringify({ name: "cm-build", private: true, type: "module", dependencies: VERSIONS }));
    if (updateLock || !fs.existsSync(LOCK)) {
      run("npm", ["install", "--no-audit", "--no-fund", "--ignore-scripts", "--package-lock-only"], work);
      fs.copyFileSync(path.join(work, "package-lock.json"), LOCK);
    } else {
      fs.copyFileSync(LOCK, path.join(work, "package-lock.json"));
    }
    run("npm", ["ci", "--no-audit", "--no-fund", "--ignore-scripts"], work);
    fs.writeFileSync(path.join(work, "entry.js"), ENTRY);
    const esbuild = path.join(work, "node_modules", "esbuild", "bin", "esbuild");
    run(process.execPath, [esbuild, "entry.js", "--bundle", "--format=esm", "--minify", "--target=es2022", "--legal-comments=none", "--outfile=out.js"], work);
    const body = fs.readFileSync(path.join(work, "out.js"), "utf8");
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, HEADER + body);
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  const bytes = fs.readFileSync(OUT);
  return { file: path.relative(ROOT, OUT), bytes: bytes.length, sha256: crypto.createHash("sha256").update(bytes).digest("hex") };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(build({ updateLock: process.argv.includes("--update-lock") }), null, 2));
}
