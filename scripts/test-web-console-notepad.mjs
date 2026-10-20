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
  NOTEPAD_MAX_IMAGES,
  addImage,
  addThumb,
  imagePath,
  notepadFolder,
  notepadKey,
  notepadsDir,
  readNotepad,
  removeImage,
  removeNotepad,
  saveNote,
  staleNotepads,
} = store;

const FOLD_CASE = process.platform === "win32" || process.platform === "darwin";
let folders = 0;
// A project folder of its own per test, so no two tests share a notepad.
const freshFolder = (name = "proj") => path.join(HOME, "projects", `${name}-${++folders}`);
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
  assert.deepEqual(readNotepad(folder), { text: "", savedAt: null, images: [] });
  assert.equal(fs.existsSync(notepadFolder(folder)), false);
});

test("saveNote round-trips text atomically, with meta.json written once", () => {
  const folder = freshFolder();
  const { savedAt } = saveNote(folder, "# Ideas\n\n- one ✓\n");
  assert.ok(!Number.isNaN(Date.parse(savedAt)));
  const read = readNotepad(folder);
  assert.equal(read.text, "# Ideas\n\n- one ✓\n");
  assert.equal(read.savedAt, savedAt);
  const dir = notepadFolder(folder);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8"));
  assert.equal(meta.v, 1);
  assert.equal(meta.folder, path.resolve(folder));
  saveNote(folder, "second");
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, "meta.json"), "utf8")), meta);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["images", "meta.json", "note.md"]);
});

test("saveNote refuses a non-string and a note one byte over the cap", () => {
  const folder = freshFolder();
  refusal(() => saveNote(folder, 5), "bad");
  refusal(() => saveNote(folder, null), "bad");
  refusal(() => saveNote(folder, "x".repeat(NOTE_MAX_BYTES + 1)), "too-long");
  // Bytes, not characters: a multi-byte character counts for its bytes.
  refusal(() => saveNote(folder, "é".repeat(NOTE_MAX_BYTES / 2 + 1)), "too-long");
  assert.ok(saveNote(folder, "x".repeat(NOTE_MAX_BYTES)).savedAt);
});

test("reading a notepad leaves every file time alone", () => {
  const folder = freshFolder();
  saveNote(folder, "text");
  const { id } = addImage(folder, JPEG);
  const dir = notepadFolder(folder);
  const files = [path.join(dir, "note.md"), path.join(dir, "meta.json"), path.join(dir, "images", id + ".jpg")];
  const old = new Date(Date.now() - 40 * DAY_MS);
  for (const f of files) fs.utimesSync(f, old, old);
  readNotepad(folder);
  imagePath(folder, id, false);
  for (const f of files) assert.equal(Math.round(fs.statSync(f).mtimeMs), old.getTime(), f);
});

test("pictures: JPEG only, listed oldest first, with thumbnails when sent", () => {
  const folder = freshFolder();
  refusal(() => addImage(folder, Buffer.from("not a jpeg")), "not-jpeg");
  refusal(() => addImage(folder, "string"), "not-jpeg");
  const first = addImage(folder, JPEG);
  const second = addImage(folder, JPEG);
  assert.match(first.id, IMAGE_ID_RE);
  assert.equal(first.url, `/notepad/images/${first.id}.jpg`);
  const dir = notepadFolder(folder);
  // Make the order unambiguous: the first is older.
  const older = new Date(Date.now() - 60_000);
  fs.utimesSync(path.join(dir, "images", first.id + ".jpg"), older, older);
  addThumb(folder, second.id, JPEG);
  assert.deepEqual(readNotepad(folder).images, [
    { id: first.id, url: first.url, thumb: null },
    { id: second.id, url: second.url, thumb: `/notepad/images/${second.id}.thumb.jpg` },
  ]);
});

test("addThumb and removeImage refuse bad and unknown ids", () => {
  const folder = freshFolder();
  const { id } = addImage(folder, JPEG);
  for (const bad of ["../x", "", null, 7, "00000000-0000-0000-0000-000000000000"]) {
    refusal(() => addThumb(folder, bad, JPEG), "not-found");
    refusal(() => removeImage(folder, bad), "not-found");
  }
  refusal(() => addThumb(folder, id, Buffer.from("png")), "not-jpeg");
  addThumb(folder, id, JPEG);
  removeImage(folder, id);
  assert.deepEqual(readNotepad(folder).images, []);
  assert.deepEqual(fs.readdirSync(path.join(notepadFolder(folder), "images")), []);
});

test("a refused delete or thumb on a folder with no notepad creates nothing", () => {
  const folder = freshFolder();
  refusal(() => removeImage(folder, "00000000-0000-0000-0000-000000000000"), "not-found");
  refusal(() => addThumb(folder, "00000000-0000-0000-0000-000000000000", JPEG), "not-found");
  assert.equal(fs.existsSync(notepadFolder(folder)), false);
});

test("a thumbnail replaced again leaves the newest bytes and no temp file", () => {
  const folder = freshFolder();
  const { id } = addImage(folder, JPEG);
  addThumb(folder, id, JPEG);
  const second = Buffer.concat([JPEG, Buffer.from("second")]);
  addThumb(folder, id, second);
  const images = path.join(notepadFolder(folder), "images");
  assert.deepEqual(fs.readFileSync(path.join(images, id + ".thumb.jpg")), second);
  assert.deepEqual(fs.readdirSync(images).filter((n) => n.endsWith(".tmp")), []);
});

test("the image cap refuses one past NOTEPAD_MAX_IMAGES", () => {
  const folder = freshFolder();
  const images = path.join(notepadFolder(folder), "images");
  addImage(folder, JPEG);
  // Fill the rest directly: 200 real round trips would only slow the suite.
  for (let i = 1; i < NOTEPAD_MAX_IMAGES; i++) fs.writeFileSync(path.join(images, crypto.randomUUID() + ".jpg"), JPEG);
  refusal(() => addImage(folder, JPEG), "too-many");
});

test("imagePath refuses anything but this notepad's own regular files", (t) => {
  const folder = freshFolder();
  const { id } = addImage(folder, JPEG);
  assert.equal(imagePath(folder, id, false), fs.realpathSync(path.join(notepadFolder(folder), "images", id + ".jpg")));
  assert.equal(imagePath(folder, id, true), null, "no thumb yet");
  assert.equal(imagePath(folder, "../meta", false), null);
  assert.equal(imagePath(folder, "00000000-0000-0000-0000-000000000000", false), null);
  // A planted link is refused even under a valid name.
  const outside = path.join(HOME, "outside.jpg");
  fs.writeFileSync(outside, JPEG);
  const linkId = crypto.randomUUID();
  try {
    fs.symlinkSync(outside, path.join(notepadFolder(folder), "images", linkId + ".jpg"));
  } catch (e) {
    if (["EPERM", "EACCES"].includes(e.code)) return t.skip("symlinks need extra rights here");
    throw e;
  }
  assert.equal(imagePath(folder, linkId, false), null);
});

test("no lock or temp file is left behind after writes", () => {
  const folder = freshFolder();
  saveNote(folder, "a");
  const { id } = addImage(folder, JPEG);
  addThumb(folder, id, JPEG);
  addThumb(folder, id, JPEG);
  const dir = notepadFolder(folder);
  const all = [...fs.readdirSync(dir), ...fs.readdirSync(path.join(dir, "images"))];
  assert.equal(all.filter((n) => n.endsWith(".lock") || n.endsWith(".tmp")).length, 0, all.join(", "));
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
  assert.deepEqual(empty.body, { text: "", savedAt: null, images: [] });
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
  const thumb = await fetch(`${s.base}/notepad/images/${id}.thumb.jpg`, { headers: { cookie: s.cookie, connection: "close" } });
  assert.equal(thumb.status, 200);

  for (const bad of ["/notepad/images/../meta.json", "/notepad/images/nope.jpg", `/notepad/images/${id}.png`, "/notepad/images/%2e%2e%2fmeta.json"]) {
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
  const images = path.join(notepadFolder(ROOT), "images");
  t.after(() => fs.rmSync(notepadFolder(ROOT), { recursive: true, force: true }));
  assert.equal((await postJpeg(s, "/notepad/image", JPEG)).status, 200);
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
  saveNote(mixed, "old words");
  backdateAll(notepadFolder(mixed), 31);
  addImage(mixed, JPEG);
  // Every file a month old.
  const old = freshFolder("old");
  saveNote(old, "forgotten");
  addImage(old, JPEG);
  backdateAll(notepadFolder(old), 31);
  // Written today.
  const fresh = freshFolder("fresh");
  saveNote(fresh, "today");

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
  saveNote(folder, "x");
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
  saveNote(folder, "kept for months");
  addImage(folder, JPEG);
  backdateAll(notepadFolder(folder), 60);
  const before = fs.statSync(path.join(notepadFolder(folder), "note.md")).mtimeMs;
  const s = openSession();
  // The sweeps run after open prints; give them their moment.
  await sleep(500);
  assert.equal(readNotepad(folder).text, "kept for months");
  assert.equal(readNotepad(folder).images.length, 1);
  assert.equal(fs.statSync(path.join(notepadFolder(folder), "note.md")).mtimeMs, before, "not even touched");
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

test("page rules: withoutStyleAttrs moves a link's anchor name to data-anchor and drops any other style", () => {
  assert.equal(
    rules.withoutStyleAttrs('<div><a href="x" style="anchor-name: --link-3"><span class="syntax-marker">[</span>a</a></div>'),
    '<div><a href="x" data-anchor="--link-3"><span class="syntax-marker">[</span>a</a></div>',
  );
  assert.equal(rules.withoutStyleAttrs('<span style="display: flex; gap: 6px;"><svg style="flex-shrink: 0;"></svg></span>'), "<span><svg></svg></span>");
  // Typed text reaches it with its quotes escaped, so it is never touched.
  const typed = "<div>&lt;b style=&quot;color: red&quot;&gt;</div>";
  assert.equal(rules.withoutStyleAttrs(typed), typed);
});

test("page rules: topLevelParts cuts the HTML into its top-level elements, or says it cannot", () => {
  const parts = ["<div><h1><span class=\"syntax-marker\"># </span>Hi</h1></div>", "<ul><li class=\"bullet-list\">a</li><li class=\"bullet-list\">b</li></ul>", "<div>&nbsp;</div>", "<div>a<br>b<img src=\"x\"></div>", "<div><span/></div>"];
  assert.deepEqual(rules.topLevelParts(parts.join("")), parts);
  assert.deepEqual(rules.topLevelParts(""), []);
  assert.equal(rules.topLevelParts("<div>open"), null, "unbalanced");
  assert.equal(rules.topLevelParts("<div>a</div></div>"), null, "closes more than it opens");
  assert.equal(rules.topLevelParts("text<div>a</div>"), null, "text at the top level");
  assert.equal(rules.topLevelParts("<div>a</div>trailing"), null);
});

test("page rules: changedRange finds the unchanged head and tail, never overlapping", () => {
  assert.deepEqual(rules.changedRange(["a", "b", "c"], ["a", "x", "c"]), { head: 1, tail: 1 });
  assert.deepEqual(rules.changedRange(["a", "b", "c"], ["a", "b", "c"]), { head: 3, tail: 0 });
  assert.deepEqual(rules.changedRange(["a", "b"], ["a", "b", "b"]), { head: 2, tail: 0 });
  assert.deepEqual(rules.changedRange(["a", "a"], ["a"]), { head: 1, tail: 0 });
  assert.deepEqual(rules.changedRange([], ["a"]), { head: 0, tail: 0 });
  assert.deepEqual(rules.changedRange(["x", "a", "b"], ["a", "b"]), { head: 0, tail: 2 });
});
