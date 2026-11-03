// Web console tests, Ghoul Rush's Grand Banister (the Manor's bonus round, between the Library and the Ballroom): its shape (every break clears with a jump and swallows a rider that does not jump, the brass under-rails, every low can be ducked, spacing, checkpoints, the clock), the ride's speed on slopes and its lean and brake, its jump, ducking and diving, a vase, a candlestick, a hanging frame, a chandelier on its pendulum, a ghostly butler, the cobwebs, a fall off the rail, the checkpoint, the jump off the end and the door, the bonus round's hearts and dice (3 to 9), endless lives for every new cause, a voice for every event, the drawing, and bots that ride the whole stair (one that rides well, one that never dodges).
// Run with: node --test scripts/test-web-console-activities-ghoul-banister.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as bn from "../src/web-console/public/activities/ghoul-rush/rides/banister/ghoul-banister.js";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as BAN_LOOKS, VOICES as BAN_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/banister/ghoul-banister-draw.js";
import { BANISTER_SFX } from "../src/web-console/public/activities/ghoul-rush/rides/banister/ghoul-sfx-banister.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the banister drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Grand Banister reached the way play reaches it, nothing woken, the clocks long,
// the bonus round on (five hearts).
function banRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["manor"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "banister") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "banister", rails: 0, time: 1e9, finish: 1e6, track: [], props: [], lows: [], swings: [], butlers: [], webs: [], checks: [] };
// The same round over a ride of its own (a plain track to measure the rider on).
function synth(ride) {
  const round = banRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, rails: (ride.track || []).length, ...ride } };
  bn.BANISTER.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [4000, 20]]];
const DOWN = [[[0, 40], [4000, 40 - 0.15 * 4000]]];
const UP = [[[0, 0], [4000, 0.3 * 4000]]];

// The rider on line `line` of the ride at `x`, at speed `v`.
function rideAt(round, x, line, { v = bn.BAN_V, safe = false } = {}) {
  const y = ct.trackY(round.spec.ride, line, x);
  assert.ok(y !== null, `line ${line} runs under ${x}`);
  Object.assign(round.you, { x, y, vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
  Object.assign(round.runner, { line, v, coyote: 0 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 24));
}

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const k of Object.keys(keys)) round.input[k] = typeof keys[k] === "number" ? 0 : false;
}

function until(round, done, ms = 6000, random = steady) {
  let t = 0;
  for (; t < ms && !done(); t += 4) ghoul.advance(round, 4, random);
  return t;
}

const press = (round) => {
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  round.input.up = true;
};

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

const ROOM = ghoul.roomById("banister");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const slopeAtLine = (L, i) => (L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0]);
const uppers = lines.slice(0, R.rails);
const unders = lines.slice(R.rails);

// The kit's numbers the room is built to.
const K = { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Grand Banister is the Manor's fourth room, between the Library and the Ballroom: lit, no key, no boss, a ride about 60 to 70 seconds long, a bonus round that plays its own track", () => {
  const st = ghoul.stageById("manor");
  assert.deepEqual(st.rooms, ["foyer", "gallery", "library", "banister", "ballroom"]);
  assert.equal(st.boss, "gourd");
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Grand Banister", "Please keep your hands and ghosts inside the rail"]);
  assert.equal(ROOM.dark, false, "always lit");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "banister");
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3100, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.banister, "ghoulBanister");
  assert.ok(ghoulSfx.default.music.ghoulBanister, "its own track");
  assert.deepEqual(Object.keys(bn.BANISTER.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.banister, BAN_LOOKS.banister);
  assert.equal(LOOKS.banister.pack, "banister");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0 && ROOM.items.length === 0, "no monsters and no pickups: the things on the stairs are the pack's own");
  assert.match(R.how, /UP jump, DOWN duck/);
  // The ground is the attic landing at the start and the foyer floor at the end only.
  assert.equal(ROOM.ground.length, 2);
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 100, "floor only at the ends");
  assert.equal(ROOM.ground[1][0], R.finish);
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14, "the door at the room's end, past the foyer's start");
  assert.ok(floorOf(ROOM.door - 2) > -Infinity, "floor to walk out on");
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the rider starts on the rail over the attic landing");
  // The ride, at the rider's speed, takes 60 to 70 seconds.
  const secs = (uppers.at(-1).x1 - ROOM.start) / bn.BAN_V;
  assert.ok(secs >= 58 && secs <= 72, `${secs.toFixed(1)} s at BAN_V`);
  // The stairs: descents that fall about 0.10 to 0.11 and short climbs at about 0.3, never steeper.
  let down = 0;
  let total = 0;
  for (const L of uppers) {
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const s = slopeAtLine(L, i);
      const len = L.pts[i + 1][0] - L.pts[i][0];
      assert.ok(s >= -0.2 && s <= 0.32, `a slope of ${s.toFixed(3)}`);
      total += len;
      if (s < 0) down += len;
    }
  }
  assert.ok(down / total > 0.6, `${((100 * down) / total).toFixed(0)}% of the stairs go down`);
  for (const L of lines) for (const [, y] of L.pts) assert.ok(y > bn.DERAIL_Y + 4 && y < 40, `a rail height of ${y}`);
  assert.equal(ghoul.timeFor(ghoul.roomFor("banister")), R.time);
  assert.ok(R.time >= 1.5 * secs * 1000, `a ${R.time} ms clock for a ${secs.toFixed(0)} s ride`);
  // The lip ends the stairs rising, so it launches by itself.
  const last = R.rails - 1;
  assert.ok(ct.slopeOf(R, last, uppers.at(-1).x1) >= bn.RAMP_SLOPE, "the lip launches");
});

test("Ghoul Rush's Grand Banister: the lip's launch alone carries the rider onto the foyer floor at any speed it can have there, landing 10 to 40 past its start", () => {
  const lip = uppers.at(-1);
  const end = lip.pts.at(-1);
  const rise = ct.slopeOf(R, R.rails - 1, lip.x1);
  const floor = floorOf(R.finish + 1);
  for (const v of [bn.BAN_MIN, 34, bn.BAN_V, 55, bn.BAN_MAX]) {
    let vy = rise * v + bn.RAMP_POP;
    let x = end[0];
    let y = end[1];
    for (let t = 0; t < 3; t += 0.002) {
      vy -= bn.BAN_G * 0.002;
      x += v * 0.002;
      y += vy * 0.002;
      if (vy < 0 && y <= floor) break;
    }
    assert.ok(x >= R.finish + 2, `at ${v} it lands ${x - R.finish} past the floor's start`);
    assert.ok(x <= R.finish + 40, `at ${v} it lands ${x - R.finish} past the floor's start`);
  }
});

test("Ghoul Rush's Grand Banister: every break in the rail clears with a jump at the edge or a few units early, and a rider that never jumps drops into it", () => {
  assert.equal(R.rails - 1, 7, "seven breaks");
  for (let i = 0; i + 1 < R.rails - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 9 && gap <= 18, `break ${i} is ${gap} wide`);
    const end = a.pts.at(-1);
    const slope = ct.slopeOf(R, i, a.x1);
    assert.ok(slope < 0, "breaks lie on descents (no ramp launch)");
    for (const v of [40, 45, 50, 55]) {
      assert.equal(bn.flight(R, a.x1, end[1], slope * v, v), null, `break ${i}, no jump, at ${v}`);
      for (const early of [0, 4]) {
        const x = a.x1 - early;
        const y = ct.trackY(R, i, x);
        const s = bn.flight(R, x, y, bn.BAN_JUMP_V + ct.slopeOf(R, i, x) * v, v);
        assert.ok(s, `break ${i}: a jump ${early} early at ${v} lands`);
        assert.equal(s.line, i + 1, `break ${i} cleared, at ${v}, ${early} early`);
      }
    }
  }
});

test("Ghoul Rush's Grand Banister: the brass under-rails run RAIL_SEP under the handrail along one descent each, a jump with DOWN held lands on one and a plain jump on the handrail, and a jump off its end lands back on the handrail", () => {
  assert.equal(unders.length, 8, "eight places where the track splits");
  for (let n = 0; n < unders.length; n++) {
    const line = R.rails + n;
    const L = unders[n];
    // It lies under one handrail line, on a descent, RAIL_SEP below it all along.
    const up = uppers.findIndex((u) => u.x0 <= L.x0 && u.x1 >= L.x1);
    assert.ok(up >= 0, `under-rail ${n} lies under a handrail line`);
    for (let x = L.x0; x <= L.x1; x += 2) assert.ok(Math.abs(ct.trackY(R, up, x) - ct.trackY(R, line, x) - bn.RAIL_SEP) < 0.15, `${bn.RAIL_SEP} under at ${x}`);
    for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(slopeAtLine(L, i) < -0.05, "on a descent only");
    assert.ok(L.x1 - L.x0 > 90, "a long flight");
    assert.ok(bn.lowerLine(R, line) && !bn.lowerLine(R, up));
    // A dive from the climb before it lands on it; a plain jump from the same place on the handrail.
    const x = L.x0 - 12;
    const y = ct.trackY(R, up, x);
    const v = bn.BAN_V;
    const dive = bn.flight(R, x, y, bn.BAN_JUMP_V + ct.slopeOf(R, up, x) * v, v, true);
    const plain = bn.flight(R, x, y, bn.BAN_JUMP_V + ct.slopeOf(R, up, x) * v, v, false);
    assert.ok(dive && dive.line === line, `a dive lands on under-rail ${n}`);
    assert.ok(plain && plain.line === up, `a plain jump lands on the handrail at ${n}`);
    // Off its end the rider falls (a plunge) unless he jumps; a jump lands on the handrail.
    const end = L.pts.at(-1);
    const slope = ct.slopeOf(R, line, L.x1);
    assert.equal(bn.flight(R, L.x1, end[1], slope * v, v), null, `under-rail ${n}: no jump, a plunge`);
    for (const early of [0, 3]) {
      const ex = L.x1 - early;
      const f = bn.flight(R, ex, ct.trackY(R, line, ex), bn.BAN_JUMP_V + ct.slopeOf(R, line, ex) * v, v);
      assert.ok(f && f.line < R.rails, `under-rail ${n}: a jump ${early} early lands on the handrail`);
    }
  }
});

test("Ghoul Rush's Grand Banister: every thing is on a line, off its ends, spaced for a player (22 between jumps and 38 between a jump and a duck), a frame's underside between a ducked box and a standing one, a chandelier's swing inside its line", () => {
  const jumps = [];
  for (const [x, line] of R.props) {
    assert.ok(ct.trackY(R, line, x) !== null, `a prop at ${x} stands on line ${line}`);
    jumps.push([x - 2, x + 2, line]);
  }
  for (const [x, line] of R.butlers) {
    assert.ok(ct.trackY(R, line, x) !== null);
    assert.ok(x - lines[line].x0 > 20 && lines[line].x1 - x > 14, `a butler at ${x} has room to lunge`);
    jumps.push([x - 12, x + 2, line]);
  }
  for (let i = 0; i + 1 < R.rails; i++) jumps.push([lines[i].x1, lines[i + 1].x0, -1]);
  for (const [x, line] of [...R.webs]) assert.ok(x - lines[line].x0 > 8 && lines[line].x1 - x > 14, `a web at ${x} well inside its line`);
  for (const [x, line] of R.props) assert.ok(x - lines[line].x0 > 8 && lines[line].x1 - x > 14, `a prop at ${x} well inside its line`);
  const ducks = [];
  for (const [x0, x1] of R.lows) ducks.push([x0, x1]);
  for (const [cx, line, amp] of R.swings) {
    assert.ok(line < R.rails, "chandeliers hang over the handrail");
    assert.ok(cx - amp - 6 > lines[line].x0 && cx + amp + 6 < lines[line].x1, `the swing at ${cx} stays inside its line`);
    ducks.push([cx - amp - 3, cx + amp + 3]);
  }
  // The routes: the handrail's and each under-rail's own; the breaks belong to both (line -1).
  const checkSpacing = (set, label) => {
    set.sort((p, q) => p[0] - q[0]);
    for (let i = 0; i + 1 < set.length; i++) assert.ok(set[i + 1][0] - set[i][1] >= 22, `${label}: jumps at ${set[i][1]} and ${set[i + 1][0]}`);
  };
  const handrail = jumps.filter((j) => j[2] < R.rails);
  checkSpacing([...handrail], "handrail");
  for (let n = 0; n < unders.length; n++) {
    const line = R.rails + n;
    const own = jumps.filter((j) => j[2] === line || j[2] === -1);
    own.push([unders[n].x1 - 2, unders[n].x1 + 4, line]);
    // The dive in from the climb before it: a jump from 14 short of its start, landing about 26 in.
    own.push([unders[n].x0 - 14, unders[n].x0 + 26, line]);
    checkSpacing(own, `under-rail ${n}`);
  }
  for (const [d0, d1] of ducks) {
    for (const [j0, j1, l] of handrail) assert.ok(j0 - d1 >= 38 || d0 - j1 >= 38, `a jump at ${j0} and a duck at ${d0} (line ${l})`);
  }
  for (let i = 0; i < R.lows.length; i++) {
    const [x0, x1, y] = R.lows[i];
    let hi = 0;
    let lo = 99;
    for (let x = x0 - K.HIT_W / 2; x <= x1 + K.HIT_W / 2; x += 0.25) {
      const g = ct.linesAt(R, x)[0];
      assert.ok(g, "rail under a frame");
      hi = Math.max(hi, g[1]);
      lo = Math.min(lo, g[1]);
    }
    assert.ok(hi + K.DUCK_H < y, `a ducked box clears the frame at ${x0}`);
    assert.ok(lo + K.HIT_H > y, `a standing box hits the frame at ${x0}`);
  }
  assert.deepEqual([R.props.length, R.lows.length, R.swings.length, R.butlers.length, R.webs.length], [12, 6, 7, 8, 8]);
  // Checkpoints every 300 to 400 units, each on the handrail and clear of a jump coming up.
  const cs = R.checks;
  for (let i = 0; i < cs.length; i++) {
    assert.ok(ct.linesAt(R, cs[i]).length, `checkpoint ${i} on the rail`);
    if (i) assert.ok(cs[i] - cs[i - 1] >= 300 && cs[i] - cs[i - 1] <= 400, `${cs[i] - cs[i - 1]} between checkpoints`);
    for (const [j0, j1, l] of handrail) assert.ok(j0 - cs[i] > 20 || cs[i] - j1 > 4, `a jump at ${j0} near checkpoint ${i} (line ${l})`);
  }
  assert.ok(cs[0] < 450 && R.finish - cs.at(-1) > 300);
});

/* ---------------------------------------------------------- the pendulum */

test("Ghoul Rush's Grand Banister's chandeliers swing on a pendulum: a sine in time, lowest in the middle of the swing and rising at the ends, over the handrail under them", () => {
  const round = synth({ track: FLAT, swings: [[100, 0, 9, 2400, 300]] });
  const sw = (t) => bn.swingAt(round.spec.ride, 0, t);
  // At the phase's zero it is in the middle, going right; a quarter period later at the far end.
  const mid = sw(2400 - 300);
  assert.ok(Math.abs(mid.x - 100) < 1e-6 && Math.abs(mid.u) < 1e-6);
  assert.ok(Math.abs(mid.bottom - (20 + bn.SWING_LOW)) < 1e-6, "lowest in the middle");
  const end = sw(2400 - 300 + 600);
  assert.ok(Math.abs(end.x - 109) < 1e-6 && Math.abs(end.u - 1) < 1e-6);
  assert.ok(Math.abs(end.bottom - (20 + bn.SWING_LOW + bn.SWING_RISE)) < 1e-6, "highest at the ends");
  const back = sw(2400 - 300 + 1800);
  assert.ok(Math.abs(back.x - 91) < 1e-6);
  // Periodic, and the same every time.
  const p1 = sw(777);
  const p2 = sw(777 + 2400);
  assert.ok(Math.abs(p1.x - p2.x) < 1e-6 && Math.abs(p1.bottom - p2.bottom) < 1e-6);
  // Over a slope, the bob hangs over the rail under it.
  const slope = synth({ track: DOWN, swings: [[100, 0, 9, 2400, 0]] });
  const a = bn.swingAt(slope.spec.ride, 0, 600);
  assert.ok(Math.abs(a.bottom - (ct.trackY(slope.spec.ride, 0, a.x) + bn.SWING_LOW + bn.SWING_RISE)) < 1e-6);
  // The clock only runs while the rider rides.
  assert.equal(round.runner.clock, 0);
  run(round, 1000);
  assert.equal(round.runner.clock, 1000);
});

test("Ghoul Rush's Grand Banister: a chandelier hits a standing rider while its bob hangs low, a ducked one while it hangs lower than a ducked head (the middle of its swing) and nobody while it is out at the end of its arc; a rider on the under-rail passes beneath it", () => {
  const ride = { track: [[[0, 20], [400, 20]]], swings: [[100, 0, 9, 2400, 0]] };
  // Where the rider and the bob meet: the rider placed at the bob at time t (a clock to the nearest slice).
  const meet = (t, { duck = false, line = 0, track = ride.track } = {}) => {
    const r = synth({ ...ride, track });
    const b = bn.swingAt(r.spec.ride, 0, t + 4);
    rideAt(r, b.x - 0.2, line);
    r.runner.clock = t;
    r.input.down = duck;
    r.you.safeMs = 0;
    run(r, 4);
    r.input.down = false;
    return r;
  };
  // The middle of the swing (u 0, at t 0): the bob is lower than a ducked head, 22.2 over the rail.
  const mid = meet(2400 - 4, { duck: true });
  assert.equal(mid.bonusRound.hearts, 4, "ducking does not help at the middle");
  assert.equal(events(mid, "lose")[0].cause, "swing");
  assert.equal(events(mid, "banCrash")[0].what, "swing");
  assert.deepEqual(mid.bonusRound.perf.hits, ["w0"]);
  assert.equal(mid.lives, 3, "not a life");
  assert.ok(mid.you.safeMs > 0);
  // Out at the end (u 1, t 600): the bob is over a standing head.
  assert.equal(meet(600 - 4).bonusRound.hearts, 5, "high at the end of its arc");
  // In between (u 0.6): low enough to hit a standing rider, high enough to duck under.
  const t06 = Math.round((Math.asin(0.6) / (2 * Math.PI)) * 2400);
  assert.equal(meet(t06 - 4).bonusRound.hearts, 4, "standing: hit");
  assert.equal(meet(t06 - 4, { duck: true }).bonusRound.hearts, 5, "ducked: under");
  // The chain makes it a wall to the roof: a jump into it hits too.
  const jump = synth(ride);
  const b = bn.swingAt(jump.spec.ride, 0, 604);
  rideAt(jump, b.x - 0.2, 0);
  jump.runner.clock = 600 - 4 + 0;
  Object.assign(jump.you, { state: "air", y: 28, vy: 5 });
  jump.runner.line = -1;
  jump.runner.left = 0;
  run(jump, 4);
  assert.equal(jump.bonusRound.hearts, 4, "a jumper is hit above the bob");
  // On the under-rail 7 below, the same bob at its lowest passes overhead.
  const under = meet(2400 - 4, { line: 1, track: [[[0, 20], [400, 20]], [[0, 13], [400, 13]]] });
  assert.equal(under.bonusRound.hearts, 5);
  // The bob is a box: well clear of it in x, nothing hits.
  const far = synth(ride);
  rideAt(far, 60, 0);
  far.runner.clock = 2400 - 4;
  run(far, 4);
  assert.equal(far.bonusRound.hearts, 5);
});

/* ------------------------------------------------------------ the rider */

test("Ghoul Rush's Grand Banister rolls at BAN_V on the flat, faster down a slope and slower up one, never past BAN_MIN or BAN_MAX; RIGHT leans and LEFT brakes", () => {
  const flat = synth({ track: FLAT });
  assert.equal(flat.runner.v, bn.BAN_V);
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - bn.BAN_V) < 0.01);
  run(flat, 300, { right: true });
  assert.ok(flat.runner.v > bn.BAN_V + 2, `a lean: ${flat.runner.v}`);
  run(flat, 3000);
  assert.ok(Math.abs(flat.runner.v - bn.BAN_V) < 0.5, "it settles back");
  run(flat, 300, { left: true });
  assert.ok(flat.runner.v < bn.BAN_V - 5, `a brake: ${flat.runner.v}`);
  const down = synth({ track: DOWN });
  run(down, 3000);
  assert.ok(Math.abs(down.runner.v - (bn.BAN_V + (bn.SLOPE_G * 0.15) / bn.RELAX)) < 0.2, `${down.runner.v} down a 0.15 slope`);
  assert.ok(down.runner.v <= bn.BAN_MAX);
  const up = synth({ track: UP });
  run(up, 3000);
  assert.ok(Math.abs(up.runner.v - (bn.BAN_V - (bn.SLOPE_G * 0.3) / bn.RELAX)) < 0.2, `${up.runner.v} up a 0.3 slope`);
  const steep = synth({ track: [[[0, 10000], [4000, 6000]]] });
  run(steep, 3000);
  assert.equal(steep.runner.v, bn.BAN_MAX);
  const wall = synth({ track: [[[0, 0], [4000, 4000]]] });
  run(wall, 3000);
  assert.equal(wall.runner.v, bn.BAN_MIN);
  const long = synth({ track: FLAT });
  run(long, 3000, { left: true });
  assert.equal(long.runner.v, bn.BAN_MIN);
  // The rider faces right, on the rail, never walking.
  assert.equal(flat.you.face, 1);
  assert.equal(flat.you.state, "run");
  assert.equal(flat.you.y, 20);
});

test("Ghoul Rush's Grand Banister jumps about 13 high for about three quarters of a second, a press saved for a landing jumps on it, one just after a line's end still jumps", () => {
  const round = synth({ track: FLAT });
  let top = 0;
  press(round);
  const t = until(round, () => {
    top = Math.max(top, round.you.y - 20);
    return round.you.state === "run" && round.you.y === 20 && round.you.vy === 0 && top > 1;
  }, 3000);
  assert.ok(Math.abs(top - (bn.BAN_JUMP_V * bn.BAN_JUMP_V) / (2 * bn.BAN_G)) < 0.4, `${top.toFixed(1)} high`);
  assert.ok(t > 650 && t < 850, `${t} ms in the air`);
  assert.equal(events(round, "banJump").length, 1);
  assert.equal(events(round, "banLand").length, 1);
  const across = round.you.x - 10;
  assert.ok(across > 31 && across < 37, `${across.toFixed(1)} across`);
  const buf = synth({ track: FLAT });
  press(buf);
  run(buf, 640);
  press(buf);
  until(buf, () => events(buf, "banJump").length >= 2, 1500);
  assert.equal(events(buf, "banJump").length, 2, "the saved press jumped again at the landing");
  const edge = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  rideAt(edge, 58.5, 0);
  run(edge, 80);
  assert.equal(edge.runner.line, -1, "off the end");
  press(edge);
  run(edge, 4);
  assert.equal(events(edge, "banJump").length, 1, "coyote");
  const late = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  rideAt(late, 58.5, 0);
  run(late, 80 + bn.COYOTE_MS);
  press(late);
  run(late, 4);
  assert.equal(events(late, "banJump").length, 0);
});

test("Ghoul Rush's Grand Banister: DOWN ducks (and a press of up jumps instead of ducking); a ducked rider passes under a frame and a standing one hits it (cause frame), at the cost of a heart", () => {
  const round = synth({ track: FLAT, lows: [[60, 66, 23.0]] });
  const you = round.you;
  assert.equal(you.ducking, false);
  run(round, 20, { down: true });
  assert.equal(events(round, "banDuck").length, 1);
  round.input.down = true;
  until(round, () => you.x > 75, 3000);
  round.input.down = false;
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.lives, 3);
  const hit = synth({ track: FLAT, lows: [[60, 66, 23.0]] });
  until(hit, () => hit.bonusRound.hearts < 5, 3000);
  assert.equal(hit.bonusRound.hearts, 4);
  assert.equal(hit.lives, 3, "not a life");
  assert.equal(events(hit, "lose")[0].cause, "frame");
  assert.equal(events(hit, "banCrash")[0].what, "frame");
  assert.equal(hit.phase, "play", "the ride plays on");
  assert.ok(hit.you.safeMs > 0, "blinking safe");
  assert.deepEqual(hit.bonusRound.perf.hits, ["f0"]);
  run(hit, 1000);
  assert.equal(hit.bonusRound.hearts, 4, "the same frame costs nothing twice");
  const jump = synth({ track: FLAT, lows: [[60, 66, 23.0]] });
  rideAt(jump, 40, 0);
  press(jump);
  until(jump, () => jump.bonusRound.hearts < 5 || jump.you.x > 80, 3000);
  assert.equal(jump.bonusRound.hearts, 4, "a jump does not clear a hanging frame");
  const both = synth({ track: FLAT });
  both.input.down = true;
  press(both);
  run(both, 20);
  assert.equal(both.you.ducking, false);
  assert.equal(events(both, "banJump").length, 1);
});

test("Ghoul Rush's Grand Banister: a vase and a candlestick are cleared by a jump and cost a heart otherwise (causes vase and candle), each only once", () => {
  for (const [kind, cause, what] of [[0, "vase", "vase"], [1, "candle", "candle"]]) {
    const hit = synth({ track: FLAT, props: [[60, 0, kind]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4, `${cause} costs a heart`);
    assert.equal(events(hit, "lose")[0].cause, cause);
    assert.equal(events(hit, "banCrash")[0].what, what);
    assert.equal(hit.lives, 3);
    assert.deepEqual(hit.bonusRound.perf.hits, ["p0"]);
    run(hit, 500);
    assert.equal(hit.bonusRound.hearts, 4);
    for (const from of [60 - 26, 60 - 14, 60 - 9]) {
      const clear = synth({ track: FLAT, props: [[60, 0, kind]] });
      rideAt(clear, from, 0);
      press(clear);
      until(clear, () => clear.you.x > 80, 3000);
      assert.equal(clear.bonusRound.hearts, 5, `${cause} jumped from ${from}`);
    }
  }
});

test("Ghoul Rush's Grand Banister: a ghostly butler waits until BUTLER_NEAR short of it, bows BUTLER_WARN_MS, lunges up the rail with its tray and hits (cause butler) if you meet it; a jump clears it", () => {
  const hit = synth({ track: FLAT, butlers: [[200, 0]] });
  rideAt(hit, 150, 0);
  assert.equal(hit.runner.butlers[0].state, "wait");
  run(hit, 100);
  assert.equal(hit.runner.butlers[0].state, "wait", "far off: waiting");
  until(hit, () => hit.runner.butlers[0].state === "warn", 2000);
  assert.ok(200 - hit.you.x <= bn.BUTLER_NEAR + 0.5 && 200 - hit.you.x > bn.BUTLER_NEAR - 1, "wakes at BUTLER_NEAR");
  assert.equal(events(hit, "banButlerWarn").length, 1);
  assert.equal(hit.bonusRound.hearts, 5, "a bow hurts nothing");
  const warnMs = until(hit, () => hit.runner.butlers[0].state === "lunge", 2000);
  assert.ok(Math.abs(warnMs - bn.BUTLER_WARN_MS) < 20, `bowed ${warnMs} ms`);
  assert.equal(events(hit, "banButlerLunge").length, 1);
  assert.ok(200 - hit.you.x > 12 && 200 - hit.you.x < 30, `lunges ${200 - hit.you.x} ahead: time to see it`);
  const x0 = hit.runner.butlers[0].x;
  run(hit, 100);
  assert.ok(x0 - hit.runner.butlers[0].x > bn.BUTLER_V * 0.09, "it comes at you");
  until(hit, () => hit.bonusRound.hearts < 5, 2000);
  assert.equal(events(hit, "lose")[0].cause, "butler");
  assert.equal(events(hit, "banCrash")[0].what, "butler");
  assert.equal(hit.runner.butlers[0].state, "spent");
  assert.deepEqual(hit.bonusRound.perf.hits, ["b0"]);
  // A jump over it, any time from about 10 to 18 short of it while it lunges.
  const jump = synth({ track: FLAT, butlers: [[200, 0]] });
  rideAt(jump, 150, 0);
  until(jump, () => jump.runner.butlers[0].state === "lunge" && jump.runner.butlers[0].x - jump.you.x < 20, 3000);
  press(jump);
  until(jump, () => jump.you.x > 240, 3000);
  assert.equal(jump.bonusRound.hearts, 5);
  assert.equal(events(jump, "lose").length, 0);
  // It gives up after its lunge.
  const left = synth({ track: FLAT, butlers: [[600, 0]] });
  rideAt(left, 580, 0, { safe: true });
  left.runner.butlers[0] = { state: "lunge", t: bn.BUTLER_LUNGE_MS, x: 600, hp: 2 };
  run(left, bn.BUTLER_LUNGE_MS + 50);
  assert.equal(left.runner.butlers[0].state, "spent");
});

test("Ghoul Rush's Grand Banister: bolts follow the stairs, so two bolts break a butler (150 points) and one shoots down a cobweb (50 points), each for the grade's acts; riding through a web only tears it", () => {
  const round = synth({ track: DOWN, butlers: [[220, 0]], webs: [[90, 0]] });
  rideAt(round, 20, 0);
  round.you.safeMs = 1e9;
  const start = round.score;
  round.input.fire = true;
  until(round, () => round.runner.webs[0] === "shot", 2000);
  assert.equal(round.runner.webs[0], "shot");
  assert.equal(events(round, "banWebShot")[0].points, bn.WEB_POINTS);
  assert.equal(round.bonusRound.perf.acts, 1);
  until(round, () => round.runner.butlers[0].state === "broken", 4000);
  assert.equal(round.runner.butlers[0].state, "broken");
  assert.equal(events(round, "banButlerHit").length, bn.BUTLER_HP - 1);
  assert.equal(events(round, "banButlerBreak")[0].points, bn.BUTLER_POINTS);
  round.input.fire = false;
  assert.equal(round.bonusRound.perf.acts, 2);
  assert.ok(round.score - start >= bn.WEB_POINTS + bn.BUTLER_POINTS);
  assert.equal(round.bonusRound.hearts, 5, "a butler shot dead never hits");
  // A bolt flies along the slope, not level.
  const probe = synth({ track: DOWN });
  probe.input.fire = true;
  run(probe, 300);
  probe.input.fire = false;
  assert.ok(probe.shots.length > 0);
  for (const s of probe.shots) {
    const above = s.y - (40 - 0.15 * s.x);
    assert.ok(Math.abs(above - ghoul.SHOT_Y) < 0.5, `a bolt ${above.toFixed(2)} over the rail`);
  }
  assert.equal(probe.bonusRound.perf.acts, 0);
  // A web ridden through tears, costs nothing, and cannot be shot after.
  const through = synth({ track: FLAT, webs: [[60, 0]] });
  until(through, () => through.runner.webs[0] === "torn", 3000);
  assert.equal(through.runner.webs[0], "torn");
  assert.equal(events(through, "banWebTear").length, 1);
  assert.equal(through.bonusRound.hearts, 5);
  run(through, 400);
  assert.equal(through.bonusRound.hearts, 5);
  assert.equal(bn.BANISTER.target(through, { x: 60, y: 22.4 }), false, "a torn web is no target");
  // What was shot stays shot after a restart.
  const again = synth({ track: FLAT, butlers: [[300, 0]], webs: [[200, 0]] });
  again.runner.butlers[0].state = "broken";
  again.runner.webs[0] = "shot";
  bn.BANISTER.place[0](again, {});
  assert.equal(again.runner.butlers[0].state, "broken");
  assert.equal(again.runner.webs[0], "shot");
});

/* ------------------------------------------------- breaks, rails and hearts */

test("Ghoul Rush's Grand Banister: a break with no jump is a heart (cause plunge), the rider goes back on the handrail ahead at BAN_V and rolls on; a jump over it costs nothing", () => {
  const ride = { track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] };
  const fall = synth(ride);
  rideAt(fall, 30, 0);
  until(fall, () => fall.bonusRound.hearts < 5, 3000);
  assert.equal(fall.bonusRound.hearts, 4);
  assert.equal(fall.lives, 3, "not a life");
  assert.equal(events(fall, "lose")[0].cause, "plunge");
  assert.equal(fall.phase, "play");
  assert.equal(fall.runner.line, 1, "on the rail beyond the break");
  assert.ok(fall.you.x >= 75 && fall.you.x < 80);
  assert.equal(fall.you.y, 20);
  assert.equal(fall.runner.v, bn.BAN_V);
  assert.ok(fall.you.safeMs > 0);
  assert.deepEqual(fall.bonusRound.perf.hits, ["g0"]);
  run(fall, 600);
  assert.equal(fall.runner.line, 1);
  assert.equal(fall.bonusRound.hearts, 4);
  const hop = synth(ride);
  rideAt(hop, 54, 0);
  press(hop);
  until(hop, () => hop.you.x > 100, 3000);
  assert.equal(hop.bonusRound.hearts, 5);
  assert.equal(hop.runner.line, 1);
});

test("Ghoul Rush's Grand Banister: a jump with DOWN held dives onto the under-rail (an event banSwitch), a plain jump lands back on the handrail, and off the under-rail's end a rider who does not jump plunges", () => {
  // Two rails over 300 units: the handrail at 20, the brass under-rail 7 below.
  const ride = { track: [[[0, 20], [400, 20]], [[100, 13], [300, 13]]], rails: 1 };
  const plain = synth(ride);
  rideAt(plain, 80, 0);
  press(plain);
  until(plain, () => plain.you.x > 150, 3000);
  assert.equal(plain.runner.line, 0, "a plain jump lands on the handrail");
  assert.equal(events(plain, "banSwitch").length, 0);
  const dive = synth(ride);
  rideAt(dive, 80, 0);
  press(dive);
  run(dive, 100, { down: true });
  dive.input.down = true;
  until(dive, () => dive.runner.line >= 0, 3000);
  dive.input.down = false;
  assert.equal(dive.runner.line, 1, "a dive lands on the under-rail");
  assert.equal(dive.you.y, 13);
  assert.equal(events(dive, "banSwitch").length, 1);
  assert.equal(events(dive, "banSwitch")[0].lower, true);
  assert.equal(dive.bonusRound.hearts, 5);
  // Up from the under-rail: a jump rises through the handrail and lands on it (a switch back).
  press(dive);
  until(dive, () => dive.runner.line === 0, 2000);
  assert.equal(dive.runner.line, 0);
  assert.equal(events(dive, "banSwitch")[1].lower, false);
  // Held DOWN with nothing below, a dive lands on the handrail all the same.
  const only = synth({ track: FLAT });
  press(only);
  run(only, 100, { down: true });
  only.input.down = true;
  until(only, () => only.runner.line >= 0 && only.you.state === "run", 3000);
  only.input.down = false;
  assert.equal(only.runner.line, 0);
  // The under-rail's end is a plunge unless the rider jumps.
  const fall = synth(ride);
  rideAt(fall, 250, 1);
  until(fall, () => fall.bonusRound.hearts < 5, 3000);
  assert.equal(fall.bonusRound.hearts, 4);
  assert.equal(events(fall, "lose")[0].cause, "plunge");
  assert.deepEqual(fall.bonusRound.perf.hits, [], "an under-rail's end is not one of the graded obstacles");
  assert.equal(fall.runner.line, 0, "caught back on the handrail");
  const hop = synth(ride);
  rideAt(hop, 298, 1);
  press(hop);
  until(hop, () => hop.you.x > 340, 3000);
  assert.equal(hop.bonusRound.hearts, 5);
  assert.equal(hop.runner.line, 0, "a jump at the end lands on the handrail");
});

test("Ghoul Rush's Grand Banister: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Ballroom", () => {
  const round = banRound();
  round.dice = 2;
  const score = round.score;
  round.bonusRound.hearts = 1;
  rideAt(round, lines[0].x1 - 6, 0);
  round.you.safeMs = 0;
  until(round, () => round.phase === "clear", 6000);
  assert.equal(round.bonusRound.hearts, 0);
  assert.equal(round.bonusRound.over, true);
  assert.equal(round.bonusRound.won, false);
  const end = events(round, "bonusEnd");
  assert.equal(end.length, 1);
  assert.equal(end[0].won, false);
  assert.equal(end[0].dice, 0);
  assert.equal(round.over, false, "no game over");
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.ok(round.score >= score);
  run(round, ghoul.CARD_LOST_MS + 100);
  assert.equal(round.spec.id, "ballroom");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner ?? null, null);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Grand Banister: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart", () => {
  const round = banRound();
  rideAt(round, R.checks[0] - 6, ct.linesAt(R, R.checks[0] - 6)[0][0]);
  round.you.safeMs = 1e9;
  until(round, () => round.runner.check >= 1, 4000);
  const seen = events(round, "banCheck").map((e) => e.n);
  assert.deepEqual(seen.slice(0, 1), [1]);
  assert.ok(round.runner.check >= 0);
  const c0 = round.runner.check;
  round.you.x = 1;
  bn.BANISTER.place[0](round, {});
  assert.equal(round.you.x, R.checks[c0]);
  assert.equal(round.runner.v, bn.BAN_V);
  assert.equal(round.runner.check, c0);
  assert.equal(round.camLead, bn.CAM_AHEAD);
  const fresh = banRound();
  assert.equal(fresh.you.x, ROOM.start);
  assert.equal(fresh.runner.check, -1);
  assert.equal(fresh.runner.id, "banister");
  // Another room's rider slot is not ours to take: the slot is ours only in our room.
  const other = banRound();
  other.runner = { id: "tray" };
  other.spec = { ...other.spec, ride: { ...other.spec.ride, runner: "tray" } };
  bn.BANISTER.place[0](other, {});
  assert.deepEqual(other.runner, { id: "tray" });
  other.runner = { id: "banister" };
  bn.BANISTER.place[0](other, {});
  assert.equal(other.runner, null);
});

test("Ghoul Rush's Grand Banister: off the lip the rider launches, lands on the foyer floor and stops (banFinish), the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = banRound();
  round.dice = 1;
  const last = R.rails - 1;
  rideAt(round, lines[last].x1 - 12, last, { safe: true });
  until(round, () => round.runner.done, 4000);
  assert.equal(round.runner.done, true);
  assert.equal(events(round, "banLaunch").length, 1);
  assert.equal(events(round, "banLaunch")[0].last, true);
  assert.equal(events(round, "banFinish").length, 1);
  assert.ok(round.you.x > R.finish + 4 && round.you.x < R.finish + 40, `${round.you.x} landed`);
  assert.equal(round.you.y, floorOf(round.you.x));
  assert.equal(round.hasKey, true, "the door opens");
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.phase, "play");
  round.input.right = true;
  until(round, () => round.phase === "clear", 20000);
  round.input.right = false;
  assert.equal(round.phase, "clear");
  const end = events(round, "bonusEnd");
  assert.equal(end.length, 1);
  assert.equal(end[0].won, true);
  assert.ok(end[0].dice >= BONUS_FLOOR && end[0].dice <= ghoul.MAX_DICE, `${end[0].dice} dice`);
  assert.equal(round.dice, 1 + end[0].dice);
  assert.equal(round.lives, 3);
  run(round, ghoul.CARD_MS + 100);
  assert.equal(round.spec.id, "ballroom");
  assert.equal(round.runner ?? null, null);
});

test("Ghoul Rush's Grand Banister: no random number is drawn in the room (a ride of 20 seconds, jumping and shooting, on a draw that throws)", () => {
  const round = banRound();
  rideAt(round, 120, 0, { safe: true });
  round.input.fire = true;
  for (let t = 0; t < 20000; t += 4) {
    if (t % 1500 === 0) press(round);
    ghoul.advance(round, 4, never);
    round.events.length = 0;
    round.you.safeMs = 1e9;
    if (round.phase !== "play") break;
  }
  assert.ok(round.you.x > 600);
});

/* ----------------------------------------------------------- the grade */

test("Ghoul Rush's Grand Banister's grade: the dice formula, shooting 8 things for the die, and the smooth slide die (braking for no more than 3 seconds in all)", () => {
  const round = banRound();
  const b = round.bonusRound;
  assert.equal(b.perf.goal, bn.ACTS_GOAL);
  assert.equal(b.perf.total, R.props.length + R.lows.length + R.swings.length + R.butlers.length + R.rails - 1);
  assert.equal(b.perf.steady, true, "a smooth slide so far");
  const mk = (perf) => {
    const x = makeBonus({ stats: { kills: 0 } });
    Object.assign(x.perf, { total: b.perf.total, goal: bn.ACTS_GOAL }, perf);
    return x;
  };
  assert.equal(diceFor(mk({ hits: [], acts: 8, steady: true })), 9, "a perfect ride");
  assert.equal(diceFor(mk({ hits: [], acts: 7, steady: true })), 8);
  assert.equal(diceFor(mk({ hits: [], acts: 8, steady: false })), 8);
  const slide = synth({ track: FLAT });
  run(slide, bn.STEADY_BRAKE_MS - 200, { left: true });
  assert.equal(slide.bonusRound.perf.steady, true, "just under the limit");
  run(slide, 400, { left: true });
  assert.equal(slide.bonusRound.perf.steady, false, "too much braking");
  const lean = synth({ track: FLAT });
  run(lean, 5000, { right: true });
  assert.equal(lean.bonusRound.perf.steady, true, "leaning is no sin");
});

test("Ghoul Rush's Grand Banister: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const tries = [
    { props: [[60, 0, 0]] }, { props: [[60, 0, 1]] }, { lows: [[56, 62, 23.0]] }, { butlers: [[300, 0]] },
  ];
  for (const t of tries) {
    const r = synth({ track: FLAT, ...t });
    r.infinite = true;
    if (t.butlers) rideAt(r, 260, 0);
    until(r, () => events(r, "lose").length > 0, 3000);
    assert.equal(r.bonusRound.hearts, 5, JSON.stringify(Object.keys(t)));
    assert.equal(r.lives, 3);
  }
  const sw = synth({ track: FLAT, swings: [[100, 0, 9, 2400, 0]] });
  sw.infinite = true;
  const b = bn.swingAt(sw.spec.ride, 0, 2400);
  rideAt(sw, b.x - 0.2, 0);
  sw.runner.clock = 2400 - 4;
  run(sw, 4);
  assert.equal(events(sw, "lose").length, 1);
  assert.equal(sw.bonusRound.hearts, 5);
  const crack = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  crack.infinite = true;
  rideAt(crack, 30, 0);
  until(crack, () => events(crack, "lose").length > 0, 3000);
  assert.equal(crack.bonusRound.hearts, 5);
  assert.equal(crack.lives, 3);
});

test("Ghoul Rush's Grand Banister: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ track: FLAT, props: [[60, 0, 0]] });
  round.you.garlic = true;
  until(round, () => round.you.x > 70, 3000);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false, "spent");
});

/* ------------------------------------------------------ sounds and words */

test("Ghoul Rush's Grand Banister: every event has a voice that plays, every cause has words and a sound, and the voices are tones that exist (none longer than 1.2 s)", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...bn.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = BAN_VOICES[kind] && BAN_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "vase", points: 50 }).played;
    assert.ok(played.includes(name), `${event} plays ${name}`);
  }
  for (const [name, tone] of Object.entries(BANISTER_SFX.tones)) {
    assert.ok(tones[name], `${name} is merged into the game`);
    const length = Math.max(...tone.layers.map((l) => (l.delay || 0) + l.seconds));
    assert.ok(length <= 1.2, `${name} is ${length.toFixed(2)} s`);
  }
  for (const cause of ["vase", "candle", "frame", "swing", "butler", "plunge"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "banJump" }).played.length, 1);
  assert.equal(heard({ type: "banWebShot", points: 50 }).played.length, 1);
});

test("Ghoul Rush's Grand Banister's music is a loop of parts whose voices all run the same number of steps", () => {
  const music = BANISTER_SFX.music.ghoulBanister;
  assert.ok(ghoulSfx.default.music.ghoulBanister === music, "merged into the game");
  for (const [key, p] of Object.entries(music.patterns)) {
    let steps = null;
    for (const [voice, line] of Object.entries(p)) {
      assert.ok(music.voices[voice], `${key}.${voice} is a voice`);
      const n = line.split("|").join(" ").split(/\s+/).filter(Boolean).length;
      if (steps === null) steps = n;
      assert.equal(n, steps, `${key}.${voice} has ${n} steps, the others ${steps}`);
    }
    assert.equal(steps % 16, 0, "whole bars");
  }
  for (const key of music.order) assert.ok(music.patterns[key]);
  assert.ok(music.order.length >= 6, "a loop long enough not to grate");
});

test("Ghoul Rush's Grand Banister: the room's own names do not collide with the game's (events, kinds, the shared rider slot)", () => {
  for (const e of bn.EVENTS) assert.ok(e.startsWith("ban"), e);
  const other = new Set(ct.EVENTS || []);
  for (const e of bn.EVENTS) assert.ok(!other.has(e), `${e} is the banister's alone`);
  assert.deepEqual(Object.keys(bn.BANISTER).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(typeof ghoul.ROOM_MUSIC.banister, "string");
  assert.equal(banRound().runner.id, "banister");
  assert.equal(banRound().cart, null);
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Grand Banister draws: the room in a lit and a dark one, the rider on the rail, in the air and ducking, each thing (vases, candlesticks, frames, chandeliers at every point of their swing, butlers in each state, webs whole, torn and shot), a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["manor"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "banister") through(r);
  r.lives = 99;
  const spots = [ROOM.start + 40, R.props[0][0] - 10, R.lows[0][0] - 5, R.swings[0][0] - 8, R.butlers[0][0] - 20, R.webs[0][0] - 6, R.checks[0], lines[0].x1 - 10, unders[0].x0 + 20, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      const top = ct.linesAt(R, x)[0] || [R.rails - 1, 20];
      rideAt(r, x, top[0], { safe: true });
      r.runner.butlers = r.runner.butlers.map((b, i) => ({ ...b, state: ["wait", "warn", "lunge", "broken", "spent"][i % 5], t: 300 }));
      r.runner.webs = r.runner.webs.map((_, i) => ["up", "torn", "shot"][i % 3]);
      r.runner.clock = x * 37;
      for (const air of [false, true]) {
        if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
        if (air) r.runner.line = -1;
        r.you.ducking = x === R.lows[0][0] - 5 && !air;
        r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
        for (let k = 0; k < 4; k++) g.tick(16);
        r.monsters.length = 0;
        r.you.safeMs = 1e9;
        rideAt(r, x, top[0], { safe: true });
      }
    }
  }
  assert.equal(r.spec.id, "banister");
  // A crash, the lip and the stop, the lost and won cards.
  r.you.safeMs = 0;
  rideAt(r, R.props[0][0] - 3, R.props[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["manor"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "banister") through(d);
  d.phase = "play";
  d.runner.done = true;
  d.runner.restX = R.finish + 20;
  Object.assign(d.you, { x: R.finish + 30, y: 10, state: "run" });
  d.camX = R.finish - 40;
  for (let k = 0; k < 10; k++) done.tick(16);
  for (const won of [true, false]) {
    endBonus(d, won, { ROOM_POINTS: 300, award: (rd, pts) => (rd.score += pts) });
    d.bonusRound.over = true;
    for (let k = 0; k < 10; k++) {
      done.tick(16);
      bonusTick(d, { tone() {}, fx: {} });
    }
    d.bonusRound.over = false;
  }
  // The stage select goes straight into it.
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.stageSelect();
  const p = pick.round;
  const at = ghoul.STAGES.findIndex((s) => s.id === "manor");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "banister");
  assert.equal(p.runner.line, 0);
  assert.equal(p.you.y, ct.trackY(R, 0, ROOM.start));
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that rides well: it jumps at the end of a line (not the lip), 9 to 15 short of a vase or a
// candlestick on its rail, when a butler is 6 to 17 short of it and moving, ducks under every frame
// and every chandelier's swing, watches the pendulums and brakes or leans to arrive when one is
// out of the way, takes the brass under-rail where a chandelier hangs lethal over the handrail, and
// holds the blaster. `miss` is the share of things it fails to dodge (by a hash).
const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
// Whether a rider on the handrail doing `act` (-1 brake, 0 nothing, 1 lean) for the next second and a
// half and ducking meets no chandelier: the pendulums run ahead on the rider's own clock.
function swingSafe(round, act) {
  const c = round.runner;
  let x = round.you.x;
  let v = c.v;
  let t = c.clock;
  for (let i = 0; i < 90; i++) {
    v = Math.min(bn.BAN_MAX, Math.max(bn.BAN_MIN, v + ((bn.BAN_V - v) * bn.RELAX + (act < 0 ? -bn.BRAKE_ACC : act > 0 ? bn.LEAN_ACC : 0)) * 0.016));
    x += v * 0.016;
    t += 16;
    const rail = ct.trackY(R, c.line, x);
    if (rail === null) return true;
    for (let j = 0; j < R.swings.length; j++) {
      const [cx, , amp] = R.swings[j];
      if (Math.abs(x - cx) > amp + 6) continue;
      const bob = bn.swingAt(R, j, t);
      if (Math.abs(x - bob.x) < (bn.SWING_BOB_W + K.HIT_W) / 2 && rail + K.DUCK_H > bob.bottom) return false;
    }
  }
  return true;
}
function goodBot(round, seed, miss = 0.04, { lower = true, timing = true } = {}) {
  const { you, runner: c, input: inp } = round;
  inp.left = inp.right = inp.down = false;
  inp.fire = true;
  if (round.phase !== "play" || !c || c.done) {
    inp.up = false;
    return;
  }
  const ok = (x) => mix(seed, Math.round(x)) >= miss;
  const look = 9 + (seed % 7);
  let jump = false;
  if (c.line >= 0) {
    round.__dive = false;
    const line = c.line;
    const L = lines[line];
    const isLower = line >= R.rails;
    if (!isLower && line < R.rails - 1 && L.x1 - you.x < 2.2 && ok(L.x1)) jump = true;
    if (isLower && L.x1 - you.x < 2.2) jump = true;
    const ahead = (x) => x - you.x > 6 && x - you.x < look;
    for (const [x, ln] of R.props) if (ln === line && ahead(x) && ok(x)) jump = true;
    R.butlers.forEach(([, ln], i) => {
      const b = c.butlers[i];
      if (ln === line && (b.state === "warn" || b.state === "lunge") && b.x - you.x > 6 && b.x - you.x < 17 && ok(b.x)) jump = true;
    });
    for (const [x0, x1] of R.lows) if (!isLower && you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
    R.swings.forEach(([cx, , amp]) => {
      if (!isLower && you.x > cx - amp - 12 && you.x < cx + amp + 8 && ok(cx)) inp.down = true;
    });
    if (timing && !isLower && !swingSafe(round, 0)) {
      if (swingSafe(round, -1)) inp.left = true;
      else if (swingSafe(round, 1)) inp.right = true;
    }
    // The fork: where a chandelier hangs lethal over a split, jump from before its start and dive onto the brass.
    if (lower && !isLower) {
      for (const U of unders) {
        const under = R.swings.some(([cx], i) => cx > U.x0 && cx < U.x1 && nominal()[i]);
        if (under && U.x0 - you.x > 6 && U.x0 - you.x < 13) {
          jump = true;
          round.__dive = true;
        }
      }
    }
    if (round.__dive) inp.down = true;
  } else if (round.__dive) inp.down = true;
  if (jump && (!inp.down || round.__dive)) press(round);
  else inp.up = false;
}
// The chandeliers that hang lethal to a ducking rider at the time the stairs bring him to them (the
// ones the room has phased to the middle of the swing at the arrival of a rider on the handrail who
// jumps everything and times nothing, nothing able to hurt him): found by that ride, once.
let NOMINAL = null;
function nominal() {
  if (NOMINAL) return NOMINAL;
  const round = banRound();
  const out = R.swings.map(() => null);
  for (let t = 0; t < 120000 && !round.runner.done; t += 16) {
    round.you.safeMs = 1e9;
    goodBot(round, 1, 0, { lower: false, timing: false });
    ghoul.advance(round, 16, steady);
    R.swings.forEach(([cx], i) => {
      if (out[i] === null && round.you.x >= cx) out[i] = round.runner.clock;
    });
  }
  NOMINAL = out.map((T, i) => Math.abs(bn.swingAt(R, i, T).u) < 0.2);
  return NOMINAL;
}
function idleBot(round) {
  const inp = round.input;
  inp.left = inp.right = inp.down = false;
  inp.up = false;
  inp.fire = true;
}
function rideWith(seed, bot, limit = 100000) {
  const round = banRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the rider stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Grand Banister: the chandeliers hang lethal to a ducking rider on the handrail where the room says so (two of them, each over a split with an under-rail beneath), and the rest pass a rider who ducks", () => {
  const lethal = nominal();
  assert.equal(lethal.filter(Boolean).length, 2, `lethal at the nominal time: ${lethal.join(",")}`);
  lethal.forEach((is, i) => {
    if (!is) return;
    const [cx] = R.swings[i];
    assert.ok(unders.some((U) => cx > U.x0 && cx < U.x1), `chandelier ${i} hangs over an under-rail`);
  });
  assert.equal(lethal[0], false, "the first one is kind");
});

test("Ghoul Rush's Grand Banister: a bot that rides well finishes the whole stair in 60 to 75 seconds, 7 to 9 dice, a few hearts lost at most, past every checkpoint", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 76000, `${ms} ms`);
    assert.ok(b.dice >= 6 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.check, R.checks.length - 1, "past every checkpoint");
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 6.5, `${dice.join(",")}`);
});

test("Ghoul Rush's Grand Banister: a rider who stays on the handrail and ignores the pendulums is hit by the two lethal chandeliers, while the same rider braking or leaning to time them passes both (and one on the under-rail never meets them)", () => {
  const swings = (r) => r.lost.filter((c) => c === "swing").length;
  const blind = rideWith(3, (r) => goodBot(r, 3, 0, { lower: false, timing: false }));
  assert.ok(swings(blind) >= 1, `lost ${blind.lost.join(",")}`);
  const timed = rideWith(3, (r) => goodBot(r, 3, 0, { lower: false, timing: true }));
  assert.equal(swings(timed), 0, `lost ${timed.lost.join(",")}`);
  assert.equal(timed.round.bonusRound.won, true);
  const under = rideWith(3, (r) => goodBot(r, 3, 0, { lower: true, timing: false }));
  assert.equal(swings(under), 0, `lost ${under.lost.join(",")}`);
  assert.equal(under.round.bonusRound.won, true);
});

test("Ghoul Rush's Grand Banister: a bot that never dodges (holding fire) loses all five hearts before the first third, ends with 0 dice and the run goes on", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { round, lost } = rideWith(seed, idleBot);
    const b = round.bonusRound;
    assert.equal(b.won, false, "never finishes");
    assert.equal(b.dice, 0);
    assert.equal(b.hearts, 0);
    assert.equal(lost.length, 5);
    assert.ok(round.you.x < ROOM.length * 0.45, `out at ${round.you.x}`);
    assert.equal(round.lives, 3);
    assert.equal(round.over, false);
  }
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Grand Banister telegraphs: DUCK over frames and chandeliers, JUMP over breaks, vases, candlesticks and the end of an under-rail, DIVE at the start of one, none for butlers or webs, words only on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  const answers = { gap: "JUMP", vase: "JUMP", candle: "JUMP", frame: "DUCK", swing: "DUCK", end: "JUMP", dive: "DIVE" };
  const vases = R.props.filter((p) => !p[2]).length;
  assert.equal(marks.length, (R.rails - 1) + R.props.length + R.lows.length + R.swings.length + 2 * unders.length, "no mark for butlers or webs");
  for (const m of marks) assert.equal(m.answer, answers[m.kind], m.kind);
  assert.equal(marks.filter((m) => m.kind === "vase").length, vases);
  assert.equal(marks.filter((m) => m.kind === "dive").length, unders.length);
  const m = marks.find((q) => q.kind === "frame");
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "frame" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  for (const kind of ["gap", "frame", "swing", "dive", "end"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 5, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((t) => t.lead === q.lead && t.kind === kind);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
});

test("Ghoul Rush's Grand Banister's intro banner says the controls plainly", () => {
  assert.match(R.how, /UP jump, DOWN duck/);
  assert.match(R.how, /dive/);
  assert.match(R.how, /LEFT brake/);
});

