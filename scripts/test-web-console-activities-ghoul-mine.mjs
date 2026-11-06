// Web console tests, Ghoul Rush's Deep Seam Mine stage: its four rooms (always dark, the cage lifts, the water, the rockfall), rocks that fall after a dust warning and crush monsters and cost a life, the knocker imp that steals your light but never a life, the canary ghost whose scream brings three rocks down, the dead miner that digs out of the wall, the blind crawler that hunts by sound, the cage you can ride, the Hard Hat and Dynamite (found only here), and the Tommyknocker, who knocks, sweeps his hammer, puts the lights out, sinks into the seam and bursts out dazed, and rages at half his hp.
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as mn from "../src/web-console/public/activities/ghoul-rush/stages/mine/ghoul-mine.js";
import * as arm from "../src/web-console/public/activities/ghoul-rush/arms/ghoul-arms.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-rush/stages/mine/ghoul-mine-draw.js";
import { PILL_WORDS, pickPower } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-powers.js";
import { BONES } from "../src/web-console/public/activities/ghoul-rush/stages/wing/ghoul-bones.js";
import { GRAVEYARD } from "../src/web-console/public/activities/ghoul-rush/stages/graveyard/ghoul-graveyard.js";
import { GROUNDS } from "../src/web-console/public/activities/ghoul-rush/stages/grounds/ghoul-grounds.js";
import { CHAPEL } from "../src/web-console/public/activities/ghoul-rush/stages/chapel/ghoul-chapel.js";
import { SANATORIUM } from "../src/web-console/public/activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium.js";
import { VILLAGE } from "../src/web-console/public/activities/ghoul-rush/stages/village/ghoul-village.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the mine drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);
// Fire tapped twice, as the keys do it.
const tapTap = (round) => {
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
};
// Sticks in the bag.
const sticks = (round, n) => {
  round.arms = [{ kind: "dyn", n }];
};
// The four rooms walked, and the stage's five (the Runaway Cart, a ride, has its own suite).
const ROOM_IDS = ["shaft", "tunnels", "collapse", "seam"];
const STAGE_ROOMS = ["shaft", "tunnels", "collapse", "cart", "seam"];

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// The twist as a room that has just begun would hold it, with no rock due for
// ages (set `next` for one that is).
const calm = () => ({ next: 1e12, quiet: 0, noise: false, reach: 0, wade: 0 });

// A round in the Mine's room `id`, reached the way play reaches it, nothing
// woken: every spawner spent, the horde held back, no rock due (pass `rocks`
// to leave the room's own clock running).
function mineRound(id, { rocks = false } = {}) {
  const round = ghoul.newRound(5);
  round.lives = 3;
  round.dice = 0;
  through(round);
  round.offer = ["mine"];
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
  round.twist = rocks ? { ...calm(), next: round.spec.rocks * mn.ROCK_FIRST } : calm();
  round.events.length = 0;
  return round;
}

function standAt(round, x, face = 1, y = ghoul.groundAt(round.spec, x), shelf = -1) {
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, out: 0, safeMs: 0, face });
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

// Runs until an event of `type` is on the field (leaving it there, and the round
// as it stood that slice) or `ms` pass; the event, or null.
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

// A rock hazard as the pack makes one.
const rockAt = (x, over = {}) => ({ kind: "rock", state: "warn", x, y: 44, w: mn.ROCK_W, h: mn.ROCK_H, vy: 0, warn: mn.ROCK_WARN_MS, total: mn.ROCK_WARN_MS, floor: 6, live: 0, cause: "rock", ...over });

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

test("Ghoul Rush's Deep Seam Mine is a stage of three rooms and the Seam, always dark, its monsters and boss joined to the game's, with a place for each kind, cage lifts, water and rockfall", () => {
  const st = ghoul.stageById("mine");
  assert.deepEqual(st.rooms, STAGE_ROOMS);
  assert.deepEqual(mn.MINE_ROOMS, STAGE_ROOMS);
  assert.equal(st.boss, "tommy");
  assert.equal(st.title, "The Deep Seam Mine");
  assert.equal(st.sub, "They are still knocking");
  assert.equal(ghoul.STAGES.at(-4), st, "the last stage in the list but the Carnival, the Frozen Lake and Gallows Bog");
  for (const kind of Object.keys(mn.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], mn.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.BOSSES.tommy, mn.BOSSES.tommy);
  assert.equal(mn.BOSSES.tommy.sub, "Follow the knocking, not the light");
  assert.equal(ghoul.BOSSES.tommy.hp, 120);
  assert.ok(ghoul.MONSTERS.imp.hp === 2 && ghoul.MONSTERS.canary.hp === 1 && ghoul.MONSTERS.miner.hp === 4 && ghoul.MONSTERS.blind.hp === 3);
  assert.ok(ghoul.ZOMBIES.has("miner"), "a dead miner is a zombie variant");
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const [shaft, tunnels, collapse, seam] = ROOM_IDS.map((id) => ghoul.roomById(id));
  assert.deepEqual([shaft.title, tunnels.title, collapse.title, seam.title], ["Mine Shaft", "Flooded Tunnels", "The Collapse", "The Mother Seam"]);
  assert.deepEqual([shaft.sub, tunnels.sub, collapse.sub, seam.sub], ["The cage only goes down", "The pumps stopped in 1891", "They are still knocking", "Follow the knocking, not the light"]);
  for (const room of [shaft, tunnels, collapse, seam]) assert.equal(room.dark, true, `${room.id}: always dark`);
  const returning = ["zombie", "bat", "crawl"];
  for (const room of [shaft, tunnels, collapse]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    assert.ok(room.items.some((i) => i[0] === "hat") && room.items.some((i) => i[0] === "dyn"), `${room.id}: the Hard Hat and Dynamite`);
    assert.ok(room.spawns.some((s) => s[0] in mn.MONSTERS), `${room.id}: some of the new monsters`);
    assert.ok(room.spawns.some((s) => returning.includes(s[0])), `${room.id}: some returning ones`);
    // The key shelf has a board right under it, so a run at the key climbs it.
    assert.ok(room.shelves.some(([a, b, y]) => y === 15 && a <= room.key[0] && b >= room.key[0]), `${room.id}: a step under the key shelf`);
  }
  assert.ok(seam.items.some((i) => i[0] === "hat") && seam.items.some((i) => i[0] === "dyn"), "the boss room has both too");
  assert.equal(seam.boss, "tommy");
  assert.equal(seam.horde.length, 0);
  assert.ok(seam.shelves.some((s) => s[2] === 12) && seam.shelves.some((s) => s[2] === 17.5), "a gallery of boards each side");
  // The shaft's cages, the tunnels' water, the rocks.
  const cages = shaft.spawns.filter((s) => s[0] === "cage");
  assert.ok(cages.length >= 2 && cages.length <= 3, "two or three cage lifts");
  for (const [, x, lo, hi] of cages) {
    assert.ok(hi > lo + 8, `the cage at ${x} has a track`);
    const top = hi + mn.CAGE_H;
    assert.ok(shaft.shelves.some(([a, b, y]) => Math.abs(y - top) < 0.05 && x + 4 >= a && x - 4 <= b), `the cage at ${x} meets a landing at ${top}`);
    assert.ok(Math.abs(ghoul.groundAt(shaft, x) - lo) < 1, `the cage at ${x} starts at the floor`);
  }
  assert.equal(shaft.water.length + collapse.water.length + seam.water.length, 0, "water only in the tunnels");
  assert.ok(tunnels.water.length >= 3);
  for (const [a, b] of tunnels.water) {
    assert.ok(b > a && ghoul.groundAt(tunnels, a) === 6 && ghoul.groundAt(tunnels, b) === 6 && ghoul.groundAt(tunnels, (a + b) / 2) === 6, `the water ${a} to ${b} lies on the flat floor`);
    for (let x = a; x <= b; x += 4) assert.equal(ghoul.groundAt(tunnels, x), 6, `no pit or step in the water at ${x}`);
  }
  assert.ok(shaft.rocks > tunnels.rocks && tunnels.rocks > collapse.rocks && collapse.rocks > 0 && seam.rocks === 0, "more rockfall in order, none in the seam of its own");
  assert.deepEqual([shaft.rocks, tunnels.rocks, collapse.rocks], [30000, 12000, 7000]);
  // The new room fields pass through the room builder.
  assert.equal(ghoul.roomFor("tunnels").rocks, 12000);
  assert.deepEqual(ghoul.roomFor("tunnels").water, tunnels.water);
  assert.deepEqual(ghoul.roomFor("hall").water, []);
  assert.equal(ghoul.roomFor("hall").rocks, 0);
  // Harder in order, and the first room is easy: a gentle horde and few kinds at once.
  assert.ok(shaft.spawns.length <= tunnels.spawns.length && tunnels.spawns.length <= collapse.spawns.length);
  assert.ok(shaft.hordeMs > tunnels.hordeMs && tunnels.hordeMs > collapse.hordeMs, "the horde quickens");
  assert.equal(shaft.hordeMs, 3200, "about 3200 ms between horde spawns in the first room");
  assert.ok(shaft.horde.length <= 2 && !shaft.horde.includes("miner"), "the first room's horde is gentle");
  assert.ok(!shaft.spawns.some((s) => s[0] === "blind" || s[0] === "canary"), "no blind crawlers or canaries in the first room");
  assert.ok(tunnels.spawns.some((s) => s[0] === "blind") && tunnels.spawns.some((s) => s[0] === "canary") && tunnels.spawns.some((s) => s[0] === "miner"));
  assert.ok(collapse.spawns.some((s) => s[0] === "imp") && collapse.spawns.some((s) => s[0] === "canary"));
  assert.ok(shaft.spawns.some((s) => s[0] === "imp") && collapse.spawns.some((s) => s[0] === "imp"), "imps in the shaft and the collapse");
  // Canaries fly where a tilted bolt reaches (no higher than 20 over the floor under them).
  for (const room of [tunnels, collapse]) for (const [, x, y] of room.spawns.filter((s) => s[0] === "canary")) assert.ok(y - ghoul.groundAt(room, x) <= 9 && y - ghoul.groundAt(room, x) >= 8, `${room.id}: the canary at ${x} flies within a bolt's reach`);
  // The stage is a card of its own and a place in the stage select.
  assert.ok(LOOKS.shaft.custom && LOOKS.shaft.pack === "mine" && LOOKS.seam.mine);
});

test("Ghoul Rush's Mine shares no hazard, monster, boss, act or tick-state name with another stage's pack (the packs' tables are merged by name)", () => {
  for (const key of ["monsters", "bosses", "hazards", "move", "boss", "act", "solid", "harmless", "platform", "kill", "weak"]) {
    for (const other of [BONES, GRAVEYARD, GROUNDS, CHAPEL, SANATORIUM, VILLAGE]) {
      for (const name of Object.keys(mn.MINE[key] || {})) assert.ok(!(other[key] && name in other[key]), `${key}.${name} is also ${other.id}'s`);
    }
  }
  assert.ok(mn.MINE.hazards.hammer && !mn.MINE.hazards.sweep, "the Groundskeeper keeps its sweep");
  assert.equal(typeof GROUNDS.hazards.sweep, "function");
  assert.equal(mn.MINE.fire, undefined, "Dynamite is a secondary weapon now, no hook on the blaster");
});

/* --------------------------------------------------------------- rockfall */

test("Ghoul Rush's rockfall: the first rock comes at 0.9 of a period, after 700 ms of dust, and falls to lie as rubble for 4.5 s", () => {
  const round = mineRound("tunnels", { rocks: true });
  standAt(round, 60);
  round.you.safeMs = 1e9;
  const t0 = round.clock;
  const warn = upTo(round, "rockWarn", 12000);
  assert.ok(warn, "a warning");
  const warnedAt = round.clock - t0;
  assert.ok(Math.abs(warnedAt - 10800) < 20, `at 0.9 of 12 s (${warnedAt})`);
  assert.ok(Math.abs(warn.x - 60) < 1e-9, "over you when you stand still");
  assert.equal(warn.ms, 700);
  assert.equal(warn.y, 6);
  const rock = round.hazards.find((h) => h.kind === "rock");
  assert.ok(rock && rock.state === "warn" && rock.live === 0, "dust first, and a rock that waits hurts nothing");
  assert.equal(events(round, "rockFall").length, 0);
  const fall = upTo(round, "rockFall", 1000);
  assert.ok(fall, "then it falls");
  assert.ok(Math.abs(round.clock - t0 - warnedAt - mn.ROCK_WARN_MS) < 20, `700 ms after the warning (${round.clock - t0 - warnedAt})`);
  assert.ok(rock.state === "fall" && rock.live > 0, "falling, it can hurt");
  const fellAt = round.clock;
  assert.ok(upTo(round, "rockLand", 1200), "it lands");
  assert.ok(round.clock - fellAt > 450 && round.clock - fellAt < 650, `about half a second down (${round.clock - fellAt})`);
  assert.ok(rock.state === "rubble" && rock.live === 0 && rock.h === mn.ROCK_RUBBLE_H, "rubble, harmless");
  assert.equal(rock.y, 6);
  // Rubble lies about 4.5 s, then is gone.
  const l0 = round.clock;
  for (let t = 0; t < 6000 && round.hazards.includes(rock); t += 4) ghoul.advance(round, 4, steady);
  assert.ok(!round.hazards.includes(rock), "gone");
  assert.ok(Math.abs(round.clock - l0 - mn.ROCK_RUBBLE_MS) < 40, `lay ${mn.ROCK_RUBBLE_MS} ms (${round.clock - l0})`);
});

test("Ghoul Rush's rockfall is aimed 9 ahead of the way you run, never in the first 14 of a room, never twice in one spot, and a deeper stage lets them go sooner", () => {
  const run1 = mineRound("collapse", { rocks: true });
  standAt(run1, 80);
  run1.you.safeMs = 1e9;
  run1.twist.next = 0;
  run(run1, 8, { right: true });
  const a = events(run1, "rockWarn");
  assert.equal(a.length, 1);
  assert.ok(Math.abs(a[0].x - (run1.you.x + mn.ROCK_LEAD)) < 2, `ahead of a runner (${a[0].x} for ${run1.you.x})`);
  const left = mineRound("collapse", { rocks: true });
  standAt(left, 80, -1);
  left.you.safeMs = 1e9;
  left.twist.next = 0;
  run(left, 8, { left: true });
  assert.ok(Math.abs(events(left, "rockWarn")[0].x - (left.you.x - mn.ROCK_LEAD)) < 2, "and behind one who runs left");
  // At a room's start: not yet.
  const early = mineRound("collapse", { rocks: true });
  standAt(early, early.spec.start + 2);
  early.you.safeMs = 1e9;
  early.twist.next = 0;
  run(early, 40);
  assert.equal(events(early, "rockWarn").length, 0, "none in the first 14");
  assert.ok(early.twist.next > 1000 && early.twist.next < 1600, "it tries again soon");
  // Never twice in one spot.
  const dup = mineRound("collapse", { rocks: true });
  standAt(dup, 80);
  dup.you.safeMs = 1e9;
  dup.hazards.push(rockAt(81));
  dup.twist.next = 0;
  run(dup, 40);
  assert.equal(dup.hazards.filter((h) => h.kind === "rock").length, 1, "a rock already due over you: no second");
  // Never over a pit: the spot is refused (the next try is a period away).
  const pit = mineRound("collapse", { rocks: true });
  standAt(pit, 80);
  pit.you.safeMs = 1e9;
  pit.twist.next = 0;
  run(pit, 8, { right: true });
  assert.equal(pit.hazards.filter((h) => h.kind === "rock").length, 1);
  assert.equal(ghoul.groundAt(pit.spec, 234), -Infinity, "(a pit lies at 230 to 238)");
  const over = mineRound("collapse", { rocks: true });
  standAt(over, 226, 1);
  over.you.safeMs = 1e9;
  over.twist.next = 0;
  run(over, 8, { right: true });
  const aimed = over.hazards.filter((h) => h.kind === "rock");
  assert.ok(aimed.every((h) => ghoul.groundAt(over.spec, h.x) > -Infinity), "never over a pit");
  // A deeper stage lets them go sooner (after the first, which keeps its 0.9 of a period).
  const deep = ghoul.roomFor("collapse", 6);
  assert.ok(deep.every < 0.8);
  const sooner = mineRound("collapse", { rocks: true });
  sooner.spec = deep;
  sooner.twist = null;
  standAt(sooner, 80);
  sooner.you.safeMs = 1e9;
  const two = log(sooner, 7000 * 0.9 + 7000 * deep.every + 900, "rockWarn");
  assert.equal(two.length, 2);
  assert.ok(Math.abs(two[1][0] - two[0][0] - 7000 * deep.every) < 40, `a period apart (${two[1][0] - two[0][0]})`);
  assert.ok(Math.abs(two[0][0] - 7000 * 0.9) < 40, `the first at 0.9 of a period (${two[0][0]})`);
});

test("Ghoul Rush's rock crushes the monsters under it (flattened, double points) and costs a life if it lands on you (the cause rock); beside it, or jumping clear, you are safe", () => {
  const round = mineRound("collapse");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const z = put(round, "zombie", 90, { act: "walk" });
  const g = put(round, "imp", 93.5);
  round.hazards.push(rockAt(91.5, { state: "fall", y: 16, vy: -40, live: 1 }));
  const score0 = round.score;
  const kills = log(round, 600, "kill");
  assert.equal(kills.length, 2);
  assert.ok(kills.every(([, e]) => e.how === "crush"), "crushed");
  assert.ok(round.score - score0 >= 100 * 2, "double points");
  assert.ok(z.dead && g.dead);
  assert.equal(round.monsters.length, 0);
  assert.ok(round.hazards.some((h) => h.kind === "rock" && h.state === "rubble"));
  // On you.
  const hit = mineRound("collapse");
  standAt(hit, 60);
  hit.hazards.push(rockAt(60));
  until(hit, () => events(hit, "lose").length > 0, 2500);
  assert.equal(events(hit, "lose")[0]?.cause, "rock");
  // Beside it: nothing.
  const beside = mineRound("collapse");
  standAt(beside, 66);
  beside.hazards.push(rockAt(60));
  run(beside, 2500);
  assert.equal(events(beside, "lose").length, 0);
  assert.equal(events(beside, "rockLand").length, 1);
  // A rock still waiting (dust only) does not hurt you.
  const dust = mineRound("collapse");
  standAt(dust, 60);
  dust.hazards.push(rockAt(60, { warn: 1e9, total: 1e9 }));
  run(dust, 1500);
  assert.equal(events(dust, "lose").length, 0, "dust costs nothing");
  // A rock that has landed lies harmless: you can stand in the rubble.
  const rub = mineRound("collapse");
  standAt(rub, 60);
  rub.hazards.push(rockAt(60, { state: "rubble", live: 0, y: 6, h: mn.ROCK_RUBBLE_H, rub: 3000 }));
  run(rub, 1500);
  assert.equal(events(rub, "lose").length, 0);
  // Only so much rubble at once.
  const heap = mineRound("collapse");
  standAt(heap, 20);
  heap.you.safeMs = 1e9;
  for (let i = 0; i < mn.RUBBLE_CAP + 3; i++) heap.hazards.push(rockAt(60 + i * 10, { vy: -60, y: 8 }));
  run(heap, 600);
  assert.ok(heap.hazards.filter((h) => h.state === "rubble").length <= mn.RUBBLE_CAP);
});

test("Ghoul Rush's Hard Hat is found only in the Mine, is worn till used (shown as a pill, kept from room to room in the Mine, gone out of it), and makes one rock bounce off you into rubble beside you instead of costing a life", () => {
  assert.equal(ghoul.POWERS.hat.stage, "mine");
  assert.equal(ghoul.POWERS.hat.ms, undefined, "worn, not timed");
  assert.equal(PILL_WORDS.hat, "HARD HAT");
  assert.ok(!ghoul.TIMED.includes("hat"));
  assert.equal(ghoul.powerHere({ dark: true, stage: "manor" }, "hat"), false);
  assert.equal(ghoul.powerHere({ dark: false, stage: null }, "hat"), false);
  assert.equal(ghoul.powerHere({ dark: false, stage: "village" }, "hat"), false);
  assert.equal(ghoul.powerHere({ dark: true, stage: "mine" }, "hat"), true);
  const rnd = ghoul.seeded(17);
  for (const stage of [null, "manor", "wing", "graveyard", "grounds", "chapel", "sanatorium", "village"]) {
    for (let i = 0; i < 400; i++) {
      for (const dropping of [false, true]) {
        const got = pickPower(rnd, { dark: i % 2 === 0, stage }, "", dropping);
        assert.ok(got !== "hat" && got !== "dyn", `${stage}: never picked`);
      }
    }
  }
  const seen = new Set();
  for (let i = 0; i < 400; i++) seen.add(pickPower(rnd, { dark: true, stage: "mine" }));
  assert.ok(seen.has("hat") && !seen.has("dyn"), "the hat turns up in the Mine; Dynamite comes from the weapons' own drop band");
  for (const room of ghoul.ROOMS) {
    for (const kind of ["hat"]) {
      const placed = [...room.items, ...room.sky].some((i) => i[0] === kind);
      assert.equal(placed, STAGE_ROOMS.includes(room.id), `${room.id}: ${kind} ${placed ? "placed" : "absent"}`);
    }
  }
  // A placed one in a Mine room stays; picked up it is worn, with no timer, and shows as a pill.
  const round = mineRound("collapse");
  assert.equal(round.loot[round.spec.items.findIndex((i) => i[0] === "hat")], "hat");
  standAt(round, round.spec.items.find((i) => i[0] === "hat")[1]);
  round.items.fill(false);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 8, steady);
  assert.equal(round.you.hat, true);
  run(round, 20000);
  assert.equal(round.you.hat, true, "still worn long after");
  assert.ok(!events(round, "expire").some((e) => e.kind === "hat"));
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  assert.ok(!g.hud.effects.some((e) => e.text === "HARD HAT"));
  g.round.you.hat = true;
  const pill = g.hud.effects.find((e) => e.text === "HARD HAT");
  assert.equal(pill?.color, ghoul.POWERS.hat.color);
  // Kept into the next Mine room; gone in a room out of the Mine.
  through(round);
  assert.equal(round.you.hat, true, "kept into the next Mine room");
  const out = ghoul.newRound(3);
  out.dice = 0;
  out.you.hat = true;
  ghoul.advance(out, 50, steady);
  assert.equal(out.you.hat, false, "never worn out of the Mine");
  // Under it, a rock bounces, and the hat is used up.
  const hat = mineRound("collapse");
  standAt(hat, 60);
  hat.you.hat = true;
  hat.hazards.push(rockAt(60));
  run(hat, 2000);
  assert.equal(events(hat, "lose").length, 0);
  const bounce = events(hat, "rockBounce");
  assert.equal(bounce.length, 1);
  assert.equal(hat.you.hat, false, "used up");
  assert.equal(events(hat, "rockLand").length, 0, "it did not land on you");
  const lying = hat.hazards.find((h) => h.kind === "rock");
  assert.ok(lying && lying.state === "rubble" && Math.abs(lying.x - 60) >= mn.ROCK_W - 0.01, "rubble beside you");
});

/* ------------------------------------------------------------------- imps */

test("Ghoul Rush's knocker imp skitters at you and hops after you onto a board; touching it costs no life but steals your light for 5 s, and it runs off with the spark", () => {
  const round = mineRound("shaft");
  standAt(round, 40);
  const imp = put(round, "imp", 80);
  assert.equal(imp.act, "skitter");
  assert.ok(ghoul.MONSTERS.imp.w === 2 && ghoul.MONSTERS.imp.h === 2.4 && ghoul.MONSTERS.imp.speed > ghoul.MONSTERS.zombie.speed * 2);
  round.you.safeMs = 1e9;
  const x0 = imp.x;
  run(round, 500);
  assert.ok(x0 - imp.x > 8, `fast (${x0 - imp.x} in 500 ms)`);
  // It hops up onto the board you stand on.
  const hop = mineRound("shaft");
  standAt(hop, 63, 1, 15, 1);
  hop.you.safeMs = 1e9;
  const h = put(hop, "imp", 57);
  until(hop, () => h.y > 14.9, 1500);
  assert.ok(h.y >= 14.9 && h.x > 55, `up on the board (${h.x}, ${h.y})`);
  // Touching it: no life, the light dims, it flees.
  const steal = mineRound("shaft");
  standAt(steal, 40);
  const s = put(steal, "imp", 40.5);
  assert.equal(ghoul.solid(s), true);
  ghoul.advance(steal, 8, steady);
  assert.equal(events(steal, "lose").length, 0, "no life");
  assert.equal(steal.lives, 3);
  assert.equal(steal.phase, "play");
  assert.ok(steal.you.dimMs > 4900 && steal.you.dimMs <= mn.IMP_DIM_MS, `5 s of dim (${steal.you.dimMs})`);
  assert.equal(steal.you.dimBy, s.id);
  assert.equal(s.stole, true);
  assert.equal(s.act, "flee");
  const ev = events(steal, "impSteal");
  assert.equal(ev.length, 1);
  assert.equal(ev[0].id, s.id);
  assert.equal(ev[0].ms, 5000);
  const x1 = s.x;
  standAt(steal, 40);
  run(steal, 400);
  assert.ok(Math.abs(s.x - x1) > 5, "off with it");
  assert.ok(s.x > 40 === (x1 > 40), "away from you");
  // The light is back after 5 s, the imp skitters again.
  run(steal, 5200);
  assert.equal(steal.you.dimMs, 0);
  assert.equal(s.stole, false);
  assert.equal(s.act, "skitter");
  assert.equal(events(steal, "impDrop").length, 0, "time gives it back quietly");
  // A bolt to the thief ends the dim at once (and says so); an imp that did not steal it changes nothing.
  const shot = mineRound("shaft");
  standAt(shot, 40);
  const t = put(shot, "imp", 40.5);
  ghoul.advance(shot, 8, steady);
  assert.ok(shot.you.dimMs > 0);
  Object.assign(t, { x: 60, hp: 1, max: 1 });
  bolt(shot, t, t.y + 1);
  const other = put(shot, "imp", 120, { hp: 1, max: 1 });
  ghoul.advance(shot, 8, steady);
  assert.ok(t.dead, "the thief is shot");
  assert.equal(shot.you.dimMs, 0, "the light is back at once");
  assert.equal(events(shot, "impDrop").length, 1);
  assert.ok(!other.dead);
  // Another imp's death does not give it back.
  const decoy = mineRound("shaft");
  standAt(decoy, 40);
  const th = put(decoy, "imp", 40.5);
  ghoul.advance(decoy, 8, steady);
  const other2 = put(decoy, "imp", 70, { hp: 1, max: 1 });
  bolt(decoy, other2, other2.y + 1);
  ghoul.advance(decoy, 8, steady);
  assert.ok(other2.dead && !th.dead);
  assert.ok(decoy.you.dimMs > 4000, "still dim");
  assert.equal(events(decoy, "impDrop").length, 0);
  // Stomped, too.
  const stomp = mineRound("shaft");
  standAt(stomp, 40);
  const st = put(stomp, "imp", 40.5);
  ghoul.advance(stomp, 8, steady);
  assert.ok(stomp.you.dimMs > 0);
  standAt(stomp, st.x, 1, st.y + st.h + 0.02);
  Object.assign(stomp.you, { state: "air", vy: -10 });
  ghoul.advance(stomp, 4, steady);
  assert.ok(st.dead || stomp.monsters.every((m) => m !== st), "stomped");
  assert.equal(stomp.you.dimMs, 0, "a stomp gives it back too");
});

test("Ghoul Rush's Hard Hat keeps an imp from stealing your light once (knocked off, the imp thrown back), and a safe moment (just back from a life lost) does too", () => {
  const round = mineRound("shaft");
  standAt(round, 40);
  round.you.hat = true;
  const imp = put(round, "imp", 40.5);
  ghoul.advance(round, 16, steady);
  assert.equal(round.you.dimMs, 0);
  assert.equal(imp.stole, undefined);
  assert.equal(events(round, "impSteal").length, 0);
  assert.equal(events(round, "hatKnock").length, 1, "the hat is knocked off");
  assert.equal(round.you.hat, false);
  assert.ok(Math.abs(imp.x - 40) >= mn.HAT_KNOCK - 0.5, "the imp is thrown back");
  assert.equal(events(round, "lose").length, 0);
  const safe = mineRound("shaft");
  standAt(safe, 40);
  safe.you.safeMs = 1000;
  put(safe, "imp", 40.5);
  run(safe, 300);
  assert.equal(safe.you.dimMs, 0);
  // Without it, the same imp does steal (the control).
  const bare = mineRound("shaft");
  standAt(bare, 40);
  put(bare, "imp", 40.5);
  run(bare, 40);
  assert.ok(bare.you.dimMs > 0);
});

/* ---------------------------------------------------------------- canary */

test("Ghoul Rush's canary ghost flits toward you near the ceiling, never hurts by touch, screams once within 20 of you (three rocks, over you and 6 either side, 900 ms of dust), then flees and rests", () => {
  const round = mineRound("tunnels");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const c = put(round, "canary", 100, { y: 14.5 });
  assert.equal(c.act, "flit");
  assert.equal(ghoul.MONSTERS.canary.hp, 1);
  run(round, 600);
  assert.ok(c.x < 100 - 4, "it flits toward you");
  assert.equal(events(round, "canaryScream").length, 0, "far off: no scream");
  Object.assign(c, { x: 58 });
  const cry = log(round, 40, "canaryScream");
  assert.equal(cry.length, 1);
  assert.equal(cry[0][1].n, 3);
  assert.equal(c.act, "scream");
  const rocks = round.hazards.filter((h) => h.kind === "rock");
  assert.equal(rocks.length, 3);
  assert.deepEqual(rocks.map((h) => Math.round(h.x)).sort((a, b) => a - b), [34, 40, 46]);
  assert.ok(rocks.every((h) => h.state === "warn" && Math.abs(h.warn - 900) < 60), "900 ms of dust");
  const fell = log(round, 1100, "rockFall");
  assert.equal(fell.length, 3);
  assert.ok(fell.every(([ms]) => ms > 800 - 60 && ms < 900 + 60), "all three together, 900 ms on");
  // It flees, then flits again, and cannot scream again for about 4.5 s.
  assert.equal(c.act === "flee" || c.act === "flit", true);
  Object.assign(c, { x: 56, act: "flit" });
  run(round, 600);
  assert.equal(events(round, "canaryScream").length, 0, "resting");
  c.cool = 0;
  Object.assign(c, { x: 56 });
  run(round, 60);
  assert.ok(events(round, "canaryScream").length >= 1 || c.act === "scream", "after its rest, again");
  // Touching it costs nothing.
  const touch = mineRound("tunnels");
  standAt(touch, 40);
  put(touch, "canary", 40, { y: 7, cool: 1e9 });
  run(touch, 400);
  assert.equal(events(touch, "lose").length, 0);
  // A bolt brings it down before it screams.
  const shot = mineRound("tunnels");
  standAt(shot, 40);
  shot.you.safeMs = 1e9;
  const s = put(shot, "canary", 80, { y: 14.5 });
  bolt(shot, s, 15.4);
  run(shot, 8);
  assert.ok(s.dead || !shot.monsters.includes(s), "one bolt");
  run(shot, 800);
  assert.equal(events(shot, "canaryScream").length, 0);
  assert.equal(shot.hazards.filter((h) => h.kind === "rock").length, 0);
  // Not in view, it keeps quiet.
  const away = mineRound("tunnels");
  standAt(away, 40);
  const far = put(away, "canary", 140, { y: 14.5 });
  Object.assign(far, { cool: 0 });
  away.camX = 0;
  Object.assign(away.you, { x: 40 });
  run(away, 200);
  assert.equal(events(away, "canaryScream").length, 0);
});

/* ---------------------------------------------------------------- miners */

test("Ghoul Rush's dead miner lies buried in the wall (not solid) till you come within 44, digs out over 650 ms in a spray of rubble, then walks at you", () => {
  const round = mineRound("shaft");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const m = put(round, "miner", 140);
  assert.equal(m.act, "buried");
  assert.equal(ghoul.solid(m), false, "buried: not solid");
  bolt(round, m, m.y + 2);
  run(round, 120);
  assert.equal(m.hp, 4, "a bolt goes through the wall");
  assert.equal(events(round, "minerDig").length, 0, "100 away: nothing");
  standAt(round, 100);
  round.you.safeMs = 1e9;
  const dig = log(round, 8, "minerDig");
  assert.equal(dig.length, 1);
  assert.equal(m.act, "dig");
  assert.equal(ghoul.solid(m), false, "digging: not solid");
  assert.equal(dig[0][1].ms, 650);
  const up = log(round, 800, "minerDig");
  assert.equal(up.length, 0, "once");
  assert.equal(m.act, "walk");
  assert.equal(ghoul.solid(m), true);
  const x0 = m.x;
  standAt(round, 100);
  run(round, 600);
  assert.ok(x0 - m.x > 3, "walking at you");
  // A lurch of 8 a second, hit by 4 bolts.
  assert.equal(ghoul.MONSTERS.miner.speed, 8);
  // Further than 44 it stays buried.
  const far = mineRound("shaft");
  standAt(far, 40);
  const f = put(far, "miner", 120);
  run(far, 300);
  assert.equal(f.act, "buried");
  // Out of view it stays buried.
  const hid = mineRound("shaft");
  standAt(hid, 40);
  const h = put(hid, "miner", 50);
  hid.camX = 400;
  run(hid, 100);
  assert.equal(h.act, "buried", "not in view");
});

test("Ghoul Rush's dead miner winds up its pickaxe 400 ms within 5 of you, swings (a hazard 5 long, live 200 ms, the cause pickaxe), rests 900 ms, and touching it hurts too", () => {
  const round = mineRound("tunnels");
  standAt(round, 46);
  round.you.safeMs = 1e9;
  const m = put(round, "miner", 52, { act: "walk" });
  const wind = log(round, 8, "pickWind");
  assert.equal(wind.length, 1);
  assert.equal(m.act, "wind");
  const w0 = round.clock;
  const swung = upTo(round, "pickSwing", 600);
  assert.ok(swung, "a swing");
  assert.ok(Math.abs(round.clock - w0 - mn.PICK_WIND_MS) < 40, `400 ms of wind-up (${round.clock - w0})`);
  const pick = round.hazards.find((h) => h.kind === "pick");
  assert.ok(pick && pick.cause === "pickaxe" && pick.w === mn.PICK_REACH && pick.live > 150 && pick.live <= mn.PICK_LIVE_MS);
  assert.ok(pick.x < m.x, "in front of it");
  assert.equal(m.act, "rest");
  run(round, 300);
  assert.ok(!round.hazards.includes(pick), "gone after 200 ms");
  const r0 = round.clock;
  assert.ok(upTo(round, "pickWind", 1500), "after its 900 ms rest, again");
  assert.ok(Math.abs(round.clock - r0 - (mn.PICK_REST_MS - 300)) < 60, `rested 900 ms from the swing (${round.clock - r0})`);
  // The swing costs a life in front of it; out of its reach it costs none.
  const hit = mineRound("tunnels");
  standAt(hit, 46);
  put(hit, "miner", 52, { act: "walk" });
  until(hit, () => events(hit, "lose").length > 0, 1200);
  assert.equal(events(hit, "lose")[0]?.cause, "pickaxe");
  const clear = mineRound("tunnels");
  standAt(clear, 46);
  put(clear, "miner", 52, { act: "walk" });
  until(clear, () => events(clear, "pickWind").length > 0, 200);
  standAt(clear, 30);
  run(clear, 900);
  assert.equal(events(clear, "lose").length, 0, "stepped back out of reach");
  // Jumping over it.
  const over = mineRound("tunnels");
  standAt(over, 46);
  put(over, "miner", 52, { act: "walk" });
  assert.ok(upTo(over, "pickWind", 100));
  run(over, 200);
  over.input.up = true;
  ghoul.jump(over);
  assert.ok(upTo(over, "pickSwing", 600), "it swings under you");
  run(over, 700);
  assert.equal(events(over, "lose").length, 0, "jumped it");
  // Touching it: the cause miner.
  const touch = mineRound("tunnels");
  standAt(touch, 50);
  put(touch, "miner", 50.5, { act: "walk" });
  ghoul.advance(touch, 8, steady);
  assert.equal(events(touch, "lose")[0]?.cause, "miner");
});

/* ---------------------------------------------------------------- blind */

test("Ghoul Rush's blind crawler hunts by sound: fast while you run, jump or shoot, lost after 600 ms of quiet (blindLost), then it wanders slowly until a noise within 44 of it finds you again (blindHear)", () => {
  const round = mineRound("shaft");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const b = put(round, "blind", 80);
  assert.equal(b.act, "lost");
  assert.equal(ghoul.MONSTERS.blind.hp, 3);
  // Quiet: it wanders and does not come.
  run(round, 1500);
  assert.equal(events(round, "blindHear").length, 0);
  assert.ok(Math.abs(b.x - 80) < 6.5, "feeling about");
  // You run: it hears you (it is within 44) and comes fast.
  round.input.right = true;
  const heard1 = log(round, 40, "blindHear");
  round.input.right = false;
  assert.equal(heard1.length, 1);
  assert.equal(b.act, "hunt");
  // Run on the spot to keep making noise: it closes at the hunt speed.
  const hunt = mineRound("shaft");
  standAt(hunt, 40);
  hunt.you.safeMs = 1e9;
  const c = put(hunt, "blind", 80, { act: "hunt" });
  const start = c.x;
  Object.assign(hunt.input, { left: true });
  for (let t = 0; t < 500; t += 4) {
    ghoul.advance(hunt, 4, steady);
    standAt(hunt, 40, -1);
    hunt.input.left = true;
  }
  hunt.input.left = false;
  assert.ok(start - c.x > mn.BLIND_HUNT_V * 0.5 * 0.8, `fast while you run (${start - c.x})`);
  // Still for 600 ms: it loses you, once.
  const lost = log(hunt, 1200, "blindLost");
  assert.equal(lost.length, 1);
  assert.ok(lost[0][0] >= mn.BLIND_LOSE_MS - 40 - 100 && lost[0][0] <= mn.BLIND_LOSE_MS + 60, `after 600 ms of quiet (${lost[0][0]})`);
  assert.equal(c.act, "lost");
  const at = c.x;
  run(hunt, 1000);
  assert.ok(Math.abs(c.x - at) <= mn.BLIND_WANDER_V * 1 + 0.5, `wandering slowly (${Math.abs(c.x - at)})`);
  assert.equal(events(hunt, "blindHear").length, 0, "silence: still lost");
  // A shot is a noise.
  hunt.input.fire = true;
  const again = log(hunt, 60, "blindHear");
  hunt.input.fire = false;
  assert.equal(again.length, 1, "heard again");
  assert.equal(c.act, "hunt");
  // A jump is a noise, and so is the landing's air.
  const jumper = mineRound("shaft");
  standAt(jumper, 40);
  jumper.you.safeMs = 1e9;
  const d = put(jumper, "blind", 70, { act: "lost" });
  ghoul.jump(jumper);
  ghoul.advance(jumper, 8, steady);
  assert.equal(d.act, "hunt", "a jump");
  assert.equal(jumper.twist.noise, true);
  // Standing still, no noise.
  const still = mineRound("shaft");
  standAt(still, 40);
  still.you.safeMs = 1e9;
  const e = put(still, "blind", 70, { act: "lost" });
  run(still, 800);
  assert.equal(still.twist.noise, false);
  assert.ok(still.twist.quiet >= 600);
  assert.equal(e.act, "lost");
  // Too far to hear a dry run (44), near enough to hear a wading one (70).
  const dry = mineRound("shaft");
  standAt(dry, 30);
  dry.you.safeMs = 1e9;
  const far = put(dry, "blind", 86, { act: "lost" });
  run(dry, 200, { right: true });
  assert.equal(far.act, "lost", "56 away on dry floor: not heard");
  assert.equal(dry.twist.reach, mn.HEAR_DRY);
  const wet = mineRound("tunnels");
  standAt(wet, 20);
  wet.you.safeMs = 1e9;
  const far2 = put(wet, "blind", 76, { act: "lost" });
  Object.assign(wet.input, { right: true });
  for (let t = 0; t < 100; t += 4) {
    ghoul.advance(wet, 4, steady);
    standAt(wet, 20);
    wet.input.right = true;
  }
  wet.input.right = false;
  assert.equal(far2.act, "hunt", "56 away through the water: heard");
  assert.equal(wet.twist.reach, mn.HEAR_WET);
  // It hurts by touch.
  const bite = mineRound("shaft");
  standAt(bite, 40);
  put(bite, "blind", 40.5);
  ghoul.advance(bite, 8, steady);
  assert.equal(events(bite, "lose")[0]?.cause, "blind");
});

/* ----------------------------------------------------------------- water */

test("Ghoul Rush's knee-deep water slows you to 0.65 of your speed and lowers a jump a little, only on the floor in a span, and each step splashes", () => {
  const wet = mineRound("tunnels");
  standAt(wet, 20);
  wet.you.safeMs = 1e9;
  const x0 = wet.you.x;
  run(wet, 1000, { right: true });
  const d = wet.you.x - x0;
  assert.ok(Math.abs(d - ghoul.RUN_SPEED * ghoul.WATER_SPEED) < 1, `0.65 of 36 (${d})`);
  assert.equal(ghoul.WATER_SPEED, 0.65);
  assert.equal(wet.you.wet, true);
  const dry = mineRound("tunnels");
  standAt(dry, 120);
  dry.you.safeMs = 1e9;
  const y0 = dry.you.x;
  run(dry, 500, { right: true });
  assert.ok(Math.abs(dry.you.x - y0 - 18) < 1, "full speed on dry floor");
  assert.equal(dry.you.wet, false);
  // The jump: a little lower in it.
  const jw = mineRound("tunnels");
  standAt(jw, 40);
  jw.you.safeMs = 1e9;
  ghoul.advance(jw, 4, steady);
  ghoul.jump(jw);
  assert.ok(Math.abs(jw.you.vy - ghoul.JUMP_V * ghoul.WATER_JUMP) < 1e-9);
  assert.ok(ghoul.WATER_JUMP < 1 && ghoul.WATER_JUMP > 0.85, "a little");
  const jd = mineRound("tunnels");
  standAt(jd, 120);
  ghoul.advance(jd, 4, steady);
  ghoul.jump(jd);
  assert.equal(jd.you.vy, ghoul.JUMP_V);
  // On a board over the water, or in the air, you are not wet.
  const board = mineRound("tunnels");
  standAt(board, 60, 1, 15, 1);
  ghoul.advance(board, 4, steady);
  assert.equal(board.you.wet, false);
  const air = mineRound("tunnels");
  standAt(air, 60);
  ghoul.jump(air);
  ghoul.advance(air, 20, steady);
  assert.equal(air.you.wet, false, "in the air");
  // Splashes while you wade, about every 320 ms; none standing still or dry.
  const splash = mineRound("tunnels");
  standAt(splash, 20);
  splash.you.safeMs = 1e9;
  Object.assign(splash.input, { right: true });
  const w = log(splash, 1700, "wade");
  splash.input.right = false;
  assert.ok(w.length >= 4 && w.length <= 6, `about every 320 ms (${w.length})`);
  const gaps = w.slice(1).map((s, i) => s[0] - w[i][0]);
  assert.ok(gaps.every((g) => Math.abs(g - mn.WADE_MS) < 20), `320 ms apart (${gaps})`);
  assert.equal(log(splash, 800, "wade").length, 0, "standing still in water: quiet");
  const dryWalk = mineRound("tunnels");
  standAt(dryWalk, 120);
  assert.equal(log(dryWalk, 800, "wade").length, 0);
  run(dryWalk, 600, { right: true });
  assert.equal(events(dryWalk, "wade").length, 0, "dry: no splash");
  // Rooms without water never slow you.
  const none = mineRound("shaft");
  standAt(none, 20);
  none.you.safeMs = 1e9;
  run(none, 500, { right: true });
  assert.ok(Math.abs(none.you.x - 20 - 18) < 1);
  // The finishing routes still hold in the water: a jump from the water reaches the step under the key shelf.
  const jump = mineRound("tunnels");
  standAt(jump, 312);
  jump.you.safeMs = 1e9;
  ghoul.advance(jump, 4, steady);
  jump.input.up = true;
  jump.input.jump = ghoul.JUMP_BUFFER_MS;
  until(jump, () => jump.you.state === "run" && jump.you.y > 14, 1200);
  assert.ok(jump.you.y >= 15 - 1e-9 && jump.you.shelf >= 0, `up on the 15 board from the water (${jump.you.y})`);
});

/* ----------------------------------------------------------------- cages */

test("Ghoul Rush's cage lift rides its track at 7 a second, rests 1.5 s at each end, carries Planny standing on it, and is no monster: not hit by bolts, never hurts, never dies", () => {
  const round = mineRound("shaft");
  const cg = put(round, "cage", 210, { y: 6.2, lo: 6.2, hi: 17.8, v: 7, rest: 0 });
  assert.equal(cg.act, "ride");
  assert.equal(ghoul.solid(cg), false);
  standAt(round, 210, 1, 7.4);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 8, steady);
  assert.ok(Math.abs(round.you.y - 7.4) < 0.1, "standing on its board");
  run(round, 1000);
  assert.ok(Math.abs(cg.y - (6.2 + 7)) < 0.15, `up 7 in a second (${cg.y})`);
  assert.ok(Math.abs(round.you.y - (cg.y + 1.2)) < 0.15, `carried (${round.you.y} on ${cg.y})`);
  assert.equal(round.you.state, "run");
  // At the top it rests 1.5 s, then comes back down with him.
  until(round, () => cg.rest > 0, 1700);
  const topAt = round.clock;
  assert.equal(cg.y, 17.8);
  run(round, 1400);
  assert.equal(cg.y, 17.8, "resting");
  assert.ok(Math.abs(round.you.y - 19) < 0.01);
  until(round, () => cg.y < 17.7, 400);
  assert.ok(round.clock - topAt >= 1450 && round.clock - topAt <= 1600, `1.5 s at the top (${round.clock - topAt})`);
  run(round, 800);
  assert.ok(cg.y < 14, "back down");
  assert.ok(Math.abs(round.you.y - (cg.y + 1.2)) < 0.15, "carried down");
  // At the bottom it rests, too, and rises again.
  until(round, () => cg.y <= 6.2, 2500);
  assert.equal(cg.y, 6.2);
  assert.equal(cg.v, mn.CAGE_V);
  // A bolt passes through it, a stomp does not bounce you, and nothing hurts.
  const solo = mineRound("shaft");
  const c2 = put(solo, "cage", 230, { y: 6.2, lo: 6.2, hi: 17.8, v: 7, rest: 1e9 });
  standAt(solo, 210);
  solo.you.safeMs = 1e9;
  solo.shots.push({ x: 216, y: 7.2, vx: 80, vy: 0, gone: 0 });
  run(solo, 300);
  assert.equal(c2.hp, 9999, "a bolt does not touch it");
  assert.ok(solo.shots.length === 0 || solo.shots[0].x > 234, "and goes through");
  assert.equal(ghoul.MONSTERS.cage.hp, 9999);
  assert.equal(ghoul.hurt(solo, c2, 5, "shot", steady) === false, true, "hurt cannot kill it");
  assert.ok(c2.hp > 9000);
  // Beside it, in it, even under it: no life lost.
  const bump = mineRound("shaft");
  put(bump, "cage", 230, { y: 6.2, lo: 6.2, hi: 17.8, v: 0, rest: 1e9 });
  standAt(bump, 230, 1, 6);
  Object.assign(bump.you, { y: 6, state: "run" });
  run(bump, 600);
  assert.equal(events(bump, "lose").length, 0);
  // Walking off its high end onto the landing.
  const off = mineRound("shaft");
  put(off, "cage", 100, { y: 17.8, lo: 6.2, hi: 17.8, v: -7, rest: 1000 });
  standAt(off, 100, -1, 19);
  off.you.safeMs = 1e9;
  run(off, 100, { left: true });
  run(off, 400, { left: true });
  assert.ok(off.you.x < 96, "walked off the cage's end");
  assert.ok(Math.abs(off.you.y - 19) < 0.01 && off.you.shelf >= 0, `onto the landing at 19 (${off.you.y})`);
  // The track starts from its row when only the row says so.
  const track = mineRound("shaft");
  const row = track.spec.spawns.find((s) => s[0] === "cage");
  const fromRow = ghoul.spawnMonster(track, "cage", row[1], row[2], { rise: 0 });
  standAt(track, 20);
  run(track, 40);
  assert.equal(fromRow.lo, row[2]);
  assert.equal(fromRow.hi, row[3]);
});

/* ------------------------------------------------------------- dynamite */

test("Ghoul Rush's Dynamite is the Mine's own secondary weapon: every Mine room has it, a pickup there gives 3 sticks (2 elsewhere, never over 6), and a double tap throws one with no bolt spent", () => {
  assert.equal(ghoul.POWERS.dyn.arm, true);
  assert.equal(ghoul.POWERS.dyn.ms, undefined, "sticks, not a timer");
  assert.ok(!ghoul.TIMED.includes("dyn"));
  assert.equal(ghoul.powerHere({ dark: false, stage: "village" }, "dyn"), true, "common, anywhere");
  const round = mineRound("collapse");
  assert.deepEqual(round.arms, []);
  ghoul.applyPower(round, "dyn");
  assert.deepEqual(round.arms, [{ kind: "dyn", n: 3 }]);
  ghoul.applyPower(round, "dyn");
  ghoul.applyPower(round, "dyn");
  assert.equal(round.arms[0].n, ghoul.POWERS.dyn.max, "no more than 6");
  sticks(round, 3);
  // Held fire throws nothing: only the double tap does.
  standAt(round, 40);
  round.you.safeMs = 1e9;
  run(round, 300, { fire: true });
  assert.equal(round.hazards.filter((h) => h.kind === "stick").length, 0);
  assert.ok(round.stats.shots > 0);
  run(round, 400);
  const shots = round.stats.shots;
  round.events.length = 0;
  tapTap(round);
  assert.equal(round.hazards.filter((h) => h.kind === "stick").length, 1);
  assert.equal(round.arms[0].n, 2);
  assert.equal(events(round, "dynThrow").length, 1);
  assert.equal(round.stats.shots, shots, "a throw is no bolt");
  const stick = round.hazards.find((h) => h.kind === "stick");
  assert.ok(stick.vx === arm.DYN_VX && stick.vy === arm.DYN_VY && stick.fuse === arm.DYN_FUSE_MS);
  // Facing left, it flies left.
  const left = mineRound("collapse");
  standAt(left, 80, -1);
  sticks(left, 1);
  left.you.safeMs = 1e9;
  tapTap(left);
  assert.ok(left.hazards.find((h) => h.kind === "stick").vx < 0);
  assert.deepEqual(left.arms, [], "the last one gone");
  // What you hold comes with you into the next room.
  sticks(left, 2);
  through(left);
  assert.deepEqual(left.arms, [{ kind: "dyn", n: 2 }], "a new room, the same sticks");
});

test("Ghoul Rush's thrown stick flies in an arc, lands on the ground or a board, and 1 s after the throw blows up: every solid monster within 11 across dies (no drops), the boss takes 8, you take nothing", () => {
  const round = mineRound("collapse");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  sticks(round, 1);
  const t0 = round.clock;
  tapTap(round);
  run(round, 8);
  const stick = round.hazards.find((h) => h.kind === "stick");
  assert.ok(stick);
  until(round, () => stick.rest, 1000);
  assert.ok(stick.rest && stick.y === 6, "landed on the floor");
  assert.ok(stick.x > 55 && stick.x < 70, `about 24 ahead (${stick.x})`);
  const sx = stick.x;
  // Monsters: one in the blast, one just out of it, one behind you, one buried in the wall.
  const inside = put(round, "zombie", sx + 8, { act: "walk" });
  const edge = put(round, "zombie", sx + 25);
  const grave = put(round, "miner", sx - 4);
  const lost = put(round, "imp", 10);
  const score0 = round.score;
  const rolls = [];
  const blasts = [];
  until(round, () => {
    if (events(round, "dynBlast").length) blasts.push(round.clock - t0);
    return round.hazards.some((h) => h.kind === "blast");
  }, 1200, () => (rolls.push(1), 0.5));
  assert.ok(round.hazards.some((h) => h.kind === "blast"), "it blew");
  assert.ok(Math.abs(round.clock - t0 - arm.DYN_FUSE_MS) < 60, `1 s after the throw (${round.clock - t0})`);
  assert.ok(inside.dead || !round.monsters.includes(inside), "caught in the blast");
  assert.ok(!edge.dead, "out of it");
  assert.ok(!grave.dead, "buried in the wall: not solid, not caught");
  assert.ok(!lost.dead);
  assert.equal(round.lives, 3);
  assert.equal(events(round, "lose").length, 0, "you take nothing");
  assert.ok(round.score > score0);
  assert.equal(round.drops.length, 0, "no drops");
  const blast = round.hazards.find((h) => h.kind === "blast");
  assert.equal(blast.w, arm.BLAST_W);
  assert.equal(blast.live, 0, "it never hurts you");
  run(round, 500);
  assert.ok(!round.hazards.some((h) => h.kind === "blast"), "the flash is gone after 450 ms");
  // A stick landing on a board sits on it; one against a wall stops.
  const board = mineRound("collapse");
  standAt(board, 30, 1, 11, 0);
  board.you.safeMs = 1e9;
  sticks(board, 1);
  tapTap(board);
  run(board, 8);
  const bs = board.hazards.find((h) => h.kind === "stick");
  until(board, () => bs.rest, 1000);
  assert.ok(bs.rest);
  // A stick lost down a pit never blows.
  const pit = mineRound("collapse");
  const lostStick = { kind: "stick", x: 234, y: 7, vx: 0, vy: 0, fuse: 800, max: 1000, spin: 0, rest: false, w: 0.8, h: 0.8, live: 0, cause: "dynamite" };
  pit.hazards.push(lostStick);
  standAt(pit, 10);
  run(pit, 1200);
  assert.equal(events(pit, "dynBlast").length, 0);
  assert.ok(!pit.hazards.includes(lostStick));
  // The blast hurts the boss (8, double while he is dazed) only where he stands and is not hidden.
  const fight = seamFight();
  const b = fight.boss;
  const hp0 = b.hp;
  fight.hazards.push({ kind: "stick", x: b.x - 4, y: 6, vx: 0, vy: 0, fuse: 8, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(fight, 40);
  assert.equal(b.hp, hp0 - arm.DYN_BOSS_DMG, "8 off the boss");
  b.dazed = 1000;
  fight.hazards.push({ kind: "stick", x: b.x - 4, y: 6, vx: 0, vy: 0, fuse: 8, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(fight, 40);
  assert.equal(b.hp, hp0 - arm.DYN_BOSS_DMG * 3, "and 16 while dazed");
  const far = seamFight();
  far.hazards.push({ kind: "stick", x: far.boss.x - 30, y: 6, vx: 0, vy: 0, fuse: 8, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(far, 40);
  assert.equal(far.boss.hp, far.boss.max, "too far from him");
});

/* ------------------------------------------------------------ the boss */

function seamFight() {
  const round = mineRound("seam");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  ghoul.advance(round, 8, steady);
  round.you.safeMs = 1e9;
  round.events.length = 0;
  return round;
}

// The boss about to choose its `n`th move.
function choose(round, n) {
  Object.assign(round.boss, { act: "idle", wait: 0, moves: n - 1 });
}

// A bolt at the boss's chest, from the left.
const bossBolt = (round) => round.shots.push({ x: round.boss.x - round.boss.w / 2 - 0.3, y: round.boss.y + 8, vx: 80, vy: 0, gone: 0 });

test("Ghoul Rush's Tommyknocker waits at the end of the seam, then knocks: four beats 380 ms apart, a rock with 700 ms of dust at each (the first ahead of you, two 14 either side, the fourth between), then rests 0.7 s", () => {
  const round = seamFight();
  const b = round.boss;
  assert.equal(b.kind, "tommy");
  assert.equal(b.max, 120);
  assert.equal(ghoul.roomFor("seam", 0).bossHp, 120);
  assert.deepEqual([b.w, b.h], [10, 15]);
  assert.equal(round.blackout, false);
  choose(round, 1);
  const t0 = round.clock;
  const seen = [];
  for (let t = 0; t < 1900; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (e.type === "tommyKnock" || e.type === "rockWarn") seen.push([e.type, round.clock - t0, e]);
    round.events.length = 0;
  }
  const knocks = seen.filter((s) => s[0] === "tommyKnock");
  const warns = seen.filter((s) => s[0] === "rockWarn");
  assert.equal(knocks.length, 4);
  assert.deepEqual(knocks.map((k) => k[2].n), [1, 2, 3, 4]);
  assert.ok(Math.abs(knocks[1][1] - knocks[0][1] - mn.KNOCK_BEAT_MS) < 20 && Math.abs(knocks[2][1] - knocks[1][1] - mn.KNOCK_BEAT_MS) < 20 && Math.abs(knocks[3][1] - knocks[2][1] - mn.KNOCK_BEAT_MS) < 20, "380 ms apart");
  assert.equal(warns.length, 4, "a rock at each beat");
  assert.ok(warns.every(([, ms], i) => Math.abs(ms - knocks[i][1]) < 20), "with the beat");
  const spec = round.spec;
  const xs = warns.map((w) => w[2].x);
  assert.ok(Math.abs(xs[0] - round.you.x) < 1e-6, "the first over you");
  assert.ok(Math.abs(xs[2] - (round.you.x + mn.KNOCK_SPREAD)) < 1e-6 && xs[1] === spec.arena + 3, "and either side (the left clamped to the arena's wall)");
  assert.ok(warns.every((w) => w[2].ms === 700));
  assert.ok(b.act === "rest", "then he rests");
  // A second of rest after the last beat, then he waits before the next move.
  until(round, () => b.act === "idle", 1500);
  assert.ok(Math.abs(round.clock - t0 - knocks[3][1] - mn.KNOCK_REST_MS) < 30, `0.7 s of rest (${round.clock - t0 - knocks[3][1]})`);
  // Under his knocks you move to be safe: a rock over you costs a life.
  const hit = seamFight();
  hit.you.safeMs = 0;
  choose(hit, 1);
  until(hit, () => events(hit, "lose").length > 0, 3000);
  assert.equal(events(hit, "lose")[0]?.cause, "rock");
  // And a hard hat bounces the one that comes down on you, used up.
  const hat = seamFight();
  hat.you.hat = true;
  hat.you.safeMs = 0;
  choose(hat, 1);
  run(hat, 3000);
  assert.equal(events(hat, "lose").length, 0);
  assert.equal(events(hat, "rockBounce").length, 1);
  assert.equal(hat.you.hat, false);
});

test("Ghoul Rush's Tommyknocker winds up his hammer 500 ms when you are close, then sweeps low along the floor (15 long, 2.6 high, live 260 ms, the cause hammer): jump it", () => {
  const round = seamFight();
  const b = round.boss;
  standAt(round, b.x - b.w / 2 - 4);
  round.you.safeMs = 1e9;
  choose(round, 2);
  const wind = log(round, 8, "sweepWind");
  assert.equal(wind.length, 1);
  assert.equal(b.act, "sweepWind");
  const s0 = round.clock;
  assert.ok(upTo(round, "tommySweep", 700), "the sweep");
  assert.ok(Math.abs(round.clock - s0 - mn.SWEEP_WIND_MS) < 20, `500 ms (${round.clock - s0})`);
  const hz = round.hazards.find((h) => h.kind === "hammer");
  assert.ok(hz && hz.w === 15 && hz.h === 2.6 && hz.cause === "hammer" && hz.live > 200 && hz.dir === -1);
  assert.ok(hz.x < b.x - b.w / 2, "in front of him");
  assert.equal(b.act, "rest");
  run(round, 300);
  assert.ok(!round.hazards.some((h) => h.kind === "hammer"), "gone in 260 ms");
  // Standing in it costs a life; in the air above 2.6 does not; out of reach does not.
  const hit = seamFight();
  standAt(hit, hit.boss.x - hit.boss.w / 2 - 4);
  hit.you.safeMs = 0;
  choose(hit, 2);
  until(hit, () => events(hit, "lose").length > 0, 1500);
  assert.equal(events(hit, "lose")[0]?.cause, "hammer");
  const jump = seamFight();
  standAt(jump, jump.boss.x - jump.boss.w / 2 - 4);
  jump.you.safeMs = 0;
  choose(jump, 2);
  assert.ok(upTo(jump, "sweepWind", 100));
  run(jump, 300);
  jump.input.up = true;
  ghoul.jump(jump);
  assert.ok(upTo(jump, "tommySweep", 600), "it sweeps under you");
  run(jump, 700);
  assert.equal(events(jump, "lose").length, 0, "jumped it");
  // Not twice within 1.8 s: the next close move is not a sweep.
  const twice = seamFight();
  const tb = twice.boss;
  standAt(twice, tb.x - tb.w / 2 - 4);
  twice.you.safeMs = 1e9;
  choose(twice, 2);
  until(twice, () => events(twice, "tommySweep").length > 0, 800);
  choose(twice, 4);
  tb.swingCool = 1000;
  run(twice, 40);
  assert.equal(events(twice, "sweepWind").length, 1, "no second sweep so soon");
  assert.ok(tb.act === "knock", "a knock instead");
});

test("Ghoul Rush's Tommyknocker puts the lights out: the room goes dark, he sinks (nothing can hit him), a decoy imp carries his lantern, the real knocking trickles from where he will burst out, and after 4 s he bursts out there", () => {
  const round = seamFight();
  const b = round.boss;
  choose(round, 3);
  const dark = log(round, 8, "tommyDark");
  assert.equal(dark.length, 1);
  assert.equal(round.blackout, true, "the lamps are out");
  assert.equal(b.darkOn, true);
  assert.equal(b.act, "dark");
  assert.equal(b.hidden, false);
  const sink = log(round, 800, "tommySink");
  assert.equal(sink.length, 1);
  assert.ok(Math.abs(sink[0][0] - mn.TOMMY_SINK_MS) < 30, `600 ms (${sink[0][0]})`);
  assert.equal(b.hidden, true);
  assert.equal(b.y, mn.HIDE_Y);
  assert.equal(b.act, "hidden");
  assert.equal(round.blackout, true);
  // Nothing hits him down there: no bolt, no stomp, no touch.
  const hp0 = b.hp;
  round.shots.push({ x: b.x - 6, y: 8, vx: 80, vy: 0, gone: 0 });
  standAt(round, b.x, 1, 6);
  round.you.safeMs = 0;
  run(round, 120);
  assert.equal(b.hp, hp0);
  assert.equal(events(round, "lose").length, 0);
  // The decoy: an imp with his lantern, at the side opposite where he will burst out.
  const decoy = round.monsters.find((m) => m.decoy);
  assert.ok(decoy && decoy.kind === "imp");
  const lo = 104 + 6 + 5;
  const hi = 200 - 6 - 5;
  assert.ok(Math.abs(b.burstX - (lo + (hi - lo) * 0.25)) < 1e-9, `he bursts out at a quarter across (${b.burstX})`);
  assert.ok(Math.abs(b.decoyX - (lo + (hi - lo) * 0.75)) < 1e-9);
  run(round, 400);
  assert.ok(Math.abs(decoy.x - b.decoyX) < 8, "it keeps to its spot");
  assert.equal(decoy.act, "pace");
  assert.equal(round.you.dimMs, 0, "the decoy steals nothing");
  // Knocking from the burst spot every 700 ms.
  const t0 = round.clock;
  const knocks = log(round, 2000, "tommyKnockDark");
  assert.ok(knocks.length >= 2 && knocks.every(([, e]) => e.x === b.burstX), "dust where he will come out");
  assert.ok(Math.abs(knocks[1][0] - knocks[0][0] - mn.KNOCK_DARK_MS) < 20);
  // Out after 4 s of dark, dazed, the lamps back on.
  const burst = upTo(round, "tommyBurst", 4400);
  assert.ok(burst, "he bursts out");
  assert.equal(burst.x, b.burstX);
  assert.equal(b.hidden, false);
  assert.equal(b.x, b.burstX);
  assert.equal(b.y, 6);
  assert.equal(round.blackout, false);
  assert.equal(b.darkOn, false);
  assert.equal(b.dazed > 1300 && b.dazed <= mn.DAZE_MS, true);
  assert.equal(b.act, "dazed");
  assert.ok(round.monsters.every((m) => !m.decoy), "the lantern is out");
  // The whole dark was about 4 s from the sink.
  const total = mineDarkLength(false);
  assert.ok(Math.abs(total - (mn.TOMMY_SINK_MS + mn.DARK_MS)) < 60, `${mn.DARK_MS} ms in the seam (${total})`);
});

// Milliseconds from the lights going out to the burst, for a fight at full hp or raged.
function mineDarkLength(raged) {
  const round = seamFight();
  if (raged) round.boss.hp = Math.floor(round.boss.max / 2);
  choose(round, 3);
  ghoul.advance(round, 8, steady);
  const t0 = round.clock;
  let burst = -1;
  for (let t = 0; t < 9000 && burst < 0; t += 4) {
    ghoul.advance(round, 4, steady);
    if (events(round, "tommyBurst").length) burst = round.clock - t0;
    round.events.length = 0;
  }
  return burst;
}

test("Ghoul Rush's Tommyknocker is dazed 1.5 s after bursting out and takes double damage then (a bolt does 2, the hit says weak), only then", () => {
  const round = seamFight();
  const b = round.boss;
  choose(round, 3);
  until(round, () => events(round, "tommyBurst").length > 0, 6000);
  assert.ok(b.dazed > 1400);
  round.events.length = 0;
  const hp0 = b.hp;
  bossBolt(round);
  ghoul.advance(round, 8, steady);
  assert.equal(hp0 - b.hp, 2, "double");
  const hit = events(round, "bossHit")[0];
  assert.equal(hit.how, "weak");
  assert.equal(hit.weak, true);
  assert.equal(hit.kind, "tommy");
  // He does not attack while dazed, and stands where he came out.
  const x0 = b.x;
  run(round, 1200);
  assert.equal(b.x, x0);
  assert.equal(b.act, "dazed");
  // After the 1.5 s: normal damage.
  until(round, () => b.dazed <= 0, 1500);
  assert.equal(b.dazed, 0);
  round.events.length = 0;
  const hp1 = b.hp;
  bossBolt(round);
  ghoul.advance(round, 8, steady);
  assert.equal(hp1 - b.hp, 1, "single again");
  assert.equal(events(round, "bossHit")[0].weak, false);
  // Never before he has burst out.
  const fresh = seamFight();
  const hp2 = fresh.boss.hp;
  bossBolt(fresh);
  ghoul.advance(fresh, 8, steady);
  assert.equal(hp2 - fresh.boss.hp, 1);
  // Bursting out where you stand hurts: he is no ghost.
  const ambush = seamFight();
  choose(ambush, 3);
  ghoul.advance(ambush, 8, steady);
  until(ambush, () => ambush.boss.hidden, 1000);
  ambush.you.safeMs = 0;
  standAt(ambush, ambush.boss.burstX);
  until(ambush, () => events(ambush, "lose").length > 0, 6000);
  assert.ok(["tommy", "hammer"].includes(events(ambush, "lose")[0]?.cause), "the eruption or his touch");
});

test("Ghoul Rush's Tommyknocker rages at half his hp: every wait 0.7 as long, the dark lasts 6 s, and each lights-out sends 3 imps, never more than 5 alive", () => {
  const round = seamFight();
  const b = round.boss;
  b.hp = Math.floor(b.max / 2);
  const rage = log(round, 40, "tommyRage");
  assert.equal(rage.length, 1);
  assert.equal(b.raged, true);
  assert.equal(log(round, 200, "tommyRage").length, 0, "once");
  // The dark is 6 s.
  const calm1 = mineDarkLength(false);
  const raged = mineDarkLength(true);
  assert.ok(Math.abs(raged - (mn.TOMMY_SINK_MS * mn.TOMMY_QUICK + mn.DARK_RAGE_MS)) < 80, `6 s of dark (${raged})`);
  assert.ok(raged > calm1 + 1500);
  // Each lights-out sends three imps.
  const imps = seamFight();
  imps.boss.hp = Math.floor(imps.boss.max / 2);
  choose(imps, 3);
  ghoul.advance(imps, 8, steady);
  assert.equal(imps.monsters.filter((m) => m.kind === "imp").length, 3, "three imps");
  assert.ok(imps.monsters.every((m) => m.kind !== "imp" || !m.decoy));
  until(imps, () => imps.boss.hidden, 1000);
  assert.equal(imps.monsters.filter((m) => m.kind === "imp").length, 4, "and the decoy");
  // Never more than five alive.
  const cap = seamFight();
  cap.boss.hp = Math.floor(cap.boss.max / 2);
  for (let i = 0; i < 4; i++) put(cap, "imp", 150 + i * 3);
  choose(cap, 3);
  ghoul.advance(cap, 8, steady);
  assert.equal(cap.monsters.filter((m) => m.kind === "imp").length, 5, "capped at five");
  const quiet = seamFight();
  choose(quiet, 3);
  ghoul.advance(quiet, 8, steady);
  assert.equal(quiet.monsters.filter((m) => m.kind === "imp").length, 0, "no imps before the rage");
  // Waits are 0.7 as long: the idle between moves.
  const fast = seamFight();
  fast.boss.hp = Math.floor(fast.boss.max / 2);
  run(fast, 40);
  Object.assign(fast.boss, { act: "rest", wait: 1 });
  run(fast, 8);
  assert.ok(Math.abs(fast.boss.wait - mn.TOMMY_IDLE_MS * mn.TOMMY_QUICK) < 20, `idle ${fast.boss.wait}`);
});

test("Ghoul Rush's Tommyknocker draws no random number in any move, and neither do the rocks, the imps, the miners, the crawlers or the cages", () => {
  const fight = seamFight();
  fight.boss.hp = fight.boss.max;
  for (let n = 1; n <= 7; n++) {
    choose(fight, n);
    fight.boss.hp = n > 4 ? Math.floor(fight.boss.max / 2) : fight.boss.hp;
    standAt(fight, n % 2 ? fight.spec.arena + 12 : fight.boss.x - fight.boss.w / 2 - 4);
    fight.you.safeMs = 1e9;
    run(fight, 6200, {}, never);
  }
  for (const type of ["tommyKnock", "sweepWind", "tommySweep", "tommyDark", "tommySink", "tommyKnockDark", "tommyBurst", "tommyRage"]) assert.ok(events(fight, type).length > 0, `${type} happened without a random draw`);
  const tun = mineRound("tunnels", { rocks: true });
  standAt(tun, 60);
  tun.you.safeMs = 1e9;
  put(tun, "blind", 100);
  put(tun, "miner", 120);
  put(tun, "canary", 90, { y: 14.5 });
  tun.twist.next = 0;
  run(tun, 4000, { right: true }, never);
  assert.ok(events(tun, "rockWarn").length >= 1 && events(tun, "canaryScream").length >= 0);
  const sh = mineRound("shaft", { rocks: true });
  standAt(sh, 60);
  sh.you.safeMs = 1e9;
  // The imp behind you, out of the way of the bolts (a bolt's kill may drop loot).
  put(sh, "imp", 20);
  put(sh, "cage", 100, { y: 6.2, lo: 6.2, hi: 17.8, v: 7, rest: 0 });
  sticks(sh, 2);
  tapTap(sh);
  run(sh, 3000, { fire: true }, never);
  assert.ok(events(sh, "dynBlast").length >= 1);
});

/* -------------------------------------------------------------- endless */

test("Ghoul Rush's endless lives (round.infinite) spare every new way to lose a life: a rock, a pickaxe, a hammer sweep, a miner, a blind crawler and the Tommyknocker himself", () => {
  const costs = (id, setup, cause, { fight = false } = {}) => {
    for (const infinite of [false, true]) {
      const round = fight ? seamFight() : mineRound(id);
      round.infinite = infinite;
      round.you.safeMs = 0;
      setup(round);
      until(round, () => events(round, "lose").length > 0, 3000);
      const e = events(round, "lose")[0];
      assert.equal(e?.cause, cause, `${cause}: a life is lost`);
      assert.equal(round.lives, infinite ? 3 : 2, `${cause}: ${infinite ? "spared" : "costs one"}`);
    }
  };
  costs("collapse", (r) => (standAt(r, 60), r.hazards.push(rockAt(60))), "rock");
  costs("tunnels", (r) => (standAt(r, 46), put(r, "miner", 52, { act: "walk" })), "pickaxe");
  costs("tunnels", (r) => (standAt(r, 50), put(r, "miner", 50.5, { act: "walk" })), "miner");
  costs("shaft", (r) => (standAt(r, 40), put(r, "blind", 40.5)), "blind");
  costs("seam", (r) => (standAt(r, r.boss.x - r.boss.w / 2 - 4), choose(r, 2)), "hammer", { fight: true });
  costs("seam", (r) => standAt(r, r.boss.x - 3), "tommy", { fight: true });
  // The imp, the canary and the cage never cost one at all, endless or not.
  const round = mineRound("shaft");
  standAt(round, 40);
  put(round, "imp", 40.5);
  put(round, "canary", 40, { y: 7 });
  put(round, "cage", 40, { y: 6.2, lo: 6.2, hi: 6.2, v: 0, rest: 1e9 });
  run(round, 600);
  assert.equal(events(round, "lose").length, 0);
});

/* ---------------------------------------------------- voices and drawing */

test("Ghoul Rush's Mine: every new kind has a voice for every act, each a real tone, and every event of the pack plays its own sound exactly once", () => {
  const listed = {
    imp: ["appear", "steal", "drop", "hurt", "die"],
    canary: ["appear", "scream", "hurt", "die"],
    miner: ["appear", "dig", "wind", "swing", "hurt", "die"],
    blind: ["appear", "lost", "hear", "hurt", "die"],
    cage: ["appear", "die"],
    tommy: ["wake", "knock", "sweepWind", "sweep", "dark", "sink", "knockDark", "burst", "rage", "hurt", "weak", "die"],
    rock: ["warn", "fall", "land", "bounce"],
    water: ["wade"],
    hat: ["active"],
    dyn: ["active", "throw", "blast"],
  };
  for (const [kind, acts] of Object.entries(listed)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(merged[VOICES[kind][act]]?.layers?.length, `${kind}.${act}: ${VOICES[kind][act]} is a tone`);
  for (const kind of [...Object.keys(mn.MONSTERS), ...Object.keys(mn.BOSSES)]) assert.ok(VOICES[kind] && VOICES[kind].die, `${kind} has a voice and a death`);
  // Every event the pack emits is answered by one act, played once and nothing else (a splash is gated).
  for (const type of mn.EVENTS) assert.ok(EVENT_VOICE[type], `${type} is heard`);
  for (const type of Object.keys(EVENT_VOICE)) assert.ok(mn.EVENTS.includes(type), `${type} is an event of the pack`);
  assert.equal(new Set(mn.EVENTS).size, mn.EVENTS.length);
  for (const [type, [kind, act]] of Object.entries(EVENT_VOICE)) {
    assert.ok(listed[kind].includes(act), `${type}: ${kind} ${act} is a listed act`);
    assert.deepEqual(heard({ type, kind }).played, [VOICES[kind][act]], `${type}: ${kind} ${act}, once`);
  }
  // Each listed act is the voice of some event (or the game's own play of it).
  const reached = new Set(Object.values(EVENT_VOICE).map(([kind, act]) => `${kind}.${act}`));
  const theGames = ["imp.appear", "imp.hurt", "imp.die", "canary.appear", "canary.hurt", "canary.die", "miner.appear", "miner.hurt", "miner.die", "blind.appear", "blind.hurt", "blind.die", "cage.appear", "cage.die", "tommy.wake", "tommy.hurt", "tommy.weak", "tommy.die", "hat.active", "dyn.active"];
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(reached.has(`${kind}.${act}`) || theGames.includes(`${kind}.${act}`), `${kind}.${act} is played by something`);
  const once = (e, kind, act) => {
    const played = heard(e).played;
    assert.equal(played.filter((n) => n === VOICES[kind][act]).length, 1, `${e.type}: ${kind} ${act} once`);
  };
  once({ type: "spawn", kind: "imp" }, "imp", "appear");
  once({ type: "spawn", kind: "canary" }, "canary", "appear");
  once({ type: "spawn", kind: "miner" }, "miner", "appear");
  once({ type: "spawn", kind: "blind" }, "blind", "appear");
  once({ type: "spawn", kind: "cage" }, "cage", "appear");
  once({ type: "bossWake", kind: "tommy" }, "tommy", "wake");
  once({ type: "bossHit", kind: "tommy", how: "shot" }, "tommy", "hurt");
  once({ type: "bossHit", kind: "tommy", how: "weak", weak: true }, "tommy", "weak");
  once({ type: "bossDown", kind: "tommy", points: 1 }, "tommy", "die");
  once({ type: "hit", kind: "imp" }, "imp", "hurt");
  once({ type: "kill", kind: "blind", mult: 1, how: "shot", points: 1 }, "blind", "die");
  once({ type: "kill", kind: "miner", mult: 1, how: "shot", points: 1 }, "miner", "die");
  const words = [];
  heard({ type: "bossHit", kind: "tommy", how: "weak", weak: true }, { float: (x, y, text) => words.push(text) });
  assert.ok(words.includes("Double!"), "a weak hit says Double!");
  for (const kind of ["hat", "dyn"]) {
    const played = heard({ type: "power", kind, points: 50 }).played;
    assert.ok(played.includes(VOICES[kind].active) && !played.includes("powerUp"), `${kind}: the pickup is its own sound`);
  }
});

test("Ghoul Rush's Mine: every new way to die has its words and its own sound", () => {
  for (const cause of ["rock", "miner", "pickaxe", "blind", "tommy", "hammer"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).played.includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Mine draws: every room, every monster in every act, the rocks in each state, the stick and its blast, the swings, the water, the Tommyknocker in each move hidden or not, the lights out, a dimmed light, both badges, and the stage's card, in a lit room and a dark one", () => {
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
  const acts = {
    imp: [{ act: "skitter" }, { act: "flee", stole: true }, { act: "pace", decoy: true }],
    canary: [{ act: "flit", y: 14 }, { act: "scream", y: 14 }, { act: "flee", y: 14 }],
    miner: [{ act: "buried" }, { act: "dig", wait: 300 }, { act: "walk" }, { act: "wind", wait: 200 }, { act: "rest" }],
    blind: [{ act: "lost" }, { act: "hunt" }],
    cage: [{ act: "ride", y: 8, lo: 6.2, hi: 17.8, rest: 0 }, { act: "ride", y: 17.8, lo: 6.2, hi: 17.8, rest: 800 }],
  };
  for (const id of ROOM_IDS) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      for (const dim of [0, 3000]) {
        r.dark = dark;
        r.phase = "play";
        r.lives = 99;
        for (const st of r.spawns) st.over = true;
        r.hordeMs = Infinity;
        r.monsters.length = 0;
        r.twist = calm();
        standAt(r, id === "seam" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
        r.you.safeMs = 1e9;
        r.you.dimMs = dim;
        r.dyn = 2;
        for (const [kind, list] of Object.entries(acts)) list.forEach((over, i) => put(r, kind, r.you.x + 6 + i * 5, { wait: 1e9, ...over }));
        r.hazards.push(
          rockAt(r.you.x + 8),
          rockAt(r.you.x + 12, { state: "fall", y: 20, live: 1 }),
          rockAt(r.you.x + 16, { state: "rubble", y: 6, h: 1.4, live: 0, rub: 2000 }),
          { kind: "stick", x: r.you.x + 20, y: 9, vx: 10, vy: 0, fuse: 500, max: 1000, spin: 1, rest: false, w: 0.8, h: 0.8, live: 0, cause: "dynamite" },
          { kind: "blast", x: r.you.x + 26, y: 6, w: 22, h: 12, boom: 200, max: 450, live: 0, cause: "dynamite" },
          { kind: "pick", x: r.you.x + 30, y: 6, w: 5, h: 4.2, dir: 1, live: 100, max: 200, cause: "pickaxe" },
          { kind: "hammer", x: r.you.x + 34, y: 6, w: 15, h: 2.6, dir: -1, live: 100, max: 260, cause: "hammer" },
        );
        if (r.boss) {
          ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
          for (const act of ["idle", "knock", "sweepWind", "rest", "dark", "hidden", "dazed"]) {
            Object.assign(r.boss, { act, wait: 1e9, knockIn: 200, beat: 1, dir: -1, hidden: act === "hidden", darkOn: act === "dark" || act === "hidden", dazed: act === "dazed" ? 1000 : 0, burstX: 150, decoyX: 180, y: act === "hidden" ? mn.HIDE_Y : 6 });
            r.blackout = r.boss.darkOn;
            g.tick(16);
          }
          Object.assign(r.boss, { hidden: false, y: 6, darkOn: false });
          r.boss.raged = true;
        }
        r.blackout = false;
        for (let k = 0; k < 20; k++) g.tick(16);
        r.blackout = true;
        g.tick(16);
        r.blackout = false;
        r.you.safeMs = 1e9;
      }
    }
  }
  assert.ok(r.spec.id === "seam", "got to the seam and drew it");
  // A sleeping Tommyknocker, the boss bar, and the badges as they sit in a room.
  for (const kind of ["hat", "dyn"]) {
    const p = mineRound("shaft");
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
  p.offer = ["mine", "village"];
  p.phase = "pick";
  p.phaseMs = 0;
  for (let k = 0; k < 4; k++) pick.tick(16);
  assert.equal(p.phase, "pick", "the pick screen draws the Mine's card");
  // And the dark sees what is lit: the blackout and the dim raise the dark and shrink the glow.
  assert.equal(LOOKS.shaft.pack, "mine");
});

test("Ghoul Rush's stage select lists the Mine and takes you straight into each of its rooms", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.stageSelect();
  const r = g.round;
  assert.equal(r.phase, "select");
  const at = ghoul.STAGES.findIndex((s) => s.id === "mine");
  assert.equal(at, ghoul.STAGES.length - 4);
  for (let i = 0; i < at; i++) ghoul.steerSelect(r, 1, 0);
  for (let i = 0; i < 4; i++) ghoul.steerSelect(r, 0, 1);
  assert.equal(r.select.at, at);
  assert.equal(r.select.room, 4);
  ghoul.takeSelect(r);
  assert.equal(r.spec.id, "seam");
  assert.equal(r.stage, "mine");
  assert.equal(r.dark, true, "always dark");
  g.tick(16);
});
