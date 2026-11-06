// Web console tests, Ghoul Rush's Blackmoor Sanatorium stage: its four rooms, orderlies that grab and throw you (and cost no life), gurneys that park, rattle and roll, flickers you can only hit and be hurt by when the lamps go out, specimen bloaters and their formaldehyde, the lamps' flicker, Smelling Salts and the Bone Saw (found only here), and the Night Matron, whose lantern cone builds heat, is stopped by the medicine cabinets and cannot reach the boards, with her syringes, arms and rage.
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as sn from "../src/web-console/public/activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium.js";
import { LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium-draw.js";
import { PILL_WORDS, pickPower } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-powers.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);
// The four rooms that are walked, and the stage's five with the bonus gurney ride between the Theater and the Ward (its own suite: ghoul-gurney).
const ROOM_IDS = ["admissions", "baths", "theater", "ward"];

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Sanatorium's room `id`, reached the way play reaches it,
// nothing woken: every spawner spent, the horde held back, the lamps far off.
function sanRound(id) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["sanatorium"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== id) through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.items.fill(true);
  round.candy.fill(true);
  round.sky.fill(true);
  round.timeMs = 1e9;
  round.dark = false;
  if (round.twist) round.twist.next = 1e9;
  round.events.length = 0;
  return round;
}

function standAt(round, x, face = 1, y = ghoul.groundAt(round.spec, x), shelf = -1) {
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, out: 0, safeMs: 0, face });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

const put = (round, kind, x, over = {}) => ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), { rise: 0, ...over });

function run(round, ms, keys = {}) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, steady);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

function until(round, done, ms = 4000) {
  for (let t = 0; t < ms && !done(); t += 4) ghoul.advance(round, 4, steady);
}

// Runs `ms`, returning each event of `type` as [the round's clock, event].
function log(round, ms, type, random = steady) {
  const got = [];
  for (let t = 0; t < ms; t += 4) {
    ghoul.advance(round, 4, random);
    for (const e of round.events) if (e.type === type) got.push([round.clock, e]);
    round.events.length = 0;
  }
  return got;
}

// A bolt arriving from the left at height `y` on the monster `m`.
const bolt = (round, m, y) => round.shots.push({ x: m.x - m.w / 2 - 0.3, y, vx: 80, vy: 0, gone: 0 });

const heard = (e, extra = {}) => {
  const played = [];
  const floats = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: (x, y, text) => floats.push(text), ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played, floats };
};

test("Ghoul Rush's Blackmoor Sanatorium is a stage of three rooms and the Night Ward, its monsters and boss joined to the game's, with two power-ups of its own and a place for each kind", () => {
  const st = ghoul.stageById("sanatorium");
  assert.deepEqual(st.rooms, ["admissions", "baths", "theater", "codeblue", "ward"]);
  assert.equal(st.boss, "matron");
  assert.equal(st.title, "Blackmoor Sanatorium");
  assert.equal(st.sub, "Visiting hours ended in 1912");
  for (const kind of Object.keys(sn.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], sn.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.BOSSES.matron, sn.BOSSES.matron);
  assert.equal(sn.BOSSES.matron.sub, "Stay out of her lantern light");
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const [admissions, baths, theater, ward] = ROOM_IDS.map((id) => ghoul.roomById(id));
  const returning = ["zombie", "crawl", "ghost", "spitter"];
  for (const room of [admissions, baths, theater]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    assert.ok(room.items.some((i) => i[0] === "salts") && room.items.some((i) => i[0] === "saw"), `${room.id}: both power-ups of the stage`);
    assert.ok(room.spawns.some((s) => s[0] in sn.MONSTERS), `${room.id}: some of the new monsters`);
    assert.ok(room.spawns.some((s) => returning.includes(s[0])), `${room.id}: some returning ones`);
  }
  assert.ok(admissions.spawns.some((s) => s[0] === "orderly") && admissions.spawns.some((s) => s[0] === "gurney"), "orderlies and gurneys first met in Admissions");
  assert.ok(baths.spawns.some((s) => s[0] === "specimen") && baths.spawns.some((s) => s[0] === "flicker"), "specimens and flickers in the Baths");
  for (const kind of Object.keys(sn.MONSTERS)) assert.ok(theater.spawns.some((s) => s[0] === kind), `the Theater has ${kind}`);
  assert.equal(ward.boss, "matron");
  assert.equal(ward.horde.length, 0);
  // Tubs as low pits to hop; the Baths and the Theater flicker, the Theater more often.
  assert.ok(baths.ground.some((g, i) => i && g[0] - baths.ground[i - 1][1] > 0), "pits");
  assert.deepEqual([admissions.flicker, baths.flicker, theater.flicker, ward.flicker], [0, 9000, 6500, 0]);
  assert.ok(admissions.spawns.length <= baths.spawns.length && baths.spawns.length <= theater.spawns.length);
  assert.ok(admissions.hordeMs > baths.hordeMs && baths.hordeMs > theater.hordeMs, "harder in order");
  // The ward: two raised floor blocks (the cabinets) and boards above the beam's reach.
  const cabinets = ward.ground.filter((g) => g[2] > 6);
  assert.equal(cabinets.length, 2);
  const lantern = 6 + sn.BEAM_ORIGIN_Y;
  const reach = lantern + Math.tan(sn.BEAM_HALF - sn.DEP_MIN) * sn.BEAM_RANGE;
  assert.ok(ward.shelves.some((s) => s[2] + ghoul.HIT_H / 2 > reach + 2), "boards above the beam's reach");
  assert.ok(ghoul.MONSTERS.orderly.hp === 10 && ghoul.MONSTERS.gurney.hp === 5 && ghoul.MONSTERS.flicker.hp === 2);
});

/* ---------------------------------------------------------- the orderly */

test("Ghoul Rush's orderly walks at you, reaches within 3 of its edge for 450 ms, grabs for 600 ms and throws you 14 back and up, and the throw costs no life", () => {
  const round = sanRound("admissions");
  standAt(round, 40);
  const o = put(round, "orderly", 60);
  assert.equal(o.act, "walk");
  assert.equal(ghoul.MONSTERS.orderly.stomp, false);
  run(round, 400);
  assert.ok(o.x < 60, "it walks at you");
  assert.equal(events(round, "orderlyReach").length, 0);
  // Close: it reaches.
  Object.assign(o, { x: 44, act: "walk" });
  run(round, 8);
  assert.equal(o.act, "reach");
  assert.equal(events(round, "orderlyReach").length, 1);
  const lives = round.lives;
  const reached = round.clock;
  until(round, () => o.act === "hold", 800);
  assert.ok(Math.abs(round.clock - reached - sn.ORDERLY_REACH_MS) < 60, `450 ms of reach (${round.clock - reached})`);
  assert.equal(events(round, "orderlyGrab").length, 1);
  // Held: no key moves you.
  const held = round.clock;
  round.input.right = true;
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  run(round, 300);
  assert.equal(round.you.x, 40, "you cannot move");
  assert.equal(round.you.y, 6);
  round.input.right = false;
  until(round, () => events(round, "orderlyThrow").length > 0, 1000);
  assert.ok(Math.abs(round.clock - held - sn.ORDERLY_HOLD_MS) < 60, `600 ms of hold (${round.clock - held})`);
  // Thrown back (away from it) and up.
  let top = 6;
  until(round, () => {
    top = Math.max(top, round.you.y);
    return round.you.y <= 6 && round.you.state === "run";
  }, 1200);
  until(round, () => round.you.state === "run", 1200);
  assert.ok(top > 12, `up (${top.toFixed(1)})`);
  assert.ok(Math.abs(round.you.x - (40 - sn.ORDERLY_THROW_BACK)) < 1.5, `about 14 back (${round.you.x.toFixed(1)})`);
  assert.equal(events(round, "lose").length, 0, "no life lost");
  assert.equal(round.lives, lives);
  assert.equal(round.you.out, 0);
  // It rests, then walks at you again.
  assert.equal(o.act, "rest");
  until(round, () => o.act === "walk", 2000);
  assert.equal(o.act, "walk");
});

test("Ghoul Rush's orderly never hurts by touch, can be shot (10 bolts), and a jump out of its reach escapes the grab", () => {
  const round = sanRound("admissions");
  standAt(round, 40);
  const o = put(round, "orderly", 40, { act: "rest", wait: 1e9 });
  run(round, 400);
  assert.equal(events(round, "lose").length, 0, "standing inside it costs nothing");
  assert.equal(ghoul.solid(o), true, "it can be hit");
  for (let k = 0; k < 4; k++) {
    bolt(round, o, 8);
    ghoul.advance(round, 4, steady);
  }
  assert.equal(o.hp, 6, "four bolts, four hp");
  // In the air when the reach ends, you are out of its grasp.
  const air = sanRound("admissions");
  standAt(air, 40);
  const a = put(air, "orderly", 46, { act: "reach", wait: 12, dir: -1 });
  Object.assign(air.you, { y: 13, state: "air", vy: 0 });
  run(air, 16);
  assert.equal(a.act, "rest", "it missed");
  assert.equal(events(air, "orderlyGrab").length, 0);
  // Out of its grasp's width, too.
  const far = sanRound("admissions");
  standAt(far, 20);
  const f = put(far, "orderly", 33, { act: "reach", wait: 12, dir: -1 });
  run(far, 16);
  assert.equal(f.act, "rest");
  // On a bench above it, it does not even reach.
  const bench = sanRound("admissions");
  standAt(bench, 44, 1, 11, 0);
  const b = put(bench, "orderly", 48);
  run(bench, 100);
  assert.equal(b.act, "walk");
});

test("Ghoul Rush's throw costs no life, but where you land can: a pit does", () => {
  const round = sanRound("baths");
  standAt(round, 116);
  put(round, "orderly", 121, { act: "reach", wait: 4, dir: -1 });
  const lives = round.lives;
  until(round, () => events(round, "lose").length > 0, 3000);
  assert.equal(events(round, "orderlyThrow").length, 1);
  assert.equal(events(round, "lose")[0]?.cause, "pit", "the pit took it");
  assert.equal(round.lives, lives - 1);
});

test("Smelling Salts break an orderly's grab at once: no throw, you are free, and it staggers", () => {
  const round = sanRound("admissions");
  standAt(round, 40);
  const o = put(round, "orderly", 44, { act: "reach", wait: 4, dir: -1 });
  until(round, () => o.act === "hold", 100);
  assert.equal(o.act, "hold");
  ghoul.applyPower(round, "salts");
  run(round, 8);
  assert.equal(o.act, "rest");
  assert.equal(events(round, "saltsBreak").length, 1);
  assert.equal(events(round, "orderlyThrow").length, 0, "no throw");
  assert.equal(round.you.heldMs <= 0, true, "free");
  round.input.right = true;
  run(round, 100);
  round.input.right = false;
  assert.ok(round.you.x > 42, "you run again");
  // With the Salts already in hand, the grab breaks as soon as it is made.
  const hold = sanRound("admissions");
  standAt(hold, 40);
  ghoul.applyPower(hold, "salts");
  const p = put(hold, "orderly", 44, { act: "reach", wait: 4, dir: -1 });
  run(hold, 40);
  assert.equal(p.act, "rest");
  assert.equal(events(hold, "orderlyThrow").length, 0);
});

/* ----------------------------------------------------------- the gurney */

test("Ghoul Rush's gurney: parked it is harmless and a floor; within 18 it rattles 500 ms, then rolls at you fast to a wall, rests 1.5 s and rolls back", () => {
  const round = sanRound("admissions");
  standAt(round, 20);
  const g = put(round, "gurney", 120);
  run(round, 100);
  assert.equal(g.act, "parked", "far off");
  assert.equal(events(round, "gurneyRattle").length, 0);
  // Standing on top of it: the highest floor under you.
  assert.equal(g.act, "parked");
  assert.equal(ghoul.solid(g), true, "solid to bolts");
  standAt(round, 120, 1, 6 + g.h + 0.6);
  round.you.safeMs = 0;
  Object.assign(round.you, { state: "air", vy: -10 });
  until(round, () => round.you.state === "run", 400);
  assert.equal(round.you.y, 6 + g.h, "you stand on its top");
  assert.equal(events(round, "lose").length, 0, "a parked gurney hurts nothing");
  // Within 18 it rattles.
  assert.equal(g.act, "rattle");
  assert.equal(events(round, "gurneyRattle").length, 1);
  const rattled = round.clock;
  until(round, () => g.act === "roll", 800);
  assert.ok(Math.abs(round.clock - rattled - sn.GURNEY_RATTLE_MS) < 60, `500 ms of rattle (${round.clock - rattled})`);
  assert.equal(events(round, "gurneyRoll").length, 1);
  // Rolling it is no floor: you come down to the real one.
  round.you.safeMs = 1e9;
  run(round, 20);
  assert.equal(round.you.y, 6, "back on the floor");
  assert.equal(events(round, "lose").length, 0);
  // It rolls fast at you (the way you were when it started) to the wall.
  const x0 = g.x;
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const dir = g.dir;
  run(round, 500);
  assert.ok(Math.abs(g.x - x0) > 20, `fast (${(g.x - x0).toFixed(1)} in 0.5 s)`);
  assert.equal(Math.sign(g.x - x0), dir);
  until(round, () => g.act === "rest", 3000);
  assert.equal(g.act, "rest", "stopped at the wall");
  assert.equal(events(round, "gurneyRest").length, 1);
  assert.ok(g.x > 3 && g.x < 8, `against the room's end (${g.x.toFixed(1)})`);
  // After 1.5 s it rolls back at you, with you in range.
  const rested = round.clock;
  standAt(round, 20);
  round.you.safeMs = 1e9;
  round.events.length = 0;
  until(round, () => g.act === "roll", 2500);
  assert.ok(Math.abs(round.clock - rested - sn.GURNEY_REST_MS) < 80, `rests 1.5 s (${round.clock - rested})`);
  assert.equal(g.dir, 1, "back at you");
  assert.equal(events(round, "gurneyRoll").length, 1);
});

test("Ghoul Rush's gurney hurts only while rolling, parks again when you are far off, stops at an edge, and a rolling one is no floor", () => {
  const roll = sanRound("admissions");
  standAt(roll, 110);
  const g = put(roll, "gurney", 120, { act: "roll", dir: -1 });
  run(roll, 200);
  assert.equal(events(roll, "lose")[0]?.cause, "gurney");
  const rest = sanRound("admissions");
  standAt(rest, 120);
  put(rest, "gurney", 120, { act: "rest", wait: 1e9 });
  run(rest, 300);
  assert.equal(events(rest, "lose").length, 0, "resting is harmless");
  const rattle = sanRound("admissions");
  standAt(rattle, 120);
  put(rattle, "gurney", 120, { act: "rattle", wait: 1e9 });
  run(rattle, 300);
  assert.equal(events(rattle, "lose").length, 0, "rattling is harmless");
  // Far from you after its rest, it parks again.
  const park = sanRound("admissions");
  standAt(park, 20);
  const p = put(park, "gurney", 120, { act: "rest", wait: 4 });
  run(park, 40);
  assert.equal(p.act, "parked");
  // An edge stops it: the Baths' tubs.
  const edge = sanRound("baths");
  standAt(edge, 110);
  edge.you.safeMs = 1e9;
  const e = put(edge, "gurney", 60, { act: "roll", dir: 1 });
  until(edge, () => e.act === "rest", 3000);
  assert.equal(e.act, "rest");
  assert.ok(e.x + e.w / 2 <= 100.01 && e.x > 90, `at the tub's edge (${e.x.toFixed(1)})`);
  // A rolling gurney is no floor to land on.
  const air = sanRound("admissions");
  const r = put(air, "gurney", 120, { act: "roll", dir: 1 });
  standAt(air, 120, 1, 6 + r.h + 3);
  Object.assign(air.you, { state: "air", vy: -10, safeMs: 1e9 });
  until(air, () => air.you.state === "run", 800);
  assert.equal(air.you.y, 6);
});

test("Ghoul Rush's gurney takes 5 bolts, or one under the Bone Saw", () => {
  const round = sanRound("admissions");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const g = put(round, "gurney", 60);
  for (let k = 0; k < 4; k++) {
    bolt(round, g, 7.5);
    ghoul.advance(round, 4, steady);
  }
  assert.equal(g.hp, 1);
  bolt(round, g, 7.5);
  ghoul.advance(round, 4, steady);
  assert.equal(g.dead, true);
  const saw = sanRound("admissions");
  standAt(saw, 20);
  saw.you.safeMs = 1e9;
  ghoul.applyPower(saw, "saw");
  const h = put(saw, "gurney", 60);
  bolt(saw, h, 7.5);
  ghoul.advance(saw, 4, steady);
  ghoul.advance(saw, 4, steady);
  assert.equal(h.dead, true, "one hit");
  assert.equal(events(saw, "kill").length, 1);
  assert.equal(events(saw, "kill")[0].how, "saw");
  assert.equal(events(saw, "kill")[0].kind, "gurney");
});

/* ---------------------------------------------------------- the flicker */

test("Ghoul Rush's flicker is unseen with the lamps on: bolts go through it, stomps and touch do nothing, and it creeps slowly at you", () => {
  const round = sanRound("baths");
  standAt(round, 20);
  round.you.safeMs = 0;
  const f = put(round, "flicker", 60);
  run(round, 8);
  assert.equal(f.unseen, true);
  assert.equal(ghoul.solid(f), false);
  assert.equal(f.act, "creep");
  bolt(round, f, 8);
  run(round, 40);
  assert.equal(f.hp, f.max, "the bolt went through");
  const x0 = f.x;
  run(round, 1000);
  assert.ok(x0 - f.x > 4 && x0 - f.x < 12, `creeps slowly (${(x0 - f.x).toFixed(1)} in a second)`);
  // On top of you, it does nothing; landing on it is no stomp.
  Object.assign(f, { x: round.you.x });
  run(round, 300);
  assert.equal(events(round, "lose").length, 0);
  standAt(round, 20, 1, 20);
  Object.assign(round.you, { state: "air", vy: -20 });
  Object.assign(f, { x: 20, y: 6 });
  until(round, () => round.you.y <= 6.5, 800);
  assert.equal(events(round, "stomp").length, 0);
  assert.equal(f.dead, undefined);
});

test("Ghoul Rush's flicker shows in a blackout: it can be shot (2 bolts), stomped and hurts, lunging fast", () => {
  const round = sanRound("baths");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const f = put(round, "flicker", 80);
  round.blackout = true;
  run(round, 8);
  assert.equal(f.unseen, false);
  assert.equal(ghoul.solid(f), true);
  assert.equal(f.act, "lunge");
  assert.equal(events(round, "flickerShow").length, 1, "told once as it shows");
  const x0 = f.x;
  run(round, 400);
  // FLICKER_LUNGE (22 a second) is three times its unseen creep (7).
  assert.ok(x0 - f.x > 6, `lunges fast (${(x0 - f.x).toFixed(1)} in 0.4 s)`);
  assert.equal(events(round, "flickerShow").length, 1);
  Object.assign(f, { x: 60 });
  bolt(round, f, 8);
  run(round, 12);
  assert.equal(f.hp, 1);
  // It hurts you now.
  round.you.safeMs = 0;
  Object.assign(f, { x: round.you.x + 1, hp: 2 });
  run(round, 12);
  assert.equal(events(round, "lose")[0]?.cause, "flicker");
  // Stomped from above.
  const top = sanRound("baths");
  top.blackout = true;
  const s = put(top, "flicker", 60);
  standAt(top, 60, 1, 6 + s.h + 3);
  Object.assign(top.you, { state: "air", vy: -20, safeMs: 1e9 });
  until(top, () => events(top, "stomp").length > 0, 600);
  assert.equal(events(top, "stomp").length, 1);
  assert.equal(s.dead, true);
});

test("Ghoul Rush's flicker shows in the Lantern's light (34) and the Salts' glow (22), where a bolt does double", () => {
  const lit = (power, d) => {
    const round = sanRound("baths");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    if (power) ghoul.applyPower(round, power);
    const f = put(round, "flicker", 20 + d);
    run(round, 8);
    return { round, f };
  };
  assert.equal(lit("lantern", sn.LANTERN_LIGHT - 2).f.unseen, false, "in the Lantern's light");
  assert.equal(lit("lantern", sn.LANTERN_LIGHT + 4).f.unseen, true, "beyond it");
  assert.equal(lit("salts", sn.SALTS_GLOW - 2).f.unseen, false, "in the Salts' glow");
  assert.equal(lit("salts", sn.SALTS_GLOW + 4).f.unseen, true, "beyond it");
  assert.equal(lit(null, 5).f.unseen, true, "lit but unaided");
  const { round, f } = lit("salts", 15);
  bolt(round, f, 8);
  run(round, 12);
  assert.equal(f.dead, true, "double damage kills a 2 hp flicker with one bolt");
  const plain = lit("lantern", 15);
  bolt(plain.round, plain.f, 8);
  run(plain.round, 12);
  assert.equal(plain.f.hp, 1, "one without the Salts");
});

/* ------------------------------------------------------------- the lamps */

test("Ghoul Rush's lamps stutter for 700 ms, go out for 1.8 s and come on again: the first at 0.6 of a period, then every period; only the flicker rooms do", () => {
  for (const [id, period] of [["baths", 9000], ["theater", 6500]]) {
    const round = sanRound(id);
    round.twist = null;
    standAt(round, 20);
    round.you.safeMs = 1e9;
    const warns = [];
    const outs = [];
    const ons = [];
    for (let t = 0; t < period * 2.3; t += 4) {
      ghoul.advance(round, 4, steady);
      round.you.safeMs = 1e9;
      for (const e of round.events) {
        if (e.type === "flickerWarn") warns.push(round.clock);
        if (e.type === "lightsOut") outs.push(round.clock);
        if (e.type === "lightsOn") ons.push(round.clock);
      }
      round.events.length = 0;
      // The blackout flag is on exactly between lightsOut and lightsOn.
      assert.equal(round.blackout, outs.length > ons.length, `${id}: blackout between out and on`);
      round.monsters.length = 0;
    }
    assert.ok(Math.abs(warns[0] - period * sn.FLICKER_FIRST) < 60, `${id}: first stutter at ${warns[0]}`);
    assert.ok(Math.abs(warns[1] - warns[0] - period) < 60, `${id}: then every ${period} (${warns[1] - warns[0]})`);
    assert.ok(Math.abs(outs[0] - warns[0] - sn.STUTTER_MS) < 60, `${id}: out after the stutter`);
    assert.ok(Math.abs(ons[0] - outs[0] - sn.BLACKOUT_MS) < 60, `${id}: out for 1.8 s`);
    assert.equal(sn.STUTTER_MS, 700);
    assert.equal(sn.BLACKOUT_MS, 1800);
    assert.ok(round.twist && ["calm", "stutter", "out"].includes(round.twist.stage));
  }
  for (const id of ["admissions"]) {
    const round = sanRound(id);
    standAt(round, 20);
    round.you.safeMs = 1e9;
    run(round, 14000);
    assert.equal(round.blackout, false, `${id}: no lamps`);
    assert.equal(events(round, "lightsOut").length, 0);
    assert.equal(round.twist, null);
  }
  // The stutter alone leaves the lights on and flickers unseen; a new life starts the lamps over.
  const round = sanRound("baths");
  round.twist = null;
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const f = put(round, "flicker", 60);
  until(round, () => round.twist?.stage === "stutter", 7000);
  assert.equal(round.blackout, false);
  assert.equal(f.unseen, true);
  until(round, () => round.blackout, 1000);
  run(round, 8);
  assert.equal(f.unseen, false, "shown in the blackout");
  ghoul.lose(round, "zombie");
  run(round, ghoul.CRASH_MS + ghoul.READY_MS + 40);
  assert.equal(round.blackout, false);
  assert.ok(round.twist.stage === "calm" && round.twist.next > 9000 * sn.FLICKER_FIRST - 200, "the lamps start over with the room");
});

/* ---------------------------------------------------------- the specimen */

test("Ghoul Rush's specimen bloater swells, lobs a jar that breaks into a small puddle of formaldehyde (live 2.5 s, jumped it is harmless), and the puddle burns you", () => {
  const round = sanRound("baths");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const s = put(round, "specimen", 60, { throwIn: 0 });
  run(round, 8);
  assert.equal(events(round, "jarWind").length, 1);
  assert.equal(round.bones.length, 0, "it swells first");
  run(round, sn.JAR_WIND_MS + 8);
  const jar = round.bones.find((b) => b.kind === "jar");
  assert.ok(jar, "a jar in the air");
  assert.equal(jar.cause, "formaldehyde");
  assert.ok(s.x <= 60);
  until(round, () => events(round, "jarBreak").length > 0, 3000);
  assert.equal(events(round, "jarBreak").length, 1);
  const puddle = round.hazards.find((h) => h.kind === "formaldehyde");
  assert.ok(puddle, "a puddle");
  assert.equal(puddle.w, sn.FORMALDEHYDE_W);
  assert.ok(puddle.live > sn.FORMALDEHYDE_MS - 200 && puddle.live <= sn.FORMALDEHYDE_MS);
  assert.equal(round.bones.length, 0);
  // It burns you where you stand; jumped, it does not; and it is gone after 2.5 s.
  const jumped = sanRound("baths");
  jumped.hazards.push({ ...puddle });
  standAt(jumped, puddle.x, 1, puddle.y + 2);
  Object.assign(jumped.you, { state: "air", vy: 0 });
  jumped.you.safeMs = 0;
  run(jumped, 12);
  assert.equal(events(jumped, "lose").length, 0, "over it, you are safe");
  const burned = sanRound("baths");
  burned.hazards.push({ ...puddle });
  standAt(burned, puddle.x);
  run(burned, 12);
  assert.equal(events(burned, "lose")[0]?.cause, "formaldehyde");
  const gone = sanRound("baths");
  gone.hazards.push({ ...puddle });
  run(gone, sn.FORMALDEHYDE_MS - 100);
  assert.equal(gone.hazards.length, 1);
  run(gone, 140);
  assert.equal(gone.hazards.length, 0);
  // A jar that lands on you in the air is a hit too, and one shot down breaks nothing.
  const hit = sanRound("baths");
  standAt(hit, 40);
  const b = hit.bones;
  b.push({ id: 9e9, kind: "jar", cause: "formaldehyde", x: 40, y: 8, vx: 0, vy: 0, spin: 0, life: 4000 });
  run(hit, 12);
  assert.equal(events(hit, "lose")[0]?.cause, "formaldehyde");
  const shot = sanRound("baths");
  standAt(shot, 20);
  shot.bones.push({ id: 9e9 + 1, kind: "jar", cause: "formaldehyde", x: 40, y: 8.4, vx: 0, vy: 20, spin: 0, life: 4000 });
  shot.shots.push({ x: 36, y: 8.4, vx: 80, vy: 0, gone: 0 });
  run(shot, 40);
  assert.equal(shot.bones.length, 0);
  assert.equal(events(shot, "bone")[0]?.kind, "jar");
  assert.equal(events(shot, "jarBreak").length, 0);
  // Never more than FORMALDEHYDE_CAP about; shot to nothing it breaks its own jar.
  const many = sanRound("baths");
  for (let k = 0; k < 8; k++) many.bones.push({ id: 9e9 + 10 + k, kind: "jar", x: 50 + k * 6, y: 6, vx: 0, vy: -5, spin: 0, life: 4000 });
  run(many, 40);
  assert.ok(many.hazards.filter((h) => h.kind === "formaldehyde").length <= sn.FORMALDEHYDE_CAP);
  const die = sanRound("baths");
  standAt(die, 20);
  die.you.safeMs = 1e9;
  const sp = put(die, "specimen", 60, { throwIn: 1e9 });
  sp.hp = 1;
  bolt(die, sp, 8);
  run(die, 12);
  assert.equal(sp.dead, true);
  assert.equal(events(die, "jarBreak")[0]?.how, "death");
  assert.equal(die.hazards.filter((h) => h.kind === "formaldehyde").length, 1);
});

/* ------------------------------------------------------------- power-ups */

test("Smelling Salts and the Bone Saw are found only in the Sanatorium: no drop elsewhere ever picks them, a placed one elsewhere is swapped, and each lasts 10 s", () => {
  for (const kind of ["salts", "saw"]) {
    assert.equal(ghoul.POWERS[kind].stage, "sanatorium");
    assert.equal(ghoul.POWERS[kind].ms, 10000);
    assert.ok(ghoul.TIMED.includes(kind), "a timed power-up, shown in the pill");
    const home = sanRound("admissions");
    assert.equal(ghoul.powerHere(home, kind), true);
    assert.ok(home.loot.includes(kind), "placed ones stay");
    const hall = ghoul.newRound(3);
    hall.dice = 0;
    assert.equal(ghoul.powerHere(hall, kind), false);
    const away = sanRound("admissions");
    away.stage = "chapel";
    assert.equal(ghoul.powerHere(away, kind), false);
    const random = ghoul.seeded(9);
    const picked = new Set();
    for (let k = 0; k < 400; k++) {
      picked.add(pickPower(random, home));
      assert.notEqual(pickPower(random, away), kind);
      assert.notEqual(pickPower(random, hall), kind);
      assert.notEqual(pickPower(random, hall, "", true), kind);
    }
    assert.ok(picked.has(kind), "drops here can be it");
    for (const base of ghoul.ROOMS) if (!ROOM_IDS.includes(base.id)) assert.ok(!base.items.some((i) => i[0] === kind), `${base.id} places none`);
    const timed = sanRound("admissions");
    ghoul.applyPower(timed, kind);
    assert.equal(timed.effects[kind], 10000);
    ghoul.advance(timed, ghoul.POWERS[kind].ms + 8, steady);
    assert.equal(timed.effects[kind], 0);
  }
  assert.equal(PILL_WORDS.salts, "SALTS");
  assert.equal(PILL_WORDS.saw, "SAW");
  // A placed one in a room elsewhere would be swapped out for another power-up.
  const elsewhere = ghoul.newRound(3);
  elsewhere.dice = 0;
  assert.ok(!elsewhere.loot.includes("salts") && !elsewhere.loot.includes("saw"));
});

test("The Bone Saw's bolts pierce every monster in a line", () => {
  const line = (saw) => {
    const round = sanRound("admissions");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    if (saw) ghoul.applyPower(round, "saw");
    const zs = [50, 56, 62].map((x) => put(round, "zombie", x));
    bolt(round, zs[0], 8.4);
    run(round, 300);
    return zs.map((z) => z.max - z.hp);
  };
  assert.deepEqual(line(false), [1, 0, 0], "one bolt, one zombie");
  assert.deepEqual(line(true), [1, 1, 1], "one bolt, all three");
});

/* ------------------------------------------------------------ the Matron */

// The ward, you in the arena, the Matron awake and at her place: her attacks
// held off, her beam still.
function wardFight() {
  const round = sanRound("ward");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  ghoul.advance(round, 8, steady);
  round.you.safeMs = 1e9;
  round.events.length = 0;
  const home = round.spec.length - sn.HOME_FROM_END;
  until(round, () => round.boss.x === home, 4000);
  hold(round);
  return round;
}

function hold(round) {
  const b = round.boss;
  b.act = "idle";
  b.wait = 1e9;
}

// Points the beam's axis at the depression `dep` below level (sweeping stops being the question).
const aim = (round, dep) => {
  const b = round.boss;
  dep = Math.min(sn.DEP_MAX, Math.max(sn.DEP_MIN, dep));
  b.phase = Math.asin((dep - (sn.DEP_MIN + sn.DEP_MAX) / 2) / ((sn.DEP_MAX - sn.DEP_MIN) / 2));
};
// The depression of the line from the lantern to Planny's middle at x.
const depTo = (round, x) => {
  const b = round.boss;
  const beam = b.beam;
  return Math.atan2(beam.y - (round.you.y + ghoul.HIT_H / 2), beam.x - x);
};
// Runs `ms` with the beam held on the depression for Planny at x.
function hotRun(round, ms, dep) {
  const got = [];
  for (let t = 0; t < ms && round.phase === "play"; t += 4) {
    aim(round, dep);
    ghoul.advance(round, 4, steady);
    for (const e of round.events) got.push(e);
    round.events.length = 0;
    hold(round);
  }
  return got;
}

test("The Night Matron walks to her place and holds her lantern: a cone sweeping down across the ward and back, 0.17 either side of its axis, 76 long", () => {
  const round = sanRound("ward");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  const b = round.boss;
  assert.equal(b.kind, "matron");
  assert.equal(b.state, "intro");
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(b.state, "fight");
  round.you.safeMs = 1e9;
  ghoul.advance(round, 8, steady);
  const home = round.spec.length - sn.HOME_FROM_END;
  assert.notEqual(b.x, home, "she is not there yet");
  until(round, () => b.x === home, 4000);
  assert.equal(b.x, home);
  assert.equal(b.dir, -1, "facing you");
  assert.equal(sn.BOSSES.matron.hp, 100);
  assert.equal(sn.BOSSES.matron.points, 3500);
  hold(round);
  ghoul.advance(round, 4, steady);
  // The beam: where it starts and how it points.
  const beam = b.beam;
  assert.ok(Math.abs(beam.x - (b.x - sn.BEAM_ORIGIN_X)) < 1e-9 && Math.abs(beam.y - (b.y + sn.BEAM_ORIGIN_Y)) < 1e-9, "from her lantern");
  assert.equal(beam.half, sn.BEAM_HALF);
  assert.equal(beam.range, sn.BEAM_RANGE);
  // Over a sweep it goes from nearly level to steep and back, down and ahead (left) always.
  let lo = 9;
  let hi = 0;
  const sweeps = [];
  for (let t = 0; t < sn.BEAM_SWEEP_MS * 1.1; t += 4) {
    ghoul.advance(round, 4, steady);
    hold(round);
    round.you.safeMs = 1e9;
    lo = Math.min(lo, beam.dep);
    hi = Math.max(hi, beam.dep);
    assert.ok(Math.cos(beam.angle) < 0 && Math.sin(beam.angle) < 0, "down and to the left");
    assert.ok(Math.abs(beam.angle - (Math.PI + beam.dep)) < 1e-9);
    if (t % 500 === 0) sweeps.push(beam.dep);
  }
  assert.ok(lo < sn.DEP_MIN + 0.02 && hi > sn.DEP_MAX - 0.02, `a full sweep (${lo.toFixed(2)} to ${hi.toFixed(2)})`);
  assert.ok(sweeps.some((d) => d > 0.7) && sweeps.some((d) => d < 0.3));
  // It points at the floor around her feet when steep and far down the ward when shallow.
  assert.equal(sn.inBeam({ x: 0, y: 10, angle: Math.PI + 0.5, half: 0.17, range: 76 }, -8, 6), true);
  assert.equal(sn.inBeam({ x: 0, y: 10, angle: Math.PI + 0.5, half: 0.17, range: 76 }, -8, 8), false);
  assert.equal(sn.inBeam({ x: 0, y: 10, angle: Math.PI + 0.5, half: 0.17, range: 76 }, 8, 6), false, "behind her");
  assert.equal(sn.inBeam({ x: 0, y: 10, angle: Math.PI + 0.5, half: 0.17, range: 5 }, -8, 6), false, "out of range");
});

test("The Matron's lantern heats you in its light: 600 ms of it costs a life (cause lantern), Planny's heat shows on the boss and cools out of it", () => {
  const round = wardFight();
  const b = round.boss;
  const x = 176;
  standAt(round, x);
  round.you.safeMs = 0;
  const dep = depTo(round, x);
  aim(round, dep);
  const got = hotRun(round, 300, dep);
  assert.equal(b.beam.on, true, "in the cone");
  assert.ok(b.heat > 0.4 && b.heat < 0.6, `half hot after half the time (${b.heat.toFixed(2)})`);
  assert.equal(got.filter((e) => e.type === "lose").length, 0);
  // Out of the light it cools, in a second.
  aim(round, sn.DEP_MAX);
  const cool = b.heat;
  hotRun(round, 400, sn.DEP_MAX + 0.0);
  assert.equal(b.beam.on, false);
  assert.ok(b.heat < cool - 0.3, `cooling (${b.heat.toFixed(2)})`);
  hotRun(round, 700, sn.DEP_MAX);
  assert.equal(b.heat, 0);
  // In it for 600 ms: a life.
  const t0 = round.clock;
  const lost = hotRun(round, 1000, dep).filter((e) => e.type === "lose");
  assert.equal(lost.length, 1);
  assert.equal(lost[0].cause, "lantern");
  assert.ok(round.clock - t0 >= sn.HEAT_MS - 12 && round.clock - t0 <= sn.HEAT_MS + 100, `${round.clock - t0} ms`);
  assert.equal(sn.HEAT_MS, 600);
});

test("A medicine cabinet between her lantern and you is cover: no heat, and a safe jump over it is not", () => {
  const round = wardFight();
  const b = round.boss;
  const cabinets = round.spec.ground.filter((g) => g[2] > 6);
  assert.deepEqual(b.cabinets, cabinets.map((c) => [c[0], c[1], c[2]]), "the boss shows them to the art");
  // Right behind the near cabinet (to its left), the cone cannot reach you however it points.
  const near = cabinets[1];
  const hide = near[0] - 5;
  standAt(round, hide);
  round.you.safeMs = 0;
  const dep = depTo(round, hide);
  const got = hotRun(round, 1500, dep);
  assert.equal(b.beam.blocked, true, "in the cone's direction, but blocked");
  assert.equal(b.beam.on, false);
  assert.equal(b.heat, 0);
  assert.equal(got.filter((e) => e.type === "lose").length, 0);
  // Step out from behind it, where the cabinet is no longer between you, and it costs a life.
  const open = near[1] + 6;
  standAt(round, open);
  const out = hotRun(round, 1000, depTo(round, open)).filter((e) => e.type === "lose");
  assert.equal(out[0]?.cause, "lantern");
  // Each cabinet has a pocket behind it that no point of the sweep lights.
  for (const cab of cabinets) {
    const x = cab[0] - 3;
    const r = wardFight();
    standAt(r, x);
    r.you.safeMs = 0;
    let heat = 0;
    for (let t = 0; t < sn.BEAM_SWEEP_MS * 1.2; t += 4) {
      ghoul.advance(r, 4, steady);
      hold(r);
      r.you.safeMs = 0;
      heat = Math.max(heat, r.boss.heat);
    }
    assert.equal(heat, 0, `behind the cabinet at ${cab[0]}: cool all sweep`);
  }
  // And in the open the same sweep does light you.
  const r = wardFight();
  standAt(r, r.spec.length - 14);
  let lit = 0;
  for (let t = 0; t < sn.BEAM_SWEEP_MS * 1.2 && r.phase === "play"; t += 4) {
    ghoul.advance(r, 4, steady);
    hold(r);
    lit = Math.max(lit, r.boss.heat);
  }
  assert.ok(lit > 0 || events(r, "lose").length > 0, "the open floor is lit by a sweep");
});

test("The boards above the beam's reach are never lit, and the lower ones can be", () => {
  const round = wardFight();
  const b = round.boss;
  const high = round.spec.shelves.filter((s) => s[2] >= 17);
  const low = round.spec.shelves.filter((s) => s[2] < 17);
  assert.ok(high.length >= 2 && low.length >= 1);
  for (const shelf of high) {
    const [x0, x1, y] = shelf;
    const i = round.spec.shelves.indexOf(shelf);
    for (const x of [x0 + 1, (x0 + x1) / 2, x1 - 1]) {
      standAt(round, x, 1, y, i);
      round.you.safeMs = 0;
      let heat = 0;
      for (let t = 0; t < sn.BEAM_SWEEP_MS; t += 20) {
        for (let k = 0; k < 5; k++) {
          ghoul.advance(round, 4, steady);
          hold(round);
          round.you.safeMs = 0;
        }
        heat = Math.max(heat, b.heat);
        standAt(round, x, 1, y, i);
      }
      assert.equal(heat, 0, `on the board at ${y}, x ${x}: never lit`);
    }
  }
  // A low board is in the beam's reach for some of the sweep.
  const [x0, x1, y] = low[0];
  standAt(round, (x0 + x1) / 2, 1, y, round.spec.shelves.indexOf(low[0]));
  round.you.safeMs = 0;
  const dep = depTo(round, (x0 + x1) / 2);
  assert.ok(dep < sn.DEP_MAX + sn.BEAM_HALF && dep > -0.2);
  const lost = hotRun(round, 1000, dep).filter((e) => e.type === "lose");
  assert.equal(lost[0]?.cause, "lantern", "lit on a low board");
});

test("The Matron winds up 500 ms, then throws a fan of three syringes that land 9 apart around you; stand still and one hits (cause syringe)", () => {
  const round = wardFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 0;
  Object.assign(b, { act: "idle", wait: 0, turn: 0 });
  aim(round, sn.DEP_MAX);
  const wind = log(round, 12, "syringeWind");
  assert.equal(wind.length, 1);
  assert.equal(round.bones.length, 0);
  const t0 = round.clock;
  until(round, () => events(round, "syringes").length > 0 || round.bones.length > 0, 700);
  assert.ok(Math.abs(round.clock - t0 - sn.SYRINGE_WIND_MS) < 60, `${round.clock - t0}`);
  const fan = round.bones.filter((s) => s.kind === "syringe");
  assert.equal(fan.length, 3);
  assert.ok(fan.every((s) => s.cause === "syringe"));
  // Each comes down through chest height at one of three places 9 apart.
  const lands = fan.map((s) => {
    const chest = round.you.y + ghoul.SHOT_Y;
    const disc = s.vy * s.vy + 2 * ghoul.BONE_G * (s.y - chest);
    const t = (s.vy + Math.sqrt(disc)) / ghoul.BONE_G;
    return s.x + s.vx * t;
  }).sort((p, q) => p - q);
  assert.ok(Math.abs(lands[0] - (150 - sn.SYRINGE_SPREAD)) < 1 && Math.abs(lands[1] - 150) < 1 && Math.abs(lands[2] - (150 + sn.SYRINGE_SPREAD)) < 1, `${lands.map((v) => v.toFixed(1))}`);
  // Standing still costs a life; they can be shot down (25 points).
  hold(round);
  b.beam.on = false;
  const lost = [];
  for (let t = 0; t < 2000 && !lost.length; t += 4) {
    ghoul.advance(round, 4, steady);
    hold(round);
    aim(round, sn.DEP_MAX);
    for (const e of round.events) if (e.type === "lose") lost.push(e);
    round.events.length = 0;
  }
  assert.equal(lost[0]?.cause, "syringe");
  // Out of the way of all three: nothing.
  const clear = wardFight();
  standAt(clear, 150);
  clear.you.safeMs = 0;
  Object.assign(clear.boss, { act: "idle", wait: 0, turn: 0 });
  let hit = false;
  for (let t = 0; t < 2200; t += 4) {
    ghoul.advance(clear, 4, steady);
    hold(clear);
    aim(clear, sn.DEP_MAX);
    clear.boss.heat = 0;
    if (clear.bones.length && clear.you.x === 150) standAt(clear, 150 - 4.5);
    for (const e of clear.events) if (e.type === "lose") hit = true;
    clear.events.length = 0;
  }
  assert.equal(hit, false, "between the second and third syringe, nothing lands");
});

test("The Matron's arm: a crack of light at your height for 700 ms, then an arm shoots across the ward from the far wall (cause arm); jumping out of it or dropping works", () => {
  const round = wardFight();
  const b = round.boss;
  const spec = round.spec;
  standAt(round, 120);
  round.you.safeMs = 0;
  Object.assign(b, { act: "idle", wait: 0, turn: 1 });
  aim(round, sn.DEP_MAX);
  const warn = log(round, 12, "armWarn");
  assert.equal(warn.length, 1);
  assert.equal(warn[0][1].x, spec.length, "from the far wall (you are in the left half)");
  assert.ok(Math.abs(warn[0][1].y - (6 + 1.5)) < 1.5, "at your height");
  const arm = round.hazards.find((h) => h.kind === "arm");
  assert.ok(arm && arm.live === 0, "a crack, nothing yet");
  assert.equal(arm.y, 5.8);
  assert.equal(arm.h, sn.ARM_H);
  const t0 = round.clock;
  const reach = [];
  while (round.clock - t0 < 900 && !reach.length) {
    ghoul.advance(round, 4, steady);
    hold(round);
    aim(round, sn.DEP_MAX);
    for (const e of round.events) if (e.type === "armReach") reach.push([round.clock, e]);
    round.events.length = 0;
  }
  assert.ok(Math.abs(reach[0][0] - t0 - sn.ARM_WARN_MS) < 60, `700 ms of warning (${reach[0][0] - t0})`);
  // The arm grows from the wall at ARM_V.
  const len0 = arm.len;
  run(round, 100);
  assert.ok(Math.abs(arm.len - len0 - sn.ARM_V * 0.1) < 8, "shooting across");
  assert.ok(arm.x < spec.length && Math.abs(arm.x + arm.w / 2 - spec.length) < 1e-6, "its root at the wall");
  // Standing in its band costs a life.
  const stand = [];
  for (let t = 0; t < 1500 && !stand.length; t += 4) {
    ghoul.advance(round, 4, steady);
    hold(round);
    aim(round, sn.DEP_MAX);
    round.boss.heat = 0;
    for (const e of round.events) if (e.type === "lose") stand.push(e);
    round.events.length = 0;
  }
  assert.equal(stand[0]?.cause, "arm");
  // A jump as it reaches takes you over it.
  const jumper = wardFight();
  standAt(jumper, 120);
  jumper.you.safeMs = 0;
  Object.assign(jumper.boss, { act: "idle", wait: 0, turn: 1 });
  let jumped = false;
  let lostJump = 0;
  for (let t = 0; t < 2600; t += 4) {
    ghoul.advance(jumper, 4, steady);
    hold(jumper);
    aim(jumper, sn.DEP_MAX);
    jumper.boss.heat = 0;
    const live = jumper.hazards.find((h) => h.kind === "arm");
    if (live && live.live > 0 && !jumped) {
      jumped = true;
      jumper.input.up = true;
      jumper.input.jump = ghoul.JUMP_BUFFER_MS;
    }
    for (const e of jumper.events) if (e.type === "lose") lostJump++;
    jumper.events.length = 0;
  }
  assert.ok(jumped, "the arm came");
  assert.equal(lostJump, 0, "a jump timed to its reach clears it");
  // Dropping to the floor from a board works too: the arm is at the board's height.
  const dropper = wardFight();
  const board = dropper.spec.shelves.findIndex((s) => s[2] === 17);
  const [bx0, bx1, by] = dropper.spec.shelves[board];
  standAt(dropper, (bx0 + bx1) / 2, 1, by, board);
  dropper.you.safeMs = 0;
  Object.assign(dropper.boss, { act: "idle", wait: 0, turn: 1 });
  let down = false;
  let lostDrop = 0;
  for (let t = 0; t < 2600; t += 4) {
    ghoul.advance(dropper, 4, steady);
    hold(dropper);
    aim(dropper, sn.DEP_MAX);
    dropper.boss.heat = 0;
    if (!down && dropper.hazards.some((h) => h.kind === "arm" && h.warn === 0)) {
      down = true;
      dropper.input.down = true;
    }
    if (dropper.you.state === "air" || dropper.you.shelf < 0) dropper.input.down = false;
    for (const e of dropper.events) if (e.type === "lose") lostDrop++;
    dropper.events.length = 0;
  }
  assert.ok(down);
  assert.equal(lostDrop, 0, "dropping out of its band works");
});

test("The Matron alternates syringes and arms, each rest in turn, with no draws from the random source", () => {
  const round = wardFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  Object.assign(b, { act: "idle", wait: 0, turn: 0 });
  let draws = 0;
  const counting = () => {
    draws++;
    return 0.5;
  };
  const seq = [];
  for (let t = 0; t < 14000; t += 4) {
    ghoul.advance(round, 4, counting);
    round.you.safeMs = 1e9;
    for (const e of round.events) if (["syringes", "armWarn"].includes(e.type)) seq.push(e.type);
    round.events.length = 0;
    round.monsters.length = 0;
    round.bones.length = 0;
    round.hazards.length = 0;
  }
  assert.deepEqual(seq.slice(0, 4), ["syringes", "armWarn", "syringes", "armWarn"]);
  assert.equal(draws, 0);
});

test("The Matron's rage at half her hp: it is told, blackouts start so her cone is the only light, arms come from both walls, the fan is five, her waits shorter and the beam quicker", () => {
  const round = wardFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  // Before the rage the lamps stay on all through the fight.
  run(round, 12000);
  assert.equal(events(round, "lightsOut").length, 0);
  assert.equal(round.blackout, false);
  hold(round);
  b.hp = b.max * 0.5 + 1;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  run(round, 20);
  assert.equal(b.hp, b.max * 0.5);
  assert.equal(events(round, "matronRage").length, 1);
  assert.equal(b.raged, true);
  const outs = [];
  const ons = [];
  for (let t = 0; t < 12000; t += 4) {
    ghoul.advance(round, 4, steady);
    round.you.safeMs = 1e9;
    for (const e of round.events) {
      if (e.type === "lightsOut") outs.push(round.clock);
      if (e.type === "lightsOn") ons.push(round.clock);
    }
    round.events.length = 0;
    hold(round);
  }
  assert.ok(outs.length >= 1, "blackouts in the ward");
  assert.ok(Math.abs(ons[0] - outs[0] - sn.BLACKOUT_MS) < 60);
  // Her sweep is quicker.
  const w0 = b.phase;
  run(round, 100);
  assert.ok(Math.abs(b.phase - w0 - (Math.PI * 2 * 100) / sn.BEAM_SWEEP_RAGE_MS) < 0.01);
  // Arms from both walls.
  standAt(round, 120);
  Object.assign(b, { act: "idle", wait: 0, turn: 1 });
  const warns = log(round, 12, "armWarn");
  assert.equal(warns.length, 2);
  assert.deepEqual(warns.map((w) => w[1].x).sort((p, q) => p - q), [round.spec.arena, round.spec.length]);
  assert.equal(round.hazards.filter((h) => h.kind === "arm").length, 2);
  // A fan of five.
  const fan = wardFight();
  fan.boss.hp = fan.boss.max * 0.4;
  fan.boss.raged = true;
  standAt(fan, 150);
  fan.you.safeMs = 1e9;
  Object.assign(fan.boss, { act: "idle", wait: 0, turn: 0 });
  until(fan, () => fan.bones.length > 0, 1000);
  assert.equal(fan.bones.filter((s) => s.kind === "syringe").length, 5);
  assert.equal(events(fan, "syringes")[0]?.n, 5);
  // Her waits are 3/4.
  assert.ok(Math.abs(fan.boss.wait - sn.SYRINGE_REST_MS * sn.RAGE_QUICK) < 20);
});

test("The Matron's touch is her own, a hit on her carries her kind, a stomp does 3, and her fall puts every arm and blackout away", () => {
  const round = wardFight();
  const b = round.boss;
  standAt(round, b.x - 3);
  round.you.safeMs = 0;
  aim(round, sn.DEP_MAX);
  run(round, 20);
  assert.equal(events(round, "lose")[0]?.cause, "matron");
  const fight = wardFight();
  const m = fight.boss;
  const hp = m.hp;
  fight.shots.push({ x: m.x - m.w / 2 - 0.2, y: m.y + 5, vx: 80, vy: 0, gone: 0 });
  run(fight, 20);
  assert.equal(m.hp, hp - 1);
  assert.equal(events(fight, "bossHit")[0]?.kind, "matron");
  standAt(fight, m.x, 1, m.y + m.h + 0.5);
  Object.assign(fight.you, { state: "air", vy: -10, safeMs: 1e9, shelf: -1 });
  until(fight, () => events(fight, "stomp").length > 0, 400);
  assert.equal(m.hp, hp - 1 - ghoul.STOMP_DAMAGE);
  fight.blackout = true;
  fight.hazards.push({ kind: "arm", x: 150, y: 6, w: 4, h: 3, side: 1, wall: 200, dirx: -1, span: 96, len: 4, warn: 0, hold: 100, live: 1, cause: "arm" });
  m.hp = 1;
  fight.shots.push({ x: m.x - m.w / 2 - 0.2, y: m.y + 5, vx: 80, vy: 0, gone: 0 });
  run(fight, 20);
  assert.equal(m.state, "down");
  assert.equal(fight.hazards.length, 0);
  run(fight, 8);
  assert.equal(fight.blackout, false, "the lights come back");
  assert.equal(fight.hasKey, true);
  // Tougher deeper into a run, and the cabinets are ground.
  assert.ok(ghoul.roomFor("ward", 3).bossHp > sn.BOSSES.matron.hp);
  assert.equal([sn.BOSSES.matron.w, sn.BOSSES.matron.h].join("x"), "8x16");
});

/* ---------------------------------------------------- endless lives, etc. */

test("The endless-lives code spares a life from every new way to die, however it is reached", () => {
  const causes = ["orderly", "gurney", "flicker", "specimen", "formaldehyde", "matron", "lantern", "arm", "syringe"];
  for (const cause of causes) {
    const round = wardFight();
    round.infinite = true;
    const lives = round.lives;
    ghoul.lose(round, cause);
    assert.equal(round.lives, lives, `${cause} costs none`);
  }
  // Through the real thing.
  const real = (setup, cause) => {
    const round = sanRound("baths");
    round.infinite = true;
    const lives = round.lives;
    standAt(round, 60);
    round.you.safeMs = 0;
    setup(round);
    run(round, 700);
    assert.equal(events(round, "lose")[0]?.cause, cause, cause);
    assert.equal(round.lives, lives, `${cause}: endless lives`);
  };
  real((r) => put(r, "gurney", 62, { act: "roll", dir: 1 }), "gurney");
  real((r) => {
    r.blackout = true;
    put(r, "flicker", 61);
  }, "flicker");
  real((r) => r.hazards.push({ kind: "formaldehyde", x: 60, y: 6, w: 3.2, h: 0.9, live: 2500, max: 2500, cause: "formaldehyde" }), "formaldehyde");
  real((r) => r.bones.push({ id: 9e9, kind: "syringe", cause: "syringe", x: 60, y: 8, vx: 0, vy: 0, spin: 0, life: 4000 }), "syringe");
  real((r) => r.bones.push({ id: 9e9 + 2, kind: "jar", cause: "formaldehyde", x: 60, y: 8, vx: 0, vy: 0, spin: 0, life: 4000 }), "formaldehyde");
  // The arm and the lantern in the ward.
  const arm = wardFight();
  arm.infinite = true;
  standAt(arm, 150);
  arm.you.safeMs = 0;
  arm.hazards.push({ kind: "arm", x: 150, y: 5.8, w: 8, h: 3.4, side: 1, wall: 200, dirx: -1, span: 96, len: 50, warn: 0, hold: 500, live: 1, cause: "arm" });
  const lives = arm.lives;
  run(arm, 20);
  assert.equal(events(arm, "lose")[0]?.cause, "arm");
  assert.equal(arm.lives, lives);
  const lamp = wardFight();
  lamp.infinite = true;
  standAt(lamp, 176);
  lamp.you.safeMs = 0;
  const dep = depTo(lamp, 176);
  const lostLamp = hotRun(lamp, 1000, dep).filter((e) => e.type === "lose");
  assert.equal(lostLamp[0]?.cause, "lantern");
  assert.equal(lamp.lives, lives);
});

/* ---------------------------------------------------- voices and drawing */

test("Ghoul Rush's Sanatorium: every new kind has a voice for every act and every new event plays exactly one picked sound", () => {
  const own = {
    orderly: ["appear", "reach", "grab", "throw", "hurt", "die"],
    gurney: ["appear", "rattle", "roll", "hurt", "die"],
    flicker: ["appear", "lunge", "show", "hurt", "die"],
    specimen: ["appear", "wind", "jar", "hurt", "die"],
    lights: ["warn", "out", "on"],
    salts: ["break", "active"],
    saw: ["cut", "active"],
    matron: ["wake", "beam", "heat", "syringeWind", "syringes", "armWarn", "armReach", "rage", "hurt", "die"],
  };
  for (const [kind, acts] of Object.entries(own)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(own)) for (const act of acts) assert.ok(merged[VOICES[kind][act]]?.layers?.length, `${kind}.${act}: ${VOICES[kind][act]} is a tone`);
  const names = Object.values(VOICES).flatMap((v) => Object.values(v));
  const cases = [
    [{ type: "orderlyReach", kind: "orderly" }, "orderly", "reach"],
    [{ type: "orderlyGrab", kind: "orderly" }, "orderly", "grab"],
    [{ type: "orderlyThrow", kind: "orderly" }, "orderly", "throw"],
    [{ type: "saltsBreak", kind: "orderly" }, "salts", "break"],
    [{ type: "gurneyRattle", kind: "gurney" }, "gurney", "rattle"],
    [{ type: "gurneyRoll", kind: "gurney" }, "gurney", "roll"],
    [{ type: "flickerShow", kind: "flicker" }, "flicker", "show"],
    [{ type: "jarWind", kind: "specimen" }, "specimen", "wind"],
    [{ type: "jarBreak", kind: "specimen" }, "specimen", "jar"],
    [{ type: "flickerWarn", ms: 700 }, "lights", "warn"],
    [{ type: "lightsOut", ms: 1800 }, "lights", "out"],
    [{ type: "lightsOn" }, "lights", "on"],
    [{ type: "syringeWind", kind: "matron" }, "matron", "syringeWind"],
    [{ type: "syringes", kind: "matron", n: 3 }, "matron", "syringes"],
    [{ type: "armWarn", kind: "matron" }, "matron", "armWarn"],
    [{ type: "armReach", kind: "matron" }, "matron", "armReach"],
    [{ type: "matronRage", kind: "matron" }, "matron", "rage"],
    [{ type: "flickerLunge", kind: "flicker" }, "flicker", "lunge"],
    [{ type: "matronBeam", kind: "matron" }, "matron", "beam"],
    [{ type: "matronHeat", kind: "matron" }, "matron", "heat"],
    [{ type: "sawCut", kind: "orderly" }, "saw", "cut"],
    [{ type: "power", kind: "salts" }, "salts", "active"],
    [{ type: "power", kind: "saw" }, "saw", "active"],
    [{ type: "spawn", kind: "gurney" }, "gurney", "appear"],
    [{ type: "bossWake", kind: "matron" }, "matron", "wake"],
    [{ type: "bossHit", kind: "matron", how: "shot" }, "matron", "hurt"],
    [{ type: "bossDown", kind: "matron", points: 1 }, "matron", "die"],
    [{ type: "hit", kind: "orderly" }, "orderly", "hurt"],
    [{ type: "kill", kind: "gurney", mult: 1, how: "saw", points: 1 }, "gurney", "die"],
    [{ type: "kill", kind: "flicker", mult: 1, how: "shot", points: 1 }, "flicker", "die"],
    [{ type: "spawn", kind: "specimen" }, "specimen", "appear"],
    [{ type: "spawn", kind: "orderly" }, "orderly", "appear"],
  ];
  for (const [e, kind, act] of cases) {
    const played = heard(e).played;
    assert.ok(played.includes(VOICES[kind][act]), `${e.type}: ${kind} ${act}`);
    assert.equal(played.filter((n) => names.includes(n)).length, 1, `${e.type} plays exactly one picked sound`);
  }
  // The quiet ones: a gurney coming to rest is not told.
  assert.equal(heard({ type: "gurneyRest", kind: "gurney" }).played.filter((n) => names.includes(n)).length, 0);
  // Every kind in the game has a voice with a death, new ones included.
  for (const kind of Object.keys(sn.MONSTERS)) assert.ok(VOICES[kind].die);
  assert.ok(VOICES.matron.die);
});

test("Ghoul Rush's Sanatorium: every new way to die has its words and its own sound", () => {
  for (const cause of ["orderly", "gurney", "flicker", "specimen", "formaldehyde", "matron", "lantern", "arm", "syringe"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).played.includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Sanatorium draws: every room, every monster in every act, a blackout, the Matron in each move with her cone and cabinets, the jar, the syringes, the puddle and the arm, and the stage's card, in a lit room and a dark one", () => {
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
  const acts = { orderly: ["walk", "reach", "hold", "rest"], gurney: ["parked", "rattle", "roll", "rest"], flicker: ["creep", "lunge"], specimen: [""] };
  for (const id of ROOM_IDS) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      for (const blackout of [false, true]) {
        r.dark = dark;
        r.phase = "play";
        r.lives = 99;
        for (const st of r.spawns) st.over = true;
        r.hordeMs = Infinity;
        r.monsters.length = 0;
        standAt(r, id === "ward" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
        r.you.safeMs = 1e9;
        r.blackout = blackout;
        for (const [kind, list] of Object.entries(acts)) list.forEach((act, i) => put(r, kind, r.you.x + 6 + i * 5, { act: act || undefined, windup: kind === "specimen" ? 200 : 0, wait: 1e9, unseen: kind === "flicker" && !blackout }));
        r.twist = { next: 1e9, stage: blackout ? "out" : "stutter", left: 500 };
        r.hazards.push({ kind: "formaldehyde", x: r.you.x + 8, y: 6, w: 3.2, h: 0.9, live: 2000, max: 2500, cause: "formaldehyde" }, { kind: "arm", x: r.you.x + 20, y: 6, w: 20, h: 3.4, side: 1, wall: r.you.x + 30, dirx: -1, span: 96, len: 20, warn: 0, hold: 5000, live: 1, cause: "arm" }, { kind: "arm", x: r.you.x + 20, y: 6, w: 0, h: 3.4, side: -1, wall: r.you.x - 10, dirx: 1, span: 96, len: 0, warn: 5000, hold: 5000, live: 0, cause: "arm" });
        r.bones.push({ id: 9e9, kind: "jar", x: r.you.x + 12, y: 14, vx: 0, vy: 0, spin: 0, life: 4000 }, { id: 9e9 + 1, kind: "syringe", cause: "syringe", x: r.you.x + 14, y: 14, vx: 0, vy: 0, spin: 0, life: 4000 });
        if (r.boss) {
          ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
          for (const act of ["walk", "idle", "syringeWind", "rest"]) {
            Object.assign(r.boss, { act, wait: 1e9, dir: -1 });
            for (const heat of [0, 0.7]) {
              r.boss.heat = heat;
              g.tick(16);
            }
          }
        }
        for (let k = 0; k < 20; k++) g.tick(16);
        r.you.safeMs = 1e9;
      }
    }
  }
  assert.ok(r.spec.id === "ward", "got to the ward and drew it");
  for (const kind of ["salts", "saw"]) {
    const p = sanRound("admissions");
    p.drops.push({ id: 1, kind, x: 30, y: 8, vx: 0, vy: 0, life: 9000, rest: true });
    p.sky.fill(false);
    g.tick(16);
    ghoul.applyPower(p, kind);
  }
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.key("action");
  pick.tick(16);
  const p = pick.round;
  through(p);
  p.offer = ["sanatorium", "chapel"];
  p.phase = "pick";
  p.phaseMs = 0;
  for (let k = 0; k < 4; k++) pick.tick(16);
  assert.equal(p.phase, "pick", "the pick screen draws the Sanatorium's card");
});

/* ------------------------------------------- events for the picked sounds */

test("A flicker that shows tells flickerLunge once, as it switches to lunge", () => {
  const round = sanRound("baths");
  standAt(round, 100);
  round.you.safeMs = 1e9;
  const f = put(round, "flicker", 118);
  round.twist = { next: 1e9, stage: "calm", left: 0 };
  assert.equal(log(round, 200, "flickerLunge").length, 0, "unseen, it creeps");
  round.blackout = true;
  const got = log(round, 400, "flickerLunge");
  assert.equal(got.length, 1);
  assert.equal(f.act, "lunge");
});

test("A Bone Saw bolt tells sawCut for each monster it pierces, and only while the Saw is held", () => {
  const round = sanRound("admissions");
  standAt(round, 60);
  round.you.safeMs = 1e9;
  const o = put(round, "orderly", 70);
  o.act = "rest";
  o.wait = 1e9;
  bolt(round, o, o.y + 3);
  assert.equal(log(round, 40, "sawCut").length, 0, "no Saw, no cut");
  round.effects.saw = 5000;
  bolt(round, o, o.y + 3);
  const got = log(round, 40, "sawCut");
  assert.equal(got.length, 1);
  assert.equal(got[0][1].kind, "orderly");
});

test("The Matron tells matronBeam at the start of each sweep and matronHeat once as your heat starts to rise", () => {
  const round = wardFight();
  const b = round.boss;
  assert.equal(b.sweep, 0, "the first sweep was announced");
  b.phase = Math.PI * 2 - 0.01;
  const beams = log(round, 100, "matronBeam");
  assert.equal(beams.length, 1, "one cue as the sweep comes round");
  const x = 176;
  standAt(round, x);
  round.you.safeMs = 0;
  const dep = depTo(round, x);
  aim(round, dep);
  const heat = hotRun(round, 400, dep).filter((e) => e.type === "matronHeat");
  assert.equal(heat.length, 1, "once, not every frame");
});
