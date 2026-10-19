// Plan2Code Web Console - a document as the page shows it, and as a file: blocks, Markdown and HTML download; defines only.
//
// Shared by the documents tab and the finished screen, so neither imports the other.

import { el, md } from "./render.js";

// A block's content: its markdown, or for an image block (a screenshot the
// agent saved under the session's shots/ folder) a captioned picture.
export function blockBody(b) {
  if (typeof b.image !== "string") return md(b.md, "md");
  const fig = el("figure", "doc-figure");
  const img = el("img", "doc-img");
  img.src = "/shots/" + b.image.split("/").pop();
  // The caption already says it: an alt repeating it is read twice, and shows
  // twice in an export whose picture would not load.
  img.alt = "";
  img.loading = "lazy";
  fig.appendChild(img);
  if (b.alt) fig.appendChild(el("figcaption", null, b.alt));
  return fig;
}

// Markdown rather than HTML: it is what the agent wrote, what the file under
// specs/ already holds, and what survives being pasted into Slack or a ticket.
export function downloadDoc(doc) {
  // The file keeps what the page shows: the title, and which parts are still
  // assumptions or drafts. Without the marks a half-finished document reads,
  // once it leaves the page, as a set of decisions.
  const mark = { assumed: "> **Assumed for now, still open.**\n\n", draft: "> **Draft.**\n\n" };
  const blocks = (doc.blocks || []).map((b) => (mark[b.state] || "") + (typeof b.image === "string" ? b.alt || "" : b.md || ""));
  const first = (doc.blocks || [])[0];
  const titled = first && /^\s*#\s/.test(first.md || "");
  const body = [titled || !doc.title ? null : `# ${doc.title}`, ...blocks].filter((x) => x != null).join("\n\n");
  saveFile(`${docFileName(doc)}.md`, body, "text/markdown");
}

function docFileName(doc) {
  const name = (doc.title || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return name || "document";
}

function saveFile(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before the handle goes.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// The page's own markdown styles, restated with the light palette baked in:
// the saved file has no app.css beside it and may be opened years from now,
// on any machine, so it carries everything it needs.
const DOC_HTML_CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #f6f3ee; color: #1d1a17; font: 15.5px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
main { max-width: 880px; margin: 0 auto; padding: 40px 28px 60px; background: #fff; min-height: 100vh; box-sizing: border-box; }
.doc-head { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e4ddd1; }
.doc-head h1 { font: 600 27px/1.2 "Iowan Old Style", Charter, Georgia, Cambria, serif; margin: 0; }
.doc-version, .doc-meta { font: 700 12px/1 ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace; color: #8f8779; }
.doc-note { color: #5d564d; margin: 0 0 16px; }
.block { border-left: 3px solid transparent; padding: 2px 0 2px 14px; margin: 0 0 4px; }
.block.assumed { border-left: 3px dashed #9a6a12; background: #fbf0d8; border-radius: 0 8px 8px 0; }
.block.draft { border-left-color: #cfc6b6; opacity: 0.72; }
.block.settled { border-left-color: #e4f0e8; }
.block-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #9a6a12; display: block; margin-bottom: 4px; }
.md-h { font-family: "Iowan Old Style", Charter, Georgia, Cambria, serif; font-weight: 600; margin: 22px 0 9px; line-height: 1.25; }
h1.md-h { font-size: 25px; }
h2.md-h { font-size: 21px; }
h3.md-h { font-size: 17.5px; }
h4.md-h, h5.md-h, h6.md-h { font-size: 15px; }
.md-p { margin: 0 0 11px; }
.md-list { margin: 0 0 11px; padding-left: 22px; }
.md-li { margin-bottom: 5px; }
.md-task { display: inline-block; width: 16px; color: #8f8779; font-weight: 700; }
.md-task.is-done { color: #2f6b45; }
.md-li.is-task { list-style: none; margin-left: -18px; display: grid; grid-template-columns: 16px 1fr; column-gap: 4px; align-items: baseline; }
.md-li.is-task > :not(.md-task) { grid-column: 2; }
.md-li.is-task > .md-p:last-child { margin-bottom: 0; }
.md-quote { margin: 0 0 11px; padding: 2px 0 2px 15px; border-left: 3px solid #cfc6b6; color: #5d564d; }
.md-code { font: 0.88em ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace; background: #fbf9f6; border: 1px solid #e4ddd1; border-radius: 4px; padding: 1px 5px; }
.md-pre-wrap { margin: 0 0 13px; }
.md-pre { font: 13px/1.5 ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace; background: #fbf9f6; border: 1px solid #e4ddd1; border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 0; }
.md-hr { border: 0; border-top: 1px solid #e4ddd1; margin: 20px 0; }
.md-table-wrap { overflow-x: auto; margin: 0 0 13px; }
.md-table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.md-table th, .md-table td { border: 1px solid #e4ddd1; padding: 8px 11px; text-align: left; }
.md-table th { background: #fbf9f6; font-weight: 600; }
.md-img { max-width: 100%; border-radius: 8px; }
.doc-figure { margin: 0 0 13px; }
.doc-img { display: block; max-width: 100%; border: 1px solid #e4ddd1; border-radius: 8px; }
.doc-figure figcaption { font-size: 13px; color: #5d564d; margin-top: 6px; }
.md a { color: #206cc3; }
@media print {
  body { background: #fff; }
  main { padding: 0; min-height: 0; }
  .block { break-inside: avoid; }
}
`;

// Only this session's uploaded images may ride along in a saved file: any other
// address on this origin (/state, say) would copy session data into something
// meant to be shared. A remote image keeps its own address; anything else on
// this origin becomes its alt text.
const INLINE_UPLOAD = /^\/(?:uploads\/[0-9a-f-]{36}\.jpg|shots\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}\.(?:png|jpe?g|webp))$/i;

function imageToAlt(img) {
  const alt = img.getAttribute("alt") || "";
  if (alt) img.replaceWith(document.createTextNode(alt));
  else img.remove();
}

async function inlineImage(img) {
  const src = img.getAttribute("src") || "";
  if (!src || src.startsWith("data:")) return;
  let url;
  try {
    url = new URL(src, location.href);
  } catch {
    return imageToAlt(img);
  }
  if (url.origin !== location.origin) {
    img.setAttribute("src", url.href);
    return;
  }
  if (!INLINE_UPLOAD.test(url.pathname) || url.search) return imageToAlt(img);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error(blob.type);
    img.setAttribute(
      "src",
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      })
    );
  } catch {
    // Its console address would be a dead link once the server is gone.
    imageToAlt(img);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// The document as its own web page: drawn through the same markdown path the
// tab uses, so what is saved is what was on screen, minus the page's controls.
export async function downloadDocHtml(doc) {
  const title = doc.title || "Document";
  const body = el("div");
  for (const b of doc.blocks || []) {
    const box = el("div", "block " + (b.state || "settled"));
    if (b.state === "assumed") box.appendChild(el("span", "block-tag", "Assumed for now, still open"));
    if (b.state === "draft") box.appendChild(el("span", "block-tag", "Draft"));
    box.appendChild(blockBody(b));
    body.appendChild(box);
  }
  // Copy buttons only work inside the console.
  for (const n of body.querySelectorAll(".md-copy")) n.remove();
  // Images the console serves would be dead links once the server is gone, so
  // they travel inside the file. One that will not load becomes its alt text.
  await Promise.all([...body.querySelectorAll("img")].map(inlineImage));
  const saved = new Date().toLocaleString();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${DOC_HTML_CSS}</style>
</head>
<body>
<main>
<header class="doc-head">
<h1>${escapeHtml(title)}</h1>
<span class="doc-version">v${escapeHtml(doc.version || 1)}</span>
<span class="doc-meta">Saved ${escapeHtml(saved)}</span>
</header>
${doc.note ? `<p class="doc-note">${escapeHtml(doc.note)}</p>\n` : ""}${body.innerHTML}
</main>
</body>
</html>
`;
  saveFile(`${docFileName(doc)}.html`, html, "text/html");
}

// A doc that mirrors a file the agent already wrote needs no download button
// -- the path is the useful thing to show instead of it.
export function docSavedNote(doc) {
  const path = typeof doc.saved === "string" ? doc.saved.trim() : "";
  const note = el("span", "doc-saved", path ? "Saved as " : "Already saved");
  if (path) note.appendChild(el("code", null, path));
  return note;
}
