// Plan2Code Web Console - User Preferences, the Cleanup section on the System tab.

import { NOT_CONNECTED, agoWords, whenTitle } from "../labels.js";
import { SKILLS } from "../skills.js";
import { formatBytes } from "../answers.js";
import { el } from "../render.js";
import { postJson } from "../net.js";

const $ = (id) => document.getElementById(id);

// Cleanup: the server works out what in ~/.plan2code is not needed and
// shows it first; Delete these sends back only the ids it was shown, and the
// server re-checks every one before removing it.
let cleanupFound = null;

// The ids ticked for deletion. A session or a stray file starts ticked; a
// Notebook (private writing) or a completed spec starts unticked, so deleting
// those is always a choice.
let ticked = new Set();
const startsTicked = (item) => item.where !== "notepad" && item.where !== "completed";

// Bumped by every scan, delete and reset: a response from an older one is
// dropped, so a scan still in flight when Preferences closes cannot refill it.
let cleanupGen = 0;
// True while a delete is on its way: a ticked box must not re-enable Delete.
let cleanupBusy = false;

const CLEANUP_SHOWN = 8;

function setCleanupStatus(text, isError) {
  const status = $("cleanup-status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

const CLEANUP_WHERE = { root: "~/.plan2code/", console: "~/.plan2code/console/", completed: "specs--completed/" };

// "Pathfinder · shop · 6 weeks ago": the skill, the session's title and when it
// was last touched. An older session with no title keeps its folder name.
function sessionLabel(item) {
  const skill = SKILLS.find((s) => s.workflow === item.workflow);
  const age = item.at && !Number.isNaN(Date.parse(item.at)) ? agoWords(Math.max(0, Date.now() - Date.parse(item.at))) : "";
  const parts = item.title ? [skill ? skill.name : "", item.title, age] : ["Session " + item.name, age];
  return parts.filter(Boolean).join(" · ");
}

function cleanupLabel(item) {
  if (item.where === "session") return sessionLabel(item);
  // One notebook is one item, named by the folder it belongs to; its key only
  // when its meta.json is gone.
  if (item.where === "notepad") return "Notebook for " + (item.folder || item.name);
  return CLEANUP_WHERE[item.where] + item.name + (item.kind === "folder" ? "/" : "");
}

function cleanupSummary(items, bytes) {
  const sessions = items.filter((i) => i.where === "session").length;
  const completed = items.filter((i) => i.where === "completed").length;
  const notepads = items.filter((i) => i.where === "notepad").length;
  const strays = items.length - sessions - completed - notepads;
  const parts = [];
  if (sessions) parts.push(sessions + (sessions === 1 ? " old session" : " old sessions"));
  if (completed) parts.push(completed + (completed === 1 ? " old completed spec" : " old completed specs"));
  if (notepads) parts.push(notepads + (notepads === 1 ? " old notebook" : " old notebooks"));
  if (strays) parts.push(strays + (strays === 1 ? " stray file or folder" : " stray files and folders"));
  return parts.join(", ") + " · " + formatBytes(bytes);
}

// A completed spec git does not track as it stands is never deleted (the
// server refuses it), so it is listed apart as kept, out of the total and out
// of what Delete these sends.
const keptBack = (item) => item.where === "completed" && item.tracked === false;
const deletable = () => ((cleanupFound && cleanupFound.items) || []).filter((i) => !keptBack(i));

// What Delete will do, said on the button: the ticked items and their size.
function tickedItems() {
  return deletable().filter((i) => ticked.has(i.id));
}

function paintDeleteButton() {
  const chosen = tickedItems();
  const button = $("cleanup-delete");
  const bytes = chosen.reduce((n, i) => n + (i.bytes || 0), 0);
  button.textContent = chosen.length
    ? `Delete ${chosen.length} ${chosen.length === 1 ? "item" : "items"} · ${formatBytes(bytes)}`
    : "Nothing ticked";
  button.disabled = cleanupBusy || !chosen.length;
}

function resetCleanup() {
  cleanupGen++;
  cleanupFound = null;
  ticked = new Set();
  $("cleanup-list").replaceChildren();
  $("cleanup-delete").hidden = true;
  $("cleanup-delete").disabled = false;
  $("cleanup-scan").disabled = false;
  setCleanupStatus("", false);
}

function renderCleanup() {
  const list = $("cleanup-list");
  list.replaceChildren();
  const all = (cleanupFound && cleanupFound.items) || [];
  const items = deletable();
  const kept = all.filter(keptBack);
  $("cleanup-delete").hidden = !items.length;
  const rows = (some) => some.map((item) => {
    const row = el("label", "cleanup-row");
    const box = el("input");
    box.type = "checkbox";
    box.checked = ticked.has(item.id);
    box.addEventListener("change", () => {
      if (box.checked) ticked.add(item.id);
      else ticked.delete(item.id);
      paintDeleteButton();
    });
    const label = el("span", null, cleanupLabel(item));
    if (item.at) label.title = whenTitle(item.at);
    row.append(box, label, el("span", "cleanup-size", formatBytes(item.bytes)));
    return row;
  });
  if (items.length) {
    const bytes = Math.max(0, cleanupFound.bytes - kept.reduce((n, i) => n + (i.bytes || 0), 0));
    list.append(el("p", "cleanup-summary", cleanupSummary(items, bytes)), ...rows(items.slice(0, CLEANUP_SHOWN)));
    if (items.length > CLEANUP_SHOWN) {
      const more = el("details", "cleanup-more");
      more.append(el("summary", null, (items.length - CLEANUP_SHOWN) + " more"), ...rows(items.slice(CLEANUP_SHOWN)));
      list.appendChild(more);
    }
  }
  paintDeleteButton();
  for (const item of kept) {
    const row = el("div", "cleanup-row cleanup-kept");
    row.append(el("span", null, cleanupLabel(item)), el("span", "cleanup-size", "kept: git does not track it as it stands"));
    list.appendChild(row);
  }
}

async function scanCleanup() {
  const gen = ++cleanupGen;
  $("cleanup-scan").disabled = true;
  $("cleanup-delete").disabled = true;
  setCleanupStatus("Looking…", false);
  const { status, body } = await postJson("/cleanup", { scan: true });
  if (gen !== cleanupGen) return;
  $("cleanup-scan").disabled = false;
  $("cleanup-delete").disabled = false;
  if (status !== 200 || !body.ok) {
    cleanupFound = null;
    renderCleanup();
    return setCleanupStatus(status ? body.error || "Could not look." : NOT_CONNECTED, true);
  }
  cleanupFound = { items: body.items || [], bytes: body.bytes || 0 };
  ticked = new Set(cleanupFound.items.filter((i) => startsTicked(i)).map((i) => i.id));
  renderCleanup();
  // Left in the status line, not cleared: it is the live region, so this is
  // what a screen reader hears when the scan finishes.
  const found = deletable().length;
  const keptCount = cleanupFound.items.length - found;
  const keptNote = keptCount ? ` ${keptCount} old completed ${keptCount === 1 ? "spec is" : "specs are"} kept: git does not track ${keptCount === 1 ? "it" : "them"} as ${keptCount === 1 ? "it stands" : "they stand"}.` : "";
  setCleanupStatus((found ? "Found " + found + (found === 1 ? " item." : " items.") : "Nothing to clean up.") + keptNote, false);
}

async function deleteCleanup() {
  const ids = tickedItems().map((i) => i.id);
  if (!ids.length) return;
  const gen = ++cleanupGen;
  $("cleanup-delete").disabled = true;
  $("cleanup-scan").disabled = true;
  setCleanupStatus("Deleting…", false);
  cleanupBusy = true;
  const { status, body } = await postJson("/cleanup", { delete: ids }).finally(() => {
    cleanupBusy = false;
  });
  if (gen !== cleanupGen) return;
  $("cleanup-scan").disabled = false;
  paintDeleteButton();
  if (status !== 200 || !body.ok) {
    return setCleanupStatus(status ? body.error || "Could not delete." : NOT_CONNECTED, true);
  }
  const removed = (body.removed || []).length;
  const failed = (body.failed || []).length;
  // A completed spec git does not track is refused, and the server says why.
  const refused = (body.refused || []).length;
  // The server re-checks every id and keeps anything that changed since the
  // scan; say so, rather than let a count that came up short pass unremarked.
  const asked = ids.length;
  const kept = Math.max(0, asked - removed - failed - refused);
  cleanupFound = null;
  ticked = new Set();
  renderCleanup();
  const done = removed ? "Deleted " + removed + (removed === 1 ? " item" : " items") + " · " + formatBytes(body.bytes) + " freed." : "Nothing was deleted.";
  const keptLine = kept ? ` ${kept} ${kept === 1 ? "was" : "were"} kept because ${kept === 1 ? "it" : "they"} changed since the scan.` : "";
  const refusalLine = refused && body.refusal ? " " + body.refusal : "";
  setCleanupStatus((failed ? done + " " + failed + " could not be removed." : done) + keptLine + refusalLine, Boolean(failed || refused));
}

// The Cleanup section's buttons, and starting over whenever Preferences closes.
export function wireCleanup() {
  $("cleanup-scan").addEventListener("click", scanCleanup);
  $("cleanup-delete").addEventListener("click", deleteCleanup);
  $("looks-modal").addEventListener("close", resetCleanup);
}
