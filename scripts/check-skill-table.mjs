// Check the dashboard's "What each skill reads and writes" table against the
// skills it describes.
//
// The table is what the dashboard and the Ask tab treat as ground truth for a
// skill's files. Every backticked name in a row must appear in that skill's own
// prompt or its references, so a rename in a skill fails here instead of the
// table quietly going stale. `<placeholder>` segments match any placeholder,
// so `PLAN-DRAFT-<date>.md` accepts the skill's `PLAN-DRAFT-<YYYYMMDD>.md`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SRC = path.join(ROOT, "src");
const HEADING = "## What each skill reads and writes";

function readTree(dir) {
  if (!fs.existsSync(dir)) return "";
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return readTree(full);
      return entry.name.endsWith(".md") ? fs.readFileSync(full, "utf8") : "";
    })
    .join("\n");
}

function skillCorpus(skill) {
  const file = path.join(SRC, `plan2code-${skill}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8") + "\n" + readTree(path.join(SRC, `plan2code-${skill}-references`));
}

// "3-implement(-review)" names both 3-implement and 3-implement-review.
function expandSkills(cell) {
  const optional = cell.match(/^(.*)\((.+)\)$/);
  return optional ? [optional[1], optional[1] + optional[2]] : [cell];
}

function tokenPattern(token) {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/<[^>]+>/g, "<[^>]+>"));
}

function mentions(corpus, token) {
  if (tokenPattern(token).test(corpus)) return true;
  const leaf = token.slice(token.lastIndexOf("/") + 1);
  return leaf !== "" && leaf !== token && tokenPattern(leaf).test(corpus);
}

const prompt = fs.readFileSync(path.join(SRC, "plan2code.md"), "utf8");
const start = prompt.indexOf(HEADING);
if (start === -1) {
  console.error(`  FAIL src/plan2code.md has no "${HEADING}" section.`);
  process.exit(1);
}
const section = prompt.slice(start + HEADING.length).split(/\n## /)[0];
const rows = section
  .split("\n")
  .filter((line) => line.startsWith("|") && !/^\|\s*(skill|---)/.test(line))
  .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()));

if (rows.length === 0) {
  console.error(`  FAIL "${HEADING}" has no table rows.`);
  process.exit(1);
}

let bad = 0;
for (const [skillCell, ...cells] of rows) {
  const skills = expandSkills(skillCell);
  const corpora = skills.map(skillCorpus);
  if (corpora.some((corpus) => corpus === null)) {
    bad++;
    console.error(`  FAIL ${skillCell}: no src/plan2code-<skill>.md for ${skills.join(" / ")}`);
    continue;
  }
  const corpus = corpora.join("\n");
  const tokens = cells.join(" ").match(/`[^`]+`/g) ?? [];
  const missing = tokens.map((t) => t.slice(1, -1)).filter((token) => !mentions(corpus, token));
  if (missing.length) {
    bad++;
    console.error(`  FAIL ${skillCell}: not in the skill's source: ${missing.join(", ")}`);
  } else {
    console.log(`  ok  ${skillCell} (${tokens.length} name(s))`);
  }
}
if (bad) {
  console.error(`${bad} row(s) of "${HEADING}" disagree with their skill.`);
  process.exit(1);
}
