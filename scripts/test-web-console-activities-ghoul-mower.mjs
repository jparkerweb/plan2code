// Web console tests, Ghoul Rush's Gardener's Revenge (the Grounds' bonus round, between the Gazebo and the Groundskeeper's Yard): its shape (every pond and ditch clears with a jump and swallows a mower that does not jump, every low can be ducked), the mower's motion, each obstacle's cost and cause, the blades (cutting, the heat, the jam, the lawn cut), the topiary beasts, the hearts, the checkpoints, the finish and the dice, endless lives, the art on a fake canvas, and the two bots (one that plays well finishes in time, one that never dodges loses).
// Run with: node --test scripts/test-web-console-activities-ghoul-mower.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as mw from "../src/web-console/public/activities/ghoul-mower.js";
import * as ct from "../src/web-console/public/activities/ghoul-cart.js";
import { ANSWERS, EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as MOWER_LOOKS, VOICES as MOWER_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-mower-draw.js";
import { MOWER_SFX } from "../src/web-console/public/activities/ghoul-sfx-mower.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus } from "../src/web-console/public/activities/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the mower drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Gardener's Revenge reached the way play reaches it, nothing woken, the clocks long,
// the bonus round on (five hearts).
function mowerRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["grounds"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "mower") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "mower", time: 1e9, finish: 1e6, track: [], gaps: [], junk: [], lows: [], hedges: [], beasts: [], grass: [], weeds: [], checks: [] };
// The same round over a ride of its own (a plain lawn to measure the mower on).
function synth(ride) {
  const round = mowerRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, ...ride } };
  round.runner = null;
  mw.MOWER.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [4000, 20]]];

// The mower on line `line` of the ride at `x`, at speed `v`.
function mowerAt(round, x, line, { v = mw.MOWER_V, safe = false } = {}) {
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

const ROOM = ghoul.roomById("mower");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const LANE = R.track[0][0][1];

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Gardener's Revenge is the Grounds' fourth room, between the Gazebo and the Groundskeeper's Yard: lit, no key, no boss, a ride about 60 to 70 seconds long, a bonus round that plays its own track", () => {
  const st = ghoul.stageById("grounds");
  assert.deepEqual(st.rooms, ["maze", "topiary", "gazebo", "mower", "yard"]);
  assert.equal(st.boss, "keeper");
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Gardener's Revenge", "The lawn has not been mowed since 1893"]);
  assert.equal(ROOM.dark, false);
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true);
  assert.equal(R.runner, "mower", "the shared ride slot, which the cart's place leaves alone");
  assert.ok(ROOM.length >= 1800 && ROOM.length <= 3000, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.mower, "ghoulMowerRide");
  assert.ok(ghoulSfx.default.music.ghoulMowerRide, "its own track");
  assert.deepEqual(Object.keys(mw.MOWER.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.mower, MOWER_LOOKS.mower);
  assert.equal(LOOKS.mower.pack, "mower");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0, "no monsters: the things on the lawn are the pack's own");
  assert.equal(ROOM.ground.length, 2);
  assert.equal(ROOM.ground[1][0], R.finish, "the lawn's end begins at the finish");
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14);
  assert.ok(floorOf(ROOM.door - 2) > -Infinity, "floor to walk out on");
  assert.equal(ct.trackY(R, 0, ROOM.start), floorOf(ROOM.start), "the mower starts on the lawn");
  assert.equal(floorOf(R.finish + 1), LANE, "the lawn's end is level with the lawn");
  // Every line is flat at one height, running left to right.
  for (const L of lines) for (const [x, y] of L.pts) assert.equal(y, LANE, `a flat lawn at ${x}`);
  const secs = (lines.at(-1).x1 - ROOM.start) / mw.MOWER_V;
  assert.ok(secs >= 58 && secs <= 72, `${secs.toFixed(1)} s at MOWER_V`);
  assert.equal(ghoul.timeFor(ghoul.roomFor("mower")), R.time);
  assert.ok(R.time >= 1.5 * secs * 1000 && R.time <= 120000, `a ${R.time} ms clock for a ${secs.toFixed(0)} s ride`);
  assert.equal(lines.at(-1).x1, R.finish);
  assert.match(R.how, /UP to jump, DOWN to duck, hold space to shoot and mow/);
});

test("Ghoul Rush's Gardener's Revenge: every pond and ditch clears with a jump at the edge or a few units early, and a mower that never jumps drops into it", () => {
  assert.equal(R.gaps.length, lines.length - 1);
  assert.ok(R.gaps.includes(0) && R.gaps.includes(1), "ponds and ditches both");
  for (let i = 0; i + 1 < lines.length; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 7 && gap <= 12, `gap ${i} is ${gap} wide`);
    for (const v of [mw.MOWER_V - mw.BOG, mw.MOWER_V]) {
      assert.equal(mw.flight(R, a.x1, LANE, 0, v), null, `gap ${i}, no jump, at ${v}`);
      for (const early of v === mw.MOWER_V ? [0, 4, 8] : [0, 4]) {
        const x = a.x1 - early;
        const s = mw.flight(R, x, LANE, mw.MOWER_JUMP_V, v);
        assert.ok(s, `gap ${i}: a jump ${early} early at ${v} lands`);
        assert.equal(s.line, i + 1, `gap ${i} cleared, at ${v}, ${early} early`);
      }
    }
  }
});

test("Ghoul Rush's Gardener's Revenge: every thing is on the lawn, off the ends and off the gaps, spaced for a player (30 between jumps and 38 between a jump and a duck), a low's underside between a ducked box and a standing one", () => {
  const onLawn = (x) => lines.some((L) => x > L.x0 + 3 && x < L.x1 - 3);
  const hits = [];
  for (const [x] of R.junk) hits.push({ x, kind: "jump" });
  for (const x of R.hedges) hits.push({ x, kind: "jump" });
  for (const x of R.beasts) hits.push({ x, kind: "jump" });
  for (let i = 0; i + 1 < lines.length; i++) hits.push({ x: lines[i].x1, kind: "jump" });
  for (const [x0, x1, y, kind] of R.lows) {
    assert.ok(kind === 0 || kind === 1);
    assert.equal(y, LANE + 3, "a low's underside 3.0 over the lawn");
    assert.ok(y > LANE + ghoul.DUCK_H && y < LANE + ghoul.HIT_H, "between a ducked box and a standing one");
    assert.ok(x0 < x1);
    hits.push({ x: x0, x1, kind: "duck" });
  }
  for (const h of hits) if (h.kind === "jump" && h.x < lines.at(-1).x1) assert.ok(h.x > ROOM.start + 30, `${h.x} is past the start`);
  for (const [x] of R.junk) assert.ok(onLawn(x), `junk at ${x}`);
  for (const x of [...R.hedges, ...R.beasts]) assert.ok(onLawn(x), `a hedge or beast at ${x}`);
  hits.sort((p, q) => p.x - q.x);
  for (let i = 0; i + 1 < hits.length; i++) {
    const a = hits[i];
    const b = hits[i + 1];
    const need = a.kind === "jump" && b.kind === "jump" ? 30 : a.kind === "duck" && b.kind === "duck" ? 20 : a.kind === "jump" ? 38 : 24;
    const gap = b.x - (a.x1 ?? a.x);
    assert.ok(gap >= need, `${a.kind} at ${a.x} then ${b.kind} at ${b.x}: ${gap} between (${need} wanted)`);
  }
  // Counts: the room's graded obstacles and the mow targets.
  assert.equal(R.junk.length + R.lows.length + R.hedges.length + R.beasts.length + R.gaps.length, 36);
  assert.equal(R.checks.length, 5);
  for (const x of R.checks) assert.ok(onLawn(x), `checkpoint ${x}`);
  for (const [x0, x1] of R.grass) assert.ok(x1 > x0 && x0 >= 0 && x1 <= R.finish);
  assert.ok(mw.totalCells(R) > 600, `${mw.totalCells(R)} cells`);
  // Candy and items are on the lawn.
  assert.ok(ROOM.candy.length > 50);
  for (const [x, y] of ROOM.candy) assert.ok(y > LANE, `candy ${x} over the lawn`);
});

/* ------------------------------------------------------------ the mower */

test("Ghoul Rush's Gardener's Revenge rolls at MOWER_V, no key changes it, and it bogs down a little after a cut", () => {
  const flat = synth({ track: FLAT });
  assert.equal(flat.runner.v, mw.MOWER_V);
  assert.equal(flat.runner.id, "mower");
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - mw.MOWER_V) < 0.01);
  run(flat, 1500, { right: true });
  run(flat, 1500, { left: true });
  assert.ok(Math.abs(flat.runner.v - mw.MOWER_V) < 0.01, "right and left do nothing");
  assert.ok(Math.abs(flat.you.x - (10 + (2000 + 1500 + 1500) / 1000 * mw.MOWER_V)) < 1, "rides on at MOWER_V");
  assert.equal(flat.you.face, 1);
  assert.equal(flat.you.state, "run");
  assert.equal(flat.you.y, 20);
  const grass = synth({ track: FLAT, grass: [[40, 80]] });
  grass.input.fire = true;
  let low = mw.MOWER_V;
  until(grass, () => (low = Math.min(low, grass.runner.v)) < 0 || grass.you.x > 90, 4000);
  assert.ok(low < mw.MOWER_V - 2 && low >= mw.MOWER_V - mw.BOG - 0.01, `${low} while cutting`);
});

test("Ghoul Rush's Gardener's Revenge jumps about 11 high for about 0.7 s (22 across), a press saved for a landing jumps on it, one just after a line's end still jumps", () => {
  const round = synth({ track: FLAT });
  let top = 0;
  press(round);
  const t = until(round, () => {
    top = Math.max(top, round.you.y - 20);
    return round.you.state === "run" && round.you.y === 20 && round.you.vy === 0 && top > 1;
  }, 3000);
  assert.ok(Math.abs(top - (mw.MOWER_JUMP_V * mw.MOWER_JUMP_V) / (2 * mw.MOWER_G)) < 0.4, `${top.toFixed(1)} high`);
  assert.ok(t > 600 && t < 800, `${t} ms in the air`);
  assert.equal(events(round, "mowerJump").length, 1);
  assert.equal(events(round, "mowerLand").length, 1);
  const across = round.you.x - 10;
  assert.ok(across > 20 && across < 25, `${across.toFixed(1)} across`);
  const buf = synth({ track: FLAT });
  press(buf);
  run(buf, 600);
  press(buf);
  until(buf, () => events(buf, "mowerJump").length >= 2, 1500);
  assert.equal(events(buf, "mowerJump").length, 2, "the saved press jumped again at the landing");
  const edge = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  mowerAt(edge, 58.5, 0);
  run(edge, 60);
  assert.equal(edge.runner.line, -1, "off the end");
  press(edge);
  run(edge, 4);
  assert.equal(events(edge, "mowerJump").length, 1, "coyote");
  const late = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  mowerAt(late, 58.5, 0);
  run(late, 60 + mw.COYOTE_MS);
  press(late);
  run(late, 4);
  assert.equal(events(late, "mowerJump").length, 0);
});

test("Ghoul Rush's Gardener's Revenge: down ducks (and a press of up jumps instead of ducking), a ducked Planny passes under a hedge arch or a line of gloves and a standing one hits it (causes arch and line), at the cost of a heart", () => {
  const round = synth({ track: FLAT, lows: [[60, 66, 23, 0]] });
  const you = round.you;
  assert.equal(you.ducking, false);
  run(round, 20, { down: true });
  assert.equal(events(round, "mowerDuck").length, 1);
  round.input.down = true;
  until(round, () => you.x > 75, 3000);
  round.input.down = false;
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.lives, 3);
  for (const [kind, cause] of [[0, "arch"], [1, "line"]]) {
    const hit = synth({ track: FLAT, lows: [[60, 66, 23, kind]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4, `${cause} costs a heart`);
    assert.equal(events(hit, "lose")[0].cause, cause);
    assert.equal(hit.lives, 3);
    assert.ok(hit.you.safeMs > 0, "Planny blinks safe");
    assert.deepEqual(hit.bonusRound.perf.hits, ["l0"]);
    run(hit, 800);
    assert.equal(hit.bonusRound.hearts, 4, "the safe moment spares the rest of it");
    assert.equal(hit.runner.done, false, "the mower rolls on");
  }
  const jump = synth({ track: FLAT, lows: [[60, 66, 23, 0]] });
  mowerAt(jump, 52, 0);
  press(jump);
  run(jump, 8);
  assert.equal(jump.you.ducking, false);
  assert.equal(events(jump, "mowerJump").length, 1);
});

test("Ghoul Rush's Gardener's Revenge: a gnome, a wheelbarrow and a flowerpot are cleared by a jump and cost a heart otherwise (causes gnome, barrow and pot), each only once", () => {
  for (const [kind, cause] of [[0, "gnome"], [1, "barrow"], [2, "pot"]]) {
    const hit = synth({ track: FLAT, junk: [[60, kind]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4, `${cause} costs a heart`);
    assert.equal(events(hit, "lose")[0].cause, cause);
    assert.equal(events(hit, "mowerCrash")[0].what, cause);
    assert.deepEqual(hit.bonusRound.perf.hits, ["j0"]);
    run(hit, 500);
    assert.equal(hit.bonusRound.hearts, 4);
    for (const from of [60 - 16, 60 - 12, 60 - 9, 60 - 6]) {
      const clear = synth({ track: FLAT, junk: [[60, kind]] });
      mowerAt(clear, from, 0);
      press(clear);
      until(clear, () => clear.you.x > 80, 3000);
      assert.equal(clear.bonusRound.hearts, 5, `${cause} jumped from ${from}`);
    }
  }
  assert.equal(mw.JUNK.length, 3);
});

test("Ghoul Rush's Gardener's Revenge: a pond or a ditch with no jump is a heart (causes pond and ditch), the mower goes back on the lawn ahead at MOWER_V and rolls on; a jump over it costs nothing", () => {
  for (const [kind, cause] of [[0, "pond"], [1, "ditch"]]) {
    const gap = synth({ track: [[[0, 20], [60, 20]], [[72, 20], [400, 20]]], gaps: [kind] });
    mowerAt(gap, 30, 0);
    until(gap, () => events(gap, "lose").length > 0, 3000);
    assert.equal(events(gap, "lose")[0].cause, cause);
    assert.equal(events(gap, "mowerCrash")[0].what, cause);
    assert.equal(gap.bonusRound.hearts, 4);
    assert.deepEqual(gap.bonusRound.perf.hits, ["g0"]);
    assert.equal(gap.runner.line, 1, "back on the next lawn");
    assert.equal(gap.you.y, 20);
    assert.equal(gap.runner.v, mw.MOWER_V);
    run(gap, 600);
    assert.equal(gap.bonusRound.hearts, 4);
    const over = synth({ track: [[[0, 20], [60, 20]], [[72, 20], [400, 20]]], gaps: [kind] });
    mowerAt(over, 56, 0);
    press(over);
    until(over, () => over.you.x > 100, 3000);
    assert.equal(over.bonusRound.hearts, 5, `${cause} jumped`);
  }
});

/* ------------------------------------------------------------- the blades */

test("Ghoul Rush's Gardener's Revenge: holding fire lowers the blades, which cut every grass cell within BLADE_REACH ahead (GRASS_POINTS each) and nothing behind or out of reach; let go, nothing is cut", () => {
  const dry = synth({ track: FLAT, grass: [[30, 60]] });
  run(dry, 1500);
  assert.equal(dry.runner.cut, 0, "no fire, no cut");
  assert.equal(dry.runner.blade, false);
  const round = synth({ track: FLAT, grass: [[40, 70]] });
  mowerAt(round, 29, 0);
  const score = round.score;
  round.input.fire = true;
  run(round, 24);
  assert.equal(round.runner.blade, true);
  assert.equal(round.runner.cut, 0, "nothing in reach yet");
  until(round, () => round.runner.cut > 0, 1000);
  const cells = round.runner.cut;
  assert.ok(cells >= 1);
  const row = round.runner.grass[0];
  assert.ok(row[0] && !row[mw.BLADE_REACH + 3], "the nearest cells first, none beyond the zone");
  assert.ok(round.you.x + mw.BLADE_REACH >= 40);
  assert.equal(round.score - score >= cells * mw.GRASS_POINTS, true);
  const ev = events(round, "mowerGrass");
  assert.ok(ev.length >= 1 && ev[0].points === ev[0].n * mw.GRASS_POINTS);
  until(round, () => round.you.x > 62, 2000);
  assert.equal(round.runner.cut, 30, "the whole strip, 30 cells");
  assert.equal(round.runner.cells, 30);
  assert.ok(Math.abs(round.runner.lawn - 1) < 1e-9);
});

test("Ghoul Rush's Gardener's Revenge: a thorn hedge is cut by the blades (HEDGE_POINTS, an act) before it can hurt, or jumped; uncut it costs a heart (cause thorns); a weed patch is cut for WEED_POINTS and counts WEED_CELLS", () => {
  const cut = synth({ track: FLAT, hedges: [80] });
  mowerAt(cut, 60, 0);
  cut.input.fire = true;
  const score = cut.score;
  until(cut, () => cut.you.x > 95, 3000);
  assert.equal(cut.bonusRound.hearts, 5, "cut, not hit");
  assert.equal(cut.runner.hedges[0], true);
  assert.equal(events(cut, "mowerHedge").length, 1);
  assert.ok(cut.score - score >= mw.HEDGE_POINTS, "the points (and any souls on the way)");
  assert.equal(events(cut, "mowerHedge")[0].points, mw.HEDGE_POINTS);
  assert.equal(cut.bonusRound.perf.acts, 1);
  const hit = synth({ track: FLAT, hedges: [80] });
  until(hit, () => hit.bonusRound.hearts < 5, 4000);
  assert.equal(hit.bonusRound.hearts, 4);
  assert.equal(events(hit, "lose")[0].cause, "thorns");
  assert.deepEqual(hit.bonusRound.perf.hits, ["h0"]);
  for (const from of [80 - 16, 80 - 10, 80 - 6]) {
    const jump = synth({ track: FLAT, hedges: [80] });
    mowerAt(jump, from, 0);
    press(jump);
    until(jump, () => jump.you.x > 100, 3000);
    assert.equal(jump.bonusRound.hearts, 5, `jumped from ${from}`);
    assert.equal(jump.runner.hedges[0], false, "left standing");
  }
  const weeds = synth({ track: FLAT, weeds: [60, 90], grass: [[120, 130]] });
  assert.equal(weeds.runner.cells, 2 * mw.WEED_CELLS + 10);
  mowerAt(weeds, 40, 0);
  weeds.input.fire = true;
  const s0 = weeds.score;
  until(weeds, () => weeds.you.x > 100, 4000);
  assert.deepEqual(weeds.runner.weeds, [true, true]);
  assert.ok(weeds.score - s0 >= 2 * mw.WEED_POINTS);
  assert.equal(weeds.bonusRound.perf.acts, 2);
  assert.equal(weeds.runner.cut, 2 * mw.WEED_CELLS);
  assert.equal(events(weeds, "mowerWeed").length, 2);
});

test("Ghoul Rush's Gardener's Revenge: the blades heat while fire is held (HEAT_UP a second), cool when let go (COOL), and at full heat jam for JAM_MS, cutting nothing, then restart at JAM_RESUME", () => {
  const round = synth({ track: FLAT });
  round.input.fire = true;
  run(round, 1000);
  assert.ok(Math.abs(round.runner.heat - mw.HEAT_UP) < 0.02, `${round.runner.heat} after a second`);
  round.input.fire = false;
  run(round, 500);
  assert.ok(Math.abs(round.runner.heat - (mw.HEAT_UP - mw.COOL * 0.5)) < 0.03, `${round.runner.heat} after cooling`);
  run(round, 2000);
  assert.equal(round.runner.heat, 0);
  // Held to the end: a jam.
  const jam = synth({ track: FLAT, grass: [[40, 900]], hedges: [] });
  jam.input.fire = true;
  const t = until(jam, () => jam.runner.jam > 0, 4000);
  assert.ok(Math.abs(t - 1000 / mw.HEAT_UP) < 60, `jammed after ${t} ms`);
  assert.equal(events(jam, "mowerJam").length, 1);
  assert.equal(jam.runner.blade, false);
  const cut = jam.runner.cut;
  run(jam, mw.JAM_MS / 2);
  assert.equal(jam.runner.cut, cut, "nothing is cut while jammed, though fire is held");
  assert.ok(jam.runner.heat < 1 && jam.runner.heat > mw.JAM_RESUME);
  until(jam, () => jam.runner.jam === 0, 2000);
  assert.ok(Math.abs(jam.runner.heat - mw.JAM_RESUME) < 0.02 || jam.runner.heat > mw.JAM_RESUME);
  run(jam, 100);
  assert.equal(jam.runner.blade, true, "the blades come down again");
  assert.ok(jam.runner.cut > cut);
  // A thorn hedge met while jammed is not cut.
  const hedge = synth({ track: FLAT, hedges: [100] });
  hedge.runner.jam = 5000;
  hedge.input.fire = true;
  until(hedge, () => hedge.bonusRound.hearts < 5 || hedge.you.x > 120, 5000);
  assert.equal(events(hedge, "lose")[0].cause, "thorns");
});

test("Ghoul Rush's Gardener's Revenge: the lawn cut is the grade's steady die (LAWN_GOAL), the cut stays cut after a restart, and ACTS_GOAL cuts and shots are the acts die", () => {
  const round = synth({ track: FLAT, grass: [[40, 80]] });
  mowerAt(round, 28, 0);
  const b = round.bonusRound;
  assert.equal(b.perf.steady, false);
  assert.equal(b.perf.goal, mw.ACTS_GOAL);
  round.input.fire = true;
  until(round, () => round.runner.lawn >= mw.LAWN_GOAL - 0.0001 && round.runner.lawn < 1, 3000);
  assert.equal(b.perf.steady, true, "60% is the die");
  // Below the goal, no die.
  const low = synth({ track: FLAT, grass: [[40, 80]] });
  mowerAt(low, 28, 0);
  low.input.fire = true;
  until(low, () => low.runner.lawn > 0.4, 3000);
  low.input.fire = false;
  run(low, 200);
  assert.ok(low.runner.lawn < mw.LAWN_GOAL);
  assert.equal(low.bonusRound.perf.steady, false);
  // The lawn cut survives the same room's restart.
  const cutBefore = round.runner.grass[0].slice();
  mw.MOWER.place[0](round, {});
  assert.deepEqual(round.runner.grass[0], cutBefore);
  assert.equal(round.runner.cut, cutBefore.filter(Boolean).length);
  // The dice formula with and without the die.
  const make = (steadyDie, acts) => ({ hearts: 5, max: 5, perf: { total: 36, hits: [], acts, goal: mw.ACTS_GOAL, steady: steadyDie, kills0: 0 } });
  assert.equal(diceFor(make(true, mw.ACTS_GOAL)), 9);
  assert.equal(diceFor(make(false, mw.ACTS_GOAL)), 8);
  assert.equal(diceFor(make(true, 0)), 8);
  assert.equal(diceFor(make(false, 0)), 7);
  const bad = make(false, 0);
  bad.hearts = 1;
  bad.perf.hits = Array.from({ length: 36 }, (_, i) => `x${i}`);
  assert.equal(diceFor(bad), BONUS_FLOOR);
});

/* -------------------------------------------------------- topiary beasts */

test("Ghoul Rush's Gardener's Revenge: a topiary beast shivers when the mower is BEAST_NEAR short, lunges into the lane for BEAST_UP_MS, snaps (cause snap) if you meet it, and a jump clears it", () => {
  const round = synth({ track: FLAT, beasts: [120] });
  const b = round.runner.beasts[0];
  assert.equal(b.state, "idle");
  until(round, () => b.state === "warn", 3000);
  assert.ok(Math.abs(120 - round.you.x - mw.BEAST_NEAR) < 2, `woke ${120 - round.you.x} short`);
  assert.equal(events(round, "mowerBeastWarn").length, 1);
  until(round, () => b.state === "snap", 1000);
  assert.equal(events(round, "mowerBeastSnap").length, 1);
  until(round, () => round.bonusRound.hearts < 5, 3000);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose")[0].cause, "snap");
  assert.equal(events(round, "mowerCrash")[0].what, "snap");
  assert.deepEqual(round.bonusRound.perf.hits, ["b0"]);
  for (const from of [120 - 16, 120 - 10, 120 - 6]) {
    const jump = synth({ track: FLAT, beasts: [120] });
    mowerAt(jump, from, 0);
    jump.runner.beasts[0].state = "snap";
    jump.runner.beasts[0].t = mw.BEAST_UP_MS;
    press(jump);
    until(jump, () => jump.you.x > 140, 3000);
    assert.equal(jump.bonusRound.hearts, 5, `jumped from ${from}`);
  }
  // It goes back to being a bush if it is not met.
  const away = synth({ track: FLAT, beasts: [120] });
  mowerAt(away, 100, 0, { safe: true });
  until(away, () => away.runner.beasts[0].state === "spent", 6000);
  assert.equal(away.runner.beasts[0].state, "spent");
});

test("Ghoul Rush's Gardener's Revenge: BEAST_HP bolts break a lunging beast (150 points, an act, mowerBeastHit then mowerBeastBreak); a sleeping one is not hit, and what was shot stays shot after a restart", () => {
  const round = synth({ track: FLAT, beasts: [120] });
  const b = round.runner.beasts[0];
  const shoot = () => {
    const y = 20 + 2.4;
    round.shots.push({ x: 119, y, vx: 130, vy: 0, gone: 0 });
    run(round, 12);
  };
  shoot();
  assert.equal(b.hp, mw.BEAST_HP, "a sleeping beast takes no bolt");
  b.state = "snap";
  b.t = mw.BEAST_UP_MS;
  round.you.safeMs = 1e9;
  const score = round.score;
  shoot();
  assert.equal(b.hp, mw.BEAST_HP - 1);
  assert.equal(events(round, "mowerBeastHit").length, 1);
  assert.equal(b.state, "snap");
  shoot();
  assert.equal(b.state, "broken");
  assert.equal(events(round, "mowerBeastBreak").length, 1);
  assert.equal(round.score - score, mw.BEAST_POINTS);
  assert.equal(round.bonusRound.perf.acts, 1);
  mw.MOWER.place[0](round, {});
  assert.equal(round.runner.beasts[0].state, "broken");
});

/* ------------------------------------------------------------ the rounds */

test("Ghoul Rush's Gardener's Revenge: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Groundskeeper's Yard", () => {
  const round = mowerRound();
  round.dice = 2;
  round.bonusRound.hearts = 1;
  mowerAt(round, lines[0].x1 - 6, 0);
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
  assert.equal(round.spec.id, "yard");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner, null, "the slot is empty in any other room");
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Gardener's Revenge: the checkpoints are passed in order (an event each) and the ride goes back to the last one after a restart", () => {
  const round = mowerRound();
  round.you.safeMs = 1e9;
  mowerAt(round, R.checks[0] - 3, lines.findIndex((L) => L.x1 > R.checks[0] - 3 && L.x0 < R.checks[0] - 3), { safe: true });
  until(round, () => round.runner.check >= 0, 1000);
  assert.equal(round.runner.check, 0);
  const ev = events(round, "mowerCheck");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].n, 1);
  round.you.x = R.checks[2] + 1;
  round.you.y = LANE;
  round.runner.line = lines.findIndex((L) => L.x1 > R.checks[2] + 1 && L.x0 < R.checks[2] + 1);
  until(round, () => round.runner.check >= 2, 1000);
  assert.equal(round.runner.check, 2, "all passed on the way");
  mw.MOWER.place[0](round, {});
  assert.equal(round.you.x, R.checks[2], "back at the last one");
  assert.equal(round.runner.check, 2);
});

test("Ghoul Rush's Gardener's Revenge: rolling onto the lawn's end stops the mower (mowerFinish), the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = mowerRound();
  round.dice = 1;
  const last = lines.length - 1;
  mowerAt(round, lines[last].x1 - 12, last, { safe: true });
  until(round, () => round.runner.done, 4000);
  assert.equal(round.runner.done, true);
  const fin = events(round, "mowerFinish");
  assert.equal(fin.length, 1);
  assert.ok(round.you.x >= R.finish && round.you.x < R.finish + 2, `${round.you.x} stopped`);
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
  assert.equal(round.dice, Math.min(ghoul.MAX_DICE, 1 + end[0].dice));
  assert.equal(round.lives, 3);
  run(round, ghoul.CARD_MS + 100);
  assert.equal(round.spec.id, "yard");
  assert.equal(round.runner, null);
});

test("Ghoul Rush's Gardener's Revenge: no random number is drawn in the room (a ride of 20 seconds, jumping, mowing and shooting, on a draw that throws)", () => {
  const round = mowerRound();
  mowerAt(round, 120, 0, { safe: true });
  round.input.fire = true;
  for (let t = 0; t < 20000; t += 4) {
    if (t % 1500 === 0) press(round);
    ghoul.advance(round, 4, never);
    round.events.length = 0;
    round.you.safeMs = 1e9;
    if (round.phase !== "play") break;
  }
  assert.ok(round.you.x > 500);
});

test("Ghoul Rush's Gardener's Revenge: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const tries = [
    { junk: [[60, 0]] }, { junk: [[60, 1]] }, { junk: [[60, 2]] }, { lows: [[56, 62, 23, 0]] }, { lows: [[56, 66, 23, 1]] }, { hedges: [[60]].map((r) => r[0]) }, { beasts: [60] },
  ];
  for (const t of tries) {
    const r = synth({ track: FLAT, ...t });
    r.infinite = true;
    if (t.beasts) mowerAt(r, 20, 0);
    until(r, () => events(r, "lose").length > 0, 4000);
    assert.ok(events(r, "lose").length > 0, JSON.stringify(Object.keys(t)));
    assert.equal(r.bonusRound.hearts, 5, JSON.stringify(Object.keys(t)));
    assert.equal(r.lives, 3);
  }
  for (const kind of [0, 1]) {
    const gap = synth({ track: [[[0, 20], [60, 20]], [[72, 20], [400, 20]]], gaps: [kind] });
    gap.infinite = true;
    mowerAt(gap, 30, 0);
    until(gap, () => events(gap, "lose").length > 0, 3000);
    assert.equal(gap.bonusRound.hearts, 5);
    assert.equal(gap.lives, 3);
  }
});

test("Ghoul Rush's Gardener's Revenge: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ track: FLAT, junk: [[60, 0]] });
  round.you.garlic = true;
  until(round, () => round.you.x > 70, 3000);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false, "spent");
});

/* ------------------------------------------------------ sounds and words */

test("Ghoul Rush's Gardener's Revenge: every event has a voice that plays, every cause has words and a sound, the voices borrow tones that exist, and the tones are short", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...mw.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = MOWER_VOICES[kind] && MOWER_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    assert.ok(heard({ type: event, what: "pond", points: 50 }).played.includes(name), `${event} plays ${name}`);
  }
  for (const cause of ["gnome", "barrow", "pot", "arch", "line", "thorns", "snap", "pond", "ditch"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "mowerJump" }).played.length, 1);
  assert.equal(heard({ type: "mowerHedge", points: 80 }).played.length, 1);
  for (const [name, tone] of Object.entries(MOWER_SFX.tones)) {
    for (const layer of tone.layers) assert.ok((layer.delay || 0) + layer.seconds <= 1.2, `${name} is under 1.2 s`);
  }
  const music = MOWER_SFX.music.ghoulMowerRide;
  for (const [key, p] of Object.entries(music.patterns)) {
    for (const [voice, text] of Object.entries(p)) {
      assert.ok(music.voices[voice], `${key}.${voice} is a voice`);
      const bars = text.split("|").map((s) => s.trim().split(/\s+/).length);
      assert.deepEqual(bars, [16, 16, 16, 16], `${key}.${voice}: four bars of 16 steps`);
    }
  }
  for (const key of music.order) assert.ok(music.patterns[key]);
});

test("Ghoul Rush's Gardener's Revenge: the room's own names do not collide with the game's (events, kinds)", () => {
  for (const e of mw.EVENTS) assert.ok(e.startsWith("mower"), e);
  const other = new Set(ct.EVENTS || []);
  for (const e of mw.EVENTS) assert.ok(!other.has(e), `${e} is the mower's alone`);
  assert.deepEqual(Object.keys(mw.MOWER).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  for (const name of Object.keys(MOWER_SFX.tones)) assert.ok(name.startsWith("ghoulMower"), name);
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Gardener's Revenge draws: the room in a lit and a dark one, the mower on the lawn, in the air and ducking, with the blades up, down and jammed, each thing (grass cut and uncut, weeds, hedges, junk, arches, lines, beasts in each state, ponds, ditches), a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["grounds"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "mower") through(r);
  r.lives = 99;
  const spots = [ROOM.start + 40, R.junk[0][0] - 10, R.lows[0][0] - 5, R.lows[1][0] - 5, R.hedges[0] - 10, R.beasts[0] - 20, R.checks[0], lines[0].x1 - 10, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      const line = Math.max(0, lines.findIndex((L) => x >= L.x0 && x <= L.x1));
      mowerAt(r, x, line, { safe: true });
      r.runner.beasts = r.runner.beasts.map((b, i) => ({ ...b, state: ["idle", "warn", "snap", "sink", "spent", "broken"][i % 6], t: 600 }));
      r.runner.grass = r.runner.grass.map((row, i) => row.map((_, j) => (i + j) % 3 === 0));
      r.runner.hedges = r.runner.hedges.map((_, i) => i % 2 === 0);
      r.runner.weeds = r.runner.weeds.map((_, i) => i % 2 === 0);
      for (const mode of ["up", "down", "jam"]) {
        r.input.fire = mode === "down";
        r.runner.jam = mode === "jam" ? 900 : 0;
        r.runner.heat = mode === "jam" ? 0.7 : 0.4;
        for (const air of [false, true]) {
          if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
          if (air) r.runner.line = -1;
          r.you.ducking = x === R.lows[0][0] - 5 && !air;
          r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: 0, gone: 0 });
          for (let k = 0; k < 3; k++) g.tick(16);
          r.monsters.length = 0;
          r.you.safeMs = 1e9;
          mowerAt(r, x, line, { safe: true });
        }
      }
    }
  }
  r.input.fire = false;
  assert.equal(r.spec.id, "mower");
  // A crash, then the stop and the lost and won cards.
  r.you.safeMs = 0;
  mowerAt(r, R.junk[0][0] - 3, 0);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["grounds"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "mower") through(d);
  d.phase = "play";
  d.runner.done = true;
  d.runner.restX = R.finish + 1;
  Object.assign(d.you, { x: R.finish + 30, y: LANE, state: "run" });
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
  const at = ghoul.STAGES.findIndex((s) => s.id === "grounds");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "mower");
  assert.equal(p.runner.line, 0);
  assert.equal(p.you.y, LANE);
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that plays well: it jumps at the end of a line, 6 to 15 short of junk or a snapping beast, ducks under
// every low, and works the blades: fire while there is grass, a weed or a thorn hedge in reach (and cool), a
// jump over a hedge when the blades are jammed. `miss` is the share of things it fails to dodge (by a hash).
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
  if (round.phase !== "play" || !c || c.done) {
    inp.up = false;
    inp.fire = false;
    return;
  }
  const ok = (x) => mix(seed, Math.round(x)) >= miss;
  const look = 9 + (seed % 7);
  let jump = false;
  let fire = false;
  if (c.line >= 0) {
    if (lines[c.line].x1 - you.x < 2.2 && c.line < lines.length - 1 && ok(lines[c.line].x1)) jump = true;
    const ahead = (x) => x - you.x > 6 && x - you.x < look;
    for (const [x] of R.junk) if (ahead(x) && ok(x)) jump = true;
    R.hedges.forEach((x, i) => {
      if (c.hedges[i]) return;
      const away = x - you.x;
      if (away > -2 && away < mw.BLADE_REACH + 4) fire = true;
      if (ahead(x) && (c.jam > 0 || c.heat > 0.85) && ok(x)) jump = true;
    });
    R.beasts.forEach((x, i) => {
      const b = c.beasts[i];
      if (b.state === "broken" || b.state === "spent" || b.state === "sink") return;
      if (x - you.x > 0 && x - you.x < 36) fire = true;
      if (b.state === "snap" && ahead(x) && x - you.x < 11 && ok(x)) jump = true;
    });
    for (const [x0, x1] of R.lows) if (you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
    // Grass and weeds in reach.
    R.grass.forEach((gr, i) => {
      if (gr[1] > you.x && gr[0] < you.x + mw.BLADE_REACH && c.grass[i].some((cell) => !cell)) fire = true;
    });
    R.weeds.forEach((x, i) => {
      if (!c.weeds[i] && x > you.x - 1 && x < you.x + mw.BLADE_REACH + 3) fire = true;
    });
  }
  inp.fire = fire && c.heat < 0.93;
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
  const round = mowerRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the mower stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Gardener's Revenge: a bot that plays well finishes the whole lawn in 60 to 78 seconds, 7 to 9 dice, past every checkpoint, most of the lawn cut", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")}, lawn ${(round.runner.lawn * 100).toFixed(0)}%)`);
    assert.ok(ms > 60000 && ms < 78000, `${ms} ms`);
    assert.ok(b.dice >= 6 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice (lawn ${(round.runner.lawn * 100).toFixed(0)}%, acts ${b.perf.acts}, lost ${lost.join(",")})`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.check, R.checks.length - 1, "past every checkpoint");
    assert.ok(round.runner.lawn >= mw.LAWN_GOAL, `lawn ${(round.runner.lawn * 100).toFixed(0)}%`);
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 7, `${dice.join(",")}`);
});

test("Ghoul Rush's Gardener's Revenge: a bot that dodges well but holds fire the whole way jams the blades again and again, cuts under the lawn goal (no steady die) and earns fewer dice than one that pulses them", () => {
  for (let seed = 1; seed <= 4; seed++) {
    let jams = 0;
    let was = 0;
    const holder = rideWith(seed, (r) => {
      goodBot(r, seed);
      r.input.fire = true;
      if (r.runner) {
        if (r.runner.jam > 0 && !was) jams++;
        was = r.runner.jam > 0 ? 1 : 0;
        // It jumps a thorn hedge it cannot cut while the blades are jammed.
        if (r.runner.line >= 0) R.hedges.forEach((x, i) => (!r.runner.hedges[i] && x - r.you.x > 6 && x - r.you.x < 12 && r.runner.jam > 0 ? press(r) : null));
      }
    });
    const pulser = rideWith(seed, (r) => goodBot(r, seed));
    assert.ok(jams >= 8, `jammed ${jams} times`);
    assert.equal(holder.round.bonusRound.won, true, `seed ${seed} finished`);
    assert.ok(holder.round.runner.lawn < mw.LAWN_GOAL, `lawn ${holder.round.runner.lawn}`);
    assert.equal(holder.round.bonusRound.perf.steady, false);
    assert.ok(holder.round.bonusRound.dice < pulser.round.bonusRound.dice, `${holder.round.bonusRound.dice} dice to ${pulser.round.bonusRound.dice}`);
  }
});

test("Ghoul Rush's Gardener's Revenge: a bot that never dodges (holding fire) loses all five hearts before the first third, ends with 0 dice and the run goes on", () => {
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

test("Ghoul Rush's Gardener's Revenge telegraphs: DUCK over arches and lines, JUMP over ponds, ditches and junk, CUT over thorn hedges, none for beasts, weeds or grass, words only on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  assert.equal(marks.length, R.gaps.length + R.junk.length + R.hedges.length + R.lows.length);
  for (const m of marks) assert.equal(m.answer, ANSWERS[m.kind], m.kind);
  assert.deepEqual(new Set(marks.map((m) => m.kind)), new Set(["pond", "ditch", "junk", "hedge", "arch", "line"]));
  R.lows.forEach(([x0, x1, y, kind]) => {
    const m = marks.find((q) => q.x === (x0 + x1) / 2);
    assert.equal(m.kind, kind ? "line" : "arch");
    assert.equal(m.answer, "DUCK");
  });
  for (const x of R.hedges) assert.equal(marks.find((q) => q.kind === "hedge" && q.x === x).answer, "CUT");
  const m = marks.find((q) => q.kind === "junk");
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "junk" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  for (const kind of ["pond", "ditch", "junk", "hedge", "arch", "line"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 3, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((t) => t.lead === q.lead);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
});

test("Ghoul Rush's Gardener's Revenge's intro banner says the controls plainly", () => {
  assert.match(R.how, /UP to jump, DOWN to duck/);
  assert.match(R.how, /mow/);
});
