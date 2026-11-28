// Plan2Code Web Console - Learning's core: what state Learning is in, and the
// stores it owns.
//
// Shared by the console's scan and by the lessons script (`lessons.mjs`, which
// loads it through `consoleModule("learning.mjs")`), so the dashboard and the
// skills never disagree about whether Learning is active. learningState() is
// the only place that decides it.
//
// This module never writes into a project. It reads the project's tracked
// switch, `.plan2code/settings.json`, and owns two stores on this machine only,
// under ~/.plan2code/learning/<repository key>/ (shared by every worktree of
// one repository):
//
//   pause.json          the personal pause
//   waiting/<id>.json   noted lessons nobody has approved yet, one file each so
//                       two runs never overwrite each other; dropped after 30 days
//
// Every file it reads or writes carries `format: 1`; a file with any other
// number is treated as unknown, never guessed at.
//
// Node built-ins only. No build step.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { ensureDir, PLAN2CODE_DIR, readJson, writeJsonAtomic } from "./files.mjs";
import { repoRoots } from "./sessions.mjs";

export const FORMAT = 1;

const DAY_MS = 24 * 60 * 60 * 1000;
export const WAITING_MAX_DAYS = 30;

/** ~/.plan2code/learning, or PLAN2CODE_LEARNING_DIR (tests). Read on every call. */
export function learningDir() {
  return process.env.PLAN2CODE_LEARNING_DIR || path.join(PLAN2CODE_DIR, "learning");
}

/* ---------------------------------------------------------- repository key */

const FOLDS_CASE = process.platform === "win32" || process.platform === "darwin";

// The same shape as ui-prototype-drafts.mjs projectKey(): the folder's base
// name as a slug, then 12 hex characters of the SHA-256 of the resolved path
// (lowercased where the file system ignores case). Kept here rather than
// imported, because the installed console does not carry src/skill-scripts/.
function keyOf(root) {
  const resolved = path.resolve(String(root || ""));
  const slug =
    path
      .basename(resolved)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "folder";
  const hash = crypto
    .createHash("sha256")
    .update(FOLDS_CASE ? resolved.toLowerCase() : resolved)
    .digest("hex")
    .slice(0, 12);
  return `${slug}-${hash}`;
}

/** `<slug>-<12 hex>` of the main repository's folder: one key for every worktree. */
export function repositoryKey(cwd = process.cwd()) {
  return keyOf(repoRoots(cwd).project);
}

/** The checkout's own top level, where `.plan2code/` lives (the folder itself outside git). */
export function worktreeOf(cwd = process.cwd()) {
  return repoRoots(cwd).worktree;
}

/** This repository's folder on this machine: <learningDir>/<repository key>. */
export function storeDir(cwd = process.cwd()) {
  return path.join(learningDir(), repositoryKey(cwd));
}

/* ------------------------------------------------------------- the switch */

/** The project's tracked team switch, `<worktree>/.plan2code/settings.json`. Never writes. */
export function readSettings(worktree) {
  const file = path.join(worktree, ".plan2code", "settings.json");
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return { exists: false };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { exists: true, unknown: true };
  }
  if (!data || typeof data !== "object" || data.format !== FORMAT) return { exists: true, unknown: true };
  if (data.learning !== "on" && data.learning !== "off") return { exists: true, unknown: true };
  return { exists: true, learning: data.learning };
}

/* -------------------------------------------------------------- the pause */

const toDate = (now) => (now instanceof Date ? now : now === undefined ? new Date() : new Date(now));

/** The personal pause: `{ paused: false }` when missing or unreadable, else `{ paused: true, since }`. */
export function readPause(cwd) {
  const data = readJson(path.join(storeDir(cwd), "pause.json"));
  if (!data || typeof data !== "object" || data.format !== FORMAT || data.paused !== true) return { paused: false };
  return { paused: true, since: typeof data.since === "string" ? data.since : null };
}

/** Set (`paused` true) or clear the personal pause. `now` pins the clock. */
export function writePause(cwd, paused, now) {
  const file = path.join(storeDir(cwd), "pause.json");
  if (!paused) {
    try {
      fs.rmSync(file, { force: true });
    } catch {}
    return { paused: false };
  }
  ensureDir(path.dirname(file));
  const since = toDate(now).toISOString();
  writeJsonAtomic(file, { format: FORMAT, paused: true, since });
  return { paused: true, since };
}

/* ------------------------------------------------------------ follow counts */

/** One line per "Following a lesson" moment, on this machine only. */
function followsFile(cwd) {
  return path.join(storeDir(cwd), "follows.ndjson");
}

/**
 * Append one follow: `{"lesson":"<area>/<slug>","at":"<ISO>","skill":"<name>"}`.
 * The file is only ever appended to, so two runs at once cannot lose a count.
 */
export function recordFollow(cwd, { lesson, skill }, now) {
  const file = followsFile(cwd);
  ensureDir(path.dirname(file));
  const line = JSON.stringify({ lesson: String(lesson), at: toDate(now).toISOString(), skill: String(skill) });
  fs.appendFileSync(file, line + "\n");
}

/** `{ <lesson id>: { count, last } }`, summed on read; an unreadable line is skipped. */
export function followCounts(cwd) {
  let text;
  try {
    text = fs.readFileSync(followsFile(cwd), "utf8");
  } catch {
    return {};
  }
  const counts = {};
  for (const raw of text.split("\n")) {
    if (!raw.trim()) continue;
    let row;
    try {
      row = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!row || typeof row.lesson !== "string" || typeof row.at !== "string" || Number.isNaN(Date.parse(row.at))) continue;
    const c = counts[row.lesson] || (counts[row.lesson] = { count: 0, last: row.at });
    c.count += 1;
    if (Date.parse(row.at) > Date.parse(c.last)) c.last = row.at;
  }
  return counts;
}

/* ------------------------------------------------------ the waiting store */

const pad = (n) => String(n).padStart(2, "0");

function waitingDir(cwd) {
  return path.join(storeDir(cwd), "waiting");
}

/** `<YYYYMMDD-HHMMSS>-<6 random hex>`, in local time. */
export function newWaitingId(now) {
  const d = toDate(now);
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `${stamp}-${crypto.randomBytes(3).toString("hex")}`;
}

// An id names one plain file directly inside waiting/: letters, digits, `_`
// and `-` only, so no separator, no `..` and no NTFS stream name (`a:b`).
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
function safeId(id) {
  return typeof id === "string" && SAFE_ID.test(id);
}

/** Write one waiting item as `<id>.json`, adding `format: 1`. Returns the item written. */
export function writeWaiting(cwd, item) {
  if (!item || !safeId(item.id)) throw new Error(`A waiting item needs a plain id (got ${JSON.stringify(item && item.id)}).`);
  const dir = ensureDir(waitingDir(cwd));
  const data = { ...item, format: FORMAT };
  writeJsonAtomic(path.join(dir, item.id + ".json"), data);
  return data;
}

/**
 * Every waiting item, oldest first. Skips unreadable files and files of
 * another format; deletes any item noted more than 30 days before `now`
 * (with `prune: false`, only leaves it out, for a caller that must not write).
 */
export function listWaiting(cwd, now, { prune = true } = {}) {
  const dir = waitingDir(cwd);
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const nowMs = toDate(now).getTime();
  const items = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const file = path.join(dir, name);
    const data = readJson(file);
    if (!data || typeof data !== "object" || data.format !== FORMAT) continue;
    const noted = Date.parse(data.noted);
    if (Number.isFinite(noted) && nowMs - noted > WAITING_MAX_DAYS * DAY_MS) {
      if (prune) {
        try {
          fs.rmSync(file, { force: true });
        } catch {}
      }
      continue;
    }
    items.push(data);
  }
  const at = (i) => {
    const t = Date.parse(i.noted);
    return Number.isFinite(t) ? t : Infinity;
  };
  return items.sort((a, b) => at(a) - at(b) || String(a.id).localeCompare(String(b.id)));
}

/** Delete one waiting item. Refuses an id with a path separator or `..`. Returns whether a file went. */
export function removeWaiting(cwd, id) {
  if (!safeId(id)) throw new Error(`Refused waiting id ${JSON.stringify(id)}: it must name one file in the waiting folder.`);
  const file = path.join(waitingDir(cwd), id + ".json");
  if (!fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });
  return true;
}

/* ------------------------------------------------------------- the state */

/**
 * The one answer to "is Learning active here":
 * `{ state, active, pausedSince, waiting: { count, oldestDays } }`, where state
 * is `not-set-up`, `off`, `on`, `paused` or `unknown` (a settings file of
 * another format). Only `on` is active. A pause counts only while the project
 * is on. `prune: false` reads the waiting store without deleting old items.
 */
export function learningState(cwd = process.cwd(), now, { prune = true } = {}) {
  const nowDate = toDate(now);
  const settings = readSettings(worktreeOf(cwd));
  const items = listWaiting(cwd, nowDate, { prune });
  const oldest = items.length ? Date.parse(items[0].noted) : NaN;
  const waiting = {
    count: items.length,
    oldestDays: Number.isFinite(oldest) ? Math.max(0, Math.floor((nowDate.getTime() - oldest) / DAY_MS)) : 0,
  };
  if (settings.unknown) return { state: "unknown", active: false, pausedSince: null, waiting };
  if (!settings.exists) return { state: "not-set-up", active: false, pausedSince: null, waiting };
  if (settings.learning === "off") return { state: "off", active: false, pausedSince: null, waiting };
  const pause = readPause(cwd);
  if (pause.paused) return { state: "paused", active: false, pausedSince: pause.since, waiting };
  return { state: "on", active: true, pausedSince: null, waiting };
}

/* ------------------------------------------------------- the console's view */

// Where the dashboard starts to nudge a tidy-up: general.md holds at most 25
// lessons (GENERAL_MAX in lessons.mjs, which the installed console does not
// carry), so 22 is close; an area file has no cap, so 30 is a long file.
export const NEAR_CAP_GENERAL = 22;
export const NEAR_CAP_AREA = 30;

/**
 * Whether the project's saved lessons are crowded: general.md at 22 or more,
 * or any other area file at 30 or more (counted as `### ` headings). Reads
 * only; a missing folder or an unreadable file counts as not crowded.
 */
export function lessonsNearCap(cwd = process.cwd()) {
  const dir = path.join(worktreeOf(cwd), ".plan2code", "lessons");
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return false;
  }
  for (const name of names) {
    if (!name.endsWith(".md")) continue;
    let text;
    try {
      text = fs.readFileSync(path.join(dir, name), "utf8");
    } catch {
      continue;
    }
    const count = text.split(/\r?\n/).filter((l) => l.startsWith("### ")).length;
    if (count >= (name === "general.md" ? NEAR_CAP_GENERAL : NEAR_CAP_AREA)) return true;
  }
  return false;
}

/**
 * What the dashboard's scan carries as `scan.learning`:
 * `{ state, pausedSince, waiting, oldestDays, nearCap }`, or null when the state is
 * `unknown` (a settings format this console does not know: the page then
 * draws no row) or when the core fails, so a broken store never fails `open`.
 * Reads without pruning: the console server writes nothing here but the pause.
 * `read` stands in for learningState() in tests.
 */
export function learningScan(cwd = process.cwd(), { now, read = learningState } = {}) {
  let s;
  try {
    s = read(cwd, now, { prune: false });
  } catch {
    return null;
  }
  if (!s || s.state === "unknown") return null;
  const waiting = s.waiting || {};
  return {
    state: s.state,
    pausedSince: s.pausedSince || null,
    waiting: Number.isInteger(waiting.count) ? waiting.count : 0,
    oldestDays: Number.isInteger(waiting.oldestDays) ? waiting.oldestDays : 0,
    nearCap: s.state === "on" && lessonsNearCap(cwd),
  };
}
