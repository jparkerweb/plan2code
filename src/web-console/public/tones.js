// Plan2Code Web Console - the tones: short synthesized blips for the activities, silent when Play sounds is off; defines only.

import { looks } from "./looks.js";

/* ------------------------------------------------------------- tones

   Blips made in the browser, so there is no audio file to fetch. They are
   not the main sounds in sound.js: the master Play sounds switch gates them,
   and they have no switch of their own and no queue. A browser will not
   make noise before the person has touched the page, so unlockTones() runs
   from the click that opens Activities. A tone asked for before that stays
   silent rather than throwing.

   Every sound here is short (a quarter second at most) and quiet, so a cue
   never outlasts the moment it belongs to. A tone either sweeps from one
   pitch to another, or plays `notes` one after another in its time. */
const TONES = Object.freeze({
  eat: Object.freeze({ type: "triangle", from: 660, to: 880, seconds: 0.12 }),
  crash: Object.freeze({ type: "sawtooth", from: 220, to: 80, seconds: 0.2 }),
  // The 3, 2, 1 before a round starts or plays on: a tick per number, then a
  // higher one as play begins.
  count: Object.freeze({ type: "sine", from: 440, to: 440, seconds: 0.08 }),
  go: Object.freeze({ type: "sine", from: 880, to: 880, seconds: 0.14 }),
  // Mini golf: the club on the ball, the ball off a wall or a bumper, into
  // the cup, a hole in one (a little three-note rise), and into the water.
  putt: Object.freeze({ type: "triangle", from: 520, to: 400, seconds: 0.06 }),
  wall: Object.freeze({ type: "triangle", from: 300, to: 200, seconds: 0.07 }),
  bump: Object.freeze({ type: "sine", from: 700, to: 1000, seconds: 0.09 }),
  cup: Object.freeze({ type: "triangle", from: 520, to: 1040, seconds: 0.16 }),
  ace: Object.freeze({ type: "triangle", notes: Object.freeze([523, 659, 784]), seconds: 0.24 }),
  splash: Object.freeze({ type: "sine", from: 420, to: 120, seconds: 0.2 }),
  // Mini golf's gags: a power-up grabbed (a sparkly rise), a tunnel's whoosh,
  // a cannonball putt, the ball into lava, and the ball down the pit.
  power: Object.freeze({ type: "square", notes: Object.freeze([784, 988, 1319]), seconds: 0.18 }),
  tunnel: Object.freeze({ type: "sine", from: 200, to: 900, seconds: 0.16 }),
  boom: Object.freeze({ type: "sawtooth", from: 160, to: 45, seconds: 0.22 }),
  sizzle: Object.freeze({ type: "sawtooth", from: 900, to: 300, seconds: 0.2 }),
  fall: Object.freeze({ type: "sine", from: 700, to: 60, seconds: 0.25 }),
  // Mini golf's swing: the meter starting, a putt caught in the MAX band (a
  // bright two-note hit), and an overswing's sour buzz.
  swing: Object.freeze({ type: "square", from: 620, to: 660, seconds: 0.04 }),
  max: Object.freeze({ type: "square", notes: Object.freeze([880, 1320]), seconds: 0.16 }),
  shank: Object.freeze({ type: "sawtooth", from: 240, to: 110, seconds: 0.18 }),
  // Snake's extras: a combo's quick chirp, a coin, a mystery box opening, a
  // new level (a four-note climb), a shield taking a hit, a comet cutting
  // the tail, and a new best mid-round. A grabbed power-up uses `power`, a
  // smashed rock `boom` and a portal `tunnel`.
  combo: Object.freeze({ type: "square", from: 880, to: 1320, seconds: 0.07 }),
  coin: Object.freeze({ type: "square", notes: Object.freeze([988, 1319]), seconds: 0.1 }),
  mystery: Object.freeze({ type: "triangle", notes: Object.freeze([392, 523, 466, 698]), seconds: 0.24 }),
  levelup: Object.freeze({ type: "square", notes: Object.freeze([523, 659, 784, 1047]), seconds: 0.25 }),
  shield: Object.freeze({ type: "sine", from: 1200, to: 500, seconds: 0.14 }),
  zap: Object.freeze({ type: "sawtooth", from: 1400, to: 200, seconds: 0.15 }),
  best: Object.freeze({ type: "triangle", notes: Object.freeze([784, 988, 1175, 1568]), seconds: 0.25 }),
});

// Peak gain, kept modest so a blip sits under the page rather than over it.
const PEAK = 0.08;

// A quick attack avoids a click at the start; the decay is exponential, which
// needs a non-zero floor, so the envelope stops at a tiny value, not zero.
const ATTACK = 0.01;
const FLOOR = 0.0001;

let ctx = null;

// Made on first use, not at load, so importing this file in Node is harmless.
// A missing AudioContext or a constructor that throws both give null.
function audioContext() {
  if (ctx) return ctx;
  if (typeof globalThis.AudioContext === "undefined") return null;
  try {
    ctx = new globalThis.AudioContext();
  } catch {
    ctx = null;
  }
  return ctx;
}

// Called from the click that opens Activities. A browser keeps a new context
// suspended until a gesture, and a rejected resume is not an error the page
// can act on, so every failure is swallowed.
export function unlockTones() {
  try {
    const c = audioContext();
    if (c) Promise.resolve(c.resume()).catch(() => {});
  } catch {}
}

// One oscillator from t0 for `seconds`, sweeping from one pitch to another.
function blip(c, type, from, to, t0, seconds, peak) {
  const end = t0 + seconds;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  osc.frequency.exponentialRampToValueAtTime(to, end);
  gain.gain.setValueAtTime(FLOOR, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + ATTACK);
  gain.gain.exponentialRampToValueAtTime(FLOOR, end);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(end);
}

// Plays one named blip, at `level` (0 to 1) of the usual loudness: a soft
// putt sounds soft. An unknown name, Play sounds off, or a context that is
// missing, suspended or closed all mean silence, not an error.
export function tone(name, level = 1) {
  try {
    const spec = Object.hasOwn(TONES, name) ? TONES[name] : null;
    if (!spec || !looks.sound) return;
    const c = audioContext();
    if (!c || c.state !== "running") return;
    const peak = Math.max(FLOOR * 10, PEAK * Math.min(1, Number(level) || 0));
    const t0 = c.currentTime;
    if (!spec.notes) return blip(c, spec.type, spec.from, spec.to, t0, spec.seconds, peak);
    const each = spec.seconds / spec.notes.length;
    spec.notes.forEach((f, i) => blip(c, spec.type, f, f, t0 + i * each, each, peak));
  } catch {}
}
