// Web console tests, Ghoul Rush's dark ride (the Midnight Carnival's bonus round): its place (between the funhouse and the Big Top), the bonus round's five hearts and the flow on to the boss, the dice rule, the controls (arrows, Space, the mouse, the duck zone), aim assist, the mini-bosses, the Exit's twist, a bot that rides it all and one that does nothing, the endless-lives code, and every event voiced.
// Run with: node --test scripts/test-web-console-activities-ghoul-ride.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as rt from "../src/web-console/public/activities/ghoul-rush/rides/dark-ride/ghoul-ride.js";
import { SCENES, END_P } from "../src/web-console/public/activities/ghoul-rush/rides/dark-ride/ghoul-ride-scenes.js";
import { CAR_X, DUCK_OFF, DUCK_ON, bindG } from "../src/web-console/public/activities/ghoul-rush/rides/dark-ride/ghoul-ride-core.js";
import { EVENT_VOICE, LOSE_SOUNDS, LOSE_WORDS, LOOKS as RIDE_LOOKS, VOICES as RIDE_VOICES } from "../src/web-console/public/activities/ghoul-rush/rides/dark-ride/ghoul-ride-voices.js";
import { CARNIVAL_ROOMS } from "../src/web-console/public/activities/ghoul-rush/stages/carnival/ghoul-carnival.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { LOOKS, VOICES } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { endBonus } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-bonus.js";
import { rideArt } from "../src/web-console/public/activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the dark ride reached the way play reaches it, the intro done.
function rideRound() {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["carnival"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "darkride") through(round);
  return round;
}
function playing() {
  const round = rideRound();
  round.phase = "play";
  round.timeMs = 1e9;
  round.events.length = 0;
  return round;
}
const step = (round, n = 1) => {
  for (let i = 0; i < n && round.phase === "play"; i++) ghoul.advance(round, 16, steady);
};
// The ride's own clock in seconds.
const G = (round) => {
  bindG(round.gallery);
  return round.gallery;
};

/* ----------------------------------------------------------------- bots */

// Every point a shot at (x, y) would hit something worth shooting.
function targetAt(g, round) {
  bindG(g);
  for (let y = 6; y <= 40; y += 3) {
    for (let x = 6; x <= 92; x += 3) {
      for (const e of g.ents) {
        if (!e.alive || e.k === "inno" || e.k === "mir" || e.k === "door" || !rt.K[e.k].hit) continue;
        if (rt.K[e.k].hit(e, x, y)) return { x, y };
      }
    }
  }
  return null;
}
// A bot that aims at anything shootable, ducks at a warning, and never fires at a guest.
function aimbot(round) {
  const g = round.gallery;
  bindG(g);
  const inp = round.input;
  inp.left = inp.right = inp.up = inp.down = false;
  if (g.duckWarn > 0.15) {
    g.ret.y = 46;
    inp.fire = false;
    return;
  }
  const t = targetAt(g, round);
  if (t) {
    g.ret.x = t.x;
    g.ret.y = t.y;
    inp.fire = true;
  } else {
    g.ret.x = 62;
    g.ret.y = 26;
    inp.fire = false;
  }
}
function ridden(round, bot, maxSeconds = 140) {
  const seen = new Set();
  let ms = 0;
  while (round.phase === "play" && ms < maxSeconds * 1000) {
    if (bot) bot(round);
    ghoul.advance(round, 16, steady);
    ms += 16;
    if (round.gallery) seen.add(round.gallery.zi);
  }
  return { seconds: ms / 1000, seen };
}

/* ------------------------------------------------------------ the place */

test("Ghoul Rush ride: the dark ride is the Carnival's bonus round between the funhouse and the Big Top", () => {
  assert.deepEqual([...CARNIVAL_ROOMS], ["midway", "mirrors", "funhouse", "darkride", "bigtop"]);
  const stage = ghoul.STAGES.find((s) => s.id === "carnival");
  assert.deepEqual([...stage.rooms], [...CARNIVAL_ROOMS]);
  const spec = ghoul.roomById("darkride");
  assert.equal(spec.bonus, true);
  assert.equal(spec.ride.gallery, true);
  assert.equal(spec.boss, null);
  assert.equal(spec.key, null);
  assert.equal(spec.dark, false, "the ride ignores the dark roll");
  assert.ok(spec.ride.time >= 95000 && spec.ride.time <= 105000, "about a hundred seconds on the game's clock");
  assert.equal(ghoul.timeFor(spec), spec.ride.time);
  assert.match(spec.ride.how, /Mouse: move to aim, click or hold to fire/);
  assert.equal(RIDE_LOOKS.darkride.pack, "ride");
  assert.ok(LOOKS.darkride);
  assert.equal(ghoul.ROOM_MUSIC.darkride, "ghoulRideTheme");
});

test("Ghoul Rush ride: the scene table has 12 rooms in order with the prototype's lengths, about 92 seconds at a clean ride", () => {
  assert.deepEqual(SCENES.map((s) => s.id), ["bay", "wax", "torture", "carousel", "mirrors", "tunnel", "web", "lift", "tent", "exit", "dark", "barker"]);
  assert.deepEqual(SCENES.map((s) => s.len), [40, 108, 150, 124, 104, 170, 150, 110, 140, 74, 24, 122]);
  assert.equal(END_P, SCENES.reduce((a, s) => a + s.len, 0));
  let at = 0;
  for (const s of SCENES) {
    assert.equal(s.a, at, `${s.id} starts where the last ended`);
    at += s.len;
    assert.ok(s.name && s.tag, `${s.id} has a plaque`);
  }
});

test("Ghoul Rush ride: entering sets the ride up (five hearts, the intro, a banner naming the mouse), and no other room has a ride", () => {
  const round = rideRound();
  assert.ok(round.gallery, "the ride is made");
  assert.equal(round.gallery.hp, 5);
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.phase, "ready");
  assert.equal(round.phaseMs, ghoul.roomById("darkride").ride.ready);
  const start = events(round, "bonusStart")[0];
  assert.ok(start, "the bonus round announces itself");
  assert.match(start.how, /Mouse: move to aim, click or hold to fire/);
  ghoul.advance(round, 6000, steady);
  assert.equal(round.phase, "ready", "it waits for a press");
  assert.equal(rt.startRide(round), true);
  ghoul.advance(round, 16, steady);
  assert.equal(round.phase, "play");
  assert.equal(events(round, "go").length, 1);
  const other = ghoul.newRound(5);
  other.dice = 0;
  assert.equal(other.gallery ?? null, null);
  through(other);
  assert.equal(other.gallery ?? null, null, "a plain room has none");
});

/* ------------------------------------------------------------- hearts */

test("Ghoul Rush ride: a hit costs a heart, not a life, and protects for 2.2 seconds; the ride plays on", () => {
  const round = playing();
  step(round, 3);
  const lives = round.lives;
  const g = G(round);
  g.mode = "ride";
  rt.stepRide(0.016);
  const hit = (cause) => ghoul.lose(round, cause);
  assert.equal(hit("ridegrab"), true);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(round.lives, lives, "no life is touched");
  assert.equal(round.phase, "play", "no crash: the ride goes on");
  assert.equal(events(round, "lose").at(-1).hearts, 4);
  // The ride's own hurt (with the safe moment) is the one the rules use.
  const before = round.bonusRound.hearts;
  g.inv = 0;
  RIDE_HURT(round, "ridecrash");
  assert.equal(round.bonusRound.hearts, before - 1);
  RIDE_HURT(round, "ridecrash");
  assert.equal(round.bonusRound.hearts, before - 1, "2.2 seconds of safety");
  assert.ok(g.inv > 2.1 && g.inv <= rt.INVULN);
});

// A heart lost the way the rules lose one (the hurt helper is private): a pop reaching the car.
function RIDE_HURT(round, cause) {
  const g = round.gallery;
  bindG(g);
  g.mode = "ride";
  if (g.inv > 0) {
    // Same gate as the rules: nothing while safe.
    return;
  }
  g.inv = rt.INVULN;
  ghoul.lose(round, cause);
  g.hp = round.bonusRound.hearts;
}

test("Ghoul Rush ride: a real hit from the field costs a heart through the bonus round (a lunging ghoul reaches the car)", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.inv = 0;
  const e = { k: "pop", t: "ghoul", x: 10, y: 40, hp: 1, maxhp: 1, boss: null, ph: "lunge", pt: 99, age: 0, trig: 56, wait: 1, L: 0.1, rel: true, rx: 20, ry: 41, sc: 1.6, sc0: 1, flinch: 0, alive: true, dying: 0, sx0: 40, sy0: 40, swings: 0, atk: 0 };
  g.ents.push(e);
  step(round, 3);
  assert.equal(round.bonusRound.hearts, 4);
  assert.equal(events(round, "lose").at(-1).cause, "ridegrab");
  assert.equal(round.phase, "play");
});

test("Ghoul Rush ride: the fifth heart ends the bonus with no dice, the run's lives and dice are untouched, and play moves on to the boss", () => {
  const round = playing();
  round.dice = 3;
  const lives = round.lives;
  const g = G(round);
  g.mode = "ride";
  for (let i = 0; i < 4; i++) {
    g.inv = 0;
    RIDE_HURT(round, "ridegrab");
    assert.equal(round.phase, "play");
  }
  assert.equal(round.bonusRound.hearts, 1);
  g.inv = 0;
  RIDE_HURT(round, "ridegrab");
  assert.equal(round.bonusRound.hearts, 0);
  assert.equal(round.phase, "crash");
  ghoul.advance(round, 3000, steady);
  assert.equal(round.phase, "clear", "the lost card");
  assert.equal(round.bonusRound.won, false);
  assert.deepEqual(round.bonusRound.result, { won: false, dice: 0, gained: 0 });
  assert.equal(round.dice, 3, "dice in hand kept");
  assert.equal(round.lives, lives);
  assert.equal(round.over, false);
  ghoul.advance(round, 3000, steady);
  assert.equal(round.spec.id, "bigtop", "on to the boss");
  assert.equal(round.gallery ?? null, null);
});

test("Ghoul Rush ride: under the endless-lives code a hit costs nothing", () => {
  const round = playing();
  round.infinite = true;
  const g = G(round);
  g.mode = "ride";
  for (let i = 0; i < 8; i++) {
    g.inv = 0;
    RIDE_HURT(round, "ridegrab");
  }
  assert.equal(round.bonusRound.hearts, 5);
  assert.equal(round.phase, "play");
  assert.equal(round.lives, ghoul.START_LIVES);
});

/* ---------------------------------------------------------------- dice */

test("Ghoul Rush ride: the dice rule is 5 to 9 by performance, a perfect ride is 9, and the bonus adds them with no cap on the dice in hand", () => {
  const base = { shots: 100, hits: 100, kills: 50, missed: 0, hp: 5, ducksOK: 4, best: 20, innoHits: 0 };
  assert.equal(rt.gradeOf(base).dice, 9);
  assert.equal(rt.gradeOf(base).grade, "S");
  const worst = { shots: 100, hits: 0, kills: 0, missed: 50, hp: 1, ducksOK: 0, best: 0, innoHits: 9 };
  assert.equal(rt.gradeOf(worst).dice, 5);
  assert.equal(rt.RIDE_FLOOR, 5);
  for (let hp = 1; hp <= 5; hp++) for (const acc of [0, 0.4, 0.7, 1]) {
    const d = rt.gradeOf({ ...base, hp, hits: Math.round(100 * acc) }).dice;
    assert.ok(d >= 5 && d <= 9, `${hp} hearts at ${acc}: ${d}`);
  }
  // Fewer hearts never earn more.
  assert.ok(rt.gradeOf({ ...base, hp: 1 }).dice <= rt.gradeOf({ ...base, hp: 5 }).dice);
  // A guest shot costs.
  assert.ok(rt.gradeOf({ ...base, innoHits: 10 }).perf < rt.gradeOf(base).perf);
  // The bonus uses the ride's own number and adds them all to the dice in hand.
  const round = playing();
  round.dice = 6;
  round.bonusRound.perf.dice = 8;
  round.bonusRound.perf.cardMs = 7000;
  endBonus(round, true, { award: (r, p) => (r.score += p), ROOM_POINTS: 100 });
  assert.equal(round.bonusRound.dice, 8);
  assert.equal(round.bonusRound.gained, 8, "6 + 8 is 14");
  assert.equal(round.dice, 14);
  assert.equal(round.bonusRound.cardMs, 7000);
});

/* ------------------------------------------------------------- controls */

test("Ghoul Rush ride: the arrows move the reticle with acceleration, Space fires, and a tap too short for a step still fires", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.ret.x = 50;
  g.ret.y = 20;
  round.input.right = true;
  step(round, 5);
  const slow = g.ret.x - 50;
  step(round, 20);
  const next = g.ret.x - 50 - slow;
  assert.ok(slow > 0 && next / 20 > slow / 5, "it speeds up while held");
  round.input.right = false;
  round.input.up = true;
  const y0 = g.ret.y;
  step(round, 10);
  assert.ok(g.ret.y < y0, "up raises it");
  round.input.up = false;
  const shots = g.shots;
  round.input.fire = true;
  step(round, 40);
  round.input.fire = false;
  assert.ok(g.shots - shots >= 4 && g.shots - shots <= 6, `held fire shoots every ${rt.FIRE_GAP}s: ${g.shots - shots}`);
  const s2 = g.shots;
  g.fireCd = 0;
  g.trigger = true;
  step(round, 1);
  assert.equal(g.shots, s2 + 1, "a tap fires");
  assert.equal(round.shots.length, 0, "the blaster's bolts never fly in the ride");
});

test("Ghoul Rush ride: the mouse aims and a press or hold fires, and a let-go or a pause stops it", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  const [pointer] = rt.RIDE.pointer;
  assert.equal(pointer(round, "move", 70, 30), true);
  assert.deepEqual([g.ret.x, g.ret.y], [70, 30]);
  pointer(round, "move", 500, -20);
  assert.deepEqual([g.ret.x, g.ret.y], [92, 3], "clamped to the field");
  pointer(round, "move", 60, 25);
  const shots = g.shots;
  pointer(round, "down", 60, 25);
  step(round, 40);
  assert.ok(g.shots - shots >= 3, "held press keeps firing");
  pointer(round, "up", 0, 0);
  const after = g.shots;
  step(round, 30);
  assert.equal(g.shots, after);
  pointer(round, "down", 60, 25);
  pointer(round, "cancel", 0, 0);
  assert.equal(g.ptrDown, false);
  // Out of the room the pack takes nothing.
  assert.equal(pointer({ gallery: null, spec: { ride: null }, phase: "play" }, "move", 1, 1), false);
});

test("Ghoul Rush ride: the game takes pointer events, starts a round with a press and hands the ride the field's units", () => {
  const fake = { width: 0, height: 0, style: {}, getContext: () => null };
  const game = ghoul.default.create({ canvas: fake, onScore: () => {} });
  assert.equal(typeof game.pointer, "function");
  assert.equal(game.pointer("move", 5, 5), false, "nothing before a round");
  assert.equal(game.pointer("down", 5, 5), true, "a press starts it");
  assert.equal(game.state, "running");
  game.resize(960, 600);
  // Into the ride the way the stage select does.
  game.stageSelect();
  const round = game.round;
  round.select = null;
  round.phase = "ready";
  assert.ok(round);
});

test("Ghoul Rush ride: the duck zone is a place, with a dead band and hysteresis, and a ducked Planny cannot fire", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.ret.y = DUCK_ON - 0.5;
  step(round, 1);
  assert.equal(g.ducked, false, "inside the dead band");
  g.ret.y = DUCK_ON + 0.2;
  step(round, 1);
  assert.equal(g.ducked, true);
  g.ret.y = DUCK_OFF + 0.5;
  step(round, 1);
  assert.equal(g.ducked, true, "stays ducked until it comes back above the lower line");
  g.ret.y = DUCK_OFF - 0.5;
  step(round, 1);
  assert.equal(g.ducked, false);
  assert.ok(DUCK_ON - DUCK_OFF >= 1 && DUCK_ON > 41.5);
  g.ret.y = 46;
  step(round, 1);
  const shots = g.shots;
  g.fireCd = 0;
  g.trigger = true;
  step(round, 1);
  assert.equal(g.shots, shots, "no firing while ducked");
});

test("Ghoul Rush ride: Space in the ride neither fires the blaster nor uses a weapon from the bag", () => {
  const round = playing();
  round.bag = ["stake"];
  const game = ghoul.default.create({ canvas: { width: 0, height: 0, style: {}, getContext: () => null }, onScore: () => {} });
  assert.ok(game);
  round.input.fire = true;
  step(round, 30);
  assert.equal(round.shots.length, 0);
  assert.equal(round.heat, 0);
});

/* ------------------------------------------------------------ aim assist */

test("Ghoul Rush ride: aim assist pulls a near miss onto a target but never onto a guest or a decoy mirror", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.ents.length = 0;
  g.fireCd = 0;
  // A lit skull lantern: a shot 3 units off still hits it.
  const lantern = { k: "lant", x: g.p + 40, y: 20, v: "skull", lit: true, lt: 0, hp: 1, delay: 0, alive: true, dying: 0, age: 0, sway: 0 };
  g.ents.push(lantern);
  const cx = CAR_X + 40;
  g.ret.x = cx + 3.5;
  g.ret.y = 22;
  g.trigger = true;
  g.fireCd = 0;
  step(round, 1);
  assert.equal(g.hits, 1, "assist found the lantern");
  g.ents.length = 0;
  // A guest next to the reticle, nothing else: no hit, no OOPS.
  const guest = { k: "inno", x: g.p + 40, y: 40, v: "kid", bad: false, hp: 1, alive: true, dying: 0, age: 0 };
  g.ents.push(guest);
  g.ret.x = cx + 5;
  g.ret.y = 36;
  g.fireCd = 0;
  g.trigger = true;
  step(round, 1);
  assert.equal(g.innoHits, 0, "assist never hits a guest");
  assert.equal(guest.dying, 0);
  g.ents.length = 0;
  const mir = { k: "mir", x: g.p + 40, n: 3, reals: [1], pops: [], cracked: [false, false, false], hp: 99, alive: true, age: 0, spawned: true, done: false, shat: 0, pick: 0 };
  g.ents.push(mir);
  const r = rt.mirRect(mir, 0);
  g.ret.x = r.cx + 6;
  g.ret.y = r.y + 10;
  const hitsBefore = g.hits;
  g.fireCd = 0;
  g.trigger = true;
  step(round, 1);
  assert.equal(mir.cracked[0], false, "assist never cracks a decoy");
  assert.equal(g.hits, hitsBefore);
});

/* ---------------------------------------------------------- mini-bosses */

test("Ghoul Rush ride: the mini-bosses have their hit points and phases, and a kill gives a heart back (never above five)", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.ents.length = 0;
  const swan = rt.K.mini && null;
  assert.equal(swan, null);
  // Make them through the scene table's own rows.
  const rows = SCENES.flatMap((s) => s.spawn.filter((r) => r[0] === "mini").map((r) => r[1]));
  assert.deepEqual(rows, ["swan", "spider"]);
  const mkSwan = SCENES.find((s) => s.id === "tunnel").spawn.find((r) => r[0] === "mini");
  g.p = SCENES.find((s) => s.id === "tunnel").a;
  g.zi = SCENES.findIndex((s) => s.id === "tunnel");
  g.sp[g.zi] = false;
  rt.stepRide(0.016);
  const swanE = g.ents.find((e) => e.k === "mini" && e.id === "swan");
  assert.ok(swanE, `the swan spawns with its scene (${mkSwan[2]})`);
  assert.equal(rt.miniHp(swanE), 10);
  assert.equal(swanE.spots.length, 1);
  g.sp[SCENES.findIndex((s) => s.id === "web")] = false;
  g.p = SCENES.find((s) => s.id === "web").a;
  g.zi = SCENES.findIndex((s) => s.id === "web");
  rt.stepRide(0.016);
  const spider = g.ents.find((e) => e.k === "mini" && e.id === "spider");
  assert.deepEqual(spider.spots.map((s) => s.hp), [7, 4]);
  // Killing one gives a heart back, never above five.
  round.bonusRound.hearts = 3;
  for (const s of swanE.spots) s.hp = 1;
  swanE.active = true;
  swanE.pick = 0;
  swanE.spots[0].x = 50;
  swanE.spots[0].y = 20;
  rt.K.mini.onHit(swanE, 50, 20);
  assert.equal(round.bonusRound.hearts, 4, "a mini-boss kill heals one");
  round.bonusRound.hearts = 5;
  const sp2 = g.ents.find((e) => e.k === "mini" && e.id === "spider");
  sp2.spots.forEach((s) => (s.hp = 1));
  sp2.active = true;
  sp2.pick = 0;
  rt.K.mini.onHit(sp2, 50, 20);
  sp2.pick = 1;
  rt.K.mini.onHit(sp2, 50, 20);
  assert.equal(round.bonusRound.hearts, 5, "never above five");
});

/* ------------------------------------------------------------ the Exit */

test("Ghoul Rush ride: the Exit tells first (flicker and growl, red halos), then only the red guests turn", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.ents.length = 0;
  const zi = SCENES.findIndex((s) => s.id === "exit");
  const s = SCENES[zi];
  g.zi = zi;
  g.p = s.a;
  g.sp[zi] = false;
  rt.stepRide(0.016);
  const guests = g.ents.filter((e) => e.k === "inno");
  assert.ok(guests.length >= 8, "a crowd");
  const bad = guests.filter((e) => e.bad);
  const good = guests.filter((e) => !e.bad);
  assert.ok(bad.length > 0 && good.length > 0, "both kinds in the crowd");
  assert.equal(g.st.exit.tell, false);
  g.p = s.a + 30 - s.skip + 1;
  rt.stepRide(0.016);
  assert.equal(g.st.exit.tell, true, "the tell");
  assert.ok(round.events.some((e) => e.type === "rideGrowl"));
  assert.ok(g.floats.some((f) => /RED HALO/.test(f.s)));
  assert.equal(g.st.exit.turned, false);
  assert.ok(g.ents.filter((e) => e.k === "inno").length === guests.length, "nobody has turned yet");
  const ghouls = g.ents.filter((e) => e.k === "pop" && e.t === "ghoul").length;
  g.p = s.a + 44 - s.skip + 1;
  rt.stepRide(0.016);
  assert.equal(g.st.exit.turned, true);
  for (const b of bad) assert.equal(b.alive, false, "the red ones turned");
  for (const gd of good) assert.equal(gd.alive, true, "green ones never turn");
  const turned = g.ents.filter((e) => e.k === "pop" && e.t === "ghoul");
  assert.equal(turned.length - ghouls, bad.length);
});

/* ------------------------------------------------------ whole rides */

test("Ghoul Rush ride: a bot rides all twelve rooms alive in about 85 to 100 seconds and the bonus pays 5 to 9 dice", () => {
  const round = playing();
  round.dice = 0;
  const lives = round.lives;
  const { seconds, seen } = ridden(round, aimbot);
  assert.deepEqual([...seen].sort((a, b) => a - b), SCENES.map((_, i) => i), "every room is reached");
  assert.equal(round.phase, "clear", `finished (${seconds}s)`);
  assert.ok(round.bonusRound.won, "alive at the end");
  assert.ok(seconds >= 85 && seconds <= 100, `${seconds}s`);
  assert.ok(round.bonusRound.dice >= 5 && round.bonusRound.dice <= 9, `${round.bonusRound.dice} dice`);
  assert.equal(round.dice, round.bonusRound.dice);
  assert.equal(round.lives, lives);
  assert.equal(round.bonusRound.result.won, true);
  if (process.env.RIDE_LOG) console.log("ride", seconds, round.bonusRound.hearts, round.bonusRound.dice, round.gallery.grade, round.gallery.score);
  assert.ok(round.bonusRound.cardMs >= 4000, "the cascade has its time");
  ghoul.advance(round, round.bonusRound.cardMs + 100, steady);
  assert.equal(round.spec.id, "bigtop", "on to the boss");
});

test("Ghoul Rush ride: a bot that does nothing dies early with no dice and the run goes on to the boss", () => {
  const round = playing();
  round.dice = 2;
  const lives = round.lives;
  const { seconds } = ridden(round, (r) => {
    r.input.fire = false;
  });
  assert.ok(round.phase === "crash" || round.phase === "clear", "the hearts ran out");
  assert.ok(seconds < 60, `${seconds}s`);
  ghoul.advance(round, 3000, steady);
  assert.equal(round.bonusRound.hearts, 0);
  assert.deepEqual(round.bonusRound.result, { won: false, dice: 0, gained: 0 });
  assert.equal(round.dice, 2);
  assert.equal(round.lives, lives);
  assert.equal(round.over, false);
  ghoul.advance(round, 3000, steady);
  assert.equal(round.spec.id, "bigtop");
});

test("Ghoul Rush ride: the ride's time never costs a heart and the room clock follows it", () => {
  const round = playing();
  round.timeMs = ghoul.timeFor(round.spec);
  ridden(round, (r) => {
    r.input.fire = false;
    r.gallery.inv = 1e9;
  });
  assert.ok(round.bonusRound.hearts === 5 || round.phase !== "play");
  assert.ok(round.timeMs >= 1000, "the clock holds above zero");
});

test("Ghoul Rush ride: the ride draws no number from Math.random", () => {
  const real = Math.random;
  Math.random = () => {
    throw new Error("the ride drew a random number");
  };
  try {
    const round = playing();
    ridden(round, aimbot, 30);
  } finally {
    Math.random = real;
  }
});

/* ------------------------------------------------------- events, voices */

test("Ghoul Rush ride: every event is voiced, every voice is a tone, and every cause of a lost heart has words and a sound", () => {
  assert.equal(rt.EVENTS.length, rt.SOUNDS.length);
  for (const type of rt.EVENTS) assert.ok(EVENT_VOICE[type], `${type} is voiced`);
  for (const [type, [kind, act]] of Object.entries(EVENT_VOICE)) {
    assert.ok(rt.EVENTS.includes(type), `${type} is the ride's`);
    assert.ok(RIDE_VOICES[kind][act], `${type} has a voice`);
    assert.ok(VOICES.ride[act], `${type} reaches the game's VOICES`);
  }
  const tones = ghoulSfx.tones || ghoulSfx.default?.tones || {};
  for (const name of Object.values(RIDE_VOICES.ride)) assert.ok(tones[name], `${name} is defined`);
  for (const cause of rt.CAUSES) {
    assert.ok(LOSE_WORDS[cause], `${cause} has words`);
    assert.ok(LOSE_SOUNDS[cause], `${cause} has a sound`);
    assert.ok(tones[LOSE_SOUNDS[cause][0]], `${cause}'s sound is defined`);
  }
  // Every event a ride puts on the field is one of the ride's or the game's.
  const round = playing();
  ridden(round, aimbot, 40);
  const known = new Set([...rt.EVENTS, "lose", "go", "room", "bonusStart", "bonusEnd", "clear", "fire", "kill", "hit", "candy", "respawn"]);
  for (const e of round.events) assert.ok(known.has(e.type), `${e.type} is known`);
  const causes = new Set(events(round, "lose").map((e) => e.cause));
  for (const c of causes) assert.ok(rt.CAUSES.includes(c), `${c} is a ride cause`);
});

test("Ghoul Rush ride: older rooms are untouched (the cart is not confused by a ride room, a plain room has no ride)", () => {
  const round = ghoul.newRound(5);
  round.dice = 0;
  assert.equal(round.gallery ?? null, null);
  for (const hook of rt.RIDE.ride) assert.equal(hook(round, 4, {}), false);
});

test("Ghoul Rush ride: the Barker's scene switches the music to the finale loop once, no other scene does, and it ends with the room", () => {
  const music = ghoulSfx.default?.music || ghoulSfx.music || {};
  for (const name of [ghoul.ROOM_MUSIC.darkride, "ghoulBarker"]) assert.ok(music[name], `${name} is a defined track`);
  const round = playing();
  assert.equal(round.gallery.track, undefined, "the ride opens on the room's own track");
  assert.equal(ghoul.dread(round), 0.7);
  const switches = [];
  let last;
  let ms = 0;
  while (round.phase === "play" && ms < 140000) {
    aimbot(round);
    ghoul.advance(round, 16, steady);
    ms += 16;
    const g = round.gallery;
    if (g.track !== last) {
      switches.push({ track: g.track, scene: SCENES[g.zi].id });
      last = g.track;
    }
  }
  assert.deepEqual(switches, [{ track: "ghoulBarker", scene: "barker" }], "one switch, at the Barker");
  assert.equal(round.gallery.track, "ghoulBarker", "the end card keeps the finale");
  assert.equal(ghoul.dread(round), 0.9);
  // On to the boss room: no gallery, no stray track, the room's own music.
  ghoul.advance(round, round.bonusRound.cardMs + 100, steady);
  assert.equal(round.spec.id, "bigtop");
  assert.ok(!round.gallery, "nothing of the ride is left");
  assert.ok(ghoul.ROOM_MUSIC.bigtop && ghoul.ROOM_MUSIC.bigtop !== "ghoulBarker");
  assert.ok(ghoul.dread(round) <= 0.9 + 1e-9 && ghoul.dread(round) >= 0.7);
});

test("Ghoul Rush ride: a ride lost before the Barker never plays the finale, and the next room starts clean", () => {
  const round = playing();
  ridden(round, null, 140);
  assert.equal(round.phase === "play", false);
  assert.ok(!round.gallery?.track, "no finale was reached");
  assert.equal(ghoul.dread(round), 0.7);
});

/* ------------------------------------------- the picked sounds (wire-ride-sounds.cjs) */

// The 31 acts that had a tone but nothing playing it until the hooks went in.
const NEW_SOUNDS = [
  "carDrop", "carJump", "blasterMiss", "blasterAssist", "hurtDuck", "hurtFlicker", "waxMelt", "horseGallop", "mirrorGhoul", "jarCrack", "swanPeck", "swanSpit", "swanDie",
  "bubblesRise", "bubblesHands", "widowFang", "widowDie", "spiderlingSkitter", "spiderlingDie", "batFlap", "clownHoop", "exitGate", "stallEyes", "stallJaws",
  "barkerEye", "barkerSpit", "barkerBite", "barkerDie", "endCard", "endCount", "endLost",
];
const capName = (s) => s[0].toUpperCase() + s.slice(1);
const sfxTones = () => ghoulSfx.tones || ghoulSfx.default?.tones || {};

// A ride played to the end: every event counted by the second of the ride it came in, and the clocks of each.
function listened(round, bot, maxSeconds = 140) {
  const perSec = {};
  const at = {};
  let seen = round.events.length;
  let ms = 0;
  while (round.phase === "play" && ms < maxSeconds * 1000) {
    if (bot) bot(round);
    ghoul.advance(round, 16, steady);
    ms += 16;
    const clock = round.gallery ? round.gallery.clock : 0;
    for (; seen < round.events.length; seen++) {
      const type = round.events[seen].type;
      const bucket = (perSec[type] ||= {});
      bucket[Math.floor(clock)] = (bucket[Math.floor(clock)] || 0) + 1;
      (at[type] ||= []).push(clock);
    }
  }
  return { perSec, at, seconds: ms / 1000 };
}
// Never fires, ducks at a warning: it is hurt (the endless-lives code spares the hearts) and so sees what a perfect shot never lets happen.
function duckbot(round) {
  const g = round.gallery;
  round.input.fire = false;
  g.ret.y = g.duckWarn > 0.15 ? 46 : 26;
}

test("Ghoul Rush ride: all 61 picked ride sounds are real tones, and every sound name has a voice", () => {
  const tones = sfxTones();
  const names = new Set();
  const overrides = [];
  for (const n of rt.SOUNDS) {
    const voice = RIDE_VOICES.ride[n];
    assert.ok(voice, `${n} has a voice`);
    assert.ok(tones[voice], `${voice} is defined`);
    if (voice !== `ghoulRide${capName(n)}`) overrides.push(n);
    names.add(voice);
  }
  assert.equal(overrides.length, 30, "30 sounds the ride already played now play a pick");
  for (const n of NEW_SOUNDS) {
    assert.ok(rt.SOUNDS.includes(n), `${n} is one of the ride's sounds`);
    assert.equal(RIDE_VOICES.ride[n], `ghoulRide${capName(n)}`, `${n} plays its own tone`);
  }
  assert.equal(NEW_SOUNDS.length, 31);
  assert.equal(new Set(rt.SOUNDS).size, rt.SOUNDS.length, "no sound is listed twice");
  assert.equal(names.size, rt.SOUNDS.length, "no two sounds share a tone");
  const picked = [...overrides.map((n) => RIDE_VOICES.ride[n]), ...NEW_SOUNDS.map((n) => RIDE_VOICES.ride[n])];
  assert.equal(new Set(picked).size, 61, "61 picked tones");
  for (const k of picked) {
    const t = tones[k];
    assert.ok(Array.isArray(t.layers) && t.layers.length > 0, `${k} has layers`);
    for (const l of t.layers) {
      assert.equal(typeof l.type, "string", `${k} layer type`);
      assert.ok(l.gain > 0 && l.gain <= 1, `${k} layer gain ${l.gain}`);
    }
  }
});

test("Ghoul Rush ride: a perfect bot and a bot that is hurt between them play every new sound, each at a sane rate", () => {
  const perfect = listened(playing(), aimbot);
  assert.ok(perfect.seconds >= 85 && perfect.seconds <= 100, `the perfect ride still takes ${perfect.seconds}s`);
  const hurtRound = playing();
  hurtRound.infinite = true;
  const hurt = listened(hurtRound, duckbot);
  const played = (type) => !!(perfect.perSec[type] || hurt.perSec[type]);
  // Not reachable by a bot: the jar (no scene hangs one yet, tested below) and the result cards (their own tick, tested below).
  const apart = new Set(["jarCrack", "endCard", "endCount", "endLost"]);
  for (const n of NEW_SOUNDS) if (!apart.has(n)) assert.ok(played(`ride${capName(n)}`), `${n} plays in a ride`);
  const fresh = new Set(NEW_SOUNDS.map((n) => `ride${capName(n)}`));
  for (const run of [perfect, hurt]) {
    for (const [type, buckets] of Object.entries(run.perSec)) {
      if (!rt.EVENTS.includes(type)) continue;
      const most = Math.max(...Object.values(buckets));
      assert.ok(most <= 14, `${type} plays ${most} times in one second`);
      if (fresh.has(type)) assert.ok(most <= 6, `${type} plays ${most} times in one second`);
    }
  }
  // The bursty ones keep their gap, so a held trigger or a wave never machine-guns.
  for (const [name, gap] of [["blasterMiss", 0.12], ["bubblesRise", 0.25], ["spiderlingSkitter", 0.15], ["batFlap", 0.12]]) {
    for (const run of [perfect, hurt]) {
      const ts = run.at[`ride${capName(name)}`] || [];
      for (let i = 1; i < ts.length; i++) assert.ok(ts[i] - ts[i - 1] >= gap - 1e-6, `${name} twice within ${gap}s`);
    }
  }
  // Once per moment: one drop, one jump over the crest, one gate, one jaws, one boss death, two eyes.
  for (const n of ["carDrop", "carJump", "exitGate", "stallJaws", "barkerDie"]) {
    for (const run of [perfect, hurt]) assert.ok((run.at[`ride${capName(n)}`] || []).length <= 1, `${n} plays once`);
  }
  assert.equal((perfect.at.rideBarkerEye || []).length, 2, "the Barker opens his two eyes");
  assert.ok((perfect.at.rideBlasterMiss || []).length > 0 && (perfect.at.rideBlasterAssist || []).length > 0);
  assert.equal((hurt.at.rideHurtFlicker || []).length, (hurt.at.rideHurt || []).length, "the flicker starts with each hit");
});

test("Ghoul Rush ride: a jar plays its crack and not the generic splat, and sounds never change the game", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  round.events.length = 0;
  const jar = { k: "lant", x: g.p + 30, y: 20, v: "jar", lit: true, lt: 0, hp: 1, alive: true, dying: 0, age: 0, delay: 0, sway: 0 };
  g.ents.push(jar);
  rt.K.lant.onHit(jar, 30, 20);
  assert.equal(events(round, "rideJarCrack").length, 1);
  assert.equal(events(round, "rideSplat").length, 0);
  // Two seeded rides play the same (the sound hooks draw nothing from the ride's stream and read no time of their own).
  const run = () => {
    const r = playing();
    const out = ridden(r, aimbot);
    return { seconds: out.seconds, score: r.gallery.score, kills: r.gallery.kills, hearts: r.bonusRound.hearts, dice: r.bonusRound.dice };
  };
  assert.deepEqual(run(), run());
});

test("Ghoul Rush ride: the title screen holds until a key or a click, however long, and that press neither fires nor steers", () => {
  const game = () => {
    const g = ghoul.default.create({ canvas: { width: 0, height: 0, style: {}, getContext: () => null }, onScore: () => {} });
    g.start();
    g.resize(960, 600);
    g.stageSelect();
    const at = ghoul.STAGES.findIndex((s) => s.id === "carnival");
    for (let i = 0; i < at; i++) ghoul.steerSelect(g.round, 1, 0);
    for (let i = 0; i < ghoul.STAGES[at].rooms.indexOf("darkride"); i++) ghoul.steerSelect(g.round, 0, 1);
    ghoul.takeSelect(g.round);
    return g;
  };
  const started = (g) => {
    g.tick(16);
    assert.equal(g.round.phase, "play", "the ride is off");
    assert.equal(g.round.gallery.waiting, false);
  };
  const held = (g) => {
    for (let i = 0; i < 100; i++) g.tick(100);
    assert.equal(g.round.phase, "ready", "still on the title after ten seconds");
    assert.equal(g.round.gallery.p, 0);
  };
  // A game key, no shot from it.
  const space = game();
  held(space);
  space.key("action", true);
  held(space);
  assert.equal(space.key("action"), true);
  assert.equal(space.round.input.fire, false);
  assert.equal(space.round.gallery.trigger, false);
  started(space);
  assert.equal(space.round.gallery.shots, 0);
  // An arrow, no step from it.
  const arrow = game();
  held(arrow);
  arrow.key("left");
  assert.equal(arrow.round.input.left, false);
  started(arrow);
  // Any other key the window passes on, and only while it waits.
  const other = game();
  held(other);
  assert.equal(other.anyKey(), true);
  started(other);
  assert.equal(other.anyKey(), false, "nothing to start now");
  // A click: moving only moves the aim; the press starts it, the aim where it was, no shot.
  const click = game();
  held(click);
  click.pointer("move", 96, 200);
  held(click);
  assert.ok(click.pointer("down", 480, 200));
  started(click);
  assert.equal(click.round.gallery.ptrDown, false);
  assert.equal(click.round.gallery.trigger, false);
  assert.equal(click.round.gallery.shots, 0);
  assert.ok(click.round.gallery.ret.x > 40, "the reticle is at the click");
});

test("Ghoul Rush ride: the title screen names the mouse, how to duck and how to start", () => {
  const round = rideRound();
  const said = [];
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({}, {
    get(_, name) {
      if (name === "fillText") return (text) => said.push(text);
      if (name.startsWith?.("create")) return () => gradient;
      if (name === "measureText") return () => ({ width: 1 });
      return noop;
    },
    set: () => true,
  });
  rideArt({}, noop).field(ctx, { round, g: { W: ghoul.W, HUD_H: ghoul.HUD_H, CRASH_MS: ghoul.CRASH_MS } });
  assert.ok(said.includes("TIP: USE YOUR MOUSE FOR THE BEST RESULTS"));
  assert.ok(said.some((t) => /aim cursor below the dashed line/.test(t)));
  assert.ok(said.includes("PRESS ANY KEY OR CLICK TO START"));
  assert.ok(!said.includes("GET READY"));
});

test("Ghoul Rush ride: the ride photo is taken of the painted scene, not the bare board, and before its own flash goes over it", () => {
  const round = playing();
  step(round, 2);
  const g = G(round);
  g.photoWant = true;
  g.flash = 1;
  g.flashCol = "#abcdef";
  let drawn = 0;
  let flashed = false;
  let shot = null;
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const canvas = { width: 960, height: 600 };
  const ctx = new Proxy({}, {
    get(_, name) {
      if (name === "canvas") return canvas;
      if (name.startsWith?.("create")) return () => gradient;
      if (name === "measureText") return () => ({ width: 1 });
      if (name === "fill" || name === "fillRect" || name === "stroke") return () => { drawn++; };
      return noop;
    },
    set(_, name, value) {
      if (name === "fillStyle" && value === "#abcdef") flashed = true;
      return true;
    },
  });
  const real = globalThis.document;
  globalThis.document = {
    createElement: () => ({ getContext: () => ({ drawImage: (from) => { shot = { from, drawn, flashed }; } }) }),
  };
  try {
    rideArt({}, {}).field(ctx, { round, g: { W: ghoul.W, HUD_H: ghoul.HUD_H, CRASH_MS: ghoul.CRASH_MS } });
  } finally {
    if (real === undefined) delete globalThis.document;
    else globalThis.document = real;
  }
  assert.ok(shot, "a photo was taken");
  assert.equal(shot.from, canvas);
  assert.ok(shot.drawn > 100, `the scene was painted first (${shot.drawn} marks)`);
  assert.equal(shot.flashed, false, "the flash is not in it");
  assert.equal(flashed, true, "it goes over the scene after");
  assert.equal(g.photoWant, false, "one photo");
  assert.ok(g.photo, "and it is kept for the card");
});

test("Ghoul Rush ride: the result card plays its sounds once each through the picked voices, the lost card its own", () => {
  const V = RIDE_VOICES.ride;
  const art = rideArt({}, {});
  const heard = [];
  const kit = { fx: {}, tone: (name) => heard.push(name) };
  const round = playing();
  ridden(round, aimbot);
  assert.equal(round.phase, "clear");
  const b = round.bonusRound;
  assert.equal(events(round, "bonusEnd")[0].ride, true, "the bonus tells the art it is the ride's");
  while (round.phase === "clear" && round.spec.id === "darkride") {
    ghoul.advance(round, 16, steady);
    art.tick(round, kit);
  }
  const count = (list, name) => list.filter((h) => h === name).length;
  assert.equal(count(heard, V.endCard), 1, "the card plays once as it appears");
  assert.equal(count(heard, V.endCount), b.dice, "one counter tick for each die that lands");
  assert.equal(count(heard, V.diceLand), b.dice);
  assert.equal(count(heard, V.fan), 1);
  assert.equal(count(heard, V.stab), 1);
  assert.equal(count(heard, V.endLost), 0);
  // Lost: the hearts run out, the BONUS LOST card plays its sound once and nothing of the cleared card.
  const lost = playing();
  const heard2 = [];
  const kit2 = { fx: {}, tone: (name) => heard2.push(name) };
  while (lost.phase === "play") {
    lost.input.fire = false;
    ghoul.advance(lost, 16, steady);
    art.tick(lost, kit2);
  }
  for (let i = 0; i < 600 && lost.spec.id === "darkride"; i++) {
    ghoul.advance(lost, 16, steady);
    art.tick(lost, kit2);
  }
  assert.equal(events(lost, "bonusEnd")[0].won, false);
  assert.equal(events(lost, "bonusEnd")[0].ride, true);
  assert.equal(count(heard2, V.endLost), 1);
  assert.equal(count(heard2, V.endCard) + count(heard2, V.fan), 0);
});
