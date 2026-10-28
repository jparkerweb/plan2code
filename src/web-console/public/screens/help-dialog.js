// Plan2Code Web Console - the Help dialog and the first-run Welcome (named so it is never confused with the pure help.js).

import { looksReady, looks, saveLooks } from "../looks.js";
import { page } from "../state.js";
import { isDashboard, finish, agentAdrift } from "../selectors.js";
import { releasesLink, el, copyButton, lightDismiss } from "../render.js";
import { HELP_TABS, helpTabFor, helpKeyTarget } from "../help.js";
import { CATALOG_GROUPS, SKILL_CATALOG } from "../answers.js";

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

// The same "finish the step and start fresh" tip the meter popover and the
// dashboard's own red banner give, worded for the app's New Session button there.
function renderWelcomeRefreshHelp() {
  if (!page.inApp) return;
  $("welcome-refresh-text").textContent = "Once the session meter passes half, finish the step and press New Session at the top of the window.";
}

export function openWelcome() {
  renderWelcomeRefreshHelp();
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
    line.textContent = page.inApp
      ? "Right now: this page cannot reach that program. Either it has stopped, or the machine went to sleep. The app's own bar notices and offers to reconnect it."
      : "Right now: this page cannot reach that program. Either it has stopped, or the machine went to sleep. The link from the terminal will bring it back.";
  } else if (agentAdrift()) {
    line.classList.add("is-bad");
    line.textContent = page.inApp
      ? "Right now: this page is fine, but Plan2Code has not checked in for a few minutes. Have a look at the terminal panel; it may have finished its turn, hit an error, or be waiting on you there. If it is idle, press continue in the line beside Planny to wake it."
      : "Right now: this page is fine, but Plan2Code has not checked in for a few minutes. Have a look at the terminal; it may have finished its turn, hit an error, or be waiting on you there. If it is idle, type continue there to wake it.";
  } else {
    line.classList.add("is-good");
    line.textContent = "Right now: both halves are talking to each other.";
  }
}

// Under the app, the dashboard's own UPDATE AVAILABLE banner never shows (the
// app's bar already nags about a skills/app mismatch and updates in one
// click, see docs/desktop-app.md), so this line would describe a banner the
// reader can never find and send them to a terminal the app's own button
// already makes unnecessary. Patched once, the first time Help opens, since
// page.inApp never changes for the session's life.
function renderUpdateHelp() {
  if (!page.inApp) return;
  $("help-update-text").replaceChildren(
    "When the app and the installed skills fall out of step, its own top bar says so and offers ",
    el("strong", null, "Update skills"),
    ", which brings them level in one click, no terminal needed."
  );
}

// Same reasoning as ending.js's own close guide: the command still works
// under the app (its terminal panel runs the agent itself), just not in "a
// new conversation" that does not exist there.
function renderFinishingHelp() {
  if (!page.inApp) return;
  $("help-finishing-command-text").replaceChildren(
    "Press ",
    el("strong", null, "Copy"),
    ", then paste the command into the terminal panel below. When the next step is another Plan2Code step, the command already ends with ",
    el("code", null, "--web"),
    ", which asks Plan2Code to open this page again, so you carry on here rather than in the terminal panel."
  );
}

// Two more Finishing explainers that describe behavior already reworded for
// the app elsewhere (renderDashboardOffer's gone branch, the meter-fresh
// popover): kept in sync here so Help never teaches the classic-only version
// of something the screen itself no longer does under the app.
function renderFinishingDashboardHelp() {
  if (!page.inApp) return;
  $("help-finishing-dashboard-text").replaceChildren(
    "A finished screen (never a paused one) has a ",
    el("strong", null, "Back to the dashboard"),
    " button. It turns this page back into the cards, in the same conversation, so the next step starts right here. Plan2Code listens for it for as long as the session is open. Once the session has closed, the app's own bar notices and offers to reconnect it, no command needed."
  );
}

function renderFinishingContinueHelp() {
  if (!page.inApp) return;
  $("help-finishing-continue-text").replaceChildren(
    "When the next step is another Plan2Code step, the Next step block also has a ",
    el("strong", null, "Continue here"),
    " button. It starts that step in this same conversation, the way a dashboard card would, with this page turning into the new step. It goes away once the session meter is red, because a long conversation is the reason to start a fresh one: press New Session at the top of the window instead."
  );
}

// The Troubleshooting tab's own "getting a new link" recovery flow: classic
// only, since it ends with a command that prints a fresh browser link. Under
// the app there is no link to print or open: the bar's next-step slot and its
// Reconnect the console (app.js) already notice and bring the page back.
function renderStuckReconnectHelp() {
  if (!page.inApp) return;
  $("help-stuck-not-connected-ref").textContent = "the app's own bar notices and offers to reconnect it";
  $("help-stuck-table-reconnect-text").textContent = "The app's own bar notices and offers Reconnect the console.";
  $("help-stuck-reconnect-title").textContent = "Reconnecting";
  $("help-stuck-reconnect-text").textContent =
    "To get it back, press Reconnect the console in the app's own bar (it tries on its own first). Everything you typed, sent or not, is still there.";
  // Not just .hidden: .handoff-command's own display:flex outranks the
  // default [hidden] rule, so the element comes out of the DOM instead.
  $("help-stuck-reconnect-command").remove();
}

// A handoff's "Copy for a new conversation" button is for carrying work to
// a wholly separate agent (another machine, another terminal); under the app
// that still works, but "a new conversation" is this one's own wording for
// what New Session does, so name that instead to avoid sounding like a
// second, missing feature.
function renderHandoffCopyHelp() {
  if (!page.inApp) return;
  $("help-handoff-copy-text").replaceChildren(
    "A ",
    el("strong", null, "Handoff"),
    " is a note a step left when you stopped it with a handoff. It shows as a dashed chip after the specs. Pick one and the cards give way to a preview with its Next task and four buttons: ",
    el("strong", null, "Pick it up here"),
    " carries on in the same step and spec, ",
    el("strong", null, "Read it all"),
    " shows the whole note, ",
    el("strong", null, "Copy for another session"),
    " puts a ready prompt on the clipboard, for pasting into the terminal panel after a New Session or anywhere else you carry the work, and ",
    el("strong", null, "Delete"),
    " removes it. A picked-up handoff drops off the list, but stays in ",
    el("code", null, "~/.plan2code/handoffs/"),
    " until the 30-day sweep."
  );
}

// The Ask tab's "carry away" prompt is meant to start a genuinely fresh,
// separate task: under the app that means pasting it into the terminal panel
// after a New Session, not into "a new conversation" that does not exist there.
function renderAskPromptHelp() {
  if (!page.inApp) return;
  $("help-ask-prompt-text").replaceChildren(
    "When what you ask is really a new task, or you ask for a prompt, the answer ends with a ready-to-paste prompt in a box with a ",
    el("strong", null, "Copy"),
    " button. Press New Session for a clean context, then paste it into the terminal panel: it names the skill to use and the files to read, so nothing said here needs repeating."
  );
}

// Matches ending.js's own renderStopping, which already says "paste into the
// terminal panel" under the app instead of "a new conversation".
// The Planny-poses catalog's own "Done" entry said the same "close the tab":
// there is no tab under the app, only the one window.
function renderPlannyDoneHelp() {
  if (!page.inApp) return;
  $("help-planny-done-text").textContent = "A green star and both arms up. The session is finished. You can close the window.";
}

function renderFinishingStopHelp() {
  if (!page.inApp) return;
  $("help-finishing-stop-text").replaceChildren(
    el("strong", null, "Stop session"),
    ", at the top, ends the session and saves your place. Any answers you have ready go with it, and Plan2Code gives you a command to pick up where you left off, to paste into the terminal panel."
  );
}

// A phrase that reads differently under the app carries its app wording in
// `data-app`, and the browser wording stays in the markup as it was. Whole
// paragraphs that differ are `.for-app` / `.for-browser` siblings instead,
// switched by help.css. Plain text only: anything with markup in it is a pair.
function renderAppWording(root) {
  if (!page.inApp) return;
  for (const node of root.querySelectorAll("[data-app]")) node.textContent = node.getAttribute("data-app");
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
  // The dashboard topic lists the cards from the catalog, grouped and in the
  // dashboard's order, so Help can never name a card the dashboard lacks.
  // A card's help line, when it has one, says more than its blurb.
  const cards = panels.querySelector(".help-cards");
  for (const g of CATALOG_GROUPS) {
    const head = el("p");
    head.appendChild(el("strong", null, g.title));
    const list = el("ul");
    for (const e of SKILL_CATALOG.filter((x) => x.group === g.id)) {
      const li = el("li");
      li.appendChild(el("strong", null, e.title + "."));
      li.appendChild(document.createTextNode(" " + (e.help || e.blurb)));
      list.appendChild(li);
    }
    cards.append(head, list);
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
  if (!helpBuilt) {
    buildHelp();
    renderAppWording($("help-panels"));
    renderUpdateHelp();
    renderFinishingHelp();
    renderFinishingDashboardHelp();
    renderFinishingContinueHelp();
    renderStuckReconnectHelp();
    renderAskPromptHelp();
    renderFinishingStopHelp();
    renderPlannyDoneHelp();
    renderHandoffCopyHelp();
  }
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
