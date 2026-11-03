// Web console tests, Ghoul Rush: the game contract, running, jumping and the one-way shelves, the pits, the blaster, each monster, the chain, the power-ups, the key and the door, the bosses, a hit and the moment safe after it, the memo, every room's layout, the pills, the banners, the still layers, and a bot that plays the house, and its sounds.
// Run with: node --test scripts/test-web-console-activities-ghoul.mjs
//
// No browser and no server: the game draws only through the canvas it is
// handed, so stub canvases that count or record calls stand in for the page.
// The rules are plain functions over a round, driven here slice by slice.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import { skipStory as storySkip } from "../src/web-console/public/activities/ghoul-story.js";
import { BANNER_SHADE, CHUNK, GAUGE_COOL, GAUGE_HOT, GAUGE_WARM, LOOKS, SEAM, VOICES, contrast, gaugeColor, hudLayout, labelSpot, limbInk } from "../src/web-console/public/activities/ghoul-draw.js";
import { ACCENTS } from "../src/web-console/public/palette.js";
import { humNames, toneNames } from "../src/web-console/public/tones.js";
import ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";
import { LIVES, LIVES_BACK, LIVES_INK, livesText } from "../src/web-console/public/activities/pills.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
// The blips this game added to tones.js.
const GHOUL_TONES = Object.freeze(["ghoulBlast", "ghoulStomp", "ghoulBoo", "ghoulRoar", "ghoulCandy", "zombiePop", "zombieGroan", "batSwoop", "doorUnlock", "doorThrough", "creakBoard", "ghoulGrowl", "ghoulShriek", "ghoulSkitter", "ghoulSpit", "ghoulThunder"]);
const steady = () => 0.5;

// Past the intro story at once (it has its own tests): a run opens on it, and the tests that play from the hall skip it.
function skipStory(g) {
  if (g.round.phase !== "story") return;
  storySkip(g.round);
  g.tick(0);
}

/* ------------------------------------------------------------ canvases */

// A 2D context whose every method is a no-op that counts itself.
function stubCanvas() {
  const calls = { count: 0 };
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : () => { calls.count += 1; }),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, calls };
}

// A 2D context that records where each strip in a banner's shade is filled
// (its top and height), and does nothing else.
function bannerCanvas(shade) {
  const shades = [];
  const ctx = new Proxy({}, {
    get: (t, name) => (name === "fillRect" ? (x, y, w, h) => t.fillStyle === shade && shades.push([y, h]) : name in t ? t[name] : () => {}),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, shades };
}

// A 2D context that keeps the style each fill used.
function styleCanvas() {
  const fills = [];
  const ctx = new Proxy({}, {
    get: (target, name) => {
      if (name === "fill" || name === "fillRect") return () => fills.push(target.fillStyle);
      return name in target ? target[name] : () => {};
    },
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, fills };
}

// A 2D context that keeps every method name it was called with, and answers
// the few calls the still layers need.
function recordingCanvas() {
  const names = [];
  const target = { getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }), measureText: () => ({ width: 50 }) };
  const ctx = new Proxy(target, {
    get: (t, name) => (name in t ? t[name] : () => { names.push(name); }),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const canvas = { width: 800, height: 600, getContext: () => ctx };
  ctx.canvas = canvas;
  return { canvas, names };
}

// A 2D context that keeps every text drawn, with the font it was drawn in.
function textCanvas() {
  const texts = [];
  let font = "";
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push([String(text), font]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { if (name === "font") font = value; target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, texts };
}

// The page's tokens in light and dark, for readColors() through a stubbed
// getComputedStyle.
const THEME_TOKENS = Object.freeze({
  light: Object.freeze({ "--panel": "#ffffff", "--panel-2": "#fbf9f6", "--rule": "#e4ddd1", "--accent": "#206cc3", "--ink": "#1d1a17" }),
  dark: Object.freeze({ "--panel": "#201d1a", "--panel-2": "#262220", "--rule": "#332e29", "--accent": "#619fe5", "--ink": "#f0ece5" }),
});

// "#rrggbb" or "rgb(a)(...)" as [r, g, b, a], and the WCAG contrast of two.
function rgbaOf(color) {
  const hex = /^#([0-9a-f]{6})$/i.exec(color);
  if (hex) return [0, 2, 4].map((k) => parseInt(hex[1].slice(k, k + 2), 16)).concat(1);
  const [r, g, b, a = 1] = /rgba?\(([^)]*)\)/.exec(color)[1].split(",").map(Number);
  return [r, g, b, a];
}
const toHex = (rgb) => `#${rgb.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
const overColor = (top, alpha, base) => top.slice(0, 3).map((v, i) => v * alpha + base[i] * (1 - alpha));
function wcag(a, b) {
  const lum = (c) => {
    const [r, g, bl] = rgbaOf(c).slice(0, 3).map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// A 2D context that keeps, for each pill it draws (a rounded fill, perhaps
// a timer's rounded tint, then the text with no dark edge), the text's
// color, the backing composited over `board` and each tint over that.
function pillCanvas(board) {
  const drawn = [];
  let since = [];
  const target = { globalAlpha: 1, getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }), measureText: () => ({ width: 50 }) };
  const ctx = new Proxy(target, {
    get: (t, name) => {
      if (name in t) return t[name];
      if (name === "roundRect") return () => since.push({ k: "round" });
      if (name === "fill") return () => since.push({ k: "fill", style: t.fillStyle, alpha: t.globalAlpha });
      if (name === "fillText") return (text) => { drawn.push({ text: String(text), ink: t.fillStyle, since }); since = []; };
      if (name === "strokeText" || name === "fillRect" || name === "stroke") return () => since.push({ k: name });
      return () => {};
    },
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const canvas = { width: 900, height: 900, getContext: () => ctx };
  ctx.canvas = canvas;
  const pills = () => drawn.flatMap(({ text, ink, since: seq }) => {
    if (seq.some((e) => e.k === "strokeText") || seq.at(-1)?.k !== "fill") return [];
    const fills = seq.filter((e, i) => e.k === "fill" && seq[i - 1]?.k === "round");
    const back = fills.find((e) => e.alpha === 1);
    if (!back) return [];
    const b = rgbaOf(back.style);
    const backing = toHex(overColor(b, b[3], rgbaOf(board)));
    const tints = fills.slice(fills.indexOf(back) + 1).map((e) => {
      const c = rgbaOf(e.style);
      return toHex(overColor(c, e.alpha * c[3], rgbaOf(backing)));
    });
    return [{ text, ink, backing, tints }];
  });
  return { canvas, pills, reset: () => { drawn.length = 0; since = []; } };
}

// Runs `fn` with getComputedStyle answering `values`.
function withTokens(values, fn) {
  const saved = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => values[name] || "" });
  try {
    return fn();
  } finally {
    if (saved === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = saved;
  }
}

/* ---------------------------------------------------------- round helpers */

// Past a stage's intro card at once (the card has its own tests).
// Leaves a stage's intro card or a boss room's (phase "intro" or "bossintro").
function skipIntro(round) {
  if (round.phase !== "intro" && round.phase !== "bossintro") return;
  round.introMs = ghoul.INTRO_MIN_MS;
  ghoul.takeIntro(round);
}

// Goes through the door of the room the round is in.
function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the room `id`, reached the way play reaches it (out of the
// hall, its stage picked, the stage's rooms before it gone through),
// `depth` stages already cleared, nothing woken unless a test says so:
// every spawner spent, the bonus clock still.
function ghoulRound(id = "foyer", depth = 0) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  for (let i = 0; i < depth; i++) round.cleared.push(`cleared${i}`);
  if (id !== "hall") {
    const st = ghoul.STAGES.find((s) => s.rooms.includes(id));
    through(round);
    assert.equal(round.phase, "pick");
    round.offer = [st.id];
    round.phaseMs = 0;
    ghoul.pickStage(round, 0);
    while (round.spec.id !== id) through(round);
  }
  round.phase = "play";
  quiet(round);
  round.events.length = 0;
  return round;
}

// Spends every spawner and holds the horde back, so nothing else wakes.
function quiet(round) {
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  return round;
}

// Puts you standing on the ground (or shelf `shelf`) at `x`.
function standAt(round, x, shelf = -1) {
  const y = shelf >= 0 ? round.spec.shelves[shelf][2] : ghoul.groundAt(round.spec, x);
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, cuttable: false, out: 0, safeMs: 0 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

// A monster of `kind` standing on the ground at `x`, awake and ready.
function put(round, kind, x, over = {}) {
  return ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), { rise: 0, awake: true, ...over });
}

const events = (round, type) => round.events.filter((e) => e.type === type);

// Holds `keys` for `ms`, slice by slice.
function hold(round, keys, ms) {
  Object.assign(round.input, keys);
  ghoul.advance(round, ms, steady);
  for (const k of Object.keys(keys)) round.input[k] = typeof keys[k] === "number" ? 0 : false;
}

// Plays a jump from where you stand until you land: its top and its time.
function jumpOnce(round, up = true) {
  const you = round.you;
  const y0 = you.y;
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  round.input.up = up;
  let top = y0;
  let ms = 0;
  for (; ms < 3000 && (ms === 0 || you.state === "air"); ms += 4) {
    ghoul.advance(round, 4, steady);
    top = Math.max(top, you.y);
  }
  round.input.up = false;
  return { rise: top - y0, ms };
}

/* ---------------------------------------------------------------- contract */

test("Ghoul Rush answers the game contract: ready until started, pause and resume, keys, a tick moves it, a tiny board is refused, and onScore once at the end", () => {
  assert.equal(ghoul.default.id, "ghoul");
  assert.equal(ghoul.default.title, "Ghoul Rush");
  assert.ok(Object.isFrozen(ghoul.default));
  assert.equal("lowerIsBetter" in ghoul.default, false);
  const { canvas, calls } = stubCanvas();
  const scores = [];
  const g = ghoul.default.create({ canvas, tone: () => {}, onScore: (n) => scores.push(n) });
  assert.equal(g.state, "ready");
  assert.equal(typeof g.score, "number");
  g.pause();
  g.resume();
  g.tick(10_000);
  assert.equal(g.state, "ready", "nothing before a start");
  assert.equal(g.resize(1, 1), false, "a tiny board is refused");
  assert.equal(g.resize(ghoul.W * ghoul.MIN_CELL - 1, 2000), false, "just too narrow");
  assert.equal(g.resize(ghoul.W * ghoul.MIN_CELL, ghoul.H * ghoul.MIN_CELL), true, "just big enough");
  assert.equal(g.resize(2000, 2000), true);
  g.start();
  skipStory(g);
  g.round.dice = 0;
  assert.equal(g.state, "running");
  g.pause();
  assert.equal(g.state, "paused");
  const before = { score: g.score, calls: calls.count, x: g.round.you.x };
  g.tick(10_000);
  assert.deepEqual({ score: g.score, calls: calls.count, x: g.round.you.x }, before, "ticks while paused change nothing");
  g.resume();
  assert.equal(g.state, "running");
  for (const name of ["up", "down", "left", "right", "action"]) assert.equal(g.key(name), true, `${name} is used`);
  assert.equal(g.key("jump"), false, "an unknown key is not");
  const drawn = calls.count;
  g.tick(16);
  assert.ok(calls.count > drawn, "a tick draws");
  g.round.lives = 1;
  ghoul.lose(g.round, "zombie");
  for (let ms = 0; ms < ghoul.CRASH_MS + 200 && g.state === "running"; ms += 16) g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score], "onScore once, with the score");
  g.tick(1000);
  g.key("left");
  assert.equal(scores.length, 1);
  g.key("action");
  assert.equal(g.state, "running", "space starts the next round at once");
  assert.equal(g.round.lives, ghoul.START_LIVES);
});

/* ---------------------------------------------------------------- moving */

test("Ghoul Rush: running holds RUN_SPEED and stops at once, a jump rises 12 units and lands in about 0.61 s, and letting up go early cuts it to a short hop", () => {
  const round = ghoulRound();
  const you = round.you;
  standAt(round, 20);
  hold(round, { right: true }, 500);
  assert.ok(Math.abs(you.x - (20 + ghoul.RUN_SPEED / 2)) < 0.1, `ran ${(you.x - 20).toFixed(2)} in half a second`);
  const x = you.x;
  ghoul.advance(round, 100, steady);
  assert.equal(you.x, x, "and stopped the moment it was let go");
  assert.ok(Math.abs(ghoul.JUMP_TOP - 12) < 0.1);
  const full = jumpOnce(round, true);
  assert.ok(Math.abs(full.rise - ghoul.JUMP_TOP) < 0.2, `up ${full.rise.toFixed(2)}`);
  assert.ok(full.ms > 580 && full.ms < 650, `down in ${full.ms} ms`);
  const hop = jumpOnce(round, false);
  assert.ok(hop.rise < full.rise / 2, `a tap is a short hop (${hop.rise.toFixed(2)})`);
  assert.ok(Math.abs(ghoul.jumpHeightAt(0)) < 1e-9 && ghoul.jumpHeightAt(ghoul.RUN_SPEED * (ghoul.JUMP_V / ghoul.GRAVITY)) > 11, "jumpHeightAt follows the arc");
});

test("Ghoul Rush: a jump pressed within COYOTE_MS of running off an edge still leaves it, a later one does not, and one pressed just before landing jumps as you land", () => {
  const offEdge = (waitMs) => {
    const round = ghoulRound("gallery");
    const you = round.you;
    standAt(round, 96);
    round.input.right = true;
    while (you.state === "run") ghoul.advance(round, 4, steady);
    ghoul.advance(round, waitMs, steady);
    round.input.jump = 4;
    round.input.up = true;
    ghoul.advance(round, 4, steady);
    return you.vy;
  };
  assert.ok(offEdge(ghoul.COYOTE_MS - 30) > 0, "a moment after the edge, it jumps");
  assert.ok(offEdge(ghoul.COYOTE_MS + 30) < 0, "later, it falls");
  const round = ghoulRound();
  const you = round.you;
  standAt(round, 40);
  Object.assign(you, { state: "air", y: 6.6, vy: -10 });
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  round.input.up = true;
  for (let k = 0; k < 40 && you.vy <= 0; k++) ghoul.advance(round, 4, steady);
  assert.ok(you.vy > 0, "the early press jumped on landing");
});

test("Ghoul Rush: shelves are one way (jumped up through from below, landed on from above, dropped through with down), a small step is walked, a tall one is a wall, and no fall goes through a surface", () => {
  const round = ghoulRound();
  const you = round.you;
  const shelf = round.spec.shelves.findIndex(([x0, x1, y]) => y === 15 && x0 === 60);
  const [x0, x1, top] = round.spec.shelves[shelf];
  standAt(round, (x0 + x1) / 2);
  jumpOnce(round);
  assert.deepEqual([you.state, you.shelf, you.y], ["run", shelf, top], "up through it and onto it");
  hold(round, { down: true }, 40);
  assert.equal(you.state, "air", "down drops through");
  ghoul.advance(round, 800, steady);
  assert.deepEqual([you.shelf, you.y], [-1, ghoul.groundAt(round.spec, you.x)], "back on the floor");
  // The Foyer's stairs climb in steps of 2.5: walked.
  standAt(round, 140);
  hold(round, { right: true }, 1200);
  assert.equal(you.y, 13.5, "up the stairs to the landing");
  // The Kitchen's counter is 5 up: a wall until jumped.
  const kitchen = ghoulRound("kitchen");
  standAt(kitchen, 60);
  hold(kitchen, { right: true }, 600);
  assert.ok(kitchen.you.x < 70 && kitchen.you.y === 6, `held at the counter (${kitchen.you.x.toFixed(1)})`);
  kitchen.input.right = true;
  jumpOnce(kitchen);
  kitchen.input.right = false;
  assert.equal(kitchen.you.y, 11, "and onto it with a jump");
  // A fall at FALL_MAX lands on the highest surface under it, everywhere.
  for (const { id } of ghoul.ROOMS) {
    const r = ghoulRound(id);
    for (let x = 3; x < r.spec.length - 3; x += 3.7) {
      const ground = ghoul.groundAt(r.spec, x);
      const tops = r.spec.shelves.filter(([a, b]) => x >= a && x <= b).map(([, , y]) => y);
      const want = Math.max(ground, ...tops);
      if (want === -Infinity) continue;
      Object.assign(r.you, { x, y: 40, vy: -ghoul.FALL_MAX, state: "air", shelf: -1, drop: -1, out: 0 });
      for (let k = 0; k < 500 && r.you.state === "air"; k++) ghoul.moveYou(r, 4);
      assert.equal(r.you.y, want, `${r.spec.id} at ${x.toFixed(1)}`);
    }
  }
});

test("Ghoul Rush: a fall down a pit costs a life, garlic or not, and puts you back at the room's start safe for SAFE_MS", () => {
  const round = ghoulRound("gallery");
  const you = round.you;
  you.garlic = true;
  standAt(round, 99);
  Object.assign(round.you, { garlic: true, x: 104, state: "air", vy: 0 });
  for (let k = 0; k < 500 && round.phase === "play"; k++) ghoul.advance(round, 4, steady);
  assert.equal(round.phase, "crash");
  assert.equal(round.lives, ghoul.START_LIVES - 1);
  assert.equal(events(round, "lose")[0].cause, "pit");
  ghoul.advance(round, ghoul.CRASH_MS + 10, steady);
  assert.equal(round.phase, "ready");
  assert.equal(round.you.x, round.spec.start, "back at the start");
  assert.equal(round.you.safeMs, ghoul.SAFE_MS);
  ghoul.advance(round, ghoul.READY_MS + 10, steady);
  assert.equal(round.phase, "play");
});

/* ---------------------------------------------------------------- blaster */

test("Ghoul Rush: held fire shoots a bolt every FIRE_MS the way you face (RAPID_MS with Rapid fire, three with Spread shot), and a bolt stops at a wall or after SHOT_RANGE", () => {
  const count = (setup) => {
    const round = ghoulRound();
    standAt(round, 40);
    setup(round);
    round.input.fire = true;
    let shots = 0;
    for (let ms = 0; ms < 1020; ms += 4) {
      ghoul.advance(round, 4, steady);
      shots += events(round, "fire").length;
      round.events.length = 0;
    }
    return { shots, round };
  };
  const plain = count(() => {});
  assert.equal(plain.shots, Math.ceil(1020 / ghoul.FIRE_MS), "a bolt every FIRE_MS");
  assert.ok(plain.round.shots.every((s) => s.vx > 0), "facing right, they fly right");
  const rapid = count((r) => ghoul.applyPower(r, "rapid"));
  assert.equal(rapid.shots, Math.ceil(1020 / ghoul.RAPID_MS), "twice as often with Rapid fire");
  const left = count((r) => (r.you.face = -1));
  assert.ok(left.round.shots.every((s) => s.vx < 0), "facing left, they fly left");
  const round = ghoulRound();
  standAt(round, 40);
  ghoul.applyPower(round, "spread");
  round.input.fire = true;
  ghoul.advance(round, 4, steady);
  assert.equal(round.shots.length, 3, "Spread shot: three");
  assert.deepEqual(round.shots.map((s) => Math.sign(s.vy)).sort(), [-1, 0, 1]);
  // A bolt flies SHOT_RANGE at most.
  round.input.fire = false;
  round.shots.length = 0;
  round.effects.spread = 0;
  round.fireMs = 0;
  round.input.fire = true;
  ghoul.advance(round, 4, steady);
  round.input.fire = false;
  const s = round.shots[0];
  ghoul.advance(round, 2000, steady);
  assert.ok(!round.shots.includes(s) && s.gone >= ghoul.SHOT_RANGE - 2 && s.gone < ghoul.SHOT_RANGE + 2, `gone after ${s.gone.toFixed(1)}`);
  // From the foot of the Kitchen's counter, a bolt hits its side.
  const kitchen = ghoulRound("kitchen");
  standAt(kitchen, 60);
  kitchen.input.fire = true;
  ghoul.advance(kitchen, 4, steady);
  kitchen.input.fire = false;
  ghoul.advance(kitchen, 300, steady);
  assert.ok(events(kitchen, "puff").length >= 1 && kitchen.shots.length === 0, "into the counter's side");
});

test("Ghoul Rush: the blaster heats up, slowing a held or hammered fire to one bolt every SLOW_FIRE_MS, and cools only once let go past COOL_DELAY_MS", () => {
  assert.equal(ghoul.fireGap(0), ghoul.FIRE_MS);
  assert.equal(ghoul.fireGap(ghoul.HEAT_FREE), ghoul.FIRE_MS, "the first HEAT_FREE bolts go at the full rate");
  assert.ok(ghoul.fireGap(ghoul.HEAT_FREE + 1) > ghoul.FIRE_MS, "then each waits longer");
  assert.equal(ghoul.fireGap(ghoul.HEAT_MAX), ghoul.SLOW_FIRE_MS, "down to the floor");
  const shotsIn = (round, ms) => {
    let shots = 0;
    for (let t = 0; t < ms; t += 4) {
      ghoul.advance(round, 4, steady);
      shots += events(round, "fire").length;
      round.events.length = 0;
    }
    return shots;
  };
  // Held: the full rate at first, and one a second once the blaster is hot.
  const round = ghoulRound();
  standAt(round, 40);
  round.input.fire = true;
  shotsIn(round, 20000);
  assert.equal(round.heat, ghoul.HEAT_MAX, "held long enough, the blaster is at its hottest");
  const hot = shotsIn(round, 3000);
  assert.ok(hot >= 2 && hot <= 4, `${hot} bolts in 3 seconds when hot`);
  // Hammered: a tap every 150ms never gets past COOL_DELAY_MS, so it heats too.
  const tapped = ghoulRound();
  standAt(tapped, 40);
  for (let i = 0; i < 160; i++) {
    tapped.input.fire = true;
    shotsIn(tapped, 40);
    tapped.input.fire = false;
    shotsIn(tapped, 110);
  }
  assert.equal(tapped.heat, ghoul.HEAT_MAX, "tapping heats it as much as holding");
  // Let go: no cooling for COOL_DELAY_MS, then COOL_RATE a second, cool again in time.
  round.input.fire = false;
  shotsIn(round, ghoul.COOL_DELAY_MS - 20);
  assert.equal(round.heat, ghoul.HEAT_MAX, "a short let-go does not cool it");
  shotsIn(round, 1020);
  assert.ok(Math.abs(round.heat - (ghoul.HEAT_MAX - ghoul.COOL_RATE)) < 0.5, `${round.heat} after a second of cooling`);
  shotsIn(round, 3000);
  assert.equal(round.heat, 0, "cool again");
  round.input.fire = true;
  assert.equal(shotsIn(round, 1020), Math.ceil(1020 / ghoul.FIRE_MS), "and at the full rate again");
  // Rapid fire adds no heat and ignores it.
  const rapid = ghoulRound();
  standAt(rapid, 40);
  rapid.heat = ghoul.HEAT_MAX;
  ghoul.applyPower(rapid, "rapid");
  rapid.input.fire = true;
  assert.equal(shotsIn(rapid, 1020), Math.ceil(1020 / ghoul.RAPID_MS), "Rapid fire's full rate even when hot");
  assert.equal(rapid.heat, ghoul.HEAT_MAX, "and no heat added");
});

test("Ghoul Rush: a bolt tilts toward the nearest monster ahead near your chest's height, by no more than AIM_MAX", () => {
  const round = ghoulRound();
  standAt(round, 40);
  assert.equal(ghoul.aimAt(round), 0, "nothing ahead: level");
  put(round, "skeleton", 60, { y: 11 });
  const a = ghoul.aimAt(round);
  assert.ok(a > 0 && a <= ghoul.AIM_MAX, `up toward it (${a.toFixed(3)})`);
  round.you.face = -1;
  assert.equal(ghoul.aimAt(round), 0, "behind you: level");
  round.you.face = 1;
  round.monsters[0].y = 30;
  assert.equal(ghoul.aimAt(round), 0, "far above: level");
});

/* ---------------------------------------------------------------- monsters */

test("Ghoul Rush: a zombie shambles toward you, sprints within LURCH_RANGE, never walks off an edge or onto a shelf, takes three bolts, and scores its points", () => {
  const round = ghoulRound("gallery");
  standAt(round, 30);
  const z = put(round, "zombie", 80);
  ghoul.advance(round, 1000, steady);
  assert.ok(Math.abs(z.x - (80 - ghoul.MONSTERS.zombie.speed)) < 0.1, `shambles (${z.x.toFixed(2)})`);
  z.x = 30 + ghoul.LURCH_RANGE - 2;
  const x = z.x;
  round.you.safeMs = 1e9;
  ghoul.advance(round, 100, steady);
  assert.ok(Math.abs(x - z.x - ghoul.MONSTERS.zombie.lurch * 0.1) < 0.05, "sprints when close");
  // At the Gallery's first pit (10 across), it stops at the edge, thinks
  // about it, then leaps it.
  standAt(round, 120);
  const e = put(round, "zombie", 96);
  round.events.length = 0;
  for (let k = 0; k < 300 && !events(round, "ponder").length; k++) ghoul.advance(round, 16, steady);
  assert.equal(events(round, "ponder").length, 1, "at the edge, thinking about it");
  ghoul.advance(round, ghoul.PONDER_MS - 50, steady);
  assert.ok(e.x < 100 && e.y === 6 && !e.hop, `held at the edge a while (${e.x.toFixed(1)})`);
  ghoul.advance(round, 4 * ghoul.PONDER_STEP_MS, steady);
  assert.equal(events(round, "leap").length, 1, "then it leaps");
  ghoul.advance(round, 1000, steady);
  assert.ok(!e.dead && e.x > 110 && e.y === 6 && !e.hop, `over the pit (${e.x.toFixed(1)}, ${e.y})`);
  // The Library's first pit (12 across), its bridge crumbled away, is too
  // wide: held there for good.
  const lib = ghoulRound("library");
  lib.down[0] = 1e9;
  standAt(lib, 110);
  const w = put(lib, "zombie", 85);
  ghoul.advance(lib, 8000, steady);
  assert.ok(w.x < 90 && w.y === 6 && !w.hop, `too wide to leap (${w.x.toFixed(1)})`);
  assert.equal(events(lib, "leap").length, 0);
  // Down is further: the Kitchen's pit from its counter (11) to the floor
  // (6) is 12 across too, but the drop gives the leap the time to clear it.
  const down = (n, from, to, at) => {
    const r = ghoulRound(n);
    standAt(r, at);
    r.you.safeMs = 1e9;
    const m = put(r, "zombie", from);
    ghoul.advance(r, 8000, steady);
    return m;
  };
  const kit = down("kitchen", 262, 282, 300);
  assert.ok(!kit.dead && kit.x > 282 && kit.y === 6, `down across the Kitchen's wide pit (${kit.x.toFixed(1)}, ${kit.y})`);
  // And straight down off a ledge to the floor below it.
  const ledge = down("kitchen", 100, 110, 130);
  assert.ok(!ledge.dead && ledge.x > 110 && ledge.y === 6, `down off the counter (${ledge.x.toFixed(1)}, ${ledge.y})`);
  // Three bolts, then gone, for its points.
  const r2 = ghoulRound();
  standAt(r2, 30);
  const k = put(r2, "zombie", 50);
  const before = r2.score;
  r2.input.fire = true;
  for (let ms = 0; ms < 1000 && r2.monsters.includes(k); ms += 4) ghoul.advance(r2, 4, steady);
  r2.input.fire = false;
  assert.equal(events(r2, "hit").length, ghoul.MONSTERS.zombie.hp - 1, "the first bolts hurt");
  assert.deepEqual(events(r2, "kill").map((ev) => [ev.kind, ev.points, ev.how]), [["zombie", ghoul.MONSTERS.zombie.points, "shot"]]);
  assert.ok(r2.score - before >= ghoul.MONSTERS.zombie.points);
});

test("Ghoul Rush: a bolt to the head (the top HEAD_SHARE) or a stomp from above doubles a kill, a stomp bounces you, and a ghost cannot be stomped", () => {
  const round = ghoulRound();
  standAt(round, 30);
  const z = put(round, "zombie", 34, { hp: 1 });
  round.shots.push({ x: 33, y: z.y + z.h - 0.5, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.deepEqual(events(round, "kill").map((e) => [e.how, e.points]), [["head", ghoul.MONSTERS.zombie.points * 2]]);
  const r2 = ghoulRound();
  standAt(r2, 30);
  r2.you.safeMs = 0;
  const c = put(r2, "crawler", 30);
  Object.assign(r2.you, { y: c.y + c.h + 0.2, vy: -20, state: "air" });
  ghoul.advance(r2, 40, steady);
  assert.deepEqual(events(r2, "kill").map((e) => [e.kind, e.how, e.points]), [["crawler", "stomp", ghoul.MONSTERS.crawler.points * 2]]);
  assert.ok(r2.you.vy > 0 && r2.lives === ghoul.START_LIVES, "bounced up, unhurt");
  const r3 = ghoulRound();
  standAt(r3, 30);
  const g = put(r3, "ghost", 30, { y: 6, phase: ghoul.GHOST_APPEAR_MS + 100 });
  Object.assign(r3.you, { y: g.y + g.h + 0.2, vy: -20, state: "air" });
  ghoul.advance(r3, 40, steady);
  assert.equal(events(r3, "kill").length, 0, "no stomping a ghost");
});

test("Ghoul Rush: a crawler is harmless and unhittable for RISE_MS as it comes up, a door holds its zombies while you are within DOOR_CLEAR and each steps out harmless", () => {
  const round = ghoulRound("gallery");
  standAt(round, 60);
  round.spawns = round.spec.spawns.map(() => ({ over: false, on: false, done: 0, t: 0 }));
  round.spawns.forEach((st, i) => (st.over = i !== 0));
  ghoul.advance(round, 4, steady);
  const c = round.monsters.find((m) => m.kind === "crawler");
  assert.ok(c && c.rise > 0, "woken by you near its board");
  assert.equal(ghoul.solid(c), false);
  c.x = round.you.x;
  ghoul.advance(round, ghoul.RISE_MS - 50, steady);
  assert.equal(round.lives, ghoul.START_LIVES, "no hit while it comes up");
  ghoul.advance(round, 100, steady);
  assert.equal(round.phase, "crash", "up, and on you: a hit");
  const foyer = ghoulRound();
  const door = foyer.spec.spawns.findIndex((s) => s[0] === "door");
  const dx = foyer.spec.spawns[door][1];
  foyer.spawns[door].over = false;
  standAt(foyer, dx - 5);
  foyer.camX = dx - 50;
  ghoul.advance(foyer, 3000, steady);
  assert.equal(foyer.monsters.length, 0, "held while you are close");
  standAt(foyer, dx - ghoul.DOOR_CLEAR - 6);
  foyer.camX = dx - 50;
  ghoul.advance(foyer, ghoul.EMERGE_MS / 2, steady);
  const z = foyer.monsters[0];
  assert.ok(z && z.rise > 0 && !ghoul.solid(z), "out it steps, harmless at first");
});

test("Ghoul Rush: a bat roosts until you come within BAT_NEAR, then swoops in level passes at your chest and never drops onto your head", () => {
  const round = ghoulRound("library");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const b = put(round, "bat", 20 + ghoul.BAT_NEAR + 4, { y: 44, awake: false });
  ghoul.advance(round, 500, steady);
  assert.equal(b.awake, false, "asleep while you are far");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 16, steady);
  assert.equal(b.awake, true);
  let passes = 0;
  let level = 0;
  let side = Math.sign(b.x - round.you.x);
  const chest = round.you.y + ghoul.SHOT_Y;
  for (let ms = 0; ms < 8000; ms += 16) {
    ghoul.advance(round, 16, steady);
    if (Math.abs(b.x - round.you.x) < 2) assert.ok(Math.abs(b.y + b.h / 2 - chest) < 3.5 || b.y > round.you.y + ghoul.YOU_H + 3, `over you it is at your chest or well clear of your head (${b.y.toFixed(1)})`);
    const s = Math.sign(b.x - round.you.x);
    if (s && s !== side) {
      passes++;
      side = s;
      if (Math.abs(b.y + b.h / 2 - chest) < 3.5) level++;
    }
  }
  assert.ok(passes >= 3, `it comes back for more (${passes} passes)`);
  assert.ok(level >= 2, `level with your chest, where a bolt finds it (${level} of ${passes})`);
});

test("Ghoul Rush: a ghost can be hit and can hurt only while solid, never turns solid on top of you, and takes two bolts", () => {
  const round = ghoulRound("conservatory");
  standAt(round, 30);
  const g = put(round, "ghost", 30, { y: 6, phase: ghoul.GHOST_SHOW_MS + 100 });
  assert.equal(ghoul.solid(g), false, "faded");
  ghoul.advance(round, 4000, steady);
  assert.equal(round.lives, ghoul.START_LIVES, "faded on top of you, it waits");
  assert.equal(ghoul.solid(g), false);
  g.x = 50;
  round.you.safeMs = 1e9;
  for (let ms = 0; ms < 3000 && !ghoul.solid(g); ms += 4) ghoul.advance(round, 4, steady);
  assert.ok(ghoul.solid(g), "clear of you, it turns solid");
  const faded = put(round, "ghost", 40, { y: 6, phase: ghoul.GHOST_SHOW_MS + 600 });
  round.shots.push({ x: 39.5, y: 8, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(faded.hp, ghoul.MONSTERS.ghost.hp, "a bolt goes through a faded ghost");
  assert.ok(ghoul.ghostSight(faded) < 0.2);
});

test("Ghoul Rush: a skeleton winds up, then throws a bone timed to come down at you; it holds its bone within SKEL_NEAR; a bone shot down scores BONE_POINTS and one that lands on you is a hit", () => {
  const round = ghoulRound("kitchen");
  standAt(round, 40);
  round.camX = 20;
  const s = put(round, "skeleton", 66, { throwIn: 10 });
  ghoul.advance(round, 20, steady);
  assert.equal(events(round, "windup").length, 1, "the arm goes up");
  assert.equal(round.bones.length, 0);
  ghoul.advance(round, ghoul.SKEL_WINDUP_MS, steady);
  assert.equal(round.bones.length, 1, "and the bone flies");
  assert.deepEqual(events(round, "throw").map((e) => e.by), ["skeleton"], "the throw says who threw it, for its sound");
  const b = round.bones[0];
  assert.ok(b.vx < 0, "toward you");
  for (let ms = 0; ms < 3000 && round.phase === "play"; ms += 4) ghoul.advance(round, 4, steady);
  assert.deepEqual(events(round, "lose").map((e) => e.cause), ["bone"], "standing still, it lands on you");
  const r2 = ghoulRound("kitchen");
  standAt(r2, 60);
  r2.camX = 30;
  const near = put(r2, "skeleton", 60 + ghoul.SKEL_NEAR - 1, { throwIn: 10 });
  r2.you.safeMs = 1e9;
  ghoul.advance(r2, 1000, steady);
  assert.equal(near.windup + r2.bones.length, 0, "too close to throw");
  const r3 = ghoulRound("kitchen");
  standAt(r3, 40);
  r3.bones.push({ id: 1, x: 50, y: 8.4, vx: 0, vy: 0, spin: 0, life: 4000 });
  r3.shots.push({ x: 49, y: 8.4, vx: 80, vy: 0, gone: 0 });
  const before = r3.score;
  ghoul.advance(r3, 4, steady);
  assert.equal(r3.score - before, ghoul.BONE_POINTS);
  assert.equal(r3.bones.length, 0);
  assert.ok(s);
});

test("Ghoul Rush: a hellhound prowls toward you, crouches growling within HOUND_RANGE, then lunges in a low arc a jump clears, rests after it lands, and dies in a pit it lunges into", () => {
  const round = ghoulRound("gallery");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const h = put(round, "hound", 70);
  ghoul.advance(round, 1000, steady);
  assert.ok(Math.abs(h.x - (70 - ghoul.MONSTERS.hound.speed)) < 0.2, `prowls (${h.x.toFixed(2)})`);
  h.x = 30 + ghoul.HOUND_RANGE - 2;
  ghoul.advance(round, 8, steady);
  assert.deepEqual([h.act, events(round, "growl").length], ["crouch", 1], "crouches, growling");
  const x = h.x;
  ghoul.advance(round, ghoul.HOUND_CROUCH_MS - 20, steady);
  assert.equal(h.x, x, "still while it crouches");
  ghoul.advance(round, 40, steady);
  assert.deepEqual([h.act, events(round, "lunge").length], ["leap", 1], "then lunges");
  let top = h.y;
  for (let ms = 0; ms < 2000 && h.act === "leap"; ms += 4) {
    ghoul.advance(round, 4, steady);
    top = Math.max(top, h.y);
  }
  assert.ok(top - 6 < ghoul.JUMP_TOP / 2, `a low arc (${(top - 6).toFixed(2)} up)`);
  assert.equal(h.act, "rest");
  // Standing, its lunge lands on you; jumping, it passes under.
  const lunge = (jumped) => {
    const r = ghoulRound("gallery");
    standAt(r, 30);
    put(r, "hound", 30 + ghoul.HOUND_RANGE - 2);
    for (let ms = 0; ms < 1500 && r.phase === "play"; ms += 4) {
      const m = r.monsters[0];
      if (jumped && m && m.act === "leap" && r.you.state === "run" && !r.input.jump) Object.assign(r.input, { jump: ghoul.JUMP_BUFFER_MS, up: true });
      ghoul.advance(r, 4, steady);
    }
    return r.phase !== "play";
  };
  assert.equal(lunge(false), true, "standing still, it gets you");
  assert.equal(lunge(true), false, "a jump clears it");
  // At the Gallery's first pit, a lunge over it falls in.
  const r2 = ghoulRound("gallery");
  standAt(r2, 108);
  r2.you.safeMs = 1e9;
  const p = put(r2, "hound", 96, { act: "leap", vx: ghoul.HOUND_LUNGE_VX, vy: 4, dir: 1 });
  p.x = 101;
  ghoul.advance(r2, 2000, steady);
  assert.ok(!r2.monsters.includes(p) && events(r2, "kill").length === 0, "gone down the pit, no points");
});

test("Ghoul Rush: a widow hangs out of reach and out of the banner's strip till you come within SPIDER_NEAR, drops onto the surface under it, then skitters after you", () => {
  const round = ghoulRound("gallery");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const s = put(round, "spider", 30 + ghoul.SPIDER_NEAR + 6, { y: ghoul.SPIDER_Y, act: "hang" });
  ghoul.advance(round, 500, steady);
  assert.deepEqual([s.act, s.y], ["hang", ghoul.SPIDER_Y], "it waits");
  assert.equal(ghoul.roused(s), false, "and does not count yet");
  assert.equal(ghoul.aimAt(round), 0, "nor draws your aim");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 4, steady);
  assert.deepEqual([s.act, events(round, "skitter").length], ["drop", 1]);
  for (let ms = 0; ms < 2000 && s.act === "drop"; ms += 4) ghoul.advance(round, 4, steady);
  assert.deepEqual([s.act, s.y], ["walk", 6], "down on the floor");
  const x = s.x;
  ghoul.advance(round, 200, steady);
  assert.ok(s.x < x, "and after you");
  // One right over you drops onto you.
  const r2 = ghoulRound("gallery");
  standAt(r2, 30);
  put(r2, "spider", 30, { y: ghoul.SPIDER_Y, act: "hang" });
  for (let ms = 0; ms < 1500 && r2.phase === "play"; ms += 4) ghoul.advance(r2, 4, steady);
  assert.deepEqual(events(r2, "lose").map((e) => e.cause), ["spider"]);
});

test("Ghoul Rush: a wraith is unseen till you come within WRAITH_NEAR, hovers ahead of you within a tilted bolt's reach, shrieks for WRAITH_WIND_MS, then dives at where your chest was, so moving off the spot dodges it and a bolt brings it down", () => {
  const round = ghoulRound("conservatory");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const w = put(round, "wraith", 30 + ghoul.WRAITH_NEAR + 10, { y: 32, act: "idle", home: 32 });
  ghoul.advance(round, 300, steady);
  assert.deepEqual([w.act, ghoul.solid(w)], ["idle", false], "unseen while you are far");
  standAt(round, 30 + 20);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 4, steady);
  assert.deepEqual([w.act, ghoul.solid(w), events(round, "wraith").length], ["hover", true, 1]);
  w.wait = 1e9;
  ghoul.advance(round, 2000, steady);
  assert.ok(Math.abs(w.x - (round.you.x + ghoul.WRAITH_KEEP)) < 3, `hovers ahead (${(w.x - round.you.x).toFixed(1)})`);
  assert.ok(w.y <= round.you.y + ghoul.WRAITH_ABOVE + 1.6, "never too high to shoot");
  const a = ghoul.aimAt(round);
  assert.ok(a > 0 && a <= ghoul.AIM_MAX, `a bolt tilts up to it (${a.toFixed(2)})`);
  // The dive: standing still it gets you; stepping back, it misses.
  const dive = (dodge) => {
    const r = ghoulRound("conservatory");
    standAt(r, 60);
    const m = put(r, "wraith", 60 + ghoul.WRAITH_KEEP, { y: 23, act: "wind", wait: 10, home: 23 });
    let shrieked = false;
    for (let ms = 0; ms < 2500 && r.phase === "play" && m.act !== "rise"; ms += 4) {
      if (dodge && m.act === "dive") r.input.left = true;
      ghoul.advance(r, 4, steady);
      shrieked ||= events(r, "dive").length > 0;
    }
    r.input.left = false;
    assert.ok(shrieked, "it dives");
    return r.phase !== "play";
  };
  assert.equal(dive(false), true, "standing still, it gets you");
  assert.equal(dive(true), false, "stepping back, it misses and climbs away");
  const r3 = ghoulRound("conservatory");
  standAt(r3, 30);
  r3.you.safeMs = 1e9;
  const m = put(r3, "wraith", 50, { y: 20, act: "hover", wait: 1e9, home: 20 });
  r3.input.fire = true;
  for (let ms = 0; ms < 1000 && r3.monsters.includes(m); ms += 4) ghoul.advance(r3, 4, steady);
  assert.deepEqual(events(r3, "kill").map((e) => e.kind), ["wraith"], "shot down while it hovers");
});

test("Ghoul Rush: a bloater wades in to SPIT_KEEP, swells, and lobs acid that leaves a burning puddle for PUDDLE_MS (jumped, it is harmless); shot down, it bursts in a harmless splash, no acid flung and no puddle", () => {
  const round = ghoulRound("kitchen");
  standAt(round, 40);
  round.camX = 20;
  round.you.safeMs = 1e9;
  const b = put(round, "spitter", 90, { throwIn: 1e9 });
  ghoul.advance(round, 3000, steady);
  assert.ok(b.x < 90 && b.x - round.you.x >= ghoul.SPIT_KEEP - 0.5, `wades in, then keeps off (${(b.x - round.you.x).toFixed(1)})`);
  b.throwIn = 10;
  ghoul.advance(round, 20, steady);
  assert.equal(events(round, "spit").length, 1, "it swells");
  ghoul.advance(round, ghoul.SPIT_WINDUP_MS, steady);
  assert.deepEqual(round.bones.map((g) => g.kind), ["acid"], "and lobs acid");
  assert.deepEqual([events(round, "spit")[0].kind, events(round, "throw")[0].by], ["spitter", "spitter"], "the swell and the throw say who, for their sounds");
  b.throwIn = 1e9;
  for (let ms = 0; ms < 3000 && !round.puddles.length; ms += 4) ghoul.advance(round, 4, steady);
  assert.equal(round.puddles.length, 1);
  assert.equal(events(round, "splash").length, 1);
  const p = round.puddles[0];
  // Standing in it burns; over it in the air does not.
  const r2 = ghoulRound("kitchen");
  standAt(r2, 40);
  r2.puddles.push({ id: 1, x: 40, y: 6, life: ghoul.PUDDLE_MS });
  Object.assign(r2.you, { state: "air", y: 9, vy: 10 });
  ghoul.advance(r2, 40, steady);
  assert.equal(r2.phase, "play", "over it, unhurt");
  standAt(r2, 40);
  ghoul.advance(r2, 4, steady);
  assert.deepEqual(events(r2, "lose").map((e) => e.cause), ["acid"], "in it, burned");
  ghoul.advance(round, ghoul.PUDDLE_MS, steady);
  assert.ok(!round.puddles.includes(p), "and the puddle dries up");
  // Five bolts, and it bursts.
  const r3 = ghoulRound("kitchen");
  standAt(r3, 40);
  r3.camX = 20;
  r3.you.safeMs = 1e9;
  const k = put(r3, "spitter", 64, { throwIn: 1e9 });
  r3.input.fire = true;
  for (let ms = 0; ms < 2000 && r3.monsters.includes(k); ms += 4) ghoul.advance(r3, 4, steady);
  r3.input.fire = false;
  assert.equal(events(r3, "hit").length + events(r3, "kill").length, ghoul.MONSTERS.spitter.hp);
  assert.equal(events(r3, "burst").length, 1);
  assert.equal(r3.bones.filter((x) => x.kind === "acid").length, 0, "no acid flung");
  for (let ms = 0; ms < 1500; ms += 4) ghoul.advance(r3, 4, steady);
  assert.equal(r3.puddles.length, 0, "no puddle where it fell");
});

test("Ghoul Rush: a monster that reaches the spot under you on a shelf stops there facing the way it went, never turning back and forth, and turns to follow once you move off", () => {
  for (const kind of ["zombie", "crawler", "rotter", "legs"]) {
    const round = ghoulRound("foyer");
    standAt(round, 68, 0);
    round.you.safeMs = 1e9;
    const m = put(round, kind, 58);
    m.dir = 1;
    const turns = [];
    let last = m.dir;
    for (let ms = 0; ms < 6000; ms += 16) {
      round.you.safeMs = 1e9;
      round.timeMs = 1e9;
      ghoul.advance(round, 16, steady);
      if (m.dir !== last) turns.push(ms);
      last = m.dir;
    }
    assert.ok(Math.abs(m.x - 68) < ghoul.UNDER_DX, `${kind} under you (at ${m.x.toFixed(2)})`);
    assert.deepEqual(turns, [], `${kind} never turned`);
    assert.equal(m.dir, 1, `${kind} still facing the way it came`);
    // You walk off to the left along the shelf: it turns once and follows.
    round.you.x = 62;
    for (let ms = 0; ms < 1500; ms += 16) {
      round.you.safeMs = 1e9;
      ghoul.advance(round, 16, steady);
      if (m.dir !== last) turns.push(ms);
      last = m.dir;
    }
    assert.equal(turns.length, 1, `${kind} turned once`);
    assert.equal(m.dir, -1);
    assert.ok(Math.abs(m.x - 62) < ghoul.UNDER_DX, `${kind} under you again`);
  }
});

test("Ghoul Rush: in a dark room half as many come in from the edge behind you, the horde and the stragglers alike, and as many from ahead", () => {
  // What comes in from ahead and behind in `ms`, facing `face`.
  const count = (dark, face, hurry) => {
    const round = ghoulRound();
    round.dark = dark;
    standAt(round, 150);
    round.camX = 100;
    round.you.face = face;
    round.hordeMs = hurry ? Infinity : round.spec.hordeMs;
    round.hurry = hurry;
    const random = ghoul.seeded(11);
    let ahead = 0;
    let behind = 0;
    for (let ms = 0; ms < 240000; ms += 16) {
      round.you.safeMs = 1e9;
      round.you.face = face;
      round.timeMs = 1e9;
      if (hurry) round.hordeMs = Infinity;
      ghoul.advance(round, 16, random);
      for (const e of events(round, "spawn")) {
        const right = e.x > round.camX + ghoul.FIELD_W;
        if (right ? face > 0 : face < 0) ahead++;
        else behind++;
      }
      round.events.length = 0;
      round.monsters.length = 0;
    }
    return { ahead, behind };
  };
  for (const face of [1, -1]) {
    const lit = count(false, face, false);
    const dark = count(true, face, false);
    const share = dark.behind / lit.behind;
    assert.ok(lit.behind > 20 && Math.abs(share - ghoul.DARK_BEHIND) < 0.15, `horde facing ${face}: ${dark.behind} behind in the dark to ${lit.behind} lit`);
    assert.ok(Math.abs(dark.ahead / lit.ahead - 1) < 0.15, `horde facing ${face}: ${dark.ahead} ahead in the dark to ${lit.ahead} lit`);
  }
  // Stragglers come in from ahead when they can, so face left to see them behind.
  const lit = count(false, -1, true);
  const dark = count(true, -1, true);
  assert.ok(lit.behind > 20 && Math.abs(dark.behind / lit.behind - ghoul.DARK_BEHIND) < 0.15, `stragglers: ${dark.behind} in the dark to ${lit.behind} lit`);
});

test("Ghoul Rush: every room but a boss's keeps a horde coming in from the edges of the view, mostly ahead, one of its kinds every hordeMs or so, never past MAX_MONSTERS, held back a little less each stage deeper", () => {
  for (const base of ghoul.ROOMS) {
    if (base.boss) assert.deepEqual([base.horde.length, base.hordeMs], [0, 0], `${base.id}: no horde in a boss's room`);
    else if (base.ride && base.ride.gallery) assert.deepEqual([base.horde.length, base.hordeMs], [0, 0], `${base.id}: the dark ride is a gallery, no horde`);
    else if (base.ride && (base.ride.sled || base.ride.runner)) assert.deepEqual([base.horde.length, base.hordeMs], [0, 0], `${base.id}: a ride's things are the pack's own, no horde`);
    else assert.ok(base.horde.length > 0 && base.hordeMs > 0, `${base.id} has a horde`);
    for (const kind of base.horde) assert.ok(ghoul.MONSTERS[kind], `${base.id}: ${kind} is a monster`);
  }
  const round = ghoulRound();
  round.dark = false;
  standAt(round, 150);
  round.camX = 100;
  round.you.safeMs = 1e9;
  round.hordeMs = round.spec.hordeMs;
  const random = ghoul.seeded(9);
  let ahead = 0;
  let behind = 0;
  for (let ms = 0; ms < 30000; ms += 16) {
    round.you.safeMs = 1e9;
    round.monsters.forEach((m) => (m.x = Math.max(m.x, round.camX - 6)));
    ghoul.advance(round, 16, random);
    for (const e of events(round, "spawn")) {
      const base = { runner: "zombie", glutton: "zombie" }[e.kind] ?? e.kind;
      assert.ok(round.spec.horde.includes(base), `a ${e.kind} from the Foyer's horde`);
      if (e.x > round.camX + ghoul.FIELD_W) ahead++;
      else if (e.x < round.camX) behind++;
    }
    round.events.length = 0;
    assert.ok(round.monsters.length <= 18);
  }
  assert.ok(ahead > behind && behind > 0, `mostly ahead (${ahead} ahead, ${behind} behind)`);
  assert.ok(ahead + behind >= 30000 / round.spec.hordeMs / 2, `steady (${ahead + behind} in 30 s)`);
  assert.ok(ghoul.roomFor("foyer", 2).hordeMs * ghoul.roomFor("foyer", 2).every < ghoul.roomFor("foyer").hordeMs, "quicker two stages deeper");
  const boss = ghoulRound("ballroom");
  boss.hordeMs = 0;
  ghoul.advance(boss, 10000, steady);
  assert.equal(events(boss, "spawn").length, 0, "none in a boss's room");
});

/* ---------------------------------------------------------------- chain */

test("Ghoul Rush: kills each within CHAIN_MS raise the chain, which multiplies their points up to MAX_MULT, runs out after CHAIN_MS, and ends on a hit", () => {
  const round = ghoulRound();
  standAt(round, 20);
  const killOne = () => ghoul.kill(round, put(round, "bat", 60, { y: 30 }), "shot", () => 0.99);
  assert.equal(killOne(), ghoul.MONSTERS.bat.points);
  assert.equal(killOne(), ghoul.MONSTERS.bat.points * 2);
  assert.equal(killOne(), ghoul.MONSTERS.bat.points * 3);
  for (let k = 0; k < 10; k++) killOne();
  assert.equal(killOne(), ghoul.MONSTERS.bat.points * ghoul.MAX_MULT, "capped");
  assert.equal(round.stats.bestChain, 14);
  round.monsters.length = 0;
  ghoul.advance(round, ghoul.CHAIN_MS + 8, steady);
  assert.equal(round.chain, 0, "it runs out");
  assert.equal(killOne(), ghoul.MONSTERS.bat.points);
  killOne();
  ghoul.lose(round, "zombie");
  assert.equal(round.chain, 0, "a hit ends it");
  assert.deepEqual([1, 2, 8, 99].map(ghoul.chainMult), [1, 2, 8, ghoul.MAX_MULT]);
});

/* ---------------------------------------------------------------- powers */

test("Ghoul Rush: a timed power-up taken while the same one runs adds its time to what is left, and the HUD pill stays full till it is back under one pickup", () => {
  const round = ghoulRound();
  standAt(round, 30);
  const ms = ghoul.POWERS.rapid.ms;
  ghoul.applyPower(round, "rapid");
  ghoul.applyPower(round, "rapid");
  assert.equal(round.effects.rapid, ms * 2, "two back to back: twice the time");
  ghoul.advance(round, 1000, steady);
  ghoul.applyPower(round, "rapid");
  assert.equal(round.effects.rapid, ms * 3 - 1000, "a third tops up what was left");
  ghoul.applyPower(round, "spread");
  assert.equal(round.effects.spread, ghoul.POWERS.spread.ms, "another kind keeps its own time");
  ghoul.advance(round, ms * 3, steady);
  assert.equal(round.effects.rapid, 0);
  assert.equal(events(round, "expire").filter((e) => e.kind === "rapid").length, 1, "one run, one expiry");
});

test("Ghoul Rush: Spread shot and Rapid fire run out after their time, the Garlic shield takes one hit and sees off what touched you, a 1UP is a life up to MAX_LIVES, and kills sometimes leave candy or a power-up", () => {
  const round = ghoulRound();
  standAt(round, 30);
  ghoul.applyPower(round, "spread");
  ghoul.applyPower(round, "rapid");
  ghoul.advance(round, ghoul.POWERS.spread.ms + 8, steady);
  assert.deepEqual(round.effects, { spread: 0, rapid: 0, lantern: 0, wings: 0, bell: 0, silver: 0, shears: 0, holy: 0, salts: 0, saw: 0, bane: 0, floss: 0, cocoa: 0, boots: 0 });
  assert.equal(events(round, "expire").length, 2);
  ghoul.applyPower(round, "garlic");
  const z = put(round, "zombie", 30);
  ghoul.advance(round, 4, steady);
  assert.deepEqual([round.lives, round.you.garlic, round.monsters.includes(z)], [ghoul.START_LIVES, false, false], "the garlic took it, and the zombie is gone");
  assert.equal(events(round, "garlic").length, 1);
  assert.ok(round.you.safeMs > 0);
  ghoul.applyPower(round, "life");
  assert.equal(round.lives, ghoul.START_LIVES + 1);
  round.lives = ghoul.MAX_LIVES;
  const score = round.score;
  ghoul.applyPower(round, "life");
  assert.equal(round.lives, ghoul.MAX_LIVES, "never past MAX_LIVES");
  assert.ok(round.score > score, "points instead");
  // Placed power-ups are taken by touching them, and drops fall to the floor.
  const r2 = ghoulRound();
  const [kind, x, y] = r2.spec.items[0];
  standAt(r2, x, r2.spec.shelves.findIndex(([a, b, top]) => x >= a && x <= b && top === y));
  ghoul.advance(r2, 4, steady);
  assert.deepEqual(events(r2, "power").map((e) => e.kind), [kind]);
  ghoul.kill(r2, put(r2, "zombie", 80), "shot", () => ghoul.DROP_POWER + 0.01);
  assert.equal(r2.drops.at(-1).kind, "candy");
  ghoul.kill(r2, put(r2, "zombie", 80), "shot", () => 0);
  assert.notEqual(r2.drops.at(-1).kind, "candy");
  ghoul.advance(r2, 1500, steady);
  assert.ok(r2.drops.every((d) => d.rest && Math.abs(d.y - 7) < 1e-6), "both on the floor");
  standAt(r2, 80);
  ghoul.advance(r2, 4, steady);
  assert.equal(r2.drops.length, 0, "and taken");
});

test("Ghoul Rush's Long Hall is always lit until you take its key, then the lights go out and stay out, even after you lose a life; no other room does this", () => {
  const spec = ghoul.roomById("hall");
  assert.equal(spec.dark, false);
  assert.equal(spec.darkOnKey, true);
  for (let seed = 1; seed <= 100; seed++) assert.equal(ghoul.newRound(seed).dark, false, `seed ${seed} starts lit`);
  assert.deepEqual(ghoul.ROOMS.filter((r) => r.darkOnKey).map((r) => r.id), ["hall"]);
  const round = ghoul.newRound(1);
  round.dice = 0;
  round.phase = "play";
  ghoul.advance(round, 4, steady);
  assert.equal(round.dark, false, "lit on the way to the key");
  assert.equal(round.events.some((e) => e.type === "keyDark"), false);
  Object.assign(round.you, { x: spec.key[0], y: spec.key[1], vx: 0, vy: 0, state: "run", safeMs: 1e9 });
  round.camX = Math.max(0, spec.key[0] - 36);
  ghoul.advance(round, 4, steady);
  assert.equal(round.hasKey, true);
  assert.equal(round.dark, true, "the lights go out");
  assert.equal(round.events.filter((e) => e.type === "keyDark").length, 1);
  // A lost life keeps the key, so the dark stays too.
  ghoul.lose(round, "zombie");
  ghoul.advance(round, ghoul.CRASH_MS + ghoul.READY_MS + 40, steady);
  assert.equal(round.spec.id, "hall");
  assert.equal(round.hasKey, true);
  assert.equal(round.dark, true, "still out after a respawn");
  // The next run's hall is lit again.
  assert.equal(ghoul.newRound(1).dark, false);
});

test("Ghoul Rush: a room is dark some of the times it is entered, the same each time for a seed, and a lit one never has a Lantern, placed or dropped", () => {
  const rooms = [];
  for (let seed = 1; seed <= 400; seed++) {
    const round = ghoul.newRound(seed);
    round.dice = 0;
    through(round);
    round.offer = ["manor"];
    round.phaseMs = 0;
    ghoul.pickStage(round, 0);
    while (round.spec.id !== "library") through(round);
    rooms.push(round);
  }
  // The Library across 400 runs.
  const share = rooms.filter((r) => r.dark).length / rooms.length;
  assert.ok(Math.abs(share - ghoul.DARK_CHANCE) < 0.08, `dark ${share} of the time`);
  for (let seed = 1; seed <= 50; seed++) {
    const again = ghoul.newRound(seed);
    again.dice = 0;
    through(again);
    again.offer = ["manor"];
    again.phaseMs = 0;
    ghoul.pickStage(again, 0);
    while (again.spec.id !== "library") through(again);
    assert.equal(again.dark, rooms[seed - 1].dark, "a seed plays the same");
  }
  const lit = rooms.filter((r) => !r.dark);
  const dark = rooms.filter((r) => r.dark);
  assert.ok(lit.length && dark.length, "the Library both ways");
  const at = ghoul.roomFor("library").items.findIndex(([kind]) => kind === "lantern");
  assert.ok(at >= 0, "the Library places a Lantern");
  for (const r of dark) assert.equal(r.loot[at], "lantern", "kept in the dark");
  for (const r of lit) {
    assert.ok(!r.loot.includes("lantern"), "swapped in the light");
    assert.notEqual(r.loot[at], "life", "never for a 1UP");
    assert.ok(ghoul.POWERS[r.loot[at]], "for a power-up");
    // No drop is a Lantern, whatever the roll.
    for (let k = 0; k < 40; k++) {
      r.monsters.length = 0;
      ghoul.kill(r, put(r, "zombie", 80, { force: true }), "shot", ((n) => () => (n++ === 0 ? 0 : k / 40))(0));
      assert.notEqual(r.drops.at(-1).kind, "lantern");
    }
  }
  // Taken, the swapped one is what was shown.
  const r = lit[0];
  quiet(r);
  r.phase = "play";
  r.events.length = 0;
  const [, x, y] = r.spec.items[at];
  standAt(r, x, r.spec.shelves.findIndex(([a, b, top]) => x >= a && x <= b && top === y));
  ghoul.advance(r, 4, steady);
  assert.deepEqual(events(r, "power").map((e) => e.kind), [r.loot[at]]);
});

test("Ghoul Rush: Bat wings give one flap in the air each time you leave the ground, and a press just before landing is still a jump on landing", () => {
  const plain = ghoulRound();
  standAt(plain, 30);
  hold(plain, { up: true, jump: ghoul.JUMP_BUFFER_MS }, 120);
  hold(plain, { up: true, jump: ghoul.JUMP_BUFFER_MS }, 8);
  assert.equal(events(plain, "flap").length, 0, "no wings, no flap");
  const round = ghoulRound();
  standAt(round, 30);
  ghoul.applyPower(round, "wings");
  hold(round, { up: true, jump: ghoul.JUMP_BUFFER_MS }, 120);
  assert.equal(round.you.state, "air");
  hold(round, { up: true, jump: ghoul.JUMP_BUFFER_MS }, 8);
  assert.equal(events(round, "flap").length, 1, "a press in the air flaps");
  assert.ok(round.you.vy > ghoul.JUMP_V * 0.9, "for a full jump's lift");
  hold(round, { up: true, jump: ghoul.JUMP_BUFFER_MS }, 8);
  assert.equal(events(round, "flap").length, 1, "once a jump");
  ghoul.advance(round, 2000, steady);
  assert.equal(round.you.state, "run", "landed");
  // Coming down just over the floor, a press waits for the landing.
  Object.assign(round.you, { y: ghoul.groundAt(round.spec, 30) + 2, vy: -30, state: "air", flapped: false });
  round.events.length = 0;
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  ghoul.advance(round, 120, steady);
  assert.equal(events(round, "flap").length, 0, "no flap so close to the floor");
  assert.equal(events(round, "jump").length, 1, "a jump on landing instead");
});

test("Ghoul Rush: every treasure up high is out of one jump's reach from anywhere, but Bat wings' second jump from the shelf under it takes it, and each such room has wings on the way", () => {
  const reach = ghoul.JUMP_TOP + ghoul.HIT_H + 1.2;
  let rooms = 0;
  for (const base of ghoul.ROOMS) {
    if (!base.sky.length) continue;
    rooms++;
    const firstSky = Math.min(...base.sky.map(([, x]) => x));
    assert.ok(base.items.some(([kind, x]) => kind === "wings" && x < firstSky), `${base.id}: Bat wings before the treasure`);
    for (const [y0] of [...base.ground.map((g) => [g[2]]), ...base.shelves.map((sh) => [sh[2]])]) {
      for (const [kind, , y] of base.sky) assert.ok(y0 >= y || y0 + reach < y, `${base.id}: ${kind} at ${y} is out of one jump's reach from a floor at ${y0}`);
    }
    base.sky.forEach(([kind, x, y], k) => {
      const shelf = base.shelves.reduce((best, sh, i) => (x >= sh[0] && x <= sh[1] && (best < 0 || sh[2] > base.shelves[best][2]) ? i : best), -1);
      assert.ok(shelf >= 0, `${base.id}: a shelf under the ${kind}`);
      const leap = (wings) => {
        const round = ghoulRound(base.id);
        standAt(round, x, shelf);
        round.you.safeMs = 1e9;
        if (wings) ghoul.applyPower(round, "wings");
        round.input.up = true;
        round.input.jump = ghoul.JUMP_BUFFER_MS;
        let flapped = false;
        for (let ms = 0; ms < 3000 && (ms < 40 || round.you.state === "air"); ms += 4) {
          if (wings && !flapped && round.you.state === "air" && round.you.vy <= 0) {
            round.input.jump = ghoul.JUMP_BUFFER_MS;
            flapped = true;
          }
          ghoul.advance(round, 4, steady);
        }
        return round.sky[k];
      };
      assert.equal(leap(false), false, `${base.id}: one jump falls short of the ${kind} at ${x}`);
      assert.equal(leap(true), true, `${base.id}: a jump and a flap take the ${kind} at ${x}`);
    });
  }
  assert.equal(rooms, ghoul.ROOMS.filter((r) => !r.boss && !r.ride).length, "every room but a boss's and a ride's has some");
});

test("Ghoul Rush: a crystal is CRYSTAL_POINTS, and Silver bolts, never dropped, send each bolt on through every monster it hits", () => {
  assert.equal(ghoul.POWERS.silver.weight, 0, "never dropped");
  const round = ghoulRound("gallery");
  const k = round.spec.sky.findIndex(([kind]) => kind === "crystal");
  const [, cx, cy] = round.spec.sky[k];
  const score = round.score;
  Object.assign(round.you, { x: cx, y: cy - 2, vy: 0, state: "air" });
  ghoul.advance(round, 4, steady);
  assert.equal(round.sky[k], true);
  assert.equal(events(round, "crystal").length, 1);
  assert.equal(round.score - score, ghoul.CRYSTAL_POINTS);
  assert.equal(round.stats.crystals, 1);
  const shoot = (silver) => {
    const r = ghoulRound();
    standAt(r, 30);
    r.you.face = 1;
    r.you.safeMs = 1e9;
    if (silver) ghoul.applyPower(r, "silver");
    const a = put(r, "zombie", 40);
    const b = put(r, "zombie", 44);
    r.shots.push({ x: 32, y: r.you.y + 2, vx: ghoul.SHOT_SPEED, vy: 0, gone: 0 });
    ghoul.advance(r, 200, steady);
    return [a.hp, b.hp];
  };
  const [a0, b0] = shoot(false);
  assert.ok(a0 < b0, "a plain bolt stops at the first");
  const [a1, b1] = shoot(true);
  assert.equal(a1, a0, "a silver bolt hits the first once");
  assert.equal(b1, a1, "and the one behind it too");
});

test("Ghoul Rush: the Church bell holds every monster still and lets none in until it stops or you go through the door, and the Lantern runs out like the others", () => {
  const round = ghoulRound();
  standAt(round, 20);
  const z = put(round, "zombie", 60);
  ghoul.applyPower(round, "bell");
  ghoul.advance(round, 1000, steady);
  assert.equal(z.x, 60, "the zombie stands still");
  ghoul.advance(round, ghoul.POWERS.bell.ms, steady);
  assert.ok(z.x < 60, "and walks again once the bell stops");
  ghoul.applyPower(round, "lantern");
  assert.equal(round.effects.lantern, ghoul.POWERS.lantern.ms);
  ghoul.applyPower(round, "bell");
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
  assert.equal(round.effects.bell, 0, "the bell stops at the door");
});

test("Ghoul Rush: every room but a boss's has a clock of 70 to 80 seconds (a ride's own, up to 120); at none a life goes and the room starts over with a full clock, and the Hourglass adds HOURGLASS_MS", () => {
  for (const base of ghoul.ROOMS) {
    const spec = ghoul.roomFor(base.id);
    const ms = ghoul.timeFor(spec);
    if (spec.boss) assert.equal(ms, 0, `${spec.id}: no clock in a boss room`);
    // A ride room (the Runaway Cart, a long bonus round) has the clock of its own ride.
    else if (spec.ride) assert.ok(ms === spec.ride.time && ms >= 70000 && ms <= 120000, `${spec.id}: ${ms}`);
    else assert.ok(ms >= 70000 && ms <= 80000 && ms % 5000 === 0, `${spec.id}: ${ms}`);
  }
  const round = ghoulRound();
  standAt(round, 30);
  assert.equal(round.timeMs, ghoul.timeFor(round.spec));
  ghoul.applyPower(round, "hourglass");
  assert.equal(round.timeMs, ghoul.timeFor(round.spec) + ghoul.HOURGLASS_MS);
  round.timeMs = 3500;
  ghoul.advance(round, 3000, steady);
  assert.deepEqual(events(round, "tick").map((e) => e.left), [3, 2, 1], "the last seconds tick");
  ghoul.advance(round, 600, steady);
  assert.equal(events(round, "lose")[0]?.cause, "time", "out of time");
  assert.equal(round.lives, ghoul.START_LIVES - 1);
  ghoul.advance(round, ghoul.CRASH_MS + ghoul.READY_MS + 20, steady);
  assert.equal(round.phase, "play");
  assert.ok(round.timeMs > ghoul.timeFor(round.spec) - 500, "a full clock again");
  const boss = ghoulRound("ballroom");
  const score = boss.score;
  ghoul.applyPower(boss, "hourglass");
  assert.equal(boss.timeMs, 0);
  assert.ok(boss.score > score, "points where there is no clock");
});

test("Ghoul Rush: two or more walkers bunched under you on a shelf climb over each other to reach you, one alone does not, and they come back down once you leave", () => {
  // Shelf 0 of the Foyer, [60, 76] at 15, over the floor at 6.
  const setup = (n) => {
    const round = ghoulRound();
    standAt(round, 68, 0);
    round.timeMs = 0;
    const crowd = [];
    for (let k = 0; k < n; k++) crowd.push(put(round, "zombie", 66.5 + k));
    return { round, crowd };
  };
  const one = setup(1);
  one.round.you.safeMs = 1e9;
  ghoul.advance(one.round, 1500, steady);
  assert.ok(one.crowd.every((m) => !m.lift), "one alone stays on the floor");
  const two = setup(2);
  two.round.you.safeMs = 1e9;
  ghoul.advance(two.round, 600, steady);
  assert.ok(two.crowd[1].lift > 0 && !two.crowd[0].lift, "two: the newer climbs the older at once");
  const four = setup(4);
  four.round.you.safeMs = 1e9;
  const found = ghoul.piles(four.round, 0);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0], four.crowd, "one pile, the oldest at the bottom");
  ghoul.advance(four.round, 1500, steady);
  const lifts = four.crowd.map((m) => m.lift);
  assert.equal(lifts[0], 0, "the bottom one stays on the floor");
  assert.ok(lifts[1] > 0 && lifts[2] > lifts[1], `each higher than the one below (${lifts.map((l) => l.toFixed(1))})`);
  const top = Math.max(...four.crowd.map((m) => m.y + m.h));
  assert.ok(top > four.round.you.y, "the pile reaches up past your feet");
  assert.equal(events(four.round, "climb").length, 1, "the climb is called once");
  // Off the shelf and away, the pile comes down.
  standAt(four.round, 92);
  ghoul.advance(four.round, 1000, steady);
  assert.ok(four.crowd.every((m) => !m.lift), "back on the floor");
  // Unprotected, the pile gets you.
  const hit = setup(4);
  ghoul.advance(hit.round, 2500, steady);
  assert.equal(events(hit.round, "lose").length, 1, "a pile is not safe to sit over");
});

test("Ghoul Rush: a climbing walker's raised arms hurt you if you land on them, but its head between them still takes a stomp; not climbing, the whole top does", () => {
  const drop = (dx, climbing) => {
    const round = ghoulRound();
    standAt(round, 30);
    const z = put(round, "zombie", 40);
    // Up a wall (one that never ends), its arms up the whole time.
    if (climbing) z.scale = { top: 1e9, x: 40 };
    Object.assign(round.you, { x: 40 + dx, y: z.y + z.h + ghoul.ARMS_UP + 1, vy: -20, state: "air", shelf: -1, safeMs: 0 });
    for (let ms = 0; ms < 300 && !events(round, "stomp").length && !events(round, "lose").length; ms += 4) ghoul.advance(round, 4, steady);
    return events(round, "stomp").length ? "stomp" : events(round, "lose").length ? "hurt" : "none";
  };
  assert.equal(drop(1.6, true), "hurt", "onto a raised arm");
  assert.equal(drop(-1.6, true), "hurt", "onto the other");
  assert.equal(drop(0, true), "stomp", "onto its head between them");
  assert.equal(drop(1.6, false), "stomp", "not climbing, its shoulder is a stomp as before");
});

test("Ghoul Rush: the horde's stragglers are worth less each kill in a room, down to STRAY_MIN, and never leave anything behind, so camping by the door to farm them pays next to nothing", () => {
  const round = ghoulRound();
  standAt(round, 30);
  const z = ghoul.MONSTERS.zombie.points;
  const got = [];
  for (let k = 0; k < 14; k++) {
    round.chainMs = 0;
    const m = put(round, "zombie", 50, { horde: true });
    got.push(ghoul.kill(round, m, "shot", () => 0));
  }
  assert.equal(got[0], z, "the first, in full");
  assert.equal(got[1], Math.round(z * ghoul.STRAY_FADE), "then less");
  assert.equal(got.at(-1), Math.round(z * ghoul.STRAY_MIN), "never under STRAY_MIN");
  assert.equal(round.drops.length, 0, "and nothing dropped, even on the luckiest roll");
  round.chainMs = 0;
  assert.equal(ghoul.kill(round, put(round, "zombie", 50), "shot", () => 0), z, "one of the room's own: full points");
  assert.equal(round.drops.length, 1, "and its drop");
});

test("Ghoul Rush: anything on four legs leaps a gap twice as far as any other monster", () => {
  const lib = ghoulRound("library");
  lib.down[0] = 1e9;
  // The Library's first pit runs 90 to 102: 12 across, past a plain leap.
  const leaps = (m) => ghoul.farSide(lib, { y: 6, ...m }, 90.1, 1);
  for (const m of [{ kind: "hound" }, { kind: "moonhound" }, { kind: "topiary" }, { kind: "villager", turned: true }]) assert.ok(leaps(m), `${m.kind} clears it`);
  for (const m of [{ kind: "zombie" }, { kind: "villager" }, { kind: "huntsman" }, { kind: "mulch" }]) assert.equal(leaps(m), null, `${m.kind} does not`);
  assert.equal(ghoul.hopReach({ kind: "hound" }), ghoul.hopReach({ kind: "zombie" }) * 2);
  // And in play: where the zombie test holds for good, a hellhound goes over.
  standAt(lib, 125);
  lib.you.safeMs = 1e9;
  const h = put(lib, "hound", 85);
  lib.events.length = 0;
  for (let k = 0; k < 800 && !events(lib, "leap").length; k++) ghoul.advance(lib, 16, steady);
  assert.equal(events(lib, "leap").length, 1, "it leaps");
  for (let k = 0; k < 100 && h.hop; k++) ghoul.advance(lib, 16, steady);
  assert.ok(!h.dead && h.x > 102 && h.y === 6, `over the pit (${h.x.toFixed(1)}, ${h.y})`);
  // Twice as far is still a limit: a pit wider than the bound holds it.
  const wide = ghoulRound("library");
  wide.spec = { ...wide.spec, ground: [[0, 90, 6], [112, 300, 6]] };
  assert.equal(ghoul.farSide(wide, { kind: "hound", y: 6 }, 90.1, 1), null, "22 across is too far");
});

test("Ghoul Rush: anything on four legs leaps up to higher floor across a gap; no other monster does, and a wall still stops it", () => {
  // Coming back left over a pit to floor above: the Kitchen's counter (6 up to
  // 11, a pit 270 to 282) and the Tower's beams (6 up to 13.5, 240 to 252).
  const over = (id, kind, from, at) => {
    const round = ghoulRound(id);
    standAt(round, at);
    round.you.safeMs = 1e9;
    const m = put(round, kind, from);
    round.events.length = 0;
    for (let k = 0; k < 600 && !events(round, "leap").length; k++) ghoul.advance(round, 16, steady);
    for (let k = 0; k < 100 && m.hop; k++) ghoul.advance(round, 16, steady);
    return { m, round };
  };
  const hound = over("kitchen", "hound", 300, 240);
  assert.ok(!hound.m.dead && hound.m.y === 11 && hound.m.x < 270, `up on the far side (${hound.m.x.toFixed(1)}, ${hound.m.y})`);
  const zombie = over("kitchen", "zombie", 300, 240);
  assert.ok(zombie.m.y === 6 && zombie.m.x > 282, "a zombie stays down");
  assert.equal(events(zombie.round, "leap").length, 0);
  const tower = ghoulRound("tower");
  assert.ok(ghoul.farSide(tower, { kind: "moonhound", y: 6 }, 251.9, -1), "7.5 up is in reach");
  // Higher than the bound is not.
  const high = ghoulRound("kitchen");
  high.spec = { ...high.spec, ground: [[0, 270, 6 + ghoul.BOUND_UP + 1], [282, 400, 6]] };
  assert.equal(ghoul.farSide(high, { kind: "hound", y: 6 }, 281.9, -1), null, "past the bound");
  // The Kitchen's counter face has no gap before it: still a wall.
  const wall = ghoulRound("kitchen");
  standAt(wall, 90);
  wall.you.safeMs = 1e9;
  const h = put(wall, "hound", 60);
  ghoul.advance(wall, 6000, steady);
  assert.ok(h.y === 6 && h.x < 70, `stopped by the wall (${h.x.toFixed(1)}, ${h.y})`);
});

test("Ghoul Rush: down ducks on the ground, on the spot, and drops through a shelf instead; a direction runs and up jumps out of it", () => {
  const round = ghoulRound("gallery");
  round.phase = "play";
  standAt(round, 60);
  round.you.safeMs = 1e9;
  round.input.down = true;
  ghoul.moveYou(round, 16);
  assert.equal(round.you.ducking, true);
  assert.equal(events(round, "duck").length, 1, "a sound as he goes down");
  ghoul.moveYou(round, 16);
  assert.equal(events(round, "duck").length, 1, "only the once");
  const x = round.you.x;
  round.input.right = true;
  ghoul.moveYou(round, 16);
  assert.ok(!round.you.ducking && round.you.x > x, "a direction runs");
  round.input.right = false;
  ghoul.moveYou(round, 16);
  assert.equal(round.you.ducking, true);
  ghoul.jump(round);
  assert.ok(!round.you.ducking && round.you.state === "air", "up jumps out of it");
  round.input.down = false;
  // On a shelf: down still drops.
  const shelf = ghoulRound("gallery");
  standAt(shelf, shelf.spec.shelves[0][0] + 2, 0);
  shelf.input.down = true;
  ghoul.moveYou(shelf, 16);
  assert.ok(!shelf.you.ducking && shelf.you.state === "air", "through the shelf");
  // In the air: no duck.
  const air = ghoulRound("gallery");
  standAt(air, 60);
  ghoul.jump(air);
  air.input.down = true;
  ghoul.moveYou(air, 16);
  assert.equal(air.you.ducking, false);
});

test("Ghoul Rush: ducking passes under every swooper, whatever its dive, and the same swoop hits him standing", () => {
  // Each comes at him as it does in play, from well off and high up.
  const swoopers = {
    bat: { y: 14 },
    crow: { y: 16, act: "climb", wait: 1, vx: 0, vy: 0 },
    moth: { y: 14 },
    gargoyle: { y: 18, act: "wake", wait: 1, px: 40, home: 18 },
    bellbat: { y: 14, act: "swoop" },
    wraith: { y: 16, act: "wind", wait: 1, home: 16 },
    icewraith: { y: 16, act: "wind", wait: 1, home: 16 },
  };
  const swoop = (kind, ducked, x) => {
    const round = ghoulRound("ballroom");
    round.phase = "play";
    round.spec = { ...round.spec, horde: [], spawns: [] };
    round.monsters.length = 0;
    standAt(round, 60);
    round.input.down = ducked;
    const m = put(round, kind, x, swoopers[kind]);
    round.events.length = 0;
    for (let t = 0; t < 4000 && !events(round, "lose").length; t += 8) ghoul.advance(round, 8, steady);
    return { m, lost: events(round, "lose") };
  };
  for (const kind of Object.keys(swoopers)) {
    for (const x of [44, 49, 72, 80]) {
      const under = swoop(kind, true, x);
      assert.equal(under.lost.length, 0, `${kind} from ${x}: passed overhead (${under.lost[0]?.cause})`);
      const up = swoop(kind, false, x);
      assert.equal(up.lost[0]?.cause, kind, `${kind} from ${x}: standing, it hits`);
    }
  }
});

test("Ghoul Rush: ducking does not dodge what comes along the floor, and his bolts fly lower", () => {
  const round = ghoulRound("ballroom");
  round.phase = "play";
  standAt(round, 60);
  round.input.down = true;
  ghoul.moveYou(round, 16);
  put(round, "zombie", 60.5);
  round.events.length = 0;
  ghoul.advance(round, 16, steady);
  assert.equal(events(round, "lose")[0]?.cause, "zombie");
  const low = ghoulRound("ballroom");
  low.phase = "play";
  low.spec = { ...low.spec, horde: [], spawns: [] };
  standAt(low, 60);
  low.you.safeMs = 1e9;
  low.input.down = true;
  low.input.fire = true;
  ghoul.advance(low, 16, steady);
  assert.ok(low.shots.length > 0 && Math.abs(low.shots[0].y - (low.you.y + ghoul.DUCK_SHOT_Y)) < 0.5, "from his crouch");
});

test("Ghoul Rush: walkers cross a bridge level with their floor while it is there, and drop into the pit when it crumbles under them", () => {
  // The Library's first pit [90, 102] has a crumbling board over it at 6.
  const round = ghoulRound("library");
  standAt(round, 120);
  round.you.safeMs = 1e9;
  const z = put(round, "zombie", 80);
  for (let ms = 0; ms < 6000 && z.x < 104; ms += 16) ghoul.advance(round, 16, steady);
  assert.ok(z.x > 102 && z.y === 6 && !z.dead, `over the bridge (${z.x.toFixed(1)})`);
  assert.equal(events(round, "ponder").length, 0, "with no stop to think");
  const r2 = ghoulRound("library");
  standAt(r2, 120);
  const w = put(r2, "zombie", 96);
  w.y = 6;
  r2.down[0] = 1e9;
  ghoul.advance(r2, 1500, steady);
  assert.ok(w.dead || w.y < 0, "the board gone, it falls");
});

test("Ghoul Rush: a zombie, a runner or a crawler stopped by a wall thinks about it, then climbs up it; a glutton never does", () => {
  // The Kitchen's counter: floor at 6 below x 70... and at 11 from 70 to 110.
  const climb = (kind) => {
    const round = ghoulRound("kitchen");
    standAt(round, 90);
    round.you.safeMs = 1e9;
    const m = put(round, kind, 60);
    ghoul.advance(round, 6000, steady);
    return { m, round };
  };
  for (const kind of ["zombie", "runner", "crawler"]) {
    const { m, round } = climb(kind);
    assert.equal(events(round, "scale").length, 1, `${kind}: it climbs`);
    assert.ok(m.y === 11 && m.x > 70 && !m.scale, `${kind}: up on the counter (${m.x.toFixed(1)}, ${m.y})`);
  }
  const { m, round } = climb("glutton");
  assert.ok(m.y === 6 && m.x < 70, "a glutton stays down");
  assert.equal(events(round, "scale").length + events(round, "leap").length, 0);
});

test("Ghoul Rush: a life lost within QUICK_LOSS_MS of coming in brings Planny back holding the Garlic shield; a later one does not", () => {
  const back = (aliveMs) => {
    const round = ghoulRound("foyer");
    round.phase = "play";
    standAt(round, 60);
    round.you.aliveMs = aliveMs;
    assert.ok(ghoul.lose(round, "zombie"));
    for (let ms = 0; ms < 3000 && round.phase !== "play"; ms += 16) ghoul.advance(round, 16, steady);
    return round;
  };
  const quick = back(ghoul.QUICK_LOSS_MS - 100);
  assert.equal(quick.phase, "play");
  assert.ok(quick.you.garlic, "a quick fall: back with the shield");
  assert.ok(events(quick, "power").some((e) => e.kind === "garlic" && e.gift), "and told so");
  const slow = back(ghoul.QUICK_LOSS_MS + 100);
  assert.ok(!slow.you.garlic, "a later fall: no shield");
  assert.equal(slow.you.aliveMs < ghoul.QUICK_LOSS_MS, true, "the clock starts over on coming back");
});

test("Ghoul Rush: every walker comes down off a ledge after you, a glutton included, instead of walking in place at its edge", () => {
  // The Kitchen's counter: floor at 11 from 70 to 110, then at 6 to 150.
  for (const kind of ["zombie", "runner", "glutton", "crawler", "hound"]) {
    const round = ghoulRound("kitchen");
    standAt(round, 135);
    round.you.safeMs = 1e9;
    const m = put(round, kind, 100);
    assert.equal(m.y, 11, `${kind}: starts up on the counter`);
    ghoul.advance(round, 8000, steady);
    // Down off the counter (a hound may be caught mid-lunge).
    assert.ok(m.dead || (m.y < 11 && m.x > 110), `${kind}: down off the counter (${m.x.toFixed(1)}, ${m.y})`);
  }
});

test("Ghoul Rush: a Runner is fast and down in one bolt, a Glutton slow and five times a zombie's bolts with a stomp only hurting it, and now and then a zombie, widow or hound comes as one of them or a Huntsman", () => {
  const M = ghoul.MONSTERS;
  assert.ok(M.runner.speed > M.zombie.speed * 2 && M.runner.hp === 1);
  assert.ok(M.glutton.speed < M.zombie.speed && M.glutton.hp === M.zombie.hp * 5);
  assert.ok(M.huntsman.hp > M.spider.hp && M.huntsman.w > M.spider.w);
  const round = ghoulRound();
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const g = put(round, "glutton", 40);
  Object.assign(round.you, { x: 40, y: g.y + g.h + 0.3, vy: -20, state: "air" });
  ghoul.advance(round, 40, steady);
  assert.ok(!g.dead && g.hp === M.glutton.hp - M.glutton.stompDamage, "a stomp only bruises a glutton");
  // The dice: low rolls are the rare ones.
  assert.equal(ghoul.variant("zombie", () => 0), "glutton");
  assert.equal(ghoul.variant("zombie", () => ghoul.GLUTTON_CHANCE + 0.01), "runner");
  assert.equal(ghoul.variant("zombie", () => 0.9), "zombie");
  assert.equal(ghoul.variant("spider", () => 0), "huntsman");
  assert.equal(ghoul.variant("hound", () => 0.9), "hound");
  assert.equal(ghoul.variant("bat", () => 0), "bat");
});

test("Ghoul Rush: a Runner shrieks once as it nears the view, marked on the screen's edge nearest it, even coming up from behind", () => {
  const round = ghoulRound();
  standAt(round, 200);
  round.you.safeMs = 1e9;
  const r = put(round, "runner", round.camX - ghoul.RUNNER_WARN - 2);
  for (let ms = 0; ms < 3000 && !events(round, "runner").length; ms += 16) ghoul.advance(round, 16, steady);
  const [e] = events(round, "runner");
  assert.ok(e, "it shrieks");
  assert.ok(r.x < round.camX, `before it is on screen (${r.x.toFixed(1)} against ${round.camX.toFixed(1)})`);
  assert.ok(e.x >= round.camX && e.side === -1, "marked on the left edge, behind you");
  ghoul.advance(round, 1500, steady);
  assert.equal(events(round, "runner").length, 1, "once");
});

test("Ghoul Rush: a Huntsman runs at you, crouches, and springs as high as you are, up onto a shelf", () => {
  const round = ghoulRound();
  standAt(round, 68, 0);
  round.you.safeMs = 1e9;
  const h = put(round, "huntsman", 50);
  let top = h.y;
  for (let ms = 0; ms < 4000 && !events(round, "lunge").length; ms += 16) ghoul.advance(round, 16, steady);
  assert.equal(events(round, "growl").length, 1, "it crouches first");
  assert.equal(events(round, "lunge").length, 1, "then springs");
  for (let ms = 0; ms < 1500 && h.act === "leap"; ms += 4) {
    ghoul.advance(round, 4, steady);
    top = Math.max(top, h.y);
  }
  assert.ok(top >= round.you.y, `as high as you on the shelf (${top.toFixed(1)} against ${round.you.y})`);
});

test("Ghoul Rush: the Gourd picks hop, spit or quake at random, never one three times running; a spit lobs acid at you and a quake sends a shockwave both ways", () => {
  const b = { act: "", run: 0 };
  const seen = [];
  for (let k = 0; k < 12; k++) seen.push((b.act = ghoul.gourdAct(b, () => 0)));
  for (let k = 2; k < seen.length; k++) assert.ok(!(seen[k] === seen[k - 1] && seen[k] === seen[k - 2]), `no three in a row (${seen})`);
  assert.deepEqual(new Set(seen.concat(ghoul.GOURD_ACTS)).size, 3);
  const spit = bossFight("ballroom");
  spit.you.safeMs = 1e9;
  ghoul.advance(spit, ghoul.GOURD_WAIT_MS + 20, () => 0.5);
  assert.equal(spit.boss.act, "spit");
  ghoul.advance(spit, ghoul.GOURD_SPIT_MS + 20, () => 0.5);
  assert.equal(spit.bones.filter((x) => x.kind === "acid").length, ghoul.GOURD_SPIT.length, "a glob for each scale");
  const quake = bossFight("ballroom");
  quake.you.safeMs = 1e9;
  ghoul.advance(quake, ghoul.GOURD_WAIT_MS + 20, () => 0.9);
  assert.equal(quake.boss.act, "quake");
  const x = quake.boss.x;
  for (let ms = 0; ms < 2000 && !quake.waves.length; ms += 4) ghoul.advance(quake, 4, () => 0.9);
  assert.equal(quake.boss.x, x, "straight up and down");
  assert.deepEqual(quake.waves.map((w) => w.dir).sort(), [-1, 1], "a shockwave each way");
});

/* ---------------------------------------------------------------- key, door, rooms */

test("Ghoul Rush: the door stays shut until you hold the key, then through it scores ROOM_POINTS times the room, the time bonus left and FLAWLESS_POINTS with no life lost, and the next room comes after CLEAR_MS and READY_MS", () => {
  const round = ghoulRound();
  standAt(round, round.spec.door);
  ghoul.advance(round, 40, steady);
  assert.equal(round.phase, "play", "shut without the key");
  const [kx, ky] = round.spec.key;
  standAt(round, kx, round.spec.shelves.findIndex(([a, b, top]) => kx >= a && kx <= b && top === ky));
  ghoul.advance(round, 4, steady);
  assert.equal(round.hasKey, true);
  assert.equal(events(round, "key").length, 1);
  ghoul.advance(round, 2000, steady);
  assert.equal(round.bonus, ghoul.BONUS_START - 2 * ghoul.BONUS_STEP);
  standAt(round, round.spec.door);
  const before = round.score;
  ghoul.advance(round, 4, steady);
  assert.equal(round.phase, "clear");
  assert.equal(round.score - before, ghoul.ROOM_POINTS * 2 + round.bonus + ghoul.FLAWLESS_POINTS, "the Foyer is the run's second room, after the hall");
  ghoul.advance(round, ghoul.CLEAR_MS + ghoul.READY_MS + 20, steady);
  assert.deepEqual([round.room, round.spec.id, round.phase, round.hasKey], [3, "gallery", "play", false]);
  assert.equal(round.you.x, round.spec.start);
  quiet(round);
  round.roomLost = true;
  round.hasKey = true;
  standAt(round, round.spec.door);
  const b2 = round.score;
  ghoul.advance(round, 4, steady);
  assert.equal(round.score - b2, ghoul.ROOM_POINTS * 3 + round.bonus, "no flawless bonus after a life lost");
});

test("Ghoul Rush: with the time bonus run out, a zombie shambles in from the edge every HURRY_MS", () => {
  const round = ghoulRound();
  standAt(round, 60);
  round.you.safeMs = 1e9;
  Object.assign(round, { bonus: ghoul.BONUS_STEP, bonusMs: 990 });
  ghoul.advance(round, 20, steady);
  assert.deepEqual([round.bonus, round.hurry], [0, true]);
  assert.equal(events(round, "hurry").length, 1);
  ghoul.advance(round, ghoul.HURRY_MS + 20, steady);
  assert.equal(round.monsters.filter((m) => m.kind === "zombie").length, 1);
});

test("Ghoul Rush: each stage is three rooms and a boss's, every room in one stage but the hall, and roomFor builds a room deeper into a run quicker and tougher, its boss with more hp and points, each capped", () => {
  assert.equal(ghoul.ROOMS[0].id, "hall", "every run starts in the hall");
  assert.equal(ghoul.ROOMS[0].boss, null);
  const placed = ghoul.STAGES.flatMap((st) => st.rooms);
  assert.equal(new Set(placed).size, placed.length, "no room in two stages");
  assert.deepEqual([...placed].sort(), ghoul.ROOMS.slice(1).map((r) => r.id).sort(), "every room but the hall in a stage");
  for (const st of ghoul.STAGES) {
    // Four rooms; the Mine's Runaway Cart makes it five.
    assert.ok(st.rooms.length >= 4 && st.rooms.length <= 5, `${st.id}: four rooms (five with a ride)`);
    assert.deepEqual(st.rooms.map((id) => Boolean(ghoul.roomById(id).boss)), [...st.rooms.slice(1).map(() => false), true], `${st.id}: the boss's room last`);
    assert.equal(st.boss, ghoul.roomById(st.rooms.at(-1)).boss);
    assert.ok(ghoul.BOSSES[st.boss], `${st.id}: ${st.boss} is a boss`);
    assert.ok(st.title && st.sub, `${st.id}: named`);
  }
  assert.equal(new Set(ghoul.STAGES.map((st) => st.id)).size, ghoul.STAGES.length, "stage ids are unique");
  assert.equal(ghoul.roomFor("library").name, "Library");
  assert.equal(ghoul.roomFor("library", 2), ghoul.roomFor("library", 2), "built once");
  assert.equal(ghoul.roomName(ghoul.roomFor("library"), 4), "Library (room 4)");
  const deep = ghoul.roomFor("foyer", 6);
  const top = ghoul.roomFor("foyer");
  assert.ok(deep.pace > top.pace && deep.every < top.every && deep.tough > 0 && deep.extra > 0);
  assert.ok(ghoul.roomFor("ballroom", 3).bossHp > ghoul.roomFor("ballroom").bossHp);
  assert.ok(ghoul.roomFor("ballroom", 3).bossPoints > ghoul.roomFor("ballroom").bossPoints);
  assert.equal(ghoul.roomFor("ballroom").bossPoints, ghoul.BOSSES.gourd.points);
  const far = ghoul.roomFor("ballroom", 400);
  assert.ok(far.pace <= 1.4 && far.every >= 0.55 && far.tough <= 2 && far.extra <= 2);
  assert.equal(far.bossHp, ghoul.roomFor("ballroom", ghoul.BOSS_DEPTH_MAX).bossHp, "boss hp stops growing");
  const r = ghoulRound("foyer", 3);
  const z = put(r, "zombie", 80);
  assert.equal(z.hp, ghoul.MONSTERS.zombie.hp + 1, "three stages in, zombies take a bolt more");
});

test("Ghoul Rush: out of the hall, and out of each boss's room, you pick the next stage from two not yet played; left and right move the pick, a press only takes one once the offer settles, and a stage never comes again", () => {
  const round = ghoul.newRound(5);
  round.dice = 0;
  quiet(round);
  assert.deepEqual([round.spec.id, round.stage, round.room], ["hall", null, 1]);
  through(round);
  assert.equal(round.phase, "pick");
  assert.equal(round.offer.length, Math.min(ghoul.OFFER_N, ghoul.STAGES.length));
  assert.equal(new Set(round.offer).size, round.offer.length, "two different stages");
  assert.deepEqual(events(round, "offer").map((e) => e.offer), [round.offer]);
  ghoul.advance(round, 5000, steady);
  assert.equal(round.phase, "pick", "it waits on you");
  const r2 = ghoul.newRound(5);
  r2.dice = 0;
  through(r2);
  assert.equal(ghoul.pickStage(r2), false, "not while the offer settles");
  ghoul.advance(r2, ghoul.PICK_HOLD_MS, steady);
  assert.equal(ghoul.steerPick(r2, -1), false, "already at the left");
  assert.equal(ghoul.steerPick(r2, 1), r2.offer.length > 1);
  const want = r2.offer[r2.pick];
  assert.equal(ghoul.pickStage(r2), true);
  assert.deepEqual([r2.stage, r2.stageAt, r2.offer, r2.room, r2.phase], [want, 0, null, 2, "intro"], "the stage's intro card comes first");
  skipIntro(r2);
  assert.equal(r2.phase, "ready");
  assert.equal(r2.spec.id, ghoul.stageById(want).rooms[0]);
  assert.deepEqual(events(r2, "stage").map((e) => [e.stage, e.n]), [[want, 1]]);
  // Through the stage's rooms in order, then the boss's door: cleared, and
  // the next offer leaves it out.
  for (const id of ghoul.stageById(want).rooms.slice(1)) {
    through(r2);
    assert.equal(r2.spec.id, id);
  }
  through(r2);
  assert.deepEqual(r2.cleared, [want]);
  assert.equal(r2.stats.stages, 1);
  assert.deepEqual(events(r2, "stageClear").map((e) => [e.stage, e.n, e.of]), [[want, 1, ghoul.STAGES.length]]);
  assert.equal(r2.phase, "pick");
  assert.ok(!r2.offer.includes(want), "a stage cleared is never offered again");
  assert.deepEqual(ghoul.stagesLeft(r2).map((st) => st.id), ghoul.STAGES.filter((st) => st.id !== want).map((st) => st.id));
  // A seeded run offers its own pair, and both stages come up across seeds.
  const seen = new Set();
  for (let seed = 1; seed < 40; seed++) {
    const r = ghoul.newRound(seed);
    r.dice = 0;
    r.phase = "clear";
    r.phaseMs = 1;
    ghoul.advance(r, 4, ghoul.seeded(seed));
    seen.add(r.offer[0]);
  }
  assert.equal(seen.size, ghoul.STAGES.length, "the offer is shuffled: any stage can come first");
});

test("Ghoul Rush: clearing every stage wins the run, and its end says so", () => {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  while (!round.over) {
    assert.equal(round.phase, "pick");
    round.phaseMs = 0;
    ghoul.pickStage(round);
    for (let k = 0, n = ghoul.stageById(round.stage).rooms.length; k < n; k++) through(round);
  }
  assert.equal(round.won, true);
  assert.equal(round.cleared.length, ghoul.STAGES.length);
  assert.deepEqual(new Set(round.cleared), new Set(ghoul.STAGES.map((st) => st.id)), "each stage once");
  assert.equal(events(round, "won").length, 1);
  assert.equal(ghoul.advance(round, 16, steady), "over");
});

test("Ghoul Rush: a boss always gives a life (up to MAX_LIVES, 9), and the 1UP turns up a little more often than before", () => {
  assert.equal(ghoul.MAX_LIVES, 9);
  assert.equal(ghoul.POWERS.life.weight, 1.5);
  const round = bossFight("ballroom");
  const b = round.boss;
  round.lives = ghoul.MAX_LIVES - 1;
  b.hp = 1;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 2, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(round.lives, ghoul.MAX_LIVES);
  assert.equal(events(round, "bossDown")[0].life, true);
});

/* ---------------------------------------------------------------- bosses */

// A boss room with you in the arena and the boss awake.
function bossFight(n) {
  const round = ghoulRound(n);
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  assert.equal(round.lockX, round.spec.arena, "the arena locks");
  assert.equal(round.boss.state, "intro");
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  round.events.length = 0;
  return round;
}

test("Ghoul Rush: the Great Gourd hops to where you stood and lands with a slam that lets gourdlings loose, harmless till they find their feet; bolts and stomps hurt it, and its fall opens the door and gives a life back", () => {
  const round = bossFight("ballroom");
  const b = round.boss;
  round.you.safeMs = 1e9;
  ghoul.advance(round, ghoul.GOURD_WAIT_MS + 20, () => 0.1);
  assert.equal(events(round, "hop").length, 1, "it hops");
  const landX = b.landX;
  assert.ok(Math.abs(landX - Math.max(round.you.x, round.spec.arena + ghoul.ARENA_POCKET + b.w / 2)) < 1e-6, "aimed where you stood, short of the corner");
  for (let ms = 0; ms < 2000 && !events(round, "slam").length; ms += 4) ghoul.advance(round, 4, steady);
  assert.ok(Math.abs(b.x - landX) < 0.5, `down where it aimed (${b.x.toFixed(1)})`);
  const seeds = round.monsters.filter((m) => m.kind === "seed");
  assert.ok(seeds.length >= 1 && seeds.length <= ghoul.MAX_SEEDS);
  assert.ok(seeds.every((m) => !ghoul.solid(m)), "harmless in the air");
  for (let ms = 0; ms < 2000 && seeds.some((m) => m.vy !== 0); ms += 4) ghoul.advance(round, 4, steady);
  assert.ok(seeds.every((m) => m.dead || !ghoul.solid(m)), "and as they land");
  // Bolts and a stomp.
  const r2 = bossFight("ballroom");
  const g = r2.boss;
  r2.you.safeMs = 1e9;
  r2.shots.push({ x: g.x - g.w / 2 - 0.2, y: g.y + 2, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(r2, 4, steady);
  assert.equal(g.hp, g.max - 1);
  Object.assign(r2.you, { x: g.x, y: g.y + g.h + 0.3, vy: -20, state: "air" });
  ghoul.advance(r2, 40, steady);
  assert.equal(g.hp, g.max - 1 - ghoul.STOMP_DAMAGE, "a stomp");
  assert.ok(r2.you.vy > 0);
  r2.lives = 2;
  g.hp = 1;
  r2.shots.push({ x: g.x - g.w / 2 - 0.2, y: g.y + 2, vx: 80, vy: 0, gone: 0 });
  const before = r2.score;
  ghoul.advance(r2, 4, steady);
  assert.equal(g.state, "down");
  assert.equal(r2.score - before, ghoul.BOSSES.gourd.points);
  assert.deepEqual([r2.hasKey, r2.lives, r2.monsters.length], [true, 3, 0], "the door opens, a life back, the gourdlings gone");
  standAt(r2, r2.spec.door);
  ghoul.advance(r2, 4, steady);
  assert.equal(r2.phase, "clear");
});

test("Ghoul Rush: the Ballroom's arena is stacked with balconies; the Gourd never lands in a corner's pocket, only spits at you up over its head, and its gourdlings jump up after you and run off the ends after you", () => {
  const spec = ghoul.roomFor("ballroom");
  assert.ok(spec.shelves.filter(([x0]) => x0 >= spec.arena).length >= 8, "balconies across the arena");
  assert.ok(!spec.shelves.some(([x0, x1]) => spec.door >= x0 - 2 && spec.door <= x1 + 2), "none over the door");
  // In a corner, the hop lands short of you.
  for (const end of ["left", "right"]) {
    const round = bossFight("ballroom");
    const b = round.boss;
    round.you.safeMs = 0;
    standAt(round, end === "left" ? round.lockX + 1.5 : round.spec.length - 1.5);
    ghoul.advance(round, ghoul.GOURD_WAIT_MS + 20, () => 0.1);
    assert.equal(b.act, "hop");
    const gap = Math.abs(b.landX - round.you.x) - (b.w + ghoul.HIT_W) / 2;
    assert.ok(gap > 1, `${end} corner: ${gap.toFixed(1)} clear of you`);
  }
  // Up on a balcony over its head, a spit, never a hop.
  const up = bossFight("ballroom");
  const shelf = up.spec.shelves.findIndex(([x0, , top]) => x0 >= up.spec.arena && top === 24);
  standAt(up, up.spec.shelves[shelf][0] + 4, shelf);
  up.you.safeMs = 1e9;
  ghoul.advance(up, ghoul.GOURD_WAIT_MS + 20, () => 0.1);
  assert.equal(up.boss.act, "spit");
  // A gourdling jumps up onto the balcony you are on, then off its end after you.
  const r = bossFight("ballroom");
  r.boss.state = "down";
  const low = r.spec.shelves.findIndex(([x0, , top]) => x0 >= r.spec.arena && top === 15);
  const [x0, x1] = r.spec.shelves[low];
  standAt(r, (x0 + x1) / 2, low);
  r.you.safeMs = 1e9;
  const seed = put(r, "seed", x0 - 4);
  for (let ms = 0; ms < 4000 && seed.y !== 15; ms += 16) ghoul.advance(r, 16, steady);
  assert.equal(seed.y, 15, "up on the balcony");
  assert.ok(events(r, "leap").length >= 1);
  standAt(r, x1 + 10);
  for (let ms = 0; ms < 4000 && seed.y !== 6; ms += 16) ghoul.advance(r, 16, steady);
  assert.equal(seed.y, 6, "and back down after you");
});

test("Ghoul Rush: losing a life in a boss fight puts you back in the arena with the boss's hp kept", () => {
  const round = bossFight("ballroom");
  round.boss.hp = 20;
  ghoul.lose(round, "gourd");
  ghoul.advance(round, ghoul.CRASH_MS + 10, steady);
  assert.equal(round.lockX, round.spec.arena);
  assert.ok(round.you.x > round.spec.arena);
  assert.deepEqual([round.boss.hp, round.boss.state], [20, "intro"]);
});

/* ---------------------------------------------------------------- the house */

test("Ghoul Rush: a chandelier shakes as you run under it, then drops and crushes the monsters under it (double points) and you if you stay", () => {
  const round = ghoulRound();
  const c = round.falls[0];
  standAt(round, c.x - 4);
  const z = put(round, "zombie", c.x + 1, { speed: 0 });
  z.x = c.x + 1;
  ghoul.advance(round, 4, steady);
  assert.equal(c.state, "shake");
  assert.equal(events(round, "creak").length, 1);
  round.monsters.length = 0;
  const z2 = put(round, "zombie", c.x + 2);
  round.you.safeMs = 0;
  for (let ms = 0; ms < 2000 && c.state !== "down"; ms += 4) {
    z2.x = c.x + 2;
    ghoul.advance(round, 4, steady);
  }
  assert.deepEqual(events(round, "kill").map((e) => [e.how, e.points]), [["crush", ghoul.MONSTERS.zombie.points * 2]]);
  assert.deepEqual(events(round, "lose").map((e) => e.cause), ["chandelier"], "you stayed under it");
});

test("Ghoul Rush: a crumbling board shakes CRUMBLE_MS once stood on, falls away, and comes back after CRUMBLE_BACK_MS", () => {
  const round = ghoulRound("library");
  const i = round.spec.shelves.findIndex((s) => s[3] === "crumble" && s[2] > 6);
  const [x0, x1] = round.spec.shelves[i];
  standAt(round, (x0 + x1) / 2, i);
  ghoul.advance(round, 4, steady);
  assert.equal(round.shake[i], ghoul.CRUMBLE_MS);
  ghoul.advance(round, ghoul.CRUMBLE_MS + 8, steady);
  assert.equal(ghoul.shelfThere(round, i), false);
  assert.equal(round.you.state, "air", "and you fall with it");
  ghoul.advance(round, ghoul.CRUMBLE_BACK_MS + 8, steady);
  assert.equal(ghoul.shelfThere(round, i), true);
});

test("Ghoul Rush: a hit costs a life, holds CRASH_MS, puts you back at the start safe for SAFE_MS (nothing hurts you then), and the last life ends the round", () => {
  const round = ghoulRound();
  standAt(round, 60);
  // Long enough in the room that the fall brings no Garlic shield back.
  round.you.aliveMs = ghoul.QUICK_LOSS_MS;
  const z = put(round, "zombie", 60);
  ghoul.advance(round, 4, steady);
  assert.deepEqual([round.phase, round.lives], ["crash", ghoul.START_LIVES - 1]);
  ghoul.advance(round, ghoul.CRASH_MS + ghoul.READY_MS + 20, steady);
  assert.equal(round.phase, "play");
  assert.ok(!round.monsters.includes(z) && round.spawns.every((st) => !st.done), "the room's monsters back where they began");
  quiet(round);
  put(round, "skeleton", round.you.x, { throwIn: 1e9 });
  ghoul.advance(round, ghoul.SAFE_MS - 100, steady);
  assert.equal(round.lives, ghoul.START_LIVES - 1, "safe for a moment");
  ghoul.advance(round, 300, steady);
  assert.equal(round.lives, ghoul.START_LIVES - 2, "then not");
  ghoul.advance(round, ghoul.CRASH_MS + 10, steady);
  round.lives = 1;
  round.phase = "play";
  ghoul.lose(round, "bat");
  ghoul.advance(round, ghoul.CRASH_MS + 10, steady);
  assert.equal(round.over, true);
});

test("Ghoul Rush: the banner's strip ignores a roosting bat, a faded ghost and a crawler still coming up", () => {
  const round = ghoulRound("library");
  standAt(round, 30);
  const high = ghoul.FIELD_H * 0.3;
  const y = ghoul.FIELD_H - high - 1;
  const bat = put(round, "bat", 50, { y, awake: false });
  assert.equal(ghoul.underBanner(round, high), false, "asleep: it does not count");
  bat.awake = true;
  assert.equal(ghoul.underBanner(round, high), true, "awake, it does");
  round.monsters.length = 0;
  put(round, "ghost", 50, { y, phase: ghoul.GHOST_SHOW_MS + 600 });
  assert.equal(ghoul.underBanner(round, high), false, "a faded ghost does not");
  round.monsters.length = 0;
  put(round, "crawler", 50, { y, rise: 300 });
  assert.equal(ghoul.underBanner(round, high), false, "nor a crawler still coming up");
});

test("Ghoul Rush: a level bolt from the Crypt's shelf finds Old Rattlebones' skull for double", () => {
  const round = bossFight("crypt");
  const b = round.boss;
  const shelf = round.spec.shelves.findIndex(([x0, x1, y]) => y === 17);
  const [x0, x1] = round.spec.shelves[shelf];
  standAt(round, (x0 + x1) / 2, shelf);
  round.you.safeMs = 1e9;
  b.t = -1e9;
  b.x = round.you.x + 14;
  const hp = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.3, y: round.you.y + ghoul.SHOT_Y, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.hp, hp - 2, "the skull");
  assert.ok(b.y + b.h * ghoul.SKULL_FROM < round.you.y + ghoul.SHOT_Y);
});

test("Ghoul Rush: a jump saved for a landing and let go before it still rises CUT_AFTER_MS before the cut, never a twitch", () => {
  const round = ghoulRound();
  const you = round.you;
  standAt(round, 40);
  Object.assign(you, { state: "air", y: 6.6, vy: -10 });
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  round.input.up = false;
  let top = 0;
  for (let k = 0; k < 400 && (k < 30 || you.state === "air"); k++) {
    ghoul.advance(round, 4, steady);
    top = Math.max(top, you.y - 6);
  }
  assert.ok(top > 3.5, `a real hop (${top.toFixed(2)} up)`);
  assert.ok(top < ghoul.JUMP_TOP / 2, "but still a short one");
});

test("Ghoul Rush: a life lost in a boss's arena after it fell puts you back in the arena, never across the room", () => {
  const round = bossFight("ballroom");
  round.boss.state = "down";
  round.hasKey = true;
  ghoul.lose(round, "bat");
  ghoul.advance(round, ghoul.CRASH_MS + 10, steady);
  assert.equal(round.you.x, round.spec.arena + ghoul.BOSS_LOCK + 2);
  assert.equal(round.lockX, round.spec.arena);
});

/* ---------------------------------------------------------------- layouts */

const MARGIN = 0.6;

// The surfaces of a room a route may use: its ground pieces and its shelves
// that never crumble.
function surfaces(base) {
  // A thin tile (the Frozen Lake's) may break: the route must work with it cut out, a pit to jump.
  const pieces = [];
  for (const [x0, x1, y] of base.ground) {
    let a = x0;
    for (const [t0, t1] of (base.thin || []).filter(([t0, t1]) => t0 >= x0 && t1 <= x1).sort((p, q) => p[0] - q[0])) {
      pieces.push({ x0: a, x1: t0, y, ground: true });
      a = t1;
    }
    pieces.push({ x0: a, x1, y, ground: true });
  }
  return [...pieces, ...base.shelves.filter((s) => s[3] !== "crumble").map(([x0, x1, y]) => ({ x0, x1, y, ground: false }))];
}

// Whether a run and jump from surface A reaches surface B.
function reaches(A, B) {
  const dy = B.y - A.y;
  const touching = A.ground && B.ground && (A.x1 === B.x0 || B.x1 === A.x0);
  if (touching && Math.abs(dy) <= ghoul.STEP_UP) return true;
  const gap = Math.max(B.x0 - A.x1, A.x0 - B.x1);
  if (gap <= 0) return dy < 0 || dy <= ghoul.JUMP_TOP - MARGIN;
  return ghoul.jumpHeightAt(gap + MARGIN) >= dy + MARGIN;
}

// The surfaces reachable from `from`.
function reachable(list, from) {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const a = queue.shift();
    for (const b of list) if (!seen.has(b) && reaches(a, b)) (seen.add(b), queue.push(b));
  }
  return seen;
}

const surfaceAt = (list, x, y) => list.find((s) => x >= s.x0 && x <= s.x1 && s.y === y);

test("Ghoul Rush: every room can be finished: a route from the start to the key and on to the door, every pit narrower than a jump clears, every rise lower than a jump, and everything placed on a surface", () => {
  for (const base of ghoul.ROOMS) {
    // A ride room is not walked: its own suite (ghoul-cart) proves the ride can be finished.
    if (base.ride) continue;
    const list = surfaces(base);
    const g = base.ground;
    for (let i = 0; i + 1 < g.length; i++) {
      assert.ok(g[i][1] <= g[i + 1][0], `${base.id}: ground in order`);
      const gap = g[i + 1][0] - g[i][1];
      const dy = g[i + 1][2] - g[i][2];
      if (gap > 0) assert.ok(ghoul.jumpHeightAt(gap + MARGIN) >= dy + MARGIN, `${base.id}: the pit at ${g[i][1]} (${gap} wide, ${dy} up) clears`);
      else assert.ok(dy <= ghoul.JUMP_TOP - MARGIN, `${base.id}: the rise at ${g[i][1]} (${dy}) clears`);
    }
    assert.equal(g[0][0], 0);
    assert.equal(g.at(-1)[1], base.length);
    for (const [a, b] of base.thin || []) assert.ok(ghoul.jumpHeightAt(b - a + MARGIN) >= MARGIN, `${base.id}: the thin tile at ${a} (${b - a} wide) can be jumped`);
    const start = surfaceAt(list, base.start, ghoul.groundAt(base, base.start));
    const door = surfaceAt(list, base.door, ghoul.groundAt(base, base.door));
    assert.ok(start && door, `${base.id}: start and door on the ground`);
    assert.ok(base.door > base.length - 14, `${base.id}: the door at the room's end`);
    let from = start;
    if (base.key) {
      const key = surfaceAt(list, base.key[0], base.key[1]);
      assert.ok(key, `${base.id}: the key on a surface that stays`);
      assert.ok(reachable(list, start).has(key), `${base.id}: a route to the key`);
      from = key;
    }
    assert.ok(reachable(list, from).has(door), `${base.id}: a route on to the door`);
    for (const [kind, x, y] of base.items) assert.ok(base.shelves.some(([a, b, top]) => x >= a && x <= b && top === y) || ghoul.groundAt(base, x) === y, `${base.id}: the ${kind} on a surface`);
    for (const s of base.spawns) {
      assert.ok(s[1] > 0 && s[1] < base.length, `${base.id}: ${s[0]} in the room`);
      if (s[0] === "door" || s[0] === "crawl" || s[0] === "zombie" || s[0] === "hound" || s[0] === "spitter") assert.ok(ghoul.groundAt(base, s[1]) > -Infinity, `${base.id}: the ${s[0]} at ${s[1]} on the ground`);
      if (s[0] === "spider") assert.ok(ghoul.groundAt(base, s[1]) > -Infinity, `${base.id}: the widow at ${s[1]} over a floor`);
      if (s[0] === "skel") assert.ok(base.shelves.some(([a, b, top]) => s[1] >= a && s[1] <= b && top === s[2]) || ghoul.groundAt(base, s[1]) === s[2], `${base.id}: the skeleton at ${s[1]} on a surface`);
    }
    for (const x of base.chandeliers) assert.ok(ghoul.groundAt(base, x) > -Infinity, `${base.id}: the chandelier at ${x} over the floor`);
    if (base.boss) assert.ok(base.length - ghoul.FIELD_W > 30, `${base.id}: room to walk into the arena`);
  }
});

/* ---------------------------------------------------------------- the bot */

// A bot for Planny that runs for the key then the door, holds fire and turns
// to shoot what comes close, jumps pits, walls, the key's shelves and low
// monsters, jump-shoots monsters up a step, steers onto heads, drops through
// shelves it is done with, dodges bones, chandeliers and gourdlings, keeps
// clear of the Gourd as it hops and jumps Rattlebones' shockwaves. `skill`
// 1 is sharp, and holds fire but lets the blaster cool once it starts to
// slow (to half its free heat), unless a monster is close; lower skill stops
// now and then, misses some jumps, and lets go of fire, as a casual player
// does.
const go0 = (tx, you) => (tx > you.x ? 1 : tx < you.x ? -1 : you.face);
function makeBot(G, skill, random) {
  let idle = 0;
  let last = -1;
  let late = 0;
  let venting = false;
  const missed = new Set();
  return (round) => {
    const { you, input: inp, spec } = round;
    const dt = last < 0 ? 16 : Math.max(0, round.clock - last);
    last = round.clock;
    inp.left = inp.right = inp.down = false;
    if (round.phase !== "play") {
      inp.up = false;
      inp.fire = false;
      return;
    }
    if (skill < 1 && idle <= 0 && random() < (1 - skill) * dt * 0.0004) idle = 200 + random() * 900;
    idle = Math.max(0, idle - dt);
    let tx = !round.hasKey && spec.key ? spec.key[0] : spec.door;
    const boss = round.boss && round.boss.state !== "down" && round.boss.state !== "sleep" ? round.boss : null;
    const fire = skill >= 1 || random() < 0.5 + skill * 0.5;
    let face = 0;
    let near = null;
    for (const m of round.monsters) {
      if (!G.solid(m)) continue;
      if (m.x < round.camX - 2 || m.x > round.camX + G.FIELD_W + 2) continue;
      if (Math.abs(m.y + m.h / 2 - (you.y + G.SHOT_Y)) > (m.kind === "wraith" ? 16 : 7)) continue;
      if (!near || Math.abs(m.x - you.x) < Math.abs(near.x - you.x)) near = m;
    }
    let jumpNow = false;
    if (boss) {
      const side = you.x < boss.x ? -1 : 1;
      tx = boss.x + side * (boss.kind === "gourd" ? 22 : 26);
      face = Math.sign(boss.x - you.x);
      if (boss.kind === "gourd" && boss.y > G.groundAt(spec, boss.x) + 0.1) {
        if (Math.abs(you.x - boss.landX) < boss.w / 2 + 6) tx = boss.landX + (you.x < boss.landX ? -1 : 1) * (boss.w / 2 + 8);
        if (tx < spec.arena + 3 || tx > spec.length - 3) tx = boss.landX + (you.x < boss.landX ? 1 : -1) * (boss.w / 2 + 8);
        // Pinned against the arena's end: run under it while it is up, to
        // the side with room.
        if (boss.act === "hop" && boss.y > G.groundAt(spec, boss.x) + 4 && (side > 0 ? spec.length - 3 - boss.landX : boss.landX - spec.arena - 3) < 24) tx = boss.landX - side * (boss.w / 2 + 12);
      }
      if (near && Math.abs(near.x - you.x) < 14) face = Math.sign(near.x - you.x) || face;
      for (const w of round.waves) if (Math.sign(you.x - w.x) === w.dir && Math.abs(w.x - you.x) < 4.5) jumpNow = true;
    } else if (near && Math.abs(near.x - you.x) < 26) face = Math.sign(near.x - you.x);
    // A glutton in the way soaks up bolts for too long: jump over it.
    for (const m of round.monsters) {
      const ahead = (m.x - you.x) * (go0(tx, you) || you.face);
      if (m.kind === "glutton" && !m.dead && you.state === "run" && Math.abs(m.y - you.y) < 2 && ahead > 0 && ahead < 7) jumpNow = true;
    }
    // Where every bone and glob in the air comes down at your chest's height,
    // and the way to run (or not) that stays furthest from all of them.
    let dodge = false;
    const threats = [];
    for (const b of round.bones) {
      const dy = b.y - (you.y + 2.4);
      const disc = b.vy * b.vy + 2 * G.BONE_G * dy;
      if (disc < 0) continue;
      const t = (b.vy + Math.sqrt(disc)) / G.BONE_G;
      if (t >= 0.05 && t <= 1.4) threats.push({ t, px: b.x + b.vx * t });
    }
    if (boss && boss.kind === "gourd" && round.bones.length) {
      // The Gourd's spit: run on past where the furthest glob comes down.
      const lands = round.bones.map((b) => {
        const disc = b.vy * b.vy + 2 * G.BONE_G * (b.y - you.y);
        return b.x + b.vx * ((b.vy + Math.sqrt(Math.max(0, disc))) / G.BONE_G);
      });
      const side = you.x < boss.x ? -1 : 1;
      tx = side < 0 ? Math.min(...lands) - 5 : Math.max(...lands) + 5;
      if (tx < spec.arena + 3 || tx > spec.length - 3) tx = side < 0 ? Math.max(...lands) + 4 : Math.min(...lands) - 4;
      dodge = true;
    } else if (threats.length) {
      const room = (d) => {
        const x = you.x + d * 8;
        return x > (boss ? spec.arena + 3 : 3) && x < spec.length - 3;
      };
      const miss = (d) => Math.min(...threats.map(({ t, px }) => Math.abs(px - (you.x + d * G.RUN_SPEED * Math.min(t, 0.5)))));
      const way = go0(tx, you);
      if (miss(way) <= 3.5) {
        const pick = [way, -way, 0, 1, -1].filter(room).sort((a, c) => miss(c) - miss(a))[0] ?? 0;
        tx = you.x + pick * 8;
        dodge = true;
      }
    }
    for (const m of round.monsters) {
      const dx = m.x - you.x;
      const dirTo = Math.sign(tx - you.x);
      if (!boss && m.rise > 0 && Math.sign(dx) === dirTo && Math.abs(dx) < 9) tx = you.x - dirTo * 2;
    }
    if (boss && boss.kind === "gourd" && boss.vy === 0 && boss.wait < 600 && Math.abs(you.x - boss.x) < 15) {
      const side = you.x < boss.x ? -1 : 1;
      tx = boss.x + side * 22;
      if (tx < spec.arena + 3 || tx > spec.length - 3) tx = boss.x - side * 22;
      dodge = true;
    }
    if (boss) {
      for (const m of round.monsters) {
        if (m.kind !== "seed" || m.vy !== 0 || Math.abs(m.x - you.x) >= 4) continue;
        tx = m.x + (you.x >= m.x ? 7 : -7);
        if (tx < spec.arena + 3 || tx > spec.length - 3) tx = m.x + (you.x >= m.x ? -7 : 7);
        dodge = true;
      }
    }
    // Never stand in a burning puddle (nor run through one): head for the
    // nearest spot clear of them all.
    const clear = G.PUDDLE_W / 2 + 1.5;
    const wet = (x) => round.puddles.some((p) => p.y <= you.y + 1 && Math.abs(p.x - x) < clear);
    if (wet(tx) || wet(you.x)) {
      const lo = boss ? spec.arena + 3 : 3;
      for (let d = 0; d <= 30; d += 0.5) {
        const pick = [tx + d, tx - d].find((x) => x > lo && x < spec.length - 3 && !wet(x));
        if (pick !== undefined) {
          tx = pick;
          break;
        }
      }
      dodge = true;
    }
    for (const c of round.falls) {
      if ((c.state === "shake" || c.state === "fall") && Math.abs(c.x - you.x) < 6) {
        tx = c.x + (go0(tx, you) >= 0 ? 9 : -9);
        dodge = true;
      }
    }
    if (idle > 0) tx = you.x;
    const slack = boss && !dodge ? 2 : 0.6;
    let go = tx > you.x + slack ? 1 : tx < you.x - slack ? -1 : 0;
    const airBoss = boss && boss.kind === "gourd" && boss.y > G.groundAt(spec, boss.x) + 0.1 && Math.abs(you.x - boss.landX) < boss.w / 2 + 6;
    if (!dodge && !airBoss && face && face !== go && (!go || (near && Math.abs(near.x - you.x) < 14) || boss)) {
      if (!near || Math.abs(near.x - you.x) > 1.5) go = you.face === face ? 0 : face;
    }
    // A ghost ahead and not yet level with your blaster: hold, face it and
    // shoot as it comes. A wraith about to dive or diving: keep moving, so it
    // dives at where you were.
    if (!dodge && !boss) {
      for (const m of round.monsters) {
        if (m.kind === "wraith" && (m.act === "wind" || m.act === "dive") && Math.abs(m.x - you.x) < 34) {
          go = go || you.face;
          break;
        }
        if (m.kind !== "ghost" || !G.roused(m)) continue;
        const dx = m.x - you.x;
        if (Math.abs(dx) < 16 && Math.abs(m.y + m.h / 2 - (you.y + G.SHOT_Y)) > 2) {
          go = you.face === Math.sign(dx) ? 0 : Math.sign(dx);
          break;
        }
      }
    }
    if (you.state === "air" && you.vy < 0 && !boss) {
      for (const m of round.monsters) {
        if (!G.solid(m) || !G.MONSTERS[m.kind].stomp) continue;
        const top = m.y + m.h;
        if (you.y > top && you.y - top < 10 && Math.abs(m.x - you.x) < 7) go = Math.abs(m.x - you.x) < 0.5 ? 0 : Math.sign(m.x - you.x);
      }
    }
    if (you.state === "air") {
      const lands = (d) => {
        let x = you.x;
        let y = you.y;
        let vy = you.vy;
        for (let k = 0; k < 120; k++) {
          vy -= G.GRAVITY * 0.016;
          x += d * G.RUN_SPEED * 0.016;
          y += vy * 0.016;
          const gy = G.groundAt(spec, x);
          if (vy < 0 && y <= gy) return true;
          if (gy > y + 0.1 && gy > -Infinity) return true;
          if (y < -2) return false;
        }
        return true;
      };
      if (!lands(go)) go = [0, -go || -you.face, go || you.face].find((d) => lands(d)) ?? go;
    }
    const below = G.groundAt(spec, you.x);
    if (you.state === "run" && you.shelf >= 0 && !boss && Math.abs(tx - you.x) > 6 && below > -Infinity && below < you.y - 3 && !(!round.hasKey && spec.key && spec.key[1] >= you.y - 1)) {
      inp.down = true;
      go = 0;
    }
    if (go) inp[go > 0 ? "right" : "left"] = true;
    if (you.state === "run") {
      const dir = go || you.face;
      const ahead = you.x + dir * 2.4;
      const g1 = G.groundAt(spec, ahead);
      const f = G.footing(round, ahead, you.y);
      if (go && you.shelf < 0 && (!f || g1 === -Infinity || g1 > you.y + G.STEP_UP)) jumpNow = true;
      if (go && you.shelf >= 0 && !f && G.groundAt(spec, ahead + dir * 2) === -Infinity) jumpNow = true;
      for (const m of round.monsters) {
        const dx = (m.x - you.x) * you.face;
        if (!boss && G.solid(m) && m.kind !== "bat" && dx > 0 && dx < 12 && m.y > you.y + 1.5 && m.y < you.y + 9) jumpNow = true;
      }
      if (!round.hasKey && spec.key && Math.abs(spec.key[0] - you.x) < 1.5 && spec.key[1] > you.y + 1) jumpNow = true;
      // A puddle of acid just ahead on this level: over it.
      for (const p of round.puddles) {
        const dx = (p.x - you.x) * (go || you.face);
        if (p.y === you.y && dx > -1 && dx < 5.5) jumpNow = true;
      }
      for (const m of round.monsters) {
        if (boss || !G.solid(m) || m.kind === "ghost" || m.kind === "bat") continue;
        if (Math.abs(m.y - you.y) < 2 && Math.abs(m.x - you.x) < 3.4 && m.h < 3) jumpNow = true;
      }
    }
    if (jumpNow && skill < 1 && !missed.has(round.clock >> 9) && random() < (1 - skill) * 0.25) {
      missed.add(round.clock >> 9);
      late = 250;
    }
    if (late > 0) {
      late -= dt;
      jumpNow = false;
    }
    if (jumpNow && you.state === "run") {
      inp.jump = G.JUMP_BUFFER_MS;
      inp.up = true;
    } else if (you.state === "run") inp.up = false;
    if (skill >= 1) {
      if (round.heat >= G.HEAT_FREE) venting = true;
      else if (round.heat <= G.HEAT_FREE / 2) venting = false;
      const gap = near ? Math.abs(near.x - you.x) : Infinity;
      inp.fire = !venting || gap < 20 || round.effects.rapid > 0;
      return;
    }
    inp.fire = fire && !(idle > 0 && skill < 1);
  };
}

// Plays a round with a bot until it gets through `rooms` rooms or runs out
// of lives (or time): each room's seconds and lives lost, and the tones.
function botPlay(seed, skill, rooms, limitMs = 15 * 60000) {
  const random = ghoul.seeded(seed * 977 + 13);
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  const bot = makeBot(ghoul, skill, ghoul.seeded(seed * 31 + 7));
  const per = [];
  let ms = 0;
  let at = 0;
  let lost = 0;
  while (!round.over && round.room <= rooms && ms < limitMs) {
    // Out of the hall it takes the Manor (the house in its old order), then
    // whatever is left.
    if (round.phase === "pick" && round.phaseMs <= 0) {
      if (!round.cleared.includes("manor") && !round.offer.includes("manor")) round.offer[0] = "manor";
      ghoul.pickStage(round, Math.max(0, round.offer.indexOf("manor")));
      skipIntro(round);
    }
    // A boss room opens on its card (a stage's own was skipped at the pick).
    skipIntro(round);
    bot(round);
    ghoul.advance(round, 16, random);
    ms += 16;
    for (const e of round.events) {
      if (e.type === "lose") lost++;
      if (e.type === "clear") {
        per.push({ secs: (ms - at) / 1000, lost });
        at = ms;
        lost = 0;
      }
    }
    round.events.length = 0;
  }
  return { round, per, ms };
}

test("Ghoul Rush: of ten runs a sharp bot gets nearly all through the hall and the Foyer, most past the Rotting Gourd and some on into the next stage, in 10 to 40 seconds a room (60 for the Gourd's), a sloppy one that dawdles and misses jumps is dead inside two minutes, and holding right and fire never gets past the Gallery", () => {
  // The house is a real fight now (runners, gluttons, huntsmen, piles that
  // climb, a Gourd with three moves), and the bot plays it simply, so this
  // checks the share of ten runs rather than every one.
  let outOfFoyer = 0;
  let pastGourd = 0;
  let through = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const { round, per } = botPlay(seed, 1, 6);
    if (round.room >= 3) outOfFoyer++;
    if (round.room >= 6) pastGourd++;
    if (round.room < 7) continue;
    through++;
    // The Rotting Gourd's room (the fifth, after the hall) runs longer: the
    // blaster has to cool between bursts at a boss. So does the sixth, the
    // first of whichever stage the pick deals (it changes with every stage
    // added: Hollow End's Main Street takes the bot up to a minute). The
    // Gourd's bound has room for the slow end of the bot's spread, about a
    // minute, which is one seed or two in thirty.
    per.forEach((p, i) => assert.ok(p.secs >= 10 && p.secs <= (i === 4 ? 65 : i === 5 ? 70 : 40), `seed ${seed}: room ${i + 1} took ${p.secs.toFixed(1)} s`));
  }
  assert.ok(outOfFoyer >= 9, `${outOfFoyer} of 10 through the hall and out of the Foyer`);
  assert.ok(pastGourd >= 5, `${pastGourd} of 10 past the Gourd`);
  assert.ok(through >= 3, `${through} of 10 through five rooms`);
  for (const seed of [1, 2, 3, 4, 5]) {
    const { round, ms } = botPlay(seed, 0.3, 99, 6 * 60000);
    assert.equal(round.over, true, `sloppy seed ${seed} loses (room ${round.room})`);
    assert.ok(ms > 20000 && ms < 2 * 60000, `in ${(ms / 1000).toFixed(0)} s`);
  }
  for (const seed of [1, 2, 3]) {
    const random = ghoul.seeded(seed);
    const round = ghoul.newRound(seed);
    round.dice = 0;
    round.lives = 3;
    for (let ms = 0; ms < 3 * 60000 && !round.over; ms += 16) {
      Object.assign(round.input, { right: true, fire: true, up: false });
      if (round.you.state === "run" && Math.floor(ms / 700) % 2 === 0) Object.assign(round.input, { jump: ghoul.JUMP_BUFFER_MS, up: true });
      ghoul.advance(round, 16, random);
      round.events.length = 0;
    }
    // The Garlic gift for a quick loss can carry a masher out of the hall; it
    // then waits on the stage pick, since it never picks, and goes no further.
    assert.ok((round.over || round.phase === "pick") && round.room <= 2, `a masher (seed ${seed}) is dead, or stuck on the pick, by the Gallery (room ${round.room}, ${round.phase})`);
  }
});

/* ---------------------------------------------------------------- game */

// On the pick screen, takes the Manor (put on offer if it is not, and not
// yet cleared) once the offer settles, so a run goes through the house in
// its old order.
function takeManor(g) {
  const r = g.round;
  if (r.phase !== "pick") return;
  r.phaseMs = 0;
  if (!r.cleared.includes("manor") && !r.offer.includes("manor")) r.offer[0] = "manor";
  r.pick = Math.max(0, r.offer.indexOf("manor"));
  g.key("action");
  leaveIntro(g);
}

// Past a stage's intro card the way a player does: the minimum wait, then fire.
function leaveIntro(g) {
  if (g.round.phase !== "intro" && g.round.phase !== "bossintro") return;
  for (let ms = 0; ms < ghoul.INTRO_MIN_MS + 50; ms += 16) g.tick(16);
  g.key("action");
}

// Starts a game with nothing waking.
function ghoulGame(opts = {}) {
  const { canvas, calls } = stubCanvas();
  const g = ghoul.default.create({ canvas, ...opts });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  g.tick(16);
  quiet(g.round);
  return { g, calls };
}

test("Ghoul Rush game: held arrows run until let go; up jumps once a press, never on its key repeat, never again until let go, never with the press that plays on; space held fires and let go stops; a pause lets go of everything", () => {
  const { g } = ghoulGame();
  const you = g.round.you;
  const x0 = you.x;
  g.key("right", true);
  for (let i = 0; i < 20; i++) g.tick(16);
  assert.ok(you.x > x0 + 4, "right held through the countdown (its repeats) runs");
  g.release("right");
  assert.equal(g.round.input.right, false);
  g.key("up", true);
  g.tick(16);
  assert.equal(you.state, "run", "a repeat of up never jumps");
  g.release("up");
  g.key("up");
  g.tick(16);
  assert.equal(you.state, "air", "a press jumps");
  for (let i = 0; i < 80; i++) {
    g.key("up", true);
    g.tick(16);
  }
  assert.equal(you.state, "run", "held, it jumped only once");
  g.key("up");
  g.tick(16);
  assert.equal(you.state, "run", "a second press with up still held does nothing");
  g.release("up");
  g.key("action");
  g.tick(16);
  assert.ok(g.round.shots.length >= 1, "space fires");
  for (let i = 0; i < 30; i++) g.tick(16);
  assert.ok(g.round.stats.shots >= 3, "and keeps firing while held");
  g.release("action");
  const shots = g.round.stats.shots;
  for (let i = 0; i < 30; i++) g.tick(16);
  assert.equal(g.round.stats.shots, shots, "let go, it stops");
  g.key("left");
  g.key("action");
  g.pause();
  assert.deepEqual(g.round.input, { up: false, down: false, left: false, right: false, fire: false, jump: 0 }, "a pause holds nothing");
  g.resume();
  g.key("up");
  g.tick(16);
  assert.equal(you.state, "run", "the press that plays on never jumps");
  g.release("up");
  g.key("up");
  g.tick(16);
  assert.equal(you.state, "air");
  const y = you.y;
  g.pause();
  g.tick(500);
  assert.equal(you.y, y, "a pause holds a jump mid-air");
});

test("Ghoul Rush game: space while paused does nothing (only the window plays on, through resume()), and a start from ready or over by space or Enter leaves fire off", () => {
  const { canvas } = stubCanvas();
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  g.round.dice = 0;
  assert.equal(g.state, "running");
  assert.equal(g.round.input.fire, false, "the press that starts never fires");
  g.pause();
  assert.equal(g.key("action"), true);
  assert.equal(g.state, "paused", "still paused");
  g.resume();
  assert.equal(g.state, "running");
  assert.equal(g.round.input.fire, false);
  g.round.lives = 1;
  ghoul.lose(g.round, "zombie");
  for (let ms = 0; ms < ghoul.CRASH_MS + 200 && g.state === "running"; ms += 16) g.tick(16);
  assert.equal(g.state, "over");
  g.key("action");
  assert.equal(g.state, "running");
  assert.equal(g.round.input.fire, false, "nor the press that starts again");
  g.tick(16);
  assert.equal(g.round.shots.length, 0);
});

test("Ghoul Rush game: the start screen names the record, the pick screen shows each stage offered and takes left, right and space, the memo keeps the most stages cleared and only grows, and the round's end shows its score big with onScore called once", (t) => {
  t.mock.method(Math, "random", ghoul.seeded(4));
  const { canvas, texts } = textCanvas();
  let saved = 0;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = ghoul.default.create({ canvas, memo, onScore: (n) => scores.push(n) });
  g.resize(900, 900);
  assert.ok(texts.some(([t]) => t.includes(`Best: 0 of ${ghoul.STAGES.length} stages`)), "the start screen names the record");
  g.key("action");
  skipStory(g);
  g.round.dice = 0;
  g.tick(16);
  const through = () => {
    leaveIntro(g);
    const r = g.round;
    quiet(r);
    r.hasKey = true;
    if (r.boss) r.boss.state = "down";
    standAt(r, r.spec.door);
    for (let ms = 0; ms < ghoul.CLEAR_MS + ghoul.READY_MS + ghoul.CARD_MS + 200 && g.round.phase !== "pick"; ms += 16) g.tick(16);
  };
  through();
  assert.equal(g.round.phase, "pick");
  texts.length = 0;
  g.tick(16);
  assert.ok(texts.some(([t]) => t === "Choose your way in"), "the pick screen");
  for (const id of g.round.offer) assert.ok(texts.some(([t]) => t === ghoul.stageById(id).title), `${id} on a card`);
  assert.ok(texts.some(([t]) => t.startsWith("Boss: ")), "each card names its boss");
  g.key("right");
  g.key("action");
  assert.equal(g.round.phase, "pick", "a press before the offer settles does nothing");
  for (let ms = 0; ms < ghoul.PICK_HOLD_MS + 50; ms += 16) g.tick(16);
  assert.equal(g.round.pick, 1, "right picked out the second");
  g.key("left");
  assert.equal(g.round.pick, 0);
  g.key("action", true);
  assert.equal(g.round.phase, "pick", "never on a key repeat");
  const want = g.round.offer[0];
  g.key("action");
  assert.deepEqual([g.round.stage, g.round.input.fire, g.round.phase], [want, false, "intro"], "space takes the stage, and fires nothing");
  leaveIntro(g);
  for (let k = 0; k < ghoul.stageById(want).rooms.length - 1; k++) {
    through();
    assert.equal(saved, 0, "no stage cleared yet");
  }
  through();
  assert.equal(saved, 1, "a stage cleared is saved");
  assert.equal(g.round.phase, "pick");
  texts.length = 0;
  g.tick(16);
  assert.ok(texts.some(([t]) => t === `STAGE 1 OF ${ghoul.STAGES.length} CLEARED`));
  for (let ms = 0; ms < ghoul.PICK_HOLD_MS + 50; ms += 16) g.tick(16);
  g.key("up");
  assert.ok(g.round.stage && g.round.stage !== want, "up takes one too, never the stage just cleared");
  leaveIntro(g);
  for (let ms = 0; ms < ghoul.READY_MS + 50; ms += 16) g.tick(16);
  g.round.dice = 0;
  g.round.lives = 1;
  ghoul.lose(g.round, "zombie");
  for (let ms = 0; ms < ghoul.CRASH_MS + 200 && g.state === "running"; ms += 16) g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
  texts.length = 0;
  g.resize(900, 900);
  assert.ok(texts.some(([t, font]) => t === String(g.score) && /\b7px/.test(font)), "the score, big");
  assert.ok(texts.some(([t]) => t.startsWith(`Cleared 1 of ${ghoul.STAGES.length} stages, out in `) && t.includes("A new record!")), "how far, and the record");
  const again = ghoul.default.create({ canvas, memo: { get: () => 9, set: () => assert.fail("never lowered") } });
  again.resize(900, 900);
  again.key("action");
  again.tick(16);
});

test("Ghoul Rush game: stageSelect() (the window's stage code) opens a practice round on every stage, nothing moving; up and down pick a stage, left and right a room, each clamped; space goes straight into that room with endless lives carried over; and the run keeps no record or score", () => {
  const { canvas, texts } = textCanvas();
  let saved = 0;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = ghoul.default.create({ canvas, memo, onScore: (n) => scores.push(n) });
  g.resize(900, 900);
  g.cheat(true);
  texts.length = 0;
  g.stageSelect();
  const r = g.round;
  assert.equal(g.state, "running");
  assert.equal(r.phase, "select");
  assert.equal(r.practice, true);
  assert.equal(r.infinite, true, "endless lives already on carry over");
  assert.ok(texts.some(([t]) => t === "Stage select"), "the select screen is drawn");
  for (let i = 0; i < 30; i++) g.tick(16);
  assert.equal(r.phase, "select", "it waits on a choice");
  assert.equal(r.clock, 0, "nothing moves");
  const last = ghoul.STAGES.length - 1;
  for (let i = 0; i < last + 3; i++) g.key("down");
  assert.equal(r.select.at, last, "down stops at the last stage");
  // Two up clamps inside the list; then steer on to the Manor, whose second
  // to last room is a runner ride (the Carnival's is the dark ride's
  // gallery, whose end screen carries no tally line).
  g.key("up");
  g.key("up");
  assert.equal(r.select.at, last - 2);
  const st = ghoul.STAGES[0];
  for (let i = 0; i < ghoul.STAGES.length; i++) g.key("up");
  assert.equal(r.select.at, 0, "the Manor");
  for (let i = 0; i < st.rooms.length + 3; i++) g.key("right");
  assert.equal(r.select.room, st.rooms.length - 1, "right stops at the boss room");
  g.key("left");
  assert.equal(r.select.room, st.rooms.length - 2);
  g.key("action");
  assert.equal(r.phase, "ready");
  assert.equal(r.stage, st.id);
  assert.equal(r.stageAt, st.rooms.length - 2);
  assert.equal(r.spec.id, st.rooms[st.rooms.length - 2], "straight into the room picked");
  r.events.push({ type: "stageClear", stage: st.id, n: 3, of: ghoul.STAGES.length });
  g.tick(16);
  assert.equal(saved, 0, "a practice run never sets the record");
  r.score = 5000;
  r.over = true;
  texts.length = 0;
  g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [], "a practice run never posts a score");
  assert.ok(texts.some(([t]) => t.includes("A practice run: nothing kept.")), "the end screen says so");
  g.key("action");
  assert.equal(g.round.practice, undefined, "a new round from the end screen is a normal one");
});

test("Ghoul Rush game: a run that clears every stage ends in a win, with a fanfare and the word on the end screen", () => {
  const { canvas, texts } = textCanvas();
  const played = [];
  const scores = [];
  const g = ghoul.default.create({ canvas, tone: (name) => played.push(name), onScore: (n) => scores.push(n) });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  while (!r.over) {
    r.phaseMs = 0;
    ghoul.pickStage(r);
    for (let k = 0; k < 4; k++) through(r);
  }
  g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
  assert.ok(played.includes("victory") && !played.includes("gameOver"), "a win, not a loss");
  assert.ok(texts.some(([t]) => t.startsWith("You escaped!")));
});

test("Ghoul Rush: every monster and boss has its own voice, each a tone tones.js has under this game's prefix, and every kind a death", () => {
  const known = new Set(toneNames());
  for (const kind of [...Object.keys(ghoul.MONSTERS), ...Object.keys(ghoul.BOSSES)]) {
    assert.ok(VOICES[kind], `${kind} has a voice`);
    assert.ok(VOICES[kind].die, `${kind} has a death`);
    for (const [act, name] of Object.entries(VOICES[kind])) {
      assert.ok(known.has(name), `${kind}.${act}: ${name} is in tones.js`);
      assert.match(name, /^ghoul[A-Z]/, `${name} keeps to this game's prefix`);
    }
  }
});

test("Ghoul Rush game: every tone it plays is one tones.js has, its own blips among them under this game's prefixes, and a run plays the blaster, kills, candy, the key and the door", () => {
  const known = new Set(toneNames());
  assert.ok(known.has("hop") && known.has("power"), "read the table");
  for (const name of GHOUL_TONES) {
    assert.ok(known.has(name), `${name} is in tones.js`);
    assert.match(name, /^(ghoul|zombie|bat|door|creak)/, `${name} keeps to this game's prefixes`);
  }
  const heard = new Set();
  const g = ghoul.default.create({ canvas: stubCanvas().canvas, tone: (name) => heard.add(name) });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  const bot = makeBot(ghoul, 1, ghoul.seeded(3));
  for (let ms = 0; ms < 90000 && g.round.room < 3 && g.state === "running"; ms += 16) {
    takeManor(g);
    bot(g.round);
    g.tick(16);
  }
  for (const name of heard) assert.ok(known.has(name), `${name} is a known tone`);
  for (const name of ["ghoulBlast", "zombiePop", "ghoulCandy", "doorUnlock", "doorThrough", "hop"]) assert.ok(heard.has(name), `${name} played`);
});

test("Ghoul Rush game: its own sounds keep its prefix, and a run holds a monster's hum (and no drone under the music), steps on the boards, and tolls at the end", () => {
  for (const name of [...Object.keys(ghoulSfx.tones), ...Object.keys(ghoulSfx.hums)]) assert.match(name, /^ghoul/, `${name} keeps to this game's prefix`);
  const known = new Set(toneNames());
  const hums = new Set(humNames());
  const heard = new Set();
  const held = new Map();
  const songs = new Map();
  const g = ghoul.default.create({
    canvas: stubCanvas().canvas,
    tone: (name) => heard.add(name),
    hum: (id, name, level, pitch) => held.set(id, { name, level, pitch }),
    music: (name, dread) => songs.set(name, Math.max(songs.get(name) ?? 0, dread)),
  });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  g.round.dice = 0;
  const bot = makeBot(ghoul, 1, ghoul.seeded(3));
  for (let ms = 0; ms < 180000 && g.round.room < 4 && g.state === "running"; ms += 16) {
    takeManor(g);
    bot(g.round);
    g.tick(16);
  }
  for (const name of heard) assert.ok(known.has(name), `${name} is a known tone`);
  for (const [id, h] of held) {
    assert.ok(id.startsWith("ghoul:"), `${id} is this game's hum`);
    assert.ok(hums.has(h.name), `${h.name} is a known hum`);
    assert.ok(h.level >= 0 && h.level <= 1.0001 && h.pitch > 0, `${id}: a level and a pitch`);
  }
  assert.ok(!held.has("ghoul:house"), "no drone under the music");
  assert.ok(held.has("ghoul:near"), "a monster close by is heard");
  const tracks = [...new Set(["hall", "foyer", "gallery"].map((id) => ghoul.ROOM_MUSIC[id]))];
  assert.deepEqual([...songs.keys()].slice(0, tracks.length), tracks, `each room plays its own track (${[...songs.keys()]})`);
  for (const [name, dread] of songs) assert.ok(Object.hasOwn(ghoulSfx.music, name) && dread > 0 && dread <= 1, `${name}: a known track, played with some dread`);
  for (const name of ["ghoulStep", "jump", "land", "ghoulKey", "ghoulRoomIn"]) assert.ok(heard.has(name), `${name} played`);
  // The last life: the heart pounds; then out of lives, the toll.
  const sounds = [];
  const h = ghoul.default.create({ canvas: stubCanvas().canvas, tone: (name) => sounds.push(name) });
  h.resize(900, 900);
  h.key("action");
  skipStory(h);
  h.round.dice = 0;
  h.round.lives = 1;
  for (let k = 0; k < 60; k++) h.tick(16);
  assert.equal(h.round.phase, "play");
  assert.ok(sounds.includes("heartbeat"), "a heartbeat on the last life");
  ghoul.lose(h.round, "zombie");
  for (let k = 0; k < 200 && h.state === "running"; k++) h.tick(16);
  assert.equal(h.state, "over");
  assert.ok(sounds.includes("gameOver") && sounds.includes("ghoulToll"), "the run ends on a toll");
});

test("Ghoul Rush: every room has a track, played at one steady level whatever the monsters do (fuller in the clock's last seconds), and near full in a boss fight", () => {
  for (const spec of ghoul.ROOMS) assert.ok(Object.hasOwn(ghoulSfx.music, ghoul.ROOM_MUSIC[spec.id]), `${spec.id} has a track`);
  const round = ghoulRound("foyer");
  standAt(round, 60);
  round.timeMs = 60000;
  const steady = ghoul.dread(round);
  assert.equal(steady, 0.7, "an empty stretch: the room's level");
  for (let k = 0; k < 8; k++) put(round, "zombie", 62);
  assert.equal(ghoul.dread(round), steady, "a crowd right on you changes nothing");
  // The level brings in each track's melody and drums, never only its drone.
  for (const name of Object.values(ghoul.ROOM_MUSIC)) {
    const playing = Object.entries(ghoulSfx.music[name].voices).filter(([, v]) => (v.from ?? 0) <= steady);
    assert.ok(playing.length >= 4, `${name}: ${playing.map(([k]) => k).join(", ")} at the room's level`);
  }
  round.timeMs = 5000;
  assert.ok(Math.abs(ghoul.dread(round) - 0.9) < 1e-9, "the clock running out adds a little");
  const fight = ghoulRound("ballroom");
  fight.lockX = 10;
  fight.boss.state = "fight";
  assert.equal(ghoul.dread(fight), 0.9, "a boss at full health: near full");
  fight.boss.hp = 0;
  assert.equal(ghoul.dread(fight), 1, "and full as it nears its end");
});

/* ---------------------------------------------------------------- drawing */

// A 2D context that records each banner shade fill's alpha, and every text.
function seeCanvas() {
  const alphas = [];
  const texts = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get: (t, name) => {
      if (name === "fillRect") return () => t.fillStyle === BANNER_SHADE && alphas.push(t.globalAlpha);
      if (name === "fillText") return (text) => texts.push(String(text));
      return name in t ? t[name] : () => {};
    },
    set: (t, name, value) => { t[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, alphas, texts };
}

test("Ghoul Rush game: a banner fades to see-through while something that can hurt you crosses its strip, and comes back once it has gone", () => {
  const { canvas, alphas } = seeCanvas();
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  quiet(g.round);
  for (let k = 0; k < 10; k++) g.tick(16);
  assert.ok(alphas.at(-1) > 0.9, `clear strip: solid (${alphas.at(-1)})`);
  const r = g.round;
  const y = ghoul.FIELD_H - ghoul.bannerY(r) - 1;
  const bat = put(r, "bat", r.camX + 70, { y, vx: 0 });
  for (let k = 0; k < 30; k++) {
    Object.assign(bat, { x: r.camX + 70, y, vx: 0, vy: 0 });
    g.tick(16);
  }
  assert.ok(alphas.at(-1) < 0.2, `a bat in the strip: see-through (${alphas.at(-1).toFixed(2)})`);
  r.monsters.length = 0;
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(alphas.at(-1) > 0.85, `gone: solid again (${alphas.at(-1).toFixed(2)})`);
});

test("Ghoul Rush game: a \"Ready?\" banner still waiting when play begins is dropped, and \"New best!\" makes room for itself in a full queue", () => {
  const { canvas, texts } = seeCanvas();
  const g = ghoul.default.create({ canvas, best: () => 1 });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  g.round.dice = 0;
  quiet(g.round);
  g.tick(16);
  ghoul.lose(g.round, "zombie");
  for (let ms = 0; ms < ghoul.CRASH_MS + ghoul.READY_MS + 100; ms += 16) g.tick(16);
  assert.equal(g.round.phase, "play");
  texts.length = 0;
  for (let ms = 0; ms < 3000; ms += 16) g.tick(16);
  assert.ok(!texts.includes("Ready?"), "not shown late, once play is on");
  const r = g.round;
  for (const kind of ["spread", "rapid", "garlic"]) r.events.push({ type: "power", kind, x: r.you.x, y: r.you.y });
  g.tick(16);
  r.score = 50;
  g.tick(16);
  texts.length = 0;
  for (let ms = 0; ms < 8000; ms += 16) {
    quiet(r);
    r.you.safeMs = 1e9;
    g.tick(16);
  }
  assert.ok(texts.includes("New best!"), "the record is never dropped");
});

test("Ghoul Rush: every pill's text reads at 4.5:1 on its backing and its timer's tint, in light and dark under every highlight, the chain, a spent bonus, the key and every power-up included", () => {
  for (const [theme, tokens] of Object.entries(THEME_TOKENS)) {
    for (const [id, accent] of Object.entries(ACCENTS)) {
      const values = { ...tokens, "--accent": accent[theme][0] };
      withTokens(values, () => {
        const { canvas, pills, reset } = pillCanvas(values["--panel"]);
        const g = ghoul.default.create({ canvas });
        g.resize(900, 900);
        g.key("action");
        for (let k = 0; k < 5; k++) g.tick(16);
        const r = g.round;
        quiet(r);
        Object.assign(r, { bonus: 0, chain: 4, chainMs: ghoul.CHAIN_MS / 2, hasKey: true });
        r.effects.spread = 5000;
        r.effects.rapid = 5000;
        r.you.garlic = true;
        reset();
        g.tick(1);
        const seen = pills();
        for (const p of seen) {
          for (const under of [p.backing, ...p.tints]) {
            const k = wcag(p.ink, under);
            assert.ok(k >= 4.5, `${theme}/${id}: "${p.text}" in ${p.ink} on ${under} reads ${k.toFixed(2)}:1`);
          }
        }
        for (const want of ["THE LONG HALL", `STAGE 0 OF ${ghoul.STAGES.length}`, "♥", "BONUS 0", "~CHAIN x4", "~SPREAD", "~RAPID", "GARLIC"]) {
          const tinted = want.startsWith("~");
          const text = tinted ? want.slice(1) : want;
          assert.ok(seen.some((p) => p.text.includes(text) && (!tinted || p.tints.length)), `${theme}/${id}: "${text}" drawn (${seen.map((p) => p.text)})`);
        }
      });
    }
  }
});

test("Ghoul Rush: the top bar names the stage (or the hall) and counts the stages cleared of all there are, lives sit in the solid lives pill right after them, white with a heart per life, and the pills keep to one row in the slim strip with everything showing, spilling a row onto the field only on the smallest board", () => {
  const { canvas, pills, reset } = pillCanvas("#ffffff");
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.key("action");
  for (let k = 0; k < 5; k++) g.tick(16);
  reset();
  g.tick(16);
  const seen = pills();
  const at = seen.findIndex((p) => p.text.startsWith("♥"));
  assert.deepEqual(seen.slice(0, 2).map((p) => p.text), ["THE LONG HALL", `STAGE 0 OF ${ghoul.STAGES.length}`], "the hall, nothing cleared yet");
  assert.equal(at, 2, `right after the stage pills (${seen.map((p) => p.text)})`);
  assert.equal(seen[at].text, livesText(g.round.lives));
  assert.equal(seen[at].backing, LIVES_BACK);
  assert.equal(seen[at].ink, LIVES_INK);
  assert.equal(LIVES, ghoul.POWERS.life.color, "the 1UP keeps the lives pink");
  const box = (p, h) => [p.x, p.y, p.x + p.w, p.y + h];
  for (const h of [Math.max(12 / ghoul.MIN_CELL, 2.4), 2.4]) {
    const hud = { room: "THE GRAND OPERA HOUSE", stage: "STAGE 20 OF 21", time: 80, timeLow: false, bonus: ghoul.BONUS_START, chain: ghoul.MAX_MULT, chainFill: 0.5, key: true, effects: ["SPREAD", "RAPID", "GARLIC"].map((text) => ({ text, color: "#ffffff", fill: 0.5 })), gauge: { fill: 0.5, free: 0.6, rapid: null } };
    const laid = hudLayout(h, ghoul.W, ghoul.MAX_LIVES, hud, ghoul.HUD_H);
    assert.ok(laid.every((p) => p.h >= h * 0.6), "shrunk no more than it must");
    const placed = laid.map((p) => box(p, p.h));
    // A pill 2.4 units tall is every board but the smallest: one row, in the strip.
    const roomy = h === 2.4;
    if (roomy) assert.equal(new Set(laid.map((p) => p.y)).size, 1, "one row");
    for (const [x0, y0, x1, y1] of placed) {
      assert.ok(x0 >= 0 && x1 <= ghoul.W, `on the board (h ${h})`);
      assert.ok(y0 >= 0 && y1 <= (roomy ? ghoul.HUD_H : ghoul.HUD_H + 3), `in the strip, or just below it on the smallest board (h ${h}, ${y0.toFixed(2)}..${y1.toFixed(2)})`);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const [p, q] = [placed[i], placed[j]];
        assert.ok(p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1], `pills ${i} and ${j} apart (h ${h})`);
      }
    }
  }
  for (const text of ["Headshot! +1600", "Down the hole!", "A line much too long to fit across the field at all, however small it is drawn"]) {
    for (let x = -10; x <= ghoul.FIELD_W + 10; x += 13) {
      for (let y = -10; y <= ghoul.FIELD_H + 10; y += 11) {
        const spot = labelSpot(text, x, y, 2.6, ghoul.FIELD_W, ghoul.FIELD_H);
        assert.ok(spot.x - spot.max / 2 >= 0 && spot.x + spot.max / 2 <= ghoul.FIELD_W);
        assert.ok(spot.y - 1.3 >= 0 && spot.y + 1.3 <= ghoul.FIELD_H);
      }
    }
  }
});

test("Ghoul Rush: the blaster's gauge fills with its heat, notched where the bolts slow, and empties as it cools", () => {
  const g = ghoul.default.create({ canvas: stubCanvas().canvas });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  for (let k = 0; k < 5; k++) g.tick(16);
  const gauge = () => g.hud.gauge;
  assert.equal(gauge().free, ghoul.HEAT_FREE / ghoul.HEAT_MAX, "the notch sits where fireGap() starts to slow");
  assert.equal(gauge().fill, 0, "cool at the start");
  g.round.heat = ghoul.HEAT_FREE + 5;
  g.tick(16);
  const hot = gauge().fill;
  assert.ok(hot > gauge().free, "past the notch once the bolts slow");
  g.round.input.fire = false;
  for (let k = 0; k < 40; k++) g.tick(16);
  assert.ok(gauge().fill < hot, "and down again as it cools");
  assert.equal(gaugeColor(0.1, 0.6), GAUGE_COOL);
  assert.equal(gaugeColor(0.5, 0.6), GAUGE_WARM);
  assert.equal(gaugeColor(0.7, 0.6), GAUGE_HOT);
  assert.equal(gaugeColor(0.7, 0.6, ghoul.POWERS.rapid.color), ghoul.POWERS.rapid.color, "Rapid fire's bolts ignore the heat");
});

test("Ghoul Rush: Planny's arms and feet read on every room's walls, and every room has a look", () => {
  for (const base of ghoul.ROOMS) assert.ok(LOOKS[base.id], `${base.id} has a look`);
  for (const [look, t] of Object.entries(LOOKS)) {
    const ink = limbInk(look);
    for (const tone of [t.wallTop, t.wallLow, t.paper]) assert.ok(contrast(ink, tone) >= 3, `${look}: ${ink} on ${tone} (${contrast(ink, tone).toFixed(2)})`);
  }
});

test("Ghoul Rush: the banner's strip counts you, a monster or a boss on screen, a bone or a shockwave, and nothing off screen or elsewhere", () => {
  const round = ghoulRound();
  standAt(round, 30);
  const high = ghoul.FIELD_H * 0.3;
  assert.equal(ghoul.bannerY(round), high, "high on the field while you are low");
  assert.equal(ghoul.underBanner(round, high), false, "nothing in the strip");
  assert.equal(ghoul.underBanner(round, ghoul.FIELD_H - 8), true, "you, low down");
  const bat = put(round, "bat", 40, { y: ghoul.FIELD_H - high - 1 });
  assert.equal(ghoul.underBanner(round, high), true, "a bat in the strip");
  bat.x = round.camX + ghoul.FIELD_W + 20;
  assert.equal(ghoul.underBanner(round, high), false, "off screen, it does not count");
  round.monsters.length = 0;
  round.bones.push({ x: 50, y: ghoul.FIELD_H - high, vx: 0, vy: 0 });
  assert.equal(ghoul.underBanner(round, high), true, "a bone");
  round.bones.length = 0;
  round.you.y = ghoul.FIELD_H * 0.6;
  assert.equal(ghoul.bannerY(round), ghoul.FIELD_H * 0.72, "low while you are high");
});

test("Ghoul Rush game: the opening banner sits in the field from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const { canvas, shades } = bannerCanvas(BANNER_SHADE);
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  shades.length = 0;
  g.key("action");
  skipStory(g);
  assert.equal(shades.length, 1, "the start paints its banner");
  const [[top, h]] = shades;
  assert.ok(top >= 0 && top + h <= ghoul.FIELD_H, `inside the field (${top})`);
  shades.length = 0;
  g.tick(16);
  assert.deepEqual(shades, [[top, h]], "in the same place once play begins");
});

test("Ghoul Rush game: Planny keeps his star eye in your highlight running, firing, in the air, hit, with garlic, cheering at the door and at the end", () => {
  const frame = (setup) => {
    const { canvas, fills } = styleCanvas();
    const g = ghoul.default.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    skipStory(g);
    g.round.dice = 0;
    g.tick(16);
    quiet(g.round);
    setup(g, g.round.you);
    fills.length = 0;
    g.resize(900, 900);
    return fills.filter((f) => f === "#206cc3").length;
  };
  assert.equal(frame((g) => { g.key("right"); g.tick(100); }), 1, "running");
  assert.equal(frame((g) => { g.key("action"); g.tick(20); }), 1, "firing");
  assert.equal(frame((g, you) => Object.assign(you, { state: "air", vy: 10, y: you.y + 3 })), 1, "in the air");
  assert.equal(frame((g) => ghoul.lose(g.round, "zombie")), 1, "hit");
  assert.equal(frame((g, you) => (you.garlic = true)), 1, "with garlic");
  assert.equal(frame((g) => {
    g.round.hasKey = true;
    standAt(g.round, g.round.spec.door);
    g.tick(16);
    assert.equal(g.round.phase, "clear");
  }), 1, "cheering at the door");
  assert.equal(frame((g) => {
    g.round.lives = 1;
    ghoul.lose(g.round, "bat");
    for (let ms = 0; ms < ghoul.CRASH_MS + 200 && g.state === "running"; ms += 16) g.tick(16);
    assert.equal(g.state, "over");
  }), 1, "at the end");
});

test("Ghoul Rush game: what never moves in a room is drawn off screen once, CHUNK units at a time, and copied every frame; a new stretch or room draws only its own", () => {
  const saved = globalThis.OffscreenCanvas;
  const layers = [];
  globalThis.OffscreenCanvas = class {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this.names = [];
      layers.push(this);
      const names = this.names;
      this.ctx = new Proxy({}, {
        get: (t, name) => (name in t ? t[name] : () => { names.push(name); }),
        set: (t, n, v) => { t[n] = v; return true; },
      });
    }
    getContext() { return this.ctx; }
  };
  try {
    const { canvas, names } = recordingCanvas();
    const g = ghoul.default.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    skipStory(g);
    g.tick(16);
    quiet(g.round);
    g.tick(16);
    // The dark layer is one canvas the field's size, kept and redrawn each
    // frame; the still layers are the CHUNK-wide ones.
    const still = () => layers.filter((l) => l.width === Math.ceil((CHUNK + SEAM) * 2));
    const first = still().length;
    assert.equal(first, Math.floor(ghoul.FIELD_W / CHUNK) + 1, "the chunks on screen drawn once");
    assert.ok(still().every((l) => l.names.length > 100), "the room drawn on them");
    assert.equal(layers.length - first, 1, "and one dark layer");
    layers.length = 0;
    names.length = 0;
    for (let k = 0; k < 10; k++) g.tick(16);
    assert.equal(layers.length, 0, "kept from frame to frame");
    assert.ok(names.filter((n) => n === "drawImage").length >= 10 * first, "copied every frame");
    assert.equal(names.filter((n) => n === "createLinearGradient").length, 0, "no wall gradient made per frame");
    g.key("right");
    for (let k = 0; k < 220; k++) g.tick(16);
    g.release("right");
    assert.ok(layers.length >= 1 && layers.length <= 3, `running on draws the next stretch (${layers.length})`);
    layers.length = 0;
    const r = g.round;
    quiet(r);
    r.hasKey = true;
    standAt(r, r.spec.door);
    r.camX = r.spec.length - ghoul.FIELD_W;
    g.tick(16);
    layers.length = 0;
    for (let ms = 0; ms < ghoul.CLEAR_MS + 100; ms += 16) g.tick(16);
    takeManor(g);
    for (let ms = 0; ms < ghoul.READY_MS + 100; ms += 16) g.tick(16);
    assert.equal(g.round.room, 2);
    assert.ok(layers.length >= 1 && layers.length <= 3, `the next room draws its own (${layers.length})`);
  } finally {
    if (saved === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = saved;
  }
});

test("Ghoul Rush game: every room and boss draws, and each pick of stage, through a short bot run of each, on to the win", () => {
  const { canvas, calls } = stubCanvas();
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.key("action");
  skipStory(g);
  for (let n = 1; n <= ghoul.ROOMS.length; n++) {
    const r = g.round;
    r.lives = 99;
    const bot = makeBot(ghoul, 1, ghoul.seeded(n));
    const drawn = calls.count;
    // The dark ride holds on its title for a press.
    if (r.gallery) g.key("action");
    for (let ms = 0; ms < 4000; ms += 16) {
      bot(r);
      g.tick(16);
    }
    assert.ok(calls.count > drawn, `room ${n} draws`);
    leaveIntro(g);
    if (r.boss) r.boss.state = "down";
    r.hasKey = true;
    // Through the door, once any life lost in the run is over with.
    for (let ms = 0; ms < 8000 && g.round.room === n && g.state === "running"; ms += 16) {
      if (r.phase === "play" && r.you.out <= 0) {
        r.monsters.length = 0;
        standAt(r, r.spec.door);
      }
      if (r.phase === "pick") {
        const before = calls.count;
        g.tick(16);
        assert.ok(calls.count > before, `the pick after room ${n} draws`);
        r.phaseMs = 0;
        g.key("action");
      }
      g.tick(16);
    }
    if (n === ghoul.ROOMS.length) break;
    leaveIntro(g);
    for (let ms = 0; ms < ghoul.READY_MS + 100; ms += 16) g.tick(16);
    assert.equal(g.round.room, n + 1);
  }
  assert.deepEqual([g.state, g.round.won], ["over", true], "every stage cleared, a win");
});
