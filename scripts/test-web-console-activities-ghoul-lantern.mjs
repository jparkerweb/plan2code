// Web console tests, Ghoul Rush's Drowned Lantern (Gallows Bog's bonus round, between the Stilt House and the Drowning Pool, a top-down game on one screen and not a ride): the island, the walk and the slide, the flare and the oil, the shrines and the run to the boat, each hunter's one rule (the Lurker hears steps on wood and dashes down a lane through where it heard you, the wisps guard the shrines and burst in a flare, the leeches never enter the light, the bog bodies take only someone standing still, Old Mother Bog's hand), the hearts and the grade, the clock, determinism, the balance (a bot that ignores the hunters loses, one that plays them wins), the voices, the hums and the drawing.
// Run with: node --test scripts/test-web-console-activities-ghoul-lantern.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as lz from "../src/web-console/public/activities/ghoul-rush/rides/lantern/ghoul-lantern.js";
import { EVENT_VOICE, LOOKS as LANTERN_LOOKS, LOSE_SOUNDS, LOSE_WORDS, TAGS, VOICES as LANTERN_VOICES } from "../src/web-console/public/activities/ghoul-rush/rides/lantern/ghoul-lantern-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LANTERN_SFX } from "../src/web-console/public/activities/ghoul-rush/rides/lantern/ghoul-sfx-lantern.js";
import { LOOKS, VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, BONUS_SAFE_MS, diceFor } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";
import { humNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the drowned lantern drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);
const ROOM = ghoul.roomById("lantern");
const R = ROOM.ride;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// A round in the Drowned Lantern set up the way a room is, in play.
function lanternRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  ghoul.setupRoom(round, "lantern");
  round.phase = "play";
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.events.length = 0;
  return round;
}

// The same round with every hunter out of the way (the Lurker resting for good, the rest gone, Mother's hand held off), for what the hunters would spoil.
function quiet(round) {
  const c = round.runner;
  Object.assign(c.lurker, { state: "rest", t: 1e12, x: 1, y: 52 });
  for (const w of c.wisps) w.state = "gone";
  c.leeches.length = 0;
  c.bodies.length = 0;
  round.hush = true;
  return round;
}
// Puts Planny at (x, y), standing.
function at(round, x, y) {
  const c = round.runner;
  Object.assign(c, { x, y, hf: false, moving: false, stepMs: 0 });
  round.you.x = x;
}
// The clock `ms` into the round.
const clockAt = (round, ms) => {
  round.timeMs = R.time - ms;
};
const hush = (round) => {
  if (round.hush && round.runner) {
    round.runner.mother.hand = null;
    round.runner.mother.gap = 1e9;
  }
};

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) {
    hush(round);
    ghoul.advance(round, 4, random);
  }
  for (const k of Object.keys(keys)) round.input[k] = false;
}
function until(round, done, ms = 6000, random = steady) {
  let t = 0;
  for (; t < ms && !done(); t += 4) {
    hush(round);
    ghoul.advance(round, 4, random);
  }
  return t;
}
// A tap of SPACE (one press, let go).
function tap(round) {
  run(round, 8, { fire: true });
  run(round, 8, {});
}

// Walks Planny to (x, y) with the arrows the way a player steers (two arrows for a diagonal).
function walkTo(round, x, y, stop = () => false) {
  const c = round.runner;
  let guard = 0;
  while (Math.hypot(c.x - x, c.y - y) > 0.6 && round.phase === "play" && guard++ < 30000 && !stop()) {
    const dx = x - c.x;
    const dy = y - c.y;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    Object.assign(round.input, { left: dx < -0.2 && ax > 0.35 * ay, right: dx > 0.2 && ax > 0.35 * ay, up: dy < -0.2 && ay > 0.35 * ax, down: dy > 0.2 && ay > 0.35 * ax });
    hush(round);
    ghoul.advance(round, 4, steady);
  }
  Object.assign(round.input, { left: false, right: false, up: false, down: false });
}

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 40, y: 30, ...e }, kit);
  return { played };
};

// Which hummocks the planks join to the landing.
function reach() {
  const seen = new Set([0]);
  for (let moved = true; moved; ) {
    moved = false;
    for (const [a, b] of R.planks) {
      if (seen.has(a) !== seen.has(b)) {
        seen.add(a);
        seen.add(b);
        moved = true;
      }
    }
  }
  return seen;
}
const onAxis = (x, y) =>
  Math.min(
    ...R.planks.map(([a, b]) => {
      const [x1, y1] = R.hummocks[a];
      const [x2, y2] = R.hummocks[b];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const t = Math.min(1, Math.max(0, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
      return Math.hypot(x - x1 - dx * t, y - y1 - dy * t);
    }),
  );

/* ------------------------------------------------------------ the bots */

// A bot that plays: the shortest walk over the planks to each shrine in `order`, then the boat. `smart` flares a
// wisp within 7, steps off a Lurker's lane, waits on the moss while the Lurker hunts near, and walks out of
// Mother's shadow; without it the bot walks its way and ignores everything.
function makeBot(round, { smart = false, order = [2, 4, 6, 7, 8] } = {}) {
  const c = round.runner;
  const len = (a, b) => Math.hypot(R.hummocks[a][0] - R.hummocks[b][0], R.hummocks[a][1] - R.hummocks[b][1]);
  function path(from, to) {
    const n = R.hummocks.length;
    const d = Array(n).fill(Infinity);
    const prev = Array(n).fill(-1);
    const done = new Set();
    d[from] = 0;
    while (done.size < n) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done.has(i) && (u < 0 || d[i] < d[u])) u = i;
      done.add(u);
      for (const [a, b] of R.planks) {
        const v = a === u ? b : b === u ? a : -1;
        if (v >= 0 && d[u] + len(u, v) < d[v]) {
          d[v] = d[u] + len(u, v);
          prev[v] = u;
        }
      }
    }
    const out = [];
    for (let v = to; v >= 0 && v !== from; v = prev[v]) out.unshift(v);
    return out;
  }
  const nearest = () => R.hummocks.reduce((b, [hx, hy], i) => (Math.hypot(c.x - hx, c.y - hy) < Math.hypot(c.x - R.hummocks[b][0], c.y - R.hummocks[b][1]) ? i : b), 0);
  let goals = [];
  let lit = -1;
  let waited = 0;
  return function think() {
    if (c.lit !== lit) {
      lit = c.lit;
      const left = order.filter((h) => c.shrines[R.shrines.indexOf(h)] < lz.SHRINE_MS);
      goals = [...path(nearest(), left.length ? left[0] : 0).map((h) => R.hummocks[h].slice(0, 2)), left.length ? R.hummocks[left[0]].slice(0, 2) : R.boat];
    }
    if (goals.length > 1 && Math.hypot(goals[0][0] - c.x, goals[0][1] - c.y) < 1.5) goals.shift();
    const [gx, gy] = goals[0];
    let dx = gx - c.x;
    let dy = gy - c.y;
    let fire = false;
    let stop = false;
    if (smart) {
      if (c.wisps.some((w) => ["guard", "chase", "back", "roam"].includes(w.state) && Math.hypot(w.x - c.x, w.y - c.y) < 7) && c.oil >= lz.FLARE_OIL) fire = !round.input.fire;
      const H = c.mother.hand;
      if (H && H.state !== "rest" && Math.hypot(H.x - c.x, H.y - c.y) < lz.HAND_R + 2.5) {
        const sx = c.x - H.x || dx;
        const sy = c.y - H.y || dy;
        const m = Math.hypot(sx, sy) || 1;
        dx = sx / m;
        dy = sy / m;
      }
      const L = c.lurker;
      if (L.state === "hunt" && Math.hypot(L.x - c.x, L.y - c.y) < 18 && lz.onMoss(R, c.x, c.y) && waited < 3000 && !H) {
        stop = true;
        waited += 4;
      } else if (L.state !== "hunt") waited = 0;
      if (L.state === "aim" || L.state === "dash") {
        const lx = L.bx - L.ax;
        const ly = L.by - L.ay;
        const l = Math.hypot(lx, ly) || 1;
        const t = ((c.x - L.ax) * lx + (c.y - L.ay) * ly) / (l * l);
        const px = L.ax + lx * t;
        const py = L.ay + ly * t;
        if (t > -0.1 && t < 1.1 && Math.hypot(c.x - px, c.y - py) < 5) {
          const sx = c.x - px || -ly / l;
          const sy = c.y - py || lx / l;
          const m = Math.hypot(sx, sy) || 1;
          dx = sx / m;
          dy = sy / m;
          stop = false;
        }
      }
    }
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    Object.assign(round.input, stop ? { left: false, right: false, up: false, down: false } : { left: dx < -0.3 && ax > 0.35 * ay, right: dx > 0.3 && ax > 0.35 * ay, up: dy < -0.3 && ay > 0.35 * ax, down: dy > 0.3 && ay > 0.35 * ax });
    round.input.fire = fire;
  };
}
function playOut(round, opts, random = steady) {
  const think = makeBot(round, opts);
  const c = round.runner;
  const caught = [];
  let t = 0;
  while (round.phase === "play" && !c.done && t < 200000) {
    think();
    ghoul.advance(round, 4, random);
    for (const e of events(round, "lanternCatch")) caught.push(e.kind);
    round.events.length = 0;
    t += 4;
  }
  run(round, 200, {}, random);
  return { t, caught };
}
const ORDERS = [[2, 4, 6, 7, 8], [8, 7, 6, 4, 2], [2, 4, 8, 7, 6], [4, 2, 6, 8, 7]];

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Drowned Lantern is Gallows Bog's fourth room, between the Stilt House and the Drowning Pool: lit, no key, no boss, a bonus round on one fixed screen with a 90 second clock", () => {
  const st = ghoul.stageById("bog");
  assert.deepEqual(st.rooms, ["boardwalk", "hollow", "stilts", "lantern", "drowning"]);
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Drowned Lantern", "Keep the flame lit, and keep quiet"]);
  assert.equal(ROOM.bonus, true);
  assert.equal(ROOM.dark, false, "the room's own art is the night");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(R.runner, "lantern");
  assert.equal(R.time, lz.TIME_S * 1000);
  assert.equal(ghoul.timeFor(ROOM), R.time, "its own clock");
  assert.equal(ROOM.length, ghoul.FIELD_W, "one fixed screen: the camera never moves");
  assert.ok(ROOM.door < ROOM.length && ghoul.groundAt(ROOM, ROOM.door) > -Infinity, "a door with floor to stand at");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0 && ROOM.items.length === 0 && ROOM.candy.length === 0, "no monsters or pickups: the hunters are the pack's own");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.hummocks) && Object.isFrozen(R.hummocks[0]) && Object.isFrozen(R.lurker.route) && Object.isFrozen(R.wisps[0]), "frozen all the way down");
  assert.equal(ghoul.ROOM_MUSIC.lantern, "ghoulLanternTheme", "plays its own theme");
  assert.deepEqual(Object.keys(lz.LANTERN.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.lantern, LANTERN_LOOKS.lantern);
  assert.equal(LOOKS.lantern.pack, "lantern");
  assert.equal(R.shrines.length, lz.SHRINES);
});

test("Ghoul Rush's Drowned Lantern: the island fits the map and is all joined, every shrine stands on a hummock, the boat is in reach of the landing, the pool is open water", () => {
  for (const [x, y, r] of R.hummocks) assert.ok(x - r >= lz.MAP.x0 - 1 && x + r <= lz.MAP.x1 + 1 && y - r >= lz.MAP.y0 - 1 && y + r <= lz.MAP.y1 + 1, `hummock at ${x},${y}`);
  for (const [a, b] of R.planks) assert.ok(a !== b && R.hummocks[a] && R.hummocks[b], `plank ${a}-${b}`);
  assert.equal(reach().size, R.hummocks.length, "every hummock is joined to the landing");
  for (const h of R.shrines) assert.ok(R.hummocks[h], `shrine on hummock ${h}`);
  assert.equal(new Set(R.shrines).size, lz.SHRINES);
  assert.ok(!R.shrines.includes(0), "the landing is no shrine");
  assert.ok(lz.onMoss(R, ...R.start), "Planny starts on the landing's moss");
  assert.ok(Math.hypot(R.boat[0] - R.start[0], R.boat[1] - R.start[1]) < 8, "the boat is at the landing");
  const [lx, ly, lr] = R.hummocks[0];
  assert.ok(Math.hypot(R.boat[0] - lx, R.boat[1] - ly) - lr < lz.BOAT_R, "the landing's edge reaches the boat");
  assert.ok(!lz.onMoss(R, ...R.pool), "Mother's pool is no hummock");
});

test("Ghoul Rush's Drowned Lantern's tables: each shrine has one guardian wisp starting on its circle, the roamers sleep in Mother's pool till the third, fourth and fifth shrine, and every bog body lies in the water beside a plank", () => {
  const guards = R.wisps.filter((w) => w.shrine >= 0);
  assert.deepEqual(guards.map((w) => w.shrine).sort(), [0, 1, 2, 3, 4]);
  for (const w of guards) {
    const [sx, sy] = lz.shrineAt(R, w.shrine);
    assert.ok(Math.abs(Math.hypot(w.home[0] - sx, w.home[1] - sy) - lz.ORBIT_R) < 0.1, `wisp of shrine ${w.shrine} on its circle`);
  }
  const roam = R.wisps.filter((w) => w.shrine < 0);
  assert.deepEqual(roam.map((w) => w.wake), [3, 4, 5]);
  for (const w of roam) assert.deepEqual([...w.home], [...R.pool], "out of the pool");
  for (const [x, y] of R.bodies) {
    assert.ok(!lz.onIsland(R, x, y), `the body at ${x},${y} is in the water`);
    const d = onAxis(x, y);
    assert.ok(d < lz.BODY_NOTICE && d > lz.PLANK_HALF, `beside a plank (${d.toFixed(1)} from its middle)`);
  }
});

/* ------------------------------------------------------------- the walk */

test("Ghoul Rush's Drowned Lantern: the arrows walk Planny at WALK_V (two at once a diagonal) and never off the moss and planks; the walk slides along a crooked plank with one arrow", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  const [x0, y0] = R.start;
  assert.deepEqual([c.x, c.y], [x0, y0]);
  run(round, 400, { right: true });
  assert.ok(Math.abs(c.x - x0 - lz.WALK_V * 0.4) < 0.1, `right at WALK_V (${(c.x - x0).toFixed(2)})`);
  assert.equal(c.y, y0);
  assert.equal(c.fx, 1);
  // A diagonal is no faster.
  at(round, x0, y0);
  run(round, 300, { up: true, right: true });
  assert.ok(Math.abs(Math.hypot(c.x - x0, c.y - y0) - lz.WALK_V * 0.3) < 0.2, "diagonal at WALK_V");
  // Into the water: it stays on the island, wherever the keys push.
  for (const keys of [{ left: true }, { down: true }, { up: true, left: true }, { down: true, right: true }]) {
    at(round, x0, y0);
    run(round, 3000, keys);
    assert.ok(lz.onIsland(R, c.x, c.y), `still on the island (${JSON.stringify(keys)})`);
  }
  // UP alone from hummock 1 follows the leaning plank to hummock 3.
  at(round, ...R.hummocks[1].slice(0, 2));
  const onThree = () => Math.hypot(c.x - R.hummocks[3][0], c.y - R.hummocks[3][1]) < R.hummocks[3][2];
  round.input.up = true;
  until(round, onThree, 3000);
  round.input.up = false;
  assert.ok(onThree(), `on hummock 3 (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
  // RIGHT alone halfway along the plank from shrine 0 to shrine 1 slides up it to the end.
  const [ax, ay] = R.hummocks[2];
  const [bx, by] = R.hummocks[4];
  at(round, (ax + bx) / 2, (ay + by) / 2);
  const atFour = () => Math.hypot(c.x - bx, c.y - by) < R.hummocks[4][2];
  round.input.right = true;
  until(round, atFour, 2500);
  round.input.right = false;
  assert.ok(atFour(), `at the far end (${c.x.toFixed(1)}, ${c.y.toFixed(1)})`);
  // you.x follows; you.y stays on the room's floor.
  assert.equal(round.you.x, c.x);
  assert.equal(round.you.y, ghoul.groundAt(ROOM, c.x));
});

test("Ghoul Rush's Drowned Lantern: a step on the planks is heard (lanternStep every STEP_MS); the moss and a standstill are silent", () => {
  const round = quiet(lanternRound());
  const [ax, ay] = R.hummocks[1];
  const [bx, by] = R.hummocks[9];
  // Along the plank from hummock 1 to hummock 9.
  at(round, ax + R.hummocks[1][2] + 1, ay);
  run(round, 1000, { right: true });
  const steps = events(round, "lanternStep").length;
  assert.ok(steps >= Math.floor(1000 / lz.STEP_MS) && steps <= Math.ceil(1000 / lz.STEP_MS) + 1, `${steps} steps a second`);
  assert.ok(bx > ax && by === ay);
  // On the moss of a hummock: none.
  round.events.length = 0;
  at(round, R.start[0] - 3, R.start[1]);
  run(round, 500, { right: true });
  assert.equal(events(round, "lanternStep").length, 0);
  // Standing on a plank: none.
  at(round, ax + 9, ay);
  run(round, 1000, {});
  assert.equal(events(round, "lanternStep").length, 0);
});

/* -------------------------------------------------------- the flare, oil */

test("Ghoul Rush's Drowned Lantern: SPACE flares once a press (holding does not repeat): FLARE_OIL of oil, FLARE_CD_MS between, a sputter and no flare without the oil for one", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  at(round, ...R.start);
  const oil = c.oil;
  run(round, 8, { fire: true });
  assert.equal(events(round, "lanternFlare").length, 1);
  assert.ok(Math.abs(oil - c.oil - lz.FLARE_OIL) < 0.01);
  assert.ok(c.flare && c.flare.x === c.x, "a ring of light round Planny");
  run(round, 2000, { fire: true });
  assert.equal(events(round, "lanternFlare").length, 1, "held, it flares once");
  // A second press inside the cooldown does nothing; after it, flares.
  tap(round);
  run(round, 100, {});
  tap(round);
  assert.equal(events(round, "lanternFlare").length, 2);
  tap(round);
  assert.equal(events(round, "lanternFlare").length, 2, "inside FLARE_CD_MS");
  // Too little oil: a sputter, nothing spent.
  run(round, lz.FLARE_CD_MS, {});
  c.oil = lz.FLARE_OIL - 0.01;
  tap(round);
  assert.equal(events(round, "lanternFlare").length, 2);
  assert.equal(events(round, "lanternSputter").length, 1);
  assert.ok(c.oil > lz.FLARE_OIL - 0.02);
});

test("Ghoul Rush's Drowned Lantern: the oil burns down over OIL_MS and the light shrinks with it; out, the flame gutters (once, and the grade's steady hand is gone); a shrine fills it again", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  at(round, ...R.start);
  assert.equal(c.oil, 1);
  assert.equal(lz.lightOf(c), lz.LIGHT_MAX);
  run(round, lz.OIL_MS / 2, {});
  assert.ok(Math.abs(c.oil - 0.5) < 0.01);
  assert.ok(lz.lightOf(c) < lz.LIGHT_MAX && lz.lightOf(c) > lz.LIGHT_MIN);
  assert.equal(round.bonusRound.perf.steady, true);
  run(round, lz.OIL_MS / 2 + 100, {});
  assert.equal(c.oil, 0);
  assert.equal(c.gutter, true);
  assert.equal(lz.lightOf(c), lz.LIGHT_MIN);
  assert.equal(events(round, "lanternGutter").length, 1);
  assert.equal(round.bonusRound.perf.steady, false);
  run(round, 1000, {});
  assert.equal(events(round, "lanternGutter").length, 1, "once");
  // A shrine fills it.
  at(round, ...lz.shrineAt(R, 0).slice(0, 2));
  run(round, lz.SHRINE_MS + 50, {});
  assert.ok(c.oil > 0.99);
  assert.equal(c.gutter, false);
  // The light only grows with the oil.
  for (let k = 0; k < 10; k++) assert.ok(lz.lightR(k / 10) < lz.lightR((k + 1) / 10));
});

/* ----------------------------------------------------------- the shrines */

test("Ghoul Rush's Drowned Lantern: standing on a shrine's stone SHRINE_MS lights it (200 points, the oil full, its guardian laid to rest); the time is kept if you step off; a lit one stays lit", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  const [sx, sy] = lz.shrineAt(R, 0);
  at(round, sx, sy);
  c.oil = 0.5;
  run(round, lz.SHRINE_MS / 2, {});
  assert.equal(c.lit, 0);
  at(round, sx + lz.SHRINE_R + 1, sy);
  run(round, 500, {});
  assert.ok(c.shrines[0] >= lz.SHRINE_MS / 2 - 8, "the time is kept");
  const wisp = c.wisps.find((w) => R.wisps[w.i].shrine === 0);
  wisp.state = "guard";
  const score = round.score;
  at(round, sx, sy);
  run(round, lz.SHRINE_MS / 2 + 20, {});
  assert.equal(c.lit, 1);
  assert.equal(round.score - score, lz.SHRINE_POINTS);
  assert.equal(c.oil > 0.99, true);
  assert.equal(events(round, "lanternShrine").length, 1);
  assert.equal(events(round, "lanternShrine")[0].n, 1);
  assert.equal(wisp.state, "gone", "its guardian is laid to rest");
  run(round, 2000, {});
  assert.equal(c.lit, 1, "lit once");
});

test("Ghoul Rush's Drowned Lantern: the third shrine wakes Old Mother Bog, the fifth raises her (and sends the Lurker cowering); then the boat at the landing is the way out", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  R.shrines.forEach((h, i) => {
    at(round, ...R.hummocks[h].slice(0, 2));
    run(round, lz.SHRINE_MS + 50, {});
    assert.equal(c.lit, i + 1);
    assert.equal(c.mother.stir, i + 1, "her eyes open a fifth a shrine");
    if (i === 2) assert.equal(events(round, "lanternWake").length, 1);
  });
  assert.equal(c.mother.risen, true);
  assert.equal(events(round, "lanternRise").length, 1);
  assert.equal(c.lurker.state, "cower");
  assert.equal(c.done, false, "not out yet");
});

test("Ghoul Rush's Drowned Lantern: all five lit and Planny at the boat ends the round: the bonus ends won with 3 to 9 Lucky dice added, no heart or life lost; the boat does nothing before then", () => {
  const early = quiet(lanternRound());
  at(early, R.boat[0] + 1, R.boat[1]);
  run(early, 500, {});
  assert.equal(early.runner.done, false, "the boat waits for the five");
  const round = quiet(lanternRound());
  const c = round.runner;
  round.dice = 1;
  for (const h of R.shrines) {
    at(round, ...R.hummocks[h].slice(0, 2));
    run(round, lz.SHRINE_MS + 50, {});
  }
  at(round, ...R.start);
  walkTo(round, R.boat[0], R.boat[1], () => c.done);
  assert.equal(c.done, true);
  assert.equal(events(round, "lanternFinish").length, 1);
  assert.equal(round.hasKey, true);
  run(round, 200, {});
  assert.equal(round.phase, "clear");
  assert.equal(round.bonusRound.over, true);
  assert.equal(round.bonusRound.won, true);
  assert.ok(round.bonusRound.dice >= BONUS_FLOOR && round.bonusRound.dice <= ghoul.MAX_DICE, `${round.bonusRound.dice} dice`);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.lives, 3);
  assert.ok(round.dice > 1, "dice added to what was in hand");
  // A Planny put at the door (the suites' way through a room) finishes too.
  const door = quiet(lanternRound());
  door.you.x = ROOM.door;
  run(door, 100, {});
  assert.equal(door.runner.done, true);
});

/* ---------------------------------------------------------- the Lurker */

// A round with only the Lurker about, drifting at (x, y).
function lurkerRound(x, y) {
  const round = quiet(lanternRound());
  Object.assign(round.runner.lurker, { state: "drift", t: 0, x, y, wp: 0 });
  return round;
}
// Planny on the plank between hummocks 1 and 9 (y 44), x along it.
const PLANK_Y = R.hummocks[1][1];

test("Ghoul Rush's Drowned Lantern's Bog Lurker hears steps on wood within STEP_HEAR (not beyond, not on the moss, not standing still) and swims at LURKER_V to where it heard them", () => {
  const near = lurkerRound(38, PLANK_Y - lz.STEP_HEAR + 4);
  at(near, 34, PLANK_Y);
  run(near, 200, { right: true });
  assert.equal(near.runner.lurker.state, "hunt");
  assert.equal(events(near, "lanternLurkerCue").length, 1);
  const L = near.runner.lurker;
  assert.ok(Math.abs(L.ty - PLANK_Y) < 0.01, "it goes for where it heard the step");
  const d0 = Math.hypot(L.x - L.tx, L.y - L.ty);
  run(near, 400, {});
  assert.ok(Math.abs(d0 - Math.hypot(L.x - L.tx, L.y - L.ty) - lz.LURKER_V * 0.4) < 0.3, "at LURKER_V");
  // Too far to hear.
  const far = lurkerRound(85, 12);
  at(far, 34, PLANK_Y);
  run(far, 600, { right: true });
  assert.equal(far.runner.lurker.state, "drift");
  // On the moss.
  const moss = lurkerRound(R.start[0], R.start[1] - 12);
  at(moss, R.start[0] - 2, R.start[1]);
  run(moss, 600, { left: true });
  assert.equal(moss.runner.lurker.state, "drift");
  // Standing on a plank.
  const still = lurkerRound(38, PLANK_Y - 8);
  at(still, 34, PLANK_Y);
  run(still, 1000, {});
  assert.equal(still.runner.lurker.state, "drift");
});

test("Ghoul Rush's Drowned Lantern's Lurker hears a flare from anywhere and a shrine catching within SHRINE_HEAR", () => {
  const round = lurkerRound(88, 12);
  at(round, ...R.start);
  tap(round);
  assert.equal(round.runner.lurker.state, "hunt");
  assert.deepEqual([round.runner.lurker.tx, round.runner.lurker.ty], [R.start[0], R.start[1]]);
  const [sx, sy] = lz.shrineAt(R, 0);
  const shrine = lurkerRound(sx + lz.SHRINE_HEAR - 12, sy);
  at(shrine, sx, sy);
  run(shrine, lz.SHRINE_MS + 30, {});
  assert.equal(shrine.runner.lurker.state, "hunt");
  const deaf = lurkerRound(sx + lz.SHRINE_HEAR + 30, sy + 20);
  at(deaf, sx, sy);
  run(deaf, lz.SHRINE_MS + 30, {});
  assert.equal(deaf.runner.lurker.state, "drift");
});

test("Ghoul Rush's Drowned Lantern's Lurker strikes where it HEARD you: within AIM_FROM it lines up a lane through that spot (DASH_PAST beyond) for AIM_MS, then dashes: on the lane a heart (cause lanternLurker), just off it a close call (an act), then it rests deaf for REST_MS", () => {
  const setup = () => {
    const round = lurkerRound(20, PLANK_Y);
    at(round, 34, PLANK_Y);
    run(round, 20, { right: true });
    return round;
  };
  // Standing where it heard the step: caught.
  const round = setup();
  const L = round.runner.lurker;
  until(round, () => L.state === "aim", 4000);
  assert.equal(L.state, "aim");
  assert.ok(Math.hypot(L.x - L.tx, L.y - L.ty) <= lz.AIM_FROM + 0.1);
  assert.equal(events(round, "lanternAim").length, 1);
  const lane = Math.hypot(L.bx - L.ax, L.by - L.ay);
  assert.ok(Math.abs(lane - Math.hypot(L.tx - L.ax, L.ty - L.ay) - lz.DASH_PAST) < 0.1, "through the spot and DASH_PAST beyond");
  const t = until(round, () => L.state === "dash", 2000);
  assert.ok(Math.abs(t - lz.AIM_MS) <= 16, `aims AIM_MS (${t})`);
  until(round, () => L.state === "rest", 2000);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose")[0].cause, "lanternLurker");
  assert.equal(events(round, "lanternCatch")[0].kind, "lurker");
  // Stepped off the lane, just clear of it: a close call.
  const dodge = setup();
  const D = dodge.runner.lurker;
  until(dodge, () => D.state === "aim", 4000);
  at(dodge, dodge.runner.x, PLANK_Y - lz.DASH_HIT - 1.5);
  dodge.runner.y = PLANK_Y - lz.DASH_HIT - 1.5;
  until(dodge, () => D.state === "rest", 3000);
  assert.equal(dodge.bonusRound.hearts, 5);
  assert.equal(events(dodge, "lanternClose").length, 1);
  assert.equal(dodge.bonusRound.perf.acts, 1);
  // Resting, it hears nothing; then it drifts again.
  at(dodge, 34, PLANK_Y);
  run(dodge, 300, { left: true });
  assert.equal(D.state, "rest");
  run(dodge, lz.REST_MS, {});
  assert.equal(D.state, "drift");
});

/* ------------------------------------------------------------ the wisps */

// A round with only shrine 0's guardian awake.
function guardRound() {
  const round = quiet(lanternRound());
  const w = round.runner.wisps.find((q) => R.wisps[q.i].shrine === 0);
  Object.assign(w, { state: "guard", x: R.wisps[w.i].home[0], y: R.wisps[w.i].home[1] });
  return { round, w };
}

test("Ghoul Rush's Drowned Lantern's guardian wisps circle their shrine at ORBIT_R, rush a lantern within GUARD_SENSE (while it is within LEASH of the shrine) at WISP_V, and have you at WISP_CATCH (a heart, cause lanternWisp)", () => {
  const { round, w } = guardRound();
  const [sx, sy] = lz.shrineAt(R, 0);
  at(round, ...R.start);
  run(round, 1500, {});
  assert.equal(w.state, "guard");
  assert.ok(Math.abs(Math.hypot(w.x - sx, w.y - sy) - lz.ORBIT_R) < 0.05, "on its circle");
  // Near: it comes.
  at(round, w.x, w.y + lz.GUARD_SENSE - 1);
  const d0 = dist(w, round.runner);
  run(round, 200, {});
  assert.equal(w.state, "chase");
  assert.ok(Math.abs(d0 - dist(w, round.runner) - lz.WISP_V * 0.2) < 0.2, "at WISP_V");
  until(round, () => round.bonusRound.hearts < 5, 4000);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose")[0].cause, "lanternWisp");
  assert.equal(w.state, "popped", "it bursts on you");
  // Out of the leash it goes home.
  const back = guardRound();
  at(back.round, sx, sy + lz.GUARD_SENSE - 4);
  run(back.round, 100, {});
  assert.equal(back.w.state, "chase");
  at(back.round, sx + lz.LEASH + 6, sy + 10);
  run(back.round, 3000, {});
  assert.equal(back.w.state, "guard");
});

test("Ghoul Rush's Drowned Lantern: a flare bursts every wisp within FLARE_R (an act and 80 points each, more at once is a combo), not one beyond; a burst guardian comes back after WISP_REFORM_MS unless its shrine is lit", () => {
  const { round, w } = guardRound();
  const c = round.runner;
  const other = c.wisps.find((q) => R.wisps[q.i].shrine === 1);
  Object.assign(other, { state: "guard" });
  at(round, w.x + lz.FLARE_R - 1, w.y);
  const acts = round.bonusRound.perf.acts;
  const score = round.score;
  tap(round);
  assert.equal(w.state, "popped");
  assert.equal(round.bonusRound.perf.acts, acts + 1);
  assert.equal(round.score - score, lz.POP_POINTS);
  assert.ok(dist(other, c) > lz.FLARE_R && other.state === "guard", "one beyond is untouched");
  at(round, ...R.start);
  run(round, lz.WISP_REFORM_MS + 50, {});
  assert.equal(w.state, "guard", "back on its circle");
  // Two at once.
  const pair = guardRound();
  const q = pair.round.runner.wisps.find((x) => R.wisps[x.i].shrine === 1);
  Object.assign(q, { state: "chase", x: pair.w.x + 2, y: pair.w.y });
  at(pair.round, pair.w.x + 1, pair.w.y + 2);
  tap(pair.round);
  assert.equal(events(pair.round, "lanternPop").filter((e) => e.combo === 2).length, 1);
  // Its shrine lit while it is gone: it never comes back.
  const gone = guardRound();
  at(gone.round, gone.w.x, gone.w.y);
  tap(gone.round);
  at(gone.round, ...lz.shrineAt(R, 0).slice(0, 2));
  run(gone.round, lz.SHRINE_MS + lz.WISP_REFORM_MS, {});
  assert.equal(gone.w.state, "gone");
});

test("Ghoul Rush's Drowned Lantern's roaming wisps sleep in Mother's pool until their shrine count, then drift after a lantern within ROAM_SENSE", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  const roam = c.wisps.filter((w) => R.wisps[w.i].shrine < 0);
  for (const w of roam) w.state = "asleep";
  at(round, ...R.start);
  run(round, 500, {});
  assert.ok(roam.every((w) => w.state === "asleep"));
  c.lit = 3;
  run(round, 20, {});
  assert.deepEqual(roam.map((w) => w.state === "asleep"), [false, true, true]);
  assert.ok(Math.hypot(roam[0].x - R.pool[0], roam[0].y - R.pool[1]) < 1, "out of the pool");
  at(round, roam[0].x + lz.ROAM_SENSE - 2, roam[0].y);
  run(round, 100, {});
  assert.equal(roam[0].state, "chase");
});

/* ------------------------------------------------------------ the leeches */

function leechRound(x, y) {
  const round = quiet(lanternRound());
  round.runner.leeches.push({ i: 0, x, y, wp: 0, state: "drift", t: 0, cue: 0 });
  return round;
}

test("Ghoul Rush's Drowned Lantern's leeches never enter the light: they wait at its edge however long you stand, and follow it as it shrinks", () => {
  const round = leechRound(R.start[0] + 20, R.start[1] - 4);
  const c = round.runner;
  const S = c.leeches[0];
  at(round, ...R.start);
  let nearest = Infinity;
  for (let k = 0; k < 40; k++) {
    run(round, 250, {});
    if (k > 4) nearest = Math.min(nearest, dist(S, c) - lz.lightOf(c));
  }
  assert.ok(nearest >= 0, `never inside the light (${nearest.toFixed(2)})`);
  assert.equal(S.state, "stalk");
  assert.ok(dist(S, c) - lz.lightOf(c) < 2, "at its edge");
  assert.equal(round.bonusRound.hearts, 5);
});

test("Ghoul Rush's Drowned Lantern's leeches: once the flame gutters they swarm in and bite (a heart, cause lanternLeech; Planny fans the flame back to OIL_AFTER_BITE and they scatter); a flare scatters them for SCATTER_MS", () => {
  const round = leechRound(R.start[0] + 16, R.start[1] - 4);
  const c = round.runner;
  at(round, ...R.start);
  run(round, 2000, {});
  c.oil = 0.001;
  until(round, () => round.bonusRound.hearts < 5, 6000);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose")[0].cause, "lanternLeech");
  assert.ok(Math.abs(c.oil - lz.OIL_AFTER_BITE) < 0.01);
  assert.equal(c.leeches[0].state, "scatter");
  // A flare.
  const lit = leechRound(R.start[0] + 16, R.start[1] - 4);
  at(lit, ...R.start);
  run(lit, 2000, {});
  const d0 = dist(lit.runner.leeches[0], lit.runner);
  tap(lit);
  assert.equal(lit.runner.leeches[0].state, "scatter");
  run(lit, lz.SCATTER_MS - 100, {});
  assert.ok(dist(lit.runner.leeches[0], lit.runner) > d0 + 10, "driven off");
  run(lit, 200, {});
  assert.notEqual(lit.runner.leeches[0].state, "scatter");
});

/* ------------------------------------------------------------- the bodies */

function bodyRound(i = 0) {
  const round = quiet(lanternRound());
  round.runner.bodies.push({ x: R.bodies[i][0], y: R.bodies[i][1], state: "sunk", t: 0 });
  return round;
}

test("Ghoul Rush's Drowned Lantern's bog bodies take only someone standing still: a walk right past never wakes one; stand within BODY_NOTICE for BODY_STILL_MS and it boils for BODY_RISE_MS, then takes what is within BODY_REACH (cause lanternBody)", () => {
  // Body 0 lies beside the plank from the landing to shrine 0: walk the plank past it.
  const walk = bodyRound(0);
  at(walk, ...R.hummocks[0].slice(0, 2));
  walkTo(walk, ...R.hummocks[2].slice(0, 2));
  assert.equal(walk.runner.bodies[0].state, "sunk", "a walk past never wakes it");
  assert.equal(walk.bonusRound.hearts, 5);
  assert.equal(events(walk, "lanternBodyCue").length, 0);
  // Standing still beside it: it rises and takes you.
  const round = bodyRound(0);
  const B = round.runner.bodies[0];
  at(round, B.x - 2, B.y);
  run(round, lz.BODY_STILL_MS + 20, {});
  assert.equal(B.state, "rise");
  assert.equal(events(round, "lanternBodyCue").length, 1);
  run(round, lz.BODY_RISE_MS + 40, {});
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose")[0].cause, "lanternBody");
  assert.equal(B.state, "rest");
  // Woken, then walked out of reach while it rises: nothing taken.
  const away = bodyRound(0);
  const A = away.runner.bodies[0];
  at(away, A.x - 2, A.y);
  run(away, lz.BODY_STILL_MS + 20, {});
  assert.equal(A.state, "rise");
  run(away, lz.BODY_RISE_MS + lz.BODY_UP_MS, { up: true });
  assert.equal(away.bonusRound.hearts, 5);
  assert.ok(dist(A, away.runner) > lz.BODY_REACH);
  run(away, lz.BODY_REST_MS + 100, {});
  assert.equal(A.state, "sunk", "and it sinks back to wait");
});

/* --------------------------------------------------------- Old Mother Bog */

function motherRound(lit) {
  const round = quiet(lanternRound());
  round.hush = false;
  const c = round.runner;
  c.lit = lit;
  c.mother.stir = lit;
  return round;
}

test("Old Mother Bog in the Drowned Lantern sleeps until the third shrine (or MOTHER_LATE_S); then her hand's shadow follows you HAND_TRACK_MS, stops and reddens HAND_LOCK_MS, and slams: standing still a heart (cause lanternMother), walking on a miss", () => {
  const asleep = motherRound(2);
  at(asleep, ...R.start);
  run(asleep, 20000, {});
  assert.equal(events(asleep, "lanternHand").length, 0, "nothing before the third");
  // Late in the round she wakes anyway.
  clockAt(asleep, lz.MOTHER_LATE_S * 1000);
  asleep.runner.oil = 1;
  run(asleep, lz.MOTHER_GAP[3] + 100, {});
  assert.equal(events(asleep, "lanternHand").length, 1, "awake late");
  // Standing still.
  const round = motherRound(3);
  const c = round.runner;
  at(round, ...R.start);
  until(round, () => c.mother.hand, lz.MOTHER_GAP[3] + 100);
  assert.equal(c.mother.hand.state, "track");
  assert.equal(events(round, "lanternMeet").filter((e) => e.kind === "mother").length, 1);
  const t = until(round, () => c.mother.hand.state === "lock", 3000);
  assert.ok(Math.abs(t - lz.HAND_TRACK_MS) <= 8);
  until(round, () => events(round, "lanternSlam").length > 0, 1000);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose")[0].cause, "lanternMother");
  // Walking along the planks, a miss (and a close call when it was near).
  const walk = motherRound(3);
  const w = walk.runner;
  at(walk, ...R.hummocks[1].slice(0, 2));
  until(walk, () => w.mother.hand, lz.MOTHER_GAP[3] + 100);
  walkTo(walk, ...R.hummocks[9].slice(0, 2));
  walkTo(walk, ...R.hummocks[8].slice(0, 2), () => events(walk, "lanternSlam").length > 0);
  until(walk, () => events(walk, "lanternSlam").length > 0, 2000);
  assert.equal(walk.bonusRound.hearts, 5, "kept moving, missed");
});

test("Old Mother Bog in the Drowned Lantern: the gap between hands shrinks with the shrines (MOTHER_GAP), and once she has risen they come one after another", () => {
  const gaps = (lit, risen) => {
    const round = motherRound(lit);
    const c = round.runner;
    if (risen) Object.assign(c.mother, { risen: true, gap: 1 });
    at(round, ...R.start);
    const seen = [];
    for (let t = 0; t < 40000; t += 4) {
      // Planny blinks safe for good, so the slams cost nothing and the cycle runs on.
      round.you.safeMs = 1e9;
      ghoul.advance(round, 4, steady);
      if (events(round, "lanternHand").length) seen.push(t);
      round.events.length = 0;
    }
    return seen.slice(1).map((t, i) => t - seen[i]);
  };
  const cycle = lz.HAND_TRACK_MS + lz.HAND_LOCK_MS + lz.HAND_REST_MS;
  const three = gaps(3, false);
  const four = gaps(4, false);
  const risen = gaps(5, true);
  assert.ok(Math.abs(three[1] - (cycle + lz.MOTHER_GAP[3])) <= 12, `${three[1]}`);
  assert.ok(Math.abs(four[1] - (cycle + lz.MOTHER_GAP[4])) <= 12, `${four[1]}`);
  assert.ok(Math.abs(risen[1] - (lz.HAND_TRACK_RISEN_MS + lz.HAND_LOCK_MS + lz.HAND_REST_MS + lz.MOTHER_RISEN_GAP)) <= 12, `${risen[1]}`);
  assert.ok(risen[1] < four[1] && four[1] < three[1]);
});

/* ----------------------------------------------------------- hearts, grade */

// Each hunter put on Planny, ready to take him this slice.
function onYou(round, kind) {
  const c = round.runner;
  const [x, y] = [34, PLANK_Y];
  at(round, x, y);
  if (kind === "lurker") Object.assign(c.lurker, { state: "dash", x: x - 3, y, ax: x - 3, ay: y, bx: x + 4, by: y, near: Infinity });
  if (kind === "leech") {
    c.oil = 0;
    c.gutter = true;
    c.leeches.push({ i: 0, x: x + 1, y, wp: 0, state: "swarm", t: 0, cue: 0 });
  }
  if (kind === "wisp") Object.assign(c.wisps[0], { state: "chase", x: x + 1, y });
  if (kind === "body") c.bodies.push({ x: x + 1, y: y - 2, state: "up", t: 500 });
  if (kind === "mother") {
    round.hush = false;
    c.lit = 3;
    c.mother.hand = { x, y, state: "lock", t: 4 };
  }
}

test("Ghoul Rush's Drowned Lantern: every hunter's catch costs exactly one heart, never a life, and leaves Planny where he stood, blinking safe so a second catch is free; the last heart gone ends the round with nothing, the dice in hand untouched", () => {
  for (const kind of lz.HUNTERS) {
    const round = quiet(lanternRound());
    const b = round.bonusRound;
    onYou(round, kind);
    const [x, y] = [round.runner.x, round.runner.y];
    run(round, 12, {});
    assert.equal(b.hearts, 4, `${kind}: one heart`);
    assert.equal(round.lives, 3, `${kind}: no life`);
    assert.equal(events(round, "lose").length, 1, `${kind}: one loss`);
    assert.equal(events(round, "lose")[0].cause, lz.CAUSES[kind]);
    assert.deepEqual([round.runner.x, round.runner.y], [x, y], `${kind}: not moved`);
    assert.ok(round.you.safeMs > BONUS_SAFE_MS - 100, "blinking safe");
    assert.ok(b.perf.hits.includes(kind));
    assert.equal(round.phase, "play", "the round plays on");
  }
  const round = quiet(lanternRound());
  const b = round.bonusRound;
  onYou(round, "wisp");
  run(round, 12, {});
  onYou(round, "body");
  run(round, 12, {});
  assert.equal(b.hearts, 4, "the blink took the second");
  // The last heart.
  const last = quiet(lanternRound());
  last.dice = 4;
  last.bonusRound.hearts = 1;
  onYou(last, "wisp");
  run(last, 12, {});
  assert.equal(last.bonusRound.hearts, 0);
  run(last, 4000, {});
  assert.equal(last.bonusRound.won, false);
  assert.equal(last.bonusRound.dice, 0);
  assert.equal(last.dice, 4, "the dice in hand are untouched");
  assert.equal(last.lives, 3, "no run life");
});

test("Ghoul Rush's Drowned Lantern: endless lives (round.infinite) spare the hearts for every hunter, and the Garlic shield takes a catch instead of a heart", () => {
  for (const kind of lz.HUNTERS) {
    const round = quiet(lanternRound());
    round.infinite = true;
    onYou(round, kind);
    run(round, 12, {});
    assert.equal(round.bonusRound.hearts, 5, kind);
  }
  const round = quiet(lanternRound());
  round.you.garlic = true;
  onYou(round, "wisp");
  run(round, 12, {});
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false);
});

test("Ghoul Rush's Drowned Lantern's grade: total is the five kinds that can take you, a hit is a kind that did, the acts are wisps burst by a flare and close calls (ACTS_GOAL is the die), steady falls when the flame gutters; the dice follow ghoul-bonus.js", () => {
  const round = quiet(lanternRound());
  const b = round.bonusRound;
  assert.equal(b.perf.total, 5);
  assert.equal(b.perf.goal, lz.ACTS_GOAL);
  assert.deepEqual(b.perf.hits, []);
  assert.equal(b.perf.steady, true);
  // A clean, sharp run: every die.
  b.perf.acts = lz.ACTS_GOAL;
  assert.equal(diceFor(b), ghoul.MAX_DICE);
  // Two kinds took a heart each, the flame guttered, few acts.
  Object.assign(b, { hearts: 3 });
  Object.assign(b.perf, { hits: ["wisp", "lurker"], acts: 2, steady: false });
  assert.equal(diceFor(b), BONUS_FLOOR + 1 + 1);
  // Just made it: the floor.
  Object.assign(b, { hearts: 1 });
  b.perf.hits = [...lz.HUNTERS];
  assert.equal(diceFor(b), BONUS_FLOOR);
});

test("Ghoul Rush's Drowned Lantern's clock is the room's: at nought the round is lost (no life, no dice), unless endless lives start it again", () => {
  const round = quiet(lanternRound());
  round.dice = 2;
  round.timeMs = 30;
  run(round, 100, {});
  run(round, 4000, {});
  assert.equal(round.bonusRound.won, false);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  const endless = quiet(lanternRound());
  endless.infinite = true;
  endless.timeMs = 30;
  run(endless, 100, {});
  assert.equal(endless.phase, "play");
  assert.ok(endless.timeMs > R.time - 200, "the clock starts again");
});

/* ------------------------------------------------------- the whole round */

test("Ghoul Rush's Drowned Lantern draws no random number (every hunter, flare, catch and the finish on a draw that throws), and the same keys give the same round", () => {
  const a = lanternRound();
  const b = lanternRound();
  playOut(a, { smart: true }, never);
  playOut(b, { smart: true }, never);
  const keep = (r) => JSON.stringify({ c: r.runner, s: r.score, h: r.bonusRound.hearts, t: r.timeMs });
  assert.equal(keep(a), keep(b));
  assert.equal(a.bonusRound.over, true, "played to the end");
  const saved = Math.random;
  Math.random = never;
  try {
    for (const opts of [{}, { smart: true, order: ORDERS[1] }]) playOut(lanternRound(), opts, never);
  } finally {
    Math.random = saved;
  }
});

test("Ghoul Rush's Drowned Lantern is fair and has teeth: a bot that walks to every shrine ignoring the hunters loses all five hearts, one that flares the wisps, keeps off the Lurker's lane and out of Mother's shadow wins with hearts to spare, whatever the shrines' order", () => {
  for (const order of ORDERS) {
    const dumb = lanternRound();
    const lost = playOut(dumb, { order });
    assert.equal(dumb.bonusRound.won, false, `${order}: the careless walk is lost`);
    assert.equal(dumb.bonusRound.hearts, 0);
    assert.ok(lost.caught.length >= 5);
    assert.equal(dumb.lives, 3, "no run life");
    const sharp = lanternRound();
    const won = playOut(sharp, { smart: true, order });
    assert.equal(sharp.bonusRound.won, true, `${order}: the careful run wins (${won.caught})`);
    assert.ok(sharp.bonusRound.hearts >= 3, `${order}: ${sharp.bonusRound.hearts} hearts left`);
    assert.ok(won.t / 1000 > 25 && won.t / 1000 < 65, `${order}: ${(won.t / 1000).toFixed(1)} s, with time to spare`);
    assert.ok(sharp.bonusRound.dice >= 7, `${order}: ${sharp.bonusRound.dice} dice`);
  }
});

test("Ghoul Rush's Drowned Lantern names each hunter's rule once, the first time it comes near (lanternMeet), and lists what a banner must keep clear of", () => {
  const round = lanternRound();
  playOut(round, { smart: true });
  const again = lanternRound();
  const think = makeBot(again, { smart: true });
  const met = [];
  for (let t = 0; t < 60000 && again.phase === "play" && !again.runner.done; t += 4) {
    think();
    ghoul.advance(again, 4, steady);
    met.push(...events(again, "lanternMeet").map((e) => e.kind));
    again.events.length = 0;
  }
  assert.equal(new Set(met).size, met.length, "each once");
  for (const kind of met) assert.ok(TAGS[kind], `${kind} has its rule`);
  assert.ok(met.includes("lurker") && met.includes("wisp") && met.includes("mother"));
  // The banner's marks: Planny (y counted up), and a wisp near him.
  const m = lanternRound();
  const c = m.runner;
  at(m, 30, 20);
  Object.assign(c.wisps[1], { state: "guard" });
  run(m, 20, {});
  assert.deepEqual(c.marks[0].map(Math.round), [30, 34]);
  assert.equal(ghoul.underBanner(m, 54 - 34 - 2), true, "Planny in a banner's strip");
});

test("Ghoul Rush's Drowned Lantern's hums: the Lurker growls louder as it nears and hunts, Mother breathes once awake; every hum is one the engine has", () => {
  const round = quiet(lanternRound());
  const c = round.runner;
  at(round, ...R.start);
  Object.assign(c.lurker, { state: "drift", x: R.start[0] + 30, y: R.start[1] });
  const far = lz.lanternHums(round).find((h) => h[0] === "ghoul:lurker");
  Object.assign(c.lurker, { state: "hunt", x: R.start[0] + 8 });
  const near = lz.lanternHums(round).find((h) => h[0] === "ghoul:lurker");
  assert.ok(near[2] > far[2] && near[3] > far[3]);
  assert.equal(lz.lanternHums(round).some((h) => h[0] === "ghoul:mother"), false);
  c.mother.risen = true;
  assert.ok(lz.lanternHums(round).some((h) => h[0] === "ghoul:mother" && h[2] > 0.5));
  for (const h of lz.lanternHums(round)) assert.ok(humNames().includes(h[1]), h[1]);
  c.lurker.state = "cower";
  assert.equal(lz.lanternHums(round).some((h) => h[0] === "ghoul:lurker"), false, "a cowering Lurker is quiet");
});

/* ------------------------------------------------------------ voices, art */

test("Ghoul Rush's Drowned Lantern: every event has a voice that plays, every cause has words and a sound, the tones exist and are short, and each hunter sounds its own", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...lz.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = LANTERN_VOICES[kind] && LANTERN_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    assert.ok(heard({ type: event, kind: "wisp", points: 80, n: 2 }).played.includes(name), `${event} plays ${name}`);
  }
  for (const [name, def] of Object.entries(LANTERN_SFX.tones)) {
    assert.ok(tones[name], name);
    assert.ok(name.startsWith("ghoulLantern"), name);
    for (const l of def.layers) assert.ok(l.seconds > 0 && l.seconds + (l.delay || 0) <= 1.2 && (l.gain === undefined || (l.gain > 0 && l.gain <= 1)), `${name} is short and sane`);
  }
  for (const name of Object.keys(LANTERN_SFX.hums)) assert.ok(humNames().includes(name), name);
  assert.deepEqual(Object.keys(LANTERN_SFX.music), ["ghoulLanternTheme"], "its first-draft theme, until a pick is wired in");
  for (const cause of Object.values(lz.CAUSES)) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  const cues = ["lanternLurkerCue", "lanternLeechCue", "lanternWispCue", "lanternBodyCue", "lanternHand"].map((t) => heard({ type: t }).played[0]);
  assert.equal(new Set(cues).size, 5, "one distinct cue each");
  for (const kind of lz.HUNTERS) assert.ok(TAGS[kind] && TAGS[kind].length <= 26, `${kind}'s rule fits`);
});

test("Ghoul Rush's Drowned Lantern: the room's own names do not collide with the game's (events, voice kinds)", () => {
  for (const e of lz.EVENTS) assert.ok(e.startsWith("lantern"), e);
  for (const kind of Object.keys(LANTERN_VOICES)) assert.ok(kind.startsWith("lantern"), kind);
  assert.deepEqual(Object.keys(lz.LANTERN).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(ghoul.roomById("lantern").ride.runner, "lantern");
});

test("Ghoul Rush's Drowned Lantern's intro banner says the controls and the goal plainly", () => {
  assert.match(R.how, /ARROWS walk/);
  assert.match(R.how, /SPACE flares/);
  assert.match(R.how, /5 shrines/);
  assert.match(R.how, /boat/);
  assert.ok(R.how.length <= 72, `${R.how.length} characters`);
  assert.ok(!R.how.includes(String.fromCharCode(0x2014)), "no em dash");
});

test("Ghoul Rush's Drowned Lantern draws: every hunter in each state, the flare, the oil low and out, a catch's blink, Mother asleep, stirring, risen and her hand, the run to the boat and the cards, with and without a dark layer, and no blaster gauge", () => {
  const saved = Math.random;
  for (const darkLayer of [true, false]) {
    const base = { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) };
    const ctx = new Proxy(darkLayer ? { getTransform: () => ({ a: 8 }) } : {}, base);
    const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    g.resize(900, 900);
    g.key("action");
    g.tick(16);
    const r = g.round;
    ghoul.setupRoom(r, "lantern");
    r.phase = "play";
    r.lives = 99;
    g.tick(16);
    assert.equal(g.hud.gauge, null, "no blaster here");
    const c = r.runner;
    assert.ok(c, "the room's state is in the shared slot");
    Math.random = never;
    try {
      const L = c.lurker;
      for (const state of ["drift", "hunt", "aim", "dash", "rest", "cower"]) {
        Object.assign(L, { state, t: 300, tx: 30, ty: 40, ax: 20, ay: 40, bx: 40, by: 40 });
        r.events.length = 0;
        // (Drawn without a tick, so the rules do not move it on first.)
        g.resize(900, 900);
      }
      Object.assign(c.leeches[0], { x: 40, y: 30, state: "stalk" });
      Object.assign(c.leeches[1], { x: 60, y: 30, state: "scatter" });
      Object.assign(c.leeches[2], { x: 20, y: 30, state: "swarm" });
      for (const [i, state] of ["guard", "chase", "back", "popped", "gone", "roam", "asleep", "chase"].entries()) Object.assign(c.wisps[i], { state });
      for (const [i, state] of ["sunk", "rise", "up", "rest", "sunk"].entries()) Object.assign(c.bodies[i], { state, t: 300 });
      c.flare = { x: c.x, y: c.y, t: 400 };
      c.shrines[0] = lz.SHRINE_MS;
      c.shrines[1] = 700;
      c.lit = 1;
      for (const oil of [1, 0.2, 0]) {
        c.oil = oil;
        c.gutter = oil === 0;
        g.resize(900, 900);
      }
      for (const [stir, risen, hand] of [[0, false, null], [3, false, { x: 30, y: 40, state: "track", t: 500 }], [4, false, { x: 30, y: 40, state: "lock", t: 200 }], [5, true, { x: 30, y: 40, state: "rest", t: 200 }]]) {
        Object.assign(c.mother, { stir, risen, riseT: risen ? 600 : 0, hand });
        c.lit = stir;
        g.resize(900, 900);
      }
      r.you.safeMs = 500;
      g.resize(900, 900);
      // The events through a real tick (the engine's own lightning and footsteps may draw a random number), then drawn.
      Math.random = saved;
      for (const e of lz.EVENTS) r.events.push({ type: e, x: 40, y: 30, kind: "lurker", n: 2, points: 80, combo: e === "lanternPop" ? 2 : undefined });
      g.tick(16);
      g.tick(1500);
      Math.random = never;
      g.resize(900, 900);
      Math.random = saved;
      r.phase = "clear";
      r.phaseMs = 1200;
      g.tick(16);
    } finally {
      Math.random = saved;
    }
  }
});
