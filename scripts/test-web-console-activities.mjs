// Web console tests, the activities: the shared game contract every listed game answers, Snake's rules, mini golf's rules, course and controls, Light Trails' rules and rivals, Bug Hunt's waves, bugs and bosses, Sunset Drive's road, traffic and forks, Stack Deploy's drops, perfects and twists, Bumper Ring's physics, rivals and arenas, the lives pill and tones of Rapids Run, Ghoul Rush and Bounce Road (their rules live in their own suites), Hot Potato's bomb, fuse, rivals and venues, and Crossing Rush's lanes, hops, shoves, planner and zones.
// Run with: node --test scripts/test-web-console-activities.mjs
//
// No browser and no server: a game draws only through the canvas it is handed,
// so a stub canvas that counts calls stands in for the page. The contract test
// walks every entry in ACTIVITIES plus a stub second game defined here, which
// is what proves a new game needs no change to the window.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ACTIVITIES, bestKey, bestKeys, memoKey, musicKey, musicLevel } from "../src/web-console/public/activities.js";
import { BOSS_BITES, COMBO_MS, DISCOVERIES, FOOD_PER_LEVEL, FRUITS, GRID, ICE_STEPS, LEVELS, MAX_COMBO, MIN_CELL, MIN_STEP_MS, POWERS, STEP_MS, SURPRISES, age, applyPower, applySurprise, fruitFor, tallyBit, newRound, onFood, SPECIALS, pace, placeFood, step, stepMs, turn } from "../src/web-console/public/activities/snake.js";
import golf, * as golfRules from "../src/web-console/public/activities/golf.js";
import { COURSE_W, COURSE_H, COURSES, FRONT_NINE, HOLE_COUNT, courseById } from "../src/web-console/public/activities/golf-holes.js";
import { holeQuip, holeWord, knownGround, knownLiquid } from "../src/web-console/public/activities/golf-draw.js";
import { decorKinds } from "../src/web-console/public/activities/golf-decor.js";
import * as trails from "../src/web-console/public/activities/trails.js";
import * as bugs from "../src/web-console/public/activities/bugs.js";
import * as drive from "../src/web-console/public/activities/drive.js";
import * as stack from "../src/web-console/public/activities/stack.js";
import * as bumper from "../src/web-console/public/activities/bumper.js";
import { hudLayout } from "../src/web-console/public/activities/bumper-draw.js";
import * as fuse from "../src/web-console/public/activities/fuse.js";
import { hudLayout as fuseHudLayout, themeFor as fuseTheme, limbInk as fuseLimbInk, contrast as fuseContrast, countY as fuseCountY, CHAR as FUSE_CHAR, SAFE_RING as FUSE_SAFE_RING, SAFE_EDGE as FUSE_SAFE_EDGE } from "../src/web-console/public/activities/fuse-draw.js";
import * as hop from "../src/web-console/public/activities/hop.js";
import { hudLayout as hopHudLayout, labelSpot as hopLabelSpot, LANES as HOP_LANES, limbInk as hopLimbInk, contrast as hopContrast } from "../src/web-console/public/activities/hop-draw.js";
import * as bounce from "../src/web-console/public/activities/bounce.js";
import * as rapids from "../src/web-console/public/activities/rapids.js";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { ACCENTS } from "../src/web-console/public/palette.js";
import { LIVES, LIVES_BACK, LIVES_INK, livesText, pillContrast } from "../src/web-console/public/activities/pills.js";

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "web-console", "public");

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

// The page's tokens in light and dark, for a game's readColors() through a
// stubbed getComputedStyle.
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
// color, the backing composited over `board` (a see-through backing shows
// the board through it) and each tint composited over that backing.
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

// Plays a game a few frames in light and dark under every highlight, runs
// `setup(round)` (when the game shows its round) to bring up its warnings
// and timers, draws one more frame and checks every pill's text reads at
// 4.5:1 on its backing and on each tint, and that each of `expect` showed
// (a "~" before one: drawn with a timer's tint).
function checkPills(game, { setup = () => {}, expect = [], board = "--panel" } = {}) {
  const saved = globalThis.getComputedStyle;
  try {
    for (const [theme, tokens] of Object.entries(THEME_TOKENS)) {
      for (const [id, accent] of Object.entries(ACCENTS)) {
        const values = { ...tokens, "--accent": accent[theme][0] };
        globalThis.getComputedStyle = () => ({ getPropertyValue: (name) => values[name] || "" });
        const { canvas, pills, reset } = pillCanvas(values[board]);
        const g = game.create({ canvas });
        g.resize(900, 900);
        g.key("action");
        for (let k = 0; k < 5; k++) g.tick(16);
        if (g.round) setup(g.round);
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

// The smallest game that answers the contract: a counter that moves every
// 100 ms. If it passes, the contract test is about the contract, not Snake.
const STUB_GAME = Object.freeze({
  id: "stub",
  title: "Stub",
  create({ canvas, onScore = () => {} }) {
    const ctx = canvas.getContext("2d");
    let state = "ready";
    let score = 0;
    let elapsed = 0;
    return {
      get score() { return score; },
      get state() { return state; },
      start() { state = "running"; score = 0; elapsed = 0; },
      pause() { if (state === "running") state = "paused"; },
      resume() { if (state === "paused") state = "running"; },
      key(name) {
        if (name === "action") {
          if (state === "ready" || state === "over") this.start();
          else if (state === "paused") state = "running";
          return true;
        }
        return ["up", "down", "left", "right"].includes(name);
      },
      tick(ms) {
        if (state !== "running") return;
        elapsed += ms;
        while (elapsed >= 100) {
          elapsed -= 100;
          score += 1;
          ctx.fillRect(0, 0, 1, 1);
        }
        if (score >= 1000) { state = "over"; onScore(score); }
      },
      resize(w, h) { return w >= 100 && h >= 100; },
    };
  },
});

// A stub that plays by pointer, keeps its lowest round as the best, and has
// no use for the arrow keys: the other shape the contract allows.
const STUB_POINTER_GAME = Object.freeze({
  id: "stubpointer",
  title: "Stub pointer",
  lowerIsBetter: true,
  create({ canvas, onScore = () => {} }) {
    const ctx = canvas.getContext("2d");
    let state = "ready";
    let score = 0;
    let aiming = false;
    return {
      get score() { return score; },
      get state() { return state; },
      start() { state = "running"; score = 0; aiming = false; },
      pause() { if (state === "running") state = "paused"; },
      resume() { if (state === "paused") state = "running"; },
      key(name) {
        if (name !== "action") return false;
        if (state === "ready" || state === "over") this.start();
        else if (state === "paused") state = "running";
        return true;
      },
      pointer(type) {
        if (type === "cancel") { aiming = false; return true; }
        if (state !== "running") return false;
        if (type === "down") aiming = true;
        if (type === "up" && aiming) { aiming = false; score += 1; }
        return true;
      },
      tick(ms) {
        if (state !== "running") return;
        ctx.fillRect(0, 0, 1, 1);
        if (score >= 9) { state = "over"; onScore(score); }
      },
      resize(w, h) { return w >= 100 && h >= 100; },
    };
  },
});

const listedGames = async () => {
  const games = [];
  for (const entry of ACTIVITIES) {
    const mod = await import(pathToFileURL(path.join(PUBLIC_DIR, entry.module)).href);
    games.push({ entry, game: mod.default });
  }
  return games;
};

/* --------------------------------------------------------------- list */

test("the list names Snake, Mini golf, Light Trails, Bug Hunt, Sunset Drive, Stack Deploy, Bumper Ring, Rapids Run, Hot Potato, Crossing Rush, Bounce Road and Ghoul Rush, and each entry's module is a file under public/activities/", () => {
  assert.deepEqual(ACTIVITIES.map((a) => a.id), ["snake", "golf", "trails", "bugs", "drive", "stack", "bumper", "rapids", "fuse", "hop", "bounce", "ghoul"]);
  assert.equal(ACTIVITIES[1].title, "Mini golf");
  assert.equal(ACTIVITIES[2].title, "Light Trails");
  assert.equal(ACTIVITIES[3].title, "Bug Hunt");
  assert.equal(ACTIVITIES[4].title, "Sunset Drive");
  assert.equal(ACTIVITIES[5].title, "Stack Deploy");
  assert.equal(ACTIVITIES[6].title, "Bumper Ring");
  assert.equal(ACTIVITIES[7].title, "Rapids Run");
  assert.equal(ACTIVITIES[8].title, "Hot Potato");
  assert.equal(ACTIVITIES[9].title, "Crossing Rush");
  assert.equal(ACTIVITIES[10].title, "Bounce Road");
  assert.equal(ACTIVITIES[11].title, "Ghoul Rush");
  for (const a of ACTIVITIES) {
    assert.ok(Object.isFrozen(a), `${a.id} is frozen`);
    assert.equal(a.module, a.id === "ghoul" ? "/activities/ghoul-rush/ghoul.js" : `/activities/${a.id}.js`);
    assert.equal(typeof a.title, "string");
    assert.ok(typeof a.blurb === "string" && a.blurb.length > 10, `${a.id} has a line for its picker card`);
  }
  assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length, "ids are unique");
});

test("bestKey builds a flat looks.json key from a list id", () => {
  assert.equal(bestKey("snake"), "activityBestSnake");
  assert.equal(bestKey("golf"), "activityBestGolf");
  assert.equal(bestKey("stub"), "activityBestStub");
  assert.equal(bestKey("stubpointer"), "activityBestStubpointer");
  // A game with courses keeps a best per course.
  assert.equal(bestKey("golf", "pirate"), "activityBestGolfPirate");
  const golfEntry = ACTIVITIES.find((a) => a.id === "golf");
  assert.deepEqual(golfEntry.courses, ["pirate", "cave", "dino", "candy", "space", "frost"]);
  assert.deepEqual(bestKeys(golfEntry), ["activityBestGolfPirate", "activityBestGolfCave", "activityBestGolfDino", "activityBestGolfCandy", "activityBestGolfSpace", "activityBestGolfFrost"]);
  assert.deepEqual(bestKeys(ACTIVITIES[0]), ["activityBestSnake"]);
  // The course list here and the game's own list agree.
  assert.deepEqual(golfEntry.courses, COURSES.map((c) => c.id));
});

test("memoKey builds a flat looks.json key from a list id", () => {
  assert.equal(memoKey("snake"), "activityMemoSnake");
  assert.equal(memoKey("golf"), "activityMemoGolf");
});

/* ----------------------------------------------------------- contract */

test("musicKey builds a flat looks.json key, and a game with music has a default volume a saved one replaces", () => {
  assert.equal(musicKey("ghoul"), "activityMusicGhoul");
  assert.deepEqual(ACTIVITIES.filter((a) => a.music !== undefined).map((a) => [a.id, a.music]), [["drive", 70], ["ghoul", 65]], "the games with music, at about the level they were picked at on the prototype pages");
  const ghoulEntry = ACTIVITIES.find((a) => a.id === "ghoul");
  assert.equal(musicLevel(ghoulEntry, undefined), 0.65, "nothing saved: the default");
  assert.equal(musicLevel(ghoulEntry, "loud"), 0.65, "not a number: the default");
  assert.equal(musicLevel(ghoulEntry, 0), 0, "turned all the way down");
  assert.equal(musicLevel(ghoulEntry, 140), 1, "never past full");
  assert.equal(musicLevel(ACTIVITIES[0], 80), 0, "a game with no music has none");
});

test("every listed game, and a stub second game, answers the game contract", async () => {
  const games = [
    ...(await listedGames()),
    { entry: { id: STUB_GAME.id }, game: STUB_GAME },
    { entry: { id: STUB_POINTER_GAME.id }, game: STUB_POINTER_GAME },
  ];
  assert.ok(games.length >= 4, "both stubs join the listed games");
  assert.ok(games.some(({ game }) => game === golf), "mini golf is walked from the list");
  for (const { entry, game } of games) {
    const label = entry.id;
    assert.equal(game.id, entry.id, `${label}: default export id matches the list`);
    assert.equal(typeof game.title, "string", `${label}: has a title`);
    assert.equal(typeof game.create, "function", `${label}: has create()`);
    if ("lowerIsBetter" in game) assert.equal(typeof game.lowerIsBetter, "boolean", `${label}: lowerIsBetter is a boolean`);

    const { canvas, calls } = stubCanvas();
    const g = game.create({ canvas, tone: () => {}, onScore: () => {} });
    assert.equal(g.state, "ready", `${label}: starts ready`);
    assert.equal(typeof g.score, "number", `${label}: score is a number`);
    g.pause();
    assert.equal(g.state, "ready", `${label}: pause before start does nothing`);
    g.resume();
    assert.equal(g.state, "ready", `${label}: resume before start does nothing`);
    g.tick(10_000);
    assert.equal(g.state, "ready", `${label}: a tick before start does nothing`);

    assert.equal(g.resize(1, 1), false, `${label}: a tiny board is refused`);
    assert.equal(g.resize(2000, 2000), true, `${label}: a large board is fine`);

    g.start();
    assert.equal(g.state, "running", `${label}: start runs`);
    g.pause();
    assert.equal(g.state, "paused", `${label}: pause pauses`);
    const before = { score: g.score, calls: calls.count };
    g.tick(10_000);
    assert.deepEqual({ score: g.score, calls: calls.count }, before, `${label}: ticks while paused change nothing`);
    assert.equal(g.state, "paused", `${label}: still paused after ticks`);
    const pointer = typeof g.pointer === "function";
    if (pointer) {
      g.pointer("cancel", 0, 0);
      g.tick(10_000);
      assert.deepEqual({ score: g.score, calls: calls.count }, before, `${label}: a cancel while paused changes nothing`);
      assert.equal(g.state, "paused", `${label}: a cancel does not resume`);
    }
    g.resume();
    assert.equal(g.state, "running", `${label}: resume runs again`);

    // A game that plays by pointer may have no use for a direction; every
    // game uses the action key.
    for (const name of ["up", "down", "left", "right"]) {
      if (pointer) assert.equal(typeof g.key(name), "boolean", `${label}: ${name} answers true or false`);
      else assert.equal(g.key(name), true, `${label}: ${name} is used`);
    }
    assert.equal(g.key("action"), true, `${label}: action is used`);
    assert.equal(g.key("jump"), false, `${label}: an unknown key is not used`);
    assert.equal(typeof g.score, "number", `${label}: score is still a number`);

    // Running again, a long tick moves the game (it draws).
    if (g.state !== "running") g.key("action");
    const drawn = calls.count;
    g.tick(10_000);
    assert.ok(calls.count > drawn, `${label}: a tick while running moves the game`);
    assert.ok(["running", "over"].includes(g.state), `${label}: a tick leaves it running or over`);
  }
});

test("every listed game with lives answers the endless-lives code: cheat(true) keeps every life through two minutes of play left alone, its lives pill shows them as endless, and a new round starts without it", async () => {
  let withLives = 0;
  for (const { entry, game } of await listedGames()) {
    const label = entry.id;
    const { canvas } = stubCanvas();
    const g = game.create({ canvas, tone: () => {}, onScore: () => {} });
    g.resize(2000, 2000);
    g.start();
    if (!g.round || typeof g.round.lives !== "number") {
      assert.equal(g.cheat, undefined, `${label}: no lives, no cheat`);
      continue;
    }
    withLives++;
    assert.equal(typeof g.cheat, "function", `${label}: a game with lives answers cheat(on)`);
    const lives = g.round.lives;
    g.cheat(true);
    assert.equal(g.round.infinite, true, `${label}: cheat(true) marks the round`);
    for (let ms = 0; ms < 120_000; ms += 100) {
      g.tick(100);
      if (g.state !== "running") g.key("action");
      assert.ok(g.round.lives >= lives, `${label}: no life lost (${g.round.lives} of ${lives} at ${ms} ms)`);
    }
    g.cheat(false);
    assert.equal(g.round.infinite, false, `${label}: cheat(false) lets go`);
    g.cheat(true);
    g.start();
    assert.ok(!g.round.infinite, `${label}: a new round starts without it`);
  }
  assert.ok(withLives >= 8, `${withLives} games with lives`);
  assert.equal(livesText(Infinity), "♥ x∞", "the pill reads endless");
});

/* ---------------------------------------------------------- Snake rules */

test("Snake: the step is 120 ms at three cells, 4 ms quicker per cell beyond, never under 60", () => {
  assert.equal(MIN_STEP_MS, 60);
  assert.equal(stepMs(3), STEP_MS);
  assert.equal(stepMs(3), 120);
  assert.equal(stepMs(4), 116);
  assert.equal(stepMs(10), 92);
  assert.equal(stepMs(17), 64);
  assert.equal(stepMs(18), 60);
  assert.equal(stepMs(30), 60, "a long snake stops at the minimum step");
});

test("Snake: eating food grows the snake by one and scores a point", () => {
  const round = newRound(GRID, () => 0);
  const head = round.snake[0];
  round.food = { x: head.x + 1, y: head.y };
  assert.equal(step(round, () => 0), "eat");
  assert.equal(round.snake.length, 4);
  assert.equal(round.score, 1);
  assert.deepEqual(round.snake[0], { x: head.x + 1, y: head.y });
  assert.ok(!round.snake.some((c) => c.x === round.food.x && c.y === round.food.y), "new food is off the snake");
});

test("Snake: a wall hit ends the round and onScore fires once", async () => {
  const { canvas } = stubCanvas();
  const scores = [];
  const tones = [];
  const game = (await import("../src/web-console/public/activities/snake.js")).default;
  const g = game.create({ canvas, tone: (n) => tones.push(n), onScore: (s) => scores.push(s) });
  g.resize(GRID * MIN_CELL, GRID * MIN_CELL);
  g.start();
  // Heading right from mid-board, the wall is at most GRID steps away, and a
  // tick of STEP_MS is at least one step whatever the snake has eaten.
  for (let i = 0; i < GRID + 2 && g.state === "running"; i++) g.tick(STEP_MS);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score], "onScore fired once, with the score");
  assert.equal(tones.at(-1), "crash");
  g.tick(stepMs(3) * 10);
  assert.equal(scores.length, 1, "no second onScore after the round is over");
});

test("Snake: running into its own body ends the round", () => {
  const round = newRound(GRID, () => 0);
  // Head at (5,5) heading right into (6,5), which is body, not the tail.
  round.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }, { x: 6, y: 4 }];
  round.dir = { x: 1, y: 0 };
  round.queue = [];
  round.food = { x: 0, y: 0 };
  assert.equal(step(round), "crash");
});

test("Snake: moving into the cell the tail leaves is not a crash", () => {
  const round = newRound(GRID, () => 0);
  round.snake = [{ x: 5, y: 5 }, { x: 5, y: 6 }, { x: 6, y: 6 }, { x: 6, y: 5 }];
  round.dir = { x: 1, y: 0 };
  round.queue = [];
  round.food = { x: 0, y: 0 };
  assert.equal(step(round), null);
  assert.deepEqual(round.snake[0], { x: 6, y: 5 });
});

test("Snake: a turn straight back is ignored", () => {
  const round = newRound(GRID, () => 0);
  const head = round.snake[0];
  round.food = { x: 0, y: 0 };
  assert.equal(turn(round, "left"), false, "heading right, left is a reversal");
  assert.equal(turn(round, "up"), true);
  assert.equal(turn(round, "down"), false, "reversal of the queued turn");
  step(round);
  assert.deepEqual(round.snake[0], { x: head.x, y: head.y - 1 });
});

test("Snake: food is never placed on the snake, and a full board has none", () => {
  const round = newRound(4, () => 0);
  for (let i = 0; i < 50; i++) {
    const f = placeFood(round, Math.random);
    assert.ok(!round.snake.some((c) => c.x === f.x && c.y === f.y));
  }
  round.snake = [];
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) round.snake.push({ x, y });
  assert.equal(placeFood(round), null);
});

test("Snake: resize refuses a board under the smallest cell size", async () => {
  const game = (await import("../src/web-console/public/activities/snake.js")).default;
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  assert.equal(g.resize(GRID * MIN_CELL - 1, 2000), false);
  assert.equal(g.resize(GRID * MIN_CELL, GRID * MIN_CELL), true);
  assert.equal(canvas.width, GRID * MIN_CELL, "backing size follows the cell size at a ratio of 1");
});

/* ------------------------------------------------- Snake through the game */

// Drives a real game object through key() and tick(), with Math.random held so
// food lands where the test wants it.
async function snakeGame(randomValue) {
  const game = (await import("../src/web-console/public/activities/snake.js")).default;
  const { canvas } = stubCanvas();
  const tones = [];
  const scores = [];
  const g = game.create({ canvas, tone: (n) => tones.push(n), onScore: (s) => scores.push(s) });
  g.resize(GRID * MIN_CELL, GRID * MIN_CELL);
  const real = Math.random;
  Math.random = () => randomValue;
  try {
    g.start();
  } finally {
    Math.random = real;
  }
  return { g, tones, scores };
}

test("Snake game: food right ahead is eaten on the next tick, with the eat tone", async () => {
  // The snake starts at (10,10), (9,10), (8,10) heading right. Free cells are
  // listed row by row; (11,10) is the 209th of 397.
  const free = GRID * GRID - 3;
  const { g, tones } = await snakeGame(208.5 / free);
  g.tick(stepMs(3 + g.score));
  assert.equal(g.score, 1);
  assert.deepEqual(tones, ["eat"]);
  assert.equal(g.state, "running");
});

test("Snake game: key() steers through turn(), and a reversal key is ignored", async () => {
  // Food at (0,0), out of both paths.
  const { g } = await snakeGame(0);
  g.key("left");
  g.tick(stepMs(3 + g.score));
  assert.equal(g.state, "running", "left while heading right does not turn into the neck");
  // Heading right from x 11 the wall is 9 steps away; heading up from y 10 it is 11.
  g.key("up");
  for (let i = 0; i < 10; i++) g.tick(stepMs(3 + g.score));
  assert.equal(g.state, "running", "up was taken: still clear of the top wall");
  g.tick(stepMs(3 + g.score));
  assert.equal(g.state, "over", "the top wall ends the round");
});

test("Snake game: after eating, the snake moves on the shorter step", async () => {
  // Food at (11,10) right ahead, then food at (0,0) so no later food is in the way.
  const free = GRID * GRID - 3;
  let roll = 208.5 / free;
  const game = (await import("../src/web-console/public/activities/snake.js")).default;
  const { canvas } = stubCanvas();
  const scores = [];
  const g = game.create({ canvas, onScore: (s) => scores.push(s) });
  g.resize(GRID * MIN_CELL, GRID * MIN_CELL);
  const real = Math.random;
  Math.random = () => roll;
  try {
    g.start();
    roll = 0;
    g.tick(stepMs(3));
    assert.equal(g.score, 1, "the first food is eaten at the starting step");
    // Length 4 now, so the step is 116 ms. Heading right from x 11, the head
    // reaches x 19 in eight steps and the wall is the ninth.
    assert.equal(stepMs(3 + g.score), 116);
    for (let i = 0; i < 8; i++) g.tick(116);
    assert.equal(g.state, "running", "eight steps of 116 ms reach x 19, clear of the wall");
    g.tick(115);
    assert.equal(g.state, "running", "115 ms is short of a step, so the wall is not reached yet");
    g.tick(1);
    assert.equal(g.state, "over", "the ninth step, into the wall, lands on the 116th ms");
    assert.deepEqual(scores, [1]);
  } finally {
    Math.random = real;
  }
});

test("Snake game: a banner queued by a step sits in the board on the frame that step paints, and does not jump on the next tick", async () => {
  // Food at (11,10) right ahead; eating it passes a best of 0.5, so the step
  // queues the New best! banner and the same tick paints it.
  const game = (await import("../src/web-console/public/activities/snake.js")).default;
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.3)");
  const g = game.create({ canvas, best: () => 0.5 });
  g.resize(GRID * MIN_CELL, GRID * MIN_CELL);
  const real = Math.random;
  Math.random = () => 208.5 / (GRID * GRID - 3);
  try {
    g.start();
  } finally {
    Math.random = real;
  }
  shades.length = 0;
  g.tick(stepMs(3));
  assert.equal(g.score, 1, "the food was eaten");
  assert.equal(shades.length, 1, "the tick that eats paints the banner");
  const [[top, h]] = shades;
  assert.ok(top >= 0 && top + h <= GRID * MIN_CELL, `inside the board, not at its top edge (${top})`);
  shades.length = 0;
  g.tick(16);
  assert.deepEqual(shades, [[top, h]], "in the same place on the next tick");
});

/* --------------------------------------------- Snake's power-ups and more */

// A round with the snake at (5,5) heading right, food far off at (0,19).
function plainRound() {
  const round = newRound(GRID, () => 0);
  round.snake = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }];
  round.dir = { x: 1, y: 0 };
  round.food = { x: 0, y: 19 };
  return round;
}

test("Snake: food eaten within the combo window scores more, up to the cap, and the window runs out", () => {
  const round = plainRound();
  const points = [];
  for (let i = 0; i < MAX_COMBO + 2; i++) {
    round.food = { x: round.snake[0].x + 1, y: 5 };
    const before = round.score;
    assert.equal(step(round, () => 0.99), "eat");
    points.push(round.score - before);
  }
  assert.deepEqual(points, [1, 2, 3, 4, 5, 5, 5]);
  age(round, COMBO_MS, () => 0.99);
  assert.equal(round.combo, 1, "a pause longer than the window drops the combo");
});

test("Snake: each level serves its own fruit, the last one staying past the list, and an eat names the fruit eaten", () => {
  const kinds = Object.keys(FRUITS);
  assert.equal(fruitFor(1), "apple");
  assert.equal(new Set(kinds.map((_, i) => fruitFor(i + 1))).size, kinds.length, "a different fruit on every level of the list");
  assert.equal(fruitFor(kinds.length + 3), kinds[kinds.length - 1]);
  const round = plainRound();
  for (let i = 0; i < FOOD_PER_LEVEL + 1; i++) {
    round.food = { x: round.snake[0].x + 1, y: 5 };
    step(round, () => 0.99);
  }
  const eats = round.events.filter((e) => e.type === "eat").map((e) => e.fruit);
  assert.equal(eats[FOOD_PER_LEVEL - 1], "apple", "the food that brings level 2 is still level 1's");
  assert.equal(eats[FOOD_PER_LEVEL], fruitFor(2));
});

test("Snake: every FOOD_PER_LEVEL foods is a level, opening in Slow-mo, and level 2 drops warned rocks clear of the head", () => {
  const round = plainRound();
  for (let i = 0; i < FOOD_PER_LEVEL; i++) {
    round.food = { x: round.snake[0].x + 1, y: 5 };
    step(round, () => 0.99);
  }
  assert.equal(round.level, 2);
  assert.ok(round.events.some((e) => e.type === "level" && e.level === 2));
  assert.ok(round.rocks.length >= 3);
  const head = round.snake[0];
  for (const r of round.rocks) {
    assert.ok(r.warn > 0, "a new rock is only a warning");
    assert.ok(Math.abs(r.x - head.x) + Math.abs(r.y - head.y) >= 3, "never next to the head");
    assert.ok(!(r.y === head.y && r.x > head.x && r.x <= head.x + 5), "never right ahead");
  }
  assert.equal(round.effects.slow, POWERS.slow.ms, "a new level opens in Slow-mo");
  delete round.effects.slow;
  assert.ok(pace(round) < stepMs(round.snake.length), "a higher level steps quicker");
});

test("Snake: a warned rock can be crossed, a landed one crashes, and a shield smashes it", () => {
  const round = plainRound();
  round.rocks = [{ x: 6, y: 5, warn: 500 }];
  assert.equal(step(round), null, "still a warning: no crash");
  round.rocks = [{ x: 7, y: 5, warn: 0 }];
  round.shield = 1;
  const before = round.score;
  assert.equal(step(round), null);
  assert.equal(round.shield, 0);
  assert.equal(round.rocks.length, 0, "the shield smashed it");
  assert.ok(round.score > before, "a smash scores");
  round.rocks = [{ x: 8, y: 5, warn: 0 }];
  assert.equal(step(round), "crash");
  assert.equal(round.crashed, "rock");
});

test("Snake: a rock that lands under the snake crumbles", () => {
  const round = plainRound();
  round.rocks = [{ x: 4, y: 5, warn: 10 }];
  age(round, 20, () => 0.99);
  assert.equal(round.rocks.length, 0);
});

test("Snake: Ghost and a shield wrap the snake through a wall; without either the wall is a crash", () => {
  const ghost = plainRound();
  ghost.snake = [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }];
  applyPower(ghost, "ghost");
  assert.equal(step(ghost), null);
  assert.deepEqual(ghost.snake[0], { x: 0, y: 5 });
  const shield = plainRound();
  shield.snake = [{ x: 19, y: 5 }, { x: 18, y: 5 }, { x: 17, y: 5 }];
  applyPower(shield, "shield");
  assert.equal(step(shield), null);
  assert.equal(shield.shield, 0, "the wrap used the shield up");
  shield.snake = [{ x: 19, y: 6 }, { x: 18, y: 6 }, { x: 17, y: 6 }];
  assert.equal(step(shield), "crash");
});

test("Snake: Slow-mo slows the step, then eases back to the usual pace as it runs out", () => {
  const round = plainRound();
  const base = pace(round);
  applyPower(round, "slow");
  const slowest = pace(round);
  assert.ok(slowest > base);
  const paces = [];
  for (let left = POWERS.slow.ms; left > 0; left -= 250) {
    round.effects.slow = left;
    paces.push(pace(round));
  }
  assert.ok(paces.every((p, i) => i === 0 || p <= paces[i - 1]), "the step never slows again on the way out");
  round.effects.slow = 100;
  assert.ok(pace(round) < slowest && pace(round) - base <= 4, "near its end Slow-mo is all but gone");
  age(round, 100, () => 0.99);
  assert.equal(round.effects.slow, undefined, "a timed power-up runs out");
  assert.equal(pace(round), base);
});

test("Snake: Turbo and Mirror world are gone, and the keys always mean what they say", () => {
  assert.equal(POWERS.turbo, undefined);
  assert.equal(SURPRISES.mirror, undefined);
  const round = plainRound();
  assert.equal(turn(round, "down"), true);
  step(round);
  assert.deepEqual(round.snake[0], { x: 5, y: 6 });
});

test("Snake: Scissors halve the snake and pay a point per cell cut", () => {
  const round = plainRound();
  round.snake = Array.from({ length: 10 }, (_, i) => ({ x: 10 - i, y: 5 }));
  assert.equal(applyPower(round, "scissors"), 5);
  assert.equal(round.snake.length, 5);
  assert.equal(round.score, 5);
});

test("Snake: a portal sends the head out of its pair, keeping the direction", () => {
  const round = plainRound();
  round.portals = [{ x: 6, y: 5 }, { x: 12, y: 14 }];
  step(round);
  assert.deepEqual(round.snake[0], { x: 13, y: 14 });
  assert.ok(round.events.some((e) => e.type === "portal"));
});

test("Snake: a comet through the body cuts the tail there; into the head it is a crash", () => {
  const round = plainRound();
  round.snake = Array.from({ length: 8 }, (_, i) => ({ x: 10 - i, y: 5 }));
  // Heading down-right from (5,4), its next cell is (6,5): the fifth cell.
  round.comets = [{ x: 5, y: 4, dx: 1, dy: 1, warn: 0, ms: 0, trail: [] }];
  age(round, 200, () => 0.99);
  assert.equal(round.snake.length, 4);
  assert.ok(round.events.some((e) => e.type === "zap" && e.lost === 4));
  const hit = plainRound();
  hit.comets = [{ x: 4, y: 4, dx: 1, dy: 1, warn: 0, ms: 0, trail: [] }];
  assert.equal(age(hit, 200, () => 0.99), "crash");
  assert.equal(hit.crashed, "comet");
});

test("Snake: a mystery box opens into a surprise, and every surprise and power-up can be applied", () => {
  const round = plainRound();
  round.items = [{ x: 6, y: 5, kind: "mystery", ttl: 5000 }];
  step(round, () => 0);
  const opened = round.events.find((e) => e.type === "surprise");
  assert.equal(opened.kind, Object.keys(SURPRISES)[0]);
  for (const kind of Object.keys(SURPRISES)) applySurprise(plainRound(), kind, Math.random);
  for (const kind of Object.keys(POWERS)) applyPower(plainRound(), kind);
  const gold = plainRound();
  applySurprise(gold, "goldRush", Math.random);
  assert.equal(gold.coins.length, 8);
  const quake = plainRound();
  quake.rocks = [{ x: 1, y: 1, warn: 0 }, { x: 2, y: 2, warn: 0 }];
  applySurprise(quake, "quake");
  assert.equal(quake.rocks.length, 0);
});

test("Snake: items turn up on their own and fade if left", () => {
  const round = plainRound();
  age(round, 4000, () => 0.5);
  assert.equal(round.items.length, 1);
  const first = round.items[0];
  age(round, 9000, () => 0.5);
  assert.ok(!round.items.includes(first), "the first one faded");
});

test("Snake: DISCOVERIES lists every power-up, surprise, new level and special once, within one saved number's bits", () => {
  assert.equal(DISCOVERIES.length, Object.keys(POWERS).length + Object.keys(SURPRISES).length + Object.keys(LEVELS).length + Object.keys(SPECIALS).length);
  for (const l of Object.keys(LEVELS)) assert.ok(DISCOVERIES.includes(`level:${l}`), `level ${l} is listed`);
  for (const k of Object.keys(SPECIALS)) assert.ok(DISCOVERIES.includes(`special:${k}`), `${k} is listed`);
  assert.equal(new Set(DISCOVERIES).size, DISCOVERIES.length);
  assert.ok(DISCOVERIES.length <= 30);
  // A saved tally's bits never move, even past a find taken out of the game.
  assert.equal(tallyBit("power:shield"), 1 << 0);
  assert.equal(tallyBit("power:slow"), 1 << 2);
  assert.equal(tallyBit("surprise:lightsOut"), 1 << 11);
  assert.equal(tallyBit("level:2"), 1 << 16);
  assert.equal(tallyBit("level:6"), 1 << 20);
  assert.equal(tallyBit("special:boss"), 1 << 23);
});

test("Snake: on the ice level a turn slides on for ICE_STEPS steps before it takes, and takes at once elsewhere", () => {
  const round = plainRound();
  round.level = 7;
  assert.ok(turn(round, "down"));
  for (let i = 0; i < ICE_STEPS; i++) {
    step(round, () => 0.99);
    assert.equal(round.dir.y, 0, `still sliding after step ${i + 1}`);
  }
  step(round, () => 0.99);
  assert.equal(round.dir.y, 1, "the turn takes");
  assert.deepEqual(round.snake[0], { x: 5 + ICE_STEPS, y: 6 });
  const dry = plainRound();
  dry.level = 8;
  turn(dry, "down");
  step(dry, () => 0.99);
  assert.equal(dry.dir.y, 1, "the ice melts at the next level");
});

test("Snake: a boss fruit takes BOSS_BITES bites, none while the head stays inside it, and the last is the food with a bonus", () => {
  const round = plainRound();
  round.level = 3;
  round.food = { x: 6, y: 5, boss: true, bites: BOSS_BITES, inside: false };
  assert.ok(onFood(round.food, { x: 7, y: 6 }) && !onFood(round.food, { x: 8, y: 6 }));
  const go = (...moves) => moves.forEach((m) => {
    if (m) turn(round, m);
    step(round, () => 0.99);
  });
  go(null);
  assert.equal(round.food.bites, BOSS_BITES - 1, "bitten on the way in");
  go(null);
  assert.equal(round.food.bites, BOSS_BITES - 1, "no bite while still inside");
  go(null, "down", "left");
  assert.equal(round.food.bites, BOSS_BITES - 2, "back in for a second bite");
  go(null, null, "up", "right");
  assert.equal(round.eaten, 1, "the last bite is the food");
  assert.ok(!(round.food && round.food.boss), "the next food is plain");
  const eat = round.events.find((e) => e.type === "eat");
  assert.ok(eat.boss);
  assert.equal(round.score, 3 + 3 + (1 + 5 * 3), "a level a bite, then the food and its bonus");
});

test("Snake: the last food of an odd level from 3 on is a boss on four cells clear of the snake", () => {
  const boss = plainRound();
  boss.level = 3;
  boss.eaten = 2 * FOOD_PER_LEVEL + FOOD_PER_LEVEL - 2;
  boss.food = { x: 6, y: 5 };
  step(boss, () => 0.5);
  assert.ok(boss.food.boss, "the level's last food is a boss");
  assert.ok(boss.events.some((e) => e.type === "boss"));
  for (const s of boss.snake) assert.ok(!onFood(boss.food, s), "never on the snake");
  const plain = plainRound();
  plain.level = 2;
  plain.eaten = FOOD_PER_LEVEL + FOOD_PER_LEVEL - 2;
  plain.food = { x: 6, y: 5 };
  step(plain, () => 0.5);
  assert.ok(!plain.food.boss, "an even level ends on plain food");
});

test("Snake: a runaway fruit hops away from a close head, is caught by running into it, and runs off if left", () => {
  const round = plainRound();
  round.level = 2;
  round.runner = { x: 8, y: 5, ttl: 5000, hops: 3, rest: 0 };
  step(round, () => 0.5);
  const head = round.snake[0];
  const r = round.runner;
  assert.ok(Math.abs(r.x - head.x) + Math.abs(r.y - head.y) > 2, "it hopped farther off");
  assert.equal(r.hops, 2);
  assert.ok(r.rest > 0, "and rests after a hop");
  const caught = plainRound();
  caught.level = 2;
  caught.runner = { x: 6, y: 5, ttl: 5000, hops: 3, rest: 1 };
  step(caught, () => 0.5);
  assert.equal(caught.runner, null);
  assert.equal(caught.score, 6 * 2, "six points a level");
  assert.ok(caught.events.some((e) => e.type === "caught"));
  const left = plainRound();
  left.runner = { x: 15, y: 15, ttl: 100, hops: 3, rest: 0 };
  age(left, 200, () => 0.99);
  assert.equal(left.runner, null);
  assert.ok(left.events.some((e) => e.type === "escape"));
});

test("Snake: the level pill's text reads at 4.5:1 on its backing in light and dark under every highlight", async () => {
  const { default: snakeActivity } = await import(pathToFileURL(path.join(PUBLIC_DIR, "activities", "snake.js")).href);
  checkPills(snakeActivity, { expect: ["LV 1"] });
});

test("Snake game: a power-up grabbed is saved in the memo, food is not, and passing a saved best plays the fanfare once", async () => {
  const game = (await import("../src/web-console/public/activities/snake.js")).default;
  const { canvas } = stubCanvas();
  const tones = [];
  let saved = 0;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  // Food right ahead at (11,10), as in the eat test above.
  const free = GRID * GRID - 3;
  const real = Math.random;
  const make = (best) => {
    Math.random = () => 208.5 / free;
    try {
      const g = game.create({ canvas, tone: (n) => tones.push(n), best, memo });
      g.resize(GRID * MIN_CELL, GRID * MIN_CELL);
      g.start();
      return g;
    } finally {
      Math.random = real;
    }
  };
  let g = make(() => 0);
  g.tick(STEP_MS);
  assert.equal(g.score, 1);
  assert.ok(!tones.includes("best"), "no best yet means no fanfare");
  assert.equal(saved, 0, "food is not a discovery");

  g = make(() => 0.5);
  tones.length = 0;
  g.tick(STEP_MS);
  assert.deepEqual(tones, ["eat", "best"]);
  g.tick(1);
  assert.equal(tones.filter((n) => n === "best").length, 1);
});

/* ------------------------------------------------------ Mini golf rules */

const { advance, strike, nextHole, SUB_STEP_MS, BALL_R, CUP_R, MAX_STROKES, MAX_SPEED, CANNON_MAX, CARD_MS, POWERUPS } = golfRules;

// The rules tests below were written against the first mini golf round:
// Pirate Cove's first eight holes and its finale, then the Caves of Doom's
// first eight and their finale. HOLES is that round, and `golfAt(n)` puts a
// round of the right course on its hole n (1 to 18), so the tests keep
// meaning the same holes as the courses grow around them.
const PIRATE = courseById("pirate").holes;
const CAVE = courseById("cave").holes;
const OLD = [...PIRATE.slice(0, 8).map((_, i) => ["pirate", i]), ["pirate", PIRATE.length - 1], ...CAVE.slice(0, 8).map((_, i) => ["cave", i]), ["cave", CAVE.length - 1]];
const HOLES = OLD.map(([id, i]) => courseById(id).holes[i]);

// Plays physics steps until the ball rests (or the hole ends), collecting
// every event. Capped, so a ball that never stops fails rather than hangs.
function roll(round, maxMs = 30_000) {
  const events = [];
  for (let t = 0; t < maxMs && round.phase === "rolling"; t += SUB_STEP_MS) events.push(...advance(round, SUB_STEP_MS));
  assert.notEqual(round.phase, "rolling", "the ball came to a stop");
  return events;
}

// A new round moved on to HOLES[n - 1] (n is 1 to 18) with the ball on its
// tee; or, given a course id, that course's own hole n.
function golfAt(n, courseId) {
  const [id, index] = courseId ? [courseId, n - 1] : OLD[n - 1];
  const round = golfRules.newRound(id);
  const holes = courseById(id).holes;
  while (round.hole < index) {
    round.card.push(holes[round.hole].par);
    round.phase = "card";
    nextHole(round);
  }
  return round;
}

// Sets the ball rolling from (x, y) at (vx, vy) units a second.
function launch(round, x, y, vx, vy) {
  Object.assign(round.ball, { x, y, vx, vy, moving: true });
  round.phase = "rolling";
}

const speedOf = (ball) => Math.hypot(ball.vx, ball.vy);

test("Mini golf: a straight putt on hole 1 rolls, slows and stops", () => {
  const round = golfAt(1);
  const tee = { ...HOLES[0].tee };
  assert.equal(strike(round, 0, 0.3), true);
  assert.equal(round.strokes, 1);
  const speeds = [];
  for (let i = 0; i < 50; i++) {
    advance(round, SUB_STEP_MS);
    speeds.push(speedOf(round.ball));
  }
  assert.ok(speeds.every((v, i) => i === 0 || v < speeds[i - 1]), "the ball slows every step");
  const events = roll(round);
  assert.ok(events.includes("stop"));
  assert.equal(round.phase, "aim");
  assert.ok(round.ball.x > tee.x + 50, "it rolled toward the cup");
  assert.equal(round.ball.y, tee.y, "a straight putt stays on its line");
  assert.equal(strike(round, 0, 0), false, "no power, no stroke");
});

test("Mini golf: a wall sends the ball back with less speed, a bumper with more", () => {
  const walled = golfAt(1);
  // Hole 1's far wall is at x 340.
  launch(walled, 330, 150, 200, 0);
  const wallEvents = [];
  while (walled.ball.vx > 0) wallEvents.push(...advance(walled, SUB_STEP_MS));
  assert.ok(speedOf(walled.ball) < 200 * 0.8, "off the wall slower than into it");
  assert.ok(walled.ball.x <= 340 - BALL_R + 1e-9, "never past the wall");
  assert.ok(wallEvents.includes("wall"), "a firm hit plays the wall tone");

  const bumped = golfAt(3);
  // Hole 3's middle bumper sits at (222, 150), radius 14.
  launch(bumped, 190, 150, 150, 0);
  const bumpEvents = [];
  while (bumped.ball.vx > 0) bumpEvents.push(...advance(bumped, SUB_STEP_MS));
  assert.ok(speedOf(bumped.ball) > 150, "off the bumper faster than into it");
  assert.ok(bumpEvents.includes("bump"));
});

test("Mini golf: sand stops a ball sooner than turf", () => {
  // Hole 4: the first trap covers x 135 to 195 at y 215; turf runs right of it.
  const sand = golfAt(4);
  sand.ball.x = 140;
  sand.ball.y = 215;
  assert.ok(golfRules.inSand(HOLES[3], 140, 215));
  strike(sand, 0, 0.25);
  roll(sand);
  const turf = golfAt(4);
  turf.ball.x = 205;
  turf.ball.y = 215;
  assert.ok(!golfRules.inSand(HOLES[3], 205, 215));
  strike(turf, 0, 0.25);
  roll(turf);
  assert.ok(sand.ball.x - 140 < (turf.ball.x - 205) / 2, `sand ${sand.ball.x - 140} against turf ${turf.ball.x - 205}`);
});

test("Mini golf: water costs a stroke and puts the ball back, but a bridge over it is dry", () => {
  // Hole 5: the lagoon runs from x 165 to 245, wall to wall; the bridge
  // crosses it at y 190 to 230.
  const wet = golfAt(5);
  const tee = { ...HOLES[4].tee };
  // Straight right from the tee, into the lagoon.
  strike(wet, 0, 0.8);
  const events = roll(wet);
  assert.ok(events.includes("splash"));
  assert.equal(wet.strokes, 2, "the putt and a penalty stroke");
  assert.deepEqual({ x: wet.ball.x, y: wet.ball.y }, tee, "back where the putt was hit from");
  assert.equal(wet.phase, "aim");

  const dry = golfAt(5);
  Object.assign(dry.ball, { x: 100, y: 210 });
  // Straight right along the bridge.
  strike(dry, 0, 0.8);
  const dryEvents = [];
  while (dry.phase === "rolling" && dry.ball.x < 245) dryEvents.push(...advance(dry, SUB_STEP_MS));
  assert.ok(dry.ball.x >= 245, "it crossed the water");
  assert.ok(!dryEvents.includes("splash"), "the bridge kept it dry");
  assert.equal(dry.strokes, 1);
});

test("Mini golf: a slope pushes a resting ball", () => {
  const round = golfAt(16);
  // Hole 16's glowworm current (x 140 to 240, y 70 to 170) pushes toward -y.
  Object.assign(round.ball, { x: 190, y: 150, vx: 0, vy: 0, moving: false });
  assert.ok(golfRules.onSlope(HOLES[15], 190, 150));
  for (let i = 0; i < 100; i++) advance(round, SUB_STEP_MS);
  assert.equal(round.phase, "rolling");
  assert.ok(round.ball.y < 150, "it moved with the push");
  assert.ok(Math.abs(round.ball.x - 190) < 1e-9, "and only with the push");
});

test("Mini golf: a tunnel moves the ball to its pair, keeping its speed", () => {
  const round = golfAt(8);
  const { a, b } = HOLES[7].tunnels[0];
  launch(round, a.x, a.y - 12, 0, 200);
  let events = [];
  while (!events.includes("tunnel")) events = advance(round, SUB_STEP_MS);
  assert.deepEqual({ x: round.ball.x, y: round.ball.y }, { x: b.x, y: b.y }, "out of the other mouth");
  assert.ok(round.ball.vy > 150 && round.ball.vx === 0, "still heading the same way");
  advance(round, SUB_STEP_MS);
  assert.notEqual(round.ball.x, a.x, "not straight back through");
});

test("Mini golf: a fast ball rolls over the cup and a slow one drops", () => {
  const fast = golfAt(1);
  const cup = HOLES[0].cup;
  fast.strokes = 1;
  launch(fast, cup.x - 20, cup.y, 400, 0);
  while (fast.ball.x < cup.x + CUP_R + 1) advance(fast, SUB_STEP_MS);
  assert.equal(fast.phase, "rolling", "too fast to drop");
  assert.deepEqual(fast.card, []);

  const slow = golfAt(1);
  slow.strokes = 2;
  launch(slow, cup.x - 20, cup.y, 80, 0);
  const events = roll(slow);
  assert.ok(events.includes("cup"));
  assert.deepEqual(slow.card, [2]);
  assert.equal(slow.phase, "card");
});

test("Mini golf: the windmill bounces the ball and holds still while the game is paused", () => {
  const round = golfAt(7);
  // At clock 0 the bar lies along y 150, from x 200 to 280: drop the ball
  // straight down onto it, near the center where it barely moves.
  launch(round, 250, 125, 0, 150);
  while (round.ball.vy > 0 && round.phase === "rolling") advance(round, SUB_STEP_MS);
  assert.ok(round.ball.vy < 0, "the bar turned it back");
  assert.ok(round.ball.y < 150, "it never went through the bar");

  const { canvas } = stubCanvas();
  const g = golf.create({ canvas });
  g.resize(800, 600);
  g.start();
  while (g.round.hole < 6) {
    g.round.card.push(3);
    g.round.phase = "card";
    nextHole(g.round);
  }
  g.tick(100);
  const bar = golfRules.spinnerEnds(HOLES[6].spinners[0], g.round.clock);
  g.pause();
  g.tick(5000);
  assert.deepEqual(golfRules.spinnerEnds(HOLES[6].spinners[0], g.round.clock), bar, "no turn while paused");
  g.resume();
  g.tick(100);
  assert.notDeepEqual(golfRules.spinnerEnds(HOLES[6].spinners[0], g.round.clock), bar, "it turns again once running");
});

test("Mini golf: the eighth stroke without the cup picks the ball up for 8", () => {
  const round = golfAt(1);
  for (let i = 0; i < MAX_STROKES; i++) {
    assert.equal(strike(round, Math.PI, 0.05), true, `stroke ${i + 1}`);
    roll(round);
  }
  assert.equal(round.phase, "card");
  assert.deepEqual(round.card, [MAX_STROKES]);
  assert.equal(strike(round, 0, 1), false, "no putting on the scorecard");
  for (let t = 0; t < CARD_MS; t += SUB_STEP_MS) advance(round, SUB_STEP_MS);
  assert.equal(round.hole, 1, "the card moves on by itself");
  assert.equal(round.phase, "aim");
  assert.equal(round.strokes, 0);
});

test("Mini golf: water on the eighth stroke picks the ball up at 8, never 9", () => {
  const round = golfAt(5);
  round.strokes = MAX_STROKES - 1;
  strike(round, 0, 0.8);
  const events = roll(round);
  assert.ok(events.includes("splash") && events.includes("pickup"));
  assert.equal(round.phase, "card");
  assert.equal(round.card.at(-1), MAX_STROKES);
  assert.equal(round.strokes, MAX_STROKES, "the hole's own count is capped too");
});

test("Mini golf words: a hole's strokes against its par", () => {
  assert.equal(holeWord(1, 3, false), "Hole in one!");
  assert.equal(holeWord(2, 5, false), "Eagle");
  assert.equal(holeWord(2, 3, false), "Birdie");
  assert.equal(holeWord(3, 3, false), "Par");
  assert.equal(holeWord(4, 3, false), "Bogey");
  assert.equal(holeWord(5, 3, false), "Double bogey");
  assert.equal(holeWord(8, 3, false), "5 over par");
  assert.equal(holeWord(8, 3, true), "Picked up");
  for (const c of COURSES) {
    const lines = [[1, 3, false], [2, 5, false], [2, 3, false], [3, 3, false], [4, 3, false], [8, 3, false], [8, 3, true]].map(([n, par, up]) => holeQuip(n, par, up, c.voice));
    assert.ok(lines.every((l) => typeof l === "string" && l.length > 0), `${c.id}: a quip for every result`);
    assert.equal(new Set(lines.slice(1)).size, 6, `${c.id}: a different quip for each result`);
    const v = c.voice;
    for (const key of ["label", "ace", "turn", "done"]) assert.ok(typeof v[key] === "string" && v[key].length > 0, `${c.id}: its voice has a ${key}`);
    assert.ok(Array.isArray(v.bump) && v.bump.length >= 3, `${c.id}: bump words`);
    for (const h of c.holes) if (h.water.length) assert.ok(Array.isArray(v.splash[h.liquid]) && v.splash[h.liquid].length, `${c.id}: splash words for ${h.liquid}`);
  }
  const pars = COURSES.map((c) => holeQuip(3, 3, false, c.voice));
  assert.equal(new Set(pars).size, COURSES.length, "every course has its own voice");
});

// Drops the ball just short of the cup, aimed at it, so a soft putt sinks it.
function lineUp(g) {
  const cup = golfRules.holesOf(g.round)[g.round.hole].cup;
  Object.assign(g.round.ball, { x: cup.x - 10, y: cup.y });
  g.round.aimAngle = 0;
}

// 200 ms into its trip the needle reads about a tenth of full power.
const SOFT_MS = 200;

// Starts the meter, moves the needle to SOFT_MS and sets the power: the two
// presses of a soft putt. Returns what the second press returned.
function softPutt(g) {
  g.key("action");
  g.round.swingMs = SOFT_MS;
  return g.key("action");
}

test("Mini golf: a full round of eighteen calls onScore once with the total; a half round never does", () => {
  const { canvas } = stubCanvas();
  const scores = [];
  const tones = [];
  const g = golf.create({ canvas, tone: (n) => tones.push(n), onScore: (s) => scores.push(s) });
  g.resize(800, 600);
  g.key("action");
  assert.equal(g.state, "running");
  for (let h = 0; h < 4; h++) {
    lineUp(g);
    softPutt(g);
    g.tick(3000);
    g.key("action");
  }
  assert.equal(g.round.hole, 4, "four holes played");
  g.start();
  assert.deepEqual(scores, [], "a round given up halfway reports nothing");
  assert.equal(g.score, 0);
  tones.length = 0;

  // Every course, the same way: an ace on each of its eighteen holes.
  for (const c of COURSES) {
    assert.equal(g.setCourse(c.id), true);
    assert.equal(g.course, c.id);
    if (g.state === "ready") g.key("action");
    assert.equal(g.state, "running", `${c.id}: the round is under way`);
    scores.length = 0;
    tones.length = 0;
    for (let h = 0; h < HOLE_COUNT; h++) {
      lineUp(g);
      assert.equal(softPutt(g), true);
      assert.equal(g.score, h + 1, `${c.id} hole ${h + 1}: a stroke counts as it is taken`);
      g.tick(3000);
      if (h < HOLE_COUNT - 1) assert.equal(g.key("action"), true, `${c.id} hole ${h + 1}: sunk, and space skips the scorecard`);
    }
    assert.equal(g.state, "over", `${c.id}: the round is over`);
    assert.deepEqual(scores, [HOLE_COUNT], `${c.id}: one score, the round's total`);
    assert.equal(tones.filter((n) => n === "ace").length, HOLE_COUNT);
    assert.ok(tones.includes("putt"));
    g.tick(10_000);
    assert.deepEqual(scores, [HOLE_COUNT], "nothing more once the round is over");
    assert.equal(golfRules.toPar(g.round), HOLE_COUNT - golfRules.coursePar(c));
  }
});

test("Mini golf: switching course drops the round, the same course keeps it, and the course list matches the courses", () => {
  const { canvas } = stubCanvas();
  const g = golf.create({ canvas, course: "candy" });
  assert.equal(g.course, "candy", "create() takes the course to start on");
  g.resize(800, 600);
  g.key("action");
  lineUp(g);
  softPutt(g);
  g.tick(3000);
  g.key("action");
  g.pause();
  assert.equal(g.round.hole, 1);
  g.setCourse("candy");
  assert.equal(g.state, "paused", "the same course keeps its paused round");
  assert.equal(g.round.hole, 1);
  g.setCourse("space");
  assert.equal(g.state, "ready", "another course starts fresh");
  assert.equal(g.round.hole, 0);
  assert.equal(g.course, "space");
  g.setCourse("nowhere");
  assert.equal(g.course, COURSES[0].id, "an unknown course is the first");
  assert.deepEqual(golf.courses.map((c) => c.id), ["pirate", "cave", "dino", "candy", "space", "frost"]);
  for (const c of golf.courses) {
    assert.ok(Object.isFrozen(c));
    assert.equal(c.holes, HOLE_COUNT, `${c.id}: eighteen holes`);
    assert.equal(c.par, golfRules.coursePar(courseById(c.id)));
    assert.ok(typeof c.name === "string" && c.name.length > 3 && typeof c.blurb === "string" && c.blurb.length > 10, `${c.id}: a name and a card line`);
  }
  // The dashboard's art draws without a page.
  for (const c of golf.courses) {
    const art = stubCanvas();
    golf.preview(art.canvas, c.id, 160, 120);
    assert.ok(art.calls.count > 0, `${c.id}: its card art draws`);
  }
});

test("Mini golf: a huge tick never moves the ball through a wall", () => {
  const { canvas } = stubCanvas();
  const g = golf.create({ canvas });
  g.resize(800, 600);
  g.start();
  launch(g.round, 300, 150, 100_000, 0);
  for (let i = 0; i < 20; i++) {
    g.tick(1_000_000);
    assert.ok(g.round.ball.x >= 60 + BALL_R - 1e-9 && g.round.ball.x <= 340 - BALL_R + 1e-9, `inside hole 1 at ${g.round.ball.x}`);
  }
  assert.ok(MAX_SPEED * (SUB_STEP_MS / 1000) < BALL_R, "a step at top speed is shorter than the ball's radius");
  assert.ok(CANNON_MAX * (SUB_STEP_MS / 1000) < BALL_R, "a cannon shot's too");
});

/* ----------------------------------------------------- Mini golf course */

// Whether the ball can get from a to b without touching a wall or getting
// wet: a flood fill over a grid of ball positions, with a tunnel joining its
// two mouths. Water counts as blocked, so a bridge has to carry the path.
function reachable(hole, from, to) {
  const STEP = 2;
  const cols = Math.ceil(COURSE_W / STEP) + 1;
  const rows = Math.ceil(COURSE_H / STEP) + 1;
  const free = (x, y) => golfRules.inPolygon(hole.outline, x, y) && !golfRules.inWater(hole, x, y) && hole.walls.every((w) => {
    const dx = w.x2 - w.x1;
    const dy = w.y2 - w.y1;
    const t = Math.max(0, Math.min(1, ((x - w.x1) * dx + (y - w.y1) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(x - (w.x1 + t * dx), y - (w.y1 + t * dy)) >= BALL_R;
  }) && hole.bumpers.every((b) => Math.hypot(x - b.x, y - b.y) >= b.r + BALL_R);
  const key = (c, r) => r * cols + c;
  const cell = (p) => [Math.round(p.x / STEP), Math.round(p.y / STEP)];
  const seen = new Set();
  const queue = [cell(from)];
  const goal = key(...cell(to));
  while (queue.length) {
    const [c, r] = queue.pop();
    if (c < 0 || r < 0 || c >= cols || r >= rows || seen.has(key(c, r))) continue;
    seen.add(key(c, r));
    if (!free(c * STEP, r * STEP)) continue;
    if (key(c, r) === goal) return true;
    for (const t of hole.tunnels) {
      for (const [m, n] of [[t.a, t.b], [t.b, t.a]]) {
        if (Math.hypot(c * STEP - m.x, r * STEP - m.y) < golfRules.TUNNEL_R) queue.push(cell(n));
      }
    }
    queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
  }
  return false;
}

// The elements a hole can hold, every one used on some course.
const ELEMENTS = ["bumpers", "sand", "ice", "water", "slopes", "wells", "bridges", "spinners", "tunnels", "movers", "gates", "powerups", "decor"];

test("Mini golf courses: six courses of eighteen holes, each hole finishable, with every element used somewhere", () => {
  assert.deepEqual(COURSES.map((c) => c.id), ["pirate", "cave", "dino", "candy", "space", "frost"]);
  assert.equal(HOLE_COUNT, 18);
  assert.equal(FRONT_NINE, 9);
  assert.equal(new Set(COURSES.map((c) => c.name)).size, COURSES.length, "every course has its own name");
  const all = COURSES.flatMap((c) => c.holes);
  for (const c of COURSES) {
    assert.ok(Object.isFrozen(c) && Object.isFrozen(c.holes) && Object.isFrozen(c.holes[0]) && Object.isFrozen(c.holes[0].walls[0]), `${c.id}: the course is frozen`);
    assert.equal(c.holes.length, HOLE_COUNT, `${c.id}: eighteen holes`);
    assert.ok(Number.isInteger(c.cover) && c.cover >= 0 && c.cover < HOLE_COUNT, `${c.id}: its card art is one of its holes`);
    assert.equal(new Set(c.holes.map((h) => h.name)).size, HOLE_COUNT, `${c.id}: every hole has its own name`);
    const par = golfRules.coursePar(c);
    assert.ok(par >= 48 && par <= 66, `${c.id}: par ${par} for the eighteen, between 48 and 66`);
    // Each course is varied: most kinds of element show up somewhere on it.
    const used = ELEMENTS.filter((k) => c.holes.some((h) => h[k].length));
    assert.ok(used.length >= 9, `${c.id}: uses ${used.join(", ")}`);
    for (const [i, hole] of c.holes.entries()) {
      const label = `${c.id} hole ${i + 1} (${hole.name})`;
      assert.equal(hole.theme, c.id, `${label}: the course's theme`);
      assert.ok(typeof hole.name === "string" && hole.name.length > 0, `${label}: named`);
      assert.ok(typeof hole.quip === "string" && hole.quip.length > 0 && hole.quip.length <= 72, `${label}: a quip that fits its banner`);
      assert.ok(knownGround(hole.theme, hole.ground), `${label}: a ground its look draws, ${hole.ground}`);
      assert.ok(knownLiquid(hole.theme, hole.liquid), `${label}: a liquid its look draws, ${hole.liquid}`);
      assert.ok(Number.isInteger(hole.par) && hole.par >= 2 && hole.par <= 5, `${label}: par 2 to 5`);
      for (const [what, p] of [["tee", hole.tee], ["cup", hole.cup]]) {
        assert.ok(p.x > 0 && p.x < COURSE_W && p.y > 0 && p.y < COURSE_H, `${label}: ${what} on the course`);
        assert.ok(golfRules.inPolygon(hole.outline, p.x, p.y), `${label}: ${what} inside its walls`);
        assert.ok(!golfRules.inWater(hole, p.x, p.y), `${label}: ${what} not in water`);
        assert.ok(!golfRules.onSlope(hole, p.x, p.y), `${label}: ${what} not on a slope`);
      }
      assert.ok(!golfRules.inWell(hole, hole.tee.x, hole.tee.y), `${label}: the tee is out of every well's reach`);
      // The unit suite lines a putt up from just left of the cup.
      const near = { x: hole.cup.x - 10, y: hole.cup.y };
      assert.ok(golfRules.inPolygon(hole.outline, near.x, near.y) && !golfRules.inWater(hole, near.x, near.y), `${label}: open ground just left of the cup`);
      assert.ok(hole.walls.every((w) => distToSeg(w, near) >= BALL_R + 1) && hole.bumpers.every((b) => Math.hypot(near.x - b.x, near.y - b.y) >= b.r + BALL_R + 1), `${label}: nothing in the way just left of the cup`);
      for (const pad of hole.powerups) {
        assert.ok(Object.hasOwn(POWERUPS, pad.kind), `${label}: a known power-up, ${pad.kind}`);
        assert.ok(golfRules.inPolygon(hole.outline, pad.x, pad.y) && !golfRules.inWater(hole, pad.x, pad.y), `${label}: its ${pad.kind} pad on dry ground`);
        assert.ok(Math.hypot(pad.x - hole.tee.x, pad.y - hole.tee.y) > golfRules.POWERUP_R + BALL_R, `${label}: no pad under the tee`);
      }
      for (const w of hole.wells) {
        assert.ok(w.r > 10 && Number.isFinite(w.pull) && w.pull !== 0, `${label}: a well with a reach and a pull`);
        // A well that pulls in drains into water or the cup, so no ball rests in it.
        if (w.pull > 0) assert.ok(golfRules.inWater(hole, w.x, w.y) || Math.hypot(w.x - hole.cup.x, w.y - hole.cup.y) < CUP_R, `${label}: a well pulling in has water or the cup at its center`);
      }
      const kinds = decorKinds(hole.theme);
      for (const d of hole.decor) assert.ok(kinds.includes(d.kind), `${label}: known scenery, ${d.kind}`);
      assert.ok(reachable(hole, hole.tee, hole.cup), `${label}: the cup can be reached from the tee`);
      if (hole.bridges.length) {
        const bridgeless = { ...hole, bridges: [] };
        assert.equal(reachable(bridgeless, hole.tee, hole.cup), false, `${label}: only its bridge gets the ball over the water`);
      }
    }
  }
  for (const kind of ELEMENTS) assert.ok(all.some((h) => h[kind].length), `some hole has ${kind}`);
  for (const liquid of ["sea", "pool", "lava", "chasm"]) assert.ok(all.some((h) => h.liquid === liquid && h.water.length), `some hole has ${liquid}`);
  for (const kind of Object.keys(POWERUPS)) assert.ok(all.some((h) => h.powerups.some((p) => p.kind === kind)), `some hole has a ${kind} pad`);
  assert.ok(all.some((h) => h.walls.length > h.outline.length), "some hole has walls inside its edge");
});

// How far point p is from wall w.
function distToSeg(w, p) {
  const dx = w.x2 - w.x1;
  const dy = w.y2 - w.y1;
  const k = Math.max(0, Math.min(1, ((p.x - w.x1) * dx + (p.y - w.y1) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p.x - (w.x1 + k * dx), p.y - (w.y1 + k * dy));
}

test("Mini golf courses: a ball left anywhere on a slope or in a well rolls off and comes to rest, sinks or splashes", () => {
  for (const c of COURSES) {
    for (const [i, hole] of c.holes.entries()) {
      const spots = [];
      for (const s of hole.slopes) {
        const xs = s.points.map((q) => q.x);
        const ys = s.points.map((q) => q.y);
        for (let k = 1; k <= 3; k++) for (let j = 1; j <= 3; j++) spots.push({ x: Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * k) / 4, y: Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 4 });
      }
      // Rings across each well, out to its faint rim, where its pull is weakest.
      for (const w of hole.wells) for (const f of [0.3, 0.6, 0.85, 0.97]) for (let k = 0; k < 8; k++) spots.push({ x: w.x + Math.cos(k) * w.r * f, y: w.y + Math.sin(k) * w.r * f });
      for (const spot of spots) {
        if (!golfRules.inPolygon(hole.outline, spot.x, spot.y) || golfRules.inWater(hole, spot.x, spot.y)) continue;
        if (hole.walls.some((w) => distToSeg(w, spot) < BALL_R + 1) || hole.bumpers.some((b) => Math.hypot(spot.x - b.x, spot.y - b.y) < b.r + BALL_R)) continue;
        const round = golfAt(i + 1, c.id);
        Object.assign(round.ball, { x: spot.x, y: spot.y, vx: 0, vy: 0, moving: false });
        round.from = { x: hole.tee.x, y: hole.tee.y };
        let t = 0;
        // Settling may take a few rolls: a ball can bounce back onto a slope.
        const settled = () => (round.phase === "aim" && !golfRules.onPush(hole, round.ball.x, round.ball.y)) || round.phase === "card" || round.phase === "done";
        for (; t < 60_000 && !settled(); t += SUB_STEP_MS) advance(round, SUB_STEP_MS);
        assert.ok(t < 60_000, `${c.id} hole ${i + 1}: a ball left at ${Math.round(spot.x)},${Math.round(spot.y)} never settles`);
      }
    }
  }
});

/* ------------------------------------------------ Mini golf power-ups */

// Rolls the ball over hole `n`'s pad of `kind` and lets it stop.
function collect(n, kind) {
  const round = golfAt(n);
  const pad = HOLES[n - 1].powerups.find((p) => p.kind === kind);
  launch(round, pad.x - 12, pad.y, 60, 0);
  const events = roll(round);
  assert.ok(events.includes("powerup"), `the ${kind} pad was picked up`);
  return round;
}

test("Mini golf power-ups: a pad is held for the next putt only, used up for the hole, and kept to the next hole", () => {
  const round = collect(3, "cannon");
  assert.equal(round.held, "cannon");
  assert.deepEqual(round.taken, [0]);
  const pad = HOLES[2].powerups[0];
  launch(round, pad.x - 12, pad.y, 60, 0);
  assert.ok(!roll(round).includes("powerup"), "a used-up pad gives nothing more");
  assert.equal(strike(round, 0, 0.2), true);
  assert.equal(round.active, "cannon", "the putt takes it");
  assert.equal(round.held, null);
  roll(round);
  assert.equal(round.active, null, "and it is gone once the ball stops");

  const carried = collect(2, "doubloon");
  carried.card.push(2);
  carried.phase = "card";
  nextHole(carried);
  assert.equal(carried.held, "doubloon", "a held power-up waits through the scorecard");
  assert.deepEqual(carried.taken, [], "the new hole's pads are all there");
});

test("Mini golf power-ups: a doubloon putt is free, but a hole still scores at least 1", () => {
  const round = golfAt(1);
  round.held = "doubloon";
  strike(round, 0, 0.3);
  assert.equal(round.strokes, 0, "the putt was not counted");
  roll(round);
  const cup = HOLES[0].cup;
  const sunk = golfAt(1);
  sunk.held = "doubloon";
  Object.assign(sunk.ball, { x: cup.x - 10, y: cup.y });
  strike(sunk, 0, 0.1);
  assert.ok(roll(sunk).includes("ace"), "a first putt in is still a hole in one");
  assert.deepEqual(sunk.card, [1]);
});

test("Mini golf power-ups: a cannon putt goes faster than any plain one", () => {
  const plain = golfAt(1);
  strike(plain, 0, 1);
  const cannon = golfAt(1);
  cannon.held = "cannon";
  strike(cannon, 0, 1);
  assert.ok(speedOf(cannon.ball) > MAX_SPEED, `cannon ${speedOf(cannon.ball)}`);
  assert.ok(speedOf(plain.ball) <= MAX_SPEED);
});

test("Mini golf power-ups: a ghost ball floats over water, but sinks if it stops there", () => {
  const wet = golfAt(5);
  wet.held = "ghost";
  strike(wet, 0, 0.9);
  const events = [];
  while (wet.phase === "rolling" && wet.ball.x < 250) events.push(...advance(wet, SUB_STEP_MS));
  assert.ok(wet.ball.x >= 250 && !events.includes("splash"), "over the lagoon without a splash");

  const stalled = golfAt(5);
  stalled.held = "ghost";
  Object.assign(stalled.ball, { x: 175, y: 80 });
  strike(stalled, 0, 0.05);
  assert.ok(roll(stalled).includes("splash"), "out of puff over the water, it goes in");
});

test("Mini golf power-ups: the magnet bends a putt into the cup, the treasure map makes the cup wider, the duck keeps a wall's speed", () => {
  const cup = HOLES[0].cup;
  const miss = golfAt(1);
  Object.assign(miss.ball, { x: cup.x - 60, y: cup.y - 14 });
  strike(miss, 0, 0.3);
  assert.ok(!roll(miss).includes("ace"), "a plain putt passes the cup");
  const pulled = golfAt(1);
  pulled.held = "magnet";
  Object.assign(pulled.ball, { x: cup.x - 60, y: cup.y - 14 });
  strike(pulled, 0, 0.3);
  assert.ok(roll(pulled).includes("ace"), "the magnet pulls it in");

  const wide = golfAt(1);
  wide.held = "bigcup";
  Object.assign(wide.ball, { x: cup.x - 40, y: cup.y - 12 });
  strike(wide, 0, 0.15);
  assert.ok(roll(wide).includes("ace"), "the big cup catches a putt 12 off the line");

  const plain = golfAt(1);
  launch(plain, 330, 150, 200, 0);
  while (plain.ball.vx > 0) advance(plain, SUB_STEP_MS);
  const duck = golfAt(1);
  duck.active = "bouncy";
  launch(duck, 330, 150, 200, 0);
  while (duck.ball.vx > 0) advance(duck, SUB_STEP_MS);
  assert.ok(speedOf(duck.ball) > speedOf(plain.ball) + 40, `duck ${speedOf(duck.ball)} against ${speedOf(plain.ball)}`);
});

test("Mini golf power-ups: the spyglass shows where a putt will stop, and looking changes nothing", () => {
  const round = golfAt(1);
  round.held = "spyglass";
  const before = JSON.stringify(round);
  const path = golfRules.predictPath(round, 0, 0.3);
  assert.equal(JSON.stringify(round), before, "the round is untouched");
  assert.ok(path.length > 5);
  strike(round, 0, 0.3);
  roll(round);
  const end = path.at(-1);
  assert.ok(Math.hypot(end.x - round.ball.x, end.y - round.ball.y) < 1e-6, "the putt stops where the spyglass said");
});

/* ------------------------------------------- Mini golf moving hazards */

test("Mini golf: a mover knocks a resting ball rolling, and a ghost ball slips through it", () => {
  // Hole 13's first cart rides x 140 from y 65 to 235.
  const round = golfAt(13);
  const cart = HOLES[12].movers[0];
  Object.assign(round.ball, { x: cart.x, y: cart.y + cart.dy * 0.5 });
  let events = [];
  for (let t = 0; t < cart.period && round.phase === "aim"; t += SUB_STEP_MS) events.push(...advance(round, SUB_STEP_MS));
  assert.ok(events.includes("bump"), "the cart hit it");
  assert.equal(round.phase, "rolling");

  const ghost = golfAt(13);
  ghost.held = "ghost";
  Object.assign(ghost.ball, { x: 100, y: 150 });
  strike(ghost, 0, 0.6);
  events = [];
  while (ghost.phase === "rolling" && ghost.ball.x < 160) events.push(...advance(ghost, SUB_STEP_MS));
  assert.ok(ghost.ball.x >= 160, "it rolled on past the cart's rails");
  assert.ok(!events.includes("bump"), "nothing touched the ghost");
});

test("Mini golf: a crusher is a wall while shut and open ground while up", () => {
  const gate = HOLES[16].gates[0];
  // The round's clock at a given share of the gate's period.
  const at = (share) => (share - (gate.offset || 0)) * gate.period + gate.period;
  assert.equal(golfRules.gateShut(gate, at(0.1)), false);
  assert.equal(golfRules.gateShut(gate, at(0.9)), true);

  const shut = golfAt(17);
  shut.clock = at(0.7);
  launch(shut, gate.x1 - 20, 150, 150, 0);
  for (let i = 0; i < 40; i++) advance(shut, SUB_STEP_MS);
  assert.ok(shut.ball.x < gate.x1, "it bounced back off the shut crusher");

  const open = golfAt(17);
  open.clock = at(0.05);
  launch(open, gate.x1 - 20, 150, 150, 0);
  for (let i = 0; i < 40; i++) advance(open, SUB_STEP_MS);
  assert.ok(open.ball.x > gate.x1, "it rolled under the raised crusher");
});

/* ------------------------------------------------- Mini golf controls */

test("Mini golf swing: the meter crawls at the bottom and races at the top, MAX boosts a putt, and an overswing shanks it", () => {
  const { meterAt, meterZone, swingShot, startSwing, setPower, METER_MS, MAX_BAND, MAX_BOOST, OVER_BAND, OVER_POWER, STRIKE_SPEED } = golfRules;
  assert.equal(meterAt(0), 0, "it starts empty");
  assert.ok(Math.abs(meterAt(METER_MS / 2) - (1 + OVER_BAND)) < 1e-9, "halfway through a trip it tops out past full");
  assert.ok(meterAt(METER_MS) < 1e-9, "and a trip ends empty again");
  const step = METER_MS / 40;
  assert.ok(meterAt(step) - meterAt(0) < (meterAt(METER_MS / 2) - meterAt(METER_MS / 2 - step)) / 4, "slow at the bottom, fast at the top");

  // How long the needle spends in each band in one trip, in ms.
  const spent = { normal: 0, max: 0, over: 0 };
  for (let ms = 0; ms < METER_MS; ms += 0.5) spent[meterZone(meterAt(ms))] += 0.5;
  assert.ok(spent.max / 2 >= 40 && spent.max / 2 <= 120, `each pass through MAX is short but catchable (${spent.max / 2} ms)`);
  assert.ok(spent.over >= 60, `the overswing is a real risk past it (${spent.over} ms)`);

  assert.equal(meterZone(0.5), "normal");
  assert.equal(meterZone(1 - MAX_BAND), "max");
  assert.equal(meterZone(1), "max");
  assert.equal(meterZone(1.01), "over");
  assert.deepEqual(swingShot(0.5, 0.3, 0), { zone: "normal", angle: 0.3, power: 0.5 });
  assert.deepEqual(swingShot(0.95, 0.3, 0), { zone: "max", angle: 0.3, power: MAX_BOOST });
  const deep = swingShot(1 + OVER_BAND, 0, 0);
  assert.equal(deep.power, OVER_POWER);
  assert.ok(deep.angle !== 0, "an overswing pulls off line");
  assert.equal(swingShot(1 + OVER_BAND, 0, 1).angle, -deep.angle, "the next putt pulls the other way");
  assert.ok(Math.abs(swingShot(1.01, 0, 0).angle) < Math.abs(deep.angle), "the deeper into the red, the worse");

  const round = golfAt(1);
  assert.equal(setPower(round), null, "no power without a meter running");
  assert.equal(startSwing(round), true);
  assert.equal(round.phase, "swing");
  assert.equal(startSwing(round), false, "one meter at a time");
  let ms = 0;
  while (meterZone(meterAt(ms)) !== "max") ms += 1;
  round.swingMs = ms;
  const shot = setPower(round);
  assert.equal(shot.zone, "max");
  assert.equal(round.phase, "rolling");
  assert.equal(round.strokes, 1);
  assert.ok(Math.abs(speedOf(round.ball) - STRIKE_SPEED * MAX_BOOST) < 1e-9, "a MAX putt goes MAX_BOOST as hard");
  assert.ok(speedOf(round.ball) < MAX_SPEED, "and still under the top speed");
  assert.ok(Math.abs(round.lastSwing - meterAt(ms)) < 1e-9, "where the needle stopped is kept for the next swing");
});

test("Mini golf shot clock: a ball left waiting starts the meter by itself, a meter left running dribbles the ball off, and the aim turns back to the cup", () => {
  const { SHOT_CLOCK_MS, METER_TRIPS, METER_MS } = golfRules;
  const round = golfAt(1);
  const events = [];
  let waited = 0;
  for (; waited < SHOT_CLOCK_MS * 2 && round.phase === "aim"; waited += SUB_STEP_MS) events.push(...advance(round, SUB_STEP_MS));
  assert.equal(round.phase, "swing", "the shot clock started the meter");
  assert.ok(events.includes("clock"));
  assert.ok(Math.abs(waited - SHOT_CLOCK_MS) <= SUB_STEP_MS, `after the shot clock's time (${waited} ms)`);
  assert.equal(round.strokes, 0, "starting the meter is no stroke");

  let swung = 0;
  for (; swung < METER_TRIPS * METER_MS * 2 && round.phase === "swing"; swung += SUB_STEP_MS) events.push(...advance(round, SUB_STEP_MS));
  assert.ok(events.includes("dribble"), "the meter ran out");
  assert.ok(Math.abs(swung - METER_TRIPS * METER_MS) <= SUB_STEP_MS, `after its trips (${swung} ms)`);
  assert.equal(round.strokes, 1, "a dribble is a stroke");
  assert.equal(round.phase, "rolling");
  assert.ok(speedOf(round.ball) < 60, "and barely a nudge");

  round.aimAngle = 2;
  roll(round);
  assert.equal(round.phase, "aim");
  assert.equal(round.restMs, 0, "the shot clock starts again");
  const cup = HOLES[0].cup;
  assert.ok(Math.abs(round.aimAngle - Math.atan2(cup.y - round.ball.y, cup.x - round.ball.x)) < 1e-9, "the aim turned back toward the cup");
});

test("Mini golf pointer: the aim follows the pointer, a press starts the meter, a second putts, and a press held on a roll fast-forwards it", () => {
  const { canvas } = stubCanvas();
  const g = golf.create({ canvas });
  // 800 by 600 is twice the course, so a course unit is two CSS pixels.
  assert.equal(g.resize(319, 600), false, "under the smallest playable width");
  assert.equal(g.resize(800, 600), true);
  assert.equal(g.pointer("move", 10, 10), false, "no aiming before a round");
  assert.equal(g.pointer("down", 10, 10), true, "a press on a ready game starts the round");
  assert.equal(g.state, "running");
  assert.equal(g.round.phase, "aim", "and only that");
  const px = HOLES[0].tee.x * 2;
  const py = HOLES[0].tee.y * 2;
  assert.equal(g.pointer("move", px + 100, py - 100), true);
  assert.ok(Math.abs(g.round.aimAngle + Math.PI / 4) < 1e-9, "aimed up and right, at the pointer");
  assert.equal(g.pointer("down", px + 100, py - 100), true);
  assert.equal(g.round.phase, "swing", "the press started the meter");
  assert.equal(g.pointer("up", px + 100, py - 100), true);
  assert.equal(g.round.phase, "swing", "letting go sets nothing");
  assert.equal(g.pointer("move", px - 100, py), false, "the aim is locked while the meter runs");
  g.tick(200);
  assert.ok(g.round.swingMs > 0, "the meter runs on the game's ticks");
  g.round.swingMs = 600;
  assert.equal(g.pointer("down", 0, 0), true, "a second press, anywhere, putts");
  g.pointer("up", 0, 0);
  assert.equal(g.round.strokes, 1);
  assert.ok(g.round.ball.vx > 0 && g.round.ball.vy < 0, "up and right, where it was aimed");

  const clock = g.round.clock;
  assert.equal(g.pointer("down", 0, 0), true, "a press while it rolls fast-forwards");
  g.tick(100);
  assert.ok(Math.abs(g.round.clock - clock - 300) <= SUB_STEP_MS, `three times as fast (${g.round.clock - clock} ms)`);
  assert.equal(g.round.strokes, 1, "and putts nothing");
  g.pointer("up", 0, 0);
  const after = g.round.clock;
  g.tick(100);
  assert.ok(Math.abs(g.round.clock - after - 100) <= SUB_STEP_MS, "letting go plays it at its own speed");
});

test("Mini golf pointer: the aim stays on the cup until the pointer really moves, and a press without a move putts along it", () => {
  const { canvas } = stubCanvas();
  const g = golf.create({ canvas });
  // A course unit is two CSS pixels.
  g.resize(800, 600);
  const px = HOLES[0].tee.x * 2;
  const py = HOLES[0].tee.y * 2;
  g.pointer("move", px + 100, py - 100);
  g.pointer("down", px + 100, py - 100);
  assert.equal(g.state, "running");
  const cup = g.round.aimAngle;
  assert.equal(g.pointer("move", px + 103, py - 98), false, "a shake does not move the aim");
  assert.equal(g.round.aimAngle, cup);
  assert.equal(g.pointer("down", px + 103, py - 98), true);
  assert.equal(g.round.phase, "swing");
  assert.equal(g.round.swingAngle, cup, "a press where the pointer sat putts toward the cup");

  const h = golf.create({ canvas });
  h.resize(800, 600);
  h.pointer("down", px + 100, py - 100);
  assert.equal(h.pointer("move", px + 100, py - 120), true, "a real move aims again");
  assert.ok(Math.abs(h.round.aimAngle - Math.atan2(-120, 100)) < 1e-9, "at the pointer");
  assert.equal(h.pointer("move", px + 102, py - 120), true, "and then it follows every move");
});

test("Mini golf pointer: a cancel or a pause ends a fast-forward", () => {
  const { canvas } = stubCanvas();
  const g = golf.create({ canvas });
  g.resize(800, 600);
  g.start();
  g.round.aimAngle = -Math.PI / 2;
  g.pointer("down", 0, 0);
  g.round.swingMs = 600;
  g.pointer("down", 0, 0);
  assert.equal(g.round.phase, "rolling");
  const plays = (what) => {
    const at = g.round.clock;
    g.tick(100);
    assert.ok(Math.abs(g.round.clock - at - 100) <= SUB_STEP_MS, what);
  };
  g.pointer("down", 0, 0);
  assert.equal(g.pointer("cancel", 0, 0), true);
  plays("a cancel ends it");
  g.pointer("down", 0, 0);
  g.pause();
  g.resume();
  plays("a pause ends it, since its release may never come");
});

test("Mini golf keys: a press nudges the aim, a held arrow turns it faster the longer it is held, and action starts the meter, then putts", () => {
  const { canvas } = stubCanvas();
  const g = golf.create({ canvas });
  g.resize(800, 600);
  assert.equal(g.key("left"), false, "nothing to aim before a round");
  g.key("action");
  let angle = g.round.aimAngle;
  assert.equal(g.key("left"), true);
  assert.ok(Math.abs(angle - g.round.aimAngle - Math.PI / 180) < 1e-9, "a press nudges a degree");
  angle = g.round.aimAngle;
  assert.equal(g.key("left"), true, "a key repeat");
  assert.equal(g.round.aimAngle, angle, "changes nothing by itself");
  g.tick(100);
  const first = angle - g.round.aimAngle;
  assert.ok(first > 0, "held, it keeps turning");
  for (let i = 0; i < 8; i++) g.tick(100);
  angle = g.round.aimAngle;
  g.tick(100);
  assert.ok(angle - g.round.aimAngle > first * 3, "and faster the longer it is held");
  assert.equal(g.release("left"), true);
  angle = g.round.aimAngle;
  g.tick(100);
  assert.equal(g.round.aimAngle, angle, "let go, it stops");
  assert.equal(g.key("up"), false, "up and down do nothing in golf");
  assert.equal(g.release("up"), false);

  assert.equal(g.key("action"), true);
  assert.equal(g.round.phase, "swing", "action starts the meter");
  assert.equal(g.round.strokes, 0);
  assert.equal(g.key("left"), false, "the aim is locked while the meter runs");
  g.tick(200);
  assert.equal(g.key("action"), true);
  assert.equal(g.round.strokes, 1, "and putts on the second press");
  assert.equal(g.round.phase, "rolling");
  for (const name of ["up", "down", "left", "right"]) assert.equal(g.key(name), false, `${name} rests while the ball rolls`);
  assert.equal(g.key("action"), true, "action on a roll fast-forwards it");
  assert.equal(g.round.strokes, 1);
  assert.equal(g.release("action"), true);
});

test("Mini golf draws every hole of every course with a context that only records calls", () => {
  for (const c of COURSES) {
    const { canvas, calls } = stubCanvas();
    const g = golf.create({ canvas, course: c.id });
    g.resize(800, 600);
    g.start();
    for (let h = 0; h < HOLE_COUNT; h++) {
      const drawn = calls.count;
      g.tick(16);
      assert.ok(calls.count > drawn, `${c.id} hole ${h + 1} draws`);
      lineUp(g);
      g.key("right");
      g.release("right");
      g.key("action");
      // A frame with the meter up.
      g.tick(16);
      g.round.swingMs = SOFT_MS;
      g.key("action");
      g.tick(200);
      g.tick(3000);
      if (h < HOLE_COUNT - 1) g.key("action");
    }
    assert.equal(g.state, "over", `${c.id}: every hole sunk`);
  }
});

// A 2D context that keeps every method name it was called with, and answers
// the few calls the still layer needs.
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

test("Mini golf aim: the aim line shows from the start of a hole, the meter draws while it runs, and a pause repaints once", () => {
  const { canvas, names } = recordingCanvas();
  const g = golf.create({ canvas });
  g.resize(800, 600);
  g.start();
  names.length = 0;
  g.tick(16);
  assert.ok(names.includes("setLineDash"), "the aim line is drawn before any press");
  const resting = names.filter((n) => n === "fillRect").length;
  g.key("action");
  names.length = 0;
  g.tick(16);
  assert.ok(names.filter((n) => n === "fillRect").length >= resting + 4, "the meter's bands are drawn while it runs");
  names.length = 0;
  g.pause();
  assert.ok(names.length > 0, "a pause repaints at once");
  names.length = 0;
  g.tick(16);
  assert.equal(names.length, 0, "and nothing after that while paused");
});

test("Mini golf draws the still course once per hole when the page can draw off screen", () => {
  const saved = globalThis.OffscreenCanvas;
  const layers = [];
  globalThis.OffscreenCanvas = class {
    constructor(w, h) {
      this.width = w;
      this.height = h;
      this.calls = 0;
      layers.push(this);
      const layer = this;
      this.ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => { layer.calls += 1; }), set: (t, n, v) => { t[n] = v; return true; } });
    }
    getContext() { return this.ctx; }
  };
  try {
    const { canvas, names } = recordingCanvas();
    const g = golf.create({ canvas });
    g.resize(800, 600);
    // A round reads its colors afresh (a theme change made while paused shows),
    // so the layer is drawn again at the start.
    g.start();
    const base = layers.length;
    const layer = layers.at(-1);
    g.tick(16);
    g.tick(16);
    assert.equal(layers.length, base, "one layer for hole 1, kept across frames");
    assert.equal(layer.width, 800, "at the board's pixel size");
    const drawn = layer.calls;
    assert.ok(drawn > 100, "the speckled rough and turf went to the layer");
    names.length = 0;
    g.tick(16);
    assert.equal(layer.calls, drawn, "and are not drawn again");
    assert.ok(names.includes("drawImage"), "each frame copies the layer");
    lineUp(g);
    softPutt(g);
    g.tick(3000);
    g.key("action");
    g.tick(16);
    assert.equal(layers.length, base + 1, "hole 2 gets its own layer");
    g.resize(400, 300);
    assert.equal(layers.length, base + 2, "a resize draws it again");
  } finally {
    if (saved === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = saved;
  }
});

/* ---------------------------------------------------------------- tones */

test("tone() plays only while Play sounds is on, and never throws", async () => {
  const { tone } = await import("../src/web-console/public/tones.js");
  const { looks } = await import("../src/web-console/public/looks.js");
  const saved = { sound: looks.sound, ctor: globalThis.AudioContext };
  let oscillators = 0;
  const gains = [];
  const freqs = [];
  // Every oscillator made, so a test can read its wave.
  const oscs = [];
  const param = { setValueAtTime(v) { freqs.push(v); }, exponentialRampToValueAtTime() {} };
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 0;
    destination = {};
    resume() { return Promise.resolve(); }
    createOscillator() {
      oscillators += 1;
      const osc = { type: "", frequency: param, connect() {}, start() {}, stop() {} };
      oscs.push(osc);
      return osc;
    }
    // Each gain keeps the values its envelope ramps to, so a test can read a blip's peak.
    createGain() {
      const ramps = [];
      gains.push(ramps);
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime(v) { ramps.push(v); } }, connect() {} };
    }
  };
  const lastPeak = () => Math.max(...gains.at(-1));
  try {
    looks.sound = true;
    tone("eat");
    assert.equal(oscillators, 1, "Play sounds on: eat plays");
    tone("nope");
    assert.equal(oscillators, 1, "an unknown tone plays nothing");
    for (const name of ["putt", "wall", "bump", "cup", "splash", "tunnel", "boom", "sizzle", "fall"]) tone(name);
    assert.equal(oscillators, 10, "each mini golf tone plays");
    tone("ace");
    assert.equal(oscillators, 13, "a hole in one is three notes");
    tone("power");
    assert.equal(oscillators, 16, "a power-up is three notes");
    tone("putt");
    const loud = lastPeak();
    tone("putt", 0.2);
    assert.equal(oscillators, 18, "a quieter level still plays");
    assert.ok(lastPeak() < loud, "and peaks lower than a full one");
    freqs.length = 0;
    tone("thunk");
    tone("thunk", 1, 1.5);
    assert.deepEqual(freqs, [240, 360], "a pitch scales the blip");
    tone("slice", 1, 1.5);
    freqs.length = 0;
    tone("perfect", 1, 99);
    assert.deepEqual(freqs, [660 * 4, 990 * 4], "kept to two octaves up");
    freqs.length = 0;
    tone("thunk", 1, 0.01);
    tone("thunk", 1, "high");
    assert.deepEqual(freqs, [240 * 0.25, 240], "two octaves down at most, and a wild one plays at its own pitch");
    assert.equal(oscillators, 25, "Stack Deploy's tones play at any pitch, a wild one kept in range");
    freqs.length = 0;
    tone("ram", 0.5, 2);
    tone("rev");
    assert.deepEqual(freqs, [380, 90], "Bumper Ring's thud, pitched up for a hard hit, and a rival's rev");
    assert.equal(oscillators, 27);
    freqs.length = 0;
    tone("beat");
    assert.deepEqual(freqs, [95], "Bounce Road's heartbeat");
    assert.equal(oscillators, 28);
    freqs.length = 0;
    tone("tick", 0.9, 1.5);
    tone("pop");
    assert.deepEqual(freqs, [2250, 480], "Hot Potato's fuse tick, pitched up as it burns down, and the pop of a pass");
    assert.equal(oscillators, 30);
    freqs.length = 0;
    tone("hop", 0.6, 1.5);
    tone("boing");
    tone("bell");
    tone("horn");
    assert.deepEqual(freqs, [780, 260, 1320, 990, 370, 466], "Crossing Rush's hop, pitched up for a run of quick hops, the boing of a send-back, the crossing bell and the Horn");
    assert.equal(oscillators, 36);
    freqs.length = 0;
    tone("engine", 0.3, 1.5);
    assert.deepEqual(freqs, [123], "Bounce Road's engine, pitched up with your speed");
    assert.equal(oscs.at(-1).type, "triangle", "the engine's hum is a soft triangle, never a sawtooth's buzz");
    assert.equal(oscillators, 37);
    freqs.length = 0;
    tone("pew", 0.16);
    assert.equal(oscs.at(-1).type, "triangle", "Rapids Run's shot is a soft triangle, never a buzz");
    tone("charge");
    tone("lowcell");
    tone("dambreak");
    tone("skim", 0.2, 1.2);
    assert.deepEqual(freqs, [1320, 440, 660, 440, 300, 1800], "Rapids Run's shot, a charge buoy, the low battery's beep, a dam bursting and a skim, pitched up the longer you skim");
    assert.equal(oscillators, 43);
    freqs.length = 0;
    tone("ghoulBlast");
    tone("zombiePop", 0.5, 1.5);
    tone("ghoulStomp");
    tone("ghoulBoo");
    tone("ghoulRoar");
    assert.deepEqual(freqs, [980, 390, 220, 330, 120], "Ghoul Rush's bolt, a ghoul torn apart (pitched up for the chain), a stomp, a ghost's moan and a boss's roar");
    assert.equal(oscs.at(-5).type, "triangle", "the bolt is a soft triangle, never a buzz, since it repeats while fire is held");
    freqs.length = 0;
    tone("ghoulCandy", 0.35, 2);
    tone("zombieGroan");
    tone("batSwoop");
    tone("creakBoard");
    assert.deepEqual(freqs, [2960, 110, 2200, 180], "a soul (pitched up for a run), a zombie's groan, a bat's screech and a creaking board");
    freqs.length = 0;
    tone("doorUnlock");
    tone("doorThrough");
    assert.deepEqual(freqs, [494, 587, 740, 659, 587, 494, 440], "the key turning and the door through, both in a minor key");
    freqs.length = 0;
    tone("ghoulGrowl");
    tone("ghoulShriek");
    tone("ghoulSpit");
    tone("ghoulThunder");
    assert.deepEqual(freqs, [95, 1900, 340, 70], "a hellhound's growl, a wraith's shriek, a bloater's spit and thunder");
    tone("ghoulSkitter");
    assert.equal(oscillators, 67);
    freqs.length = 0;
    looks.sound = false;
    for (const name of ["crash", "putt", "wall", "bump", "cup", "ace", "splash", "power", "boom", "ram", "rev", "beat", "tick", "pop", "hop", "boing", "bell", "horn", "engine", "pew", "charge", "lowcell", "dambreak", "skim", "ghoulBlast", "zombiePop", "ghoulStomp", "ghoulBoo", "ghoulRoar", "ghoulCandy", "zombieGroan", "batSwoop", "doorUnlock", "doorThrough", "creakBoard", "ghoulGrowl", "ghoulShriek", "ghoulSkitter", "ghoulSpit", "ghoulThunder"]) tone(name);
    assert.equal(oscillators, 67, "Play sounds off: silent");
  } finally {
    looks.sound = saved.sound;
    if (saved.ctor === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = saved.ctor;
  }
});

/* -------------------------------------------------- Light Trails rules */

// A fixed random source: every call returns the same value, so a rival never
// guesses and nothing lands anywhere by chance.
const still = () => 0.5;

// Moves a rider to x, y facing `dir`, as if it had just started there.
function park(round, r, x, y, dir) {
  if (round.grid[r.y * trails.COLS + r.x] === r.id + 1) round.grid[r.y * trails.COLS + r.x] = 0;
  Object.assign(r, { x, y, dir, prev: { x, y }, path: [{ x, y }], queue: [], acc: 0 });
  round.grid[y * trails.COLS + x] = r.id + 1;
}

// Straight into the race, past the hold before a heat.
function racing(round) {
  trails.advance(round, round.phaseMs, still);
  assert.equal(round.phase, "race");
  round.events.length = 0;
  return round;
}

const trailsEvents = (round, type) => round.events.filter((e) => e.type === type);

test("Light Trails: a round starts at level 1 with three lives, two boosts and one rival, everyone on the grid", () => {
  const round = trails.newRound(still);
  assert.equal(round.level, 1);
  assert.equal(round.lives, trails.START_LIVES);
  assert.equal(round.charges, trails.START_CHARGES);
  assert.equal(round.riders.length, 2, "you and one rival");
  assert.equal(round.phase, "ready");
  for (const r of round.riders) assert.equal(round.grid[r.y * trails.COLS + r.x], r.id + 1, `rider ${r.id} sits on its own cell`);
  assert.equal(round.blocks.length, 0, "no crystals before level 3");
  assert.equal(round.portals.length, 0, "no portals before level 4");
});

test("Light Trails: a turn back the way you came or the way you go is ignored, and only two queue", () => {
  const round = racing(trails.newRound(still));
  assert.equal(round.riders[0].dir, "right");
  assert.equal(trails.turn(round, "left"), false, "no turning back");
  assert.equal(trails.turn(round, "right"), false, "already going that way");
  assert.equal(trails.turn(round, "up"), true);
  assert.equal(trails.turn(round, "down"), false, "the reverse of the queued turn");
  assert.equal(trails.turn(round, "left"), true);
  assert.equal(trails.turn(round, "down"), false, "a third queued turn is mashing");
});

test("Light Trails: the step quickens each level, a boost speeds you up and Slow-mo slows only the rivals", () => {
  const round = racing(trails.newRound(still));
  const [you, rival] = round.riders;
  assert.equal(trails.pace(round, you), trails.STEP_MS);
  round.level = 3;
  assert.ok(trails.pace(round, you) < trails.STEP_MS, "level 3 is quicker");
  round.level = 1;
  assert.equal(trails.boost(round), true);
  assert.equal(round.charges, trails.START_CHARGES - 1);
  assert.equal(trails.pace(round, you), trails.STEP_MS * trails.BOOST_PACE);
  assert.equal(trails.pace(round, rival), trails.STEP_MS, "a boost is yours alone");
  assert.equal(trails.boost(round), false, "one boost at a time");
  delete round.effects.boost;
  round.effects.slow = 1000;
  assert.ok(trails.pace(round, rival) > trails.STEP_MS, "Slow-mo slows the rivals");
  assert.equal(trails.pace(round, you), trails.STEP_MS, "and not you");
  round.charges = 0;
  assert.equal(trails.boost(round), false, "no charge, no boost");
});

test("Light Trails: riding into the wall costs a life and runs the heat again, and the last life ends the round", () => {
  const round = racing(trails.newRound(still));
  for (let life = trails.START_LIVES; life > 0; life--) {
    park(round, round.riders[0], 0, 15, "left");
    trails.advance(round, trails.STEP_MS + trails.GRACE_MS, still);
    assert.equal(round.riders[0].alive, false, "the wall is out");
    assert.equal(round.result, "lose");
    assert.equal(round.lives, life - 1);
    assert.equal(trailsEvents(round, "crash").length, 1);
    round.events.length = 0;
    trails.advance(round, trails.DONE_MS, still);
    if (life > 1) {
      assert.equal(round.level, 1, "the same arena again");
      assert.equal(round.phase, "ready");
      assert.equal(trailsEvents(round, "retry").length, 1);
      racing(round);
    }
  }
  assert.equal(round.over, true, "no lives left: the round is over");
  assert.equal(trailsEvents(round, "over").length, 1);
});

test("Light Trails: a rival that hits your trail scores the out and the cut, the heat is won, and the next arena adds a rival", () => {
  const round = racing(trails.newRound(still));
  const [you, rival] = round.riders;
  // The rival in a corner with your trail on every side it could turn to.
  park(round, rival, 0, 1, "up");
  round.grid[0] = you.id + 1;
  round.grid[1 * trails.COLS + 1] = you.id + 1;
  trails.advance(round, trails.STEP_MS, still);
  assert.equal(rival.alive, false);
  assert.equal(rival.by, 0, "it hit your trail");
  const [out] = trailsEvents(round, "out");
  assert.equal(out.points, trails.OUT_POINTS + trails.CUT_POINTS);
  assert.equal(round.result, "win", "the last rival out wins the heat");
  assert.equal(round.score, trails.OUT_POINTS + trails.CUT_POINTS + trails.WIN_POINTS);
  assert.equal(round.outs, 1);
  round.events.length = 0;
  trails.advance(round, trails.DONE_MS, still);
  assert.equal(round.level, 2);
  assert.equal(round.riders.length, 3, "two rivals at level 2");
  assert.equal(round.lives, trails.START_LIVES, "a win costs no life");
  assert.deepEqual(trailsEvents(round, "level").map((e) => e.level), [2]);
});

test("Light Trails: a crash is held for GRACE_MS, a turn in that time rides out, and only you get the grace", () => {
  const round = racing(trails.newRound(still));
  const [you, rival] = round.riders;
  park(round, you, 0, 15, "left");
  park(round, rival, 30, 5, "right");
  trails.advance(round, trails.STEP_MS, still);
  assert.equal(you.alive, true, "held up, not out yet");
  assert.deepEqual({ x: you.x, y: you.y }, { x: 0, y: 15 }, "and holding still");
  assert.equal(trails.turn(round, "left"), false, "the way you are held up on is no turn");
  assert.equal(trails.turn(round, "right"), false, "nor is back the way you came");
  assert.equal(trails.turn(round, "up"), true);
  trails.advance(round, 8, still);
  assert.equal(you.alive, true);
  assert.deepEqual({ x: you.x, y: you.y, dir: you.dir }, { x: 0, y: 14, dir: "up" }, "rode out upward");
  assert.equal(you.stall, null);

  // No turn: still riding just before the grace runs out, out just after.
  park(round, you, 0, 15, "left");
  trails.advance(round, trails.STEP_MS + trails.GRACE_MS - 16, still);
  assert.equal(you.alive, true);
  trails.advance(round, 16, still);
  assert.equal(you.alive, false, "the grace ran out");
  assert.equal(you.by, "wall");

  // A rival gets none: it is out on the step itself.
  const two = racing(trails.newRound(still));
  const foe = two.riders[1];
  park(two, two.riders[0], 10, 15, "right");
  park(two, foe, trails.COLS - 1, 1, "up");
  two.grid[trails.COLS - 1] = trails.WALL;
  two.grid[trails.COLS + trails.COLS - 2] = trails.WALL;
  two.grid[trails.COLS + trails.COLS] = trails.WALL;
  trails.advance(two, trails.STEP_MS, still);
  assert.equal(foe.alive, false);
});

test("Light Trails: you and the last rival out together is a draw, and nobody loses a life", () => {
  const round = racing(trails.newRound(still));
  const [you, rival] = round.riders;
  park(round, you, 0, 15, "left");
  // The rival in the top right corner, walled in on both sides it could turn to.
  park(round, rival, trails.COLS - 1, 1, "up");
  round.grid[trails.COLS - 1] = trails.WALL;
  round.grid[trails.COLS + trails.COLS - 2] = trails.WALL;
  trails.advance(round, trails.STEP_MS + trails.GRACE_MS, still);
  assert.equal(you.alive, false);
  assert.equal(rival.alive, false);
  assert.equal(round.result, "draw");
  assert.equal(round.lives, trails.START_LIVES);
});

test("Light Trails: rivals turn away from a wall and toward the room", () => {
  const round = racing(trails.newRound(still));
  round.level = 9;
  const rival = round.riders[1];
  park(round, rival, trails.COLS - 1, 10, "right");
  assert.ok(["up", "down"].includes(trails.choose(round, rival, still)), "never into the wall");
  // Everything above row 10 walled off: only down has room.
  for (let y = 0; y < 10; y++) for (let x = 0; x < trails.COLS; x++) round.grid[y * trails.COLS + x] = trails.WALL;
  assert.equal(trails.choose(round, rival, still), "down");
  assert.ok(trails.room(round, 11 * trails.COLS + 5) > 100, "the open half has room");
});

test("Light Trails: crystals from level 3 come in mirrored pairs and never sit in a starting lane", () => {
  const round = trails.newRound(still);
  let seed = 3;
  const random = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  const STEPS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const level of [3, 6, 9]) {
    round.level = level;
    trails.newHeat(round, random);
    assert.ok(round.blocks.length > 0, `crystals at level ${level}`);
    const has = new Set(round.blocks.map((b) => `${b.x},${b.y}`));
    for (const b of round.blocks) assert.ok(has.has(`${trails.COLS - 1 - b.x},${trails.ROWS - 1 - b.y}`), "each has its mirror");
    for (const r of round.riders) {
      const [dx, dy] = STEPS[r.dir];
      for (let k = 1; k <= 10; k++) assert.equal(round.grid[(r.y + dy * k) * trails.COLS + r.x + dx * k], 0, `the lane of rider ${r.id} is open`);
    }
  }
});

test("Light Trails: from level 4 a portal carries a rider out of its partner, going the same way", () => {
  const round = trails.newRound(still);
  round.level = 4;
  racing(trails.newHeat(round, still));
  assert.equal(round.portals.length, 2, "one pair at level 4");
  const [a] = round.portals;
  const you = round.riders[0];
  park(round, you, a.x - 1, a.y, "right");
  trails.advance(round, trails.pace(round, you), still);
  assert.equal(you.alive, true);
  assert.deepEqual({ x: you.x, y: you.y }, { x: a.to.x, y: a.to.y });
  assert.equal(you.dir, "right");
  assert.equal(trailsEvents(round, "portal").filter((e) => e.id === 0).length, 1);
  round.level = 6;
  trails.newHeat(round, still);
  assert.equal(round.portals.length, 4, "two pairs from level 6");
});

test("Light Trails: Phase rides through trails, the Eraser wipes those around you, and a rival only snatches a pad", () => {
  const round = racing(trails.newRound(still));
  const you = round.riders[0];
  park(round, you, 10, 15, "right");
  round.grid[15 * trails.COLS + 11] = 2;
  trails.applyPower(round, "phase");
  trails.advance(round, trails.STEP_MS, still);
  assert.equal(you.alive, true, "phased through the rival's trail");
  assert.equal(you.x, 11);
  assert.equal(round.grid[15 * trails.COLS + 11], 2, "and left it as it was");

  delete round.effects.phase;
  const close = 15 * trails.COLS + 14;
  const far = 2 * trails.COLS + 30;
  round.grid[close] = 2;
  round.grid[far] = 2;
  trails.applyPower(round, "eraser");
  assert.equal(round.grid[close], 0, "a trail within reach is wiped");
  assert.equal(round.grid[far], 2, "one out of reach stays");

  const rival = round.riders[1];
  park(round, rival, 30, 25, "up");
  round.items.push({ x: 30, y: 24, kind: "coin", ttl: 5000 });
  const score = round.score;
  // Only the rival moves: you are parked well clear and never reach a pace.
  you.acc = -1e9;
  for (let i = 0; i < 30 && round.items.length; i++) trails.advance(round, 10, still);
  assert.equal(round.items.length, 0, "the rival took the pad");
  assert.equal(round.score, score, "and you got nothing for it");
  assert.equal(trailsEvents(round, "snatch").length, 1);
});

test("Light Trails: pads turn up from level 2, never at level 1", () => {
  const one = racing(trails.newRound(still));
  one.nextItem = 1;
  trails.advance(one, 8, still);
  assert.equal(one.items.length, 0);
  const two = trails.newRound(still);
  two.level = 2;
  racing(trails.newHeat(two, still));
  two.nextItem = 1;
  trails.advance(two, 8, still);
  assert.equal(two.items.length, 1);
  assert.ok(Object.hasOwn(trails.POWERS, two.items[0].kind));
});

test("Light Trails: from level 5 the walls close in a ring at a time, warning first, and catch anyone on the ring", () => {
  const round = trails.newRound(still);
  round.level = 5;
  racing(trails.newHeat(round, still));
  assert.equal(round.nextRing, trails.SHRINK_FIRST_MS);
  round.nextRing = trails.SHRINK_WARN_MS + 4;
  trails.advance(round, 8, still);
  assert.equal(trailsEvents(round, "warn").length, 1, "the ring warns before it closes");
  const rival = round.riders[1];
  park(round, rival, 0, 20, "up");
  trails.closeRing(round);
  assert.equal(round.ring, 1);
  assert.equal(round.grid[0], trails.WALL);
  assert.equal(round.grid[(trails.ROWS - 1) * trails.COLS + 5], trails.WALL);
  assert.equal(round.grid[1 * trails.COLS + 1], 0, "the next ring in is still open");
  assert.equal(rival.alive, false, "a rival on the ring is out");
});

test("Light Trails: the start screen reads the furthest arena from the memo and writes nothing just by drawing", () => {
  const { canvas, calls } = stubCanvas();
  let saved = 5;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const g = trails.default.create({ canvas, memo });
  assert.equal(g.resize(800, 600), true);
  assert.ok(calls.count > 0, "the start screen draws");
  assert.equal(g.resize(trails.COLS * trails.MIN_CELL - 1, 600), false, "too narrow to play");
  assert.equal(saved, 5, "nothing is written by just opening it");
});

test("Light Trails: every pill's text reads at 4.5:1 on its backing and its timer's tint, lives and running effects included, in light and dark under every highlight", () => {
  checkPills(trails.default, {
    setup: (r) => Object.assign(r.effects, { boost: trails.BOOST_MS / 2, phase: 1500, slow: 2000 }),
    expect: ["LV 1", "♥", "~BOOST", "~PHASE", "~SLOW-MO", "1 RIVAL"],
  });
});

test("Light Trails game: the opening banner sits in the board from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.3)");
  const g = trails.default.create({ canvas });
  g.resize(800, 600);
  openingBanner(g, shades, 600);
});

/* ------------------------------------------------------ Bug Hunt rules */

// Each bug settled into its slot, as if the wave had finished flying in.
function settled(round) {
  for (const b of round.bugs) {
    Object.assign(b, bugs.slotPos(round, b.slot), { state: "form", t: 0 });
  }
  round.nextDive = 1e9;
  round.events.length = 0;
  return round;
}

// A shot fired straight up from just under `at`.
const shootAt = (round, at) => round.shots.push({ x: at.x, y: at.y + 0.5, vx: 0, vy: -46 });

const huntEvents = (round, type) => round.events.filter((e) => e.type === type);

test("Bug Hunt: a round opens on wave 1, two rows of six everyday bugs flying in, and three lives", () => {
  const round = bugs.newRound(still);
  assert.equal(round.wave, 1);
  assert.equal(round.lives, bugs.START_LIVES);
  assert.equal(round.bugs.length, 12);
  assert.ok(round.bugs.every((b) => b.kind === "ant" && b.state === "wait"), "every bug waits its turn to fly in");
  assert.equal(huntEvents(round, "wave").length, 1);
  bugs.advance(round, 4000, still);
  assert.ok(round.bugs.every((b) => b.state === "form" || b.state === "dive"), "after the swoop, all are in place or diving");
});

test("Bug Hunt: each new kind of bug arrives on its own wave, and every fifth wave is a boss", () => {
  const round = bugs.newRound(still);
  const fresh = {};
  for (let n = 2; n <= 15; n++) {
    round.events.length = 0;
    round.boss = null;
    bugs.spawnWave(round, still);
    const [e] = huntEvents(round, "wave");
    if (e.fresh) fresh[e.fresh] = n;
    if (n % bugs.BOSS_EVERY === 0) {
      assert.ok(round.boss, `wave ${n} is a boss`);
      assert.equal(round.bugs.length, 0, "a boss comes alone");
    } else assert.equal(round.boss, null);
  }
  assert.deepEqual(fresh, { beetle: 2, zigzag: 3, spitter: 4, blinker: 6, firewall: 7 });
  round.boss = null;
  round.wave = 4;
  bugs.spawnWave(round, still);
  assert.equal(round.boss.kind, "leak");
  round.wave = 9;
  bugs.spawnWave(round, still);
  assert.equal(round.boss.kind, "spaghetti");
  round.wave = 14;
  bugs.spawnWave(round, still);
  assert.equal(round.boss.kind, "heisen");
  round.wave = 19;
  bugs.spawnWave(round, still);
  assert.equal(round.boss.kind, "leak", "the bosses come round again");
  assert.ok(round.boss.max > bugs.BOSSES.leak.hp, "and take more the second time");
});

test("Bug Hunt: fire held shoots every FIRE_MS, the ship slides while an arrow is held, and nothing moves it once let go", () => {
  const round = settled(bugs.newRound(still));
  round.input.fire = true;
  bugs.advance(round, bugs.FIRE_MS * 3 - 8, still);
  assert.equal(huntEvents(round, "shoot").length, 3);
  round.input.fire = false;
  round.events.length = 0;
  bugs.advance(round, 1000, still);
  assert.equal(huntEvents(round, "shoot").length, 0, "let go, no more shots");
  const x = round.ship.x;
  round.input.left = true;
  bugs.advance(round, 200, still);
  assert.ok(round.ship.x < x, "left slides left");
  round.input.left = false;
  const stop = round.ship.x;
  bugs.advance(round, 200, still);
  assert.equal(round.ship.x, stop);
});

test("Bug Hunt: a shot squashes a bug for its points, and quick kills build a combo", () => {
  const round = settled(bugs.newRound(still));
  const [a, b] = round.bugs;
  shootAt(round, a);
  bugs.advance(round, 16, still);
  assert.equal(round.bugs.includes(a), false);
  assert.equal(round.score, bugs.BUGS.ant.points);
  shootAt(round, b);
  bugs.advance(round, 16, still);
  assert.equal(round.combo, 2);
  assert.equal(round.score, bugs.BUGS.ant.points * 3, "the second kill counts twice");
  bugs.advance(round, bugs.COMBO_MS + 50, still);
  assert.equal(round.combo, 1, "the combo runs out");
});

test("Bug Hunt: a beetle takes two shots and splits into two bugs that dive on their own", () => {
  const round = bugs.newRound(still);
  round.wave = 1;
  bugs.spawnWave(round, still);
  settled(round);
  const beetle = round.bugs.find((b) => b.kind === "beetle");
  assert.ok(beetle, "wave 2 has beetles");
  const count = round.bugs.length;
  shootAt(round, beetle);
  bugs.advance(round, 16, still);
  assert.ok(round.bugs.includes(beetle), "one shot only dents it");
  assert.equal(huntEvents(round, "hurt").length, 1);
  shootAt(round, beetle);
  bugs.advance(round, 16, still);
  assert.equal(round.bugs.includes(beetle), false);
  assert.equal(round.bugs.length, count + 1, "one beetle out, two bugs in");
  assert.equal(round.bugs.filter((b) => !b.slot && b.state === "dive").length, 2);
});

test("Bug Hunt: a hit costs a life, the ship comes back unhittable for a while, a shield takes a hit, and the last life ends the round", () => {
  const round = settled(bugs.newRound(still));
  const ship = round.ship;
  assert.equal(bugs.hitShip(round), true);
  assert.equal(round.lives, bugs.START_LIVES - 1);
  assert.equal(ship.alive, false);
  bugs.advance(round, bugs.RESPAWN_MS + 16, still);
  assert.equal(ship.alive, true, "back after the respawn");
  assert.equal(bugs.hitShip(round), false, "and safe for a moment");
  bugs.advance(round, bugs.INVULN_MS, still);
  bugs.applyPower(round, "shield");
  assert.equal(bugs.hitShip(round), true);
  assert.equal(round.lives, bugs.START_LIVES - 1, "the shield took it");
  assert.equal(round.shield, 0);
  ship.invuln = 0;
  round.lives = 1;
  bugs.hitShip(round);
  assert.equal(round.over, true);
  assert.equal(huntEvents(round, "over").length, 1);
});

test("Bug Hunt: a bomb that reaches the ship is a hit", () => {
  const round = settled(bugs.newRound(still));
  round.bombs.push({ x: round.ship.x, y: round.ship.y - 3, vx: 0, vy: 15 });
  bugs.advance(round, 400, still);
  assert.equal(round.lives, bugs.START_LIVES - 1);
  assert.equal(round.bombs.length, 0, "a hit clears the bombs");
});

test("Bug Hunt: shots pass through a null pointer while it fades", () => {
  const round = bugs.newRound(still);
  round.wave = 5;
  bugs.spawnWave(round, still);
  settled(round);
  const blinker = round.bugs.find((b) => b.kind === "blinker");
  blinker.phase = 2000 - round.clock;
  assert.equal(bugs.ghostly(round, blinker), true);
  shootAt(round, blinker);
  bugs.advance(round, 16, still);
  assert.ok(round.bugs.includes(blinker), "faded: the shot went through");
  blinker.phase = -round.clock;
  assert.equal(bugs.ghostly(round, blinker), false);
  shootAt(round, blinker);
  bugs.advance(round, 16, still);
  assert.equal(round.bugs.includes(blinker), false);
});

test("Bug Hunt: a wave cleared scores its bonus, more without a hit, and the next wave follows the rest", () => {
  const round = settled(bugs.newRound(still));
  for (const b of [...round.bugs]) bugs.hurtBug(round, b, still);
  const before = round.score;
  bugs.advance(round, 16, still);
  const [clear] = huntEvents(round, "clear");
  assert.ok(clear.perfect);
  assert.equal(round.score - before, bugs.CLEAR_POINTS + bugs.PERFECT_POINTS);
  assert.equal(round.wave, 1);
  bugs.advance(round, bugs.CLEAR_MS, still);
  assert.equal(round.wave, 2);
});

test("Bug Hunt: the Spaghetti Monster shrugs off shots until its tentacles are cut, and the Heisenbug while it blurs", () => {
  const round = bugs.newRound(still);
  round.wave = 9;
  round.bugs = [];
  bugs.spawnWave(round, still);
  const boss = round.boss;
  bugs.advance(round, 4000, still);
  assert.equal(boss.state, "fight");
  round.events.length = 0;
  shootAt(round, { x: boss.x, y: boss.y + 2 });
  bugs.advance(round, 16, still);
  assert.equal(boss.hp, boss.max, "tentacles up: the body is untouched");
  assert.equal(huntEvents(round, "clink").length, 1);
  for (const t of boss.tentacles) t.hp = 0;
  shootAt(round, { x: boss.x, y: boss.y + 2 });
  bugs.advance(round, 16, still);
  assert.equal(boss.hp, boss.max - 1, "cut: the body takes the shot");
  bugs.hurtBoss(round, boss.hp, still);
  assert.equal(round.boss, null);
  assert.equal(huntEvents(round, "bossdown")[0].points, bugs.BOSS_POINTS);

  round.wave = 14;
  bugs.spawnWave(round, still);
  const heisen = round.boss;
  bugs.advance(round, 4000, still);
  heisen.blur = 400;
  heisen.teleMs = 1e9;
  shootAt(round, { x: heisen.x, y: heisen.y + 2 });
  bugs.advance(round, 16, still);
  assert.equal(heisen.hp, heisen.max, "blurred: untouchable");
});

test("Bug Hunt: Refactor clears the bombs and cleans up the bugs on screen", () => {
  const round = settled(bugs.newRound(still));
  round.bombs.push({ x: 5, y: 5, vx: 0, vy: 1 });
  bugs.applyPower(round, "refactor");
  assert.equal(round.bombs.length, 0);
  assert.equal(round.bugs.length, 0, "two points of damage squash every everyday bug");
});

test("Bug Hunt: every pill's text reads at 4.5:1 on its backing and its timer's tint, lives, the combo, a shield and every power included, in light and dark under every highlight", () => {
  checkPills(bugs.default, {
    setup: (r) => {
      r.combo = 3;
      r.comboMs = bugs.COMBO_MS / 2;
      r.shield = 1;
      Object.assign(r.effects, { spread: 4000, rapid: 4000, slow: 3000, magnet: 5000 });
    },
    expect: ["WAVE 1", "♥", "~x3 COMBO", "SHIELD", "~SPREAD", "~RAPID", "~SLOW-MO", "~MAGNET"],
  });
});

test("Bug Hunt: starting a round meets the first bug, and the tally keeps it in the memo", () => {
  const { canvas } = stubCanvas();
  let saved = 0;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const g = bugs.default.create({ canvas, memo });
  assert.equal(g.resize(800, 600), true);
  assert.equal(saved, 0, "nothing before a round");
  g.key("action");
  assert.equal(g.state, "running");
  assert.equal(saved & (1 << bugs.DISCOVERIES.indexOf("bug:ant")), 1 << bugs.DISCOVERIES.indexOf("bug:ant"));
  assert.equal(g.round.input.fire, true, "space held fires");
  g.release("action");
  assert.equal(g.round.input.fire, false, "and let go stops");
  g.key("left");
  g.pause();
  assert.equal(g.round.input.left, false, "a pause lets go of every key");
  assert.equal(g.resize(bugs.W * bugs.MIN_CELL - 1, 600), false, "too narrow to play");
});

/* ------------------------------------------------------ Sunset Drive rules */

// The index of the segment under the car, and a round with nothing on the
// road but what a test puts there.
const driveIndex = (round) => Math.floor((round.pos + drive.PLAYER_Z) / drive.SEG);
const clearRoad = (round) => {
  for (const seg of round.segs) {
    seg.props = [];
    seg.items = [];
  }
  round.events = [];
  return round;
};
const driveEvents = (round, type) => round.events.filter((e) => e.type === type);
// Traffic out of every test's way: the count stays full, so no new car is
// placed near the car, and each parked one is moved far ahead.
const farCars = (round) => {
  round.cars = Array.from({ length: 40 }, () => ({ z: 1e12, x: 0, speed: 0, kind: "car", color: "#fff", ahead: true }));
  return round;
};
const quiet = (round) => farCars(clearRoad(round));
// No bends either, so a car nobody steers stays on the road, and in the
// right lane, clear of the middle one where the test random puts new cars.
const straight = (round) => {
  for (const seg of round.segs) seg.curve = 0;
  round.x = 2 / 3;
  return quiet(round);
};

test("Sunset Drive: a round opens on Sunset Coast at stage 1, with the clock, two nitro cans, traffic ahead and a fork to come", () => {
  const round = drive.newRound(still);
  assert.equal(round.stage, 1);
  assert.equal(round.region, "coast");
  assert.equal(round.time, drive.START_TIME_MS);
  assert.equal(round.nitro, drive.START_NITRO);
  assert.ok(round.cars.length > 0 && round.cars.every((c) => c.z > round.pos + drive.PLAYER_Z), "every car starts ahead");
  assert.ok(round.forkAt >= drive.STAGE_LEN, "the fork comes after a full stage");
  assert.equal(round.gateAt - round.forkAt, drive.FORK_LEN, "and the split runs to the checkpoint");
  assert.ok(round.gateAt + 1 - driveIndex(round) > drive.DRAW, "the road is built past what is drawn");
  assert.notEqual(round.fork.left, round.fork.right);
  assert.ok(drive.REGIONS[round.fork.left].bonus <= drive.REGIONS[round.fork.right].bonus, "the gentler road is on the left");
  assert.deepEqual(driveEvents(round, "stage").map((e) => e.region), ["coast"]);
});

test("Sunset Drive: held up speeds the car to top speed and scores the road driven; off the road it slows to a quarter", () => {
  const round = straight(drive.newRound(still));
  round.input.up = true;
  drive.advance(round, 6000, still);
  assert.equal(round.speed, drive.MAX_SPEED, "five seconds to top speed");
  assert.ok(round.score > 0, "the road driven scores");
  round.x = 2;
  drive.advance(round, 3000, still);
  assert.ok(round.speed <= drive.OFFROAD_LIMIT + 1, "off the road, a quarter of top speed");
  round.input.up = false;
  round.input.down = true;
  round.x = 2 / 3;
  drive.advance(round, 1000, still);
  assert.equal(round.speed, 0, "the brakes stop it");
});

test("Sunset Drive: space burns one nitro can for a higher top speed, one at a time, and none with the cans gone", () => {
  const round = straight(drive.newRound(still));
  round.speed = drive.MAX_SPEED;
  round.input.up = true;
  assert.equal(drive.boost(round), true);
  assert.equal(round.nitro, drive.START_NITRO - 1);
  assert.equal(drive.boost(round), false, "one can at a time");
  drive.advance(round, 1500, still);
  assert.ok(round.speed > drive.MAX_SPEED * 1.2, "past top speed while it burns");
  drive.advance(round, drive.NITRO_MS + 2000, still);
  assert.equal(round.speed, drive.MAX_SPEED, "and back to top speed after");
  round.nitro = 0;
  assert.equal(drive.boost(round), false, "no cans, no nitro");
});

test("Sunset Drive: a car caught up with is a crash, and a car passed close at speed is a close call", () => {
  const round = quiet(drive.newRound(still));
  const slow = drive.MAX_SPEED * 0.3;
  round.cars[0] = { z: round.pos + drive.PLAYER_Z + 60, x: 0, speed: slow, kind: "car", color: "#fff", ahead: true };
  round.speed = drive.MAX_SPEED;
  drive.advance(round, 16, still);
  assert.equal(driveEvents(round, "crash").length, 1);
  assert.ok(round.speed < slow, "you drop below its speed");
  assert.ok(round.cars[0].z > round.pos + drive.PLAYER_Z, "just behind it");

  round.events = [];
  round.cars[0] = { z: round.pos + drive.PLAYER_Z + 40, x: 0.5, speed: slow, kind: "car", color: "#fff", ahead: true };
  round.speed = drive.MAX_SPEED;
  round.input.up = true;
  drive.advance(round, 100, still);
  assert.equal(driveEvents(round, "crash").length, 0, "half a lane over is clear");
  const [close] = driveEvents(round, "close");
  assert.equal(close.points, drive.CLOSE_POINTS);
  assert.equal(round.closeCalls, 1);
});

test("Sunset Drive: coins, clocks and nitro cans are picked up from the lane you drive in", () => {
  const round = quiet(drive.newRound(still));
  const at = driveIndex(round) - round.first;
  round.segs[at + 1].items.push({ kind: "coin", offset: 0 });
  round.segs[at + 2].items.push({ kind: "clock", offset: 0 });
  round.segs[at + 3].items.push({ kind: "nitro", offset: 0 });
  round.segs[at + 4].items.push({ kind: "coin", offset: 2 / 3 });
  round.speed = drive.MAX_SPEED / 2;
  round.input.up = true;
  const time = round.time;
  drive.advance(round, 400, still);
  assert.equal(round.coins, 1, "the coin in the next lane stays");
  assert.equal(driveEvents(round, "coin")[0].points, drive.COIN_POINTS);
  assert.ok(round.time > time + drive.CLOCK_MS - 500, "a clock adds five seconds");
  assert.equal(round.nitro, drive.START_NITRO + 1);
  assert.equal(round.segs[at + 4].items.length, 1);
});

test("Sunset Drive: the side you keep to as the road splits picks the next road, the median holds you to it, and the checkpoint adds time and points", () => {
  const round = quiet(drive.newRound(still));
  const { left, right } = round.fork;
  round.pos = (round.forkAt - 2) * drive.SEG - drive.PLAYER_Z;
  round.x = -0.8;
  round.speed = drive.MAX_SPEED / 2;
  round.input.up = true;
  drive.advance(round, 200, still);
  assert.deepEqual(driveEvents(round, "choose").map((e) => e.region), [left], "keeping left takes the left road");
  assert.equal(round.side, -1);
  assert.ok(round.pending.forkAt > round.gateAt, "the next stage is built on behind the checkpoint");
  assert.equal(round.segs.at(-1).region, left, "in its own scenery");

  round.pos = (round.forkAt + drive.FORK_LEN / 2) * drive.SEG - drive.PLAYER_Z;
  round.x = 0.2;
  drive.advance(round, 8, still);
  const seg = drive.segAt(round, round.pos + drive.PLAYER_Z);
  assert.ok(round.x < -seg.median, "the median pushes you back to your side");
  assert.equal(driveEvents(round, "scrape").length, 1);

  const time = round.time;
  const points = round.points;
  round.pos = (round.gateAt - 1) * drive.SEG - drive.PLAYER_Z;
  round.x = -0.6;
  drive.advance(round, 400, still);
  assert.equal(round.stage, 2);
  assert.equal(round.region, left);
  assert.notEqual(round.region, right);
  const [check] = driveEvents(round, "checkpoint");
  assert.equal(check.ms, drive.checkTime(2));
  assert.equal(check.points, drive.CHECK_POINTS);
  assert.ok(round.time > time + drive.checkTime(2) - 1000, "the clock gains the checkpoint's time");
  assert.ok(round.points >= points + drive.CHECK_POINTS);
  assert.equal(round.pending, null);
  assert.ok(round.forkAt > driveIndex(round), "and a new fork waits ahead");
});

test("Sunset Drive: every stage puts power-up boxes on the road; a box queues its power-up, up to three, and one past that pays points", () => {
  const round = drive.newRound(still);
  const boxes = round.segs.flatMap((seg) => seg.items.filter((it) => it.kind === "power"));
  assert.ok(boxes.length >= 2, `boxes on the first stage (${boxes.length})`);
  assert.ok(boxes.every((b) => drive.POWER_ORDER.includes(b.power)), "each holds a known power-up");
  quiet(round);
  const at = driveIndex(round) - round.first;
  const ids = ["ghost", "hop", "magnet", "storm"];
  ids.forEach((id, k) => round.segs[at + 1 + k].items.push({ kind: "power", power: id, offset: round.x }));
  round.speed = drive.MAX_SPEED / 2;
  drive.advance(round, 400, still);
  assert.deepEqual(round.powers, ["ghost", "hop", "magnet"], "queued in the order picked up, three at most");
  assert.equal(driveEvents(round, "box").length, drive.MAX_POWERS);
  assert.equal(driveEvents(round, "spare")[0].points, drive.POWER_SPARE, "the fourth pays points");
});

test("Sunset Drive: a power-up fires the oldest held first, ahead of nitro, a timed one runs out, and one fired again while it runs adds its time", () => {
  const round = straight(drive.newRound(still));
  round.powers = ["ghost", "magnet", "ghost"];
  assert.equal(drive.usePower(round), true);
  assert.deepEqual(round.powers, ["magnet", "ghost"], "first in, first out");
  assert.equal(round.active.ghost, drive.POWERS.ghost.ms);
  assert.equal(round.nitro, drive.START_NITRO, "no nitro burned");
  drive.usePower(round);
  drive.advance(round, 1000, still);
  drive.usePower(round);
  assert.equal(round.active.ghost, drive.POWERS.ghost.ms * 2 - 1000, "a second ghost adds to the first");
  assert.equal(round.activeMax.ghost, drive.POWERS.ghost.ms * 2);
  assert.equal(drive.usePower(round), false, "none left");
  drive.advance(round, drive.POWERS.magnet.ms, still);
  assert.equal(round.active.magnet, undefined, "the magnet ran out");
  assert.ok(driveEvents(round, "powerend").some((e) => e.id === "magnet"));
  round.powers = ["hop"];
  round.time = 0;
  drive.advance(round, 8, still);
  assert.equal(drive.usePower(round), false, "none once the time is up");
});

test("Sunset Drive: a Rocket Hop and a Ghost Car pass cars and props untouched, a Monster Truck flings cars for points and flattens props, and a Coin Magnet reaches across the road", () => {
  for (const id of ["hop", "ghost", "monster"]) {
    const round = quiet(drive.newRound(still));
    round.powers = [id];
    drive.usePower(round);
    round.cars[0] = { z: round.pos + drive.PLAYER_Z + 60, x: round.x, speed: drive.MAX_SPEED * 0.3, kind: "car", color: "#fff", ahead: true };
    round.speed = drive.MAX_SPEED;
    drive.advance(round, 100, still);
    assert.equal(driveEvents(round, "crash").length, 0, `${id}: no crash`);
    assert.ok(round.speed > drive.MAX_SPEED * 0.9, `${id}: no slowing`);
    if (id === "monster") assert.equal(driveEvents(round, "fling")[0].points, drive.FLING_POINTS, "the car is flung for points");
    const at = driveIndex(round) - round.first;
    round.segs[at + 1].props.push({ kind: "rock", offset: round.x, text: null, seed: 0 });
    drive.advance(round, 100, still);
    assert.equal(driveEvents(round, "smash").length, 0, `${id}: no smash on a rock`);
    if (id === "monster") assert.equal(driveEvents(round, "flatten").length, 1, "the rock is flattened");
  }
  const round = quiet(drive.newRound(still));
  round.x = -2 / 3;
  round.powers = ["magnet"];
  drive.usePower(round);
  const at = driveIndex(round) - round.first;
  round.segs[at + 1].items.push({ kind: "coin", offset: 2 / 3 });
  round.speed = drive.MAX_SPEED / 2;
  drive.advance(round, 200, still);
  assert.equal(round.coins, 1, "a coin two lanes over comes to the magnet");
});

test("Sunset Drive: a Coin Storm turns the cars ahead into coins and sends them far down the road", () => {
  const round = quiet(drive.newRound(still));
  const pz = round.pos + drive.PLAYER_Z;
  round.cars[0] = { z: pz + drive.SEG * 20, x: 0, speed: 0, kind: "car", color: "#fff", ahead: true };
  round.cars[1] = { z: pz + drive.SEG * 40, x: 2 / 3, speed: 0, kind: "truck", color: "#fff", ahead: true };
  round.powers = ["storm"];
  drive.usePower(round, still);
  assert.equal(driveEvents(round, "storm")[0].cars, 2);
  assert.ok(round.cars[0].z > pz + drive.SEG * drive.DRAW * 0.8 && round.cars[1].z > pz + drive.SEG * drive.DRAW * 0.8, "both cars sent far ahead");
  const coins = round.segs.flatMap((seg) => seg.items.filter((it) => it.kind === "coin"));
  assert.equal(coins.length, 6, "three coins where each car was");
  assert.equal(round.active.storm, undefined, "a storm is over at once");
});

test("Sunset Drive: a checkpoint adds a little less time each stage, never under 18 seconds", () => {
  assert.ok(drive.checkTime(3) < drive.checkTime(2));
  assert.equal(drive.checkTime(50), 18000);
});

test("Sunset Drive: out of time the car coasts to a stop and the round is over", () => {
  const round = quiet(drive.newRound(still));
  round.time = 1500;
  round.lastSecond = 2;
  round.speed = drive.MAX_SPEED;
  round.input.up = true;
  drive.advance(round, 1000, still);
  assert.deepEqual(driveEvents(round, "hurry").map((e) => e.sec), [1], "the last second is called");
  drive.advance(round, 600, still);
  assert.equal(driveEvents(round, "timeup").length, 1);
  assert.equal(round.over, false, "it coasts first");
  assert.equal(drive.boost(round), false, "no nitro once the time is up");
  assert.equal(drive.advance(round, drive.COAST_MS, still), "over");
  assert.equal(driveEvents(round, "over").length, 1);
});

test("Sunset Drive: every pill's text reads at 4.5:1 on its backing and its timer's tint, the low clock and a burning nitro included, in light and dark under every highlight", () => {
  checkPills(drive.default, {
    setup: (r) => {
      r.time = 5000;
      r.nitroMs = drive.NITRO_MS / 2;
      r.powers = ["magnet", "hop"];
      for (const id of drive.POWER_ORDER.filter((p) => drive.POWERS[p].ms)) {
        r.active[id] = drive.POWERS[id].ms / 2;
        r.activeMax[id] = drive.POWERS[id].ms;
      }
    },
    expect: ["TIME 5", "STAGE 1", "~NITRO!", "SPACE: MAGNET +1", "~HOP!", "~GHOST!", "~MAGNET!", "~MONSTER!"],
  });
});

test("Sunset Drive: starting a round finds Sunset Coast for the tally, held keys drive until let go, and a pause lets go of them all", () => {
  const { canvas } = stubCanvas();
  let saved = 0;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const g = drive.default.create({ canvas, memo });
  assert.equal(g.resize(1024, 576), true);
  assert.equal(saved, 0, "nothing before a round");
  g.key("action");
  assert.equal(g.state, "running");
  assert.equal(saved, 1 << drive.REGION_ORDER.indexOf("coast"));
  g.key("up");
  assert.equal(g.round.input.up, true, "up held drives");
  g.release("up");
  assert.equal(g.round.input.up, false, "and let go stops");
  g.key("action");
  assert.equal(g.round.nitro, drive.START_NITRO - 1, "space in a round is nitro");
  g.round.powers = ["ghost"];
  g.round.nitroMs = 0;
  g.key("action");
  assert.equal(g.round.nitro, drive.START_NITRO - 1, "with a power-up held, space fires it instead");
  assert.ok(g.round.active.ghost > 0);
  // The fork's postcards, and the car in the air, draw without a hitch.
  g.round.warned = true;
  g.round.powers = ["hop", "monster"];
  g.key("action");
  g.key("action");
  g.tick(400);
  assert.ok(drive.hopHeight(g.round) > 0, "the hop has the car in the air");
  g.key("left");
  g.pause();
  assert.equal(g.round.input.left, false, "a pause lets go of every key");
  assert.equal(g.resize(drive.W * drive.MIN_CELL - 1, 600), false, "too narrow to play");
});

/* ------------------------------------------------------ Stack Deploy rules */

// The top of the tower, and a slider put exactly `offset` units from it (a
// plus is to the right).
const stackTop = (round) => round.blocks[round.blocks.length - 1];
const aim = (round, offset) => {
  round.slider.x = stackTop(round).x + offset;
  return round;
};
const stackEvents = (round, type) => round.events.filter((e) => e.type === type);

test("Stack Deploy: a round opens on the base, with a block as wide sliding in from the left wall", () => {
  const round = stack.newRound(still);
  assert.equal(round.blocks.length, 1);
  assert.equal(round.blocks[0].w, stack.BASE_W);
  assert.equal(round.blocks[0].x, (stack.W - stack.BASE_W) / 2, "the base sits in the middle");
  assert.equal(round.floor, 0);
  assert.equal(round.score, 0);
  assert.equal(round.slider.floor, 1);
  assert.equal(round.slider.w, stack.BASE_W);
  assert.equal(round.slider.x, 0);
  assert.equal(round.slider.dir, 1);
  stack.advance(round, 100);
  assert.ok(Math.abs(round.slider.x - stack.speedAt(1) * 0.1) < 1e-9, "it slides at the floor's speed");
});

test("Stack Deploy: a drop at exact center is perfect, slices nothing and scores the perfect bonus", () => {
  const round = aim(stack.newRound(still), 0);
  const r = stack.drop(round, still);
  assert.deepEqual(r, { kept: stack.BASE_W, sliced: 0, perfect: true, miss: false });
  assert.equal(round.floor, 1);
  assert.equal(stackTop(round).w, stack.BASE_W);
  assert.equal(round.score, stack.FLOOR_POINTS + stack.PERFECT_POINTS);
  assert.equal(round.streak, 1);
  assert.equal(stackEvents(round, "perfect").length, 1);
  // Just inside the zone snaps on too, exactly over the block below.
  const zone = stack.zoneOf(round);
  aim(round, zone * 0.9);
  assert.equal(stack.drop(round, still).perfect, true);
  assert.equal(stackTop(round).x, round.blocks[1].x, "a perfect snaps on");
  assert.equal(round.score, 2 * stack.FLOOR_POINTS + stack.PERFECT_POINTS * 3, "the second in a row is worth twice the bonus");
});

test("Stack Deploy: a drop half off keeps half, slices the overhang off the side it hung over, and breaks the run", () => {
  const round = aim(stack.newRound(still), 0);
  stack.drop(round, still);
  const half = stack.BASE_W / 2;
  const left = stackTop(round).x;
  aim(round, half);
  const r = stack.drop(round, still);
  assert.equal(r.perfect, false);
  assert.equal(r.miss, false);
  assert.ok(Math.abs(r.kept - half) < 1e-9 && Math.abs(r.sliced - half) < 1e-9, "half kept, half sliced");
  assert.ok(Math.abs(stackTop(round).x - (left + half)) < 1e-9, "the kept part is the part over the block below");
  assert.equal(round.slider.w, stackTop(round).w, "the next block is as narrow");
  assert.equal(round.streak, 0);
  const [drop] = stackEvents(round, "drop");
  assert.equal(drop.piece.dir, 1, "the overhang falls off the right");
  assert.ok(Math.abs(drop.piece.x - (left + stack.BASE_W)) < 1e-9);
  // The other way: the overhang is on the left.
  aim(round, -1);
  stack.drop(round, still);
  assert.equal(stackEvents(round, "drop")[1].piece.dir, -1);
});

test("Stack Deploy: a drop with no overlap misses, holds for the outro, then ends the round", () => {
  const round = aim(stack.newRound(still), stack.BASE_W + 1);
  const r = stack.drop(round, still);
  assert.deepEqual(r, { kept: 0, sliced: stack.BASE_W, perfect: false, miss: true });
  assert.equal(round.lost, true);
  assert.equal(round.slider, null);
  assert.equal(round.floor, 0, "a miss is no floor");
  assert.equal(stack.drop(round, still), null, "nothing left to drop");
  assert.equal(stack.advance(round, stack.OUTRO_MS - 10), "running", "the tower is shown first");
  assert.equal(stack.advance(round, 20), "over");
  // A sliver thinner than MIN_W is a miss too.
  const thin = aim(stack.newRound(still), stack.BASE_W - stack.MIN_W / 2);
  assert.equal(stack.drop(thin, still).miss, true);
});

test("Stack Deploy: three perfects in a row grow the block back, never past the base, and a gold perfect grows it twice as much", () => {
  const round = aim(stack.newRound(still), 0);
  stack.drop(round, still);
  aim(round, 10);
  stack.drop(round, still);
  const narrow = stackTop(round).w;
  assert.ok(Math.abs(narrow - (stack.BASE_W - 10)) < 1e-9);
  for (let i = 0; i < 2; i++) {
    aim(round, 0);
    stack.drop(round, still);
    assert.equal(stackTop(round).w, narrow, "no growth before the third");
  }
  aim(round, 0);
  stack.drop(round, still);
  assert.ok(Math.abs(stackTop(round).w - (narrow + stack.GROW)) < 1e-9, "the third grows it");
  assert.equal(round.slider.w, stackTop(round).w, "and the next block is as wide");
  assert.ok(stackEvents(round, "perfect").at(-1).grew > 0);
  // Gold: twice the growth and the gold bonus.
  round.slider.gold = true;
  aim(round, 0);
  const before = { w: stackTop(round).w, score: round.score };
  stack.drop(round, still);
  assert.ok(Math.abs(stackTop(round).w - (before.w + stack.GROW * 2)) < 1e-9);
  assert.equal(round.score - before.score, stack.FLOOR_POINTS + stack.PERFECT_POINTS * 4 + stack.GOLD_POINTS);
  // At the base's width, growing does nothing, and the block stays on the board.
  for (let i = 0; i < 12; i++) stack.drop(aim(round, 0), still);
  assert.equal(stackTop(round).w, stack.BASE_W, "never past the base");
  assert.equal(stack.grow(round), 0);
  const edge = stackTop(round);
  edge.x = 0;
  edge.w = 10;
  stack.grow(round, 6);
  assert.ok(edge.x >= 0 && edge.x + edge.w <= stack.W, "a grow by the wall stays on the board");
});

test("Stack Deploy: the run multiplies the perfect bonus up to x5, and the drop's pitch climbs with it", () => {
  const round = stack.newRound(still);
  const gains = [];
  for (let i = 0; i < 7; i++) {
    const before = round.score;
    stack.drop(aim(round, 0), still);
    gains.push(round.score - before);
  }
  assert.deepEqual(gains, [1, 2, 3, 4, 5, 5, 5].map((k) => stack.FLOOR_POINTS + stack.PERFECT_POINTS * k));
  assert.equal(round.bestStreak, 7);
  assert.equal(stack.comboPitch(0), 1);
  assert.ok(stack.comboPitch(1) > stack.comboPitch(0) && stack.comboPitch(7) === 2, "a step a perfect, an octave at seven");
  assert.equal(stack.comboPitch(99), stack.comboPitch(14), "and it tops out");
});

test("Stack Deploy: the slide is steady to floor 9, 2% quicker a floor from 10, stops at the cap, and faster again from 90", () => {
  assert.equal(stack.speedAt(1), stack.speedAt(9));
  assert.ok(stack.speedAt(10) > stack.speedAt(9));
  for (let f = 10; f < 55; f++) assert.ok(stack.speedAt(f + 1) > stack.speedAt(f), `floor ${f + 1} is quicker`);
  assert.ok(Math.abs(stack.speedAt(11) / stack.speedAt(10) - 1.02) < 1e-9);
  assert.equal(stack.speedAt(70), stack.speedAt(89), "capped");
  assert.ok(stack.speedAt(90) > stack.speedAt(89));
  assert.equal(stack.speedAt(90), stack.speedAt(200));
});

test("Stack Deploy: twists and styles arrive by floor and are announced once, and sides take turns until the mix-up", () => {
  assert.deepEqual(stack.twistsAt(1), ["plain"]);
  assert.deepEqual(stack.twistsAt(30), ["plain", "ramp", "turn", "lag"]);
  assert.ok(stack.twistsAt(40).includes("wind"));
  assert.deepEqual([1, 24, 25, 50, 75].map((f) => stack.styleAt(f).id), ["racks", "racks", "offices", "glass", "rockets"]);
  assert.equal(stack.styleAt(0).id, "racks", "the base is a rack");
  const round = stack.newRound(still);
  const sides = [];
  for (let i = 0; i < 6; i++) {
    const s = round.slider;
    sides.push(s.dir);
    assert.equal(s.x, s.dir > 0 ? 0 : stack.W - s.w, "each starts at its own wall");
    stack.drop(aim(round, 0), still);
  }
  assert.deepEqual(sides, [1, -1, 1, -1, 1, -1], "left, right, left...");
  // Straight to floor 9, then floor 10 announces its twist and floor 25 its style.
  round.floor = 9;
  round.events.length = 0;
  stack.spawnBlock(round, still);
  assert.deepEqual(stackEvents(round, "twist").map((e) => e.id), ["ramp"]);
  round.floor = 10;
  stack.spawnBlock(round, still);
  assert.equal(stackEvents(round, "twist").length, 1, "only on the floor it starts");
  round.floor = 24;
  stack.spawnBlock(round, still);
  assert.deepEqual(stackEvents(round, "style").map((e) => e.id), ["offices"]);
  // From 20 the side is a toss: with a random under a half, it comes from the left twice running.
  round.floor = 30;
  const low = () => 0.1;
  stack.spawnBlock(round, low);
  stack.spawnBlock(round, low);
  assert.equal(round.slider.dir, 1);
  assert.equal(round.slider.x, 0);
});

test("Stack Deploy: from floor 20 a block may turn back partway, and from 30 a lag spike holds it for LAG_MS, then it jumps", () => {
  const round = stack.newRound(still);
  round.floor = 29;
  const low = () => 0.1;
  const s = stack.spawnBlock(round, low);
  assert.ok(s.turnAt !== null && s.lagAt !== null, "a low random turns it back and spikes it");
  // Narrow and from the left wall, so no wall is met before the jump.
  Object.assign(s, { turnAt: null, w: 8, x: 0, dir: 1 });
  stack.advance(round, s.lagAt - 1);
  const at = s.x;
  stack.advance(round, stack.LAG_MS - 10);
  assert.ok(stack.frozen(s), "frozen");
  assert.ok(Math.abs(s.x - at) < s.speed * 0.01, "and still");
  stack.advance(round, 20);
  assert.equal(stack.frozen(s), false);
  assert.ok(s.x - at > s.speed * ((stack.LAG_MS - 20) / 1000), "it jumped to where it would have been");
  assert.equal(stackEvents(round, "lag").length, 1);
  // A turn back: it reverses before it reaches the far wall.
  const turner = stack.newRound(still);
  turner.floor = 25;
  const t = stack.spawnBlock(turner, low);
  t.lagAt = null;
  const from = t.dir;
  stack.advance(turner, (t.turnAt * (stack.W - t.w) * 1000) / t.speed + 30);
  assert.equal(t.dir, -from, "it turned back");
  assert.ok(t.x > 0 && t.x < stack.W - t.w, "partway across");
});

test("Stack Deploy: the perfect zone is 3% of the block, at least the slide in PERFECT_MS, never under the screen's floor and never over half the block", () => {
  const round = stack.newRound(still);
  const s = round.slider;
  assert.equal(stack.zoneOf(round), Math.max(s.w * stack.PERFECT, (s.speed * stack.PERFECT_MS) / 1000));
  s.w = 2;
  assert.equal(stack.zoneOf(round), (s.speed * stack.PERFECT_MS) / 1000, "a narrow block keeps a zone it can be timed into");
  s.w = 10;
  round.minZone = 3;
  assert.equal(stack.zoneOf(round), 3);
  assert.equal(stack.isPerfect(round, 2.9), true);
  assert.equal(stack.isPerfect(round, -3.1), false);
  s.w = 2;
  assert.equal(stack.zoneOf(round), 1, "half the block at most");
});

test("Stack Deploy: a narrow, fast block dropped clear of the tower misses, however wide its zone would be", () => {
  const round = stack.newRound(still);
  round.floor = 59;
  stackTop(round).w = 0.5;
  const s = stack.spawnBlock(round, still);
  assert.ok((s.speed * stack.PERFECT_MS) / 1000 > s.w, "the slide in PERFECT_MS is wider than the block");
  round.minZone = 1;
  aim(round, 0.6);
  const r = stack.drop(round, still);
  assert.equal(r.miss, true, "no overlap ends the round");
  assert.equal(r.perfect, false);
  assert.equal(round.streak, 0);
  // Just inside half the block still snaps on.
  const near = stack.newRound(still);
  near.floor = 59;
  stackTop(near).w = 0.5;
  stack.spawnBlock(near, still);
  aim(near, 0.24);
  assert.equal(stack.drop(near, still).perfect, true);
});

test("Stack Deploy: gold blocks turn up only from GOLD_FROM", () => {
  const round = stack.newRound(still);
  const low = () => 0.01;
  round.floor = stack.GOLD_FROM - 2;
  assert.equal(stack.spawnBlock(round, low).gold, false, "never before");
  round.floor = stack.GOLD_FROM - 1;
  assert.equal(stack.spawnBlock(round, low).gold, true, "a low random from there on");
  assert.equal(stack.spawnBlock(round, still).gold, false, "and only now and then");
});

test("Stack Deploy: every pill's text reads at 4.5:1 on its backing and its tint, the run of perfects included, in light and dark under every highlight", () => {
  checkPills(stack.default, {
    setup: (r) => {
      r.streak = 2;
    },
    expect: ["FLOOR", "~x2 PERFECT"],
  });
});

test("Stack Deploy game: a press drops the block where it is drawn, waits for a first tick after a start or a play-on, and a pause holds the block still", () => {
  const { canvas, calls } = stubCanvas();
  const g = stack.default.create({ canvas });
  assert.equal(g.resize(stack.W * 10, stack.H * 10), true);
  g.key("action");
  assert.equal(g.state, "running");
  g.key("action");
  assert.equal(g.round.floor, 0, "the key that starts a round never also drops");
  g.tick(16);
  const x = g.round.slider.x;
  assert.ok(x > 0);
  g.key("up");
  assert.equal(g.round.floor, 1, "up drops");
  const kept = g.round.blocks[1];
  assert.ok(Math.abs(kept.x + kept.w - Math.min(x + stack.BASE_W, g.round.blocks[0].x + stack.BASE_W)) < 1e-9, "at the place it was drawn");
  g.tick(16);
  aim(g.round, 0);
  assert.equal(g.pointer("down", 10, 10), true, "a press on the board drops too");
  assert.equal(g.round.floor, 2);
  assert.equal(g.pointer("move", 10, 10), false);
  g.tick(40);
  g.pause();
  const held = { x: g.round.slider.x, calls: calls.count };
  g.tick(5000);
  assert.deepEqual({ x: g.round.slider.x, calls: calls.count }, held, "paused, nothing moves");
  g.resume();
  g.key("up");
  assert.equal(g.round.floor, 2, "an arrow that plays on does not drop");
  g.tick(16);
  assert.ok(Math.abs(g.round.slider.x - held.x) <= g.round.slider.speed * 0.017, "it picks up where it was");
  assert.equal(g.key("left"), false, "no use for steering");
  assert.equal(g.resize(stack.W * stack.MIN_CELL - 1, 600), false, "too narrow to play");
});

test("Stack Deploy game: a held up drops once until it is let go, and a resize sets the on-screen floor of the perfect zone", () => {
  const { canvas } = stubCanvas();
  const g = stack.default.create({ canvas });
  assert.equal(g.resize(stack.W * 10, stack.H * 10), true);
  assert.equal(g.round.minZone, stack.MIN_ZONE_PX / 10, "MIN_ZONE_PX in units at 10 px a unit");
  g.key("action");
  g.tick(16);
  aim(g.round, 0);
  g.key("up");
  assert.equal(g.round.floor, 1);
  g.tick(16);
  aim(g.round, 0);
  assert.equal(g.key("up"), true, "a key repeat is taken");
  assert.equal(g.round.floor, 1, "but drops nothing");
  g.release("up");
  g.tick(16);
  aim(g.round, 0);
  assert.equal(g.key("up", true), true, "a repeat the window marks is taken");
  assert.equal(g.round.floor, 1, "but drops nothing, even with up let go (held through the countdown)");
  g.key("up");
  assert.equal(g.round.floor, 2, "a fresh press drops");
  assert.equal(g.resize(stack.W * 20, stack.H * 20), true);
  assert.equal(g.round.minZone, stack.MIN_ZONE_PX / 20);
});

test("Stack Deploy game: the start screen names the style reached once, past the rockets too, and squeezes its lines to the board", () => {
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : name === "fillText" ? (text, x, y, max) => texts.push({ text, max }) : () => {}),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  const g = stack.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, memo: { get: () => 80, set() {} } });
  assert.equal(g.resize(stack.W * 10, stack.H * 10), true);
  const line = texts.find((t) => t.text.startsWith("Highest floor 80"));
  assert.ok(line, "the start screen names the highest floor");
  assert.equal(line.text, "Highest floor 80: you have reached the rockets. Now beat your best!");
  assert.ok(line.max > 0 && line.max <= stack.W * 10, "kept within the board");
});

test("Stack Deploy game: passing the highest floor ever reached sounds the fanfare once", () => {
  const { canvas } = stubCanvas();
  const tones = [];
  const memo = { get: () => 2, set() {} };
  const g = stack.default.create({ canvas, memo, tone: (name) => tones.push(name) });
  g.resize(800, 600);
  g.key("action");
  g.tick(16);
  for (let i = 0; i < 5; i++) {
    aim(g.round, 0);
    g.key("action");
    g.tick(16);
    assert.equal(tones.filter((n) => n === "ace").length, g.round.floor > 2 ? 1 : 0, `at floor ${g.round.floor}`);
  }
});

test("Stack Deploy game: a miss ends the round after the outro with onScore once, and the memo keeps the highest floor, only ever growing", () => {
  const { canvas, calls } = stubCanvas();
  let saved = 3;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = stack.default.create({ canvas, memo, onScore: (n) => scores.push(n) });
  assert.equal(g.resize(800, 600), true);
  assert.ok(calls.count > 0, "the start screen draws");
  assert.equal(saved, 3, "nothing is written by just opening it");
  const climb = (floors) => {
    g.key("action");
    g.tick(16);
    for (let i = 0; i < floors; i++) {
      aim(g.round, 0);
      g.key("action");
      g.tick(16);
    }
    aim(g.round, stack.BASE_W + 2);
    g.key("action");
    assert.equal(g.round.lost, true);
    g.tick(stack.OUTRO_MS / 2);
    assert.equal(g.state, "running", "the outro plays first");
    g.tick(stack.OUTRO_MS);
    assert.equal(g.state, "over");
  };
  climb(5);
  assert.equal(scores.length, 1);
  assert.equal(scores[0], g.score);
  assert.equal(saved, 5, "the highest floor");
  g.tick(1000);
  assert.equal(scores.length, 1, "once");
  climb(2);
  assert.equal(saved, 5, "a lower round leaves it");
  assert.equal(scores.length, 2);
  // A pause mid-round keeps a new height too.
  g.key("action");
  g.tick(16);
  for (let i = 0; i < 7; i++) {
    aim(g.round, 0);
    g.key("action");
    g.tick(16);
  }
  g.pause();
  assert.equal(saved, 7);
});

/* ------------------------------------------------------ Bumper Ring rules */

// A fixed random source: no rival ever misjudges by chance (one at
// sharpness 0.3 needs a roll under 0.084) and every spread lands mid-way.
const calm = () => 0.5;

// A heat at `arena`, past its hold, with only the cars asked for kept (by
// their spot in the arena's lineup, you first), each rival left thinking on
// its own unless `still` says otherwise.
function ring(arena = 1, keep = null, { still = true } = {}) {
  const round = bumper.newRound(calm);
  round.level = arena;
  bumper.newHeat(round, calm, 0);
  bumper.advance(round, 4, calm);
  assert.equal(round.phase, "fight");
  if (keep) round.cars = keep.map((i) => round.cars[i]);
  if (still) for (const c of round.cars) if (c.id !== 0) Object.assign(c, { think: 1e9, push: { x: 0, y: 0 } });
  round.events.length = 0;
  return round;
}

const put = (car, x, y, vx = 0, vy = 0) => Object.assign(car, { x, y, vx, vy });

// A heat with you and one rival parked in the dead middle as a ghost, where
// no floor moves it and nothing hits it, so the heat stays on.
function alone(arena) {
  const round = ring(arena, [0, 1]);
  put(round.cars[1], bumper.CX, bumper.CY);
  round.cars[1].fx.ghost = 1e9;
  return round;
}
const bumpEvents = (round, type) => round.events.filter((e) => e.type === type);
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

test("Bumper Ring: a round opens on the Training Mat with three lives, two dashes and the Bully across the ring", () => {
  const round = bumper.newRound(calm);
  assert.equal(round.level, 1);
  assert.equal(round.lives, bumper.START_LIVES);
  assert.equal(round.phase, "ready");
  assert.equal(round.R, bumper.RING_R);
  assert.deepEqual(round.cars.map((c) => c.kind), ["planny", "bully"]);
  const [you, bully] = round.cars;
  assert.equal(you.charges, bumper.START_CHARGES);
  assert.ok(you.y > bumper.CY && bully.y < bumper.CY, "you at the bottom, the Bully at the top");
  for (const c of round.cars) assert.ok(bumper.edgeGap(round, c.x, c.y) > 20, "everyone starts well clear of the edge");
  assert.equal(bumper.ARENAS[1].title, "Training Mat");
});

test("Bumper Ring: two equal cars meeting head-on bounce back evenly, and nobody is the rammer", () => {
  const round = ring(1);
  const [a, b] = round.cars;
  put(a, 60, 50, 40, 0);
  put(b, 60 + bumper.CAR_R * 2 - 0.5, 50, -40, 0);
  const hit = bumper.collide(a, b);
  assert.equal(hit.rammer, null);
  assert.ok(near(hit.speed, 80));
  assert.ok(near(a.vx, -b.vx), "the same speed back each way");
  assert.ok(near(b.vx, 40 * bumper.BOUNCE), "restitution BOUNCE");
  assert.ok(near(a.x + b.x, 120 + bumper.CAR_R * 2 - 0.5), "pushed apart evenly");
  assert.ok(near(b.x - a.x, bumper.CAR_R * 2), "until they just touch");
});

test("Bumper Ring: the faster car rams, giving SHOVE_BONUS more and taking that much less back, and a slow lean is no hit at all", () => {
  const round = ring(1);
  const [a, b] = round.cars;
  put(a, 60, 50, 50, 0);
  put(b, 67.9, 50, -20, 0);
  const hit = bumper.collide(a, b);
  assert.equal(hit.rammer, a);
  const j = ((1 + bumper.BOUNCE) * 70) / 2;
  assert.ok(near(b.vx, -20 + j * (1 + bumper.SHOVE_BONUS)));
  assert.ok(near(a.vx, 50 - j * (1 - bumper.SHOVE_BONUS)));
  assert.ok(a.vx > 0, "the rammer follows through");
  assert.ok(b.vx > 50, "the one rammed flies off faster than the rammer came in");
  // Leaning in under IMPACT_SPEED: no bounce and no shove, they just move as one.
  put(a, 60, 50, 6, 0);
  put(b, 67.9, 50, 0, 0);
  const lean = bumper.collide(a, b);
  assert.equal(lean.rammer, null);
  assert.ok(near(a.vx, 3) && near(b.vx, 3));
  // Apart, nothing happens.
  put(b, 80, 50, 0, 0);
  assert.equal(bumper.collide(a, b), null);
});

test("Bumper Ring: a dash beats a Turtle holding its ground only with Heavy or Spring", () => {
  const run = (power) => {
    const round = ring(2, [0, 2]);
    const [you, turtle] = round.cars;
    assert.equal(turtle.kind, "turtle");
    const x = bumper.CX + bumper.RING_R - 9;
    put(turtle, x, bumper.CY);
    turtle.push = { x: -1, y: 0 };
    put(you, x - you.r - turtle.r - 0.01, bumper.CY);
    if (power) bumper.applyPower(round, you, power);
    assert.equal(bumper.dash(round, you, { x: 1, y: 0 }), true);
    bumper.advance(round, 2000, calm);
    return turtle.alive;
  };
  assert.equal(run(null), true, "a plain dash leaves it on the ring");
  assert.equal(run("heavy"), false, "Heavy shoves it off");
  assert.equal(run("spring"), false, "so does Spring");
  assert.ok(bumper.massOf({ mass: 1.6, fx: {}, dashMs: 0 }) < bumper.massOf({ mass: 1, fx: { heavy: 1 }, dashMs: 1 }), "a dashing Heavy car outweighs a Turtle");
});

test("Bumper Ring: a car at the edge heading out falls, one teetering can still be pushed back in, and a Shield bounces it back once", () => {
  const round = ring(1);
  const [you, bully] = round.cars;
  put(bully, bumper.CX - bumper.RING_R + 1, bumper.CY, -30, 0);
  put(you, bumper.CX, bumper.CY + 20);
  bumper.advance(round, 200, calm);
  assert.equal(bully.alive, false);
  assert.equal(bumpEvents(round, "fall").length, 1);
  assert.equal(bumper.outOfRing(round, bully), true);

  // Crawling out in the teeter band with the arrows pushing back in: saved.
  const r2 = alone(1);
  const [me] = r2.cars;
  put(me, bumper.CX + bumper.RING_R - 2, bumper.CY, 12, 0);
  r2.input.left = true;
  bumper.advance(r2, 600, calm);
  assert.equal(me.alive, true);
  assert.ok(me.x < bumper.CX + bumper.RING_R - 2, "back in");
  assert.equal(bumpEvents(r2, "teeter").length, 1, "the teeter is noted once");
  assert.equal(r2.close, true, "and the heat is no longer flawless");

  const r3 = ring(1);
  const [, b3] = r3.cars;
  bumper.applyPower(r3, b3, "shield");
  put(b3, bumper.CX - bumper.RING_R + 0.5, bumper.CY, -40, 0);
  bumper.advance(r3, 40, calm);
  assert.equal(b3.alive, true);
  assert.equal(b3.shield, false, "used up");
  assert.ok(b3.vx > 0, "bounced back in");
  assert.equal(bumpEvents(r3, "saved").length, 1);
});

test("Bumper Ring: a knockout is the last toucher's within CREDIT_MS, and nobody's after it", () => {
  const round = ring(3);
  const fallen = round.cars[2];
  round.clock = 10000;
  fallen.touch = { by: 0, via: null, at: round.clock - bumper.CREDIT_MS + 1 };
  let ko = bumper.creditKo(round, fallen);
  assert.equal(ko.by, 0);
  assert.equal(ko.points, bumper.KO_POINTS * 3, "times the arena");
  assert.equal(round.score, bumper.KO_POINTS * 3);
  fallen.touch = { by: 1, via: null, at: round.clock - 100 };
  ko = bumper.creditKo(round, fallen);
  assert.equal(ko.by, 1, "a rival's knockout");
  assert.equal(ko.points, 0, "scores you nothing");
  fallen.touch = { by: 1, via: 0, at: round.clock - 100 };
  assert.equal(bumper.creditKo(round, fallen).by, 0, "your hit carried through a rival: yours");
  fallen.touch = { by: 0, via: null, at: round.clock - bumper.CREDIT_MS - 1 };
  fallen.target = null;
  ko = bumper.creditKo(round, fallen);
  assert.equal(ko.by, null, "too long ago: nobody's");
  assert.equal(ko.points, 0);
  // A touch is noted on both cars by a collision.
  const r2 = ring(1);
  const [you, bully] = r2.cars;
  put(you, 60, 50, 40, 0);
  put(bully, 67.5, 50);
  bumper.advance(r2, 4, calm);
  assert.equal(bully.touch.by, 0);
  assert.equal(you.touch.by, bully.id);
});

test("Bumper Ring: knockouts within COMBO_MS step a combo up to x5, two within DOUBLE_MS both count twice, and a rival that falls chasing you untouched is bait", () => {
  const round = ring(1);
  const fallen = round.cars[1];
  const ko = (at) => {
    round.clock = at;
    fallen.touch = { by: 0, via: null, at };
    return bumper.creditKo(round, fallen);
  };
  let k = ko(5000);
  assert.deepEqual([k.combo, k.points, k.double], [1, 10, false]);
  k = ko(5500);
  assert.deepEqual([k.combo, k.points, k.double], [2, 40, true], "x2 combo, x2 double");
  assert.equal(round.score, 10 + 10 + 40, "the first KO counted again");
  k = ko(6000);
  assert.deepEqual([k.combo, k.points, k.double], [3, 60, true], "a third within DOUBLE_MS doubles too");
  assert.equal(round.score, 10 + 10 + 40 + 60, "but the second, already doubled, is not paid again");
  k = ko(8500);
  assert.deepEqual([k.combo, k.points, k.double], [4, 40, false]);
  for (let i = 1; i <= 3; i++) k = ko(8500 + i * 3000);
  assert.equal(k.combo, bumper.MAX_COMBO, "capped");
  k = ko(8500 + 4 * 3000 + bumper.COMBO_MS + 1);
  assert.equal(k.combo, 1, "a slow one starts again");
  assert.equal(round.kos, 8);
  assert.equal(round.bestCombo, bumper.MAX_COMBO);
  // Bait: nobody touched it, and it was after you.
  const before = round.score;
  fallen.touch = null;
  fallen.target = 0;
  k = bumper.creditKo(round, fallen);
  assert.equal(k.bait, true);
  assert.equal(round.score - before, bumper.BAIT_POINTS);
  fallen.target = null;
  assert.equal(bumper.creditKo(round, fallen).bait, false, "one that was after nobody is not");
});

test("Bumper Ring: a heat is won when one car is left, the next arena follows, and a fall costs a life and reruns the same arena", () => {
  const round = ring(1);
  const [you, bully] = round.cars;
  put(bully, bumper.CX + bumper.RING_R + 2, bumper.CY);
  bumper.advance(round, 8, calm);
  assert.equal(round.phase, "done");
  assert.equal(round.result, "win");
  const win = bumpEvents(round, "win")[0];
  assert.equal(win.flawless, true);
  assert.equal(win.points, bumper.WIN_POINTS + bumper.FLAWLESS_POINTS);
  assert.equal(round.heatsWon, 1);
  bumper.advance(round, bumper.DONE_MS, calm);
  assert.equal(round.level, 2);
  assert.equal(bumpEvents(round, "level")[0].level, 2);
  assert.equal(round.cars.length, 3, "a Turtle joins");

  bumper.advance(round, bumper.READY_MS, calm);
  round.events.length = 0;
  put(round.cars[0], bumper.CX, bumper.CY + bumper.RING_R + 2);
  bumper.advance(round, 8, calm);
  assert.equal(round.result, "lose");
  assert.equal(round.lives, bumper.START_LIVES - 1);
  bumper.advance(round, bumper.DONE_MS, calm);
  assert.equal(round.level, 2, "the same arena again");
  assert.equal(bumpEvents(round, "retry").length, 1);
  assert.equal(round.cars.every((c) => c.alive), true, "everyone back on");
  for (let life = round.lives; life > 0; life--) {
    bumper.advance(round, bumper.READY_MS, calm);
    put(round.cars[0], bumper.CX, bumper.CY + bumper.RING_R + 2);
    bumper.advance(round, 8 + bumper.DONE_MS, calm);
  }
  assert.equal(round.over, true, "the last life ends the round");
  assert.equal(you.alive, true, "the first heat's car was left behind");
});

test("Bumper Ring: you and the last rival off together is a draw, and nobody loses a life", () => {
  const round = ring(1);
  const [you, bully] = round.cars;
  put(you, bumper.CX, bumper.CY + bumper.RING_R + 1);
  put(bully, bumper.CX, bumper.CY - bumper.RING_R - 1);
  bumper.advance(round, 4, calm);
  assert.equal(round.result, "draw");
  assert.equal(round.lives, bumper.START_LIVES);
  bumper.advance(round, bumper.DONE_MS, calm);
  assert.equal(round.level, 1);
});

test("Bumper Ring: the ring holds for SHRINK_START_MS, shrinks SHRINK_STEP a step after a warning, holds at MIN_RING, then sudden death takes it to LAST_RING", () => {
  const round = ring(2);
  const every = bumper.ARENAS[2].shrinkMs;
  assert.equal(bumper.shrinkAt(round, 0), bumper.RING_R);
  assert.equal(bumper.shrinkAt(round, bumper.SHRINK_START_MS - 1), bumper.RING_R);
  assert.equal(bumper.shrinkAt(round, bumper.SHRINK_START_MS), bumper.RING_R - bumper.SHRINK_STEP);
  assert.equal(bumper.shrinkAt(round, bumper.SHRINK_START_MS + every), bumper.RING_R - 2 * bumper.SHRINK_STEP);
  assert.equal(bumper.nextShrinkIn(round, 1000), bumper.SHRINK_START_MS - 1000);
  let t = bumper.SHRINK_START_MS;
  while (bumper.shrinkAt(round, t) > bumper.MIN_RING) t += every;
  assert.equal(bumper.shrinkAt(round, t), bumper.MIN_RING);
  assert.equal(bumper.suddenDeath(round, t), false);
  assert.equal(bumper.shrinkAt(round, t + bumper.SUDDEN_MS - 1), bumper.MIN_RING, "the floor holds a while");
  assert.equal(bumper.shrinkAt(round, t + bumper.SUDDEN_MS), bumper.MIN_RING - 1);
  assert.equal(bumper.suddenDeath(round, t + bumper.SUDDEN_MS), true);
  assert.equal(bumper.shrinkAt(round, t + 600000), bumper.LAST_RING);
  assert.equal(bumper.nextShrinkIn(round, t + 600000), Infinity);
  assert.ok(bumper.LAST_RING < bumper.CAR_R, "two touching cars can no longer both be on");
  assert.ok(bumper.arenaFor(1).shrinkMs > bumper.arenaFor(5).shrinkMs && bumper.arenaFor(9).shrinkMs < bumper.arenaFor(5).shrinkMs, "slow at first, faster in the final");

  // Played through: a warning, then the step, and a car on the band falls.
  const r2 = ring(2, [0, 1]);
  const [you, bully] = r2.cars;
  put(you, bumper.CX, bumper.CY);
  put(bully, bumper.CX + bumper.RING_R - 1, bumper.CY);
  bully.push = { x: 0, y: 0 };
  r2.clock = bumper.SHRINK_START_MS - bumper.SHRINK_WARN_MS - 10;
  bumper.advance(r2, 20, calm);
  assert.equal(bumpEvents(r2, "warn").length, 1);
  bumper.advance(r2, bumper.SHRINK_WARN_MS, calm);
  assert.equal(bumpEvents(r2, "shrink").length, 1);
  assert.equal(r2.R, bumper.RING_R - bumper.SHRINK_STEP);
  assert.equal(bully.alive, false, "caught on the band that dropped");
});

test("Bumper Ring: rivals winding up a dash let go of the push first, then dash after WINDUP_MS at their sharpness", () => {
  const round = ring(1, null, { still: false });
  const [you, bully] = round.cars;
  put(you, bumper.CX, bumper.CY);
  put(bully, bumper.CX, bumper.CY - 14, 0, 40);
  bully.think = 0;
  bully.charges = 1;
  // A roll of 0 passes every chance, so the Bully at 14 units, closing, dashes.
  bumper.advance(round, 4, () => 0);
  assert.equal(bumpEvents(round, "windup").length, 1);
  assert.ok(bully.windup > 0);
  assert.deepEqual(bully.push, { x: 0, y: 0 }, "it lets go and revs");
  const wind = bumper.WINDUP_MS - (bumper.WINDUP_MS - 200) * bumper.ARENAS[1].smart;
  bumper.advance(round, Math.floor(wind / 4) * 4 - 8, calm);
  assert.equal(bumpEvents(round, "dash").length, 0, "not yet");
  bumper.advance(round, 16, calm);
  assert.equal(bumpEvents(round, "dash").length, 1);
  assert.equal(bumpEvents(round, "dash")[0].id, bully.id);
  assert.equal(bully.charges, 0);
});

test("Bumper Ring: a sharp rival calls a wind-up off when it finds itself by the edge, keeping its charge", () => {
  const round = ring(1);
  const bully = round.cars[1];
  put(bully, bumper.CX + bumper.RING_R - 4, bumper.CY);
  Object.assign(bully, { windup: 200, windDir: { x: -1, y: 0 }, charges: 1, blind: 0 });
  bumper.advance(round, 4, calm);
  assert.equal(bully.windup, 0, "called off");
  assert.equal(bumpEvents(round, "dash").length, 0, "no dash");
  assert.equal(bully.charges, 1, "the charge is kept");
});

test("Bumper Ring: a spent dash comes back after RECHARGE_MS, never past MAX_CHARGES, only in a fight, and a full car banks nothing", () => {
  const round = ring(1, [0, 1]);
  const [you, bully] = round.cars;
  put(you, bumper.CX, bumper.CY + 10);
  put(bully, bumper.CX, bumper.CY - 15);
  assert.equal(bully.charges, 1, "a rival starts a heat with one");
  Object.assign(you, { charges: 1, recharge: 0 });
  bully.recharge = 0;
  bumper.advance(round, bumper.RECHARGE_MS - 4, calm);
  assert.equal(you.charges, 1, "not yet");
  assert.equal(bumpEvents(round, "charge").length, 0);
  bumper.advance(round, 4, calm);
  assert.equal(you.charges, 2);
  assert.deepEqual(bumpEvents(round, "charge").map((e) => e.charges), [2], "one charge event, yours only");
  assert.equal(bully.charges, 2, "rivals recharge too, silently");

  Object.assign(you, { charges: bumper.MAX_CHARGES, recharge: 0 });
  bumper.advance(round, bumper.RECHARGE_MS, calm);
  assert.equal(you.charges, bumper.MAX_CHARGES, "never past the max");

  // A Charge pad on a nearly refilled car: the bank empties at the max.
  Object.assign(you, { charges: bumper.MAX_CHARGES - 1, recharge: bumper.RECHARGE_MS - 500 });
  bumper.applyPower(round, you, "charge");
  bumper.advance(round, 4, calm);
  assert.equal(you.recharge, 0);
  you.charges -= 1;
  bumper.advance(round, 400, calm);
  assert.equal(you.charges, bumper.MAX_CHARGES - 1, "the spent charge refills from empty");

  round.phase = "ready";
  round.phaseMs = 1e9;
  Object.assign(you, { charges: 1, recharge: 0 });
  bumper.advance(round, bumper.RECHARGE_MS, calm);
  assert.equal(you.charges, 1, "no recharge before the heat starts");
});

test("Bumper Ring: a heat where nobody pushes still ends, the ring shrinking through sudden death, in a plain arena and a busy one", () => {
  for (const arena of [1, 8]) {
    const round = ring(arena, [0, 1]);
    const [you, rival] = round.cars;
    put(you, bumper.CX, bumper.CY + 6);
    put(rival, bumper.CX, bumper.CY - 6);
    let ms = 0;
    while (round.phase !== "done" && ms < 200000) {
      bumper.advance(round, 16, calm);
      ms += 16;
    }
    assert.equal(round.phase, "done", `arena ${arena} ended`);
    assert.ok(["win", "lose", "draw"].includes(round.result), `arena ${arena}: ${round.result}`);
  }
});

test("Bumper Ring: a Turtle at the middle with nobody near holds it, and no rival at sharpness 1 pushes off the edge with nothing near it", () => {
  const round = ring(2, [0, 2], { still: false });
  const [you, turtle] = round.cars;
  put(you, bumper.CX, bumper.CY + 38);
  put(turtle, bumper.CX + 1, bumper.CY - 1);
  assert.deepEqual([bumper.aim(round, turtle, calm).x, bumper.aim(round, turtle, calm).y], [0, 0], "nothing to do");
  for (let i = 0; i < 100; i++) bumper.advance(round, 20, calm);
  assert.ok(Math.hypot(turtle.x - bumper.CX, turtle.y - bumper.CY) < 4, "it never leaves the middle");

  const sharp = ring(9);
  const [me] = sharp.cars;
  for (const car of sharp.cars.slice(1)) {
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const gap of [1, 4, 7]) {
        for (const out of [0, 25]) {
          put(car, bumper.CX + Math.cos(a) * (bumper.RING_R - gap), bumper.CY + Math.sin(a) * (bumper.RING_R - gap), Math.cos(a) * out, Math.sin(a) * out);
          put(me, bumper.CX - Math.cos(a) * 30, bumper.CY - Math.sin(a) * 30);
          car.echo = { x: Math.cos(a), y: Math.sin(a) };
          const others = sharp.cars.filter((c) => c !== car && c !== me);
          for (const [i, o] of others.entries()) put(o, bumper.CX - Math.cos(a + 0.6 + i) * 25, bumper.CY - Math.sin(a + 0.6 + i) * 25);
          const choice = bumper.aim(sharp, car, () => 0.99);
          assert.ok(choice.x * Math.cos(a) + choice.y * Math.sin(a) <= 1e-9, `${car.kind} at gap ${gap} pushes back in`);
          assert.equal(choice.dash, false);
        }
      }
    }
  }
  assert.equal(bumper.aim(sharp, sharp.cars[1], () => 0).misjudge, false, "a sharp rival never misjudges");
  // Those places are all inside the panic band; played out, each sharp rival
  // alone in the Grand Final (holes, magnet, turntable, square and all), with
  // you a Ghost it cannot hit, is still on the ring when the shrink begins.
  for (let i = 1; i < sharp.cars.length; i++) {
    const heat = ring(9, [0, i], { still: false });
    const [ghost, rival] = heat.cars;
    let ms = 0;
    while (ms < bumper.SHRINK_START_MS - 1000 && heat.phase === "fight") {
      ghost.fx.ghost = 1e9;
      bumper.advance(heat, 16, calm);
      ms += 16;
    }
    assert.equal(rival.alive, true, `the ${rival.kind} never drives itself off`);
  }
  const sloppy = ring(1);
  assert.equal(bumper.aim(sloppy, sloppy.cars[1], () => 0).misjudge, true, "a sloppy one can");
});

test("Bumper Ring: each arena brings its rivals and its floor, and past the ninth the Grand Final repeats, sharper", () => {
  const kinds = (n) => ring(n).cars.map((c) => c.kind).slice(1);
  assert.deepEqual(kinds(1), ["bully"]);
  assert.deepEqual(kinds(2), ["bully", "turtle"]);
  assert.deepEqual(kinds(3), ["bully", "turtle", "sniper"]);
  assert.deepEqual(kinds(5), ["bully", "turtle", "sniper", "scrapper"]);
  assert.deepEqual(kinds(8), ["bully", "turtle", "sniper", "scrapper", "mirror"]);
  const has = (n) => {
    const r = ring(n);
    return { bumpers: r.bumpers.length > 0, ice: r.ice.length > 0, spin: r.spin > 0, holes: r.holes.length > 0, magnet: Boolean(r.magnet) };
  };
  assert.deepEqual(has(2), { bumpers: false, ice: false, spin: false, holes: false, magnet: false });
  assert.deepEqual(has(3), { bumpers: true, ice: false, spin: false, holes: false, magnet: false });
  assert.deepEqual(has(4), { bumpers: true, ice: true, spin: false, holes: false, magnet: false });
  assert.deepEqual(has(5), { bumpers: true, ice: true, spin: true, holes: false, magnet: false });
  assert.deepEqual(has(6), { bumpers: true, ice: true, spin: true, holes: true, magnet: false });
  assert.deepEqual(has(9), { bumpers: true, ice: true, spin: true, holes: true, magnet: true });
  for (let n = 2; n <= bumper.MAX_ARENA; n++) assert.ok(bumper.ARENAS[n].smart > bumper.ARENAS[n - 1].smart, `arena ${n} is sharper`);
  assert.equal(bumper.arenaFor(10).title, "Final 2");
  assert.equal(bumper.arenaFor(12).title, "Final 4");
  assert.ok(bumper.arenaFor(12).shrinkMs < bumper.arenaFor(9).shrinkMs);
  assert.ok(bumper.rivalPower(12).push > bumper.rivalPower(9).push);
  assert.ok(bumper.rivalPower(1).push < 1 && bumper.rivalPower(9).push === 1, "the Training Mat Bully pushes softer than you");
  assert.equal(bumper.arenaName(4), "Ice Rink (arena 4 of 9)");
  assert.equal(bumper.arenaName(11), "Final 3 (arena 11)");
});

test("Bumper Ring: the Turntable carries a car round, ice lets it slide, a bumper kicks it off, and the magnet pulls then pushes", () => {
  const spin = alone(5);
  const [you] = spin.cars;
  put(you, bumper.CX + 20, bumper.CY);
  bumper.advance(spin, 1000, calm);
  assert.ok(you.y > bumper.CY + 3, "carried round with the floor");

  const coast = (onIce) => {
    const r = alone(4);
    r.ice = onIce ? [{ x: bumper.CX, y: bumper.CY, r: 40 }] : [];
    put(r.cars[0], bumper.CX - 20, bumper.CY, 40, 0);
    bumper.advance(r, 400, calm);
    return r.cars[0].x;
  };
  assert.ok(coast(true) > coast(false) + 4, "ice slides further");

  const kick = alone(3);
  const b = kick.bumpers[0];
  put(kick.cars[0], b.x - b.r - bumper.CAR_R + 0.5, b.y, 20, 0);
  bumper.advance(kick, 4, calm);
  assert.ok(kick.cars[0].vx < -20, "kicked back harder than it came");
  assert.equal(bumpEvents(kick, "bumper").length, 1);

  const mag = alone(7);
  put(mag.cars[0], bumper.CX + 30, bumper.CY);
  bumper.advance(mag, 200, calm);
  assert.ok(mag.cars[0].vx < 0, "pulled in");
  bumper.advance(mag, 5000, calm);
  assert.equal(bumpEvents(mag, "magnetWarn").length, 1);
  assert.equal(bumpEvents(mag, "magnet").length, 1);
  assert.equal(mag.magnet.pull, -1);
  put(mag.cars[0], bumper.CX + 30, bumper.CY);
  bumper.advance(mag, 200, calm);
  assert.ok(mag.cars[0].vx > 0, "then pushed out");
});

test("Bumper Ring: holes swallow a car only while open, and the Hall of Mirrors' square has corners the round ring does not", () => {
  const round = ring(6, [0, 1]);
  const [you, bully] = round.cars;
  const h = round.holes[0];
  h.ms = 0;
  assert.equal(bumper.holeState(h), "shut");
  put(bully, h.x, h.y);
  put(you, bumper.CX, bumper.CY + 40);
  bumper.advance(round, 4, calm);
  assert.equal(bully.alive, true, "a shut hole is floor");
  h.ms = 4000 + bumper.HOLE_WARN_MS - 8;
  assert.equal(bumper.holeState(h), "warn");
  put(bully, h.x, h.y);
  bumper.advance(round, 16, calm);
  assert.equal(bumper.holeState(round.holes[0]), "open");
  assert.equal(bully.alive, false);
  assert.equal(bumpEvents(round, "fall")[0].hole, true);

  const hall = alone(8);
  const corner = { x: bumper.CX + bumper.RING_R * 0.85, y: bumper.CY + bumper.RING_R * 0.85 };
  assert.ok(bumper.edgeGap(hall, corner.x, corner.y) < 0, "off a round ring");
  hall.shape = "square";
  assert.ok(bumper.edgeGap(hall, corner.x, corner.y) > 0, "on the square");
  // The magnet, the turn and the holes kept still, so only the shape counts.
  Object.assign(hall, { magnet: null, spin: 0, holes: [], shapeMs: 0 });
  put(hall.cars[0], bumper.CX, bumper.CY + 20);
  bumper.advance(hall, 7000 - bumper.SHAPE_WARN_MS + 20, calm);
  assert.equal(bumpEvents(hall, "shapeWarn").length, 1, "the corners flash first");
  assert.equal(hall.shape, "square");
  put(hall.cars[0], corner.x, corner.y);
  bumper.advance(hall, bumper.SHAPE_WARN_MS, calm);
  assert.equal(hall.shape, "round");
  assert.equal(hall.cars[0].alive, false, "left in a corner when it went round");
});

test("Bumper Ring: pads turn up from arena 2 and every power does its thing", () => {
  const plain = ring(1);
  bumper.advance(plain, 20000, calm);
  assert.equal(plain.pads.length, 0, "none on the Training Mat");
  const padded = alone(2);
  put(padded.cars[0], bumper.CX, bumper.CY);
  bumper.advance(padded, 4100, calm);
  assert.equal(padded.pads.length, 1, "the first pad after FIRST_PAD_MS");
  assert.ok(bumper.edgeGap(padded, padded.pads[0].x, padded.pads[0].y) >= 6);
  const pad = padded.pads[0];
  put(padded.cars[0], pad.x, pad.y);
  bumper.advance(padded, 4, calm);
  assert.equal(padded.pads.length, 0, "driven over, taken");
  assert.equal(bumpEvents(padded, "power").length, 1);

  const round = ring(2, [0, 1]);
  const [you, bully] = round.cars;
  bumper.applyPower(round, you, "heavy");
  assert.equal(bumper.massOf(you), 2);
  bumper.applyPower(round, you, "grow");
  bumper.advance(round, 4, calm);
  assert.ok(near(you.r, bumper.CAR_R * 1.4));
  you.charges = bumper.MAX_CHARGES;
  bumper.applyPower(round, you, "charge");
  assert.equal(you.charges, bumper.MAX_CHARGES, "never past the max");
  bumper.applyPower(round, you, "ghost");
  put(you, 60, 50, 40, 0);
  put(bully, 63, 50);
  assert.equal(bumper.collide(you, bully), null, "a Ghost passes through");
  bumper.advance(round, bumper.POWERS.ghost.ms + 10, calm);
  assert.equal(bumper.has(you, "ghost"), false, "and wears off");
  bumper.applyPower(round, you, "slick");
  put(you, bumper.CX, bumper.CY);
  bumper.advance(round, 500, calm);
  assert.ok(round.slicks.length > 0 && round.slicks.every((s) => s.owner === you.id), "oil left behind");
  assert.deepEqual(Object.keys(bumper.POWERS).sort(), ["charge", "ghost", "grow", "heavy", "shield", "slick", "spring"]);
});

test("Bumper Ring: the Mirror copies your dash MIRROR_MS later", () => {
  const round = ring(8, [0, 5], { still: false });
  const [you, mirror] = round.cars;
  assert.equal(mirror.kind, "mirror");
  put(you, bumper.CX, bumper.CY + 10);
  put(mirror, bumper.CX, bumper.CY - 10);
  mirror.charges = 1;
  assert.equal(bumper.dash(round, you, { x: 1, y: 0 }), true);
  round.events.length = 0;
  bumper.advance(round, bumper.MIRROR_MS - 20, calm);
  assert.equal(bumpEvents(round, "dash").length, 0);
  bumper.advance(round, 40, calm);
  const copy = bumpEvents(round, "dash");
  assert.equal(copy.length, 1);
  assert.equal(copy[0].id, mirror.id);
  assert.ok(near(copy[0].dx, 1) && near(copy[0].dy, 0), "the same way you went");
});

test("Bumper Ring: no tick moves a car through another, however long", () => {
  const round = ring(1);
  const [you, bully] = round.cars;
  put(you, bumper.CX - 20, bumper.CY, bumper.DASH_CAP, 0);
  put(bully, bumper.CX, bumper.CY);
  bumper.advance(round, 500, calm);
  assert.ok(bully.x > you.x, "still ahead of you");
  assert.ok(bully.touch && bully.touch.by === 0, "it was hit");
  // A car sent flying by a Spring off a heavy dash goes some 600 units a
  // second: still caught in one long advance, never passed through.
  const fast = ring(1);
  const [me, other] = fast.cars;
  put(me, bumper.CX - 30, bumper.CY, 600, 0);
  put(other, bumper.CX, bumper.CY);
  bumper.advance(fast, 100, calm);
  assert.ok(bumpEvents(fast, "hit").some((e) => e.a === 0 && e.b === other.id), "the hit was seen");
  assert.equal(other.touch.by, 0);
});

test("Bumper Ring: a rival you ram into another keeps your knockout, and a long lean never stretches the carry", () => {
  const round = ring(3, [0, 1, 2]);
  const [you, a, b] = round.cars;
  round.bumpers = [];
  // You ram A; it grazes B on its way out and falls.
  put(you, bumper.CX + 17.8, bumper.CY, 90, 0);
  put(a, bumper.CX + 26, bumper.CY);
  put(b, bumper.CX + 30, bumper.CY + 7.6);
  bumper.advance(round, 400, calm);
  const hits = bumpEvents(round, "hit");
  assert.ok(hits.some((e) => e.a === 0 && e.b === a.id) && hits.some((e) => e.a === a.id && e.b === b.id), "you hit A, A hit B");
  const fall = bumpEvents(round, "fall").find((e) => e.id === a.id);
  assert.ok(fall, "A fell");
  assert.equal(fall.by, 0, "your knockout, not B's");
  assert.ok(fall.points > 0);

  // Two rivals leaning on each other long after your hit: the carry runs out.
  const lean = ring(3, [0, 1, 2]);
  const [, c, d] = lean.cars;
  lean.bumpers = [];
  put(c, bumper.CX - 4, bumper.CY);
  put(d, bumper.CX + 3.9, bumper.CY);
  c.touch = { by: 0, via: null, at: lean.clock };
  c.push = { x: 1, y: 0 };
  d.push = { x: -1, y: 0 };
  bumper.advance(lean, 1200, calm);
  assert.equal(c.touch.by, d.id);
  assert.equal(c.touch.via, null, "no longer carrying your hit");
  assert.equal(bumper.creditKo(lean, c).by, d.id, "so it is the leaner's");
});

test("Bumper Ring: a Shield saves a car a hole opens right under, sending it back toward the middle", () => {
  const round = ring(6, [0, 1]);
  const [you, bully] = round.cars;
  Object.assign(round, { spin: 0, magnet: null });
  const h = round.holes[0];
  round.holes = [h];
  h.ms = 4000 + bumper.HOLE_WARN_MS - 4;
  put(you, h.x, h.y);
  put(bully, bumper.CX + 30, bumper.CY);
  you.shield = true;
  bumper.advance(round, 40, calm);
  assert.equal(bumper.holeState(h), "open");
  assert.equal(you.alive, true, "saved");
  assert.equal(you.shield, false, "used up");
  assert.ok(Math.hypot(you.x - h.x, you.y - h.y) > h.r, "off the hole");
  assert.ok(Math.hypot(you.x - bumper.CX, you.y - bumper.CY) < Math.hypot(h.x - bumper.CX, h.y - bumper.CY), "on the side toward the middle");
  assert.deepEqual(bumpEvents(round, "saved").length, 1);
  assert.equal(bumpEvents(round, "fall").length, 0);
});

test("Bumper Ring: an arena's numbers are built once, not on every slice", () => {
  assert.equal(bumper.arenaFor(12), bumper.arenaFor(12), "the same Final 4");
  assert.equal(bumper.rivalPower(3), bumper.rivalPower(3));
  assert.equal(bumper.rivalPower(12), bumper.rivalPower(12));
  assert.ok(Object.isFrozen(bumper.arenaFor(12)) && Object.isFrozen(bumper.rivalPower(12)), "and nobody can change them");
});

test("Bumper Ring: the pills never overlap or leave the board, even on the smallest board with every power held and sudden death", () => {
  const h = Math.max(14 / bumper.MIN_CELL, 2.6);
  const powers = ["HEAVY", "GROW", "GHOST", "SLICK", "SPRING", "SHIELD"].map((text) => ({ text, color: "#ffffff", fill: 1 }));
  for (const countdown of [null, { text: "SUDDEN DEATH", color: "#ffffff" }, { text: "RING 3", color: "#ffffff" }]) {
    for (let n = 0; n <= powers.length; n++) {
      const pills = hudLayout(h, bumper.W, 3, { arena: "FINAL 12", charges: 1, maxCharges: 3, recharge: 0.5, left: 5, powers: powers.slice(0, n), ring: countdown });
      assert.equal(pills.length, 4 + n + (countdown ? 1 : 0));
      for (const p of pills) assert.ok(p.x >= 0 && p.x + p.w <= bumper.W, `${p.text} stays on the board`);
      for (let i = 0; i < pills.length; i++) {
        for (let j = i + 1; j < pills.length; j++) {
          const [p, q] = [pills[i], pills[j]];
          const apart = p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + h <= q.y || q.y + h <= p.y;
          assert.ok(apart, `${p.text} and ${q.text} do not overlap (${n} powers, ${countdown ? countdown.text : "no ring"})`);
        }
      }
    }
  }
});

/* ------------------------------------------------------- Bumper Ring game */

test("Bumper Ring: every pill's text reads at 4.5:1 on its backing and its timer's tint, lives, the dash and every power included, in light and dark under every highlight", () => {
  checkPills(bumper.default, {
    setup: (r) => {
      const you = r.cars[0];
      Object.assign(you.fx, { heavy: 2000, grow: 2000, ghost: 1000, slick: 2000 });
      you.spring = true;
      you.shield = true;
    },
    expect: ["ARENA 1", "♥", "DASH", "~HEAVY", "SPRING", "SHIELD"],
  });
});

test("Bumper Ring game: held arrows push until let go, space dashes, a pause lets go of everything, and the board refuses a tiny window", () => {
  const { canvas, calls } = stubCanvas();
  const g = bumper.default.create({ canvas });
  assert.equal(g.resize(bumper.W * bumper.MIN_CELL - 1, 2000), false, "too narrow to play");
  assert.equal(g.resize(800, 600), true);
  assert.ok(calls.count > 0, "the start screen draws");
  assert.equal(typeof g.release, "function");
  g.key("action");
  assert.equal(g.state, "running");
  g.tick(400);
  assert.equal(g.round.phase, "fight");
  const you = g.round.cars[0];
  const y = you.y;
  g.key("up");
  g.tick(200);
  assert.ok(you.y < y - 2, "held up pushes up");
  g.release("up");
  assert.equal(g.round.input.up, false);
  g.key("left");
  g.key("action");
  assert.equal(you.charges, bumper.START_CHARGES - 1, "space dashes");
  assert.ok(you.vx < -bumper.MAX_SPEED * 0.5, "the way you push");
  g.pause();
  assert.deepEqual(g.round.input, { up: false, down: false, left: false, right: false }, "a pause holds nothing");
  g.key("action");
  assert.equal(g.state, "running", "space plays on from a pause");
  assert.equal(you.charges, bumper.START_CHARGES - 1, "and does not also dash");
});

test("Bumper Ring game: a hard hit on you holds the action still a moment, and passing the best plays the fanfare once", () => {
  const { canvas } = stubCanvas();
  const tones = [];
  const g = bumper.default.create({ canvas, tone: (name) => tones.push(name), best: () => 5 });
  g.resize(800, 600);
  g.key("action");
  g.tick(400);
  const [you, bully] = g.round.cars;
  put(you, bumper.CX - 8.5, bumper.CY, 50, 0);
  put(bully, bumper.CX, bumper.CY, -50, 0);
  g.tick(16);
  assert.ok(tones.includes("ram"), "the hit sounds");
  const clock = g.round.clock;
  g.tick(16);
  assert.equal(g.round.clock, clock, "held still");
  g.tick(48);
  assert.ok(g.round.clock > clock, "then on again");
  g.round.score = 6;
  g.tick(16);
  g.tick(16);
  assert.equal(tones.filter((t) => t === "best").length, 1);
});

test("Bumper Ring game: the start screen reads the furthest arena, the memo only grows, and the round's end calls onScore once", () => {
  const { canvas, calls } = stubCanvas();
  let saved = 3;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = bumper.default.create({ canvas, memo, onScore: (n) => scores.push(n) });
  g.resize(800, 600);
  assert.ok(calls.count > 0);
  assert.equal(saved, 3, "nothing is written by just opening it");
  const winHeat = () => {
    for (const c of g.round.cars) if (c.id !== 0) put(c, bumper.CX + Math.cos(c.id * 1.3) * (bumper.RING_R + 6), bumper.CY + Math.sin(c.id * 1.3) * (bumper.RING_R + 6));
    g.tick(16);
    g.tick(bumper.DONE_MS + 16);
    g.tick(bumper.READY_MS + 16);
  };
  g.key("action");
  g.tick(400);
  winHeat();
  assert.equal(g.round.level, 2);
  assert.equal(saved, 3, "arena 2 is not past arena 3");
  winHeat();
  winHeat();
  assert.equal(g.round.level, 4);
  assert.equal(saved, 4, "a new furthest");
  const loseHeat = () => {
    put(g.round.cars[0], bumper.CX, bumper.CY + bumper.RING_R + 3);
    g.tick(16);
    g.tick(bumper.DONE_MS + 16);
    g.tick(bumper.READY_MS + 16);
  };
  for (let i = 0; i < bumper.START_LIVES; i++) loseHeat();
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
  g.tick(1000);
  assert.equal(scores.length, 1, "once");
  g.key("action");
  g.tick(400);
  for (let i = 0; i < bumper.START_LIVES; i++) loseHeat();
  assert.equal(saved, 4, "a shorter round leaves it");
  assert.equal(scores.length, 2);
});

test("Bumper Ring game: the opening banner sits in the board from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.32)");
  const g = bumper.default.create({ canvas });
  g.resize(900, 900);
  openingBanner(g, shades, bumper.H);
});

/* ------------------------------------------------- shared random sources */

// A fixed random source: every call returns the same value, so a rival never
// guesses and a sharp one always notices a threat.
const steady = () => 0.5;

// A seeded random source, so a long run plays the same every time.
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}

/* ------------------------------------------------------- Hot Potato rules */

// A match at `venue`, past its hold, every rival standing still with no dash
// left (so none reacts) unless `still` is false. The bombs stay where
// newMatch lit them.
function potato(venue = 1, { still = true, random = calm } = {}) {
  const round = fuse.newRound(random);
  fuse.newMatch(round, venue, random, 0);
  fuse.advance(round, 8, random);
  assert.equal(round.phase, "play");
  if (still) for (const r of round.runners) if (r.id !== 0) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0 });
  round.events.length = 0;
  return round;
}

// Puts a runner somewhere, standing still.
const spot = (r, x, y) => Object.assign(r, { x, y, vx: 0, vy: 0 });
// Takes a runner out of a test's match without a blast.
const sitOut = (r) => Object.assign(r, { alive: false, out: "blast", outMs: 0 });
// Hands `bomb` to `r` with `fuseMs` left, passable at once.
const handTo = (r, bomb, fuseMs = 8000) => Object.assign(bomb, { lit: true, holder: r.id, lock: 0, fuse: fuseMs, max: Math.max(fuseMs, bomb.max), from: null, gap: 0 });
const fuseEvents = (round, type) => round.events.filter((e) => e.type === type);
// The Break Room's top row (y 8) is open from wall to wall.
const ROW = 8;

test("Hot Potato: a round opens in the Break Room with three lives, two dashes, three rivals and a 12 second fuse on one of them", () => {
  const round = fuse.newRound(calm);
  assert.equal(round.level, 1);
  assert.equal(round.lives, fuse.START_LIVES);
  assert.equal(round.phase, "ready");
  assert.equal(fuse.VENUES[1].title, "Break Room");
  assert.deepEqual(round.runners.map((r) => r.kind), ["planny", "sprinter", "hider", "trickster"]);
  assert.equal(round.bombs.length, 1);
  const [bomb] = round.bombs;
  assert.ok(bomb.lit && bomb.holder !== 0, "a rival holds it");
  assert.equal(bomb.fuse, fuse.FUSE_MS);
  const you = round.runners[0];
  assert.ok(you.y > fuse.AH / 2, "you start at the bottom");
  for (const r of round.runners) {
    assert.equal(r.charges, fuse.START_CHARGES);
    for (const b of round.blocks) {
      const nx = Math.min(Math.max(r.x, b.x), b.x + b.w);
      const ny = Math.min(Math.max(r.y, b.y), b.y + b.h);
      assert.ok(Math.hypot(r.x - nx, r.y - ny) >= fuse.RUNNER_R, `${r.kind} starts clear of the ${b.kind}`);
    }
  }
  const before = bomb.fuse;
  fuse.advance(round, 200, calm);
  assert.equal(bomb.fuse, before, "nothing burns during the hold");
});

test("Hot Potato: the first fuse of a match never starts on you, in any venue, and Two Bombs lights two", () => {
  for (let v = 1; v <= fuse.MAX_VENUE + 2; v++) {
    for (let seed = 1; seed <= 40; seed++) {
      const random = seeded(seed * 97 + v);
      const round = fuse.newRound(random);
      fuse.newMatch(round, v, random);
      assert.equal(round.bombs.length, fuse.venueFor(v).bombs, `venue ${v}`);
      for (const b of round.bombs) assert.notEqual(b.holder, 0, `venue ${v}, seed ${seed}`);
      assert.equal(new Set(round.bombs.map((b) => b.holder)).size, round.bombs.length, "each bomb on its own rival");
    }
    for (const random of [() => 0, () => 0.9999]) assert.ok(fuse.newMatch(fuse.newRound(random), v, random).bombs.every((b) => b.holder !== 0));
  }
});

test("Hot Potato: a touch by the holder passes the bomb, which then cannot move for NO_TAGBACK_MS, nor go straight back while three are left", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  const [bomb] = round.bombs;
  handTo(a, bomb);
  spot(a, 30, ROW);
  spot(you, 35.8, ROW);
  spot(b, 90, ROW);
  spot(c, 10, 62);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, 0, "the touch passes it");
  assert.equal(bomb.lock, fuse.NO_TAGBACK_MS);
  assert.equal(round.score, 0, "a rival's pass scores you nothing");
  assert.deepEqual(fuseEvents(round, "tag").map((e) => [e.from, e.to]), [[a.id, 0]]);
  spot(b, you.x + 5.8, ROW);
  spot(a, 10, 35);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, 0, "not inside NO_TAGBACK_MS");
  spot(b, 90, ROW);
  fuse.advance(round, fuse.NO_TAGBACK_MS, calm);
  spot(a, you.x + 5.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, 0, "no tag-back to the one who passed it");
  assert.ok(fuse.tagBack(round, bomb, a));
  assert.ok(fuse.tagSafe(round, a), "and it shows as safe");
  assert.equal(fuse.tagSafe(round, b), false, "nobody else is");
  spot(a, 10, 35);
  spot(b, you.x + 5.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, b.id, "anyone else takes it");
  assert.equal(round.score, fuse.PASS_POINTS, "your pass scores");
  assert.equal(round.passes, 1);
});

test("Hot Potato: with two left, a tag-back is fine once NO_TAGBACK_MS is over", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  sitOut(b);
  sitOut(c);
  const [bomb] = round.bombs;
  handTo(a, bomb);
  spot(a, 30, ROW);
  spot(you, 35.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, 0);
  assert.equal(fuse.tagBack(round, bomb, a), false, "two left: no tag-back rule");
  fuse.advance(round, fuse.NO_TAGBACK_MS, calm);
  spot(a, you.x + 5.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, a.id);
});

test("Hot Potato: a pass under HOT_MS is a hot pass, hot passes in a row step the streak up to MAX_STREAK, and a cold one ends it", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  const [bomb] = round.bombs;
  const passTo = (r, fuseMs) => {
    for (const o of [a, b, c]) spot(o, 10 + o.id * 25, 62);
    handTo(you, bomb, fuseMs);
    spot(you, 40, ROW);
    spot(r, 45.8, ROW);
    const score = round.score;
    fuse.advance(round, 8, calm);
    assert.equal(bomb.holder, r.id);
    return round.score - score;
  };
  assert.equal(passTo(a, 900), fuse.PASS_POINTS + fuse.HOT_POINTS);
  assert.equal(round.streak, 1);
  assert.equal(passTo(b, 800), fuse.PASS_POINTS + fuse.HOT_POINTS * 2);
  assert.equal(round.streak, 2);
  assert.equal(passTo(c, 5000), fuse.PASS_POINTS, "a cold pass is only a pass");
  assert.equal(round.streak, 0, "and ends the streak");
  round.streak = fuse.MAX_STREAK;
  assert.equal(passTo(a, 500), fuse.PASS_POINTS + fuse.HOT_POINTS * fuse.MAX_STREAK);
  assert.equal(round.streak, fuse.MAX_STREAK, "never past MAX_STREAK");
  assert.equal(round.bestStreak, fuse.MAX_STREAK);
  assert.equal(round.hotPasses, 3);
});

test("Hot Potato: a pass never leaves its new holder under PASS_FLOOR_MS (the no-pass window and a reaction margin), rivals' passes and yours, a hot pass still scores as hot, and each runner is lifted once a fuse", () => {
  assert.equal(fuse.PASS_FLOOR_MS, fuse.NO_TAGBACK_MS + fuse.PASS_REACT_MS);
  assert.ok(fuse.PASS_REACT_MS >= 700, "time enough to reach someone once the bomb can move");
  assert.ok(fuse.PASS_FLOOR_MS > fuse.HOT_MS, "a lifted fuse can still burn down into a hot pass");
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  const [bomb] = round.bombs;
  const apart = () => {
    spot(a, 10, 62);
    spot(b, 90, 62);
    spot(c, 50, 62);
    spot(you, 50, 35);
  };
  // A rival hands it to you with 0.2 s left: you get the floor, not 0.2 s.
  apart();
  handTo(a, bomb, 200);
  spot(a, 30, ROW);
  spot(you, 35.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, 0);
  assert.ok(bomb.fuse >= fuse.PASS_FLOOR_MS - 8 && bomb.fuse <= fuse.PASS_FLOOR_MS, `lifted to the floor (${bomb.fuse})`);
  fuse.advance(round, fuse.NO_TAGBACK_MS, calm);
  assert.ok(you.alive && bomb.lit && bomb.holder === 0, "still yours once it can move");
  assert.ok(bomb.fuse >= fuse.PASS_REACT_MS - 16, `with PASS_REACT_MS left to pass it (${bomb.fuse})`);
  // Your hot pass lifts the rival too, and still scores as hot.
  spot(b, you.x + 5.8, you.y);
  const score = round.score;
  bomb.fuse = 300;
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, b.id);
  assert.equal(round.score - score, fuse.PASS_POINTS + fuse.HOT_POINTS, "a hot pass");
  assert.ok(fuse.tagBack(round, bomb, you));
  assert.ok(bomb.fuse >= fuse.PASS_FLOOR_MS - 8, `the rival is lifted too (${bomb.fuse})`);
  // A pass with more than the floor left is not touched.
  apart();
  handTo(c, bomb, 5000);
  spot(c, 30, ROW);
  spot(a, 35.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, a.id);
  assert.ok(bomb.fuse < 5000 && bomb.fuse >= 5000 - 8, `left as it was (${bomb.fuse})`);
  // Handed the same fuse low a second time, you get what is left.
  apart();
  handTo(c, bomb, 200);
  spot(c, 30, ROW);
  spot(you, 35.8, ROW);
  fuse.advance(round, 8, calm);
  assert.equal(bomb.holder, 0);
  assert.ok(bomb.fuse <= 200, `lifted once a fuse (${bomb.fuse})`);
  assert.deepEqual(bomb.lifted, [0, b.id]);
});

test("Hot Potato: the fuse at zero blows its holder out, and after RELIGHT_MS a survivor gets a shorter fuse, down to the floor", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  const [bomb] = round.bombs;
  handTo(a, bomb, 40);
  spot(a, 30, ROW);
  spot(you, 52, 62);
  spot(b, 90, ROW);
  spot(c, 10, 62);
  fuse.advance(round, 48, calm);
  assert.equal(a.alive, false);
  assert.equal(a.out, "blast");
  assert.deepEqual(fuseEvents(round, "blast").map((e) => e.id), [a.id]);
  assert.equal(round.score, fuse.SURVIVE_POINTS, "you survived the fuse");
  assert.equal(bomb.lit, false);
  assert.equal(round.phase, "play", "three are left");
  fuse.advance(round, fuse.RELIGHT_MS + 16, calm);
  assert.ok(bomb.lit, "it lights again");
  assert.ok(round.runners[bomb.holder].alive);
  assert.equal(bomb.max, fuse.FUSE_MS - fuse.FUSE_STEP_MS, "the second fuse is shorter");
  assert.equal(fuse.fuseFor(round, 0), fuse.FUSE_MS);
  assert.equal(fuse.fuseFor(round, 4), fuse.FUSE_MS - 4 * fuse.FUSE_STEP_MS);
  assert.equal(fuse.fuseFor(round, 20), fuse.FUSE_FLOOR_MS, "never under the floor");
  assert.equal(fuse.fuseFor({ level: 9 }, 20), fuse.VENUES[9].floor, "the Finale's floor is lower");
});

test("Hot Potato: a match ends at one runner, a win moves on a venue, your blast costs a life and runs it again, and the last life ends the round", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  sitOut(b);
  sitOut(c);
  handTo(a, round.bombs[0], 30);
  spot(a, 30, ROW);
  spot(you, 80, ROW);
  fuse.advance(round, 40, calm);
  assert.equal(round.phase, "done");
  assert.equal(round.result, "win");
  assert.equal(round.score, fuse.SURVIVE_POINTS + fuse.WIN_POINTS, "the fuse survived and the match");
  assert.equal(round.matchesWon, 1);
  fuse.advance(round, fuse.DONE_MS + 16, calm);
  assert.equal(round.level, 2);
  assert.equal(round.phase, "ready");
  assert.equal(fuseEvents(round, "level").length, 1);
  assert.equal(round.runners.length, 4, "a fresh field");

  const lost = potato(1);
  handTo(lost.runners[0], lost.bombs[0], 30);
  lost.streak = 3;
  fuse.advance(lost, 40, calm);
  assert.equal(lost.result, "lose");
  assert.equal(lost.lives, fuse.START_LIVES - 1);
  assert.equal(lost.streak, 0, "a life lost ends the streak");
  fuse.advance(lost, fuse.DONE_MS + 16, calm);
  assert.equal(lost.level, 1, "the same venue again");
  assert.ok(lost.bombs.every((bb) => bb.holder !== 0), "and its first fuse is not yours");
  assert.equal(fuseEvents(lost, "retry").length, 1);
  lost.lives = 1;
  fuse.advance(lost, fuse.READY_MS + 8, calm);
  handTo(lost.runners[0], lost.bombs[0], 30);
  fuse.advance(lost, 40, calm);
  fuse.advance(lost, fuse.DONE_MS + 16, calm);
  assert.equal(lost.over, true);
});

test("Hot Potato: Freeze stops every fuse burning, Extra Fuse adds to it, Sneakers speeds you up, and Swap trades places with the bomb staying put", () => {
  const round = potato(2);
  const [you, a] = round.runners;
  const [bomb] = round.bombs;
  handTo(a, bomb, 6000);
  fuse.applyPower(round, you, "freeze");
  assert.equal(fuse.burn(round, 1500), false);
  assert.equal(bomb.fuse, 6000, "frozen");
  fuse.burn(round, 1000);
  assert.equal(bomb.fuse, 5500, "the freeze ran out half way");
  fuse.applyPower(round, you, "extra");
  assert.equal(bomb.fuse, 5500 + fuse.EXTRA_MS);
  assert.ok(bomb.max >= bomb.fuse);
  fuse.applyPower(round, you, "sneakers");
  assert.equal(you.fx.sneakers, fuse.SNEAKERS_MS);
  assert.ok(Math.abs(fuse.speedOf(round, you) - fuse.SPEED * fuse.SNEAKERS) < 1e-9);
  spot(you, 20, ROW);
  spot(a, 80, ROW);
  fuse.applyPower(round, a, "swap", () => 0);
  assert.deepEqual([a.x, you.x], [20, 80], "places traded");
  assert.equal(bomb.holder, a.id, "the bomb goes with its holder");
  assert.equal(fuse.burn(round, 1e6), true, "a fuse that runs out says so");
  assert.equal(fuse.applyPower(round, you, "nope"), false);
  handTo(you, bomb);
  assert.ok(Math.abs(fuse.speedOf(round, you) - fuse.SPEED * fuse.SNEAKERS * fuse.HOLDER_SPEED) < 1e-9, "the holder runs HOLDER_SPEED times as fast");
});

test("Hot Potato: a pickup turns up from venue 2, one at a time, and a runner over it takes it", () => {
  const plain = potato(1);
  plain.bombs[0].fuse = 1e6;
  fuse.advance(plain, 12000, calm);
  assert.equal(plain.pickups.length, 0, "none in the Break Room");
  const random = seeded(5);
  const round = potato(2, { random });
  for (const r of round.runners) spot(r, 10 + r.id * 4, 62);
  round.bombs[0].fuse = 1e6;
  fuse.advance(round, 3100, random);
  assert.equal(round.pickups.length, 1);
  fuse.advance(round, 2000, random);
  assert.equal(round.pickups.length, 1, "one at a time");
  const p = round.pickups[0];
  const you = round.runners[0];
  spot(you, p.x, p.y);
  fuse.advance(round, 8, random);
  assert.equal(round.pickups.length, 0);
  assert.deepEqual(fuseEvents(round, "power").map((e) => [e.id, e.kind]), [[0, p.kind]]);
});

test("Hot Potato: a runner not holding flees the holder, and a holding rival chases", () => {
  for (const v of [1, 3, 5, 8]) {
    const round = potato(v);
    const holder = round.runners[round.bombs[0].holder];
    const free = round.runners.filter((r) => r.id !== 0 && !fuse.holding(round, r));
    const r = free.reduce((x, y) => (Math.hypot(x.x - holder.x, x.y - holder.y) < Math.hypot(y.x - holder.x, y.y - holder.y) ? x : y));
    const before = Math.hypot(r.x - holder.x, r.y - holder.y);
    Object.assign(r, { think: 0, charges: 0 });
    holder.charges = 0;
    fuse.advance(round, 1500, calm);
    const after = Math.hypot(r.x - holder.x, r.y - holder.y);
    assert.ok(after > before + 6, `venue ${v}: the ${r.kind} runs from ${before.toFixed(1)} to ${after.toFixed(1)} away`);
  }
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  handTo(a, round.bombs[0]);
  spot(a, 20, ROW);
  spot(you, 60, ROW);
  spot(b, 10, 62);
  spot(c, 94, 62);
  const choice = fuse.think(round, a, calm);
  assert.equal(choice.target, 0, "the nearest is you");
  assert.ok(choice.x > 0.9, "and it runs your way");
  const flee = fuse.think(round, you, calm);
  assert.ok(flee.x > 0, "you, not holding, would run away from it");
});

test("Hot Potato: a holding rival in range winds up its lunge, standing still, then dashes; a Trickster feints the wrong way first", () => {
  for (const [kind, i] of [["sprinter", 1], ["trickster", 3]]) {
    const round = potato(1);
    const you = round.runners[0];
    const r = round.runners[i];
    assert.equal(r.kind, kind);
    for (const o of round.runners) if (o !== r && o !== you) spot(o, 10 + o.id * 4, 62);
    handTo(r, round.bombs[0]);
    spot(r, 30, ROW);
    spot(you, 38, ROW);
    Object.assign(r, { think: 0, charges: 2 });
    fuse.advance(round, 8, () => 0);
    if (kind === "sprinter") {
      assert.ok(r.windup > 0, "it winds up");
      assert.deepEqual(r.push, { x: 0, y: 0 }, "standing still");
      assert.equal(fuseEvents(round, "windup").length, 1);
      fuse.advance(round, fuse.rivalPower(1).windupMs, () => 0);
    } else {
      assert.ok(r.fake > 0, "it feints");
      assert.ok(r.push.x < 0, "the wrong way");
      fuse.advance(round, fuse.FAKE_MS, () => 0);
    }
    const lunge = fuseEvents(round, "dash").find((e) => e.id === r.id);
    assert.ok(lunge && lunge.lunge && lunge.dx > 0.8, `${kind}: then lunges at you`);
    assert.equal(r.charges, 1);
  }
});

test("Hot Potato: a rival a lunge comes at dodges across it after its reaction time, once a lunge", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  handTo(you, round.bombs[0]);
  spot(you, 30, ROW + 6);
  spot(a, 54, ROW + 6);
  spot(b, 10, 62);
  spot(c, 94, 62);
  Object.assign(a, { charges: 2 });
  round.input.right = true;
  assert.ok(fuse.dash(round, you));
  assert.equal(you.charges, fuse.START_CHARGES - 1);
  fuse.advance(round, 8, () => 0);
  assert.equal(a.dashMs, 0, "not before its reaction time");
  for (let t = 0; t < 160 && !fuseEvents(round, "dodge").length; t += 8) fuse.advance(round, 8, () => 0);
  assert.equal(fuseEvents(round, "dodge").length, 1, "it dodges");
  assert.ok(Math.abs(a.dashY) > 0.6, "across the lunge");
  assert.equal(a.charges, 1);
  assert.equal(round.bombs[0].holder, 0, "and gets away");
  round.input.right = false;
  fuse.advance(round, fuse.RECHARGE_MS, () => 0);
  assert.equal(fuseEvents(round, "dodge").length, 1, "once a lunge");
});

test("Hot Potato: a dash spends a charge for DASH_MS, one comes back every RECHARGE_MS up to MAX_CHARGES, and there is no dash before play", () => {
  const round = fuse.newRound(calm);
  const you = round.runners[0];
  assert.equal(fuse.dash(round, you), false, "the hold before the match");
  fuse.advance(round, fuse.READY_MS, calm);
  for (const r of round.runners) if (r.id !== 0) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0 });
  round.input.left = true;
  assert.ok(fuse.dash(round, you));
  assert.equal(you.dashMs, fuse.DASH_MS);
  assert.equal(fuse.dash(round, you), false, "one at a time");
  fuse.advance(round, 8, calm);
  assert.ok(Math.abs(you.vx + you.speed + fuse.DASH_SPEED) < 1e-6, "the way you run, at speed plus DASH_SPEED");
  round.bombs[0].fuse = 1e6;
  fuse.advance(round, fuse.RECHARGE_MS, calm);
  assert.equal(you.charges, fuse.START_CHARGES);
  fuse.advance(round, fuse.RECHARGE_MS * 2, calm);
  assert.equal(you.charges, fuse.MAX_CHARGES, "never past MAX_CHARGES");
});

test("Hot Potato: the Rooftop has no wall at the bottom, a rival minds its edge unless it misjudges, and a holder off it takes the bomb along", () => {
  const round = potato(4);
  assert.equal(round.open, true);
  const [you, a, b, c, d] = round.runners;
  for (const o of [b, c, d]) spot(o, 10 + o.id * 20, 6);
  handTo(b, round.bombs[0], 60000);
  spot(a, 50, fuse.AH - 2);
  Object.assign(a, { push: { x: 0, y: 1 }, vy: 30 });
  fuse.advance(round, 400, calm);
  assert.ok(a.alive && a.y <= fuse.AH, "minding the edge, it stops");
  spot(a, 50, fuse.AH - 2);
  Object.assign(a, { push: { x: 0, y: 1 }, vy: 30, blind: 1e9 });
  fuse.advance(round, 400, calm);
  assert.equal(a.alive, false, "misjudging, it runs off");
  assert.equal(a.out, "fall");
  spot(b, 30, fuse.AH + 0.5);
  b.blind = 1e9;
  const score = round.score;
  fuse.advance(round, 8, calm);
  assert.equal(b.alive, false);
  assert.equal(round.bombs[0].lit, false, "the bomb went with it");
  assert.equal(round.score - score, fuse.SURVIVE_POINTS * 4, "a fuse that ended on someone else");
  fuse.advance(round, fuse.RELIGHT_MS + 16, calm);
  assert.ok(round.bombs[0].lit, "and lights again");
  spot(you, 60, fuse.AH - 1);
  round.input.down = true;
  fuse.advance(round, 400, calm);
  assert.equal(you.alive, false, "you can run off too");
  assert.equal(round.result, "lose");
  const walled = potato(1);
  spot(walled.runners[0], 60, fuse.AH - 4);
  walled.input.down = true;
  fuse.advance(walled, 400, calm);
  assert.ok(walled.runners[0].alive && walled.runners[0].y <= fuse.AH - fuse.RUNNER_R + 1e-9, "a walled venue holds you in");
});

test("Hot Potato: two bombs burn at once, never pass between two holders, and only one relights when three are left", () => {
  const round = potato(8);
  assert.equal(round.runners.length, 7);
  const [b1, b2] = round.bombs;
  const h1 = round.runners[b1.holder];
  const h2 = round.runners[b2.holder];
  assert.notEqual(h1, h2);
  b1.lock = 0;
  b2.lock = 0;
  spot(h1, 40, 62);
  spot(h2, 45.8, 62);
  for (const r of round.runners) if (r !== h1 && r !== h2) spot(r, 6 + r.id * 14, 4);
  fuse.advance(round, 8, calm);
  assert.deepEqual([b1.holder, b2.holder], [h1.id, h2.id], "holder to holder passes nothing");
  // Leave you, the two holders and one more: a blast leaves three.
  const extra = round.runners.find((r) => r.id !== 0 && r !== h1 && r !== h2);
  for (const r of round.runners) if (r.id !== 0 && r !== h1 && r !== h2 && r !== extra) sitOut(r);
  spot(h1, 10, 62);
  spot(h2, 90, 62);
  b1.fuse = 20;
  b2.fuse = 1e6;
  fuse.advance(round, 24, calm);
  assert.equal(h1.alive, false);
  fuse.advance(round, fuse.RELIGHT_MS + 16, calm);
  assert.equal(round.bombs.filter((b) => b.lit).length, 1, "one bomb for three runners");
});

test("Hot Potato: whole matches always end, every venue, with you left idle or run by the rivals' own think(), and the rivals pass the bomb about and catch each other", () => {
  let rivalTags = 0;
  let rivalBlasts = 0;
  let fuses = 0;
  let tags = 0;
  for (let v = 1; v <= fuse.MAX_VENUE + 1; v++) {
    for (let k = 0; k < 4; k++) {
      const random = seeded(v * 13 + k);
      const round = fuse.newRound(random);
      fuse.newMatch(round, v, random, 0);
      const you = round.runners[0];
      let t = 0;
      for (; t < 120000 && round.phase !== "done"; t += 16) {
        // Half the runs leave you idle; the rest steer you as a rival would.
        if (k % 2 && t % 128 === 0 && you.alive && round.phase === "play") {
          const c = fuse.think(round, you, random);
          Object.assign(round.input, { left: c.x < -0.38, right: c.x > 0.38, up: c.y < -0.38, down: c.y > 0.38 });
          if (c.dash) fuse.dash(round, you, c);
        }
        fuse.advance(round, 16, random);
        for (const e of round.events) {
          if (e.type === "tag") tags += 1;
          if (e.type === "tag" && e.from !== 0) rivalTags += 1;
          if (e.type === "blast" && e.id !== 0) rivalBlasts += 1;
          if (e.type === "lit") fuses += 1;
        }
        round.events.length = 0;
      }
      assert.equal(round.phase, "done", `venue ${v} ends (${t} ms)`);
      assert.ok(t < 75000, `venue ${v} ends within a minute and a quarter (${t} ms)`);
    }
  }
  assert.ok(rivalTags > 80, `rivals pass the bomb (${rivalTags})`);
  assert.ok(rivalBlasts > 20, `and blow up too (${rivalBlasts})`);
  assert.ok(tags / fuses > 1 && tags / fuses < 9, `a sane number of passes a fuse (${(tags / fuses).toFixed(2)})`);
});

test("Hot Potato: a venue's numbers are built once, not on every slice, and past the ninth the Finale repeats, sharper", () => {
  assert.equal(fuse.venueFor(12), fuse.venueFor(12));
  assert.equal(fuse.rivalPower(3), fuse.rivalPower(3));
  assert.equal(fuse.rivalPower(12), fuse.rivalPower(12));
  assert.ok(Object.isFrozen(fuse.venueFor(12)) && Object.isFrozen(fuse.rivalPower(12)), "and nobody can change them");
  assert.equal(fuse.venueFor(11).title, "Finale 3");
  assert.ok(fuse.venueFor(11).fuse < fuse.VENUES[9].fuse);
  assert.ok(fuse.rivalPower(11).speed > fuse.rivalPower(9).speed);
  for (let v = 2; v <= fuse.MAX_VENUE; v++) assert.ok(fuse.VENUES[v].smart >= fuse.VENUES[v - 1].smart, `venue ${v} is no softer than ${v - 1}`);
  assert.equal(fuse.VENUES[4].open, true);
  assert.equal(fuse.VENUES[7].dark, true);
  assert.ok(fuse.LAYOUTS[5].ice.length && fuse.LAYOUTS[6].belts.length, "ice in the Ice Machine, belts in the Conveyor Hall");
});

test("Hot Potato: a belt carries a runner along, and ice lets it slide", () => {
  const round = potato(6);
  const you = round.runners[0];
  for (const r of round.runners) if (r !== you) spot(r, 10 + r.id * 12, 36);
  round.bombs[0].fuse = 1e6;
  spot(you, 40, 22);
  fuse.advance(round, 500, calm);
  assert.ok(you.x > 45, `the belt carried you right (${you.x.toFixed(1)})`);
  const ice = potato(5);
  const me = ice.runners[0];
  for (const r of ice.runners) if (r !== me) spot(r, 6 + r.id * 4, 66);
  ice.bombs[0].fuse = 1e6;
  spot(me, 31, 35);
  me.vx = 40;
  fuse.advance(ice, 100, calm);
  const slid = me.x - 31;
  const dry = potato(1);
  const dme = dry.runners[0];
  for (const r of dry.runners) if (r !== dme) spot(r, 6 + r.id * 4, 66);
  spot(dme, 40, ROW);
  dme.vx = 40;
  fuse.advance(dry, 100, calm);
  assert.ok(slid > (dme.x - 40) * 1.4, `slides further on ice (${slid.toFixed(1)} against ${(dme.x - 40).toFixed(1)})`);
});

test("Hot Potato: a rival color too near your highlight gives way to a spare, so no highlight leaves a rival beside you", () => {
  assert.deepEqual(fuse.rivalColors("#206cc3"), [...fuse.RIVAL_COLORS], "far from all of them: nothing changes");
  assert.deepEqual(fuse.rivalColors("not a color"), [...fuse.RIVAL_COLORS]);
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  for (const [id, accent] of Object.entries(ACCENTS)) {
    for (const you of [accent.light[0], accent.dark[0]]) {
      const colors = fuse.rivalColors(you);
      assert.equal(new Set(colors).size, colors.length, `${id}: no two rivals alike`);
      for (const c of colors) {
        const [a, b] = [rgb(c), rgb(you)];
        assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= fuse.NEAR_COLOR, `${id} ${you} beside ${c}`);
      }
    }
  }
});

test("Hot Potato: the pills never overlap, leave the board or spill out of their strip, even on the smallest board with every pill wanted", () => {
  const effects = [{ text: "SNEAKERS", color: "#fff", fill: 0.5 }, { text: "FROZEN", color: "#fff", fill: 0.5 }];
  for (const h of [Math.max(12 / fuse.MIN_CELL, 2.4), 2.4]) {
    for (const fuseText of [null, "YOURS 12.0", "FUSE 0.4"]) {
      for (let n = 0; n <= effects.length; n++) {
        const hud = { venue: "FINALE 12", charges: 1, maxCharges: 2, recharge: 0.5, left: 7, effects: effects.slice(0, n), streak: 5, fuse: fuseText ? { text: fuseText, color: "#fff" } : null };
        const pills = fuseHudLayout(h, fuse.W, 3, hud, fuse.HUD_H);
        assert.equal(pills.length, 5 + n + (fuseText ? 1 : 0));
        for (const p of pills) {
          assert.ok(p.x >= 0 && p.x + p.w <= fuse.W, `${p.text} stays on the board`);
          assert.ok(p.y >= 0 && p.y + p.h <= fuse.HUD_H, `${p.text} stays in the strip (h ${h})`);
        }
        for (let i = 0; i < pills.length; i++) {
          for (let j = i + 1; j < pills.length; j++) {
            const [p, q] = [pills[i], pills[j]];
            assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, `${p.text} and ${q.text} apart`);
          }
        }
      }
    }
  }
});

test("Hot Potato: a charred runner waddles to the nearest wall and stops there, never over the pills", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  handTo(a, round.bombs[0], 10);
  spot(a, 40, 5);
  spot(you, 60, 62);
  spot(b, 90, 62);
  spot(c, 10, 62);
  fuse.advance(round, fuse.OUT_MS + 32, calm);
  assert.equal(a.alive, false);
  assert.ok(a.y >= fuse.RUNNER_R - 1e-9, `it stops at the top wall (y ${a.y.toFixed(1)})`);
});

test("Hot Potato: a rival holder low on fuse goes for a Freeze or an Extra Fuse, never for Sneakers or a Swap", () => {
  for (const [kind, wanted] of [["freeze", true], ["extra", true], ["sneakers", false], ["swap", false]]) {
    const round = potato(2);
    const [you, a, b, c] = round.runners;
    handTo(a, round.bombs[0], 3000);
    spot(a, 40, ROW);
    spot(you, 80, ROW);
    spot(b, 94, 62);
    spot(c, 90, 62);
    round.pickups = [{ x: 30, y: ROW, kind, ttl: fuse.PICK_TTL_MS }];
    const choice = fuse.think(round, a, calm);
    assert.equal(choice.x < 0, wanted, `${kind}: ${wanted ? "goes for it" : "chases you instead"}`);
  }
});

/* -------------------------------------------------------- Hot Potato game */

// Starts a Hot Potato game past its hold with every rival standing still.
function potatoGame(opts = {}) {
  const { canvas, calls } = stubCanvas();
  const g = fuse.default.create({ canvas, ...opts });
  g.resize(900, 700);
  g.key("action");
  g.tick(400);
  for (const r of g.round.runners) if (r.id !== 0) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0 });
  return { g, calls };
}

test("Hot Potato: every pill's text reads at 4.5:1 on its backing and its timer's tint, lives, the dash, the fuse and the effects included, in light and dark under every highlight", () => {
  checkPills(fuse.default, {
    setup: (r) => {
      r.runners[0].fx.sneakers = fuse.SNEAKERS_MS / 2;
      r.freeze = fuse.FREEZE_MS / 2;
      r.streak = 2;
    },
    expect: ["VENUE 1", "♥", "DASH", "LEFT", "~SNEAKERS", "~FROZEN", "HOT x2"],
  });
});

test("Hot Potato game: held arrows run until let go, space dashes (its key repeat never), a pause lets go of everything, and the board refuses a tiny window", () => {
  const { canvas, calls } = stubCanvas();
  const g = fuse.default.create({ canvas });
  assert.equal(g.resize(fuse.W * fuse.MIN_CELL - 1, 2000), false, "too narrow to play");
  assert.equal(g.resize(fuse.W * fuse.MIN_CELL, fuse.H * fuse.MIN_CELL), true, "just big enough");
  assert.equal(g.resize(900, 700), true);
  assert.ok(calls.count > 0, "the start screen draws");
  assert.equal(typeof g.release, "function");
  g.key("action");
  assert.equal(g.state, "running");
  g.tick(400);
  assert.equal(g.round.phase, "play");
  for (const r of g.round.runners) if (r.id !== 0) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0 });
  const you = g.round.runners[0];
  const y = you.y;
  g.key("up");
  g.key("up", true);
  g.tick(200);
  assert.ok(you.y < y - 3, "held up runs up");
  g.release("up");
  assert.equal(g.round.input.up, false);
  g.key("left");
  g.key("action", true);
  assert.equal(you.charges, fuse.START_CHARGES, "a repeat of space never dashes");
  g.key("action");
  assert.equal(you.charges, fuse.START_CHARGES - 1, "space dashes");
  g.pause();
  assert.deepEqual(g.round.input, { up: false, down: false, left: false, right: false }, "a pause holds nothing");
  const clock = g.round.clock;
  g.tick(1000);
  assert.equal(g.round.clock, clock, "a paused game holds still");
  g.key("action");
  assert.equal(g.state, "running", "space plays on from a pause");
  assert.equal(you.charges, fuse.START_CHARGES - 1, "and does not also dash");
});

test("Hot Potato game: the start screen reads the furthest venue, the memo only grows, and the round's end calls onScore once with its score big on the end screen", () => {
  const texts = [];
  let font = "";
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push([String(text), font]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { if (name === "font") font = value; target[name] = value; return true; },
  });
  let saved = 3;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = fuse.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, memo, onScore: (n) => scores.push(n) });
  g.resize(900, 700);
  assert.ok(texts.some(([t]) => t.includes("Furthest: Server Room (venue 3 of 9)")), "the start screen names the furthest venue");
  assert.equal(saved, 3, "nothing is written by just opening it");
  const winMatch = () => {
    const r = g.round;
    const holder = r.runners[r.bombs[0].holder];
    for (const o of r.runners) if (o.id !== 0 && o !== holder) sitOut(o);
    for (const b of r.bombs) if (b !== r.bombs[0]) b.lit = false;
    r.bombs[0].fuse = 1;
    g.tick(16);
    assert.equal(r.result, "win");
    g.tick(fuse.DONE_MS + 16);
    g.tick(fuse.READY_MS + 16);
  };
  g.key("action");
  g.tick(400);
  winMatch();
  assert.equal(g.round.level, 2);
  assert.equal(saved, 3, "venue 2 is not past venue 3");
  winMatch();
  winMatch();
  assert.equal(g.round.level, 4);
  assert.equal(saved, 4, "a new furthest");
  const loseMatch = () => {
    handTo(g.round.runners[0], g.round.bombs[0], 1);
    g.tick(16);
    g.tick(fuse.DONE_MS + 16);
    g.tick(fuse.READY_MS + 16);
  };
  for (let i = 0; i < fuse.START_LIVES; i++) loseMatch();
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
  assert.ok(g.score > 0);
  texts.length = 0;
  g.tick(1000);
  g.resize(900, 700);
  assert.ok(texts.some(([t, f]) => t === String(g.score) && /\b7px/.test(f)), "the score, big");
  assert.equal(scores.length, 1, "once");
  g.key("action");
  g.tick(400);
  for (let i = 0; i < fuse.START_LIVES; i++) loseMatch();
  assert.equal(saved, 4, "a shorter round leaves it");
  assert.equal(scores.length, 2);
});

test("Hot Potato game: the fuse ticks quicker as it burns down, a pass pops, passing the best plays the fanfare once, and every venue draws", () => {
  const tones = [];
  const { g, calls } = potatoGame({ tone: (name) => tones.push(name), best: () => 5 });
  const [bomb] = g.round.bombs;
  const you = g.round.runners[0];
  for (const r of g.round.runners) if (r !== you) spot(r, 10 + r.id * 25, 62);
  spot(you, 40, ROW);
  bomb.fuse = fuse.FUSE_MS;
  tones.length = 0;
  for (let t = 0; t < 2000; t += 16) g.tick(16);
  const slow = tones.filter((n) => n === "tick").length;
  bomb.fuse = 2500;
  tones.length = 0;
  for (let t = 0; t < 1500; t += 16) g.tick(16);
  const quick = tones.filter((n) => n === "tick").length;
  assert.ok(slow >= 2, `the full fuse ticks (${slow} in 2 s)`);
  assert.ok(quick / 1.5 > (slow / 2) * 2, `and twice as fast near the end (${quick} in 1.5 s)`);
  handTo(you, bomb, 5000);
  const a = g.round.runners[1];
  spot(a, you.x + 5.8, you.y);
  g.tick(16);
  assert.equal(bomb.holder, a.id);
  assert.ok(tones.includes("pop"), "the pass pops");
  g.round.score = 6;
  g.tick(16);
  g.tick(16);
  assert.equal(tones.filter((t) => t === "best").length, 1);
  for (let n = 1; n <= fuse.MAX_VENUE + 1; n++) {
    fuse.newMatch(g.round, n, steady, 0);
    g.round.lives = 99;
    const drawn = calls.count;
    for (let k = 0; k < 60; k++) g.tick(50);
    assert.ok(calls.count > drawn, `venue ${n} draws`);
  }
});

test("Hot Potato game: handed the bomb at its last moment, your fuse pill, the countdown over the bomb and the tick all follow the lifted fuse", () => {
  const texts = [];
  const tones = [];
  const ctx = new Proxy({}, {
    get: (t, name) => (name === "fillText" ? (text) => texts.push(String(text)) : name in t ? t[name] : () => {}),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const g = fuse.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, tone: (name) => tones.push(name) });
  g.resize(900, 700);
  g.key("action");
  g.tick(400);
  const [you, a, b, c] = g.round.runners;
  for (const r of [a, b, c]) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0 });
  const [bomb] = g.round.bombs;
  spot(b, 90, 62);
  spot(c, 10, 62);
  handTo(a, bomb, 150);
  spot(a, 30, ROW);
  spot(you, 35.8, ROW);
  texts.length = 0;
  g.tick(16);
  assert.equal(bomb.holder, 0);
  assert.ok(texts.includes("YOURS 1.4"), `the pill reads the lifted fuse (${texts.filter((t) => t.startsWith("YOURS"))})`);
  assert.ok(texts.includes("2"), "and the countdown over the bomb counts from it");
  spot(a, 10, 35);
  tones.length = 0;
  let t = 0;
  for (; t < 3000 && you.alive; t += 16) g.tick(16);
  assert.ok(t >= fuse.PASS_FLOOR_MS - 32, `the fuse burns its lifted time before it blows (${t} ms)`);
  assert.ok(tones.filter((n) => n === "tick").length >= 5, "ticking all the way");
});

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

test("Hot Potato: a fuse that runs out in the slice its holder touches someone blows on the holder, never on the one it touched", () => {
  const round = potato(1);
  const [you, a, b, c] = round.runners;
  const [bomb] = round.bombs;
  handTo(a, bomb, 4);
  spot(a, 30, ROW);
  spot(you, 35.8, ROW);
  spot(b, 90, ROW);
  spot(c, 10, 62);
  fuse.advance(round, 8, calm);
  assert.equal(fuseEvents(round, "tag").length, 0, "a spent bomb passes to nobody");
  assert.deepEqual(fuseEvents(round, "blast").map((e) => e.id), [a.id], "it blows on its holder");
  assert.equal(you.alive, true);
  assert.equal(round.phase, "play");
});

test("Hot Potato game: two bombs burning tick on one clock, no quicker than one bomb alone", () => {
  const ticksIn = (bombs) => {
    const tones = [];
    const { g } = potatoGame({ tone: (name) => tones.push(name) });
    fuse.newMatch(g.round, 8, steady, 0);
    g.tick(16);
    for (const r of g.round.runners) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0, x: 6 + r.id * 14, y: 4, vx: 0, vy: 0 });
    g.round.bombs.forEach((b, i) => (b.lit = i < bombs));
    tones.length = 0;
    for (let t = 0; t < 1200; t += 16) {
      for (const b of g.round.bombs) b.fuse = 900;
      g.tick(16);
    }
    return tones.filter((n) => n === "tick").length;
  };
  const one = ticksIn(1);
  const two = ticksIn(2);
  assert.ok(one >= 4, `one bomb near its end ticks (${one} in 1.2 s)`);
  assert.ok(two <= one, `two bombs tick no quicker (${two} against ${one})`);
});

test("Hot Potato game: blown up, you are still drawn as Planny, charred, with your star eye", () => {
  const { canvas, fills } = styleCanvas();
  const g = fuse.default.create({ canvas });
  g.resize(900, 700);
  g.key("action");
  g.tick(400);
  const you = g.round.runners[0];
  Object.assign(you, { alive: false, out: "blast", outMs: fuse.OUT_MS / 2 });
  g.round.events.length = 0;
  fills.length = 0;
  g.resize(900, 700);
  assert.ok(fills.includes(FUSE_CHAR), "a charred body");
  assert.ok(fills.includes("#206cc3"), "and the star eye in your highlight");
});

test("Hot Potato: arms and feet on the floor stand out from every venue's tiles, light floors or dark, in either theme", () => {
  for (let v = 1; v <= fuse.MAX_VENUE + 1; v++) {
    const t = fuseTheme(v);
    const ink = fuseLimbInk(v);
    for (const tile of [t.a, t.b]) assert.ok(fuseContrast(ink, tile) >= 3, `venue ${v}: ${ink} on ${tile} (${fuseContrast(ink, tile).toFixed(2)})`);
  }
  assert.notEqual(fuseLimbInk(3), "#1d1a17", "the Server Room's dark floor gets the light ink");
  const { canvas, strokes } = styleCanvas();
  const g = fuse.default.create({ canvas });
  g.resize(900, 700);
  g.key("action");
  g.tick(400);
  fuse.newMatch(g.round, 3, steady, 0);
  strokes.length = 0;
  g.resize(900, 700);
  assert.ok(strokes.includes(fuseLimbInk(3)), "and the drawing uses it there, whatever the page's ink");
});

test("Hot Potato game: the safe-from-a-tag-back ring has a dark edge under its white, so it shows on the pale floors", () => {
  const { canvas, strokes } = styleCanvas();
  const g = fuse.default.create({ canvas });
  g.resize(900, 700);
  g.key("action");
  g.tick(400);
  const [you, a] = g.round.runners;
  Object.assign(g.round.bombs[0], { holder: you.id, from: { id: a.id, at: g.round.clock } });
  assert.ok(fuse.tagSafe(g.round, a));
  strokes.length = 0;
  g.resize(900, 700);
  const at = strokes.indexOf(FUSE_SAFE_EDGE);
  assert.ok(at >= 0 && strokes[at + 1] === FUSE_SAFE_RING, "the edge, then the white ring");
});

test("Hot Potato: the last seconds' number stays on the arena wherever the holder stands, under its feet when it hugs the top wall", () => {
  for (let y = fuse.RUNNER_R; y <= fuse.AH - fuse.RUNNER_R; y += 0.5) {
    for (const r of [1.7, 2.6]) {
      const n = fuseCountY(y - 7.6, r, y);
      assert.ok(n - 1.6 >= 0 && n + 1.6 <= fuse.AH, `holder at y ${y}: the number at ${n.toFixed(1)}`);
    }
  }
  assert.ok(fuseCountY(3 - 7.6, 2.4, 3) > 3, "under the feet at the top wall");
  assert.ok(fuseCountY(40 - 7.6, 2.4, 40) < 40 - 7.6, "over the bomb in the open");
});

test("Hot Potato game: the opening banner sits in the arena from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const { canvas, shades } = bannerCanvas("rgba(0, 0, 0, 0.32)");
  const g = fuse.default.create({ canvas });
  g.resize(900, 900);
  openingBanner(g, shades, fuse.AH);
});

/* ---------------------------------------------------- Crossing Rush rules */

// A heat at `zone` from `seed`, past its hold, the rivals parked (they never
// choose) unless `still` is false, and no pickups.
function crossing(zone = 1, { seed = 7, still = true, random = calm } = {}) {
  const round = hop.newRound(random);
  round.seed = seed;
  hop.newHeat(round, zone, random, 0);
  hop.advance(round, 8, random);
  assert.equal(round.phase, "play");
  if (still) for (const h of round.hoppers) if (h.id !== 0) parkHopper(h);
  round.pickups = [];
  round.events.length = 0;
  return round;
}

// Parks a rival where it stands: never choosing again, and no hop in the air
// whose landing would start it choosing.
const parkHopper = (h) => Object.assign(h, { hop: null, think: 1e9 });

const hopEvents = (round, type) => round.events.filter((e) => e.type === type);

// Rebuilds a lane by hand: its kind, and cars or floats as [left edge, length]
// standing still unless `extra` says otherwise.
function setLane(round, row, kind, items = [], extra = {}) {
  const lane = round.lanes[row];
  Object.assign(lane, { kind, speed: 0, shift: 0, drift: 0, dir: 1, span: hop.COLS + hop.MARGIN * 2 + 20, trees: new Array(hop.COLS).fill(0), icy: false, surge: 0, flip: 0, stop: 0 }, extra);
  lane.items = items.map(([x, len, k]) => ({ kind: k || (kind === "river" ? "log" : "car"), p: x + hop.MARGIN, len, tint: 0, dive: false, phase: 0 }));
  return lane;
}

// Puts a hopper on a cell, standing.
const place = (h, row, x, face = "up") => Object.assign(h, { row, x, face, hop: null, back: null, daze: 0, queued: null, finished: false });

test("Crossing Rush: buildLanes builds the same lanes from the same seed, the pavement first and the finish last, grass between the groups and each zone's new thing first", () => {
  const firstHazard = (lanes) => lanes.find((l) => !hop.isSafe(l));
  for (let z = 1; z <= hop.MAX_ZONE + 1; z++) {
    const a = hop.buildLanes(z, 42);
    assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(hop.buildLanes(z, 42))), `zone ${z}: the same seed, the same lanes`);
    assert.notDeepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(hop.buildLanes(z, 43))), `zone ${z}: another seed, other lanes`);
    for (const seed of [1, 2, 3, 99]) {
      const lanes = hop.buildLanes(z, seed);
      assert.equal(lanes.length, hop.zoneFor(z).rows);
      assert.equal(lanes[0].kind, "start");
      assert.equal(lanes.at(-1).kind, "goal");
      lanes.forEach((l, i) => assert.equal(l.row, i));
      for (let i = 1; i < lanes.length - 1; i++) {
        if (lanes[i].kind !== "grass") continue;
        assert.notEqual(lanes[i + 1].kind, "grass", `zone ${z}: never two grass rows together`);
        assert.ok(lanes[i].trees.filter((t) => !t).length >= 6, `zone ${z}: a grass row keeps at least six open cells`);
      }
      // No impossible lane: every gap between cars is at least the zone's, and
      // the water always has something to stand on coming.
      for (const l of lanes) {
        if (l.kind !== "road" && l.kind !== "river") continue;
        const its = l.items.slice().sort((p, q) => p.p - q.p);
        for (let k = 0; k < its.length; k++) {
          const next = k + 1 < its.length ? its[k + 1].p : its[0].p + l.span;
          const gap = next - (its[k].p + its[k].len);
          if (l.kind === "road") assert.ok(gap >= hop.zoneFor(z).gap - 1e-9, `zone ${z}: a gap of ${gap.toFixed(2)} between cars`);
          else assert.ok(gap <= 3.2, `zone ${z}: a gap of ${gap.toFixed(2)} in the water`);
        }
        if (l.items.some((it) => it.kind === "turtle")) assert.ok(l.items.some((it) => !it.dive), `zone ${z}: a turtle lane always has turtles that stay up`);
      }
    }
    const lanes = hop.buildLanes(z, 5);
    const first = firstHazard(lanes);
    if (z === 1) assert.equal(first.kind, "road");
    if (z === 2) assert.equal(first.kind, "river");
    if (z === 3) assert.equal(first.kind, "rail");
    if (z === 4) assert.ok(first.items.some((it) => it.dive), "Turtle Bay opens on diving turtles");
    if (z === 5) assert.ok(first.surge && lanes.some((l) => l.items.some((it) => it.kind === "truck")), "the Highway opens on a surging lane, with trucks");
    if (z === 7) assert.ok(first.flip, "Rapids opens on a river that turns round");
    if (z === 8) assert.ok(first.icy, "the Ice Road opens on ice");
  }
  assert.equal(hop.ZONES[6].dark, true);
});

test("Crossing Rush: a hop onto a car sends you back to the last grass row, a car on you mid-lane does too, and the flight takes SENDBACK_MS", () => {
  const round = crossing(1);
  const you = round.hoppers[0];
  setLane(round, 1, "road", [[4.6, 1.2]]);
  place(you, 0, 5);
  assert.ok(hop.occupied(round, 1, 5), "the car is on column 5");
  assert.equal(hop.occupied(round, 1, 7), false);
  assert.ok(hop.hop(round, you, "up"));
  hop.advance(round, hop.HOP_MS / 2 - 8, calm);
  assert.equal(you.back, null, "still in the cell it left for the first half");
  hop.advance(round, 16, calm);
  assert.deepEqual(hopEvents(round, "back").map((e) => [e.id, e.cause]), [[0, "car"]]);
  assert.equal(you.back.toRow, 0);
  assert.equal(hop.hop(round, you, "up"), false, "no hops while flying back");
  hop.advance(round, hop.SENDBACK_MS, calm);
  assert.deepEqual([you.back, you.row, you.x], [null, 0, 5]);
  // Down, it stands dazed for DAZE_MS before it may hop again.
  assert.ok(you.daze > hop.DAZE_MS - 50, "dazed on landing");
  assert.equal(hop.hop(round, you, "up"), false, "no hops while dazed");
  hop.advance(round, hop.DAZE_MS, calm);
  assert.equal(you.daze, 0);
  setLane(round, 1, "grass");
  assert.ok(hop.hop(round, you, "up"), "and then it may");
  // Higher up, back to the grass row under the road.
  setLane(round, 3, "grass");
  setLane(round, 4, "road", [[6.5, 2]]);
  place(you, 4, 7);
  round.events.length = 0;
  hop.advance(round, 8, calm);
  assert.equal(you.back.toRow, 3);
  assert.equal(round.clean, false, "a heat with a send-back is not clean");
});

test("Crossing Rush: standing on a log carries you with it, the water with nothing to stand on sends you back, and so does riding off the edge", () => {
  const round = crossing(2);
  const you = round.hoppers[0];
  setLane(round, 1, "river", [[3.5, 3]], { speed: 2, dir: 1 });
  place(you, 0, 5);
  hop.hop(round, you, "up");
  hop.advance(round, hop.HOP_MS, calm);
  assert.equal(you.row, 1);
  const x = you.x;
  hop.advance(round, 500, calm);
  assert.ok(Math.abs(you.x - (x + 1)) < 0.05, `the log carried you a cell in half a second (${you.x.toFixed(2)})`);
  assert.equal(you.back, null);
  hop.advance(round, 3000, calm);
  assert.deepEqual(hopEvents(round, "back").map((e) => e.cause), ["swept"], "off the edge on the log");
  const wet = crossing(2);
  setLane(wet, 1, "river", [[8, 2]]);
  place(wet.hoppers[0], 0, 5);
  assert.ok(hop.occupied(wet, 1, 5), "open water is no place to stand");
  hop.hop(wet, wet.hoppers[0], "up");
  hop.advance(wet, hop.HOP_MS / 2 + 8, calm);
  assert.equal(wet.hoppers[0].back, null, "mid-hop over the water is fine");
  hop.advance(wet, hop.HOP_MS / 2, calm);
  assert.deepEqual(hopEvents(wet, "back").map((e) => e.cause), ["splash"]);
});

test("Crossing Rush: pickups stack in the order you land on them, space uses the oldest first, a coin scores at once, and a new heat starts with none", () => {
  const round = crossing(1);
  const you = round.hoppers[0];
  setLane(round, 1, "grass");
  setLane(round, 2, "road");
  setLane(round, 3, "grass");
  place(you, 1, 5);
  hop.applyPower(round, you, "horn");
  hop.applyPower(round, you, "coin");
  hop.applyPower(round, you, "shield");
  assert.deepEqual(you.powers, ["horn", "shield"], "the coin is not stacked");
  assert.equal(round.score, hop.COIN_POINTS);
  assert.equal(you.shield, 0, "nothing goes off until space");
  assert.ok(hop.usePower(round, you));
  assert.deepEqual(you.powers, ["shield"], "the Horn went first");
  assert.equal(round.lanes[2].stop, hop.HORN_MS);
  assert.ok(hop.usePower(round, you));
  assert.equal(you.shield, hop.SHIELD_MS);
  assert.equal(hop.usePower(round, you), false, "an empty stack does nothing");
  assert.equal(round.powersUsed, 2);
  // Mid-hop, the use waits for the landing.
  hop.applyPower(round, you, "horn");
  assert.ok(hop.hop(round, you, "up"));
  assert.ok(hop.usePower(round, you));
  assert.deepEqual([you.queued, you.powers.length], ["power", 1]);
  hop.advance(round, hop.HOP_MS + 16, calm);
  assert.deepEqual([you.queued, you.powers.length], [null, 0], "and goes off once down");
  // A rival uses a pickup the moment it lands on it.
  const a = round.hoppers[1];
  hop.applyPower(round, a, "shield");
  assert.deepEqual([a.powers.length, a.shield], [0, hop.SHIELD_MS]);
  // Nothing carries over to the next heat.
  hop.applyPower(round, you, "spring");
  hop.newHeat(round, 2, calm, 0);
  assert.deepEqual(round.hoppers[0].powers, []);
});

test("Crossing Rush: the first home wins; two home in the same slice finish by the moment each landed, a dead heat to you; zone 1 lets second place through, zone 3 does not", () => {
  const race = (zone, rivalAhead) => {
    const round = crossing(zone);
    const [you, a] = round.hoppers;
    const top = round.rows - 1;
    setLane(round, top - 1, "grass");
    place(you, top - 1, 5);
    place(a, top - 1, 2);
    hop.hop(round, you, "up");
    hop.hop(round, a, "up");
    a.hop.ms = rivalAhead;
    for (let t = 0; t < 400 && round.phase === "play"; t += 8) hop.advance(round, 8, calm);
    return round;
  };
  const tie = race(3, 0);
  assert.equal(tie.result, "win", "a dead heat goes to you");
  assert.deepEqual(hopEvents(tie, "finish").map((e) => [e.id, e.place]), [[0, 1], [1, 2]]);
  const beaten = race(3, 4);
  assert.deepEqual(hopEvents(beaten, "finish").map((e) => e.id), [1, 0], "the rival landed 4 ms sooner, in the same slice");
  assert.equal(beaten.result, "lose");
  assert.equal(beaten.lives, hop.START_LIVES - 1);
  const pass = race(1, 4);
  assert.equal(pass.result, "pass", "second place gets through zone 1");
  assert.equal(pass.lives, hop.START_LIVES);
  assert.equal(pass.heatsWon, 0, "but it is not a win");
});

test("Crossing Rush: a lost heat runs again on the same lanes, a win moves on to new ones, and the last life ends the round", () => {
  const round = crossing(3);
  const shape = (r) => r.lanes.map((l) => `${l.kind}:${l.items.length}:${l.trees.join("")}`).join("|");
  const before = shape(round);
  round.hoppers[1].finished = true;
  round.finishers.push(round.hoppers[1]);
  round.hoppers[1].place = 1;
  hop.advance(round, 8, calm);
  assert.equal(round.result, "lose");
  hop.advance(round, hop.DONE_MS + 16, calm);
  assert.equal(round.level, 3);
  assert.equal(shape(round), before, "the same lanes again");
  assert.equal(hopEvents(round, "retry").length, 1);
  const won = crossing(3);
  const top = won.rows - 1;
  setLane(won, top - 1, "grass");
  place(won.hoppers[0], top - 1, 5);
  hop.hop(won, won.hoppers[0], "up");
  hop.advance(won, hop.HOP_MS + hop.DONE_MS + 32, calm);
  assert.equal(won.level, 4);
  assert.equal(hopEvents(won, "level").length, 1);
  const last = crossing(3);
  last.lives = 1;
  last.hoppers[1].finished = true;
  last.finishers.push(last.hoppers[1]);
  last.hoppers[1].place = 1;
  hop.advance(last, hop.DONE_MS + 32, calm);
  assert.equal(last.over, true);
  assert.equal(hop.advance(last, 1000, calm), "over");
});

test("Crossing Rush: points are a row higher, a win of 50 times the zone times the clean streak plus 3 a row of lead, and a close call", () => {
  const winAt = (zone, { streak = 0, clean = true } = {}) => {
    const round = crossing(zone);
    const [you, a, b] = round.hoppers;
    const top = round.rows - 1;
    setLane(round, top - 1, "grass");
    place(you, top - 1, 5);
    you.furthest = top;
    place(a, 4, 2);
    place(b, 6, 8);
    Object.assign(round, { score: 0, streak, clean });
    hop.hop(round, you, "up");
    hop.advance(round, hop.HOP_MS + 8, calm);
    assert.equal(round.result, "win");
    return round;
  };
  const one = winAt(3);
  assert.equal(one.score, hop.WIN_POINTS * 3 + hop.LEAD_POINTS * (one.rows - 1 - 6));
  assert.equal(one.streak, 1);
  const two = winAt(3, { streak: 1 });
  assert.equal(two.score, hop.WIN_POINTS * 3 * 2 + hop.LEAD_POINTS * (two.rows - 1 - 6), "a second clean win in a row, times 2");
  const top = winAt(3, { streak: hop.MAX_STREAK });
  assert.equal(top.streak, hop.MAX_STREAK, "never past MAX_STREAK");
  assert.equal(top.score, hop.WIN_POINTS * 3 * hop.MAX_STREAK + hop.LEAD_POINTS * (top.rows - 1 - 6));
  const dirty = winAt(3, { streak: 2, clean: false });
  assert.equal(dirty.streak, 0, "a win after a send-back ends the streak");
  assert.equal(dirty.score, hop.WIN_POINTS * 3 + hop.LEAD_POINTS * (dirty.rows - 1 - 6));
  // A row higher than you had got, once.
  const round = crossing(1);
  const you = round.hoppers[0];
  setLane(round, 1, "grass");
  place(you, 0, 5);
  hop.hop(round, you, "up");
  hop.advance(round, hop.HOP_MS + 8, calm);
  assert.equal(round.score, hop.PROGRESS_POINTS);
  hop.hop(round, you, "down");
  hop.advance(round, hop.HOP_MS + 8, calm);
  hop.hop(round, you, "up");
  hop.advance(round, hop.HOP_MS + 8, calm);
  assert.equal(round.score, hop.PROGRESS_POINTS, "a row already reached scores nothing more");
  // A car through the cell you just left.
  const close = crossing(1);
  const me = close.hoppers[0];
  setLane(close, 1, "road", [[5.7, 1.2]], { speed: 3, dir: -1 });
  setLane(close, 2, "grass");
  place(me, 1, 5);
  me.furthest = 9;
  hop.hop(close, me, "up");
  hop.advance(close, hop.HOP_MS + hop.CLOSE_MS, calm);
  assert.equal(me.back, null, "it missed you");
  assert.deepEqual(hopEvents(close, "close").map((e) => e.points), [hop.CLOSE_POINTS]);
  assert.equal(close.score, hop.CLOSE_POINTS);
});

test("Crossing Rush: a train lane warns for WARN_MS and then its train sends back whoever stands on it; a diving turtle under the water holds nobody up", () => {
  const round = crossing(3);
  const you = round.hoppers[0];
  setLane(round, 1, "rail", [], { phase: "idle", phaseMs: 100, nextIdle: 4000, dir: 1 });
  place(you, 1, 5);
  assert.equal(hop.occupied(round, 1, 5), false);
  assert.ok(hop.occupied(round, 1, 5, 100 + hop.WARN_MS + hop.PASS_MS / 2), "the train is on column 5 half way through its pass");
  hop.advance(round, 104, calm);
  assert.deepEqual(hopEvents(round, "warn").map((e) => e.row), [1]);
  assert.equal(you.back, null);
  hop.advance(round, hop.WARN_MS, calm);
  assert.equal(hopEvents(round, "train").length, 1);
  hop.advance(round, hop.PASS_MS, calm);
  assert.deepEqual(hopEvents(round, "back").map((e) => e.cause), ["train"]);
  assert.equal(round.lanes[1].phase, "idle", "and the lane goes quiet again");
  const bay = crossing(4);
  const lane = setLane(bay, 1, "river", [[4, 3, "turtle"]]);
  assert.equal(hop.occupied(bay, 1, 5), false, "turtles up hold you");
  lane.items[0].dive = true;
  lane.items[0].phase = hop.TURTLE_UP_MS + hop.TURTLE_SINK_MS + 100 - bay.clock;
  assert.equal(hop.turtleState(lane.items[0], bay.clock), 2);
  assert.ok(hop.occupied(bay, 1, 5), "under, they hold nobody");
});

test("Crossing Rush: a Spring leaps two cells the way you face (kept when that cell is shut), a Shield lets cars through for SHIELD_MS, a Horn stops the nearest road, and an icy lane slides you a cell on", () => {
  const round = crossing(1);
  const you = round.hoppers[0];
  setLane(round, 1, "road", [[4.6, 1.2]]);
  setLane(round, 2, "grass");
  place(you, 0, 5);
  hop.applyPower(round, you, "spring");
  assert.ok(hop.usePower(round, you));
  assert.equal(you.hop.toRow, 2, "over the car");
  assert.equal(you.spring, false);
  hop.advance(round, hop.SPRING_MS + 8, calm);
  assert.deepEqual([you.row, you.back], [2, null]);
  // Facing right, it leaps right; into a rock it stays in the stack.
  place(you, 2, 5, "right");
  round.lanes[2].trees[7] = 2;
  hop.applyPower(round, you, "spring");
  round.events.length = 0;
  assert.equal(hop.usePower(round, you), false);
  assert.deepEqual([you.powers, hopEvents(round, "bonk").length], [["spring"], 1]);
  round.lanes[2].trees[7] = 0;
  assert.ok(hop.usePower(round, you));
  assert.deepEqual([you.hop.toRow, you.hop.toX], [2, 7]);
  // A slow truck rolling over you takes 2.3 s to pass: the Shield holds on
  // until it has gone by, then runs out.
  const shield = crossing(5);
  const me = shield.hoppers[0];
  setLane(shield, 1, "road", [[2.5, 3, "truck"]], { speed: 1.2, dir: 1 });
  place(me, 1, 5);
  hop.applyPower(shield, me, "shield");
  hop.usePower(shield, me);
  hop.advance(shield, 8, calm);
  assert.equal(hopEvents(shield, "shield").length, 1);
  assert.equal(me.back, null);
  hop.advance(shield, 2000, calm);
  assert.equal(me.back, null, "nothing hits while the Shield is up");
  hop.advance(shield, hop.SHIELD_MS, calm);
  assert.deepEqual([me.back, me.shield], [null, 0], "and it runs out once the truck has gone by");
  setLane(shield, 1, "road", [[4.6, 1.2]]);
  hop.advance(shield, 8, calm);
  assert.notEqual(me.back, null, "then the next car does send you back");
  const horn = crossing(1);
  const road = setLane(horn, 2, "road", [[0, 1.2]], { speed: 2 });
  setLane(horn, 1, "grass");
  place(horn.hoppers[0], 1, 5);
  hop.applyPower(horn, horn.hoppers[0], "horn");
  hop.usePower(horn, horn.hoppers[0]);
  assert.equal(road.stop, hop.HORN_MS);
  hop.advance(horn, 1000, calm);
  assert.equal(road.shift, 0, "the cars stand still");
  hop.advance(horn, 1000, calm);
  assert.ok(road.shift > 0.9, "and move on after HORN_MS");
  assert.equal(hop.applyPower(horn, horn.hoppers[0], "nope"), false);
  const ice = crossing(8);
  setLane(ice, 1, "road", [], { icy: true });
  setLane(ice, 2, "grass");
  place(ice.hoppers[0], 0, 5);
  hop.hop(ice, ice.hoppers[0], "up");
  hop.advance(ice, hop.HOP_MS * 2 + 8, calm);
  assert.equal(ice.hoppers[0].row, 2, "slid a cell on");
  assert.equal(hopEvents(ice, "slide").length, 1);
});

test("Crossing Rush: at full sharpness the planner never picks a hop onto a car, a train or the open water, in any zone, and rivals it drives are hardly ever sent back", () => {
  let looks = 0;
  let hops = 0;
  let backs = 0;
  const T = { row: 0, x: 0 };
  for (let z = 1; z <= hop.MAX_ZONE + 1; z++) {
    // The boldest rival made sharp: the least room to spare.
    const bold = { ...hop.rivalPower(z).daredevil, depth: 5, mistake: 0, noise: 0 };
    for (let k = 0; k < 2; k++) {
      const random = seeded(z * 31 + k);
      const round = crossing(z, { seed: z * 17 + k, random });
      for (let t = 0; t < 40000 && round.phase === "play"; t += 16) {
        for (const h of round.hoppers) {
          if (h.id === 0 || h.hop || h.back || h.finished || h.daze) continue;
          // A rival whose own cell is hit within half a hop whatever it does
          // has no safe choice to make.
          if (hop.laneAt(round, h.row).kind !== "river" && hop.occupied(round, h.row, h.x, hop.HOP_MS / 2)) continue;
          const dir = hop.plan(round, h, random, bold);
          looks += 1;
          if (!dir) continue;
          hops += 1;
          assert.ok(hop.target(round, h.row, h.x, dir, T), `zone ${z}: a hop the board allows`);
          const into = hop.laneAt(round, T.row);
          // The cell it lands on, when it lands and (off the water) from the
          // moment it starts to count there.
          assert.equal(hop.occupied(round, T.row, T.x, hop.HOP_MS), false, `zone ${z}: ${h.kind} hops ${dir} into ${into.kind} row ${T.row} at ${T.x.toFixed(2)}`);
          if (into.kind !== "river") assert.equal(hop.occupied(round, T.row, T.x, hop.HOP_MS / 2), false, `zone ${z}: counted there at the half`);
          hop.hop(round, h, dir);
        }
        hop.advance(round, 16, random);
        backs += hopEvents(round, "back").filter((e) => e.id !== 0).length;
        round.events.length = 0;
      }
    }
  }
  assert.ok(looks > 2000 && hops > 600, `the planner was asked enough (${looks} looks, ${hops} hops)`);
  assert.ok(backs <= hops / 100, `and what it drove was hardly ever sent back (${backs} in ${hops} hops)`);
});

test("Crossing Rush: whole heats end in every zone, the rivals get home in 11 to 50 seconds, and a sharp hopper alone can cross every zone", () => {
  for (let z = 1; z <= hop.MAX_ZONE + 1; z++) {
    for (let k = 0; k < 2; k++) {
      const random = seeded(z * 7 + k);
      const race = crossing(z, { seed: z * 11 + k, still: false, random });
      let first = null;
      let t = 0;
      for (; t < 150000 && race.phase === "play"; t += 16) {
        hop.advance(race, 16, random);
        if (first === null && race.finishers.length) first = t;
        race.events.length = 0;
      }
      assert.equal(race.phase, "done", `zone ${z} ends (${t} ms)`);
      assert.ok(first >= 11000 && first <= 50000, `zone ${z}: the first rival home at ${(first / 1000).toFixed(1)} s`);
      // Crossable: you alone, run by the planner, the rivals parked.
      const solo = crossing(z, { seed: z * 11 + k, random });
      const you = solo.hoppers[0];
      for (t = 0; t < 90000 && !you.finished; t += 16) {
        if (!you.hop && !you.back && !you.daze) {
          const dir = hop.plan(solo, you, random, hop.SHARP_POWER);
          if (dir) hop.hop(solo, you, dir);
        }
        hop.advance(solo, 16, random);
        solo.events.length = 0;
      }
      assert.ok(you.finished, `zone ${z} seed ${z * 11 + k} can be crossed (${(t / 1000).toFixed(1)} s)`);
    }
  }
});

test("Crossing Rush: with a Spring, a sharp rival never takes the long hop from a cell a car reaches before its half", () => {
  let chosen = 0;
  for (let edge = -3; edge < 4.6; edge += 0.01) {
    const round = crossing(9);
    const h = round.hoppers[1];
    setLane(round, 0, "grass");
    setLane(round, 1, "road", [[edge, 1.2]], { speed: 4, dir: 1 });
    setLane(round, 2, "road");
    setLane(round, 3, "grass");
    place(h, 1, 5);
    h.spring = true;
    // A car on the cell before the long hop's half leaves no way out: with a
    // Spring every hop is the long one.
    if (hop.occupied(round, 1, 5, hop.SPRING_MS / 2)) continue;
    const dir = hop.plan(round, h, calm, { ...hop.SHARP_POWER, margin: 0.02 });
    if (dir !== "up") continue;
    chosen += 1;
    assert.ok(hop.hop(round, h, dir) && h.hop.kind === "spring");
    h.think = 1e9;
    hop.advance(round, hop.SPRING_MS + 16, calm);
    assert.deepEqual(hopEvents(round, "back").map((e) => e.id), [], `a car ${edge.toFixed(2)} along caught the Spring hop in the cell it left`);
    assert.equal(h.row, 3);
  }
  assert.ok(chosen > 100, `the Spring hop was taken (${chosen} times)`);
});

test("Crossing Rush: a rival sent back stands dazed for DAZE_MS too before its planner picks a hop", () => {
  const round = crossing(1, { still: false });
  const a = round.hoppers[1];
  setLane(round, 1, "grass");
  setLane(round, 2, "grass");
  place(a, 2, 5);
  hop.sendBack(round, a, "car");
  hop.advance(round, hop.SENDBACK_MS + 8, calm);
  assert.equal(a.back, null);
  assert.ok(a.daze > 0);
  assert.equal(hop.plan(round, a, calm), null, "no plan while dazed");
  const at = [a.row, a.x];
  hop.advance(round, hop.DAZE_MS - 100, calm);
  assert.deepEqual([a.row, a.x, a.hop], [...at, null], "it stands still");
});

test("Crossing Rush: a Tagalong follows you up, sideways toward you rather than straight on", () => {
  const round = crossing(7);
  const [you, tag] = round.hoppers;
  assert.equal(tag.kind, "tagalong");
  for (let r = 1; r < round.rows - 1; r++) setLane(round, r, "grass");
  const P = { ...hop.rivalPower(7).tagalong, mistake: 0, noise: 0 };
  place(you, 8, 9);
  place(tag, 7, 1);
  assert.equal(hop.plan(round, tag, calm, P), "right", "a row behind you and far across, it closes in on you");
  assert.equal(hop.plan(round, tag, calm, { ...P, tag: false }), "up", "where any other rival would climb");
});

test("Crossing Rush: a careful rival in an end column beside a bush still hops onto a log that covers it", () => {
  const round = crossing(2);
  const h = round.hoppers[1];
  assert.equal(h.kind, "hopper");
  setLane(round, 1, "river");
  setLane(round, 2, "grass");
  round.lanes[2].trees[1] = 1;
  setLane(round, 3, "river", [[-0.5, 11]]);
  setLane(round, 4, "grass");
  place(h, 2, 0);
  // Before the fix every hop onto the water looked unsafe from column 0, so
  // a Hopper swept back there sat out the heat.
  assert.equal(hop.plan(round, h, calm, { ...hop.rivalPower(2).hopper, mistake: 0, noise: 0 }), "up");
});

test("Crossing Rush: shiftAt foresees exactly where a Rapids lane that flips, a Highway lane that surges and a lane a Horn holds will have flowed to", () => {
  const lanesOf = (zone, test) => {
    const round = crossing(zone, { seed: 5 });
    return [round, round.lanes.filter(test)];
  };
  const checks = [
    lanesOf(7, (l) => l.kind === "river" && l.flip),
    lanesOf(5, (l) => l.kind === "road" && l.surge),
    lanesOf(1, (l) => l.kind === "road"),
  ];
  checks[2][1][0].stop = hop.HORN_MS;
  for (const [round, lanes] of checks) {
    assert.ok(lanes.length > 0);
    for (const ms of [8, 640, hop.HORN_MS + 40, hop.FLIP_MS + 400, hop.FLIP_MS * 2 + hop.SURGE_MS]) {
      const r = structuredClone({ lanes: round.lanes });
      const sample = lanes.map((l) => hop.shiftAt(r.lanes[l.row], ms));
      const copy = { ...round, lanes: r.lanes, hoppers: round.hoppers.map((h) => ({ ...h })), events: [] };
      for (const h of copy.hoppers) parkHopper(h);
      hop.advance(copy, ms, calm);
      lanes.forEach((l, i) => assert.ok(Math.abs(copy.lanes[l.row].shift - sample[i]) < 1e-6, `row ${l.row} at ${ms} ms`));
    }
  }
});

test("Crossing Rush: a heat still on at HEAT_CAP_MS is lost, a life gone, and the banner says time", () => {
  const round = crossing(3);
  round.clock = hop.HEAT_CAP_MS - 8;
  hop.advance(round, 16, calm);
  assert.equal(round.result, "lose");
  assert.equal(round.lives, hop.START_LIVES - 1);
  assert.deepEqual(hopEvents(round, "lose").map((e) => e.time), [true]);
});

test("Crossing Rush: a zone's numbers are built once, and past the ninth Rush Hour repeats, quicker", () => {
  assert.equal(hop.zoneFor(12), hop.zoneFor(12));
  assert.equal(hop.rivalPower(3), hop.rivalPower(3));
  assert.equal(hop.rivalPower(12), hop.rivalPower(12));
  assert.ok(Object.isFrozen(hop.zoneFor(12)) && Object.isFrozen(hop.rivalPower(12)) && Object.isFrozen(hop.rivalPower(12).hopper), "and nobody can change them");
  assert.equal(hop.zoneFor(11).title, "Rush Hour 3");
  assert.ok(hop.zoneFor(11).car[1] > hop.ZONES[9].car[1]);
  for (let z = 2; z <= hop.MAX_ZONE; z++) assert.ok(hop.ZONES[z].smart >= hop.ZONES[z - 1].smart, `zone ${z} is no softer than ${z - 1}`);
  assert.ok(hop.rivalPower(9).daredevil.depth > hop.rivalPower(1).daredevil.depth, "sharper rivals look further ahead");
  assert.ok(hop.rivalPower(9).hopper.reactMs < hop.rivalPower(1).hopper.reactMs, "and wait less");
  assert.ok(hop.rivalPower(1).hopper.reactMs > hop.rivalPower(1).daredevil.reactMs, "the Hopper takes its time, the Daredevil does not");
});

test("Crossing Rush: a rival color too near your highlight gives way to a spare, so no highlight leaves a rival beside you", () => {
  assert.deepEqual(hop.rivalColors("#206cc3"), [...hop.RIVAL_COLORS]);
  assert.deepEqual(hop.rivalColors("not a color"), [...hop.RIVAL_COLORS]);
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  for (const [id, accent] of Object.entries(ACCENTS)) {
    for (const you of [accent.light[0], accent.dark[0]]) {
      const colors = hop.rivalColors(you);
      assert.equal(new Set(colors).size, colors.length, `${id}: no two rivals alike`);
      for (const c of colors) {
        const [a, b] = [rgb(c), rgb(you)];
        assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= hop.NEAR_COLOR, `${id} ${you} beside ${c}`);
      }
    }
  }
});

test("Crossing Rush: the pills never overlap, leave the board or spill out of their strip, even on the smallest board with every pill wanted", () => {
  const effects = [{ text: "DAZED", color: "#fff", fill: 0.5 }, { text: "SHIELD", color: "#fff", fill: 0.5 }, { text: "SPACE: SHIELD", color: "#fff", fill: 1 }, { text: "+9", color: "#fff", fill: 1 }];
  for (const h of [Math.max(12 / hop.MIN_CELL, 2.4), 2.4]) {
    for (const zone of ["ZONE 1", "ZONE 12", "ZONE 120"]) {
      for (let n = 0; n <= effects.length; n++) {
        {
          const hud = { zone, effects: effects.slice(0, n), streak: hop.MAX_STREAK, place: "3RD", first: false };
          const pills = hopHudLayout(h, hop.W, 3, hud, hop.HUD_H);
          assert.equal(pills.length, 4 + n);
          for (const p of pills) {
            assert.ok(p.x >= 0 && p.x + p.w <= hop.W, `${p.text} stays on the board`);
            assert.ok(p.y >= 0 && p.y + p.h <= hop.HUD_H, `${p.text} stays in the strip (h ${h})`);
          }
          for (let i = 0; i < pills.length; i++) {
            for (let j = i + 1; j < pills.length; j++) {
              const [p, q] = [pills[i], pills[j]];
              assert.ok(p.x + p.w <= q.x || q.x + q.w <= p.x || p.y + p.h <= q.y || q.y + q.h <= p.y, `${p.text} and ${q.text} apart`);
            }
          }
        }
      }
    }
  }
});

test("Crossing Rush: every pill's text reads at 4.5:1 on its backing and its tint, lives, the daze and Shield running down and the pickup stack included, in light and dark under every highlight", () => {
  checkPills(hop.default, {
    setup: (r) => {
      const you = r.hoppers[0];
      you.daze = hop.DAZE_MS / 2;
      you.shield = hop.SHIELD_MS / 2;
      you.powers = ["spring", "horn", "shield"];
      r.streak = 3;
    },
    expect: ["ZONE 1", "♥", "~DAZED", "~SHIELD", "SPACE: SPRING", "+2", "CLEAN x3"],
  });
});

test("Crossing Rush: every word drawn on the field stays on it, wherever it starts and however long", () => {
  for (const text of ["Dazed!", "Shield up!", "Daredevil made it!", "Tagalong: Shield", "A line much too long to fit across the field at all"]) {
    for (const size of [2, 2.6, 3]) {
      for (let x = -10; x <= hop.FIELD_W + 10; x += 7) {
        for (let y = -10; y <= hop.FIELD_H + 10; y += 9) {
          const at = hopLabelSpot(text, x, y, size, hop.FIELD_W, hop.FIELD_H);
          assert.ok(at.x - at.max / 2 >= 0 && at.x + at.max / 2 <= hop.FIELD_W, `${text} across, at ${x}`);
          assert.ok(at.y - size / 2 >= 0 && at.y + size / 2 <= hop.FIELD_H, `${text} down, at ${y}`);
        }
      }
    }
  }
});

test("Crossing Rush: arms and feet on a lane stand out from both of its tones, whatever the theme", () => {
  for (const [look, t] of Object.entries(HOP_LANES)) {
    const ink = hopLimbInk(look);
    for (const tone of [t.a, t.b]) assert.ok(hopContrast(ink, tone) >= 3, `${look}: ${ink} on ${tone} (${hopContrast(ink, tone).toFixed(2)})`);
  }
  assert.notEqual(hopLimbInk("road"), hopLimbInk("grass"), "the dark road gets the light ink, the grass the dark");
});

/* ----------------------------------------------------- Crossing Rush game */

// Starts a Crossing Rush game past its hold, the rivals parked and the first
// rows grass.
function crossingGame(opts = {}) {
  const { canvas, calls } = stubCanvas();
  const g = hop.default.create({ canvas, ...opts });
  g.resize(900, 900);
  g.key("action");
  g.tick(400);
  for (const h of g.round.hoppers) if (h.id !== 0) place(parkHopper(h), 0, h.x);
  for (let r = 1; r <= 6; r++) setLane(g.round, r, "grass");
  g.round.pickups = [];
  return { g, calls };
}

test("Crossing Rush game: an arrow hops once a press (never on its key repeat, nor again until let go, nor with the press that plays on), one more press queues, a pause drops the queue, space uses the oldest pickup, a send-back leaves you dazed with presses dropped, and the board refuses a tiny window", () => {
  const { canvas } = stubCanvas();
  const t = hop.default.create({ canvas });
  assert.equal(t.resize(hop.W * hop.MIN_CELL - 1, 2000), false, "too narrow to play");
  assert.equal(t.resize(hop.W * hop.MIN_CELL, hop.H * hop.MIN_CELL), true, "just big enough");
  const { g } = crossingGame();
  const you = g.round.hoppers[0];
  assert.equal(g.round.phase, "play");
  g.key("up");
  assert.equal(you.hop.toRow, 1, "a press hops");
  g.key("up", true);
  g.tick(200);
  assert.equal(you.row, 1, "its key repeat never hops again");
  g.key("up");
  g.tick(200);
  assert.equal(you.row, 1, "nor a second press before it is let go");
  g.release("up");
  g.key("up");
  for (const k of ["up", "up", "up"]) {
    g.release(k);
    g.key(k);
  }
  g.release("up");
  assert.equal(you.queued, "up", "a press during the hop queues one more, and only one");
  for (let i = 0; i < 30; i++) g.tick(16);
  assert.equal(you.row, 3, "the hop, then the queued one");
  g.key("left");
  g.key("up");
  g.pause();
  assert.equal(you.queued, null, "a pause drops the queue");
  g.resume();
  g.key("right");
  assert.equal(you.queued, null, "the press that plays on never hops or queues");
  for (let i = 0; i < 30; i++) g.tick(16);
  const at = [you.row, you.x];
  g.release("right");
  g.key("right");
  assert.ok(you.hop, "the next one does");
  assert.deepEqual([you.hop.fromRow, you.hop.fromX], at);
  for (let i = 0; i < 20; i++) g.tick(16);
  you.powers = ["shield", "horn"];
  g.key("action", true);
  assert.equal(you.powers.length, 2, "a repeat of space never uses a pickup");
  g.key("action");
  assert.deepEqual([you.powers, you.shield > 0], [["horn"], true], "space uses the oldest");
  g.release("right");
  hop.sendBack(g.round, you, "car");
  for (let i = 0; i < 30; i++) g.tick(16);
  assert.ok(you.daze > 0, "down and dazed");
  g.key("up");
  g.release("up");
  g.key("action");
  assert.deepEqual([you.hop, you.queued, you.powers], [null, null, ["horn"]], "a press or space while dazed is dropped");
  for (let i = 0; i < 130; i++) g.tick(16);
  assert.equal(you.daze, 0);
  g.key("up");
  assert.ok(you.hop, "then an arrow hops again");
  g.pause();
  const clock = g.round.clock;
  g.tick(1000);
  assert.equal(g.round.clock, clock, "a paused game holds still");
  g.key("action");
  assert.equal(g.state, "running", "space plays on from a pause");
});

test("Crossing Rush game: the start screen reads the furthest zone, the memo only grows, and the round's end calls onScore once with its score big on the end screen", () => {
  const texts = [];
  let font = "";
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push([String(text), font]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { if (name === "font") font = value; target[name] = value; return true; },
  });
  let saved = 3;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const scores = [];
  const g = hop.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, memo, onScore: (n) => scores.push(n) });
  g.resize(900, 900);
  assert.ok(texts.some(([t]) => t.includes("Furthest: Rail Yard (zone 3 of 9)")), "the start screen names the furthest zone");
  assert.equal(saved, 3, "nothing is written by just opening it");
  const winHeat = () => {
    const r = g.round;
    const top = r.rows - 1;
    setLane(r, top - 1, "grass");
    place(r.hoppers[0], top - 1, 5);
    for (const h of r.hoppers) if (h.id !== 0) parkHopper(h);
    g.key("up");
    g.release("up");
    g.tick(200);
    assert.equal(r.result, "win");
    g.tick(hop.DONE_MS + 16);
    g.tick(hop.READY_MS + 16);
  };
  g.key("action");
  g.tick(400);
  winHeat();
  assert.equal(g.round.level, 2);
  assert.equal(saved, 3, "zone 2 is not past zone 3");
  winHeat();
  winHeat();
  assert.equal(g.round.level, 4);
  assert.equal(saved, 4, "a new furthest");
  // Both rivals home first: a lost heat in any zone.
  const loseHeat = () => {
    const r = g.round;
    for (const h of r.hoppers.slice(1)) {
      parkHopper(h);
      h.finished = true;
      r.finishers.push(h);
      h.place = r.finishers.length;
    }
    g.tick(16);
    g.tick(hop.DONE_MS + 16);
    g.tick(hop.READY_MS + 16);
  };
  for (let i = 0; i < hop.START_LIVES; i++) loseHeat();
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
  assert.ok(g.score > 0);
  texts.length = 0;
  g.tick(1000);
  g.resize(900, 900);
  assert.ok(texts.some(([t, f]) => t === String(g.score) && /\b7px/.test(f)), "the score, big");
  assert.equal(scores.length, 1, "once");
  g.key("action");
  g.tick(400);
  for (let i = 0; i < hop.START_LIVES; i++) loseHeat();
  assert.equal(saved, 4, "a shorter round leaves it");
  assert.equal(scores.length, 2);
});

test("Crossing Rush game: quick hops forward climb in pitch, a send-back boings, a coming train rings its bell, passing the best plays the fanfare once, and every zone draws", () => {
  const tones = [];
  const { g, calls } = crossingGame({ tone: (name, level, pitch) => tones.push([name, pitch || 1]), best: () => 5 });
  tones.length = 0;
  for (let k = 0; k < 4; k++) {
    g.key("up");
    g.release("up");
    for (let i = 0; i < 9; i++) g.tick(16);
  }
  const pitches = tones.filter(([n]) => n === "hop").map(([, p]) => p);
  assert.equal(pitches.length, 4);
  for (let i = 1; i < pitches.length; i++) assert.ok(pitches[i] > pitches[i - 1], `each quick hop higher (${pitches.join(", ")})`);
  const you = g.round.hoppers[0];
  setLane(g.round, you.row + 1, "road", [[you.x - 0.6, 1.2]]);
  g.key("up");
  g.release("up");
  for (let i = 0; i < 10; i++) g.tick(16);
  assert.ok(tones.some(([n]) => n === "boing"), "a send-back boings");
  assert.ok(tones.some(([n]) => n === "crash"));
  for (let i = 0; i < 40; i++) g.tick(16);
  setLane(g.round, you.row + 1, "rail", [], { phase: "idle", phaseMs: 10, nextIdle: 4000, dir: 1 });
  tones.length = 0;
  for (let i = 0; i < 50; i++) g.tick(16);
  assert.ok(tones.filter(([n]) => n === "bell").length >= 2, "the bell rings while the train is coming");
  g.round.score = 6;
  g.tick(16);
  g.tick(16);
  assert.equal(tones.filter(([n]) => n === "best").length, 1);
  for (let z = 1; z <= hop.MAX_ZONE + 1; z++) {
    hop.newHeat(g.round, z, steady, 0);
    g.round.lives = 99;
    const drawn = calls.count;
    for (let k = 0; k < 40; k++) g.tick(50);
    assert.ok(calls.count > drawn, `zone ${z} draws`);
  }
});

test("Crossing Rush game: Planny keeps his star eye in your highlight standing, mid-hop, flying back and beaten", () => {
  const frame = (setup) => {
    const { canvas, fills } = styleCanvas();
    const g = hop.default.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    g.tick(400);
    setup(g.round);
    fills.length = 0;
    g.resize(900, 900);
    return fills;
  };
  const you = (r) => r.hoppers[0];
  // Two stars in your highlight: his eye, and his mark on the race bar.
  const stars = (fills) => fills.filter((f) => f === "#206cc3").length;
  assert.equal(stars(frame(() => {})), 2, "standing");
  assert.equal(stars(frame((r) => Object.assign(you(r), { hop: { kind: "hop", dir: "up", fromRow: 0, fromX: 5, toRow: 1, toX: 5, ms: 60, max: hop.HOP_MS, half: true } }))), 2, "mid-hop");
  assert.equal(stars(frame((r) => Object.assign(you(r), { back: { cause: "car", fromRow: 3, fromX: 5, toRow: 0, toX: 5, ms: 200, max: hop.SENDBACK_MS } }))), 2, "flying back");
  assert.equal(stars(frame((r) => Object.assign(r, { phase: "done", result: "lose" }))), 2, "beaten");
});

test("Crossing Rush game: the opening banner sits in the field from the start's first frame, held through the 3, 2, 1, and does not jump on the first tick", () => {
  const shades = [];
  const ctx = new Proxy({}, {
    get: (t, name) => (name === "fillRect" ? (x, y) => t.fillStyle === "rgba(0, 0, 0, 0.32)" && shades.push(y) : name in t ? t[name] : () => {}),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const g = hop.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  shades.length = 0;
  g.key("action");
  assert.equal(shades.length, 1, "the start paints its banner");
  const [first] = shades;
  assert.ok(first - 7 >= 0 && first + 7 <= hop.FIELD_H, `inside the field, not at its top edge (${first})`);
  shades.length = 0;
  g.tick(16);
  assert.deepEqual(shades, [first], "in the same place once play begins");
});

test("Crossing Rush game: a rival's body is edged in its lane's limb ink, so a brown Tagalong on a log or a purple Bruiser on the water stands out", () => {
  const seen = [];
  const ctx = new Proxy({}, {
    get: (t, name) => (name === "fill" ? () => seen.push(["fill", t.fillStyle]) : name === "stroke" ? () => seen.push(["stroke", t.strokeStyle, t.lineWidth]) : name in t ? t[name] : () => {}),
    set: (t, name, value) => { t[name] = value; return true; },
  });
  const g = hop.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(400);
  const r = g.round;
  const rival = r.hoppers[1];
  parkHopper(rival);
  rival.kind = "tagalong";
  for (const look of ["road", "river", "rail"]) {
    setLane(r, 2, look === "river" ? "river" : look, look === "river" ? [[3, 4]] : []);
    place(rival, 2, 5);
    seen.length = 0;
    g.resize(900, 900);
    const color = hop.rivalColors("#206cc3")[Object.keys(hop.RIVALS).indexOf(rival.kind)];
    // A fill in its color and then an edge: its dot on the race bar (a dark
    // edge) and its body on the lane.
    const edges = seen.flatMap(([kind, style], i) => (kind === "fill" && style === color && seen[i + 1] && seen[i + 1][0] === "stroke" ? [seen[i + 1]] : []));
    assert.ok(edges.some(([, ink, width]) => ink === hopLimbInk(look) && width >= 0.3), `${look}: the body is edged in the lane's limb ink, wide enough to see (${JSON.stringify(edges)})`);
  }
});

test("Crossing Rush game: the Night Market's dark is one layer with the lights cut out when the page can draw off screen", () => {
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
          return name === "createRadialGradient" ? { addColorStop() {} } : undefined;
        }),
        set: (t, n, v) => { t[n] = v; return true; },
      });
    }
    getContext() { return this.ctx; }
  };
  try {
    const { canvas, names } = recordingCanvas();
    const g = hop.default.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    g.tick(400);
    hop.newHeat(g.round, 6, steady, 0);
    names.length = 0;
    g.tick(16);
    assert.equal(layers.length, 1, "one layer");
    const [layer] = layers;
    assert.deepEqual([layer.width, layer.height], [Math.ceil(hop.FIELD_W * 3), Math.ceil(hop.FIELD_H * 3)], "at three a unit");
    assert.ok(layer.names.includes("fillRect"), "the dark is laid on it");
    assert.ok(layer.names.filter((n) => n === "fillRect").length >= 1 + g.round.hoppers.length, "with a light cut out round every hopper");
    assert.equal(layer.names.filter((n) => n === "createRadialGradient").length, 1, "from one light made with the layer");
    assert.ok(names.includes("drawImage"), "and the frame copies it over the field");
    layer.names.length = 0;
    g.tick(16);
    assert.equal(layers.length, 1, "kept from frame to frame");
    assert.ok(layer.names.filter((n) => n === "fillRect").length >= 1 + g.round.hoppers.length, "the lights cut again");
    assert.equal(layer.names.filter((n) => n === "createRadialGradient").length, 0, "and no new gradient a frame");
  } finally {
    if (saved === undefined) delete globalThis.OffscreenCanvas;
    else globalThis.OffscreenCanvas = saved;
  }
});

/* ------------------------------------------------- lives and banners */

test("lives read at a glance: a heart per life up to five, a count past that, an empty heart at none, white on a solid pink pill", () => {
  assert.equal(livesText(3), "♥♥♥");
  assert.equal(livesText(5), "♥".repeat(5));
  assert.equal(livesText(7), "♥ x7");
  assert.equal(livesText(0), "♡");
  assert.equal(livesText(-1), "♡");
  assert.ok(pillContrast(LIVES_INK, LIVES_BACK) >= 4.5, "white reads on the lives pill");
});

test("every game with lives draws them in the lives pill, solid, with a heart per life", () => {
  for (const [name, game] of [["trails", trails], ["bugs", bugs], ["bumper", bumper], ["fuse", fuse], ["hop", hop], ["bounce", bounce], ["rapids", rapids], ["ghoul", ghoul]]) {
    const { canvas, pills, reset } = pillCanvas("#ffffff");
    const g = game.default.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    for (let k = 0; k < 5; k++) g.tick(16);
    reset();
    g.tick(16);
    const lives = pills().find((p) => p.text.startsWith("♥"));
    assert.ok(lives, `${name}: a lives pill (${pills().map((p) => p.text)})`);
    assert.equal(lives.text, livesText(g.round ? g.round.lives : 3), `${name}: a heart per life`);
    assert.equal(lives.backing, LIVES_BACK, `${name}: on the solid lives backing`);
    assert.equal(lives.ink, LIVES_INK, `${name}: in white`);
  }
  assert.equal(LIVES, bugs.POWERS.life.color, "the 1UP pickup keeps the lives pink");
});

test("Bug Hunt: the banner's strip counts a diving bug or a bomb under it, and a bug in formation is not", () => {
  const round = bugs.newRound(still);
  round.bombs.length = 0;
  for (const b of round.bugs) b.state = "form";
  assert.equal(bugs.underBanner(round), false, "nothing crossing");
  Object.assign(round.bugs[0], { state: "dive", y: bugs.H * 0.55 });
  assert.equal(bugs.underBanner(round), true, "a diving bug in the strip");
  round.bugs[0].state = "form";
  round.bombs.push({ x: 10, y: bugs.H * 0.55 + 1, vx: 0, vy: 10 });
  assert.equal(bugs.underBanner(round), true, "a bomb in the strip");
});

test("Stack Deploy and Sunset Drive: the banner's strip counts the slider, and a road climbing into it", () => {
  assert.equal(stack.underBanner(stack.H * 0.72 - 1), true, "the slider in the strip");
  assert.equal(stack.underBanner(stack.H * 0.4), false, "the slider up where the camera keeps it");
  assert.equal(drive.underBanner(drive.H / 2), false, "a flat road stays below the strip");
  assert.equal(drive.underBanner(drive.H * 0.36), true, "a hill into the strip");
});
