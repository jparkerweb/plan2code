// Web console tests, Ghoul Rush's Midnight Hearse (the Graveyard's bonus round, between the Mausoleum Row and Angel's Rest): its shape (two lanes, the gates, every thing spaced for a player, the closed stretches with a gate before each), the hearse's motion (a steady speed, a jump, a duck, a hop between lanes only at a gate), each obstacle and its cost (grave, headstone, cross, branch, hand, crow, wreck), the lamp and its lanterns, the coffins thrown out and the ghouls that sit up in them, the hearts and the grade and the dice, endless lives, the drawing and the sounds, and bots that play it.
// Run with: node --test scripts/test-web-console-activities-ghoul-hearse.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as hz from "../src/web-console/public/activities/ghoul-rush/rides/hearse/ghoul-hearse.js";
import { ANSWERS, EVENT_VOICE, LOOKS as HEARSE_LOOKS, LOSE_SOUNDS, LOSE_WORDS, VOICES as HEARSE_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-rush/rides/hearse/ghoul-hearse-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { HEARSE_SFX } from "../src/web-console/public/activities/ghoul-rush/rides/hearse/ghoul-sfx-hearse.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the hearse drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Midnight Hearse reached the way play reaches it, nothing woken, the clocks long,
// the bonus round on (five hearts).
function hearseRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["graveyard"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "hearse") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "hearse", time: 1e9, finish: 1e6, gates: [], graves: [], stones: [], lows: [], hands: [], crows: [], blocks: [], lanterns: [], fog: [], checks: [] };
// The same round over a ride of its own (a plain road to measure the hearse on).
function synth(ride) {
  const round = hearseRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 1e6, 9]], ride: { ...NONE, ...ride } };
  round.runner = null;
  hz.HEARSE.place[0](round, {});
  return round;
}

// The hearse at `x` in `lane`, on the road.
function at(round, x, lane = 0, { safe = false } = {}) {
  Object.assign(round.runner, { lane, from: lane, swMs: 0, h: 0, vy: 0, air: false });
  Object.assign(round.you, { x, y: hz.LANE_Y[lane], vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
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
  react({ x: 10, y: 9, tx: 20, ty: 9, ...e }, kit);
  return { played };
};

const ROOM = ghoul.roomById("hearse");
const R = ROOM.ride;
const V = hz.HEARSE_V;
// Where each kind of thing is met by a hearse in its lane: a crow meets it before the perch it flies from.
const CROW_MEET = hz.CROW_NEAR - (hz.CROW_NEAR * V) / (V + hz.CROW_V);
const things = () => [
  ...R.graves.map(([x, lane], i) => ({ id: `g${i}`, kind: "grave", lane, x })),
  ...R.stones.map(([x, lane, kind], i) => ({ id: `s${i}`, kind: kind ? "cross" : "stone", lane, x })),
  ...R.lows.map(([x0, x1, lane], i) => ({ id: `l${i}`, kind: "low", lane, x: (x0 + x1) / 2 })),
  ...R.hands.map(([x, lane], i) => ({ id: `h${i}`, kind: "hand", lane, x: x - 6 })),
  ...R.crows.map(([x, lane], i) => ({ id: `c${i}`, kind: "crow", lane, x: x - CROW_MEET })),
];

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Midnight Hearse is the Graveyard's fourth room, between the Mausoleum Row and Angel's Rest: lit, no key, no boss, a ride about 60 to 70 seconds long, a bonus round that plays its own track", () => {
  const st = ghoul.stageById("graveyard");
  assert.deepEqual(st.rooms, ["lychgate", "graves", "mausoleums", "hearse", "angel"]);
  assert.equal(st.boss, "angel");
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Midnight Hearse", "Everyone else is already dead on time"]);
  assert.equal(ROOM.dark, false, "a moonlit night, always lit");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "hearse");
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3000, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.hearse, "ghoulHearseRide");
  assert.ok(ghoulSfx.default.music.ghoulHearseRide, "its own track");
  assert.deepEqual(Object.keys(hz.HEARSE.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.hearse, HEARSE_LOOKS.hearse);
  assert.equal(LOOKS.hearse.pack, "hearse");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.graves) && Object.isFrozen(R.graves[0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0 && ROOM.items.length === 0, "no monsters or pickups: the things on the road are the pack's own");
  // One flat road; the door past the finish.
  assert.deepEqual(ROOM.ground.map((g) => g.slice()), [[0, ROOM.length, hz.LANE_Y[0]]]);
  assert.ok(R.finish < ROOM.door && ROOM.door > ROOM.length - 20, "the door at the room's end, past the finish");
  assert.ok(ghoul.groundAt(ROOM, ROOM.door - 2) > -Infinity, "floor to walk out on");
  const secs = (R.finish - ROOM.start) / V;
  assert.ok(secs >= 58 && secs <= 72, `${secs.toFixed(1)} s at HEARSE_V`);
  assert.equal(ghoul.timeFor(ROOM), R.time, "its own clock");
  assert.ok(R.time / 1000 > secs * 1.4, "a clock with room to spare");
  assert.deepEqual(ghoul.STAGES.find((s) => s.id === "graveyard").rooms.length, 5);
  // The numbers of the course.
  assert.equal(R.gates.length, 13);
  assert.equal(R.blocks.length, 5);
  assert.equal(R.checks.length, 6);
  assert.ok(R.fog.length >= 3);
  assert.ok(R.hands.length >= 6 && R.crows.length >= 6, "enough to shoot");
});

test("Ghoul Rush's Midnight Hearse: every thing is in lane 0 or 1, off the ends, spaced for a player, and clear of the lane gates", () => {
  const all = things();
  assert.ok(all.length >= 36 && all.length <= 56, `${all.length} things`);
  for (const t of all) {
    assert.ok(t.lane === 0 || t.lane === 1, `${t.id} lane`);
    assert.ok(t.x >= 120 && t.x < R.finish - 40, `${t.id} at ${t.x}`);
  }
  for (const kind of ["grave", "stone", "cross", "low", "hand", "crow"]) assert.ok(all.some((t) => t.kind === kind), `a ${kind}`);
  for (const lane of [0, 1]) assert.ok(all.filter((t) => t.lane === lane).length >= 18, `plenty in lane ${lane}`);
  // The same lane: 36 between any two (a jump and a duck need 38, a jump and a jump 22).
  for (const lane of [0, 1]) {
    const xs = all.filter((t) => t.lane === lane).map((t) => t.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 36, `lane ${lane}: ${xs[i - 1]} and ${xs[i]}`);
  }
  // Gates: 16 wide, in order, and nothing within the hop of one.
  R.gates.forEach(([a, b], i) => {
    assert.equal(b - a, 16);
    if (i) assert.ok(a - R.gates[i - 1][1] >= 150, "gates are spaced out");
    for (const t of all) assert.ok(t.x < a - 6 || t.x > b + 22, `${t.id} at ${t.x} is near the gate ${a}`);
  });
  // A low's width and its mouth: 6 wide.
  for (const [x0, x1] of R.lows) assert.equal(x1 - x0, 6);
  // Hands and crows sit clear of every kind of block too.
  assert.ok(R.hands.every(([x]) => x > R.gates[0][1]) && R.crows.every(([x]) => x > R.gates[0][1]));
});

test("Ghoul Rush's Midnight Hearse: each closed stretch has a lane gate well before it, nothing else stands in its lane near it, and the road is open in the other lane", () => {
  const all = things();
  for (const [x0, x1, lane] of R.blocks) {
    assert.ok(x1 - x0 >= 24 && x1 - x0 <= 40, `a block ${x1 - x0} long (the safe blink must outlast it)`);
    assert.ok((x1 - x0 + 2.4) / V * 1000 < 1800, "the blink after a wreck covers the stretch");
    const gate = R.gates.filter(([, b]) => b + 22 <= x0).at(-1);
    assert.ok(gate, "a gate ends 22 or more short of it");
    assert.ok(x0 - gate[1] <= 70, "the gate is close enough to see the stretch from");
    for (const t of all.filter((q) => q.lane === lane)) assert.ok(t.x < x0 - 18 || t.x > x1 + 18, `${t.id} at ${t.x} is in the way of the block at ${x0}`);
    assert.ok(!R.checks.some((x) => x > x0 - 4 && x < x1 + 4), "no checkpoint inside it");
  }
  // They alternate lanes, so a hearse that goes round each is switched back and forth.
  assert.deepEqual(R.blocks.map(([, , lane]) => lane), [0, 1, 0, 1, 0]);
});

test("Ghoul Rush's Midnight Hearse: the lanterns, the fog and the checkpoints are set where they can be used", () => {
  const all = things();
  assert.ok(R.lanterns.length >= 24);
  assert.ok(R.lanterns.filter(([, l]) => l === 0).length > R.lanterns.filter(([, l]) => l === 1).length * 2, "mostly on the road");
  assert.ok(R.lanterns.some(([, l]) => l === 1), "a few on the verge");
  for (const [x, lane] of R.lanterns) {
    assert.ok(all.filter((t) => t.lane === lane).every((t) => Math.abs(t.x - x) >= 12), `the lantern at ${x} is clear of the things`);
    assert.ok(R.blocks.every(([x0, x1, l]) => l !== lane || x < x0 - 10 || x > x1 + 10), "and of the blocks");
  }
  R.checks.forEach((x, i) => {
    if (i) assert.ok(x - R.checks[i - 1] >= 350);
    assert.ok(R.gates.every(([a, b]) => x < a - 4 || x > b + 4));
  });
  for (const [a, b] of R.fog) assert.ok(b - a >= 100 && b - a <= 200);
  // Souls along both lanes, and over the things.
  const rows = ROOM.candy;
  assert.ok(rows.length * 3 >= 200, `${rows.length * 3} souls`);
  assert.ok(rows.some(([, y]) => y < 12) && rows.some(([, y]) => y > 15 && y < 20), "souls in both lanes");
});

/* -------------------------------------------------------------- the hearse */

function k() {
  return { HIT_W: ghoul.HIT_W, HIT_H: ghoul.HIT_H, DUCK_H: ghoul.DUCK_H };
}

test("Ghoul Rush's Midnight Hearse rolls at HEARSE_V whatever is pressed, on a road with nothing on it, and the camera leads it", () => {
  const round = synth({});
  assert.equal(round.runner.id, "hearse");
  assert.equal(round.camLead, hz.CAM_AHEAD);
  assert.equal(round.you.y, hz.LANE_Y[0]);
  const x0 = round.you.x;
  run(round, 1000);
  assert.ok(Math.abs(round.you.x - x0 - V) < 0.5, `${round.you.x - x0} in a second`);
  for (const keys of [{ left: true }, { down: true }, { fire: true }]) {
    const a = round.you.x;
    run(round, 500, keys);
    assert.ok(Math.abs(round.you.x - a - V / 2) < 0.5, `${JSON.stringify(keys)}`);
  }
  assert.equal(round.you.face, 1);
  // Left and right do nothing off a gate.
  run(round, 400, { right: true });
  assert.equal(round.runner.lane, 0);
  assert.equal(round.you.y, hz.LANE_Y[0]);
});

test("Ghoul Rush's Midnight Hearse jumps about 13 high for about three quarters of a second, a press saved for a landing jumps on it, and it cannot jump in the air", () => {
  const round = synth({});
  let peak = 0;
  let ms = 0;
  press(round);
  for (let t = 0; t < 1200; t += 4) {
    ghoul.advance(round, 4, steady);
    round.input.up = false;
    if (round.runner.air) {
      peak = Math.max(peak, round.you.y - hz.LANE_Y[0]);
      ms += 4;
    } else if (ms) break;
  }
  assert.ok(peak > 12 && peak < 15, `${peak} high`);
  assert.ok(ms > 650 && ms < 850, `${ms} ms in the air`);
  assert.equal(events(round, "hearseJump").length, 1);
  assert.equal(events(round, "hearseLand").length, 1);
  assert.equal(round.you.y, hz.LANE_Y[0]);
  assert.equal(round.you.state, "run");
  // The reach: about 31 units across.
  const fresh = synth({});
  const x0 = fresh.you.x;
  press(fresh);
  ghoul.advance(fresh, 4, steady);
  fresh.input.up = false;
  until(fresh, () => fresh.runner.air === false, 2000);
  assert.ok(fresh.you.x - x0 > 28 && fresh.you.x - x0 < 34, `${fresh.you.x - x0} across`);
  // A press in the air waits for the landing and jumps then.
  const late = synth({});
  press(late);
  ghoul.advance(late, 4, steady);
  until(late, () => late.you.vy < -60, 2000);
  press(late);
  late.events.length = 0;
  until(late, () => events(late, "hearseJump").length > 0, 2000);
  assert.equal(events(late, "hearseLand").length, 1, "landed first");
  assert.equal(events(late, "hearseJump").length, 1);
});

test("Ghoul Rush's Midnight Hearse: down ducks (up jumps instead of ducking), a ducked Planny passes under a low and a standing one hits it (cause branch), at the cost of a heart", () => {
  const ride = { lows: [[300, 306, 0, 0], [500, 506, 0, 1]] };
  const stand = synth(ride);
  at(stand, 285, 0);
  const lose = [];
  until(stand, () => stand.events.some((e) => e.type === "lose"), 1500);
  for (const e of stand.events) if (e.type === "lose") lose.push(e.cause);
  assert.deepEqual(lose, ["branch"]);
  assert.equal(stand.bonusRound.hearts, 4);
  assert.equal(stand.lives, 3, "a heart, not a life");
  assert.equal(events(stand, "hearseCrash")[0].what, "low");
  const duck = synth(ride);
  at(duck, 285, 0);
  run(duck, 1000, { down: true });
  assert.equal(duck.bonusRound.hearts, 5, "ducked under it");
  assert.ok(events(duck, "hearseDuck").length >= 1);
  assert.equal(duck.you.ducking, true, "still ducking");
  // The arch is the same.
  const arch = synth(ride);
  at(arch, 485, 0);
  run(arch, 1000, { down: true });
  assert.equal(arch.bonusRound.hearts, 5);
  // The underside is between a ducked box and a standing one.
  assert.ok(hz.LOW_Y > ghoul.DUCK_H && hz.LOW_Y < ghoul.HIT_H);
  // A jump over a low hits it too (the box rises into it).
  const hop = synth(ride);
  at(hop, 288, 0);
  press(hop);
  run(hop, 600);
  assert.ok(hop.bonusRound.hearts < 5);
  // On the verge a low is on the verge: the same underside over its lane.
  const verge = synth({ lows: [[300, 306, 1, 0]] });
  at(verge, 285, 1);
  run(verge, 800);
  assert.equal(verge.bonusRound.hearts, 4);
  const vduck = synth({ lows: [[300, 306, 1, 0]] });
  at(vduck, 285, 1);
  run(vduck, 800, { down: true });
  assert.equal(vduck.bonusRound.hearts, 5);
});

test("Ghoul Rush's Midnight Hearse: an open grave swallows a hearse that does not jump (cause grave), a headstone and a fallen cross likewise (tomb and cross); a jump clears each; each costs only once", () => {
  const ride = { graves: [[300, 0]], stones: [[400, 0, 0], [500, 0, 1]] };
  for (const [x, cause, what] of [[285, "grave", "grave"], [385, "tomb", "stone"], [485, "cross", "cross"]]) {
    const round = synth(ride);
    at(round, x, 0);
    run(round, 1000);
    assert.equal(round.bonusRound.hearts, 4, cause);
    assert.deepEqual(round.bonusRound.perf.hits.length, 1);
    assert.equal(events(round, "hearseCrash").length, 1, "once: the blink after a hit covers the rest of it");
    assert.equal(events(round, "hearseCrash")[0].what, what);
    assert.equal(round.lives, 3);
    const jumped = synth(ride);
    at(jumped, x, 0);
    // Jump 10 short, the way a player does.
    run(jumped, 40);
    press(jumped);
    run(jumped, 40);
    jumped.input.up = false;
    run(jumped, 1400);
    assert.equal(jumped.bonusRound.hearts, 5, `${cause} cleared`);
  }
  // The causes reach the lose event.
  const g = synth(ride);
  at(g, 285, 0);
  run(g, 800);
  assert.equal(events(g, "lose")[0].cause, "grave");
  // A grave in the other lane, or one the hearse has passed over by a jump from the verge, does nothing.
  const other = synth({ graves: [[300, 1]] });
  at(other, 285, 0);
  run(other, 1000);
  assert.equal(other.bonusRound.hearts, 5);
  // An obstacle cleared at every jump distance in its window: 7 to 24 short for a grave, 6 to 25 for a headstone.
  for (const d of [8, 12, 16, 20, 24]) {
    const w = synth({ graves: [[300, 0]], stones: [[400, 0, 0]] });
    at(w, 300 - d, 0);
    press(w);
    run(w, 20);
    w.input.up = false;
    run(w, 1000);
    assert.equal(w.bonusRound.hearts, 5, `jumped ${d} short of the grave`);
  }
  for (const d of [8, 12, 16, 20, 24]) {
    const w = synth({ stones: [[400, 0, 0]] });
    at(w, 400 - d, 0);
    press(w);
    run(w, 20);
    w.input.up = false;
    run(w, 1000);
    assert.equal(w.bonusRound.hearts, 5, `jumped ${d} short of the headstone`);
  }
});

test("Ghoul Rush's Midnight Hearse switches lanes only inside a gate: LEFT is the road, RIGHT the verge, in SWITCH_MS, with no jump or duck in the hop; things in the other lane do not touch it", () => {
  const ride = { gates: [[300, 316]], graves: [[330, 0]], stones: [[330, 1, 0]] };
  const round = synth(ride);
  at(round, 280, 0);
  run(round, 200, { right: true });
  assert.equal(round.runner.lane, 0, "not yet at the gate");
  assert.equal(round.you.y, hz.LANE_Y[0]);
  run(round, 400, { right: true });
  assert.ok(round.you.x > 300);
  assert.equal(round.runner.lane, 1);
  assert.equal(events(round, "hearseSwitch").length, 1);
  assert.equal(events(round, "hearseSwitch")[0].to, 1);
  // It climbs across the switch time, with a small hop, and ends on the verge.
  const ys = [];
  const switching = synth(ride);
  at(switching, 301, 0);
  switching.input.right = true;
  for (let t = 0; t < hz.SWITCH_MS + 40; t += 4) {
    ghoul.advance(switching, 4, steady);
    ys.push(switching.you.y);
  }
  switching.input.right = false;
  assert.ok(ys.every((y, i) => !i || y >= ys[i - 1] - 0.5), "rising");
  assert.ok(Math.max(...ys) > hz.LANE_Y[1] - 0.2, "up on the verge");
  assert.equal(switching.you.y, hz.LANE_Y[1]);
  assert.equal(switching.runner.swMs, 0);
  // And back with LEFT, in a gate again.
  const back = synth({ gates: [[300, 316]] });
  at(back, 301, 1);
  run(back, hz.SWITCH_MS + 40, { left: true });
  assert.equal(back.runner.lane, 0);
  assert.equal(back.you.y, hz.LANE_Y[0]);
  // Pressing the lane it is in does nothing; both at once do nothing.
  const same = synth({ gates: [[300, 316]] });
  at(same, 301, 0);
  run(same, 300, { left: true });
  assert.equal(events(same, "hearseSwitch").length, 0);
  run(same, 200, { left: true, right: true });
  assert.equal(events(same, "hearseSwitch").length, 0);
  // Not in the air.
  const air = synth({ gates: [[300, 400]] });
  at(air, 301, 0);
  press(air);
  run(air, 40);
  run(air, 100, { right: true });
  assert.equal(air.runner.lane, 0, "in the air");
  run(air, 900, { right: true });
  assert.equal(air.runner.lane, 1, "once down");
  // In the hop no jump, and the hearse stays down.
  const hop = synth({ gates: [[300, 316]] });
  at(hop, 301, 0);
  hop.input.right = true;
  press(hop);
  run(hop, 100);
  assert.equal(events(hop, "hearseJump").length, 0);
  // A lane's own things only touch the hearse in that lane: the grave in lane 0 is nothing to a hearse on the verge.
  const verge = synth(ride);
  at(verge, 301, 0);
  verge.input.right = true;
  run(verge, 1400);
  verge.input.right = false;
  assert.equal(verge.runner.lane, 1);
  assert.ok(verge.bonusRound.hearts >= 4);
  assert.equal(verge.bonusRound.perf.hits.includes("g0"), false, "the grave in the road did not hit the hearse on the verge");
});

test("Ghoul Rush's Midnight Hearse: a closed stretch throws the hearse across into the other lane (cause wreck), a heart lighter, once; going round by the gate costs nothing; a blinking hearse is thrown for free", () => {
  const ride = { gates: [[100, 116]], blocks: [[200, 232, 0]] };
  const smash = synth(ride);
  at(smash, 180, 0);
  run(smash, 1200);
  assert.equal(smash.bonusRound.hearts, 4);
  assert.equal(events(smash, "lose")[0].cause, "wreck");
  assert.equal(smash.runner.lane, 1, "thrown across");
  assert.equal(smash.you.y, hz.LANE_Y[1]);
  assert.equal(events(smash, "hearseCrash").length, 1);
  assert.equal(events(smash, "hearseCrash")[0].what, "wreck");
  assert.equal(smash.bonusRound.perf.hits.join(), "b0");
  // Round by the gate: nothing.
  const round = synth(ride);
  at(round, 96, 0);
  round.input.right = true;
  until(round, () => round.you.x > 117, 1000);
  round.input.right = false;
  until(round, () => round.you.x > 240, 4000);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.runner.lane, 1);
  assert.ok(round.you.x > 240, "through the stretch");
  // On the verge the stretch is in the road's lane, so nothing happens either; and a verge block is the verge's.
  const verge = synth({ blocks: [[200, 232, 1]] });
  at(verge, 180, 1);
  run(verge, 1200);
  assert.equal(verge.runner.lane, 0);
  assert.equal(verge.bonusRound.hearts, 4);
  // Blinking safe: thrown, no heart.
  const safe = synth(ride);
  at(safe, 180, 0, { safe: true });
  run(safe, 1200);
  assert.equal(safe.runner.lane, 1);
  assert.equal(safe.bonusRound.hearts, 5);
  assert.equal(safe.runner.coffins, hz.COFFINS, "no heart, no coffin");
});

test("Ghoul Rush's Midnight Hearse: a hand in a mound stirs when the hearse is HAND_NEAR short, shivers, reaches up for HAND_UP_MS, grabs (cause grasp) if you meet it, and sinks; a jump clears it", () => {
  const ride = { hands: [[300, 0]] };
  const round = synth(ride);
  at(round, 300 - hz.HAND_NEAR - 2, 0, { safe: true });
  run(round, 40);
  assert.equal(round.runner.hands[0].state, "mound");
  run(round, 100);
  assert.equal(round.runner.hands[0].state, "warn");
  assert.equal(events(round, "hearseHandWarn").length, 1);
  run(round, hz.HAND_WARN_MS);
  assert.equal(round.runner.hands[0].state, "up");
  assert.equal(events(round, "hearseHandUp").length, 1);
  // It grabs a hearse that meets it, and sinks.
  const grab = synth(ride);
  at(grab, 270, 0);
  run(grab, 1500);
  assert.equal(grab.bonusRound.hearts, 4);
  assert.equal(events(grab, "lose")[0].cause, "grasp");
  assert.equal(grab.runner.hands[0].state === "sink" || grab.runner.hands[0].state === "spent", true);
  // A jump over it.
  const hop = synth(ride);
  at(hop, 300 - 24, 0);
  run(hop, 100);
  press(hop);
  run(hop, 40);
  hop.input.up = false;
  run(hop, 1500);
  assert.equal(hop.bonusRound.hearts, 5, "jumped it");
  // It rises and sinks on a timer when nothing is near: HAND_UP_MS up, then HAND_SINK_MS.
  const timed = synth(ride);
  at(timed, 300 - hz.HAND_NEAR + 1, 0, { safe: true });
  timed.you.x = 300 - hz.HAND_NEAR + 1;
  run(timed, 50);
  run(timed, hz.HAND_WARN_MS + hz.HAND_UP_MS + hz.HAND_SINK_MS + 100);
  assert.equal(timed.runner.hands[0].state, "spent");
});

test("Ghoul Rush's Midnight Hearse: one bolt breaks a flying crow (80 points), a perched one too, HAND_HP bolts a hand (100 points), each for the grade's acts; a crow hits a standing hearse (cause crow), a ducked one passes under it", () => {
  const ride = { crows: [[320, 0, 2.6]], hands: [[500, 0]] };
  // A crow wakes CROW_NEAR short of its perch and flies back at CROW_V.
  const round = synth(ride);
  at(round, 320 - hz.CROW_NEAR + 2, 0, { safe: true });
  run(round, 100);
  assert.equal(round.runner.crows[0].state, "fly");
  assert.equal(events(round, "hearseCrowWake").length, 1);
  const x1 = round.runner.crows[0].x;
  run(round, 500);
  assert.ok(Math.abs(x1 - round.runner.crows[0].x - hz.CROW_V * 0.5) < 0.3, "flying back at CROW_V");
  // It hits a hearse that stands, and misses one that ducks.
  const hit = synth(ride);
  at(hit, 320 - 50, 0);
  run(hit, 1600);
  assert.equal(hit.bonusRound.hearts, 4);
  assert.equal(events(hit, "lose")[0].cause, "crow");
  const duck = synth(ride);
  at(duck, 320 - 50, 0);
  run(duck, 1600, { down: true });
  assert.equal(duck.bonusRound.hearts, 5, "ducked under it");
  // Shot: one bolt, the points, the grade's act.
  const shot = synth(ride);
  at(shot, 320 - 50, 0);
  const score = shot.score;
  run(shot, 1600, { fire: true });
  assert.equal(shot.bonusRound.hearts, 5, "shot before it arrived");
  assert.equal(shot.runner.crows[0].state, "broken");
  assert.equal(shot.score - score >= hz.CROW_POINTS, true);
  assert.equal(shot.bonusRound.perf.acts, 1);
  assert.equal(events(shot, "hearseCrowHit")[0].points, hz.CROW_POINTS);
  // A hand takes two bolts.
  const hand = synth(ride);
  at(hand, 500 - 30, 0, { safe: true });
  const before = hand.score;
  run(hand, 700, { fire: true });
  assert.equal(events(hand, "hearseHandHit").length, 1);
  assert.equal(events(hand, "hearseHandBreak").length, 1);
  assert.equal(hand.runner.hands[0].state === "broken", true);
  assert.equal(hand.score - before >= hz.HAND_POINTS, true);
  assert.equal(hand.bonusRound.perf.acts, 1);
  // A bolt in the other lane misses.
  const lane = synth({ crows: [[320, 1, 2.6]] });
  at(lane, 320 - 50, 0, { safe: true });
  run(lane, 1200, { fire: true });
  assert.notEqual(lane.runner.crows[0].state, "broken");
});

test("Ghoul Rush's Midnight Hearse: the lamp burns down LAMP_DRAIN a second (more in the fog), a lantern gives LANTERN_GAIN back, and a lamp that goes out is the one the steady die loses", () => {
  const round = synth({});
  assert.equal(round.runner.lamp, hz.LAMP_MAX);
  run(round, 1000);
  assert.ok(Math.abs(round.runner.lamp - (hz.LAMP_MAX - hz.LAMP_DRAIN)) < 0.1, `${round.runner.lamp}`);
  const fog = synth({ fog: [[0, 1e6]] });
  run(fog, 1000);
  assert.ok(Math.abs(fog.runner.lamp - (hz.LAMP_MAX - hz.LAMP_DRAIN - hz.LAMP_FOG)) < 0.1);
  assert.equal(fog.runner.fog, true);
  // A lantern in the lane gives LANTERN_GAIN (once, capped), in points too.
  const lit = synth({ lanterns: [[200, 0]] });
  at(lit, 190, 0);
  lit.runner.lamp = 40;
  const score = lit.score;
  run(lit, 500);
  assert.ok(lit.runner.lamp > 40 + hz.LANTERN_GAIN - hz.LAMP_DRAIN, `${lit.runner.lamp}`);
  assert.equal(lit.runner.lit[0], true);
  assert.equal(lit.score - score >= hz.LANTERN_POINTS, true);
  assert.equal(events(lit, "hearseLantern").length, 1);
  const cap = synth({ lanterns: [[200, 0]] });
  at(cap, 190, 0);
  run(cap, 500);
  assert.ok(cap.runner.lamp <= hz.LAMP_MAX);
  // A lantern in the other lane is not taken, nor one the hearse jumps high over.
  const other = synth({ lanterns: [[200, 1]] });
  at(other, 190, 0);
  run(other, 500);
  assert.equal(other.runner.lit[0], false);
  const high = synth({ lanterns: [[200, 0]] });
  at(high, 182, 0);
  press(high);
  run(high, 20);
  high.input.up = false;
  run(high, 1000);
  assert.equal(high.runner.lit[0], false, "jumped over it");
  // The lamp going out: the event, the grade, the night closing in; a lantern relights it.
  const out = synth({ lanterns: [[400, 0]] });
  out.runner.lamp = 1;
  assert.equal(out.bonusRound.perf.steady, true);
  run(out, 800);
  assert.equal(out.runner.out, true);
  assert.equal(out.runner.lamp, 0);
  assert.equal(out.runner.broken, true);
  assert.equal(out.bonusRound.perf.steady, false);
  assert.equal(events(out, "hearseLampOut").length, 1);
  at(out, 390, 0);
  out.runner.lamp = 0;
  run(out, 500);
  assert.equal(out.runner.out, false);
  assert.equal(events(out, "hearseLampLit").length, 1);
  assert.equal(out.bonusRound.perf.steady, false, "a lamp that went out stays a broken lamp");
});

test("Ghoul Rush's Midnight Hearse: a hit throws a coffin out ahead, the lid pops and a ghoul sits up in the lane to shoot for SIT_POINTS; it ducks back as the hearse reaches it; the five coffins run out", () => {
  const ride = { stones: [[300, 0, 0], [900, 0, 0]] };
  const round = synth(ride);
  at(round, 285, 0);
  assert.equal(round.runner.coffins, hz.COFFINS);
  run(round, 400);
  assert.equal(round.runner.coffins, hz.COFFINS - 1);
  assert.equal(round.runner.sitters.length, 1);
  const s = round.runner.sitters[0];
  assert.equal(s.lane, 0);
  assert.ok(s.x > 285 + hz.SIT_AHEAD - 20 && s.x < 300 + hz.SIT_AHEAD + 5, `${s.x}`);
  assert.equal(events(round, "hearseCoffin").length, 1);
  assert.equal(events(round, "hearseCoffin")[0].left, hz.COFFINS - 1);
  assert.equal(s.state, "fly");
  until(round, () => s.state === "sit", 1500);
  assert.equal(s.state, "sit");
  assert.equal(events(round, "hearseSitUp").length, 1);
  // Shot: points and an act. Not before it has risen.
  round.you.safeMs = 1e9;
  const score = round.score;
  run(round, 600, { fire: true });
  assert.equal(s.state, "broken");
  assert.equal(round.score - score >= hz.SIT_POINTS, true);
  assert.equal(round.bonusRound.perf.acts, 1);
  assert.equal(events(round, "hearseSitHit")[0].points, hz.SIT_POINTS);
  // A ghoul not shot ducks back down as the hearse reaches it (it never hurts).
  const miss = synth(ride);
  at(miss, 285, 0);
  run(miss, 400);
  const m = miss.runner.sitters[0];
  until(miss, () => m.state === "sit", 1500);
  miss.you.safeMs = 1e9;
  const hearts = miss.bonusRound.hearts;
  until(miss, () => miss.you.x > m.x + 8, 3000);
  assert.equal(m.state, "hid");
  assert.equal(miss.bonusRound.hearts, hearts, "harmless");
  // The sat-up ghoul can be shot only after it has risen.
  const early = synth(ride);
  at(early, 285, 0);
  run(early, 400);
  const e = early.runner.sitters[0];
  until(early, () => e.state === "sit", 1500);
  early.shots.push({ x: e.x - 2, y: hz.LANE_Y[0] + 2.4, vx: 130, vy: 0, gone: 0 });
  e.t = hz.SIT_MS - 10;
  ghoul.advance(early, 4, steady);
  assert.equal(e.state, "sit", "still rising");
  // Five coffins and no more.
  const many = synth({});
  many.runner.coffins = 1;
  at(many, 285, 0);
  many.spec = { ...many.spec, ride: { ...many.spec.ride, stones: [[300, 0, 0], [400, 0, 0]] } };
  run(many, 400);
  assert.equal(many.runner.coffins, 0);
  assert.equal(many.runner.sitters.length, 1);
  many.you.safeMs = 0;
  at(many, 385, 0);
  run(many, 400);
  assert.equal(many.runner.sitters.length, 1, "none left to throw");
  assert.equal(many.bonusRound.hearts, 3);
});

test("Ghoul Rush's Midnight Hearse: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to Angel's Rest", () => {
  const round = hearseRound();
  round.dice = 2;
  round.bonusRound.hearts = 1;
  at(round, R.gates[0][1] + 20, 0);
  // Find the first thing in the road's lane and drive at it.
  const first = things().filter((t) => t.lane === 0).sort((a, b) => a.x - b.x)[0];
  at(round, first.x - 12, 0);
  until(round, () => round.phase === "clear", 8000);
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
  assert.equal(round.spec.id, "angel");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner, null);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Midnight Hearse: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart", () => {
  const round = hearseRound();
  at(round, R.checks[0] - 6, 0, { safe: true });
  until(round, () => round.runner.check >= 0, 3000);
  const seen = events(round, "hearseCheck").map((e) => e.n);
  assert.deepEqual(seen.slice(0, 1), [1]);
  const c0 = round.runner.check;
  round.you.x = 1;
  hz.HEARSE.place[0](round, {});
  assert.equal(round.you.x, R.checks[c0]);
  assert.equal(round.runner.check, c0);
  assert.equal(round.runner.lane, 0);
  assert.equal(round.camLead, hz.CAM_AHEAD);
  const fresh = hearseRound();
  assert.equal(fresh.you.x, ROOM.start);
  assert.equal(fresh.runner.check, -1);
  // Past all six on a long drive.
  const long = synth({ checks: R.checks });
  long.you.safeMs = 1e9;
  long.timeMs = 1e9;
  run(long, 62000);
  assert.equal(long.runner.check, R.checks.length - 1);
});

test("Ghoul Rush's Midnight Hearse: at the finish the hearse brakes, the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = hearseRound();
  round.dice = 1;
  at(round, R.finish - 8, 1, { safe: true });
  until(round, () => round.runner.done, 3000);
  assert.equal(round.runner.done, true);
  const fin = events(round, "hearseFinish");
  assert.equal(fin.length, 1);
  assert.equal(round.you.y, ghoul.groundAt(ROOM, round.you.x), "back down on the road, from either lane");
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
  assert.equal(round.spec.id, "angel");
  assert.equal(round.runner, null);
});

test("Ghoul Rush's Midnight Hearse: no random number is drawn in the room (a ride of 20 seconds, jumping, switching and shooting, on a draw that throws)", () => {
  const round = hearseRound();
  round.you.safeMs = 1e9;
  for (let t = 0; t < 20000; t += 16) {
    round.input.fire = true;
    round.input.right = t % 6000 < 3000;
    round.input.left = !round.input.right;
    if (t % 1500 === 0) press(round);
    ghoul.advance(round, 16, never);
    round.input.up = false;
    round.events.length = 0;
  }
  assert.ok(round.you.x > 600);
});

/* ----------------------------------------------------------- grade and dice */

test("Ghoul Rush's Midnight Hearse's grade: the obstacles the hearse faced are the total, one passed in its lane counts and one dodged by a lane does not, shooting 8 things is the die, an unbroken lamp is the die", () => {
  const ride = { gates: [[300, 316]], graves: [[400, 0]], stones: [[460, 0, 0], [460, 1, 0]], hands: [[600, 1]] };
  const round = synth(ride);
  at(round, 250, 0, { safe: true });
  assert.equal(round.bonusRound.perf.total, 0);
  assert.equal(round.bonusRound.perf.goal, hz.ACTS_GOAL);
  // Stay in the road: the grave and the road's headstone are faced, not the verge's stone or hand.
  until(round, () => round.you.x > 480, 6000);
  assert.equal(round.bonusRound.perf.total, 2);
  // Switch away at the gate: the road's stone is dodged by the lane and not counted; the verge's is.
  const away = synth(ride);
  at(away, 296, 0, { safe: true });
  away.input.right = true;
  run(away, 500);
  away.input.right = false;
  assert.equal(away.runner.lane, 1);
  until(away, () => away.you.x > 480, 6000);
  assert.ok(away.bonusRound.perf.total >= 1 && away.bonusRound.perf.total <= 2, `${away.bonusRound.perf.total}`);
  assert.equal(away.bonusRound.perf.hits.length, 0);
  // A faced thing that cost a heart is a hit, counted once.
  const hit = synth(ride);
  at(hit, 385, 0);
  run(hit, 800);
  assert.deepEqual(hit.bonusRound.perf.hits, ["g0"]);
  assert.equal(hit.bonusRound.perf.total, 1);
  // The dice: the floor, hearts, clean passes, acts, an unbroken lamp.
  const b = makeBonus({ stats: { kills: 0 } });
  b.perf = { total: 20, hits: [], acts: 0, goal: hz.ACTS_GOAL, steady: false, kills0: 0 };
  assert.equal(diceFor(b), BONUS_FLOOR + 2 + 2);
  b.perf.steady = true;
  assert.equal(diceFor(b), 9 - 1);
  b.perf.acts = hz.ACTS_GOAL;
  assert.equal(diceFor(b), 9);
  b.perf.acts = hz.ACTS_GOAL - 1;
  assert.equal(diceFor(b), 8);
  b.hearts = 1;
  assert.equal(diceFor(b), 6);
  b.perf.hits = Array.from({ length: 20 }, (_, i) => `x${i}`);
  assert.equal(diceFor(b), BONUS_FLOOR + 0 + 0 + 0 + 1);
  b.perf.steady = false;
  assert.equal(diceFor(b), BONUS_FLOOR);
});

test("Ghoul Rush's Midnight Hearse: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  const causes = {
    grave: { graves: [[300, 0]] },
    tomb: { stones: [[300, 0, 0]] },
    cross: { stones: [[300, 0, 1]] },
    branch: { lows: [[300, 306, 0, 0]] },
    grasp: { hands: [[300, 0]] },
    crow: { crows: [[330, 0, 2.6]] },
    wreck: { blocks: [[300, 330, 0]] },
  };
  for (const [cause, ride] of Object.entries(causes)) {
    const round = synth(ride);
    round.infinite = true;
    at(round, cause === "crow" ? 250 : 270, 0);
    run(round, 1800);
    assert.ok(events(round, "lose").some((e) => e.cause === cause), `${cause} was lost to`);
    assert.equal(round.bonusRound.hearts, 5, `${cause} cost nothing`);
    assert.equal(round.lives, 3);
    assert.equal(round.phase, "play");
  }
});

test("Ghoul Rush's Midnight Hearse: every cause costs exactly one heart", () => {
  const causes = {
    grave: { graves: [[300, 0]] },
    tomb: { stones: [[300, 0, 0]] },
    cross: { stones: [[300, 0, 1]] },
    branch: { lows: [[300, 306, 0, 0]] },
    grasp: { hands: [[300, 0]] },
    crow: { crows: [[330, 0, 2.6]] },
    wreck: { blocks: [[300, 330, 0]] },
  };
  for (const [cause, ride] of Object.entries(causes)) {
    const round = synth(ride);
    at(round, cause === "crow" ? 250 : 270, 0);
    run(round, 1800);
    assert.equal(round.bonusRound.hearts, 4, cause);
    assert.equal(events(round, "lose").map((e) => e.cause).join(), cause);
    assert.equal(round.lives, 3);
  }
});

test("Ghoul Rush's Midnight Hearse: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ stones: [[300, 0, 0]] });
  round.you.garlic = true;
  at(round, 285, 0);
  round.you.garlic = true;
  run(round, 800);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false);
  assert.equal(round.runner.coffins, hz.COFFINS, "a coffin goes only with a heart");
});

/* ---------------------------------------------------------------- voices */

test("Ghoul Rush's Midnight Hearse: every event has a voice that plays, every cause has words and a sound, and the voices are tones that exist (none over 1.2 s)", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...hz.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = HEARSE_VOICES[kind] && HEARSE_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "stone", points: 50, left: 2, to: 1 }).played;
    assert.ok(played.includes(name), `${event} plays ${name}`);
  }
  for (const [name, def] of Object.entries(HEARSE_SFX.tones)) {
    assert.ok(tones[name], name);
    for (const l of def.layers) assert.ok(l.seconds > 0 && l.seconds + (l.delay || 0) <= 1.2, `${name} is short`);
  }
  for (const cause of ["grave", "tomb", "cross", "branch", "grasp", "crow", "wreck"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "hearseJump" }).played.length, 1);
  assert.equal(heard({ type: "hearseCrowHit", points: 80 }).played.length, 1);
});

test("Ghoul Rush's Midnight Hearse: its music has the room's level of voices, bars of sixteen steps, and a track for the room", () => {
  const track = ghoulSfx.default.music.ghoulHearseRide;
  assert.equal(track, HEARSE_SFX.music.ghoulHearseRide);
  const playing = Object.entries(track.voices).filter(([, v]) => (v.from ?? 0) <= 0.7);
  assert.ok(playing.length >= 4);
  for (const [name, p] of Object.entries(track.patterns)) {
    for (const [voice, line] of Object.entries(p)) {
      assert.ok(track.voices[voice], `${name}.${voice} is a voice`);
      for (const bar of line.split("|")) assert.equal(bar.trim().split(/\s+/).length, 16, `${name}.${voice}`);
    }
  }
  for (const name of track.order) assert.ok(track.patterns[name]);
});

test("Ghoul Rush's Midnight Hearse: the room's own names do not collide with the game's (hazards, events, kinds)", () => {
  for (const e of hz.EVENTS) assert.ok(e.startsWith("hearse"), e);
  assert.deepEqual(Object.keys(hz.HEARSE).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(typeof ghoul.ROOM_MUSIC.hearse, "string");
  assert.equal(ghoul.roomById("hearse").ride.runner, "hearse");
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Midnight Hearse draws: the room in a lit and a dark one, the hearse on each lane, in the air, ducking and switching, each thing in each state, the fog, the lamp out, a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["graveyard"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "hearse") through(r);
  r.lives = 99;
  const spots = [ROOM.start + 40, R.graves[0][0] - 10, R.lows[0][0] - 5, R.hands[0][0] - 10, R.crows[0][0] - 30, R.checks[0], R.blocks[0][0] - 20, R.blocks[0][0] + 10, R.fog[0][0] + 50, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      for (const lane of [0, 1]) {
        at(r, x, lane, { safe: true });
        r.runner.hands = r.runner.hands.map((h, i) => ({ ...h, state: ["mound", "warn", "up", "sink", "broken", "spent"][i % 6], t: 600 }));
        r.runner.crows = r.runner.crows.map((w, i) => ({ ...w, state: ["perch", "fly", "gone", "broken"][i % 4] }));
        r.runner.lit = r.runner.lit.map((_, i) => i % 3 === 0);
        r.runner.sitters = [{ x: x + 30, ox: x, lane: 0, state: "sit", t: 1500 }, { x: x + 40, ox: x, lane: 1, state: "fly", t: 300 }, { x: x + 20, ox: x, lane: 1, state: "hid", t: 0 }, { x: x + 10, ox: x, lane: 0, state: "broken", t: 0 }];
        for (const air of [false, true]) {
          if (air) Object.assign(r.runner, { air: true, h: 5, vy: 20 });
          if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 5 });
          r.you.ducking = !air && lane === 0;
          r.runner.lamp = air ? 0 : 60;
          r.runner.out = air;
          r.runner.coffins = air ? 0 : 5;
          r.shots.push({ x: x + 6, y: r.you.y + 2.4, vx: 130, vy: 0, gone: 0 });
          for (let k = 0; k < 4; k++) g.tick(16);
          r.monsters.length = 0;
          r.you.safeMs = 1e9;
          at(r, x, lane, { safe: true });
        }
      }
    }
  }
  // A switch in progress, mid-hop.
  at(r, R.gates[0][0] + 2, 0, { safe: true });
  r.input.right = true;
  for (let k = 0; k < 12; k++) g.tick(16);
  r.input.right = false;
  assert.equal(r.spec.id, "hearse");
  // Crashes: a grave, a headstone, a wreck.
  r.you.safeMs = 0;
  at(r, R.graves[0][0] - 3, R.graves[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["graveyard"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "hearse") through(d);
  d.phase = "play";
  d.runner.done = true;
  d.runner.restX = R.finish + 10;
  Object.assign(d.you, { x: R.finish + 20, y: 9, state: "run" });
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
  const at2 = ghoul.STAGES.findIndex((s) => s.id === "graveyard");
  for (let i = 0; i < at2; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "hearse");
  assert.equal(p.runner.lane, 0);
  assert.equal(p.you.y, hz.LANE_Y[0]);
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that drives well: it takes the road (the lanterns) unless a closed stretch is coming there, jumps 6 to 15
// short of a grave, headstone, cross or hand, ducks under every low and every crow in flight, and holds the
// blaster. `miss` is the share of things it fails to dodge (by a hash).
const mix = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
function goodBot(round, seed, miss = 0.04, shoot = true) {
  const { you, runner: c, input: inp } = round;
  inp.left = inp.right = inp.down = false;
  inp.fire = shoot;
  if (round.phase !== "play" || !c || c.done) {
    inp.up = false;
    return;
  }
  const ok = (x) => mix(seed, Math.round(x)) >= miss;
  const look = 9 + (seed % 7);
  const lane = c.lane;
  const gate = R.gates.find(([a, b]) => you.x >= a && you.x <= b);
  if (gate) {
    const closed = (l) => R.blocks.some(([x0, , bl]) => bl === l && x0 > you.x && x0 - you.x < 150 && ok(x0));
    const want = closed(0) ? 1 : 0;
    inp.left = want === 0;
    inp.right = want === 1;
  }
  let jump = false;
  const ahead = (x) => x - you.x > 6 && x - you.x < look;
  for (const [x, l] of R.graves) if (l === lane && ahead(x) && ok(x)) jump = true;
  for (const [x, l] of R.stones) if (l === lane && ahead(x) && ok(x)) jump = true;
  R.hands.forEach(([x, l], i) => {
    if (l === lane && c.hands[i].state !== "broken" && ahead(x) && ok(x)) jump = true;
  });
  for (const [x0, x1, l] of R.lows) if (l === lane && you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
  R.crows.forEach(([x, l], i) => {
    const w = c.crows[i];
    if (l === lane && w.state === "fly" && Math.abs(w.x - you.x) < 16 && ok(x)) inp.down = true;
  });
  if (jump && !inp.down && !c.air) press(round);
  else inp.up = false;
}
function idleBot(round) {
  const inp = round.input;
  inp.left = inp.right = inp.down = false;
  inp.up = false;
  inp.fire = true;
}
function rideWith(seed, bot, limit = 100000) {
  const round = hearseRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the hearse stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Midnight Hearse: a bot that drives well finishes the whole road in 60 to 75 seconds, with 6 to 9 dice, a few hearts lost at most, past every checkpoint", () => {
  const dice = [];
  const gone = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 76000, `${ms} ms`);
    assert.ok(b.dice >= 5 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.equal(round.lives, 3, "never a run life");
    dice.push(b.dice);
    gone.push(lost.length);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 6.5, `${dice.join(",")}`);
  assert.ok(gone.every((n) => n <= 4), `${gone.join(",")}`);
});

test("Ghoul Rush's Midnight Hearse: a bot that misses a quarter of the things loses, one that never switches lanes is thrown by the closed stretches, and a bot that never dodges (holding fire) loses all five hearts before the first third, ends with 0 dice and the run goes on", () => {
  let finished = 0;
  for (let seed = 1; seed <= 6; seed++) if (rideWith(seed, (r) => goodBot(r, seed, 0.25)).round.bonusRound.won) finished++;
  assert.ok(finished <= 3, `${finished} of 6 finished missing a quarter`);
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
  // A driver who dodges everything but never changes lane meets the first closed stretch in the road.
  const { lost } = rideWith(3, (r) => {
    goodBot(r, 3, 0);
    r.input.left = r.input.right = false;
  });
  assert.ok(lost.includes("wreck"), "thrown by a closed stretch");
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Midnight Hearse telegraphs: JUMP over graves, headstones and crosses, DUCK under branches and the arch, SHOOT at hands and crows, SWITCH at the gate before a closed stretch, for the hearse's lane only, words on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  assert.equal(marks.length, R.graves.length + R.stones.length + R.lows.length + R.hands.length + R.crows.length + R.blocks.length);
  for (const m of marks) assert.equal(m.answer, ANSWERS[m.kind], m.kind);
  assert.equal(ANSWERS.grave, "JUMP");
  assert.equal(ANSWERS.branch, "DUCK");
  assert.equal(ANSWERS.arch, "DUCK");
  assert.equal(ANSWERS.crow, "SHOOT");
  assert.equal(ANSWERS.block, "SWITCH");
  // Each closed stretch's sign stands at a gate and shows to the lane that is shut.
  for (const [x0, , lane] of R.blocks) {
    const m = marks.find((q) => q.kind === "block" && q.lane === lane && q.lead < x0 && x0 - q.lead < 90);
    assert.ok(m, `a sign for the block at ${x0}`);
    assert.ok(R.gates.some(([a, b]) => b === m.lead && a < m.lead), "at a gate");
    assert.ok(telegraphs(R, m.lead - 30, lane).some((t) => t === t && t.kind === "block"));
    assert.ok(!telegraphs(R, m.lead - 30, 1 - lane).some((t) => t.kind === "block"), "not for the other lane");
  }
  const first = R.lows.find((l) => !l[3]);
  const m = marks.find((q) => q.kind === "branch" && q.x === (first[0] + first[1]) / 2);
  const lane = first[2];
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x, lane).find((t) => t.kind === "branch" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33, lane), telegraphs(R, m.lead - 33, lane), "deterministic");
  for (const kind of ["grave", "stone", "branch", "hand", "crow"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 3, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, i);
      const shown = telegraphs(R, q.lead - 32, q.lane).find((t) => t.lead === q.lead && t.kind === kind);
      assert.ok(shown, `${kind} ${i} shows`);
      assert.equal(shown.words, i < 3, `${kind} ${i}`);
    });
  }
  // In the other lane a thing shows nothing.
  const g = marks.find((q) => q.kind === "grave");
  assert.ok(!telegraphs(R, g.lead - 32, 1 - g.lane).some((t) => t.lead === g.lead && t.kind === "grave"));
});

test("Ghoul Rush's Midnight Hearse's intro banner says the controls plainly", () => {
  assert.match(R.how, /LEFT or RIGHT at a gate/);
  assert.match(R.how, /UP jump, DOWN duck/);
  assert.match(R.how, /SPACE shoot/);
  assert.ok(R.how.length <= 72);
});
