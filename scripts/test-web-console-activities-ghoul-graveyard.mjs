// Web console tests, Ghoul Rush's Graveyard stage: its four rooms, grasping hands, mourners and their wail, grave robbers, rotters and the legs they leave, carrion crows, the graves rotters climb out of, and Mother Mourning, who can only be hurt while she watches and drops a stone fist on whatever moves.
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as gy from "../src/web-console/public/activities/ghoul-rush/stages/graveyard/ghoul-graveyard.js";
import { VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Graveyard's room `id`, reached the way play reaches it,
// nothing woken: every spawner spent, the horde held back.
function graveRound(id) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["graveyard"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== id) through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.events.length = 0;
  return round;
}

function standAt(round, x) {
  Object.assign(round.you, { x, y: ghoul.groundAt(round.spec, x), vx: 0, vy: 0, state: "run", shelf: -1, coyote: 0, drop: -1, out: 0, safeMs: 0, face: 1 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

const put = (round, kind, x, over = {}) => ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), { rise: 0, ...over });

function run(round, ms, keys = {}) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, steady);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

test("Ghoul Rush's Graveyard is a stage of three rooms, the Midnight Hearse bonus ride (its own suite: ghoul-hearse) and Mother Mourning's, its monsters and boss joined to the game's", () => {
  const st = ghoul.stageById("graveyard");
  assert.deepEqual(st.rooms, ["lychgate", "graves", "mausoleums", "hearse", "angel"]);
  assert.equal(st.boss, "angel");
  for (const kind of Object.keys(gy.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], gy.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.BOSSES.angel, gy.BOSSES.angel);
  assert.ok(ghoul.ZOMBIES.has("rotter"), "a rotter is a zombie in all but its death");
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
});

test("Ghoul Rush's graves let out rotters, a door's fifth entry naming what comes out", () => {
  const round = graveRound("lychgate");
  const at = round.spec.spawns.findIndex((s) => s[0] === "door");
  assert.equal(round.spec.spawns[at][4], "rotter");
  round.spawns[at].over = false;
  standAt(round, round.spec.spawns[at][1] - 30);
  round.you.safeMs = 1e9;
  run(round, 1200);
  assert.ok(round.monsters.some((m) => m.kind === "rotter" && m.door), "a rotter out of the grave");
});

test("Ghoul Rush's grasping hands lie unseen under the dirt, burst up as you come near, grab, sink, and creep under the ground after you, never across a pit", () => {
  const round = graveRound("lychgate");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const h = put(round, "hands", 60);
  assert.equal(h.act, "lurk");
  assert.equal(ghoul.solid(h), false, "unseen under the dirt");
  run(round, 200);
  assert.equal(h.act, "lurk", "nothing while you are far");
  standAt(round, 60 - gy.HANDS_NEAR + 2);
  round.you.safeMs = 1e9;
  run(round, 8);
  assert.equal(h.act, "rise");
  assert.equal(events(round, "grab").length, 1);
  assert.equal(ghoul.solid(h), false, "harmless while it comes up");
  run(round, gy.HANDS_RISE_MS);
  assert.equal(h.act, "grab");
  assert.equal(ghoul.solid(h), true, "up, it can hurt and be hit");
  run(round, gy.HANDS_UP_MS + gy.HANDS_SINK_MS);
  assert.equal(h.act, "creep");
  assert.equal(ghoul.solid(h), false);
  const x0 = h.x;
  standAt(round, 30);
  round.you.safeMs = 1e9;
  run(round, 600);
  assert.ok(h.x < x0 - 3, `it creeps toward you (${x0} to ${h.x.toFixed(1)})`);
  // The Lychgate's first floor ends in a pit at 110: hands creeping after
  // you across it stop at its edge.
  const r2 = graveRound("lychgate");
  standAt(r2, 130);
  r2.you.safeMs = 1e9;
  const h2 = put(r2, "hands", 100, { act: "creep", wait: 1e9 });
  run(r2, 3000);
  assert.ok(h2.x < 110, `stopped at the pit (${h2.x.toFixed(1)})`);
});

test("Ghoul Rush's mourner lifts her veil and wails now and then, slowing you to half speed for a while if you are close", () => {
  const round = graveRound("lychgate");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const m = put(round, "mourner", 46);
  m.throwIn = 10;
  run(round, 40);
  assert.equal(events(round, "wailWind").length, 1, "the veil lifts");
  run(round, gy.WAIL_WIND_MS);
  const wail = events(round, "wail")[0];
  assert.ok(wail && wail.close, "a wail, close");
  assert.ok(round.you.slowMs > gy.SLOW_MS - 100, "you are slowed");
  // Slowed, you run at SLOW_SHARE of your speed.
  const r2 = graveRound("lychgate");
  standAt(r2, 20);
  r2.you.safeMs = 1e9;
  run(r2, 400, { right: true });
  const free = r2.you.x - 20;
  standAt(r2, 20);
  r2.you.safeMs = 1e9;
  r2.you.slowMs = 5000;
  run(r2, 400, { right: true });
  const slow = r2.you.x - 20;
  assert.ok(Math.abs(slow - free * gy.SLOW_SHARE) < 0.5, `half speed (${slow.toFixed(1)} of ${free.toFixed(1)})`);
  // Out of reach, a wail slows nothing.
  const r3 = graveRound("lychgate");
  standAt(r3, 20);
  r3.you.safeMs = 1e9;
  const far = put(r3, "mourner", 20 + gy.WAIL_REACH + 8);
  far.throwIn = 10;
  far.speed = 0;
  run(r3, 40 + gy.WAIL_WIND_MS);
  assert.equal(events(r3, "wail")[0]?.close, false);
  assert.ok(!(r3.you.slowMs > 0));
});

test("Ghoul Rush's grave robber walks at you, digs in close, and comes up behind you, out of reach of your bolts while under the ground", () => {
  const round = graveRound("graves");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const m = put(round, "robber", 30 + gy.ROBBER_DIG - 2);
  assert.equal(ghoul.solid(m), true, "walking, it can be hit");
  run(round, 20);
  assert.equal(m.act, "dig");
  assert.equal(events(round, "dig").length, 1);
  assert.equal(ghoul.solid(m), false, "digging in, it cannot");
  run(round, gy.DIG_MS + 2000);
  assert.ok(events(round, "unearth").length >= 1, "it comes up");
  const up = events(round, "unearth")[0];
  assert.ok(up.x < round.you.x, `behind you, facing right (${up.x.toFixed(1)} vs ${round.you.x})`);
});

test("Ghoul Rush's rotter shot down at the body leaves its legs walking after you; a headshot or a stomp finishes it", () => {
  const body = graveRound("lychgate");
  standAt(body, 20);
  const r = put(body, "rotter", 40);
  ghoul.kill(body, r, "shot", steady);
  assert.equal(events(body, "legs").length, 1);
  const legs = body.monsters.find((m) => m.kind === "legs");
  assert.ok(legs, "its legs");
  body.you.safeMs = 1e9;
  const x0 = legs.x;
  run(body, 300);
  assert.ok(legs.x < x0 - 3, "walking at you");
  for (const how of ["head", "stomp", "crush"]) {
    const round = graveRound("lychgate");
    standAt(round, 20);
    ghoul.kill(round, put(round, "rotter", 40), how, steady);
    assert.equal(round.monsters.filter((m) => m.kind === "legs").length, 0, `none after a ${how}`);
  }
});

test("Ghoul Rush's carrion crow waits on its headstone till you come near, then dives at your chest and climbs away to dive again", () => {
  const round = graveRound("lychgate");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const c = put(round, "crow", 20 + gy.CROW_NEAR + 10, { y: 10 });
  assert.equal(c.act, "perch");
  run(round, 300);
  assert.equal(c.act, "perch", "still while you are far");
  standAt(round, c.x - gy.CROW_NEAR + 4);
  round.you.safeMs = 1e9;
  run(round, 8);
  assert.equal(events(round, "caw").length, 1);
  run(round, 600);
  assert.ok(events(round, "dive").length >= 1);
  assert.ok(c.act === "dive" || c.act === "climb");
  const dived = events(round, "dive")[0];
  assert.ok(dived.x > round.you.x, "from ahead of you");
});

/* --------------------------------------------------------- the angel */

// The Angel's Rest arena, you in it, Mother Mourning awake.
function angelFight() {
  const round = graveRound("angel");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  round.you.safeMs = 0;
  round.events.length = 0;
  return round;
}

const shoot = (round) => {
  const b = round.boss;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 6, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
};

test("Mother Mourning weeps as stone: shots and stomps glance off her while she weeps (and turns), and she flings headstones", () => {
  const round = angelFight();
  const b = round.boss;
  assert.equal(b.act, "weep");
  const hp = b.hp;
  shoot(round);
  assert.equal(b.hp, hp, "no harm while she weeps");
  assert.equal(events(round, "bossBlock").length, 1);
  round.you.safeMs = 1e9;
  run(round, gy.ANGEL_THROW_MS * 1.5);
  assert.ok(events(round, "throw").some((e) => e.kind === "stone" && e.by === "angel"), "a headstone flung");
  // Standing on her head while she weeps does her no harm either.
  const r2 = angelFight();
  const b2 = r2.boss;
  Object.assign(r2.you, { x: b2.x, y: b2.y + b2.h + 0.3, vy: -20, state: "air", safeMs: 1e9 });
  ghoul.advance(r2, 40, steady);
  assert.equal(b2.hp, b2.max);
  assert.ok(events(r2, "bossBlock").length >= 1);
});

test("Mother Mourning turns and watches: stand still and she can be hurt; move and a stone fist comes down where you are, its shadow first", () => {
  const round = angelFight();
  const b = round.boss;
  round.you.safeMs = 1e9;
  run(round, b.wait + 8);
  assert.equal(b.act, "turn");
  assert.equal(events(round, "angelTurn").length, 1);
  run(round, gy.ANGEL_TURN_MS + 8);
  assert.equal(b.act, "watch");
  round.you.safeMs = 0;
  // Still: no fist, and a shot hurts her.
  run(round, 300);
  assert.equal(round.hazards.length, 0, "standing still is safe");
  const hp = b.hp;
  shoot(round);
  assert.equal(b.hp, hp - 1, "while she watches, she can be hurt");
  assert.equal(events(round, "bossHit")[0].kind, "angel", "the hit names her");
  // Moving: a fist's shadow where you are, then the fist.
  run(round, 40, { right: true });
  assert.equal(events(round, "angelSee").length, 1);
  assert.equal(round.hazards.length, 1);
  const fist = round.hazards[0];
  assert.ok(Math.abs(fist.x - round.you.x) < 2, "over you");
  assert.ok(fist.warn > 0, "its shadow first");
  run(round, gy.FIST_WARN_MS);
  assert.ok(events(round, "fist").length === 1, "down it comes");
  assert.equal(events(round, "lose")[0]?.cause, "fist", "and you were still under it");
});

test("Mother Mourning at half her hp spreads her wings: a shorter weep, the same watch, and a shockwave each way as each weep begins", () => {
  const round = angelFight();
  const b = round.boss;
  round.you.safeMs = 1e9;
  const calmWeep = b.wait;
  b.hp = Math.floor(b.max * gy.ANGEL_RAGE);
  run(round, 8);
  assert.equal(events(round, "angelWings").length, 1);
  run(round, b.wait + gy.ANGEL_TURN_MS + 16);
  assert.equal(b.act, "watch");
  assert.ok(b.wait <= gy.ANGEL_WATCH_MS, "the watch no longer grows");
  round.waves.length = 0;
  run(round, b.wait + 8);
  assert.equal(b.act, "weep");
  assert.ok(b.wait < calmWeep, "a shorter weep");
  assert.deepEqual(round.waves.map((w) => w.dir).sort(), [-1, 1], "a shockwave each way");
});

test("Mother Mourning is tougher: more hp, a shorter watch, and a quicker fist (a shorter shadow and gap)", () => {
  assert.equal(gy.BOSSES.angel.hp, 85);
  assert.equal(angelFight().boss.max, 85);
  assert.ok(gy.ANGEL_WATCH_MS <= 1600);
  assert.ok(gy.FIST_WARN_MS <= 440 && gy.FIST_GAP_MS <= 570);
  const round = angelFight();
  const b = round.boss;
  round.you.safeMs = 1e9;
  run(round, b.wait + gy.ANGEL_TURN_MS + 16);
  assert.equal(b.act, "watch");
  assert.ok(b.wait <= gy.ANGEL_WATCH_MS && b.wait > gy.ANGEL_WATCH_MS - 100, `watches about ${gy.ANGEL_WATCH_MS} ms (${b.wait})`);
});

test("Mother Mourning moves when you are not looking: each time she turns back to watch she has blinked a few units nearer, never onto you or out of the arena, with stone dust", () => {
  const blinkFrom = (youX, herX) => {
    const round = angelFight();
    const b = round.boss;
    round.you.safeMs = 1e9;
    if (herX !== undefined) b.x = herX;
    standAt(round, youX);
    round.you.safeMs = 1e9;
    Object.assign(b, { act: "turn", wait: 0 });
    const x0 = b.x;
    run(round, 8);
    return { round, b, x0 };
  };
  const near = blinkFrom(120);
  assert.equal(near.b.act, "watch");
  assert.ok(Math.abs(near.b.x - (near.x0 - gy.BLINK_STEP)) < 0.01, `blinked ${gy.BLINK_STEP} nearer (${near.x0} to ${near.b.x})`);
  const ev = events(near.round, "angelBlink");
  assert.equal(ev.length, 1);
  assert.ok(ev[0].x === near.x0 && ev[0].tx === near.b.x, "the dust at both ends");
  assert.equal(near.b.y, ghoul.groundAt(near.round.spec, near.b.x), "still on the floor");
  // Close to you she stops short of BLINK_KEEP, and never goes past you.
  const close = blinkFrom(150, 150 + gy.BLINK_KEEP + 2);
  assert.ok(close.b.x - 150 >= gy.BLINK_KEEP - 0.01, `kept her distance (${close.b.x - 150})`);
  const on = blinkFrom(150, 150 + gy.BLINK_KEEP - 4);
  assert.equal(on.b.x, on.x0, "already too close: she stays");
  assert.equal(events(on.round, "angelBlink").length, 0);
  // At the arena's wall she stays inside it.
  const wall = blinkFrom(106, 104 + 6 + gy.BOSSES.angel.w / 2 + 0.2);
  assert.ok(wall.b.x >= 104 + 6 + gy.BOSSES.angel.w / 2 - 0.01, "inside the arena");
  // Over many turns she creeps nearer but never reaches you, and she never harms you by arriving.
  const creep = angelFight();
  creep.you.safeMs = 1e9;
  standAt(creep, 110);
  creep.you.safeMs = 1e9;
  const x0 = creep.boss.x;
  for (let i = 0; i < 6; i++) {
    Object.assign(creep.boss, { act: "turn", wait: 0 });
    run(creep, 8);
  }
  assert.ok(creep.boss.x < x0 - 10, "creeping nearer");
  assert.ok(creep.boss.x - creep.you.x >= gy.BLINK_KEEP - 0.01);
  // She can still be hurt right after she blinks.
  const hurt = angelFight();
  hurt.you.safeMs = 1e9;
  Object.assign(hurt.boss, { act: "turn", wait: 0 });
  run(hurt, 8);
  const hp = hurt.boss.hp;
  shoot(hurt);
  assert.equal(hurt.boss.hp, hp - 1);
});

test("Mother Mourning in her rage throws two headstones at a time, and while she watches a fist also falls near you now and then even if you stand still, its shadow first", () => {
  const throws = (rage) => {
    const round = angelFight();
    const b = round.boss;
    round.you.safeMs = 1e9;
    if (rage) b.hp = Math.floor(b.max * gy.ANGEL_RAGE);
    b.throwIn = 1;
    run(round, 8);
    return events(round, "throw").filter((e) => e.by === "angel").length;
  };
  assert.equal(throws(false), 1);
  assert.equal(throws(true), 2);
  const calm = angelFight();
  calm.you.safeMs = 1e9;
  Object.assign(calm.boss, { act: "watch", wait: 1e9, rainIn: 100 });
  run(calm, 3000);
  assert.equal(calm.hazards.length, 0, "before her rage, standing still is safe");
  const round = angelFight();
  const b = round.boss;
  b.hp = Math.floor(b.max * gy.ANGEL_RAGE);
  Object.assign(b, { act: "watch", wait: 1e9, rainIn: 100 });
  round.you.safeMs = 1e9;
  run(round, 120);
  assert.equal(round.hazards.length, 1, "a fist with nobody moving");
  const fist = round.hazards[0];
  assert.ok(Math.abs(fist.x - round.you.x) <= gy.RAIN_NEAR + 0.01, "near you");
  assert.ok(fist.warn > 0 && fist.live === 0, "its shadow first");
  assert.equal(events(round, "angelSee").length, 0, "you did not move");
  run(round, gy.FIST_WARN_MS + 8);
  assert.equal(events(round, "fist").length, 1, "down it comes");
  // It keeps falling about every RAIN_MS, at random spots near you.
  const many = angelFight();
  many.boss.hp = Math.floor(many.boss.max * gy.ANGEL_RAGE);
  Object.assign(many.boss, { act: "watch", wait: 1e9, rainIn: gy.RAIN_MS });
  many.you.safeMs = 1e9;
  let spots = new Set();
  for (let t = 0; t < gy.RAIN_MS * 6; t += 4) {
    ghoul.advance(many, 4, () => Math.random());
    for (const h of many.hazards) spots.add(h.x.toFixed(2));
  }
  assert.ok(spots.size >= 4 && spots.size <= 7, `about six fists (${spots.size})`);
  // Standing under one costs a life, named for the fist.
  const under = angelFight();
  under.boss.hp = Math.floor(under.boss.max * gy.ANGEL_RAGE);
  Object.assign(under.boss, { act: "watch", wait: 1e9, rainIn: 10 });
  run(under, 20 + gy.FIST_WARN_MS + 40);
  assert.equal(events(under, "lose")[0]?.cause, "fist");
  // Endless lives spare it.
  const endless = angelFight();
  endless.infinite = true;
  endless.boss.hp = Math.floor(endless.boss.max * gy.ANGEL_RAGE);
  Object.assign(endless.boss, { act: "watch", wait: 1e9, rainIn: 10 });
  const lives = endless.lives;
  run(endless, 20 + gy.FIST_WARN_MS + 40);
  assert.equal(endless.lives, lives);
});

test("Mother Mourning's blink reads: stone dust and a callout, no picked sound beyond the house boom", () => {
  const played = [];
  const floats = [];
  const bursts = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: (...a) => bursts.push(a), float: (x, y, t) => floats.push(t), ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {} };
  react({ type: "angelBlink", kind: "angel", x: 150, y: 8, tx: 145 }, kit);
  assert.equal(bursts.length, 2, "dust at both ends");
  assert.deepEqual(floats, ["She moved"]);
  const names = Object.values(VOICES.angel);
  assert.equal(played.filter((n) => names.includes(n)).length, 0, "no voice doubled up");
  assert.deepEqual(played, ["boom"]);
});

test("Mother Mourning falls: the door opens and every hazard is gone", () => {
  const round = angelFight();
  const b = round.boss;
  b.act = "watch";
  b.wait = 1e9;
  b.hp = 1;
  round.hazards.push({ kind: "fist", x: 150, y: 6, w: 6, h: 9, warn: 300, live: 0, cause: "fist" });
  shoot(round);
  assert.equal(b.state, "down");
  assert.equal(round.hasKey, true);
  assert.equal(round.hazards.length, 0);
});

test("Ghoul Rush: a hit on any boss plays that boss's own hurt sound, and the Graveyard's monsters and Mother Mourning each have their own voice for every act", () => {
  for (const kind of Object.keys(ghoul.BOSSES)) {
    const played = [];
    const fx = { clock: 1e6 };
    const noop = () => {};
    const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {} };
    react({ type: "bossHit", kind, x: 0, y: 0, how: "shot" }, kit);
    assert.ok(played.includes(VOICES[kind].hurt), `${kind}: ${VOICES[kind].hurt}`);
  }
  const own = { hands: ["appear", "grab", "hurt", "die"], mourner: ["appear", "wail", "hurt", "die"], robber: ["appear", "dig", "unearth", "hurt", "die"], rotter: ["appear", "climb", "hurt", "die"], legs: ["appear", "die"], crow: ["wake", "dive", "hurt", "die"], angel: ["wake", "weep", "watch", "see", "slam", "wings", "hurt", "die"] };
  for (const [kind, acts] of Object.entries(own)) {
    assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
    for (const act of acts) assert.match(VOICES[kind][act], new RegExp(`^ghoul${kind[0].toUpperCase()}${kind.slice(1)}`), `${kind}.${act} is its own`);
  }
});
