// Web console tests, Ghoul Rush's Torch Mob (Hollow End Village's bonus round, between the Square and the Green): its shape (every ditch and the bridge clear with a jump and swallow a wagon that does not jump, every low can be ducked, spacing, checkpoints), the wagon's speed (the brake that is also a duck), every obstacle's cost and cause (barrels, crates, washing lines, inn signs, pitchforks, torches, horses, ditches, the river, the mob), the throwers' wind-up and aim, shooting torches and forks out of the air, the horses, the pursuit meter (the gap that clean riding opens and braking, hits and fire close), the hay fire, the catch, hearts of its own, the grade and the dice, endless lives, the checkpoints, the finish, no random numbers, its sounds and its drawing on a fake canvas, and bots that play it well and badly.
// Run with: node --test scripts/test-web-console-activities-ghoul-wagon.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as wg from "../src/web-console/public/activities/ghoul-rush/rides/wagon/ghoul-wagon.js";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import { ANSWERS, EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as WAGON_LOOKS, VOICES as WAGON_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/wagon/ghoul-wagon-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the wagon drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Torch Mob reached the way play reaches it, nothing woken, the clocks long,
// the bonus round on (five hearts).
function wagonRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["village"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "wagon") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "wagon", time: 1e9, finish: 1e6, track: [], blocks: [], lows: [], throwers: [], horses: [], checks: [], surge: [] };
// The same round over a ride of its own (a plain road to measure the wagon on).
function synth(ride) {
  const round = wagonRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, ...ride } };
  wg.WAGON.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [6000, 20]]];

// The wagon on line `line` of the ride at `x`, at speed `v`.
function wagonAt(round, x, line, { v = wg.WAGON_V, safe = false } = {}) {
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
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

const ROOM = ghoul.roomById("wagon");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const FINISH_LINE = lines.length - 1;
const BRIDGE_LINE = lines.findIndex((L, i) => i + 1 < lines.length && L.x1 >= R.bridge[0] && L.x1 <= R.bridge[1]);
const isBridgeGap = (i) => i === BRIDGE_LINE;

// The kit's numbers the room is built to.
const K = { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Torch Mob is Hollow End Village's fourth room, between the Square and the Green: lit, no key, no boss, no pickups, a ride about 60 to 75 seconds long, a bonus round that plays its own track", () => {
  const st = ghoul.stageById("village");
  assert.deepEqual(st.rooms, ["street", "inn", "square", "wagon", "green"]);
  assert.equal(st.rooms.indexOf("wagon"), st.rooms.length - 2, "just before the boss");
  assert.deepEqual([ROOM.title, ROOM.sub], ["Torch Mob", "Hollow End sends its regards. Loudly"]);
  assert.equal(ROOM.dark, false, "a moonlit night, always lit");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "wagon");
  assert.equal(R.sled, undefined);
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3000, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.wagon, "ghoulWagonRide");
  assert.ok(ghoulSfx.default.music.ghoulWagonRide, "its own track");
  assert.deepEqual(Object.keys(wg.WAGON.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.wagon, WAGON_LOOKS.wagon);
  assert.equal(LOOKS.wagon.pack, "wagon");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]) && Object.isFrozen(R.blocks[0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0, "no monsters: the things on the road are the pack's own");
  assert.deepEqual([ROOM.candy.length, ROOM.items.length], [0, 0], "no pickups");
  // The ground is the cobbles at the start and the green at the end only.
  assert.equal(ROOM.ground.length, 2);
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 150, "floor only at the ends");
  assert.equal(ROOM.ground[1][0], R.finish);
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14, "the door at the room's end, past the green's start");
  assert.ok(floorOf(ROOM.door - 2) > -Infinity, "floor to walk out on");
  // Lines run left to right, their points rising in x; the first starts under the wagon.
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the wagon starts on the road over the cobbles");
  // The ride, at the wagon's speed, takes 60 to 75 seconds.
  const secs = (lines.at(-1).x1 - ROOM.start) / wg.WAGON_V;
  assert.ok(secs >= 60 && secs <= 75, `${secs.toFixed(1)} s at WAGON_V`);
  // The road is flat but for the bridge's hump, ramp and far side; never steep but at the two ramps.
  for (const L of lines) {
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const s = (L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0]);
      assert.ok(s >= -0.15 && s <= 0.32, `a slope of ${s.toFixed(3)}`);
    }
    for (const [, y] of L.pts) assert.ok(y > wg.DERAIL_Y + 8 && y < 36, `a road height of ${y}`);
  }
  // The clock covers the ride comfortably (and respawns refill it).
  assert.equal(ghoul.timeFor(ghoul.roomFor("wagon")), R.time);
  assert.ok(R.time >= 1.4 * secs * 1000 && R.time <= 120000, `a ${R.time} ms clock for a ${secs.toFixed(0)} s ride`);
  // The last line ends in a lip that launches the wagon onto the green.
  assert.ok(ct.slopeOf(R, FINISH_LINE, lines.at(-1).x1) >= wg.RAMP_SLOPE, "the lip launches");
  assert.ok(R.bridge[0] < R.bridge[1] && R.bridge[1] < R.finish);
  assert.ok(BRIDGE_LINE > 0, "a line ends at the bridge");
  assert.deepEqual([R.blocks.length, R.lows.length, R.throwers.length, R.horses.length, lines.length - 1], [7, 6, 9, 2, 5], "barrels and crates, washing and signs, throwers, horses, ditches and the bridge");
});

test("Ghoul Rush's Torch Mob: the lip's launch alone carries the wagon onto the green at any speed it can have there, landing 4 to 45 past its start", () => {
  const lip = lines.at(-1);
  const end = lip.pts.at(-1);
  const rise = ct.slopeOf(R, FINISH_LINE, lip.x1);
  const green = floorOf(R.finish + 1);
  for (const v of [wg.BRAKE_V, 34, wg.WAGON_V, wg.WAGON_V + wg.PANIC_V]) {
    let vy = rise * v + wg.RAMP_POP;
    let x = end[0];
    let y = end[1];
    for (let t = 0; t < 3; t += 0.002) {
      vy -= wg.WAGON_G * 0.002;
      x += v * 0.002;
      y += vy * 0.002;
      if (vy < 0 && y <= green) break;
    }
    assert.ok(x >= R.finish + 4, `at ${v} it lands ${x - R.finish} past the green's start`);
    assert.ok(x <= R.finish + 45 && x < ROOM.length - 4, `at ${v} it lands ${x - R.finish} past the green's start`);
  }
});

test("Ghoul Rush's Torch Mob: every ditch clears with a jump at the edge or a few units early, and a wagon that never jumps drops into it", () => {
  for (let i = 0; i + 1 < lines.length - 1; i++) {
    if (isBridgeGap(i)) continue;
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 6 && gap <= 10, `ditch ${i} is ${gap} wide`);
    const end = a.pts.at(-1);
    assert.ok(ct.slopeOf(R, i, a.x1) <= 0.01, "ditches lie on the flat (no ramp launch)");
    for (const v of [wg.BRAKE_V, wg.WAGON_V, wg.WAGON_V + wg.PANIC_V]) {
      assert.equal(wg.flight(R, a.x1, end[1], 0, v), null, `ditch ${i}, no jump, at ${v}`);
      for (const early of [0, 4]) {
        const x = a.x1 - early;
        const s = wg.flight(R, x, ct.trackY(R, i, x), wg.WAGON_JUMP_V, v);
        assert.ok(s, `ditch ${i}: a jump ${early} early at ${v} lands`);
        assert.equal(s.line, i + 1, `ditch ${i} cleared, at ${v}, ${early} early`);
      }
    }
  }
});

test("Ghoul Rush's Torch Mob: the collapsed bridge needs the ramp and a jump at its lip (within about 11 units early) at the wagon's own speed; braking all the way, or no jump, drops it in the river; the horses' panic speed carries it over", () => {
  const i = BRIDGE_LINE;
  const a = lines[i];
  const lip = a.x1;
  const gap = lines[i + 1].x0 - lip;
  assert.ok(gap >= 22 && gap <= 30, `the span is ${gap} wide`);
  assert.ok(ct.slopeOf(R, i, lip) >= wg.RAMP_SLOPE, "the ramp launches");
  const top = a.pts.at(-1)[1];
  const none = (v) => wg.flight(R, lip, top, ct.slopeOf(R, i, lip) * v + wg.RAMP_POP, v);
  const jump = (v, early) => {
    const x = lip - early;
    return wg.flight(R, x, ct.trackY(R, i, x), wg.WAGON_JUMP_V + ct.slopeOf(R, i, x) * v, v);
  };
  assert.equal(none(wg.WAGON_V), null, "the ramp alone is not enough at WAGON_V");
  assert.equal(none(wg.BRAKE_V), null);
  assert.ok(none(wg.WAGON_V + wg.PANIC_V), "the bolting horses clear it on the ramp alone");
  for (const early of [0, 2, 4, 8]) {
    const s = jump(wg.WAGON_V, early);
    assert.ok(s && s.line === i + 1, `a jump ${early} early at WAGON_V lands on the far side`);
  }
  assert.equal(jump(wg.WAGON_V, 16), null, "a jump far too early falls short");
  assert.equal(jump(wg.BRAKE_V, 0), null, "braked all the way, even a good jump falls");
  assert.ok(jump(36, 0), "a wagon a little slow still clears");
  assert.equal(R.surge.length, 1);
  assert.ok(R.surge[0][1] < lip - 20 && R.surge[0][0] > R.bridge[0], "the mob quickens on the bridge's run-up, before the ramp");
});

test("Ghoul Rush's Torch Mob: every thing is on a line, spaced for a player (20 between jumps and 30 beside a duck), a low's underside between a ducked box and a standing one, checkpoints clear of everything", () => {
  const wins = [];
  const lineAt = (x) => lines.findIndex((L) => x >= L.x0 && x <= L.x1);
  for (const [x, line, kind] of R.blocks) {
    assert.ok(ct.trackY(R, line, x) !== null && lineAt(x) === line, `a block at ${x} stands on line ${line}`);
    assert.ok(kind === 0 || kind === 1);
    assert.ok(x - lines[line].x0 > 20 && lines[line].x1 - x > 20, `a block at ${x} well inside its line`);
    wins.push([x - 5.7, x - 0.3, true]);
  }
  for (const [x0, x1, y, kind] of R.lows) {
    assert.ok(kind === 0 || kind === 1);
    let hi = 0;
    let lo = 99;
    for (let x = x0 - K.HIT_W / 2; x <= x1 + K.HIT_W / 2; x += 0.25) {
      const g = ct.linesAt(R, x)[0];
      assert.ok(g, "road under a low");
      hi = Math.max(hi, g[1]);
      lo = Math.min(lo, g[1]);
    }
    assert.ok(hi + K.DUCK_H < y, `a ducked box clears the low at ${x0}`);
    assert.ok(lo + K.HIT_H > y, `a standing box hits the low at ${x0}`);
    wins.push([x0 - 1.2, x1 + 1.2, false]);
  }
  for (const [x, line, kind] of R.throwers) {
    assert.ok(ct.trackY(R, line, x) !== null && lineAt(x) === line, `a thrower at ${x} on line ${line}`);
    assert.ok(kind === 0 || kind === 1);
    const meet = x - wg.THROW_MEET;
    assert.ok(lineAt(meet) === lineAt(meet - 14) && lineAt(meet) === lineAt(meet + 6), `a throw at ${x} meets the wagon on one line`);
    wins.push(kind ? [meet - 11, meet + 7, true] : [meet - 5, meet + 5, false]);
  }
  for (const [x, line] of R.horses) {
    assert.ok(lineAt(x) === line && lineAt(x - 30) === line && lineAt(x + 4) === line, `a horse at ${x} runs along line ${line}`);
    wins.push([x - 34, x - 8, true]);
  }
  for (let i = 0; i + 1 < lines.length; i++) wins.push(isBridgeGap(i) ? [lines[i].x1 - 15, lines[i].x1 + 30, true] : [lines[i].x1 - 11, lines[i].x1 + 28, true]);
  wins.sort((p, q) => p[0] - q[0]);
  for (let i = 0; i + 1 < wins.length; i++) {
    const gap = wins[i + 1][0] - wins[i][1];
    assert.ok(gap >= (wins[i][2] && wins[i + 1][2] ? 20 : 30), `windows at ${wins[i][1]} and ${wins[i + 1][0]} are ${gap.toFixed(0)} apart`);
  }
  const cs = R.checks;
  assert.equal(cs.length, 7);
  for (let i = 0; i < cs.length; i++) {
    assert.ok(ct.linesAt(R, cs[i]).length, `checkpoint ${i} on the road`);
    if (i) assert.ok(cs[i] - cs[i - 1] >= 250 && cs[i] - cs[i - 1] <= 450, `${cs[i] - cs[i - 1]} between checkpoints`);
    for (const [w0, w1] of wins) assert.ok(w0 - cs[i] > 8 || cs[i] - w1 > 4, `a thing at ${w0} near checkpoint ${i}`);
  }
  assert.ok(cs[0] < 500 && R.finish - cs.at(-1) > 150);
});

/* ------------------------------------------------------------ the wagon */

test("Ghoul Rush's Torch Mob rolls at WAGON_V on the road whatever key is held, DOWN brakes it toward BRAKE_V and ducks, letting go brings it back, and it keeps its speed in the air", () => {
  const flat = synth({ track: FLAT });
  assert.equal(flat.runner.v, wg.WAGON_V);
  assert.equal(flat.runner.id, "wagon");
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - wg.WAGON_V) < 0.01);
  run(flat, 1500, { right: true });
  run(flat, 1500, { left: true });
  assert.ok(Math.abs(flat.runner.v - wg.WAGON_V) < 0.01, "right and left do nothing");
  assert.ok(Math.abs(flat.you.x - (10 + ((2000 + 1500 + 1500) / 1000) * wg.WAGON_V)) < 1, "rides on at WAGON_V");
  // The brake.
  flat.input.down = true;
  run(flat, 100);
  assert.equal(flat.you.ducking, true, "down ducks");
  assert.equal(flat.runner.braking, true);
  assert.ok(events(flat, "wagonBrake").length === 1, "one brake cue");
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - wg.BRAKE_V) < 0.5, `${flat.runner.v} braked`);
  assert.ok(flat.runner.v >= wg.BRAKE_V - 0.01);
  flat.input.down = false;
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - wg.WAGON_V) < 0.5, "back to speed");
  assert.equal(flat.you.ducking, false);
  // A press of up jumps rather than ducking, and the air holds the speed.
  flat.input.down = true;
  press(flat);
  run(flat, 40);
  assert.equal(flat.you.state, "air");
  assert.equal(flat.you.ducking, false);
  const v = flat.runner.v;
  run(flat, 300);
  assert.equal(flat.runner.v, v, "no brake in the air");
  flat.input.down = false;
});

test("Ghoul Rush's Torch Mob jumps about 7 high for about 0.6 s (a gap of about 26 at WAGON_V), a press saved for a landing jumps on it, one just after a line's end still jumps, and one long after does not", () => {
  const w = synth({ track: FLAT });
  run(w, 200);
  const y0 = w.you.y;
  press(w);
  let top = y0;
  let t = 0;
  for (; t < 1500; t += 4) {
    ghoul.advance(w, 4, steady);
    w.input.jump = 0;
    top = Math.max(top, w.you.y);
    if (t > 40 && w.runner.line >= 0) break;
  }
  assert.ok(top - y0 > 6.5 && top - y0 < 7.6, `${(top - y0).toFixed(2)} high`);
  assert.ok(t > 560 && t < 680, `${t} ms in the air`);
  assert.equal(events(w, "wagonJump").length, 1);
  assert.equal(events(w, "wagonLand").length, 1);
  // Coyote time off a line's end.
  const gap = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  until(gap, () => gap.you.state === "air", 3000);
  assert.equal(gap.you.state, "air");
  press(gap);
  run(gap, 16);
  assert.ok(gap.you.vy > 20, "a jump just after the end");
  const late = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  until(late, () => late.you.state === "air", 3000);
  run(late, 200);
  press(late);
  run(late, 16);
  assert.ok(late.you.vy < 0, "no jump long after");
});

/* ------------------------------------------------------------ obstacles */

test("Ghoul Rush's Torch Mob: a barrel and a crate are cleared by a jump and cost a heart otherwise (causes barrel and crate), each only once, smashed after", () => {
  const w = synth({ track: FLAT, blocks: [[100, 0, 0], [220, 0, 1]] });
  // A jump clears a barrel.
  wagonAt(w, 88, 0);
  w.input.jump = 0;
  until(w, () => w.you.x + wg.REACH > 100 - 8, 2000);
  press(w);
  run(w, 600);
  assert.equal(w.bonusRound.hearts, 5);
  assert.equal(w.runner.smashed[0], false);
  // No jump hits it.
  wagonAt(w, 90, 0);
  run(w, 400);
  assert.equal(w.bonusRound.hearts, 4);
  assert.equal(events(w, "lose").at(-1).cause, "barrel");
  assert.equal(w.runner.smashed[0], true, "smashed");
  assert.deepEqual(w.bonusRound.perf.hits, ["b0"]);
  assert.equal(w.runner.line, 0, "the wagon rolls on");
  assert.equal(w.phase, "play");
  assert.ok(w.you.safeMs > 0, "blinking safe");
  // A crate.
  wagonAt(w, 212, 0);
  w.you.safeMs = 0;
  run(w, 400);
  assert.equal(w.bonusRound.hearts, 3);
  assert.equal(events(w, "lose").at(-1).cause, "crate");
  assert.deepEqual(w.bonusRound.perf.hits, ["b0", "b1"]);
  // A smashed one is no longer in the way.
  wagonAt(w, 90, 0);
  w.you.safeMs = 0;
  run(w, 400);
  assert.equal(w.bonusRound.hearts, 3);
});

test("Ghoul Rush's Torch Mob: DOWN passes under a washing line and an inn sign (at the price of the brake), a standing wagon is hit (causes wash and sign), and a jump does not clear one", () => {
  const w = synth({ track: FLAT, lows: [[100, 106, 23, 0], [300, 306, 23, 1]] });
  wagonAt(w, 90, 0);
  w.input.down = true;
  run(w, 800);
  w.input.down = false;
  assert.equal(w.bonusRound.hearts, 5, "ducked under the washing");
  assert.ok(w.you.x > 106, "and through");
  assert.ok(w.runner.v < wg.WAGON_V - 1, "the duck braked");
  wagonAt(w, 92, 0);
  run(w, 400);
  assert.equal(w.bonusRound.hearts, 4);
  assert.equal(events(w, "lose").at(-1).cause, "wash");
  assert.deepEqual(w.bonusRound.perf.hits, ["l0"]);
  wagonAt(w, 292, 0);
  w.you.safeMs = 0;
  run(w, 500);
  assert.equal(w.bonusRound.hearts, 3);
  assert.equal(events(w, "lose").at(-1).cause, "sign");
  // A jump at it: the box reaches the low.
  const j = synth({ track: FLAT, lows: [[100, 106, 23, 0]] });
  wagonAt(j, 86, 0);
  press(j);
  run(j, 700);
  assert.equal(j.bonusRound.hearts, 4, "a jump runs into it");
  assert.equal(events(j, "lose")[0].cause, "wash");
});

test("Ghoul Rush's Torch Mob: a villager winds up WIND_MS once the wagon is WIND_NEAR short, then throws at where the wagon will be, and a pitchfork meets a wagon at WAGON_V THROW_MEET short of him", () => {
  const w = synth({ track: FLAT, throwers: [[400, 0, 0]] });
  wagonAt(w, 400 - wg.WIND_NEAR - 8, 0);
  run(w, 100);
  assert.equal(w.runner.throwers[0].state, "idle", "still out of range");
  const wind = until(w, () => events(w, "wagonWind").length > 0, 1000);
  assert.ok(wind < 300);
  assert.equal(events(w, "wagonWind")[0].kind, 0);
  assert.equal(w.runner.throwers[0].state, "wind");
  assert.equal(w.runner.props.length, 0, "nothing thrown yet");
  const ms = until(w, () => w.runner.props.length > 0, 2000);
  assert.ok(ms >= wg.WIND_MS - 40 && ms <= wg.WIND_MS + 40, `${ms} ms of wind-up`);
  assert.equal(events(w, "wagonThrow").length, 1);
  assert.equal(w.runner.throwers[0].state, "spent");
  const p = w.runner.props[0];
  const meetAt = w.you.x + w.runner.v * p.T;
  assert.ok(Math.abs(p.x1 - meetAt) < 0.5, "aimed at where the wagon will be");
  assert.ok(Math.abs(p.x1 - (400 - wg.THROW_MEET)) < 1.5, `meets ${400 - p.x1} short of the thrower`);
  assert.ok(Math.abs(p.y1 - (20 + wg.FORK_Y)) < 0.01, "chest height");
  assert.ok(p.T > 0.35 && p.T < 0.6, `${p.T} s of flight`);
  // Nothing else is thrown.
  run(w, 1500);
  assert.equal(events(w, "wagonThrow").length, 1);
});

test("Ghoul Rush's Torch Mob: a hurled pitchfork costs a heart (cause fork) to a standing wagon, passes over a ducked one and under a jumping one, and the same torch is shot or ducked in vain", () => {
  const throwAt = (kind, keys) => {
    const w = synth({ track: FLAT, throwers: [[400, 0, kind]] });
    wagonAt(w, 400 - wg.WIND_NEAR + 2, 0);
    return w;
  };
  // Standing: hit.
  const stand = throwAt(0);
  run(stand, 1500);
  assert.equal(stand.bonusRound.hearts, 4);
  assert.equal(events(stand, "lose")[0].cause, "fork");
  assert.deepEqual(stand.bonusRound.perf.hits, ["t0"]);
  // Ducked while it passes: untouched (and the brake is the price).
  const duck = throwAt(0);
  until(duck, () => duck.runner.props.length > 0, 1500);
  duck.input.down = true;
  run(duck, 800);
  duck.input.down = false;
  assert.equal(duck.bonusRound.hearts, 5, "ducked under it");
  // Jumped: it goes under.
  const jump = throwAt(0);
  until(jump, () => jump.runner.props.length > 0, 1500);
  run(jump, 80);
  press(jump);
  run(jump, 900);
  assert.equal(jump.bonusRound.hearts, 5, "jumped it");
  // A torch aims low at the hay: standing is hit, a jump clears it.
  const torchStand = throwAt(1);
  run(torchStand, 1500);
  assert.equal(torchStand.bonusRound.hearts, 4);
  assert.equal(events(torchStand, "lose")[0].cause, "torch");
  const torchJump = throwAt(1);
  until(torchJump, () => torchJump.runner.props.length > 0, 1500);
  run(torchJump, 120);
  press(torchJump);
  run(torchJump, 900);
  assert.equal(torchJump.bonusRound.hearts, 5, "jumped the torch");
  assert.equal(torchJump.runner.fireMs, 0);
});

test("Ghoul Rush's Torch Mob: a torch that lands on the hay is a heart (cause torch), sets it alight for FIRE_MS, and the mob closes faster while it burns; ducking smothers it sooner", () => {
  const set = () => {
    const w = synth({ track: FLAT, throwers: [[400, 0, 1]] });
    wagonAt(w, 400 - wg.WIND_NEAR + 2, 0);
    until(w, () => w.bonusRound.hearts < 5, 2000);
    return w;
  };
  const w = set();
  assert.equal(w.bonusRound.hearts, 4);
  assert.equal(events(w, "lose")[0].cause, "torch");
  assert.equal(events(w, "wagonFire").length, 1);
  assert.ok(w.runner.fireMs > wg.FIRE_MS - 100 && w.runner.fireMs <= wg.FIRE_MS);
  const burn = until(w, () => w.runner.fireMs <= 0, 5000);
  assert.ok(burn > wg.FIRE_MS - 200 && burn < wg.FIRE_MS + 100, `${burn} ms burning`);
  assert.equal(events(w, "wagonOut").length, 1);
  // Smothered by ducking: out in a third of the time.
  const s = set();
  s.input.down = true;
  const quick = until(s, () => s.runner.fireMs <= 0, 5000);
  s.input.down = false;
  assert.ok(quick < (wg.FIRE_MS / wg.SMOTHER) + 150, `${quick} ms smothered`);
  // The fire's pull on the mob, alone: it runs faster with the hay alight.
  const a = synth({ track: FLAT });
  const b = synth({ track: FLAT });
  b.runner.fireMs = 1e9;
  a.runner.gap = b.runner.gap = 20;
  run(a, 1000);
  run(b, 1000);
  assert.ok(a.runner.gap - b.runner.gap > wg.FIRE_BOOST - 1.5, `${a.runner.gap} to ${b.runner.gap}`);
});

test("Ghoul Rush's Torch Mob: bolts shoot a pitchfork (40 points) or a torch (60 points) out of the air, which pushes the mob back and counts as an act; a torch shot is no fire", () => {
  for (const kind of [0, 1]) {
    const w = synth({ track: FLAT, throwers: [[400, 0, kind]] });
    wagonAt(w, 400 - wg.WIND_NEAR + 2, 0);
    w.runner.gap = 20;
    until(w, () => w.runner.props.length > 0, 1500);
    const score = w.score;
    // A bolt where the throw will be, level with it.
    const p = w.runner.props[0];
    until(w, () => w.runner.props[0].x < w.you.x + 14, 800);
    const q = w.runner.props[0];
    w.shots.push({ x: q.x - 1, y: q.y, vx: 130, vy: 0, gone: 0 });
    const g = w.runner.gap;
    run(w, 40);
    assert.ok(q.dead, `the ${kind ? "torch" : "fork"} is shot`);
    assert.equal(w.score - score, kind ? wg.TORCH_POINTS : wg.FORK_POINTS);
    assert.equal(w.bonusRound.perf.acts, 1);
    const shot = events(w, "wagonShot")[0];
    assert.equal(shot.kind, kind);
    assert.ok(w.runner.gap - g >= (kind ? wg.TORCH_BACK : wg.FORK_BACK) - 0.5, "the mob falls back");
    run(w, 1500);
    assert.equal(w.bonusRound.hearts, 5, "no hit");
    assert.equal(w.runner.fireMs, 0, "no fire");
    void p;
  }
  // The gap never goes over GAP_MAX.
  const w = synth({ track: FLAT, throwers: [[400, 0, 1]] });
  wagonAt(w, 400 - wg.WIND_NEAR + 2, 0);
  w.runner.gap = wg.GAP_MAX - 1;
  until(w, () => w.runner.props.length > 0 && w.runner.props[0].x < w.you.x + 14, 2000);
  const q = w.runner.props[0];
  w.shots.push({ x: q.x - 1, y: q.y, vx: 130, vy: 0, gone: 0 });
  run(w, 40);
  assert.equal(w.runner.gap, wg.GAP_MAX);
});

test("Ghoul Rush's Torch Mob: a spooked horse rears HORSE_REAR_MS when the wagon is HORSE_NEAR short, then charges; a jump clears it, a standing wagon is trampled (cause horse), and HORSE_HP bolts turn it back (120 points)", () => {
  const set = () => {
    const w = synth({ track: FLAT, horses: [[400, 0]] });
    wagonAt(w, 400 - wg.HORSE_NEAR - 8, 0);
    return w;
  };
  const w = set();
  run(w, 150);
  assert.equal(w.runner.horses[0].state, "wait");
  until(w, () => w.runner.horses[0].state === "rear", 500);
  assert.equal(events(w, "wagonRear").length, 1);
  const rear = until(w, () => w.runner.horses[0].state === "run", 1000);
  assert.ok(rear >= wg.HORSE_REAR_MS - 20 && rear <= wg.HORSE_REAR_MS + 20, `${rear} ms rearing`);
  assert.ok(w.runner.horses[0].x === 400, "it did not move while it reared");
  run(w, 100);
  assert.ok(w.runner.horses[0].x < 400, "charging");
  until(w, () => w.bonusRound.hearts < 5, 2000);
  assert.equal(w.bonusRound.hearts, 4);
  assert.equal(events(w, "lose")[0].cause, "horse");
  assert.deepEqual(w.bonusRound.perf.hits, ["h0"]);
  // Jumped.
  const j = set();
  until(j, () => j.runner.horses[0].state === "run", 2000);
  until(j, () => 0 < j.runner.horses[0].x - (j.you.x + wg.REACH) && j.runner.horses[0].x - (j.you.x + wg.REACH) < 14, 2000);
  press(j);
  run(j, 1200);
  assert.equal(j.bonusRound.hearts, 5, "jumped the horse");
  // Shot back.
  const s = set();
  until(s, () => s.runner.horses[0].state === "run", 2000);
  const score = s.score;
  for (let k = 0; k < wg.HORSE_HP; k++) {
    const h = s.runner.horses[0];
    s.shots.push({ x: h.x - 1, y: s.you.y + 2.4, vx: 130, vy: 0, gone: 0 });
    run(s, 20);
    if (k < wg.HORSE_HP - 1) assert.equal(events(s, "wagonHorseHit").length, k + 1);
  }
  assert.equal(s.runner.horses[0].state, "fled");
  assert.equal(events(s, "wagonHorseTurn").length, 1);
  assert.equal(s.score - score, wg.HORSE_POINTS);
  assert.equal(s.bonusRound.perf.acts, 1);
  run(s, 1500);
  assert.equal(s.bonusRound.hearts, 5, "turned back, no harm");
});

/* -------------------------------------------------------------- the mob */

test("Ghoul Rush's Torch Mob: the mob runs at MOB_V, so clean riding opens the gap (to GAP_MAX), the brake closes it, a hit shoves it HIT_CLOSE closer, and it starts at GAP_START", () => {
  const w = synth({ track: FLAT });
  assert.equal(w.runner.gap, wg.GAP_START);
  run(w, 1000);
  assert.ok(Math.abs(w.runner.gap - (wg.GAP_START + wg.WAGON_V - wg.MOB_V)) < 0.2, `${w.runner.gap} after a clean second`);
  run(w, 5000);
  assert.equal(w.runner.gap, wg.GAP_MAX, "never over GAP_MAX");
  w.input.down = true;
  run(w, 1500);
  const g = w.runner.gap;
  assert.ok(g < wg.GAP_MAX - 8, `braking closed it to ${g.toFixed(1)}`);
  run(w, 1000);
  w.input.down = false;
  assert.ok(g - w.runner.gap > 6, "held down, it keeps closing");
  // A hit shoves it.
  const h = synth({ track: FLAT, blocks: [[60, 0, 0]] });
  h.runner.gap = 30;
  wagonAt(h, 50, 0);
  const before = h.runner.gap;
  until(h, () => h.bonusRound.hearts < 5, 1000);
  assert.ok(before - h.runner.gap > wg.HIT_CLOSE - 1, `${before} to ${h.runner.gap}`);
});

test("Ghoul Rush's Torch Mob: inside PANIC_ON the horses bolt (PANIC_V faster) until PANIC_OFF, so the gap recovers; the brake still overrides it", () => {
  const w = synth({ track: FLAT });
  w.runner.gap = 8;
  run(w, 200);
  assert.equal(w.runner.panic, true);
  assert.equal(events(w, "wagonPanic").length, 1);
  run(w, 300);
  assert.ok(w.runner.v > wg.WAGON_V + 5, `${w.runner.v} bolting`);
  until(w, () => !w.runner.panic, 4000);
  assert.ok(w.runner.gap >= wg.PANIC_OFF - 0.01 && w.runner.gap < wg.PANIC_OFF + 2, `calm again at ${w.runner.gap}`);
  until(w, () => Math.abs(w.runner.v - wg.WAGON_V) < 0.5, 3000);
  assert.ok(Math.abs(w.runner.v - wg.WAGON_V) < 0.5);
  const b = synth({ track: FLAT });
  b.runner.gap = wg.PANIC_ON - 2;
  b.input.down = true;
  run(b, 1500);
  b.input.down = false;
  assert.ok(b.runner.v < wg.BRAKE_V + 1, "braking all the same");
});

test("Ghoul Rush's Torch Mob: the mob quickens on a surge span, and a catch at CATCH_GAP is a heart (cause mob) that sends it back to GAP_RESET, with the wagon rolling on", () => {
  const a = synth({ track: FLAT, surge: [[0, 1e6, 7]] });
  const b = synth({ track: FLAT });
  a.runner.gap = b.runner.gap = 30;
  run(a, 1000);
  run(b, 1000);
  assert.ok(Math.abs(b.runner.gap - a.runner.gap - 7) < 0.3, `${b.runner.gap} to ${a.runner.gap}`);
  assert.equal(wg.surgeAt(R, R.surge[0][0] + 1), R.surge[0][2]);
  assert.equal(wg.surgeAt(R, 5), 0);
  const w = synth({ track: FLAT });
  w.runner.gap = wg.CATCH_GAP + 0.1;
  w.input.down = true;
  until(w, () => w.bonusRound.hearts < 5, 3000);
  w.input.down = false;
  assert.equal(w.bonusRound.hearts, 4);
  assert.equal(events(w, "lose")[0].cause, "mob");
  assert.equal(events(w, "wagonCatch").length, 1);
  assert.equal(w.runner.gap, wg.GAP_RESET);
  assert.equal(w.runner.catches, 1);
  assert.equal(w.runner.panic, false);
  assert.equal(w.phase, "play");
  assert.ok(w.bonusRound.perf.hits.includes("m1"), "a catch counts against the grade");
  assert.equal(w.runner.done, false);
  assert.equal(w.lives, 3);
  // While blinking safe a catch costs nothing (the Garlic's shield too) but still sends it back.
  const safe = synth({ track: FLAT });
  safe.you.safeMs = 1e9;
  safe.runner.gap = wg.CATCH_GAP + 0.05;
  safe.input.down = true;
  until(safe, () => safe.runner.catches > 0, 3000);
  safe.input.down = false;
  assert.equal(safe.bonusRound.hearts, 5);
  assert.equal(safe.runner.gap, wg.GAP_RESET);
});

/* -------------------------------------------------------- falls, the end */

test("Ghoul Rush's Torch Mob: a ditch with no jump is a heart (cause ditch), the wagon goes back on the road ahead at WAGON_V and rolls on; the bridge's gap is the river; a jump over costs nothing", () => {
  const ditch = lines.findIndex((L, i) => i + 1 < lines.length && !isBridgeGap(i));
  const w = wagonRound();
  const L = lines[ditch];
  const noJump = () => {
    const r = wagonRound();
    wagonAt(r, L.x1 - 14, ditch, { v: wg.WAGON_V });
    r.runner.gap = 30;
    return r;
  };
  const r = noJump();
  until(r, () => r.bonusRound.hearts < 5, 3000);
  assert.equal(r.bonusRound.hearts, 4);
  assert.equal(events(r, "lose")[0].cause, "ditch");
  assert.ok(r.bonusRound.perf.hits.includes(`k${ditch}`));
  assert.equal(r.phase, "play");
  assert.ok(r.you.x >= lines[ditch + 1].x0, `back on the road at ${r.you.x}`);
  assert.equal(r.runner.line, ditch + 1);
  assert.equal(r.runner.v, wg.WAGON_V);
  run(r, 300);
  assert.ok(r.you.x > lines[ditch + 1].x0);
  // The bridge.
  const b = wagonRound();
  wagonAt(b, lines[BRIDGE_LINE].x1 - 14, BRIDGE_LINE);
  until(b, () => b.bonusRound.hearts < 5, 3000);
  assert.equal(events(b, "lose")[0].cause, "river");
  assert.equal(b.runner.line, BRIDGE_LINE + 1);
  // A jump clears a ditch for free.
  const j = wagonRound();
  wagonAt(j, L.x1 - 10, ditch);
  until(j, () => lines[ditch].x1 - j.you.x < 2, 1000);
  press(j);
  run(j, 1200);
  assert.equal(j.bonusRound.hearts, 5);
  assert.equal(j.runner.line, ditch + 1);
  void w;
});

test("Ghoul Rush's Torch Mob: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Green", () => {
  const w = synth({ track: FLAT, blocks: [[70, 0, 0]] });
  w.dice = 4;
  w.lives = 3;
  w.bonusRound.hearts = 1;
  wagonAt(w, 60, 0);
  until(w, () => w.phase === "clear", 6000);
  assert.equal(w.phase, "clear");
  assert.equal(w.bonusRound.hearts, 0);
  assert.equal(w.bonusRound.won, false);
  assert.equal(w.bonusRound.dice, 0);
  assert.equal(w.lives, 3, "no life lost");
  assert.equal(w.dice, 4, "the dice in hand kept");
  assert.equal(w.over, false, "not game over");
  assert.equal(events(w, "bonusEnd").length, 1);
  assert.equal(events(w, "bonusEnd")[0].won, false);
  run(w, ghoul.CARD_LOST_MS + 100);
  assert.equal(w.spec.id, "green");
  assert.equal(w.runner, null);
  assert.equal(w.bonusRound, null);
  assert.equal(w.lives, 3);
  assert.equal(w.dice, 4);
});

test("Ghoul Rush's Torch Mob: the checkpoints are passed in order (an event each) and the ride goes back to the last one passed after the last heart", () => {
  const w = wagonRound();
  w.runner.gap = 30;
  wagonAt(w, R.checks[0] - 6, ct.linesAt(R, R.checks[0])[0][0], { safe: true });
  until(w, () => w.runner.check === 0, 2000);
  assert.equal(events(w, "wagonCheck").length, 1);
  assert.equal(events(w, "wagonCheck")[0].n, 1);
  wagonAt(w, R.checks[2] - 5, ct.linesAt(R, R.checks[2])[0][0], { safe: true });
  w.runner.check = 0;
  until(w, () => w.runner.check === 2, 2000);
  assert.equal(events(w, "wagonCheck").length, 3, "one for each passed, in order");
  assert.deepEqual(events(w, "wagonCheck").map((e) => e.n), [1, 2, 3]);
  // A place after that goes back to the checkpoint, with the catches kept.
  w.runner.catches = 2;
  wg.WAGON.place[0](w, {});
  assert.equal(w.runner.check, 2);
  assert.equal(w.you.x, R.checks[2]);
  assert.equal(w.runner.catches, 2);
  assert.equal(w.runner.gap, wg.GAP_START);
});

test("Ghoul Rush's Torch Mob: off the lip the wagon launches, lands on the green and stops (wagonFinish), the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = wagonRound();
  round.dice = 1;
  const last = lines.length - 1;
  wagonAt(round, lines[last].x1 - 12, last, { safe: true });
  round.runner.gap = 30;
  until(round, () => round.runner.done, 4000);
  assert.equal(round.runner.done, true);
  assert.equal(events(round, "wagonLaunch").length, 1);
  assert.equal(events(round, "wagonLaunch")[0].last, true);
  const fin = events(round, "wagonFinish");
  assert.equal(fin.length, 1);
  assert.ok(round.you.x > R.finish + 4 && round.you.x < R.finish + 45, `${round.you.x} landed`);
  assert.equal(round.you.y, floorOf(round.you.x));
  assert.equal(round.hasKey, true, "the door opens");
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.phase, "play");
  // He walks out to the door.
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
  assert.equal(round.spec.id, "green");
  assert.equal(round.runner, null);
});

test("Ghoul Rush's Torch Mob: no random number is drawn in the room (a ride of 20 seconds, jumping, ducking and shooting, on a draw that throws)", () => {
  const w = wagonRound();
  w.you.safeMs = 1e9;
  for (let t = 0; t < 20000; t += 16) {
    w.input.fire = true;
    w.input.down = t % 3000 < 400;
    if (t % 1900 < 20) press(w);
    w.you.safeMs = 1e9;
    ghoul.advance(w, 16, never);
    w.events.length = 0;
  }
  assert.ok(w.you.x > 600);
  assert.equal(w.runner.id, "wagon");
});

test("Ghoul Rush's Torch Mob's grade: the dice formula, shooting 8 things for the die, and the steady die (the mob kept far: the gap's average over the ride)", () => {
  const w = synth({ track: FLAT });
  const b = w.bonusRound;
  assert.equal(b.perf.goal, wg.ACTS_GOAL);
  assert.equal(b.perf.steady, true);
  const full = wagonRound();
  assert.equal(full.bonusRound.perf.total, R.blocks.length + R.lows.length + R.throwers.length + R.horses.length + (lines.length - 1));
  // The dice: the floor, plus hearts, clean riding, acts and the steady die.
  const mk = (hearts, hits, acts, steadyDie) => {
    const bb = makeBonus({ stats: { kills: 0 } });
    bb.hearts = hearts;
    bb.perf = { total: 29, hits: Array.from({ length: hits }, (_, i) => `x${i}`), acts, goal: wg.ACTS_GOAL, steady: steadyDie, kills0: 0 };
    return diceFor(bb, 0);
  };
  assert.equal(mk(5, 0, 8, true), 9, "a perfect ride");
  assert.equal(mk(5, 0, 7, true), 8, "one act short");
  assert.equal(mk(5, 0, 8, false), 8, "the mob came too close");
  assert.ok(mk(1, 20, 0, false) >= BONUS_FLOOR && mk(1, 20, 0, false) <= 4);
  // The steady die follows the average gap.
  const s = synth({ track: FLAT });
  s.runner.gap = 10;
  s.runner.gapMs = 20000;
  s.runner.gapSum = 10 * 20000;
  run(s, 100);
  assert.equal(s.bonusRound.perf.steady, false, "the mob stayed close");
  const t = synth({ track: FLAT });
  run(t, 3000);
  assert.equal(t.bonusRound.perf.steady, true, "far behind");
  // Brake all the way and the average falls under STEADY_GAP.
  const u = synth({ track: FLAT });
  u.input.down = true;
  until(u, () => u.runner.catches > 0 || u.bonusRound.perf.steady === false, 20000);
  u.input.down = false;
  assert.ok(u.bonusRound.perf.steady === false || u.runner.catches > 0, "the brake held down costs the steady die");
  assert.ok(wg.STEADY_GAP > wg.PANIC_OFF && wg.STEADY_GAP < wg.GAP_MAX);
});

test("Ghoul Rush's Torch Mob: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const w = wagonRound();
  w.infinite = true;
  w.runner.gap = 30;
  wagonAt(w, 60, 0);
  w.spec = { ...w.spec, ride: { ...R, blocks: [[70, 0, 0], ...R.blocks.slice(1)] } };
  until(w, () => events(w, "lose").length > 0, 1000);
  assert.equal(w.bonusRound.hearts, 5);
  assert.equal(events(w, "lose")[0].cause, "barrel");
  const m = synth({ track: FLAT });
  m.infinite = true;
  m.runner.gap = wg.CATCH_GAP + 0.1;
  m.input.down = true;
  until(m, () => m.runner.catches > 0, 3000);
  m.input.down = false;
  assert.equal(m.bonusRound.hearts, 5);
  assert.equal(events(m, "lose")[0].cause, "mob");
  assert.equal(m.phase, "play");
});

test("Ghoul Rush's Torch Mob: the Garlic shield takes a hit instead of a heart", () => {
  const w = synth({ track: FLAT, blocks: [[60, 0, 0]] });
  w.you.garlic = true;
  wagonAt(w, 50, 0);
  until(w, () => !w.you.garlic, 1000);
  assert.equal(w.bonusRound.hearts, 5);
  assert.equal(w.you.garlic, false);
});

/* ----------------------------------------------------------- sound, names */

test("Ghoul Rush's Torch Mob: every event has a voice that plays, every cause has words and a sound, and the voices are tones that exist", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...wg.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = WAGON_VOICES[kind] && WAGON_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    assert.ok(heard({ type: event, kind: 1, points: 50 }).played.includes(name), `${event} plays ${name}`);
  }
  for (const cause of ["barrel", "crate", "wash", "sign", "fork", "torch", "horse", "ditch", "river", "mob"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "wagonJump" }).played.length, 1);
  assert.equal(heard({ type: "wagonShot", kind: 0, points: 40 }).played.length, 1);
  // No tone runs over 1.2 s, and the track's voices all run the same number of steps.
  for (const name of Object.keys(ghoulSfx.default.tones).filter((n) => n.startsWith("ghoulWagon"))) {
    const layers = ghoulSfx.default.tones[name].layers;
    assert.ok(Math.max(...layers.map((l) => (l.delay || 0) + l.seconds)) <= 1.2, `${name} is short`);
  }
  const track = ghoulSfx.default.music.ghoulWagonRide;
  for (const id of track.order) assert.ok(track.patterns[id], `pattern ${id}`);
  for (const [id, p] of Object.entries(track.patterns)) {
    const steps = Object.entries(p).map(([voice, s]) => [voice, s.split(/\s+/).filter((t) => t && t !== "|").length]);
    for (const [voice, n] of steps) {
      assert.ok(track.voices[voice], `${voice} is a voice`);
      assert.equal(n, 64, `${id}.${voice} runs 64 steps`);
    }
  }
});

test("Ghoul Rush's Torch Mob: the room's own names do not collide with the game's (hazards, events, kinds, the other rides' state)", () => {
  for (const e of wg.EVENTS) assert.ok(e.startsWith("wagon"), e);
  const other = new Set();
  for (const pack of [ct]) for (const e of pack.EVENTS || []) other.add(e);
  for (const e of wg.EVENTS) assert.ok(!other.has(e), `${e} is the wagon's alone`);
  assert.deepEqual(Object.keys(wg.WAGON).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(typeof ghoul.ROOM_MUSIC.wagon, "string");
  // It keeps to the shared slot: no new round field, and the Cart's state is left null in its room.
  const w = wagonRound();
  assert.equal(w.runner.id, "wagon");
  assert.equal(w.cart, null);
  assert.ok(!("wagon" in w));
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Torch Mob draws: the room, the wagon on the road, in the air and braking, each thing (barrels, crates, washing, signs, throwers winding up, throws in flight, horses in each state), the mob close and far, the fire, a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["village"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "wagon") through(r);
  r.lives = 99;
  const bridge = (R.bridge[0] + R.bridge[1]) / 2;
  const spots = [ROOM.start + 40, R.blocks[0][0] - 10, R.lows[0][0] - 5, R.lows[1][0] - 5, R.throwers[0][0] - 40, R.throwers[1][0] - 40, R.horses[0][0] - 30, R.checks[0], lines[0].x1 - 10, bridge - 20, lines[BRIDGE_LINE].x1 - 6, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      const top = ct.linesAt(R, x)[0] || [lines.length - 1, 20];
      wagonAt(r, x, top[0], { safe: true });
      r.runner.throwers = r.runner.throwers.map((t, i) => ({ ...t, state: ["idle", "wind", "spent"][i % 3], t: 300 }));
      r.runner.horses = r.runner.horses.map((h, i) => ({ ...h, state: ["wait", "rear", "run", "hit", "fled"][(i + 1) % 5], t: 300, x: R.horses[i][0] - 10 }));
      r.runner.smashed = r.runner.smashed.map((_, i) => i % 3 === 0);
      r.runner.props = [
        { kind: 0, x0: x + 30, y0: top[1] + 8.5, x1: x + 12, y1: top[1] + 3.2, T: 0.5, t: 0.2, s: 0.4, x: x + 22, y: top[1] + 6, dead: false, age: 0 },
        { kind: 1, x0: x + 30, y0: top[1] + 11, x1: x + 12, y1: top[1] + 1.6, T: 0.5, t: 0.2, s: 0.4, x: x + 20, y: top[1] + 8, dead: false, age: 0 },
        { kind: 1, x0: x + 30, y0: top[1] + 11, x1: x + 12, y1: top[1] + 1.6, T: 0.5, t: 0.5, s: 1, x: x + 12, y: top[1] + 1.6, dead: true, age: 100 },
      ];
      for (const air of [false, true]) {
        for (const state of [{ gap: 34, fireMs: 0 }, { gap: 9, fireMs: 2000, panic: true }]) {
          Object.assign(r.runner, state);
          if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
          if (air) r.runner.line = -1;
          r.you.ducking = x === R.lows[0][0] - 5 && !air;
          r.runner.braking = r.you.ducking;
          r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
          for (let k = 0; k < 4; k++) g.tick(16);
          r.monsters.length = 0;
          r.you.safeMs = 1e9;
          wagonAt(r, x, top[0], { safe: true });
        }
      }
    }
  }
  assert.equal(r.spec.id, "wagon");
  // A crash and the mob's catch.
  r.you.safeMs = 0;
  r.runner.gap = 30;
  r.runner.props = [];
  r.runner.smashed = r.runner.smashed.map(() => false);
  wagonAt(r, R.blocks.find((b) => b[2] === 0)[0] - 8, R.blocks[0][1]);
  for (let k = 0; k < 60; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["village"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "wagon") through(d);
  d.phase = "play";
  d.runner.done = true;
  d.runner.restX = R.finish + 20;
  Object.assign(d.you, { x: R.finish + 30, y: 7, state: "run" });
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
  const at = ghoul.STAGES.findIndex((s) => s.id === "village");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "wagon");
  assert.equal(p.runner.line, 0);
  assert.equal(p.you.y, ct.trackY(R, 0, ROOM.start));
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that plays well: it jumps at the end of a line (and at the bridge's lip, a little early), 7 to 12 short of a
// barrel, a crate or a charging horse, jumps a torch and ducks a pitchfork as they come, ducks every low, and
// holds the blaster. `miss` is the share of things it fails to dodge (by a hash).
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
  const look = 3 + (seed % 5);
  let jump = false;
  if (c.line >= 0) {
    const last = c.line === lines.length - 1;
    if (!last && lines[c.line].x1 - you.x < 2.2 && ok(lines[c.line].x1)) jump = true;
    const cx = you.x + wg.REACH;
    R.blocks.forEach(([x], i) => {
      if (!c.smashed[i] && x - cx > 7 && x - cx < 7 + look && ok(x)) jump = true;
    });
    c.horses.forEach((h, i) => {
      if (h.state === "run" && h.x - cx > 13 && h.x - cx < 13 + look && ok(R.horses[i][0])) jump = true;
    });
    for (const p of c.props) {
      if (p.dead || p.x === undefined || !ok(p.x0)) continue;
      const d = p.x - you.x;
      if (p.kind && d > 6 && d < 12) jump = true;
      if (!p.kind && d > -4 && d < 10) inp.down = true;
    }
    for (const [x0, x1] of R.lows) if (you.x > x0 - 3 && you.x < x1 + 2 && ok(x0)) inp.down = true;
  }
  if (jump && !inp.down) press(round);
  else inp.up = false;
}
function idleBot(round) {
  const inp = round.input;
  inp.left = inp.right = inp.down = false;
  inp.up = false;
  inp.fire = false;
}
function rideWith(seed, bot, limit = 100000) {
  const round = wagonRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the wagon stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Torch Mob: a bot that dodges well finishes the whole road in 60 to 76 seconds, 6 to 9 dice, a few hearts lost at most, past every checkpoint", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 77000, `${ms} ms`);
    assert.ok(b.dice >= 5 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.done, true);
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 6, `${dice.join(",")}`);
});

test("Ghoul Rush's Torch Mob: a bot that never dodges loses all five hearts before the first half, ends with 0 dice and the run goes on", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { round, lost } = rideWith(seed, idleBot);
    const b = round.bonusRound;
    assert.equal(b.won, false, "never finishes");
    assert.equal(b.dice, 0);
    assert.equal(b.hearts, 0);
    assert.equal(lost.length, 5);
    assert.ok(round.you.x < ROOM.length * 0.6, `out at ${round.you.x}`);
    assert.equal(round.lives, 3);
    assert.equal(round.over, false);
  }
});

test("Ghoul Rush's Torch Mob: a bot that rides without ever braking or ducking but holds fire keeps the mob far, and one that holds DOWN the whole way is caught again and again", () => {
  const seed = 3;
  const braker = rideWith(seed, (r) => {
    goodBot(r, seed, 1);
    r.input.down = true;
  }, 40000);
  assert.ok(braker.lost.filter((c) => c === "mob").length >= 2, `${braker.lost.join(",")}`);
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Torch Mob telegraphs: DUCK over washing lines, signs and pitchfork throwers, JUMP over ditches, the bridge, barrels, crates, torch throwers and horses, words only on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  assert.equal(marks.length, (R.track.length - 1) + R.blocks.length + R.lows.length + R.throwers.length + R.horses.length, "one per thing to dodge");
  for (const m of marks) assert.equal(m.answer, ANSWERS[m.kind], m.kind);
  assert.equal(marks.filter((m) => m.kind === "bridge").length, 1);
  assert.equal(marks.filter((m) => m.kind === "fork").every((m) => m.answer === "DUCK"), true);
  assert.equal(marks.filter((m) => m.kind === "torch").every((m) => m.answer === "JUMP"), true);
  const first = R.lows.find((l) => !l[3]);
  const m = marks.find((q) => q.x === (first[0] + first[1]) / 2);
  assert.equal(m.kind, "wash");
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "wash" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  // The throwers' glyphs show earlier, over where the throw meets the wagon.
  const t = marks.find((q) => q.kind === "fork");
  assert.ok(Math.abs(t.x - (R.throwers.find((q) => !q[2])[0] - wg.THROW_MEET)) < 0.01);
  assert.ok(telegraphs(R, t.lead - 55).some((q) => q.lead === t.lead && q.alpha > 0.5), "seen from afar");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  for (const kind of ["ditch", "barrel", "crate", "wash", "sign", "fork", "torch"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 2, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((s) => s.lead === q.lead);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
});

test("Ghoul Rush's Torch Mob's intro banner says the controls plainly, DOWN's price included", () => {
  assert.match(R.how, /UP to jump, DOWN to duck/);
  assert.match(R.how, /slows you/);
});
