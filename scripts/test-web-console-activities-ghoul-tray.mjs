// Web console tests, Ghoul Rush's Servants' Back Stairs (the East Wing's bonus round, between the Attic and the Crypt): its shape (every gap between flights clears with a jump and swallows a tray that does not jump, every low can be ducked, spacing, checkpoints, greased stretches, the clock), the tray's speed on slopes and grease, its jump and duck, a pot, cutlery, a ham, pans, the cook's dish, the domes and plates (the courses), the cherries, a fall down the stairs, the checkpoint, the jump off the last shelf and the door, the bonus round's hearts and dice (3 to 9), endless lives for every new cause, a voice for every event, the drawing, and bots that ride the whole route (one that dodges well, one that never does).
// Run with: node --test scripts/test-web-console-activities-ghoul-tray.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as tr from "../src/web-console/public/activities/ghoul-rush/rides/tray/ghoul-tray.js";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import * as sl from "../src/web-console/public/activities/ghoul-rush/rides/sled/ghoul-sled.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as TRAY_LOOKS, VOICES as TRAY_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/tray/ghoul-tray-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the tray drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Servants' Back Stairs reached the way play reaches it, nothing woken, the clocks
// long, the bonus round on (five hearts).
function trayRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["wing"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "tray") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "tray", time: 1e9, finish: 1e6, track: [], pots: [], lows: [], cooks: [], domes: [], plates: [], grease: [], checks: [] };
// The same round over a ride of its own (a plain track to measure the tray on).
function synth(ride) {
  const round = trayRound();
  round.runner = null;
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, ...ride } };
  tr.TRAY.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [4000, 20]]];
const DOWN = [[[0, 40], [4000, 40 - 0.15 * 4000]]];
const UP = [[[0, 0], [4000, 0.3 * 4000]]];

// The tray on line `line` of the ride at `x`, at speed `v`.
function trayAt(round, x, line, { v = tr.TRAY_V, safe = false } = {}) {
  const y = ct.trackY(round.spec.ride, line, x);
  assert.ok(y !== null, `line ${line} runs under ${x}`);
  Object.assign(round.you, { x, y, vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
  Object.assign(round.runner, { line, v, coyote: 0 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 24));
}

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const key of Object.keys(keys)) round.input[key] = typeof keys[key] === "number" ? 0 : false;
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

const ROOM = ghoul.roomById("tray");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const slopeAtLine = (L, i) => (L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0]);

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Servants' Back Stairs is the East Wing's fourth room, between the Attic and the Crypt: lit, no key, no boss, no pickups, a ride about 60 to 70 seconds long, a bonus round with its own track", () => {
  const st = ghoul.stageById("wing");
  assert.deepEqual(st.rooms, ["kitchen", "conservatory", "attic", "tray", "crypt"]);
  assert.equal(st.boss, ghoul.roomById("crypt").boss);
  assert.deepEqual([ROOM.title, ROOM.sub], ["Last Orders", "Dinner is served. You are dinner"]);
  assert.equal(ROOM.dark, false);
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "tray");
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3400, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.tray, "ghoulTrayRide");
  assert.ok(ghoulSfx.default.music.ghoulTrayRide, "its own track");
  assert.deepEqual(Object.keys(tr.TRAY.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.tray, TRAY_LOOKS.tray);
  assert.equal(LOOKS.tray.pack, "tray");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]) && Object.isFrozen(R.domes[0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0 && ROOM.items.length === 0, "no monsters and no pickups: the things on the route are the pack's own");
  assert.equal(ROOM.ground.length, 2);
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 100, "floor only at the ends");
  assert.equal(ROOM.ground[1][0], R.finish);
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14);
  assert.ok(floorOf(ROOM.door - 2) > -Infinity, "floor to walk out on");
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the tray starts over the landing");
  const secs = (lines.at(-1).x1 - ROOM.start) / tr.TRAY_V;
  assert.ok(secs >= 62 && secs <= 80, `${secs.toFixed(1)} s at TRAY_V`);
  // Every line stays inside the room, clear of the roof and of the fall.
  for (const L of lines) for (const [, y] of L.pts) assert.ok(y > 8 && y < 40, `a track height of ${y}`);
  // Stairs fall about 0.17, shelves climb about 0.28 or run flat, nothing steeper.
  for (const L of lines) {
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const s = slopeAtLine(L, i);
      assert.ok(s >= -0.2 && s <= 0.32, `a slope of ${s.toFixed(3)}`);
    }
  }
  assert.equal(lines.length, 18);
  assert.deepEqual([R.pots.length, R.lows.length, R.cooks.length], [16, 11, 4]);
  assert.ok(R.domes.length >= 12 && R.plates.length >= 10, "more courses than the seven a meal needs");
  assert.ok(R.domes.length + R.plates.length >= 3 * tr.COURSES_GOAL, "a seven course meal is within reach, not a given");
  assert.ok(R.domes.some(([, , lift]) => lift === 0) && R.domes.some(([, , lift]) => lift >= 5), "some domes on the track, some in the air");
  assert.ok(R.plates.some(([, , lift]) => lift <= 3) && R.plates.some(([, , lift]) => lift >= 4), "plates to shoot standing and from a jump");
  assert.ok(ROOM.candy.length >= 200, "cherries all along");
  assert.match(R.how, /UP to jump, DOWN to duck/);
});

test("Ghoul Rush's Servants' Back Stairs: the lip's launch alone carries the tray onto the dining table at any speed it can have there, landing 2 to 40 past its start", () => {
  const lip = lines.at(-1);
  const end = lip.pts.at(-1);
  const rise = ct.slopeOf(R, lines.length - 1, lip.x1);
  assert.ok(rise >= tr.RAMP_SLOPE, "the last shelf ends rising");
  const table = floorOf(R.finish + 1);
  for (const v of [tr.TRAY_MIN, 34, tr.TRAY_V, 55, tr.GREASE_V, tr.TRAY_MAX]) {
    let vy = rise * v + tr.RAMP_POP;
    let x = end[0];
    let y = end[1];
    for (let t = 0; t < 3; t += 0.002) {
      vy -= tr.TRAY_G * 0.002;
      x += v * 0.002;
      y += vy * 0.002;
      if (vy < 0 && y <= table) break;
    }
    assert.ok(x >= R.finish + 2 && x <= R.finish + 40, `at ${v} it lands ${x - R.finish} past the table's start`);
  }
});

test("Ghoul Rush's Servants' Back Stairs: every gap between flights clears with a jump at the edge or a few units early, and a tray that never jumps drops into it", () => {
  assert.equal(lines.length - 1, 17, "seventeen gaps");
  for (let i = 0; i + 1 < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 9 && gap <= 18, `gap ${i} is ${gap} wide`);
    const end = a.pts.at(-1);
    const slope = ct.slopeOf(R, i, a.x1);
    assert.ok(slope < 0, "gaps lie at the foot of a flight (no ramp launch)");
    for (const v of [40, 44, 50, 60]) {
      assert.equal(tr.flight(R, a.x1, end[1], slope * v, v), null, `gap ${i}, no jump, at ${v}`);
      for (const early of [0, 4]) {
        const x = a.x1 - early;
        const y = ct.trackY(R, i, x);
        const s = tr.flight(R, x, y, tr.TRAY_JUMP_V + ct.slopeOf(R, i, x) * v, v);
        assert.ok(s, `gap ${i}: a jump ${early} early at ${v} lands`);
        assert.equal(s.line, i + 1, `gap ${i} cleared, at ${v}, ${early} early`);
      }
    }
  }
});

// The kit's numbers the room is built to.
function k() {
  return { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };
}

test("Ghoul Rush's Servants' Back Stairs: every thing is on a line, off the ends, spaced for a player (22 between jumps and 38 between a jump and a duck), greased stretches flat, a low's underside between a ducked box and a standing one", () => {
  const jumps = [];
  for (const [x, line, kind] of R.pots) {
    assert.ok(ct.trackY(R, line, x) !== null, `a pot at ${x} stands on line ${line}`);
    jumps.push([x - (kind ? 2.4 : 2), x + (kind ? 2.4 : 2)]);
    assert.ok(x - lines[line].x0 > 8 && lines[line].x1 - x > 14, `a pot at ${x} well inside its line`);
  }
  // A cook's dish meets the tray about 14 to 2 short of him.
  for (const [x, line] of R.cooks) {
    assert.ok(ct.trackY(R, line, x) !== null);
    assert.ok(x - lines[line].x0 > 50 && lines[line].x1 - x > 14, `a cook at ${x} well inside his line`);
    jumps.push([x - 14, x - 2]);
  }
  for (let i = 0; i + 1 < lines.length; i++) jumps.push([lines[i].x1, lines[i + 1].x0]);
  const ducks = R.lows.map(([x0, x1]) => [x0, x1]);
  jumps.sort((a, b) => a[0] - b[0]);
  for (let i = 0; i + 1 < jumps.length; i++) assert.ok(jumps[i + 1][0] - jumps[i][1] >= 22, `jumps at ${jumps[i][1]} and ${jumps[i + 1][0]}`);
  for (const [d0, d1] of ducks) {
    for (const [j0, j1] of jumps) assert.ok(j0 - d1 >= 38 || d0 - j1 >= 38, `a jump at ${j0} and a duck at ${d0}`);
  }
  for (let i = 0; i < ducks.length; i++) {
    const [x0, x1, y, kind] = R.lows[i];
    assert.ok(kind === 0 || kind === 1);
    let hi = 0;
    let lo = 99;
    for (let x = x0 - k().HIT_W / 2; x <= x1 + k().HIT_W / 2; x += 0.25) {
      const g = ct.linesAt(R, x)[0];
      assert.ok(g, "a shelf under a low");
      hi = Math.max(hi, g[1]);
      lo = Math.min(lo, g[1]);
    }
    assert.ok(hi + k().DUCK_H < y, `a ducked box clears the low at ${x0}`);
    assert.ok(lo + k().HIT_H > y, `a standing box hits the low at ${x0}`);
    for (const [j0, j1] of ducks) if (j0 !== x0) assert.ok(j0 - x1 > 20 || x0 - j1 > 20);
  }
  // The grease: on flat shelf only, and nothing in it spaced shorter than the faster tray needs (30).
  assert.equal(R.grease.length, 5);
  for (const [a, b] of R.grease) {
    for (let x = a; x <= b; x += 1) {
      const line = ct.linesAt(R, x)[0][0];
      assert.equal(ct.slopeOf(R, line, x), 0, `grease at ${x} is on the flat`);
    }
    const inside = jumps.filter(([j0, j1]) => j1 > a - 30 && j0 < b + 30);
    for (let i = 0; i + 1 < inside.length; i++) assert.ok(inside[i + 1][0] - inside[i][1] >= 30, `jumps at ${inside[i][1]} and ${inside[i + 1][0]} on the grease`);
  }
  // Checkpoints every 300 to 400 units, each on a shelf and clear of a thing.
  const cs = R.checks;
  for (let i = 0; i < cs.length; i++) {
    assert.ok(ct.linesAt(R, cs[i]).length, `checkpoint ${i} on a shelf`);
    if (i) assert.ok(cs[i] - cs[i - 1] >= 300 && cs[i] - cs[i - 1] <= 400, `${cs[i] - cs[i - 1]} between checkpoints`);
    for (const [j0, j1] of jumps) assert.ok(j0 - cs[i] > 20 || cs[i] - j1 > 4, `a thing at ${j0} near checkpoint ${i}`);
  }
  assert.ok(cs[0] < 450 && R.finish - cs.at(-1) > 200);
});

/* ------------------------------------------------------------ the tray */

test("Ghoul Rush's Servants' Back Stairs: the tray rolls at TRAY_V on the flat, GREASE_V on the grease, faster down a flight and slower up a shelf, never past TRAY_MIN or TRAY_MAX, and no key changes it", () => {
  const flat = synth({ track: FLAT });
  run(flat, 3000);
  assert.ok(Math.abs(flat.runner.v - tr.TRAY_V) < 0.5, `${flat.runner.v} on the flat`);
  const slick = synth({ track: FLAT, grease: [[0, 4000]] });
  run(slick, 4000);
  assert.ok(Math.abs(slick.runner.v - tr.GREASE_V) < 0.5, `${slick.runner.v} on the grease`);
  assert.ok(tr.GREASE_V > tr.TRAY_V + 10, "a real pickup");
  const down = synth({ track: DOWN });
  run(down, 4000);
  assert.ok(down.runner.v > tr.TRAY_V && down.runner.v <= tr.TRAY_MAX);
  const up = synth({ track: UP });
  run(up, 4000);
  assert.ok(up.runner.v < tr.TRAY_V && up.runner.v >= tr.TRAY_MIN);
  const keyed = synth({ track: FLAT });
  run(keyed, 3000, { left: true });
  assert.ok(Math.abs(keyed.runner.v - tr.TRAY_V) < 0.5, "left does not brake");
  run(keyed, 1000, { right: true });
  assert.ok(Math.abs(keyed.runner.v - tr.TRAY_V) < 0.5, "right does not lean");
  assert.equal(greasyAt(slick, 100), true);
  assert.equal(greasyAt(flat, 100), false);
});
function greasyAt(round, x) {
  return tr.greasy(round.spec.ride, x);
}

test("Ghoul Rush's Servants' Back Stairs: the tray jumps about 13 high for about three quarters of a second, a press saved for a landing jumps on it, one just after a line's end still jumps", () => {
  const round = synth({ track: FLAT });
  press(round);
  let peak = 0;
  const start = round.you.y;
  let t = 0;
  for (; t < 2000; t += 4) {
    ghoul.advance(round, 4, steady);
    peak = Math.max(peak, round.you.y - start);
    if (t > 40 && round.runner.line >= 0) break;
  }
  round.input.up = false;
  assert.ok(peak > 12 && peak < 14.5, `${peak} high`);
  assert.ok(t > 650 && t < 850, `${t} ms in the air`);
  assert.equal(events(round, "trayJump").length, 1);
  assert.equal(events(round, "trayLand").length, 1);
  const edge = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  trayAt(edge, 59, 0);
  run(edge, 40);
  assert.equal(edge.runner.line, -1, "off the end");
  press(edge);
  run(edge, 8);
  assert.equal(events(edge, "trayJump").length, 1, "the grace jump");
});

test("Ghoul Rush's Servants' Back Stairs: down ducks (and a press of up jumps instead of ducking), a ducked Planny passes under a ham or pans and a standing one hits them (causes ham and pans), at the cost of a heart", () => {
  for (const [kind, cause] of [[0, "ham"], [1, "pans"]]) {
    const round = synth({ track: FLAT, lows: [[60, 66, 23.0, kind]] });
    run(round, 20, { down: true });
    assert.equal(events(round, "trayDuck").length, 1);
    round.input.down = true;
    until(round, () => round.you.x > 75, 3000);
    round.input.down = false;
    assert.equal(round.bonusRound.hearts, 5);
    const hit = synth({ track: FLAT, lows: [[60, 66, 23.0, kind]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4);
    assert.equal(hit.lives, 3, "not a life");
    assert.equal(events(hit, "lose")[0].cause, cause);
    assert.equal(events(hit, "trayCrash")[0].what, cause);
    assert.equal(hit.phase, "play", "the ride plays on");
    assert.ok(hit.you.safeMs > 0, "blinking safe");
    assert.deepEqual(hit.bonusRound.perf.hits, ["l0"]);
    run(hit, 1000);
    assert.equal(hit.bonusRound.hearts, 4, "the same low costs nothing twice");
  }
  const jump = synth({ track: FLAT, lows: [[60, 66, 23.0, 0]] });
  trayAt(jump, 40, 0);
  press(jump);
  until(jump, () => jump.bonusRound.hearts < 5 || jump.you.x > 80, 3000);
  assert.equal(jump.bonusRound.hearts, 4, "a jump does not clear a low");
  const both = synth({ track: FLAT });
  both.input.down = true;
  press(both);
  run(both, 20);
  assert.equal(both.you.ducking, false);
  assert.equal(events(both, "trayJump").length, 1);
});

test("Ghoul Rush's Servants' Back Stairs: a rolling pot and a drop of cutlery are cleared by a jump and cost a heart otherwise (causes pot and cutlery), each only once", () => {
  for (const [kind, cause] of [[0, "pot"], [1, "cutlery"]]) {
    const hit = synth({ track: FLAT, pots: [[60, 0, kind]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4);
    assert.equal(events(hit, "lose")[0].cause, cause);
    assert.deepEqual(hit.bonusRound.perf.hits, ["p0"]);
    run(hit, 1500);
    assert.equal(hit.bonusRound.hearts, 4, "once");
    const clear = synth({ track: FLAT, pots: [[60, 0, kind]] });
    trayAt(clear, 60 - 14, 0);
    press(clear);
    until(clear, () => clear.you.x > 80, 3000);
    assert.equal(clear.bonusRound.hearts, 5, `a jump clears ${cause}`);
  }
});

test("Ghoul Rush's Servants' Back Stairs: a cook wakes COOK_NEAR short, winds up, flings a dish that flies back along the track (jump it: cause dish otherwise), and one bolt shoots the cook (150 points) or the dish", () => {
  const room = () => synth({ track: FLAT, cooks: [[220, 0]] });
  const hit = room();
  trayAt(hit, 100, 0);
  until(hit, () => hit.runner.cooks[0].state === "up", 3000);
  assert.ok(hit.runner.cooks[0].state === "up" && 220 - hit.you.x <= tr.COOK_NEAR && 220 - hit.you.x > tr.COOK_NEAR - 6);
  assert.equal(events(hit, "trayCookUp").length, 1);
  until(hit, () => hit.runner.cooks[0].dish, 1500);
  assert.equal(events(hit, "trayToss").length, 1);
  assert.ok(hit.runner.cooks[0].dish.x < 220);
  until(hit, () => hit.bonusRound.hearts < 5, 3000);
  assert.equal(hit.bonusRound.hearts, 4);
  assert.equal(events(hit, "lose")[0].cause, "dish");
  assert.deepEqual(hit.bonusRound.perf.hits, ["c0"]);
  assert.equal(hit.runner.cooks[0].dish, null, "the dish is spent");
  // A jump as it comes clears it.
  const jump = room();
  trayAt(jump, 100, 0);
  for (let t = 0; t < 6000 && jump.you.x < 240; t += 4) {
    const d = jump.runner.cooks[0].dish;
    if (d && d.x - jump.you.x < 14 && d.x - jump.you.x > 4 && jump.runner.line >= 0) press(jump);
    ghoul.advance(jump, 4, steady);
  }
  jump.input.up = false;
  assert.equal(jump.bonusRound.hearts, 5, "jumped");
  // The cook shot while winding up: 150 points, no dish ever.
  const shoot = room();
  trayAt(shoot, 100, 0);
  const score = shoot.score;
  shoot.input.fire = true;
  until(shoot, () => shoot.runner.cooks[0].state === "broken", 3000);
  shoot.input.fire = false;
  assert.equal(shoot.runner.cooks[0].state, "broken");
  assert.equal(events(shoot, "trayCookHit")[0].points, tr.COOK_POINTS);
  assert.ok(shoot.score - score >= tr.COOK_POINTS);
  run(shoot, 3000);
  assert.equal(shoot.bonusRound.hearts, 5, "no dish");
  assert.equal(events(shoot, "trayToss").length, 0);
  // A dish shot out of the air breaks (nothing scored).
  const dish = room();
  trayAt(dish, 100, 0);
  until(dish, () => dish.runner.cooks[0].dish, 3000);
  dish.runner.cooks[0].state = "spent";
  dish.input.fire = true;
  until(dish, () => !dish.runner.cooks[0].dish, 1500);
  dish.input.fire = false;
  assert.equal(events(dish, "trayDishBreak").length, 1);
  assert.equal(dish.bonusRound.perf.acts, 0, "not a course");
});

test("Ghoul Rush's Servants' Back Stairs: running through a dome serves a course (80 points; a high one takes a jump), and a plate is served by a bolt, not by touching it (120 points)", () => {
  const round = synth({ track: FLAT, domes: [[60, 0, 0], [100, 0, 7]] });
  const score = round.score;
  until(round, () => round.runner.domes[0], 3000);
  assert.equal(round.runner.domes[0], true);
  assert.equal(round.runner.served, 1);
  assert.equal(round.bonusRound.perf.acts, 1);
  assert.equal(events(round, "trayDome")[0].n, 1);
  assert.equal(events(round, "trayDome")[0].points, tr.DOME_POINTS);
  assert.ok(round.score - score >= tr.DOME_POINTS);
  until(round, () => round.you.x > 130, 3000);
  assert.equal(round.runner.domes[1], false, "a high dome is not run through");
  const hop = synth({ track: FLAT, domes: [[100, 0, 7]] });
  trayAt(hop, 92, 0);
  press(hop);
  until(hop, () => hop.runner.domes[0] || hop.you.x > 130, 3000);
  hop.input.up = false;
  assert.equal(hop.runner.domes[0], true, "a jump takes a high dome");
  // A plate: touching it, even jumping through it, serves nothing.
  const touch = synth({ track: FLAT, plates: [[100, 0, 2.4]] });
  trayAt(touch, 86, 0);
  press(touch);
  until(touch, () => touch.you.x > 130, 3000);
  touch.input.up = false;
  assert.equal(touch.runner.plates[0], false);
  assert.equal(touch.runner.served, 0);
  // Shot with a standing bolt, it is served.
  const shot = synth({ track: FLAT, plates: [[100, 0, 2.4]] });
  shot.input.fire = true;
  until(shot, () => shot.runner.plates[0], 3000);
  shot.input.fire = false;
  assert.equal(shot.runner.plates[0], true);
  assert.equal(shot.runner.served, 1);
  assert.equal(events(shot, "trayPlate")[0].points, tr.PLATE_POINTS);
  assert.equal(shot.bonusRound.perf.acts, 1);
  // A high plate needs a bolt from a jump: a standing bolt flies under it.
  const high = synth({ track: FLAT, plates: [[100, 0, 6]] });
  high.input.fire = true;
  until(high, () => high.you.x > 130, 3000);
  assert.equal(high.runner.plates[0], false, "a level bolt flies under it");
  // What is eaten stays eaten after a restart in the same room.
  const again = synth({ track: FLAT, domes: [[60, 0, 0]] });
  again.runner.domes[0] = true;
  again.runner.served = 1;
  again.runner.check = -1;
  tr.TRAY.place[0](again, {});
  assert.equal(again.runner.domes[0], true);
  assert.equal(again.runner.served, 1);
});

test("Ghoul Rush's Servants' Back Stairs: bolts follow the stairs (the same height over the track on a descent)", () => {
  const probe = synth({ track: DOWN });
  probe.input.fire = true;
  run(probe, 300);
  probe.input.fire = false;
  assert.ok(probe.shots.length > 0);
  for (const s of probe.shots) {
    const over = s.y - (40 - 0.15 * s.x);
    assert.ok(Math.abs(over - ghoul.SHOT_Y) < 0.5, `a bolt ${over.toFixed(2)} over the track`);
  }
  assert.equal(probe.bonusRound.perf.acts, 0);
});

test("Ghoul Rush's Servants' Back Stairs: a gap with no jump is a heart (cause tumble), the tray goes back on the shelf ahead at TRAY_V and rolls on; a jump over it costs nothing", () => {
  const gap = [[[0, 20], [60, 20]], [[75, 20], [400, 20]]];
  const fall = synth({ track: gap });
  trayAt(fall, 30, 0);
  until(fall, () => fall.bonusRound.hearts < 5, 3000);
  assert.equal(fall.bonusRound.hearts, 4);
  assert.equal(events(fall, "lose")[0].cause, "tumble");
  assert.equal(fall.phase, "play");
  assert.equal(fall.lives, 3);
  until(fall, () => fall.runner.line === 1 && fall.you.x > 90, 3000);
  assert.equal(fall.runner.line, 1, "back on the shelf ahead");
  assert.equal(fall.bonusRound.hearts, 4);
  const hop = synth({ track: gap });
  trayAt(hop, 30, 0);
  run(hop, 500);
  press(hop);
  run(hop, 20);
  hop.input.up = false;
  until(hop, () => hop.you.x > 100, 3000);
  assert.equal(hop.bonusRound.hearts, 5, "jumped");
});

test("Ghoul Rush's Servants' Back Stairs: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Crypt", () => {
  const round = trayRound();
  round.dice = 2;
  round.bonusRound.hearts = 1;
  trayAt(round, lines[0].x1 - 6, 0);
  round.you.safeMs = 0;
  until(round, () => round.phase === "clear", 6000);
  assert.equal(round.bonusRound.hearts, 0);
  assert.equal(round.bonusRound.over, true);
  assert.equal(round.bonusRound.won, false);
  const end = events(round, "bonusEnd");
  assert.equal(end.length, 1);
  assert.deepEqual([end[0].won, end[0].dice], [false, 0]);
  assert.equal(round.over, false, "no game over");
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  run(round, ghoul.CARD_LOST_MS + 100);
  assert.equal(round.spec.id, "crypt");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner, null);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Servants' Back Stairs: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart's restart", () => {
  const round = trayRound();
  const first = R.checks[0];
  const li = ct.linesAt(R, first)[0][0];
  trayAt(round, first - 3, li, { safe: true });
  until(round, () => round.runner.check === 0, 1000);
  assert.equal(round.runner.check, 0);
  assert.equal(events(round, "trayCheck")[0].n, 1);
  trayAt(round, R.checks[1] - 3, ct.linesAt(R, R.checks[1])[0][0], { safe: true });
  until(round, () => round.runner.check === 1, 1000);
  assert.equal(round.runner.check, 1);
  tr.TRAY.place[0](round, {});
  assert.equal(round.you.x, R.checks[1], "back at the last checkpoint passed");
  assert.equal(round.runner.check, 1);
});

test("Ghoul Rush's Servants' Back Stairs: off the lip the tray launches, lands on the table and stops (trayFinish), the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = trayRound();
  round.dice = 1;
  const last = lines.length - 1;
  trayAt(round, lines[last].x1 - 12, last, { safe: true });
  until(round, () => round.runner.done, 4000);
  assert.equal(round.runner.done, true);
  assert.equal(events(round, "trayLaunch").length, 1);
  assert.equal(events(round, "trayLaunch")[0].last, true);
  assert.equal(events(round, "trayFinish").length, 1);
  assert.ok(round.you.x > R.finish + 4 && round.you.x < R.finish + 40, `${round.you.x} landed`);
  assert.equal(round.you.y, floorOf(round.you.x));
  assert.equal(round.hasKey, true, "the door opens");
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
  assert.equal(round.spec.id, "crypt");
  assert.equal(round.runner, null);
});

test("Ghoul Rush's Servants' Back Stairs: no random number is drawn in the room (a ride of 20 seconds, jumping and shooting, on a draw that throws)", () => {
  const round = trayRound();
  trayAt(round, 120, 1, { safe: true });
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

test("Ghoul Rush's Servants' Back Stairs' grade: the dice formula, a seven course meal for the die, and the cherries die (45% of them)", () => {
  const round = trayRound();
  const b = round.bonusRound;
  assert.equal(b.perf.goal, tr.COURSES_GOAL);
  assert.equal(tr.COURSES_GOAL, 7);
  assert.equal(b.perf.total, R.pots.length + R.lows.length + R.cooks.length + lines.length - 1);
  assert.equal(b.perf.steady, false, "no cherries yet");
  const mk = (perf) => {
    const x = makeBonus({ stats: { kills: 0 } });
    Object.assign(x.perf, { total: b.perf.total, goal: tr.COURSES_GOAL }, perf);
    return x;
  };
  assert.equal(diceFor(mk({ hits: [], acts: 7, steady: true })), 9, "a perfect, hungry ride");
  assert.equal(diceFor(mk({ hits: [], acts: 6, steady: true })), 8, "a sixth course short");
  assert.equal(diceFor(mk({ hits: [], acts: 7, steady: false })), 8, "no cherries");
  assert.equal(diceFor(mk({ hits: [], acts: 0, steady: false })) >= BONUS_FLOOR, true);
  const hit = mk({ hits: R.pots.map((_, i) => `p${i}`), acts: 0, steady: false });
  hit.hearts = 1;
  assert.equal(diceFor(hit), BONUS_FLOOR + Math.round((2 * (b.perf.total - R.pots.length)) / b.perf.total), "hit a lot, no courses");
  // Courses reach the grade as they are served.
  const meal = synth({ track: FLAT, domes: Array.from({ length: 8 }, (_, i) => [40 + i * 12, 0, 0]) });
  until(meal, () => meal.runner.served >= 7, 4000);
  assert.equal(meal.bonusRound.perf.acts, 7);
  // Cherries: 45% of the room's.
  const goal = Math.ceil(tr.CHERRY_SHARE * round.candy.length);
  trayAt(round, 60, 0, { safe: true });
  for (let i = 0; i < goal - 1; i++) round.candy[i] = true;
  run(round, 500);
  assert.equal(b.perf.steady, false, "one cherry short");
  round.candy[goal - 1] = true;
  run(round, 500);
  assert.equal(b.perf.steady, true, "enough cherries");
});

test("Ghoul Rush's Servants' Back Stairs: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const tries = [
    { pots: [[60, 0, 0]] }, { pots: [[60, 0, 1]] }, { lows: [[56, 62, 23.0, 0]] }, { lows: [[56, 62, 23.0, 1]] }, { cooks: [[170, 0]] },
  ];
  for (const t of tries) {
    const r = synth({ track: FLAT, ...t });
    r.infinite = true;
    if (t.cooks) trayAt(r, 100, 0);
    until(r, () => events(r, "lose").length > 0, 6000);
    assert.ok(events(r, "lose").length > 0, JSON.stringify(Object.keys(t)));
    assert.equal(r.bonusRound.hearts, 5, JSON.stringify(Object.keys(t)));
    assert.equal(r.lives, 3);
  }
  const crack = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  crack.infinite = true;
  trayAt(crack, 30, 0);
  until(crack, () => events(crack, "lose").length > 0, 3000);
  assert.equal(crack.bonusRound.hearts, 5);
  assert.equal(crack.lives, 3);
});

test("Ghoul Rush's Servants' Back Stairs: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ track: FLAT, pots: [[60, 0, 0]] });
  round.you.garlic = true;
  until(round, () => round.you.x > 70, 3000);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false, "spent");
});

/* ------------------------------------------------------ sounds and words */

test("Ghoul Rush's Servants' Back Stairs: every event has a voice that plays, every cause has words and a sound, and every tone exists and is at most 1.2 s", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...tr.EVENTS].sort(), "a voice for every event and no more");
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = TRAY_VOICES[kind] && TRAY_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(ghoulSfx.default.tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    assert.ok(heard({ type: event, what: "pot", points: 50 }).played.includes(name), `${event} plays ${name}`);
    const len = Math.max(...ghoulSfx.default.tones[name].layers.map((l) => (l.delay || 0) + l.seconds));
    assert.ok(len <= 1.2, `${name} is ${len} s`);
  }
  for (const cause of ["pot", "cutlery", "ham", "pans", "dish", "tumble"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "trayJump" }).played.length, 1);
  assert.equal(heard({ type: "trayPlate", points: 120, n: 3 }).played.length, 1);
});

test("Ghoul Rush's Servants' Back Stairs: the room's own names do not collide with the game's (events, kinds), and the music is a real track", () => {
  for (const e of tr.EVENTS) assert.ok(e.startsWith("tray"), e);
  const other = new Set();
  for (const pack of [ct, sl]) for (const e of pack.EVENTS || []) other.add(e);
  for (const e of tr.EVENTS) assert.ok(!other.has(e), `${e} is the tray's alone`);
  assert.deepEqual(Object.keys(tr.TRAY).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  const music = ghoulSfx.default.music.ghoulTrayRide;
  for (const part of Object.values(music.patterns)) {
    for (const row of Object.values(part)) assert.equal(row.split("|").length, 4, "four bars a pattern");
  }
  assert.ok(music.order.every((p) => music.patterns[p]));
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Servants' Back Stairs draws: the room in a lit and a dark one, the tray on the shelf, in the air and ducking, each thing (pots, cutlery, hams, pans, cooks in each state, a dish, domes and plates whole and taken), a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["wing"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "tray") through(r);
  r.lives = 99;
  const pot = R.pots.find((p) => !p[2]);
  const cutlery = R.pots.find((p) => p[2]);
  const spots = [ROOM.start + 40, pot[0] - 10, cutlery[0] - 10, R.lows[0][0] - 5, R.lows[3][0] - 5, R.cooks[0][0] - 30, R.domes[3][0] - 8, R.plates[3][0] - 8, R.checks[0], lines[0].x1 - 10, R.grease[0][0] + 10, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      const top = ct.linesAt(R, x)[0] || [lines.length - 1, 20];
      trayAt(r, x, top[0], { safe: true });
      r.runner.cooks = r.runner.cooks.map((c, i) => ({ ...c, state: ["down", "up", "toss", "spent", "broken"][i % 5], t: 600, dish: i % 2 ? { x: x + 20, y: top[1] + 1.6 } : null }));
      r.runner.domes = r.runner.domes.map((_, i) => i % 3 === 0);
      r.runner.plates = r.runner.plates.map((_, i) => i % 4 === 0);
      for (const air of [false, true]) {
        if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
        if (air) r.runner.line = -1;
        r.you.ducking = x === R.lows[0][0] - 5 && !air;
        r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
        for (let n = 0; n < 4; n++) g.tick(16);
        r.monsters.length = 0;
        r.you.safeMs = 1e9;
        trayAt(r, x, top[0], { safe: true });
      }
    }
  }
  assert.equal(r.spec.id, "tray");
  r.you.safeMs = 0;
  trayAt(r, R.pots[2][0] - 3, R.pots[2][1]);
  for (let n = 0; n < 30; n++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["wing"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "tray") through(d);
  d.phase = "play";
  d.runner.done = true;
  d.runner.restX = R.finish + 20;
  Object.assign(d.you, { x: R.finish + 30, y: 10, state: "run" });
  d.camX = R.finish - 40;
  for (let n = 0; n < 10; n++) done.tick(16);
  for (const won of [true, false]) {
    endBonus(d, won, { ROOM_POINTS: 300, award: (rd, pts) => (rd.score += pts) });
    d.bonusRound.over = true;
    for (let n = 0; n < 10; n++) {
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
  const at = ghoul.STAGES.findIndex((s) => s.id === "wing");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "tray");
  assert.equal(p.runner.line, 0);
  assert.equal(p.you.y, ct.trackY(R, 0, ROOM.start));
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
// A bot that dodges well: it jumps at the end of a line (not the lip), 9 to 15 short of a pot or a
// piece of cutlery and as a dish comes, jumps for the high domes, ducks under every low, and holds
// the blaster. `miss` is the share of things it fails to dodge (by a hash).
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
    const last = c.line === lines.length - 1;
    if (!last && lines[c.line].x1 - you.x < 2.2 && ok(lines[c.line].x1)) jump = true;
    const ahead = (x) => x - you.x > 6 && x - you.x < look;
    for (const [x] of R.pots) if (ahead(x) && ok(x)) jump = true;
    R.cooks.forEach((_, i) => {
      const d = c.cooks[i].dish;
      if (d && d.x - you.x > 4 && d.x - you.x < 12 && ok(d.x)) jump = true;
    });
    R.domes.forEach(([x, , lift], i) => {
      if (lift > 0 && !c.domes[i] && ahead(x - 3)) jump = true;
    });
    for (const [x0, x1] of R.lows) if (you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
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
function rideWith(seed, bot, limit = 100000) {
  const round = trayRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the tray stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Servants' Back Stairs: a bot that dodges well finishes the whole route in 60 to 76 seconds, 6 to 9 dice, a seven course meal, past every checkpoint", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 76000, `${ms} ms`);
    assert.ok(b.dice >= 6 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.ok(round.runner.served >= tr.COURSES_GOAL, `${round.runner.served} courses`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.check, R.checks.length - 1, "past every checkpoint");
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 7, `${dice.join(",")}`);
});

test("Ghoul Rush's Servants' Back Stairs: a bot that never dodges (holding fire) loses all five hearts before the first third, ends with 0 dice and the run goes on", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { round, lost } = rideWith(seed, idleBot);
    const b = round.bonusRound;
    assert.equal(b.won, false, "never finishes");
    assert.equal(b.dice, 0);
    assert.equal(b.hearts, 0);
    assert.equal(lost.length, 5);
    assert.ok(round.you.x < ROOM.length * 0.4, `out at ${round.you.x}`);
    assert.equal(round.lives, 3);
    assert.equal(round.over, false);
  }
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Servants' Back Stairs telegraphs: DUCK over hams and pans, JUMP over gaps, pots and cutlery, SHOOT for cooks, none for domes or plates, words only on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  const answers = { gap: "JUMP", pot: "JUMP", cutlery: "JUMP", ham: "DUCK", pans: "DUCK", cook: "SHOOT" };
  assert.equal(marks.length, lines.length - 1 + R.pots.length + R.lows.length + R.cooks.length, "one per obstacle, none for the courses");
  for (const m of marks) assert.equal(m.answer, answers[m.kind], m.kind);
  const first = R.lows.find((l) => !l[3]);
  const m = marks.find((q) => q.x === (first[0] + first[1]) / 2);
  assert.equal(m.kind, "ham");
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "ham" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  for (const kind of ["gap", "pot", "cutlery", "ham", "pans", "cook"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 3, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((t) => t.lead === q.lead);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
});

test("Ghoul Rush's Servants' Back Stairs' intro banner says the controls plainly", () => {
  assert.match(R.how, /UP to jump, DOWN to duck, hold space to shoot/);
});
