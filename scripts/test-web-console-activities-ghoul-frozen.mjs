// Web console tests, Ghoul Rush's Frozen Lake stage: its rooms (Ice Fishing Huts, Snowbound Lodge, The Black Ice, the Widow's Web), slippery ice and thin ice that cracks and breaks, under-ice hands, snow shades you only see by their footprints, frozen ghouls that slide and shatter, ice wraiths whose dive leaves you frozen, Hot Cocoa and the Road Flare (found only here), and the Frost Widow, whose veil melts only to a burning barrel or a flare.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import * as fz from "../src/web-console/public/activities/ghoul-frozen.js";
import * as fl from "../src/web-console/public/activities/ghoul-flare.js";
import * as arm from "../src/web-console/public/activities/ghoul-arms.js";
import { PILL_WORDS, STAGE_ARMS, armDrop, pickPower } from "../src/web-console/public/activities/ghoul-powers.js";
import { BONES } from "../src/web-console/public/activities/ghoul-bones.js";
import { GRAVEYARD } from "../src/web-console/public/activities/ghoul-graveyard.js";
import { GROUNDS } from "../src/web-console/public/activities/ghoul-grounds.js";
import { CHAPEL } from "../src/web-console/public/activities/ghoul-chapel.js";
import { SANATORIUM } from "../src/web-console/public/activities/ghoul-sanatorium.js";
import { VILLAGE } from "../src/web-console/public/activities/ghoul-village.js";
import { MINE } from "../src/web-console/public/activities/ghoul-mine.js";
import { CART } from "../src/web-console/public/activities/ghoul-cart.js";
import { CARNIVAL } from "../src/web-console/public/activities/ghoul-carnival.js";
import { LOOKS, VOICES, react } from "../src/web-console/public/activities/ghoul-draw.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, SILENT } from "../src/web-console/public/activities/ghoul-frozen-draw.js";
import { FROZEN_SFX } from "../src/web-console/public/activities/ghoul-sfx-frozen.js";
import { SLED_SFX } from "../src/web-console/public/activities/ghoul-sfx-sled.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";

const steady = () => 0.5;
// The pack draws no random number: a run on this fails on the first draw.
const never = () => {
  throw new Error("the frozen lake drew a random number");
};
const events = (round, type) => round.events.filter((e) => e.type === type);
// Fire tapped twice, as the keys do it.
const tapTap = (round) => {
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
};
// The four rooms that are walked, and the stage's five with the bonus sled ride between the Black Ice and the Widow's Web (its own suite: ghoul-sled).
const ROOM_IDS = ["huts", "lodge", "blackice", "widow"];
const STAGE_ROOMS = ["huts", "lodge", "blackice", "sled", "widow"];

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Frozen Lake's room `id` at `depth` stages cleared, reached the way play reaches it, nothing woken: every spawner spent, the horde held back.
function frozenRound(id, depth = 0) {
  const round = ghoul.newRound(5);
  round.lives = 3;
  round.dice = 0;
  through(round);
  for (let i = 0; i < depth; i++) round.cleared.push(`stage${i}`);
  round.offer = ["frozen"];
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
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, out: 0, safeMs: 0, face, ducking: false, slide: 0, glide: false, onIce: false, heldMs: 0 });
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

// The Widow's Web with her awake (the fight on), Planny in the arena.
function widowFight({ x, depth = 0 } = {}) {
  const round = frozenRound("widow", depth);
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

const tile = (round, i = 0) => round.thin.tiles[i];

/* ------------------------------------------------------------ the stage */

test("Ghoul Rush's Frozen Lake is a stage of three rooms and the Widow's Web, its monsters and boss joined to the game's, with a place for each kind, ice and thin ice in the rooms, last in the list", () => {
  const st = ghoul.stageById("frozen");
  assert.deepEqual(st.rooms, STAGE_ROOMS);
  assert.deepEqual(fz.FROZEN_ROOMS, STAGE_ROOMS);
  assert.equal(st.boss, "frostwidow");
  assert.equal(st.title, "The Frozen Lake");
  assert.equal(st.sub, "The ice remembers who fell through");
  assert.equal(ghoul.STAGES.at(-1), st, "the last stage in the list");
  for (const kind of Object.keys(fz.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], fz.MONSTERS[kind], `${kind} is a monster`);
  assert.deepEqual(Object.keys(fz.MONSTERS).sort(), ["frozen", "hand", "icewraith", "shade"]);
  assert.equal(ghoul.BOSSES.frostwidow, fz.BOSSES.frostwidow);
  assert.equal(fz.BOSSES.frostwidow.sub, "Melt her veil, then her heart");
  assert.deepEqual([ghoul.BOSSES.frostwidow.w, ghoul.BOSSES.frostwidow.h, ghoul.BOSSES.frostwidow.hp, ghoul.BOSSES.frostwidow.points], [10, 15, 90, 3000]);
  assert.ok(ghoul.MONSTERS.hand.hp === 2 && ghoul.MONSTERS.shade.hp === 3 && ghoul.MONSTERS.frozen.hp === 4 && ghoul.MONSTERS.icewraith.hp === 2);
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const picks = { huts: "ghoulHuts", lodge: "ghoulLodge", blackice: "ghoulBlackIce", sled: "ghoulSledRide", widow: "ghoulWidow" };
  const stageMusic = Object.assign({}, FROZEN_SFX.music, SLED_SFX.music);
  for (const [id, tone] of Object.entries(picks)) {
    assert.equal(ghoul.ROOM_MUSIC[id], tone, `${id} plays its own track`);
    assert.ok(stageMusic[tone] && stageMusic[tone].voices, `${tone} is a track in the stage's own sfx module`);
    assert.ok(ghoulSfx.default.music[tone], `${tone} is merged into the game's music`);
  }
  assert.equal(new Set(Object.values(picks)).size, 5, "five different tracks");
  const [huts, lodge, blackice, widow] = ROOM_IDS.map((id) => ghoul.roomById(id));
  assert.deepEqual([huts.title, lodge.title, blackice.title, widow.title], ["Ice Fishing Huts", "Snowbound Lodge", "The Black Ice", "The Widow's Web"]);
  assert.deepEqual([huts.sub, lodge.sub, blackice.sub, widow.sub], ["The lines are all pulled taut", "The fire went out a long time ago", "Faces under the surface follow you", "Melt her veil, then her heart"]);
  const returning = ["zombie", "bat", "skel"];
  for (const room of [huts, lodge, blackice]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    const cocoa = room.items.find((i) => i[0] === "cocoa");
    const flare = room.items.find((i) => i[0] === "flare");
    assert.ok(cocoa && flare, `${room.id}: Hot Cocoa and a Road Flare`);
    const firstNew = Math.min(...room.spawns.filter((s) => s[0] in fz.MONSTERS).map((s) => s[1]));
    assert.ok(cocoa[1] < firstNew + 60 && flare[1] < firstNew + 60, `${room.id}: the stage's power-up and weapon come before what they answer`);
    assert.ok(room.spawns.some((s) => s[0] in fz.MONSTERS), `${room.id}: some of the new monsters`);
    assert.ok(room.spawns.some((s) => returning.includes(s[0])), `${room.id}: some returning ones`);
    assert.ok(room.ice.length >= 2 && room.thin.length >= 2, `${room.id}: ice and thin ice`);
    // The key shelf has a board right under it, so a run at the key climbs it.
    assert.ok(room.shelves.some(([a, b, y]) => y === 24 && a <= room.key[0] && b >= room.key[0]), `${room.id}: the key on a shelf 24 up`);
    assert.ok(room.shelves.some(([a, b, y]) => y === 15 && a <= room.key[0] && b >= room.key[0]), `${room.id}: a step under the key shelf`);
    assert.equal(room.dark, null, `${room.id}: dark or lit by the roll`);
  }
  assert.ok(widow.items.some((i) => i[0] === "cocoa") && widow.items.some((i) => i[0] === "flare"), "the boss room has both too");
  assert.equal(widow.boss, "frostwidow");
  assert.equal(widow.horde.length, 0);
  assert.ok(widow.ice.length && widow.thin.length === 0, "the arena is ice, with no thin tiles");
  // Where each new kind turns up: harder in order.
  const count = (room, kind) => room.spawns.filter((s) => s[0] === kind).length;
  assert.ok(count(huts, "hand") <= 2 && count(huts, "shade") === 1 && count(huts, "icewraith") === 1, "the Huts: two hands, one shade, one wraith");
  assert.ok(count(lodge, "shade") >= 3, "the Lodge is full of shades");
  assert.ok(count(blackice, "hand") >= 6 && count(blackice, "icewraith") >= 2, "the Black Ice: hands everywhere, wraiths");
  assert.ok(huts.thin.length <= lodge.thin.length && lodge.thin.length < blackice.thin.length, "more thin ice in order");
  assert.ok(blackice.thin.length >= 8, "the Black Ice is full of thin patches");
  assert.ok(huts.spawns.length <= lodge.spawns.length && lodge.spawns.length <= blackice.spawns.length);
  assert.ok(huts.hordeMs > lodge.hordeMs && lodge.hordeMs > blackice.hordeMs, "the horde quickens");
  // The room fields pass through the room builder, and exist (empty) everywhere else.
  assert.deepEqual(ghoul.roomFor("huts").ice, huts.ice);
  assert.deepEqual(ghoul.roomFor("blackice").thin, blackice.thin);
  assert.deepEqual(ghoul.roomFor("hall").ice, []);
  assert.deepEqual(ghoul.roomFor("hall").thin, []);
  // The ice lies on level floor; the thin tiles each on one level piece, with floor of their own piece clear either side and between.
  for (const room of [huts, lodge, blackice, widow]) {
    for (const [a, b] of room.ice) {
      const piece = room.ground.find(([x0, x1]) => a >= x0 && b <= x1);
      assert.ok(piece, `${room.id}: the ice ${a} to ${b} lies on one piece of floor`);
    }
    const tiles = [...room.thin].sort((p, q) => p[0] - q[0]);
    tiles.forEach(([a, b], i) => {
      const piece = room.ground.find(([x0, x1]) => a >= x0 && b <= x1);
      assert.ok(piece, `${room.id}: the thin tile ${a} to ${b} is on one level piece`);
      assert.ok(a - piece[0] >= 6 && piece[1] - b >= 6, `${room.id}: the tile ${a} keeps 6 of its piece clear either side`);
      assert.ok(b - a >= 5 && ghoul.jumpHeightAt(b - a + 0.6) >= 0.6 + 4, `${room.id}: the tile ${a} is wide enough to mean something and narrow enough to jump with room to spare`);
      if (i) assert.ok(a - tiles[i - 1][1] >= 6, `${room.id}: solid floor between the tiles at ${tiles[i - 1][0]} and ${a}`);
      assert.ok(room.ice.some(([x0, x1]) => a >= x0 && b <= x1) || room.id === "lodge", `${room.id}: the tile ${a} on the ice`);
    });
  }
  assert.ok(ghoul.default.create && ghoul.stageById("frozen"));
});

test("Ghoul Rush's Frozen Lake shares no hazard, monster, boss, act or tick-state name with another stage's pack (the packs' tables are merged by name)", () => {
  for (const key of ["monsters", "bosses", "hazards", "move", "boss", "act", "solid", "harmless", "platform", "kill", "weak", "swoops", "guard", "unseen", "slides", "cause", "land", "horde"]) {
    for (const other of [BONES, GRAVEYARD, GROUNDS, CHAPEL, SANATORIUM, VILLAGE, MINE, CART, CARNIVAL, arm.ARMS]) {
      for (const name of Object.keys(fz.FROZEN[key] || {})) assert.ok(!(other[key] && name in other[key]), `${key}.${name} is also ${other.id}'s`);
    }
  }
  for (const name of ["shard", "spike", "webGlob", "webPatch", "barrel"]) assert.ok(fz.FROZEN.hazards[name], `${name} is a hazard of the pack`);
  assert.ok(arm.ARMS.hazards.armRoadFlare && arm.ARMS.hazards.armRoadFire, "the flare's two hazards are the arms'");
  assert.deepEqual(Object.keys(fz.FROZEN.slides), ["frozen"]);
});

/* ------------------------------------------------------------ slippery ice */

test("Ghoul Rush's slippery ice: his run eases toward the held direction and, let go, he slides about 8 units; off the ice he runs as ever; a jump keeps what he had; Hot Cocoa turns it off; a wall stops it", () => {
  const on = frozenRound("huts");
  standAt(on, 24);
  run(on, 100, { right: true });
  assert.ok(on.you.slide > 0 && on.you.slide < ghoul.RUN_SPEED - 10, `eased in (${on.you.slide.toFixed(1)} after 100 ms)`);
  assert.equal(on.you.onIce, true);
  run(on, 600, { right: true });
  assert.equal(on.you.slide, ghoul.RUN_SPEED, "up to a full run in the end");
  const x0 = on.you.x;
  run(on, 40);
  assert.ok(on.you.slide > 0, "let go, he is still sliding");
  run(on, 1400);
  assert.equal(on.you.slide, 0, "and stopped");
  const slid = on.you.x - x0;
  assert.ok(slid > 5 && slid < 10, `about 8 units of slide (${slid.toFixed(1)})`);
  // Turning round is braked, not instant.
  standAt(on, 60);
  run(on, 700, { right: true });
  run(on, 60, { left: true });
  assert.ok(on.you.slide > 0 || on.you.x > 60, "still carried right a moment after turning left");
  run(on, 900, { left: true });
  assert.equal(on.you.slide, -ghoul.RUN_SPEED, "then running left");
  // Off the ice, the plain run at once.
  const off = frozenRound("huts");
  standAt(off, 120);
  run(off, 16, { right: true });
  assert.equal(off.you.slide, ghoul.RUN_SPEED);
  const x1 = off.you.x;
  run(off, 100);
  assert.ok(Math.abs(off.you.x - x1) < 0.01, "and he stops at once");
  // A jump from the ice keeps the speed: no friction in the air.
  const jump = frozenRound("huts");
  standAt(jump, 24);
  run(jump, 800, { right: true });
  ghoul.jump(jump);
  const xj = jump.you.x;
  run(jump, 200);
  assert.equal(jump.you.state, "air");
  assert.ok(jump.you.x - xj > 6, `he sails on (${(jump.you.x - xj).toFixed(1)} in 200 ms)`);
  assert.equal(jump.you.glide, true);
  run(jump, 1000);
  assert.equal(jump.you.state, "run");
  assert.equal(jump.you.glide, false, "landed on ice or not, the glide is spent");
  // Hot Cocoa: no sliding.
  const cocoa = frozenRound("huts");
  ghoul.applyPower(cocoa, "cocoa");
  standAt(cocoa, 24);
  run(cocoa, 16, { right: true });
  assert.equal(cocoa.you.slide, ghoul.RUN_SPEED, "a full run at once");
  const xc = cocoa.you.x;
  run(cocoa, 100);
  assert.ok(Math.abs(cocoa.you.x - xc) < 0.01, "and he stops at once");
  // The room's end stops a slide.
  const end = frozenRound("widow");
  standAt(end, 180);
  run(end, 1200, { right: true });
  run(end, 16);
  assert.equal(end.you.slide, 0, "against the end of the room it is spent");
  assert.ok(end.you.x <= end.spec.length - 1.5);
  // Rooms with no ice are untouched: no easing, the field untouched.
  const hall = ghoul.newRound(3);
  hall.dice = 0;
  hall.phase = "play";
  hall.monsters.length = 0;
  run(hall, 16, { right: true });
  assert.equal(hall.you.slide, 0, "nothing eases there");
  const hx = hall.you.x;
  run(hall, 100);
  assert.ok(Math.abs(hall.you.x - hx) < 0.01, "a hall runs and stops as ever");
});

test("Ghoul Rush's Frozen Ghoul is a zombie that slides: it eases to its pace on ice, carries on when you turn it round, and walks plainly off it", () => {
  const round = frozenRound("huts");
  standAt(round, 90);
  round.you.safeMs = 1e9;
  const m = put(round, "frozen", 40);
  assert.ok(ghoul.ZOMBIES.has("frozen"), "a zombie in every way but its death");
  run(round, 200);
  assert.ok(m.sv > 0 && m.sv < ghoul.MONSTERS.frozen.speed, `eased in (${m.sv.toFixed(1)})`);
  run(round, 1500);
  assert.ok(m.sv >= ghoul.MONSTERS.frozen.speed - 0.01 || m.x > 60, "up to its pace");
  // You go round behind it: it keeps sliding the old way a moment, then turns.
  standAt(round, 20);
  m.sv = 18;
  const before = m.x;
  run(round, 200);
  assert.ok(m.x > before, "it carried on");
  run(round, 2000);
  assert.ok(m.sv < 0 && m.x < before + 6, "and then came back");
  // Off the ice, a plain walk: its speed is its pace at once.
  const dry = frozenRound("huts");
  standAt(dry, 150);
  dry.you.safeMs = 1e9;
  const d = put(dry, "frozen", 120);
  run(dry, 20);
  assert.equal(d.sv, ghoul.MONSTERS.frozen.speed);
  // It lurches when you are near, on its level.
  const near = frozenRound("huts");
  standAt(near, 90);
  const n = put(near, "frozen", 76);
  run(near, 1600);
  assert.equal(n.lurching, true);
});

/* -------------------------------------------------------------- thin ice */

test("Ghoul Rush's thin ice: a tile cracks after THIN_WARN_MS of standing on it, breaks at THIN_MS into a pit and costs a life (cause ice), heals when stepped off, and freezes again", () => {
  assert.equal(fz.THIN_WARN_MS, 500);
  assert.equal(fz.THIN_MS, 1300);
  const round = frozenRound("huts");
  const t = tile(round);
  assert.deepEqual([t.x0, t.x1], [190, 196]);
  assert.equal(t.state, "ok");
  standAt(round, 193);
  round.you.safeMs = 0;
  run(round, fz.THIN_WARN_MS - 40);
  assert.equal(t.state, "ok");
  assert.equal(events(round, "iceCrack").length, 0);
  run(round, 80);
  assert.equal(t.state, "crack", "a crack shows");
  assert.equal(events(round, "iceCrack")[0]?.by, "you");
  assert.equal(ghoul.groundAt(round.spec, 193), 6, "still a floor");
  // Stepped off before it goes, it heals (at half the rate it grew).
  standAt(round, 180);
  run(round, 1200);
  assert.equal(t.state, "ok");
  assert.equal(t.t, 0);
  // Stood on to the end: through the ice.
  standAt(round, 193);
  round.you.safeMs = 0;
  const lives = round.lives;
  round.events.length = 0;
  run(round, fz.THIN_MS + 40);
  assert.equal(t.state, "broken");
  const broke = events(round, "iceBreak")[0];
  assert.ok(broke && broke.under === true, "it broke under him");
  assert.equal(events(round, "lose")[0]?.cause, "ice", "went through the ice");
  assert.equal(round.lives, lives - 1);
  assert.equal(round.phase, "crash");
  assert.equal(ghoul.groundAt(round.spec, 193), -Infinity, "a pit where the tile was");
  assert.ok(ghoul.groundAt(round.spec, 189) === 6 && ghoul.groundAt(round.spec, 197) === 6, "floor either side");
  assert.equal(round.spec.base.ground, ghoul.roomFor("huts").ground, "the room's own floor is kept whole");
  // The next life: the ice is whole again.
  run(round, ghoul.CRASH_MS + 80);
  assert.equal(round.phase, "ready");
  assert.equal(ghoul.groundAt(round.spec, 193), 6, "a life later the floor is back");
  assert.equal(tile(round).state, "ok");
  // It freezes again on its own, after THIN_BACK_MS, when nobody is under it.
  const other = frozenRound("huts");
  standAt(other, 100);
  other.you.safeMs = 1e9;
  const o = tile(other);
  fz.crackTile(other, o);
  run(other, fz.THIN_MS);
  assert.equal(o.state, "broken");
  assert.equal(events(other, "iceBreak")[0].under, false);
  assert.equal(ghoul.groundAt(other.spec, 193), -Infinity);
  run(other, fz.THIN_BACK_MS - 800);
  assert.equal(o.state, "broken");
  run(other, 400);
  assert.equal(o.state, "ok");
  assert.equal(events(other, "iceBack").length, 1);
  assert.equal(ghoul.groundAt(other.spec, 193), 6);
});

test("Ghoul Rush's thin ice: a crack that opens under a walker drops it too, in the air above it he falls in as into a pit, Hot Cocoa halves how fast it cracks, and endless lives spare the fall", () => {
  const round = frozenRound("huts");
  standAt(round, 120);
  round.you.safeMs = 1e9;
  const z = put(round, "zombie", 193, { stunMs: 0 });
  fz.crackTile(round, tile(round));
  tile(round).t = fz.THIN_MS - 60;
  z.wait = 0;
  round.you.x = 193.3;
  round.you.y = 6;
  run(round, 100);
  assert.equal(tile(round).state, "broken");
  run(round, 600);
  assert.ok(z.dead || z.y < 0 || !round.monsters.includes(z), "a walker on it falls through");
  // Over the tile in the air when it breaks: a pit, so the plain fall (wings aside).
  const air = frozenRound("huts");
  standAt(air, 193);
  air.you.safeMs = 0;
  ghoul.jump(air);
  run(air, 60);
  assert.equal(air.you.state, "air");
  fz.crackTile(air, tile(air));
  tile(air).t = fz.THIN_MS - 20;
  run(air, 40);
  assert.equal(tile(air).state, "broken");
  assert.equal(events(air, "iceBreak")[0].under, false, "not under him: he was in the air");
  until(air, () => events(air, "lose").length > 0, 1500);
  assert.equal(events(air, "lose")[0]?.cause, "pit", "he fell in as into a pit");
  // Cocoa: the same time stands twice as long.
  const cocoa = frozenRound("huts");
  ghoul.applyPower(cocoa, "cocoa");
  standAt(cocoa, 193);
  run(cocoa, fz.THIN_MS);
  assert.equal(tile(cocoa).state, "crack", "still holding at THIN_MS");
  assert.ok(tile(cocoa).t < fz.THIN_MS * 0.55 + 20 && tile(cocoa).t > fz.THIN_MS * 0.45, `half the growth (${tile(cocoa).t})`);
  run(cocoa, fz.THIN_MS * 1.2);
  assert.equal(tile(cocoa).state, "broken");
  // Endless lives: through the ice costs nothing.
  for (const infinite of [false, true]) {
    const r = frozenRound("huts");
    r.infinite = infinite;
    standAt(r, 193);
    r.you.safeMs = 0;
    run(r, fz.THIN_MS + 40);
    assert.equal(events(r, "lose")[0]?.cause, "ice");
    assert.equal(r.lives, infinite ? 3 : 2, infinite ? "spared" : "costs one");
  }
  // A thin tile in another room is not shared: each room has its own tiles.
  const lodge = frozenRound("lodge");
  assert.equal(lodge.thin.tiles.length, 3);
  assert.deepEqual(lodge.thin.tiles.map((t) => t.x0), [250, 384, 470]);
  assert.equal(ghoul.newRound(1).thin, null, "the hall has none");
});

/* ----------------------------------------------------------------- hands */

test("Ghoul Rush's Under-Ice Hand tracks you under the ice, warns, then cracks the thin tile over it or, with none, bursts up and grabs; under the ice it is neither solid nor hit", () => {
  const round = frozenRound("huts");
  standAt(round, 120);
  round.you.safeMs = 0;
  const m = put(round, "hand", 100);
  assert.equal(m.act, "trail");
  assert.equal(ghoul.solid(m), false, "under the ice it is not there");
  bolt(round, m, m.y + 1.5);
  round.shots[0].x = m.x - 3;
  run(round, 40);
  assert.equal(m.hp, 2, "a bolt goes over it");
  round.shots.length = 0;
  const warn = upTo(round, "handWarn", 3000);
  assert.ok(warn, "it warns");
  assert.equal(m.act, "warn");
  const t0 = round.clock;
  const up = upTo(round, "handUp", 1500);
  assert.ok(up, "then it bursts up");
  assert.ok(Math.abs(round.clock - t0 - fz.HAND_WARN_MS) < 40, `warned ${fz.HAND_WARN_MS} ms (${round.clock - t0})`);
  assert.equal(m.act, "grab");
  assert.equal(ghoul.solid(m), true, "up, it can be hit");
  assert.equal(events(round, "iceCrack").length, 0, "no tile to crack here");
  // Up, it hurts where it stands.
  const hurt = frozenRound("huts");
  standAt(hurt, 112);
  put(hurt, "hand", 112, { act: "grab", wait: 1000 });
  run(hurt, 20);
  assert.equal(events(hurt, "lose")[0]?.cause, "hand");
  // And it is shot or stomped.
  const shot = frozenRound("huts");
  standAt(shot, 90);
  const g = put(shot, "hand", 100, { act: "grab", wait: 1000 });
  bolt(shot, g, g.y + 1.5);
  run(shot, 60);
  assert.ok(g.hp < 2 || g.dead);
  // Over a thin tile it cracks it (no grab) and goes down.
  const tiled = frozenRound("huts");
  standAt(tiled, 170);
  tiled.you.safeMs = 1e9;
  const h = put(tiled, "hand", 193, { act: "warn", wait: 30 });
  run(tiled, 80);
  assert.equal(events(tiled, "handUp").length, 0, "no grab where there is a tile to crack");
  assert.equal(events(tiled, "iceCrack")[0]?.by, "hand");
  assert.equal(tile(tiled).state, "crack");
  assert.equal(tile(tiled).hand, true);
  assert.equal(h.act, "sink");
  // A tile a hand has cracked breaks by itself, with nobody on it.
  run(tiled, fz.THIN_MS);
  assert.equal(tile(tiled).state, "broken");
  assert.equal(events(tiled, "iceBreak")[0].under, false);
  // It trails again after, and never across a pit.
  const dry = frozenRound("huts");
  standAt(dry, 270);
  const far = put(dry, "hand", 230);
  run(dry, 3000);
  assert.ok(far.x < 238, "it cannot cross the pit");
});

/* ---------------------------------------------------------------- shades */

test("Ghoul Rush's Snow Shade is out of sight (not solid, nothing to shoot) and leaves footprints; a bolt coming at it, its own attack, a flare or Flash Powder show it", () => {
  const round = frozenRound("huts");
  standAt(round, 40);
  round.you.safeMs = 1e9;
  const m = put(round, "shade", 70);
  run(round, 16);
  assert.equal(m.unseen, true);
  assert.equal(ghoul.solid(m), false);
  run(round, 2400);
  assert.ok(m.x < 70, "it stalks you");
  assert.ok(m.prints.length >= 2, `footprints (${m.prints.length})`);
  assert.ok(m.prints.every((p) => p.y === 6 && p.age >= 0));
  assert.ok(m.prints.length <= fz.PRINT_KEEP);
  // Touch does nothing while it is unseen.
  const touch = frozenRound("huts");
  standAt(touch, 50);
  touch.you.safeMs = 0;
  const t = put(touch, "shade", 50.5, { act: "rest", wait: 1e9 });
  run(touch, 40);
  assert.equal(t.unseen, true);
  assert.equal(events(touch, "lose").length, 0, "an unseen shade is harmless to touch");
  // A bolt heading for it shows it, so the next bolt hits.
  const shot = frozenRound("huts");
  standAt(shot, 40);
  shot.you.safeMs = 1e9;
  const s = put(shot, "shade", 70, { act: "rest", wait: 1e9 });
  run(shot, 8);
  assert.equal(s.shownMs ?? 0, 0);
  shot.shots.push({ x: 56, y: 8.4, vx: 130, vy: 0, gone: 0 });
  run(shot, 8);
  assert.ok(events(shot, "shadeShow").length === 1, "shown");
  assert.ok(s.shownMs > 0 && s.shownMs <= fz.SHADE_SHOW_MS);
  run(shot, 120);
  assert.equal(s.hp, 2, "and the bolt hits it");
  // It stays shown SHADE_SHOW_MS, then fades.
  run(shot, fz.SHADE_SHOW_MS + 100);
  run(shot, 8);
  assert.equal(s.unseen, true);
  // A bolt flying away from it, or far off, shows nothing.
  const far = frozenRound("huts");
  standAt(far, 40);
  const f = put(far, "shade", 100, { act: "rest", wait: 1e9 });
  far.shots.push({ x: 60, y: 8.4, vx: 130, vy: 0, gone: 0 });
  far.shots.push({ x: 90, y: 8.4, vx: -130, vy: 0, gone: 0 });
  run(far, 8);
  assert.equal(f.shownMs ?? 0, 0);
  // Its attack shows it: a wind-up, a lunge, a rest, and a hit costs a life (cause shade).
  const atk = frozenRound("huts");
  standAt(atk, 40);
  atk.you.safeMs = 0;
  const a = put(atk, "shade", 49);
  const wind = upTo(atk, "shadeWind", 1500);
  assert.ok(wind, "it winds up within range");
  run(atk, 8);
  assert.equal(a.unseen, false, "shown while it attacks");
  assert.ok(upTo(atk, "shadeLunge", 1500));
  until(atk, () => events(atk, "lose").length > 0, 1500);
  assert.equal(events(atk, "lose")[0]?.cause, "shade");
  // A flare's light or Flash Powder (m.litMs) shows it too.
  const lit = frozenRound("huts");
  standAt(lit, 40);
  const l = put(lit, "shade", 90, { act: "rest", wait: 1e9 });
  l.litMs = 500;
  run(lit, 16);
  assert.equal(l.unseen, false);
  assert.equal(ghoul.solid(l), true);
});

/* ------------------------------------------------- frozen ghouls shatter */

test("Ghoul Rush's Frozen Ghoul shatters into two chest-high shards, one each way, that cross the whole screen, are ducked, and hurt only after a moment; a flare melts it without shards", () => {
  const round = frozenRound("huts");
  standAt(round, 100, -1);
  round.you.safeMs = 1e9;
  const m = put(round, "frozen", 70);
  ghoul.hurt(round, m, 99, "shot", () => 1);
  const shards = round.hazards.filter((h) => h.kind === "shard");
  assert.equal(shards.length, 2);
  assert.equal(events(round, "shatter").length, 1);
  assert.ok(shards.every((s) => s.off >= ghoul.DUCK_H + 0.2), "both over a ducked head");
  assert.deepEqual(shards.map((s) => Math.sign(s.vx)).sort(), [-1, 1], "one each way");
  assert.equal(Math.sign(shards.find((s) => s.vx > 0).vx), 1, "one flies at you");
  assert.ok(shards.every((s) => s.warn === fz.SHARD_WARN_MS && s.live === 0 && s.cause === "shard"));
  // They hurt only once the warning is over.
  const early = frozenRound("huts");
  standAt(early, 74);
  early.you.safeMs = 0;
  const e = put(early, "frozen", 72);
  ghoul.hurt(early, e, 99, "shot", () => 1);
  run(early, fz.SHARD_WARN_MS - 40);
  assert.equal(events(early, "lose").length, 0, "no hurt while they tinkle");
  run(early, 400);
  assert.equal(events(early, "lose")[0]?.cause, "shard", "then a life");
  // They are ducked, from either side.
  for (const ducked of [true, false]) {
    const d = frozenRound("huts");
    standAt(d, 80);
    d.you.safeMs = 0;
    const g = put(d, "frozen", 72);
    ghoul.hurt(d, g, 99, "shot", () => 1);
    d.input.down = ducked;
    run(d, 700);
    assert.equal(events(d, "lose").length, ducked ? 0 : 1, ducked ? "passes overhead" : "hits standing");
  }
  // A shard crosses the whole screen, then is gone.
  const far = frozenRound("huts");
  standAt(far, 20);
  far.you.safeMs = 1e9;
  far.hazards.push({ kind: "shard", x: 24, y: 8.8, off: 2.8, vx: 26, w: 1.8, h: 1.2, warn: 0, life: fz.SHARD_LIFE_MS, live: 1, cause: "shard" });
  run(far, 1500);
  const sh = far.hazards.find((h) => h.kind === "shard");
  assert.ok(sh && sh.x > 24 + 26 * 1.4 - 1, `still flying past 17 units (${sh && sh.x})`);
  run(far, 4000);
  assert.ok(!far.hazards.some((h) => h.kind === "shard"), "gone off the screen");
  // A shard ends at a pit, never rides on, and there are never too many.
  const pit = frozenRound("huts");
  standAt(pit, 20);
  pit.hazards.push({ kind: "shard", x: 233, y: 6, off: 0, vx: 26, w: 1.8, h: 1.3, warn: 0, life: 2000, live: 1, cause: "shard" });
  run(pit, 700);
  assert.equal(pit.hazards.length, 0, "gone at the pit's edge");
  const many = frozenRound("huts");
  standAt(many, 20);
  many.you.safeMs = 1e9;
  for (let i = 0; i < 6; i++) {
    const z = put(many, "frozen", 60 + i * 2);
    ghoul.hurt(many, z, 99, "shot", () => 1);
  }
  assert.ok(many.hazards.filter((h) => h.kind === "shard").length <= fz.SHARD_CAP);
  // Burned, it melts: no shards.
  const burn = frozenRound("huts");
  standAt(burn, 40);
  burn.hazards.push({ kind: "armRoadFire", x: 70, y: 6, life: fl.FLARE_MS, max: fl.FLARE_MS, tick: 0, bossDone: 0, w: fl.FLARE_W, h: fl.FLARE_H, live: 0, cause: "" });
  const b = put(burn, "frozen", 70);
  run(burn, 40);
  assert.ok(b.dead || !burn.monsters.includes(b), "burned in one tick");
  assert.equal(burn.hazards.filter((h) => h.kind === "shard").length, 0);
  assert.equal(events(burn, "shatter").length, 0);
  assert.equal(events(burn, "frozenMelt").length, 1);
});

/* ------------------------------------------------------------ ice wraiths */

test("Ghoul Rush's Ice Wraith swoops (a ducked Planny is passed over), costs a life standing, and its dive leaves you frozen when it has gone past (never under Hot Cocoa); one dives at a time", () => {
  assert.ok(fz.FROZEN.swoops.icewraith({ act: "dive" }) && !fz.FROZEN.swoops.icewraith({ act: "hover" }));
  const dive = (ducked, over = {}, setup = () => {}) => {
    const round = frozenRound("huts");
    round.spec = { ...round.spec, horde: [], spawns: [] };
    standAt(round, 60);
    round.input.down = ducked;
    setup(round);
    const m = put(round, "icewraith", 44, { y: 16, act: "wind", wait: 1, home: 16, ...over });
    round.events.length = 0;
    until(round, () => events(round, "lose").length > 0 || events(round, "freezeHit").length > 0, 2500);
    return { round, m, lost: events(round, "lose"), froze: events(round, "freezeHit") };
  };
  const stand = dive(false);
  assert.equal(stand.lost[0]?.cause, "icewraith", "standing it hits");
  const duck = dive(true);
  assert.equal(duck.lost.length, 0, "ducked it passes over");
  assert.equal(duck.froze.length, 1, "and leaves its chill");
  assert.equal(duck.froze[0].immune, false);
  assert.ok(duck.round.you.heldMs > 0 && duck.round.you.heldMs <= fz.FREEZE_MS, `frozen ${duck.round.you.heldMs} ms`);
  run(duck.round, 16);
  assert.equal(duck.round.you.ducking, false, "frozen, he stands");
  // Frozen, no key does anything; then he is free.
  duck.round.input.right = true;
  const x0 = duck.round.you.x;
  run(duck.round, 200, { right: true });
  assert.equal(duck.round.you.x, x0, "no key works while he is frozen");
  run(duck.round, fz.FREEZE_MS + 400, { right: true });
  assert.ok(duck.round.you.x > x0 + 4, "free again");
  // Hot Cocoa is immune.
  const cocoa = dive(true, {}, (r) => ghoul.applyPower(r, "cocoa"));
  assert.equal(cocoa.froze.length, 1);
  assert.equal(cocoa.froze[0].immune, true);
  assert.equal(cocoa.round.you.heldMs, 0);
  // One dives at a time, and none at a Planny still frozen.
  const two = frozenRound("huts");
  standAt(two, 60);
  two.you.safeMs = 1e9;
  const a = put(two, "icewraith", 90, { y: 16, act: "hover", wait: 0, home: 16 });
  const b = put(two, "icewraith", 95, { y: 16, act: "hover", wait: 0, home: 16 });
  run(two, 120);
  assert.equal([a, b].filter((m) => m.act === "wind").length, 1, "only one shrieks");
  const held = frozenRound("huts");
  standAt(held, 60);
  held.you.safeMs = 1e9;
  held.you.heldMs = 5000;
  const c = put(held, "icewraith", 90, { y: 16, act: "hover", wait: 0, home: 16 });
  run(held, 600);
  assert.equal(c.act, "hover", "it waits for him to thaw");
  // Walls never stop it, the floor turns it, and it waits unseen till you come.
  const idle = frozenRound("huts");
  standAt(idle, 20);
  const w = put(idle, "icewraith", 200, { y: 30, home: 30 });
  assert.equal(w.act, "idle");
  assert.equal(ghoul.solid(w), false);
  run(idle, 100);
  assert.equal(w.act, "idle", "out of range");
  standAt(idle, 150);
  run(idle, 100);
  assert.equal(w.act, "hover");
  assert.equal(events(idle, "iceWraithWake").length, 1);
});

/* ------------------------------------------------------------- the cocoa */

test("Ghoul Rush's Hot Cocoa is a stage-only power-up that lasts 10 s, with its own pill word, found nowhere else", () => {
  assert.equal(ghoul.POWERS.cocoa.stage, "frozen");
  assert.equal(ghoul.POWERS.cocoa.ms, 10000);
  assert.ok(ghoul.TIMED.includes("cocoa"));
  assert.equal(PILL_WORDS.cocoa, "COCOA");
  assert.equal(ghoul.powerHere({ dark: true, stage: "frozen" }, "cocoa"), true);
  assert.equal(ghoul.powerHere({ dark: true, stage: "manor" }, "cocoa"), false);
  assert.equal(ghoul.powerHere({ dark: true, stage: null }, "cocoa"), false);
  const rnd = ghoul.seeded(9);
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    seen.add(pickPower(rnd, { dark: i % 2 === 0, stage: "frozen" }, "", i % 3 === 0));
    assert.notEqual(pickPower(rnd, { dark: true, stage: "carnival" }, "", true), "cocoa");
  }
  assert.ok(seen.has("cocoa"), "it turns up in the lake");
  const round = frozenRound("huts");
  ghoul.applyPower(round, "cocoa");
  assert.equal(round.effects.cocoa, 10000);
  run(round, 10100);
  assert.equal(round.effects.cocoa, 0);
  assert.equal(events(round, "expire")[0]?.kind, "cocoa");
  // A placed one elsewhere is swapped (the placed loot of the Frozen Lake's rooms).
  for (const id of ROOM_IDS) {
    const r = frozenRound(id);
    r.spec.items.forEach(([kind], i) => {
      if (kind === "cocoa") assert.equal(r.loot[i], "cocoa", `${id}: the cocoa stays itself in its own stage`);
    });
  }
});

/* --------------------------------------------------------------- the flare */

test("Ghoul Rush's Road Flare is the stage's weapon: thrown ahead (about 16 units), it lands and burns 6 wide for 4 s, burning what stands in it, lighting shades, and never hurting Planny", () => {
  assert.equal(STAGE_ARMS.frozen, "flare");
  assert.deepEqual([ghoul.POWERS.flare.arm, ghoul.POWERS.flare.stage, ghoul.POWERS.flare.sticks, ghoul.POWERS.flare.max], [true, "frozen", 2, 4]);
  assert.equal(armDrop({ stage: "frozen" }, 0), "flare");
  assert.equal(ghoul.powerHere({ dark: true, stage: "frozen" }, "flare"), true);
  assert.equal(ghoul.powerHere({ dark: true, stage: "carnival" }, "flare"), false);
  for (const id of ROOM_IDS) {
    const weapons = ghoul.roomById(id).items.filter((i) => ghoul.POWERS[i[0]].arm).map((i) => i[0]);
    assert.ok(weapons.includes("flare") && weapons.length <= 2, `${id}: ${weapons}`);
  }
  const round = frozenRound("huts");
  standAt(round, 30);
  round.you.safeMs = 0;
  ghoul.applyPower(round, "flare");
  assert.equal(round.arms[0].kind, "flare");
  assert.equal(round.arms[0].n, 2);
  tapTap(round);
  assert.equal(round.arms[0].n, 1);
  assert.equal(events(round, "flareThrow").length, 1);
  assert.equal(round.hazards.filter((h) => h.kind === "armRoadFlare").length, 1);
  until(round, () => round.hazards.some((h) => h.kind === "armRoadFire"), 2000);
  const fire = round.hazards.find((h) => h.kind === "armRoadFire");
  assert.ok(fire, "it lands and burns");
  assert.ok(fire.x - 30 > 12 && fire.x - 30 < 22, `about 16 ahead (${(fire.x - 30).toFixed(1)})`);
  assert.ok(fire.w === fl.FLARE_W && fire.life > fl.FLARE_MS - 100 && fire.life <= fl.FLARE_MS);
  assert.equal(events(round, "flareLand").length, 1);
  // It burns what stands in it, a tick at a time (no drops), and the zombie dies after its hp.
  const z = put(round, "zombie", fire.x, { stunMs: 1e9 });
  const hp = z.hp;
  run(round, 16);
  assert.equal(z.hp, hp - fl.FLARE_DMG, "burned the moment it stands in it");
  run(round, fl.FLARE_TICK_MS - 80);
  assert.equal(z.hp, hp - fl.FLARE_DMG, "and not again before the next tick");
  run(round, 120);
  assert.equal(z.hp, hp - 2 * fl.FLARE_DMG);
  run(round, fl.FLARE_TICK_MS * (hp + 1));
  assert.ok(z.dead || !round.monsters.includes(z), "burned down");
  // A zombie running through it takes a burn on the way.
  const runner = frozenRound("huts");
  standAt(runner, 90);
  runner.you.safeMs = 1e9;
  runner.hazards.push({ kind: "armRoadFire", x: 70, y: 6, life: fl.FLARE_MS, max: fl.FLARE_MS, tick: 0, bossDone: 0, w: fl.FLARE_W, h: fl.FLARE_H, live: 0, cause: "" });
  const r = put(runner, "zombie", 56);
  run(runner, 1500);
  assert.ok(r.hp < r.max || r.dead, "burned in passing");
  assert.equal(round.drops.length, 0, "no drops from an area weapon");
  // It never hurts Planny, standing in it.
  standAt(round, fire.x);
  round.you.safeMs = 0;
  run(round, 500);
  assert.equal(events(round, "lose").length, 0);
  // Then it is out.
  run(round, fl.FLARE_MS + 200);
  assert.ok(!round.hazards.some((h) => h.kind === "armRoadFire"));
  // Its light shows a shade near it, and burns it.
  const lit = frozenRound("huts");
  standAt(lit, 30);
  lit.hazards.push({ kind: "armRoadFire", x: 60, y: 6, life: fl.FLARE_MS, max: fl.FLARE_MS, tick: 0, bossDone: 0, w: fl.FLARE_W, h: fl.FLARE_H, live: 0, cause: "" });
  const s = put(lit, "shade", 62, { act: "rest", wait: 1e9 });
  run(lit, 16);
  run(lit, 16);
  assert.equal(s.unseen, false, "lit");
  run(lit, fl.FLARE_TICK_MS * 4);
  assert.ok(s.hp < 3 || s.dead, "and burned once it stands in the fire");
  // A flare that comes to a pit is lost.
  const pit = frozenRound("huts");
  standAt(pit, 220);
  pit.hazards.push({ kind: "armRoadFlare", x: 238.5, y: 8, vx: 0, vy: -20, spin: 0, rest: false, t: 0, w: 0.8, h: 0.8, live: 0, cause: "" });
  run(pit, 800);
  assert.ok(!pit.hazards.some((h) => h.kind === "armRoadFire"), "no fire over a pit");
});

/* -------------------------------------------------------------- the Widow */

test("Ghoul Rush's Frost Widow hangs from the roof with her veil up, three fire barrels set out in the arena, guarded from every shot until the veil melts", () => {
  const round = widowFight();
  const b = round.boss;
  assert.equal(b.kind, "frostwidow");
  assert.equal(b.act, "hang");
  assert.equal(b.y, 6 + fz.HANG_OVER, "hanging from the top of the cavern");
  assert.equal(b.veil, true);
  assert.equal(b.hp, 90);
  const barrels = round.hazards.filter((h) => h.kind === "barrel");
  assert.deepEqual(barrels.map((h) => h.x), fz.BARREL_SPOTS.map((o) => round.spec.arena + o));
  assert.ok(barrels.every((h) => h.state === "still" && h.y === 6));
  assert.equal(ghoul.roomFor("widow", 7).bossHp, Math.round(90 * (1 + ghoul.BOSS_DEPTH_HP * 7)));
  // A shot at her glances off: the veil, and she is off the floor besides.
  for (const [act, y] of [["hang", 26], ["low", 6]]) {
    Object.assign(b, { act, y, x: 170, wait: 1e9, lowMs: 1e9 });
    round.shots.length = 0;
    round.events.length = 0;
    round.shots.push({ x: 160, y: act === "low" ? 8.4 : 28, vx: 80, vy: 0, gone: 0 });
    run(round, 160);
    assert.equal(b.hp, 90, `${act}: not hurt`);
    assert.equal(events(round, "bossBlock").length, 1, `${act}: a guard shows`);
  }
  // Her touch costs a life, wherever her body is.
  const touch = widowFight({ x: 150 });
  touch.you.safeMs = 0;
  Object.assign(touch.boss, { act: "low", y: 6, x: 152, wait: 1e9, lowMs: 1e9 });
  run(touch, 20);
  assert.equal(events(touch, "lose")[0]?.cause, "frostwidow");
  // Standing on a board at 18 she walks over, up on her roof: no touch.
  const high = widowFight({ x: 132 });
  high.you.safeMs = 0;
  standAt(high, 132, 1, 18, 1);
  Object.assign(high.boss, { act: "hang", y: 26, x: 132, wait: 1e9 });
  run(high, 20);
  assert.equal(events(high, "lose").length, 0);
});

test("Ghoul Rush's barrels: a bolt kicks a standing one the way it flew, it rolls burning along the floor, hurts monsters, bursts on a wall, and a thrown weapon passes through", () => {
  const round = widowFight({ x: 120 });
  const barrel = round.hazards.find((h) => h.kind === "barrel" && h.x === round.spec.arena + 30);
  // From the left: it rolls right.
  round.shots.push({ x: barrel.x - 4, y: 7.5, vx: 130, vy: 0, gone: 0 });
  run(round, 60);
  assert.equal(barrel.state, "roll");
  assert.equal(barrel.vx, fz.BARREL_V);
  assert.equal(events(round, "barrelKick").length, 1);
  assert.equal(round.shots.length, 0, "the bolt is spent");
  const x0 = barrel.x;
  run(round, 300);
  assert.ok(barrel.x - x0 > 8 && barrel.y === 6, "rolling along the floor");
  // From the right: it rolls left.
  const left = widowFight({ x: 190 });
  const b2 = left.hazards.find((h) => h.kind === "barrel" && h.x === left.spec.arena + 66);
  left.shots.push({ x: b2.x + 4, y: 7.5, vx: -130, vy: 0, gone: 0 });
  run(left, 40);
  assert.equal(b2.vx, -fz.BARREL_V);
  // It hurts what it rolls through, once each.
  const hit = widowFight({ x: 120 });
  const b3 = hit.hazards.find((h) => h.kind === "barrel" && h.x === hit.spec.arena + 30);
  const z = put(hit, "zombie", b3.x + 8);
  hit.shots.push({ x: b3.x - 4, y: 7.5, vx: 130, vy: 0, gone: 0 });
  run(hit, 600);
  assert.equal(z.hp, z.max - fz.BARREL_DMG >= 0 ? z.max - fz.BARREL_DMG : z.hp);
  assert.ok(z.dead || z.hp < z.max, "burned by the barrel");
  // It bursts on the arena's wall, and it is gone.
  const wall = widowFight({ x: 120 });
  const b4 = wall.hazards.find((h) => h.kind === "barrel" && h.x === wall.spec.arena + 66);
  wall.boss.x = 120;
  wall.shots.push({ x: b4.x - 4, y: 7.5, vx: 130, vy: 0, gone: 0 });
  run(wall, 1500);
  assert.ok(!wall.hazards.includes(b4));
  assert.ok(events(wall, "barrelBurst").length >= 1);
  // A thrown weapon (a stake) kicks it and flies on.
  const arc = widowFight({ x: 120 });
  const b5 = arc.hazards.find((h) => h.kind === "barrel" && h.x === arc.spec.arena + 30);
  arc.shots.push({ arm: "stake", x: b5.x - 4, y: 7.5, vx: 96, vy: 0, gone: 0, t: 0, spin: 0, dmg: 4, bossDmg: 4, pierce: true });
  run(arc, 60);
  assert.equal(b5.state, "roll");
  assert.equal(arc.shots.length, 1, "the stake flies on");
  // A bolt that misses it (too high) goes by.
  const miss = widowFight({ x: 120 });
  const b6 = miss.hazards.find((h) => h.kind === "barrel" && h.x === miss.spec.arena + 30);
  miss.shots.push({ x: b6.x - 4, y: 14, vx: 130, vy: 0, gone: 0 });
  run(miss, 60);
  assert.equal(b6.state, "still");
});

test("Ghoul Rush's veil melts to a rolling barrel (or a flare's fire) when she is on the floor, stays down VEIL_DOWN_MS while she stays, then grows back and the used barrels are set out again", () => {
  const round = widowFight({ x: 125 });
  const b = round.boss;
  Object.assign(b, { act: "low", y: 6, x: 160, wait: 0, lowMs: 1e9 });
  const barrel = round.hazards.find((h) => h.kind === "barrel" && h.x === round.spec.arena + 48);
  // Shot from the left, 4 away from her: it rolls into her.
  barrel.x = 150;
  round.shots.push({ x: 146, y: 7.5, vx: 130, vy: 0, gone: 0 });
  until(round, () => !b.veil, 1500);
  assert.equal(b.veil, false, "melted");
  const melt = events(round, "veilMelt")[0];
  assert.ok(melt && melt.by === "barrel");
  assert.equal(events(round, "veilDown")[0].ms, fz.VEIL_DOWN_MS);
  assert.equal(b.veilMs <= fz.VEIL_DOWN_MS, true);
  assert.ok(!round.hazards.includes(barrel), "the barrel is spent");
  assert.equal(round.boss.hp, 90, "melting hurts nothing");
  // Now a shot hurts her: any shot, 1.
  round.shots.length = 0;
  round.events.length = 0;
  round.shots.push({ x: 152, y: 14, vx: 80, vy: 0, gone: 0 });
  run(round, 120);
  assert.equal(b.hp, 89);
  assert.equal(events(round, "bossHit")[0]?.weak, false);
  // She stays on the floor while it is down, however long her low time was.
  b.lowMs = 0;
  run(round, 1000);
  assert.equal(b.act, "low");
  // It grows back after VEIL_DOWN_MS, and the barrel is set out again.
  const t0 = round.clock;
  const up = upTo(round, "veilUp", fz.VEIL_DOWN_MS + 500);
  assert.ok(up, "veilUp");
  assert.equal(b.veil, true);
  assert.ok(Math.abs(round.clock - t0 - (fz.VEIL_DOWN_MS - 1120)) < 400, `about ${fz.VEIL_DOWN_MS} ms in all (${round.clock - t0} more after 1.1 s)`);
  assert.equal(round.hazards.filter((h) => h.kind === "barrel").length, 3);
  assert.equal(events(round, "barrelPlace").length, 1);
  // A rolling barrel at her with the veil down hurts her instead (BARREL_BOSS), the veil down already.
  const raw = widowFight({ x: 125 });
  Object.assign(raw.boss, { act: "low", y: 6, x: 160, wait: 0, lowMs: 1e9, veil: false, veilMs: 5000 });
  raw.hazards.push({ kind: "barrel", x: 150, y: 6, state: "roll", vx: fz.BARREL_V, roll: 0, life: 4000, hit: [], w: fz.BARREL_W, h: fz.BARREL_H, live: 0, cause: "" });
  run(raw, 600);
  assert.equal(raw.boss.hp, 90 - fz.BARREL_BOSS);
  // A flare's fire melts it too, and never hurts a veil-less boss more than FLARE_BOSS a tick.
  const fire = widowFight({ x: 125 });
  Object.assign(fire.boss, { act: "low", y: 6, x: 160, wait: 0, lowMs: 1e9 });
  fire.hazards.push({ kind: "armRoadFire", x: 156, y: 6, life: fl.FLARE_MS, max: fl.FLARE_MS, tick: 0, bossDone: 0, w: fl.FLARE_W, h: fl.FLARE_H, live: 0, cause: "" });
  run(fire, 120);
  assert.equal(fire.boss.veil, false);
  assert.equal(events(fire, "veilMelt")[0]?.by, "flare");
  assert.equal(events(fire, "bossBlock").length, 0, "no block spam");
  run(fire, fl.FLARE_TICK_MS * 3 + 60);
  assert.ok(fire.boss.hp < 90 && fire.boss.hp >= 90 - 8, `the fire's tick hurts a little (${fire.boss.hp})`);
  // In the air (hanging) a barrel or a fire does nothing to the veil.
  const hang = widowFight({ x: 125 });
  hang.hazards.push({ kind: "armRoadFire", x: 170, y: 6, life: fl.FLARE_MS, max: fl.FLARE_MS, tick: 0, bossDone: 0, w: fl.FLARE_W, h: fl.FLARE_H, live: 0, cause: "" });
  run(hang, 400);
  assert.equal(hang.boss.veil, true);
});

test("Ghoul Rush's Frost Widow's heart: with the veil down and her on the floor any shot does 1, and one into her underside while her mouth is open does triple (a weak hit)", () => {
  const round = widowFight({ x: 125 });
  const b = round.boss;
  Object.assign(b, { act: "low", y: 6, x: 160, wait: 0, lowMs: 1e9, veil: false, veilMs: 1e9, mouth: false });
  round.shots.push({ x: 154.5, y: 18, vx: 80, vy: 0, gone: 0 });
  run(round, 100);
  assert.equal(b.hp, 89);
  round.events.length = 0;
  b.mouth = true;
  b.mouthMs = 1e9;
  // Up high, mouth or no mouth: 1.
  round.shots.push({ x: 154.5, y: 18, vx: 80, vy: 0, gone: 0 });
  run(round, 100);
  assert.equal(b.hp, 88);
  // Low (where a standing blaster's bolts go): triple.
  round.shots.push({ x: 154.5, y: 8.4, vx: 80, vy: 0, gone: 0 });
  run(round, 100);
  assert.equal(b.hp, 85);
  const hit = events(round, "bossHit").at(-1);
  assert.equal(hit.weak, true);
  assert.equal(hit.kind, "frostwidow");
  // Closed, the same shot is 1 again.
  b.mouth = false;
  b.mouthMs = 0;
  round.shots.push({ x: 154.5, y: 8.4, vx: 80, vy: 0, gone: 0 });
  run(round, 100);
  assert.equal(b.hp, 84);
  // Through armBossDamage: a thrown weapon's damage is scaled and capped as for every boss.
  const arc = widowFight({ x: 125 });
  Object.assign(arc.boss, { act: "low", y: 6, x: 160, wait: 0, lowMs: 1e9, veil: false, veilMs: 1e9 });
  arc.shots.push({ arm: "stake", x: 154.5, y: 8.4, vx: 96, vy: 0, gone: 0, t: 0, spin: 0, dmg: 4, bossDmg: 4, pierce: true });
  run(arc, 100);
  assert.ok(arc.boss.hp < 90 && arc.armBossDmg > 0, "the stake counts toward the share cap");
});

test("Ghoul Rush's Frost Widow's cycle: she hangs, drops on the far side of you, stands LOW_MS (longer while her veil is down), rises and hangs again, her mouth open for each web spit", () => {
  const round = widowFight({ x: 125 });
  const b = round.boss;
  round.boss.spikeIn = 1e9;
  round.boss.spitIn = 1e9;
  assert.equal(b.act, "hang");
  b.x = 170;
  b.wait = 1;
  run(round, 8);
  assert.equal(b.act, "drop");
  const drop = events(round, "widowDrop")[0];
  assert.ok(drop, "a drop");
  assert.ok(Math.abs(b.toX - (125 + fz.LAND_AWAY)) < 1.5 || b.toX >= 125 + fz.LAND_AWAY - 1.5, `lands ${fz.LAND_AWAY} from you, on her side (${b.toX})`);
  run(round, fz.DROP_MS / 2);
  assert.ok(b.y < 26 && b.y > 6, "on the way down");
  run(round, fz.DROP_MS);
  assert.equal(b.act, "low");
  assert.equal(b.y, 6);
  // She walks at you, stopping LOW_KEEP short.
  const gap0 = b.x - round.you.x;
  run(round, 3000);
  assert.ok(b.x - round.you.x >= fz.LOW_KEEP - 0.5 && b.x - round.you.x < gap0 + 0.01);
  // And rises when her time is up (the veil still up).
  b.lowMs = 1;
  run(round, 16);
  assert.equal(b.act, "rise");
  assert.equal(events(round, "widowRise").length, 1);
  run(round, fz.RISE_MS + 40);
  assert.equal(b.act, "hang");
  assert.equal(b.y, 26);
  // The mouth opens for the wind-up of a web spit.
  b.spitIn = 1;
  run(round, 16);
  assert.equal(events(round, "webWind").length, 1);
  assert.equal(b.mouth, true);
  run(round, fz.SPIT_WIND_MS + 20);
  assert.equal(events(round, "webShot").length, 1);
  assert.equal(b.mouth, true, "still open a moment");
  run(round, fz.MOUTH_HOLD_MS + 40);
  assert.equal(b.mouth, false);
});

test("Ghoul Rush's blizzard: a wind warns for a second, then pushes Planny away from her at 22 a second for 3 s (half while he ducks or stands behind a barrel); the push is no damage", () => {
  const first = widowFight({ x: 158 });
  first.boss.spikeIn = 1e9;
  first.boss.spitIn = 1e9;
  first.boss.stunMs = 1e9;
  first.boss.x = 118;
  first.you.safeMs = 1e9;
  const t0 = first.clock;
  const warn = upTo(first, "blizzard", fz.BLIZZARD_FIRST_MS + 500);
  assert.ok(warn, "the blizzard is called");
  assert.ok(Math.abs(first.clock - t0 - fz.BLIZZARD_FIRST_MS) < 40, `the first one ${fz.BLIZZARD_FIRST_MS} ms in`);
  assert.equal(first.twist.wind.state, "warn");
  const x0 = first.you.x;
  run(first, fz.BLIZZARD_WARN_MS - 80);
  assert.equal(first.you.x, x0, "no wind during the warning");
  const blow = upTo(first, "blizzardBlow", 400);
  assert.ok(blow);
  assert.equal(first.twist.wind.state, "blow");
  // The wind is away from her.
  const side = Math.sign(first.you.x - first.boss.x);
  assert.equal(blow.dir, side);
  const x1 = first.you.x;
  run(first, 500);
  assert.ok(Math.abs((first.you.x - x1) * side - fz.BLIZZARD_PUSH / 2) < 2, `11 units in half a second (${((first.you.x - x1) * side).toFixed(1)})`);
  assert.ok(first.you.x !== x1 && Math.sign(first.you.x - x1) === side);
  // He can run into it: net 14.
  const x2 = first.you.x;
  run(first, 1000, { [side > 0 ? "left" : "right"]: true });
  assert.ok((first.you.x - x2) * side < -3, `running into it makes headway (${((first.you.x - x2) * side).toFixed(1)})`);
  run(first, fz.BLIZZARD_MS);
  assert.ok(events(first, "blizzardEnd").length === 1);
  assert.equal(first.twist.wind.state, "calm");
  assert.equal(events(first, "lose").length, 0, "no damage");
  // Ducking halves it; so does a barrel between him and her.
  const duck = widowFight({ x: 150 });
  Object.assign(duck.twist.wind, { state: "blow", ms: 3000, dir: 1 });
  duck.boss.x = 120;
  duck.input.down = true;
  ghoul.moveYou(duck, 16);
  const d0 = duck.you.x;
  run(duck, 1000, { down: true });
  assert.equal(duck.you.ducking, true);
  assert.ok(Math.abs(duck.you.x - d0 - fz.BLIZZARD_PUSH * fz.BLIZZARD_COVER) < 3, `half (${(duck.you.x - d0).toFixed(1)})`);
  const pushed = (barrelAt) => {
    const r = widowFight({ x: 156 });
    Object.assign(r.twist.wind, { state: "blow", ms: 3000, dir: 1 });
    r.boss.x = 120;
    r.boss.stunMs = 1e9;
    r.hazards.find((h) => h.kind === "barrel" && h.x === r.spec.arena + 48).x = barrelAt;
    const x0 = r.you.x;
    run(r, 200);
    return r.you.x - x0;
  };
  const bare = pushed(190);
  const covered = pushed(153);
  assert.ok(Math.abs(bare - fz.BLIZZARD_PUSH * 0.2) < 0.8, `in the open, 22 a second (${bare.toFixed(2)})`);
  assert.ok(Math.abs(covered - bare * fz.BLIZZARD_COVER) < 0.4, `behind a barrel, half (${covered.toFixed(2)} against ${bare.toFixed(2)})`);
  // A wall stops it.
  const wall = widowFight({ x: 196 });
  Object.assign(wall.twist.wind, { state: "blow", ms: 3000, dir: 1 });
  wall.boss.x = 120;
  run(wall, 1000);
  assert.ok(wall.you.x <= wall.spec.length - 1.5);
  // The first blow is not before the fight: nothing in the intro.
  const intro = frozenRound("widow");
  standAt(intro, intro.spec.arena + 12);
  intro.you.safeMs = 1e9;
  run(intro, 500);
  assert.equal(events(intro, "blizzard").length, 0);
});

test("Ghoul Rush's ice spikes: a cracking line at your x for 800 ms, then a spike 9.5 high for a second (cause spike): step out, jump it, or stand on a board over it", () => {
  const spike = (round, x) => {
    round.events.length = 0;
    round.boss.spikeIn = 1;
    round.boss.spitIn = 1e9;
    standAt(round, x ?? round.you.x);
    round.you.safeMs = 0;
    run(round, 16);
  };
  const round = widowFight({ x: 150 });
  spike(round);
  const w = events(round, "spikeWarn")[0];
  assert.ok(w && Math.abs(w.x - 150) < 0.5, "at your x");
  const h = round.hazards.find((q) => q.kind === "spike");
  assert.deepEqual([h.w, h.h], [fz.SPIKE_W, fz.SPIKE_H]);
  run(round, fz.SPIKE_WARN_MS - 80);
  assert.equal(events(round, "lose").length, 0, "nothing while it cracks");
  assert.equal(h.live, 0);
  run(round, 120);
  assert.equal(events(round, "spikeUp").length, 1);
  assert.equal(events(round, "lose")[0]?.cause, "spike");
  // Stepping out in time.
  const step = widowFight({ x: 150 });
  spike(step);
  run(step, 400, { right: true });
  run(step, fz.SPIKE_WARN_MS + fz.SPIKE_UP_MS);
  assert.equal(events(step, "lose").length, 0);
  // Jumping it.
  const jump = widowFight({ x: 150 });
  spike(jump);
  run(jump, fz.SPIKE_WARN_MS - 300);
  ghoul.jump(jump);
  run(jump, 700, { right: true });
  run(jump, fz.SPIKE_UP_MS);
  assert.equal(events(jump, "lose").length, 0, "jumped across it");
  // A board 18 (12 up) is over it.
  const board = widowFight({ x: 132 });
  standAt(board, 132, 1, 18, 1);
  board.boss.spikeIn = 1;
  board.boss.spitIn = 1e9;
  board.you.safeMs = 0;
  run(board, 16);
  const hb = board.hazards.find((q) => q.kind === "spike");
  assert.ok(Math.abs(hb.x - 132) < 0.5);
  run(board, fz.SPIKE_WARN_MS + 300);
  assert.equal(events(board, "lose").length, 0, "a spike never reaches a board that high");
  // Endless lives spare it.
  for (const infinite of [false, true]) {
    const r = widowFight({ x: 150 });
    r.infinite = infinite;
    spike(r);
    until(r, () => events(r, "lose").length > 0, 2000);
    assert.equal(events(r, "lose")[0]?.cause, "spike");
    assert.equal(r.lives, infinite ? 3 : 2);
  }
  // It crushes a monster in its column.
  const crush = widowFight({ x: 125 });
  const z = put(crush, "zombie", 160);
  crush.hazards.push({ kind: "spike", x: 160, y: 6, w: fz.SPIKE_W, h: fz.SPIKE_H, warn: 20, up: 600, live: 0, cause: "spike" });
  run(crush, 80);
  assert.ok(z.dead || !crush.monsters.includes(z));
  // Two at once in a rage.
  const rage = widowFight({ x: 150 });
  rage.boss.hp = 40;
  run(rage, 16);
  spike(rage);
  assert.equal(rage.hazards.filter((q) => q.kind === "spike").length, 2, "a second one ahead of you");
});

test("Ghoul Rush's web spit: a slow glob that lands as a patch 5 wide for 6 s, slowing Planny like water and hurting nothing; a bolt shoots a glob down", () => {
  const round = widowFight({ x: 150 });
  round.boss.spikeIn = 1e9;
  round.boss.spitIn = 1;
  round.you.safeMs = 0;
  run(round, 16);
  assert.equal(events(round, "webWind").length, 1);
  run(round, fz.SPIT_WIND_MS + 20);
  const glob = round.hazards.find((h) => h.kind === "webGlob");
  assert.ok(glob, "a glob in the air");
  assert.equal(events(round, "webShot").length, 1);
  round.boss.spitIn = 1e9;
  const land = upTo(round, "webLand", 3000);
  assert.ok(land, "it lands");
  const patch = round.hazards.find((h) => h.kind === "webPatch");
  assert.ok(patch && patch.w === fz.WEB_W && patch.life <= fz.WEB_LIFE_MS);
  assert.equal(events(round, "lose").length, 0, "it hurts nothing");
  // Standing in it slows him; out of it, he is quick again.
  standAt(round, patch.x);
  round.you.safeMs = 0;
  const x0 = round.you.x;
  run(round, 400, { right: true });
  const slowed = round.you.x - x0;
  assert.ok(round.you.slowMs > 0);
  standAt(round, 120);
  const free0 = round.you.x;
  run(round, 400, { right: true });
  assert.ok(slowed < (round.you.x - free0) * 0.8, `slower in the web (${slowed.toFixed(1)} against ${(round.you.x - free0).toFixed(1)})`);
  assert.equal(events(round, "lose").length, 0);
  // It is gone after WEB_LIFE_MS.
  run(round, fz.WEB_LIFE_MS + 200);
  assert.ok(!round.hazards.some((h) => h.kind === "webPatch"));
  // A bolt through a glob in the air shoots it down: no patch.
  const shot = widowFight({ x: 150 });
  shot.hazards.push({ kind: "webGlob", x: 160, y: 20, vx: -2, vy: 0, spin: 0, life: 3000, w: 1.6, h: 1.6, live: 0, cause: "" });
  shot.shots.push({ x: 156, y: 20.5, vx: 130, vy: 0, gone: 0 });
  run(shot, 120);
  assert.ok(!shot.hazards.some((h) => h.kind === "webGlob" || h.kind === "webPatch"), "shot down");
});

test("Ghoul Rush's Frost Widow's rage at half her hp: the veil grows back sooner, the barrels are set out new, two ice wraiths come (never more than two alive) and she is quicker; endless lives spare her touch", () => {
  const round = widowFight({ x: 125 });
  const b = round.boss;
  round.hazards = round.hazards.filter((h) => h.kind !== "barrel").concat([{ kind: "barrel", x: 140, y: 6, spot: 99, state: "roll", vx: 5, roll: 0, life: 9999, hit: [], w: 3, h: 3.4, live: 0, cause: "" }]);
  b.hp = 45;
  round.events.length = 0;
  run(round, 16);
  assert.equal(b.raged, true);
  assert.equal(events(round, "widowRage").length, 1);
  const barrels = round.hazards.filter((h) => h.kind === "barrel");
  assert.equal(barrels.length, 3, "a new set of three");
  assert.ok(barrels.every((h) => h.state === "still"));
  const wraiths = round.monsters.filter((m) => m.kind === "icewraith");
  assert.equal(wraiths.length, 2);
  assert.equal(events(round, "wraithCall").length, 2);
  // Never more than two alive, a drop or not.
  b.act = "hang";
  b.wait = 1;
  b.spikeIn = 1e9;
  b.spitIn = 1e9;
  run(round, 16);
  assert.equal(round.monsters.filter((m) => m.kind === "icewraith").length, 2);
  // The veil grows back in VEIL_DOWN_RAGE_MS.
  Object.assign(b, { act: "low", y: 6, x: 160, lowMs: 1e9, wait: 0 });
  round.hazards.find((h) => h.kind === "barrel").x = 150;
  round.shots.push({ x: 146, y: 7.5, vx: 130, vy: 0, gone: 0 });
  until(round, () => !b.veil, 1500);
  assert.equal(events(round, "veilDown").at(-1).ms, fz.VEIL_DOWN_RAGE_MS);
  // Quicker waits: a fight at half hp has shorter hangs.
  const calm = widowFight({ x: 125 });
  calm.boss.spikeIn = 1e9;
  calm.boss.spitIn = 1e9;
  calm.boss.act = "low";
  calm.boss.y = 6;
  calm.boss.lowMs = 1;
  calm.boss.veil = true;
  run(calm, 16);
  assert.equal(calm.boss.act, "rise");
  run(calm, fz.RISE_MS + 40);
  assert.ok(Math.abs(calm.boss.wait - fz.HANG_MS) < 60);
  const quick = widowFight({ x: 125 });
  quick.boss.hp = 40;
  run(quick, 16);
  quick.boss.spikeIn = 1e9;
  quick.boss.spitIn = 1e9;
  quick.boss.act = "low";
  quick.boss.y = 6;
  quick.boss.lowMs = 1;
  run(quick, 16);
  run(quick, fz.RISE_MS + 40);
  assert.ok(Math.abs(quick.boss.wait - fz.HANG_MS * fz.RAGE_QUICK) < 60, `${quick.boss.wait}`);
  // Endless lives spare her touch, an ice wraith's dive and a shard.
  const costs = (setup, cause) => {
    for (const infinite of [false, true]) {
      const r = widowFight({ x: 150 });
      r.infinite = infinite;
      r.you.safeMs = 0;
      r.boss.spikeIn = 1e9;
      r.boss.spitIn = 1e9;
      setup(r);
      until(r, () => events(r, "lose").length > 0, 2500);
      assert.equal(events(r, "lose")[0]?.cause, cause, `${cause}: a life is lost`);
      assert.equal(r.lives, infinite ? 3 : 2, `${cause}: ${infinite ? "spared" : "costs one"}`);
    }
  };
  costs((r) => Object.assign(r.boss, { act: "low", y: 6, x: 152, lowMs: 1e9, wait: 0 }), "frostwidow");
  costs((r) => put(r, "icewraith", 134, { y: 16, act: "wind", wait: 1, home: 16 }), "icewraith");
  costs((r) => r.hazards.push({ kind: "shard", x: 150, y: 6, off: 0, vx: 0, w: 1.8, h: 1.3, warn: 0, life: 900, live: 1, cause: "shard" }), "shard");
  costs((r) => put(r, "hand", 150, { act: "grab", wait: 900 }), "hand");
  costs((r) => put(r, "shade", 150.2, { act: "lunge", wait: 900, shownMs: 900 }), "shade");
});

test("Ghoul Rush's Frost Widow can be beaten: a bot that shoots a barrel into her, then her, ducks the wraiths and keeps out of the spikes finishes the fight at depth 0 and depth 7", () => {
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const bot = (round) => {
    const { you, boss: b, input: inp, spec } = round;
    inp.left = inp.right = inp.down = inp.fire = false;
    if (round.phase !== "play" || you.out > 0) return;
    const lo = spec.arena + 6;
    const hi = spec.length - 6;
    let tx = spec.arena + 48;
    let face = 0;
    let fire = false;
    let duck = false;
    const spikes = round.hazards.filter((h) => h.kind === "spike" && (h.warn > 0 || h.live > 0));
    const bad = (x) => spikes.some((h) => Math.abs(x - h.x) < 8);
    const wraiths = round.monsters.filter((m) => m.kind === "icewraith" && Math.abs(m.x - you.x) < 45 && m.x > round.camX && m.x < round.camX + 96);
    const hover = wraiths.find((m) => m.act === "hover" && Math.abs(m.y - you.y) < 14);
    if (spikes.some((h) => Math.abs(you.x - h.x) < 12)) {
      tx = you.x;
      for (let d = 0; d <= 60; d++) {
        const x = [you.x + d, you.x - d].find((q) => q > lo && q < hi && !bad(q));
        if (x !== undefined) {
          tx = x;
          break;
        }
      }
    } else if (wraiths.some((m) => m.act === "wind" || m.act === "dive")) {
      duck = true;
      tx = you.x;
    } else if (b.state !== "fight") tx = spec.arena + 40;
    else if (b.act === "low" && b.veil) {
      const s = Math.sign(b.x - you.x) || 1;
      const barrels = round.hazards.filter((h) => h.kind === "barrel" && h.state === "still" && (b.x - h.x) * s > 4).sort((p, q) => Math.abs(p.x - b.x) - Math.abs(q.x - b.x));
      const best = barrels[0];
      if (best) {
        const side = Math.sign(b.x - best.x);
        const want = best.x - side * 8;
        if ((you.x - best.x) * side < -2 && Math.abs(you.x - want) < 14) {
          face = side;
          fire = true;
          tx = you.x;
        } else tx = want;
      } else tx = clamp(b.x - s * 22, lo, hi);
    } else if (b.act === "low") {
      const s = Math.sign(b.x - you.x) || 1;
      tx = clamp(b.x - s * 20, lo, hi);
      face = s;
      fire = Math.abs(b.x - you.x) < 40;
    } else if (hover) {
      tx = you.x;
      face = Math.sign(hover.x - you.x) || 1;
      fire = true;
    }
    if (b.state === "fight" && (b.act === "low" || b.act === "drop") && Math.abs(tx - b.x) < 11) tx = b.x + (you.x >= b.x ? 11 : -11);
    const dx = tx - you.x;
    if (Math.abs(dx) > 2.5) inp[dx > 0 ? "right" : "left"] = true;
    else if (face && you.face !== face) inp[face > 0 ? "right" : "left"] = true;
    if (duck) {
      inp.left = inp.right = false;
      inp.down = true;
    }
    inp.fire = fire;
  };
  const fight = (depth) => {
    const round = frozenRound("widow", depth);
    standAt(round, round.spec.arena + 12);
    round.you.safeMs = 1500;
    round.lives = 99;
    let ms = 0;
    let t0 = null;
    while (ms < 300000 && round.boss.state !== "down") {
      bot(round);
      ghoul.advance(round, 16, steady);
      ms += 16;
      if (round.boss.state === "fight" && t0 === null) t0 = ms;
      round.events.length = 0;
    }
    return { won: round.boss.state === "down", secs: (ms - t0) / 1000, round };
  };
  for (const depth of [0, 7]) {
    const r = fight(depth);
    assert.ok(r.won, `depth ${depth}: down in ${r.secs.toFixed(0)} s`);
    assert.ok(r.secs > 25, `depth ${depth}: not a pushover (${r.secs.toFixed(0)} s)`);
    assert.equal(r.round.hasKey, true, "her fall opens the door");
    assert.ok(r.round.lives >= 1);
  }
  // Her fall: points, a life, the field cleared.
  const down = widowFight({ x: 125 });
  Object.assign(down.boss, { act: "low", y: 6, x: 160, veil: false, veilMs: 1e9, wait: 0, lowMs: 1e9, hp: 1 });
  down.shots.push({ x: 154.5, y: 8.4, vx: 80, vy: 0, gone: 0 });
  const lives = down.lives;
  run(down, 100);
  assert.equal(down.boss.state, "down");
  assert.equal(events(down, "bossDown")[0]?.kind, "frostwidow");
  assert.equal(down.lives, lives + 1, "a boss always gives a life");
  assert.equal(down.hazards.length, 0, "the field is cleared");
});

/* ------------------------------------------------------- the whole stage */

test("Ghoul Rush's Frozen Lake plays the same every time: a seed gives the same fight, and the pack draws no random number", () => {
  const trace = () => {
    const round = widowFight({ x: 130 });
    const seen = [];
    for (let t = 0; t < 40000; t += 16) {
      round.input.right = t % 3000 < 1500;
      round.input.fire = t % 1000 < 600;
      ghoul.advance(round, 16, never);
      if (t % 800 === 0) seen.push([round.boss.act, round.boss.x.toFixed(2), round.boss.y.toFixed(2), round.boss.veil, round.boss.hp, round.you.x.toFixed(2), round.hazards.length, round.monsters.length]);
      round.you.safeMs = 1e9;
      round.events.length = 0;
    }
    return seen;
  };
  assert.deepEqual(trace(), trace());
  // Stepping on the ice, the tiles and the shades draw nothing either (the room's own horde does, not run here).
  const round = frozenRound("lodge");
  standAt(round, 60);
  round.you.safeMs = 1e9;
  put(round, "shade", 120);
  put(round, "hand", 80);
  put(round, "frozen", 100);
  for (let t = 0; t < 6000; t += 16) {
    round.input.right = t % 2000 < 1000;
    round.input.left = !round.input.right;
    ghoul.advance(round, 16, never);
  }
});

test("Ghoul Rush's every room of the Frozen Lake can be finished with its thin tiles cut out, and every placed thing sits on a surface", () => {
  const MARGIN = 0.6;
  for (const id of ROOM_IDS) {
    const room = ghoul.roomById(id);
    const pieces = [];
    for (const [x0, x1, y] of room.ground) {
      let a = x0;
      for (const [t0, t1] of room.thin.filter(([p, q]) => p >= x0 && q <= x1).sort((p, q) => p[0] - q[0])) {
        pieces.push({ x0: a, x1: t0, y, ground: true });
        a = t1;
      }
      pieces.push({ x0: a, x1, y, ground: true });
    }
    const list = [...pieces, ...room.shelves.map(([x0, x1, y]) => ({ x0, x1, y, ground: false }))];
    const reaches = (A, B) => {
      const dy = B.y - A.y;
      if (A.ground && B.ground && (A.x1 === B.x0 || B.x1 === A.x0) && Math.abs(dy) <= ghoul.STEP_UP) return true;
      const gap = Math.max(B.x0 - A.x1, A.x0 - B.x1);
      if (gap <= 0) return dy < 0 || dy <= ghoul.JUMP_TOP - MARGIN;
      return ghoul.jumpHeightAt(gap + MARGIN) >= dy + MARGIN;
    };
    const reach = (from) => {
      const seen = new Set([from]);
      const queue = [from];
      while (queue.length) {
        const a = queue.shift();
        for (const b of list) if (!seen.has(b) && reaches(a, b)) (seen.add(b), queue.push(b));
      }
      return seen;
    };
    const at = (x, y) => list.find((s) => x >= s.x0 && x <= s.x1 && s.y === y);
    const start = at(room.start, ghoul.groundAt(room, room.start));
    const door = at(room.door, ghoul.groundAt(room, room.door));
    assert.ok(start && door, `${id}: a start and a door`);
    let from = start;
    if (room.key) {
      const key = at(room.key[0], room.key[1]);
      assert.ok(key && reach(start).has(key), `${id}: a route to the key with every tile broken`);
      from = key;
    }
    assert.ok(reach(from).has(door), `${id}: a route on to the door with every tile broken`);
    for (const [kind, x, y] of room.items) assert.ok(room.shelves.some(([a, b, top]) => x >= a && x <= b && top === y) || ghoul.groundAt(room, x) === y, `${id}: the ${kind} at ${x} on a surface`);
    for (const s of room.spawns) {
      if (["frozen", "hand", "shade", "zombie"].includes(s[0])) assert.ok(ghoul.groundAt(room, s[1]) > -Infinity, `${id}: the ${s[0]} at ${s[1]} on the floor`);
      if (s[0] === "skel") assert.ok(room.shelves.some(([a, b, top]) => s[1] >= a && s[1] <= b && top === s[2]), `${id}: the skeleton at ${s[1]} on a board`);
      if (s[0] === "hand" || s[0] === "shade" || s[0] === "frozen") assert.ok(!room.thin.some(([a, b]) => s[1] >= a - 1 && s[1] <= b + 1) || s[0] === "frozen", `${id}: the ${s[0]} at ${s[1]} not on a thin tile`);
    }
    assert.equal(ghoul.timeFor(ghoul.roomFor(id)) / 1000 >= 70 || room.boss ? true : false, true, `${id}: a clock`);
  }
  // The widow's boards: a stair of 12 and 18 each side (18 is over the spikes).
  const widow = ghoul.roomById("widow");
  assert.deepEqual(widow.shelves.map((s) => s[2]).sort((a, b) => a - b), [12, 12, 18, 18]);
  assert.ok(widow.length - ghoul.FIELD_W > 30);
});

test("Ghoul Rush's stage select lists the Frozen Lake and takes you straight into each of its rooms with the flare in the bag", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.stageSelect();
  const r = g.round;
  assert.equal(r.phase, "select");
  const at = ghoul.STAGES.findIndex((s) => s.id === "frozen");
  assert.equal(at, ghoul.STAGES.length - 1);
  for (let i = 0; i < at; i++) ghoul.steerSelect(r, 1, 0);
  for (let i = 0; i < 4; i++) ghoul.steerSelect(r, 0, 1);
  assert.equal(r.select.at, at);
  assert.equal(r.select.room, 4);
  ghoul.takeSelect(r);
  assert.equal(r.spec.id, "widow");
  assert.equal(r.stage, "frozen");
  assert.ok(r.arms.some((a) => a.kind === "flare"), "the stage's weapon is in the bag");
  g.tick(16);
  // And its rooms draw (no art of its own yet: the foyer's look stands in), with the hands, shades, ghouls and wraiths about.
  for (let room = 0; room < 3; room++) {
    g.stageSelect();
    for (let i = 0; i < at; i++) ghoul.steerSelect(g.round, 1, 0);
    for (let i = 0; i < room; i++) ghoul.steerSelect(g.round, 0, 1);
    ghoul.takeSelect(g.round);
    g.round.phase = "play";
    for (const kind of ["hand", "shade", "frozen", "icewraith"]) ghoul.spawnMonster(g.round, kind, g.round.you.x + 12, kind === "icewraith" ? 20 : 6, { rise: 0, ...(kind === "icewraith" ? { act: "hover", home: 20 } : {}) });
    assert.doesNotThrow(() => g.tick(16));
    assert.doesNotThrow(() => g.tick(16));
  }
});

test("Ghoul Rush's Frozen Lake events are all named strings, and the game takes each one without a fault (the art and the sounds answer them later)", () => {
  assert.ok(fz.EVENTS.length >= 30 && new Set(fz.EVENTS).size === fz.EVENTS.length);
  const noop = () => {};
  const kit = { tone: noop, burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6 };
  for (const type of fz.EVENTS) assert.doesNotThrow(() => react({ type, x: 10, y: 6, tx: 20, ty: 6, kind: "frostwidow" }, kit), type);
});

/* ---------------------------------------------------- voices and drawing */

const heard = (e, extra = {}) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, ...extra };
  react({ x: 10, y: 6, tx: 20, ty: 6, ...e }, kit);
  return played;
};

test("Ghoul Rush's Frozen Lake: every new kind has a voice for every act, each a real tone, and every event of the pack plays its own sound once (or is silent on purpose)", () => {
  const listed = {
    hand: ["appear", "warn", "grab", "hurt", "die"],
    shade: ["appear", "show", "wind", "lunge", "hurt", "die"],
    frozen: ["appear", "shatter", "melt", "hurt", "die"],
    icewraith: ["wake", "wind", "dive", "chill", "hurt", "die"],
    frostwidow: ["wake", "drop", "rise", "rage", "melt", "up", "gust", "blow", "warn", "spike", "spit", "shot", "land", "call", "kick", "burst", "hurt", "weak", "die"],
    ice: ["crack", "break", "back"],
    flare: ["throw", "land"],
    cocoa: ["active"],
  };
  const merged = ghoulSfx.default.tones;
  for (const [kind, acts] of Object.entries(listed)) {
    assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
    for (const act of acts) assert.ok(merged[VOICES[kind][act]]?.layers?.length, `${kind}.${act}: ${VOICES[kind][act]} is a tone`);
  }
  for (const kind of [...Object.keys(fz.MONSTERS), ...Object.keys(fz.BOSSES)]) assert.ok(VOICES[kind]?.die, `${kind} has a voice and a death`);
  for (const type of [...fz.EVENTS, "flareLand", "flareThrow"]) assert.ok(EVENT_VOICE[type] || SILENT.includes(type), `${type} is heard or silent on purpose`);
  for (const type of Object.keys(EVENT_VOICE)) assert.ok(fz.EVENTS.includes(type) || type === "flareLand", `${type} is an event of the pack`);
  for (const [type, [kind, act]] of Object.entries(EVENT_VOICE)) {
    assert.ok(listed[kind].includes(act), `${type}: ${kind} ${act} is a listed act`);
    const played = heard({ type, kind });
    assert.equal(played.filter((n) => n === VOICES[kind][act]).length, 1, `${type}: ${kind}'s ${act} once`);
    assert.equal(played.length, 1, `${type}: nothing else`);
  }
  for (const type of SILENT) assert.deepEqual(heard({ type }), [], `${type} is silent`);
  const once = (e, kind, act) => assert.equal(heard(e).filter((n) => n === VOICES[kind][act]).length, 1, `${e.type}: ${kind} ${act} once`);
  for (const kind of ["hand", "shade", "frozen"]) once({ type: "spawn", kind }, kind, "appear");
  for (const kind of Object.keys(fz.MONSTERS)) {
    once({ type: "hit", kind }, kind, "hurt");
    once({ type: "kill", kind, mult: 1, how: "shot", points: 1 }, kind, "die");
  }
  once({ type: "bossWake", kind: "frostwidow" }, "frostwidow", "wake");
  once({ type: "bossHit", kind: "frostwidow", how: "shot" }, "frostwidow", "hurt");
  once({ type: "bossHit", kind: "frostwidow", how: "shot", weak: true }, "frostwidow", "weak");
  once({ type: "bossDown", kind: "frostwidow", points: 1 }, "frostwidow", "die");
  once({ type: "power", kind: "cocoa", points: 50 }, "cocoa", "active");
});

test("Ghoul Rush's Frozen Lake: every new way to die has its words and its own sound", () => {
  for (const cause of ["ice", "shard", "spike", "frostwidow", "icewraith", "hand", "frozen", "shade"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Frozen Lake has a look for each room, and a hole in its ice is water drawn over, not a black box", () => {
  for (const id of ROOM_IDS) {
    assert.ok(LOOKS[id]?.custom && LOOKS[id].pack === "frozen" && LOOKS[id].frozen, `${id} has a custom look`);
    assert.equal(LOOKS[id].pit, "rgba(0, 0, 0, 0)", `${id}: the pit is clear`);
  }
});

test("Ghoul Rush's Frozen Lake draws: every room, the ice and thin ice in each stage, the holes, every monster in every act, the Widow in every pose, the hazards, the flare, Hot Cocoa, the blizzard and Planny in ice, lit and dark, and its card on the stage pick", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["frozen"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  const acts = {
    hand: [{ act: "trail" }, { act: "warn", wait: 200 }, { act: "grab", wait: 700 }, { act: "sink", wait: 150 }],
    shade: [{ act: "stalk", prints: [{ x: 30, y: 6, age: 100 }, { x: 33, y: 6, age: 4900 }] }, { act: "stalk", shownMs: 300 }, { act: "wind", wait: 300 }, { act: "lunge", wait: 300 }],
    frozen: [{ dir: -1, sv: 0 }, { dir: 1, sv: 12, lurching: true }],
    icewraith: [{ act: "idle" }, { act: "hover", y: 18 }, { act: "wind", y: 18 }, { act: "dive", vx: -20, vy: -10, y: 14 }],
  };
  for (const id of ROOM_IDS) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      r.dark = dark;
      r.phase = "play";
      r.lives = 99;
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      r.hazards.length = 0;
      standAt(r, id === "widow" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
      r.you.safeMs = 1e9;
      ghoul.advance(r, 8, steady);
      for (const [kind, list] of Object.entries(acts)) list.forEach((over, i) => put(r, kind, r.you.x + 6 + i * 5, { wait: 1e9, force: true, ...over }));
      if (r.thin) {
        const states = [{ t: 100 }, { t: 800, state: "crack" }, { t: 1300, state: "broken", back: 900 }, { t: 0, state: "broken", back: 5000 }];
        r.thin.tiles.forEach((tl, i) => Object.assign(tl, states[i % states.length]));
      }
      for (const h of [{ kind: "shard", x: r.you.x + 20, y: 6, off: 0, vx: 26, w: 1.8, h: 1.3, warn: 100, life: 650 }, { kind: "shard", x: r.you.x + 24, y: 8.8, off: 2.8, vx: -26, w: 1.8, h: 1.2, warn: 0, life: 650 }, { kind: "spike", x: r.you.x + 28, y: 6, w: 4, h: 9.5, warn: 300, up: 1000 }, { kind: "spike", x: r.you.x + 33, y: 6, w: 4, h: 9.5, warn: 0, up: 1000, live: 700 }, { kind: "webGlob", x: r.you.x + 12, y: 14, vx: -10, vy: -3, spin: 1, life: 1500, w: 1.6, h: 1.6 }, { kind: "webPatch", x: r.you.x + 16, y: 6, life: 3000, max: 6000, w: 5, h: 0.8 }, { kind: "barrel", x: r.you.x + 8, y: 6, state: "still", vx: 0, roll: 0, life: 5000, hit: [], w: 3, h: 3.4 }, { kind: "barrel", x: r.you.x + 10, y: 6, state: "roll", vx: 34, roll: 2, life: 5000, hit: [], w: 3, h: 3.4 }, { kind: "armRoadFlare", x: r.you.x + 14, y: 12, vx: 20, vy: 5, spin: 1, rest: false, t: 0, w: 0.8, h: 0.8 }, { kind: "armRoadFire", x: r.you.x + 18, y: 6, life: 3000, max: 4000, tick: 0, bossDone: 0, w: 6, h: 5 }]) r.hazards.push({ cause: "x", live: 0, ...h });
      r.effects.cocoa = 5000;
      for (const heldMs of [0, 500, 100]) {
        r.you.heldMs = heldMs;
        for (const wind of [null, { state: "warn", ms: 500, dir: 1 }, { state: "blow", ms: 1500, dir: -1 }]) {
          if (r.twist && wind) r.twist.wind = wind;
          assert.doesNotThrow(() => g.tick(16));
        }
      }
      if (r.boss) {
        ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
        const f = r.boss.floor;
        for (const pose of [{ act: "hang", y: f + 20 }, { act: "drop", y: f + 8, toX: r.boss.x - 10, wait: 300 }, { act: "low", y: f }, { act: "low", y: f, veil: false, veilMs: 3000, mouth: true }, { act: "low", y: f, veil: false, veilMs: 400, spitWind: 300 }, { act: "rise", y: f + 10, raged: true }, { act: "low", y: f, hurt: 100 }]) {
          Object.assign(r.boss, { wait: 1e9, lowMs: 1e9, ...pose });
          assert.doesNotThrow(() => g.tick(16));
        }
      }
      r.you.safeMs = 1e9;
    }
  }
  assert.equal(r.spec.id, "widow", "got to the Widow's Web and drew it");
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.key("action");
  pick.tick(16);
  const p = pick.round;
  through(p);
  p.offer = ["frozen", "carnival"];
  p.phase = "pick";
  p.phaseMs = 0;
  for (let k = 0; k < 4; k++) pick.tick(16);
  assert.equal(p.phase, "pick", "the pick screen draws the Frozen Lake's card");
});
