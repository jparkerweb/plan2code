// Web console tests, Ghoul Rush's Code Blue (Blackmoor Sanatorium's bonus round, between the Surgical Theater and the Night Ward): its shape (every elevator shaft clears with a jump and swallows a gurney that does not jump, every low can be ducked, spacing, the surge lamps and the blackout waves, checkpoints, the clock), the gurney's speed on slopes, its jump, ducking, a wheelchair that rolls, an IV stand, a lamp or a door overhead, an orderly in a doorway, the surge lamp shot from the air, the lights-out rhythm (the countdown, the dark, the lights back), the heartbeat monitor, a fall down a shaft, the checkpoint, the jump off the end and the door, the bonus round's hearts and dice (3 to 9) and the clean-dark-stretches die, endless lives for every cause, a voice for every event, the drawing, and bots that ride the whole way (one that dodges well, one that never does).
// Run with: node --test scripts/test-web-console-activities-ghoul-gurney.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as gn from "../src/web-console/public/activities/ghoul-rush/rides/gurney/ghoul-gurney.js";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as GURNEY_LOOKS, VOICES as GURNEY_VOICES, gurneyArt, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/gurney/ghoul-gurney-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("Code Blue drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in Code Blue reached the way play reaches it, nothing woken, the clocks long, the bonus round on (five hearts).
function gurneyRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["sanatorium"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "codeblue") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "codeblue", time: 1e9, finish: 1e6, track: [], chairs: [], stands: [], lows: [], orderlies: [], lamps: [], waves: [], checks: [] };
// The same round over a ride of its own (a plain track to measure the gurney on).
function synth(ride) {
  const round = gurneyRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { ...NONE, ...ride } };
  gn.GURNEY.place[0](round, {});
  return round;
}
const FLAT = [[[0, 20], [4000, 20]]];
const DOWN = [[[0, 40], [4000, 40 - 0.15 * 4000]]];
const UP = [[[0, 0], [4000, 0.3 * 4000]]];

// The gurney on line `line` of the ride at `x`, at speed `v`.
function gurneyAt(round, x, line, { v = gn.GURNEY_V, safe = false } = {}) {
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

const ROOM = ghoul.roomById("codeblue");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);
const slopeAtLine = (L, i) => (L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0]);
const lineOfX = (x) => lines.findIndex((L) => x >= L.x0 && x <= L.x1);

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Code Blue is Blackmoor Sanatorium's fourth room, between the Surgical Theater and the Night Ward: lit, no key, no boss, a ride about 60 to 70 seconds long, a bonus round that plays its own track", () => {
  const st = ghoul.stageById("sanatorium");
  assert.deepEqual(st.rooms, ["admissions", "baths", "theater", "codeblue", "ward"]);
  assert.equal(st.boss, ghoul.roomById("ward").boss);
  assert.deepEqual([ROOM.title, ROOM.sub], ["Code Blue", "Please remain calm. The gurney will not"]);
  assert.equal(ROOM.dark, false, "its own darkness comes from the waves");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "codeblue");
  assert.ok(!R.sled && !R.gallery, "not another ride's room");
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3400, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.codeblue, "ghoulBlueRide");
  assert.ok(ghoulSfx.default.music.ghoulBlueRide, "its own track");
  assert.deepEqual(Object.keys(gn.GURNEY.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.codeblue, GURNEY_LOOKS.codeblue);
  assert.equal(LOOKS.codeblue.pack, "codeblue");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]) && Object.isFrozen(R.waves[0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0, "no monsters: the things in the corridors are the pack's own");
  assert.ok(ROOM.candy.length === 0 && ROOM.items.length === 0, "no pickups");
  assert.equal(ROOM.ground.length, 2);
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 100, "floor only at the ends");
  assert.equal(ROOM.ground[1][0], R.finish);
  assert.ok(ROOM.door > R.finish && ROOM.door > ROOM.length - 14, "the door at the room's end, past the bay's start");
  assert.ok(floorOf(ROOM.door - 2) > -Infinity, "floor to walk out on");
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the gurney starts on the floor over the start's ground");
  const secs = (lines.at(-1).x1 - ROOM.start) / gn.GURNEY_V;
  assert.ok(secs >= 58 && secs <= 72, `${secs.toFixed(1)} s at GURNEY_V`);
  let steepest = 0;
  for (const L of lines) {
    for (let i = 0; i + 1 < L.pts.length; i++) {
      const s = slopeAtLine(L, i);
      const lip = L === lines.at(-1) && i === L.pts.length - 2;
      steepest = Math.max(steepest, Math.abs(s));
      assert.ok(lip ? s >= gn.RAMP_SLOPE && s <= 0.32 : Math.abs(s) <= 0.22, `a slope of ${s.toFixed(3)}`);
    }
    for (const [, y] of L.pts) assert.ok(y > gn.DERAIL_Y + 5 && y < 36, `a floor height of ${y}`);
  }
  assert.equal(ghoul.timeFor(ghoul.roomFor("codeblue")), R.time);
  assert.ok(R.time >= 1.5 * secs * 1000, `a ${R.time} ms clock for a ${secs.toFixed(0)} s ride`);
  assert.equal(R.lamps.length, R.waves.length, "a surge lamp for every wave");
  assert.equal(R.checks.length, lines.length - 1);
});

test("Ghoul Rush's Code Blue: the loading ramp's launch alone carries the gurney onto the ambulance bay at any speed it can have there, landing 10 to 40 past its start", () => {
  const lip = lines.at(-1);
  const end = lip.pts.at(-1);
  const rise = ct.slopeOf(R, lines.length - 1, lip.x1);
  assert.ok(rise >= gn.RAMP_SLOPE, "the lip launches");
  const bank = floorOf(R.finish + 1);
  for (const v of [gn.GURNEY_MIN, 42, gn.GURNEY_V, 54, gn.GURNEY_MAX]) {
    let vy = rise * v + gn.RAMP_POP;
    let x = end[0];
    let y = end[1];
    for (let t = 0; t < 3; t += 0.002) {
      vy -= gn.GRAV * 0.002;
      x += v * 0.002;
      y += vy * 0.002;
      if (vy < 0 && y <= bank) break;
    }
    assert.ok(x >= R.finish + 2 && x <= R.finish + 40, `at ${v} it lands ${x - R.finish} past the bay's start`);
  }
});

test("Ghoul Rush's Code Blue: every elevator shaft clears with a jump at the edge or a few units early, and a gurney that never jumps drops into it", () => {
  assert.equal(lines.length - 1, 7, "seven shafts");
  for (let i = 0; i + 1 < lines.length - 1; i++) {
    const a = lines[i];
    const b = lines[i + 1];
    const gap = b.x0 - a.x1;
    assert.ok(gap >= 9 && gap <= 18, `shaft ${i} is ${gap} wide`);
    const end = a.pts.at(-1);
    const slope = ct.slopeOf(R, i, a.x1);
    assert.ok(slope < gn.RAMP_SLOPE, "shafts lie on floors that do not launch");
    for (const v of [40, 45, 50, 55]) {
      assert.equal(gn.flight(R, a.x1, end[1], slope * v, v), null, `shaft ${i}, no jump, at ${v}`);
      for (const early of [0, 4]) {
        const x = a.x1 - early;
        const y = ct.trackY(R, i, x);
        const s = gn.flight(R, x, y, gn.JUMP_V + ct.slopeOf(R, i, x) * v, v);
        assert.ok(s, `shaft ${i}: a jump ${early} early at ${v} lands`);
        assert.equal(s.line, i + 1, `shaft ${i} cleared, at ${v}, ${early} early`);
      }
    }
  }
});

test("Ghoul Rush's Code Blue: every thing is on a line, off its ends, level where it needs to be, spaced for a player (22 between jumps and 38 between a jump and a duck, a wheelchair's roll counted), a low's underside between a ducked box and a standing one", () => {
  const jumps = [];
  const ducks = [];
  const at = (x, w, what) => {
    const i = lineOfX(x);
    assert.ok(i >= 0, `${what} at ${x} is on a line`);
    assert.ok(x - lines[i].x0 >= 30 && lines[i].x1 - x >= 30, `${what} at ${x} is clear of its line's ends`);
    return i;
  };
  const levelAround = (i, a, b) => {
    let lo = 1e9;
    let hi = -1e9;
    for (let x = a; x <= b; x += 0.5) {
      const y = ct.trackY(R, i, x);
      lo = Math.min(lo, y);
      hi = Math.max(hi, y);
    }
    return hi - lo;
  };
  for (const [x, line] of R.chairs) {
    assert.equal(at(x, gn.CHAIR_W, "chair"), line);
    assert.ok(levelAround(line, x - gn.CHAIR_MAX - 2, x + 2) < 0.3, "a chair rolls on level floor");
    jumps.push([x - gn.CHAIR_MAX, x + gn.CHAIR_W / 2]);
  }
  for (const [x, line] of R.stands) {
    assert.equal(at(x, gn.STAND_W, "stand"), line);
    jumps.push([x - gn.STAND_W / 2, x + gn.STAND_W / 2]);
  }
  for (const [x, line] of R.orderlies) {
    assert.equal(at(x, gn.ORDERLY_W, "orderly"), line);
    jumps.push([x - gn.ORDERLY_W / 2, x + gn.ORDERLY_W / 2]);
  }
  R.lows.forEach(([x0, x1, y, kind]) => {
    const i = at((x0 + x1) / 2, x1 - x0, "low");
    assert.ok(kind === 0 || kind === 1);
    const flat = levelAround(i, x0 - 3, x1 + 3);
    assert.ok(flat < 0.3, "a low hangs over level floor");
    const floor = ct.trackY(R, i, (x0 + x1) / 2);
    assert.ok(Math.abs(y - (floor + 3)) < 0.3, `a low's underside is 3.0 over the floor (${y - floor})`);
    assert.ok(floor + 2.4 < y && y < floor + 4.4, "between a ducked box and a standing one");
    ducks.push([x0, x1]);
  });
  const all = [...jumps.map((r) => ({ r, jump: true })), ...ducks.map((r) => ({ r, jump: false }))].sort((p, q) => p.r[0] - q.r[0]);
  for (let k = 1; k < all.length; k++) {
    const gap = all[k].r[0] - all[k - 1].r[1];
    const need = all[k].jump && all[k - 1].jump ? 22 : all[k].jump !== all[k - 1].jump ? 38 : 16;
    assert.ok(gap >= need, `${all[k - 1].jump ? "a jump" : "a duck"} to ${all[k].jump ? "a jump" : "a duck"} is ${gap.toFixed(0)} apart at ${all[k].r[0]}`);
  }
  // A shaft's two edges keep clear of the nearest things as well (the first thing is 50 into a line).
  assert.ok(R.chairs.length >= 6 && R.stands.length >= 6 && R.lows.length >= 10 && R.orderlies.length >= 8, "a good many of each");
  const total = R.chairs.length + R.stands.length + R.lows.length + R.orderlies.length + (lines.length - 1);
  assert.ok(total >= 40, `${total} things to get past`);
});

test("Ghoul Rush's Code Blue: the blackout waves are in order with room between them, each surge lamp hangs SURGE_BACK before its wave on a line, the countdown fits in lit floor, the checkpoints are on lines", () => {
  let prev = 0;
  R.waves.forEach(([x0, x1], i) => {
    assert.ok(x1 - x0 >= 150 && x1 - x0 <= 240, `wave ${i} is ${x1 - x0} long`);
    assert.ok(x0 - gn.WARN_UNITS - prev >= 150, `${x0 - gn.WARN_UNITS - prev} lit units before wave ${i}`);
    prev = x1;
    const [lx, line] = R.lamps[i];
    assert.equal(lx, x0 - gn.SURGE_BACK);
    assert.equal(lineOfX(lx), line);
    assert.ok(lx - lines[line].x0 >= 10 && lines[line].x1 - lx >= 10, "a lamp hangs over floor");
  });
  assert.ok(R.waves.at(-1)[1] <= R.finish - 150, "lit again well before the ramp");
  assert.ok(R.waves[0][0] >= 300, "the first blackout is not at the start");
  R.checks.forEach((x, i) => {
    assert.equal(lineOfX(x), i + 1, `checkpoint ${i} is at the start of line ${i + 1}`);
  });
});

/* ------------------------------------------------------------ the gurney */

test("Ghoul Rush's Code Blue rolls at GURNEY_V on the flat, faster down a slope and slower up one, never past GURNEY_MIN or GURNEY_MAX, and no key changes it", () => {
  const flat = synth({ track: FLAT });
  assert.equal(flat.runner.v, gn.GURNEY_V);
  run(flat, 2000);
  assert.ok(Math.abs(flat.runner.v - gn.GURNEY_V) < 0.01);
  run(flat, 1500, { right: true });
  run(flat, 1500, { left: true });
  assert.ok(Math.abs(flat.runner.v - gn.GURNEY_V) < 0.01, "right and left do nothing");
  assert.ok(Math.abs(flat.you.x - (10 + ((2000 + 1500 + 1500) / 1000) * gn.GURNEY_V)) < 1);
  const down = synth({ track: DOWN });
  run(down, 3000);
  assert.ok(Math.abs(down.runner.v - (gn.GURNEY_V + (gn.SLOPE_G * 0.15) / gn.RELAX)) < 0.2, `${down.runner.v} down a 0.15 slope`);
  assert.ok(down.runner.v <= gn.GURNEY_MAX);
  const up = synth({ track: UP });
  run(up, 3000);
  assert.ok(up.runner.v >= gn.GURNEY_MIN && up.runner.v < gn.GURNEY_V);
  const steep = synth({ track: [[[0, 10000], [4000, 6000]]] });
  run(steep, 3000);
  assert.equal(steep.runner.v, gn.GURNEY_MAX);
  assert.equal(flat.you.face, 1);
  assert.equal(flat.you.state, "run");
  assert.equal(flat.you.y, 20);
  assert.equal(flat.runner.pack, "codeblue");
});

test("Ghoul Rush's Code Blue jumps about 13 high for about three quarters of a second, a press saved for a landing jumps on it, one just after a line's end still jumps", () => {
  const round = synth({ track: FLAT });
  let top = 0;
  press(round);
  const t = until(round, () => {
    top = Math.max(top, round.you.y - 20);
    return round.you.state === "run" && round.you.y === 20 && round.you.vy === 0 && top > 1;
  }, 3000);
  assert.ok(Math.abs(top - (gn.JUMP_V * gn.JUMP_V) / (2 * gn.GRAV)) < 0.4, `${top.toFixed(1)} high`);
  assert.ok(t > 650 && t < 850, `${t} ms in the air`);
  assert.equal(events(round, "blueJump").length, 1);
  assert.equal(events(round, "blueLand").length, 1);
  const buf = synth({ track: FLAT });
  press(buf);
  run(buf, 640);
  press(buf);
  until(buf, () => events(buf, "blueJump").length >= 2, 1500);
  assert.equal(events(buf, "blueJump").length, 2, "the saved press jumped again at the landing");
  const edge = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  gurneyAt(edge, 58.5, 0);
  run(edge, 80);
  assert.equal(edge.runner.line, -1, "off the end");
  press(edge);
  run(edge, 4);
  assert.equal(events(edge, "blueJump").length, 1, "coyote");
  const late = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  gurneyAt(late, 58.5, 0);
  run(late, 80 + gn.COYOTE_MS);
  press(late);
  run(late, 4);
  assert.equal(events(late, "blueJump").length, 0);
});

test("Ghoul Rush's Code Blue: down ducks (and a press of up jumps instead), a ducked Planny passes under a hanging lamp or a swinging door and a standing one hits it (cause overhead), at the cost of a heart", () => {
  for (const kind of [0, 1]) {
    const round = synth({ track: FLAT, lows: [[60, 66, 23.0, kind]] });
    const you = round.you;
    run(round, 20, { down: true });
    assert.equal(events(round, "blueDuck").length, 1);
    round.input.down = true;
    until(round, () => you.x > 75, 3000);
    round.input.down = false;
    assert.equal(round.bonusRound.hearts, 5);
    assert.equal(round.lives, 3);
    const hit = synth({ track: FLAT, lows: [[60, 66, 23.0, kind]] });
    until(hit, () => hit.bonusRound.hearts < 5, 3000);
    assert.equal(hit.bonusRound.hearts, 4, "a heart");
    assert.equal(hit.lives, 3, "never a life");
    assert.equal(events(hit, "lose")[0].cause, "overhead");
    assert.equal(events(hit, "blueCrash")[0].what, "low");
    assert.ok(hit.you.safeMs > 0, "blinking safe");
    assert.equal(hit.phase, "play", "rolls on");
    assert.deepEqual(hit.bonusRound.perf.hits, ["l0"]);
    until(hit, () => hit.you.x > 80, 2000);
    assert.equal(hit.bonusRound.hearts, 4, "only once");
  }
  const both = synth({ track: FLAT });
  both.input.down = true;
  press(both);
  run(both, 20);
  assert.equal(both.you.ducking, false);
  assert.equal(events(both, "blueJump").length, 1);
});

test("Ghoul Rush's Code Blue: a wheelchair starts rolling at the gurney CHAIR_NEAR short of it (at most CHAIR_MAX), a jump clears it and standing in its way is a heart (cause wheelchair); an IV stand likewise (cause ivstand)", () => {
  const hit = synth({ track: FLAT, chairs: [[300, 0]] });
  gurneyAt(hit, 200, 0);
  run(hit, 100);
  assert.equal(hit.runner.chairs[0].rolling, false, "far off: parked");
  until(hit, () => hit.runner.chairs[0].rolling, 2000);
  assert.ok(300 - hit.you.x <= gn.CHAIR_NEAR + 0.5 && 300 - hit.you.x > gn.CHAIR_NEAR - 1, "starts at CHAIR_NEAR");
  assert.equal(events(hit, "blueChair").length, 1);
  until(hit, () => hit.bonusRound.hearts < 5, 3000);
  assert.equal(events(hit, "lose")[0].cause, "wheelchair");
  assert.equal(events(hit, "blueCrash")[0].what, "chair");
  assert.ok(hit.runner.chairs[0].x < 300 && hit.runner.chairs[0].x >= 300 - gn.CHAIR_MAX, "it rolled toward the gurney");
  assert.deepEqual(hit.bonusRound.perf.hits, ["c0"]);
  // It stops rolling at CHAIR_MAX.
  const far = synth({ track: FLAT, chairs: [[300, 0]] });
  gurneyAt(far, 240, 0, { safe: true });
  run(far, 3000);
  assert.equal(far.runner.chairs[0].x, 300 - gn.CHAIR_MAX);
  // A jump 9 to 15 short clears it.
  const jump = synth({ track: FLAT, chairs: [[300, 0]] });
  gurneyAt(jump, 200, 0);
  until(jump, () => 300 - jump.runner.chairs[0].x > 6 && 300 - jump.runner.chairs[0].x - jump.you.x > -1e9 && jump.runner.chairs[0].x - jump.you.x < 14, 3000);
  press(jump);
  until(jump, () => jump.you.x > 340, 3000);
  assert.equal(jump.bonusRound.hearts, 5);
  // The stand.
  const stand = synth({ track: FLAT, stands: [[100, 0]] });
  until(stand, () => stand.bonusRound.hearts < 5, 3000);
  assert.equal(events(stand, "lose")[0].cause, "ivstand");
  assert.deepEqual(stand.bonusRound.perf.hits, ["s0"]);
  const over = synth({ track: FLAT, stands: [[100, 0]] });
  until(over, () => over.you.x > 88, 3000);
  press(over);
  until(over, () => over.you.x > 125, 3000);
  assert.equal(over.bonusRound.hearts, 5);
});

test("Ghoul Rush's Code Blue: an orderly's door shivers when the gurney is ORDERLY_NEAR short, he lunges for ORDERLY_UP_MS, grabs (cause lunged) if you meet him, and steps back; a jump clears him; two bolts drop him for 100 points", () => {
  const hit = synth({ track: FLAT, orderlies: [[200, 0]] });
  gurneyAt(hit, 150, 0);
  assert.equal(hit.runner.orderlies[0].state, "door");
  run(hit, 100);
  assert.equal(hit.runner.orderlies[0].state, "door", "far off: shut");
  until(hit, () => hit.runner.orderlies[0].state === "warn", 2000);
  assert.ok(200 - hit.you.x <= gn.ORDERLY_NEAR + 0.5 && 200 - hit.you.x > gn.ORDERLY_NEAR - 1, "wakes at ORDERLY_NEAR");
  assert.equal(events(hit, "blueOrderlyWarn").length, 1);
  assert.equal(hit.bonusRound.hearts, 5, "a shiver hurts nothing");
  until(hit, () => hit.runner.orderlies[0].state === "up", 2000);
  assert.equal(events(hit, "blueOrderlyUp").length, 1);
  assert.ok(200 - hit.you.x > 8 && 200 - hit.you.x < 24, `up ${200 - hit.you.x} ahead: time to see him`);
  until(hit, () => hit.bonusRound.hearts < 5, 2000);
  assert.equal(events(hit, "lose")[0].cause, "lunged");
  assert.equal(events(hit, "blueCrash")[0].what, "orderly");
  assert.equal(hit.runner.orderlies[0].state, "sink");
  until(hit, () => hit.runner.orderlies[0].state === "spent", 1000);
  assert.deepEqual(hit.bonusRound.perf.hits, ["o0"]);
  const jump = synth({ track: FLAT, orderlies: [[200, 0]] });
  gurneyAt(jump, 150, 0);
  until(jump, () => jump.runner.orderlies[0].state === "up", 2000);
  press(jump);
  until(jump, () => jump.you.x > 230, 3000);
  assert.equal(jump.bonusRound.hearts, 5);
  const shot = synth({ track: FLAT, orderlies: [[200, 0]] });
  gurneyAt(shot, 130, 0, { safe: true });
  const start = shot.score;
  shot.input.fire = true;
  until(shot, () => shot.runner.orderlies[0].state === "broken", 3000);
  shot.input.fire = false;
  assert.equal(shot.runner.orderlies[0].state, "broken");
  assert.equal(events(shot, "blueOrderlyHit").length, gn.ORDERLY_HP - 1);
  assert.equal(events(shot, "blueOrderlyBreak")[0].points, gn.ORDERLY_POINTS);
  assert.equal(shot.bonusRound.perf.acts, 1);
  assert.ok(shot.score - start >= gn.ORDERLY_POINTS);
  assert.equal(shot.bonusRound.hearts, 5, "a dead orderly never grabs");
  // A restart keeps him shot.
  const next = synth({ track: FLAT, orderlies: [[200, 0]] });
  next.runner.orderlies[0].state = "broken";
  next.runner.check = 0;
  next.spec = { ...next.spec, ride: { ...next.spec.ride, checks: [20] } };
  gn.GURNEY.place[0](next, {});
  assert.equal(next.runner.orderlies[0].state, "broken");
});

/* ----------------------------------------------------- the lights, the lamps */

test("Ghoul Rush's Code Blue: the lights go 3, 2, 1 over WARN_UNITS, then dark from x0 to x1 (fading in and out), and come back; each step is an event", () => {
  const ride = { track: FLAT, waves: [[400, 600]], lamps: [[330, 0]] };
  assert.deepEqual(gn.lightsAt({ ...NONE, ...ride }, 100, null), { i: -1, phase: "lit", n: 0, dark: 0 });
  const w = { ...NONE, ...ride };
  assert.equal(gn.lightsAt(w, 400 - gn.WARN_UNITS - 1, null).phase, "lit");
  assert.deepEqual([400 - 84, 400 - 57, 400 - 56, 400 - 29, 400 - 28, 400 - 0.5].map((x) => gn.lightsAt(w, x, null).n), [3, 3, 2, 2, 1, 1]);
  assert.equal(gn.lightsAt(w, 399.9, null).phase, "warn");
  assert.equal(gn.lightsAt(w, 400, null).phase, "dark");
  const fade = gn.lightsAt(w, 402, null).dark;
  assert.ok(fade > 0 && fade < 1, "falling");
  assert.equal(gn.lightsAt(w, 500, null).dark, 1);
  const lift = gn.lightsAt(w, 595, null).dark;
  assert.ok(lift > 0 && lift < 1, "lifting");
  assert.equal(gn.lightsAt(w, 600, null).phase, "lit");
  assert.equal(gn.lightsAt(w, 500, [{ off: true }]).phase, "lit", "a wave called off is skipped");
  // Through a ride at the gurney's pace.
  const round = synth(ride);
  gurneyAt(round, 300, 0, { safe: true });
  const seen = [];
  const log = (type) => events(round, type).forEach((e) => seen.push(type + (e.n || "")));
  for (let t = 0; t < 8000 && round.you.x < 640; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const k of ["blueWarn", "blueDark", "blueLit"]) log(k);
    round.events.length = 0;
  }
  assert.deepEqual(seen, ["blueWarn3", "blueWarn2", "blueWarn1", "blueDark", "blueLit"]);
  assert.equal(round.runner.phase, "lit");
  assert.equal(round.runner.dark, 0);
});

test("Ghoul Rush's Code Blue: a surge lamp shot from the air (a hop while holding fire) calls its blackout off, for 150 points and one act; a level shot passes under it", () => {
  const ride = { track: FLAT, waves: [[400, 600]], lamps: [[330, 0]] };
  const level = synth(ride);
  gurneyAt(level, 260, 0, { safe: true });
  level.input.fire = true;
  until(level, () => level.you.x > 336, 3000);
  level.input.fire = false;
  assert.equal(level.runner.lamps[0], false, "a level shot passes under the lamp");
  assert.equal(level.runner.waves[0].off, false);
  const duck = synth(ride);
  gurneyAt(duck, 260, 0, { safe: true });
  duck.input.fire = true;
  duck.input.down = true;
  until(duck, () => duck.you.x > 336, 3000);
  assert.equal(duck.runner.lamps[0], false, "nor a ducked one");
  // A hop with the blaster held.
  const hop = synth(ride);
  gurneyAt(hop, 270, 0, { safe: true });
  const start = hop.score;
  hop.input.fire = true;
  press(hop);
  until(hop, () => hop.runner.lamps[0], 1500);
  hop.input.fire = false;
  assert.equal(hop.runner.lamps[0], true, "the lamp shorts out");
  assert.equal(hop.runner.waves[0].off, true);
  const e = events(hop, "blueLamp")[0];
  assert.equal(e.points, gn.LAMP_POINTS);
  assert.equal(e.wave, 0);
  assert.equal(hop.bonusRound.perf.acts, 1);
  assert.ok(hop.score - start >= gn.LAMP_POINTS);
  // The section stays lit: the countdown never runs and it never goes dark.
  const seen = [];
  for (let t = 0; t < 8000 && hop.you.x < 640; t += 4) {
    ghoul.advance(hop, 4, steady);
    for (const k of ["blueWarn", "blueDark", "blueLit"]) if (events(hop, k).length) seen.push(k);
    hop.events.length = 0;
    assert.equal(hop.runner.dark, 0);
  }
  assert.deepEqual(seen, [], "no countdown, no dark");
  // A shot lamp stays shot after a restart.
  hop.runner.check = -1;
  gn.GURNEY.place[0](hop, {});
  assert.equal(hop.runner.lamps[0], true);
  assert.equal(hop.runner.waves[0].off, true);
});

test("Ghoul Rush's Code Blue: the heartbeat monitor beeps every BEAT_MS by hearts left, faster with each hit, and flatlines at the last heart (a long flat tone)", () => {
  const rates = [];
  for (const hearts of [5, 4, 3, 2, 1]) {
    const round = synth({ track: FLAT });
    round.bonusRound.hearts = hearts;
    round.you.safeMs = 1e9;
    round.events.length = 0;
    let beats = 0;
    let flat = 0;
    for (let t = 0; t < 4800; t += 4) {
      ghoul.advance(round, 4, steady);
      for (const e of events(round, "blueBeat")) {
        beats++;
        if (e.flat) flat++;
      }
      round.events.length = 0;
    }
    rates.push(beats);
    if (hearts > 1) {
      assert.equal(flat, 0);
      assert.equal(beats, Math.floor(4800 / gn.BEAT_MS[hearts]), `${hearts} hearts`);
    } else {
      assert.equal(flat, beats, "flat");
      assert.equal(beats, Math.floor(4800 / gn.FLAT_MS));
      assert.equal(round.runner.flat, true);
    }
  }
  assert.ok(rates[0] < rates[1] && rates[1] < rates[2] && rates[2] < rates[3], `${rates.join(",")}: faster with every hit`);
  // The flat tone is a tone of its own and fits in 1.2 s.
  assert.ok(heard({ type: "blueBeat", flat: true }).played.includes("ghoulBlueFlat"));
  assert.ok(heard({ type: "blueBeat", flat: false }).played.includes("ghoulBlueBeat"));
  for (const layer of ghoulSfx.default.tones.ghoulBlueFlat.layers) assert.ok(layer.seconds <= 1.2);
});

/* ------------------------------------------------------- shaft, hearts, door */

test("Ghoul Rush's Code Blue: a shaft with no jump is a heart (cause elevator), the gurney goes back on the floor ahead at GURNEY_V and rolls on; a jump over it costs nothing", () => {
  const ride = { track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] };
  const fall = synth(ride);
  gurneyAt(fall, 30, 0);
  until(fall, () => events(fall, "lose").length > 0, 3000);
  assert.equal(events(fall, "lose")[0].cause, "elevator");
  assert.equal(fall.bonusRound.hearts, 4);
  assert.equal(fall.lives, 3);
  assert.equal(fall.phase, "play");
  assert.ok(fall.you.x > 75 && fall.runner.line === 1, "back on the floor ahead");
  assert.equal(fall.runner.v, gn.GURNEY_V);
  assert.ok(fall.you.safeMs > 0);
  assert.deepEqual(fall.bonusRound.perf.hits, ["k0"]);
  const jump = synth(ride);
  gurneyAt(jump, 30, 0);
  until(jump, () => jump.you.x > 52, 2000);
  press(jump);
  until(jump, () => jump.you.x > 120, 3000);
  assert.equal(jump.bonusRound.hearts, 5);
  assert.equal(jump.runner.line, 1);
});

test("Ghoul Rush's Code Blue: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Night Ward", () => {
  const round = gurneyRound();
  round.dice = 2;
  round.bonusRound.hearts = 1;
  gurneyAt(round, lines[0].x1 - 6, 0);
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
  assert.equal(round.spec.id, "ward");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner, null, "the slot is empty in any other room");
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Code Blue: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart", () => {
  const round = gurneyRound();
  for (let i = 0; i < 3; i++) {
    gurneyAt(round, R.checks[i] - 4, lineOfX(R.checks[i] - 4) < 0 ? i : lineOfX(R.checks[i] - 4), { safe: true });
    until(round, () => round.runner.check >= i, 2000);
  }
  assert.equal(round.runner.check, 2);
  assert.deepEqual(events(round, "blueCheck").map((e) => e.n), [1, 2, 3]);
  const x = R.checks[2];
  gn.GURNEY.place[0](round, {});
  assert.equal(round.you.x, x, "back at the last checkpoint passed");
  assert.equal(round.runner.check, 2);
});

test("Ghoul Rush's Code Blue: off the ramp the gurney launches, lands on the bay and stops (blueFinish), the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = gurneyRound();
  round.dice = 1;
  const last = lines.length - 1;
  gurneyAt(round, lines[last].x1 - 12, last, { safe: true });
  until(round, () => round.runner.done, 4000);
  assert.equal(round.runner.done, true);
  assert.equal(events(round, "blueLaunch").length, 1);
  assert.equal(events(round, "blueLaunch")[0].last, true);
  assert.equal(events(round, "blueFinish").length, 1);
  assert.ok(round.you.x > R.finish + 4 && round.you.x < R.finish + 40, `${round.you.x} landed`);
  assert.equal(round.you.y, floorOf(round.you.x));
  assert.equal(round.hasKey, true, "the door opens");
  assert.equal(round.runner.phase, "lit");
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
  assert.equal(round.spec.id, "ward");
  assert.equal(round.runner, null);
});

test("Ghoul Rush's Code Blue: no random number is drawn in the room (a ride of 20 seconds, jumping and shooting, on a draw that throws)", () => {
  const round = gurneyRound();
  round.input.fire = true;
  for (let t = 0; t < 20000; t += 4) {
    if (t % 700 === 0) press(round);
    round.input.down = t % 1900 < 400;
    ghoul.advance(round, 4, never);
    round.events.length = 0;
    if (round.phase !== "play") break;
  }
  assert.ok(round.you.x > 100);
});

test("Ghoul Rush's Code Blue's grade: the dice formula, shooting 8 things for the die, and the clean dark stretches die (at most one blackout may cost a heart)", () => {
  const b = makeBonus({ stats: { kills: 0 } });
  b.perf.total = 40;
  b.perf.goal = gn.ACTS_GOAL;
  assert.equal(diceFor(b), 3 + 2 + 2 + 0 + 1, "five hearts, nothing hit, steady, no shots: 8");
  b.perf.acts = gn.ACTS_GOAL;
  assert.equal(diceFor(b), 9);
  b.perf.steady = false;
  assert.equal(diceFor(b), 8);
  b.perf.hits = Array.from({ length: 40 }, (_, i) => i);
  b.hearts = 1;
  assert.equal(diceFor(b), 3 + 0 + 0 + 1 + 0);
  // A hit in a blackout marks that wave, once; two waves hit take the die.
  const round = synth({ track: FLAT, waves: [[300, 480], [700, 880]], lamps: [[230, 0], [630, 0]], stands: [[330, 0], [350, 0], [750, 0]] });
  assert.equal(round.bonusRound.perf.steady, true);
  gurneyAt(round, 310, 0);
  until(round, () => round.bonusRound.hearts < 5, 2000);
  assert.equal(round.runner.waves[0].hit, true);
  assert.equal(round.runner.hitWaves, 1);
  assert.equal(round.bonusRound.perf.steady, true, "one blackout may cost a heart");
  gurneyAt(round, 720, 0);
  until(round, () => round.bonusRound.hearts < 4, 2000);
  assert.equal(round.runner.hitWaves, 2);
  assert.equal(round.bonusRound.perf.steady, false, "two take the die");
  // A hit in the lit does not count.
  const lit = synth({ track: FLAT, waves: [[600, 800]], lamps: [[530, 0]], stands: [[100, 0]] });
  until(lit, () => lit.bonusRound.hearts < 5, 2000);
  assert.equal(lit.runner.hitWaves, 0);
  // The total counts every obstacle.
  const real = gurneyRound();
  assert.equal(real.bonusRound.perf.total, R.chairs.length + R.stands.length + R.lows.length + R.orderlies.length + (lines.length - 1));
  assert.equal(real.bonusRound.perf.goal, gn.ACTS_GOAL);
  assert.equal(real.bonusRound.perf.steady, true);
});

test("Ghoul Rush's Code Blue: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const tries = [
    { chairs: [[100, 0]] }, { stands: [[60, 0]] }, { lows: [[56, 62, 23.0, 0]] }, { orderlies: [[60, 0]] },
  ];
  for (const t of tries) {
    const r = synth({ track: FLAT, ...t });
    r.infinite = true;
    if (t.orderlies || t.chairs) gurneyAt(r, 20, 0);
    until(r, () => events(r, "lose").length > 0, 3000);
    assert.equal(r.bonusRound.hearts, 5, JSON.stringify(Object.keys(t)));
    assert.equal(r.lives, 3);
  }
  const shaft = synth({ track: [[[0, 20], [60, 20]], [[75, 20], [400, 20]]] });
  shaft.infinite = true;
  gurneyAt(shaft, 30, 0);
  until(shaft, () => events(shaft, "lose").length > 0, 3000);
  assert.equal(shaft.bonusRound.hearts, 5);
  assert.equal(shaft.lives, 3);
});

test("Ghoul Rush's Code Blue: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ track: FLAT, stands: [[60, 0]] });
  round.you.garlic = true;
  until(round, () => round.you.x > 75, 3000);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false, "the garlic is spent");
});

test("Ghoul Rush's Code Blue keeps its state in the shared slot and puts it back if another pack's place clears it", () => {
  const round = gurneyRound();
  const c = round.runner;
  assert.equal(c.pack, "codeblue");
  round.runner = null;
  run(round, 40);
  assert.equal(round.runner, c, "put back");
  // Another ride's state is left alone.
  round.runner = { pack: "other", done: false };
  gn.GURNEY.place[0]({ ...round, spec: { ...round.spec, ride: null } }, {});
  assert.equal(round.runner.pack, "other");
});

/* ------------------------------------------------------ voices and names */

test("Ghoul Rush's Code Blue: every event has a voice that plays, every cause has words and a sound, and every tone exists and is at most 1.2 s", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...gn.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = GURNEY_VOICES[kind] && GURNEY_VOICES[kind][act];
    assert.ok(name && tones[name], `${event} has a ${kind}.${act} voice that exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "stand", points: 50, flat: false }).played;
    assert.ok(played.includes(name), `${event} plays ${name}`);
  }
  for (const name of Object.values(GURNEY_VOICES).flatMap((v) => Object.values(v))) {
    for (const layer of tones[name].layers) assert.ok((layer.delay || 0) + layer.seconds <= 1.2, `${name} fits in 1.2 s`);
  }
  for (const cause of ["wheelchair", "ivstand", "overhead", "lunged", "elevator"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "blueJump" }).played.length, 1);
  assert.equal(heard({ type: "blueLamp", points: 150 }).played.length, 1);
});

test("Ghoul Rush's Code Blue: the room's own names do not collide with the game's (events, kinds, tones, causes)", () => {
  for (const e of gn.EVENTS) assert.ok(e.startsWith("blue"), e);
  const other = new Set([...ct.EVENTS]);
  for (const e of gn.EVENTS) assert.ok(!other.has(e), `${e} is Code Blue's alone`);
  assert.deepEqual(Object.keys(gn.GURNEY).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  for (const kind of Object.keys(GURNEY_VOICES)) assert.ok(!(kind in ghoul.MONSTERS), `${kind} is no monster kind`);
  for (const cause of Object.keys(LOSE_WORDS)) assert.ok(!(cause in ghoul.MONSTERS), `${cause} is no monster kind`);
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Code Blue draws: the corridors in the lit, the countdown and the dark, each thing (wheelchairs parked and rolling, IV stands, lamps and doors overhead, doorways in each state, surge lamps whole and shot), the monitor at every heart count, a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["sanatorium"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "codeblue") through(r);
  r.lives = 99;
  const w0 = R.waves[0][0];
  const spots = [ROOM.start + 40, R.stands[0][0] - 10, R.lows[0][0] - 5, R.lows[1][0] - 5, R.orderlies[0][0] - 20, R.chairs[0][0] - 30, R.checks[0], lines[0].x1 - 10, w0 - 60, w0 - 20, w0 + 30, R.waves[0][1] - 5, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      const top = ct.linesAt(R, x)[0] || [lines.length - 1, 20];
      gurneyAt(r, x, top[0], { safe: true });
      r.runner.orderlies = r.runner.orderlies.map((o, i) => ({ ...o, state: ["door", "warn", "up", "sink", "broken", "spent"][i % 6], t: 600 }));
      r.runner.chairs = r.runner.chairs.map((c, i) => ({ ...c, rolling: i % 2 === 0, x: c.x - (i % 2 === 0 ? 7 : 0) }));
      r.runner.lamps = r.runner.lamps.map((_, i) => i % 3 === 0);
      r.runner.phase = ["lit", "warn", "dark"][spots.indexOf(x) % 3];
      r.runner.n = 1 + (spots.indexOf(x) % 3);
      r.runner.dark = 1;
      for (const air of [false, true]) {
        for (const hearts of [5, 3, 1]) {
          r.bonusRound.hearts = hearts;
          if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
          if (air) r.runner.line = -1;
          r.you.ducking = x === R.lows[0][0] - 5 && !air;
          r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: -10, gone: 0 });
          for (let k = 0; k < 3; k++) g.tick(16);
          r.monsters.length = 0;
          r.you.safeMs = 1e9;
          gurneyAt(r, x, top[0], { safe: true });
        }
      }
    }
  }
  assert.equal(r.spec.id, "codeblue");
  r.bonusRound.hearts = 5;
  // A crash, then the finish and the won and lost cards.
  r.you.safeMs = 0;
  gurneyAt(r, R.stands[0][0] - 3, R.stands[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["sanatorium"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "codeblue") through(d);
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
  const at = ghoul.STAGES.findIndex((s) => s.id === "sanatorium");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "codeblue");
  assert.equal(p.runner.line, 0);
  assert.equal(p.you.y, ct.trackY(R, 0, ROOM.start));
  pick.tick(16);
});

test("Ghoul Rush's Code Blue is dark where the rules say: dim follows the phase (none lit, a flicker in the countdown, the dark's fade), and the lights keep the monitor's band, the lamps and the checkpoints lit", () => {
  const art = gurneyArt({ say() {}, label() {}, ellipse() {}, GOLD: "#fff", EYE_PALE: "#fff" });
  const round = gurneyRound();
  const c = round.runner;
  const view = (clock = 1000) => ({ round, spec: round.spec, clock, fx: { clock }, g: { FIELD_W: 96, FIELD_H: 54 } });
  const sweep = (phase, n, dark) => {
    Object.assign(c, { phase, n, dark });
    const out = [];
    for (let clock = 0; clock < 3000; clock += 35) out.push(art.dim(view(clock)));
    return out;
  };
  assert.ok(sweep("lit", 0, 0).every((d) => d === 0), "no dim in the lit");
  for (const n of [3, 2, 1]) {
    const f = sweep("warn", n, 0);
    assert.ok(f.some((d) => d === 0) && f.some((d) => d > 0.5), `a flicker at ${n}`);
    assert.ok(f.every((d) => d === 0 || d <= 0.9), "never full dark in the countdown");
  }
  const flickers = [3, 2, 1].map((n) => sweep("warn", n, 0).filter((d) => d > 0).length);
  assert.ok(flickers[0] < flickers[2], `the flicker thickens as the count falls: ${flickers.join(",")}`);
  assert.equal(art.dim(view()) >= 0, true);
  Object.assign(c, { phase: "dark", n: 0, dark: 1 });
  assert.ok(art.dim(view()) > 0.9, "pitch black");
  c.dark = 0.5;
  assert.ok(art.dim(view()) > 0.4 && art.dim(view()) < 0.6, "fading");
  // In another room there is no dim and no lights.
  const other = { round: { ...round, runner: null }, spec: { ...round.spec, ride: null }, clock: 0, fx: { clock: 0 } };
  assert.equal(art.dim(other), 0);
  const none = [];
  art.lights(other, (...p) => none.push(p));
  assert.equal(none.length, 0);
  // In the dark: the monitor's band, a pool on every near thing, the strips; a surge lamp is lit always.
  Object.assign(c, { phase: "dark", n: 0, dark: 1, wave: 0 });
  round.camX = R.waves[0][0] - 20;
  Object.assign(round.you, { x: R.waves[0][0] + 10, y: 15 });
  const darkLights = [];
  art.lights(view(), (x, y, r, a) => darkLights.push({ x, y, r, a }));
  assert.ok(darkLights.filter((l) => l.y > 40 && l.r >= 20).length >= 3, "the monitor's band stays lit");
  assert.ok(darkLights.length > 8, "strips and pools");
  Object.assign(c, { phase: "lit", n: 0, dark: 0, wave: -1 });
  const litLights = [];
  art.lights(view(), (x, y, r, a) => litLights.push({ x, y, r, a }));
  assert.ok(litLights.length < darkLights.length, "fewer pools when lit");
  assert.ok(darkLights.every((l) => l.a > 0 && l.a <= 1 && l.r > 0));
});

/* ----------------------------------------------------------- the bots */

// A bot that dodges well: it jumps at the end of a line (not the ramp), 9 to 15 short of a wheelchair, a stand or an orderly,
// ducks under every low, and fires only at targets (the blaster overheats if held). `miss` is the share of things it fails to dodge (by a hash). With `lamps` it
// also hops when a surge lamp is 20 to 60 ahead, to shoot it out.
const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
function goodBot(round, seed, { miss = 0.04, lamps = false } = {}) {
  const { you, runner: c, input: inp } = round;
  inp.left = inp.right = inp.down = false;
  inp.fire = false;
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
    R.chairs.forEach(([x0], i) => {
      if (ahead(c.chairs[i].x) && ok(x0)) jump = true;
    });
    for (const [x] of R.stands) if (ahead(x) && ok(x)) jump = true;
    R.orderlies.forEach(([x], i) => {
      if (c.orderlies[i].state !== "broken" && ahead(x) && ok(x)) jump = true;
    });
    for (const [x0, x1] of R.lows) if (you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
    // The blaster overheats if held, so it fires only at a target: an orderly stirring, a surge lamp to shoot out.
    R.orderlies.forEach(([x], i) => {
      if ((c.orderlies[i].state === "warn" || c.orderlies[i].state === "up") && x - you.x > 0 && x - you.x < 50) inp.fire = true;
    });
    if (lamps) {
      R.lamps.forEach(([x], i) => {
        if (c.lamps[i] || x - you.x < 0 || x - you.x > 60) return;
        inp.fire = true;
        if (x - you.x > 42 && x - you.x < 46 && !inp.down) jump = true;
      });
    }
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
  const round = gurneyRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the gurney stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Code Blue: a bot that dodges well finishes the whole way in 60 to 75 seconds, 6 to 9 dice, a few hearts lost at most, past every checkpoint", () => {
  const dice = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed, { lamps: seed % 2 === 0 }));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 78000, `${ms} ms`);
    assert.ok(b.dice >= 5 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.equal(round.lives, 3, "never a run life");
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 6, `${dice.join(",")}`);
});

test("Ghoul Rush's Code Blue: a bot that hops to shoot the surge lamps keeps the corridors lit (waves called off) and a bot that does not rides through every blackout", () => {
  const lit = rideWith(2, (r) => goodBot(r, 2, { miss: 0, lamps: true }));
  assert.equal(lit.round.bonusRound.won, true);
  const lampsShot = lit.round.bonusRound.perf.acts;
  assert.ok(lampsShot >= 4, `${lampsShot} acts`);
  // The blind way: it never shoots a lamp, the lights go out six times, and it still gets through.
  const seen = { dark: 0, warn: 0 };
  const round = gurneyRound(3);
  for (let t = 0; t < 100000 && round.phase !== "clear"; t += 16) {
    goodBot(round, 3, { miss: 0 });
    round.input.fire = false;
    if (round.runner && round.runner.done) round.input.right = true;
    ghoul.advance(round, 16, steady);
    seen.dark += events(round, "blueDark").length;
    seen.warn += events(round, "blueWarn").length;
    round.events.length = 0;
  }
  assert.equal(seen.dark, R.waves.length, "six blackouts");
  assert.equal(seen.warn, R.waves.length * 3, "a 3, 2, 1 each");
  assert.equal(round.bonusRound.won, true);
});

test("Ghoul Rush's Code Blue: a bot that never dodges (holding fire) loses all five hearts before the first third, ends with 0 dice and the run goes on", () => {
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

test("Ghoul Rush's Code Blue telegraphs: DUCK over lamps and doors, JUMP over shafts, wheelchairs and stands, SHOOT over the surge lamps, none for orderlies, words only on the first of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  const answers = { shaft: "JUMP", chair: "JUMP", stand: "JUMP", lamp: "DUCK", door: "DUCK", surge: "SHOOT" };
  assert.equal(marks.length, (lines.length - 1) + R.chairs.length + R.stands.length + R.lows.length + R.lamps.length, "one per jumped, ducked or shot-for-light thing, none for orderlies");
  for (const m of marks) assert.equal(m.answer, answers[m.kind], m.kind);
  const first = R.lows.find((l) => !l[3]);
  const m = marks.find((q) => q.x === (first[0] + first[1]) / 2);
  const alphaOf = (x) => (telegraphs(R, x).find((t) => t.kind === "lamp" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = [m.lead - 45, m.lead - 36, m.lead - 30, m.lead - 10, m.lead + 3, m.lead + 7].map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[1] > 0 && a[1] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[2], 1);
  assert.equal(a[3], 1);
  assert.ok(a[4] > 0 && a[4] < 1, "fading as it passes");
  assert.equal(a[5], 0, "gone once passed");
  assert.deepEqual(JSON.parse(JSON.stringify(telegraphs(R, 100))), JSON.parse(JSON.stringify(telegraphs(R, 100))));
  for (const kind of ["shaft", "chair", "stand", "lamp", "door"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 3, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32).find((t) => t.lead === q.lead);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
  const surge = telegraphs(R, R.lamps[0][0] - 24 - 32).find((t) => t.kind === "surge");
  assert.equal(surge.answer, "SHOOT");
});

test("Ghoul Rush's Code Blue's intro banner says the controls plainly", () => {
  assert.match(R.how, /UP to jump, DOWN to duck/);
});
