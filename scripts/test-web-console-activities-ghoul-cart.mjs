// Web console tests, Ghoul Rush's Runaway Cart (the Deep Seam Mine's ride room): its shape (between the Collapse and the Seam, every gap clears at the cart's speed with a jump, every beam can be ducked, checkpoints spaced, the clock covers the ride), the cart's speed on slopes, leaning and braking, its jump and its steering in the air, a ramp's launch, landing on the upper or the lower line of a split, a fall into the chasm and the respawn at the last checkpoint, ducking under a beam, rubble, crates (two shots break one), the boulder behind, the buffer stop and the door, the ledge imp, a canary's slide of rubble, endless lives for every new cause, a voice for every event, the drawing, and a bot that rides the whole room.
// Run with: node --test scripts/test-web-console-activities-ghoul-cart.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";
import * as ct from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as CART_LOOKS, VOICES as CART_VOICES } from "../src/web-console/public/activities/ghoul-rush/rides/cart/ghoul-cart-draw.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, bonusTick, hudLayout, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { BONUS_FLOOR, BONUS_HEARTS, diceFor, endBonus, heartsText, makeBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the cart drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Runaway Cart reached the way play reaches it, nothing woken:
// every spawner spent, the horde held back, the clocks long.
function cartRound(keepBonus = false) {
  const round = ghoul.newRound(5);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["mine"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "cart") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.events.length = 0;
  // The ride's mechanics are tested with lives at stake; the bonus round's own rules are tested at the end (bonusCart).
  if (!keepBonus) round.bonusRound = null;
  return round;
}

// The same round over a ride of its own (a plain track to measure the cart on).
function synth(ride) {
  const round = cartRound();
  round.spec = { ...round.spec, start: 10, ground: [[0, 5, 0]], ride: { time: 1e9, stop: 1e6, beams: [], rubble: [], crates: [], checks: [], ...ride } };
  ct.CART.place[0](round, {});
  return round;
}

// The cart on line `line` of the ride at `x`, at speed `v`.
function cartAt(round, x, line, { v = ct.CART_V, safe = false } = {}) {
  const y = ct.trackY(round.spec.ride, line, x);
  assert.ok(y !== null, `line ${line} runs under ${x}`);
  Object.assign(round.you, { x, y, vy: 0, state: "run", shelf: -1, face: 1, out: 0, safeMs: safe ? 1e9 : 0, ducking: false });
  Object.assign(round.cart, { line, v, coyote: 0, peak: y, boulder: x - ct.BOULDER_GAP, near: false, brake: false });
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

// Runs until the cart is back on a track after a jump, returning where.
function untilLanded(round, ms = 4000) {
  until(round, () => round.cart.line >= 0 || round.phase !== "play", ms);
  return { x: round.you.x, y: round.you.y, line: round.cart.line };
}

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

const ROOM = ghoul.roomById("cart");
const R = ROOM.ride;
const lines = ct.linesOf(R);
const floorOf = (x) => ghoul.groundAt(ROOM, x);

/* -------------------------------------------------------------- the room */

test("Ghoul Rush's Runaway Cart is the Mine's fourth room, between the Collapse and the Seam: dark, no key, no boss, a ride about 60 to 75 seconds long, a bonus round, and its monsters joined to the game's", () => {
  const st = ghoul.stageById("mine");
  assert.deepEqual(st.rooms, ["shaft", "tunnels", "collapse", "cart", "seam"]);
  assert.equal(st.boss, "tommy");
  assert.deepEqual([ROOM.title, ROOM.sub], ["The Runaway Cart", "The brakes went in 1891"]);
  assert.equal(ROOM.dark, true);
  assert.equal(ROOM.key, null);
  assert.equal(ROOM.boss, null);
  assert.equal(ROOM.bonus, true, "a bonus round");
  assert.ok(ROOM.length >= 2400 && ROOM.length <= 3000, `${ROOM.length} units long`);
  assert.ok(ghoul.ROOM_MUSIC.cart === "ghoulCart" && ghoulSfx.default.music.ghoulCart, "its own music");
  assert.ok(Object.isFrozen(R) && Object.isFrozen(R.track) && Object.isFrozen(R.track[0][0]), "frozen all the way down");
  assert.ok(ROOM.horde.length && ROOM.hordeMs > 0, "a horde of bats");
  for (const k of ROOM.horde) assert.ok(ghoul.MONSTERS[k], `${k} is a monster`);
  for (const kind of Object.keys(ct.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], ct.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.MONSTERS.ledgeimp.hp, 2);
  assert.equal(LOOKS.cart, CART_LOOKS.cart);
  assert.equal(LOOKS.cart.pack, "cart");
  // The ground is the cave floor at the start and the end only.
  assert.equal(ROOM.ground.length, 2);
  assert.ok(ROOM.ground[0][1] < 60 && ROOM.ground[1][0] > ROOM.length - 60, "floor only at the ends");
  assert.ok(ROOM.door > R.stop && ROOM.door > ROOM.length - 14, "the door past the buffer stop, at the room's end");
  assert.ok(floorOf(R.stop + 2) > -Infinity, "floor to step out onto");
  // Lines run left to right, their points rising in x; the first starts at the cart.
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(L.pts[i + 1][0] > L.pts[i][0], "x rises");
  assert.ok(ct.trackY(R, 0, ROOM.start) > floorOf(ROOM.start), "the cart starts on the track over the floor");
  assert.equal(lines.at(-1).x1, R.stop, "the last line ends at the buffer stop");
  // The ride, at the cart's speed, takes 60 to 75 seconds.
  const secs = (R.stop - ROOM.start) / ct.CART_V;
  assert.ok(secs >= 60 && secs <= 75, `${secs.toFixed(1)} s at CART_V`);
  // Gentle enough to ride: no slope steeper than the cart can climb.
  for (const L of lines) for (let i = 0; i + 1 < L.pts.length; i++) assert.ok(Math.abs((L.pts[i + 1][1] - L.pts[i][1]) / (L.pts[i + 1][0] - L.pts[i][0])) <= 0.55, "slopes no steeper than 0.55");
  // The camera has room: the track stays between the floor and the roof.
  for (const L of lines) for (const [, y] of L.pts) assert.ok(y > ct.DERAIL_Y + 2 && y < 36, `a track height of ${y}`);
  // The clock covers the ride comfortably (and respawns refill it).
  assert.equal(ghoul.timeFor(ghoul.roomFor("cart")), R.time);
  assert.ok(R.time >= 1.6 * secs * 1000, `a ${R.time} ms clock for a ${secs.toFixed(0)} s ride`);
});

test("Ghoul Rush's Runaway Cart: every gap clears at CART_V with a jump (pressed at the edge or 1.5 early), a ramp's launch alone clears its short gap, and no obstacle comes too soon after a jump", () => {
  lines.forEach((L, i) => {
    if (i === lines.length - 1) return;
    const end = L.pts.at(-1);
    for (const early of [0, 1.5]) {
      const x = L.x1 - early;
      const s = ct.slopeOf(R, i, x);
      const got = ct.flight(R, x, ct.trackY(R, i, x), ct.CART_JUMP_V + s * ct.CART_V, ct.CART_V, 0, floorOf);
      assert.ok(got, `line ${i}: a jump ${early} short of its end at ${L.x1} lands`);
      assert.ok(got.line !== i && got.x - lines[got.line].x0 >= 1.5, `line ${i}: lands on line ${got.line} at ${got.x?.toFixed(1)}, ${(got.x - lines[got.line].x0).toFixed(1)} past its start`);
      assert.ok(lines[got.line].x1 - got.x >= 6, `line ${i}: ${(lines[got.line].x1 - got.x).toFixed(1)} of track left after landing`);
    }
    // Coasting on (no press) over a ramp's short gap, or off a dead end, it either lands or it derails; a ramp (rising at its end) with a gap under 10 must land.
    const slope = ct.slopeOf(R, i, L.x1);
    const next = lines.map((q, j) => [j, q.x0 - L.x1]).filter(([j, gap]) => j !== i && gap > 0).sort((a, b) => a[1] - b[1])[0];
    if (slope >= ct.RAMP_SLOPE && next && next[1] < 10) {
      const got = ct.flight(R, L.x1, end[1], slope * ct.CART_V + ct.RAMP_POP, ct.CART_V, 0, floorOf);
      assert.ok(got && got.line === next[0] && got.x - lines[next[0]].x0 >= 2, `line ${i}: the ramp's launch clears the ${next[1]} wide gap`);
    }
  });
  // At least one ramp and one short hop, one long jump, and the big one last.
  const gaps = lines.slice(0, -1).filter((L) => ct.linesAt(R, L.x1).length === 1).map((L, i) => [i, Math.min(...lines.filter((q) => q.x0 > L.x1).map((q) => q.x0 - L.x1))]);
  assert.ok(gaps.some(([, g]) => g <= 10) && gaps.some(([, g]) => g >= 16), "a small gap and a big one");
  assert.equal(Math.max(...gaps.map(([, g]) => g)), gaps.at(-1)[1], "the last gap is the biggest");
  // Obstacles on one line come far enough apart for a jump to land and the next to start.
  lines.forEach((L, i) => {
    // A wall of crates (each within 4 of the next) is one obstacle: jumped or shot as one.
    const xs = [...R.rubble.filter((q) => q[1] === i).map((q) => q[0]), ...R.crates.filter((q) => q[1] === i).map((q) => q[0])];
    if (i < lines.length - 1) xs.push(L.x1);
    xs.sort((a, b) => a - b);
    const apart = xs.filter((x, k) => k === 0 || x - xs[k - 1] > 4);
    for (let k = 1; k < apart.length; k++) assert.ok(apart[k] - apart[k - 1] >= 24, `line ${i}: ${apart[k - 1]} then ${apart[k]}`);
  });
});

test("Ghoul Rush's Runaway Cart: every beam can be ducked under and not stood up to, and none comes soon after a jump", () => {
  assert.ok(R.beams.length >= 3, "a stretch of beams");
  for (const [x0, x1, y] of R.beams) {
    assert.ok(x1 > x0 && x1 - x0 <= 8, "a beam across the track");
    let needDuck = false;
    lines.forEach((L, i) => {
      for (let x = Math.max(x0, L.x0); x <= Math.min(x1, L.x1); x += 0.5) {
        const clear = y - ct.trackY(R, i, x);
        if (clear >= ghoul.HIT_H + 0.5) continue;
        assert.ok(clear > ghoul.DUCK_H + 0.3 && clear < ghoul.HIT_H - 0.3, `a beam at ${x0}: ${clear.toFixed(2)} over line ${i}, ducking needs ${ghoul.DUCK_H} and standing ${ghoul.HIT_H}`);
        needDuck = true;
      }
    });
    assert.ok(needDuck, `the beam at ${x0} is over a line`);
    // No rubble, crate or gap within a jump before it or after it, on the lines under it.
    lines.forEach((L, i) => {
      if (x1 < L.x0 || x0 > L.x1) return;
      const marks = [...R.rubble.filter((q) => q[1] === i).map((q) => q[0]), ...R.crates.filter((q) => q[1] === i).map((q) => q[0]), L.x0, L.x1];
      for (const m of marks) assert.ok(m <= x0 - 20 || m >= x1 + 20, `beam ${x0} and a jump at ${m}`);
    });
  }
});

test("Ghoul Rush's Runaway Cart: checkpoints every 190 to 340 units, each on a track, and passed in order", () => {
  const xs = [ROOM.start, ...R.checks, R.stop];
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= 190 && xs[i] - xs[i - 1] <= 340, `${xs[i - 1]} to ${xs[i]}`);
  for (const x of R.checks) assert.ok(ct.linesAt(R, x).length >= 1, `a track under the checkpoint at ${x}`);
  const round = cartRound();
  cartAt(round, R.checks[0] - 6, ct.linesAt(R, R.checks[0] - 6)[0][0], { safe: true });
  run(round, 600);
  assert.deepEqual(events(round, "checkpoint").map((e) => e.n), [1]);
  assert.equal(round.cart.check, 0);
});

/* ------------------------------------------------------------- the cart */

// A long flat track and a long slope each way, to measure the cart on.
const FLAT = [[[0, 20], [4000, 20]]];
const DOWN = [[[0, 3000], [4000, -1000]]];

test("Ghoul Rush's Runaway Cart rolls at CART_V on the flat, faster down a slope and slower up one, never past CART_MIN or CART_MAX", () => {
  const flat = synth({ track: FLAT });
  run(flat, 2000, { }, never);
  assert.equal(flat.cart.v, ct.CART_V);
  assert.ok(Math.abs(flat.you.x - (10 + ct.CART_V * 2)) < 0.5, "it covers CART_V a second");
  // A gentle slope each way settles at CART_V - SLOPE_G * slope / RELAX.
  const grade = (s) => synth({ track: [[[0, 300], [600, 300 + 600 * s]]] });
  const down = grade(-0.25);
  run(down, 3000);
  assert.ok(Math.abs(down.cart.v - (ct.CART_V + (ct.SLOPE_G * 0.25) / ct.RELAX)) < 0.6, `down: ${down.cart.v.toFixed(1)}`);
  const up = grade(0.25);
  run(up, 3000);
  assert.ok(Math.abs(up.cart.v - (ct.CART_V - (ct.SLOPE_G * 0.25) / ct.RELAX)) < 0.6, `up: ${up.cart.v.toFixed(1)}`);
  assert.ok(up.cart.v < ct.CART_V && down.cart.v > ct.CART_V);
  // A steep one hits the walls of its range.
  const steepDown = grade(-0.8);
  run(steepDown, 3000);
  assert.equal(steepDown.cart.v, ct.CART_MAX);
  const steepUp = grade(0.9);
  run(steepUp, 3000);
  assert.equal(steepUp.cart.v, ct.CART_MIN);
  // A real descent in the room speeds the cart up.
  const real = cartRound();
  cartAt(real, 295, 1);
  run(real, 800);
  assert.ok(real.cart.v > ct.CART_V + 5, `the camelback's descent: ${real.cart.v.toFixed(1)}`);
});

test("Ghoul Rush's Runaway Cart: right leans forward (to CART_V + LEAN_ACC / RELAX on the flat, CART_MAX at most), left brakes (to CART_MIN), and letting go settles back to CART_V", () => {
  const lean = synth({ track: FLAT });
  run(lean, 6000, { right: true });
  assert.ok(Math.abs(lean.cart.v - (ct.CART_V + ct.LEAN_ACC / ct.RELAX)) < 0.2, `leaning: ${lean.cart.v.toFixed(2)}`);
  assert.ok(lean.cart.v < ct.CART_MAX);
  run(lean, 6000);
  assert.ok(Math.abs(lean.cart.v - ct.CART_V) < 0.1, "settles back");
  const brake = synth({ track: FLAT });
  run(brake, 600, { left: true });
  assert.ok(brake.cart.v < ct.CART_V - 8, `braking for 0.6 s: ${brake.cart.v.toFixed(1)}`);
  assert.equal(events(brake, "cartBrake").length, 1, "one screech per brake");
  run(brake, 3000, { left: true });
  assert.equal(brake.cart.v, ct.CART_MIN);
  const steep = synth({ track: DOWN });
  run(steep, 3000, { right: true });
  assert.equal(steep.cart.v, ct.CART_MAX, "leaning down a slope still tops out");
  // Always facing right, whatever is held.
  assert.equal(brake.you.face, 1);
});

test("Ghoul Rush's Runaway Cart jumps about 14 high for about three quarters of a second (a gap of about 30 at CART_V), a press saved for a landing jumps on it, one just after a track's end still jumps, and the jump is not cut short", () => {
  const round = synth({ track: FLAT });
  const y0 = round.you.y;
  press(round);
  let top = y0;
  const x0 = round.you.x;
  let ms = 0;
  for (; ms < 3000 && (ms === 0 || round.cart.line < 0); ms += 4) {
    ghoul.advance(round, 4, steady);
    top = Math.max(top, round.you.y);
    round.input.up = true;
  }
  round.input.up = false;
  assert.ok(Math.abs(top - y0 - (ct.CART_JUMP_V ** 2) / (2 * ct.CART_G)) < 0.3 && top - y0 > 13.5 && top - y0 < 14.6, `rose ${(top - y0).toFixed(2)}`);
  assert.ok(ms > 720 && ms < 780, `${ms} ms in the air`);
  assert.ok(Math.abs(round.you.x - x0 - 30) < 1.5, `covered ${(round.you.x - x0).toFixed(1)}`);
  assert.equal(events(round, "cartJump").length, 1);
  assert.equal(events(round, "cartLand").length, 1);
  assert.equal(events(round, "cartLand")[0].big, false);
  // Letting up go early does not cut it.
  const hop = synth({ track: FLAT });
  press(hop);
  hop.input.up = false;
  const t = until(hop, () => hop.cart.line < 0, 100);
  until(hop, () => hop.cart.line >= 0, 3000);
  assert.ok(hop.you.y === 20 && events(hop, "cartJump").length === 1);
  // A press in the air a moment before landing jumps as it lands.
  const buf = synth({ track: FLAT });
  press(buf);
  until(buf, () => buf.cart.line < 0, 100);
  until(buf, () => buf.you.vy < 0 && buf.you.y - 20 < 3, 2000);
  press(buf);
  until(buf, () => events(buf, "cartLand").length === 1, 600);
  until(buf, () => events(buf, "cartJump").length === 2, 400);
  assert.equal(events(buf, "cartJump").length, 2, "a second jump on landing");
  // A press a moment after running off the end of a track still jumps; much later it does not.
  const edge = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  until(edge, () => edge.cart.line < 0, 4000);
  run(edge, 40);
  press(edge);
  run(edge, 8);
  assert.equal(events(edge, "cartJump").length, 1, "within COYOTE_MS");
  const late = synth({ track: [[[0, 20], [60, 20]], [[100, 20], [300, 20]]] });
  until(late, () => late.cart.line < 0, 4000);
  run(late, ct.COYOTE_MS + 40);
  press(late);
  run(late, 8);
  assert.equal(events(late, "cartJump").length, 0, "too late");
  // A fall from a height lands big.
  const drop = synth({ track: [[[0, 60], [100, 60]], [[110, 20], [300, 20]]] });
  until(drop, () => drop.cart.line < 0, 4000);
  untilLanded(drop);
  assert.equal(events(drop, "cartLand")[0].big, true);
});

test("Ghoul Rush's Runaway Cart steers in the air: right stretches the jump and left shortens it, modestly", () => {
  const land = (keys) => {
    const round = synth({ track: [[[0, 20], [300, 20]], [[300, 20], [600, 20]]] });
    cartAt(round, 100, 0);
    press(round);
    Object.assign(round.input, keys);
    until(round, () => round.cart.line < 0, 100);
    Object.assign(round.input, keys);
    const x0 = round.you.x;
    until(round, () => round.cart.line >= 0, 3000);
    round.input.left = round.input.right = false;
    return round.you.x - x0;
  };
  const plain = land({});
  const wide = land({ right: true });
  const short = land({ left: true });
  assert.ok(wide > plain + 2 && wide < plain + 9, `right ${wide.toFixed(1)} vs ${plain.toFixed(1)}`);
  assert.ok(short < plain - 2 && short > plain - 9, `left ${short.toFixed(1)} vs ${plain.toFixed(1)}`);
  // And the speed it leaves with is what it lands with.
  const round = synth({ track: FLAT });
  press(round);
  until(round, () => round.cart.line < 0, 100);
  run(round, 300, { right: true });
  const v = round.cart.v;
  assert.ok(v > ct.CART_V + 3 && v <= ct.CART_V + ct.AIR_ACC * 0.4, `${v.toFixed(1)}`);
  until(round, () => round.cart.line >= 0, 3000);
  assert.ok(round.cart.v >= v - 0.1, "carried to the landing");
});

test("Ghoul Rush's Runaway Cart: a track ending rising is a ramp that launches the cart along its slope (a short gap needs no jump), and it lands on the line under it", () => {
  const round = cartRound();
  cartAt(round, lines[1].x1 - 38, 1);
  round.input.right = false;
  until(round, () => events(round, "cartLaunch").length > 0, 2000);
  const launch = events(round, "cartLaunch")[0];
  assert.ok(launch, "a launch off the ramp");
  assert.equal(round.cart.line, -1, "in the air");
  assert.ok(round.you.vy > 20, `launched up at ${round.you.vy.toFixed(1)}`);
  assert.ok(Math.abs(launch.x - lines[1].x1) < 0.01);
  const at = untilLanded(round);
  assert.equal(at.line, 2, "landed on the line past the gap");
  assert.equal(events(round, "lose").length, 0);
  assert.ok(at.x - lines[2].x0 >= 2, "well onto it");
  // Off a flat end with no ramp and no press: it falls off.
  const flat = cartRound();
  cartAt(flat, lines[0].x1 - 6, 0);
  run(flat, 1500);
  assert.equal(events(flat, "cartLaunch").length, 0);
  assert.equal(events(flat, "lose")[0]?.cause, "derail");
});

test("Ghoul Rush's Runaway Cart lands on whichever line is under it: the split's upper line after a jump, the lower after rolling on, and the lower line dead-ends at a ramp that a jump takes back up", () => {
  const forkAt = lines[3].pts[1][0];
  // Jump at the fork: the upper line.
  const up = cartRound();
  cartAt(up, forkAt - 6, 3);
  run(up, 100);
  press(up);
  run(up, 8);
  assert.equal(up.cart.line, -1);
  assert.equal(untilLanded(up).line, 4, "the upper line");
  // Roll on: down the dive to the lower deck.
  const low = cartRound();
  cartAt(low, forkAt - 6, 3);
  run(low, 1200);
  assert.equal(low.cart.line, 3, "still on the lower line");
  assert.ok(low.you.y < 10, `down on the lower deck (${low.you.y.toFixed(1)})`);
  assert.equal(events(low, "lose").length, 0);
  // Its end: a ramp, then nothing; a jump goes back up to the upper line, none falls.
  const end = lines[3].x1;
  const take = cartRound();
  cartAt(take, end - 25, 3);
  run(take, 400);
  until(take, () => take.you.x > end - 3, 3000);
  press(take);
  run(take, 8);
  assert.equal(untilLanded(take).line, 4, "back up onto the upper line");
  assert.equal(events(take, "lose").length, 0);
  const fall = cartRound();
  cartAt(fall, end - 25, 3);
  run(fall, 3000);
  assert.equal(events(fall, "lose")[0]?.cause, "derail");
  // A jump from the ramp's top lands further than from the flat: the ramp adds its own rise.
  assert.ok(ct.flight(R, end, lines[3].pts.at(-1)[1], ct.CART_JUMP_V + 0.4 * ct.CART_V, ct.CART_V).y > 20);
  // Two lines under one x: the highest it crossed going down.
  const both = ct.linesAt(R, 750);
  assert.deepEqual(both.map(([line]) => line), [4, 3]);
});

/* ------------------------------------------------------ falling and checkpoints */

test("Ghoul Rush's Runaway Cart: falling off the track into the chasm costs a life (cause derail) and puts the cart back at the start, or at the last checkpoint passed, at CART_V, with the boulder BOULDER_GAP behind and every crate whole", () => {
  const round = cartRound();
  cartAt(round, lines[0].x1 - 6, 0);
  const lives = round.lives;
  until(round, () => events(round, "lose").length > 0, 3000);
  assert.equal(round.lives, lives - 1);
  const lost = events(round, "lose");
  assert.equal(lost.length, 1);
  assert.equal(lost[0].cause, "derail");
  assert.equal(round.phase, "crash");
  until(round, () => round.phase === "play", 3000);
  assert.equal(round.phase, "play");
  assert.equal(round.you.x, ROOM.start, "back at the start: no checkpoint passed");
  assert.equal(round.you.y, ct.trackY(R, 0, ROOM.start));
  assert.equal(round.cart.v, ct.CART_V);
  assert.equal(round.cart.boulder, ROOM.start - ct.BOULDER_GAP);
  assert.ok(round.you.safeMs > 0, "safe a moment");
  // Past the second checkpoint: back at it, not at the start.
  const later = cartRound();
  cartAt(later, R.checks[1] + 10, ct.linesAt(R, R.checks[1] + 10)[0][0], { safe: true });
  run(later, 100);
  assert.equal(later.cart.check, 1);
  later.cart.crates[0] = 0;
  cartAt(later, lines[2].x1 - 1, 2);
  later.cart.check = 1;
  run(later, 1500);
  assert.equal(events(later, "lose")[0]?.cause, "derail");
  until(later, () => later.phase === "play", 3000);
  assert.equal(later.you.x, R.checks[1]);
  assert.equal(later.you.y, ct.linesAt(R, R.checks[1])[0][1]);
  assert.equal(later.cart.line, ct.linesAt(R, R.checks[1])[0][0]);
  assert.equal(later.cart.v, ct.CART_V);
  assert.equal(later.cart.boulder, R.checks[1] - ct.BOULDER_GAP);
  assert.deepEqual([...later.cart.crates], R.crates.map(() => ct.CRATE_HP), "every crate whole again");
  assert.equal(later.cart.check, 1, "the checkpoint is kept");
  assert.ok(later.camX > R.checks[1] - 60, "the camera is back with it");
  // The clock starts over with the life.
  assert.equal(later.timeMs, R.time);
  // Garlic does not save you from the chasm.
  const garlic = cartRound();
  cartAt(garlic, lines[0].x1 - 6, 0);
  garlic.you.garlic = true;
  run(garlic, 1500);
  assert.equal(events(garlic, "lose")[0]?.cause, "derail");
  // Even while safe after a respawn.
  const safe = cartRound();
  cartAt(safe, lines[0].x1 - 6, 0, { safe: true });
  run(safe, 1500);
  assert.equal(events(safe, "lose")[0]?.cause, "derail");
});

test("Ghoul Rush's Runaway Cart: the last checkpoint passed is the one kept, and passing one again does nothing", () => {
  const round = cartRound();
  const x = R.checks[2] + 4;
  cartAt(round, x, ct.linesAt(R, x)[0][0], { safe: true });
  run(round, 100);
  assert.deepEqual(events(round, "checkpoint").map((e) => e.n), [1, 2, 3], "the ones behind are passed in order at once");
  assert.equal(round.cart.check, 2);
  round.events.length = 0;
  run(round, 400);
  assert.equal(events(round, "checkpoint").length, 0);
});

/* ------------------------------------------------------ the obstacles */

test("Ghoul Rush's Runaway Cart: a beam costs a life (cause beam) to a cart sitting up, and passes over one ducked down into it; a jump into it hits it too", () => {
  const [x0, x1, y] = R.beams[0];
  const stand = cartRound();
  cartAt(stand, x0 - 12, 3);
  run(stand, 700);
  assert.equal(events(stand, "lose")[0]?.cause, "beam");
  assert.equal(events(stand, "cartCrash")[0]?.what, "beam");
  const duck = cartRound();
  cartAt(duck, x0 - 12, 3);
  run(duck, 700, { down: true });
  assert.equal(events(duck, "lose").length, 0);
  assert.ok(duck.you.x > x1 && duck.you.y + ghoul.HIT_H > y, "right through it, ducking");
  assert.equal(events(duck, "cartDuck").length, 1);
  // Ducking only on the track, and never while a jump is pressed.
  const midair = cartRound();
  cartAt(midair, x0 - 40, 3);
  press(midair);
  run(midair, 60, { down: true });
  assert.equal(midair.you.ducking, false, "no ducking in the air");
  // Standing back up after: the hit box is full height again.
  assert.equal(duck.you.ducking, true);
  run(duck, 20);
  assert.equal(duck.you.ducking, false);
  // A jump into the beam hits it.
  const jump = cartRound();
  cartAt(jump, x0 - 8, 3);
  press(jump);
  run(jump, 400);
  assert.equal(events(jump, "lose")[0]?.cause, "beam");
  // Safe after a respawn: it passes through.
  const safe = cartRound();
  cartAt(safe, x0 - 12, 3, { safe: true });
  run(safe, 700);
  assert.equal(events(safe, "lose").length, 0);
});

test("Ghoul Rush's Runaway Cart: rubble on the rails wrecks a cart that meets it (cause crash) and is jumped", () => {
  const [x, line] = R.rubble[0];
  const hit = cartRound();
  cartAt(hit, x - 20, line);
  run(hit, 1200);
  const lost = events(hit, "lose");
  assert.equal(lost[0]?.cause, "crash");
  assert.equal(events(hit, "cartCrash")[0]?.what, "rubble");
  const over = cartRound();
  cartAt(over, x - 20, line);
  run(over, 250);
  press(over);
  run(over, 900);
  assert.equal(events(over, "lose").length, 0);
  assert.ok(over.you.x > x + 5);
  // A jump too early comes down before it and the cart rolls into it all the same.
  const early = cartRound();
  cartAt(early, x - 30, line);
  press(early);
  run(early, 1500);
  assert.equal(events(early, "lose")[0]?.cause, "crash");
  // The Garlic shield takes the hit once and the cart rolls on.
  const garlic = cartRound();
  cartAt(garlic, x - 20, line);
  garlic.you.garlic = true;
  run(garlic, 1200);
  assert.equal(events(garlic, "lose").length, 0);
  assert.equal(garlic.you.garlic, false);
});

test("Ghoul Rush's Runaway Cart: a crate is broken by two bolts (or jumped); one bolt only cracks it, and the cart that meets it whole is wrecked (cause crash)", () => {
  const [x, line] = R.crates[0];
  const round = cartRound();
  cartAt(round, x - 20, line);
  round.you.safeMs = 1e9;
  const bolt = () => round.shots.push({ x: round.you.x + 2, y: round.you.y + ghoul.SHOT_Y, vx: 130, vy: 0, gone: 0 });
  bolt();
  run(round, 400);
  assert.equal(events(round, "crateHit").length, 1);
  assert.equal(round.cart.crates[0], 1, "one bolt cracks it");
  assert.equal(events(round, "crateBreak").length, 0);
  bolt();
  run(round, 400);
  assert.equal(events(round, "crateBreak").length, 1);
  assert.equal(round.cart.crates[0], 0, "the second breaks it");
  // Broken, it is out of the way.
  cartAt(round, x - 8, line);
  run(round, 600);
  assert.equal(events(round, "lose").length, 0, "rolled through where it stood");
  assert.ok(round.you.x > x + 3);
  // A bolt that misses it high goes on.
  const high = cartRound();
  cartAt(high, x - 20, line, { safe: true });
  high.shots.push({ x: x - 5, y: ct.trackY(R, line, x) + ct.CRATE_H + 2, vx: 130, vy: 0, gone: 0 });
  run(high, 200);
  assert.equal(high.cart.crates[0], ct.CRATE_HP);
  // Whole, it wrecks the cart.
  const hit = cartRound();
  cartAt(hit, x - 20, line);
  run(hit, 1200);
  assert.equal(events(hit, "lose")[0]?.cause, "crash");
  assert.equal(events(hit, "cartCrash")[0]?.what, "crate");
  // Or it is jumped.
  const over = cartRound();
  cartAt(over, x - 20, line);
  run(over, 250);
  press(over);
  run(over, 900);
  assert.equal(events(over, "lose").length, 0);
  // Fire held from the cart really does break it: the blaster does the shooting.
  const fire = cartRound();
  const [fx, fline] = R.crates[1];
  cartAt(fire, fx - 30, fline);
  fire.input.fire = true;
  until(fire, () => fire.cart.crates[1] === 0 || fire.phase !== "play", 3000);
  fire.input.fire = false;
  assert.equal(fire.cart.crates[1], 0, "two bolts from the cart");
  assert.equal(events(fire, "lose").length, 0);
});

test("Ghoul Rush's Runaway Cart: the boulder starts BOULDER_GAP behind, rolls at BOULDER_V, rumbles as it nears and flattens a cart that brakes too long (cause boulder), and a cart rolling on is never caught", () => {
  const round = synth({ track: FLAT });
  assert.equal(round.cart.boulder, round.you.x - ct.BOULDER_GAP);
  run(round, 1000);
  assert.ok(Math.abs(round.cart.boulder - (10 - ct.BOULDER_GAP + ct.BOULDER_V)) < 0.2);
  assert.equal(events(round, "boulderNear").length, 0, "far behind: quiet");
  // Never more than BOULDER_FAR behind however fast you go.
  const fast = synth({ track: DOWN });
  run(fast, 6000, { right: true });
  assert.ok(fast.you.x - fast.cart.boulder <= ct.BOULDER_FAR + 0.5, "kept in reach");
  assert.ok(fast.you.x - fast.cart.boulder > ct.BOULDER_FAR - 1);
  // Brake on the flat: it closes at BOULDER_V - CART_MIN, warns, rumbles louder, then catches you (and no random number is drawn).
  const slow = synth({ track: FLAT });
  slow.input.left = true;
  const when = until(slow, () => slow.phase !== "play", 12000, never);
  slow.input.left = false;
  assert.equal(events(slow, "lose")[0]?.cause, "boulder", `flattened after ${when} ms`);
  assert.equal(events(slow, "cartCrash")[0]?.what, "boulder");
  assert.ok(when > 2500 && when < 8000, `${when} ms`);
  const near = events(slow, "boulderNear");
  assert.ok(near.length >= 2, "it rumbles more than once as it nears");
  assert.ok(near.at(-1).level > near[0].level, "louder the closer");
  assert.equal(slow.cart.rumble > 0.5, true);
  // Reset behind the cart after the life lost.
  until(slow, () => slow.phase === "play", 3000);
  assert.equal(slow.cart.boulder, slow.you.x - ct.BOULDER_GAP);
  // Dawdling after a respawn does catch you too, but not at once: the gap is a head start.
  slow.input.left = true;
  run(slow, 2000);
  assert.equal(slow.phase, "play", "not within two seconds");
  slow.input.left = false;
  // The garlic shield sends the boulder back instead.
  const garlic = synth({ track: FLAT });
  garlic.you.garlic = true;
  garlic.input.left = true;
  until(garlic, () => !garlic.you.garlic || garlic.phase !== "play", 12000);
  garlic.input.left = false;
  assert.equal(garlic.phase, "play");
  assert.ok(garlic.you.x - garlic.cart.boulder > 10, "knocked back");
});

/* -------------------------------------------------------- the whole ride */

// A bot that rides the whole room: it jumps at the end of a line and at rubble, crates and slides, ducks the beams, leans when the boulder is near, and takes the upper line of the first fork (the lower, safe line of the second).
function rideBot(round) {
  const { you, cart: c, input: inp } = round;
  const Rd = round.spec.ride;
  inp.left = inp.right = inp.down = false;
  if (round.phase !== "play" || !c || c.done) {
    inp.up = false;
    return;
  }
  const L = ct.linesOf(Rd);
  let jump = false;
  // Leaning forward keeps the boulder off when it closes in (the chase).
  if (you.x - c.boulder < 40) inp.right = true;
  if (c.line >= 0) {
    if (L[c.line].x1 - you.x < 2.2 && L[c.line].x1 < Rd.stop) jump = true;
    const ahead = (x) => x - you.x > 3 && x - you.x < 7;
    for (const [x, line] of Rd.rubble) if (line === c.line && ahead(x)) jump = true;
    Rd.crates.forEach(([x, line], i) => {
      if (line === c.line && c.crates[i] > 0 && x - you.x > 3 && x - you.x < 8) jump = true;
    });
    for (const s of c.slides) if (s.down && s.line === c.line && ahead(s.x)) jump = true;
    for (const [x0, x1] of Rd.beams) if (you.x > x0 - 9 && you.x < x1 + 3) inp.down = true;
    if (c.line === 3 && you.x > Rd.track[3][1][0] - 3 && you.x < Rd.track[3][1][0]) jump = true;
  }
  if (jump) press(round);
  else inp.up = false;
}

function ride(round, limit = 90000, bot = rideBot) {
  const seen = { lost: [], marks: [] };
  let t = 0;
  for (; t < limit && round.phase !== "clear" && !round.over; t += 16) {
    bot(round);
    // Once out of the cart, the bot walks to the door.
    if (round.cart && round.cart.done && round.phase === "play") round.input.right = true;
    ghoul.advance(round, 16, steady);
    for (const e of round.events) {
      if (e.type === "lose") seen.lost.push(e.cause);
      if (e.type === "checkpoint" || e.type === "cartStop") seen.marks.push(e.type);
    }
    if (round.cart && !round.cart.done) {
      const off = round.you.x - round.camX;
      assert.ok(off > 4 && off < 70, `the cart stays in view (${off.toFixed(1)} from the left edge at ${round.you.x.toFixed(0)})`);
    }
    round.events.length = 0;
  }
  return { ...seen, ms: t };
}

test("Ghoul Rush's Runaway Cart: a bot that jumps at gaps and rubble and ducks the beams rides the whole room to the buffer stop and the door in 60 to 75 seconds without losing a life, past every checkpoint, the camera never losing the cart", () => {
  const round = cartRound();
  round.lives = 3;
  const got = ride(round, 90000, rideBot);
  assert.equal(round.phase, "clear", "through the door");
  assert.deepEqual(got.lost, []);
  assert.equal(round.lives, 3);
  assert.deepEqual(got.marks, [...R.checks.map(() => "checkpoint"), "cartStop"]);
  assert.ok(got.ms > 60000 && got.ms < 76000, `${got.ms} ms`);
  assert.equal(round.hasKey, true, "the door opened at the buffer stop");
  assert.ok(round.score > 0, "the souls along the way count");
});

test("Ghoul Rush's Runaway Cart: the cart stops at the buffer, Planny steps out onto the cave floor and walks to the door, which opens at the stop and nowhere before it", () => {
  const round = cartRound();
  cartAt(round, R.stop - 8, lines.length - 1, { safe: true });
  assert.equal(round.hasKey, false);
  run(round, 600);
  round.input.right = true;
  assert.equal(events(round, "cartStop").length, 1);
  assert.equal(round.cart.done, true);
  assert.equal(round.hasKey, true);
  assert.equal(round.you.state, "run");
  assert.equal(round.you.y, floorOf(round.you.x), "on the floor, not on a track");
  assert.equal(round.camLead, 0);
  assert.equal(round.phase, "play");
  until(round, () => round.phase === "clear", 2500, steady);
  round.input.right = false;
  assert.equal(round.phase, "clear", "through the door");
  assert.equal(events(round, "clear").length, 1);
  // And the next room is the Seam, the boss, with no cart left.
  run(round, ghoul.CLEAR_MS + 100);
  assert.equal(round.spec.id, "seam");
  assert.equal(round.cart, null);
  assert.equal(round.camLead, 0);
  // Standing at the door with the door open finishes the room straight away (the drawing test relies on it).
  const door = cartRound();
  Object.assign(door.you, { x: ROOM.door, y: floorOf(ROOM.door), vy: 0, state: "run", shelf: -1, out: 0, safeMs: 0 });
  door.hasKey = true;
  run(door, 20);
  assert.equal(door.phase, "clear");
});

test("Ghoul Rush's Runaway Cart: a bot with monsters about and the blaster held rides it to the door, losing a few lives at most, and always from the last checkpoint", () => {
  const round = ghoul.newRound(9);
  round.dice = 0;
  through(round);
  round.offer = ["mine"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "cart") through(round);
  round.phase = "play";
  round.lives = 99;
  round.timeMs = 1e9;
  const bot = (r) => {
    rideBot(r);
    r.input.fire = true;
  };
  const got = ride(round, 150000, bot);
  assert.equal(round.phase, "clear", "through the door");
  assert.ok(got.lost.length <= 8, `${got.lost.length} lives lost: ${got.lost.join(", ")}`);
  for (const cause of got.lost) assert.ok(["bat", "crash", "beam", "derail", "boulder"].includes(cause), cause);
});

test("Ghoul Rush's Runaway Cart: any other room is untouched by the ride (no cart, no camera lead), and the cart is not there after the room", () => {
  const round = ghoul.newRound(5);
  round.dice = 0;
  assert.equal(round.cart, null);
  assert.equal(round.camLead, 0);
  const shaft = ghoul.newRound(5);
  shaft.dice = 0;
  through(shaft);
  shaft.offer = ["mine"];
  shaft.phaseMs = 0;
  ghoul.pickStage(shaft, 0);
  shaft.phase = "play";
  assert.equal(shaft.cart, null);
  assert.equal(shaft.camLead, 0);
  assert.equal(shaft.you.x, shaft.spec.start);
  // The ride's camera leads further than a walker's, and further the faster it goes.
  const slow = synth({ track: FLAT });
  const fast = synth({ track: FLAT });
  fast.cart.v = ct.CART_MAX;
  run(slow, 20);
  run(fast, 20);
  assert.ok(slow.camLead > 0 && fast.camLead > slow.camLead, `${slow.camLead.toFixed(1)} to ${fast.camLead.toFixed(1)}`);
  const walk = cartRound();
  assert.ok(walk.camLead >= ct.CAM_AHEAD - 0.01);
});

/* ---------------------------------------------- the ledge imp and the canary */

test("Ghoul Rush's Runaway Cart: a ledge imp waits on its ledge, crouches when the cart is near, leaps at where the cart will be and steals your light (never a life); shot, it drops the light back", () => {
  const round = cartRound();
  cartAt(round, 875, 4);
  const imp = ghoul.spawnMonster(round, "ledgeimp", 903, 30, { rise: 0, awake: true });
  assert.equal(imp.act, "perch");
  run(round, 4);
  assert.equal(imp.act, "crouch", "the cart is within LEDGE_NEAR of it");
  const got = [];
  until(round, () => {
    if (imp.act === "leap" && !got.length) got.push(events(round, "ledgeLeap")[0]);
    return round.you.dimMs > 0 || imp.dead || round.phase !== "play";
  }, 4000);
  assert.ok(got[0], "it leaps");
  assert.equal(round.phase, "play", "no life lost");
  assert.equal(round.lives, 3);
  assert.ok(round.you.dimMs > 0 && round.you.dimBy === imp.id, "the light is stolen");
  assert.equal(events(round, "impSteal").length, 1);
  assert.equal(imp.stole, true);
  // Kill it and the light comes back at once.
  imp.act = "fall";
  ghoul.hurt(round, imp, 99, "shot", steady);
  assert.equal(round.you.dimMs, 0);
  assert.equal(events(round, "impDrop").length, 1);
  // Jumping it: the leap goes under.
  const jumper = cartRound();
  cartAt(jumper, 875, 4);
  const imp2 = ghoul.spawnMonster(jumper, "ledgeimp", 903, 30, { rise: 0, awake: true });
  run(jumper, 4);
  until(jumper, () => imp2.act === "leap", 1000);
  press(jumper);
  run(jumper, 700);
  assert.equal(jumper.you.dimMs, 0, "it went under the jump");
  // A Hard Hat is knocked off instead.
  const hat = cartRound();
  cartAt(hat, 875, 4);
  hat.you.hat = true;
  const imp3 = ghoul.spawnMonster(hat, "ledgeimp", 903, 30, { rise: 0, awake: true });
  until(hat, () => !hat.you.hat || imp3.dead, 4000);
  assert.equal(hat.you.hat, false);
  assert.equal(hat.you.dimMs, 0);
  assert.equal(events(hat, "hatKnock").length, 1);
  // A shot imp on its ledge never leaps.
  const shot = cartRound();
  cartAt(shot, 875, 4);
  const imp4 = ghoul.spawnMonster(shot, "ledgeimp", 903, 30, { rise: 0, awake: true });
  ghoul.hurt(shot, imp4, 99, "shot", steady);
  run(shot, 1500);
  assert.equal(events(shot, "ledgeLeap").length, 0);
});

test("Ghoul Rush's Runaway Cart: a canary's scream brings a slide of rubble onto the track ahead after a warning, and it wrecks a cart that does not jump it", () => {
  const round = cartRound();
  cartAt(round, 750, 4, { safe: true });
  round.events.push({ type: "canaryScream", kind: "canary", x: 770, y: 30, n: 0 });
  run(round, 8);
  const warn = events(round, "slideWarn")[0];
  assert.ok(warn, "dust first");
  assert.ok(warn.x > round.you.x + 15 && warn.x < round.you.x + 70, `${warn.x - round.you.x} ahead`);
  assert.equal(round.cart.slides.length, 1);
  assert.equal(events(round, "slideFall").length, 0);
  run(round, ct.SLIDE_WARN_MS);
  assert.equal(events(round, "slideFall").length, 1);
  // The same scream is only answered once.
  run(round, 100);
  assert.equal(round.cart.slides.length, 1);
  // Rolling into it costs a life, jumping it does not.
  const hit = cartRound();
  cartAt(hit, 750, 4);
  hit.events.push({ type: "canaryScream", kind: "canary", x: 770, y: 30, n: 0 });
  run(hit, 3000);
  assert.equal(events(hit, "lose")[0]?.cause, "crash");
  assert.equal(events(hit, "cartCrash")[0]?.what, "rubble");
  const over = cartRound();
  cartAt(over, 750, 4);
  over.events.push({ type: "canaryScream", kind: "canary", x: 770, y: 30, n: 0 });
  until(over, () => over.cart.slides.some((s) => s.down), 3000);
  const s = over.cart.slides[0];
  until(over, () => s.x - over.you.x < 6, 3000);
  press(over);
  run(over, 1200);
  assert.equal(events(over, "lose").length, 0);
  // Never on thin air: no slide where no track is under the spot.
  const gap = cartRound();
  cartAt(gap, lines[2].x1 - 50, 2);
  gap.events.push({ type: "canaryScream", kind: "canary", x: 380, y: 30, n: 0 });
  run(gap, 8);
  assert.equal(gap.cart.slides.length, 0);
  // And the real canary's scream does bring it.
  const real = cartRound();
  cartAt(real, 750, 4, { safe: true });
  const bird = ghoul.spawnMonster(real, "canary", 770, 30, { rise: 0, awake: true });
  until(real, () => events(real, "canaryScream").length > 0, 3000);
  assert.ok(bird && events(real, "canaryScream").length >= 1);
  run(real, 20);
  assert.ok(events(real, "slideWarn").length >= 1, "the real scream starts a slide");
});

/* ---------------------------------------------------- endless lives and sounds */

test("Ghoul Rush's Runaway Cart: every new way to lose a life goes through struck or lose, so the endless-lives code spares them all", () => {
  const causes = { derail: [lines[0].x1 - 6, 0], beam: [R.beams[0][0] - 12, 3], crash: [R.rubble[0][0] - 20, R.rubble[0][1]] };
  for (const [cause, [x, line]] of Object.entries(causes)) {
    const round = cartRound();
    round.infinite = true;
    cartAt(round, x, line);
    run(round, 1500);
    assert.equal(events(round, "lose")[0]?.cause, cause, cause);
    assert.equal(round.lives, 3, `${cause}: endless lives`);
  }
  const crate = cartRound();
  crate.infinite = true;
  cartAt(crate, R.crates[0][0] - 20, R.crates[0][1]);
  run(crate, 1500);
  assert.equal(events(crate, "lose")[0]?.cause, "crash");
  assert.equal(crate.lives, 3);
  const slow = synth({ track: FLAT });
  slow.infinite = true;
  slow.input.left = true;
  until(slow, () => slow.phase !== "play", 12000);
  assert.equal(events(slow, "lose")[0]?.cause, "boulder");
  assert.equal(slow.lives, 3);
  // Every cause is words and a sound of its own.
  for (const cause of ["beam", "crash", "boulder", "derail"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).played.includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Runaway Cart: every event the pack emits has a voice, each a real tone played once, and the ledge imp has one for each act", () => {
  const listed = {
    cart: ["jump", "land", "launch", "brake", "duck", "crash", "stop", "check"],
    crate: ["hit", "break"],
    boulder: ["near"],
    slide: ["warn", "fall"],
    ledgeimp: ["appear", "leap", "hurt", "die"],
  };
  for (const [kind, acts] of Object.entries(listed)) assert.deepEqual(Object.keys(CART_VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(merged[VOICES[kind][act]]?.layers?.length, `${kind}.${act}: ${VOICES[kind][act]} is a tone`);
  for (const type of ct.EVENTS) assert.ok(EVENT_VOICE[type] || ["impSteal", "impDrop", "hatKnock"].includes(type), `${type} is heard`);
  for (const type of Object.keys(EVENT_VOICE)) assert.ok(ct.EVENTS.includes(type), `${type} is an event of the pack`);
  assert.equal(new Set(ct.EVENTS).size, ct.EVENTS.length);
  for (const [type, [kind, act]] of Object.entries(EVENT_VOICE)) {
    assert.ok(listed[kind].includes(act), `${type}: ${kind} ${act} is a listed act`);
    assert.deepEqual(heard({ type, kind: kind === "ledgeimp" ? kind : undefined, level: 1 }).played, [VOICES[kind][act]], `${type}: ${kind} ${act}, once`);
  }
  // Each listed act is the voice of an event or of the game's own play of it.
  const reached = new Set(Object.values(EVENT_VOICE).map(([kind, act]) => `${kind}.${act}`));
  const theGames = ["ledgeimp.appear", "ledgeimp.hurt", "ledgeimp.die"];
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(reached.has(`${kind}.${act}`) || theGames.includes(`${kind}.${act}`), `${kind}.${act} is played by something`);
  const once = (e, kind, act) => assert.equal(heard(e).played.filter((n) => n === VOICES[kind][act]).length, 1, `${e.type}: ${kind} ${act} once`);
  once({ type: "spawn", kind: "ledgeimp" }, "ledgeimp", "appear");
  once({ type: "hit", kind: "ledgeimp" }, "ledgeimp", "hurt");
  once({ type: "kill", kind: "ledgeimp", mult: 1, how: "shot", points: 1 }, "ledgeimp", "die");
  // The imp's theft is the Mine's own, played once as well.
  assert.deepEqual(heard({ type: "impSteal", kind: "ledgeimp" }).played, [VOICES.imp.steal]);
});

/* --------------------------------------------------------------- drawing */

test("Ghoul Rush's Runaway Cart draws: the room in a lit and a dark one, the cart on the track, in the air and ducking, a crash, the beams, rubble, whole and broken crates, a slide's dust and its heap, the boulder near and far, the ledge imp in each act, and the stage's card", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["mine"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "cart") through(r);
  r.lives = 99;
  const spots = [[ROOM.start + 40, 0], [lines[3].pts[1][0] - 6, 3], [R.beams[0][0] - 5, 3], [R.rubble[0][0] - 10, 0], [R.crates[0][0] - 10, 2], [812, 4], [lines[3].x1 - 20, 3], [R.stop - 30, lines.length - 1]];
  for (const dark of [true, false]) {
    for (const [x, line] of spots) {
      r.dark = dark;
      r.phase = "play";
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      cartAt(r, x, line, { safe: true });
      r.cart.crates[0] = x < 300 ? 1 : 2;
      r.cart.crates[1] = 0;
      r.cart.slides = [{ x: x + 20, line, y: ct.trackY(R, line, x) ?? 10, warn: 400, down: false }, { x: x + 30, line, y: ct.trackY(R, line, x) ?? 10, warn: 0, down: true }];
      for (const act of ["perch", "crouch", "leap", "fall"]) ghoul.spawnMonster(r, "ledgeimp", x + 8 + (act.length % 4) * 3, 24, { rise: 0, awake: true, act, wait: 1e9, vx: 0, vy: 0, stole: act === "fall" });
      for (const air of [false, true]) {
        if (air) Object.assign(r.you, { state: "air", vy: 20, y: r.you.y + 4 });
        if (air) r.cart.line = -1;
        r.you.ducking = x > R.beams[0][0] - 8 && !air;
        r.cart.boulder = x - (air ? 2 : 30);
        for (let k = 0; k < 4; k++) g.tick(16);
        r.monsters.length = 0;
        r.you.safeMs = 1e9;
        cartAt(r, x, line, { safe: true });
      }
    }
  }
  assert.equal(r.spec.id, "cart");
  // The crash and the stop on the way out, the next room and the card.
  r.you.safeMs = 0;
  cartAt(r, R.rubble[0][0] - 3, R.rubble[0][1]);
  for (let k = 0; k < 30; k++) g.tick(16);
  assert.ok(r.bonusRound.hearts < r.bonusRound.max || r.phase !== "play", "the crash draws too");
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.stageSelect();
  const p = pick.round;
  const at = ghoul.STAGES.findIndex((s) => s.id === "mine");
  for (let i = 0; i < at; i++) ghoul.steerSelect(p, 1, 0);
  for (let i = 0; i < 3; i++) ghoul.steerSelect(p, 0, 1);
  assert.equal(p.select.room, 3);
  pick.tick(16);
  ghoul.takeSelect(p);
  assert.equal(p.spec.id, "cart");
  assert.equal(p.dark, true, "always dark");
  assert.equal(p.cart.line, 0);
  assert.equal(p.you.y, ct.trackY(R, 0, ROOM.start));
  pick.tick(16);
});

/* ----------------------------------------------------------- the bonus round */

// The ride as play reaches it, with its bonus round (cartRound turns it off for the ride's own tests).
const bonusCart = () => cartRound(true);

// A bot that rides without jumping the first heap of rubble (so it costs a heart).
const hurtBot = (r) => {
  rideBot(r);
  // A respawn wakes the room's monsters again; this ride is about the heap alone.
  for (const st of r.spawns) st.over = true;
  r.monsters.length = 0;
  if (r.you.x > 70 && r.you.x < 86 && r.cart && !r.cart.done && r.bonusRound.hearts === 5) {
    r.input.up = false;
    r.input.jump = 0;
  }
};

const awardKit = { ROOM_POINTS: 300, award: (rd, pts) => (rd.score += pts) };

test("Ghoul Rush's bonus round: the Runaway Cart is one (room flag bonus), a round gets five hearts of its own on entering it, none in any other room, and the intro shows first", () => {
  assert.equal(ROOM.bonus, true);
  assert.equal(ghoul.roomById("shaft").bonus, false);
  assert.equal(ghoul.roomById("seam").bonus, false);
  assert.equal(BONUS_HEARTS, 5);
  const round = ghoul.newRound(5);
  round.dice = 0;
  round.lives = 3;
  assert.equal(round.bonusRound, null, "not in the hall");
  through(round);
  round.offer = ["mine"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  assert.equal(round.bonusRound, null, "not in the shaft");
  while (round.spec.id !== "cart") through(round);
  const b = round.bonusRound;
  assert.deepEqual({ hearts: b.hearts, max: b.max, dice: b.dice, over: b.over }, { hearts: 5, max: 5, dice: 0, over: false });
  assert.equal(round.phase, "ready");
  assert.ok(round.phaseMs > 1500, `${round.phaseMs} ms to read the banner`);
  assert.equal(events(round, "bonusStart").length, 1);
  assert.ok(round.events.findLastIndex((e) => e.type === "bonusStart") < round.events.findLastIndex((e) => e.type === "room"), "the bonus banner comes before the room's name");
  assert.equal(round.lives, 3);
  assert.equal(b.perf.total, R.beams.length + R.rubble.length + R.crates.length);
  // The pill, drawn where the lives are, marked BONUS.
  const hud = { room: "A", stage: "B", time: 9, timeLow: false, bonus: 5, hearts: heartsText(b), chain: 0, chainFill: 1, key: false, effects: [], gauge: null, arm: null };
  const pills = hudLayout(20, 900, 3, hud, 30).map((q) => q.text);
  assert.ok(pills.includes("BONUS ♥♥♥♥♥"), pills.join("|"));
  assert.ok(!pills.includes("BONUS 5"), "the time bonus pill gives way to it");
  b.hearts = 2;
  assert.equal(heartsText(b), "BONUS ♥♥♡♡♡");
});

test("Ghoul Rush's bonus round: a hit costs one bonus heart and no life, the ride rolls on with a blinking safe moment, no respawn; Lucky dice in hand are not rolled; Garlic still saves the heart; a derail costs a heart too", () => {
  const round = bonusCart();
  round.dice = 4;
  const [x, line] = R.rubble.find(([rx]) => rx > R.checks[1] + 40);
  cartAt(round, x - 10, line);
  round.cart.check = 1;
  run(round, 600);
  assert.equal(events(round, "lose")[0]?.cause, "crash");
  assert.equal(events(round, "lose")[0].hearts, 4);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(round.lives, 3, "the run's lives are untouched");
  assert.equal(round.dice, 4, "and so are the dice (none rolled for a bonus heart)");
  assert.equal(round.phase, "play", "the ride never stops for a heart");
  assert.ok(round.you.x > x - 10, "and he is not sent back");
  assert.ok(round.you.safeMs > 0, "safe a moment (he blinks)");
  assert.ok(round.you.safeMs <= ghoul.BONUS_SAFE_MS, "a brief one");
  assert.equal(events(round, "respawn").length, 0, "no respawn");
  assert.equal(round.bonusRound.perf.hits.length, 1, "the heap is noted as hit");
  assert.equal(round.over, false);
  // Garlic is spent first.
  const garlic = bonusCart();
  cartAt(garlic, R.rubble[0][0] - 10, R.rubble[0][1]);
  garlic.you.garlic = true;
  run(garlic, 800);
  assert.equal(garlic.bonusRound.hearts, 5);
  assert.equal(garlic.you.garlic, false);
  // A fall off the track costs a heart as well, whatever protects him.
  const fall = bonusCart();
  cartAt(fall, lines[0].x1 - 6, 0);
  fall.you.garlic = true;
  run(fall, 1500);
  assert.equal(events(fall, "lose")[0]?.cause, "derail");
  assert.equal(fall.bonusRound.hearts, 4);
  assert.equal(fall.lives, 3);
  assert.equal(fall.phase, "play", "a derail keeps the ride going");
  assert.ok(fall.cart.line >= 0 && fall.you.state === "run", "and puts him back on the track");
  assert.ok(fall.you.safeMs > 0 || fall.you.garlic === false, "safe a moment");
});

test("Ghoul Rush's bonus round: the fifth lost heart ends it with no dice and no cost to the run (no game over), and the run goes on to the next room with its dice, lives and score", () => {
  const round = bonusCart();
  round.dice = 2;
  const score = round.score;
  for (let i = 0; i < 5; i++) {
    assert.equal(round.phase, "play", `heart ${i + 1}`);
    cartAt(round, lines[0].x1 - 6, 0);
    round.you.safeMs = 0;
    run(round, 1500);
    until(round, () => round.phase !== "crash", 3000);
    if (i < 4) until(round, () => round.phase === "play", 3000);
  }
  const b = round.bonusRound;
  assert.equal(b.hearts, 0);
  assert.equal(b.over, true);
  assert.equal(b.won, false);
  assert.deepEqual({ ...b.result }, { won: false, dice: 0, gained: 0 });
  const end = events(round, "bonusEnd");
  assert.equal(end.length, 1);
  assert.equal(end[0].won, false);
  assert.equal(end[0].dice, 0);
  assert.equal(round.over, false, "no game over");
  assert.equal(round.lives, 3, "no run life lost");
  assert.equal(round.dice, 2, "dice untouched");
  assert.ok(round.score >= score, "candy picked up on the way counts, nothing is taken");
  assert.equal(round.phase, "clear");
  assert.ok(round.phaseMs <= ghoul.CARD_LOST_MS && ghoul.CARD_LOST_MS <= 2600, "a short card");
  // On to the Seam, as ever.
  run(round, ghoul.CARD_LOST_MS + 100);
  assert.equal(round.spec.id, "seam");
  assert.equal(round.bonusRound, null);
  assert.equal(round.cart, null);
  assert.equal(round.lives, 3);
  assert.equal(round.dice, 2);
  assert.equal(round.phase, "bossintro", "the boss room opens on its card");
  skipBossIntro(ghoul, round);
  assert.equal(round.phase, "ready");
  // A life lost there is a run life as always, and the dice roll for it.
  round.phase = "play";
  ghoul.lose(round, "zombie");
  assert.equal(round.phase, "ask", "the carried dice are offered");
  round.ask.t = ghoul.ASK_GUARD_MS;
  ghoul.answerDie(round, true);
  assert.equal(round.phase, "roll", "the carried dice are rolled");
});

test("Ghoul Rush's bonus round: endless lives (round.infinite) spare the hearts as they spare lives, through the same lose path", () => {
  const round = bonusCart();
  round.infinite = true;
  for (let i = 0; i < 7; i++) {
    cartAt(round, lines[0].x1 - 6, 0);
    round.you.safeMs = 0;
    run(round, 1500);
    until(round, () => round.phase === "play", 3000);
  }
  assert.ok(events(round, "lose").length >= 7);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.bonusRound.over, false);
  assert.equal(round.lives, 3);
});

test("Ghoul Rush's bonus round: finishing alive pays 3 to 9 Lucky dice, added to the run's, more for a better ride (hearts, clean passes, things shot or broken)", () => {
  const clean = bonusCart();
  const got = ride(clean, 120000, rideBot);
  assert.equal(clean.phase, "clear");
  assert.deepEqual(got.lost, []);
  const b = clean.bonusRound;
  assert.equal(b.over, true);
  assert.equal(b.won, true);
  assert.equal(b.hearts, 5);
  assert.ok(b.dice >= BONUS_FLOOR && b.dice <= ghoul.MAX_DICE, `${b.dice} dice`);
  assert.equal(clean.dice, b.dice, "added to the run's");
  assert.deepEqual({ ...b.result }, { won: true, dice: b.dice, gained: b.dice });
  assert.equal(clean.lives, 3);
  // A hit costs a heart and a clean pass: fewer dice than the clean ride.
  const hurt = bonusCart();
  const got2 = ride(hurt, 120000, hurtBot);
  assert.equal(hurt.phase, "clear");
  assert.ok(got2.lost.length >= 1, "it hit the first heap");
  assert.ok(hurt.bonusRound.dice >= BONUS_FLOOR, "never under the floor");
  assert.ok(hurt.bonusRound.dice < b.dice, `${hurt.bonusRound.dice} dice against ${b.dice}`);
  // Shooting on the way raises it: with the blaster held and the monsters about, crates break and bats fall.
  const shooter = bonusCart();
  for (const st of shooter.spawns) st.over = false;
  shooter.hordeMs = 3000;
  shooter.lives = 99;
  shooter.bonusRound.hearts = 99;
  const shoot = (r) => {
    rideBot(r);
    r.input.fire = true;
  };
  ride(shooter, 150000, shoot);
  assert.equal(shooter.phase, "clear");
  assert.ok(shooter.bonusRound.perf.acts + (shooter.stats.kills - shooter.bonusRound.perf.kills0) >= 8, "crates broken and monsters shot");
  assert.ok(shooter.bonusRound.dice >= BONUS_FLOOR + 1);
});

test("Ghoul Rush's bonus round: the dice formula (floor 3, up to six more by hearts, clean obstacles, things shot or broken, and no braking), the cap at nine, and braking costs the steady die", () => {
  const mk = (hearts, perf = {}) => {
    const b = makeBonus({ stats: { kills: 0 } });
    b.hearts = hearts;
    Object.assign(b.perf, { total: 10 }, perf);
    return b;
  };
  const all = Array.from({ length: 10 }, (_, i) => `o${i}`);
  assert.equal(diceFor(mk(1, { hits: all, steady: false })), 3, "the floor");
  assert.equal(diceFor(mk(1, { hits: [], steady: false })), 3 + 2, "clean only");
  assert.equal(diceFor(mk(5, { hits: all, steady: false })), 5, "hearts only");
  assert.equal(diceFor(mk(3, { hits: all, steady: false })), 4);
  assert.equal(diceFor(mk(5, { hits: [], acts: 8, steady: true })), 9, "a perfect ride is the cap");
  assert.equal(diceFor(mk(5, { hits: [], acts: 7, steady: true })), 8, "one short of the goal");
  assert.equal(diceFor(mk(5, { hits: all.slice(0, 5), acts: 8, steady: true })), 3 + 2 + 1 + 1 + 1);
  assert.ok(diceFor(mk(5, { hits: [], acts: 99 })) <= ghoul.MAX_DICE);
  assert.equal(diceFor(mk(5, { hits: [], acts: 0, total: 0 })), 3 + 2 + 0 + 0 + 1, "no obstacles counted");
  // Kills count with the acts.
  assert.equal(diceFor(mk(5, { hits: [], acts: 4, goal: 8 }), 4), 9);
  // No cap on the run's dice: eight in hand and a nine-die ride leaves seventeen.
  const round = bonusCart();
  round.dice = 8;
  Object.assign(round.bonusRound.perf, { hits: [], acts: 8 });
  assert.equal(endBonus(round, true, awardKit), true);
  assert.equal(round.dice, 17);
  assert.equal(round.bonusRound.dice, 9, "earned nine");
  assert.equal(round.bonusRound.gained, 9, "all nine kept");
  assert.equal(endBonus(round, true, awardKit), false, "ends once");
  // Braking: a short brake is fine, too long is no steady hand.
  const brake = bonusCart();
  cartAt(brake, 300, 1, { safe: true });
  run(brake, 1000, { left: true });
  assert.equal(brake.bonusRound.perf.steady, true);
  const more = bonusCart();
  cartAt(more, 2100, 9, { safe: true });
  more.cart.boulder = 2000;
  run(more, ct.STEADY_BRAKE_MS + 400, { left: true });
  assert.equal(more.bonusRound.perf.steady, false);
  assert.ok(more.bonusRound.perf.brakeMs > ct.STEADY_BRAKE_MS);
});

test("Ghoul Rush's bonus round: the card, the pills and the heart-lost words draw (won with dice tumbling in, lost, a heart down), and click as each die lands", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["mine"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  while (r.spec.id !== "cart") through(r);
  assert.ok(g.hud.hearts.startsWith("BONUS ♥♥♥♥♥"));
  r.phase = "play";
  for (const st of r.spawns) st.over = true;
  r.hordeMs = Infinity;
  for (let k = 0; k < 4; k++) g.tick(16);
  // A heart down.
  ghoul.lose(r, "crash");
  for (let k = 0; k < 4; k++) g.tick(16);
  assert.ok(g.hud.hearts.includes("♡"));
  for (const won of [false, true]) {
    r.phase = "play";
    r.bonusRound.over = false;
    r.bonusRound.hearts = 4;
    r.you.out = 0;
    r.you.safeMs = 0;
    const b = r.bonusRound;
    endBonus(r, won, awardKit);
    const dice = b.dice;
    for (let k = 0; k < (won ? 400 : 30) && r.phase === "clear"; k++) g.tick(16);
    assert.equal(b.won, won);
    assert.equal(dice > 0, won);
  }
  // The tones: one click per die that has landed, once each.
  const played = [];
  const fx = {};
  const kit = { tone: (n) => played.push(n), fx };
  const round2 = { bonusRound: { over: true, won: true, dice: 5, cardMs: 4600 }, phase: "clear", phaseMs: 4600 - 2300 };
  bonusTick(round2, kit);
  assert.equal(fx.bonusLanded, 5, "all five by 2.3 s");
  assert.equal(played.filter((n) => n === "thunk").length, 5);
  bonusTick(round2, kit);
  assert.equal(played.filter((n) => n === "thunk").length, 5, "each lands once");
  assert.ok(heard({ type: "bonusEnd", won: true, dice: 5, x: 10, y: 6 }, { fx: {} }).played.includes("fanfare"));
  const banner = [];
  heard({ type: "bonusStart", hearts: 5, max: 5 }, { banner: (t, sub) => banner.push([t, sub]) });
  assert.equal(banner[0][0], "BONUS ROUND");
  assert.ok(banner[0][1].includes("5 hearts"));
  const floats = [];
  heard({ type: "lose", cause: "crash", hearts: 2, lives: 3 }, { float: (x, y, text) => floats.push(text) });
  assert.ok(floats.includes("2 hearts left"));
  const respawn = [];
  heard({ type: "respawn", hearts: 1, lives: 3 }, { banner: (t, sub) => respawn.push(sub) });
  assert.equal(respawn[0], "1 bonus heart left");
});

test("Ghoul Rush's Runaway Cart: the chase (the boulder surges 1.55 times faster over a span) flattens a cart that never leans and spares one that holds right, and warns once", () => {
  const [x0, x1, mult] = R.surge[0];
  assert.equal(ct.surgeAt(R, x0 - 1), 1);
  assert.equal(ct.surgeAt(R, x0 + 1), mult);
  assert.equal(ct.surgeAt(R, x1 + 1), 1);
  const chase = (lean) => {
    const round = cartRound();
    const line = ct.linesAt(R, x0 - 4)[0][0];
    cartAt(round, x0 - 4, line);
    round.cart.boulder = round.you.x - ct.BOULDER_GAP;
    let t = 0;
    for (; t < 12000 && round.you.x < x1 + 10 && round.phase === "play"; t += 16) {
      rideBot(round);
      round.input.right = lean;
      ghoul.advance(round, 16, steady);
    }
    return { round, lost: events(round, "lose")[0]?.cause };
  };
  const slack = chase(false);
  assert.equal(slack.lost, "boulder", "never leaning, it is caught");
  const lean = chase(true);
  assert.equal(lean.lost, undefined, `leaning, it stays ahead (${lean.lost} at ${lean.round.you.x.toFixed(0)}, gap ${(lean.round.you.x - lean.round.cart.boulder).toFixed(1)}, v ${lean.round.cart.v.toFixed(1)})`);
  assert.equal(events(lean.round, "boulderSurge").length, 1);
  assert.ok(lean.round.you.x - lean.round.cart.boulder > ct.BOULDER_CATCH + 5);
});
