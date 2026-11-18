// Plan2Code Web Console - Learning's row on the dashboard: one slim line in four
// states and two places, built from the saved prototype (specs/project-learning
// prototypes/learning-row.html, variant A). Under the spec picker while it needs
// the person (not set up, off, paused); after the last card group while on.
//
// Pause for me is the one control that needs no agent: it posts to
// /learning/pause and the server pushes the new scan. Everything that changes
// the project goes to the dashboard agent as a __learning action (sendLearning
// in dashboard.js, reached through hooks: a screen never imports another),
// and is disabled whenever a card would be.

import { NOT_CONNECTED } from "../labels.js";
import { page, redraw, hooks, stage } from "../state.js";
import { el, icon, md, mdInto, lightDismiss } from "../render.js";
import { postJson } from "../net.js";
import { sendState, suggestState } from "../send-state.js";
import { threadWho, threadText } from "../answers.js";
import { loopDriving, isOpen, stagedCount, learningBusyNow } from "../selectors.js";

const TOP_STATES = new Set(["off", "paused"]);

const PILLS = {
  "not-set-up": { text: "Not set up", cls: "" },
  off: { text: "Off", cls: "" },
  on: { text: "On", cls: " is-accent" },
  paused: { text: "Paused for you", cls: " is-stage" },
};

// The More menu stays open across the dashboard's redraws until it is closed.
let moreOpen = false;
// A pause post in flight: the switch holds until the pushed state lands.
let pausing = false;

/** "Nov 13", the way the page's other short dates read. */
function shortDate(iso) {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Why an agent-run control is unavailable, or "" when it can be pressed: the
 * same conditions that disable a dashboard card (dashCard()).
 */
export function learningBlocked() {
  if (page.gone) return NOT_CONNECTED;
  if (page.pendingResult) return "Plan2Code is still picking up your last choice.";
  if (page.local && page.local.launching) return "A skill is starting.";
  if (loopDriving()) return "The Implementation Loop is running.";
  return "";
}

/**
 * The switch the person just pressed while the agent works on it, or null (the
 * rule is learningBusyNow() in selectors.js; Review and a saved choice show in
 * the banner instead).
 */
function busySwitch(state) {
  const busy = learningBusyNow(state);
  return busy && (busy.what === "switch-on" || busy.what === "switch-off") ? busy : null;
}

function agentButton(text, cls, what) {
  const b = el("button", cls, text);
  b.type = "button";
  const why = learningBlocked();
  b.disabled = Boolean(why);
  if (why) b.title = why;
  b.addEventListener("click", () => {
    if (!learningBlocked()) hooks.sendLearning(what);
  });
  return b;
}

function pauseSwitch(paused) {
  const b = el("button", "learn-switch" + (paused ? " is-on" : ""));
  b.type = "button";
  b.setAttribute("role", "switch");
  b.setAttribute("aria-checked", paused ? "true" : "false");
  b.disabled = pausing || Boolean(page.gone);
  if (page.gone) b.title = NOT_CONNECTED;
  const track = el("span", "learn-track");
  track.setAttribute("aria-hidden", "true");
  b.append(track, document.createTextNode("Pause for me"));
  b.addEventListener("click", async () => {
    if (pausing) return;
    pausing = true;
    redraw();
    const { status } = await postJson("/learning/pause", { paused: !paused });
    pausing = false;
    if (status !== 200) {
      hooks.banner(
        status === 409 ? "Learning is no longer on for this project, so there is nothing to pause." : "The pause did not go through. Try again.",
        "warn"
      );
    }
    redraw();
  });
  return b;
}

function closeMore(focusButton) {
  if (!moreOpen) return;
  moreOpen = false;
  redraw();
  if (focusButton) queueMicrotask(() => document.querySelector(".learn-row .learn-more-btn")?.focus());
}

function moreMenu() {
  const wrap = document.createDocumentFragment();
  const btn = el("button", "learn-link learn-more-btn", "More");
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", moreOpen ? "true" : "false");
  btn.addEventListener("click", () => {
    moreOpen = !moreOpen;
    redraw();
    if (moreOpen) queueMicrotask(() => document.querySelector(".learn-more [role=menuitem]:not([aria-disabled=true])")?.focus());
  });
  btn.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      moreOpen = true;
      redraw();
      queueMicrotask(() => document.querySelector(".learn-more [role=menuitem]")?.focus());
    }
  });
  const list = el("ul", "learn-more");
  list.setAttribute("role", "menu");
  list.setAttribute("aria-label", "More Learning actions");
  list.hidden = !moreOpen;
  const why = learningBlocked();
  const item = (text, act, cls = "") => {
    const li = el("li", "learn-more-item" + cls, text);
    li.setAttribute("role", "menuitem");
    li.tabIndex = -1;
    if (why) {
      li.setAttribute("aria-disabled", "true");
      li.title = why;
    }
    const run = () => {
      if (learningBlocked()) return;
      moreOpen = false;
      act();
      redraw();
    };
    li.addEventListener("click", run);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        run();
      }
    });
    return li;
  };
  list.append(
    item("Switch off for this project", () => hooks.sendLearning("switch-off")),
    item("Move the failure log into lessons", () => hooks.sendLearning("move-log")),
    item("Remove all lessons…", () => openRemoveConfirm(), " is-danger")
  );
  list.addEventListener("keydown", (e) => {
    const items = [...list.querySelectorAll("[role=menuitem]")];
    const at = items.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeMore(true);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      items[(at + step + items.length) % items.length]?.focus();
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      (e.key === "Home" ? items[0] : items[items.length - 1])?.focus();
    } else if (e.key === "Tab") {
      closeMore(false);
    }
  });
  wrap.append(btn, list);
  return wrap;
}

// One listener for the page's life: a click outside the row, or Escape
// anywhere, closes an open More menu.
let outsideWired = false;
function wireOutside() {
  if (outsideWired) return;
  outsideWired = true;
  document.addEventListener("pointerdown", (e) => {
    if (moreOpen && !(e.target instanceof Element && e.target.closest(".learn-more, .learn-more-btn"))) closeMore(false);
  });
  document.addEventListener("keydown", (e) => {
    if (moreOpen && e.key === "Escape") closeMore(true);
  });
}

/* ------------------------------------------------------------- the dialogs */

// The dialog's own state, kept across the dashboard's redraws: a send from it
// in flight (the card locks), and the "choices not saved" ask after a close
// was asked for while something is chosen.
let saving = false;
let askingClose = false;
// The card the dialog shows now, for the handlers made once with the dialog.
let shownItem = null;

/** How many lessons the person has chosen on the card so far (its draft). */
function chosenCount(item) {
  try {
    const d = JSON.parse(page.local.drafts["lessons-" + item.id] || "null");
    return d && d.picks && typeof d.picks === "object" ? Object.values(d.picks).filter(Boolean).length : 0;
  } catch {
    return 0;
  }
}

/**
 * Send the staged choices from the dialog. While it goes the card locks and
 * the button says Saving…; the dialog closes by itself once the send is in,
 * and the dashboard's banner takes over with "Saving your lessons…". `undo`
 * puts staged choices back the way they were when the send did not go.
 */
async function saveLessons(item, undo) {
  if (saving) return;
  saving = true;
  askingClose = false;
  redraw();
  try {
    await hooks.send();
  } finally {
    saving = false;
  }
  if (page.local.sent && page.local.sent[item.id]?.value) {
    hooks.beginLearningSave();
    return;
  }
  if (undo) undo();
  redraw();
}

/** Not now: leave every lesson waiting, and tell the agent so it is not left holding a card no one can answer. */
function leaveAllWaiting(item) {
  // A send that cannot go says so, rather than a close that does nothing.
  const state = sendState(true);
  if (state.disabled) {
    hooks.banner(state.why || "Plan2Code cannot take that right now. Try again in a moment.", "warn");
    return;
  }
  const before = page.local.staged[item.id];
  // A note typed in "Anything to add?" goes with it.
  stage(item.id, { type: "answer", kind: "lessons", decisions: [], ...(before && before.text ? { text: before.text } : {}) });
  return saveLessons(item, () => stage(item.id, before === undefined ? null : before));
}

/** The close, the Not now button and Escape: straight out when nothing is chosen, an ask first when something is. */
function requestClose(item) {
  if (saving) return;
  if (chosenCount(item) > 0) {
    askingClose = true;
    redraw();
    queueMicrotask(() => document.querySelector("#lessons-modal .lessons-unsaved .btn")?.focus());
    return;
  }
  leaveAllWaiting(item);
}

function spinnerLabel(text) {
  const wrap = document.createDocumentFragment();
  wrap.append(el("span", "spinner tiny"), document.createTextNode(text));
  return wrap;
}

/**
 * Review from the dashboard (FR-18): the dashboard agent posts the lessons
 * card while the workflow is still `dashboard`, and its page draws no question
 * cards, so the card is shown here, in a dialog over the menu, built by the
 * same builder as on any other page (reached through hooks). It opens while an
 * open lessons item waits for the person and closes once it is sent or
 * answered. `on` is false off the dashboard menu, which closes it.
 */
export function renderLessonsDialog(on) {
  const items = (page.S && Array.isArray(page.S.items) && page.S.items) || [];
  const item = on ? items.find((i) => i && i.kind === "lessons" && isOpen(i)) : null;
  // Any send closes it for good: a dashboard lessons card is never asked
  // again, and once the agent collects the send and goes back to waiting, the
  // page no longer counts it in flight while the card may still read open.
  const sent = item && ((page.local.sent && page.local.sent[item.id]?.value) || item.submitted);
  let dlg = document.getElementById("lessons-modal");
  if (!item || sent) {
    if (dlg && dlg.open) {
      dlg.close();
      // The Review button that opened it is the place to land again.
      document.querySelector(".learn-banner button:not(:disabled)")?.focus();
    }
    askingClose = false;
    return;
  }
  shownItem = item;
  if (!dlg) {
    dlg = el("dialog", "modal lessons-dialog");
    dlg.id = "lessons-modal";
    dlg.setAttribute("aria-label", "Lessons to review");
    // The agent is waiting on this card, and the dialog is the only place it
    // is drawn, so a close is never only a hide: Escape, the corner ×, Not now
    // and a click outside all leave every lesson waiting and say so (a click
    // outside only while nothing is chosen, so a stray one never costs picks).
    dlg.addEventListener("cancel", (e) => {
      e.preventDefault();
      if (shownItem) requestClose(shownItem);
    });
    lightDismiss(dlg, () => {
      if (shownItem && !saving && !chosenCount(shownItem)) leaveAllWaiting(shownItem);
      return false;
    });
    document.body.appendChild(dlg);
  }
  const scroll = dlg.scrollTop;
  dlg.classList.toggle("is-saving", saving);
  dlg.setAttribute("aria-busy", saving ? "true" : "false");
  const card = hooks.renderCard(item);
  if (saving) card.inert = true;
  const x = el("button", "modal-x");
  x.appendChild(icon("close"));
  x.type = "button";
  x.setAttribute("aria-label", "Close without saving");
  x.disabled = saving;
  x.addEventListener("click", () => requestClose(item));
  const actions = el("div", "modal-actions");
  if (askingClose && !saving) {
    const ask = el("div", "callout is-warn lessons-unsaved");
    ask.setAttribute("role", "alert");
    ask.appendChild(el("p", "lessons-unsaved-text", "You have choices that are not saved."));
    const row = el("div", "modal-actions");
    const keep = el("button", "btn ghost", "Keep editing");
    keep.type = "button";
    keep.addEventListener("click", () => {
      askingClose = false;
      redraw();
    });
    const drop = el("button", "btn danger", "Discard and close");
    drop.type = "button";
    drop.addEventListener("click", () => leaveAllWaiting(item));
    const save = el("button", "btn primary", "Save lessons");
    save.type = "button";
    save.disabled = !page.local.staged[item.id] || sendState().disabled;
    save.addEventListener("click", () => saveLessons(item));
    row.append(keep, drop, save);
    ask.appendChild(row);
    actions.appendChild(ask);
  } else {
    const suggest = suggestionsBox(item);
    if (suggest) actions.appendChild(suggest);
    // The Notes panel is not on this dialog, so its Ask for suggestions chip
    // is here: the same request, answered in the Suggestions box above.
    const st = suggestState(item);
    const ask = el("button", "btn ghost", "Ask for suggestions");
    ask.type = "button";
    ask.id = "lessons-suggest";
    ask.disabled = saving || st.disabled;
    ask.title = st.why || "";
    ask.addEventListener("click", () => hooks.askSuggestions(item.id));
    const later = el("button", "btn ghost", "Not now");
    later.type = "button";
    later.id = "lessons-later";
    later.disabled = saving;
    later.addEventListener("click", () => requestClose(item));
    const go = el("button", "btn primary");
    go.type = "button";
    go.id = "lessons-send";
    if (saving) go.appendChild(spinnerLabel("Saving…"));
    else go.textContent = "Save lessons";
    go.addEventListener("click", () => saveLessons(item));
    actions.append(ask, later, go);
    if (stagedCount() > 1) actions.appendChild(el("p", "help", "Anything else ready to send goes with it."));
  }
  dlg.replaceChildren(card, actions, x);
  refreshLessonsSend();
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = scroll;
}

/**
 * The Suggestions box above the dialog's buttons: "Asking Plan2Code…" while a
 * request waits, then the agent's latest reply in the card's thread after the
 * last request. Null when nothing was asked.
 */
function suggestionsBox(item) {
  const thread = Array.isArray(item.thread) ? item.thread : [];
  let asked = -1;
  thread.forEach((m, i) => {
    if (m && m.suggest === true && threadWho(m) === "user") asked = i;
  });
  const waiting = item.sentNote && item.sentNote.suggest === true && !thread.slice(asked + 1).some((m) => threadWho(m) === "agent");
  const reply = asked >= 0 ? thread.slice(asked + 1).filter((m) => threadWho(m) === "agent").pop() : null;
  if (!waiting && !reply) return null;
  const box = el("div", "callout is-info lessons-suggestions");
  box.id = "lessons-suggestions";
  box.setAttribute("role", "status");
  box.appendChild(el("h3", null, "Suggestions"));
  if (reply && !waiting) box.appendChild(md(threadText(reply), "md"));
  else box.appendChild(el("p", "help", "Asking Plan2Code. Its answer shows here."));
  return box;
}

/**
 * The dialog's Save lessons, set again whenever what is staged changes,
 * including the quiet staging of typing (a Reword field emptied, a note): on
 * only while the lessons card holds an answer and a send can go.
 */
export function refreshLessonsSend() {
  const go = document.getElementById("lessons-send");
  if (!go) return;
  const items = (page.S && Array.isArray(page.S.items) && page.S.items) || [];
  const item = items.find((i) => i && i.kind === "lessons" && isOpen(i));
  go.disabled = saving || !item || !page.local.staged[item.id] || sendState().disabled;
}

function dialog(id, cls, title) {
  let dlg = document.getElementById(id);
  if (dlg) return dlg;
  dlg = el("dialog", "modal " + cls);
  dlg.id = id;
  dlg.setAttribute("aria-labelledby", id + "-title");
  const h = el("h2", null, title);
  h.id = id + "-title";
  dlg.appendChild(h);
  document.body.appendChild(dlg);
  lightDismiss(dlg);
  return dlg;
}

// Remove all lessons asks first, in the style of the spec delete dialog.
function openRemoveConfirm() {
  let dlg = document.getElementById("learn-remove-modal");
  if (!dlg) {
    dlg = dialog("learn-remove-modal", "learn-remove", "Remove all lessons?");
    dlg.appendChild(el("p", "modal-blurb", "Remove all saved lessons from this project? Learning stays on."));
    const actions = el("div", "modal-actions");
    const keep = el("button", "btn ghost", "Keep them");
    keep.type = "button";
    keep.addEventListener("click", () => dlg.close());
    const go = el("button", "btn danger is-on", "Remove all lessons");
    go.type = "button";
    go.id = "learn-remove-go";
    go.addEventListener("click", () => {
      dlg.close();
      if (!learningBlocked()) hooks.sendLearning("remove");
    });
    actions.append(keep, go);
    dlg.appendChild(actions);
  }
  dlg.showModal();
}

// Open the lessons: every lesson file, read-only, through the page's Markdown.
async function openLessons() {
  let dlg = document.getElementById("learn-lessons-modal");
  if (!dlg) {
    dlg = dialog("learn-lessons-modal", "handoff-read learn-lessons", "The project's lessons");
    const where = el("p", "modal-blurb learn-lessons-where");
    mdInto(where, "The project's lessons (`.plan2code/lessons/`, saved with the repository)");
    const body = el("div", "handoff-body md learn-lessons-body");
    const actions = el("div", "modal-actions");
    const close = el("button", "btn ghost", "Close");
    close.type = "button";
    close.addEventListener("click", () => dlg.close());
    actions.appendChild(close);
    dlg.append(where, body, actions);
  }
  const body = dlg.querySelector(".learn-lessons-body");
  body.replaceChildren(el("p", "md-p", "Reading…"));
  dlg.showModal();
  try {
    const res = await fetch("/learning/lessons", { cache: "no-store" });
    if (res.status !== 200) throw new Error(String(res.status));
    const { files } = await res.json();
    body.replaceChildren();
    if (!files || !files.length) {
      body.appendChild(el("p", "md-p", "No lessons are saved in this project yet."));
      return;
    }
    for (const f of files) {
      const part = el("section", "learn-lessons-file");
      part.appendChild(el("p", "learn-lessons-name", f.name));
      const text = el("div", "md");
      mdInto(text, f.text || "");
      part.appendChild(text);
      body.appendChild(part);
    }
  } catch {
    body.replaceChildren(el("p", "md-p", "The lessons could not be read."));
  }
}

/* ----------------------------------------------------------------- the row */

/**
 * The Learning row for `position` ("top" or "bottom"), or null: the top place
 * takes Off and Paused, the bottom place takes On and Not set up, and no row is
 * drawn when the scan carries no `learning` (an unknown settings format).
 */
export function renderLearningRow(scan, position) {
  const learning = scan && scan.learning;
  if (!learning || !PILLS[learning.state]) return null;
  const top = TOP_STATES.has(learning.state);
  if ((position === "top") !== top) return null;
  if (position !== "top" && position !== "bottom") return null;
  wireOutside();
  const state = learning.state;
  const row = el("section", `learn-row is-${position} is-${state}`);
  row.setAttribute("aria-label", "Learning");
  row.dataset.learning = state;
  const line = el("div", "learn-line");
  line.appendChild(el("span", "learn-label", "Learning"));
  const pill = PILLS[state];
  line.appendChild(el("span", "pill is-caps learn-pill" + pill.cls, pill.text));
  const controls = el("span", "learn-controls");
  const busy = busySwitch(state);
  if (busy) {
    row.classList.add("is-busy");
    row.setAttribute("aria-busy", "true");
    const working = el("span", "learn-busy");
    working.setAttribute("role", "status");
    working.append(el("span", "spinner tiny"), document.createTextNode(busy.what === "switch-on" ? "Switching on…" : "Switching off…"));
    line.appendChild(el("span", "learn-say", busy.what === "switch-on" ? "Switching Learning on for this project." : "Switching Learning off for this project."));
    controls.appendChild(working);
  } else if (state === "not-set-up") {
    line.appendChild(el("span", "learn-say", "Plan2Code can keep lessons about this codebase, approved by you."));
    controls.appendChild(agentButton("Switch on", "btn sm", "switch-on"));
  } else if (state === "off") {
    line.appendChild(el("span", "learn-say", "Off for this project."));
    controls.appendChild(agentButton("Switch on", "btn sm", "switch-on"));
  } else if (state === "paused") {
    const since = shortDate(learning.pausedSince);
    line.appendChild(
      el(
        "span",
        "learn-say",
        `On for this project. Paused ${since ? "since " + since : "for you"}: your runs are not reading or offering lessons.`
      )
    );
    controls.appendChild(pauseSwitch(true));
  } else {
    line.appendChild(el("span", "learn-say", "On for this project."));
    controls.appendChild(pauseSwitch(false));
    const open = el("button", "learn-link", "Open the lessons");
    open.type = "button";
    open.addEventListener("click", openLessons);
    controls.appendChild(open);
    controls.appendChild(moreMenu());
  }
  line.appendChild(controls);
  row.appendChild(line);
  if (state !== "on") moreOpen = false;
  return row;
}
