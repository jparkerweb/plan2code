// Plan2Code Web Console - the notepad store.
//
// One notepad per folder Plan2Code runs in (the session's worktree, else its
// project), outside every repo and every session:
//
//   ~/.plan2code/notepads/<folder-name>-<12 hex>/
//     meta.json          { v: 1, folder, created }, written once
//     note.md            the text, UTF-8, written atomically
//     images/<uuid>.jpg          a picture, JPEG from the page
//     images/<uuid>.thumb.jpg    its thumbnail, when the page sent one
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

import { ensureDir, newestMtime, nowIso, readJson, withStateLock, writeJsonAtomic, writeTextAtomic } from "./files.mjs";
import { foldKey } from "./workspace.mjs";

// Read at call time, so a test that sets the variable after import sees it.
export function notepadsDir() {
  return process.env.PLAN2CODE_NOTEPADS_DIR || path.join(os.homedir(), ".plan2code", "notepads");
}

export const NOTE_MAX_BYTES = 1024 * 1024;
export const NOTEPAD_MAX_IMAGES = 200;
export const IMAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const NOTEPAD_KEY_RE = /^[a-z0-9-]{1,40}-[0-9a-f]{12}$/;

// A refusal the routes turn into `{ error: code }` with this status.
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

/* ------------------------------------------------------------------ write */

// Every write goes through here: the folder, its images/ and meta.json come
// into being on the first one, and each runs under the notepad's own lock so
// two pages on one folder never interleave. Nothing that only reads calls it.
function withNotepad(folder, fn) {
  const dir = notepadFolder(folder);
  ensureDir(path.join(dir, "images"));
  const meta = path.join(dir, "meta.json");
  if (!fs.existsSync(meta)) writeJsonAtomic(meta, { v: 1, folder: path.resolve(String(folder)), created: nowIso() });
  return withStateLock(dir, () => fn(dir), "notepad.lock");
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

// The full images' ids, oldest first (an image is never rewritten after it is
// added, so its mtime is when it arrived).
function imageIds(dir) {
  let names;
  try {
    names = fs.readdirSync(path.join(dir, "images"));
  } catch {
    return [];
  }
  return names
    .filter(fullImage)
    .map((name) => ({ id: name.slice(0, -4), at: mtimeOf(path.join(dir, "images", name)) ?? 0 }))
    .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => e.id);
}

/**
 * What the page shows: `{ text, savedAt, images: [{ id, url, thumb }] }`.
 * Never creates or writes anything; a folder with no notepad yet reads empty.
 */
export function readNotepad(folder) {
  const dir = notepadFolder(folder);
  if (!fs.existsSync(dir)) return { text: "", savedAt: null, images: [] };
  const note = path.join(dir, "note.md");
  let text = "";
  try {
    text = fs.readFileSync(note, "utf8");
  } catch {}
  const at = mtimeOf(note);
  const images = imageIds(dir).map((id) => ({
    id,
    url: "/notepad/images/" + id + ".jpg",
    thumb: fs.existsSync(path.join(dir, "images", id + ".thumb.jpg")) ? "/notepad/images/" + id + ".thumb.jpg" : null,
  }));
  return { text, savedAt: at === null ? null : new Date(at).toISOString(), images };
}

/* ------------------------------------------------------------------ change */

const isJpeg = (buf) => Buffer.isBuffer(buf) && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
const isImageId = (id) => typeof id === "string" && IMAGE_ID_RE.test(id);

/** Replace the note's text. Resolves to `{ savedAt }`, the written file's time. */
export function saveNote(folder, text) {
  if (typeof text !== "string") throw new NotepadError("bad", 400);
  if (Buffer.byteLength(text, "utf8") > NOTE_MAX_BYTES) throw new NotepadError("too-long", 413);
  return withNotepad(folder, (dir) => {
    const note = path.join(dir, "note.md");
    writeTextAtomic(note, text);
    return { savedAt: new Date(fs.statSync(note).mtimeMs).toISOString() };
  });
}

/** Add a picture (JPEG bytes). Resolves to `{ id, url }`. */
export function addImage(folder, buf) {
  if (!isJpeg(buf)) throw new NotepadError("not-jpeg", 415);
  return withNotepad(folder, (dir) => {
    if (imageIds(dir).length >= NOTEPAD_MAX_IMAGES) throw new NotepadError("too-many", 409);
    const id = crypto.randomUUID();
    fs.writeFileSync(path.join(dir, "images", id + ".jpg"), buf, { flag: "wx" });
    return { id, url: "/notepad/images/" + id + ".jpg" };
  });
}

/** Set (or replace) a picture's thumbnail. */
export function addThumb(folder, id, buf) {
  if (!isImageId(id) || !fs.existsSync(path.join(notepadFolder(folder), "images", id + ".jpg"))) {
    throw new NotepadError("not-found", 404);
  }
  if (!isJpeg(buf)) throw new NotepadError("not-jpeg", 415);
  return withNotepad(folder, (dir) => {
    if (!fs.existsSync(path.join(dir, "images", id + ".jpg"))) throw new NotepadError("not-found", 404);
    // Replacing a file is the rename Windows can refuse for a moment, so it
    // takes the retrying write (a Buffer is written as is).
    writeTextAtomic(path.join(dir, "images", id + ".thumb.jpg"), buf);
    return {};
  });
}

/** Remove a picture and its thumbnail. */
export function removeImage(folder, id) {
  // Checked before the lock too, so a refused delete never brings an empty
  // notepad into being.
  if (!isImageId(id) || !fs.existsSync(path.join(notepadFolder(folder), "images", id + ".jpg"))) {
    throw new NotepadError("not-found", 404);
  }
  return withNotepad(folder, (dir) => {
    const full = path.join(dir, "images", id + ".jpg");
    if (!fs.existsSync(full)) throw new NotepadError("not-found", 404);
    fs.rmSync(full, { force: true });
    fs.rmSync(path.join(dir, "images", id + ".thumb.jpg"), { force: true });
    return {};
  });
}

/**
 * The file behind `/notepad/images/<id>[.thumb].jpg`, or null: the id must be
 * a UUID, the file a regular file (never a link) whose real path sits inside
 * the notepads folder's.
 */
export function imagePath(folder, id, thumb) {
  if (!isImageId(id)) return null;
  const file = path.join(notepadFolder(folder), "images", id + (thumb ? ".thumb.jpg" : ".jpg"));
  try {
    if (!fs.lstatSync(file).isFile()) return null;
    const [realFile, realRoot] = [fs.realpathSync(file), fs.realpathSync(notepadsDir())];
    // path.relative, not a prefix test, as readOverview() in sessions.mjs does.
    const rel = path.relative(realRoot, realFile);
    if (!rel || rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) return null;
    return realFile;
  } catch {
    return null;
  }
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
