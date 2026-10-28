// Plan2Code Web Console - the Notebook's tab bar.
//
// Draws #notepad-tabs from a list of { id, name, sent? } and tells screens/notepad.js
// what the person did: pick a tab (onSwitch), reorder with a drag, ask to
// rename (a double-click or F2) or ask to delete (the x beside the name, or the
// Delete key) (onChange). No fetches here: the screen owns every request, and
// notepad.js owns the rules for order.

import { dropTab } from "./notepad.js";
import { el } from "./render.js";

const $ = (id) => document.getElementById(id);

const DRAG_TYPE = "application/x-plan2code-notepad-tab";

/**
 * `onSwitch(id)` runs when a tab is picked. `onChange(event)` runs for
 * `{ type: "order", order, focus }` (a new order to save, focus the moved tab
 * afterwards), `{ type: "rename", id }` and `{ type: "delete", id }`.
 */
export function createTabs({ onSwitch, onChange }) {
  const bar = $("notepad-tabs");
  let tabs = [];
  let activeId = null;
  // The tab being dragged, so only a tab drag lights the drop marks: a picture
  // or text dragged over the bar does nothing.
  let dragging = null;

  // The tab buttons; each sits in a wrapper with its x.
  const buttons = () => Array.from(bar.querySelectorAll(".notepad-tab"));
  const buttonFor = (id) => buttons().find((b) => b.dataset.id === id) || null;
  const ids = () => tabs.map((t) => t.id);

  function clearMarks() {
    for (const b of buttons()) b.classList.remove("is-drop-before", "is-dragging");
    bar.classList.remove("is-drop-end");
  }

  function reorder(order, focus) {
    if (order.join() === ids().join()) return;
    onChange({ type: "order", order, focus });
  }

  function onKey(e, id) {
    const left = e.key === "ArrowLeft";
    if (left || e.key === "ArrowRight") {
      e.preventDefault();
      const list = buttons();
      const at = list.findIndex((b) => b.dataset.id === id);
      const next = list[Math.max(0, Math.min(list.length - 1, at + (left ? -1 : 1)))];
      if (next) next.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const list = buttons();
      (e.key === "Home" ? list[0] : list[list.length - 1])?.focus();
    } else if (e.key === "F2") {
      e.preventDefault();
      onChange({ type: "rename", id });
    } else if (e.key === "Delete") {
      e.preventDefault();
      onChange({ type: "delete", id });
    }
  }

  function tabButton(tab) {
    const active = tab.id === activeId;
    const b = el("button", "notepad-tab", tab.name);
    b.type = "button";
    b.id = "notepad-tab-" + tab.id;
    b.dataset.id = tab.id;
    b.title = tab.name;
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", active ? "true" : "false");
    b.tabIndex = active ? 0 : -1;
    b.draggable = true;
    b.addEventListener("click", () => onSwitch(tab.id));
    b.addEventListener("dblclick", () => onChange({ type: "rename", id: tab.id }));
    b.addEventListener("keydown", (e) => onKey(e, tab.id));
    b.addEventListener("dragstart", (e) => {
      dragging = tab.id;
      e.dataTransfer.setData(DRAG_TYPE, tab.id);
      e.dataTransfer.effectAllowed = "move";
      b.classList.add("is-dragging");
    });
    b.addEventListener("dragend", () => {
      dragging = null;
      clearMarks();
    });
    // The x is a button of its own beside the name, so the tab's text stays
    // its name and a double-click or a drag on the name never reaches it.
    const x = el("button", "notepad-tab-x", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Delete " + tab.name);
    x.title = "Delete tab";
    x.tabIndex = active ? 0 : -1;
    x.addEventListener("click", () => onChange({ type: "delete", id: tab.id }));
    const wrap = el("div", "notepad-tabwrap");
    wrap.setAttribute("role", "presentation");
    wrap.append(b);
    // A tab sent from the dashboard wears a small badge after its name, outside
    // the button so a long name's ellipsis never cuts it; the button's name
    // says it for a screen reader.
    if (tab.sent) {
      b.setAttribute("aria-label", tab.name + ", sent");
      const badge = el("span", "notepad-sent-badge", "sent");
      badge.setAttribute("aria-hidden", "true");
      wrap.append(badge);
    }
    wrap.append(x);
    wrap.addEventListener("dragover", (e) => {
      if (dragging === null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      clearMarks();
      if (tab.id !== dragging) b.classList.add("is-drop-before");
    });
    wrap.addEventListener("drop", (e) => {
      if (dragging === null) return;
      e.preventDefault();
      e.stopPropagation();
      const id = dragging;
      dragging = null;
      clearMarks();
      reorder(dropTab(ids(), id, tab.id), id);
    });
    return wrap;
  }

  // Dropping on the empty part of the bar moves the tab to the end.
  bar.addEventListener("dragover", (e) => {
    if (dragging === null || e.target !== bar) return;
    e.preventDefault();
    clearMarks();
    bar.classList.add("is-drop-end");
  });
  bar.addEventListener("drop", (e) => {
    if (dragging === null || e.target !== bar) return;
    e.preventDefault();
    const id = dragging;
    dragging = null;
    clearMarks();
    reorder(dropTab(ids(), id, null), id);
  });

  return {
    // Rebuilds the bar. Focus stays on the same tab across the redraw.
    draw(list, active) {
      const had = document.activeElement;
      const focusId = had && bar.contains(had) && had.dataset ? had.dataset.id : null;
      tabs = Array.isArray(list) ? list : [];
      activeId = tabs.some((t) => t.id === active) ? active : null;
      bar.replaceChildren(...tabs.map(tabButton));
      // With no current tab one still needs to be reachable by Tab.
      if (activeId === null && tabs.length) buttons()[0].tabIndex = 0;
      if (focusId) buttonFor(focusId)?.focus();
      const empty = tabs.length === 0;
      $("notepad-empty").hidden = !empty;
      $("notepad-body").hidden = empty;
      // A long row scrolls the current tab into view.
      buttonFor(activeId)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    },
    focusTab(id) {
      buttonFor(id)?.focus();
    },
  };
}
