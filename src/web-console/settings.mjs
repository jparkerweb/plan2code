// Plan2Code Web Console - the person's saved console settings: Subagents and pull-request hosts.

import path from "node:path";

import { cleanSetting, defaultSetting, DEFAULT_STRENGTH, offered } from "./public/subagents.js";
import { ensureDir, fileStamp, HOME_DIR, readJson, readJsonLines, withStateLock, writeJsonAtomic } from "./files.mjs";
import { foldKey } from "./workspace.mjs";

/* ------------------------------------------------------ the Subagents switch */

// The person's Subagents switch, remembered per project folder and workflow:
//
//   { "<folded project path>": { "<workflow>": { on, instruction, max, strength } } }
//
// Keyed with foldKey(), as workspaces.json is. `instruction: null` is the
// workflow's shipped default; an entry saved before `strength` existed reads
// as balanced.
export const SUBAGENTS_FILE = path.join(HOME_DIR, "subagents.json");
const SUBAGENTS_LOCK = "subagents.json.lock";

function readSubagentStore() {
  const saved = readJson(SUBAGENTS_FILE, null);
  return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
}

// The saved `{ on, instruction, max, strength }` for this folder and workflow,
// or the default's when nothing (or something malformed) is saved.
export function subagentStoreEntry(worktree, workflow) {
  const { on, instruction, max, strength } = defaultSetting(workflow);
  const project = offered(workflow) ? readSubagentStore()[foldKey(worktree)] : null;
  const saved = project && typeof project === "object" ? cleanSetting(project[workflow]) : null;
  return saved && !saved.error ? saved : { on, instruction, max, strength };
}

// Single-writer rule: only the server may call this (its routes).
export function saveSubagentStoreEntry(worktree, workflow, value) {
  ensureDir(path.dirname(SUBAGENTS_FILE));
  withStateLock(
    path.dirname(SUBAGENTS_FILE),
    () => {
      const store = readSubagentStore();
      const key = foldKey(worktree);
      const project = store[key] && typeof store[key] === "object" ? store[key] : {};
      store[key] = { ...project, [workflow]: { on: value.on, instruction: value.instruction, max: value.max, strength: value.strength } };
      writeJsonAtomic(SUBAGENTS_FILE, store);
    },
    SUBAGENTS_LOCK
  );
}

/* ------------------------------------------------------- the PR host store */

// What kind of git host an unknown host is, so the git board can build its
// pull-request link. One answer per host, for every project:
//
//   { "<host>": "github" | "gitlab" | "bitbucket" | "azure" | "none" }
export const PR_HOSTS_FILE = path.join(HOME_DIR, "pr-hosts.json");
export const PR_HOST_KINDS = new Set(["github", "gitlab", "bitbucket", "azure", "none"]);
const PR_HOSTS_LOCK = "pr-hosts.json.lock";

// The saved hosts as a plain object; malformed → {}, unknown kinds dropped.
export function readPrHosts() {
  const saved = readJson(PR_HOSTS_FILE, null);
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).filter(([, kind]) => PR_HOST_KINDS.has(kind)));
}

// Single-writer rule: only the server may call this (its routes).
export function savePrHost(host, kind) {
  ensureDir(path.dirname(PR_HOSTS_FILE));
  withStateLock(
    path.dirname(PR_HOSTS_FILE),
    () => writeJsonAtomic(PR_HOSTS_FILE, { ...readPrHosts(), [host]: kind }),
    PR_HOSTS_LOCK
  );
}

export const SUBAGENTS_SETTING_FILE = "subagents-setting.json";

const isCount = (n) => Number.isInteger(n) && n >= 0;

// This session's switch, `{ workflow, on, instruction, max, revision }`, or
// null when there is none or it is malformed.
export function readSubagentSetting(dir) {
  const s = readJson(path.join(dir, SUBAGENTS_SETTING_FILE), null);
  if (!s || typeof s !== "object") return null;
  if (typeof s.workflow !== "string" || typeof s.on !== "boolean" || !Number.isInteger(s.max) || !isCount(s.revision)) return null;
  return s;
}

// Single-writer rule: only the server may call this (its routes, and
// serverSubagents() below). The revision never goes backwards within a session.
export function writeSubagentSetting(dir, setting) {
  const previous = readSubagentSetting(dir);
  const revision = Math.max(previous ? previous.revision : 0, setting.revision);
  return writeJsonAtomic(path.join(dir, SUBAGENTS_SETTING_FILE), { ...setting, revision });
}

export const SUBAGENTS_CURSOR_FILE = "subagents-cursor.json";
const CURSOR_STATES = new Set(["none", "on", "off"]);

// What the agent was last told: `{ revision, state }`.
export function readSubagentCursor(dir) {
  const saved = readJson(path.join(dir, SUBAGENTS_CURSOR_FILE), null);
  if (!saved || !isCount(saved.revision) || !CURSOR_STATES.has(saved.state)) return { revision: 0, state: "none" };
  return { revision: saved.revision, state: saved.state };
}

// Single-writer rule: only console.mjs may call this. Never backwards, like
// writeWorkspaceCursor(): a killed `wait` may repeat a change, never skip one.
export function writeSubagentCursor(dir, cursor) {
  const old = readSubagentCursor(dir);
  const next = cursor.revision < old.revision ? old : { revision: cursor.revision, state: cursor.state };
  writeJsonAtomic(path.join(dir, SUBAGENTS_CURSOR_FILE), next);
}

// The one place the cursor may go back: `open`, which starts a fresh agent.
export function resetSubagentCursor(dir) {
  writeJsonAtomic(path.join(dir, SUBAGENTS_CURSOR_FILE), { revision: 0, state: "none" });
}

// The `caps` of the last `open` event: what the agent's console copy can do.
export function latestOpenCaps(dir) {
  const opens = readJsonLines(path.join(dir, "events.ndjson")).filter((e) => e.type === "open");
  const last = opens[opens.length - 1];
  return last && Array.isArray(last.caps) ? last.caps : [];
}

/* ------------------------------------------------- the server's Subagents */

// A side without `strength` (a session file written before it existed) is
// balanced, so an upgrade alone never bumps the revision.
export const sameSetting = (a, b) =>
  a.workflow === b.workflow &&
  a.on === b.on &&
  a.instruction === b.instruction &&
  a.max === b.max &&
  (a.strength || DEFAULT_STRENGTH) === (b.strength || DEFAULT_STRENGTH);

/**
 * The Subagents switch as the server keeps it. subagents-setting.json has one
 * writer, the server, and the agent hears of it only through what console.mjs
 * reads there; events.ndjson's latest `open` says whether the agent's console
 * copy can carry it. Both re-read only when their file has moved.
 *
 * `ctx` is `dir` and `worktree()` (the session's folder, null while unknown).
 */
export function serverSubagents(ctx) {
  const { dir } = ctx;
  const SETTING_PATH = path.join(dir, SUBAGENTS_SETTING_FILE);
  const EVENTS_PATH = path.join(dir, "events.ndjson");

  let settingSeen = { stamp: null, setting: null };
  function settingNow() {
    const stamp = fileStamp(SETTING_PATH);
    if (stamp !== settingSeen.stamp) settingSeen = { stamp, setting: readSubagentSetting(dir) };
    return settingSeen.setting;
  }

  let capsSeen = { stamp: null, caps: [] };
  function capsNow() {
    const stamp = fileStamp(EVENTS_PATH);
    if (stamp !== capsSeen.stamp) capsSeen = { stamp, caps: latestOpenCaps(dir) };
    return capsSeen.caps;
  }

  /**
   * Turn the per-project store into this session's setting, for the workflow
   * the session is in now. The only place that happens (FR-7): a session an
   * older server ran has no setting file, so nothing is ever injected into it.
   * A record that already matches is left alone, revision and all, so a
   * restart alone never re-tells the agent anything.
   */
  function sync(state) {
    if (!state || typeof state.workflow !== "string") return;
    const { workflow } = state;
    const { on, instruction, max, strength } = offered(workflow) ? subagentStoreEntry(ctx.worktree(), workflow) : defaultSetting(workflow);
    const target = { workflow, on, instruction, max, strength };
    const current = readSubagentSetting(dir);
    if (current && sameSetting(current, target)) return;
    writeSubagentSetting(dir, { ...target, revision: (current ? current.revision : 0) + 1 });
  }

  // The page shows the switch only when `offered && supported` (FR-3); the
  // frame says both and leaves combining them to the page. `instruction: null`
  // is the shipped default, which the page reads from subagents.js itself.
  function view(state) {
    const workflow = state && state.workflow;
    const { on, instruction, max, strength, revision } = settingNow() || { ...defaultSetting(workflow), revision: 0 };
    return { offered: offered(workflow), supported: capsNow().includes("subagents"), on, instruction, max, strength: strength || DEFAULT_STRENGTH, revision };
  }

  return {
    settingNow,
    capsNow,
    sync,
    view,
    // The stamps of the reads the caches hold, for the frame's `have` key.
    stamps: () => `${settingSeen.stamp || ""}.${capsSeen.stamp || ""}`,
  };
}
