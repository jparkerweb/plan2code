// Web console tests, Ghoul Rush's retry mercy: after a loss in a room, each restart of it sets one power-up a few steps ahead of Planny (never the first attempt, never in a ride or bonus room), the kind from its own hash so no shared roll shifts, on a firm surface, replacing the last one uncollected, reset when the room is cleared.
// Run with: node --test scripts/test-web-console-activities-ghoul-retry.mjs

import test from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import { MERCY_FAR, MERCY_NEAR, mercyKind, mercySpot, mix3 } from "../src/web-console/public/activities/ghoul-powers.js";

const steady = () => 0.5;
const mercies = (round) => round.drops.filter((d) => d.mercy);
const events = (round, type) => round.events.filter((e) => e.type === type);
// What ghoul.js hands the spot finder, through the real footing().
const SPOT_KIT = Object.freeze({ footing: ghoul.footing, leftEdge: () => 1.5, rightEdge: (r) => r.spec.length - 1.5 });

function stubCanvas() {
  const calls = { count: 0 };
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : () => { calls.count += 1; }),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, calls };
}

// Every spawner spent and the horde held back, so nothing else wakes.
function quiet(round) {
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  return round;
}

// A round standing at the start of room `ri` of stage `si` (the hall when `si` is -1), in play.
function inRoom(si, ri, seed = 5) {
  const round = ghoul.newRound(seed);
  round.dice = 0;
  if (si >= 0) {
    round.phase = "select";
    round.select = { at: si, room: ri };
    assert.ok(ghoul.takeSelect(round));
  }
  round.phase = "play";
  round.events.length = 0;
  round.lives = 99;
  return quiet(round);
}

// A life lost (`cause`), then on through the crash and the "Ready?" hold to play again.
function die(round, cause = "zombie") {
  round.phase = "play";
  round.you.out = 0;
  round.you.safeMs = 0;
  assert.ok(ghoul.lose(round, cause));
  for (let ms = 0; ms < 20000 && round.phase !== "play" && !round.over; ms += 50) ghoul.advance(round, 50, steady);
  return quiet(round);
}

const everyRoom = () => ghoul.STAGES.flatMap((st, si) => st.rooms.map((id, ri) => ({ st, si, ri, id })));
const special = (round) => Boolean(round.spec.ride || round.spec.bonus || round.bonusRound);

test("Ghoul Rush retry mercy: the first attempt of a room spawns nothing, the second exactly one power-up a few steps ahead of Planny on the floor", () => {
  const round = inRoom(-1, 0);
  assert.equal(mercies(round).length, 0);
  assert.equal(events(round, "retry").length, 0);
  assert.deepEqual(round.retries, { room: round.room, n: 0 });
  die(round);
  const m = mercies(round);
  assert.equal(m.length, 1, "exactly one");
  assert.equal(events(round, "retry").length, 1);
  assert.deepEqual(round.retries, { room: round.room, n: 1 });
  const dx = m[0].x - round.you.x;
  assert.ok(dx >= MERCY_NEAR && dx <= MERCY_FAR, `ahead by ${dx}`);
  assert.equal(dx, MERCY_FAR, "the far end of the range when the floor allows");
  assert.ok(ghoul.groundAt(round.spec, m[0].x) > -Infinity, "over a floor");
  assert.equal(m[0].y - 1, ghoul.groundAt(round.spec, m[0].x), "resting on its surface");
  assert.ok(m[0].rest);
  assert.ok(!["life", "die"].includes(m[0].kind) && !ghoul.POWERS[m[0].kind].arm, `no 1UP, die or weapon (${m[0].kind})`);
  assert.ok(ghoul.powerHere(round, m[0].kind));
});

test("Ghoul Rush retry mercy: a third attempt gets a fresh pickup and the uncollected one is gone, never more than one alive", () => {
  const round = inRoom(-1, 0);
  die(round);
  const first = mercies(round)[0];
  die(round);
  const second = mercies(round);
  assert.equal(second.length, 1);
  assert.notEqual(second[0], first, "a new object");
  assert.equal(round.retries.n, 2);
  assert.deepEqual(events(round, "retry").map((e) => e.n), [1, 2]);
  for (let i = 0; i < 4; i++) die(round);
  assert.equal(mercies(round).length, 1);
  assert.equal(round.retries.n, 6);
});

test("Ghoul Rush retry mercy: walking into it takes it like any power-up, and the next loss sets out another", () => {
  const round = inRoom(-1, 0);
  die(round);
  const [m] = mercies(round);
  Object.assign(round.you, { x: m.x, y: ghoul.groundAt(round.spec, m.x), vx: 0, vy: 0, state: "run", shelf: -1 });
  round.events.length = 0;
  ghoul.advance(round, 8, steady);
  assert.deepEqual(events(round, "power").map((e) => e.kind), [m.kind]);
  assert.equal(mercies(round).length, 0);
  die(round);
  assert.equal(mercies(round).length, 1);
});

test("Ghoul Rush retry mercy: clearing the room resets the count, the next room's first attempt spawns nothing, and its second does", () => {
  const round = inRoom(0, 0);
  die(round);
  die(round);
  assert.equal(round.retries.n, 2);
  assert.equal(mercies(round).length, 1);
  // Through the door the way play does it.
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
  assert.equal(round.spec.id, ghoul.STAGES[0].rooms[1]);
  assert.equal(round.retries.n, 0, "reset for the new room");
  assert.equal(mercies(round).length, 0, "the old pickup is gone with the room");
  round.phase = "play";
  quiet(round);
  die(round);
  assert.equal(round.retries.n, 1);
  assert.equal(mercies(round).length, 1);
});

test("Ghoul Rush retry mercy: a boss room (from its start, or locked in the arena) gets one too", () => {
  const si = 0;
  const ri = ghoul.STAGES[si].rooms.length - 1;
  const round = inRoom(si, ri);
  assert.ok(round.spec.boss);
  die(round);
  assert.equal(mercies(round).length, 1, "from the start");
  const arena = inRoom(si, ri);
  arena.lockX = arena.spec.arena;
  arena.boss.state = "fight";
  die(arena);
  const m = mercies(arena);
  assert.equal(m.length, 1, "in the arena");
  assert.ok(m[0].x > arena.spec.arena && m[0].x < arena.spec.length, "inside the arena");
});

test("Ghoul Rush retry mercy: a ride or bonus room never gets one, every other room of every stage does", () => {
  let rides = 0;
  let plain = 0;
  for (const { si, ri, id } of everyRoom()) {
    const round = inRoom(si, ri);
    round.lives = 9;
    if (round.bonusRound) round.bonusRound.hearts = 5;
    round.you.out = 0;
    round.you.safeMs = 0;
    ghoul.lose(round, "zombie");
    for (let ms = 0; ms < 20000 && round.phase !== "play" && !round.over; ms += 50) ghoul.advance(round, 50, steady);
    if (special(round)) {
      rides++;
      assert.equal(mercies(round).length, 0, `${id}: none in a ride or bonus room`);
      assert.equal(events(round, "retry").length, 0, id);
    } else {
      plain++;
      assert.equal(mercies(round).length, 1, `${id}: one`);
    }
  }
  assert.ok(rides >= 1 && plain >= 20, `${rides} special rooms, ${plain} others`);
});

test("Ghoul Rush retry mercy: over every stage's rooms, dark and lit, many retries, only what powerHere allows turns up, never a 1UP, die or weapon", () => {
  const seen = new Set();
  for (const { st, si, ri, id } of everyRoom()) {
    for (const dark of [true, false]) {
      const round = inRoom(si, ri, 11 + ri);
      if (special(round)) continue;
      round.dark = dark;
      for (let n = 1; n <= 12; n++) {
        const kind = mercyKind(round, n, { seeded: ghoul.seeded });
        assert.ok(ghoul.powerHere(round, kind), `${id}: ${kind} here`);
        assert.ok(!["life", "die"].includes(kind) && !ghoul.POWERS[kind].arm, `${id}: ${kind} is a plain power-up`);
        if (ghoul.POWERS[kind].stage) assert.equal(ghoul.POWERS[kind].stage, st.id, `${id}: ${kind} only in its stage`);
        if (ghoul.POWERS[kind].dark) assert.ok(dark, `${id}: the Lantern only in the dark`);
        if (kind === "hourglass") assert.ok(round.timeMs > 0, `${id}: no Hourglass where there is no clock`);
        seen.add(kind);
      }
    }
  }
  assert.ok(seen.size >= 6, `variety: ${[...seen].join(", ")}`);
});

test("Ghoul Rush retry mercy: the spot is firm ground within reach, facing either way, never a pit, a wall, a belt or water, and found at every room's start", () => {
  for (const { id, si, ri } of everyRoom()) {
    const round = inRoom(si, ri);
    if (special(round)) continue;
    const spec = round.spec;
    const open = [...(spec.belts || []), ...(spec.water || [])];
    assert.ok(mercySpot(round, SPOT_KIT), `${id}: a spot at the start`);
    for (let x = 3; x < spec.length - 3; x += 1.7) {
      const g = ghoul.groundAt(spec, x);
      if (g === -Infinity) continue;
      for (const face of [1, -1]) {
        Object.assign(round.you, { x, y: g, face, shelf: -1 });
        const s = mercySpot(round, SPOT_KIT);
        if (!s) continue;
        const d = (s.x - x) * face;
        assert.ok(d >= MERCY_NEAR - 1e-9 && d <= MERCY_FAR + 1e-9, `${id}@${x}: ${d} ahead`);
        for (const px of [s.x - 1, s.x, s.x + 1]) assert.ok(ghoul.footing(round, px, g), `${id}@${x}: firm at ${px}, not a pit or a wall`);
        assert.ok(Math.abs(s.y - g) <= ghoul.STEP_UP, `${id}@${x}: a step or less`);
        assert.ok(open.every(([a, b]) => s.x < a - 1 || s.x > b + 1), `${id}@${x}: clear of belts and water`);
      }
    }
  }
});

test("Ghoul Rush retry mercy: the kind is a pure hash of (seed, room, retry), the shared rng is never touched, and a run with a mercy spawn rolls the same monsters afterwards as one without", () => {
  const kit = { seeded: ghoul.seeded };
  const round = inRoom(0, 1, 9);
  assert.equal(mercyKind(round, 3, kit), mercyKind(round, 3, kit));
  assert.equal(mix3(1, 2, 3), mix3(1, 2, 3));
  assert.notEqual(mix3(1, 2, 3), mix3(1, 2, 4));
  const kinds = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => mercyKind(round, n, kit)));
  assert.ok(kinds.size >= 3, "the retries vary");
  // The pick asks for a fresh stream of its own; the round's rng is never an input.
  let made = 0;
  mercyKind(round, 1, { seeded: (s) => { made++; return ghoul.seeded(s); } });
  assert.equal(made, 1);
  // Same seed, same loss; one lets the mercy spawn, the other has it switched off (a bonus spec while the crash ends). Both then play on with an identical rng.
  const play = (withMercy) => {
    const r = ghoul.newRound(21);
    r.dice = 0;
    r.phase = "play";
    let calls = 0;
    const base = ghoul.seeded(77);
    const rng = () => {
      calls++;
      return base();
    };
    r.you.out = 0;
    r.you.safeMs = 0;
    const real = r.spec;
    ghoul.lose(r, "zombie");
    if (!withMercy) r.spec = { ...real, bonus: true };
    for (let ms = 0; ms < 20000 && r.phase !== "play"; ms += 50) {
      ghoul.advance(r, 50, rng);
      if (r.phase === "ready") r.spec = real;
    }
    r.spec = real;
    const spawned = mercies(r).length;
    r.drops.length = 0;
    const before = calls;
    // Stand still and let the hall wake.
    for (let ms = 0; ms < 12000 && !r.over; ms += 16) {
      r.you.safeMs = 1e6;
      ghoul.advance(r, 16, rng);
    }
    return { spawned, calls: calls - before, shape: JSON.stringify(r.monsters.map((m) => [m.kind, +m.x.toFixed(3), +m.y.toFixed(3)])), n: r.monsters.length };
  };
  const a = play(true);
  const b = play(false);
  assert.equal(a.spawned, 1);
  assert.equal(b.spawned, 0);
  assert.ok(a.n > 0, "monsters came");
  assert.deepEqual([a.calls, a.shape], [b.calls, b.shape], "the same monsters, the same draws");
});

test("Ghoul Rush retry mercy: a clock run out restarts the room and counts, and so does a death with the endless-lives code on", () => {
  const timed = inRoom(0, 0);
  assert.ok(timed.timeMs > 0);
  timed.timeMs = 20;
  const lives = timed.lives;
  for (let ms = 0; ms < 20000 && timed.phase !== "ready"; ms += 4) ghoul.advance(timed, 4, steady);
  assert.equal(events(timed, "timeUp").length, 1);
  assert.equal(timed.lives, lives - 1);
  assert.equal(timed.retries.n, 1);
  assert.equal(mercies(timed).length, 1);
  const endless = inRoom(0, 0);
  endless.infinite = true;
  die(endless);
  die(endless);
  assert.equal(endless.lives, 99, "no life lost");
  assert.equal(endless.retries.n, 2);
  assert.equal(mercies(endless).length, 1);
});

test("Ghoul Rush retry mercy: no pickup when the run is over, and a practice round's first attempt spawns nothing like any other", () => {
  const spent = inRoom(-1, 0);
  spent.lives = 1;
  die(spent);
  assert.ok(spent.over);
  assert.equal(mercies(spent).length, 0);
  const practice = inRoom(0, 1);
  practice.practice = true;
  assert.equal(mercies(practice).length, 0);
  die(practice);
  assert.equal(mercies(practice).length, 1);
});

test("Ghoul Rush retry mercy: the game draws the pickup, its shimmer and its words in dark and lit rooms without error", () => {
  for (const dark of [true, false]) {
    const { canvas, calls } = stubCanvas();
    const g = ghoul.default.create({ canvas });
    g.resize(900, 900);
    g.key("action");
    g.round.dice = 0;
    for (let ms = 0; ms < 4000; ms += 16) g.tick(16);
    const r = g.round;
    r.dark = dark;
    r.lives = 9;
    r.you.safeMs = 0;
    r.you.out = 0;
    ghoul.lose(r, "zombie");
    const before = calls.count;
    let seen = 0;
    for (let ms = 0; ms < 8000; ms += 16) {
      g.tick(16);
      seen = Math.max(seen, mercies(r).length);
    }
    assert.equal(seen, 1, `a pickup in the ${dark ? "dark" : "light"}`);
    assert.ok(calls.count > before);
  }
});
