#!/usr/bin/env node
// specs.mjs: where every spec under specs/ stands, read from its files.
//
// The pipeline skills (plan, document, implement, revise-plan, finalize,
// review, handoff) all need the same filesystem facts: which specs exist, what
// a spec's PLAN-DRAFT says, which phases are open, how many tasks are done.
// Those have one correct answer, so this script computes them instead of each
// prompt re-deriving them by hand. It also performs the two mechanical writes
// (a Phase Checklist marker, the archive move), with --dry-run.
//
// Shell listing only matters to people: specs/ is gitignored, so editor search
// tools skip it. This script reads the disk directly and does not care.

import fs from "node:fs";
import path from "node:path";
import { EXIT, fail, out, parseArgs, run, readText, isDir, rel, eol, consoleLib, isoDate, phaseFiles } from "./common.mjs";

const USAGE = `
specs.mjs: spec state for the Plan2Code pipeline skills. JSON on stdout.

  node specs.mjs list [--root <dir>]
      Every active spec under specs/ (never specs--completed/), newest first:
      state, detail, PLAN-DRAFT files with their **Status:** line, overview,
      phase count. Also the names already archived in specs--completed/.

  node specs.mjs status <spec> [--root <dir>]
      One spec in full: the overview's Phase Checklist, Parallel Execution
      Groups, per-phase task counts by marker, task-numbering problems,
      completion, the implement phase-selection verdict ("next"), the pending
      phases, and consistency checks. <spec> is specs/<name>, <name>, or a path
      to its overview.md.

  node specs.mjs metrics <spec> --step document|finalize [--set key=value ...]
      The METRICS_JSON comment for that step, countable fields computed from
      the files; judgment fields come from --set (numbers only).
      document: total_tasks, tasks_per_phase, phase_count,
                parallel_groups_identified computed; pass
                --set verification_items_added=N (your Verification Summary's
                Added total; the VERIFICATION comments are reported as a check).
      finalize: completion_rate_at_audit, tasks_completed, tasks_total; pass
                --set verification_failures_found=N
                --set documentation_updates_needed=N.

  node specs.mjs mark <spec> --phase <N> --to open|in-progress|done [--dry-run]
      Set phase N's Phase Checklist marker in overview.md ([ ], [/], [x]).
      done also sets the phase file's Status line (**Status:**, **Status**:
      or Status:) to Complete (and warns if tasks are unfinished); open on a
      Complete phase sets it to In Progress. Warns when the phase file has no
      Status line. Refuses a phase with duplicate checklist rows, and refuses
      in-progress -> open (started work stays marked).

  node specs.mjs archive <spec> [--dry-run]
      Move specs/<name>/ to specs--completed/<name>/. Refuses if the target
      exists, or if <spec> is not a folder directly under specs/.

Markers: [ ] pending · [/] in progress · [x] complete · [!] blocked · [?] assumed.
Exit: 0 ok · 2 bad arguments · 3 spec not found · 4 cannot parse / check
failed · 5 refused.
`;

/* ------------------------------------------------------------- resolving */

function realOrResolved(p) {
  try {
    return fs.realpathSync.native(p);
  } catch {
    return path.resolve(p);
  }
}

const samePath = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);

// Read-only commands (status, metrics) accept an archived spec, because
// Finalize reads its own spec after Step 6 moved it. Writes never do.
function resolveSpec(root, arg, { allowArchived = false } = {}) {
  if (!arg) fail(EXIT.USAGE, "missing-spec", "Name the spec: specs/<name>, <name>, or its overview.md path.", "Run `specs.mjs list` to see the active specs.");
  let p = arg.replace(/\\/g, "/").replace(/\/+$/, "");
  if (/\/overview\.md$/i.test(p) || /\/phase-[^/]*\.md$/i.test(p)) p = p.replace(/\/[^/]+$/, "");
  const abs = path.isAbsolute(p) ? p : p.includes("/") ? path.join(root, p) : path.join(root, "specs", p);
  const relPath = rel(root, abs);
  if (!allowArchived && /(^|\/)specs--completed(\/|$)/.test(relPath)) {
    fail(EXIT.REFUSED, "archived-spec", `${relPath} is archived; the pipeline only changes active specs under specs/.`, "Pick an active spec from `specs.mjs list`.");
  }
  // A spec is a folder directly under specs/ (or specs--completed/ for a read).
  // Without this, `archive .` would move all of specs/ and `archive ./src` a
  // source folder.
  const homes = [path.join(root, "specs"), ...(allowArchived ? [path.join(root, "specs--completed")] : [])].map(realOrResolved);
  const parent = realOrResolved(path.dirname(path.resolve(abs)));
  if (!homes.some((h) => samePath(h, parent))) {
    fail(EXIT.REFUSED, "not-a-spec", `${relPath} is not a spec folder: a spec sits directly under specs/${allowArchived ? " (or specs--completed/)" : ""}.`, "Pass specs/<name> or <name>; run `specs.mjs list` to see the active specs.");
  }
  if (!isDir(abs)) {
    fail(EXIT.NOT_FOUND, "spec-not-found", `No spec folder at ${relPath}.`, "Run `specs.mjs list` from the project root (or pass --root) to see the active specs.");
  }
  return { dir: abs, rel: relPath, name: path.basename(abs) };
}

/* -------------------------------------------------------------- parsing */

const MARKERS = { " ": "pending", "/": "in-progress", x: "complete", X: "complete", "!": "blocked", "?": "assumed" };
// Task 2.3, a lettered sub-task 3.6a, or a named one such as a testing task 1.T.
const TASK_RE = /^\s*[-*] \[(.)\]\s+\*\*Task\s+(\d+)\.(\d+|[A-Za-z]+)([a-z]*)\b/;
const CHECKBOX_RE = /^\s*[-*] \[(.)\]/;
// The Status line in any of the forms people write it: **Status:**, **Status**:
// or a plain Status:, optionally as a list item. Groups: everything up to the
// value (kept as written when the value is rewritten), the value, trailing blanks.
const STATUS_RE = /^([ \t]*(?:[-*][ \t]*)?(?:\*\*Status:\*\*|\*\*Status\*\*:|Status:)[ \t]*)(.+?)([ \t]*)$/m;

function statusOf(text) {
  const m = (text || "").match(STATUS_RE);
  return m ? m[2] : null;
}

/** A markdown section's lines: from its heading to the next heading of the same or higher level. */
function section(text, headingRe) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /^#{1,6}\s/.test(l) && headingRe.test(l));
  if (start === -1) return null;
  const level = lines[start].match(/^#+/)[0].length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#+)\s/);
    if (m && m[1].length <= level) {
      end = i;
      break;
    }
  }
  return { start, end, lines: lines.slice(start + 1, end) };
}

function plainText(s) {
  return s
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Phase Checklist rows: the first "Phase N" on each checkbox line names the phase. */
function parseChecklist(overview) {
  const sec = section(overview, /Phase Checklist/i);
  if (!sec) return { found: false, phases: [], unparsed: [] };
  const phases = [];
  const unparsed = [];
  sec.lines.forEach((line, i) => {
    const m = line.match(CHECKBOX_RE);
    if (!m) return;
    const text = plainText(line.replace(CHECKBOX_RE, ""));
    const num = text.match(/\bPhase\s+(\d+)\b/i);
    if (!num) {
      unparsed.push({ line: sec.start + 2 + i, text: line.trim() });
      return;
    }
    const after = text.slice(num.index + num[0].length).replace(/^\s*[:\-–—]\s*/, "");
    const name = after.split(/\s+[-–—]\s+|\s+\(|\s+_\(|:\s|\s+see\s+phase-/i)[0].replace(/\s*phase-\d+\.md\s*$/i, "").trim();
    phases.push({
      number: Number(num[1]),
      marker: m[1],
      state: MARKERS[m[1]] || "unknown",
      name: name.replace(/\s*\[Milestone[^\]]*\]\s*$/i, "") || `Phase ${num[1]}`,
      line: sec.start + 2 + i,
    });
  });
  return { found: true, phases, unparsed };
}

/** "2, 3", "2-4" and "2–4" (or an em dash) alike: ranges expand, so a group cell never loses a phase. */
function phaseList(cell) {
  const outList = [];
  for (const part of cell.match(/\d+\s*[-–\u2014]\s*\d+|\d+/g) || []) {
    const r = part.match(/^(\d+)\s*[-–\u2014]\s*(\d+)$/);
    if (r && Number(r[2]) >= Number(r[1]) && Number(r[2]) - Number(r[1]) < 100) {
      for (let n = Number(r[1]); n <= Number(r[2]); n++) outList.push(n);
    } else outList.push(...part.match(/\d+/g).map(Number));
  }
  return [...new Set(outList)];
}

/** Parallel Execution Groups table: real groups only (a named group with 2+ phases). */
function parseGroups(overview) {
  const sec = section(overview, /Parallel Execution Groups/i);
  if (!sec) return { found: false, groups: [] };
  const groups = [];
  const seen = new Set();
  for (const line of sec.lines) {
    if (!/^\s*\|/.test(line) || /^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    if (cells.length < 2 || /^group$/i.test(cells[0])) continue;
    const id = plainText(cells[0]);
    const phases = phaseList(cells[1]);
    // "None", a dash, a single phase, a group its author labelled sequential
    // ("A (sequential)"), or a Phases cell written as a chain ("1 → 2") is not
    // a parallel group.
    if (!id || /^(none|-|–|—)$/i.test(id) || /\bsequential\b/i.test(id) || /→|->|\bthen\b/i.test(cells[1]) || phases.length < 2) continue;
    const key = `${id}:${phases.join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    groups.push({ id, phases, reason: plainText(cells[2] || "") });
  }
  return { found: true, groups };
}

function firstSentence(text) {
  const t = plainText(text);
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  return (m ? m[1] : t).slice(0, 240);
}

function parsePhaseFile(file, number) {
  const text = readText(file) || "";
  const lines = text.split(/\r?\n/);
  const title = (lines.find((l) => /^#\s/.test(l)) || "").replace(/^#\s+/, "").trim();
  const status = statusOf(text);
  const counts = { pending: 0, "in-progress": 0, complete: 0, blocked: 0, assumed: 0, unknown: 0 };
  const tasks = [];
  const strayCheckboxes = [];
  const unmatchedTasks = [];
  let heading = "";
  lines.forEach((line, i) => {
    const h = line.match(/^#{1,6}\s+(.*)$/);
    if (h) heading = plainText(h[1]);
    const t = line.match(TASK_RE);
    if (t) {
      const state = MARKERS[t[1]] || "unknown";
      counts[state]++;
      const named = !/^\d+$/.test(t[3]);
      tasks.push({ id: `${t[2]}.${t[3]}${t[4]}`, phase: Number(t[2]), seq: named ? null : Number(t[3]), named, suffix: t[4], marker: t[1], state, line: i + 1 });
      return;
    }
    // A line that looks like a task but is not counted as one (Task 1.4A,
    // "1. [ ] **Task", a non-bold "- [ ] Task 1.3") would make the audit undercount.
    if (/^\s*(?:[-*]|\d+\.)\s+\[.\].*\bTask\s+\d+\./i.test(line)) unmatchedTasks.push({ line: i + 1, text: line.trim().slice(0, 120) });
    if (CHECKBOX_RE.test(line)) strayCheckboxes.push({ line: i + 1, section: heading, text: line.trim().slice(0, 120) });
  });

  // Numbering: every task belongs to this phase, the base numbers run 1..n with
  // no gaps or repeats, and a lettered task (3.6a) sits after its base (3.6).
  // Named tasks (1.T) are outside the numeric sequence.
  const numbering = [];
  const bases = [];
  for (const t of tasks) {
    if (t.phase !== number) numbering.push(`Task ${t.id} is in phase-${number}.md but numbered for Phase ${t.phase}`);
    if (!t.suffix && !t.named) bases.push(t.seq);
  }
  const seenIds = new Set();
  for (const t of tasks) {
    if (seenIds.has(t.id)) numbering.push(`Task ${t.id} appears more than once`);
    seenIds.add(t.id);
    if (t.suffix && !t.named && !bases.includes(t.seq)) numbering.push(`Task ${t.id} has no base Task ${t.phase}.${t.seq}`);
  }
  bases.forEach((seq, i) => {
    if (seq !== i + 1 && !numbering.some((n) => n.startsWith("Task numbering"))) {
      numbering.push(`Task numbering is not sequential: expected ${number}.${i + 1}, found ${number}.${seq}`);
    }
  });

  const overviewSec = section(text, /^#{1,6}\s+Overview\b/i);
  const goalText = overviewSec ? overviewSec.lines.join("\n").split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^[-*|>]/.test(p)) : "";
  return {
    title,
    status,
    goal: goalText ? firstSentence(goalText) : null,
    total: tasks.length,
    counts,
    open: counts.pending + counts["in-progress"] + counts.blocked + counts.unknown,
    // Open work a phase cannot be approved over; blocked tasks may stand ([!] is allowed at sign-off).
    unfinished: counts.pending + counts["in-progress"] + counts.unknown,
    tasks,
    numbering,
    strayCheckboxes,
    unmatchedTasks,
  };
}

function planDrafts(dir) {
  return fs
    .readdirSync(dir)
    .filter((n) => /^PLAN-DRAFT.*\.md$/i.test(n))
    .sort()
    .map((file) => ({
      file,
      archived: /-prev\.md$/i.test(file),
      status: statusOf(readText(path.join(dir, file))),
    }));
}

/* ---------------------------------------------------------------- status */

function specStatus(spec) {
  const overviewPath = path.join(spec.dir, "overview.md");
  const overview = readText(overviewPath);
  const files = phaseFiles(spec.dir);
  // An empty overview.md still exists; only a missing one is "no overview".
  const hasOverview = overview !== null;
  const checklist = hasOverview ? parseChecklist(overview) : { found: false, phases: [], unparsed: [] };
  const groups = hasOverview ? parseGroups(overview) : { found: false, groups: [] };
  const checks = [];
  const check = (level, code, message) => checks.push({ level, code, message });
  for (const [n, names] of files.extra) {
    check("warn", "duplicate-phase-file", `Phase ${n} has more than one file: using ${files.get(n)}, ignoring ${names.join(", ")}`);
  }
  const rowsByNumber = new Map();
  for (const r of checklist.phases) rowsByNumber.set(r.number, [...(rowsByNumber.get(r.number) || []), r]);
  for (const [n, rows] of rowsByNumber) {
    if (rows.length > 1) check("error", "duplicate-checklist-row", `Phase ${n} has ${rows.length} rows in the Phase Checklist (overview.md lines ${rows.map((r) => r.line).join(", ")}); the first one is used`);
  }

  const phases = [];
  const numbers = new Set([...checklist.phases.map((p) => p.number), ...files.keys()]);
  for (const number of [...numbers].sort((a, b) => a - b)) {
    const row = checklist.phases.find((p) => p.number === number) || null;
    const file = files.get(number) || null;
    const parsed = file ? parsePhaseFile(path.join(spec.dir, file), number) : null;
    phases.push({
      number,
      name: row ? row.name : parsed ? parsed.title.replace(/^Phase\s+\d+\s*[:\-–—]?\s*/i, "") : `Phase ${number}`,
      checklist: row ? row.state : null,
      marker: row ? row.marker : null,
      file,
      status: parsed ? parsed.status : null,
      goal: parsed ? parsed.goal : null,
      tasks: parsed ? { total: parsed.total, open: parsed.open, ...parsed.counts } : null,
      blockedTasks: parsed ? parsed.tasks.filter((t) => t.state === "blocked").map((t) => t.id) : [],
      assumedTasks: parsed ? parsed.tasks.filter((t) => t.state === "assumed").map((t) => t.id) : [],
      openTasks: parsed ? parsed.tasks.filter((t) => ["pending", "in-progress", "blocked", "unknown"].includes(t.state)).map((t) => t.id) : [],
    });
    if (!row && hasOverview) check("error", "missing-checklist-row", `phase-${number}.md has no row in overview.md's Phase Checklist`);
    if (row && !file) check("error", "missing-phase-file", `Phase Checklist lists Phase ${number} but there is no phase-${number}.md`);
    if (parsed) {
      for (const n of parsed.numbering) check("error", "task-numbering", `phase-${number}.md: ${n}`);
      // Prerequisites and criteria are plain bullets by rule; other checkbox
      // blocks (a Phase Testing list) are the template's own and are not tasks.
      for (const s of parsed.strayCheckboxes.filter((c) => /prerequisite|criteria/i.test(c.section))) {
        check("warn", "criteria-checkbox", `phase-${number}.md:${s.line} is a checkbox under "${s.section}"; prerequisites and criteria use plain bullets`);
      }
      if (parsed.total === 0) check("warn", "no-tasks", `phase-${number}.md has no **Task ${number}.N:** checkbox lines`);
      for (const u of parsed.unmatchedTasks) {
        check("warn", "uncounted-task", `phase-${number}.md:${u.line} looks like a task but is not counted (a task line is "- [ ] **Task ${number}.N:**"): ${u.text}`);
      }
      const done = parsed.counts.complete + parsed.counts.assumed;
      const rowDone = row && (row.state === "complete" || row.state === "assumed");
      // A phase may be approved with blocked [!] tasks left (Implementation
      // Mode's self-review allows "[x] or blocked [!]"); only unfinished work is an error.
      if (rowDone && parsed.unfinished > 0) {
        check("error", "checked-with-open-tasks", `Phase ${number} is [${row.marker}] in overview.md but ${parsed.unfinished} task(s) are not done (${phases.at(-1).openTasks.filter((id) => !phases.at(-1).blockedTasks.includes(id)).join(", ")})`);
      } else if (rowDone && parsed.counts.blocked > 0) {
        check("info", "approved-with-blocked", `Phase ${number} is [${row.marker}] with ${parsed.counts.blocked} blocked task(s) (${phases.at(-1).blockedTasks.join(", ")})`);
      }
      if (row && row.state === "pending" && parsed.total > 0 && done > 0) {
        // Done tasks under a [ ] phase with work still open is what a re-opened
        // phase looks like (revise-plan); with nothing open it is a missed mark.
        if (parsed.unfinished > 0) check("info", "partly-done-unchecked", `Phase ${number} is [ ] with ${done} task(s) done and ${parsed.unfinished} open (normal for a re-opened phase)`);
        else check("warn", "unchecked-with-done-tasks", `Phase ${number} is [ ] in overview.md but all ${done} unblocked task(s) are done`);
      }
      if (row && !rowDone && row.state !== "pending" && parsed.total > 0 && parsed.unfinished === 0) {
        check("info", "done-not-approved", `Phase ${number}: every task is done but overview.md still shows [${row.marker}] (normal until the user approves the phase)`);
      }
    }
  }
  if (!hasOverview) check("error", "no-overview", `${spec.rel} has no overview.md`);
  else if (!checklist.found) check("error", "no-checklist", "overview.md has no ## Phase Checklist section");
  for (const u of checklist.unparsed) check("warn", "unparsed-checklist-row", `overview.md:${u.line} is a checkbox in the Phase Checklist with no "Phase N" in it: ${u.text}`);
  for (const g of groups.groups) {
    for (const n of g.phases) if (!numbers.has(n)) check("error", "group-unknown-phase", `Parallel group ${g.id} names Phase ${n}, which does not exist`);
  }

  // Totals. Completed = [x] plus [?] (assumed complete); [?] is reported on its own too.
  // Incomplete = [ ] + [/] (+ unreadable markers); Blocked is its own column.
  const totals = { total: 0, complete: 0, assumed: 0, pending: 0, "in-progress": 0, blocked: 0, unknown: 0 };
  for (const p of phases) if (p.tasks) for (const k of Object.keys(totals)) totals[k] += p.tasks[k] || 0;
  const completed = totals.complete + totals.assumed;
  const completion = totals.total ? completed / totals.total : null;

  return {
    ok: true,
    spec: spec.rel,
    name: spec.name,
    overview: hasOverview ? "overview.md" : null,
    planDrafts: planDrafts(spec.dir),
    phases,
    parallelGroups: groups.groups,
    totals: { ...totals, completed, incomplete: totals.pending + totals["in-progress"] + totals.unknown },
    completion: completion === null ? null : Number(completion.toFixed(4)),
    completionPercent: completion === null ? null : Math.round(completion * 100),
    next: nextPhase(phases, groups.groups, checklist.found),
    pending: phases
      .filter((p) => p.checklist && p.checklist !== "complete" && p.checklist !== "assumed")
      .map((p) => ({ number: p.number, name: p.name, state: p.checklist, tasks: p.tasks ? p.tasks.total : null, open: p.tasks ? p.tasks.open : null, goal: p.goal })),
    checks,
  };
}

/**
 * Implementation Mode's phase-selection table, applied mechanically.
 *   2+ workable phases in the same parallel group, consecutive -> choose (warn if all [/])
 *   a single [/] -> ask-resume · a single [ ] -> auto-start · nothing workable -> none
 */
function nextPhase(phases, groups, haveChecklist) {
  if (!haveChecklist) return { action: "none", reason: "no Phase Checklist in overview.md" };
  const ordered = phases.filter((p) => p.checklist);
  const isDone = (p) => p.checklist === "complete" || p.checklist === "assumed";
  const workable = ordered.filter((p) => p.checklist === "pending" || p.checklist === "in-progress");
  if (!workable.length) {
    return { action: "none", reason: ordered.length && ordered.every(isDone) ? "every phase is complete" : "no [ ] or [/] phase in the Phase Checklist" };
  }
  const first = workable[0];
  const brief = (p) => ({ number: p.number, name: p.name, state: p.checklist, tasks: p.tasks ? p.tasks.total : null });
  // A blocked [!] phase ahead of the pick is skipped, but never silently.
  const skipped = ordered.slice(0, ordered.indexOf(first)).filter((p) => !isDone(p)).map(brief);
  const note = skipped.length ? { skipped, warning: `skipping ${skipped.map((p) => `Phase ${p.number} [${p.state}]`).join(", ")} ahead of it` } : {};
  const group = groups.find((g) => g.phases.includes(first.number));
  if (group) {
    // Consecutive same-group incomplete phases, in checklist order, starting at the first workable one.
    const run = [];
    for (const p of ordered.slice(ordered.indexOf(first))) {
      if (!group.phases.includes(p.number)) break;
      if (isDone(p)) continue;
      if (p.checklist === "pending" || p.checklist === "in-progress") run.push(p);
      else break;
    }
    if (run.length >= 2) {
      const allStarted = run.every((p) => p.checklist === "in-progress");
      const warnings = [
        ...(allStarted ? ["every option is already [/]: another agent may be working on it, so picking one risks duplicated work"] : []),
        ...(note.warning ? [note.warning] : []),
      ];
      return {
        action: "choose",
        group: group.id,
        options: run.map(brief),
        ...(note.skipped ? { skipped: note.skipped } : {}),
        ...(warnings.length ? { warning: warnings.join("; ") } : {}),
      };
    }
  }
  return { action: first.checklist === "in-progress" ? "ask-resume" : "auto-start", phase: brief(first), ...note };
}

/* --------------------------------------------------------------- commands */

async function cmdList(args) {
  const root = path.resolve(args.root || ".");
  const { scanProject } = await consoleLib();
  const scan = scanProject(root);
  const specs = scan.specs.map((s) => {
    const dir = path.join(root, s.dir);
    let names = [];
    try {
      names = fs.readdirSync(dir);
    } catch {}
    return {
      dir: s.dir,
      name: s.name,
      state: s.state,
      detail: s.detail,
      touched: s.touched ? new Date(s.touched).toISOString() : null,
      planDrafts: planDrafts(dir),
      overview: names.includes("overview.md"),
      phaseFiles: names.filter((n) => /^phase-\d+\b.*\.md$/i.test(n)).length,
      pathfinder: isDir(path.join(dir, "pathfinder")),
    };
  });
  let completed = [];
  try {
    completed = fs.readdirSync(path.join(root, "specs--completed")).filter((n) => isDir(path.join(root, "specs--completed", n))).sort();
  } catch {}
  out({
    ok: true,
    root,
    hasAgents: scan.hasAgents,
    specsDir: isDir(path.join(root, "specs")),
    specs,
    completed,
    ...(specs.length ? {} : { note: "No active specs under specs/." }),
  });
}

async function cmdStatus(args) {
  const root = path.resolve(args.root || ".");
  out(specStatus(resolveSpec(root, args._[1], { allowArchived: true })));
}

function countVerificationAdded(dir) {
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    if (!/\.md$/i.test(name) || /^PLAN-/i.test(name)) continue;
    n += ((readText(path.join(dir, name)) || "").match(/<!--\s*VERIFICATION:\s*Added\b/gi) || []).length;
  }
  return n;
}

async function cmdMetrics(args) {
  const root = path.resolve(args.root || ".");
  const spec = resolveSpec(root, args._[1], { allowArchived: true });
  const step = args.step;
  if (step !== "document" && step !== "finalize") fail(EXIT.USAGE, "bad-step", "--step must be document or finalize.", "Plan's METRICS_JSON is written by hand in its Phase 7.");
  const sets = {};
  for (const kv of args.set || []) {
    const m = kv.match(/^([a-z_]+)=(-?\d+(?:\.\d+)?)$/);
    if (!m) fail(EXIT.USAGE, "bad-set", `--set ${kv} is not key=number.`, "Example: --set verification_failures_found=1");
    sets[m[1]] = Number(m[2]);
  }
  // --set supplies the judgment fields only; the computed ones are never overridden.
  const SETTABLE = { document: ["verification_items_added"], finalize: ["verification_failures_found", "documentation_updates_needed"] };
  for (const k of Object.keys(sets)) {
    if (!SETTABLE[step].includes(k)) fail(EXIT.USAGE, "bad-set", `--set ${k} is not a field you supply for --step ${step}.`, `Only ${SETTABLE[step].join(", ")}; the rest is computed from the files.`);
  }
  const st = specStatus(spec);
  const withTasks = st.phases.filter((p) => p.tasks);
  let metrics;
  let hint;
  if (step === "document") {
    // verification_items_added is the Added total of the Verification Summary
    // you presented, not something the files record, so it comes from --set.
    // The <!-- VERIFICATION: Added --> comments are a cross-check only.
    if (!("verification_items_added" in sets)) fail(EXIT.USAGE, "missing-set", "document needs --set verification_items_added=N (the Added column total of your Verification Summary).", `The spec has ${countVerificationAdded(spec.dir)} <!-- VERIFICATION: Added --> comment(s), as a cross-check.`);
    metrics = {
      step: "document",
      total_tasks: st.totals.total,
      tasks_per_phase: withTasks.map((p) => p.tasks.total),
      phase_count: st.phases.length,
      parallel_groups_identified: st.parallelGroups.length,
      ...sets,
    };
    hint = { verificationCommentsFound: countVerificationAdded(spec.dir) };
  } else {
    const missing = ["verification_failures_found", "documentation_updates_needed"].filter((k) => !(k in sets));
    if (missing.length) fail(EXIT.USAGE, "missing-set", `finalize needs ${missing.map((k) => `--set ${k}=N`).join(" and ")}.`, "Those two counts are your judgment from Steps 2 and 4.");
    metrics = {
      step: "finalize",
      completion_rate_at_audit: st.completion === null ? 0 : Number(st.completion.toFixed(2)),
      tasks_completed: st.totals.completed,
      tasks_total: st.totals.total,
      ...sets,
    };
  }
  out({ ok: true, spec: spec.rel, metrics, comment: `<!-- METRICS_JSON ${spacedJson(metrics)} -->`, ...(hint || {}), checks: st.checks.filter((c) => c.level === "error") });
}

// The house style of every METRICS_JSON comment: {"key": value, "list": [1, 2]}.
function spacedJson(obj) {
  const v = (x) => (Array.isArray(x) ? `[${x.map(v).join(", ")}]` : x && typeof x === "object" ? spacedJson(x) : JSON.stringify(x));
  return `{${Object.entries(obj).map(([k, x]) => `${JSON.stringify(k)}: ${v(x)}`).join(", ")}}`;
}

const TO = { open: " ", "in-progress": "/", done: "x" };

async function cmdMark(args) {
  const root = path.resolve(args.root || ".");
  const spec = resolveSpec(root, args._[1]);
  const number = Number(args.phase);
  if (!Number.isInteger(number) || number < 0) fail(EXIT.USAGE, "bad-phase", "--phase needs a phase number.", "Example: --phase 2");
  if (!(args.to in TO)) fail(EXIT.USAGE, "bad-to", "--to must be open, in-progress or done.", "open = [ ], in-progress = [/], done = [x]");
  const overviewPath = path.join(spec.dir, "overview.md");
  const overview = readText(overviewPath);
  if (overview === null) fail(EXIT.NOT_FOUND, "no-overview", `${spec.rel} has no overview.md.`, "Run /plan2code-2-document first.");
  const checklist = parseChecklist(overview);
  const rows = checklist.phases.filter((p) => p.number === number);
  const row = rows[0];
  if (!row) fail(EXIT.NOT_FOUND, "no-row", `overview.md's Phase Checklist has no row for Phase ${number}.`, "Run `specs.mjs status` to see the phases it lists.");
  if (rows.length > 1) fail(EXIT.REFUSED, "duplicate-row", `Phase ${number} has ${rows.length} rows in the Phase Checklist (lines ${rows.map((r) => r.line).join(", ")}); marking one would be a guess.`, "Remove the duplicate row, then rerun.");
  const target = TO[args.to];
  if (row.marker === "/" && target === " ") {
    fail(EXIT.REFUSED, "no-reset", `Phase ${number} is [/]; started work is never reset to [ ].`, "Leave it [/] (a later session resumes it), or mark it done once approved.");
  }
  const changes = [];
  const lines = overview.split(/\r?\n/);
  const idx = row.line - 1;
  const next = lines[idx].replace(/\[(.)\]/, `[${target}]`);
  if (next !== lines[idx]) {
    lines[idx] = next;
    changes.push({ file: `${spec.rel}/overview.md`, line: row.line, from: `[${row.marker}]`, to: `[${target}]` });
  }
  // The phase file's Status line follows: done -> Complete; re-opening a Complete
  // phase -> In Progress (revise-plan), so the two files never disagree.
  let phaseText = null;
  let phasePath = null;
  let unfinished = [];
  const warnings = [];
  const file = phaseFiles(spec.dir).get(number);
  if (file) {
    phasePath = path.join(spec.dir, file);
    const text = readText(phasePath) || "";
    const parsed = parsePhaseFile(phasePath, number);
    unfinished = parsed.tasks.filter((t) => ["pending", "in-progress", "unknown"].includes(t.state)).map((t) => t.id);
    const status = statusOf(text);
    const want = target === "x" ? "Complete" : target === " " && status && /^complete$/i.test(status) ? "In Progress" : null;
    if (status && want && status !== want) {
      phaseText = text.replace(STATUS_RE, (_, before, _value, after) => before + want + after);
      changes.push({ file: `${spec.rel}/${file}`, field: "Status", from: status, to: want });
    }
    // done and open keep the Status line in step; with none to find, say so.
    if (!status && target !== "/") warnings.push(`${file} has no Status line, so only the Phase Checklist checkbox changed; add a "**Status:** <value>" line under its title.`);
  }
  if (!args["dry-run"]) {
    if (changes.some((c) => c.file.endsWith("overview.md"))) fs.writeFileSync(overviewPath, lines.join(eol(overview)));
    if (phaseText !== null) fs.writeFileSync(phasePath, phaseText);
  }
  const doneEarly = target === "x" && unfinished.length > 0;
  if (doneEarly) warnings.unshift(`Phase ${number} was marked done with ${unfinished.length} unfinished task(s): ${unfinished.join(", ")}. Mark only a phase the user approved.`);
  out({
    ok: true,
    spec: spec.rel,
    phase: number,
    name: row.name,
    dryRun: !!args["dry-run"],
    changed: changes.length > 0,
    changes,
    ...(warnings.length ? { warning: warnings.join(" ") } : {}),
    ...(doneEarly ? { unfinished } : {}),
  });
}

function listRel(dir, base = dir) {
  const outList = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) outList.push(...listRel(p, base));
    else outList.push(rel(base, p));
  }
  return outList.sort();
}

async function cmdArchive(args) {
  const root = path.resolve(args.root || ".");
  const spec = resolveSpec(root, args._[1]);
  const target = path.join(root, "specs--completed", spec.name);
  if (fs.existsSync(target)) {
    fail(EXIT.REFUSED, "target-exists", `specs--completed/${spec.name}/ already exists; nothing was moved.`, "Ask the user whether to merge by hand or archive under another name.");
  }
  const files = listRel(spec.dir);
  if (!args["dry-run"]) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      fs.renameSync(spec.dir, target);
    } catch (err) {
      // A rename across volumes (or a locked file on Windows) fails; copy then remove.
      try {
        fs.cpSync(spec.dir, target, { recursive: true, errorOnExist: true, force: false });
      } catch (copyErr) {
        fail(EXIT.INVALID, "archive-failed", `Could not move or copy ${spec.rel} (${err.code || err.message}; copy: ${copyErr.code || copyErr.message}).`, `Close anything holding files in ${spec.rel} open, check specs--completed/${spec.name} for a partial copy, then rerun.`);
      }
      try {
        fs.rmSync(spec.dir, { recursive: true, force: true });
      } catch (rmErr) {
        fail(EXIT.INVALID, "source-not-removed", `Copied to specs--completed/${spec.name}/ but could not remove ${spec.rel} (${rmErr.code || rmErr.message}); both copies now exist.`, `Close whatever holds files in ${spec.rel} open, then delete it by hand. The archive is complete.`);
      }
    }
  }
  const sourceGone = args["dry-run"] ? null : !fs.existsSync(spec.dir);
  const moved = args["dry-run"] ? null : listRel(target);
  if (!args["dry-run"] && !(sourceGone && moved.length === files.length)) {
    fail(
      EXIT.INVALID,
      "archive-unverified",
      `The move of ${spec.rel} to specs--completed/${spec.name}/ did not verify: ${moved.length} of ${files.length} file(s) at the target, and ${spec.rel} ${sourceGone ? "is gone" : "still exists"}.`,
      `Compare ${spec.rel} with specs--completed/${spec.name}/ and finish the move by hand; archive refuses to rerun while the target exists.`
    );
  }
  out({
    ok: true,
    dryRun: !!args["dry-run"],
    from: spec.rel,
    to: `specs--completed/${spec.name}`,
    files,
    ...(args["dry-run"] ? {} : { sourceRemoved: sourceGone, filesAtTarget: moved.length, archivedOn: isoDate() }),
  });
}

run(USAGE, async (argv) => {
  const args = parseArgs(argv, { booleans: ["dry-run"], values: ["root", "step", "phase", "to"], lists: ["set"] });
  const cmd = args._[0];
  const commands = { list: cmdList, status: cmdStatus, metrics: cmdMetrics, mark: cmdMark, archive: cmdArchive };
  if (!commands[cmd]) fail(EXIT.USAGE, "unknown-command", cmd ? `Unknown command "${cmd}".` : "No command given.", "Commands: list, status, metrics, mark, archive. Run with --help.");
  await commands[cmd](args);
});
