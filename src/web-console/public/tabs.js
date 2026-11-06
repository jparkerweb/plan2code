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
export function wireTabs({ tabs, list, panels, prefix, tabClass, renderTab, beforeSelect, onSelect }) {
  const tabId = (id) => `${prefix}-tab-${id}`;
  const panelId = (id) => `${prefix}-panel-${id}`;
  let selected = null;

  for (const t of tabs) {
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

  list.addEventListener("keydown", (e) => {
    const current = tabs.findIndex((t) => tabId(t.id) === e.target.id);
    if (current < 0) return;
    const n = tabKeyTarget(e.key, current, tabs.length);
    if (n < 0) return;
    e.preventDefault();
    select(tabs[n].id, { focus: true });
  });

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

  return { select, current: () => selected };
}
