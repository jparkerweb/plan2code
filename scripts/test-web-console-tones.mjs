// Web console tests, the activities' sound engine: every chiptune track readable and playable, every tone and hum named once across tones.js and the games' own sound files, every spec well formed, every one playable through a stand-in AudioContext, hums held only while asked for, and every name a game's source asks for one that exists.
// Run with: node --test scripts/test-web-console-tones.mjs
//
// No browser: a stub AudioContext records what each sound builds.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HUM_TABLES, TONE_TABLES, hum, humNames, hushTones, tone, toneNames } from "../src/web-console/public/tones.js";
import { looks } from "../src/web-console/public/looks.js";
import { compileTrack, hushMusic, music, musicNames, noteFreq } from "../src/web-console/public/music.js";
import { MUSIC_TABLES } from "../src/web-console/public/tones.js";
import { REGIONS, ROAD_MUSIC } from "../src/web-console/public/activities/drive.js";
import { MUSIC_TRACKS } from "../src/web-console/public/activities/snake.js";
import snakeSfx from "../src/web-console/public/activities/snake-sfx.js";
import { MUSIC_TRACKS as TRAILS_TRACKS } from "../src/web-console/public/activities/trails.js";
import trailsSfx from "../src/web-console/public/activities/trails-sfx.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GAMES = path.join(ROOT, "src/web-console/public/activities");

const WAVES = new Set(["sine", "triangle", "square", "sawtooth"]);
const NOISES = new Set(["noise", "pink", "brown"]);
const FILTERS = new Set(["lowpass", "highpass", "bandpass"]);

// A stand-in context: counts the sources each sound starts and stops, and
// keeps every gain node with the ramps asked of it.
function stubAudio() {
  const made = { oscillators: 0, noises: 0, started: 0, stopped: 0, filters: 0, gains: [] };
  const param = () => ({
    value: 0,
    ramps: [],
    setValueAtTime(v, t) { this.ramps.push({ kind: "set", v, t }); },
    exponentialRampToValueAtTime(v, t) { this.ramps.push({ kind: "exp", v, t }); },
    linearRampToValueAtTime(v, t) { this.ramps.push({ kind: "linear", v, t }); },
    setTargetAtTime(v, t) { this.ramps.push({ kind: "target", v, t }); },
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  const source = (kind) => node({
    frequency: param(),
    start() { made.started += 1; },
    stop() { made.stopped += 1; },
    kind,
  });
  class Ctx {
    state = "running";
    // Two seconds pass between reads, so every sound has ended before the next.
    #clock = 0;
    get currentTime() { return (this.#clock += 2); }
    sampleRate = 8000;
    destination = node();
    resume() { return Promise.resolve(); }
    createOscillator() { made.oscillators += 1; return source("osc"); }
    createBufferSource() { made.noises += 1; return source("noise"); }
    createBuffer(_, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    createGain() { const g = node({ gain: param() }); made.gains.push(g); return g; }
    createBiquadFilter() { made.filters += 1; return node({ frequency: param(), Q: param(), type: "" }); }
    createDynamicsCompressor() { return node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }); }
  }
  return { Ctx, made };
}

// tones.js keeps the first context it makes, so the whole file shares one.
const AUDIO = stubAudio();

const partsOf = (spec) => (spec.layers ? spec.layers : spec.notes ? spec.notes.map(() => spec) : [spec]);

test("every tone and hum is named once across tones.js and every game's sound file", () => {
  const seen = new Map();
  for (const tables of [TONE_TABLES, HUM_TABLES]) {
    for (const table of tables) {
      for (const name of Object.keys(table)) {
        assert.ok(!seen.has(name), `${name} is defined twice`);
        seen.set(name, true);
      }
    }
  }
  assert.ok(toneNames().length > 100, "the kit and the old blips");
  assert.ok(humNames().includes("car"), "and the hums");
});

test("every tone is well formed: a known wave or noise, a sane length, a filter of a known kind", () => {
  for (const name of toneNames()) {
    const spec = TONE_TABLES.find((t) => Object.hasOwn(t, name))[name];
    assert.ok(Object.isFrozen(spec), `${name} is frozen`);
    for (const p of partsOf(spec)) {
      assert.ok(WAVES.has(p.type) || (spec.layers && NOISES.has(p.type)), `${name}: ${p.type} is a wave, or a noise in a layered tone`);
      // (a tiny tolerance: 0.1 + 1.1 is 1.2000000000000002 in floating point)
      assert.ok(p.seconds > 0 && p.seconds + (p.delay || 0) <= 1.2 + 1e-9, `${name} is over within 1.2 s`);
      if (WAVES.has(p.type)) assert.ok(p.notes ? p.notes.every((f) => f > 0) : p.from > 0 && p.to > 0, `${name} has its pitches`);
      if (p.filter) assert.ok(FILTERS.has(p.filter.type) && p.filter.from > 0, `${name}'s filter is known`);
      if (p.gain !== undefined) assert.ok(p.gain > 0 && p.gain <= 1, `${name}'s part gain is a share`);
    }
  }
});

test("every hum is well formed: parts or noise, a positive peak, quiet enough to sit under the page", () => {
  for (const name of humNames()) {
    const spec = HUM_TABLES.find((t) => Object.hasOwn(t, name))[name];
    assert.ok((spec.parts && spec.parts.length) || spec.noise, `${name} makes a sound`);
    for (const p of spec.parts || []) assert.ok(WAVES.has(p.type) && p.freq > 0, `${name}'s parts are waves`);
    if (spec.noise) assert.ok(NOISES.has(spec.noise.color), `${name}'s noise is a known color`);
    if (spec.filter) assert.ok(FILTERS.has(spec.filter.type) && spec.filter.freq > 0, `${name}'s filter is known`);
    assert.ok(spec.peak > 0 && spec.peak <= 0.08, `${name} peaks at most as loud as a blip`);
  }
});

test("every tone plays through a full AudioContext, one source per part, and never throws", () => {
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  const { Ctx, made } = AUDIO;
  globalThis.AudioContext = Ctx;
  try {
    looks.sound = true;
    for (const name of toneNames()) {
      const spec = TONE_TABLES.find((t) => Object.hasOwn(t, name))[name];
      const before = made.oscillators + made.noises;
      tone(name, 0.7, 1.2);
      const vibratos = partsOf(spec).filter((p) => p.vibrato && WAVES.has(p.type)).length;
      assert.equal(made.oscillators + made.noises - before, partsOf(spec).length + vibratos, `${name} starts a source per part`);
    }
    looks.sound = false;
    const before = made.oscillators + made.noises;
    tone("explode");
    assert.equal(made.oscillators + made.noises, before, "Play sounds off: silence");
  } finally {
    looks.sound = saved.sound;
    globalThis.AudioContext = saved.ctor;
  }
});

test("a hum starts once, follows each call without starting more, and goes quiet when hushed or Play sounds is off", async () => {
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  const { Ctx, made } = AUDIO;
  globalThis.AudioContext = Ctx;
  try {
    looks.sound = true;
    hushTones();
    const start = made.started;
    hum("you", "car", 0.5, 1);
    const one = made.started - start;
    assert.ok(one >= 3, "the car's oscillators, its noise and its pulse");
    for (let i = 0; i < 10; i++) hum("you", "car", 0.6, 1 + i / 10);
    assert.equal(made.started - start, one, "revving it starts nothing new");
    hum("rival", "car", 0.3, 1);
    assert.equal(made.started - start, one * 2, "a second id is its own voice");
    hum("you", "toycar", 0.3, 1);
    assert.ok(made.stopped >= one, "a new name restarts the voice");
    const stoppedBefore = made.stopped;
    hushTones();
    assert.ok(made.stopped > stoppedBefore, "hushed");
    hum("again", "nope");
    looks.sound = false;
    const s = made.started;
    hum("you", "car");
    assert.equal(made.started, s, "Play sounds off: no hum");
    looks.sound = true;
    hum("held", "wind");
    const st = made.stopped;
    await new Promise((r) => setTimeout(r, 320));
    assert.ok(made.stopped > st, "a hum not asked for again fades by itself");
  } finally {
    hushTones();
    looks.sound = saved.sound;
    globalThis.AudioContext = saved.ctor;
  }
});

test("every tone or hum a game's source names is one the engine has", () => {
  const tones = new Set(toneNames());
  const hums = new Set(humNames());
  for (const file of fs.readdirSync(GAMES).filter((f) => f.endsWith(".js") && !f.endsWith("-sfx.js"))) {
    const source = fs.readFileSync(path.join(GAMES, file), "utf8");
    for (const m of source.matchAll(/\btone\(\s*"(\w+)"/g)) assert.ok(tones.has(m[1]), `${file}: tone "${m[1]}" exists`);
    for (const m of source.matchAll(/\bhum\([^,()]+,\s*"(\w+)"/g)) assert.ok(hums.has(m[1]), `${file}: hum "${m[1]}" exists`);
  }
});

/* ---------------------------------------------------------------- music */

const trackOf = (name) => MUSIC_TABLES.find((t) => Object.hasOwn(t, name))[name];

test("music: notes read as their pitch, sharps and flats included", () => {
  assert.equal(noteFreq("A4"), 440);
  assert.ok(Math.abs(noteFreq("C#5") - 554.37) < 0.01);
  assert.equal(noteFreq("Db5"), noteFreq("C#5"));
  assert.ok(Math.abs(noteFreq("A3") - 220) < 1e-9);
  assert.ok(Number.isNaN(noteFreq("H2")));
});

test("music: every track reads, with known waves, shares for gains and a start for each voice", () => {
  assert.ok(musicNames().length >= 1, "at least one track");
  for (const name of musicNames()) {
    const track = trackOf(name);
    const song = compileTrack(track);
    assert.ok(song.length >= 16, `${name} runs a bar at least`);
    for (const [v, voice] of Object.entries(track.voices)) {
      assert.ok(voice.kit || ["pulse", "triangle", "sine", "square", "sawtooth"].includes(voice.wave), `${name}.${v} has a known wave`);
      assert.ok((voice.gain ?? 1) > 0 && (voice.gain ?? 1) <= 1, `${name}.${v}'s gain is a share`);
      assert.ok((voice.from ?? 0) >= 0 && (voice.from ?? 0) <= 1, `${name}.${v} comes in between 0 and 1`);
    }
  }
});

test("music: a track that does not read is turned away", () => {
  const ok = { bpm: 120, voices: { a: { wave: "pulse" } }, patterns: { A: { a: "A4 - . C5" } }, order: ["A"] };
  assert.equal(compileTrack(ok).length, 4);
  assert.throws(() => compileTrack({ ...ok, bpm: 900 }), /bpm/);
  assert.throws(() => compileTrack({ ...ok, patterns: { A: { a: "A4 - . Z9" } } }), /not a note/);
  assert.throws(() => compileTrack({ ...ok, voices: { a: { wave: "pulse" }, b: { kit: true } }, patterns: { A: { a: "A4 - . C5", b: "k ." } } }), /steps/);
  assert.throws(() => compileTrack({ ...ok, voices: { a: { wave: "pulse" }, b: { kit: true } }, patterns: { A: { a: "A4 - . C5", b: "k . x ." } } }), /not a drum/);
  assert.throws(() => compileTrack({ ...ok, order: ["B"] }), /missing pattern/);
  const arp = compileTrack({ ...ok, patterns: { A: { a: "A3^037 - - ." } } });
  assert.equal(arp.patterns.A.lines.a[0].freqs.length, 3, "an arpeggio cycles three notes");
  assert.equal(arp.patterns.A.lines.a[0].len, 3, "held for three steps");
});

test("music: a track in another meter sets its bar, and a pattern that is not whole bars is turned away", () => {
  const steps = (n) => Array(n).fill(".").join(" ");
  const ok = { bpm: 120, bar: 12, voices: { a: { wave: "pulse" } }, patterns: { A: { a: steps(24) } }, order: ["A"] };
  assert.equal(compileTrack(ok).length, 24, "two bars of 6/8");
  assert.throws(() => compileTrack({ ...ok, patterns: { A: { a: steps(16) } } }), /whole bars/);
  assert.throws(() => compileTrack({ ...ok, bar: 2 }), /bar/);
  assert.throws(() => compileTrack({ ...ok, bar: 100 }), /bar/);
  assert.equal(compileTrack({ ...ok, bar: undefined, patterns: { A: { a: steps(16) } } }).length, 16, "no bar: sixteen steps, as before");
});

test("music: a track plays notes while asked for, quiets when hushed, and stays silent while Play sounds is off", () => {
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  const { Ctx, made } = AUDIO;
  globalThis.AudioContext = Ctx;
  try {
    looks.sound = true;
    const name = musicNames()[0];
    const before = made.started;
    music(name, 1);
    assert.ok(made.started > before, "notes booked at once");
    music("nope", 1);
    hushMusic();
    looks.sound = false;
    const quiet = made.started;
    music(name, 1);
    assert.equal(made.started, quiet, "Play sounds off: no music");
  } finally {
    hushMusic();
    looks.sound = saved.sound;
    globalThis.AudioContext = saved.ctor;
  }
});

test("music: plays through its own gentle compressor (as on the prototype pages), never the sounds' harder one", () => {
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  const { Ctx } = AUDIO;
  const proto = Ctx.prototype;
  const was = { gain: proto.createGain };
  const buses = [];
  // Each node remembers what it is connected to.
  const wired = (n) => Object.assign(n, { to: [], connect(x) { n.to.push(x); } });
  proto.createGain = function () { const g = wired(was.gain.call(this)); buses.push(g); return g; };
  globalThis.AudioContext = Ctx;
  try {
    hushMusic();
    looks.sound = true;
    music(musicNames()[0], 1);
    // The compressor is made once per context, maybe before this test, so
    // it is found through the track's bus rather than by being watched.
    const isComp = (x) => x && x.threshold && x.ratio;
    const bus = buses.find((g) => g.to.some(isComp));
    assert.ok(bus, "the track's bus feeds a compressor");
    const comp = bus.to.find(isComp);
    assert.equal(comp.threshold.value, -14, "the prototype pages' threshold, not the sounds' -20");
    assert.equal(comp.ratio.value, 4);
  } finally {
    hushMusic();
    proto.createGain = was.gain;
    looks.sound = saved.sound;
    globalThis.AudioContext = saved.ctor;
  }
});

test("music: a new track crossfades in over seconds while the last keeps playing, and a hush cuts both", () => {
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  const { Ctx, made } = AUDIO;
  globalThis.AudioContext = Ctx;
  try {
    looks.sound = true;
    const [first, second] = musicNames();
    hushMusic();
    const mark = made.gains.length;
    music(first, 1);
    const firstBus = made.gains.slice(mark).find((g) => g.gain.ramps.some((r) => r.kind === "linear" && r.v > 0.1));
    const at = made.gains.length;
    music(second, 1);
    const out = firstBus.gain.ramps.at(-1);
    const from = firstBus.gain.ramps.at(-2);
    assert.equal(out.kind, "linear", "the last track ramps down, not cut");
    assert.ok(out.v < 0.001 && out.t - from.t >= 2, "over seconds");
    const secondBus = made.gains[at];
    const up = secondBus.gain.ramps.find((r) => r.kind === "linear");
    assert.ok(up.v > 0.1 && up.t - secondBus.gain.ramps[0].t >= 2, "the new track ramps up over the same seconds");
    hushMusic();
    assert.equal(secondBus.gain.ramps.at(-1).kind, "target", "a hush fades the new track at once");
  } finally {
    hushMusic();
    looks.sound = saved.sound;
    globalThis.AudioContext = saved.ctor;
  }
});

test("music: every track a game's source asks for is one the sequencer has", () => {
  const tracks = new Set(musicNames());
  for (const file of fs.readdirSync(GAMES).filter((f) => f.endsWith(".js") && !f.endsWith("-sfx.js"))) {
    const source = fs.readFileSync(path.join(GAMES, file), "utf8");
    for (const m of source.matchAll(/\bmusic\(\s*"(\w+)"/g)) assert.ok(tracks.has(m[1]), `${file}: track "${m[1]}" exists`);
  }
});

test("music: the volume scales the track's level, a change glides there, and a volume of 0 plays nothing", () => {
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  const { Ctx, made } = AUDIO;
  globalThis.AudioContext = Ctx;
  try {
    looks.sound = true;
    const [first, second] = musicNames();
    hushMusic();
    const peak = (volume) => {
      hushMusic();
      const mark = made.gains.length;
      music(first, 1, volume);
      return made.gains.slice(mark).find((g) => g.gain.ramps.some((r) => r.kind === "linear" && r.v > 0.01));
    };
    const full = peak(1).gain.ramps.find((r) => r.kind === "linear").v;
    const bus = peak(0.5);
    assert.ok(Math.abs(bus.gain.ramps.find((r) => r.kind === "linear").v - full / 2) < 1e-9, "half the volume, half the level");
    music(first, 1, 0.25);
    const glide = bus.gain.ramps.at(-1);
    assert.equal(glide.kind, "target", "a slider move glides");
    assert.ok(Math.abs(glide.v - full / 4) < 1e-9, "to the new level");
    hushMusic();
    const quiet = made.started;
    music(second, 1, 0);
    assert.equal(made.started, quiet, "a volume of 0: nothing booked");
  } finally {
    hushMusic();
    looks.sound = saved.sound;
    globalThis.AudioContext = saved.ctor;
  }
});

test("music: Snake lists exactly the tracks it has, each a real track that no other game defines", () => {
  const tracks = new Set(musicNames());
  assert.deepEqual([...MUSIC_TRACKS].sort(), Object.keys(snakeSfx.music).sort(), "the game lists the tracks its sound file has");
  for (const name of MUSIC_TRACKS) {
    assert.ok(tracks.has(name), `track "${name}" exists`);
    assert.equal(MUSIC_TABLES.filter((t) => Object.hasOwn(t, name)).length, 1, `${name} is defined once`);
  }
});

test("music: Light Trails lists exactly the tracks it has, each a real track that no other game defines, enough for every arena", () => {
  const tracks = new Set(musicNames());
  assert.deepEqual([...TRAILS_TRACKS].sort(), Object.keys(trailsSfx.music).sort(), "the game lists the tracks its sound file has");
  assert.ok(TRAILS_TRACKS.length >= 9, "nine arenas, none hearing a track twice");
  for (const name of TRAILS_TRACKS) {
    assert.ok(tracks.has(name), `track "${name}" exists`);
    assert.equal(MUSIC_TABLES.filter((t) => Object.hasOwn(t, name)).length, 1, `${name} is defined once`);
  }
});

test("music: every Sunset Drive road has a song, and every song is a real track", () => {
  const tracks = new Set(musicNames());
  assert.deepEqual(Object.keys(ROAD_MUSIC).sort(), Object.keys(REGIONS).sort(), "a song for every road");
  for (const [road, name] of Object.entries(ROAD_MUSIC)) {
    assert.ok(Object.hasOwn(REGIONS, road), `road ${road} exists`);
    assert.ok(tracks.has(name), `${road}: track "${name}" exists`);
  }
});
