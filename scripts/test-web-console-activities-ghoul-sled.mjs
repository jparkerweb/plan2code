// Web console tests, Ghoul Rush's Coffin Sled (the Frozen Lake's bonus round, between the Black Ice and the Widow's Web): its shape (every crack clears with a jump and swallows a sled that does not jump, every low can be ducked, spacing, checkpoints, the clock), the sled's speed on slopes, its jump, ducking, a headstone, a drift, a branch, a hand in the snow, the ghoul that pops up and the icicles (bolts that follow the hill), a fall into a crack, the checkpoint, the jump off the end and the door, the bonus round's hearts and dice (3 to 9), endless lives for every new cause, a voice for every event, the drawing, and bots that ride the whole hill (one that dodges well, one that never does).
// Run with: node --test scripts/test-web-console-activities-ghoul-sled.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as sl from "../src/web-console/public/activities/ghoul-rush/rides/sled/ghoul-sled.js";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as SLED_LOOKS, VOICES as SLED_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/sled/ghoul-sled-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the sled drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Coffin Sled reached the way play reaches it, nothing woken, the clocks long,
// the bonus round on (five hearts).
function sledRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["frozen"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "sled") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { sled: true, time: 1e9, finish: 1e6, track: [], stones: [], drifts: [], lows: [], hands: [], icicles: [], pops: [], checks: [] };
// The same round over a ride of its own (a plain track to measure the sled on).
function synth(ride) {
  const round = sledRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, ...ride } };
  sl.SLED.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [4000, 20]]];
const DOWN = [[[0, 40], [4000, 40 - 0.15 * 4000]]];
const UP = [[[0, 0], [4000, 0.3 * 4000]]];

// The sled on line `line` of the ride at `x`, at speed `v`.
function sledAt(round, x, line, { v = sl.SLED_V, safe = false } = {}) {
  const y = ct.trackY(round.spec.ride, line, x);
  assert.ok(y !== null, `line ${line} runs under ${x}`);
  Object.assign(round.you, { x, y, vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
  Object.assign(round.sled, { line, v, coyote: 0 });
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

const ROOM = ghoul.roomById("sled");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const slopeAtLine = (L, i) => (L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0]);

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Coffin Sled is the Frozen Lake's fourth room, between the Black Ice and the Widow's Web: lit, no key, no boss, a ride about 60 to 70 seconds long, a bonus round that plays its own picked track", () => {
  const st = ghoul.stageById("frozen");
  assert.deepEqual(st.rooms, ["huts", "lodge", "blackice", "sled", "widow"]);
  assert.equal(st.boss, "frostwidow");
  assert.equal(ghoul.STAGES.at(-2), st, "the last stage in the list but Gallows Bog");
  assert.deepEqual([ROOM.title, ROOM.sub], ["Coffin Sled", "Hold on. The hill is longer than it looks"]);
  assert.equal(ROOM.dark, false, "a moonlit night, always lit");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.sled, true);
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3000, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.sled, "ghoulSledRide");
  assert.ok(ghoulSfx.default.music.ghoulSledRide, "its own picked track");
  assert.deepEqual(Object.keys(sl.SLED.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.sled, SLED_LOOKS.sled);
  assert.equal(LOOKS.sled.pack, "sled");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0, "no monsters: the things on the hill are the pack's own");
  // The ground is the hilltop at the start and the snowbank at the end only.
  assert.equal(ROOM.ground.length, 2);
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 100, "floor only at the ends");
  assert.equal(ROOM.ground[1][0], R.finish);
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14, "the door at the room's end, past the snowbank's start");
  assert.ok(floorOf(ROOM.door - 2) > -Infinity, "floor to walk out on");
  // Lines run left to right, their points rising in x; the first starts under the sled.
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the sled starts on the ice over the hilltop");
  // The ride, at the sled's speed, takes 60 to 70 seconds.
  const secs = (lines.at(-1).x1 - ROOM.start) / sl.SLED_V;
  assert.ok(secs >= 58 && secs <= 72, `${secs.toFixed(1)} s at SLED_V`);
  // The hill: descents that fall about 0.11 to 0.13 and short climbs at about 0.3, never steeper.
  let down = 0;
  let total = 0;
  for (const L of lines) {
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const s = slopeAtLine(L, i);
      const len = L.pts[i + 1][0] - L.pts[i][0];
      assert.ok(s >= -0.2 && s <= 0.32, `a slope of ${s.toFixed(3)}`);
      total += len;
      if (s < 0) down += len;
    }
  }
  assert.ok(down / total > 0.6, `${((100 * down) / total).toFixed(0)}% of the hill goes down`);
  // The camera has room: the ice stays between the floor and the roof, with a clear head over it.
  for (const L of lines) for (const [, y] of L.pts) assert.ok(y > sl.DERAIL_Y + 5 && y < 40, `an ice height of ${y}`);
  // The clock covers the ride comfortably (and respawns refill it).
  assert.equal(ghoul.timeFor(ghoul.roomFor("sled")), R.time);
  assert.ok(R.time >= 1.5 * secs * 1000, `a ${R.time} ms clock for a ${secs.toFixed(0)} s ride`);
  // The lip ends the hill rising, so it launches by itself, over a gap the launch alone clears.
  const lip = lines.at(-1);
  assert.ok(ct.slopeOf(R, lines.length - 1, lip.x1) >= sl.RAMP_SLOPE, "the lip launches");
  const gone = sl.flight(R, lip.x1, lip.pts.at(-1)[1], ct.slopeOf(R, lines.length - 1, lip.x1) * 38 + sl.RAMP_POP, 38);
  assert.equal(gone, null, "(the unit's own landing check sees only the ice; the bank is the ground)");
});

test("Ghoul Rush's Coffin Sled: the lip's launch alone carries the sled onto the snowbank at any speed it can have there, landing 10 to 40 past its start", () => {
  const lip = lines.at(-1);
  const end = lip.pts.at(-1);
  const rise = ct.slopeOf(R, lines.length - 1, lip.x1);
  const bank = floorOf(R.finish + 1);
  for (const v of [sl.SLED_MIN, 34, sl.SLED_V, 55, sl.SLED_MAX]) {
    let vy = rise * v + sl.RAMP_POP;
    let x = end[0];
    let y = end[1];
    for (let t = 0; t < 3; t += 0.002) {
      vy -= sl.SLED_G * 0.002;
      x += v * 0.002;
      y += vy * 0.002;
      if (vy < 0 && y <= bank) break;
    }
    assert.ok(x >= R.finish + 2, `at ${v} it lands ${x - R.finish} past the bank's start`);
    assert.ok(x <= R.finish + 40, `at ${v} it lands ${x - R.finish} past the bank's start`);
  }
});

test("Ghoul Rush's Coffin Sled: every crack clears with a jump at the edge or a few units early, and a sled that never jumps drops into it", () => {
  assert.equal(lines.length - 1, 7, "seven cracks");
  for (let i = 0; i + 1 < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 9 && gap <= 18, `crack ${i} is ${gap} wide`);
    const end = a.pts.at(-1);
    const slope = ct.slopeOf(R, i, a.x1);
    assert.ok(slope < 0, "cracks lie on descents (no ramp launch)");
    for (const v of [40, 45, 50, 55]) {
      assert.equal(sl.flight(R, a.x1, end[1], slope * v, v), null, `crack ${i}, no jump, at ${v}`);
      for (const early of [0, 4]) {
        const x = a.x1 - early;
        const y = ct.trackY(R, i, x);
        const s = sl.flight(R, x, y, sl.SLED_JUMP_V + ct.slopeOf(R, i, x) * v, v);
        assert.ok(s, `crack ${i}: a jump ${early} early at ${v} lands`);
        assert.equal(s.line, i + 1, `crack ${i} cleared, at ${v}, ${early} early`);
      }
    }
  }
});

test("Ghoul Rush's Coffin Sled: every thing is on a line, off the ends, spaced for a player (22 between jumps and 38 between a jump and a duck), a low's underside between a ducked box and a standing one", () => {
  const jumps = [];
  for (const [x, line] of [...R.stones, ...R.drifts, ...R.hands]) {
    assert.ok(ct.trackY(R, line, x) !== null, `a thing at ${x} stands on line ${line}`);
    jumps.push([x - 2, x + 2]);
  }
  for (let i = 0; i + 1 < lines.length; i++) jumps.push([lines[i].x1, lines[i + 1].x0]);
  const ducks = R.lows.map(([x0, x1]) => [x0, x1]);
  // Away from the ends of a line (a thing right at a crack would be a jump into a jump).
  for (const [x, line] of [...R.stones, ...R.drifts, ...R.hands, ...R.icicles, ...R.pops]) {
    assert.ok(x - lines[line].x0 > 8 && lines[line].x1 - x > 14, `a thing at ${x} well inside its line`);
  }
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
      assert.ok(g, "ice under a low");
      hi = Math.max(hi, g[1]);
      lo = Math.min(lo, g[1]);
    }
    assert.ok(hi + k().DUCK_H < y, `a ducked box clears the low at ${x0}`);
    assert.ok(lo + k().HIT_H > y, `a standing box hits the low at ${x0}`);
    for (const [j0, j1] of ducks) if (j0 !== x0) assert.ok(j0 - x1 > 20 || x0 - j1 > 20);
  }
  assert.deepEqual([R.stones.length, R.drifts.length, R.lows.length, R.hands.length], [7, 5, 8, 6]);
  assert.ok(R.icicles.length >= 12 && R.pops.length >= 8, "plenty to shoot");
  // Checkpoints every 300 to 400 units, each on the ice and clear of a thing.
  const cs = R.checks;
  for (let i = 0; i < cs.length; i++) {
    assert.ok(ct.linesAt(R, cs[i]).length, `checkpoint ${i} on the ice`);
    if (i) assert.ok(cs[i] - cs[i - 1] >= 300 && cs[i] - cs[i - 1] <= 400, `${cs[i] - cs[i - 1]} between checkpoints`);
    for (const [j0, j1] of jumps) assert.ok(j0 - cs[i] > 20 || cs[i] - j1 > 4, `a thing at ${j0} near checkpoint ${i}`);
  }
  assert.ok(cs[0] < 450 && R.finish - cs.at(-1) > 300);
});

// The kit's numbers the room is built to (a getter, so the file can read it where needed).
function k() {
  return { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };
}

/* ------------------------------------------------------------ the sled */

test("Ghoul Rush's Coffin Sled rolls at SLED_V on the flat, faster down a slope and slower up one, never past SLED_MIN or SLED_MAX, and no key changes it", () => {
  const flat = synth({ track: FLAT });
  assert.equal(flat.sled.v, sl.SLED_V);
  run(flat, 2000);
  assert.ok(Math.abs(flat.sled.v - sl.SLED_V) < 0.01);
  run(flat, 1500, { right: true });
  run(flat, 1500, { left: true });
  assert.ok(Math.abs(flat.sled.v - sl.SLED_V) < 0.01, "right and left do nothing");
  assert.ok(Math.abs(flat.you.x - (10 + (2000 + 1500 + 1500) / 1000 * sl.SLED_V)) < 1, "rides on at SLED_V");
  const down = synth({ track: DOWN });
  run(down, 3000);
  assert.ok(Math.abs(down.sled.v - (sl.SLED_V + (sl.SLOPE_G * 0.15) / sl.RELAX)) < 0.2, `${down.sled.v} down a 0.15 slope`);
  assert.ok(down.sled.v <= sl.SLED_MAX);
  const up = synth({ track: UP });
  run(up, 3000);
  assert.ok(Math.abs(up.sled.v - (sl.SLED_V - (sl.SLOPE_G * 0.3) / sl.RELAX)) < 0.2, `${up.sled.v} up a 0.3 slope`);
  assert.ok(up.sled.v >= sl.SLED_MIN);
  const steep = synth({ track: [[[0, 10000], [4000, 6000]]] });
  run(steep, 3000);
  assert.equal(steep.sled.v, sl.SLED_MAX);
  const wall = synth({ track: [[[0, 0], [4000, 4000]]] });
  run(wall, 3000);
  assert.equal(wall.sled.v, sl.SLED_MIN);
  // Planny rides facing right, on the ice, never walking.
  assert.equal(flat.you.face, 1);
  assert.equal(flat.you.state, "run");
  assert.equal(flat.you.y, 20);
});

test("Ghoul Rush's Coffin Sled jumps about 13 high for about three quarters of a second (a crack of about 34 at SLED_V), a press saved for a landing jumps on it, one just after a line's end still jumps", () => {
  const round = synth({ track: FLAT });
  let top = 0;
  press(round);
  const t = until(round, () => {
    top = Math.max(top, round.you.y - 20);
    return round.you.state === "run" && round.you.y === 20 && round.you.vy === 0 && top > 1;
  }, 3000);
  assert.ok(Math.abs(top - (sl.SLED_JUMP_V * sl.SLED_JUMP_V) / (2 * sl.SLED_G)) < 0.4, `${top.toFixed(1)} high`);
  assert.ok(t > 650 && t < 850, `${t} ms in the air`);
  assert.equal(events(round, "sledJump").length, 1);
  assert.equal(events(round, "sledLand").length, 1);
  const across = round.you.x - 10;
  assert.ok(across > 31 && across < 37, `${across.toFixed(1)} across`);
  // A press in the air waits for the landing.
  const buf = synth({ track: FLAT });
  press(buf);
  run(buf, 640);
  press(buf);
  until(buf, () => events(buf, "sledJump").length >= 2, 1500);
  assert.equal(events(buf, "sledJump").length, 2, "the saved press jumped again at the landing");
  // Off the end of a line, a press within COYOTE_MS still jumps.
  const edge = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  sledAt(edge, 58.5, 0);
  run(edge, 80);
  assert.equal(edge.sled.line, -1, "off the end");
  press(edge);
  run(edge, 4);
  assert.equal(events(edge, "sledJump").length, 1, "coyote");
  // Too late and it is a fall.
  const late = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  sledAt(late, 58.5, 0);
  run(late, 80 + sl.COYOTE_MS);
  press(late);
  run(late, 4);
  assert.equal(events(late, "sledJump").length, 0);
});

test("Ghoul Rush's Coffin Sled: down ducks (and a press of up jumps instead of ducking), a ducked Planny passes under a low and a standing one hits it (cause branch), at the cost of a heart", () => {
  const round = synth({ track: FLAT, lows: [[60, 66, 23.0, 0]] });
  const you = round.you;
  assert.equal(you.ducking, false);
  run(round, 20, { down: true });
  assert.equal(events(round, "sledDuck").length, 1);
  // Held down through the low: nothing is lost.
  round.input.down = true;
  until(round, () => you.x > 75, 3000);
  round.input.down = false;
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.lives, 3);
  // Standing, it hits: a heart, the sled rolls on, Planny blinks safe.
  const hit = synth({ track: FLAT, lows: [[60, 66, 23.0, 0]] });
  until(hit, () => hit.bonusRound.hearts < 5, 3000);
  assert.equal(hit.bonusRound.hearts, 4);
  assert.equal(hit.lives, 3, "not a life");
  assert.equal(events(hit, "lose")[0].cause, "branch");
  assert.equal(events(hit, "sledCrash")[0].what, "low");
  assert.equal(hit.phase, "play", "the ride plays on");
  assert.ok(hit.you.safeMs > 0, "blinking safe");
  assert.deepEqual(hit.bonusRound.perf.hits, ["l0"]);
  run(hit, 1000);
  assert.equal(hit.bonusRound.hearts, 4, "the same branch costs nothing twice");
  // Jumping into it hits too (a lintel to the roof).
  const jump = synth({ track: FLAT, lows: [[60, 66, 23.0, 0]] });
  sledAt(jump, 40, 0);
  press(jump);
  until(jump, () => jump.bonusRound.hearts < 5 || jump.you.x > 80, 3000);
  assert.equal(jump.bonusRound.hearts, 4, "a jump does not clear a low");
  // Up beats down: a press jumps even with down held.
  const both = synth({ track: FLAT });
  both.input.down = true;
  press(both);
  run(both, 20);
  assert.equal(both.you.ducking, false);
  assert.equal(events(both, "sledJump").length, 1);
});

test("Ghoul Rush's Coffin Sled: a headstone and a snowdrift are cleared by a jump and cost a heart otherwise (causes tomb and drift), each only once", () => {
  for (const [key, cause, what, jumpAt] of [["stones", "tomb", "stone", 50], ["drifts", "drift", "drift", 48]]) {
    const hit = synth({ track: FLAT, [key]: [[60, 0]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4, `${cause} costs a heart`);
    assert.equal(events(hit, "lose")[0].cause, cause);
    assert.equal(events(hit, "sledCrash")[0].what, what);
    assert.equal(hit.lives, 3);
    assert.deepEqual(hit.bonusRound.perf.hits, [key === "stones" ? "s0" : "d0"]);
    run(hit, 500);
    assert.equal(hit.bonusRound.hearts, 4);
    // Jumped from anywhere from 8 to 27 short of it, it is cleared.
    for (const from of [jumpAt + 4, 60 - 26, 60 - 14, 60 - 9]) {
      const clear = synth({ track: FLAT, [key]: [[60, 0]] });
      sledAt(clear, from, 0);
      press(clear);
      until(clear, () => clear.you.x > 80, 3000);
      assert.equal(clear.bonusRound.hearts, 5, `${cause} jumped from ${from}`);
    }
  }
});

test("Ghoul Rush's Coffin Sled: a hand in the snow stirs when the sled is HAND_NEAR short, shivers, reaches up for HAND_UP_MS, grabs (cause grasp) if you meet it, and sinks; a jump clears it", () => {
  const hit = synth({ track: FLAT, hands: [[200, 0]] });
  sledAt(hit, 150, 0);
  assert.equal(hit.sled.hands[0].state, "snow");
  run(hit, 100);
  assert.equal(hit.sled.hands[0].state, "snow", "far off: asleep");
  until(hit, () => hit.sled.hands[0].state === "warn", 2000);
  assert.ok(200 - hit.you.x <= sl.HAND_NEAR + 0.5 && 200 - hit.you.x > sl.HAND_NEAR - 1, "wakes at HAND_NEAR");
  assert.equal(events(hit, "sledHandWarn").length, 1);
  assert.equal(hit.bonusRound.hearts, 5, "a shiver hurts nothing");
  until(hit, () => hit.sled.hands[0].state === "up", 2000);
  assert.equal(events(hit, "sledHandUp").length, 1);
  assert.ok(200 - hit.you.x > 8 && 200 - hit.you.x < 20, `up ${200 - hit.you.x} ahead: time to see it`);
  until(hit, () => hit.bonusRound.hearts < 5, 2000);
  assert.equal(events(hit, "lose")[0].cause, "grasp");
  assert.equal(events(hit, "sledCrash")[0].what, "hand");
  assert.equal(hit.sled.hands[0].state, "sink");
  until(hit, () => hit.sled.hands[0].state === "spent", 1000);
  assert.deepEqual(hit.bonusRound.perf.hits, ["h0"]);
  // A jump over it.
  const jump = synth({ track: FLAT, hands: [[200, 0]] });
  sledAt(jump, 150, 0);
  until(jump, () => jump.sled.hands[0].state === "up", 2000);
  press(jump);
  until(jump, () => jump.you.x > 230, 3000);
  assert.equal(jump.bonusRound.hearts, 5);
  // It is up for HAND_UP_MS and then sinks away on its own.
  const left = synth({ track: FLAT, hands: [[600, 0]] });
  sledAt(left, 580, 0);
  left.sled.hands[0] = { state: "up", t: sl.HAND_UP_MS, hp: 2 };
  left.you.safeMs = 1e9;
  run(left, 100);
  const stay = until(left, () => left.sled.hands[0].state === "sink" || left.sled.hands[0].state === "spent", 5000);
  assert.ok(stay > sl.HAND_UP_MS - 400 - 100 && stay < sl.HAND_UP_MS + 100, `up ${stay} ms more`);
});

test("Ghoul Rush's Coffin Sled: bolts follow the hill, so one shot breaks an icicle, shoots a popped-up ghoul (150 points) and takes HAND_HP bolts off a hand (100 points), each for the grade's acts", () => {
  const round = synth({ track: DOWN, icicles: [[60, 0]], pops: [[120, 0]], hands: [[180, 0]] });
  sledAt(round, 20, 0);
  round.you.safeMs = 1e9;
  const start = round.score;
  // The icicle: a bolt from the sled, 40 away and 6 down the hill, still meets it.
  round.input.fire = true;
  until(round, () => round.sled.icicles[0], 1500);
  assert.equal(round.sled.icicles[0], true);
  assert.equal(events(round, "sledIcicle").length, 1);
  assert.equal(events(round, "sledIcicle")[0].points, sl.ICICLE_POINTS);
  assert.equal(round.bonusRound.perf.acts, 1);
  // The ghoul pops up when POP_NEAR short of it, rises, and one bolt takes it.
  assert.equal(round.sled.pops[0].state === "up" || round.sled.pops[0].state === "down", true);
  until(round, () => round.sled.pops[0].state === "broken", 3000);
  assert.equal(round.sled.pops[0].state, "broken");
  assert.equal(events(round, "sledPopUp").length, 1);
  assert.equal(events(round, "sledPopHit")[0].points, sl.POP_POINTS);
  // The hand: HAND_HP bolts.
  until(round, () => round.sled.hands[0].state === "broken", 4000);
  assert.equal(round.sled.hands[0].state, "broken");
  assert.equal(events(round, "sledHandHit").length, sl.HAND_HP - 1);
  assert.equal(events(round, "sledHandBreak")[0].points, sl.HAND_POINTS);
  round.input.fire = false;
  assert.equal(round.bonusRound.perf.acts, 3);
  assert.ok(round.score - start >= sl.ICICLE_POINTS + sl.POP_POINTS + sl.HAND_POINTS);
  assert.equal(round.bonusRound.hearts, 5, "a hand shot dead never grabs");
  // A bolt was never level: it flew along the slope.
  const probe = synth({ track: DOWN });
  probe.input.fire = true;
  run(probe, 300);
  probe.input.fire = false;
  assert.ok(probe.shots.length > 0);
  for (const s of probe.shots) {
    const aboveSled = s.y - (40 - 0.15 * s.x);
    assert.ok(Math.abs(aboveSled - (ghoul.SHOT_Y)) < 0.5, `a bolt ${aboveSled.toFixed(2)} over the ice`);
  }
  // A bolt shot and missed leaves nothing behind (an icicle not in the way).
  assert.equal(probe.bonusRound.perf.acts, 0);
});

test("Ghoul Rush's Coffin Sled: a ghoul that pops up stays POP_UP_MS and ducks down again (not worth anything then), and what is shot stays shot after a restart", () => {
  const round = synth({ track: FLAT, pops: [[100, 0]] });
  sledAt(round, 30, 0);
  round.you.safeMs = 1e9;
  until(round, () => round.sled.pops[0].state === "up", 2000);
  const at = round.you.x;
  assert.ok(100 - at <= sl.POP_NEAR + 0.5 && 100 - at > sl.POP_NEAR - 1);
  const stay = until(round, () => round.sled.pops[0].state === "hid", 4000);
  assert.ok(stay >= sl.POP_UP_MS - 60 && stay <= sl.POP_UP_MS + 60, `${stay} ms up`);
  // Too soon (still rising) a bolt passes through.
  const early = synth({ track: FLAT, pops: [[100, 0]] });
  sledAt(early, 30, 0);
  until(early, () => early.sled.pops[0].state === "up", 2000);
  early.sled.pops[0].t = sl.POP_UP_MS - 100;
  early.shots.push({ x: 99, y: 22, vx: 130, vy: 0, gone: 0 });
  assert.equal(sl.SLED.target(early, early.shots[0]), false, "still rising");
  early.sled.pops[0].t = sl.POP_UP_MS - sl.POP_RISE_MS - 10;
  assert.equal(sl.SLED.target(early, early.shots[0]), true, "risen");
  assert.equal(early.sled.pops[0].state, "broken");
  // A restart keeps what was broken, and sets the hands asleep again.
  early.sled.hands = [{ state: "broken", t: 0, hp: 0 }, { state: "up", t: 5, hp: 1 }];
  early.spec = { ...early.spec, ride: { ...early.spec.ride, hands: [[300, 0], [400, 0]] } };
  early.sled.icicles = [true];
  early.spec = { ...early.spec, ride: { ...early.spec.ride, icicles: [[200, 0]] } };
  sl.SLED.place[0](early, {});
  assert.deepEqual(early.sled.hands.map((h) => h.state), ["broken", "snow"]);
  assert.deepEqual(early.sled.pops.map((p) => p.state), ["broken"]);
  assert.deepEqual(early.sled.icicles, [true]);
});

/* ---------------------------------------------------------- cracks and hearts */

test("Ghoul Rush's Coffin Sled: a crack with no jump is a heart (cause crevasse), the sled goes back on the ice ahead at SLED_V and rolls on; a jump over it costs nothing", () => {
  const ride = { track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] };
  const fall = synth(ride);
  sledAt(fall, 30, 0);
  until(fall, () => fall.bonusRound.hearts < 5, 3000);
  assert.equal(fall.bonusRound.hearts, 4);
  assert.equal(fall.lives, 3, "not a life");
  assert.equal(events(fall, "lose")[0].cause, "crevasse");
  assert.equal(fall.phase, "play");
  assert.equal(fall.sled.line, 1, "on the ice beyond the crack");
  assert.ok(fall.you.x >= 75 && fall.you.x < 80);
  assert.equal(fall.you.y, 20);
  assert.equal(fall.sled.v, sl.SLED_V);
  assert.ok(fall.you.safeMs > 0);
  assert.deepEqual(fall.bonusRound.perf.hits, ["k0"]);
  run(fall, 600);
  assert.equal(fall.sled.line, 1);
  assert.equal(fall.bonusRound.hearts, 4);
  // Jumped.
  const hop = synth(ride);
  sledAt(hop, 54, 0);
  press(hop);
  until(hop, () => hop.you.x > 100, 3000);
  assert.equal(hop.bonusRound.hearts, 5);
  assert.equal(hop.sled.line, 1);
});

test("Ghoul Rush's Coffin Sled: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Widow's Web", () => {
  const round = sledRound();
  round.dice = 2;
  const score = round.score;
  round.bonusRound.hearts = 1;
  sledAt(round, lines[0].x1 - 6, 0);
  round.you.safeMs = 0;
  const heartsBefore = round.bonusRound.hearts;
  until(round, () => round.phase === "clear", 6000);
  assert.equal(heartsBefore, 1);
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
  assert.equal(round.phase, "clear");
  run(round, ghoul.CARD_LOST_MS + 100);
  assert.equal(round.spec.id, "widow");
  assert.equal(round.bonusRound, null);
  assert.equal(round.sled, null);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Coffin Sled: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart", () => {
  const round = sledRound();
  const seen = [];
  sledAt(round, R.checks[0] - 6, ct.linesAt(R, R.checks[0] - 6)[0][0]);
  round.you.safeMs = 1e9;
  until(round, () => round.sled.check >= 1, 4000);
  for (const e of events(round, "sledCheck")) seen.push(e.n);
  assert.deepEqual(seen.slice(0, 1), [1]);
  assert.ok(round.sled.check >= 0);
  // The place hook puts him back at the last one passed, at SLED_V.
  const c0 = round.sled.check;
  round.you.x = 1;
  sl.SLED.place[0](round, {});
  assert.equal(round.you.x, R.checks[c0]);
  assert.equal(round.sled.v, sl.SLED_V);
  assert.equal(round.sled.check, c0);
  assert.equal(round.camLead, sl.CAM_AHEAD);
  // And at the start in a fresh room.
  const fresh = sledRound();
  assert.equal(fresh.you.x, ROOM.start);
  assert.equal(fresh.sled.check, -1);
});

test("Ghoul Rush's Coffin Sled: off the lip the sled launches, lands on the snowbank and stops (sledFinish), the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = sledRound();
  round.dice = 1;
  const last = lines.length - 1;
  sledAt(round, lines[last].x1 - 12, last, { safe: true });
  until(round, () => round.sled.done, 4000);
  assert.equal(round.sled.done, true);
  assert.equal(events(round, "sledLaunch").length, 1);
  assert.equal(events(round, "sledLaunch")[0].last, true);
  const fin = events(round, "sledFinish");
  assert.equal(fin.length, 1);
  assert.ok(round.you.x > R.finish + 4 && round.you.x < R.finish + 40, `${round.you.x} landed`);
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
  assert.equal(round.spec.id, "widow");
  assert.equal(round.sled, null);
});

test("Ghoul Rush's Coffin Sled: no random number is drawn in the room (a ride of 20 seconds, jumping and shooting, on a draw that throws)", () => {
  const round = sledRound();
  sledAt(round, 120, 0, { safe: true });
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

test("Ghoul Rush's Coffin Sled's grade: the dice formula, shooting 12 things for the die, and the sweet tooth die (souls taken, Hot Cocoa drunk)", () => {
  const round = sledRound();
  const b = round.bonusRound;
  assert.equal(b.perf.goal, sl.ACTS_GOAL);
  assert.equal(b.perf.total, R.stones.length + R.drifts.length + R.lows.length + R.hands.length + lines.length - 1);
  assert.equal(b.perf.steady, false, "no sweets yet");
  const mk = (perf) => {
    const x = makeBonus({ stats: { kills: 0 } });
    Object.assign(x.perf, { total: b.perf.total, goal: sl.ACTS_GOAL }, perf);
    return x;
  };
  assert.equal(diceFor(mk({ hits: [], acts: 12, steady: true })), 9, "a perfect ride");
  assert.equal(diceFor(mk({ hits: [], acts: 11, steady: true })), 8);
  assert.equal(diceFor(mk({ hits: [], acts: 12, steady: false })), 8);
  // Souls: 45% of the room's, or less with cocoa.
  const goal = Math.ceil(sl.SWEET_SHARE * round.candy.length);
  sledAt(round, 60, 0, { safe: true });
  for (let i = 0; i < goal - 1; i++) round.candy[i] = true;
  run(round, 500);
  assert.equal(b.perf.steady, false, "one soul short");
  round.candy[goal - 1] = true;
  run(round, 500);
  assert.equal(b.perf.steady, true, "enough souls");
  // Cocoa counts as SWEET_COCOA souls.
  const cocoa = sledRound();
  sledAt(cocoa, 60, 0, { safe: true });
  const idx = cocoa.spec.items.findIndex(([kind]) => kind === "cocoa");
  assert.ok(idx >= 0, "the room has Hot Cocoa");
  cocoa.items[idx] = true;
  cocoa.loot[idx] = "cocoa";
  for (let i = 0; i < goal - sl.SWEET_COCOA; i++) cocoa.candy[i] = true;
  run(cocoa, 500);
  assert.equal(cocoa.bonusRound.perf.steady, true, "cocoa and fewer souls");
  assert.equal(R.checks.length >= 3, true);
  assert.equal(cocoa.spec.items.filter(([kind]) => kind === "cocoa").length, 3, "three Hot Cocoas");
  assert.ok(cocoa.spec.items.some(([kind]) => kind === "garlic"), "and a Garlic shield");
});

test("Ghoul Rush's Coffin Sled: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const round = sledRound();
  round.infinite = true;
  const tries = [
    { stones: [[60, 0]] }, { drifts: [[60, 0]] }, { lows: [[56, 62, 23.0, 0]] }, { hands: [[60, 0]] },
  ];
  for (const t of tries) {
    const r = synth({ track: FLAT, ...t });
    r.infinite = true;
    if (t.hands) sledAt(r, 20, 0);
    until(r, () => events(r, "lose").length > 0, 3000);
    assert.equal(r.bonusRound.hearts, 5, JSON.stringify(Object.keys(t)));
    assert.equal(r.lives, 3);
  }
  const crack = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  crack.infinite = true;
  sledAt(crack, 30, 0);
  until(crack, () => events(crack, "lose").length > 0, 3000);
  assert.equal(crack.bonusRound.hearts, 5);
  assert.equal(crack.lives, 3);
});

test("Ghoul Rush's Coffin Sled: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ track: FLAT, stones: [[60, 0]] });
  round.you.garlic = true;
  until(round, () => round.you.x > 70, 3000);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false, "spent");
});

/* ------------------------------------------------------ sounds and words */

test("Ghoul Rush's Coffin Sled: every event has a voice that plays, every cause has words and a sound, and the voices borrow tones that exist", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...sl.EVENTS].sort(), "a voice for every event and no more");
  const tones = new Set(Object.keys(ghoulSfx.default.tones));
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = SLED_VOICES[kind] && SLED_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones.has(name) || ghoulSfx.default.tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "stone", points: 50 }).played;
    assert.ok(played.includes(name), `${event} plays ${name}`);
  }
  for (const cause of ["tomb", "drift", "branch", "grasp", "crevasse"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  // Each plays once (a throttled duck is quiet the second time within its beat).
  assert.equal(heard({ type: "sledJump" }).played.length, 1);
  assert.equal(heard({ type: "sledIcicle", points: 50 }).played.length, 1);
});

test("Ghoul Rush's Coffin Sled: the room's own names do not collide with the game's (hazards, events, kinds)", () => {
  for (const e of sl.EVENTS) assert.ok(e.startsWith("sled"), e);
  const other = new Set();
  for (const pack of [ct]) for (const e of pack.EVENTS || []) other.add(e);
  for (const e of sl.EVENTS) assert.ok(!other.has(e), `${e} is the sled's alone`);
  assert.deepEqual(Object.keys(sl.SLED).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(ghoul.ROOM_MUSIC.sled && typeof ghoul.ROOM_MUSIC.sled, "string");
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Coffin Sled draws: the room in a lit and a dark one, the sled on the ice, in the air and ducking, each thing (stones, drifts, branches, arches, hands in each state, ghouls in each, icicles whole and broken), a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["frozen"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "sled") through(r);
  r.lives = 99;
  const spots = [ROOM.start + 40, R.stones[0][0] - 10, R.lows[0][0] - 5, R.lows[1][0] - 5, R.hands[0][0] - 10, R.pops[0][0] - 20, R.checks[0], lines[0].x1 - 10, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      const top = ct.linesAt(R, x)[0] || [lines.length - 1, 20];
      sledAt(r, x, top[0], { safe: true });
      r.sled.hands = r.sled.hands.map((h, i) => ({ ...h, state: ["snow", "warn", "up", "sink", "broken", "spent"][i % 6], t: 600 }));
      r.sled.pops = r.sled.pops.map((p, i) => ({ ...p, state: ["down", "up", "hid", "broken"][i % 4], t: 1500 }));
      r.sled.icicles = r.sled.icicles.map((_, i) => i % 3 === 0);
      for (const air of [false, true]) {
        if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
        if (air) r.sled.line = -1;
        r.you.ducking = x === R.lows[0][0] - 5 && !air;
        r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
        for (let k = 0; k < 4; k++) g.tick(16);
        r.monsters.length = 0;
        r.you.safeMs = 1e9;
        sledAt(r, x, top[0], { safe: true });
      }
    }
  }
  assert.equal(r.spec.id, "sled");
  // A crash, the lip and the stop, the lost and won cards.
  r.you.safeMs = 0;
  sledAt(r, R.stones[0][0] - 3, R.stones[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["frozen"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "sled") through(d);
  d.phase = "play";
  d.sled.done = true;
  d.sled.restX = R.finish + 20;
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
  const at = ghoul.STAGES.findIndex((s) => s.id === "frozen");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "sled");
  assert.equal(p.sled.line, 0);
  assert.equal(p.you.y, ct.trackY(R, 0, ROOM.start));
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that dodges well: it jumps at the end of a line (not the lip), 9 to 15 short of a headstone, a drift or a
// hand, ducks under every low, and holds the blaster. `miss` is the share of things it fails to dodge (by a hash).
const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
function goodBot(round, seed, miss = 0.04) {
  const { you, sled: c, input: inp } = round;
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
    for (const [x] of [...R.stones, ...R.drifts]) if (ahead(x) && ok(x)) jump = true;
    R.hands.forEach(([x], i) => {
      if (c.hands[i].state !== "broken" && ahead(x) && ok(x)) jump = true;
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
  const round = sledRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.sled && round.sled.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.sled && !round.sled.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the sled stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Coffin Sled: a bot that dodges well finishes the whole hill in 60 to 75 seconds, 7 to 9 dice, a few hearts lost at most, past every checkpoint", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 76000, `${ms} ms`);
    assert.ok(b.dice >= 6 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.sled.check, R.checks.length - 1, "past every checkpoint");
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 7, `${dice.join(",")}`);
});

test("Ghoul Rush's Coffin Sled: a bot that never dodges (holding fire) loses all five hearts before the first third, ends with 0 dice and the run goes on", () => {
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

test("Ghoul Rush's Coffin Sled telegraphs: DUCK over branches and arches, JUMP over cracks, headstones and drifts, none for hands, icicles or ghouls, words only on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  const answers = { crack: "JUMP", stone: "JUMP", drift: "JUMP", branch: "DUCK", arch: "DUCK" };
  assert.equal(marks.length, (R.track.length - 1) + R.stones.length + R.drifts.length + R.lows.length, "one per jumped or ducked obstacle, none for hands, icicles or ghouls");
  for (const m of marks) assert.equal(m.answer, answers[m.kind], m.kind);
  R.lows.forEach(([x0, x1, y, kind]) => {
    const m = marks.find((q) => q.x === (x0 + x1) / 2);
    assert.equal(m.kind, kind ? "arch" : "branch");
    assert.equal(m.answer, "DUCK");
  });
  const first = R.lows.find((l) => !l[3]);
  const m = marks.find((q) => q.x === (first[0] + first[1]) / 2);
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "branch" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33), telegraphs(R, m.lead - 33), "deterministic");
  assert.deepEqual(JSON.parse(JSON.stringify(telegraphs(R, 100))), JSON.parse(JSON.stringify(telegraphs(R, 100))));
  for (const kind of ["crack", "stone", "drift", "branch", "arch"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length > 3, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((t) => t.lead === q.lead);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
  const words = telegraphs(R, R.stones[0][0] - 33);
  assert.ok(words.some((t) => t.kind === "stone" && t.answer === "JUMP" && t.words));
});

test("Ghoul Rush's Coffin Sled's intro banner says the controls plainly", () => {
  assert.match(R.how, /UP to jump, DOWN to duck/);
});
