// Plan2Code Web Console - User Preferences: the look and sound controls. The
// Agents & models tab is agents-view.js's.

import { adoptLooks, applyLooks, loadLooks, looks, renderSwatches, saveLooks, syncLooks } from "../looks.js";
import { dropHeldSound, previewSound, releaseHeldSound, sound, soundOn } from "../sound.js";
import { hushTones, tone, unlockTones } from "../tones.js";
import { hushMusic } from "../music.js";
import { SOUND_EVENTS, soundFileKey, soundKey } from "../palette.js";
import { ROLES, ROLE_NOT_SET, ROLE_NOT_SET_LABEL, needsRoleNudge, normalizeRole } from "../starters.js";
import { isDashboard } from "../selectors.js";
import { el } from "../render.js";
import { hooks, page, redraw } from "../state.js";
import { framed, onAppMessage, tellApp } from "../app-bridge.js";

const $ = (id) => document.getElementById(id);

// Following the system, the saved looks painted before anything is drawn, and
// the sound cues let go on the next touch. `boot` is the page's boot data.
export function startLooks(boot) {
  // Following the system means following it as it changes, including the accent,
  // whose light and dark shades are different colors.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (looks.theme === "system") {
      applyLooks();
      renderSwatches();
    }
  });

  loadLooks();
  if (boot && boot.looks && typeof boot.looks === "object") adoptLooks(boot.looks);
  applyLooks();
  syncLooks();

  for (const evt of ["pointerdown", "keydown"]) {
    window.addEventListener(evt, releaseHeldSound);
  }
}

// The fieldset a control sits in, for the Saved mark beside its legend.
const fieldsetOf = (node) => node.closest("fieldset");

// Preferences' look and sound fields. Opening and closing the dialog, its tabs
// and Back to default are prefs-dialog.js's.
export function wireLooks() {
  $("looks-modal").addEventListener("close", () => {
    if (isDashboard() && !needsRoleNudge(looks) && $("main").querySelector(".dash-nudge")) redraw();
  });
  for (const [value, label] of [[ROLE_NOT_SET, ROLE_NOT_SET_LABEL], ...ROLES.map((r) => [r.id, r.label])]) {
    const option = el("option", null, label);
    option.value = value;
    $("looks-role").appendChild(option);
  }
  $("looks-role").addEventListener("change", (e) => {
    looks.role = normalizeRole(e.target.value);
    hooks.markSaved(fieldsetOf(e.target), saveLooks());
    // The dashboard banner, and the starter templates and Ask starters on any
    // page, all order themselves by the role.
    if (page.S) redraw();
  });
  for (const radio of document.querySelectorAll('input[name="looks-theme"]')) {
    radio.addEventListener("change", () => {
      looks.theme = radio.value;
      hooks.markSaved(fieldsetOf(radio), saveLooks());
    });
  }
  for (const radio of document.querySelectorAll('input[name="looks-width"]')) {
    radio.addEventListener("change", () => {
      looks.width = radio.value;
      hooks.markSaved(fieldsetOf(radio), saveLooks());
    });
  }
  $("looks-sound").addEventListener("change", (e) => {
    looks.sound = e.target.checked;
    // Held cues are moments, not mail: muted, they are dropped rather than
    // saved up to fire all at once the next time sound comes back on.
    if (!looks.sound) dropHeldSound();
    hooks.markSaved(fieldsetOf(e.target), saveLooks());
    // Turning them on is the one change you can hear: the question chime, or
    // the first cue still ticked when that one is not.
    const preview = ["question", ...Object.keys(SOUND_EVENTS)].find(soundOn);
    if (preview) sound(preview);
  });
  // The games' sounds: off silences a game playing now; on plays a blip.
  $("looks-activity-sounds").addEventListener("change", (e) => {
    looks.activitySounds = e.target.checked;
    if (!looks.activitySounds) hushTones();
    hooks.markSaved(fieldsetOf(e.target), saveLooks());
    if (looks.activitySounds) {
      unlockTones();
      tone("go");
    }
  });
  // The games' music: off stops a track playing now.
  $("looks-game-music").addEventListener("change", (e) => {
    looks.gameMusic = e.target.checked;
    if (!looks.gameMusic) hushMusic();
    hooks.markSaved(fieldsetOf(e.target), saveLooks());
  });
  $("looks-skip-intro").addEventListener("change", (e) => {
    looks.skipIntro = e.target.checked;
    hooks.markSaved(fieldsetOf(e.target), saveLooks());
  });
  $("looks-activities").addEventListener("change", (e) => {
    looks.hideActivities = !e.target.checked;
    hooks.markSaved(fieldsetOf(e.target), saveLooks());
    // The die comes and goes with the next render, which also closes an open
    // Activities window, paused.
    redraw();
  });
  for (const box of document.querySelectorAll("input[data-sound]")) {
    box.addEventListener("change", () => {
      const event = box.dataset.sound;
      looks[soundKey(event)] = box.checked;
      if (!box.checked) dropHeldSound(event);
      hooks.markSaved(fieldsetOf(box), saveLooks());
      // Ticking one plays it, so the label has a sound to go with it.
      if (box.checked) sound(event);
    });
  }

  // The sound picked for a cue: a change saves it and plays it once, and the
  // play button replays the current pick. Neither depends on the cue's own tick.
  for (const select of document.querySelectorAll("select[data-sound-file]")) {
    select.addEventListener("change", () => {
      looks[soundFileKey(select.dataset.soundFile)] = select.value;
      hooks.markSaved(fieldsetOf(select), saveLooks());
      previewSound(select.value);
    });
  }
  for (const button of document.querySelectorAll("button[data-sound-play]")) {
    button.addEventListener("click", () => {
      previewSound(looks[soundFileKey(button.dataset.soundPlay)]);
    });
  }

  // Desktop app: the taskbar switch, kept by the app in its own app.json. The
  // app says what it holds once the page is up; checked until it does.
  if (framed()) {
    $("looks-desktop").hidden = false;
    onAppMessage("taskbar-state", (data) => {
      if (typeof data.on === "boolean") $("looks-taskbar").checked = data.on;
    });
    $("looks-taskbar").addEventListener("change", (e) => tellApp("taskbar", { on: e.target.checked }));
  }
}
