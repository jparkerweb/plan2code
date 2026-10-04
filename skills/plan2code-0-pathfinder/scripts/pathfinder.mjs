#!/usr/bin/env node
// pathfinder.mjs: the mechanical half of Pathfinder's map.
//
// Pathfinder's question files are ground truth and map.md is an index rebuilt
// from them. Everything about that index has one correct answer: which marker
// each row carries, which questions are on the frontier, which are blocked or
// stranded, what NN comes next, what the Trail Footer looks like, which
// clearing checks pass, which dates fall in a brief's range. This script
// computes all of it and performs the bookkeeping writes (reconcile, claim,
// resolve, rule out), so the agent spends its attention on the decisions.
//
// It never writes an ## Answer, never decides a question, never scores
// confidence. Those stay with the agent and the human.

import fs from "node:fs";
import path from "node:path";
import { EXIT, fail, out, parseArgs, run, readText, isDir, rel, eol, isoDate, stamp, now } from "./common.mjs";

const USAGE = `
pathfinder.mjs: Pathfinder map bookkeeping. JSON on stdout (trail: --text prints the footer itself).
<map> is specs/<idea>/pathfinder, specs/<idea>, <idea>, or a path to map.md.

  node pathfinder.mjs reconcile <map> [--dry-run]
      Work Step 2. Files win: an ## Answer under a non-resolved State becomes
      resolved; a missing Resolved: date is backfilled from Claimed: (today if
      none); a claim with no answer is reset to open; every map marker is
      rebuilt from the files (missing rows added, rows for deleted files and
      duplicate rows dropped); **Next NN:** keeps the high-water mark. Lists
      research questions to re-fire (no Research complete line). Run it at
      session start or with nothing claimed.

  node pathfinder.mjs frontier <map>
      Read-only: the frontier (open, unclaimed, unblocked, lowest NN first),
      the open claim, blocked questions with their blockers, stranded
      questions (blocked by something out of scope), next NN, counts, drift.

  node pathfinder.mjs claim <map> <NN> [--dry-run]
      Work Step 4: State claimed + Claimed: now in the file, then the map row
      [/]. Refuses a question that is not open, is blocked, or while another
      claim is open.

  node pathfinder.mjs resolve <map> <NN> [--dry-run]
      Work Step 7, after you appended ## Answer (ending in a **Gist:** line):
      State resolved + Resolved: today, the map row [x] with gist and date,
      every other marker rebuilt (reports what just unblocked), Updated bumped.

  node pathfinder.mjs rule-out <map> <NN> --reason "<why>" [--dry-run]
      State out-of-scope (no Answer), a reason line under ## Question, the map
      row [-], one line in ## Out of scope. Reports newly stranded questions.

  --dry-run on a write command works everything out and writes nothing; the
  JSON says dryRun and mapWritten. The read-only commands write nothing anyway.

  node pathfinder.mjs trail <map> --form A|B|C [--item "<probe>" ...] [--text]
      The Trail Footer, built from the files: heading, path, legend, named
      legend, confidence line, then Part 2. Form B needs 1-3 --item. Form C
      also returns the menu options (takeable questions) for the question tool;
      pass --resolved-this-session <N> and --heavy (a contested or Locked:
      yes decision) so it can recommend a question or Start fresh.

  node pathfinder.mjs gate <map>
      The Clearing Gate's mechanical checks and the handoff preflight: zero
      [ ] [/] [!] rows, empty fog, a Gist on every resolved answer, an existing
      PLAN-DRAFT to update in place, the four hard caps, the map's scores >= 18.
      Lists what stays your judgment.

  node pathfinder.mjs lint <map>
      Standing rules: loop tokens anywhere under specs/<idea>/, checkboxes or
      METRICS_JSON in question files, reserved names inside pathfinder/, the
      six schema lines, NN rules, Blocked by: targets and cycles, the banner,
      and metrics-scraper bait (collector patterns) in map.md, briefs and a
      pathfinder-written PLAN-DRAFT.

  node pathfinder.mjs brief-data <map> [--range today|this-week|full|since:<YYYY-MM-DD>|<YYYY-MM-DD>..<YYYY-MM-DD>]
      Everything a brief is built from, filtered by Resolved: date, plus the
      file path to write. Run reconcile first (it reports drift if you did not).

Exit: 0 ok · 2 bad arguments · 3 map / question not found · 4 a check failed
or a file cannot be parsed · 5 refused (rule broken).
`;

const BANNER = "> Pathfinder planning note - decisions, not implementation work. Archive with the spec; do not delete.";
const SCHEMA_KEYS = ["Type", "State", "Blocked by", "Claimed", "Resolved", "Locked"];
const TYPES = ["grill · HITL", "research · AFK", "sketch · HITL", "legwork · HITL", "legwork · AFK"];
const STATES = ["open", "claimed", "resolved", "out-of-scope"];
const GLYPH = { x: "●", "/": "◉", " ": "○", "!": "⊘", "-": "⊝" };
const LOOP_TOKENS = /\b(TASK_COMPLETE|PHASE_COMPLETE|ALL_TASKS_COMPLETE|IMPLEMENTATION_COMPLETE|SPEC_COMPLETE|WORK_COMPLETE)\b/;
// The metrics collector's own scrape patterns (plan2code-metrics/src/collector.ts).
const SCRAPE = [
  { name: "overall confidence with %", re: /(?:Overall|Final|Total)?\s*\**[Cc]onfidence\**[:\s*]+(\d{1,3})%/ },
  { name: "confidence table cell", re: /[|]\s*[Cc]onfidence\s*[|]\s*(\d{1,3})/ },
  { name: "bare Requirements + number", re: /[Rr]equirements?[:\s|]+(\d{1,2})/ },
  { name: "bare Feasibility + number", re: /[Ff]easibility[:\s|]+(\d{1,2})/ },
  { name: "bare Integration + number", re: /[Ii]ntegration[:\s|]+(\d{1,2})/ },
  { name: "bare Risk + number", re: /[Rr]isk[:\s|]+(\d{1,2})/ },
];
const DIMENSIONS = [
  { key: "Requirements-clarity", word: "Requirements" },
  { key: "Feasibility-technical", word: "Feasibility" },
  { key: "Integration-points", word: "Integration" },
  { key: "Risk-assessment", word: "Risk" },
];

/* ------------------------------------------------------------- locating */

function locate(root, arg) {
  if (!arg) fail(EXIT.USAGE, "missing-map", "Name the map: specs/<idea>/pathfinder, specs/<idea>, or <idea>.", "Example: node pathfinder.mjs frontier specs/audit-export/pathfinder");
  let p = arg.replace(/\\/g, "/").replace(/\/+$/, "");
  if (/\/map\.md$/i.test(p)) p = p.replace(/\/map\.md$/i, "");
  let abs = path.isAbsolute(p) ? p : p.includes("/") ? path.join(root, p) : path.join(root, "specs", p);
  if (path.basename(abs) !== "pathfinder") abs = path.join(abs, "pathfinder");
  const ideaDir = path.dirname(abs);
  if (!isDir(ideaDir)) fail(EXIT.NOT_FOUND, "no-idea", `No idea folder at ${rel(root, ideaDir)}.`, "Check the idea name with `ls specs/` (shell, not Glob: specs/ is gitignored).");
  return { root, pf: abs, ideaDir, idea: path.basename(ideaDir), mapPath: path.join(abs, "map.md"), qDir: path.join(abs, "questions"), relPf: rel(root, abs) };
}

function requireMap(loc) {
  const text = readText(loc.mapPath);
  if (text === null) fail(EXIT.NOT_FOUND, "no-map", `${loc.relPf}/map.md does not exist.`, "No map yet means Chart Step 0 (Intent Gate); Chart Step 5 writes map.md.");
  return text;
}

/* -------------------------------------------------------------- parsing */

/**
 * "## Heading" -> body text (until the next ## heading). Headings inside a
 * fenced code block are content, not structure: a paper sketch in ## Evidence
 * may well quote a "## Answer". The first occurrence of a heading wins.
 */
function sections(text) {
  const map = new Map();
  const hits = [];
  let fence = null;
  let offset = 0;
  for (const line of text.split("\n")) {
    const f = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
    } else if (!fence) {
      const h = line.match(/^## +(.+?)\s*$/);
      if (h) hits.push({ index: offset, length: line.length, name: h[1].trim() });
    }
    offset += line.length + 1;
  }
  hits.forEach((h, i) => {
    const start = h.index + h.length;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    const key = h.name.toLowerCase();
    if (!map.has(key)) map.set(key, { heading: h.name, start: h.index, bodyStart: start, end, body: text.slice(start, end) });
  });
  return map;
}

function stripComments(s) {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

function hasContent(sec) {
  return !!sec && stripComments(sec.body).trim().length > 0;
}

function parseGist(answerBody) {
  const lines = answerBody.split(/\r?\n/);
  const i = lines.findIndex((l) => /^\s*\*\*Gist:\*\*/.test(l));
  if (i === -1) return null;
  const parts = [lines[i].replace(/^\s*\*\*Gist:\*\*\s*/, "")];
  for (let j = i + 1; j < lines.length && lines[j].trim() && !/^\s*(\*\*|#|[-*] )/.test(lines[j]); j++) parts.push(lines[j].trim());
  return parts.join(" ").replace(/\s+/g, " ").trim() || null;
}

// "02, 04" -> ["02", "04"]. Only the leading list of numbers counts, so a
// trailing note ("02 (needs the Phase 2 answer)") adds nothing; duplicates drop.
function parseBlockers(v) {
  if (!v || /^none$/i.test(v.trim())) return [];
  const lead = (v.match(/^[\s\d,]+/) || [""])[0];
  return [...new Set((lead.match(/\d+/g) || []).map((n) => n.padStart(2, "0")))];
}

function parseQuestion(file, text) {
  // NN is zero-padded wherever it is compared (findQ, Blocked by:), so a
  // "1-export.md" is question 01, not a question nobody can name (lint flags it).
  const rawNN = path.basename(file).match(/^(\d+)-/)[1];
  const nn = rawNN.padStart(2, "0");
  const firstSection = text.search(/^## /m);
  const header = firstSection === -1 ? text : text.slice(0, firstSection);
  const fields = {};
  for (const line of header.split(/\r?\n/)) {
    const m = line.match(/^(Type|State|Blocked by|Claimed|Resolved|Locked):\s*(.*?)\s*$/);
    if (m && !(m[1] in fields)) fields[m[1]] = m[2];
  }
  const secs = sections(text);
  const answer = secs.get("answer");
  const evidence = secs.get("evidence");
  const question = secs.get("question");
  const name = ((text.match(/^# +(.+?)\s*$/m) || [])[1] || path.basename(file, ".md")).trim();
  const type = fields.Type || null;
  return {
    nn,
    rawNN,
    file: path.basename(file),
    name,
    fields,
    type,
    kind: type ? type.split("·")[0].trim().toLowerCase() : null,
    state: (fields.State || "").toLowerCase() || null,
    blockedBy: parseBlockers(fields["Blocked by"]),
    claimed: fields.Claimed && !/^none$/i.test(fields.Claimed) ? fields.Claimed : null,
    resolved: fields.Resolved && !/^none$/i.test(fields.Resolved) ? fields.Resolved : null,
    locked: /^yes$/i.test(fields.Locked || ""),
    hasAnswer: hasContent(answer),
    answerBody: answer ? answer.body : "",
    gist: answer ? parseGist(answer.body) : null,
    // Consequences under any of the names the playbooks use: a grill's
    // "Consequences", a research answer's "What this implies", or a stated
    // "breaks if reversed" for a locked decision.
    hasConsequences: answer ? /\*\*(Consequences|What this implies)\b|^#{2,6}\s*(Consequences|What this implies)\b|^\s*Consequences\s*[:—-]|\bif (this is |it is )?reversed\b|breaks if reversed/im.test(answer.body) : false,
    hasEvidence: hasContent(evidence),
    researchComplete: evidence ? (evidence.body.match(/\*\*Research complete:\*\*\s*(\d{4}-\d{2}-\d{2})/) || [])[1] || null : null,
    questionText: question ? stripComments(question.body).trim() : "",
    banner: text.trimStart().startsWith(BANNER),
  };
}

function loadQuestions(loc) {
  if (!isDir(loc.qDir)) return [];
  return fs
    .readdirSync(loc.qDir)
    .filter((n) => /^\d+-.*\.md$/i.test(n))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b))
    .map((n) => {
      const full = path.join(loc.qDir, n);
      return { ...parseQuestion(full, readText(full) || ""), path: full };
    });
}

// The name is non-greedy and anchored on the link, so a name with a "]" in it
// ("Retention [legal] hold") still parses back to the row rowFor wrote.
const ROW_RE = /^\s*[-*] \[(.)\]\s*\[(.+?)\]\(\.?\/?questions\/([^)\s]+)\)(.*)$/;
const ROW_START = /^\s*[-*] \[.\]/;
const CONTINUATION = /^\s{2,}\S/;
const LINK_DONE = /\]\(\.?\/?questions\/[^)\s]*\)/;
// An indented line that opens its own item: an author's sub-bullet or note,
// never a wrapped piece of the row.
const OWN_ITEM = /^\s*([-*+] |\d+[.)] |>|<!--)/;

/**
 * Checklist rows as blocks: the row line plus its wrapped, indented
 * continuation lines (a long name or gist wraps, sometimes inside the link),
 * then any indented lines the author hung under it (`extra`: sub-bullets,
 * notes), which belong to the row but are never regenerated. Once the link is
 * finished, an indented line that opens its own item starts `extra`; so does
 * everything after it. The row part is matched as one joined line.
 * Returns [{ start, lines, rowLines, extra, m }]; `lines` is the whole block.
 */
function rowBlocks(lines, from, to) {
  const blocks = [];
  for (let i = from; i < to; i++) {
    if (!ROW_START.test(lines[i])) continue;
    const start = i;
    const rowLines = [lines[i]];
    const extra = [];
    const joined = () => rowLines.map((l, k) => (k ? l.trim() : l)).join(" ");
    while (i + 1 < to && CONTINUATION.test(lines[i + 1]) && !ROW_START.test(lines[i + 1])) {
      const next = lines[++i];
      if (!extra.length && (!LINK_DONE.test(joined()) || !OWN_ITEM.test(next))) rowLines.push(next);
      else extra.push(next);
    }
    blocks.push({ start, lines: [...rowLines, ...extra], rowLines, extra, m: joined().match(ROW_RE) });
  }
  return blocks;
}

function checklistRange(lines) {
  const h = lines.findIndex((l) => /^## +Question Checklist\s*$/i.test(l));
  if (h === -1) return null;
  let end = lines.findIndex((l, i) => i > h && /^## /.test(l));
  if (end === -1) end = lines.length;
  return { head: h, end };
}

function parseMap(text) {
  const secs = sections(text);
  const field = (k) => ((text.match(new RegExp(`^\\*\\*${k}:\\*\\*\\s*(.+?)\\s*$`, "m")) || [])[1] || null);
  const status = field("Status");
  const confLine = field("Confidence");
  let scores = null;
  if (confLine) {
    scores = {};
    for (const d of DIMENSIONS) {
      const m = confLine.match(new RegExp(`${d.key}\\s+(\\d{1,2})\\s*/\\s*25`, "i"));
      scores[d.word] = m ? Number(m[1]) : null;
    }
    if (Object.values(scores).every((v) => v === null)) scores = null;
  }
  const bullets = (sec) =>
    sec
      ? stripComments(sec.body)
          .split(/\r?\n(?=\s*[-*] )/)
          .map((b) => b.trim())
          .filter((b) => /^[-*] /.test(b))
          .map((b) => b.replace(/^[-*] /, "").replace(/\s*\r?\n\s*/g, " ").trim())
      : [];
  const checklist = secs.get("question checklist");
  const allLines = text.split(/\r?\n/);
  const range = checklistRange(allLines);
  const rows = range
    ? rowBlocks(allLines, range.head + 1, range.end)
        .filter((b) => b.m)
        .map(({ m }) => ({ marker: m[1], name: m[2].replace(/\s+/g, " ").trim(), file: m[3], rest: m[4] }))
    : [];
  const groundRules = bullets(secs.get("ground rules"));
  // The canonical line is "`AGENTS.md` is absent." (chart.md); the skill's own
  // gate wording ("No `AGENTS.md`.") and plain variants count too.
  const agentsAbsent = groundRules.some((b) => /AGENTS\.md/.test(b) && (/\b(absent|missing|not present|does not exist|without)\b/i.test(b) || /\bno\s+`?AGENTS\.md\b/i.test(b)) && !/\bexists and governs\b/i.test(b));
  return {
    status: status ? status.replace(/\*+/g, "").trim() : null,
    updated: field("Updated"),
    plan: field("Plan"),
    confidenceLine: confLine,
    scores,
    destination: secs.get("destination") ? stripComments(secs.get("destination").body).trim() : null,
    groundRules,
    agentsAbsent,
    fog: bullets(secs.get("not yet specified")),
    outOfScope: bullets(secs.get("out of scope")),
    rows,
    hasChecklist: !!checklist,
  };
}

/* ------------------------------------------------------------ deriving */

/** The marker each question's map row should carry, from its file alone. */
function markerFor(q, byNN) {
  if (q.state === "resolved") return "x";
  if (q.state === "claimed") return "/";
  if (q.state === "out-of-scope") return "-";
  const blocked = q.blockedBy.some((b) => !byNN.get(b) || byNN.get(b).state !== "resolved");
  return blocked ? "!" : " ";
}

function derive(questions) {
  const byNN = new Map(questions.map((q) => [q.nn, q]));
  for (const q of questions) q.marker = markerFor(q, byNN);
  return byNN;
}

function openBlockers(q, byNN) {
  return q.blockedBy.filter((b) => !byNN.get(b) || byNN.get(b).state !== "resolved");
}

/** A fresh row in the map template's format: gist and date on [x], the blocker on [!]. */
function rowFor(q, byNN, nameOverride) {
  const name = nameOverride || q.name;
  const link = `- [${q.marker}] [${name}](./questions/${q.file})`;
  if (q.marker === "x") {
    const date = q.resolved ? ` *(${q.resolved})*` : "";
    return q.gist ? `${link} — ${q.gist}${date}` : `${link}${date}`;
  }
  if (q.marker === "!") return `${link} — Blocked by ${openBlockers(q, byNN).join(", ")}`;
  if (q.marker === "-") return `${link} — out of scope, see below`;
  return link;
}

/**
 * An existing row (its first line plus any wrapped continuation lines) with the
 * marker the files call for. The row's own wording is kept: only the marker
 * changes, plus the suffix a marker change makes wrong. A row that turns [x]
 * without a gist, or any row in `regenerate`, is written fresh instead. Lines
 * the author hung under the row (`extra`) follow it either way.
 */
function updateRow({ lines: block, rowLines, extra, m }, q, byNN, regenerate) {
  const name = m ? m[2].replace(/\s+/g, " ").trim() : null;
  if (regenerate || !m) return [rowFor(q, byNN, name), ...extra];
  const oldMarker = m[1];
  if (oldMarker === q.marker) return block;
  const hasSuffix = /^\s*—/.test(m[4]);
  if (q.marker === "x" && !(oldMarker === "x" && hasSuffix)) return [rowFor(q, byNN, name), ...extra];
  if (q.marker === "!" || q.marker === "-" || oldMarker === "!" || oldMarker === "-" || oldMarker === "x") {
    // The tail ("— Blocked by", "— out of scope", a resolved row's gist and
    // date) belongs to the old marker.
    return [rowFor(q, byNN, name), ...extra];
  }
  return [rowLines[0].replace(/\[(.)\]/, `[${q.marker}]`), ...rowLines.slice(1), ...extra];
}

/**
 * Rebuild ## Question Checklist's markers from the files. Rows keep their text
 * and their place; missing rows are added after the last row, rows whose file
 * is gone are dropped. `regenerate` names NNs whose row is rewritten from the
 * file (resolve).
 * Returns { text, changes }.
 */
function rebuildChecklist(mapText, questions, byNN, regenerate = new Set()) {
  const nl = eol(mapText);
  const parsed = parseMap(mapText);
  const changes = [];
  const before = new Map(parsed.rows.map((r) => [r.file, r]));
  for (const q of questions) {
    const old = before.get(q.file);
    if (!old) changes.push({ change: "row-added", nn: q.nn, name: q.name, marker: `[${q.marker}]` });
    else if (old.marker !== q.marker) changes.push({ change: "marker", nn: q.nn, name: old.name, from: `[${old.marker}]`, to: `[${q.marker}]` });
  }
  for (const r of parsed.rows) if (!questions.some((q) => q.file === r.file)) changes.push({ change: "row-dropped", file: r.file, name: r.name, why: "no such question file" });

  const lines = mapText.split(/\r?\n/);
  const range = checklistRange(lines);
  const byFile = new Map(questions.map((q) => [q.file, q]));
  if (!range) {
    // No checklist section: add one before ## Not yet specified (or at the end).
    const rows = questions.map((q) => rowFor(q, byNN));
    let at = lines.findIndex((l) => /^## +Not yet specified\s*$/i.test(l));
    if (at === -1) at = lines.length;
    lines.splice(at, 0, "## Question Checklist", "", ...rows, "");
    changes.push({ change: "section-added", section: "Question Checklist" });
    return { text: lines.join(nl), changes };
  }

  // Rebuild in place: every existing row block is updated where it stands, so
  // grouping lines and comments between rows stay where the author put them.
  // Rows whose file is gone are dropped; rows for new files go after the last row.
  const blocks = rowBlocks(lines, range.head + 1, range.end);
  const seen = new Set();
  const out = [];
  let i = range.head + 1;
  let lastRowEnd = -1;
  for (const b of blocks) {
    while (i < b.start) out.push(lines[i++]);
    i = b.start + b.lines.length;
    if (!b.m) {
      // A checkbox row with no ./questions/ link is not ours to judge: keep it, say so.
      out.push(...b.lines);
      changes.push({ change: "row-kept-unparsed", line: b.start + 1, text: b.lines[0].trim().slice(0, 120), why: "no ./questions/NN-*.md link; fix it by hand" });
    } else if (byFile.has(b.m[3]) && !seen.has(b.m[3])) {
      seen.add(b.m[3]);
      const q = byFile.get(b.m[3]);
      out.push(...updateRow(b, q, byNN, regenerate.has(q.nn)));
    } else if (byFile.has(b.m[3])) {
      // A second row for a file already listed: the first one stands.
      changes.push({ change: "row-dropped", file: b.m[3], name: b.m[2].replace(/\s+/g, " ").trim(), why: "duplicate row" });
    }
    lastRowEnd = out.length;
  }
  const fresh = questions.filter((q) => !seen.has(q.file)).map((q) => rowFor(q, byNN));
  if (lastRowEnd === -1) {
    // No rows yet: after the section's leading blank lines and comment block.
    let k = i;
    while (k < range.end && !lines[k].trim()) k++;
    if (k < range.end && lines[k].trim().startsWith("<!--")) {
      while (k < range.end && !lines[k].includes("-->")) k++;
      k++;
    }
    while (i < k) out.push(lines[i++]);
    while (out.length && !out[out.length - 1].trim()) out.pop();
    out.push("", ...fresh);
    while (i < range.end && !lines[i].trim()) i++;
    out.push("");
  } else {
    out.splice(lastRowEnd, 0, ...fresh);
  }
  while (i < range.end) out.push(lines[i++]);
  lines.splice(range.head + 1, range.end - range.head - 1, ...out);
  return { text: lines.join(nl), changes };
}

/** Set (or insert, in schema order) one Key: value line in a question file's header. */
function setField(text, key, value) {
  const nl = eol(text);
  const lines = text.split(/\r?\n/);
  const limit = (() => {
    const i = lines.findIndex((l) => /^## /.test(l));
    return i === -1 ? lines.length : i;
  })();
  const keyRe = (k) => new RegExp(`^${k}:\\s*`);
  const at = lines.slice(0, limit).findIndex((l) => keyRe(key).test(l));
  if (at !== -1) {
    lines[at] = `${key}: ${value}`;
    return lines.join(nl);
  }
  // Insert after the nearest earlier schema key present, else before the nearest later one.
  const order = SCHEMA_KEYS.indexOf(key);
  for (let k = order - 1; k >= 0; k--) {
    const i = lines.slice(0, limit).findIndex((l) => keyRe(SCHEMA_KEYS[k]).test(l));
    if (i !== -1) {
      lines.splice(i + 1, 0, `${key}: ${value}`);
      return lines.join(nl);
    }
  }
  for (let k = order + 1; k < SCHEMA_KEYS.length; k++) {
    const i = lines.slice(0, limit).findIndex((l) => keyRe(SCHEMA_KEYS[k]).test(l));
    if (i !== -1) {
      lines.splice(i, 0, `${key}: ${value}`);
      return lines.join(nl);
    }
  }
  fail(EXIT.INVALID, "no-schema", `Cannot place ${key}: in a file with no schema lines.`, "Add the six Key: value lines under the H1 (see questions.md).");
}

/**
 * Set (or insert) one **Key:** value line in the map's header block. Status
 * goes first; a new key goes right after Status, or with `last` at the end of
 * the block of **Key:** lines that Status opens.
 */
function setMapField(text, key, value, { last = false } = {}) {
  const re = new RegExp(`^\\*\\*${key}:\\*\\*.*$`, "m");
  if (re.test(text)) return text.replace(re, `**${key}:** ${value}`);
  const nl = eol(text);
  const lines = text.split(/\r?\n/);
  const statusAt = lines.findIndex((l) => /^\*\*Status:\*\*/.test(l));
  if (key !== "Status" && statusAt !== -1) {
    let at = statusAt + 1;
    if (last) while (at < lines.length && /^\*\*[^*]+:\*\*/.test(lines[at])) at++;
    lines.splice(at, 0, `**${key}:** ${value}`);
    return lines.join(nl);
  }
  const updatedAt = lines.findIndex((l) => /^\*\*Updated:\*\*/.test(l));
  if (updatedAt !== -1) {
    lines.splice(updatedAt, 0, `**${key}:** ${value}`);
    return lines.join(nl);
  }
  const h1 = lines.findIndex((l) => /^# /.test(l));
  let at = h1 === -1 ? 0 : h1 + 1;
  while (at < lines.length && (lines[at].trim() === "" || /^\*[^*].*\*$/.test(lines[at].trim()))) at++;
  lines.splice(at, 0, `**${key}:** ${value}`, "");
  return lines.join(nl);
}

function writeFile(file, text, dry) {
  if (!dry) fs.writeFileSync(file, text);
}

/* -------------------------------------------------------------- frontier */

function frontierOf(questions, byNN) {
  const open = questions.filter((q) => q.state === "open");
  const isUnblocked = (q) => q.blockedBy.every((b) => byNN.get(b) && byNN.get(b).state === "resolved");
  // State: open means unclaimed (reconcile clears a stray Claimed: date on one).
  const frontier = open.filter(isUnblocked).map((q) => ({ nn: q.nn, name: q.name, type: q.type, file: q.file, ...(q.blockedBy.length ? { unblockedBy: q.blockedBy.map((b) => byNN.get(b).name) } : {}) }));
  const blocked = open
    .filter((q) => !isUnblocked(q))
    .map((q) => ({
      nn: q.nn,
      name: q.name,
      blockedBy: q.blockedBy.map((b) => ({ nn: b, name: byNN.get(b) ? byNN.get(b).name : null, state: byNN.get(b) ? byNN.get(b).state : "missing" })).filter((b) => b.state !== "resolved"),
    }));
  const stranded = blocked.filter((q) => q.blockedBy.some((b) => b.state === "out-of-scope" || b.state === "missing"));
  const claimed = questions.filter((q) => q.state === "claimed").map((q) => ({ nn: q.nn, name: q.name, claimed: q.claimed, hasAnswer: q.hasAnswer }));
  return { frontier, blocked, stranded, claimed };
}

function nextNN(loc, questions) {
  const nums = questions.map((q) => parseInt(q.nn, 10));
  // The directory listing (any NN-*.md, even unparseable ones), plus every NN
  // still referenced by a Blocked by: line or a link in map.md or any question
  // file, plus the map's **Next NN:** high-water mark: a deleted file's number
  // is never handed out again, so no link or blocker can rot.
  if (isDir(loc.qDir)) {
    for (const n of fs.readdirSync(loc.qDir)) {
      if (!/^\d+-/.test(n)) continue;
      nums.push(parseInt(n, 10));
      if (/\.md$/i.test(n)) for (const m of (readText(path.join(loc.qDir, n)) || "").matchAll(/questions\/(\d+)-/g)) nums.push(parseInt(m[1], 10));
    }
  }
  for (const q of questions) for (const b of q.blockedBy) nums.push(parseInt(b, 10));
  const mapText = readText(loc.mapPath) || "";
  for (const m of mapText.matchAll(/questions\/(\d+)-/g)) nums.push(parseInt(m[1], 10));
  const max = nums.length ? Math.max(...nums) : -1;
  return String(Math.max(max + 1, highWater(mapText))).padStart(2, "0");
}

/** The map's **Next NN:** line as a number (0 when absent or unreadable). */
function highWater(mapText) {
  const m = mapText.match(/^\*\*Next NN:\*\*\s*(\d+)\s*$/m);
  return m ? parseInt(m[1], 10) : 0;
}

/**
 * Persist the high-water mark: **Next NN:** set to `next` (computed before the
 * map is rebuilt, so a row about to be dropped still counts). It only rises.
 * Returns { text, change } where change is null when the line already says so.
 */
function keepNextNN(mapText, next) {
  const field = (mapText.match(/^\*\*Next NN:\*\*\s*(.*?)\s*$/m) || [])[1];
  if (field === next) return { text: mapText, change: null };
  return { text: setMapField(mapText, "Next NN", next, { last: true }), change: { change: "next-nn", from: field ?? null, to: next } };
}

function counts(questions, map) {
  const total = questions.filter((q) => q.state !== "out-of-scope").length;
  const resolved = questions.filter((q) => q.state === "resolved").length;
  return { resolved, total, outOfScope: questions.filter((q) => q.state === "out-of-scope").length, fog: map ? map.fog.length : 0 };
}

function drift(questions, map) {
  const rows = new Map(map.rows.map((r) => [r.file, r.marker]));
  const d = [];
  const seen = new Map();
  for (const r of map.rows) seen.set(r.file, (seen.get(r.file) || 0) + 1);
  for (const [file, n] of seen) if (n > 1) d.push(`map row ${file} appears ${n} times`);
  for (const q of questions) {
    if (!rows.has(q.file)) d.push(`${q.file} has no map row`);
    else if (rows.get(q.file) !== q.marker) d.push(`${q.file}: map shows [${rows.get(q.file)}], file says [${q.marker}]`);
  }
  for (const r of map.rows) if (!questions.some((q) => q.file === r.file)) d.push(`map row ${r.file} has no question file`);
  return d;
}

/* ----------------------------------------------------------- commands */

async function cmdReconcile(loc, args) {
  const dry = !!args["dry-run"];
  let mapText = requireMap(loc);
  const repairs = [];
  const today = isoDate();
  const files = isDir(loc.qDir)
    ? fs.readdirSync(loc.qDir).filter((n) => /^\d+-.*\.md$/i.test(n)).sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || a.localeCompare(b))
    : [];
  // Work out every repair in memory first; nothing is written until all files
  // are known to be repairable, so a bad file can never leave the map half done.
  const planned = [];
  const findings = [];
  for (const name of files) {
    const full = path.join(loc.qDir, name);
    const before = readText(full) || "";
    let text = before;
    const q = parseQuestion(full, text);
    const local = [];
    try {
      if (q.hasAnswer && q.state !== "resolved" && q.state !== "out-of-scope") {
        text = setField(text, "State", "resolved");
        local.push({ nn: q.nn, name: q.name, repair: "state-resolved", detail: `has an ## Answer but State was ${q.state || "missing"}` });
        q.state = "resolved";
      }
      if (q.state === "resolved" && !q.resolved) {
        const date = q.claimed ? q.claimed.slice(0, 10) : today;
        text = setField(text, "Resolved", date);
        local.push({ nn: q.nn, name: q.name, repair: "resolved-backfilled", detail: `Resolved: ${date} (from ${q.claimed ? "Claimed:" : "today"})` });
      }
      if (q.state === "claimed" && !q.hasAnswer) {
        text = setField(setField(text, "State", "open"), "Claimed", "none");
        local.push({ nn: q.nn, name: q.name, repair: "stale-claim-reset", detail: `claimed ${q.claimed || "(no date)"} with no answer: a crashed session; reset to open` });
      } else if (q.state === "open" && q.claimed) {
        // An open question carrying a claim date is half-claimed: neither on
        // the frontier nor held. Open wins.
        text = setField(text, "Claimed", "none");
        local.push({ nn: q.nn, name: q.name, repair: "stray-claim-cleared", detail: `State: open but Claimed: ${q.claimed}; cleared the date` });
      }
    } catch (err) {
      if (!err || !err.exit) throw err;
      findings.push({ nn: q.nn, file: name, finding: "unrepairable", detail: `${err.message} Left untouched.` });
      // Still a question file: it keeps its map row (claim and resolve see it
      // too), with its text as it stands.
      planned.push({ full, before, text: before });
      continue;
    }
    if (q.state === "out-of-scope" && q.hasAnswer) {
      // A scope boundary is not a decision: an Answer under out-of-scope is not
      // promoted to resolved. Say so; the human decides which one is wrong.
      findings.push({ nn: q.nn, file: name, finding: "out-of-scope-with-answer", detail: "State: out-of-scope but it has an ## Answer: either the ruling or the answer is wrong; ask the human" });
    }
    repairs.push(...local);
    planned.push({ full, before, text });
  }
  if (!dry) for (const p of planned) if (p.text !== p.before) fs.writeFileSync(p.full, p.text);
  const questions = planned.map((p) => ({ ...parseQuestion(p.full, p.text), path: p.full }));
  const byNN = derive(questions);
  // Before the rebuild drops any row: a deleted file's link still counts.
  const next = nextNN(loc, questions);
  const parsedMap = parseMap(mapText);
  const { text: rebuilt, changes } = rebuildChecklist(mapText, questions, byNN);
  mapText = rebuilt;
  let statusSet = null;
  if (!parsedMap.status || !/^(Charting|Working|Cleared)$/i.test(parsedMap.status)) {
    mapText = setMapField(mapText, "Status", "Working");
    statusSet = "Working";
  }
  const kept = keepNextNN(mapText, next);
  mapText = kept.text;
  if (kept.change) changes.push(kept.change);
  const mapChanged = mapText !== readText(loc.mapPath);
  writeFile(loc.mapPath, mapText, dry);
  const refire = questions
    .filter((q) => q.kind === "research" && q.state !== "resolved" && q.state !== "out-of-scope" && !q.researchComplete)
    .map((q) => ({ nn: q.nn, name: q.name, path: q.path, question: q.questionText, partialEvidence: q.hasEvidence }));
  out({
    ok: true,
    map: `${loc.relPf}/map.md`,
    dryRun: dry,
    repairs,
    ...(findings.length ? { findings } : {}),
    mapChanges: changes,
    ...(statusSet ? { statusSet: `**Status:** was missing or unreadable; set to ${statusSet}` } : {}),
    mapWritten: mapChanged && !dry,
    nextNN: next,
    refire,
    counts: counts(questions, parseMap(mapText)),
  });
}

async function cmdFrontier(loc) {
  const map = parseMap(requireMap(loc));
  const questions = loadQuestions(loc);
  const byNN = derive(questions);
  const f = frontierOf(questions, byNN);
  const c = counts(questions, map);
  out({
    ok: true,
    map: `${loc.relPf}/map.md`,
    status: map.status,
    ...f,
    nextNN: nextNN(loc, questions),
    counts: c,
    nothingOpen: !questions.some((q) => q.state === "open" || q.state === "claimed"),
    allBlocked: f.frontier.length === 0 && f.blocked.length > 0 && f.claimed.length === 0,
    drift: drift(questions, map),
    ...(drift(questions, map).length ? { next: "Run reconcile: the map disagrees with the files." } : {}),
  });
}

function findQ(questions, nnArg) {
  if (!nnArg) fail(EXIT.USAGE, "missing-nn", "Name the question by its NN.", "Example: claim specs/x/pathfinder 03");
  const nn = String(nnArg).padStart(2, "0");
  const q = questions.find((x) => x.nn === nn);
  if (!q) fail(EXIT.NOT_FOUND, "no-question", `No question ${nn} in questions/.`, "Run `frontier` to see the question numbers.");
  return q;
}

/**
 * The map rewrite every write command ends with: the high-water mark (from the
 * map as it was, before its rows changed), then the file, unless a dry run.
 * Returns whether the map was written.
 */
function saveMap(loc, before, mapText, next, dry) {
  mapText = keepNextNN(mapText, next).text;
  writeFile(loc.mapPath, mapText, dry);
  return mapText !== before && !dry;
}

async function cmdClaim(loc, args) {
  const dry = !!args["dry-run"];
  const original = requireMap(loc);
  let mapText = original;
  const questions = loadQuestions(loc);
  const byNN = derive(questions);
  const q = findQ(questions, args._[2]);
  const other = questions.find((x) => x.state === "claimed" && x.nn !== q.nn);
  if (other) fail(EXIT.REFUSED, "claim-open", `${other.nn} ${other.name} is already claimed; one claim at a time.`, "Record or release that claim first (reconcile resets a claim with no answer).");
  if (q.state === "claimed") {
    out({ ok: true, nn: q.nn, name: q.name, already: true, claimed: q.claimed, file: rel(loc.root, q.path), dryRun: dry, mapWritten: false });
    return;
  }
  if (q.state !== "open") fail(EXIT.REFUSED, "not-open", `${q.nn} ${q.name} is ${q.state}, not open.`, "Pick a question from the frontier.");
  const blockers = q.blockedBy.filter((b) => !byNN.get(b) || byNN.get(b).state !== "resolved");
  if (blockers.length) fail(EXIT.REFUSED, "blocked", `${q.nn} ${q.name} is blocked by ${blockers.join(", ")}.`, "Pick an unblocked question, or resolve its blocker first.");
  const when = stamp();
  const next = nextNN(loc, questions);
  // The file first, then the map: both saved before any work on the question.
  let text = readText(q.path);
  text = setField(setField(text, "State", "claimed"), "Claimed", when);
  writeFile(q.path, text, dry);
  q.state = "claimed";
  q.claimed = when;
  derive(questions);
  mapText = rebuildChecklist(mapText, questions, byNN).text;
  const mapWritten = saveMap(loc, original, mapText, next, dry);
  out({ ok: true, nn: q.nn, name: q.name, claimed: when, type: q.type, file: rel(loc.root, q.path), blockedBy: q.blockedBy, dryRun: dry, mapWritten });
}

async function cmdResolve(loc, args) {
  const dry = !!args["dry-run"];
  const original = requireMap(loc);
  let mapText = original;
  const questions = loadQuestions(loc);
  let byNN = derive(questions);
  const q = findQ(questions, args._[2]);
  if (q.state === "out-of-scope") fail(EXIT.REFUSED, "out-of-scope", `${q.nn} ${q.name} is out of scope; it gets no Answer.`, "Nothing to resolve.");
  if (!q.hasAnswer) fail(EXIT.INVALID, "no-answer", `${q.nn} ${q.name} has no ## Answer yet.`, "Append ## Answer (decision, rejected, consequences, **Gist:** last) first, then rerun.");
  if (!q.gist) fail(EXIT.INVALID, "no-gist", `${q.nn} ${q.name}'s ## Answer has no **Gist:** line.`, "End the Answer with a one-line **Gist:**, then rerun.");
  const blockedBefore = new Set(questions.filter((x) => x.marker === "!").map((x) => x.nn));
  const today = isoDate();
  // Re-running resolve on an already-resolved question keeps its original date.
  const date = q.state === "resolved" && q.resolved ? q.resolved : today;
  const next = nextNN(loc, questions);
  let text = readText(q.path);
  text = setField(setField(text, "State", "resolved"), "Resolved", date);
  writeFile(q.path, text, dry);
  q.state = "resolved";
  q.resolved = date;
  byNN = derive(questions);
  mapText = rebuildChecklist(mapText, questions, byNN, new Set([q.nn])).text;
  mapText = setMapField(mapText, "Updated", today);
  const mapWritten = saveMap(loc, original, mapText, next, dry);
  const unblocked = questions.filter((x) => blockedBefore.has(x.nn) && x.marker === " ").map((x) => ({ nn: x.nn, name: x.name }));
  const f = frontierOf(questions, byNN);
  out({ ok: true, nn: q.nn, name: q.name, resolved: q.resolved, gist: q.gist, unblocked, frontier: f.frontier, counts: counts(questions, parseMap(mapText)), dryRun: dry, mapWritten });
}

async function cmdRuleOut(loc, args) {
  const dry = !!args["dry-run"];
  const original = requireMap(loc);
  let mapText = original;
  const reason = (args.reason || "").trim();
  if (!reason) fail(EXIT.USAGE, "missing-reason", "--reason is required: one line on why this sits past the destination.", 'Example: --reason "the destination names MS Teams only"');
  const questions = loadQuestions(loc);
  const q = findQ(questions, args._[2]);
  if (q.state === "resolved") fail(EXIT.REFUSED, "resolved", `${q.nn} ${q.name} is resolved; a decision is not ruled out after the fact.`, "If the destination was redrawn, that is a fresh map.");
  const next = nextNN(loc, questions);
  let text = readText(q.path);
  text = setField(setField(text, "State", "out-of-scope"), "Claimed", "none");
  const nl = eol(text);
  // One line under ## Question saying why, as its own paragraph.
  if (!/^Out of scope: /m.test(text)) text = text.replace(/^## +Question[ \t]*(?:\r?\n[ \t]*)*\r?\n/m, (h) => `${h.trimEnd()}${nl}${nl}Out of scope: ${reason}${nl}${nl}`);
  writeFile(q.path, text, dry);
  q.state = "out-of-scope";
  const byNN = derive(questions);
  mapText = rebuildChecklist(mapText, questions, byNN).text;
  const line = `- [${q.name}](./questions/${q.file}) — ${reason}`;
  const mapNl = eol(mapText);
  const lines = mapText.split(/\r?\n/);
  const at = lines.findIndex((l) => /^## +Out of scope\s*$/i.test(l));
  if (!lines.some((l) => l.includes(`](./questions/${q.file})`) && !/^\s*[-*] \[.\]/.test(l))) {
    if (at === -1) {
      lines.push("", "## Out of scope", "", line);
    } else {
      let end = lines.findIndex((l, i) => i > at && /^## /.test(l));
      if (end === -1) end = lines.length;
      let insert = end;
      while (insert > at + 1 && !lines[insert - 1].trim()) insert--;
      lines.splice(insert, 0, line);
    }
  }
  mapText = lines.join(mapNl);
  mapText = setMapField(mapText, "Updated", isoDate());
  const mapWritten = saveMap(loc, original, mapText, next, dry);
  const f = frontierOf(questions, byNN);
  out({ ok: true, nn: q.nn, name: q.name, state: "out-of-scope", outOfScopeLine: line, stranded: f.stranded, dryRun: dry, mapWritten, next: f.stranded.length ? "Re-frame each stranded question's ## Question to drop the dependency, or rule it out too." : undefined });
}

/* --------------------------------------------------------------- trail */

function confidenceLine(scores) {
  if (!scores) return null;
  const vals = DIMENSIONS.map((d) => ({ word: d.word, v: scores[d.word] }));
  if (vals.some((x) => x.v === null)) return null;
  const low = vals.filter((x) => x.v < 18).map((x) => x.word);
  if (low.length) return `Confidence: not yet — ${low.join(", ")} still ${low.length === 1 ? "needs" : "need"} work.`;
  const border = vals.filter((x) => x.v < 20).map((x) => x.word);
  if (border.length) return `Confidence: solid, but ${border.join(", ")} ${border.length === 1 ? "is" : "are"} borderline.`;
  return "Confidence: solid.";
}

function wrapJoin(parts, indent = "  ", width = 100) {
  const lines = [];
  let cur = "";
  for (const p of parts) {
    const next = cur ? `${cur} · ${p}` : p;
    if (cur && indent.length + next.length > width) {
      lines.push(indent + cur);
      cur = p;
    } else cur = next;
  }
  if (cur) lines.push(indent + cur);
  return lines;
}

// Init comes first only while the ground rules record AGENTS.md absent AND it is
// still missing: one written since charting needs no init detour.
function needsInit(loc, map) {
  return map.agentsAbsent && !fs.existsSync(path.join(loc.root, "AGENTS.md"));
}

function resumeCommand(loc, map) {
  if (/^cleared$/i.test(map.status || "")) {
    return needsInit(loc, map) ? "`/plan2code-init`, then `/plan2code-1-plan --web`" : "`/plan2code-1-plan --web`";
  }
  return `\`/plan2code-0-pathfinder ${loc.relPf} --web\``;
}

// What the human reads a question as: its name on the checklist row (the
// trail and the menu come from the rows), falling back to the file's H1.
function displayName(map, q) {
  const row = map.rows.find((r) => r.file === q.file);
  return row ? row.name : q.name;
}

function buildTrail(loc, map, questions, byNN) {
  const c = counts(questions, map);
  const status = map.status || "Working";
  const cleared = /^cleared$/i.test(status);
  const stops = questions.map((q) => q.marker);
  let pathStr = "START ";
  stops.forEach((m, i) => {
    if (i > 0) pathStr += m === "x" || m === "/" ? "━" : "··";
    pathStr += GLYPH[m] || "○";
  });
  const allWalked = stops.length > 0 && stops.every((m) => m === "x" || m === "-");
  if (c.fog > 0) pathStr += " ····⚑";
  else pathStr += stops.length === 0 ? "⚑" : allWalked ? "━⚑" : "··⚑";
  if (cleared) pathStr += "  arrived";

  const lines = [`🧭 ${loc.idea} · ${status} · ${c.resolved}/${c.total} cleared`, `  ${pathStr}`];
  if (!cleared) {
    const order = [["x", "● done"], ["/", "◉ here"], [" ", "○ open"], ["!", "⊘ blocked"], ["-", "⊝ out of scope"]];
    const legend = order.filter(([m]) => stops.includes(m)).map(([, t]) => t);
    legend.push("⚑ destination");
    if (c.fog > 0) legend.push(`~${c.fog} fog`);
    lines.push(`  ${legend.join(" · ")}`);
    const position = new Map(questions.map((q, i) => [q.nn, i + 1]));
    const named = questions.map((q, i) => {
      const tag =
        q.marker === "x" ? " ✔" :
        q.marker === "/" ? " ◀ here" :
        q.marker === "-" ? " (out of scope)" :
        q.marker === "!" ? ` (blocked:${openBlockers(q, byNN).map((b) => position.get(b) || "missing").join(",")})` : "";
      return `${i + 1} ${displayName(map, q)}${tag}`;
    });
    lines.push(...wrapJoin(named));
  }
  const conf = confidenceLine(map.scores);
  if (conf) lines.push(`  ${conf}`);
  return lines;
}

async function cmdTrail(loc, args) {
  const map = parseMap(requireMap(loc));
  const questions = loadQuestions(loc);
  const byNN = derive(questions);
  const form = String(args.form || "").toUpperCase();
  if (!["A", "B", "C"].includes(form)) fail(EXIT.USAGE, "bad-form", "--form must be A (session ends), B (you asked the human something) or C (the menu after a recorded decision).", "Pick by what this turn does, not by the map's status.");
  const trail = buildTrail(loc, map, questions, byNN);
  const cmd = resumeCommand(loc, map);
  let part2;
  let menu;
  if (form === "A") {
    part2 = ["NEXT STEP · start a new conversation and run:", cmd];
  } else if (form === "B") {
    const items = args.item || [];
    if (!items.length) fail(EXIT.USAGE, "missing-items", "Form B names every outstanding item: pass 1-3 --item.", 'Example: --item "Q1 Duration model" --item "Q2 Contract while held"');
    if (items.length > 3) fail(EXIT.REFUSED, "too-many-items", `${items.length} items; the cap is three probes per turn.`, "Hold the rest for the next batch.");
    const joined = items.join(" · ");
    part2 = ["WAITING ON YOU · answer here, in this conversation:", ...(joined.length > 100 ? items : [joined])];
  } else {
    if (/^cleared$/i.test(map.status || "")) fail(EXIT.REFUSED, "cleared", "The map is Cleared: there is no menu, the session ends (Form A).", "Use --form A.");
    if (questions.some((q) => q.state === "claimed")) fail(EXIT.REFUSED, "claim-open", "A question is still claimed; Form C is only for the turn after a recorded decision, with nothing claimed.", "Record the decision (resolve), or use Form B while you are still asking.");
    const f = frontierOf(questions, byNN);
    // Nothing takeable means there is no menu to offer: an empty frontier is a
    // stop (Work Step 4), and a stop is Form A.
    if (!f.frontier.length) fail(EXIT.REFUSED, "no-frontier", "Nothing on the frontier to offer: every open question is blocked, or none is left.", "Use --form A (report the blocked chain, or go to The Clearing Gate).");
    part2 = ["OR START FRESH · new conversation, paste:", cmd];
    const resolvedThisSession = Number(args["resolved-this-session"] || 0);
    const checkpoint = resolvedThisSession >= 3 || !!args.heavy;
    const options = f.frontier.slice(0, 3).map((x) => {
      const q = byNN.get(x.nn);
      return { label: displayName(map, q), nn: x.nn, type: x.type, ...(x.unblockedBy ? { note: `can now be decided: ${x.unblockedBy.join(", ")} landed` } : {}) };
    });
    menu = {
      header: "Next step",
      question: checkpoint ? "Continue here, or start fresh? Everything is saved. I recommend starting fresh, to keep me sharp." : "Continue here, or start fresh? Everything is saved.",
      options: [...options, { label: "Start fresh" }],
      recommended: checkpoint ? "Start fresh" : options[0].label,
      why: checkpoint ? (args.heavy ? "a heavy, contested or locked decision just landed" : `${resolvedThisSession} questions resolved this session`) : "lowest NN on the frontier",
      ...(f.frontier.length > 3 ? { more: f.frontier.slice(3).map((x) => displayName(map, byNN.get(x.nn))) } : {}),
    };
  }
  const text = [...trail, "", ...part2].join("\n");
  if (args.text) {
    process.stdout.write(text + "\n");
    return;
  }
  out({ ok: true, form, text, ...(menu ? { menu } : {}) });
}

/* ---------------------------------------------------------------- gate */

// The testing-posture answer must name types, cadence and coverage. Matched as
// keywords, case-insensitive ("run after each phase, moderate coverage" counts),
// and never inside the answer's Rejected block, where a losing option is named.
const TYPES_RE = /\b(unit|integration|end-to-end|e2e|none)\b/i;
const CADENCE_RE = /after each phase|dedicated (testing )?phase/i;
const COVERAGE_RE = /critical paths?|moderate|comprehensive/i;
const CADENCE = ["Run after each phase", "Dedicated phase only"];
const COVERAGE = ["Critical paths", "Moderate (~60-80%)", "Comprehensive (>80%)"];

function withoutRejected(body) {
  return body.replace(/^\s*\*\*Rejected\b[\s\S]*?(?=^\s*\*\*(?!Rejected)[A-Z]|^#{1,6}\s|(?![\s\S]))/m, "");
}

async function cmdGate(loc) {
  const map = parseMap(requireMap(loc));
  const questions = loadQuestions(loc);
  const byNN = derive(questions);
  const checks = [];
  const add = (id, pass, detail) => checks.push({ id, pass, ...(detail ? { detail } : {}) });

  const d = drift(questions, map);
  add("markers-match-files", d.length === 0, d.length ? `${d.length} drift(s): run reconcile first. ${d.slice(0, 5).join("; ")}` : null);
  const notDone = questions.filter((q) => ["/", " ", "!"].includes(q.marker));
  add("no-open-claimed-blocked", notDone.length === 0, notDone.length ? notDone.map((q) => `${q.nn} ${q.name} [${q.marker}]`).join(", ") : null);
  add("fog-empty", map.fog.length === 0, map.fog.length ? `${map.fog.length} bullet(s) in ## Not yet specified` : null);
  const noGist = questions.filter((q) => q.state === "resolved" && (!q.hasAnswer || !q.gist));
  add("every-resolved-has-gist", noGist.length === 0, noGist.length ? noGist.map((q) => `${q.nn} ${q.name}`).join(", ") : null);

  const drafts = fs.readdirSync(loc.ideaDir).filter((n) => /^PLAN-DRAFT-.*\.md$/i.test(n) && !/-prev\.md$/i.test(n));

  // Hard caps: while one holds, that dimension cannot exceed 17.
  const caps = [];
  const testing = questions.find((q) => /testing posture/i.test(q.name));
  if (!testing || testing.state !== "resolved") caps.push({ dimension: "Requirements", why: testing ? `${testing.name} is not resolved` : "no testing-posture question exists" });
  else {
    const a = withoutRejected(testing.answerBody);
    const missing = [];
    if (!TYPES_RE.test(a)) missing.push("types");
    if (!CADENCE_RE.test(a)) missing.push(`cadence (${CADENCE.join(" / ")})`);
    if (!COVERAGE_RE.test(a)) missing.push(`coverage (${COVERAGE.join(" / ")})`);
    if (missing.length) caps.push({ dimension: "Requirements", why: `the testing-posture answer omits ${missing.join(", ")}` });
  }
  for (const q of questions.filter((x) => x.kind === "research" && x.state === "resolved" && !x.hasEvidence)) caps.push({ dimension: "Feasibility", why: `research ${q.nn} ${q.name} is resolved with an empty ## Evidence` });
  for (const q of questions.filter((x) => x.locked && x.state === "resolved" && !x.hasConsequences)) caps.push({ dimension: "Risk", why: `Locked: yes ${q.nn} ${q.name} records no consequences` });
  add("hard-caps", caps.length === 0, caps.length ? caps.map((c) => `${c.dimension} <= 17: ${c.why}`).join("; ") : null);

  const scores = map.scores;
  const scored = scores && DIMENSIONS.every((x) => scores[x.word] !== null);
  const low = scored ? DIMENSIONS.filter((x) => scores[x.word] < 18).map((x) => `${x.word} ${scores[x.word]}`) : [];
  add("scores-at-least-18", !!scored && low.length === 0, !scored ? "map.md has no complete **Confidence:** line (Requirements-clarity NN/25 · ...)" : low.length ? `below 18: ${low.join(", ")}` : null);

  const mechanicalPass = checks.every((c) => c.pass);
  out({
    ok: true,
    map: `${loc.relPf}/map.md`,
    mechanicalPass,
    checks,
    caps,
    existingPlanDraft: drafts.length ? drafts.map((n) => rel(loc.root, path.join(loc.ideaDir, n))) : null,
    planDraftPath: drafts.length ? rel(loc.root, path.join(loc.ideaDir, drafts.sort().at(-1))) : `${rel(loc.root, loc.ideaDir)}/PLAN-DRAFT-${isoDate().replace(/-/g, "")}.md`,
    agentsAbsent: map.agentsAbsent,
    initFirst: needsInit(loc, map),
    judgment: [
      "Score the four dimensions against the written record (handoff.md rubric), then update the map's **Confidence:** line and rerun gate.",
      "The destination is reachable with nothing left to decide: no ## Answer defers a choice to whoever implements it.",
      "Integration cap: every system named in ## Destination has a resolved question touching it.",
    ],
  });
}

/* ---------------------------------------------------------------- lint */

function walk(dir) {
  const outList = [];
  if (!isDir(dir)) return outList;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      outList.push(...walk(p));
    } else outList.push(p);
  }
  return outList;
}

function scrapeHits(text) {
  const hits = [];
  for (const s of SCRAPE) {
    const m = text.match(s.re);
    if (m) hits.push(`${s.name}: "${m[0].trim()}"`);
  }
  return hits;
}

async function cmdLint(loc) {
  const problems = [];
  const add = (level, file, message) => problems.push({ level, file: rel(loc.root, file), message });
  // Loop tokens: anywhere under specs/<idea>/ in text files.
  for (const f of walk(loc.ideaDir)) {
    if (!/\.(md|txt|json|ya?ml|csv)$/i.test(f)) continue;
    const t = readText(f) || "";
    const m = t.match(LOOP_TOKENS);
    if (m) add("error", f, `contains the loop completion token ${m[0]} (the loop scans specs/ for these)`);
  }
  // Reserved names inside pathfinder/.
  for (const f of walk(loc.pf)) {
    const b = path.basename(f);
    if (/^overview\.md$|^phase-\d+.*\.md$|^PLAN-DRAFT-.*\.md$|^PLAN-CONVERSATION-.*\.md$/i.test(b)) add("error", f, `${b} is a reserved name; never create it inside pathfinder/`);
    if (/\.md$/i.test(b) && /METRICS_JSON/.test(readText(f) || "")) add("error", f, "contains METRICS_JSON; pathfinder is not a metered step");
  }
  // Question files.
  const questions = loadQuestions(loc);
  const byNN = new Map();
  for (const q of questions) {
    const t = readText(q.path) || "";
    if (byNN.has(q.nn)) add("error", q.path, `NN ${q.nn} is used by ${byNN.get(q.nn).file} too; NN is never reused`);
    byNN.set(q.nn, q);
    if (q.rawNN.length < 2) add("error", q.path, `NN "${q.rawNN}" is not zero-padded; rename it to ${q.file.replace(/^\d+/, q.nn)}`);
    if (/^\s*[-*] \[.\]/m.test(t)) add("error", q.path, "has a checkbox line; question files use plain bullets (the loop and metrics read checkboxes)");
    if (!q.banner) add("warn", q.path, "does not open with the Pathfinder planning-note banner");
    for (const k of SCHEMA_KEYS) {
      if (k in q.fields) continue;
      // Maps older than the Resolved: line get it backfilled by reconcile.
      if (k === "Resolved") add("warn", q.path, "is missing the Resolved: schema line (an older map); reconcile backfills it");
      else add("error", q.path, `is missing the ${k}: schema line`);
    }
    if (q.type && !TYPES.includes(q.type)) add("error", q.path, `Type: "${q.type}" is not one of ${TYPES.join(" | ")}`);
    if (q.state && !STATES.includes(q.state)) add("error", q.path, `State: "${q.state}" is not one of ${STATES.join(" | ")}`);
    if (q.fields.Locked && !/^(yes|no)$/i.test(q.fields.Locked)) add("warn", q.path, `Locked: "${q.fields.Locked}" should be yes or no`);
    if (q.fields.Resolved && !/^(none|\d{4}-\d{2}-\d{2})$/i.test(q.fields.Resolved)) add("error", q.path, `Resolved: "${q.fields.Resolved}" should be none or YYYY-MM-DD`);
    if (q.fields.Claimed && !/^(none|\d{4}-\d{2}-\d{2} \d{2}:\d{2})$/i.test(q.fields.Claimed)) add("warn", q.path, `Claimed: "${q.fields.Claimed}" should be none or YYYY-MM-DD HH:mm`);
    if (q.state === "out-of-scope" && q.hasAnswer) add("warn", q.path, "is out of scope but has an ## Answer; a scope boundary is not a decision");
    if (q.state === "resolved" && !q.gist) add("error", q.path, "is resolved but its ## Answer has no **Gist:** line");
  }
  const zero = questions.find((q) => q.nn === "00");
  if (questions.length && !zero) add("warn", loc.qDir, "no 00-codebase-context.md; 00 always exists");
  if (zero && !/^00-codebase-context\.md$/.test(zero.file)) add("error", zero.path, "NN 00 is always 00-codebase-context.md");
  for (const q of questions) {
    for (const b of q.blockedBy) {
      if (!byNN.has(b)) add("error", q.path, `Blocked by: ${b}, which does not exist`);
      if (b === q.nn) add("error", q.path, "is blocked by itself");
    }
  }
  // Cycles in Blocked by: a three-colour depth-first search (grey = on the
  // current path, black = fully explored), so each question is explored once
  // however densely the questions block each other. Every back edge is a
  // cycle, reported once, against the question it starts from.
  const reported = new Set();
  const colour = new Map();
  const pathStack = [];
  const visit = (nn) => {
    colour.set(nn, "grey");
    pathStack.push(nn);
    for (const b of byNN.get(nn).blockedBy) {
      if (!byNN.has(b)) continue;
      if (colour.get(b) === "grey") {
        const c = [...pathStack.slice(pathStack.indexOf(b)), b];
        const key = [...new Set(c)].sort().join(",");
        if (!reported.has(key)) {
          reported.add(key);
          add("error", byNN.get(b).path, `Blocked by: cycle ${c.join(" -> ")}; a cycle is one decision phrased twice (merge them or drop an edge)`);
        }
      } else if (!colour.has(b)) visit(b);
    }
    pathStack.pop();
    colour.set(nn, "black");
  };
  for (const q of questions) if (!colour.has(q.nn)) visit(q.nn);
  // Scraper bait in the files the collector or a reader treats as planning output.
  const baitFiles = [loc.mapPath, ...walk(path.join(loc.pf, "briefs"))];
  for (const n of fs.existsSync(loc.ideaDir) ? fs.readdirSync(loc.ideaDir) : []) {
    if (!/^PLAN-DRAFT-.*\.md$/i.test(n)) continue;
    const t = readText(path.join(loc.ideaDir, n)) || "";
    // Only a pathfinder-written draft (no METRICS_JSON yet); Plan's Phase 7 owns the rest.
    if (/plan2code-0-pathfinder/.test(t) && !/METRICS_JSON/.test(t)) baitFiles.push(path.join(loc.ideaDir, n));
  }
  for (const f of baitFiles) {
    const t = readText(f);
    if (t === null) continue;
    for (const h of scrapeHits(t)) add("error", f, `metrics-scraper bait (${h}); hyphenate the dimension label or reword`);
    const isBrief = /briefs[\\/]/.test(f);
    if (isBrief) {
      if (/%/.test(t)) add("error", f, "contains %; a brief carries no percent signs");
      if (/\b\d{1,2}\s*\/\s*25\b/.test(t)) add("error", f, "contains a raw NN/25 score; a brief uses the plain-English confidence line only");
      if (/^\s*[-*] \[.\]/m.test(t)) add("error", f, "has a checkbox line; no checkboxes under specs/<idea>/pathfinder/");
    } else if (f === loc.mapPath) {
      // The collector does not scrape map.md, but chart.md keeps it free of % so
      // nothing copied out of it into a plan can carry one.
      if (/%/.test(t)) add("warn", f, "contains %; the map keeps percent signs off the page (chart.md)");
    } else if (/^##\s+Planning Metrics\b/m.test(t)) {
      add("error", f, "has a ## Planning Metrics section; a pathfinder-written draft leaves that to /plan2code-1-plan Phase 7");
    }
  }
  const errors = problems.filter((p) => p.level === "error").length;
  const report = { checked: rel(loc.root, loc.ideaDir), errors, warnings: problems.length - errors, problems };
  if (!errors) {
    out({ ok: true, ...report });
    return;
  }
  // The failure shape (error, message, next, the same line on stderr), written
  // here rather than through fail(), which would drop the problems list.
  const message = `lint found ${errors} error${errors === 1 ? "" : "s"}.`;
  const next = "Fix each error in problems, then rerun lint.";
  out({ ok: false, error: "lint-failed", message, next, ...report });
  process.stderr.write(`error: ${message}\nnext: ${next}\n`);
  process.exitCode = EXIT.INVALID;
}

/* ---------------------------------------------------------- brief-data */

function rangeOf(spec) {
  const today = isoDate();
  const d = now();
  if (!spec || spec === "today") return { from: today, to: today, label: "today", covers: today };
  if (spec === "full") return { from: null, to: today, label: "so far", covers: `everything to ${today}` };
  if (spec === "this-week") {
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    const from = isoDate(monday);
    return { from, to: today, label: "this week", covers: `${from} to ${today}` };
  }
  const real = (s) => {
    const [y, mo, da] = s.split("-").map(Number);
    const dt = new Date(y, mo - 1, da);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== da) fail(EXIT.USAGE, "bad-date", `${s} is not a calendar date.`, "Use YYYY-MM-DD.");
    return s;
  };
  let m = spec.match(/^since:(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    real(m[1]);
    if (m[1] > today) fail(EXIT.USAGE, "bad-range", `since:${m[1]} is in the future (today is ${today}).`, "Pick a date on or before today.");
    return { from: m[1], to: today, label: `since ${m[1]}`, covers: `${m[1]} to ${today}` };
  }
  m = spec.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
  if (m) {
    real(m[1]);
    real(m[2]);
    if (m[1] > m[2]) fail(EXIT.USAGE, "bad-range", `${m[1]} is after ${m[2]}.`, "Write the earlier date first.");
    return { from: m[1], to: m[2], label: `${m[1]} to ${m[2]}`, covers: `${m[1]} to ${m[2]}` };
  }
  fail(EXIT.USAGE, "bad-range", `Unknown range "${spec}".`, "Use today, this-week, full, since:YYYY-MM-DD or YYYY-MM-DD..YYYY-MM-DD.");
}

function rejectedLines(answerBody) {
  // The "Rejected" block of an answer, as written: the agent compresses it to one line each.
  const m = answerBody.match(/\*\*Rejected\.?\*\*\.?\s*\r?\n([\s\S]*?)(?=\r?\n\s*\*\*[A-Z]|\r?\n## |$)/);
  if (!m) return [];
  return m[1].split(/\r?\n(?=\s*[-*] )/).map((s) => s.replace(/^\s*[-*]\s*/, "").replace(/\s*\r?\n\s*/g, " ").trim()).filter(Boolean);
}

async function cmdBriefData(loc, args) {
  const map = parseMap(requireMap(loc));
  const questions = loadQuestions(loc);
  const byNN = derive(questions);
  const range = rangeOf(args.range);
  const inRange = (date) => !!date && (!range.from || date >= range.from) && date <= range.to;
  const decided = questions
    .filter((q) => q.state === "resolved" && inRange(q.resolved))
    .map((q) => ({ name: q.name, resolved: q.resolved, gist: q.gist, rejected: rejectedLines(q.answerBody), hardToReverse: q.locked }));
  const resolvedInRange = new Set(questions.filter((q) => q.state === "resolved" && inRange(q.resolved)).map((q) => q.nn));
  const f = frontierOf(questions, byNN);
  const ready = f.frontier.map((x) => {
    const q = byNN.get(x.nn);
    const landed = q.blockedBy.filter((b) => resolvedInRange.has(b)).map((b) => ({ name: byNN.get(b).name, resolved: byNN.get(b).resolved }));
    return { name: x.name, ...(landed.length ? { justUnblockedBy: landed } : {}) };
  });
  // Briefs never show an NN: a blocker whose file is gone reads as such.
  const waiting = f.blocked.map((b) => ({ name: displayName(map, byNN.get(b.nn)), waitingOn: b.blockedBy.map((x) => x.name || "a question that no longer exists") }));
  const c = counts(questions, map);
  const cleared = /^cleared$/i.test(map.status || "");
  const file = `${loc.relPf}/briefs/brief-${isoDate().replace(/-/g, "")}.md`;
  out({
    ok: true,
    file,
    exists: fs.existsSync(path.join(loc.root, file)),
    drift: drift(questions, map),
    undatedResolved: questions.filter((q) => q.state === "resolved" && !q.resolved).map((q) => q.name),
    title: `${loc.idea.replace(/-/g, " ").replace(/^./, (s) => s.toUpperCase())} - decisions brief`,
    covers: range.covers,
    decidedHeading: `Decided ${range.label}`,
    progress: `${c.resolved} of ${c.total} decisions made`,
    destination: map.destination,
    decided,
    // Link markup dropped (a brief has no links); placeholder bullets ("None yet.") skipped.
    // A link text may hold one level of brackets ("Retention [legal] hold").
    ruledOut: map.outOfScope.map((b) => b.replace(/\[((?:[^[\]]|\[[^\]]*\])+)\]\([^)]*\)/g, "$1")).filter((b) => !/^(none|nothing)\b[^—:]*\.?$/i.test(b.trim())),
    ready,
    waiting,
    fog: map.fog,
    confidence: confidenceLine(map.scores),
    nextStep: cleared ? { plan: map.plan, command: "/plan2code-1-plan" } : { command: `/plan2code-0-pathfinder ${loc.relPf}` },
    pointer: `${loc.relPf}/questions/`,
    ...(decided.length ? {} : { note: "No decisions were recorded in this period." }),
  });
}

/* ---------------------------------------------------------------- main */

run(USAGE, async (argv) => {
  const args = parseArgs(argv, {
    booleans: ["dry-run", "text", "heavy"],
    values: ["root", "form", "reason", "range", "resolved-this-session"],
    lists: ["item"],
  });
  const cmd = args._[0];
  const commands = {
    reconcile: cmdReconcile,
    frontier: cmdFrontier,
    claim: cmdClaim,
    resolve: cmdResolve,
    "rule-out": cmdRuleOut,
    trail: cmdTrail,
    gate: cmdGate,
    lint: cmdLint,
    "brief-data": cmdBriefData,
  };
  if (!commands[cmd]) fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", `Commands: ${Object.keys(commands).join(", ")}. Run with --help.`);
  const loc = locate(path.resolve(args.root || "."), args._[1]);
  await commands[cmd](loc, args);
});
