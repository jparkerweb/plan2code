// Web console tests, Bounce Road through the game contract: the pills and their contrast, held keys, jumps and pauses, the start and end screens and the memo, the tones every event plays and the held hums, Planny in every state, the engine, the landing ring, the road drawn in slanting bands and in chunks kept off screen, the opening banner and the dark of Night Lights.
// Run with: node --test scripts/test-web-console-activities-bounce-game.mjs
//
// The rules have their own suite, scripts/test-web-console-activities-bounce.mjs.
// No browser and no server: the game draws only through the canvas it is
// handed, so a stub canvas stands in for the page, as in
// scripts/test-web-console-activities.mjs, whose helpers this file copies.

import "./seed-random.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as bounce from "../src/web-console/public/activities/bounce.js";
import { LOOKS } from "../src/web-console/public/activities/bounce-draw.js";
import { ACCENTS } from "../src/web-console/public/palette.js";
import { humNames, toneNames } from "../src/web-console/public/tones.js";

const game = bounce.default;

/* ------------------------------------------------------------- helpers */

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

// Plays the game a few frames in light and dark under every highlight, runs
// `setup(round)`, draws one more frame and checks every pill's text reads
// at 4.5:1 on its backing and each tint, and that each of `expect` showed
// (a "~" before one: drawn with a timer's tint).
function checkPills({ setup = () => {}, expect = [] } = {}) {
  const saved = globalThis.getComputedStyle;
  try {
    for (const [theme, tokens] of Object.entries(THEME_TOKENS)) {
      for (const [id, accent] of Object.entries(ACCENTS)) {
        const values = { ...tokens, "--accent": accent[theme][0] };
        globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => values[name] || "" });
        const { canvas, pills, reset } = pillCanvas(values["--panel"]);
        const g = game.create({ canvas });
        g.resize(900, 900);
        g.key("action");
        for (let k = 0; k < 5; k++) g.tick(16);
        setup(g.round);
        reset();
        g.tick(16);
        const seen = pills();
        assert.ok(seen.length > 0, `${theme}/${id}: pills drawn`);
        for (const p of seen) {
          for (const under of [p.backing, ...p.tints]) {
            const k = wcag(p.ink, under);
            assert.ok(k >= 4.5, `${theme}/${id}: "${p.text}" in ${p.ink} on ${under} reads ${k.toFixed(2)}:1`);
          }
        }
        for (const want of expect) {
          const tinted = want.startsWith("~");
          const text = tinted ? want.slice(1) : want;
          assert.ok(seen.some((p) => p.text.includes(text) && (!tinted || p.tints.length)), `${theme}/${id}: "${text}" drawn${tinted ? " with its tint" : ""} (${seen.map((p) => p.text)})`);
        }
      }
    }
  } finally {
    if (saved === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = saved;
  }
}

// Starts the game the way the window's key does and checks its opening
// banner: painted on the start's own frame, inside the field (0 to
// `field`), and in the same place on the first tick.
function openingBanner(g, shades, field) {
  shades.length = 0;
  g.key("action");
  assert.equal(shades.length, 1, "the start paints its banner");
  const [[top, h]] = shades;
  assert.ok(top >= 0 && top + h <= field, `inside the field, not at its top edge (${top})`);
  shades.length = 0;
  g.tick(16);
  assert.deepEqual(shades, [[top, h]], "in the same place once play begins");
}

// A 2D context that keeps every method name it was called with, and answers
// the few calls the road's chunks need.
function recordingCanvas() {
  const names = [];
  const target = {
    getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }),
    measureText: () => ({ width: 50 }),
  };
  const ctx = new Proxy(target, {
    get: (t, name) => (name in t ? t[name] : (...args) => { names.push(name); }),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const canvas = { width: 800, height: 600, getContext: () => ctx };
  ctx.canvas = canvas;
  return { canvas, names };
}

// A 2D context that keeps the style each fill and stroke used, and counts
// every other call.
function styleCanvas() {
  const fills = [];
  const strokes = [];
  const ctx = new Proxy({}, {
    get: (target, name) => {
      if (name === "fill" || name === "fillRect") return () => fills.push(target.fillStyle);
      if (name === "stroke" || name === "strokeRect") return () => strokes.push(target.strokeStyle);
      return name in target ? target[name] : () => {};
    },
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, fills, strokes };
}

// A random source that always says the same, so no rival guesses.
const steady = () => 0.5;
const eventsOf = (round, type) => round.events.filter((e) => e.type === type);

// A rival of `kind` put at (x, d), still and on the ground, going nowhere on
// its own.
function bounceRival(round, kind, x, d, over = {}) {
  // A rival only spawns on plain road, and the road is generated at random: a crack or a bridge can
  // sit at the first spot tried, so try further along until one takes. The rival is moved anyway.
  let car = null;
  for (let at = round.cars[0].d + 300; !car && at < round.cars[0].d + 3000; at += 40) car = bounce.spawnRival(round, kind, steady, at);
  assert.ok(car, `a ${kind} spawns`);
  Object.assign(car, { x, d, v: 0, tv: 0, vx: 0, kx: 0, air: 0, tx: x, lane: x, hopIn: 1e9, dropIn: 1e9, mode: "calm", ...over });
  return car;
}

// A spot on plain road: the middle of the first row at or after `d` with
// nothing to catch you out for `clear` units either side (no hole, water,
// flowerbed, timed part, rails, pad, barrier or hazard).
function plainSpot(road, d = 40, clear = 20) {
  bounce.ensureRoad(road, d + 400);
  const busy = (lo, hi) => [road.pads, road.blocks, road.hazards, road.items, road.stars].some((list) => list.some((e) => e.d > lo - 12 && (e.d1 ?? e.d) > lo - 12 && e.d < hi + 12));
  for (let i = Math.floor(d / bounce.ROW); i < road.rows; i++) {
    let ok = true;
    for (let j = i - clear / bounce.ROW; ok && j <= i + clear / bounce.ROW; j++) ok = bounce.plainRow(road, j);
    if (ok && !busy(i * bounce.ROW - clear, i * bounce.ROW + clear)) return { x: (road.L[i] + road.R[i]) / 2, d: i * bounce.ROW + 1, i };
  }
  throw new Error("no plain road");
}

/* ------------------------------------------------------- the game */

// Starts a Bounce Road game, the rivals cleared away and none coming.
function bounceGame(opts = {}) {
  const { canvas, calls } = stubCanvas();
  const g = game.create({ canvas, ...opts });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  g.round.cars.length = 1;
  g.round.spawnMs = 1e12;
  return { g, calls };
}

test("Bounce Road: every pill's text reads at 4.5:1 on its backing and its timer's tint, lives, a burning Nitro, Mega wheels, the power-ups, the chain and the combo included, in light and dark under every highlight", () => {
  checkPills({
    setup: (r) => {
      const you = r.cars[0];
      you.spring = true;
      you.bubble = true;
      you.nitroMs = bounce.NITRO_MS / 2;
      you.megaMs = bounce.MEGA_MS / 2;
      r.chain = 3;
      r.streak = bounce.COMBO_STEP;
      r.streakMs = bounce.STREAK_MS / 2;
    },
    expect: ["STAGE 1", "♥", "SPRING", "BUBBLE", "~NITRO", "~MEGA", "CHAIN x3", "~COMBO x2"],
  });
});

test("Bounce Road game: held arrows drive and steer until let go; space jumps once a press, never on its key repeat, never with the press that plays on; a pause lets go of every key, drops an early press and holds a jump mid-air; and the board refuses a tiny window", () => {
  const { canvas } = stubCanvas();
  const t = game.create({ canvas });
  assert.equal(t.resize(bounce.W * bounce.MIN_CELL - 1, 2000), false, "too narrow to play");
  assert.equal(t.resize(bounce.W * bounce.MIN_CELL, bounce.H * bounce.MIN_CELL), true, "just big enough");
  const { g } = bounceGame();
  const you = g.round.cars[0];
  g.key("up", true);
  for (let i = 0; i < 40; i++) g.tick(16);
  assert.ok(you.v > 30, "up held through the countdown (its repeats) drives");
  g.release("up");
  assert.equal(g.round.input.up, false, "let go, it stops driving");
  g.key("up");
  g.key("action", true);
  g.tick(16);
  assert.equal(you.air, 0, "a repeat of space never jumps");
  g.key("action");
  g.tick(16);
  assert.ok(you.air > 0, "a press jumps");
  for (let i = 0; i < 80 && you.air > 0; i++) {
    g.key("action", true);
    g.tick(16);
  }
  assert.equal(you.air, 0, "down again");
  for (let i = 0; i < 10; i++) {
    g.key("action", true);
    g.tick(16);
  }
  assert.equal(you.air, 0, "and only once: holding it never jumps again");
  g.key("left");
  g.key("action");
  g.pause();
  assert.deepEqual(Object.values(g.round.input), [false, false, false, false, 0], "a pause holds nothing, the early press dropped");
  g.key("action");
  assert.equal(g.state, "paused", "space never plays on by itself: the window resumes through resume()");
  g.resume();
  assert.equal(g.state, "running", "resume() plays on");
  g.tick(16);
  assert.equal(you.air, 0, "and the press that played on never jumps");
  const clock = g.round.clock;
  g.pause();
  g.tick(1000);
  assert.equal(g.round.clock, clock, "a paused game holds still");
  g.resume();
  g.tick(16);
  g.key("action");
  g.tick(16);
  const air = you.air;
  assert.ok(air > 0);
  g.pause();
  g.tick(500);
  assert.equal(you.air, air, "a pause mid-air holds the jump");
  g.resume();
  g.tick(16);
  assert.ok(you.air < air && you.air > 0, "and it carries on from there");
});

test("Bounce Road game: the start screen names the furthest stage, the memo only grows, and the round's end calls onScore once with its score big on the end screen", () => {
  const texts = [];
  let font = "";
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push([String(text), font]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { if (name === "font") font = value; target[name] = value; return true; },
  });
  let saved = 3;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, memo, onScore: (n) => scores.push(n) });
  g.resize(900, 900);
  assert.ok(texts.some(([t]) => t.includes(`Furthest: ${bounce.STAGES[2].title} (stage 3)`)), "the start screen names the furthest stage");
  g.key("action");
  g.tick(16);
  g.round.cars.length = 1;
  g.round.spawnMs = 1e12;
  const you = g.round.cars[0];
  const cross = (n) => {
    you.d = g.round.road.stageAt[n] - 0.1;
    const i = Math.floor(you.d / bounce.ROW);
    you.x = (g.round.road.L[i] + g.round.road.R[i]) / 2;
    g.round.far = you.d;
    g.tick(16);
  };
  cross(1);
  cross(2);
  assert.equal(g.round.stage, 3);
  assert.equal(saved, 3, "a stage already reached changes nothing");
  cross(3);
  assert.equal(saved, 4, "a new furthest stage is saved");
  g.round.lives = 1;
  const hole = g.round.road.holes.find((h) => h.d0 > you.d && h.kind === "crack");
  you.d = hole.d0 + 2;
  you.air = 0;
  you.x = (g.round.road.L[bounce.rowOf(you.d)] + g.round.road.R[bounce.rowOf(you.d)]) / 2;
  for (let ms = 0; ms < bounce.CRASH_MS + 200 && g.state === "running"; ms += 16) g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
  assert.ok(g.score > 0);
  texts.length = 0;
  g.resize(900, 900);
  assert.ok(texts.some(([t, f]) => t === String(g.score) && /\b7px/.test(f)), "the score, big");
  assert.ok(texts.some(([t]) => t.includes(`Reached ${bounce.STAGES[3].title} (stage 4). New furthest!`)));
  g.tick(1000);
  assert.equal(scores.length, 1, "once");
});

test("Bounce Road game: a jump springs, a crush squashes higher up the chain, passing the best plays the fanfare once, and every stage and lap draws", () => {
  const tones = [];
  const { g, calls } = bounceGame({ tone: (name, level, pitch) => tones.push([name, pitch || 1]), best: () => 5000 });
  const you = g.round.cars[0];
  g.key("up");
  for (let i = 0; i < 30; i++) g.tick(16);
  assert.ok(tones.some(([n]) => n === "engine"), "the engine hums");
  tones.length = 0;
  g.key("action");
  g.tick(16);
  assert.ok(tones.some(([n]) => n === "spring"), "a jump springs");
  tones.length = 0;
  for (let i = 0; i < 10; i++) g.tick(16);
  assert.ok(you.air > 0);
  assert.equal(tones.filter(([n]) => n === "engine").length, 0, "quiet in the air");
  const squash = () => {
    const car = bounceRival(g.round, "zigzag", you.x, you.d);
    for (let i = 0; i < 120 && !tones.some(([n]) => n === "squash"); i++) {
      if (car.out === 0) Object.assign(car, { x: you.x, d: you.d, v: 0 });
      g.tick(8);
    }
    const hit = tones.filter(([n]) => n === "squash");
    tones.length = 0;
    return hit.length ? hit[0][1] : 0;
  };
  const first = squash();
  const second = squash();
  assert.ok(first > 0 && second > first, `the second crush squashes higher (${first} then ${second})`);
  g.round.score = 60000;
  g.tick(16);
  g.tick(16);
  assert.equal(tones.filter(([n]) => n === "best").length, 1);
  for (let n = 1; n <= 12; n++) {
    while (g.round.road.built < n + 1) bounce.buildStage(g.round.road, g.round.road.built + 1);
    g.round.stage = n;
    you.d = g.round.road.stageAt[n - 1] + 400;
    you.air = 500;
    g.round.lives = 99;
    const drawn = calls.count;
    for (let k = 0; k < 6; k++) g.tick(50);
    assert.ok(calls.count > drawn, `stage ${n} draws`);
  }
});

test("Bounce Road game: every event plays a tone that tones.js has (its blips, its shared kit or bounce-sfx.js), so no stunt or hazard is silent", () => {
  const known = new Set(toneNames());
  assert.ok(known.size > 40, "tones.js read");
  const tones = [];
  const { g } = bounceGame({ tone: (name) => tones.push(name) });
  const you = g.round.cars[0];
  const at = { x: you.x, d: you.d + 10 };
  const events = [
    { type: "boost", ...at, points: 10 }, { type: "ramp", id: 0, ...at, v: 50 }, { type: "slick", ...at }, { type: "star", ...at, run: 3, points: 10 },
    { type: "cone", ...at, kind: "cone", mine: true }, { type: "bonk", id: 0, ...at }, { type: "spray", ...at }, { type: "trainWarn", ...at }, { type: "train", ...at },
    { type: "dropWarn", ...at, what: "pot" }, { type: "dropLand", ...at, what: "pot" }, { type: "gust", dir: 1, ...at }, { type: "crumble", ...at }, { type: "litter", id: 3, ...at },
    { type: "brake", id: 3, ...at }, { type: "near", ...at, kind: "zigzag", points: 30 }, { type: "stomp", ...at, id: 3, hp: 2, chain: 1, points: 250 }, { type: "boss", ...at, points: 2000, life: true },
    { type: "quake", ...at, near: true }, { type: "bossHop", id: 3, ...at }, { type: "escape", ...at }, { type: "spawn", id: 3, kind: "cop", ...at }, { type: "spawn", id: 4, kind: "racer", ...at },
    { type: "spawn", id: 5, kind: "monster", ...at }, { type: "power", kind: "mega", ...at }, { type: "crush", ...at, kind: "cop", id: 3, chain: 2, points: 500 },
    { type: "copGone", id: 3, ...at }, { type: "bubble", ...at, cause: "crash" }, { type: "bump", a: 0, b: 3, ...at, speed: 30, kind: "zigzag" },
    { type: "bumped", ...at, id: 3, kind: "zigzag", how: "splash", points: 50 }, { type: "haul", ...at, kind: "truck", id: 3, chain: 1, points: 50 },
  ];
  for (const e of events) {
    tones.length = 0;
    g.round.events.push(e);
    g.tick(16);
    const played = tones.filter((n) => n !== "engine" && n !== "beat");
    assert.ok(played.length > 0, `${e.type}${e.kind ? ` (${e.kind})` : ""} plays a tone`);
    for (const n of played) assert.ok(known.has(n), `${n} is in tones.js`);
  }
});

test("Bounce Road game: Planny keeps his star eye in your highlight driving, in the air, crashed, squashed, sinking, cheering a stage line and at the end", () => {
  const frame = (setup) => {
    const { canvas, fills } = styleCanvas();
    const g = game.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    g.tick(16);
    g.round.cars.length = 1;
    g.round.spawnMs = 1e12;
    setup(g, g.round.cars[0]);
    fills.length = 0;
    g.resize(900, 900);
    return fills;
  };
  // His car's paint and his star: fills in your highlight.
  const mine = (fills) => fills.filter((f) => f === "#206cc3").length;
  const states = {
    driving: () => {},
    "in the air": (g, you) => Object.assign(you, { v: 40, air: 300, airMax: 600 }),
    crashed: (g) => bounce.lose(g.round, "crash"),
    squashed: (g) => bounce.lose(g.round, "squash"),
    sinking: (g) => bounce.lose(g.round, "splash"),
    "cheering a stage line": (g, you) => {
      you.d = g.round.road.stageAt[1] - 0.1;
      const i = Math.floor(you.d / bounce.ROW);
      you.x = (g.round.road.L[i] + g.round.road.R[i]) / 2;
      g.round.far = you.d;
      g.tick(16);
      assert.equal(g.round.stage, 2);
      for (let k = 0; k < 20; k++) g.tick(16);
    },
    "at the end": (g, you) => {
      g.round.lives = 1;
      const hole = g.round.road.holes.find((h) => h.kind === "crack");
      you.d = hole.d0 - 6;
      g.round.far = you.d;
      for (let ms = 0; ms < bounce.CRASH_MS + 2000 && g.state === "running"; ms += 16) g.tick(16);
      assert.equal(g.state, "over");
    },
  };
  const counts = Object.fromEntries(Object.entries(states).map(([name, setup]) => [name, mine(frame(setup))]));
  for (const [name, n] of Object.entries(counts)) assert.ok(n >= 2, `${name} (${n})`);
});

test("Bounce Road game: the engine hums while you pick up speed and through a Nitro, and is quiet once you cruise at the top speed or coast", () => {
  const tones = [];
  const { g } = bounceGame({ tone: (name) => tones.push(name) });
  const you = g.round.cars[0];
  const at = plainSpot(g.round.road, 40, 20);
  const hums = (ticks) => {
    tones.length = 0;
    for (let i = 0; i < ticks; i++) {
      Object.assign(you, { d: at.d, x: at.x });
      g.round.far = 1e9;
      g.tick(16);
    }
    return tones.filter((n) => n === "engine").length;
  };
  g.key("up");
  assert.ok(hums(40) > 3, "it hums as you speed up");
  hums(200);
  assert.ok(Math.abs(you.v - bounce.TOP_SPEED) < 1e-6, "at the top speed");
  assert.equal(hums(120), 0, "cruising, quiet");
  g.release("up");
  assert.equal(hums(120), 0, "coasting, quiet");
  bounce.applyPower(g.round, "nitro");
  g.key("up");
  assert.ok(hums(60) > 3, "a Nitro hums");
});

test("Bounce Road game: the motor hums all the way up the road and climbs with your speed; the tires squeal on hard steering, the Monster truck rumbles near, and a pause goes quiet", () => {
  const hums = [];
  const tones = [];
  const { g } = bounceGame({ hum: (id, name, level, pitch) => hums.push({ id, name, level, pitch }), tone: (name) => tones.push(name) });
  const known = new Set(humNames());
  const you = g.round.cars[0];
  const at = plainSpot(g.round.road, 40, 20);
  const run = (ticks, each = () => {}) => {
    hums.length = 0;
    for (let i = 0; i < ticks; i++) {
      Object.assign(you, { d: at.d, x: at.x });
      g.round.far = 1e9;
      each();
      g.tick(16);
    }
    return hums;
  };
  g.key("up");
  const slow = run(4).filter((h) => h.id === "bounce:you");
  run(200);
  const fast = run(4).filter((h) => h.id === "bounce:you");
  assert.ok(slow.length && fast.length, "the motor hums");
  assert.ok(fast.at(-1).pitch > slow[0].pitch, `it climbs with your speed (${slow[0].pitch} then ${fast.at(-1).pitch})`);
  assert.ok(run(30).some((h) => h.id === "bounce:you"), "cruising, it still hums (a toy car never stops)");
  assert.ok(!run(30).some((h) => h.id === "bounce:squeal"), "straight ahead, no squeal");
  const squeal = run(30, () => (you.vx = bounce.STEER_SPEED)).filter((h) => h.id === "bounce:squeal");
  assert.ok(squeal.length > 0 && squeal.every((h) => h.level > 0), "steering hard at speed squeals");
  const monster = bounceRival(g.round, "monster", at.x, at.d + 40);
  assert.ok(run(4).some((h) => h.id === "bounce:monster"), "the Monster truck rumbles near");
  monster.d = at.d + 1000;
  assert.ok(!run(4).some((h) => h.id === "bounce:monster"), "and not from far off");
  for (const h of hums) assert.ok(known.has(h.name), `${h.name} is a hum tones.js has`);
  g.pause();
  hums.length = 0;
  g.tick(16);
  assert.equal(hums.length, 0, "paused, nothing is held, so it all fades");
});

test("Bounce Road game: a landing thuds louder the further it fell", () => {
  const tones = [];
  const { g } = bounceGame({ tone: (name, level) => tones.push([name, level]) });
  const you = g.round.cars[0];
  const thud = (airMax) => {
    tones.length = 0;
    you.airMax = airMax;
    g.round.events.push({ type: "land", x: you.x, d: you.d, chain: 0, holes: 0, overs: [], big: false, points: 0 });
    g.tick(16);
    return tones.find(([n]) => n === "bounceLand")[1];
  };
  assert.ok(thud(1500) > thud(450), "a big fall lands harder");
});

test("Bounce Road game: a ring in your highlight shows where your jump comes down, only while you are in the air", () => {
  const strokesFor = (setup) => {
    const { canvas, strokes } = styleCanvas();
    const g = game.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    g.tick(16);
    g.round.cars.length = 1;
    g.round.spawnMs = 1e12;
    setup(g.round.cars[0]);
    strokes.length = 0;
    g.resize(900, 900);
    return strokes.filter((c) => c === "#206cc3").length;
  };
  const base = strokesFor(() => {});
  assert.equal(strokesFor((you) => Object.assign(you, { v: 30, air: 300, airMax: 600 })), base + 1, "in the air, one more");
});

test("Bounce Road game: the road's surface and edge lines are drawn slanting from each row's edges to the next's, never in stair steps", () => {
  const paths = [];
  let path = [];
  const ctx = new Proxy({}, {
    get: (t, name) => {
      if (name === "beginPath") return () => (path = []);
      if (name === "moveTo" || name === "lineTo") return (x, y) => path.push([x, y]);
      if (name === "fill") return () => paths.push({ color: t.fillStyle, pts: path });
      if (name === "fillRect") return () => paths.push({ color: t.fillStyle, rect: true });
      return name in t ? t[name] : () => {};
    },
    set: (t, n, v) => { t[n] = v; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  g.round.road = bounce.newRoad(3);
  g.round.cars.length = 1;
  g.round.spawnMs = 1e12;
  const r = g.round.road;
  let at = 60;
  while (!(r.deck[at] === 1 && r.stageOf[at] === 1 && Math.abs(r.L[at] - r.L[at - 1]) > 0.3)) at++;
  const you = g.round.cars[0];
  for (let k = 0; k < 40; k++) {
    Object.assign(you, { d: at * bounce.ROW, x: (r.L[at] + r.R[at]) / 2, air: 0 });
    g.round.far = 1e9;
    g.tick(16);
  }
  paths.length = 0;
  g.resize(900, 900);
  const road = paths.filter((p) => p.color === LOOKS.chalk.road);
  assert.ok(road.length > 20, `the road drawn row by row (${road.length})`);
  assert.ok(road.every((p) => !p.rect && p.pts.length === 4), "as bands, never boxes");
  assert.ok(road.some((p) => Math.abs(p.pts[0][0] - p.pts[3][0]) > 0.05), "some slanting");
  const edges = paths.filter((p) => p.color === LOOKS.chalk.edge && !p.rect);
  assert.ok(edges.length > 20, "the edge lines too");
});

test("Bounce Road game: the opening banner sits in the field from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.32)");
  const g = game.create({ canvas });
  g.resize(900, 900);
  openingBanner(g, shades, bounce.FIELD_H);
});

test("Bounce Road game: the road is drawn off screen a chunk at a time, once per chunk, and the frames copy the chunks", () => {
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
        get: (t, name) => (name in t ? t[name] : () => {
          names.push(name);
        }),
        set: (t, n, v) => { t[n] = v; return true; },
      });
    }
    getContext() { return this.ctx; }
  };
  try {
    const { canvas, names } = recordingCanvas();
    const g = game.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    g.tick(16);
    g.round.cars.length = 1;
    g.round.spawnMs = 1e12;
    const you = g.round.cars[0];
    const road = g.round.road;
    you.d = 48 * 4 + 10 + bounce.BEHIND;
    you.x = (road.L[Math.floor(you.d / bounce.ROW)] + road.R[Math.floor(you.d / bounce.ROW)]) / 2;
    g.round.far = you.d;
    for (let k = 0; k < 30; k++) g.tick(16);
    you.v = 0;
    layers.length = 0;
    names.length = 0;
    g.tick(16);
    g.tick(16);
    assert.equal(layers.length, 0, "kept from frame to frame, never drawn again");
    assert.ok(names.filter((n) => n === "drawImage").length >= 4, "copied every frame");
    const rects = names.filter((n) => n === "fillRect").length;
    assert.ok(rects < 400, `with no row drawn by hand (${rects})`);
    // On to plain road a few chunks on, in its middle: never over a crack
    // or water, where a crash would hold the view still.
    const next = plainSpot(road, you.d + 48 * 4, 10);
    Object.assign(you, { d: next.d, x: next.x, v: 0, air: 0 });
    g.round.far = you.d;
    for (let k = 0; k < 20; k++) g.tick(16);
    assert.ok(layers.length >= 2, `new road, new chunks (${layers.length})`);
    assert.ok(layers.every((l) => l.names.length > 50), "the road drawn on them");
  } finally {
    if (saved === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = saved;
  }
});

test("Bounce Road game: Night Lights is dark but for your headlights' reach", () => {
  const fills = [];
  const ctx = new Proxy({}, {
    get: (t, name) => (name === "fill" ? (rule) => fills.push(rule || "") : name in t ? t[name] : () => {}),
    set: (t, n, v) => { t[n] = v; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  g.round.cars.length = 1;
  g.round.spawnMs = 1e12;
  fills.length = 0;
  g.tick(16);
  assert.ok(!fills.includes("evenodd"), "by day, no dark");
  bounce.ensureRoad(g.round.road, 30000);
  const night = bounce.STAGES.findIndex((s) => s.id === "night") + 1;
  g.round.stage = night;
  const you = g.round.cars[0];
  you.d = g.round.road.stageAt[night - 1] + 30;
  g.round.far = 1e9;
  fills.length = 0;
  g.tick(16);
  assert.ok(fills.includes("evenodd"), "at night, the dark with the headlights cut out of it");
});
