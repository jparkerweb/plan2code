// Plan2Code Web Console - connection, the render loop, the page chrome and Send.
//
// The page's core, which every screen sits inside: the draft kept in this
// browser and on the server (save, load), the first state and every frame
// after it (loadState, adopt), the stream and the polling that stands in for
// it (connect, checkIn), the render loop and the place it keeps (render,
// withFocus), the chrome around the screens (the header, Planny's status
// line, the tabs, the rail, the footer, the session meter) and Send.
//
// Only defines: app.js, the entry, is the only file that imports this one and
// the one that starts it. The screens draw through state.js's redraw() and
// keep the draft through saveNow(), never by importing this file.

import { fresh, freshChat, page, redraw, saveNow, scrollMemory } from "../state.js";
import {
  CATALOG_GROUPS,
  DASHBOARD_COMMAND,
  SKILL_CATALOG,
  STALE_MS,
  agentRepliedAfterSend,
  approvalHint,
  APPROVAL_HINT_IN_APP,
  cardAvailability,
  cardPresentation,
  finishPaused,
  handoffText,
  indentReply,
  noteAction,
  noteReplyLines,
  progressTotal,
  recordedAnswer,
  sentAnswer,
  staleLaunchFeedback,
  submittedAwaiting,
  verdictText,
  workflowLabel,
  workflowTitle,
} from "../answers.js";
import {
  chatView,
  newestReplyId,
  nextAbout,
  shouldChime,
  unreadDot,
} from "../chat.js";
import { copyButton, el, isMac, textWithCode } from "../render.js";
import { isBuild } from "../skills.js";
import { startsClean } from "../hops.js";
import { faviconState, setFavicon } from "../favicon.js";
import { helperRows, showTab } from "../subagents.js";
import { FOOTER_TIERS, footerLabel } from "../workspace.js";
import {
  activity, agentAdrift, agentWorking, asked, awaitingReply, byId, dashboardLive, docs, doingNow,
  finish, gitAwaiting, isDashboard, isGitBoard, isOpen, items, loadOverview, myTurn, openItems,
  overviewSpec, patience, pressStranded, reviewPending, scan, selSpec, sendCollected, stagedCount, stranded,
  topics, workingMs, WORKING_GRACE_MS,
  workspaceFolders,
} from "../selectors.js";
import { sound } from "../sound.js";
import { renderConfirm, renderDashboard } from "./dashboard.js";
import { renderLaunching, renderWaiting } from "./starting.js";
import { heldNotes, noteImages, pendingNotes, removeImage } from "../uploads.js";
import { closeMentions } from "../mention-box.js";
import { buildPager, fitGrowBox, markFor, markMore, renderCard, renderEndItem, renderNotice } from "./cards.js";
import { sendState } from "../send-state.js";
import { renderBriefButton, renderDoc, renderOverview } from "./docs.js";
import { board, renderGitBoard, resetBoard } from "./git-host.js";
import { renderWorkspace, tellFolderIssues } from "./workspace.js";
import { openHelpOn } from "./help-dialog.js";
import { linkLeavesPage, startNewSession, tellApp } from "../app-bridge.js";
import { askOfflineFlipped, askState, declineOpen, renderAside, renderAsk, renderSubagents, renderSubagentsButton } from "./ask.js";
import { renderHandoff, renderHomeButton, renderStopButton, renderStopControls, renderStopping, stopInProgress, stopWarning } from "./ending.js";
import { renderNotepadButton } from "./notepad.js";

// What the entry needs from the screens at start-up, handed on from here: only
// the core imports a screen.
export { wakeHoldsChime, wireDashboard } from "./dashboard.js";
export { fillSky } from "./starting.js";
export { fitGrowBox, wireCards } from "./cards.js";
export { wireDocs } from "./docs.js";
export { wireAsk } from "./ask.js";
export { syncWorkspaceScope, wireWorkspace } from "./workspace.js";
export { maybeWelcome, openHelpOn, wireHelp } from "./help-dialog.js";
export { wireCleanup } from "./cleanup.js";
export { startLooks, wireLooks } from "./looks.js";
export { wireEnding } from "./ending.js";
export { wireNotepad } from "./notepad.js";

const $ = (id) => document.getElementById(id);

// How long the page waits without contact before it calls itself offline.
// Exported for the page tests, which wait it out.
export const GONE_AFTER_MS = 8000;
// Named so a reconnect can clear only THIS banner: a bare banner(null) would
// wipe an unrelated warning that landed while the page was gone (an upload
// failure, a refused send).
const GONE_BANNER =
  "Lost contact with Plan2Code. Nothing you have typed is lost. A blip clears by itself; if Plan2Code starts again, it gives you a new link, so open that one.";

// The server's frame counter as of the last frame, and the last time the page
// heard from the server at all.
let rev = 0;
let lastContact = Date.now();
// The tab the DOM currently shows, which page.view stops naming the moment a
// tab click sets it.
let drawnView = null;
// The tab ids the strip last drew, so a tab the agent or page adds (a posted
// document, a spec's overview) can replay the runway chevrons. Null until the
// first draw, which the load pulse already covers.
let drawnTabs = null;

// The one EventSource, and how many errors in a row it has had.
let es = null;
let esErrors = 0;
// The server's name for the exact view this page last drew from. Handed back
// when the stream opens, so the server can skip resending what is on screen.
let lastHave = null;
let pollTimer = null;
// After the stream gives up, polling keeps the page alive and a good poll tries
// the stream again, no sooner than `esRetryAt`. The wait doubles on each give-up
// (capped) and resets once a stream opens, so a flaky server is not
// thrashed with new connections.
const ES_RETRY_MIN_MS = 3000;
const ES_RETRY_MAX_MS = 60000;
let esRetryMs = ES_RETRY_MIN_MS;
let esRetryAt = 0;
let draftTimer = null;
// What the about tracker last saw, so only a change is an event.
const aboutSeen = { view: null, selected: undefined, spec: undefined };

/* -------------------------------------------------------------- the draft */

function storeKey() {
  return "p2c-console:" + (page.S ? page.S.sid : "pending");
}

export function save() {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(page.local));
  } catch {}
  clearTimeout(draftTimer);
  draftTimer = setTimeout(pushDraft, 600);
}

function load() {
  try {
    const raw = localStorage.getItem(storeKey());
    if (raw) page.local = { ...fresh(), ...JSON.parse(raw) };
  } catch {
    page.local = fresh();
  }
  // Saved before context became a pick: an about set on its own must not
  // survive the upgrade. Asked of the saved copy, before freshChat() fills
  // in an empty history.
  const upgraded = !Array.isArray(page.local.chat && page.local.chat.history);
  page.local.chat = { ...freshChat(), ...(page.local.chat || {}) };
  if (upgraded) {
    page.local.chat.history = [];
    page.local.chat.about = null;
  }
  delete page.local.chat.frozen;
  delete page.local.chat.dropped;
  // A "Skipped" beat is a moment, not something to come back to on a reload.
  delete page.local.skipFlash;
  // A chat send still on its way when the page went died with the old page:
  // offered for Retry, never left saying "Sending…". If it did land, the
  // frame's echo still hides it.
  for (const p of page.local.chat.pending) if (!p.seq) p.failed = true;
  settleStaleUploads();
}

// An upload still marked in flight when the page loads died with the old page.
function settleStaleUploads() {
  for (const list of [...Object.values(page.local.images || {}), page.local.chat.images]) {
    for (const img of list) if (img.status === "uploading") img.status = "failed";
  }
}

async function pushDraft() {
  try {
    await fetch("/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staged: page.local.staged, drafts: page.local.drafts, images: page.local.images }),
    });
  } catch {}
}

// Questions that are theirs and still have no answer on them. This is what
// decides which control is the loud one: while this is non-empty the next
// question is the step, and Send is merely available.
const unanswered = () => myTurn().filter((i) => !page.local.staged[i.id]);

function agentStale() {
  if (!page.agentLastSeen) return false;
  return Date.now() - Date.parse(page.agentLastSeen) > patience(STALE_MS);
}

export async function loadState() {
  try {
    const res = await fetch("/state", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    // The same rev is the same state: adopting it again would redraw the page
    // every few seconds while polling for nothing. Still proof of life, though.
    if (page.S && typeof body.rev === "number" && body.rev === rev) {
      lastContact = Date.now();
      page.agentLastSeen = body.agentLastSeen || page.agentLastSeen;
      markGone();
    } else {
      adopt(body);
    }
    retryStream();
  } catch {
    markGone();
  }
}

export function adopt(body) {
  const firstLoad = page.S === null;
  // What was already theirs to answer, measured BEFORE the new state lands,
  // so what is theirs afterwards can be told apart from what just arrived.
  const before = firstLoad ? null : new Set(myTurn().map((i) => i.id));
  const openBefore = firstLoad ? [] : openItems().map((i) => i.id);
  const wasFinished = Boolean(finish());
  const prevWorkflow = page.S ? page.S.workflow : null;
  const prevSpecDir = page.S ? page.S.specDir : null;
  rev = body.rev;
  lastHave = body.have || null;
  page.S = body.state;
  page.agentLastSeen = body.agentLastSeen || null;
  page.pendingResult = Boolean(body.pendingResult);
  // A "still being picked up" banner is over once the send is: it said a
  // moment, and left up it reads as a fault through every later screen.
  if (!page.pendingResult && page.pendingBannerUp) {
    page.pendingBannerUp = false;
    banner(null);
  }
  page.pendingStop = Boolean(body.pendingStop);
  page.chatFrame = body.chat || null;
  if (body.workspace) page.wsFrame = body.workspace;
  if (body.meter) page.meterFrame = body.meter;
  // Fixed for the session's whole life, but cheap enough to just copy.
  page.inApp = Boolean(body.inApp);
  // Help's `.for-app` / `.for-browser` wording switches on this (help.css).
  document.documentElement.classList.toggle("in-app", page.inApp);
  // Always replaced: an absent key means no update.
  page.updateFrame = body.update || null;
  // Always replaced too: an older server sends none, and then there is no switch.
  page.subagentsFrame = body.subagents || null;
  lastContact = Date.now();
  if (page.gone) {
    page.gone = false;
    if ($("banner").textContent === GONE_BANNER) banner(null);
  }
  if (firstLoad) {
    load();
    // A draft the server kept wins if this browser has nothing, which is how a
    // second device or a cleared profile still picks up where you left off.
    if (!Object.keys(page.local.staged).length && body.draft && body.draft.staged) {
      page.local.staged = body.draft.staged;
      page.local.drafts = body.draft.drafts || {};
      page.local.images = body.draft.images || {};
      settleStaleUploads();
    }
  }
  // A hop that starts clean (hops.js: a launch from the dashboard menu, back
  // to it, or into Git from anywhere). The server already blanked the
  // session; what this page kept for the last skill -- the question on
  // screen, the open tab, anything staged or typed against its item ids --
  // goes too. The launch in flight and the dashboard's spec pick are about the
  // hand-off itself, so they stay. A skill run inline from another (a quick
  // task's review) keeps all of it.
  if (startsClean(prevWorkflow, page.S.workflow)) {
    // The pick rides into the skill it launched, never back home: arriving at
    // the dashboard, the picker starts on the most recently touched spec still
    // in play, the one the agent's fresh menu recommends for.
    const keepPick = page.S.workflow !== "dashboard" && "specSel" in page.local;
    page.local = { ...fresh(), launching: page.local.launching, ...(keepPick ? { specSel: page.local.specSel } : {}) };
    save();
    page.selected = null;
    page.view = "questions";
    // And forget which tab is drawn, or the next render would store the old
    // skill's offset straight back under a tab id the new one may reuse.
    scrollMemory.clear();
    drawnView = null;
    drawnTabs = null;
    // The board's search, picks, open panel and tab belonged to that git run too.
    resetBoard();
    board.settled.clear();
  }
  // The welcome belongs to the dashboard: a pick made under it (or a hop
  // the agent made) leaves it behind, over a skill it says nothing about.
  if (prevWorkflow === "dashboard" && page.S.workflow !== "dashboard" && $("welcome-modal").open) $("welcome-modal").close();
  // A hop away from git that did not go through the dashboard (changelog and
  // back, say) lets go of it the same way — the persisted copy too.
  if (prevWorkflow === "git" && page.S.workflow !== "git") {
    resetBoard();
    page.local.gitBoard = null;
  }
  adoptChat();
  // On the git board, a card the agent settled stays in the card slot until
  // the next click on the board, so its outcome is not whisked away.
  if (page.S.workflow === "git") {
    for (const id of openBefore) {
      const item = byId(id);
      if (item && !isOpen(item)) board.settled.add(id);
    }
  } else board.settled.clear();
  // The finish a review was asked from has gone: the agent took the review
  // up. A later finish (after the review, or after a second phase) starts
  // with its own offer unanswered.
  if (!finish() && page.local.afterBuild) {
    page.local.afterBuild = null;
    save();
  }
  // A way home that ended in a finish instead (the agent paused rather than
  // resuming as the dashboard) is over: the finish screen says the rest.
  if (finish() && page.local.homeward) {
    page.local.homeward = null;
    save();
  }
  // The end of the session is a page of its own in the rail. Landing there
  // the moment the finish arrives keeps it where the current design already
  // put it: on top. A finish that goes away (a review taken up) drops the
  // page back to the questions with it.
  const endLanded = Boolean(finish()) && !wasFinished;
  if (endLanded) {
    page.view = "end";
    // The closing chime -- unless this page only just loaded into an already
    // finished session, in which case the opening one IS this sound.
    if (!firstLoad) sound("sessionEnd");
  }
  if (!finish() && page.view === "end") page.view = "questions";
  // A launch ends the moment the launched skill turns the page: it resumes the
  // session under its own workflow, so `dashboard` stops being what the state
  // says it is. A finish while still on the dashboard is the launch declined
  // or the session ended; either way the menu is not mid-handoff any more.
  if (!isDashboard() || finish()) page.dashPick = null;
  // A launch (or an ending) mid wake-up: cut it short rather than play on
  // over a page that is no longer the menu.
  if (page.wake && (!isDashboard() || finish())) page.wake.abort.abort();
  if (page.local.launching && (!isDashboard() || finish())) {
    const was = page.local.launching;
    page.local.launching = null;
    save();
    // A resume that lands before the skill has said anything turns the page
    // into its starting screen, which is not "ready" yet: the chime and the
    // banner wait for the first thing it actually puts on the page.
    if (!finish() && (asked().length || doingNow() || docs().length)) {
      sound("skillReady");
      banner(`${was.title} is ready.`, "good");
      clearTimeout(arrivalBannerTimer);
      arrivalBannerTimer = setTimeout(() => !page.gone && banner(null), 4000);
    }
  }
  // Anything the agent has now recorded is no longer "staged" or in flight.
  for (const id of Object.keys(page.local.staged)) {
    const item = byId(id);
    if (!item || !isOpen(item)) delete page.local.staged[id];
  }
  // A question stops being in flight when the agent has dealt with it: either
  // it settled the question, or it has replied and left it open, which means it
  // is asking again and the person may answer again.
  const replied = !page.pendingResult && !agentWorking();
  for (const id of Object.keys(page.local.sent || {})) {
    const item = byId(id);
    if (!item || !isOpen(item) || replied) {
      // Re-asked in its thread rather than settled: the question is theirs
      // again, and what they sent goes back on the form to edit, not away.
      // A reordered and renamed list, say, would otherwise have to be redone.
      // One-click answers (a verdict, a yes) are not put back: re-clicking is
      // free, and a pre-staged "I want changes" is one Send from going twice.
      const effort = ["list", "text", "multi", "checklist", "choice"].includes(item && item.kind);
      // A card collected and left open (a partial settle) is the same: theirs
      // again, with what they sent still on it.
      // Never on a finished (or paused) session: nothing more can be sent there.
      if (effort && !finish() && isOpen(item) && replied && !page.local.staged[id] && (agentRepliedAfterSend(item) || sendCollected(item))) {
        const back = sentAnswer(page.local.sent[id]);
        if (back) page.local.staged[id] = back;
      }
      delete page.local.sent[id];
    }
  }
  // A retracted send suppresses exactly that send. Once the item moves --
  // settled, sent again (a new `at`), or answered by an agent reply -- the
  // mark is stale and keeping it would hide a send that is not that one.
  for (const id of Object.keys(page.local.retract || {})) {
    const item = byId(id);
    const r = page.local.retract[id];
    const live =
      item &&
      isOpen(item) &&
      submittedAwaiting(item) &&
      (r === "any" || (item.submitted && item.submitted.at === r));
    if (!live) delete page.local.retract[id];
  }

  // New work: a question that is theirs to answer now and was not a moment ago.
  // That covers a brand new question and one the agent reopened or answered
  // with a follow-up, and not the first load, which has nothing to compare to.
  const arrived = before && !finish() ? myTurn().filter((i) => !before.has(i.id)) : [];
  let announce = null;
  if (arrived.length) {
    // Their turn again, announced by ear as well as by eye: the chime matters
    // most exactly when the banner is the fallback, because they are busy
    // somewhere else on the page.
    sound("question");
    if (typingHere()) {
      // Mid-sentence somewhere. Moving the page under their cursor would lose
      // their place for the sake of telling them something that can wait.
      banner(
        arrived.length === 1
          ? "A new question from Plan2Code. It is in the list on the left."
          : `${arrived.length} new questions from Plan2Code. They are in the list on the left.`,
        "info"
      );
      clearTimeout(arrivalBannerTimer);
      arrivalBannerTimer = setTimeout(() => !page.gone && banner(null), 8000);
    } else {
      page.selected = arrived[0].id;
      page.view = "questions";
      announce = arrived;
    }
  }

  if (!page.selected || !byId(page.selected)) page.selected = pickDefault();
  // A reply that lands while another tab is open: a dot on Ask, and one chime.
  // Not on the first load, which has nothing new to announce.
  const dot = unreadDot({ lastSeenReplyId: page.local.chat.lastSeenReplyId, frameChat: page.chatFrame, viewIsAsk: page.view === "ask" });
  if (!firstLoad && shouldChime(page.chatDot, dot)) sound("chatReply");
  page.chatDot = dot;
  render();
  if ($("workspace-modal").open) renderWorkspace();
  tellFolderIssues();
  // The Overview tab's file changes under a build, so a tab you are watching
  // refetches on every new frame too, not only on the click that opened it.
  if (firstLoad || page.S.specDir !== prevSpecDir || page.S.workflow !== prevWorkflow || page.view === "overview") loadOverview();
  if (announce) showArrival(announce);
  // New entries land at the bottom of the rail. Gliding down to them beats
  // leaving the list parked where it was while it grew underneath.
  if (arrived.length) scrollRail("end");
  // The ending item lands at the TOP of the rail, above a list that may be
  // scrolled well down, so the rail goes up to show the page now on screen.
  if (endLanded) scrollRail("top");
}

// The chat's half of adopt(). A new conversation (New conversation pressed in
// any tab, or a skill switch) is a clean page: nothing typed or waiting for
// the old one carries over. Conversations only ever count up, so a frame that
// names an older one than this page already moved to is a late frame, not a
// switch. Sends the server has now echoed stop being pending.
function adoptChat() {
  const conv = page.chatFrame ? page.chatFrame.conversation : null;
  if (conv != null && conv !== page.local.chat.conversation) {
    if (page.local.chat.conversation == null) page.local.chat.conversation = conv;
    else if (conv > page.local.chat.conversation) {
      // What they were typing, and what they had attached to it, is theirs:
      // a new conversation started elsewhere (another tab, a skill switch)
      // must not wipe a message they have not sent yet.
      page.local.chat = { ...freshChat(), history: page.local.chat.history, draft: page.local.chat.draft, images: page.local.chat.images, about: null, conversation: conv };
      page.chatError = "";
      page.askRowCount = 0;
      declineOpen.clear();
    }
    save();
  }
  if (page.local.chat.pending.length) {
    const shown = new Set(
      chatView(page.chatFrame, { pendingSends: page.local.chat.pending })
        .rows.filter((r) => r.pending)
        .map((r) => r.tempId)
    );
    const still = page.local.chat.pending.filter((p) => shown.has(p.tempId));
    if (still.length !== page.local.chat.pending.length) {
      page.local.chat.pending = still;
      save();
    }
  }
}

// Top or bottom of the session outline, smoothly unless the person has asked
// the browser for less motion.
function scrollRail(where) {
  const rail = $("sidebar");
  rail.scrollTo({
    top: where === "top" ? 0 : rail.scrollHeight,
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
  });
}

let arrivalBannerTimer = null;

// Typing in any text field, the question's own or the notes beside it.
function typingHere() {
  const a = document.activeElement;
  if (!a) return false;
  return a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && (a.type === "text" || a.type === "date"));
}

// The moment the ball comes back.
//
// After Send the person has usually looked away: to the terminal, to another
// window, to the doc tab. The page has already moved them to the first new
// question; this is what makes the move legible instead of a page that
// silently changed while they were not looking. It covers everything
// for a beat, says what happened, and gets out of the way by itself. Any
// click or key dismisses it at once, and it never takes focus from a dialog.
function showArrival(arrived) {
  // A dialog is in the browser's top layer, above anything this could draw,
  // so the overlay would play unseen behind it. The move has still happened.
  if (document.querySelector("dialog[open]")) return;
  const old = document.querySelector(".arrival");
  if (old) old.remove();
  const layer = el("div", "arrival");
  layer.setAttribute("aria-hidden", "true"); // the status line announces it
  const box = el("div", "arrival-box");
  box.appendChild(el("p", "arrival-kicker", "Plan2Code is back"));
  box.appendChild(el("p", "arrival-title", arrived.length === 1 ? "Next question" : "Next questions"));
  box.appendChild(el("p", "arrival-what", arrived[0].title));
  if (arrived.length > 1) {
    const more = arrived.length - 1;
    box.appendChild(el("p", "arrival-more", `and ${more} more after it`));
  }
  layer.appendChild(box);
  document.body.appendChild(layer);

  let done = false;
  const close = () => {
    if (done) return;
    done = true;
    layer.classList.add("is-leaving");
    removeEventListener("keydown", close, true);
    setTimeout(() => layer.remove(), 320);
    // Where the eye goes next. Not the first field: that would scroll and
    // put a caret in front of someone who has not read the question yet.
    if (!document.querySelector("dialog[open]")) $("main").focus({ preventScroll: true });
  };
  layer.addEventListener("click", close);
  addEventListener("keydown", close, true);
  setTimeout(close, 1900);
}

function pickDefault() {
  // What is theirs first: an open question whose answer is already with the
  // agent is reference, not work, and landing on it buries the one that
  // still needs them.
  const open = myTurn().length ? myTurn() : openItems();
  if (open.length) return open[0].id;
  const all = asked();
  return all.length ? all[all.length - 1].id : null;
}

// An open EventSource is itself proof of life. Without this the page would
// declare itself offline during any quiet stretch, since a healthy session
// sends no state events while the agent is thinking.
function connected() {
  if (es && es.readyState === EventSource.OPEN) return true;
  return Date.now() - lastContact <= GONE_AFTER_MS;
}

function markGone() {
  const bad = !connected();
  if (bad && !page.gone) {
    page.gone = true;
    // After a finish the server going away IS the ending: the agent stops it
    // on its way out. Saying "lost contact" and promising to reconnect would
    // dress the expected last step of a session up as a fault, and it would
    // land on top of the hand-off a few seconds after they got there.
    // Same for a stop in progress: the wrapping-up screen says what the loss
    // of the server means there, and a banner promising a reconnect would
    // argue with it.
    if (!finish() && !stopInProgress()) {
      banner(GONE_BANNER, "warn");
    }
    render();
  } else if (!bad && page.gone) {
    page.gone = false;
    if ($("banner").textContent === GONE_BANNER) banner(null);
    render();
  }
}

// Exactly one EventSource for the life of the page. Browsers cap HTTP/1.1 at
// about six connections per origin and a stream holds one permanently, so a
// second stream per tab across a few tabs wedges the origin with no error.
export function connect() {
  esErrors = 0;
  try {
    es = new EventSource(lastHave ? "/events?have=" + encodeURIComponent(lastHave) : "/events");
  } catch {
    es = null;
    return startPolling();
  }
  es.addEventListener("state", (e) => {
    esErrors = 0;
    try {
      adopt(JSON.parse(e.data));
    } catch {}
  });
  es.addEventListener("submitted", (e) => {
    // Drop only what was actually sent.
    //
    // This event fires for a send from ANY tab of this session, which is why it
    // clears anything at all: a second tab must not keep offering answers that
    // have already gone. But it also fires for a brief request, which carries
    // no answers, and the blanket clear threw away everything the person had
    // staged and not yet sent. A missing `ids` means an older server, where
    // clearing everything is still the best guess available.
    let ids = null;
    try {
      ids = JSON.parse(e.data).ids;
    } catch {}
    if (Array.isArray(ids)) for (const id of ids) delete page.local.staged[id];
    else page.local.staged = {};
    save();
    render();
  });
  es.onopen = () => {
    esErrors = 0;
    esRetryMs = ES_RETRY_MIN_MS;
    lastContact = Date.now();
    // Back on the stream: polling was only ever the stand-in.
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
  es.onerror = () => {
    esErrors++;
    if (esErrors >= 3) {
      try {
        es.close();
      } catch {}
      es = null;
      startPolling();
    }
    markGone();
  };
}

function startPolling() {
  if (pollTimer) return;
  esRetryAt = Date.now() + esRetryMs;
  esRetryMs = Math.min(esRetryMs * 2, ES_RETRY_MAX_MS);
  pollTimer = setInterval(loadState, 3000);
}

// While polling, every answer from the server is a cue to try the stream
// again, so polling lasts only as long as the outage did. Polling carries on
// while an attempt is open, so startPolling() never runs for a failed one; the
// wait is pushed back here instead, or a dead stream would be retried on every
// poll. One attempt at a time, since `es` is set while it is trying.
function retryStream() {
  if (!pollTimer || es || Date.now() < esRetryAt) return;
  esRetryAt = Date.now() + esRetryMs;
  esRetryMs = Math.min(esRetryMs * 2, ES_RETRY_MAX_MS);
  connect();
}

// Every five seconds: tell the server the page is still here, and hear back
// whether the agent is, whether a state frame went missing, and whether a
// send is still waiting to be picked up.
export function checkIn() {
  fetch("/ping", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      if (!body) return;
      lastContact = Date.now();
      page.agentLastSeen = body.agentLastSeen || page.agentLastSeen;
      retryStream();
      // A rev we have not seen means a state frame went missing -- a dropped
      // SSE reconnect, a tab asleep in a background window. Ask for it rather
      // than waiting for the next change to come along.
      if (typeof body.rev === "number" && body.rev !== rev) return loadState();
      if (body.pendingResult !== page.pendingResult || Boolean(body.pendingStop) !== page.pendingStop) {
        page.pendingResult = body.pendingResult;
        page.pendingStop = Boolean(body.pendingStop);
        render();
      }
    })
    .catch(() => {})
    .finally(() => {
      markGone();
      renderStatus();
    });
}

let rendering = false;

export function render() {
  if (!page.S) return;
  // A handler that fires while the DOM is being replaced (a blur as its element
  // is removed, say) must not start a second render inside the first.
  if (rendering) return;
  rendering = true;
  try {
  trackAbout();
  const enteringAsk = page.view === "ask" && drawnView !== "ask";
  const switchingTab = drawnView !== null && page.view !== drawnView;
  let tabAdded = false;
  rememberScroll();
  withFocus(() => {
    renderChrome();
    renderStatus();
    renderBriefButton();
    renderSubagentsButton();
    renderStopButton();
    renderNotepadButton();
    renderHomeButton();
    tabAdded = renderViews();
    renderSidebar();
    renderMain();
    restoreScroll();
    renderAside();
    renderFooter();
  });
  // The box an `@` list belonged to was just redrawn away.
  if (page.mentionPop && !page.mentionPop.box.isConnected) closeMentions();
  if (enteringAsk) {
    const box = $("ask-input");
    if (box && !box.disabled) box.focus({ preventScroll: true });
  }
  if (switchingTab || tabAdded) replayViewsArrow();
  if (tabAdded) sound("newTab");
  renderStopping();
  } finally {
    rendering = false;
  }
}

// The runway chevrons beside the tabs pulse a few times on load and then rest.
// Moving to another tab, or a new tab turning up, runs them again: clearing
// the animation, forcing a reflow, then handing it back restarts it from the
// top. The CSS still gates the animation on prefers-reduced-motion, so this is
// a no-op there.
function replayViewsArrow() {
  const arrows = document.querySelectorAll(".views-arrow svg");
  for (const svg of arrows) svg.style.animation = "none";
  void document.querySelector(".views-arrow")?.offsetWidth;
  for (const svg of arrows) svg.style.animation = "";
}

// The places + Add context offers, fed from where the person has been: the
// question card on screen, the doc block they left, the dashboard's spec.
// Only changes are events, and they only ever feed history: nothing here sets
// what a message is about.
function trackAbout() {
  const before = page.local.chat;
  let st = { history: before.history, about: before.about };
  const apply = (event) => (st = nextAbout(st, event));
  const moved = aboutSeen.view !== page.view;
  if (moved && aboutSeen.view && aboutSeen.view.startsWith("doc:") && page.docInView?.docId === aboutSeen.view.slice(4)) {
    apply({ type: "section", ...page.docInView });
  }
  if (isDashboard()) {
    const spec = selSpec();
    const dir = spec ? spec.dir : null;
    if (dir !== aboutSeen.spec) {
      aboutSeen.spec = dir;
      if (spec) apply({ type: "spec", dir: spec.dir, label: spec.name });
    }
  } else if (page.selected !== aboutSeen.selected) {
    aboutSeen.selected = page.selected;
    const item = byId(page.selected);
    if (item && item.kind !== "notice") apply({ type: "card", id: item.id, label: item.title });
  }
  if (moved) aboutSeen.view = page.view;
  if (st.history !== before.history || st.about !== before.about) {
    Object.assign(page.local.chat, st);
    save();
  }
}

// Keeping the person's place across a full render: what had focus, where the
// text cursor sat, and how far down the card they had scrolled.
//
// A re-render replaces the card wholesale, and the card is the thing that
// scrolls. Ticking the fifth box in a long list threw the list back to the top
// with the box just aimed at now off screen, and dropped focus off the control
// that was pressed, which is worse for a keyboard user than for a mouse: they
// lose their position in the group as well as on the page. Every control that
// stages an answer went through this path -- checkboxes, radios, the Yes/No
// buttons -- because staging an answer is a full render.
//
// Not only a question card: the finished screen's card and the dashboard
// menu scroll themselves too, and a doc or the Overview scrolls the column.
// Each of those lost its place on every redraw (a click that staged a send,
// an agent post landing mid-read), until all of them came through here.
//
// The scroll is restored only while the same thing is on screen: the same
// question, the same kind of card, the same tab. Moving to another one should
// start at its top, not part-way down it. The git board keeps its own place
// per tab, so it is left to itself.
const MAIN_SCROLLERS = ":scope > .card, :scope > .dash, :scope > .launching, :scope > .dash-confirm, :scope > .waiting-pane";

// What a scrolling card shows: the question it holds, asked of the card
// itself, else its kind ("card handoff"), without the state classes a redraw
// may change. The `selected` variable is no use here: the rail and the pager
// both set it and then call render, so by now it already names where we are
// going.
function scrollerKey(node) {
  if (node.dataset.item) return "item:" + node.dataset.item;
  return [...node.classList].filter((c) => !c.startsWith("is-") && !c.startsWith("has-")).join(" ");
}

function mainPlace() {
  const main = $("main");
  if (main.querySelector(":scope > .git-board")) return null;
  const inner = main.querySelector(MAIN_SCROLLERS);
  if (inner && inner.scrollTop) return { inner: true, key: scrollerKey(inner), top: inner.scrollTop };
  if (main.scrollTop) return { inner: false, key: drawnView, top: main.scrollTop };
  return null;
}

function restoreMainPlace(place) {
  if (!place) return;
  const main = $("main");
  if (main.querySelector(":scope > .git-board")) return;
  if (!place.inner) {
    if (drawnView === place.key) main.scrollTop = place.top;
    return;
  }
  const inner = main.querySelector(MAIN_SCROLLERS);
  if (inner && scrollerKey(inner) === place.key) inner.scrollTop = place.top;
}

function withFocus(fn) {
  const a = document.activeElement;
  const keep =
    a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" || a.tagName === "SELECT") && a.id
      ? { id: a.id, start: a.selectionStart, end: a.selectionEnd }
      : null;
  const place = mainPlace();

  fn();

  // Scroll first, then focus: focusing an element that is off screen scrolls it
  // into view, which would undo the restore we just did.
  restoreMainPlace(place);
  if (keep) {
    const n = $(keep.id);
    if (n) {
      n.focus();
      try {
        n.setSelectionRange(keep.start, keep.end);
      } catch {}
    }
  }
}

// Scroll memory across tab switches. withFocus() above keeps a card's place
// while the SAME tab re-renders; these two cover moving BETWEEN tabs, which
// withFocus() cannot see, because by the time it measures, the old tab's
// content is already gone. A re-render within one tab leaves `drawnView`
// equal to `view`, so restoreScroll() stands aside and withFocus() does it.
//
// The element that scrolls: the main column on a doc or the Overview, the
// question card on the questions tab, and nothing worth keeping elsewhere
// (the dashboard menu, the end page).
function currentScroller() {
  if (!drawnView) return null;
  if (drawnView.startsWith("doc:") || drawnView === "overview") return $("main");
  if (drawnView === "questions") return $("main").querySelector(":scope > .card.question");
  if (drawnView === "ask") return $("main").querySelector(".ask-list");
  return null;
}

function rememberScroll() {
  const scroller = currentScroller();
  if (scroller) scrollMemory.set(drawnView, { top: scroller.scrollTop, item: scroller.dataset.item });
}

// A question card comes back to its place only while it is the same question:
// moving to another one still starts at its top. A doc with nothing stored
// starts at the top too, rather than inheriting the last doc's offset from the
// main column they share.
function restoreScroll() {
  if (page.view === drawnView) return;
  drawnView = page.view;
  // The chat places its own list: back where it was, or at the newest row.
  if (page.view === "ask") return;
  const scroller = currentScroller();
  if (!scroller) return;
  const saved = scrollMemory.get(page.view);
  if (page.view === "questions") {
    if (saved && saved.item === scroller.dataset.item) scroller.scrollTop = saved.top;
    return;
  }
  scroller.scrollTop = saved ? saved.top : 0;
}

// `extras` are nodes shown after the text: a copyable hint, an action.
export function banner(text, kind, extras) {
  const n = $("banner");
  if (!text) {
    n.hidden = true;
    n.textContent = "";
    return;
  }
  n.hidden = false;
  n.className = "banner " + (kind || "");
  n.textContent = text;
  for (const node of extras || []) n.appendChild(node);
}

// The session meter's pill, straight from the frame's `meter` (meter.js did
// the counting). Hidden until a frame carries it.
function renderMeter() {
  const pill = $("meter-pill");
  if (!page.meterFrame) {
    pill.hidden = true;
    return;
  }
  pill.hidden = false;
  pill.dataset.level = page.meterFrame.level;
  const fraction = Math.max(0, Math.min(1, Number(page.meterFrame.fraction) || 0));
  $("meter-fill").setAttribute("stroke-dashoffset", String(Math.round((1 - fraction) * 1000) / 10));
  $("meter-words").textContent = page.meterFrame.words;
  pill.title = page.meterFrame.tooltip;
  $("meter-tip").textContent = page.meterFrame.tooltip;
  // What the points are made of: one row per piece of work that scored.
  const list = $("meter-list");
  const rows = Array.isArray(page.meterFrame.items) ? page.meterFrame.items : [];
  list.hidden = !rows.length;
  list.replaceChildren(
    ...rows.map((row) => {
      const li = el("li");
      li.appendChild(el("span", "meter-item-label", row.label));
      li.appendChild(el("span", "meter-item-points", "+" + row.points));
      return li;
    })
  );
  // Once the session is past fresh, say how to start a new one. Under the app
  // that is one button doing what the app bar's New Session does, instead of
  // a command to copy into a new conversation.
  const fresh = $("meter-fresh");
  fresh.hidden = page.meterFrame.level === "green";
  if (fresh.hidden || fresh.dataset.built) return;
  fresh.dataset.built = "1";
  if (page.inApp) {
    // The same press as the app bar's New Session, confirm and all.
    const press = el("button", "btn small primary meter-fresh-btn", "Start a New Session");
    press.type = "button";
    press.addEventListener("click", () => tellApp("new-session"));
    fresh.append(press);
    return;
  }
  const text = handoffText({ command: DASHBOARD_COMMAND });
  const code = el("code", "handoff-code", text);
  const row = el("div", "handoff-command meter-fresh-row");
  row.append(code, copyButton(text, "btn small ghost handoff-copy", code));
  fresh.append(
    textWithCode("p", "meter-fresh-text", `To start a new session, run \`${DASHBOARD_COMMAND}\` in a new conversation:`),
    row
  );
}

function renderChrome() {
  renderMeter();
  $("title").textContent = page.S.title || "Session";
  $("badge").textContent = workflowLabel(page.S.workflow);
  renderTabTitle();

  const h = page.S.headline || {};
  // A build counts tasks, which get done rather than answered.
  const building = isBuild(page.S.workflow);
  // On a finished session an open item is frozen: the send on it counts as
  // done, and only a question that was never touched stays outstanding.
  const answeredCount = () => asked().filter((i) => !isOpen(i) || (finish() && Boolean(recordedAnswer(i)))).length;
  // The agent's own count wins once it gives a total, 0 done included: a
  // phase starting at "cleared": 0 is 0 done, not the cards answered before
  // it. A build between counts (a review starting at total 0) shows its stage.
  // A fresh session's headline is 0 of 0 too, so that alone means "unset".
  let done;
  let total;
  if (Number(h.total) > 0) {
    // A question workflow that set a total and never moved `cleared` still
    // fills as cards are answered; a build's 0 is a fact about its tasks.
    done = building ? Math.max(0, Number(h.cleared) || 0) : Number(h.cleared) || answeredCount();
    total = progressTotal(done, Number(h.total));
  } else if (building && h.stage) {
    done = 0;
    total = 0;
  } else {
    done = answeredCount();
    total = progressTotal(done, asked().length);
  }
  const pct = total ? Math.round((done / total) * 100) : 0;
  // The menu has no questions to count: an empty bar there reads as a stall.
  document.querySelector(".progress-block").hidden = (isDashboard() || page.S.workflow === "git") && !finish();
  $("progress-text").textContent = total
    ? `${done} of ${total} ${building ? "done" : "answered"}`
    : h.stage || "Getting started";
  $("confidence").textContent = h.confidence || "";
  $("progress-fill").style.width = pct + "%";
  const bar = $("progress-bar");
  // A stage with nothing to count (a review starting) says its words, no track.
  bar.hidden = !total && Boolean(h.stage);
  bar.setAttribute("aria-valuenow", String(done));
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", String(total));
}

// Planny and the line beside him are one surface, and this is the only thing
// that writes to it. He carries four moods:
//
//   point   something is yours to do, and the line says what
//   work    the agent has it, star turning, feet walking
//   happy   nothing outstanding
//   done    the session is over, and there is one thing left to do elsewhere
//   adrift  the server is up but nothing is listening at the other end
//   gone    no server, eye shut
//
// Each mood is a family: v0 is the plain drawing and the rest are alternates
// (a hop, star-scanning, sparkles, Z's -- see the "mood variants"
// section of app.css). A new variant is rolled only when the mood CHANGES, so
// the once-a-second status tick does not restart his animation every time it
// runs, and the same state keeps the same face until the state itself moves.
const MOOD_VARIANTS = { point: 3, work: 3, happy: 3, done: 2, adrift: 2, gone: 2 };

let moodNow = null;

let moodVar = 0;

// Sent answers that nothing is collecting (stranded() in selectors.js).
const STRANDED_LINE =
  "Plan2Code is not running. Your answers are saved and waiting for it. If the terminal is idle, type **continue** there and it will pick them up; it may also be waiting for your permission approval.";

// A finished screen's press that nothing is collecting (pressStranded()).
const PRESS_STRANDED_LINE =
  "Plan2Code is not running. Your choice is saved and waiting for it. If the terminal is idle, type **continue** there and it will pick it up; it may also be waiting for your permission approval.";

// The status line's **continue**, under the app: a press asks the app to type
// it into the agent's terminal. Held off for a few seconds after, so a double
// press does not send it twice.
const CONTINUE_HOLD_MS = 4000;

function continueButton() {
  const btn = el("button", "agent-key agent-key-btn", "continue");
  btn.type = "button";
  btn.title = "Type continue in the agent's terminal";
  btn.addEventListener("click", () => {
    btn.disabled = true;
    tellApp("agent-continue");
    setTimeout(() => (btn.disabled = false), CONTINUE_HOLD_MS);
  });
  return btn;
}

// The favicon state last told to the app (attention.rs turns it into the
// taskbar's dot). Told only when it changes, never on every status redraw.
let lastAttention = null;

function tellAttention(state) {
  if (state === lastAttention) return;
  lastAttention = state;
  tellApp("attention", { state });
}

export function renderStatus() {
  if (!page.S) return;
  const bot = $("planny");
  const text = $("agent-text");
  const tick = $("agent-tick");
  // SVG className is not a plain string, so setAttribute is the way in.
  // `line` goes in the live region and changes rarely; `count` is the running
  // clock and is kept out of it, or the page reads the seconds aloud.
  // `spin` marks the lines where something really is happening at the other
  // end right now, and it flies too: the ring and the stars mean the same
  // thing. Never on the stale or adrift lines: a turning ring beside
  // "has not checked in" would contradict the sentence it sits next to.
  // `check` adds a "What to check" button that opens Help on the stuck tab.
  const say = (mood, line, count, spin, check) => {
    if (mood !== moodNow) {
      moodNow = mood;
      moodVar = Math.floor(Math.random() * MOOD_VARIANTS[mood]);
    }
    bot.setAttribute("class", `planny is-${mood} v${moodVar}`);
    const shown = check ? `${line}|check` : line;
    if (text.dataset.line !== shown) {
      text.dataset.line = shown;
      const parts = line.split(/\*\*(.+?)\*\*/).map((part, i) => {
        if (i % 2 === 0) return document.createTextNode(part);
        // Under the app the terminal is in the same window, so the word to
        // type is a button that types it there instead.
        if (page.inApp && part === "continue") return continueButton();
        const key = document.createElement("strong");
        key.className = "agent-key";
        key.textContent = part;
        return key;
      });
      if (check) {
        const help = document.createElement("button");
        help.type = "button";
        help.className = "status-help";
        help.textContent = "What to check";
        help.addEventListener("click", () => openHelpOn("stuck"));
        parts.push(document.createTextNode(" "), help);
      }
      text.replaceChildren(...parts);
    }
    tick.textContent = count || "";
    $("agent-spin").hidden = !spin;
    $("dock").classList.toggle("is-flying", Boolean(spin));
    // The tab icon's bar says the same thing from another tab (favicon.js),
    // and the app's taskbar entry from another window.
    const icon = faviconState({ mood, spin, finished: Boolean(finish()) });
    setFavicon(icon);
    tellAttention(icon);
  };

  // Before `gone`, deliberately. Once a session has finished, no server is the
  // expected state, and Planny shutting his eye over it reads as a breakage.
  if (finish()) {
    // A press the agent never came back for: its turn ended while the screen
    // waited. The press is saved, and **continue** in the terminal collects
    // it (a button that types it there, under the app).
    if (pressStranded()) return say("adrift", PRESS_STRANDED_LINE, "", false, true);
    // A finish with the review or the way back to the dashboard still on
    // offer has something left to press here, and only while the server is
    // there to take the press.
    if (page.local.afterBuild === "dashboard" && !page.gone) return say("work", "Opening the dashboard…", "", true);
    if (page.local.afterBuild === "commit" && !page.gone) return say("work", "Opening Git…", "", true);
    if (page.local.afterBuild === "changelog" && !page.gone) return say("work", "Opening Changelog…", "", true);
    if (page.local.afterBuild === "launch" && !page.gone) return say("work", "Starting the next step…", "", true);
    const offer = reviewPending();
    // There is no tab to close under the app, only the one window.
    const closeWord = page.inApp ? "window" : "tab";
    if (dashboardLive(finish()) && !page.gone && !offer) {
      return say("point", `Done. Head back to the dashboard, or close this ${closeWord}.`);
    }
    if (offer === "asked") return say("work", "Review requested. Plan2Code is starting it.", "", true);
    if (offer === "open") return say("point", `Done. Review it here first, or close this ${closeWord}.`);
    // A stop past a warning kept nothing, so it promises no saved place.
    if (finishPaused(finish()))
      return say("done", stopWarning() ? "Paused. The command above starts it again." : "Paused. Your place is saved: the command above picks it up.");
    return say("done", `All done. You can close this ${closeWord}.`);
  }
  if (page.gone) return say("gone", "Not connected. Your answers are saved.", "", false, true);
  // On the way home: the request is sent, and the page stays this skill's
  // until the agent resumes the session as the dashboard.
  if (page.local.homeward && !isDashboard()) {
    return agentAdrift()
      ? say("adrift", "Your way back to the dashboard is saved and waiting for Plan2Code.")
      : say("work", "Saving your place and opening the dashboard…", "", true);
  }
  // The dashboard's three states, ahead of the question logic it never
  // reaches: the pick is theirs to make, it is being looked at, or it is on
  // its way to becoming a skill.
  if (isDashboard()) {
    if (page.local.launching) {
      const stale = staleLaunchFeedback(page.local.launching.title, agentAdrift());
      return stale
        ? say("adrift", `${page.local.launching.title} is saved and waiting for Plan2Code.`)
        : say("work", `Waking up ${page.local.launching.title}…`, "", true);
    }
    if (page.dashPick) return say("point", `Start ${page.dashPick.title} when you're ready.`);
    // The cards work before the agent's menu lands, so a pick is always
    // theirs; the line still says what the agent is up to, or that it went quiet.
    if (agentAdrift()) return say("adrift", "Plan2Code has gone quiet. A pick still waits here for it.");
    const doing = page.S.agent && typeof page.S.agent.activity === "string" ? page.S.agent.activity.trim() : "";
    if (agentWorking() && !page.S.menu) return say("point", `Pick what we are doing today. ${doing || "Plan2Code is looking over the project."}`);
    return say("point", "Your move: pick what we are doing today.");
  }
  // A build can run a long while before it has anything to ask. Once the agent
  // says what it is doing, the working line below says that instead, rather
  // than promising questions that may never come.
  if (!asked().length && !doingNow() && !isGitBoard()) {
    return say("work", `Starting ${workflowTitle(page.S.workflow)}…`, "", true);
  }

  // Answers nobody collected outrank a working line: the agent's last word
  // was "working", but it is not in `wait` to take them (agentAdrift).
  if (stranded()) return say("adrift", STRANDED_LINE, "", false, true);

  // Show the AGENT's liveness, not the server's: if the agent's turn crashed
  // the server is still happily up, and a plain spinner would lie forever.
  if (agentWorking()) {
    if (agentStale()) {
      return say(
        "work",
        "Still working on it. Longer tasks can go a few minutes between updates. Your answers are saved. If it stays quiet for a long while, check your terminal (it may be waiting on a permission approval).",
        "",
        false,
        true
      );
    }
    // Same clock as agentStale(), so the soft line at 30 s hands over to the
    // stale message at two minutes on one timeline.
    const quiet = page.agentLastSeen ? approvalHint(page.S.agent, Date.now() - Date.parse(page.agentLastSeen)) : "";
    const hint = quiet && page.inApp ? APPROVAL_HINT_IN_APP : quiet;
    return say("work", hint || activity() || "Plan2Code is thinking…", fmtMs(workingMs()), true, Boolean(hint));
  }
  // Between pressing Send and the agent picking it up, the agent's own status
  // is still "waiting" because it has not started yet. Reading that as "your
  // turn" told someone who had just answered everything that the ball was back
  // with them. Their own send is the thing that has moved.
  // Before the ordinary "sent, waiting" line, which is true for a minute and
  // a lie after twenty.
  if (agentAdrift()) {
    return say(
      "adrift",
      "Plan2Code is not running right now. Anything you answer here is saved. If the terminal is idle, type **continue** there to wake it; it may also be waiting for your permission approval.",
      "",
      false,
      true
    );
  }

  const mine = myTurn().length;
  // A board click names no question, so nothing above has said it went.
  if (isGitBoard() && (page.pendingResult || gitAwaiting()) && !awaitingReply().length) {
    return say("work", "Sent. Waiting for Plan2Code.", "", true);
  }
  if (awaitingReply().length) {
    return mine
      ? say("point", `Sent. ${mine} question${mine === 1 ? "" : "s"} still for you.`)
      : say("work", "Sent. Waiting for Plan2Code.", "", true);
  }

  if (!mine && isGitBoard()) return say("point", "The board is yours. Pick what to do next.");
  if (!mine) return say("happy", "All caught up.");
  // Everything in front of them is answered and only Send is left. This is the
  // one moment the page can name the next step and be certain it is right.
  if (!unanswered().length) return say("point", "That is all of them. Send it over.");

  const todo = unanswered().length;
  if (todo === mine) return say("point", `Your turn: ${mine} question${mine === 1 ? "" : "s"} waiting.`);
  // An optional card (required: false) left blank owes nothing: Send is the
  // step once only those remain.
  const owed = unanswered().filter((i) => i.required !== false).length;
  if (!owed) return say("point", "Ready to send. The rest are optional.");
  return say("point", `${owed} still to answer, then send.`);
}

function renderViews() {
  const nav = $("views");
  nav.replaceChildren();
  // Sent and not yet picked up: the same ring as Ask, until Plan2Code moves on
  // or goes quiet (a turning ring would pass a dead session for a slow one).
  const sentBusy = page.pendingResult && !page.gone && !agentAdrift();
  const tabs = [
    {
      id: "questions",
      label: isDashboard() ? "Dashboard" : page.S.workflow === "git" ? "Git" : "Questions",
      count: myTurn().length,
      busy: sentBusy,
    },
  ];
  // Built in rather than posted: present exactly while the spec in view has
  // an overview.md. A tab that vanishes under the person sends them home.
  const hasOverview = typeof page.overview.text === "string" && page.overview.key === overviewSpec();
  if (hasOverview) tabs.push({ id: "overview", label: "Overview", count: 0 });
  else if (page.view === "overview") page.view = "questions";
  for (const d of docs()) tabs.push({ id: "doc:" + d.id, label: d.title || "Document", count: 0 });
  // The helpers the agent reported, from the first one on; cleared by a
  // dashboard hop, which sends the person home like the Overview tab does.
  if (showTab(page.subagentsFrame, page.S.helpers)) {
    // From the rows the tab draws, so the badge never counts helpers the
    // working-alone note hides.
    const running = helperRows(page.S.helpers).rows.filter((r) => r.state === "running").length;
    tabs.push({ id: "subagents", label: "Subagents", count: running, busy: running > 0 });
  } else if (page.view === "subagents") page.view = "questions";
  // Always last, on every workflow and after a finish: the Quick question chat.
  // The ring left of "Ask" shows exactly when the conversation's own ring does:
  // a question the agent picked up and has not answered yet.
  const ask = askState();
  const askBusy = ask.view.rows.some((r) => r.working) && ask.send.state !== "offline" && !agentAdrift();
  tabs.push({ id: "ask", label: "Ask", count: 0, dot: page.chatDot, busy: askBusy });

  for (const t of tabs) {
    const b = el("button", "view-tab", t.label);
    b.type = "button";
    // A long doc title is cut on the tab (CSS); the whole of it is the tooltip.
    if (!b.title) b.title = t.label;
    if (t.busy) {
      const spin = el("span", "spinner tiny tab-spin");
      spin.setAttribute("aria-hidden", "true");
      b.prepend(spin);
      const titles = { ask: "Plan2Code is working on an answer", subagents: "Subagents are running" };
      b.title = titles[t.id] || "Sent. Waiting for Plan2Code";
    }
    b.setAttribute("aria-current", String(page.view === t.id || (t.id === "questions" && page.view === "end")));
    if (t.count) {
      const c = el("span", "tab-count", String(t.count));
      b.appendChild(c);
    }
    if (t.dot) {
      const dot = el("span", "tab-dot");
      dot.setAttribute("aria-label", "New reply");
      b.appendChild(dot);
    }
    b.addEventListener("click", () => {
      if (t.id === "ask") {
        page.local.chat.lastSeenReplyId = newestReplyId(page.chatFrame);
        page.chatDot = false;
        save();
      }
      page.view = t.id === "questions" && finish() ? "end" : t.id;
      // The cached text paints at once; the fresh read repaints if the file
      // changed on disk since.
      render();
      if (t.id === "overview") loadOverview();
    });
    nav.appendChild(b);
  }
  // Reports whether a tab appeared that the last draw did not have.
  const ids = new Set(tabs.map((t) => t.id));
  const added = drawnTabs !== null && [...ids].some((id) => !drawnTabs.has(id));
  drawnTabs = ids;
  return added;
}

export function renderSidebar() {
  const rail = $("sidebar");
  rail.replaceChildren();

  const fin = finish();
  if (fin) rail.appendChild(renderEndItem(fin));

  // On the dashboard the rail is the same menu in outline form, so a person
  // who learned the page on a workflow session finds the picks where the
  // session outline usually lives. The card that is mid-launch gets the
  // half-filled mark the page uses for "sent, on its way".
  if (isDashboard() && !fin) {
    const menu = (page.S && page.S.menu) || {};
    for (const g of CATALOG_GROUPS) {
      const box = el("div", "rail-group");
      const head = el("p", "rail-title");
      head.appendChild(el("span", null, g.title));
      box.appendChild(head);
      for (const e of SKILL_CATALOG.filter((x) => x.group === g.id)) {
        const av = cardPresentation(e, scan(), selSpec(), menu);
        // Unavailable for the selected spec fades hard; the brief graying
        // while a launch is in flight or the server is away does not.
        const b = el(
          "button",
          "rail-item" + (av.on ? "" : " is-unavailable") + (av.recommended ? " is-suggested" : "")
        );
        b.type = "button";
        b.disabled = Boolean(page.local.launching) || page.gone || page.pendingResult || !av.on;
        if (!av.on && av.reason) b.title = av.reason;
        b.setAttribute("aria-current", String(Boolean(page.dashPick && page.dashPick.skill === e.skill)));
        const isGoing = page.local.launching && (page.local.launching.skill === e.skill || page.local.launching.skill === e.review);
        const isPicked = page.dashPick && page.dashPick.skill === e.skill;
        const mark = el(
          "span",
          "rail-mark " + (isGoing || isPicked ? "staged" : "open"),
          isGoing ? "◐" : isPicked ? "●" : "○"
        );
        mark.title = isGoing ? "starting" : isPicked ? "picked" : "pick to start";
        b.appendChild(mark);
        b.appendChild(el("span", null, e.title));
        // The center pane's own "Suggested" pill scrolls out of view, so the
        // rail repeats the call-out here as a small dot next to the title.
        if (av.recommended) {
          const dot = el("span", "rail-suggested-dot", "");
          dot.title = "Suggested next step";
          b.appendChild(dot);
        }
        // Same as a card click: the pick goes to the confirm pane, never
        // straight to a launch. From the Overview tab too, so the pane shows.
        b.addEventListener("click", () => {
          page.dashPick = e;
          page.view = "questions";
          render();
        });
        box.appendChild(b);
      }
      rail.appendChild(box);
    }
    return;
  }

  const list = asked();
  if (!list.length) {
    rail.appendChild(el("p", "rail-empty", "Nothing here yet."));
    return;
  }

  const groups = new Map();
  for (const item of list) {
    const key = item.topic || "_";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  for (const [key, group] of groups) {
    const topic = topics().find((t) => t.id === key);
    const box = el("div", "rail-group");
    const head = el("p", "rail-title");
    head.appendChild(el("span", null, topic ? topic.title : "Questions"));
    const settled = group.filter((i) => !isOpen(i) || (finish() && Boolean(recordedAnswer(i)))).length;
    head.appendChild(el("span", null, `${settled}/${group.length}`));
    box.appendChild(head);

    for (const item of group) {
      const b = el("button", "rail-item");
      b.type = "button";
      // Only while the questions view is actually on screen: on the end page
      // the question that was last selected is not the thing being looked at.
      b.setAttribute("aria-current", String(page.view === "questions" && page.selected === item.id));
      const m = markFor(item);
      const mark = el("span", "rail-mark " + m.cls, m.glyph);
      mark.title = m.label;
      b.appendChild(mark);
      b.appendChild(el("span", null, item.title));
      b.addEventListener("click", () => {
        page.selected = item.id;
        page.view = "questions";
        render();
        $("main").focus();
      });
      box.appendChild(b);
    }
    rail.appendChild(box);
  }
}

function renderMain() {
  const main = $("main");
  page.heldPose = main.querySelector(":scope > [data-pose]");
  for (const child of [...main.children]) if (child !== page.heldPose) child.remove();
  try {
    paintMain(main);
  } finally {
    // Nothing took it up: this screen is not the same pose.
    page.heldPose?.remove();
    page.heldPose = null;
  }
  // Inside the render pass, before withFocus restores the card's scroll, so
  // the restore is measured against the box's final height.
  fitGrowBox();
  markMore();
}

function paintMain(main) {
  main.classList.toggle("is-doc", page.view.startsWith("doc:") || page.view === "overview");
  main.classList.toggle("is-ask", page.view === "ask");

  if (page.view.startsWith("doc:")) return renderDoc(main, page.view.slice(4));
  if (page.view === "overview") return renderOverview(main);
  if (page.view === "ask") return renderAsk(main);
  if (page.view === "subagents") return renderSubagents(main);

  // The session's own page, reached from the PAUSED / SESSION ENDED item at
  // the top of the rail. The hand-off lives here alone now, rather than
  // sitting on top of whatever question happens to be selected.
  if (page.view === "end" && finish()) {
    const card = renderHandoff(finish());
    card.classList.add("is-primary");
    main.appendChild(card);
    return;
  }

  // The dashboard has no questions to walk: its whole main column is the menu,
  // or the getting-ready screen while a pick turns into a session. A finish
  // falls through to the ordinary path below, which hands it the card.
  if (isDashboard() && !finish()) {
    if (page.local.launching) renderLaunching(main);
    else if (page.dashPick) {
      // A spec-switch under an open confirm can gray the pick out. Rather
      // than offer START on a card that cannot launch, drop back to the
      // menu — the picker's new selection speaks for itself there.
      if (cardAvailability(page.dashPick, scan(), selSpec()).on) renderConfirm(main, page.dashPick);
      else {
        page.dashPick = null;
        renderDashboard(main);
      }
    } else renderDashboard(main);
    return;
  }

  // The git board stays up after every action until Done with git. The
  // agent's confirm and result cards sit in the board's cardSlot, under the
  // tab strip and above the tab's content (FR-8); its `git-result` notice is
  // the board's own result line instead.
  if (isGitBoard() && !finish()) {
    // At most one card, matching the one-card rule elsewhere. The rail lists
    // every item, so a settled card the pane stopped tracking still shows when
    // the rail picks it. Non-git-result notices fold into the card — and a
    // notice with no card to fold into still gets one, or the agent's word
    // would render nowhere.
    const cards = asked().filter((i) => isOpen(i) || board.settled.has(i.id));
    const sel = byId(page.selected);
    const item = cards.find((i) => i.id === page.selected) || (sel && sel.kind !== "notice" ? sel : null) || cards[0];
    const notices = items().filter((i) => i.kind === "notice" && i.id !== "git-result");
    let card = null;
    let pager = null;
    if (item || notices.length) {
      card = item ? renderCard(item) : el("div", "card");
      for (const n of notices) card.appendChild(renderNotice(n));
      card.classList.add("is-primary");
      pager = item ? buildPager(item) : null;
    }
    renderGitBoard(main, card, pager);
    return;
  }

  const list = asked();
  if (!list.length) {
    // A session can end before it asked anything at all (a build that needed
    // nobody), and the hand-off still has to be somewhere they can see it.
    if (finish()) {
      const card = renderHandoff(finish());
      card.classList.add("is-primary");
      main.appendChild(card);
      return;
    }
    return renderWaiting(main);
  }

  const item = byId(page.selected) || list[0];
  if (!item) return renderWaiting(main);

  // One card is all a page shows. Anything the column used to stack as extra
  // cards -- the "all caught up" lull above and the session notes below --
  // folds into this one, because two boxes on one page read as two things
  // needing attention where there is only ever one.
  const card = renderCard(item);

  // No lull note on a finished session: "leave this tab open, the next
  // question will appear" is true of a pause between questions and false of
  // an ending, and until there was a way to tell the two apart the page said
  // it in both. The ending has its own page now, reached from the rail.
  if (!finish() && !myTurn().length && !stagedCount()) {
    const lull = el("div", "card-note card-lead");
    lull.appendChild(el("p", "note-kicker", "All caught up"));
    lull.appendChild(el("h3", "note-title", "Nothing needs you right now"));
    lull.appendChild(
      el(
        "p",
        null,
        "Plan2Code has everything it asked for. Leave this tab open: the next question will appear here on its own."
      )
    );
    // Between questions in a build, the answer to "what now?" is what it is
    // building.
    if (activity()) lull.appendChild(el("p", "help", "Right now: " + activity()));
    card.insertBefore(lull, card.firstChild);
  }

  for (const n of items().filter((i) => i.kind === "notice")) {
    card.appendChild(renderNotice(n));
  }

  card.classList.add("is-primary");
  main.appendChild(card);
  const pager = buildPager(item);
  if (pager) main.appendChild(pager);
}

export function renderFooter() {
  // The dashboard has no Send: a card click is the answer and it goes on its
  // own. An empty "Nothing to send yet" bar under a menu is noise, so only the
  // workspace label stays.
  const foot = document.querySelector(".footer");
  if (foot) foot.classList.toggle("is-dash", Boolean(isDashboard() && !finish()));
  // A finished dashboard keeps its summary line but still has nothing to send.
  if (foot) foot.classList.toggle("is-dash-done", Boolean(isDashboard() && finish()));

  const summary = $("footer-summary");
  const notes = pendingNotes();
  const n = stagedCount();
  summary.replaceChildren();

  const sent = awaitingReply();

  if (!n && !notes.length && sent.length) {
    // "Answer a question above" is nonsense when everything answerable has
    // already gone. Say what is actually outstanding instead: their own send.
    summary.appendChild(el("strong", null, stranded() ? `${sent.length} saved, not picked up yet` : `${sent.length} with Plan2Code`));
    summary.appendChild(document.createTextNode(" · " + sent.map((i) => i.title).join(" · ")));
  } else if (finish()) {
    // Not "nothing to send yet". There is no yet.
    const fin = finish();
    summary.appendChild(el("strong", null, finishPaused(fin) ? "Paused." : "All done."));
    summary.appendChild(
      document.createTextNode(
        n || notes.length
          ? " Anything still waiting here was never sent."
          : finishPaused(fin)
            ? " Run the command above to pick this up."
            : fin.command
              ? " The next step is above."
              : " Nothing left to run."
      )
    );
  } else if (!n && !notes.length) {
    summary.appendChild(
      document.createTextNode(
        myTurn().length
          ? "Nothing to send yet. Answer a question above, then press Send."
          : "Nothing to send yet."
      )
    );
  } else {
    const strong = el("strong", null, `${n + notes.length} ready`);
    summary.appendChild(strong);
    const bits = [];
    for (const [id, v] of Object.entries(page.local.staged)) {
      const item = byId(id);
      if (!item) continue;
      // The label the person clicked, not the id the agent reads.
      const verdict = v.verdict && (item.verdicts || []).find((x) => x.id === v.verdict);
      const said = v.k || (verdict ? verdictText(verdict) : v.verdict);
      bits.push(item.title + (said ? ` → ${said}` : ""));
    }
    for (const note of notes) {
      const item = byId(note.id);
      bits.push(`note on ${item ? item.title : "a question"}`);
    }
    summary.appendChild(document.createTextNode(" · " + bits.join(" · ")));
  }

  const held = finish() ? 0 : heldNotes().length;
  if (held) {
    summary.appendChild(
      el(
        "div",
        "footer-held",
        held === 1
          ? "1 note is waiting on an upload and will not go with this send."
          : `${held} notes are waiting on an upload and will not go with this send.`
      )
    );
  }

  const state = sendState();
  const btn = $("btn-send");
  btn.disabled = state.disabled;
  // Filled accent means "this is the step". That is only true of Send once
  // nothing is left to answer; before then it is the quieter of the two, so
  // the next question wins the eye. Still one click either way: someone who
  // means to send one answer on its own is not stopped, only not steered.
  const sendIsStep = !state.disabled && !unanswered().length;
  btn.classList.toggle("primary", state.disabled || sendIsStep);
  btn.classList.toggle("standby", !state.disabled && !sendIsStep);

  const hint = $("send-hint");
  hint.replaceChildren();
  hint.title = state.why;
  // Something is turning while the turn is not theirs. A line of gray text
  // saying "one moment" reads the same whether the agent is working on it or
  // has quietly died; a spinner is the difference between the two at a glance.
  // A spinner says "something is happening". Nothing is, once the other end
  // has stopped answering, and a permanent one is how a dead session passes
  // for a slow one.
  if (!page.gone && !agentAdrift() && (page.pendingResult || agentWorking())) {
    hint.appendChild(el("span", "spinner tiny"));
  }
  // An empty `short` means the spinner says it all: a routine wait, already
  // spelled out with a live clock in the dock. The words are for states that
  // want something from the person or have gone wrong.
  if (state.short) {
    hint.appendChild(el("span", "hint-text", state.short));
  } else if (!state.disabled) {
    hint.appendChild(document.createTextNode("or press "));
    hint.appendChild(el("kbd", null, isMac() ? "⌘" : "Ctrl"));
    hint.appendChild(document.createTextNode(" + "));
    hint.appendChild(el("kbd", null, "Enter"));
  }
  $("btn-clear").hidden = !(n || notes.length || held);
  if (foot) foot.hidden = false;
  renderWhere();
  if (foot) foot.hidden = foot.classList.contains("is-dash") && $("footer-where").hidden;
}

// The workspace label in the footer's middle: `plan2code + 2 folders ·
// branch`, falling back tier by tier (workspace.js) until it fits the slot.
// Before a frame carries the workspace it is today's `folder · branch`, and a
// session opened before the server wrote `worktree` has nothing to show, so
// the slot stays hidden. The footer renders on every tick, so the DOM is only
// touched when the labels change, or when a resize clears the key.
// The project's name: the workspace's original folder, or the session's
// worktree folder before a frame carries the workspace.
function projectName() {
  const folders = workspaceFolders();
  if (folders.length && folders[0].name) return folders[0].name;
  const path = (page.S && page.S.worktree) || "";
  return path ? path.split(/[\\/]/).filter(Boolean).pop() || path : "";
}

// The browser tab's title, led by the project so tabs from different
// projects are told apart. Called from the chrome and the footer, since the
// workspace frame can arrive after either.
function renderTabTitle() {
  if (!page.S) return;
  const name = projectName();
  const title = page.S.title || "Session";
  // A title that defaulted to the folder name says it once, not twice.
  const lead = name && name !== title ? name + " · " : "";
  document.title = lead + title + " · #" + String(page.S.sid || "").slice(-6) + " · Plan2Code";
}

export function renderWhere() {
  const b = $("footer-where");
  const folders = workspaceFolders();
  const path = page.S.worktree || "";
  renderTabTitle();
  const alert = Boolean(folders.length && ((page.wsFrame.missing || []).length || (page.wsFrame.issues || []).length));
  const labels = folders.length
    ? Array.from({ length: FOOTER_TIERS }, (_, tier) => footerLabel({ folders, branch: page.S.branch }, tier))
    : [path ? (path.split(/[\\/]/).filter(Boolean).pop() || path) + (page.S.branch ? " · " + page.S.branch : "") : ""];
  const key = labels.join("\n") + (alert ? "\n!" : "");
  if (b.dataset.key === key) return;
  b.dataset.key = key;
  b.hidden = !labels[0];
  if (b.hidden) return;
  let label = labels[0];
  for (const text of labels) {
    label = text;
    // The project name takes the highlight color, so several consoles side by
    // side tell apart at a glance; the rest of the label stays quiet.
    const name = projectName();
    b.textContent = "";
    if (name && text.startsWith(name)) {
      b.appendChild(el("span", "where-project", name));
      b.appendChild(document.createTextNode(text.slice(name.length)));
    } else {
      b.textContent = text;
    }
    if (alert) {
      const dot = el("span", "where-alert");
      dot.setAttribute("aria-hidden", "true");
      b.appendChild(dot);
    }
    if (b.scrollWidth <= b.clientWidth) break;
  }
  b.title = "Open workspace";
  b.setAttribute("aria-label", "Open workspace: " + label + (alert ? " (a folder needs attention)" : ""));
}

// Everything staged, in the shape /submit takes. Shared by Send and by Stop
// session, which has to carry the same answers the same way: a stop that
// dropped someone's last answers on the floor would be worse than no button.
export function stagedPayload() {
  const actions = [];
  const replyLines = [];
  const sentIds = new Set();
  const summaries = {};
  // Kept so the card can state the answer back in words while it is in flight,
  // the same way a settled one does. `staged` is cleared by the send itself.
  const values = {};

  for (const [id, v] of Object.entries(page.local.staged)) {
    const item = byId(id);
    if (!item) continue;
    sentIds.add(id);
    values[id] = v;
    actions.push({ i: id, ...v });
    // The literal token the terminal flow would have received. This is what
    // lets the agent treat a click exactly like a typed word, so no workflow
    // needs a second code path.
    const tok = tokenFor(item, v);
    summaries[id] = tok;
    if (tok) replyLines.push(`${item.title}: ${indentReply(tok)}`);
  }
  // Which notes, and which of their images, went: markSent clears exactly
  // those, so a note held back on an upload stays drafted.
  const sentNotes = {};
  for (const note of pendingNotes()) {
    sentIds.add(note.id);
    sentNotes[note.id] = new Set(note.images.map((img) => img.key));
    actions.push(noteAction(note.id, note.text, note.images));
    const item = byId(note.id);
    replyLines.push(...noteReplyLines(item ? item.title : note.id, note.text, note.images));
  }
  return { actions, replyLines, sentIds, sentNotes, summaries, values };
}

// After /submit took it: what went is now in flight, and nothing of it stays
// staged or drafted to be sent a second time.
export function markSent({ sentIds, sentNotes = {}, summaries, values }) {
  // Clear every draft belonging to an item in this batch, not just the
  // thread notes. A surviving draft re-populates the field with text that
  // was already sent, and the next keystroke re-stages it WITHOUT the
  // verdict that went with it, which is how an approval gets lost.
  // A note held back on an image upload stays drafted, attachments and all,
  // even when an answer on the same item went. The sent images' files stay
  // on disk for the agent; the sweep cleans them up.
  for (const id of sentIds) {
    for (const prefix of ["other-", "text-", "note-"]) delete page.local.drafts[prefix + id];
    if (sentNotes[id]) {
      delete page.local.drafts["thread-" + id];
      const rest = noteImages(id).filter((img) => !sentNotes[id].has(img.key));
      if (rest.length) page.local.images[id] = rest;
      else delete page.local.images[id];
    } else if (!page.local.images[id]) {
      delete page.local.drafts["thread-" + id];
    }
    page.local.sent[id] = { at: Date.now(), summary: summaries[id] || "", value: values[id] || null };
  }
  page.local.staged = {};
  save();
}

// The menu card whose staged pick is an option marked `fresh`, if any.
function freshMenuPick(actions) {
  for (const a of actions) {
    const item = a.kind === "menu" ? byId(a.i) : null;
    if (item && (item.options || []).some((o) => o.k === a.k && o.fresh === true)) return item;
  }
  return null;
}

export async function send() {
  if (sendState().disabled) return;
  const payload = stagedPayload();
  const { actions, replyLines } = payload;
  if (!actions.length) return;

  const btn = $("btn-send");
  btn.disabled = true;
  btn.textContent = "Sending…";
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions, reply: replyLines.join("\n") }),
    });
    if (res.status === 409) {
      const e = new Error("pending");
      e.pending = true;
      throw e;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const e = new Error(String(res.status));
      e.reason = (body && (body.message || body.error)) || `error ${res.status}`;
      e.status = res.status;
      throw e;
    }
    markSent(payload);
    banner("Sent. Plan2Code is picking it up now.", "good");
    setTimeout(() => banner(null), 4000);
    // A menu option the agent marked `fresh` is a clean start, which under the
    // app is the bar's New Session; the agent still gets the pick, so a
    // declined confirm carries on with its usual finish.
    const freshMenu = page.inApp ? freshMenuPick(actions) : null;
    if (freshMenu) startNewSession(freshMenu.command ? handoffText({ command: freshMenu.command }) : "");
  } catch (err) {
    if (err && err.pending) {
      banner(
        "Your last answers are still being picked up. Nothing is lost, and nothing was sent twice. Try again in a moment.",
        "info"
      );
      page.pendingBannerUp = true;
      page.pendingResult = true;
    } else if (err && err.reason) {
      banner(refusedLine(err), "warn");
    } else {
      await sendLost();
    }
  } finally {
    btn.textContent = "Send to Plan2Code";
    render();
  }
}

// A send that never reached an answer: ask the server at once, rather than
// leaving one line for every cause until the page's own timers catch up. No
// server is the lost-contact state now, with its reconnect help; a server
// still there was a blip, and Send is the whole fix.
async function sendLost() {
  const up = await fetch("/state", { cache: "no-store" })
    .then((res) => res.ok)
    .catch(() => false);
  if (up) {
    banner("That did not go through, but the console is still up. Nothing was lost, press Send again.", "warn");
    return;
  }
  lastContact = 0;
  markGone();
  // A stream left half open (after the machine slept) still reads as
  // connected, so markGone() can leave the page up: the send still needs
  // saying it did not go.
  if (!page.gone) {
    banner("That did not go through. Nothing was lost, try Send again.", "warn");
  }
}

// The server said no. A 5xx can pass on a retry; a 4xx is the same refusal
// every time, so it gets no "try again", and the one a person can fix says how.
function refusedLine(err) {
  if (err.status === 413) return "That is too big to send in one go. Nothing was lost: remove an attachment, then press Send.";
  if (err.status >= 400 && err.status < 500) return `The console turned that send down: ${err.reason}. Nothing was lost.`;
  return `The console turned that send down: ${err.reason}. Nothing was lost, try Send again.`;
}

const STATE_WORDS = { done: "all done", blocked: "blocked", help: "need help", defer: "later" };

// Turn a staged answer into the words the person would have typed in the
// terminal. The agent reads `reply` as their message, so every part of an
// answer has to survive: a verdict AND its note, a checklist state AND what
// they wrote, a reordered list AND its new order. Anything dropped here is
// something the agent never hears.
function tokenFor(item, v) {
  const map = item.token || {};
  if (v.skipped) return v.text ? `skip; ${v.text}` : "skip";
  const parts = [];
  if (v.k) parts.push(map[v.k] || v.k);
  if (Array.isArray(v.ks) && v.ks.length) parts.push(v.ks.map((k) => map[k] || k).join(", "));
  if (v.verdict) parts.push(map[v.verdict] || v.verdict);
  if (typeof v.yes === "boolean") parts.push(map[v.yes ? "yes" : "no"] || (v.yes ? "yes" : "no"));
  if (typeof v.ok === "boolean") parts.push(v.ok ? "confirmed" : "needs changes");
  if (v.state) parts.push(map[v.state] || STATE_WORDS[v.state] || v.state);
  if (Array.isArray(v.done) && v.done.length) parts.push(`did steps ${v.done.map((n) => n + 1).join(", ")}`);
  if (Array.isArray(v.rows)) {
    // What changed against the agent's rows, said in words: `reply` is what
    // the agent reads, and an order alone hides a rename or a removal. The
    // whole list always comes too, called a new order only when one moved.
    const before = new Map((item.rows || []).map((r) => [r.id, r]));
    const after = new Set(v.rows.map((r) => r.id));
    const kept = (item.rows || []).filter((r) => after.has(r.id)).map((r) => r.id);
    const moved = v.rows.filter((r) => before.has(r.id)).some((r, i) => r.id !== kept[i]);
    parts.push((moved ? "new order: " : "the list: ") + v.rows.map((r) => r.title).join(", then "));
    const renamed = v.rows.filter((r) => before.has(r.id) && before.get(r.id).title !== r.title);
    const added = v.rows.filter((r) => !before.has(r.id));
    const removed = (item.rows || []).filter((r) => !after.has(r.id));
    if (renamed.length) parts.push("renamed " + renamed.map((r) => `${before.get(r.id).title} to ${r.title}`).join(", "));
    if (added.length) parts.push("added " + added.map((r) => r.title).join(", "));
    if (removed.length) parts.push("removed " + removed.map((r) => r.title).join(", "));
  }
  if (v.text) parts.push(v.text);
  return parts.join("; ");
}

function fmtMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

/* ----------------------------------------------------------- page chrome */

function toggleMeterPop(open) {
  const pop = $("meter-pop");
  const show = open ?? pop.hidden;
  pop.hidden = !show;
  $("meter-pill").setAttribute("aria-expanded", String(show));
}

let whereResizeTimer = null;

// The listeners that belong to no screen: leaving the page, the session meter's
// pop-over, the footer's label on a resize, Send, Clear, and the page-wide keys.
// A link the console could not hand to a browser is shown, with a Copy
// button, for the person to paste into one.
async function openOutside(href) {
  const ok = await fetch("/open-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: href }),
  })
    .then((res) => res.ok)
    .catch(() => false);
  if (ok) return;
  const link = el("code", "banner-link", href);
  banner("That link could not open from here. Copy it and paste it into your browser: ", "warn", [link, document.createTextNode(" "), copyButton(href, "btn small", link)]);
}

export function wireChrome() {
  addEventListener("pagehide", () => {
    try {
      navigator.sendBeacon("/bye");
    } catch {}
    // A page that goes away leaves no dot on the app's taskbar behind it.
    tellAttention("plain");
  });

  // Under the app, a link off the page goes to the default browser through
  // the console: the app's window opens no new ones, so the click alone would
  // do nothing. Capture phase, ahead of any handler on the link itself.
  document.addEventListener(
    "click",
    (e) => {
      if (!page.inApp || e.defaultPrevented || !(e.target instanceof Element)) return;
      const a = e.target.closest("a[href]");
      if (!a || !linkLeavesPage(a.href, location.origin)) return;
      e.preventDefault();
      openOutside(a.href);
    },
    true
  );

  $("meter-pill").addEventListener("click", () => toggleMeterPop());
  $("meter-help").addEventListener("click", () => {
    toggleMeterPop(false);
    openHelpOn("meter");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || $("meter-pop").hidden) return;
    toggleMeterPop(false);
    $("meter-pill").focus();
  });
  document.addEventListener("click", (e) => {
    if (!$("meter-pop").hidden && !e.target.closest(".meter-slot")) toggleMeterPop(false);
  });

  addEventListener("resize", () => {
    clearTimeout(whereResizeTimer);
    whereResizeTimer = setTimeout(() => {
      if (!page.S) return;
      delete $("footer-where").dataset.key;
      renderWhere();
    }, 100);
  });

  $("btn-send").addEventListener("click", send);
  $("btn-clear").addEventListener("click", () => {
    if (!confirm("Clear everything you have not sent yet?")) return;
    page.local.staged = {};
    // Every typed box, the same set markSent clears: a draft left behind would
    // refill its box on the next render and look as if nothing was cleared.
    const typed = ["thread-", "other-", "text-", "note-"];
    for (const key of Object.keys(page.local.drafts)) if (typed.some((p) => key.startsWith(p))) delete page.local.drafts[key];
    for (const [itemId, list] of Object.entries(page.local.images)) {
      for (const img of list) removeImage(itemId, img.key);
    }
    saveNow();
    redraw();
  });

  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      // Not from behind an open dialog (Brief, Stop, Home, Looks, Help,
      // Workspace): the answers staged underneath are not what is on screen.
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      send();
      return;
    }
    // Escape is the confirm pane's Back — but not while a dialog has it. Native
    // dialogs close themselves on the same key; backing out of the pick at the
    // same time would be two undos for one press.
    if (e.key === "Escape" && page.dashPick && isDashboard() && !finish() && !document.querySelector("dialog[open]")) {
      page.dashPick = null;
      redraw();
    }
  });
}

// The clock, and the one piece of state that changes without anybody doing
// anything: the agent falling silent. renderStatus alone was not enough --
// Planny went quiet and the footer below him carried on promising "one
// moment" with a spinner beside it, because the footer is only drawn by a full
// render and nothing was triggering one. Watch the flip and draw the rest.
let wasAdrift = false;
let wasPastGrace = false;

export function startClock() {
  setInterval(checkIn, 5000);
  setInterval(() => {
    renderStatus();
    const now = agentAdrift();
    if (now !== wasAdrift) {
      wasAdrift = now;
      if (page.S) {
        renderFooter();
        renderStopControls();
      }
    }
    // Crossing the working grace period is the same kind of quiet change: the
    // footer's "wait" line becomes "busy a while" without anybody clicking, and
    // a staged answer's send hatch opens on time instead of at the next render.
    const past = agentWorking() && workingMs() > patience(WORKING_GRACE_MS);
    if (past !== wasPastGrace) {
      wasPastGrace = past;
      if (page.S) renderFooter();
    }
    // The agent coming or going changes whether the chat can be used, with no
    // frame to say so: redraw the Ask pane when that flips. Even mid-typing:
    // the draft is saved on every keystroke and withFocus() keeps the caret,
    // and a composer that looks open while the agent has gone is the worse lie.
    if (page.S && page.view === "ask" && askOfflineFlipped()) redraw();
  }, 1000);
}
