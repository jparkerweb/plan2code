// Web console tests, Bounce Road's rules: driving, jumps, landings and bumps, the bounce chain and the combo, the road and its fairness (every hole jumpable, a run-up before each), the timed parts (drawbridges, swaying bridges, crumbling road), the hazards (boost strips, ramps, slicks, barriers, trains, balls, sprinklers, falling things, gusts), every rival's ways and the Monster truck, the stages and laps, the banner's strip, the colors and the pill layout, and bots that show every stage is passable and that a careless run ends quickly. The game contract, the pills' contrast, the tones and the drawing are in scripts/test-web-console-activities-bounce-game.mjs.
// Run with: node --test scripts/test-web-console-activities-bounce.mjs
//
// No browser and no server: the game draws only through the canvas it is
// handed, so a stub canvas stands in for the page, as in
// scripts/test-web-console-activities.mjs, whose helpers this file copies.

import test from "node:test";
import assert from "node:assert/strict";
import * as bounce from "../src/web-console/public/activities/bounce.js";
import { hudLayout, labelSpot, LOOKS, limbInk, contrast, inkOn } from "../src/web-console/public/activities/bounce-draw.js";
import { CAR_STYLES } from "../src/web-console/public/activities/bounce-cars.js";
import { ACCENTS } from "../src/web-console/public/palette.js";


/* ------------------------------------------------------------- helpers */

// A random source that always says the same, so no rival guesses.
const steady = () => 0.5;
const eventsOf = (round, type) => round.events.filter((e) => e.type === type);

// A round on the road from `seed`, with only you on it unless `rivals`.
function bounceRound(seed = 7, rivals = false) {
  const round = bounce.newRound(seed, steady);
  if (!rivals) round.cars.length = 1;
  round.spawnMs = 1e12;
  return round;
}

// A rival of `kind` put at (x, d), still and on the ground, going nowhere on
// its own.
function bounceRival(round, kind, x, d, over = {}) {
  const car = bounce.spawnRival(round, kind, steady, round.cars[0].d + 300);
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

// The first stage whose road holds an entry of `list` matching `pick`, with
// you put a little before it on the stage and the round set to that stage.
function onto(round, list, pick, before = 30) {
  const road = round.road;
  bounce.ensureRoad(road, 40000);
  const e = road[list].find(pick);
  assert.ok(e, `a ${list} entry on the road`);
  const d0 = e.d ?? e.d0;
  while (road.stageAt[round.stage] <= d0) round.stage++;
  const you = round.cars[0];
  const d = d0 - before;
  const i = bounce.rowOf(d);
  Object.assign(you, { d, x: (road.L[i] + road.R[i]) / 2, v: 40, air: 0, pnose: d + you.l / 2 });
  round.far = 1e9;
  return e;
}

// A careful bot: full throttle, the middle of the narrowest road just ahead
// (its side of a flowerbed, the band a swaying bridge always covers), round
// the nearest barrier, falling thing or car in the way, and a jump at every
// hole, ball, train that is coming and barrier it cannot get round.
function carefulBot(round) {
  const you = round.cars[0];
  const road = round.road;
  const inp = round.input;
  inp.up = true;
  inp.down = false;
  let lo = -1e9;
  let hi = 1e9;
  let side = 0;
  for (let d = you.d; d < you.d + 40; d += bounce.ROW) {
    const i = Math.max(0, Math.min(road.rows - 1, Math.floor(d / bounce.ROW)));
    let L = road.L[i];
    let R = road.R[i];
    if (road.deck[i] === 2) {
      const s = road.dyn[road.dynOf[i] - 1];
      L += s.amp;
      R -= s.amp;
    }
    if (road.ML[i] < road.MR[i]) {
      side ||= you.x < (road.ML[i] + road.MR[i]) / 2 ? -1 : 1;
      if (side < 0) R = road.ML[i];
      else L = road.MR[i];
    }
    lo = Math.max(lo, L);
    hi = Math.min(hi, R);
  }
  let tx = (lo + hi) / 2;
  const things = [];
  for (const list of [road.blocks, round.drops]) for (const o of list) if (!o.hit && o.d - you.d > -2 && o.d - you.d < 40) things.push(o);
  for (const h of road.hazards) if (h.kind === "drop" && h.at && !h.landed && h.d - you.d > -4 && h.d - you.d < 70) things.push(h);
  for (const c of round.cars) if (c.id !== 0 && c.out === 0 && c.d - you.d > 0 && c.d - you.d < 24) things.push(c);
  things.sort((p, q) => p.d - q.d);
  const o = things[0];
  if (o && Math.abs(tx - o.x) < (o.w + you.w) / 2 + 1.6) {
    const l = o.x - (o.w + you.w) / 2 - 1.6;
    const r = o.x + (o.w + you.w) / 2 + 1.6;
    tx = l - lo > hi - r ? l : r;
  }
  tx = Math.min(hi - you.w / 2 - 0.8, Math.max(lo + you.w / 2 + 0.8, tx));
  inp.left = tx < you.x - 0.5;
  inp.right = tx > you.x + 0.5;
  const soon = (d) => d > you.d && d - you.d < 3 + you.v * 0.02 + you.l / 2;
  for (let k = bounce.firstAt(road.holes, "d0", you.d); k < road.holes.length && road.holes[k].d0 < you.d + 20; k++) if (soon(road.holes[k].d0)) inp.jump = bounce.JUMP_BUFFER_MS;
  for (const h of road.hazards) {
    if (h.kind === "ball" && soon(h.d - h.r - 1)) inp.jump = bounce.JUMP_BUFFER_MS;
    if (h.kind === "train" && soon(h.d - h.half - 1) && bounce.trainAt(h, round.clock + 150).warn) inp.jump = bounce.JUMP_BUFFER_MS;
  }
  for (const b of things) if (b.l && b.kind && b.id === undefined && soon(b.d - b.l / 2) && Math.abs(b.x - you.x) < (b.w + you.w) / 2) inp.jump = bounce.JUMP_BUFFER_MS;
}

// Plays `round` with `bot` until `stage` or the end, `ms` at most, a rival's
// random seeded; returns the seconds each stage took and the lives lost.
function play(round, bot, { stage = 11, ms = 900000, rivals = false, seed = 1 } = {}) {
  const random = rivals ? bounce.seeded(seed * 13) : steady;
  const secs = [];
  const lost = [];
  let t = 0;
  let at = 0;
  while (round.stage < stage && t < ms && !round.over) {
    if (!rivals) round.cars.length = 1;
    bot(round);
    bounce.advance(round, 16, random);
    t += 16;
    for (const e of round.events) {
      if (e.type === "stage") {
        secs.push((t - at) / 1000);
        at = t;
      }
      if (e.type === "lose") lost.push(`${e.cause} at stage ${round.stage}`);
    }
    round.events.length = 0;
  }
  return { secs, lost, ms: t };
}

/* ------------------------------------------------------- driving */

test("Bounce Road: full throttle reaches TOP_SPEED and holds it, the verge holds it to VERGE_TOP of that, and the brake slows a toy car only to ROLL_SPEED", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const at = plainSpot(round.road, 40, 20);
  round.input.up = true;
  let fastest = 0;
  for (let ms = 0; ms < 3000; ms += 4) {
    bounce.move(round, you, 4);
    fastest = Math.max(fastest, you.v);
    Object.assign(you, { d: at.d, x: at.x });
  }
  assert.ok(Math.abs(you.v - bounce.TOP_SPEED) < 1e-6, `at top speed (${you.v})`);
  assert.ok(fastest <= bounce.TOP_SPEED + 1e-6, "and never past it");
  for (let ms = 0; ms < 2000; ms += 4) {
    you.x = round.road.L[at.i] - 3;
    you.d = at.d;
    bounce.move(round, you, 4);
  }
  assert.ok(Math.abs(you.v - bounce.TOP_SPEED * bounce.VERGE_TOP) < 0.5, `the verge slows it (${you.v})`);
  round.input.up = false;
  round.input.down = true;
  for (let ms = 0; ms < 3000; ms += 4) bounce.move(round, you, 4);
  assert.equal(you.v, bounce.ROLL_SPEED, "the brake leaves it rolling");
});

test("Bounce Road: a jump needs JUMP_MIN, lasts airMs(v), longer the faster, holds its speed in the air, steers only AIR_STEER as much, and a Spring lengthens it", () => {
  const round = bounceRound();
  const you = round.cars[0];
  you.v = bounce.JUMP_MIN - 1;
  assert.equal(bounce.jump(round, you), false, "too slow to jump");
  assert.ok(bounce.airMs(40) > bounce.airMs(20) && bounce.reach(60) > bounce.reach(40) * 1.5, "faster goes higher and further");
  you.v = 40;
  assert.equal(bounce.jump(round, you), true);
  assert.equal(you.air, bounce.airMs(40));
  assert.equal(you.jumps, 1, "each jump counted, so a rival decides once a jump whether to dodge it");
  assert.equal(bounce.jump(round, you), false, "never twice in the air");
  round.input.up = true;
  round.input.right = true;
  const x0 = you.x;
  for (let ms = 0; ms < 300; ms += 4) bounce.move(round, you, 4);
  assert.equal(you.v, 40, "the throttle does nothing in the air");
  const airMove = you.x - x0;
  const ground = bounceRound();
  const g = ground.cars[0];
  ground.input.right = true;
  for (let ms = 0; ms < 300; ms += 4) bounce.move(ground, g, 4);
  assert.ok(airMove > 0 && airMove < (g.x - x0) * (bounce.AIR_STEER + 0.15), `only a nudge in the air (${airMove.toFixed(2)} against ${(g.x - x0).toFixed(2)})`);
  const s = bounceRound().cars[0];
  s.v = 40;
  bounce.jump(round, s, bounce.SPRING_AIR);
  assert.equal(s.air, bounce.airMs(40) * bounce.SPRING_AIR);
});

test("Bounce Road: landing on a rival flattens it for its own points and rebounds, a second landing before the road steps the chain, and the road ends it", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const at = plainSpot(round.road, 60, 30);
  Object.assign(you, { x: at.x, d: at.d, v: 40, air: 4, airMax: 600, jumpFrom: at.d - 20 });
  round.far = 1e9;
  const a = bounceRival(round, "zigzag", at.x, at.d + 1);
  const b = bounceRival(round, "brick", at.x, at.d + 60);
  bounce.advance(round, 4, steady);
  assert.ok(a.out > 0 && a.outKind === "flat", "the first is flattened");
  assert.equal(round.chain, 1);
  assert.equal(round.score, bounce.RIVALS.zigzag.points, "a crush scores the rival's points");
  assert.equal(you.air, bounce.REBOUND_MS, "and you bounce up again");
  for (let ms = 0; ms < bounce.REBOUND_MS + 8 && round.chain < 2; ms += 4) {
    Object.assign(b, { x: you.x, d: you.d, v: 0 });
    bounce.advance(round, 4, steady);
  }
  assert.equal(round.chain, 2, "a second landing steps the chain");
  assert.equal(round.score, bounce.RIVALS.zigzag.points + bounce.RIVALS.brick.points * 2, "and scores twice its points");
  for (let ms = 0; ms < bounce.REBOUND_MS + 8; ms += 4) bounce.advance(round, 4, steady);
  assert.equal(you.air, 0);
  assert.equal(round.chain, 0, "the road ends it");
  assert.equal(round.bestChain, 2);
  assert.ok(bounce.MAX_CHAIN >= 8, "a long chain to chase");
});

test("Bounce Road: the Hauler cannot be bumped and its back is a crash, but its roof is a rebound that steps the chain and leaves it rolling", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const at = plainSpot(round.road, 60, 30);
  Object.assign(you, { x: at.x - 5, d: at.d, vx: 34 });
  const hauler = bounceRival(round, "hauler", at.x, at.d);
  bounce.collide(round, you, hauler);
  assert.ok(Math.abs(hauler.kx) < Math.abs(you.kx) / 5, `a side bump barely moves it (${hauler.kx.toFixed(1)} against ${you.kx.toFixed(1)})`);
  Object.assign(you, { x: at.x, d: at.d - 9, v: 50, kx: 0, vx: 0 });
  hauler.v = 20;
  bounce.collide(round, you, hauler);
  assert.equal(round.phase, "crash", "into its back is a crash");
  assert.equal(round.lives, bounce.START_LIVES - 1);
  const r2 = bounceRound();
  const y2 = r2.cars[0];
  const at2 = plainSpot(r2.road, 60, 30);
  Object.assign(y2, { x: at2.x, d: at2.d, v: 40, air: 4, airMax: 600 });
  r2.far = 1e9;
  const h2 = bounceRival(r2, "hauler", at2.x, at2.d + 2);
  bounce.advance(r2, 4, steady);
  assert.equal(h2.out, 0, "it rolls on");
  assert.equal(y2.air, bounce.REBOUND_MS);
  assert.equal(r2.chain, 1);
  assert.equal(r2.score, bounce.HAUL_POINTS, "its roof scores HAUL_POINTS");
});

test("Bounce Road: a rival bumped past the road's edge is out, and yours for BUMP_POINTS within CREDIT_MS; one that goes off later scores nothing", () => {
  const off = (wait) => {
    const round = bounceRound();
    const you = round.cars[0];
    const at = plainSpot(round.road, 60, 30);
    const edge = round.road.R[at.i];
    const rival = bounceRival(round, "zigzag", edge - 3, at.d + 0.5);
    Object.assign(you, { x: edge - 3 - 4, d: at.d, vx: 34 });
    bounce.collide(round, you, rival);
    assert.ok(rival.kx > 20, `knocked hard toward the edge (${rival.kx.toFixed(1)})`);
    rival.kx = 0;
    you.x -= 10;
    for (let ms = 0; ms < wait; ms += 4) {
      you.vx = 0;
      Object.assign(rival, { x: edge - 3, tv: 0, v: 0 });
      bounce.advance(round, 4, steady);
    }
    round.far = 1e9;
    const before = round.score;
    rival.x = edge + 2;
    bounce.advance(round, 4, steady);
    return { round, rival, got: round.score - before };
  };
  const quick = off(400);
  assert.ok(quick.rival.out > 0 && quick.rival.outKind === "tip", "off the road it tips over");
  assert.equal(quick.round.stats.bumped, 1);
  assert.equal(quick.got, bounce.BUMP_POINTS, "and scores");
  const late = off(bounce.CREDIT_MS + 100);
  assert.ok(late.rival.out > 0);
  assert.equal(late.round.stats.bumped, 0, "too late to be yours");
  assert.equal(late.got, 0);
});

test("Bounce Road: water or a hole under your wheels costs a life, flying over it does not, and a Bubble throws you clear instead", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const hole = round.road.holes.find((h) => h.kind === "crack");
  Object.assign(you, { d: hole.d0 + 2, v: 40, air: 300, airMax: 600 });
  bounce.advance(round, 100, steady);
  assert.equal(round.phase, "drive", "in the air over it, nothing");
  you.air = 0;
  you.d = hole.d0 + 2;
  bounce.advance(round, 4, steady);
  assert.equal(round.phase, "crash");
  assert.equal(round.lives, bounce.START_LIVES - 1, "wheels down over the hole: a life");
  for (let ms = 0; ms < bounce.CRASH_MS + 40; ms += 4) bounce.advance(round, 4, steady);
  assert.equal(round.phase, "ready");
  assert.ok(you.d < hole.d0 - bounce.RESPAWN_BACK / 2, `back before the hole (${you.d.toFixed(0)} < ${hole.d0})`);
  assert.equal(bounce.groundAt(round.road, you.x, you.d), bounce.GROUND.road, "on the road");
  const saved = bounceRound();
  const s = saved.cars[0];
  s.bubble = true;
  Object.assign(s, { d: hole.d0 + 2, v: 40 });
  bounce.advance(saved, 4, steady);
  assert.equal(saved.phase, "drive");
  assert.equal(saved.lives, bounce.START_LIVES, "the Bubble pops instead");
  assert.equal(s.bubble, false);
  assert.ok(s.air > 0, "and throws you up");
  for (let ms = 0; ms < 3000 && s.air > 0; ms += 4) bounce.advance(saved, 4, steady);
  assert.ok(s.d > hole.d1, "clear over the hole");
  for (let ms = 0; ms < 200; ms += 4) bounce.advance(saved, 4, steady);
  assert.equal(saved.lives, bounce.START_LIVES, "onto the road");
});

test("Bounce Road: a broken span the Bubble's throw carries you over is the Bubble's, never a jump of yours that scores", () => {
  const round = bounceRound(1);
  const road = round.road;
  bounce.ensureRoad(road, 20000);
  const span = road.holes.find((h) => h.kind === "span");
  assert.ok(span, "a broken span on the road");
  const river = road.rivers.find((r) => r.d0 <= span.d0 && r.d1 >= span.d1);
  const you = round.cars[0];
  while (road.stageAt[round.stage] <= river.d0) round.stage++;
  const d = river.d0 + 4;
  Object.assign(you, { d, x: road.L[bounce.rowOf(d)] - 3, v: 40, air: 0, bubble: true });
  Object.assign(round, { far: d, score: 0 });
  bounce.advance(round, 4, steady);
  assert.ok(you.air > 0 && you.bubble === false, "the Bubble pops and throws you");
  for (let ms = 0; ms < 3000 && you.air > 0; ms += 4) bounce.advance(round, 4, steady);
  assert.ok(you.d > span.d1, "clear over the break");
  const land = round.events.find((e) => e.type === "land");
  assert.equal(land.holes, 0, "no hole counted as jumped");
  assert.equal(round.stats.holes, 0);
  assert.equal(round.lives, bounce.START_LIVES);
});

/* ---------------------------------------------------- the road is fair */

test("Bounce Road: every hole of the first twenty stages, on many roads, is jumpable at JUMP_FAIR of the top speed (a drawbridge's lifted span included), with a run-up of road and a sign before it, and even the longest jump off the first of two breaks lands on the bridge between", () => {
  const fair = bounce.reach(bounce.JUMP_FAIR * bounce.TOP_SPEED);
  let twins = 0;
  let draws = 0;
  assert.ok(bounce.MIN_HOLE / 2 > (bounce.MAX_SPEED * bounce.SLICE_MS) / 1000, "no slice moves a car half the shortest hole");
  assert.ok(bounce.MAX_HOLE + bounce.CAR_L <= fair, "the longest hole any stage may cut is jumpable");
  for (let seed = 1; seed <= 8; seed++) {
    const road = bounce.newRoad(seed);
    while (road.built < 20) bounce.buildStage(road, road.built + 1);
    assert.ok(road.holes.length > 30, `seed ${seed} cuts holes`);
    const solid = (from, to) => {
      for (let i = Math.floor(from / bounce.ROW); i < Math.floor(to / bounce.ROW); i++) if (!road.deck[i] || road.dynOf[i]) return false;
      return true;
    };
    const riverOf = (x) => road.rivers.find((r) => r.d0 <= x.d0 && r.d1 >= x.d1);
    for (let k = 0; k < road.holes.length; k++) {
      const h = road.holes[k];
      const len = h.d1 - h.d0;
      if (h.kind === "draw") draws++;
      assert.ok(len >= bounce.MIN_HOLE && len <= bounce.MAX_HOLE, `seed ${seed}: a hole ${len} long`);
      assert.ok(len + bounce.CAR_L <= fair, `seed ${seed}: a ${len} hole is jumpable at ${bounce.JUMP_FAIR * bounce.TOP_SPEED} (${fair.toFixed(1)})`);
      const prev = k ? road.holes[k - 1] : null;
      if (prev && h.kind === "span" && prev.kind === "span" && riverOf(prev) === riverOf(h)) {
        twins++;
        assert.ok(prev.d0 + bounce.LONGEST_JUMP < h.d0 - 1, `seed ${seed}: the longest jump from the first brink (${bounce.LONGEST_JUMP.toFixed(1)}) lands before the second break (${h.d0 - prev.d0} on)`);
        assert.ok(bounce.LONGEST_JUMP >= bounce.reach(bounce.MAX_SPEED) * bounce.RAMP_AIR, "a ramp goes no further");
        assert.ok(h.d0 - prev.d1 >= 24 && solid(prev.d1, h.d0), "on a bridge long enough to jump again");
      } else {
        assert.ok(!prev || h.d0 - prev.d1 >= bounce.RUNUP - 10, `seed ${seed}: only two breaks on one bridge sit close`);
        const runup = h.kind === "crack" ? bounce.RUNUP : bounce.RUNUP - 34;
        for (let i = Math.floor((h.d0 - runup) / bounce.ROW); i < Math.floor(h.d0 / bounce.ROW); i++) assert.ok(road.deck[i] === 1 && !road.dynOf[i], `seed ${seed}: a run-up of road before the hole at ${h.d0}`);
        assert.ok(road.signs.some((s) => s.d < h.d0 && s.d > h.d0 - bounce.RUNUP - 60), `seed ${seed}: a sign before the hole at ${h.d0}`);
      }
    }
  }
  assert.ok(twins > 12, `bridges with two breaks were checked (${twins})`);
  assert.ok(draws > 8, `drawbridges were checked (${draws})`);
});

test("Bounce Road: with a Spring held and a Nitro burning, a jump off the first of two breaks at full speed comes down on the bridge between, never in the second break", () => {
  const round = bounceRound(1);
  const road = round.road;
  bounce.ensureRoad(road, 40000);
  const riverOf = (h) => road.rivers.find((r) => r.d0 <= h.d0 && r.d1 >= h.d1);
  const k = road.holes.findIndex((h, j) => j && h.kind === "span" && road.holes[j - 1].kind === "span" && riverOf(h) === riverOf(road.holes[j - 1]));
  assert.ok(k > 0, "a bridge with two breaks");
  const [first, second] = [road.holes[k - 1], road.holes[k]];
  while (road.stageAt[round.stage] <= first.d0) round.stage++;
  const you = round.cars[0];
  const i = bounce.rowOf(first.d0 - 1);
  Object.assign(you, { d: first.d0 - 0.5, x: (road.L[i] + road.R[i]) / 2, v: bounce.TOP_SPEED * bounce.NITRO_TOP, nitroMs: bounce.NITRO_MS, spring: true });
  round.far = 1e9;
  round.input.up = true;
  round.input.jump = bounce.JUMP_BUFFER_MS;
  bounce.advance(round, 4, steady);
  assert.ok(you.air > bounce.airMs(bounce.TOP_SPEED), "a long, sprung jump");
  for (let ms = 0; ms < 3000 && you.air > 0; ms += 4) bounce.advance(round, 4, steady);
  assert.equal(round.phase, "drive", "no splash");
  assert.ok(!round.events.some((e) => e.type === "lose" || e.type === "bubble"), "no life lost");
  assert.ok(you.d > first.d1 && you.d < second.d0, `down on the bridge between (${you.d.toFixed(1)}, between ${first.d1} and ${second.d0})`);
});

test("Bounce Road: a life lost puts you back with RESPAWN_RUN of plain road ahead, room to reach JUMP_FAIR of the top speed from a roll before the next hole, river or crumbling road", () => {
  const need = (bounce.JUMP_FAIR * bounce.TOP_SPEED) ** 2 - bounce.ROLL_SPEED ** 2;
  assert.ok(bounce.RESPAWN_RUN > need / (2 * bounce.ACCEL) + 0.5 * bounce.ROLL_SPEED, "a run-up long enough, with half a second to react");
  for (let seed = 1; seed <= 4; seed++) {
    const road = bounce.newRoad(seed);
    while (road.built < 11) bounce.buildStage(road, road.built + 1);
    const danger = [...road.holes.map((h) => h.d0), ...road.rivers.map((r) => r.d0), ...road.dyn.map((s) => s.d0)].sort((a, b) => a - b);
    for (let d = 60; d < road.stageAt[10]; d += 9) {
      const at = bounce.safeSpot(road, d);
      const next = danger.find((x) => x > at);
      assert.ok(next - at >= bounce.RESPAWN_RUN, `seed ${seed}: back at ${at.toFixed(0)} after a crash at ${d}, ${(next - at).toFixed(0)} before the next hole`);
      assert.ok(d - at < 450, `seed ${seed}: never far back (${(d - at).toFixed(0)})`);
    }
  }
});

test("Bounce Road: the road's edges slant from row to row the way they are drawn, never a stair step: the ground under a car eases from one row's edge to the next", () => {
  const road = bounce.newRoad(3);
  while (road.built < 4) bounce.buildStage(road, road.built + 1);
  let checked = 0;
  for (let i = 1; i < road.rows; i++) {
    if (road.deck[i] !== 1 || road.dynOf[i] || road.ML[i] < road.MR[i] || Math.abs(road.L[i] - road.L[i - 1]) < 1) continue;
    const x = (road.L[i] + road.L[i - 1]) / 2;
    const near = bounce.groundAt(road, x, i * bounce.ROW + 0.1);
    const far = bounce.groundAt(road, x, i * bounce.ROW + bounce.ROW - 0.1);
    assert.notEqual(near, far, `row ${i}: halfway between its edges, the ground changes along the row`);
    const mid = road.L[i - 1] + (road.L[i] - road.L[i - 1]) * 0.5;
    assert.equal(bounce.groundAt(road, mid + 0.05, i * bounce.ROW + 1), bounce.GROUND.road, "just inside the eased edge, road");
    assert.notEqual(bounce.groundAt(road, mid - 0.05, i * bounce.ROW + 1), bounce.GROUND.road, "just outside it, not");
    checked++;
  }
  assert.ok(checked > 20, `slanted rows checked (${checked})`);
});

test("Bounce Road: a long run's lists are read from where the view is, not from the start: firstAt finds the same entries a full scan does, and holesIn too, and every list is laid in order along the road", () => {
  const road = bounce.newRoad(4);
  bounce.ensureRoad(road, 30000);
  for (const [list, key] of [[road.holes, "d0"], [road.signs, "d"], [road.items, "d"], [road.stars, "d"], [road.pads, "d"], [road.blocks, "d"], [road.hazards, "d"], [road.dyn, "d0"]]) {
    for (let k = 1; k < list.length; k++) assert.ok(list[k][key] >= list[k - 1][key], `${key} in order`);
  }
  for (const d of [-5, 0, 333, 5000, 12345, 19999, 1e9]) {
    for (const [list, key] of [[road.holes, "d0"], [road.signs, "d"], [road.items, "d"], [road.hazards, "d"]]) {
      const k = bounce.firstAt(list, key, d);
      assert.ok(list.slice(0, k).every((e) => e[key] < d) && list.slice(k).every((e) => e[key] >= d), `${key} at ${d}`);
    }
    for (const len of [10, 80, 400]) assert.deepEqual(bounce.holesIn(road, d, d + len), road.holes.filter((h) => h.d0 > d && h.d1 <= d + len));
  }
});

test("Bounce Road: the rivals' list is kept in place from slice to slice, with the ones far behind dropped", () => {
  const round = bounceRound(5, true);
  const cars = round.cars;
  assert.ok(cars.length >= 2);
  const far = cars[1];
  far.d = round.cars[0].d - 500;
  bounce.advance(round, 40, steady);
  assert.equal(round.cars, cars, "the same list");
  assert.ok(!cars.includes(far), "the one far behind is gone");
  assert.equal(cars[0].id, 0, "you first");
});

test("Bounce Road: the same seed builds the same road, a different one another, every stage keeps the road on the field and a flowerbed with room either side, and past the tenth the road goes round again, quicker and meaner", () => {
  const a = bounce.newRoad(42);
  const b = bounce.newRoad(42);
  const c = bounce.newRoad(43);
  for (const r of [a, b, c]) while (r.built < 12) bounce.buildStage(r, r.built + 1);
  assert.deepEqual([a.L, a.R, a.ML, a.deck, a.under, a.dynOf, a.stageAt, a.hazards.map((h) => h.kind)], [b.L, b.R, b.ML, b.deck, b.under, b.dynOf, b.stageAt, b.hazards.map((h) => h.kind)]);
  assert.notDeepEqual(a.L, c.L);
  for (let i = 0; i < a.rows; i++) {
    assert.ok(a.L[i] >= 1 && a.R[i] <= bounce.FIELD_W - 1, `row ${i} on the field`);
    if (a.ML[i] < a.MR[i]) assert.ok(a.ML[i] - a.L[i] >= 15 && a.R[i] - a.MR[i] >= 15, `row ${i}: room round the flowerbed`);
  }
  assert.equal(bounce.STAGES.length, 10, "ten stages");
  assert.equal(new Set(bounce.STAGES.map((s) => s.id)).size, 10, "each with its own look");
  for (const s of bounce.STAGES) assert.ok(LOOKS[s.id], `${s.id} has a look`);
  for (let n = 1; n <= 10; n++) {
    const len = a.stageAt[n] - a.stageAt[n - 1];
    assert.ok(len >= bounce.STAGES[n - 1].len && len < bounce.STAGES[n - 1].len + 350, `stage ${n} is ${len} long`);
  }
  assert.equal(bounce.stageFor(11), bounce.stageFor(11), "built once");
  assert.equal(bounce.stageFor(11).name, `${bounce.STAGES[bounce.LAP_FROM - 1].title} 2`);
  assert.equal(bounce.stageFor(18).name, "Monster Mash 2");
  assert.ok(bounce.stageFor(18).boss, "the Monster is back each lap");
  assert.ok(bounce.stageFor(11).pace > bounce.stageFor(bounce.LAP_FROM).pace && bounce.stageFor(40).rivals <= bounce.MAX_RIVALS && bounce.stageFor(40).crack[1] <= bounce.MAX_HOLE);
});

test("Bounce Road: each stage brings something new: its own pieces, hazards or rivals, and later stages bring more at once", () => {
  const seen = new Set();
  let before = 0;
  for (const s of bounce.STAGES) {
    const things = [...Object.keys(s.weights).filter((k) => k !== "straight" && s.weights[k] > 0), ...s.kinds];
    const fresh = things.filter((t) => !seen.has(t));
    if (s.n !== 1) assert.ok(fresh.length > 0 || s.boss || s.id === "night", `${s.title} brings something new (Night Lights brings the dark)`);
    for (const t of things) seen.add(t);
    assert.ok(things.length >= before - 7, `${s.title} keeps up the mix (${things.length})`);
    before = Math.max(before, things.length);
  }
  for (const piece of bounce.PIECE_NAMES) if (piece !== "straight") assert.ok(seen.has(piece), `the ${piece} turns up`);
  for (const kind of bounce.RIVAL_KINDS) if (kind !== "monster") assert.ok(seen.has(kind), `the ${kind} turns up`);
  const kinds = new Set();
  for (const seed of [2, 9]) {
    const road = bounce.newRoad(seed);
    while (road.built < 10) bounce.buildStage(road, road.built + 1);
    for (const e of [...road.hazards, ...road.pads, ...road.blocks, ...road.dyn]) kinds.add(e.kind);
  }
  for (const k of ["train", "ball", "sprinkler", "drop", "wind", "boost", "ramp", "slick", "cone", "block", "draw", "sway", "crumble"]) assert.ok(kinds.has(k), `a ${k} on the road`);
});

/* ------------------------------------------------------------ bots */

test("Bounce Road: a careful bot crosses all ten stages with no rivals and no life lost, each stage taking 20 to 50 seconds", () => {
  for (const seed of [3, 21]) {
    const round = bounceRound(seed);
    const { secs, lost } = play(round, carefulBot, { stage: 11 });
    assert.equal(round.stage, 11, `seed ${seed} reaches stage 11 (${round.stage}, lost ${lost})`);
    assert.deepEqual(lost, [], `seed ${seed}: no life lost`);
    for (const [n, s] of secs.entries()) assert.ok(s > 20 && s < 50, `seed ${seed}: stage ${n + 1} took ${s.toFixed(0)} s`);
  }
});

test("Bounce Road: with the rivals out, the careful bot still gets far, but they cost it lives on the way", () => {
  let lostAll = 0;
  for (const seed of [11, 42]) {
    const round = bounce.newRound(seed, bounce.seeded(seed));
    const { lost } = play(round, carefulBot, { stage: 11, rivals: true, seed });
    assert.ok(round.stage >= 6, `seed ${seed}: reached stage ${round.stage}`);
    lostAll += lost.length;
    assert.ok(round.stats.crushed + round.stats.bumped + round.stats.near > 5, "and it met them");
  }
  assert.ok(lostAll >= 4, `the rivals cost lives (${lostAll})`);
});

test("Bounce Road: a sloppy bot that drives the middle and never jumps loses every life within the first two stages, in under a minute", () => {
  for (const seed of [3, 11, 21]) {
    const round = bounce.newRound(seed, steady);
    const { ms } = play(round, (r) => {
      const you = r.cars[0];
      const i = Math.floor(you.d / bounce.ROW);
      const tx = (r.road.L[i] + r.road.R[i]) / 2;
      Object.assign(r.input, { up: true, left: tx < you.x - 0.5, right: tx > you.x + 0.5 });
    }, { rivals: true, seed });
    assert.ok(round.over, `seed ${seed}: the run is over`);
    assert.ok(round.stage <= 2 && ms < 60000, `seed ${seed}: at stage ${round.stage} after ${(ms / 1000).toFixed(0)} s`);
  }
});

test("Bounce Road: with you out of the way the rivals keep driving, never under RIVAL_MIN_SPEED and never stuck, hop the holes, and hardly ever tip off the road on their own", () => {
  let tipped = 0;
  let hops = 0;
  let seen = 0;
  for (const seed of [2, 5]) {
    const round = bounce.newRound(seed, steady);
    const you = round.cars[0];
    const last = new Map();
    for (let ms = 0; ms < 160000; ms += 16) {
      const i = Math.floor(you.d / bounce.ROW);
      Object.assign(you, { ghostMs: 1e9, air: 1000, airMax: 1000, v: 46, x: round.road.ML[i] < round.road.MR[i] ? round.road.L[i] + 3 : (round.road.L[i] + round.road.R[i]) / 2 });
      bounce.advance(round, 16, steady);
      for (const e of round.events) {
        if (e.type === "wreck" && e.how === "tip") tipped++;
        if (e.type === "hop") hops++;
      }
      round.events.length = 0;
      for (const c of round.cars) {
        if (c.id === 0 || c.out > 0) continue;
        assert.ok(c.v >= bounce.RIVAL_MIN_SPEED - 1e-9, `${c.kind} keeps moving`);
        if (ms % 2000 === 0) {
          if (last.has(c)) assert.ok(c.d - last.get(c) > 20, `${c.kind} makes headway`);
          last.set(c, c.d);
          seen++;
        }
      }
    }
    assert.ok(round.stage >= 5, `you got as far as stage ${round.stage}`);
  }
  assert.ok(seen > 200 && hops > 40, `rivals seen ${seen}, hops ${hops}`);
  assert.ok(tipped <= 12, `rivals tipped off the road on their own: ${tipped}`);
});

/* ------------------------------------------------------- the rivals */

test("Bounce Road: a jump pressed in the slice a Frog lands on you leaves the ground first, and two landing on each other in one slice is your crush", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const at = plainSpot(round.road, 60, 30);
  Object.assign(you, { x: at.x, d: at.d, v: 40 });
  const frog = bounceRival(round, "frog", at.x, at.d, { air: 3, airMax: 640, v: 0 });
  round.input.jump = bounce.JUMP_BUFFER_MS;
  bounce.advance(round, 4, steady);
  assert.equal(round.phase, "drive", "no squash");
  assert.ok(you.air > 0, "you are up");
  assert.equal(frog.out, 0);
  const r2 = bounceRound();
  const y2 = r2.cars[0];
  Object.assign(y2, { x: at.x, d: at.d, v: 40, air: 3, airMax: 600 });
  const f2 = bounceRival(r2, "frog", at.x, at.d + 0.5, { air: 3, airMax: 640, v: 0 });
  bounce.advance(r2, 4, steady);
  assert.equal(r2.phase, "drive", "a dead heat is never your squash");
  assert.equal(f2.outKind, "flat", "it is the Frog's");
  assert.equal(r2.chain, 1);
  const r3 = bounceRound();
  const y3 = r3.cars[0];
  Object.assign(y3, { x: at.x, d: at.d, v: 40 });
  bounceRival(r3, "frog", at.x, at.d, { air: 3, airMax: 640, v: 0 });
  bounce.advance(r3, 4, steady);
  assert.equal(r3.phase, "crash", "a Frog landing on you with your wheels down squashes you");
});

test("Bounce Road: the Brick holds the lane in front of you, the Nudge comes alongside and swipes into you up to 1 + 2 * sharp times, and the Zigzag weaves", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const at = plainSpot(round.road, 60, 60);
  Object.assign(you, { x: at.x - 6, d: at.d, v: 40 });
  const brick = bounceRival(round, "brick", at.x + 6, at.d + 20, { v: 34 });
  for (let ms = 0; ms < 2000; ms += 4) {
    bounce.think(round, brick, 4, steady);
    bounce.move(round, brick, 4);
    brick.d = at.d + 20;
  }
  assert.ok(Math.abs(brick.x - you.x) < 2, `the Brick slid over in front of you (${brick.x.toFixed(1)} against ${you.x.toFixed(1)})`);
  const r2 = bounceRound();
  const y2 = r2.cars[0];
  Object.assign(y2, { x: at.x, d: at.d, v: 40 });
  const nudge = bounceRival(r2, "nudge", at.x + 6, at.d - 20, { v: 40, mode: "chase", chaseMs: 0 });
  const limit = 1 + Math.round(2 * bounce.stageFor(1).sharp);
  for (let ms = 0; ms < 8000 && nudge.mode === "chase"; ms += 4) {
    bounce.think(r2, nudge, 4, steady);
    bounce.move(r2, nudge, 4);
    y2.d += 0.16;
    y2.x = at.x;
    y2.kx = 0;
    bounce.collide(r2, nudge, y2);
  }
  assert.equal(nudge.swipes, limit, `it swiped ${limit} times`);
  assert.equal(nudge.mode, "calm", "then settled");
  const r3 = bounceRound();
  const zig = bounceRival(r3, "zigzag", at.x, at.d + 30, { v: 40 });
  let lo = 1e9;
  let hi = -1e9;
  for (let ms = 0; ms < 6000; ms += 4) {
    bounce.think(r3, zig, 4, steady);
    bounce.move(r3, zig, 4);
    r3.clock += 4;
    zig.d = at.d + 30;
    lo = Math.min(lo, zig.x);
    hi = Math.max(hi, zig.x);
  }
  assert.ok(hi - lo > 10, `the Zigzag weaves (${(hi - lo).toFixed(1)} across)`);
});

test("Bounce Road: a sharp Brick brake-checks you from in front, and a rival far behind you speeds up to keep the pack close", () => {
  const round = bounceRound();
  round.stage = 10;
  const you = round.cars[0];
  const at = plainSpot(round.road, 60, 40);
  Object.assign(you, { x: at.x, d: at.d, v: 50 });
  const brick = bounceRival(round, "brick", at.x, at.d + 13, { v: 50, mode: "" });
  bounce.think(round, brick, 4, () => 0);
  assert.equal(brick.mode, "brake", "it brakes");
  assert.ok(brick.tv <= you.v * 0.5 + 1e-9, `hard (${brick.tv.toFixed(1)})`);
  assert.equal(eventsOf(round, "brake").length, 1);
  const zig = bounceRival(round, "zigzag", at.x, at.d - 35, { v: 40 });
  const ahead = bounceRival(round, "zigzag", at.x - 8, at.d + 60, { v: 40 });
  bounce.think(round, zig, 4, steady);
  bounce.think(round, ahead, 4, steady);
  assert.ok(zig.tv > ahead.tv * 1.05, `the one behind hurries (${zig.tv.toFixed(1)} against ${ahead.tv.toFixed(1)})`);
});

test("Bounce Road: the Cop comes up from behind, sits on your roomier side and leans in to push you toward the near edge, then gives up after COP_MS", () => {
  const round = bounceRound();
  round.stage = 7;
  const you = round.cars[0];
  const at = plainSpot(round.road, 200, 60);
  const span = bounce.spanAt(round.road, at.x, at.d);
  const lo = span.lo;
  Object.assign(you, { x: lo + 8, d: at.d, v: 40 });
  const cop = bounceRival(round, "cop", you.x + 3, at.d - 25, { v: 40, mode: "chase", chaseMs: 0, modeMs: 0 });
  let pushed = 0;
  for (let ms = 0; ms < 4000 && !pushed; ms += 4) {
    bounce.think(round, cop, 4, steady);
    bounce.move(round, cop, 4);
    you.d += 0.16;
    you.x = lo + 8;
    if (bounce.collide(round, cop, you) === "side" && you.kx < 0) pushed = you.kx;
    you.kx = 0;
  }
  assert.equal(cop.offside, 1, "on your right, where the road is wider");
  assert.ok(pushed < 0, "it shoved you toward the near (left) edge");
  cop.chaseMs = bounce.COP_MS + 1;
  bounce.think(round, cop, 4, steady);
  assert.equal(cop.mode, "calm", "and gives up in the end");
});

test("Bounce Road: the Bruiser swerves into you when you come alongside, the Sneak drops cones behind it while you follow, and the Racer comes past and flees", () => {
  const round = bounceRound();
  round.stage = 8;
  const you = round.cars[0];
  const at = plainSpot(round.road, 200, 80);
  Object.assign(you, { x: at.x - 6, d: at.d, v: 45 });
  const bruiser = bounceRival(round, "bruiser", at.x + 6, at.d + 4, { v: 45, mode: "" });
  bounce.think(round, bruiser, 4, steady);
  assert.ok(bruiser.tx < at.x + 6 - 3, `it heads for you (${bruiser.tx.toFixed(1)})`);
  const sneak = bounceRival(round, "sneak", at.x, at.d + 40, { v: 45, dropIn: 0, mode: "" });
  for (let ms = 0; ms < 12000; ms += 16) {
    bounce.think(round, sneak, 16, steady);
    sneak.d = at.d + 40;
  }
  assert.equal(sneak.drops, bounce.SNEAK_DROPS, `it dropped its ${bounce.SNEAK_DROPS} cones`);
  assert.equal(round.drops.filter((b) => b.kind === "cone").length, bounce.SNEAK_DROPS);
  assert.ok(round.drops.every((b) => b.d < sneak.d), "behind it");
  const racer = bounce.spawnRival(round, "racer", steady);
  assert.ok(racer && racer.d < you.d, "the Racer comes from behind");
  assert.ok(racer.v > you.v, "faster than you");
  for (let ms = 0; ms < 10000 && racer.mode === "chase"; ms += 4) {
    bounce.think(round, racer, 4, steady);
    bounce.move(round, racer, 4);
    you.d += 0.18;
  }
  assert.equal(racer.mode, "flee", "past you, it flees");
  bounce.think(round, racer, 4, steady);
  assert.ok(racer.tv > bounce.TOP_SPEED, "faster than you can go without a boost");
  assert.ok(bounce.RIVALS.racer.points >= 2 * bounce.RIVALS.zigzag.points, "worth catching");
});

test("Bounce Road: a sharp rival under your landing swerves out from under it, a dull one does not, and each decides once a jump", () => {
  const swerve = (roll) => {
    const round = bounceRound();
    round.stage = 10;
    const you = round.cars[0];
    const at = plainSpot(round.road, 200, 60);
    Object.assign(you, { x: at.x, d: at.d - 20, v: 40, air: 500, airMax: 800, jumps: 1 });
    const zig = bounceRival(round, "zigzag", at.x, at.d, { v: 0, mode: "" });
    bounce.think(round, zig, 4, () => roll);
    return { zig, at };
  };
  const sharp = swerve(0.05);
  assert.notEqual(sharp.zig.dodge, 0, "it swerves");
  assert.ok(Math.abs(sharp.zig.tx - sharp.at.x) > 5, `away from where you land (${sharp.zig.tx.toFixed(1)})`);
  const dull = swerve(0.99);
  assert.equal(dull.zig.dodge, 0, "a poor roll stays put");
  assert.equal(dull.zig.dodgeFor, 1, "decided for this jump");
});

test("Bounce Road: the Monster truck comes in Monster Mash, five landings on its roof beat it for BOSS_POINTS and a life, its back is a wall, and it gets away at the stage line", () => {
  const round = bounceRound(4);
  const road = round.road;
  bounce.ensureRoad(road, 30000);
  round.stage = 10;
  const you = round.cars[0];
  const from = road.stageAt[9];
  const at = plainSpot(road, from + bounce.stageFor(10).len * 0.2, 30);
  Object.assign(you, { x: at.x, d: at.d, v: 40 });
  round.far = 1e9;
  bounce.advance(round, 16, steady);
  const m = round.cars.find((c) => c.kind === "monster");
  assert.ok(m, "the Monster is out");
  assert.equal(m.hp, bounce.BOSS_HP);
  assert.ok(eventsOf(round, "spawn").some((e) => e.kind === "monster"));
  round.lives = 2;
  for (let n = 0; n < bounce.BOSS_HP; n++) {
    Object.assign(m, { x: you.x, d: you.d + 1, air: 0, hopIn: 1e9, dropIn: 1e9, v: you.v });
    Object.assign(you, { air: 4, airMax: 600 });
    bounce.advance(round, 4, steady);
    you.air = 0;
    m.d = you.d + 40;
  }
  assert.equal(m.hp, 0);
  assert.equal(m.outKind, "flat", "flattened at last");
  assert.equal(eventsOf(round, "boss").length, 1);
  assert.equal(round.lives, 3, "a life back");
  assert.equal(round.stats.bosses, 1);
  const r2 = bounceRound(4);
  r2.stage = 10;
  bounce.ensureRoad(r2.road, 30000);
  const y2 = r2.cars[0];
  Object.assign(y2, { x: at.x, d: at.d, v: 50 });
  const m2 = bounceRival(r2, "monster", at.x, at.d + 9.5, { v: 20, hp: bounce.BOSS_HP });
  bounce.collide(r2, y2, m2);
  assert.equal(r2.phase, "crash", "its back is a wall");
  const r3 = bounceRound(4);
  r3.stage = 10;
  bounce.ensureRoad(r3.road, 30000);
  const m3 = bounceRival(r3, "monster", 30, r3.road.stageAt[10] + 30, { hp: 3 });
  r3.bossFor = 10;
  const y3 = r3.cars[0];
  y3.d = r3.road.stageAt[10] - 0.5;
  y3.x = (r3.road.L[bounce.rowOf(y3.d)] + r3.road.R[bounce.rowOf(y3.d)]) / 2;
  r3.far = 1e9;
  bounce.advance(r3, 60, steady);
  assert.equal(r3.stage, 11);
  assert.equal(m3.outKind, "gone", "it got away");
  assert.equal(eventsOf(r3, "escape").length, 1);
});

/* ------------------------------------------------------- the hazards */

test("Bounce Road: a boost strip pushes you past the top speed even off the throttle, and scores", () => {
  const round = bounceRound(2);
  const pad = onto(round, "pads", (p) => p.kind === "boost", 0);
  const you = round.cars[0];
  Object.assign(you, { x: pad.x, d: pad.d, v: bounce.TOP_SPEED });
  bounce.advance(round, 4, steady);
  assert.ok(you.boostMs > 0, "boosting");
  assert.ok(round.score >= bounce.BOOST_POINTS, "and it scores");
  let top = 0;
  for (let ms = 0; ms < 800; ms += 4) {
    bounce.move(round, you, 4);
    top = Math.max(top, you.v);
  }
  assert.ok(top > bounce.TOP_SPEED * 1.15, `faster than the top speed (${top.toFixed(1)})`);
  assert.ok(top <= bounce.MAX_SPEED);
});

test("Bounce Road: a slick takes your grip: the steering answers slowly and a knock lasts longer", () => {
  const steerAfter = (slick) => {
    const round = bounceRound();
    const you = round.cars[0];
    you.slickMs = slick ? 5000 : 0;
    you.kx = 10;
    round.input.right = true;
    for (let ms = 0; ms < 200; ms += 4) bounce.move(round, you, 4);
    return { vx: you.vx, kx: you.kx };
  };
  const dry = steerAfter(false);
  const wet = steerAfter(true);
  assert.ok(wet.vx < dry.vx * 0.6, `slower to steer (${wet.vx.toFixed(1)} against ${dry.vx.toFixed(1)})`);
  assert.ok(wet.kx > dry.kx * 1.2, "the knock lingers");
  const round = bounceRound(3);
  const pad = onto(round, "pads", (p) => p.kind === "slick", 0);
  const you = round.cars[0];
  Object.assign(you, { x: pad.x, d: pad.d });
  bounce.advance(round, 4, steady);
  assert.ok(you.slickMs > 0, "driving onto one");
});

test("Bounce Road: a ramp launches whoever crosses its lip RAMP_AIR the usual jump, clear over its crack, for big-air points on landing", () => {
  const round = bounceRound(5);
  const ramp = onto(round, "pads", (p) => p.kind === "ramp", 0);
  const you = round.cars[0];
  const lip = ramp.d + ramp.l / 2;
  Object.assign(you, { x: ramp.x, d: lip - 0.5, v: 50, pnose: lip - 0.5 + you.l / 2 });
  round.input.up = true;
  for (let ms = 0; ms < 40 && you.air <= 0; ms += 4) bounce.advance(round, 4, steady);
  assert.ok(you.air > 0, "launched");
  assert.ok(Math.abs(you.airMax - bounce.airMs(you.v) * bounce.RAMP_AIR) < 1, "a ramp's jump");
  for (let ms = 0; ms < 3000 && you.air > 0; ms += 4) bounce.advance(round, 4, steady);
  assert.equal(round.lives, bounce.START_LIVES, "clear over the crack");
  const land = round.events.find((e) => e.type === "land");
  assert.ok(land && land.big && land.holes === 1, "big air, and the hole jumped");
  const rv = bounceRound(5);
  const r2 = onto(rv, "pads", (p) => p.kind === "ramp", 60);
  const zig = bounceRival(rv, "zigzag", r2.x, r2.d + r2.l / 2 - 0.3, { v: 45, tv: 45, mode: "" });
  bounce.advance(rv, 16, steady);
  assert.ok(zig.air > bounce.airMs(40), "a rival flies off it too");
});

test("Bounce Road: a chicane's cones knock flying and slow you, a block nose first is a crash and from the side a push back out, and one jumped scores", () => {
  const round = bounceRound(1);
  const cone = onto(round, "blocks", (b) => b.kind === "cone", 0);
  const you = round.cars[0];
  Object.assign(you, { x: cone.x, d: cone.d - 4.6, v: 50 });
  round.input.up = true;
  for (let ms = 0; ms < 200 && !cone.hit; ms += 4) bounce.advance(round, 4, steady);
  assert.ok(cone.hit, "knocked flying");
  assert.ok(you.v < 40, `it slows you (${you.v.toFixed(1)})`);
  assert.equal(round.lives, bounce.START_LIVES, "no life");
  const r2 = bounceRound(1);
  const block = onto(r2, "blocks", (b) => b.kind === "block", 0);
  const y2 = r2.cars[0];
  Object.assign(y2, { x: block.x, d: block.d - 5.2, v: 40, pnose: block.d - 5.2 + 3.5 });
  for (let ms = 0; ms < 200 && r2.phase === "drive"; ms += 4) bounce.advance(r2, 4, steady);
  assert.equal(r2.phase, "crash", "nose first into a block");
  const r3 = bounceRound(1);
  const b3 = onto(r3, "blocks", (b) => b.kind === "block", 0);
  const y3 = r3.cars[0];
  const inner = b3.side < 0 ? b3.x + b3.w / 2 : b3.x - b3.w / 2;
  Object.assign(y3, { x: inner + (b3.side < 0 ? 1.5 : -1.5), d: b3.d, v: 40, pnose: b3.d + 3.5 });
  bounce.advance(r3, 4, steady);
  assert.equal(r3.phase, "drive", "from the side, no crash");
  assert.ok(Math.abs(y3.x - b3.x) >= (b3.w + y3.w) / 2 - 1e-6, "pushed out");
  const r4 = bounceRound(1);
  const b4 = onto(r4, "blocks", (b) => b.kind === "block", 0);
  const y4 = r4.cars[0];
  Object.assign(y4, { x: b4.x, d: b4.d - 8, v: 50, air: 500, airMax: 600, jumpFrom: b4.d - 8 });
  for (let ms = 0; ms < 1000 && y4.air > 0; ms += 4) {
    bounce.advance(r4, 4, steady);
    y4.x = b4.x;
  }
  const land = r4.events.find((e) => e.type === "land");
  assert.ok(land && land.overs.includes("block"), "over the block");
  assert.ok(land.points >= bounce.OVER_POINTS);
});

test("Bounce Road: crumbling road falls away behind you once you reach it: at a fair speed you outrun it, at a roll it takes you, and a life lost makes it whole again", () => {
  const run = (speed) => {
    const round = bounceRound(6);
    const s = onto(round, "dyn", (x) => x.kind === "crumble", 4);
    const you = round.cars[0];
    you.v = speed;
    for (let ms = 0; ms < 20000 && you.d < s.d1 + 10 && round.phase === "drive"; ms += 16) {
      const i = bounce.rowOf(you.d);
      you.x = (round.road.L[i] + round.road.R[i]) / 2;
      round.input.up = speed > bounce.ROLL_SPEED;
      round.input.down = speed <= bounce.ROLL_SPEED;
      bounce.advance(round, 16, steady);
    }
    return { round, s };
  };
  assert.ok(bounce.CRUMBLE_SPEED < bounce.JUMP_FAIR * bounce.TOP_SPEED, "slower than a fair speed");
  const fast = run(bounce.JUMP_FAIR * bounce.TOP_SPEED);
  assert.ok(fast.s.start !== null, "it started");
  assert.equal(fast.round.lives, bounce.START_LIVES, "outrun");
  const slow = run(bounce.ROLL_SPEED);
  assert.equal(slow.round.phase, "crash", "at a roll it falls away under you");
  for (let ms = 0; ms < bounce.CRASH_MS + 40; ms += 4) bounce.advance(slow.round, 4, steady);
  assert.equal(slow.s.start, null, "made whole for another go");
});

test("Bounce Road: a drawbridge's span is water while it lifts and road while it is down, and a swaying bridge always carries its middle line while its edge goes over the water", () => {
  const road = bounce.newRoad(2);
  bounce.ensureRoad(road, 40000);
  const draw = road.dyn.find((s) => s.kind === "draw");
  assert.ok(draw, "a drawbridge");
  const mid = (draw.d0 + draw.d1) / 2;
  const i = bounce.rowOf(mid);
  const x = (road.L[i] + road.R[i]) / 2;
  let open = 0;
  let shut = 0;
  for (let t = 0; t < 8000; t += 50) {
    const g = bounce.groundAt(road, x, mid, t);
    if (bounce.drawLift(draw, t) > 0.05) {
      assert.equal(g, bounce.GROUND.water);
      open++;
    } else {
      assert.equal(g, bounce.GROUND.road);
      shut++;
    }
  }
  assert.ok(open > 10 && shut > 10, `it lifts and lowers (${open} open, ${shut} shut)`);
  const sway = road.dyn.find((s) => s.kind === "sway");
  assert.ok(sway, "a swaying bridge");
  const sm = (sway.d0 + sway.d1) / 2;
  let wet = 0;
  for (let t = 0; t < 8000; t += 40) {
    assert.equal(bounce.groundAt(road, sway.c, sm, t), bounce.GROUND.road, "the middle line always on it");
    if (bounce.groundAt(road, sway.c + sway.bw / 2 - 0.5, sm, t) !== bounce.GROUND.road) wet++;
  }
  assert.ok(wet > 10, `its edge sways over the water (${wet})`);
  assert.ok(sway.amp >= 3, `it really sways (${sway.amp.toFixed(1)})`);
});

test("Bounce Road: a toy train flashes before it crosses, hits a car on the track, never one in the air (that scores on landing), and a rival hops the track when it comes", () => {
  const round = bounceRound(3);
  const h = onto(round, "hazards", (x) => x.kind === "train", 6);
  const you = round.cars[0];
  let t = 0;
  const covers = (tt) => {
    const tr = bounce.trainAt(h, tt);
    return tr.on && tr.x0 < you.x - 5 && tr.x1 > you.x + 5;
  };
  while (!covers(t)) t += 10;
  let warnAt = t;
  while (bounce.trainAt(h, warnAt).warn) warnAt -= 10;
  assert.ok(t - warnAt >= bounce.TRAIN_WARN_MS - 20, "its lights flash first");
  round.clock = t;
  Object.assign(you, { d: h.d, v: 30 });
  bounce.advance(round, 4, steady);
  assert.equal(round.phase, "crash", "on the track as it passes: a life");
  assert.equal(eventsOf(round, "lose")[0].cause, "train");
  const r2 = bounceRound(3);
  const h2 = onto(r2, "hazards", (x) => x.kind === "train", 6);
  const y2 = r2.cars[0];
  r2.clock = t;
  Object.assign(y2, { d: h2.d - 6, v: 40, air: 500, airMax: 700, jumpFrom: h2.d - 30 });
  for (let ms = 0; ms < 1000 && y2.air > 0; ms += 4) bounce.advance(r2, 4, steady);
  assert.equal(r2.phase, "drive", "over it in the air");
  const land = r2.events.find((e) => e.type === "land");
  assert.ok(land.overs.includes("train"), "jumped the train");
  const r3 = bounceRound(3);
  const h3 = onto(r3, "hazards", (x) => x.kind === "train", 60);
  r3.clock = t - 200;
  const zig = bounceRival(r3, "zigzag", r3.cars[0].x, h3.d - h3.half - 6, { v: 40, tv: 40, mode: "" });
  bounce.think(r3, zig, 4, steady);
  assert.ok(zig.air > 0, "the rival hops the coming train");
});

test("Bounce Road: a rolling ball bonks a car sideways and slows you without a life, a sprinkler's jet pushes you off its side, and a gust blows you its way only while it blows", () => {
  const round = bounceRound(2);
  const ball = onto(round, "hazards", (x) => x.kind === "ball", 0);
  const you = round.cars[0];
  const bx = bounce.ballX(ball, round.clock + 4);
  Object.assign(you, { x: bx + 2, d: ball.d, v: 50, kx: 0 });
  bounce.advance(round, 4, steady);
  assert.ok(you.kx > 20, `knocked away (${you.kx.toFixed(1)})`);
  assert.ok(you.v < 40, "slowed");
  assert.equal(round.lives, bounce.START_LIVES, "no life");
  assert.equal(eventsOf(round, "bonk").length, 1);
  const r2 = bounceRound(2);
  const sp = onto(r2, "hazards", (x) => x.kind === "sprinkler", 0);
  const y2 = r2.cars[0];
  const s = bounce.sprayAt(sp, r2.clock);
  Object.assign(y2, { x: (s.x0 + s.x1) / 2, d: (s.d0 + s.d1) / 2, v: 0.001, kx: 0 });
  bounce.advance(r2, 40, steady);
  assert.ok(y2.kx * -sp.side > 1, `pushed away from the sprinkler's side (${y2.kx.toFixed(2)})`);
  const r3 = bounceRound(4);
  const w = onto(r3, "hazards", (x) => x.kind === "wind", -20);
  const y3 = r3.cars[0];
  let t = 0;
  while (bounce.gustAt(w, t) < 1) t += 10;
  r3.clock = t;
  Object.assign(y3, { kx: 0, v: 0.001 });
  bounce.advance(r3, 200, steady);
  assert.ok(y3.kx * w.dir > 5, `blown its way (${y3.kx.toFixed(1)})`);
  while (bounce.gustAt(w, t) > 0) t += 10;
  t += 10;
  r3.clock = t;
  Object.assign(y3, { kx: 0, d: w.d + 10 });
  bounce.advance(r3, 100, steady);
  assert.ok(Math.abs(y3.kx) < 0.01, "calm between gusts");
});

test("Bounce Road: something falls where you are heading, its shadow growing for DROP_FALL_MS: under it you are squashed, and then it lies on the road as a block", () => {
  const round = bounceRound(1);
  const h = onto(round, "hazards", (x) => x.kind === "drop", bounce.DROP_TRIGGER - 1);
  const you = round.cars[0];
  you.v = 0.001;
  bounce.advance(round, 4, steady);
  assert.ok(h.at > 0, "it falls");
  assert.ok(Math.abs(h.x - you.x) < 3, "aimed at your line");
  assert.equal(eventsOf(round, "dropWarn").length, 1);
  for (let ms = 0; ms < bounce.DROP_FALL_MS + 20 && round.phase === "drive"; ms += 4) {
    Object.assign(you, { d: h.d, x: h.x });
    bounce.advance(round, 4, steady);
  }
  assert.equal(round.phase, "crash", "squashed under it");
  assert.equal(eventsOf(round, "lose")[0].cause, "squash");
  assert.ok(round.drops.some((b) => b.d === h.d && Math.abs(b.x - h.x) < 1e-9), "and there it lies");
});

/* -------------------------------------------------------- scoring */

test("Bounce Road: stunts in quick succession step the combo, every COMBO_STEP of them multiplies the points one more up to MAX_COMBO, and it runs out after STREAK_MS or with a life lost", () => {
  const round = bounceRound();
  assert.equal(bounce.comboOf(0), 1);
  const got = [];
  for (let k = 0; k < 16; k++) got.push(bounce.stunt(round, 10));
  assert.deepEqual(got.slice(0, 4), [10, 10, 10, 20], "the fourth in a row is doubled");
  assert.equal(Math.max(...got), 10 * bounce.MAX_COMBO, "never past MAX_COMBO");
  assert.equal(round.bestCombo, bounce.MAX_COMBO);
  bounce.advance(round, bounce.STREAK_MS + 40, steady);
  assert.equal(round.streak, 0, "it runs out");
  for (let k = 0; k < 5; k++) bounce.stunt(round, 10);
  bounce.lose(round, "crash");
  assert.equal(round.streak, 0, "a life lost ends it");
});

test("Bounce Road: passing a rival with a hair between you scores a close shave once, and never after touching it", () => {
  const pass = (gap, touch = false) => {
    const round = bounceRound();
    const you = round.cars[0];
    const at = plainSpot(round.road, 100, 60);
    const zig = bounceRival(round, "zigzag", at.x, at.d + 12, { v: 20, tv: 20, mode: "" });
    const x = at.x - (you.w + zig.w) / 2 - gap;
    Object.assign(you, { x, d: at.d, v: 50 });
    if (touch) zig.nearDone = true;
    round.far = 1e9;
    for (let ms = 0; ms < 1500; ms += 4) {
      Object.assign(you, { x, v: 50, kx: 0, vx: 0 });
      Object.assign(zig, { x: at.x, v: 20, tv: 20, tx: at.x, lane: at.x, kx: 0 });
      bounce.advance(round, 4, steady);
    }
    return round.stats.near;
  };
  assert.equal(pass(0.8), 1, "a close shave");
  assert.equal(pass(5), 0, "not close");
  assert.equal(pass(0.8, true), 0, "not after a touch");
});

test("Bounce Road: stars over a hole are taken in the air and score, times the combo", () => {
  const round = bounceRound(1);
  const road = round.road;
  bounce.ensureRoad(road, 20000);
  const s = road.stars.find((x) => road.holes.some((h) => x.d > h.d0 && x.d < h.d1));
  assert.ok(s, "a star over a hole");
  const you = round.cars[0];
  while (road.stageAt[round.stage] <= s.d) round.stage++;
  Object.assign(you, { x: s.x, d: s.d - 0.5, v: 40, air: 300, airMax: 600 });
  round.far = 1e9;
  round.streak = bounce.COMBO_STEP;
  round.streakMs = bounce.STREAK_MS;
  bounce.advance(round, 8, steady);
  assert.ok(s.taken, "taken in the air");
  assert.ok(round.stats.stars >= 1);
  assert.equal(eventsOf(round, "star")[0].points, bounce.STAR_POINTS * 2);
});

test("Bounce Road: crossing a stage line scores STAGE_POINTS times the stage, a time bonus under par and, with no life lost, a flawless bonus and a life back up to MAX_LIVES", () => {
  const round = bounceRound();
  const you = round.cars[0];
  const cross = (n) => {
    you.d = round.road.stageAt[n] - 0.5;
    const i = Math.floor(you.d / bounce.ROW);
    you.x = (round.road.L[i] + round.road.R[i]) / 2;
    round.far = 1e9;
    round.events.length = 0;
    bounce.advance(round, 40, steady);
    return eventsOf(round, "stage")[0];
  };
  round.lives = 2;
  const one = cross(1);
  assert.equal(one.bonus, Math.round((bounce.stageFor(1).par - one.secs) * bounce.TIME_POINTS));
  assert.equal(one.points, bounce.STAGE_POINTS + one.bonus + bounce.FLAWLESS_POINTS);
  assert.equal(round.stage, 2);
  assert.equal(round.lives, 3, "flawless: a life back");
  round.stageLost = true;
  round.stageClock = round.clock - 1e6;
  const two = cross(2);
  assert.equal(two.bonus, 0, "slow: no time bonus");
  assert.equal(two.points, bounce.STAGE_POINTS * 2);
  assert.equal(round.lives, 3, "a life lost on the way: none back");
  round.lives = bounce.MAX_LIVES;
  cross(3);
  assert.equal(round.lives, bounce.MAX_LIVES, "never past MAX_LIVES");
});

test("Bounce Road: power-ups lie on the road from Hose Creek and driving over one takes it; a Nitro passes the top speed, and Mega wheels make you bigger and flatten a rival you touch", () => {
  const road = bounce.newRoad(9);
  while (road.built < 4) bounce.buildStage(road, road.built + 1);
  assert.ok(road.items.length >= 3, `power-ups on the road (${road.items.length})`);
  assert.ok(road.items.every((it) => it.d >= road.stageAt[1]), "none on Chalk Lane");
  assert.ok(road.items.every((it) => bounce.groundAt(road, it.x, it.d) === bounce.GROUND.road), "all on the road");
  const round = bounceRound(9);
  const you = round.cars[0];
  bounce.ensureRoad(round.road, 6000);
  const it = round.road.items[0];
  Object.assign(you, { x: it.x, d: it.d - 1 });
  round.far = 1e9;
  round.stage = 2;
  bounce.advance(round, 4, steady);
  assert.ok(it.taken, "taken");
  assert.equal(eventsOf(round, "power").length, 1);
  bounce.applyPower(round, "nitro");
  round.input.up = true;
  you.v = bounce.TOP_SPEED;
  for (let ms = 0; ms < 1500; ms += 4) {
    bounce.move(round, you, 4);
    you.d = it.d;
  }
  assert.ok(you.v > bounce.TOP_SPEED * 1.15, `a Nitro passes the top speed (${you.v.toFixed(1)})`);
  const r2 = bounceRound();
  const y2 = r2.cars[0];
  bounce.applyPower(r2, "mega");
  assert.ok(y2.w > bounce.CAR_W * 1.2 && y2.l > bounce.CAR_L * 1.2, "bigger");
  const at = plainSpot(r2.road, 60, 30);
  Object.assign(y2, { x: at.x, d: at.d });
  const zig = bounceRival(r2, "zigzag", at.x + 4, at.d + 1);
  assert.equal(bounce.collide(r2, y2, zig), "mega");
  assert.equal(zig.outKind, "flat", "flattened by a touch");
  for (let ms = 0; ms < bounce.MEGA_MS + 40; ms += 4) bounce.move(r2, y2, 4);
  assert.equal(y2.w, bounce.CAR_W, "back to size");
});

test("Bounce Road: a banner's strip counts a rival, a train on its way, a ball and a thing still falling, and nothing else", () => {
  const round = bounceRound(3);
  const you = round.cars[0];
  const cam = you.d - bounce.BEHIND;
  const y = bounce.BANNER_Y;
  const dAt = cam + bounce.FIELD_H - y;
  round.road.hazards.length = 0;
  assert.equal(bounce.underBanner(round, y, cam), false, "an empty strip");
  const zig = bounceRival(round, "zigzag", 30, dAt);
  assert.equal(bounce.underBanner(round, y, cam), true, "a rival in it");
  zig.d = dAt + 60;
  assert.equal(bounce.underBanner(round, y, cam), false, "a rival out of it");
  round.road.hazards.push({ kind: "ball", d: dAt, c: 30, amp: 10, r: 3, period: 3000, phase: 0 });
  assert.equal(bounce.underBanner(round, y, cam), true, "a ball");
  round.road.hazards[0] = { kind: "drop", d: dAt, at: round.clock + 500, landed: false, x: 30, w: 5, l: 5 };
  assert.equal(bounce.underBanner(round, y, cam), true, "a thing falling");
  round.road.hazards[0].landed = true;
  assert.equal(bounce.underBanner(round, y, cam), false, "landed, it is a block like any other");
});

/* ------------------------------------------------------- the look */

test("Bounce Road: a rival color too near your highlight gives way to a spare, so no highlight leaves a rival beside you, and every rival color stands out from every road", () => {
  assert.deepEqual(bounce.rivalColors("#206cc3"), [...bounce.RIVAL_COLORS]);
  assert.deepEqual(bounce.rivalColors("not a color"), [...bounce.RIVAL_COLORS]);
  assert.equal(bounce.RIVAL_COLORS.length, bounce.RIVAL_KINDS.length, "a color per kind");
  const rgb = (h) => [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16));
  const roads = Object.values(LOOKS).map((l) => l.road);
  for (const [id, accent] of Object.entries(ACCENTS)) {
    for (const you of [accent.light[0], accent.dark[0]]) {
      const colors = bounce.rivalColors(you);
      assert.equal(new Set(colors).size, colors.length, `${id}: no two rivals alike`);
      for (const c of colors) {
        const [a, b] = [rgb(c), rgb(you)];
        assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) >= bounce.NEAR_COLOR, `${id} ${you} beside ${c}`);
        for (const road of roads) assert.ok(contrast(c, road) >= 1.8, `${id}: a ${c} rival on a ${road} road (${contrast(c, road).toFixed(2)})`);
      }
    }
  }
});

test("Bounce Road: every rival kind is drawn as one of the car art's styles, no two alike, and Planny as his own", () => {
  for (const kind of bounce.RIVAL_KINDS) assert.ok(CAR_STYLES[bounce.RIVALS[kind].style], `${kind} drawn as ${bounce.RIVALS[kind].style}`);
  assert.ok(CAR_STYLES.planny);
  assert.equal(new Set(bounce.RIVAL_KINDS.map((k) => bounce.RIVALS[k].style)).size, bounce.RIVAL_KINDS.length, "no two kinds look alike");
});

test("Bounce Road: the pills never overlap, leave the board or spill out of their strip, even on the smallest board with every pill wanted; every word stays on the field; edges stand out on every road and bridge, and on your car", () => {
  const box = (p, h) => [p.x, p.y, p.x + p.w, p.y + h];
  for (const h of [Math.max(12 / bounce.MIN_CELL, 2.4), 2.4]) {
    for (const chain of [0, bounce.MAX_CHAIN]) {
      for (const effects of [[], ["SPRING", "BUBBLE", "NITRO", "MEGA"]]) {
        for (const combo of [null, { mult: bounce.MAX_COMBO, fill: 0.5 }]) {
          const hud = { stage: "STAGE 18", effects: effects.map((text) => ({ text, color: "#ffffff", fill: 0.5 })), chain, combo };
          const pills = hudLayout(h, bounce.W, bounce.MAX_LIVES, hud, bounce.HUD_H).map((p) => box(p, p.h));
          for (const [x0, y0, x1, y1] of pills) {
            assert.ok(x0 >= 0 && x1 <= bounce.W, `on the board (h ${h})`);
            assert.ok(y0 >= 0 && y1 <= bounce.HUD_H, `in the strip (h ${h}, ${y0}..${y1})`);
          }
          for (let i = 0; i < pills.length; i++) {
            for (let j = i + 1; j < pills.length; j++) {
              const [p, q] = [pills[i], pills[j]];
              assert.ok(p[2] <= q[0] || q[2] <= p[0] || p[3] <= q[1] || q[3] <= p[1], `pills ${i} and ${j} apart (h ${h})`);
            }
          }
        }
      }
    }
  }
  for (const text of ["Bumped off! +60", "+800 chain x8", "It's crumbling! Floor it!", "A line much too long to fit across the field at all, however small"]) {
    for (let x = -10; x <= bounce.FIELD_W + 10; x += 13) {
      for (let y = -10; y <= bounce.FIELD_H + 10; y += 11) {
        const at = labelSpot(text, x, y, 2.8, bounce.FIELD_W, bounce.FIELD_H);
        assert.ok(at.x - at.max / 2 >= 0 && at.x + at.max / 2 <= bounce.FIELD_W);
        assert.ok(at.y - 1.4 >= 0 && at.y + 1.4 <= bounce.FIELD_H);
      }
    }
  }
  for (const [look, t] of Object.entries(LOOKS)) {
    const ink = limbInk(look);
    for (const tone of [t.road, t.plank]) assert.ok(contrast(ink, tone) >= 3, `${look}: ${ink} on ${tone} (${contrast(ink, tone).toFixed(2)})`);
    assert.ok(contrast(t.road, t.ground) >= 1.4, `${look}: the road stands out from the yard (${contrast(t.road, t.ground).toFixed(2)})`);
  }
  for (const [id, accent] of Object.entries(ACCENTS)) {
    for (const you of [accent.light[0], accent.dark[0]]) assert.ok(contrast(inkOn(you), you) >= 2.5, `${id}: ink on a ${you} car`);
  }
});

/* ------------------------------------------------- fair play near danger */

test("Bounce Road: the Bruiser and the Cop never shove you on a bridge or by the water, but do on plain road", () => {
  const round = bounceRound(2);
  const road = round.road;
  bounce.ensureRoad(road, 20000);
  const river = road.rivers[0];
  while (road.stageAt[round.stage] <= river.d0) round.stage++;
  const you = round.cars[0];
  const onBridge = river.d0 + 12;
  const i = bounce.rowOf(onBridge);
  const mid = (road.L[i] + road.R[i]) / 2;
  Object.assign(you, { d: onBridge, x: mid, v: 45 });
  assert.ok(bounce.nearWater(road, you.d, you.l), "you are on the bridge");
  const bruiser = bounceRival(round, "bruiser", mid + 5, onBridge + 2, { v: 45, mode: "" });
  bounce.think(round, bruiser, 4, steady);
  assert.ok(Math.abs(bruiser.tx - you.x) > 3, `the Bruiser holds off on the bridge (${bruiser.tx.toFixed(1)} against ${you.x.toFixed(1)})`);
  const cop = bounceRival(round, "cop", mid - 5, onBridge - 1, { v: 45, mode: "chase", chaseMs: 0, modeMs: 1e9, offside: -1 });
  bounce.think(round, cop, 4, steady);
  assert.ok(Math.abs(cop.tx - you.x) >= (you.w + cop.w) / 2, `the Cop sits beside you there, never into you (${cop.tx.toFixed(1)})`);
  const r2 = bounceRound(2);
  const at = plainSpot(r2.road, 200, 60);
  const y2 = r2.cars[0];
  Object.assign(y2, { d: at.d, x: at.x, v: 45 });
  assert.ok(!bounce.nearWater(r2.road, y2.d, y2.l + 4));
  const b2 = bounceRival(r2, "bruiser", at.x + 5, at.d + 2, { v: 45, mode: "" });
  bounce.think(r2, b2, 4, steady);
  assert.ok(Math.abs(b2.tx - y2.x) < 1e-6, "on plain road the Bruiser comes for you");
});

test("Bounce Road: a Brick brake-checks at most once every BRAKE_REST_MS or so, however sharp it is", () => {
  const round = bounceRound();
  round.stage = 10;
  const you = round.cars[0];
  const at = plainSpot(round.road, 60, 40);
  Object.assign(you, { x: at.x, d: at.d, v: 50 });
  const brick = bounceRival(round, "brick", at.x, at.d + 13, { v: 50, mode: "" });
  const times = [];
  for (let ms = 0; ms < 6000; ms += 4) {
    round.events.length = 0;
    bounce.think(round, brick, 4, () => 0);
    if (eventsOf(round, "brake").length) times.push(ms);
    brick.d = at.d + 13;
  }
  assert.ok(times.length >= 2 && times.length <= 3, `brake checks in 6 s: ${times.length}`);
  for (let k = 1; k < times.length; k++) assert.ok(times[k] - times[k - 1] >= bounce.BRAKE_REST_MS, `apart (${times[k] - times[k - 1]} ms)`);
});

test("Bounce Road: the brake beats a boost strip, so a strip before a train or a drawbridge never forces you on", () => {
  const round = bounceRound(2);
  const pad = onto(round, "pads", (p) => p.kind === "boost", 0);
  const you = round.cars[0];
  Object.assign(you, { x: pad.x, d: pad.d, v: bounce.TOP_SPEED });
  round.input.down = true;
  for (let ms = 0; ms < 400; ms += 4) bounce.move(round, you, 4);
  you.d = pad.d;
  bounce.advance(round, 4, steady);
  for (let ms = 0; ms < 400; ms += 4) bounce.move(round, you, 4);
  assert.equal(you.boostMs, 0, "braking cuts the boost");
  assert.ok(you.v < bounce.TOP_SPEED * 0.6, `and slows you (${you.v.toFixed(1)})`);
});

test("Bounce Road: a stunned Monster's back is never a wall, so running into it right after a stomp is safe", () => {
  const round = bounceRound(4);
  round.stage = 10;
  bounce.ensureRoad(round.road, 30000);
  const at = plainSpot(round.road, round.road.stageAt[9] + 300, 30);
  const you = round.cars[0];
  Object.assign(you, { x: at.x, d: at.d, v: 60 });
  const m = bounceRival(round, "monster", at.x, at.d + 9.5, { v: 20, hp: 3, stunMs: 800 });
  bounce.collide(round, you, m);
  assert.equal(round.phase, "drive", "no crash");
  assert.ok(you.v < 60, "you just bump it");
});
