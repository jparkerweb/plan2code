// Plan2Code Web Console - tabs shared by Help and User Preferences.
//
// The WAI-ARIA tabs pattern over panels built once in the markup and shown or
// hidden: role="tab" buttons linked to their role="tabpanel", roving
// tabindex, automatic activation, arrow keys plus Home and End. No DOM access
// at module scope: `node --test` imports tabKeyTarget from here.

// The tab index a key moves to, or -1 when the key is not a tab key.
export function tabKeyTarget(key, index, count) {
  switch (key) {
    case "ArrowDown":
    case "ArrowRight":
      return (index + 1) % count;
    case "ArrowUp":
    case "ArrowLeft":
      return (index - 1 + count) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return -1;
  }
}

// Below Help's breakpoint the side list becomes a strip across the top.
const NARROW = "(max-width: 720px)";

// `tabs` is [{ id, label, hint? }], `list` the role="tablist" element and
// `panels` the element holding one child per tab marked data-tab="<id>".
// `beforeSelect(from, to)` returning false, or a Promise of false, holds the
// switch; `onSelect(id)` runs after one.
export function wireTabs({ tabs, list, panels, prefix, tabClass, renderTab, beforeSelect, onSelect, groupStart, groupClass = "tab-group" }) {
  const tabId = (id) => `${prefix}-tab-${id}`;
  const panelId = (id) => `${prefix}-panel-${id}`;
  let selected = null;

  for (const t of tabs) {
    // A group heading: text only, never a tab stop, so the arrow keys skip it
    // (they walk `tabs`, not the list's children).
    const heading = groupStart ? groupStart(t.id) : null;
    if (heading) {
      const head = document.createElement("div");
      head.className = groupClass;
      head.setAttribute("role", "presentation");
      head.dataset.before = t.id;
      head.textContent = heading;
      list.appendChild(head);
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = tabClass;
    btn.id = tabId(t.id);
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", panelId(t.id));
    btn.setAttribute("aria-selected", "false");
    btn.tabIndex = -1;
    if (renderTab) renderTab(t, btn);
    else {
      const label = document.createElement("span");
      label.textContent = t.label;
      btn.appendChild(label);
    }
    btn.addEventListener("click", () => select(t.id));
    list.appendChild(btn);
    const panel = panels.querySelector(`[data-tab="${t.id}"]`);
    panel.id = panelId(t.id);
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tabId(t.id));
    panel.tabIndex = 0;
    panel.hidden = true;
  }

  // The tabs a filter has not hidden, in order: what the arrow keys walk.
  const shown = () => tabs.filter((t) => !document.getElementById(tabId(t.id)).hidden);

  list.addEventListener("keydown", (e) => {
    const walk = shown();
    const current = walk.findIndex((t) => tabId(t.id) === e.target.id);
    if (current < 0) return;
    const n = tabKeyTarget(e.key, current, walk.length);
    if (n < 0) return;
    e.preventDefault();
    select(walk[n].id, { focus: true });
  });

  // Hides the tabs `keep(tab)` refuses, and a group heading once none of its
  // tabs is left. Returns how many tabs are still shown. The selected tab's
  // panel stays up either way.
  function filter(keep) {
    let count = 0;
    // One tab stop at a time: the selected tab's, or, when the filter hides it,
    // the first one still shown, so the list stays reachable by keyboard.
    for (const t of tabs) document.getElementById(tabId(t.id)).tabIndex = -1;
    for (const t of tabs) {
      const on = !keep || Boolean(keep(t));
      document.getElementById(tabId(t.id)).hidden = !on;
      if (on) count++;
    }
    // A heading belongs to the run of tabs from its own to the next heading.
    const heads = [...list.querySelectorAll("." + groupClass)];
    heads.forEach((head, i) => {
      const from = tabs.findIndex((t) => t.id === head.dataset.before);
      const next = heads[i + 1] ? tabs.findIndex((t) => t.id === heads[i + 1].dataset.before) : tabs.length;
      head.hidden = !tabs.slice(from, next).some((t) => !document.getElementById(tabId(t.id)).hidden);
    });
    const stop = tabs.find((t) => t.id === selected && !document.getElementById(tabId(t.id)).hidden) || shown()[0];
    if (stop) document.getElementById(tabId(stop.id)).tabIndex = 0;
    return count;
  }

  const narrow = matchMedia(NARROW);
  const orient = () => list.setAttribute("aria-orientation", narrow.matches ? "horizontal" : "vertical");
  orient();
  narrow.addEventListener("change", orient);

  async function select(id, { focus = false } = {}) {
    if (beforeSelect && selected !== null && selected !== id) {
      // Awaited only when it is a Promise, so a plain answer switches in this
      // same tick and a caller can focus the new tab straight after.
      let go = beforeSelect(selected, id);
      if (go && typeof go.then === "function") go = await go;
      if (go === false) {
        // Held: focus stays on the tab still selected.
        if (focus) document.getElementById(tabId(selected)).focus();
        return false;
      }
    }
    for (const t of tabs) {
      const on = t.id === id;
      const btn = document.getElementById(tabId(t.id));
      btn.setAttribute("aria-selected", String(on));
      btn.tabIndex = on ? 0 : -1;
      document.getElementById(panelId(t.id)).hidden = !on;
    }
    selected = id;
    if (onSelect) onSelect(id);
    if (focus) document.getElementById(tabId(id)).focus();
    return true;
  }

  return { select, filter, shown, current: () => selected };
}
