// Plan2Code Web Console - the Notepad: the top bar's icon, its dialog, the editor and autosave.
//
// The person's own notes for the folder this session runs in, kept by the
// server under ~/.plan2code/notepads/ through the /notepad routes, never in
// the session, so nothing typed here reaches the agent. The editor is the
// vendored OverType, which styles Markdown in place over a real textarea. Its
// CSS ships in styles/notepad.css, because the page's policy blocks the
// <style> OverType would inject. When to save and what the status line says
// are notepad.js's pure rules; this file only runs the timers and requests.

import { page } from "../state.js";
import {
  IMAGE_ID_RE,
  NOTEPAD_MAX_IMAGES,
  NOT_LOADED,
  SAVE_START,
  changedRange,
  errorSentence,
  keepsText,
  nextSave,
  noteBytes,
  saveStatus,
  step,
  topLevelParts,
  unsaved,
  withoutStyleAttrs,
} from "../notepad.js";
import { el, lightDismiss } from "../render.js";
import { postJson } from "../net.js";
import { reencode } from "../uploads.js";
import { OverType } from "../vendor/overtype.esm.js";

const $ = (id) => document.getElementById(id);

const NOT_CONNECTED = "Not connected right now.";

// One editor for the page's life, made on first open.
let editor = null;

// The save state (notepad.js), the one timer it arms, and the request in
// flight. `rev` counts changes, so an answer to an older text never marks a
// newer one saved.
let save = SAVE_START;
let timer = null;
let sending = false;
let rev = 0;
let problem = "";

// True while the page itself sets the editor's text: OverType reports that as
// a change, and it is not the person typing.
let loading = false;

// Whether the note has been read into the editor yet. Until it has, the
// editor is read-only: text typed into the empty editor would be saved over
// the real note.
let loaded = false;

// Drawn from the render pass beside Stop: always shown, unusable while the
// server is gone (nothing could load or save).
export function renderNotepadButton() {
  const btn = $("btn-notepad");
  btn.disabled = Boolean(page.gone);
  btn.title = page.gone ? NOT_CONNECTED : "Notepad";
}

// The last thing a picture went wrong with, said after the save words until
// the next batch of pictures starts or the notepad is opened again; and the
// picture it was about, if one, whose Retry landing clears it.
let notice = "";
let noticeKey = null;

function paintStatus() {
  const line = $("notepad-status");
  const words = saveStatus(save);
  const failed = save.status === "failed" || save.status === "too-long";
  const saving = save.status === "failed" && problem ? `${words}. ${problem}` : words;
  line.textContent = [saving, notice].filter(Boolean).join(" ");
  line.classList.toggle("is-problem", failed || Boolean(notice));
}

function tell(sentence, key = null) {
  notice = sentence;
  noticeKey = key;
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
}

// One save at a time. A save that comes due while another is out goes as
// soon as that one answers.
async function send() {
  if (sending || !editor) return;
  sending = true;
  const sent = rev;
  const res = await postJson("/notepad/text", { text: editor.getValue() });
  sending = false;
  if (rev !== sent) {
    // Typed while it was out: the newer text has its own debounce running, or
    // is already due and waiting for this request to finish.
    if (save.status === "saving") send();
    return;
  }
  if (res.status === 200) {
    problem = "";
    return dispatch("ok");
  }
  const code = res.body && res.body.error;
  problem = errorSentence(res.status === 0 ? null : code);
  dispatch({ type: "error", code });
}

function changed(text) {
  if (loading) return;
  rev += 1;
  dispatch({ type: "typed", bytes: noteBytes(text) });
}

// Save now rather than after the debounce: closing, the tab going hidden.
function flush() {
  if (save.status === "pending" || save.status === "failed") dispatch("due");
}

function setText(text) {
  loading = true;
  try {
    editor.setValue(text);
  } finally {
    loading = false;
  }
}

// OverType writes inline style attributes into the HTML it sets: one on every
// link it draws (its tooltip's anchor name) and two in the link tooltip. The
// page's policy refuses each one with a report, on every keystroke. While the
// editor is built, the elements it makes get an innerHTML that drops them
// (withoutStyleAttrs); the preview and the tooltip are among them, so this
// holds for every later render too. The tooltip then finds a link by the data
// attribute its anchor name moved to.
function buildWithoutStyleAttrs(build) {
  const create = document.createElement;
  const inner = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML");
  document.createElement = function (...args) {
    const node = create.apply(this, args);
    Object.defineProperty(node, "innerHTML", {
      configurable: true,
      get() {
        return inner.get.call(this);
      },
      set(html) {
        const clean = withoutStyleAttrs(String(html));
        if (this.classList.contains("overtype-preview")) patchPreview(this, clean);
        else inner.set.call(this, clean);
      },
    });
    return node;
  };
  try {
    return build();
  } finally {
    document.createElement = create;
  }
}

// The styled layer as OverType last drew it, one HTML string per top-level
// element (topLevelParts), matching the preview's children one for one.
let drawn = [];

const parseParts = (html) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  return [...tpl.content.childNodes];
};

// OverType redraws the whole styled layer on every key: about 43,000 elements
// in a 200 KB note, and parsing and laying those out is most of the wait for a
// key to show. Only the lines between the first and the last that differ from
// the last drawing are parsed and swapped; the rest stays as it was.
function patchPreview(preview, html) {
  const parts = topLevelParts(html);
  const shown = [...preview.childNodes];
  const redraw = () => {
    preview.replaceChildren(...parseParts(html));
    drawn = parts && preview.childNodes.length === parts.length ? parts : [];
  };
  if (!parts || shown.length !== drawn.length) return redraw();
  const { head, tail } = changedRange(drawn, parts);
  const changed = parts.slice(head, parts.length - tail);
  const fresh = parseParts(changed.join(""));
  // One element per part, or the cut was wrong: draw it all.
  if (fresh.length !== changed.length) return redraw();
  const after = shown[shown.length - tail] || null;
  for (const old of shown.slice(head, shown.length - tail)) old.remove();
  for (const node of fresh) preview.insertBefore(node, after);
  drawn = parts;
  // OverType shades each pair of code fences right after this, and never
  // takes the shading off: a kept line whose fence lost its partner would keep
  // it. Cleared here (the attributes removed outright, so a cleared line is
  // the line OverType drew), and OverType marks only the pairs that still are.
  for (const line of preview.querySelectorAll(".code-block-line")) {
    line.classList.remove("code-block-line");
    if (!line.classList.length) line.removeAttribute("class");
  }
  for (const fence of preview.querySelectorAll(".code-fence")) fence.removeAttribute("style");
}

function makeEditor() {
  // Before the first instance, or it injects its <style> (which the policy
  // blocks) and the flag would come too late.
  OverType.stylesInjected = true;
  // OverType reports its first, empty value as a change: not the person typing,
  // and saved it would wipe the note.
  loading = true;
  try {
    [editor] = buildWithoutStyleAttrs(
      () =>
        new OverType($("notepad-editor"), {
          toolbar: false,
          textareaProps: { "aria-label": "Notepad text" },
          onChange: changed,
        }),
    );
  } finally {
    loading = false;
  }
  editor.linkTooltip.findAnchorElement = (index) => editor.preview.querySelector(`a[data-anchor="--link-${index}"]`);
}

// The stored note (`{ text, images }`), or null when it could not be read.
async function readNote() {
  try {
    const res = await fetch("/notepad", { cache: "no-store" });
    if (!res.ok) return null;
    const body = await res.json();
    return body && typeof body.text === "string" ? body : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------ pictures */

// The strip's pictures, oldest first, as { key, id, url, thumb, status }:
// `key` is the page's own handle, `id` and `url` come from the server once
// the upload lands, `thumb` is the stored thumbnail's URL or, for one added
// here, the data: URL reencode() made. `status` is ready, uploading or failed.
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

// The picture, then its thumbnail. One whose picture already landed (only
// the thumbnail failed) sends just the thumbnail again.
async function upload(entry) {
  const encoded = pending.get(entry.key);
  if (!encoded) return;
  entry.status = "uploading";
  drawStrip();
  if (!entry.id) {
    const res = await postJpeg("/notepad/image", encoded.blob);
    const id = res.body && res.body.id;
    if (res.status !== 200 || !IMAGE_ID_RE.test(String(id))) return failed(entry, res);
    entry.id = id;
    entry.url = "/notepad/images/" + id + ".jpg";
  }
  const res = await postJpeg("/notepad/thumb?id=" + entry.id, encoded.thumbBlob);
  if (res.status !== 200) return failed(entry, res);
  pending.delete(entry.key);
  entry.status = "ready";
  // Only this picture's own failure goes: a sentence about the batch (the
  // cap) or another picture stays up while the rest land.
  if (noticeKey === entry.key) tell("");
  drawStrip();
}

function failed(entry, res) {
  const code = res.status === 0 ? null : res.body && res.body.error;
  // The server said no for good: going again would only be refused again.
  if (code === "too-many" || code === "not-jpeg" || code === "too-large" || code === "not-found") drop(entry.key);
  else entry.status = "failed";
  drawStrip();
  tell(errorSentence(code), entry.key);
}

export async function addNotepadImages(files) {
  const given = imageFiles(files);
  if (!given.length) return;
  const room = Math.max(0, NOTEPAD_MAX_IMAGES - images.length);
  tell(given.length > room ? errorSentence("too-many") : "");
  await Promise.all(
    given.slice(0, room).map(async (file) => {
      const entry = { key: crypto.randomUUID(), id: null, url: null, thumb: null, status: "uploading" };
      images.push(entry);
      drawStrip();
      let encoded;
      try {
        encoded = await reencode(file);
      } catch (err) {
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
    pic.alt = `Notepad image ${n}`;
    open.appendChild(pic);
  } else open.setAttribute("aria-label", `Notepad image ${n}`);
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
    const res = await postJson("/notepad/image/delete", { id: entry.id });
    entry.deleting = false;
    const code = res.status === 0 ? null : res.body && res.body.error;
    if (res.status !== 200 && code !== "not-found") {
      entry.asking = false;
      drawStrip();
      focusIn(entry.key, ".notepad-thumb-delete");
      return tell(errorSentence(code));
    }
    // Already gone (deleted from another page): off the strip too, with why.
    if (code === "not-found") tell(errorSentence(code));
  }
  const at = images.indexOf(entry);
  drop(entry.key);
  drawStrip();
  const next = images[at] || images[at - 1];
  if (next) focusIn(next.key, ".notepad-thumb-open");
  else $("notepad-add").focus();
}

// The stored pictures from GET /notepad, oldest first, then any added here
// that are still on their way or waiting for Retry.
function takeStored(list) {
  const stored = (Array.isArray(list) ? list : [])
    .filter((img) => img && IMAGE_ID_RE.test(String(img.id)))
    .map((img) => ({ key: img.id, id: img.id, url: img.url, thumb: img.thumb || null, status: "ready" }));
  const ids = new Set(stored.map((img) => img.id));
  const local = images.filter((img) => img.status !== "ready" && !(img.id && ids.has(img.id)));
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
  pic.alt = `Notepad image ${images.indexOf(entry) + 1}`;
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
// could reach the Notepad underneath too.
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

// Read again on every open, so saves from another page on the same folder
// show up. Text typed here and not yet saved (or too long to save) is never
// replaced.
async function load() {
  const note = await readNote();
  if (note === null) {
    if (loaded) return;
    const line = $("notepad-status");
    line.textContent = NOT_LOADED;
    line.classList.add("is-problem");
    return;
  }
  takeStored(note.images);
  if (keepsText(save)) return;
  setText(note.text);
  save = SAVE_START;
  loaded = true;
  editor.textarea.readOnly = false;
  paintStatus();
}

export async function openNotepad() {
  if ($("btn-notepad").disabled) return;
  const dlg = $("notepad-modal");
  if (!editor) makeEditor();
  editor.textarea.readOnly = !loaded;
  tell("");
  if (!dlg.open) dlg.showModal();
  editor.textarea.focus();
  await load();
}

export function wireNotepad() {
  const dlg = $("notepad-modal");
  lightDismiss(dlg);
  wireImages(dlg);
  wirePreview();
  $("btn-notepad").addEventListener("click", openNotepad);
  $("notepad-close").addEventListener("click", () => dlg.close());
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
