// Plan2Code Web Console - the User Preferences dialog: its tabs, the one way
// to open and close it, the Saved mark, Back to default for the tab on screen
// and the prompt that stops an unsaved agent edit being lost.

import { onSwatchSaved, renderSwatches, resetLooks, saveLooks } from "../looks.js";
import { PREFS_TABS, prefsOpenTab, prefsResetScope } from "../prefs.js";
import { wireTabs } from "../tabs.js";
import { el, lightDismiss } from "../render.js";
import { hooks, redraw } from "../state.js";

const $ = (id) => document.getElementById(id);

let prefsTabs = null;

// Back to default only where the tab has looks to reset.
function showResetFor(id) {
  $("looks-reset").hidden = prefsResetScope(id) === null;
}

// The small mark at the top right of a fieldset, level with its legend:
// "Saved", fading, or the error in its place, kept until that fieldset saves
// again. `result` is what saveLooks() resolves, or a Promise of it; a `text`
// in it replaces the word Saved.
const markTimers = new WeakMap();

function clearMark(mark) {
  clearTimeout(markTimers.get(mark));
  if (mark.classList.contains("is-saved")) mark.textContent = "";
}

export async function markSaved(fieldset, result) {
  if (!fieldset) return;
  let mark = fieldset.querySelector(":scope > .prefs-saved");
  if (!mark) {
    mark = el("span", "prefs-saved");
    mark.setAttribute("role", "status");
    // Gone after the fade, or after the same time when motion is reduced and
    // no animation runs to say so (the timer below).
    mark.addEventListener("animationend", () => clearMark(mark));
    fieldset.appendChild(mark);
  }
  const { ok, error, text } = (await result) || { ok: true };
  // A newer save owns the mark: an earlier one's timer must not blank it.
  clearTimeout(markTimers.get(mark));
  mark.classList.remove("is-saved", "error");
  // Restart the fade when the same fieldset saves twice in a row.
  void mark.offsetWidth;
  if (ok) {
    mark.textContent = text || "Saved";
    mark.classList.add("is-saved");
    markTimers.set(mark, setTimeout(() => clearMark(mark), 2200));
  } else {
    mark.textContent = error || "Could not save.";
    mark.classList.add("error");
  }
}

// Every way in: the gear, the dashboard's Set up preferences, or a caller
// naming the tab it wants. Agents and models load each time it opens.
export function openPrefs(tab) {
  renderSwatches();
  hooks.loadAgentsView();
  prefsTabs.select(prefsOpenTab(tab));
  $("looks-modal").showModal();
  $("prefs-tab-" + prefsTabs.current()).focus();
}

// The unsaved prompt on screen: { resolve, promise, from }, or null. `from`
// is what had focus when it asked (the tab, Close, Back to summary, a field).
let asking = null;

// Everything in the dialog but the prompt, kept out of reach while it asks.
const behindPrompt = () => [$("looks-title"), $("looks-modal").querySelector(".prefs-body"), $("looks-modal").querySelector(".modal-actions")];

function endAsking(go) {
  $("prefs-unsaved").hidden = true;
  for (const node of behindPrompt()) node.inert = false;
  const { resolve, from } = asking;
  asking = null;
  // Keep editing (or a failed Save) goes back into the form; going on hands
  // focus back to what asked, so the action it carries on with owns it.
  if (!go) hooks.focusOpen();
  else if (from && from.isConnected && !from.closest("[hidden]")) from.focus();
  resolve(go);
}

// Before anything leaves an agent form with an unsaved edit (Close, Esc, a
// backdrop click, another tab, Back to summary): Save, Discard or Keep
// editing, asked inside the dialog. Resolves true when it may go on.
export function confirmUnsaved() {
  if (!hooks.hasUnsaved()) return Promise.resolve(true);
  if (asking) return asking.promise;
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  asking = { resolve, promise, from: document.activeElement };
  $("prefs-unsaved-name").textContent = hooks.unsavedName();
  for (const node of behindPrompt()) node.inert = true;
  $("prefs-unsaved").hidden = false;
  $("prefs-unsaved-save").disabled = false;
  $("prefs-unsaved-save").focus();
  return promise;
}

// Plain true while nothing is unsaved, so a tab switch or a close happens in
// this same tick.
const guard = () => (hooks.hasUnsaved() || asking ? confirmUnsaved() : true);

async function closePrefs() {
  if (await guard()) $("looks-modal").close();
}

function wireUnsaved() {
  const box = el("div", "prefs-unsaved");
  box.id = "prefs-unsaved";
  box.hidden = true;
  box.setAttribute("role", "alertdialog");
  box.setAttribute("aria-labelledby", "prefs-unsaved-title");
  box.setAttribute("aria-describedby", "prefs-unsaved-text");
  const inner = el("div", "prefs-unsaved-box");
  const title = el("h3", null, "Unsaved changes");
  title.id = "prefs-unsaved-title";
  const text = el("p");
  text.id = "prefs-unsaved-text";
  const name = el("strong");
  name.id = "prefs-unsaved-name";
  text.append("You have unsaved changes to ", name, ".");
  const save = el("button", "btn small primary", "Save");
  save.type = "button";
  save.id = "prefs-unsaved-save";
  const discard = el("button", "btn small ghost", "Discard");
  discard.type = "button";
  const keep = el("button", "btn small ghost", "Keep editing");
  keep.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    const ok = await hooks.saveOpen();
    save.disabled = false;
    if (asking) endAsking(ok);
  });
  discard.addEventListener("click", () => {
    hooks.discardOpen();
    endAsking(true);
  });
  keep.addEventListener("click", () => endAsking(false));
  const actions = el("div", "prefs-unsaved-actions");
  actions.append(save, discard, keep);
  inner.append(title, text, actions);
  box.append(inner);
  $("looks-modal").append(box);
}

export function wirePrefs() {
  const dlg = $("looks-modal");
  wireUnsaved();
  lightDismiss(dlg, guard);
  $("looks-done").addEventListener("click", closePrefs);
  // Esc: held while a form has an unsaved edit, and Keep editing while the prompt asks.
  dlg.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (asking) {
      e.preventDefault();
      endAsking(false);
    } else if (hooks.hasUnsaved()) {
      e.preventDefault();
      closePrefs();
    }
  });
  dlg.addEventListener("cancel", (e) => {
    if (!asking && !hooks.hasUnsaved()) return;
    e.preventDefault();
    if (!asking) closePrefs();
  });
  hooks.wireAgentsView();
  prefsTabs = wireTabs({
    tabs: PREFS_TABS,
    list: $("prefs-tabs"),
    panels: $("prefs-panels"),
    prefix: "prefs",
    tabClass: "prefs-tab",
    beforeSelect: () => guard(),
    // The hint describes the tab rather than naming it, so a screen reader's
    // tab name stays the label, at any width.
    renderTab: (t, btn) => {
      const hint = el("span", "prefs-tab-hint", t.hint);
      hint.id = "prefs-hint-" + t.id;
      hint.setAttribute("aria-hidden", "true");
      btn.append(el("span", "prefs-tab-label", t.label), hint);
      btn.setAttribute("aria-describedby", hint.id);
    },
    onSelect: (id) => {
      showResetFor(id);
      $("looks-modal").querySelector(".prefs-body").scrollTop = 0;
    },
  });
  $("btn-looks").addEventListener("click", () => openPrefs());
  $("looks-reset").addEventListener("click", () => {
    const tab = prefsTabs.current();
    const keys = prefsResetScope(tab);
    if (!keys) return;
    resetLooks(keys);
    const saved = saveLooks();
    redraw();
    markSaved($("prefs-panel-" + tab).querySelector("fieldset"), saved);
  });
  onSwatchSaved((saved) => markSaved($("looks-swatches").closest("fieldset"), saved));
}
