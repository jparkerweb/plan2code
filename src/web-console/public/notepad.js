// Plan2Code Web Console - the Notebook's save rules, status words and error sentences.
//
// The source of truth for when the page saves the note, how it retries, what
// the status line says and the sentence each server refusal becomes. The
// Notebook screen only runs timers and requests on what these return. No DOM
// access at module scope and no imports: the page and `node --test` both
// import this file. The limits mirror notepads.mjs (a test keeps them equal),
// copied rather than imported because the page cannot load server modules.

export const SAVE_DEBOUNCE_MS = 800;
export const RETRY_STEPS_MS = Object.freeze([1000, 2000, 4000, 8000, 16000, 30000]);
export const NOTE_MAX_BYTES = 1024 * 1024;
export const NOTEPAD_MAX_IMAGES = 200;
export const IMAGE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const TAB_ID_RE = /^[0-9a-f]{12}$/;
export const TAB_NAME_MAX = 40;
export const NOTEPAD_MAX_TABS = 20;

// The codes the /notepad routes send as `{ error: code }`.
export const ERROR_CODES = Object.freeze([
  "bad",
  "too-long",
  "not-jpeg",
  "too-large",
  "too-many",
  "not-found",
  "bad-name",
  "duplicate-name",
  "too-many-tabs",
  "no-such-tab",
]);

// UTF-8 bytes, the unit the server's cap is in (a character count would let
// non-ASCII text past the page's check and into a 413).
export function noteBytes(text) {
  return new TextEncoder().encode(typeof text === "string" ? text : "").length;
}

/* ------------------------------------------------------------ saving */

const STATUSES = Object.freeze(["idle", "pending", "saving", "saved", "failed", "too-long"]);

export const SAVE_START = Object.freeze({ status: "idle", attempt: 0 });

const known = (state) => !!state && typeof state === "object" && STATUSES.includes(state.status);
const attemptOf = (state) => (Number.isInteger(state.attempt) && state.attempt > 0 ? state.attempt : 0);
const stay = (state) => ({ state, timer: null });
const to = (status, attempt, timer) => ({ state: { status, attempt }, timer });

/**
 * The save state after `event`, plus `timer`: the delay in ms the screen arms
 * before dispatching `due`, or null for no timer. Pure: never mutates `state`,
 * runs no clock and sends nothing.
 */
export function nextSave(state, event) {
  if (!known(state)) return stay(state);
  const type = event && typeof event === "object" ? event.type : event;
  const { status } = state;
  switch (type) {
    case "typed": {
      const bytes = event && typeof event.bytes === "number" ? event.bytes : 0;
      // Over the cap nothing is sent: the server would only refuse it.
      if (bytes > NOTE_MAX_BYTES) return to("too-long", 0, null);
      return to("pending", 0, SAVE_DEBOUNCE_MS);
    }
    case "due":
      if (status === "pending" || status === "failed") return to("saving", attemptOf(state), null);
      return stay(state);
    case "sent":
      return stay(state);
    case "ok":
      // A change typed while the request was out comes back as a fresh
      // `typed` from the screen, so `ok` can always land on saved.
      return to("saved", 0, null);
    case "error": {
      // Retrying a size the server refused would never succeed.
      if (event && event.code === "too-long") return to("too-long", 0, null);
      const attempt = attemptOf(state);
      return to("failed", attempt + 1, RETRY_STEPS_MS[Math.min(attempt, RETRY_STEPS_MS.length - 1)]);
    }
    case "retry":
      if (status === "failed") return to("saving", attemptOf(state), null);
      return stay(state);
    default:
      return stay(state);
  }
}

// "1 MB", "512 KB", "300 bytes": the cap in words for the status line.
function sizeWords(bytes) {
  const trim = (n) => String(Math.round(n * 10) / 10);
  if (bytes >= 1024 * 1024) return trim(bytes / (1024 * 1024)) + " MB";
  if (bytes >= 1024) return trim(bytes / 1024) + " KB";
  return bytes + " bytes";
}

const STATUS_WORDS = Object.freeze({
  idle: "",
  pending: "Saving",
  saving: "Saving",
  saved: "Saved",
  failed: "Not saved (retrying)",
  "too-long": `Too long to save (over ${sizeWords(NOTE_MAX_BYTES)})`,
});

const statusOf = (state) => (typeof state === "string" ? state : state && typeof state === "object" ? state.status : undefined);

// The status line's words for a state object or a bare status.
export function saveStatus(state) {
  const status = statusOf(state);
  return Object.prototype.hasOwnProperty.call(STATUS_WORDS, status) ? STATUS_WORDS[status] : "";
}

// True while text on screen may not be on disk yet: the page only asks
// before closing then. A too-long note is not asked about, the status line
// already says it cannot be saved.
export function unsaved(state) {
  const status = statusOf(state);
  return status === "pending" || status === "saving" || status === "failed";
}

// True while the editor holds text the stored note must not replace when the
// notepad is opened again: anything unsaved, and a note too long to save,
// which would otherwise lose everything typed since its last save.
export function keepsText(state) {
  return unsaved(state) || statusOf(state) === "too-long";
}

/* ------------------------------------------------------------ errors */

const ERROR_SENTENCES = Object.freeze({
  bad: "Plan2Code could not read that request, so nothing was changed.",
  "too-long": `This note is too long to save. Notes can be up to ${sizeWords(NOTE_MAX_BYTES)}.`,
  "not-jpeg": "That picture could not be added. Try a PNG, JPEG or a screenshot.",
  "too-large": "That picture is too large to add. Try a smaller one.",
  "too-many": `This notepad already holds ${NOTEPAD_MAX_IMAGES} pictures, the most it can keep. Delete one to add another.`,
  "not-found": "That picture is no longer in this notepad.",
  "bad-name": `A tab name needs 1 to ${TAB_NAME_MAX} characters, with no control characters.`,
  "duplicate-name": "There is already a tab with that name.",
  "too-many-tabs": `This notepad already has ${NOTEPAD_MAX_TABS} tabs, the most it can have. Delete one to add another.`,
  "no-such-tab": "That tab is no longer in this notepad.",
});

const LOST_CONTACT = "Lost contact with Plan2Code. Your text is kept here and will be saved once it's back.";

// The status line when the note could not be read on first open: the editor
// stays read-only, since anything typed would be saved over the real note.
export const NOT_LOADED = "Could not read the note. Close the notepad and open it again.";

// The status line when the editor itself could not be loaded.
export const EDITOR_NOT_LOADED = "The editor could not be loaded. Close the notepad and open it again.";

// One plain sentence for a server refusal; anything else (status 0, an
// unknown code) is treated as a lost connection.
export function errorSentence(code) {
  return typeof code === "string" && Object.prototype.hasOwnProperty.call(ERROR_SENTENCES, code) ? ERROR_SENTENCES[code] : LOST_CONTACT;
}

/* ------------------------------------------------------------ tabs */

// A tab name as the server will keep it (notepads.mjs normalizeTabName):
// trimmed, inner whitespace collapsed, 1 to TAB_NAME_MAX code points, no
// control characters. `{ ok: true, name }` or `{ ok: false, reason }`.
export function cleanTabName(name) {
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!clean) return { ok: false, reason: "empty" };
  if ([...clean].length > TAB_NAME_MAX) return { ok: false, reason: "too-long" };
  if (/[\u0000-\u001f\u007f]/.test(clean)) return { ok: false, reason: "control" };
  return { ok: true, name: clean };
}

const nameKey = (name) => name.toLocaleLowerCase("en-US");

// Whether another tab (not `exceptId`) already has this name, in any case.
export function nameTaken(tabs, name, exceptId) {
  const clean = cleanTabName(name);
  if (!clean.ok) return false;
  const key = nameKey(clean.name);
  return (Array.isArray(tabs) ? tabs : []).some((tab) => tab && tab.id !== exceptId && typeof tab.name === "string" && nameKey(cleanTabName(tab.name).name || tab.name) === key);
}

const NAME_PROBLEMS = Object.freeze({
  empty: "Give the tab a name.",
  "too-long": `Use ${TAB_NAME_MAX} characters or fewer.`,
  control: "Use plain letters, numbers and punctuation in the name.",
});

// The sentence to show under the name field, or "" when the name will do.
export function tabNameProblem(tabs, name, exceptId) {
  const clean = cleanTabName(name);
  if (!clean.ok) return NAME_PROBLEMS[clean.reason];
  return nameTaken(tabs, clean.name, exceptId) ? ERROR_SENTENCES["duplicate-name"] : "";
}

// A new order with `id` moved `delta` places: clamped at both ends, never
// wrapping; the same order when `id` is not in it.
export function moveTab(order, id, delta) {
  const list = Array.isArray(order) ? [...order] : [];
  const from = list.indexOf(id);
  if (from < 0 || !Number.isInteger(delta)) return list;
  const at = Math.max(0, Math.min(list.length - 1, from + delta));
  list.splice(from, 1);
  list.splice(at, 0, id);
  return list;
}

// A new order with `id` just before `beforeId` (the end when `beforeId` is
// null), for a drop; unchanged for an unknown id or a drop on itself.
export function dropTab(order, id, beforeId) {
  const list = Array.isArray(order) ? [...order] : [];
  if (!list.includes(id) || id === beforeId) return list;
  const rest = list.filter((x) => x !== id);
  const at = beforeId == null ? rest.length : rest.indexOf(beforeId);
  rest.splice(at < 0 ? rest.length : at, 0, id);
  return rest;
}

// Whether leaving the tab now must first save it: there is text the stored
// note must not lose (keepsText) or text not yet on disk (unsaved).
export function tabSwitch(state) {
  return keepsText(state) || unsaved(state);
}

// The two-confirm delete: "none" until Delete is pressed, then "ask", then
// "sure"; the second confirm finishes it ("done"). Cancel or Escape at either
// step goes back to "none". Anything else leaves the stage as it was.
export const DELETE_STAGES = Object.freeze({ none: "none", ask: "ask", sure: "sure" });

export function nextDelete(stage, event) {
  if (event === "cancel" || event === "escape") return "none";
  if (stage === "none" && event === "click") return "ask";
  if (stage === "ask" && event === "confirm") return "sure";
  if (stage === "sure" && event === "confirm") return "done";
  return stage;
}

/* ------------------------------------------------------------ viewer */

// The next index when stepping through `count` pictures, wrapping at both
// ends; -1 when there is nothing to step through.
export function step(index, delta, count) {
  if (!(count > 0)) return -1;
  return (((index + delta) % count) + count) % count;
}
