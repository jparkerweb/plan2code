// Plan2Code Web Console - the games' music: a small chiptune sequencer over tones.js's audio, silent unless Play sounds and the game's own switches allow it; defines only.

import { looks } from "./looks.js";
import { MUSIC_TABLES, audioOut } from "./tones.js";

/* -------------------------------------------------------------- music

   Each game's tracks live in its `activities/<id>-sfx.js` under `music`, as
   note data, so there is no audio file to fetch. A game calls
   music(name, intensity) every frame it wants its track (the window adds a
   third argument, the game's music volume); stop calling and it
   fades out within MUSIC_HOLD_MS, the way a hum does, so a paused, closed or
   finished game falls quiet by itself, and hushMusic() quiets it at once. A
   track picks up again where it left off, at the start of that bar.

   A track is:

     { bpm, rush, voices: { name: voice }, patterns: { id: { voice: "..." } }, order: [id, ...] }

   `bpm` is the tempo at intensity 0 and `rush` the beats a minute added at
   intensity 1. Each step is a sixteenth note. A voice is a chip channel:
   { wave, duty, gain, from, decay, sustain, vibrato, kit }. `wave` is
   "pulse" (with `duty`, 0.125, 0.25 or 0.5, the classic chip squares),
   "triangle", "sine", "square" or "sawtooth"; `kit` makes it the drums
   instead. A voice joins once the intensity reaches its `from`, so a track
   builds as play heats up. `decay` (seconds) and `sustain` (a share) shape
   each note's fall from its peak; `vibrato` is { rate, depth, delay }.

   A pattern line is space separated tokens, one a step, with "|" between
   bars for the eye only: a note ("A4", "C#5", "Bb3"), "-" to hold the one
   before, "." for a rest, or a note with an arpeggio, "A3^037", which
   cycles the root up by those semitones (one digit each, or letters a-c for
   10-12) every ARP_S seconds: the chip's way of playing a chord on one
   channel. A drum step is any of k (kick), s (snare), h (closed hat) and o
   (open hat) together, such as "kh", or ".". Every voice line in a pattern
   runs the same number of steps. */

// A track not asked for again within this long fades out by itself.
const MUSIC_HOLD_MS = 250;

// How far ahead notes are booked, and how often the booking runs: booked
// against the audio clock, so the beat holds even when the page stutters.
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

// The whole of the music sits under the game's own sounds, but clear of the
// engine and wind hums (0.045, then 0.16, were lost under Sunset Drive's engine).
const MUSIC_PEAK = 0.32;

// A change of the music volume glides over this long, so a slider drag never clicks.
const VOLUME_S = 0.08;

// A change of track (a new level) fades one into the other over this long.
const CROSSFADE_S = 2.5;

// One arpeggio step: fast enough to read as a chord.
const ARP_S = 1 / 40;

const FLOOR = 0.0001;

const NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const TRACKS = Object.freeze(Object.assign({}, ...MUSIC_TABLES));

export const musicNames = () => Object.keys(TRACKS);

// A note's frequency, or NaN: "A4" is 440, "C#5", "Db5".
export function noteFreq(note) {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(note);
  if (!m) return NaN;
  const semis = NAMES[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * 2 ** ((semis - 69) / 12);
}

const arpStep = (ch) => (/\d/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 87);

// One token of a pitched voice: { freqs } for a note (one, or an arpeggio's
// cycle), "hold", "rest", or null when it is not a token.
function readToken(token) {
  if (token === "-") return "hold";
  if (token === ".") return "rest";
  const [note, arp] = token.split("^");
  const root = noteFreq(note);
  if (!Number.isFinite(root)) return null;
  if (arp === undefined) return { freqs: [root] };
  if (!/^[0-9a-c]+$/.test(arp)) return null;
  return { freqs: [...arp].map((ch) => root * 2 ** (arpStep(ch) / 12)) };
}

const tokens = (line) => line.split(/\s+/).filter((t) => t && t !== "|");

// A track turned into steps ready to book, checked as it goes: a track that
// does not read throws, which the suite catches for every listed track.
export function compileTrack(track) {
  if (!(track.bpm >= 40 && track.bpm <= 240)) throw new Error("bpm out of range");
  const voices = Object.keys(track.voices || {});
  if (!voices.length) throw new Error("no voices");
  const patterns = {};
  for (const [id, pattern] of Object.entries(track.patterns || {})) {
    let length = null;
    const lines = {};
    for (const [voice, line] of Object.entries(pattern)) {
      if (!voices.includes(voice)) throw new Error(`${id}: no voice ${voice}`);
      const steps = tokens(line);
      if (length !== null && steps.length !== length) throw new Error(`${id}: ${voice} runs ${steps.length} steps, not ${length}`);
      length = steps.length;
      const kit = Boolean(track.voices[voice].kit);
      const notes = [];
      steps.forEach((token, i) => {
        if (kit) {
          if (token !== "." && !/^[ksho]+$/.test(token)) throw new Error(`${id}: ${voice} step ${i} "${token}" is not a drum`);
          if (token !== ".") notes.push({ at: i, len: 1, drums: token });
          return;
        }
        const read = readToken(token);
        if (read === null) throw new Error(`${id}: ${voice} step ${i} "${token}" is not a note`);
        if (read === "hold") {
          if (notes.length && notes.at(-1).at + notes.at(-1).len === i) notes.at(-1).len += 1;
          return;
        }
        if (read !== "rest") notes.push({ at: i, len: 1, freqs: read.freqs });
      });
      lines[voice] = notes;
    }
    if (!length) throw new Error(`${id}: empty`);
    patterns[id] = { length, lines };
  }
  const order = track.order || [];
  if (!order.length || order.some((id) => !patterns[id])) throw new Error("order names a missing pattern");
  // The song as one list of bars: each entry a pattern and the step it starts on.
  let at = 0;
  const song = order.map((id) => {
    const part = { id, at };
    at += patterns[id].length;
    return part;
  });
  return { track, patterns, song, length: at };
}

const compiled = new Map();

function compiledTrack(name) {
  if (!compiled.has(name)) compiled.set(name, compileTrack(TRACKS[name]));
  return compiled.get(name);
}

/* --------------------------------------------------------- the voices */

const pulseWaves = new WeakMap();

// A pulse wave of `duty`, the chip square: thin at 0.125, hollow at 0.25.
function pulse(c, duty) {
  if (typeof c.createPeriodicWave !== "function") return null;
  let byDuty = pulseWaves.get(c);
  if (!byDuty) pulseWaves.set(c, (byDuty = new Map()));
  if (!byDuty.has(duty)) {
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    byDuty.set(duty, c.createPeriodicWave(real, imag));
  }
  return byDuty.get(duty);
}

// One pitched note from t for `seconds`, into `dest`.
function playNote(a, dest, voice, freqs, t, seconds) {
  const { c } = a;
  const end = t + seconds;
  const osc = c.createOscillator();
  const wave = voice.wave === "pulse" ? pulse(c, voice.duty ?? 0.5) : null;
  if (wave) osc.setPeriodicWave(wave);
  else osc.type = voice.wave === "pulse" ? "square" : voice.wave || "square";
  if (freqs.length === 1) osc.frequency.setValueAtTime(freqs[0], t);
  else for (let s = t, i = 0; s < end; s += ARP_S, i++) osc.frequency.setValueAtTime(freqs[i % freqs.length], s);
  if (voice.vibrato && seconds > (voice.vibrato.delay ?? 0)) {
    const lfo = c.createOscillator();
    const depth = c.createGain();
    lfo.frequency.value = voice.vibrato.rate;
    depth.gain.value = freqs[0] * voice.vibrato.depth;
    lfo.connect(depth);
    depth.connect(osc.frequency);
    lfo.start(t + (voice.vibrato.delay ?? 0));
    lfo.stop(end);
  }
  const gain = c.createGain();
  const peak = Math.max(FLOOR * 10, voice.gain ?? 1);
  const held = Math.max(FLOOR * 10, peak * (voice.sustain ?? 0.7));
  const release = Math.min(0.03, seconds * 0.3);
  gain.gain.setValueAtTime(FLOOR, t);
  gain.gain.linearRampToValueAtTime(peak, t + 0.004);
  gain.gain.linearRampToValueAtTime(held, t + Math.max(0.005, Math.min(seconds * 0.6, voice.decay ?? 0.06)));
  gain.gain.setValueAtTime(held, end - release);
  gain.gain.linearRampToValueAtTime(0, end);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(end + 0.01);
}

// The drum kit: a kick that drops, a snare and hats of noise.
function playDrums(a, dest, voice, hits, t) {
  const { c } = a;
  const level = voice.gain ?? 1;
  for (const hit of hits) {
    if (hit === "k") {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.11);
      gain.gain.setValueAtTime(level, t);
      gain.gain.exponentialRampToValueAtTime(FLOOR, t + 0.13);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(t);
      osc.stop(t + 0.14);
      continue;
    }
    const seconds = hit === "s" ? 0.12 : hit === "o" ? 0.16 : 0.035;
    const src = c.createBufferSource();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    src.buffer = a.noise("noise");
    filter.type = hit === "s" ? "bandpass" : "highpass";
    filter.frequency.value = hit === "s" ? 1900 : 7000;
    filter.Q.value = hit === "s" ? 0.8 : 0.7;
    gain.gain.setValueAtTime(level * (hit === "s" ? 0.8 : 0.4), t);
    gain.gain.exponentialRampToValueAtTime(FLOOR, t + seconds);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(t, Math.random() * 1.5);
    src.stop(t + seconds + 0.01);
  }
}

/* ------------------------------------------------------ the sequencer */

// The track playing now: its name, the bus it plays into, the step next to
// book and when, how hot play is, and when the game last asked for it.
let now = null;

// Tracks on their way out after the game asked for another: each keeps
// playing under its fading bus until `until`, so a change of level is a
// crossfade, not a cut.
let leaving = [];

let ticker = null;

// Where each track was, so one comes back in on the bar it left.
const positions = new Map();

// The music's own gentle compressor, straight to the speakers, as on the
// prototype pages the tracks were picked on (prototypes/music/engine.js): not
// the sounds' harder one, so a blaster shot or a crash never pushes the
// music down. One per audio context.
const musicOuts = new WeakMap();
function musicOut(a) {
  const { c } = a;
  if (typeof c.createDynamicsCompressor !== "function") return a.out;
  if (!musicOuts.has(c)) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(c.destination);
    musicOuts.set(c, comp);
  }
  return musicOuts.get(c);
}

function startTrack(a, name, rampS, volume) {
  const bus = a.c.createGain();
  bus.gain.setValueAtTime(FLOOR, a.c.currentTime);
  bus.gain.linearRampToValueAtTime(MUSIC_PEAK * volume, a.c.currentTime + rampS);
  bus.connect(musicOut(a));
  const song = compiledTrack(name);
  const was = positions.get(name) || 0;
  return { name, song, bus, step: was - (was % 16), next: a.c.currentTime + 0.05, intensity: 0, seen: 0, volume };
}

function letGo(playing, ms) {
  setTimeout(() => {
    try {
      playing.bus.disconnect();
    } catch {}
  }, ms);
}

// Quiets a track within a moment: the game paused, closed or stopped asking.
function fadeOut(a, playing) {
  if (!playing) return;
  positions.set(playing.name, playing.step % playing.song.length);
  try {
    const t = a ? a.c.currentTime : 0;
    playing.bus.gain.cancelScheduledValues(t);
    playing.bus.gain.setTargetAtTime(0, t, 0.08);
    letGo(playing, 800);
  } catch {}
}

// Fades a track out over CROSSFADE_S while it keeps playing.
function crossOut(a, playing) {
  positions.set(playing.name, playing.step % playing.song.length);
  const t = a.c.currentTime;
  const gain = playing.bus.gain;
  gain.cancelScheduledValues(t);
  gain.setValueAtTime(Math.max(FLOOR, gain.value), t);
  gain.linearRampToValueAtTime(FLOOR, t + CROSSFADE_S);
  playing.until = t + CROSSFADE_S;
  leaving.push(playing);
}

function hushAll(a) {
  fadeOut(a, now);
  now = null;
  for (const p of leaving) fadeOut(a, p);
  leaving = [];
  if (ticker) clearInterval(ticker);
  ticker = null;
}

// Books every step of `p` that falls within the lookahead.
function book(a, p) {
  const song = p.song;
  const track = song.track;
  const stepS = 60 / (track.bpm + (track.rush || 0) * p.intensity) / 4;
  // Behind by more than a beat (a stalled tab): skip ahead rather than rush
  // to catch up.
  if (p.next < a.c.currentTime - 0.25) p.next = a.c.currentTime + 0.02;
  for (let n = 0; n < 32 && p.next < a.c.currentTime + LOOKAHEAD_S; n++) {
    const at = p.step % song.length;
    const part = song.song.findLast((s) => s.at <= at);
    const pattern = song.patterns[part.id];
    const local = at - part.at;
    for (const [name, notes] of Object.entries(pattern.lines)) {
      const voice = track.voices[name];
      if (p.intensity < (voice.from ?? 0)) continue;
      for (const note of notes) {
        if (note.at !== local) continue;
        if (note.drums) playDrums(a, p.bus, voice, note.drums, p.next);
        else playNote(a, p.bus, voice, note.freqs, p.next, note.len * stepS * 0.95);
      }
    }
    p.step += 1;
    p.next += stepS;
  }
}

function tick() {
  const a = audioOut();
  if (!now || !a || !looks.sound || performance.now() - now.seen > MUSIC_HOLD_MS) {
    hushAll(a);
    return;
  }
  try {
    book(a, now);
    leaving = leaving.filter((p) => {
      if (a.c.currentTime < p.until) {
        book(a, p);
        return true;
      }
      letGo(p, 100);
      return false;
    });
  } catch {
    hushAll(a);
  }
}

// Keeps the track `name` playing for another moment at `intensity` (0 to 1,
// how hot play is: it brings voices in and pushes the tempo). Asking for a
// different track crossfades from the last one to this one over
// CROSSFADE_S. `volume` (0 to 1) scales the whole track; at 0 it is not
// asked for, so it fades out. Silence, never an error, while Play sounds is
// off or audio cannot play.
export function music(name, intensity = 0.5, volume = 1) {
  try {
    const level = Math.min(1, Math.max(0, Number(volume) || 0));
    if (!Object.hasOwn(TRACKS, name) || !looks.sound || level <= 0) return;
    const a = audioOut();
    if (!a) return;
    let ramp = 0.25;
    if (now && now.name !== name) {
      crossOut(a, now);
      now = null;
      ramp = CROSSFADE_S;
    }
    if (!now) now = startTrack(a, name, ramp, level);
    else if (now.volume !== level) {
      // A slider moved: glide there from wherever the bus is now, which
      // also cuts short a fade-in still on its way.
      const t = a.c.currentTime;
      now.bus.gain.cancelScheduledValues(t);
      now.bus.gain.setValueAtTime(Math.max(FLOOR, now.bus.gain.value), t);
      now.bus.gain.setTargetAtTime(MUSIC_PEAK * level, t, VOLUME_S);
      now.volume = level;
    }
    now.seen = performance.now();
    now.intensity = Math.min(1, Math.max(0, Number(intensity) || 0));
    if (!ticker) {
      ticker = setInterval(tick, TICK_MS);
      book(a, now);
    }
  } catch {}
}

// Quiets the music at once: the window stopped ticking a game.
export function hushMusic() {
  hushAll(audioOut());
}
