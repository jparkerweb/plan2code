// The project writes US English: docs, comments, prompts, UI text, test names.
// A rule in prose was missed once ("colours" slipped into a reply and ~100
// files carried UK spellings), so this keeps it.
// Run with: node --test scripts/test-us-english.mjs

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SELF = "scripts/test-us-english.mjs";

// Tracked text files. Vendored code stays as shipped, and binaries have no words.
const SKIP = /(^|\/)(node_modules|dist|target|vendor)\/|package-lock\.json$|\.(png|jpe?g|gif|ico|icns|mp3|wav|woff2?|ttf|lock)$/i;

// UK spellings with a clear US form. Whole words, any case.
const UK = new RegExp(
  "\\b(" +
    [
      "colour\\w*", "grey\\w*", "behaviour\\w*", "centre[sd]?", "centred", "cancell(?:ed|ing)", "labell(?:ed|ing)",
      "relabell\\w*", "travell(?:ed|ing|er)", "judgement", "neighbour\\w*", "honour\\w*", "favour\\w*", "licence",
      "defence", "offence", "whilst", "amongst", "artefacts?", "catalogue[sd]?",
      "analys(?:e|ed|ing)", "(?:organ|recogn|normal|summar|sanit|optim|final|initial|serial|custom|priorit|minim|maxim|util|canonical|material|stabil|anonym|synchron|standard|categor|author|visual|emphas|apolog|special|character|central|random|token|local|capital|critic|memor|synthes|real)is(?:e|es|ed|ing|ation|ations|er|ers|able)",
    ].join("|") +
    ")\\b",
  "gi"
);

// Names that keep the UK spelling because they are data contracts read in
// several places (see Code Style in .agents-docs/AGENTS-code-style.md), plus
// HTML's own attribute. Removed before the scan.
const CONTRACTS = [
  /aria-labelledby/g,
  /\.greyed\b/g,
  /\bgreyed(?=\s*:)/g,
  /\bconst greyed\b/g,
  /\bgreyed(?=, card)/g,
  /^\/\/\s+greyed\b/gm,
  /`greyed`/g,
  /\bcancelled(?=\s*:)/g,
  /\.cancelled\b/g,
  /"cancelled"/g,
  /\bconst cancelled\b/g,
  /\bcancelled(?=\.[a-z])/g,
];

function trackedTextFiles() {
  const r = spawnSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout.split("\n").filter((f) => f && f !== SELF && !SKIP.test(f));
}

test("tracked text is written in US English", () => {
  const found = [];
  for (const rel of trackedTextFiles()) {
    let text;
    try {
      text = fs.readFileSync(path.join(ROOT, rel), "utf8");
    } catch {
      continue; // listed but deleted in the working tree
    }
    for (const re of CONTRACTS) text = text.replace(re, "");
    text.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(UK)) found.push(`${rel}:${i + 1}: ${m[0]}`);
    });
  }
  assert.deepEqual(found, [], `UK spellings (use the US form, e.g. color, gray, behavior, canceled, -ize):\n${found.join("\n")}`);
});
