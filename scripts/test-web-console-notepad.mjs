// Web console tests, the notepad: the store in notepads.mjs (names, reads,
// saves, pictures, path checks), its /notepad routes, that nothing in a
// notepad ever reaches the agent, how Cleanup treats the folder, and the
// page's pure rules in public/notepad.js (saving, status words, errors).
// Run with: node --test scripts/test-web-console-notepad.mjs
//
// Shared setup (a per-process console home, the CLI runner, fixtures) lives in
// web-console-test-helpers.mjs; see the comment at its top. Every notepad here
// lands in its throwaway NOTEPADS_DIR, never the real home folder.

import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DAY_MS, HOME, JPEG, NOTEPADS_DIR, ROOT, backdate, cli, openSession, sleep } from "./web-console-test-helpers.mjs";

const store = await import("../src/web-console/notepads.mjs");
const rules = await import("../src/web-console/public/notepad.js");
const { cleanupFindings, removeCleanup } = await import("../src/web-console/sessions.mjs");
const {
  IMAGE_ID_RE,
  NOTE_MAX_BYTES,
  NOTEPAD_KEY_RE,
  LEGACY_TAB_ID,
  NOTEPAD_MAX_IMAGES,
  NOTEPAD_MAX_TABS,
  TAB_NAME_MAX,
  addImage,
  addThumb,
  createTab,
  deleteTab,
  imagePath,
  listTabs,
  notepadFolder,
  notepadKey,
  notepadsDir,
  readNotepad,
  removeImage,
  removeNotepad,
  renameTab,
  reorderTabs,
  saveNote,
  setLastTab,
  staleNotepads,
  sweepOrphanTabs,
} = store;

const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";
let folders = 0;
// A project folder of its own per test, so no two tests share a notepad.
const freshFolder = (name = "proj") => path.join(HOME, "projects", `${name}-${++folders}`);
// A new tab in the folder's notepad, as its id: every text and picture write names one.
const tabOf = (folder, name = "Notes") => createTab(folder, name).id;
// The folder where a tab keeps its note and pictures.
const tabDir = (folder, tab) => path.join(notepadFolder(folder), "tabs", tab);
const refusal = (fn, code) =>
  assert.throws(fn, (e) => e instanceof store.NotepadError && e.code === code, `expected ${code}`);

/* ----------------------------------------------------------------- store */

test("notepadsDir follows PLAN2CODE_NOTEPADS_DIR at call time", () => {
  assert.equal(notepadsDir(), NOTEPADS_DIR);
});

test("notepadKey is the folder name and a hash, folded where the file system ignores case", () => {
  const key = notepadKey(path.join(HOME, "My Project"));
  assert.match(key, NOTEPAD_KEY_RE);
  assert.ok(key.startsWith("my-project-"), key);
  const upper = notepadKey(path.join(HOME.toUpperCase(), "MY PROJECT"));
  if (FOLD_CASE) assert.equal(upper, key);
  else assert.notEqual(upper, key);
  // Two worktrees, two notepads.
  assert.notEqual(notepadKey(path.join(HOME, "repo")), notepadKey(path.join(HOME, "repo-feature")));
  // Nothing usable in the name still gives a key the pattern accepts.
  assert.match(notepadKey(path.join(HOME, "ÄÖÜ")), /^folder-[0-9a-f]{12}$/);
  assert.match(notepadKey(path.join(HOME, "a-".repeat(40))), NOTEPAD_KEY_RE);
});

test("reading a folder with no notepad creates nothing", () => {
  const folder = freshFolder();
  assert.deepEqual(readNotepad(folder), { tabs: [], last: null, tab: null, text: "", savedAt: null, images: [] });
  assert.deepEqual(listTabs(folder), { tabs: [], last: null });
  assert.equal(fs.existsSync(notepadFolder(folder)), false);
});

test("saveNote round-trips text atomically, with meta.json written once", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  const { savedAt } = saveNote(folder, tab, "# Ideas\n\n- one ✓\n");
  assert.ok(!Number.isNaN(Date.parse(savedAt)));
  const read = readNotepad(folder);
  assert.equal(read.text, "# Ideas\n\n- one ✓\n");
  assert.equal(read.savedAt, savedAt);
  assert.deepEqual(read.tab, { id: tab, text: read.text, savedAt, images: [] });
  const dir = notepadFolder(folder);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  assert.equal(meta.v, 2);
  assert.equal(meta.folder, path.resolve(folder));
  saveNote(folder, tab, "second");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")), meta);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["meta.json", "tabs", "tabs.json"]);
  assert.deepEqual(fs.readdirSync(tabDir(folder, tab)).sort(), ["images", "note.md"]);
});

test("saveNote refuses a non-string and a note one byte over the cap", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  refusal(() => saveNote(folder, tab, 5), "bad");
  refusal(() => saveNote(folder, tab, null), "bad");
  refusal(() => saveNote(folder, tab, "x".repeat(NOTE_MAX_BYTES + 1)), "too-long");
  // Bytes, not characters: a multi-byte character counts for its bytes.
  refusal(() => saveNote(folder, tab, "é".repeat(NOTE_MAX_BYTES / 2 + 1)), "too-long");
  assert.ok(saveNote(folder, tab, "x".repeat(NOTE_MAX_BYTES)).savedAt);
});

test("reading a notepad leaves every file time alone", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  saveNote(folder, tab, "text");
  const { id } = addImage(folder, tab, JPEG);
  const dir = notepadFolder(folder);
  const files = [
    path.join(tabDir(folder, tab), "note.md"),
    path.join(dir, "meta.json"),
    path.join(dir, "tabs.json"),
    path.join(tabDir(folder, tab), "images", id + ".jpg"),
  ];
  const old = new Date(Date.now() - 40 * DAY_MS);
  for (const f of files) fs.utimesSync(f, old, old);
  readNotepad(folder);
  readNotepad(folder, tab);
  listTabs(folder);
  imagePath(folder, tab, id, false);
  for (const f of files) assert.equal(Math.round(fs.statSync(f).mtimeMs), old.getTime(), f);
});

test("pictures: JPEG only, listed oldest first, with thumbnails when sent", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  refusal(() => addImage(folder, tab, Buffer.from("not a jpeg")), "not-jpeg");
  refusal(() => addImage(folder, tab, "string"), "not-jpeg");
  const first = addImage(folder, tab, JPEG);
  const second = addImage(folder, tab, JPEG);
  assert.match(first.id, IMAGE_ID_RE);
  assert.equal(first.url, `/notepad/images/${tab}/${first.id}.jpg`);
  // Make the order unambiguous: the first is older.
  const older = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(tabDir(folder, tab), "images", first.id + ".jpg"), older, older);
  addThumb(folder, tab, second.id, JPEG);
  assert.deepEqual(readNotepad(folder).images, [
    { id: first.id, url: first.url, thumb: null },
    { id: second.id, url: second.url, thumb: `/notepad/images/${tab}/${second.id}.thumb.jpg` },
  ]);
});

test("addThumb and removeImage refuse bad and unknown ids", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  const { id } = addImage(folder, tab, JPEG);
  for (const bad of ["../x", "", null, 7, "00000000-0000-0000-0000-000000000000"]) {
    refusal(() => addThumb(folder, tab, bad, JPEG), "not-found");
    refusal(() => removeImage(folder, tab, bad), "not-found");
  }
  refusal(() => addThumb(folder, tab, id, Buffer.from("png")), "not-jpeg");
  addThumb(folder, tab, id, JPEG);
  removeImage(folder, tab, id);
  assert.deepEqual(readNotepad(folder).images, []);
  assert.deepEqual(fs.readdirSync(path.join(tabDir(folder, tab), "images")), []);
});

test("a refused delete or thumb on a folder with no notepad creates nothing", () => {
  const folder = freshFolder();
  refusal(() => removeImage(folder, LEGACY_TAB_ID, "00000000-0000-0000-0000-000000000000"), "no-such-tab");
  refusal(() => addThumb(folder, LEGACY_TAB_ID, "00000000-0000-0000-0000-000000000000", JPEG), "no-such-tab");
  assert.equal(fs.existsSync(notepadFolder(folder)), false);
});

test("a thumbnail replaced again leaves the newest bytes and no temp file", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  const { id } = addImage(folder, tab, JPEG);
  addThumb(folder, tab, id, JPEG);
  const second = Buffer.concat([JPEG, Buffer.from("second")]);
  addThumb(folder, tab, id, second);
  const images = path.join(tabDir(folder, tab), "images");
  assert.deepEqual(fs.readFileSync(path.join(images, id + ".thumb.jpg")), second);
  assert.deepEqual(fs.readdirSync(images).filter((n) => n.endsWith(".tmp")), []);
});

test("the image cap refuses one past NOTEPAD_MAX_IMAGES, per tab", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  const images = path.join(tabDir(folder, tab), "images");
  addImage(folder, tab, JPEG);
  // Fill the rest directly: 200 real round trips would only slow the suite.
  for (let i = 1; i < NOTEPAD_MAX_IMAGES; i++) fs.writeFileSync(path.join(images, crypto.randomUUID() + ".jpg"), JPEG);
  refusal(() => addImage(folder, tab, JPEG), "too-many");
  // Another tab has its own room.
  assert.match(addImage(folder, tabOf(folder, "Other"), JPEG).id, IMAGE_ID_RE);
});

test("imagePath refuses anything but this notepad's own regular files", (t) => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  const { id } = addImage(folder, tab, JPEG);
  assert.equal(imagePath(folder, tab, id, false), fs.realpathSync(path.join(tabDir(folder, tab), "images", id + ".jpg")));
  assert.equal(imagePath(folder, tab, id, true), null, "no thumb yet");
  assert.equal(imagePath(folder, tab, "../meta", false), null);
  assert.equal(imagePath(folder, tab, "00000000-0000-0000-0000-000000000000", false), null);
  // A picture is served only under the tab that holds it.
  const other = tabOf(folder, "Other");
  assert.equal(imagePath(folder, other, id, false), null);
  assert.equal(imagePath(folder, "ffffffffffff", id, false), null);
  assert.equal(imagePath(folder, "../tabs", id, false), null);
  // A planted link is refused even under a valid name.
  const outside = path.join(HOME, "outside.jpg");
  fs.writeFileSync(outside, JPEG);
  const linkId = crypto.randomUUID();
  try {
    fs.symlinkSync(outside, path.join(tabDir(folder, tab), "images", linkId + ".jpg"));
  } catch (e) {
    if (["EPERM", "EACCES"].includes(e.code)) return t.skip("symlinks need extra rights here");
    throw e;
  }
  assert.equal(imagePath(folder, tab, linkId, false), null);
});

test("no lock or temp file is left behind after writes", () => {
  const folder = freshFolder();
  const tab = tabOf(folder);
  saveNote(folder, tab, "a");
  const { id } = addImage(folder, tab, JPEG);
  addThumb(folder, tab, id, JPEG);
  addThumb(folder, tab, id, JPEG);
  const dir = notepadFolder(folder);
  const all = [...fs.readdirSync(dir), ...fs.readdirSync(tabDir(folder, tab)), ...fs.readdirSync(path.join(tabDir(folder, tab), "images"))];
  assert.equal(all.filter((n) => n.endsWith(".lock") || n.endsWith(".tmp")).length, 0, all.join(", "));
});

/* ------------------------------------------------------------------ tabs */

test("tab names: trimmed, whitespace collapsed, and refused when empty, too long or holding a control character", () => {
  assert.equal(store.normalizeTabName("  Ideas   and plans  "), "Ideas and plans");
  assert.equal(store.normalizeTabName("x".repeat(TAB_NAME_MAX)), "x".repeat(TAB_NAME_MAX));
  // Code points, not UTF-16 units: forty emoji fit, forty-one do not.
  assert.equal([...store.normalizeTabName("😀".repeat(TAB_NAME_MAX))].length, TAB_NAME_MAX);
  for (const bad of ["", "   ", "x".repeat(TAB_NAME_MAX + 1), "😀".repeat(TAB_NAME_MAX + 1), "a\u0001b", "a\u007fb", "a\u0000", 7, null, undefined, {}]) {
    refusal(() => store.normalizeTabName(bad), "bad-name");
  }
  assert.equal(store.nameKey("  Todo "), store.nameKey("TODO"));
});

test("createTab: names are unique ignoring case, the 21st tab is refused, and the new tab becomes the last one", () => {
  const folder = freshFolder();
  const first = createTab(folder, "  To   do ");
  assert.equal(first.name, "To do");
  assert.match(first.id, store.TAB_ID_RE);
  assert.ok(fs.statSync(path.join(tabDir(folder, first.id), "images")).isDirectory());
  assert.deepEqual(listTabs(folder), { tabs: [{ id: first.id, name: "To do" }], last: first.id });
  refusal(() => createTab(folder, "TO DO"), "duplicate-name");
  refusal(() => createTab(folder, " to  do"), "duplicate-name");
  refusal(() => createTab(folder, ""), "bad-name");
  const second = createTab(folder, "Later");
  assert.equal(listTabs(folder).last, second.id);
  assert.notEqual(second.id, first.id);
  for (let i = 2; i < NOTEPAD_MAX_TABS; i++) createTab(folder, "Tab " + i);
  assert.equal(listTabs(folder).tabs.length, NOTEPAD_MAX_TABS);
  refusal(() => createTab(folder, "One too many"), "too-many-tabs");
  assert.equal(listTabs(folder).tabs.length, NOTEPAD_MAX_TABS);
  assert.deepEqual(fs.readdirSync(path.join(notepadFolder(folder), "tabs")).length, NOTEPAD_MAX_TABS);
});

test("renameTab: the same name in another case is allowed, a taken name or an unknown tab is not", () => {
  const folder = freshFolder();
  const a = createTab(folder, "Alpha");
  const b = createTab(folder, "Beta");
  assert.deepEqual(renameTab(folder, a.id, "ALPHA"), { id: a.id, name: "ALPHA" });
  assert.deepEqual(renameTab(folder, a.id, "  Gamma  ray "), { id: a.id, name: "Gamma ray" });
  refusal(() => renameTab(folder, a.id, "beta"), "duplicate-name");
  refusal(() => renameTab(folder, a.id, ""), "bad-name");
  refusal(() => renameTab(folder, "ffffffffffff", "Delta"), "no-such-tab");
  refusal(() => renameTab(folder, "nope", "Delta"), "no-such-tab");
  refusal(() => renameTab(folder, null, "Delta"), "no-such-tab");
  assert.deepEqual(
    listTabs(folder).tabs.map((t) => t.name),
    ["Gamma ray", "Beta"],
  );
  assert.equal(listTabs(folder).tabs[1].id, b.id);
});

test("reorderTabs needs exactly the current ids once each, and setLastTab remembers a tab", () => {
  const folder = freshFolder();
  const [a, b, c] = ["A", "B", "C"].map((n) => createTab(folder, n).id);
  assert.deepEqual(listTabs(folder).tabs.map((t) => t.id), [a, b, c]);
  reorderTabs(folder, [c, a, b]);
  assert.deepEqual(listTabs(folder).tabs.map((t) => t.id), [c, a, b]);
  for (const bad of [[a, b], [a, b, c, c], [a, b, "ffffffffffff"], [a, a, b], "abc", null, [a, b, 7]]) {
    refusal(() => reorderTabs(folder, bad), "bad");
  }
  assert.deepEqual(listTabs(folder).tabs.map((t) => t.id), [c, a, b], "a refused order changes nothing");
  assert.equal(listTabs(folder).last, c, "the last tab created");
  setLastTab(folder, a);
  assert.equal(listTabs(folder).last, a);
  assert.equal(readNotepad(folder).tab.id, a, "an unnamed read opens the last tab");
  assert.equal(readNotepad(folder, b).tab.id, b);
  refusal(() => setLastTab(folder, "ffffffffffff"), "no-such-tab");
  refusal(() => readNotepad(folder, "ffffffffffff"), "no-such-tab");
  refusal(() => readNotepad(folder, "../x"), "no-such-tab");
});

test("deleteTab: the folder goes, last moves to a neighbor, and the last tab left leaves an empty list", () => {
  const folder = freshFolder();
  const [a, b, c] = ["A", "B", "C"].map((n) => createTab(folder, n).id);
  saveNote(folder, b, "bye");
  const { id: pic } = addImage(folder, b, JPEG);
  setLastTab(folder, b);
  deleteTab(folder, b);
  assert.equal(fs.existsSync(tabDir(folder, b)), false, "note and pictures went with it");
  assert.deepEqual(listTabs(folder), { tabs: [{ id: a, name: "A" }, { id: c, name: "C" }], last: c }, "the tab that took its place");
  assert.equal(imagePath(folder, b, pic, false), null);
  refusal(() => deleteTab(folder, b), "no-such-tab");
  deleteTab(folder, c);
  assert.equal(listTabs(folder).last, a, "no next tab: the one before");
  deleteTab(folder, a);
  assert.deepEqual(listTabs(folder), { tabs: [], last: null });
  const index = JSON.parse(fs.readFileSync(path.join(notepadFolder(folder), "tabs.json"), "utf8"));
  assert.deepEqual(index.order, []);
  assert.deepEqual(index.tabs, {});
  assert.equal(index.last, null);
  assert.deepEqual(readNotepad(folder), { tabs: [], last: null, tab: null, text: "", savedAt: null, images: [] });
});

test("every writer refuses an unknown or malformed tab, and a refusal creates nothing", () => {
  const folder = freshFolder();
  const unknown = "ffffffffffff";
  const pic = "00000000-0000-0000-0000-000000000000";
  for (const tab of [unknown, "nope", "", null, undefined, 7, "../tabs"]) {
    refusal(() => saveNote(folder, tab, "x"), "no-such-tab");
    refusal(() => addImage(folder, tab, JPEG), "no-such-tab");
    refusal(() => addThumb(folder, tab, pic, JPEG), "no-such-tab");
    refusal(() => removeImage(folder, tab, pic), "no-such-tab");
    refusal(() => renameTab(folder, tab, "x"), "no-such-tab");
    refusal(() => deleteTab(folder, tab), "no-such-tab");
    refusal(() => setLastTab(folder, tab), "no-such-tab");
  }
  refusal(() => reorderTabs(folder, [unknown]), "bad");
  refusal(() => createTab(folder, ""), "bad-name");
  assert.equal(fs.existsSync(notepadFolder(folder)), false, "no notepad came into being");
  // With a notepad, a refused write leaves its files exactly as they were.
  const tab = tabOf(folder);
  const snapshot = () => treeOf(notepadFolder(folder));
  const before = snapshot();
  refusal(() => saveNote(folder, unknown, "x"), "no-such-tab");
  refusal(() => addImage(folder, unknown, JPEG), "no-such-tab");
  refusal(() => deleteTab(folder, unknown), "no-such-tab");
  assert.deepEqual(snapshot(), before);
  assert.ok(tab);
});

// Every file under `dir` as `relative path -> size and mtime`, so a test can
// say "nothing was written" and mean it.
function treeOf(dir) {
  const out = {};
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        out[path.relative(dir, p).split(path.sep).join("/") + "/"] = 0;
        walk(p);
      } else {
        const st = fs.statSync(p);
        out[path.relative(dir, p).split(path.sep).join("/")] = `${st.size}@${Math.round(st.mtimeMs)}`;
      }
    }
  };
  walk(dir);
  return out;
}

test("the orphan sweep removes a stray tab folder, and leaves a linked one and a non-id name alone", (t) => {
  const folder = freshFolder();
  const keep = createTab(folder, "Keep");
  const tabs = path.join(notepadFolder(folder), "tabs");
  // What a crash between "index written" and "folder removed" leaves behind.
  const stray = path.join(tabs, "abcdefabcdef");
  fs.mkdirSync(path.join(stray, "images"), { recursive: true });
  fs.writeFileSync(path.join(stray, "note.md"), "orphan");
  fs.mkdirSync(path.join(tabs, "not-a-tab-id"));
  // A link under a tab-id name, pointing at a folder that must survive.
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-tab-link-"));
  fs.writeFileSync(path.join(target, "keep.md"), "mine");
  let linked = true;
  try {
    fs.symlinkSync(target, path.join(tabs, "123456789abc"), process.platform === "win32" ? "junction" : "dir");
  } catch (e) {
    if (!["EPERM", "EACCES"].includes(e.code)) throw e;
    linked = false;
  }
  try {
    // Any structure change sweeps.
    createTab(folder, "Another");
    assert.equal(fs.existsSync(stray), false, "the stray folder is gone");
    assert.ok(fs.existsSync(path.join(tabs, "not-a-tab-id")), "a name that is no tab id is not ours to remove");
    assert.ok(fs.existsSync(tabDir(folder, keep.id)));
    if (linked) {
      assert.equal(fs.readFileSync(path.join(target, "keep.md"), "utf8"), "mine", "a link's target is never touched");
      assert.ok(fs.lstatSync(path.join(tabs, "123456789abc")).isSymbolicLink() || fs.existsSync(path.join(tabs, "123456789abc")), "the link itself stays");
    } else t.diagnostic("links need extra rights here: the linked half was skipped");
  } finally {
    if (linked) {
      try {
        fs.unlinkSync(path.join(tabs, "123456789abc"));
      } catch {
        fs.rmdirSync(path.join(tabs, "123456789abc"));
      }
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
  // Called directly with an index naming nothing, it empties the tab folders.
  sweepOrphanTabs(notepadFolder(folder), { order: [], last: null, tabs: {} });
  assert.deepEqual(fs.readdirSync(tabs).filter((n) => store.TAB_ID_RE.test(n)), []);
});

test("a damaged tabs.json is set aside and rebuilt from the tab folders, losing no note", () => {
  const folder = freshFolder();
  const a = tabOf(folder, "A");
  saveNote(folder, a, "precious");
  const index = path.join(notepadFolder(folder), "tabs.json");
  fs.writeFileSync(index, "{ not json");
  assert.deepEqual(readNotepad(folder).tabs, [], "a read does not guess");
  saveNote(folder, a, "still here");
  const read = readNotepad(folder);
  assert.equal(read.tabs.length, 1);
  assert.equal(read.tab.id, a);
  assert.equal(read.text, "still here");
  assert.ok(fs.existsSync(index + ".corrupt"));
});

test("Cleanup counts a picture deep in a tab, and a tab change, as the person's edit; a read is not", async () => {
  const q = quietCleanup();
  const folder = freshFolder("aging");
  const a = tabOf(folder, "A");
  tabOf(folder, "B");
  saveNote(folder, a, "old words");
  backdateAll(notepadFolder(folder), 31);
  const listed = async () => (await cleanupFindings(q.opts)).items.some((i) => i.id === "notepad:" + notepadKey(folder));
  assert.equal(await listed(), true, "a month old");
  readNotepad(folder);
  listTabs(folder);
  assert.equal(await listed(), true, "reading changes no file time");
  setLastTab(folder, a); // B was the last created, so A is a real change
  assert.equal(await listed(), false, "choosing a tab is the person's edit");
  backdateAll(notepadFolder(folder), 31);
  assert.equal(await listed(), true);
  addImage(folder, a, JPEG);
  assert.equal(await listed(), false, "a picture two folders down counts");
  q.done();
  removeNotepad(notepadKey(folder));
});

/* --------------------------------------------------------------- migration */

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

// A notepad in its first shape: meta.json v1, note.md and images/ at the top.
function legacyNotepad(folder, { note = "old note\n", withMeta = true } = {}) {
  const dir = notepadFolder(folder);
  fs.mkdirSync(path.join(dir, "images"), { recursive: true });
  if (withMeta) fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify({ v: 1, folder: path.resolve(folder), created: "2026-01-01T00:00:00.000Z" }));
  if (note !== null) fs.writeFileSync(path.join(dir, "note.md"), note);
  fs.writeFileSync(path.join(dir, "images", U1 + ".jpg"), JPEG);
  fs.writeFileSync(path.join(dir, "images", U2 + ".jpg"), JPEG);
  fs.writeFileSync(path.join(dir, "images", U1 + ".thumb.jpg"), JPEG);
  const old = new Date(Date.now() - 40 * DAY_MS);
  fs.utimesSync(path.join(dir, "images", U1 + ".jpg"), old, old);
  return dir;
}

// The files (not folders) under a notepad, relative, sorted.
const filesOf = (dir) =>
  Object.keys(treeOf(dir))
    .filter((k) => !k.endsWith("/"))
    .sort();

const LEG_FILES = [
  "meta.json",
  "tabs.json",
  `tabs/${LEGACY_TAB_ID}/images/${U1}.jpg`,
  `tabs/${LEGACY_TAB_ID}/images/${U1}.thumb.jpg`,
  `tabs/${LEGACY_TAB_ID}/images/${U2}.jpg`,
  `tabs/${LEGACY_TAB_ID}/note.md`,
].sort();

test("the first shape reads as one Notes tab, and the read writes nothing", () => {
  const folder = freshFolder("legacy");
  const dir = legacyNotepad(folder);
  const before = treeOf(dir);
  const read = readNotepad(folder);
  assert.deepEqual(read.tabs, [{ id: LEGACY_TAB_ID, name: "Notes" }]);
  assert.equal(read.last, LEGACY_TAB_ID);
  assert.equal(read.tab.id, LEGACY_TAB_ID);
  assert.equal(read.text, "old note\n");
  assert.equal(read.tab.text, "old note\n");
  assert.deepEqual(
    read.images.map((i) => i.id),
    [U1, U2],
    "oldest first",
  );
  assert.equal(read.images[0].url, `/notepad/images/${LEGACY_TAB_ID}/${U1}.jpg`);
  assert.equal(read.images[0].thumb, `/notepad/images/${LEGACY_TAB_ID}/${U1}.thumb.jpg`);
  assert.equal(read.images[1].thumb, null);
  assert.deepEqual(listTabs(folder), { tabs: [{ id: LEGACY_TAB_ID, name: "Notes" }], last: LEGACY_TAB_ID });
  assert.equal(readNotepad(folder, LEGACY_TAB_ID).text, "old note\n");
  // The pictures are served from where they still are.
  assert.equal(imagePath(folder, LEGACY_TAB_ID, U1, false), fs.realpathSync(path.join(dir, "images", U1 + ".jpg")));
  assert.equal(imagePath(folder, LEGACY_TAB_ID, U1, true), fs.realpathSync(path.join(dir, "images", U1 + ".thumb.jpg")));
  assert.equal(imagePath(folder, "ffffffffffff", U1, false), null);
  assert.deepEqual(treeOf(dir), before, "no file or folder created, changed or aged");
  assert.equal(fs.existsSync(path.join(dir, "tabs.json")), false);
});

test("the first write migrates the first shape into the Notes tab with nothing lost", () => {
  const folder = freshFolder("legacy");
  const dir = legacyNotepad(folder);
  saveNote(folder, LEGACY_TAB_ID, "new text");
  assert.deepEqual(filesOf(dir), LEG_FILES);
  assert.equal(fs.existsSync(path.join(dir, "images")), false, "the top-level images/ is gone");
  assert.equal(fs.existsSync(path.join(dir, "note.md")), false);
  const read = readNotepad(folder);
  assert.equal(read.text, "new text");
  assert.deepEqual(read.images.map((i) => i.id), [U1, U2]);
  assert.equal(read.images[0].thumb !== null, true);
  const index = JSON.parse(fs.readFileSync(path.join(dir, "tabs.json"), "utf8"));
  assert.equal(index.v, 1);
  assert.deepEqual(index.order, [LEGACY_TAB_ID]);
  assert.equal(index.last, LEGACY_TAB_ID);
  assert.equal(index.tabs[LEGACY_TAB_ID].name, "Notes");
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  assert.equal(meta.v, 2);
  assert.equal(meta.created, "2026-01-01T00:00:00.000Z", "meta keeps what it had");
  assert.equal(meta.folder, path.resolve(folder));
  // Run again: another write moves nothing.
  const after = treeOf(dir);
  const noteBefore = fs.readFileSync(path.join(dir, "tabs", LEGACY_TAB_ID, "note.md"), "utf8");
  saveNote(folder, LEGACY_TAB_ID, noteBefore);
  const again = treeOf(dir);
  assert.deepEqual(Object.keys(again), Object.keys(after));
  for (const k of Object.keys(after)) if (!k.endsWith("note.md")) assert.equal(again[k], after[k], k);
});

test("any first write migrates: a picture, a new tab, and an old picture can be deleted afterwards", () => {
  const folder = freshFolder("legacy");
  const dir = legacyNotepad(folder);
  const made = createTab(folder, "Second");
  assert.deepEqual(listTabs(folder).tabs.map((t) => t.name), ["Notes", "Second"]);
  assert.ok(filesOf(dir).includes(`tabs/${LEGACY_TAB_ID}/note.md`));
  removeImage(folder, LEGACY_TAB_ID, U2);
  assert.deepEqual(readNotepad(folder, LEGACY_TAB_ID).images.map((i) => i.id), [U1]);
  assert.equal(readNotepad(folder, made.id).text, "");
  // A picture added to a first-shape notepad lands in the Notes tab.
  const f2 = freshFolder("legacy");
  legacyNotepad(f2);
  const added = addImage(f2, LEGACY_TAB_ID, JPEG);
  assert.equal(added.url, `/notepad/images/${LEGACY_TAB_ID}/${added.id}.jpg`);
  assert.equal(readNotepad(f2).images.length, 3);
  // A first-shape notepad with a picture and no note still migrates.
  const f3 = freshFolder("legacy");
  const d3 = legacyNotepad(f3, { note: null });
  assert.equal(readNotepad(f3).text, "");
  assert.equal(readNotepad(f3).images.length, 2);
  saveNote(f3, LEGACY_TAB_ID, "first words");
  assert.equal(fs.existsSync(path.join(d3, "images")), false);
  assert.equal(readNotepad(f3).images.length, 2);
});

test("a crash at any step of the move is finished by the next write, with no file lost or duplicated", () => {
  const leg = (dir) => path.join(dir, "tabs", LEGACY_TAB_ID);
  const cases = {
    "note moved, pictures not": (dir) => {
      fs.mkdirSync(leg(dir), { recursive: true });
      fs.renameSync(path.join(dir, "note.md"), path.join(leg(dir), "note.md"));
    },
    "pictures moved, note not": (dir) => {
      fs.mkdirSync(leg(dir), { recursive: true });
      fs.renameSync(path.join(dir, "images"), path.join(leg(dir), "images"));
    },
    "pictures half moved": (dir) => {
      fs.mkdirSync(path.join(leg(dir), "images"), { recursive: true });
      fs.renameSync(path.join(dir, "images", U1 + ".jpg"), path.join(leg(dir), "images", U1 + ".jpg"));
      fs.renameSync(path.join(dir, "note.md"), path.join(leg(dir), "note.md"));
    },
    "both moved, no index yet": (dir) => {
      fs.mkdirSync(leg(dir), { recursive: true });
      fs.renameSync(path.join(dir, "note.md"), path.join(leg(dir), "note.md"));
      fs.renameSync(path.join(dir, "images"), path.join(leg(dir), "images"));
    },
  };
  for (const [name, crash] of Object.entries(cases)) {
    const folder = freshFolder("crash");
    const dir = legacyNotepad(folder);
    crash(dir);
    // Read in the middle of the damage: nothing is written, and it still shows what is there.
    const before = treeOf(dir);
    const mid = readNotepad(folder);
    assert.deepEqual(treeOf(dir), before, `${name}: a read writes nothing`);
    assert.deepEqual(mid.tabs, [{ id: LEGACY_TAB_ID, name: "Notes" }], name);
    assert.equal(mid.text, "old note\n", name);
    assert.deepEqual(mid.images.map((i) => i.id).sort(), [U1, U2].sort(), name);
    // Any write finishes the move.
    createTab(folder, "After the crash");
    // The new tab holds only an empty images/ folder, so the files are exactly the first tab's.
    assert.deepEqual(filesOf(dir), LEG_FILES, name);
    assert.equal(fs.existsSync(path.join(dir, "images")), false, name);
    assert.equal(fs.existsSync(path.join(dir, "note.md")), false, name);
    assert.equal(readNotepad(folder, LEGACY_TAB_ID).text, "old note\n", name);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")).v, 2, name);
    assert.deepEqual(listTabs(folder).tabs.map((t) => t.name), ["Notes", "After the crash"], name);
  }
});

test("a fresh notepad is born in the new shape, and an empty leftover images/ of the old one is dropped", () => {
  const folder = freshFolder();
  createTab(folder, "First");
  const dir = notepadFolder(folder);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["meta.json", "tabs", "tabs.json"]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")).v, 2);
  // A first-shape notepad that only ever had an empty images/ folder.
  const empty = freshFolder();
  fs.mkdirSync(path.join(notepadFolder(empty), "images"), { recursive: true });
  fs.writeFileSync(path.join(notepadFolder(empty), "meta.json"), JSON.stringify({ v: 1, folder: path.resolve(empty), created: "2026-01-01T00:00:00.000Z" }));
  assert.deepEqual(readNotepad(empty).tabs, []);
  createTab(empty, "First");
  assert.deepEqual(fs.readdirSync(notepadFolder(empty)).sort(), ["meta.json", "tabs", "tabs.json"]);
});

/* ---------------------------------------------------------------- routes */

const getJson = async (s, pathname) => {
  const res = await fetch(`${s.base}${pathname}`, { headers: { cookie: s.cookie, connection: "close" } });
  return { status: res.status, body: await res.json(), headers: res.headers };
};
const postJpeg = (s, pathname, buf, extra = {}) =>
  fetch(`${s.base}${pathname}`, {
    method: "POST",
    headers: { "content-type": "image/jpeg", cookie: s.cookie, connection: "close", ...extra },
    body: buf,
  });

test("GET /notepad answers an empty notepad, then the saved text", async () => {
  const s = openSession();
  // The session's folder is this repo; start from a clean notepad for it.
  fs.rmSync(NOTEPADS_DIR, { recursive: true, force: true });
  const empty = await getJson(s, "/notepad");
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { tabs: [], last: null, tab: null, text: "", savedAt: null, images: [] });
  const saved = await s.send("/notepad/text", { text: "# Route note" });
  assert.equal(saved.status, 200);
  const body = await saved.json();
  assert.equal(body.ok, true);
  const read = await getJson(s, "/notepad");
  assert.equal(read.body.text, "# Route note");
  assert.equal(read.body.savedAt, body.savedAt);
});

test("POST /notepad/text refuses a non-string, an oversized note and bad JSON", async () => {
  const s = openSession();
  const bad = await s.send("/notepad/text", { text: 7 });
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: "bad" });
  const long = await s.send("/notepad/text", { text: "x".repeat(NOTE_MAX_BYTES + 1) });
  assert.equal(long.status, 413);
  assert.deepEqual(await long.json(), { error: "too-long" });
  const notJson = await fetch(`${s.base}/notepad/text`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
    body: "{nope",
  });
  assert.equal(notJson.status, 400);
});

test("notepad writes need the session cookie and refuse a foreign origin", async () => {
  const s = openSession();
  const noCookie = await fetch(`${s.base}/notepad/text`, {
    method: "POST",
    headers: { "content-type": "application/json", connection: "close" },
    body: JSON.stringify({ text: "x" }),
  });
  assert.equal(noCookie.status, 403);
  const foreign = await fetch(`${s.base}/notepad/text`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: s.cookie, origin: "http://evil.example", connection: "close" },
    body: JSON.stringify({ text: "x" }),
  });
  assert.equal(foreign.status, 403);
  const foreignImage = await postJpeg(s, "/notepad/image", JPEG, { origin: "http://evil.example" });
  assert.equal(foreignImage.status, 403);
  const noCookieRead = await fetch(`${s.base}/notepad`, { headers: { connection: "close" } });
  assert.equal(noCookieRead.status, 403);
});

test("pictures through the routes: upload, thumb, fetch, delete and every refusal", async () => {
  const s = openSession();
  const wrongType = await fetch(`${s.base}/notepad/image`, {
    method: "POST",
    headers: { "content-type": "image/png", cookie: s.cookie, connection: "close" },
    body: JPEG,
  });
  assert.equal(wrongType.status, 415);
  assert.deepEqual(await wrongType.json(), { error: "not-jpeg" });
  const notJpeg = await postJpeg(s, "/notepad/image", Buffer.from("plain text"));
  assert.equal(notJpeg.status, 415);
  const tooLarge = await postJpeg(s, "/notepad/image", Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024)]));
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await tooLarge.json(), { error: "too-large" });

  const up = await postJpeg(s, "/notepad/image", JPEG);
  assert.equal(up.status, 200);
  const { id, url } = await up.json();
  assert.match(id, IMAGE_ID_RE);

  const unknownThumb = await postJpeg(s, "/notepad/thumb?id=00000000-0000-0000-0000-000000000000", JPEG);
  assert.equal(unknownThumb.status, 404);
  assert.deepEqual(await unknownThumb.json(), { error: "not-found" });
  const thumbNotJpeg = await postJpeg(s, `/notepad/thumb?id=${id}`, Buffer.from("png"));
  assert.equal(thumbNotJpeg.status, 415);
  assert.deepEqual(await thumbNotJpeg.json(), { error: "not-jpeg" });
  const thumbTooLarge = await postJpeg(s, `/notepad/thumb?id=${id}`, Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024)]));
  assert.equal(thumbTooLarge.status, 413);
  assert.deepEqual(await thumbTooLarge.json(), { error: "too-large" });
  assert.equal((await postJpeg(s, `/notepad/thumb?id=${id}`, JPEG)).status, 200);

  const img = await fetch(`${s.base}${url}`, { headers: { cookie: s.cookie, connection: "close" } });
  assert.equal(img.status, 200);
  assert.equal(img.headers.get("content-type"), "image/jpeg");
  assert.equal(img.headers.get("cache-control"), "no-store");
  assert.equal(img.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(Buffer.from(await img.arrayBuffer()), JPEG);
  const thumb = await fetch(`${s.base}${url.replace(/.jpg$/, ".thumb.jpg")}`, { headers: { cookie: s.cookie, connection: "close" } });
  assert.equal(thumb.status, 200);

  for (const bad of ["/notepad/images/../meta.json", "/notepad/images/nope.jpg", `/notepad/images/${id}.png`, `/notepad/images/${id}.jpg`, `/notepad/images/ffffffffffff/${id}.jpg`, `${url}x`, "/notepad/images/%2e%2e%2fmeta.json"]) {
    const res = await fetch(`${s.base}${bad}`, { headers: { cookie: s.cookie, connection: "close" } });
    assert.equal(res.status, 404, bad);
  }

  const gone = await s.send("/notepad/image/delete", { id: "00000000-0000-0000-0000-000000000000" });
  assert.equal(gone.status, 404);
  const del = await s.send("/notepad/image/delete", { id });
  assert.equal(del.status, 200);
  const after = await fetch(`${s.base}${url}`, { headers: { cookie: s.cookie, connection: "close" } });
  assert.equal(after.status, 404);
});

test("POST /notepad/image refuses one past the cap with 409", async (t) => {
  const s = openSession();
  // The session runs in this repo, so its notepad is the one for ROOT. Fill it
  // directly (200 round trips would only slow the suite), and empty it after
  // so the tests below start from a notepad with room.
  t.after(() => fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true }));
  assert.equal((await postJpeg(s, "/notepad/image", JPEG)).status, 200);
  const images = path.join(tabDir(ROOT, store.defaultTabId(ROOT)), "images");
  const have = fs.readdirSync(images).filter((n) => !n.endsWith(".thumb.jpg")).length;
  for (let i = have; i < NOTEPAD_MAX_IMAGES; i++) fs.writeFileSync(path.join(images, crypto.randomUUID() + ".jpg"), JPEG);
  const full = await postJpeg(s, "/notepad/image", JPEG);
  assert.equal(full.status, 409);
  assert.deepEqual(await full.json(), { error: "too-many" });
});

test("two folders get two notepads through their own sessions", async (t) => {
  const a = path.join(os.tmpdir(), `p2c-notepad-a-${process.pid}`);
  const b = path.join(os.tmpdir(), `p2c-notepad-b-${process.pid}`);
  for (const d of [a, b]) fs.mkdirSync(d, { recursive: true });
  const { cliIn, payload, BASE, sessionUrl, until } = await import("./web-console-test-helpers.mjs");
  const sids = [];
  // Each server runs in its folder, and Windows will not remove a folder a
  // live process sits in: stop both, and wait until neither answers, before
  // cleaning up (stop returns before the process has gone).
  t.after(async () => {
    for (const [cwd, sid] of sids) cliIn(cwd, ["stop", "--session", sid]);
    const gone = async ({ base }) => {
      try {
        await fetch(`${base}/health`, { signal: AbortSignal.timeout(1000) });
        return false;
      } catch {
        return true;
      }
    };
    for (const [, , s] of sids) await until(() => gone(s), 5000);
    for (const d of [a, b]) fs.rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  });
  const open = (cwd) => {
    const res = cliIn(cwd, ["open", "--file", payload(`np-${path.basename(cwd)}.json`, BASE), "--no-open"]);
    const s = sessionUrl(res.json.url);
    sids.push([cwd, res.json.sid, s]);
    return s;
  };
  const sa = open(a);
  const sb = open(b);
  const save = (s, text) =>
    fetch(`${s.base}/notepad/text`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
      body: JSON.stringify({ text }),
    });
  assert.equal((await save(sa, "from a")).status, 200);
  assert.equal((await save(sb, "from b")).status, 200);
  assert.equal((await getJson(sa, "/notepad")).body.text, "from a");
  assert.equal((await getJson(sb, "/notepad")).body.text, "from b");
  assert.notEqual(notepadFolder(a), notepadFolder(b));
});

test("GET /notepad answers a two-tab notepad, one tab at a time, and refuses an unknown tab", async (t) => {
  const s = openSession();
  t.after(() => fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true }));
  fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true });
  const a = await (await s.send("/notepad/tab", { name: "Ideas" })).json();
  const b = await (await s.send("/notepad/tab", { name: "Chores" })).json();
  assert.equal(a.ok, true);
  assert.match(a.id, store.TAB_ID_RE);
  assert.equal(a.name, "Ideas");
  assert.equal((await s.send(`/notepad/text?tab=${a.id}`, { text: "about ideas" })).status, 200);
  assert.equal((await s.send(`/notepad/text?tab=${b.id}`, { text: "about chores" })).status, 200);
  const dflt = await getJson(s, "/notepad");
  assert.equal(dflt.status, 200);
  assert.deepEqual(dflt.body.tabs, [{ id: a.id, name: "Ideas" }, { id: b.id, name: "Chores" }]);
  assert.equal(dflt.body.last, b.id, "the tab created last");
  assert.equal(dflt.body.tab.id, b.id);
  assert.equal(dflt.body.tab.text, "about chores");
  assert.equal(dflt.body.text, "about chores", "the top-level fields are the open tab's");
  const first = await getJson(s, `/notepad?tab=${a.id}`);
  assert.equal(first.body.tab.text, "about ideas");
  assert.equal(first.body.last, b.id, "reading a tab does not change the last one");
  for (const bad of ["ffffffffffff", "nope", "", "../x"]) {
    const res = await getJson(s, `/notepad?tab=${encodeURIComponent(bad)}`);
    assert.equal(res.status, 404, bad);
    assert.deepEqual(res.body, { error: "no-such-tab" });
  }
});

test("GET /notepad answers a notepad still in the first shape as a Notes tab, and writes nothing", async (t) => {
  const s = openSession();
  t.after(() => fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true }));
  fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true });
  const dir = legacyNotepad(ROOT);
  const before = treeOf(dir);
  const res = await getJson(s, "/notepad");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.tabs, [{ id: LEGACY_TAB_ID, name: "Notes" }]);
  assert.equal(res.body.text, "old note\n");
  assert.equal(res.body.images.length, 2);
  assert.deepEqual(treeOf(dir), before, "the read wrote nothing");
  const img = await fetch(`${s.base}${res.body.images[0].url}`, { headers: { cookie: s.cookie, connection: "close" } });
  assert.equal(img.status, 200, "the picture is served from where it still is");
  // The unchanged page's save, with no tab named, lands in Notes and migrates.
  assert.equal((await s.send("/notepad/text", { text: "page save" })).status, 200);
  assert.deepEqual(filesOf(dir), LEG_FILES);
  assert.equal((await getJson(s, "/notepad")).body.text, "page save");
});

test("the tab routes refuse bad bodies, unknown tabs and every foreign caller", async (t) => {
  const s = openSession();
  t.after(() => fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true }));
  fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true });
  const post = async (route, body) => {
    const res = await s.send(route, body);
    return { status: res.status, body: await res.json() };
  };
  assert.deepEqual(await post("/notepad/tab", { name: 5 }), { status: 400, body: { error: "bad-name" } });
  assert.deepEqual(await post("/notepad/tab", {}), { status: 400, body: { error: "bad-name" } });
  assert.deepEqual(await post("/notepad/tab", { name: "x".repeat(TAB_NAME_MAX + 1) }), { status: 400, body: { error: "bad-name" } });
  assert.equal(fs.existsSync(notepadFolder(ROOT)), false, "refusals created nothing");
  const made = await post("/notepad/tab", { name: "Notes" });
  assert.equal(made.status, 200);
  assert.deepEqual(await post("/notepad/tab", { name: "notes" }), { status: 409, body: { error: "duplicate-name" } });
  const other = (await post("/notepad/tab", { name: "Other" })).body;
  assert.deepEqual(await post("/notepad/tab/rename", { id: made.body.id, name: "other" }), { status: 409, body: { error: "duplicate-name" } });
  assert.deepEqual(await post("/notepad/tab/rename", { id: "ffffffffffff", name: "x" }), { status: 404, body: { error: "no-such-tab" } });
  assert.deepEqual(await post("/notepad/tab/rename", { name: "x" }), { status: 404, body: { error: "no-such-tab" } });
  assert.deepEqual(await post("/notepad/tab/rename", { id: made.body.id, name: "" }), { status: 400, body: { error: "bad-name" } });
  assert.equal((await post("/notepad/tab/rename", { id: made.body.id, name: "Renamed" })).status, 200);
  assert.deepEqual(await post("/notepad/tab/order", { order: [made.body.id] }), { status: 400, body: { error: "bad" } });
  assert.deepEqual(await post("/notepad/tab/order", { order: "no" }), { status: 400, body: { error: "bad" } });
  assert.equal((await post("/notepad/tab/order", { order: [other.id, made.body.id] })).status, 200);
  assert.deepEqual(await post("/notepad/tab/last", { id: "ffffffffffff" }), { status: 404, body: { error: "no-such-tab" } });
  assert.equal((await post("/notepad/tab/last", { id: made.body.id })).status, 200);
  const read = (await getJson(s, "/notepad")).body;
  assert.deepEqual(read.tabs, [{ id: other.id, name: "Other" }, { id: made.body.id, name: "Renamed" }]);
  assert.equal(read.last, made.body.id);
  assert.deepEqual(await post("/notepad/tab/delete", { id: "ffffffffffff" }), { status: 404, body: { error: "no-such-tab" } });
  const notJson = await fetch(`${s.base}/notepad/tab`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: s.cookie, connection: "close" },
    body: "{nope",
  });
  assert.equal(notJson.status, 400);

  // Like every other notepad write: the session cookie, and no foreign origin.
  for (const route of ["/notepad/tab", "/notepad/tab/rename", "/notepad/tab/delete", "/notepad/tab/order", "/notepad/tab/last"]) {
    const body = JSON.stringify({ id: other.id, name: "Z", order: [] });
    const noCookie = await fetch(`${s.base}${route}`, { method: "POST", headers: { "content-type": "application/json", connection: "close" }, body });
    assert.equal(noCookie.status, 403, route + " without the cookie");
    const foreign = await fetch(`${s.base}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie: s.cookie, origin: "http://evil.example", connection: "close" },
      body,
    });
    assert.equal(foreign.status, 403, route + " from a foreign origin");
  }
  assert.equal((await getJson(s, "/notepad")).body.tabs.length, 2, "the refused calls changed nothing");

  const del = await post("/notepad/tab/delete", { id: made.body.id });
  assert.equal(del.status, 200);
  assert.equal(fs.existsSync(tabDir(ROOT, made.body.id)), false);
  assert.equal((await getJson(s, "/notepad")).body.last, other.id);
});

test("pictures through ?tab=: upload, thumb, fetch and delete, each under the tab that holds it", async (t) => {
  const s = openSession();
  t.after(() => fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true }));
  fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true });
  const a = (await (await s.send("/notepad/tab", { name: "A" })).json()).id;
  const b = (await (await s.send("/notepad/tab", { name: "B" })).json()).id;
  const get = (url) => fetch(`${s.base}${url}`, { headers: { cookie: s.cookie, connection: "close" } });
  const up = await postJpeg(s, `/notepad/image?tab=${a}`, JPEG);
  assert.equal(up.status, 200);
  const { id, url } = await up.json();
  assert.equal(url, `/notepad/images/${a}/${id}.jpg`);
  assert.equal((await postJpeg(s, `/notepad/thumb?tab=${a}&id=${id}`, JPEG)).status, 200);
  assert.equal((await get(url)).status, 200);
  assert.equal((await get(`/notepad/images/${a}/${id}.thumb.jpg`)).status, 200);
  // Not under another tab, not in the old shape, not under a tab that is not there.
  assert.equal((await get(`/notepad/images/${b}/${id}.jpg`)).status, 404);
  assert.equal((await get(`/notepad/images/${id}.jpg`)).status, 404);
  assert.equal((await get(`/notepad/images/ffffffffffff/${id}.jpg`)).status, 404);
  assert.deepEqual((await getJson(s, `/notepad?tab=${b}`)).body.images, []);
  assert.equal((await getJson(s, `/notepad?tab=${a}`)).body.images[0].thumb, `/notepad/images/${a}/${id}.thumb.jpg`);
  // A picture or thumb for a tab that is not there, and a delete from the wrong tab.
  const stray = await postJpeg(s, "/notepad/image?tab=ffffffffffff", JPEG);
  assert.equal(stray.status, 404);
  assert.deepEqual(await stray.json(), { error: "no-such-tab" });
  assert.equal((await postJpeg(s, `/notepad/thumb?tab=ffffffffffff&id=${id}`, JPEG)).status, 404);
  assert.equal((await postJpeg(s, `/notepad/image?tab=nope`, JPEG)).status, 404);
  assert.equal((await s.send(`/notepad/image/delete?tab=${b}`, { id })).status, 404, "tab B does not hold it");
  assert.equal((await s.send(`/notepad/image/delete?tab=ffffffffffff`, { id })).status, 404);
  assert.equal((await get(url)).status, 200, "still there");
  assert.equal((await s.send(`/notepad/image/delete?tab=${a}`, { id })).status, 200);
  assert.equal((await get(url)).status, 404);
  // With no tab named, the picture goes to the last tab used.
  const unnamed = await (await postJpeg(s, "/notepad/image", JPEG)).json();
  assert.equal(unnamed.url.split("/")[3], b);
  assert.equal((await s.send("/notepad/image/delete", { id: unnamed.id })).status, 200);
  assert.deepEqual(await (await postJpeg(s, "/notepad/thumb?id=00000000-0000-0000-0000-000000000000", JPEG)).json(), { error: "not-found" });
});

/* -------------------------------------------- never to the agent, Cleanup */

test("nothing in a notepad reaches the session folder or the agent's wait", async () => {
  const s = openSession();
  const marker = `NOTEPAD-MARKER-${process.pid}-${Date.now()}`;
  assert.equal((await s.send("/notepad/text", { text: `secret ${marker}` })).status, 200);
  const picture = Buffer.concat([JPEG, Buffer.from(marker)]);
  assert.equal((await postJpeg(s, "/notepad/image", picture)).status, 200);

  const seen = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else seen.push(p);
    }
  };
  walk(s.session);
  for (const file of seen) {
    assert.ok(!fs.readFileSync(file).includes(marker), `${path.relative(s.session, file)} carries notepad content`);
  }
  assert.equal(fs.existsSync(path.join(s.session, "uploads")) && fs.readdirSync(path.join(s.session, "uploads")).length > 0, false);

  const waited = cli(["wait", "--session", s.sid, "--seconds", "1"]);
  assert.ok(!waited.stdout.includes(marker));
  const status = cli(["status"]);
  assert.ok(!status.stdout.includes(marker));
});

test("Cleanup never lists the notepads folder as a stray, fresh or old", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-notepad-cleanup-"));
  const consoleDir = path.join(root, "console");
  fs.mkdirSync(path.join(consoleDir, "sessions"), { recursive: true });
  const note = path.join(root, "notepads", "proj-0123456789ab", "note.md");
  fs.mkdirSync(path.dirname(note), { recursive: true });
  fs.writeFileSync(note, "x");
  const ids = async (now) => (await cleanupFindings({ consoleDir, plan2codeDir: root, now })).items.map((i) => i.id);
  assert.ok(!(await ids(Date.now())).includes("root:notepads"));
  // Two hours on: past the stray grace, so only the kept list protects it.
  assert.ok(!(await ids(Date.now() + 2 * 60 * 60 * 1000)).includes("root:notepads"));
  // A real stray beside it is still listed, so the scan did run.
  const stray = path.join(root, "leftover.txt");
  fs.writeFileSync(stray, "x");
  assert.ok((await ids(Date.now() + 2 * 60 * 60 * 1000)).includes("root:leftover.txt"));
  fs.rmSync(root, { recursive: true, force: true });
});

// Every file and folder under `dir`, and `dir` itself, moved `days` back.
function backdateAll(dir, days) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) backdateAll(p, days);
    else backdate(p, days);
  }
  backdate(dir, days);
}

// Cleanup's scan with no console or ~/.plan2code strays in the way: only the
// notepads folder (the file's NOTEPADS_DIR) has anything to find.
function quietCleanup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-notepad-stale-"));
  fs.mkdirSync(path.join(root, "console", "sessions"), { recursive: true });
  const opts = { consoleDir: path.join(root, "console"), plan2codeDir: root };
  return { opts, done: () => fs.rmSync(root, { recursive: true, force: true }) };
}

test("Cleanup lists a notepad only once its newest file is a month old, as one item that removes the whole folder", async () => {
  const q = quietCleanup();
  // Old text, but a picture added today: still in use.
  const mixed = freshFolder("mixed");
  const mixedTab = tabOf(mixed);
  saveNote(mixed, mixedTab, "old words");
  backdateAll(notepadFolder(mixed), 31);
  addImage(mixed, mixedTab, JPEG);
  // Every file a month old.
  const old = freshFolder("old");
  const oldTab = tabOf(old);
  saveNote(old, oldTab, "forgotten");
  addImage(old, oldTab, JPEG);
  backdateAll(notepadFolder(old), 31);
  // Written today.
  const fresh = freshFolder("fresh");
  saveNote(fresh, tabOf(fresh), "today");

  const { items } = await cleanupFindings(q.opts);
  const notepads = items.filter((i) => i.where === "notepad");
  assert.deepEqual(
    notepads.map((i) => i.id),
    ["notepad:" + notepadKey(old)],
  );
  assert.equal(notepads[0].name, notepadKey(old));
  assert.equal(notepads[0].kind, "folder");
  assert.equal(notepads[0].folder, path.resolve(old));
  assert.ok(notepads[0].bytes > JPEG.length, "the item counts the whole folder");
  assert.deepEqual(
    staleNotepads(Date.now(), 30 * DAY_MS).map((n) => n.key),
    [notepadKey(old)],
  );

  const done = await removeCleanup(["notepad:" + notepadKey(old), "notepad:" + notepadKey(fresh)], q.opts);
  assert.deepEqual(done.removed, ["notepad:" + notepadKey(old)], "only what the fresh scan still finds is removed");
  assert.equal(fs.existsSync(notepadFolder(old)), false, "the whole folder went");
  assert.equal(readNotepad(fresh).text, "today");
  assert.equal(readNotepad(mixed).images.length, 1);
  q.done();
});

test("a notepad with no meta.json is listed by its key alone", async () => {
  const q = quietCleanup();
  const folder = freshFolder("nometa");
  saveNote(folder, tabOf(folder), "x");
  fs.rmSync(path.join(notepadFolder(folder), "meta.json"));
  backdateAll(notepadFolder(folder), 31);
  const item = (await cleanupFindings(q.opts)).items.find((i) => i.id === "notepad:" + notepadKey(folder));
  assert.ok(item, "still listed");
  assert.equal(item.folder, null);
  removeNotepad(notepadKey(folder));
  q.done();
});

test("removeNotepad refuses a bad key and a linked folder, and staleNotepads skips both", (t) => {
  for (const key of ["", "../proj-0123456789ab", "Proj-0123456789ab", "proj-0123456789a", "proj", "proj-0123456789ab/..", 7, null]) {
    refusal(() => removeNotepad(key), "bad");
  }
  refusal(() => removeNotepad("gone-0123456789ab"), "not-found");

  // A link under a valid key, pointing at a folder that must survive.
  const target = fs.mkdtempSync(path.join(os.tmpdir(), "p2c-notepad-target-"));
  fs.writeFileSync(path.join(target, "keep.md"), "mine");
  backdateAll(target, 60);
  const key = "linked-" + crypto.randomBytes(6).toString("hex");
  const link = path.join(notepadsDir(), key);
  fs.mkdirSync(notepadsDir(), { recursive: true });
  try {
    fs.symlinkSync(target, link, process.platform === "win32" ? "junction" : "dir");
  } catch (e) {
    fs.rmSync(target, { recursive: true, force: true });
    if (["EPERM", "EACCES"].includes(e.code)) return t.skip("links need extra rights here");
    throw e;
  }
  try {
    assert.ok(!staleNotepads(Date.now(), 30 * DAY_MS).some((n) => n.key === key), "a link is never listed");
    refusal(() => removeNotepad(key), "bad");
    assert.equal(fs.readFileSync(path.join(target, "keep.md"), "utf8"), "mine");
  } finally {
    // The link alone: a Windows junction goes with rmdir, a symlink with unlink.
    try {
      fs.unlinkSync(link);
    } catch {
      fs.rmdirSync(link);
    }
    fs.rmSync(target, { recursive: true, force: true });
  }
  // A plain file under a valid key is no notepad either.
  const file = path.join(notepadsDir(), "file-" + crypto.randomBytes(6).toString("hex"));
  fs.writeFileSync(file, "x");
  backdate(file, 60);
  assert.ok(!staleNotepads(Date.now(), 30 * DAY_MS).some((n) => n.path === file));
  refusal(() => removeNotepad(path.basename(file)), "bad");
  fs.rmSync(file);
});

test("the sweeps at open leave a 60-day-old notepad untouched", async () => {
  const folder = freshFolder("sixty");
  const keptTab = tabOf(folder);
  saveNote(folder, keptTab, "kept for months");
  addImage(folder, keptTab, JPEG);
  backdateAll(notepadFolder(folder), 60);
  const noteFile = path.join(tabDir(folder, keptTab), "note.md");
  const before = fs.statSync(noteFile).mtimeMs;
  const s = openSession();
  // The sweeps run after open prints; give them their moment.
  await sleep(500);
  assert.equal(readNotepad(folder).text, "kept for months");
  assert.equal(readNotepad(folder).images.length, 1);
  assert.equal(fs.statSync(noteFile).mtimeMs, before, "not even touched");
  cli(["stop", "--session", s.sid]);
  removeNotepad(notepadKey(folder));
});

/* ------------------------------------------------------------ page rules */

// Drives nextSave() through a list of events from a start state, returning
// every step's status, attempt and timer.
function run(events, from = rules.SAVE_START) {
  let state = from;
  return events.map((event) => {
    const next = rules.nextSave(state, event);
    state = next.state;
    return [state.status, state.attempt, next.timer];
  });
}

test("page rules: the caps equal the server's", () => {
  assert.equal(rules.NOTE_MAX_BYTES, NOTE_MAX_BYTES);
  assert.equal(rules.NOTEPAD_MAX_IMAGES, NOTEPAD_MAX_IMAGES);
  assert.equal(rules.TAB_NAME_MAX, TAB_NAME_MAX);
  assert.equal(rules.NOTEPAD_MAX_TABS, NOTEPAD_MAX_TABS);
  assert.equal(String(rules.TAB_ID_RE), String(store.TAB_ID_RE));
  assert.equal(String(rules.IMAGE_ID_RE), String(IMAGE_ID_RE));
  assert.equal(rules.SAVE_DEBOUNCE_MS, 800);
  assert.deepEqual([...rules.RETRY_STEPS_MS], [1000, 2000, 4000, 8000, 16000, 30000]);
});

test("page rules: noteBytes counts UTF-8 bytes, and a non-string as nothing", () => {
  assert.equal(rules.noteBytes("abc"), 3);
  assert.equal(rules.noteBytes("é"), 2);
  assert.equal(rules.noteBytes("😀"), 4);
  assert.equal(rules.noteBytes(null), 0);
});

test("page rules: typing arms the debounce, then due, sent and ok land saved", () => {
  assert.deepEqual(run([{ type: "typed", bytes: 5 }, "due", "sent", "ok"]), [
    ["pending", 0, rules.SAVE_DEBOUNCE_MS],
    ["saving", 0, null],
    ["saving", 0, null],
    ["saved", 0, null],
  ]);
  // Typing again from saved starts over.
  assert.deepEqual(run([{ type: "typed", bytes: 1 }], { status: "saved", attempt: 0 }), [["pending", 0, rules.SAVE_DEBOUNCE_MS]]);
});

test("page rules: failures back off step by step, hold at the last step, and reset on typed or ok", () => {
  const events = [{ type: "typed", bytes: 1 }, "due"];
  for (let i = 0; i < 8; i++) events.push({ type: "error", code: "bad" }, "retry");
  const steps = run(events).filter(([status]) => status === "failed").map(([, , timer]) => timer);
  assert.deepEqual(steps, [1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  const failed = { status: "failed", attempt: 4 };
  assert.deepEqual(run([{ type: "typed", bytes: 1 }], failed), [["pending", 0, rules.SAVE_DEBOUNCE_MS]]);
  assert.deepEqual(run(["retry", "ok", { type: "error" }], failed), [
    ["saving", 4, null],
    ["saved", 0, null],
    ["failed", 1, 1000],
  ]);
  // A flush (due) on a failed save sends now, keeping the count.
  assert.deepEqual(run(["due"], failed), [["saving", 4, null]]);
});

test("page rules: a note past the cap never sends, and a server too-long stops retrying", () => {
  assert.deepEqual(run([{ type: "typed", bytes: NOTE_MAX_BYTES + 1 }, "due", "retry"]), [
    ["too-long", 0, null],
    ["too-long", 0, null],
    ["too-long", 0, null],
  ]);
  assert.deepEqual(run([{ type: "typed", bytes: NOTE_MAX_BYTES }]), [["pending", 0, rules.SAVE_DEBOUNCE_MS]]);
  assert.deepEqual(run([{ type: "error", code: "too-long" }], { status: "saving", attempt: 2 }), [["too-long", 0, null]]);
  // Typing it back under the cap saves again.
  assert.deepEqual(run([{ type: "typed", bytes: 10 }], { status: "too-long", attempt: 0 }), [["pending", 0, rules.SAVE_DEBOUNCE_MS]]);
});

test("page rules: due and retry do nothing where there is nothing to send, and bad input changes nothing", () => {
  for (const status of ["idle", "saving", "saved", "too-long"]) {
    const state = { status, attempt: 0 };
    assert.equal(rules.nextSave(state, "due").state, state, `due from ${status}`);
    assert.equal(rules.nextSave(state, "due").timer, null);
  }
  for (const status of ["idle", "pending", "saving", "saved", "too-long"]) {
    const state = { status, attempt: 0 };
    assert.equal(rules.nextSave(state, "retry").state, state, `retry from ${status}`);
  }
  const state = { status: "pending", attempt: 0 };
  assert.equal(rules.nextSave(state, "nonsense").state, state);
  assert.equal(rules.nextSave({ status: "weird" }, "typed").state.status, "weird");
  // Never mutates its input.
  const frozen = Object.freeze({ status: "failed", attempt: 1 });
  rules.nextSave(frozen, { type: "error" });
  assert.deepEqual(frozen, { status: "failed", attempt: 1 });
});

test("page rules: saveStatus words and unsaved()", () => {
  const words = {
    idle: "",
    pending: "Saving",
    saving: "Saving",
    saved: "Saved",
    failed: "Not saved (retrying)",
    "too-long": "Too long to save (over 1 MB)",
  };
  for (const [status, text] of Object.entries(words)) {
    assert.equal(rules.saveStatus({ status, attempt: 0 }), text);
    assert.equal(rules.saveStatus(status), text);
  }
  assert.equal(rules.saveStatus(undefined), "");
  assert.deepEqual(
    Object.keys(words).filter((status) => rules.unsaved({ status })),
    ["pending", "saving", "failed"],
  );
});

test("page rules: keepsText holds unsaved and too-long text against a reload", () => {
  const statuses = ["idle", "pending", "saving", "saved", "failed", "too-long"];
  assert.deepEqual(
    statuses.filter((status) => rules.keepsText({ status })),
    ["pending", "saving", "failed", "too-long"],
  );
  assert.match(rules.NOT_LOADED, /^[A-Z].*\.$/);
});

test("page rules: errorSentence covers every server code, and anything else is a lost connection", () => {
  // Every code the store can raise.
  const raised = new Set();
  for (const m of fs.readFileSync(path.join(ROOT, "src", "web-console", "notepads.mjs"), "utf8").matchAll(/new NotepadError\("([a-z-]+)"/g)) raised.add(m[1]);
  // The routes add too-large for an oversized picture.
  raised.add("too-large");
  assert.deepEqual([...raised].sort(), [...rules.ERROR_CODES].sort());
  const lost = rules.errorSentence(null);
  const seen = new Set([lost]);
  for (const code of rules.ERROR_CODES) {
    const sentence = rules.errorSentence(code);
    assert.match(sentence, /^[A-Z].*\.$/, code);
    assert.ok(!seen.has(sentence), `${code} has a sentence of its own`);
    seen.add(sentence);
  }
  assert.equal(rules.errorSentence("teapot"), lost);
  assert.equal(rules.errorSentence(undefined), lost);
  assert.match(rules.errorSentence("too-many"), new RegExp(String(NOTEPAD_MAX_IMAGES)));
});

test("page rules: step wraps at both ends, and an empty list has nowhere to go", () => {
  assert.equal(rules.step(0, 1, 3), 1);
  assert.equal(rules.step(2, 1, 3), 0);
  assert.equal(rules.step(0, -1, 3), 2);
  assert.equal(rules.step(1, -1, 3), 0);
  assert.equal(rules.step(0, 1, 1), 0);
  assert.equal(rules.step(0, 1, 0), -1);
  assert.equal(rules.step(0, -1, 0), -1);
});

test("page rules: cleanTabName trims, collapses and says why it refuses", () => {
  assert.deepEqual(rules.cleanTabName("  Big   ideas \n"), { ok: true, name: "Big ideas" });
  assert.deepEqual(rules.cleanTabName(""), { ok: false, reason: "empty" });
  assert.deepEqual(rules.cleanTabName("   "), { ok: false, reason: "empty" });
  assert.deepEqual(rules.cleanTabName(5), { ok: false, reason: "empty" });
  assert.deepEqual(rules.cleanTabName("x".repeat(TAB_NAME_MAX)), { ok: true, name: "x".repeat(TAB_NAME_MAX) });
  assert.deepEqual(rules.cleanTabName("x".repeat(TAB_NAME_MAX + 1)), { ok: false, reason: "too-long" });
  // Code points, not UTF-16 units: forty emoji fit.
  assert.equal(rules.cleanTabName("😀".repeat(TAB_NAME_MAX)).ok, true);
  assert.deepEqual(rules.cleanTabName("a\u0001b"), { ok: false, reason: "control" });
  assert.deepEqual(rules.cleanTabName("a\u007fb"), { ok: false, reason: "control" });
  // Whatever the page accepts, the store accepts as the same name.
  for (const name of ["  a  b ", "Notes", "😀 ideas"]) assert.equal(rules.cleanTabName(name).name, store.normalizeTabName(name));
});

test("page rules: nameTaken ignores case, whitespace and the tab's own name", () => {
  const tabs = [
    { id: "a", name: "Notes" },
    { id: "b", name: "To do" },
  ];
  assert.equal(rules.nameTaken(tabs, "notes"), true);
  assert.equal(rules.nameTaken(tabs, "  TO   DO "), true);
  assert.equal(rules.nameTaken(tabs, "Ideas"), false);
  assert.equal(rules.nameTaken(tabs, "notes", "a"), false, "its own name is not a duplicate");
  assert.equal(rules.nameTaken(tabs, "notes", "b"), true);
  assert.equal(rules.nameTaken(tabs, ""), false, "an unusable name is not a duplicate, it has its own sentence");
  assert.equal(rules.nameTaken(null, "x"), false);
});

test("page rules: tabNameProblem gives one plain sentence, or nothing", () => {
  const tabs = [{ id: "a", name: "Notes" }];
  assert.equal(rules.tabNameProblem(tabs, "Ideas"), "");
  assert.equal(rules.tabNameProblem(tabs, "notes", "a"), "");
  const seen = new Set();
  for (const bad of ["", "x".repeat(TAB_NAME_MAX + 1), "a\u0001", "NOTES"]) {
    const sentence = rules.tabNameProblem(tabs, bad);
    assert.match(sentence, /^[A-Z].*\.$/, JSON.stringify(bad));
    assert.ok(!seen.has(sentence), "each problem has its own sentence");
    seen.add(sentence);
  }
  assert.equal(rules.tabNameProblem(tabs, "NOTES"), rules.errorSentence("duplicate-name"));
});

test("page rules: moveTab clamps at both ends, never wraps and never mutates", () => {
  const order = Object.freeze(["a", "b", "c"]);
  assert.deepEqual(rules.moveTab(order, "b", 1), ["a", "c", "b"]);
  assert.deepEqual(rules.moveTab(order, "b", -1), ["b", "a", "c"]);
  assert.deepEqual(rules.moveTab(order, "a", -1), ["a", "b", "c"], "first stays first");
  assert.deepEqual(rules.moveTab(order, "c", 1), ["a", "b", "c"], "last stays last");
  assert.deepEqual(rules.moveTab(order, "a", 5), ["b", "c", "a"], "a long move clamps to the end");
  assert.deepEqual(rules.moveTab(order, "zzz", 1), ["a", "b", "c"], "an unknown id changes nothing");
  assert.deepEqual(rules.moveTab(order, "a", 0.5), ["a", "b", "c"]);
  assert.notEqual(rules.moveTab(order, "zzz", 1), order, "a new array even when unchanged");
  assert.deepEqual(rules.moveTab(null, "a", 1), []);
});

test("page rules: dropTab puts a tab just before another, or at the end", () => {
  const order = Object.freeze(["a", "b", "c", "d"]);
  assert.deepEqual(rules.dropTab(order, "d", "b"), ["a", "d", "b", "c"]);
  assert.deepEqual(rules.dropTab(order, "a", "d"), ["b", "c", "a", "d"]);
  assert.deepEqual(rules.dropTab(order, "a", null), ["b", "c", "d", "a"]);
  assert.deepEqual(rules.dropTab(order, "b", "c"), ["a", "b", "c", "d"], "just before the next one is where it is");
  assert.deepEqual(rules.dropTab(order, "b", "b"), ["a", "b", "c", "d"], "a drop on itself changes nothing");
  assert.deepEqual(rules.dropTab(order, "zzz", "a"), ["a", "b", "c", "d"]);
  assert.deepEqual(rules.dropTab(order, "a", "zzz"), ["b", "c", "d", "a"], "an unknown target means the end");
});

test("page rules: the tab codes have sentences of their own", () => {
  for (const code of ["bad-name", "duplicate-name", "too-many-tabs", "no-such-tab"]) assert.ok(rules.ERROR_CODES.includes(code), code);
  assert.equal(rules.errorSentence("duplicate-name"), "There is already a tab with that name.");
  assert.equal(rules.errorSentence("no-such-tab"), "That tab is no longer in this notepad.");
  assert.match(rules.errorSentence("too-many-tabs"), new RegExp(String(NOTEPAD_MAX_TABS)));
});

test("page rules: tabSwitch asks for a save only while text may be lost", () => {
  const statuses = ["idle", "pending", "saving", "saved", "failed", "too-long"];
  assert.deepEqual(
    statuses.filter((status) => rules.tabSwitch({ status })),
    ["pending", "saving", "failed", "too-long"],
  );
});

test("page rules: nextDelete takes two confirms and any cancel backs out", () => {
  assert.equal(rules.nextDelete("none", "click"), "ask");
  assert.equal(rules.nextDelete("ask", "confirm"), "sure");
  assert.equal(rules.nextDelete("sure", "confirm"), "done");
  for (const stage of ["ask", "sure"]) {
    assert.equal(rules.nextDelete(stage, "cancel"), "none");
    assert.equal(rules.nextDelete(stage, "escape"), "none");
  }
  // One confirm never deletes, and a stray event moves nothing.
  assert.equal(rules.nextDelete("none", "confirm"), "none");
  assert.equal(rules.nextDelete("ask", "click"), "ask");
  assert.equal(rules.nextDelete("sure", "nonsense"), "sure");
  assert.deepEqual(Object.values(rules.DELETE_STAGES), ["none", "ask", "sure"]);
});
