// Web console tests, Ghoul Rush's Bone Stair (the finale's second ride, between Kill II and the Pit): its shape (the spiral's flights and seams, every gap of missing treads clears with a jump and swallows YOU without one, every ribcage can be ducked, spacing, checkpoints, the last step over the Pit's floor), the run's speed (DOWN and LEFT slow YOU), every obstacle's cost and cause (missing treads, treads giving way, ribcages, skeletons, hands, masonry, the rubble), the telegraphs (shadows, creaks and cracks, fingers over the edge, skeletons rising), shooting skeletons down, the pursuit meter (the gap that clean running opens and hits, ducks and holds close), the catch, three hearts of its own, the grade and the dice, endless lives, the finish, no random numbers, its sounds and its drawing on a fake canvas, and bots that play it well and badly.
// Run with: node --test scripts/test-web-console-activities-ghoul-bonestair.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as bs from "../src/web-console/public/activities/ghoul-rush/rides/bonestair/ghoul-bonestair.js";
import { BONESTAIR_ROOM } from "../src/web-console/public/activities/ghoul-rush/rides/bonestair/ghoul-bonestair-room.js";
import { ANSWERS, EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as STAIR_LOOKS, VOICES as STAIR_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/bonestair/ghoul-bonestair-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the stair drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round on The Bone Stair reached the way a run reaches it: six stages behind it, on
// through the finale's rooms before it; the clocks long, the bonus round on (three hearts).
function stairRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.cleared = ghoul.STAGES.slice(0, ghoul.RUN_STAGES).map((st) => st.id);
  round.offer = null;
  for (let n = 0; n < 14 && round.spec.id !== "bonestair"; n++) through(round);
  assert.equal(round.spec.id, "bonestair");
  round.phase = "play";
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const ROOM = ghoul.roomById("bonestair");
const R = ROOM.ride;
const F = R.flights;
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const K = { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };

const NONE = { runner: "bonestair", hearts: 3, time: 1e9, finish: 6020, top: [0, 20, 36], flights: [[20, 6020, 36, -600]], gaps: [], rot: [], ribs: [], skels: [], hands: [], stones: [], surge: [], checks: [] };
// The same round over a stair of its own: one long flight to measure the run on (or `ride`'s).
function synth(ride) {
  const round = stairRound();
  round.spec = { ...round.spec, start: 30, length: 7000, ground: [[0, 20, 36]], ride: { ...NONE, ...ride } };
  bs.BONESTAIR.place[0](round, {});
  return round;
}
// A gentle stair for the obstacle tests: one flight dropping a unit every ten.
const GENTLE = [[20, 4020, 36, -364]];

// YOU on the stair at x, at speed v.
function stairAt(round, x, { v = bs.RUN_V, safe = false } = {}) {
  const y = bs.stairY(round.spec.ride, x);
  assert.ok(y !== null, `the stair runs under ${x}`);
  Object.assign(round.you, { x, y, vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
  Object.assign(round.runner, { v, coyote: 0, heldMs: 0 });
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
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

// Where YOU, in the air at (x, y) going up at vy and across at v, come down: { x, y } on the
// stair, or null for a fall through (the room's own geometry, gaps and the seams' lift).
function flight(x, y, vy, v) {
  const dt = 0.004;
  for (let t = 0; t < 4; t += dt) {
    const px = x;
    let py = y;
    vy = Math.max(-ghoul.FALL_MAX, vy - bs.STAIR_G * dt);
    x += v * dt;
    y += vy * dt;
    for (const s of bs.seams(R)) if (px < s.x && x >= s.x) {
      y += s.rise;
      py += s.rise;
    }
    const line = bs.stairY(R, x);
    if (line === null) return null;
    const inGap = R.gaps.some(([a, b]) => x > a && x < b);
    if (vy <= 0 && !inGap && py >= line - bs.LAND_TOL && y <= line) return { x, y: line };
    if (y < line - bs.FALL_DEPTH) return null;
  }
  return null;
}

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Bone Stair is the finale's second ride, between Kill II and the Pit: ready, lit, no key, no boss, no pickups, a bonus round of three hearts and about 30 seconds", () => {
  assert.equal(BONESTAIR_ROOM.ready, true);
  const rooms = ghoul.FINALE.rooms;
  assert.ok(rooms.includes("bonestair"));
  assert.ok(rooms.indexOf("bonestair") > rooms.indexOf("lawn"));
  if (rooms.includes("dollhouse")) assert.equal(rooms.indexOf("bonestair"), rooms.indexOf("dollhouse") + 1, "just after Kill II");
  if (rooms.includes("pit")) assert.equal(rooms.indexOf("pit"), rooms.indexOf("bonestair") + 1, "just before the Pit");
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Bone Stair", "Every step down is someone"]);
  assert.equal(ROOM.dark, false);
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true);
  assert.equal(R.runner, "bonestair");
  assert.equal(R.hearts, 3, "three hearts, not five");
  assert.equal(typeof ghoul.ROOM_MUSIC.bonestair, "string", "a track (borrowed until its own is voted)");
  assert.deepEqual(Object.keys(bs.BONESTAIR.monsters), []);
  assert.equal(LOOKS.bonestair, STAIR_LOOKS.bonestair);
  assert.equal(LOOKS.bonestair.pack, "bonestair");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.flights) && Object.isFrozen(R.flights[0]) && Object.isFrozen(R.ribs[0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0, "no monsters: the stair's things are the pack's own");
  assert.deepEqual([ROOM.candy.length, ROOM.items.length], [0, 0], "no pickups");
  // The ground: the cellar landing at the start and the Pit's floor at the end only.
  assert.equal(ROOM.ground.length, 2);
  assert.deepEqual([...ROOM.ground[0]], [...R.top]);
  assert.equal(ROOM.ground[1][0], R.finish, "the Pit's floor starts under the last step");
  assert.ok(ROOM.ground[1][2] < F.at(-1)[3] - 8, "a real drop off the last step");
  assert.ok(ROOM.door > R.finish + 20 && ROOM.door > ROOM.length - 14, "the door at the room's end, out on the Pit's floor");
  assert.ok(floorOf(ROOM.door - 2) > -Infinity);
  // About 30 seconds at a clean run, on a clock that holds it comfortably (the game's ride rule: 70 to 120 s).
  const secs = (R.finish - ROOM.start) / bs.RUN_V;
  assert.ok(secs >= 26 && secs <= 34, `${secs.toFixed(1)} s at RUN_V`);
  assert.equal(ghoul.timeFor(ghoul.roomFor("bonestair")), R.time);
  assert.ok(R.time >= 70000 && R.time <= 120000);
  assert.deepEqual([R.gaps.length, R.rot.length, R.ribs.length, R.skels.length, R.hands.length, R.stones.length], [4, 3, 3, 4, 3, 3], "gaps, give-ways, ribcages, skeletons, hands, masonry");
});

test("Ghoul Rush's Bone Stair: the spiral is a run of flights, each starting where the last ended, high again; crossing a seam lifts YOU by the flight's height and the field never runs out going down", () => {
  assert.equal(F[0][0], R.top[1], "the first flight starts at the landing's end");
  assert.equal(F[0][2], R.top[2], "level with it");
  for (let i = 0; i < F.length; i++) {
    const [x0, x1, y0, y1] = F[i];
    assert.ok(x1 > x0 && y1 < y0, `flight ${i} goes down`);
    assert.ok(y0 < ghoul.FIELD_H - 12 && y1 > 10, `flight ${i} stays on the field (${y0} to ${y1})`);
    const slope = (y1 - y0) / (x1 - x0);
    assert.ok(slope > -0.2 && slope < -0.1, `flight ${i}'s slope ${slope.toFixed(3)}`);
    if (i) assert.equal(x0, F[i - 1][1], "no hole at a seam");
  }
  assert.equal(F.at(-1)[1], R.finish);
  const seams = bs.seams(R);
  assert.equal(seams.length, F.length - 1);
  for (const s of seams) assert.ok(s.rise > 15, "high again");
  // Running across a seam on the treads.
  const round = stairRound();
  const sx = F[0][1];
  stairAt(round, sx - 6, { safe: true });
  run(round, 300);
  assert.ok(round.you.x > sx);
  assert.ok(Math.abs(round.you.y - bs.stairY(R, round.you.x)) < 1e-6, "on the next flight's treads");
  assert.ok(round.you.y > F[1][2] - 3, "high again");
  assert.equal(events(round, "stairTurn").length, 1);
  assert.equal(round.runner.flight, 1);
  // And in the air: a jump just before a seam lands on the next flight.
  const air = stairRound();
  stairAt(air, sx - 8, { safe: true });
  press(air);
  until(air, () => air.you.state === "air", 200);
  until(air, () => air.you.state === "run", 2000);
  assert.ok(air.you.x > sx && Math.abs(air.you.y - bs.stairY(R, air.you.x)) < 1e-6, "landed round the column");
  // A bolt winds round with YOU.
  const shot = stairRound();
  stairAt(shot, sx - 14, { safe: true });
  shot.input.fire = true;
  run(shot, 30);
  shot.input.fire = false;
  const s = shot.shots[0];
  assert.ok(s, "a bolt");
  until(shot, () => s.x > sx + 10, 600);
  assert.ok(Math.abs(s.y - (bs.stairY(R, s.x) + ghoul.SHOT_Y)) < 1.2, `the bolt flies along the next flight (${s.y.toFixed(1)} over ${bs.stairY(R, s.x).toFixed(1)})`);
});

test("Ghoul Rush's Bone Stair: every stretch of missing treads clears with a jump at its edge or a few units early (at a run or a duck's speed), and running off it without one is a fall", () => {
  for (const [x0, x1] of R.gaps) {
    const w = x1 - x0;
    assert.ok(w >= 6 && w <= 9, `a gap at ${x0} is ${w} wide`);
    assert.equal(bs.flightAt(R, x0), bs.flightAt(R, x1), "inside one flight");
    // Off the edge with no jump.
    assert.equal(flight(x0, bs.stairY(R, x0), bs.slopeAt(R, x0) * bs.RUN_V, bs.RUN_V), null, `no jump at ${x0}`);
    for (const v of [bs.DUCK_V, bs.RUN_V]) {
      for (const early of [0, 3, 6]) {
        const x = x0 - early;
        const land = flight(x, bs.stairY(R, x), bs.STAIR_JUMP_V, v);
        assert.ok(land && land.x > x1, `a jump ${early} early at ${v} clears the gap at ${x0}`);
      }
    }
  }
  // In play: a fall costs a heart (cause "stairGap") and puts YOU back on the treads past it.
  const round = stairRound();
  const [x0, x1] = R.gaps[0];
  stairAt(round, x0 - 6);
  until(round, () => events(round, "lose").length > 0, 2000);
  assert.equal(events(round, "lose")[0].cause, "stairGap");
  assert.equal(round.bonusRound.hearts, 2);
  assert.equal(round.phase, "play", "the run goes on");
  assert.ok(round.you.x > x1 && round.you.state === "run", "back on the treads past it");
  assert.equal(events(round, "stairDrop").length, 1);
  // A jump clears it in play.
  const ok = stairRound();
  stairAt(ok, x0 - 4);
  press(ok);
  until(ok, () => ok.you.x > x1 + 4, 2000);
  assert.equal(events(ok, "lose").length, 0);
});

test("Ghoul Rush's Bone Stair: every ribcage's underside sits between a ducked box and a standing one along its width; ducking passes, standing is a heart (cause \"stairRib\"); ducking slows YOU", () => {
  for (const [x, under] of R.ribs) {
    const hi = bs.stairY(R, x - bs.RIB_W / 2 - K.HIT_W / 2);
    const lo = bs.stairY(R, x + bs.RIB_W / 2 + K.HIT_W / 2);
    assert.ok(hi + K.DUCK_H < under, `a ducked box clears the ribcage at ${x}`);
    assert.ok(lo + K.HIT_H > under, `a standing box hits the ribcage at ${x}`);
  }
  const [x] = R.ribs[0];
  const stand = stairRound();
  stairAt(stand, x - 10);
  until(stand, () => events(stand, "lose").length > 0, 1000);
  assert.equal(events(stand, "lose")[0].cause, "stairRib");
  const duck = stairRound();
  stairAt(duck, x - 8);
  duck.input.down = true;
  until(duck, () => duck.you.x > x + 6, 2000);
  duck.input.down = false;
  assert.equal(events(duck, "lose").length, 0);
  assert.ok(duck.runner.v < bs.RUN_V - 4, "a duck slows YOU");
  // And the speeds.
  const s = synth({ flights: GENTLE });
  run(s, 1500, { down: true });
  assert.ok(Math.abs(s.runner.v - bs.DUCK_V) < 1);
  run(s, 1500, { left: true });
  assert.ok(Math.abs(s.runner.v - bs.HOLD_V) < 1, "LEFT holds back");
  run(s, 2500);
  assert.ok(Math.abs(s.runner.v - bs.RUN_V) < 1, "back up to a run");
});

test("Ghoul Rush's Bone Stair: masonry warns first (a shadow, a creak at once, a crack halfway, more than a second in all), lands ahead of a runner, and lies as a pile to jump; under it, or into the pile, is a heart (cause \"stairStone\")", () => {
  assert.ok(bs.STONE_MS >= 1200, "a long, clear warning");
  const round = synth({ flights: GENTLE, stones: [[300]] });
  stairAt(round, 200, { safe: true });
  until(round, () => events(round, "stairCreak").length > 0, 2000);
  const at = round.you.x;
  assert.ok(300 - at <= bs.STONE_NEAR && 300 - at > bs.STONE_NEAR - 2);
  assert.equal(round.runner.stones[0].state, "warn");
  until(round, () => events(round, "stairCrack").length > 0, 2000);
  assert.ok(Math.abs(round.runner.stones[0].t - bs.STONE_MS / 2) < 20, "the crack halfway");
  until(round, () => events(round, "stairThud").length > 0, 2000);
  assert.equal(round.runner.stones[0].state, "pile");
  assert.ok(300 - round.you.x > 10, `it lands ahead of a runner (${(300 - round.you.x).toFixed(1)} short)`);
  // Into the pile: a heart.
  round.you.safeMs = 0;
  until(round, () => events(round, "lose").length > 0, 1000);
  assert.equal(events(round, "lose")[0].cause, "stairStone");
  // Jumped: clean.
  const ok = synth({ flights: GENTLE, stones: [[300]] });
  stairAt(ok, 200);
  until(ok, () => ok.runner.stones[0].state === "pile", 3000);
  until(ok, () => 300 - ok.you.x < 8, 1000);
  press(ok);
  until(ok, () => ok.you.x > 306, 1000);
  assert.equal(events(ok, "lose").length, 0);
  // Under it as it lands: a heart.
  const under = synth({ flights: GENTLE, stones: [[300]] });
  stairAt(under, 200);
  until(under, () => under.runner.stones[0].state === "warn" && under.runner.stones[0].t < 200, 3000);
  stairAt(under, 299.5, { v: 0 });
  under.runner.heldMs = 1e9;
  until(under, () => events(under, "lose").length > 0, 2000);
  assert.equal(events(under, "lose")[0].cause, "stairStone");
});

test("Ghoul Rush's Bone Stair: a bone hand's fingers creep over the edge first (HAND_WARN_MS), then it grabs; a jump clears it, a grab is a heart (cause \"stairHand\") and holds YOU still a moment", () => {
  assert.ok(bs.HAND_WARN_MS >= 700);
  const round = synth({ flights: GENTLE, hands: [[300]] });
  stairAt(round, 220);
  until(round, () => events(round, "stairReach").length > 0, 3000);
  assert.ok(300 - round.you.x <= bs.HAND_NEAR);
  until(round, () => events(round, "stairGrab").length > 0, 2000);
  assert.ok(300 - round.you.x > 10, "it grabs ahead of YOU, in plain sight");
  until(round, () => events(round, "lose").length > 0, 1000);
  assert.equal(events(round, "lose")[0].cause, "stairHand");
  assert.equal(round.runner.heldMs > 0 || round.runner.v < 1, true, "held");
  const x = round.you.x;
  run(round, bs.HELD_MS - 40);
  assert.ok(Math.abs(round.you.x - x) < 0.01, "still while held");
  run(round, 400);
  assert.ok(round.you.x > x + 2, "and off again");
  // Jumped.
  const ok = synth({ flights: GENTLE, hands: [[300]] });
  stairAt(ok, 220);
  until(ok, () => 300 - ok.you.x < 7, 3000);
  press(ok);
  until(ok, () => ok.you.x > 306, 1000);
  assert.equal(events(ok, "lose").length, 0);
});

test("Ghoul Rush's Bone Stair: a skeleton rises over the treads first, then climbs up at YOU; SKEL_HP bolts knock it down (an act, points, a little ground back), and running into it is a heart (cause \"stairSkel\")", () => {
  const round = synth({ flights: GENTLE, skels: [[300]] });
  stairAt(round, 200);
  until(round, () => events(round, "stairRise").length > 0, 3000);
  assert.ok(300 - round.you.x <= bs.SKEL_NEAR);
  assert.equal(round.runner.skels[0].state, "rise");
  until(round, () => round.runner.skels[0].state === "climb", 2000);
  const x0 = round.runner.skels[0].x;
  run(round, 200);
  assert.ok(round.runner.skels[0].x < x0, "climbing up the stair at YOU");
  until(round, () => events(round, "lose").length > 0, 2000);
  assert.equal(events(round, "lose")[0].cause, "stairSkel");
  assert.equal(round.runner.skels[0].state, "smashed");
  // Shot down.
  const shot = synth({ flights: GENTLE, skels: [[300]] });
  stairAt(shot, 200);
  shot.input.fire = true;
  until(shot, () => shot.runner.skels[0].state === "down" || events(shot, "lose").length > 0, 3000);
  assert.equal(shot.runner.skels[0].state, "down");
  assert.equal(events(shot, "stairSkelHit").length, bs.SKEL_HP - 1);
  assert.equal(events(shot, "stairSkelDown").length, 1);
  assert.equal(shot.bonusRound.perf.acts, 1);
  assert.ok(shot.score >= bs.SKEL_POINTS);
  until(shot, () => shot.you.x > 310, 2000);
  assert.equal(events(shot, "lose").length, 0);
  // A waiting skeleton takes no bolt.
  const early = synth({ flights: GENTLE, skels: [[300]] });
  assert.equal(bs.BONESTAIR.target(early, { x: 300, y: bs.stairY(early.spec.ride, 300) + 2 }), false);
});

test("Ghoul Rush's Bone Stair: treads that give way start crumbling once YOU are in, at a speed between a duck and a run: a runner outruns it, a ducker drops through (cause \"stairGive\") and is put back past the stretch", () => {
  assert.ok(bs.ROT_V > bs.DUCK_V && bs.ROT_V > bs.HOLD_V && bs.ROT_V < bs.RUN_V);
  for (const [x0, x1] of R.rot) {
    assert.ok(x1 - x0 >= 30, "long enough to matter");
    assert.equal(bs.flightAt(R, x0), bs.flightAt(R, x1), "inside one flight");
    for (const [a, b] of R.gaps) if (a > x0 && b < x1) assert.ok(a - x0 > 15 && x1 - b > 15, "a gap inside one is well clear of its ends");
  }
  const runner = synth({ flights: GENTLE, rot: [[200, 260]] });
  stairAt(runner, 180);
  until(runner, () => runner.you.x > 270, 3000);
  assert.equal(events(runner, "stairRot").length, 1);
  assert.equal(events(runner, "lose").length, 0, "outrun");
  const ducker = synth({ flights: GENTLE, rot: [[200, 260]] });
  stairAt(ducker, 180);
  ducker.input.down = true;
  until(ducker, () => events(ducker, "lose").length > 0, 4000);
  ducker.input.down = false;
  assert.equal(events(ducker, "lose")[0].cause, "stairGive");
  assert.ok(ducker.you.x > 260 && ducker.you.state === "run", "back on the treads past it");
  // Blinking safe after a heart, it waits behind YOU.
  const safe = synth({ flights: GENTLE, rot: [[200, 260]] });
  stairAt(safe, 180, { safe: true });
  safe.input.down = true;
  until(safe, () => safe.you.x > 262, 6000);
  safe.input.down = false;
  assert.equal(events(safe, "lose").length, 0);
});

test("Ghoul Rush's Bone Stair: the rubble behind gains on a duck or a hold and loses to a clean run; at CATCH_GAP it has YOU (a heart, cause \"stairRubble\") and falls back; a hit shoves it closer", () => {
  const s = synth({ flights: GENTLE });
  assert.equal(s.runner.gap, bs.GAP_START);
  run(s, 3000);
  assert.ok(s.runner.gap > bs.GAP_START, "a clean run wins ground");
  assert.ok(s.runner.gap <= bs.GAP_MAX);
  const d = synth({ flights: GENTLE });
  const g0 = d.runner.gap;
  run(d, 1000, { down: true });
  assert.ok(d.runner.gap < g0, "a duck loses ground");
  const caught = synth({ flights: GENTLE });
  caught.input.left = true;
  until(caught, () => events(caught, "lose").length > 0, 10000);
  caught.input.left = false;
  assert.equal(events(caught, "lose")[0].cause, "stairRubble");
  assert.equal(events(caught, "stairCatch").length, 1);
  assert.equal(caught.runner.gap, bs.GAP_RESET);
  assert.ok(events(caught, "stairClose").length >= 1, "a warning before it");
  const hit = synth({ flights: GENTLE, ribs: [[200, bs.stairY({ ...NONE, flights: GENTLE }, 197) + 3]] });
  stairAt(hit, 190);
  const before = hit.runner.gap;
  until(hit, () => events(hit, "lose").length > 0, 1000);
  assert.ok(hit.runner.gap < before - bs.HIT_CLOSE + 1, "the hit lets it closer");
  assert.ok(hit.runner.v <= bs.STUMBLE_V, "and YOU stumble");
});

test("Ghoul Rush's Bone Stair: checkpoints are passed, and running off the last step drops YOU onto the Pit's floor: the run is over, the way out open, and YOU walk to the door", () => {
  const round = stairRound();
  stairAt(round, R.checks[0] - 4, { safe: true });
  run(round, 300);
  assert.equal(round.runner.check, 0);
  assert.equal(events(round, "stairCheck").length, 1);
  const end = stairRound();
  stairAt(end, R.finish - 6, { safe: true });
  until(end, () => end.runner.done, 3000);
  assert.equal(events(end, "stairEdge").length, 1);
  assert.equal(events(end, "stairFinish").length, 1);
  assert.equal(end.hasKey, true);
  assert.equal(end.you.y, floorOf(end.you.x));
  assert.ok(end.you.x > R.finish && end.you.x < ROOM.door);
  end.input.right = true;
  until(end, () => end.phase !== "play", 4000);
  assert.equal(end.phase, "clear");
  assert.equal(end.bonusRound.won, true);
  assert.ok(end.bonusRound.dice >= BONUS_FLOOR);
});

test("Ghoul Rush's Bone Stair: no random number is drawn in the room (20 seconds of running, jumping, ducking and shooting, on a draw that throws)", () => {
  const r = stairRound();
  for (let t = 0; t < 20000; t += 16) {
    r.input.fire = t % 4000 < 1500;
    r.input.down = t % 3000 < 300;
    if (t % 1700 < 20) press(r);
    r.you.safeMs = 1e9;
    ghoul.advance(r, 16, never);
    r.events.length = 0;
  }
  assert.ok(r.you.x > 500);
  assert.equal(r.runner.id, "bonestair");
});

test("Ghoul Rush's Bone Stair's grade: three hearts pay at most one die for hearts, every skeleton shot is the acts die, the rubble kept far is the steady die", () => {
  const full = stairRound();
  const b = full.bonusRound;
  assert.equal(b.max, 3);
  assert.equal(b.hearts, 3);
  assert.equal(b.perf.goal, R.skels.length);
  assert.equal(b.perf.total, R.gaps.length + R.rot.length + R.ribs.length + R.skels.length + R.hands.length + R.stones.length);
  const mk = (hearts, hits, acts, steadyDie) => {
    const bb = makeBonus({ stats: { kills: 0 }, spec: { ride: R } });
    bb.hearts = hearts;
    bb.perf = { total: 20, hits: Array.from({ length: hits }, (_, i) => `x${i}`), acts, goal: R.skels.length, steady: steadyDie, kills0: 0 };
    return diceFor(bb, 0);
  };
  assert.equal(mk(3, 0, R.skels.length, true), 8, "a perfect run");
  assert.equal(mk(3, 0, R.skels.length - 1, true), 7, "a skeleton missed");
  assert.equal(mk(1, 3, 0, false), 5);
  const s = synth({ flights: GENTLE });
  s.runner.gap = 8;
  s.runner.gapMs = 20000;
  s.runner.gapSum = 8 * 20000;
  run(s, 100);
  assert.equal(s.bonusRound.perf.steady, false, "the rubble stayed close");
  const t = synth({ flights: GENTLE });
  run(t, 3000);
  assert.equal(t.bonusRound.perf.steady, true);
});

test("Ghoul Rush's Bone Stair: endless lives (round.infinite) spare the hearts for every cause, the Garlic shield takes a hit instead of a heart", () => {
  const r = stairRound();
  r.infinite = true;
  stairAt(r, R.gaps[0][0] - 6);
  until(r, () => events(r, "lose").length > 0, 2000);
  assert.equal(r.bonusRound.hearts, 3);
  assert.equal(events(r, "lose")[0].cause, "stairGap");
  assert.equal(r.phase, "play");
  const m = synth({ flights: GENTLE });
  m.infinite = true;
  m.input.left = true;
  until(m, () => m.runner.catches > 0, 10000);
  assert.equal(m.bonusRound.hearts, 3);
  const g = synth({ flights: GENTLE, ribs: [[200, bs.stairY({ ...NONE, flights: GENTLE }, 197) + 3]] });
  g.you.garlic = true;
  stairAt(g, 190);
  until(g, () => !g.you.garlic, 1000);
  assert.equal(g.bonusRound.hearts, 3);
});

/* ----------------------------------------------------------- sound, names */

test("Ghoul Rush's Bone Stair: every event has a voice that plays, every cause has words and a sound, every tone exists and is short", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...bs.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = STAIR_VOICES[kind] && STAIR_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    assert.ok(heard({ type: event, n: 0, points: 50, cause: "stairGap" }).played.includes(name), `${event} plays ${name}`);
  }
  for (const cause of bs.CAUSES) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(tones[LOSE_SOUNDS[cause][0]] || ["thud", "crunch"].includes(LOSE_SOUNDS[cause][0]), `${cause}'s sound is a tone`);
    assert.ok(heard({ type: "lose", cause, hearts: 2 }).played.length > 0, `${cause} sounds`);
  }
  for (const name of Object.keys(tones).filter((n) => n.startsWith("ghoulStair"))) {
    const layers = tones[name].layers;
    assert.ok(Math.max(...layers.map((l) => (l.delay || 0) + l.seconds)) <= 1.2, `${name} is short`);
    for (const l of layers) assert.ok(l.gain > 0 && l.gain <= 1);
  }
});

test("Ghoul Rush's Bone Stair: its names are its own (every event, cause and tone starts with its prefix), and it keeps to the shared ride slot", () => {
  for (const e of bs.EVENTS) assert.ok(e.startsWith("stair"), e);
  for (const c of bs.CAUSES) assert.ok(c.startsWith("stair"), c);
  for (const kind of Object.keys(STAIR_VOICES)) for (const name of Object.values(STAIR_VOICES[kind])) assert.ok(name.startsWith("ghoulStair"), name);
  assert.deepEqual(Object.keys(bs.BONESTAIR).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  const r = stairRound();
  assert.equal(r.runner.id, "bonestair");
  assert.ok(!("bonestair" in r));
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Bone Stair telegraphs: JUMP over gaps, hands and masonry, DUCK over ribcages, SHOOT over skeletons, RUN where the treads will give way, words on the first three of each kind, seen from afar, the same every time", () => {
  const marks = telegraphMarks(R);
  assert.equal(marks.length, R.gaps.length + R.rot.length + R.ribs.length + R.skels.length + R.hands.length + R.stones.length, "one per thing");
  for (const m of marks) assert.equal(m.answer, ANSWERS[m.kind], m.kind);
  assert.deepEqual(ANSWERS, { gap: "JUMP", hand: "JUMP", stone: "JUMP", rib: "DUCK", skel: "SHOOT", rot: "RUN" });
  const m = marks.find((q) => q.kind === "rib");
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "rib" && t.lead === m.lead) || { alpha: 0 }).alpha;
  assert.equal(alphaOf(m.lead - 45), 0, "not yet");
  assert.ok(alphaOf(m.lead - 36) > 0 && alphaOf(m.lead - 36) < 1, "fading in");
  assert.equal(alphaOf(m.lead - 20), 1);
  assert.equal(alphaOf(m.lead + 7), 0, "gone once passed");
  const sk = marks.find((q) => q.kind === "skel");
  assert.ok(telegraphs(R, sk.lead - 55).some((q) => q.lead === sk.lead && q.alpha > 0.5), "a skeleton seen from further");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  for (const kind of Object.keys(ANSWERS)) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 30).find((s) => s.lead === q.lead);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
});

test("Ghoul Rush's Bone Stair: every thing sits on the treads, clear of the seams (none within 14 before one or 20 after), and spaced for a player", () => {
  const seams = bs.seams(R).map((s) => s.x);
  const things = [...R.gaps.map(([a, b]) => [a, b]), ...R.ribs.map(([x]) => [x - bs.RIB_W / 2, x + bs.RIB_W / 2]), ...R.hands.map(([x]) => [x, x]), ...R.stones.map(([x]) => [x, x]), ...R.rot.map(([a, b]) => [a, b])];
  for (const [a, b] of things) {
    assert.ok(bs.stairY(R, a) !== null && bs.stairY(R, b) !== null && a > F[0][0] && b < R.finish - 8);
    for (const s of seams) assert.ok(b < s - 14 || a > s + 20, `${a} to ${b} is clear of the seam at ${s}`);
  }
  for (const [x] of R.skels) for (const s of seams) assert.ok(x < s - 14 || x > s + 30, `a skeleton at ${x} has room to climb from the seam at ${s}`);
  const xs = [...R.gaps.map(([a]) => a), ...R.ribs.map(([x]) => x), ...R.hands.map(([x]) => x), ...R.stones.map(([x]) => x), ...R.skels.map(([x]) => x)].sort((p, q) => p - q);
  for (let i = 0; i + 1 < xs.length; i++) assert.ok(xs[i + 1] - xs[i] >= 22, `${xs[i]} and ${xs[i + 1]} are ${xs[i + 1] - xs[i]} apart`);
  for (const x of R.checks) for (const [a, b] of things) assert.ok(x < a - 10 || x > b + 10, `a checkpoint at ${x} is clear`);
});

test("Ghoul Rush's Bone Stair's intro banner says the controls plainly", () => {
  assert.match(R.how, /UP jump, DOWN duck/);
  assert.match(R.how, /SPACE to shoot/);
  assert.match(R.how, /YOU/);
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Bone Stair draws: the stair, each thing in each state, a seam, the rubble far and close, a crash, the last step and the floor, the result card, and the stage select straight into it", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.cleared = ghoul.STAGES.slice(0, ghoul.RUN_STAGES).map((st) => st.id);
  r.offer = null;
  for (let n = 0; n < 14 && r.spec.id !== "bonestair"; n++) through(r);
  r.lives = 99;
  const spots = [ROOM.start + 4, R.gaps[0][0] - 8, R.ribs[0][0] - 6, R.hands[0][0] - 20, R.stones[0][0] - 30, R.skels[0][0] - 30, R.rot[0][0] + 10, F[0][1] - 1, F[0][1] + 6, R.checks[0], R.finish - 10];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      stairAt(r, x, { safe: true });
      r.runner.hands = r.runner.hands.map((h, i) => ({ state: ["reach", "grab", "hold", "wait"][i % 4], t: 300 }));
      r.runner.stones = r.runner.stones.map((s, i) => ({ state: ["warn", "pile", "warn"][i % 3], t: i === 2 ? 100 : 700, cracked: true }));
      r.runner.skels = r.runner.skels.map((s, i) => ({ state: ["rise", "climb", "down", "wait"][i % 4], t: 300, x: R.skels[i][0] - 3, hp: 2 }));
      r.runner.rot = r.runner.rot.map((q, i) => (i === 0 ? { state: "go", front: R.rot[0][0] + 6 } : q));
      for (const gap of [24, 6]) {
        r.runner.gap = gap;
        r.runner.close = gap < bs.CLOSE_ON;
        r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
        for (let k = 0; k < 3; k++) g.tick(16);
        stairAt(r, x, { safe: true });
      }
      r.you.ducking = true;
      g.tick(16);
      Object.assign(r.you, { state: "air", vy: 10, y: r.you.y + 3, ducking: false });
      g.tick(16);
    }
  }
  assert.equal(r.spec.id, "bonestair");
  // A crash.
  r.you.safeMs = 0;
  r.runner.hands = r.runner.hands.map(() => ({ state: "wait", t: 0 }));
  stairAt(r, R.ribs[0][0] - 8);
  for (let k = 0; k < 60; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  // Down on the Pit's floor, and the card.
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.cleared = ghoul.STAGES.slice(0, ghoul.RUN_STAGES).map((st) => st.id);
  d.offer = null;
  for (let n = 0; n < 14 && d.spec.id !== "bonestair"; n++) through(d);
  d.phase = "play";
  d.runner.done = true;
  Object.assign(d.you, { x: R.finish + 16, y: floorOf(R.finish + 16), state: "run" });
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
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) ghoul.steerSelect(p, 1, 0);
  const at = ghoul.FINALE.rooms.indexOf("bonestair");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, at);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "bonestair");
  assert.equal(p.runner.id, "bonestair");
  assert.equal(p.you.y, R.top[2]);
  assert.equal(p.bonusRound.max, 3);
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that plays well: it jumps at the edge of missing treads, over a grabbing hand and a pile of
// masonry, ducks every ribcage, and fires only while a skeleton is up ahead (a held blaster runs
// hot). `miss` is the share of things it fails to dodge (by a hash).
const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
function goodBot(round, seed, miss = 0) {
  const { you, runner: c, input: inp } = round;
  inp.left = inp.right = inp.down = false;
  inp.fire = false;
  if (round.phase !== "play" || !c || c.done) {
    inp.up = false;
    return;
  }
  const ok = (x) => mix(seed, Math.round(x)) >= miss;
  const look = seed % 4;
  inp.fire = c.skels.some((s) => (s.state === "rise" || s.state === "climb") && s.x > you.x && s.x - you.x < 75);
  let jump = false;
  if (you.state === "run") {
    for (const [x0] of R.gaps) if (x0 - you.x > 0 && x0 - you.x < 1.5 + look * 0.5 && ok(x0)) jump = true;
    R.hands.forEach(([x], i) => {
      const h = c.hands[i];
      if ((h.state === "grab" || h.state === "reach") && x - you.x > 4 && x - you.x < 7 + look && ok(x)) jump = true;
    });
    R.stones.forEach(([x], i) => {
      if (c.stones[i].state === "pile" && x - you.x > 7 && x - you.x < 9 + look && ok(x)) jump = true;
    });
    for (const [x] of R.ribs) if (you.x > x - bs.RIB_W / 2 - 3 && you.x < x + bs.RIB_W / 2 + 2 && ok(x)) inp.down = true;
  }
  if (jump && !inp.down) press(round);
  else inp.up = false;
}
function idleBot(round) {
  const inp = round.input;
  inp.left = inp.right = inp.down = inp.up = inp.fire = false;
}
function rideWith(seed, bot, limit = 80000) {
  const round = stairRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `YOU stay in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Bone Stair: a bot that dodges well runs the whole stair in about 30 seconds, every skeleton shot, all three hearts kept, 8 dice, past every checkpoint", () => {
  for (let seed = 1; seed <= 4; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 26000 && ms < 36000, `${ms} ms`);
    assert.equal(b.hearts, 3, lost.join(","));
    assert.equal(b.dice, 8);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.done, true);
    assert.equal(round.runner.check, R.checks.length - 1);
  }
});

test("Ghoul Rush's Bone Stair: a bot that misses some things still mostly finishes, never with a run life lost", () => {
  let won = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const { round } = rideWith(seed, (r) => goodBot(r, seed, 0.12));
    if (round.bonusRound.won) won++;
    assert.equal(round.lives, 3);
    assert.equal(round.over, false);
  }
  assert.ok(won >= 4, `${won} of 8 finished`);
});

test("Ghoul Rush's Bone Stair: a bot that never dodges loses all three hearts in the first half, ends with 0 dice, BONUS LOST, and the run goes on with no game over", () => {
  for (let seed = 1; seed <= 3; seed++) {
    const { round, lost } = rideWith(seed, idleBot);
    const b = round.bonusRound;
    assert.equal(b.won, false, "never finishes");
    assert.equal(b.dice, 0);
    assert.equal(b.hearts, 0);
    assert.equal(lost.length, 3);
    assert.ok(round.you.x < R.finish * 0.5, `out at ${round.you.x}`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.over, false, "no game over");
    // On into the next room.
    until(round, () => round.spec.id !== "bonestair", 12000);
    assert.notEqual(round.spec.id, "bonestair");
    assert.equal(round.over, false);
  }
});

test("Ghoul Rush's Bone Stair: a bot that ducks or holds back the whole way is caught by the rubble again and again", () => {
  for (const key of ["down", "left"]) {
    const { lost } = rideWith(3, (r) => {
      goodBot(r, 3);
      if (r.runner && !r.runner.done) r.input[key] = true;
    }, 30000);
    assert.ok(lost.filter((c) => c === "stairRubble").length >= 2, `${key}: ${lost.join(",")}`);
  }
});
