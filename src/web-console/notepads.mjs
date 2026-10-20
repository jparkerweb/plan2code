// Plan2Code Web Console - the notepad store.
//
// One notepad per folder Plan2Code runs in (the session's worktree, else its
// project), outside every repo and every session, split into named tabs:
//
//   ~/.plan2code/notepads/<folder-name>-<12 hex>/
//     meta.json          { v: 2, folder, created }
//     tabs.json          { v: 1, order: [id], last: id|null, tabs: { id: { name, created } } }
//     tabs/<id>/note.md              the tab's text, UTF-8, written atomically
//     tabs/<id>/images/<uuid>.jpg          a picture, JPEG from the page
//     tabs/<id>/images/<uuid>.thumb.jpg    its thumbnail, when the page sent one
//
// The first shape (v: 1) kept one note.md and images/ at the top. Reading that
// shape answers one virtual tab called Notes and writes nothing; the first
// write moves the files into tabs/<LEGACY_TAB_ID>/ and writes tabs.json last,
// every step safe to run again after a crash.
//
// This module is the only code that names, reads, writes, lists and removes
// them. The page reaches it through the /notepad routes; the agent CLI never
// imports it, so nothing in a notepad can reach the agent. Reading never
// creates or touches a file, so only a person's own edits age a notepad.
// PLAN2CODE_NOTEPADS_DIR moves the folder, for tests.
//
// Node built-ins only. No build step.

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { ensureDir, newestMtime, nowIso, readJson, sleepSync, withStateLock, writeJsonAtomic, writeTextAtomic } from "./files.mjs";
import { foldKey } from "./workspace.mjs";

// Read at call time, so a test that sets the variable after import sees it.
export function notepadsDir() {
  return process.env.PLAN2CODE_NOTEPADS_DIR || path.join(os.homedir(), ".plan2code", "notepads");
}

export const NOTE_MAX_BYTES = 1024 * 1024;
export const NOTEPAD_MAX_IMAGES = 200;
export const IMAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const NOTEPAD_KEY_RE = /^[a-z0-9-]{1,40}-[0-9a-f]{12}$/;
export const TAB_ID_RE = /^[0-9a-f]{12}$/;
export const TAB_NAME_MAX = 40;
export const NOTEPAD_MAX_TABS = 20;
// The fixed id of the tab the first-shape note and pictures move into.
export const LEGACY_TAB_ID = "0000000000a1";

// A refusal the routes turn into `{ error: code }` with this status. Codes:
// bad, too-long, too-many, not-jpeg, not-found, and for tabs bad-name (400),
// duplicate-name (409), too-many-tabs (409), no-such-tab (404).
export class NotepadError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

/* ------------------------------------------------------------------ names */

// `<folder-name>-<first 12 hex of sha256(foldKey(folder))>`: recognisable in a
// file browser, safe on every OS, and one notepad per folder however its case
// is typed where the file system ignores case.
export function notepadKey(folder) {
  const slug =
    path
      .basename(path.resolve(String(folder || "")))
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40)
      .replace(/-+$/, "") || "folder";
  const hash = crypto.createHash("sha256").update(foldKey(folder)).digest("hex").slice(0, 12);
  return slug + "-" + hash;
}

export function notepadFolder(folder) {
  return path.join(notepadsDir(), notepadKey(folder));
}

/** A tab name, trimmed and with inner whitespace collapsed, or a `bad-name` refusal. */
export function normalizeTabName(name) {
  if (typeof name !== "string") throw new NotepadError("bad-name", 400);
  const clean = name.trim().replace(/\s+/g, " ");
  // Code points, not UTF-16 units, so one emoji counts as one.
  if (!clean || [...clean].length > TAB_NAME_MAX || /[\u0000-\u001f\u007f]/.test(clean)) throw new NotepadError("bad-name", 400);
  return clean;
}

/** What two names are compared by: the same name however its case is typed. */
export const nameKey = (name) => normalizeTabName(name).toLocaleLowerCase("en-US");

/* ------------------------------------------------------------------ index */

const INDEX_FILE = "tabs.json";
const META_FILE = "meta.json";

const isDir = (p) => {
  try {
    return fs.lstatSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isFile = (p) => {
  try {
    return fs.lstatSync(p).isFile();
  } catch {
    return false;
  }
};

// `{ order, last, tabs: { id: { name, created } } }` from tabs.json with every
// part of its shape checked, or null when it is missing or does not hold up.
function readIndex(dir) {
  const raw = readJson(path.join(dir, INDEX_FILE));
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.order)) return null;
  if (!raw.tabs || typeof raw.tabs !== "object" || Array.isArray(raw.tabs)) return null;
  if (raw.order.length !== Object.keys(raw.tabs).length || new Set(raw.order).size !== raw.order.length) return null;
  const tabs = {};
  for (const id of raw.order) {
    if (typeof id !== "string" || !TAB_ID_RE.test(id)) return null;
    const t = raw.tabs[id];
    if (!t || typeof t !== "object") return null;
    try {
      tabs[id] = { name: normalizeTabName(t.name), created: typeof t.created === "string" ? t.created : null };
    } catch {
      return null;
    }
  }
  if (raw.last !== null && !(typeof raw.last === "string" && Object.hasOwn(tabs, raw.last))) return null;
  return { order: [...raw.order], last: raw.last, tabs };
}

function writeIndex(dir, index) {
  writeJsonAtomic(path.join(dir, INDEX_FILE), { v: 1, order: index.order, last: index.last, tabs: index.tabs });
}

// True while the notepad still has the first shape: no tabs.json, and a note
// or a picture at the top, or a half-finished move into the first tab.
function legacyShape(dir) {
  if (fs.existsSync(path.join(dir, INDEX_FILE))) return false;
  if (isFile(path.join(dir, "note.md")) || isDir(path.join(dir, "tabs", LEGACY_TAB_ID))) return true;
  try {
    return fs.readdirSync(path.join(dir, "images")).some((n) => n.endsWith(".jpg"));
  } catch {
    return false;
  }
}

// Read only: is this a tab the notepad has (or, still in the first shape, the
// one it will have)? A damaged index answers by the folders on disk, since the
// next write rebuilds it from them.
function knownTab(dir, tab) {
  if (typeof tab !== "string" || !TAB_ID_RE.test(tab)) return false;
  const index = readIndex(dir);
  if (index) return Object.hasOwn(index.tabs, tab);
  if (fs.existsSync(path.join(dir, INDEX_FILE))) return isDir(path.join(dir, "tabs", tab));
  return tab === LEGACY_TAB_ID && legacyShape(dir);
}

function requireTab(folder, tab) {
  if (!knownTab(notepadFolder(folder), tab)) throw new NotepadError("no-such-tab", 404);
}

/* ------------------------------------------------------------------ write */

// A rename, retried while Windows still holds the file or folder.
function moveEntry(from, to) {
  let lastErr;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      lastErr = err;
      if (err.code !== "EPERM" && err.code !== "EBUSY" && err.code !== "EACCES") break;
      sleepSync(40 * (attempt + 1));
    }
  }
  throw lastErr;
}

function writeMeta(dir, folder) {
  const file = path.join(dir, META_FILE);
  const meta = readJson(file);
  if (meta && meta.v === 2) return;
  const had = meta && typeof meta === "object";
  writeJsonAtomic(file, {
    v: 2,
    folder: had && typeof meta.folder === "string" ? meta.folder : path.resolve(String(folder)),
    created: had && typeof meta.created === "string" ? meta.created : nowIso(),
  });
}

// The first shape into the first tab: the note, then the pictures, then the
// index, then meta.json's version. Each step looks at what is already there,
// so running it again after a crash at any point finishes the move and loses
// or duplicates nothing.
function migrate(dir, folder) {
  if (!legacyShape(dir)) return;
  const leg = path.join(dir, "tabs", LEGACY_TAB_ID);
  ensureDir(leg);
  const rootNote = path.join(dir, "note.md");
  if (isFile(rootNote) && !fs.existsSync(path.join(leg, "note.md"))) moveEntry(rootNote, path.join(leg, "note.md"));
  const rootImages = path.join(dir, "images");
  const target = path.join(leg, "images");
  if (isDir(rootImages)) {
    if (!fs.existsSync(target)) {
      moveEntry(rootImages, target);
    } else {
      for (const name of fs.readdirSync(rootImages)) {
        if (!fs.existsSync(path.join(target, name))) moveEntry(path.join(rootImages, name), path.join(target, name));
      }
      fs.rmSync(rootImages, { recursive: true, force: true });
    }
  }
  ensureDir(target);
  writeIndex(dir, { order: [LEGACY_TAB_ID], last: LEGACY_TAB_ID, tabs: { [LEGACY_TAB_ID]: { name: "Notes", created: nowIso() } } });
  writeMeta(dir, folder);
}

// A tabs.json that does not hold up is set aside and rebuilt from the tab
// folders on disk, so a damaged index never costs a note.
function recoverIndex(dir) {
  const file = path.join(dir, INDEX_FILE);
  try {
    moveEntry(file, file + ".corrupt");
  } catch {}
  let names = [];
  try {
    names = fs
      .readdirSync(path.join(dir, "tabs"), { withFileTypes: true })
      .filter((e) => e.isDirectory() && TAB_ID_RE.test(e.name))
      .map((e) => e.name)
      .sort();
  } catch {}
  const tabs = {};
  names.forEach((id, i) => (tabs[id] = { name: "Recovered " + (i + 1), created: nowIso() }));
  return { order: names, last: names[0] ?? null, tabs };
}

// What every write starts from, under the lock: finish a move from the first
// shape, give a fresh notepad its empty index, and settle meta.json at v: 2.
function prepare(dir, folder) {
  migrate(dir, folder);
  let index = readIndex(dir);
  if (!index) {
    index = fs.existsSync(path.join(dir, INDEX_FILE)) ? recoverIndex(dir) : { order: [], last: null, tabs: {} };
    writeIndex(dir, index);
    try {
      fs.rmdirSync(path.join(dir, "images")); // an empty leftover of the first shape
    } catch {}
  }
  writeMeta(dir, folder);
  return index;
}

// Every write goes through here: the folder and its index come into being on
// the first one, and each runs under the notepad's own lock so two pages on
// one folder never interleave. Nothing that only reads calls it.
function withNotepad(folder, fn) {
  const dir = notepadFolder(folder);
  ensureDir(dir);
  return withStateLock(
    dir,
    () => {
      const index = prepare(dir, folder);
      return fn(dir, index);
    },
    "notepad.lock",
  );
}

// Index first, then the folders it no longer names: a crash between the two
// leaves a stray folder the next structure change sweeps away.
function commit(dir, index) {
  writeIndex(dir, index);
  sweepOrphanTabs(dir, index);
}

/**
 * Remove every `tabs/<id>` folder the index does not name: only real
 * directories (never a link) whose name is a tab id.
 */
export function sweepOrphanTabs(dir, index) {
  let entries;
  try {
    entries = fs.readdirSync(path.join(dir, "tabs"), { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory() && TAB_ID_RE.test(e.name) && !Object.hasOwn(index.tabs, e.name)) {
      fs.rmSync(path.join(dir, "tabs", e.name), { recursive: true, force: true });
    }
  }
}

/* ------------------------------------------------------------------- read */

const fullImage = (name) => name.endsWith(".jpg") && !name.endsWith(".thumb.jpg") && IMAGE_ID_RE.test(name.slice(0, -4));

function mtimeOf(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

// The full images' ids across these folders, oldest first (an image is never
// rewritten after it is added, so its mtime is when it arrived), each with the
// folder it was found in.
function imageEntries(dirs) {
  const seen = new Map();
  for (const d of dirs) {
    let names;
    try {
      names = fs.readdirSync(d);
    } catch {
      continue;
    }
    for (const name of names.filter(fullImage)) {
      const id = name.slice(0, -4);
      if (!seen.has(id)) seen.set(id, { id, dir: d, at: mtimeOf(path.join(d, name)) ?? 0 });
    }
  }
  return [...seen.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

const imageUrl = (tab, id, thumb) => "/notepad/images/" + tab + "/" + id + (thumb ? ".thumb" : "") + ".jpg";

/**
 * The tabs, as `[{ id, name }]` in order, and the one last used. Read only; a
 * notepad still in the first shape answers one virtual tab, Notes.
 */
export function listTabs(folder) {
  const dir = notepadFolder(folder);
  if (!fs.existsSync(dir)) return { tabs: [], last: null };
  const index = readIndex(dir);
  if (index) return { tabs: index.order.map((id) => ({ id, name: index.tabs[id].name })), last: index.last };
  if (legacyShape(dir)) return { tabs: [{ id: LEGACY_TAB_ID, name: "Notes" }], last: LEGACY_TAB_ID };
  return { tabs: [], last: null };
}

/** The tab an unnamed request means: the last one used, else the first, else null. */
export function defaultTabId(folder) {
  const { tabs, last } = listTabs(folder);
  return last ?? (tabs[0] ? tabs[0].id : null);
}

/**
 * What the page shows:
 * `{ tabs: [{ id, name }], last, tab: { id, text, savedAt, images } | null }`
 * for the tab asked for (else the default one), plus that tab's `text`,
 * `savedAt` and `images` at the top, where the first page read them. A named
 * tab that does not exist is a `no-such-tab` refusal. Never creates or writes
 * anything; a folder with no notepad yet reads empty.
 */
export function readNotepad(folder, tabId) {
  if (tabId !== undefined && tabId !== null && !(typeof tabId === "string" && TAB_ID_RE.test(tabId))) {
    throw new NotepadError("no-such-tab", 404);
  }
  const { tabs, last } = listTabs(folder);
  const id = tabId ?? last ?? (tabs[0] ? tabs[0].id : null);
  if (tabId && !tabs.some((t) => t.id === tabId)) throw new NotepadError("no-such-tab", 404);
  if (id === null) return { tabs, last, tab: null, text: "", savedAt: null, images: [] };
  const dir = notepadFolder(folder);
  const legacy = id === LEGACY_TAB_ID && !readIndex(dir) && legacyShape(dir);
  const tabDir = path.join(dir, "tabs", id);
  // Still in the first shape: the note and pictures are at the top, or, in a
  // half-finished move, split between the top and the first tab.
  const noteFiles = legacy ? [path.join(dir, "note.md"), path.join(tabDir, "note.md")] : [path.join(tabDir, "note.md")];
  const imageDirs = legacy ? [path.join(tabDir, "images"), path.join(dir, "images")] : [path.join(tabDir, "images")];
  const note = noteFiles.find(isFile) ?? noteFiles[0];
  let text = "";
  try {
    text = fs.readFileSync(note, "utf8");
  } catch {}
  const at = mtimeOf(note);
  const images = imageEntries(imageDirs).map((e) => ({
    id: e.id,
    url: imageUrl(id, e.id, false),
    thumb: fs.existsSync(path.join(e.dir, e.id + ".thumb.jpg")) ? imageUrl(id, e.id, true) : null,
  }));
  const savedAt = at === null ? null : new Date(at).toISOString();
  return { tabs, last, tab: { id, text, savedAt, images }, text, savedAt, images };
}

/* ------------------------------------------------------------- tab changes */

/** Add a tab named `name` and make it the last one used. Resolves to `{ id, name }`. */
export function createTab(folder, name) {
  const clean = normalizeTabName(name);
  return withNotepad(folder, (dir, index) => {
    if (index.order.length >= NOTEPAD_MAX_TABS) throw new NotepadError("too-many-tabs", 409);
    const key = nameKey(clean);
    if (index.order.some((id) => nameKey(index.tabs[id].name) === key)) throw new NotepadError("duplicate-name", 409);
    let id;
    do id = crypto.randomBytes(6).toString("hex");
    while (Object.hasOwn(index.tabs, id) || id === LEGACY_TAB_ID || fs.existsSync(path.join(dir, "tabs", id)));
    ensureDir(path.join(dir, "tabs", id, "images"));
    index.order.push(id);
    index.tabs[id] = { name: clean, created: nowIso() };
    index.last = id;
    commit(dir, index);
    return { id, name: clean };
  });
}

/** Give a tab a new name (the same name in another case is allowed). */
export function renameTab(folder, id, name) {
  const clean = normalizeTabName(name);
  requireTab(folder, id);
  return withNotepad(folder, (dir, index) => {
    if (!Object.hasOwn(index.tabs, id)) throw new NotepadError("no-such-tab", 404);
    const key = nameKey(clean);
    if (index.order.some((other) => other !== id && nameKey(index.tabs[other].name) === key)) {
      throw new NotepadError("duplicate-name", 409);
    }
    index.tabs[id].name = clean;
    commit(dir, index);
    return { id, name: clean };
  });
}

/** Remember which tab was open last. */
export function setLastTab(folder, id) {
  requireTab(folder, id);
  return withNotepad(folder, (dir, index) => {
    if (!Object.hasOwn(index.tabs, id)) throw new NotepadError("no-such-tab", 404);
    if (index.last !== id) {
      index.last = id;
      commit(dir, index);
    }
    return {};
  });
}

const sameIds = (order, ids) =>
  Array.isArray(order) &&
  order.length === ids.length &&
  new Set(order).size === order.length &&
  order.every((id) => typeof id === "string" && ids.includes(id));

/** Put the tabs in a new order: the list must hold every current id exactly once. */
export function reorderTabs(folder, order) {
  if (!sameIds(order, listTabs(folder).tabs.map((t) => t.id))) throw new NotepadError("bad", 400);
  return withNotepad(folder, (dir, index) => {
    if (!sameIds(order, index.order)) throw new NotepadError("bad", 400);
    index.order = [...order];
    commit(dir, index);
    return {};
  });
}

/** Delete a tab, its note and its pictures: the index first, then the folder. */
export function deleteTab(folder, id) {
  requireTab(folder, id);
  return withNotepad(folder, (dir, index) => {
    if (!Object.hasOwn(index.tabs, id)) throw new NotepadError("no-such-tab", 404);
    const at = index.order.indexOf(id);
    index.order.splice(at, 1);
    delete index.tabs[id];
    if (index.last === id) index.last = index.order[at] ?? index.order[at - 1] ?? null;
    writeIndex(dir, index);
    fs.rmSync(path.join(dir, "tabs", id), { recursive: true, force: true });
    sweepOrphanTabs(dir, index);
    return {};
  });
}

/* ------------------------------------------------------------ text, pictures */

const isJpeg = (buf) => Buffer.isBuffer(buf) && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const isImageId = (id) => typeof id === "string" && IMAGE_ID_RE.test(id);

// Inside the lock the tab must be one the (possibly just migrated) index has.
function inTab(tab, index, dir) {
  if (!Object.hasOwn(index.tabs, tab)) throw new NotepadError("no-such-tab", 404);
  return path.join(dir, "tabs", tab);
}

/** Replace a tab's text. Resolves to `{ savedAt }`, the written file's time. */
export function saveNote(folder, tab, text) {
  if (typeof text !== "string") throw new NotepadError("bad", 400);
  if (Buffer.byteLength(text, "utf8") > NOTE_MAX_BYTES) throw new NotepadError("too-long", 413);
  requireTab(folder, tab);
  return withNotepad(folder, (dir, index) => {
    const note = path.join(inTab(tab, index, dir), "note.md");
    writeTextAtomic(note, text);
    return { savedAt: new Date(fs.statSync(note).mtimeMs).toISOString() };
  });
}

/** Add a picture (JPEG bytes) to a tab. Resolves to `{ id, url }`. */
export function addImage(folder, tab, buf) {
  if (!isJpeg(buf)) throw new NotepadError("not-jpeg", 415);
  requireTab(folder, tab);
  return withNotepad(folder, (dir, index) => {
    const images = path.join(inTab(tab, index, dir), "images");
    if (imageEntries([images]).length >= NOTEPAD_MAX_IMAGES) throw new NotepadError("too-many", 409);
    const id = crypto.randomUUID();
    ensureDir(images);
    fs.writeFileSync(path.join(images, id + ".jpg"), buf, { flag: "wx" });
    return { id, url: imageUrl(tab, id, false) };
  });
}

/** Set (or replace) a picture's thumbnail. */
export function addThumb(folder, tab, id, buf) {
  requireTab(folder, tab);
  if (!isImageId(id) || !fs.existsSync(path.join(notepadFolder(folder), "tabs", tab, "images", id + ".jpg"))) {
    throw new NotepadError("not-found", 404);
  }
  if (!isJpeg(buf)) throw new NotepadError("not-jpeg", 415);
  return withNotepad(folder, (dir, index) => {
    const images = path.join(inTab(tab, index, dir), "images");
    if (!fs.existsSync(path.join(images, id + ".jpg"))) throw new NotepadError("not-found", 404);
    // Replacing a file is the rename Windows can refuse for a moment, so it
    // takes the retrying write (a Buffer is written as is).
    writeTextAtomic(path.join(images, id + ".thumb.jpg"), buf);
    return {};
  });
}

/** Remove a picture and its thumbnail. */
export function removeImage(folder, tab, id) {
  requireTab(folder, tab);
  // Checked before the lock too, so a refused delete never brings an empty
  // notepad into being.
  if (!isImageId(id) || !fs.existsSync(path.join(notepadFolder(folder), "tabs", tab, "images", id + ".jpg"))) {
    throw new NotepadError("not-found", 404);
  }
  return withNotepad(folder, (dir, index) => {
    const images = path.join(inTab(tab, index, dir), "images");
    const full = path.join(images, id + ".jpg");
    if (!fs.existsSync(full)) throw new NotepadError("not-found", 404);
    fs.rmSync(full, { force: true });
    fs.rmSync(path.join(images, id + ".thumb.jpg"), { force: true });
    return {};
  });
}

/**
 * The file behind `/notepad/images/<tab>/<id>[.thumb].jpg`, or null: the tab
 * must be one this notepad has, the id a UUID, the file a regular file (never
 * a link) whose real path sits inside the notepads folder's. A notepad still
 * in the first shape also serves its top-level pictures as the Notes tab's.
 */
export function imagePath(folder, tab, id, thumb) {
  if (!isImageId(id)) return null;
  const dir = notepadFolder(folder);
  if (!knownTab(dir, tab)) return null;
  const name = id + (thumb ? ".thumb.jpg" : ".jpg");
  const candidates = [path.join(dir, "tabs", tab, "images", name)];
  if (tab === LEGACY_TAB_ID && legacyShape(dir)) candidates.push(path.join(dir, "images", name));
  for (const file of candidates) {
    try {
      if (!fs.lstatSync(file).isFile()) continue;
      const [realFile, realRoot] = [fs.realpathSync(file), fs.realpathSync(notepadsDir())];
      // path.relative, not a prefix test, as readOverview() in sessions.mjs does.
      const rel = path.relative(realRoot, realFile);
      if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) continue;
      return realFile;
    } catch {}
  }
  return null;
}

/* ---------------------------------------------------------------- cleanup */

/**
 * The notepads nobody has touched for `maxAgeMs`, judged by the newest file in
 * each, as `[{ key, folder, path }]`: only real folders directly under the
 * notepads folder whose name is a notepad key (never a link, never a file).
 * `folder` is the one `meta.json` names, or null when it is missing or
 * unreadable. User Preferences, Cleanup is the only caller: no sweep ever
 * removes a notepad.
 */
export function staleNotepads(now = Date.now(), maxAgeMs) {
  const root = notepadsDir();
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory() && NOTEPAD_KEY_RE.test(e.name))
    .map((e) => ({ key: e.name, path: path.join(root, e.name) }))
    .filter((e) => now - newestMtime(e.path) >= maxAgeMs)
    .map((e) => {
      const meta = readJson(path.join(e.path, "meta.json"));
      const folder = meta && typeof meta.folder === "string" && meta.folder ? meta.folder : null;
      return { key: e.key, folder, path: e.path };
    });
}

/** Remove a whole notepad by its key: never a bad key, a link or anything outside the notepads folder. */
export function removeNotepad(key) {
  if (typeof key !== "string" || !NOTEPAD_KEY_RE.test(key)) throw new NotepadError("bad", 400);
  const root = path.resolve(notepadsDir());
  const dir = path.resolve(root, key);
  // path.relative, not a prefix test, as imagePath() does.
  const rel = path.relative(root, dir);
  if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) throw new NotepadError("bad", 400);
  let st;
  try {
    st = fs.lstatSync(dir);
  } catch {
    throw new NotepadError("not-found", 404);
  }
  if (!st.isDirectory()) throw new NotepadError("bad", 400);
  fs.rmSync(dir, { recursive: true, force: true });
}
