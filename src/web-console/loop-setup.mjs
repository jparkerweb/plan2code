// Plan2Code Web Console - the Implementation Loop's setup, remembered per project.

import fs from "node:fs";
import path from "node:path";

import { ensureDir, HOME_DIR, readJson, withStateLock, writeJsonAtomic } from "./files.mjs";
import { foldKey } from "./workspace.mjs";

// One file for the person, beside workspaces.json and looks.json, keyed by the
// folder a session runs in (FR-4: one entry per project, used for any spec):
//
//   { "schema": 1, "projects": { "<folded worktree>": { ...setup, "saved": "<iso>" } } }
//
// Never under specs/: the server never writes into a project. The quick check
// is stored text only; nothing in the console ever runs it.
export const LOOP_SETUP_FILE = path.join(HOME_DIR, "loop-setup.json");
export const LOOP_SETUP_LOCK = "loop-setup.json.lock";

const LEVELS = ["critical", "warning", "suggestion"];
const FIX_MODES = ["levels", "smart"];
const ON_QUESTION = ["pause", "stop", "guess"];
const AFTER_LAST = ["offer-finalize", "run-finalize"];
const NOTIFY_KINDS = ["query", "discord", "slack", "teams", "google-chat", "json"];
// The kinds where the person names the parameter or field that holds the message.
const NAMED_KINDS = ["query", "json"];
const STRENGTH_WORDS = ["thrifty", "balanced", "best"];
// A spec folder directly under specs/, no leading dot (the route's own rule).
const SPEC_KEY = /^specs\/[^/\\.][^/\\]*$/;

export const LOOP_DEFAULTS = Object.freeze({
  review: true,
  fixMode: "smart",
  fix: Object.freeze([...LEVELS]),
  commit: true,
  onQuestion: "guess",
  afterLast: "offer-finalize",
  quickCheck: "",
  retryOnce: true,
  silenceMinutes: 20,
  notifyKind: "query",
  notifyUrl: "",
  notifyParam: "message",
  phaseStrength: false,
  strengths: Object.freeze({}),
});

/** An http or https address in printable ASCII, with a host and no user name or password (the app's `valid_url`). */
function isNotifyUrl(text) {
  if (text.length > 2000 || !/^https?:\/\/[^/?#@]+([/?#][!-~]*)?$/i.test(text) || /[^!-~]/.test(text)) return false;
  try {
    return Boolean(new URL(text).hostname);
  } catch {
    return false;
  }
}

/** Problems with a setup entry, as sentences naming the field; empty when it is good. */
export function loopSetupProblems(entry) {
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return ["the setup must be an object"];
  const problems = [];
  for (const key of Object.keys(entry)) {
    if (!Object.hasOwn(LOOP_DEFAULTS, key)) problems.push(`"${key}" is not a setup field`);
  }
  for (const key of ["review", "commit", "retryOnce"]) {
    if (typeof entry[key] !== "boolean") problems.push(`"${key}" must be true or false`);
  }
  if (!Array.isArray(entry.fix) || !entry.fix.every((l) => LEVELS.includes(l)) || new Set(entry.fix).size !== entry.fix.length) {
    problems.push(`"fix" must list distinct levels from ${LEVELS.join(", ")}`);
  }
  if (!FIX_MODES.includes(entry.fixMode)) problems.push(`"fixMode" must be one of ${FIX_MODES.join(", ")}`);
  if (!ON_QUESTION.includes(entry.onQuestion)) problems.push(`"onQuestion" must be one of ${ON_QUESTION.join(", ")}`);
  if (!AFTER_LAST.includes(entry.afterLast)) problems.push(`"afterLast" must be one of ${AFTER_LAST.join(", ")}`);
  if (typeof entry.quickCheck !== "string" || /[\r\n]/.test(entry.quickCheck) || entry.quickCheck.length > 500) {
    problems.push('"quickCheck" must be one line of at most 500 characters (empty for none)');
  }
  if (!Number.isInteger(entry.silenceMinutes) || entry.silenceMinutes < 1 || entry.silenceMinutes > 60) {
    problems.push('"silenceMinutes" must be a whole number from 1 to 60');
  }
  if (typeof entry.notifyUrl !== "string" || (entry.notifyUrl !== "" && !isNotifyUrl(entry.notifyUrl))) {
    problems.push('"notifyUrl" must be an http or https web address, without a user name or password (empty for none)');
  }
  if (!NOTIFY_KINDS.includes(entry.notifyKind)) problems.push(`"notifyKind" must be one of ${NOTIFY_KINDS.join(", ")}`);
  // The name only matters beside an address and for a kind that uses it: the field is hidden otherwise.
  if (typeof entry.notifyParam !== "string" || (entry.notifyUrl && NAMED_KINDS.includes(entry.notifyKind) && !/^[A-Za-z0-9._~-]{1,64}$/.test(entry.notifyParam))) {
    problems.push('"notifyParam" must be 1 to 64 letters, digits, or - _ . ~');
  }
  if (typeof entry.phaseStrength !== "boolean") problems.push('"phaseStrength" must be true or false');
  problems.push(...strengthsProblems(entry.strengths));
  return problems;
}

/** Problems with the per-spec phase picks; empty when they are good. */
function strengthsProblems(strengths) {
  if (strengths === null || typeof strengths !== "object" || Array.isArray(strengths)) return ['"strengths" must be an object'];
  const problems = [];
  for (const [key, picks] of Object.entries(strengths)) {
    if (!SPEC_KEY.test(key)) {
      problems.push(`"strengths" key "${key}" must be a folder directly under specs/`);
      continue;
    }
    if (!Array.isArray(picks) || picks.length > 100) {
      problems.push(`"strengths.${key}" must list at most 100 phase picks`);
      continue;
    }
    const seen = new Set();
    for (const pick of picks) {
      const ok = pick && typeof pick === "object" && !Array.isArray(pick);
      if (!ok || !Number.isInteger(pick.n) || pick.n < 1) {
        problems.push(`"strengths.${key}" picks need a phase number "n" (a positive whole number)`);
      } else if (seen.has(pick.n)) {
        problems.push(`"strengths.${key}" has Phase ${pick.n} twice`);
      } else {
        seen.add(pick.n);
      }
      if (!ok) continue;
      if (typeof pick.name !== "string" || pick.name.length > 200) problems.push(`"strengths.${key}" pick names must be text of at most 200 characters`);
      if (!STRENGTH_WORDS.includes(pick.strength)) problems.push(`"strengths.${key}" picks need a strength of ${STRENGTH_WORDS.join(", ")}`);
    }
  }
  return problems;
}

/**
 * Drop picks that no longer mean anything (FR-12, FR-13): a spec key whose folder
 * is gone from the project, and, for a spec whose phases can be read, picks whose
 * number and name match no phase left. `phasesFor(spec)` returns the phases left
 * as [{ n, name }], or null when the overview cannot be read (its picks stay).
 * Returns a fresh object; the input is never changed.
 */
export function pruneStrengths(project, strengths, phasesFor) {
  const out = {};
  for (const [spec, picks] of Object.entries(strengths && typeof strengths === "object" ? strengths : {})) {
    if (!SPEC_KEY.test(spec) || !Array.isArray(picks)) continue;
    let isDir = false;
    try {
      isDir = fs.statSync(path.join(project, spec)).isDirectory();
    } catch {
      /* gone */
    }
    if (!isDir) continue;
    let left = null;
    try {
      left = typeof phasesFor === "function" ? phasesFor(spec) : null;
    } catch {
      left = null;
    }
    const kept = Array.isArray(left) ? picks.filter((p) => left.some((l) => l.n === p.n && l.name === p.name)) : picks;
    if (kept.length) out[spec] = kept.map((p) => ({ ...p }));
  }
  return out;
}

function readStore() {
  const saved = readJson(LOOP_SETUP_FILE, null);
  const ok = saved && saved.schema === 1 && saved.projects && typeof saved.projects === "object" && !Array.isArray(saved.projects);
  return ok ? saved : { schema: 1, projects: {} };
}

/**
 * The setup for this project: the saved entry over the defaults, or the
 * defaults alone. `remembered` says which, so the setup screen can tell a
 * first visit from a returning one. A missing, unreadable or foreign-schema
 * file reads as empty. An entry saved before `fixMode` existed fixed by level,
 * so it keeps doing that rather than taking the newer default.
 */
export function readLoopSetup(project, phasesFor) {
  const saved = readStore().projects[foldKey(project)];
  const base = { ...LOOP_DEFAULTS, fix: [...LOOP_DEFAULTS.fix], strengths: {} };
  if (saved && typeof saved === "object") {
    const setup = { ...base, fixMode: "levels", ...saved, remembered: true };
    // Deep-copied and pruned like `fix`: the caller may change it freely.
    const strengths = saved.strengths && typeof saved.strengths === "object" && !Array.isArray(saved.strengths) ? saved.strengths : {};
    setup.strengths = pruneStrengths(project, strengths, phasesFor);
    if (typeof setup.phaseStrength !== "boolean") setup.phaseStrength = false;
    return setup;
  }
  return { ...base, remembered: false };
}

/** Validate and save this project's setup; throws an Error listing the problems. */
export function saveLoopSetup(project, entry, phasesFor) {
  const problems = loopSetupProblems(entry);
  if (problems.length) {
    const err = new Error(`the loop setup is not valid: ${problems.join("; ")}`);
    err.problems = problems;
    throw err;
  }
  ensureDir(path.dirname(LOOP_SETUP_FILE));
  return withStateLock(
    path.dirname(LOOP_SETUP_FILE),
    () => {
      const store = readStore();
      // Only the known fields are kept, in the defaults' order.
      const known = Object.fromEntries(Object.keys(LOOP_DEFAULTS).map((key) => [key, entry[key]]));
      known.strengths = pruneStrengths(project, known.strengths, phasesFor);
      store.projects[foldKey(project)] = { ...known, saved: new Date().toISOString() };
      writeJsonAtomic(LOOP_SETUP_FILE, { schema: 1, projects: store.projects });
      return readLoopSetup(project, phasesFor);
    },
    LOOP_SETUP_LOCK,
  );
}
