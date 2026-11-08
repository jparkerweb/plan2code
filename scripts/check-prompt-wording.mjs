// Fails when a built prompt names an agent product's tool by its product name.
//
// Prompts are read by many agents, and each one calls the same tool something
// else. Prompt text says what to do ("ask with the question tool", "list the
// folder") and never what one product's tool is called. This reads every
// Markdown file in the built skills/ tree, so run it after
// `node install.js --build-skills`.
// Usage: node scripts/check-prompt-wording.mjs [skillsDir]  (defaults to ./skills)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Case-sensitive on purpose: "glob" and "grep" in lower case are ordinary words
// and command names, "Glob" and "Grep" as tool names are what this catches.
export const BANNED = [
  "AskUserQuestion",
  "Glob",
  "Grep",
  "TodoWrite",
  "WebFetch",
  "WebSearch",
  "NotebookEdit",
  "Read tool",
  "Write tool",
  "Edit tool",
  "Bash tool",
  "ask_user_question",
];

const PATTERN = new RegExp(`(?<![A-Za-z0-9_])(${BANNED.join("|")})(?![A-Za-z0-9_])`);

function* markdownFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* markdownFiles(full);
    else if (entry.name.endsWith(".md")) yield full;
  }
}

// Returns [{ file, line, name }] for every banned name found under dir.
export function findBanned(dir) {
  const hits = [];
  for (const file of markdownFiles(dir)) {
    fs.readFileSync(file, "utf8")
      .split("\n")
      .forEach((text, i) => {
        const m = PATTERN.exec(text);
        if (m) hits.push({ file: path.relative(dir, file).split(path.sep).join("/"), line: i + 1, name: m[1] });
      });
  }
  return hits;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const dir = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "skills");
  if (!fs.existsSync(dir)) {
    console.error(`  FAIL ${dir} does not exist. Run: node install.js --build-skills`);
    process.exit(1);
  }
  const hits = findBanned(dir);
  if (hits.length) {
    for (const h of hits) console.error(`  FAIL ${h.file}:${h.line} names a product tool: ${h.name}`);
    console.error("  Say what to do in neutral words (\"the question tool\", \"list the folder\").");
    process.exit(1);
  }
  console.log("Built prompts name no product tool.");
}
