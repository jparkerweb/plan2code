// Plan2Code Web Console - the Help dialog and the first-run Welcome (named so it is never confused with the pure help.js).

import { looksReady, looks, saveLooks } from "../looks.js";
import { page } from "../state.js";
import { isDashboard, finish, agentAdrift } from "../selectors.js";
import { releasesLink, el, copyButton, lightDismiss } from "../render.js";
import { HELP_TABS, helpTabFor, helpKeyTarget } from "../help.js";

const $ = (id) => document.getElementById(id);

// The first dashboard a person ever sees gets a Welcome dialog. Closing it by
// any route (button, Esc, backdrop) saves looks.welcomeSeen, which rides in
// looks.json like every other preference. Waits out the wake-up animation and
// never lands on top of another open dialog.
export function maybeWelcome() {
  if (!looksReady || looks.welcomeSeen === true || !page.S || !isDashboard() || finish() || page.wake) return;
  if (document.querySelector("dialog[open]")) return;
  openWelcome();
}

export function openWelcome() {
  if ($("help-modal").open) $("help-modal").close();
  const slot = $("welcome-bot");
  if (!slot.firstElementChild) {
    const bot = $("planny").cloneNode(true);
    bot.removeAttribute("id");
    bot.setAttribute("class", "planny is-point v1");
    slot.appendChild(bot);
  }
  const dlg = $("welcome-modal");
  if (!dlg.open) dlg.showModal();
  $("welcome-done").focus();
}

// Whether the two halves are actually talking, in the one place someone goes
// when they are asking that question. Written on open rather than kept live,
// because a line that rewrites itself under a reader is worse than a stale one
// they can close and reopen.
function renderAbout() {
  const line = $("about-live");
  line.className = "about-live";
  if (finish()) {
    line.textContent = "Right now: the session is finished, and the command above is all that is left to do.";
  } else if (page.gone) {
    line.classList.add("is-bad");
    line.textContent =
      "Right now: this page cannot reach that program. Either it has stopped, or the machine went to sleep. The link from the terminal will bring it back.";
  } else if (agentAdrift()) {
    line.classList.add("is-bad");
    line.textContent =
      "Right now: this page is fine, but Plan2Code has not checked in for a few minutes. Have a look at the terminal; it may have finished its turn, hit an error, or be waiting on you there. If it is idle, type continue there to wake it.";
  } else {
    line.classList.add("is-good");
    line.textContent = "Right now: both halves are talking to each other.";
  }
}

let helpBuilt = false;

async function renderHelpVersion() {
  const slot = $("help-version");
  try {
    const res = await fetch("/version", { cache: "no-store" });
    const { version } = res.ok ? await res.json() : {};
    slot.replaceChildren(...(version ? [releasesLink("Plan2Code v" + version)] : []));
    slot.hidden = !version;
  } catch {
    slot.hidden = true;
  }
}

const HELP_MOODS = [
  ["point", "Your turn"],
  ["work", "Working"],
  ["happy", "All caught up"],
  ["done", "Done"],
  ["adrift", "Not running"],
  ["gone", "Not connected"],
];

// The help content waits in its <template> until the first time ? is pressed,
// so none of it costs the first paint. The tab buttons come from HELP_TABS.
function buildHelp() {
  const content = $("help-content").content.cloneNode(true);
  const modal = $("help-modal");
  const tabs = $("help-tabs");
  const panels = $("help-panels");
  // In the dialog itself, so every <use href="#hi-..."> resolves.
  modal.appendChild(content.querySelector(".help-icons"));
  for (const panel of content.querySelectorAll("section.help-panel")) panels.appendChild(panel);
  // Tab 3 shows the real Planny in each mood, cloned the way the dashboard's
  // confirm pane does, so the moods can never drift from the drawing.
  const moods = panels.querySelector(".help-moods-row");
  for (const [mood, label] of HELP_MOODS) {
    const bot = $("planny").cloneNode(true);
    bot.removeAttribute("id");
    bot.setAttribute("class", `planny is-${mood} v0 help-mood-bot`);
    bot.setAttribute("aria-hidden", "true");
    const cell = el("div", "help-mood");
    cell.appendChild(bot);
    cell.appendChild(el("span", null, label));
    moods.appendChild(cell);
  }
  for (const row of panels.querySelectorAll("[data-copy]")) {
    const code = row.querySelector("code");
    row.appendChild(copyButton(code.textContent, "btn small handoff-copy", code));
  }
  for (const t of HELP_TABS) {
    const btn = el("button", "help-tab");
    btn.type = "button";
    btn.id = "help-tab-" + t.id;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-controls", "help-panel-" + t.id);
    btn.setAttribute("aria-selected", "false");
    btn.tabIndex = -1;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "help-tab-icon");
    svg.setAttribute("aria-hidden", "true");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#hi-" + t.id);
    svg.appendChild(use);
    btn.appendChild(svg);
    btn.appendChild(el("span", null, t.label));
    btn.addEventListener("click", () => selectHelpTab(t.id));
    tabs.appendChild(btn);
    const panel = panels.querySelector(`section.help-panel[data-tab="${t.id}"]`);
    panel.id = "help-panel-" + t.id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "help-tab-" + t.id);
    panel.tabIndex = 0;
    panel.hidden = true;
  }
  helpBuilt = true;
}

export function selectHelpTab(id) {
  for (const t of HELP_TABS) {
    const on = t.id === id;
    const btn = $("help-tab-" + t.id);
    btn.setAttribute("aria-selected", String(on));
    btn.tabIndex = on ? 0 : -1;
    $("help-panel-" + t.id).hidden = !on;
  }
  $("help-panels").scrollTop = 0;
}

export function openHelp() {
  if (!helpBuilt) buildHelp();
  const id = helpTabFor({
    view: page.view,
    dashboard: isDashboard(),
    gone: page.gone,
    adrift: agentAdrift(),
    finished: !!finish(),
    workflow: page.S && page.S.workflow,
    workspace: $("workspace-modal").open,
    meterRed: page.meterFrame?.level === "red",
  });
  selectHelpTab(id);
  renderAbout();
  renderHelpVersion();
  $("help-modal").showModal();
  $("help-tab-" + id).focus();
}

// Help opened straight on one topic, when Help has that topic; otherwise it
// stays wherever openHelp() landed.
export function openHelpOn(id) {
  openHelp();
  if (!HELP_TABS.some((t) => t.id === id)) return;
  selectHelpTab(id);
  $("help-tab-" + id).focus();
}

// Help's and Welcome's buttons and keys, and the Workspace dialog's link to Help.
export function wireHelp() {
  $("workspace-help").addEventListener("click", openHelp);
  lightDismiss($("help-modal"));
  lightDismiss($("welcome-modal"));

  $("welcome-done").addEventListener("click", () => $("welcome-modal").close());
  $("welcome-modal").addEventListener("close", () => {
    if (looks.welcomeSeen !== true) {
      looks.welcomeSeen = true;
      saveLooks();
    }
    $("btn-about").focus();
  });
  $("help-panels").addEventListener("click", (e) => {
    if (e.target.closest && e.target.closest('[data-action="welcome"]')) openWelcome();
  });

  $("btn-about").addEventListener("click", () => {
    openHelp();
  });
  $("help-done").addEventListener("click", () => $("help-modal").close());
  // Opened from inside the Workspace dialog, focus goes back there.
  $("help-modal").addEventListener("close", () =>
    ($("workspace-modal").open ? $("workspace-help") : $("btn-about")).focus()
  );
  $("help-modal").addEventListener("keydown", (e) => {
    // The page-wide Ctrl/Cmd+Enter already stands down while any dialog is open;
    // this keeps the key inside Help as well.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!e.target.classList || !e.target.classList.contains("help-tab")) return;
    const current = HELP_TABS.findIndex((t) => "help-tab-" + t.id === e.target.id);
    const n = helpKeyTarget(e.key, current, HELP_TABS.length);
    if (n < 0) return;
    e.preventDefault();
    selectHelpTab(HELP_TABS[n].id);
    $("help-tab-" + HELP_TABS[n].id).focus();
  });
}
