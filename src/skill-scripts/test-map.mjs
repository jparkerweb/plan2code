#!/usr/bin/env node
// test-map.mjs: read and write the project test map.
//
// The test map is one Markdown table under a `## Test map` heading in
// AGENTS.md, or in .agents-docs/AGENTS-test-map.md behind one link from that
// section: `| Area | Paths | Run | Shared |`. It tells pr-prep and test which
// checks cover which files. Parsing it, validating its globs and rewriting it
// without touching any other line are mechanical, so they live here; what goes
// in the rows is the agent's call.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT, fail, out, parseArgs, run, readText, writeIfChanged, eol } from "./common.mjs";
import { toPosix, unsupported } from "./glob.mjs";

const USAGE = `
test-map.mjs: the project test map (## Test map in AGENTS.md). JSON on stdout.

  node test-map.mjs read [--root <dir>]
      The table's rows: { area, paths[], run, shared }, read from AGENTS.md
      or from the one .agents-docs/ file its Test map section links to.
      found is false when AGENTS.md has no ## Test map heading. problems lists
      what could not be read (a missing column, an unsupported glob, a Shared
      value that is not yes or no, a link outside .agents-docs/).

  node test-map.mjs write --rows <file.json> [--dry-run] [--root <dir>]
      Write the table from a JSON array of { area, paths: [..], run, shared }.
      An existing table is replaced in place, a heading with no table gets
      one, and no heading appends a ## Test map section to AGENTS.md. Every
      line outside the table stays byte-identical.

Globs: ** (any folders), * and ? (within one folder), {a,b}. Anything else is
a problem and matches nothing.

Exit: 0 ok (check "found") · 2 bad arguments · 3 no AGENTS.md, or no --rows
file · 4 invalid rows · 5 refused: the section links outside .agents-docs/.
`;

const HEADING = /^## +test map\s*$/i;
const FENCE = /^\s*(```|~~~)/;
const COLUMNS = ["area", "paths", "run", "shared"];

/** Split text into lines, keeping track of which sit inside a code fence. */
function linesOf(text) {
  const lines = text.split(/\r?\n/);
  let inFence = false;
  const fenced = lines.map((l) => {
    if (FENCE.test(l)) {
      inFence = !inFence;
      return true;
    }
    return inFence;
  });
  return { lines, fenced };
}

/** The Test map section: heading line index and body [start, end) line range. */
function findSection(lines, fenced) {
  const at = lines.findIndex((l, i) => !fenced[i] && HEADING.test(l));
  if (at === -1) return null;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    if (!fenced[i] && /^#{1,2} /.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { heading: at, start: at + 1, end };
}

const isRow = (l) => /^\s*\|/.test(l);
const isSeparator = (l) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(l);

/** The first table between start and end, outside fences: [start, end) or null. */
function findTable(lines, fenced, start, end) {
  for (let i = start; i < end - 1; i++) {
    if (fenced[i] || !isRow(lines[i]) || !isSeparator(lines[i + 1])) continue;
    let j = i + 2;
    while (j < end && !fenced[j] && isRow(lines[j])) j++;
    return { start: i, end: j };
  }
  return null;
}

/** Cells of one table row; `\|` stays inside its cell as `|`. */
function cellsOf(line) {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && s[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (s[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += s[i];
  }
  cells.push(cur.trim());
  return cells;
}

const unquote = (s) => (s.length >= 2 && s.startsWith("`") && s.endsWith("`") ? s.slice(1, -1).trim() : s);

/** A Paths cell split on commas outside braces and backticks. */
function splitPaths(cell) {
  const parts = [];
  let cur = "";
  let depth = 0;
  let tick = false;
  for (const ch of cell) {
    if (ch === "`") tick = !tick;
    else if (!tick && ch === "{") depth++;
    else if (!tick && ch === "}") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0 && !tick) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => unquote(p.trim())).filter(Boolean);
}

/** Rows and problems from the table's lines. */
function parseTable(lines, table) {
  const problems = [];
  const header = cellsOf(lines[table.start]).map((c) => c.toLowerCase());
  const index = Object.fromEntries(COLUMNS.map((c) => [c, header.indexOf(c)]));
  const missing = COLUMNS.filter((c) => index[c] === -1);
  if (missing.length) {
    const names = missing.map((c) => c[0].toUpperCase() + c.slice(1));
    return { rows: [], problems: [`The test map table has no ${names.join(", ")} column${names.length > 1 ? "s" : ""}; no rows were read`] };
  }
  const rows = [];
  for (let i = table.start + 2; i < table.end; i++) {
    const cells = cellsOf(lines[i]);
    if (cells.every((c) => !c)) continue;
    const n = rows.length + 1;
    const area = cells[index.area] || "";
    const label = `Row ${n}${area ? ` (${area})` : ""}`;
    const paths = [];
    for (const glob of splitPaths(cells[index.paths] || "")) {
      const why = unsupported(glob);
      if (why) problems.push(`${label}: path "${glob}" was dropped: ${why}`);
      else paths.push(toPosix(glob));
    }
    const sharedCell = (cells[index.shared] || "").trim();
    const yes = /^yes$/i.test(sharedCell);
    if (!yes && !/^no$/i.test(sharedCell)) problems.push(`${label}: Shared is "${sharedCell}", not yes or no; read as no`);
    rows.push({ area, paths, run: unquote(cells[index.run] || ""), shared: yes });
  }
  return { rows, problems };
}

/**
 * The first relative .md link in the section body. `docs` is the path under
 * .agents-docs/ when it points there, else `outside` holds the target.
 */
function linkIn(lines, fenced, start, end) {
  for (let i = start; i < end; i++) {
    if (fenced[i]) continue;
    for (const m of lines[i].matchAll(/\]\(([^)\s]+)\)/g)) {
      const target = m[1].replace(/#.*$/, "");
      if (/^[a-z][a-z0-9+.-]*:/i.test(target) || !/\.md$/i.test(target)) continue;
      const norm = path.posix.normalize(toPosix(target));
      if (/^\.agents-docs\/[^/]+\.md$/i.test(norm)) return { docs: norm };
      return { outside: target };
    }
  }
  return null;
}

/**
 * The test map of the project at `root`. Never throws for a missing map:
 * `agentsMd` false means there is no AGENTS.md, `found` false no heading.
 * `file` is the absolute path the table lives in (or would be written to).
 */
export function readTestMap(root) {
  const agentsFile = path.join(root, "AGENTS.md");
  const text = readText(agentsFile);
  if (text === null) return { agentsMd: false, found: false, source: null, rows: [], problems: [] };
  const { lines, fenced } = linesOf(text);
  const section = findSection(lines, fenced);
  if (!section) return { agentsMd: true, found: false, source: null, rows: [], problems: [] };
  const link = linkIn(lines, fenced, section.start, section.end);
  if (link && link.outside) {
    return { agentsMd: true, found: true, source: "AGENTS.md", rows: [], linkOutside: link.outside, problems: [`The Test map section links to ${link.outside}, outside .agents-docs/; no table was read`] };
  }
  if (link && link.docs) {
    const file = path.join(root, link.docs);
    const linked = readText(file);
    if (linked === null) return { agentsMd: true, found: true, source: link.docs, file, rows: [], problems: [`The Test map section links to ${link.docs}, which does not exist`] };
    const l = linesOf(linked);
    const table = findTable(l.lines, l.fenced, 0, l.lines.length);
    if (!table) return { agentsMd: true, found: true, source: link.docs, file, rows: [], problems: [`${link.docs} has no table`] };
    return { agentsMd: true, found: true, source: link.docs, file, ...parseTable(l.lines, table) };
  }
  const table = findTable(lines, fenced, section.start, section.end);
  if (!table) return { agentsMd: true, found: true, source: "AGENTS.md", file: agentsFile, rows: [], problems: ["The Test map section has no table"] };
  return { agentsMd: true, found: true, source: "AGENTS.md", file: agentsFile, ...parseTable(lines, table) };
}

const cell = (s) => String(s).replace(/\|/g, "\\|");

/** The table's lines for `rows`. */
export function renderTable(rows) {
  return [
    "| Area | Paths | Run | Shared |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${cell(r.area)} | ${r.paths.map((p) => `\`${cell(p)}\``).join(", ")} | \`${cell(r.run)}\` | ${r.shared ? "yes" : "no"} |`),
  ];
}

function validRows(data) {
  if (!Array.isArray(data)) fail(EXIT.INVALID, "invalid-rows", "The rows file must hold a JSON array of { area, paths, run, shared }.", "Fix the rows file and run write again.");
  return data.map((r, i) => {
    const bad = (what) => fail(EXIT.INVALID, "invalid-rows", `Row ${i} ${what}.`, "Fix the rows file and run write again.", { row: i });
    if (!r || typeof r !== "object") bad("is not an object");
    if (typeof r.area !== "string" || !r.area.trim()) bad("has no area");
    if (typeof r.run !== "string" || !r.run.trim()) bad("has no run command");
    if (!Array.isArray(r.paths) || !r.paths.length || r.paths.some((p) => typeof p !== "string" || !p.trim())) bad("has no paths");
    return { area: r.area.trim(), paths: r.paths.map((p) => toPosix(p.trim())), run: r.run.trim(), shared: r.shared === true };
  });
}

// Insert `table` into `lines` at index `at`, with a blank line before it and
// one after it unless one is already there.
function insertAt(lines, at, table) {
  const after = at < lines.length && lines[at] !== "" ? [""] : [];
  return [...lines.slice(0, at), "", ...table, ...after, ...lines.slice(at)];
}

/** The new text of a file whose Test map section (or whole body) gets `table`. */
function placeIn(text, table, { linked }) {
  const nl = eol(text);
  const { lines, fenced } = linesOf(text);
  if (linked) {
    const t = findTable(lines, fenced, 0, lines.length);
    if (t) return [...lines.slice(0, t.start), ...table, ...lines.slice(t.end)].join(nl);
    const trimmed = text.replace(/(\r?\n)*$/, "");
    return `${trimmed}${nl}${nl}${table.join(nl)}${nl}`;
  }
  const section = findSection(lines, fenced);
  if (!section) {
    const lead = text === "" || text.endsWith("\n") ? "" : nl;
    return `${text}${lead}${nl}## Test map${nl}${nl}${table.join(nl)}${nl}`;
  }
  const t = findTable(lines, fenced, section.start, section.end);
  if (t) return [...lines.slice(0, t.start), ...table, ...lines.slice(t.end)].join(nl);
  // After the heading's first paragraph, or right under the heading.
  let i = section.start;
  while (i < section.end && lines[i].trim() === "") i++;
  let at = section.start;
  if (i < section.end && !fenced[i] && !/^#/.test(lines[i])) {
    while (i < section.end && lines[i].trim() !== "") i++;
    at = i;
  }
  return insertAt(lines, at, table).join(nl);
}

function write(root, rowsFile, dryRun) {
  const raw = readText(path.resolve(rowsFile));
  if (raw === null) fail(EXIT.NOT_FOUND, "no-rows-file", `No rows file at ${rowsFile}.`, "Write the rows as a JSON array to a file and pass its path to --rows.");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    fail(EXIT.INVALID, "invalid-rows", `The rows file is not JSON: ${err.message}`, "Fix the rows file and run write again.");
  }
  const rows = validRows(data);
  const map = readTestMap(root);
  if (!map.agentsMd) fail(EXIT.NOT_FOUND, "no-agents-md", `No AGENTS.md in ${root}.`, "Create AGENTS.md first (Init), then write the test map.");
  if (map.linkOutside) fail(EXIT.REFUSED, "link-outside", `The Test map section links to ${map.linkOutside}, outside .agents-docs/.`, "Point the link at .agents-docs/AGENTS-test-map.md, or remove it, then write again.");
  const table = renderTable(rows);
  const linked = map.source && map.source !== "AGENTS.md";
  let file;
  let next;
  if (linked) {
    file = map.file;
    const current = readText(file);
    next =
      current === null
        ? ["# Test map", "", "> Part of [AGENTS.md](../AGENTS.md): which checks cover which files.", "", ...table, ""].join(eol(readText(path.join(root, "AGENTS.md")) || "\n"))
        : placeIn(current, table, { linked: true });
  } else {
    file = path.join(root, "AGENTS.md");
    next = placeIn(readText(file), table, { linked: false });
  }
  const source = linked ? map.source : "AGENTS.md";
  const written = dryRun ? false : writeIfChanged(file, next);
  return { ok: true, written, source, dryRun: !!dryRun };
}

async function main(argv) {
  const args = parseArgs(argv, { values: ["root", "rows"], booleans: ["dry-run"] });
  const root = path.resolve(args.root || ".");
  const cmd = args._[0];
  if (cmd === "read") {
    const map = readTestMap(root);
    if (!map.agentsMd) fail(EXIT.NOT_FOUND, "no-agents-md", `No AGENTS.md in ${root}.`, "There is no test map to read; offer to create AGENTS.md (Init).");
    out({ ok: true, found: map.found, source: map.source, rows: map.rows, problems: map.problems });
    return;
  }
  if (cmd === "write") {
    if (!args.rows) fail(EXIT.USAGE, "missing-rows", "write needs --rows <file.json>.", "Run with --help for usage.");
    out(write(root, args.rows, args["dry-run"]));
    return;
  }
  fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: read, write. Run with --help.");
}

// Run as a script; imported (by test-match.mjs), do nothing.
const isMain = (() => {
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
})();
if (isMain) run(USAGE, main);
