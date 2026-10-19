// Plan2Code Web Console - the sound cues: which plays, one at a time, held until the first click; defines only.

import { looks } from "./looks.js";
import { soundKey, SOUND_EVENTS } from "./palette.js";

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

export const soundOn = (event) => looks.sound && looks[soundKey(event)];

const soundAudio = (event) => SOUNDS[SOUND_EVENTS[event].file];

const louderSound = (a, b) => (!b || SOUND_EVENTS[a].rank > SOUND_EVENTS[b].rank ? a : b);

export function sound(event) {
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
export function fadeSound(event, ms) {
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

// Drops anything queued or held, for a Skip that wants silence.
export function dropSounds() {
  soundQueued = null;
  soundHeld = null;
}

// The first click or keypress lets out the one cue that was held.
export function releaseHeldSound() {
  if (!soundHeld) return;
  const name = soundHeld;
  soundHeld = null;
  sound(name);
}

// Drops the held cue: any of them, or only `event`'s.
export function dropHeldSound(event) {
  if (event === undefined || soundHeld === event) soundHeld = null;
}
