// Fails when the console opening paragraph of a skill drifts from the shared one.
//
// Eighteen skills open with the same "web console or terminal?" paragraph. Only
// the workflow name, the notes file and a few skill-specific clauses may differ;
// the shared sentences below must read the same in every one, so a fix to one
// skill's opening cannot silently skip the others. Matching ignores case and
// punctuation (dashes, colons, commas, brackets), never the words.
// Usage: node scripts/check-console-openings.mjs [srcDir]  (defaults to ./src)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Shared sentences. `{w}` is the workflow name. A sentence a skill states in its
// own words on purpose is listed in EXEMPT with the reason.
export const SHARED = [
  { id: "first", text: "The FIRST thing you do, before anything else in this file" },
  { id: "ask", text: "**web console** (browser page, suggested) or **terminal**?" },
  { id: "run", text: 'run `node "<D>/console.mjs" open --workflow {w}` before reading' },
  { id: "dir", text: "<D>: references/web-console/ beside this SKILL.md" },
  { id: "dirfile", text: "or the dir in ~/.plan2code/console/console-dir" },
  { id: "read", text: "then read <D>/console.md" },
  { id: "switch", text: "Switchable anytime." },
  { id: "web", text: "If the argument already says which (`--web` or `Use the web console for this session.`), take it and do not ask; drop the flag." },
  { id: "dash", text: "Launched by the dashboard? Its session is already open: resume it (console-launches.md)" },
];

export const EXEMPT = {
  // Implement + Review defers to Implementation Mode's own Interface question.
  "plan2code-3-implement-review": { ask: "defers to Implementation Mode's Interface question", run: "the question is Implementation Mode's" , switch: "Implementation Mode's Interface section says it" },
  // Git runs an instruction in the argument in the terminal at once and has its own hand-off lines.
  "plan2code-git": { dash: "also resumes from Commit it now and the Changelog hand-off", first: "opens with the run-at-once rule for an argument" },
};

export function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[\u2014\u2013:;,()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// The paragraph (one line) holding the `open --workflow` command, or null.
export function openingOf(markdown) {
  return markdown.split("\n").find((l) => l.includes('console.mjs" open --workflow')) ?? null;
}

export function workflowOf(skill) {
  return skill.replace(/^plan2code-/, "").replace(/^\d+b?-/, "");
}

// Returns one message per drift found under srcDir.
export function check(srcDir) {
  const problems = [];
  const notesDir = path.join(srcDir, "web-console", "notes");
  const files = fs
    .readdirSync(srcDir)
    .filter((f) => /^plan2code-.+\.md$/.test(f))
    .sort();
  let seen = 0;
  for (const file of files) {
    const skill = file.replace(/\.md$/, "");
    const opening = openingOf(fs.readFileSync(path.join(srcDir, file), "utf8"));
    if (!opening) continue; // the dashboard opens its own way
    seen++;
    const w = workflowOf(skill);
    const norm = normalize(opening);
    const exempt = EXEMPT[skill] ?? {};
    for (const s of SHARED) {
      if (exempt[s.id]) continue;
      if (!norm.includes(normalize(s.text.replace("{w}", w)))) problems.push(`${file}: shared sentence "${s.id}" differs or is missing (expected: ${s.text.replace("{w}", w)})`);
    }
    const flows = [...opening.matchAll(/--workflow ([a-z-]+)/g)].map((m) => m[1]);
    if (!flows.includes(w) && !exempt.run) problems.push(`${file}: opens --workflow ${flows.join(", ")} instead of ${w}`);
    const note = opening.match(/<D>\/notes\/([a-z-]+)\.md/);
    if (!note) problems.push(`${file}: names no <D>/notes/<workflow>.md file`);
    else if (!fs.existsSync(path.join(notesDir, `${note[1]}.md`))) problems.push(`${file}: notes file ${note[1]}.md is not in src/web-console/notes/`);
  }
  if (seen !== 18) problems.push(`expected 18 skills with a console opening, found ${seen}`);
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const problems = check(process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, "src"));
  if (problems.length) {
    for (const p of problems) console.error(`  FAIL ${p}`);
    process.exit(1);
  }
  console.log("All 18 console openings share their sentences.");
}
