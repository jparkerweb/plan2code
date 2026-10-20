// Plan2Code Web Console - the Notebook: the top bar's icon, its dialog, the tabs, the editor and autosave.
//
// The person's own notes for the folder this session runs in, kept by the
// server under ~/.plan2code/notepads/ through the /notepad routes, never in
// the session, so nothing typed here reaches the agent. A notepad is a row of
// tabs, each its own note with its own pictures; one tab is on screen. The
// editor is CodeMirror (notepad-editor.js), loaded the first time the Notebook
// opens. When to save, what the status line says, the tab name rules and the
// order moves are notepad.js's pure rules; the bar itself is notepad-tabs.js;
// this file runs the timers and requests, and binds every save and every
// picture to the tab it was made in, so a switch can never move either.

import { page } from "../state.js";
import {
  EDITOR_NOT_LOADED,
  IMAGE_ID_RE,
  NOTEPAD_MAX_IMAGES,
  NOT_LOADED,
  SAVE_START,
  TAB_ID_RE,
  cleanTabName,
  errorSentence,
  keepsText,
  nextDelete,
  nextSave,
  noteBytes,
  saveStatus,
  step,
  tabNameProblem,
  tabSwitch,
  unsaved,
} from "../notepad.js";
import { el, lightDismiss } from "../render.js";
import { postJson } from "../net.js";
import { reencode } from "../uploads.js";
import { createTabs } from "../notepad-tabs.js";

const $ = (id) => document.getElementById(id);

const NOT_CONNECTED = "Not connected right now.";
const STAY = "Not saved yet, so staying on this tab.";

// One editor for the page's life, made on first open, and the tab bar, made
// when the page is wired.
let editor = null;
let tabBar = null;

// The page's view of the notepad: the tabs in order, and the one on screen
// (null when there are none).
let tabs = [];
let activeId = null;

// The save state (notepad.js), the one timer it arms, and the request in
// flight. `rev` counts changes, so an answer to an older text never marks a
// newer one saved. `saveTab` is the tab the unsaved text belongs to, fixed
// when the change is made, never read when it is sent.
let save = SAVE_START;
let timer = null;
let sending = false;
let rev = 0;
let problem = "";
let saveTab = null;

// True while the page itself sets the editor's text: the editor may report
// that as a change, and it is not the person typing.
let loading = false;

// Whether a note has been read into the editor yet. Until it has, the editor
// is read-only: text typed into the empty editor would be saved over the real
// note.
let loaded = false;

// While a create, a rename or a delete is out, the controls do nothing.
let busy = false;

// What the one name form is open for ("new" or "rename"), or null; and the
// two-confirm delete's stage ("none", "ask" or "sure": notepad.js nextDelete).
let naming = null;
let stage = "none";

// Drawn from the render pass beside Stop: always shown, unusable while the
// server is gone (nothing could load or save).
export function renderNotepadButton() {
  const btn = $("btn-notepad");
  btn.disabled = Boolean(page.gone);
  btn.title = page.gone ? NOT_CONNECTED : "Notebook";
}

// The last thing a picture went wrong with, said after the save words until
// the next batch of pictures starts or the notepad is opened again; and the
// picture it was about, if one, whose Retry landing clears it. `info` is a
// plain announcement (a tab moved), not styled as a problem.
let notice = "";
let noticeKey = null;
let info = "";

function paintStatus() {
  const line = $("notepad-status");
  const words = saveStatus(save);
  const failed = save.status === "failed" || save.status === "too-long";
  const saving = save.status === "failed" && problem ? `${words}. ${problem}` : words;
  line.textContent = [saving, notice, info].filter(Boolean).join(" ");
  line.classList.toggle("is-problem", failed || Boolean(notice));
}

function tell(sentence, key = null) {
  notice = sentence;
  noticeKey = key;
  paintStatus();
}

function inform(sentence) {
  info = sentence;
  paintStatus();
}

function arm(ms) {
  clearTimeout(timer);
  timer = ms == null ? null : setTimeout(() => dispatch(save.status === "failed" ? "retry" : "due"), ms);
}

function dispatch(event) {
  const next = nextSave(save, event);
  save = next.state;
  arm(next.timer);
  paintStatus();
  if (save.status === "saving") send();
  check();
}

// Everyone waiting for the text to reach the disk before the tab changes.
const waiters = [];

// Resolves the waiters once nothing is pending or out: true when the text is
// safe (saved, or nothing to save), false when a save failed or cannot be made.
function check() {
  if (!waiters.length) return;
  if (save.status === "pending") return dispatch("due");
  if (sending || save.status === "saving") return;
  const ok = !keepsText(save);
  for (const resolve of waiters.splice(0)) resolve(ok);
}

// Save the tab on screen now; whether its text is on disk.
function settled() {
  if (!tabSwitch(save)) return Promise.resolve(true);
  return new Promise((resolve) => {
    waiters.push(resolve);
    flush();
    check();
  });
}

// One save at a time. A save that comes due while another is out goes as
// soon as that one answers.
async function send() {
  if (sending || !editor || !saveTab) return;
  sending = true;
  const sent = rev;
  const tab = saveTab;
  const res = await postJson("/notepad/text?tab=" + tab, { text: editor.getValue() });
  sending = false;
  // The tab was deleted or left behind while this was out: nothing in the
  // answer applies to what is on screen now.
  if (tab !== saveTab) return check();
  if (rev !== sent) {
    // Typed while it was out: the newer text has its own debounce running, or
    // is already due and waiting for this request to finish.
    if (save.status === "saving") send();
    return check();
  }
  if (res.status === 200) {
    problem = "";
    return dispatch("ok");
  }
  const code = res.body && res.body.error;
  if (code === "no-such-tab") return gone(tab);
  problem = errorSentence(res.status === 0 ? null : code);
  dispatch({ type: "error", code });
}

function changed(text) {
  if (loading || !activeId) return;
  rev += 1;
  saveTab = activeId;
  dispatch({ type: "typed", bytes: noteBytes(text) });
}

// Save now rather than after the debounce: closing, the tab going hidden.
function flush() {
  if (save.status === "pending" || save.status === "failed") dispatch("due");
}

// Forget the text on screen without saving it: the tab it belongs to is gone.
function discard() {
  clearTimeout(timer);
  timer = null;
  save = SAVE_START;
  saveTab = null;
  problem = "";
  rev += 1;
  paintStatus();
  check();
}

function setText(text) {
  loading = true;
  try {
    editor.setValue(text);
  } finally {
    loading = false;
  }
}

async function makeEditor() {
  const { makeCodeMirrorEditor } = await import("../notepad-editor.js");
  // The editor may report its first, empty value as a change: not the person
  // typing, and saved it would wipe the note.
  loading = true;
  try {
    editor = makeCodeMirrorEditor($("notepad-editor"), { onChange: changed, label: "Notebook text" });
  } finally {
    loading = false;
  }
}

// One read of the notepad: `{ ok: true, body }`, or `{ ok: false, code }`
// with the server's refusal (`no-such-tab`), or code null when it could not
// be reached or answered oddly.
async function readNote(tab) {
  try {
    const res = await fetch("/notepad" + (tab ? "?tab=" + encodeURIComponent(tab) : ""), { cache: "no-store" });
    let body = null;
    try {
      body = await res.json();
    } catch {}
    if (!res.ok) return { ok: false, code: body && typeof body.error === "string" ? body.error : null };
    return body && Array.isArray(body.tabs) ? { ok: true, body } : { ok: false, code: null };
  } catch {
    return { ok: false, code: null };
  }
}

/* ------------------------------------------------------------ tabs */

const nameOf = (id) => (tabs.find((t) => t.id === id) || {}).name || "";

function drawTabs() {
  tabBar.draw(tabs, activeId);
  $("notepad-tab-new").disabled = busy;
  $("notepad-empty-new").disabled = busy;
  $("notepad-name-save").disabled = busy;
}

// Put a read tab on screen: its text, its pictures, the bar. `keep` leaves
// the text and the tab alone (the notepad was only reopened while text was
// still unsaved), taking the bar and the pictures from the server.
function show(body, keep = false) {
  tabs = body.tabs.map((t) => ({ id: t.id, name: t.name }));
  const tab = body.tab;
  if (keep) {
    takeStored(tab && tab.id === activeId ? tab.images : [], activeId);
    return drawTabs();
  }
  activeId = tab ? tab.id : null;
  setText(tab ? tab.text : "");
  save = SAVE_START;
  saveTab = null;
  problem = "";
  rev += 1;
  loaded = true;
  editor.setReadOnly(!tab);
  takeStored(tab ? tab.images : [], activeId);
  drawTabs();
  paintStatus();
}

// Put the tab `id` (the server's pick when null) on screen, after the one
// before it was saved; whether it is there now.
async function showTab(id, remember = true) {
  const mark = rev;
  let res = await readNote(id);
  if (!res.ok && res.code === "no-such-tab" && id) {
    // Gone since the bar was drawn: say so, and show what is there.
    tell(errorSentence("no-such-tab"));
    res = await readNote(null);
  }
  if (!res.ok) {
    tell(res.code ? errorSentence(res.code) : NOT_LOADED);
    return false;
  }
  // Typed while the tab was loading: that text is not saved yet, so stay.
  if (activeId && rev !== mark && tabSwitch(save)) {
    tell(STAY);
    return false;
  }
  show(res.body);
  if (remember && activeId) postJson("/notepad/tab/last", { id: activeId });
  return true;
}

async function switchTo(id) {
  if (id === activeId || busy) return;
  // The name form and the delete question belong to the tab they were opened on.
  closeNameForm(false);
  closeDelete();
  if (!(await settled())) {
    tell(STAY);
    return tabBar.focusTab(activeId);
  }
  tell("");
  inform("");
  if (await showTab(id)) tabBar.focusTab(activeId);
}

async function reorder(order, focus) {
  const before = tabs;
  const byId = new Map(tabs.map((t) => [t.id, t]));
  tabs = order.map((id) => byId.get(id)).filter(Boolean);
  drawTabs();
  tabBar.focusTab(focus);
  const at = order.indexOf(focus);
  if (at >= 0) inform(`Moved ${nameOf(focus)} to position ${at + 1} of ${order.length}`);
  const res = await postJson("/notepad/tab/order", { order });
  if (res.status === 200) return;
  // Refused: draw what the server has, and say why.
  tabs = before;
  inform("");
  tell(errorSentence(res.status === 0 ? null : res.body && res.body.error));
  const again = await readNote(activeId);
  if (again.ok) tabs = again.body.tabs.map((t) => ({ id: t.id, name: t.name }));
  drawTabs();
}

// A tab is no longer there (deleted here, or from another page): off the bar,
// its unsaved text dropped without a save, and its neighbour on screen.
async function gone(id, index = tabs.findIndex((t) => t.id === id), announce = true) {
  const here = id === activeId;
  if (here || id === saveTab) discard();
  const rest = tabs.filter((t) => t.id !== id);
  const next = here ? rest[index] || rest[index - 1] || null : null;
  tabs = rest;
  if (announce) tell(errorSentence("no-such-tab"));
  if (!here) return drawTabs();
  activeId = null;
  images = [];
  pending.clear();
  drawStrip();
  // Nothing of the deleted tab stays on screen or editable, whatever loads next.
  setText("");
  editor.setReadOnly(true);
  if (next) {
    drawTabs();
    if (await showTab(next.id)) tabBar.focusTab(activeId);
    return;
  }
  drawTabs();
  $("notepad-empty-new").focus();
}

/* ------------------------------------------------------------ name form */

function nameError(sentence) {
  $("notepad-name-error").textContent = sentence;
  $("notepad-name").focus();
}

function openNameForm(mode) {
  if (busy || (mode === "rename" && !activeId)) return;
  closeDelete();
  naming = mode;
  $("notepad-name-label").textContent = mode === "new" ? "Name this tab" : "Rename this tab";
  $("notepad-name-error").textContent = "";
  if (!$("notepad-name-dlg").open) $("notepad-name-dlg").showModal();
  const input = $("notepad-name");
  input.value = mode === "rename" ? nameOf(activeId) : "";
  input.focus();
  input.select();
}

function closeNameForm(toFocus = true) {
  if (!naming) return;
  const was = naming;
  naming = null;
  $("notepad-name-dlg").close();
  if (!toFocus) return;
  if (was === "rename") tabBar.focusTab(activeId);
  else (tabs.length ? $("notepad-tab-new") : $("notepad-empty-new")).focus();
}

async function createNamed(name) {
  // The tab on screen is saved first, then the new one is made and shown.
  if (!(await settled())) return nameError(STAY);
  const res = await postJson("/notepad/tab", { name });
  const id = res.body && res.body.id;
  if (res.status !== 200 || !TAB_ID_RE.test(String(id))) {
    return nameError(errorSentence(res.status === 0 ? null : res.body && res.body.error));
  }
  closeNameForm(false);
  busy = false;
  tell("");
  inform("");
  if (await showTab(id, false)) tabBar.focusTab(activeId);
}

async function renameTo(name) {
  const id = activeId;
  const res = await postJson("/notepad/tab/rename", { id, name });
  if (res.status !== 200) {
    const code = res.status === 0 ? null : res.body && res.body.error;
    if (code !== "no-such-tab") return nameError(errorSentence(code));
    closeNameForm(false);
    return gone(id);
  }
  const kept = tabs.find((t) => t.id === id);
  if (kept) kept.name = (res.body && typeof res.body.name === "string" && res.body.name) || name;
  closeNameForm(false);
  busy = false;
  drawTabs();
  tabBar.focusTab(id);
}

async function submitName() {
  if (!naming || busy) return;
  const mode = naming;
  const raw = $("notepad-name").value;
  const sentence = tabNameProblem(tabs, raw, mode === "rename" ? activeId : undefined);
  if (sentence) return nameError(sentence);
  busy = true;
  drawTabs();
  try {
    await (mode === "new" ? createNamed(cleanTabName(raw).name) : renameTo(cleanTabName(raw).name));
  } finally {
    busy = false;
    drawTabs();
  }
}

/* ------------------------------------------------------------ delete */

function paintDelete() {
  const dlg = $("notepad-delete");
  if (stage === "none") return void (dlg.open && dlg.close());
  if (!dlg.open) dlg.showModal();
  const name = nameOf(activeId);
  const count = images.filter((img) => img.id).length;
  const pics = count === 1 ? "1 picture" : `${count} pictures`;
  $("notepad-delete-text").textContent =
    stage === "ask" ? `This deletes the tab ${name}, its text and its ${pics}. This cannot be undone.` : `Really delete ${name} for good?`;
  $("notepad-delete-go").textContent = stage === "ask" ? "Delete tab…" : "Yes, delete it";
  $("notepad-delete-keep").disabled = $("notepad-delete-go").disabled = busy;
}

function openDelete() {
  if (!activeId || busy) return;
  closeNameForm(false);
  stage = nextDelete("none", "click");
  paintDelete();
  $("notepad-delete-keep").focus();
}

function closeDelete(toFocus = false) {
  if (stage === "none") return;
  stage = nextDelete(stage, "cancel");
  paintDelete();
  if (toFocus) tabBar.focusTab(activeId);
}

// Only the second press posts: the first moves to "Really delete…?".
async function confirmDelete() {
  if (busy || stage === "none") return;
  stage = nextDelete(stage, "confirm");
  if (stage === "sure") {
    paintDelete();
    return $("notepad-delete-keep").focus();
  }
  const id = activeId;
  const at = tabs.findIndex((t) => t.id === id);
  busy = true;
  drawTabs();
  paintDelete();
  const res = await postJson("/notepad/tab/delete", { id });
  const code = res.status === 0 ? null : res.body && res.body.error;
  busy = false;
  stage = "none";
  paintDelete();
  if (res.status !== 200 && code !== "no-such-tab") {
    drawTabs();
    tell(errorSentence(code));
    return tabBar.focusTab(id);
  }
  // Gone for good (deleted from another page counts, with its sentence).
  await gone(id, at, code === "no-such-tab");
}

/* ------------------------------------------------------------ pictures */

// The strip's pictures, oldest first, as { key, id, tab, url, thumb, status }:
// `key` is the page's own handle, `tab` the tab the picture was added to (fixed
// then, so a switch mid-upload cannot move it), `id` and `url` come from the
// server once the upload lands, `thumb` is the stored thumbnail's URL or, for
// one added here, the data: URL reencode() made. `status` is ready, uploading
// or failed. Only the tab on screen has entries here.
let images = [];

// What a failed upload needs to go again, by key: the re-encoded picture and
// its thumbnail. Kept out of `images`, since both are large.
const pending = new Map();

// Raw JPEG bytes to a /notepad route; the status and parsed answer, or status
// 0 when the server could not be reached (as postJson).
async function postJpeg(url, blob) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob });
    let answer = {};
    try {
      answer = await res.json();
    } catch {}
    return { status: res.status, body: answer };
  } catch {
    return { status: 0, body: {} };
  }
}

const imageFiles = (list) => Array.from(list || []).filter((f) => f && f.type && f.type.startsWith("image/"));

const drop = (key) => {
  images = images.filter((img) => img.key !== key);
  pending.delete(key);
};

// Whether the picture is still on screen: one added to a tab since left
// finishes in the background and touches nothing here.
const live = (entry) => images.includes(entry);

// The picture, then its thumbnail. One whose picture already landed (only
// the thumbnail failed) sends just the thumbnail again.
async function upload(entry) {
  const encoded = pending.get(entry.key);
  if (!encoded) return;
  entry.status = "uploading";
  if (live(entry)) drawStrip();
  if (!entry.id) {
    const res = await postJpeg("/notepad/image?tab=" + entry.tab, encoded.blob);
    const id = res.body && res.body.id;
    if (res.status !== 200 || !IMAGE_ID_RE.test(String(id))) return failed(entry, res);
    entry.id = id;
    // The server names the URL (it carries the tab).
    entry.url = res.body.url;
  }
  const res = await postJpeg("/notepad/thumb?id=" + entry.id + "&tab=" + entry.tab, encoded.thumbBlob);
  if (res.status !== 200) return failed(entry, res);
  pending.delete(entry.key);
  entry.status = "ready";
  if (!live(entry)) return;
  // Only this picture's own failure goes: a sentence about the batch (the
  // cap) or another picture stays up while the rest land.
  if (noticeKey === entry.key) tell("");
  drawStrip();
}

function failed(entry, res) {
  const code = res.status === 0 ? null : res.body && res.body.error;
  // The server said no for good: going again would only be refused again.
  if (code === "too-many" || code === "not-jpeg" || code === "too-large" || code === "not-found" || code === "no-such-tab") drop(entry.key);
  else entry.status = "failed";
  // One added to a tab since left says nothing here.
  if (entry.tab !== activeId) return;
  drawStrip();
  tell(errorSentence(code), entry.key);
}

export async function addNotepadImages(files) {
  const given = imageFiles(files);
  const tab = activeId;
  if (!given.length || !tab) return;
  const room = Math.max(0, NOTEPAD_MAX_IMAGES - images.length);
  tell(given.length > room ? errorSentence("too-many") : "");
  await Promise.all(
    given.slice(0, room).map(async (file) => {
      const entry = { key: crypto.randomUUID(), id: null, tab, url: null, thumb: null, status: "uploading" };
      images.push(entry);
      drawStrip();
      let encoded;
      try {
        encoded = await reencode(file);
      } catch (err) {
        if (!live(entry)) return;
        drop(entry.key);
        drawStrip();
        return tell(err.message);
      }
      entry.thumb = encoded.thumb;
      pending.set(entry.key, encoded);
      await upload(entry);
    }),
  );
}

// One thumbnail, the `n`th: the picture (its thumbnail, else the picture
// itself) as a button, and the X in its corner. A placeholder with a spinner
// while it uploads, Retry when it failed.
function thumbItem(entry, n) {
  const item = el("li", `attach-thumb notepad-thumb is-${entry.status}`);
  item.dataset.key = entry.key;
  const open = el("button", "notepad-thumb-open");
  open.type = "button";
  const src = entry.thumb || entry.url;
  if (src) {
    const pic = el("img");
    pic.src = src;
    pic.alt = `Notebook image ${n}`;
    open.appendChild(pic);
  } else open.setAttribute("aria-label", `Notebook image ${n}`);
  // Never `disabled`, which would push the focus out of the strip while the
  // picture uploads: it only does nothing until there is a picture to show.
  const viewable = Boolean(entry.url) && entry.status !== "uploading";
  if (!viewable) open.setAttribute("aria-disabled", "true");
  open.addEventListener("click", () => {
    if (viewable) openPreview(entry);
  });
  item.appendChild(open);
  if (entry.status !== "uploading" && !entry.asking) {
    const x = el("button", "attach-remove notepad-thumb-delete", "×");
    x.type = "button";
    x.setAttribute("aria-label", `Delete image ${n}`);
    x.addEventListener("click", () => ask(entry));
    item.appendChild(x);
  }
  if (entry.asking) {
    // Keep comes first and takes the focus, so Enter keeps the picture.
    const over = el("div", "attach-overlay notepad-ask");
    over.appendChild(el("p", null, "Delete this image?"));
    const row = el("div", "notepad-ask-row");
    const keep = el("button", "btn tiny notepad-ask-keep", "Keep");
    keep.type = "button";
    keep.addEventListener("click", () => {
      entry.asking = false;
      drawStrip();
      focusIn(entry.key, ".notepad-thumb-delete");
    });
    const del = el("button", "btn tiny notepad-ask-delete", "Delete");
    del.type = "button";
    del.addEventListener("click", () => remove(entry));
    keep.disabled = del.disabled = Boolean(entry.deleting);
    row.appendChild(keep);
    row.appendChild(del);
    over.appendChild(row);
    item.appendChild(over);
  } else if (entry.status === "uploading") {
    const over = el("div", "attach-overlay");
    over.appendChild(el("span", "spinner tiny"));
    item.appendChild(over);
  } else if (entry.status === "failed") {
    const over = el("div", "attach-overlay failed");
    over.appendChild(el("p", null, "Upload failed"));
    const again = el("button", "btn tiny notepad-retry", "Retry");
    again.type = "button";
    again.addEventListener("click", () => upload(entry));
    over.appendChild(again);
    item.appendChild(over);
  }
  return item;
}

// The controls a thumbnail can hold the focus on, by class.
const THUMB_CONTROLS = ["notepad-thumb-open", "notepad-thumb-delete", "notepad-ask-keep", "notepad-ask-delete", "notepad-retry"];

// Every redraw rebuilds the thumbnails, which would drop a focused button
// out of the page: the focus goes back to the same control, or to that
// thumbnail's picture when the control is gone (Retry became a spinner), or
// to Add image when the thumbnail itself is gone.
function drawStrip() {
  const strip = $("notepad-strip");
  const active = document.activeElement;
  const was = active && strip.contains(active) ? active.closest("li") : null;
  const control = was && THUMB_CONTROLS.find((cls) => active.classList.contains(cls));
  strip.replaceChildren(...images.map((entry, i) => thumbItem(entry, i + 1)));
  if (!was) return;
  if (!(control && focusIn(was.dataset.key, "." + control)) && !focusIn(was.dataset.key, ".notepad-thumb-open")) {
    $("notepad-add").focus();
  }
}

// Focus a control in the thumbnail with this key; whether it could.
function focusIn(key, selector) {
  const item = Array.from($("notepad-strip").children).find((li) => li.dataset.key === key);
  const target = item && item.querySelector(selector);
  if (!target || target.disabled) return false;
  target.focus();
  return true;
}

// The X asks first, on the thumbnail itself; one question at a time.
function ask(entry) {
  for (const img of images) img.asking = img === entry;
  drawStrip();
  focusIn(entry.key, ".notepad-ask-keep");
}

// Delete for good, then hand the focus to the picture that took its place.
// One never stored (its upload failed) is only taken off the strip.
async function remove(entry) {
  if (entry.id) {
    entry.deleting = true;
    drawStrip();
    const res = await postJson("/notepad/image/delete?tab=" + entry.tab, { id: entry.id });
    entry.deleting = false;
    // The tab was left (or deleted) while this was out: nothing here to update.
    if (!live(entry)) return;
    const code = res.status === 0 ? null : res.body && res.body.error;
    if (res.status !== 200 && code !== "not-found" && code !== "no-such-tab") {
      entry.asking = false;
      drawStrip();
      focusIn(entry.key, ".notepad-thumb-delete");
      return tell(errorSentence(code));
    }
    // Already gone (deleted from another page): off the strip too, with why.
    if (code === "not-found" || code === "no-such-tab") tell(errorSentence(code));
  }
  const at = images.indexOf(entry);
  drop(entry.key);
  drawStrip();
  const next = images[at] || images[at - 1];
  if (next) focusIn(next.key, ".notepad-thumb-open");
  else $("notepad-add").focus();
}

// The stored pictures of the tab `tabId` from GET /notepad, oldest first, then
// any added to it here that are still on their way or waiting for Retry.
// Pictures of any other tab are not kept: they finish in the background.
function takeStored(list, tabId) {
  const stored = (Array.isArray(list) ? list : [])
    .filter((img) => img && IMAGE_ID_RE.test(String(img.id)))
    .map((img) => ({ key: img.id, id: img.id, tab: tabId, url: img.url, thumb: img.thumb || null, status: "ready" }));
  const ids = new Set(stored.map((img) => img.id));
  const local = images.filter((img) => img.tab === tabId && img.status !== "ready" && !(img.id && ids.has(img.id)));
  for (const key of pending.keys()) if (!local.some((img) => img.key === key)) pending.delete(key);
  images = [...stored, ...local];
  drawStrip();
}

/* ------------------------------------------------------------ preview */

// What the preview steps through (the pictures with a stored copy, as they
// stood when it opened), which one shows, and the thumbnail it opened from.
let viewing = { list: [], index: -1, from: null };

function showAt(index) {
  const { list } = viewing;
  const entry = list[index];
  viewing.index = index;
  const pic = $("notepad-preview-img");
  pic.src = entry.url;
  pic.alt = `Notebook image ${images.indexOf(entry) + 1}`;
  $("notepad-preview-count").textContent = `${index + 1} of ${list.length}`;
  $("notepad-preview-prev").hidden = $("notepad-preview-next").hidden = list.length < 2;
}

function openPreview(entry) {
  const list = images.filter((img) => img.url);
  const index = list.indexOf(entry);
  if (index < 0) return;
  viewing = { list, index, from: entry.key };
  showAt(index);
  const dlg = $("notepad-preview");
  if (!dlg.open) dlg.showModal();
  $("notepad-preview-close").focus();
}

function move(delta) {
  const index = step(viewing.index, delta, viewing.list.length);
  if (index >= 0) showAt(index);
}

// Esc is taken here and closes the preview alone: left to the browser, it
// could reach the Notebook underneath too.
function wirePreview() {
  const dlg = $("notepad-preview");
  $("notepad-preview-prev").addEventListener("click", () => move(-1));
  $("notepad-preview-next").addEventListener("click", () => move(1));
  $("notepad-preview-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      move(e.key === "ArrowLeft" ? -1 : 1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      dlg.close();
    }
  });
  dlg.addEventListener("close", () => {
    $("notepad-preview-img").removeAttribute("src");
    focusIn(viewing.from, ".notepad-thumb-open");
  });
}

// A paste is a picture paste when it carries image files and no plain text:
// a spreadsheet's cells come with a picture of themselves too, and are text.
function pastedImages(data) {
  if (!data || (data.types && Array.from(data.types).includes("text/plain"))) return [];
  const items = Array.from(data.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  return items.length ? items : imageFiles(data.files);
}

const draggingFiles = (e) => Boolean(e.dataTransfer && Array.from(e.dataTransfer.types || []).includes("Files"));

// The three ways in: the Add image button, a paste and a drop anywhere on the
// dialog. Captured on the dialog, ahead of the editor's own handling, and
// only for pictures: text pastes and text drags reach the editor as usual.
function wireImages(dlg) {
  const picker = $("notepad-file");
  $("notepad-add").addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    addNotepadImages(picker.files);
    picker.value = "";
  });
  dlg.addEventListener(
    "paste",
    (e) => {
      const files = pastedImages(e.clipboardData);
      if (!files.length) return;
      e.preventDefault();
      e.stopPropagation();
      addNotepadImages(files);
    },
    true,
  );
  dlg.addEventListener(
    "dragover",
    (e) => {
      if (!draggingFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      dlg.classList.add("is-drop");
    },
    true,
  );
  dlg.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || !dlg.contains(e.relatedTarget)) dlg.classList.remove("is-drop");
  });
  dlg.addEventListener(
    "drop",
    (e) => {
      dlg.classList.remove("is-drop");
      if (!draggingFiles(e)) return;
      // Taken even when none is a picture, or the browser opens the file.
      e.preventDefault();
      e.stopPropagation();
      addNotepadImages(e.dataTransfer.files);
    },
    true,
  );
}

/* ------------------------------------------------------------ opening */

// Read again on every open, so saves from another page on the same folder
// show up. Text typed here and not yet saved (or too long to save) is never
// replaced; the tab it belongs to stays on screen.
async function load() {
  const keep = keepsText(save);
  let res = await readNote(activeId);
  if (!res.ok && res.code === "no-such-tab" && activeId && !keep) res = await readNote(null);
  if (!res.ok) {
    if (loaded) return;
    const line = $("notepad-status");
    line.textContent = NOT_LOADED;
    line.classList.add("is-problem");
    return;
  }
  show(res.body, keep);
  paintStatus();
  if (!tabs.length) $("notepad-empty-new").focus();
}

// The one editor being made, so a second click while it loads waits for it
// instead of building another beside it.
let making = null;

export async function openNotepad() {
  if ($("btn-notepad").disabled) return;
  const dlg = $("notepad-modal");
  if (!editor) {
    try {
      await (making ??= makeEditor().finally(() => (making = null)));
    } catch {
      // The editor file could not be loaded: say so, and let the next click try again.
      if (!dlg.open) dlg.showModal();
      return tell(EDITOR_NOT_LOADED);
    }
  }
  editor.setReadOnly(!loaded || !activeId);
  tell("");
  inform("");
  naming = null;
  $("notepad-name-dlg").close();
  stage = "none";
  paintDelete();
  if (!dlg.open) dlg.showModal();
  editor.focus();
  await load();
}

export function wireNotepad() {
  const dlg = $("notepad-modal");
  tabBar = createTabs({
    onSwitch: (id) => switchTo(id),
    onChange: async (event) => {
      if (event.type === "order") return reorder(event.order, event.focus);
      // Rename and delete act on the current tab: a double-click, F2 or x on
      // another one picks it first.
      if (event.id && event.id !== activeId) await switchTo(event.id);
      if (event.id && event.id !== activeId) return;
      if (event.type === "delete") openDelete();
      else openNameForm("rename");
    },
  });
  lightDismiss(dlg);
  wireImages(dlg);
  wirePreview();
  $("btn-notepad").addEventListener("click", openNotepad);
  $("notepad-close").addEventListener("click", () => dlg.close());
  $("notepad-tab-new").addEventListener("click", () => openNameForm("new"));
  $("notepad-empty-new").addEventListener("click", () => openNameForm("new"));
  $("notepad-delete-keep").addEventListener("click", () => closeDelete(true));
  $("notepad-delete-go").addEventListener("click", confirmDelete);
  $("notepad-name-cancel").addEventListener("click", () => closeNameForm());
  $("notepad-name-form").addEventListener("submit", (e) => {
    e.preventDefault();
    submitName();
  });
  // The two small dialogs are modal over the Notebook, so Esc (or any other
  // way they close) backs out of them alone and the state follows the dialog.
  $("notepad-name-dlg").addEventListener("close", () => closeNameForm());
  $("notepad-delete").addEventListener("close", () => closeDelete(true));
  dlg.addEventListener("close", () => {
    flush();
    $("btn-notepad").focus();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  // Only while something typed may not be on disk yet.
  window.addEventListener("beforeunload", (e) => {
    if (!unsaved(save)) return;
    e.preventDefault();
    e.returnValue = "";
  });
}
