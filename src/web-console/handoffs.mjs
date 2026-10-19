// Plan2Code Web Console - the handoff store.
//
// Every handoff lives in one folder, outside every repo:
//
//   ~/.plan2code/handoffs/<id>.md     the Handoff skill's document, written by
//                                     the agent and never changed here
//   ~/.plan2code/handoffs/<id>.json   who wrote it, for which checkout, spec
//                                     and skill, and whether it was picked up
//
// This module is the only code that names, lists, marks, deletes and sweeps
// them. The console ships inside every skill, so the Stop flow, the Handoff
// skill and the dashboard all reach it through console.mjs commands.
// PLAN2CODE_HANDOFFS_DIR moves the folder, for tests.
//
// Node built-ins only. No build step.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const HANDOFFS_DIR = process.env.PLAN2CODE_HANDOFFS_DIR || path.join(os.homedir(), ".plan2code", "handoffs");

// Read at call time, so a test that sets the variable after import sees it.
export function handoffsDir() {
  return process.env.PLAN2CODE_HANDOFFS_DIR || path.join(os.homedir(), ".plan2code", "handoffs");
}

export const HANDOFF_ID = /^\d{4}-\d{2}-\d{2}-\d{4}-handoff(-\d+)?$/;

export function isHandoffId(id) {
  return typeof id === "string" && HANDOFF_ID.test(id) && id === path.basename(id);
}

// PLAN2CODE_NOW ("YYYY-MM-DD HH:mm" or any Date-parsable string) pins the
// clock, as the skill scripts' now() does. Copied, not imported: the console
// is copied into skills on its own and may not reach src/skill-scripts/.
function clock() {
  const pinned = process.env.PLAN2CODE_NOW;
  if (pinned) {
    const m = pinned.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    const d = new Date(pinned);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

const pad = (n) => String(n).padStart(2, "0");

/* ----------------------------------------------------------------- write */

/**
 * Claim a new handoff for the agent to write. The id is the local minute,
 * `YYYY-MM-DD-HHmm-handoff`, with `-2`, `-3` and so on after a clash; the
 * `.json` is created exclusively, so two sessions in the same minute never
 * share one. Only the `.json` is written: the agent writes the `.md` at the
 * returned path. A bad field throws, naming it, before anything is created.
 */
export function newHandoff({ worktree, project, spec, workflow, skill, title, fromStop } = {}, now = clock()) {
  if (typeof workflow !== "string" || !/^[a-z-]+$/.test(workflow)) throw new Error(`workflow must be lowercase letters and dashes, got ${JSON.stringify(workflow)}`);
  if (typeof skill !== "string" || !/^[a-z0-9-]+$/.test(skill)) throw new Error(`skill must be a skill name, got ${JSON.stringify(skill)}`);
  if (spec !== undefined && spec !== null && spec !== "" && (typeof spec !== "string" || !/^specs\/[^/\\]+$/.test(spec))) {
    throw new Error(`spec must be specs/<name>, got ${JSON.stringify(spec)}`);
  }
  const dir = handoffsDir();
  fs.mkdirSync(dir, { recursive: true });
  const base = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-handoff`;
  for (let n = 1; ; n++) {
    const id = n === 1 ? base : `${base}-${n}`;
    // A lone .md left by hand also holds its name.
    if (fs.existsSync(path.join(dir, id + ".md"))) continue;
    let fd;
    try {
      fd = fs.openSync(path.join(dir, id + ".json"), "wx");
    } catch (err) {
      if (err.code === "EEXIST") continue;
      throw err;
    }
    const meta = {
      v: 1,
      id,
      title: typeof title === "string" ? title : "",
      worktree,
      project,
      spec: spec || null,
      workflow,
      skill,
      written: now.toISOString(),
      fromStop: Boolean(fromStop),
      usedAt: null,
    };
    try {
      fs.writeSync(fd, JSON.stringify(meta, null, 2) + "\n");
    } finally {
      fs.closeSync(fd);
    }
    return { id, path: path.join(dir, id + ".md"), meta };
  }
}

/* ------------------------------------------------------------------ read */

// A regular file in the folder, never a link: lstat, not stat.
function regularFile(file) {
  try {
    return fs.lstatSync(file).isFile();
  } catch {
    return false;
  }
}

/** The handoff's `.json`, or null: an invalid id, a missing or linked file, or not a v1 record. */
export function readHandoffMeta(id) {
  if (!isHandoffId(id)) return null;
  const file = path.join(handoffsDir(), id + ".json");
  if (!regularFile(file)) return null;
  try {
    const meta = JSON.parse(fs.readFileSync(file, "utf8"));
    return meta && typeof meta === "object" && meta.v === 1 ? meta : null;
  } catch {
    return null;
  }
}

/** Stamp `usedAt` (a pick-up) and rewrite the `.json`; the `.md` is never touched. */
export function markHandoffUsed(id, now = clock()) {
  const meta = readHandoffMeta(id);
  if (!meta) return null;
  const next = { ...meta, usedAt: now.toISOString() };
  const file = path.join(handoffsDir(), id + ".json");
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2) + "\n");
  fs.renameSync(tmp, file);
  return next;
}

const NEXT_MAX = 280;

// The case-folded resolved path, as removeSpec() compares realpaths.
function samePath(a, b) {
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  return typeof a === "string" && typeof b === "string" && fold(path.resolve(a)) === fold(path.resolve(b));
}

// The document's first `# ` heading, without a leading "Handoff" and the
// punctuation after it.
function docTitle(md) {
  const m = md.match(/^# (.+)$/m);
  if (!m) return "";
  return m[1].replace(/^Handoff\b/i, "").replace(/^[\s:\-\u2013\u2014]+/, "").trim();
}

// The first paragraph under `## Next task`, on one line and cut to NEXT_MAX.
function docNext(md) {
  const lines = md.split(/\r?\n/);
  const at = lines.findIndex((l) => /^##\s+Next task\b/i.test(l));
  if (at < 0) return "";
  const para = [];
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.trim()) {
      if (para.length) break;
      continue;
    }
    para.push(line.trim());
  }
  const text = para.join(" ").replace(/\s+/g, " ").trim();
  return text.length > NEXT_MAX ? text.slice(0, NEXT_MAX - 1).trimEnd() + "…" : text;
}

/**
 * This checkout's handoffs still waiting to be picked up: a readable `.json`
 * with no `usedAt`, a `.md` beside it, and the same worktree. Newest first,
 * as `[{ id, title, next, written, spec, skill, workflow }]`.
 */
export function listHandoffs(worktree) {
  const dir = handoffsDir();
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    const id = name.slice(0, -".json".length);
    const meta = readHandoffMeta(id);
    if (!meta || meta.usedAt || !samePath(meta.worktree, worktree)) continue;
    const md = path.join(dir, id + ".md");
    if (!regularFile(md)) continue;
    let text;
    try {
      text = fs.readFileSync(md, "utf8");
    } catch {
      continue;
    }
    out.push({
      id,
      title: docTitle(text) || meta.title || "",
      next: docNext(text),
      written: meta.written,
      spec: meta.spec ?? null,
      skill: meta.skill,
      workflow: meta.workflow,
    });
  }
  return out.sort((a, b) => String(b.written).localeCompare(String(a.written)));
}

/* ---------------------------------------------------------------- remove */

/**
 * Delete one handoff, both files (or whichever one exists), for the
 * dashboard's Delete (`delete-handoff`). Only a handoff id; each file must be
 * a regular file, never a link, whose real folder is the handoffs folder.
 * Every refusal throws with the reason, and nothing is touched.
 */
export function removeHandoff(id) {
  if (!isHandoffId(id)) throw new Error(`not a handoff id: ${id}`);
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  const dir = handoffsDir();
  const names = [id + ".md", id + ".json"];
  const present = [];
  for (const name of names) {
    let st;
    try {
      st = fs.lstatSync(path.join(dir, name));
    } catch {
      continue;
    }
    if (st.isSymbolicLink()) throw new Error(`${name} is a link, so it is not deleted from here`);
    if (!st.isFile()) throw new Error(`${name} is not a file`);
    present.push(name);
  }
  if (!present.length) throw new Error(`there is no handoff ${id}`);
  const realDir = fold(fs.realpathSync.native(dir));
  for (const name of present) {
    if (fold(path.dirname(fs.realpathSync.native(path.join(dir, name)))) !== realDir) {
      throw new Error(`${name} resolves outside the handoffs folder, so it is not deleted`);
    }
  }
  for (const name of present) fs.rmSync(path.join(dir, name));
  return { ok: true, removed: present };
}

/* ----------------------------------------------------------------- sweep */

/**
 * Handoffs untouched for `maxAgeMs`, picked up or not: the `.json`'s mtime,
 * or the `.md`'s when there is no `.json`. Regular files with a handoff id
 * only, as staleScratch() does for the console folder.
 */
export function staleHandoffs(now, maxAgeMs) {
  const dir = handoffsDir();
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  const ids = new Set();
  for (const name of names) {
    const m = name.match(/^(.+)\.(md|json)$/);
    if (m && isHandoffId(m[1])) ids.add(m[1]);
  }
  const stale = [];
  for (const id of ids) {
    for (const ext of [".json", ".md"]) {
      let st;
      try {
        st = fs.lstatSync(path.join(dir, id + ext));
      } catch {
        continue;
      }
      if (st.isFile() && now - st.mtimeMs > maxAgeMs) stale.push(id);
      break;
    }
  }
  return stale;
}

// Every id re-checked against the same rule before anything is removed.
export async function removeHandoffs(ids) {
  const dir = handoffsDir();
  const removed = [];
  for (const id of ids) {
    if (!isHandoffId(id)) continue;
    try {
      await fs.promises.rm(path.join(dir, id + ".md"), { force: true });
      await fs.promises.rm(path.join(dir, id + ".json"), { force: true });
      removed.push(id);
    } catch {}
  }
  return removed;
}
