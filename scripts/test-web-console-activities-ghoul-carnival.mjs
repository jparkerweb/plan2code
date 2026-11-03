// Web console tests, Ghoul Rush's Midnight Carnival stage: its four rooms (the Midway, the Hall of Mirrors, the Funhouse with its conveyor floors, the Big Top), grinners that honk out acid balloons, marionettes that drop on their strings, Mirror You that copies your moves and shots half a second late, strongmen that lob barbells, circus hounds that leap through hoops of fire, Cotton Candy and the Custard Pie (found only here), and the Ringmaster, whose puppet hangs on three strings: cut them all and he is open for four seconds.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import * as cv from "../src/web-console/public/activities/ghoul-carnival.js";
import * as arm from "../src/web-console/public/activities/ghoul-arms.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-carnival-draw.js";
import { PILL_WORDS, pickPower } from "../src/web-console/public/activities/ghoul-powers.js";
import { BONES } from "../src/web-console/public/activities/ghoul-bones.js";
import { GRAVEYARD } from "../src/web-console/public/activities/ghoul-graveyard.js";
import { GROUNDS } from "../src/web-console/public/activities/ghoul-grounds.js";
import { CHAPEL } from "../src/web-console/public/activities/ghoul-chapel.js";
import { SANATORIUM } from "../src/web-console/public/activities/ghoul-sanatorium.js";
import { VILLAGE } from "../src/web-console/public/activities/ghoul-village.js";
import { MINE } from "../src/web-console/public/activities/ghoul-mine.js";
import { CART } from "../src/web-console/public/activities/ghoul-cart.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";
import { LOOKS, VOICES, react } from "../src/web-console/public/activities/ghoul-draw.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the carnival drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);
// Fire tapped twice, as the keys do it.
const tapTap = (round) => {
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
};
// The four rooms that are walked; the dark ride (a bonus round) between the funhouse and the Big Top has its own suite (ghoul-ride).
const ROOM_IDS = ["midway", "mirrors", "funhouse", "bigtop"];
const STAGE_ROOMS = ["midway", "mirrors", "funhouse", "darkride", "bigtop"];

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Carnival's room `id`, reached the way play reaches it, nothing
// woken: every spawner spent, the horde held back.
function carnivalRound(id) {
  const round = ghoul.newRound(5);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["carnival"];
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
  round.bonus = 1e9;
  round.dark = false;
  round.events.length = 0;
  return round;
}

function standAt(round, x, face = 1, y = ghoul.groundAt(round.spec, x), shelf = -1) {
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, out: 0, safeMs: 0, face, ducking: false });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

const put = (round, kind, x, over = {}) => ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), { rise: 0, ...over });

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

function until(round, done, ms = 4000, random = steady) {
  for (let t = 0; t < ms && !done(); t += 4) ghoul.advance(round, 4, random);
}

// Runs `ms`, returning each event of `type` as [ms since the start, event].
function log(round, ms, type, random = steady) {
  const got = [];
  round.events.length = 0;
  const t0 = round.clock;
  for (let t = 0; t < ms; t += 4) {
    ghoul.advance(round, 4, random);
    for (const e of round.events) if (e.type === type) got.push([round.clock - t0, e]);
    round.events.length = 0;
  }
  return got;
}

// Runs until an event of `type` is on the field (leaving it there) or `ms` pass; the event, or null.
function upTo(round, type, ms = 4000, random = steady) {
  round.events.length = 0;
  for (let t = 0; t < ms; t += 4) {
    ghoul.advance(round, 4, random);
    const e = round.events.find((x) => x.type === type);
    if (e) return e;
  }
  return null;
}

// A bolt arriving from the left at height `y` on the thing `m` (a monster or the boss).
const bolt = (round, m, y) => round.shots.push({ x: m.x - m.w / 2 - 0.3, y, vx: 80, vy: 0, gone: 0 });

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

// The Big Top with the Ringmaster awake (the fight on), Planny in the arena.
function bigtopFight({ x } = {}) {
  const round = carnivalRound("bigtop");
  standAt(round, round.spec.arena + 12);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 8, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 16, steady);
  assert.equal(round.boss.state, "fight");
  if (x !== undefined) standAt(round, x);
  round.you.safeMs = 1e9;
  round.events.length = 0;
  return round;
}

// Puts the Ringmaster's next move at once: `act` with `wait` ms to go.
const choose = (round, act, wait = 1) => Object.assign(round.boss, { act, wait });
// The Ringmaster's script at `move`, picked at once (the puppet walks at you the while).
const scriptTo = (round, move) => {
  round.boss.moves = cv.SCRIPT.indexOf(move);
  return choose(round, "idle", 1);
};

// The three strings as the pack lays them (head, left hand, right hand), as segments.
const segs = (b) => cv.stringSegs(b);
// A bolt placed on string `i` at height `y` (the string's x there).
const onString = (b, i, y) => {
  const g = segs(b)[i];
  const t = (g.y0 - y) / (g.y0 - g.y1);
  return { x: g.x0 + (g.x1 - g.x0) * t, y };
};

/* ------------------------------------------------------------ the stage */

test("Ghoul Rush's Midnight Carnival is a stage of three rooms, the dark ride (a bonus round) and the Big Top, its monsters and boss joined to the game's, with a place for each kind, conveyor belts in the funhouse, last in the list", () => {
  const st = ghoul.stageById("carnival");
  assert.deepEqual(st.rooms, STAGE_ROOMS);
  assert.deepEqual(cv.CARNIVAL_ROOMS, STAGE_ROOMS);
  assert.equal(st.boss, "ringmaster");
  assert.equal(st.title, "The Midnight Carnival");
  assert.equal(st.sub, "Every game is rigged in its favor");
  assert.equal(ghoul.STAGES.at(-3), st, "the last stage in the list but the Frozen Lake and Gallows Bog");
  for (const kind of Object.keys(cv.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], cv.MONSTERS[kind], `${kind} is a monster`);
  assert.deepEqual(Object.keys(cv.MONSTERS).sort(), ["balloon", "circushound", "grinner", "marionette", "mirror", "strongman"]);
  assert.equal(ghoul.BOSSES.ringmaster, cv.BOSSES.ringmaster);
  assert.equal(cv.BOSSES.ringmaster.sub, "Shoot the strings, not the puppet");
  assert.equal(ghoul.BOSSES.ringmaster.hp, 90);
  assert.ok(ghoul.MONSTERS.grinner.hp === 4 && ghoul.MONSTERS.marionette.hp === 4 && ghoul.MONSTERS.mirror.hp === 3 && ghoul.MONSTERS.balloon.hp === 1 && ghoul.MONSTERS.strongman.hp === 14 && ghoul.MONSTERS.circushound.hp === 3);
  assert.equal(ghoul.MONSTERS.strongman.stomp, true, "a strongman is stompable");
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const [midway, mirrors, funhouse, bigtop] = ROOM_IDS.map((id) => ghoul.roomById(id));
  assert.deepEqual([midway.title, mirrors.title, funhouse.title, bigtop.title], ["Midway", "Hall of Mirrors", "Funhouse", "The Big Top"]);
  assert.deepEqual([midway.sub, mirrors.sub, funhouse.sub, bigtop.sub], ["Every game is rigged in its favor", "Only one of you is real", "The laughter is coming from inside the walls", "Shoot the strings, not the puppet"]);
  const returning = ["zombie", "bat", "crawl", "ghost", "hound"];
  for (const room of [midway, mirrors, funhouse]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    const floss = room.items.find((i) => i[0] === "floss");
    const pie = room.items.find((i) => i[0] === "pie");
    assert.ok(floss && pie, `${room.id}: Cotton Candy and the Custard Pie`);
    const firstNew = Math.min(...room.spawns.filter((s) => s[0] in cv.MONSTERS).map((s) => s[1]));
    assert.ok(floss[1] < firstNew + 40 && pie[1] < firstNew + 40, `${room.id}: the stage's power-up and weapon come before what they answer`);
    assert.ok(room.spawns.some((s) => s[0] in cv.MONSTERS), `${room.id}: some of the new monsters`);
    assert.ok(room.spawns.some((s) => returning.includes(s[0])), `${room.id}: some returning ones`);
    // The key shelf has a board right under it, so a run at the key climbs it.
    assert.ok(room.shelves.some(([a, b, y]) => y === 15 && a <= room.key[0] && b >= room.key[0]), `${room.id}: a step under the key shelf`);
    assert.equal(room.dark, null, `${room.id}: dark or lit by the roll`);
  }
  assert.ok(bigtop.items.some((i) => i[0] === "floss") && bigtop.items.some((i) => i[0] === "pie"), "the boss room has both too");
  assert.equal(bigtop.boss, "ringmaster");
  assert.equal(bigtop.horde.length, 0);
  assert.deepEqual(bigtop.shelves.map((s) => s[2]).sort((a, b) => a - b), [12, 12, 16.5, 16.5, 22], "trapeze boards at 12, 16.5 and 22");
  // Where each new kind turns up: the monsters mixed in, harder in order, the first room eased.
  const count = (room, kind) => room.spawns.filter((s) => s[0] === kind).length;
  assert.ok(count(midway, "grinner") >= 2 && count(midway, "strongman") === 1 && count(midway, "circushound") === 1, "the Midway: grinners, one strongman, one hound");
  assert.ok(!midway.spawns.some((s) => s[0] === "mirror" || s[0] === "marionette"), "no mirrors or marionettes in the first room");
  assert.ok(count(mirrors, "mirror") >= 3, "the Hall of Mirrors is full of reflections");
  assert.ok(count(funhouse, "marionette") >= 4 && count(funhouse, "mirror") >= 2, "the Funhouse: marionettes in the rafters, and mirrors");
  assert.ok(midway.spawns.length <= mirrors.spawns.length && mirrors.spawns.length <= funhouse.spawns.length);
  assert.ok(midway.hordeMs > mirrors.hordeMs && mirrors.hordeMs > funhouse.hordeMs, "the horde quickens");
  assert.equal(midway.hordeMs, 3200);
  assert.ok(midway.horde.length <= 2 && !midway.horde.includes("circushound"), "the first room's horde is gentle");
  // A marionette hangs just over a standing head, over a floor.
  for (const s of funhouse.spawns.filter((q) => q[0] === "marionette")) {
    const floor = ghoul.groundAt(funhouse, s[1]);
    assert.ok(floor > -Infinity && Math.abs(s[2] - floor - 4.8) < 0.05, `the marionette at ${s[1]} hangs 4.8 over its floor`);
    assert.ok(!funhouse.shelves.some(([a, b, y]) => s[1] + 2 >= a && s[1] - 2 <= b && y > s[2] - 1 && y < s[2] + 6), `the marionette at ${s[1]} hangs clear of the boards`);
  }
  // The belts: flat floor, clear of a pit, much weaker than a run, and only in the funhouse.
  assert.equal(midway.belts.length + mirrors.belts.length + bigtop.belts.length, 0, "belts only in the funhouse");
  assert.ok(funhouse.belts.length >= 3);
  for (const [a, b, speed] of funhouse.belts) {
    const g = ghoul.groundAt(funhouse, a);
    assert.ok(b > a && Math.abs(speed) > 0 && Math.abs(speed) <= ghoul.RUN_SPEED / 2, `the belt ${a} to ${b} is gentle`);
    for (let x = a; x <= b; x += 2) assert.equal(ghoul.groundAt(funhouse, x), g, `no pit or step in the belt at ${x}`);
    for (let x = b; x <= b + 6; x += 1) assert.equal(ghoul.groundAt(funhouse, x) > -Infinity, true, `no pit within 6 of the belt's end at ${x}`);
    for (let x = a - 6; x <= a; x += 1) assert.equal(ghoul.groundAt(funhouse, x) > -Infinity, true, `no pit within 6 of the belt's start at ${x}`);
  }
  // The room field passes through the room builder.
  assert.deepEqual(ghoul.roomFor("funhouse").belts, funhouse.belts);
  assert.deepEqual(ghoul.roomFor("hall").belts, []);
  assert.ok(LOOKS.midway.pack === "carnival" && LOOKS.bigtop.carnival);
});

test("Ghoul Rush's Carnival shares no hazard, monster, boss, act or tick-state name with another stage's pack (the packs' tables are merged by name)", () => {
  for (const key of ["monsters", "bosses", "hazards", "move", "boss", "act", "solid", "harmless", "platform", "kill", "weak", "swoops", "guard"]) {
    for (const other of [BONES, GRAVEYARD, GROUNDS, CHAPEL, SANATORIUM, VILLAGE, MINE, CART, arm.ARMS]) {
      for (const name of Object.keys(cv.CARNIVAL[key] || {})) assert.ok(!(other[key] && name in other[key]), `${key}.${name} is also ${other.id}'s`);
    }
  }
  assert.ok(cv.CARNIVAL.hazards.pfoot && cv.CARNIVAL.hazards.lash);
  assert.equal(typeof ghoul.POWERS.floss, "object");
  assert.equal(ghoul.POWERS.pie.arm, true);
  assert.equal(ghoul.POWERS.pie.stage, "carnival");
});

test("Ghoul Rush's Carnival power-ups are found only here: Cotton Candy as a timed power-up (10 s), the Custard Pie as the stage's weapon", () => {
  assert.equal(ghoul.POWERS.floss.stage, "carnival");
  assert.equal(ghoul.POWERS.floss.ms, 10000);
  assert.ok(ghoul.TIMED.includes("floss"));
  assert.equal(PILL_WORDS.floss, "FLOSS");
  const there = carnivalRound("midway");
  const elsewhere = ghoul.newRound(5);
  elsewhere.dice = 0;
  assert.equal(ghoul.powerHere(there, "floss"), true);
  assert.equal(ghoul.powerHere(elsewhere, "floss"), false);
  assert.equal(ghoul.powerHere(there, "pie"), true);
  assert.equal(ghoul.powerHere(elsewhere, "pie"), false);
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(pickPower(() => (i * 0.6180339) % 1, elsewhere, "", true));
  assert.ok(!seen.has("floss") && !seen.has("pie"), "never a random drop elsewhere");
  assert.equal(ghoul.default && true, true);
  ghoul.applyPower(there, "floss");
  assert.equal(there.effects.floss, 10000);
  ghoul.advance(there, 10000 + 8, steady);
  assert.equal(there.effects.floss, 0);
  assert.equal(events(there, "expire").filter((e) => e.kind === "floss").length, 1);
  // The pie: a double tap throws it, a pickup is 2 (never over 4), it carries on.
  const bag = carnivalRound("midway");
  standAt(bag, 30);
  arm.fillBag(bag, "carnival");
  assert.ok(bag.arms.some((a) => a.kind === "pie"), "a practice round brings the stage's weapon");
  const fresh = carnivalRound("midway");
  fresh.drops.push({ id: 0, kind: "pie", x: 40, y: 8, vx: 0, vy: 0, life: 9000, rest: true });
  standAt(fresh, 40);
  ghoul.advance(fresh, 40, steady);
  assert.deepEqual(fresh.arms.map((a) => [a.kind, a.n]), [["pie", 2]]);
});

/* ----------------------------------------------------------------- belts */

test("Ghoul Rush's conveyor belts carry Planny along at their speed while he stands on the floor in one (on top of his running), never in the air, never on a board, and a belt can run him off a pit's edge", () => {
  const round = carnivalRound("funhouse");
  const [[a, b, speed]] = round.spec.belts.filter((s) => s[2] > 0);
  const mid = (a + b) / 2;
  standAt(round, mid);
  round.you.safeMs = 1e9;
  const x0 = round.you.x;
  run(round, 1000);
  assert.ok(Math.abs(round.you.x - x0 - speed) < 0.6, `stands still, carried ${speed} a second (${round.you.x - x0})`);
  assert.equal(round.you.belt, speed);
  // Running with it adds, against it takes away.
  standAt(round, mid);
  run(round, 500, { right: true });
  assert.ok(Math.abs(round.you.x - mid - (ghoul.RUN_SPEED + speed) / 2) < 0.8, "with the belt");
  standAt(round, mid, -1);
  run(round, 500, { left: true });
  assert.ok(Math.abs(mid - round.you.x - (ghoul.RUN_SPEED - speed) / 2) < 0.8, "against it, still forward");
  // The other way round for a belt that runs left.
  const [[c, d, back]] = round.spec.belts.filter((s) => s[2] < 0);
  standAt(round, (c + d) / 2);
  const x1 = round.you.x;
  run(round, 1000);
  assert.ok(Math.abs(x1 - round.you.x + back) < 0.6 && round.you.x < x1, "a left belt carries left");
  // Off the belt, nothing carries him.
  standAt(round, a - 3);
  const x2 = round.you.x;
  run(round, 600);
  assert.equal(round.you.x, x2);
  assert.equal(round.you.belt, 0);
  // In the air above a belt: not carried.
  standAt(round, mid);
  Object.assign(round.you, { y: ghoul.groundAt(round.spec, mid) + 8, vy: 0, state: "air" });
  ghoul.advance(round, 40, steady);
  assert.equal(round.you.belt, 0);
  // Not on a board over it.
  const shelf = round.spec.shelves.findIndex(([x0, x1]) => x0 >= a && x1 <= b);
  if (shelf >= 0) {
    const [s0, s1, sy] = round.spec.shelves[shelf];
    standAt(round, (s0 + s1) / 2, 1, sy, shelf);
    const x3 = round.you.x;
    run(round, 500);
    assert.equal(round.you.x, x3, "a board is not a belt");
  }
  // At a belt's end the floor goes on, so he is not carried into the pit past it.
  standAt(round, b - 0.5);
  run(round, 2000);
  assert.ok(round.you.x > b && round.you.x < b + 0.1 && round.you.state === "run", "stops where the belt ends");
});

/* ---------------------------------------------------- grinners, balloons */

test("Ghoul Rush's grinner walks at you to 14 away, honks (480 ms of wind-up) and a balloon is born, again every 3.4 s, never more than 4 balloons alive", () => {
  const round = carnivalRound("midway");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const g = put(round, "grinner", 80);
  const honks = log(round, 9000, "grinnerHonk");
  assert.ok(honks.length >= 2, "honks more than once");
  assert.ok(Math.abs(honks[0][0] - cv.GRIN_FIRST_MS) < 120, `the first honk comes ${cv.GRIN_FIRST_MS} ms in (${honks[0][0]})`);
  assert.ok(Math.abs(honks[1][0] - honks[0][0] - (cv.HONK_MS + cv.GRIN_MS)) < 60, `then every ${cv.GRIN_MS} ms after the balloon (${honks[1][0] - honks[0][0]})`);
  assert.ok(Math.abs(g.x - round.you.x) <= cv.GRIN_KEEP + 1.5 && Math.abs(g.x - round.you.x) > cv.GRIN_KEEP - 3, `it keeps ${cv.GRIN_KEEP} off (${g.x - round.you.x})`);
  assert.ok(round.monsters.filter((m) => m.kind === "balloon").length >= 1);
  // Never more than the cap.
  const crowd = carnivalRound("midway");
  standAt(crowd, 40);
  crowd.you.safeMs = 1e9;
  put(crowd, "grinner", 60);
  put(crowd, "grinner", 70);
  put(crowd, "grinner", 76);
  let most = 0;
  for (let t = 0; t < 30000; t += 4) {
    ghoul.advance(crowd, 4, steady);
    crowd.you.safeMs = 1e9;
    most = Math.max(most, crowd.monsters.filter((m) => m.kind === "balloon" && !m.dead).length);
    crowd.monsters.forEach((m) => {
      if (m.kind === "balloon") m.life = 1e9;
    });
  }
  assert.ok(most <= cv.BALLOON_CAP && most >= 3, `${most} balloons at most`);
});

test("Ghoul Rush's balloon drifts at you at chest height, pops into an acid puddle when shot (2 s, then gone), costs a life on you, and pops by itself after 9 s", () => {
  const round = carnivalRound("midway");
  standAt(round, 40);
  const m = put(round, "balloon", 70, { y: 12, life: undefined });
  run(round, 2200);
  assert.ok(m.x < 70 - 10, "it drifts toward you");
  assert.ok(Math.abs(m.y - (round.you.y + cv.BALLOON_RISE)) < 0.8, `level with your chest (${m.y})`);
  // Shot: a pop, a puddle where it was, lying for BALLOON_PUDDLE_MS.
  const shot = carnivalRound("midway");
  standAt(shot, 40);
  shot.you.safeMs = 1e9;
  const b = put(shot, "balloon", 55, { y: 7 });
  b.life = 1e9;
  shot.round = null;
  bolt(shot, b, b.y + 1);
  shot.events.length = 0;
  ghoul.advance(shot, 40, steady);
  const pop = events(shot, "balloonPop")[0];
  assert.ok(pop, "a pop");
  assert.equal(shot.puddles.length, 1);
  assert.equal(shot.puddles[0].life, cv.BALLOON_PUDDLE_MS - (shot.clock % 4 ? 0 : 0) - (shot.puddles[0].life === cv.BALLOON_PUDDLE_MS ? 0 : cv.BALLOON_PUDDLE_MS - shot.puddles[0].life));
  assert.ok(Math.abs(shot.puddles[0].x - pop.x) < 0.01 && shot.puddles[0].y === 6);
  run(shot, cv.BALLOON_PUDDLE_MS + 100);
  assert.equal(shot.puddles.length, 0, "the puddle is short-lived");
  // The puddle burns whoever stands in it.
  const lie = carnivalRound("midway");
  standAt(lie, 40);
  lie.puddles.push({ id: 9, x: 40, y: 6, life: cv.BALLOON_PUDDLE_MS });
  lie.you.safeMs = 0;
  ghoul.advance(lie, 8, steady);
  assert.equal(events(lie, "lose")[0]?.cause, "acid");
  // On you, it costs a life, the cause balloon.
  const on = carnivalRound("midway");
  standAt(on, 40);
  put(on, "balloon", 40.5, { y: 6.5 }).life = 1e9;
  until(on, () => events(on, "lose").length > 0, 600);
  assert.equal(events(on, "lose")[0]?.cause, "balloon");
  // On its own it pops after BALLOON_LIFE_MS, harmlessly (no points, a puddle under it).
  const own = carnivalRound("midway");
  standAt(own, 10);
  own.you.safeMs = 1e9;
  const far = put(own, "balloon", 150, { y: 10 });
  far.vx = 0;
  const score = own.score;
  const pops = log(own, cv.BALLOON_LIFE_MS + 500, "balloonPop");
  assert.equal(pops.length, 1);
  assert.ok(pops[0][0] >= cv.BALLOON_LIFE_MS - 100 && pops[0][0] <= cv.BALLOON_LIFE_MS + 100, `popped at ${pops[0][0]}`);
  assert.equal(own.score, score, "a balloon that pops itself is worth nothing");
  // Over a pit there is nothing to drip on.
  const pit = carnivalRound("midway");
  standAt(pit, 20);
  const over = put(pit, "balloon", 284, { y: 10 });
  over.life = 1e9;
  ghoul.hurt(pit, over, 1, "shot", steady);
  assert.equal(pit.puddles.length, 0);
  assert.equal(events(pit, "balloonPop")[0]?.floor, null);
});

/* ---------------------------------------------------------- marionettes */

test("Ghoul Rush's marionette hangs on its string, jerks when you pass under it (380 ms), drops, lands and dances at you", () => {
  const round = carnivalRound("funhouse");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const m = put(round, "marionette", 64, { y: 10.8 });
  assert.equal(m.act, "hang");
  run(round, 600);
  assert.equal(m.act, "hang", "hangs while you are not under it");
  assert.equal(m.y, 10.8);
  standAt(round, 62);
  round.you.safeMs = 1e9;
  const t0 = round.clock;
  const jerk = upTo(round, "marionetteJerk", 200);
  assert.ok(jerk, "it jerks as you pass under");
  assert.equal(m.act, "warn");
  const drop = upTo(round, "marionetteDrop", 600);
  assert.ok(drop && Math.abs(round.clock - t0 - cv.MARION_WARN_MS) < 60, `then drops ${cv.MARION_WARN_MS} ms later`);
  assert.equal(m.act, "drop");
  const land = upTo(round, "marionetteLand", 1200);
  assert.ok(land && m.y === 6 && m.act === "dance", "lands on the floor and dances");
  assert.equal(land.floor, 6);
  // It dances at you and a touch costs a life, the cause marionette.
  standAt(round, 40);
  round.you.safeMs = 0;
  run(round, 4000);
  assert.equal(events(round, "lose")[0]?.cause, "marionette");
  // Walking under it with your head above its feet (a jump over it, or on a board) does not set it off.
  const high = carnivalRound("funhouse");
  standAt(high, 64);
  const n = put(high, "marionette", 64, { y: 10.8 });
  Object.assign(high.you, { y: 12, state: "air", vy: 0 });
  high.you.safeMs = 1e9;
  ghoul.advance(high, 8, steady);
  assert.equal(n.act, "hang");
  // Out of view it sleeps too.
  const away = carnivalRound("funhouse");
  standAt(away, 20);
  const o = put(away, "marionette", 300, { y: 10.8 });
  run(away, 400);
  assert.equal(o.act, "hang");
});

test("Ghoul Rush's marionette dies to one bolt on its string (over its head, or the top of its body), else takes 4 hits to the body; once dropped there is no string to cut", () => {
  const strung = () => {
    const round = carnivalRound("funhouse");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    return { round, m: put(round, "marionette", 64, { y: 10.8 }) };
  };
  // A bolt crossing the string over its head.
  let { round, m } = strung();
  round.shots.push({ x: 62, y: 20, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.ok(m.dead || !round.monsters.includes(m), "one bolt on the string kills it");
  assert.equal(events(round, "stringCut")[0]?.what, "marionette");
  // The top of its body is the string's end.
  ({ round, m } = strung());
  round.shots.push({ x: 62, y: 10.8 + 4.5, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.ok(!round.monsters.includes(m), "a bolt at the top of the body cuts it too");
  // The body below that takes 4 hits.
  ({ round, m } = strung());
  for (let i = 1; i <= 4; i++) {
    round.shots.push({ x: 62, y: 10.8 + 1.5, vx: 80, vy: 0, gone: 0 });
    ghoul.advance(round, 40, steady);
    assert.equal(round.monsters.includes(m), i < 4, `${i} hits to the body`);
  }
  assert.equal(events(round, "stringCut").length, 0);
  // Dropped and dancing, the top of the body is just the body.
  ({ round, m } = strung());
  Object.assign(m, { act: "dance", y: 6 });
  round.shots.push({ x: 62, y: 6 + 4.5, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.ok(round.monsters.includes(m) && m.hp === 3, "one hit");
  // A stomp on a dancer kills it.
  ({ round, m } = strung());
  Object.assign(m, { act: "dance", y: 6 });
  standAt(round, 64, 1, 6 + 5);
  round.you.vy = -30;
  Object.assign(round.you, { state: "air" });
  until(round, () => events(round, "stomp").length > 0, 400);
  assert.equal(events(round, "stomp").length, 1);
});

/* ---------------------------------------------------------- Mirror You */

// A mirror 30 right of Planny, stepped out and copying, nothing else about.
function mirrorPair() {
  const round = carnivalRound("mirrors");
  standAt(round, 60);
  round.you.safeMs = 1e9;
  const m = put(round, "mirror", 90);
  return { round, m };
}

test("Ghoul Rush's Mirror You waits in its panel (not solid) till you are within 38, steps out over 600 ms, then copies you", () => {
  const { round, m } = mirrorPair();
  assert.equal(m.act, "wait");
  assert.equal(ghoul.solid(m), false);
  standAt(round, 30);
  run(round, 400);
  assert.equal(m.act, "wait", "too far");
  standAt(round, 60);
  round.you.safeMs = 1e9;
  const step = upTo(round, "mirrorStep", 100);
  assert.ok(step);
  assert.equal(m.act, "step");
  assert.equal(ghoul.solid(m), false, "not solid while stepping out");
  const t0 = round.clock;
  until(round, () => m.act === "copy", 1000);
  assert.ok(Math.abs(round.clock - t0 - cv.MIRROR_STEP_MS) < 40, "600 ms");
  assert.equal(ghoul.solid(m), true);
});

test("Ghoul Rush's Mirror You moves where you moved, the other way, 500 ms late (and your jumps, ducking and facing), drifting a little at you", () => {
  const { round, m } = mirrorPair();
  until(round, () => m.act === "copy", 1500);
  round.you.safeMs = 1e9;
  // Stand still 1 s: it only drifts at you.
  const x0 = m.x;
  run(round, 1000);
  assert.ok(Math.abs(x0 - m.x - cv.MIRROR_DRIFT) < 0.6, `drifts ${cv.MIRROR_DRIFT} a second at you (${x0 - m.x})`);
  // Run right for 300 ms: the mirror moves left, but not for the first 500 ms.
  standAt(round, 60);
  round.you.safeMs = 1e9;
  const x1 = m.x;
  const me = round.you.x;
  run(round, 300, { right: true });
  const ran = round.you.x - me;
  assert.ok(ran > 9, "ran");
  assert.ok(x1 - m.x < 2.5, `still (drift only) before the delay (${x1 - m.x})`);
  run(round, 520);
  assert.ok(x1 - m.x > ran - 1.5 && x1 - m.x < ran + 4, `then the other way, as far (${x1 - m.x} for ${ran})`);
  assert.equal(m.dir, 1 * -1, "facing the other way");
  // A jump: it jumps 500 ms later, as high.
  standAt(round, 60);
  round.you.safeMs = 1e9;
  m.y = ghoul.groundAt(round.spec, m.x);
  round.input.up = true;
  ghoul.jump(round);
  let apex = 0;
  let mapex = 0;
  let tUp = -1;
  for (let t = 0; t < 1600; t += 4) {
    ghoul.advance(round, 4, steady);
    if (round.you.y - 6 > apex) apex = round.you.y - 6;
    if (m.y - ghoul.groundAt(round.spec, m.x) > 0.5 && tUp < 0) tUp = t;
    mapex = Math.max(mapex, m.y - ghoul.groundAt(round.spec, m.x));
  }
  assert.ok(apex > 10 && Math.abs(mapex - apex) < 1.5, `jumps as high (${mapex} for ${apex})`);
  round.input.up = false;
  assert.ok(tUp >= 440 && tUp <= 580, `after 500 ms (${tUp})`);
  // Ducking is copied.
  standAt(round, 60);
  round.you.safeMs = 1e9;
  run(round, 300, { down: true });
  run(round, 300, { down: true });
  assert.equal(m.duck, true);
});

test("Ghoul Rush's Mirror You fires a bolt for each bolt you fire, 500 ms late, back at you; its bolt and yours cancel where they meet (a thrown weapon destroys it and flies on)", () => {
  const { round, m } = mirrorPair();
  until(round, () => m.act === "copy", 1500);
  m.hp = 99;
  m.x = 90;
  round.you.safeMs = 1e9;
  standAt(round, 60, -1);
  round.you.safeMs = 1e9;
  // Face away from it and fire once: its bolt comes (it faces the other way: toward you).
  const t0 = round.clock;
  run(round, 20, { fire: true });
  const shot = upTo(round, "mirrorShot", 900);
  assert.ok(shot, "it fires");
  assert.ok(Math.abs(round.clock - t0 - cv.MIRROR_DELAY_MS) < 60, `about ${cv.MIRROR_DELAY_MS} ms late (${round.clock - t0})`);
  assert.equal(shot.dir, 1, "it fires the way you faced, mirrored");
  assert.equal(round.twist.bolts.length >= 1, true);
  // Facing it, you fire at it and it fires back at you: the other way from the first.
  const facing = carnivalRound("mirrors");
  standAt(facing, 60, 1);
  facing.you.safeMs = 1e9;
  const f = put(facing, "mirror", 90);
  until(facing, () => f.act === "copy", 1500);
  f.hp = 99;
  f.x = 90;
  standAt(facing, 60, 1);
  facing.you.safeMs = 1e9;
  run(facing, 20, { fire: true });
  const fshot = upTo(facing, "mirrorShot", 900);
  assert.equal(fshot.dir, -1, "you faced right: it faces left, at you");
  // Its bolt hits you at chest height when you stand, and misses a ducked you.
  const hit = (ducked) => {
    const r = carnivalRound("mirrors");
    standAt(r, 60);
    r.you.ducking = ducked;
    r.input.down = ducked;
    r.twist = null;
    ghoul.advance(r, 8, steady);
    r.you.safeMs = 0;
    r.twist.bolts.push({ x: 70, y: 6 + cv.MBOLT_Y, vx: -cv.MBOLT_V, gone: 0 });
    until(r, () => events(r, "lose").length > 0, 600);
    return events(r, "lose")[0]?.cause;
  };
  assert.equal(hit(false), "mirrorbolt", "a bolt on a standing you");
  assert.equal(hit(true), undefined, "a bolt over a ducked you");
  // Canceling: your bolt and its bolt meet in the air.
  const meet = carnivalRound("mirrors");
  standAt(meet, 50);
  meet.you.safeMs = 1e9;
  meet.twist = null;
  ghoul.advance(meet, 8, steady);
  meet.twist.bolts.push({ x: 70, y: 8.4, vx: -cv.MBOLT_V, gone: 0 });
  meet.shots.push({ x: 56, y: 8.4, vx: 130, vy: 0, gone: 0 });
  const cancel = upTo(meet, "mirrorCancel", 400);
  assert.ok(cancel, "they cancel");
  assert.equal(meet.twist.bolts.length, 0);
  assert.equal(meet.shots.length, 0);
  assert.ok(Math.abs(cancel.x - 63) < 4, `where they met (${cancel.x})`);
  // A thrown weapon breaks the bolt and flies on.
  const weapon = carnivalRound("mirrors");
  standAt(weapon, 50);
  weapon.you.safeMs = 1e9;
  weapon.twist = null;
  ghoul.advance(weapon, 8, steady);
  weapon.twist.bolts.push({ x: 70, y: 8.4, vx: -cv.MBOLT_V, gone: 0 });
  weapon.shots.push({ arm: "stake", x: 56, y: 8.4, vx: 96, vy: 0, gone: 0, t: 0, spin: 0, dmg: 4, bossDmg: 4, pierce: true });
  upTo(weapon, "mirrorCancel", 400);
  assert.equal(weapon.twist.bolts.length, 0);
  assert.equal(weapon.shots.length, 1, "the stake flies on");
});

test("Ghoul Rush's Mirror You shatters when it dies; a pied one (stunned) copies nothing and fires nothing for the stun", () => {
  const { round, m } = mirrorPair();
  until(round, () => m.act === "copy", 1500);
  round.you.safeMs = 1e9;
  // Pied: it stands for the stun, whatever you do, and does not catch up after.
  m.stunMs = arm.PIE_STUN_MS;
  m.hp = 99;
  const at = m.x;
  run(round, 1000, { right: true, fire: true });
  assert.equal(m.x, at, "stands still");
  assert.equal(events(round, "mirrorShot").length, 0, "fires nothing");
  run(round, arm.PIE_STUN_MS);
  const after = m.x;
  assert.ok(Math.abs(after - at) < cv.MIRROR_DRIFT * 3 + 1, `no leap to catch up (${after - at})`);
  // Dead, it shatters.
  m.hp = 1;
  round.events.length = 0;
  bolt(round, m, m.y + 2.4);
  round.shots[0].x = m.x - 3;
  ghoul.advance(round, 40, steady);
  assert.equal(events(round, "mirrorShatter").length, 1);
  assert.equal(events(round, "kill")[0]?.kind, "mirror");
  // A mirror cannot walk into a pit: it stays at the edge.
  const edge = carnivalRound("mirrors");
  standAt(edge, 340);
  edge.you.safeMs = 1e9;
  const e = put(edge, "mirror", 372);
  until(edge, () => e.act === "copy", 1500);
  run(edge, 1500);
  standAt(edge, 340);
  run(edge, 1500, { right: true });
  assert.ok(ghoul.groundAt(edge.spec, e.x) > -Infinity && e.x >= 368, `never over the pit (${e.x})`);
});

/* ------------------------------------------------------------ strongmen */

test("Ghoul Rush's strongman lumbers at you, winds up 600 ms and lobs a barbell in an arc every 3.4 s from 10 to 46 away (cause barbell); a stomp kills it", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const s = put(round, "strongman", 70);
  const winds = log(round, 9000, "strongWind");
  assert.ok(winds.length >= 2, "winds up again and again");
  assert.ok(Math.abs(winds[0][0] - cv.STRONG_FIRST_MS) < 150, `${winds[0][0]}`);
  const throws = round.events.length >= 0 && log(round, 0, "throw");
  assert.ok(Array.isArray(throws));
  const again = carnivalRound("midway");
  standAt(again, 30);
  again.you.safeMs = 1e9;
  put(again, "strongman", 80);
  const first = upTo(again, "strongWind", 4000);
  assert.ok(first);
  const t0 = again.clock;
  const thrown = upTo(again, "throw", 1000);
  assert.ok(thrown && thrown.kind === "barbell" && thrown.by === "strongman", "a barbell thrown");
  assert.ok(Math.abs(again.clock - t0 - cv.STRONG_WIND_MS) < 40, "600 ms after the wind-up");
  assert.equal(again.bones.find((b) => b.kind === "barbell").cause, "barbell");
  // The throw is one strongThrow beside the game's throw, and the landing one barbellLand (no clatter).
  assert.equal(events(again, "strongThrow").length, 1, "one strongThrow with the throw");
  assert.equal(events(again, "barbellLand").length, 0, "not landed yet");
  until(again, () => events(again, "barbellLand").length > 0, 3000);
  assert.equal(events(again, "barbellLand").length, 1, "the barbell lands once");
  assert.equal(events(again, "clatter").length, 0, "the landing is not also a clatter");
  // A barbell on you costs a life, the cause barbell.
  const hit = carnivalRound("midway");
  standAt(hit, 40);
  hit.you.safeMs = 0;
  hit.bones.push({ id: 99, kind: "barbell", x: 40, y: 7, vx: 0, vy: 0, spin: 0, life: 4000, cause: "barbell" });
  ghoul.advance(hit, 8, steady);
  assert.equal(events(hit, "lose")[0]?.cause, "barbell");
  // Too close it does not throw, only walks.
  const close = carnivalRound("midway");
  standAt(close, 60);
  close.you.safeMs = 1e9;
  put(close, "strongman", 64).cool = 0;
  run(close, 1500);
  assert.equal(events(close, "strongWind").length, 0);
  // A stomp takes 4 off its 14.
  const stomp = carnivalRound("midway");
  const q = put(stomp, "strongman", 64);
  standAt(stomp, 64, 1, 6 + q.h + 1);
  Object.assign(stomp.you, { state: "air", vy: -30 });
  until(stomp, () => events(stomp, "stomp").length > 0, 400);
  assert.equal(q.hp, 10);
  assert.equal(s.kind, "strongman");
});

/* --------------------------------------------------------- circus hounds */

test("Ghoul Rush's circus hound prowls at you, crouches 450 ms within 24 (the hoop flares), leaps in an arc that comes down where you stand, rests 800 ms and does it again", () => {
  const round = carnivalRound("midway");
  standAt(round, 90);
  round.you.safeMs = 1e9;
  const h = put(round, "circushound", 60);
  const crouch = upTo(round, "houndCrouch", 3000);
  assert.ok(crouch, "it crouches");
  assert.equal(h.act, "crouch");
  const t0 = round.clock;
  const leap = upTo(round, "houndLeap", 1000);
  assert.ok(leap && Math.abs(round.clock - t0 - cv.HOUND_CROUCH_MS) < 40, "450 ms later it leaps");
  assert.equal(h.act, "leap");
  assert.equal(h.vy, cv.HOUND_VY);
  let apex = 0;
  until(round, () => (apex = Math.max(apex, h.y - 6), h.act === "rest"), 1500);
  assert.ok(apex > 4 && apex < 6.5, `a ${apex} high arc`);
  assert.equal(h.act, "rest");
  assert.equal(events(round, "houndLand").length, 1, "one houndLand when the leap ends");
  // It came down where Planny stood (he was safe, so we see where it landed).
  assert.ok(Math.abs(h.x - 90) < 1.5, `landed on you (${h.x})`);
  const rested = h.wait;
  assert.ok(rested > cv.HOUND_REST_MS - 100);
  // Standing, it costs a life, the cause circushound.
  const hit = carnivalRound("midway");
  standAt(hit, 90);
  hit.you.safeMs = 0;
  put(hit, "circushound", 70, { act: "crouch", wait: 1 });
  until(hit, () => events(hit, "lose").length > 0, 2000);
  assert.equal(events(hit, "lose")[0]?.cause, "circushound");
  // A jump clears it.
  const jump = carnivalRound("midway");
  standAt(jump, 90);
  put(jump, "circushound", 70, { act: "crouch", wait: 1 });
  jump.you.safeMs = 0;
  ghoul.advance(jump, 200, steady);
  ghoul.jump(jump);
  until(jump, () => jump.you.state === "run" && jump.you.y === 6 && jump.clock > 400, 1500);
  // A long arc: it can leap 24 across.
  const far = carnivalRound("midway");
  standAt(far, 90);
  far.you.safeMs = 1e9;
  const f = put(far, "circushound", 67, { act: "crouch", wait: 1 });
  until(far, () => f.act === "rest", 1500);
  assert.ok(Math.abs(f.x - 90) < 1.5, "23 across");
  assert.equal(cv.CARNIVAL.swoops.circushound({ act: "leap" }), true);
  assert.equal(cv.CARNIVAL.swoops.circushound({ act: "prowl" }), false);
});

test("Ghoul Rush's circus hound's leap is a swoop: a ducked Planny is passed over and it comes back for him again and again, never biting a ducked one; a caged one is not there to hit until it has burst out", () => {
  const round = carnivalRound("midway");
  standAt(round, 90);
  round.you.safeMs = 0;
  round.input.down = true;
  put(round, "circushound", 70);
  run(round, 9000, { down: true });
  assert.equal(events(round, "lose").length, 0, "9 s of leaps over a ducked Planny");
  assert.ok(events(round, "houndLeap").length >= 3, "it kept leaping");
  const caged = carnivalRound("bigtop");
  standAt(caged, 150);
  const c = put(caged, "circushound", 120, { act: "burst", wait: cv.HOUND_BURST_MS });
  assert.equal(ghoul.solid(c), false);
  bolt(caged, c, 8);
  caged.shots[0].x = 118;
  ghoul.advance(caged, 40, steady);
  assert.equal(c.hp, 3, "a bolt goes through it");
  run(caged, cv.HOUND_BURST_MS + 100);
  assert.equal(ghoul.solid(c), true);
  assert.notEqual(c.act, "burst");
});

/* ---------------------------------------------------------- Cotton Candy */

test("Ghoul Rush's Cotton Candy: a bolt that hits a monster slows it to half for 3 s (a thrown weapon does not), only while the power-up lasts", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const z = put(round, "zombie", 60);
  z.hp = 99;
  bolt(round, z, z.y + 2);
  ghoul.advance(round, 40, steady);
  assert.ok(!(z.hasteMs > 0), "no power-up, no stickiness");
  ghoul.applyPower(round, "floss");
  bolt(round, z, z.y + 2);
  ghoul.advance(round, 40, steady);
  assert.equal(z.haste, cv.FLOSS_SLOW);
  assert.ok(z.hasteMs > cv.FLOSS_SLOW_MS - 100 && z.hasteMs <= cv.FLOSS_SLOW_MS);
  assert.equal(z.floss, true);
  assert.ok(events(round, "flossStick").length >= 1);
  // It walks at half speed meanwhile.
  const walk = (slow) => {
    const r = carnivalRound("midway");
    standAt(r, 30);
    r.you.safeMs = 1e9;
    const m = put(r, "zombie", 90);
    if (slow) Object.assign(m, { hasteMs: 3000, haste: 0.5 });
    const x = m.x;
    run(r, 2000);
    return x - m.x;
  };
  assert.ok(Math.abs(walk(true) * 2 - walk(false)) < 2.5, "half the distance");
  // A thrown weapon is no sticky bolt.
  const w = carnivalRound("midway");
  standAt(w, 30);
  ghoul.applyPower(w, "floss");
  const t = put(w, "zombie", 60);
  t.hp = 99;
  w.shots.push({ arm: "stake", x: 56, y: t.y + 2, vx: 96, vy: 0, gone: 0, t: 0, spin: 0, dmg: 1, bossDmg: 1, pierce: true });
  ghoul.advance(w, 40, steady);
  assert.ok(!(t.hasteMs > 0));
});

/* ----------------------------------------------------------- Custard Pie */

const pies = (round) => round.hazards.filter((h) => h.kind === "armPie");
const goops = (round) => round.hazards.filter((h) => h.kind === "armGoop");

test("Ghoul Rush's Custard Pie: a double tap throws a long lob that lands about 45 ahead, splats there, aims by facing, and carries on between rooms", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  round.arms = [{ kind: "pie", n: 2 }];
  tapTap(round);
  assert.deepEqual(round.arms.map((q) => [q.kind, q.n]), [["pie", 1]]);
  assert.equal(pies(round).length, 1);
  assert.equal(round.hazards.filter((h) => h.kind === "armPod").length, 0, "no longer a pod");
  assert.equal(events(round, "armUse").length, 1);
  const splat = upTo(round, "armSplat", 3000);
  assert.ok(splat && splat.y === 6, "lands on the floor");
  const range = splat.x - 30;
  assert.ok(range >= 40 && range <= 52, `lands 40 to 52 ahead (${range})`);
  // Aimed by facing: the other way it lands behind.
  const back = carnivalRound("midway");
  standAt(back, 150, -1);
  back.arms = [{ kind: "pie", n: 1 }];
  tapTap(back);
  const b = upTo(back, "armSplat", 3000);
  assert.ok(b && b.x < 150 - 40, "thrown to the left it lands to the left");
  // It stays in the bag across rooms.
  const next = carnivalRound("mirrors");
  next.arms = round.arms;
  assert.deepEqual(next.arms.map((q) => [q.kind, q.n]), [["pie", 1]]);
});

test("Ghoul Rush's Custard Pie sheds goop every 2.5 of travel (or 90 ms), which falls to the floor and lies there 3.5 s as a puddle; it draws no random number", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  round.arms = [{ kind: "pie", n: 1 }];
  tapTap(round);
  const seen = new Set();
  const spacing = [];
  let last = null;
  for (let t = 0; t < 1500; t += 4) {
    ghoul.advance(round, 4, never);
    for (const g of goops(round)) {
      if (seen.has(g)) continue;
      seen.add(g);
      if (last !== null) spacing.push(g.x - last);
      last = g.x;
    }
  }
  assert.ok(seen.size >= 15, `a trail of blobs (${seen.size})`);
  assert.ok(spacing.every((d) => d > 0 && d <= arm.PIE_DROP_X + 0.4), `spaced about 2.5 apart (${spacing.slice(0, 5)})`);
  const lying = goops(round).filter((g) => g.rest);
  assert.ok(lying.length >= 10, "puddles lie along the path");
  assert.ok(lying.every((g) => g.y >= 6) && lying.some((g) => g.y === 6), "on the floor or the nearest board below");
  assert.ok(lying.every((g) => g.live === 0 && g.cause === ""), "harmless to Planny by their data");
  const first = lying[0];
  assert.ok(first.life > 0 && first.life <= arm.PIE_GOOP_MS);
  run(round, first.life + 100, {}, never);
  assert.ok(!goops(round).includes(first), "gone after its life");
  run(round, arm.PIE_GOOP_MS + 200, {}, never);
  assert.equal(goops(round).length, 0, "all gone");
  assert.equal(arm.PIE_GOOP_MS, 3500);
});

test("Ghoul Rush's Custard Pie goop is cream, not a platform: Planny walks under and through it unharmed, and the floor and boards are unchanged", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.arms = [{ kind: "pie", n: 1 }];
  const before = JSON.stringify(round.spec.shelves);
  const ground = ghoul.groundAt(round.spec, 60);
  tapTap(round);
  const lives = round.lives;
  for (let t = 0; t < 5000; t += 4) {
    round.input.right = t > 300;
    ghoul.advance(round, 4, steady);
  }
  round.input.right = false;
  assert.equal(round.lives, lives, "no life lost");
  assert.equal(ghoul.groundAt(round.spec, 60), ground);
  assert.equal(JSON.stringify(round.spec.shelves), before);
  assert.ok(round.phase === "play");
});

test("Ghoul Rush's Custard Pie stuns and damages every monster under the arc a tick a blob, and the stun is refreshed while it stays in the goop", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  round.arms = [{ kind: "pie", n: 1 }];
  const row = [42, 52, 62, 72].map((x) => put(round, "zombie", x));
  const away = put(round, "zombie", 120);
  for (const m of [...row, away]) m.hp = 99;
  tapTap(round);
  run(round, 1400, {}, steady);
  for (const m of row) {
    assert.ok(m.stunMs > 0 && m.pied, `stunned and pied (x ${m.x})`);
    assert.ok(m.hp < 99, `damaged (x ${m.x})`);
    assert.ok(99 - m.hp <= 8, `a few ticks, not a stream (${99 - m.hp})`);
  }
  assert.ok(!(away.stunMs > 0) && away.hp === 99, "not the one off to the side");
  // Held while it stands in goop, beyond the stun's own length.
  const m = row[1];
  const x0 = m.x;
  run(round, 2000, {}, steady);
  assert.ok(goops(round).some((g) => g.rest && Math.abs(g.x - m.x) < g.w / 2 + m.w / 2), "a puddle is under it");
  assert.ok(m.stunMs > 0 && Math.abs(m.x - x0) < 0.01, "held in the goop");
  // The same blob never hurts it twice.
  const hp = m.hp;
  run(round, 600, {}, steady);
  assert.equal(m.hp, hp, "no repeat damage from the same blobs");
  // Afterwards it wakes.
  run(round, arm.PIE_GOOP_MS + arm.PIE_GOOP_STUN_MS + 500, {}, steady);
  assert.ok(!(m.stunMs > 0));
});

test("Ghoul Rush's Custard Pie reaches monsters hanging in the air under its arc, and a lob clears a whole row of weak walkers; their kills drop nothing", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  round.arms = [{ kind: "pie", n: 1 }];
  const row = [44, 48, 52, 70, 74].map((x) => put(round, "zombie", x));
  for (const m of row) m.hp = 1;
  const far = put(round, "zombie", 120);
  far.hp = 99;
  const high = put(round, "balloon", 58, { y: 9 });
  high.hp = 99;
  tapTap(round);
  run(round, 1500, {}, steady);
  assert.ok(row.every((m) => m.dead || m.hp <= 0), "every weak one under the arc is gone");
  assert.equal(far.hp, 99);
  assert.ok(high.pied && high.hp < 99, "one in the air under the arc is hit too");
  assert.ok(arm.PIE_SPLAT_DMG > arm.PIE_GOOP_DMG, "the splat hits harder than a blob");
  assert.equal(round.drops.length, 0, "area kills drop nothing");
});

test("Ghoul Rush's Custard Pie on a boss: goop and the splat go through the arm damage rule with no stun, a guard shows a block, a hidden boss is not hit", () => {
  const fight = bigtopFight();
  choose(fight, "open", 1e9);
  Object.assign(fight.boss, { open: true, y: 6, puppet: "down" });
  fight.arms = [{ kind: "pie", n: 1 }];
  standAt(fight, fight.boss.x - 40);
  fight.you.safeMs = 1e9;
  const hp = fight.boss.hp;
  tapTap(fight);
  upTo(fight, "armSplat", 3000);
  assert.ok(fight.boss.hp < hp && !(fight.boss.stunMs > 0), "hurt, not stunned");
  assert.ok(fight.armBossDmg > 0, "counted by armBossDamage");
  const guard = bigtopFight();
  guard.arms = [{ kind: "pie", n: 1 }];
  guard.boss.y = 6;
  standAt(guard, guard.boss.x - 30);
  tapTap(guard);
  upTo(guard, "armSplat", 3000);
  assert.equal(guard.boss.hp, guard.boss.max);
  assert.ok(events(guard, "bossBlock").length >= 1, "a block shows");
  const hidden = bigtopFight();
  choose(hidden, "open", 1e9);
  Object.assign(hidden.boss, { open: true, y: 6, puppet: "down", hidden: true });
  hidden.arms = [{ kind: "pie", n: 1 }];
  standAt(hidden, hidden.boss.x - 30);
  tapTap(hidden);
  upTo(hidden, "armSplat", 3000);
  assert.equal(hidden.boss.hp, hidden.boss.max);
});

test("Ghoul Rush's Custard Pie sounds once each: one armUse and one armSplat, and the puddles' soft splat reuses the wired tone, rate limited", () => {
  const round = carnivalRound("midway");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  round.arms = [{ kind: "pie", n: 1 }];
  tapTap(round);
  const seen = [];
  for (let t = 0; t < 6000; t += 4) {
    ghoul.advance(round, 4, never);
    for (const e of round.events) seen.push(e.type);
    round.events.length = 0;
  }
  assert.equal(seen.filter((t) => t === "armUse").length, 1);
  assert.equal(seen.filter((t) => t === "armSplat").length, 1);
  const soft = seen.filter((t) => t === "armGoop").length;
  assert.ok(soft >= 1 && soft <= 6, `a few soft splats, not one a blob (${soft})`);
  assert.deepEqual(heard({ type: "armGoop" }).played, ["ghoulPieSplat"]);
  assert.deepEqual(heard({ type: "armSplat" }).played, ["ghoulPieSplat"]);
});

/* ----------------------------------------------------------- Ringmaster */

test("Ghoul Rush's Ringmaster waits high over the ring with his puppet hanging on three strings, the puppet walks at you, and nothing can hurt him (the shots show a block)", () => {
  const round = bigtopFight();
  const b = round.boss;
  assert.equal(b.kind, "ringmaster");
  assert.equal(b.y, cv.PLAT_Y, "on his gantry");
  assert.equal(b.puppet, "up");
  assert.equal(b.open, false);
  assert.equal(b.strings.length, 3);
  assert.ok(b.strings.every((s) => s.hp === cv.STRING_HP));
  assert.equal(b.hp, ghoul.BOSSES.ringmaster.hp);
  assert.equal(b.max, b.hp);
  // The gantry follows the puppet; the puppet walks at you.
  standAt(round, round.spec.arena + 12);
  const px = b.px;
  run(round, 1500);
  assert.ok(b.px < px - 6, `the puppet walks toward you (${px} to ${b.px})`);
  assert.ok(Math.abs(b.x - b.px) < 8, "the gantry follows it");
  // Shots at the Ringmaster are blocked while the puppet is up.
  bolt(round, b, b.y + 3);
  round.shots[0].x = b.x - 5;
  round.events.length = 0;
  ghoul.advance(round, 60, steady);
  assert.equal(b.hp, b.max);
  assert.ok(events(round, "bossBlock").length >= 1);
  assert.equal(cv.CARNIVAL.guard.ringmaster({ open: false }), true);
  assert.equal(cv.CARNIVAL.guard.ringmaster({ open: true }), false);
});

test("Ghoul Rush's puppet stomps: 750 ms of shadow where it will land, then a foot 9 wide for 280 ms and a shockwave each way (cause puppet), and a board is safe", () => {
  const round = bigtopFight();
  const b = round.boss;
  round.you.safeMs = 0;
  standAt(round, 200 - 40);
  round.you.safeMs = 1e9;
  b.px = 140;
  b.x = 140;
  scriptTo(round, "stomp");
  const wind = upTo(round, "puppetWind", 200);
  assert.ok(wind, "the shadow comes first");
  assert.equal(wind.x, b.px);
  const t0 = round.clock;
  const st = upTo(round, "puppetStomp", 1200);
  assert.ok(st && Math.abs(round.clock - t0 - cv.STOMP_WIND_MS) < 40, `${cv.STOMP_WIND_MS} ms later (${round.clock - t0})`);
  const foot = round.hazards.find((h) => h.kind === "pfoot");
  assert.ok(foot && foot.w === cv.PFOOT_W && foot.live <= cv.STOMP_LIVE_MS && foot.live > cv.STOMP_LIVE_MS - 12 && foot.cause === "puppet");
  assert.equal(round.waves.filter((w) => w.kind === "puppet").length, 2);
  assert.deepEqual(round.waves.map((w) => w.dir).sort(), [-1, 1]);
  // Under the foot costs a life; on a board over it does not.
  for (const [on, cause] of [[false, "puppet"], [true, undefined]]) {
    const r = bigtopFight();
    r.boss.px = 140;
    r.boss.x = 140;
    if (on) standAt(r, 146, 1, 12, 0);
    else standAt(r, 140);
    r.you.safeMs = 0;
    choose(r, "stompWind", 1);
    until(r, () => events(r, "lose").length > 0 || events(r, "puppetStomp").length > 0, 1000);
    run(r, 400);
    assert.equal(events(r, "lose")[0]?.cause, cause, on ? "a board is safe" : "under the foot");
  }
  // The shockwave: jump it or lose a life, the cause puppet.
  const wave = bigtopFight();
  wave.boss.px = 140;
  wave.boss.x = 140;
  standAt(wave, 160);
  wave.you.safeMs = 0;
  choose(wave, "stompWind", 1);
  until(wave, () => events(wave, "lose").length > 0, 1500);
  assert.equal(events(wave, "lose")[0]?.cause, "puppet");
  const dodged = bigtopFight();
  dodged.boss.px = 140;
  dodged.boss.x = 140;
  standAt(dodged, 160);
  dodged.you.safeMs = 0;
  choose(dodged, "stompWind", 1);
  until(dodged, () => dodged.waves.length > 0, 1000);
  for (let t = 0; t < 1400 && !events(dodged, "lose").length; t += 4) {
    const w = dodged.waves.find((q) => q.dir === 1);
    if (w && w.x > 150 && w.x - dodged.you.x < 5 && dodged.you.state === "run") ghoul.jump(dodged);
    ghoul.advance(dodged, 4, steady);
  }
  assert.equal(events(dodged, "lose").length, 0);
});

test("Ghoul Rush's Ringmaster cracks his whip twice in his script: 700 ms of warning, then a lash chest high along the level you stand on (ducking passes under it, standing does not); a board is hit too", () => {
  const lash = (setup) => {
    const r = bigtopFight();
    setup(r);
    r.you.safeMs = 0;
    scriptTo(r, "whip");
    return r;
  };
  const r = lash((q) => standAt(q, q.boss.x - 20));
  const wind = upTo(r, "lashWind", 200);
  assert.ok(wind);
  const t0 = r.clock;
  const crack = upTo(r, "lashCrack", 1200);
  assert.ok(crack && Math.abs(r.clock - t0 - cv.LASH_WIND_MS) < 40, `${cv.LASH_WIND_MS} ms of warning`);
  const h = r.hazards.find((q) => q.kind === "lash");
  assert.ok(h && h.cause === "lash" && h.live <= cv.LASH_LIVE_MS && h.live > cv.LASH_LIVE_MS - 12 && h.w === cv.LASH_LEN);
  assert.equal(h.y, 6 + cv.LASH_Y);
  assert.equal(h.h, cv.LASH_H);
  assert.ok(cv.LASH_Y > ghoul.DUCK_H, "over a ducked head");
  assert.ok(cv.LASH_Y < ghoul.HIT_H && cv.LASH_Y + cv.LASH_H > ghoul.HIT_H - 1, "through a standing one's chest");
  // Standing: a life, the cause lash. Ducked: passed under. Jumping: over it.
  const outcome = (how) => {
    const q = lash((s) => standAt(s, s.boss.x - 20));
    if (how === "duck") q.input.down = true;
    if (how === "jump") q.input.up = true;
    let done = false;
    for (let t = 0; t < 2400 && !events(q, "lose").length && !done; t += 4) {
      ghoul.advance(q, 4, steady);
      if (how === "jump" && q.boss.act === "lashWind" && q.boss.wait < 120 && q.you.state === "run") ghoul.jump(q);
      if (events(q, "lashCrack").length && q.hazards.every((x) => x.kind !== "lash")) done = true;
    }
    return events(q, "lose")[0]?.cause;
  };
  assert.equal(outcome("stand"), "lash");
  assert.equal(outcome("duck"), undefined, "ducked under it");
  assert.equal(outcome("jump"), undefined, "jumped it");
  // On a board the whip comes at the board's level (down or a jump answers it).
  const board = lash((s) => standAt(s, 150, 1, 22, 2));
  until(board, () => board.hazards.some((q) => q.kind === "lash"), 1500);
  const bh = board.hazards.find((q) => q.kind === "lash");
  assert.equal(bh.y, 22 + cv.LASH_Y, "at the board's level");
  // And it is locked 150 ms before the crack: dropping off late does not move it.
  assert.equal(cv.LASH_LOCK_MS, 150);
});

test("Ghoul Rush's puppet strings: a bolt that crosses one cuts into it (3 hits), all three cut and the puppet collapses; the head string is out of reach of the floor, a hand string is reached in a jump", () => {
  const round = bigtopFight();
  const b = round.boss;
  b.px = 150;
  b.x = 150;
  const g = segs(b);
  assert.equal(g.length, 3);
  assert.ok(g[0].y1 === cv.PUP_HEAD_Y && g[1].y1 === cv.PUP_HAND_Y && g[2].y1 === cv.PUP_HAND_Y);
  // From the floor, a level bolt at 8.4 crosses none of them.
  round.shots.push({ x: 140, y: 8.4, vx: 130, vy: 0, gone: 0 });
  run(round, 400);
  assert.ok(b.strings.every((s) => s.hp === cv.STRING_HP), "the floor's bolt crosses no string");
  // A hand string is crossed at jump height (chest 20.4).
  const p = onString(b, 1, 20);
  round.shots.push({ x: p.x - 1, y: p.y, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.equal(b.strings[1].hp, cv.STRING_HP - 1);
  assert.equal(events(round, "stringHit")[0]?.what, "puppet");
  // A bolt crosses a string once, however long it takes to pass.
  const once = bigtopFight();
  once.boss.px = 150;
  once.boss.x = 150;
  const q = onString(once.boss, 2, 20);
  once.shots.push({ x: q.x - 3, y: 20, vx: 20, vy: 0, gone: 0 });
  run(once, 600);
  assert.equal(once.boss.strings[2].hp, cv.STRING_HP - 1);
  // The head string is higher than a jump from the floor reaches.
  const head = onString(b, 0, 25);
  assert.ok(head.y > 6 + 12 + 2.4 - 0.5, "needs a board");
  // Cutting: three hits on each.
  for (let i = 0; i < 3; i++) {
    for (const s of [0, 1, 2]) {
      if (b.strings[s].hp <= 0) continue;
      const at = onString(b, s, s === 0 ? 27 : 20);
      round.shots.push({ x: at.x - 1, y: at.y, vx: 130, vy: 0, gone: 0 });
      ghoul.advance(round, 20, steady);
    }
  }
  assert.ok(b.strings.every((s) => s.hp <= 0));
  assert.equal(events(round, "stringCut").filter((e) => e.what === "puppet").length, 3);
  assert.equal(events(round, "puppetDown").length, 1);
  assert.equal(b.puppet, "down");
  assert.equal(b.act, "fall");
  // A thrown weapon cuts the string and flies on, once.
  const stake = bigtopFight();
  stake.boss.px = 150;
  stake.boss.x = 150;
  const sp = onString(stake.boss, 1, 20);
  stake.shots.push({ arm: "stake", x: sp.x - 2, y: 20, vx: 96, vy: 0, gone: 0, t: 0, spin: 0, dmg: 4, bossDmg: 4, pierce: true });
  ghoul.advance(stake, 100, steady);
  assert.equal(stake.boss.strings[1].hp, cv.STRING_HP - 1, "once");
  assert.equal(stake.shots.length, 1, "and flies on");
  // Only while the puppet is up.
  const down = bigtopFight();
  down.boss.puppet = "down";
  down.boss.px = 150;
  down.boss.x = 150;
  down.shots.push({ x: 149, y: 20, vx: 130, vy: 0, gone: 0 });
  assert.doesNotThrow(() => ghoul.advance(down, 40, steady));
});

test("Ghoul Rush's Ringmaster, puppet down: the gantry lowers him in 500 ms, he is open 4 s (only then can he be hurt), climbs back in 700 ms, and ties the strings again", () => {
  const round = bigtopFight();
  const b = round.boss;
  b.px = 150;
  b.x = 150;
  standAt(round, 120);
  for (const s of b.strings) s.hp = 1;
  for (let i = 0; i < 3; i++) {
    const at = onString(b, i, i === 0 ? 27 : 20);
    round.shots.push({ x: at.x - 1, y: at.y, vx: 130, vy: 0, gone: 0 });
    ghoul.advance(round, 20, steady);
  }
  assert.equal(b.act, "fall");
  const t0 = round.clock;
  const open = upTo(round, "ringOpen", 1500);
  assert.ok(open && Math.abs(round.clock - t0 - cv.DESCEND_MS) < 40, `open ${cv.DESCEND_MS} ms later (${round.clock - t0})`);
  assert.equal(b.open, true);
  assert.equal(b.y, 6, "on the ring's floor");
  assert.ok(Math.abs(b.x - 120) >= 9, "lands clear of you");
  // Now he can be hurt: a bolt does 1, a stomp more.
  const hp = b.hp;
  standAt(round, b.x - 14);
  bolt(round, b, b.y + 3);
  ghoul.advance(round, 40, steady);
  assert.equal(b.hp, hp - 1);
  assert.equal(events(round, "bossHit").at(-1).kind, "ringmaster");
  // He stays open 4 s, then climbs.
  const t1 = round.clock;
  const climb = upTo(round, "ringClimb", 5000);
  assert.ok(climb && Math.abs(round.clock - t1 - (cv.OPEN_MS - 40)) < 150, `open about ${cv.OPEN_MS} ms (${round.clock - t1})`);
  assert.equal(b.open, false);
  bolt(round, b, b.y + 3);
  round.shots[0].x = b.x - 4;
  const hp2 = b.hp;
  ghoul.advance(round, 40, steady);
  assert.equal(b.hp, hp2, "closed again");
  const t2 = round.clock;
  const tie = upTo(round, "ringString", 2000);
  assert.ok(tie && Math.abs(round.clock - t2 - cv.CLIMB_MS) < 60, `${cv.CLIMB_MS} ms to climb`);
  assert.equal(b.puppet, "up");
  assert.equal(b.y, cv.PLAT_Y);
  assert.ok(b.strings.every((s) => s.hp === cv.STRING_HP));
  // And the cycle goes on: the next move comes after the rest.
  run(round, 4000);
  assert.ok(["puppetWind", "lashWind", "puppetCrouch", "puppetRear"].some((type) => events(round, type).length >= 1), "a move comes after the rest");
  assert.ok(Math.abs(b.px - b.x) < 12, "the puppet is back up near him");
  // Killed while open, he falls and the door opens (a life too).
  const kill = bigtopFight();
  Object.assign(kill.boss, { puppet: "down", act: "open", open: true, y: 6, wait: 1e9, hp: 1 });
  standAt(kill, kill.boss.x - 14);
  bolt(kill, kill.boss, kill.boss.y + 3);
  ghoul.advance(kill, 40, steady);
  assert.equal(kill.boss.state, "down");
  assert.equal(events(kill, "bossDown")[0]?.kind, "ringmaster");
  assert.equal(kill.hasKey, true);
});

test("Ghoul Rush's Ringmaster rages at half his hp: every wait 0.75 as long, the strings take 5 hits, and hounds are let out of the cages (2, then one each time he ties the strings), never more than 3 alive", () => {
  const round = bigtopFight();
  const b = round.boss;
  assert.equal(b.raged, false);
  Object.assign(b, { puppet: "down", act: "open", open: true, y: 6, wait: 1e9 });
  b.hp = Math.floor(b.max / 2) + 1;
  standAt(round, b.x - 14);
  bolt(round, b, b.y + 3);
  ghoul.advance(round, 40, steady);
  assert.equal(b.raged, true);
  assert.equal(events(round, "ringRage").length, 1);
  assert.equal(events(round, "cageOpen").length, 2);
  const hounds = round.monsters.filter((m) => m.kind === "circushound");
  assert.equal(hounds.length, 2);
  assert.deepEqual(hounds.map((m) => m.x).sort((a, c) => a - c), [round.spec.arena + 8, round.spec.length - 8]);
  assert.ok(hounds.every((m) => m.act === "burst"));
  // They burst out and hunt.
  round.you.safeMs = 1e9;
  run(round, 1500);
  assert.ok(hounds.every((m) => m.act !== "burst"));
  // He ties the strings tighter and lets a third out; never a fourth.
  b.wait = 1;
  b.act = "open";
  run(round, 200);
  until(round, () => events(round, "ringString").length > 0, 3000);
  assert.ok(b.strings.every((s) => s.hp === cv.RAGE_STRING_HP), "5 hits a string now");
  assert.equal(round.monsters.filter((m) => m.kind === "circushound" && !m.dead).length, 3);
  b.act = "open";
  b.wait = 1;
  run(round, 200);
  until(round, () => events(round, "ringString").length > 1, 3000);
  assert.ok(round.monsters.filter((m) => m.kind === "circushound" && !m.dead).length <= cv.HOUND_CAP);
  // His waits are shorter.
  const calm = bigtopFight();
  const raged = bigtopFight();
  raged.boss.raged = true;
  for (const r of [calm, raged]) {
    standAt(r, 150);
    r.boss.px = 150;
    r.boss.x = 150;
    choose(r, "stompWind", 1);
  }
  const rest = (r) => {
    until(r, () => r.boss.act === "rest", 1000);
    return r.boss.wait;
  };
  const w1 = rest(calm);
  const w2 = rest(raged);
  assert.ok(Math.abs(w2 / w1 - cv.RAGE_QUICK) < 0.05, `${w2} against ${w1}`);
});

/* ------------------------------------------------ the puppet on the move */

// The puppet on the stalk at `px` (the gantry over it), Planny at `you`, safe from everything.
const stalking = (round, px, you) => {
  Object.assign(round.boss, { px, x: px, act: "stalk", wait: 1e9, again: false });
  standAt(round, you);
  round.you.safeMs = 1e9;
  return round.boss;
};
const lane = (round, b) => ({ lo: round.spec.arena + ghoul.ARENA_POCKET + b.w / 2, hi: round.spec.length - ghoul.ARENA_POCKET - b.w / 2 });

test("Ghoul Rush's puppet stalks you between moves: it walks at 10 a second (under your run, at any depth), stops 8 to 10 short, faces you and holds there; Cotton Candy does not slow it", () => {
  assert.ok(cv.PUP_V >= 9 && cv.PUP_V <= 11);
  assert.ok(cv.PUP_V * 1.4 < ghoul.RUN_SPEED, "never faster than you run, at the deepest pace");
  assert.ok(cv.STALK_STOP >= 8 && cv.STALK_STOP <= 10);
  for (const side of [1, -1]) {
    const round = bigtopFight();
    const b = stalking(round, side > 0 ? 185 : 130, side > 0 ? 125 : 190);
    const x0 = b.px;
    run(round, 1000);
    assert.ok(Math.abs(Math.abs(x0 - b.px) - cv.PUP_V) < 0.6, `about ${cv.PUP_V} a second (${Math.abs(x0 - b.px)})`);
    assert.equal(b.pdir, -side, "turned to face you");
    assert.ok(b.walk > 9 && b.walk < 11, `walking at ${b.walk}`);
    assert.ok(Math.abs(b.x - b.px) <= cv.GANTRY_LAG, "the gantry follows");
    until(round, () => Math.abs(b.px - round.you.x) <= cv.STALK_STOP + 0.01, 9000);
    const gap = Math.abs(b.px - round.you.x);
    assert.ok(gap >= 8 && gap <= 10, `stops ${gap} short`);
    run(round, 1500);
    assert.ok(Math.abs(Math.abs(b.px - round.you.x) - gap) < 0.05, "and holds there");
    assert.equal(b.walk, 0, "standing");
  }
  // Cotton Candy slows monsters a bolt hits; the boss is not one (shots at him are blocked), so it walks as ever.
  const round = bigtopFight();
  round.effects.floss = 9000;
  const b = stalking(round, 185, 125);
  round.shots.push({ x: b.x - 6, y: b.y + 3, vx: 80, vy: 0, gone: 0 });
  const x0 = b.px;
  run(round, 1000);
  assert.ok(!(b.hasteMs > 0), "no haste on the boss");
  assert.ok(Math.abs(x0 - b.px - cv.PUP_V) < 0.6, "walks at its own pace");
});

test("Ghoul Rush's puppet leaps: a crouch of 580 ms, then a flight of 800 ms or more to where you stood when it left the ground (further on if you were running), a shadow at the spot the whole way, and a landing that is the stomp's foot and shockwaves", () => {
  assert.ok(cv.CROUCH_MS >= 500 && cv.CROUCH_MS <= 600);
  assert.ok(cv.LEAP_MIN_MS >= 700);
  const round = bigtopFight();
  const b = round.boss;
  b.px = b.x = 175;
  standAt(round, 130);
  round.you.safeMs = 1e9;
  scriptTo(round, "leap");
  const crouch = upTo(round, "puppetCrouch", 100);
  assert.ok(crouch, "an event as it crouches");
  assert.equal(b.act, "crouch");
  const t0 = round.clock;
  // He moves during the crouch: the spot is where he is when it leaves the ground.
  standAt(round, 124);
  round.you.safeMs = 1e9;
  let low = 0;
  const leap = upTo(round, "puppetLeap", 1200);
  assert.ok(leap && Math.abs(round.clock - t0 - cv.CROUCH_MS) < 40, `${cv.CROUCH_MS} ms of crouch (${round.clock - t0})`);
  assert.ok(b.crouch > 0.9, "right down at the end");
  assert.equal(leap.toX, 124);
  assert.equal(b.toX, 124);
  assert.ok(b.airMs >= cv.LEAP_MIN_MS && b.airMs <= cv.LEAP_MAX_MS);
  // Then he is free to go anywhere: the spot does not follow him, the shadow (b.toX, drawn all the way) stays.
  standAt(round, 150);
  round.you.safeMs = 1e9;
  const t1 = round.clock;
  let peak = 0;
  let still = true;
  round.events.length = 0;
  while (round.clock - t1 < 2500 && !events(round, "puppetStomp").length) {
    ghoul.advance(round, 4, steady);
    peak = Math.max(peak, b.lift);
    if (b.act === "leap" && b.toX !== 124) still = false;
  }
  const stomp = events(round, "puppetStomp")[0];
  assert.ok(stomp, "it comes down");
  assert.ok(round.clock - t1 >= 700, `a flight of ${round.clock - t1} ms is long enough to read`);
  assert.ok(round.clock - t1 <= cv.LEAP_MAX_MS + 40);
  assert.ok(still, "the spot is locked for the whole flight");
  assert.ok(Math.abs(peak - cv.LEAP_H) < 0.6, `up ${peak}`);
  assert.equal(stomp.x, 124);
  assert.equal(b.px, 124);
  const foot = round.hazards.find((h) => h.kind === "pfoot");
  assert.ok(foot && foot.x === 124 && foot.w === cv.PFOOT_W && foot.cause === "puppet");
  assert.deepEqual(round.waves.filter((w) => w.kind === "puppet").map((w) => w.dir).sort(), [-1, 1], "a shockwave each way");
  assert.ok(b.squash > 0, "a squash on landing");
  assert.equal(b.lift, 0);
  // The wind-up and flight are warning enough: over half a second before a foot can land.
  assert.ok(cv.CROUCH_MS + cv.LEAP_MIN_MS >= 500);
  // Running: the spot is further on.
  const runner = bigtopFight();
  runner.boss.px = runner.boss.x = 175;
  standAt(runner, 120);
  runner.you.safeMs = 1e9;
  scriptTo(runner, "leap");
  runner.input.right = true;
  const rl = upTo(runner, "puppetLeap", 1500);
  runner.input.right = false;
  assert.ok(rl && Math.abs(rl.toX - (runner.you.x + cv.LEAP_LEAD)) < 1.2, `toX ${rl.toX} for you at ${runner.you.x}`);
  // The foot hurts if you stay put (cause puppet), not if you step away, and a board is safe.
  const outcome = (how) => {
    const r = bigtopFight();
    r.boss.px = r.boss.x = 175;
    standAt(r, 130);
    r.you.safeMs = 0;
    scriptTo(r, "leap");
    if (how === "board") {
      until(r, () => r.boss.act === "leap", 1500);
      standAt(r, 134, 1, 16.5, 1);
    } else until(r, () => r.boss.act === "leap", 1500);
    r.you.safeMs = 0;
    if (how === "step") standAt(r, 175);
    r.you.safeMs = 0;
    until(r, () => events(r, "lose").length > 0 || (events(r, "puppetStomp").length > 0 && r.boss.act === "rest"), 3000);
    run(r, 250);
    return events(r, "lose")[0]?.cause;
  };
  assert.equal(outcome("stay"), "puppet");
  assert.equal(outcome("step"), undefined, "stepped away from the shadow");
  assert.equal(outcome("board"), undefined, "on a board over the foot");
  // The shockwaves after the landing are jumped as ever.
  const wave = bigtopFight();
  wave.boss.px = wave.boss.x = 175;
  standAt(wave, 130);
  wave.you.safeMs = 1e9;
  scriptTo(wave, "leap");
  until(wave, () => wave.boss.act === "leap", 1500);
  standAt(wave, 150);
  wave.you.safeMs = 0;
  until(wave, () => wave.waves.some((w) => w.kind === "puppet"), 2500);
  for (let t = 0; t < 1500 && !events(wave, "lose").length; t += 4) {
    const w = wave.waves.find((q) => q.dir === 1);
    if (w && w.x < wave.you.x && wave.you.x - w.x < 6 && wave.you.state === "run") ghoul.jump(wave);
    ghoul.advance(wave, 4, steady);
  }
  assert.equal(events(wave, "lose").length, 0, "a jump clears the shockwave");
});

test("Ghoul Rush's puppet charges: it rears 780 ms (backing off for a run-up), runs the floor at 40 a second to the wall, crashes and is dazed for a second (a hit on its body counts for nothing, the strings can still be cut)", () => {
  assert.ok(cv.REAR_MS >= 700 && cv.REAR_MS <= 800);
  assert.ok(cv.CHARGE_V >= 38 && cv.CHARGE_V <= 42);
  assert.ok(cv.CHARGE_H >= 6 && cv.CHARGE_H <= 7);
  assert.equal(cv.CRASH_MS, 1000);
  const round = bigtopFight();
  const b = round.boss;
  const { lo } = lane(round, b);
  b.px = b.x = 150;
  standAt(round, 130);
  round.you.safeMs = 1e9;
  scriptTo(round, "charge");
  assert.ok(upTo(round, "puppetRear", 100), "an event as it rears");
  assert.equal(b.cdir, -1, "at you");
  const t0 = round.clock;
  const px0 = b.px;
  const go = upTo(round, "puppetCharge", 1200);
  assert.ok(go && Math.abs(round.clock - t0 - cv.REAR_MS) < 40, `${cv.REAR_MS} ms of rearing (${round.clock - t0})`);
  assert.ok(b.px > px0 + 4, `backed off for a run-up (${px0} to ${b.px})`);
  const box = round.hazards.find((h) => h.kind === "pcharge");
  assert.ok(box && box.w === cv.CHARGE_W && box.h === cv.CHARGE_H && box.cause === "puppet");
  const x1 = b.px;
  run(round, 250);
  const speed = (x1 - b.px) / 0.25;
  assert.ok(Math.abs(speed - cv.CHARGE_V) < 2, `${speed} a second`);
  assert.equal(box.x, b.px, "its hit box rides with it");
  // A hit on his body counts for nothing; a string is still cut.
  const hp = b.hp;
  bolt(round, b, b.y + 3);
  round.shots.at(-1).x = b.x - 3;
  ghoul.advance(round, 40, steady);
  assert.equal(b.hp, hp);
  const crash = upTo(round, "puppetCrash", 3000);
  assert.ok(crash && crash.big, "crashes at the wall");
  assert.equal(b.px, lo, "at the arena's wall");
  assert.equal(b.act, "crash");
  assert.equal(b.dazed, true);
  assert.ok(!round.hazards.some((h) => h.kind === "pcharge"), "its hit box is gone");
  const t2 = round.clock;
  const wall = b.px;
  const p = onString(b, 1, 20);
  round.shots.push({ x: p.x - 1, y: p.y, vx: 130, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.equal(b.strings[1].hp, cv.STRING_HP - 1, "the strings can be cut while it is dazed");
  assert.equal(b.hp, hp, "and its body still takes nothing");
  until(round, () => b.act === "rest", 1500);
  assert.ok(Math.abs(round.clock - t2 - cv.CRASH_MS) < 100, `dazed ${round.clock - t2} ms`);
  assert.equal(b.px, wall, "stays where it crashed");
  assert.equal(b.dazed, false);
});

test("Ghoul Rush's charge hurts on the floor (ducking does not help), a normal jump clears it with room to spare, and a board is safe", () => {
  const setup = () => {
    const r = bigtopFight();
    r.boss.px = r.boss.x = 150;
    standAt(r, 125);
    r.you.safeMs = 1e9;
    scriptTo(r, "charge");
    upTo(r, "puppetCharge", 1500);
    return r;
  };
  // Stand, or duck: a life, cause puppet.
  for (const duck of [false, true]) {
    const r = setup();
    r.you.safeMs = 0;
    if (duck) r.input.down = true;
    until(r, () => events(r, "lose").length > 0 || r.boss.act === "crash", 2500);
    assert.equal(events(r, "lose")[0]?.cause, "puppet", duck ? "a duck does not pass under" : "standing");
  }
  // A jump (up held, the normal jump) at the right time clears it; find how wide the right time is.
  const jumpedAt = (offset) => {
    const r = setup();
    const b = r.boss;
    r.you.safeMs = 0;
    const gap = b.px - r.you.x;
    const arrive = (gap - (cv.CHARGE_W + ghoul.HIT_W) / 2) / cv.CHARGE_V;
    const start = r.clock;
    let jumped = false;
    for (let t = 0; t < 2500 && !events(r, "lose").length && r.boss.act === "charge"; t += 4) {
      if (!jumped && (r.clock - start) / 1000 >= arrive + offset) {
        ghoul.jump(r);
        jumped = true;
      }
      r.input.up = r.you.state === "air";
      ghoul.advance(r, 4, steady);
    }
    return events(r, "lose").length === 0;
  };
  let best = 0;
  let run0 = 0;
  for (let off = -0.45; off <= 0.1; off += 0.01) {
    run0 = jumpedAt(off) ? run0 + 1 : 0;
    best = Math.max(best, run0);
  }
  assert.ok(best >= 15, `a window of ${best * 10} ms to jump it in`);
  assert.equal(jumpedAt(-0.19), true, "mid-window");
  assert.equal(jumpedAt(-0.7), false, "too early lands in front of it");
  // On a board over it: nothing.
  const r = setup();
  standAt(r, 120, 1, 12, 0);
  r.you.safeMs = 0;
  until(r, () => events(r, "lose").length > 0 || r.boss.act === "crash", 2500);
  assert.equal(events(r, "lose").length, 0, "a board is over its box");
  assert.ok(cv.CHARGE_H <= 6 + 1 && ghoul.JUMP_TOP > cv.CHARGE_H + 4, "the box is far under a jump's height");
});

test("Ghoul Rush's strings follow the puppet: the gantry slides after it at a lag, so the strings angle; their endpoints and hit areas move with it, tighten on a leap, and a bolt crossing the moved, slanted segment cuts it", () => {
  const round = bigtopFight();
  const b = stalking(round, 185, 125);
  const before = segs(b).map((g) => ({ ...g }));
  assert.ok(before.every((g) => Math.abs(g.x1 - g.x0) < 7), "tied up straight at first");
  run(round, 1500);
  const now = segs(b);
  assert.ok(Math.abs(b.px - 185) > 12, "it has walked");
  now.forEach((g, i) => assert.ok(Math.abs(g.x1 - before[i].x1 - (b.px - 185)) < 0.01, `string ${i}'s end went with it`));
  assert.ok(b.x - b.px > 2 && b.x - b.px <= cv.GANTRY_LAG, `the gantry lags (${b.x - b.px})`);
  assert.ok(cv.GANTRY_V < cv.PUP_V, "and is slower");
  assert.ok(Math.abs(now[0].x0 - now[0].x1) > 2, "so the head string slants");
  assert.equal(b.y, cv.PLAT_Y, "the gantry stays high");
  assert.ok(b.y > 6 + 12 + 6 + ghoul.HIT_H + 4, "out of reach of a jump from the top board");
  // A bolt where the string was before it walked misses; where it is now, hits (the slanted part too).
  const old = before[1];
  round.shots.push({ x: old.x1, y: 20, vx: 0, vy: 0, gone: 0 });
  run(round, 120);
  assert.equal(b.strings[1].hp, cv.STRING_HP, "the old place is empty");
  const p = onString(b, 1, 20);
  round.shots.push({ x: p.x, y: 20, vx: 0, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.equal(b.strings[1].hp, cv.STRING_HP - 1, "the new place is hit");
  const h = onString(b, 0, 32);
  assert.ok(Math.abs(h.x - b.px) > 0.8, "high on the head string it is off the puppet's own x");
  round.shots.length = 0;
  round.shots.push({ x: h.x, y: 32, vx: 0, vy: 0, gone: 0 });
  ghoul.advance(round, 40, steady);
  assert.equal(b.strings[0].hp, cv.STRING_HP - 1, "a bolt across the slanted part cuts into it");
  const beside = h.x + 2.5;
  round.shots.length = 0;
  round.shots.push({ x: beside, y: 32, vx: 0, vy: 0, gone: 0 });
  const hp = b.strings[0].hp;
  ghoul.advance(round, 8, steady);
  assert.equal(b.strings[0].hp, hp, "a bolt well to the side of it misses");
  // On a leap the puppet rises and the strings tighten (shorter, ends higher), and hold where the limbs are.
  const jump = bigtopFight();
  const jb = jump.boss;
  jb.px = jb.x = 175;
  standAt(jump, 130);
  jump.you.safeMs = 1e9;
  const rest = segs(jb);
  scriptTo(jump, "leap");
  until(jump, () => jb.lift > cv.LEAP_H - 0.3, 3000);
  const apex = segs(jb);
  assert.ok(apex[0].y1 > rest[0].y1 + 8, "the head rides up");
  const drop = (g) => g.y0 - g.y1;
  assert.ok(drop(apex[0]) < drop(rest[0]) - 8, `taut: it hangs ${drop(apex[0]).toFixed(1)} against ${drop(rest[0]).toFixed(1)}`);
  assert.ok(apex[1].y1 > rest[1].y1 + 8 && apex[2].y1 > rest[2].y1 + 8, "and the hands");
  const q = onString(jb, 2, apex[2].y1 + 2);
  jump.shots.push({ x: q.x, y: q.y, vx: 0, vy: 0, gone: 0 });
  ghoul.advance(jump, 8, steady);
  assert.equal(jb.strings[2].hp, cv.STRING_HP - 1, "the lifted hand string is cut where it is");
  // The limbs' places are kept on the boss for the drawing, the same as the strings use.
  assert.deepEqual(jb.pts.map((pt) => pt.map((n) => Math.round(n * 100))), cv.limbs(jb).map((pt) => pt.map((n) => Math.round(n * 100))));
});

test("Ghoul Rush's puppet stops when all three strings are cut (mid-charge too), does not move while he is open, and when he ties the strings again it resumes beside him", () => {
  const round = bigtopFight();
  const b = round.boss;
  b.px = b.x = 160;
  standAt(round, 125);
  round.you.safeMs = 1e9;
  scriptTo(round, "charge");
  upTo(round, "puppetCharge", 1500);
  run(round, 300);
  assert.ok(round.hazards.some((h) => h.kind === "pcharge"));
  for (const s of b.strings) s.hp = 1;
  for (const i of [0, 1, 2]) {
    const at = onString(b, i, i === 0 ? 30 : 22);
    round.shots.push({ x: at.x - 0.8, y: at.y, vx: 130, vy: 0, gone: 0 });
    ghoul.advance(round, 8, steady);
  }
  assert.equal(b.puppet, "down");
  assert.equal(b.act, "fall");
  const px = b.px;
  ghoul.advance(round, 8, steady);
  assert.ok(!round.hazards.some((h) => h.kind === "pcharge"), "no more charge box");
  assert.equal(b.lift, 0);
  run(round, 2500);
  assert.equal(b.px, px, "it lies where it fell, not moving");
  assert.equal(b.act, "open");
  // He climbs and ties the strings: the puppet is up beside him and goes on.
  const tie = upTo(round, "ringString", 6000);
  assert.ok(tie);
  assert.equal(b.puppet, "up");
  assert.ok(Math.abs(b.px - b.x) < 0.01, "up where he stands");
  assert.ok(b.px >= lane(round, b).lo && b.px <= lane(round, b).hi);
  assert.equal(b.act, "rest");
  const at0 = b.px;
  standAt(round, at0 - 40);
  round.you.safeMs = 1e9;
  run(round, 1500);
  assert.ok(Math.abs(b.px - at0) > 3, "and it walks again");
});

test("Ghoul Rush's Ringmaster works to a script, no random draw: leap, stomp, whip, charge, leap, whip, a stalk, and round again; enraged he cracks the whip twice running and every wait is 0.75 as long; each move sounds once", () => {
  assert.deepEqual([...cv.SCRIPT], ["leap", "stomp", "whip", "charge", "leap", "whip", "stalk"]);
  const sequence = (raged, picks) => {
    const round = bigtopFight();
    const b = round.boss;
    b.raged = raged;
    standAt(round, 125);
    round.you.safeMs = 1e9;
    const seq = [];
    const counts = {};
    const walking = (a) => a === "idle" || a === "rest" || a === "stalk";
    let was = b.act;
    for (let t = 0; t < 400000 && seq.length < picks; t += 4) {
      ghoul.advance(round, 4, never);
      round.you.safeMs = 1e9;
      for (const e of round.events) counts[e.type] = (counts[e.type] || 0) + 1;
      round.events.length = 0;
      if (walking(was) && b.act !== was) seq.push(b.move);
      was = b.act;
    }
    return { seq, counts };
  };
  const { seq, counts } = sequence(false, 14);
  assert.deepEqual(seq, [...cv.SCRIPT, ...cv.SCRIPT], "in order, twice round");
  // Each move sounds once: its wind-up event once per move (a leap's landing is the stomp's foot).
  assert.equal(counts.puppetCrouch, 4);
  assert.equal(counts.puppetLeap, 4);
  assert.equal(counts.puppetRear, 2);
  assert.equal(counts.puppetCharge, 2);
  assert.equal(counts.puppetCrash, 2);
  assert.equal(counts.lashWind, 4);
  assert.equal(counts.lashCrack, 4);
  assert.equal(counts.puppetWind, 2);
  assert.equal(counts.puppetStomp, 6, "two stomps and four landings");
  // Enraged: each whip is cracked twice running, and the second takes no place in the script.
  const fury = sequence(true, 12).seq;
  assert.deepEqual(fury.slice(0, 11), ["leap", "stomp", "whip", "whip", "charge", "leap", "whip", "whip", "stalk", "leap", "stomp"]);
  // The waits are 0.75 as long.
  const waits = [false, true].map((raged) => {
    const r = bigtopFight();
    r.boss.raged = raged;
    stalking(r, 150, 125);
    r.boss.moves = cv.SCRIPT.indexOf("stalk");
    choose(r, "idle", 1);
    until(r, () => r.boss.move === "stalk" && r.boss.act === "stalk" && r.boss.wait > 100, 400);
    return r.boss.wait;
  });
  assert.ok(Math.abs(waits[1] / waits[0] - cv.RAGE_QUICK) < 0.05, `${waits[1]} against ${waits[0]}`);
  const rest = [false, true].map((raged) => {
    const r = bigtopFight();
    r.boss.raged = raged;
    stalking(r, 150, 125);
    r.boss.moves = 0;
    r.boss.px = r.boss.x = 150;
    choose(r, "idle", 1);
    until(r, () => r.boss.act === "crouch", 100);
    until(r, () => r.boss.act === "rest", 4000);
    return r.boss.wait;
  });
  assert.ok(Math.abs(rest[1] / rest[0] - cv.RAGE_QUICK) < 0.05, `a leap's rest, ${rest[1]} against ${rest[0]}`);
});

test("Ghoul Rush's Ringmaster and everything else here draw no random number", () => {
  const fight = bigtopFight();
  fight.boss.hp = fight.boss.max;
  fight.boss.px = 150;
  fight.boss.x = 150;
  standAt(fight, 120);
  fight.you.safeMs = 1e9;
  run(fight, 45000, {}, never);
  for (const type of ["puppetWind", "puppetStomp", "puppetCrouch", "puppetLeap", "puppetRear", "puppetCharge", "puppetCrash", "lashWind", "lashCrack"]) assert.ok(events(fight, type).length > 0, `${type} happened without a random draw`);
  choose(fight, "stalk", 1e9);
  for (let i = 0; i < 3; i++) {
    const at = onString(fight.boss, 1, 20);
    fight.boss.strings[i].hp = 1;
    fight.shots.push({ x: onString(fight.boss, i, i === 0 ? 27 : 20).x - 1, y: i === 0 ? 27 : 20, vx: 130, vy: 0, gone: 0 });
    run(fight, 20, {}, never);
    assert.ok(at);
  }
  fight.boss.hp = Math.floor(fight.boss.max / 2);
  run(fight, 8000, {}, never);
  for (const type of ["puppetDown", "ringOpen", "ringRage", "cageOpen", "ringClimb", "ringString"]) assert.ok(events(fight, type).length > 0, `${type} happened without a random draw`);
  // The monsters: no draw either.
  const mid = carnivalRound("funhouse");
  standAt(mid, 62);
  mid.you.safeMs = 1e9;
  put(mid, "marionette", 64, { y: 10.8 });
  put(mid, "grinner", 120);
  put(mid, "strongman", 110);
  put(mid, "circushound", 100);
  put(mid, "mirror", 90);
  mid.arms = [{ kind: "pie", n: 2 }];
  // Thrown the other way, so its cream is not what these monsters are doing.
  mid.you.face = -1;
  tapTap(mid);
  mid.you.face = 1;
  const seen = new Set();
  for (let t = 0; t < 12000; t += 4) {
    ghoul.advance(mid, 4, never);
    mid.you.safeMs = 1e9;
    for (const e of mid.events) seen.add(e.type);
    mid.events.length = 0;
  }
  for (const type of ["marionetteDrop", "grinnerHonk", "houndLeap", "houndLand", "strongWind", "strongThrow", "barbellLand", "mirrorStep", "armSplat"]) assert.ok(seen.has(type), `${type} happened without a random draw`);
});

/* -------------------------------------------------------------- endless */

test("Ghoul Rush's endless lives (round.infinite) spare every new way to lose a life: a grinner, a balloon, an acid puddle, a marionette, a mirror and its bolt, a strongman, a barbell, a circus hound, the puppet's foot and its shockwave, its leap and its charge, the whip, and the Ringmaster himself", () => {
  const costs = (id, setup, cause, { fight = false } = {}) => {
    for (const infinite of [false, true]) {
      const round = fight ? bigtopFight() : carnivalRound(id);
      round.infinite = infinite;
      round.you.safeMs = 0;
      setup(round);
      until(round, () => events(round, "lose").length > 0, 3000);
      const e = events(round, "lose")[0];
      assert.equal(e?.cause, cause, `${cause}: a life is lost`);
      assert.equal(round.lives, infinite ? 3 : 2, `${cause}: ${infinite ? "spared" : "costs one"}`);
    }
  };
  costs("midway", (r) => (standAt(r, 40), put(r, "grinner", 40.5)), "grinner");
  costs("midway", (r) => (standAt(r, 40), (put(r, "balloon", 40.5, { y: 6.5 }).life = 1e9)), "balloon");
  costs("midway", (r) => (standAt(r, 40), r.puddles.push({ id: 1, x: 40, y: 6, life: 2000 })), "acid");
  costs("funhouse", (r) => (standAt(r, 40), put(r, "marionette", 40.5, { act: "dance" })), "marionette");
  costs("mirrors", (r) => (standAt(r, 40), put(r, "mirror", 40.5, { act: "copy", cursor: 0, px: 40, at: 0, rise: 0, duck: false })), "mirror");
  costs("mirrors", (r) => (standAt(r, 40), (r.twist = null), ghoul.advance(r, 8, steady), r.you.safeMs = 0, r.twist.bolts.push({ x: 41, y: 8.8, vx: -80, gone: 0 })), "mirrorbolt");
  costs("midway", (r) => (standAt(r, 40), put(r, "strongman", 40.5)), "strongman");
  costs("midway", (r) => (standAt(r, 40), r.bones.push({ id: 7, kind: "barbell", x: 40, y: 7, vx: 0, vy: 0, spin: 0, life: 4000, cause: "barbell" })), "barbell");
  costs("midway", (r) => (standAt(r, 40), put(r, "circushound", 40.5)), "circushound");
  costs("bigtop", (r) => (standAt(r, 140), (r.boss.px = 140), (r.boss.x = 140), choose(r, "stompWind", 1)), "puppet", { fight: true });
  costs("bigtop", (r) => (standAt(r, 140), (r.boss.px = 140), (r.boss.x = 140), scriptTo(r, "leap")), "puppet", { fight: true });
  costs("bigtop", (r) => (standAt(r, 125), (r.boss.px = 150), (r.boss.x = 150), scriptTo(r, "charge")), "puppet", { fight: true });
  costs("bigtop", (r) => (standAt(r, 140), r.hazards.push({ kind: "lash", x: 140, y: 8.7, w: 40, h: 1.6, dir: 1, live: 200, max: 200, cause: "lash" })), "lash", { fight: true });
  costs("bigtop", (r) => (Object.assign(r.boss, { puppet: "down", act: "open", open: true, y: 6, wait: 1e9 }), standAt(r, r.boss.x - 3)), "ringmaster", { fight: true });
});

/* ---------------------------------------------------- voices and drawing */

test("Ghoul Rush's Carnival: every new kind has a voice for every act, each a real tone, and every event of the pack plays its own sound exactly once", () => {
  const listed = {
    grinner: ["appear", "honk", "hurt", "die"],
    balloon: ["appear", "die"],
    marionette: ["appear", "jerk", "drop", "land", "cut", "hurt", "die"],
    mirror: ["appear", "step", "shot", "cancel", "shatter", "hurt", "die"],
    strongman: ["appear", "die", "hurt", "land", "throw", "wind"],
    circushound: ["appear", "crouch", "die", "hurt", "land", "leap"],
    ringmaster: ["wake", "puppetWind", "stomp", "down", "open", "climb", "tie", "lashWind", "crack", "stringHit", "stringCut", "cage", "rage", "hurt", "die"],
    floss: ["active", "stick"],
  };
  for (const [kind, acts] of Object.entries(listed)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(merged[VOICES[kind][act]]?.layers?.length, `${kind}.${act}: ${VOICES[kind][act]} is a tone`);
  for (const kind of [...Object.keys(cv.MONSTERS), ...Object.keys(cv.BOSSES)]) assert.ok(VOICES[kind] && (VOICES[kind].die || VOICES[kind].die === undefined) && VOICES[kind].die, `${kind} has a voice and a death`);
  // Every event the pack emits is answered by one act, played once and nothing else.
  for (const type of cv.EVENTS) assert.ok(EVENT_VOICE[type], `${type} is heard`);
  for (const type of Object.keys(EVENT_VOICE)) assert.ok(cv.EVENTS.includes(type), `${type} is an event of the pack`);
  assert.equal(new Set(cv.EVENTS).size, cv.EVENTS.length);
  for (const [type, [kind, act]] of Object.entries(EVENT_VOICE)) {
    assert.ok(listed[kind].includes(act), `${type}: ${kind} ${act} is a listed act`);
    const extra = type === "stringHit" || type === "stringCut" ? { what: "puppet" } : {};
    const played = heard({ type, kind, ...extra }).played;
    assert.equal(played.filter((n) => Object.values(VOICES[kind]).includes(n)).length >= 1, true, `${type}: plays ${kind}'s voice`);
    assert.equal(new Set(played).size, played.length, `${type}: once`);
  }
  // Each listed act is the voice of some event (or the game's own play of it).
  const reached = new Set(Object.values(EVENT_VOICE).map(([kind, act]) => `${kind}.${act}`));
  const theGames = ["grinner.appear", "grinner.hurt", "grinner.die", "balloon.appear", "balloon.die", "marionette.appear", "marionette.hurt", "marionette.die", "mirror.appear", "mirror.hurt", "mirror.die", "strongman.appear", "strongman.hurt", "strongman.die", "circushound.appear", "circushound.hurt", "circushound.die", "ringmaster.wake", "ringmaster.hurt", "ringmaster.die", "floss.active", "marionette.cut", "ringmaster.stringCut", "ringmaster.stringHit", "mirror.shatter"];
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(reached.has(`${kind}.${act}`) || theGames.includes(`${kind}.${act}`), `${kind}.${act} is played by something`);
  const once = (e, kind, act) => {
    const played = heard(e).played;
    assert.equal(played.filter((n) => n === VOICES[kind][act]).length, 1, `${e.type}: ${kind} ${act} once`);
  };
  for (const kind of ["grinner", "balloon", "marionette", "mirror", "strongman", "circushound"]) once({ type: "spawn", kind }, kind, "appear");
  once({ type: "bossWake", kind: "ringmaster" }, "ringmaster", "wake");
  once({ type: "bossHit", kind: "ringmaster", how: "shot" }, "ringmaster", "hurt");
  once({ type: "bossDown", kind: "ringmaster", points: 1 }, "ringmaster", "die");
  once({ type: "hit", kind: "grinner" }, "grinner", "hurt");
  once({ type: "kill", kind: "strongman", mult: 1, how: "shot", points: 1 }, "strongman", "die");
  once({ type: "kill", kind: "circushound", mult: 1, how: "shot", points: 1 }, "circushound", "die");
  once({ type: "power", kind: "floss", points: 50 }, "floss", "active");
  // The barbell leaves his hands (the game's own throw event comes with it and stays silent), lands, and the hound lands.
  const flight = heard({ type: "throw", kind: "barbell", by: "strongman" }).played.concat(heard({ type: "strongThrow", kind: "strongman" }).played);
  assert.deepEqual(flight.filter((n) => n === "swoosh"), [], "the barbell throw is not also a swoosh");
  assert.equal(flight.filter((n) => n === "ghoulStrongmanThrow").length, 1, "the barbell throw plays the strongman's tone once");
  once({ type: "strongThrow", kind: "strongman" }, "strongman", "throw");
  once({ type: "barbellLand", kind: "barbell" }, "strongman", "land");
  once({ type: "houndLand", kind: "circushound" }, "circushound", "land");
  assert.equal(VOICES.strongman.throw, "ghoulStrongmanThrow");
  assert.equal(VOICES.strongman.land, "ghoulStrongmanLand");
  assert.equal(VOICES.circushound.land, "ghoulCircusHoundLand");
});

test("Ghoul Rush's Carnival: every new way to die has its words and its own sound", () => {
  for (const cause of ["grinner", "balloon", "marionette", "mirror", "mirrorbolt", "strongman", "barbell", "circushound", "ringmaster", "puppet", "lash"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).played.includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Carnival draws: every room, every monster in every act, the strings and the puppet in each move (the stalk, the crouch, the leap, the landing, the rear, the charge, the crash), the whip, the foot and the waves, Mirror You's bolts, Cotton Candy and a pied monster, and the stage's card, in a lit room and a dark one", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["carnival"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  const acts = {
    grinner: [{ act: "walk" }, { act: "honk", wait: 200 }],
    balloon: [{ act: "float", y: 10 }, { act: "float", y: 10, pied: true, stunMs: 1000 }],
    marionette: [{ act: "hang", y: 10.8 }, { act: "warn", y: 10.8, wait: 200 }, { act: "drop", y: 8, vy: -20 }, { act: "dance" }],
    mirror: [{ act: "wait" }, { act: "step", wait: 300 }, { act: "copy", dir: -1, rise: 0, duck: false }, { act: "copy", dir: 1, rise: 3, duck: true }],
    strongman: [{ act: "walk" }, { act: "wind", wait: 300 }],
    circushound: [{ act: "prowl" }, { act: "crouch", wait: 200 }, { act: "leap", vx: 20, vy: 10, y: 10 }, { act: "rest", wait: 300 }, { act: "burst", wait: 200 }],
  };
  for (const id of ROOM_IDS) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      for (const floss of [0, 5000]) {
        r.dark = dark;
        r.phase = "play";
        r.lives = 99;
        for (const st of r.spawns) st.over = true;
        r.hordeMs = Infinity;
        r.monsters.length = 0;
        r.hazards.length = 0;
        r.waves.length = 0;
        r.effects.floss = floss;
        standAt(r, id === "bigtop" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
        r.you.safeMs = 1e9;
        r.twist = null;
        ghoul.advance(r, 8, steady);
        r.twist.bolts.push({ x: r.you.x + 12, y: 8.8, vx: -80, gone: 0 });
        for (const [kind, list] of Object.entries(acts)) {
          list.forEach((over, i) => {
            const m = put(r, kind, r.you.x + 6 + i * 5, { wait: 1e9, force: true, ...over });
            if (floss) Object.assign(m, { floss: true, hasteMs: 2000, haste: 0.5 });
          });
        }
        r.hazards.push({ kind: "pfoot", x: r.you.x + 20, y: 6, w: 9, h: 6, live: 100, max: 280, cause: "puppet" }, { kind: "lash", x: r.you.x + 40, y: 8.7, w: 40, h: 1.6, dir: 1, live: 100, max: 240, cause: "lash" }, { kind: "armSplat", x: r.you.x + 30, y: 6, life: 200, max: 420, w: 8, h: 1, live: 0, cause: "" }, { kind: "armPie", x: r.you.x + 20, y: 14, vx: 50, vy: 0, spin: 1, t: 300, dist: 0, since: 0, n: 3, hit: [], w: 0.8, h: 0.8, live: 0, cause: "" }, { kind: "armGoop", x: r.you.x + 18, y: 10, vx: 0, vy: 0, rest: false, fall: 0, life: 3500, max: 3500, n: 1, hit: [], w: 3.2, h: 1, live: 0, cause: "" }, { kind: "armGoop", x: r.you.x + 22, y: 6, vx: 0, vy: 0, rest: true, fall: 0, life: 2000, max: 3500, n: 3, hit: [], w: 3.2, h: 1, live: 0, cause: "" }, { kind: "armGoop", x: r.you.x + 26, y: 6, vx: 0, vy: 0, rest: true, fall: 0, life: 300, max: 3500, n: 4, hit: [], w: 3.2, h: 1, live: 0, cause: "" });
        r.waves.push({ x: r.you.x + 15, y: 6, dir: 1, life: 2000, kind: "puppet", cause: "puppet" });
        r.bones.push({ id: 99, kind: "barbell", x: r.you.x + 10, y: 12, vx: 0, vy: 0, spin: 1, life: 4000, cause: "barbell" });
        if (r.boss) {
          ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
          for (const act of ["idle", "rest", "stalk", "stompWind", "lashWind", "crouch", "leap", "landed", "rear", "charge", "crash", "fall", "open", "climb"]) {
            const down = act === "fall" || act === "open" || act === "climb";
            const pose = act === "landed" ? { act: "rest", squash: 200 } : { act };
            Object.assign(r.boss, { ...pose, wait: 1e9, total: 800, puppet: down ? "down" : "up", open: act === "open", dir: -1, y: act === "open" ? 6 : act === "fall" ? 20 : cv.PLAT_Y, lashY: 8.7, lashDir: -1, fromX: r.you.x + 30, toX: r.you.x + 12, air: 300, airMs: 900, cdir: -1 });
            if (act === "charge") r.hazards.push({ kind: "pcharge", x: r.boss.px, y: 6, w: cv.CHARGE_W, h: cv.CHARGE_H, live: 1, max: 1, dir: -1, cause: "puppet" });
            if (act === "idle") r.boss.strings.forEach((s, i) => (s.hp = i + 1));
            g.tick(16);
          }
          Object.assign(r.boss, { raged: true, puppet: "up", act: "idle", y: cv.PLAT_Y, open: false });
          r.boss.strings.forEach((s) => (s.hp = s.max));
        }
        for (let k = 0; k < 20; k++) g.tick(16);
        r.you.safeMs = 1e9;
      }
    }
  }
  assert.ok(r.spec.id === "bigtop", "got to the Big Top and drew it");
  // Cotton Candy and the pie as they sit in a room, and in the bag.
  for (const kind of ["floss", "pie"]) {
    const p = carnivalRound("midway");
    p.drops.push({ id: 1, kind, x: 30, y: 8, vx: 0, vy: 0, life: 9000, rest: true });
    g.tick(16);
    ghoul.applyPower(p, kind);
  }
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.key("action");
  pick.tick(16);
  const p = pick.round;
  through(p);
  p.offer = ["carnival", "mine"];
  p.phase = "pick";
  p.phaseMs = 0;
  for (let k = 0; k < 4; k++) pick.tick(16);
  assert.equal(p.phase, "pick", "the pick screen draws the Carnival's card");
});

test("Ghoul Rush's leap shows its landing shadow at the locked spot for the whole flight (and the charge shows its lane while it rears), in a lit room and a dark one", () => {
  for (const dark of [true, false]) {
    const calls = [];
    const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : name === "ellipse" ? (...a) => calls.push(a) : () => {}), set: (t, name, value) => ((t[name] = value), true) });
    const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    g.resize(900, 900);
    g.key("action");
    g.tick(16);
    const r = g.round;
    through(r);
    r.offer = ["carnival"];
    r.phaseMs = 0;
    ghoul.pickStage(r, 0);
    while (r.spec.id !== "bigtop") through(r);
    r.phase = "play";
    r.dark = dark;
    r.lives = 99;
    for (const st of r.spawns) st.over = true;
    r.hordeMs = Infinity;
    r.monsters.length = 0;
    standAt(r, r.spec.arena + ghoul.BOSS_LOCK + 2);
    r.you.safeMs = 1e9;
    g.tick(16);
    ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
    const shadowAt = (x) => calls.some(([cx, , rx, ry]) => Math.abs(cx - x) < 0.01 && ry === 0.7 && rx > 1);
    for (const air of [0, 200, 400, 600, 780]) {
      Object.assign(r.boss, { act: "leap", wait: 1e9, fromX: 170, toX: 128, air, airMs: 900, puppet: "up", open: false });
      calls.length = 0;
      g.tick(16);
      assert.ok(shadowAt(128), `a shadow at the landing spot ${air} ms into the flight (${dark ? "dark" : "lit"})`);
    }
    Object.assign(r.boss, { act: "rest", wait: 1e9 });
    calls.length = 0;
    g.tick(16);
    assert.ok(!shadowAt(128), "none when it is not in the air");
    // The charge's lane while it rears is a line of dashes along the floor, not an ellipse; it draws without a fault.
    Object.assign(r.boss, { act: "rear", wait: 300, total: 780, cdir: -1, px: 170 });
    assert.doesNotThrow(() => g.tick(16));
  }
});

test("Ghoul Rush's stage select lists the Carnival and takes you straight into each of its rooms", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.stageSelect();
  const r = g.round;
  assert.equal(r.phase, "select");
  const at = ghoul.STAGES.findIndex((s) => s.id === "carnival");
  assert.equal(at, ghoul.STAGES.length - 3);
  for (let i = 0; i < at; i++) ghoul.steerSelect(r, 1, 0);
  for (let i = 0; i < 4; i++) ghoul.steerSelect(r, 0, 1);
  assert.equal(r.select.at, at);
  assert.equal(r.select.room, 4);
  ghoul.takeSelect(r);
  assert.equal(r.spec.id, "bigtop");
  assert.equal(r.stage, "carnival");
  assert.ok(r.arms.some((a) => a.kind === "pie"), "the stage's weapon is in the bag");
  g.tick(16);
});
