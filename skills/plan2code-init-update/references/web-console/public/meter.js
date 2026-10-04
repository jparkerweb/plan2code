// Plan2Code Web Console - the session meter's weights, count and wording.
//
// The source of truth for how much each piece of work weighs, how the count
// is folded out of ledger.ndjson, and what the pill says at each level. The
// count is never stored: it is always pointsFrom() over the ledger. No DOM
// access at module scope and no imports: the server, console.mjs, the page
// and `node --test` all import this file.

// The one place the weights live (FR-12). Tune here.
export const WEIGHTS = Object.freeze({
  "pathfinder-chart": 2,
  // Scores 0: a Pathfinder question now counts through its answers (below).
  "pathfinder-question": 0,
  // Research reads sources and hands its findings back into the context, with
  // nobody answering anything, so each research question scores on its own.
  "pathfinder-research": 1,
  plan: 2,
  "revise-plan": 1,
  document: 2,
  "implement-phase": 2,
  "implement-review-phase": 3,
  review: 2,
  "quick-task": 1,
  init: 2,
  "init-update": 2,
  finalize: 1,
  handoff: 0,
});

// Workflows whose launch itself scores WEIGHTS[workflow]. Pathfinder,
// implement and implement-review score only through the agent's `run`
// reports; dashboard and handoff never score.
export const LAUNCH_COUNTED = Object.freeze(
  new Set(["plan", "revise-plan", "document", "review", "quick-task", "init", "init-update", "finalize"])
);

const weightOf = (key) => (Object.prototype.hasOwnProperty.call(WEIGHTS, key) ? WEIGHTS[key] : 0);

// The event names an agent may report in `run`.
export const RUN_EVENTS = new Set(Object.keys(WEIGHTS));

// Built phases weigh what they did: a `run` for one of these may carry
// `tasks`, the tasks the phase completed, and then scores one point per
// TASKS_PER_POINT tasks (rounded up, at least 1), plus the event's
// TASK_BONUS for work every phase does whatever its size (the review). A
// run without `tasks` falls back to WEIGHTS. Tune here.
export const TASKS_PER_POINT = 3;
export const TASK_BONUS = Object.freeze({
  "implement-phase": 0,
  "implement-review-phase": 1,
});
export const TASK_EVENTS = Object.freeze(new Set(Object.keys(TASK_BONUS)));
// The most tasks one run may report: past this it is a typo, not a phase.
export const MAX_TASKS = 999;

/** A valid `run.tasks`: a whole number from 1 to MAX_TASKS. */
export function isTaskCount(tasks) {
  return Number.isInteger(tasks) && tasks >= 1 && tasks <= MAX_TASKS;
}

/** What one `run` scores, from its event and (for a built phase) its tasks. */
export function runPoints(event, tasks) {
  if (TASK_EVENTS.has(event) && isTaskCount(tasks)) {
    return Math.ceil(tasks / TASKS_PER_POINT) + TASK_BONUS[event];
  }
  return weightOf(event);
}

// Back-and-forth weighs what it took: every answer the person sends from a
// card is an `answer` ledger entry (console.mjs writes one per answered item
// when the agent collects a send), and each skill run scores one point per
// ANSWERS_PER_POINT answers, rounded down. Tune here.
export const ANSWERS_PER_POINT = 2;

// The skill names the answers row uses ("7 answers in Plan").
const WORKFLOW_NAMES = Object.freeze({
  dashboard: "the dashboard",
  pathfinder: "Pathfinder",
  plan: "Plan",
  "revise-plan": "Revise plan",
  document: "Document",
  implement: "Implement",
  "implement-review": "Implement + Review",
  review: "Review",
  "quick-task": "Quick task",
  init: "Init",
  "init-update": "Init update",
  finalize: "Finalize",
  handoff: "Handoff",
});

// The skill run an entry belongs to, from its ledger id ("L3:..." -> "L3").
const launchOf = (id) => (typeof id === "string" && id.includes(":") ? id.slice(0, id.indexOf(":")) : "L0");

// What each scoring event is called in the meter's list of contributions.
const LAUNCH_LABELS = Object.freeze({
  plan: "Plan started",
  "revise-plan": "Revise plan started",
  document: "Document started",
  review: "Review started",
  "quick-task": "Quick task started",
  init: "Init started",
  "init-update": "Init update started",
  finalize: "Finalize started",
});
const RUN_LABELS = Object.freeze({
  "pathfinder-chart": "Pathfinder map written",
  "pathfinder-question": "Pathfinder question settled",
  "pathfinder-research": "Pathfinder research done",
  plan: "Plan drafted",
  "revise-plan": "Plan revised",
  document: "Spec documented",
  "implement-phase": "Implement phase built",
  "implement-review-phase": "Implement + Review phase built",
  review: "Code review run",
  "quick-task": "Quick task built",
  init: "Init run",
  "init-update": "Init update run",
  finalize: "Finalize run",
  handoff: "Handoff written",
});

// The unit a run names, from its ledger id ("L3:phase-2" -> "phase-2").
const unitOf = (id) => (typeof id === "string" && id.includes(":") ? id.slice(id.indexOf(":") + 1) : "");

/**
 * What the count is made of: one { label, points } per ledger entry that
 * scored, in order, and one row per skill run for its answers, where its
 * first answer came. An id seen before is skipped, so a repeated `post` never
 * counts twice. Entries that weigh nothing are left out.
 */
export function breakdownFrom(entries) {
  const seen = new Set();
  const rows = [];
  const answers = new Map(); // launch id -> { row, count, workflow }
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.id !== undefined) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
    }
    if (entry.kind === "answer") {
      const launch = launchOf(entry.id);
      let tally = answers.get(launch);
      if (!tally) {
        tally = { row: { label: "", points: 0 }, count: 0, workflow: entry.workflow };
        answers.set(launch, tally);
        rows.push(tally.row);
      }
      tally.count += 1;
      continue;
    }
    let points = 0;
    let label = "";
    if (entry.kind === "launch" && LAUNCH_COUNTED.has(entry.workflow)) {
      points = weightOf(entry.workflow);
      label = LAUNCH_LABELS[entry.workflow] || entry.workflow;
    } else if (entry.kind === "run") {
      points = runPoints(entry.event, entry.tasks);
      const unit = unitOf(entry.id);
      const counted = TASK_EVENTS.has(entry.event) && isTaskCount(entry.tasks);
      const size = counted ? ` (${entry.tasks} ${entry.tasks === 1 ? "task" : "tasks"})` : "";
      label = (RUN_LABELS[entry.event] || entry.event) + (unit ? `: ${unit}` : "") + size;
    }
    if (points > 0) rows.push({ label, points });
  }
  for (const { row, count, workflow } of answers.values()) {
    row.points = Math.floor(count / ANSWERS_PER_POINT);
    const where = WORKFLOW_NAMES[workflow] ? ` in ${WORKFLOW_NAMES[workflow]}` : "";
    row.label = `${count} ${count === 1 ? "answer" : "answers"}${where}`;
  }
  return rows.filter((row) => row.points > 0);
}

/** The session's points, folded from ledger entries in order. */
export function pointsFrom(entries) {
  return breakdownFrom(entries).reduce((sum, row) => sum + row.points, 0);
}

export const YELLOW_AT = 5;
export const RED_AT = 10;
export const RING_FULL = 15;

export function levelFor(points) {
  if (points < YELLOW_AT) return "green";
  if (points < RED_AT) return "yellow";
  return "red";
}

// How much of the ring is filled: full at RING_FULL, never below empty.
export function ringFraction(points) {
  return Math.max(0, Math.min(points, RING_FULL)) / RING_FULL;
}

export const WORDS = Object.freeze({
  green: "Session: fresh",
  yellow: "Session: getting long",
  red: "Session: time for a fresh start",
});

export function tooltipFor(points) {
  const count = `${points} ${points === 1 ? "point" : "points"}`;
  switch (levelFor(points)) {
    case "green":
      return `This session is fresh (${count}).`;
    case "yellow":
      return `This session is getting long (${count}). A fresh one will soon be sharper.`;
    default:
      return `This session has done a lot (${count}). The agent may start missing things.`;
  }
}

export const RED_BANNER =
  "This console session has done a lot. Starting a new console session will keep the agent sharp.";

// Everything the pill draws, from the ledger alone.
export function meterView(entries) {
  const points = pointsFrom(entries);
  const level = levelFor(points);
  return {
    points,
    level,
    fraction: ringFraction(points),
    words: WORDS[level],
    tooltip: tooltipFor(points),
    items: breakdownFrom(entries),
  };
}
