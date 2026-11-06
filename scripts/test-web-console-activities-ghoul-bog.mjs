// Web console tests, Ghoul Rush's Gallows Bog stage: the pack skeleton (the
// lurker, the leech swarm, the will-o'-wisp, the bog body and Old Mother Bog
// joined to the game's tables), the stage row and its five rooms' shapes, the
// mud spans that slow and sink you, the Bog Runner's stub and the Drowning
// Pool's boss spec. The monsters' rules, the fight and the ride land in
// later phases.
import "./seed-random.mjs";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as bog from "../src/web-console/public/activities/ghoul-rush/stages/bog/ghoul-bog.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOSE_SOUNDS, LOSE_WORDS, VOICES } from "../src/web-console/public/activities/ghoul-rush/stages/bog/ghoul-bog-draw.js";
import { BOG_SFX } from "../src/web-console/public/activities/ghoul-rush/stages/bog/ghoul-sfx-bog.js";
import { BOSS_INTROS, bossIntroFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-boss-intros.js";
import { INTROS, introFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-intros.js";
import { react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);
const ROOM_IDS = ["boardwalk", "hollow", "stilts", "lantern", "drowning"];

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Gallows Bog room `id`, reached the way play reaches it (out
// of the hall, the stage picked, the rooms before it gone through), nothing
// woken.
function bogRound(id) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  assert.equal(round.phase, "pick");
  round.offer = ["bog"];
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
  round.events.length = 0;
  return round;
}

function standAt(round, x, shelf = -1) {
  const y = shelf >= 0 ? round.spec.shelves[shelf][2] : ghoul.groundAt(round.spec, x);
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, cuttable: false, out: 0, safeMs: 0 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

/* ------------------------------------------------------------ the stage */

test("Ghoul Rush's Gallows Bog is a stage of five rooms ending on the Drowning Pool, its kinds and boss joined to the game's, last in the list", () => {
  const st = ghoul.stageById("bog");
  assert.deepEqual(st.rooms, ROOM_IDS);
  assert.equal(st.boss, "motherbog");
  assert.equal(st.title, "Gallows Bog");
  assert.equal(st.sub, "The mud does not like to let go");
  assert.equal(ghoul.STAGES.at(-1), st, "the last stage in the list");
  for (const kind of Object.keys(bog.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], bog.MONSTERS[kind], `${kind} is a monster`);
  assert.deepEqual(Object.keys(bog.MONSTERS).sort(), ["bogbody", "leech", "lurker", "wisp"]);
  assert.equal(ghoul.BOSSES.motherbog, bog.BOSSES.motherbog);
  assert.equal(bog.BOSSES.motherbog.name, "Old Mother Bog");
  assert.equal(bog.BOSSES.motherbog.sub, "Keep to the planks, she owns the water");
  assert.equal(bog.BOG.id, "bog");
  for (const key of ["walkers", "zombies", "act", "swoops", "solid", "unseen", "move", "kill", "horde", "tick", "bosses", "boss", "weak", "cause", "hazards"]) assert.ok(key in bog.BOG, `the pack carries ${key}`);
  assert.deepEqual(bog.BOG.zombies, ["bogbody"], "the bog body counts as a zombie");
  for (const id of ROOM_IDS) {
    assert.ok(ghoul.roomById(id), `${id} resolves`);
    assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
    assert.ok(Object.hasOwn(ghoulSfx.default.music, ghoul.ROOM_MUSIC[id]), `${id}'s track exists`);
  }
});

test("Ghoul Rush's bog rooms carry the usual pieces: a key, sky treasures, candy, items and a horde in each walked room, mud spans frozen, the ride its own course, the arena the hag's", () => {
  const [boardwalk, hollow, stilts, lantern, drowning] = ROOM_IDS.map((id) => ghoul.roomById(id));
  assert.deepEqual([boardwalk.title, hollow.title, stilts.title, lantern.title, drowning.title], ["Sunken Boardwalk", "Cypress Hollow", "Stilt House", "The Drowned Lantern", "The Drowning Pool"]);
  assert.deepEqual([boardwalk.sub, hollow.sub, stilts.sub, drowning.sub], ["Mind the gaps. Something lives in them", "The moss is breathing", "She has been expecting you", "Keep to the planks, she owns the water"]);
  for (const room of [boardwalk, hollow, stilts]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.door > room.length - 14, `${room.id}: the door at the end`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < Math.min(...room.sky.map(([, x]) => x)), `${room.id}: wings on the way to the sky`);
    assert.ok(room.mud.length >= 1, `${room.id}: mud spans`);
    for (const span of room.mud) assert.ok(Object.isFrozen(span), `${room.id}: a mud span is frozen`);
    for (const kind of room.horde) assert.ok(ghoul.MONSTERS[kind], `${room.id}: ${kind} is a monster`);
    assert.equal(room.boss, null, `${room.id}: no boss`);
    assert.equal(room.dark, null, `${room.id}: dark or lit by the roll`);
  }
  assert.ok(hollow.water.length && stilts.water.length, "the hollow and the stilts keep pools beside the mud");
  assert.ok(boardwalk.shelves.some((s) => s[3] === "crumble") && hollow.shelves.some((s) => s[3] === "crumble") && stilts.shelves.some((s) => s[3] === "crumble"), "rotting boards that give way");
  // The Bog Runner is a stub: a bonus ride with empty obstacle arrays that
  // Phase 4's deterministic generator fills in.
  assert.equal(lantern.bonus, true);
  assert.equal(lantern.dark, false);
  assert.equal(lantern.key, null);
  assert.equal(lantern.boss, null);
  assert.equal(lantern.horde.length, 0);
  assert.equal(lantern.ride.runner, "lantern");
  assert.equal(lantern.ride.how, "ARROWS walk, SPACE flares. Light 5 shrines, then run to the boat");
  assert.ok(lantern.ride.time >= 70000 && lantern.ride.time <= 120000);
  assert.ok(lantern.ride.shrines.length === 5 && lantern.ride.hummocks.length > 5, "an island with five shrines");
  assert.ok(Object.isFrozen(lantern.ride), "the room is frozen");
  // The Bog Runner (the fan-boat ride this room replaced) is still defined but no stage lists it.
  assert.equal(ghoul.roomById("bogboat"), null, "the retired boat is gone");
  assert.equal(drowning.boss, "motherbog");
  assert.equal(drowning.key, null);
  assert.equal(drowning.horde.length, 0);
  assert.equal(drowning.dark, null, "the arena rolls dark or lit");
  assert.ok(drowning.length - ghoul.FIELD_W > 30, "room to walk into the arena");
});

/* ---------------------------------------------------------- the mud */

test("Ghoul Rush's mud slows a run the longer you stand in it, down to a crawl, and lets go on dry floor", () => {
  const round = bogRound("boardwalk");
  const inMud = round.spec.mud[0][0] + 2;
  standAt(round, inMud);
  round.you.safeMs = 1e9;
  run(round, 200, { right: true });
  assert.equal(round.you.mud, true, "in the span you are muddy");
  // Fresh mud drags like water; the run crawls as the sink deepens.
  standAt(round, inMud);
  const x0 = round.you.x;
  run(round, 1000, { right: true });
  const early = round.you.x - x0;
  assert.ok(round.you.mudMs > 900, `sunk a second (${round.you.mudMs} ms)`);
  run(round, 1800, { right: true });
  const x1 = round.you.x;
  run(round, 1000, { right: true });
  const late = round.you.x - x1;
  assert.ok(late < early * 0.6, `deeper is slower (${early.toFixed(1)} then ${late.toFixed(1)})`);
  // Out of the mud it drains away.
  round.you.mudMs = 2000;
  standAt(round, 290);
  run(round, 500, { right: true });
  assert.equal(round.you.mud, false);
  assert.ok(round.you.mudMs < 2000, `it lets go (${round.you.mudMs} ms)`);
});

test("Ghoul Rush's mud cuts a jump lower the deeper you sink, and a shelf keeps you out of it", () => {
  const round = bogRound("boardwalk");
  const inMud = round.spec.mud[0][0] + 2;
  // A fresh jump in mud leaves near WATER_JUMP of full speed; a sunk one nears MUD_JUMP_MIN.
  const jumpV = (ms) => {
    standAt(round, inMud);
    round.you.mudMs = ms;
    run(round, 4, {});
    round.input.jump = ghoul.JUMP_BUFFER_MS;
    ghoul.advance(round, 4, steady);
    return round.you.vy;
  };
  const fresh = jumpV(0);
  const sunk = jumpV(ghoul.MUD_MS);
  // The vy read is one gravity slice after the jump itself.
  assert.ok(Math.abs(fresh - ghoul.JUMP_V * ghoul.WATER_JUMP) < 2, `fresh mud jumps near water height (${fresh.toFixed(1)})`);
  assert.ok(Math.abs(sunk - ghoul.JUMP_V * ghoul.MUD_JUMP_MIN) < 2, `sunk jumps near the floor of it (${sunk.toFixed(1)})`);
  assert.ok(sunk < fresh, "the deeper the sink, the lower the jump");
  // On a shelf over the mud there is no sinking.
  const shelf = round.spec.shelves.findIndex(([a, b]) => round.spec.mud.some(([m0, m1]) => a < m1 && b > m0));
  assert.ok(shelf >= 0, "a board over the mud to stand on");
  const [a, b] = round.spec.shelves[shelf];
  standAt(round, (a + b) / 2, shelf);
  run(round, 300, {});
  assert.equal(round.you.mud, false, "a board over the mud is dry");
});

test("Ghoul Rush's wisp lure pulls the dead inside a bright wisp's light and lets go when it dims, and never touches another stage's lure", () => {
  const round = bogRound("boardwalk");
  standAt(round, 20);
  round.you.safeMs = 60000;
  const wisp = ghoul.spawnMonster(round, "wisp", 24, 10);
  const risen = ghoul.spawnMonster(round, "bogbody", 28, ghoul.groundAt(round.spec, 28));
  run(round, 40, {});
  assert.ok(risen.lure > 0 && risen.hasteMs > 0 && risen.haste === bog.WISP_HASTE, "in the light it is pulled, a step quicker");
  wisp.act = "dim";
  run(round, 8, {});
  assert.equal(risen.lure, 0, "a shot-out wisp lets it go");
  // In any other stage the same fields belong to another pack (the moth's call).
  const hall = ghoul.newRound(5);
  const moth = ghoul.spawnMonster(hall, "zombie", 20, 6);
  moth.lure = 500;
  moth.hasteMs = 500;
  ghoul.advance(hall, 4, steady);
  assert.equal(moth.lure, 500, "the hall's lure is not the wisp's to clear");
});

/* ------------------------------------------------------ monsters */

const put = (round, kind, x, over = {}) => ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), over);

// Runs until `done()` (or `ms` have passed), 4 ms at a time.
function until(round, done, ms = 4000) {
  for (let t = 0; t < ms && !done(); t += 4) ghoul.advance(round, 4, steady);
}

const tx2 = (e) => e.tx2;

// A bolt arriving from the left at height `y` on the monster `m`.
const bolt = (round, m, y, extra = {}) => round.shots.push({ x: m.x - m.w / 2 - 0.3, y, vx: 80, vy: 0, gone: 0, ...extra });

// A hollow x on dry floor with open floor to either side.
const dry = (round, x) => {
  assert.ok(Number.isFinite(ghoul.groundAt(round.spec, x)), `floor at ${x}`);
  return x;
};

test("Ghoul Rush's lurker is eyes you cannot touch or shoot until you cross it, then snaps out of the water solid and sinks back", () => {
  const round = bogRound("hollow");
  standAt(round, dry(round, 20));
  round.you.safeMs = 1e9;
  const m = put(round, "lurker", 60);
  assert.equal(m.act, "eyes");
  run(round, 8);
  assert.equal(m.unseen, true, "eyes are unseen");
  assert.equal(ghoul.solid(m), false, "nothing to stomp or hit");
  bolt(round, m, m.y + 1);
  run(round, 40);
  assert.equal(m.hp, m.max, "a bolt goes through the eyes");
  assert.equal(events(round, "lurkerSnap").length, 0, "far away it stays down");
  // Cross into its range: it snaps, solid and lunging at you.
  standAt(round, m.x - bog.SNAP_RANGE + 2);
  round.you.safeMs = 1e9;
  run(round, 8);
  assert.equal(m.act, "snap");
  assert.equal(events(round, "lurkerSnap").length, 1);
  assert.equal(ghoul.solid(m), true, "snapping it is solid");
  const x0 = m.x;
  run(round, 200);
  assert.ok(Math.abs(m.x - x0) > 1, "it lunges");
  // The snap ends in a sink, then eyes again.
  run(round, bog.SNAP_MS);
  assert.equal(events(round, "lurkerSink").length, 1);
  assert.ok(m.act === "sink" || m.act === "eyes");
  run(round, bog.LURKER_SINK_MS + 40);
  assert.ok(m.act === "eyes" || m.act === "snap", "back to eyes (or snapping again if you are still near)");
  // Eyes at the waterline do no harm when you walk through them with the shield down.
  const calm = bogRound("hollow");
  standAt(calm, 20);
  calm.you.safeMs = 0;
  const e = put(calm, "lurker", 20, { act: "eyes" });
  calm.you.out = 1000;
  run(calm, 30);
  assert.equal(events(calm, "lose").length, 0);
  assert.equal(e.act, "eyes", "a player who is out never wakes it");
});

test("Ghoul Rush's leech swarm latches for one heart on touch, drops off and cannot latch again at once, and a hit disperses it", () => {
  const round = bogRound("hollow");
  standAt(round, dry(round, 30));
  round.you.safeMs = 0;
  const hearts = round.lives;
  const m = put(round, "leech", 30);
  run(round, 8);
  assert.equal(events(round, "leechLatch").length, 1, "one latch");
  assert.equal(events(round, "lose")[0]?.cause, "leeches", "it costs a heart, named for the leeches");
  assert.equal(m.act, "drop");
  assert.equal(round.lives, hearts - 1, "exactly one heart");
  // It drops off for LEECH_DROP_MS, then drifts again; a second latch waits LEECH_AGAIN_MS.
  const lives = round.lives;
  round.you.safeMs = 0;
  run(round, bog.LEECH_DROP_MS + 20);
  assert.equal(m.act === "drift" || m.act === "drop", true);
  assert.ok(m.latchIn > 0, "cannot latch again yet");
  assert.equal(events(round, "leechLatch").length, 1, "still the one latch");
  assert.equal(round.lives, lives);
  // Stomp-free dispersal: a bolt takes LEECH hp, the swarm comes apart.
  const swarm = put(round, "leech", 60);
  standAt(round, 30);
  round.you.safeMs = 1e9;
  ghoul.hurt(round, swarm, 99, "shot");
  assert.equal(events(round, "leechDie").length, 1, "the swarm comes apart");
});

test("Ghoul Rush's will-o'-wisp is hit only while bright: a bolt puts it out, it stays dim, glows where it will return, then burns again", () => {
  const round = bogRound("boardwalk");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const m = put(round, "wisp", 40, { y: 10 });
  assert.equal(m.act, "bright");
  assert.equal(ghoul.solid(m), true);
  bolt(round, m, m.y + m.h / 2);
  run(round, 4);
  assert.equal(m.act, "dim", "a bolt puts it out");
  assert.equal(events(round, "wispOut").length, 1);
  assert.equal(ghoul.solid(m), false, "a dim wisp is no target and no threat");
  assert.ok(m.relight && Number.isFinite(m.relight.x), "the spot it returns to is seeded");
  run(round, bog.WISP_RELIGHT_MS - 100);
  assert.equal(m.act, "dim", "stays dim for the relight time");
  run(round, 200);
  assert.equal(m.act, "rekindle");
  assert.equal(events(round, "wispRelight").length, 1);
  assert.equal(ghoul.solid(m), false, "glowing is not yet burning");
  run(round, bog.WISP_REKINDLE_MS + 20);
  assert.equal(m.act, "bright");
  assert.equal(events(round, "wispOn").length, 1);
  // A dim wisp is a dip you can pass through: touching it costs nothing.
  const pass = bogRound("boardwalk");
  standAt(pass, 20);
  pass.you.safeMs = 0;
  put(pass, "wisp", 20, { y: pass.you.y + 1, act: "dim", wait: 5000 });
  run(pass, 40);
  assert.equal(events(pass, "lose").length, 0);
});

test("Ghoul Rush's bog body climbs out of the mud harmless, then shambles toward you", () => {
  const round = bogRound("boardwalk");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const m = put(round, "bogbody", 50);
  assert.equal(m.act, "rise");
  run(round, 8);
  assert.ok(m.rise > 0, "climbing out");
  assert.equal(ghoul.solid(m), false, "harmless while it rises");
  assert.equal(events(round, "bogRise").length, 1);
  const x0 = m.x;
  run(round, 300);
  assert.equal(m.x, x0, "it does not walk while it climbs");
  run(round, bog.BOG_RISE_MS);
  assert.equal(m.act, "walk");
  assert.equal(ghoul.solid(m), true);
  const x1 = m.x;
  run(round, 400);
  assert.ok(m.x < x1 - 1, "it walks toward you");
  // One that comes in with the horde is already up.
  const up = put(round, "bogbody", 80, { horde: true });
  run(round, 8);
  assert.equal(up.act, "walk");
  assert.equal(events(round, "bogRise").length, 1, "no second climb");
});

/* ------------------------------------------------------ the lure */

test("Ghoul Rush's bright wisp lures monsters inside WISP_LURE toward you at WISP_HASTE times their speed, and shot out the pull ends", () => {
  const walked = (withWisp) => {
    const round = bogRound("boardwalk");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    const m = put(round, "bogbody", 70, { rise: 0, act: "walk" });
    if (withWisp) put(round, "wisp", 70, { y: 10 });
    const x0 = m.x;
    run(round, 1000);
    return { m, round, dx: x0 - m.x };
  };
  const plain = walked(false);
  const lured = walked(true);
  assert.equal(plain.m.lure || 0, 0);
  assert.ok(lured.m.lure > 0, "pulled");
  assert.ok(lured.m.haste <= bog.WISP_HASTE, "never past the cap");
  const ratio = lured.dx / plain.dx;
  assert.ok(ratio > 1.1 && ratio < bog.WISP_HASTE + 0.05, `about ${bog.WISP_HASTE}x, not more (${ratio.toFixed(2)})`);
  assert.equal(events(lured.round, "wispLure").length, 1, "the pull is announced once");
  // Out of reach of a bright light it is no quicker.
  const round = bogRound("boardwalk");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const far = put(round, "bogbody", 75, { rise: 0, act: "walk" });
  const w = put(round, "wisp", 75 - bog.WISP_LURE - 6, { y: 10 });
  run(round, 100);
  assert.equal(w.act, "bright", "the wisp is burning");
  assert.equal(far.lure || 0, 0, "a bright wisp out of reach lures nobody");
  assert.equal(far.haste || 1, 1);
  // Shot out, the pull ends at once; a monster beyond the radius is not drawn.
  const shot = bogRound("boardwalk");
  standAt(shot, 20);
  shot.you.safeMs = 1e9;
  const walker = put(shot, "bogbody", 70, { rise: 0, act: "walk" });
  const light = put(shot, "wisp", 72, { y: 10 });
  run(shot, 60);
  assert.ok(walker.lure > 0);
  light.act = "dim";
  light.wait = 1e9;
  run(shot, 8);
  assert.equal(walker.lure, 0);
  assert.equal(walker.hasteMs, 0);
  assert.equal(walker.haste, 1);
});

test("Ghoul Rush's wisp lure stays fair in a horde: every monster in the light is capped at WISP_HASTE, a wisp never lures another wisp, and shooting the wisp out frees the lot", () => {
  const round = bogRound("boardwalk");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const pack = [put(round, "bogbody", 70, { rise: 0, act: "walk" }), put(round, "bogbody", 75, { rise: 0, act: "walk" }), put(round, "leech", 72), put(round, "bogbody", 78, { rise: 0, act: "walk" })];
  const lights = [put(round, "wisp", 74, { y: 10 }), put(round, "wisp", 76, { y: 11 })];
  run(round, 120);
  for (const m of pack) {
    assert.ok(m.lure > 0, `${m.kind} is lured`);
    assert.ok(m.haste <= bog.WISP_HASTE + 1e-9, `${m.kind} at ${m.haste}x`);
  }
  for (const w of lights) assert.equal(w.lure || 0, 0, "a wisp is never lured by a wisp");
  // Two lights do not stack: the cap is the cap.
  assert.equal(new Set(pack.map((m) => m.haste)).size, 1);
  for (const w of lights) {
    bolt(round, w, w.y + w.h / 2);
    run(round, 8);
  }
  run(round, 20);
  for (const m of pack) assert.equal(m.lure, 0, `${m.kind} is let go`);
});

/* ---------------------------------------------------------- mud, boots, harpoon */

test("Ghoul Rush's mud holds you only on its spans and on the ground: a jump lets go of the sink, mudMs builds and drains, and the speed bottoms out at MUD_SPEED_MIN", () => {
  const round = bogRound("boardwalk");
  const [a, b] = round.spec.mud[0];
  standAt(round, a + 3);
  round.you.safeMs = 1e9;
  run(round, 4);
  assert.equal(round.you.mud, true, "on the span");
  standAt(round, a - 3);
  run(round, 4);
  assert.equal(round.you.mud, false, "just off it");
  standAt(round, b + 3);
  run(round, 4);
  assert.equal(round.you.mud, false, "past it");
  // In the air over the mud nothing sinks.
  standAt(round, a + 3);
  round.you.y += 4;
  round.you.vy = 0;
  round.you.state = "fall";
  run(round, 4);
  assert.equal(round.you.mud, false, "airborne is dry");
  // mudMs builds one-for-one and drains the same way, never below zero.
  standAt(round, a + 3);
  round.you.mudMs = 0;
  run(round, 400);
  assert.ok(round.you.mudMs >= 380 && round.you.mudMs <= 440, `built (${round.you.mudMs})`);
  standAt(round, a - 20);
  run(round, 10000);
  assert.equal(round.you.mudMs, 0, "never below zero");
  // At full sink the run is a crawl: MUD_SPEED_MIN of a dry run's reach over the same time.
  const reach = (mudMs, x) => {
    standAt(round, x);
    round.you.mudMs = mudMs;
    const x0 = round.you.x;
    run(round, 160, { right: true });
    return round.you.x - x0;
  };
  const dryReach = reach(0, 270);
  const fresh = reach(0, a + 3);
  const sunk = reach(ghoul.MUD_MS, a + 3);
  assert.ok(sunk < fresh && fresh < dryReach, `dry ${dryReach.toFixed(1)} > fresh ${fresh.toFixed(1)} > sunk ${sunk.toFixed(1)}`);
  assert.ok(sunk / dryReach < ghoul.MUD_SPEED_MIN + 0.12, `crawls (${(sunk / dryReach).toFixed(2)} of dry)`);
  assert.ok(ghoul.MUD_SPEED_MIN < ghoul.WATER_SPEED && ghoul.MUD_JUMP_MIN < ghoul.WATER_JUMP, "mud is always worse than water");
});

test("Ghoul Rush's Stilt Boots let the mud go while they last, and the mud takes hold again after", () => {
  const round = bogRound("boardwalk");
  const [a] = round.spec.mud[0];
  standAt(round, a + 3);
  round.you.safeMs = 1e9;
  round.effects.boots = 300;
  run(round, 100);
  assert.equal(round.you.mud, false, "boots neutralize it");
  assert.equal(round.you.mudMs, 0);
  const x0 = round.you.x;
  run(round, 100, { right: true });
  const booted = round.you.x - x0;
  assert.ok(booted > 0);
  round.effects.boots = 0;
  standAt(round, a + 3);
  run(round, 8);
  assert.equal(round.you.mud, true, "the mud takes hold again");
  assert.equal(ghoul.POWERS.boots.stage, "bog");
});

test("Ghoul Rush's harpoon pierces everything in its line, reaches a lurker's eyes under the water that any other bolt passes through, and a plain bolt does not", () => {
  const round = bogRound("hollow");
  standAt(round, dry(round, 20));
  round.you.safeMs = 1e9;
  const near = put(round, "lurker", 50);
  const far = put(round, "lurker", 70);
  run(round, 8);
  assert.equal(near.unseen && far.unseen, true);
  const harpoon = () => ({ arm: "harpoon", x: 30, y: near.y + 1, vx: 84, vy: 0, gone: 0, t: 0, spin: 0, dmg: 14, bossDmg: 8, pierce: true });
  // A plain bolt flies through both pairs of eyes.
  round.shots.push({ x: 30, y: near.y + 1, vx: 80, vy: 0, gone: 0 });
  run(round, 600);
  assert.equal(near.hp, near.max);
  assert.equal(far.hp, far.max);
  assert.equal(events(round, "harpoonHit").length, 0);
  // A harpoon finds the first, goes on through it and finds the second.
  round.shots.push(harpoon());
  run(round, 800);
  assert.equal(events(round, "harpoonHit").length, 2, "one hit for each, none twice");
  assert.ok(near.dead || near.hp < near.max, "the near lurker is hurt");
  assert.ok(far.dead || far.hp < far.max, "the far one too");
  assert.equal(events(round, "kill").length, 2, "14 damage is enough for a lurker");
});

/* ------------------------------------------------------ Old Mother Bog */

// The Drowning Pool with the hag awake and fighting, nothing else on the field.
function motherFight() {
  const round = bogRound("drowning");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  round.you.safeMs = 0;
  round.events.length = 0;
  return round;
}

// Straight to her next move, as if her wait had run out.
const hurry = (b) => (b.wait = 0);

test("Old Mother Bog's mud wave winds up, rolls down the planks at you, and is jumped: standing in it costs a heart (swamped), a jump clears it", () => {
  const round = motherFight();
  const b = round.boss;
  assert.equal(b.kind, "motherbog");
  assert.equal(b.hp, bog.BOSSES.motherbog.hp);
  standAt(round, 150);
  b.act = "idle";
  hurry(b);
  run(round, 8);
  assert.equal(b.act, "wind", "the first move is the wave");
  assert.equal(events(round, "motherWind").length, 1, "a wind-up to read");
  assert.equal(round.waves.length, 0, "nothing rolls during the wind-up");
  run(round, bog.MOTHER_WIND_MS + 20);
  assert.equal(events(round, "mudWave").length, 1);
  assert.equal(round.waves[0]?.cause, "mudwave");
  assert.equal(b.act, "rest");
  // Stand still: it arrives and swamps you.
  const stand = round.you.x;
  until(round, () => events(round, "lose").length > 0, 3000);
  assert.equal(events(round, "lose")[0]?.cause, "mudwave");
  assert.equal(round.you.x, stand);
  // The same wave, jumped at the edge, goes by.
  const jumper = motherFight();
  standAt(jumper, 150);
  jumper.boss.act = "rest";
  jumper.boss.wait = 1e9;
  jumper.waves.push({ x: 170, y: 6, dir: -1, life: 6000, kind: "mudwave", cause: "mudwave" });
  let jumped = false;
  until(jumper, () => {
    const w = jumper.waves[0];
    if (!jumped && w && w.x - jumper.you.x < 9) {
      jumper.input.jump = ghoul.JUMP_BUFFER_MS;
      jumped = true;
    }
    return !jumper.waves.length || jumper.waves[0].x < jumper.you.x - 3;
  }, 3000);
  assert.ok(jumped, "it came at me");
  assert.equal(events(jumper, "lose").length, 0, "a jump clears the wave");
});

test("Old Mother Bog's cauldron opens late in each rest, and a shot into her then counts triple, any other time one", () => {
  const round = motherFight();
  const b = round.boss;
  const hit = (act, wait) => {
    Object.assign(b, { act, wait });
    round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + b.h * 0.35, vx: 80, vy: 0, gone: 0 });
    const hp = b.hp;
    ghoul.advance(round, 4, steady);
    return hp - b.hp;
  };
  assert.equal(hit("idle", 1e9), 1, "shut: one");
  assert.equal(hit("rest", bog.MOTHER_REST_MS), 1, "early in the rest: one");
  assert.equal(b.lit, false);
  round.events.length = 0;
  assert.equal(hit("rest", bog.MOTHER_OPEN_MS - 100), 3, "open: triple");
  assert.equal(b.lit, true);
  assert.equal(events(round, "cauldronOpen").length, 1, "the opening is announced");
  assert.equal(round.events.filter((e) => e.type === "bossHit").at(-1).weak, true, "and the hit says it was a weak spot");
  assert.equal(hit("wind", 400), 1, "mid-wind-up: one");
  assert.equal(b.lit, false, "closed again");
});

test("Old Mother Bog's cauldron spit lands a muck patch where you stand after a wind-up, warns before it burns, burns for MUCK_MS and hurts only while live", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  b.act = "idle";
  b.plan = "spit";
  hurry(b);
  run(round, 8);
  assert.equal(b.act, "throwWind");
  assert.equal(events(round, "spitWind").length, 1);
  assert.equal(round.hazards.length, 0, "the glob is not thrown during the wind-up");
  run(round, bog.SPIT_WIND_MS + 20);
  const spit = events(round, "cauldronSpit");
  assert.equal(spit.length, 1);
  assert.equal(round.hazards.length, 1, "one patch before she is angry");
  const patch = round.hazards[0];
  assert.equal(patch.kind, "muck");
  assert.equal(patch.cause, "muck");
  assert.ok(Math.abs(patch.x - 150) <= 6, "where you stood");
  assert.equal(spit[0].tx, patch.x);
  assert.equal(tx2(spit[0]), undefined, "no second patch yet");
  // It warns first: standing in the glob's shadow is safe.
  round.you.safeMs = 0;
  standAt(round, patch.x);
  run(round, bog.MUCK_LAND_MS - 100);
  assert.equal(events(round, "lose").length, 0, "still in the air");
  run(round, 200);
  assert.equal(events(round, "muckLand").length, 1);
  assert.equal(events(round, "lose")[0]?.cause, "muck", "burning, it hurts");
  // It burns out MUCK_MS after it lands.
  const out = motherFight();
  out.boss.act = "rest";
  out.boss.wait = 1e9;
  out.hazards.push({ kind: "muck", x: 150, y: 6, w: bog.MUCK_W, h: bog.MUCK_H, warn: 0, live: bog.MUCK_MS, cause: "muck" });
  standAt(out, 100);
  out.you.safeMs = 1e9;
  run(out, bog.MUCK_MS - 100);
  assert.equal(out.hazards.length, 1);
  run(out, 200);
  assert.equal(out.hazards.length, 0, "burnt out");
});

test("Old Mother Bog goes meaner at half her hp: waits shrink to MOTHER_QUICK of themselves and the spit leaves a second patch ahead of your feet", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  Object.assign(b, { raged: true, sank: true, act: "idle", plan: "spit", y: 6, x: 176 });
  b.wait = 0;
  round.you.vx = 20;
  run(round, 8);
  assert.equal(b.act, "throwWind");
  assert.ok(b.wait <= bog.SPIT_WIND_MS * bog.MOTHER_QUICK + 1, `quicker wind-up (${b.wait})`);
  run(round, bog.SPIT_WIND_MS);
  const spit = events(round, "cauldronSpit")[0];
  assert.ok(spit, "spat");
  assert.equal(round.hazards.length, 2, "two patches");
  assert.ok(tx2(spit) !== undefined && Math.abs(tx2(spit) - spit.tx) >= bog.MUCK_W, "the second is a patch away from the first");
  assert.ok(b.wait <= bog.MOTHER_REST_MS * bog.MOTHER_QUICK + 1, "and her rest is shorter");
  // Calm, the same spit is one patch.
  const calm = motherFight();
  standAt(calm, 150);
  calm.you.safeMs = 1e9;
  Object.assign(calm.boss, { act: "throwWind", wait: 0 });
  run(calm, 8);
  assert.equal(calm.hazards.length, 1);
});

test("Old Mother Bog sinks at half her hp, bubbles where she will rise, rises near you on a plank and is hittable the instant she does", () => {
  const calm = motherFight();
  assert.equal(calm.boss.sank || false, false);
  calm.boss.act = "idle";
  calm.boss.wait = 1e9;
  calm.boss.hp = calm.boss.max * bog.MOTHER_RAGE + 1;
  run(calm, 40);
  assert.equal(calm.boss.sank || false, false, "above half she stays up");
  standAt(calm, 150);
  calm.you.safeMs = 1e9;
  calm.boss.hp = calm.boss.max * bog.MOTHER_RAGE;
  run(calm, 8);
  const h = calm.boss;
  assert.equal(h.sank, true);
  assert.equal(h.act, "sink");
  assert.equal(h.raged, true);
  assert.equal(h.hidden, true, "gone at once");
  assert.equal(events(calm, "motherSink").length, 1);
  // Under the water nothing she is hurts and nothing hurts her: a bolt meets water.
  const hp = h.hp;
  calm.shots.push({ x: h.x - 2, y: 6.5, vx: 80, vy: 0, gone: 0 });
  Object.assign(calm.you, { x: h.x - 1 });
  calm.you.safeMs = 0;
  run(calm, 40);
  assert.equal(h.hp, hp, "no damage while she is under");
  assert.equal(events(calm, "lose").length, 0, "and she cannot hurt you from the water");
  // She bubbles where she will come up: a plank near you, never on top of you.
  standAt(calm, 150);
  calm.you.safeMs = 1e9;
  until(calm, () => h.act === "under", 2000);
  const bubble = events(calm, "motherBubble")[0];
  assert.ok(bubble, "bubbles show");
  assert.equal(h.act, "under");
  assert.equal(bubble.x, h.sinkX);
  assert.ok(Number.isFinite(ghoul.groundAt(calm.spec, h.sinkX)), "on a plank");
  assert.ok(Math.abs(h.sinkX - calm.you.x) >= 6, "never on top of you");
  // She rises exactly there, touchable and hittable at once.
  until(calm, () => h.act === "resurface", 2000);
  assert.equal(h.x, bubble.x);
  assert.equal(h.hidden, false);
  assert.equal(h.y, h.home);
  assert.equal(events(calm, "motherRise").length, 1);
  const before = h.hp;
  calm.shots.push({ x: h.x - h.w / 2 - 0.2, y: h.y + h.h * 0.35, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(calm, 4, steady);
  assert.ok(before - h.hp >= 1, "never unhittable once she is up");
  until(calm, () => h.act === "rest", 2000);
  assert.ok(h.wait <= bog.MOTHER_REST_MS * bog.MOTHER_QUICK + 1, "and her next wait is the quick one");
});

test("Old Mother Bog is not a pattern: the wave opens, then a weighted pick by phase that never makes one move three times running, keeps the slow moves on a cooldown and summons only under the cap", () => {
  // A long run of picks, as she would make them.
  const rolls = (b, n, random, round = null) => Array.from({ length: n }, () => bog.pickAttack(b, random, round));
  const three = (list) => list.some((m, i) => i > 1 && m === list[i - 1] && m === list[i - 2]);
  const lcg = (seed) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  assert.equal(bog.pickAttack({ hp: 100, max: 100 }, () => 0.99), "wave", "the first move is always the wave");
  const P1 = ["dive", "hands", "shell", "spit", "surge", "wave"];
  const MORE = [...P1, "brood", "double", "volley"];
  const P2 = [...MORE, "drowned", "pull", "stomp", "tide"];
  const P3 = [...P2, "wisps"];
  const phases = [
    [{ hp: 100, max: 100 }, P1, "full health: six moves"],
    [{ hp: 70, max: 100 }, MORE, "under three quarters: the double wave, the volley and the brood join"],
    [{ hp: 45, max: 100, raged: true, sank: true }, P2, "under half: the stomp, the tide, the pull and the drowned join"],
    [{ hp: 20, max: 100, raged: true, sank: true, fury: true, sank2: true }, P3, "under a quarter: the wisp lantern joins"],
  ];
  for (const [b, want, what] of phases) {
    const seen = rolls(b, 600, lcg(17));
    assert.deepEqual([...new Set(seen)].sort(), [...want].sort(), what);
    assert.ok(!three(seen), `never three in a row (${what})`);
    // A slow move sits out its cooldown.
    for (const [move, n] of Object.entries(bog.COOLDOWN)) {
      const at = seen.flatMap((m, i) => (m === move ? [i] : []));
      assert.ok(at.every((i, j) => j === 0 || i - at[j - 1] > n), `${move} waits ${n} picks (${what})`);
    }
  }
  assert.equal(bog.phaseOf({}), 0);
  assert.equal(bog.phaseOf({ raged: true }), 1);
  assert.equal(bog.phaseOf({ raged: true, fury: true }), 2);
  // At the cap a summon is never picked.
  const crowd = { monsters: [] };
  for (let i = 0; i < bog.BROOD_CAP; i++) crowd.monsters.push({ kind: "leech", hag: true });
  for (let i = 0; i < bog.BODIES_CAP; i++) crowd.monsters.push({ kind: "bogbody", hag: true });
  for (let i = 0; i < bog.WISPS_CAP; i++) crowd.monsters.push({ kind: "wisp", hag: true });
  const capped = rolls({ hp: 20, max: 100, raged: true, fury: true, picks: 1 }, 400, lcg(5), crowd);
  for (const move of ["brood", "drowned", "wisps"]) assert.equal(capped.includes(move), false, `no ${move} at the cap`);
  const forced = { hp: 100, max: 100, picks: 3, plan: "volley" };
  assert.equal(bog.pickAttack(forced, () => 0), "volley", "a plan is taken");
  assert.equal(forced.plan, null, "once");
});

test("Old Mother Bog's double wave sends a second wave DOUBLE_GAP_MS behind the first, and her volley lands three staggered patches", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  Object.assign(b, { act: "idle", plan: "double", attacks: 2 });
  hurry(b);
  run(round, 8);
  assert.equal(b.act, "wind");
  run(round, bog.MOTHER_WIND_MS + 20);
  assert.equal(events(round, "mudWave").length, 1, "one wave to start");
  run(round, bog.DOUBLE_GAP_MS + 30);
  const waves = events(round, "mudWave");
  assert.equal(waves.length, 2, "and a second behind it");
  assert.equal(waves[1].echo, true);
  const volley = motherFight();
  standAt(volley, 150);
  volley.you.safeMs = 1e9;
  Object.assign(volley.boss, { act: "idle", plan: "volley", attacks: 2 });
  hurry(volley.boss);
  run(volley, 8);
  assert.equal(volley.boss.act, "throwWind");
  run(volley, bog.SPIT_WIND_MS + 20);
  assert.ok(volley.hazards.length >= 2 && volley.hazards.length <= 3, `a spread of patches (${volley.hazards.length})`);
  const warns = volley.hazards.map((h) => h.warn).sort((a, c) => a - c);
  assert.ok(warns.at(-1) - warns[0] >= bog.VOLLEY_STAGGER_MS - 30, "landing a beat apart");
});

test("Old Mother Bog never stands half out over the water (only a dive, a charge or a leap takes her off the boards), and goes under a second time at a quarter of her hp and comes back furious", () => {
  const round = motherFight();
  const b = round.boss;
  const half = (x) => [-0.45, 0, 0.45].every((f) => ghoul.groundAt(round.spec, x + f * b.w) === b.y);
  // Put down over the gap between the planks, she walks onto one that holds her.
  standAt(round, 160);
  round.you.safeMs = 1e9;
  Object.assign(b, { act: "idle", x: 131, wait: 1e9 });
  until(round, () => half(b.x), 4000);
  assert.ok(half(b.x), `she settled on the planks (x=${b.x})`);
  // However she wanders in a long fight, her body is on the boards.
  Object.assign(b, { act: "idle", wait: 0, plan: "spit" });
  for (let i = 0; i < 400; i++) {
    standAt(round, 112 + ((i * 7) % 80));
    round.you.safeMs = 1e9;
    if (b.act === "idle") b.wait = Math.min(b.wait, 400);
    run(round, 50);
    if (b.hidden || bog.UNSTOOD.includes(b.act)) continue;
    assert.ok(half(b.x), `on the planks at step ${i} (x=${b.x}, act ${b.act})`);
  }
  // A second dive at a quarter.
  const fight = motherFight();
  const h = fight.boss;
  standAt(fight, 150);
  fight.you.safeMs = 1e9;
  Object.assign(h, { raged: true, sank: true, act: "idle", wait: 1e9, hp: h.max * bog.MOTHER_FURY_AT - 1 });
  run(fight, 8);
  assert.equal(h.sank2, true);
  assert.equal(h.fury, true);
  assert.equal(h.act, "sink");
  assert.equal(h.hidden, true);
  until(fight, () => h.act === "rest", 4000);
  assert.ok(h.wait <= bog.MOTHER_REST_MS * bog.MOTHER_FURY + 1, "her waits are the furious ones");
  assert.equal(events(fight, "motherSink").length, 1);
});

test("Old Mother Bog: her guard and weak spot are what the pack says, her touch is the motherbog cause, and her fall clears the field of every hazard and add she made", () => {
  assert.equal(bog.BOG.guard.motherbog({ hidden: true }), true);
  assert.equal(bog.BOG.guard.motherbog({ hidden: false }), false);
  assert.equal(bog.BOG.guard.motherbog({ hidden: false, act: "shell" }), true, "shelled");
  assert.equal(bog.BOG.guard.motherbog({ hidden: false, act: "stagger" }), false, "reeling, she is open");
  assert.equal(bog.BOG.weak.motherbog({ lit: true }), 3);
  assert.equal(bog.BOG.weak.motherbog({ lit: false }), 1);
  assert.equal(bog.BOG.cause.motherbog(), "motherbog");
  const touch = motherFight();
  touch.boss.act = "idle";
  touch.boss.wait = 1e9;
  Object.assign(touch.you, { x: touch.boss.x - 3 });
  run(touch, 20);
  assert.equal(events(touch, "lose")[0]?.cause, "motherbog");
  const round = motherFight();
  const b = round.boss;
  b.hp = 1;
  b.sank = true;
  b.sank2 = true;
  round.hazards.push({ kind: "muck", x: 150, y: 6, w: bog.MUCK_W, h: bog.MUCK_H, warn: 0, live: 2000, cause: "muck" });
  round.waves.push({ x: 140, y: 6, dir: -1, life: 6000, kind: "mudwave", cause: "mudwave" });
  round.hazards.push({ kind: "boghand", x: 160, y: 6, w: bog.HAND_W, h: bog.HAND_H, warn: 0, live: 400, cause: "boghand" });
  round.hazards.push({ kind: "tide", x: 152, y: 5, w: 104, h: 1.6, x0: 104, x1: 200, warn: 0, live: 2000, cause: "tide" });
  put(round, "leech", 150, { hag: true });
  put(round, "bogbody", 160, { hag: true });
  put(round, "wisp", 150, { hag: true, y: 14 });
  Object.assign(b, { act: "rest", wait: bog.MOTHER_OPEN_MS - 100 });
  standAt(round, 120);
  round.you.safeMs = 1e9;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + b.h * 0.35, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.state, "down");
  assert.equal(round.hasKey, true);
  assert.equal(round.hazards.length, 0, "the muck, the hands and the tide are gone");
  assert.equal(round.waves.length, 0);
  assert.equal(round.monsters.length, 0, "and so are her adds");
});

// Her next move forced, from idle, as if her wait had run out; `over` sets
// her phase or her place first.
function force(round, move, over = {}) {
  const b = round.boss;
  Object.assign(b, { act: "idle", plan: move, picks: Math.max(3, b.picks || 0) }, over);
  b.wait = 0;
  run(round, 8);
}
const RAGED = { raged: true, sank: true };
const FURY = { raged: true, sank: true, fury: true, sank2: true };
// A bolt from the left into her middle, one slice later.
function shoot(round) {
  const b = round.boss;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + b.h * 0.35, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
}
// Runs `ms`, jumping whenever `near()` says the threat is about to arrive.
function hop(round, ms, near) {
  for (let t = 0; t < ms; t += 4) {
    const you = round.you;
    if (you.state === "run" && near(round) && round.input.jump <= 0) round.input.jump = ghoul.JUMP_BUFFER_MS;
    ghoul.advance(round, 4, steady);
  }
}
// A mud wave rolling at you, within `d`.
const waveAt = (round, d = 7.5) => round.waves.some((w) => (round.you.x - w.x) * w.dir > 0 && (round.you.x - w.x) * w.dir < d);
const losses = (round) => events(round, "lose");

test("Old Mother Bog's bog hands: her arms go into the water, ripples warn where you stand and a step either side, a hand bursts up from each (a heart, grabbed), and a step between them costs nothing", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  const lives = round.lives;
  force(round, "hands");
  assert.equal(b.act, "hands", "her arms in the water");
  const wind = events(round, "handsWind")[0];
  assert.ok(wind, "a wind-up to read");
  const hands = round.hazards.filter((h) => h.kind === "boghand");
  assert.equal(hands.length, bog.HANDS_N[0], "two at full health");
  assert.deepEqual(wind.xs, hands.map((h) => h.x), "the event names every ripple");
  assert.ok(hands.some((h) => Math.abs(h.x - 150) <= 2), "one where you stand");
  assert.ok(hands.every((h) => h.live === 0 && h.warn >= bog.HANDS_WIND_MS + bog.HAND_WARN_MS - 10 && h.cause === "boghand"), "each warns first");
  assert.ok(hands.every((h) => Number.isFinite(ghoul.groundAt(round.spec, h.x))), "out of the planks");
  run(round, bog.HANDS_WIND_MS + bog.HAND_WARN_MS - 40);
  assert.equal(losses(round).length, 0, "a ripple does not hurt");
  run(round, 80);
  assert.ok(events(round, "handsUp").length >= 1, "up it comes");
  assert.equal(losses(round)[0]?.cause, "boghand", "standing in it, you are grabbed");
  assert.equal(round.lives, lives - 1, "a heart");
  // A step between the ripples, and every hand goes by.
  const dodge = motherFight();
  standAt(dodge, 150);
  force(dodge, "hands");
  const spots = dodge.hazards.map((h) => h.x).sort((a, c) => a - c);
  standAt(dodge, spots[0] - 4.5);
  run(dodge, bog.HANDS_WIND_MS + bog.HAND_WARN_MS + bog.HAND_STAGGER_MS * 3 + bog.HAND_UP_MS + 50);
  assert.equal(losses(dodge).length, 0, "a clean dodge costs nothing");
  assert.equal(dodge.hazards.filter((h) => h.kind === "boghand").length, 0, "the hands are gone again");
  assert.equal(dodge.boss.act, "idle");
  // More of them as she weakens.
  for (const [phase, over] of [[1, RAGED], [2, FURY]]) {
    const more = motherFight();
    standAt(more, 145);
    force(more, "hands", over);
    assert.equal(more.hazards.filter((h) => h.kind === "boghand").length, bog.HANDS_N[phase], `phase ${phase}`);
  }
});

test("Old Mother Bog's surge: a crouch behind a bow wave, then a waist-deep charge along and past you; standing costs a heart, a jump over her or a shelf costs nothing, and she stops on the planks", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  const lives = round.lives;
  force(round, "surge");
  const from = b.x;
  assert.equal(b.act, "surgeWind");
  assert.equal(events(round, "surgeWind").length, 1, "a wind-up to read");
  run(round, bog.SURGE_WIND_MS - 40);
  assert.equal(b.x, from, "she holds still while she crouches");
  run(round, 60);
  assert.equal(b.act, "surge");
  assert.equal(events(round, "motherSurge").length, 1);
  assert.equal(b.y, b.floor - bog.SURGE_SINK, "waist deep");
  assert.ok((150 - b.surgeTo) >= 6, `past you (${b.surgeTo})`);
  until(round, () => losses(round).length > 0, 2000);
  assert.equal(losses(round)[0]?.cause, "motherbog", "run down");
  assert.equal(round.lives, lives - 1);
  // A jump as she comes clears her.
  const jumper = motherFight();
  standAt(jumper, 150);
  force(jumper, "surge");
  run(jumper, bog.SURGE_WIND_MS + 20);
  const jb = jumper.boss;
  hop(jumper, 1500, () => jb.act === "surge" && jb.x - jb.w / 2 - jumper.you.x - ghoul.HIT_W / 2 < 7.5);
  assert.equal(losses(jumper).length, 0, "jumped clean");
  assert.equal(jb.act === "rest" || jb.act === "idle", true, "the charge is over");
  assert.ok([-0.45, 0, 0.45].every((f) => ghoul.groundAt(jumper.spec, jb.x + f * jb.w) === jb.y), "she stopped on the planks");
  assert.ok(jb.x < 150, "on your other side: she moved");
  // Up on a shelf she charges underneath.
  const shelf = motherFight();
  standAt(shelf, 118, 0);
  force(shelf, "surge");
  run(shelf, bog.SURGE_WIND_MS + 1500);
  assert.equal(losses(shelf).length, 0, "the shelf is out of her reach");
});

test("Old Mother Bog's mud shell: bolts chip it and not her, SHELL_HP of them break it and leave her reeling with the cauldron open (triple), and left alone she feeds and heals", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  force(round, "shell");
  assert.equal(b.act, "shellWind");
  assert.equal(events(round, "shellWind").length, 1, "a wind-up to read");
  run(round, bog.SHELL_WIND_MS + 10);
  assert.equal(b.act, "shell");
  assert.equal(bog.BOG.guard.motherbog(b), true, "guarded");
  assert.equal(b.shell, bog.SHELL_HP[0]);
  const hp = b.hp;
  for (let i = 0; i < bog.SHELL_HP[0] - 1; i++) shoot(round);
  assert.equal(b.hp, hp, "the shell takes the bolts");
  assert.equal(events(round, "shellChip").length, bog.SHELL_HP[0] - 1, "each a chip");
  assert.equal(b.act, "shell", "still up");
  shoot(round);
  assert.equal(events(round, "shellBreak").length, 1, "broken");
  assert.equal(b.act, "stagger");
  shoot(round);
  assert.equal(b.lit, true, "the cauldron is open while she reels");
  assert.equal(hp - b.hp, 3, "and a bolt counts triple");
  assert.ok(events(round, "cauldronOpen").length >= 1);
  run(round, bog.STAGGER_MS + 20);
  assert.equal(b.act, "idle");
  // Ignored, she ladles herself a feed.
  const feed = motherFight();
  standAt(feed, 150);
  feed.you.safeMs = 1e9;
  feed.boss.hp = feed.boss.max - 40;
  force(feed, "shell");
  run(feed, bog.SHELL_WIND_MS + bog.SHELL_MS + 20);
  const fed = events(feed, "motherFeed")[0];
  assert.ok(fed, "she feeds");
  assert.equal(fed.heal, bog.SHELL_HEAL);
  assert.equal(feed.boss.hp, feed.boss.max - 40 + bog.SHELL_HEAL, "and heals");
  const full = motherFight();
  full.you.safeMs = 1e9;
  full.boss.hp = full.boss.max - 3;
  force(full, "shell");
  run(full, bog.SHELL_WIND_MS + bog.SHELL_MS + 20);
  assert.equal(full.boss.hp, full.boss.max, "never past her max");
  // A stomp on the shell glances off.
  const stomp = motherFight();
  stomp.you.safeMs = 1e9;
  force(stomp, "shell");
  run(stomp, bog.SHELL_WIND_MS + 10);
  const sb = stomp.boss;
  const before = sb.hp;
  Object.assign(stomp.you, { x: sb.x, y: sb.y + sb.h + 0.3, vy: -20, state: "air", shelf: -1 });
  run(stomp, 20);
  assert.equal(sb.hp, before, "a stomp does nothing to the shell");
  assert.ok(events(stomp, "bossBlock").length >= 1);
});

test("Old Mother Bog's dive: she goes under (shots meet water), bubbles show a new spot on the planks away from you, she rises there hittable, and meaner the rise sends a mud wave each way", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  force(round, "dive");
  assert.equal(b.act, "sink");
  assert.equal(b.hidden, true);
  assert.equal(b.raged || false, false, "a dive of her own is not the rage");
  assert.equal(events(round, "motherSink")[0]?.relocate, true);
  const hp = b.hp;
  round.shots.push({ x: b.x - 2, y: 7, vx: 80, vy: 0, gone: 0 });
  run(round, 40);
  assert.equal(b.hp, hp, "no damage under the water");
  until(round, () => b.act === "under", 2000);
  const bubble = events(round, "motherBubble")[0];
  assert.ok(bubble);
  assert.ok(Math.abs(b.sinkX - round.you.x) >= 6, "never on top of you");
  assert.ok([-0.45, 0, 0.45].every((f) => ghoul.groundAt(round.spec, b.sinkX + f * b.w) === b.floor), "on a plank that holds her");
  until(round, () => b.act === "resurface", 2000);
  assert.equal(b.x, bubble.x);
  shoot(round);
  assert.ok(hp - b.hp >= 1, "hittable once she is up");
  until(round, () => b.act === "rest", 2000);
  assert.equal(events(round, "mudWave").length, 0, "calm, no waves");
  // Meaner, two waves come off her as she stands.
  const mean = motherFight();
  standAt(mean, 150);
  mean.you.safeMs = 1e9;
  force(mean, "dive", RAGED);
  until(mean, () => mean.boss.act === "rest", 4000);
  const waves = events(mean, "mudWave").filter((e) => e.rise);
  assert.deepEqual(waves.map((w) => w.dir).sort(), [-1, 1], "a wave each way");
});

test("Old Mother Bog's leech brood: she tips the cauldron, a swarm or two pours onto the planks and creeps at you, never more than BROOD_CAP of hers alive; a latch is a heart and two bolts see one off", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 140 + 10);
  round.you.safeMs = 1e9;
  force(round, "brood");
  assert.equal(b.act, "broodWind");
  assert.equal(events(round, "broodWind").length, 1, "a wind-up to read");
  assert.equal(bog.hagAdds(round, "leech"), 0, "nothing out during the tip");
  run(round, bog.BROOD_WIND_MS + 10);
  assert.equal(events(round, "broodPour")[0]?.n, bog.BROOD_N);
  assert.equal(bog.hagAdds(round, "leech"), bog.BROOD_N);
  const brood = round.monsters.filter((m) => m.hag);
  assert.ok(brood.every((m) => m.kind === "leech" && Number.isFinite(ghoul.groundAt(round.spec, m.x))), "on the planks");
  const x0 = brood[0].x;
  run(round, 300);
  assert.ok(brood[0].x < x0, "creeping at you");
  force(round, "brood");
  run(round, bog.BROOD_WIND_MS + 10);
  force(round, "brood");
  run(round, bog.BROOD_WIND_MS + 10);
  assert.equal(bog.hagAdds(round, "leech"), bog.BROOD_CAP, "capped");
  // A latch costs a heart.
  const latch = motherFight();
  const lives = latch.lives;
  standAt(latch, 150);
  put(latch, "leech", 150.5, { hag: true });
  run(latch, 40);
  assert.equal(losses(latch)[0]?.cause, "leeches");
  assert.equal(latch.lives, lives - 1);
  // Two bolts see one off.
  const shot = motherFight();
  standAt(shot, 150);
  shot.you.safeMs = 1e9;
  shot.boss.wait = 1e9;
  const m = put(shot, "leech", 160, { hag: true });
  bolt(shot, m, m.y + 0.9);
  bolt(shot, m, m.y + 0.9);
  shot.shots[1].x -= 3;
  run(shot, 200);
  assert.equal(bog.hagAdds(shot, "leech"), 0, "dispersed");
});

test("Old Mother Bog's stomp: a shadow where you stand, a leap and a slam there (a heart if you stayed), then a mud wave each way; out of the shadow and over the wave costs nothing", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  const lives = round.lives;
  force(round, "stomp", RAGED);
  assert.equal(b.act, "stompWind");
  const wind = events(round, "stompWind")[0];
  assert.ok(wind, "a wind-up to read");
  assert.ok(Math.abs(wind.landX - 150) <= 1, "the shadow is on you");
  run(round, bog.STOMP_WIND_MS * bog.MOTHER_QUICK + 10);
  assert.equal(b.act, "stompAir");
  assert.equal(events(round, "motherLeap").length, 1);
  until(round, () => losses(round).length > 0, 2000);
  assert.equal(losses(round)[0]?.cause, "motherbog", "landed on");
  assert.equal(round.lives, lives - 1);
  // Out of the shadow, then over the wave.
  const dodge = motherFight();
  standAt(dodge, 150);
  force(dodge, "stomp", RAGED);
  standAt(dodge, 185);
  const db = dodge.boss;
  until(dodge, () => events(dodge, "motherSlam").length > 0, 3000);
  assert.equal(db.x, db.landX, "down where the shadow was");
  assert.ok([-0.45, 0, 0.45].every((f) => ghoul.groundAt(dodge.spec, db.x + f * db.w) === db.y), "on the planks");
  assert.equal(dodge.waves.length, 0, "the waves wait a beat");
  hop(dodge, 1300, (r) => waveAt(r));
  const slams = events(dodge, "mudWave").filter((e) => e.slam);
  assert.deepEqual(slams.map((w) => w.dir).sort(), [-1, 1], "a wave each way");
  assert.equal(losses(dodge).length, 0, "a clean dodge costs nothing");
});

test("Old Mother Bog's tide: a long warning, then the water over every plank for TIDE_MS (a heart, drowned); a shelf keeps you dry and it drains away after", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  const lives = round.lives;
  force(round, "tide", RAGED);
  assert.equal(b.act, "tideWind");
  assert.equal(events(round, "tideWarn").length, 1, "a warning to read");
  const tide = round.hazards.find((h) => h.kind === "tide");
  assert.ok(tide && tide.warn > bog.TIDE_WARN_MS - 10 && tide.live === 0, "it warns first");
  run(round, bog.TIDE_WARN_MS - 40);
  assert.equal(losses(round).length, 0, "the warning does not hurt");
  run(round, 80);
  assert.equal(events(round, "tideRise").length, 1);
  assert.equal(losses(round)[0]?.cause, "tide", "drowned on the planks");
  assert.equal(round.lives, lives - 1);
  // On a shelf you stay dry the whole time, and it drains.
  for (const shelf of [0, 2]) {
    const dry = motherFight();
    const [x0, x1] = dry.spec.shelves[shelf];
    standAt(dry, (x0 + x1) / 2, shelf);
    force(dry, "tide", RAGED);
    run(dry, bog.TIDE_WARN_MS + bog.TIDE_MS + 60);
    assert.equal(losses(dry).length, 0, `shelf ${shelf} is dry`);
    assert.equal(dry.hazards.filter((h) => h.kind === "tide").length, 0, "the water is gone");
    assert.notEqual(dry.boss.act, "tideHold");
  }
  // Every spot on the arena's planks is near enough a shelf to reach in the warning.
  const spec = round.spec;
  const tops = spec.shelves.filter((s) => s[2] === 12);
  for (let x = spec.arena + ghoul.BOSS_LOCK + 2; x < spec.length - 2; x += 2) {
    if (!Number.isFinite(ghoul.groundAt(spec, x))) continue;
    const far = Math.min(...tops.map(([a, c]) => (x < a ? a + 1 - x : x > c ? x - c + 1 : 0)));
    assert.ok(far / ghoul.RUN_SPEED + 0.35 < bog.TIDE_WARN_MS / 1000, `a shelf within reach of ${x}`);
  }
});

test("Old Mother Bog's drowning pull: she stirs, then the water drags you along the planks toward her (a heart at her touch); running away, a shelf or the air beats it, and it never drags you off a plank's end", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  const lives = round.lives;
  force(round, "pull", RAGED);
  assert.equal(b.act, "pullWind");
  assert.equal(events(round, "pullWind").length, 1, "a wind-up to read");
  run(round, bog.PULL_WIND_MS * bog.MOTHER_QUICK - 30);
  assert.equal(round.you.x, 150, "nothing pulls during the stir");
  run(round, 40);
  assert.equal(b.act, "pull");
  assert.equal(events(round, "motherPull").length, 1);
  run(round, 400);
  assert.ok(round.you.x > 150 + 4, `dragged toward her (${round.you.x.toFixed(1)})`);
  until(round, () => losses(round).length > 0, 3000);
  assert.equal(losses(round)[0]?.cause, "motherbog");
  assert.equal(round.lives, lives - 1);
  // Running away from her beats it.
  const runner = motherFight();
  Object.assign(runner.boss, { x: 150 });
  standAt(runner, 172);
  force(runner, "pull", RAGED);
  run(runner, bog.PULL_WIND_MS + bog.PULL_MS + 40, { right: true });
  assert.equal(losses(runner).length, 0, "outrun");
  // A shelf is out of its reach.
  const shelf = motherFight();
  standAt(shelf, 166, 2);
  force(shelf, "pull", RAGED);
  run(shelf, bog.PULL_WIND_MS + 600);
  assert.equal(shelf.you.x, 166, "not moved on a shelf");
  // The boards hold you at a plank's end.
  const edge = motherFight();
  Object.assign(edge.boss, { x: 120 });
  standAt(edge, 142);
  edge.you.safeMs = 1e9;
  force(edge, "pull", RAGED);
  run(edge, bog.PULL_WIND_MS + bog.PULL_MS);
  assert.ok(edge.you.x >= 140 && edge.you.y === 6, `held on the plank (${edge.you.x.toFixed(1)})`);
});

test("Old Mother Bog calls the drowned: mud boils away from you and her, bog bodies climb out (harmless till up), never more than BODIES_CAP of hers alive", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  force(round, "drowned", RAGED);
  assert.equal(b.act, "callWind");
  const wind = events(round, "callWind")[0];
  assert.ok(wind && wind.xs.length === bog.BODIES_CAP, "a wind-up naming where they come");
  for (const x of wind.xs) {
    assert.ok(Math.abs(x - 150) >= 6 && Math.abs(x - b.x) >= b.w, `away from you and her (${x})`);
    assert.ok(Number.isFinite(ghoul.groundAt(round.spec, x)), "on a plank");
  }
  assert.equal(bog.hagAdds(round, "bogbody"), 0, "nothing yet");
  run(round, bog.CALL_WIND_MS * bog.MOTHER_QUICK + 10);
  assert.equal(events(round, "motherCall").length, 1);
  assert.equal(bog.hagAdds(round, "bogbody"), bog.BODIES_CAP);
  run(round, 20);
  assert.equal(events(round, "bogRise").length, bog.BODIES_CAP, "they climb out");
  assert.ok(round.monsters.every((m) => !ghoul.solid(m)), "harmless while they rise");
  force(round, "drowned", RAGED);
  assert.deepEqual(events(round, "callWind").at(-1).xs, [], "at the cap nothing boils");
  run(round, bog.CALL_WIND_MS + 10);
  assert.equal(bog.hagAdds(round, "bogbody"), bog.BODIES_CAP, "capped");
});

test("Old Mother Bog's wisp lantern, furious only: she raises it and two wisps of hers drift at you; a bolt puts one out for good, never more than WISPS_CAP", () => {
  const round = motherFight();
  const b = round.boss;
  standAt(round, 150);
  round.you.safeMs = 1e9;
  force(round, "wisps", FURY);
  assert.equal(b.act, "lanternWind");
  assert.equal(events(round, "lanternWind").length, 1, "a wind-up to read");
  run(round, bog.LANTERN_WIND_MS * bog.MOTHER_FURY + 10);
  assert.equal(events(round, "motherLantern").length, 1);
  assert.equal(bog.hagAdds(round, "wisp"), bog.WISPS_N);
  const w = round.monsters.find((m) => m.hag && m.kind === "wisp");
  bolt(round, w, w.y + w.h / 2);
  round.shots.at(-1).x = w.x - 0.5;
  run(round, 20);
  assert.equal(bog.hagAdds(round, "wisp"), bog.WISPS_N - 1, "one put out for good");
  force(round, "wisps", FURY);
  run(round, bog.LANTERN_WIND_MS + 10);
  force(round, "wisps", FURY);
  run(round, bog.LANTERN_WIND_MS + 10);
  assert.equal(bog.hagAdds(round, "wisp"), bog.WISPS_CAP, "capped");
});

test("Old Mother Bog's combo, furious only: a move that ends in an idle may go straight into the next after her eye flares, never twice running; calm she never does", () => {
  const low = () => 0.1;
  const MOVE = /Wind$|^tideWarn$|^motherSink$/;
  // Runs `ms`, noting when each combo and each move's telegraph came.
  const log = (round, ms) => {
    const out = [];
    for (let t = 0; t < ms; t += 4) {
      ghoul.advance(round, 4, low);
      for (const e of round.events) if (e.type === "motherCombo" || MOVE.test(e.type)) out.push([e.type, t]);
      round.events.length = 0;
    }
    return out;
  };
  const round = motherFight();
  standAt(round, 120);
  round.you.safeMs = 1e9;
  force(round, "hands", FURY);
  const seen = log(round, 6000);
  const i = seen.findIndex(([type]) => type === "motherCombo");
  assert.ok(i >= 0, "a combo");
  assert.ok(seen[i + 1] && MOVE.test(seen[i + 1][0]), "and straight into a move");
  assert.ok(seen[i + 1][1] - seen[i][1] <= bog.COMBO_GAP_MS + 8, `with only the short gap between (${seen[i + 1][1] - seen[i][1]} ms)`);
  const types = seen.map(([type]) => type);
  assert.ok(!types.some((t, j) => t === "motherCombo" && types[j + 2] === "motherCombo"), "never two combos running");
  const calm = motherFight();
  standAt(calm, 120);
  calm.you.safeMs = 1e9;
  force(calm, "hands");
  assert.equal(log(calm, 6000).filter(([type]) => type === "motherCombo").length, 0, "calm, never");
});

test("Old Mother Bog's phases: the moves she uses change at half and a quarter of her hp, and a long fight goes through them all", () => {
  const round = motherFight();
  const b = round.boss;
  round.infinite = true;
  let seed = 3;
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const seen = [new Set(), new Set(), new Set()];
  for (let t = 0; t < 150000 && b.state === "fight"; t += 4) {
    round.you.safeMs = 1e9;
    // Her hp falls steadily, so every phase gets its turn.
    if (t % 400 === 0 && b.hp > 1 && !b.hidden && b.act !== "shell") b.hp -= 1;
    const before = b.picks || 0;
    ghoul.advance(round, 4, random);
    if ((b.picks || 0) > before) seen[bog.phaseOf(b)].add(b.last);
    round.events.length = 0;
  }
  for (const m of ["stomp", "tide", "pull", "drowned", "wisps"]) assert.equal(seen[0].has(m), false, `no ${m} at full health`);
  assert.equal(seen[1].has("wisps"), false, "no wisps before she is furious");
  assert.ok(["stomp", "tide", "pull", "drowned"].filter((m) => seen[1].has(m) || seen[2].has(m)).length >= 3, `the second phase's moves (${[...seen[1]]})`);
  assert.ok(seen[0].size >= 5 && seen[1].size >= 6, `a varied fight (${[...seen[0]]} / ${[...seen[1]]} / ${[...seen[2]]})`);
});

/* ------------------------------------------------------ the whole fight */

// A player who plays the fight sensibly: keeps a fair distance facing her,
// fires in bursts that keep the blaster cool, steps off ripples, shadows and
// muck, jumps waves and her charge, climbs a shelf for the tide and the pull,
// and hops a leech rather than walking into it.
function skilledKeys(round, mem) {
  const you = round.you;
  const b = round.boss;
  const spec = round.spec;
  const k = { left: false, right: false, fire: false, down: false, jump: false };
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const onGround = you.state === "run" && you.shelf < 0;
  const lo = spec.arena + ghoul.BOSS_LOCK + 2;
  const hi = spec.length - 3;
  let goal = null;
  const climb = () => {
    if (you.shelf >= 0) {
      const s = spec.shelves[you.shelf];
      goal = clamp(you.x, s[0] + 1.5, s[1] - 1.5);
      return;
    }
    const tops = spec.shelves.filter((s) => s[2] === 12);
    const s = tops.reduce((a, c) => (Math.abs((c[0] + c[1]) / 2 - you.x) < Math.abs((a[0] + a[1]) / 2 - you.x) ? c : a));
    goal = (s[0] + s[1]) / 2;
    if (onGround && you.x > s[0] + 1 && you.x < s[1] - 1) k.jump = true;
  };
  const danger = (x) => {
    for (const h of round.hazards) {
      if (h.kind === "muck" && (h.live > 0 || h.warn < 500) && Math.abs(x - h.x) < (h.w + ghoul.HIT_W) / 2 + 0.6) return true;
      if (h.kind === "boghand" && Math.abs(x - h.x) < (h.w + ghoul.HIT_W) / 2 + 0.6) return true;
    }
    if ((b.act === "stompWind" || b.act === "stompAir") && Math.abs(x - b.landX) < (b.w + ghoul.HIT_W) / 2 + 2) return true;
    if (!b.hidden && b.act !== "stompAir" && Math.abs(x - b.x) < (b.w + ghoul.HIT_W) / 2 + 1.5) return true;
    return !Number.isFinite(ghoul.groundAt(spec, x));
  };
  if (b && b.state === "fight") {
    const side = Math.sign(you.x - b.x) || 1;
    goal = clamp(b.x + side * 15, lo, hi);
    if (Math.abs(goal - b.x) < 10) goal = clamp(b.x - side * 15, lo, hi);
    if (round.hazards.some((h) => h.kind === "tide") || b.act === "pull" || b.act === "pullWind") climb();
    else if (danger(you.x) && onGround) {
      for (let d = 0.5; d < 16; d += 0.5) {
        const c = [you.x + d, you.x - d].find((x) => x > lo && x < hi && !danger(x));
        if (c !== undefined) {
          goal = c;
          break;
        }
      }
    } else if (danger(goal)) goal = you.x;
    for (const w of round.waves) {
      const d = (you.x - w.x) * w.dir;
      if (onGround && d > 0 && d < 7.5 && Math.abs(w.y - you.y) < 1) k.jump = true;
    }
    if (b.act === "surge" || b.act === "surgeWind") goal = you.x;
    if (b.act === "surge") {
      const d = (you.x - b.x) * Math.sign(b.surgeTo - b.x) - b.w / 2 - ghoul.HIT_W / 2;
      if (onGround && d > -1 && d < 7.5) k.jump = true;
    }
    for (const m of round.monsters) if (m.kind === "leech" && onGround && Math.abs(m.x - you.x) < 4.5 && Math.abs(m.y - you.y) < 2) k.jump = true;
  }
  if (goal !== null && Math.abs(goal - you.x) > 0.6) {
    const dir = goal > you.x ? 1 : -1;
    dir > 0 ? (k.right = true) : (k.left = true);
    if (onGround && !Number.isFinite(ghoul.groundAt(spec, you.x + dir * 2.2))) k.jump = true;
  } else if (b && b.state === "fight") {
    const want = Math.sign(b.x - you.x) || 1;
    if (you.face !== want) want > 0 ? (k.right = true) : (k.left = true);
  }
  // Up where bolts fly over her head (and no tide to wait out): drop down.
  const tide = round.hazards.some((h) => h.kind === "tide");
  if (b && b.state === "fight" && you.state === "run" && you.shelf >= 0 && !tide && b.act !== "pull" && you.y + ghoul.SHOT_Y > b.y + b.h - 0.5) {
    k.left = false;
    k.right = false;
    k.down = true;
  }
  if (mem.cool && round.heat < 4) mem.cool = false;
  if (!mem.cool && round.heat >= 28) mem.cool = true;
  k.fire = !mem.cool;
  return k;
}

// The whole fight from the arena door, real hearts and a seeded draw: how long
// it took (seconds from the fight's start) and how it went.
function wholeFight(keys, seed) {
  const round = bogRound("drowning");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  const random = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const mem = {};
  let start = -1;
  const causes = [];
  let t = 0;
  for (; t < 240000 && !round.over; t += 4) {
    // No Lucky dice: a die picked up off an add would stop the round to ask.
    round.dice = 0;
    const k = keys(round, mem);
    Object.assign(round.input, { left: k.left, right: k.right, fire: k.fire, down: k.down });
    if (k.jump && round.input.jump <= 0) round.input.jump = ghoul.JUMP_BUFFER_MS;
    ghoul.advance(round, 4, random);
    for (const e of round.events) {
      if (e.type === "bossGo" && start < 0) start = t;
      if (e.type === "lose") causes.push(e.cause);
    }
    const down = round.events.some((e) => e.type === "bossDown");
    round.events.length = 0;
    if (down) return { won: true, secs: (t - start) / 1000, causes, round };
  }
  return { won: false, secs: (t - start) / 1000, causes, round };
}

test("Old Mother Bog takes a skilled player a real fight: a bot that plays sensibly kills her in 60 to 120 seconds on every seed, losing a heart or a few, never all", () => {
  const times = [];
  for (const seed of [7, 11, 23, 71]) {
    const fight = wholeFight(skilledKeys, seed);
    assert.ok(fight.won, `seed ${seed}: she fell (${fight.causes}; ${fight.secs.toFixed(1)} s, ${fight.round.lives} lives, phase ${fight.round.phase}, hp ${fight.round.boss?.hp})`);
    assert.ok(fight.secs >= 60 && fight.secs <= 120, `seed ${seed}: ${fight.secs.toFixed(1)} s of fight`);
    assert.ok(fight.round.lives > 0, "with hearts to spare");
    const known = new Set([...Object.keys(LOSE_WORDS), "pit", "zombie", "crawler"]);
    for (const c of fight.causes) assert.ok(known.has(c), `${c} has words`);
    times.push(fight.secs);
  }
  assert.ok(Math.max(...times) - Math.min(...times) > 3, `not the same fight every time (${times.map((t) => t.toFixed(1))})`);
});

test("Old Mother Bog kills a player who stands still: an idle bot loses every heart while she is barely scratched", () => {
  const fight = wholeFight(() => ({}), 7);
  assert.equal(fight.won, false);
  assert.ok(fight.round.over, "game over");
  assert.ok(fight.round.boss.hp > fight.round.boss.max * 0.9, "she is barely scratched");
  assert.ok(fight.secs < 120, `down in ${fight.secs.toFixed(1)} s`);
  assert.ok(new Set(fight.causes).size >= 2, `by more than one move (${fight.causes})`);
});

/* ------------------------------------------------------ voices, words, cards */

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react(e, kit);
  return played;
};

test("Ghoul Rush's bog: every new kind has a voice for every act, every new event plays exactly one picked sound, and the tones are the stage's own", () => {
  const own = { lurker: ["appear", "snap", "sink", "hurt", "die"], leech: ["appear", "latch", "hurt", "die"], wisp: ["appear", "out", "relight", "on", "hurt", "die"], bogbody: ["appear", "rise", "hurt", "die"], motherbog: ["wake", "wind", "wave", "spitWind", "spit", "open", "sink", "bubble", "rise", "muck", "hurt", "weak", "die", "handsWind", "handsUp", "surgeWind", "surge", "shellWind", "chip", "shellBreak", "feed", "broodWind", "pour", "stompWind", "leap", "slam", "tideWarn", "tide", "pullWind", "pull", "callWind", "call", "lanternWind", "lantern", "combo"] };
  assert.deepEqual(Object.keys(VOICES).sort(), Object.keys(own).sort(), "a voice table for each new kind and the boss");
  for (const [kind, acts] of Object.entries(own)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const names = Object.values(VOICES).flatMap((v) => Object.values(v));
  const at = { x: 10, y: 6, tx: 20, ty: 6 };
  const cases = [
    [{ type: "lurkerSnap", kind: "lurker" }, "lurker", "snap"],
    [{ type: "lurkerSink", kind: "lurker" }, "lurker", "sink"],
    [{ type: "leechLatch", kind: "leech" }, "leech", "latch"],
    [{ type: "bogRise", kind: "bogbody" }, "bogbody", "rise"],
    [{ type: "wispOut", kind: "wisp" }, "wisp", "out"],
    [{ type: "wispRelight", kind: "wisp" }, "wisp", "relight"],
    [{ type: "wispOn", kind: "wisp" }, "wisp", "on"],
    [{ type: "motherWind", kind: "motherbog" }, "motherbog", "wind"],
    [{ type: "mudWave", kind: "motherbog" }, "motherbog", "wave"],
    [{ type: "spitWind", kind: "motherbog" }, "motherbog", "spitWind"],
    [{ type: "cauldronSpit", kind: "motherbog" }, "motherbog", "spit"],
    [{ type: "cauldronOpen", kind: "motherbog" }, "motherbog", "open"],
    [{ type: "muckLand" }, "motherbog", "muck"],
    [{ type: "motherSink", kind: "motherbog" }, "motherbog", "sink"],
    [{ type: "motherBubble", kind: "motherbog" }, "motherbog", "bubble"],
    [{ type: "motherRise", kind: "motherbog" }, "motherbog", "rise"],
    [{ type: "handsWind", kind: "motherbog", xs: [12, 19] }, "motherbog", "handsWind"],
    [{ type: "handsUp", kind: "motherbog" }, "motherbog", "handsUp"],
    [{ type: "surgeWind", kind: "motherbog" }, "motherbog", "surgeWind"],
    [{ type: "motherSurge", kind: "motherbog" }, "motherbog", "surge"],
    [{ type: "shellWind", kind: "motherbog" }, "motherbog", "shellWind"],
    [{ type: "shellChip", kind: "motherbog" }, "motherbog", "chip"],
    [{ type: "shellBreak", kind: "motherbog" }, "motherbog", "shellBreak"],
    [{ type: "motherFeed", kind: "motherbog", heal: 14 }, "motherbog", "feed"],
    [{ type: "broodWind", kind: "motherbog" }, "motherbog", "broodWind"],
    [{ type: "broodPour", kind: "motherbog", n: 2 }, "motherbog", "pour"],
    [{ type: "stompWind", kind: "motherbog", landX: 14 }, "motherbog", "stompWind"],
    [{ type: "motherLeap", kind: "motherbog" }, "motherbog", "leap"],
    [{ type: "motherSlam", kind: "motherbog" }, "motherbog", "slam"],
    [{ type: "tideWarn", kind: "motherbog" }, "motherbog", "tideWarn"],
    [{ type: "tideRise", kind: "motherbog" }, "motherbog", "tide"],
    [{ type: "pullWind", kind: "motherbog" }, "motherbog", "pullWind"],
    [{ type: "motherPull", kind: "motherbog" }, "motherbog", "pull"],
    [{ type: "callWind", kind: "motherbog", xs: [12, 30] }, "motherbog", "callWind"],
    [{ type: "motherCall", kind: "motherbog", xs: [12, 30] }, "motherbog", "call"],
    [{ type: "lanternWind", kind: "motherbog" }, "motherbog", "lanternWind"],
    [{ type: "motherLantern", kind: "motherbog", n: 2 }, "motherbog", "lantern"],
    [{ type: "motherCombo", kind: "motherbog" }, "motherbog", "combo"],
    [{ type: "bossWake", kind: "motherbog" }, "motherbog", "wake"],
    [{ type: "bossHit", kind: "motherbog", how: "shot" }, "motherbog", "hurt"],
    [{ type: "bossHit", kind: "motherbog", how: "weak", weak: true }, "motherbog", "weak"],
    [{ type: "bossDown", kind: "motherbog", points: 1 }, "motherbog", "die"],
    [{ type: "hit", kind: "lurker" }, "lurker", "hurt"],
    [{ type: "hit", kind: "leech" }, "leech", "hurt"],
    [{ type: "hit", kind: "wisp" }, "wisp", "hurt"],
    [{ type: "hit", kind: "bogbody" }, "bogbody", "hurt"],
    [{ type: "kill", kind: "lurker", mult: 1, how: "shot", points: 1 }, "lurker", "die"],
    [{ type: "kill", kind: "leech", mult: 1, how: "shot", points: 1 }, "leech", "die"],
    [{ type: "kill", kind: "wisp", mult: 1, how: "shot", points: 1 }, "wisp", "die"],
    [{ type: "kill", kind: "bogbody", mult: 1, how: "shot", points: 1 }, "bogbody", "die"],
    [{ type: "spawn", kind: "lurker" }, "lurker", "appear"],
    [{ type: "spawn", kind: "leech" }, "leech", "appear"],
    [{ type: "spawn", kind: "wisp" }, "wisp", "appear"],
    [{ type: "spawn", kind: "bogbody" }, "bogbody", "appear"],
  ];
  for (const [e, kind, act] of cases) assert.ok(heard({ ...at, ...e }).includes(VOICES[kind][act]), `${e.type}: ${kind} ${act}`);
  const reached = new Set(cases.map(([, kind, act]) => `${kind}.${act}`));
  for (const [kind, acts] of Object.entries(own)) for (const act of acts) assert.ok(reached.has(`${kind}.${act}`), `${kind}.${act} is reached by an event`);
  for (const e of cases.map((c) => c[0])) {
    const picked = heard({ ...at, ...e }).filter((n) => names.includes(n));
    assert.equal(picked.length, 1, `${e.type}${e.kind ? ` (${e.kind})` : ""} plays exactly one picked sound`);
  }
  const weakHit = heard({ ...at, type: "bossHit", kind: "motherbog", how: "weak", weak: true });
  assert.equal(weakHit.includes(VOICES.motherbog.hurt), false, "weak replaces hurt");
  assert.equal(heard({ ...at, type: "bossHit", kind: "motherbog", how: "shot" }).includes(VOICES.motherbog.weak), false, "a plain shot is not weak");
  // Events that are only looks (the pull of the lure, a swarm coming apart) say nothing the voices own.
  for (const type of ["wispLure", "leechDie"]) assert.equal(heard({ ...at, type, kind: "leech" }).filter((n) => names.includes(n)).length, 0, `${type} is visual`);
  // Every event the hag's rules raise is one of the cases above (so none is left without a voice).
  const raised = new Set();
  const src = readFileSync(new URL("../src/web-console/public/activities/ghoul-rush/stages/bog/ghoul-bog.js", import.meta.url), "utf8");
  for (const [, type] of src.matchAll(/type: "([a-zA-Z]+)"/g)) raised.add(type);
  for (const [, type] of src.matchAll(/ev\("([a-zA-Z]+)"/g)) raised.add(type);
  const covered = new Set([...cases.map(([e]) => e.type), "wispLure", "leechDie", "harpoonHit"]);
  for (const type of raised) assert.ok(covered.has(type), `${type} has a reaction checked here`);
  // Every picked tone exists in the merged tones, lives in the stage's file, is short and is named by kind and act.
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(VOICES)) {
    for (const [act, name] of Object.entries(acts)) {
      assert.ok(merged[name]?.layers?.length, `${kind}.${act}: ${name} is in the merged tones`);
      assert.ok(BOG_SFX.tones[name], `${name} lives in ghoul-sfx-bog.js`);
      for (const l of BOG_SFX.tones[name].layers) assert.ok(l.seconds > 0 && l.seconds + (l.delay || 0) <= 1.2 + 1e-9, `${name} is over within 1.2 s`);
      assert.equal(name, `ghoul${kind === "motherbog" ? "Mother" : kind[0].toUpperCase() + kind.slice(1)}${act[0].toUpperCase()}${act.slice(1)}`, "named by kind and act");
    }
  }
});

test("Ghoul Rush's bog: every new way to die has its words and its own sound, and endless lives spare the heart for each", () => {
  const causes = ["lurker", "leeches", "wisp", "bogbody", "mudwave", "muck", "boghand", "tide", "motherbog"];
  assert.deepEqual(Object.keys(LOSE_WORDS).sort(), [...causes].sort(), "words for exactly these");
  assert.deepEqual(Object.keys(LOSE_SOUNDS).sort(), [...causes].sort(), "a sound for exactly these");
  for (const cause of causes) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ x: 10, y: 6, type: "lose", cause, lives: 2 }).includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
    const round = motherFight();
    round.infinite = true;
    const lives = round.lives;
    ghoul.lose(round, cause);
    assert.equal(round.lives, lives, `${cause} costs none`);
    const normal = motherFight();
    const had = normal.lives;
    ghoul.lose(normal, cause);
    assert.equal(normal.lives, had - 1, `${cause} costs a heart otherwise`);
  }
  // The real causes the stage raises are all among them.
  for (const cause of ["leeches", "mudwave", "muck", "boghand", "tide", "motherbog"]) assert.ok(LOSE_WORDS[cause]);
  assert.equal(bog.BOG.cause.motherbog(), "motherbog");
});

test("Ghoul Rush's bog cards: the stage card names the stage, boss and no em dash, the boss card names Old Mother Bog, and both agree", () => {
  const card = INTROS.bog;
  assert.equal(card.title, "Gallows Bog");
  assert.equal(card.boss, "Old Mother Bog");
  assert.ok(card.lines.length >= 3 && card.lines.length <= 4);
  assert.equal(card.kicker, ghoul.stageById("bog").sub, "the card's kicker is the stage's subtitle");
  assert.ok(card.lines.some((l) => /YOU/.test(l)) && !card.lines.some((l) => /Planny/.test(l)), "addressed to YOU, never the hero's name");
  assert.ok(![card.title, card.kicker, card.boss, ...card.lines].some((t) => t.includes("\u2014")), "no em dash");
  const boss = BOSS_INTROS.motherbog;
  assert.equal(boss.name, "Old Mother Bog");
  assert.equal(boss.name, card.boss, "the two cards agree on the name");
  assert.ok(boss.epithet && !boss.epithet.includes("\u2014") && !/Planny/.test(boss.epithet));
  assert.equal(bossIntroFor("motherbog"), boss);
  assert.equal(introFor("bog"), card);
});

/* ------------------------------------------------------ round flow */

test("Ghoul Rush's bog round flow: the stage card opens before the Sunken Boardwalk, the hag's card before the Drowning Pool (after the ride), and neither shows on a retry", () => {
  const r = ghoul.newRound(5);
  r.dice = 0;
  through(r);
  r.offer = ["bog"];
  r.phaseMs = 0;
  assert.equal(ghoul.pickStage(r, 0), true);
  assert.equal(r.stage, "bog");
  assert.equal(r.spec.id, "boardwalk");
  assert.equal(r.phase, "intro", "the stage card first");
  assert.deepEqual(r.events.filter((e) => e.type === "intro").map((e) => e.stage), ["bog"]);
  assert.equal(r.events.some((e) => e.type === "room"), false, "the room waits for the card");
  r.introMs = ghoul.INTRO_MIN_MS;
  assert.equal(ghoul.takeIntro(r), true);
  assert.equal(r.phase, "ready");
  ghoul.advance(r, ghoul.READY_MS + 20, steady);
  assert.equal(r.phase, "play");
  for (const id of ["hollow", "stilts", "lantern"]) {
    r.events.length = 0;
    through(r);
    assert.equal(r.spec.id, id);
    assert.notEqual(r.phase, "bossintro", `${id}: no boss card`);
    assert.equal(r.events.some((e) => e.type === "bossIntro"), false);
  }
  assert.ok(ghoul.roomById("lantern").bonus, "the bonus round comes right before the boss");
  r.events.length = 0;
  through(r);
  assert.equal(r.spec.id, "drowning");
  assert.equal(r.phase, "bossintro", "the boss card");
  assert.deepEqual(r.events.filter((e) => e.type === "bossIntro").map((e) => [e.boss, e.stage]), [["motherbog", "bog"]]);
  assert.equal(r.boss.kind, "motherbog");
  assert.equal(r.boss.state, "sleep", "she sleeps behind the card");
  r.introMs = ghoul.INTRO_MIN_MS;
  assert.equal(ghoul.takeIntro(r), true);
  assert.equal(r.phase, "ready");
  ghoul.advance(r, ghoul.READY_MS + 20, steady);
  assert.equal(r.phase, "play");
  // Into the pool, the fight starts; a life lost there goes back without the card.
  r.events.length = 0;
  standAt(r, r.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(r, 4, steady);
  ghoul.advance(r, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(r.boss.state, "fight");
  ghoul.lose(r, "motherbog");
  for (let t = 0; t < 6000 && r.phase !== "play" && !r.over; t += 4) ghoul.advance(r, 4, steady);
  assert.notEqual(r.phase, "bossintro", "no card on a retry");
  assert.equal(r.events.some((e) => e.type === "bossIntro"), false, "no card event on a retry");
});

test("Ghoul Rush's bog draws: every walked room and the arena, every monster in every act, the hag in each move above and under the water, the mud wave and the muck, in a lit room and a dark one", () => {
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
  const acts = { lurker: ["eyes", "snap", "sink"], leech: ["drift", "drop"], wisp: ["bright", "dim", "rekindle"], bogbody: ["rise", "walk"] };
  let drew = 0;
  for (const id of ["boardwalk", "hollow", "stilts", "drowning"]) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      r.dark = dark;
      r.phase = "play";
      r.lives = 99;
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      standAt(r, id === "drowning" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
      r.you.safeMs = 1e9;
      for (const [kind, list] of Object.entries(acts)) list.forEach((act, i) => put(r, kind, r.you.x + 6 + i * 5, { act, wait: 300, rise: act === "rise" ? 300 : 0, y: kind === "wisp" ? 12 : undefined }));
      r.monsters.at(-1).lurching = true;
      if (r.boss) {
        ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
        for (const hidden of [false, true]) {
          for (const act of ["idle", "wind", "rest", "throwWind", "sink", "under", "resurface", "hands", "surgeWind", "surge", "shellWind", "shell", "stagger", "broodWind", "stompWind", "stompAir", "tideWind", "tideHold", "pullWind", "pull", "callWind", "lanternWind"]) {
            Object.assign(r.boss, { act, wait: 400, dir: -1, lit: act === "rest" || act === "stagger", hidden: hidden && (act === "sink" || act === "under"), sinkX: r.boss.x - 10, home: 6, floor: 6, y: act === "surge" ? 6 - bog.SURGE_SINK : act === "stompAir" ? 14 : 6, landX: r.boss.x - 12, airMs: 300, callXs: [r.boss.x - 12, r.boss.x - 24], shell: 5, shellMax: bog.SHELL_HP[0], comboMs: hidden ? 200 : 0 });
            g.tick(16);
            drew++;
          }
          Object.assign(r.boss, { y: 6, comboMs: 0 });
        }
        Object.assign(r.boss, { hidden: false, act: "rest", wait: 1e9 });
        r.hazards.push({ kind: "muck", x: r.you.x + 10, y: 6, w: bog.MUCK_W, h: bog.MUCK_H, warn: 400, live: 0, cause: "muck", sx: r.boss.x, sy: 9 }, { kind: "muck", x: r.you.x + 20, y: 6, w: bog.MUCK_W, h: bog.MUCK_H, warn: 0, live: 1500, cause: "muck" });
        r.waves.push({ x: r.you.x + 8, y: 6, dir: -1, life: 6000, kind: "mudwave", cause: "mudwave" });
        r.hazards.push({ kind: "boghand", x: r.you.x + 14, y: 6, w: bog.HAND_W, h: bog.HAND_H, warn: 500, full: 1200, live: 0, cause: "boghand" }, { kind: "boghand", x: r.you.x + 18, y: 6, w: bog.HAND_W, h: bog.HAND_H, warn: 0, live: 300, cause: "boghand" });
        r.hazards.push({ kind: "tide", x: 152, y: 5, w: 104, h: 1.6, x0: 104, x1: 200, warn: 600, live: 0, cause: "tide" }, { kind: "tide", x: 152, y: 5, w: 104, h: 1.6, x0: 104, x1: 200, warn: 0, live: 2000, cause: "tide" });
      }
      for (let k = 0; k < 20; k++) g.tick(16);
      r.you.safeMs = 1e9;
      drew++;
    }
  }
  assert.ok(drew >= 8 + 44, "drew a lot");
  assert.equal(r.spec.id, "drowning", "got to the pool and drew it");
});

test("Ghoul Rush's bog: a seeded bot, shielded and with endless lives, plays the Sunken Boardwalk on a draw that throws if the bog's own rules ask for a random number, and any life it loses is for a cause the stage names", () => {
  // The engine rolls dice of its own (power-up drops, horde edges, variants), so the draw is a steady one that throws only when the call came out of the bog's pack file.
  const boom = () => {
    Error.stackTraceLimit = 20;
    const stack = new Error().stack;
    if (stack.includes("ghoul-bog.js")) throw new Error(`the bog pack drew a random number: ${stack}`);
    return 0.5;
  };
  let seed = 7;
  const next = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const causes = new Set();
  const round = ghoul.newRound(5);
  round.dice = 0;
  round.infinite = true;
  through(round);
  round.offer = ["bog"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  round.introMs = ghoul.INTRO_MIN_MS;
  ghoul.takeIntro(round);
  ghoul.advance(round, ghoul.READY_MS + 20, steady);
  assert.equal(round.phase, "play");
  assert.equal(round.spec.id, "boardwalk");
  round.hasKey = true;
  round.effects.boots = 1e9;
  let far = 0;
  let wake = 0;
  // Walking right, firing, jumping at a gap or a step and now and then at nothing: a bot with no sense of the lurkers, the leeches or the lights.
  for (let t = 0; t < 90000 && !round.over; t += 4) {
    const you = round.you;
    you.safeMs = 1e9;
    const ahead = ghoul.groundAt(round.spec, you.x + 3);
    round.input.right = true;
    round.input.fire = true;
    if (!Number.isFinite(ahead) || ahead > you.y + 0.4 || next() < 0.02) round.input.jump = ghoul.JUMP_BUFFER_MS;
    ghoul.advance(round, 4, boom);
    for (const e of round.events) {
      if (e.type === "lose") causes.add(e.cause);
      if (/^(lurkerSnap|leechLatch|wispLure|wispOut|bogRise)$/.test(e.type)) wake++;
    }
    round.events.length = 0;
    far = Math.max(far, you.x);
    assert.ok(Number.isFinite(you.x), "the player stays on the map");
    if (round.phase === "clear") break;
  }
  assert.ok(far > 150, `the bot got well into the room (${far.toFixed(0)} of ${round.spec.length})`);
  assert.ok(wake > 0, "the stage's monsters woke and acted around it");
  assert.equal(round.lives, ghoul.newRound(5).lives, "endless lives: not one heart spent");
  const known = new Set([...Object.keys(LOSE_WORDS), "pit"]);
  for (const cause of causes) assert.ok(known.has(cause), `${cause} has words`);
});
