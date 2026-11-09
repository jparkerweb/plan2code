// Plan2Code Web Console - how the page looks and sounds: the saved looks, their sync, and the preferences dialog's swatches; defines only.
//
// The one preference that belongs to the person rather than to the session.
// `looks` is a live binding: every file reads the current object, and only
// this file replaces it.

import { DEFAULT_ACCENT, soundPrefs, soundFilePrefs, DEFAULT_CARD_WIDTH, ACCENTS, accentId, cardWidth, soundKey, soundFileKey } from "./palette.js";
import { normalizeRole, ROLE_NOT_SET } from "./starters.js";
import { bootData, hooks } from "./state.js";
import { el } from "./render.js";
import { tellApp } from "./app-bridge.js";
import { ACTIVITIES, bestKeys, memoKey, musicKey, musicLevel } from "./activities.js";

const $ = (id) => document.getElementById(id);

// How the page looks and sounds, which is the one preference that belongs to
// the person rather than to the session. Kept per browser, applied before
// anything else is drawn, and deliberately touching nothing but presentation:
// a session opened in a different theme is the same session.
//
// The highlight colors live in palette.js, where the tests can reach them.
const ACCENT_VARS = ["--accent", "--accent-soft", "--accent-ink", "--accent-line"];

const LOOKS_KEY = "p2c-console:looks";

// The per-event sound switches (SOUND_EVENTS) live in palette.js too.
export const DEFAULT_LOOKS = {
  theme: "system",
  accent: DEFAULT_ACCENT,
  sound: true,
  ...soundPrefs(null),
  // Which sound file each pickable cue plays (soundFileQuestion: "sound-03").
  ...soundFilePrefs(null),
  width: DEFAULT_CARD_WIDTH,
  hideUnavailable: true,
  // Always SKIP Intro: never play the dashboard's first-open wake-up (Planny asleep), off by default.
  skipIntro: false,
  // Activities: the top bar's die (hidden until someone turns on Show Activities), whether its games play sounds (under Play
  // sounds, which silences them too), the game last picked, and one best score
  // per listed game (activityBestSnake) or, for a game with courses, per
  // course (activityBestGolfPirate), each a flat key for cleanLooks().
  hideActivities: true,
  activitySounds: true,
  // Whether a game plays its music too (chiptune or recorded songs): on, like the sounds.
  gameMusic: true,
  lastActivity: "",
  ...Object.fromEntries(ACTIVITIES.flatMap((a) => bestKeys(a).map((key) => [key, 0]))),
  // And one memo per game (activityMemoSnake): Snake's surprises found.
  ...Object.fromEntries(ACTIVITIES.map((a) => [memoKey(a.id), 0])),
  // And, for a game with music, its music volume (activityMusicDrive), 0 to 100.
  ...Object.fromEntries(ACTIVITIES.filter((a) => a.music !== undefined).map((a) => [musicKey(a.id), a.music])),
};

export let looks = { ...DEFAULT_LOOKS };

let syncedLooks = null;

export let looksReady = false;

export function adoptLooks(saved) {
  looks = { ...DEFAULT_LOOKS, ...saved };
  looks.accent = accentId(looks.accent);
  if (!["system", "light", "dark"].includes(looks.theme)) looks.theme = DEFAULT_LOOKS.theme;
  if (typeof looks.sound !== "boolean") looks.sound = DEFAULT_LOOKS.sound;
  Object.assign(looks, soundPrefs(looks));
  Object.assign(looks, soundFilePrefs(looks));
  if (typeof looks.hideUnavailable !== "boolean") looks.hideUnavailable = DEFAULT_LOOKS.hideUnavailable;
  looks.width = cardWidth(looks.width);
  if (typeof looks.skipIntro !== "boolean") looks.skipIntro = DEFAULT_LOOKS.skipIntro;
  if (typeof looks.hideActivities !== "boolean") looks.hideActivities = DEFAULT_LOOKS.hideActivities;
  if (typeof looks.activitySounds !== "boolean") looks.activitySounds = DEFAULT_LOOKS.activitySounds;
  if (typeof looks.gameMusic !== "boolean") looks.gameMusic = DEFAULT_LOOKS.gameMusic;
  if (typeof looks.lastActivity !== "string") looks.lastActivity = DEFAULT_LOOKS.lastActivity;
  // A best score is a whole number of points, never below none.
  for (const a of ACTIVITIES) {
    for (const key of bestKeys(a)) {
      const n = Number(looks[key]);
      looks[key] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
    }
    const memo = Number(looks[memoKey(a.id)]);
    looks[memoKey(a.id)] = Number.isFinite(memo) && memo > 0 ? Math.floor(memo) : 0;
    if (a.music !== undefined) looks[musicKey(a.id)] = Math.round(musicLevel(a, looks[musicKey(a.id)]) * 100);
  }
  if (saved && typeof saved === "object" && Object.hasOwn(saved, "role")) looks.role = normalizeRole(saved.role);
  else delete looks.role;
}

// The localStorage copy is only a cache now. It exists so the first paint can
// apply a theme synchronously rather than flashing the defaults while the
// fetch below is in flight; the server's looks.json is the truth, because it
// is the copy that follows the app when a new session lands on a new port.
export function loadLooks() {
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
export async function syncLooks() {
  let saved = null;
  // The server already put its copy in the page: no request, and no second
  // repaint a moment after the first. `looks: null` there is the 404 case.
  const boot = bootData();
  if (boot && "looks" in boot) saved = boot.looks ? { looks: boot.looks } : null;
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
  setTimeout(hooks.maybeWelcome, 0);
}

// The mirror on the server. A failed POST costs nothing the next session would
// notice on this port; the localStorage copy still covers the reload case. It
// resolves with whether the write landed, for Preferences' Saved mark.
function pushLooks() {
  try {
    // Only what this tab changed since it last synced, so a tab with stale
    // settings never overwrites another tab's change to a different key.
    const set = {};
    for (const [k, v] of Object.entries(looks)) if (!syncedLooks || syncedLooks[k] !== v) set[k] = v;
    const before = syncedLooks;
    const partial = Boolean(before);
    if (partial && !Object.keys(set).length) return Promise.resolve({ ok: true });
    syncedLooks = { ...looks };
    const body = partial ? { set } : { looks };
    // A write that did not land must be sent again with the next change.
    const undo = () => (syncedLooks = before);
    const failed = (error) => {
      undo();
      return { ok: false, error: error || "Could not save." };
    };
    return fetch("/looks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
      .then(async (res) => {
        if (res.ok) return { ok: true };
        const reply = await res.json().catch(() => ({}));
        return failed(reply.error);
      })
      .catch(() => failed());
  } catch {
    return Promise.resolve({ ok: false, error: "Could not save." });
  }
}

const systemDark = () => matchMedia("(prefers-color-scheme: dark)").matches;

const effectiveTheme = () => (looks.theme === "system" ? (systemDark() ? "dark" : "light") : looks.theme);

export function applyLooks() {
  const root = document.documentElement;
  // The desktop app's bar lights its buttons in the same highlight. That bar
  // is always dark, so it gets the dark shades whatever this page's theme is.
  tellApp("looks", { accent: ACCENTS[looks.accent].dark });
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

// Resolves { ok: true } once the server has it (or there was nothing new to
// send), or { ok: false, error } when the write did not land.
export function saveLooks() {
  try {
    localStorage.setItem(LOOKS_KEY, JSON.stringify(looks));
  } catch {}
  const pushed = pushLooks();
  applyLooks();
  // A width change reflows the card without resizing the column, so the
  // column's observer never hears of it: refit the growing box here.
  hooks.fitGrowBox();
  renderSwatches();
  return pushed;
}

// Told of each swatch's save, for Preferences' Saved mark: set by the dialog's
// screen, since this module never imports one.
let swatchSaved = null;
export function onSwatchSaved(fn) {
  swatchSaved = fn;
}

// Built once, repainted in place. Rebuilding the row on every choice destroyed
// the button that had just been clicked, so focus fell to <body> and a keyboard
// user lost their place in the dialog each time they tried a color.
export function renderSwatches() {
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
        const saved = saveLooks();
        if (swatchSaved) swatchSaved(saved);
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
  // The pick per pickable cue; a select and a play button lock with the master switch.
  for (const select of document.querySelectorAll("select[data-sound-file]")) {
    select.value = looks[soundFileKey(select.dataset.soundFile)];
    select.disabled = !looks.sound;
  }
  for (const button of document.querySelectorAll("button[data-sound-play]")) button.disabled = !looks.sound;
  $("looks-role").value = looks.role ?? ROLE_NOT_SET;
  $("looks-skip-intro").checked = looks.skipIntro;
  $("looks-activities").checked = !looks.hideActivities;
  // Like a cue, the game sounds keep their tick while Play sounds is off.
  $("looks-activity-sounds").checked = looks.activitySounds;
  $("looks-activity-sounds").disabled = !looks.sound;
  $("looks-game-music").checked = looks.gameMusic;
  $("looks-game-music").disabled = !looks.sound;
}

// "Back to default": every look returns to its default, but the role is
// marked as asked, the welcome stays seen, and the Activities' best scores
// and last pick stay (only Reset best scores clears those). Given `keys` (one
// Preferences tab's, prefsResetScope() in prefs.js), only those change: the
// role is cleared but marked as asked, the rest take their defaults, and
// every other key stays as it is.
export function resetLooks(keys) {
  if (keys) {
    for (const key of keys) looks[key] = key === "role" ? ROLE_NOT_SET : DEFAULT_LOOKS[key];
    return;
  }
  const kept = { lastActivity: looks.lastActivity };
  for (const a of ACTIVITIES) {
    for (const key of bestKeys(a)) kept[key] = looks[key];
    kept[memoKey(a.id)] = looks[memoKey(a.id)];
  }
  looks = { ...DEFAULT_LOOKS, ...kept, role: ROLE_NOT_SET, welcomeSeen: looks.welcomeSeen };
}
