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
  "pathfinder-question": 1,
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

// The event names an agent may report in `run`.
export const RUN_EVENTS = new Set(Object.keys(WEIGHTS));

const weightOf = (key) => (Object.prototype.hasOwnProperty.call(WEIGHTS, key) ? WEIGHTS[key] : 0);

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
 * scored, in order. An id seen before is skipped, so a repeated `post` never
 * counts twice. Entries that weigh nothing are left out.
 */
export function breakdownFrom(entries) {
  const seen = new Set();
  const rows = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.id !== undefined) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
    }
    let points = 0;
    let label = "";
    if (entry.kind === "launch" && LAUNCH_COUNTED.has(entry.workflow)) {
      points = weightOf(entry.workflow);
      label = LAUNCH_LABELS[entry.workflow] || entry.workflow;
    } else if (entry.kind === "run") {
      points = weightOf(entry.event);
      const unit = unitOf(entry.id);
      label = (RUN_LABELS[entry.event] || entry.event) + (unit ? `: ${unit}` : "");
    }
    if (points > 0) rows.push({ label, points });
  }
  return rows;
}

/** The session's points, folded from ledger entries in order. */
export function pointsFrom(entries) {
  return breakdownFrom(entries).reduce((sum, row) => sum + row.points, 0);
}

export const YELLOW_AT = 4;
export const RED_AT = 6;
export const RING_FULL = 8;

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
