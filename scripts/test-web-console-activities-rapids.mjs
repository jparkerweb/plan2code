// Web console tests, Rapids Run: the game contract, the river's shape, steering, speed, the guns, the battery and its buoys, crashes and the restart at the last dam, dams, combos, skims, power-ups, the river's foes and mini-bosses, the memo, the pills, the banners, and bots that show the river is always passable and that a careless run ends quickly.
// Run with: node --test scripts/test-web-console-activities-rapids.mjs
//
// No browser and no server: the game draws only through the canvas it is
// handed, so a stub canvas stands in for the page, as in
// scripts/test-web-console-activities.mjs, whose helpers this file copies.

import "./seed-random.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as rapids from "../src/web-console/public/activities/rapids.js";
import { hudLayout, labelSpot, LOOKS, inkOn, contrast } from "../src/web-console/public/activities/rapids-draw.js";
import { ACCENTS } from "../src/web-console/public/palette.js";
import { LIVES_BACK, LIVES_INK, livesText } from "../src/web-console/public/activities/pills.js";

const {
  advance, applyPower, channelAt, channelsAt, ensureRiver, hurtBoss, isWater, lose, newRiver, newRound, onLand, placeAt, riverAt, screenY, stretchFor, stretchName, underBanner,
  AHEAD, BATTERY, BOSS_EVERY, BOSS_POINTS, BUOY_CHARGE, BUOY_POINTS, COMBO_MS, CRASH_MS, CRUISE, DAM_POINTS, DAM_W, DIST_STEP, DRAIN, EDGE, FAST, FIELD_H, FIELD_W, FIRE_MS, FLAWLESS_POINTS, FOES,
  GRACE_MS, H, LOW_BATTERY, MAX_COMBO, MAX_LIVES, MAX_SHIELDS, MIN_CELL, MIN_CHANNEL, POWERS, READY_MS, RESPAWN_AT, ROW, SHIP_L, SHIP_W, SKIM_MS, SKIM_POINTS, SLOPE, SLOW, START_LIVES, STRETCHES, W, BANNER_Y,
} = rapids;
const game = rapids.default;

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

// A round with nothing on the river but the river: no foes, buoys, crates
// or bolts, so a test sets out only what it means to.
function quiet(seed = 7) {
  const round = newRound(seed);
  clear(round);
  return round;
}
function clear(round) {
  round.foes.length = 0;
  round.buoys.length = 0;
  round.crates.length = 0;
  round.bolts.length = 0;
  round.loaded = round.stretch + 1;
  return round;
}

// A foe set out by hand, shaped as the round's loader makes them.
function foe(round, kind, x, d, extra = {}) {
  const f = { kind, n: round.stretch, x, d, vx: 0, hp: FOES[kind].hp, r: FOES[kind].r, t: 0, flash: 0, on: false, fireMs: 600, ...extra };
  round.foes.push(f);
  return f;
}

const eventsOf = (round, type) => round.events.filter((e) => e.type === type);
const center = (round, d = round.ship.d) => riverAt(round.river, d).c;

// Runs `ms` in frames of 16, clearing the river ahead first if asked.
function run(round, ms, each = () => {}) {
  for (let t = 0; t < ms && !round.over; t += 16) {
    each(round);
    advance(round, 16);
  }
}

// Starts a game the way the window's key does and checks its opening banner:
// painted on the start's own frame, inside the field (0 to `field`), and in
// the same place on the first tick.
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

/* ---------------------------------------------------------------- bots */

// A careful bot: it keeps to the channel it is in over the next stretch of
// river (its whole hull, the stern too), heads for the middle of the water
// ahead, chases a buoy it can reach when the battery is under 90 and holds
// its fire off it, dodges what it can, slows for a dam still standing and
// fires the rest of the time.
function carefulBot(round) {
  const { ship, river } = round;
  const inp = round.input;
  const look = 6 + ship.v * 0.45;
  let lo = -Infinity;
  let hi = Infinity;
  let cx = ship.x;
  for (let a = -3; a <= look; a += 1.5) {
    const ch = channelAt(river, cx, ship.d + a);
    lo = Math.max(lo, ch.lo);
    hi = Math.min(hi, ch.hi);
    if (hi - lo < 6) {
      lo = ch.lo;
      hi = ch.hi;
      cx = (lo + hi) / 2;
    }
  }
  const far = channelAt(river, cx, ship.d + look);
  let tx = (far.lo + far.hi) / 2;
  const want = round.battery < 90;
  if (want) {
    const reach = (b) => {
      const ch = channelAt(river, ship.x, b.d);
      return b.x > ch.lo + 1 && b.x < ch.hi - 1;
    };
    const b = round.buoys.filter((o) => o.d > ship.d + 1 && o.d < ship.d + 60 && reach(o)).sort((a, c) => a.d - c.d)[0];
    if (b) tx = b.x;
  }
  for (const f of round.foes) {
    const ahead = f.d - ship.d;
    if (f.kind === "whirl" || f.kind === "sentry") continue;
    if (ahead > -2 && ahead < 16 && Math.abs(f.x - ship.x) < f.r + 2.4) tx = f.x > (lo + hi) / 2 ? lo + 2.6 : hi - 2.6;
  }
  inp.fire = !(want && round.buoys.some((b) => b.d > ship.d && b.d < ship.d + 75 && Math.abs(b.x - ship.x) < 3.5));
  if (hi - lo > 5.4) tx = Math.min(hi - 2.7, Math.max(lo + 2.7, tx));
  inp.left = tx < ship.x - 0.3;
  inp.right = tx > ship.x + 0.3;
  inp.down = round.dam.hp > 0 && round.dam.d - ship.d < 75;
  inp.up = false;
}

/* ------------------------------------------------------------ contract */

test("Rapids Run answers the game contract: start, pause, resume, keys, releases, ticks, a too small board refused, a number score and a state", () => {
  assert.equal(game.id, "rapids");
  assert.equal(game.title, "Rapids Run");
  assert.equal(typeof game.create, "function");
  assert.ok(Object.isFrozen(game));
  assert.ok(!("lowerIsBetter" in game), "the highest score is the best");
  const { canvas, calls } = stubCanvas();
  const g = game.create({ canvas, tone: () => {}, onScore: () => {} });
  assert.equal(g.state, "ready");
  assert.equal(g.score, 0);
  g.pause();
  assert.equal(g.state, "ready", "pause before start does nothing");
  g.resume();
  assert.equal(g.state, "ready", "resume before start does nothing");
  g.tick(10_000);
  assert.equal(g.state, "ready", "a tick before start does nothing");
  assert.equal(g.resize(1, 1), false, "a tiny board is refused");
  assert.equal(g.resize(W * MIN_CELL - 1, 4000), false, "too narrow to play");
  assert.equal(g.resize(4000, H * MIN_CELL - 1), false, "too short to play");
  assert.equal(g.resize(W * MIN_CELL, H * MIN_CELL), true, "just big enough");
  assert.equal(g.resize(2000, 2000), true);
  g.start();
  assert.equal(g.state, "running");
  g.key("left");
  g.key("action");
  g.pause();
  assert.equal(g.state, "paused");
  assert.deepEqual(Object.values(g.round.input), [false, false, false, false, false], "a pause lets go of every held key");
  const before = { score: g.score, calls: calls.count, clock: g.round.clock };
  g.tick(10_000);
  assert.deepEqual({ score: g.score, calls: calls.count, clock: g.round.clock }, before, "ticks while paused change nothing");
  g.resume();
  assert.equal(g.state, "running");
  for (const name of ["up", "down", "left", "right"]) assert.equal(g.key(name), true, `${name} is used`);
  assert.equal(g.key("action"), true);
  assert.equal(g.key("jump"), false, "an unknown key is not used");
  assert.equal(g.round.input.fire, true, "space held fires");
  g.release("action");
  g.release("left");
  assert.equal(g.round.input.fire, false, "let go, it stops firing");
  assert.equal(g.round.input.left, false);
  const drawn = calls.count;
  g.tick(200);
  assert.ok(calls.count > drawn, "a tick while running draws");
  assert.equal(typeof g.score, "number");
});

test("Rapids Run: space or Enter starts a round from the start or end screen without firing (Enter has no release), a press while running fires, and a press while paused leaves resuming to the window", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  g.resize(900, 900);
  g.key("action");
  assert.equal(g.state, "running");
  assert.equal(g.round.input.fire, false, "the start does not fire");
  g.round.battery = 50;
  g.round.buoys.push({ x: g.round.ship.x, d: g.round.ship.d + 40, n: 1, t: 0 });
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.equal(g.round.stats.popped, 0, "so no buoy ahead is shot");
  g.key("action");
  assert.equal(g.round.input.fire, true, "a press while running fires");
  g.release("action");
  g.pause();
  g.key("action");
  assert.equal(g.state, "paused", "only the window plays on");
  g.resume();
  g.round.lives = 1;
  lose(g.round, "flat");
  for (let k = 0; k < 100 && g.state === "running"; k++) g.tick(16);
  assert.equal(g.state, "over");
  g.key("action");
  assert.equal(g.state, "running", "a fresh round");
  assert.equal(g.round.input.fire, false, "again without firing");
});

test("Rapids Run: the round's end calls onScore once with its score, shows it big, and space starts a fresh round", () => {
  const texts = [];
  let font = "";
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push([String(text), font]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { if (name === "font") font = value; target[name] = value; return true; },
  });
  const scores = [];
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, onScore: (n) => scores.push(n) });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  clear(g.round);
  g.round.lives = 1;
  g.round.score = 1234;
  g.round.ship.x = riverAt(g.round.river, g.round.ship.d).L + 0.2;
  for (let ms = 0; ms < CRASH_MS + 200 && g.state === "running"; ms += 16) g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score], "onScore once, with the score");
  assert.ok(g.score >= 1234);
  texts.length = 0;
  g.resize(900, 900);
  assert.ok(texts.some(([t, f]) => t === String(g.score) && /\b7px/.test(f)), "the score, big");
  assert.ok(texts.some(([t]) => t.startsWith("Reached Willow Run (dam 1)")));
  g.tick(1000);
  assert.equal(scores.length, 1, "once");
  g.key("action");
  assert.equal(g.state, "running", "space starts again at once");
  assert.equal(g.score, 0);
  assert.equal(g.round.lives, START_LIVES);
});

/* -------------------------------------------------------------- river */

test("Rapids Run: the same seed builds the same river and plan, a different seed another", () => {
  const a = newRiver(42);
  const b = newRiver(42);
  const c = newRiver(43);
  for (const r of [a, b, c]) ensureRiver(r, 3000);
  assert.deepEqual(a.C.slice(0, 1200), b.C.slice(0, 1200));
  assert.deepEqual(a.plans[2], b.plans[2]);
  assert.notDeepEqual(a.C.slice(0, 1200), c.C.slice(0, 1200));
});

test("Rapids Run: over the first ten stretches on many rivers, every row keeps a channel at least MIN_CHANNEL wide, the banks on the field, no bank slanting past SLOPE, and a dam DAM_W wide at each stretch's end", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const river = newRiver(seed * 977);
    ensureRiver(river, 0);
    while (river.built < 10) rapids.buildStretch(river, river.built + 1);
    let prev = null;
    for (let i = 0; i < river.rows; i++) {
      const d = i * ROW;
      const r = riverAt(river, d);
      assert.ok(r.L >= EDGE - 1e-9 && r.R <= FIELD_W - EDGE + 1e-9, `seed ${seed} row ${i}: banks on the field (${r.L}, ${r.R})`);
      for (const ch of channelsAt(river, d)) assert.ok(ch.hi - ch.lo >= MIN_CHANNEL - 1e-9, `seed ${seed} row ${i}: a channel ${ch.hi - ch.lo} wide`);
      if (prev) {
        for (const k of ["L", "R"]) assert.ok(Math.abs(r[k] - prev[k]) <= SLOPE * ROW + 1e-9, `seed ${seed} row ${i}: ${k} slants ${Math.abs(r[k] - prev[k])}`);
        if (r.island && prev.island) for (const k of ["IL", "IR"]) assert.ok(Math.abs(r[k] - prev[k]) <= SLOPE * ROW + 1e-9, `seed ${seed} row ${i}: the island's ${k}`);
      }
      prev = r;
    }
    for (let n = 1; n <= 10; n++) {
      const dam = riverAt(river, river.damAt[n]);
      assert.ok(Math.abs(dam.w - DAM_W) < 1e-6 && !dam.island, `seed ${seed}: dam ${n} spans the river, ${DAM_W} wide`);
      assert.ok(river.damAt[n] > river.startAt[n] + 400, `seed ${seed}: stretch ${n} has room`);
      if (n > 1) assert.ok(river.startAt[n] > river.damAt[n - 1], "a stretch starts past the last dam");
      assert.equal(river.bossAt[n] > 0, n % BOSS_EVERY === 0, "a basin before every BOSS_EVERYth dam");
    }
  }
});

test("Rapids Run: a stretch's plan puts foes, buoys and crates on open water (sentries on the bank), none where you start again and none just before the dam", () => {
  for (let seed = 1; seed <= 15; seed++) {
    const river = newRiver(seed * 31);
    ensureRiver(river, 0);
    while (river.built < 8) rapids.buildStretch(river, river.built + 1);
    for (let n = 1; n <= 8; n++) {
      const plan = river.plans[n];
      assert.ok(plan.some((p) => p.kind === "buoy"), "buoys");
      assert.ok(plan.some((p) => p.kind === "crate"), "a crate");
      for (const p of plan) {
        assert.ok(p.d >= river.startAt[n] + 30, `seed ${seed} stretch ${n}: ${p.kind} clear of the restart`);
        assert.ok(p.d <= river.damAt[n] - 20, `seed ${seed} stretch ${n}: ${p.kind} clear of the dam`);
        if (p.kind === "gull") continue;
        if (p.kind === "sentry") assert.ok(!isWater(river, p.x, p.d) && p.x > 0 && p.x < FIELD_W, `${p.kind} on the bank`);
        else assert.ok(isWater(river, p.x, p.d), `seed ${seed} stretch ${n}: ${p.kind} at ${p.x} on the water`);
        if (p.kind !== "buoy" && p.kind !== "crate") assert.ok(FOES[p.kind].from <= n, `${p.kind} not before stretch ${FOES[p.kind].from}`);
      }
    }
  }
});

test("Rapids Run: stretches are named, the eight then Night Water again and again, quicker each time, a boss every BOSS_EVERY", () => {
  assert.equal(STRETCHES.length, 8);
  assert.equal(stretchFor(1).name, "Willow Run");
  assert.equal(stretchName(3), "Stone Gate (dam 3)");
  assert.equal(stretchFor(9).name, "Night Water");
  assert.equal(stretchFor(10).name, "Night Water 2");
  assert.ok(stretchFor(4).boss && stretchFor(8).boss && !stretchFor(5).boss);
  for (let n = 1; n < 14; n++) assert.ok(stretchFor(n + 1).pace >= stretchFor(n).pace);
  for (let n = 1; n <= 14; n++) assert.ok(LOOKS[stretchFor(n).look], `stretch ${n} has a look`);
});

/* -------------------------------------------------------------- moving */

test("Rapids Run: held arrows steer until let go, the skimmer stays on the field, and up, down or neither sets the speed", () => {
  const round = quiet();
  const ship = round.ship;
  const x = ship.x;
  round.input.right = true;
  run(round, 300);
  assert.ok(ship.x > x + 4, "right steers right");
  round.input.right = false;
  run(round, 400);
  assert.ok(Math.abs(ship.vx) < 0.5, "let go, it stops sliding");
  const pace = stretchFor(1).pace;
  round.input.up = true;
  run(round, 1000);
  assert.ok(Math.abs(ship.v - FAST * pace) < 1e-6, "up held: full speed");
  round.input.up = false;
  round.input.down = true;
  run(round, 1000);
  assert.ok(Math.abs(ship.v - SLOW * pace) < 1e-6, "down held: slow");
  round.input.down = false;
  run(round, 1000);
  assert.ok(Math.abs(ship.v - CRUISE * pace) < 1e-6, "neither: cruising");
  assert.ok(Math.abs(round.cam - (ship.d - rapids.BEHIND)) < 1e-9, "the view follows");
});

test("Rapids Run: the river runs DIST_POINTS a DIST_STEP, twice that at full speed", () => {
  const slow = quiet();
  const fast = quiet();
  fast.input.up = true;
  run(fast, 600);
  const d0 = { slow: slow.ship.d, fast: fast.ship.d };
  const s0 = { slow: slow.score, fast: fast.score };
  run(slow, 1000);
  run(fast, 1000);
  const rate = (r, k) => (r.score - s0[k]) / ((r.ship.d - d0[k]) / DIST_STEP);
  assert.ok(Math.abs(rate(slow, "slow") - 1) < 0.2, `cruising: about 1 a step (${rate(slow, "slow")})`);
  assert.ok(Math.abs(rate(fast, "fast") - 2) < 0.3, `full speed: about 2 a step (${rate(fast, "fast")})`);
});

test("Rapids Run: held fire shoots every FIRE_MS, spread shot fans three, and a shot sinks a skiff", () => {
  const round = quiet();
  round.input.fire = true;
  advance(round, 1000);
  const shots = eventsOf(round, "shoot").length;
  assert.ok(Math.abs(shots - 1000 / FIRE_MS) <= 1, `${shots} shots a second`);
  round.events.length = 0;
  round.shots.length = 0;
  applyPower(round, "spread");
  advance(round, FIRE_MS);
  assert.equal(round.shots.length % 3, 0, "three at a time");
  assert.ok(round.shots.some((s) => s.vx < 0) && round.shots.some((s) => s.vx > 0), "fanned out");
  round.input.fire = false;
  round.shots.length = 0;
  const f = foe(round, "skiff", round.ship.x, round.ship.d + 20);
  round.input.fire = true;
  advance(round, 400);
  assert.ok(!round.foes.includes(f), "sunk");
  assert.equal(eventsOf(round, "kill")[0].points, FOES.skiff.points);
  assert.equal(round.stats.kills, 1);
});

/* ------------------------------------------------------------ battery */

test("Rapids Run: the battery drains DRAIN a second cruising, more at speed and less slowed; a buoy run over charges BUOY_CHARGE, never past full; a shot one is gone for BUOY_POINTS", () => {
  const cruise = quiet();
  run(cruise, 1000);
  assert.ok(Math.abs(BATTERY - cruise.battery - DRAIN) < 0.1, `cruising drains ${BATTERY - cruise.battery}`);
  const fast = quiet();
  fast.input.up = true;
  const slow = quiet();
  slow.input.down = true;
  run(fast, 2000);
  run(slow, 2000);
  assert.ok(fast.battery < cruise.battery - DRAIN, "faster drains more");
  assert.ok(slow.battery > BATTERY - 2 * DRAIN, "slowed drains less");
  const round = quiet();
  round.battery = 30;
  round.buoys.push({ x: round.ship.x, d: round.ship.d + 6, n: 1, t: 0 });
  run(round, 400);
  assert.equal(round.buoys.length, 0);
  assert.ok(round.battery > 30 + BUOY_CHARGE - 2, `charged to ${round.battery}`);
  assert.equal(eventsOf(round, "charge").length, 1);
  round.battery = BATTERY - 5;
  round.buoys.push({ x: round.ship.x, d: round.ship.d + 6, n: 1, t: 0 });
  run(round, 400);
  assert.ok(round.battery <= BATTERY, "never past full");
  const shoot = quiet();
  shoot.battery = 50;
  shoot.buoys.push({ x: shoot.ship.x, d: shoot.ship.d + 40, n: 1, t: 0 });
  shoot.input.fire = true;
  const score = shoot.score;
  run(shoot, 500);
  assert.equal(shoot.buoys.length, 0, "shot to pieces");
  assert.equal(eventsOf(shoot, "popbuoy")[0].points, BUOY_POINTS);
  assert.equal(eventsOf(shoot, "charge").length, 0, "and no charge from it");
  assert.ok(shoot.score >= score + BUOY_POINTS);
  assert.ok(shoot.battery < 50);
});

test("Rapids Run: a flat battery costs a life even with a shield, and the stretch starts again with a full one", () => {
  const round = quiet();
  round.shield = 1;
  round.battery = 0.5;
  run(round, 400);
  const lost = eventsOf(round, "lose");
  assert.equal(lost.length, 1);
  assert.equal(lost[0].cause, "flat");
  assert.equal(round.lives, START_LIVES - 1);
  assert.equal(round.shield, 1, "the shield cannot help");
  run(round, CRASH_MS + 50);
  assert.equal(round.phase, "ready");
  assert.equal(round.battery, BATTERY);
});

/* ------------------------------------------------------------ crashes */

test("Rapids Run: a bank or an island under the hull costs a life, the wreck shows CRASH_MS, then the skimmer waits READY_MS at the stretch's start, blinking for GRACE_MS", () => {
  const round = quiet();
  const ship = round.ship;
  ship.x = riverAt(round.river, ship.d).R - 0.4;
  advance(round, 16);
  assert.equal(eventsOf(round, "lose")[0].cause, "bank");
  assert.equal(round.phase, "crash");
  assert.equal(ship.alive, false);
  const d = ship.d;
  advance(round, CRASH_MS - 100);
  assert.equal(ship.d, d, "the wreck holds still");
  advance(round, 150);
  assert.equal(round.phase, "ready");
  assert.equal(eventsOf(round, "respawn").length, 1);
  assert.equal(ship.d, round.river.startAt[1] + RESPAWN_AT);
  assert.ok(ship.invuln > GRACE_MS - 200);
  const at = ship.d;
  advance(round, READY_MS - 200);
  assert.equal(ship.d, at, "waiting still");
  advance(round, 200);
  assert.equal(round.phase, "run");
  assert.equal(eventsOf(round, "go").length, 1);
  // An island.
  const r2 = quiet(3);
  let isle = -1;
  for (let i = 0; i < r2.river.rows; i++) if (r2.river.IW[i] > 8) { isle = i; break; }
  if (isle < 0) {
    ensureRiver(r2.river, 4000);
    for (let i = 0; i < r2.river.rows; i++) if (r2.river.IW[i] > 8) { isle = i; break; }
  }
  assert.ok(isle > 0, "an island somewhere");
  r2.ship.d = isle * ROW;
  r2.ship.x = r2.river.C[isle];
  advance(r2, 16);
  assert.equal(eventsOf(r2, "lose")[0]?.cause, "bank", "an island is land too");
});

test("Rapids Run: running into a foe or a bolt costs a life; a shield takes one crash of any kind but a flat battery, and slides you off a bank", () => {
  const round = quiet();
  foe(round, "mine", round.ship.x, round.ship.d + 3);
  advance(round, 100);
  assert.equal(eventsOf(round, "lose")[0].cause, "foe");
  const r2 = quiet();
  r2.bolts.push({ x: r2.ship.x, d: r2.ship.d + 3, vx: 0, vd: -20 });
  advance(r2, 200);
  assert.equal(eventsOf(r2, "lose")[0].cause, "bolt");
  const r3 = quiet();
  applyPower(r3, "shield");
  applyPower(r3, "shield");
  applyPower(r3, "shield");
  assert.equal(r3.shield, MAX_SHIELDS);
  const m = foe(r3, "skiff", r3.ship.x, r3.ship.d + 3);
  advance(r3, 100);
  assert.equal(eventsOf(r3, "lose").length, 0);
  assert.equal(eventsOf(r3, "shield").length, 1);
  assert.ok(!r3.foes.includes(m), "the skiff is rammed and sunk");
  assert.equal(r3.shield, MAX_SHIELDS - 1);
  r3.ship.invuln = 0;
  r3.ship.x = riverAt(r3.river, r3.ship.d).L + 0.3;
  advance(r3, 16);
  assert.equal(eventsOf(r3, "lose").length, 0, "the last shield takes the bank");
  assert.equal(r3.shield, 0);
  assert.ok(!onLand(r3.river, r3.ship.x, r3.ship.d), "and slides you off it");
  assert.equal(r3.lives, START_LIVES);
});

test("Rapids Run: while blinking after a crash nothing hits you, and lose() never takes two lives at once", () => {
  const round = quiet();
  round.ship.invuln = 500;
  foe(round, "mine", round.ship.x, round.ship.d + 2);
  advance(round, 100);
  assert.equal(eventsOf(round, "lose").length, 0);
  round.ship.invuln = 0;
  assert.equal(lose(round, "foe"), true);
  assert.equal(lose(round, "foe"), false);
  assert.equal(round.lives, START_LIVES - 1);
});

test("Rapids Run: losing the last life ends the round once the wreck has shown", () => {
  const round = quiet();
  round.lives = 1;
  lose(round, "bank");
  assert.equal(round.over, false);
  assert.equal(advance(round, CRASH_MS + 20), "over");
  assert.equal(eventsOf(round, "over").length, 1);
});

/* --------------------------------------------------------------- dams */

// Puts a quiet round just short of its dam, slowed and firing.
function atDam(round, gap = 60) {
  const dam = round.dam;
  round.ship.d = dam.d - gap;
  round.ship.x = center(round);
  round.cam = round.ship.d - rapids.BEHIND;
  round.input.down = true;
  round.input.fire = true;
}

test("Rapids Run: a dam takes its stretch's damHp shots, scores DAM_POINTS times the stretch, and once past it the next stretch begins, with a bonus for no life lost", () => {
  const round = quiet();
  atDam(round);
  const hp = stretchFor(1).damHp;
  assert.equal(round.dam.hp, hp);
  run(round, 4000, () => clear(round));
  const hits = eventsOf(round, "damhit");
  assert.equal(hits.length, hp - 1);
  const broke = eventsOf(round, "dambreak");
  assert.equal(broke.length, 1);
  assert.equal(broke[0].points, DAM_POINTS * 1);
  assert.equal(round.stats.dams, 1);
  round.input.down = false;
  run(round, 3000, () => clear(round));
  const next = eventsOf(round, "stretch");
  assert.equal(next.length, 1);
  assert.equal(next[0].n, 2);
  assert.equal(next[0].bonus, FLAWLESS_POINTS);
  assert.equal(round.stretch, 2);
  assert.equal(round.dam.hp, stretchFor(2).damHp);
  assert.equal(round.dam.d, round.river.damAt[2]);
});

test("Rapids Run: a dam still standing is a crash, and after one in stretch 2 you start again just past dam 1 with dam 2 whole", () => {
  const round = quiet();
  placeAt(round, 2);
  clear(round);
  round.ship.d = round.dam.d - SHIP_L;
  round.ship.x = center(round, round.dam.d);
  round.dam.hp = 3;
  advance(round, 200);
  assert.equal(eventsOf(round, "lose")[0].cause, "dam");
  advance(round, CRASH_MS + 50);
  assert.equal(round.stretch, 2);
  assert.equal(round.ship.d, round.river.startAt[2] + RESPAWN_AT);
  assert.ok(round.ship.d > round.river.damAt[1]);
  assert.equal(round.dam.hp, stretchFor(2).damHp, "the dam is whole again");
  assert.equal(round.stretchHit, true, "and the life stays lost until the next dam");
});

test("Rapids Run: a stretch with a life lost earns no flawless bonus, even after the restart; a dam blasted then a crash before it stays open and is paid once", () => {
  const round = quiet();
  round.ship.x = riverAt(round.river, round.ship.d).L + 0.2;
  advance(round, 16);
  assert.equal(eventsOf(round, "lose").length, 1);
  advance(round, CRASH_MS + READY_MS + 100);
  assert.equal(round.phase, "run");
  clear(round);
  atDam(round);
  run(round, 6000, () => clear(round));
  const next = eventsOf(round, "stretch");
  assert.equal(next.length, 1);
  assert.equal(next[0].bonus, 0, "no flawless bonus");
  assert.equal(round.stretchHit, false, "the next stretch starts clean");
  const r2 = quiet();
  atDam(r2);
  run(r2, 6000, (r) => {
    clear(r);
    if (r.dam.hp <= 0 && !eventsOf(r, "lose").length) lose(r, "foe");
  });
  assert.equal(eventsOf(r2, "dambreak").length, 1);
  assert.equal(eventsOf(r2, "lose").length, 1);
  const score = r2.score;
  advance(r2, CRASH_MS + READY_MS + 100);
  assert.equal(r2.dam.hp, 0, "the dam stays open after the restart");
  run(r2, 40_000, (r) => {
    clear(r);
    r.battery = BATTERY;
    carefulBot(r);
    if (eventsOf(r, "stretch").length) r.over = true;
  });
  assert.equal(eventsOf(r2, "dambreak").length, 1, "and is paid for once");
  const passed = eventsOf(r2, "stretch");
  assert.equal(passed.length, 1);
  assert.equal(passed[0].bonus, 0);
  assert.ok(r2.score >= score, "nothing taken back");
});

/* ------------------------------------------------------- combos, skims */

test("Rapids Run: kills within COMBO_MS step the combo up to MAX_COMBO, multiplying the points, and it lapses after", () => {
  const round = quiet();
  const points = [];
  for (let k = 0; k < MAX_COMBO + 2; k++) {
    const f = foe(round, "skiff", 10, round.ship.d + 30);
    rapids.hurtFoe(round, f);
    points.push(round.events.at(-1).points);
    advance(round, 100);
  }
  assert.deepEqual(points, [1, 2, 3, 4, 5, 5, 5].map((m) => m * FOES.skiff.points));
  assert.equal(round.bestCombo, MAX_COMBO);
  advance(round, COMBO_MS + 50);
  assert.equal(round.combo, 1);
  const f = foe(round, "mine", 10, round.ship.d + 30);
  assert.equal(rapids.hurtFoe(round, f), false, "a mine takes two");
  assert.equal(rapids.hurtFoe(round, f), true);
  assert.equal(round.events.at(-1).points, FOES.mine.points);
});

test("Rapids Run: skimming a bank closer than SKIM_GAP at cruising speed scores SKIM_POINTS each SKIM_MS; slowed down it scores nothing", () => {
  const skimming = quiet();
  const hug = (r) => {
    const ch = channelAt(r.river, r.ship.x, r.ship.d);
    const ch2 = channelAt(r.river, r.ship.x, r.ship.d + SHIP_L / 2);
    r.ship.x = Math.max(ch.lo, ch2.lo) + SHIP_W / 2 + 0.5;
    r.ship.vx = 0;
  };
  run(skimming, 1000, hug);
  const skims = eventsOf(skimming, "skim");
  assert.ok(Math.abs(skims.length - 1000 / SKIM_MS) <= 1, `${skims.length} skims a second`);
  assert.equal(skims[0].points, SKIM_POINTS);
  const slow = quiet();
  slow.input.down = true;
  run(slow, 600);
  slow.events.length = 0;
  run(slow, 1000, hug);
  assert.equal(eventsOf(slow, "skim").length, 0);
});

/* ------------------------------------------------------------ powers */

test("Rapids Run: power-ups: a crate run over is taken; spread and magnet run out; the magnet pulls buoys in; surge fills the battery", () => {
  const round = quiet();
  round.crates.push({ x: round.ship.x, d: round.ship.d + 6, n: 1, kind: "magnet" });
  run(round, 400);
  assert.equal(round.crates.length, 0);
  assert.ok(rapids.active(round, "magnet"));
  round.battery = 40;
  const b = { x: round.ship.x + 12, d: round.ship.d + 14, n: 1, t: 0 };
  round.buoys.push(b);
  run(round, 900);
  assert.equal(round.buoys.length, 0, "pulled in and taken");
  assert.ok(round.battery > 60);
  run(round, POWERS.magnet.ms);
  assert.ok(!rapids.active(round, "magnet"), "it runs out");
  round.battery = 10;
  applyPower(round, "surge");
  assert.equal(round.battery, BATTERY);
  applyPower(round, "spread");
  assert.equal(round.effects.spread, POWERS.spread.ms);
  assert.deepEqual(Object.keys(POWERS).sort(), ["magnet", "shield", "spread", "surge"]);
});

/* -------------------------------------------------------------- foes */

test("Rapids Run: a skiff drifts and turns at the banks, a darter swerves into your lane, a mine sits still, and a whirlpool tugs you toward its eye and lets shots through", () => {
  const round = quiet();
  const ch = channelAt(round.river, round.ship.x, round.ship.d + 30);
  const skiff = foe(round, "skiff", ch.hi - 2.5, round.ship.d + 40, { vx: 8 });
  round.ship.d += 0;
  for (let k = 0; k < 40; k++) {
    advance(round, 16);
    round.ship.d = skiff.d - 40;
  }
  assert.ok(skiff.vx < 0, "turned at the bank");
  const r2 = quiet();
  r2.ship.x = center(r2) - 4;
  const dart = foe(r2, "darter", r2.ship.x + 6, r2.ship.d + 30, { vx: 2 });
  advance(r2, 300);
  assert.ok(Math.abs(dart.x - r2.ship.x) < 6 - 1, "swerved toward you");
  const r3 = quiet();
  const mine = foe(r3, "mine", 10, r3.ship.d + 40);
  advance(r3, 300);
  assert.equal(mine.x, 10);
  const r4 = quiet();
  r4.ship.x = center(r4) - 3;
  foe(r4, "whirl", center(r4), r4.ship.d + 1);
  const x0 = r4.ship.x;
  advance(r4, 100);
  assert.ok(r4.ship.x > x0 + 0.3, "tugged toward the eye");
  r4.foes[0].d = r4.ship.d + 25;
  r4.foes[0].x = r4.ship.x;
  r4.input.fire = true;
  advance(r4, 300);
  assert.equal(r4.foes.length, 1, "a whirlpool cannot be shot");
  assert.equal(eventsOf(r4, "kill").length, 0);
});

test("Rapids Run: a gull drone takes off as you near and swoops across over land and all; a bank sentry fires at you while you are in its range", () => {
  const round = quiet();
  const gull = foe(round, "gull", -3, round.ship.d + 80, { vx: 18 });
  advance(round, 16);
  assert.equal(gull.on, false, "still waiting");
  round.ship.d = gull.d - 50;
  advance(round, 16);
  assert.equal(gull.on, true);
  assert.equal(eventsOf(round, "gull").length, 1);
  const x = gull.x;
  const d = gull.d;
  advance(round, 500);
  assert.ok(gull.x > x + 8 && gull.d < d, "across and down at you");
  const r2 = quiet();
  const r = riverAt(r2.river, r2.ship.d + 40);
  foe(r2, "sentry", r.L - 3, r2.ship.d + 40);
  r2.input.down = true;
  advance(r2, 1000);
  assert.ok(eventsOf(r2, "bolt").length >= 1, "it fires");
  assert.ok(r2.bolts.length >= 1);
});

test("Rapids Run: foes turn up from their own stretch, and each stretch has more of them", () => {
  for (const [kind, from] of [["skiff", 1], ["mine", 1], ["gull", 2], ["sentry", 3], ["whirl", 5], ["darter", 6]]) assert.equal(FOES[kind].from, from);
  for (let n = 1; n < 10; n++) {
    if (stretchFor(n).boss || stretchFor(n + 1).boss) continue;
    assert.ok(stretchFor(n + 1).foes >= stretchFor(n).foes);
  }
  const river = newRiver(5);
  ensureRiver(river, 0);
  while (river.built < 7) rapids.buildStretch(river, river.built + 1);
  const kinds = new Set(river.plans.slice(1, 8).flatMap((p) => p.map((e) => e.kind)));
  for (const k of Object.keys(FOES)) assert.ok(kinds.has(k), `${k} turns up by stretch 7`);
});

/* -------------------------------------------------------------- boss */

test("Rapids Run: at every BOSS_EVERYth dam a mini-boss holds the basin: the river stops, the battery holds, it fires, and sinking it scores, gives a life and opens the way", () => {
  const round = quiet();
  placeAt(round, BOSS_EVERY);
  clear(round);
  round.ship.d = round.river.bossAt[BOSS_EVERY] - 2;
  round.ship.x = center(round);
  advance(round, 200);
  assert.equal(round.phase, "boss");
  assert.equal(eventsOf(round, "bossin").length, 1);
  const boss = round.boss;
  assert.equal(boss.kind, "dredger");
  const d = round.ship.d;
  const battery = round.battery;
  run(round, 3000, (r) => (r.ship.invuln = 1e9));
  assert.equal(round.ship.d, d, "the river holds still");
  assert.equal(round.battery, battery, "and the battery holds");
  assert.ok(eventsOf(round, "bolt").some((e) => e.boss), "it fires");
  round.lives = 2;
  assert.equal(hurtBoss(round, boss.hp), true);
  assert.equal(round.boss, null);
  assert.equal(round.phase, "run");
  const down = eventsOf(round, "bossdown")[0];
  assert.equal(down.points, BOSS_POINTS);
  assert.equal(round.lives, 3, "a life back");
  assert.equal(round.crates.length, 1, "and a crate");
  run(round, 2000);
  assert.ok(round.ship.d > d + 20, "the river runs again");
  assert.equal(eventsOf(round, "bossin").length, 1, "and the boss never comes back");
  const r2 = quiet();
  placeAt(r2, BOSS_EVERY * 2);
  clear(r2);
  r2.ship.d = r2.river.bossAt[BOSS_EVERY * 2] - 1;
  r2.ship.x = center(r2);
  advance(r2, 100);
  assert.equal(r2.boss.kind, "ironclad", "the next boss is another");
  r2.lives = MAX_LIVES;
  run(r2, 1500, (r) => (r.ship.invuln = 1e9));
  hurtBoss(r2, r2.boss.hp);
  assert.equal(r2.lives, MAX_LIVES, "never past MAX_LIVES");
  assert.equal(eventsOf(r2, "bossdown")[0].life, false);
});

test("Rapids Run: a life lost once the boss's basin is reached starts again at the basin's mouth, not the whole stretch, and the boss comes back", () => {
  const round = quiet();
  placeAt(round, BOSS_EVERY);
  clear(round);
  const bossAt = round.river.bossAt[BOSS_EVERY];
  round.ship.d = bossAt - 1;
  round.ship.x = center(round);
  advance(round, 100);
  assert.equal(round.phase, "boss");
  round.ship.invuln = 0;
  lose(round, "bolt");
  advance(round, CRASH_MS + 50);
  assert.equal(round.phase, "ready");
  assert.ok(round.ship.d < bossAt && round.ship.d > bossAt - 30, `at the basin's mouth (${round.ship.d}, the boss at ${bossAt})`);
  assert.ok(!onLand(round.river, round.ship.x, round.ship.d));
  run(round, 3000, (r) => (r.ship.invuln = 1e9));
  assert.equal(round.phase, "boss", "the boss again");
  assert.ok(round.boss);
});

/* ------------------------------------------------------------- banners */

test("Rapids Run: the banner's strip counts a foe, a bolt, the boss or a standing dam under it, and not a gull still waiting or a dam already open", () => {
  const round = quiet();
  const dAt = (y) => round.cam + FIELD_H - y;
  assert.equal(underBanner(round), false, "nothing there");
  const f = foe(round, "skiff", 20, dAt(BANNER_Y));
  assert.equal(underBanner(round), true, "a skiff in the strip");
  f.d = dAt(BANNER_Y + 20);
  assert.equal(underBanner(round), false, "well below it");
  const g = foe(round, "gull", -3, dAt(BANNER_Y));
  assert.equal(underBanner(round), false, "a gull not yet flying");
  g.on = true;
  assert.equal(underBanner(round), true, "a gull swooping");
  round.foes.length = 0;
  round.bolts.push({ x: 10, d: dAt(BANNER_Y + 2), vx: 0, vd: -10 });
  assert.equal(underBanner(round), true, "a bolt");
  round.bolts.length = 0;
  round.dam.d = dAt(BANNER_Y);
  assert.equal(underBanner(round), true, "a dam to shoot");
  round.dam.hp = 0;
  assert.equal(underBanner(round), false, "an open dam");
  assert.ok(BANNER_Y < FIELD_H - rapids.BEHIND - 15, "the strip sits well above the skimmer");
  assert.equal(screenY(round, round.ship.d), FIELD_H - rapids.BEHIND);
});

test("Rapids Run game: the opening banner sits in the field from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.32)");
  const g = game.create({ canvas });
  g.resize(900, 900);
  openingBanner(g, shades, FIELD_H);
});

test("Rapids Run game: a banner fades to see-through while something you must react to is in its strip, and back once it is gone", () => {
  const alphas = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get: (t, name) => (name === "fillRect" ? () => t.fillStyle === "rgba(0, 0, 0, 0.32)" && alphas.push(t.globalAlpha) : name in t ? t[name] : () => {}),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  clear(g.round);
  const mine = foe(g.round, "mine", 6, 0);
  for (let k = 0; k < 40; k++) {
    mine.d = g.round.cam + FIELD_H - BANNER_Y;
    g.tick(16);
  }
  assert.ok(alphas.at(-1) <= 0.15, `see-through over the mine (${alphas.at(-1)})`);
  clear(g.round);
  for (let k = 0; k < 40; k++) g.tick(16);
  assert.ok(alphas.at(-1) > 0.9, `back once it is gone (${alphas.at(-1)})`);
});

test("Rapids Run game: a banner that first shows during a boss fight sits lower, clear of the boss and still above the skimmer, and keeps the see-through rule", () => {
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.32)");
  const g = game.create({ canvas });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const round = g.round;
  placeAt(round, BOSS_EVERY);
  clear(round);
  round.ship.d = round.river.bossAt[BOSS_EVERY] - 1;
  round.ship.x = center(round);
  // Past the opening banner, into the fight; the boss's own banner comes next.
  for (let k = 0; k < 150; k++) {
    round.ship.invuln = 1e9;
    shades.length = 0;
    g.tick(16);
  }
  assert.equal(round.phase, "boss");
  assert.equal(shades.length, 1, "a banner showing");
  const [[top, h]] = shades;
  const mid = top + h / 2;
  assert.ok(Math.abs(mid - rapids.BOSS_BANNER_Y) < 0.01, `placed low (${mid})`);
  assert.ok(Math.abs(screenY(round, round.boss.d) - mid) > rapids.BANNER_HALF + 2, "clear of the boss");
  assert.ok(top + h < screenY(round, round.ship.d) - SHIP_L, "and above the skimmer");
  round.bolts.length = 0;
  assert.equal(underBanner(round, mid), false, "nothing in its strip");
  round.bolts.push({ x: 20, d: round.cam + FIELD_H - mid, vx: 0, vd: -10 });
  assert.equal(underBanner(round, mid), true, "a bolt crossing it still counts");
});

test("Rapids Run game: the start and end screens' lines all fit the field at full size, and the start screen's strip is clear of the skimmer", () => {
  const lines = [];
  const shades = [];
  let font = "";
  const ctx = new Proxy({}, {
    get: (t, name) => {
      if (name === "fillText") return (text, x, y, max) => lines.push({ text: String(text), size: Number(/([\d.]+)px/.exec(font)?.[1]), max, y });
      if (name === "fillRect") return (x, y, w, h) => t.fillStyle === "rgba(0, 0, 0, 0.55)" && shades.push([y, h]);
      return name in t ? t[name] : () => {};
    },
    set: (t, name, value) => { if (name === "font") font = value; t[name] = value; return true; },
  });
  const memo = { get: () => 19, set() {} };
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, memo, best: () => 1 });
  g.resize(900, 900);
  const fits = (what) => {
    const tally = lines.filter((l) => l.max === FIELD_W - 4);
    assert.ok(tally.length >= 3, `${what}: several lines (${tally.map((l) => l.text)})`);
    for (const l of tally) assert.ok(l.text.length * l.size * 0.62 <= l.max, `${what}: "${l.text}" fits without a squeeze`);
  };
  fits("start");
  const skimmer = FIELD_H - rapids.BEHIND - SHIP_L;
  assert.ok(shades.length && shades.every(([y, h]) => y + h < skimmer), `the start strip is clear of the skimmer (${shades})`);
  g.key("action");
  g.tick(16);
  placeAt(g.round, 20);
  g.round.score = 99999;
  g.round.lives = 1;
  lose(g.round, "flat");
  for (let k = 0; k < 100 && g.state === "running"; k++) g.tick(16);
  assert.equal(g.state, "over");
  lines.length = 0;
  g.resize(900, 900);
  fits("end");
  assert.ok(lines.some((l) => l.text === "Reached Night Water 12 (dam 20)"));
  assert.ok(lines.some((l) => l.text === "A new best!"), "the news on its own line");
});

test("Rapids Run: the end screen's boss hint names the next boss's dam from the one still standing", () => {
  const round = quiet();
  placeAt(round, 7);
  assert.equal(rapids.teaser(round, 3), "A boss guards dam 8. One more go?");
  placeAt(round, 8);
  assert.equal(rapids.teaser(round, 3), "A boss guards dam 8. One more go?", "dam 8 still standing");
  round.dam.hp = 0;
  assert.equal(rapids.teaser(round, 3), "A boss guards dam 12. One more go?", "dam 8 open");
  assert.equal(rapids.teaser(round, 14), "Can you beat dam 15?");
  placeAt(round, 2);
  assert.equal(rapids.teaser(round, 0), "A new foe waits at stretch 3...");
});

/* --------------------------------------------------------------- pills */

test("Rapids Run: lives are drawn in the lives pill, solid, white, a heart per life, right after the stretch pill", () => {
  for (const lives of [3, 1, 5]) {
    const { canvas, pills, reset } = pillCanvas("#ffffff");
    const g = game.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    for (let k = 0; k < 5; k++) g.tick(16);
    g.round.lives = lives;
    reset();
    g.tick(16);
    const all = pills();
    const at = all.findIndex((p) => p.text.startsWith("♥"));
    assert.ok(at >= 0, `a lives pill (${all.map((p) => p.text)})`);
    const p = all[at];
    assert.equal(p.text, livesText(lives));
    assert.equal(p.backing, LIVES_BACK);
    assert.equal(p.ink, LIVES_INK);
    assert.ok(all[at - 1].text.startsWith("STRETCH"), "after the stretch pill");
  }
});

test("Rapids Run: every pill's text reads at 4.5:1 on its backing and its timer's tint, lives, a shield, spread, magnet and the combo included, in light and dark under every highlight", () => {
  checkPills({
    setup: (r) => {
      r.shield = 1;
      r.effects.spread = POWERS.spread.ms / 2;
      r.effects.magnet = POWERS.magnet.ms / 2;
      r.combo = 3;
      r.comboMs = COMBO_MS / 2;
    },
    expect: ["STRETCH 1", "♥", "SHIELD", "~SPREAD", "~MAGNET", "~x3 COMBO"],
  });
});

test("Rapids Run: the pills never overlap, leave the board or spill out of their strip, even on the smallest board with every pill wanted; every word stays on the field; Planny's arms stand out on the skimmer in every highlight", () => {
  const hud = { stretch: "STRETCH 12", color: "#57b54a", effects: [{ text: "SHIELD x2", color: "#1fb6d9", fill: 1 }, { text: "SPREAD", color: "#ff8a1f", fill: 0.5 }, { text: "MAGNET", color: "#a466ff", fill: 0.5 }], combo: 5, comboFill: 0.5 };
  for (const u of [MIN_CELL, 4, 6, 10]) {
    const h = Math.max(12 / u, 2.4);
    const placed = hudLayout(h, W, MAX_LIVES, hud, rapids.HUD_H);
    assert.equal(placed.length, 6);
    for (const p of placed) {
      assert.ok(p.x >= 0 && p.x + p.w <= W, `u ${u}: ${p.text} on the board`);
      assert.ok(p.y >= 0 && p.y + p.h <= rapids.HUD_H, `u ${u}: ${p.text} in the strip (${p.y})`);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        assert.ok(apart, `u ${u}: ${a.text} and ${b.text} apart`);
      }
    }
  }
  for (const [x, y] of [[0, 0], [FIELD_W, FIELD_H], [FIELD_W / 2, -5]]) {
    const at = labelSpot("Into the dam!", x, y, 2.8, FIELD_W, FIELD_H);
    assert.ok(at.x - at.max / 2 >= 0 && at.x + at.max / 2 <= FIELD_W && at.y > 0 && at.y < FIELD_H);
  }
  for (const theme of ["light", "dark"]) {
    for (const [id, accent] of Object.entries(ACCENTS)) {
      const fill = accent[theme][0];
      assert.ok(contrast(inkOn(fill), fill) >= 3, `${theme}/${id}: arms on ${fill}`);
    }
  }
});

/* ---------------------------------------------------- memo and tones */

test("Rapids Run game: the start screen names the furthest dam, and the memo only grows", () => {
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push(String(text)) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  let saved = 3;
  const sets = [];
  const memo = { get: () => saved, set: (n) => { sets.push(n); saved = n; } };
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, memo });
  g.resize(900, 900);
  assert.ok(texts.some((t) => t.includes("Furthest: Stone Gate (dam 3)")), "the start screen names it");
  assert.deepEqual(sets, [], "drawing writes nothing");
  g.key("action");
  g.tick(16);
  const breakDam = () => {
    clear(g.round);
    const dam = g.round.dam;
    dam.hp = 1;
    g.round.ship.d = dam.d - 30;
    g.round.ship.x = center(g.round);
    g.round.shots.push({ x: center(g.round, dam.d), d: dam.d - 2, vx: 0, vd: 60 });
    g.tick(100);
  };
  breakDam();
  assert.equal(g.round.stats.dams, 1);
  assert.deepEqual(sets, [], "dam 1 is not further than dam 3");
  placeAt(g.round, 5);
  breakDam();
  assert.deepEqual(sets, [5], "dam 5 is");
  placeAt(g.round, 2);
  breakDam();
  assert.deepEqual(sets, [5], "and it never shrinks");
  const fresh = game.create({ canvas: stubCanvas().canvas });
  assert.equal(fresh.state, "ready", "no memo is fine");
});

test("Rapids Run game: every event has its sound: a soft pew, a charge, a kill, the dam's thunk and its break, the low battery's beep and the skim's whoosh, and passing the best plays the fanfare once", () => {
  const tones = [];
  const { canvas } = stubCanvas();
  const g = game.create({ canvas, tone: (name, level = 1, pitch = 1) => tones.push({ name, level, pitch }), best: () => 50 });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  clear(g.round);
  g.key("action");
  g.tick(200);
  const pew = tones.find((t) => t.name === "pew");
  assert.ok(pew && pew.level <= 0.25, "a quiet pew for every shot");
  g.release("action");
  g.round.battery = 30;
  g.round.buoys.push({ x: g.round.ship.x, d: g.round.ship.d + 4, n: 1, t: 0 });
  g.tick(300);
  assert.ok(tones.some((t) => t.name === "charge"));
  rapids.hurtFoe(g.round, foe(g.round, "skiff", 10, g.round.ship.d + 30));
  g.tick(16);
  assert.ok(tones.some((t) => t.name === "eat"));
  g.round.score = 60;
  g.tick(16);
  g.tick(16);
  assert.equal(tones.filter((t) => t.name === "best").length, 1, "the fanfare, once");
  g.round.battery = LOW_BATTERY - 5;
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(tones.filter((t) => t.name === "lowcell").length >= 1, "the low battery beeps");
  tones.length = 0;
  const dam = g.round.dam;
  g.round.ship.d = dam.d - 40;
  g.round.ship.x = center(g.round);
  g.round.battery = BATTERY;
  for (let k = 0; k < dam.max; k++) g.round.shots.push({ x: center(g.round, dam.d), d: dam.d - 2 - k * 0.01, vx: 0, vd: 60 });
  g.tick(50);
  assert.ok(tones.some((t) => t.name === "thunk"), "each hit thunks");
  assert.ok(tones.some((t) => t.name === "dambreak"), "and it breaks");
  tones.length = 0;
  const skim = g.round;
  for (let k = 0; k < 40; k++) {
    clear(skim);
    const ch = channelAt(skim.river, skim.ship.x, skim.ship.d);
    const ch2 = channelAt(skim.river, skim.ship.x, skim.ship.d + SHIP_L / 2);
    skim.ship.x = Math.max(ch.lo, ch2.lo) + SHIP_W / 2 + 0.5;
    g.tick(16);
  }
  assert.ok(tones.some((t) => t.name === "skim"), "a skim whooshes");
  for (const t of tones) assert.ok(t.level > 0 && t.level <= 1);
});

test("Rapids Run game: a crash plays the crash, shakes and floats its cause, and the respawn's banner says the lives left", () => {
  const tones = [];
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push(String(text)) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, tone: (n) => tones.push(n) });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  clear(g.round);
  g.round.ship.x = riverAt(g.round.river, g.round.ship.d).L + 0.2;
  texts.length = 0;
  g.tick(16);
  assert.ok(tones.includes("crash"));
  assert.ok(texts.includes("Ran aground!"));
  for (let ms = 0; ms < CRASH_MS + 50; ms += 16) g.tick(16);
  assert.ok(texts.includes("Ready?"));
  assert.ok(texts.includes("2 lives left"));
});

test("Rapids Run game: the hums follow the action (the outboard pitched with the throttle, the river, a whirlpool, a boss's engines) and the big moments sound big", () => {
  const tones = [];
  const hums = [];
  const g = game.create({ canvas: stubCanvas().canvas, tone: (name, level = 1, pitch = 1) => tones.push({ name, level, pitch }), hum: (id, name, level = 1, pitch = 1) => hums.push({ id, name, level, pitch }) });
  g.resize(900, 900);
  g.key("action");
  assert.ok(tones.some((t) => t.name === "rapidsPullStart"), "the motor is pulled into life");
  const motor = () => hums.filter((h) => h.id === "rapids:motor").at(-1);
  for (let k = 0; k < 10; k++) {
    clear(g.round);
    g.round.ship.x = center(g.round);
    g.tick(16);
  }
  assert.equal(motor().name, "outboard");
  assert.ok(hums.some((h) => h.id === "rapids:river" && h.name === "river"), "the river runs under it");
  const cruising = motor().pitch;
  g.key("up");
  assert.ok(tones.some((t) => t.name === "rapidsRevUp"), "the throttle revs");
  for (let k = 0; k < 60; k++) {
    clear(g.round);
    g.round.ship.x = center(g.round);
    g.tick(16);
  }
  assert.ok(motor().pitch > cruising, `faster is higher (${motor().pitch} > ${cruising})`);
  g.release("up");
  clear(g.round);
  foe(g.round, "whirl", g.round.ship.x, g.round.ship.d + 12);
  g.round.ship.invuln = 1e6;
  g.tick(16);
  assert.ok(hums.some((h) => h.name === "rapidsWhirl" && h.level > 0), "a whirlpool swirls nearby");
  clear(g.round);
  g.round.effects.spread = 600;
  for (let k = 0; k < 50; k++) g.tick(16);
  assert.ok(tones.some((t) => t.name === "powerDown"), "a timed power-up winds down when it runs out");
  tones.length = 0;
  placeAt(g.round, BOSS_EVERY);
  clear(g.round);
  g.round.ship.d = g.round.river.bossAt[BOSS_EVERY];
  g.round.ship.x = center(g.round);
  g.tick(16);
  assert.ok(tones.some((t) => t.name === "bossIntro"), "a boss steams in");
  for (let k = 0; k < 80; k++) {
    g.round.ship.invuln = 1e6;
    g.tick(16);
  }
  assert.ok(hums.some((h) => h.id === "rapids:boss" && h.name === "rapidsBossEngine"), "its engines churn");
  hurtBoss(g.round, Math.ceil(g.round.boss.max / 2));
  g.tick(16);
  assert.ok(tones.some((t) => t.name === "rapidsBossRoar"), "it roars at its half");
  hurtBoss(g.round, g.round.boss.hp);
  for (let k = 0; k < 40; k++) g.tick(16);
  assert.ok(tones.some((t) => t.name === "explode"), "it goes up");
  assert.ok(tones.some((t) => t.name === "victory"), "and a victory plays after");
  tones.length = 0;
  g.round.lives = 1;
  g.round.battery = 0.001;
  g.tick(16);
  assert.ok(tones.some((t) => t.name === "rapidsSputter"), "a flat battery sputters out");
  for (let ms = 0; ms < CRASH_MS + 50 && g.state === "running"; ms += 16) g.tick(16);
  assert.equal(g.state, "over");
  assert.ok(tones.some((t) => t.name === "gameOver"), "and the last life plays the game over");
  for (const t of tones) assert.ok(t.level > 0 && t.level <= 1);
  for (const h of hums) assert.ok(h.level >= 0 && h.level <= 1 && h.pitch >= 0.25 && h.pitch <= 4, `${h.id} in range`);
});

test("Rapids Run game: plays without a hum (or a tone) handed in", () => {
  const g = game.create({ canvas: stubCanvas().canvas });
  g.resize(900, 900);
  g.key("action");
  for (let k = 0; k < 20; k++) g.tick(16);
  assert.equal(g.state, "running");
});

/* ------------------------------------------------------------ drawing */

test("Rapids Run game: every stretch, the boss, a crash and the end draw with finite numbers only, and Planny's hull and star are in your highlight", () => {
  const bad = [];
  const fills = [];
  const target = { globalAlpha: 1, fillStyle: "", getTransform: () => ({ a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 }) };
  const ctx = new Proxy(target, {
    get: (t, name) => {
      if (name in t) return t[name];
      if (name === "fill") return () => fills.push(t.fillStyle);
      return (...args) => {
        for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) bad.push(`${String(name)}(${args.join(", ")})`);
      };
    },
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const saved = globalThis.getComputedStyle;
  const values = { ...THEME_TOKENS.dark, "--accent": "#e75874" };
  globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => values[name] || "" });
  try {
    const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    g.resize(900, 900);
    g.key("action");
    g.tick(16);
    assert.ok(fills.filter((f) => f === "#e75874").length >= 2, "the hull and the star");
    for (let n = 1; n <= 10; n++) {
      placeAt(g.round, n);
      for (let k = 0; k < 20; k++) g.tick(50);
      if (stretchFor(n).boss) {
        g.round.ship.d = g.round.river.bossAt[n] - 1;
        for (let k = 0; k < 40; k++) {
          g.round.ship.invuln = 1e9;
          g.tick(50);
        }
        assert.ok(g.round.boss, `stretch ${n}: a boss`);
        hurtBoss(g.round, g.round.boss.hp);
        g.tick(50);
      }
    }
    g.round.lives = 1;
    g.round.ship.invuln = 0;
    g.round.shield = 0;
    lose(g.round, "foe");
    for (let k = 0; k < 40 && g.state === "running"; k++) g.tick(50);
    assert.equal(g.state, "over");
    g.resize(900, 900);
    assert.deepEqual(bad, [], "no NaN or Infinity reaches the canvas");
  } finally {
    if (saved === undefined) delete globalThis.getComputedStyle;
    else globalThis.getComputedStyle = saved;
  }
});

/* --------------------------------------------------------------- bots */

test("Rapids Run: a careful bot plays the first seven stretches of many rivers, with the foes cleared away, and never runs aground, never meets a dam standing and is never trapped, each stretch taking 15 to 60 seconds", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const round = newRound(seed);
    let t = 0;
    let since = 0;
    const lost = [];
    while (!round.over && round.stretch <= 7 && t < 600_000) {
      round.foes.length = 0;
      round.bolts.length = 0;
      if (round.boss) round.boss.hp = Math.min(round.boss.hp, 1);
      // Never trapped: the water the hull sits in is always wide enough.
      if (round.phase === "run") {
        const ch = channelAt(round.river, round.ship.x, round.ship.d);
        assert.ok(ch.hi - ch.lo >= MIN_CHANNEL - 1e-9, `seed ${seed}: room at ${round.ship.d}`);
      }
      carefulBot(round);
      advance(round, 16);
      t += 16;
      since += 16;
      for (const e of round.events.splice(0)) {
        if (e.type === "lose") lost.push(`${e.cause}@${round.stretch}`);
        if (e.type === "stretch") {
          assert.ok(since >= 15_000 && since <= 60_000, `seed ${seed}: stretch ${e.n - 1} took ${since} ms`);
          since = 0;
        }
      }
    }
    assert.ok(round.stretch > 7, `seed ${seed}: past dam 7 (at ${round.stretch}, lost ${lost})`);
    assert.ok(!lost.some((l) => l.startsWith("bank") || l.startsWith("dam")), `seed ${seed}: never aground or into a dam (${lost})`);
  }
});

test("Rapids Run: the careful bot, with the foes left in, still blasts its first dam on most rivers", () => {
  let first = 0;
  for (let seed = 1; seed <= 6; seed++) {
    const round = newRound(seed);
    for (let t = 0; t < 600_000 && !round.over; t += 16) {
      carefulBot(round);
      advance(round, 16);
    }
    if (round.stats.dams >= 1) first += 1;
  }
  assert.ok(first >= 4, `${first} of 6 past the first dam`);
});

test("Rapids Run: a sloppy bot (full speed, firing, steering at random) loses all three lives within 30 seconds, and one that never steers (so never grabs a buoy) within 100", () => {
  for (let seed = 1; seed <= 8; seed++) {
    const round = newRound(seed);
    const random = rapids.seeded(seed);
    let t = 0;
    for (; t < 30_000 && !round.over; t += 16) {
      round.input.up = true;
      round.input.fire = true;
      if (random() < 0.03) {
        const k = random();
        round.input.left = k < 0.4;
        round.input.right = k > 0.6;
      }
      advance(round, 16);
    }
    assert.ok(round.over, `seed ${seed}: over within 30 s`);
    const still = newRound(seed);
    still.input.fire = true;
    let s = 0;
    for (; s < 100_000 && !still.over; s += 16) advance(still, 16);
    assert.ok(still.over, `seed ${seed}: never steering ends within 100 s`);
  }
});
