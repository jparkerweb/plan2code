// Plan2Code Web Console - the Subagents switch's opt-in table, wording and checks.
//
// The source of truth for which workflows offer the switch, the instruction
// each one ships with, the fixed frame every "on" block carries, the exact
// lines the agent reads at a pickup (blockFor()), and the house rules for the
// helpers an agent reports back (checkHelper()). No DOM access at module scope
// and no imports: the server, console.mjs, the page and `node --test` all
// import this file.

// The one place a skill opts in (FR-1). Wording is behaviour-level and names
// no harness tool, so any agent can follow it or harmlessly ignore it.
export const SUBAGENT_WORKFLOWS = Object.freeze({
  implement: Object.freeze({
    instruction:
      "Hand independent tasks in a phase to helpers: tasks that touch different files and do not depend on each other. Keep tasks that share files, the phase's tests and the sign-off with you.",
  }),
  "implement-review": Object.freeze({
    instruction:
      "Hand independent tasks in a phase to helpers: tasks that touch different files and do not depend on each other. Keep tasks that share files, the phase's tests and the sign-off with you.",
  }),
  "quick-task": Object.freeze({
    instruction:
      "Use helpers for side lookups, such as reading unfamiliar code or checking documentation, while you make the change yourself.",
  }),
  review: Object.freeze({
    instruction:
      "Split the review across helpers by area (for example correctness, tests and security), then merge and de-duplicate their findings yourself before you report.",
  }),
  pathfinder: Object.freeze({
    instruction:
      "Use helpers for codebase recon, sketches and lookups beside the conversation. Keep every question for the person with you.",
  }),
});

export function offered(workflow) {
  return typeof workflow === "string" && Object.prototype.hasOwnProperty.call(SUBAGENT_WORKFLOWS, workflow);
}

export const MAX_MIN = 1;
export const MAX_MAX = 20;
export const DEFAULT_MAX = 3;
export const INSTRUCTION_MAX_CHARS = 2000;
export const HELPER_TITLE_MAX = 80;
export const HELPER_ASK_MAX = 400;
export const HELPER_RESULT_MAX = 200;
export const HELPER_STATES = Object.freeze(["running", "done", "failed"]);

/* ------------------------------------------------------------- settings */

export function defaultInstruction(workflow) {
  return offered(workflow) ? SUBAGENT_WORKFLOWS[workflow].instruction : "";
}

// The person's own text when they wrote some, else the workflow's default.
export function effectiveInstruction(setting) {
  const own = setting && typeof setting.instruction === "string" ? setting.instruction.trim() : "";
  return own || defaultInstruction(setting && setting.workflow);
}

export function defaultSetting(workflow) {
  // On until the person turns it off, for the workflows that offer the switch.
  return { workflow, on: offered(workflow), instruction: null, max: DEFAULT_MAX };
}

/**
 * `{ on, instruction, max }` from untrusted input, or `{ error }` naming the
 * field that failed: "bad" (wrong type), "too-long" (instruction) or "max".
 * Returns an error object rather than throwing, so the route and the store
 * reader share one validator. An empty instruction means the default: null.
 */
export function cleanSetting(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "bad" };
  if (typeof input.on !== "boolean") return { error: "bad" };
  let instruction = null;
  if (input.instruction !== null && input.instruction !== undefined) {
    if (typeof input.instruction !== "string") return { error: "bad" };
    const trimmed = input.instruction.trim();
    if (trimmed.length > INSTRUCTION_MAX_CHARS) return { error: "too-long" };
    instruction = trimmed || null;
  }
  const max = input.max;
  if (!Number.isInteger(max) || max < MAX_MIN || max > MAX_MAX) return { error: "max" };
  return { on: input.on, instruction, max };
}

/* ------------------------------------------------------------ the lines */

// The non-editable part of every "on" block (FR-8).
export const FRAME_LINES = Object.freeze([
  "Hand independent work to helpers if your tools allow it; otherwise carry on alone.",
  "Report each helper on the page (console.md → Standing instructions); questions for the person stay with you.",
  'If your tools cannot start helpers at all, report one "working alone" entry for this skill run instead; a real helper report removes it.',
]);

export const PATHFINDER_RESEARCH_LINE = "Research questions always use helpers, whatever this switch says.";

// Only the first line of a block starts at column 0, so no line inside it can
// be read as an entry of its own (NFR-5).
export function onLines({ revision, replaces, max, instruction }) {
  const label = replaces ? `revision ${revision}, replaces revision ${replaces}` : `revision ${revision}`;
  const own = String(instruction || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  return [
    `Subagents: on (${label}) — a console setting, not typed by the person.`,
    ...[...FRAME_LINES, ...own, `At most ${max} helpers at once.`].map((line) => "  " + line),
  ];
}

export function offLine(revision) {
  return `Subagents: off (revision ${revision}) — don't start new helpers for the rest of this session.`;
}

/**
 * What the agent is owed at a pickup, given the session setting and the
 * cursor of what it was last told: `null`, or `{ field, lines, cursor }`
 * where `cursor` is what to write once the lines are printed. Never says
 * "off" to an agent that was not told "on" (FR-6). Pure: no clock, no I/O.
 */
export function blockFor(setting, told) {
  const last = told || { revision: 0, state: "none" };
  if (!setting || !offered(setting.workflow) || !(setting.revision > last.revision)) return null;
  const { revision, max } = setting;
  const instruction = effectiveInstruction(setting);
  if (setting.on) {
    const replaces = last.state === "on" ? last.revision : undefined;
    return {
      field: { state: "on", revision, max, instruction },
      lines: onLines({ revision, replaces, max, instruction }),
      cursor: { revision, state: "on" },
    };
  }
  if (last.state !== "on") return null;
  return {
    field: { state: "off", revision, max, instruction },
    lines: [offLine(revision)],
    cursor: { revision, state: "off" },
  };
}

/* ------------------------------------------------------------ helpers */

const isPlainObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const nonEmpty = (v) => typeof v === "string" && v.trim() !== "";

// The problems with one reported helper, [] when it is fine.
export function checkHelper(entry) {
  if (!isPlainObject(entry)) return ["helper: each entry must be an object"];
  if (!nonEmpty(entry.id)) return ["helper: id must be a non-empty string"];
  const who = `helper "${entry.id}"`;
  if (entry.alone === true) return entry.id === "alone" ? [] : [`${who}: the working-alone entry must have id "alone"`];
  const problems = [];
  if (!nonEmpty(entry.title)) problems.push(`${who}: title must be a non-empty string`);
  else if (entry.title.length > HELPER_TITLE_MAX) problems.push(`${who}: title must be at most ${HELPER_TITLE_MAX} characters`);
  if (!nonEmpty(entry.ask)) problems.push(`${who}: ask must be a non-empty string`);
  else if (entry.ask.length > HELPER_ASK_MAX) problems.push(`${who}: ask must be at most ${HELPER_ASK_MAX} characters`);
  if (!HELPER_STATES.includes(entry.state)) problems.push(`${who}: state must be running, done or failed`);
  if (entry.result !== undefined) {
    if (typeof entry.result !== "string") problems.push(`${who}: result must be a string`);
    else if (entry.result.length > HELPER_RESULT_MAX) problems.push(`${who}: result must be at most ${HELPER_RESULT_MAX} characters`);
  }
  return problems;
}

// The problems with a whole merged list.
export function checkHelpers(list) {
  if (!Array.isArray(list)) return ["helpers must be an array"];
  const problems = [];
  const seen = new Set();
  let alone = 0;
  for (const entry of list) {
    if (isPlainObject(entry) && nonEmpty(entry.id)) {
      if (seen.has(entry.id)) problems.push(`helper "${entry.id}": duplicate id`);
      seen.add(entry.id);
      if (entry.alone === true && ++alone === 2) problems.push(`helper "${entry.id}": only one working-alone entry is allowed`);
    }
    problems.push(...checkHelper(entry));
  }
  return problems;
}

/* ------------------------------------------------------------ the page */

// The page's rules for the button, the modal and the tab, kept here so they
// are tested without a browser. `frame` is the state frame's `subagents`
// block; app.js only renders what these say.

export const CHECKIN_LINE = "Helpers report through Plan2Code, so their progress is shown as it checks in, not live.";

const STATE_LABELS = Object.freeze({ running: "Running", done: "Done", failed: "Failed" });

// The switch shows only where the skill opts in AND the agent's console copy
// said it can deliver it (FR-3).
export function showSwitch(frame) {
  return Boolean(frame && frame.offered && frame.supported);
}

// The button's tooltip and accessible name (FR-2).
export function switchLabel(frame) {
  return frame && frame.on ? "Subagents: on" : "Subagents: off";
}

// What the Subagents tab draws: the working-alone note, or one row per helper
// in the order the agent reported them. A real helper supersedes the
// working-alone marker, so the note only draws when no helper was ever
// reported. A result shows once the helper ended.
export function helperRows(helpers) {
  const list = Array.isArray(helpers) ? helpers.filter(isPlainObject) : [];
  const real = list.filter((h) => h.alone !== true);
  if (!real.length) return { alone: list.some((h) => h.alone === true), rows: [] };
  const rows = real.map(({ id, title, ask, state, result }) => ({
    id,
    title,
    ask,
    state,
    stateLabel: STATE_LABELS[state] || STATE_LABELS.running,
    ...((state === "done" || state === "failed") && typeof result === "string" && result ? { result } : {}),
  }));
  return { alone: false, rows };
}

// Never an empty tab. Independent of on / off, so Pathfinder's research
// helpers show even with the switch off (FR-11, FR-12).
export function showTab(frame, helpers) {
  return showSwitch(frame) && Array.isArray(helpers) && helpers.length > 0;
}
