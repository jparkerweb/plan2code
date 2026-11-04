// Web console tests, Ghoul Rush's Down the Hatch (the finale's first ride, after the Front Lawn): its shape (eleven swallows, every fork's hole swallows a rider who does not jump and its gristle ledge catches one who does, every uvula can be ducked, spacing, checkpoints every 8 to 10 seconds, the lip), the ride's speed on slopes and bile, its jump and duck, a rib, a uvula-lamp, a squeeze's throb, close and ease (peristalsis), the swallowed furniture, a plunge, the checkpoints, the lip and the door, the bonus round's three hearts and dice (3 to 8), endless lives for every cause, a voice for every event, the drawing, the telegraphs, and bots that ride the whole throat (one that rides well finishes, one that never dodges loses all three hearts without a game over).
// Run with: node --test scripts/test-web-console-activities-ghoul-mat.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as mt from "../src/web-console/public/activities/ghoul-rush/rides/mat/ghoul-mat.js";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import { MAT_ROOM } from "../src/web-console/public/activities/ghoul-rush/rides/mat/ghoul-mat-room.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as MAT_LOOKS, VOICES as MAT_VOICES, telegraphMarks, telegraphs, throbAt } from "../src/web-console/public/activities/ghoul-rush/rides/mat/ghoul-mat-draw.js";
import { MAT_SFX } from "../src/web-console/public/activities/ghoul-rush/rides/mat/ghoul-sfx-mat.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";
import { toneNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the mat drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}
function skipCard(round) {
  round.introMs = ghoul.INTRO_MIN_MS;
  return ghoul.takeIntro(round);
}

// A round in Down the Hatch reached the way a run reaches it (six stages behind it, the Front Lawn
// passed), nothing woken, the clocks long, the bonus round on (three hearts).
function matRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.cleared = ghoul.STAGES.slice(0, ghoul.RUN_STAGES).map((st) => st.id);
  round.offer = null;
  through(round);
  assert.equal(round.spec.id, "lawn");
  skipCard(round);
  skipCard(round);
  through(round);
  assert.equal(round.spec.id, "mat");
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "mat", hearts: 3, rails: 0, time: 1e9, finish: 1e6, track: [], ribs: [], lows: [], squeezes: [], furniture: [], bile: [], checks: [] };
// The same round over a ride of its own (a plain track to measure the rider on).
function synth(ride) {
  const round = matRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, rails: (ride.track || []).length, ...ride } };
  mt.MAT.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [4000, 20]]];
const DOWN = [[[0, 40], [4000, 40 - 0.1 * 4000]]];

// The rider on line `line` of the ride at `x`, at speed `v`.
function rideAt(round, x, line, { v = mt.MAT_V, safe = false } = {}) {
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

const ROOM = ghoul.roomById("mat");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const slopeAtLine = (L, i) => (L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0]);
const floors = lines.slice(0, R.rails);
const ledges = lines.slice(R.rails);
const K = { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Down the Hatch is the finale's room after the Front Lawn: a bonus ride of three hearts, lit, no key, no boss, about 30 seconds long", () => {
  assert.equal(MAT_ROOM.ready, true, "plays in a run");
  const fin = ghoul.FINALE.rooms;
  assert.equal(fin[0], "lawn");
  assert.equal(fin[1], "mat", "straight after the Front Lawn");
  assert.deepEqual([ROOM.title, ROOM.sub], ["Down the Hatch", "Wipe your feet"]);
  assert.equal(ROOM.dark, false, "always lit");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "mat");
  assert.equal(R.hearts, 3, "three hearts, not five");
  assert.equal(typeof ghoul.ROOM_MUSIC.mat, "string", "a track to play");
  assert.deepEqual(Object.keys(mt.MAT.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.mat, MAT_LOOKS.mat);
  assert.equal(LOOKS.mat.pack, "mat");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0 && ROOM.items.length === 0, "no monsters and no pickups");
  assert.match(R.how, /UP jump, DOWN duck, SPACE shoot/, "the keys in the how line");
  assert.equal(ROOM.ground.length, 2, "the front step and the cellar floor only");
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 100);
  assert.equal(ROOM.ground[1][0], R.finish);
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14, "the door at the room's end");
  assert.ok(floorOf(ROOM.door - 2) > -Infinity);
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the mat starts on the throat over the front step");
  // About 30 seconds at the mat's speed.
  const secs = (floors.at(-1).x1 - ROOM.start) / mt.MAT_V;
  assert.ok(secs >= 27 && secs <= 34, `${secs.toFixed(1)} s at MAT_V`);
  // The swallows: descents at about 0.10 and short climbs at about 0.3, never steeper.
  let down = 0;
  let total = 0;
  for (const L of floors) {
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const s = slopeAtLine(L, i);
      const len = L.pts[i + 1][0] - L.pts[i][0];
      assert.ok(s >= -0.15 && s <= 0.32, `a slope of ${s.toFixed(3)}`);
      total += len;
      if (s < 0) down += len;
    }
  }
  assert.ok(down / total > 0.6, `${((100 * down) / total).toFixed(0)}% of the throat goes down`);
  for (const L of lines) for (const [, y] of L.pts) assert.ok(y > mt.DERAIL_Y + 4 && y < 46, `a floor height of ${y}`);
  assert.equal(ghoul.timeFor(ghoul.roomFor("mat")), R.time);
  assert.ok(R.time >= 2 * secs * 1000, "the clock never matters on a ride");
  assert.ok(ct.slopeOf(R, R.rails - 1, floors.at(-1).x1) >= mt.RAMP_SLOPE, "the lip launches");
  // The bonus round: three hearts of its own.
  const round = matRound();
  assert.equal(round.bonusRound.hearts, 3);
  assert.equal(round.bonusRound.max, 3);
  assert.equal(round.runner.id, "mat");
});

test("Ghoul Rush's Down the Hatch: the lip's launch alone carries the rider onto the cellar floor at any speed it can have there", () => {
  const lip = floors.at(-1);
  const end = lip.pts.at(-1);
  const rise = ct.slopeOf(R, R.rails - 1, lip.x1);
  const floor = floorOf(R.finish + 1);
  for (const v of [mt.MAT_MIN, 36, mt.MAT_V, 55, mt.MAT_MAX]) {
    let vy = rise * v + mt.RAMP_POP;
    let x = end[0];
    let y = end[1];
    for (let t = 0; t < 3; t += 0.002) {
      vy -= mt.MAT_G * 0.002;
      x += v * 0.002;
      y += vy * 0.002;
      if (vy < 0 && y <= floor) break;
    }
    assert.ok(x >= R.finish + 2 && x <= R.finish + 40, `at ${v} it lands ${(x - R.finish).toFixed(1)} past the floor's start`);
  }
});

test("Ghoul Rush's Down the Hatch: every fork's hole is too wide to jump across and swallows a rider who does not jump, its gristle ledge catches a jump from before the hole at any speed, and off the ledge's end the rider drops back onto the floor", () => {
  assert.equal(R.rails - 1, 2, "two forks");
  assert.equal(ledges.length, 2, "a ledge over each");
  for (let i = 0; i + 1 < R.rails; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 46, `hole ${i} is ${gap} wide, past a jump at bile speed`);
    const end = a.pts.at(-1);
    const slope = ct.slopeOf(R, i, a.x1);
    assert.ok(slope < 0, "holes lie on descents (no ramp launch)");
    // The ledge over it, RAIL_SEP over the throat, from before the hole to past it.
    const n = ledges.findIndex((L) => L.x0 < a.x1 && L.x1 > b.x0);
    assert.ok(n >= 0, `a ledge over hole ${i}`);
    const L = ledges[n];
    const line = R.rails + n;
    assert.ok(a.x1 - L.x0 >= 16 && L.x1 - b.x0 >= 10, "the ledge starts well before the hole and ends past it");
    for (let x = L.x0; x <= Math.min(L.x1, a.x1); x += 2) assert.ok(Math.abs(ct.trackY(R, line, x) - ct.trackY(R, i, x) - mt.RAIL_SEP) < 0.15, `${mt.RAIL_SEP} over at ${x}`);
    assert.ok(mt.upperLine(R, line) && !mt.upperLine(R, i));
    for (const v of [mt.MAT_MIN + 6, mt.MAT_V, 55, mt.BILE_V]) {
      // No jump: into the hole, and a jump with no ledge would not clear it either.
      assert.equal(mt.flight(R, a.x1, end[1], slope * v, v), null, `hole ${i}, no jump, at ${v}`);
      const bare = { ...R, track: R.track.slice(0, R.rails) };
      assert.equal(mt.flight(bare, a.x1 - 2, ct.trackY(R, i, a.x1 - 2), mt.MAT_JUMP_V + slope * v, v), null, `hole ${i} cannot be jumped across at ${v}`);
      // A jump from a few units before the ledge to the hole's edge lands on the ledge.
      for (const x of [L.x0 - 6, L.x0, L.x0 + 8, a.x1 - 1]) {
        const top = ct.linesAt(R, x).find(([ln]) => ln === i);
        const s = mt.flight(R, x, top[1], mt.MAT_JUMP_V + ct.slopeOf(R, i, x) * v, v);
        assert.ok(s && s.line === line, `hole ${i}: a jump from ${x} at ${v} lands on the ledge (${JSON.stringify(s)})`);
      }
    }
    // Off the ledge's end: down onto the floor beyond the hole.
    const tail = L.pts.at(-1);
    const f = mt.flight(R, L.x1, tail[1], ct.slopeOf(R, line, L.x1) * mt.MAT_V, mt.MAT_V);
    assert.ok(f && f.line === i + 1, `off ledge ${n}, onto the floor`);
  }
});

test("Ghoul Rush's Down the Hatch: every thing is on a line and well inside it, spaced for a player (22 between jumps and 38 between a jump and a duck), a uvula's underside between a ducked box and a standing one, the checkpoints every 8 to 10 seconds", () => {
  const jumps = [];
  for (const [x, line] of R.ribs) {
    assert.ok(ct.trackY(R, line, x) !== null, `a rib at ${x} stands on line ${line}`);
    assert.ok(!mt.upperLine(R, line), "ribs grow out of the floor");
    assert.ok(x - lines[line].x0 > 8 && lines[line].x1 - x > 14, `a rib at ${x} well inside its line`);
    jumps.push([x - 2, x + 2]);
  }
  for (const [x, line, kind] of R.furniture) {
    assert.ok(ct.trackY(R, line, x) !== null);
    assert.ok([0, 1, 2].includes(kind));
    assert.ok(x - lines[line].x0 > 20 && lines[line].x1 - x > 14, `furniture at ${x} has room to tumble`);
    jumps.push([x - 12, x + 2]);
  }
  for (const L of ledges) jumps.push([L.x0 - 14, L.x0 + 26]);
  const ducks = [];
  for (const [x0, x1] of R.lows) ducks.push([x0, x1]);
  for (const [x, line] of R.squeezes) {
    assert.ok(ct.trackY(R, line, x) !== null && !mt.upperLine(R, line), `a squeeze at ${x} over the floor`);
    assert.ok(!ledges.some((L) => x > L.x0 - 10 && x < L.x1 + 10), "no ledge near a squeeze");
    ducks.push([x - mt.SQ_W / 2 - 6, x + mt.SQ_W / 2 + 6]);
  }
  jumps.sort((p, q) => p[0] - q[0]);
  for (let i = 0; i + 1 < jumps.length; i++) assert.ok(jumps[i + 1][0] - jumps[i][1] >= 22, `jumps at ${jumps[i][1]} and ${jumps[i + 1][0]}`);
  for (const [d0, d1] of ducks) for (const [j0, j1] of jumps) assert.ok(j0 - d1 >= 38 || d0 - j1 >= 38, `a jump at ${j0} and a duck at ${d0}`);
  for (const [x0, x1, y] of R.lows) {
    let hi = 0;
    let lo = 99;
    for (let x = x0 - K.HIT_W / 2; x <= x1 + K.HIT_W / 2; x += 0.25) {
      const g = ct.linesAt(R, x)[0];
      assert.ok(g, "a floor or a ledge under a uvula");
      hi = Math.max(hi, g[1]);
      lo = Math.min(lo, g[1]);
    }
    assert.ok(hi + K.DUCK_H < y, `a ducked box clears the uvula at ${x0}`);
    assert.ok(lo + K.HIT_H > y, `a standing box hits the uvula at ${x0}`);
  }
  for (const [x0, x1] of R.bile) assert.ok(x1 > x0 && ct.linesAt(R, (x0 + x1) / 2).length, "bile lies on the floor");
  assert.ok(R.ribs.length >= 4 && R.lows.length >= 2 && R.squeezes.length >= 3 && R.furniture.length >= 3 && R.bile.length >= 2);
  // Checkpoints every 8 to 10 seconds of riding, on the floor, clear of a jump coming up.
  const cs = R.checks;
  assert.ok(cs.length >= 3);
  for (let i = 0; i < cs.length; i++) {
    assert.ok(ct.linesAt(R, cs[i]).length, `checkpoint ${i} on the floor`);
    const gap = (cs[i] - (i ? cs[i - 1] : ROOM.start)) / mt.MAT_V;
    assert.ok(gap >= 7.5 && gap <= 10, `${gap.toFixed(1)} s to checkpoint ${i}`);
    for (const [j0, j1] of jumps) assert.ok(j0 - cs[i] > 20 || cs[i] - j1 > 4, `a jump at ${j0} near checkpoint ${i}`);
  }
});

/* ------------------------------------------------------------ the rider */

test("Ghoul Rush's Down the Hatch rolls at MAT_V on the flat, faster down a slope, faster again on bile (BILE_V), never past MAT_MIN or MAT_MAX", () => {
  const flat = synth({ track: FLAT });
  assert.equal(flat.runner.v, mt.MAT_V);
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - mt.MAT_V) < 0.01);
  assert.equal(flat.you.face, 1);
  assert.equal(flat.you.state, "run");
  assert.equal(flat.you.y, 20);
  const down = synth({ track: DOWN });
  run(down, 3000);
  assert.ok(Math.abs(down.runner.v - (mt.MAT_V + (mt.SLOPE_G * 0.1) / mt.RELAX)) < 0.2, `${down.runner.v} down a 0.1 slope`);
  const slick = synth({ track: FLAT, bile: [[0, 4000]] });
  run(slick, 3000);
  assert.ok(Math.abs(slick.runner.v - mt.BILE_V) < 0.2, `${slick.runner.v} on bile`);
  assert.equal(events(slick, "matBile").length, 1, "one word as it starts");
  const steep = synth({ track: [[[0, 10000], [4000, 6000]]] });
  run(steep, 3000);
  assert.equal(steep.runner.v, mt.MAT_MAX);
  const wall = synth({ track: [[[0, 0], [4000, 4000]]] });
  run(wall, 3000);
  assert.equal(wall.runner.v, mt.MAT_MIN);
});

test("Ghoul Rush's Down the Hatch jumps about 13 high for about three quarters of a second, a press saved for a landing jumps on it, and one just after a line's end still jumps", () => {
  const round = synth({ track: FLAT });
  let top = 0;
  press(round);
  const t = until(round, () => {
    top = Math.max(top, round.you.y - 20);
    return round.you.state === "run" && round.you.y === 20 && round.you.vy === 0 && top > 1;
  }, 3000);
  assert.ok(Math.abs(top - (mt.MAT_JUMP_V * mt.MAT_JUMP_V) / (2 * mt.MAT_G)) < 0.4, `${top.toFixed(1)} high`);
  assert.ok(t > 650 && t < 850, `${t} ms in the air`);
  assert.equal(events(round, "matJump").length, 1);
  assert.equal(events(round, "matLand").length, 1);
  const buf = synth({ track: FLAT });
  press(buf);
  run(buf, 640);
  press(buf);
  until(buf, () => events(buf, "matJump").length >= 2, 1500);
  assert.equal(events(buf, "matJump").length, 2, "the saved press jumped again at the landing");
  const edge = synth({ track: [[[0, 20], [60, 20]], [[150, 20], [300, 20]]] });
  rideAt(edge, 58.5, 0);
  run(edge, 80);
  assert.equal(edge.runner.line, -1, "off the end");
  press(edge);
  run(edge, 4);
  assert.equal(events(edge, "matJump").length, 1, "coyote");
});

test("Ghoul Rush's Down the Hatch: DOWN ducks; a ducked rider passes under a uvula-lamp and a standing one or a jumping one hits it (cause matUvula), a heart and not a life, once", () => {
  const duck = synth({ track: FLAT, lows: [[60, 67, 23.0]] });
  run(duck, 20, { down: true });
  assert.equal(events(duck, "matDuck").length, 1);
  duck.input.down = true;
  until(duck, () => duck.you.x > 75, 3000);
  duck.input.down = false;
  assert.equal(duck.bonusRound.hearts, 3);
  const hit = synth({ track: FLAT, lows: [[60, 67, 23.0]] });
  until(hit, () => hit.bonusRound.hearts < 3, 3000);
  assert.equal(hit.bonusRound.hearts, 2);
  assert.equal(hit.lives, 3, "not a life");
  assert.equal(events(hit, "lose")[0].cause, "matUvula");
  assert.equal(events(hit, "matCrash")[0].what, "uvula");
  assert.equal(hit.phase, "play", "the ride rolls on");
  assert.ok(hit.you.safeMs > 0, "blinking safe");
  assert.deepEqual(hit.bonusRound.perf.hits, ["u0"]);
  run(hit, 1000);
  assert.equal(hit.bonusRound.hearts, 2, "the same uvula costs nothing twice");
  const jump = synth({ track: FLAT, lows: [[60, 67, 23.0]] });
  rideAt(jump, 40, 0);
  press(jump);
  until(jump, () => jump.bonusRound.hearts < 3 || jump.you.x > 80, 3000);
  assert.equal(jump.bonusRound.hearts, 2, "a jump does not clear a uvula");
});

test("Ghoul Rush's Down the Hatch: a rib bone is cleared by a jump from 9 to 26 short of it and costs a heart otherwise (cause matRib), once", () => {
  const hit = synth({ track: FLAT, ribs: [[60, 0]] });
  until(hit, () => hit.bonusRound.hearts < 3, 3000);
  assert.equal(hit.bonusRound.hearts, 2);
  assert.equal(events(hit, "lose")[0].cause, "matRib");
  assert.equal(events(hit, "matCrash")[0].what, "rib");
  assert.deepEqual(hit.bonusRound.perf.hits, ["r0"]);
  run(hit, 500);
  assert.equal(hit.bonusRound.hearts, 2);
  for (const from of [60 - 26, 60 - 14, 60 - 9]) {
    const clear = synth({ track: FLAT, ribs: [[60, 0]] });
    rideAt(clear, from, 0);
    press(clear);
    until(clear, () => clear.you.x > 80, 3000);
    assert.equal(clear.bonusRound.hearts, 3, `jumped from ${from}`);
  }
  // A ducked rider is no lower than a rib.
  const low = synth({ track: FLAT, ribs: [[60, 0]] });
  low.input.down = true;
  until(low, () => low.you.x > 70, 3000);
  assert.equal(low.bonusRound.hearts, 2, "ducking does not pass a rib");
});

/* ------------------------------------------------------- peristalsis */

test("Ghoul Rush's Down the Hatch: a squeeze waits, then throbs SQ_WARN_MS (two throbs heard, the walls pulsing) at least 1.5 s before you reach it, closes, holds shut while you pass and eases; a ducked rider passes under it", () => {
  const round = synth({ track: FLAT, squeezes: [[200, 0]] });
  rideAt(round, 40, 0);
  const s = () => round.runner.squeezes[0];
  assert.equal(s().state, "wait");
  run(round, 100);
  assert.equal(s().state, "wait", "far off: waiting");
  until(round, () => s().state === "throb", 5000);
  const ahead = 200 - round.you.x;
  assert.ok(ahead / round.runner.v >= 1.5, `it throbs ${(ahead / round.runner.v).toFixed(2)} s ahead`);
  assert.deepEqual(events(round, "matSqueezeThrob").map((e) => e.n), [1]);
  assert.ok(throbAt(round.spec.ride, round.runner, 200) > 0, "the walls throb near it");
  assert.equal(throbAt(round.spec.ride, round.runner, 280), 0, "and not far from it");
  assert.equal(mt.squeezeLow(s()), mt.SQ_OPEN, "still open while it throbs");
  const half = until(round, () => events(round, "matSqueezeThrob").length >= 2, 2000);
  assert.ok(Math.abs(half - mt.SQ_WARN_MS / 2) < 20, `the second throb ${half} ms in`);
  assert.equal(events(round, "matSqueezeThrob")[1].n, 2);
  until(round, () => s().state === "close", 2000);
  assert.equal(events(round, "matSqueezeClose").length, 1);
  until(round, () => s().state === "shut", 1000);
  assert.equal(mt.squeezeLow(s()), mt.SQ_LOW);
  const early = 200 - mt.SQ_W / 2 - round.you.x;
  assert.ok(early > 8, `shut ${early.toFixed(1)} before you reach it`);
  // Ducked through it: nothing.
  round.input.down = true;
  until(round, () => round.you.x > 215, 2000);
  round.input.down = false;
  assert.equal(round.bonusRound.hearts, 3, "ducked under it");
  assert.equal(s().state, "shut", "still shut as you leave it");
  until(round, () => s().state === "done", 3000);
  assert.equal(mt.squeezeLow({ state: "ease", t: mt.SQ_EASE_MS }), mt.SQ_LOW);
  assert.equal(mt.squeezeLow({ state: "ease", t: 0 }), mt.SQ_OPEN);
  // At bile speed it still throbs well ahead and is shut before you arrive.
  const fast = synth({ track: FLAT, squeezes: [[300, 0]], bile: [[0, 4000]] });
  rideAt(fast, 40, 0, { v: mt.BILE_V });
  until(fast, () => fast.runner.squeezes[0].state === "shut", 6000);
  assert.ok(300 - mt.SQ_W / 2 - fast.you.x > 8, "shut before you get there at bile speed too");
});

test("Ghoul Rush's Down the Hatch: a squeeze shut over you costs a heart standing or jumping (cause matSqueeze), and nothing while it is still open", () => {
  const stand = synth({ track: FLAT, squeezes: [[200, 0]] });
  rideAt(stand, 40, 0);
  until(stand, () => stand.bonusRound.hearts < 3 || stand.you.x > 220, 6000);
  assert.equal(stand.bonusRound.hearts, 2);
  assert.equal(events(stand, "lose")[0].cause, "matSqueeze");
  assert.equal(events(stand, "matCrash")[0].what, "squeeze");
  assert.deepEqual(stand.bonusRound.perf.hits, ["s0"]);
  const hop = synth({ track: FLAT, squeezes: [[200, 0]] });
  rideAt(hop, 40, 0);
  until(hop, () => hop.runner.squeezes[0].state === "shut", 6000);
  until(hop, () => 200 - hop.you.x < 18, 2000);
  press(hop);
  until(hop, () => hop.bonusRound.hearts < 3 || hop.you.x > 220, 3000);
  assert.equal(hop.bonusRound.hearts, 2, "a jump into it hits");
  // Open (a rider placed past its warning), it is nothing.
  const open = synth({ track: FLAT, squeezes: [[200, 0]] });
  rideAt(open, 196, 0);
  open.runner.squeezes[0] = { state: "throb", t: 900, n: 1 };
  run(open, 200);
  assert.equal(open.bonusRound.hearts, 3);
});

/* ----------------------------------------------------------- furniture */

test("Ghoul Rush's Down the Hatch: a piece of furniture drops from the roof FURN_DROP_MS when you are FURN_LEAD_MS short of it, lands, tumbles up at you and hits (cause matFurniture) if you meet it; a jump clears it", () => {
  const hit = synth({ track: FLAT, furniture: [[300, 0, 1]] });
  rideAt(hit, 150, 0);
  const f = () => hit.runner.furniture[0];
  assert.equal(f().state, "wait");
  until(hit, () => f().state === "drop", 5000);
  const ahead = 300 - hit.you.x;
  assert.ok(Math.abs(ahead - (mt.MAT_V * mt.FURN_LEAD_MS) / 1000) < 1, `drops ${ahead.toFixed(1)} ahead`);
  assert.equal(events(hit, "matFurnDrop").length, 1);
  assert.ok(mt.furnitureLift(f()) > 15, "up near the roof");
  assert.equal(hit.bonusRound.hearts, 3, "falling, it hurts nobody far off");
  const ms = until(hit, () => f().state === "roll", 2000);
  assert.ok(Math.abs(ms - mt.FURN_DROP_MS) < 20);
  assert.equal(events(hit, "matFurnLand").length, 1);
  assert.ok(f().x - hit.you.x > 28 && f().x - hit.you.x < 42, `lands ${(f().x - hit.you.x).toFixed(1)} ahead: time to see it`);
  const x0 = f().x;
  run(hit, 100);
  assert.ok(x0 - f().x > mt.FURN_V * 0.09, "it tumbles at you");
  until(hit, () => hit.bonusRound.hearts < 3, 2000);
  assert.equal(events(hit, "lose")[0].cause, "matFurniture");
  assert.equal(events(hit, "matCrash")[0].what, "furniture");
  assert.equal(f().state, "spent");
  assert.deepEqual(hit.bonusRound.perf.hits, ["f0"]);
  const jump = synth({ track: FLAT, furniture: [[300, 0, 0]] });
  rideAt(jump, 150, 0);
  until(jump, () => jump.runner.furniture[0].state === "roll" && jump.runner.furniture[0].x - jump.you.x < 16, 5000);
  press(jump);
  until(jump, () => jump.you.x > 330, 3000);
  assert.equal(jump.bonusRound.hearts, 3);
});

test("Ghoul Rush's Down the Hatch: two bolts break a piece of furniture (FURN_POINTS, an act for the grade), along the slope; what was shot stays shot after a restart", () => {
  const round = synth({ track: DOWN, furniture: [[260, 0, 2]] });
  rideAt(round, 120, 0);
  round.you.safeMs = 1e9;
  const start = round.score;
  round.input.fire = true;
  until(round, () => round.runner.furniture[0].state === "broken", 5000);
  round.input.fire = false;
  assert.equal(round.runner.furniture[0].state, "broken");
  assert.equal(events(round, "matFurnHit").length, mt.FURN_HP - 1);
  assert.equal(events(round, "matFurnBreak")[0].points, mt.FURN_POINTS);
  assert.equal(round.bonusRound.perf.acts, 1);
  assert.ok(round.score - start >= mt.FURN_POINTS);
  // A bolt flies along the slope, not level.
  const probe = synth({ track: DOWN });
  probe.input.fire = true;
  run(probe, 300);
  probe.input.fire = false;
  assert.ok(probe.shots.length > 0);
  for (const s of probe.shots) assert.ok(Math.abs(s.y - (40 - 0.1 * s.x) - ghoul.SHOT_Y) < 0.5, "a bolt over the floor");
  // Nothing to shoot while it waits in the roof.
  const idle = synth({ track: FLAT, furniture: [[300, 0, 0]] });
  assert.equal(mt.MAT.target(idle, { x: 300, y: 22 }), false);
  const again = synth({ track: FLAT, furniture: [[300, 0, 0]] });
  again.runner.furniture[0].state = "broken";
  mt.MAT.place[0](again, {});
  assert.equal(again.runner.furniture[0].state, "broken");
});

/* ------------------------------------------------- forks, holes and hearts */

test("Ghoul Rush's Down the Hatch: a hole with no jump is a heart (cause matPlunge), the rider goes back on the ledge over it (or the floor beyond, with none) at MAT_V and rolls on; a jump onto the ledge passes it, with a switch up and down", () => {
  const ride = { track: [[[0, 20], [100, 20]], [[160, 20], [400, 20]], [[80, 27], [175, 27]]], rails: 2 };
  const fall = synth(ride);
  rideAt(fall, 60, 0);
  until(fall, () => fall.bonusRound.hearts < 3, 3000);
  assert.equal(fall.bonusRound.hearts, 2);
  assert.equal(fall.lives, 3, "not a life");
  assert.equal(events(fall, "lose")[0].cause, "matPlunge");
  assert.equal(fall.phase, "play");
  assert.equal(fall.runner.line, 2, "caught on the ledge over the hole");
  assert.equal(fall.you.y, 27);
  assert.equal(fall.runner.v, mt.MAT_V);
  assert.deepEqual(fall.bonusRound.perf.hits, ["g0"]);
  until(fall, () => fall.you.x > 200, 3000);
  assert.equal(fall.runner.line, 1, "and down off its end onto the floor");
  assert.equal(fall.bonusRound.hearts, 2);
  const bare = synth({ track: [[[0, 20], [100, 20]], [[160, 20], [400, 20]]] });
  rideAt(bare, 60, 0);
  until(bare, () => bare.bonusRound.hearts < 3, 3000);
  assert.equal(bare.runner.line, 1, "with no ledge: on the floor beyond the hole");
  assert.ok(bare.you.x >= 160 && bare.you.x < 165);
  const hop = synth(ride);
  rideAt(hop, 76, 0);
  press(hop);
  until(hop, () => hop.runner.line === 2, 2000);
  assert.equal(hop.runner.line, 2, "on the ledge");
  assert.equal(events(hop, "matSwitch")[0].up, true);
  until(hop, () => hop.you.x > 200, 3000);
  assert.equal(hop.runner.line, 1, "back down on the floor");
  assert.equal(events(hop, "matSwitch")[1].up, false);
  assert.equal(hop.bonusRound.hearts, 3);
});

test("Ghoul Rush's Down the Hatch: the last heart gone ends the round with nothing at once (BONUS LOST: no life lost, the dice in hand kept, no game over) and the run goes on to the next room", () => {
  const round = matRound();
  round.dice = 2;
  round.bonusRound.hearts = 1;
  const [x] = R.ribs[0];
  rideAt(round, x - 10, ct.linesAt(R, x - 10)[0][0]);
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
  run(round, ghoul.CARD_LOST_MS + 100);
  const next = ghoul.FINALE.rooms[ghoul.FINALE.rooms.indexOf("mat") + 1];
  if (next) {
    assert.equal(round.spec.id, next, "on to the next of the House's rooms");
    assert.equal(round.bonusRound, null);
    assert.equal(round.runner ?? null, null);
    assert.equal(round.lives, 3);
    assert.equal(round.dice, 2);
  } else assert.equal(round.won, true, "the last of the House's rooms ready: on to the win");
});

test("Ghoul Rush's Down the Hatch: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart; another ride's slot is not its own", () => {
  const round = matRound();
  rideAt(round, R.checks[0] - 6, ct.linesAt(R, R.checks[0] - 6)[0][0]);
  round.you.safeMs = 1e9;
  until(round, () => round.runner.check >= 0, 4000);
  assert.deepEqual(events(round, "matCheck").map((e) => e.n), [1]);
  const c0 = round.runner.check;
  round.you.x = 1;
  mt.MAT.place[0](round, {});
  assert.equal(round.you.x, R.checks[c0]);
  assert.equal(round.runner.v, mt.MAT_V);
  assert.equal(round.runner.check, c0);
  assert.equal(round.camLead, mt.CAM_AHEAD);
  const fresh = matRound();
  assert.equal(fresh.you.x, ROOM.start);
  assert.equal(fresh.runner.check, -1);
  const other = matRound();
  other.runner = { id: "banister" };
  other.spec = { ...other.spec, ride: { ...other.spec.ride, runner: "banister" } };
  mt.MAT.place[0](other, {});
  assert.deepEqual(other.runner, { id: "banister" });
  other.runner = { id: "mat" };
  mt.MAT.place[0](other, {});
  assert.equal(other.runner, null);
});

test("Ghoul Rush's Down the Hatch: off the lip the rider is spat out onto the cellar floor and stops (matFinish), the door opens, and walking out ends the round with 3 to 8 Lucky dice", () => {
  const round = matRound();
  round.dice = 1;
  const last = R.rails - 1;
  rideAt(round, lines[last].x1 - 12, last, { safe: true });
  until(round, () => round.runner.done, 4000);
  assert.equal(round.runner.done, true);
  assert.equal(events(round, "matLaunch").length, 1);
  assert.equal(events(round, "matLaunch")[0].last, true);
  assert.equal(events(round, "matFinish").length, 1);
  assert.ok(round.you.x > R.finish + 2 && round.you.x < R.finish + 40, `${round.you.x} landed`);
  assert.equal(round.you.y, floorOf(round.you.x));
  assert.equal(round.hasKey, true, "the door opens");
  assert.equal(round.phase, "play");
  round.input.right = true;
  until(round, () => round.phase === "clear", 20000);
  round.input.right = false;
  const end = events(round, "bonusEnd");
  assert.equal(end.length, 1);
  assert.equal(end[0].won, true);
  assert.ok(end[0].dice >= BONUS_FLOOR && end[0].dice <= 8, `${end[0].dice} dice`);
  assert.equal(round.dice, 1 + end[0].dice);
  assert.equal(round.lives, 3);
});

test("Ghoul Rush's Down the Hatch: no random number is drawn in the room (the whole ride, jumping and shooting, on a draw that throws)", () => {
  const round = matRound();
  rideAt(round, 20, 0, { safe: true });
  round.input.fire = true;
  for (let t = 0; t < 30000; t += 4) {
    if (t % 1500 === 0) press(round);
    ghoul.advance(round, 4, never);
    round.events.length = 0;
    round.you.safeMs = 1e9;
    if (round.phase !== "play" || round.runner.done) break;
  }
  assert.ok(round.you.x > 600);
});

/* ----------------------------------------------------------- the grade */

test("Ghoul Rush's Down the Hatch's grade: three hearts earn at most one die of their share, so a perfect ride is 8 dice; shooting every piece of furniture is the acts die, and taking half the souls ('Wipe your feet') the steady one", () => {
  const round = matRound();
  const b = round.bonusRound;
  assert.equal(b.perf.goal, R.furniture.length);
  assert.equal(b.perf.total, R.ribs.length + R.lows.length + R.squeezes.length + R.furniture.length + R.rails - 1);
  assert.equal(b.perf.steady, false, "no souls yet");
  const mk = (perf, hearts = 3) => {
    const x = makeBonus({ stats: { kills: 0 }, spec: { ride: { hearts: 3 } } });
    x.hearts = hearts;
    Object.assign(x.perf, { total: b.perf.total, goal: R.furniture.length }, perf);
    return x;
  };
  assert.equal(diceFor(mk({ hits: [], acts: R.furniture.length, steady: true })), 8, "a perfect ride");
  assert.equal(diceFor(mk({ hits: [], acts: 0, steady: false })), 6);
  assert.equal(diceFor(mk({ hits: [], acts: 0, steady: false }, 2)), 5, "two hearts left: no hearts die");
  assert.equal(diceFor(mk({ hits: ["r0", "r1", "u0", "s0", "s1", "s2", "f0", "f1", "f2", "g0", "g1", "r2", "r3", "r4", "u1", "u2", "s3"], acts: 0, steady: false }, 1)), BONUS_FLOOR);
  // Half the souls taken and the die is earned.
  round.candy.fill(true);
  rideAt(round, 30, 0, { safe: true });
  run(round, 500);
  assert.equal(round.bonusRound.perf.steady, true, "souls taken");
  assert.ok(round.candy.length >= 30, `${round.candy.length} souls along the throat`);
});

test("Ghoul Rush's Down the Hatch: endless lives (round.infinite) spare the hearts for every cause, through the same lose path; the Garlic shield takes a hit instead of a heart", () => {
  const tries = [{ ribs: [[60, 0]] }, { lows: [[56, 62, 23.0]] }, { furniture: [[300, 0, 0]] }, { squeezes: [[200, 0]] }];
  for (const t of tries) {
    const r = synth({ track: FLAT, ...t });
    r.infinite = true;
    if (t.furniture || t.squeezes) rideAt(r, 120, 0);
    until(r, () => events(r, "lose").length > 0, 6000);
    assert.equal(events(r, "lose").length > 0, true, JSON.stringify(Object.keys(t)));
    assert.equal(r.bonusRound.hearts, 3, JSON.stringify(Object.keys(t)));
    assert.equal(r.lives, 3);
  }
  const hole = synth({ track: [[[0, 20], [60, 20]], [[130, 20], [400, 20]]] });
  hole.infinite = true;
  rideAt(hole, 30, 0);
  until(hole, () => events(hole, "lose").length > 0, 3000);
  assert.equal(events(hole, "lose")[0].cause, "matPlunge");
  assert.equal(hole.bonusRound.hearts, 3);
  const garlic = synth({ track: FLAT, ribs: [[60, 0]] });
  garlic.you.garlic = true;
  until(garlic, () => garlic.you.x > 70, 3000);
  assert.equal(garlic.bonusRound.hearts, 3);
  assert.equal(garlic.you.garlic, false, "spent");
});

/* ------------------------------------------------------ sounds and words */

test("Ghoul Rush's Down the Hatch: every event has a voice that plays once, every cause has words and a sound, and the voices are tones that exist (none longer than 1.2 s)", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...mt.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = MAT_VOICES[kind] && MAT_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "rib", points: 150, n: 1, kind: 0 }).played;
    assert.equal(played.filter((p) => p === name).length, 1, `${event} plays ${name} once`);
  }
  for (const [name, tone] of Object.entries(MAT_SFX.tones)) {
    assert.ok(name.startsWith("ghoulMat"), name);
    assert.ok(tones[name], `${name} is merged into the game`);
    const length = Math.max(...tone.layers.map((l) => (l.delay || 0) + l.seconds));
    assert.ok(length <= 1.2, `${name} is ${length.toFixed(2)} s`);
    for (const l of tone.layers) assert.ok(l.gain > 0 && l.gain <= 1, `${name}'s gain`);
  }
  for (const cause of mt.CAUSES) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3 && toneNames().includes(LOSE_SOUNDS[cause][0]), `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 2 }).played.length > 0, `${cause} sounds`);
  }
});

test("Ghoul Rush's Down the Hatch: the room's own names do not collide with the game's (events, causes, tones, the shared rider slot)", () => {
  for (const e of mt.EVENTS) assert.ok(e.startsWith("mat"), e);
  for (const c of mt.CAUSES) assert.ok(c.startsWith("mat"), c);
  assert.deepEqual(Object.keys(mt.MAT).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(matRound().runner.id, "mat");
  assert.equal(matRound().cart, null);
});

/* --------------------------------------------------------------- drawing */

function stubCtx() {
  return new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
}
// A live game in Down the Hatch through the stage select's finale row, its second room.
function selectInto() {
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => stubCtx() } });
  g.resize(900, 900);
  g.stageSelect();
  const p = g.round;
  for (let i = 0; i < ghoul.SELECTABLE.length - 1; i++) ghoul.steerSelect(p, 1, 0);
  ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 1);
  g.tick(16);
  ghoul.takeSelect(p);
  return g;
}

test("Ghoul Rush's Down the Hatch draws: the room lit and dark, the rider on the floor, on a ledge, in the air and ducking, each thing in each state (squeezes waiting, throbbing, closing, shut and easing, furniture falling and tumbling), a crash, the finish and the cards; the stage select goes straight into it", () => {
  const g = selectInto();
  const r = g.round;
  assert.equal(r.spec.id, "mat");
  assert.equal(r.runner.line, 0);
  assert.equal(r.you.y, ct.trackY(R, 0, ROOM.start));
  assert.equal(r.bonusRound.hearts, 3);
  r.lives = 99;
  const spots = [ROOM.start + 4, R.ribs[0][0] - 10, R.lows[0][0] - 5, R.squeezes[0][0] - 14, R.furniture[0][0] - 20, R.bile[0][0] + 6, R.checks[0], ledges[0].x0 + 20, lines[0].x1 + 10, R.finish - 30];
  const SQ = ["wait", "throb", "close", "shut", "ease", "done"];
  const FU = ["wait", "drop", "roll", "broken", "spent"];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.monsters.length = 0;
      const top = ct.linesAt(R, x)[0] || [R.rails - 1, 20];
      rideAt(r, x, top[0], { safe: true });
      r.runner.squeezes = r.runner.squeezes.map((s, i) => ({ state: SQ[(i + (x | 0)) % SQ.length], t: 300, n: 1 }));
      r.runner.furniture = r.runner.furniture.map((f, i) => ({ ...f, state: FU[(i + (x | 0)) % FU.length], t: 400 }));
      for (const air of [false, true]) {
        if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
        if (air) r.runner.line = -1;
        r.you.ducking = !air && x === R.lows[0][0] - 5;
        r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
        for (let k = 0; k < 4; k++) g.tick(16);
        r.you.safeMs = 1e9;
        rideAt(r, x, top[0], { safe: true });
      }
    }
  }
  // A crash.
  r.you.safeMs = 0;
  rideAt(r, R.ribs[0][0] - 3, R.ribs[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  // The finish, the won and lost cards.
  const done = selectInto();
  const d = done.round;
  d.phase = "play";
  d.runner.done = true;
  d.runner.restX = R.finish + 20;
  Object.assign(d.you, { x: R.finish + 30, y: floorOf(R.finish + 30), state: "run" });
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
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Down the Hatch telegraphs: JUMP over ribs and at each fork's ledge, DUCK under uvulas and squeezes, none for furniture (it warns by itself), words only on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  const answers = { rib: "JUMP", fork: "JUMP", uvula: "DUCK", squeeze: "DUCK" };
  assert.equal(marks.length, R.ribs.length + ledges.length + R.lows.length + R.squeezes.length);
  for (const m of marks) assert.equal(m.answer, answers[m.kind], m.kind);
  const m = marks.find((q) => q.kind === "squeeze");
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "squeeze" && t.lead === m.lead) || { alpha: 0 }).alpha;
  assert.equal(alphaOf(m.lead - 45), 0, "not yet in view");
  assert.ok(alphaOf(m.lead - 36) > 0 && alphaOf(m.lead - 36) < 1, "fading in");
  assert.equal(alphaOf(m.lead - 10), 1);
  assert.equal(alphaOf(m.lead + 7), 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  for (const kind of ["rib", "squeeze"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((t) => t.lead === q.lead && t.kind === kind);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
});

/* ----------------------------------------------------------- the bots */

// A bot that rides well: it jumps 9 to 15 short of a rib, onto each fork's ledge a few units before
// it starts, over a piece of furniture tumbling at it when it is 6 to 17 short (and holds the
// blaster, which usually breaks it first), and ducks under every uvula and every squeeze. `miss`
// is the share of things it fails to dodge (by a hash).
const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
function goodBot(round, seed, miss = 0.04) {
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
    const line = c.line;
    const onFloor = !mt.upperLine(R, line);
    for (const [x, ln] of R.ribs) if (ln === line && x - you.x > 6 && x - you.x < look && ok(x)) jump = true;
    if (onFloor) for (const L of ledges) if (L.x0 - you.x > 1 && L.x0 - you.x < 6 && ok(L.x0)) jump = true;
    R.furniture.forEach(([, ln], i) => {
      const f = c.furniture[i];
      if (ln === line && f.state === "roll" && f.x - you.x > 6 && f.x - you.x < 17 && ok(f.x)) jump = true;
    });
    for (const [x0, x1] of R.lows) if (you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
    for (const [x] of R.squeezes) if (you.x > x - mt.SQ_W / 2 - 10 && you.x < x + mt.SQ_W / 2 + 3 && ok(x)) inp.down = true;
  }
  if (jump && !inp.down) press(round);
  else inp.up = false;
}
function idleBot(round) {
  const inp = round.input;
  inp.left = inp.right = inp.down = false;
  inp.up = false;
  inp.fire = true;
}
function rideWith(seed, bot, limit = 60000) {
  const round = matRound(seed);
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

test("Ghoul Rush's Down the Hatch: a bot that rides well finishes the whole throat in about 30 seconds, 5 to 8 dice, a heart lost at most, past every checkpoint, never a run life", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 26000 && ms < 38000, `${ms} ms`);
    assert.ok(b.dice >= 5 && b.dice <= 8, `${b.dice} dice`);
    assert.ok(lost.length <= 1, `lost ${lost.join(",")}`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.check, R.checks.length - 1, "past every checkpoint");
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 6, `${dice.join(",")}`);
});

test("Ghoul Rush's Down the Hatch: a bot that never dodges (holding fire) loses all three hearts early, ends with 0 dice (BONUS LOST), and the run goes on: no game over, never a run life", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { round, lost } = rideWith(seed, idleBot);
    const b = round.bonusRound;
    assert.equal(b.won, false, "never finishes");
    assert.equal(b.dice, 0);
    assert.equal(b.hearts, 0);
    assert.equal(lost.length, 3, `lost ${lost.join(",")}`);
    assert.ok(round.you.x < ROOM.length * 0.4, `out at ${round.you.x}`);
    assert.equal(round.lives, 3);
    assert.equal(round.over, false);
    assert.equal(round.phase, "clear", "the lost card, then the next room");
  }
});

test("Ghoul Rush's Down the Hatch's intro banner says the controls plainly", () => {
  assert.match(R.how, /UP jump/);
  assert.match(R.how, /DOWN duck/);
  assert.match(R.how, /SPACE shoot/);
  assert.match(R.how, /throb/);
});
