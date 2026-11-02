// Plan2Code Web Console - the Implementation Loop's setup, remembered per project.

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
  return problems;
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
export function readLoopSetup(project) {
  const saved = readStore().projects[foldKey(project)];
  if (saved && typeof saved === "object") return { ...LOOP_DEFAULTS, fix: [...LOOP_DEFAULTS.fix], fixMode: "levels", ...saved, remembered: true };
  return { ...LOOP_DEFAULTS, fix: [...LOOP_DEFAULTS.fix], remembered: false };
}

/** Validate and save this project's setup; throws an Error listing the problems. */
export function saveLoopSetup(project, entry) {
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
      store.projects[foldKey(project)] = { ...known, saved: new Date().toISOString() };
      writeJsonAtomic(LOOP_SETUP_FILE, { schema: 1, projects: store.projects });
      return readLoopSetup(project);
    },
    LOOP_SETUP_LOCK,
  );
}
