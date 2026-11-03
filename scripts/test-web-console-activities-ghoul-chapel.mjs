// Web console tests, Ghoul Rush's Chapel stage: its four rooms, gargoyles that are stone on their perch and dive when you pass under, choir ghosts whose song quickens the monsters near them, censer monks and their smoke, bats in the bells, the bell toll that freezes everything for a second, Holy Water (found only here), and the Choirmaster, whose organ pipes guard him and whose columns of notes have one gap each.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as ch from "../src/web-console/public/activities/ghoul-rush/stages/chapel/ghoul-chapel.js";
import { LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-rush/stages/chapel/ghoul-chapel-draw.js";
import { PILL_WORDS, pickPower } from "../src/web-console/public/activities/ghoul-rush/core/ghoul-powers.js";
import * as sfxChapel from "../src/web-console/public/activities/ghoul-rush/stages/chapel/ghoul-sfx-chapel.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the Chapel's room `id`, reached the way play reaches it,
// nothing woken: every spawner spent, the horde held back.
function chapelRound(id) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["chapel"];
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

// Runs until `done()` (or `ms` have passed), 4 ms at a time.
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

test("Ghoul Rush's Chapel is a stage of three rooms and the Choir's, its monsters and boss joined to the game's, with Holy Water and a place for each kind", () => {
  const st = ghoul.stageById("chapel");
  assert.deepEqual(st.rooms, ["nave", "tower", "loft", "pew", "choir"], "the bonus ride (Holy Roller) sits before the Choir");
  assert.equal(st.boss, "choirmaster");
  assert.equal(st.title, "The Chapel");
  assert.equal(st.sub, "Service is still in session");
  for (const kind of Object.keys(ch.MONSTERS)) assert.equal(ghoul.MONSTERS[kind], ch.MONSTERS[kind], `${kind} is a monster`);
  assert.equal(ghoul.BOSSES.choirmaster, ch.BOSSES.choirmaster);
  assert.equal(ch.BOSSES.choirmaster.sub, "Silence the pipes one by one");
  for (const id of st.rooms) assert.ok(ghoul.ROOM_MUSIC[id], `${id} has music`);
  const [nave, tower, loft, choir] = st.rooms.filter((id) => id !== "pew").map((id) => ghoul.roomById(id));
  for (const room of [nave, tower, loft]) {
    assert.ok(room.key, `${room.id}: a key`);
    assert.ok(room.sky.length && room.candy.length && room.items.length && room.horde.length, `${room.id}: sky treasures, candy, items and a horde`);
    const wings = room.items.find((i) => i[0] === "wings");
    assert.ok(wings && wings[1] < room.key[0], `${room.id}: wings on the way to the sky`);
    assert.ok(room.items.some((i) => i[0] === "holy"), `${room.id}: Holy Water`);
    assert.ok(room.spawns.some((s) => s[0] in ch.MONSTERS), `${room.id}: some of the new monsters`);
  }
  assert.equal(choir.boss, "choirmaster");
  assert.equal(choir.horde.length, 0);
  assert.ok(choir.shelves.length >= 3, "boards for the staff's higher gaps");
  // The tower and the choir are where the bell tolls; they get harder in order.
  assert.deepEqual([nave.toll, tower.toll, loft.toll, choir.toll], [0, 12000, 0, 12000]);
  assert.ok(nave.spawns.length <= tower.spawns.length && tower.spawns.length <= loft.spawns.length);
  assert.ok(nave.hordeMs > tower.hordeMs && tower.hordeMs > loft.hordeMs);
  // The nave has pews to hop along, the tower a climb of stacked boards, bells with bats in them and gargoyles.
  assert.ok(nave.shelves.filter((s) => s[2] === 11).length >= 6, "pews");
  assert.ok(tower.spawns.some((s) => s[0] === "bellbat") && tower.spawns.some((s) => s[0] === "gargoyle"));
  assert.ok(loft.spawns.some((s) => s[0] === "gargoyle") && loft.spawns.some((s) => s[0] === "monk") && loft.spawns.some((s) => s[0] === "chorister"));
  // The monsters keep their places.
  assert.equal(ch.MONSTERS.gargoyle.perch, true, "a spawn row names the height of its perch");
  assert.equal(ch.MONSTERS.bellbat.hp, 1);
  assert.equal(ch.MONSTERS.chorister.hp, 3);
  assert.equal(ch.MONSTERS.monk.hp, 4);
});

/* ------------------------------------------------------- the gargoyle */

test("Ghoul Rush's gargoyle is stone on its perch: shots glance off, a stomp does nothing and it hurts nothing", () => {
  const round = chapelRound("loft");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  const g = put(round, "gargoyle", 90, { y: 30 });
  assert.equal(g.act, "perch");
  assert.equal(ghoul.solid(g), false, "stone: nothing touches it");
  round.shots.push({ x: 87, y: 31, vx: 80, vy: 0, gone: 0 });
  run(round, 120);
  assert.equal(g.hp, g.max, "the bolt glanced off");
  assert.ok(events(round, "glance").length >= 1, "and said so");
  assert.equal(round.shots.length, 0, "the bolt is spent");
  // Standing in its place on the board hurts nothing.
  Object.assign(round.you, { x: 90, y: 30, state: "run" });
  run(round, 20);
  assert.equal(events(round, "lose").length, 0);
  // Landing on its head is no stomp.
  standAt(round, 90, 1, 40);
  Object.assign(round.you, { state: "air", vy: -20, safeMs: 1e9 });
  until(round, () => round.you.y <= 30.5, 400);
  assert.equal(events(round, "stomp").length, 0, "a stomp does nothing");
  assert.equal(g.act, "perch");
});

test("Ghoul Rush's gargoyle wakes when you pass under it, dives at you, then flies back to its perch and turns to stone again", () => {
  const round = chapelRound("loft");
  standAt(round, 90 + ch.GARGOYLE_NEAR + 8);
  round.you.safeMs = 1e9;
  const g = put(round, "gargoyle", 90, { y: 30 });
  run(round, 200);
  assert.equal(g.act, "perch", "you are not under it");
  // Level with it (on its board), near, is not passing under.
  const level = chapelRound("loft");
  standAt(level, 114, 1, 15, 0);
  level.you.safeMs = 1e9;
  const l = put(level, "gargoyle", 118, { y: 15 });
  run(level, 300);
  assert.equal(l.act, "perch");
  // Under it: it shakes loose, still stone.
  standAt(round, 90 - ch.GARGOYLE_NEAR + 2, 1);
  round.you.safeMs = 1e9;
  run(round, 8);
  assert.equal(g.act, "wake");
  assert.equal(events(round, "gargoyleWake").length, 1);
  assert.equal(ghoul.solid(g), false, "still stone while it shakes");
  run(round, ch.GARGOYLE_WAKE_MS - 40);
  assert.equal(g.act, "wake");
  assert.equal(g.y, 30);
  run(round, 80);
  assert.equal(g.act, "dive");
  assert.equal(events(round, "gargoyleDive").length, 1);
  assert.equal(ghoul.solid(g), true, "flesh and stone, hurting, hit by a bolt");
  // It comes down at where you are, fast.
  const y0 = g.y;
  run(round, 300);
  assert.ok(g.y < y0 - 5 && g.x < 90, `it dives (${g.x.toFixed(1)}, ${g.y.toFixed(1)})`);
  // Then it goes back up to its perch and sits there stone again.
  round.you.safeMs = 1e9;
  until(round, () => g.act === "perch", 6000);
  assert.equal(g.act, "perch");
  assert.equal(events(round, "gargoylePerch").length, 1);
  assert.deepEqual([g.x, g.y], [90, 30], "back where it began");
  assert.equal(ghoul.solid(g), false);
});

test("Ghoul Rush's diving gargoyle hurts you, can be shot or stomped while it flies, and a stomp on a perched one does nothing", () => {
  const round = chapelRound("loft");
  standAt(round, 60);
  put(round, "gargoyle", 66, { y: 30 });
  run(round, ch.GARGOYLE_WAKE_MS + 600);
  assert.equal(events(round, "lose")[0]?.cause, "gargoyle");
  const shot = chapelRound("loft");
  standAt(shot, 60);
  shot.you.safeMs = 1e9;
  const d = put(shot, "gargoyle", 90, { y: 20, act: "dive", dive: -1, vx: 0, vy: 0 });
  assert.equal(ghoul.solid(d), true);
  for (let k = 0; k < 4; k++) bolt(shot, d, d.y + 2);
  ghoul.advance(shot, 4, steady);
  assert.ok(d.hp < d.max, "a bolt hurts it in the air");
  // Landing on one in the air is a stomp.
  const top = chapelRound("loft");
  top.you.safeMs = 1e9;
  const s = put(top, "gargoyle", 90, { y: 12, act: "dive", dive: -1, vx: 0, vy: 0 });
  standAt(top, 90, 1, 12 + s.h + 3);
  Object.assign(top.you, { state: "air", vy: -20, safeMs: 1e9 });
  until(top, () => events(top, "stomp").length > 0, 600);
  assert.equal(events(top, "stomp").length, 1, "stomped from above");
  assert.equal(s.dead, true);
});

test("Ghoul Rush's Holy Water breaks a stone gargoyle even while it perches", () => {
  const round = chapelRound("loft");
  standAt(round, 30);
  round.you.safeMs = 1e9;
  ghoul.applyPower(round, "holy");
  const g = put(round, "gargoyle", 90, { y: 30 });
  round.shots.push({ x: 87, y: 31, vx: 80, vy: 0, gone: 0 });
  run(round, 120);
  assert.equal(round.monsters.includes(g), false, "gone");
  assert.equal(events(round, "kill")[0]?.how, "holy");
  assert.equal(events(round, "glance").length, 0);
});

/* ------------------------------------------------------- the choir ghost */

test("Ghoul Rush's choir ghost drifts toward you, sings for 2.5 s now and then, and while it sings the monsters near it move 1.4 times as fast", () => {
  const travel = (sing) => {
    const round = chapelRound("nave");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    const c = put(round, "chorister", 70, { y: 20, songIn: sing ? 0 : 1e9 });
    const z = put(round, "monk", 64, { throwIn: 1e9 });
    const x0 = z.x;
    run(round, 1000);
    return { c, z, moved: x0 - z.x, round };
  };
  const quiet = travel(false);
  const loud = travel(true);
  assert.ok(loud.moved > quiet.moved * 1.25, `sped up (${loud.moved.toFixed(2)} to ${quiet.moved.toFixed(2)})`);
  assert.ok(loud.moved < quiet.moved * 1.6, "by about 1.4");
  // The song: one event to start, one to stop, 2.5 s apart.
  const round = chapelRound("nave");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const c = put(round, "chorister", 60, { y: 20, songIn: 0 });
  const start = log(round, 40, "choirSing");
  assert.equal(start.length, 1);
  assert.ok(c.sing > 0);
  const stop = log(round, ch.SONG_MS + 100, "choirHush");
  assert.equal(stop.length, 1);
  assert.ok(Math.abs(stop[0][0] - start[0][0] - ch.SONG_MS) < 60, `${stop[0][0] - start[0][0]} ms`);
  assert.equal(c.sing, 0);
  // It drifts toward you slowly, and sings again later.
  assert.ok(c.x < 60, "drifting your way");
  assert.ok(ch.MONSTERS.chorister.speed <= 6);
  // Far from the singer a monster is not quickened; a monster of the singer's own is.
  const far = chapelRound("nave");
  standAt(far, 20);
  far.you.safeMs = 1e9;
  put(far, "chorister", 80, { y: 12, songIn: 0 });
  const near = put(far, "monk", 70, { throwIn: 1e9 });
  const away = put(far, "monk", 80 + ch.HASTE_RANGE + 10, { throwIn: 1e9 });
  run(far, 100);
  assert.ok(near.hasteMs > 0, "the near one is quickened");
  assert.ok(!(away.hasteMs > 0), "the far one is not");
  run(far, ch.SONG_MS + 400);
  assert.ok(!(near.hasteMs > 0), "and slows once it stops");
});

/* ----------------------------------------------------------- the monk */

test("Ghoul Rush's censer monk walks at you and puffs a harmless cloud of smoke about 10 wide that lasts 4 s", () => {
  const round = chapelRound("nave");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  const m = put(round, "monk", 50, { throwIn: 0 });
  const x0 = m.x;
  run(round, 20);
  assert.equal(events(round, "censerWind").length, 1);
  assert.equal(round.hazards.length, 0, "the censer swings first");
  run(round, ch.CENSER_WIND_MS + 40);
  assert.equal(events(round, "smokePuff").length, 1);
  const cloud = round.hazards.find((h) => h.kind === "smoke");
  assert.ok(cloud, "a cloud");
  assert.equal(cloud.w, 10);
  assert.ok(m.x < x0, "it walked at you");
  // Harmless: standing in it costs nothing.
  Object.assign(round.you, { x: cloud.x, safeMs: 0 });
  round.monsters.length = 0;
  run(round, 400);
  assert.equal(events(round, "lose").length, 0);
  assert.equal(cloud.life > 0, true);
  // It thins away after about 4 s and not before.
  const left = cloud.life;
  run(round, left - 100);
  assert.ok(round.hazards.includes(cloud));
  run(round, 140);
  assert.equal(round.hazards.includes(cloud), false);
  assert.ok(left > ch.SMOKE_MS - 700 && left <= ch.SMOKE_MS);
  // Never more than SMOKE_CAP at once, and a shot monk (4 bolts) dies.
  const crowd = chapelRound("nave");
  standAt(crowd, 20);
  crowd.you.safeMs = 1e9;
  for (let k = 0; k < 6; k++) put(crowd, "monk", 60 + k * 3, { throwIn: 0, windup: 5 });
  run(crowd, 200);
  assert.ok(crowd.hazards.filter((h) => h.kind === "smoke").length <= ch.SMOKE_CAP);
  assert.equal(ghoul.MONSTERS.monk.hp, 4);
});

/* ---------------------------------------------------------- bell bats */

test("Ghoul Rush's bell bats roost in a bell, harmless, until the bell tolls; then a flock of three bursts out and swoops at you", () => {
  const round = chapelRound("tower");
  standAt(round, 60);
  round.you.safeMs = 1e9;
  const roost = put(round, "bellbat", 120, { y: 38 });
  assert.equal(roost.act, "roost");
  assert.equal(ghoul.solid(roost), false, "nothing touches a bat in its bell");
  round.shots.push({ x: 116, y: 39, vx: 80, vy: 0, gone: 0 });
  run(round, 80);
  assert.equal(roost.hp, roost.max, "a bolt goes through");
  round.twist = { next: 5, swing: false, frozen: false };
  run(round, 20);
  assert.equal(events(round, "toll").length, 1);
  const bellBurst = events(round, "bellBurst");
  assert.equal(bellBurst.length, 1);
  assert.equal(bellBurst[0].n, 3);
  const flock = round.monsters.filter((m) => m.kind === "bellbat" && m.act === "swoop");
  assert.equal(flock.length, 3, "a flock of three");
  assert.ok(flock.every((m) => m.hp === 1), "one bolt each");
  // Frozen for the toll, they then swoop at you like the house bat.
  run(round, ch.TOLL_STUN_MS + 50);
  const xs = flock.map((m) => m.x);
  run(round, 1500);
  assert.ok(flock.some((m, i) => Math.abs(m.x - xs[i]) > 8), "they swoop");
  // Another toll, another flock: never more than BAT_CAP flying.
  for (let k = 0; k < 4; k++) {
    round.twist.next = 5;
    run(round, ch.TOLL_STUN_MS + 60);
    round.you.safeMs = 1e9;
  }
  assert.ok(round.monsters.filter((m) => m.kind === "bellbat" && m.act !== "roost").length <= ch.BAT_CAP);
  // A roost off screen lets nobody out.
  const off = chapelRound("tower");
  standAt(off, 20);
  off.you.safeMs = 1e9;
  put(off, "bellbat", 400, { y: 38 });
  off.twist = { next: 5, swing: false, frozen: false };
  run(off, 20);
  assert.equal(events(off, "bellBurst").length, 0);
  // A horde bat comes swooping, no roost.
  const horde = chapelRound("tower");
  standAt(horde, 20);
  const h = put(horde, "bellbat", 60, { y: 30, ...ch.CHAPEL.horde.bellbat });
  assert.equal(h.act, "swoop");
  assert.equal(ghoul.solid(h), true);
});

/* ------------------------------------------------------------ the toll */

test("Ghoul Rush's bell swings visibly for 1.2 s, then tolls: the tower and the choir toll about every 12 s, the other rooms never", () => {
  const round = chapelRound("tower");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  round.timeMs = 1e9;
  const swings = [];
  const tolls = [];
  const ends = [];
  for (let t = 0; t < 30000; t += 4) {
    ghoul.advance(round, 4, steady);
    round.you.safeMs = 1e9;
    for (const e of round.events) {
      if (e.type === "bellSwing") swings.push(round.clock);
      if (e.type === "toll") tolls.push(round.clock);
      if (e.type === "tollEnd") ends.push(round.clock);
    }
    round.events.length = 0;
    // The bell as a hazard to draw while it swings.
    if (swings.length && !tolls.length) assert.ok(round.hazards.some((h) => h.kind === "bell"), "the bell is drawn while it swings");
  }
  assert.equal(tolls.length, 2, "two tolls in 30 s");
  assert.ok(Math.abs(tolls[0] - 12000 * ch.TOLL_FIRST) < 60, `the first at ${tolls[0]}`);
  assert.ok(Math.abs(tolls[1] - tolls[0] - 12000) < 60, `then every 12 s (${tolls[1] - tolls[0]})`);
  assert.ok(Math.abs(tolls[0] - swings[0] - ch.SWING_MS) < 60, "the swing warns for 1.2 s");
  assert.ok(Math.abs(ends[0] - tolls[0] - ch.TOLL_STUN_MS) < 60, "and it thaws a second after");
  for (const id of ["nave", "loft"]) {
    const r = chapelRound(id);
    standAt(r, 20);
    r.timeMs = 1e9;
    r.you.safeMs = 1e9;
    run(r, 14000);
    assert.equal(r.stunMs, 0, `${id}: no bell`);
    assert.equal(events(r, "toll").length, 0);
  }
});

test("Ghoul Rush's toll freezes you and every monster for a second: no run, jump or shot, gravity still takes you down, and bolts already flying still hit", () => {
  const round = chapelRound("tower");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  round.timeMs = 1e9;
  const z = put(round, "monk", 70, { throwIn: 1e9 });
  const c = put(round, "chorister", 100, { y: 20, songIn: 1e9 });
  round.twist = { next: 5, swing: false, frozen: false };
  run(round, 8);
  assert.ok(round.stunMs > 900, "frozen");
  assert.equal(events(round, "toll").length, 1);
  const at = { you: round.you.x, z: z.x, c: [c.x, c.y] };
  // Every key does nothing.
  round.input.right = true;
  round.input.fire = true;
  round.input.up = true;
  round.input.jump = ghoul.JUMP_BUFFER_MS;
  run(round, 600);
  assert.equal(round.you.x, at.you, "no running");
  assert.equal(round.you.y, ghoul.groundAt(round.spec, 20), "no jumping");
  assert.equal(round.shots.length, 0, "no shooting");
  assert.equal(z.x, at.z, "the monk stands");
  assert.deepEqual([c.x, c.y], at.c, "the ghost hangs");
  // Gravity still applies: in the air you come down.
  Object.assign(round.you, { y: 30, vy: 0, state: "air", shelf: -1 });
  run(round, 300);
  assert.ok(round.you.y < 30 - 5, `falling (${round.you.y.toFixed(1)})`);
  assert.equal(round.you.x, at.you);
  // A bolt in flight still hits a frozen monster.
  round.stunMs = 800;
  round.input.right = false;
  const target = put(round, "monk", 90, { throwIn: 1e9 });
  const hp = target.hp;
  round.shots.push({ x: 80, y: target.y + 2, vx: 80, vy: 0, gone: 0 });
  run(round, 200);
  assert.ok(target.hp < hp, "a bolt in flight hits");
  assert.ok(round.stunMs > 0, "still frozen");
  // About a second in all, then everything moves again.
  until(round, () => !(round.stunMs > 0));
  assert.equal(events(round, "tollEnd").length, 0, "the thaw is told on the next slice");
  round.input.right = true;
  round.input.fire = false;
  round.input.up = false;
  run(round, 400);
  assert.ok(round.you.x > at.you + 5, "you run again");
  assert.ok(z.x < at.z, "and the monk walks again");
  assert.equal(events(round, "tollEnd").length, 1);
});

test("Ghoul Rush's toll lasts TOLL_STUN_MS (about a second) and freezes what monsters threw, the notes included, but not a bolt", () => {
  const round = chapelRound("tower");
  standAt(round, 20);
  round.you.safeMs = 1e9;
  round.timeMs = 1e9;
  round.hazards.push({ kind: "note", x: 60, y: 10, w: 1.6, h: 1.6, v: 20, live: 1, life: 7000, cause: "note" });
  round.bones.push({ id: 9e9, kind: "bone", x: 70, y: 20, vx: 5, vy: 0, spin: 0, life: 4000 });
  round.twist = { next: 5, swing: false, frozen: false };
  run(round, 8);
  const note = round.hazards.find((h) => h.kind === "note");
  const x0 = note.x;
  const bx = round.bones[0].x;
  run(round, ch.TOLL_STUN_MS - 100);
  assert.equal(note.x, x0, "the note hangs");
  assert.equal(round.bones[0].x, bx, "so does a thrown bone");
  const frozenFor = log(round, 400, "tollEnd");
  assert.equal(frozenFor.length, 1);
  run(round, 100);
  assert.ok(note.x < x0, "and flies again");
  // A death or a new life puts the freeze away.
  round.twist = { next: 5, swing: false, frozen: false };
  run(round, 8);
  assert.ok(round.stunMs > 0);
  ghoul.lose(round, "zombie");
  run(round, ghoul.CRASH_MS + ghoul.READY_MS + 40);
  assert.equal(round.stunMs, 0);
  assert.ok(round.twist.next > 12000 * ch.TOLL_FIRST - 1000 && !round.twist.frozen, "the bell starts over with the room");
});

/* --------------------------------------------------------- holy water */

test("Holy Water is found only in The Chapel: no drop elsewhere ever picks it, a placed one elsewhere is swapped, and it lasts 10 s", () => {
  assert.equal(ghoul.POWERS.holy.stage, "chapel");
  assert.equal(ghoul.POWERS.holy.ms, 10000);
  assert.ok(ghoul.TIMED.includes("holy"), "a timed power-up, shown in the pill");
  assert.equal(PILL_WORDS.holy, "HOLY");
  const home = chapelRound("nave");
  assert.equal(ghoul.powerHere(home, "holy"), true);
  assert.ok(home.loot.includes("holy"), "placed ones stay");
  const picked = new Set();
  const random = ghoul.seeded(9);
  for (let k = 0; k < 400; k++) picked.add(pickPower(random, home));
  assert.ok(picked.has("holy"), "drops here can be Holy Water");
  const hall = ghoul.newRound(3);
  hall.dice = 0;
  assert.equal(ghoul.powerHere(hall, "holy"), false);
  const away = chapelRound("nave");
  away.stage = "grounds";
  assert.equal(ghoul.powerHere(away, "holy"), false);
  for (let k = 0; k < 400; k++) {
    assert.notEqual(pickPower(random, away), "holy");
    assert.notEqual(pickPower(random, hall), "holy");
  }
  for (const base of ghoul.ROOMS) if (!["nave", "tower", "loft", "choir"].includes(base.id)) assert.ok(!base.items.some((i) => i[0] === "holy"), `${base.id} places none`);
  const timed = chapelRound("nave");
  ghoul.applyPower(timed, "holy");
  assert.equal(timed.effects.holy, 10000);
  ghoul.advance(timed, ghoul.POWERS.holy.ms + 8, steady);
  assert.equal(timed.effects.holy, 0);
});

test("Holy Water splashes: a bolt does 1 damage to every monster within 4 of what it hit, and double to a ghost, a choir ghost or a wraith", () => {
  const hit = (holy, kind, over = {}) => {
    const round = chapelRound("nave");
    standAt(round, 20);
    round.you.safeMs = 1e9;
    if (holy) ghoul.applyPower(round, "holy");
    const m = put(round, kind, 60, kind === "zombie" || kind === "monk" ? over : { y: 10, ...over });
    const near = put(round, "zombie", 62.5);
    const far = put(round, "zombie", 60 + ch.HOLY_SPLASH + 4);
    bolt(round, m, m.y + 2);
    ghoul.advance(round, 4, steady);
    ghoul.advance(round, 4, steady);
    return { m, near, far, round };
  };
  const plain = hit(false, "zombie");
  assert.equal(plain.near.hp, plain.near.max, "nothing splashes without it");
  const holy = hit(true, "zombie");
  assert.equal(holy.m.max - holy.m.hp, 1, "the hit one takes one");
  assert.equal(holy.near.max - holy.near.hp, 1, "the one next to it takes one");
  assert.equal(holy.far.hp, holy.far.max, "one beyond 4 does not");
  assert.equal(events(holy.round, "holySplash").length, 1);
  // Double to ghost kinds.
  for (const kind of ["ghost", "chorister", "wraith"]) {
    const plainHit = hit(false, kind, kind === "ghost" ? { phase: 600 } : kind === "wraith" ? { act: "hover" } : {});
    const holyHit = hit(true, kind, kind === "ghost" ? { phase: 600 } : kind === "wraith" ? { act: "hover" } : {});
    assert.equal(plainHit.m.max - plainHit.m.hp, 1, `${kind}: one without it`);
    assert.equal(holyHit.m.max - holyHit.m.hp, 2, `${kind}: two with it`);
  }
  // A monster that is not a ghost kind takes the one.
  const monk = hit(true, "monk");
  assert.equal(monk.m.max - monk.m.hp, 1);
  // A splash kills too, with its kill and its points.
  const kill = chapelRound("nave");
  standAt(kill, 20);
  kill.you.safeMs = 1e9;
  ghoul.applyPower(kill, "holy");
  const a = put(kill, "zombie", 60);
  const b = put(kill, "bellbat", 61, { act: "swoop", y: 8 });
  bolt(kill, a, a.y + 2);
  ghoul.advance(kill, 4, steady);
  ghoul.advance(kill, 4, steady);
  assert.equal(b.dead, true, "a bat caught in the splash falls");
  assert.equal(events(kill, "kill").some((e) => e.kind === "bellbat"), true);
});

/* ------------------------------------------------------ the Choirmaster */

// The choir, you in the arena, the Choirmaster awake: pipes made, his
// baton down, nothing spewing, the bell far off.
function choirFight() {
  const round = chapelRound("choir");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  ghoul.advance(round, 8, steady);
  round.you.safeMs = 1e9;
  round.events.length = 0;
  hold(round);
  return round;
}

// Holds him in place: no columns, no ghosts, no toll.
function hold(round) {
  const b = round.boss;
  b.act = "idle";
  b.wait = 1e9;
  for (const p of b.pipes) p.spewIn = 1e9;
  round.twist = { next: 1e9, swing: false, frozen: false };
}

const staff = (round) => ch.ROWS.map((r) => round.spec.ground.find(([a, c]) => a <= round.boss.x && c >= round.boss.x)[2] + r);

test("The Choirmaster glides to his organ and conducts: four pipes of 8 hp stand in the arena, and while any sounds he cannot be hurt by a bolt or a stomp", () => {
  const round = chapelRound("choir");
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  const b = round.boss;
  assert.equal(b.kind, "choirmaster");
  assert.equal(b.state, "intro");
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(b.state, "fight");
  round.you.safeMs = 1e9;
  ghoul.advance(round, 8, steady);
  assert.equal(b.pipes.length, 4);
  assert.deepEqual(b.pipes.map((p) => p.hp), [8, 8, 8, 8]);
  assert.ok(b.pipes.every((p) => p.on), "all four sound");
  assert.deepEqual(b.pipes.map((p) => p.x - round.spec.arena), [...ch.PIPE_AT]);
  assert.ok(b.pipes.every((p) => p.y === 6), "on the arena's floor");
  const home = round.spec.length - ch.HOME_FROM_END;
  assert.notEqual(b.x, home, "he is not there yet");
  until(round, () => b.x === home, 4000);
  assert.equal(b.x, home, "he takes his place");
  assert.equal(b.dir, -1, "facing you");
  hold(round);
  // Guarded: a bolt into him is blocked, a stomp too.
  const hp = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  run(round, 20);
  assert.equal(b.hp, hp);
  assert.ok(events(round, "bossBlock").length >= 1, "it glances off");
  standAt(round, b.x, 1, b.y + b.h + 0.5);
  Object.assign(round.you, { state: "air", vy: -10, safeMs: 1e9, shelf: -1 });
  until(round, () => events(round, "stomp").length > 0, 400);
  assert.equal(b.hp, hp, "no stomp hurts him either");
  // His touch is his own.
  standAt(round, b.x - 3);
  round.you.safeMs = 0;
  run(round, 20);
  assert.equal(events(round, "lose")[0]?.cause, "choirmaster");
});

test("The Choirmaster's pipes take shots from the floor or a board, one at a time in a row; shoot one to nothing and it is silenced, silence all four and he is open", () => {
  const round = choirFight();
  const b = round.boss;
  const [p0, p1, p2, p3] = b.pipes;
  // A bolt from the floor at chest height hits the first sounding pipe in line.
  standAt(round, p0.x - 12);
  round.you.face = 1;
  round.you.safeMs = 1e9;
  round.input.fire = true;
  run(round, 300);
  round.input.fire = false;
  assert.ok(p0.hp < 8, "the first pipe takes it");
  assert.equal(p1.hp, 8, "not the ones behind it");
  assert.ok(events(round, "pipeHit").length >= 2);
  // From a board too.
  const shelf = round.spec.shelves[1];
  standAt(round, p0.x - 6, 1, shelf[2], 1);
  round.you.safeMs = 1e9;
  const before = p0.hp;
  round.input.fire = true;
  run(round, 120);
  round.input.fire = false;
  assert.ok(p0.hp < before, "a bolt from a board reaches it");
  // Silence it: the event, the pipe quiet, and a bolt now goes on to the next.
  p0.hp = 1;
  round.shots.length = 0;
  round.shots.push({ x: p0.x - 3, y: p0.y + 4, vx: 80, vy: 0, gone: 0 });
  round.events.length = 0;
  run(round, 60);
  assert.equal(p0.on, false);
  assert.equal(events(round, "pipeSilence").length, 1);
  assert.equal(events(round, "pipeSilence")[0].left, 3);
  assert.equal(events(round, "choirOpen").length, 0, "three still sound");
  round.shots.push({ x: p0.x - 3, y: p0.y + 4, vx: 80, vy: 0, gone: 0 });
  run(round, 250);
  assert.ok(p1.hp < 8, "past the silent one to the next");
  const hp = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  run(round, 20);
  assert.equal(b.hp, hp, "still guarded with three left");
  for (const p of [p1, p2, p3]) {
    p.hp = 1;
    round.shots.push({ x: p.x - 3, y: p.y + 4, vx: 80, vy: 0, gone: 0 });
    run(round, 60);
  }
  assert.deepEqual(b.pipes.map((p) => p.on), [false, false, false, false]);
  assert.equal(events(round, "choirOpen").length, 1, "open when the last goes quiet");
  assert.equal(events(round, "pipeSilence").length, 4);
  // Open: a bolt hurts him, the hit carries his kind.
  round.events.length = 0;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  run(round, 20);
  assert.equal(b.hp, hp - 1);
  assert.equal(events(round, "bossHit")[0]?.kind, "choirmaster");
  // And a stomp does 3.
  standAt(round, b.x, 1, b.y + b.h + 0.5);
  Object.assign(round.you, { state: "air", vy: -10, safeMs: 1e9, shelf: -1 });
  until(round, () => events(round, "stomp").length > 0, 400);
  assert.equal(b.hp, hp - 1 - ghoul.STOMP_DAMAGE);
});

test("A sounding pipe spews a ghost now and then, never more than three ghosts alive at once, and a silent pipe spews none", () => {
  const round = choirFight();
  const b = round.boss;
  b.pipes[0].on = false;
  b.pipes.forEach((p) => (p.spewIn = 0));
  let most = 0;
  const from = new Set();
  for (let t = 0; t < 14000; t += 4) {
    ghoul.advance(round, 4, steady);
    round.you.safeMs = 1e9;
    round.twist.next = 1e9;
    b.act = "idle";
    b.wait = 1e9;
    most = Math.max(most, round.monsters.filter((m) => m.kind === "ghost").length);
    for (const e of round.events) if (e.type === "pipeSpew") from.add(e.pipe);
    round.events.length = 0;
    if (t % 1000 === 0) round.monsters = round.monsters.filter((m, i) => m.kind !== "ghost" || i % 2);
  }
  assert.ok(most >= 2, "ghosts do come");
  assert.ok(most <= ch.GHOST_CAP, `never more than ${ch.GHOST_CAP} (${most})`);
  assert.equal(from.has(0), false, "the silent pipe spews none");
  assert.ok(from.size >= 2, "the others do");
  // The ghosts come out high on the pipes.
  const one = choirFight();
  one.boss.pipes.forEach((p, i) => (p.spewIn = i ? 1e9 : 0));
  run(one, 20);
  const ghost = one.monsters.find((m) => m.kind === "ghost");
  assert.ok(ghost && ghost.y > 6 + ch.PIPE_H[0] * 0.5 && Math.abs(ghost.x - one.boss.pipes[0].x) < 3);
});

/* --------------------------------------------------------- the notes */

// The surfaces you can stand on in the choir's arena: the floor and each board.
const levels = (spec) => [{ y: 6, shelf: -1, x: spec.arena + 40 }, ...spec.shelves.map(([a, b, y], i) => ({ y, shelf: i, x: (a + b) / 2 }))];

test("The Choirmaster raises his baton, then a column of notes flies at you along the lines of a staff: four notes, one gap, and be at the gap's height when it passes", () => {
  const round = choirFight();
  const b = round.boss;
  Object.assign(b, { act: "idle", wait: 0, gap: 1 });
  const cue = log(round, 700, "notesCue");
  assert.equal(cue.length, 1, "the baton goes up first");
  assert.equal(cue[0][1].gap, 1);
  assert.equal(round.hazards.filter((h) => h.kind === "note").length, 0, "no notes yet");
  const launched = log(round, 100, "notes");
  assert.equal(launched.length, 1);
  const notes = round.hazards.filter((h) => h.kind === "note");
  assert.equal(notes.length, 4, "four notes");
  assert.equal(launched[0][1].gap, 1);
  const rows = notes.map((n) => n.row).sort();
  assert.deepEqual(rows, [0, 2, 3, 4], "row 1 is the gap");
  const want = staff(round);
  for (const n of notes) assert.ok(Math.abs(n.y + ch.NOTE / 2 - want[n.row]) < 1e-9, "on the staff's lines");
  assert.equal(ch.ROWS.length, 5, "five lines");
  assert.ok(ch.ROWS.every((r, i) => !i || Math.abs(r - ch.ROWS[i - 1] - ch.ROW_GAP) < 1e-9), "evenly spaced");
  assert.ok(notes.every((n) => n.x < b.x - b.w / 2), "from him, flying your way");
  const x0 = notes[0].x;
  run(round, 500);
  assert.ok(notes[0].x < x0 - 8, "and it flies");
  assert.ok(Math.abs((x0 - notes[0].x) / 0.5 - ch.NOTE_V) < 1, "at NOTE_V");
  // Then another a column's time on.
  hold(round);
  Object.assign(b, { act: "idle", wait: ch.COLUMN_MS });
  const next = log(round, ch.COLUMN_MS + 100, "notesCue");
  assert.equal(next.length, 1);
});

test("Every column of notes can be passed: for each gap a surface in the arena (the floor or a board) clears all the rest, and standing anywhere else costs a life", () => {
  const spec = ghoul.roomFor("choir");
  const fits = (g, feet) => ch.ROWS.every((row, i) => i === g || feet + ghoul.HIT_H <= 6 + row - ch.NOTE / 2 - 0.05 || feet >= 6 + row + ch.NOTE / 2 + 0.05);
  const floors = levels(spec);
  const margin = (g, feet) => Math.min(...ch.ROWS.filter((_, i) => i !== g).map((row) => Math.max(6 + row - ch.NOTE / 2 - (feet + ghoul.HIT_H), feet - (6 + row + ch.NOTE / 2)))).toFixed(1);
  const safe = [];
  for (let g = 0; g < ch.GAPS; g++) {
    const ok = floors.filter((l) => fits(g, l.y));
    assert.ok(ok.length >= 1, `gap ${g}: a surface that clears it`);
    safe.push(ok[0]);
    assert.ok(Number(margin(g, ok[0].y)) >= 0.5, `gap ${g}: with room to spare (${margin(g, ok[0].y)})`);
    // And it is the surface for this gap alone.
    assert.equal(floors.filter((l) => fits(g, l.y)).length, 1, `gap ${g}: one surface`);
  }
  // Played out with the real round: stand there and nothing hurts; stand anywhere else and a note does.
  for (let g = 0; g < ch.GAPS; g++) {
    for (const [at, level] of floors.entries()) {
      const round = choirFight();
      const b = round.boss;
      until(round, () => b.x === round.spec.length - ch.HOME_FROM_END, 4000);
      hold(round);
      Object.assign(b, { gap: g, act: "idle", wait: 0 });
      standAt(round, level.x, 1, level.y, level.shelf);
      round.you.safeMs = 0;
      for (let t = 0; t < 8000 && round.phase === "play"; t += 4) {
        ghoul.advance(round, 4, steady);
        if (b.act === "idle" && b.wait < 1e8) b.wait = 1e9;
      }
      const lost = events(round, "lose");
      if (level === safe[g]) assert.equal(lost.length, 0, `gap ${g}, standing on level ${at}: untouched`);
      else {
        assert.equal(lost.length, 1, `gap ${g}, standing on level ${at}: hit`);
        assert.equal(lost[0].cause, "note");
      }
    }
  }
});

test("Every column can be reached from the one before: the next gap is the same height or one step either side, over a long fight", () => {
  const round = choirFight();
  const gaps = [];
  const rand = ghoul.seeded(2);
  round.boss.act = "idle";
  round.boss.wait = 0;
  for (let t = 0; t < 70000; t += 4) {
    ghoul.advance(round, 4, rand);
    round.you.safeMs = 1e9;
    round.boss.pipes.forEach((p) => (p.spewIn = 1e9));
    round.twist.next = 1e9;
    for (const e of round.events) if (e.type === "notes" && !e.pair) gaps.push(e.gap);
    round.events.length = 0;
  }
  assert.ok(gaps.length >= 15, `${gaps.length} columns`);
  assert.ok(gaps.every((g) => g >= 0 && g < ch.GAPS), "gaps within the staff");
  assert.ok(gaps.every((g, i) => !i || Math.abs(g - gaps[i - 1]) <= 1), "each within a step of the last");
  assert.equal(new Set(gaps).size, ch.GAPS, "and they vary through every height");
});

test("A jump from the floor clears the third gap too, with a window of about a fifth of a second to time it in", () => {
  const spec = ghoul.roomFor("choir");
  const x = spec.arena + 12;
  const clears = (jumpAt) => {
    const r = choirFight();
    hold(r);
    standAt(r, x);
    r.you.safeMs = 0;
    const base = 6;
    // A column of four notes, row 2 (the gap) missing, 66 units off, flying at NOTE_V.
    ch.ROWS.forEach((row, i) => {
      if (i !== 2) r.hazards.push({ kind: "note", x: x + 66, y: base + row - ch.NOTE / 2, w: ch.NOTE, h: ch.NOTE, row: i, v: ch.NOTE_V, live: 1, life: 7000, cause: "note" });
    });
    for (let t = 0; t < 4400 && r.phase === "play"; t += 4) {
      r.input.up = t >= jumpAt && t < jumpAt + 500;
      if (t === jumpAt) r.input.jump = ghoul.JUMP_BUFFER_MS;
      ghoul.advance(r, 4, steady);
    }
    return events(r, "lose").length === 0;
  };
  const wins = [];
  for (let jumpAt = 2400; jumpAt <= 3200; jumpAt += 20) wins.push(clears(jumpAt));
  const ok = wins.filter(Boolean).length;
  assert.ok(ok >= 7, `a window of jump times clears it (${ok} of ${wins.length} at 20 ms)`);
  assert.ok(ok < wins.length - 5, "and a bad jump does not");
  assert.equal(clears(0), false, "standing on the floor with the gap high up is hit");
});

/* ----------------------------------------------------------- the rage */

test("The Choirmaster at half his hp: a rage that is told, and no pipe comes back for it alone", () => {
  const round = choirFight();
  const b = round.boss;
  b.pipes.forEach((p) => {
    p.on = false;
    p.hp = 0;
  });
  b.hp = b.max * 0.5 + 1;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  run(round, 20);
  assert.equal(b.hp, b.max * 0.5);
  assert.equal(events(round, "choirRage").length, 1, "the rage is told");
  assert.equal(b.raged, true);
  assert.deepEqual(b.pipes.map((p) => p.on), [false, false, false, false], "none yet");
  // He is held to no columns, so the pipes stay down however long it takes.
  run(round, 30000);
  assert.equal(events(round, "pipeSound").length, 0);
  assert.ok(b.pipes.every((p) => !p.on));
});

/* ------------------------------------------- the pipes drop back in */

// A fight with all four pipes shot silent, his next cue due now.
function openFight() {
  const round = choirFight();
  const b = round.boss;
  until(round, () => b.x === round.spec.length - ch.HOME_FROM_END, 4000);
  hold(round);
  for (const p of b.pipes) {
    p.hp = 1;
    round.shots.push({ x: p.x - 3, y: p.y + 4, vx: 80, vy: 0, gone: 0 });
    run(round, 60);
  }
  assert.ok(b.pipes.every((p) => !p.on));
  Object.assign(b, { act: "idle", wait: 0 });
  round.events.length = 0;
  return round;
}

// Runs a fight until `n` columns are away, you kept safe and the bell off.
function columns(round, n, random = steady) {
  const flownSoFar = () => events(round, "notes").filter((e) => !e.pair).length;
  const want = flownSoFar() + n;
  for (let t = 0; t < 60000 && (flownSoFar() < want || round.boss.act !== "idle"); t += 4) {
    ghoul.advance(round, 4, random);
    round.you.safeMs = 1e9;
    round.twist.next = 1e9;
    round.monsters.length = 0;
  }
}

test("The Choirmaster's pipes drop back in: with all four silent he stays open for four columns, warns on the third, and the fourth brings all of them back at full hp", () => {
  const round = openFight();
  const b = round.boss;
  assert.equal(ch.PIPES_BACK, 4);
  columns(round, 2);
  assert.ok(b.pipes.every((p) => !p.on), "still open after two");
  assert.equal(events(round, "pipesStir").length, 0);
  columns(round, 1);
  assert.ok(b.pipes.every((p) => !p.on), "still open after three");
  assert.equal(b.quiet, 1, "one column left");
  assert.equal(events(round, "pipesStir").length, 1, "and it warns you");
  const hp = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.hp, hp - 1, "and still to be hurt");
  columns(round, 1);
  assert.ok(b.pipes.every((p) => p.on && p.hp === p.max), "all four, at full hp");
  assert.ok(b.pipes.every((p) => p.dropMs > 0), "falling");
  // Guarded from the moment they start to fall.
  const now = b.hp;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  ghoul.advance(round, 4, steady);
  assert.equal(b.hp, now, "guarded again");
});

test("A falling pipe cannot be shot and spews nothing; each lands in turn with its sound, and then has to be silenced all over again, which starts the count anew", () => {
  const round = openFight();
  const b = round.boss;
  columns(round, ch.PIPES_BACK);
  const [first, , , last] = b.pipes;
  assert.equal(last.dropMs - first.dropMs, 3 * ch.PIPE_DROP_STAGGER_MS, "one after another");
  hold(round);
  // A bolt passes through a pipe still in the air.
  round.events.length = 0;
  round.shots.push({ x: first.x - 3, y: first.y + 4, vx: 80, vy: 0, gone: 0 });
  run(round, 60);
  assert.equal(first.hp, first.max);
  assert.equal(events(round, "pipeHit").length, 0);
  assert.equal(events(round, "pipeSpew").length, 0);
  // They land one at a time.
  const lands = log(round, ch.PIPE_DROP_MS + 4 * ch.PIPE_DROP_STAGGER_MS, "pipeSound");
  assert.deepEqual(lands.map(([, e]) => e.pipe), [0, 1, 2, 3]);
  assert.ok(b.pipes.every((p) => !(p.dropMs > 0)));
  // Landed: shots count again, and silencing all four opens him and starts over.
  for (const p of b.pipes) {
    p.hp = 1;
    p.spewIn = 1e9;
    round.shots.push({ x: p.x - 3, y: p.y + 4, vx: 80, vy: 0, gone: 0 });
    run(round, 60);
  }
  assert.ok(b.pipes.every((p) => !p.on), "silenced again");
  assert.ok(events(round, "choirOpen").length >= 1);
  run(round, 8);
  assert.equal(b.quiet, ch.PIPES_BACK, "the count starts over");
});

test("The pipes only come back once all four are silent: columns flown with one still sounding count for nothing, and the rage changes none of it", () => {
  const round = choirFight();
  const b = round.boss;
  b.pipes.forEach((p, i) => (p.on = i === 0));
  Object.assign(b, { act: "idle", wait: 0 });
  columns(round, ch.PIPES_BACK + 2);
  assert.deepEqual(b.pipes.map((p) => p.on), [true, false, false, false]);
  assert.equal(b.quiet, null);
  const mad = openFight();
  mad.boss.hp = mad.boss.max * 0.4;
  columns(mad, ch.PIPES_BACK - 1, ghoul.seeded(3));
  assert.ok(mad.boss.pipes.every((p) => !p.on), "not yet");
  columns(mad, 1, ghoul.seeded(4));
  assert.ok(mad.boss.pipes.every((p) => p.on), "back in the rage too");
});

/* --------------------------------------- each column at its own speed */

// A long fight from a seed, every column as { at, v, pair, end }: `end` when it
// reaches the arena's far end. Bolts, ghosts and the bell kept out of it.
function flown(seed, raged) {
  const round = choirFight();
  const b = round.boss;
  until(round, () => b.x === round.spec.length - ch.HOME_FROM_END, 4000);
  hold(round);
  if (raged) {
    b.hp = b.max * 0.4;
    b.raged = true;
  }
  Object.assign(b, { act: "idle", wait: 0, gap: 1 });
  const random = ghoul.seeded(seed);
  const end = round.spec.arena - 6;
  const got = [];
  for (let t = 0; t < 120000; t += 4) {
    ghoul.advance(round, 4, random);
    round.you.safeMs = 1e9;
    round.twist.next = 1e9;
    b.pipes.forEach((p) => (p.spewIn = 1e9));
    round.monsters.length = 0;
    for (const e of round.events) if (e.type === "notes") got.push({ at: round.clock, v: e.v, pair: e.pair, gap: e.gap, end: round.clock + ((e.x - end) / e.v) * 1000 });
    round.events.length = 0;
  }
  return { round, got };
}

test("Every column of notes flies at its own speed: the whole column together, some far faster than usual and some far slower, in no fixed order", () => {
  const { got } = flown(7, false);
  assert.ok(got.length >= 25, `${got.length} columns`);
  const vs = got.map((c) => c.v);
  assert.ok(Math.min(...vs) <= ch.NOTE_V * 0.6, `some slow (${Math.min(...vs).toFixed(1)})`);
  assert.ok(Math.max(...vs) >= ch.NOTE_V * 1.3, `some fast (${Math.max(...vs).toFixed(1)})`);
  assert.ok(new Set(vs.map((v) => v.toFixed(1))).size >= 5, "many speeds");
  // One launch: every note in it alike, with the edge the art draws from.
  const round = choirFight();
  Object.assign(round.boss, { act: "idle", wait: 0 });
  run(round, ch.CUE_MS + 20);
  const notes = round.hazards.filter((h) => h.kind === "note");
  assert.equal(notes.length, 4);
  assert.equal(new Set(notes.map((n) => n.v)).size, 1, "a column flies together");
  assert.ok(notes.every((n) => n.pace === 1), "the middle draw is the usual speed");
  // Different draws, different speeds: the table's ends are real.
  for (const [draw, pace] of [[0, ch.NOTE_PACE[0]], [0.999, ch.NOTE_PACE.at(-1)]]) {
    const r = choirFight();
    Object.assign(r.boss, { act: "cue", wait: 0, gap: 1, second: null });
    ghoul.advance(r, 4, () => draw);
    const n = r.hazards.find((h) => h.kind === "note");
    assert.ok(Math.abs(n.v - ch.NOTE_V * pace) < 1e-9, `draw ${draw}`);
  }
});

test("No column ever catches the one ahead: wherever you stand you get time between two gaps, a pair keeps its spacing, and even the slowest crosses the arena", () => {
  for (const raged of [false, true]) {
    for (const seed of [1, 2, 3, 4]) {
      const { got } = flown(seed, raged);
      assert.ok(got.length >= 20);
      for (let i = 1; i < got.length; i++) {
        const gap = got[i].end - got[i - 1].end;
        const least = got[i].pair ? ch.PAIR_MS : ch.NOTE_SEP_MS;
        assert.ok(gap >= least - 20, `seed ${seed}, column ${i}: ${gap.toFixed(0)} ms behind at the far end`);
        // Launched later and arriving later, so it is behind at every spot between.
        assert.ok(got[i].at > got[i - 1].at);
      }
      if (raged) assert.ok(got.some((c) => c.pair), "pairs in the rage");
      for (let i = 1; i < got.length; i++) if (got[i].pair) assert.equal(got[i].v, got[i - 1].v, "a pair flies as one");
    }
  }
  // The slowest note lives long enough to leave by the far end.
  const round = choirFight();
  const b = round.boss;
  until(round, () => b.x === round.spec.length - ch.HOME_FROM_END, 4000);
  hold(round);
  Object.assign(b, { act: "cue", wait: 0, gap: 1, second: null });
  ghoul.advance(round, 4, () => 0);
  hold(round);
  const note = round.hazards.find((h) => h.kind === "note");
  let lowest = note.x;
  for (let t = 0; t < 12000 && round.hazards.includes(note); t += 4) {
    ghoul.advance(round, 4, steady);
    round.you.safeMs = 1e9;
    round.twist.next = 1e9;
    lowest = Math.min(lowest, note.x);
  }
  assert.ok(lowest <= round.spec.arena - 5.5, `reached ${lowest.toFixed(1)}`);
});

test("The Choirmaster in his rage conducts faster: notes at NOTE_V_RAGE, a column every 2.3 s, and sometimes a second column 1.1 s behind the first, its gap next to the first's", () => {
  const round = choirFight();
  const b = round.boss;
  b.pipes.forEach((p) => (p.on = false));
  b.hp = b.max * 0.5 - 1;
  b.raged = true;
  const random = ghoul.seeded(5);
  Object.assign(b, { act: "idle", wait: 0, gap: 1 });
  const pairs = [];
  const notes = [];
  let speed = null;
  for (let t = 0; t < 40000; t += 4) {
    ghoul.advance(round, 4, random);
    round.you.safeMs = 1e9;
    round.twist.next = 1e9;
    for (const e of round.events) if (e.type === "notes") notes.push([round.clock, e]);
    round.events.length = 0;
    speed ||= round.hazards.find((h) => h.kind === "note")?.v;
  }
  assert.ok(notes.length >= 10);
  for (let i = 0; i < notes.length; i++) if (notes[i][1].pair) pairs.push([notes[i - 1], notes[i]]);
  assert.ok(pairs.length >= 2, "pairs");
  for (const [first, second] of pairs) {
    assert.ok(Math.abs(second[0] - first[0] - ch.PAIR_MS) < 60, `${second[0] - first[0]} ms behind`);
    assert.ok(Math.abs(second[1].gap - first[1].gap) === 1, "its gap next to the first's");
  }
  // A column (or a pair) every 2.3 s after the last, plus the baton's 0.7 s.
  let spaced = 0;
  for (let i = 1; i < notes.length; i++) {
    if (notes[i][1].pair) continue;
    assert.ok(Math.abs(notes[i][0] - notes[i - 1][0] - ch.COLUMN_RAGE_MS - ch.CUE_MS) < 80, `a column every 2.3 s (${notes[i][0] - notes[i - 1][0]})`);
    spaced++;
  }
  assert.ok(spaced >= 5);
  // Faster notes: the same draw flies faster in the rage.
  assert.ok(speed > 0);
  assert.ok(ch.NOTE_V_RAGE > ch.NOTE_V && ch.COLUMN_RAGE_MS < ch.COLUMN_MS);
  const mad = choirFight();
  Object.assign(mad.boss, { hp: mad.boss.max * 0.4, raged: true, act: "cue", wait: 0, gap: 1, second: null });
  ghoul.advance(mad, 4, steady);
  assert.equal(mad.hazards.find((h) => h.kind === "note").v, ch.NOTE_V_RAGE * mad.spec.pace);
  // Without the rage, the same draws give no pairs.
  const calm = choirFight();
  Object.assign(calm.boss, { act: "idle", wait: 0, gap: 1 });
  const calmPairs = [];
  for (let t = 0; t < 12000; t += 4) {
    ghoul.advance(calm, 4, () => 0.1);
    calm.you.safeMs = 1e9;
    calm.boss.pipes.forEach((p) => (p.spewIn = 1e9));
    calm.twist.next = 1e9;
    for (const e of calm.events) if (e.type === "notes" && e.pair) calmPairs.push(e);
    calm.events.length = 0;
  }
  assert.equal(calmPairs.length, 0);
});

test("The Choirmaster's toll freezes him, his pipes' ghosts and his notes in mid-air too, though a bolt in flight still hits a pipe or him; and his fall puts every note away", () => {
  const round = choirFight();
  const b = round.boss;
  until(round, () => b.x === round.spec.length - ch.HOME_FROM_END, 4000);
  b.act = "idle";
  b.wait = 0;
  round.twist.next = 5;
  run(round, 8);
  assert.ok(round.stunMs > 0, "the bell tolled in the fight");
  round.hazards.push({ kind: "note", x: 150, y: 10, w: 1.6, h: 1.6, v: 20, live: 1, life: 7000, cause: "note" });
  const before = { x: b.x, wait: b.wait, act: b.act, note: 150, spew: b.pipes[0].spewIn };
  run(round, 500);
  assert.equal(b.x, before.x);
  assert.equal(b.wait, before.wait, "his timers stand still");
  assert.equal(b.pipes[0].spewIn, before.spew);
  assert.equal(round.hazards.find((h) => h.kind === "note").x, before.note);
  // A bolt in flight hits the pipe.
  const p = b.pipes[0];
  round.shots.push({ x: p.x - 3, y: p.y + 4, vx: 80, vy: 0, gone: 0 });
  run(round, 60);
  assert.equal(p.hp, 7, "a pipe is hit while frozen");
  // The fall of the boss puts every note away and ends the bell.
  b.pipes.forEach((q) => (q.on = false));
  b.hp = 1;
  round.stunMs = 0;
  round.shots.push({ x: b.x - b.w / 2 - 0.2, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  run(round, 20);
  assert.equal(b.state, "down");
  assert.equal(round.hazards.length, 0);
  assert.equal(round.hasKey, true);
});

test("The Choirmaster is tougher and stays his own: hp ~100 more each stage deeper, a bolt hit carries his kind, and the endless-lives code spares a life from every new way to die", () => {
  assert.equal(ch.BOSSES.choirmaster.hp, 100);
  assert.equal(ch.BOSSES.choirmaster.points, 3500);
  assert.equal([ch.BOSSES.choirmaster.w, ch.BOSSES.choirmaster.h].join("x"), "8x17");
  const deep = ghoul.roomFor("choir", 3);
  assert.ok(deep.bossHp > ch.BOSSES.choirmaster.hp);
  for (const cause of ["gargoyle", "chorister", "monk", "bellbat", "choirmaster", "note"]) {
    const round = choirFight();
    round.infinite = true;
    const lives = round.lives;
    ghoul.lose(round, cause);
    assert.equal(round.lives, lives, `${cause} costs none`);
  }
  // A note, spared by endless lives, still ends in a crash and a respawn.
  const round = choirFight();
  round.infinite = true;
  const lives = round.lives;
  round.hazards.push({ kind: "note", x: round.you.x, y: round.you.y, w: 1.6, h: 1.6, v: 0, live: 1, life: 7000, cause: "note" });
  round.you.safeMs = 0;
  run(round, 20);
  assert.equal(events(round, "lose")[0]?.cause, "note");
  assert.equal(round.lives, lives);
});

/* ---------------------------------------------------- voices and drawing */

test("Ghoul Rush's Chapel: every new kind has a voice for every act and every new event plays exactly one picked sound", () => {
  const own = {
    gargoyle: ["appear", "wake", "dive", "perch", "glance", "hurt", "die"],
    chorister: ["appear", "sing", "hush", "hurt", "die"],
    monk: ["appear", "censer", "smoke", "hurt", "die"],
    bellbat: ["appear", "burst", "hurt", "die"],
    bell: ["swing", "toll"],
    holy: ["splash"],
    choirmaster: ["wake", "cue", "notes", "pipeSpew", "pipeHit", "pipeSilence", "pipeSound", "open", "rage", "hurt", "die"],
  };
  for (const [kind, acts] of Object.entries(own)) assert.deepEqual(Object.keys(VOICES[kind]).sort(), [...acts].sort(), `${kind}: every act`);
  const names = Object.values(VOICES).flatMap((v) => Object.values(v));
  const cases = [
    [{ type: "glance", kind: "gargoyle" }, "gargoyle", "glance"],
    [{ type: "gargoyleWake", kind: "gargoyle" }, "gargoyle", "wake"],
    [{ type: "gargoyleDive", kind: "gargoyle" }, "gargoyle", "dive"],
    [{ type: "gargoylePerch", kind: "gargoyle" }, "gargoyle", "perch"],
    [{ type: "choirSing", kind: "chorister" }, "chorister", "sing"],
    [{ type: "choirHush", kind: "chorister" }, "chorister", "hush"],
    [{ type: "censerWind", kind: "monk" }, "monk", "censer"],
    [{ type: "smokePuff", kind: "monk" }, "monk", "smoke"],
    [{ type: "bellBurst", kind: "bellbat" }, "bellbat", "burst"],
    [{ type: "bellSwing", ms: 1200 }, "bell", "swing"],
    [{ type: "toll", ms: 1000 }, "bell", "toll"],
    [{ type: "holySplash", n: 1 }, "holy", "splash"],
    [{ type: "pipeSpew", kind: "choirmaster" }, "choirmaster", "pipeSpew"],
    [{ type: "pipeHit", kind: "choirmaster" }, "choirmaster", "pipeHit"],
    [{ type: "pipeSilence", kind: "choirmaster", left: 2 }, "choirmaster", "pipeSilence"],
    [{ type: "pipeSound", kind: "choirmaster" }, "choirmaster", "pipeSound"],
    [{ type: "choirOpen", kind: "choirmaster" }, "choirmaster", "open"],
    [{ type: "choirRage", kind: "choirmaster" }, "choirmaster", "rage"],
    [{ type: "notesCue", kind: "choirmaster", gap: 1 }, "choirmaster", "cue"],
    [{ type: "notes", kind: "choirmaster", gap: 1, pair: false }, "choirmaster", "notes"],
    [{ type: "bossWake", kind: "choirmaster" }, "choirmaster", "wake"],
    [{ type: "bossHit", kind: "choirmaster", how: "shot" }, "choirmaster", "hurt"],
    [{ type: "bossHit", kind: "choirmaster", how: "splash" }, "choirmaster", "hurt"],
    [{ type: "bossDown", kind: "choirmaster", points: 1 }, "choirmaster", "die"],
    [{ type: "hit", kind: "gargoyle" }, "gargoyle", "hurt"],
    [{ type: "kill", kind: "monk", mult: 1, how: "shot", points: 1 }, "monk", "die"],
    [{ type: "kill", kind: "gargoyle", mult: 1, how: "holy", points: 1 }, "gargoyle", "die"],
    [{ type: "spawn", kind: "chorister" }, "chorister", "appear"],
    [{ type: "spawn", kind: "bellbat" }, "bellbat", "appear"],
  ];
  for (const [e, kind, act] of cases) {
    const played = heard(e).played;
    assert.ok(played.includes(VOICES[kind][act]), `${e.type}: ${kind} ${act}`);
    assert.equal(played.filter((n) => names.includes(n)).length, 1, `${e.type} plays exactly one picked sound`);
  }
  // The quiet ones: the thaw after a toll, and a glance off a stone gargoyle plays only its glance.
  assert.equal(heard({ type: "tollEnd", x: 10, y: 20 }).played.filter((n) => names.includes(n)).length, 0, "the thaw is quiet");
  assert.deepEqual(heard({ type: "glance", kind: "gargoyle", x: 5, y: 5 }).played, [VOICES.gargoyle.glance], "a glance plays only the glance");
  assert.deepEqual(heard({ type: "bossHit", kind: "choirmaster", how: "splash", x: 5, y: 5 }).played.filter((n) => n !== "bump"), [VOICES.choirmaster.hurt], "a splash on him is one hurt");
  // The sounds exist, live in the stage's own file, and are named by kind and act.
  const merged = ghoulSfx.default.tones;
  const cap = (w) => w[0].toUpperCase() + w.slice(1);
  for (const kind of Object.keys(own)) {
    for (const [act, name] of Object.entries(VOICES[kind])) {
      assert.ok(merged[name]?.layers?.length, `${kind}.${act}: ${name} is in the merged tones`);
      assert.ok(sfxChapel.CHAPEL_SFX.tones[name], `${name} lives in ghoul-sfx-chapel.js`);
      assert.equal(name, `ghoul${cap(kind)}${cap(act)}`, "named by kind and act");
    }
  }
  assert.equal(Object.keys(sfxChapel.CHAPEL_SFX.tones).length, Object.values(own).flat().length, "no tone is unused");
  assert.deepEqual(Object.keys(sfxChapel.CHAPEL_SFX.music), ["ghoulNave", "ghoulTower", "ghoulLoft", "ghoulChoir"]);
  for (const room of ["nave", "tower", "loft", "choir"]) assert.ok(sfxChapel.CHAPEL_SFX.music[ghoul.ROOM_MUSIC[room]], `${room} has its own track`);
  assert.equal(Object.hasOwn(ghoulSfx.default.music, ghoul.ROOM_MUSIC.nave), true);
  // Every new event says something (a float, a banner or a sound).
  assert.deepEqual(heard({ type: "toll", ms: 1000 }).floats, ["Frozen!"]);
  assert.deepEqual(heard({ type: "pipeSilence", kind: "choirmaster", left: 0 }).floats, ["Silent!"]);
  assert.deepEqual(heard({ type: "pipesStir", kind: "choirmaster" }).floats, ["The pipes stir!"]);
});

test("Ghoul Rush's Chapel: every new way to die has its words and its own sound", () => {
  for (const cause of ["gargoyle", "chorister", "monk", "bellbat", "choirmaster", "note"]) {
    assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], `${cause} has its words and its sound`);
    assert.ok(heard({ type: "lose", cause, lives: 2 }).played.includes(LOSE_SOUNDS[cause][0]), `${cause} plays its own sound`);
  }
});

test("Ghoul Rush's Chapel draws: every room, every monster in every act, the Choirmaster in each move with his pipes sounding and silent, the notes, the smoke and the bell, and the stage's card, in a lit room and a dark one", () => {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const r = g.round;
  through(r);
  r.offer = ["chapel"];
  r.phaseMs = 0;
  ghoul.pickStage(r, 0);
  const acts = { gargoyle: ["perch", "wake", "dive", "return"], chorister: [""], monk: [""], bellbat: ["roost", "swoop"] };
  for (const id of ["nave", "tower", "loft", "choir"]) {
    while (r.spec.id !== id) through(r);
    for (const dark of [true, false]) {
      r.dark = dark;
      r.phase = "play";
      r.lives = 99;
      for (const st of r.spawns) st.over = true;
      r.hordeMs = Infinity;
      r.monsters.length = 0;
      standAt(r, id === "choir" ? r.spec.arena + ghoul.BOSS_LOCK + 2 : 40);
      r.you.safeMs = 1e9;
      for (const [kind, list] of Object.entries(acts)) {
        list.forEach((act, i) => put(r, kind, r.you.x + 6 + i * 5, { act: act || undefined, y: kind === "monk" ? undefined : 12, sing: kind === "chorister" ? 1000 : 0, windup: kind === "monk" ? 200 : 0, vx: 4, vy: -3 }));
      }
      r.twist = { next: 1e9, swing: false, frozen: false };
      r.hazards.push({ kind: "smoke", x: r.you.x + 8, y: 6, w: 10, h: 8, live: 0, life: 2000, age: 1000, cause: "smoke" }, { kind: "bell", x: r.camX + 48, y: 42, w: 0, h: 0, live: 0, p: 0.6, cause: "bell" }, { kind: "note", x: r.you.x + 20, y: 10, w: 1.6, h: 1.6, v: 0, live: 1, life: 5000, row: 1, cause: "note" });
      if (r.boss) {
        ghoul.advance(r, ghoul.BOSS_INTRO_MS + 16, steady);
        for (const sounding of [true, false]) {
          r.boss.pipes?.forEach((p) => (p.on = sounding));
          for (const act of ["glide", "idle", "cue", "pair"]) {
            Object.assign(r.boss, { act, wait: 1e9, dir: -1 });
            g.tick(16);
          }
        }
        r.stunMs = 500;
        g.tick(16);
        r.stunMs = 0;
        // The pipes rattling, then falling back in; notes of every speed.
        if (r.boss.pipes) {
          Object.assign(r.boss, { act: "idle", wait: 1e9, quiet: 1 });
          g.tick(16);
          r.boss.pipes.forEach((p, i) => Object.assign(p, { on: true, dropMs: 300 + i * 100 }));
          r.hazards.push({ kind: "note", x: r.you.x + 24, y: 10, w: 1.6, h: 1.6, v: 0, pace: 1.75, live: 1, life: 5000, row: 1, cause: "note" }, { kind: "note", x: r.you.x + 28, y: 10, w: 1.6, h: 1.6, v: 0, pace: 0.55, live: 1, life: 5000, row: 1, cause: "note" });
          g.tick(16);
        }
      }
      for (let k = 0; k < 20; k++) g.tick(16);
      r.you.safeMs = 1e9;
    }
  }
  assert.ok(r.spec.id === "choir", "got to the choir and drew it");
  // The stage's card on the pick screen.
  const pick = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  pick.resize(900, 900);
  pick.key("action");
  pick.tick(16);
  const p = pick.round;
  through(p);
  p.offer = ["chapel", "grounds"];
  p.phase = "pick";
  p.phaseMs = 0;
  for (let k = 0; k < 4; k++) pick.tick(16);
  assert.equal(p.phase, "pick", "the pick screen draws the Chapel's card");
});
