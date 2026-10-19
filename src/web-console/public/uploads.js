// Plan2Code Web Console - pictures and documents attached to a note: chips, trays, re-encoding, upload, retry; defines only.
//
// Shared by the question cards and the Ask pane, so neither imports the other.

import { SVG_NS, el } from "./render.js";
import {
  docExt,
  formatBytes,
  DOC_TYPES,
  MAX_ATTACHMENTS,
  pickerAccept,
  attachmentKind,
  fitWithin,
  IMAGE_LONG_EDGE,
  IMAGE_QUALITY,
  THUMB_EDGE,
  MAX_DOC_BYTES,
  sortAttachments,
} from "./answers.js";
import { hooks, page, saveNow, redraw } from "./state.js";
import { CHAT_MAX_ATTACHMENTS } from "./chat.js";

// The chat's images live under local.chat, not beside the notes: the card
// send gathers every entry of local.images, and a chat picture is not a note.
export const CHAT_IMAGES = "__chat";

// An upload's server path is `<session>/uploads/<uuid>.<ext>`; the page serves
// it at /uploads/<uuid>.<ext>.
export const uploadUrl = (img) => img.url || "/uploads/" + String(img.path || "").split(/[\\/]/).pop();

// A page with its corner folded, drawn inline: the CSP allows no icon font.
function pageIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "attach-chip-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ["M6 2.5h8.5L19 7v14.5H6z", "M14.5 2.5V7H19"]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

// A document in a tray: never an <img>, since a document is not a picture.
// Icon, extension badge, name and size; a sent one is wrapped in a link.
export function docChip(entry, status) {
  const ext = docExt(entry.name) || "";
  const fig = el("figure", `attach-thumb attach-chip is-${status}`);
  const size = typeof entry.size === "number" ? formatBytes(entry.size) : "";
  const label = DOC_TYPES[ext] ? DOC_TYPES[ext].label : "";
  fig.setAttribute("aria-label", [entry.name, label, size].filter(Boolean).join(", "));
  fig.appendChild(pageIcon());
  const text = el("div", "attach-chip-text");
  if (ext) text.appendChild(el("span", "attach-chip-badge", ext.toUpperCase()));
  text.appendChild(el("span", "attach-chip-name", entry.name));
  if (size) text.appendChild(el("span", "attach-chip-size", size));
  fig.appendChild(text);
  return fig;
}

// The + Attach file control and its hidden picker, for a note's box or a
// card's own. Files go to the item's note attachments either way.
export function attachRow(itemId, ariaLabel) {
  const row = el("div", "attach-row");
  const btn = el("button", "btn small ghost", "+ Attach file");
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);
  btn.disabled = noteImages(itemId).length >= MAX_ATTACHMENTS;
  const picker = el("input");
  picker.type = "file";
  picker.accept = pickerAccept();
  picker.multiple = true;
  picker.hidden = true;
  btn.addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    attachFiles(itemId, picker.files);
    picker.value = "";
  });
  row.appendChild(btn);
  row.appendChild(picker);
  return row;
}

export function attachTray(itemId, attached) {
  const tray = el("div", "attach-tray");
  for (const img of attached) {
    let fig;
    if (attachmentKind(img) === "file") fig = docChip(img, img.status);
    else {
      fig = el("figure", "attach-thumb is-" + img.status);
      const src = thumbs.get(img.key) || img.url;
      if (src) {
        const pic = el("img");
        pic.src = src;
        pic.alt = img.name;
        fig.appendChild(pic);
      }
    }
    const rm = el("button", "attach-remove", "×");
    rm.type = "button";
    rm.setAttribute("aria-label", `Remove ${img.name}`);
    rm.addEventListener("click", () => removeImage(itemId, img.key));
    fig.appendChild(rm);
    if (img.status === "uploading") {
      const over = el("div", "attach-overlay");
      over.appendChild(el("span", "spinner tiny"));
      fig.appendChild(over);
    } else if (img.status === "failed") {
      const over = el("div", "attach-overlay failed");
      over.appendChild(el("span", null, "Upload failed"));
      const retry = el("button", "btn tiny", "Retry");
      retry.type = "button";
      retry.addEventListener("click", () => retryImage(itemId, img.key));
      const drop = el("button", "btn tiny", "Remove");
      drop.type = "button";
      drop.addEventListener("click", () => removeImage(itemId, img.key));
      over.appendChild(retry);
      over.appendChild(drop);
      fig.appendChild(over);
    }
    tray.appendChild(fig);
  }
  return tray;
}

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Three ways in, because browsers disagree: EXIF-aware bitmap decode, plain
// bitmap decode, then an <img> fed a data: URL. Not an object URL: the CSP
// allows `data:` images and refuses `blob:` ones.
async function decodeImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {}
  try {
    return await createImageBitmap(file);
  } catch {}
  try {
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    throw new Error("That file could not be read as an image.");
  }
}

function drawScaled(source, edge) {
  const w0 = source.naturalWidth || source.width;
  const h0 = source.naturalHeight || source.height;
  const { w, h } = fitWithin(w0, h0, edge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // JPEG has no alpha: a transparent PNG would otherwise turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

const toJpeg = (canvas, quality) =>
  new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("That image could not be converted."))), "image/jpeg", quality)
  );

// The upload (a JPEG no longer than IMAGE_LONG_EDGE) and its thumbnail, as a
// small data: URL for a tray (`thumb`) and as a JPEG for a server that keeps
// one (`thumbBlob`, the Notepad's), from one decode.
export async function reencode(file) {
  const source = await decodeImage(file);
  try {
    const blob = await toJpeg(drawScaled(source, IMAGE_LONG_EDGE), IMAGE_QUALITY);
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("That image is too large even after shrinking it.");
    const small = drawScaled(source, THUMB_EDGE);
    const thumb = small.toDataURL("image/jpeg", 0.7);
    const thumbBlob = await toJpeg(small, 0.7);
    return { blob, thumb, thumbBlob };
  } finally {
    if (typeof source.close === "function") source.close();
  }
}

// Thumbnails and retry blobs, keyed by an attachment's local `key`. Kept out
// of `local`: both are large, and neither survives a reload anyway.
export const thumbs = new Map();

const retryBlobs = new Map();

// A note's pictures, or the chat composer's (CHAT_IMAGES), which live apart.
export const noteImages = (itemId) =>
  itemId === CHAT_IMAGES ? page.local.chat.images : (page.local.images && page.local.images[itemId]) || [];

const findImage = (itemId, key) => noteImages(itemId).find((img) => img.key === key) || null;

function setNoteImages(itemId, list) {
  if (itemId === CHAT_IMAGES) page.local.chat.images = list;
  else if (list.length) page.local.images[itemId] = list;
  else delete page.local.images[itemId];
}

// Where an attachment is deleted from. Documents have no `url`, so their
// route is built from the path, as uploadUrl does.
export const deleteUrl = (entry) => entry.url || "/uploads/" + String(entry.path || "").split(/[\\/]/).pop();

// The files in a paste worth attaching: images and allowed documents. A paste
// with none of them is left to paste as text.
export function incomingFiles(list) {
  return Array.from(list || []).filter((f) => (f.type && f.type.startsWith("image/")) || docExt(f.name));
}

const notAllowedText = (name) => `"${name}" can't be attached: only images, text, code and PDF files.`;

const tooLargeText = (name) => `"${name}" is over ${formatBytes(MAX_DOC_BYTES)}.`;

async function uploadBlob(itemId, key, blob) {
  const img = findImage(itemId, key);
  if (!img) return;
  const isFile = attachmentKind(img) === "file";
  img.status = "uploading";
  saveNow();
  redraw();
  let body = null;
  let status = 0;
  try {
    const res = await fetch("/upload", {
      method: "POST",
      headers: {
        "content-type": isFile ? "application/octet-stream" : "image/jpeg",
        "x-p2c-name": encodeURIComponent(img.name),
      },
      body: blob,
    });
    status = res.status;
    if (res.ok) body = await res.json();
  } catch {}
  const now = findImage(itemId, key);
  if (!now) {
    // Removed while it was on its way: the file it just made belongs to nobody.
    if (body && body.ok && body.id) fetch(deleteUrl(body), { method: "DELETE" }).catch(() => {});
    return;
  }
  if (body && body.ok) {
    Object.assign(now, { id: body.id, path: body.path, name: body.name, size: body.size, kind: body.kind, status: "ready" });
    if (body.url) now.url = body.url;
    retryBlobs.delete(key);
  } else if (isFile && (status === 415 || status === 413)) {
    // The server read the file and said no: Retry would only fail again.
    setNoteImages(itemId, noteImages(itemId).filter((x) => x.key !== key));
    retryBlobs.delete(key);
    hooks.banner(status === 413 ? tooLargeText(now.name) : notAllowedText(now.name), "warn");
  } else {
    now.status = "failed";
    retryBlobs.set(key, blob);
  }
  saveNow();
  redraw();
}

export async function attachFiles(itemId, files) {
  const given = Array.from(files || []);
  const { images, docs, refused } = sortAttachments(given);
  const chat = itemId === CHAT_IMAGES;
  const room = Math.max(0, (chat ? CHAT_MAX_ATTACHMENTS : MAX_ATTACHMENTS) - noteImages(itemId).length);
  const wanted = given.filter((f) => images.includes(f) || docs.includes(f));
  const taken = wanted.slice(0, room);
  // One banner at a time, so every refusal goes into it, each by name.
  const said = refused.map((r) => (r.reason === "too-large" ? tooLargeText(r.name) : notAllowedText(r.name)));
  if (taken.length < wanted.length)
    said.push(
      chat ? `Up to ${CHAT_MAX_ATTACHMENTS} attachments per question.` : `Up to ${MAX_ATTACHMENTS} attachments per note.`
    );
  if (said.length) hooks.banner(said.join(" "), refused.length ? "warn" : "info");
  await Promise.all(
    taken.map(async (file) => {
      const key = crypto.randomUUID();
      if (docs.includes(file)) {
        setNoteImages(itemId, [
          ...noteImages(itemId),
          { key, kind: "file", name: file.name, size: file.size, status: "uploading" },
        ]);
        saveNow();
        redraw();
        await uploadBlob(itemId, key, file);
        return;
      }
      setNoteImages(itemId, [
        ...noteImages(itemId),
        { key, kind: "image", name: file.name || "pasted-image.png", status: "uploading" },
      ]);
      saveNow();
      redraw();
      let encoded;
      try {
        encoded = await reencode(file);
      } catch (err) {
        setNoteImages(itemId, noteImages(itemId).filter((img) => img.key !== key));
        saveNow();
        redraw();
        hooks.banner(err.message, "warn");
        return;
      }
      thumbs.set(key, encoded.thumb);
      await uploadBlob(itemId, key, encoded.blob);
    })
  );
}

export async function removeImage(itemId, key) {
  const img = findImage(itemId, key);
  setNoteImages(itemId, noteImages(itemId).filter((x) => x.key !== key));
  thumbs.delete(key);
  retryBlobs.delete(key);
  saveNow();
  redraw();
  // Errors are ignored: the 30-day sweep is the backstop.
  if (img && img.id) fetch(deleteUrl(img), { method: "DELETE" }).catch(() => {});
}

async function retryImage(itemId, key) {
  const blob = retryBlobs.get(key);
  if (blob) return uploadBlob(itemId, key, blob);
  await removeImage(itemId, key);
  hooks.banner("Attach it again.", "info");
}

// Every note with something in it — text, attachments, or both — as
// { id, text, images, held }. `held` is a note with an image still uploading
// or failed: it stays drafted, and only it waits.
function draftedNotes() {
  const ids = new Set();
  for (const [key, text] of Object.entries(page.local.drafts)) {
    if (key.startsWith("thread-") && text && text.trim()) ids.add(key.slice(7));
  }
  for (const [id, list] of Object.entries(page.local.images || {})) if (list.length) ids.add(id);
  return [...ids].map((id) => {
    const imgs = noteImages(id);
    return {
      id,
      text: (page.local.drafts["thread-" + id] || "").trim(),
      images: imgs.filter((img) => img.status === "ready"),
      held: imgs.some((img) => img.status === "uploading" || img.status === "failed"),
    };
  });
}

export function pendingNotes() {
  return draftedNotes()
    .filter((n) => !n.held && (n.text || n.images.length))
    .map(({ id, text, images }) => ({ id, text, images }));
}

export function heldNotes() {
  return draftedNotes().filter((n) => n.held);
}

// A sent note's attachments as links: an image opens full size, a document
// opens in its own tab. The page serves both by the upload's own file name.
export function sentAttachments(note) {
  const entries = [
    ...(note.images || []).map((e) => ({ ...e, kind: "image" })),
    ...(note.files || []).map((e) => ({ ...e, kind: "file" })),
  ];
  if (!entries.length) return null;
  const tray = el("div", "attach-tray");
  for (const e of entries) {
    const a = el("a", "attach-link");
    a.href = uploadUrl(e);
    a.target = "_blank";
    a.rel = "noopener";
    a.title = e.name || "attachment";
    if (e.kind === "image") {
      const fig = el("figure", "attach-thumb is-ready");
      const pic = el("img");
      pic.src = a.href;
      pic.alt = e.name || "image";
      fig.appendChild(pic);
      a.appendChild(fig);
    } else a.appendChild(docChip({ name: e.name || "file" }, "ready"));
    tray.appendChild(a);
  }
  return tray;
}
