// Web console tests, Ghoul Rush's Bog Runner (Gallows Bog's bonus round, between the Stilt House and the Drowning Pool): its shape (two lanes, the banks, every thing spaced for a player), the boat's motion (a steady speed on the channel, slower on the flats, a jump, a duck, a hop between lanes only at a bank), each obstacle and its cost (snag, knee, veil, limb), the fan's clog and stall, the swarm in the wake and its catch, the charms and gas pockets shot for points and a cover burst, the hearts and the grade and the dice, endless lives, the drawing and the sounds, and bots that play it.
// Run with: node --test scripts/test-web-console-activities-ghoul-bogboat.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as bz from "../src/web-console/public/activities/ghoul-bogboat.js";
import { ANSWERS, EVENT_VOICE, LOOKS as BOAT_LOOKS, LOSE_SOUNDS, LOSE_WORDS, TELEGRAPH_WORDS, VOICES as BOAT_VOICES, telegraphMarks, telegraphs } from "../src/web-console/public/activities/ghoul-bogboat-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";
import { BOGBOAT_SFX } from "../src/web-console/public/activities/ghoul-sfx-bogboat.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the bog runner drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Bog Runner reached the way play reaches it, nothing woken, the clocks long,
// the bonus round on (five hearts).
function boatRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["bog"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "bogboat") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const NONE = { runner: "bogboat", time: 1e9, finish: 1e6, banks: [], snags: [], knees: [], veils: [], limbs: [], props: [], gas: [], checks: [] };
// The same round over a ride of its own (a plain channel to measure the boat on).
function synth(ride) {
  const round = boatRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 1e6, 9]], ride: { ...NONE, ...ride } };
  round.runner = null;
  bz.BOGBOAT.place[0](round, {});
  return round;
}

// The boat at `x` in `lane`, on the water.
function at(round, x, lane = 0, { safe = false } = {}) {
  Object.assign(round.runner, { lane, from: lane, swMs: 0, h: 0, vy: 0, air: false, v: lane ? bz.FLATS_V : bz.BOGBOAT_V, stall: 0, clog: 0 });
  Object.assign(round.you, { x, y: bz.LANE_Y[lane], vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
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

const ROOM = ghoul.roomById("bogboat");
const R = ROOM.ride;
const V = bz.BOGBOAT_V;
const things = () => [
  ...R.snags.map(([x, lane], i) => ({ id: `s${i}`, kind: "snag", lane, x })),
  ...R.knees.map(([x, lane], i) => ({ id: `k${i}`, kind: "knee", lane, x })),
  ...R.veils.map(([x0, x1, lane], i) => ({ id: `v${i}`, kind: "veil", lane, x: (x0 + x1) / 2 })),
  ...R.limbs.map(([x0, x1, lane], i) => ({ id: `l${i}`, kind: "limb", lane, x: (x0 + x1) / 2 })),
  ...R.props.map(([x, lane], i) => ({ id: `p${i}`, kind: "prop", lane, x })),
  ...R.gas.map(([x, lane], i) => ({ id: `g${i}`, kind: "gas", lane, x })),
];
const HARMFUL = new Set(["snag", "knee", "veil", "limb"]);

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Bog Runner is Gallows Bog's fourth room, between the Stilt House and the Drowning Pool: lit, no key, no boss, a ride about a minute long, a bonus round that plays its own track", () => {
  const st = ghoul.stageById("bog");
  assert.deepEqual(st.rooms, ["boardwalk", "hollow", "stilts", "bogboat", "drowning"]);
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Bog Runner", "Something swims in your wake"]);
  assert.equal(ROOM.dark, false, "a moonlit night, always lit");
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "bogboat");
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3000, `${ROOM.length} units long`);
  assert.equal(ghoul.ROOM_MUSIC.bogboat, "ghoulBoatRide");
  assert.ok(ghoulSfx.default.music.ghoulBoatRide, "its own track");
  assert.deepEqual(Object.keys(bz.BOGBOAT.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.bogboat, BOAT_LOOKS.bogboat);
  assert.equal(LOOKS.bogboat.pack, "bogboat");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.snags) && Object.isFrozen(R.snags[0]), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0 && ROOM.items.length === 0, "no monsters or pickups: the things on the water are the pack's own");
  assert.deepEqual(ROOM.ground.map((g) => g.slice()), [[0, ROOM.length, bz.LANE_Y[0]]], "one flat floor under the water");
  assert.ok(R.finish < ROOM.door && ROOM.door > ROOM.length - 20, "the door at the room's end, past the finish");
  assert.ok(ghoul.groundAt(ROOM, ROOM.door - 2) > -Infinity, "floor to walk out on");
  const secs = (R.finish - ROOM.start) / V;
  assert.ok(secs >= 56 && secs <= 80, `${secs.toFixed(1)} s at BOGBOAT_V`);
  assert.equal(ghoul.timeFor(ROOM), R.time, "its own clock");
  assert.ok(R.time / 1000 > secs * 1.4, "a clock with room to spare");
  assert.equal(ghoul.STAGES.find((s) => s.id === "bog").rooms.length, 5);
  assert.equal(R.banks.length, 11);
  assert.equal(R.checks.length, 4);
  assert.ok(R.props.length >= 16 && R.gas.length >= 14, "enough to shoot");
  assert.ok(R.snags.length && R.knees.length && R.veils.length && R.limbs.length, "one of each thing to dodge");
});

test("Ghoul Rush's Bog Runner: every thing is in lane 0 or 1, off the ends, spaced for a player, and clear of the banks", () => {
  const all = things();
  assert.ok(all.length >= 70 && all.length <= 130, `${all.length} things`);
  for (const t of all) {
    assert.ok(t.lane === 0 || t.lane === 1, `${t.id} lane`);
    assert.ok(t.x >= 120 && t.x < R.finish - 40, `${t.id} at ${t.x}`);
  }
  for (const lane of [0, 1]) assert.ok(all.filter((t) => t.lane === lane && HARMFUL.has(t.kind)).length >= 12, `plenty to dodge in lane ${lane}`);
  // The same lane: 36 between any two (a jump and a duck need 38 at the full speed, so the slots never share).
  for (const lane of [0, 1]) {
    const xs = all.filter((t) => t.lane === lane).map((t) => t.x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 36, `lane ${lane}: ${xs[i - 1]} and ${xs[i]}`);
  }
  // Banks: 16 wide, 200 apart, in order, and nothing within the hop of one.
  R.banks.forEach(([a, b], i) => {
    assert.equal(b - a, 16);
    if (i) assert.equal(a - R.banks[i - 1][0], 200, "banks are spaced out");
    for (const t of all) assert.ok(t.x < a - 6 || t.x > b + 22, `${t.id} at ${t.x} is near the bank ${a}`);
  });
  for (const [x0, x1] of R.veils) assert.equal(x1 - x0, 8);
  for (const [x0, x1] of R.limbs) assert.equal(x1 - x0, 6);
  // The channel is the thicker lane and the flats hold most of the gas.
  const dense = (lane) => all.filter((t) => t.lane === lane && HARMFUL.has(t.kind)).length;
  assert.ok(dense(0) > dense(1) * 1.5, `${dense(0)} to dodge in the channel, ${dense(1)} on the flats`);
});

test("Ghoul Rush's Bog Runner: every jump is clearable and every duck passable, at the speed of either lane, and the checkpoints sit clear of the banks", () => {
  const clearFor = (h, speed) => (2 * Math.sqrt(bz.JUMP_V ** 2 - 2 * bz.GRAVITY * h) / bz.GRAVITY) * speed;
  for (const speed of [bz.BOGBOAT_V, bz.FLATS_V]) {
    assert.ok(clearFor(bz.SNAG_H, speed) >= bz.SNAG_W + ghoul.HIT_W + 8, `a snag at ${speed}`);
    assert.ok(clearFor(bz.KNEE_H, speed) >= bz.KNEE_W + ghoul.HIT_W + 8, `knees at ${speed}`);
  }
  assert.ok(bz.SNAG_H < (bz.JUMP_V ** 2) / (2 * bz.GRAVITY) - 4, "a snag is well under the jump's peak");
  assert.ok(ghoul.DUCK_H < bz.LOW_Y && ghoul.HIT_H > bz.LOW_Y, "a ducked Planny fits under a low and a standing one does not");
  R.checks.forEach((x, i) => {
    if (i) assert.ok(x - R.checks[i - 1] >= 400);
    assert.ok(R.banks.every(([a, b]) => x < a - 4 || x > b + 4));
  });
});

/* ---------------------------------------------------------------- the boat */

test("Ghoul Rush's Bog Runner rolls at BOGBOAT_V on the channel whatever is pressed, slower on the flats, and DOWN eases the throttle in either; the camera leads it", () => {
  const round = synth({});
  assert.equal(round.runner.id, "bogboat");
  assert.equal(round.camLead, bz.CAM_AHEAD);
  assert.equal(round.you.y, bz.LANE_Y[0]);
  const x0 = round.you.x;
  run(round, 1000);
  assert.ok(Math.abs(round.you.x - x0 - V) < 0.5, `${round.you.x - x0} in a second`);
  for (const keys of [{ left: true }, { fire: true }]) {
    const a = round.you.x;
    run(round, 500, keys);
    assert.ok(Math.abs(round.you.x - a - V / 2) < 0.5, JSON.stringify(keys));
  }
  assert.equal(round.you.face, 1);
  // Left and right do nothing off a bank.
  run(round, 400, { right: true });
  assert.equal(round.runner.lane, 0);
  assert.equal(round.you.y, bz.LANE_Y[0]);
  const speedOf = (lane, keys) => {
    const r = synth({});
    at(r, 100, lane);
    run(r, 1500, keys);
    return r.runner.v;
  };
  assert.ok(Math.abs(speedOf(0, {}) - bz.BOGBOAT_V) < 0.3);
  assert.ok(Math.abs(speedOf(0, { down: true }) - bz.EASE_V) < 0.3);
  assert.ok(Math.abs(speedOf(1, {}) - bz.FLATS_V) < 0.3);
  assert.ok(Math.abs(speedOf(1, { down: true }) - bz.FLATS_EASE_V) < 0.3);
});

test("Ghoul Rush's Bog Runner jumps about 13 high for about three quarters of a second, a press saved for a landing jumps on it, and it cannot jump in the air", () => {
  const round = synth({});
  at(round, 100, 0, { safe: true });
  let peak = 0;
  let ms = 0;
  press(round);
  ghoul.advance(round, 4, steady);
  round.input.up = false;
  assert.equal(round.runner.air, true);
  while (round.runner.air && ms < 2000) {
    ghoul.advance(round, 4, steady);
    peak = Math.max(peak, round.you.y - bz.LANE_Y[0]);
    ms += 4;
  }
  assert.ok(peak > 12 && peak < 15, `${peak} high`);
  assert.ok(ms > 650 && ms < 850, `${ms} ms`);
  assert.equal(round.you.y, bz.LANE_Y[0]);
  assert.equal(events(round, "bogboatJump").length, 1);
  assert.equal(events(round, "bogboatLand").length, 1);
  // A press in the air does not double jump, but waits for the landing.
  const again = synth({});
  at(again, 100, 0, { safe: true });
  press(again);
  ghoul.advance(again, 4, steady);
  run(again, 400);
  press(again);
  run(again, 100);
  assert.ok(again.runner.vy <= 0 || again.runner.air, "no second jump in mid-air");
  until(again, () => !again.runner.air, 1000);
  press(again);
  ghoul.advance(again, 4, steady);
  assert.equal(again.runner.air, true, "a press saved for the landing jumps on it");
});

test("Ghoul Rush's Bog Runner: DOWN ducks, a ducked Planny passes under a veil or a limb and a standing one hits it (causes veil and limb), at the cost of a heart", () => {
  for (const [key, cause, ride] of [["veils", "veil", { veils: [[300, 308, 0]] }], ["limbs", "limb", { limbs: [[300, 306, 0]] }]]) {
    const standing = synth(ride);
    at(standing, 270, 0);
    run(standing, 1500);
    assert.equal(standing.bonusRound.hearts, 4, `${key}: a standing boat is hit`);
    assert.equal(events(standing, "lose").map((e) => e.cause).join(), cause);
    const ducked = synth(ride);
    at(ducked, 270, 0);
    run(ducked, 1500, { down: true });
    assert.equal(ducked.bonusRound.hearts, 5, `${key}: a ducked boat passes`);
    assert.equal(events(ducked, "bogboatDuck").length, 1);
    assert.equal(events(ducked, "lose").length, 0);
  }
});

test("Ghoul Rush's Bog Runner: a snag or cypress knees stop a boat that does not jump (causes snag and knee); a jump clears each; each costs only once", () => {
  for (const [cause, ride] of [["snag", { snags: [[300, 0]] }], ["knee", { knees: [[300, 0]] }]]) {
    const hit = synth(ride);
    at(hit, 270, 0);
    run(hit, 1500);
    assert.equal(hit.bonusRound.hearts, 4, cause);
    assert.equal(events(hit, "lose").map((e) => e.cause).join(), cause, "one heart, once");
    assert.equal(events(hit, "bogboatCrash").length, 1);
    const jumped = synth(ride);
    at(jumped, 270, 0);
    let pressed = false;
    until(jumped, () => {
      if (!pressed && jumped.you.x >= 300 - 14) {
        press(jumped);
        pressed = true;
      }
      return jumped.you.x > 340;
    }, 3000);
    assert.equal(jumped.bonusRound.hearts, 5, `${cause}: a jump clears it`);
    assert.equal(jumped.bonusRound.perf.hits.length, 0);
  }
  // The things in the other lane do not touch a boat.
  const other = synth({ snags: [[300, 1]], knees: [[300, 1]], veils: [[330, 338, 1]], limbs: [[360, 366, 1]] });
  at(other, 270, 0);
  run(other, 2400);
  assert.equal(other.bonusRound.hearts, 5);
});

test("Ghoul Rush's Bog Runner switches lanes only inside a bank: LEFT is the channel, RIGHT the flats, in SWITCH_MS, with no jump or duck in the hop; the boat slows to the flats' speed and comes back up to the channel's", () => {
  const round = synth({ banks: [[300, 316], [500, 516]] });
  at(round, 301, 0, { safe: true });
  run(round, 200, { right: true });
  assert.equal(round.runner.lane, 1);
  assert.equal(events(round, "bogboatSwitch").length, 1);
  assert.equal(events(round, "bogboatSwitch")[0].to, 1);
  assert.ok(round.runner.swMs > 0, "mid-hop");
  assert.equal(round.you.state, "run");
  // No jump or duck in the hop.
  press(round);
  ghoul.advance(round, 4, steady);
  assert.equal(round.runner.air, false);
  round.input.up = false;
  run(round, bz.SWITCH_MS);
  assert.equal(round.runner.swMs, 0);
  assert.equal(round.you.y, bz.LANE_Y[1], "up on the flats");
  assert.ok(round.runner.v < bz.BOGBOAT_V - 5, "slowed");
  // Not outside a bank.
  run(round, 400, { left: true });
  assert.equal(round.runner.lane, 1, "off a bank nothing changes");
  // Back down at the next one.
  at(round, 496, 1, { safe: true });
  run(round, 600, { left: true });
  assert.equal(round.runner.lane, 0);
  assert.equal(round.you.y, bz.LANE_Y[0]);
  // Not in the air.
  const air = synth({ banks: [[300, 316]] });
  at(air, 304, 0, { safe: true });
  press(air);
  run(air, 40);
  run(air, 40, { right: true });
  assert.equal(air.runner.lane, 0, "no switch in the air");
});

test("Ghoul Rush's Bog Runner: the fan clogs on the flats at full throttle (a warning at CLOG_WARN, a stall at CLOG_MAX that stops the boat for STALL_MS), an ease or the channel clears it", () => {
  const round = synth({});
  at(round, 100, 1, { safe: true });
  run(round, 1000);
  assert.ok(Math.abs(round.runner.clog - bz.CLOG_RISE) < 2, `${round.runner.clog} after a second`);
  until(round, () => events(round, "bogboatClog").length > 0, 4000);
  assert.ok(round.runner.clog >= bz.CLOG_WARN - 1);
  until(round, () => round.runner.stall > 0, 4000);
  assert.equal(events(round, "bogboatStall").length, 1);
  run(round, 800);
  assert.ok(round.runner.v < 3, `coasting to a stop (${round.runner.v})`);
  const x = round.you.x;
  until(round, () => round.runner.stall === 0, 2000);
  assert.equal(round.runner.stall, 0);
  assert.ok(round.runner.clog >= bz.CLOG_RESTART && round.runner.clog < bz.CLOG_WARN, `restarted at ${round.runner.clog}`);
  assert.ok(round.you.x - x < 6, "hardly moved while stalled");
  // Eased, the flats cool the fan.
  const eased = synth({});
  at(eased, 100, 1, { safe: true });
  run(eased, 1200);
  const hot = eased.runner.clog;
  run(eased, 1000, { down: true });
  assert.ok(eased.runner.clog < hot, "an ease cools it");
  // And the channel does.
  const channel = synth({});
  at(channel, 100, 0, { safe: true });
  channel.runner.clog = 80;
  run(channel, 1000);
  assert.ok(Math.abs(channel.runner.clog - (80 - bz.CLOG_COOL)) < 0.5, `${channel.runner.clog}`);
  // A stalled fan stops the boat, so the swarm gains on it.
  const lost = synth({});
  at(lost, 100, 1, { safe: true });
  Object.assign(lost.runner, { clog: bz.CLOG_MAX - 0.1, gap: bz.GAP_MAX });
  until(lost, () => lost.runner.stall > 0, 1000);
  const gap = lost.runner.gap;
  run(lost, 1000);
  assert.ok(lost.runner.gap < gap - 10, `${gap} to ${lost.runner.gap}`);
});

test("Ghoul Rush's Bog Runner's wake: it opens on clean riding, closes when the boat is eased or on the flats, a hit shoves it HIT_CLOSE closer, and PANIC_ON boils it until PANIC_OFF", () => {
  const round = synth({});
  at(round, 100, 0, { safe: true });
  run(round, 500);
  assert.ok(round.runner.gap > bz.GAP_START, "opening");
  run(round, 2000);
  assert.equal(round.runner.gap, bz.GAP_MAX, "never over GAP_MAX");
  const eased = synth({});
  at(eased, 100, 0, { safe: true });
  eased.runner.gap = 30;
  run(eased, 2000, { down: true });
  assert.ok(eased.runner.gap < 30, "the ease loses ground");
  const flats = synth({});
  at(flats, 100, 1, { safe: true });
  flats.runner.gap = 30;
  run(flats, 500, { down: true });
  assert.ok(flats.runner.gap < 30, "the eased flats lose ground");
  // A hit shoves it closer.
  const hit = synth({ snags: [[300, 0]] });
  at(hit, 280, 0);
  hit.runner.gap = 30;
  run(hit, 500);
  assert.ok(hit.runner.gap <= 30 - bz.HIT_CLOSE + (V - bz.WAKE_V) * 0.5 + 1, `${hit.runner.gap}`);
  assert.equal(hit.bonusRound.hearts, 4);
  // PANIC_ON: the swarm boils (an event, once), PANIC_OFF puts it out and it can boil again.
  const panic = synth({});
  at(panic, 100, 0, { safe: true });
  panic.runner.gap = bz.PANIC_ON + 0.5;
  panic.runner.v = 20;
  run(panic, 200, { down: true });
  assert.equal(panic.runner.panic, true);
  assert.equal(events(panic, "bogboatPanic").length, 1);
  run(panic, 4000);
  assert.equal(panic.runner.panic, false);
  assert.equal(panic.bonusRound.perf.steady, false, "a swarm that boiled loses the steady die");
  assert.equal(panic.runner.panicked, true);
  const clean = synth({});
  at(clean, 100, 0, { safe: true });
  run(clean, 3000);
  assert.equal(clean.bonusRound.perf.steady, true);
});

test("Ghoul Rush's Bog Runner: at WAKE_CATCH the swarm has you, a heart (cause wake), and it falls back to WAKE_FALLBACK, once; a blinking boat is caught for free; the catch is counted for the grade", () => {
  const round = synth({});
  at(round, 100, 0);
  round.runner.v = 20;
  round.runner.gap = bz.WAKE_CATCH + 0.2;
  run(round, 200, { down: true });
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose").map((e) => e.cause).join(), "wake");
  assert.equal(events(round, "bogboatCatch").length, 1);
  assert.ok(round.runner.gap > bz.WAKE_FALLBACK - 3 && round.runner.gap <= bz.WAKE_FALLBACK + 2, `${round.runner.gap}`);
  assert.equal(round.runner.catches, 1);
  assert.equal(round.bonusRound.perf.total, 1);
  assert.deepEqual(round.bonusRound.perf.hits, ["w1"]);
  assert.equal(round.phase, "play", "the ride goes on");
  const free = synth({});
  at(free, 100, 0, { safe: true });
  free.runner.v = 20;
  free.runner.gap = bz.WAKE_CATCH + 0.2;
  run(free, 200, { down: true });
  assert.equal(free.bonusRound.hearts, 5);
  assert.equal(events(free, "bogboatCatch").length, 1);
  assert.equal(free.runner.gap > bz.WAKE_CATCH + 10, true, "still falls back");
});

/* ------------------------------------------------------------ shooting */

test("Ghoul Rush's Bog Runner: one bolt breaks a charm (60 points) and one bursts a gas pocket (90 points, the wake pushed back GAS_PUSH), each an act for the grade; a bolt at another height flies on; a pocket stays burst across a re-seat", () => {
  const round = synth({ props: [[330, 0, 0], [380, 1, 1]], gas: [[420, 0], [470, 1]] });
  at(round, 300, 0, { safe: true });
  round.runner.gap = 20;
  const score = round.score;
  round.shots.push({ x: 328, y: bz.LANE_Y[0] + 2.4, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(round.runner.props[0].state, "broken");
  assert.equal(round.score - score, bz.PROP_POINTS);
  assert.equal(round.bonusRound.perf.acts, 1);
  assert.equal(events(round, "bogboatProp").length, 1);
  assert.equal(events(round, "bogboatProp")[0].points, bz.PROP_POINTS);
  // A bolt too high flies on, one in the wrong lane too.
  round.shots.push({ x: 418, y: bz.LANE_Y[0] + 9, vx: 130, vy: 0, gone: 0 });
  round.shots.push({ x: 468, y: bz.LANE_Y[0] + 2.4, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(round.runner.gas[0].state, "up");
  assert.equal(round.runner.gas[1].state, "up", "the flats' pocket needs a bolt at the flats' height");
  const gap = round.runner.gap;
  round.shots.push({ x: 418, y: bz.LANE_Y[0] + 2.4, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(round.runner.gas[0].state, "burst");
  assert.ok(round.runner.gap - gap >= bz.GAS_PUSH - 0.5, `pushed back ${round.runner.gap - gap}`);
  assert.equal(round.bonusRound.perf.acts, 2);
  assert.equal(events(round, "bogboatGas")[0].points, bz.GAS_POINTS);
  // Burst, then spent; a second bolt through the cloud does nothing.
  run(round, bz.GAS_BURST_MS + 20);
  assert.equal(round.runner.gas[0].state, "spent");
  const acts = round.bonusRound.perf.acts;
  round.shots.push({ x: 418, y: bz.LANE_Y[0] + 2.4, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(round.bonusRound.perf.acts, acts);
  // A charm hit in the flats' height.
  at(round, 340, 1, { safe: true });
  round.shots.push({ x: 378, y: bz.LANE_Y[1] + 2.4, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(round.runner.props[1].state, "broken");
  // What was shot stays shot when the boat is put back (a re-seat in the same room), a pocket still bursting too.
  Object.assign(round.runner.gas[1], { state: "burst", t: 300 });
  bz.BOGBOAT.place[0](round, {});
  assert.equal(round.runner.gas[0].state, "spent");
  assert.equal(round.runner.props[0].state, "broken");
  assert.equal(round.runner.props[1].state, "broken");
  assert.equal(round.runner.gas[1].state, "spent", "a burst pocket is not revived");
  const fresh = synth({ gas: [[420, 0]] });
  assert.equal(fresh.runner.gas[0].state, "up");
});

/* --------------------------------------------------------------- the round */

test("Ghoul Rush's Bog Runner: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Drowning Pool", () => {
  const round = boatRound();
  round.dice = 2;
  round.bonusRound.hearts = 1;
  const first = things().filter((t) => t.lane === 0 && HARMFUL.has(t.kind)).sort((a, b) => a.x - b.x)[0];
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
  assert.equal(round.spec.id, "drowning");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner, null);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's Bog Runner: the checkpoints are passed in order (an event each) and the ride goes back to the last one after the last heart", () => {
  const round = boatRound();
  at(round, R.checks[0] - 6, 0, { safe: true });
  until(round, () => round.runner.check >= 0, 3000);
  assert.deepEqual(events(round, "bogboatCheck").map((e) => e.n).slice(0, 1), [1]);
  const c0 = round.runner.check;
  round.you.x = 1;
  bz.BOGBOAT.place[0](round, {});
  assert.equal(round.you.x, R.checks[c0]);
  assert.equal(round.runner.check, c0);
  assert.equal(round.runner.lane, 0);
  assert.equal(round.camLead, bz.CAM_AHEAD);
  const fresh = boatRound();
  assert.equal(fresh.you.x, ROOM.start);
  assert.equal(fresh.runner.check, -1);
  // Past all four on a long ride.
  const long = synth({ checks: R.checks });
  long.you.safeMs = 1e9;
  long.timeMs = 1e9;
  run(long, 62000);
  assert.equal(long.runner.check, R.checks.length - 1);
});

test("Ghoul Rush's Bog Runner: at the finish the fan is cut, the door opens, and walking out ends the round with 3 to 9 Lucky dice", () => {
  const round = boatRound();
  round.dice = 1;
  at(round, R.finish - 8, 1, { safe: true });
  until(round, () => round.runner.done, 3000);
  assert.equal(round.runner.done, true);
  assert.equal(events(round, "bogboatFinish").length, 1);
  assert.equal(round.you.y, ghoul.groundAt(ROOM, round.you.x), "back down on the water's floor, from either lane");
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
  assert.equal(round.spec.id, "drowning");
  assert.equal(round.runner, null);
});

test("Ghoul Rush's Bog Runner: no random number is drawn in the room (a ride of 20 seconds, jumping, switching and shooting, on a draw that throws)", () => {
  const round = boatRound();
  round.you.safeMs = 1e9;
  for (let t = 0; t < 20000; t += 16) {
    round.input.fire = true;
    round.input.right = t % 6000 < 3000;
    round.input.left = !round.input.right;
    round.input.down = t % 2500 < 400;
    if (t % 1500 === 0) press(round);
    ghoul.advance(round, 16, never);
    round.input.up = false;
    round.events.length = 0;
  }
  assert.ok(round.you.x > 300);
});

/* ----------------------------------------------------------- grade and dice */

test("Ghoul Rush's Bog Runner's grade: the obstacles the boat faced are the total, one passed in its lane counts and one dodged by a lane does not, shooting 8 things is the die, a swarm that never boiled is the die", () => {
  const ride = { banks: [[300, 316]], snags: [[400, 0]], knees: [[460, 0], [460, 1]], gas: [[600, 1]] };
  const round = synth(ride);
  at(round, 250, 0, { safe: true });
  assert.equal(round.bonusRound.perf.total, 0);
  assert.equal(round.bonusRound.perf.goal, bz.ACTS_GOAL);
  // Stay in the channel: the snag and the channel's knees are faced, not the flats' knees.
  until(round, () => round.you.x > 480, 6000);
  assert.equal(round.bonusRound.perf.total, 2);
  // Switch away at the bank: the channel's things are dodged by the lane and not counted; the flats' are.
  const away = synth(ride);
  at(away, 296, 0, { safe: true });
  away.input.right = true;
  run(away, 500);
  away.input.right = false;
  assert.equal(away.runner.lane, 1);
  until(away, () => away.you.x > 480, 8000);
  const faced = Object.keys(away.runner.faced).filter((id) => id[0] !== "w");
  assert.deepEqual(faced, ["k1"], "the flats' knees only: the channel's things were dodged by a lane");
  assert.equal(away.bonusRound.perf.hits.filter((id) => id[0] !== "w").length, 0);
  // A faced thing that cost a heart is a hit, counted once.
  const hit = synth(ride);
  at(hit, 385, 0);
  run(hit, 800);
  assert.deepEqual(hit.bonusRound.perf.hits, ["s0"]);
  assert.equal(hit.bonusRound.perf.total, 1);
  // The dice: the floor, hearts, clean passes, acts, a swarm that never boiled.
  const b = makeBonus({ stats: { kills: 0 } });
  b.perf = { total: 20, hits: [], acts: 0, goal: bz.ACTS_GOAL, steady: false, kills0: 0 };
  assert.equal(diceFor(b), BONUS_FLOOR + 2 + 2);
  b.perf.steady = true;
  assert.equal(diceFor(b), 9 - 1);
  b.perf.acts = bz.ACTS_GOAL;
  assert.equal(diceFor(b), 9);
  b.perf.acts = bz.ACTS_GOAL - 1;
  assert.equal(diceFor(b), 8);
  b.hearts = 1;
  assert.equal(diceFor(b), 6);
  b.perf.hits = Array.from({ length: 20 }, (_, i) => `x${i}`);
  assert.equal(diceFor(b), BONUS_FLOOR + 0 + 0 + 0 + 1);
  b.perf.steady = false;
  assert.equal(diceFor(b), BONUS_FLOOR);
});

const CAUSES = {
  snag: { snags: [[300, 0]] },
  knee: { knees: [[300, 0]] },
  veil: { veils: [[300, 308, 0]] },
  limb: { limbs: [[300, 306, 0]] },
};

test("Ghoul Rush's Bog Runner: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  for (const [cause, ride] of Object.entries(CAUSES)) {
    const round = synth(ride);
    round.infinite = true;
    at(round, 270, 0);
    run(round, 1800);
    assert.ok(events(round, "lose").some((e) => e.cause === cause), `${cause} was lost to`);
    assert.equal(round.bonusRound.hearts, 5, `${cause} cost nothing`);
    assert.equal(round.lives, 3);
    assert.equal(round.phase, "play");
  }
  const wake = synth({});
  wake.infinite = true;
  at(wake, 100, 0);
  wake.runner.v = 20;
  wake.runner.gap = bz.WAKE_CATCH + 0.2;
  run(wake, 200, { down: true });
  assert.ok(events(wake, "lose").some((e) => e.cause === "wake"), "the wake was lost to");
  assert.equal(wake.bonusRound.hearts, 5);
});

test("Ghoul Rush's Bog Runner: every cause costs exactly one heart", () => {
  for (const [cause, ride] of Object.entries(CAUSES)) {
    const round = synth(ride);
    at(round, 270, 0);
    run(round, 1800);
    assert.equal(round.bonusRound.hearts, 4, cause);
    assert.equal(events(round, "lose").map((e) => e.cause).join(), cause);
    assert.equal(round.lives, 3);
  }
});

test("Ghoul Rush's Bog Runner: the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ snags: [[300, 0]] });
  round.you.garlic = true;
  at(round, 285, 0);
  round.you.garlic = true;
  run(round, 800);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.you.garlic, false);
});

/* ---------------------------------------------------------------- voices */

test("Ghoul Rush's Bog Runner: every event has a voice that plays, every cause has words and a sound, and the voices are tones that exist (none over 1.2 s)", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...bz.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = BOAT_VOICES[kind] && BOAT_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "snag", kind: 0, points: 50, to: 1 }).played;
    assert.ok(played.includes(name), `${event} plays ${name}`);
  }
  for (const [name, def] of Object.entries(BOGBOAT_SFX.tones)) {
    assert.ok(tones[name], name);
    for (const l of def.layers) assert.ok(l.seconds > 0 && l.seconds + (l.delay || 0) <= 1.2, `${name} is short`);
  }
  for (const cause of ["snag", "knee", "veil", "limb", "wake"]) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(heard({ type: "bogboatJump" }).played.length, 1);
  assert.equal(heard({ type: "bogboatGas", points: 90 }).played.length, 1);
});

test("Ghoul Rush's Bog Runner: its music has the room's level of voices, bars of sixteen steps, and a track for the room", () => {
  const track = ghoulSfx.default.music.ghoulBoatRide;
  assert.equal(track, BOGBOAT_SFX.music.ghoulBoatRide);
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

test("Ghoul Rush's Bog Runner: the room's own names do not collide with the game's (hazards, events, kinds)", () => {
  for (const e of bz.EVENTS) assert.ok(e.startsWith("bogboat"), e);
  assert.ok(!bz.EVENTS.some((e) => e.startsWith("bogboatboat")), "no bogboatboat names");
  assert.deepEqual(Object.keys(bz.BOGBOAT).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(typeof ghoul.ROOM_MUSIC.bogboat, "string");
  assert.equal(ghoul.roomById("bogboat").ride.runner, "bogboat");
  for (const kind of Object.keys(BOAT_VOICES)) assert.ok(kind.startsWith("bogboat"), kind);
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Bog Runner draws: the room in a lit and a dark one, the boat on each lane, in the air, ducking and switching, each thing in each state, the swarm far and close, the clog and the stall, a crash, the finish and the cards", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["bog"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "bogboat") through(r);
  r.lives = 99;
  const spots = [ROOM.start + 40, R.snags[0][0] - 10, R.limbs[0][0] - 5, R.veils[0][0] - 5, R.gas[0][0] - 10, R.checks[0], R.banks[0][0] + 2, R.finish - 40];
  for (const dark of [true, false]) {
    for (const x of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      for (const lane of [0, 1]) {
        at(r, x, lane, { safe: true });
        r.runner.props = r.runner.props.map((p, i) => ({ ...p, state: i % 3 ? "up" : "broken" }));
        r.runner.gas = r.runner.gas.map((p, i) => ({ ...p, state: ["up", "burst", "spent"][i % 3], t: 300 }));
        for (const air of [false, true]) {
          if (air) Object.assign(r.runner, { air: true, h: 5, vy: 20, gap: 12, panic: true, clog: 90 });
          if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 5 });
          if (!air) Object.assign(r.runner, { gap: 30, panic: false, clog: 20 });
          r.you.ducking = !air && lane === 0;
          r.runner.stall = air ? 800 : 0;
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
  at(r, R.banks[0][0] + 2, 0, { safe: true });
  r.input.right = true;
  for (let k = 0; k < 12; k++) g.tick(16);
  r.input.right = false;
  assert.equal(r.spec.id, "bogboat");
  // Crashes: a snag.
  r.you.safeMs = 0;
  at(r, R.snags[0][0] - 3, R.snags[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const done = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  done.resize(900, 900);
  done.key("action");
  done.tick(16);
  const d = done.round;
  through(d);
  d.offer = ["bog"];
  d.phaseMs = 0;
  ghoul.pickStage(d, 0);
  while (d.spec.id !== "bogboat") through(d);
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
  const at2 = ghoul.STAGES.findIndex((s) => s.id === "bog");
  for (let i = 0; i < at2; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "bogboat");
  assert.equal(p.runner.lane, 0);
  assert.equal(p.you.y, bz.LANE_Y[0]);
  pick.tick(16);
});

/* ----------------------------------------------------------- the bots */

// A bot that rides well: it keeps to the channel, jumps 9 to 15 short of a snag or cypress knees, ducks under
// every veil and limb, and holds the blaster. `miss` is the share of things it fails to dodge (by a hash).
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
  const bank = R.banks.find(([a, b]) => you.x >= a && you.x <= b);
  if (bank) inp.left = true;
  let jump = false;
  const ahead = (x) => x - you.x > 6 && x - you.x < look;
  for (const [x, l] of R.snags) if (l === lane && ahead(x) && ok(x)) jump = true;
  for (const [x, l] of R.knees) if (l === lane && ahead(x) && ok(x)) jump = true;
  for (const [x0, x1, l] of [...R.veils, ...R.limbs]) if (l === lane && you.x > x0 - 10 && you.x < x1 + 3 && ok(x0)) inp.down = true;
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
  const round = boatRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    if (round.runner && round.runner.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    if (round.runner && !round.runner.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the boat stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Bog Runner: a bot that rides well finishes the whole channel in 57 to 75 seconds, with 5 to 9 dice, a few hearts lost at most, past every checkpoint", () => {
  const dice = [];
  const gone = [];
  for (let seed = 1; seed <= 12; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 57000 && ms < 76000, `${ms} ms`);
    assert.ok(b.dice >= 5 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
    assert.equal(round.lives, 3, "never a run life");
    dice.push(b.dice);
    gone.push(lost.length);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 5.5, `${dice.join(",")}`);
  assert.ok(gone.every((n) => n <= 4), `${gone.join(",")}`);
});

test("Ghoul Rush's Bog Runner: a bot that misses a quarter of the things loses, and a bot that never dodges (holding fire) loses all five hearts before 40% of the room, ends with 0 dice and the run goes on", () => {
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
});

/* ------------------------------------------------------------ telegraphs */

test("Ghoul Rush's Bog Runner telegraphs: JUMP over snags and knees, DUCK under veils and limbs, SHOOT at the first gas pockets, for the boat's lane only, words on the first three of each kind, the same every time", () => {
  const marks = telegraphMarks(R);
  const gasMarks = marks.filter((m) => m.kind === "gas");
  assert.ok(gasMarks.length >= 1 && gasMarks.length < R.gas.length, "only the first pockets are marked");
  assert.equal(marks.length, R.snags.length + R.knees.length + R.veils.length + R.limbs.length + gasMarks.length);
  for (const m of marks) assert.equal(m.answer, ANSWERS[m.kind], m.kind);
  assert.equal(ANSWERS.snag, "JUMP");
  assert.equal(ANSWERS.knee, "JUMP");
  assert.equal(ANSWERS.veil, "DUCK");
  assert.equal(ANSWERS.limb, "DUCK");
  assert.equal(ANSWERS.gas, "SHOOT");
  const first = R.limbs[0];
  const m = marks.find((q) => q.kind === "limb" && q.x === (first[0] + first[1]) / 2);
  const lane = first[2];
  const xs = [m.lead - 45, m.lead - 41, m.lead - 36, m.lead - 30, m.lead - 10, m.lead, m.lead + 3, m.lead + 7];
  const alphaOf = (x) => (telegraphs(R, x, lane).find((t) => t.kind === "limb" && t.lead === m.lead) || { alpha: 0 }).alpha;
  const a = xs.map(alphaOf);
  assert.equal(a[0], 0, "not yet in view");
  assert.ok(a[2] > 0 && a[2] < 1, "fading in 40 to 30 ahead");
  assert.equal(a[3], 1);
  assert.equal(a[4], 1);
  assert.ok(a[6] > 0 && a[6] < 1, "fading as it passes");
  assert.equal(a[7], 0, "gone once passed");
  assert.deepEqual(telegraphs(R, m.lead - 33, lane), telegraphs(R, m.lead - 33, lane), "deterministic");
  for (const kind of ["snag", "knee", "veil", "limb", "gas"]) {
    const of = marks.filter((q) => q.kind === kind).sort((p, q) => p.lead - q.lead);
    assert.ok(of.length >= 1, kind);
    of.forEach((q, i) => {
      assert.equal(q.n, kind === "gas" ? q.n : i);
      const shown = telegraphs(R, q.lead - 32, q.lane).find((t) => t.lead === q.lead && t.kind === kind);
      assert.ok(shown, `${kind} ${i} shows`);
      assert.equal(shown.words, q.n < TELEGRAPH_WORDS, `${kind} ${i}`);
    });
  }
  // In the other lane a thing shows nothing.
  const s = marks.find((q) => q.kind === "snag");
  assert.ok(!telegraphs(R, s.lead - 32, 1 - s.lane).some((t) => t.lead === s.lead && t.kind === "snag"));
});

test("Ghoul Rush's Bog Runner's intro banner says the controls plainly", () => {
  assert.match(R.how, /LEFT or RIGHT at a bank/);
  assert.match(R.how, /UP jump, DOWN duck/);
  assert.match(R.how, /SPACE shoot/);
  assert.ok(R.how.length <= 72);
});
