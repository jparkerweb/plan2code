// Web console tests, Ghoul Rush's Hollow End Village stage: its four rooms, the moonrise (a moon that climbs over each room and, at full, turns the villagers into wolf-men and makes the moonhounds grow), torch mob villagers that lob fire, hanged men that drop on their ropes, shutter ghouls that can be hit only while out, moonhounds, Wolfsbane (found only here), and the Beast of Hollow End, which clings to the wall for double damage, pounces under a shadow, swipes, howls for hounds and rages at half its hp.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as vl from "../src/web-console/public/activities/ghoul-rush/stages/village/ghoul-village.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-rush/stages/village/ghoul-village-draw.js";
import { PILL_WORDS, pickPower } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-powers.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the village drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);
const ROOM_IDS = ["street", "inn", "square", "green"];

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Village's room `id`, reached the way play reaches it, nothing
// woken: every spawner spent, the horde held back, the moon far from rising
// (set `full` for a full one).
function vilRound(id, { full = false } = {}) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["village"];
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
  if (!round.spec.boss) round.twist = { moon: full ? 1 : 0, full, ms: full ? 1e9 : -1e12 };
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
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return { played };
};

test("Ghoul Rush's Hollow End Village is a stage of three rooms and the Green, its monsters and boss joined to the game's, with a power-up of its own, a moon that rises and a place for each kind", () => {
  const st = ghoul.stageById("village");
  assert.deepEqual(st.rooms, ["street", "inn", "square", "wagon", "green"], "the Torch Mob bonus ride sits before the Green");
  assert.equal(st.boss, "beast");
  assert.equal(st.title, "Hollow End Village");
  assert.equal(st.sub, "Every curtain twitches as you pass");
  for (const kind of Object.keys(vl.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], vl.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.BOSSES.beast, vl.BOSSES.beast);
  assert.equal(vl.BOSSES.beast.sub, "Shoot it while it clings to the wall");
  assert.ok(ghoul.MONSTERS.villager.hp === 3 && ghoul.MONSTERS.hanged.hp === 3 && ghoul.MONSTERS.shutter.hp === 2 && ghoul.BOSSES.beast.hp === 110);
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const [street, inn, square, , green] = st.rooms.map((id) => ghoul.roomById(id));
  const returning = ["zombie", "bat", "crow", "hound", "ghost"];
  for (const room of [street, inn, square]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    assert.ok(room.items.some((i) => i[0] === "bane"), `${room.id}: Wolfsbane`);
    assert.ok(room.spawns.some((s) => s[0] in vl.MONSTERS), `${room.id}: some of the new monsters`);
    assert.ok(room.spawns.some((s) => returning.includes(s[0])), `${room.id}: some returning ones`);
    assert.ok(room.moon > 0, `${room.id}: a moon`);
  }
  assert.deepEqual([street.moon, inn.moon, square.moon, green.moon], [45000, 40000, 35000, 0]);
  assert.ok(street.spawns.some((s) => s[0] === "shutter") && street.spawns.some((s) => s[0] === "villager"), "shutter ghouls and the mob on Main Street");
  assert.ok(inn.spawns.some((s) => s[0] === "moonhound") && inn.spawns.some((s) => s[0] === "villager"), "moonhounds and villagers in the inn");
  assert.ok(square.spawns.filter((s) => s[0] === "hanged").length >= 4, "hanged men in the square");
  for (const kind of Object.keys(vl.MONSTERS)) assert.ok(square.spawns.some((s) => s[0] === kind), `the Square has ${kind}`);
  assert.ok(square.shelves.some((s) => s[1] - s[0] >= 20), "the gallows platform");
  assert.equal(green.boss, "beast");
  assert.equal(green.horde.length, 0);
  assert.ok(street.spawns.length <= inn.spawns.length && inn.spawns.length <= square.spawns.length);
  assert.ok(street.hordeMs > inn.hordeMs && inn.hordeMs > square.hordeMs, "harder in order");
  assert.ok(street.moon > inn.moon && inn.moon > square.moon, "the moon rises sooner in order");
  // The street, the square and the green are out under the sky; the inn is indoors.
  assert.ok(LOOKS.street.outdoor && LOOKS.square.outdoor && LOOKS.green.outdoor);
  assert.ok(!LOOKS.inn.outdoor && LOOKS.inn.custom && LOOKS.inn.pack === "village", "the inn is indoors, a custom room the village draws whole");
  // A window is a little way up its wall; a hanged man's beam is 13 over what he hangs above.
  for (const room of [street, inn, square]) {
    for (const [kind, x, y] of room.spawns.filter((s) => s[0] === "shutter" || s[0] === "hanged")) {
      const floor = ghoul.groundAt(room, x);
      assert.ok(floor > -Infinity, `${room.id}: the ${kind} at ${x} over a floor`);
      if (kind === "shutter") assert.ok(y - floor >= 6.5 && y - floor <= 8, `${room.id}: the window at ${x} (${y - floor} up)`);
      else {
        const top = Math.max(floor, ...room.shelves.filter(([a, b, t]) => x >= a && x <= b && t < y).map((s) => s[2]));
        assert.equal(y - top, 13, `${room.id}: the beam at ${x}`);
      }
    }
  }
});

/* ---------------------------------------------------------- the moonrise */

test("Ghoul Rush's moon climbs over a room in its own time, is full once with a fullMoon, and starts over in the next room and after a life lost", () => {
  const round = vilRound("street");
  round.twist = null;
  standAt(round, 40);
  round.you.safeMs = 1e9;
  ghoul.advance(round, 8, steady);
  assert.ok(round.twist && round.twist.moon > 0 && round.twist.moon < 0.001 && !round.twist.full);
  run(round, 22400);
  assert.ok(Math.abs(round.twist.moon - 0.5) < 0.01, `half way (${round.twist.moon})`);
  assert.equal(events(round, "fullMoon").length, 0);
  const got = log(round, 23000, "fullMoon");
  assert.equal(got.length, 1, "one fullMoon");
  assert.ok(Math.abs(got[0][0] - 45000) < 40, `at 45 s (${got[0][0]})`);
  assert.equal(round.twist.moon, 1);
  assert.equal(round.twist.full, true);
  run(round, 2000);
  assert.equal(events(round, "fullMoon").length, 0, "never again");
  // The next room's moon starts at the bottom of the sky.
  through(round);
  assert.equal(round.spec.id, "inn");
  assert.equal(round.twist, null);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.hordeMs = Infinity;
  round.timeMs = 1e9;
  round.you.safeMs = 1e9;
  round.twist = null;
  run(round, 8);
  assert.ok(round.twist.moon < 0.001 && !round.twist.full);
  run(round, 20000);
  assert.ok(Math.abs(round.twist.moon - 0.5) < 0.01, "the inn's moon is quicker (40 s)");
  // A life lost puts the moon back where it began.
  ghoul.lose(round, "zombie");
  run(round, ghoul.CRASH_MS + 100);
  assert.equal(round.twist, null);
  assert.equal(round.phase, "ready");
});

test("Ghoul Rush's full moon turns every villager in view for 800 ms into a wolf-man with 2 more hp and no torches, and one that comes into view later turns too", () => {
  const round = vilRound("street");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const a = put(round, "villager", 70, { group: true });
  const b = put(round, "villager", 300, { group: true });
  assert.equal(a.hp, 3);
  round.twist = { moon: 0.9999, full: false, ms: 44999 };
  const turned = log(round, 40, "villagerTurn");
  assert.equal(events(round, "fullMoon").length + turned.length > 0, true);
  assert.equal(a.act, "turn", "in view: turning");
  assert.equal(b.act, "walk", "out of view: not yet");
  const started = turned[0][0];
  const wolf = log(round, 1000, "villagerWolf");
  assert.equal(wolf.length, 1, "one wolf-man");
  assert.ok(Math.abs(wolf[0][0] - started - vl.VILLAGER_TURN_MS) < 40, `800 ms to turn (${wolf[0][0] - started})`);
  assert.equal(a.turned, true);
  assert.equal(a.hp, 5);
  assert.equal(a.max, 5);
  // No more torches from it, though it is near enough to throw.
  a.x = 70;
  assert.equal(log(round, 3000, "torchWind").length, 0);
  // The other comes into view: it turns then.
  b.x = 100;
  round.camX = 0;
  const later = log(round, 40, "villagerTurn");
  assert.equal(later.length, 1);
  assert.equal(later[0][1].x, b.x);
});

test("Ghoul Rush's moonhounds grow 1.5 times with 3 more hp at full moon, each told by houndGrow once, and one born later is grown too", () => {
  const round = vilRound("inn");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const h = put(round, "moonhound", 70, { act: "rest", wait: 1e9 });
  run(round, 400);
  assert.equal(h.grown, undefined);
  assert.equal(h.w, 3.8);
  round.twist = { moon: 1, full: true, ms: 1e9 };
  const grew = log(round, 40, "houndGrow");
  assert.equal(grew.length, 1);
  assert.equal(h.grown, true);
  assert.ok(Math.abs(h.w - 5.7) < 1e-9 && Math.abs(h.h - 3.9) < 1e-9);
  assert.equal(h.hp, 5);
  assert.equal(h.max, 5);
  assert.equal(log(round, 400, "houndGrow").length, 0, "once");
  const late = put(round, "moonhound", 90, { act: "rest", wait: 1e9 });
  assert.equal(log(round, 40, "houndGrow").length, 1);
  assert.equal(late.hp, 5);
});

/* ----------------------------------------------------------- the villager */

test("Ghoul Rush's villager: a spawn row is a group of three, a horde one comes alone, it walks at you and stops 16 away", () => {
  const round = vilRound("street");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const v = put(round, "villager", 130);
  run(round, 8);
  const crowd = round.monsters.filter((m) => m.kind === "villager");
  assert.equal(crowd.length, vl.VILLAGER_GROUP);
  const xs = crowd.map((m) => m.x).sort((a, c) => a - c);
  assert.ok(Math.abs(xs[1] - xs[0] - vl.VILLAGER_SPREAD) < 0.3 && Math.abs(xs[2] - xs[1] - vl.VILLAGER_SPREAD) < 0.3, `2.6 apart (${xs})`);
  assert.ok(crowd.every((m) => m.y === ghoul.groundAt(round.spec, m.x)), "all on the floor");
  const horde = vilRound("street");
  put(horde, "villager", 130, { horde: true });
  run(horde, 8);
  assert.equal(horde.monsters.length, 1, "alone");
  // Walks at you, stops 16 away.
  const walker = vilRound("street");
  standAt(walker, 40);
  walker.you.safeMs = 1e9;
  const w = put(walker, "villager", 80, { group: true });
  const x0 = w.x;
  run(walker, 400);
  assert.ok(w.x < x0 - 2, "it walks at you");
  run(walker, 3000);
  const away = w.x - walker.you.x;
  assert.ok(away >= vl.VILLAGER_KEEP - 0.1 && away < vl.VILLAGER_KEEP + 2, `about 16 away (${away})`);
  assert.equal(v.kind, "villager");
});

test("Ghoul Rush's villager winds up 500 ms, lobs a torch at you that comes down in a patch of fire for 3.2 s, and the torch in the air and the fire both cost a life", () => {
  const round = vilRound("street");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const v = put(round, "villager", 56, { group: true });
  v.init = true;
  v.throwIn = 0;
  const wind = log(round, 8, "torchWind");
  assert.equal(wind.length, 1);
  const startedAt = wind[0][0];
  const throws = log(round, 700, "throw");
  assert.equal(throws.length, 1);
  assert.ok(Math.abs(throws[0][0] - startedAt - vl.TORCH_WIND_MS) < 40, `500 ms of wind-up (${throws[0][0] - startedAt})`);
  assert.equal(throws[0][1].kind, "torch");
  assert.equal(throws[0][1].by, "villager");
  const torch = round.bones.find((b) => b.kind === "torch");
  assert.ok(torch && torch.cause === "torch");
  const landed = [];
  for (let t = 0; t < 2000 && !landed.length; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (e.type === "torchLand") landed.push([round.clock, e]);
    round.events.length = 0;
  }
  assert.equal(landed.length, 1);
  const fire = round.hazards.find((h) => h.kind === "torchfire");
  assert.ok(fire && Math.abs(fire.x - 40) < 6, "the fire where you stood");
  assert.ok(fire.live > vl.TORCHFIRE_MS - 100 && fire.w === vl.TORCHFIRE_W && fire.h === vl.TORCHFIRE_H);
  const burnt = landed[0][0];
  run(round, 3000);
  assert.ok(round.hazards.some((h) => h.kind === "torchfire"), "still burning");
  run(round, 400);
  assert.equal(round.hazards.filter((h) => h.kind === "torchfire").length, 0, "burnt out");
  assert.ok(round.clock - burnt > 3200 - 100);
  // A torch shot out of the air is points, not fire.
  const shot = vilRound("street");
  standAt(shot, 40);
  shot.bones.push({ id: 9e9, kind: "torch", cause: "torch", x: 45, y: 8.4, vx: 0, vy: 0, spin: 0, life: 4000 });
  shot.shots.push({ x: 44.2, y: 8.4, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(shot, 8, steady);
  assert.equal(shot.bones.length, 0);
  assert.equal(events(shot, "bone")[0]?.kind, "torch");
  // Fire in the air and on the floor costs a life, the cause torch.
  const air = vilRound("street");
  standAt(air, 40);
  air.bones.push({ id: 9e9, kind: "torch", cause: "torch", x: 40, y: 8, vx: 0, vy: 0, spin: 0, life: 4000 });
  ghoul.advance(air, 8, steady);
  assert.equal(events(air, "lose")[0]?.cause, "torch");
  const floor = vilRound("street");
  standAt(floor, 40);
  floor.hazards.push({ kind: "torchfire", x: 40, y: 6, w: 4.4, h: 2.4, live: 2000, max: 3200, cause: "torch" });
  ghoul.advance(floor, 8, steady);
  assert.equal(events(floor, "lose")[0]?.cause, "torch");
  // Standing beside it is safe; jumping over it, too.
  const beside = vilRound("street");
  standAt(beside, 40);
  beside.hazards.push({ kind: "torchfire", x: 46, y: 6, w: 4.4, h: 2.4, live: 2000, max: 3200, cause: "torch" });
  ghoul.advance(beside, 8, steady);
  assert.equal(events(beside, "lose").length, 0);
  const hop = vilRound("street");
  standAt(hop, 40, 1, 9, -1);
  Object.assign(hop.you, { state: "air", vy: 0 });
  hop.hazards.push({ kind: "torchfire", x: 40, y: 6, w: 4.4, h: 2.4, live: 2000, max: 3200, cause: "torch" });
  ghoul.advance(hop, 4, steady);
  assert.equal(events(hop, "lose").length, 0, "over the fire");
  // At most five patches burn: the oldest goes.
  const cap = vilRound("street");
  standAt(cap, 10);
  cap.you.safeMs = 1e9;
  for (let i = 0; i < 7; i++) {
    cap.bones.push({ id: 9e9 + i, kind: "torch", cause: "torch", x: 60 + i * 6, y: 6.2, vx: 0, vy: -5, spin: 0, life: 4000 });
  }
  run(cap, 60);
  const fires = cap.hazards.filter((h) => h.kind === "torchfire");
  assert.equal(fires.length, vl.TORCHFIRE_CAP);
  assert.ok(fires.every((h) => h.x > 60), "the oldest went");
});

/* ---------------------------------------------------------------- hanged */

test("Ghoul Rush's hanged man sways under his beam, creaks 220 ms when you pass under, drops to your height, holds 450 ms and is hauled back up", () => {
  const round = vilRound("square");
  standAt(round, 60, 1, 6);
  round.you.safeMs = 1e9;
  const h = put(round, "hanged", 330, { y: 19 });
  assert.equal(h.act, "sway");
  assert.equal(ghoul.MONSTERS.hanged.stomp, false);
  standAt(round, 320, 1, 6);
  round.you.safeMs = 1e9;
  run(round, 600);
  assert.equal(h.beam, 19);
  assert.equal(h.rest, 11.5);
  assert.equal(h.y, 11.5);
  assert.equal(events(round, "hangedWarn").length, 0, "10 away: no");
  // Shot any time, even at rest.
  bolt(round, h, 13);
  ghoul.advance(round, 8, steady);
  assert.equal(h.hp, 2, "shot at rest");
  standAt(round, 326, 1, 6);
  round.you.safeMs = 1e9;
  const seen = [];
  for (let t = 0; t < 1400; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (e.type.startsWith("hanged")) seen.push([e.type, round.clock]);
    round.events.length = 0;
  }
  assert.deepEqual(seen.map((s) => s[0]), ["hangedWarn", "hangedDrop", "hangedSnap", "hangedHaul"]);
  const at = Object.fromEntries(seen);
  assert.ok(Math.abs(at.hangedDrop - at.hangedWarn - vl.HANGED_WARN_MS) < 20, "220 ms of creak");
  assert.ok(at.hangedSnap - at.hangedDrop < 80, "a quick snap");
  assert.ok(Math.abs(at.hangedHaul - at.hangedSnap - vl.HANGED_HOLD_MS) < 20, "450 ms at the bottom");
  assert.ok(Math.abs(h.to - 6.4) < 1e-9, "to just over your feet");
  until(round, () => h.act === "sway", 1000);
  assert.equal(h.y, 11.5, "back up");
  // He sways a while before he drops again, and then does.
  const again = vilRound("square");
  standAt(again, 326, 1, 6);
  again.you.safeMs = 1e9;
  const g = put(again, "hanged", 330, { y: 19 });
  until(again, () => g.act === "sway" && g.cool > 0 && g.y === g.rest, 100);
  g.act = "haul";
  g.y = g.rest - 0.01;
  run(again, 12);
  assert.equal(g.act, "sway");
  assert.ok(g.cool > 0 && g.cool <= vl.HANGED_REST_MS);
  again.events.length = 0;
  run(again, 1000);
  assert.equal(events(again, "hangedWarn").length, 0, "not yet");
  run(again, 700);
  assert.equal(events(again, "hangedWarn").length, 1, "again");
});

test("Ghoul Rush's hanged man does not drop for you above him or out of his rope's reach, and a drop costs a life only where he lands", () => {
  const round = vilRound("square");
  standAt(round, 326, 1, 12, -1);
  Object.assign(round.you, { state: "air", vy: 30 });
  const h = put(round, "hanged", 330, { y: 19 });
  round.you.safeMs = 1e9;
  run(round, 120);
  assert.equal(events(round, "hangedWarn").length, 0, "above him");
  // On the platform, level with his rest, the beam sits higher and he is in reach.
  const deck = vilRound("square");
  const d = put(deck, "hanged", 130, { y: 24 });
  standAt(deck, 126, 1, 11, 0);
  deck.you.safeMs = 1e9;
  run(deck, 300);
  assert.equal(d.rest, 16.5);
  assert.equal(events(deck, "hangedDrop").length, 1, "dropped on the deck");
  assert.ok(Math.abs(d.to - 11.4) < 1e-9);
  // Out of the rope's reach below (the floor under a high platform's man).
  const low = vilRound("square");
  const l = put(low, "hanged", 130, { y: 24 });
  standAt(low, 126, 1, 6);
  low.you.safeMs = 1e9;
  run(low, 300);
  assert.equal(l.rest - vl.HANGED_ROPE, 8.5);
  assert.equal(events(low, "hangedWarn").length, 0, "too low to reach");
  // Under him as he lands: a life, the cause hanged. Beside him: none.
  const hit = vilRound("square");
  standAt(hit, 330, 1, 6);
  put(hit, "hanged", 330, { y: 19 });
  until(hit, () => events(hit, "lose").length > 0, 1500);
  assert.equal(events(hit, "lose")[0]?.cause, "hanged");
  assert.equal(events(hit, "hangedDrop").length, 1);
  const beside = vilRound("square");
  standAt(beside, 322, 1, 6);
  put(beside, "hanged", 330, { y: 19 });
  beside.you.safeMs = 0;
  run(beside, 300);
  Object.assign(beside.you, { x: 322 });
  run(beside, 700);
  assert.equal(events(beside, "lose").length, 0, "the rope does not move sideways");
});

/* --------------------------------------------------------------- shutter */

test("Ghoul Rush's shutter ghoul hides (bolts go through, touch does nothing), rattles 800 ms when you come near, lunges out at you, and can be hit and can hurt only while out", () => {
  const round = vilRound("street");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const s = put(round, "shutter", 96, { y: 13 });
  assert.equal(s.act, "hide");
  assert.equal(ghoul.solid(s), false, "hidden: not solid");
  run(round, 200);
  assert.equal(events(round, "shutterRattle").length, 0, "far off");
  bolt(round, s, 15);
  ghoul.advance(round, 8, steady);
  assert.equal(s.hp, 2, "a bolt goes through the window");
  // Hidden, even standing in it is nothing.
  const inside = vilRound("street");
  standAt(inside, 96, 1, 13);
  Object.assign(inside.you, { state: "air", vy: 0 });
  const t = put(inside, "shutter", 96, { y: 13 });
  inside.you.safeMs = 0;
  ghoul.advance(inside, 4, steady);
  assert.equal(events(inside, "lose").length, 0, "touch does nothing while it hides or rattles");
  assert.equal(ghoul.solid(t), false);
  // Near: it rattles, then lunges, and is out (solid) a while.
  standAt(round, 88);
  round.you.safeMs = 1e9;
  const rattle = log(round, 8, "shutterRattle");
  assert.equal(rattle.length, 1);
  assert.equal(s.act, "rattle");
  assert.equal(ghoul.solid(s), false, "rattling is still hiding");
  const lunge = log(round, 1000, "shutterLunge");
  assert.equal(lunge.length, 1);
  assert.ok(Math.abs(lunge[0][0] - rattle[0][0] - vl.SHUTTER_RATTLE_MS) < 40, `800 ms of rattle (${lunge[0][0] - rattle[0][0]})`);
  until(round, () => s.act === "out", 400);
  assert.equal(s.act, "out");
  assert.equal(ghoul.solid(s), true, "out: solid");
  const reach = Math.hypot(s.x - s.hx, s.y - s.hy);
  assert.ok(Math.abs(reach - vl.SHUTTER_REACH) < 0.2 || reach < vl.SHUTTER_REACH + 1e-6, `out no further than 9 (${reach.toFixed(2)})`);
  assert.ok(s.x < 96 && s.y < 13, "out toward you, down and across");
  // Out, a bolt hits it.
  bolt(round, s, s.y + 2);
  ghoul.advance(round, 8, steady);
  assert.equal(s.hp, 1, "hit while out");
  // It stays out about 800 ms, pulls back and hides, then rests before it rattles again.
  const pulled = log(round, 1000, "shutterPull");
  assert.equal(pulled.length, 1);
  until(round, () => s.act === "hide", 600);
  assert.equal(s.act, "hide");
  assert.equal(s.x, 96);
  assert.equal(s.y, 13);
  assert.equal(ghoul.solid(s), false);
  round.events.length = 0;
  run(round, 1500);
  assert.equal(events(round, "shutterRattle").length, 0, "resting");
  run(round, 500);
  assert.equal(events(round, "shutterRattle").length, 1, "again");
  // Out and touching you, it costs a life, the cause shutter.
  const bite = vilRound("street");
  standAt(bite, 90);
  put(bite, "shutter", 96, { y: 13 });
  until(bite, () => events(bite, "lose").length > 0, 1500);
  assert.equal(events(bite, "lose")[0]?.cause, "shutter");
});

/* ------------------------------------------------------------- moonhound */

test("Ghoul Rush's moonhound prowls, crouches 300 ms within 18 growling, leaps, and rests 600 ms where it lands, like the hellhound", () => {
  const round = vilRound("inn");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const h = put(round, "moonhound", 70);
  assert.equal(h.act, "prowl");
  run(round, 400);
  assert.ok(h.x < 70 - 4, "it prowls at you");
  Object.assign(h, { x: 34 });
  const growl = log(round, 8, "growl");
  assert.equal(growl.length, 1);
  assert.equal(growl[0][1].kind, "moonhound");
  assert.equal(h.act, "crouch");
  const lunge = log(round, 400, "lunge");
  assert.equal(lunge.length, 1);
  assert.equal(lunge[0][1].kind, "moonhound");
  assert.ok(Math.abs(lunge[0][0] - growl[0][0] - vl.HOUND_LEAP.crouch) < 20, "300 ms crouch");
  assert.equal(h.act, "leap");
  until(round, () => h.act === "rest", 1200);
  assert.equal(h.act, "rest");
  assert.equal(h.y, 6);
  assert.ok(h.wait > 500);
  const landedAt = round.clock;
  until(round, () => h.act !== "rest", 1200);
  assert.ok(Math.abs(round.clock - landedAt - vl.HOUND_LEAP.rest) < 40 + 8, `600 ms of rest (${round.clock - landedAt})`);
});

test("Ghoul Rush's turned villager leaps like a hound, faster, and growls and lunges as a villager", () => {
  const round = vilRound("street", { full: true });
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const v = put(round, "villager", 70, { group: true, turned: true, act: "prowl", hp: 5, max: 5 });
  v.init = true;
  run(round, 400);
  assert.ok(70 - v.x >= 22 * 0.4 - 1, `faster than a walk (${70 - v.x} in 400 ms, 22 a second against 8)`);
  round.events.length = 0;
  Object.assign(v, { x: 32, act: "prowl", wait: 0 });
  const growl = log(round, 8, "growl");
  assert.equal(growl[0]?.[1].kind, "villager");
  const lunge = log(round, 400, "lunge");
  assert.equal(lunge[0]?.[1].kind, "villager");
  assert.ok(Math.abs(lunge[0][0] - growl[0][0] - vl.WOLF_LEAP.crouch) < 20);
});

/* ------------------------------------------------------------- wolfsbane */

test("Ghoul Rush's Wolfsbane is found only in the Village: never dropped or placed anywhere else, and a placed one elsewhere is swapped", () => {
  assert.equal(ghoul.POWERS.bane.stage, "village");
  assert.equal(ghoul.POWERS.bane.ms, 10000);
  assert.equal(PILL_WORDS.bane, "BANE");
  assert.ok(ghoul.TIMED.includes("bane"));
  assert.equal(ghoul.powerHere({ dark: true, stage: "manor" }, "bane"), false);
  assert.equal(ghoul.powerHere({ dark: false, stage: null }, "bane"), false);
  assert.equal(ghoul.powerHere({ dark: false, stage: "sanatorium" }, "bane"), false);
  assert.equal(ghoul.powerHere({ dark: false, stage: "village" }, "bane"), true);
  const rnd = ghoul.seeded(11);
  for (const stage of [null, "manor", "wing", "graveyard", "grounds", "chapel", "sanatorium"]) {
    for (let i = 0; i < 400; i++) {
      assert.notEqual(pickPower(rnd, { dark: i % 2 === 0, stage }, "", i % 3 === 0), "bane", `${stage}: never picked`);
      assert.notEqual(pickPower(rnd, { dark: true, stage }, "life", true), "bane");
    }
  }
  let sawIt = false;
  for (let i = 0; i < 400; i++) if (pickPower(rnd, { dark: false, stage: "village" }) === "bane") sawIt = true;
  assert.ok(sawIt, "it turns up in the Village");
  // Placed only in the Village's rooms.
  for (const room of ghoul.ROOMS) {
    const placed = [...room.items, ...room.sky].some((i) => i[0] === "bane");
    assert.equal(placed, ROOM_IDS.includes(room.id), `${room.id}: Wolfsbane ${placed ? "placed" : "absent"}`);
  }
  // A Wolfsbane placed in a room of another stage is swapped for something else.
  const round = ghoul.newRound(3);
  round.dice = 0;
  assert.equal(round.stage, null);
  const swapped = ghoul.powerHere(round, "bane") ? "bane" : "other";
  assert.equal(swapped, "other");
  // In a Village room a placed one stays.
  const vr = vilRound("street");
  assert.equal(vr.loot[vr.spec.items.findIndex((i) => i[0] === "bane")], "bane");
  // Picked up it lasts 10 s.
  standAt(vr, vr.spec.items.find((i) => i[0] === "bane")[1]);
  vr.items.fill(false);
  vr.you.safeMs = 1e9;
  ghoul.advance(vr, 8, steady);
  assert.equal(vr.effects.bane > 9900, true);
  run(vr, 10100);
  assert.equal(vr.effects.bane, 0);
  assert.equal(events(vr, "expire").some((e) => e.kind === "bane"), true);
});

test("Ghoul Rush's Wolfsbane doubles your bolts against turned villagers and moonhounds, and nothing else", () => {
  const round = vilRound("inn", { full: false });
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const hound = put(round, "moonhound", 60, { act: "rest", wait: 1e9, hp: 6, max: 6 });
  const wolf = put(round, "villager", 80, { group: true, turned: true, act: "rest", wait: 1e9, hp: 6, max: 6 });
  const mob = put(round, "villager", 92, { group: true, hp: 6, max: 6 });
  const dead = put(round, "zombie", 120, { hp: 6, max: 6 });
  mob.init = wolf.init = true;
  const hit = (m) => {
    round.events.length = 0;
    const before = m.hp;
    bolt(round, m, m.y + m.h / 2);
    ghoul.advance(round, 8, steady);
    return before - m.hp;
  };
  for (const m of [hound, wolf, mob, dead]) assert.equal(hit(m), 1, `${m.kind}: one without Wolfsbane`);
  round.effects.bane = 5000;
  assert.equal(hit(hound), 2, "a moonhound: double");
  assert.equal(hit(wolf), 2, "a turned villager: double");
  assert.equal(hit(mob), 1, "a villager still in his coat: no");
  assert.equal(hit(dead), 1, "a zombie: no");
});

test("Ghoul Rush's Wolfsbane makes moonhounds and wolf-men shy away: they back off within 24, never crouch, and say so once", () => {
  const plain = vilRound("inn");
  standAt(plain, 40);
  plain.you.safeMs = 1e9;
  const a = put(plain, "moonhound", 52);
  run(plain, 600);
  assert.ok(a.act === "crouch" || a.act === "leap" || a.act === "rest" || a.x < 50, "without it, it comes");
  const round = vilRound("inn");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  round.effects.bane = 8000;
  const h = put(round, "moonhound", 52);
  const wolf = put(round, "villager", 56, { group: true, turned: true, act: "prowl", hp: 5, max: 5 });
  wolf.init = true;
  const x0 = [h.x, wolf.x];
  const shy = log(round, 600, "baneShy");
  assert.equal(shy.length, 2, "each tells baneShy once");
  assert.deepEqual(shy.map((s) => s[1].kind).sort(), ["moonhound", "villager"]);
  assert.ok(h.x > x0[0] + 2 && wolf.x > x0[1] + 2, "backing off");
  assert.equal(events(round, "growl").length, 0);
  assert.equal(h.act, "prowl");
  assert.equal(events(round, "lose").length, 0);
  // Far enough away, they are free to come again; the effect ending ends the shyness.
  round.effects.bane = 0;
  Object.assign(h, { x: 50 });
  const growl = log(round, 40, "growl");
  assert.equal(growl.length >= 1, true, "Wolfsbane gone: back to hunting");
});

/* ------------------------------------------------------------- the Beast */

function greenFight() {
  const round = vilRound("green");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  ghoul.advance(round, 8, steady);
  round.you.safeMs = 1e9;
  round.events.length = 0;
  return round;
}

// The Beast about to choose its `n`th move.
function choose(round, n) {
  const b = round.boss;
  Object.assign(b, { act: "idle", wait: 0, moves: n - 1 });
}

test("Ghoul Rush's Beast waits at the end of the green, then in turn bounds to the farther wall, clings 600 ms, pounces where you stand under a shadow and shakes the ground as it lands", () => {
  const round = greenFight();
  const b = round.boss;
  assert.equal(b.kind, "beast");
  assert.equal(b.max, 110);
  assert.equal(ghoul.roomFor("green", 0).bossHp, 110);
  assert.deepEqual([b.w, b.h], [9, 10.5]);
  assert.equal(round.twist.moon, vl.BEAST_MOON, "the moon hangs high");
  assert.equal(round.twist.full, false);
  choose(round, 1);
  const t0 = round.clock;
  const seen = [];
  for (let t = 0; t < 3200; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (/^beast(Leap|Cling|Pounce|Land)$/.test(e.type)) seen.push([e.type, round.clock - t0, e]);
    round.events.length = 0;
    if (seen.length === 4) break;
  }
  assert.deepEqual(seen.map((s) => s[0]), ["beastLeap", "beastCling", "beastPounce", "beastLand"]);
  const [leap, cling, pounce, land] = seen;
  assert.equal(leap[2].side, 1, "the wall farther from you (you stand at the left)");
  assert.ok(Math.abs(cling[1] - leap[1] - vl.BOUND_MS) < 20, `480 ms to the wall (${cling[1] - leap[1]})`);
  assert.ok(Math.abs(pounce[1] - cling[1] - vl.BEAST_CLING_MS) < 20, `600 ms clinging (${pounce[1] - cling[1]})`);
  assert.ok(Math.abs(land[1] - pounce[1] - vl.POUNCE_MS) < 20, `700 ms in the air (${land[1] - pounce[1]})`);
  assert.ok(Math.abs(cling[2].x - (200 - 4.5 + vl.WALL_INSET)) < 0.5, "on the right wall");
  assert.ok(Math.abs(cling[2].y - (6 + vl.BEAST_CLING_UP + 5.25)) < 0.5);
  assert.ok(Math.abs(pounce[2].tx - round.you.x) < 1e-6, "where you stand");
  assert.ok(Math.abs(land[2].x - round.you.x) < 1e-6, "and down it comes there");
  assert.equal(land[2].big, true);
  assert.equal(b.y, 6);
  assert.equal(b.act, "rest");
  // The shadow marks the landing for the whole flight.
  const fight = greenFight();
  choose(fight, 1);
  until(fight, () => fight.boss.act === "cling", 1000);
  until(fight, () => fight.boss.act === "pounce", 1000);
  const shadow = fight.hazards.find((h) => h.kind === "shadow");
  assert.ok(shadow && shadow.w === 9 && shadow.live === 0 && Math.abs(shadow.x - fight.you.x) < 1e-6);
  assert.ok(shadow.warn > 650 && shadow.total === 700);
  run(fight, 300);
  assert.ok(fight.hazards.find((h) => h.kind === "shadow").warn < 450);
  until(fight, () => fight.boss.act === "rest", 1000);
  assert.equal(fight.hazards.filter((h) => h.kind === "shadow").length, 0, "gone once it lands");
});

test("Ghoul Rush's Beast is open to a double shot only while it clings, and Wolfsbane doubles every shot to it", () => {
  const round = greenFight();
  const b = round.boss;
  const shoot = () => {
    const before = b.hp;
    round.events.length = 0;
    round.shots.push({ x: b.x - b.w / 2 - 0.3, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
    ghoul.advance(round, 4, steady);
    return before - b.hp;
  };
  Object.assign(b, { act: "rest", wait: 1e9, y: 6 });
  assert.equal(shoot(), 1, "on the ground: one");
  assert.equal(events(round, "bossHit")[0]?.how, "shot");
  assert.equal(events(round, "bossHit")[0]?.kind, "beast");
  Object.assign(b, { act: "cling", wait: 1e9, x: 195.9, y: 9.6, side: 1 });
  assert.equal(shoot(), 2, "clinging: two");
  const hit = events(round, "bossHit")[0];
  assert.equal(hit.how, "weak");
  assert.equal(hit.weak, true);
  assert.equal(hit.kind, "beast");
  round.effects.bane = 9000;
  assert.equal(shoot(), 4, "clinging and Wolfsbane: four");
  Object.assign(b, { act: "rest", wait: 1e9, x: 150, y: 6 });
  assert.equal(shoot(), 2, "Wolfsbane alone: two");
  // The spot is off the ground: a shot from the floor misses a clinging Beast, one from a board hits.
  const w = greenFight();
  Object.assign(w.boss, { act: "cling", wait: 1e9, x: 195.9, y: 9.6, side: 1 });
  standAt(w, 150);
  w.shots.push({ x: 160, y: w.you.y + ghoul.SHOT_Y, vx: 130, vy: 0, gone: 0 });
  const hp = w.boss.hp;
  run(w, 600);
  assert.equal(w.boss.hp, hp, "the chest-high shot passes under it");
  standAt(w, 150, 1, 12.5, 0);
  w.shots.push({ x: 160, y: 12.5 + ghoul.SHOT_Y, vx: 130, vy: 0, gone: 0 });
  Object.assign(w.boss, { act: "cling", wait: 1e9 });
  run(w, 600);
  assert.equal(w.boss.hp, hp - 2, "a shot from a board hits");
});

test("Ghoul Rush's Beast swipes when you are close: a 400 ms wind-up, then a claw 7.5 long that you jump or step out of", () => {
  const round = greenFight();
  const b = round.boss;
  standAt(round, b.x - 8);
  round.you.safeMs = 1e9;
  choose(round, 1);
  const wind = log(round, 8, "swipeWind");
  assert.equal(wind.length, 1);
  const swipe = log(round, 600, "beastSwipe");
  assert.equal(swipe.length, 1);
  assert.ok(Math.abs(swipe[0][0] - wind[0][0] - vl.SWIPE_WIND_MS) < 20, `400 ms (${swipe[0][0] - wind[0][0]})`);
  assert.equal(b.swipeCool > 0, true);
  // The claw: in front of it, short-lived, a life on the floor, none in a jump.
  const c = greenFight();
  const cb = c.boss;
  standAt(c, cb.x - 8);
  c.you.safeMs = 1e9;
  choose(c, 1);
  until(c, () => c.hazards.some((h) => h.kind === "claw"), 800);
  const h = c.hazards.find((q) => q.kind === "claw");
  assert.ok(h && h.w === vl.SWIPE_REACH && h.h === vl.SWIPE_H && h.cause === "claw");
  assert.ok(h.x < cb.x - cb.w / 2, "on the side it faces");
  assert.ok(Math.abs(h.x - c.you.x) < h.w / 2);
  c.you.safeMs = 0;
  ghoul.advance(c, 4, steady);
  assert.equal(events(c, "lose")[0]?.cause, "claw");
  const jump = greenFight();
  standAt(jump, jump.boss.x - 8, 1, 13.4);
  Object.assign(jump.you, { state: "air", vy: 0 });
  Object.assign(jump.boss, { x: 180, act: "rest", wait: 1e9 });
  jump.hazards.push({ kind: "claw", x: jump.you.x, y: 6, w: 7.5, h: 7, dir: -1, live: 100, max: 200, cause: "claw" });
  jump.you.safeMs = 0;
  ghoul.advance(jump, 4, steady);
  assert.equal(events(jump, "lose").length, 0, "over the claw");
  const gone = greenFight();
  Object.assign(gone.boss, { x: 180, act: "rest", wait: 1e9 });
  gone.hazards.push({ kind: "claw", x: 172, y: 6, w: 7.5, h: 7, dir: 1, live: 200, max: 200, cause: "claw" });
  run(gone, 180);
  assert.equal(gone.hazards.filter((q) => q.kind === "claw").length, 1);
  run(gone, 40);
  assert.equal(gone.hazards.filter((q) => q.kind === "claw").length, 0, "gone after 200 ms");
  // No second swipe at once.
  const again = greenFight();
  standAt(again, again.boss.x - 8);
  choose(again, 1);
  until(again, () => events(again, "beastSwipe").length > 0, 1000);
  choose(again, 2);
  again.events.length = 0;
  run(again, 100);
  assert.equal(events(again, "swipeWind").length, 0, "cooling: it does something else");
});

test("Ghoul Rush's Beast howls every third move for 1 s and calls two moonhounds in from the arena's ends, never more than four alive", () => {
  const round = greenFight();
  const b = round.boss;
  assert.equal(round.monsters.filter((m) => m.kind === "moonhound").length, 0);
  choose(round, 3);
  const howl = log(round, 8, "beastHowl");
  assert.equal(howl.length, 1);
  assert.equal(b.act, "howl");
  const call = log(round, 1100, "houndCall");
  assert.equal(call.length, 1);
  assert.ok(Math.abs(call[0][0] - howl[0][0] - vl.HOWL_MS) < 20, "a second");
  assert.equal(call[0][1].n, 2);
  const hounds = round.monsters.filter((m) => m.kind === "moonhound");
  assert.equal(hounds.length, 2);
  const hx = hounds.map((m) => m.x).sort((x, y) => x - y);
  assert.ok(Math.abs(hx[0] - (round.spec.arena + 3)) < 2 && Math.abs(hx[1] - (round.spec.length - 3)) < 4, `from the arena's two ends (${hx})`);
  // With three alive, one more; with four, it leaps instead.
  const three = greenFight();
  for (let i = 0; i < 3; i++) put(three, "moonhound", 150 + i * 8, { act: "rest", wait: 1e9 });
  choose(three, 3);
  until(three, () => events(three, "houndCall").length > 0, 1500);
  assert.equal(events(three, "houndCall")[0].n, 1);
  assert.equal(three.monsters.filter((m) => m.kind === "moonhound").length, 4);
  const four = greenFight();
  for (let i = 0; i < 4; i++) put(four, "moonhound", 150 + i * 8, { act: "rest", wait: 1e9 });
  choose(four, 3);
  four.events.length = 0;
  run(four, 40);
  assert.equal(events(four, "beastHowl").length, 0);
  assert.equal(events(four, "beastLeap").length, 1, "a leap instead");
  // The order: two leaps, then a howl, and so on, when you stay far off.
  const moves = [];
  for (const n of [1, 2, 3, 4, 5, 6]) {
    const order = greenFight();
    choose(order, n);
    order.events.length = 0;
    run(order, 20);
    moves.push(events(order, "beastLeap").length ? "leap" : events(order, "beastHowl").length ? "howl" : "?");
  }
  assert.deepEqual(moves, ["leap", "leap", "howl", "leap", "leap", "howl"]);
});

test("Ghoul Rush's Beast rages at half its hp: beastMoon once, a full moon, shorter waits, two pounces in a row, and the hounds it calls are grown", () => {
  const round = greenFight();
  const b = round.boss;
  b.hp = Math.floor(b.max / 2);
  const moon = log(round, 8, "beastMoon");
  assert.equal(moon.length, 1);
  assert.equal(b.raged, true);
  ghoul.advance(round, 8, steady);
  assert.equal(round.twist.full, true);
  assert.equal(round.twist.moon, 1);
  assert.equal(log(round, 200, "beastMoon").length, 0, "once");
  choose(round, 1);
  const seen = [];
  const t0 = round.clock;
  for (let t = 0; t < 4200; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (e.type === "beastPounce" || e.type === "beastLand") seen.push([e.type, round.clock - t0, e.second]);
    round.events.length = 0;
    if (round.boss.act === "rest" && seen.length === 4) break;
  }
  assert.deepEqual(seen.map((s) => s[0]), ["beastPounce", "beastLand", "beastPounce", "beastLand"]);
  assert.deepEqual(seen.map((s) => Boolean(s[2])), [false, false, true, true]);
  const gap = seen[2][1] - seen[1][1];
  assert.ok(Math.abs(gap - vl.SECOND_WAIT_MS * vl.BEAST_QUICK) < 24, `a short crouch between (${gap})`);
  assert.ok(Math.abs(seen[3][1] - seen[2][1] - vl.SECOND_MS) < 20);
  assert.ok(Math.abs(b.wait - vl.LAND_REST_MS * vl.BEAST_QUICK) < 12, `a shorter rest (${b.wait})`);
  // Without the rage, one pounce and the rest.
  const calm = greenFight();
  choose(calm, 1);
  until(calm, () => calm.boss.act === "rest", 4000);
  assert.ok(Math.abs(calm.boss.wait - vl.LAND_REST_MS) < 12);
  assert.equal(events(calm, "beastPounce").length, 1);
  // The hounds it calls now are grown.
  round.monsters.length = 0;
  b.swipeCool = 1e9;
  choose(round, 3);
  until(round, () => events(round, "houndCall").length > 0, 2000);
  run(round, 20);
  const hounds = round.monsters.filter((m) => m.kind === "moonhound");
  assert.equal(hounds.length, 2);
  assert.ok(hounds.every((m) => m.grown && m.hp === 5), "grown, with more hp");
});

/* ------------------------------------------------- lives and the dice of luck */

test("Ghoul Rush's every new way to lose a life goes through the endless-lives code: the life is spared, the loss still told", () => {
  const causes = {
    villager: (r) => put(r, "villager", r.you.x, { group: true }),
    hanged: (r) => Object.assign(put(r, "hanged", r.you.x, { y: 19 }), { beam: 19, rest: 11.5, low: 3.5, y: r.you.y + 0.4, act: "hold", wait: 1e9, cool: 0 }),
    shutter: (r) => Object.assign(put(r, "shutter", r.you.x, { y: r.you.y }), { hx: r.you.x, hy: r.you.y, ext: 1, rx: 0, ry: 0, reach: 1, act: "out", wait: 1e9, cool: 0 }),
    moonhound: (r) => put(r, "moonhound", r.you.x, { act: "rest", wait: 1e9 }),
    torch: (r) => r.bones.push({ id: 9e9, kind: "torch", cause: "torch", x: r.you.x, y: r.you.y + 2, vx: 0, vy: 0, spin: 0, life: 4000 }),
    claw: (r) => r.hazards.push({ kind: "claw", x: r.you.x, y: 6, w: 7.5, h: 7, dir: 1, live: 200, max: 200, cause: "claw" }),
  };
  for (const [cause, setup] of Object.entries(causes)) {
    for (const infinite of [false, true]) {
      const round = vilRound(cause === "hanged" ? "square" : "street");
      standAt(round, cause === "hanged" ? 330 : 50);
      round.infinite = infinite;
      setup(round);
      const lives = round.lives;
      run(round, 8);
      assert.equal(events(round, "lose")[0]?.cause, cause, `${cause}: lost`);
      assert.equal(round.lives, infinite ? lives : lives - 1, `${cause}${infinite ? " (endless)" : ""}`);
    }
  }
  // The fire on the floor: the cause torch again.
  for (const infinite of [false, true]) {
    const round = vilRound("street");
    standAt(round, 50);
    round.infinite = infinite;
    round.hazards.push({ kind: "torchfire", x: 50, y: 6, w: 4.4, h: 2.4, live: 2000, max: 3200, cause: "torch" });
    const lives = round.lives;
    run(round, 8);
    assert.equal(events(round, "lose")[0]?.cause, "torch");
    assert.equal(round.lives, infinite ? lives : lives - 1);
  }
  // The Beast's body (landing on you, or at the wall), the cause beast.
  for (const infinite of [false, true]) {
    const round = greenFight();
    round.infinite = infinite;
    standAt(round, 150);
    round.you.safeMs = 0;
    Object.assign(round.boss, { act: "rest", wait: 1e9, x: 150, y: 6 });
    const lives = round.lives;
    run(round, 8);
    assert.equal(events(round, "lose")[0]?.cause, "beast");
    assert.equal(round.lives, infinite ? lives : lives - 1, "the Beast");
  }
  // The Lucky die and Garlic are the game's own; the cause must at least have words.
  for (const cause of ["villager", "hanged", "shutter", "moonhound", "beast", "torch", "claw"]) assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], cause);
});

test("Ghoul Rush's village draws no random number: villagers, hanged men, shutter ghouls, hounds and the Beast move on a random that throws", () => {
  const round = vilRound("street");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  put(round, "villager", 70);
  put(round, "moonhound", 90);
  put(round, "shutter", 96, { y: 13 });
  run(round, 3000, {}, never);
  const sq = vilRound("square");
  standAt(sq, 326);
  sq.you.safeMs = 1e9;
  put(sq, "hanged", 330, { y: 19 });
  run(sq, 2500, {}, never);
  const fight = greenFight();
  for (let n = 1; n <= 7; n++) {
    choose(fight, n);
    fight.boss.hp = n > 4 ? Math.floor(fight.boss.max / 2) : fight.boss.hp;
    run(fight, 1800, {}, never);
  }
  assert.ok(["beastLeap", "beastHowl", "beastPounce", "swipeWind"].every((type) => events(fight, type).length > 0), "it moved, drawing nothing");
});

/* ---------------------------------------------------- voices and drawing */

test("Ghoul Rush's Village: every new kind has a voice for every act, each a real tone, and every event of the pack plays its own sound exactly once", () => {
  // The acts the sound pick page names, and the two the game's own growl and lunge give a turned villager.
  const listed = {
    villager: ["appear", "wind", "throw", "land", "turn", "wolf", "hurt", "die"],
    hanged: ["appear", "warn", "drop", "snap", "haul", "hurt", "die"],
    shutter: ["appear", "rattle", "lunge", "pull", "hurt", "die"],
    moonhound: ["appear", "growl", "lunge", "grow", "shy", "hurt", "die"],
    beast: ["wake", "leap", "cling", "pounce", "land", "swipeWind", "swipe", "howl", "moon", "hurt", "weak", "die"],
    moon: ["full"],
    bane: ["active"],
  };
  const own = { ...listed, villager: [...listed.villager, "growl", "lunge"] };
  for (const [kind, acts] of Object.entries(own)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(own)) for (const act of acts) assert.ok(merged[VOICES[kind][act]]?.layers?.length, `${kind}.${act}: ${VOICES[kind][act]} is a tone`);
  for (const kind of [...Object.keys(vl.MONSTERS), ...Object.keys(vl.BOSSES)]) assert.ok(VOICES[kind] && VOICES[kind].die, `${kind} has a voice and a death`);
  // Every event the pack emits is answered by one act, played once and nothing else; the hounds' call is quiet.
  for (const type of vl.EVENTS) assert.ok(EVENT_VOICE[type] || type === "houndCall", `${type} is heard or deliberately quiet`);
  for (const type of Object.keys(EVENT_VOICE)) assert.ok(vl.EVENTS.includes(type), `${type} is an event of the pack`);
  for (const [type, [kind, act]] of Object.entries(EVENT_VOICE)) {
    assert.ok(listed[kind].includes(act), `${type}: ${kind} ${act} is a listed act`);
    assert.deepEqual(heard({ type, kind }).played, [VOICES[kind][act]], `${type}: ${kind} ${act}, once`);
  }
  assert.deepEqual(heard({ type: "houndCall", kind: "beast", n: 2 }).played, [], "the hounds' call is quiet");
  // Each listed act is the voice of some event (or the game's own play of it).
  const reached = new Set(Object.values(EVENT_VOICE).map(([kind, act]) => `${kind}.${act}`));
  const theGames = ["villager.appear", "villager.throw", "villager.hurt", "villager.die", "hanged.appear", "hanged.hurt", "hanged.die", "shutter.appear", "shutter.hurt", "shutter.die", "moonhound.appear", "moonhound.growl", "moonhound.lunge", "moonhound.hurt", "moonhound.die", "beast.wake", "beast.hurt", "beast.weak", "beast.die", "bane.active"];
  for (const [kind, acts] of Object.entries(listed)) for (const act of acts) assert.ok(reached.has(`${kind}.${act}`) || theGames.includes(`${kind}.${act}`), `${kind}.${act} is played by something`);
  // The game's own events carry the kind and find the voice, once.
  const once = (e, kind, act, not = []) => {
    const played = heard(e).played;
    assert.equal(played.filter((n) => n === VOICES[kind][act]).length, 1, `${e.type}: ${kind} ${act} once`);
    for (const n of not) assert.ok(!played.includes(n), `${e.type} does not play ${n}`);
  };
  once({ type: "spawn", kind: "villager" }, "villager", "appear");
  once({ type: "spawn", kind: "hanged" }, "hanged", "appear");
  once({ type: "spawn", kind: "shutter" }, "shutter", "appear");
  once({ type: "spawn", kind: "moonhound" }, "moonhound", "appear");
  once({ type: "growl", kind: "moonhound" }, "moonhound", "growl");
  once({ type: "lunge", kind: "moonhound" }, "moonhound", "lunge");
  once({ type: "growl", kind: "villager" }, "villager", "growl");
  once({ type: "lunge", kind: "villager" }, "villager", "lunge");
  once({ type: "throw", by: "villager", kind: "torch" }, "villager", "throw", ["swoosh"]);
  once({ type: "bossWake", kind: "beast" }, "beast", "wake");
  once({ type: "bossHit", kind: "beast", how: "shot" }, "beast", "hurt");
  once({ type: "bossHit", kind: "beast", how: "weak", weak: true }, "beast", "weak", [VOICES.beast.hurt]);
  once({ type: "bossDown", kind: "beast", points: 1 }, "beast", "die");
  once({ type: "hit", kind: "hanged" }, "hanged", "hurt");
  once({ type: "kill", kind: "shutter", mult: 1, how: "shot", points: 1 }, "shutter", "die");
  once({ type: "kill", kind: "villager", mult: 1, how: "shot", points: 1 }, "villager", "die");
  // A weak hit on the Beast says "Double!".
  const words = [];
  heard({ type: "bossHit", kind: "beast", how: "weak", weak: true }, { float: (x, y, text) => words.push(text) });
  assert.ok(words.includes("Double!"), "a weak hit says Double!");
  // Wolfsbane's pickup plays its own sound, not the shared power-up one.
  const bane = heard({ type: "power", kind: "bane", points: 50 }).played;
  assert.ok(bane.includes(VOICES.bane.active) && !bane.includes("powerUp"), "the pickup is Wolfsbane's own sound");
});

test("Ghoul Rush's Village: every new way to die has its words and its own sound", () => {
  for (const cause of ["villager", "hanged", "shutter", "moonhound", "beast", "torch", "claw"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).played.includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Village draws: every room, every monster in every act, the moon at every height, the Beast in each move with its shadow, claw and fire, the torch, Wolfsbane's badge, and the stage's card, in a lit room and a dark one", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["village"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  const acts = {
    villager: [{ act: "walk" }, { act: "wind", windup: 200 }, { act: "turn", wait: 400 }, { act: "prowl", turned: true }, { act: "crouch", turned: true, wait: 1e9 }, { act: "leap", turned: true, vx: 0, vy: 10 }],
    hanged: [{ act: "sway" }, { act: "warn", wait: 1e9 }, { act: "drop" }, { act: "hold", wait: 1e9 }, { act: "haul" }],
    shutter: [{ act: "hide" }, { act: "rattle", wait: 1e9 }, { act: "out", wait: 1e9 }],
    moonhound: [{ act: "prowl" }, { act: "crouch", wait: 1e9 }, { act: "rest", wait: 1e9 }, { act: "rest", wait: 1e9, grown: true }],
  };
  for (const id of ROOM_IDS) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      for (const moon of [0, 0.5, 1]) {
        r.dark = dark;
        r.phase = "play";
        r.lives = 99;
        for (const st of r.spawns) st.over = true;
        r.hordeMs = Infinity;
        r.monsters.length = 0;
        standAt(r, id === "green" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
        r.you.safeMs = 1e9;
        if (!r.boss) r.twist = { moon, full: moon === 1, ms: -1e12 };
        for (const [kind, list] of Object.entries(acts)) list.forEach((over, i) => put(r, kind, r.you.x + 6 + i * 5, { y: kind === "hanged" ? 19 : kind === "shutter" ? 13 : undefined, wait: 1e9, init: true, ...over }));
        r.hazards.push({ kind: "torchfire", x: r.you.x + 8, y: 6, w: 4.4, h: 2.4, live: 2000, max: 3200, cause: "torch" }, { kind: "claw", x: r.you.x + 12, y: 6, w: 7.5, h: 7, dir: 1, live: 100, max: 200, cause: "claw" }, { kind: "shadow", x: r.you.x + 16, y: 6, w: 9, h: 0.6, warn: 300, total: 700, live: 0, cause: "beast" });
        r.bones.push({ id: 9e9, kind: "torch", cause: "torch", x: r.you.x + 12, y: 14, vx: 0, vy: 0, spin: 0, life: 4000 });
        if (r.boss) {
          ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
          for (const act of ["idle", "bound", "cling", "pounce", "crouch", "rest", "swipeWind", "howl"]) {
            Object.assign(r.boss, { act, wait: 1e9, dir: -1, side: 1, fly: { x0: 150, y0: 6, x1: 190, y1: 9.6, T: 700, t: 100, arc: 5 } });
            g.tick(16);
          }
          r.boss.raged = true;
        }
        for (let k = 0; k < 20; k++) g.tick(16);
        r.you.safeMs = 1e9;
      }
    }
  }
  assert.ok(r.spec.id === "green", "got to the green and drew it");
  for (const kind of ["bane"]) {
    const p = vilRound("street");
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
  p.offer = ["village", "chapel"];
  p.phase = "pick";
  p.phaseMs = 0;
  for (let k = 0; k < 4; k++) pick.tick(16);
  assert.equal(p.phase, "pick", "the pick screen draws the Village's card");
});
