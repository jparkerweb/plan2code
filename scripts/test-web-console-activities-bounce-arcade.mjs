// Web console tests, Bounce Road's arcade layer: the gadgets a double tap sets off (rockets, oil, the ground pound, the zapper) and the power-ups that work as taken, the Fever, the lives a score earns and a stage's rank, the newer things on the road (conveyors, spring pads, bumpers, lasers, stompers, rollers), the rivals with a trick of their own, the five bosses, and the music's deal.
// Run with: node --test scripts/test-web-console-activities-bounce-arcade.mjs
//
// The driving, the road and the older rivals have their own suite,
// scripts/test-web-console-activities-bounce.mjs, whose helpers this file
// copies. No browser and no server: a stub canvas stands in for the page.

import "./seed-random.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as bounce from "../src/web-console/public/activities/bounce.js";
import { BOUNCE_MUSIC, SCORES } from "../src/web-console/public/activities/bounce-music.js";

const game = bounce.default;

/* ------------------------------------------------------------- helpers */

// A random source that always says the same, so no rival guesses.
const steady = () => 0.5;
const eventsOf = (round, type) => round.events.filter((e) => e.type === type);

// A 2D context whose every method is a no-op.
function stubCanvas() {
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : () => {}),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { width: 0, height: 0, getContext: () => ctx };
}

// A round on the road from `seed`, with only you on it and no rival coming.
function bounceRound(seed = 7) {
  const round = bounce.newRound(seed, steady);
  round.cars.length = 1;
  round.spawnMs = 1e12;
  round.supplyMs = 1e12;
  round.far = 1e9;
  return round;
}

// A rival of `kind` put at (x, d), still and on the ground, going nowhere on
// its own.
function bounceRival(round, kind, x, d, over = {}) {
  let car = null;
  for (let at = round.cars[0].d + 300; !car && at < round.cars[0].d + 3000; at += 40) car = bounce.spawnRival(round, kind, steady, at);
  assert.ok(car, `a ${kind} spawns`);
  Object.assign(car, { x, d, v: 0, tv: 0, vx: 0, kx: 0, air: 0, tx: x, lane: x, hopIn: 1e9, dropIn: 1e9, phaseIn: 1e9, mode: "calm", ...over });
  return car;
}

// A spot on plain road: the middle of the first row at or after `d` with
// nothing to catch you out for `clear` units either side.
function plainSpot(road, d = 40, clear = 20) {
  bounce.ensureRoad(road, d + 9000);
  const busy = (lo, hi) => [road.pads, road.blocks, road.hazards, road.items, road.stars].some((list) => list.some((e) => e.d > lo - 12 && (e.d1 ?? e.d) > lo - 12 && e.d < hi + 12));
  for (let i = Math.floor(d / bounce.ROW); i < road.rows; i++) {
    let ok = true;
    for (let j = i - clear / bounce.ROW; ok && j <= i + clear / bounce.ROW; j++) ok = bounce.plainRow(road, j);
    if (ok && !busy(i * bounce.ROW - clear, i * bounce.ROW + clear)) return { x: (road.L[i] + road.R[i]) / 2, d: i * bounce.ROW + 1, i };
  }
  throw new Error("no plain road");
}

// A round with you at speed on a long stretch of plain road.
function onPlain(seed = 7, clear = 50) {
  const round = bounceRound(seed);
  const at = plainSpot(round.road, 80, clear);
  const you = round.cars[0];
  Object.assign(you, { x: at.x, d: at.d, v: 40, pnose: at.d + you.l / 2 });
  // On the spot's own stage, so no stage line is crossed on the way to it.
  while (round.road.stageAt[round.stage] <= at.d) round.stage++;
  return { round, you, at };
}

// The first entry of `list` on the road matching `pick`, with the round set
// to its stage and you put `before` it, on the ground.
function onto(round, list, pick, before = 30) {
  const road = round.road;
  bounce.ensureRoad(road, 60000);
  const e = road[list].find(pick);
  assert.ok(e, `a ${list} entry on the road`);
  const d0 = e.d ?? e.d0;
  while (road.stageAt[round.stage] <= d0) round.stage++;
  const you = round.cars[0];
  const d = d0 - before;
  Object.assign(you, { d, x: e.x ?? (road.L[bounce.rowOf(d)] + road.R[bounce.rowOf(d)]) / 2, v: 40, air: 0, pnose: d + you.l / 2 });
  round.far = 1e9;
  return e;
}

// Lands you on `car` in the next slice.
function landOn(round, car) {
  const you = round.cars[0];
  Object.assign(car, { x: you.x, d: you.d + 1, air: 0 });
  Object.assign(you, { air: 4, airMax: 600 });
  bounce.advance(round, 4, steady);
}

// The round's clock put where `h`'s own cycle is `at` ms in.
const cycleTo = (round, h, at) => (round.clock = h.period * 3 - (h.phase % h.period) + at);

/* ------------------------------------------------------- the gadgets */

test("Bounce Road arcade: a gadget taken is held until it is set off, one at a time; the rest work as they are taken", () => {
  const { round, you } = onPlain();
  assert.deepEqual([...bounce.GADGETS].sort(), ["mega", "nitro", "oil", "pound", "rocket", "zap"]);
  for (const kind of bounce.GADGETS) {
    bounce.applyPower(round, kind);
    assert.deepEqual(you.held, { kind, uses: bounce.POWERS[kind].uses }, `${kind} is held`);
  }
  assert.equal(you.held.kind, bounce.GADGETS.at(-1), "a new one takes the old one's place");
  bounce.applyPower(round, "spring");
  bounce.applyPower(round, "bubble");
  bounce.applyPower(round, "magnet");
  assert.ok(you.spring && you.bubble && you.magnetMs === bounce.MAGNET_MS, "a Spring, a Bubble and a Magnet work at once");
  assert.equal(you.held.kind, bounce.GADGETS.at(-1), "and leave the gadget held");
  round.lives = 2;
  bounce.applyPower(round, "heart");
  assert.equal(round.lives, 3, "a heart is a life");
  round.lives = bounce.MAX_LIVES;
  bounce.applyPower(round, "heart");
  assert.equal(round.lives, bounce.MAX_LIVES, "never past MAX_LIVES");
  for (const [kind, , from] of bounce.POWER_ROLL) {
    assert.ok(bounce.POWERS[kind], `${kind} is a power-up`);
    assert.ok(from >= 2, "none on the first stage");
  }
  assert.equal(new Set(bounce.POWER_ROLL.map((r) => r[0])).size, Object.keys(bounce.POWERS).length, "every power-up turns up");
  for (let n = 2; n <= 8; n++) for (let r = 0; r < 1; r += 0.05) assert.ok(bounce.POWER_ROLL.find((e) => e[0] === bounce.rollPower(n, r))[2] <= n, `stage ${n} rolls only what has come`);
  const road = bounce.newRoad(5);
  bounce.ensureRoad(road, 9000);
  const arena = road.items.find((it) => it.d > road.stageAt[2]);
  assert.equal(arena.kind, "rocket", "a boss stage opens with rockets on the road");
});

test("Bounce Road arcade: a rocket blows up the first rival in its way for its points, takes a hit off a boss, smashes a barrier, and three are a load", () => {
  const { round, you, at } = onPlain();
  bounce.applyPower(round, "rocket");
  const brick = bounceRival(round, "brick", at.x, at.d + 30);
  assert.equal(bounce.usePower(round), "rocket");
  assert.equal(you.held.uses, 2);
  assert.equal(round.shots.length, 1);
  bounce.advance(round, 500, steady);
  assert.equal(brick.outKind, "blast", "blown up");
  const [blast] = eventsOf(round, "blast");
  assert.equal(blast.points, Math.max(bounce.BLAST_POINTS, bounce.RIVALS.brick.points));
  assert.equal(round.stats.blasted, 1);
  assert.equal(round.shots.length, 0, "the rocket is spent");
  const m = bounceRival(round, "monster", you.x, you.d + 34, { hp: 5, v: you.v, tv: you.v });
  bounce.usePower(round);
  bounce.advance(round, 500, steady);
  assert.equal(m.hp, 4, "a hit off the Monster");
  assert.ok(eventsOf(round, "stomp").some((e) => e.how === "rocket" && e.points === bounce.ROCKET_BOSS_POINTS));
  m.out = 1;
  m.outKind = "gone";
  bounce.advance(round, 16, steady);
  const block = { kind: "block", x: you.x, d: you.d + 26, w: 5, l: 3, hit: 0 };
  round.drops.push(block);
  bounce.usePower(round);
  assert.equal(you.held, null, "the third was the last");
  bounce.advance(round, 400, steady);
  assert.ok(block.hit > 0, "a barrier smashed");
  // A rocket that meets nothing runs out of road.
  bounce.applyPower(round, "rocket");
  bounce.usePower(round);
  bounce.advance(round, 1500, steady);
  assert.equal(round.shots.length, 0);
  assert.equal(round.stats.fired, 4);
});

test("Bounce Road arcade: oil lies behind you and spins the rival that crosses it, which is yours when the road's edge takes it; a boss's oil only takes your grip", () => {
  const { round, you, at } = onPlain(7, 60);
  bounce.applyPower(round, "oil");
  bounce.usePower(round);
  assert.equal(you.held.uses, 1);
  const [spill] = round.spills;
  assert.ok(spill.d < you.d && !spill.foe, "behind you");
  const brick = bounceRival(round, "brick", spill.x + 1, spill.d - 7, { v: 30, tv: 30 });
  let spun = false;
  for (let ms = 0; ms < 1200 && !spun; ms += 16) {
    bounce.advance(round, 16, steady);
    spun = brick.spinMs > 0;
  }
  assert.ok(spun, "it spins");
  assert.equal(eventsOf(round, "spin").length, 1);
  assert.ok(brick.credit > 0 && Math.abs(brick.kx) > 10, "thrown sideways, and yours");
  bounce.think(round, brick, 16, steady);
  assert.equal(brick.gain, 0, "it cannot steer out of it");
  assert.equal(round.stats.spun, 1);
  // A boss's spill: no life, no spin, only a slide.
  const r2 = onPlain(7, 60);
  r2.round.spills.push({ x: r2.at.x, d: r2.at.d + 6, w: 9, l: 11, until: r2.round.clock + 5000, foe: true });
  for (let ms = 0; ms < 400; ms += 16) bounce.advance(r2.round, 16, steady);
  assert.ok(r2.you.slickMs > 0 || eventsOf(r2.round, "slick").length === 1, "your grip goes");
  assert.equal(r2.round.lives, bounce.START_LIVES);
  bounce.advance(r2.round, bounce.OIL_MS + 2000, steady);
  assert.equal(r2.round.spills.length, 0, "and it dries up");
});

test("Bounce Road arcade: a ground pound slams you down, flattens what is near, throws what is further and smashes barriers; on the road it goes off at once", () => {
  const { round, you, at } = onPlain(7, 60);
  bounce.applyPower(round, "pound");
  const near = bounceRival(round, "zigzag", at.x + 2, at.d + 6);
  const mid = bounceRival(round, "brick", at.x + 8, at.d + 16);
  const far = bounceRival(round, "frog", at.x, at.d + 60);
  const block = { kind: "block", x: at.x - 6, d: at.d + 8, w: 5, l: 3, hit: 0 };
  round.drops.push(block);
  round.bolts.push({ x: at.x, d: at.d + 10, v: 0 });
  assert.equal(bounce.usePower(round), "pound");
  assert.equal(near.outKind, "flat", "flattened");
  assert.ok(eventsOf(round, "crush").some((e) => e.pound && e.kind === "zigzag"));
  assert.ok(mid.out === 0 && mid.kx > 5 && mid.credit > 0, "thrown outward, and yours if it goes off");
  assert.ok(far.out === 0 && far.kx === 0, "out of reach");
  assert.ok(block.hit > 0, "the barrier is gone");
  assert.equal(round.bolts.length, 0, "and the bolts");
  assert.equal(eventsOf(round, "pound").length, 1);
  assert.equal(you.held.uses, 1);
  // In the air it brings you down first.
  Object.assign(you, { air: 500, airMax: 600 });
  bounce.usePower(round);
  assert.ok(you.pounding && you.air <= bounce.POUND_DROP_MS, "down in POUND_DROP_MS");
  assert.equal(eventsOf(round, "pound").length, 1, "nothing until you land");
  bounce.advance(round, bounce.POUND_DROP_MS + 8, steady);
  assert.equal(eventsOf(round, "pound").length, 2, "the shockwave on landing");
  assert.equal(you.pounding, false);
});

test("Bounce Road arcade: a zap leaves every rival near coasting blind for ZAP_MS (no steering, no tricks, no hops), stuns a boss and brings the Whirlybird down", () => {
  const { round, you, at } = onPlain(7, 60);
  const frog = bounceRival(round, "frog", at.x + 6, at.d + 20, { hopIn: 0 });
  const away = bounceRival(round, "zigzag", at.x, at.d + bounce.ZAP_RANGE + 30);
  const m = bounceRival(round, "monster", at.x - 12, at.d + 40, { hp: 5 });
  const chopper = bounceRival(round, "chopper", at.x + 12, at.d + 50, { mode: "high", lift: 1, high: true });
  round.bolts.push({ x: at.x, d: at.d + 30, v: 0 });
  bounce.applyPower(round, "zap");
  bounce.usePower(round);
  assert.equal(you.held, null);
  assert.equal(frog.zapMs, bounce.ZAP_MS);
  assert.ok(frog.credit > bounce.ZAP_MS, "the road's edge or a hole makes it yours");
  assert.equal(away.zapMs, 0, "out of range");
  assert.ok(m.stunMs > 1000, "a boss is stunned");
  assert.equal(chopper.mode, "low", "the Whirlybird comes down");
  assert.equal(round.bolts.length, 0);
  bounce.think(round, frog, 16, steady);
  assert.equal(frog.air, 0, "no hop");
  assert.equal(frog.gain, 0, "no steering");
  for (let ms = 0; ms < bounce.ZAP_MS + 100; ms += 16) bounce.think(round, frog, 16, steady);
  assert.equal(frog.zapMs, 0, "it wears off");
});

test("Bounce Road arcade: a Magnet pulls in the stars and power-ups within MAGNET_R, in the air too, for MAGNET_MS", () => {
  const { round, you } = onPlain(7, 60);
  const road = round.road;
  road.stars.length = 0;
  road.items.length = 0;
  const star = { x: you.x + bounce.MAGNET_R - 2, d: you.d + 4, taken: false };
  const item = { x: you.x - bounce.MAGNET_R + 2, d: you.d + 6, kind: "bubble", taken: false };
  road.stars.push(star);
  road.items.push(item);
  bounce.advance(round, 8, steady);
  assert.ok(!star.taken && !item.taken, "out of reach without one");
  bounce.applyPower(round, "magnet");
  Object.assign(you, { air: 300, airMax: 600 });
  bounce.advance(round, 8, steady);
  assert.ok(star.taken && item.taken && you.bubble, "pulled in");
  for (let ms = 0; ms < bounce.MAGNET_MS + 100; ms += 4) bounce.move(round, you, 4);
  assert.equal(you.magnetMs, 0, "it runs out");
});

/* ------------------------------------------------- fever, lives, rank */

test("Bounce Road arcade: stunts fill the Fever; full, it burns for FEVER_MS with every point doubled and a touch flattening a rival; a life lost puts it out", () => {
  const { round, you, at } = onPlain(7, 60);
  const need = Math.ceil(bounce.FEVER_FULL / bounce.FEVER_GAIN);
  for (let k = 0; k < need - 1; k++) bounce.stunt(round, 10);
  assert.equal(round.feverMs, 0, "not yet");
  assert.ok(round.fever > bounce.FEVER_FULL * 0.9);
  bounce.stunt(round, 10);
  assert.equal(round.feverMs, bounce.FEVER_MS, "lit");
  assert.equal(eventsOf(round, "fever").length, 1);
  assert.equal(bounce.stunt(round, 10), 10 * bounce.MAX_COMBO * 2, "double points");
  const zig = bounceRival(round, "zigzag", at.x + 4, at.d + 1);
  assert.equal(bounce.collide(round, you, zig), "mega");
  assert.equal(zig.outKind, "flat", "a touch flattens");
  assert.ok(eventsOf(round, "crush").at(-1).fever);
  const spike = bounceRival(round, "spike", at.x, at.d + 40);
  landOn(round, spike);
  assert.equal(spike.outKind, "flat", "even a Spike, from above");
  you.air = 0;
  bounce.advance(round, bounce.FEVER_MS + 50, steady);
  assert.equal(round.feverMs, 0);
  assert.equal(round.fever, 0, "burnt out");
  assert.equal(eventsOf(round, "feverEnd").length, 1);
  for (let k = 0; k < 10; k++) bounce.stunt(round, 10);
  const held = round.fever;
  bounce.lose(round, "crash");
  assert.equal(round.fever, Math.floor(held / 2), "a life lost halves the meter");
  const r2 = onPlain(7, 60).round;
  bounce.startFever(r2);
  bounce.lose(r2, "crash");
  assert.ok(r2.feverMs === 0 && r2.fever === 0, "and puts a Fever out");
});

test("Bounce Road arcade: every LIFE_SCORE points is a life, up to MAX_LIVES", () => {
  const { round } = onPlain();
  round.lives = 2;
  round.score = bounce.LIFE_SCORE - 1;
  bounce.advance(round, 8, steady);
  assert.equal(round.lives, 2);
  round.score = bounce.LIFE_SCORE + 5;
  bounce.advance(round, 8, steady);
  assert.equal(round.lives, 3);
  assert.equal(eventsOf(round, "life").length, 1);
  bounce.advance(round, 200, steady);
  assert.equal(round.lives, 3, "once a mark");
  round.lives = bounce.MAX_LIVES;
  round.score = bounce.LIFE_SCORE * 2 + 5;
  bounce.advance(round, 8, steady);
  assert.equal(round.lives, bounce.MAX_LIVES);
  assert.equal(round.lifeAt, bounce.LIFE_SCORE * 3, "the mark still moves on");
});

test("Bounce Road arcade: a stage line ranks the stage: C for a slow run with a life lost, A for a flawless run under par, S with a combo of three on top", () => {
  const cross = (setup) => {
    const round = bounceRound(7);
    const road = round.road;
    const you = round.cars[0];
    const d = road.stageAt[1] - 0.5;
    Object.assign(you, { d, x: (road.L[bounce.rowOf(d)] + road.R[bounce.rowOf(d)]) / 2, v: 40 });
    setup(round);
    bounce.advance(round, 60, steady);
    assert.equal(round.stage, 2);
    return eventsOf(round, "stage")[0].rank;
  };
  assert.equal(cross((r) => { r.stageLost = true; r.clock = 500000; }), "C");
  assert.equal(cross((r) => { r.clock = 500000; }), "B", "flawless but slow");
  assert.equal(cross(() => {}), "A");
  assert.equal(cross((r) => { r.stageCombo = 3; }), "S");
  const round = bounceRound(7);
  assert.deepEqual(round.ranks, []);
});

/* --------------------------------------------- new things on the road */

test("Bounce Road arcade: a conveyor carries you across at BELT_PUSH, a spring pad throws you up POP_AIR the usual jump, and a bumper kicks you away for points, never a life", () => {
  const round = bounceRound(9);
  const belt = onto(round, "pads", (p) => p.kind === "belt", 0);
  const you = round.cars[0];
  const x0 = you.x;
  for (let ms = 0; ms < 400; ms += 4) bounce.advance(round, 4, steady);
  assert.ok((you.x - x0) * belt.dir > bounce.BELT_PUSH * 0.3, `carried ${belt.dir > 0 ? "right" : "left"} (${(you.x - x0).toFixed(1)})`);
  assert.equal(eventsOf(round, "belt").length, 1);
  const r2 = bounceRound(9);
  const pop = onto(r2, "pads", (p) => p.kind === "pop", 5);
  const y2 = r2.cars[0];
  y2.v = 50;
  for (let ms = 0; ms < 300 && y2.air <= 0; ms += 4) bounce.advance(r2, 4, steady);
  assert.ok(y2.air > 0, "thrown up");
  assert.ok(Math.abs(y2.airMax - bounce.airMs(y2.v) * bounce.POP_AIR) < 30, "POP_AIR the usual jump");
  assert.ok(y2.ramped, "big air to land");
  assert.equal(eventsOf(r2, "pop").length, 1);
  assert.ok(pop.w > bounce.CAR_W);
  const r3 = bounceRound(9);
  const bumper = onto(r3, "blocks", (b) => b.kind === "bumper", 6);
  const y3 = r3.cars[0];
  y3.x = bumper.x - 1;
  const before = r3.score;
  for (let ms = 0; ms < 400; ms += 4) bounce.advance(r3, 4, steady);
  const [hit] = eventsOf(r3, "bumper");
  assert.ok(hit, "it rings");
  assert.equal(hit.points, bounce.BUMPER_POINTS);
  assert.ok(r3.score >= before + bounce.BUMPER_POINTS);
  assert.equal(r3.lives, bounce.START_LIVES, "no life");
  assert.equal(bumper.hit, 0, "and it stays where it is");
  assert.ok(y3.x < bumper.x, "kicked to its side");
});

test("Bounce Road arcade: a laser is a crash while its beam is on and nothing while it is off, and a car in the air goes over it for points", () => {
  const through = (cycle, air) => {
    const round = bounceRound(3);
    const h = onto(round, "hazards", (e) => e.kind === "laser", 2);
    const you = round.cars[0];
    cycleTo(round, h, cycle(h));
    if (air) Object.assign(you, { air: 500, airMax: 600, jumpFrom: you.d });
    for (let ms = 0; ms < 240; ms += 4) bounce.advance(round, 4, steady);
    return { round, you, h };
  };
  const on = through(() => 10, false);
  assert.equal(on.round.phase, "crash");
  assert.equal(eventsOf(on.round, "lose")[0].cause, "laser");
  const off = through((h) => h.onMs + 200, false);
  assert.equal(off.round.phase, "drive", "off, it is nothing");
  assert.ok(off.you.d > off.h.d);
  const over = through(() => 10, true);
  assert.equal(over.round.phase, "drive", "over it in the air");
  assert.ok(over.you.overs.includes(over.h), "to score on landing");
  const lz = bounce.laserAt(on.h, on.h.period * 5 - (on.h.phase % on.h.period) - 100);
  assert.ok(lz.warn && !lz.on, "its posts blink before it comes on");
});

test("Bounce Road arcade: a stomper squashes what is under it as it lands, is a block while it is down, and lets you by while it is up", () => {
  const under = (at, place) => {
    const round = bounceRound(3);
    const h = onto(round, "hazards", (e) => e.kind === "stomper", 0);
    const you = round.cars[0];
    place(you, h);
    cycleTo(round, h, at(h));
    bounce.advance(round, 60, steady);
    return { round, h, you };
  };
  const hit = under((h) => h.period - 20, (you, h) => Object.assign(you, { x: h.x, d: h.d - 1, v: 16 }));
  assert.equal(hit.round.phase, "crash");
  assert.equal(eventsOf(hit.round, "lose")[0].cause, "squash");
  assert.equal(eventsOf(hit.round, "stompLand").length, 1);
  const wall = under(() => bounce.STOMP_HIT_MS + 60, (you, h) => Object.assign(you, { x: h.x, d: h.d - h.l / 2 - you.l / 2 - 0.6, v: 40, pnose: h.d - h.l / 2 - 0.6 }));
  assert.equal(wall.round.phase, "crash", "nose first into it while it is down");
  assert.equal(eventsOf(wall.round, "lose")[0].cause, "crash");
  const clear = under((h) => h.downMs + 150, (you, h) => Object.assign(you, { x: h.x, d: h.d - 3, v: 40 }));
  assert.equal(clear.round.phase, "drive", "up, it lets you by");
  const st = bounce.stomperAt(hit.h, hit.h.period * 4 - (hit.h.phase % hit.h.period) - bounce.STOMP_WARN_MS / 2);
  assert.ok(st.fall > 0.3 && st.fall < 0.7 && !st.down, "its shadow grows before it lands");
});

test("Bounce Road arcade: a roller is a crash to drive into and points to jump", () => {
  const round = bounceRound(3);
  const h = onto(round, "hazards", (e) => e.kind === "roller", 1);
  const you = round.cars[0];
  you.x = bounce.ballX(h, round.clock);
  bounce.advance(round, 40, steady);
  assert.equal(round.phase, "crash");
  const r2 = bounceRound(3);
  const h2 = onto(r2, "hazards", (e) => e.kind === "roller", 1);
  const y2 = r2.cars[0];
  Object.assign(y2, { x: bounce.ballX(h2, r2.clock), air: 300, airMax: 600, jumpFrom: y2.d });
  bounce.advance(r2, 40, steady);
  assert.equal(r2.phase, "drive");
  assert.ok(y2.overs.includes(h2), "jumped");
  assert.ok(h2.half > h2.r * 2, "long across the road, thin along it");
});

/* --------------------------------------------- the rivals with a trick */

test("Bounce Road arcade: a Spike's roof costs a life and its side is a plain bump, a Splitter flattened bursts into two Minis, and the Supply truck's roof hands over a gadget once", () => {
  const a = onPlain(7, 60);
  const spike = bounceRival(a.round, "spike", a.at.x, a.at.d + 40);
  landOn(a.round, spike);
  assert.equal(a.round.phase, "crash");
  assert.equal(eventsOf(a.round, "lose")[0].cause, "spike");
  assert.equal(spike.out, 0, "it drives on");
  const b = onPlain(7, 60);
  const spike2 = bounceRival(b.round, "spike", b.at.x + 4.3, b.at.d + 1);
  assert.equal(bounce.collide(b.round, b.you, spike2), "side");
  assert.equal(b.round.phase, "drive");
  const splitter = bounceRival(b.round, "splitter", b.at.x, b.at.d + 60);
  landOn(b.round, splitter);
  assert.equal(splitter.outKind, "flat");
  const minis = b.round.cars.filter((c) => c.kind === "mini");
  assert.equal(minis.length, 2, "two Minis");
  assert.ok(minis[0].x < splitter.x && minis[1].x > splitter.x && minis.every((m) => m.v > splitter.v), "one either side, off up the road");
  assert.equal(eventsOf(b.round, "split").length, 1);
  const c = onPlain(7, 60);
  const truck = bounceRival(c.round, "supply", c.at.x, c.at.d + 40);
  landOn(c.round, truck);
  assert.ok(c.you.held && bounce.GADGETS.includes(c.you.held.kind), "a gadget");
  assert.ok(truck.gave && truck.out === 0);
  assert.equal(eventsOf(c.round, "haul").length, 1, "its roof is a trampoline");
  c.you.held = null;
  c.you.air = 0;
  landOn(c.round, truck);
  assert.equal(c.you.held, null, "once");
  assert.ok(bounce.RIVALS.supply.friend && bounce.RIVALS.spike.spiky);
});

test("Bounce Road arcade: a Blaster glows, then fires a bolt back down the road that knocks and slows you without a life; in the air it passes under you", () => {
  const { round, you, at } = onPlain(11, 90);
  const blaster = bounceRival(round, "blaster", at.x, at.d + 40, { dropIn: 0, v: 40, tv: 40, mode: "" });
  let aimed = 0;
  for (let ms = 0; ms < 3000 && !eventsOf(round, "shot").length; ms += 4) {
    bounce.advance(round, 4, steady);
    if (blaster.aimMs > 0) aimed += 4;
  }
  assert.equal(eventsOf(round, "aim").length >= 1, true, "it takes aim");
  assert.ok(aimed >= bounce.AIM_MS - 12, `for AIM_MS (${aimed})`);
  assert.ok(eventsOf(round, "bolt").length >= 1, "and fires");
  assert.equal(eventsOf(round, "shot").length, 1, "the bolt finds you");
  assert.equal(round.lives, bounce.START_LIVES, "no life");
  assert.ok(Math.abs(you.kx) > 5 && you.slickMs > 0, "knocked, and sliding");
  const r2 = onPlain(11, 90);
  r2.round.bolts.push({ x: r2.you.x, d: r2.you.d + 4, v: -bounce.BOLT_SPEED });
  Object.assign(r2.you, { air: 400, airMax: 600 });
  bounce.advance(r2.round, 300, steady);
  assert.equal(eventsOf(r2.round, "shot").length, 0, "under a car in the air");
});

test("Bounce Road arcade: a Slasher alongside glints, then its blades come out and its side is a crash; with them in it is a plain bump", () => {
  const { round, you, at } = onPlain(7, 60);
  const slasher = bounceRival(round, "slasher", at.x + 6, at.d, { mode: "chase", v: 40, tv: 40, offside: 1 });
  bounce.think(round, slasher, 16, steady);
  assert.equal(slasher.blade, "warn", "a glint first");
  assert.equal(eventsOf(round, "blade").length, 1);
  for (let ms = 0; ms <= bounce.BLADE_WARN_MS; ms += 16) bounce.think(round, slasher, 16, steady);
  assert.equal(slasher.blade, "out");
  slasher.x = you.x + 4.1;
  slasher.d = you.d;
  assert.equal(bounce.collide(round, you, slasher), "side");
  assert.equal(round.phase, "crash");
  assert.equal(eventsOf(round, "lose")[0].cause, "slash");
  const r2 = onPlain(7, 60);
  const calm = bounceRival(r2.round, "slasher", r2.at.x + 4.1, r2.at.d, { blade: "" });
  bounce.collide(r2.round, r2.you, calm);
  assert.equal(r2.round.phase, "drive", "blades in: a bump");
});

test("Bounce Road arcade: a Bomber drops a bomb while you follow, which blows BOMB_FUSE_MS on: a life for a car on the ground within BOMB_R, nothing for one clear of it", () => {
  const { round, you, at } = onPlain(11, 90);
  const bomber = bounceRival(round, "bomber", at.x, at.d + 50, { dropIn: 0, v: 40, tv: 40, mode: "" });
  bounce.think(round, bomber, 16, steady);
  assert.equal(round.bombs.length, 1, "a bomb on the road");
  assert.equal(eventsOf(round, "bomb").length, 1);
  assert.equal(round.bombs[0].at, round.clock + bounce.BOMB_FUSE_MS);
  round.bombs.length = 0;
  bomber.out = 1;
  bomber.outKind = "gone";
  round.bombs.push({ x: you.x + bounce.BOMB_R + you.w, d: you.d + 3, at: round.clock + 40, t0: round.clock, r: bounce.BOMB_R });
  bounce.advance(round, 80, steady);
  assert.equal(eventsOf(round, "boom").length, 1);
  assert.equal(round.phase, "drive", "clear of the blast");
  round.bombs.push({ x: you.x + 2, d: you.d + 4, at: round.clock + 40, t0: round.clock, r: bounce.BOMB_R });
  bounce.advance(round, 80, steady);
  assert.equal(round.phase, "crash");
  assert.equal(eventsOf(round, "lose")[0].cause, "blast");
});

test("Bounce Road arcade: a Phantom out of reach cannot be bumped or landed on; a Magnet rival drags you toward it while it is near", () => {
  const { round, you, at } = onPlain(7, 60);
  const phantom = bounceRival(round, "phantom", at.x + 3, at.d, { phased: true });
  bounce.advance(round, 16, steady);
  assert.equal(eventsOf(round, "bump").length, 0, "nothing to bump");
  landOn(round, phantom);
  assert.equal(phantom.out, 0, "nothing to land on");
  phantom.phased = false;
  you.air = 0;
  Object.assign(phantom, { x: you.x + 3, d: you.d });
  bounce.advance(round, 16, steady);
  assert.ok(eventsOf(round, "bump").length > 0, "solid again");
  const m = onPlain(7, 60);
  const magnet = bounceRival(m.round, "magnet", m.at.x + 12, m.at.d + 4, { mode: "", v: 40, tv: 40 });
  for (let ms = 0; ms < 300; ms += 4) bounce.advance(m.round, 4, steady);
  assert.ok(m.you.kx > 3, `dragged toward it (${m.you.kx.toFixed(1)})`);
  assert.ok(eventsOf(m.round, "magnet").length >= 1);
  assert.ok(magnet.pulling);
  const calm = onPlain(7, 60);
  bounceRival(calm.round, "magnet", calm.at.x + 12, calm.at.d + bounce.MAG_RANGE + 30, { mode: "" });
  bounce.advance(calm.round, 100, steady);
  assert.equal(calm.you.kx, 0, "too far to pull");
});

/* ------------------------------------------------------------ bosses */

test("Bounce Road arcade: each boss comes in its own arena with its own hp, more of it each lap, and is named as it comes", () => {
  for (const [k, kind] of bounce.BOSS_ORDER.entries()) {
    const stage = (k + 1) * bounce.WORLD;
    assert.equal(bounce.stageFor(stage).boss, kind);
    const round = bounceRound(4);
    const road = round.road;
    bounce.ensureRoad(road, 40000);
    round.stage = stage;
    const at = plainSpot(road, road.stageAt[stage - 1] + bounce.stageFor(stage).len * 0.2, 30);
    Object.assign(round.cars[0], { x: at.x, d: at.d, v: 40 });
    bounce.advance(round, 16, steady);
    const boss = round.cars.find((c) => c.kind === kind);
    assert.ok(boss, `the ${kind} is out`);
    assert.equal(boss.hp, bounce.RIVALS[kind].hp);
    assert.ok(bounce.isBoss(boss) && bounce.RIVALS[kind].hint, "with a word on how to beat it");
    assert.ok(eventsOf(round, "spawn").some((e) => e.kind === kind));
    bounce.advance(round, 400, steady);
    assert.equal(round.cars.filter((c) => c.kind === kind).length, 1, "once a stage");
  }
  assert.deepEqual([...bounce.BOSS_KINDS].sort(), [...bounce.BOSS_ORDER].sort());
  const lap2 = bounceRound(4);
  bounce.ensureRoad(lap2.road, 90000);
  lap2.stage = 18;
  const at = plainSpot(lap2.road, lap2.road.stageAt[17] + bounce.stageFor(18).len * 0.2, 30);
  Object.assign(lap2.cars[0], { x: at.x, d: at.d, v: 40 });
  bounce.advance(lap2, 16, steady);
  const again = lap2.cars.find((c) => bounce.isBoss(c));
  assert.equal(again.hp, bounce.RIVALS[again.kind].hp + 1, "one more hp on the second lap");
});

test("Bounce Road arcade: any boss is beaten by landings, rockets or a ground pound: its last hp is BOSS_POINTS, a life, a trophy and a Fever", () => {
  for (const kind of bounce.BOSS_ORDER) {
    const { round, you, at } = onPlain(7, 60);
    round.lives = 2;
    const boss = bounceRival(round, kind, at.x, at.d + 30, { hp: 3, lift: 0, high: false, mode: kind === "chopper" ? "low" : "calm", modeMs: 1e9 });
    landOn(round, boss);
    assert.equal(boss.hp, 2, `${kind}: a landing`);
    assert.ok(boss.stunMs > 0, "and it reels");
    you.air = 0;
    assert.equal(bounce.hurtBoss(round, boss, "rocket"), "stomp");
    assert.equal(boss.hp, 1, "a rocket");
    assert.equal(bounce.hurtBoss(round, boss, "pound"), "boss");
    assert.equal(boss.outKind, "flat");
    const [beat] = eventsOf(round, "boss");
    assert.equal(beat.kind, kind);
    assert.ok(beat.points >= bounce.BOSS_POINTS && beat.life);
    assert.equal(round.lives, 3);
    assert.equal(round.trophies, 1 << bounce.BOSS_ORDER.indexOf(kind), "its trophy");
    assert.ok(round.feverMs > 0, "and a Fever");
    assert.equal(bounce.hurtBoss(round, boss, "rocket"), "", "nothing more from a beaten boss");
  }
});

test("Bounce Road arcade: the Big Rig lobs a barrel at where you are heading, which lands LOB_MS on as a block and squashes what is under it", () => {
  const { round, you, at } = onPlain(11, 90);
  const rig = bounceRival(round, "tanker", at.x, at.d + bounce.TANKER_AHEAD, { dropIn: 0, v: 40, tv: 40, mode: "", hp: 4 });
  bounce.think(round, rig, 16, steady);
  assert.equal(round.lobs.length, 1);
  const lob = round.lobs[0];
  assert.equal(lob.what, "barrel");
  assert.equal(lob.at, round.clock + bounce.LOB_MS);
  assert.ok(lob.d > you.d + 20 && lob.d < rig.d, "ahead of you, short of the truck");
  assert.equal(eventsOf(round, "lob").length, 1);
  assert.ok(bounce.underBanner(round, bounce.FIELD_H - (lob.d - (you.d - 18)), you.d - 18), "a banner gives way to it");
  rig.dropIn = 1e9;
  // Keep still: it lands ahead of you and lies there.
  you.v = 16;
  round.input.down = true;
  bounce.advance(round, bounce.LOB_MS + 20, steady);
  assert.equal(round.lobs.length, 0);
  assert.ok(round.drops.some((b) => b.what === "barrel" && b.kind === "block"), "a block on the road");
  assert.equal(round.phase, "drive");
  // Under it as it lands.
  const r2 = onPlain(11, 90);
  r2.round.lobs.push({ x: r2.you.x, d: r2.you.d + 1, at: r2.round.clock + 8, what: "barrel", boom: 0, w: 4.4, l: 4.4, fx: 0, fd: 0 });
  bounce.advance(r2.round, 16, steady);
  assert.equal(eventsOf(r2.round, "lose")[0].cause, "squash");
  // Now and then it brake-checks: back it comes, its roof in reach.
  const r4 = onPlain(11, 90);
  r4.you.v = 60;
  const rig4 = bounceRival(r4.round, "tanker", r4.at.x, r4.at.d + bounce.TANKER_AHEAD, { brakeIn: 0, v: 60, tv: 60, mode: "", hp: 4 });
  bounce.think(r4.round, rig4, 16, steady);
  assert.equal(rig4.mode, "brake");
  assert.ok(eventsOf(r4.round, "brake").some((e) => e.kind === "tanker"));
  bounce.think(r4.round, rig4, 16, steady);
  assert.ok(rig4.tv < r4.you.v - 20, "slower than you, so a jump can reach it");
  assert.equal(r4.round.lobs.length, 0, "and nothing thrown while it brakes");
  for (let ms = 0; ms <= bounce.TANKER_BRAKE_MS + 32; ms += 16) bounce.think(r4.round, rig4, 16, steady);
  assert.equal(rig4.mode, "", "then off it goes again");
  // Every third thing it drops is oil.
  const r3 = onPlain(11, 90);
  const rig3 = bounceRival(r3.round, "tanker", r3.at.x, r3.at.d + bounce.TANKER_AHEAD, { dropIn: 0, drops: 2, v: 40, tv: 40, mode: "", hp: 4 });
  bounce.think(r3.round, rig3, 16, steady);
  assert.ok(r3.round.spills.length === 1 && r3.round.spills[0].foe, "an oil spill behind it");
});

test("Bounce Road arcade: the Robo-Vac sweeps from edge to edge, warns, then charges back down the road: its nose is a crash, its top a stomp, and it goes back up the road through you", () => {
  const { round, you, at } = onPlain(11, 90);
  const vac = bounceRival(round, "vac", at.x, at.d + bounce.VAC_AHEAD, { mode: "sweep", hopIn: 0, v: 40, tv: 40, hp: 4 });
  bounce.think(round, vac, 16, steady);
  assert.equal(vac.mode, "warn");
  assert.ok(eventsOf(round, "bossWarn").some((e) => e.kind === "vac"));
  for (let ms = 0; ms <= bounce.VAC_WARN_MS + 16; ms += 16) bounce.think(round, vac, 16, steady);
  assert.equal(vac.mode, "charge");
  assert.equal(eventsOf(round, "bossCharge").length, 1);
  assert.ok(vac.tv < you.v - 20, "coming back at you");
  // Its nose.
  Object.assign(vac, { x: you.x, d: you.d + (you.l + vac.l) / 2 - 0.2, v: vac.tv });
  assert.equal(bounce.collide(round, you, vac), "end");
  assert.equal(round.phase, "crash");
  // Its top.
  const r2 = onPlain(11, 90);
  const vac2 = bounceRival(r2.round, "vac", r2.at.x, r2.at.d + 20, { mode: "charge", hp: 4 });
  landOn(r2.round, vac2);
  assert.equal(vac2.hp, 3, "a stomp");
  bounce.think(r2.round, vac2, 16, steady);
  assert.equal(vac2.mode, "back");
  // On its way back up the road it passes through you.
  r2.you.air = 0;
  Object.assign(vac2, { x: r2.you.x, d: r2.you.d - 2, stunMs: 0 });
  bounce.think(r2.round, vac2, 16, steady);
  assert.ok(vac2.thru, "through anything");
  r2.round.events.length = 0;
  bounce.advance(r2.round, 16, steady);
  assert.equal(eventsOf(r2.round, "bump").length, 0);
  assert.equal(r2.round.phase, "drive");
});

test("Bounce Road arcade: the Whirlybird flies out of reach and bombs where you are heading, then swoops down to the road where a landing is a stomp", () => {
  const { round, you, at } = onPlain(11, 90);
  const bird = bounceRival(round, "chopper", at.x, at.d + bounce.CHOPPER_AHEAD, { mode: "high", lift: 1, high: true, dropIn: 0, hopIn: 1e9, v: 40, tv: 40, hp: 4 });
  bounce.think(round, bird, 16, steady);
  assert.equal(round.lobs.length, 1);
  assert.ok(round.lobs[0].boom > 0 && round.lobs[0].what === "bomb", "a bomb on its way");
  round.lobs.length = 0;
  bird.dropIn = 1e9;
  landOn(round, bird);
  assert.equal(bird.hp, 4, "out of reach up high");
  assert.equal(round.phase, "drive");
  you.air = 0;
  Object.assign(bird, { x: you.x, d: you.d });
  bounce.advance(round, 16, steady);
  assert.equal(eventsOf(round, "bump").length, 0, "nothing to bump up there");
  bird.d = you.d + bounce.CHOPPER_AHEAD;
  bird.hopIn = 0;
  bounce.think(round, bird, 16, steady);
  assert.equal(bird.mode, "low");
  assert.ok(eventsOf(round, "bossWarn").some((e) => e.kind === "chopper"));
  for (let ms = 0; ms < 600; ms += 16) bounce.think(round, bird, 16, steady);
  assert.ok(bird.lift === 0 && !bird.high, "down on the road");
  assert.ok(bird.tv < you.v, "drifting back to you, so a jump can reach it");
  landOn(round, bird);
  assert.equal(bird.hp, 3, "a stomp");
  bounce.think(round, bird, 16, steady);
  assert.equal(bird.mode, "high", "and up it goes");
  // A bomb landing on you.
  const r2 = onPlain(11, 90);
  r2.round.lobs.push({ x: r2.you.x + 2, d: r2.you.d + 2, at: r2.round.clock + 8, what: "bomb", boom: bounce.LOB_R, w: 4, l: 4, fx: 0, fd: 0 });
  bounce.advance(r2.round, 16, steady);
  assert.equal(eventsOf(r2.round, "lose")[0].cause, "blast");
  assert.equal(r2.round.drops.length, 0, "nothing left lying");
});

test("Bounce Road arcade: the Cat's paw slams down with a quake, then sweeps across the road, there to be jumped on", () => {
  const { round, you, at } = onPlain(11, 90);
  const cat = bounceRival(round, "cat", at.x - 8, at.d + 24, { mode: "stalk", hopIn: 0, v: 40, tv: 40, hp: 6 });
  bounce.think(round, cat, 16, steady);
  assert.ok(cat.air > 0, "up it goes");
  assert.equal(eventsOf(round, "bossHop").length, 1);
  for (let ms = 0; ms < 1400 && cat.mode !== "swipe"; ms += 4) {
    bounce.think(round, cat, 4, steady);
    bounce.move(round, cat, 4);
  }
  assert.equal(cat.mode, "swipe", "then it sweeps");
  assert.equal(eventsOf(round, "quake").length, 1);
  assert.equal(eventsOf(round, "swipe").length, 1);
  const x0 = cat.x;
  for (let ms = 0; ms < 600; ms += 4) {
    bounce.think(round, cat, 4, steady);
    bounce.move(round, cat, 4);
  }
  assert.ok(Math.abs(cat.x - x0) > 8, `across the road (${(cat.x - x0).toFixed(1)})`);
  for (let ms = 0; ms < bounce.CAT_SWIPE_MS; ms += 16) bounce.think(round, cat, 16, steady);
  assert.equal(cat.mode, "stalk", "and back to stalking");
  you.air = 0;
  cat.air = 0;
  landOn(round, cat);
  assert.equal(cat.hp, 5, "a stomp");
});

/* ------------------------------------------- the double tap, the music */

test("Bounce Road arcade game: the first press of space jumps at once; a second within DOUBLE_TAP_MS sets off the gadget held, a slower one or a key repeat never does", () => {
  const g = game.create({ canvas: stubCanvas() });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const round = g.round;
  round.cars.length = 1;
  round.spawnMs = 1e12;
  round.supplyMs = 1e12;
  const you = round.cars[0];
  const at = plainSpot(round.road, 80, 60);
  Object.assign(you, { x: at.x, d: at.d, v: 40 });
  const settle = () => {
    for (let ms = 0; ms < 1200; ms += 16) {
      Object.assign(you, { x: at.x, d: at.d, v: 40 });
      g.tick(16);
    }
    you.air = 0;
  };
  bounce.applyPower(round, "rocket");
  g.key("action");
  g.tick(16);
  assert.ok(you.air > 0, "the first press jumps, with no wait");
  assert.equal(round.stats.fired, 0);
  g.tick(64);
  g.key("action");
  g.tick(16);
  assert.equal(round.stats.fired, 1, "the second fires");
  assert.equal(you.held.uses, 2);
  // A third press right after is a first press again.
  g.tick(64);
  g.key("action");
  g.tick(16);
  assert.equal(round.stats.fired, 1);
  settle();
  g.key("action");
  g.tick(16);
  g.tick(bounce.DOUBLE_TAP_MS + 40);
  g.key("action");
  g.tick(16);
  assert.equal(round.stats.fired, 1, "too slow to be a double tap");
  settle();
  g.key("action");
  g.tick(16);
  g.key("action", true);
  g.tick(16);
  assert.equal(round.stats.fired, 1, "a held key's repeat never fires");
  settle();
  you.held = null;
  g.key("action");
  g.tick(32);
  g.key("action");
  g.tick(16);
  assert.equal(round.stats.fired, 1, "nothing held, nothing to fire");
  assert.equal(round.input.fire, false);
  bounce.applyPower(round, "oil");
  settle();
  g.key("action");
  g.tick(16);
  g.pause();
  g.resume();
  g.key("action");
  g.tick(16);
  assert.equal(round.stats.fired, 1, "a pause forgets the first press");
});

test("Bounce Road arcade game: a run shuffles its stages; the music deals every track, never opening on the last one, and the game asks for one each tick, hotter in a Fever", () => {
  assert.equal(bounce.MUSIC_TRACKS.length, 20);
  for (let k = 0; k < 40; k++) {
    const last = bounce.MUSIC_TRACKS[k % 20];
    const deck = bounce.dealMusic(Math.random, last);
    assert.deepEqual([...deck].sort(), [...bounce.MUSIC_TRACKS].sort());
    assert.notEqual(deck[0], last);
  }
  const asked = [];
  const heats = [];
  const g = game.create({ canvas: stubCanvas(), music: (name, level, opts) => { asked.push([name, opts]); heats.push(level); return "playing"; } });
  g.resize(900, 900);
  g.key("action");
  assert.equal(g.round.road.shuffle, true, "a real round shuffles");
  g.tick(16);
  g.tick(16);
  assert.equal(asked.length, 2);
  assert.ok(bounce.MUSIC_TRACKS.includes(asked[0][0]));
  assert.deepEqual(asked[0][1], { restart: true }, "from the top");
  assert.equal(asked[1][1], undefined);
  assert.deepEqual(heats, [bounce.MUSIC_HEAT.road, bounce.MUSIC_HEAT.road], "the open road's heat");
  g.round.feverMs = 5000;
  g.tick(16);
  assert.equal(heats.at(-1), bounce.MUSIC_HEAT.fever, "a Fever plays it at full heat");
  assert.ok(bounce.MUSIC_HEAT.road < bounce.MUSIC_HEAT.boss && bounce.MUSIC_HEAT.boss < bounce.MUSIC_HEAT.fever);
  const ended = [];
  const g2 = game.create({ canvas: stubCanvas(), music: (name) => { ended.push(name); return "ended"; } });
  g2.resize(900, 900);
  g2.key("action");
  for (let k = 0; k < 30; k++) g2.tick(16);
  assert.deepEqual([...new Set(ended.slice(0, 20))].sort(), [...bounce.MUSIC_TRACKS].sort(), "every track once, in a random order");
  assert.notEqual(ended[20], ended[19], "a new deal never opens on the track that just ended");
});

test("Bounce Road arcade music: twenty synthesized tracks, each fast, a whole tune in whole bars, with an echo for a boss and a harmony for a Fever", () => {
  assert.deepEqual(Object.keys(BOUNCE_MUSIC).sort(), [...bounce.MUSIC_TRACKS].sort(), "the game lists the tracks its music file has");
  assert.equal(SCORES.length, 20);
  assert.equal(new Set(SCORES.map((s) => s.title)).size, 20, "twenty titles");
  assert.equal(new Set(SCORES.map((s) => s.A.lead + s.B.lead)).size, 20, "twenty tunes");
  const stepsOf = (line) => line.split(/\s+/).filter((t) => t !== "|").length;
  SCORES.forEach((score, k) => {
    const track = BOUNCE_MUSIC[`bounceSong${k + 1}`];
    assert.ok(track.bpm >= 140 && track.bpm <= 180, `${score.title} is fast`);
    assert.ok(track.rush > 0, "and faster as play heats up");
    for (const part of [score.A, score.B]) {
      const bars = part.lead.split(/\s+/);
      assert.equal(bars.length, 8, `${score.title}: eight bars a tune`);
      for (const bar of bars) assert.match(bar, /^[A-Ga-g1-7.\-]{16}$/, `${score.title}: a bar is sixteen steps`);
    }
    for (const [id, pattern] of Object.entries(track.patterns)) {
      for (const [voice, line] of Object.entries(pattern)) {
        assert.ok(track.voices[voice], `${score.title} ${id}: ${voice} is a voice`);
        assert.equal(stepsOf(line) % 16, 0, `${score.title} ${id}.${voice} runs whole bars`);
      }
    }
    const steps = track.order.reduce((n, id) => n + stepsOf(track.patterns[id].drums), 0);
    const seconds = (steps / 4) * (60 / track.bpm);
    assert.ok(seconds > 60 && seconds < 100, `${score.title} runs a minute or so (${Math.round(seconds)} s)`);
    const { road, boss, fever } = bounce.MUSIC_HEAT;
    for (const v of ["bass", "lead", "arp", "drums"]) assert.ok((track.voices[v].from ?? 0) <= road, `${v} plays on the open road`);
    assert.ok(track.voices.echo.from > road && track.voices.echo.from <= boss, "the echo joins for a boss");
    assert.ok(track.voices.harmony.from > boss && track.voices.harmony.from <= fever, "the harmony joins in a Fever");
  });
});

/* ----------------------------------- the boss hold, the stunt pieces */

test("Bounce Road arcade: a boss stage lasts until its boss is beaten: more of it is laid ahead while the boss lives, and its line comes once it is flattened", () => {
  const round = bounceRound(4);
  round.infinite = true;
  const road = round.road;
  const you = round.cars[0];
  const drive = (ms, until = () => false) => {
    for (let t = 0; t < ms && !until(); t += 16) {
      const i = bounce.rowIn(road, you.d + 6);
      Object.assign(you, { x: (road.L[i] + road.R[i]) / 2, v: 50, ghostMs: 1000 });
      if (bounce.groundAt(road, you.x, you.d + 4, round.clock) !== bounce.GROUND.road) Object.assign(you, { air: 200, airMax: 400 });
      bounce.advance(round, 16, steady);
    }
  };
  bounce.buildStage(road, 2);
  bounce.buildStage(road, 3);
  you.d = road.stageAt[2] - 1;
  drive(200);
  assert.equal(round.stage, 3);
  drive(20000, () => round.cars.some((c) => bounce.isBoss(c)));
  const boss = round.cars.find((c) => bounce.isBoss(c));
  assert.ok(boss, "its boss comes");
  const line = road.stageAt[3];
  drive(60000);
  assert.equal(round.stage, 3, "still on the boss stage a minute on");
  assert.ok(road.stageAt[3] > line + 1000, "its line moved on with the road");
  assert.equal(road.built, 3, "and nothing past it is built");
  assert.ok(road.stageAt[3] - you.d > bounce.FIELD_H, "the line never comes into view");
  assert.equal(eventsOf(round, "escape").length, 0, "it does not get away");
  boss.hp = 1;
  bounce.hurtBoss(round, boss, "rocket");
  const end = road.stageAt[3];
  drive(30000, () => round.stage === 4);
  assert.equal(round.stage, 4, "beaten, the line comes");
  assert.equal(road.stageAt[3], end, "where the road then ended");
  assert.equal(eventsOf(round, "stage").at(-1).rank !== "C", true, "and the boss counts toward the rank");
});

test("Bounce Road arcade: a kicker flies you KICKER_AIR the usual jump over its whole chicane, a wall right across the road can only be jumped, a trampoline is three bounces, and a turbo lane is one boost after another", () => {
  const round = bounceRound(9);
  const kicker = onto(round, "pads", (p) => p.kind === "kicker", 8);
  const you = round.cars[0];
  you.v = 55;
  for (let ms = 0; ms < 400 && you.air <= 0; ms += 4) bounce.advance(round, 4, steady);
  assert.ok(you.air > 0 && Math.abs(you.airMax - bounce.airMs(you.v) * bounce.KICKER_AIR) < 40, "a long flight");
  assert.ok(bounce.KICKER_AIR > bounce.RAMP_AIR);
  const walls = round.road.blocks.filter((b) => b.d > kicker.d && b.d < kicker.d + 110);
  assert.equal(walls.length, 3, "a chicane under it");
  for (let ms = 0; ms < 3000 && you.air > 0; ms += 4) bounce.advance(round, 4, steady);
  assert.equal(round.phase, "drive", "down on clear road");
  assert.ok(you.d > walls.at(-1).d, "past every barrier");
  assert.ok(eventsOf(round, "land").at(-1).big, "for big air");
  const r2 = bounceRound(9);
  const wall = onto(r2, "blocks", (b) => b.wall, 12);
  const i = bounce.rowOf(wall.d);
  assert.ok(wall.w > r2.road.R[i] - r2.road.L[i] - 2, "right across the road");
  for (let ms = 0; ms < 800 && r2.phase === "drive"; ms += 4) bounce.advance(r2, 4, steady);
  assert.equal(r2.phase, "crash", "no way round");
  const r3 = bounceRound(9);
  onto(r3, "blocks", (b) => b.wall, 6);
  r3.input.jump = bounce.JUMP_BUFFER_MS;
  for (let ms = 0; ms < 1500; ms += 4) bounce.advance(r3, 4, steady);
  assert.equal(r3.phase, "drive", "only over");
  assert.ok(eventsOf(r3, "land").some((e) => e.overs.includes("block")));
  const road = bounce.newRoad(9);
  bounce.ensureRoad(road, 60000);
  const wide = road.pads.filter((p) => p.kind === "pop" && p.w > 20);
  assert.ok(wide.length >= 3 && wide[1].d - wide[0].d < 70, "trampolines come in a row");
  const strips = road.pads.filter((p) => p.kind === "boost");
  const lane = strips.find((p, k) => strips[k + 3] && strips[k + 3].d - p.d < 80 && strips[k + 3].x === p.x);
  assert.ok(lane, "a turbo lane");
  const j = bounce.rowOf(lane.d + 20);
  assert.ok(Math.abs(road.R[j] - road.L[j] - bounce.TURBO_W) < 0.01, "and narrow");
  for (const s of bounce.STAGES) for (const k of Object.keys(bounce.WILD)) assert.ok(s.weights[k] > 0, `${s.title} lays a ${k}`);
});

test("Bounce Road arcade game: a power-up taken flashes its name near the top of the field for TOAST_MS, at once, whatever banner is showing", () => {
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text, x, y) => texts.push([String(text), y]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  g.round.cars.length = 1;
  g.round.spawnMs = 1e12;
  const you = g.round.cars[0];
  g.round.events.push({ type: "power", kind: "rocket", x: you.x, d: you.d });
  texts.length = 0;
  g.tick(16);
  g.tick(16);
  const flash = texts.filter(([t]) => t === "ROCKETS");
  assert.ok(flash.length > 0, "its name, while the stage's banner is still up");
  assert.ok(flash.every(([, y]) => y < bounce.FIELD_H * 0.2), `near the top of the field (${flash[0][1]})`);
  for (let ms = 0; ms < bounce.TOAST_MS + 50; ms += 16) g.tick(16);
  texts.length = 0;
  g.tick(16);
  assert.equal(texts.filter(([t]) => t === "ROCKETS").length, 0, "and gone");
});
