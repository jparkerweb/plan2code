// Plan2Code Web Console - the page's shared state and the redraw hook; defines only.
//
// `page` is the one object the page's state lives on, so every file that
// draws reads and writes the same thing:
//   page.S         the server's truth (state.json). Never mutated by the page.
//   page.local     what the person has staged but not sent. Mirrored to
//                  localStorage on every change, so a closed tab or a reload
//                  loses nothing.
//   page.selected  the question on screen, by id.
//   page.view      the tab on screen.
// and below them the rest of what more than one file reads or writes: the
// server's word on the agent and on sends in flight, the frame's other
// blocks, and the few page-local things a screen and the core share.
//
// A screen never calls the render loop or the draft's save itself: it calls
// redraw() and saveNow(), which app.js points at screens/core.js at start-up.
// Nothing here touches the page, so `node --test` imports this file and sets
// the state directly.

export function fresh() {
  // `stopping` is set once a stop request has been accepted, and kept here so
  // a reload in the middle of wrapping up comes back to the same screen.
  // `afterBuild` is "review", "commit", "done" or "dashboard" once a finished session's
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
    // A picker Delete sent and not yet answered by a rescan: { dir, scanAt }.
    deleting: null,
    retract: {},
    chat: freshChat(),
  };
}

// The Ask pane's own corner of `local`: the composer's draft and pictures,
// what the next message is about, sends still on their way, and the newest
// reply already seen (the dot). `conversation` is the one these belong to.
export function freshChat() {
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

export const page = {
  S: null,
  local: fresh(),
  selected: null,
  view: "questions",

  // What the server says around the state, from the last frame or ping: when
  // the agent last touched it, and whether a send or a stop is still waiting
  // to be picked up.
  agentLastSeen: null,
  pendingResult: false,
  pendingStop: false,
  // Set while a "still being picked up" banner is showing (see the frame handler).
  pendingBannerUp: false,
  // No contact with the server: the page is offline.
  gone: false,
  // The Quick question chat: the server's view of the current conversation
  // (the frame's `chat` block). The rest is page-local and gone on a reload:
  // `chatDot` is the Ask tab's dot as last drawn, so a reply chimes once;
  // `chatError` the line under the composer; `askRowCount` how many rows the
  // pane last showed, so a new one scrolls into view; `docInView` the doc
  // block nearest the top.
  chatFrame: null,
  chatDot: false,
  chatError: "",
  askRowCount: 0,
  docInView: null,
  // The frame's workspace ({ folders, missing, remote, issues }) and meter
  // ({ points, level, fraction, words, tooltip }), or null before a server that
  // sends them.
  wsFrame: null,
  meterFrame: null,
  // The frame's update ({ installed, latest }), present only when a newer
  // release is out; null otherwise.
  updateFrame: null,
  // The frame's Subagents switch ({ offered, supported, on, instruction, max,
  // revision }), or null before a server that sends it.
  subagentsFrame: null,
  // The spec's overview.md as last fetched: `key` is the spec dir it was read
  // for, `text` the file, or null when there is none. See loadOverview().
  overview: { key: null, text: null },
  // The dashboard's first-open wake-up (boot.js), while it runs. `cards` turns
  // true at the glide, which lets the menu in; `entered` once its entrance has
  // played; `typed` is how many characters of the note show, or null once all
  // of them do. Page-local: the reload guard is sessionStorage (maybeWake).
  wake: null,
  // The dashboard pick being looked at on the confirm pane, before START is
  // pressed. Page-local like `view`: a reload simply shows the menu again.
  dashPick: null,
  // The `@name` suggestions popover, owned by whichever box last asked for it.
  mentionPop: null,
  // The pose pane on screen when a render began, held back from the clear so
  // posePane() can take it up again. See posePane.
  heldPose: null,
  // The workspace scope (a spec dir, "" for the project) this tab last asked
  // for: its own pick, not whatever the frame says. And true from a launch's
  // scope sync until its send has gone (or failed).
  scopeMine: null,
  launchScoping: false,
};

let redrawHook = null;
let saveHook = null;

// Draw the page again from `page`. A no-op until start-up sets the hook.
export function redraw() {
  if (redrawHook) redrawHook();
}

export function onRedraw(fn) {
  redrawHook = fn;
}

// Keep `page.local` (this browser's copy, and the server's draft). A no-op
// until start-up sets the hook.
export function saveNow() {
  if (saveHook) saveHook();
}

export function onSave(fn) {
  saveHook = fn;
}

// What a screen needs from the core or from another screen: a function the
// entry hands over once at start-up (useHooks) and the screen calls by name,
// never by importing the file that defines it. Calling one before start-up
// is a mistake the test suite catches, so it throws rather than doing nothing.
const registered = {};
export const hooks = new Proxy(registered, {
  get(target, name) {
    if (typeof name !== "string") return undefined;
    if (typeof target[name] !== "function") throw new Error(`hooks.${name} was called before start-up set it`);
    return target[name];
  },
});

export function useHooks(fns) {
  Object.assign(registered, fns);
}

// Stage an answer for a card (or take it back with null), keep the draft, draw.
export function stage(id, value) {
  if (value == null) delete page.local.staged[id];
  else page.local.staged[id] = value;
  saveNow();
  redraw();
}

export function setDraft(id, text) {
  page.local.drafts[id] = text;
  saveNow();
}

// The first state, the saved looks and the draft, written into the page by the
// server so the first real screen needs no round trip. A data block, never run
// as script; read once, on first ask. Null when absent (an older server, a page
// opened some other way): the page then asks for each as it always did.
let bootBlock;
export function bootData() {
  if (bootBlock === undefined) {
    try {
      bootBlock = JSON.parse(document.getElementById("boot").textContent);
    } catch {
      bootBlock = null;
    }
  }
  return bootBlock;
}

// Where each tab was scrolled, keyed by view id, so switching away and back
// lands where the person left it. Page-side only and never persisted: a reload
// starts every tab at its top.
export const scrollMemory = new Map();
