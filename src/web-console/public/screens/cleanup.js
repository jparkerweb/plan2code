// Plan2Code Web Console - User Preferences, the Cleanup section on the System tab.

import { formatBytes } from "../answers.js";
import { el } from "../render.js";
import { postJson } from "../net.js";

const $ = (id) => document.getElementById(id);

// Cleanup: the server works out what in ~/.plan2code is not needed and
// shows it first; Delete these sends back only the ids it was shown, and the
// server re-checks every one before removing it.
let cleanupFound = null;

// Bumped by every scan, delete and reset: a response from an older one is
// dropped, so a scan still in flight when Preferences closes cannot refill it.
let cleanupGen = 0;

const CLEANUP_SHOWN = 8;

function setCleanupStatus(text, isError) {
  const status = $("cleanup-status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

const CLEANUP_WHERE = { root: "~/.plan2code/", console: "~/.plan2code/console/", completed: "specs--completed/" };

function cleanupLabel(item) {
  if (item.where === "session") return "Session " + item.name;
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

function resetCleanup() {
  cleanupGen++;
  cleanupFound = null;
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
    const row = el("div", "cleanup-row");
    row.append(el("span", null, cleanupLabel(item)), el("span", "cleanup-size", formatBytes(item.bytes)));
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
    return setCleanupStatus(status ? body.error || "Could not look." : "Plan2Code isn't reachable.", true);
  }
  cleanupFound = { items: body.items || [], bytes: body.bytes || 0 };
  renderCleanup();
  // Left in the status line, not cleared: it is the live region, so this is
  // what a screen reader hears when the scan finishes.
  const found = deletable().length;
  const keptCount = cleanupFound.items.length - found;
  const keptNote = keptCount ? ` ${keptCount} old completed ${keptCount === 1 ? "spec is" : "specs are"} kept: git does not track ${keptCount === 1 ? "it" : "them"} as ${keptCount === 1 ? "it stands" : "they stand"}.` : "";
  setCleanupStatus((found ? "Found " + found + (found === 1 ? " item." : " items.") : "Nothing to clean up.") + keptNote, false);
}

async function deleteCleanup() {
  const ids = deletable().map((i) => i.id);
  if (!ids.length) return;
  const gen = ++cleanupGen;
  $("cleanup-delete").disabled = true;
  $("cleanup-scan").disabled = true;
  setCleanupStatus("Deleting…", false);
  const { status, body } = await postJson("/cleanup", { delete: ids });
  if (gen !== cleanupGen) return;
  $("cleanup-delete").disabled = false;
  $("cleanup-scan").disabled = false;
  if (status !== 200 || !body.ok) {
    return setCleanupStatus(status ? body.error || "Could not delete." : "Plan2Code isn't reachable.", true);
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
