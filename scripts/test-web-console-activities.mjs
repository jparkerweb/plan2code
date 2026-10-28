// Web console tests, the activities: the shared game contract every listed game answers, Snake's rules, and mini golf's rules, course and controls.
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
import { ACTIVITIES, bestKey, memoKey } from "../src/web-console/public/activities.js";
import { BOSS_BITES, COMBO_MS, DISCOVERIES, FOOD_PER_LEVEL, FRUITS, GRID, ICE_STEPS, LEVELS, MAX_COMBO, MIN_CELL, MIN_STEP_MS, POWERS, STEP_MS, SURPRISES, age, applyPower, applySurprise, fruitFor, newRound, onFood, SPECIALS, pace, placeFood, step, stepMs, turn } from "../src/web-console/public/activities/snake.js";
import golf, * as golfRules from "../src/web-console/public/activities/golf.js";
import { COURSE_W, COURSE_H, HOLES } from "../src/web-console/public/activities/golf-holes.js";
import { holeQuip, holeWord } from "../src/web-console/public/activities/golf-draw.js";
import { DECOR_KINDS } from "../src/web-console/public/activities/golf-decor.js";

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

test("the list names Snake and Mini golf, and each entry's module is a file under public/activities/", () => {
  assert.deepEqual(ACTIVITIES.map((a) => a.id), ["snake", "golf"]);
  assert.equal(ACTIVITIES[1].title, "Mini golf");
  for (const a of ACTIVITIES) {
    assert.ok(Object.isFrozen(a), `${a.id} is frozen`);
    assert.equal(a.module, `/activities/${a.id}.js`);
    assert.equal(typeof a.title, "string");
  }
  assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length, "ids are unique");
});

test("bestKey builds a flat looks.json key from a list id", () => {
  assert.equal(bestKey("snake"), "activityBestSnake");
  assert.equal(bestKey("golf"), "activityBestGolf");
  assert.equal(bestKey("stub"), "activityBestStub");
  assert.equal(bestKey("stubpointer"), "activityBestStubpointer");
});

test("memoKey builds a flat looks.json key from a list id", () => {
  assert.equal(memoKey("snake"), "activityMemoSnake");
  assert.equal(memoKey("golf"), "activityMemoGolf");
});

/* ----------------------------------------------------------- contract */

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

test("Snake: every FOOD_PER_LEVEL foods is a level, and level 2 drops warned rocks clear of the head", () => {
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

test("Snake: Turbo doubles points and quickens the step, Slow-mo slows it, and each cancels the other", () => {
  const round = plainRound();
  const base = pace(round);
  applyPower(round, "turbo");
  assert.ok(pace(round) < base);
  round.food = { x: 6, y: 5 };
  step(round, () => 0.99);
  assert.equal(round.score, 2, "turbo doubles a food's point");
  applyPower(round, "slow");
  assert.equal(round.effects.turbo, undefined, "slow-mo ends turbo");
  assert.ok(pace(round) > stepMs(round.snake.length));
  age(round, POWERS.slow.ms, () => 0.99);
  assert.equal(round.effects.slow, undefined, "a timed power-up runs out");
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

test("Snake: Mirror world flips the keys", () => {
  const round = plainRound();
  applySurprise(round, "mirror");
  assert.equal(turn(round, "down"), true);
  step(round);
  assert.deepEqual(round.snake[0], { x: 5, y: 4 }, "down went up");
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
  // A saved tally's bits never move: the first 21 are where they always were.
  assert.equal(DISCOVERIES[0], "power:shield");
  assert.equal(DISCOVERIES[16], "level:2");
  assert.equal(DISCOVERIES[20], "level:6");
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

const { advance, strike, nextHole, SUB_STEP_MS, BALL_R, CUP_R, MAX_STROKES, MAX_SPEED, CANNON_MAX, CARD_MS, POWERUPS, FRONT_NINE } = golfRules;

// Plays physics steps until the ball rests (or the hole ends), collecting
// every event. Capped, so a ball that never stops fails rather than hangs.
function roll(round, maxMs = 30_000) {
  const events = [];
  for (let t = 0; t < maxMs && round.phase === "rolling"; t += SUB_STEP_MS) events.push(...advance(round, SUB_STEP_MS));
  assert.notEqual(round.phase, "rolling", "the ball came to a stop");
  return events;
}

// A new round moved on to hole `n` (1 to 18) with the ball on its tee.
function golfAt(n) {
  const round = golfRules.newRound();
  while (round.hole < n - 1) {
    round.card.push(HOLES[round.hole].par);
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
  for (const theme of ["pirate", "cave"]) {
    const lines = [[1, 3, false], [2, 5, false], [2, 3, false], [3, 3, false], [4, 3, false], [8, 3, false], [8, 3, true]].map(([n, par, up]) => holeQuip(n, par, up, theme));
    assert.ok(lines.every((l) => typeof l === "string" && l.length > 0), `${theme}: a quip for every result`);
  }
  assert.notEqual(holeQuip(3, 3, false, "pirate"), holeQuip(3, 3, false, "cave"), "the caves have their own voice");
});

// Drops the ball just short of the cup, aimed at it, so a soft putt sinks it.
function lineUp(g) {
  const cup = HOLES[g.round.hole].cup;
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

  for (let h = 0; h < HOLES.length; h++) {
    lineUp(g);
    assert.equal(softPutt(g), true);
    assert.equal(g.score, h + 1, "a stroke counts as it is taken");
    g.tick(3000);
    if (h < HOLES.length - 1) assert.equal(g.key("action"), true, "space skips the scorecard");
  }
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [HOLES.length], "one score, the round's total");
  assert.equal(tones.filter((n) => n === "ace").length, HOLES.length);
  assert.ok(tones.includes("putt"));
  g.tick(10_000);
  assert.deepEqual(scores, [HOLES.length], "nothing more once the round is over");
  assert.equal(golfRules.toPar(g.round), HOLES.length - HOLES.reduce((n, h) => n + h.par, 0));
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

test("Mini golf course: eighteen holes, each finishable, with every element used somewhere", () => {
  assert.equal(HOLES.length, 18);
  assert.ok(Object.isFrozen(HOLES) && Object.isFrozen(HOLES[0]) && Object.isFrozen(HOLES[0].walls[0]), "the course is frozen");
  assert.ok(HOLES.slice(0, FRONT_NINE).every((h) => h.theme === "pirate"), "the front nine is the pirate cove");
  assert.ok(HOLES.slice(FRONT_NINE).every((h) => h.theme === "cave"), "the back nine is the caves");
  for (const [i, hole] of HOLES.entries()) {
    const label = `hole ${i + 1} (${hole.name})`;
    assert.ok(typeof hole.name === "string" && hole.name.length > 0, `${label}: named`);
    assert.ok(typeof hole.quip === "string" && hole.quip.length > 0, `${label}: has a quip`);
    assert.ok(["grass", "deck", "moss", "stone"].includes(hole.ground), `${label}: a known ground`);
    assert.ok(["sea", "pool", "lava", "chasm"].includes(hole.liquid), `${label}: a known liquid`);
    assert.ok(Number.isInteger(hole.par) && hole.par >= 2 && hole.par <= 5, `${label}: par 2 to 5`);
    for (const [what, p] of [["tee", hole.tee], ["cup", hole.cup]]) {
      assert.ok(p.x > 0 && p.x < COURSE_W && p.y > 0 && p.y < COURSE_H, `${label}: ${what} on the course`);
      assert.ok(golfRules.inPolygon(hole.outline, p.x, p.y), `${label}: ${what} inside its walls`);
      assert.ok(!golfRules.inWater(hole, p.x, p.y), `${label}: ${what} not in water`);
      assert.ok(!golfRules.onSlope(hole, p.x, p.y), `${label}: ${what} not on a slope`);
    }
    for (const pad of hole.powerups) {
      assert.ok(Object.hasOwn(POWERUPS, pad.kind), `${label}: a known power-up, ${pad.kind}`);
      assert.ok(golfRules.inPolygon(hole.outline, pad.x, pad.y) && !golfRules.inWater(hole, pad.x, pad.y), `${label}: its ${pad.kind} pad on dry ground`);
      assert.ok(Math.hypot(pad.x - hole.tee.x, pad.y - hole.tee.y) > golfRules.POWERUP_R + BALL_R, `${label}: no pad under the tee`);
    }
    for (const d of hole.decor) assert.ok(DECOR_KINDS.includes(d.kind), `${label}: known scenery, ${d.kind}`);
    assert.ok(reachable(hole, hole.tee, hole.cup), `${label}: the cup can be reached from the tee`);
    if (hole.bridges.length) {
      const bridgeless = { ...hole, bridges: [] };
      assert.equal(reachable(bridgeless, hole.tee, hole.cup), false, `${label}: only its bridge gets the ball over the water`);
    }
  }
  for (const kind of ["bumpers", "sand", "water", "slopes", "bridges", "spinners", "tunnels", "movers", "gates", "powerups", "decor"]) {
    assert.ok(HOLES.some((h) => h[kind].length), `some hole has ${kind}`);
  }
  for (const liquid of ["sea", "pool", "lava", "chasm"]) assert.ok(HOLES.some((h) => h.liquid === liquid && h.water.length), `some hole has ${liquid}`);
  for (const kind of Object.keys(POWERUPS)) assert.ok(HOLES.some((h) => h.powerups.some((p) => p.kind === kind)), `some hole has a ${kind} pad`);
  assert.ok(HOLES.some((h) => h.walls.length > h.outline.length), "some hole has walls inside its edge");
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

test("Mini golf draws every hole with a context that only records calls", () => {
  const { canvas, calls } = stubCanvas();
  const g = golf.create({ canvas });
  g.resize(800, 600);
  g.start();
  for (let h = 0; h < HOLES.length; h++) {
    const drawn = calls.count;
    g.tick(16);
    assert.ok(calls.count > drawn, `hole ${h + 1} draws`);
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
    if (h < HOLES.length - 1) g.key("action");
  }
  assert.equal(g.state, "over");
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
  const param = { setValueAtTime() {}, exponentialRampToValueAtTime() {} };
  globalThis.AudioContext = class {
    state = "running";
    currentTime = 0;
    destination = {};
    resume() { return Promise.resolve(); }
    createOscillator() { oscillators += 1; return { type: "", frequency: param, connect() {}, start() {}, stop() {} }; }
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
    looks.sound = false;
    for (const name of ["crash", "putt", "wall", "bump", "cup", "ace", "splash", "power", "boom"]) tone(name);
    assert.equal(oscillators, 18, "Play sounds off: silent");
  } finally {
    looks.sound = saved.sound;
    if (saved.ctor === undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext = saved.ctor;
  }
});
