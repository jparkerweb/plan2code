// Plan2Code Web Console - the dashboard: cards, the spec picker, handoff chips, delete, and the first-open wake-up; defines only.

import {
  selHandoff,
  scan,
  selSpec,
  agentWorking,
  specList,
  handoffList,
  loadOverview,
  finish,
} from "../selectors.js";
import { hooks, page, redraw, saveNow } from "../state.js";
import { el, approvalTip, mdInto, releasesLink, copyButton, lightDismiss } from "../render.js";
import { needsRoleNudge, ROLE_NOT_SET } from "../starters.js";
import { looks, renderSwatches, saveLooks } from "../looks.js";
import { RED_BANNER, RED_BANNER_IN_APP } from "../meter.js";
import {
  dashNoteKind,
  defaultSpec,
  onInitialPick,
  cardPresentation,
  CATALOG_GROUPS,
  SKILL_CATALOG,
  catalogEntry,
  launchVariant,
  SPEC_STATE_LABELS,
  chipDetail,
  isDeletableSpecDir,
  handoffAge,
  handoffCopyText,
  pickupAction,
  pickupReply,
  launchTarget,
  cardAvailability,
  launchReply,
  deleteSummary,
  deleteHandoffAction,
  deleteHandoffReply,
  deleteAction,
  deleteReply,
} from "../answers.js";
import { stateFor } from "../spec-states.js";
import { sound, soundOn, fadeSound, dropSounds } from "../sound.js";
import { playWake } from "../boot.js";

const $ = (id) => document.getElementById(id);

// The dashboard's first-open wake-up itself is page.wake (state.js). Once per
// page, whatever storage allows: a re-render mid-run must never start a
// second one.
let wakeTried = false;

// True when a wake-up is waiting on the first click: the page load's opening
// chime then gives way to the boot-up sound, played as he powers on.
export let wakeHoldsChime = false;

// His snore while he sleeps (an Audio on loop), or null. Usually silent until
// the waking click, since browsers refuse sound before one.
let snore = null;

function roleNudge() {
  const nudge = el("div", "dash-nudge");
  nudge.setAttribute("role", "status");
  nudge.appendChild(el("span", "dash-nudge-text", "Pick your role to get starter templates ordered for you."));
  const actions = el("div", "dash-nudge-actions");
  const setUp = el("button", "btn small primary", "Set up preferences");
  setUp.type = "button";
  setUp.addEventListener("click", () => {
    renderSwatches();
    // Closed without a role is a "Not now" too: having been to the dialog,
    // they were asked, and the banner does not come back (Help says so).
    $("looks-modal").addEventListener(
      "close",
      () => {
        if (looks.role === undefined) {
          looks.role = ROLE_NOT_SET;
          saveLooks();
          redraw();
        }
      },
      { once: true }
    );
    $("looks-modal").showModal();
  });
  const notNow = el("button", "btn tiny ghost", "Not now");
  notNow.type = "button";
  notNow.addEventListener("click", () => {
    looks.role = ROLE_NOT_SET;
    saveLooks();
    redraw();
  });
  actions.append(setUp, notNow);
  nudge.appendChild(actions);
  return nudge;
}

// × on the update banner hides it for this console session only, and only
// for the release it named. Blocked storage means "not dismissed".
function updateDismissKey() {
  try {
    return "p2c-update-dismissed:" + page.S.sid;
  } catch {
    return "p2c-update-dismissed:";
  }
}

function updateDismissed() {
  try {
    return sessionStorage.getItem(updateDismissKey()) === page.updateFrame.latest;
  } catch {
    return false;
  }
}

const UPDATE_COMMAND = "plan2code update";

// For a machine without the plan2code command: the full installer, menu and all.
const UPDATE_FALLBACK_COMMAND = "npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git";

function openUpdateModal() {
  if (!page.updateFrame) return;
  const versions = $("update-versions");
  versions.replaceChildren(
    document.createTextNode("Version "),
    releasesLink("v" + page.updateFrame.latest),
    document.createTextNode(" is out — you have "),
    el("code", null, page.updateFrame.installed),
    document.createTextNode(".")
  );
  const row = $("update-command");
  const code = el("code", null, UPDATE_COMMAND);
  row.replaceChildren(code, copyButton(UPDATE_COMMAND, "btn small ghost handoff-copy", code));
  const fallbackRow = $("update-fallback");
  const fallback = el("code", null, UPDATE_FALLBACK_COMMAND);
  fallbackRow.replaceChildren(fallback, copyButton(UPDATE_FALLBACK_COMMAND, "btn small ghost handoff-copy", fallback));
  $("update-modal").showModal();
}

export function renderDashboard(main) {
  maybeWake();
  // First, so nothing below reads a pick whose handoff has left the scan, and
  // a delete the agent's rescan has finished stops holding the buttons.
  selHandoff();
  settleDeleting();
  const menu = (page.S && page.S.menu) || {};
  const wrap = el("div", "dash");
  if (needsRoleNudge(looks)) wrap.appendChild(roleNudge());
  // Advice only: words, never a button, and nothing is blocked.
  if (page.meterFrame && page.meterFrame.level === "red") {
    const warn = el("div", "dash-nudge meter-banner", page.inApp ? RED_BANNER_IN_APP : RED_BANNER);
    warn.setAttribute("role", "status");
    wrap.appendChild(warn);
  }
  // Built here only, so no other workflow's page ever shows it. Under the app
  // this never shows at all: the app's own top bar already says so and, unlike
  // this banner's copy-pasted command, updates the skills itself in one click.
  if (page.updateFrame && !page.inApp && !updateDismissed()) {
    const notice = el("div", "dash-nudge update-banner");
    notice.setAttribute("role", "status");
    const open = el("button", "update-banner-open", "UPDATE AVAILABLE · v" + page.updateFrame.latest);
    open.type = "button";
    open.addEventListener("click", openUpdateModal);
    const dismiss = el("button", "update-banner-dismiss", "×");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Dismiss until next time");
    dismiss.addEventListener("click", () => {
      try {
        sessionStorage.setItem(updateDismissKey(), page.updateFrame.latest);
      } catch {}
      redraw();
    });
    notice.append(open, dismiss);
    wrap.appendChild(notice);
  }
  wrap.appendChild(el("p", "card-kicker", "Plan2Code"));
  wrap.appendChild(el("h2", "dash-title", "What are we doing today?"));
  // The agent's note reads the spec the picker opened on (the same "initial"
  // test cardPresentation uses): another pick, or Start from scratch, gets
  // the neutral line rather than context about a spec no longer shown.
  const first = defaultSpec(scan() && scan().specs);
  const picked = selSpec();
  const noteKind = dashNoteKind({ menu, hasMenu: Boolean(page.S.menu), onInitial: onInitialPick(first, picked), working: agentWorking() });
  if (noteKind === "agent") {
    wrap.appendChild(el("p", "dash-note", menu.note));
  } else if (noteKind === "looking") {
    // The cards work from the first paint; the agent's read of the
    // project arrives a moment later, and this says so meanwhile.
    const note = el("p", "dash-note");
    note.appendChild(document.createTextNode("Pick what to do next. "));
    const working = el("span", "dash-working");
    working.appendChild(el("span", "spinner tiny"));
    working.appendChild(
      el(
        "span",
        null,
        "Plan2Code is still looking over the project and will flag where it would start when it is done."
      )
    );
    note.appendChild(working);
    wrap.appendChild(note);
  } else {
    wrap.appendChild(
      el("p", "dash-note", "Pick what to do next. It starts right here, and this page becomes its home.")
    );
  }

  const specs = specList();
  if (specs.length || handoffList().length) wrap.appendChild(renderSpecPicker(specs));
  const handoff = selHandoff();
  if (handoff) {
    // A handoff is picked up, not launched: its skill and spec come from its
    // own record, so the skill cards and their toggle have nothing to say.
    if (!page.local.launching && !page.launchScoping && page.scopeMine !== "") hooks.syncWorkspaceScope();
    wrap.appendChild(renderHandoffPreview(handoff));
    main.appendChild(wrap);
    queueMicrotask(hooks.maybeWelcome);
    return;
  }
  wrap.appendChild(hideUnavailableToggle());
  // Only when this tab's own pick moved: another tab changing the scope
  // sends a frame here too, and re-asserting this tab's pick on every render
  // had two dashboards trade the workspace back and forth without end.
  const wantScope = (selSpec() && selSpec().dir) || "";
  if (!page.local.launching && !page.launchScoping && wantScope !== page.scopeMine) hooks.syncWorkspaceScope();

  // "Unavailable" is the scan's verdict for the selected spec, not the
  // momentary graying while a launch is in flight or the server is away, so
  // cards never blink out of the menu mid-handoff.
  const hide = looks.hideUnavailable;
  const sel = selSpec();
  const available = (e) => cardPresentation(e, scan(), sel, menu).on;
  let shown = 0;
  for (const g of CATALOG_GROUPS) {
    const entries = SKILL_CATALOG.filter((e) => e.group === g.id && (!hide || available(e)));
    if (!entries.length) continue;
    shown += entries.length;
    const section = el("section", "dash-group");
    section.appendChild(el("h3", "dash-group-title", g.title));
    const grid = el("div", "dash-grid");
    for (const e of entries) grid.appendChild(dashCard(e, menu));
    section.appendChild(grid);
    wrap.appendChild(section);
  }
  if (!shown) {
    wrap.appendChild(
      el("p", "dash-empty", "Nothing fits this pick right now. Turn off the toggle above to see every workflow.")
    );
  }
  wrap.appendChild(approvalTip());
  // Mid wake-up: the groups wait hidden until the glide lets them rise in,
  // and the note shows only as far as it has been typed. Once the entrance
  // has played, a re-render draws the menu plainly, never replaying it.
  if (page.wake && !page.wake.entered) wrap.classList.add("waking", ...(page.wake.cards ? ["is-in"] : []));
  if (page.wake && page.wake.typed != null) {
    const note = wrap.querySelector(".dash-note");
    if (note) revealNote(note, page.wake.typed);
  }
  main.appendChild(wrap);
  // Deferred: this runs inside render(), and the dialog is not part of it.
  queueMicrotask(hooks.maybeWelcome);
}

const WAKE_TYPE_DELAY_MS = 350;

const WAKE_TYPE_EVERY_MS = 14;

const WAKE_ENTRANCE_MS = 900;

// One snore, for a nudge with no sound to time it (sounds off, or refused).
const SNORE_MS = 2600;

// The longest a nudge waits on the snore ending: a hidden tab may never say.
const SNORE_MAX_MS = 6000;

const BOOTUP_FADE_MS = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Only a newly opened dashboard carries `wake` (console.mjs deletes it on
// every resume), and only the first page load in this tab plays it.
function maybeWake() {
  if (wakeTried || page.S.wake !== true || finish()) return;
  wakeTried = true;
  const key = "p2c-console:woke:" + page.S.sid;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Blocked storage only costs the reload guard.
  }
  const stage = $("wake");
  const pilot = $("planny").closest(".pilot");
  page.wake = { cards: false, entered: false, typed: 0, timers: [], abort: new AbortController() };
  wakeHoldsChime = !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (wakeHoldsChime && soundOn("snore")) {
    snore = new Audio("/sleeping.mp3");
    snore.loop = true;
    snore.play().catch(() => {});
  }
  pilot.classList.add("is-waking");
  playWake({
    stage,
    bot: stage.querySelector(".wake-bot"),
    skipEl: stage.querySelector(".wake-skip"),
    target: $("planny"),
    stir: stirWake,
    onStart: () => sound("bootup"),
    onGlide: wakeGlide,
    onSkip: skipWakeSounds,
    signal: page.wake.abort.signal,
  }).then(({ skipped }) => {
    stopSnore();
    fadeSound("bootup", BOOTUP_FADE_MS);
    pilot.classList.remove("is-waking");
    // An abort or reduced motion jumps straight to the finished
    // dashboard. A run that reached its end leaves the note typing on.
    if (skipped || (page.wake && !page.wake.cards)) finishWake();
  });
}

// The nudge: one whole snore from the top, however far the loop had got (or
// the first one heard, since the loop is usually refused until this click).
// Called inside the click, so the browser lets it play. Settles when it ends,
// and never rejects: a refused or silent snore just takes one snore's time.
function stirWake() {
  if (!snore) return delay(SNORE_MS);
  const heard = new Promise((resolve) => snore.addEventListener("ended", resolve, { once: true }));
  snore.loop = false;
  snore.currentTime = 0;
  return snore.play().then(
    () => Promise.race([heard, delay(SNORE_MAX_MS)]),
    () => delay(SNORE_MS)
  );
}

function stopSnore() {
  if (!snore) return;
  snore.pause();
  snore = null;
}

// The Skip button: silence anything the intro already queued or started. The
// promise's .then does the snore and the bootup fade; this only clears cues
// still waiting to play.
function skipWakeSounds() {
  dropSounds();
}

// The glide: the menu rises in and the note starts typing. On a skip the run
// is already ending and its promise settles everything, so nothing here.
function wakeGlide({ instant }) {
  if (!page.wake) return;
  page.wake.cards = true;
  if (instant) return;
  page.wake.timers.push(
    setTimeout(() => {
      page.wake.entered = true;
      settleWake();
    }, WAKE_ENTRANCE_MS),
    setTimeout(typeNote, WAKE_TYPE_DELAY_MS)
  );
  redraw();
}

// One more character of the note on the live element. Whatever the note says
// right now is what gets typed, so a `menu` note that lands mid-way simply
// carries on from the same count.
function typeNote() {
  if (!page.wake || page.wake.typed == null) return;
  page.wake.typed += 1;
  const note = $("main").querySelector(":scope > .dash .dash-note");
  if (!note || page.wake.typed >= revealNote(note, page.wake.typed)) {
    page.wake.typed = null;
    if (note) revealNote(note, Infinity);
    return settleWake();
  }
  page.wake.timers.push(setTimeout(typeNote, WAKE_TYPE_EVERY_MS));
}

// Done once the entrance has played and the note is all there. Nothing to
// redraw: what is on screen already is the finished dashboard.
function settleWake() {
  if (page.wake && page.wake.entered && page.wake.typed == null) {
    page.wake = null;
    hooks.maybeWelcome();
  }
}

function finishWake() {
  if (!page.wake) return;
  for (const t of page.wake.timers) clearTimeout(t);
  page.wake = null;
  redraw();
}

// Shows the first `count` characters of a note's text, across its text nodes,
// and returns how many there are in all. The full text is kept per node the
// first time it is cut, so later calls can grow it back. An element the
// typing has not reached yet (the "still looking" pill and its spinner) is
// kept out of sight, rather than showing as an empty box.
const noteFullText = new WeakMap();

function revealNote(note, count) {
  const walker = document.createTreeWalker(note, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let total = 0;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      n.classList.toggle("is-untyped", total >= count);
      continue;
    }
    if (!noteFullText.has(n)) noteFullText.set(n, n.data);
    const full = noteFullText.get(n);
    n.data = full.slice(0, Math.max(0, count - total));
    total += full.length;
  }
  return total;
}

// A page-wide preference, so it rides in `looks` (looks.json) and follows the
// person to every session and port rather than resetting per dashboard.
function hideUnavailableToggle() {
  const label = el("label", "dash-toggle");
  const box = el("input");
  box.type = "checkbox";
  // The id is what lets withFocus hand focus back after the rebuild.
  box.id = "dash-hide-unavailable";
  box.setAttribute("role", "switch");
  box.checked = looks.hideUnavailable;
  box.addEventListener("change", () => {
    looks.hideUnavailable = box.checked;
    saveLooks();
    redraw();
  });
  label.appendChild(box);
  label.appendChild(el("span", "dash-toggle-track"));
  label.appendChild(el("span", "dash-toggle-text", "Hide unavailable workflows"));
  return label;
}

/* The spec picker: every spec the server found under specs/, plus "start
   from scratch". The selection decides which cards below are lit, and rides
   along on the launch of any card that takes a spec. Picking is page-local —
   no send — so it costs nothing to change your mind. */
function renderSpecPicker(specs) {
  const sel = selSpec();
  const handoffs = handoffList();
  const pickedHandoff = selHandoff();
  const box = el("section", "spec-pick");
  box.appendChild(
    el("h3", "dash-group-title", handoffs.length ? "Pick up a spec or a handoff, or start fresh" : "Pick up a spec, or start fresh")
  );
  const row = el("div", "spec-row");

  const scratchOn = !sel && !pickedHandoff;
  const scratch = el("button", "spec-chip" + (scratchOn ? " is-sel" : ""));
  scratch.type = "button";
  scratch.setAttribute("aria-current", String(scratchOn));
  scratch.appendChild(el("span", "spec-chip-name", "Start from scratch"));
  scratch.appendChild(el("span", "spec-chip-state", "a new idea"));
  scratch.addEventListener("click", () => {
    page.local.specSel = null;
    saveNow();
    redraw();
    loadOverview();
  });
  row.appendChild(scratch);

  for (const spec of specs) {
    const on = sel && sel.dir === spec.dir;
    // A finished spec (a fixed bug) is hidden while unavailable workflows
    // are, dimmed otherwise. A pick already on it stays visible, so it is
    // never lost.
    const fixed = Boolean(stateFor(spec.state)?.finished);
    if (fixed && looks.hideUnavailable && !on) continue;
    const deleting = Boolean(page.local.deleting && page.local.deleting.dir === spec.dir);
    const wrap = el("div", "spec-chip-wrap" + (deleting ? " is-deleting" : "") + (fixed ? " is-fixed" : ""));
    const b = el("button", "spec-chip" + (on ? " is-sel" : ""));
    b.type = "button";
    b.setAttribute("aria-current", String(Boolean(on)));
    b.appendChild(el("span", "spec-chip-name", spec.name));
    b.appendChild(el("span", "spec-chip-state", deleting ? "Deleting…" : SPEC_STATE_LABELS[spec.state] || spec.state));
    const detail = chipDetail(spec);
    if (detail) b.appendChild(el("span", "spec-chip-detail", detail));
    b.addEventListener("click", () => {
      page.local.specSel = spec.dir;
      saveNow();
      redraw();
      loadOverview();
    });
    wrap.appendChild(b);
    if (isDeletableSpecDir(spec.dir)) {
      // A fixed bug is done with, so its Delete is a visible button rather
      // than the hover ✕ every other spec has.
      const del = fixed ? el("button", "spec-chip-del-label", "Delete") : el("button", "spec-chip-del", "✕");
      del.type = "button";
      del.title = `Delete ${spec.dir}/`;
      del.setAttribute("aria-label", `Delete the spec ${spec.name}`);
      del.disabled = deleting || Boolean(page.local.deleting) || page.gone || page.pendingResult || Boolean(page.local.launching);
      del.addEventListener("click", () => openDeleteConfirm(spec));
      wrap.appendChild(del);
    }
    row.appendChild(wrap);
  }
  // Handoffs follow the specs: dashed chips, the state word is "Handoff".
  for (const h of handoffs) {
    const on = Boolean(pickedHandoff && pickedHandoff.id === h.id);
    const deleting = Boolean(page.local.deleting && page.local.deleting.dir === "handoff:" + h.id);
    const b = el("button", "spec-chip is-handoff" + (on ? " is-sel" : "") + (deleting ? " is-deleting" : ""));
    b.type = "button";
    b.setAttribute("aria-current", String(on));
    b.appendChild(el("span", "spec-chip-name", h.title || "Handoff"));
    b.appendChild(el("span", "spec-chip-state", deleting ? "Deleting…" : "Handoff"));
    b.appendChild(el("span", "spec-chip-detail", handoffAge(h.written)));
    b.addEventListener("click", () => {
      page.local.specSel = "handoff:" + h.id;
      saveNow();
      redraw();
    });
    row.appendChild(b);
  }
  box.appendChild(row);
  return box;
}

// A delete in flight ends when the agent's rescan lands (a new scan), gone
// or refused: either way the picker is the truth again.
function settleDeleting() {
  const sc = scan();
  if (page.local.deleting && sc && sc.at !== page.local.deleting.scanAt) {
    page.local.deleting = null;
    saveNow();
  }
}

// What a picked handoff shows: where it came from and its Next task, with the
// four things to do with it.
function renderHandoffPreview(h) {
  const box = el("section", "handoff-preview");
  box.appendChild(el("h3", "handoff-preview-title", h.title || "Handoff"));
  const entry = catalogEntry(h.skill);
  const meta = [
    "Written " + (h.written ? new Date(h.written).toLocaleString() : "at an unknown time"),
    h.spec ? "spec " + h.spec.replace(/^specs\//, "") : "no spec",
    "from " + (entry ? entry.title : h.skill),
  ];
  box.appendChild(el("p", "handoff-preview-meta", meta.join(" · ")));
  if (h.next) {
    box.appendChild(el("p", "handoff-preview-label", "Next task"));
    box.appendChild(el("p", "handoff-preview-next", h.next));
  }
  const busy = Boolean(page.local.launching || page.local.deleting) || page.gone || page.pendingResult;
  const actions = el("div", "handoff-preview-actions");
  const go = el("button", "btn primary", "Pick it up here");
  go.type = "button";
  go.disabled = busy;
  go.addEventListener("click", () => pickUpHandoff(h));
  const read = el("button", "btn", "Read it all");
  read.type = "button";
  read.addEventListener("click", () => readHandoff(h));
  const copyLabel = page.inApp ? "Copy for another session" : "Copy for a new conversation";
  const shown = handoffCopied && handoffCopied.id === h.id && Date.now() < handoffCopied.until ? handoffCopied.word : copyLabel;
  const copy = el("button", "btn", shown);
  copy.type = "button";
  copy.dataset.handoffCopy = h.id;
  copy.addEventListener("click", () => {
    const dir = (scan() && scan().handoffsDir) || "";
    const sep = dir.includes("\\") ? "\\" : "/";
    const file = dir ? dir.replace(/[\\/]+$/, "") + sep + h.id + ".md" : h.id + ".md";
    copyHandoffText(handoffCopyText(file), h.id, copyLabel);
  });
  const del = el("button", "btn danger", "Delete");
  del.type = "button";
  del.disabled = busy;
  del.addEventListener("click", () => openHandoffDelete(h));
  actions.append(go, read, copy, del);
  box.appendChild(actions);
  return box;
}

// The prompt that sends a new conversation to the handoff. A refused
// clipboard gets a plain word on the button instead of a silent nothing.
// A redraw while the clipboard answers rebuilds the button, so the word is
// kept in handoffCopied (which the rebuilt button reads) and put on whichever
// button is on the page when the answer comes.
let handoffCopied = null;
const handoffCopyButton = (id) => document.querySelector(`button[data-handoff-copy="${CSS.escape(id)}"]`);
async function copyHandoffText(text, id, label) {
  let word;
  try {
    await navigator.clipboard.writeText(text);
    word = "Copied";
  } catch {
    word = "Copy was refused";
  }
  const mark = { id, word, until: Date.now() + 1500 };
  handoffCopied = mark;
  const shown = handoffCopyButton(id);
  if (shown) shown.textContent = word;
  setTimeout(() => {
    if (handoffCopied !== mark) return;
    handoffCopied = null;
    const live = handoffCopyButton(id);
    if (live) live.textContent = label;
  }, 1500);
}

// Pick it up here: a hop like a card launch. The page sends only the id; the
// CLI reads the stored skill and spec, marks the handoff used and falls back
// to Quick Task if either is gone.
async function pickUpHandoff(h) {
  if (page.gone || page.pendingResult || page.local.launching || finish()) return;
  page.launchScoping = true;
  await hooks.syncWorkspaceScope(h.spec || "");
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: [pickupAction(h)], reply: pickupReply(h) }),
    });
    if (res.status === 409) {
      page.launchScoping = false;
      page.pendingResult = true;
      hooks.banner("Your last pick is still being picked up. One moment.", "info");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    sound("startSkill");
    page.local.launching = { skill: h.skill, title: h.title || "the handoff", at: Date.now() };
    page.launchScoping = false;
    page.pendingResult = true;
    saveNow();
    redraw();
  } catch {
    page.launchScoping = false;
    hooks.banner("That did not go through. Nothing was lost; try again.", "warn");
  }
}

// Read it all: the document, in a dialog, from /handoff?id= (served only for
// an id the dashboard's own scan listed).
async function readHandoff(h) {
  $("handoff-title").textContent = h.title || "Handoff";
  const body = $("handoff-body");
  body.replaceChildren(el("p", "md-p", "Reading…"));
  $("handoff-modal").showModal();
  try {
    const res = await fetch("/handoff?id=" + encodeURIComponent(h.id), { cache: "no-store" });
    if (res.status !== 200) throw new Error(String(res.status));
    mdInto(body, await res.text());
  } catch {
    body.replaceChildren(el("p", "md-p", "This handoff could not be read."));
  }
}

function dashCard(entry, menu) {
  const presentation = cardPresentation(entry, scan(), selSpec(), menu);
  // The agent's `recommend` and detail describe the initially selected spec.
  // Other picker choices derive both from the scan, so stale context never
  // follows a person to a different spec or to "start from scratch". A grayed
  // recommendation also yields to the selected spec's actual next step.
  const going = page.local.launching && (page.local.launching.skill === entry.skill || page.local.launching.skill === entry.review);
  const b = el(
    "button",
    "dash-card" + (presentation.recommended ? " is-suggested" : "") + (going ? " is-going" : "")
  );
  b.type = "button";
  b.disabled = Boolean(page.local.launching) || page.gone || page.pendingResult || !presentation.on;
  if (!presentation.on && presentation.reason) b.title = presentation.reason;

  const head = el("span", "dash-card-head");
  head.appendChild(el("span", "dash-chip", entry.chip));
  if (presentation.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
  b.appendChild(head);
  b.appendChild(el("span", "dash-card-title", entry.title));
  b.appendChild(el("span", "dash-card-blurb", entry.blurb));
  if (presentation.detail) b.appendChild(el("span", "dash-card-detail", presentation.detail));
  if (!presentation.on && presentation.reason) b.appendChild(el("span", "dash-card-off", presentation.reason));

  const foot = el("span", "dash-card-foot");
  foot.appendChild(el("code", "dash-card-cmd", entry.command));
  foot.appendChild(el("span", "dash-card-go", going ? "…" : "→"));
  b.appendChild(foot);

  b.addEventListener("click", () => {
    page.dashPick = entry;
    redraw();
  });
  return b;
}

// The confirm pane. A card or rail click lands here rather than launching
// straight away: picking a skill is the one irreversible-feeling click on the
// dashboard, and it deserves a beat: what it is, what it will do, and a
// START that means it. Planny turns up leaning (his "this way" pose) in a
// small sky, because a bare paragraph with two buttons is a dialog, not a
// moment. BACK returns to the menu; Escape does the same (see the global
// keydown in core.js).
export function renderConfirm(main, entry) {
  const menu = (page.S && page.S.menu) || {};
  const presentation = cardPresentation(entry, scan(), selSpec(), menu);
  const pane = el("div", "dash-confirm");

  const stage = el("div", "launch-stage confirm-stage");
  const sky = el("div", "sky launch-sky");
  const r = (a, b) => a + Math.random() * (b - a);
  for (let i = 0; i < 16; i++) {
    const star = el("i", "star" + (i % 5 === 0 ? " hot" : ""));
    const dur = r(4, 10);
    star.style.setProperty("--y", r(2, 98).toFixed(1) + "%");
    star.style.setProperty("--p", r(0, 1).toFixed(3));
    star.style.setProperty("--s", r(1.2, 2.4).toFixed(2) + "px");
    star.style.setProperty("--dur", dur.toFixed(2) + "s");
    star.style.setProperty("--delay", (-r(0, dur)).toFixed(2) + "s");
    sky.appendChild(star);
  }
  stage.appendChild(sky);
  const bot = $("planny").cloneNode(true);
  bot.removeAttribute("id");
  bot.setAttribute("class", "planny is-point v0 confirm-planny");
  stage.appendChild(bot);
  pane.appendChild(stage);

  const head = el("div", "confirm-head");
  head.appendChild(el("span", "dash-chip", entry.chip));
  if (presentation.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
  pane.appendChild(head);
  pane.appendChild(el("h2", "dash-title", entry.title));
  pane.appendChild(el("p", "confirm-about", entry.about || entry.blurb));

  if (presentation.detail) pane.appendChild(el("p", "confirm-detail", presentation.detail));

  // A card that takes a spec names the one the picker is holding, so START
  // reads as "build THIS spec", not the skill in the abstract.
  const target = launchTarget(entry, selSpec());
  if (target) {
    const specLine = el("p", "confirm-spec");
    specLine.appendChild(el("span", null, "for "));
    specLine.appendChild(el("code", null, target.dir));
    specLine.appendChild(el("span", null, ` · ${SPEC_STATE_LABELS[target.state] || target.state}`));
    pane.appendChild(specLine);
  }

  // Implement's card reviews the phase before sign-off unless this is unticked.
  let review = null;
  if (entry.review) {
    pane.appendChild(el("hr", "confirm-rule"));
    const label = el("label", "confirm-review");
    review = el("input");
    review.type = "checkbox";
    review.checked = page.dashReview !== false;
    review.addEventListener("change", () => {
      page.dashReview = review.checked;
      cmdCode.textContent = launchVariant(entry, review.checked).command;
    });
    label.append(review, el("span", null, "Auto Review: fresh agent pass over the phase's changes before sign-off"));
    pane.appendChild(label);
  }

  const cmd = el("p", "confirm-cmd");
  const cmdCode = el("code", null, launchVariant(entry, !review || review.checked).command);
  cmd.appendChild(cmdCode);
  pane.appendChild(cmd);

  const actions = el("div", "confirm-actions");
  const start = el("button", "btn primary", "Start " + entry.title);
  start.type = "button";
  start.disabled = page.gone || page.pendingResult;
  start.addEventListener("click", () => launchSkill(launchVariant(entry, Boolean(review) && review.checked)));
  const back = el("button", "btn ghost", "Back");
  back.type = "button";
  back.addEventListener("click", () => {
    page.dashPick = null;
    redraw();
  });
  actions.appendChild(back);
  actions.appendChild(start);
  pane.appendChild(actions);

  main.appendChild(pane);
  // Focus lands on START after a pick (the clicked control was rebuilt away,
  // leaving focus on <body>), but never yanked back from a deliberate click
  // elsewhere: a state frame can re-render this pane at any time.
  if (document.activeElement === document.body) start.focus();
}

// A pick is a send like a brief or a stop: it names no question, so `__launch`
// marks the action as being about the session, and it reaches the agent
// through the same wait loop. The dashboard reads `skill` off it.
async function launchSkill(entry) {
  if (page.gone || page.pendingResult || page.local.launching || finish()) return;
  const target = launchTarget(entry, selSpec());
  // The card was clickable, so this should never fire — but a spec picked in
  // one tab could have shifted the ground under a stale render in another.
  if (!cardAvailability(entry, scan(), selSpec()).on) {
    hooks.banner("That card is not available for the spec you picked.", "warn");
    redraw();
    return;
  }
  page.dashPick = null;
  const action = {
    i: "__launch",
    type: "launch",
    skill: entry.skill,
    workflow: entry.workflow,
    title: entry.title,
  };
  // The picker's spec goes to the skill being launched, not to the card:
  // cards that take no spec (utilities, setup) launch untargeted even while
  // a spec is selected, save Quick Task on a diagnosed bug.
  if (target) action.spec = target.dir;
  // The skill opens on the folders remembered for what it was launched for.
  // Held until the launch is in flight: the swap's own frame re-renders the
  // dashboard, which would otherwise sync back to the picker's spec.
  page.launchScoping = true;
  await hooks.syncWorkspaceScope(target ? target.dir : "");
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actions: [action],
        reply: launchReply(entry, target),
      }),
    });
    if (res.status === 409) {
      page.launchScoping = false;
      page.pendingResult = true;
      hooks.banner("Your last pick is still being picked up. One moment.", "info");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    sound("startSkill");
    page.local.launching = { skill: entry.skill, title: entry.title, at: Date.now() };
    page.launchScoping = false;
    page.pendingResult = true;
    saveNow();
    redraw();
  } catch {
    page.launchScoping = false;
    hooks.banner("That did not go through. Nothing was lost; try again.", "warn");
  }
}

// The picker's Delete: a dialog in two steps. The first says what goes and
// that it is for good; "Delete this spec…" then reveals the second, which
// enables the final button only once the spec's name is typed exactly. A
// fixed bug skips the second step: its first press sends the delete.
// Cancel, Escape or a click on Keep it at either step changes nothing.
let deleteTarget = null;

// The spec warning as index.html writes it, kept so a fixed bug's wording
// never sticks for the next spec.
let deleteWarnDefault = null;

// A handoff's Delete reuses the same dialog in one step: no name to type, and
// the warning says where the file lives instead of what git does not track.
function openHandoffDelete(h) {
  if (page.gone || page.pendingResult || page.local.launching || page.local.deleting) return;
  deleteTarget = { handoff: h };
  $("delete-title").textContent = "Delete this handoff?";
  $("delete-blurb").textContent = "This handoff will be deleted from ~/.plan2code/handoffs/.";
  $("delete-warn").hidden = true;
  $("delete-warn-handoff").hidden = false;
  const facts = $("delete-facts");
  facts.replaceChildren();
  const fact = (term, value) => {
    if (!value) return;
    facts.appendChild(el("dt", "", term));
    facts.appendChild(el("dd", "", value));
  };
  const entry = catalogEntry(h.skill);
  fact("Handoff", h.title || h.id);
  fact("Written", h.written ? new Date(h.written).toLocaleString() : "");
  fact("Spec", h.spec ? h.spec.replace(/^specs\//, "") : "");
  fact("From", entry ? entry.title : h.skill);
  $("delete-confirm").hidden = true;
  const go = $("delete-go");
  go.textContent = "Delete it";
  go.classList.add("is-on");
  go.disabled = false;
  $("delete-modal").showModal();
}

function openDeleteConfirm(spec) {
  if (!isDeletableSpecDir(spec.dir) || page.gone || page.pendingResult || page.local.launching || page.local.deleting) return;
  deleteTarget = spec;
  // A finished spec (a fixed bug): one confirm, and a warning that says so.
  const fixed = Boolean(stateFor(spec.state)?.finished);
  $("delete-title").textContent = "Delete this spec?";
  const warn = $("delete-warn");
  if (!deleteWarnDefault) deleteWarnDefault = [...warn.childNodes].map((n) => n.cloneNode(true));
  warn.replaceChildren(
    ...(fixed
      ? ["The bug is fixed, so this only clears the write-up. ", el("code", "", "specs/"), " is not tracked by git, so it cannot be brought back."]
      : deleteWarnDefault.map((n) => n.cloneNode(true)))
  );
  warn.hidden = false;
  $("delete-warn-handoff").hidden = true;
  const sum = deleteSummary(spec);
  $("delete-blurb").textContent = `Everything in ${sum.folder} will be deleted from this project.`;
  const facts = $("delete-facts");
  facts.replaceChildren();
  const fact = (term, value) => {
    if (!value) return;
    facts.appendChild(el("dt", "", term));
    facts.appendChild(el("dd", "", value));
  };
  fact("Spec", spec.name);
  fact("Folder", sum.folder);
  fact("Stage", sum.stage);
  fact("Files", sum.files);
  fact("Last changed", sum.touched ? new Date(sum.touched).toLocaleString() : "");
  $("delete-name-hint").textContent = spec.name;
  $("delete-name").value = "";
  $("delete-confirm").hidden = true;
  const go = $("delete-go");
  go.textContent = fixed ? "Delete it" : "Delete this spec…";
  go.classList.toggle("is-on", fixed);
  go.disabled = false;
  $("delete-modal").showModal();
}

function deleteStep() {
  const go = $("delete-go");
  if (!deleteTarget) return;
  if (deleteTarget.handoff) return sendDeleteHandoff(deleteTarget.handoff);
  if (stateFor(deleteTarget.state)?.finished) return sendDelete(deleteTarget);
  if ($("delete-confirm").hidden) {
    $("delete-confirm").hidden = false;
    go.textContent = "Delete for good";
    go.classList.add("is-on");
    go.disabled = true;
    $("delete-name").focus();
    return;
  }
  if ($("delete-name").value.trim() !== deleteTarget.name) return;
  sendDelete(deleteTarget);
}

async function sendDeleteHandoff(h) {
  const go = $("delete-go");
  go.disabled = true;
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: [deleteHandoffAction(h)], reply: deleteHandoffReply(h) }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    const sc = scan();
    page.local.deleting = { dir: "handoff:" + h.id, scanAt: sc ? sc.at : null };
    if (page.local.specSel === "handoff:" + h.id) delete page.local.specSel;
    page.pendingResult = true;
    saveNow();
    $("delete-modal").close();
  } catch (err) {
    $("delete-modal").close();
    if (err && err.pending) page.pendingResult = true;
    hooks.banner(
      err && err.pending
        ? "Your last pick is still being picked up, so that could not go yet. Nothing was deleted; try again in a moment."
        : "That did not go through. Nothing was deleted; try again.",
      "warn"
    );
  } finally {
    deleteTarget = null;
    redraw();
  }
}

async function sendDelete(spec) {
  const go = $("delete-go");
  go.disabled = true;
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: [deleteAction(spec)], reply: deleteReply(spec) }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    const sc = scan();
    page.local.deleting = { dir: spec.dir, scanAt: sc ? sc.at : null };
    // The selection must not outlive the folder: back to the default pick,
    // which the agent's fresh menu recommends for.
    if (page.local.specSel === spec.dir) delete page.local.specSel;
    page.pendingResult = true;
    saveNow();
    $("delete-modal").close();
  } catch (err) {
    $("delete-modal").close();
    if (err && err.pending) page.pendingResult = true;
    hooks.banner(
      err && err.pending
        ? "Your last pick is still being picked up, so that could not go yet. Nothing was deleted; try again in a moment."
        : "That did not go through. Nothing was deleted; try again.",
      "warn"
    );
  } finally {
    deleteTarget = null;
    redraw();
  }
}

// The dialogs' buttons, wired once at start-up: the update notice's Done, the
// handoff preview's close, and the delete dialog's Cancel, name box and go.
export function wireDashboard() {
  $("update-done").addEventListener("click", () => $("update-modal").close());
  $("delete-cancel").addEventListener("click", () => $("delete-modal").close());
  $("handoff-close").addEventListener("click", () => $("handoff-modal").close());
  lightDismiss($("handoff-modal"));
  $("delete-go").addEventListener("click", deleteStep);
  $("delete-name").addEventListener("input", () => {
    $("delete-go").disabled = !deleteTarget || $("delete-name").value.trim() !== deleteTarget.name;
  });
  $("delete-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      deleteStep();
    }
  });
  // `close` is queued, so it can land after the dialog was opened again for
  // another spec; that new target must survive it.
  $("delete-modal").addEventListener("close", () => {
    if (!$("delete-modal").open) deleteTarget = null;
  });
}
