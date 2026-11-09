// Plan2Code Web Console - what the User Preferences dialog is.
//
// Its tabs in order, which one opens, and what Back to default resets on
// each. No DOM access at module scope, and its one import is the data-only
// palette.js: the page and `node --test` both import this file.

import { SOUND_EVENTS, soundKey, PICKABLE_SOUNDS, soundFileKey } from "./palette.js";

const tab = (id, label, hint, sections) => Object.freeze({ id, label, hint, sections: Object.freeze(sections) });

// Each section id names one fieldset in the dialog (its data-section).
export const PREFS_TABS = Object.freeze([
  tab("appearance", "Appearance", "Theme, width, color, role, intro", ["theme", "width", "accent", "role", "intro"]),
  tab("agents", "Agents & models", "Your CLIs and models", ["agents"]),
  tab("system", "System", "Cleanup, desktop app", ["cleanup", "desktop"]),
  tab("sounds", "Sounds & activities", "What plays", ["sounds", "activities"]),
]);

// The tab the dialog opens on: the one asked for when there is such a tab,
// else Appearance. Nothing is remembered between opens.
export function prefsOpenTab(asked) {
  return PREFS_TABS.some((t) => t.id === asked) ? asked : "appearance";
}

// The looks keys Back to default resets on a tab, or null where it has
// nothing to reset (and is hidden).
export function prefsResetScope(tab) {
  if (tab === "appearance") return ["theme", "width", "accent", "role", "skipIntro"];
  if (tab === "sounds") return ["sound", ...Object.keys(SOUND_EVENTS).map(soundKey), ...PICKABLE_SOUNDS.map(soundFileKey), "hideActivities", "activitySounds", "gameMusic"];
  return null;
}
