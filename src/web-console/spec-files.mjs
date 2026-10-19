// Plan2Code Web Console - how a spec's markdown files are read.
//
// The task markers and the task-line, checkbox and Status-line patterns, in
// one place, so every reader of a spec counts and names its tasks the same
// way. Imported by scan.mjs (the dashboard's spec states), patches.mjs (a doc
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
 * A phase file's tasks by where they stand. The task lines when the file has
 * them, so an Acceptance Criteria checkbox is not counted as a task; every
 * checkbox in a file written before that format. `[?]` (assumed done) is
 * counted apart from `[x]`; an unknown marker is not counted at all.
 */
export function countTasks(text) {
  const lines = (text || "").split(/\r?\n/);
  const tasks = lines.filter((l) => TASK_LINE_RE.test(l));
  let done = 0;
  let assumed = 0;
  let open = 0;
  for (const line of tasks.length ? tasks : lines) {
    const m = line.match(CHECKBOX_RE);
    if (!m) continue;
    if (m[1] === "x" || m[1] === "X") done++;
    else if (m[1] === "?") assumed++;
    else if (m[1] === " " || m[1] === "/" || m[1] === "!") open++;
  }
  return { done, assumed, open, total: done + assumed + open };
}
