// Web console tests, Ghoul Rush's Holy Roller (the Chapel's bonus round, between the Organ Loft and the Choir): an endless-runner seen from behind, in three lanes. Its room and its seeded course (every thing in the way has a safe answer, a safe path exists at every moment), the speed ramp, the lanes and the wall bump, the jump and the slide, each kind of obstacle's cost and cause, the gargoyles and the bell ropes, the wax souls, the combo and the halo's magnet, the grade, the last heart ending the round with the run going on, endless lives, the Garlic shield, the sounds and words, the drawing on a fake canvas, and bots that play it well and badly.
// Run with: node --test scripts/test-web-console-activities-ghoul-pew.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as pew from "../src/web-console/public/activities/ghoul-rush/rides/pew/ghoul-pew.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as PEW_LOOKS, VOICES as PEW_VOICES } from "../src/web-console/public/activities/ghoul-rush/rides/pew/ghoul-pew-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, diceFor, endBonus, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";
import { BPM, pulse } from "../src/web-console/public/activities/ghoul-rush/rides/pew/ghoul-pew-world.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the pew drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in Holy Roller reached the way play reaches it, nothing woken, the clocks long, the bonus round on (five hearts).
function pewRound(seed = 5) {
  const round = ghoul.newRound(seed);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["chapel"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "pew") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  return round;
}

const ROOM = ghoul.roomById("pew");
const R = ROOM.ride;
const cues = pew.cuesOf(R);
const counted = pew.countedOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);

// A round over a ride of its own (a plain stretch to measure the pew on): `ride` adds things.
function synth(ride = {}) {
  const round = pewRound();
  round.spec = { ...round.spec, start: 10, length: 1e6 + 100, door: 1e6 + 30, ground: [[0, 1e6 + 100, 12]], ride: { runner: "pew", time: 1e9, finish: 1e6, items: [], souls: [], checks: [], ...ride } };
  round.runner = null;
  pew.PEW.place[0](round, { groundAt: ghoul.groundAt });
  return round;
}

// The pew at distance `x` in `lane` (and the things behind it passed).
function pewAt(round, x, lane = 1, { safe = false } = {}) {
  const ride = round.spec.ride;
  const c = round.runner;
  Object.assign(round.you, { x, y: 12, vy: 0, state: "run", out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
  Object.assign(c, { lane, laneTo: lane, h: 0, vh: 0, slide: 0, v: pew.speedAt(x), hl: false, hr: false, hd: false });
  c.sNext = ride.souls.findIndex((s) => s[0] >= x - 1);
  if (c.sNext < 0) c.sNext = ride.souls.length;
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

// One tick with a key down, then one with it up: a press.
const tap = (round, key) => {
  run(round, 4, { [key]: true });
  run(round, 4);
};
const jump = (round) => {
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  round.input.up = true;
  run(round, 4);
  round.input.up = false;
};

const heard = (e, extra = {}) => {
  const played = [];
  const pitches = [];
  const noop = () => {};
  const kit = { tone: (name, level, pitch) => (played.push(name), pitches.push(pitch)), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, lane: 1, h: 0, ...e }, kit);
  return { played, pitches };
};

// Seconds the pew is over `h` high in one jump, and what that is in distance at speed v.
const airOver = (h) => (2 * Math.sqrt(pew.JUMP_V ** 2 - 2 * pew.JUMP_G * h)) / pew.JUMP_G;

/* ------------------------------------------------------------ the room */

test("Ghoul Rush's Holy Roller is the Chapel's fourth room, between the Organ Loft and the Choir: lit, no key, no boss, a bonus round with its own track, about 66 seconds of ride", () => {
  const st = ghoul.stageById("chapel");
  assert.deepEqual(st.rooms, ["nave", "tower", "loft", "pew", "choir"]);
  assert.deepEqual([ROOM.title, ROOM.sub], ["Holy Roller", "The organist has been waiting for YOU"]);
  assert.equal(ROOM.dark, false);
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.equal(R.runner, "pew");
  assert.ok(!R.sled && !R.gallery && !R.track, "not another ride's room, and no side-view track");
  assert.equal(ghoul.ROOM_MUSIC.pew, "ghoulPewDirge");
  assert.ok(ghoulSfx.default.music.ghoulPewDirge, "its own track");
  assert.deepEqual(Object.keys(pew.PEW.monsters), [], "no new monster kinds");
  assert.equal(LOOKS.pew, PEW_LOOKS.pew);
  assert.equal(LOOKS.pew.pack, "pew");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.items) && Object.isFrozen(R.items[0]) && Object.isFrozen(R.souls), "frozen all the way down");
  assert.ok(ROOM.horde.length === 0 && ROOM.spawns.length === 0, "no monsters: the things in the nave are the pack's own");
  assert.ok(ROOM.candy.length === 0 && ROOM.items.length === 0, "no pickups of the game's own");
  assert.ok(ROOM.door > R.finish && floorOf(ROOM.door) > -Infinity, "a door past the finish to walk out of");
  assert.ok(R.finish > pew.PEW_START, "a ride");
  assert.equal(ghoul.timeFor(ghoul.roomFor("pew")), R.time);
  assert.ok(R.time >= 1.4 * pew.RIDE_S * 1000, `a ${R.time} ms clock for a ${pew.RIDE_S} s ride`);
  assert.match(R.how, /LEFT\/RIGHT change lane, UP jump, DOWN slide, hold space to shoot/);
  assert.equal(R.checks.length, 4);
  for (let i = 0; i < 4; i++) assert.ok(R.checks[i] > ROOM.start && R.checks[i] < R.finish && (i === 0 || R.checks[i] > R.checks[i - 1]), "checkpoints rise");
  assert.equal(ghoul.roomFor("pew").bonus, true);
});

test("Ghoul Rush's Holy Roller: no em dashes or Planny in what the player reads", () => {
  const text = JSON.stringify([ROOM.title, ROOM.sub, R.how, LOSE_WORDS]);
  assert.ok(!text.includes(String.fromCharCode(0x2014)));
  assert.ok(!/planny/i.test(text));
});

/* ---------------------------------------------------------- the course */

test("Ghoul Rush's Holy Roller's course: seeded and fixed, every thing a known kind in one of three lanes, sorted, with the grade's numbers (a ride of 60 to 75 seconds at the speed ramp)", () => {
  const again = ghoul.roomById("pew").ride;
  assert.equal(again, R, "the same data every time");
  const xs = R.items.map((i) => i[0]);
  assert.deepEqual([...xs].sort((a, b) => a - b), xs, "sorted");
  for (const [x, lane, kind, len] of R.items) {
    assert.ok(pew.KINDS[kind], kind);
    assert.ok([0, 1, 2].includes(lane), `lane ${lane}`);
    assert.ok(x > ROOM.start + 20 && x < R.finish - 20, `${kind} at ${x}`);
    assert.ok(len >= 0);
  }
  const kinds = new Set(R.items.map((i) => i[2]));
  for (const k of Object.keys(pew.KINDS)) assert.ok(kinds.has(k), `the course has a ${k}`);
  assert.equal(counted.length, R.items.filter((i) => i[2] !== "bell").length);
  assert.ok(counted.length >= 60 && counted.length <= 140, `${counted.length} obstacles`);
  assert.ok(pew.soulTotal(R) >= 200 && pew.soulTotal(R) <= 500, `${pew.soulTotal(R)} souls`);
  assert.ok(R.souls.filter((s) => s[3] === 1).length >= 3, "halos");
  for (const [x, lane, h, type] of R.souls) assert.ok(x > 0 && [0, 1, 2].includes(lane) && h >= 0.5 && h <= 6.5 && (type === 0 || type === 1), "a soul");
  assert.ok(pew.gargsOf(R).length >= 6 && pew.bellsOf(R).length >= 2, "gargoyles and bell ropes");
  // The ride: about 66 seconds, and the speed climbs the whole way.
  const secs = (Math.sqrt(pew.V0 ** 2 + 2 * pew.ACC * (R.finish - pew.PEW_START)) - pew.V0) / pew.ACC;
  assert.ok(secs >= 60 && secs <= 75, `${secs.toFixed(1)} s`);
  assert.ok(Math.abs(secs - pew.RIDE_S) < 0.5);
  let last = 0;
  for (let x = pew.PEW_START; x <= R.finish; x += 25) {
    const v = pew.speedAt(x);
    assert.ok(v >= last, "never slows");
    last = v;
  }
  assert.ok(pew.speedAt(R.finish) >= 2.2 * pew.speedAt(pew.PEW_START), "the ride more than doubles its speed");
  assert.equal(pew.speedAt(pew.PEW_START), pew.V0);
  assert.ok(pew.speedAt(R.finish) <= pew.V_MAX);
  assert.ok(Math.abs(pew.xAt(5) - (pew.PEW_START + pew.V0 * 5 + (pew.ACC * 25) / 2)) < 1e-9);
});

test("Ghoul Rush's Holy Roller's course is fair: every jumped thing leaves a window to jump, every slide covers its depth, at the speed it is met", () => {
  const margin = 0.12;
  for (const q of cues) {
    const k = pew.KINDS[q.kind];
    const v = pew.speedAt(q.x);
    if (k.answer === "JUMP") {
      const window = airOver(k.h) * v;
      assert.ok(window >= q.len + 2 * pew.HIT_Z + margin * v, `${q.id} at ${q.x}: a window of ${window.toFixed(1)} for ${q.len} deep`);
    }
    if (k.answer === "SLIDE") assert.ok((pew.SLIDE_MS / 1000) * v >= q.len + 2 * pew.HIT_Z + margin * v, `${q.id} slide`);
  }
  // A jump clears the highest low thing, and a slide goes under every high one.
  const top = Math.max(...Object.values(pew.KINDS).map((k) => k.h || 0).filter((h, i, a) => h < 5));
  assert.ok(pew.JUMP_V ** 2 / (2 * pew.JUMP_G) > top + 1.5, "the jump is higher than the highest low thing");
  assert.ok(pew.SLIDE_H < pew.LOW_Y && pew.STAND_H > pew.LOW_Y, "a standing pew hits a high thing and a slid one passes");
});

// Whether a cue stops the pew in its lane (a block, a gargoyle that has not been dealt with).
const stops = (q) => pew.KINDS[q.kind].answer === "SWITCH" || q.kind === "garg";

test("Ghoul Rush's Holy Roller's course always has a safe path: at every depth a lane is clear of blocks (some action answers the rest), and a player who changes lane no faster than one lane in 0.4 s can ride it start to finish", () => {
  // At every depth at least one lane has nothing that only a lane change answers, and no lane asks for jump and slide at once.
  for (let x = pew.PEW_START; x < R.finish; x += 0.5) {
    const blocked = [0, 1, 2].map((l) => cues.some((q) => q.lane === l && stops(q) && x >= q.x - pew.HIT_Z && x <= q.end + pew.HIT_Z));
    assert.ok(blocked.some((b) => !b), `a lane is open at ${x}`);
    for (let l = 0; l < 3; l++) {
      const acts = new Set(cues.filter((q) => q.lane === l && ["JUMP", "SLIDE"].includes(q.answer) && x >= q.x - pew.HIT_Z && x <= q.end + pew.HIT_Z).map((q) => q.answer));
      assert.ok(acts.size <= 1, `lane ${l} at ${x} asks for one action`);
    }
  }
  // The path: sample the ride every 0.05 s; a lane is out when a stopper (or two different actions too close together) is on it.
  const dt = 0.05;
  const step = 0.4 / dt;
  const n = Math.floor(pew.RIDE_S / dt);
  const out = (lane, i) => {
    const t = i * dt;
    const x = pew.xAt(t);
    const here = cues.filter((q) => q.lane === lane);
    if (here.some((q) => stops(q) && x >= q.x - pew.HIT_Z && x <= q.end + pew.HIT_Z)) return true;
    // Two different answers in one lane closer than 0.9 s apart: the first one's lane is out through the second.
    const acts = here.filter((q) => q.answer === "JUMP" || q.answer === "SLIDE");
    for (let a = 0; a < acts.length; a++) {
      for (let b = a + 1; b < acts.length; b++) {
        if (acts[a].answer === acts[b].answer) continue;
        const gap = (acts[b].x - acts[a].end) / pew.speedAt(acts[a].end);
        if (gap < 0.9 && x >= acts[a].x - pew.HIT_Z && x <= acts[b].end + pew.HIT_Z) return true;
      }
    }
    return false;
  };
  // reach[i][lane]: the pew can be in `lane` at step i. A move to the next lane takes `step` steps, the lane it ends in free at its end.
  let reach = new Array(n + 1).fill(0).map(() => [false, false, false]);
  reach[0][1] = true;
  for (let i = 0; i < n; i++) {
    for (let l = 0; l < 3; l++) {
      if (!reach[i][l]) continue;
      if (!out(l, i + 1)) reach[i + 1][l] = true;
      for (const m of [l - 1, l + 1]) {
        if (m < 0 || m > 2 || i + step > n) continue;
        if (!out(m, i + step) && !out(l, i + 1)) reach[i + step][m] = true;
      }
    }
  }
  assert.ok(reach[n].some(Boolean), "a path to the finish");
  // And no moment strands it: every step has some reachable lane.
  for (let i = 0; i <= n; i++) assert.ok(reach[i].some(Boolean), `reachable at ${(i * dt).toFixed(2)} s`);
});

test("Ghoul Rush's Holy Roller's rows telegraph by kind: the answers are JUMP, SLIDE, SWITCH or SHOOT and each thing has its own cause", () => {
  const causes = Object.values(pew.KINDS).map((k) => k.cause).filter(Boolean);
  assert.equal(new Set(causes).size, causes.length, "a cause each");
  assert.equal(causes.length, 11);
  for (const [name, k] of Object.entries(pew.KINDS)) {
    assert.ok(["JUMP", "SLIDE", "SWITCH", "SHOOT"].includes(k.answer), name);
    if (k.cause) assert.ok(k.cause.startsWith("pew"), k.cause);
  }
});

/* ------------------------------------------------------- lanes and wall */

test("Ghoul Rush's Holy Roller: a press of left or right moves one lane in a quick smooth slide with a lean, a press at the edge bumps the wall harmlessly, holding a key moves only once", () => {
  const round = synth();
  const c = round.runner;
  assert.equal(c.lane, 1);
  tap(round, "left");
  assert.equal(c.laneTo, 0);
  assert.ok(c.lane < 1 && c.lane > 0.9, "it has begun to slide");
  run(round, 60);
  assert.ok(c.lane > 0 && c.lane < 0.8, `mid-slide ${c.lane}`);
  assert.ok(c.lean < -0.2, "leaning into it");
  run(round, 140);
  assert.equal(c.lane, 0);
  run(round, 300);
  assert.ok(Math.abs(c.lean) < 0.1, "upright again");
  assert.equal(events(round, "pewLane").length, 1);
  round.events.length = 0;
  // At the edge: a bump (and a tiny shake), no lane, no heart.
  tap(round, "left");
  assert.equal(c.laneTo, 0);
  assert.ok(c.bump > 0);
  assert.equal(events(round, "pewBump").length, 1);
  assert.equal(events(round, "pewBump")[0].dir, -1);
  assert.equal(round.bonusRound.hearts, 5);
  run(round, 300);
  assert.equal(c.bump, 0);
  // To the other edge by two presses, and a bump on the right.
  tap(round, "right");
  tap(round, "right");
  run(round, 300);
  assert.equal(c.lane, 2);
  round.events.length = 0;
  tap(round, "right");
  assert.equal(events(round, "pewBump")[0].dir, 1);
  // A key held down is one press.
  pewAt(round, 400, 1);
  run(round, 800, { left: true });
  assert.equal(c.laneTo, 0, "held left is one lane");
  assert.equal(events(round, "pewBump").length, 1, "only the first bump");
  // The slide takes about 0.15 s a lane.
  pewAt(round, 450, 0);
  tap(round, "right");
  const ms = until(round, () => c.lane >= 1, 600) + 4;
  assert.ok(ms >= 120 && ms <= 220, `${ms} ms a lane`);
});

test("Ghoul Rush's Holy Roller: UP jumps about 6 high for two thirds of a second, DOWN slides (it ducks under the high things), and DOWN in the air fast-falls and slides on landing", () => {
  const round = synth();
  const c = round.runner;
  const peaks = [];
  jump(round);
  assert.ok(c.h > 0 && round.you.state === "air");
  let t = 4;
  let peak = 0;
  for (; c.h > 0 && t < 2000; t += 4) {
    ghoul.advance(round, 4, steady);
    peak = Math.max(peak, c.h);
  }
  peaks.push(peak);
  assert.ok(peak > 5.5 && peak < 6.3, `${peak}`);
  assert.ok(t > 600 && t < 720, `${t} ms in the air`);
  assert.equal(events(round, "pewJump").length, 1);
  assert.equal(events(round, "pewLand").length, 1);
  assert.equal(round.you.state, "run");
  // A press early in a jump is forgotten; one just before the landing jumps on it.
  round.events.length = 0;
  jump(round);
  run(round, 150);
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  until(round, () => c.h <= 0, 2000);
  run(round, 100);
  assert.equal(events(round, "pewJump").length, 1, "a press at the top is forgotten by the landing");
  assert.equal(c.h, 0);
  jump(round);
  until(round, () => c.vh < 0 && c.h < 1.2, 2000);
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  run(round, 120);
  assert.equal(events(round, "pewJump").length, 3, "a press just before the landing jumps on it");
  assert.ok(c.h > 0);
  run(round, 800);
  // Slide.
  const slider = synth();
  tap(slider, "down");
  assert.ok(slider.runner.slide > 0 && slider.you.ducking);
  assert.equal(events(slider, "pewSlide").length, 1);
  run(slider, pew.SLIDE_MS - 100);
  assert.ok(slider.you.ducking, "still low");
  run(slider, 200);
  assert.equal(slider.you.ducking, false, "up again after SLIDE_MS");
  // UP breaks a slide into a jump.
  tap(slider, "down");
  jump(slider);
  assert.equal(slider.runner.slide, 0);
  assert.ok(slider.runner.h > 0);
  // In the air DOWN fast-falls: down sooner than a plain jump, and a slide on landing.
  const dive = synth();
  jump(dive);
  run(dive, 100);
  tap(dive, "down");
  assert.equal(events(dive, "pewDive").length, 1);
  const fall = until(dive, () => dive.runner.h <= 0, 1500);
  assert.ok(fall < 250, `fast-fell in ${fall} ms`);
  assert.ok(dive.runner.slide > 0, "slides on landing");
});

/* --------------------------------------------------- each kind of thing */

// Plays the right answer to the thing at `q` (the cue) with the real rules: returns the round after the pass.
function pass(kind, answer, { len = 0, lane = 1, x = 160 } = {}) {
  const round = synth({ items: [[x, lane, kind, len]] });
  round.input.fire = false;
  pewAt(round, 20, lane);
  const q = pew.cuesOf(round.spec.ride)[0];
  let did = false;
  const stop = x + 60;
  while (round.you.x < stop && round.phase === "play") {
    const c = round.runner;
    const toNear = (q.x - round.you.x) / c.v;
    const toMid = ((q.x + q.end) / 2 - round.you.x) / c.v;
    if (!did && answer === "JUMP" && toMid <= 0.33) (jump(round), (did = true));
    else if (!did && answer === "SLIDE" && toNear <= 0.16) (tap(round, "down"), (did = true));
    else if (!did && answer === "SWITCH" && toNear <= 1) (tap(round, lane === 0 ? "right" : "left"), (did = true));
    else ghoul.advance(round, 4, steady);
  }
  return round;
}

test("Ghoul Rush's Holy Roller: a block (a pillar, a confessional, a crosswise pew) is answered by changing lane and costs a heart (its cause) if met", () => {
  for (const kind of ["pillar", "confessional", "pewx"]) {
    const ok = pass(kind, "SWITCH");
    assert.equal(ok.bonusRound.hearts, 5, `${kind}: switching clears it`);
    assert.equal(events(ok, "lose").length, 0);
    const bad = pass(kind, "NONE");
    assert.equal(bad.bonusRound.hearts, 4, `${kind}: met`);
    assert.equal(events(bad, "lose")[0].cause, pew.KINDS[kind].cause);
    // Neither a jump nor a slide gets over a block.
    assert.equal(pass(kind, "JUMP").bonusRound.hearts, 4, `${kind}: no jumping a block`);
    assert.equal(pass(kind, "SLIDE").bonusRound.hearts, 4, `${kind}: no sliding under a block`);
  }
});

test("Ghoul Rush's Holy Roller: a low thing (kneeler, candle stand, flagstone cracks, crypt hatch) is cleared by a jump and costs a heart otherwise, a slide does not clear it", () => {
  for (const kind of ["kneeler", "stand", "cracks", "hatch"]) {
    const len = kind === "cracks" ? 7 : 0;
    const ok = pass(kind, "JUMP", { len });
    assert.equal(ok.bonusRound.hearts, 5, `${kind}: a jump clears it`);
    const bad = pass(kind, "NONE", { len });
    assert.equal(bad.bonusRound.hearts, 4, `${kind}: met`);
    assert.equal(events(bad, "lose")[0].cause, pew.KINDS[kind].cause);
    assert.equal(pass(kind, "SLIDE", { len }).bonusRound.hearts, 4, `${kind}: a slide is no jump`);
    // A lane change clears it too.
    assert.equal(pass(kind, "SWITCH", { len }).bonusRound.hearts, 5, `${kind}: or a lane change`);
  }
});

test("Ghoul Rush's Holy Roller: a high thing (censer, banner, fallen beam) is cleared by a slide and costs a heart standing or jumping", () => {
  for (const kind of ["censer", "banner", "beam"]) {
    assert.equal(pass(kind, "SLIDE").bonusRound.hearts, 5, `${kind}: a slide goes under`);
    const bad = pass(kind, "NONE");
    assert.equal(bad.bonusRound.hearts, 4, `${kind}: met standing`);
    assert.equal(events(bad, "lose")[0].cause, pew.KINDS[kind].cause);
    assert.equal(pass(kind, "JUMP").bonusRound.hearts, 4, `${kind}: a jump goes into it`);
    assert.equal(pass(kind, "SWITCH").bonusRound.hearts, 5, `${kind}: or a lane change`);
  }
});

test("Ghoul Rush's Holy Roller: a thing in another lane is no danger, and a hit in the lane it is in is only in that lane", () => {
  for (const lane of [0, 2]) {
    const round = synth({ items: [[100, lane, "pillar", 0]] });
    round.input.fire = false;
    pewAt(round, 20, 1);
    until(round, () => round.you.x > 140, 5000);
    assert.equal(round.bonusRound.hearts, 5, `lane ${lane} thing, pew in 1`);
  }
  // Half way between two lanes is in neither (the slide takes it past a thing at once).
  const mid = synth({ items: [[60, 0, "pillar", 0]] });
  pewAt(mid, 30, 1);
  mid.runner.lane = 0.5;
  mid.runner.laneTo = 0.5;
  until(mid, () => mid.you.x > 90, 3000);
  assert.equal(mid.bonusRound.hearts, 5, "0.5 lanes over is clear of lane 0");
});

/* -------------------------------------------------------------- a hit */

test("Ghoul Rush's Holy Roller: a hit costs one of the five hearts (never a life or a die), blinks the pew safe for BONUS_SAFE_MS, breaks the combo and shoves the pew into the nearest calm lane", () => {
  const round = synth({ items: [[100, 1, "pillar", 0], [100, 0, "pillar", 0], [120, 1, "kneeler", 0], [122, 0, "kneeler", 0]], souls: [] });
  round.dice = 2;
  round.input.fire = false;
  pewAt(round, 60, 1);
  round.runner.combo = 12;
  round.runner.mult = 2;
  round.runner.comboMs = 1500;
  until(round, () => events(round, "lose").length > 0, 3000);
  const lose = events(round, "lose");
  assert.equal(lose.length, 1);
  assert.equal(lose[0].cause, "pewPillar");
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(round.lives, 3, "no run life");
  assert.equal(round.dice, 2, "no die");
  assert.equal(round.phase, "play", "the ride rolls on");
  assert.equal(round.runner.combo, 0, "the combo is broken");
  assert.equal(round.runner.mult, 1);
  assert.equal(round.runner.laneTo, 2, "shoved to the nearest calm lane (the one beside the blocked pair)");
  assert.ok(round.you.safeMs > 0 && round.you.safeMs <= ghoul.BONUS_SAFE_MS, "blinking safe");
  assert.deepEqual(round.bonusRound.perf.hits.length, 1);
  const crash = events(round, "pewCrash");
  assert.equal(crash.length, 1);
  assert.equal(crash[0].what, "pillar");
  // While safe a second touch costs nothing; once safe has passed it costs again.
  pewAt(round, 115, 1);
  round.you.safeMs = 500;
  until(round, () => round.you.x > 140, 3000);
  assert.equal(round.bonusRound.hearts, 4, "safe: the kneeler costs nothing");
  pewAt(round, 115, 1);
  round.you.safeMs = 0;
  round.runner.hit = {};
  until(round, () => events(round, "lose").length > 1 || round.you.x > 140, 3000);
  assert.equal(round.bonusRound.hearts, 3, "unsafe: it costs a heart");
  assert.equal(events(round, "lose")[1].cause, "pewKneeler");
});

test("Ghoul Rush's Holy Roller: the same thing never costs twice, and the Garlic shield takes a hit instead of a heart", () => {
  const round = synth({ items: [[80, 1, "confessional", 0]] });
  round.input.fire = false;
  pewAt(round, 40, 1);
  round.runner.laneTo = 1;
  // A long block met head on, with the shove disabled by holding the lane: only one heart goes.
  until(round, () => round.you.x > 140, 5000);
  assert.equal(round.bonusRound.hearts, 4, "one heart for one thing");
  const g = synth({ items: [[80, 1, "pillar", 0]] });
  g.input.fire = false;
  pewAt(g, 40, 1);
  g.you.garlic = true;
  until(g, () => g.you.x > 120, 4000);
  assert.equal(g.bonusRound.hearts, 5);
  assert.equal(g.you.garlic, false, "spent");
});

/* ------------------------------------------------- gargoyles and bells */

test("Ghoul Rush's Holy Roller: a gargoyle perched in the arches wakes GARG_LEAD_S short of it, shudders, drops into its lane and stands there; met standing it costs a heart (pewGargoyle), a lane change passes it", () => {
  const round = synth({ items: [[300, 1, "garg", 0]] });
  round.input.fire = false;
  pewAt(round, 20, 1);
  const g = round.runner.gargs[0];
  assert.equal(g.state, "perch");
  until(round, () => g.state !== "perch", 12000);
  const lead = (300 - round.you.x) / round.runner.v;
  assert.equal(g.state, "warn");
  assert.ok(lead <= pew.GARG_LEAD_S + 0.05 && lead > pew.GARG_LEAD_S - 0.2, `woke ${lead.toFixed(2)} s short`);
  assert.equal(events(round, "pewGargWarn").length, 1);
  until(round, () => g.state === "drop", 1000);
  assert.equal(g.state, "drop");
  assert.ok(pew.gargRise(g) > 0, "still falling");
  until(round, () => g.state === "stand", 1000);
  assert.equal(events(round, "pewGargDrop").length, 1);
  assert.equal(pew.gargRise(g), 0);
  const left = (300 - round.you.x) / round.runner.v;
  assert.ok(left >= 0.4, `${left.toFixed(2)} s of warning between its landing and the pew`);
  until(round, () => events(round, "lose").length > 0 || round.you.x > 330, 3000);
  assert.equal(events(round, "lose")[0].cause, "pewGargoyle");
  // A lane change past it costs nothing.
  const dodge = synth({ items: [[300, 1, "garg", 0]] });
  dodge.input.fire = false;
  pewAt(dodge, 20, 1);
  until(dodge, () => dodge.runner.gargs[0].state === "stand", 12000);
  tap(dodge, "right");
  until(dodge, () => dodge.you.x > 330, 3000);
  assert.equal(dodge.bonusRound.hearts, 5);
});

test("Ghoul Rush's Holy Roller: two bolts shoot a gargoyle (150 points, an act), one only chips it, a bolt in another lane misses, and what is shot stays shot after a restart", () => {
  const round = synth({ items: [[300, 1, "garg", 0]] });
  round.input.fire = false;
  pewAt(round, 20, 1);
  const g = round.runner.gargs[0];
  until(round, () => g.state === "stand", 12000);
  const score = round.score;
  run(round, 4, { fire: true });
  until(round, () => events(round, "pewGargChip").length > 0 || g.state === "broken", 1000, steady);
  assert.equal(events(round, "pewGargChip").length, 1, "the first bolt chips");
  assert.equal(g.hp, 1);
  assert.notEqual(g.state, "broken");
  run(round, 300, { fire: true });
  assert.equal(g.state, "broken", "the second breaks it");
  assert.equal(events(round, "pewGargHit").length, 1);
  assert.equal(round.score - score >= pew.GARG_POINTS, true, "150 points");
  assert.equal(round.bonusRound.perf.acts, 1);
  run(round, 2500);
  assert.equal(round.bonusRound.hearts, 5, "a broken gargoyle hurts nothing");
  // Another lane: the bolts miss.
  const side = synth({ items: [[300, 1, "garg", 0]] });
  side.input.fire = false;
  pewAt(side, 20, 1);
  until(side, () => side.runner.gargs[0].state === "stand", 12000);
  tap(side, "left");
  run(side, 300);
  run(side, 600, { fire: true });
  assert.equal(side.runner.gargs[0].state, "stand");
  assert.equal(side.runner.gargs[0].hp, 2);
  // What was shot stays shot after a restart in the room.
  pew.PEW.place[0](round, { groundAt: ghoul.groundAt });
  assert.equal(round.runner.gargs[0].state, "broken");
});

test("Ghoul Rush's Holy Roller: shooting a bell rope rings the bell (100 points, an act) and stuns every gargoyle in the next BELL_S seconds, which then never drop and never hurt; a rope is no obstacle", () => {
  const round = synth({ items: [[120, 1, "bell", 0], [200, 1, "garg", 0], [205, 0, "garg", 0], [900, 2, "garg", 0]] });
  round.input.fire = false;
  pewAt(round, 20, 1);
  assert.equal(round.runner.bells[0], false);
  const score = round.score;
  until(round, () => round.you.x > 60, 3000);
  run(round, 4, { fire: true });
  until(round, () => round.runner.bells[0], 1500);
  assert.equal(round.runner.bells[0], true);
  const ring = events(round, "pewBell")[0];
  assert.equal(ring.stunned, 2, "the two gargoyles in range");
  assert.equal(round.runner.gargs[0].state, "stun");
  assert.equal(round.runner.gargs[1].state, "stun");
  assert.equal(round.runner.gargs[2].state, "perch", "the far one is not");
  assert.ok(round.score - score >= pew.BELL_POINTS);
  assert.equal(round.bonusRound.perf.acts, 3, "the bell and two stunned");
  until(round, () => round.you.x > 240, 6000);
  assert.equal(round.bonusRound.hearts, 5, "a stunned gargoyle and a rope hurt nothing");
  assert.equal(round.runner.gargs[0].state, "stun");
  // A bell stays rung after a restart.
  pew.PEW.place[0](round, { groundAt: ghoul.groundAt });
  assert.equal(round.runner.bells[0], true);
  // Passing under a rope that is not shot costs nothing either.
  const rope = synth({ items: [[100, 1, "bell", 0]] });
  rope.input.fire = false;
  pewAt(rope, 20, 1);
  until(rope, () => rope.you.x > 150, 4000);
  assert.equal(rope.bonusRound.hearts, 5);
});

/* ------------------------------------------------------ souls and combo */

test("Ghoul Rush's Holy Roller: wax souls are taken in passing (lane and height), and each builds the combo: the multiplier is 1 plus one for each COMBO_STEP in a row (to MULT_MAX), each soul pays 10 times it", () => {
  const line = [];
  for (let i = 0; i < 24; i++) line.push([60 + i * 3, 1, 1.5, 0]);
  const round = synth({ souls: line });
  round.input.fire = false;
  pewAt(round, 20, 1);
  const score = round.score;
  until(round, () => round.you.x > 160, 6000);
  assert.equal(round.runner.got, 24);
  assert.equal(events(round, "pewSoul").length, 24);
  assert.equal(round.runner.combo, 24);
  assert.equal(round.runner.best, 24);
  assert.equal(round.runner.mult, pew.multOf(24));
  assert.equal(pew.multOf(24), 4);
  assert.equal(pew.multOf(7), 1);
  assert.equal(pew.multOf(8), 2);
  assert.equal(pew.multOf(1000), pew.MULT_MAX);
  let want = 0;
  for (let n = 1; n <= 24; n++) want += pew.SOUL_POINTS * pew.multOf(n);
  assert.equal(round.score - score, want);
  assert.ok(events(round, "pewSoul").some((e) => e.up), "a multiplier step is marked");
  // A soul in another lane or too high is missed; a jump takes the high one.
  const miss = synth({ souls: [[60, 0, 1.5, 0], [90, 1, 5.8, 0], [120, 2, 1.5, 0]] });
  miss.input.fire = false;
  pewAt(miss, 20, 1);
  until(miss, () => miss.you.x > 160, 4000);
  assert.equal(miss.runner.got, 0);
  assert.ok(miss.runner.souls.every((s) => s === 2), "all missed");
  const high = synth({ souls: [[100, 1, 5.5, 0]] });
  high.input.fire = false;
  pewAt(high, 20, 1);
  until(high, () => (100 - high.you.x) / high.runner.v <= 0.33, 4000);
  jump(high);
  until(high, () => high.you.x > 130, 2000);
  assert.equal(high.runner.got, 1, "a jump takes a soul in an arc");
  const low = synth({ souls: [[100, 1, 0.9, 0]] });
  low.input.fire = false;
  pewAt(low, 20, 1);
  until(low, () => (100 - low.you.x) / low.runner.v <= 0.1, 4000);
  tap(low, "down");
  until(low, () => low.you.x > 130, 2000);
  assert.equal(low.runner.got, 1, "a slide takes a soul in a line through it");
});

test("Ghoul Rush's Holy Roller: the combo runs out COMBO_MS after the last soul and a hit breaks it", () => {
  const round = synth({ souls: [[60, 1, 1.5, 0], [63, 1, 1.5, 0], [66, 1, 1.5, 0]] });
  round.input.fire = false;
  pewAt(round, 20, 1);
  until(round, () => round.runner.combo === 3, 4000);
  assert.equal(round.runner.combo, 3);
  assert.equal(round.runner.comboMs, pew.COMBO_MS);
  run(round, pew.COMBO_MS + 50);
  assert.equal(round.runner.combo, 0, "run out");
  assert.equal(round.runner.mult, 1);
  assert.equal(round.runner.best, 3, "the best is kept");
});

test("Ghoul Rush's Holy Roller: a halo pulls the souls of the lanes beside you in for MAG_MS, and without it they are missed", () => {
  const souls = [[60, 1, 2.4, 1]];
  for (let i = 0; i < 10; i++) souls.push([100 + i * 3, i % 2 ? 0 : 2, 1.5, 0]);
  const round = synth({ souls });
  round.input.fire = false;
  pewAt(round, 20, 1);
  until(round, () => round.you.x > 170, 6000);
  assert.equal(events(round, "pewHalo").length, 1);
  assert.equal(round.runner.got, 10, "all ten side souls pulled in");
  assert.ok(round.score >= pew.HALO_POINTS);
  const none = synth({ souls: souls.slice(1) });
  none.input.fire = false;
  pewAt(none, 20, 1);
  until(none, () => none.you.x > 170, 6000);
  assert.equal(none.runner.got, 0, "without the halo they are out of reach");
  // The magnet times out.
  const late = synth({ souls: [[60, 1, 2.4, 1], [400, 0, 1.5, 0]] });
  late.input.fire = false;
  pewAt(late, 20, 1);
  until(late, () => late.you.x > 200, 6000);
  assert.ok(late.runner.magnet === 0 || late.runner.magnet < pew.MAG_MS, "the magnet counts down");
  until(late, () => late.you.x > 430, 6000);
  assert.equal(late.runner.got, 0, "too late for the far soul");
});

/* ----------------------------------------------------------- the ramp */

test("Ghoul Rush's Holy Roller speeds up the whole way: the pace climbs by the second, the organ swells at each speed in SWELLS, and an idle ride over the whole course ends after about 66 seconds with 3 to 9 dice", () => {
  const round = pewRound();
  round.infinite = true;
  round.input.fire = false;
  const samples = [];
  const swells = [];
  let t = 0;
  for (; t < 90000 && round.phase === "play"; t += 4) {
    ghoul.advance(round, 4, never);
    if (t % 10000 === 0) samples.push(round.runner.v);
    for (const e of round.events) if (e.type === "pewSpeed") swells.push([t, e.n]);
    round.events.length = 0;
  }
  assert.equal(round.phase, "clear");
  assert.ok(t >= 63000 && t <= 70000, `${t} ms to the end`);
  for (let i = 1; i < samples.length; i++) assert.ok(samples[i] > samples[i - 1] + 4, `faster at ${i * 10} s: ${samples.map((s) => s.toFixed(0))}`);
  assert.deepEqual(swells.map((s) => s[1]), [0, 1, 2, 3], "four swells in order");
  assert.ok(swells[0][0] > 8000 && swells[3][0] < t, "spread over the ride");
  const b = round.bonusRound;
  assert.equal(b.won, true);
  assert.ok(b.dice >= BONUS_FLOOR && b.dice <= 9, `${b.dice} dice`);
  assert.equal(round.runner.done, true);
});

test("Ghoul Rush's Holy Roller's art rises with the pace: the beat is the organ's, 132 to the minute, throbbing from its stroke", () => {
  assert.equal(BPM, 132);
  assert.ok(pulse(0) > 0.99 && pulse(5000 % (60000 / 132)) < 1);
  const beat = 60000 / BPM;
  assert.ok(pulse(beat * 3 + 1) > 0.95, "on the stroke");
  assert.ok(pulse(beat * 3 + beat * 0.9) < 0.1, "dying away");
  const track = ghoulSfx.default.music.ghoulPewDirge;
  assert.equal(track.bpm, BPM, "the track keeps the beat the pillars throb to");
});

/* ------------------------------------------------------------- grading */

test("Ghoul Rush's Holy Roller's grade: 3 to 9 dice by hearts left, clean passes, gargoyles and bells (the acts), and the steady die (souls taken share)", () => {
  const mk = (hearts, hits, acts, steadyDie) => {
    const b = makeBonus({ stats: { kills: 0 } });
    b.hearts = hearts;
    Object.assign(b.perf, { total: counted.length, hits: Array.from({ length: hits }, (_, i) => `x${i}`), acts, goal: pew.ACTS_GOAL, steady: steadyDie });
    return b;
  };
  assert.equal(diceFor(mk(5, 0, pew.ACTS_GOAL, true)), 9);
  assert.equal(diceFor(mk(1, counted.length, 0, false)), BONUS_FLOOR);
  assert.equal(diceFor(mk(5, 0, 0, false)), 7, "no acts and no steady");
  assert.equal(diceFor(mk(5, 0, pew.ACTS_GOAL - 1, true)), 8);
  assert.equal(diceFor(mk(3, 0, pew.ACTS_GOAL, true)), 8, "fewer hearts, one die less");
  assert.ok(pew.ACTS_GOAL <= pew.gargsOf(R).length + pew.bellsOf(R).length + pew.gargsOf(R).length, "the acts goal is reachable");
  // The steady die is the share of the souls laid out.
  const round = synth({ souls: Array.from({ length: 10 }, (_, i) => [60 + i * 3, 1, 1.5, 0]) });
  round.input.fire = false;
  pewAt(round, 20, 1);
  until(round, () => round.runner.got >= 5, 4000);
  assert.equal(round.bonusRound.perf.steady, false, "5 of 10 is under the share");
  until(round, () => round.runner.got >= 6, 4000);
  assert.equal(round.bonusRound.perf.steady, true, `6 of 10 is ${pew.SOUL_SHARE}`);
  assert.equal(pew.soulShare(round.spec.ride, round.runner), 0.6);
  // The room's own count.
  const real = pewRound();
  assert.equal(real.bonusRound.perf.total, counted.length);
  assert.equal(real.bonusRound.perf.goal, pew.ACTS_GOAL);
});

/* ------------------------------------------------ the end of the round */

test("Ghoul Rush's Holy Roller: the last heart gone ends the round with nothing at once (no life lost, the dice in hand kept) and the run goes on to the Choir", () => {
  const round = synth({ items: [[100, 1, "pillar", 0]] });
  round.dice = 2;
  round.input.fire = false;
  pewAt(round, 50, 1);
  round.bonusRound.hearts = 1;
  const score = round.score;
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
  assert.equal(round.phase, "clear");
  run(round, ghoul.CARD_LOST_MS + 100);
  assert.equal(round.spec.id, "choir");
  assert.equal(round.bonusRound, null);
  assert.equal(round.runner, null, "the shared ride slot is empty again");
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.ok(["ready", "bossintro"].includes(round.phase), `the next room (the Choir's boss) begins: ${round.phase}`);
});

test("Ghoul Rush's Holy Roller: the checkpoints are passed in order (an event each) and the place hook puts the pew back at the last one passed, keeping its souls and what it shot", () => {
  const round = synth({ checks: [100, 200, 300], souls: [[60, 1, 1.5, 0], [150, 1, 1.5, 0], [250, 1, 1.5, 0]] });
  round.input.fire = false;
  pewAt(round, 50, 1);
  until(round, () => round.runner.check >= 1, 6000);
  const checks = events(round, "pewCheck");
  assert.deepEqual(checks.map((e) => e.n), [1, 2]);
  assert.equal(round.runner.got, 2);
  pew.PEW.place[0](round, { groundAt: ghoul.groundAt });
  assert.equal(round.runner.check, 1);
  assert.equal(round.you.x, 200, "back at the last checkpoint");
  assert.equal(round.runner.got, 2, "the souls taken stay taken");
  assert.equal(round.runner.lane, 1);
  assert.equal(round.runner.v, pew.speedAt(200));
  // Souls behind the checkpoint are behind it: not offered again.
  assert.ok(round.runner.souls[0] !== 0 && round.runner.souls[1] !== 0);
});

test("Ghoul Rush's Holy Roller: at the finish the ride ends, Planny steps to the door and the card pays 3 to 9 Lucky dice (more for a clean ride than a rough one)", () => {
  const rough = pewRound();
  rough.infinite = true;
  rough.input.fire = false;
  until(rough, () => rough.phase === "clear", 80000, never);
  assert.equal(rough.bonusRound.won, true);
  const dice = rough.bonusRound.dice;
  assert.ok(dice >= 3 && dice <= 9);
  assert.equal(rough.runner.done, true);
  run(rough, ghoul.CARD_MS + 100);
  assert.equal(rough.spec.id, "choir");
  assert.equal(rough.dice, Math.min(9, dice));
});

test("Ghoul Rush's Holy Roller: endless lives (round.infinite) spare the hearts for every cause, through the same lose path", () => {
  for (const [kind, len] of [["pillar", 0], ["confessional", 0], ["pewx", 0], ["kneeler", 0], ["stand", 0], ["cracks", 7], ["hatch", 0], ["censer", 0], ["banner", 0], ["beam", 0]]) {
    const r = synth({ items: [[80, 1, kind, len]] });
    r.infinite = true;
    r.input.fire = false;
    pewAt(r, 30, 1);
    until(r, () => events(r, "lose").length > 0, 3000);
    assert.equal(events(r, "lose").length, 1, kind);
    assert.equal(events(r, "lose")[0].cause, pew.KINDS[kind].cause, kind);
    assert.equal(r.bonusRound.hearts, 5, kind);
    assert.equal(r.lives, 3);
  }
  const g = synth({ items: [[300, 1, "garg", 0]] });
  g.infinite = true;
  g.input.fire = false;
  pewAt(g, 20, 1);
  until(g, () => events(g, "lose").length > 0, 12000);
  assert.equal(g.bonusRound.hearts, 5);
});

test("Ghoul Rush's Holy Roller: no random number is drawn in the room (a ride of 20 seconds, moving, jumping, sliding and shooting, on a draw that throws)", () => {
  const round = pewRound();
  round.infinite = true;
  for (let t = 0; t < 20000; t += 4) {
    round.input.fire = true;
    round.input.left = t % 1200 < 4;
    round.input.right = t % 1700 < 4;
    round.input.down = t % 900 < 4;
    if (t % 1000 === 0) round.input.jump = ghoul.JUMP_BUFFER_MS;
    ghoul.advance(round, 4, never);
    round.events.length = 0;
  }
  assert.equal(round.phase, "play");
});

/* ------------------------------------------------------ sounds and words */

test("Ghoul Rush's Holy Roller: every event has a voice that plays once, every cause has words and a sound, a soul's tick climbs with the combo, and the voices are tones that exist", () => {
  assert.deepEqual(Object.keys(EVENT_VOICE).sort(), [...pew.EVENTS].sort(), "a voice for every event and no more");
  const tones = ghoulSfx.default.tones;
  for (const [event, [kind, act]] of Object.entries(EVENT_VOICE)) {
    const name = PEW_VOICES[kind] && PEW_VOICES[kind][act];
    assert.ok(name, `${event} has a ${kind}.${act} voice`);
    assert.ok(tones[name], `${name} exists`);
    assert.equal(VOICES[kind][act], name, "joined to the game's voices");
    const played = heard({ type: event, what: "kneeler", points: 50, mult: 2, combo: 5, share: 0.7, stunned: 1 }).played;
    assert.ok(played.includes(name), `${event} plays ${name}`);
    assert.equal(played.length, 1, `${event} plays once`);
  }
  const causes = Object.values(pew.KINDS).map((k) => k.cause).filter(Boolean);
  for (const cause of causes) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause] && LOSE_SOUNDS[cause].length === 3, `${cause} has a sound`);
    assert.ok(heard({ type: "lose", cause, hearts: 3 }).played.length > 0, `${cause} sounds`);
  }
  assert.equal(Object.keys(LOSE_WORDS).length, causes.length, "words for every cause and no more");
  const pitches = [];
  for (const [combo, mult] of [[1, 1], [6, 1], [9, 2], [30, 4]]) pitches.push(heard({ type: "pewSoul", combo, mult }).pitches[0]);
  for (let i = 1; i < pitches.length; i++) assert.ok(pitches[i] > pitches[i - 1], `the soul tick climbs: ${pitches}`);
  // The tones stay under 1.2 s and the track is made of known parts.
  for (const name of Object.keys(tones).filter((n) => n.startsWith("ghoulPew"))) {
    for (const l of tones[name].layers) assert.ok((l.seconds || 0) + (l.delay || 0) <= 1.2 + 1e-9, `${name} layer under 1.2 s`);
  }
  const track = ghoulSfx.default.music.ghoulPewDirge;
  assert.ok(track.bpm >= 120, "a driving tempo");
  for (const id of track.order) assert.ok(track.patterns[id], id);
  for (const p of Object.values(track.patterns)) {
    const lens = Object.values(p).map((line) => line.split(/\s+/).filter((t) => t && t !== "|").length);
    assert.ok(lens.every((n) => n === lens[0]) && lens[0] % 16 === 0, `voices of one length: ${lens}`);
  }
  assert.equal(track.order.length % 2, 0, "built from parts that loop");
  for (const text of [JSON.stringify(ghoulSfx.default.music.ghoulPewDirge)]) assert.ok(!text.includes(String.fromCharCode(0x2014)));
});

test("Ghoul Rush's Holy Roller: the room's own names do not collide with the game's (events, causes, voice kinds)", () => {
  for (const e of pew.EVENTS) assert.ok(e.startsWith("pew"), e);
  for (const k of Object.keys(PEW_VOICES)) assert.ok(k.startsWith("pew"), k);
  for (const k of Object.keys(LOSE_WORDS)) assert.ok(k.startsWith("pew"), k);
  assert.deepEqual(Object.keys(pew.PEW).filter((key) => ["hazards", "bosses", "boss"].includes(key)), []);
  assert.equal(typeof ghoul.ROOM_MUSIC.pew, "string");
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Holy Roller draws on a fake canvas at many moments without throwing: the whole nave from behind, each kind of thing at every distance, every lane, in the air and sliding, each gargoyle state, a rung bell, the halo, a hit, the finish, the cards and the stage select going straight into it", () => {
  const calls = { n: 0 };
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => (calls.n++, {})), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["chapel"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "pew") through(r);
  r.lives = 99;
  r.phase = "play";
  const states = ["perch", "warn", "drop", "stand", "stun", "broken"];
  let k = 0;
  for (let x = ROOM.start + 5; x < R.finish; x += 53) {
    k++;
    r.phase = "play";
    r.runner.done = false;
    Object.assign(r.you, { x, y: 12, safeMs: k % 5 === 0 ? 1e9 : 0, out: 0 });
    const c = r.runner;
    c.lane = [0, 1, 2, 0.4, 1.6][k % 5];
    c.laneTo = Math.round(c.lane);
    c.h = k % 3 === 0 ? 3 + (k % 4) : 0;
    c.slide = k % 4 === 1 ? 400 : 0;
    c.bump = k % 7 === 0 ? 100 : 0;
    c.lean = ((k % 3) - 1) * 0.7;
    c.magnet = k % 6 === 0 ? 2000 : 0;
    c.combo = k % 9;
    c.mult = 1 + (k % 3);
    c.v = pew.speedAt(x);
    c.gargs = c.gargs.map((gg, i) => ({ ...gg, state: states[(i + k) % 6], t: 100, hp: 1 + ((i + k) % 2) }));
    c.bells = c.bells.map((_, i) => (i + k) % 2 === 0);
    r.shots.push({ x: x + 12, y: 14, vx: 130, vy: 0, gone: 0, lane: k % 3 });
    r.you.safeMs = 1e9;
    for (let n = 0; n < 3; n++) g.tick(16);
    r.shots.length = 0;
  }
  assert.ok(calls.n > 20000, `a lot was drawn (${calls.n})`);
  assert.equal(r.spec.id, "pew");
  // A crash and the lost card.
  const crash = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  crash.resize(900, 900);
  crash.key("action");
  crash.tick(16);
  const cr = crash.round;
  through(cr);
  cr.offer = ["chapel"];
  cr.phaseMs = 0;
  ghoul.pickStage(cr, 0);
  while (cr.spec.id !== "pew") through(cr);
  cr.phase = "play";
  cr.you.safeMs = 0;
  const pillar = cues.find((q) => q.kind === "pillar");
  Object.assign(cr.you, { x: pillar.x - 3 });
  cr.runner.lane = cr.runner.laneTo = pillar.lane;
  for (let n = 0; n < 40; n++) crash.tick(16);
  assert.ok(cr.bonusRound.hearts < cr.bonusRound.max || cr.phase !== "play", "the crash draws too");
  for (const won of [true, false]) {
    const d = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    d.resize(900, 900);
    d.key("action");
    d.tick(16);
    const dr = d.round;
    through(dr);
    dr.offer = ["chapel"];
    dr.phaseMs = 0;
    ghoul.pickStage(dr, 0);
    while (dr.spec.id !== "pew") through(dr);
    dr.phase = "play";
    endBonus(dr, won, { ROOM_POINTS: 300, award: (rd, pts) => (rd.score += pts) });
    for (let n = 0; n < 12; n++) {
      d.tick(16);
      bonusTick(dr, { tone() {}, fx: {} });
    }
  }
  // The stage select goes straight into it.
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.stageSelect();
  const p = pick.round;
  const at = ghoul.STAGES.findIndex((s) => s.id === "chapel");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "pew");
  assert.equal(p.runner.id, "pew");
  assert.equal(p.runner.lane, 1);
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
// A bot that plays it well: it steers to the lane with the souls and the bells that has nothing in the way for the next
// second or so, jumps and slides at the right moment, and holds the blaster. `miss` is the share of answers it fails to give.
function goodBot(round, seed, miss = 0.03) {
  const { you, runner: c, input: inp } = round;
  inp.left = inp.right = inp.down = false;
  inp.fire = true;
  if (round.phase !== "play" || !c || c.done) return;
  const v = c.v;
  const soulsOf = R.souls;
  const ok = (q) => mix(seed * 7919, q.i * 31 + q.lane * 7 + q.x) >= miss;
  const standing = (q) => (q.kind === "garg" ? c.gargs[q.i].state !== "stun" && c.gargs[q.i].state !== "broken" : pew.KINDS[q.kind].answer === "SWITCH");
  const blocked = (lane) => cues.some((q) => q.lane === lane && standing(q) && (q.x - you.x) / v < 1.15 && (q.end - you.x) / v > -0.1);
  const score = (lane) => {
    if (blocked(lane)) return -1000;
    let s = -0.6 * Math.abs(lane - c.laneTo);
    for (let i = c.sNext; i < soulsOf.length && soulsOf[i][0] < you.x + v * 1.6; i++) if (c.souls[i] === 0 && soulsOf[i][1] === lane) s += soulsOf[i][3] ? 3 : 1;
    for (const q of cues) if (q.kind === "bell" && q.lane === lane && !c.bells[q.i] && (q.x - you.x) / v < 3.5 && q.x > you.x) s += 12;
    return s;
  };
  const here = Math.round(c.laneTo);
  let best = here;
  for (const l of [0, 1, 2]) if (score(l) > score(best) + (l === here ? 0 : 0.5)) best = l;
  if (blocked(here) || best !== here) {
    const dir = Math.sign(best - c.laneTo);
    if (dir && !(dir < 0 ? c.hl : c.hr)) inp[dir < 0 ? "left" : "right"] = true;
  }
  if (Math.abs(c.lane - c.laneTo) > 0.3) return;
  for (const q of cues) {
    if (q.lane !== here || !ok(q)) continue;
    const toNear = (q.x - you.x) / v;
    const toMid = ((q.x + q.end) / 2 - you.x) / v;
    if (q.answer === "JUMP" && toMid <= 0.33 && toMid > 0.2 && c.h <= 0) round.input.jump = ghoul.JUMP_BUFFER_MS;
    if (q.answer === "SLIDE" && toNear <= 0.15 && toNear > 0 && c.h <= 0 && !c.hd) inp.down = true;
  }
}
function idleBot(round) {
  const inp = round.input;
  inp.left = inp.right = inp.down = false;
  inp.fire = true;
}
function rideWith(seed, bot, limit = 100000) {
  const round = pewRound(seed);
  const lost = [];
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    ghoul.advance(round, 16, steady);
    for (const e of round.events) if (e.type === "lose") lost.push(e.cause);
    round.events.length = 0;
  }
  return { round, lost, ms: t };
}

test("Ghoul Rush's Holy Roller: a bot that plays it well finishes the whole nave in 60 to 75 seconds with good dice, never a run life, past every checkpoint, most of the souls and a long combo", () => {
  const dice = [];
  for (let seed = 1; seed <= 8; seed++) {
    const { round, lost, ms } = rideWith(seed, (r) => goodBot(r, seed));
    const b = round.bonusRound;
    assert.equal(b.won, true, `seed ${seed} finished (lost ${lost.join(",")})`);
    assert.ok(ms > 60000 && ms < 76000, `${ms} ms`);
    assert.ok(b.dice >= 6 && b.dice <= ghoul.MAX_DICE, `${b.dice} dice (seed ${seed}, lost ${lost.join(",")})`);
    assert.equal(round.lives, 3, "never a run life");
    assert.equal(round.runner.check, R.checks.length - 1, "past every checkpoint");
    assert.ok(round.runner.got >= pew.soulTotal(R) * 0.5, `${round.runner.got} souls`);
    dice.push(b.dice);
  }
  assert.ok(dice.reduce((a, b) => a + b, 0) / dice.length >= 7, `${dice.join(",")}`);
  // A perfect bot: nothing touched, every heart kept, most souls, the combo up.
  const { round, lost } = rideWith(3, (r) => goodBot(r, 3, 0));
  assert.deepEqual(lost, [], "a perfect ride loses nothing");
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.bonusRound.perf.hits.length, 0);
  assert.ok(round.runner.best >= 30, `a combo of ${round.runner.best}`);
  assert.equal(round.bonusRound.perf.steady, true);
  assert.ok(round.bonusRound.perf.acts >= pew.ACTS_GOAL - 3, `${round.bonusRound.perf.acts} acts`);
  assert.ok(round.bonusRound.dice >= 8, `${round.bonusRound.dice} dice for a clean ride`);
});

test("Ghoul Rush's Holy Roller: a bot that never dodges (holding fire) loses all five hearts in the first third, ends with 0 dice and the run goes on", () => {
  for (let seed = 1; seed <= 6; seed++) {
    const { round, lost } = rideWith(seed, idleBot);
    const b = round.bonusRound;
    assert.equal(b.won, false, "never finishes");
    assert.equal(b.dice, 0);
    assert.equal(b.hearts, 0);
    assert.equal(lost.length, 5);
    assert.ok(round.you.x < R.finish * 0.5, `out at ${round.you.x}`);
    assert.equal(round.lives, 3);
    assert.equal(round.over, false);
  }
});
