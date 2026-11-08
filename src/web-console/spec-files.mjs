// Plan2Code Web Console - how a spec's markdown files are read.
//
// The task markers and the task-line, checkbox and Status-line patterns, in
// one place, so every reader of a spec counts and names its tasks the same
// way, and deriveSpecState(), the one rule for a documented spec's state.
// Imported by scan.mjs (the dashboard's spec states), patches.mjs (a doc
// block's `select: "tasks"`) and src/skill-scripts/specs.mjs (through
// consoleModule(), so the installed skill reads with this same copy). No
// imports and nothing runs at load but building the patterns.

// What each checkbox marker means on a task line.
export const MARKERS = Object.freeze({ " ": "pending", "/": "in-progress", x: "complete", X: "complete", "!": "blocked", "?": "assumed" });

// A phase file's task line (`- [ ] **Task 1.2:**`, `* [x] **Task 1.2:**` or
// `1. [/] **Task 1.2:**`). The scan counts by it, and patches.mjs keeps only
// these lines for a doc block's `select: "tasks"`. Same line shape as
// TASK_ID_RE and CHECKBOX_RE (one space before the box, a capital Task), so a
// line the scan counts is one specs.mjs counts too.
export const TASK_LINE_RE = /^\s*(?:[-*]|\d+\.) \[.\]\s+\*\*Task\s/;

// A task line taken apart: the marker, the phase number, the task (2.3, a
// lettered sub-task 3.6a, or a named one such as a testing task 1.T) and the
// sub-task suffix.
export const TASK_ID_RE = /^\s*(?:[-*]|\d+\.) \[(.)\]\s+\*\*Task\s+(\d+)\.(\d+|[A-Za-z]+)([a-z]*)\b/;

// Any checkbox list item, task or not; group 1 is the marker.
export const CHECKBOX_RE = /^\s*(?:[-*]|\d+\.) \[(.)\]/;

// The Status line in any of the forms people write it: **Status:**, **Status**:
// or a plain Status:, optionally as a list item. Groups: everything up to the
// value (kept as written when the value is rewritten), the value, trailing
// blanks. A CRLF file's `\r` is never in the value: a multiline `$` stops
// before it.
export const STATUS_RE = /^([ \t]*(?:[-*][ \t]*)?(?:\*\*Status:\*\*|\*\*Status\*\*:|Status:)[ \t]*)(.+?)([ \t]*)$/m;

/** A spec file's Status line value, or null when it has none. */
export function statusOf(text) {
  const m = (text || "").match(STATUS_RE);
  return m ? m[2] : null;
}

/**
 * The Phase Checklist rows of an overview.md as `[{ number, marker, name }]`
 * (the first "Phase N" on each checkbox line names the phase), in file order;
 * empty when there is no checklist. Read-only facts for the loop's setup
 * screen: the scripts that write the marks stay src/skill-scripts/specs.mjs.
 */
export function phaseChecklist(overview) {
  const lines = (overview || "").split(/\r?\n/);
  const at = lines.findIndex((l) => /^#{1,6}\s+.*Phase Checklist/i.test(l));
  if (at < 0) return [];
  // The section runs to the next heading of the same or a higher level, so a
  // sub-heading inside the checklist does not cut it short.
  const level = lines[at].match(/^#+/)[0].length;
  const rows = [];
  for (let i = at + 1; i < lines.length; i++) {
    const heading = lines[i].match(/^(#+)\s/);
    if (heading && heading[1].length <= level) break;
    const box = lines[i].match(CHECKBOX_RE);
    if (!box) continue;
    const text = lines[i]
      .replace(CHECKBOX_RE, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const num = text.match(/\bPhase\s+(\d+)\b/i);
    if (!num) continue;
    const after = text.slice(num.index + num[0].length).replace(/^\s*[:\-–—]\s*/, "");
    const name = after.split(/\s+[-–—]\s+|\s+\(|\s+_\(|:\s|\s+see\s+phase-/i)[0].replace(/\s*phase-\d+\.md\s*$/i, "").trim();
    rows.push({ number: Number(num[1]), marker: box[1], name: name.replace(/\s*\[Milestone[^\]]*\]\s*$/i, "") || `Phase ${num[1]}` });
  }
  return rows;
}

/**
 * A spec folder's phase files by phase number, from its file names: the
 * `phase-<N>...md` files, one per number. When a number has several files
 * the exact `phase-<N>.md` wins, else the first by name; the rest are listed
 * in the map's `extra` (number -> names). The one rule for which files are a
 * spec's phases, shared by the dashboard scan and specs.mjs.
 */
export function pickPhaseFiles(names) {
  const files = new Map();
  const extra = new Map();
  for (const name of [...(names || [])].sort()) {
    const m = name.match(/^phase-(\d+)\b[^/]*\.md$/i);
    if (!m) continue;
    const n = Number(m[1]);
    const exact = new RegExp(`^phase-0*${n}\\.md$`, "i").test(name);
    if (!files.has(n)) files.set(n, name);
    else if (exact) {
      (extra.get(n) || extra.set(n, []).get(n)).push(files.get(n));
      files.set(n, name);
    } else (extra.get(n) || extra.set(n, []).get(n)).push(name);
  }
  files.extra = extra;
  return files;
}

// A written reason on a blocked task: "BLOCKED: <why>" (Implementation
// Mode's blocker format) or "Reason: <why>", on the task line or under it.
export const BLOCK_REASON_RE = /\b(?:blocked|reason)\s*:\s*\S/i;

/**
 * A phase file's tasks by where they stand. The task lines when the file has
 * them, so an Acceptance Criteria checkbox is not counted as a task; every
 * checkbox in a file written before that format. `[?]` (assumed done) is
 * counted apart from `[x]`, `[!]` (blocked) apart from the open ones, and an
 * unknown marker (`[~]`) is open: it is not done. `bare` counts the blocked
 * tasks with no written reason (BLOCK_REASON_RE) on their line or under it.
 */
export function countTasks(text) {
  const lines = (text || "").split(/\r?\n/);
  const hasTasks = lines.some((l) => TASK_LINE_RE.test(l));
  let done = 0;
  let assumed = 0;
  let open = 0;
  let blocked = 0;
  let bare = 0;
  lines.forEach((line, i) => {
    if (hasTasks && !TASK_LINE_RE.test(line)) return;
    const m = line.match(CHECKBOX_RE);
    if (!m) return;
    if (m[1] === "x" || m[1] === "X") done++;
    else if (m[1] === "?") assumed++;
    else if (m[1] === "!") {
      blocked++;
      // The task's body runs to the next heading or checkbox.
      let end = i + 1;
      while (end < lines.length && !/^#{1,6}\s/.test(lines[end]) && !CHECKBOX_RE.test(lines[end])) end++;
      if (!BLOCK_REASON_RE.test(line.replace(CHECKBOX_RE, "")) && !BLOCK_REASON_RE.test(lines.slice(i + 1, end).join("\n"))) bare++;
    } else open++;
  });
  return { done, assumed, open, blocked, bare, total: done + assumed + open + blocked };
}

/**
 * A documented spec's state, from its overview.md text (or null) and its
 * phase files' texts (`[{ number, text }]`, one per phase number, as
 * pickPhaseFiles() picks them). The one derivation the dashboard scan and
 * specs.mjs both use, so they cannot drift:
 *
 * - `built`: no task is open or blocked, at least one is done, and every
 *   phase the Phase Checklist lists as not yet approved has a phase file with
 *   tasks in it.
 * - `building`: some task is done but the spec is not built. Blocked tasks
 *   are named in `detail`; when they are all that is left and each carries a
 *   written reason, `finalizeReady` is true (the dashboard lights Finalize).
 * - `documented`: nothing done yet.
 *
 * Returns { state, detail, done, assumed, open, blocked, bare, total,
 * unwritten, finalizeReady }, where `unwritten` lists the phase numbers the
 * checklist names as open with no phase file, or with a phase file holding
 * no tasks.
 */
export function deriveSpecState({ overview = null, phases = [] } = {}) {
  const rows = overview == null ? [] : phaseChecklist(overview);
  const approved = (n) => rows.some((r) => r.number === n && (r.marker === "x" || r.marker === "X" || r.marker === "?"));
  const sum = { done: 0, assumed: 0, open: 0, blocked: 0, bare: 0, total: 0 };
  const unwritten = [];
  const numbers = new Set();
  for (const p of phases) {
    numbers.add(p.number);
    const n = countTasks(p.text);
    for (const k of Object.keys(sum)) sum[k] += n[k];
    if (n.total === 0 && !approved(p.number)) unwritten.push(p.number);
  }
  for (const r of rows) if (!numbers.has(r.number) && !approved(r.number) && !unwritten.includes(r.number)) unwritten.push(r.number);
  unwritten.sort((a, b) => a - b);
  const finished = sum.done + sum.assumed;
  const assumedNote = sum.assumed > 0 ? `, ${sum.assumed} assumed` : "";
  const blockedNote = sum.blocked > 0 ? `, ${sum.blocked} blocked` : "";
  const unwrittenNote = unwritten.length ? `, Phase ${unwritten.join(", ")} not written up` : "";
  const base = { ...sum, unwritten, finalizeReady: false };
  if (finished > 0 && sum.open === 0 && sum.blocked === 0 && !unwritten.length) {
    return { ...base, state: "built", detail: `all tasks done${assumedNote}` };
  }
  if (finished > 0) {
    const finalizeReady = sum.open === 0 && sum.blocked > 0 && sum.bare === 0 && !unwritten.length;
    return { ...base, finalizeReady, state: "building", detail: `${finished} of ${sum.total} tasks done${assumedNote}${blockedNote}${unwrittenNote}` };
  }
  const count = phases.length;
  return { ...base, state: "documented", detail: `${count} phase${count === 1 ? "" : "s"}, ${sum.total || "?"} tasks ready` };
}
