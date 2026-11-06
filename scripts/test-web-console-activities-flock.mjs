// Web console tests, Flock Dash: the round, the leader, the path and the followers, strays joining, the stages and their hazards, snaps, lives, the portal, banners, the memo, power-ups, the combo, the score and the game contract.
// Run with: node --test scripts/test-web-console-activities-flock.mjs
//
// No browser and no server: the game draws only through the canvas it is
// handed, so a stub canvas stands in for the page, as in
// scripts/test-web-console-activities-rapids.mjs, whose helpers this file copies.

import "./seed-random.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import * as flock from "../src/web-console/public/activities/flock.js";
import { hudLayout, SKIES, SUCCESS } from "../src/web-console/public/activities/flock-draw.js";
import { LIVES, livesText, PILL, PILL_CONTRAST, pillContrast, pillInk } from "../src/web-console/public/activities/pills.js";
import { toneNames, humNames } from "../src/web-console/public/tones.js";

const { advance, collect, newRound, placeFlock, recordPath, screenX, spawnStrays, steer, BAND_MAX, BAND_MIN, BASE_SPEED, CLIMB, EDGE, FIELD_H, FIELD_W, H, MIN_CELL, PICK_R, SPACING, START_LIVES, STRAY_AHEAD_MAX, STRAY_AHEAD_MIN, STRAY_BEHIND, STRAY_GAP_MAX, STRAY_GAP_MIN, STRAY_POINTS, W } = flock;
const game = flock.default;

// A 2D context whose every method is a no-op that counts itself.
function stubCanvas() {
  const calls = { count: 0, stops: 0 };
  const gradient = { addColorStop: () => { calls.stops += 1; } };
  const ctx = new Proxy({ createLinearGradient: () => gradient }, {
    get: (target, name) => (name in target ? target[name] : () => { calls.count += 1; }),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, style: {}, getContext: () => ctx }, calls };
}

// A round whose only strays and hazards are the ones a test places: none will
// spawn near.
const clearSky = (seed = 1) => {
  const round = newRound(seed);
  round.nextStray = 1e9;
  round.hazards = [];
  round.crates = [];
  round.portal.x = Infinity;
  return round;
};

test("newRound starts on stage 1 with three lives, an empty flock and no held input", () => {
  const round = newRound(7);
  assert.equal(round.stage, 1);
  assert.equal(round.lives, START_LIVES);
  assert.equal(START_LIVES, 3);
  assert.equal(round.speed, BASE_SPEED);
  assert.equal(round.scroll, 0);
  assert.deepEqual(round.flock, []);
  assert.deepEqual(round.path, []);
  assert.deepEqual(round.input, { up: false, down: false, left: false, right: false });
  assert.equal(round.infinite, false);
  assert.equal(round.over, false);
});

test("a seed always deals the same strays", () => {
  const a = newRound(42);
  const b = newRound(42);
  advance(a, 2000);
  advance(b, 2000);
  assert.deepEqual(a.strays.map((s) => [s.x, s.y]), b.strays.map((s) => [s.x, s.y]));
});

test("held up moves the leader up and it stops at the edge; held down the same at the bottom", () => {
  const round = clearSky();
  const start = round.leader.y;
  round.input.up = true;
  advance(round, 200);
  assert.ok(round.leader.y < start, "it climbs");
  advance(round, 5000);
  assert.equal(round.leader.y, EDGE);
  round.input.up = false;
  round.input.down = true;
  advance(round, 5000);
  assert.equal(round.leader.y, FIELD_H - EDGE);
});

test("left and right stay inside the band, and the world x follows the scroll", () => {
  const round = clearSky();
  round.input.right = true;
  advance(round, 5000);
  assert.equal(round.leader.sx, BAND_MAX);
  assert.equal(round.leader.x, round.scroll + BAND_MAX);
  round.input.right = false;
  round.input.left = true;
  advance(round, 5000);
  assert.equal(round.leader.sx, BAND_MIN);
  assert.equal(screenX(round, round.leader.x), BAND_MIN);
});

test("steer eases the climb in: a first small slice is short of full speed", () => {
  const round = clearSky();
  round.input.up = true;
  steer(round, 4);
  assert.ok(round.leader.vy < 0 && round.leader.vy > -CLIMB, `vy ${round.leader.vy}`);
});

test("placeFlock puts every follower its spacing behind the leader along a curved path", () => {
  const round = clearSky();
  for (let k = 1; k <= 8; k++) round.flock.push({ id: k });
  // Fly a sine path, one that bends both ways.
  for (let ms = 0; ms < 6000; ms += 4) {
    round.input.up = Math.sin(ms / 400) > 0;
    round.input.down = !round.input.up;
    advance(round, 4);
  }
  const { path, flock: birds } = round;
  const end = path[path.length - 1].s;
  birds.forEach((bird, i) => {
    const want = end - (i + 1) * SPACING;
    let best = Infinity;
    let along = 0;
    for (let k = 1; k < path.length; k++) {
      const [a, b] = [path[k - 1], path[k]];
      const len = b.s - a.s;
      const t = Math.max(0, Math.min(1, ((bird.x - a.x) * (b.x - a.x) + (bird.y - a.y) * (b.y - a.y)) / (len * len)));
      const d = Math.hypot(a.x + (b.x - a.x) * t - bird.x, a.y + (b.y - a.y) * t - bird.y);
      if (d < best) [best, along] = [d, a.s + len * t];
    }
    assert.ok(best < 1e-6, `follower ${i + 1} sits on the path (off by ${best})`);
    assert.ok(Math.abs(along - want) < 1e-6, `follower ${i + 1} is ${(end - along).toFixed(3)} behind, wanted ${(end - want).toFixed(3)}`);
  });
});

test("a follower whose place falls before the path's start sits on the first point", () => {
  const round = clearSky();
  round.flock.push({ id: 1 });
  round.leader.x = round.scroll + round.leader.sx;
  recordPath(round);
  placeFlock(round);
  assert.deepEqual([round.flock[0].x, round.flock[0].y], [round.path[0].x, round.path[0].y]);
});

test("recordPath skips a point too close to the last, and trims what the flock cannot reach", () => {
  const round = clearSky();
  recordPath(round);
  recordPath(round);
  assert.equal(round.path.length, 1, "a leader that has not moved adds nothing");
  advance(round, 30_000);
  const span = round.path[round.path.length - 1].s - round.path[0].s;
  assert.ok(span <= 2 * SPACING + 4 + 1, `the path spans ${span} with no flock`);
});

test("a stray inside the pick radius is collected: the flock grows by one and the score by its points", () => {
  const round = clearSky();
  const { leader } = round;
  const near = { id: 900, x: leader.x + 5, y: leader.y, bob: 0 };
  const far = { id: 901, x: leader.x + 5, y: leader.y + PICK_R + 12, bob: 0 };
  round.strays.push(near, far);
  advance(round, 300);
  assert.deepEqual(round.flock.map((b) => b.id), [900]);
  assert.equal(round.score, STRAY_POINTS);
  assert.ok(!round.strays.includes(near));
  assert.ok(round.strays.includes(far), "one out of reach stays loose");
  assert.equal(typeof round.flock[0].x, "number", "the new bird has its place at once");
});

test("collect also takes a bird from the scattered list, and returns the flock's length", () => {
  const round = clearSky();
  const bird = { id: 5, x: 0, y: 0, until: 1 };
  round.scattered.push(bird);
  assert.equal(collect(round, bird), 1);
  assert.deepEqual(round.scattered, []);
});

test("spawnStrays places strays ahead of the right edge, inside the edges, at the stage's gap", () => {
  const round = newRound(3);
  spawnStrays(round, round.random);
  assert.ok(round.strays.length > 1, "more than one comes");
  const right = round.scroll + FIELD_W;
  round.strays.forEach((s, i) => {
    assert.ok(s.x >= right + STRAY_AHEAD_MIN && s.x <= right + STRAY_AHEAD_MAX, `x ${s.x}`);
    assert.ok(s.y >= EDGE && s.y <= FIELD_H - EDGE, `y ${s.y}`);
    if (i) {
      const gap = s.x - round.strays[i - 1].x;
      assert.ok(gap >= STRAY_GAP_MIN && gap <= STRAY_GAP_MAX, `gap ${gap}`);
    }
  });
});

test("strays left behind are dropped, so a long flight keeps the list short", () => {
  const round = newRound(9);
  round.hazards = [];
  advance(round, 60_000);
  assert.ok(round.strays.length < 16, `${round.strays.length} strays`);
  assert.ok(round.strays.every((s) => s.x - round.scroll >= -STRAY_BEHIND));
});

test("contract: action starts, pause stops the tick moving anything, resume plays on", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  assert.equal(game.id, "flock");
  assert.equal(game.title, "Flock Dash");
  assert.equal(g.state, "ready");
  assert.equal(g.key("up"), true, "a used name answers true before a round too");
  assert.equal(g.key("action"), true);
  assert.equal(g.state, "running");
  g.tick(100);
  const scroll = g.round.scroll;
  assert.ok(scroll > 0);
  g.pause();
  assert.equal(g.state, "paused");
  g.tick(1000);
  assert.equal(g.round.scroll, scroll, "a paused sky holds still");
  g.resume();
  assert.equal(g.state, "running");
  g.tick(100);
  assert.ok(g.round.scroll > scroll);
});

test("contract: held keys act until let go, a pause lets go of them, and an unknown key is not used", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  g.start();
  assert.equal(g.key("up"), true);
  assert.equal(g.round.input.up, true);
  g.release("up");
  assert.equal(g.round.input.up, false);
  g.key("down");
  g.pause();
  assert.equal(g.round.input.down, false);
  g.resume();
  assert.equal(g.key("jump"), false);
});

test("contract: resize refuses a tiny box and sets the canvas's size", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  assert.equal(g.resize(W * MIN_CELL - 1, H * MIN_CELL), false);
  assert.equal(g.resize(W * 8, H * 8), true);
  assert.equal(canvas.style.width, `${W * 8}px`);
  assert.equal(canvas.style.height, `${H * 8}px`);
});

test("contract: cheat marks the round, and a new round starts without it", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  g.start();
  g.cheat(true);
  assert.equal(g.round.infinite, true);
  g.start();
  assert.equal(g.round.infinite, false);
});

test("drawing: the leader and every follower in the flock are drawn on a frame", () => {
  const drawn = { followers: 0, leaders: 0 };
  const ctx = new Proxy({}, {
    get: (target, name) => {
      if (name === "ellipse") return (x, y, rx) => { if (rx === 1.4) drawn.followers += 1; };
      if (name === "rotate") return () => { drawn.leaders += 1; };
      return name in target ? target[name] : () => {};
    },
    set: (target, name, value) => { target[name] = value; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, style: {}, getContext: () => ctx } });
  g.resize(W * 8, H * 8);
  g.start();
  g.round.nextStray = 1e9;
  g.round.strays = [];
  g.tick(100);
  g.round.flock.push({ id: 1 }, { id: 2 }, { id: 3 });
  g.tick(100);
  drawn.followers = 0;
  drawn.leaders = 0;
  g.tick(16);
  assert.equal(drawn.leaders, 1, "the leader");
  assert.equal(drawn.followers, 3, "one body for each of three followers");
});

test("the pills read the stage, the lives, the score and the flock, in that order, and the lives pill shows endless lives", () => {
  const hud = { stage: "Stage 1", score: 120, flock: 7, min: 6 };
  const pills = hudLayout(2.4, W, 3, hud, flock.HUD_H);
  assert.deepEqual(pills.map((p) => p.text), ["Stage 1", livesText(3), "Score 120", "Flock 7 / 6"]);
  assert.equal(pills[1].color, LIVES);
  assert.equal(hudLayout(2.4, W, Infinity, hud, flock.HUD_H)[1].text, livesText(Infinity));
});

/* ------------------------------------------- hazards, snaps, lives and grace */

// A level flock of `n` birds on a clear sky, the leader at its starting height.
const levelFlock = (n, seed = 1) => {
  const round = clearSky(seed);
  // The path is trimmed to the flock's length, so the flock flies it from the start.
  for (let k = 1; k <= n; k++) round.flock.push({ id: k });
  advance(round, 3000);
  return round;
};

const balloonAt = (x, y, r = 1) => ({ kind: "balloon", x, y, w: r * 2, h: r * 2, r, vx: 0, vy: 0 });

test("buildStage gives the same list twice for a seed and stage, and another for another seed", () => {
  for (let n = 1; n <= flock.MAX_STAGE; n++) {
    assert.deepEqual(flock.buildStage(5, n), flock.buildStage(5, n), `stage ${n}`);
    assert.notDeepEqual(flock.buildStage(5, n).hazards, flock.buildStage(6, n).hazards, `stage ${n}`);
  }
});

test("no stage leaves the flock without a clear gap at any distance", () => {
  for (const seed of [1, 2, 3, 42, 777]) {
    for (let n = 1; n <= flock.MAX_STAGE; n++) {
      const { hazards, length } = flock.buildStage(seed, n);
      for (let x = 0; x < length; x += 0.5) {
        const gap = flock.clearGap(hazards, x);
        assert.ok(gap >= flock.GAP_MIN, `seed ${seed} stage ${n} at ${x}: a gap of ${gap}`);
      }
    }
  }
});

test("a stage opens calm, holds a calm stretch at its halfway marker, and ends calm before the portal", () => {
  for (const seed of [1, 2, 3]) {
    for (let n = 1; n <= flock.MAX_STAGE; n++) {
      const { hazards, length } = flock.buildStage(seed, n);
      const mid = length / 2;
      for (const h of hazards) {
        const [from, to] = flock.spanOf(h);
        assert.ok(from >= flock.SAFE_START, `stage ${n}: ${h.kind} from ${from} is in the opening`);
        assert.ok(to <= length - flock.SAFE_END, `stage ${n}: ${h.kind} to ${to} is too near the portal`);
        assert.ok(to <= mid || from >= mid + flock.SAFE_START, `stage ${n}: ${h.kind} from ${from} to ${to} is in the calm stretch`);
      }
    }
  }
});

test("every hazard kind first appears at its from stage", () => {
  for (const seed of [1, 2, 3, 42]) {
    for (const [kind, spec] of Object.entries(flock.HAZARDS)) {
      for (let n = 1; n <= flock.MAX_STAGE; n++) {
        const found = flock.buildStage(seed, n).hazards.some((h) => h.kind === kind);
        if (n < spec.from) assert.equal(found, false, `${kind} before stage ${spec.from}, in stage ${n}`);
        if (n === spec.from) assert.equal(found, true, `${kind} missing from stage ${n}, seed ${seed}`);
      }
    }
  }
});

test("the stage table rises: faster each stage, with a bigger flock wanted, and stageFor clamps", () => {
  for (let n = 2; n <= flock.MAX_STAGE; n++) {
    assert.ok(flock.STAGES[n].speed > flock.STAGES[n - 1].speed, `stage ${n} speed`);
    assert.ok(flock.STAGES[n].min > flock.STAGES[n - 1].min, `stage ${n} min`);
  }
  assert.equal(flock.STAGES[1].speed, BASE_SPEED);
  assert.equal(flock.stageFor(0), flock.STAGES[1]);
  assert.equal(flock.stageFor(99), flock.STAGES[flock.MAX_STAGE]);
});

test("a balloon on follower 4 snaps the flock to three birds and scatters the rest", () => {
  const round = levelFlock(8);
  const fourth = round.flock[3];
  round.hazards.push(balloonAt(fourth.x, fourth.y));
  advance(round, 4);
  assert.deepEqual(round.flock.map((b) => b.id), [1, 2, 3]);
  assert.deepEqual(round.scattered.map((b) => b.id), [4, 5, 6, 7, 8]);
  assert.equal(round.snaps, 1);
  assert.equal(round.lives, START_LIVES, "a snap costs no life");
  assert.equal(round.banner.text, "Line broken!");
});

test("hazard hit shapes: a balloon's circle, a bunch's balloons, a kite's string and diamond", () => {
  const { BIRD_R, hazardHits } = flock;
  const balloon = balloonAt(50, 20, 3);
  assert.equal(hazardHits(balloon, 50, 23.5, BIRD_R), true);
  assert.equal(hazardHits(balloon, 50, 25, BIRD_R), false);
  const bunch = { kind: "cluster", x: 50, y: 20, parts: [{ dx: 2, dy: 0, r: 2 }] };
  assert.equal(hazardHits(bunch, 53, 20, BIRD_R), true);
  assert.equal(hazardHits(bunch, 47, 20, BIRD_R), false);
  const kite = { kind: "kite", x: 50, y: 30, tipX: 50, top: true };
  assert.equal(hazardHits(kite, 50, 10, BIRD_R), true, "the string, from the top edge");
  assert.equal(hazardHits(kite, 50, 30, BIRD_R), true, "the diamond");
  assert.equal(hazardHits(kite, 50, 40, BIRD_R), false, "below the kite");
});

test("a balloon drifts and bounces off the edges", () => {
  const round = clearSky();
  const balloon = { ...balloonAt(round.scroll + 40, 3, 2), vy: -6 };
  round.hazards.push(balloon);
  flock.moveHazards(round, 1);
  assert.equal(balloon.y, 2, "stopped at the edge");
  assert.equal(balloon.vy, 6, "and heading back");
});

test("a thunderhead warns, then strikes down the warned column, and only the strike hits", () => {
  const round = clearSky();
  const storm = flock.buildStage(1, 5).hazards.find((h) => h.kind === "storm");
  const cloud = { ...storm, x: round.scroll + 50, timer: 100, phase: "idle" };
  round.hazards.push(cloud);
  flock.moveHazards(round, 0.2);
  assert.equal(cloud.phase, "warn");
  const y = cloud.top ? cloud.y + 5 : cloud.y - 5;
  assert.equal(flock.hazardHits(cloud, cloud.col, y, flock.BIRD_R), false, "a warning never hits");
  flock.moveHazards(round, flock.STORM_WARN_MS / 1000);
  assert.equal(cloud.phase, "strike");
  assert.equal(flock.hazardHits(cloud, cloud.col, y, flock.BIRD_R), true);
  const far = cloud.top ? cloud.y + flock.STORM_REACH + 5 : cloud.y - flock.STORM_REACH - 5;
  assert.equal(flock.hazardHits(cloud, cloud.col, far, flock.BIRD_R), false, "the far part of the field stays clear");
  flock.moveHazards(round, flock.STORM_STRIKE_MS / 1000);
  assert.equal(cloud.phase, "idle");
});

test("a thunderhead's column holds still on the board through its warning, so what flashes is where the bolt lands", () => {
  const round = clearSky();
  const storm = flock.buildStage(1, 5).hazards.find((h) => h.kind === "storm");
  const cloud = { ...storm, x: round.scroll + 40, col: 0, timer: 8, phase: "idle" };
  round.hazards.push(cloud);
  advance(round, 16);
  assert.equal(cloud.phase, "warn");
  const warned = cloud.col - round.scroll;
  advance(round, flock.STORM_WARN_MS);
  assert.equal(cloud.phase, "strike");
  assert.ok(Math.abs(cloud.col - round.scroll - warned) < 0.5, `the column moved from ${warned} to ${cloud.col - round.scroll}`);
});

test("flown for real, every stage with thunderheads sends lightning through the leader's band", () => {
  for (let n = flock.HAZARDS.storm.from; n <= flock.MAX_STAGE; n++) {
    const round = clearSky(7);
    round.stage = n;
    round.speed = flock.STAGES[n].speed;
    round.leader.grace = 1e9;
    round.hazards = flock.buildStage(7, n).hazards.filter((h) => h.kind === "storm");
    assert.ok(round.hazards.length > 0, `stage ${n} has clouds`);
    let strikes = 0;
    for (let t = 0; t < 40_000; t += 16) {
      advance(round, 16);
      const inBand = (h) => h.phase === "strike" && h.col - round.scroll >= BAND_MIN && h.col - round.scroll <= BAND_MAX;
      if (round.hazards.some(inBand)) strikes += 1;
    }
    assert.ok(strikes > 0, `stage ${n}: no strike reached the band`);
  }
});

test("a thunderhead's strike can take a life, and leaves height to dodge it", () => {
  const round = clearSky();
  const storm = flock.buildStage(1, 5).hazards.find((h) => h.kind === "storm");
  const cloud = { ...storm, x: round.leader.x, col: round.leader.x, phase: "strike", timer: 1000 };
  const [lo, hi] = flock.strikeBand(cloud);
  round.leader.y = (lo + hi) / 2;
  round.hazards.push(cloud);
  advance(round, 16);
  assert.equal(round.lives, START_LIVES - 1);
  assert.ok(lo > EDGE + flock.GAP_MIN || hi < FIELD_H - EDGE - flock.GAP_MIN, "a clear height is left");
});

test("a scattered bird can be gathered before SCATTER_MS and is gone after", () => {
  const round = levelFlock(2);
  flock.snapAt(round, 1);
  assert.equal(round.flock.length, 0);
  const [caught, late] = round.scattered;
  assert.equal(late.until, round.now + flock.SCATTER_MS);
  caught.x = round.leader.x;
  caught.y = round.leader.y;
  advance(round, 4);
  assert.deepEqual(round.flock.map((b) => b.id), [caught.id], "gathered while there is time");

  advance(round, flock.SCATTER_MS);
  late.x = round.leader.x;
  late.y = round.leader.y;
  advance(round, 4);
  assert.equal(round.flock.length, 1, "too late to gather");
  advance(round, 3000);
  assert.deepEqual(round.scattered, [], "flown off and dropped");
});

test("scattered birds keep up with the sky, slipping back slowly enough to be reached", () => {
  const round = levelFlock(3);
  flock.snapAt(round, 1);
  const bird = round.scattered[0];
  const before = bird.x - round.scroll;
  advance(round, 1000);
  const slip = before - (bird.x - round.scroll);
  assert.ok(slip > 0 && slip < flock.NUDGE, `it slipped back ${slip} units in a second`);
});

test("a gust warns, then shoves the leader and snaps the flock, and never costs a life", () => {
  const round = levelFlock(4);
  const { leader } = round;
  leader.sx = 30;
  round.hazards.push({ kind: "gust", x: round.scroll + FIELD_W, y: leader.y, w: flock.GUST_W, h: 8, vx: 0, vy: 0, live: false });
  const gust = round.hazards[0];
  advance(round, flock.GUST_WARN_MS - 20);
  assert.equal(gust.live, false, "still a warning");
  assert.equal(gust.x, round.scroll + FIELD_W, "the warning sits at the right edge");
  assert.equal(leader.sx, 30);
  assert.equal(round.flock.length, 4);
  advance(round, 2500);
  assert.equal(gust.live, true);
  assert.ok(leader.sx < 30, `shoved back to ${leader.sx}`);
  assert.equal(round.flock.length, 0, "the live band snapped the line");
  assert.equal(round.lives, START_LIVES, "no life lost");
  assert.equal(leader.alive, true);
});

test("a whole flock inside a slipstream never snaps, and the leader in it speeds the sky", () => {
  const round = levelFlock(6);
  const { leader } = round;
  round.hazards.push({ kind: "stream", x: round.scroll - 50, y: leader.y, w: 2000, h: 12, vx: 0, vy: 0 });
  const from = round.scroll;
  advance(round, 2000);
  assert.ok(Math.abs(round.scroll - from - 2 * (round.speed + flock.STREAM_BOOST)) < 0.01, "the boost");
  assert.equal(round.flock.length, 6);
  assert.equal(round.snaps, 0);
});

test("a whole flock outside a slipstream never snaps, nor does a line flying through one", () => {
  const round = levelFlock(6);
  const { leader } = round;
  round.hazards.push({ kind: "stream", x: round.scroll, y: leader.y + 15, w: 2000, h: 8, vx: 0, vy: 0 });
  advance(round, 1000);
  assert.equal(round.snaps, 0, "all outside");
  assert.ok(Math.abs(round.scroll - round.speed - 3000 / 1000 * round.speed) < 0.01, "no boost outside it");
  round.hazards = [{ kind: "stream", x: leader.x + 10, y: leader.y, w: 40, h: 8, vx: 0, vy: 0 }];
  advance(round, 4000);
  assert.equal(round.snaps, 0, "flowing in and out in a smooth line");
  assert.equal(round.flock.length, 6);
});

test("a line straddling a slipstream's end never snaps, even holding still across it", () => {
  const round = levelFlock(6);
  round.speed = 0;
  const { flock: birds, leader } = round;
  // The lane ends between followers 3 and 4.
  const edge = (birds[2].x + birds[3].x) / 2;
  round.hazards.push({ kind: "stream", x: edge - 100, y: leader.y, w: 100, h: 8, vx: 0, vy: 0 });
  advance(round, 1000);
  assert.equal(round.flock.length, 6);
  assert.equal(round.snaps, 0);
});

test("a line slipping out over a slipstream's long edge snaps there at once", () => {
  const round = levelFlock(8);
  const { leader } = round;
  round.hazards.push({ kind: "stream", x: round.scroll - 60, y: leader.y, w: 400, h: 8, vx: 0, vy: 0 });
  advance(round, 500);
  assert.equal(round.snaps, 0, "riding inside");
  round.input.up = true;
  for (let t = 0; t < 1000 && !round.snaps; t += 4) advance(round, 4);
  assert.equal(round.snaps, 1, "climbing out the side");
  assert.ok(round.scattered.length > 0);
  assert.ok(round.flock.length < 8);
  assert.ok(Math.abs(round.leader.y - round.hazards[0].y) > round.hazards[0].h / 2, "the leader is outside the lane");
});

test("a line diving into a slipstream's side snaps too, and a leader flying alone never does", () => {
  const round = levelFlock(8);
  const { leader } = round;
  round.hazards.push({ kind: "stream", x: round.scroll - 60, y: leader.y + 8, w: 400, h: 8, vx: 0, vy: 0 });
  round.input.down = true;
  for (let t = 0; t < 1000 && !round.snaps; t += 4) advance(round, 4);
  assert.equal(round.snaps, 1);

  const alone = clearSky();
  alone.hazards.push({ kind: "stream", x: alone.scroll - 60, y: alone.leader.y + 8, w: 400, h: 8, vx: 0, vy: 0 });
  alone.input.down = true;
  advance(alone, 1000);
  assert.equal(alone.snaps, 0);
});

test("hitLeader takes one life and the flock, stops the flight, then gives grace", () => {
  const round = levelFlock(4);
  const { leader } = round;
  assert.equal(flock.hitLeader(round), true);
  assert.equal(round.lives, START_LIVES - 1);
  assert.equal(round.lost, 1);
  assert.equal(round.flock.length, 0);
  assert.equal(round.scattered.length, 4);
  assert.equal(leader.alive, false);
  assert.equal(flock.hitLeader(round), false, "no second hit during the crash");
  assert.equal(round.lives, START_LIVES - 1);
  const stopped = round.scroll;
  advance(round, flock.CRASH_MS - 20);
  assert.equal(round.scroll, stopped, "the sky waits");
  advance(round, 40);
  assert.equal(leader.alive, true);
  assert.equal(leader.grace > 0, true);
  assert.equal(flock.hitLeader(round), false, "nothing hits during grace");
  assert.equal(round.lives, START_LIVES - 1);
  advance(round, flock.GRACE_MS);
  assert.equal(leader.grace, 0);
  assert.equal(flock.hitLeader(round), true, "grace runs out");
});

test("birds lost in a crash are gone once the stretch restarts, even when the restart is close by", () => {
  const round = levelFlock(16);
  flock.hitLeader(round);
  assert.equal(round.scattered.length, 16);
  advance(round, flock.CRASH_MS);
  assert.equal(round.leader.alive, true);
  assert.deepEqual(round.scattered, []);
  advance(round, 500);
  assert.equal(round.flock.length, 0);
});

test("while endless, a hit takes no life, and at zero lives the round ends", () => {
  const endless = clearSky();
  endless.infinite = true;
  flock.hitLeader(endless);
  assert.equal(endless.lives, START_LIVES);
  assert.equal(endless.over, false);

  const round = clearSky();
  round.lives = 1;
  flock.hitLeader(round);
  assert.equal(round.lives, 0);
  assert.equal(round.over, true);
  assert.equal(advance(round, 100), "over");
});

test("a hazard on the leader costs a life through the running game", () => {
  const round = clearSky();
  advance(round, 200);
  round.hazards.push(balloonAt(round.leader.x + 1, round.leader.y, 2));
  advance(round, 20);
  assert.equal(round.lives, START_LIVES - 1);
});

test("a replay restarts at the last calm point passed and meets the same layout", () => {
  const round = newRound(11);
  round.nextStray = 1e9;
  const first = round.hazards.map((h) => [h.kind, h.x, h.y]);
  round.scroll = 100;
  flock.hitLeader(round);
  advance(round, flock.CRASH_MS);
  assert.ok(round.scroll < 1, `before halfway it goes back to the start, at ${round.scroll}`);
  assert.deepEqual(round.hazards.map((h) => [h.kind, h.x, h.y]), first, "the same sky again");

  const mid = round.length / 2;
  round.scroll = mid + 50;
  round.leader.grace = 0;
  flock.hitLeader(round);
  advance(round, flock.CRASH_MS);
  assert.ok(Math.abs(round.scroll - mid) < 1, `past halfway it goes back to the marker, at ${round.scroll}`);
  assert.ok(round.hazards.every((h) => h.x > mid), "nothing from before the marker");
  assert.ok(round.hazards.length > 0);
  assert.deepEqual(round.path, [], "a fresh path");
});

/* -------------------------------------------- the portal, banners, the memo */

// A flock of `n` a moment short of the portal, inside its ring.
const atPortal = (n) => {
  const round = levelFlock(n);
  round.portal.x = round.leader.x + 1;
  round.portal.y = round.leader.y;
  round.score = 0;
  // A snap on the record, so only the portal's own pay shows; the flawless tests clear it.
  round.snaps = 1;
  return round;
};

// The same, on the last stage: the small ring, swaying.
const atFinalPortal = (n) => {
  const round = atPortal(n);
  round.stage = flock.MAX_STAGE;
  round.portal.h = flock.PORTAL_H_FINAL;
  round.portal.min = 3;
  return round;
};

test("the portal with the minimum forms a V and pays flock x stage x V_POINTS, then the next stage begins", () => {
  const round = atPortal(6);
  round.portal.min = 6;
  advance(round, 200);
  assert.ok(round.portal.passed);
  assert.ok(round.portal.v, "the V is playing");
  assert.equal(round.score, 6 * 1 * flock.V_POINTS);
  assert.match(round.banner.text, /^V formation! \+120/);
  const drifting = { ...balloonAt(round.leader.x + 30, 8, 1), vy: 5 };
  round.hazards = [balloonAt(round.leader.x + 2, round.leader.y, 1), drifting];
  advance(round, 600);
  assert.equal(drifting.y, 8, "hazards hold still for a V");
  assert.equal(round.lives, START_LIVES, "and hit nothing");
  const [a, b] = round.flock;
  const slots = [-1, 1].map((side) => [round.leader.x - flock.V_GAP, round.leader.y + side * flock.V_GAP * 0.55]);
  assert.ok(Math.hypot(a.x - slots[0][0], a.y - slots[0][1]) < 0.01, "the first bird in its slot");
  assert.ok(Math.hypot(b.x - slots[1][0], b.y - slots[1][1]) < 0.01, "the second on the other arm");
  advance(round, flock.V_MS);
  assert.equal(round.stage, 2);
  assert.equal(round.flock.length, 6, "the flock is kept");
  assert.equal(round.speed, flock.STAGES[2].speed);
  assert.equal(round.portal.passed, false);
  assert.equal(round.portal.min, flock.STAGES[2].min);
  assert.equal(round.banner.text, "Stage 2: Head-winds");
});

test("the portal without the minimum pays nothing and still moves to the next stage, showing why, then the stage", () => {
  const round = atPortal(2);
  round.portal.min = 6;
  round.snaps = 3;
  advance(round, 200);
  assert.equal(round.stage, 2);
  assert.equal(round.score, 0);
  assert.equal(round.flock.length, 2);
  assert.equal(round.snaps, 0, "the stage's counts start again");
  assert.equal(round.banner.text, "Need 6 birds for the V");
  advance(round, 1200);
  assert.equal(round.banner.text, "Stage 2: Head-winds");
});

test("before the last stage, flying around the ring moves on with no V", () => {
  const round = atPortal(8);
  round.portal.min = 6;
  round.portal.y = FIELD_H / 2;
  round.portal.h = 4;
  round.leader.y = EDGE;
  advance(round, 200);
  assert.equal(round.stage, 2);
  assert.equal(round.score, 0);
  assert.equal(round.lives, START_LIVES);
});

test("missing the final portal costs a life and replays the stretch, even during grace, and never while endless", () => {
  const round = atFinalPortal(2);
  round.leader.y = EDGE;
  round.leader.grace = 5000;
  advance(round, 200);
  assert.equal(round.lives, START_LIVES - 1);
  assert.equal(round.won, false);
  assert.equal(round.portal.passed, false);
  assert.equal(round.banner.text, "Missed the portal!");
  advance(round, flock.CRASH_MS + 20);
  assert.equal(round.leader.alive, true);
  assert.ok(round.scroll < 10, `back to the start of the stretch, at ${round.scroll}`);

  const endless = atFinalPortal(0);
  endless.infinite = true;
  endless.leader.y = EDGE;
  advance(endless, 200);
  assert.equal(endless.lives, START_LIVES);
  assert.equal(endless.won, false);
});

test("the last portal sways on a sine and the others hold still", () => {
  const round = atFinalPortal(0);
  round.portal.x = Infinity;
  const seen = [];
  for (let k = 0; k < 12; k++) {
    advance(round, flock.FINAL_PERIOD_MS / 12);
    seen.push(round.portal.y);
  }
  const reach = Math.max(...seen) - Math.min(...seen);
  assert.ok(Math.abs(reach - flock.FINAL_SWAY * 2) < 1, `it sways ${reach}`);
  const still = clearSky();
  const { y } = still.portal;
  advance(still, 1000);
  assert.equal(still.portal.y, y);
});

test("passing the final portal wins: at once with a short flock, after the V with the minimum", () => {
  const short = atFinalPortal(1);
  short.portal.y = FIELD_H / 2;
  short.leader.y = FIELD_H / 2;
  advance(short, 100);
  assert.equal(short.won, true);
  assert.equal(short.over, true);
  assert.equal(short.score, 0);
  assert.equal(short.banner.text, "You made it!");

  const full = atFinalPortal(3);
  full.portal.y = FIELD_H / 2;
  full.leader.y = FIELD_H / 2;
  advance(full, 200);
  assert.equal(full.won, false, "the V plays first");
  assert.equal(full.score, 3 * flock.MAX_STAGE * flock.V_POINTS);
  advance(full, flock.V_MS);
  assert.equal(full.won, true);
  assert.equal(full.over, true);
  assert.equal(full.stage, flock.MAX_STAGE, "no ninth stage");
});

test("a banner is placed away from the leader, and underBanner sees what is in its strip", () => {
  const round = clearSky();
  const { bannerRow, underBanner, banner, BANNER_HALF } = flock;
  round.leader.y = 10;
  const low = bannerRow(round);
  assert.ok(low > FIELD_H / 2, "the leader high, the banner low");
  round.leader.y = 44;
  const high = bannerRow(round);
  assert.ok(high < FIELD_H / 2, "the leader low, the banner high");
  round.leader.y = FIELD_H - EDGE;
  const shown = banner(round, "Hello", "", "#fff");
  shown.row = high;
  assert.equal(underBanner(round, shown), false, "clear");
  round.leader.y = high + BANNER_HALF - 1;
  assert.equal(underBanner(round, shown), true, "the leader in the strip");
  round.leader.y = FIELD_H - EDGE;
  round.flock.push({ id: 1, x: round.scroll + 5, y: high });
  assert.equal(underBanner(round, shown), true, "a follower in the strip");
  round.flock[0].x = round.scroll - 5;
  assert.equal(underBanner(round, shown), false, "not a follower off the board");
  round.flock.length = 0;
  round.hazards.push(balloonAt(round.scroll + 40, high));
  assert.equal(underBanner(round, shown), true, "a hazard in the strip");
  round.hazards[0].x = round.scroll + FIELD_W + 30;
  assert.equal(underBanner(round, shown), false, "not one still off the board");
  round.hazards = [{ kind: "gust", x: round.scroll + FIELD_W, y: high, w: flock.GUST_W, h: 8, warnAt: 0, liveAt: 1000, vx: 0, vy: 0, live: false }];
  assert.equal(underBanner(round, shown), true, "a gust's warning in the strip");
});

test("a banner fades while something is under it, comes back when clear, and ends in time", () => {
  const round = clearSky();
  round.leader.y = 10;
  const shown = flock.banner(round, "Hello", "", "#fff", 4000);
  advance(round, 16);
  assert.ok(shown.row > FIELD_H / 2, "placed on its first frame");
  const { row } = shown;
  round.input.down = true;
  advance(round, 1200);
  round.input.down = false;
  assert.equal(shown.row, row, "kept where it was placed");
  round.leader.y = row;
  for (let k = 0; k < 20; k++) advance(round, 16);
  assert.ok(shown.see < 0.2, `see ${shown.see}`);
  round.leader.y = 3;
  for (let k = 0; k < 40; k++) advance(round, 16);
  assert.ok(shown.see > 0.9, `see ${shown.see}`);
  advance(round, 4000);
  assert.equal(round.banner, null);
});

test("contract: a round opens on its stage banner, and the pill reads the stage's title", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  g.start();
  assert.equal(g.round.banner.text, "Stage 1: Golden Hour");
  g.tick(16);
  assert.ok(g.round.banner.row !== null);
});

test("drawing: a banner's text is drawn at its see-through alpha", () => {
  const seen = [];
  const target = {
    fillText(text) {
      seen.push([text, target.globalAlpha]);
    },
  };
  const ctx = new Proxy(target, {
    get: (t, name) => (name in t ? t[name] : () => {}),
    set: (t, name, value) => {
      t[name] = value;
      return true;
    },
  });
  const g = game.create({ canvas: { width: 0, height: 0, style: {}, getContext: () => ctx } });
  g.resize(W * 8, H * 8);
  g.start();
  g.tick(16);
  const { text } = g.round.banner;
  g.round.banner.see = flock.BANNER_SEE_THROUGH;
  seen.length = 0;
  g.pause();
  const alpha = seen.find(([t]) => t === text);
  assert.ok(alpha, "the banner was drawn");
  assert.equal(alpha[1], flock.BANNER_SEE_THROUGH);
});

test("contract: the memo keeps the furthest stage, on each new stage and at the end, and never goes back", () => {
  const { canvas } = stubCanvas();
  let saved = 0;
  const memo = { get: () => saved, set: (n) => (saved = n) };
  const g = game.create({ canvas, memo });
  g.start();
  g.tick(16);
  assert.equal(saved, 0, "starting writes nothing");
  g.round.portal.x = g.round.leader.x;
  g.tick(16);
  assert.equal(g.round.stage, 2);
  assert.equal(saved, 2);
  g.round.portal.x = g.round.leader.x;
  g.tick(16);
  assert.equal(saved, 3);

  g.start();
  g.round.lives = 1;
  flock.hitLeader(g.round);
  g.tick(16);
  assert.equal(g.state, "over");
  assert.equal(saved, 3, "a shorter run keeps the furthest");

  saved = 0;
  g.start();
  g.round.lives = 1;
  flock.hitLeader(g.round);
  g.tick(16);
  assert.equal(saved, 1, "the end of a round saves it");
});

test("contract: running out of lives ends the round, and action starts a fresh one", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas });
  g.start();
  g.round.lives = 1;
  flock.hitLeader(g.round);
  g.tick(16);
  assert.equal(g.state, "over");
  g.key("action");
  assert.equal(g.state, "running");
  assert.equal(g.round.lives, START_LIVES);
});

test("drawing: a frame with every hazard in every phase, the portal, loose birds and a banner draws without trouble", () => {
  const { canvas, calls } = stubCanvas();
  const g = game.create({ canvas });
  g.resize(W * 8, H * 8);
  g.start();
  const { round } = g;
  round.nextStray = 1e9;
  const dealt = flock.buildStage(3, flock.MAX_STAGE).hazards;
  const kinds = Object.keys(flock.HAZARDS);
  round.hazards = kinds.map((kind, i) => ({ ...dealt.find((h) => h.kind === kind), x: round.scroll + 40 + i * 6 }));
  for (const h of round.hazards) {
    if (h.kind === "kite") h.tipX = h.x;
    if (h.kind === "storm") Object.assign(h, { phase: "warn", col: h.x, timer: 9999 });
    if (h.kind === "gust") Object.assign(h, { warnAt: 0, liveAt: 1e9 });
  }
  round.portal.x = round.scroll + 80;
  round.flock.push({ id: 1 }, { id: 2 });
  g.tick(16);
  flock.snapAt(round, 2);
  const before = calls.count;
  g.tick(16);
  assert.ok(calls.count > before);
  const gust = round.hazards.find((h) => h.kind === "gust");
  Object.assign(gust, { live: true, liveAt: 0 });
  Object.assign(round.hazards.find((h) => h.kind === "storm"), { phase: "strike" });
  round.infinite = true;
  g.tick(16);
  assert.equal(g.state, "running");
});

test("a bot on the clearest line through stage 1 at full speed loses no life", () => {
  const round = newRound(1);
  assert.deepEqual(round.hazards.map((h) => h.x), flock.buildStage(1, 1).hazards.map((h) => h.x), "the stage the plan names");
  const clearance = (y) => {
    const { leader } = round;
    let least = Infinity;
    for (const h of round.hazards) {
      if (h.x < leader.x - 6 || h.x > leader.x + 30) continue;
      least = Math.min(least, Math.abs(y - h.y) - h.r);
    }
    return least;
  };
  let ms = 0;
  const SAFE = 5;
  while (round.stage === 1 && !round.over && ms < 120_000) {
    const { leader } = round;
    let best = leader.y;
    // Holds its height until something comes near it, then takes the nearest
    // height clear enough, which never means crossing what it is avoiding.
    if (clearance(leader.y) < SAFE) {
      let nearest = Infinity;
      for (let y = EDGE; y <= FIELD_H - EDGE; y += 1) {
        if (clearance(y) >= SAFE && Math.abs(y - leader.y) < nearest) {
          nearest = Math.abs(y - leader.y);
          best = y;
        }
      }
    }
    round.input.up = best < leader.y - 0.5;
    round.input.down = best > leader.y + 0.5;
    advance(round, 16);
    ms += 16;
  }
  assert.equal(round.lives, START_LIVES, `lives left after ${ms} ms`);
  assert.equal(round.lost, 0, "none lost on the way (the counts reset only at the portal)");
  assert.equal(round.stage, 2, "and through the portal");
});

/* ------------------------------------------------------------- the power-ups */

const liveGust = (round, y) => ({ kind: "gust", x: round.scroll - 40, y, w: 120, h: 12, vx: 0, vy: 0, live: true, warnAt: 0, liveAt: 0 });

test("the power table: three kinds, each with a color, and the timed ones with their time", () => {
  assert.deepEqual(flock.POWER_KINDS, ["tailwind", "shield", "magnet"]);
  for (const kind of flock.POWER_KINDS) assert.match(flock.POWERS[kind].color, /^#[0-9a-f]{6}$/);
  assert.equal(flock.POWERS.tailwind.ms, 6000);
  assert.equal(flock.POWERS.magnet.ms, 8000);
  assert.equal(flock.POWERS.shield.ms, undefined);
  assert.ok(Object.isFrozen(flock.POWERS.shield));
});

test("a tailwind speeds the scroll and carries the line and the leader through a gust", () => {
  const plain = clearSky();
  advance(plain, 1000);
  const round = levelFlock(4);
  const { leader } = round;
  leader.sx = 30;
  const from = round.scroll;
  flock.applyPower(round, "tailwind");
  round.hazards.push(liveGust(round, leader.y));
  advance(round, 1000);
  assert.ok(Math.abs(round.scroll - from - BASE_SPEED * (1 + flock.TAILWIND_BOOST)) < 0.1, "half as fast again");
  assert.ok(Math.abs(plain.scroll - BASE_SPEED) < 0.1);
  assert.equal(leader.sx, 30, "no shove");
  assert.equal(round.flock.length, 4, "no snap");
  round.active.tailwind = 0;
  advance(round, 100);
  assert.ok(leader.sx < 30, "shoved again once it runs out");
  assert.equal(round.flock.length, 0, "and snapped");
});

test("a shield soaks one leader hit with a moment's grace, and shields cap", () => {
  const round = clearSky();
  const { leader } = round;
  for (let k = 0; k < 3; k++) flock.applyPower(round, "shield");
  assert.equal(round.active.shields, flock.MAX_SHIELDS);
  round.active.shields = 1;
  round.flock.push({ id: 1 }, { id: 2 });
  assert.equal(flock.hitLeader(round), false);
  assert.equal(round.active.shields, 0);
  assert.equal(leader.grace, flock.SHIELD_GRACE);
  assert.equal(round.lives, START_LIVES, "no life");
  assert.equal(round.flock.length, 2, "no snap");
  assert.equal(round.lost, 0);
  assert.equal(leader.alive, true);
  assert.equal(flock.hitLeader(round), false, "grace holds");
  leader.grace = 0;
  assert.equal(flock.hitLeader(round), true, "the next hit counts");
  assert.equal(round.lives, START_LIVES - 1);
});

test("a shield soaks one snap and keeps the flock whole, and one hazard spends only one", () => {
  const round = levelFlock(5);
  round.active.shields = 2;
  round.hazards.push(balloonAt(round.flock[2].x + 2, round.flock[2].y, 1));
  advance(round, 300);
  assert.equal(round.flock.length, 5, "the flock is whole");
  assert.equal(round.active.shields, 1, "one shield for one balloon");
  assert.equal(round.snaps, 0, "a soaked snap is no snap");
});

test("a shield soaks a slipstream's snap too", () => {
  const round = levelFlock(4);
  const { leader } = round;
  round.active.shields = 1;
  // The lane's lower edge runs just above the level line; climbing crosses it.
  round.hazards.push({ kind: "stream", x: round.scroll - 40, y: leader.y - 6, w: 400, h: 10, vx: 0, vy: 0 });
  round.input.up = true;
  advance(round, 200);
  assert.equal(round.active.shields, 0, "spent on the line crossing the edge");
  assert.equal(round.flock.length, 4);
  assert.equal(round.snaps, 0);
});

test("a magnet pulls a stray within reach and leaves one outside it, and a late scattered bird alone", () => {
  const round = clearSky();
  const { leader } = round;
  flock.applyPower(round, "magnet");
  const near = { id: 1, x: leader.x + 12, y: leader.y + 10, bob: 0 };
  const far = { id: 2, x: leader.x + 12, y: leader.y + flock.MAGNET_REACH + 1, bob: 0 };
  const late = { id: 3, x: leader.x + 5, y: leader.y + 10, vx: 0, vy: 1, until: -1 };
  round.strays.push(near, far);
  round.scattered.push(late);
  const y = { near: near.y, far: far.y, late: late.y };
  advance(round, 100);
  assert.ok(near.y < y.near - 1, "pulled toward the leader");
  assert.equal(far.y, y.far, "out of reach");
  assert.ok(late.y > y.late, "a bird out of time flies off, unpulled");
  round.active.magnet = 0;
  const held = near.y;
  advance(round, 20);
  assert.equal(near.y, held, "no magnet, no pull");
});

test("a thunderhead's warning column holds still on the board under a tailwind too", () => {
  const round = clearSky();
  flock.applyPower(round, "tailwind");
  round.hazards.push({ kind: "storm", x: round.scroll + 50, y: flock.STORM_H, w: flock.STORM_W, h: flock.STORM_H, vx: -12, vy: 0, top: true, beat: 2000, timer: 1, phase: "idle", col: round.scroll + 50 });
  advance(round, 8);
  const [storm] = round.hazards;
  assert.equal(storm.phase, "warn");
  const at = storm.col - round.scroll;
  advance(round, 500);
  assert.equal(storm.phase, "warn");
  assert.ok(Math.abs(storm.col - round.scroll - at) < 0.01, "held at " + at);
});

test("the timers run out, and a crash ends them", () => {
  const round = clearSky();
  flock.applyPower(round, "tailwind");
  flock.applyPower(round, "magnet");
  advance(round, flock.POWERS.tailwind.ms + 8);
  assert.equal(round.active.tailwind, 0);
  assert.ok(round.active.magnet > 0, "the longer one still runs");
  advance(round, flock.POWERS.magnet.ms);
  assert.equal(round.active.magnet, 0);

  const crashed = clearSky();
  flock.applyPower(crashed, "tailwind");
  flock.applyPower(crashed, "magnet");
  flock.hitLeader(crashed);
  assert.deepEqual(crashed.active, { tailwind: 0, magnet: 0, shields: 0 });
});

test("crates are always in a clear height, come through every stage, and repeat by seed", () => {
  for (let seed = 1; seed <= 25; seed++) {
    for (let n = 1; n <= flock.MAX_STAGE; n++) {
      const { hazards, crates, length } = flock.buildStage(seed, n);
      assert.ok(crates.length >= 2, `seed ${seed} stage ${n}: ${crates.length} crates`);
      assert.ok(crates[0].x >= flock.CRATE_EVERY[0]);
      for (const c of crates) {
        assert.ok(flock.POWERS[c.kind]);
        assert.ok(c.x < length - flock.SAFE_END);
        assert.ok(c.y >= EDGE && c.y <= FIELD_H - EDGE);
        for (const h of hazards) {
          const [from, to] = flock.spanOf(h);
          if (c.x + flock.CRATE_R < from || c.x - flock.CRATE_R > to) continue;
          if (h.kind === "balloon") assert.ok(Math.abs(c.y - h.y) >= h.r + flock.CRATE_R, "off a balloon");
          if (h.kind === "cluster") assert.ok(Math.abs(c.y - h.home) >= h.h / 2 + flock.CLUSTER_SWAY + flock.CRATE_R, "off a bunch");
          if (h.kind === "kite") assert.ok(h.top ? c.y >= h.y + flock.KITE_R + flock.CRATE_R : c.y <= h.y - flock.KITE_R - flock.CRATE_R, "off a kite");
        }
      }
    }
  }
  assert.deepEqual(flock.buildStage(4, 3), flock.buildStage(4, 3));
});

test("flying into a crate opens it with its banner, and a replay puts back the crates ahead", () => {
  const round = newRound(2);
  round.hazards = [];
  round.nextStray = 1e9;
  const [first, ...rest] = round.crates;
  round.crates = [{ ...first, x: round.leader.x + 2, y: round.leader.y }, ...rest];
  const { kind } = first;
  advance(round, 16);
  assert.equal(round.crates.length, rest.length);
  assert.equal(round.banner.text, flock.POWERS[kind].name);
  assert.equal(round.banner.sub, flock.POWERS[kind].blurb);
  assert.ok(kind === "shield" ? round.active.shields === 1 : round.active[kind] > 0);
  round.active.shields = 0;
  flock.hitLeader(round);
  advance(round, flock.CRASH_MS + 16);
  assert.equal(round.crates.length, rest.length + 1, "the whole stretch's crates are back");
});

/* ---------------------------------------------------------- combo and score */

test("the combo rises within COMBO_MS, multiplies the points, caps, and resets after", () => {
  const round = clearSky();
  const bird = (id) => {
    const b = { id, x: 0, y: 0, bob: 0 };
    round.strays.push(b);
    return b;
  };
  const pays = [];
  for (let k = 1; k <= flock.MAX_COMBO + 1; k++) {
    const before = round.score;
    flock.collect(round, bird(k));
    pays.push(round.score - before);
    assert.equal(round.combo, Math.min(k, flock.MAX_COMBO));
    round.now += flock.COMBO_MS;
  }
  assert.deepEqual(pays, [1, 2, 3, 4, 5, 5].map((m) => m * STRAY_POINTS));
  round.now += 1;
  const before = round.score;
  flock.collect(round, bird(50));
  assert.equal(round.combo, 1, "too late starts again");
  assert.equal(round.score - before, STRAY_POINTS);
});

test("the combo lapses on its own, so its pill goes away", () => {
  const round = clearSky();
  round.combo = 3;
  round.comboAt = round.now;
  advance(round, flock.COMBO_MS - 8);
  assert.equal(round.combo, 3);
  advance(round, 16);
  assert.equal(round.combo, 1);
});

test("a scattered bird won back pays half and keeps the combo", () => {
  const round = clearSky();
  round.combo = 3;
  round.comboAt = 5;
  const bird = { id: 1, x: 0, y: 0, until: 1e9 };
  round.scattered.push(bird);
  flock.collect(round, bird);
  assert.equal(round.score, STRAY_POINTS / 2);
  assert.equal(round.combo, 3);
  assert.equal(round.comboAt, 5);
});

test("distance pays per DIST_STEP, double under a tailwind", () => {
  const round = clearSky();
  advance(round, 1100);
  assert.equal(round.score, Math.floor((BASE_SPEED * 1.1) / flock.DIST_STEP) * flock.DIST_POINTS);
  const fast = clearSky();
  flock.applyPower(fast, "tailwind");
  advance(fast, 1100);
  const flown = BASE_SPEED * 1.1 * (1 + flock.TAILWIND_BOOST);
  assert.equal(fast.score, Math.floor(flown / flock.DIST_STEP) * flock.DIST_POINTS * 2);
});

test("a flawless stage pays by its number after the V, and the stage's banner comes last", () => {
  const round = atPortal(6);
  round.portal.min = 6;
  round.snaps = 0;
  advance(round, 200);
  assert.equal(round.score, 6 * flock.V_POINTS + flock.FLAWLESS_POINTS);
  assert.match(round.banner.text, /^V formation!/);
  advance(round, flock.V_MS);
  assert.equal(round.stage, 2);
  assert.equal(round.banner.text, "Flawless!");
  advance(round, 1400);
  assert.equal(round.banner.text, "Stage 2: Head-winds");
});

test("a short flock's flawless stage pays too; a snap, a life lost or a missed ring does not", () => {
  const short = atPortal(2);
  short.portal.min = 6;
  short.snaps = 0;
  advance(short, 200);
  assert.equal(short.score, flock.FLAWLESS_POINTS);
  assert.equal(short.banner.text, "Need 6 birds for the V");
  advance(short, 1200);
  assert.equal(short.banner.text, "Flawless!");

  const snapped = atPortal(2);
  snapped.portal.min = 6;
  advance(snapped, 200);
  assert.equal(snapped.score, 0);

  const hurt = atPortal(2);
  hurt.portal.min = 6;
  hurt.snaps = 0;
  hurt.lost = 1;
  advance(hurt, 200);
  assert.equal(hurt.score, 0);

  const around = atPortal(2);
  around.snaps = 0;
  around.portal.y = around.leader.y + 40;
  advance(around, 200);
  assert.equal(around.score, 0);
});

// A game whose canvas records what is drawn on it, and how.
function recordingGame(options = {}) {
  const seen = { texts: [], arcs: [], boxes: 0, windLines: 0 };
  const ctx = new Proxy({}, {
    get: (target, name) => {
      if (name === "fillText") return (text) => seen.texts.push(text);
      if (name === "arc") return (x, y, r) => seen.arcs.push(r);
      if (name === "strokeRect") return () => { seen.boxes += 1; };
      if (name === "moveTo") return () => { if (target.strokeStyle === flock.POWERS.tailwind.color) seen.windLines += 1; };
      return name in target ? target[name] : () => {};
    },
    set: (target, name, value) => { target[name] = value; return true; },
  });
  const g = game.create({ canvas: { width: 0, height: 0, style: {}, getContext: () => ctx }, ...options });
  g.resize(W * 8, H * 8);
  g.start();
  return { g, seen };
}

// Flies a game's round through the last portal on the next tick.
function winNext(round) {
  round.hazards = [];
  round.crates = [];
  round.stage = flock.MAX_STAGE;
  round.portal.x = round.leader.x;
  round.portal.y = round.leader.y;
  round.portal.h = flock.PORTAL_H_FINAL;
  round.portal.min = 3;
  round.portal.t = 0;
}

test("a flawless last stage pays, and the end screen says so", () => {
  const { g, seen } = recordingGame();
  winNext(g.round);
  seen.texts.length = 0;
  g.tick(4);
  assert.equal(g.state, "over");
  assert.ok(g.score >= flock.FLAWLESS_POINTS * flock.MAX_STAGE);
  assert.ok(seen.texts.includes(`You made it! Flawless +${flock.FLAWLESS_POINTS * flock.MAX_STAGE}`), seen.texts.join(" | "));
});

test("a win with a snap on the record names no bonus", () => {
  const { g, seen } = recordingGame();
  winNext(g.round);
  g.round.snaps = 1;
  seen.texts.length = 0;
  g.tick(4);
  assert.ok(seen.texts.includes("You made it!"), seen.texts.join(" | "));
  assert.ok(!seen.texts.some((t) => /Flawless/.test(t)));
});

test("contract: onScore fires once at the end, and a new best is announced once", () => {
  const { canvas } = stubCanvas();
  const scores = [];
  const g = game.create({ canvas, onScore: (s) => scores.push(s), best: () => 40 });
  g.start();
  const { round } = g;
  round.hazards = [];
  round.crates = [];
  round.banner = null;
  round.score = 40;
  g.tick(1);
  assert.equal(round.banner, null, "level with the best is not past it");
  round.score = 41;
  g.tick(1);
  assert.equal(round.banner.text, "New best!");
  round.banner = null;
  round.score = 90;
  g.tick(1);
  assert.equal(round.banner, null, "only once");
  assert.deepEqual(scores, []);
  round.lives = 1;
  flock.hitLeader(round);
  g.tick(16);
  g.tick(16);
  assert.equal(g.state, "over");
  assert.deepEqual(scores, [g.score]);
});

test("contract: a new best waits for a clear banner, and a crash cannot lose it", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas, best: () => 40 });
  g.start();
  const { round } = g;
  round.hazards = [];
  round.crates = [];
  round.score = 41;
  const showing = round.banner.text;
  g.tick(1);
  assert.equal(round.banner.text, showing, "the stage's title stays up");
  flock.hitLeader(round);
  g.tick(flock.CRASH_MS + 500);
  g.tick(1);
  assert.equal(round.banner.text, "New best!");
});

test("contract: a first round with no best announces nothing, and a best that throws reads as none", () => {
  const { canvas } = stubCanvas();
  const g = game.create({ canvas, best: () => { throw new Error("no"); } });
  g.start();
  g.round.banner = null;
  g.round.score = 500;
  g.round.hazards = [];
  g.tick(1);
  assert.equal(g.round.banner, null);
});

test("teaser: the next hazard, then a win, then the jet stream, then the next stage", () => {
  const round = newRound(1);
  assert.equal(flock.teaser(round, 1), "Head-winds wait at stage 2...");
  round.stage = 5;
  assert.equal(flock.teaser(round, 5), "Kite strings wait at stage 6...");
  round.stage = 2;
  assert.equal(flock.teaser(round, 5), "Kite strings wait at stage 6...", "what the furthest run has met is met");
  round.stage = 8;
  round.won = true;
  assert.equal(flock.teaser(round, 8), "Can you bring a bigger flock?");
  round.won = false;
  assert.equal(flock.teaser(round, 8), "The jet stream is waiting. One more go?");
  round.stage = 6;
  assert.equal(flock.teaser(round, 6), "Can you reach stage 7?");
});

test("the strip adds the combo above 1 and the running power-ups after the flock", () => {
  const hud = { stage: "Stage 1", score: 1, flock: 2, min: 6, combo: 1, powers: [] };
  assert.deepEqual(hudLayout(2.4, W, 3, hud, flock.HUD_H).map((p) => p.text), ["Stage 1", livesText(3), "Score 1", "Flock 2 / 6"]);
  const round = clearSky();
  flock.applyPower(round, "tailwind");
  flock.applyPower(round, "shield");
  flock.applyPower(round, "shield");
  flock.applyPower(round, "magnet");
  const powers = flock.powerPills(round);
  assert.deepEqual(powers.map((p) => p.text), ["Tailwind 6s", "Shield x2", "Magnet 8s"]);
  const pills = hudLayout(2.4, W, 3, { ...hud, stage: "Stage 8: The Jet Stream", score: 12345, combo: 3, powers }, flock.HUD_H);
  assert.deepEqual(pills.map((p) => p.text).slice(4), ["x3", "Tailwind 6s", "Shield x2", "Magnet 8s"]);
  assert.ok(pills.every((p) => p.y + p.h <= flock.HUD_H), "all of it fits the strip");
});

test("drawing: crates, the magnet ring, tailwind streaks and the end screen draw, and the end names the run", () => {
  const { g, seen } = recordingGame();
  const { round } = g;
  round.hazards = [];
  round.nextStray = 1e9;
  round.crates = flock.POWER_KINDS.map((kind, i) => ({ kind, x: round.scroll + 40 + i * 8, y: 40 }));
  g.tick(16);
  assert.equal(seen.boxes >= 3, true, "a box per crate");
  assert.ok(!seen.arcs.includes(flock.MAGNET_REACH), "no ring without a magnet");
  assert.equal(seen.windLines, 0, "no streaks without a tailwind");
  flock.applyPower(round, "tailwind");
  flock.applyPower(round, "magnet");
  round.flock.push({ id: 1 });
  g.tick(16);
  assert.ok(seen.arcs.includes(flock.MAGNET_REACH), "the magnet's ring");
  assert.ok(seen.windLines >= 5, "the tailwind's streaks");

  const { g: ended, seen: { texts } } = recordingGame({ best: () => 5 });
  ended.round.score = 12;
  ended.round.lives = 1;
  flock.hitLeader(ended.round);
  texts.length = 0;
  ended.tick(16);
  assert.equal(ended.state, "over");
  assert.ok(texts.includes("Out of lives"));
  assert.ok(texts.includes(String(ended.score)), "the score");
  assert.ok(texts.includes(`A new best! ${ended.score}`), "the best");
  assert.ok(texts.includes("Head-winds wait at stage 2..."), "the teaser");
});

test("the strip counts the flock against the portal's minimum, in the success color once met, and every pill reads", () => {
  const hud = { stage: "Stage 8: The Jet Stream", score: 12345, flock: 12, min: 18, combo: 3, powers: [{ text: "Tailwind 6s", color: flock.POWERS.tailwind.color, fill: 0.5 }, { text: "Shield x2", color: flock.POWERS.shield.color, fill: 1 }, { text: "Magnet 8s", color: flock.POWERS.magnet.color, fill: 0.5 }] };
  const short = hudLayout(2.4, W, 3, hud, flock.HUD_H);
  assert.equal(short[3].text, "Flock 12 / 18");
  assert.notEqual(short[3].color, SUCCESS);
  const met = hudLayout(2.4, W, 3, { ...hud, flock: 18 }, flock.HUD_H);
  assert.equal(met[3].color, SUCCESS);
  assert.ok(met.every((p) => p.y === met[0].y), "one row");
  assert.ok(met.every((p) => p.y + p.h <= flock.HUD_H), "inside the strip");
  for (const p of [...short, ...met]) {
    if (p.color === LIVES) continue;
    assert.ok(pillContrast(pillInk(p.color, p.fill < 1), PILL) >= PILL_CONTRAST, `"${p.text}" reads on its pill`);
  }
});

test("music: a deal has every track once and never opens on the last song", () => {
  for (const last of flock.MUSIC_TRACKS) {
    for (let k = 0; k < 40; k++) {
      const deck = flock.dealMusic(Math.random, last);
      assert.deepEqual([...deck].sort(), [...flock.MUSIC_TRACKS].sort());
      assert.notEqual(deck[0], last);
    }
  }
});

test("music: a run plays each song in full from its top, deals again after the last, and never opens on the song just played", () => {
  const asked = [];
  let answer = true;
  const { canvas } = stubCanvas();
  const g = game.create({ canvas, music: (name, level, options) => { asked.push([name, options]); return answer; } });
  g.resize(W * 8, H * 8);
  g.start();
  g.round.hazards = [];
  g.round.portal.x = Infinity;
  g.tick(4);
  const first = asked.at(-1)[0];
  assert.deepEqual(asked.at(-1)[1], { restart: true }, "from the top");
  g.tick(4);
  assert.equal(asked.at(-1)[0], first);
  assert.equal(asked.at(-1)[1], undefined, "then just kept going");
  answer = "ended";
  asked.length = 0;
  for (let k = 0; k <= flock.MUSIC_TRACKS.length; k++) g.tick(4);
  const opened = [first, ...asked.filter(([, options]) => options?.restart).map(([name]) => name)];
  const count = flock.MUSIC_TRACKS.length;
  assert.equal(new Set(opened.slice(0, count)).size, count, "all five, once each");
  assert.notEqual(opened[count], opened[count - 1], "the new deal opens on another song");
});

test("the skies: a palette for every stage, deepening to stars only at the last", () => {
  for (let n = 1; n <= flock.MAX_STAGE; n++) {
    const sky = SKIES[n];
    assert.ok(sky, `stage ${n}`);
    for (const key of ["top", "mid", "horizon", "cloud", "sun"]) assert.match(sky[key], /^#[0-9a-f]{6}$/, `stage ${n} ${key}`);
    assert.equal(typeof sky.sunY, "number");
    if (n > 1) assert.ok(sky.sunY > SKIES[n - 1].sunY, "the sun keeps sinking");
    assert.equal(sky.stars > 0, n === flock.MAX_STAGE);
  }
});

test("drawing: a full frame on every stage, the V, the end screen and the win", () => {
  for (let n = 1; n <= flock.MAX_STAGE; n++) {
    const { canvas, calls } = stubCanvas();
    const g = game.create({ canvas });
    g.resize(W * 8, H * 8);
    g.start();
    const { round } = g;
    round.stage = n;
    round.nextStray = 1e9;
    round.flock.push({ id: 1 }, { id: 2 }, { id: 3 });
    round.portal.x = round.leader.x + 10;
    round.leader.grace = 500;
    g.tick(16);
    assert.equal(g.state, "running", `stage ${n}`);
    assert.ok(calls.count > 0);
    assert.ok(calls.stops >= 3, "the sky's own gradient");
    round.portal.v = { t: 500 };
    g.tick(16);
    assert.ok(round.flock.every((b) => typeof b.x === "number"));
  }
  const { g, seen } = recordingGame();
  winNext(g.round);
  g.tick(4);
  assert.equal(g.round.won, true);
  assert.equal(g.state, "over");
  assert.ok(seen.texts.includes("You made it!") || seen.texts.some((t) => String(t).startsWith("You made it!")));
});

test("sounds: every event plays a sound that exists, warnings once each, and a sound never changes the round", () => {
  const played = [];
  const hums = [];
  const { canvas } = stubCanvas();
  const g = game.create({ canvas, tone: (name, level, pitch, louder) => played.push({ name, pitch, louder }), hum: (id, name) => hums.push([id, name]) });
  g.resize(W * 8, H * 8);
  g.start();
  const { round } = g;
  Object.assign(round, { hazards: [], crates: [], nextStray: 1e9 });
  round.portal.x = Infinity;
  g.tick(4);
  assert.ok(played.some((p) => p.name === "flockStage"), "the stage's sound opens the run");
  assert.deepEqual(hums.at(-1), ["flock:wind", "flockWind"]);

  const names = () => played.map((p) => p.name);
  const expectSound = (name, act) => {
    played.length = 0;
    act();
    g.tick(4);
    assert.ok(names().includes(name), `${name} in ${names().join(", ")}`);
  };
  const near = (bird = {}) => ({ id: 900 + played.length, x: round.leader.x, y: round.leader.y, bob: 0, ...bird });
  expectSound("flockChirp", () => round.strays.push(near()));
  expectSound("flockPower", () => round.crates.push({ kind: "magnet", x: round.leader.x, y: round.leader.y }));
  round.active.magnet = 0;

  // Two gusts arriving together warn once.
  played.length = 0;
  const gust = (y) => ({ kind: "gust", x: round.scroll + FIELD_W - 1, y, w: 16, h: 6, vx: 0, vy: 0, live: false });
  round.hazards = [gust(5), gust(50)];
  g.tick(4);
  assert.equal(names().filter((n) => n === "flockGust").length, 1, "one warning");
  round.hazards = [];

  // A storm's warning and its strike.
  played.length = 0;
  const storm = { kind: "storm", x: round.scroll + 80, y: 5, w: 12, h: 5, vx: -12, vy: 0, top: true, beat: 2000, timer: 1, phase: "idle", col: round.scroll + 80 };
  round.hazards = [storm];
  g.tick(8);
  assert.ok(names().includes("flockThunder"));
  storm.timer = 1;
  played.length = 0;
  g.tick(8);
  assert.ok(names().includes("flockStrike"));
  round.hazards = [];

  // A snap, then a bird won back, then a shield on a hit, then a hit.
  round.flock.push({ id: 1 }, { id: 2 });
  g.tick(500);
  expectSound("flockSnap", () => round.hazards.push({ kind: "balloon", x: round.flock[1].x, y: round.flock[1].y, w: 2, h: 2, r: 1, vx: 0, vy: 0 }));
  round.hazards = [];
  round.leader.grace = 0;
  expectSound("flockRejoin", () => {
    const b = round.scattered[0];
    b.x = round.leader.x;
    b.y = round.leader.y;
  });
  round.scattered = [];
  round.flock.length = 0;
  round.leader.grace = 0;
  const onLeader = () => round.hazards.push({ kind: "balloon", x: round.leader.x, y: round.leader.y, w: 2, h: 2, r: 1, vx: 0, vy: 0 });
  flock.applyPower(round, "shield");
  expectSound("flockShield", onLeader);
  round.hazards = [];
  round.leader.grace = 0;
  expectSound("flockHit", onLeader);
  round.hazards = [];

  // The portal, the V, the flawless bonus and the win.
  const { g: won } = recordingGame({ tone: (name) => played.push({ name }) });
  played.length = 0;
  won.round.flock.push({ id: 1 }, { id: 2 }, { id: 3 });
  winNext(won.round);
  won.tick(4);
  for (const name of ["flockPortal", "flockV", "flockFlawless"]) assert.ok(names().includes(name), `${name} in ${names().join(", ")}`);
  won.tick(flock.V_MS + 8);
  assert.ok(names().includes("flockWin"));

  // A game over, and a new best.
  const { g: lost } = recordingGame({ tone: (name) => played.push({ name }), best: () => 1 });
  played.length = 0;
  lost.round.score = 50;
  lost.round.banner = null;
  lost.tick(4);
  assert.ok(names().includes("flockBest"));
  lost.round.lives = 1;
  flock.hitLeader(lost.round);
  lost.tick(4);
  assert.ok(names().includes("flockOver"));

  for (const name of new Set(names())) assert.ok(toneNames().includes(name), `${name} is a tone`);
  assert.ok(humNames().includes("flockWind"));
  assert.ok(humNames().includes("flockStream"));

});

test("a sound never changes the round: one sky flown with the sounds heard and without comes out the same", () => {
  const fly = (options) => {
    const realRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const { canvas } = stubCanvas();
      const g = game.create({ canvas, ...options });
      g.resize(W * 8, H * 8);
      g.start();
      g.cheat(true);
      for (let k = 0; k < 1500; k++) {
        const name = k % 80 < 40 ? "up" : "down";
        g.key(name);
        g.release(name === "up" ? "down" : "up");
        g.tick(16);
      }
      return JSON.stringify(g.round);
    } finally {
      Math.random = realRandom;
    }
  };
  const heard = [];
  const loud = fly({ tone: (name) => heard.push(name), hum: (id) => heard.push(id), music: (name) => { heard.push(name); return true; } });
  const quiet = fly({});
  assert.ok(new Set(heard).size >= 4, `sounds did play: ${[...new Set(heard)].join(", ")}`);
  assert.equal(loud, quiet);
});

test("the wind hums with speed, and the slipstream rushes only while the leader rides it", () => {
  const hums = [];
  const { canvas } = stubCanvas();
  const g = game.create({ canvas, hum: (id, name, level, pitch) => hums.push({ id, pitch }) });
  g.resize(W * 8, H * 8);
  g.start();
  const { round } = g;
  Object.assign(round, { hazards: [], crates: [], nextStray: 1e9 });
  round.portal.x = Infinity;
  g.tick(16);
  const slow = hums.filter((h) => h.id === "flock:wind").at(-1).pitch;
  assert.ok(!hums.some((h) => h.id === "flock:stream"));
  round.speed = flock.STAGES[flock.MAX_STAGE].speed;
  g.tick(16);
  assert.ok(hums.filter((h) => h.id === "flock:wind").at(-1).pitch > slow, "faster, higher");
  round.hazards = [{ kind: "stream", x: round.leader.x - 5, y: round.leader.y, w: 40, h: 12, vx: 0, vy: 0 }];
  g.tick(16);
  assert.ok(hums.some((h) => h.id === "flock:stream"));
});

test("a long winding flock of 80 stays within a frame's budget", () => {
  const round = clearSky(5);
  for (let k = 0; k < 80; k++) round.flock.push({ id: k + 1 });
  // Fly a long weave so the path is full.
  for (let k = 0; k < 400; k++) {
    round.input.up = k % 40 < 20;
    round.input.down = !round.input.up;
    advance(round, 16);
  }
  assert.equal(round.flock.length, 80);
  const runs = 200;
  const started = performance.now();
  for (let k = 0; k < runs; k++) {
    placeFlock(round);
    advance(round, flock.SLICE_MS);
  }
  const each = (performance.now() - started) / runs;
  assert.ok(each < 2, `${each.toFixed(3)} ms a run`);
});
