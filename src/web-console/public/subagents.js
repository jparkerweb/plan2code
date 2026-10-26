// Plan2Code Web Console - the Subagents switch's opt-in table, wording and checks.
//
// The source of truth for which workflows offer the switch, the instruction
// each one ships with, the fixed frame every "on" block carries, the exact
// lines the agent reads at a pickup (blockFor()), and the house rules for the
// helpers an agent reports back (checkHelper()). No DOM access at module scope,
// and its one import is the data-only skills.js: the server, console.mjs, the
// page and `node --test` all import this file.

import { SKILLS, subagentsFor } from "./skills.js";

// The skills that offer the switch, each with its instruction: an entry's
// `subagents` in skills.js is the one place a skill opts in (FR-1). Wording is
// behaviour-level and names no harness tool, so any agent can follow it or
// harmlessly ignore it.
export const SUBAGENT_WORKFLOWS = Object.freeze(
  Object.fromEntries(
    SKILLS.filter((s) => subagentsFor(s.workflow)).map((s) => [s.workflow, Object.freeze({ instruction: subagentsFor(s.workflow) })])
  )
);

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
// The person's Helper strength profile, applied on top of helper-strength.md's table.
export const STRENGTHS = Object.freeze(["balanced", "thrifty", "best", "session"]);
export const DEFAULT_STRENGTH = "balanced";
// What the dialog's strength radios say, and the line under them for the picked one.
export const STRENGTH_LABELS = Object.freeze({ balanced: "Balanced", thrifty: "Thrifty", best: "Best", session: "Match my session" });
export const STRENGTH_HELP = Object.freeze({
  balanced: "Each helper gets the strength its job needs: light for lookups, stronger for reviews and design work.",
  thrifty: "One step lighter everywhere to save cost; reviews stay at standard or above.",
  best: "The strongest model and high effort for everything except lookups.",
  session: "Helpers run on whatever your session uses; nothing is set for them.",
});
// What a reported helper may say it actually ran with.
export const HELPER_STRENGTHS = Object.freeze(["light", "standard", "strongest", "inherit"]);
export const HELPER_EFFORTS = Object.freeze(["low", "medium", "high"]);

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
  return { workflow, on: offered(workflow), instruction: null, max: DEFAULT_MAX, strength: DEFAULT_STRENGTH };
}

/**
 * `{ on, instruction, max, strength }` from untrusted input, or `{ error }`
 * naming the field that failed: "bad" (wrong type), "too-long" (instruction),
 * "max" or "strength". A missing strength is the default, balanced.
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
  const strength = input.strength === undefined || input.strength === null ? DEFAULT_STRENGTH : input.strength;
  if (!STRENGTHS.includes(strength)) return { error: "strength" };
  return { on: input.on, instruction, max, strength };
}

/* ------------------------------------------------------------ the lines */

// The non-editable part of every "on" block (FR-8).
export const FRAME_LINES = Object.freeze([
  "Hand independent work to helpers if your tools allow it; otherwise carry on alone.",
  "Report each helper on the page (console-subagents.md); questions for the person stay with you.",
  'If your tools cannot start helpers at all, report one "working alone" entry for this skill run instead; a real helper report removes it.',
  "Match each helper's strength and effort to its job, as helper-strength.md says; when your tools cannot set them, start the helper without them.",
]);

export const PATHFINDER_RESEARCH_LINE = "Research questions always use helpers, whatever this switch says.";

// The profile line each strength adds to an "on" block.
export const STRENGTH_LINES = Object.freeze({
  balanced: "Helper strength: balanced (the table in helper-strength.md as written).",
  thrifty: "Helper strength: thrifty (one step lighter in strength and effort than the table; reviews never below standard).",
  best: "Helper strength: best (strongest and high effort for every helper except lookups, which stay light).",
  session: "Helper strength: match the session (set no model or effort on any helper, whatever the skill files say).",
});

// Only the first line of a block starts at column 0, so no line inside it can
// be read as an entry of its own (NFR-5).
export function onLines({ revision, replaces, max, instruction, strength }) {
  const label = replaces ? `revision ${revision}, replaces revision ${replaces}` : `revision ${revision}`;
  const own = String(instruction || "")
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  return [
    `Subagents: on (${label}) — a console setting, not typed by the person.`,
    ...[...FRAME_LINES, ...own, STRENGTH_LINES[strength] || STRENGTH_LINES[DEFAULT_STRENGTH], `At most ${max} helpers at once.`].map((line) => "  " + line),
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
  const strength = STRENGTHS.includes(setting.strength) ? setting.strength : DEFAULT_STRENGTH;
  if (setting.on) {
    const replaces = last.state === "on" ? last.revision : undefined;
    return {
      field: { state: "on", revision, max, instruction, strength },
      lines: onLines({ revision, replaces, max, instruction, strength }),
      cursor: { revision, state: "on" },
    };
  }
  if (last.state !== "on") return null;
  return {
    field: { state: "off", revision, max, instruction, strength },
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
  if (entry.strength !== undefined && !HELPER_STRENGTHS.includes(entry.strength)) problems.push(`${who}: strength must be light, standard, strongest or inherit`);
  if (entry.effort !== undefined && !HELPER_EFFORTS.includes(entry.effort)) problems.push(`${who}: effort must be low, medium or high`);
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
// reported. A result shows once the helper ended, and a reported strength or
// effort as one line ("Standard, medium effort") plus a badge each, ranked 1-3
// so the page can colour them (0 for the session's own model, which has no rank).
export function helperRows(helpers) {
  const list = Array.isArray(helpers) ? helpers.filter(isPlainObject) : [];
  const real = list.filter((h) => h.alone !== true);
  if (!real.length) return { alone: list.some((h) => h.alone === true), rows: [] };
  const rows = real.map(({ id, title, ask, state, result, strength, effort }) => {
    const ran = {
      ...(HELPER_STRENGTHS.includes(strength) ? { strength } : {}),
      ...(HELPER_EFFORTS.includes(effort) ? { effort } : {}),
    };
    const line = strengthLine(ran.strength, ran.effort);
    return {
      id,
      title,
      ask,
      state,
      stateLabel: STATE_LABELS[state] || STATE_LABELS.running,
      ...((state === "done" || state === "failed") && typeof result === "string" && result ? { result } : {}),
      ...ran,
      ...(line ? { strengthLine: line, badges: strengthBadges(ran.strength, ran.effort) } : {}),
    };
  });
  return { alone: false, rows };
}

const HELPER_STRENGTH_WORDS = Object.freeze({ light: "Light", standard: "Standard", strongest: "Strongest", inherit: "Session model" });
// Each value's rank for its badge colour; the session's own model has none.
const HELPER_STRENGTH_LEVELS = Object.freeze({ light: 1, standard: 2, strongest: 3, inherit: 0 });
const HELPER_EFFORT_LEVELS = Object.freeze({ low: 1, medium: 2, high: 3 });

// One badge per reported value: its kind, its words and its rank.
function strengthBadges(strength, effort) {
  const badges = [];
  if (strength) badges.push({ kind: "strength", label: HELPER_STRENGTH_WORDS[strength], level: HELPER_STRENGTH_LEVELS[strength] });
  if (effort) badges.push({ kind: "effort", label: `${effort[0].toUpperCase()}${effort.slice(1)} effort`, level: HELPER_EFFORT_LEVELS[effort] });
  return badges;
}

// "Standard, medium effort", "Light", "Medium effort", or "" when neither was reported.
function strengthLine(strength, effort) {
  const parts = [];
  if (strength) parts.push(HELPER_STRENGTH_WORDS[strength]);
  if (effort) parts.push(`${effort} effort`);
  const line = parts.join(", ");
  return line && line[0].toUpperCase() + line.slice(1);
}

// Never an empty tab. Independent of on / off, so Pathfinder's research
// helpers show even with the switch off (FR-11, FR-12).
export function showTab(frame, helpers) {
  return showSwitch(frame) && Array.isArray(helpers) && helpers.length > 0;
}
