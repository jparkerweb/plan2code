// Web console tests, Ghoul Rush's Grounds stage: its four rooms, topiary beasts that creep only when your back is turned, rootlings under the lawn, lantern moths, mulch crawlers, the Hedge shears (found only here), and the Groundskeeper, whose lantern takes triple damage, whose scythe is jumped, whose fire burns the floor and who mounts a mower at half his hp.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import * as gr from "../src/web-console/public/activities/ghoul-grounds.js";
import { LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-grounds-draw.js";
import { PILL_WORDS } from "../src/web-console/public/activities/ghoul-powers.js";
import { pickPower } from "../src/web-console/public/activities/ghoul-powers.js";
import * as sfxGrounds from "../src/web-console/public/activities/ghoul-sfx-grounds.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";
import { VOICES, react } from "../src/web-console/public/activities/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Grounds' room `id`, reached the way play reaches it,
// nothing woken: every spawner spent, the horde held back.
function groundsRound(id) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["grounds"];
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

function standAt(round, x, face = 1) {
  Object.assign(round.you, { x, y: ghoul.groundAt(round.spec, x), vx: 0, vy: 0, state: "run", shelf: -1, coyote: 0, drop: -1, out: 0, safeMs: 0, face });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

const put = (round, kind, x, over = {}) => ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), { rise: 0, ...over });

function run(round, ms, keys = {}) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, steady);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

// Runs until `done()` (or `ms` have passed), 4 ms at a time.
function until(round, done, ms = 4000) {
  for (let t = 0; t < ms && !done(); t += 4) ghoul.advance(round, 4, steady);
}

// A bolt arriving from the left at height `y` on the monster `m`.
const bolt = (round, m, y) => round.shots.push({ x: m.x - m.w / 2 - 0.3, y, vx: 80, vy: 0, gone: 0 });

test("Ghoul Rush's Grounds is a stage of three rooms, a bonus ride and the Groundskeeper's, its monsters and boss joined to the game's, with shears and a place for each kind", () => {
  const st = ghoul.stageById("grounds");
  assert.deepEqual(st.rooms, ["maze", "topiary", "gazebo", "mower", "yard"]);
  assert.equal(st.boss, "keeper");
  for (const kind of Object.keys(gr.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], gr.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.BOSSES.keeper, gr.BOSSES.keeper);
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const [maze, garden, gazebo, mower, yard] = st.rooms.map((id) => ghoul.roomById(id));
  // The Gardener's Revenge, the bonus ride before the boss, has its own suite (ghoul-mower).
  assert.equal(mower.bonus, true);
  assert.equal(mower.id, "mower");
  for (const room of [maze, garden, gazebo]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    assert.ok(room.items.some((i) => i[0] === "shears"), `${room.id}: Hedge shears`);
    assert.ok(room.spawns.some((s) => s[0] in gr.MONSTERS), `${room.id}: some of the new monsters`);
  }
  assert.equal(yard.boss, "keeper");
  assert.equal(yard.horde.length, 0);
  assert.ok(yard.shelves.length >= 3, "shelves to jump onto");
  // They get harder in order: more haunting, a quicker horde.
  assert.ok(maze.spawns.length <= garden.spawns.length && garden.spawns.length <= gazebo.spawns.length);
  assert.ok(maze.hordeMs > garden.hordeMs && garden.hordeMs > gazebo.hordeMs);
  // The maze's hedges are walls to jump.
  assert.ok(maze.ground.some((p, i) => i && p[2] - maze.ground[i - 1][2] > ghoul.STEP_UP), "a hedge higher than a step");
});

test("Ghoul Rush's topiary beast stands frozen while you face it and charges the moment your back is turned, saying so", () => {
  const round = groundsRound("maze");
  standAt(round, 30, 1);
  round.you.safeMs = 1e9;
  const m = put(round, "topiary", 60);
  assert.equal(m.act, "still");
  assert.equal(ghoul.solid(m), true, "a frozen hedge still hurts");
  run(round, 400);
  assert.equal(m.x, 60, "facing it, it never moves");
  assert.equal(events(round, "rustle").length, 0);
  round.you.face = -1;
  run(round, 400);
  assert.equal(m.act, "creep");
  assert.equal(events(round, "rustle").length, 1);
  assert.ok(m.x < 60 - 5, `it charged (${m.x.toFixed(1)})`);
  assert.ok(m.x > 60 - 0.4 * gr.MONSTERS.topiary.speed * 1.5, "at its own speed");
  round.you.face = 1;
  run(round, 8);
  assert.equal(m.act, "still");
  assert.equal(events(round, "freeze").length, 1);
  const stopped = m.x;
  run(round, 300);
  assert.equal(m.x, stopped);
  // Far away it stays put even with your back turned; it is no stomp either.
  const far = groundsRound("maze");
  standAt(far, 10, -1);
  const f = put(far, "topiary", 10 + gr.TOPIARY_NEAR + 20);
  run(far, 300);
  assert.equal(f.act, "still");
  assert.equal(ghoul.MONSTERS.topiary.stomp, false);
  // Right under you it stops rather than flipping about.
  const under = groundsRound("maze");
  standAt(under, 20, -1);
  under.you.safeMs = 1e9;
  const u = put(under, "topiary", 20 + ghoul.UNDER_DX / 2);
  run(under, 200);
  assert.ok(Math.abs(u.x - (20 + ghoul.UNDER_DX / 2)) < 0.01);
});

test("Ghoul Rush's topiary beast is only ever hit while you face it: a bolt goes the way you face", () => {
  const round = groundsRound("maze");
  standAt(round, 30, 1);
  round.you.safeMs = 1e9;
  const m = put(round, "topiary", 50);
  round.input.fire = true;
  run(round, 400);
  assert.ok(m.hp < m.max, "shot while frozen");
  assert.equal(m.act, "still");
  assert.equal(m.x, 50);
});

test("Ghoul Rush's rootling is a crack running after you under the lawn, which warns where a root will come up, bursts up (solid, hurting, shot or stomped for a while), sinks and tracks again", () => {
  const round = groundsRound("topiary");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const r = put(round, "rootling", 20 + gr.ROOT_NEAR - 4);
  assert.equal(r.act, "trail");
  assert.equal(ghoul.solid(r), false, "not solid while under");
  const x0 = r.x;
  run(round, 400);
  assert.ok(r.x < x0 - 4, `the crack runs toward you (${x0} to ${r.x.toFixed(1)})`);
  assert.equal(r.act, "trail");
  // It stops tracking and warns, then comes up where it stopped.
  until(round, () => r.act === "warn");
  assert.equal(r.act, "warn");
  assert.equal(events(round, "rootWarn").length, 1);
  const at = r.x;
  run(round, gr.ROOT_WARN_MS - 40);
  assert.equal(r.x, at, "the warning does not follow you");
  assert.equal(ghoul.solid(r), false);
  run(round, 80);
  assert.equal(r.act, "up");
  assert.equal(events(round, "rootUp").length, 1);
  assert.equal(ghoul.solid(r), true);
  run(round, gr.ROOT_UP_MS + 40);
  assert.equal(r.act, "sink");
  assert.equal(ghoul.solid(r), false);
  run(round, gr.ROOT_SINK_MS + 40);
  assert.ok(["trail", "warn"].includes(r.act) && events(round, "rootWarn").length >= 2, "and round again");
  // Far away on its floor, it lies still.
  const far = groundsRound("topiary");
  standAt(far, 10);
  const f = put(far, "rootling", 10 + gr.ROOT_NEAR + 10);
  run(far, 500);
  assert.equal(f.x, 10 + gr.ROOT_NEAR + 10);
  // A root that is up hurts, can be stomped, and dies to a bolt.
  const hurt = groundsRound("topiary");
  standAt(hurt, 30);
  const up = put(hurt, "rootling", 30, { act: "up", wait: gr.ROOT_UP_MS });
  run(hurt, 20);
  assert.equal(events(hurt, "lose")[0]?.cause, "rootling");
  assert.equal(ghoul.MONSTERS.rootling.stomp, true);
  assert.ok(up);
  const shot = groundsRound("topiary");
  standAt(shot, 30);
  const t = put(shot, "rootling", 50, { act: "up", wait: 1e9 });
  for (let k = 0; k < t.max; k++) bolt(shot, t, t.y + 2);
  ghoul.advance(shot, 4, steady);
  assert.ok(t.hp < t.max, "a bolt hurts it");
});

test("Ghoul Rush's lantern moths come as flocks of three and flutter at you, 1.5 times faster in a dark room and faster still, and straight, while you hold the Lantern", () => {
  const travel = (setup) => {
    const round = groundsRound("gazebo");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    setup(round);
    const m = put(round, "moth", 80, { y: ghoul.groundAt(round.spec, 80) + 1.7, flock: true });
    run(round, 1500);
    return { dist: 80 - m.x, m };
  };
  const lit = travel((r) => (r.dark = false));
  const dark = travel((r) => (r.dark = true));
  const lamp = travel((r) => {
    r.dark = true;
    ghoul.applyPower(r, "lantern");
  });
  assert.ok(dark.dist > lit.dist * 1.25, `dark ${dark.dist.toFixed(1)} vs lit ${lit.dist.toFixed(1)}`);
  assert.ok(lamp.dist > dark.dist * 1.25, `the Lantern ${lamp.dist.toFixed(1)}`);
  assert.ok(lit.m.dir === -1 && ghoul.MONSTERS.moth.hp === 1);
  // A spawn row makes a flock of three, one bolt each; a horde moth comes alone.
  const round = groundsRound("gazebo");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  put(round, "moth", 120, { y: 30 });
  run(round, 8);
  const flock = round.monsters.filter((m) => m.kind === "moth");
  assert.equal(flock.length, gr.MOTH_FLOCK);
  assert.ok(new Set(flock.map((m) => Math.round(m.x))).size > 1, "spread apart");
  const lone = groundsRound("gazebo");
  standAt(lone, 20);
  lone.you.safeMs = 1e9;
  put(lone, "moth", 120, { y: 30, horde: true });
  run(lone, 8);
  assert.equal(lone.monsters.filter((m) => m.kind === "moth").length, 1);
  assert.equal(ghoul.MONSTERS.moth.flies, true, "a horde one comes in high");
});

test("Ghoul Rush's mulch crawler waits unseen in its leaf pile, bursts out as you come near, then crawls at you", () => {
  const round = groundsRound("topiary");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const m = put(round, "mulch", 20 + gr.MULCH_NEAR + 14);
  assert.equal(m.act, "pile");
  assert.equal(ghoul.solid(m), false, "a pile of leaves");
  run(round, 300);
  assert.equal(m.act, "pile", "nothing while you are far");
  standAt(round, m.x - gr.MULCH_NEAR + 2);
  round.you.safeMs = 1e9;
  run(round, 8);
  assert.equal(m.act, "burst");
  assert.equal(events(round, "leaves").length, 1);
  assert.equal(ghoul.solid(m), false, "harmless while it bursts");
  run(round, gr.MULCH_BURST_MS + 20);
  assert.equal(m.act, "crawl");
  assert.equal(ghoul.solid(m), true);
  const x0 = m.x;
  run(round, 300);
  assert.ok(m.x < x0 - 2, "it crawls at you");
  // A horde one is already crawling.
  const horde = groundsRound("topiary");
  standAt(horde, 20);
  const h = put(horde, "mulch", 90, { horde: true });
  run(horde, 8);
  assert.equal(h.act, "crawl");
});

/* ------------------------------------------------------ the shears */

test("The Hedge shears are found only in The Grounds: no drop elsewhere ever picks them, a placed one elsewhere is swapped, and one shot kills a topiary beast or a rootling outright", () => {
  assert.equal(ghoul.POWERS.shears.stage, "grounds");
  assert.equal(ghoul.POWERS.shears.ms, 10000);
  assert.ok(ghoul.TIMED.includes("shears"), "a timed power-up, shown in the pill");
  assert.equal(PILL_WORDS.shears, "SHEARS");
  const home = groundsRound("maze");
  assert.equal(ghoul.powerHere(home, "shears"), true);
  assert.ok(home.loot.includes("shears"), "placed ones stay");
  const picked = new Set();
  const random = ghoul.seeded(9);
  for (let k = 0; k < 400; k++) picked.add(pickPower(random, home));
  assert.ok(picked.has("shears"), "drops here can be shears");
  // Elsewhere: the hall and the Graveyard never.
  const hall = ghoul.newRound(3);
  hall.dice = 0;
  assert.equal(ghoul.powerHere(hall, "shears"), false);
  const away = groundsRound("maze");
  away.stage = "graveyard";
  assert.equal(ghoul.powerHere(away, "shears"), false);
  for (let k = 0; k < 400; k++) {
    assert.notEqual(pickPower(random, away), "shears");
    assert.notEqual(pickPower(random, hall), "shears");
  }
  for (const base of ghoul.ROOMS) if (!["maze", "topiary", "gazebo", "yard"].includes(base.id)) assert.ok(!base.items.some((i) => i[0] === "shears"), `${base.id} places none`);
  // A placed one swapped when a room is entered elsewhere.
  const swapped = ghoul.newRound(11);
  swapped.dice = 0;
  swapped.stage = "manor";
  assert.equal(ghoul.powerHere(swapped, "shears"), false);
  // With the shears on, a shot kills a beast or a root; without, it takes six.
  const kills = (kind, shears, over = {}) => {
    const round = groundsRound("maze");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    if (shears) ghoul.applyPower(round, "shears");
    const m = put(round, kind, 60, over);
    bolt(round, m, m.y + 2);
    ghoul.advance(round, 4, steady);
    ghoul.advance(round, 4, steady);
    return { dead: !round.monsters.includes(m), round };
  };
  assert.equal(kills("topiary", false).dead, false);
  const t = kills("topiary", true);
  assert.equal(t.dead, true);
  assert.equal(events(t.round, "snip").length, 1, "a snip");
  assert.equal(kills("rootling", false, { act: "up", wait: 1e9 }).dead, false);
  assert.equal(kills("rootling", true, { act: "up", wait: 1e9 }).dead, true);
  assert.equal(kills("mulch", true, { act: "crawl" }).dead, false, "only hedge beasts and roots");
  assert.equal(kills("zombie", true).dead, false);
  // It runs out after its time.
  const timed = groundsRound("maze");
  ghoul.applyPower(timed, "shears");
  ghoul.advance(timed, ghoul.POWERS.shears.ms + 8, steady);
  assert.equal(timed.effects.shears, 0);
});

/* ----------------------------------------------------- the keeper */

// The yard, you in the arena, the Groundskeeper awake and idle.
function keeperFight() {
  const round = groundsRound("yard");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  round.you.safeMs = 0;
  round.events.length = 0;
  return round;
}

// Straight to the keeper's next move, as if his rest had run out.
const hurry = (b) => (b.wait = 0);

test("The Groundskeeper's lantern is a weak spot: a bolt into it, while it swings into the open, does triple damage and says so; a bolt anywhere else, or while it is tucked away, does one", () => {
  const round = keeperFight();
  const b = round.boss;
  assert.equal(b.kind, "keeper");
  assert.equal(b.dir, -1, "he faces you");
  const open = () => Object.assign(b, { act: "rest", wait: gr.KEEPER_OPEN_MS - 100 });
  open();
  let hp = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + gr.LANTERN_Y, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.hp, hp - gr.LANTERN_MULT, "triple");
  const hit = events(round, "bossHit").at(-1);
  assert.deepEqual([hit.kind, hit.how, hit.weak], ["keeper", "weak", true]);
  assert.equal(events(round, "lanternOpen").length, 1);
  // Over the lantern, or below it, or on his back: plain damage.
  for (const y of [b.y + 12, b.y + 0.3]) {
    open();
    hp = b.hp;
    round.shots.push({ x: b.x - b.w / 2 - 0.2, y, vx: 80, vy: 0, gone: 0 });
    ghoul.advance(round, 4, steady);
    assert.equal(b.hp, hp - 1, `one at ${y - b.y}`);
    assert.equal(events(round, "bossHit").at(-1).weak, false);
  }
  open();
  hp = b.hp;
  round.shots.push({ x: b.x + b.w / 2 + 0.2, y: b.y + gr.LANTERN_Y, vx: -80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.hp, hp - 1, "not from behind");
  // Tucked away (idle), even the lantern's box is only a hit.
  Object.assign(b, { act: "idle", wait: 1e9 });
  hp = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + gr.LANTERN_Y, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.hp, hp - 1, "tucked away");
});

test("The Groundskeeper winds up his scythe and sends a low sweep along the floor toward you: stand in it and a life goes, jump it and nothing does; he rests with his lantern open after", () => {
  const stand = keeperFight();
  const b = stand.boss;
  hurry(b);
  run(stand, 8);
  assert.equal(b.act, "wind");
  assert.equal(events(stand, "scytheWind").length, 1);
  run(stand, gr.SCYTHE_WIND_MS + 8);
  assert.equal(events(stand, "scytheSweep").length, 1);
  assert.equal(b.act, "rest");
  assert.equal(b.lit, false, "tucked away through the sweep");
  const wave = stand.waves.find((w) => w.kind === "scythe");
  assert.ok(wave && wave.dir === -1, "toward you");
  run(stand, 2000);
  assert.equal(events(stand, "lose")[0]?.cause, "scythe");
  // Jumped, it passes.
  const hop = keeperFight();
  const k = hop.boss;
  hurry(k);
  run(hop, gr.SCYTHE_WIND_MS + 16);
  let jumped = false;
  for (let t = 0; t < 1400; t += 4) {
    const w = hop.waves.find((q) => q.kind === "scythe");
    if (w && !jumped && Math.abs(w.x - hop.you.x) < 8) {
      ghoul.jump(hop);
      jumped = true;
    }
    ghoul.advance(hop, 4, steady);
  }
  assert.ok(jumped);
  assert.equal(events(hop, "lose").length, 0, "jumped clean over");
  assert.ok(k.lit || k.act === "idle", "his lantern came open late in the rest");
});

test("The Groundskeeper lobs the lantern's fire to where you stand: it lands after a flight and burns a patch about 6 wide for about 3 s, hurting while it burns, then goes", () => {
  const round = keeperFight();
  const b = round.boss;
  b.attacks = 1;
  hurry(b);
  run(round, 8);
  assert.equal(b.act, "throwWind");
  assert.equal(events(round, "lanternWind").length, 1);
  const x = round.you.x;
  run(round, gr.LANTERN_WIND_MS + 8);
  const throwEvent = events(round, "lanternThrow")[0];
  assert.ok(throwEvent && Math.abs(throwEvent.tx - x) < 0.5, "to where you stood");
  const patch = round.hazards[0];
  assert.equal(patch.kind, "fire");
  assert.equal(patch.w, gr.FIRE_W);
  assert.equal(patch.live, 0, "still in the air");
  // Move away: it burns without hurting you.
  round.you.safeMs = 0;
  standAt(round, x + 14);
  run(round, gr.FIRE_FLIGHT_MS + 100);
  assert.equal(events(round, "fireLand").length, 1);
  assert.ok(patch.live > 0);
  assert.equal(events(round, "lose").length, 0);
  // Step into it: a life.
  standAt(round, x);
  run(round, 20);
  assert.equal(events(round, "lose")[0]?.cause, "fire");
  // It burns out.
  round.you.safeMs = 1e9;
  standAt(round, x + 20);
  run(round, gr.FIRE_MS);
  assert.equal(round.hazards.filter((h) => h.kind === "fire" && h.live > 0).length, 0);
  // Stood in from the first, it was only a hurt after landing.
  const wait = keeperFight();
  wait.boss.attacks = 1;
  hurry(wait.boss);
  run(wait, gr.LANTERN_WIND_MS + 40 + gr.FIRE_FLIGHT_MS - 100);
  assert.equal(events(wait, "lose").length, 0, "the flight harms nothing");
});

test("The Groundskeeper at half his hp climbs onto a mower: he revs, charges to the far wall (jump onto a shelf or lose a life), stalls there with no attacks, turns, and comes quicker", () => {
  const round = keeperFight();
  const b = round.boss;
  const calm = gr.SCYTHE_WIND_MS / round.spec.pace;
  b.hp = Math.floor(b.max * gr.KEEPER_RAGE);
  hurry(b);
  run(round, 8);
  assert.equal(events(round, "keeperMower").length, 1);
  assert.equal(b.mower, true);
  assert.equal(b.w, gr.MOWER_W);
  assert.equal(b.act, "mount");
  run(round, gr.KEEPER_MOUNT_MS + 16);
  assert.equal(b.act, "idle");
  // His next scythe comes quicker.
  b.attacks = 0;
  hurry(b);
  run(round, 8);
  assert.equal(b.act, "wind");
  assert.ok(b.wait < calm, "a quicker wind-up");
  // Two moves later, the charge: the rev first.
  b.attacks = 2;
  Object.assign(b, { act: "idle", wait: 0 });
  round.waves.length = 0;
  round.hazards.length = 0;
  const side = b.x;
  run(round, 8);
  assert.equal(b.act, "rev");
  assert.equal(events(round, "mowerRev").length, 1);
  const dir = b.dir;
  assert.equal(dir, -1, "toward the far wall");
  // You wait on the middle shelf, over the mower's reach.
  Object.assign(round.you, { x: 127, y: 22, shelf: 1, state: "run", vy: 0, safeMs: 0 });
  run(round, gr.MOWER_REV_MS + 16);
  assert.equal(b.act, "charge");
  assert.equal(events(round, "mowerCharge").length, 1);
  let moved = 0;
  for (let t = 0; t < 4000 && b.act === "charge"; t += 4) {
    ghoul.advance(round, 4, steady);
    moved = side - b.x;
  }
  assert.equal(b.act, "stall");
  assert.equal(events(round, "mowerStall").length, 1);
  assert.ok(moved > 50, `across the arena (${moved.toFixed(1)})`);
  assert.equal(events(round, "lose").length, 0, "the shelf was clear");
  // The stall: no attacks, then his lantern opens and he turns to you.
  assert.equal(b.lit, false);
  run(round, gr.MOWER_STALL_MS - gr.KEEPER_OPEN_MS + 40);
  assert.equal(b.lit, true, "open late in the stall");
  assert.equal(b.dir, 1, "turned to you");
  assert.equal(round.waves.length + round.hazards.length, 0, "no attacks while stalled");
  run(round, gr.KEEPER_OPEN_MS);
  assert.equal(b.act, "idle");
  // On the floor, in front of the charge, it costs a life, named for the mower.
  const flat = keeperFight();
  const m = flat.boss;
  m.mower = true;
  m.w = gr.MOWER_W;
  Object.assign(m, { act: "charge", dir: -1 });
  standAt(flat, m.x - 16);
  run(flat, 800);
  assert.equal(events(flat, "lose")[0]?.cause, "mower");
});

test("The Groundskeeper's touch is his own, the endless-lives code spares a life from every new way to die, and his fall opens the door and ends the fire", () => {
  for (const cause of ["scythe", "fire", "mower", "keeper", "topiary", "rootling", "moth", "mulch"]) {
    const round = keeperFight();
    round.infinite = true;
    const lives = round.lives;
    ghoul.lose(round, cause);
    assert.equal(round.lives, lives, `${cause} costs none`);
  }
  const touch = keeperFight();
  touch.boss.act = "idle";
  touch.boss.wait = 1e9;
  Object.assign(touch.you, { x: touch.boss.x - 4 });
  run(touch, 20);
  assert.equal(events(touch, "lose")[0]?.cause, "keeper");
  const round = keeperFight();
  const b = round.boss;
  b.hp = 1;
  round.hazards.push({ kind: "fire", x: 150, y: 6, w: 6, h: 3, warn: 0, live: 2000, cause: "fire" });
  Object.assign(b, { act: "rest", wait: gr.KEEPER_OPEN_MS - 100 });
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + gr.LANTERN_Y, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.state, "down");
  assert.equal(round.hasKey, true);
  assert.equal(round.hazards.length, 0);
});

/* ------------------------------------------- the keeper, made harder */

test("The Groundskeeper is tougher and his lantern is open for less time: more hp, and a lit window about a third shorter", () => {
  assert.equal(gr.BOSSES.keeper.hp, 95);
  assert.equal(keeperFight().boss.max, 95);
  assert.ok(gr.KEEPER_OPEN_MS <= 800 * 0.7, `${gr.KEEPER_OPEN_MS} ms`);
  const round = keeperFight();
  const b = round.boss;
  Object.assign(b, { act: "rest", wait: gr.KEEPER_OPEN_MS + 60 });
  run(round, 20);
  assert.equal(b.lit, false, "still tucked away a moment before the window");
  run(round, 100);
  assert.equal(b.lit, true);
});

test("The Groundskeeper's first swing is a low sweep, and later swings are low or high, a high one wound up with the scythe raised and named", () => {
  const first = keeperFight();
  hurry(first.boss);
  run(first, 8);
  assert.equal(events(first, "scytheWind")[0].high, false, "the first is low");
  run(first, gr.SCYTHE_WIND_MS + 8);
  assert.ok(first.waves.some((w) => w.kind === "scythe"));
  assert.equal(first.hazards.filter((h) => h.kind === "sweep").length, 0);
  // Later, a low one is followed by a high one at the usual odds (steady 0.5 is under SWEEP_HIGH), a high one by a low one (0.5 is over SWEEP_REPEAT).
  const round = keeperFight();
  const b = round.boss;
  b.swings = 1;
  b.high = false;
  hurry(b);
  run(round, 8);
  assert.equal(b.act, "wind");
  assert.equal(b.high, true);
  const wind = events(round, "scytheWind")[0];
  assert.equal(wind.high, true, "the wind-up says high");
  run(round, gr.SCYTHE_WIND_MS + 8);
  assert.equal(events(round, "scytheSweep")[0].high, true);
  assert.equal(round.waves.length, 0, "no wave along the floor");
  assert.equal(round.hazards.filter((h) => h.kind === "sweep").length, 1);
  const next = keeperFight();
  Object.assign(next.boss, { swings: 2, high: true });
  hurry(next.boss);
  run(next, 8);
  assert.equal(next.boss.high, false, "a high one is followed by a low one");
  // Drawn: the sweep, in its wind-up and in flight.
  assert.ok(round.hazards[0].dir === -1 && round.hazards[0].live === 0, "the generic hazard hit never fires for it");
});

test("The Groundskeeper's high sweep passes over a body on the ground and hurts one in the air; a low sweep is still jumped", () => {
  // Standing on the floor: it passes clean over, then leaves the field.
  const stand = keeperFight();
  Object.assign(stand.boss, { swings: 1, high: false });
  hurry(stand.boss);
  run(stand, gr.SCYTHE_WIND_MS + 16);
  assert.equal(stand.hazards.filter((h) => h.kind === "sweep").length, 1);
  run(stand, 3000);
  assert.equal(events(stand, "lose").length, 0, "standing on the floor is safe");
  assert.equal(stand.hazards.filter((h) => h.kind === "sweep").length, 0, "gone past the arena");
  // Jumping into it costs a life, named for the scythe.
  const hop = keeperFight();
  Object.assign(hop.boss, { swings: 1, high: false });
  hurry(hop.boss);
  run(hop, gr.SCYTHE_WIND_MS + 16);
  let jumped = false;
  for (let t = 0; t < 2400 && !events(hop, "lose").length; t += 4) {
    const h = hop.hazards.find((q) => q.kind === "sweep");
    if (h && !jumped && Math.abs(h.x - hop.you.x) < 9) {
      ghoul.jump(hop);
      jumped = true;
    }
    ghoul.advance(hop, 4, steady);
  }
  assert.ok(jumped);
  assert.equal(events(hop, "lose")[0]?.cause, "scythe");
  // Endless lives spare the life.
  const endless = keeperFight();
  endless.infinite = true;
  const lives = endless.lives;
  Object.assign(endless.boss, { swings: 1, high: false });
  hurry(endless.boss);
  run(endless, gr.SCYTHE_WIND_MS + 16);
  let up = false;
  for (let t = 0; t < 2400; t += 4) {
    const h = endless.hazards.find((q) => q.kind === "sweep");
    if (h && !up && Math.abs(h.x - endless.you.x) < 9) {
      ghoul.jump(endless);
      up = true;
    }
    ghoul.advance(endless, 4, steady);
  }
  assert.ok(up);
  assert.equal(endless.lives, lives, "no life lost");
  // A low sweep is still jumped (the Groundskeeper test above), and a body well above the box passes over a high one.
  const above = keeperFight();
  Object.assign(above.boss, { swings: 1, high: false });
  hurry(above.boss);
  run(above, gr.SCYTHE_WIND_MS + 16);
  Object.assign(above.you, { y: 20, vy: 0, state: "air" });
  above.you.safeMs = 0;
  const h = above.hazards.find((q) => q.kind === "sweep");
  h.x = above.you.x + 4;
  for (let t = 0; t < 400; t += 4) {
    above.you.y = 20;
    above.you.vy = 0;
    ghoul.advance(above, 4, steady);
  }
  assert.equal(events(above, "lose").length, 0, "a high shelf is clear of it");
});

test("The Groundskeeper's lantern throw on the mower lands a second patch where you are heading, and on foot only the one", () => {
  const foot = keeperFight();
  foot.boss.attacks = 1;
  hurry(foot.boss);
  run(foot, gr.LANTERN_WIND_MS + 40);
  assert.equal(foot.hazards.filter((h) => h.kind === "fire").length, 1);
  assert.equal(events(foot, "lanternThrow")[0].tx2, undefined);
  const mounted = keeperFight();
  const b = mounted.boss;
  b.mower = true;
  b.w = gr.MOWER_W;
  b.attacks = 1;
  hurry(b);
  standAt(mounted, 150);
  mounted.you.vx = -6;
  const x = mounted.you.x;
  run(mounted, gr.LANTERN_WIND_MS + 40);
  const fires = mounted.hazards.filter((h) => h.kind === "fire");
  assert.equal(fires.length, 2);
  const ev = events(mounted, "lanternThrow")[0];
  assert.ok(Math.abs(ev.tx - x) < 0.5 && Math.abs(ev.tx2 - (x - gr.FIRE_LEAD)) < 0.5, `on you and ahead of you (${ev.tx.toFixed(1)}, ${ev.tx2.toFixed(1)})`);
  assert.ok(Math.abs(fires[0].x - fires[1].x) >= gr.FIRE_W, "two patches, not one");
  // Both land and burn; endless lives spare the life.
  mounted.you.safeMs = 1e9;
  standAt(mounted, x + 30);
  mounted.you.safeMs = 1e9;
  run(mounted, gr.FIRE_FLIGHT_MS + 100);
  assert.equal(events(mounted, "fireLand").length, 2);
  assert.ok(fires.every((f) => f.live > 0));
  // Running the other way, the patch is on that side.
  const right = keeperFight();
  Object.assign(right.boss, { mower: true, w: gr.MOWER_W, attacks: 1 });
  hurry(right.boss);
  standAt(right, 130);
  right.you.vx = 6;
  run(right, gr.LANTERN_WIND_MS + 40);
  assert.ok(events(right, "lanternThrow")[0].tx2 > right.you.x + 5);
});

test("The Groundskeeper's lantern, opening on the mower, calls two or three moths toward it, never more than four alive", () => {
  const open = (round) => Object.assign(round.boss, { act: "rest", wait: gr.KEEPER_OPEN_MS + 40 });
  const foot = keeperFight();
  open(foot);
  run(foot, 120);
  assert.equal(foot.boss.lit, true);
  assert.equal(foot.monsters.filter((m) => m.kind === "moth").length, 0, "on foot, no moths");
  const round = keeperFight();
  Object.assign(round.boss, { mower: true, w: gr.MOWER_W });
  open(round);
  run(round, 120);
  const moths = () => round.monsters.filter((m) => m.kind === "moth" && !m.dead);
  assert.equal(moths().length, gr.MOTH_CALL, "two (steady is under one half... one more only when the draw is low)");
  assert.equal(events(round, "mothCall").length, 1);
  assert.ok(moths().every((m) => m.lure > 0), "called to the lantern");
  // They head for the lantern, not for you, for the first moments.
  const b = round.boss;
  const lx = () => b.x + b.dir * (b.w / 2 - gr.LANTERN_BACK);
  const before = moths().map((m) => Math.abs(m.x - lx()));
  round.you.safeMs = 1e9;
  run(round, 400);
  const after = moths().map((m) => Math.abs(m.x - lx()));
  assert.ok(after.every((d, i) => d < before[i] - 1), `closer to the lantern (${before.map((d) => d.toFixed(0))} to ${after.map((d) => d.toFixed(0))})`);
  // A lucky draw calls one more.
  const lucky = keeperFight();
  Object.assign(lucky.boss, { mower: true, w: gr.MOWER_W });
  open(lucky);
  for (let t = 0; t < 120; t += 4) ghoul.advance(lucky, 4, () => 0.1);
  assert.equal(lucky.monsters.filter((m) => m.kind === "moth").length, gr.MOTH_CALL + 1);
  // The cap: with three already flying, only one more comes; with four, none and no call.
  for (const [have, added] of [[3, 1], [4, 0]]) {
    const capped = keeperFight();
    Object.assign(capped.boss, { mower: true, w: gr.MOWER_W });
    capped.you.safeMs = 1e9;
    for (let i = 0; i < have; i++) put(capped, "moth", 150 + i * 3, { y: 20, flock: true });
    open(capped);
    for (let t = 0; t < 120; t += 4) ghoul.advance(capped, 4, () => 0.1);
    const alive = capped.monsters.filter((m) => m.kind === "moth" && !m.dead).length;
    assert.equal(alive, have + added, `${have} flying, ${alive} after`);
    assert.equal(events(capped, "mothCall").length, added ? 1 : 0);
    assert.ok(alive <= gr.MOTH_CAP);
  }
});

test("The Groundskeeper's mower charges come a bit more often: the move before the third is sometimes a charge, never two in a row from it", () => {
  const mounted = (random) => {
    const round = keeperFight();
    Object.assign(round.boss, { mower: true, w: gr.MOWER_W, attacks: 1 });
    hurry(round.boss);
    for (let t = 0; t < 12; t += 4) ghoul.advance(round, 4, random);
    return round;
  };
  assert.equal(mounted(steady).boss.act, "throwWind", "the usual draw: still the lantern");
  const early = mounted(() => 0.1);
  assert.equal(early.boss.act, "rev", "a low draw: an early charge");
  assert.equal(events(early, "mowerRev").length, 1);
  // The very next move is not another charge.
  Object.assign(early.boss, { act: "idle", wait: 0 });
  for (let t = 0; t < 12; t += 4) ghoul.advance(early, 4, () => 0.1);
  assert.notEqual(early.boss.act, "rev");
  assert.equal(early.boss.attacks, 3);
  // On foot, never.
  const foot = keeperFight();
  foot.boss.attacks = 1;
  hurry(foot.boss);
  for (let t = 0; t < 12; t += 4) ghoul.advance(foot, 4, () => 0.1);
  assert.notEqual(foot.boss.act, "rev");
});

test("Ghoul Rush's Grounds: the high sweep and the moth call have their reactions, the two fire patches share one sound, and the sweep draws", () => {
  const names = Object.values(VOICES).flatMap((v) => Object.values(v));
  const heard = (e, fx = { clock: 1e6 }, extra = {}) => {
    const played = [];
    const noop = () => {};
    const floats = [];
    const kit = { tone: (name) => played.push(name), burst: noop, float: (x, y, text) => floats.push(text), ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
    react(e, kit);
    return { played, floats };
  };
  const at = { x: 10, y: 6, tx: 20, ty: 6 };
  const wind = heard({ ...at, type: "scytheWind", kind: "keeper", high: true });
  assert.deepEqual(wind.floats, ["Stay low!"]);
  assert.deepEqual(wind.played.filter((n) => names.includes(n)), [VOICES.keeper.scytheWind], "one sound");
  assert.deepEqual(heard({ ...at, type: "scytheWind", kind: "keeper", high: false }).floats, []);
  const sweep = heard({ ...at, type: "scytheSweep", kind: "keeper", high: true });
  assert.deepEqual(sweep.played.filter((n) => names.includes(n)), [VOICES.keeper.scytheSweep], "one sound");
  const call = heard({ ...at, type: "mothCall", kind: "keeper", n: 2 });
  assert.deepEqual(call.floats, ["Moths!"]);
  assert.equal(call.played.filter((n) => names.includes(n)).length, 0, "the moths' own spawn sounds speak");
  // Two patches landing together: one fire sound.
  const fx = { clock: 1e6 };
  const first = heard({ ...at, type: "fireLand" }, fx).played.filter((n) => names.includes(n));
  const second = heard({ ...at, type: "fireLand", x: 30 }, fx).played.filter((n) => names.includes(n));
  assert.equal(first.length + second.length, 1, "one sound for two patches");
  assert.equal(heard({ ...at, type: "lanternThrow", kind: "keeper", tx2: 31, ty2: 6 }).played.filter((n) => names.includes(n)).length, 1);
  // A scythe is still the cause, with its words and sound.
  assert.ok(LOSE_WORDS.scythe && LOSE_SOUNDS.scythe);
});

/* ------------------------------------------------------ voices etc. */

test("Ghoul Rush's Grounds: every new kind has a voice for every act and every new event plays exactly one; endless lives skip every new loss, and his fall puts out the fire", () => {
  const own = { topiary: ["appear", "rustle", "freeze", "hurt", "die"], rootling: ["appear", "warn", "up", "hurt", "die"], moth: ["appear", "hurt", "die"], mulch: ["appear", "leaves", "hurt", "die"], keeper: ["wake", "scytheWind", "scytheSweep", "lanternWind", "lanternThrow", "fire", "lanternOpen", "mower", "rev", "charge", "stall", "hurt", "weak", "die"], shears: ["snip"] };
  for (const [kind, acts] of Object.entries(own)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const heard = (e) => {
    const played = [];
    const noop = () => {};
    const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6 };
    react(e, kit);
    return played;
  };
  const at = { x: 10, y: 6, tx: 20, ty: 6 };
  const cases = [
    [{ type: "rustle", kind: "topiary" }, "topiary", "rustle"],
    [{ type: "rootWarn", kind: "rootling" }, "rootling", "warn"],
    [{ type: "rootUp", kind: "rootling" }, "rootling", "up"],
    [{ type: "leaves", kind: "mulch" }, "mulch", "leaves"],
    [{ type: "scytheWind", kind: "keeper" }, "keeper", "scytheWind"],
    [{ type: "lanternWind", kind: "keeper" }, "keeper", "lanternWind"],
    [{ type: "scytheSweep", kind: "keeper" }, "keeper", "scytheSweep"],
    [{ type: "lanternThrow", kind: "keeper" }, "keeper", "lanternThrow"],
    [{ type: "keeperMower", kind: "keeper" }, "keeper", "mower"],
    [{ type: "mowerRev", kind: "keeper" }, "keeper", "rev"],
    [{ type: "mowerCharge", kind: "keeper" }, "keeper", "charge"],
    [{ type: "mowerStall", kind: "keeper" }, "keeper", "stall"],
    [{ type: "bossWake", kind: "keeper" }, "keeper", "wake"],
    [{ type: "bossHit", kind: "keeper", how: "shot" }, "keeper", "hurt"],
    [{ type: "bossHit", kind: "keeper", how: "weak", weak: true }, "keeper", "weak"],
    [{ type: "fireLand" }, "keeper", "fire"],
    [{ type: "lanternOpen", kind: "keeper" }, "keeper", "lanternOpen"],
    [{ type: "freeze", kind: "topiary" }, "topiary", "freeze"],
    [{ type: "snip", kind: "topiary" }, "shears", "snip"],
    [{ type: "snip", kind: "rootling" }, "shears", "snip"],
    [{ type: "bossDown", kind: "keeper", points: 1 }, "keeper", "die"],
    [{ type: "hit", kind: "topiary" }, "topiary", "hurt"],
    [{ type: "kill", kind: "moth", mult: 1, how: "shot", points: 1 }, "moth", "die"],
    [{ type: "spawn", kind: "moth" }, "moth", "appear"],
  ];
  for (const [e, kind, act] of cases) assert.ok(heard({ ...at, ...e }).includes(VOICES[kind][act]), `${e.type}: ${kind} ${act}`);
  // Each picked sound plays once, and the weak spot's and the shears' replace the sounds beside them.
  const keeperHit = (e) => heard({ ...at, type: "bossHit", kind: "keeper", ...e });
  assert.equal(keeperHit({ how: "weak", weak: true }).includes(VOICES.keeper.hurt), false, "weak replaces hurt");
  assert.equal(keeperHit({ how: "shot" }).includes(VOICES.keeper.weak), false, "a plain shot is not weak");
  for (const e of cases.map((c) => c[0])) {
    const names = Object.values(VOICES).flatMap((v) => Object.values(v));
    const picked = heard({ ...at, ...e }).filter((n) => names.includes(n));
    assert.equal(picked.length, 1, `${e.type} plays exactly one picked sound`);
  }
  const shearsKill = heard({ ...at, type: "kill", kind: "topiary", mult: 1, how: "shears", points: 1 });
  assert.equal(shearsKill.includes(VOICES.topiary.die), false, "a shears kill is not also a dying cry");
  // Every picked tone exists in the merged tones, and the stage keeps them in its own file.
  const merged = ghoulSfx.default.tones;
  for (const kind of Object.keys(own)) {
    for (const [act, name] of Object.entries(VOICES[kind])) {
      assert.ok(merged[name]?.layers?.length, `${kind}.${act}: ${name} is in the merged tones`);
      assert.ok(sfxGrounds.GROUNDS_SFX.tones[name], `${name} lives in ghoul-sfx-grounds.js`);
      assert.equal(name, `ghoul${kind === "keeper" ? "Keeper" : kind[0].toUpperCase() + kind.slice(1)}${act[0].toUpperCase()}${act.slice(1)}`, "named by kind and act");
    }
  }
  for (const cause of ["scythe", "fire", "mower", "keeper", "topiary", "rootling", "moth", "mulch"]) {
    const round = keeperFight();
    round.infinite = true;
    const lives = round.lives;
    ghoul.lose(round, cause);
    assert.equal(round.lives, lives, `${cause} costs none`);
  }
  const touch = keeperFight();
  touch.boss.act = "idle";
  touch.boss.wait = 1e9;
  Object.assign(touch.you, { x: touch.boss.x - 4 });
  run(touch, 20);
  assert.equal(events(touch, "lose")[0]?.cause, "keeper");
  const round = keeperFight();
  const b = round.boss;
  b.hp = 1;
  round.hazards.push({ kind: "fire", x: 150, y: 6, w: 6, h: 3, warn: 0, live: 2000, cause: "fire" });
  Object.assign(b, { act: "rest", wait: gr.KEEPER_OPEN_MS - 100 });
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + gr.LANTERN_Y, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.state, "down");
  assert.equal(round.hasKey, true);
  assert.equal(round.hazards.length, 0);
});

/* ------------------------------------------------------ voices etc. */

test("Ghoul Rush's Grounds: every new way to die has its words and its own sound", () => {
  const heard = (e) => {
    const played = [];
    const noop = () => {};
    const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6 };
    react(e, kit);
    return played;
  };
  for (const cause of ["scythe", "fire", "mower", "keeper", "topiary", "rootling", "moth", "mulch"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ x: 10, y: 6, type: "lose", cause, lives: 2 }).includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Grounds draws: every room, every monster in every act, the Groundskeeper in each move on foot and mounted, the scythe's sweep and the lantern's fire, in a lit room and a dark one", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["grounds"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  const acts = { topiary: ["still", "creep"], rootling: ["trail", "warn", "up", "sink"], mulch: ["pile", "burst", "crawl"], moth: [""] };
  for (const id of ["maze", "topiary", "gazebo", "yard"]) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      r.dark = dark;
      r.phase = "play";
      r.lives = 99;
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      standAt(r, id === "yard" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
      r.you.safeMs = 1e9;
      for (const [kind, list] of Object.entries(acts)) {
        list.forEach((act, i) => put(r, kind, r.you.x + 6 + i * 5, { act, wait: 300, y: kind === "moth" ? 12 : undefined }));
      }
      if (r.boss) {
        ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
        for (const mower of [false, true]) {
          Object.assign(r.boss, { mower, w: mower ? gr.MOWER_W : gr.BOSSES.keeper.w });
          for (const act of ["idle", "wind", "rest", "throwWind", "rev", "charge", "stall", "mount"]) {
            Object.assign(r.boss, { act, wait: 400, dir: -1, lit: act === "rest" });
            g.tick(16);
          }
        }
        r.hazards.push({ kind: "fire", x: r.you.x + 10, y: 6, w: 6, h: 3, warn: 400, live: 0, cause: "fire", sx: r.boss.x, sy: 9 }, { kind: "fire", x: r.you.x + 20, y: 6, w: 6, h: 3, warn: 0, live: 1500, cause: "fire" });
        r.waves.push({ x: r.you.x + 8, y: 6, dir: -1, life: 6000, kind: "scythe", cause: "scythe" });
      }
      for (let k = 0; k < 20; k++) g.tick(16);
      r.you.safeMs = 1e9;
    }
  }
  assert.ok(r.spec.id === "yard", "got to the yard and drew it");
});
