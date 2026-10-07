// Plan2Code Console - the client.
//
// Two objects, strictly separated by ownership:
//   S      the server's truth (state.json). Never mutated here.
//   local  what you have staged but not sent. Mirrored to localStorage on
//          every change, so a closed tab or a reload loses nothing.
//
// Nothing you do reaches the agent until you press Send. Everything before
// that is local and reversible. For someone who has never used a tool like
// this, that reversibility is the whole point.

import { md, el, copyButton, selectContents } from "./render.js";
import { ACCENTS, DEFAULT_ACCENT, DEFAULT_CARD_WIDTH, SOUND_EVENTS, cardWidth, soundKey, soundPrefs } from "./palette.js";
import { activityLabel, workingLine } from "./labels.js";
import { playWake } from "./boot.js";
import {
  answerLines,
  APPROVAL_TIP,
  ALL_DONE_LEAD,
  ALL_DONE_REST,
  approvalHint,
  briefPhrase,
  cardAvailability,
  cardPresentation,
  CATALOG_GROUPS,
  choiceAnswer,
  DASHBOARD_COMMAND,
  DASHBOARD_NOTE,
  DASHBOARD_REPLY,
  dashboardOffer,
  DONE_REPLY,
  finishPaused,
  fitWithin,
  handoffShape,
  handoffText,
  HOME_REPLY,
  homeButtonState,
  IMAGE_LONG_EDGE,
  IMAGE_QUALITY,
  lastOpenCard,
  launchReply,
  MAX_ATTACHMENTS,
  nextOpenAfter,
  MAX_DOC_BYTES,
  DOC_TYPES,
  docExt,
  pickerAccept,
  formatBytes,
  attachmentKind,
  sortAttachments,
  noteAction,
  noteReplyLines,
  progressTotal,
  staleLaunchFeedback,
  quietLimitMs,
  recordedAnswer,
  resumeCommand,
  REVIEW_REPLY,
  reviewOffer,
  SKILL_CATALOG,
  SPEC_STATE_LABELS,
  STALE_MS,
  startPose,
  STOP_REPLY,
  sentAnswer,
  submittedAwaiting,
  noteAwaiting,
  suggestionFrom,
  threadText,
  threadWho,
  THUMB_EDGE,
  turnGate,
  verdictText,
  workflowLabel,
  workflowTitle,
} from "./answers.js";
// `sendState` is renamed on the way in: the card footer already has its own.
import {
  chatOffline,
  chatView,
  newestReplyId,
  nextAbout,
  contextOptions,
  sendState as chatSendState,
  shouldChime,
  unreadDot,
  CHAT_MAX_CHARS,
  CHAT_MAX_ATTACHMENTS,
} from "./chat.js";
import { HELP_TABS, helpTabFor, helpKeyTarget } from "./help.js";
import {
  ROLES,
  ROLE_NOT_SET,
  ROLE_NOT_SET_LABEL,
  normalizeRole,
  needsRoleNudge,
  TEMPLATE_WORKFLOWS,
  templatesFor,
  templateSwap,
  startersFor,
} from "./starters.js";
import { FOOTER_TIERS, footerLabel, nameProblem } from "./workspace.js";
import { RED_BANNER } from "./meter.js";
import { applyMention, matchNames, mentionAt } from "./mentions.js";
import { faviconState, setFavicon } from "./favicon.js";
import {
  CHECKIN_LINE,
  PATHFINDER_RESEARCH_LINE,
  defaultInstruction,
  helperRows,
  showSwitch,
  showTab,
  switchLabel,
} from "./subagents.js";

const $ = (id) => document.getElementById(id);

// The first state, the saved looks and the draft, written into the page by
// the server so the first real screen needs no round trip. A data block, never
// run as script. Absent (an older server, a page opened some other way), the
// page falls back to asking for each as it always did.
const BOOT = (() => {
  try {
    return JSON.parse($("boot").textContent);
  } catch {
    return null;
  }
})();

/* --------------------------------------------------------------- looks */

// How the page looks and sounds, which is the one preference that belongs to
// the person rather than to the session. Kept per browser, applied before
// anything else is drawn, and deliberately touching nothing but presentation:
// a session opened in a different theme is the same session.
//
// The highlight colors live in palette.js, where the tests can reach them.
const ACCENT_VARS = ["--accent", "--accent-soft", "--accent-ink", "--accent-line"];
const LOOKS_KEY = "p2c-console:looks";
// The per-event sound switches (SOUND_EVENTS) live in palette.js too.
const DEFAULT_LOOKS = {
  theme: "system",
  accent: DEFAULT_ACCENT,
  sound: true,
  ...soundPrefs(null),
  width: DEFAULT_CARD_WIDTH,
  hideUnavailable: true,
};

let looks = { ...DEFAULT_LOOKS };
let syncedLooks = null;
let looksReady = false;

function adoptLooks(saved) {
  looks = { ...DEFAULT_LOOKS, ...saved };
  if (!ACCENTS[looks.accent]) looks.accent = DEFAULT_LOOKS.accent;
  if (!["system", "light", "dark"].includes(looks.theme)) looks.theme = DEFAULT_LOOKS.theme;
  if (typeof looks.sound !== "boolean") looks.sound = DEFAULT_LOOKS.sound;
  Object.assign(looks, soundPrefs(looks));
  if (typeof looks.hideUnavailable !== "boolean") looks.hideUnavailable = DEFAULT_LOOKS.hideUnavailable;
  looks.width = cardWidth(looks.width);
  if (saved && typeof saved === "object" && Object.hasOwn(saved, "role")) looks.role = normalizeRole(saved.role);
  else delete looks.role;
}

// The localStorage copy is only a cache now. It exists so the first paint can
// apply a theme synchronously rather than flashing the defaults while the
// fetch below is in flight; the server's looks.json is the truth, because it
// is the copy that follows the app when a new session lands on a new port.
function loadLooks() {
  try {
    const raw = localStorage.getItem(LOOKS_KEY);
    if (raw) adoptLooks(JSON.parse(raw));
  } catch {}
}

// Called once the page is up. Server wins: its copy is shared by every port,
// while this origin's localStorage may be a leftover from a previous session
// on this port or empty on a fresh one. A 404 means the server has never been
// told -- including every install that predates the file -- so a browser that
// DOES hold a setting seeds it, which is also the upgrade path.
async function syncLooks() {
  let saved = null;
  // The server already put its copy in the page: no request, and no second
  // repaint a moment after the first. `looks: null` there is the 404 case.
  if (BOOT && "looks" in BOOT) saved = BOOT.looks ? { looks: BOOT.looks } : null;
  else {
    try {
      const res = await fetch("/looks");
      if (res.ok) saved = await res.json();
    } catch {}
  }
  if (saved && saved.looks && typeof saved.looks === "object") {
    adoptLooks(saved.looks);
    syncedLooks = { ...looks };
    try {
      localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
    } catch {}
    applyLooks();
    renderSwatches();
  } else {
    // Blocked storage throws on read, and that must not stop the page loading.
    let held = false;
    try {
      held = Boolean(localStorage.getItem(LOOKS_KEY));
    } catch {}
    if (held) pushLooks();
  }
  looksReady = true;
  // Not inline: with the server's copy in the page this runs before `S` exists.
  setTimeout(maybeWelcome, 0);
}

// Fire-and-forget mirror. A failed POST costs nothing the next session would
// notice on this port; the localStorage copy still covers the reload case.
function pushLooks() {
  try {
    // Only what this tab changed since it last synced, so a tab with stale
    // settings never overwrites another tab's change to a different key.
    const set = {};
    for (const [k, v] of Object.entries(looks)) if (!syncedLooks || syncedLooks[k] !== v) set[k] = v;
    const before = syncedLooks;
    const partial = Boolean(before);
    if (partial && !Object.keys(set).length) return;
    syncedLooks = { ...looks };
    const body = partial ? { set } : { looks };
    // A write that did not land must be sent again with the next change.
    const undo = () => (syncedLooks = before);
    fetch("/looks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((res) => res.ok || undo())
      .catch(undo);
  } catch {}
}

const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;
const effectiveTheme = () => (looks.theme === "system" ? (systemDark() ? "dark" : "light") : looks.theme);

function applyLooks() {
  const root = document.documentElement;
  // The server's stand-in for the saved accent, which only has to last until
  // this runs. From here on the colors are set below, and a stale rule left
  // switched on would win over "Back to default".
  root.removeAttribute("data-looks-accent");
  if (looks.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", looks.theme);
  // Tell the browser too, so form controls, scrollbars and the date picker
  // follow the choice rather than staying on the system's idea of it.
  root.style.colorScheme = looks.theme === "system" ? "light dark" : looks.theme;
  // Before the accent's early return, so a default accent never skips it.
  if (looks.width === DEFAULT_CARD_WIDTH) root.removeAttribute("data-width");
  else root.dataset.width = looks.width;

  // The default lives in the stylesheet, where it is written once per theme.
  // Clearing the override is how it gets its own values back.
  if (looks.accent === DEFAULT_LOOKS.accent) {
    for (const name of ACCENT_VARS) root.style.removeProperty(name);
    return;
  }
  const shades = ACCENTS[looks.accent][effectiveTheme()];
  ACCENT_VARS.forEach((name, i) => root.style.setProperty(name, shades[i]));
}

function saveLooks() {
  try {
    localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
  } catch {}
  pushLooks();
  applyLooks();
  // A width change reflows the card without resizing the column, so the
  // column's observer never hears of it: refit the growing box here.
  fitGrowBox();
  renderSwatches();
}

// Built once, repainted in place. Rebuilding the row on every choice destroyed
// the button that had just been clicked, so focus fell to <body> and a keyboard
// user lost their place in the dialog each time they tried a color.
function renderSwatches() {
  const box = $("looks-swatches");
  if (!box.children.length) {
    for (const [id, a] of Object.entries(ACCENTS)) {
      const b = el("button", "swatch");
      b.type = "button";
      b.dataset.accent = id;
      b.title = a.name;
      b.setAttribute("aria-label", a.name);
      b.addEventListener("click", () => {
        looks.accent = id;
        saveLooks();
      });
      box.appendChild(b);
    }
  }
  for (const b of box.children) {
    const id = b.dataset.accent;
    const [fill, , , line] = ACCENTS[id][effectiveTheme()];
    b.setAttribute("aria-pressed", String(looks.accent === id));
    // Fill and ring, so the swatch shows the pair the choice actually sets
    // rather than half of it. The chosen one is still told apart by its
    // double ring, which is drawn in ink and owes nothing to the accent.
    b.style.background = fill;
    b.style.borderColor = line;
  }
  for (const radio of document.querySelectorAll('input[name="looks-theme"]')) {
    radio.checked = radio.value === looks.theme;
  }
  for (const radio of document.querySelectorAll('input[name="looks-width"]')) {
    radio.checked = radio.value === looks.width;
  }
  $("looks-sound").checked = looks.sound;
  // Each cue keeps its own tick while the master switch is off, so turning
  // sound back on returns exactly the set that was chosen.
  $("looks-sound-events").classList.toggle("is-off", !looks.sound);
  for (const box of document.querySelectorAll("input[data-sound]")) {
    box.checked = looks[soundKey(box.dataset.sound)];
    box.disabled = !looks.sound;
  }
  $("looks-role").value = looks.role ?? ROLE_NOT_SET;
}

// Following the system means following it as it changes, including the accent,
// whose light and dark shades are different colors.
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (looks.theme === "system") {
    applyLooks();
    renderSwatches();
  }
});

loadLooks();
if (BOOT && BOOT.looks && typeof BOOT.looks === "object") adoptLooks(BOOT.looks);
applyLooks();
syncLooks();

/* ------------------------------------------------------------- sounds

   The cues are the events in SOUND_EVENTS: a skill started from the
   dashboard, Planny snoring and waking, the session opening and ending, a
   new batch of questions, a launched skill ready, a reply on Ask, and a new
   tab joining the strip (a posted document, a spec's overview). Each plays
   only while both the master switch and its own switch are on. A browser will
   not let a page make noise before the person has touched it, so a cue that
   fires too early is held and let out by the first click or keypress rather
   than dropped.

   Only ever one at a time, never two overlapping or back to back. Cues asked
   for in the same task collapse to the highest-ranked one; a cue asked for
   while another is still playing is dropped unless it outranks it, in which
   case it cuts the quieter one off. The held cue is a single slot on the same
   rule, so the first click lets out one sound, not a queue of them.

   Made on first use, not at load: audio downloads racing the page's own
   scripts at start-up are bytes spent on sounds a browser will not play
   before the first click anyway. One Audio per file, shared by the events
   that use it. */
const SOUNDS = {};
let soundQueued = null;
let soundHeld = null;
let soundPlaying = null;

const soundOn = (event) => looks.sound && looks[soundKey(event)];
const soundAudio = (event) => SOUNDS[SOUND_EVENTS[event].file];
const louderSound = (a, b) => (!b || SOUND_EVENTS[a].rank > SOUND_EVENTS[b].rank ? a : b);

function sound(event) {
  if (!soundOn(event)) return;
  if (!soundQueued) queueMicrotask(flushSound);
  soundQueued = louderSound(event, soundQueued);
}

function flushSound() {
  const event = soundQueued;
  soundQueued = null;
  if (!soundOn(event)) return;
  const busy = soundPlaying && !soundAudio(soundPlaying).paused;
  if (busy && SOUND_EVENTS[event].rank <= SOUND_EVENTS[soundPlaying].rank) return;
  if (busy) soundAudio(soundPlaying).pause();
  const { file } = SOUND_EVENTS[event];
  const a = (SOUNDS[file] ||= new Audio(`/${file}.mp3`));
  a.currentTime = 0;
  soundPlaying = event;
  a.play().catch(() => {
    if (soundPlaying === event) soundPlaying = null;
    soundHeld = louderSound(event, soundHeld);
  });
}

// Fades a cue out over `ms` and stops it, so a long one never outlasts the
// moment it belongs to. Timers, not frames: a background tab still finishes.
function fadeSound(event, ms) {
  const a = soundAudio(event);
  if (!a || a.paused) return;
  const from = performance.now();
  const timer = setInterval(() => {
    const left = 1 - (performance.now() - from) / ms;
    if (left > 0 && !a.paused) {
      a.volume = left;
      return;
    }
    clearInterval(timer);
    a.pause();
    a.volume = 1;
  }, 25);
}

for (const evt of ["pointerdown", "keydown"]) {
  window.addEventListener(evt, () => {
    if (!soundHeld) return;
    const name = soundHeld;
    soundHeld = null;
    sound(name);
  });
}

// Run it, on a fenced git block (render.js): stage the block as the Ask
// draft and open the chat. The person still presses Send, so nothing runs
// on a stray click — the same fill-the-box pattern as the Ask starters.
document.addEventListener("click", (e) => {
  const run = e.target.closest(".md-run");
  if (!run) return;
  const code = run.closest(".md-pre-wrap")?.querySelector("code");
  if (!code || !code.textContent.trim()) return;
  local.chat.draft = `run:\n${code.textContent}`;
  view = "ask";
  save();
  render();
  const ta = $("ask-input");
  if (!ta) return;
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
});

// The stars for Planny's flight, made once. Each gets its place and pace as
// custom properties set through the CSSOM: the CSP forbids style attributes
// in markup, and the stylesheet cannot roll dice. They sit still, invisible,
// until the dock is `is-flying`.
(function fillSky() {
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
})();


const GONE_AFTER_MS = 8000;
// Named so a reconnect can clear only THIS banner: a bare banner(null) would
// wipe an unrelated warning that landed while the page was gone (an upload
// failure, a refused send).
const GONE_BANNER = "Lost contact with Plan2Code. Nothing you have typed is lost. This page reconnects by itself.";
const WORKING_GRACE_MS = 5 * 60 * 1000;
// Two minutes with the agent mid-turn, three when it is merely meant to be
// listening. The difference is the cost of being wrong: a working agent that
// goes quiet is worth mentioning early, whereas the gap between `wait`
// returning and the next patch landing is ordinary and must not be called a
// failure. `wait` pokes /health every five seconds, so either threshold is
// many missed pokes, not a slow one.
const ADRIFT_MS = 3 * 60 * 1000;

let S = null;
let rev = 0;
let agentLastSeen = null;
let pendingResult = false;
let pendingStop = false;
let lastContact = Date.now();
let gone = false;
let selected = null;
let view = "questions";
// Where each tab was scrolled, keyed by view id, so switching away and back
// lands where the person left it. Page-side only and never persisted: a reload
// starts every tab at its top. `drawnView` is the tab the DOM currently shows,
// which `view` stops naming the moment a tab click sets it.
const scrollMemory = new Map();
let drawnView = null;
// The tab ids the strip last drew, so a tab the agent or page adds (a posted
// document, a spec's overview) can replay the runway chevrons. Null until the
// first draw, which the load pulse already covers.
let drawnTabs = null;
// The spec's overview.md as last fetched: `key` is the spec dir it was read
// for, `text` the file, or null when there is none. See loadOverview().
let overview = { key: null, text: null };
// The dashboard's first-open wake-up (boot.js), while it runs. `cards` turns
// true at the glide, which lets the menu in; `entered` once its entrance has
// played; `typed` is how many characters of the note show, or null once all
// of them do. Page-local: the reload guard is sessionStorage (maybeWake).
let wake = null;
// Once per page, whatever storage allows: a re-render mid-run must never
// start a second one.
let wakeTried = false;
// True when a wake-up is waiting on the first click: the page load's opening
// chime then gives way to the boot-up sound, played as he powers on.
let wakeHoldsChime = false;
// His snore while he sleeps (an Audio on loop), or null. Usually silent until
// the waking click, since browsers refuse sound before one.
let snore = null;
// The dashboard pick being looked at on the confirm pane, before START is
// pressed. Page-local like `view` — a reload simply shows the menu again.
let dashPick = null;
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

// The Quick question chat. `chatFrame` is the server's view of the current
// conversation (the frame's `chat` block); everything else here is page-local
// and gone on a reload. `chatDot` is the Ask tab's dot as last drawn, so a
// reply chimes once; `askRowCount` is how many rows the pane last showed, so
// a new one scrolls into view; `docInView` is the doc block nearest the top.
let chatFrame = null;
// The frame's workspace ({ folders, missing, remote, issues }) and meter
// ({ points, level, fraction, words, tooltip }), or null before a server that
// sends them.
let wsFrame = null;
let meterFrame = null;
// The frame's update ({ installed, latest }), present only when a newer
// release is out; null otherwise.
let updateFrame = null;
// The frame's Subagents switch ({ offered, supported, on, instruction, max,
// revision }), or null before a server that sends it.
let subagentsFrame = null;
let chatDot = false;
let chatSending = false;
let chatResetting = false;
let chatError = "";
let askRowCount = 0;
let askPaintedOffline = false;
let docInView = null;
let docObserver = null;
const declineOpen = new Map();
const deciding = new Set();
// What the about tracker last saw, so only a change is an event.
const aboutSeen = { view: null, selected: undefined, spec: undefined };
// The chat's images live under local.chat, not beside the notes: the card
// send gathers every entry of local.images, and a chat picture is not a note.
const CHAT_IMAGES = "__chat";

let local = fresh();

// The question card currently on screen, so the quiet staging path can find its
// border and pill again without a DOM search. Replaced on every renderCard.
let cardMarks = null;

function fresh() {
  // `stopping` is set once a stop request has been accepted, and kept here so
  // a reload in the middle of wrapping up comes back to the same screen.
  // `afterBuild` is "review", "done" or "dashboard" once a finished session's
  // offer has been answered, so the buttons do not come back on a reload.
  // `homeward` is set once the top bar's Back to the dashboard request has
  // been accepted mid-workflow: { at }. The resume through the dashboard
  // resets `local` wholesale, which is what clears it.
  // `launching` is the dashboard's pick while the launched skill turns the
  // page: { skill, title, at }. Kept here so a reload mid-handoff comes back
  // to the getting-ready screen rather than the menu it already answered.
  // `specSel` is the dashboard picker's spec dir, or null for "start from
  // scratch". Left ABSENT until the picker is touched, which is how the
  // default (most recently touched spec) differs from a deliberate scratch.
  // `retract` marks a send the person took back, keyed to the send's `at` so
  // it suppresses exactly that `submitted` record and no later one.
  // `images` is each note's attachments, keyed by item id:
  // [{ key, id, path, url, name, status }], status "uploading" | "ready" | "failed".
  return {
    staged: {},
    drafts: {},
    images: {},
    sent: {},
    stopping: null,
    afterBuild: null,
    homeward: null,
    launching: null,
    retract: {},
    chat: freshChat(),
  };
}

// The Ask pane's own corner of `local`: the composer's draft and pictures,
// what the next message is about, sends still on their way, and the newest
// reply already seen (the dot). `conversation` is the one these belong to.
function freshChat() {
  return {
    draft: "",
    history: [],
    about: null,
    pending: [],
    lastSeenReplyId: null,
    images: [],
    conversation: null,
  };
}

function storeKey() {
  return "p2c-console:" + (S ? S.sid : "pending");
}

function save() {
  try {
    localStorage.setItem(storeKey(), JSON.stringify(local));
  } catch {}
  clearTimeout(draftTimer);
  draftTimer = setTimeout(pushDraft, 600);
}

function load() {
  try {
    const raw = localStorage.getItem(storeKey());
    if (raw) local = { ...fresh(), ...JSON.parse(raw) };
  } catch {
    local = fresh();
  }
  // Saved before context became a pick: an about set on its own must not
  // survive the upgrade. Asked of the saved copy, before freshChat() fills
  // in an empty history.
  const upgraded = !Array.isArray(local.chat && local.chat.history);
  local.chat = { ...freshChat(), ...(local.chat || {}) };
  if (upgraded) {
    local.chat.history = [];
    local.chat.about = null;
  }
  delete local.chat.frozen;
  delete local.chat.dropped;
  // A "Skipped" beat is a moment, not something to come back to on a reload.
  delete local.skipFlash;
  // A chat send still on its way when the page went died with the old page:
  // offered for Retry, never left saying "Sending…". If it did land, the
  // frame's echo still hides it.
  for (const p of local.chat.pending) if (!p.seq) p.failed = true;
  settleStaleUploads();
}

// An upload still marked in flight when the page loads died with the old page.
function settleStaleUploads() {
  for (const list of [...Object.values(local.images || {}), local.chat.images]) {
    for (const img of list) if (img.status === "uploading") img.status = "failed";
  }
}

async function pushDraft() {
  try {
    await fetch("/draft", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staged: local.staged, drafts: local.drafts, images: local.images }),
    });
  } catch {}
}

/* ------------------------------------------------------------ selectors */

const items = () => (S && Array.isArray(S.items) ? S.items : []);
const topics = () => (S && Array.isArray(S.topics) ? S.topics : []);
const docs = () => (S && Array.isArray(S.docs) ? S.docs : []);
const byId = (id) => items().find((i) => i.id === id);
const isOpen = (i) => i.status === "open" || i.status === "reopened";
const asked = () => items().filter((i) => i.kind !== "notice");
const openItems = () => asked().filter(isOpen);
const stagedCount = () => Object.keys(local.staged).length;

// The one thing the page could never know before: this session is OVER, and
// the agent said so rather than the page inferring it. Everything else here is
// a pause -- no open questions means "none right now", not "no more ever" --
// which is why the end of a session used to read as a lull that never lifted.
// A posted finish is the whole signal; its command is optional, because some
// sessions end with nothing left to run.
const finish = () => (S && S.finish && typeof S.finish === "object" ? S.finish : null);

// The dashboard is the one workflow that is not a conversation: a menu of the
// skills, rendered from the page's own catalog, where a click IS the answer.
const isDashboard = () => S && S.workflow === "dashboard";

// The server's scan of the repo — AGENTS.md plus every spec under specs/,
// classified by pipeline stage and sorted most-recently-touched first.
const scan = () => (S && S.scan) || null;
const specList = () => {
  const sc = scan();
  return sc && Array.isArray(sc.specs) ? sc.specs : [];
};

// The spec the picker currently targets. Absent `specSel` means the picker
// has not been touched, so it defaults to the most recently touched spec —
// the first entry of the server's already-sorted list. An explicit "start
// from scratch" is stored as null, which is different.
const selSpec = () => {
  const specs = specList();
  if (!specs.length) return null;
  if (local.specSel === undefined) return specs[0];
  return specs.find((s) => s.dir === local.specSel) || null;
};

// The review a finished build offers, and where it has got to:
//   "open"   on offer, and a press would reach the agent
//   "asked"  pressed, and the agent has not taken it up yet
//   null     no offer, declined, or nobody left to take the press
// `local.afterBuild` remembers the press across a reload. It is cleared when
// the finish goes away, which is the agent taking the review up.
function reviewPending() {
  const fin = finish();
  if (!fin || !reviewOffer(fin) || local.afterBuild === "done" || local.afterBuild === "dashboard") return null;
  if (local.afterBuild === "review") return gone ? null : "asked";
  return gone ? null : "open";
}

// The dashboard offer on a finish, unless the person already said they are
// done: that send closes the session, so a button after it would go nowhere.
const dashboardLive = (fin) => dashboardOffer(fin) && local.afterBuild !== "done";

// The durable half of `local.sent`: the server writes every send onto the
// item itself (`submitted`), so the send survives a reload, a resume onto a
// new port, and a second tab. It also covers an agent that took the answer
// and moved on without marking the item settled, which used to hand the
// question back looking as though the send never happened. `local.retract`
// is the person's "take it back" against exactly that send.
const submittedInFlight = (i) => {
  const sub = submittedAwaiting(i);
  if (!sub) return null;
  const r = local.retract && local.retract[i.id];
  if (r === "any" || (r != null && r === sub.at)) return null;
  return sub;
};

// Open questions whose send is with the agent: answers and notes alike. On a
// finished session there is nobody left to collect a send, so nothing is in
// flight either -- the item is a record of what was sent, not a live wait.
const awaitingReply = () =>
  finish()
    ? []
    : openItems().filter((i) => (local.sent && local.sent[i.id]) || submittedInFlight(i));

// Open questions that are actually the person's to answer right now. An open
// question they have already sent is not one of those, and counting it as one
// is how the page ends up telling someone it is their turn while they are
// sitting waiting for a reply. A finished session ends everyone's turn:
// questions left open are moot, because a send can no longer go anywhere.
const myTurn = () =>
  finish()
    ? []
    : openItems().filter((i) => !(local.sent && local.sent[i.id]) && !submittedInFlight(i));

// Questions that are theirs and still have no answer on them. This is what
// decides which control is the loud one: while this is non-empty the next
// question is the step, and Send is merely available.
const unanswered = () => myTurn().filter((i) => !local.staged[i.id]);

function agentWorking() {
  return S && S.agent && S.agent.status === "working";
}

function workingMs() {
  if (!agentWorking() || !S.agent.since) return 0;
  return Date.now() - Date.parse(S.agent.since);
}

// The three silence thresholds below, stretched while the agent has said a
// long quiet stretch is normal (a build task). See quietLimitMs.
const patience = (baseMs) => quietLimitMs(S && S.agent, baseMs);

// What the agent says it is doing right now, when it has said: "Task 3 of 9:
// the user service". Only meaningful while it is working. A build's line is
// rewritten (activityLabel() in labels.js) because agents trained on the old
// wording still write "Task 4.3 of 9", phase-numbered beside a bar that counts
// within the phase; the page puts it right rather than every prompt having to.
function activity() {
  if (!agentWorking()) return "";
  const a = S.agent.activity;
  if (typeof a !== "string") return "";
  return activityLabel(a.trim(), S.workflow);
}

const doingNow = () => workingLine(S && S.agent, S && S.headline, S && S.workflow);

function agentStale() {
  if (!agentLastSeen) return false;
  return Date.now() - Date.parse(agentLastSeen) > patience(STALE_MS);
}

// The OTHER end of the wire, and the one that was invisible.
//
// There are two connections here, not one. The page talks to a little server
// on this machine (`gone` covers that), and the server is polled by the agent
// sitting in `wait` (this covers that). The second is the one that actually
// breaks: a page left open pings every five seconds, which keeps the server
// well clear of its idle deadline, so the server happily outlives the agent
// for hours. Until now nothing said so unless the agent had also declared
// itself "working", and the normal state while someone answers is "waiting".
function agentAdrift() {
  if (!agentLastSeen || gone || finish()) return false;
  return Date.now() - Date.parse(agentLastSeen) > patience(ADRIFT_MS);
}

// Answers that went nowhere: pressed Send, and nothing has collected them.
// They are safe -- the server wrote them to disk and the next session picks
// them up -- but "Sent. Waiting for Plan2Code." forever does not say that.
const stranded = () => pendingResult && agentAdrift();

// The spec whose overview.md the Overview tab shows: the dashboard picker's
// selection on the dashboard, the session's own spec everywhere else.
const overviewSpec = () => (isDashboard() ? selSpec()?.dir || "" : (S && S.specDir) || "");

// Fresh from disk every time, never cached: the file changes under a build,
// and the tab is only worth having if it shows what is there now. Repaints
// only when the tab would appear, vanish or show different text.
async function loadOverview() {
  const spec = overviewSpec();
  let text = null;
  if (spec) {
    try {
      const res = await fetch("/overview?spec=" + encodeURIComponent(spec), { cache: "no-store" });
      if (res.status === 200) text = await res.text();
    } catch {}
  }
  // The selection moved on while this was in flight; its own fetch will land.
  if (spec !== overviewSpec()) return;
  const changed = overview.key !== spec || overview.text !== text;
  overview = { key: spec, text };
  if (changed) render();
}

/* --------------------------------------------------------------- input */

function stage(id, value) {
  if (value == null) delete local.staged[id];
  else local.staged[id] = value;
  save();
  render();
}

function setDraft(id, text) {
  local.drafts[id] = text;
  save();
}

/* --------------------------------------------------------------- fetch */

async function loadState() {
  try {
    const res = await fetch("/state", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const body = await res.json();
    // The same rev is the same state: adopting it again would redraw the page
    // every few seconds while polling for nothing. Still proof of life, though.
    if (S && typeof body.rev === "number" && body.rev === rev) {
      lastContact = Date.now();
      agentLastSeen = body.agentLastSeen || agentLastSeen;
      markGone();
    } else {
      adopt(body);
    }
    retryStream();
  } catch {
    markGone();
  }
}

function adopt(body) {
  const firstLoad = S === null;
  // What was already theirs to answer, measured BEFORE the new state lands,
  // so what is theirs afterwards can be told apart from what just arrived.
  const before = firstLoad ? null : new Set(myTurn().map((i) => i.id));
  const wasFinished = Boolean(finish());
  const prevWorkflow = S ? S.workflow : null;
  const prevSpecDir = S ? S.specDir : null;
  rev = body.rev;
  lastHave = body.have || null;
  S = body.state;
  agentLastSeen = body.agentLastSeen || null;
  pendingResult = Boolean(body.pendingResult);
  pendingStop = Boolean(body.pendingStop);
  chatFrame = body.chat || null;
  if (body.workspace) wsFrame = body.workspace;
  if (body.meter) meterFrame = body.meter;
  // Always replaced: an absent key means no update.
  updateFrame = body.update || null;
  // Always replaced too: an older server sends none, and then there is no switch.
  subagentsFrame = body.subagents || null;
  lastContact = Date.now();
  if (gone) {
    gone = false;
    if ($("banner").textContent === GONE_BANNER) banner(null);
  }
  if (firstLoad) {
    load();
    // A draft the server kept wins if this browser has nothing, which is how a
    // second device or a cleared profile still picks up where you left off.
    if (!Object.keys(local.staged).length && body.draft && body.draft.staged) {
      local.staged = body.draft.staged;
      local.drafts = body.draft.drafts || {};
      local.images = body.draft.images || {};
      settleStaleUploads();
    }
  }
  // The page passed through the dashboard (a launch from its menu, or back to
  // it). The server already blanked the session; what this page kept for the
  // last skill -- the question on screen, the open tab, anything staged or
  // typed against its item ids -- goes too. The launch in flight and the
  // dashboard's spec pick are about the hand-off itself, so they stay. A skill
  // run inline from another (a quick task's review) keeps all of it.
  const viaDashboard = prevWorkflow === "dashboard" || S.workflow === "dashboard";
  if (prevWorkflow && prevWorkflow !== S.workflow && viaDashboard) {
    local = { ...fresh(), launching: local.launching, ...("specSel" in local ? { specSel: local.specSel } : {}) };
    save();
    selected = null;
    view = "questions";
    // And forget which tab is drawn, or the next render would store the old
    // skill's offset straight back under a tab id the new one may reuse.
    scrollMemory.clear();
    drawnView = null;
    drawnTabs = null;
  }
  adoptChat();
  // The finish a review was asked from has gone: the agent took the review
  // up. A later finish (after the review, or after a second phase) starts
  // with its own offer unanswered.
  if (!finish() && local.afterBuild) {
    local.afterBuild = null;
    save();
  }
  // A way home that ended in a finish instead (the agent paused rather than
  // resuming as the dashboard) is over: the finish screen says the rest.
  if (finish() && local.homeward) {
    local.homeward = null;
    save();
  }
  // The end of the session is a page of its own in the rail. Landing there
  // the moment the finish arrives keeps it where the current design already
  // put it: on top. A finish that goes away (a review taken up) drops the
  // page back to the questions with it.
  const endLanded = Boolean(finish()) && !wasFinished;
  if (endLanded) {
    view = "end";
    // The closing chime -- unless this page only just loaded into an already
    // finished session, in which case the opening one IS this sound.
    if (!firstLoad) sound("sessionEnd");
  }
  if (!finish() && view === "end") view = "questions";
  // A launch ends the moment the launched skill turns the page: it resumes the
  // session under its own workflow, so `dashboard` stops being what the state
  // says it is. A finish while still on the dashboard is the launch declined
  // or the session ended; either way the menu is not mid-handoff any more.
  if (!isDashboard() || finish()) dashPick = null;
  // A launch (or an ending) mid wake-up: cut it short rather than play on
  // over a page that is no longer the menu.
  if (wake && (!isDashboard() || finish())) wake.abort.abort();
  if (local.launching && (!isDashboard() || finish())) {
    const was = local.launching;
    local.launching = null;
    save();
    // A resume that lands before the skill has said anything turns the page
    // into its starting screen, which is not "ready" yet: the chime and the
    // banner wait for the first thing it actually puts on the page.
    if (!finish() && (asked().length || doingNow() || docs().length)) {
      sound("skillReady");
      banner(`${was.title} is ready.`, "good");
      clearTimeout(arrivalBannerTimer);
      arrivalBannerTimer = setTimeout(() => !gone && banner(null), 4000);
    }
  }
  // Anything the agent has now recorded is no longer "staged" or in flight.
  for (const id of Object.keys(local.staged)) {
    const item = byId(id);
    if (!item || !isOpen(item)) delete local.staged[id];
  }
  // A question stops being in flight when the agent has dealt with it: either
  // it settled the question, or it has replied and left it open, which means it
  // is asking again and the person may answer again.
  const replied = !pendingResult && !agentWorking();
  for (const id of Object.keys(local.sent || {})) {
    const item = byId(id);
    if (!item || !isOpen(item) || replied) delete local.sent[id];
  }
  // A retracted send suppresses exactly that send. Once the item moves --
  // settled, sent again (a new `at`), or answered by an agent reply -- the
  // mark is stale and keeping it would hide a send that is not that one.
  for (const id of Object.keys(local.retract || {})) {
    const item = byId(id);
    const r = local.retract[id];
    const live =
      item &&
      isOpen(item) &&
      submittedAwaiting(item) &&
      (r === "any" || (item.submitted && item.submitted.at === r));
    if (!live) delete local.retract[id];
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
      arrivalBannerTimer = setTimeout(() => !gone && banner(null), 8000);
    } else {
      selected = arrived[0].id;
      view = "questions";
      announce = arrived;
    }
  }

  if (!selected || !byId(selected)) selected = pickDefault();
  // A reply that lands while another tab is open: a dot on Ask, and one chime.
  // Not on the first load, which has nothing new to announce.
  const dot = unreadDot({ lastSeenReplyId: local.chat.lastSeenReplyId, frameChat: chatFrame, viewIsAsk: view === "ask" });
  if (!firstLoad && shouldChime(chatDot, dot)) sound("chatReply");
  chatDot = dot;
  render();
  if ($("workspace-modal").open) renderWorkspace();
  tellFolderIssues();
  // The Overview tab's file changes under a build, so a tab you are watching
  // refetches on every new frame too, not only on the click that opened it.
  if (firstLoad || S.specDir !== prevSpecDir || S.workflow !== prevWorkflow || view === "overview") loadOverview();
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
  const conv = chatFrame ? chatFrame.conversation : null;
  if (conv != null && conv !== local.chat.conversation) {
    if (local.chat.conversation == null) local.chat.conversation = conv;
    else if (conv > local.chat.conversation) {
      local.chat = { ...freshChat(), history: local.chat.history, about: null, conversation: conv };
      chatError = "";
      askRowCount = 0;
      declineOpen.clear();
    }
    save();
  }
  if (local.chat.pending.length) {
    const shown = new Set(
      chatView(chatFrame, { pendingSends: local.chat.pending })
        .rows.filter((r) => r.pending)
        .map((r) => r.tempId)
    );
    const still = local.chat.pending.filter((p) => shown.has(p.tempId));
    if (still.length !== local.chat.pending.length) {
      local.chat.pending = still;
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
  if (bad && !gone) {
    gone = true;
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
  } else if (!bad && gone) {
    gone = false;
    if ($("banner").textContent === GONE_BANNER) banner(null);
    render();
  }
}

/* ----------------------------------------------------------------- SSE */

// Exactly one EventSource for the life of the page. Browsers cap HTTP/1.1 at
// about six connections per origin and a stream holds one permanently, so a
// second stream per tab across a few tabs wedges the origin with no error.
function connect() {
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
    if (Array.isArray(ids)) for (const id of ids) delete local.staged[id];
    else local.staged = {};
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

setInterval(() => {
  fetch("/ping", { method: "POST" })
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => {
      if (!body) return;
      lastContact = Date.now();
      agentLastSeen = body.agentLastSeen || agentLastSeen;
      retryStream();
      // A rev we have not seen means a state frame went missing -- a dropped
      // SSE reconnect, a tab asleep in a background window. Ask for it rather
      // than waiting for the next change to come along.
      if (typeof body.rev === "number" && body.rev !== rev) return loadState();
      if (body.pendingResult !== pendingResult || Boolean(body.pendingStop) !== pendingStop) {
        pendingResult = body.pendingResult;
        pendingStop = Boolean(body.pendingStop);
        render();
      }
    })
    .catch(() => {})
    .finally(() => {
      markGone();
      renderStatus();
    });
}, 5000);

addEventListener("pagehide", () => {
  try {
    navigator.sendBeacon("/bye");
  } catch {}
});

/* -------------------------------------------------------------- render */

let rendering = false;

function render() {
  if (!S) return;
  // A handler that fires while the DOM is being replaced (a blur as its element
  // is removed, say) must not start a second render inside the first.
  if (rendering) return;
  rendering = true;
  try {
  trackAbout();
  const enteringAsk = view === "ask" && drawnView !== "ask";
  const switchingTab = drawnView !== null && view !== drawnView;
  let tabAdded = false;
  rememberScroll();
  withFocus(() => {
    renderChrome();
    renderStatus();
    renderBriefButton();
    renderSubagentsButton();
    renderStopButton();
    renderHomeButton();
    tabAdded = renderViews();
    renderSidebar();
    renderMain();
    restoreScroll();
    renderAside();
    renderFooter();
  });
  // The box an `@` list belonged to was just redrawn away.
  if (mentionPop && !mentionPop.box.isConnected) closeMentions();
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
  const before = local.chat;
  let st = { history: before.history, about: before.about };
  const apply = (event) => (st = nextAbout(st, event));
  const moved = aboutSeen.view !== view;
  if (moved && aboutSeen.view && aboutSeen.view.startsWith("doc:") && docInView?.docId === aboutSeen.view.slice(4)) {
    apply({ type: "section", ...docInView });
  }
  if (isDashboard()) {
    const spec = selSpec();
    const dir = spec ? spec.dir : null;
    if (dir !== aboutSeen.spec) {
      aboutSeen.spec = dir;
      if (spec) apply({ type: "spec", dir: spec.dir, label: spec.name });
    }
  } else if (selected !== aboutSeen.selected) {
    aboutSeen.selected = selected;
    const item = byId(selected);
    if (item && item.kind !== "notice") apply({ type: "card", id: item.id, label: item.title });
  }
  if (moved) aboutSeen.view = view;
  if (st.history !== before.history || st.about !== before.about) {
    Object.assign(local.chat, st);
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
// The scroll is restored only while the same question is on screen. Moving to
// another one should start at its top, not part-way down it.
function withFocus(fn) {
  const a = document.activeElement;
  const keep =
    a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT") && a.id
      ? { id: a.id, start: a.selectionStart, end: a.selectionEnd }
      : null;
  const before = $("main").querySelector(".card.question");
  const place = before && before.scrollTop ? { of: before.dataset.item, top: before.scrollTop } : null;

  fn();

  // Scroll first, then focus: focusing an element that is off screen scrolls it
  // into view, which would undo the restore we just did.
  const after = $("main").querySelector(".card.question");
  // Which question the card on screen HOLDS, asked of the card itself. The
  // `selected` variable is no use here: the rail and the pager both set it and
  // then call render, so by now it already names where we are going.
  if (place && after && after.dataset.item === place.of) after.scrollTop = place.top;
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
  if (view === drawnView) return;
  drawnView = view;
  // The chat places its own list: back where it was, or at the newest row.
  if (view === "ask") return;
  const scroller = currentScroller();
  if (!scroller) return;
  const saved = scrollMemory.get(view);
  if (view === "questions") {
    if (saved && saved.item === scroller.dataset.item) scroller.scrollTop = saved.top;
    return;
  }
  scroller.scrollTop = saved ? saved.top : 0;
}

// `extras` are nodes shown after the text: a copyable hint, an action.
function banner(text, kind, extras) {
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

// Folders the agent reported it cannot read, each told once per page load
// and launch. The server keeps only the current launch's reports, so a name
// that drops out of the list may be told again after the next launch.
const issuesTold = new Set();
let issueBannerTimer = null;

function tellFolderIssues() {
  const issues = (wsFrame && wsFrame.issues) || [];
  const names = new Set(issues.map((i) => i.name));
  for (const name of [...issuesTold]) if (!names.has(name)) issuesTold.delete(name);
  const fresh = issues.find((i) => !issuesTold.has(i.name));
  if (!fresh) return;
  issuesTold.add(fresh.name);
  const extras = [];
  if (fresh.hint) {
    extras.push(document.createTextNode(" "));
    extras.push(el("code", "banner-hint", fresh.hint));
  }
  const open = el("button", "btn tiny banner-action", "Open workspace");
  open.type = "button";
  open.addEventListener("click", () => {
    banner(null);
    openWorkspace();
  });
  extras.push(open);
  banner(`The agent can't read @${fresh.name}: ${fresh.reason}`, "warn", extras);
  clearTimeout(issueBannerTimer);
  // Then the next folder waiting to be told, if several came at once.
  issueBannerTimer = setTimeout(() => {
    if (gone) return;
    banner(null);
    tellFolderIssues();
  }, 15000);
}

// The session meter's pill, straight from the frame's `meter` (meter.js did
// the counting). Hidden until a frame carries it.
function renderMeter() {
  const pill = $("meter-pill");
  if (!meterFrame) {
    pill.hidden = true;
    return;
  }
  pill.hidden = false;
  pill.dataset.level = meterFrame.level;
  const fraction = Math.max(0, Math.min(1, Number(meterFrame.fraction) || 0));
  $("meter-fill").setAttribute("stroke-dashoffset", String(Math.round((1 - fraction) * 1000) / 10));
  $("meter-words").textContent = meterFrame.words;
  pill.title = meterFrame.tooltip;
  $("meter-tip").textContent = meterFrame.tooltip;
  // What the points are made of: one row per piece of work that scored.
  const list = $("meter-list");
  const rows = Array.isArray(meterFrame.items) ? meterFrame.items : [];
  list.hidden = !rows.length;
  list.replaceChildren(
    ...rows.map((row) => {
      const li = el("li");
      li.appendChild(el("span", "meter-item-label", row.label));
      li.appendChild(el("span", "meter-item-points", "+" + row.points));
      return li;
    })
  );
  // Once the session is past fresh, say how to start a new one.
  const fresh = $("meter-fresh");
  fresh.hidden = meterFrame.level === "green";
  if (fresh.hidden || fresh.dataset.built) return;
  fresh.dataset.built = "1";
  const text = handoffText({ command: DASHBOARD_COMMAND });
  const code = el("code", "handoff-code", text);
  const row = el("div", "handoff-command meter-fresh-row");
  row.append(code, copyButton(text, "btn small ghost handoff-copy", code));
  fresh.append(
    textWithCode("p", "meter-fresh-text", `To start a new session, run \`${DASHBOARD_COMMAND}\` in a new conversation:`),
    row
  );
}

function toggleMeterPop(open) {
  const pop = $("meter-pop");
  const show = open ?? pop.hidden;
  pop.hidden = !show;
  $("meter-pill").setAttribute("aria-expanded", String(show));
}

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

function renderChrome() {
  renderMeter();
  $("title").textContent = S.title || "Session";
  $("badge").textContent = workflowLabel(S.workflow);
  renderTabTitle();

  const h = S.headline || {};
  // On a finished session an open item is frozen: the send on it counts as
  // done, and only a question that was never touched stays outstanding.
  const done =
    Number(h.cleared) ||
    asked().filter((i) => !isOpen(i) || (finish() && Boolean(recordedAnswer(i)))).length;
  const total = progressTotal(done, Number(h.total) || asked().length);
  const pct = total ? Math.round((done / total) * 100) : 0;

  // A build counts tasks, which get done rather than answered.
  const building = ["implement", "implement-review", "quick-task"].includes(S.workflow);
  $("progress-text").textContent = total
    ? `${done} of ${total} ${building ? "done" : "answered"}`
    : h.stage || "Getting started";
  $("confidence").textContent = h.confidence || "";
  $("progress-fill").style.width = pct + "%";
  const bar = $("progress-bar");
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
function renderStatus() {
  if (!S) return;
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
  const say = (mood, line, count, spin) => {
    if (mood !== moodNow) {
      moodNow = mood;
      moodVar = Math.floor(Math.random() * MOOD_VARIANTS[mood]);
    }
    bot.setAttribute("class", `planny is-${mood} v${moodVar}`);
    if (text.dataset.line !== line) {
      text.dataset.line = line;
      text.replaceChildren(
        ...line.split(/\*\*(.+?)\*\*/).map((part, i) => {
          if (i % 2 === 0) return document.createTextNode(part);
          const key = document.createElement("strong");
          key.className = "agent-key";
          key.textContent = part;
          return key;
        })
      );
    }
    tick.textContent = count || "";
    $("agent-spin").hidden = !spin;
    $("dock").classList.toggle("is-flying", Boolean(spin));
    // The tab icon's bar says the same thing from another tab (favicon.js).
    setFavicon(faviconState({ mood, spin, finished: Boolean(finish()) }));
  };

  // Before `gone`, deliberately. Once a session has finished, no server is the
  // expected state, and Planny shutting his eye over it reads as a breakage.
  if (finish()) {
    // A finish with the review or the way back to the dashboard still on
    // offer has something left to press here, and only while the server is
    // there to take the press.
    if (local.afterBuild === "dashboard" && !gone) return say("work", "Opening the dashboard…", "", true);
    const offer = reviewPending();
    if (dashboardLive(finish()) && !gone && !offer) {
      return say("point", "Done. Head back to the dashboard, or close this tab.");
    }
    if (offer === "asked") return say("work", "Review requested. Plan2Code is starting it.", "", true);
    if (offer === "open") return say("point", "Done. Review it here first, or close this tab.");
    return say("done", "All done. You can close this tab.");
  }
  if (gone) return say("gone", "Not connected. Your answers are saved.");
  // On the way home: the request is sent, and the page stays this skill's
  // until the agent resumes the session as the dashboard.
  if (local.homeward && !isDashboard()) {
    return agentAdrift()
      ? say("adrift", "Your way back to the dashboard is saved and waiting for Plan2Code.")
      : say("work", "Saving your place and opening the dashboard…", "", true);
  }
  // The dashboard's three states, ahead of the question logic it never
  // reaches: the pick is theirs to make, it is being looked at, or it is on
  // its way to becoming a skill.
  if (isDashboard()) {
    if (local.launching) {
      const stale = staleLaunchFeedback(local.launching.title, agentAdrift());
      return stale
        ? say("adrift", `${local.launching.title} is saved and waiting for Plan2Code.`)
        : say("work", `Waking up ${local.launching.title}…`, "", true);
    }
    if (dashPick) return say("point", `Start ${dashPick.title} when you're ready.`);
    return say("point", "Your move: pick what we are doing today.");
  }
  // A build can run a long while before it has anything to ask. Once the agent
  // says what it is doing, the working line below says that instead, rather
  // than promising questions that may never come.
  if (!asked().length && !doingNow()) return say("work", `Starting ${workflowTitle(S.workflow)}…`, "", true);

  // Show the AGENT's liveness, not the server's: if the agent's turn crashed
  // the server is still happily up, and a plain spinner would lie forever.
  if (agentWorking()) {
    if (agentStale()) {
      return say(
        "work",
        "Still working on it. Longer tasks can go a few minutes between updates. Your answers are saved. If it stays quiet for a long while, check your terminal (it may be waiting on a permission approval)."
      );
    }
    // Same clock as agentStale(), so the soft line at 30 s hands over to the
    // stale message at two minutes on one timeline.
    const hint = agentLastSeen ? approvalHint(S.agent, Date.now() - Date.parse(agentLastSeen)) : "";
    return say("work", hint || activity() || "Plan2Code is thinking…", fmtMs(workingMs()), true);
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
      stranded()
        ? "Plan2Code is not running. Your answers are saved and waiting for it. If the terminal is idle, type **continue** there and it will pick them up; it may also be waiting for your permission approval."
        : "Plan2Code is not running right now. Anything you answer here is saved. If the terminal is idle, type **continue** there to wake it; it may also be waiting for your permission approval."
    );
  }

  const mine = myTurn().length;
  if (awaitingReply().length) {
    return mine
      ? say("point", `Sent. ${mine} question${mine === 1 ? "" : "s"} still for you.`)
      : say("work", "Sent. Waiting for Plan2Code.", "", true);
  }

  if (!mine) return say("happy", "All caught up.");
  // Everything in front of them is answered and only Send is left. This is the
  // one moment the page can name the next step and be certain it is right.
  if (!unanswered().length) return say("point", "That is all of them. Send it over.");

  const todo = unanswered().length;
  return say(
    "point",
    todo === mine
      ? `Your turn: ${mine} question${mine === 1 ? "" : "s"} waiting.`
      : `${todo} still to answer, then send.`
  );
}

/* ---------------------------------------------------------------- brief */

// A brief is a Pathfinder thing: a plain-English report of the decisions made
// in a date range, the ones still open, and what happens next. It is the
// artifact someone takes to a meeting, and the reason a non-engineer is in this
// session at all, so it should not need knowing that you can type "brief" at a
// terminal to get one.
//
// The request travels as an ordinary send. The agent's own wait loop returns
// it, `reply` carries the range in the grammar its playbook already parses, and
// the finished brief comes back as a doc like any other.
const BRIEF_RANGES = {
  today: "today",
  "this week": "this week",
  full: "full",
};

function briefRange() {
  const picked = document.querySelector('input[name="brief-range"]:checked');
  const value = picked ? picked.value : "today";
  if (value !== "since") return { range: BRIEF_RANGES[value] || "today" };
  const on = $("brief-since").value;
  if (!on) return { problem: "Pick the date to count from, or choose another range." };
  return { range: `since ${on}` };
}

function openBrief() {
  const why = $("brief-why");
  why.textContent = "";
  syncBriefDate();
  $("brief-modal").showModal();
}

// The date only means anything for "since", so it is dimmed and inert until
// that is the choice, rather than sitting there inviting a value it will ignore.
function syncBriefDate() {
  const picked = document.querySelector('input[name="brief-range"]:checked');
  const on = Boolean(picked && picked.value === "since");
  const row = document.querySelector(".since-row");
  const input = $("brief-since");
  row.classList.toggle("is-off", !on);
  input.disabled = !on;
}

async function sendBrief() {
  const choice = briefRange();
  const why = $("brief-why");
  if (choice.problem) {
    why.textContent = choice.problem;
    return;
  }
  const state = sendState();
  // The same guard the Send button uses. A brief is a turn like any other, and
  // two turns in flight is the one thing this protocol will not do.
  if (gone || pendingResult || (agentWorking() && workingMs() <= patience(WORKING_GRACE_MS))) {
    why.textContent = state.why || "Wait for Plan2Code to finish, then ask again.";
    return;
  }

  const go = $("brief-go");
  go.disabled = true;
  go.textContent = "Asking…";
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actions: [{ i: "__brief", type: "brief", range: choice.range }],
        reply: briefPhrase(choice.range),
      }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    $("brief-modal").close();
    banner("Asked for a brief. It will appear as a tab when it is written.", "good");
    setTimeout(() => banner(null), 5000);
    pendingResult = true;
    render();
  } catch (err) {
    if (err && err.pending) pendingResult = true;
    why.textContent =
      err && err.pending
        ? "Your last answers are still being picked up. Try again in a moment."
        : "That did not go through. Try again in a moment.";
  } finally {
    go.disabled = false;
    go.textContent = "Write the brief";
  }
}

function renderBriefButton() {
  const btn = $("btn-brief");
  // Only Pathfinder has a brief playbook. Offering the button anywhere else
  // would send the agent a request it has no procedure for.
  const offer = S && S.workflow === "pathfinder";
  btn.hidden = !offer;
  if (offer) btn.disabled = gone || pendingResult;
}

// Shown only where the skill opts in and the agent's console copy can deliver
// it. Lit while helpers are on; a click opens the dialog, never toggles.
function renderSubagentsButton() {
  const btn = $("btn-subagents");
  const offer = showSwitch(subagentsFrame);
  btn.hidden = !offer;
  if (!offer) return;
  const label = switchLabel(subagentsFrame);
  btn.setAttribute("aria-pressed", String(Boolean(subagentsFrame.on)));
  btn.title = label;
  btn.setAttribute("aria-label", label);
  btn.disabled = gone;
}

// The Subagents dialog, filled from the frame each time it opens. A null
// instruction is the shipped default, shown as its text so it can be edited.
function openSubagents() {
  if (!showSwitch(subagentsFrame)) return;
  const on = Boolean(subagentsFrame.on);
  for (const radio of document.querySelectorAll('input[name="subagents-on"]')) {
    radio.checked = radio.value === (on ? "on" : "off");
  }
  $("subagents-instruction").value = subagentsFrame.instruction ?? defaultInstruction(S.workflow);
  $("subagents-max").value = String(subagentsFrame.max);
  $("subagents-checkin").textContent = CHECKIN_LINE;
  const research = $("subagents-research");
  research.textContent = PATHFINDER_RESEARCH_LINE;
  research.hidden = S.workflow !== "pathfinder";
  $("subagents-status").textContent = "";
  $("subagents-save").disabled = false;
  $("subagents-modal").showModal();
  const checked = document.querySelector('input[name="subagents-on"]:checked');
  if (checked) checked.focus();
}

const SUBAGENTS_ERRORS = {
  max: "Pick a number from 1 to 20.",
  "too-long": "The instruction is over 2,000 characters.",
  "not-offered": "This skill doesn't use helpers.",
  bad: "That didn't save. Try again.",
};
const SUBAGENTS_LOST = "Lost contact with Plan2Code. Try again once it's back.";

async function saveSubagents() {
  const save = $("subagents-save");
  const status = $("subagents-status");
  const picked = document.querySelector('input[name="subagents-on"]:checked');
  const text = $("subagents-instruction").value.trim();
  // The shipped default is stored as null, so a later release's wording
  // reaches everyone who never changed it.
  const instruction = text === defaultInstruction(S.workflow) ? null : text;
  const body = { on: Boolean(picked && picked.value === "on"), instruction, max: Number($("subagents-max").value) };
  save.disabled = true;
  status.textContent = "";
  const res = await postJson("/subagents", body);
  save.disabled = false;
  // The next state frame redraws the button.
  if (res.status === 200) return $("subagents-modal").close();
  if (res.status === 400) status.textContent = SUBAGENTS_ERRORS[res.body && res.body.error] || SUBAGENTS_ERRORS.bad;
  else if (res.status === 403 || res.status === 0) status.textContent = SUBAGENTS_LOST;
  else status.textContent = SUBAGENTS_ERRORS.bad;
}

function renderViews() {
  const nav = $("views");
  nav.replaceChildren();
  // Sent and not yet picked up: the same ring as Ask, until Plan2Code moves on
  // or goes quiet (a turning ring would pass a dead session for a slow one).
  const sentBusy = pendingResult && !gone && !agentAdrift();
  const tabs = [
    { id: "questions", label: isDashboard() ? "Dashboard" : "Questions", count: myTurn().length, busy: sentBusy },
  ];
  // Built in rather than posted: present exactly while the spec in view has
  // an overview.md. A tab that vanishes under the person sends them home.
  const hasOverview = typeof overview.text === "string" && overview.key === overviewSpec();
  if (hasOverview) tabs.push({ id: "overview", label: "Overview", count: 0 });
  else if (view === "overview") view = "questions";
  for (const d of docs()) tabs.push({ id: "doc:" + d.id, label: d.title || "Document", count: 0 });
  // The helpers the agent reported, from the first one on; cleared by a
  // dashboard hop, which sends the person home like the Overview tab does.
  if (showTab(subagentsFrame, S.helpers)) {
    // From the rows the tab draws, so the badge never counts helpers the
    // working-alone note hides.
    const running = helperRows(S.helpers).rows.filter((r) => r.state === "running").length;
    tabs.push({ id: "subagents", label: "Subagents", count: running });
  } else if (view === "subagents") view = "questions";
  // Always last, on every workflow and after a finish: the Quick question chat.
  // The ring left of "Ask" shows exactly when the conversation's own ring does:
  // a question the agent picked up and has not answered yet.
  const ask = askState();
  const askBusy = ask.view.rows.some((r) => r.working) && ask.send.state !== "offline" && !agentAdrift();
  tabs.push({ id: "ask", label: "Ask", count: 0, dot: chatDot, busy: askBusy });

  for (const t of tabs) {
    const b = el("button", "view-tab", t.label);
    b.type = "button";
    if (t.busy) {
      const spin = el("span", "spinner tiny tab-spin");
      spin.setAttribute("aria-hidden", "true");
      b.prepend(spin);
      b.title = t.id === "ask" ? "Plan2Code is working on an answer" : "Sent. Waiting for Plan2Code";
    }
    b.setAttribute("aria-current", String(view === t.id || (t.id === "questions" && view === "end")));
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
        local.chat.lastSeenReplyId = newestReplyId(chatFrame);
        chatDot = false;
        save();
      }
      view = t.id === "questions" && finish() ? "end" : t.id;
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

function markFor(item) {
  // On a finished session an open item is frozen, not waiting: its send went
  // and can no longer be added to, or it was never answered and never can be.
  if (isOpen(item) && finish()) {
    return recordedAnswer(item)
      ? { glyph: "✓", cls: "done", label: "sent" }
      : { glyph: "○", cls: "open", label: "left unanswered" };
  }
  if (local.staged[item.id]) return { glyph: "●", cls: "staged", label: "ready to send" };
  if (isOpen(item) && ((local.sent && local.sent[item.id]) || submittedInFlight(item)))
    return { glyph: "◐", cls: "staged", label: "sent, waiting for Plan2Code" };
  if (!isOpen(item)) return { glyph: "✓", cls: "done", label: "answered" };
  return { glyph: "○", cls: "open", label: "waiting for you" };
}

// The session's own ending, as a page of its own at the top of the rail.
// A pause and a finish share the screen -- the hand-off card -- but not the
// name: "paused" is the word the stop playbook asks for in the headline, and
// it is the word the person was told to expect.
function renderEndItem(fin) {
  const paused = finishPaused(fin);
  const box = el("div", "rail-group rail-end");
  const b = el("button", "rail-item");
  b.type = "button";
  b.setAttribute("aria-current", String(view === "end"));
  const mark = el("span", "rail-mark " + (paused ? "staged" : "done"), paused ? "❚❚" : "✓");
  mark.title = paused ? "session paused" : "session ended";
  b.appendChild(mark);
  b.appendChild(el("span", "rail-end-label", paused ? "Paused" : "Session ended"));
  b.addEventListener("click", () => {
    view = "end";
    render();
    $("main").focus();
  });
  box.appendChild(b);
  return box;
}

function renderSidebar() {
  const rail = $("sidebar");
  rail.replaceChildren();

  const fin = finish();
  if (fin) rail.appendChild(renderEndItem(fin));

  // On the dashboard the rail is the same menu in outline form, so a person
  // who learned the page on a workflow session finds the picks where the
  // session outline usually lives. The card that is mid-launch gets the
  // half-filled mark the page uses for "sent, on its way".
  if (isDashboard() && !fin) {
    const menu = (S && S.menu) || {};
    for (const g of CATALOG_GROUPS) {
      const box = el("div", "rail-group");
      const head = el("p", "rail-title");
      head.appendChild(el("span", null, g.title));
      box.appendChild(head);
      for (const e of SKILL_CATALOG.filter((x) => x.group === g.id)) {
        const av = cardPresentation(e, scan(), selSpec(), menu);
        // Unavailable for the selected spec fades hard; the brief greying
        // while a launch is in flight or the server is away does not.
        const b = el(
          "button",
          "rail-item" + (av.on ? "" : " is-unavailable") + (av.recommended ? " is-suggested" : "")
        );
        b.type = "button";
        b.disabled = Boolean(local.launching) || gone || pendingResult || !av.on;
        if (!av.on && av.reason) b.title = av.reason;
        b.setAttribute("aria-current", String(Boolean(dashPick && dashPick.skill === e.skill)));
        const isGoing = local.launching && local.launching.skill === e.skill;
        const isPicked = dashPick && dashPick.skill === e.skill;
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
          dashPick = e;
          view = "questions";
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
      b.setAttribute("aria-current", String(view === "questions" && selected === item.id));
      const m = markFor(item);
      const mark = el("span", "rail-mark " + m.cls, m.glyph);
      mark.title = m.label;
      b.appendChild(mark);
      b.appendChild(el("span", null, item.title));
      b.addEventListener("click", () => {
        selected = item.id;
        view = "questions";
        render();
        $("main").focus();
      });
      box.appendChild(b);
    }
    rail.appendChild(box);
  }
}

/* ---------------------------------------------------------------- main */

// The pose pane on screen when a render began, held back from the clear so
// posePane() can take it up again. See posePane.
let heldPose = null;

function renderMain() {
  const main = $("main");
  heldPose = main.querySelector(":scope > [data-pose]");
  for (const child of [...main.children]) if (child !== heldPose) child.remove();
  try {
    paintMain(main);
  } finally {
    // Nothing took it up: this screen is not the same pose.
    heldPose?.remove();
    heldPose = null;
  }
  // Inside the render pass, before withFocus restores the card's scroll, so
  // the restore is measured against the box's final height.
  fitGrowBox();
}

/* ------------------------------------------------------ growing answer box */

// One answer box per card grows into the card's free height: the text
// question's box, else a picked "Something else" box, else the card's note.
// Every other box keeps its ordinary height, and the notes panel beside the
// card is never a candidate.
function markGrowBox(card) {
  if (!card) return;
  const id = card.dataset.item;
  const areas = [...card.querySelectorAll("textarea")];
  const box =
    areas.find((t) => t.id === "text-" + id) ||
    card.querySelector(".option.is-other.is-picked textarea.other-text") ||
    areas.find((t) => t.id === "note-" + id);
  // Only a box that stops being the one gives its fill back, so a keystroke
  // that re-marks the same box leaves its height alone.
  for (const n of areas) {
    if (n === box || !n.classList.contains("grow")) continue;
    n.classList.remove("grow");
    n.style.minHeight = "";
  }
  if (box) box.classList.add("grow");
  card.classList.toggle("has-grow", Boolean(box));
}

// The height the card's contents would take if nothing stretched them. Not
// scrollHeight: that never reads less than the card's own height, so a box
// shorter than the fill could never be told how much room it has.
function naturalHeight(card) {
  const last = card.lastElementChild;
  if (!last) return 0;
  const top = card.getBoundingClientRect().top + card.clientTop;
  return (
    last.getBoundingClientRect().bottom -
    top +
    card.scrollTop +
    parseFloat(getComputedStyle(last).marginBottom || "0") +
    parseFloat(getComputedStyle(card).paddingBottom || "0")
  );
}

// The fill is written as the box's min-height, which is what lets the drag
// handle only ever make it taller: resize: vertical alone cannot hold a floor
// that moves with the window. Below a 160px fill the card scrolls instead.
function fitGrowBox() {
  const box = $("main").querySelector(":scope > .card.has-grow textarea.grow");
  if (!box) return;
  const card = box.closest(".card");
  const other = naturalHeight(card) - box.offsetHeight;
  const fill = Math.max(160, Math.floor(card.clientHeight - other));
  const now = parseFloat(box.style.minHeight) || 0;
  if (Math.abs(now - fill) > 1) box.style.minHeight = fill + "px";
}

// It watches the column, not the box. The box growing changes what the card
// scrolls, never the column's size, so resizing the box here can never set
// off another callback: the loop a box-watching observer would feed.
const growObserver = typeof ResizeObserver === "function" ? new ResizeObserver(() => fitGrowBox()) : null;
growObserver?.observe($("main"));

function paintMain(main) {
  main.classList.toggle("is-doc", view.startsWith("doc:") || view === "overview");
  main.classList.toggle("is-ask", view === "ask");

  if (view.startsWith("doc:")) return renderDoc(main, view.slice(4));
  if (view === "overview") return renderOverview(main);
  if (view === "ask") return renderAsk(main);
  if (view === "subagents") return renderSubagents(main);

  // The session's own page, reached from the PAUSED / SESSION ENDED item at
  // the top of the rail. The hand-off lives here alone now, rather than
  // sitting on top of whatever question happens to be selected.
  if (view === "end" && finish()) {
    const card = renderHandoff(finish());
    card.classList.add("is-primary");
    main.appendChild(card);
    return;
  }

  // The dashboard has no questions to walk: its whole main column is the menu,
  // or the getting-ready screen while a pick turns into a session. A finish
  // falls through to the ordinary path below, which hands it the card.
  if (isDashboard() && !finish()) {
    if (local.launching) renderLaunching(main);
    else if (dashPick) {
      // A spec-switch under an open confirm can grey the pick out. Rather
      // than offer START on a card that cannot launch, drop back to the
      // menu — the picker's new selection speaks for itself there.
      if (cardAvailability(dashPick, scan(), selSpec()).on) renderConfirm(main, dashPick);
      else {
        dashPick = null;
        renderDashboard(main);
      }
    } else renderDashboard(main);
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

  const item = byId(selected) || list[0];
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

// The end of the session, and the only screen in this page whose job is to
// send someone somewhere else.
//
// It reads in three beats, because that is the order the questions arrive in:
// what just happened, the one thing to run, and where to run it. The command
// is the whole point, so its Copy button is always on show -- the one on a
// fenced code block only appears on hover, which is right for a sample buried
// in prose and useless for the single action a screen exists to offer. A
// finish with nothing left to run skips the last two beats: it gets a quiet
// pointer at the dashboard instead of a Next step block.
function renderHandoff(fin) {
  const card = el("article", "card handoff");
  card.appendChild(el("p", "card-kicker", "Session ended"));
  card.appendChild(el("h2", null, fin.headline));
  if (fin.body) card.appendChild(md(fin.body, "md prompt"));

  // A finished build offers its review first, above the next step, because it
  // is the one thing on this screen that has to happen before they leave.
  const offer = reviewOffer(fin);
  if (offer && local.afterBuild !== "done" && local.afterBuild !== "dashboard") {
    card.appendChild(renderReviewOffer(offer));
  }

  // Three shapes: a next step to run, a pause with its resume command, or a
  // session with nothing left to run, which gets a quiet pointer at the
  // dashboard instead of a Next step block.
  const shape = handoffShape(fin);
  if (shape === "all-done") {
    const done = el("div", "handoff-done");
    done.appendChild(md(`${ALL_DONE_LEAD} ${ALL_DONE_REST}`, "md handoff-done-text"));
    const text = handoffText({ command: DASHBOARD_COMMAND });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small ghost handoff-copy", code));
    done.appendChild(row);
    // Once the server is gone, the row above already is the offer's fallback.
    if (dashboardLive(fin) && !gone) done.appendChild(renderDashboardOffer(true));
    card.appendChild(done);
  } else {
    // A pause always offers its resume command, even when the agent left it out.
    const command =
      String(fin.command || "").trim() || resumeCommand({ workflow: S.workflow, specDir: S.specDir });
    const step = el("div", "handoff-step");
    step.appendChild(el("p", "handoff-label", "Next step"));
    step.appendChild(
      el(
        "p",
        "handoff-where",
        fin.where || "Run this in the terminal where you started Plan2Code, in a new conversation:"
      )
    );

    // Shown exactly as copied. Nothing goes on the clipboard that they cannot
    // read first: it is about to be pasted into a program with their files.
    const text = handoffText({ ...fin, command });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    step.appendChild(row);
    if (text !== command) {
      step.appendChild(
        el(
          "p",
          "handoff-note",
          "The last sentence asks Plan2Code to open this page again, so you carry on here rather than in the terminal."
        )
      );
    }
    card.appendChild(step);

    // A finished (never paused) screen always names the way to the dashboard
    // from a new conversation, unless the offer's own fallback already does.
    if (shape === "next") {
      const offerDash = dashboardLive(fin);
      if (offerDash) card.appendChild(renderDashboardOffer(false));
      if (!(offerDash && gone)) {
        card.appendChild(
          textWithCode(
            "p",
            "handoff-fresh",
            `To start something else, run \`${DASHBOARD_COMMAND}\` in a new conversation.`
          )
        );
        const freshText = handoffText({ command: DASHBOARD_COMMAND });
        const freshRow = el("div", "handoff-command handoff-fresh-row");
        const freshCode = el("code", "handoff-code", freshText);
        freshRow.appendChild(freshCode);
        freshRow.appendChild(copyButton(freshText, "btn small ghost handoff-copy", freshCode));
        card.appendChild(freshRow);
      }
    }
  }

  card.appendChild(
    el(
      "p",
      "handoff-close",
      reviewPending() === "open"
        ? "The review is optional. Skip it and you can close this tab: nothing else here needs you."
        : "Then you can close this tab. Nothing here needs you any more."
    )
  );

  // What they were working on is on disk, but only the agent's copy is. This
  // is the last moment anyone is looking at this page, so the way to take the
  // document with them belongs here and not only behind a tab they may never
  // open again — unless the doc is `saved`, in which case the file itself is
  // already on disk and a download would be a second copy of it.
  const keep = docs().find((d) => d.id === fin.doc) || docs()[0];
  if (keep && (keep.blocks || []).length) {
    const tools = el("div", "handoff-tools");
    if (keep.saved) {
      tools.appendChild(docSavedNote(keep));
    } else {
      const save = el("button", "btn small", `Download ${keep.title || "the document"}`);
      save.type = "button";
      save.addEventListener("click", () => downloadDoc(keep));
      tools.appendChild(save);
    }
    card.appendChild(tools);
  }

  // Answers staged and never sent are lost the moment this page closes, and
  // this page's one promise is that nothing gets lost. Say so plainly rather
  // than letting them walk away from work they thought was safe.
  const stuck = Object.keys(local.staged).length;
  if (stuck) {
    card.appendChild(
      el(
        "p",
        "handoff-unsent",
        `${stuck} answer${stuck === 1 ? "" : "s"} here ${stuck === 1 ? "was" : "were"} never sent, ` +
          `and Plan2Code has finished. If ${stuck === 1 ? "it" : "they"} still matter, say so in the ` +
          `next session: nothing on this page will reach it now.`
      )
    );
  }
  return card;
}

// The review button, on the hand-off of a finished build (a finished quick
// task; an implementation phase gets its review offer earlier, as a verdict
// on the sign-off card).
//
// It is a request, not a command: the page cannot run a review, it asks the
// agent that is still sitting in its wait loop, the same way "Write a brief"
// does. So it is only offered while there is a server to carry the press, and
// once there is not, it turns into the command that does the same thing from
// the terminal instead of a button that would go nowhere.
function renderReviewOffer(offer) {
  const box = el("section", "review-offer");
  box.appendChild(el("p", "handoff-label", "Before you go"));
  box.appendChild(el("h3", "review-offer-title", offer.label));
  const asked = local.afterBuild === "review";

  if (gone) {
    box.appendChild(
      el(
        "p",
        "review-offer-text",
        asked
          ? "The session closed before the review could start. To run it now, use this in the terminal, in a new conversation:"
          : "This session has closed, so the review cannot start from here any more. To run it, use this in the terminal, in a new conversation:"
      )
    );
    const text = "/plan2code-review";
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    box.appendChild(row);
    return box;
  }

  box.appendChild(
    el(
      "p",
      "review-offer-text",
      "A careful review of the files this session changed: bugs, gaps against the spec, and anything risky. " +
        "The findings come back on this page and you choose which ones get fixed. Nothing changes until you do."
    )
  );
  const row = el("div", "btn-row");
  const go = el("button", "btn primary review-go", asked ? "Review requested…" : "Review it now");
  go.type = "button";
  go.disabled = asked || pendingResult;
  go.addEventListener("click", () => sendAfterBuild("review"));
  row.appendChild(go);
  if (!asked) {
    const no = el("button", "btn ghost", "No thanks, I am done");
    no.type = "button";
    no.disabled = pendingResult;
    no.addEventListener("click", () => sendAfterBuild("done"));
    row.appendChild(no);
  }
  box.appendChild(row);
  return box;
}

// The way back to the dashboard, on a finished screen whose agent opted in
// with `finish.dashboard`. Like the review button it is a request to an agent
// still in its wait loop, so once the server is gone it turns into the
// command that opens the dashboard from a new conversation instead.
function renderDashboardOffer(primary) {
  const box = el("section", "dashboard-offer");
  if (gone) {
    box.appendChild(
      el(
        "p",
        null,
        "This session has closed, so the button cannot reach Plan2Code any more. To open the dashboard, run this in a new conversation:"
      )
    );
    const text = handoffText({ command: DASHBOARD_COMMAND });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    box.appendChild(row);
    return box;
  }
  const asked = local.afterBuild === "dashboard";
  const go = el(
    "button",
    primary ? "btn primary" : "btn",
    asked ? "Opening the dashboard…" : "Back to the dashboard"
  );
  go.type = "button";
  go.disabled = asked || pendingResult;
  go.addEventListener("click", () => sendAfterBuild("dashboard"));
  box.appendChild(go);
  box.appendChild(textWithCode("p", "dashboard-note", DASHBOARD_NOTE));
  return box;
}

// A line whose backticked commands read as code; everything else is text.
function textWithCode(tag, className, text) {
  const node = el(tag, className);
  text.split("`").forEach((part, n) => {
    if (part) node.appendChild(n % 2 ? el("code", "md-code", part) : document.createTextNode(part));
  });
  return node;
}

// Any answer to a finished session's offers, as one send through the ordinary
// submit. Like a brief, it names no question: `__review`, `__done` and
// `__dashboard` are about the session.
const AFTER_FINISH_REPLIES = { review: REVIEW_REPLY, done: DONE_REPLY, dashboard: DASHBOARD_REPLY };
async function sendAfterBuild(kind) {
  if (gone || pendingResult || local.afterBuild) return;
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actions: [{ i: `__${kind}`, type: kind }],
        reply: AFTER_FINISH_REPLIES[kind],
      }),
    });
    if (res.status === 409) {
      pendingResult = true;
      banner("Your last answers are still being picked up. Try again in a moment.", "info");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    local.afterBuild = kind;
    pendingResult = true;
    save();
    const started = {
      review: "Review requested. It starts here in a moment.",
      dashboard: "Opening the dashboard. It appears here in a moment.",
    }[kind];
    if (started) {
      banner(started, "good");
      setTimeout(() => banner(null), 5000);
    }
  } catch {
    banner("That did not go through. Nothing was lost; try again.", "warn");
  } finally {
    render();
  }
}

/* ------------------------------------------------------------- dashboard */

// The menu a `dashboard` session exists to show. The cards come from the
// page's own catalog (answers.js), never from the agent's payload — a fixed
// product list does not belong in a patch channel. What the agent CAN say
// rides in `state.menu`: a `note` line under the title, a `recommend` skill
// to flag, and a `details` one-liner per card ("Phase 2 of 4 is next").

function roleNudge() {
  const nudge = el("div", "dash-nudge");
  nudge.setAttribute("role", "status");
  nudge.appendChild(el("span", "dash-nudge-text", "Pick your role to get starter templates ordered for you."));
  const actions = el("div", "dash-nudge-actions");
  const setUp = el("button", "btn small primary", "Set up preferences");
  setUp.type = "button";
  setUp.addEventListener("click", () => {
    renderSwatches();
    $("looks-modal").showModal();
  });
  const notNow = el("button", "btn tiny ghost", "Not now");
  notNow.type = "button";
  notNow.addEventListener("click", () => {
    looks.role = ROLE_NOT_SET;
    saveLooks();
    render();
  });
  actions.append(setUp, notNow);
  nudge.appendChild(actions);
  return nudge;
}

// × on the update banner hides it for this console session only, and only
// for the release it named. Blocked storage means "not dismissed".
function updateDismissKey() {
  try {
    return "p2c-update-dismissed:" + S.sid;
  } catch {
    return "p2c-update-dismissed:";
  }
}

function updateDismissed() {
  try {
    return sessionStorage.getItem(updateDismissKey()) === updateFrame.latest;
  } catch {
    return false;
  }
}

const RELEASES_URL = "https://github.com/jparkerweb/plan2code/releases/";
const UPDATE_COMMAND = "npx --allow-git=all git+https://github.com/jparkerweb/plan2code.git";

function releasesLink(text) {
  const a = el("a", null, text);
  a.href = RELEASES_URL;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}

function openUpdateModal() {
  if (!updateFrame) return;
  const versions = $("update-versions");
  versions.replaceChildren(
    document.createTextNode("Version "),
    releasesLink("v" + updateFrame.latest),
    document.createTextNode(" is out — you have "),
    el("code", null, updateFrame.installed),
    document.createTextNode(".")
  );
  const row = $("update-command");
  const code = el("code", null, UPDATE_COMMAND);
  row.replaceChildren(code, copyButton(UPDATE_COMMAND, "btn small ghost handoff-copy", code));
  $("update-modal").showModal();
}

function renderDashboard(main) {
  maybeWake();
  const menu = (S && S.menu) || {};
  const wrap = el("div", "dash");
  if (needsRoleNudge(looks)) wrap.appendChild(roleNudge());
  // Advice only: words, never a button, and nothing is blocked.
  if (meterFrame && meterFrame.level === "red") {
    const warn = el("div", "dash-nudge meter-banner", RED_BANNER);
    warn.setAttribute("role", "status");
    wrap.appendChild(warn);
  }
  // Built here only, so no other workflow's page ever shows it.
  if (updateFrame && !updateDismissed()) {
    const notice = el("div", "dash-nudge update-banner");
    notice.setAttribute("role", "status");
    const open = el("button", "update-banner-open", "UPDATE AVAILABLE · v" + updateFrame.latest);
    open.type = "button";
    open.addEventListener("click", openUpdateModal);
    const dismiss = el("button", "update-banner-dismiss", "×");
    dismiss.type = "button";
    dismiss.setAttribute("aria-label", "Dismiss until next time");
    dismiss.addEventListener("click", () => {
      try {
        sessionStorage.setItem(updateDismissKey(), updateFrame.latest);
      } catch {}
      render();
    });
    notice.append(open, dismiss);
    wrap.appendChild(notice);
  }
  wrap.appendChild(el("p", "card-kicker", "Plan2Code"));
  wrap.appendChild(el("h2", "dash-title", "What are we doing today?"));
  if (typeof menu.note === "string" && menu.note.trim()) {
    wrap.appendChild(el("p", "dash-note", menu.note));
  } else if (!S.menu && agentWorking()) {
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
  if (specs.length) wrap.appendChild(renderSpecPicker(specs));
  wrap.appendChild(hideUnavailableToggle());
  if (!local.launching && !launchScoping) syncWorkspaceScope();

  // "Unavailable" is the scan's verdict for the selected spec, not the
  // momentary greying while a launch is in flight or the server is away, so
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
  if (wake && !wake.entered) wrap.classList.add("waking", ...(wake.cards ? ["is-in"] : []));
  if (wake && wake.typed != null) {
    const note = wrap.querySelector(".dash-note");
    if (note) revealNote(note, wake.typed);
  }
  main.appendChild(wrap);
  // Deferred: this runs inside render(), and the dialog is not part of it.
  queueMicrotask(maybeWelcome);
}

/* ------------------------------------------------------------- welcome */

// The first dashboard a person ever sees gets a Welcome dialog. Closing it by
// any route (button, Esc, backdrop) saves looks.welcomeSeen, which rides in
// looks.json like every other preference. Waits out the wake-up animation and
// never lands on top of another open dialog.
function maybeWelcome() {
  if (!looksReady || looks.welcomeSeen === true || !S || !isDashboard() || finish() || wake) return;
  if (document.querySelector("dialog[open]")) return;
  openWelcome();
}

function openWelcome() {
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

/* ------------------------------------------------------------- wake-up */

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
  if (wakeTried || S.wake !== true || finish()) return;
  wakeTried = true;
  const key = "p2c-console:woke:" + S.sid;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    // Blocked storage only costs the reload guard.
  }
  const stage = $("wake");
  const pilot = $("planny").closest(".pilot");
  wake = { cards: false, entered: false, typed: 0, timers: [], abort: new AbortController() };
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
    signal: wake.abort.signal,
  }).then(({ skipped }) => {
    stopSnore();
    fadeSound("bootup", BOOTUP_FADE_MS);
    pilot.classList.remove("is-waking");
    // An abort or reduced motion jumps straight to the finished
    // dashboard. A run that reached its end leaves the note typing on.
    if (skipped || (wake && !wake.cards)) finishWake();
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
  soundQueued = null;
  soundHeld = null;
}

// The glide: the menu rises in and the note starts typing. On a skip the run
// is already ending and its promise settles everything, so nothing here.
function wakeGlide({ instant }) {
  if (!wake) return;
  wake.cards = true;
  if (instant) return;
  wake.timers.push(
    setTimeout(() => {
      wake.entered = true;
      settleWake();
    }, WAKE_ENTRANCE_MS),
    setTimeout(typeNote, WAKE_TYPE_DELAY_MS)
  );
  render();
}

// One more character of the note on the live element. Whatever the note says
// right now is what gets typed, so a `menu` note that lands mid-way simply
// carries on from the same count.
function typeNote() {
  if (!wake || wake.typed == null) return;
  wake.typed += 1;
  const note = $("main").querySelector(":scope > .dash .dash-note");
  if (!note || wake.typed >= revealNote(note, wake.typed)) {
    wake.typed = null;
    if (note) revealNote(note, Infinity);
    return settleWake();
  }
  wake.timers.push(setTimeout(typeNote, WAKE_TYPE_EVERY_MS));
}

// Done once the entrance has played and the note is all there. Nothing to
// redraw: what is on screen already is the finished dashboard.
function settleWake() {
  if (wake && wake.entered && wake.typed == null) {
    wake = null;
    maybeWelcome();
  }
}

function finishWake() {
  if (!wake) return;
  for (const t of wake.timers) clearTimeout(t);
  wake = null;
  render();
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
    render();
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
  const box = el("section", "spec-pick");
  box.appendChild(el("h3", "dash-group-title", "Pick up a spec, or start fresh"));
  const row = el("div", "spec-row");

  const scratch = el("button", "spec-chip" + (sel ? "" : " is-sel"));
  scratch.type = "button";
  scratch.setAttribute("aria-current", String(!sel));
  scratch.appendChild(el("span", "spec-chip-name", "Start from scratch"));
  scratch.appendChild(el("span", "spec-chip-state", "a new idea"));
  scratch.addEventListener("click", () => {
    local.specSel = null;
    save();
    render();
    loadOverview();
  });
  row.appendChild(scratch);

  for (const spec of specs) {
    const on = sel && sel.dir === spec.dir;
    const b = el("button", "spec-chip" + (on ? " is-sel" : ""));
    b.type = "button";
    b.setAttribute("aria-current", String(Boolean(on)));
    b.appendChild(el("span", "spec-chip-name", spec.name));
    b.appendChild(el("span", "spec-chip-state", SPEC_STATE_LABELS[spec.state] || spec.state));
    if (spec.detail) b.appendChild(el("span", "spec-chip-detail", spec.detail));
    b.addEventListener("click", () => {
      local.specSel = spec.dir;
      save();
      render();
      loadOverview();
    });
    row.appendChild(b);
  }
  box.appendChild(row);
  return box;
}

function dashCard(entry, menu) {
  const presentation = cardPresentation(entry, scan(), selSpec(), menu);
  // The agent's `recommend` and detail describe the initially selected spec.
  // Other picker choices derive both from the scan, so stale context never
  // follows a person to a different spec or to "start from scratch". A greyed
  // recommendation also yields to the selected spec's actual next step.
  const going = local.launching && local.launching.skill === entry.skill;
  const b = el(
    "button",
    "dash-card" + (presentation.recommended ? " is-suggested" : "") + (going ? " is-going" : "")
  );
  b.type = "button";
  b.disabled = Boolean(local.launching) || gone || pendingResult || !presentation.on;
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
    dashPick = entry;
    render();
  });
  return b;
}

/* The confirm pane. A card or rail click lands here rather than launching
   straight away: picking a skill is the one irreversible-feeling click on the
   dashboard, and it deserves a beat — what it is, what it will do, and a
   START that means it. Planny turns up leaning (his "this way" pose) in a
   small sky, because a bare paragraph with two buttons is a dialog, not a
   moment. BACK returns to the menu; Escape does the same (see the global
   keydown). */

function renderConfirm(main, entry) {
  const menu = (S && S.menu) || {};
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
  const target = entry.spec ? selSpec() : null;
  if (target) {
    const specLine = el("p", "confirm-spec");
    specLine.appendChild(el("span", null, "for "));
    specLine.appendChild(el("code", null, target.dir));
    specLine.appendChild(el("span", null, ` · ${SPEC_STATE_LABELS[target.state] || target.state}`));
    pane.appendChild(specLine);
  }

  const cmd = el("p", "confirm-cmd");
  cmd.appendChild(el("code", null, entry.command));
  pane.appendChild(cmd);

  const actions = el("div", "confirm-actions");
  const start = el("button", "btn primary", "Start " + entry.title);
  start.type = "button";
  start.disabled = gone || pendingResult;
  start.addEventListener("click", () => launchSkill(entry));
  const back = el("button", "btn ghost", "Back");
  back.type = "button";
  back.addEventListener("click", () => {
    dashPick = null;
    render();
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
  if (gone || pendingResult || local.launching || finish()) return;
  const target = entry.spec ? selSpec() : null;
  // The card was clickable, so this should never fire — but a spec picked in
  // one tab could have shifted the ground under a stale render in another.
  if (!cardAvailability(entry, scan(), selSpec()).on) {
    banner("That card is not available for the spec you picked.", "warn");
    render();
    return;
  }
  dashPick = null;
  const action = {
    i: "__launch",
    type: "launch",
    skill: entry.skill,
    workflow: entry.workflow,
    title: entry.title,
  };
  // The picker's spec goes to the skill being launched, not to the card:
  // cards that take no spec (utilities, setup) launch untargeted even while
  // a spec is selected.
  if (target) action.spec = target.dir;
  // The skill opens on the folders remembered for what it was launched for.
  // Held until the launch is in flight: the swap's own frame re-renders the
  // dashboard, which would otherwise sync back to the picker's spec.
  launchScoping = true;
  await syncWorkspaceScope(target ? target.dir : "");
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
      launchScoping = false;
      pendingResult = true;
      banner("Your last pick is still being picked up. One moment.", "info");
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    sound("startSkill");
    local.launching = { skill: entry.skill, title: entry.title, at: Date.now() };
    launchScoping = false;
    pendingResult = true;
    save();
    render();
  } catch {
    launchScoping = false;
    banner("That did not go through. Nothing was lost; try again.", "warn");
  }
}

/* The getting-ready screen. The pick is sent and the dashboard agent is
   turning it into a live skill: it resumes this session under the skill's
   workflow, which flips `S.workflow` off "dashboard" and ends this screen
   (adopt() clears `local.launching` on exactly that change).

   It is deliberately fun rather than a spinner with a shrug: a launch takes
   a few honest seconds — the skill file is read, the session resumed, the
   first payload composed — and a dead-quiet wait is when people wonder
   whether the click worked. Planny flies, the quips rotate, and after a
   while the hint points at the terminal, which narrates the same hand-off. */

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
  const held = heldPose;
  heldPose = null;
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

function renderLaunching(main) {
  const l = local.launching || {};
  const pane = posePane(main, "launching", l.skill && SKILL_CATALOG.find((e) => e.skill === l.skill)?.workflow);

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
  const since = S && S.agent ? Date.parse(S.agent.since) : NaN;
  return Number.isFinite(since) ? Date.now() - since : 0;
}

function startingHint(elapsed) {
  return elapsed > 90000
    ? "Still getting ready. Your terminal has the play-by-play if you want to watch it there."
    : "This page fills in by itself the moment Plan2Code has something for you. No need to touch anything.";
}

// A quiet line under the menu and the starting screen: the page cannot see a
// terminal approval prompt, so it says up front how to avoid one. Backticked
// spans become <code>, built as nodes like everything else here.
function approvalTip() {
  return textWithCode("p", "approval-tip", APPROVAL_TIP);
}

function renderStarting(main) {
  const elapsed = startingElapsed();
  const pane = posePane(main, "launching starting", S.workflow);
  pane.appendChild(el("p", "card-kicker", "Starting up"));
  pane.appendChild(el("h2", "launch-title", `Starting ${workflowTitle(S.workflow)}`));
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
      const cur = local.launching;
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

// To one question, at its top, with focus on the column.
function goToItem(id) {
  selected = id;
  view = "questions";
  render();
  const m = $("main");
  m.focus();
  m.scrollTop = 0;
}

// "Skip this one": staged as skipped, "Skipped" for a beat, then on to the
// next card that still needs the person, or to Send when this was the last.
// Anything the person does first (a click, a key) cancels the move.
let skipTimer = null;

function cancelSkipMove() {
  if (!skipTimer) return;
  clearTimeout(skipTimer);
  skipTimer = null;
  local.skipFlash = null;
}
document.addEventListener("pointerdown", cancelSkipMove, true);
document.addEventListener("keydown", cancelSkipMove, true);

function skipAndMoveOn(id) {
  cancelSkipMove();
  local.skipFlash = id;
  // A note already typed goes along: skipping the question is not retracting
  // the comment. Dropping it would leave the text in the box but out of the
  // send, which looks kept and is not.
  const cur = local.staged[id];
  stage(id, { type: "skip", skipped: true, ...(cur && cur.text ? { text: cur.text } : {}) });
  skipTimer = setTimeout(() => {
    skipTimer = null;
    local.skipFlash = null;
    const openIds = openItems().map((i) => i.id);
    const sent = Object.fromEntries(awaitingReply().map((i) => [i.id, true]));
    const next = lastOpenCard(openIds, local.staged, sent, id) ? null : nextOpenAfter(openIds, local.staged, sent, id);
    if (next) return goToItem(next);
    render();
    $("btn-send").focus();
  }, 250);
}

// Previous / next across the questions still waiting.
//
// The left rail already navigates, but it is a list of everything and it reads
// as a table of contents rather than as a way through. Someone working down
// three open questions should not have to aim at a 13px row to reach the next
// one. Settled questions are deliberately not in this walk: they are reference,
// not work, and the rail is where you go back to them.
function buildPager(item) {
  // Once the session has ended nothing open can be sent, so a way "back to
  // what is waiting" would lead somewhere that goes nowhere.
  if (finish()) return null;
  // Theirs to answer, not just unanswered by the agent: a sent question
  // waiting on the other end is not a place this walk should stop.
  const open = myTurn();
  if (!open.length) return null;

  const go = (target) => goToItem(target.id);

  const row = el("nav", "pager");
  row.setAttribute("aria-label", "Move between the questions waiting");

  const at = open.findIndex((i) => i.id === item.id);
  if (at === -1) {
    // Reading something already settled. The only move that means anything
    // here is back to the work.
    const b = el("button", "btn small pager-btn next");
    b.type = "button";
    const box = el("span", "pager-label");
    box.appendChild(el("span", "pager-kicker", "Back to what is waiting"));
    box.appendChild(el("span", "pager-title", open[0].title));
    b.appendChild(box);
    b.appendChild(el("span", "pager-arrow", "→"));
    b.addEventListener("click", () => go(open[0]));
    row.className = "pager one";
    row.appendChild(b);
    return row;
  }

  if (open.length < 2) return null;

  // Once this question is answered, the step is the next unanswered one, not
  // Send. Send lighting up the moment a single answer is staged pulls people
  // into sending one question at a time, which is three round trips where the
  // workflow wanted one. So the emphasis moves to whichever neighbour still
  // needs them, and Send goes quiet until nothing does.
  const here = Boolean(local.staged[item.id]);
  const nextT = open[at + 1];
  const prevT = open[at - 1];
  // "Still needs them" is not the same as "not staged": a question already sent
  // is locked and waiting on the agent, so pointing at it as the step would
  // walk someone into a card they cannot act on.
  const needs = (t) => Boolean(t && !local.staged[t.id] && !(local.sent && local.sent[t.id]));
  const leadNext = here && needs(nextT);
  const leadPrev = here && !leadNext && needs(prevT);

  // An end of the queue is an empty slot, not a disabled button. A greyed
  // "Previous" pointing at nothing is a control that exists only to say no.
  const mk = (target, back, lead) => {
    if (!target) return el("span", "pager-slot");
    const b = el(
      "button",
      "btn small pager-btn " + (back ? "prev" : "next") + (lead ? " lead" : " ghost")
    );
    b.type = "button";
    const arrow = el("span", "pager-arrow", back ? "←" : "→");
    const box = el("span", "pager-label");
    box.appendChild(el("span", "pager-kicker", back ? "Previous" : "Next"));
    box.appendChild(el("span", "pager-title", target.title));
    if (back) {
      b.appendChild(arrow);
      b.appendChild(box);
    } else {
      b.appendChild(box);
      b.appendChild(arrow);
    }
    b.addEventListener("click", () => go(target));
    return b;
  };

  row.appendChild(mk(prevT, true, leadPrev));
  row.appendChild(el("span", "pager-count", `${at + 1} of ${open.length} waiting`));
  row.appendChild(mk(nextT, false, leadNext));
  return row;
}

function renderWaiting(main) {
  const doing = doingNow();
  // Nothing asked and nothing said yet: the session is still starting.
  if (!doing) return renderStarting(main);
  // The same Planny the session started with, still at it: the spinner that
  // stood here said less about what was going on than he does.
  const pane = posePane(main, "waiting-pane", S.workflow);
  // A build with nothing to ask yet. Say what is happening and where to
  // watch it, instead of promising questions that may not come for a while.
  const title = el("h2", null, (S.headline && S.headline.stage) || "Working on it");
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
  // tasks"), a quick task as `tasks`. A skill with no task list (Document,
  // Plan) has nothing live to follow, so it gets no pointer at all.
  const list =
    docs().find((d) => d.id === "phase") ||
    docs().find((d) => d.id === "tasks") ||
    docs().find((d) => /\btasks\b/i.test(d.title || ""));
  if (!list) {
    pane.appendChild(el("p", null, "The tabs above fill in as it goes. " + ask));
    return;
  }
  const jump = (word) => {
    const b = el("button", "waiting-jump", word);
    b.type = "button";
    b.addEventListener("click", () => {
      view = "doc:" + list.id;
      render();
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

// A notice is context for the question it sits beside, so it lives inside the
// one card rather than as a second one under it.
function renderNotice(item) {
  const box = el("div", "card-note card-extra");
  box.appendChild(el("p", "note-kicker", "Note"));
  box.appendChild(el("h3", "note-title", item.title));
  box.appendChild(md(item.body, "md"));
  return box;
}

// An ANSWER that has been sent but not yet dealt with. Its controls are locked:
// the agent is mid-turn on exactly this question, so a change made now reaches
// nobody, and the change would then be deleted by the next state update.
//
// A send carrying only a note is not that. Someone who asks a question about
// the question before answering it has not answered it, and locking the form
// there leaves an open question that cannot be answered at all. The note is
// still shown as on its way, by the "Sent" pill and the rail mark.
function inFlightFor(item) {
  if (!isOpen(item) || finish()) return null;
  const sent = local.sent && local.sent[item.id];
  if (sentAnswer(sent)) return sent;
  // The send this tab no longer remembers (a reload, a resumed session, a
  // second tab) or one the agent took without settling the question: the
  // server's copy on the item is the same fact either way.
  const sub = submittedInFlight(item);
  return sub ? { value: sub, summary: "" } : null;
}

// A sent note's attachments as links: an image opens full size, a document
// opens in its own tab. The page serves both by the upload's own file name.
function sentAttachments(note) {
  const entries = [
    ...(note.images || []).map((e) => ({ ...e, kind: "image" })),
    ...(note.files || []).map((e) => ({ ...e, kind: "file" })),
  ];
  if (!entries.length) return null;
  const tray = el("div", "attach-tray");
  for (const e of entries) {
    const a = el("a", "attach-link");
    a.href = uploadUrl(e);
    a.target = "_blank";
    a.rel = "noopener";
    a.title = e.name || "attachment";
    if (e.kind === "image") {
      const fig = el("figure", "attach-thumb is-ready");
      const pic = el("img");
      pic.src = a.href;
      pic.alt = e.name || "image";
      fig.appendChild(pic);
      a.appendChild(fig);
    } else a.appendChild(docChip({ name: e.name || "file" }, "ready"));
    tray.appendChild(a);
  }
  return tray;
}

function renderCard(item) {
  const staged = local.staged[item.id];
  const flight = inFlightFor(item);
  const card = el(
    "article",
    "card question" +
      (!isOpen(item) || finish() ? " is-answered" : staged ? " is-staged" : "") +
      (flight ? " is-inflight" : "")
  );

  // Which question this card is for, so a render can tell whether the card it
  // is replacing is the same one (keep the scroll) or a different one (start
  // at the top).
  card.dataset.item = item.id;

  const kicker = el("p", "card-kicker");
  fillKicker(kicker, item);
  card.appendChild(kicker);
  // Held so the quiet staging path can repaint the border and the pill without
  // rebuilding the card, which would take the textarea being typed into with it.
  cardMarks = { id: item.id, card, kicker };

  card.appendChild(el("h2", null, item.title));
  if (item.body) card.appendChild(md(item.body, "md prompt"));
  const link = docLink(item);
  if (link) card.appendChild(link);

  // An item still open on a finished session renders as the same record a
  // settled one does: the send it carries is the final word on it, because a
  // send can no longer go anywhere and the form would be a trap.
  if (!isOpen(item) || finish()) {
    renderSettled(card, item);
  } else if (flight) {
    renderInFlight(card, item, flight);
  } else {
    const build = BUILDERS[item.kind];
    if (build) build(card, item, staged);
  }

  if (item.required === false && isOpen(item) && !flight && !finish()) {
    const skipped = Boolean(staged && staged.skipped);
    const skip = el("button", "linky", skipped ? "Do not skip" : "Skip this one");
    skip.type = "button";
    skip.style.marginTop = "16px";
    skip.addEventListener("click", () => (skipped ? stage(item.id, null) : skipAndMoveOn(item.id)));
    card.appendChild(skip);
    if (local.skipFlash === item.id) {
      card.classList.add("is-skip-flash");
      const flash = el("span", "skip-flash", "Skipped");
      flash.setAttribute("role", "status");
      card.appendChild(flash);
    }
  }

  if (isOpen(item) && !flight && !finish()) markGrowBox(card);
  return card;
}

/* ------------------------------------------------------ settled answers */

// A settled question is a record, not a form. Everything below exists because
// a disabled radio still looks like a radio: people tried to change answers
// that were already recorded, and the page gave them no reason to believe they
// could not. So the answer is stated in words at the top, the controls are
// replaced by static marks rather than merely disabled, and the card says out
// loud that this one is closed.

function renderSettled(card, item) {
  const v = recordedAnswer(item);
  const lines = answerLines(item, v);
  const text = v && typeof v.text === "string" ? v.text.trim() : "";
  // Fall back to the last thing they said on this question, but only when there
  // is nothing else at all. Attaching a side note to a pick they also made
  // would misreport which of the two was the answer.
  let prose = text;
  if (!prose && !lines.length) {
    const mine = (item.thread || []).filter((m) => threadWho(m) === "user");
    if (mine.length) prose = threadText(mine[mine.length - 1]).trim();
  }

  const nothing = !lines.length && !prose;
  const box = el("div", "answered" + (nothing ? " is-empty" : ""));
  const head = el("p", "answered-head");
  head.appendChild(el("span", "answered-mark", nothing ? "·" : "✓"));
  head.appendChild(el("span", null, nothing ? "No answer recorded" : "Your answer"));
  box.appendChild(head);

  if (lines.length) {
    const ul = el("ul", "answered-values");
    for (const line of lines) ul.appendChild(el("li", null, line));
    box.appendChild(ul);
  }
  if (prose) box.appendChild(el("blockquote", "answered-text", prose));
  if (nothing) {
    box.appendChild(
      el(
        "p",
        "answered-none",
        isOpen(item)
          ? "The session ended before this was answered."
          : "This was answered somewhere other than this page, so there is nothing to show."
      )
    );
  }
  box.appendChild(
    el(
      "p",
      "answered-lock",
      isOpen(item)
        ? nothing
          ? "The session is over."
          : "The session is over, so this stands as it was sent."
        : "Locked. If this needs to change, say so in a note on a question that is still open, or in the terminal."
    )
  );
  card.appendChild(box);

  const context = SETTLED_CONTEXT[item.kind];
  if (context) context(card, item, v);
}

// The same record, in the moment between pressing Send and the agent replying.
//
// It is deliberately NOT an overlay over the page. The wait is when someone
// re-reads the document, looks ahead at what is coming, or catches up on a
// question they skimmed, and that reading is the whole reason this page beats
// the terminal. What has to stop is editing THIS question, because the agent is
// mid-turn on it: a change made now reaches nobody and is deleted by the next
// update. So the one card that cannot be acted on locks, and nothing else does.
function renderInFlight(card, item, flight) {
  const v = flight.value || null;
  const lines = answerLines(item, v);
  const text = v && typeof v.text === "string" ? v.text.trim() : "";

  const box = el("div", "answered is-sent");
  const head = el("p", "answered-head");
  head.appendChild(el("span", "answered-mark", "↑"));
  head.appendChild(el("span", null, "Sent"));
  box.appendChild(head);

  if (lines.length) {
    const ul = el("ul", "answered-values");
    for (const line of lines) ul.appendChild(el("li", null, line));
    box.appendChild(ul);
  } else if (!text && flight.summary) {
    // A send from an older page version, or a note with no answer attached.
    const ul = el("ul", "answered-values");
    ul.appendChild(el("li", null, flight.summary));
    box.appendChild(ul);
  }
  if (text) box.appendChild(el("blockquote", "answered-text", text));
  const note = noteAwaiting(item);
  const sub = submittedAwaiting(item);
  if (note && sub && note.at === sub.at) {
    if (note.text) box.appendChild(el("blockquote", "answered-text", note.text));
    const tray = sentAttachments(note);
    if (tray) box.appendChild(tray);
  }

  // Say which of the two it actually is. Once the agent has collected the send,
  // "waiting to be picked up" is no longer true, and a status line that lies is
  // worse than none.
  box.appendChild(
    el(
      "p",
      "answered-lock",
      pendingResult
        ? "Waiting for Plan2Code to pick this up. It unlocks by itself."
        : "Plan2Code is working on it. This unlocks by itself when it answers."
    )
  );
  card.appendChild(box);

  const context = SETTLED_CONTEXT[item.kind];
  if (context) context(card, item, v);

  // A stuck agent must not lock someone out of their own answer forever. This
  // is the card-level twin of the Send button's grace period, and it appears on
  // the same terms -- a send could actually go through. sendState() is not the
  // test here: it is also disabled for an empty payload, and clicking this is
  // what stages the payload it would send.
  const sendWouldGo =
    !finish() && !gone && !pendingResult && (!agentWorking() || workingMs() > patience(WORKING_GRACE_MS));
  if (sendWouldGo) {
    const undo = el("button", "linky", "Take this back and answer again");
    undo.type = "button";
    undo.style.marginTop = "16px";
    undo.addEventListener("click", () => {
      // Put the answer back as a staged one, exactly the state they were in
      // before they pressed Send. Sending clears `staged` and the field's
      // draft, so without this the button empties the box it offered to let
      // them edit, and a long answer has to be typed a second time.
      const back = sentAnswer(local.sent[item.id]);
      delete local.sent[item.id];
      // The server also records every send on the item (`submitted`), and that
      // record counts as in flight on its own: taking THIS send back has to
      // retract it too, or the card stays locked. Its `at` names the send, so
      // one made afterwards still counts.
      const sub = submittedAwaiting(item);
      if (sub) (local.retract = local.retract || {})[item.id] = sub.at || "any";
      if (back) {
        local.staged[item.id] = back;
      } else if (sub) {
        // The send came off the server's copy on the item, so its value goes
        // back on the form to be edited and sent again.
        const { at, ...rest } = sub;
        local.staged[item.id] = { type: "answer", ...rest };
      }
      save();
      render();
    });
    card.appendChild(undo);
  }
}

// The question's own material, shown back as a record. No inputs at all: a
// disabled control still invites a click, a static mark does not.
function lockedOptions(card, item, keys) {
  if (!(item.options || []).length) return;
  const picked = new Set(keys);
  const list = el("ul", "options");
  for (const o of item.options) {
    const on = picked.has(o.k);
    const li = el("li", "option is-locked" + (on ? " is-recorded" : ""));
    li.appendChild(el("span", "option-mark" + (on ? " on" : ""), on ? "✓" : "·"));
    const body = el("div", "option-body");
    const head = el("div", "option-label");
    if (o.k) head.appendChild(el("span", "option-key", o.k));
    head.appendChild(el("span", null, o.text));
    if (on) head.appendChild(el("span", "pill done", "Your answer"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));
    li.appendChild(body);
    list.appendChild(li);
  }
  card.appendChild(list);
}

function lockedSteps(card, item, v) {
  if (!(item.steps || []).length) return;
  const done = new Set((v && v.done) || []);
  const list = el("ol", "steps");
  item.steps.forEach((step, i) => {
    const li = el("li", "step is-locked");
    li.appendChild(el("span", "step-num", String(i + 1)));
    const on = done.has(i);
    li.appendChild(el("span", "option-mark" + (on ? " on" : ""), on ? "✓" : "·"));
    const body = el("div", "step-body");
    body.appendChild(md(typeof step === "string" ? step : step.text, "md"));
    li.appendChild(body);
    list.appendChild(li);
  });
  card.appendChild(list);
}

function lockedRows(card, item, v) {
  const rows = (v && Array.isArray(v.rows) && v.rows.length ? v.rows : item.rows) || [];
  if (!rows.length) return;
  const ul = el("ul", "rows");
  rows.forEach((row, i) => {
    const li = el("li", "row-item is-locked");
    li.appendChild(el("span", "row-order", String(i + 1)));
    const main = el("div", "row-main");
    main.appendChild(el("p", "row-title-static", row.title || ""));
    if (row.body) main.appendChild(el("div", "row-body", row.body));
    li.appendChild(main);
    ul.appendChild(li);
  });
  card.appendChild(ul);
}

function lockedSummary(card, item) {
  if (!item.summary) return;
  const box = el("div", "card-note");
  box.appendChild(md(item.summary, "md"));
  card.appendChild(box);
}

const SETTLED_CONTEXT = {
  choice: (card, item, v) => lockedOptions(card, item, v && v.k ? [v.k] : []),
  menu: (card, item, v) => lockedOptions(card, item, v && v.k ? [v.k] : []),
  multi: (card, item, v) => lockedOptions(card, item, (v && v.ks) || []),
  checklist: lockedSteps,
  list: lockedRows,
  recap: lockedSummary,
  review: lockedSummary,
};

/* -------------------------------------------------------- the builders */

/**
 * "Something else" as a real option in the radio group, for a single-choice
 * question.
 *
 * It used to be a plain field below the list, and typing in it MERGED the text
 * into whatever was already picked: choosing A and then writing why A is wrong
 * sent `a; A is wrong`, the pick first, the contradiction second. Nothing on
 * screen said that would happen, and the field's own words ("if none of the
 * above fit") promise the opposite.
 *
 * On a one-answer question these are alternatives, so they share a radio group
 * and the last thing touched wins. Qualifying a pick has its own home: the note
 * box beside the question, which travels as a comment rather than an answer.
 *
 * `multi` keeps the additive field below, where naming a third thing alongside
 * two ticked boxes is exactly right.
 */
function otherOption(list, item, staged, name) {
  if (item.allowOther === false) return;
  const id = "other-" + item.id;
  const on = Boolean(staged && !staged.k && staged.text);
  const li = el("li", "option is-other" + (on ? " is-picked" : ""));

  const radio = el("input");
  radio.type = "radio";
  radio.name = name;
  radio.checked = on;
  radio.setAttribute("aria-label", "Something else, in your own words");

  const body = el("div", "option-body");
  const head = el("div", "option-label");
  const label = el("label", null, "Something else, in your own words");
  label.htmlFor = id;
  head.appendChild(label);
  body.appendChild(head);

  const ta = el("textarea", "other-text");
  ta.id = id;
  ta.placeholder = "If none of the above fit, say what does.";
  // A draft survives picking a listed option, so switching back and forth
  // never costs someone the sentence they already wrote.
  ta.value = (on && staged.text) || local.drafts[id] || "";

  // Repaint the row highlights without a full render, which would rebuild this
  // textarea mid-keystroke. Setting the radio marks the rest of the group off
  // by itself; only the `is-picked` classes need saying out loud.
  const pick = (chosen) => {
    for (const node of list.children) node.classList.toggle("is-picked", node === chosen);
    // The quiet path never re-renders, so the growing box follows the pick here.
    markGrowBox(list.closest(".card"));
    fitGrowBox();
  };

  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    const v = ta.value.trim();
    if (v) {
      radio.checked = true;
      pick(li);
      stageQuiet(item.id, choiceAnswer({ text: v }));
    } else {
      radio.checked = false;
      pick(null);
      const cur = local.staged[item.id];
      if (cur && !cur.k) stageQuiet(item.id, null);
    }
    stagedChanged();
  });

  radio.addEventListener("change", () => {
    const v = ta.value.trim();
    pick(li);
    // Nothing written yet: drop the previous pick, since they have just said it
    // was not the answer, and put the cursor where the answer now goes.
    stageQuiet(item.id, choiceAnswer({ text: v }));
    stagedChanged();
    ta.focus();
  });

  body.appendChild(ta);
  li.appendChild(radio);
  li.appendChild(body);
  list.appendChild(li);
}

// The additive twin of otherOption, and the only caller left is `multi`, where
// naming a third thing alongside two ticked boxes is the point. The wording has
// to say that: "if none of the above fit" is the single-choice promise, and it
// would be a lie here, where what you write joins the ticks rather than
// replacing them.
function otherField(card, item, staged) {
  if (item.allowOther === false) return;
  const wrap = el("div", "field");
  const id = "other-" + item.id;
  const label = el("label", null, "Anything else, in your own words");
  label.htmlFor = id;
  wrap.appendChild(label);
  const ta = el("textarea");
  ta.id = id;
  ta.placeholder = "Optional. This adds to the ones you picked above; it does not replace them.";
  ta.value = (staged && staged.text) || local.drafts[id] || "";
  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    const cur = local.staged[item.id];
    if (ta.value.trim()) {
      stageQuiet(item.id, { ...(cur || { type: "answer", kind: item.kind }), text: ta.value.trim() });
    } else if (cur && cur.text) {
      const { text, ...rest } = cur;
      if (rest.k || (rest.ks && rest.ks.length)) stageQuiet(item.id, rest);
      else stageQuiet(item.id, null);
    }
    stagedChanged();
  });
  wrap.appendChild(ta);
  card.appendChild(wrap);
}

// Everything that has to catch up after a staged answer changed WITHOUT a full
// render, which is the path every text field takes.
//
// A full render is not an option here: renderMain() empties the column with
// replaceChildren(), and emptying a scrolled container resets its scrollTop, so
// the page would jump to the top on every keystroke. The pieces below are the
// ones that depend on a staged answer and hold no input, so they can be rebuilt
// mid-keystroke safely. Leaving them out is how the card sat with no border and
// the pager kept pointing the wrong way while the footer said "1 ready".
function stagedChanged() {
  renderFooter();
  renderSidebar();
  renderStagedMarks();
}

// The topic line, and the one pill that says where this question has got to.
function fillKicker(kicker, item) {
  const topic = topics().find((t) => t.id === item.topic);
  kicker.replaceChildren(document.createTextNode(topic ? topic.title : "Question"));

  let pill = null;
  if (!isOpen(item)) pill = el("span", "pill done", "Answered");
  // Frozen on a finished session: the send it carries is the record, and a
  // staged leftover can no longer be sent, so it earns no pill.
  else if (finish()) pill = recordedAnswer(item) ? el("span", "pill done", "Sent") : null;
  else if (local.staged[item.id]) pill = el("span", "pill staged", "Ready to send");
  else if ((local.sent && local.sent[item.id]) || submittedInFlight(item))
    pill = el("span", "pill staged", "Sent");
  if (!pill) return;
  pill.style.marginLeft = "8px";
  kicker.appendChild(pill);
}

function renderStagedMarks() {
  const item = byId(selected);
  if (!item || !cardMarks || cardMarks.id !== item.id || !cardMarks.card.isConnected) return;
  cardMarks.card.classList.toggle("is-staged", isOpen(item) && !finish() && Boolean(local.staged[item.id]));
  fillKicker(cardMarks.kicker, item);

  const main = $("main");
  const shown = main.querySelector(".pager");
  const next = buildPager(item);
  if (shown && next) shown.replaceWith(next);
  else if (shown) shown.remove();
  else if (next) main.appendChild(next);
}

// Update staged state without a full re-render, so typing is never interrupted.
function stageQuiet(id, value) {
  if (value == null) delete local.staged[id];
  else local.staged[id] = value;
  save();
}

// The next answer for a click, carrying over the words typed on the card. Note
// boxes stage quietly, without a render, so the `staged` a builder closed over
// at render time can be missing everything typed since: read the live answer
// when the click lands instead. A click that clears the pick while text is
// still in the box keeps the text as a note on its own (`bare`), the same shape
// the note box stages when nothing is picked.
function withNote(item, value, bare = { type: "answer", kind: item.kind }) {
  const cur = local.staged[item.id];
  const text = cur && cur.text;
  if (!text) return value;
  return value ? { ...value, text } : { ...bare, text };
}

// Unique per question and option, and the same on every render.
const optionId = (item, o, i) => `pick-${item.id}-${o.k || i}`;

function buildChoice(card, item, staged) {
  const list = el("ul", "options");
  const name = "opt-" + item.id;
  for (const [i, o] of (item.options || []).entries()) {
    const picked = staged && staged.k === o.k;
    const li = el("li", "option" + (picked ? " is-picked" : ""));
    const label = el("label");
    label.style.display = "contents";

    const radio = el("input");
    radio.type = "radio";
    radio.name = name;
    // An id so the control survives the render its own change() sets off:
    // withFocus finds the focused input by id and has nothing to go on without
    // one. Stable across renders because it is built from the question and the
    // option, not from a counter.
    radio.id = optionId(item, o, i);
    radio.value = o.k;
    radio.checked = Boolean(picked);
    // Without this the group reads out as "A", "B", "on": the letter is the
    // label's whole text content, and the last one has no label at all.
    radio.setAttribute("aria-label", o.k ? `${o.k}: ${o.text}` : o.text);
    // choiceAnswer drops any text that was typed below. On a one-answer
    // question a listed option and something in your own words are
    // alternatives, and sending both hands the agent an answer that argues
    // with itself.
    radio.addEventListener("change", () => stage(item.id, choiceAnswer({ k: o.k })));

    const body = el("div", "option-body");
    const head = el("div", "option-label");
    if (o.k) head.appendChild(el("span", "option-key", o.k));
    head.appendChild(el("span", null, o.text));
    if (o.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));

    label.appendChild(radio);
    label.appendChild(body);
    li.appendChild(label);
    list.appendChild(li);
  }
  otherOption(list, item, staged, name);
  card.appendChild(list);
}

function buildMulti(card, item, staged) {
  const chosen = new Set((staged && staged.ks) || []);
  const list = el("ul", "options");
  for (const [i, o] of (item.options || []).entries()) {
    const on = chosen.has(o.k);
    const li = el("li", "option" + (on ? " is-picked" : ""));
    const label = el("label");
    label.style.display = "contents";

    const box = el("input");
    box.type = "checkbox";
    box.id = optionId(item, o, i);
    box.value = o.k;
    box.checked = on;
    box.setAttribute("aria-label", o.k ? `${o.k}: ${o.text}` : o.text);
    box.addEventListener("change", () => {
      const cur = local.staged[item.id];
      const next = new Set((cur && cur.ks) || []);
      if (box.checked) next.add(o.k);
      else next.delete(o.k);
      // Unticking the last box keeps what is written in "Anything else".
      stage(
        item.id,
        withNote(item, next.size ? { type: "answer", kind: "multi", ks: [...next] } : null, {
          type: "answer",
          kind: "multi",
          ks: [],
        })
      );
    });

    const body = el("div", "option-body");
    const head = el("div", "option-label");
    if (o.k) head.appendChild(el("span", "option-key", o.k));
    head.appendChild(el("span", null, o.text));
    if (o.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));

    label.appendChild(box);
    label.appendChild(body);
    li.appendChild(label);
    list.appendChild(li);
  }
  card.appendChild(list);
  card.appendChild(el("p", "help", "Pick as many as apply."));
  renderPresets(card, item, staged);
  otherField(card, item, staged);
}

// Shortcuts that tick a named set in one go, for a long list where the usual
// answers are groups ("the serious ones", "all of them"): the review's fix
// list is the case it exists for. A preset only ticks boxes. The answer is
// still the ticks, so they can adjust after pressing one, and what reaches the
// agent is the same list it would have got from ticking by hand.
function renderPresets(card, item, staged) {
  const known = new Set((item.options || []).map((o) => o.k));
  const presets = (Array.isArray(item.presets) ? item.presets : [])
    .map((p) => ({ label: String((p && p.label) || "").trim(), ks: ((p && p.ks) || []).filter((k) => known.has(k)) }))
    .filter((p) => p.label && p.ks.length);
  if (!presets.length) return;
  const row = el("div", "btn-row presets");
  row.appendChild(el("span", "presets-label", "Quick pick:"));
  const now = new Set((staged && staged.ks) || []);
  for (const p of presets) {
    const on = p.ks.length === now.size && p.ks.every((k) => now.has(k));
    const b = el("button", "btn small" + (on ? " primary" : " ghost"), p.label);
    b.type = "button";
    b.setAttribute("aria-pressed", String(on));
    b.addEventListener("click", () =>
      stage(
        item.id,
        withNote(item, on ? null : { type: "answer", kind: "multi", ks: [...p.ks] }, {
          type: "answer",
          kind: "multi",
          ks: [],
        })
      )
    );
    row.appendChild(b);
  }
  card.appendChild(row);
}

function buildText(card, item, staged) {
  const wrap = el("div", "field");
  const id = "text-" + item.id;
  const head = el("div", "field-head");
  const label = el("label", null, item.inputLabel || "Your answer");
  label.htmlFor = id;
  head.appendChild(label);
  wrap.appendChild(head);

  // Compiled once, here: a pattern that does not compile is treated as no
  // pattern at all, rather than throwing on every keystroke (and on Autofill)
  // and leaving the answer impossible to stage.
  let pattern = null;
  if (item.pattern) {
    try {
      pattern = new RegExp(item.pattern);
    } catch {}
  }
  const single = Boolean(pattern);
  const input = el(single ? "input" : "textarea");
  if (single) input.type = "text";
  input.id = id;
  input.placeholder = item.placeholder || "Type here. Plain language is fine.";
  input.value = (staged && staged.text) || local.drafts[id] || "";
  attachMentions(input);

  const err = el("p", "field-error");
  err.hidden = true;

  const suggestion = suggestionFrom(item);
  let fill = null;

  const check = () => {
    setDraft(id, input.value);
    // The offer only stands while the box is empty. Overwriting something
    // someone typed, from a button they meant to read rather than press, is
    // exactly the kind of loss this page is built to avoid.
    if (fill) fill.hidden = Boolean(input.value.trim());
    const v = input.value.trim();
    if (pattern && v) {
      // Live validation a terminal simply cannot do. Most often a kebab-case name.
      const ok = pattern.test(v);
      input.classList.toggle("invalid", !ok);
      err.hidden = ok;
      err.textContent = item.patternHint || "That is not a valid value.";
      if (!ok) {
        stageQuiet(item.id, null);
        stagedChanged();
        return;
      }
    } else {
      input.classList.remove("invalid");
      err.hidden = true;
    }
    stageQuiet(item.id, v ? { type: "answer", kind: "text", text: v } : null);
    stagedChanged();
  };
  input.addEventListener("input", check);

  if (suggestion) {
    fill = el("button", "btn tiny", "Autofill suggestion");
    fill.type = "button";
    fill.title = "Put the example into the box. It is yours to edit from there.";
    fill.hidden = Boolean(input.value.trim());
    fill.addEventListener("click", () => {
      input.value = suggestion;
      check();
      input.focus();
      try {
        input.setSelectionRange(suggestion.length, suggestion.length);
      } catch {}
    });
    head.appendChild(fill);
  }

  if (item.templates === "idea" && TEMPLATE_WORKFLOWS.includes(S.workflow)) {
    wrap.appendChild(templateRow(item, input, templatesFor(S.workflow, looks.role), check));
  }
  wrap.appendChild(input);
  // Fresh-idea boxes take files as context, the same ones the note pane holds.
  if (!single && TEMPLATE_WORKFLOWS.includes(S.workflow)) {
    input.addEventListener("paste", (e) => {
      const files = incomingFiles(e.clipboardData && e.clipboardData.files);
      if (!files.length) return;
      if (!e.clipboardData.getData("text/plain")) e.preventDefault();
      attachFiles(item.id, files);
    });
    const under = attachRow(item.id, "Add files to this answer");
    under.classList.add("is-under");
    wrap.appendChild(under);
    const attached = noteImages(item.id);
    if (attached.length) wrap.appendChild(attachTray(item.id, attached));
  }
  if (item.help) wrap.appendChild(el("p", "help", item.help));
  wrap.appendChild(err);
  card.appendChild(wrap);
}

// The starter templates above a fresh-idea box. The chip choice lives only in
// local.drafts: what gets staged and sent is the box's text, never the id.
function templateRow(item, input, entries, check) {
  const key = "tpl-" + item.id;
  const row = el("div", "tpl-row");
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "Starter templates");
  let strip = null;

  const selectedEntry = () => entries.find((e) => e.id === local.drafts[key]) || entries[0];
  // The strip changes the card's height without resizing the column, so the
  // column's observer never hears of it: refit the growing box here.
  const dropStrip = () => {
    if (!strip) return;
    strip.remove();
    strip = null;
    fitGrowBox();
  };
  const chips = entries.map((entry) => {
    const chip = el("button", "tpl-chip", entry.label);
    chip.type = "button";
    if (entry.forYou) chip.appendChild(el("span", "tpl-pill", "For your role"));
    chip.addEventListener("click", () => pick(entry));
    row.appendChild(chip);
    return chip;
  });
  const paint = () => {
    const selected = selectedEntry();
    chips.forEach((chip, i) => chip.setAttribute("aria-pressed", String(entries[i] === selected)));
  };

  const apply = (entry, text) => {
    dropStrip();
    input.value = text;
    local.drafts[key] = entry.id;
    check();
    save();
    paint();
    input.focus();
    try {
      input.setSelectionRange(text.length, text.length);
    } catch {}
  };

  const pick = (entry) => {
    const selected = selectedEntry();
    if (entry === selected) return;
    const sw = templateSwap({ selectedText: selected.text, boxText: input.value, nextText: entry.text });
    if (!sw.confirm) {
      apply(entry, sw.text);
      return;
    }
    dropStrip();
    strip = el("div", "tpl-replace");
    strip.setAttribute("role", "alert");
    strip.appendChild(el("span", null, "Replace what you typed?"));
    const replace = el("button", "btn tiny primary", "Replace");
    replace.type = "button";
    replace.addEventListener("click", () => apply(entry, sw.text));
    const keep = el("button", "btn tiny ghost", "Keep mine");
    keep.type = "button";
    keep.addEventListener("click", () => {
      dropStrip();
      input.focus();
    });
    strip.append(replace, keep);
    row.after(strip);
    fitGrowBox();
  };

  paint();
  return row;
}

function buildConfirm(card, item, staged) {
  const row = el("div", "btn-row");
  const yesLabel = item.yesLabel || "Yes";
  const noLabel = item.noLabel || "No";

  const mk = (label, yes, danger) => {
    const on = staged && staged.yes === yes;
    const b = el("button", "btn" + (on ? " primary" : "") + (danger && !on ? " danger" : ""), label);
    b.type = "button";
    b.addEventListener("click", () =>
      stage(item.id, withNote(item, on ? null : { type: "answer", kind: "confirm", yes }))
    );
    return b;
  };
  row.appendChild(mk(yesLabel, true, item.danger));
  row.appendChild(mk(noLabel, false, false));
  card.appendChild(row);

  if (item.consequences) {
    const note = el("div", "card-note");
    note.appendChild(md(item.consequences, "md"));
    card.appendChild(note);
  }
  commentField(card, item, "Anything to add?");
}

function buildRecap(card, item, staged) {
  // The recap is not optional: a click captured the pick, this captures the
  // agreement. Rendered as a document so it reads like a summary, not a form.
  if (item.summary) {
    const box = el("div", "card-note");
    box.appendChild(md(item.summary, "md"));
    card.appendChild(box);
  }
  const row = el("div", "btn-row");
  const okOn = staged && staged.ok === true;
  const fixOn = staged && staged.ok === false;

  const ok = el("button", "btn" + (okOn ? " primary" : ""), item.yesLabel || "Yes, that is right");
  ok.type = "button";
  ok.addEventListener("click", () => stage(item.id, okOn ? null : { type: "answer", kind: "recap", ok: true }));

  const fix = el("button", "btn" + (fixOn ? " primary" : ""), item.noLabel || "Not quite");
  fix.type = "button";
  fix.addEventListener("click", () =>
    stage(item.id, fixOn ? null : { type: "answer", kind: "recap", ok: false })
  );

  row.appendChild(ok);
  row.appendChild(fix);
  card.appendChild(row);

  if (fixOn) commentField(card, item, "What should it say instead?", true);
}

// A question that is about a document says so on the card, with a way to it.
// The tab row does the same job, but nobody reads a tab row as part of the
// question in front of them: people ticked the review's fix list blind, never
// having noticed the findings sat one tab over.
function docLink(item) {
  const doc = item.doc && docs().find((d) => d.id === item.doc);
  if (!doc) return null;
  const open = el("button", "btn small", `Read “${doc.title || "the document"}” in full`);
  open.type = "button";
  open.style.marginTop = "14px";
  open.addEventListener("click", () => {
    view = "doc:" + doc.id;
    render();
  });
  return open;
}

function buildReview(card, item, staged) {
  if (item.summary) {
    const box = el("div", "card-note");
    box.appendChild(md(item.summary, "md"));
    card.appendChild(box);
  }
  if (item.nothingYet !== false) {
    const safe = el("p", "help");
    safe.style.marginTop = "14px";
    safe.textContent =
      item.nothingYet || "Nothing has been changed yet. This only happens once you approve it.";
    card.appendChild(safe);
  }

  const verdicts = item.verdicts || [
    { id: "approve", label: "Looks good, go ahead" },
    { id: "changes", label: "I want changes" },
  ];
  const row = el("div", "btn-row");
  for (const v of verdicts) {
    const on = staged && staged.verdict === v.id;
    const b = el("button", "btn" + (on ? " primary" : "") + (v.danger && !on ? " danger" : ""), verdictText(v));
    b.type = "button";
    b.addEventListener("click", () =>
      stage(item.id, withNote(item, on ? null : { type: "answer", kind: "review", verdict: v.id }))
    );
    row.appendChild(b);
  }
  card.appendChild(row);

  // Every gate in the workflow accepts "or describe any issues", so approval
  // and feedback are one submit, never two.
  commentField(card, item, "Notes, questions, or what to change");
}

function buildChecklist(card, item, staged) {
  const doneSet = new Set((staged && staged.done) || []);
  // Built from the live answer, so a note typed since the render rides along.
  // Nothing ticked, no state and no note is no answer at all: stage nothing
  // rather than an empty one that would still count as ready to send.
  const commitList = (change) => {
    const cur = local.staged[item.id];
    const next = { ...(cur || {}), type: "answer", kind: "checklist", ...change };
    // A tick or a state IS the answer, so it ends a skip staged earlier:
    // left in place, `skipped` would collapse the reply to "skip" while the
    // card showed ticked steps on their way.
    delete next.skipped;
    const empty = !(next.done && next.done.length) && !next.state && !next.text;
    stage(item.id, empty ? null : next);
  };
  const list = el("ol", "steps");
  (item.steps || []).forEach((step, i) => {
    const li = el("li", "step");
    const box = el("input");
    box.type = "checkbox";
    box.id = `step-${item.id}-${i}`;
    box.checked = doneSet.has(i);
    box.addEventListener("change", () => {
      const cur = local.staged[item.id];
      const next = new Set((cur && cur.done) || []);
      if (box.checked) next.add(i);
      else next.delete(i);
      commitList({ done: [...next] });
    });
    const label = el("label");
    label.htmlFor = box.id;
    label.style.flex = "1";
    label.appendChild(md(typeof step === "string" ? step : step.text, "md"));
    li.appendChild(el("span", "step-num", String(i + 1)));
    li.appendChild(box);
    li.appendChild(label);
    list.appendChild(li);
  });
  card.appendChild(list);

  const states = [
    { id: "done", label: "All done" },
    { id: "blocked", label: "I am stuck" },
    { id: "help", label: "I need help" },
    { id: "defer", label: "Later" },
  ];
  const row = el("div", "btn-row");
  for (const s of states) {
    const on = staged && staged.state === s.id;
    const b = el("button", "btn" + (on ? " primary" : ""), s.label);
    b.type = "button";
    b.addEventListener("click", () => commitList({ state: on ? null : s.id }));
    row.appendChild(b);
  }
  card.appendChild(row);
  commentField(card, item, item.valuesLabel || "Anything you were asked to write down");
}

function buildMenu(card, item, staged) {
  const list = el("ul", "options");
  const name = "menu-" + item.id;
  for (const [i, o] of (item.options || []).entries()) {
    const picked = staged && staged.k === o.k;
    const li = el("li", "option" + (picked ? " is-picked" : ""));
    const label = el("label");
    label.style.display = "contents";
    const radio = el("input");
    radio.type = "radio";
    radio.name = name;
    // The same id buildChoice gives its radios: withFocus finds the focused
    // input by id after the render this change() sets off, and without one a
    // keyboard user arrowing through the menu lands on <body> every time.
    radio.id = optionId(item, o, i);
    radio.value = o.k;
    radio.checked = Boolean(picked);
    radio.setAttribute("aria-label", o.k ? `${o.k}: ${o.text}` : o.text);
    radio.addEventListener("change", () => stage(item.id, { type: "answer", kind: "menu", k: o.k }));
    const body = el("div", "option-body");
    const head = el("div", "option-label");
    head.appendChild(el("span", null, o.text));
    if (o.recommended) head.appendChild(el("span", "pill suggested", "Suggested"));
    body.appendChild(head);
    if (o.detail) body.appendChild(el("p", "option-detail", o.detail));
    label.appendChild(radio);
    label.appendChild(body);
    li.appendChild(label);
    list.appendChild(li);
  }
  card.appendChild(list);

  if (item.command) {
    const note = el("div", "card-note");
    note.appendChild(el("p", "help", "To pick this up in a fresh session, run:"));
    note.appendChild(md("```\n" + handoffText({ command: item.command }) + "\n```", "md"));
    card.appendChild(note);
  }
}

function buildList(card, item, staged) {
  // Reorder, rename, remove. The agent proposed a breakdown; this is where a
  // person who knows the work fixes it before it becomes the plan.
  //
  // Every handler re-reads the rows at the moment it fires rather than closing
  // over the array from render time. A reorder replaces that array, so a stale
  // closure would quietly undo the reorder the next time a rename committed.
  const liveRows = () => {
    const cur = local.staged[item.id];
    return (cur && cur.rows) || (item.rows || []).map((r) => ({ ...r }));
  };
  const rows = liveRows();
  const ul = el("ul", "rows");
  let dragIndex = null;

  const commit = (next) => stage(item.id, withNote(item, { type: "answer", kind: "list", rows: next }));

  rows.forEach((row, i) => {
    const li = el("li", "row-item");
    li.draggable = true;

    li.addEventListener("dragstart", () => {
      dragIndex = i;
      li.classList.add("dragging");
    });
    li.addEventListener("dragend", () => li.classList.remove("dragging"));
    li.addEventListener("dragover", (e) => {
      e.preventDefault();
      li.classList.add("drop-target");
    });
    li.addEventListener("dragleave", () => li.classList.remove("drop-target"));
    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drop-target");
      if (dragIndex === null || dragIndex === i) return;
      const next = liveRows();
      const [moved] = next.splice(dragIndex, 1);
      next.splice(i, 0, moved);
      commit(next);
    });

    const handle = el("button", "row-handle", "⠿");
    handle.type = "button";
    handle.title = "Drag to reorder";
    handle.setAttribute("aria-label", `Move “${row.title}”`);
    li.appendChild(handle);
    li.appendChild(el("span", "row-order", String(i + 1)));

    const main = el("div", "row-main");
    // A real input rather than contenteditable: it is reachable by keyboard and
    // by a screen reader, it has a stable id so withFocus() can restore the
    // caret across a re-render, and `change` fires only when the value actually
    // changed, which stops a rename from re-entering render on every blur.
    const title = el("input", "row-title");
    title.type = "text";
    title.id = `row-${item.id}-${row.id}`;
    title.value = row.title || "";
    title.setAttribute("aria-label", "Name");
    title.addEventListener("change", () => {
      const next = liveRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at === -1) return;
      const value = title.value.trim();
      if (value === next[at].title) return;
      next[at] = { ...next[at], title: value };
      commit(next);
    });
    main.appendChild(title);
    if (row.body) main.appendChild(el("div", "row-body", row.body));
    li.appendChild(main);

    const tools = el("div", "row-tools");
    const up = el("button", "btn ghost small", "↑");
    up.type = "button";
    up.title = "Move up";
    up.disabled = i === 0;
    up.addEventListener("click", () => {
      const next = liveRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at <= 0) return;
      [next[at - 1], next[at]] = [next[at], next[at - 1]];
      commit(next);
    });
    const down = el("button", "btn ghost small", "↓");
    down.type = "button";
    down.title = "Move down";
    down.disabled = i === rows.length - 1;
    down.addEventListener("click", () => {
      const next = liveRows();
      const at = next.findIndex((r) => r.id === row.id);
      if (at === -1 || at === next.length - 1) return;
      [next[at + 1], next[at]] = [next[at], next[at + 1]];
      commit(next);
    });
    const del = el("button", "btn ghost small", "×");
    del.type = "button";
    del.title = "Remove";
    del.setAttribute("aria-label", `Remove “${row.title}”`);
    del.addEventListener("click", () => commit(liveRows().filter((r) => r.id !== row.id)));
    tools.appendChild(up);
    tools.appendChild(down);
    tools.appendChild(del);
    li.appendChild(tools);

    ul.appendChild(li);
  });
  card.appendChild(ul);

  const row = el("div", "btn-row");
  const add = el("button", "btn small", "Add one");
  add.type = "button";
  add.addEventListener("click", () =>
    commit([...liveRows(), { id: "new-" + Date.now(), title: "New step", body: "" }])
  );
  row.appendChild(add);
  if (staged) {
    const reset = el("button", "linky", "Put it back how it was");
    reset.type = "button";
    // Puts the rows back; a note typed below stays.
    reset.addEventListener("click", () => stage(item.id, withNote(item, null)));
    row.appendChild(reset);
  }
  card.appendChild(row);
  card.appendChild(el("p", "help", "Drag to reorder, click a name to rename it."));
  commentField(card, item, "Anything else about this breakdown? (type 'no changes' if none)");
}

function commentField(card, item, labelText, required) {
  const wrap = el("div", "field");
  const id = "note-" + item.id;
  const label = el("label", null, labelText);
  label.htmlFor = id;
  wrap.appendChild(label);
  const ta = el("textarea");
  ta.id = id;
  ta.placeholder = required ? "Tell Plan2Code what to change." : "Optional.";
  ta.value = (local.staged[item.id] && local.staged[item.id].text) || local.drafts[id] || "";
  attachMentions(ta);
  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    const cur = local.staged[item.id];
    if (cur) {
      const next = { ...cur, text: ta.value.trim() || undefined };
      // Emptying the box of a note-only answer leaves nothing to send, so it
      // unstages rather than counting as ready.
      const empty = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
      const bare = Object.keys(next).every((k) => k === "type" || k === "kind" || empty(next[k]));
      stageQuiet(item.id, bare ? null : next);
    } else if (ta.value.trim())
      stageQuiet(item.id, { type: "answer", kind: item.kind, text: ta.value.trim() });
    stagedChanged();
  });
  wrap.appendChild(ta);
  card.appendChild(wrap);
}

// Every builder above may assume its question is OPEN and has no answer in
// flight. renderCard is the only caller and routes the other two states to
// renderSettled and renderInFlight, which draw a record rather than a form.
// The builders used to carry their own half of that job, in `!isOpen` branches
// that no longer run; keeping them would have meant two renderings of a settled
// answer, one of them untested and wrong.
const BUILDERS = {
  choice: buildChoice,
  multi: buildMulti,
  text: buildText,
  confirm: buildConfirm,
  recap: buildRecap,
  review: buildReview,
  checklist: buildChecklist,
  menu: buildMenu,
  list: buildList,
};

/* ----------------------------------------------------------------- doc */

function renderDoc(main, id) {
  const doc = docs().find((d) => d.id === id);
  if (!doc) {
    main.appendChild(el("p", "doc-empty", "That document is not ready yet."));
    return;
  }
  const head = el("div", "doc-head");
  head.appendChild(el("h2", null, doc.title || "Document"));
  head.appendChild(el("span", "doc-version", "v" + (doc.version || 1)));
  if (doc.stale) {
    head.appendChild(el("span", "pill staged", "Out of date"));
  }

  const tools = el("div", "doc-tools");
  // A brief is handed to people who were not in the room, so it gets a copy
  // that opens in any browser, formatting and all.
  if (doc.id === "brief") {
    const html = el("button", "btn small", "Save as HTML");
    html.type = "button";
    html.addEventListener("click", () => downloadDocHtml(doc));
    tools.appendChild(html);
  }
  tools.appendChild(printButton());

  if (doc.saved) {
    tools.appendChild(docSavedNote(doc));
  } else {
    const save = el("button", "btn small", "Download");
    save.type = "button";
    save.addEventListener("click", () => downloadDoc(doc));
    tools.appendChild(save);
  }
  head.appendChild(tools);

  main.appendChild(head);
  if (doc.note) main.appendChild(el("p", "help", doc.note));

  const blocks = doc.blocks || [];
  if (!blocks.length) {
    main.appendChild(el("p", "doc-empty", "Nothing written yet. It fills in as you answer."));
    return;
  }
  // The block nearest the top of the column is the section + Add context
  // offers after leaving this tab. Its label is its first heading.
  docObserver?.disconnect();
  if (docInView && docInView.docId !== doc.id) docInView = null;
  const boxes = [];
  const topmost = () => {
    const top = main.getBoundingClientRect().top;
    const box = boxes.find((x) => x.getBoundingClientRect().bottom > top + 1);
    if (!box) return;
    const heading = box.querySelector("h1, h2, h3, h4, h5, h6");
    docInView = {
      docId: doc.id,
      blockId: box.dataset.block,
      label: (heading && heading.textContent.trim()) || doc.title || "Document",
    };
  };
  docObserver = typeof IntersectionObserver === "function" ? new IntersectionObserver(topmost, { root: main, threshold: [0, 0.25, 0.5, 0.75, 1] }) : null;
  blocks.forEach((b, i) => {
    const box = el("div", "block " + (b.state || "settled"));
    box.dataset.block = b.id || String(i);
    boxes.push(box);
    docObserver?.observe(box);
    if (b.state === "assumed") {
      // Borrowed from grill-with-ui and the best idea in it: show plainly which
      // parts are still a guess, so nobody mistakes a placeholder for a decision.
      box.appendChild(el("span", "block-tag", "Assumed for now, still open"));
    }
    if (b.state === "draft") box.appendChild(el("span", "block-tag", "Draft"));
    box.appendChild(md(b.md, "md"));
    main.appendChild(box);
  });
}

function printButton() {
  const print = el("button", "btn small", "Print");
  print.type = "button";
  // The print stylesheet drops everything that steers the session, so what
  // comes out is the document alone. "Save as PDF" in that dialog is also the
  // most portable save this page can offer.
  print.addEventListener("click", () => window.print());
  return print;
}

// The spec's overview.md, read-only and drawn through the same markdown path
// as every doc. No Download: the file is already on disk.
function renderOverview(main) {
  const head = el("div", "doc-head");
  head.appendChild(el("h2", null, "Overview"));
  const tools = el("div", "doc-tools");
  tools.appendChild(printButton());
  head.appendChild(tools);
  main.appendChild(head);
  main.appendChild(el("p", "help", `${overview.key}/overview.md · read-only, straight from disk`));
  const box = el("div", "block settled");
  box.appendChild(md(overview.text, "md"));
  main.appendChild(box);
}

// The helpers the agent reported, as it last posted them. Everything here is
// the agent's text, so it goes in as text, never as markup.
function renderSubagents(main) {
  const card = el("section", "card sa-card");
  card.appendChild(el("h2", null, "Subagents"));
  card.appendChild(el("p", "help", CHECKIN_LINE));
  const { alone, rows } = helperRows(S.helpers);
  if (alone) {
    card.appendChild(
      el("p", "sa-alone", "Working alone: your agent has no way to start helpers here, so it is doing this skill's work itself.")
    );
    main.appendChild(card);
    return;
  }
  const list = el("ul", "sa-list");
  for (const row of rows) {
    const item = el("li", "sa-row");
    const head = el("div", "sa-head");
    head.appendChild(el("strong", "sa-title", row.title));
    const pill = el("span", "pill sa-pill is-" + row.state);
    if (row.state === "running") {
      const spin = el("span", "spinner tiny");
      spin.setAttribute("aria-hidden", "true");
      pill.appendChild(spin);
    }
    pill.appendChild(document.createTextNode(row.stateLabel));
    head.appendChild(pill);
    item.appendChild(head);
    item.appendChild(el("p", "sa-ask", row.ask));
    if (row.result) item.appendChild(el("p", "sa-result", row.result));
    list.appendChild(item);
  }
  card.appendChild(list);
  main.appendChild(card);
}

/* ---------------------------------------------------------------- ask */

// The frame's chat block, with `offline` worked out now rather than when the
// frame was sent: the agent comes and goes between frames, and /ping keeps
// agentLastSeen current. The frame's own verdict stands when there is no clock.
function askFrame() {
  const base = chatFrame || { conversation: 0, messages: [], typed: 0, limit: 10, offline: false };
  if (!S || !agentLastSeen) return base;
  const offline = chatOffline({
    finish: finish(),
    agent: S.agent,
    agentLastSeenMs: Date.parse(agentLastSeen),
    now: Date.now(),
  });
  return { ...base, offline };
}

function askState() {
  const frame = askFrame();
  const shown = chatView(frame, { pendingSends: local.chat.pending, agentActivity: activity() });
  const pendingSendCount = shown.rows.filter((r) => r.pending && !r.failed).length;
  return { frame, view: shown, send: chatSendState({ frameChat: frame, gone, pendingSendCount }) };
}

// The conversation a send belongs to. The page's own record wins over the
// frame for the moment after a 409 stale, before the new frame lands.
const askConversation = () => local.chat.conversation ?? askFrame().conversation;

// An upload's server path is `<session>/uploads/<uuid>.<ext>`; the page serves
// it at /uploads/<uuid>.<ext>.
const uploadUrl = (img) => img.url || "/uploads/" + String(img.path || "").split(/[\\/]/).pop();

function renderAsk(main) {
  const { frame, view: v, send: ss } = askState();
  // Anything drawn here has been seen: no dot for it later.
  const newest = newestReplyId(frame);
  if (newest && local.chat.lastSeenReplyId !== newest) {
    local.chat.lastSeenReplyId = newest;
    save();
  }
  chatDot = false;
  askPaintedOffline = ss.state === "offline";

  const pane = el("section", "ask-pane");
  const head = el("div", "ask-head");
  head.appendChild(el("h2", null, "Quick question"));
  head.appendChild(el("span", "ask-counter", v.counterText));
  const reset = el("button", "btn small ghost", "New conversation");
  reset.type = "button";
  reset.disabled = ss.state === "offline" || chatResetting;
  reset.addEventListener("click", newConversation);
  head.appendChild(reset);
  pane.appendChild(head);

  const list = el("div", "ask-list");
  list.setAttribute("role", "log");
  list.setAttribute("aria-live", "polite");
  if (!v.rows.length) list.appendChild(askStarters(ss));
  const notes = new Map(v.rows.filter((r) => r.kind === "decision").map((r) => [r.re, r.text]));
  for (const r of v.rows) list.appendChild(askRow(r, ss, notes));
  pane.appendChild(list);
  pane.appendChild(askComposer(ss));
  main.appendChild(pane);

  // Back where the person left the list, unless something new arrived (or it
  // is the first look), which brings the newest row into view.
  const saved = scrollMemory.get("ask");
  const grew = v.rows.length > askRowCount;
  askRowCount = v.rows.length;
  list.scrollTop = !saved || grew ? list.scrollHeight : saved.top;
}

// An empty conversation offers a few questions for this step, the role's
// first. A click only fills the box: nothing is ever sent for the person.
function askStarters(ss) {
  const box = el("div", "ask-starters");
  box.appendChild(el("p", "ask-starters-lead", "Not sure what to ask? Try one of these:"));
  for (const starter of startersFor(S.workflow, looks.role, { hasContext: Boolean(local.chat.about) })) {
    const b = el("button", "ask-starter", starter.text);
    b.type = "button";
    b.disabled = !ss.canType;
    b.addEventListener("click", () => {
      local.chat.draft = starter.text;
      save();
      render();
      const ta = $("ask-input");
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(ta.value.length, ta.value.length);
    });
    box.appendChild(b);
  }
  return box;
}

function askRow(r, ss, notes) {
  if (r.kind === "decision") {
    const row = el("div", "ask-row decision");
    row.appendChild(el("p", "ask-decision", r.decision === "approve" ? "You approved the edit, please wait..." : "You declined the edit."));
    if (r.text) row.appendChild(el("p", "ask-text", r.text));
    return row;
  }
  if (r.kind === "agent") {
    const row = el("div", "ask-row agent");
    row.appendChild(el("div", "msg-who", "Plan2Code"));
    row.appendChild(md(r.md, "md"));
    if (r.proposal) row.appendChild(askProposal(r, ss, notes.get(r.id)));
    if (Array.isArray(r.changed) && r.changed.length) {
      const ul = el("ul", "ask-changed");
      for (const c of r.changed) {
        const li = el("li");
        li.appendChild(el("code", null, c.file));
        li.appendChild(el("span", "ask-changed-count", ` +${c.added} −${c.removed}`));
        ul.appendChild(li);
      }
      row.appendChild(ul);
    }
    return row;
  }
  const row = el("div", "ask-row person" + (r.pending ? " pending" : ""));
  if (r.about && r.about.label) row.appendChild(el("p", "ask-about", "About: " + r.about.label));
  row.appendChild(el("p", "ask-text", r.text));
  const hasImages = r.images && r.images.length;
  const hasFiles = r.files && r.files.length;
  if (hasImages || hasFiles) {
    const tray = el("div", "attach-tray");
    for (const img of r.images || []) {
      const fig = el("figure", "attach-thumb is-ready");
      const pic = el("img");
      pic.src = thumbs.get(img.key) || uploadUrl(img);
      pic.alt = img.name || "image";
      fig.appendChild(pic);
      tray.appendChild(fig);
    }
    for (const file of r.files || []) tray.appendChild(docChip(file, "ready"));
    row.appendChild(tray);
  }
  if (r.pending && r.failed) {
    const fail = el("p", "ask-waiting ask-failed", "Not sent — retry");
    const retry = el("button", "btn tiny", "Retry");
    retry.type = "button";
    retry.disabled = ss.state === "offline" || chatSending;
    retry.addEventListener("click", () => retryChat(r.tempId));
    fail.appendChild(retry);
    row.appendChild(fail);
  } else if (r.pending) {
    row.appendChild(el("p", "ask-waiting", "Sending…"));
  } else if (r.waiting) {
    const wait = el("p", "ask-waiting");
    // Picked up and still answering: the ring says so, unless the agent has
    // gone quiet, when a turning ring would pass a dead session for a slow one.
    if (r.working && ss.state !== "offline" && !agentAdrift()) {
      const spin = el("span", "spinner tiny");
      spin.setAttribute("aria-hidden", "true");
      wait.appendChild(spin);
    }
    wait.appendChild(el("span", null, r.waitingText));
    row.appendChild(wait);
    if (r.activity) row.appendChild(el("p", "ask-waiting", "Right now: " + r.activity));
  }
  return row;
}

function askProposal(r, ss, note) {
  const box = el("div", "ask-proposal");
  box.appendChild(el("p", "note-kicker", "Proposed change"));
  box.appendChild(md(r.proposal.summary, "md"));
  const files = el("ul", "ask-proposal-files");
  for (const f of r.proposal.files || []) {
    const li = el("li");
    li.appendChild(el("code", null, f));
    files.appendChild(li);
  }
  box.appendChild(files);

  if (r.decided) {
    box.appendChild(el("p", "ask-decided " + r.decided, r.decided === "approve" ? "Approved" : "Declined"));
    if (note) box.appendChild(el("p", "help", note));
    return box;
  }
  const busy = deciding.has(r.id) || ss.state === "offline";
  const row = el("div", "ask-proposal-actions");
  const approve = el("button", "btn small primary", "Approve");
  approve.type = "button";
  approve.disabled = busy;
  approve.addEventListener("click", () => decideChat(r.id, "approve", ""));
  row.appendChild(approve);
  if (!declineOpen.has(r.id)) {
    const decline = el("button", "btn small ghost", "Decline");
    decline.type = "button";
    decline.disabled = busy;
    decline.addEventListener("click", () => {
      declineOpen.set(r.id, "");
      render();
      $("decline-" + r.id)?.focus();
    });
    row.appendChild(decline);
  } else {
    const input = el("input");
    input.type = "text";
    input.id = "decline-" + r.id;
    input.placeholder = "Why not? (optional)";
    input.maxLength = CHAT_MAX_CHARS;
    input.value = declineOpen.get(r.id) || "";
    input.addEventListener("input", () => declineOpen.set(r.id, input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      decideChat(r.id, "decline", input.value);
    });
    row.appendChild(input);
    const go = el("button", "btn small", "Send decline");
    go.type = "button";
    go.disabled = busy;
    go.addEventListener("click", () => decideChat(r.id, "decline", declineOpen.get(r.id) || ""));
    row.appendChild(go);
  }
  box.appendChild(row);
  if (deciding.has(r.id)) box.appendChild(el("p", "help", "Sent. It will show here once Plan2Code has it."));
  return box;
}

const COUNTER_FROM = 3500;

function askComposer(ss) {
  const comp = el("div", "ask-composer");
  const about = local.chat.about;
  if (about) {
    const chip = el("div", "ask-about-chip");
    chip.appendChild(el("span", null, "About: " + about.label));
    const x = el("button", "attach-remove", "×");
    x.type = "button";
    x.setAttribute("aria-label", "Send without this");
    x.addEventListener("click", () => {
      Object.assign(local.chat, nextAbout(local.chat, { type: "drop" }));
      save();
      render();
    });
    chip.appendChild(x);
    comp.appendChild(chip);
  }
  if (local.chat.images.length) comp.appendChild(attachTray(CHAT_IMAGES, local.chat.images));

  const ta = el("textarea");
  ta.id = "ask-input";
  ta.placeholder = "Ask anything about this project";
  ta.value = local.chat.draft || "";
  ta.disabled = !ss.canType;
  ta.setAttribute("aria-label", "Your question");
  attachMentions(ta);
  comp.appendChild(ta);

  const row = el("div", "ask-actions");
  const add = el("button", "btn small ghost", "+ Attach file");
  add.type = "button";
  add.setAttribute("aria-label", "Add files to this question");
  add.disabled = !ss.canType || local.chat.images.length >= CHAT_MAX_ATTACHMENTS;
  const picker = el("input");
  picker.type = "file";
  picker.accept = pickerAccept();
  picker.multiple = true;
  picker.hidden = true;
  add.addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    attachFiles(CHAT_IMAGES, picker.files);
    picker.value = "";
  });
  row.appendChild(add);
  row.appendChild(picker);
  if (!local.chat.about) row.appendChild(addContext(ss));

  // Where the counter sits, the reason Send is off when it cannot be typed in:
  // the limit, the last question still waiting, or nobody there to answer.
  const counter = el("span", "ask-count");
  if (!ss.canType) {
    const cls = ss.state === "offline" ? "is-offline" : ss.state === "limit" ? "is-limit" : "is-waiting";
    row.appendChild(el("p", "ask-disabled-note " + cls, ss.text));
  } else {
    row.appendChild(counter);
    const hint = el("span", "ask-send-hint");
    hint.appendChild(el("kbd", null, isMac() ? "⌘" : "Ctrl"));
    hint.appendChild(document.createTextNode(" + "));
    hint.appendChild(el("kbd", null, "Enter"));
    row.appendChild(hint);
  }

  const go = el("button", "btn small primary", "Send");
  go.type = "button";
  row.appendChild(go);
  comp.appendChild(row);
  if (chatError) comp.appendChild(el("p", "ask-error", chatError));

  const held = () => local.chat.images.some((img) => img.status !== "ready");
  const sync = () => {
    const len = ta.value.length;
    counter.textContent = len >= COUNTER_FROM ? `${len} / ${CHAT_MAX_CHARS}` : "";
    counter.classList.toggle("is-over", len > CHAT_MAX_CHARS);
    go.disabled = !ss.canType || chatSending || !ta.value.trim() || len > CHAT_MAX_CHARS || held();
  };
  sync();
  ta.addEventListener("input", () => {
    local.chat.draft = ta.value;
    save();
    sync();
  });
  // Ctrl/Cmd+Enter sends and a plain Enter is a line break. Every Enter stops
  // here, so the page-wide Ctrl+Enter never sends the question cards from this box.
  ta.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.stopPropagation();
    if (!(e.ctrlKey || e.metaKey) || e.isComposing) return;
    e.preventDefault();
    if (!go.disabled) sendChat();
  });
  ta.addEventListener("paste", (e) => {
    const files = incomingFiles(e.clipboardData && e.clipboardData.files);
    if (!files.length || !ss.canType) return;
    if (!e.clipboardData.getData("text/plain")) e.preventDefault();
    attachFiles(CHAT_IMAGES, files);
  });
  const canDrop = (e) => ss.canType && e.dataTransfer && [...e.dataTransfer.types].includes("Files");
  const onOver = (e) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    comp.classList.add("is-dropping");
  };
  comp.addEventListener("dragenter", onOver);
  comp.addEventListener("dragover", onOver);
  comp.addEventListener("dragleave", (e) => {
    if (!comp.contains(e.relatedTarget)) comp.classList.remove("is-dropping");
  });
  comp.addEventListener("drop", (e) => {
    comp.classList.remove("is-dropping");
    if (!canDrop(e)) return;
    e.preventDefault();
    attachFiles(CHAT_IMAGES, e.dataTransfer.files);
  });
  go.addEventListener("click", sendChat);
  return comp;
}

const CONTEXT_KIND = { card: "Question", section: "Section", spec: "Spec" };

// + Add context: the only way a message gets an `about`. A menu of the last
// three places visited, then This spec, built fresh on every render.
function addContext(ss) {
  const wrap = el("span", "ask-context");
  const spec = isDashboard() ? selSpec() : S && S.specDir ? { dir: S.specDir } : null;
  const options = contextOptions(local.chat, spec);
  const btn = el("button", "btn small ghost", "+ Add context");
  btn.type = "button";
  btn.setAttribute("aria-haspopup", "menu");
  btn.setAttribute("aria-expanded", "false");
  btn.disabled = !ss.canType || !options.length;
  if (!options.length) btn.title = "Visit a question or a document section first";
  wrap.appendChild(btn);

  let menu = null;
  const outside = (e) => {
    if (!wrap.contains(e.target)) close();
  };
  // Focus moves before the menu goes: removing the focused item fires a
  // focusout of its own, which would otherwise re-enter here.
  const close = (refocus) => {
    if (!menu) return;
    const gone = menu;
    menu = null;
    btn.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", outside, true);
    if (refocus) btn.focus();
    gone.remove();
  };
  const open = () => {
    menu = el("div", "ask-context-menu");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", "Add context");
    for (const option of options) {
      const item = el("button", "ask-context-item");
      item.type = "button";
      item.setAttribute("role", "menuitem");
      item.appendChild(el("span", "ask-context-label", option.label));
      item.appendChild(el("span", "ask-context-kind", CONTEXT_KIND[option.kind] || ""));
      item.addEventListener("click", () => {
        close();
        Object.assign(local.chat, nextAbout(local.chat, { type: "pick", about: option }));
        save();
        render();
      });
      menu.appendChild(item);
    }
    // A press inside the menu never moves focus. Safari (and Firefox on
    // macOS) do not focus a clicked button, so the press would blur the
    // focused item to nowhere and the focusout below would close the menu
    // before the click landed.
    menu.addEventListener("mousedown", (e) => e.preventDefault());
    menu.addEventListener("keydown", (e) => {
      const items = [...menu.querySelectorAll('[role="menuitem"]')];
      const at = items.indexOf(document.activeElement);
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close(true);
      } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const step = e.key === "ArrowDown" ? 1 : -1;
        items[(at + step + items.length) % items.length].focus();
      } else if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        items[e.key === "Home" ? 0 : items.length - 1].focus();
      }
    });
    wrap.appendChild(menu);
    btn.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", outside, true);
    menu.querySelector('[role="menuitem"]').focus();
  };
  btn.addEventListener("click", () => (menu ? close() : open()));
  wrap.addEventListener("focusout", (e) => {
    if (menu && !wrap.contains(e.relatedTarget)) close();
  });
  return wrap;
}

const CHAT_ERRORS = {
  stale: "A new conversation started. Your message is still here — press Send again.",
  "too-long": `That message is over ${CHAT_MAX_CHARS.toLocaleString()} characters. Shorten it and send again.`,
  image: "One of the images could not be attached. Remove it and try again.",
  file: "One of the files could not be attached. Remove it and try again.",
};

async function sendChat() {
  const text = (local.chat.draft || "").trim();
  const { send: ss } = askState();
  if (!text || chatSending || !ss.canType || text.length > CHAT_MAX_CHARS) return;
  if (local.chat.images.some((img) => img.status !== "ready")) return;
  const ofKind = (kind) => local.chat.images.filter((a) => attachmentKind(a) === kind);
  const pend = {
    tempId: crypto.randomUUID(),
    text,
    about: local.chat.about,
    images: ofKind("image").map(({ key, path, name, url }) => ({ key, path, name, url })),
    files: ofKind("file").map(({ key, path, name, size }) => ({ key, path, name, size })),
  };
  local.chat.pending.push(pend);
  save();
  await postChat(pend);
}

function retryChat(tempId) {
  const pend = local.chat.pending.find((p) => p.tempId === tempId);
  if (!pend || chatSending) return;
  pend.failed = false;
  save();
  postChat(pend);
}

async function postChat(pend) {
  chatSending = true;
  chatError = "";
  render();
  let res = null;
  let body = {};
  try {
    res = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: pend.text,
        about: pend.about || undefined,
        images: pend.images.length ? pend.images.map(({ path, name }) => ({ path, name })) : undefined,
        files: pend.files && pend.files.length ? pend.files.map(({ path, name }) => ({ path, name })) : undefined,
        conversation: askConversation(),
      }),
    });
    body = await res.json().catch(() => ({}));
  } catch {
    res = null;
  }
  chatSending = false;
  const still = local.chat.pending.find((p) => p.tempId === pend.tempId);
  if (!res) {
    if (still) still.failed = true;
  } else if (res.ok) {
    if (still) still.seq = body.seq;
    // What was sent leaves the composer, and the context leaves with it: a
    // follow-up is a general question unless it is picked again.
    Object.assign(local.chat, nextAbout(local.chat, { type: "sent" }));
    if ((local.chat.draft || "").trim() === pend.text) {
      local.chat.draft = "";
      local.chat.images = [];
    }
  } else {
    local.chat.pending = local.chat.pending.filter((p) => p.tempId !== pend.tempId);
    if (body.error === "stale" && typeof body.conversation === "number") local.chat.conversation = body.conversation;
    // A limit or offline refusal needs no words: the disabled composer says why.
    if (body.error !== "limit" && body.error !== "offline") {
      chatError = CHAT_ERRORS[body.error] || "That message could not be sent. Try again.";
    }
  }
  save();
  render();
}

async function newConversation() {
  // One reset at a time: a second press would only come back stale and put
  // an error under the clean conversation the first one opened.
  if (chatResetting) return;
  chatResetting = true;
  render();
  let res = null;
  let body = {};
  try {
    res = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reset: true, conversation: askConversation() }),
    });
    body = await res.json().catch(() => ({}));
  } catch {}
  if (res && res.ok) {
    // An explicit fresh start: the unsent draft and its pictures go too.
    for (const img of local.chat.images) if (img.id) fetch(deleteUrl(img), { method: "DELETE" }).catch(() => {});
    local.chat = { ...freshChat(), history: local.chat.history, about: null, conversation: body.conversation };
    chatError = "";
    askRowCount = 0;
    declineOpen.clear();
  } else if (body.error === "stale" && typeof body.conversation === "number") {
    local.chat.conversation = body.conversation;
    chatError = "A new conversation had already started.";
  } else if (body.error !== "offline") {
    chatError = "A new conversation could not be started. Try again.";
  }
  chatResetting = false;
  save();
  render();
}

async function decideChat(re, decision, text) {
  if (deciding.has(re)) return;
  deciding.add(re);
  chatError = "";
  render();
  let ok = false;
  let body = {};
  try {
    const res = await fetch("/chat/decision", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ re, decision, text: text.trim() || undefined, conversation: askConversation() }),
    });
    ok = res.ok;
    body = await res.json().catch(() => ({}));
  } catch {}
  // Kept in `deciding` on success: the buttons stay off until the frame
  // brings the decision back, rather than flashing live again in between.
  if (ok) declineOpen.delete(re);
  else {
    deciding.delete(re);
    chatError =
      body.error === "stale"
        ? "That proposal belongs to an earlier conversation."
        : "That decision could not be sent. Try again.";
  }
  render();
}

/* --------------------------------------------------------------- aside */

function renderAside() {
  const aside = $("aside");
  // Redrawing empties the panel, which drops its scroll to the top. An image
  // upload redraws two or three times while the person watches its tray, so
  // the place is kept while the same question stays on screen.
  const place = aside.dataset.item === String(selected) ? aside.scrollTop : 0;
  aside.replaceChildren();
  aside.dataset.item = String(selected);
  // The end page is about the session, not any one question: the notes that
  // belong to a question stay on its own page.
  const item = view === "end" ? null : byId(selected);
  if (!item) {
    aside.appendChild(el("p", "aside-empty", "Pick a question to see its notes."));
    return;
  }
  aside.appendChild(el("h2", null, "Notes on this"));

  const thread = item.thread || [];
  if (!thread.length && !(isOpen(item) && !finish() && noteAwaiting(item))) {
    aside.appendChild(
      el(
        "p",
        "aside-empty",
        isOpen(item) && !finish()
          ? "No back and forth yet. Anything you type here goes with your next send."
          : "Nothing was said about this one."
      )
    );
  }
  // A note that has been sent but not yet picked up: marked as waiting, so the
  // send is seen to have gone, until the agent replies. The server writes the
  // note into the thread as it arrives; a session from before that has only
  // `sentNote`, which gets a box of its own below.
  const waiting = isOpen(item) && !finish() ? noteAwaiting(item) : null;
  let waitingShown = false;
  for (const m of thread) {
    const mine = threadWho(m) === "user";
    const pending = Boolean(waiting && mine && m.at && m.at === waiting.at);
    if (pending) waitingShown = true;
    const box = el("div", "msg" + (mine ? " you" : "") + (pending ? " pending" : ""));
    const who = el("div", "msg-who");
    who.appendChild(el("span", null, mine ? "You" : "Plan2Code"));
    if (pending) who.appendChild(el("span", null, "Sent, waiting for Plan2Code"));
    else if (m.at) who.appendChild(el("span", null, shortTime(m.at)));
    box.appendChild(who);
    const text = threadText(m);
    if (text) box.appendChild(md(text, "md"));
    const tray = mine ? sentAttachments(m) : null;
    if (tray) box.appendChild(tray);
    aside.appendChild(box);
  }

  if (waiting && !waitingShown) {
    const box = el("div", "msg you pending");
    const who = el("div", "msg-who");
    who.appendChild(el("span", null, "You"));
    who.appendChild(el("span", null, "Sent, waiting for Plan2Code"));
    box.appendChild(who);
    if (waiting.text) box.appendChild(md(waiting.text, "md"));
    const tray = sentAttachments(waiting);
    if (tray) box.appendChild(tray);
    aside.appendChild(box);
  }

  // A finished session has nobody left for a note to reach, so the box would
  // be a place to type words that go nowhere.
  if (!isOpen(item) || finish()) {
    aside.scrollTop = place;
    return;
  }

  const wrap = el("div", "field");
  const id = "thread-" + item.id;
  const label = el("label", null, "Add a note, attach a file, or ask something");
  label.htmlFor = id;
  wrap.appendChild(label);

  const attached = noteImages(item.id);
  wrap.appendChild(attachRow(item.id, "Add files to this note"));

  if (attached.length) wrap.appendChild(attachTray(item.id, attached));

  const ta = el("textarea");
  ta.id = id;
  ta.placeholder = "Goes with your next send. It does not answer the question.";
  ta.value = local.drafts[id] || "";
  attachMentions(ta);
  ta.addEventListener("input", () => {
    setDraft(id, ta.value);
    renderFooter();
  });
  ta.addEventListener("paste", (e) => {
    const files = incomingFiles(e.clipboardData && e.clipboardData.files);
    if (!files.length) return;
    // A copy from some apps carries the picture and its text together; the
    // text still pastes as it always did.
    if (!e.clipboardData.getData("text/plain")) e.preventDefault();
    attachFiles(item.id, files);
  });
  wrap.appendChild(ta);
  aside.appendChild(wrap);
  aside.scrollTop = place;
}

const SVG_NS = "http://www.w3.org/2000/svg";

// A page with its corner folded, drawn inline: the CSP allows no icon font.
function pageIcon() {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "attach-chip-icon");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("aria-hidden", "true");
  for (const d of ["M6 2.5h8.5L19 7v14.5H6z", "M14.5 2.5V7H19"]) {
    const path = document.createElementNS(SVG_NS, "path");
    path.setAttribute("d", d);
    svg.appendChild(path);
  }
  return svg;
}

// A document in a tray: never an <img>, since a document is not a picture.
// Icon, extension badge, name and size; a sent one is wrapped in a link.
function docChip(entry, status) {
  const ext = docExt(entry.name) || "";
  const fig = el("figure", `attach-thumb attach-chip is-${status}`);
  const size = typeof entry.size === "number" ? formatBytes(entry.size) : "";
  const label = DOC_TYPES[ext] ? DOC_TYPES[ext].label : "";
  fig.setAttribute("aria-label", [entry.name, label, size].filter(Boolean).join(", "));
  fig.appendChild(pageIcon());
  const text = el("div", "attach-chip-text");
  if (ext) text.appendChild(el("span", "attach-chip-badge", ext.toUpperCase()));
  text.appendChild(el("span", "attach-chip-name", entry.name));
  if (size) text.appendChild(el("span", "attach-chip-size", size));
  fig.appendChild(text);
  return fig;
}

// The + Attach file control and its hidden picker, for a note's box or a
// card's own. Files go to the item's note attachments either way.
function attachRow(itemId, ariaLabel) {
  const row = el("div", "attach-row");
  const btn = el("button", "btn small ghost", "+ Attach file");
  btn.type = "button";
  btn.setAttribute("aria-label", ariaLabel);
  btn.disabled = noteImages(itemId).length >= MAX_ATTACHMENTS;
  const picker = el("input");
  picker.type = "file";
  picker.accept = pickerAccept();
  picker.multiple = true;
  picker.hidden = true;
  btn.addEventListener("click", () => picker.click());
  picker.addEventListener("change", () => {
    attachFiles(itemId, picker.files);
    picker.value = "";
  });
  row.appendChild(btn);
  row.appendChild(picker);
  return row;
}

function attachTray(itemId, attached) {
  const tray = el("div", "attach-tray");
  for (const img of attached) {
    let fig;
    if (attachmentKind(img) === "file") fig = docChip(img, img.status);
    else {
      fig = el("figure", "attach-thumb is-" + img.status);
      const src = thumbs.get(img.key) || img.url;
      if (src) {
        const pic = el("img");
        pic.src = src;
        pic.alt = img.name;
        fig.appendChild(pic);
      }
    }
    const rm = el("button", "attach-remove", "×");
    rm.type = "button";
    rm.setAttribute("aria-label", `Remove ${img.name}`);
    rm.addEventListener("click", () => removeImage(itemId, img.key));
    fig.appendChild(rm);
    if (img.status === "uploading") {
      const over = el("div", "attach-overlay");
      over.appendChild(el("span", "spinner tiny"));
      fig.appendChild(over);
    } else if (img.status === "failed") {
      const over = el("div", "attach-overlay failed");
      over.appendChild(el("span", null, "Upload failed"));
      const retry = el("button", "btn tiny", "Retry");
      retry.type = "button";
      retry.addEventListener("click", () => retryImage(itemId, img.key));
      const drop = el("button", "btn tiny", "Remove");
      drop.type = "button";
      drop.addEventListener("click", () => removeImage(itemId, img.key));
      over.appendChild(retry);
      over.appendChild(drop);
      fig.appendChild(over);
    }
    tray.appendChild(fig);
  }
  return tray;
}

/* --------------------------------------------------------- attachments */

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

// Three ways in, because browsers disagree: EXIF-aware bitmap decode, plain
// bitmap decode, then an <img> fed a data: URL. Not an object URL: the CSP
// allows `data:` images and refuses `blob:` ones.
async function decodeImage(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {}
  try {
    return await createImageBitmap(file);
  } catch {}
  try {
    const url = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } catch {
    throw new Error("That file could not be read as an image.");
  }
}

function drawScaled(source, edge) {
  const w0 = source.naturalWidth || source.width;
  const h0 = source.naturalHeight || source.height;
  const { w, h } = fitWithin(w0, h0, edge);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  // JPEG has no alpha: a transparent PNG would otherwise turn black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

// The upload (a JPEG no longer than IMAGE_LONG_EDGE) and the tray's thumbnail
// (a small data: URL), from one decode.
async function reencode(file) {
  const source = await decodeImage(file);
  try {
    const blob = await new Promise((resolve, reject) =>
      drawScaled(source, IMAGE_LONG_EDGE).toBlob(
        (b) => (b ? resolve(b) : reject(new Error("That image could not be converted."))),
        "image/jpeg",
        IMAGE_QUALITY
      )
    );
    if (blob.size > MAX_UPLOAD_BYTES) throw new Error("That image is too large even after shrinking it.");
    const thumb = drawScaled(source, THUMB_EDGE).toDataURL("image/jpeg", 0.7);
    return { blob, thumb };
  } finally {
    if (typeof source.close === "function") source.close();
  }
}

// Thumbnails and retry blobs, keyed by an attachment's local `key`. Kept out
// of `local`: both are large, and neither survives a reload anyway.
const thumbs = new Map();
const retryBlobs = new Map();

// A note's pictures, or the chat composer's (CHAT_IMAGES), which live apart.
const noteImages = (itemId) =>
  itemId === CHAT_IMAGES ? local.chat.images : (local.images && local.images[itemId]) || [];
const findImage = (itemId, key) => noteImages(itemId).find((img) => img.key === key) || null;
function setNoteImages(itemId, list) {
  if (itemId === CHAT_IMAGES) local.chat.images = list;
  else if (list.length) local.images[itemId] = list;
  else delete local.images[itemId];
}

// Where an attachment is deleted from. Documents have no `url`, so their
// route is built from the path, as uploadUrl does.
const deleteUrl = (entry) => entry.url || "/uploads/" + String(entry.path || "").split(/[\\/]/).pop();

// The files in a paste worth attaching: images and allowed documents. A paste
// with none of them is left to paste as text.
function incomingFiles(list) {
  return Array.from(list || []).filter((f) => (f.type && f.type.startsWith("image/")) || docExt(f.name));
}

const notAllowedText = (name) => `"${name}" can't be attached: only images, text, code and PDF files.`;
const tooLargeText = (name) => `"${name}" is over ${formatBytes(MAX_DOC_BYTES)}.`;

async function uploadBlob(itemId, key, blob) {
  const img = findImage(itemId, key);
  if (!img) return;
  const isFile = attachmentKind(img) === "file";
  img.status = "uploading";
  save();
  render();
  let body = null;
  let status = 0;
  try {
    const res = await fetch("/upload", {
      method: "POST",
      headers: {
        "content-type": isFile ? "application/octet-stream" : "image/jpeg",
        "x-p2c-name": encodeURIComponent(img.name),
      },
      body: blob,
    });
    status = res.status;
    if (res.ok) body = await res.json();
  } catch {}
  const now = findImage(itemId, key);
  if (!now) {
    // Removed while it was on its way: the file it just made belongs to nobody.
    if (body && body.ok && body.id) fetch(deleteUrl(body), { method: "DELETE" }).catch(() => {});
    return;
  }
  if (body && body.ok) {
    Object.assign(now, { id: body.id, path: body.path, name: body.name, size: body.size, kind: body.kind, status: "ready" });
    if (body.url) now.url = body.url;
    retryBlobs.delete(key);
  } else if (isFile && (status === 415 || status === 413)) {
    // The server read the file and said no: Retry would only fail again.
    setNoteImages(itemId, noteImages(itemId).filter((x) => x.key !== key));
    retryBlobs.delete(key);
    banner(status === 413 ? tooLargeText(now.name) : notAllowedText(now.name), "warn");
  } else {
    now.status = "failed";
    retryBlobs.set(key, blob);
  }
  save();
  render();
}

async function attachFiles(itemId, files) {
  const given = Array.from(files || []);
  const { images, docs, refused } = sortAttachments(given);
  const chat = itemId === CHAT_IMAGES;
  const room = Math.max(0, (chat ? CHAT_MAX_ATTACHMENTS : MAX_ATTACHMENTS) - noteImages(itemId).length);
  const wanted = given.filter((f) => images.includes(f) || docs.includes(f));
  const taken = wanted.slice(0, room);
  // One banner at a time, so every refusal goes into it, each by name.
  const said = refused.map((r) => (r.reason === "too-large" ? tooLargeText(r.name) : notAllowedText(r.name)));
  if (taken.length < wanted.length)
    said.push(
      chat ? `Up to ${CHAT_MAX_ATTACHMENTS} attachments per question.` : `Up to ${MAX_ATTACHMENTS} attachments per note.`
    );
  if (said.length) banner(said.join(" "), refused.length ? "warn" : "info");
  await Promise.all(
    taken.map(async (file) => {
      const key = crypto.randomUUID();
      if (docs.includes(file)) {
        setNoteImages(itemId, [
          ...noteImages(itemId),
          { key, kind: "file", name: file.name, size: file.size, status: "uploading" },
        ]);
        save();
        render();
        await uploadBlob(itemId, key, file);
        return;
      }
      setNoteImages(itemId, [
        ...noteImages(itemId),
        { key, kind: "image", name: file.name || "pasted-image.png", status: "uploading" },
      ]);
      save();
      render();
      let encoded;
      try {
        encoded = await reencode(file);
      } catch (err) {
        setNoteImages(itemId, noteImages(itemId).filter((img) => img.key !== key));
        save();
        render();
        banner(err.message, "warn");
        return;
      }
      thumbs.set(key, encoded.thumb);
      await uploadBlob(itemId, key, encoded.blob);
    })
  );
}

async function removeImage(itemId, key) {
  const img = findImage(itemId, key);
  setNoteImages(itemId, noteImages(itemId).filter((x) => x.key !== key));
  thumbs.delete(key);
  retryBlobs.delete(key);
  save();
  render();
  // Errors are ignored: the 30-day sweep is the backstop.
  if (img && img.id) fetch(deleteUrl(img), { method: "DELETE" }).catch(() => {});
}

async function retryImage(itemId, key) {
  const blob = retryBlobs.get(key);
  if (blob) return uploadBlob(itemId, key, blob);
  await removeImage(itemId, key);
  banner("Attach it again.", "info");
}

/* -------------------------------------------------------------- footer */

// Every note with something in it — text, attachments, or both — as
// { id, text, images, held }. `held` is a note with an image still uploading
// or failed: it stays drafted, and only it waits.
function draftedNotes() {
  const ids = new Set();
  for (const [key, text] of Object.entries(local.drafts)) {
    if (key.startsWith("thread-") && text && text.trim()) ids.add(key.slice(7));
  }
  for (const [id, list] of Object.entries(local.images || {})) if (list.length) ids.add(id);
  return [...ids].map((id) => {
    const imgs = noteImages(id);
    return {
      id,
      text: (local.drafts["thread-" + id] || "").trim(),
      images: imgs.filter((img) => img.status === "ready"),
      held: imgs.some((img) => img.status === "uploading" || img.status === "failed"),
    };
  });
}

function pendingNotes() {
  return draftedNotes()
    .filter((n) => !n.held && (n.text || n.images.length))
    .map(({ id, text, images }) => ({ id, text, images }));
}

function heldNotes() {
  return draftedNotes().filter((n) => n.held);
}

function sendState() {
  // Before `gone`, and before the grace period that can re-enable a send. A
  // finished session has nobody left to send to, whatever the socket says.
  if (finish()) return { disabled: true, why: "This session is finished.", short: "Session finished" };
  if (gone) return { disabled: true, why: "Not connected right now.", short: "Not connected" };
  // A send is still being collected. Blocking here is what keeps someone from
  // writing over answers nobody has read yet.
  if (pendingResult) {
    // The server refuses a second submit while one is uncollected, so this
    // stays disabled either way. Only the reason changes, and "one moment" is
    // a promise the page cannot keep once nothing is coming to collect them.
    return stranded()
      ? { disabled: true, why: "Saved, and waiting for Plan2Code to come back for them.", short: "Saved, not picked up" }
      : { disabled: true, why: "Your last answers are on their way. One moment.", short: "" };
  }
  if (agentWorking()) {
    // A question the agent left open while still working is still a question,
    // and its answer has nowhere better to wait than the server, which holds
    // a send until the agent next looks. The contract says to switch to
    // "waiting" before asking, but an agent that asks and carries on ("while
    // you decide") must not lock the person out of answering for up to an
    // hour of quietMinutes.
    if (myTurn().length && (stagedCount() || pendingNotes().length)) {
      return {
        disabled: false,
        why: "Plan2Code is still working. Your answers wait for it to look.",
        short: "Still working · it reads this next",
      };
    }
    const ms = workingMs();
    if (ms > patience(WORKING_GRACE_MS)) {
      // A stuck agent must not lock someone out of their own session, so the
      // hatch stays open -- but only once there is something to push through
      // it. Enabled with an empty payload, Send clicks as a no-op, and the
      // loud styling on a dead button reads as broken rather than available.
      // "A while", not the clock: the footer only redraws on events, so a
      // duration printed here freezes between them, and a frozen number
      // beside "is it stuck?" makes the page look like the thing it is
      // warning about. The exact time already ticks away in the dock.
      if (stagedCount() || pendingNotes().length) {
        return { disabled: false, why: "Plan2Code has been busy a while. You can send anyway.", short: "Busy · send anyway" };
      }
      return openItems().length
        ? {
            disabled: true,
            why: "Plan2Code has been busy a while. Answer something or add a note, and you can send anyway.",
            short: "Busy · a note unlocks Send",
          }
        : { disabled: true, why: "Plan2Code has been busy a while.", short: "Busy a while" };
    }
    return { disabled: true, why: "Wait for Plan2Code to finish.", short: agentAdrift() ? "Gone quiet" : "" };
  }
  if (!stagedCount() && !pendingNotes().length) return { disabled: true, why: "" };
  return { disabled: false, why: "" };
}

function renderFooter() {
  // The dashboard has no Send: a card click is the answer and it goes on its
  // own. An empty "Nothing to send yet" bar under a menu is noise, so only the
  // workspace label stays.
  const foot = document.querySelector(".footer");
  if (foot) foot.classList.toggle("is-dash", Boolean(isDashboard() && !finish()));

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
    summary.appendChild(el("strong", null, "All done."));
    summary.appendChild(
      document.createTextNode(
        n || notes.length
          ? " Anything still waiting here was never sent."
          : " Run the command above to pick this up."
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
    for (const [id, v] of Object.entries(local.staged)) {
      const item = byId(id);
      if (!item) continue;
      bits.push(item.title + (v.k ? ` → ${v.k}` : v.verdict ? ` → ${v.verdict}` : ""));
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
  // Something is turning while the turn is not theirs. A line of grey text
  // saying "one moment" reads the same whether the agent is working on it or
  // has quietly died; a spinner is the difference between the two at a glance.
  // A spinner says "something is happening". Nothing is, once the other end
  // has stopped answering, and a permanent one is how a dead session passes
  // for a slow one.
  if (!gone && !agentAdrift() && (pendingResult || agentWorking())) {
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

// The workspace's folders, original first, or none before a frame has them.
const workspaceFolders = () => (wsFrame && Array.isArray(wsFrame.folders) ? wsFrame.folders : []);

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
  const path = (S && S.worktree) || "";
  return path ? path.split(/[\\/]/).filter(Boolean).pop() || path : "";
}

// The browser tab's title, led by the project so tabs from different
// projects are told apart. Called from the chrome and the footer, since the
// workspace frame can arrive after either.
function renderTabTitle() {
  if (!S) return;
  const name = projectName();
  document.title =
    (name ? name + " · " : "") + (S.title || "Session") + " · #" + String(S.sid || "").slice(-6) + " · Plan2Code";
}

function renderWhere() {
  const b = $("footer-where");
  const folders = workspaceFolders();
  const path = S.worktree || "";
  renderTabTitle();
  const alert = Boolean(folders.length && ((wsFrame.missing || []).length || (wsFrame.issues || []).length));
  const labels = folders.length
    ? Array.from({ length: FOOTER_TIERS }, (_, tier) => footerLabel({ folders, branch: S.branch }, tier))
    : [path ? (path.split(/[\\/]/).filter(Boolean).pop() || path) + (S.branch ? " · " + S.branch : "") : ""];
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

let whereResizeTimer = null;
addEventListener("resize", () => {
  clearTimeout(whereResizeTimer);
  whereResizeTimer = setTimeout(() => {
    if (!S) return;
    delete $("footer-where").dataset.key;
    renderWhere();
  }, 100);
});

/* ------------------------------------------------------------ workspace */

// The Workspace dialog. The server is the only writer of workspace.json: the
// page asks through /workspace/*, and the new list comes back on the next
// frame, which redraws the dialog while it is open.

// POST a JSON body; the status and parsed answer, or status 0 when the
// server could not be reached.
async function postJson(url, body) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    let answer = {};
    try {
      answer = await res.json();
    } catch {}
    return { status: res.status, body: answer };
  } catch {
    return { status: 0, body: {} };
  }
}

/* The workspace follows the dashboard's picker: the folders remembered for
   the selected spec, or the project's own under "Start from scratch". The
   server swaps the list and remembers every change after it. */
let scopeAsked = null;
// True from a launch's scope sync until its send has gone (or failed).
let launchScoping = false;
async function syncWorkspaceScope(spec) {
  if (!S || S.workflow !== "dashboard" || gone || !wsFrame) return;
  const want = spec === undefined ? (selSpec() && selSpec().dir) || "" : spec;
  if ((wsFrame.scope || "") === want || scopeAsked === want) return;
  scopeAsked = want;
  const { status, body } = await postJson("/workspace/scope", { spec: want });
  if (status === 200 && body && Array.isArray(body.folders)) wsFrame = { ...wsFrame, ...body };
  scopeAsked = null;
  if ($("workspace-modal").open) renderWorkspace();
}

// The dialog's "Remembered for" line: whose list this is.
function workspaceScopeText() {
  const scope = (wsFrame && wsFrame.scope) || "";
  if (!scope) return "Remembered for this project, so your next console session here starts with these folders.";
  const spec = specList().find((s) => s.dir === scope);
  const name = spec ? spec.name : scope.split("/").pop();
  return `Remembered for the ${name} spec, and loaded again whenever it is picked.`;
}

const NAME_RULE = "Names use lowercase letters, numbers and hyphens.";
const BROWSE_UNAVAILABLE = "Browse isn't available here — type or paste the path.";
// The folder whose Remove is waiting on its inline confirm, by id.
let wsConfirm = null;
let wsBusy = false;

async function openWorkspace() {
  const dlg = $("workspace-modal");
  try {
    const res = await fetch("/workspace?check=1", { cache: "no-store" });
    if (res.ok) wsFrame = await res.json();
  } catch {}
  wsConfirm = null;
  setAddMsg("");
  renderWorkspace();
  if (!dlg.open) dlg.showModal();
  $("workspace-path").focus();
}

function setAddMsg(text, kind, action) {
  const p = $("workspace-add-msg");
  p.className = "workspace-add-msg" + (kind ? " is-" + kind : "");
  p.textContent = text;
  if (action) p.appendChild(action);
}

// One <li> per folder, original first. A frame that keeps the same folders in
// the same order is painted into the rows already there, so a box someone is
// typing in keeps its text, caret and focus; any other change rebuilds.
function renderWorkspace() {
  const list = $("workspace-list");
  const folders = workspaceFolders();
  const ids = folders.map((f) => f.id).join("\n");
  if (list.dataset.ids !== ids) {
    list.dataset.ids = ids;
    list.replaceChildren(...folders.map(workspaceRow));
  }
  folders.forEach((f, i) => paintWorkspaceRow(list.children[i], f));
  $("workspace-browse").hidden = Boolean(wsFrame && wsFrame.remote);
  $("workspace-scope").textContent = workspaceScopeText();
}

function workspaceRow(f) {
  const li = el("li", "ws-entry");
  li.dataset.fid = f.id;

  const head = el("div", "ws-head");
  head.appendChild(el("span", "ws-chip"));
  if (f.original) head.appendChild(el("span", "ws-original", "started here — can't be removed"));
  li.appendChild(head);

  const pathRow = el("div", "ws-path-row");
  const code = el("code", "ws-path");
  pathRow.appendChild(code);
  const copy = el("button", "btn small", "Copy path");
  copy.type = "button";
  copy.addEventListener("click", async () => {
    const folder = workspaceFolders().find((x) => x.id === f.id);
    if (!folder) return;
    try {
      await navigator.clipboard.writeText(folder.path);
      copy.textContent = "Copied";
      setTimeout(() => (copy.textContent = "Copy path"), 1500);
    } catch {
      // Refused: the path is selected instead, ready for Ctrl+C.
      selectContents(code);
      copy.textContent = "Press Ctrl+C";
    }
  });
  pathRow.appendChild(copy);
  if (!f.original) {
    const remove = el("button", "btn small danger ws-remove", "Remove");
    remove.type = "button";
    remove.addEventListener("click", () => {
      wsConfirm = f.id;
      renderWorkspace();
      li.querySelector(".ws-confirm .btn.danger")?.focus();
    });
    pathRow.appendChild(remove);
  }
  li.appendChild(pathRow);

  li.appendChild(el("div", "ws-marks"));
  li.appendChild(workspaceField(f, "name", "Name"));
  li.appendChild(workspaceField(f, "description", "What is it?"));
  return li;
}

// The Name and What-is-it boxes. Each saves on blur or Enter through
// /workspace/edit, and only when it holds something new.
function workspaceField(f, field, labelText) {
  const wrap = el("div", "ws-field");
  const id = `ws-${field}-${f.id}`;
  const label = el("label", null, labelText);
  label.htmlFor = id;
  const input = el("input");
  input.type = "text";
  input.id = id;
  input.dataset.field = field;
  input.autocomplete = "off";
  input.spellcheck = false;
  if (field === "description") input.maxLength = 200;
  const err = el("p", "field-error");
  err.hidden = true;
  const current = () => workspaceFolders().find((x) => x.id === f.id);
  const saved = () => (current() ? current()[field] || "" : "");
  const showError = (text) => {
    err.textContent = text || "";
    err.hidden = !text;
    input.classList.toggle("invalid", Boolean(text));
  };

  if (field === "name") {
    input.addEventListener("input", () => showError(nameProblem(input.value.trim()) ? NAME_RULE : ""));
  }
  const save = async (leaving) => {
    const value = input.value.trim();
    if (value === saved()) return showError("");
    if (field === "name" && nameProblem(value)) {
      if (!leaving) return showError(NAME_RULE);
      input.value = saved();
      return showError("");
    }
    const { status, body } = await postJson("/workspace/edit", { id: f.id, [field]: value });
    if (status === 200) return showError("");
    if (body.reason === "name-taken") showError(`@${value} is taken — try @${body.suggest}.`);
    else if (body.reason === "bad-name") showError(NAME_RULE);
    else showError("That did not save. Try again.");
    if (leaving) input.value = saved();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    save(false);
  });
  input.addEventListener("blur", () => save(true));
  wrap.append(label, input, err);
  return wrap;
}

// Everything in a row that follows the frame. A box with focus is left as
// the person has it; every other box shows what is saved.
function paintWorkspaceRow(li, f) {
  if (!li) return;
  const missing = (wsFrame.missing || []).includes(f.id);
  const issue = (wsFrame.issues || []).find((x) => x.name === f.name);
  li.classList.toggle("is-missing", missing);
  li.querySelector(".ws-chip").textContent = "@" + f.name;
  li.querySelector(".ws-path").textContent = f.path;
  for (const input of li.querySelectorAll("input[data-field]")) {
    if (document.activeElement !== input) input.value = f[input.dataset.field] || "";
  }

  const marks = li.querySelector(".ws-marks");
  marks.replaceChildren();
  if (missing) marks.appendChild(el("p", "ws-mark is-missing", "This folder no longer exists"));
  if (issue) {
    marks.appendChild(el("p", "ws-mark is-issue", "The agent can't read this yet: " + issue.reason));
    if (issue.hint) {
      const row = el("div", "ws-hint-row");
      const code = el("code", "ws-hint", issue.hint);
      row.append(code, copyButton(issue.hint, "btn tiny", code));
      marks.appendChild(row);
    }
  }
  if (f.nested) marks.appendChild(el("p", "ws-mark is-nested", "Inside another folder in the list"));
  marks.hidden = !marks.children.length;

  // Built once per confirm, so a frame landing meanwhile keeps its focus.
  const open = li.querySelector(".ws-confirm");
  if (wsConfirm !== f.id) open?.remove();
  else if (open) open.querySelector("span").textContent = `Remove @${f.name}? The agent is told.`;
  else {
    const box = el("div", "ws-confirm");
    box.setAttribute("role", "alert");
    box.appendChild(el("span", null, `Remove @${f.name}? The agent is told.`));
    const keep = el("button", "btn small ghost", "Keep it");
    keep.type = "button";
    keep.addEventListener("click", () => {
      wsConfirm = null;
      renderWorkspace();
      li.querySelector(".ws-remove")?.focus();
    });
    const go = el("button", "btn small danger", "Remove");
    go.type = "button";
    go.addEventListener("click", async () => {
      go.disabled = true;
      const { status } = await postJson("/workspace/remove", { id: f.id });
      wsConfirm = null;
      if (status !== 200) setAddMsg(`@${f.name} could not be removed. Try again.`, "error");
      renderWorkspace();
      $("workspace-path").focus();
    });
    box.append(keep, go);
    li.appendChild(box);
  }
}

// Add by typed path, or by a path Browse… came back with. `name` is only
// sent when the person took a suggested name after a clash.
async function addWorkspaceFolder(path, name) {
  const trimmed = String(path || "").trim();
  if (!trimmed || wsBusy) return;
  wsBusy = true;
  $("workspace-add").disabled = true;
  const { status, body } = await postJson("/workspace/add", name ? { path: trimmed, name } : { path: trimmed });
  wsBusy = false;
  $("workspace-add").disabled = false;
  if (status === 200) {
    $("workspace-path").value = "";
    setAddMsg(`Added as @${body.name}.` + (body.nested ? " It's inside another folder in the list." : ""), "good");
    if (body.name && wsFrame && !workspaceFolders().some((f) => f.id === body.id)) {
      wsFrame = { ...wsFrame, folders: [...workspaceFolders(), body] };
    }
    renderWorkspace();
    renderWhere();
    return;
  }
  switch (body.reason) {
    case "not-a-folder":
      return setAddMsg("That isn't a folder on this machine.", "error");
    case "duplicate":
      return setAddMsg(`Already in the workspace as @${body.name}.`, "error");
    case "name-taken": {
      const taken = name || String(body.suggest || "").replace(/-\d+$/, "");
      const use = el("button", "btn tiny", `Use @${body.suggest}`);
      use.type = "button";
      use.addEventListener("click", () => addWorkspaceFolder(trimmed, body.suggest));
      return setAddMsg(`@${taken} is taken — try @${body.suggest}.`, "error", use);
    }
    case "bad-name":
      return setAddMsg(NAME_RULE, "error");
    default:
      return setAddMsg("That folder could not be added. Try again.", "error");
  }
}

async function browseWorkspace() {
  const b = $("workspace-browse");
  if (b.disabled) return;
  b.disabled = true;
  setAddMsg("Waiting for the folder picker…");
  const { status, body } = await postJson("/workspace/browse", {});
  b.disabled = false;
  if (status === 200 && body.path) {
    setAddMsg("");
    return addWorkspaceFolder(body.path);
  }
  if (status === 200 && body.cancelled) return setAddMsg("");
  setAddMsg(BROWSE_UNAVAILABLE, "error");
}

$("workspace-add").addEventListener("click", () => addWorkspaceFolder($("workspace-path").value));
$("workspace-path").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  e.preventDefault();
  addWorkspaceFolder(e.currentTarget.value);
});
$("workspace-browse").addEventListener("click", browseWorkspace);
$("workspace-done").addEventListener("click", () => $("workspace-modal").close());
$("workspace-help").addEventListener("click", openHelp);
$("workspace-modal").addEventListener("close", () => {
  wsConfirm = null;
  $("footer-where").focus();
});
// As on Help: the page-wide Ctrl/Cmd+Enter stands down while a dialog is open,
// and this keeps the key inside the Workspace dialog as well.
$("workspace-modal").addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
  }
});

/* ------------------------------------------------------------- mentions */

// `@name` suggestions in the boxes people type in. One popover for the page,
// owned by whichever box last asked for it; the rules (where a mention starts,
// what matches, how a pick is spliced in) are mentions.js's. Attach before
// the box's own keydown listeners, so a key the list uses stops here.
let mentionPop = null;

function closeMentions() {
  if (!mentionPop) return;
  const { box, node } = mentionPop;
  node.remove();
  removeEventListener("scroll", placeMentions, true);
  box.setAttribute("aria-expanded", "false");
  box.removeAttribute("aria-activedescendant");
  mentionPop = null;
}

// Under the box, as wide as it, fixed to the viewport so no card's overflow
// can clip it; above it when the window has no room below (the Ask box sits
// at the bottom). A box that has been redrawn away takes the list with it.
function placeMentions() {
  if (!mentionPop) return;
  if (!mentionPop.box.isConnected) return closeMentions();
  const r = mentionPop.box.getBoundingClientRect();
  const node = mentionPop.node;
  node.style.left = Math.round(r.left) + "px";
  node.style.width = Math.round(r.width) + "px";
  const h = node.offsetHeight;
  const top = r.bottom + 4 + h <= innerHeight ? r.bottom + 4 : Math.max(4, r.top - 4 - h);
  node.style.top = Math.round(top) + "px";
}

function paintMentions() {
  const { node, box, matches, query } = mentionPop;
  node.replaceChildren();
  if (!matches.length) {
    node.appendChild(el("div", "mention-empty", `No folder called @${query} in the workspace`));
    box.removeAttribute("aria-activedescendant");
    return;
  }
  matches.forEach((name, i) => {
    const opt = el("div", "mention-opt" + (i === mentionPop.at ? " is-active" : ""), "@" + name);
    opt.id = "mention-opt-" + i;
    opt.setAttribute("role", "option");
    opt.setAttribute("aria-selected", String(i === mentionPop.at));
    // Held on mousedown, so the box keeps focus and the click can land.
    opt.addEventListener("mousedown", (e) => e.preventDefault());
    opt.addEventListener("click", () => pickMention(name));
    node.appendChild(opt);
  });
  box.setAttribute("aria-activedescendant", "mention-opt-" + mentionPop.at);
}

function pickMention(name) {
  if (!mentionPop) return;
  const { box, mention } = mentionPop;
  const next = applyMention(box.value, box.selectionStart, mention, name);
  closeMentions();
  box.value = next.text;
  box.setSelectionRange(next.caret, next.caret);
  // Whatever the box does with typing (drafts, staging, the counter) runs.
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

function attachMentions(box) {
  box.setAttribute("aria-autocomplete", "list");
  box.setAttribute("aria-expanded", "false");
  box.setAttribute("aria-controls", "mention-pop");
  const update = () => {
    const mention =
      box.selectionStart === box.selectionEnd ? mentionAt(box.value, box.selectionStart) : null;
    const names = workspaceFolders().map((f) => f.name);
    const matches = mention ? matchNames(names, mention.query) : [];
    // Nothing to offer with only the original folder and no match; a bigger
    // workspace says plainly that the name is not in it.
    if (!mention || (!matches.length && names.length < 2)) {
      if (mentionPop && mentionPop.box === box) closeMentions();
      return;
    }
    if (!mentionPop || mentionPop.box !== box) {
      closeMentions();
      const node = el("div", "mention-pop");
      node.id = "mention-pop";
      node.setAttribute("role", "listbox");
      node.setAttribute("aria-label", "Workspace folders");
      document.body.appendChild(node);
      mentionPop = { box, node, at: 0, matches: [], mention: null, query: "" };
      addEventListener("scroll", placeMentions, true);
      box.setAttribute("aria-expanded", "true");
    }
    const same = mentionPop.matches.join("\n") === matches.join("\n");
    Object.assign(mentionPop, { matches, mention, query: mention.query, at: same ? mentionPop.at : 0 });
    paintMentions();
    placeMentions();
  };
  box.addEventListener("input", update);
  box.addEventListener("keyup", (e) => {
    if (!["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(e.key)) update();
  });
  box.addEventListener("keydown", (e) => {
    if (!mentionPop || mentionPop.box !== box || e.isComposing) return;
    const { matches } = mentionPop;
    const stop = () => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    if (e.key === "Escape") {
      stop();
      return closeMentions();
    }
    if (!matches.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      stop();
      mentionPop.at = (mentionPop.at + (e.key === "ArrowDown" ? 1 : matches.length - 1)) % matches.length;
      return paintMentions();
    }
    if ((e.key === "Enter" || e.key === "Tab") && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      stop();
      pickMention(matches[mentionPop.at]);
    }
  });
  box.addEventListener("blur", () => {
    if (mentionPop && mentionPop.box === box) closeMentions();
  });
}

/* ------------------------------------------------------------ stopping */

// Ending a session from the page. The page cannot stop Plan2Code; it asks.
// The request rides the ordinary submit with whatever is staged, so the last
// answers go with it instead of being stranded, and the agent handles it the
// way it handles a brief: save its place, post a finish with the command to
// resume, stop the server. The finish is what ends the wait on this side --
// the hand-off card then takes over.

let stoppingHidden = false;

// A stop is under way if this browser sent one, or if the server is holding
// one nobody has collected: the second covers a reload on a resumed session,
// a second tab, another machine.
function stopInProgress() {
  return local.stopping || (pendingStop ? { at: 0, answers: 0 } : null);
}

function renderStopButton() {
  const b = $("btn-stop");
  if (!S || finish()) {
    b.hidden = true;
    return;
  }
  b.hidden = false;
  if (stopInProgress()) {
    b.textContent = "Stopping…";
    b.disabled = false;
    b.title = "Show how the stop is going";
    return;
  }
  b.textContent = "Stop session";
  // Only on the person's turn, unless nothing is coming (see turnGate).
  const gate = turnGate({ gone, pendingResult, waiting: agentHasTheBall() });
  // A way home in flight holds Stop back too, unless the agent went quiet
  // after collecting it: Stop's resume screen is then the only way out.
  b.disabled = Boolean(gate) || (Boolean(local.homeward) && !agentAdrift());
  b.title = {
    gone: "Not connected right now.",
    pending: "Your last answers are still being picked up. You can stop once they have been.",
    waiting: "Plan2Code is working on your answers. You can stop once it replies.",
  }[gate] || "Save your place and end this session. You get a command to pick it up later.";
}

// Plan2Code has the ball: it is working, or owes a reply to a send, and has
// not gone quiet. What both session buttons wait out.
function agentHasTheBall() {
  return (agentWorking() || awaitingReply().length > 0) && !agentAdrift();
}

/* ------------------------------------------------ back to the dashboard */

// The triangle left of Stop session. Mid-workflow it is a stop that lands on
// the menu instead of a finish: the same staged answers ride along, the agent
// saves its place the same way, then resumes the session as the dashboard.
function renderHomeButton() {
  const b = $("btn-home");
  const st = homeButtonState({
    workflow: S && S.workflow,
    finished: Boolean(S && finish()),
    stopping: Boolean(S && stopInProgress()),
    homeward: Boolean(local.homeward),
    adrift: Boolean(S) && agentAdrift(),
    gone,
    pendingResult,
    waiting: Boolean(S) && agentHasTheBall(),
  });
  b.hidden = st.hidden;
  b.disabled = st.disabled;
  b.title = st.title;
}

function openHomeConfirm() {
  const n = Object.keys(local.staged).length + pendingNotes().length;
  $("home-blurb").textContent =
    (n === 1 ? "The answer you have ready goes with it. " : n ? `The ${n} answers you have ready go with it. ` : "") +
    "Your place is saved; you can resume it from the dashboard.";
  const warn = stopWarning();
  $("home-warn").hidden = !warn;
  $("home-warn").textContent = warn;
  $("home-modal").showModal();
}

async function goHome() {
  const go = $("home-go");
  go.disabled = true;
  const payload = stagedPayload();
  payload.actions.push({ i: "__dashboard", type: "dashboard" });
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: payload.actions, reply: [...payload.replyLines, HOME_REPLY].join("\n") }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    markSent(payload);
    local.homeward = { at: Date.now() };
    save();
    $("home-modal").close();
  } catch (err) {
    $("home-modal").close();
    // The server is holding an uncollected result: Send, Home and Stop all
    // need to read as busy until the frame or the ping says otherwise, same
    // as send() and sendAfterBuild() do on a 409.
    if (err && err.pending) pendingResult = true;
    banner(
      err && err.pending
        ? "Your last answers are still being picked up, so that could not go yet. Try again in a moment."
        : "That did not go through. Nothing was lost; try again.",
      "warn"
    );
  } finally {
    go.disabled = false;
    render();
  }
}

// Stopping now can lose answers: Planning writes nothing until its plan is
// done, and Pathfinder nothing until its map exists. The agent knows where it
// is and says so in `stopWarning`; Planning is assumed to lose answers unless
// the agent says otherwise, because that is true of most of it.
function stopWarning() {
  if (typeof S.stopWarning === "string") return S.stopWarning.trim();
  if (S.workflow === "plan") {
    return "Planning only saves at set points along the way. Answers since the last save will not be kept, though you can go over them again next time.";
  }
  return "";
}

function openStopConfirm() {
  if (stopInProgress()) {
    stoppingHidden = false;
    return renderStopping();
  }
  const n = Object.keys(local.staged).length + pendingNotes().length;
  $("stop-blurb").textContent =
    (n === 1 ? "The answer you have ready goes with it. " : n ? `The ${n} answers you have ready go with it. ` : "") +
    "Plan2Code will save your place and give you a command to pick this up later, in a new conversation.";
  const warn = stopWarning();
  $("stop-warn").hidden = !warn;
  $("stop-warn").textContent = warn;
  $("stop-go").textContent = warn ? "Stop anyway" : "Stop and save";
  $("stop-modal").showModal();
}

async function stopSession() {
  const go = $("stop-go");
  go.disabled = true;
  const payload = stagedPayload();
  payload.actions.push({ i: "__stop", type: "stop" });
  try {
    const res = await fetch("/submit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actions: payload.actions, reply: [...payload.replyLines, STOP_REPLY].join("\n") }),
    });
    if (res.status === 409) throw Object.assign(new Error("pending"), { pending: true });
    if (!res.ok) throw new Error(String(res.status));
    markSent(payload);
    local.stopping = { at: Date.now(), answers: payload.sentIds.size };
    save();
    $("stop-modal").close();
    stoppingHidden = false;
  } catch (err) {
    $("stop-modal").close();
    if (err && err.pending) pendingResult = true;
    banner(
      err && err.pending
        ? "Your last answers are still being picked up, so the stop could not go yet. Try again in a moment."
        : "The stop did not go through. Nothing was lost; try again.",
      "warn"
    );
  } finally {
    go.disabled = false;
    render();
  }
}

// The wrapping-up screen, derived every render from what the page already
// tracks: whether the request is collected, whether anyone is listening, and
// whether the finish has landed.
function renderStopping() {
  const dlg = $("stopping-modal");
  const stopping = S && stopInProgress();
  if (!stopping) {
    if (dlg.open) dlg.close();
    return;
  }
  // The finish is the end of it: the hand-off card on the page says the rest.
  if (finish()) {
    local.stopping = null;
    save();
    if (dlg.open) dlg.close();
    return;
  }

  const sent = stopping.answers;
  const collected = !pendingResult;
  // Nobody is coming: the server stopped with no finish, or the agent has not
  // checked in for minutes. The request and any answers are on disk either
  // way, and the next session collects them.
  const stuck = gone || agentAdrift();
  const steps = [
    { text: sent ? `Sent your ${sent === 1 ? "answer" : sent + " answers"} and the stop` : "Sent the stop", state: "done" },
    {
      text: collected ? "Plan2Code picked it up" : stuck ? "Plan2Code has not picked it up" : "Waiting for Plan2Code to pick it up",
      state: collected ? "done" : stuck ? "stuck" : "now",
    },
    { text: "Saving your place and writing the command to pick it up", state: collected ? (stuck ? "stuck" : "now") : "later" },
  ];
  const list = $("stop-steps");
  list.replaceChildren(
    ...steps.map((s) => {
      const li = el("li", "is-" + s.state);
      li.appendChild(
        s.state === "now"
          ? el("span", "spinner tiny")
          : el("span", "stop-mark", s.state === "done" ? "✓" : s.state === "stuck" ? "!" : "·")
      );
      li.appendChild(el("span", null, s.text));
      return li;
    })
  );

  const extra = $("stop-extra");
  extra.replaceChildren();
  if (stuck) {
    extra.appendChild(
      el(
        "p",
        "stop-note",
        gone
          ? "The session closed without saying how to pick it up. Your answers and the stop are saved, and the next session collects them. To carry on, run this in the terminal, in a new conversation (or alternatively run `/plan2code` to relaunch the dashboard):"
          : "Plan2Code is not running right now, so nothing new has been saved yet. Your answers and the stop are held, and the next session collects them. To carry on, run this in the terminal, in a new conversation (or alternatively run `/plan2code` to relaunch the dashboard):"
      )
    );
    const text = handoffText({ command: resumeCommand(S) });
    const row = el("div", "handoff-command");
    const code = el("code", "handoff-code", text);
    row.appendChild(code);
    row.appendChild(copyButton(text, "btn small handoff-copy", code));
    extra.appendChild(row);
  } else {
    extra.appendChild(
      el(
        "p",
        "stop-note",
        agentWorking() && !collected
          ? "Plan2Code is in the middle of something. It stops as soon as that is done."
          : "This usually takes a moment. You can close the tab if you need to: the command also appears in the terminal."
      )
    );
  }

  if (!stoppingHidden && !dlg.open) dlg.showModal();
}

/* ---------------------------------------------------------------- send */

// Everything staged, in the shape /submit takes. Shared by Send and by Stop
// session, which has to carry the same answers the same way: a stop that
// dropped someone's last answers on the floor would be worse than no button.
function stagedPayload() {
  const actions = [];
  const replyLines = [];
  const sentIds = new Set();
  const summaries = {};
  // Kept so the card can state the answer back in words while it is in flight,
  // the same way a settled one does. `staged` is cleared by the send itself.
  const values = {};

  for (const [id, v] of Object.entries(local.staged)) {
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
    if (tok) replyLines.push(`${item.title}: ${tok}`);
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
function markSent({ sentIds, sentNotes = {}, summaries, values }) {
  // Clear every draft belonging to an item in this batch, not just the
  // thread notes. A surviving draft re-populates the field with text that
  // was already sent, and the next keystroke re-stages it WITHOUT the
  // verdict that went with it, which is how an approval gets lost.
  // A note held back on an image upload stays drafted, attachments and all,
  // even when an answer on the same item went. The sent images' files stay
  // on disk for the agent; the sweep cleans them up.
  for (const id of sentIds) {
    for (const prefix of ["other-", "text-", "note-"]) delete local.drafts[prefix + id];
    if (sentNotes[id]) {
      delete local.drafts["thread-" + id];
      const rest = noteImages(id).filter((img) => !sentNotes[id].has(img.key));
      if (rest.length) local.images[id] = rest;
      else delete local.images[id];
    } else if (!local.images[id]) {
      delete local.drafts["thread-" + id];
    }
    local.sent[id] = { at: Date.now(), summary: summaries[id] || "", value: values[id] || null };
  }
  local.staged = {};
  save();
}

async function send() {
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
    if (!res.ok) throw new Error(String(res.status));
    markSent(payload);
    banner("Sent. Plan2Code is picking it up now.", "good");
    setTimeout(() => banner(null), 4000);
  } catch (err) {
    if (err && err.pending) {
      banner(
        "Your last answers are still being picked up. Nothing is lost, and nothing was sent twice. Try again in a moment.",
        "info"
      );
      pendingResult = true;
    } else {
      banner("That did not go through. Nothing was lost, try Send again.", "warn");
    }
  } finally {
    btn.textContent = "Send to Plan2Code";
    render();
  }
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
  if (Array.isArray(v.rows)) parts.push("new order: " + v.rows.map((r) => r.title).join(", then "));
  if (v.text) parts.push(v.text);
  return parts.join("; ");
}

/* ---------------------------------------------------------------- misc */

function fmtMs(ms) {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

function shortTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function isMac() {
  return /mac/i.test(navigator.platform || navigator.userAgent);
}

// Markdown rather than HTML: it is what the agent wrote, what the file under
// specs/ already holds, and what survives being pasted into Slack or a ticket.
function downloadDoc(doc) {
  const body = (doc.blocks || []).map((b) => b.md || "").join("\n\n");
  saveFile(`${docFileName(doc)}.md`, body, "text/markdown");
}

function docFileName(doc) {
  const name = (doc.title || "document").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return name || "document";
}

function saveFile(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before the handle goes.
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// The page's own markdown styles, restated with the light palette baked in:
// the saved file has no app.css beside it and may be opened years from now,
// on any machine, so it carries everything it needs.
const DOC_HTML_CSS = `
:root { color-scheme: light; }
body { margin: 0; background: #f6f3ee; color: #1d1a17; font: 15.5px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
main { max-width: 880px; margin: 0 auto; padding: 40px 28px 60px; background: #fff; min-height: 100vh; box-sizing: border-box; }
.doc-head { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #e4ddd1; }
.doc-head h1 { font: 600 27px/1.2 "Iowan Old Style", Charter, Georgia, Cambria, serif; margin: 0; }
.doc-version, .doc-meta { font: 700 12px/1 ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace; color: #8f8779; }
.doc-note { color: #5d564d; margin: 0 0 16px; }
.block { border-left: 3px solid transparent; padding: 2px 0 2px 14px; margin: 0 0 4px; }
.block.assumed { border-left: 3px dashed #9a6a12; background: #fbf0d8; border-radius: 0 8px 8px 0; }
.block.draft { border-left-color: #cfc6b6; opacity: 0.72; }
.block.settled { border-left-color: #e4f0e8; }
.block-tag { font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #9a6a12; display: block; margin-bottom: 4px; }
.md-h { font-family: "Iowan Old Style", Charter, Georgia, Cambria, serif; font-weight: 600; margin: 22px 0 9px; line-height: 1.25; }
h1.md-h { font-size: 25px; }
h2.md-h { font-size: 21px; }
h3.md-h { font-size: 17.5px; }
h4.md-h, h5.md-h, h6.md-h { font-size: 15px; }
.md-p { margin: 0 0 11px; }
.md-list { margin: 0 0 11px; padding-left: 22px; }
.md-li { margin-bottom: 5px; }
.md-task { display: inline-block; width: 16px; color: #8f8779; font-weight: 700; }
.md-task.is-done { color: #2f6b45; }
.md-li.is-task { list-style: none; margin-left: -18px; display: grid; grid-template-columns: 16px 1fr; column-gap: 4px; align-items: baseline; }
.md-li.is-task > :not(.md-task) { grid-column: 2; }
.md-li.is-task > .md-p:last-child { margin-bottom: 0; }
.md-quote { margin: 0 0 11px; padding: 2px 0 2px 15px; border-left: 3px solid #cfc6b6; color: #5d564d; }
.md-code { font: 0.88em ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace; background: #fbf9f6; border: 1px solid #e4ddd1; border-radius: 4px; padding: 1px 5px; }
.md-pre-wrap { margin: 0 0 13px; }
.md-pre { font: 13px/1.5 ui-monospace, SFMono-Regular, "Cascadia Mono", Menlo, Consolas, monospace; background: #fbf9f6; border: 1px solid #e4ddd1; border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 0; }
.md-hr { border: 0; border-top: 1px solid #e4ddd1; margin: 20px 0; }
.md-table-wrap { overflow-x: auto; margin: 0 0 13px; }
.md-table { border-collapse: collapse; width: 100%; font-size: 13.5px; }
.md-table th, .md-table td { border: 1px solid #e4ddd1; padding: 8px 11px; text-align: left; }
.md-table th { background: #fbf9f6; font-weight: 600; }
.md-img { max-width: 100%; border-radius: 8px; }
.md a { color: #206cc3; }
@media print {
  body { background: #fff; }
  main { padding: 0; min-height: 0; }
  .block { break-inside: avoid; }
}
`;

// Only this session's uploaded images may ride along in a saved file: any other
// address on this origin (/state, say) would copy session data into something
// meant to be shared. A remote image keeps its own address; anything else on
// this origin becomes its alt text.
const INLINE_UPLOAD = /^\/uploads\/[0-9a-f-]{36}\.jpg$/;

function imageToAlt(img) {
  const alt = img.getAttribute("alt") || "";
  if (alt) img.replaceWith(document.createTextNode(alt));
  else img.remove();
}

async function inlineImage(img) {
  const src = img.getAttribute("src") || "";
  if (!src || src.startsWith("data:")) return;
  let url;
  try {
    url = new URL(src, location.href);
  } catch {
    return imageToAlt(img);
  }
  if (url.origin !== location.origin) {
    img.setAttribute("src", url.href);
    return;
  }
  if (!INLINE_UPLOAD.test(url.pathname) || url.search) return imageToAlt(img);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error(blob.type);
    img.setAttribute(
      "src",
      await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      })
    );
  } catch {
    // Its console address would be a dead link once the server is gone.
    imageToAlt(img);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

// The document as its own web page: drawn through the same markdown path the
// tab uses, so what is saved is what was on screen, minus the page's controls.
async function downloadDocHtml(doc) {
  const title = doc.title || "Document";
  const body = el("div");
  for (const b of doc.blocks || []) {
    const box = el("div", "block " + (b.state || "settled"));
    if (b.state === "assumed") box.appendChild(el("span", "block-tag", "Assumed for now, still open"));
    if (b.state === "draft") box.appendChild(el("span", "block-tag", "Draft"));
    box.appendChild(md(b.md, "md"));
    body.appendChild(box);
  }
  // Copy buttons only work inside the console.
  for (const n of body.querySelectorAll(".md-copy")) n.remove();
  // Images the console serves would be dead links once the server is gone, so
  // they travel inside the file. One that will not load becomes its alt text.
  await Promise.all([...body.querySelectorAll("img")].map(inlineImage));
  const saved = new Date().toLocaleString();
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>${DOC_HTML_CSS}</style>
</head>
<body>
<main>
<header class="doc-head">
<h1>${escapeHtml(title)}</h1>
<span class="doc-version">v${escapeHtml(doc.version || 1)}</span>
<span class="doc-meta">Saved ${escapeHtml(saved)}</span>
</header>
${doc.note ? `<p class="doc-note">${escapeHtml(doc.note)}</p>\n` : ""}${body.innerHTML}
</main>
</body>
</html>
`;
  saveFile(`${docFileName(doc)}.html`, html, "text/html");
}

// A doc that mirrors a file the agent already wrote needs no download button
// -- the path is the useful thing to show instead of it.
function docSavedNote(doc) {
  const path = typeof doc.saved === "string" ? doc.saved.trim() : "";
  const note = el("span", "doc-saved", path ? "Saved as " : "Already saved");
  if (path) note.appendChild(el("code", null, path));
  return note;
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
  } else if (gone) {
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

function selectHelpTab(id) {
  for (const t of HELP_TABS) {
    const on = t.id === id;
    const btn = $("help-tab-" + t.id);
    btn.setAttribute("aria-selected", String(on));
    btn.tabIndex = on ? 0 : -1;
    $("help-panel-" + t.id).hidden = !on;
  }
  $("help-panels").scrollTop = 0;
}

function openHelp() {
  if (!helpBuilt) buildHelp();
  const id = helpTabFor({
    view,
    dashboard: isDashboard(),
    gone,
    adrift: agentAdrift(),
    finished: !!finish(),
    workflow: S && S.workflow,
    workspace: $("workspace-modal").open,
    meterRed: meterFrame?.level === "red",
  });
  selectHelpTab(id);
  renderAbout();
  renderHelpVersion();
  $("help-modal").showModal();
  $("help-tab-" + id).focus();
}

// Help opened straight on one topic, when Help has that topic; otherwise it
// stays wherever openHelp() landed.
function openHelpOn(id) {
  openHelp();
  if (!HELP_TABS.some((t) => t.id === id)) return;
  selectHelpTab(id);
  $("help-tab-" + id).focus();
}

$("btn-home").addEventListener("click", openHomeConfirm);
$("update-done").addEventListener("click", () => $("update-modal").close());
$("home-cancel").addEventListener("click", () => $("home-modal").close());
$("home-go").addEventListener("click", goHome);
$("btn-stop").addEventListener("click", openStopConfirm);
$("stop-cancel").addEventListener("click", () => $("stop-modal").close());
$("stop-go").addEventListener("click", stopSession);
$("stopping-hide").addEventListener("click", () => {
  stoppingHidden = true;
  $("stopping-modal").close();
});
// Esc on a native dialog closes it without our say; count that as hiding, or
// the next render would open it straight back up.
$("stopping-modal").addEventListener("cancel", () => (stoppingHidden = true));

// A click on the backdrop closes a dialog that holds nothing to lose. The
// backdrop is the <dialog> itself to the event, and so is its own padding, so
// the point has to fall outside its box -- for the press as well as the
// release, or selecting text inside and letting go outside would close it.
function lightDismiss(dlg) {
  const outside = (e) => {
    const r = dlg.getBoundingClientRect();
    return e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom);
  };
  let pressedOutside = false;
  dlg.addEventListener("pointerdown", (e) => (pressedOutside = outside(e)));
  dlg.addEventListener("click", (e) => {
    if (pressedOutside && outside(e)) dlg.close();
    pressedOutside = false;
  });
}
lightDismiss($("looks-modal"));
lightDismiss($("subagents-modal"));
lightDismiss($("help-modal"));
lightDismiss($("workspace-modal"));
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

$("btn-looks").addEventListener("click", () => {
  renderSwatches();
  setModelsStatus("", false);
  loadModelsData();
  $("looks-modal").showModal();
});
$("looks-done").addEventListener("click", () => $("looks-modal").close());
$("looks-modal").addEventListener("close", () => {
  resetCleanup();
  if (isDashboard() && !needsRoleNudge(looks) && $("main").querySelector(".dash-nudge")) render();
});
$("looks-reset").addEventListener("click", () => {
  looks = { ...DEFAULT_LOOKS, role: ROLE_NOT_SET, welcomeSeen: looks.welcomeSeen };
  saveLooks();
  render();
});
for (const [value, label] of [[ROLE_NOT_SET, ROLE_NOT_SET_LABEL], ...ROLES.map((r) => [r.id, r.label])]) {
  const option = el("option", null, label);
  option.value = value;
  $("looks-role").appendChild(option);
}
$("looks-role").addEventListener("change", (e) => {
  looks.role = normalizeRole(e.target.value);
  saveLooks();
  if (isDashboard()) render();
});
for (const radio of document.querySelectorAll('input[name="looks-theme"]')) {
  radio.addEventListener("change", () => {
    looks.theme = radio.value;
    saveLooks();
  });
}
for (const radio of document.querySelectorAll('input[name="looks-width"]')) {
  radio.addEventListener("change", () => {
    looks.width = radio.value;
    saveLooks();
  });
}
$("looks-sound").addEventListener("change", (e) => {
  looks.sound = e.target.checked;
  // Held cues are moments, not mail: muted, they are dropped rather than
  // saved up to fire all at once the next time sound comes back on.
  if (!looks.sound) soundHeld = null;
  saveLooks();
  // Turning them on is the one change you can hear: the question chime, or
  // the first cue still ticked when that one is not.
  const preview = ["question", ...Object.keys(SOUND_EVENTS)].find(soundOn);
  if (preview) sound(preview);
});
for (const box of document.querySelectorAll("input[data-sound]")) {
  box.addEventListener("change", () => {
    const event = box.dataset.sound;
    looks[soundKey(event)] = box.checked;
    if (!box.checked && soundHeld === event) soundHeld = null;
    saveLooks();
    // Ticking one plays it, so the label has a sound to go with it.
    if (box.checked) sound(event);
  });
}

// Models: the launcher's menu. The built-in list ships with every install and is read-only
// here; what the person adds is saved to the server, which the launcher reads on its next run.
let modelsData = null;
let modelsTab = "claude";

function setModelsStatus(text, isError) {
  const status = $("models-status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

function renderModels() {
  for (const cli of ["claude", "devin"]) {
    $("models-tab-" + cli).setAttribute("aria-pressed", String(cli === modelsTab));
  }
  const shipped = $("models-shipped");
  const user = $("models-user");
  shipped.replaceChildren();
  user.replaceChildren();
  if (!modelsData) {
    setModelsStatus("Models could not be loaded.", true);
    return;
  }
  for (const m of modelsData.shipped[modelsTab] || []) {
    const row = el("div", "models-row locked");
    row.append(el("span", null, m.id), el("span", null, m.label || ""));
    shipped.appendChild(row);
  }
  const mine = modelsData.user[modelsTab];
  mine.forEach((m, i) => {
    const row = el("div", "models-row");
    const id = el("input");
    id.value = m.id;
    id.placeholder = "Model id";
    id.setAttribute("aria-label", "Model id");
    const label = el("input");
    label.value = m.label;
    label.placeholder = "Name shown in the menu";
    label.setAttribute("aria-label", "Name shown in the menu");
    const remove = el("button", "btn small ghost", "Remove");
    remove.type = "button";
    id.addEventListener("change", () => { m.id = id.value.trim(); saveModels(); });
    label.addEventListener("change", () => { m.label = label.value.trim(); saveModels(); });
    remove.addEventListener("click", () => {
      mine.splice(i, 1);
      saveModels();
      renderModels();
    });
    row.append(id, label, remove);
    user.appendChild(row);
  });
}

async function saveModels() {
  try {
    const res = await fetch("/models", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ models: modelsData.user }),
    });
    const body = await res.json();
    if (!res.ok) return setModelsStatus(body.error || "Could not save.", true);
    setModelsStatus("Saved. Restart plan2code to use it.", false);
  } catch {
    setModelsStatus("Could not save.", true);
  }
}

async function loadModelsData() {
  try {
    const res = await fetch("/models");
    if (res.ok) modelsData = await res.json();
  } catch {}
  renderModels();
}

for (const cli of ["claude", "devin"]) {
  $("models-tab-" + cli).addEventListener("click", () => {
    modelsTab = cli;
    renderModels();
  });
}
$("models-add").addEventListener("click", () => {
  if (!modelsData) return;
  modelsData.user[modelsTab].push({ id: "", label: "" });
  renderModels();
  $("models-user").querySelector(".models-row:last-child input")?.focus();
});
$("models-reset").addEventListener("click", () => {
  if (!modelsData) return;
  modelsData.user = { claude: [], devin: [] };
  saveModels();
  renderModels();
});

// Cleanup: the server works out what in ~/.plan2code is not needed and
// shows it first; Delete these sends back only the ids it was shown, and the
// server re-checks every one before removing it.
let cleanupFound = null;
// Bumped by every scan, delete and reset: a response from an older one is
// dropped, so a scan still in flight when Preferences closes cannot refill it.
let cleanupGen = 0;
const CLEANUP_SHOWN = 8;

function setCleanupStatus(text, isError) {
  const status = $("cleanup-status");
  status.textContent = text;
  status.classList.toggle("error", Boolean(isError));
}

function cleanupLabel(item) {
  if (item.where === "session") return "Session " + item.name;
  const where = item.where === "root" ? "~/.plan2code/" : "~/.plan2code/console/";
  return where + item.name + (item.kind === "folder" ? "/" : "");
}

function cleanupSummary(items, bytes) {
  const sessions = items.filter((i) => i.where === "session").length;
  const strays = items.length - sessions;
  const parts = [];
  if (sessions) parts.push(sessions + (sessions === 1 ? " old session" : " old sessions"));
  if (strays) parts.push(strays + (strays === 1 ? " stray file or folder" : " stray files and folders"));
  return parts.join(", ") + " · " + formatBytes(bytes);
}

function resetCleanup() {
  cleanupGen++;
  cleanupFound = null;
  $("cleanup-list").replaceChildren();
  $("cleanup-delete").hidden = true;
  $("cleanup-delete").disabled = false;
  $("cleanup-scan").disabled = false;
  setCleanupStatus("", false);
}

function renderCleanup() {
  const list = $("cleanup-list");
  list.replaceChildren();
  const items = (cleanupFound && cleanupFound.items) || [];
  $("cleanup-delete").hidden = !items.length;
  if (!items.length) return;
  const rows = (some) => some.map((item) => {
    const row = el("div", "cleanup-row");
    row.append(el("span", null, cleanupLabel(item)), el("span", "cleanup-size", formatBytes(item.bytes)));
    return row;
  });
  list.append(el("p", "cleanup-summary", cleanupSummary(items, cleanupFound.bytes)), ...rows(items.slice(0, CLEANUP_SHOWN)));
  if (items.length > CLEANUP_SHOWN) {
    const more = el("details", "cleanup-more");
    more.append(el("summary", null, (items.length - CLEANUP_SHOWN) + " more"), ...rows(items.slice(CLEANUP_SHOWN)));
    list.appendChild(more);
  }
}

async function scanCleanup() {
  const gen = ++cleanupGen;
  $("cleanup-scan").disabled = true;
  $("cleanup-delete").disabled = true;
  setCleanupStatus("Looking…", false);
  const { status, body } = await postJson("/cleanup", { scan: true });
  if (gen !== cleanupGen) return;
  $("cleanup-scan").disabled = false;
  $("cleanup-delete").disabled = false;
  if (status !== 200 || !body.ok) {
    cleanupFound = null;
    renderCleanup();
    return setCleanupStatus(status ? body.error || "Could not look." : "Plan2Code isn't reachable.", true);
  }
  cleanupFound = { items: body.items || [], bytes: body.bytes || 0 };
  renderCleanup();
  // Left in the status line, not cleared: it is the live region, so this is
  // what a screen reader hears when the scan finishes.
  const found = cleanupFound.items.length;
  setCleanupStatus(found ? "Found " + found + (found === 1 ? " item." : " items.") : "Nothing to clean up.", false);
}

async function deleteCleanup() {
  if (!cleanupFound || !cleanupFound.items.length) return;
  const gen = ++cleanupGen;
  $("cleanup-delete").disabled = true;
  $("cleanup-scan").disabled = true;
  setCleanupStatus("Deleting…", false);
  const { status, body } = await postJson("/cleanup", { delete: cleanupFound.items.map((i) => i.id) });
  if (gen !== cleanupGen) return;
  $("cleanup-delete").disabled = false;
  $("cleanup-scan").disabled = false;
  if (status !== 200 || !body.ok) {
    return setCleanupStatus(status ? body.error || "Could not delete." : "Plan2Code isn't reachable.", true);
  }
  const removed = (body.removed || []).length;
  const failed = (body.failed || []).length;
  cleanupFound = null;
  renderCleanup();
  const done = removed ? "Deleted " + removed + (removed === 1 ? " item" : " items") + " · " + formatBytes(body.bytes) + " freed." : "Nothing was deleted.";
  setCleanupStatus(failed ? done + " " + failed + " could not be removed." : done, Boolean(failed));
}

$("cleanup-scan").addEventListener("click", scanCleanup);
$("cleanup-delete").addEventListener("click", deleteCleanup);

$("btn-brief").addEventListener("click", openBrief);
$("btn-subagents").addEventListener("click", openSubagents);
$("subagents-default").addEventListener("click", () => {
  $("subagents-instruction").value = defaultInstruction(S.workflow);
});
$("subagents-save").addEventListener("click", saveSubagents);
$("subagents-cancel").addEventListener("click", () => $("subagents-modal").close());
$("subagents-modal").addEventListener("close", () => $("btn-subagents").focus());
$("brief-cancel").addEventListener("click", () => $("brief-modal").close());
$("brief-go").addEventListener("click", sendBrief);
for (const radio of document.querySelectorAll('input[name="brief-range"]')) {
  radio.addEventListener("change", syncBriefDate);
}

// Dropping files onto the notes panel attaches them to the selected
// question's note. Bound once here: the panel's contents are redrawn on every
// render, the panel itself is not.
{
  const aside = $("aside");
  const canDrop = (e) => {
    const item = view === "end" ? null : byId(selected);
    return (
      Array.from((e.dataTransfer && e.dataTransfer.types) || []).includes("Files") &&
      item &&
      isOpen(item) &&
      !finish()
    );
  };
  const onOver = (e) => {
    if (!canDrop(e)) return;
    e.preventDefault();
    aside.classList.add("is-dropping");
  };
  aside.addEventListener("dragenter", onOver);
  aside.addEventListener("dragover", onOver);
  aside.addEventListener("dragleave", (e) => {
    // Moving between children fires dragleave too; only leaving the panel counts.
    if (!aside.contains(e.relatedTarget)) aside.classList.remove("is-dropping");
  });
  aside.addEventListener("drop", (e) => {
    aside.classList.remove("is-dropping");
    if (!canDrop(e)) return;
    e.preventDefault();
    attachFiles(selected, e.dataTransfer.files);
  });
}

$("btn-send").addEventListener("click", send);
// The workspace label opens the Workspace dialog; each folder's Copy path
// lives in there now.
$("footer-where").addEventListener("click", openWorkspace);
$("btn-clear").addEventListener("click", () => {
  if (!confirm("Clear everything you have not sent yet?")) return;
  local.staged = {};
  // Every typed box, the same set markSent clears: a draft left behind would
  // refill its box on the next render and look as if nothing was cleared.
  const typed = ["thread-", "other-", "text-", "note-"];
  for (const key of Object.keys(local.drafts)) if (typed.some((p) => key.startsWith(p))) delete local.drafts[key];
  for (const [itemId, list] of Object.entries(local.images)) {
    for (const img of list) removeImage(itemId, img.key);
  }
  save();
  render();
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
  if (e.key === "Escape" && dashPick && isDashboard() && !finish() && !document.querySelector("dialog[open]")) {
    dashPick = null;
    render();
  }
});

// The clock, and the one piece of state that changes without anybody doing
// anything: the agent falling silent. renderStatus alone was not enough --
// Planny went quiet and the footer below him carried on promising "one
// moment" with a spinner beside it, because the footer is only drawn by a full
// render and nothing was triggering one. Watch the flip and draw the rest.
let wasAdrift = false;
let wasPastGrace = false;
setInterval(() => {
  renderStatus();
  const now = agentAdrift();
  if (now !== wasAdrift) {
    wasAdrift = now;
    if (S) {
      renderFooter();
      renderStopButton();
      renderHomeButton();
      renderStopping();
    }
  }
  // Crossing the working grace period is the same kind of quiet change: the
  // footer's "wait" line becomes "busy a while" without anybody clicking, and
  // a staged answer's send hatch opens on time instead of at the next render.
  const past = agentWorking() && workingMs() > patience(WORKING_GRACE_MS);
  if (past !== wasPastGrace) {
    wasPastGrace = past;
    if (S) renderFooter();
  }
  // The agent coming or going changes whether the chat can be used, with no
  // frame to say so: redraw the Ask pane when that flips. Even mid-typing:
  // the draft is saved on every keystroke and withFocus() keeps the caret,
  // and a composer that looks open while the agent has gone is the worse lie.
  if (S && view === "ask" && (askState().send.state === "offline") !== askPaintedOffline) render();
}, 1000);

// The state came with the page, so the real screen is drawn in this same
// task, before the browser's next paint. Only a page without it asks.
if (BOOT && BOOT.state) adopt(BOOT);
else await loadState();
connect();
// He is on the page already; this is the first hello. After the first draw,
// so fetching the chime never stands in front of it. A dormant wake-up plays
// the boot-up sound instead, as he powers on.
setTimeout(() => {
  if (!wakeHoldsChime) sound("sessionStart");
}, 0);
