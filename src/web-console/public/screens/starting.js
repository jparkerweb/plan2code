// Plan2Code Web Console - the launching, starting and waiting screens, with Planny's poses; defines only.

import { page, redraw } from "../state.js";
import { el, approvalTip } from "../render.js";
import { startPose, startingHint, staleLaunchFeedback, workflowTitle } from "../answers.js";
import { skillByName } from "../skills.js";
import { agentAdrift, doingNow, docs } from "../selectors.js";

const $ = (id) => document.getElementById(id);

const LAUNCH_QUIPS = [
  "Passing Planny the baton…",
  "Reading the manual…",
  "Polishing the star…",
  "Warming up the engines…",
  "Laying out the good pens…",
  "Consulting the map…",
  "Putting the kettle on…",
  "Rolling out the checklist…",
];

let launchTicker = null;

// Planny flies centre stage: the same drawing as the dock's, cloned so the
// markup stays the single source of him, and the same sky the dock fills.
function flightStage() {
  const stage = el("div", "launch-stage");
  const sky = el("div", "sky launch-sky");
  const r = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 30; i++) {
    const star = el("i", "star" + (i % 6 === 0 ? " hot" : ""));
    const dur = r(3, 9);
    star.style.setProperty("--y", r(2, 98).toFixed(1) + "%");
    star.style.setProperty("--p", r(0, 1).toFixed(3));
    star.style.setProperty("--s", r(1.2, 2.6).toFixed(2) + "px");
    star.style.setProperty("--dur", dur.toFixed(2) + "s");
    star.style.setProperty("--delay", (-r(0, dur)).toFixed(2) + "s");
    sky.appendChild(star);
  }
  stage.appendChild(sky);
  const bot = $("planny").cloneNode(true);
  bot.removeAttribute("id");
  bot.setAttribute("class", "planny is-work v1 launch-planny");
  stage.appendChild(bot);
  return stage;
}

// A skill's own Planny, acting out the skill while it starts and works: the
// pose is cloned from its <template> in index.html, so the drawing stays
// markup and the motion stays in app.css. A skill with none keeps the flight.
function startStage(workflow) {
  const pose = startPose(workflow);
  const art = pose && $("start-poses")?.content.querySelector(`[data-pose="${pose}"]`);
  if (!art) return flightStage();
  const stage = el("div", "launch-stage pose-stage");
  stage.appendChild(art.cloneNode(true));
  return stage;
}

// The pane Planny's stage sits in, for the launching, starting and waiting
// screens alike. A render empties the column, and a stage taken off the page
// restarts every animation in it, which a build posting every few seconds
// (and the heartbeat pulling what it missed) would turn into a stutter. So
// the pane already on screen is reused when the next screen shows the same
// pose: its words are rebuilt around a stage that never leaves the page.
// That is also what carries him from "Starting…" into the work unbroken.
function posePane(main, cls, workflow) {
  const pose = startPose(workflow) || "flight";
  const held = page.heldPose;
  page.heldPose = null;
  if (held && held.dataset.pose === pose) {
    held.className = cls;
    for (const child of [...held.children]) if (!child.classList.contains("launch-stage")) child.remove();
    return held;
  }
  const pane = el("div", cls);
  pane.dataset.pose = pose;
  pane.appendChild(startStage(workflow));
  if (held) main.insertBefore(pane, held);
  else main.appendChild(pane);
  return pane;
}

// The getting-ready screen. The pick is sent and the dashboard agent is
// turning it into a live skill: it resumes this session under the skill's
// workflow, which flips `S.workflow` off "dashboard" and ends this screen
// (adopt() clears `local.launching` on exactly that change).
//
// It is deliberately fun rather than a spinner with a shrug: a launch takes
// a few honest seconds (the skill file is read, the session resumed, the
// first payload composed) and a dead-quiet wait is when people wonder
// whether the click worked. Planny flies, the quips rotate, and after a
// while the hint points at the terminal, which narrates the same hand-off.
export function renderLaunching(main) {
  const l = page.local.launching || {};
  const pane = posePane(main, "launching", l.skill && skillByName(l.skill)?.workflow);

  const stale = staleLaunchFeedback(l.title, agentAdrift());
  pane.appendChild(el("p", "card-kicker", stale ? stale.kicker : "On it"));
  pane.appendChild(el("h2", "launch-title", stale ? stale.title : `Waking up ${l.title || "the next mode"}`));
  pane.appendChild(el("p", "launch-quip", stale ? stale.quip : LAUNCH_QUIPS[0]));
  pane.appendChild(
    el(
      "p",
      "launch-hint",
      stale ? stale.hint : "This page turns into its home the moment it answers. No need to touch anything."
    )
  );
  startLaunchTicker();
}

/* The starting screen: a session is open but the agent has not put anything
   on it yet. It is what the person looks at while the skill reads the
   project, finds its files and composes the first questions, so it gets the
   same flight as a launch rather than a bare spinner, and says which skill
   is on its way. */
const START_QUIPS = [
  "Reading the project…",
  "Checking what is already written down…",
  "Lining up the first questions…",
  "Polishing the star…",
  "Laying out the good pens…",
  "Consulting the map…",
];

function startingElapsed() {
  const since = page.S && page.S.agent ? Date.parse(page.S.agent.since) : NaN;
  return Number.isFinite(since) ? Date.now() - since : 0;
}

function renderStarting(main) {
  const elapsed = startingElapsed();
  const pane = posePane(main, "launching starting", page.S.workflow);
  pane.appendChild(el("p", "card-kicker", "Starting up"));
  pane.appendChild(el("h2", "launch-title", `Starting ${workflowTitle(page.S.workflow)}`));
  pane.appendChild(el("p", "launch-quip", START_QUIPS[Math.floor(elapsed / 2600) % START_QUIPS.length]));
  pane.appendChild(el("p", "launch-hint", startingHint(elapsed)));
  pane.appendChild(approvalTip());
  startLaunchTicker();
}

// The quips rotate on their own clock rather than on render: state frames
// arrive whenever the agent posts, and a waiting screen pinned to them
// would sit on one line for most of the wait. The interval looks the
// elements up fresh each tick, so it survives the screen being rebuilt,
// and it stops itself when neither screen is up any more.
function startLaunchTicker() {
  if (!launchTicker) {
    launchTicker = setInterval(() => {
      const kicker = document.querySelector(".launching .card-kicker");
      const title = document.querySelector(".launch-title");
      const q = document.querySelector(".launch-quip");
      const hint = document.querySelector(".launch-hint");
      const cur = page.local.launching;
      const starting = !cur && document.querySelector(".launching.starting");
      if ((!cur && !starting) || !q) {
        clearInterval(launchTicker);
        launchTicker = null;
        return;
      }
      if (starting) {
        const elapsed = startingElapsed();
        q.textContent = START_QUIPS[Math.floor(elapsed / 2600) % START_QUIPS.length];
        if (hint) hint.textContent = startingHint(elapsed);
        return;
      }
      const elapsed = Date.now() - cur.at;
      const stale = staleLaunchFeedback(cur.title, agentAdrift());
      if (kicker) kicker.textContent = stale ? stale.kicker : "On it";
      if (title) title.textContent = stale ? stale.title : `Waking up ${cur.title || "the next mode"}`;
      q.textContent = stale ? stale.quip : LAUNCH_QUIPS[Math.floor(elapsed / 2600) % LAUNCH_QUIPS.length];
      if (hint) {
        hint.textContent = stale
          ? stale.hint
          : elapsed > 90000
            ? "Still getting ready. Your terminal has the play-by-play if you want to watch it there."
            : "This page turns into its home the moment it answers. No need to touch anything.";
      }
    }, 900);
  }
}

export function renderWaiting(main) {
  const doing = doingNow();
  // Nothing asked and nothing said yet: the session is still starting.
  if (!doing) return renderStarting(main);
  // The same Planny the session started with, still at it: the spinner that
  // stood here said less about what was going on than he does.
  const pane = posePane(main, "waiting-pane", page.S.workflow);
  // A build with nothing to ask yet. Say what is happening and where to
  // watch it, instead of promising questions that may not come for a while.
  const title = el("h2", null, (page.S.headline && page.S.headline.stage) || "Working on it");
  // Once the agent stops answering nothing is turning, so neither is the ring
  // (the adrift watcher redraws this pane on the flip).
  if (!agentAdrift()) {
    const spin = el("span", "spinner tiny waiting-spin");
    spin.setAttribute("aria-hidden", "true");
    title.prepend(spin);
  }
  pane.appendChild(title);
  pane.appendChild(el("p", null, doing));
  const ask = "If Plan2Code needs you, the question appears here on its own.";
  if (!docs().length) {
    pane.appendChild(el("p", null, ask));
    return;
  }
  // "Task" and the tasks tab's own name both open that tab, so the pointer is
  // one click from what it points at. A build posts it as `phase` ("Phase N
  // tasks"); a quick task ticks the steps of its `plan` in place (an older
  // agent may still post a separate `tasks` tab). A skill with no task list
  // (Document, Plan) has nothing live to follow, so it gets no pointer at all.
  const list =
    docs().find((d) => d.id === "phase") ||
    docs().find((d) => d.id === "tasks") ||
    (page.S.workflow === "quick-task" && docs().find((d) => d.id === "plan")) ||
    docs().find((d) => /\btasks\b/i.test(d.title || ""));
  if (!list) {
    pane.appendChild(el("p", null, "The tabs above fill in as it goes. " + ask));
    return;
  }
  const jump = (word) => {
    const b = el("button", "waiting-jump", word);
    b.type = "button";
    b.addEventListener("click", () => {
      page.view = "doc:" + list.id;
      redraw();
    });
    return b;
  };
  const p = el("p");
  p.append(
    "The tabs above fill in as it goes. You can follow along with live ",
    jump("Task"),
    " updates in the ",
    jump(list.title || "Phase tasks"),
    " tab. " + ask
  );
  pane.appendChild(p);
}

// The stars for Planny's flight, made once. Each gets its place and pace as
// custom properties set through the CSSOM: the CSP forbids style attributes
// in markup, and the stylesheet cannot roll dice. They sit still, invisible,
// until the dock is `is-flying`.
export function fillSky() {
  const sky = $("dock-sky");
  const r = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 34; i++) {
    const star = document.createElement("i");
    star.className = "star" + (i % 7 === 0 ? " hot" : "");
    const dur = r(4, 12);
    star.style.setProperty("--y", r(3, 97).toFixed(1) + "%");
    star.style.setProperty("--p", r(0, 1).toFixed(3));
    star.style.setProperty("--s", r(1, 2.2).toFixed(2) + "px");
    star.style.setProperty("--dur", dur.toFixed(2) + "s");
    // Negative, so the field starts full rather than every star at the edge.
    star.style.setProperty("--delay", (-r(0, dur)).toFixed(2) + "s");
    sky.appendChild(star);
  }
}
