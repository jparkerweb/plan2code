// Plan2Code Web Console - the agent-less setup screen: pick or install an
// agent, then hand the session to it. Only defines.
//
// `plan2code` opens this page when no agent can run. The list it draws is the
// same agents view User Preferences drives (mountAgentsView, handed in by
// core.js because a screen never imports a screen), in its "setup" mode: a
// row per agent with its found state and the one thing to do about it.
// Start posts the pick as a session action the waiting launcher collects;
// the new agent's console then calls /handover, which sends this page the
// `move` event that carries it across. The grace line only shows if that
// move never comes.

import { agentFound, framed } from "../app-bridge.js";
import { el } from "../render.js";
import { hooks, page, redraw, saveNow } from "../state.js";

const $ = (id) => document.getElementById(id);

// The screen, its mounted agents view, and the start it is waiting on. All
// module-level because renderMain clears the column every pass: re-attaching
// the SAME root keeps the DOM, the open form and every typed character.
let root = null;
let view = null;
let moved = false;
let graceTimer = null;
// Once the grace wait has ended the line stays drawn: a redraw rebuilds the
// pane from this flag rather than the element.
let graceShown = false;

// How long the starting pane waits for the `move` event before it points at
// the terminal. Overridable in tests through window.__P2C_SETUP_GRACE_MS.
const GRACE_MS = () => Number(window.__P2C_SETUP_GRACE_MS) || 120000;

// The skill's own Planny acting out "setup", cloned from the template in
// index.html so the drawing stays markup; the dock's Planny is the fallback.
function setupStage() {
  const stage = el("div", "setup-stage");
  const art = $("start-poses")?.content.querySelector('[data-pose="setup"]');
  if (art) stage.appendChild(art.cloneNode(true));
  else {
    const bot = $("planny")?.cloneNode(true);
    if (bot) {
      bot.removeAttribute("id");
      stage.appendChild(bot);
    }
  }
  return stage;
}

// The pick is sent: the launcher turns it into a session that hands this
// tab over. `entry` is the agent row's object ({ id, name, ... }).
async function onStart(entry) {
  const label = entry.name || entry.id;
  page.local.setupStart = { id: entry.id, label, at: Date.now() };
  saveNow();
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: [{ i: "__start", type: "start", agent: entry.id }], reply: "Start with " + label }),
    });
    if (!res.ok) throw new Error("refused");
  } catch {
    // The send never landed, so the wait never starts: put the list back.
    delete page.local.setupStart;
    saveNow();
    hooks.banner("That did not go through, but the console is still up. Nothing was lost, try again.", "warn");
    redraw();
    return;
  }
  redraw();
  armGrace();
}

// The grace wait for the `move` event: the new session should take this tab
// over itself, and only a wait that ends unmoved earns the terminal hint.
function armGrace() {
  clearTimeout(graceTimer);
  graceTimer = setTimeout(() => {
    graceTimer = null;
    if (moved || !page.local.setupStart) return;
    graceShown = true;
    for (const note of document.querySelectorAll(".setup-no-page, .setup-back")) note.hidden = false;
  }, GRACE_MS());
}

// The `move` event reached the page (core.js follows the url itself); this
// only stands the grace wait down so the hint can never appear mid-handover.
export function setupMoved(url) {
  moved = true;
  clearTimeout(graceTimer);
  graceTimer = null;
}

// The pick-list pane, built once and re-attached every render. mountAgents
// is core.js's copy of mountAgentsView (a screen never imports a screen), so
// a bare import under a test simply leaves the list unmounted.
function buildRoot(mountAgents) {
  const box = el("div", "setup-screen");
  box.appendChild(setupStage());
  box.appendChild(el("p", "card-kicker", "Agent setup"));
  box.appendChild(el("h2", null, "No agent yet"));
  box.appendChild(
    el(
      "p",
      "help",
      "Plan2Code runs your AI agent for you, but it could not find one on this computer. Pick one below, or install one and press Check again."
    )
  );
  const agents = el("div", "setup-agents");
  box.appendChild(agents);
  const actions = el("div", "setup-actions");
  const again = el("button", "btn small", "Check again");
  again.type = "button";
  again.addEventListener("click", () => view?.load());
  actions.appendChild(again);
  box.appendChild(actions);
  if (mountAgents) {
    // The setup page has no unsaved prompt of its own: picking a row is
    // always free. The pick itself, not the dialog, is what can be lost.
    view = mountAgents(agents, {
      mode: "setup",
      // A getter, not a snapshot: use-path on the asked-for built-in rewrites
      // state.setup.forCli to the saved id, and the Start gate must see it.
      forCli: () => (page.S && page.S.setup && page.S.setup.forCli) || null,
      // In the app's window there is no waiting launcher to Start for: the
      // app picks the found agent on its own launch card instead, and hears
      // of it through agent-found.
      onStart: framed() ? null : onStart,
      onFound: framed() ? (entry) => agentFound(entry.id) : null,
      confirmUnsaved: () => Promise.resolve(true),
    });
    view.wire();
    view.load();
  }
  return box;
}

// The waiting pane: same bones as the starting screens, plus the hint the
// grace timer reveals if the new session never calls back.
function startingPane(started) {
  const pane = el("div", "launching setup-starting");
  pane.appendChild(setupStage());
  pane.appendChild(el("p", "card-kicker", "On it"));
  pane.appendChild(el("h2", "launch-title", `Starting ${started.label}…`));
  pane.appendChild(el("p", "launch-hint", "This page moves to your session the moment it opens. No need to touch anything."));
  const noPage = el("p", "help setup-no-page", `${started.label} did not open a page. Look at the terminal where you ran plan2code.`);
  noPage.hidden = !graceShown;
  pane.appendChild(noPage);
  // A wait that died unmoved should not park the page on "Starting" forever:
  // once the grace hint is up, the way back to the pick list shows beside it.
  const back = el("button", "btn small setup-back", "Show the agent list again");
  back.type = "button";
  back.hidden = !graceShown;
  back.addEventListener("click", () => {
    delete page.local.setupStart;
    graceShown = false;
    saveNow();
    redraw();
  });
  pane.appendChild(back);
  return pane;
}

// The agent-less session's whole main column. The root is persistent rather
// than drawn each pass, so an in-progress form survives every re-render.
export function renderSetup(main, mountAgents) {
  const started = page.local.setupStart;
  if (started) {
    // A reload mid-wait starts the wait over: the move may have gone unheard
    // while the page was down, and the hint is its fallback.
    if (!graceTimer && !moved && !graceShown) armGrace();
    main.appendChild(startingPane(started));
    return;
  }
  if (graceTimer) {
    clearTimeout(graceTimer);
    graceTimer = null;
  }
  if (!root) root = buildRoot(mountAgents);
  main.appendChild(root);
}
