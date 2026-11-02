// Web console tests, Ghoul Rush's secondary weapons: the double tap that uses one (hammering spends one at most, a hold carries on as bolts), the bag and its HUD pill, what each weapon does, what they may do to a boss, where they are placed and how they drop, and that all of it draws and sounds.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import * as arm from "../src/web-console/public/activities/ghoul-arms.js";
import { rocketArt } from "../src/web-console/public/activities/ghoul-rockets-draw.js";
import * as pans from "../src/web-console/public/activities/ghoul-pans.js";
import { ARM_DROP, ARM_DROP_OWN, STAGE_ARMS, armDrop, pickPower } from "../src/web-console/public/activities/ghoul-powers.js";
import { ARMS_SFX } from "../src/web-console/public/activities/ghoul-sfx-arms.js";
import * as ghoulSfx from "../src/web-console/public/activities/ghoul-sfx.js";
import { hudLayout, react } from "../src/web-console/public/activities/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);
const COMMON = ["dyn", "stake", "rocket"];
const ALL = Object.keys(ghoul.POWERS).filter((k) => ghoul.POWERS[k].arm);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the stage `stage`'s room `id`, reached the way play reaches it,
// nothing woken: every spawner spent, the horde held back, nothing to pick up.
function roomOf(stage, id) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  if (stage) {
    through(round);
    round.offer = [stage];
    round.phaseMs = 0;
    ghoul.pickStage(round, 0);
    while (round.spec.id !== id) through(round);
  }
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.items.fill(true);
  round.candy.fill(true);
  round.sky.fill(true);
  round.timeMs = 1e9;
  round.bonus = 1e9;
  round.you.safeMs = 1e9;
  round.events.length = 0;
  return round;
}

function standAt(round, x, face = 1, y = ghoul.groundAt(round.spec, x)) {
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf: -1, coyote: 0, drop: -1, out: 0, face });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

const put = (round, kind, x, over = {}) => ghoul.spawnMonster(round, kind, x, over.y ?? ghoul.groundAt(round.spec, x), { rise: 0, ...over });

function run(round, ms, random = steady) {
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
}

const tapTap = (round) => {
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
};
const give = (round, kind, n = 1) => {
  round.arms = [{ kind, n }];
};
// A boss's fight under way, depth `depth` stages into a run.
function fightOf(stage, id, depth = 0) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.cleared = Array.from({ length: depth }, (_, i) => `x${i}`);
  round.offer = [stage];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== id) through(round);
  round.phase = "play";
  round.items.fill(true);
  round.timeMs = 1e9;
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.you.safeMs = 1e9;
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  round.you.safeMs = 1e9;
  round.events.length = 0;
  return round;
}

// The game itself, on a canvas that draws nothing.
function game() {
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const round = g.round;
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.you.safeMs = 1e9;
  return { g, round };
}

/* ----------------------------------------------------------- the double tap */

test("Ghoul Rush's double tap through the keys: the first press fires a bolt at once, the second uses the weapon, and held on, the bolts carry on after a short gap", () => {
  const { g, round } = game();
  give(round, "stake", 3);
  g.key("action");
  g.tick(16);
  const bolts = () => round.shots.filter((s) => !s.arm).length;
  assert.equal(bolts(), 1, "a bolt from the first press, with no wait");
  g.release("action");
  g.tick(16);
  g.key("action");
  assert.equal(round.arms[0].n, 2, "the second press uses it");
  assert.equal(round.shots.filter((s) => s.arm === "stake").length, 1);
  round.shots.length = 0;
  g.tick(16);
  assert.equal(bolts(), 0, "no bolt with the throw");
  for (let i = 0; i < arm.ARM_GAP_MS / 16 + 2; i++) g.tick(16);
  assert.ok(bolts() >= 1, "held on, the blaster carries on");
  g.release("action");
});

test("Ghoul Rush's double tap: a key repeat, a long first press, a slow second press and a plain hold never use a weapon", () => {
  // A key repeat is no press.
  const { g, round } = game();
  give(round, "stake", 3);
  g.key("action");
  g.tick(16);
  g.key("action", true);
  g.key("action", true);
  assert.equal(round.arms[0].n, 3, "repeats");
  g.release("action");
  // Too long a first press was the blaster's.
  const long = roomOf(null, "hall");
  standAt(long, 40);
  give(long, "stake", 3);
  ghoul.pressFire(long);
  run(long, arm.TAP_HOLD_MS + 20);
  ghoul.releaseFire(long);
  run(long, 20);
  ghoul.pressFire(long);
  assert.equal(long.arms[0].n, 3, "feathering is safe");
  // Too slow a second press starts again, and then counts as the first of a new pair.
  const slow = roomOf(null, "hall");
  standAt(slow, 40);
  give(slow, "stake", 3);
  ghoul.pressFire(slow);
  ghoul.releaseFire(slow);
  run(slow, arm.DOUBLE_TAP_MS + 8);
  ghoul.pressFire(slow);
  assert.equal(slow.arms[0].n, 3);
  ghoul.releaseFire(slow);
  ghoul.pressFire(slow);
  assert.equal(slow.arms[0].n, 2, "and that one's pair uses it");
  // Inside the window it is well within reach of a hand.
  const quick = roomOf(null, "hall");
  standAt(quick, 40);
  give(quick, "stake", 3);
  ghoul.pressFire(quick);
  run(quick, arm.TAP_HOLD_MS - 20);
  ghoul.releaseFire(quick);
  run(quick, arm.DOUBLE_TAP_MS - 20);
  ghoul.pressFire(quick);
  assert.equal(quick.arms[0].n, 2);
});

test("Ghoul Rush's double tap: hammering fire spends one at most, till the button has gone quiet", () => {
  const round = roomOf(null, "hall");
  standAt(round, 40);
  give(round, "dyn", 6);
  for (let i = 0; i < 30; i++) {
    ghoul.pressFire(round);
    run(round, 60);
    ghoul.releaseFire(round);
    run(round, 60);
  }
  assert.equal(round.arms[0].n, 5, "thirty taps, one stick");
  run(round, arm.DOUBLE_TAP_MS + 8);
  round.armCool = 0;
  tapTap(round);
  assert.equal(round.arms[0].n, 4, "quiet, it counts again");
});

test("Ghoul Rush's secondary weapon comes out only when Planny can act, and with an empty bag a double tap is two bolts", () => {
  const cases = [
    ["a toll's freeze", (r) => (r.stunMs = 500)],
    ["an orderly's hold", (r) => (r.you.heldMs = 500)],
    ["a throw", (r) => (r.you.flingMs = 500)],
    ["down", (r) => (r.you.out = 500)],
    ["the cooldown", (r) => (r.armCool = 100)],
  ];
  for (const [name, set] of cases) {
    const round = roomOf(null, "hall");
    standAt(round, 40);
    give(round, "stake", 2);
    set(round);
    tapTap(round);
    assert.equal(round.arms[0].n, 2, name);
    assert.equal(events(round, "armUse").length, 0, name);
  }
  const phase = roomOf(null, "hall");
  give(phase, "stake", 2);
  phase.phase = "ready";
  tapTap(phase);
  assert.equal(phase.arms[0].n, 2, "before the round is back on");
  const empty = roomOf(null, "hall");
  standAt(empty, 40);
  assert.equal(arm.useArm(empty, {}), false);
  tapTap(empty);
  assert.equal(empty.shots.filter((s) => s.arm).length, 0);
});

test("Ghoul Rush's weapon uses cost no heat and count as no shot fired", () => {
  const round = roomOf(null, "hall");
  standAt(round, 40);
  give(round, "stake", 3);
  round.heat = 7;
  const shots = round.stats.shots;
  tapTap(round);
  assert.equal(round.heat, 7);
  assert.equal(round.stats.shots, shots);
  assert.equal(round.armUsed, true);
  assert.ok(round.fireMs >= arm.ARM_GAP_MS);
});

/* ------------------------------------------------------------------ the bag */

test("Ghoul Rush's bag: the latest picked up comes out first, then the one under it; bundles stop at their cap, then pay points", () => {
  const round = roomOf(null, "hall");
  standAt(round, 40);
  ghoul.applyPower(round, "dyn");
  assert.deepEqual(round.arms, [{ kind: "dyn", n: 2 }], "2 sticks outside the Mine");
  ghoul.applyPower(round, "stake");
  assert.deepEqual(round.arms, [{ kind: "stake", n: 3 }, { kind: "dyn", n: 2 }]);
  ghoul.applyPower(round, "dyn");
  assert.deepEqual(round.arms, [{ kind: "dyn", n: 4 }, { kind: "stake", n: 3 }], "picked up again, it comes back to the top");
  round.arms = [{ kind: "stake", n: 1 }, { kind: "dyn", n: 1 }];
  tapTap(round);
  assert.deepEqual(round.arms, [{ kind: "dyn", n: 1 }], "a kind used up gives way to the next");
  // Past the cap: points, and the count stays.
  round.arms = [{ kind: "stake", n: ghoul.POWERS.stake.max }];
  const score = round.score;
  ghoul.applyPower(round, "stake");
  assert.equal(round.arms[0].n, ghoul.POWERS.stake.max);
  assert.ok(round.score > score);
  // Each kind's bundle and cap are sane.
  for (const kind of ALL) {
    const def = ghoul.POWERS[kind];
    assert.ok(def.sticks >= 2 && def.max > def.sticks && def.max <= 6, kind);
    assert.ok(!def.ms, `${kind} has no timer`);
    assert.equal(def.weight, 0, `${kind}: never from pickPower`);
    assert.ok(def.name && def.blurb && def.color, kind);
  }
});

test("Ghoul Rush's bag stays with you through a new room and a life lost, and is gone only with the round", () => {
  const round = roomOf("manor", "foyer");
  round.arms = [{ kind: "ball", n: 2 }];
  through(round);
  assert.deepEqual(round.arms, [{ kind: "ball", n: 2 }], "carried");
  round.you.safeMs = 0;
  ghoul.lose(round, "zombie");
  run(round, ghoul.CRASH_MS + ghoul.READY_MS + 40);
  assert.deepEqual(round.arms, [{ kind: "ball", n: 2 }], "kept through a life lost");
  assert.deepEqual(ghoul.newRound(5).arms, []);
});

test("Ghoul Rush's HUD shows the weapon that comes next as its badge and count, against the gauge, and tells you how till the first one is used", () => {
  const { g, round } = game();
  assert.equal(g.hud.arm, null);
  round.arms = [{ kind: "dyn", n: 3 }];
  g.tick(1);
  assert.equal(g.hud.arm.kind, "dyn");
  assert.equal(g.hud.arm.text, "x3 TAP TAP");
  assert.equal(g.hud.arm.fresh, true);
  round.armUsed = true;
  round.arms = [{ kind: "dyn", n: 3 }, { kind: "stake", n: 1 }];
  g.tick(1);
  assert.equal(g.hud.arm.text, "x3 +1");
  assert.equal(g.hud.arm.fresh, false);
  assert.ok(!g.hud.effects.some((e) => /DYN/.test(e.text)), "no pill of words as well");
  // Never over another pill, whatever else is showing.
  const hud = { room: "THE GRAND OPERA HOUSE", stage: "STAGE 20 OF 21", time: 80, timeLow: false, bonus: 1500, chain: 10, chainFill: 0.5, key: true, effects: [{ text: "SPREAD", color: "#fff", fill: 1 }, { text: "RAPID", color: "#fff", fill: 1 }], gauge: { fill: 0, free: 0.6, rapid: null }, arm: { kind: "dyn", n: 6, text: "x6 +2", color: "#d9382c" } };
  for (const h of [4, 2.4]) {
    const laid = hudLayout(h, ghoul.W, 9, hud, ghoul.HUD_H);
    const pill = laid.find((p) => p.arm);
    const gauge = laid.find((p) => p.gauge);
    assert.ok(pill && gauge);
    assert.ok(pill.x + pill.w <= gauge.x, "beside the gauge");
    for (let i = 0; i < laid.length; i++) {
      for (let j = i + 1; j < laid.length; j++) {
        const [p, q] = [laid[i], laid[j]];
        assert.ok(p.x + p.w <= q.x + 1e-6 || q.x + q.w <= p.x + 1e-6 || p.y + p.h <= q.y + 1e-6 || q.y + q.h <= p.y + 1e-6, `pills ${i} and ${j} apart`);
      }
    }
  }
});

test("Ghoul Rush's weapon icons pop when the bag changes, on a pickup and on a use, and settle again", () => {
  const { g, round } = game();
  g.tick(1);
  assert.equal(g.hud.arm, null);
  ghoul.applyPower(round, "dyn");
  g.tick(1);
  assert.ok(g.hud.arm.pop > 0.9, "a pickup pops");
  for (let i = 0; i < 40; i++) g.tick(16);
  assert.equal(g.hud.arm.pop, 0, "and settles");
  round.armCool = 0;
  g.key("action");
  g.release("action");
  g.key("action");
  g.release("action");
  g.tick(1);
  assert.ok(g.hud.arm.pop > 0.9, "a use pops");
  assert.equal(g.hud.arm.n, 1);
});

test("Ghoul Rush's first weapons say how to use them, and a pickup past that gives its own blurb", () => {
  const round = roomOf(null, "hall");
  standAt(round, 62);
  round.spec.items.forEach((_, i) => (round.items[i] = round.spec.items[i][0] !== "dyn"));
  standAt(round, round.spec.items.find((i) => i[0] === "dyn")[1]);
  ghoul.advance(round, 8, steady);
  const e = events(round, "power").find((p) => p.kind === "dyn");
  assert.equal(e?.teach, true);
  const later = roomOf(null, "hall");
  later.armUsed = true;
  later.spec.items.forEach((_, i) => (later.items[i] = later.spec.items[i][0] !== "dyn"));
  standAt(later, later.spec.items.find((i) => i[0] === "dyn")[1]);
  ghoul.advance(later, 8, steady);
  assert.equal(events(later, "power").find((p) => p.kind === "dyn")?.teach, false);
});

/* -------------------------------------------------------------- each weapon */

test("Ghoul Rush's Dynamite does 20 to whatever the blast reaches and breaks stone; the Iron Stake goes through a whole line and glances off stone", () => {
  const round = roomOf("chapel", "tower");
  standAt(round, 120);
  const stone = put(round, "gargoyle", 126, { y: 6, act: "perch" });
  round.hazards.push({ kind: "stick", x: 124, y: 6, vx: 0, vy: 0, fuse: 8, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(round, 20);
  assert.ok(stone.dead, "stone broken");
  // A line of three: the first two hit, four each, hp 3 down at once.
  const line = roomOf(null, "hall");
  standAt(line, 30);
  const a = put(line, "zombie", 42);
  const b = put(line, "zombie", 46);
  give(line, "stake", 1);
  tapTap(line);
  run(line, 200);
  assert.ok(a.dead && b.dead, "both on the one stake");
  const glance = roomOf("chapel", "tower");
  standAt(glance, 120);
  put(glance, "gargoyle", 130, { y: glance.you.y + 0.5, act: "perch" });
  give(glance, "stake", 1);
  tapTap(glance);
  run(glance, 200);
  assert.ok(events(glance, "glance").length >= 1, "it shows");
});

test("Ghoul Rush's Hedge Sickle flies out, turns and comes back, hits a monster on each pass, and Planny catches it", () => {
  const round = roomOf("grounds", "topiary");
  const start = 120;
  standAt(round, start);
  const m = put(round, "zombie", start + 14, { hp: arm.SICKLE_DMG + 1, speed: 0 });
  m.stunMs = 1e9;
  give(round, "sickle", 1);
  tapTap(round);
  run(round, 300);
  assert.equal(m.hp, 1, "hit going out");
  const s = round.shots.find((q) => q.arm === "sickle");
  assert.ok(s);
  run(round, 1200);
  assert.ok(m.dead, "and again coming back");
  assert.ok(events(round, "armTurn").length === 1);
  assert.ok(!round.shots.some((q) => q.arm === "sickle"), "caught");
});

test("Ghoul Rush's Billiard Ball rolls along the floor hurting low things most, down ledges, bounces off a wall once, and a pit takes it", () => {
  const round = roomOf(null, "hall");
  standAt(round, 40);
  const low = put(round, "crawler", 52, { hp: arm.BALL_LOW_DMG });
  const tall = put(round, "zombie", 56, { hp: arm.BALL_DMG + 1 });
  low.stunMs = tall.stunMs = 1e9;
  give(round, "ball", 1);
  tapTap(round);
  run(round, 600);
  assert.ok(low.dead, "low things take the most");
  assert.equal(tall.hp, 1, "a tall one takes less, and only once");
  const ball = round.hazards.find((h) => h.kind === "armBall");
  assert.ok(ball && ball.y === 6, "on the floor");
  // A wall: the hall's rise at 300? No: the Crypt's has none, so take the Foyer's stair, which steps up. Use the kitchen's wall at 70.
  const wall = roomOf("wing", "kitchen");
  standAt(wall, 60);
  wall.hazards.push({ kind: "armBall", x: 66, y: 6, vx: arm.BALL_V, vy: 0, life: arm.BALL_MS, bounced: false, roll: 0, hit: [], hitBoss: false, w: 1.4, h: 1.4, live: 0, cause: "" });
  run(wall, 200);
  const b = wall.hazards.find((h) => h.kind === "armBall");
  assert.ok(b.bounced && b.vx < 0, "back off the wall");
  assert.ok(events(wall, "armBounce").length === 1);
  // A pit: the gallery's at 100-110.
  const pit = roomOf("manor", "gallery");
  standAt(pit, 90);
  pit.hazards.push({ kind: "armBall", x: 96, y: 6, vx: arm.BALL_V, vy: 0, life: arm.BALL_MS, bounced: false, roll: 0, hit: [], hitBoss: false, w: 1.4, h: 1.4, live: 0, cause: "" });
  run(pit, 1500);
  assert.ok(!pit.hazards.some((h) => h.kind === "armBall"), "gone");
});

test("Ghoul Rush's Tuning Fork spreads a ring through shelves that hurts once each, ghosts double, and cracks stone", () => {
  const round = roomOf("chapel", "tower");
  standAt(round, 120);
  const near = put(round, "zombie", 126, { hp: arm.RING_DMG + 1 });
  const ghost = put(round, "chorister", 116, { y: 8, hp: arm.RING_DMG * 2 + 1 });
  const stone = put(round, "gargoyle", 123, { y: 12, act: "perch" });
  const far = put(round, "zombie", 120 + arm.RING_R + 8);
  near.stunMs = ghost.stunMs = far.stunMs = 1e9;
  stone.stunMs = 1e9;
  const farHp = far.hp;
  give(round, "fork", 1);
  tapTap(round);
  run(round, arm.RING_MS + 20);
  assert.equal(near.hp, 1);
  assert.equal(ghost.hp, 1, "double to a ghost");
  assert.ok(stone.dead, "stone cracked");
  assert.equal(far.hp, farHp);
  assert.ok(!round.hazards.some((h) => h.kind === "armRing"));
});

test("Ghoul Rush's Grave Salt lands and burns the floor for 4 s, even a hand still buried, and nothing out of its line", () => {
  const round = roomOf("graveyard", "graves");
  standAt(round, 170);
  const hands = put(round, "hands", 187, { act: "wait" });
  hands.stunMs = 1e9;
  const hp = hands.hp;
  const out = put(round, "zombie", 210);
  out.stunMs = 1e9;
  const outHp = out.hp;
  give(round, "salt", 1);
  tapTap(round);
  run(round, 900);
  const salt = round.hazards.find((h) => h.kind === "armSalt");
  assert.ok(salt, "it landed");
  assert.ok(Math.abs(salt.x - 170 - 1.8) < 28);
  hands.x = salt.x;
  run(round, arm.SALT_TICK_MS * 2 + 20);
  assert.ok(hands.dead || hands.hp < hp, "the buried burn");
  assert.equal(out.hp, outHp);
  run(round, arm.SALT_MS);
  assert.ok(!round.hazards.some((h) => h.kind === "armSalt"), "gone in 4 s");
});

test("Ghoul Rush's Flash Powder dazes what is near, still deadly to touch, and shows a flicker for a while", () => {
  const round = roomOf("sanatorium", "baths");
  round.spec.flicker && (round.twist = { next: 1e12, stage: "calm", left: 0 });
  standAt(round, 60);
  const z = put(round, "zombie", 70);
  const f = put(round, "flicker", 72);
  const far = put(round, "zombie", 150);
  ghoul.advance(round, 4, steady);
  assert.ok(f.unseen, "unseen till then");
  give(round, "flash", 1);
  tapTap(round);
  run(round, 600);
  assert.ok(events(round, "armFlash").length === 1);
  assert.ok(z.stunMs > 0, "dazed");
  assert.ok(!f.unseen, "shown");
  const zx = z.x;
  run(round, 400);
  assert.equal(z.x, zx, "it stands");
  assert.ok(!(far.stunMs > 0), "too far");
  run(round, arm.FLASH_STUN_MS);
  assert.ok(!(z.stunMs > 0), "and comes round");
});

test("Ghoul Rush's Silver Bear Trap sets at his feet, snaps on the first thing to step in it and holds what lives; flyers go over; five a use, ten at most", () => {
  const round = roomOf("village", "inn");
  standAt(round, 40);
  give(round, "trap", 3);
  tapTap(round);
  const trap = round.hazards.find((h) => h.kind === "armTrap");
  assert.ok(trap && trap.x === 40 - 2 * arm.TRAP_GAP);
  assert.deepEqual(round.hazards.filter((h) => h.kind === "armTrap").map((h) => h.x).sort((a, b) => a - b), [-2, -1, 0, 1, 2].map((i) => 40 + i * arm.TRAP_GAP), "five, evenly spaced, two behind, one at his feet, two ahead");
  const zombie = put(round, "zombie", 40 + arm.TRAP_GAP + 1, { hp: arm.TRAP_DMG + 1 });
  zombie.stunMs = arm.TRAP_ARM_MS + 400;
  const bat = put(round, "bat", 40 + 2 * arm.TRAP_GAP, { y: 14 });
  bat.stunMs = 1e9;
  run(round, arm.TRAP_ARM_MS + 40);
  assert.ok(events(round, "armSnap").length === 1, "snapped");
  assert.equal(zombie.hp, 1);
  assert.ok(zombie.stunMs > 0, "held");
  assert.ok(!bat.dead);
  // Two at once is the most: a third takes the oldest's place, so the bag never jams.
  const two = roomOf("village", "inn");
  standAt(two, 40);
  give(two, "trap", 3);
  tapTap(two);
  two.armCool = 0;
  run(two, arm.DOUBLE_TAP_MS + 8);
  tapTap(two);
  two.armCool = 0;
  run(two, arm.DOUBLE_TAP_MS + 8);
  assert.equal(two.arms[0].n, 1);
  const oldest = two.hazards.find((h) => h.kind === "armTrap");
  tapTap(two);
  assert.deepEqual(two.arms, [], "the third is spent");
  const set = two.hazards.filter((h) => h.kind === "armTrap");
  assert.equal(set.length, arm.TRAP_MAX);
  assert.ok(!set.includes(oldest), "in the oldest's place");
  // Left unsprung it goes in the end.
  run(two, arm.TRAP_LIFE_MS + 40);
  assert.equal(two.hazards.filter((h) => h.kind === "armTrap").length, 0, "gone in time");
});

test("Ghoul Rush's ride rooms keep what needs a floor in the bag, use the next kind down, and a stick or a flash goes off in the air rather than being lost", () => {
  const room = ghoul.ROOMS.find((r) => r.ride);
  if (!room) return;
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["mine"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== room.id) through(round);
  round.phase = "play";
  round.you.safeMs = 1e9;
  round.arms = [{ kind: "trap", n: 2 }, { kind: "dyn", n: 1 }];
  round.events.length = 0;
  tapTap(round);
  assert.deepEqual(round.arms, [{ kind: "trap", n: 2 }], "the stick came out instead");
  assert.equal(round.hazards.filter((h) => h.kind === "armTrap").length, 0);
  run(round, arm.DYN_FUSE_MS + 20);
  assert.ok(events(round, "dynBlast").length === 1, "it blew in the air");
  round.armCool = 0;
  round.tap = null;
  tapTap(round);
  assert.deepEqual(round.arms, [{ kind: "trap", n: 2 }], "only what needs a floor left: nothing comes out");
});

/* ------------------------------------------------------------ the skillet */

const pansOf = (round) => round.hazards.find((h) => h.kind === "armPans");
const alive = (round) => (pansOf(round) ? pansOf(round).pans.filter((p) => p.alive).length : 0);
const polar = (h, p) => ({ r: Math.hypot(p.x - h.x, p.y - h.y), a: Math.atan2(p.y - h.y, p.x - h.x) });
const noRandom = () => {
  throw new Error("a pan drew a random number");
};

test("Ghoul Rush's Cast-Iron Skillet sends three pans evenly spaced round his chest, each a tight ring first and then a steady spiral outward", () => {
  assert.equal(pans.PAN_COUNT, 3);
  assert.ok(pans.PAN_R0 >= 4 && pans.PAN_R0 <= 5);
  assert.ok(pans.PAN_TURNS >= 1.5 && pans.PAN_TURNS <= 2);
  assert.ok(pans.PAN_GROW >= 14 && pans.PAN_GROW <= 18);
  assert.ok(pans.PAN_ORBIT_MS >= 800 && pans.PAN_ORBIT_MS <= 1200);
  assert.ok(pans.PAN_LIFE_MS >= 2500 && pans.PAN_LIFE_MS <= 3200);
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  give(round, "skillet", 2);
  tapTap(round);
  assert.equal(round.arms[0].n, 1);
  // The cool-down holds a second use back.
  tapTap(round);
  assert.equal(round.arms[0].n, 1);
  assert.equal(round.hazards.filter((q) => q.kind === "armPans").length, 1);
  const h = pansOf(round);
  assert.equal(h.pans.length, 3);
  const at = h.pans.map((p) => polar(h, p));
  for (let i = 0; i < 3; i++) {
    const turn = (((at[(i + 1) % 3].a - at[i].a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    assert.ok(Math.abs(turn - (Math.PI * 2) / 3) < 1e-6, "120 degrees apart");
  }
  // Round his chest, and following him as he runs.
  assert.equal(h.x, round.you.x);
  assert.equal(h.y, round.you.y + pans.PAN_LIFT);
  run(round, pans.PAN_ORBIT_MS - 40);
  for (const p of pansOf(round).pans) assert.ok(Math.abs(polar(pansOf(round), p).r - pans.PAN_R0) < 1e-6, "a tight ring for the first second");
  round.you.x += 7;
  run(round, 4);
  assert.equal(pansOf(round).x, round.you.x, "the ring follows him");
  // Then the radius is a straight line of time.
  const radii = [];
  for (let i = 0; i < 4; i++) {
    run(round, 400);
    if (!pansOf(round)) break;
    radii.push([pansOf(round).t, polar(pansOf(round), pansOf(round).pans[0]).r]);
  }
  assert.ok(radii.length >= 3);
  for (const [t, r] of radii) assert.ok(Math.abs(r - (pans.PAN_R0 + ((t - pans.PAN_ORBIT_MS) / 1000) * pans.PAN_GROW)) < 1e-6, "an Archimedean spiral");
  assert.ok(radii[radii.length - 1][1] > pans.PAN_R0 + 15, "it widens a long way");
});

test("Ghoul Rush's pans leave the view or end at their lifetime, and draw no random number", () => {
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  give(round, "skillet", 2);
  tapTap(round);
  // Nothing in the room, so nothing else draws: advance the whole way on a random that throws.
  for (let t = 0; t < pans.PAN_LIFE_MS + 100 && pansOf(round); t += 4) ghoul.advance(round, 4, noRandom);
  assert.ok(!pansOf(round), "gone by the lifetime cap");
  // Out at the edge of a room, a pan that flies off the side is let go before the cap.
  const edge = roomOf("wing", "kitchen");
  standAt(edge, 6);
  edge.camX = 0;
  give(edge, "skillet", 1);
  tapTap(edge);
  let left = 3;
  for (let t = 0; t < pans.PAN_LIFE_MS - 100; t += 4) {
    ghoul.advance(edge, 4, steady);
    if (pansOf(edge)) left = alive(edge);
  }
  assert.ok(left < 3, "a pan off the side is gone for good");
});

test("Ghoul Rush's pans one-shot whatever they touch and break on it, so one use kills three things at most", () => {
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  // Six sturdy zombies standing in the ring's way, none able to hurt him.
  const crowd = [4.5, -4.5, 3.5, -3.5, 4.5, -4.5].map((dx, i) => put(round, "zombie", 40 + dx, { hp: 99 + i }));
  for (const m of crowd) m.stunMs = 1e9;
  const score = round.score;
  give(round, "skillet", 1);
  tapTap(round);
  const bursts = new Set();
  for (let t = 0; t < 1000; t += 4) {
    ghoul.advance(round, 4, steady);
    for (const h of round.hazards) if (h.kind === "armPanBurst") bursts.add(h);
  }
  assert.equal(crowd.filter((m) => !round.monsters.includes(m)).length, 3, "exactly three kills");
  assert.equal(round.stats.kills, 3);
  assert.ok(!pansOf(round), "all three pans broke on them");
  assert.ok(round.score > score);
  assert.ok(events(round, "kill").every((e) => e.how === "arm"));
  assert.equal(round.drops.length, 0, "no drops from an area weapon");
  assert.equal(events(round, "armUse").length, 1);
  assert.ok(events(round, "armClang").length >= 1 && events(round, "armClang").length <= 3);
  assert.equal(bursts.size, 3, "a burst for each pan");
  // Any hp goes in one hit.
  const tough = roomOf("wing", "kitchen");
  standAt(tough, 40);
  const big = put(tough, "zombie", 44.5, { hp: 5000 });
  big.stunMs = 1e9;
  give(tough, "skillet", 1);
  tapTap(tough);
  run(tough, 800);
  assert.ok(!tough.monsters.includes(big), "any hp");
});

test("Ghoul Rush's three pans that meet three monsters at once clang once, and each kill is one", () => {
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  give(round, "skillet", 1);
  tapTap(round);
  const crowd = pansOf(round).pans.map((p) => {
    const m = put(round, "zombie", p.x, { y: p.y - 1 });
    m.stunMs = 1e9;
    return m;
  });
  round.events.length = 0;
  run(round, 8);
  assert.ok(crowd.every((m) => !round.monsters.includes(m)));
  assert.equal(events(round, "kill").length, 3);
  assert.equal(events(round, "armClang").length, 1, "rate limited");
});

test("Ghoul Rush's pans never hurt Planny, who stands in the middle of them, and skip what cannot be hit or only carries him", () => {
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  round.you.safeMs = 0;
  const lives = round.lives;
  give(round, "skillet", 1);
  tapTap(round);
  for (const h of round.hazards) assert.equal(h.live, 0);
  run(round, pans.PAN_LIFE_MS + 100);
  assert.equal(round.lives, lives);
  assert.equal(round.phase, "play");
  assert.equal(round.you.out, 0);
  // A cage he stands on, a canary and an imp (harmless) and a zombie not yet up, all untouched.
  const mine = roomOf("mine", ghoul.STAGES.find((s) => s.id === "mine").rooms[0]);
  standAt(mine, 40);
  const cage = put(mine, "cage", 44.5);
  const canary = put(mine, "canary", 35.5);
  const imp = put(mine, "imp", 44.5, { y: 4 });
  const rising = put(mine, "zombie", 40, { rise: 5000 });
  give(mine, "skillet", 1);
  tapTap(mine);
  run(mine, 1400);
  for (const m of [cage, canary, imp, rising]) assert.ok(mine.monsters.includes(m) && !m.dead, m.kind);
  assert.equal(mine.stats.kills, 0);
  assert.ok(pansOf(mine) && alive(mine) === 3, "the pans flew on");
});

test("Ghoul Rush's pans never one-shot a boss: each does a weapon's boss damage through armBossDamage and breaks, a guard blocks and a hidden boss is missed", () => {
  const fight = fightOf("manor", "ballroom");
  const b = fight.boss;
  b.stunMs = 1e9;
  standAt(fight, b.x - 4);
  const hp = b.hp;
  give(fight, "skillet", 1);
  tapTap(fight);
  run(fight, 1200);
  assert.equal(b.state, "fight", "not killed");
  assert.ok(b.hp < hp);
  assert.ok(hp - b.hp <= 3 * pans.PAN_BOSS, "at most three weapon hits");
  assert.equal(fight.armBossDmg, hp - b.hp, "counted by armBossDamage");
  assert.ok(!pansOf(fight), "the pans broke on him");
  // Deep in a run the same pan takes the same share of a tougher boss, as a stick does.
  const deep = fightOf("manor", "ballroom", 7);
  deep.boss.stunMs = 1e9;
  standAt(deep, deep.boss.x - 4);
  const before = deep.boss.hp;
  give(deep, "skillet", 1);
  tapTap(deep);
  run(deep, 1200);
  assert.ok(before - deep.boss.hp > hp - b.hp, "more off a tougher boss");
  // Mother Mourning weeping: guarded, the iron rings off and breaks.
  const mourn = fightOf("graveyard", "angel");
  const m = mourn.boss;
  m.act = "weep";
  m.stunMs = 1e9;
  const mh = m.hp;
  standAt(mourn, m.x - 4);
  give(mourn, "skillet", 1);
  tapTap(mourn);
  run(mourn, 1200);
  assert.equal(m.hp, mh, "guarded");
  assert.ok(events(mourn, "bossBlock").length >= 1);
  // The Tommyknocker, hidden: not hit, and the pans fly on.
  const tommy = fightOf("mine", "seam");
  tommy.boss.hidden = true;
  tommy.boss.stunMs = 1e9;
  standAt(tommy, tommy.boss.x - 4);
  const th = tommy.boss.hp;
  give(tommy, "skillet", 1);
  tapTap(tommy);
  run(tommy, 1200);
  assert.equal(tommy.boss.hp, th);
  assert.equal(alive(tommy), 3);
});

test("Ghoul Rush's skillets carry between rooms in the bag, and the pans are cleared by a room change and a life lost", () => {
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  give(round, "skillet", 3);
  tapTap(round);
  assert.ok(pansOf(round));
  assert.equal(round.arms[0].n, 2);
  through(round);
  assert.ok(!pansOf(round), "a room change clears them");
  assert.equal(round.arms[0].kind, "skillet");
  assert.equal(round.arms[0].n, 2, "and the bag stays");
  // A life lost puts the room back as it was.
  const dead = roomOf("wing", "kitchen");
  standAt(dead, 40);
  give(dead, "skillet", 3);
  tapTap(dead);
  dead.you.safeMs = 0;
  ghoul.lose(dead, "bone");
  for (let i = 0; i < 600 && dead.phase !== "play"; i++) ghoul.advance(dead, 16, steady);
  run(dead, 40);
  assert.ok(!pansOf(dead), "a respawn clears them");
  assert.equal(dead.arms[0].n, 2);
  // Endless lives change nothing about them.
  const infinite = roomOf("wing", "kitchen");
  infinite.infinite = true;
  standAt(infinite, 40);
  give(infinite, "skillet", 1);
  tapTap(infinite);
  assert.ok(pansOf(infinite));
});

test("Ghoul Rush's pans freeze while the game is paused", () => {
  const { g, round } = game();
  standAt(round, 40);
  give(round, "skillet", 2);
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
  ghoul.pressFire(round);
  assert.ok(pansOf(round));
  g.tick(100);
  const t = pansOf(round).t;
  assert.ok(t > 0);
  g.pause();
  g.tick(500);
  assert.equal(pansOf(round).t, t, "paused");
  g.resume();
  g.tick(100);
  assert.ok(pansOf(round).t > t);
});

test("Ghoul Rush's pans draw in a dark room and a lit one, with a burst", () => {
  for (const dark of [false, true]) {
    const { g, round } = game();
    round.dark = dark;
    standAt(round, 40);
    const z = put(round, "zombie", 44.5);
    z.stunMs = 1e9;
    give(round, "skillet", 2);
    g.key("action");
    g.tick(8);
    g.release("action");
    g.tick(8);
    g.key("action");
    g.tick(16);
    g.release("action");
    let burst = false;
    for (let i = 0; i < 12; i++) {
      g.tick(32);
      burst ||= round.hazards.some((h) => h.kind === "armPanBurst");
    }
    assert.ok(pansOf(round), "in flight");
    assert.ok(burst, `a burst, dark ${dark}`);
    for (let i = 0; i < 100; i++) g.tick(32);
    assert.ok(!pansOf(round), `done, dark ${dark}`);
  }
});

/* ------------------------------------------------------------ Bottle Rocket */

const rocketsOf = (round) => round.hazards.filter((h) => h.kind === "armRocket");
const boomsOf = (round) => round.hazards.filter((h) => h.kind === "armRocketBoom");
const launch = (round, n = 1) => {
  give(round, "rocket", n);
  tapTap(round);
};
const sparkTotal = (round) => round.hazards.reduce((n, h) => n + (h.sparks ? h.sparks.length : 0), 0);
const rocketStuff = (round) => round.hazards.filter((h) => /^armRocket|^armMuzzle/.test(h.kind)).length;
// A level, open stretch of floor with room to fly: the hall.
const open = () => {
  const round = roomOf(null, "hall");
  standAt(round, 60);
  return round;
};

test("Ghoul Rush's Bottle Rocket fires three at once, ahead, up and behind, for one use from the bag, with a flash at the muzzle", () => {
  assert.equal(arm.ROCKET_COUNT, 3);
  for (const face of [1, -1]) {
    const round = open();
    standAt(round, 60, face);
    launch(round, 3);
    assert.equal(round.arms[0].n, 2, "one use from the bag, not three");
    assert.equal(events(round, "armUse").length, 1, "one use event, so one launch sound");
    assert.equal(events(round, "armUse")[0].kind, "rocket");
    const rs = rocketsOf(round);
    assert.deepEqual(rs.map((h) => h.dir), ["fwd", "up", "back"]);
    const [fwd, up, back] = rs;
    const chest = round.you.y + ghoul.SHOT_Y;
    assert.equal(fwd.vx, face * arm.ROCKET_SPEED, "ahead, the way he faces, fast");
    assert.equal(fwd.vy, 0, "level");
    assert.equal(fwd.y, chest, "with his chest");
    assert.equal(up.vx, 0);
    assert.equal(up.vy, arm.ROCKET_UP_SPEED, "straight up");
    assert.equal(back.vx, -face * arm.ROCKET_BACK_SPEED, "behind, opposite his facing");
    assert.equal(back.vy, 0);
    assert.ok((fwd.x - round.you.x) * face > 0 && (back.x - round.you.x) * face < 0);
    assert.equal(round.hazards.filter((h) => h.kind === "armMuzzle").length, 1, "a muzzle flash");
    assert.equal(round.armCool, arm.ARM_COOL_MS);
  }
  assert.ok(arm.ROCKET_SPEED > 72, "faster than the old one");
});

test("Ghoul Rush's Bottle Rocket flies ahead and behind in straight lines, the ahead one level with his chest", () => {
  const round = open();
  launch(round);
  const [fwd, , back] = rocketsOf(round);
  const y = fwd.y;
  const x0 = fwd.x;
  const bx0 = back.x;
  run(round, 400);
  assert.equal(fwd.y, y);
  assert.equal(back.y, y);
  assert.ok(Math.abs(fwd.x - x0 - arm.ROCKET_SPEED * 0.4) < 0.7, "ahead at ROCKET_SPEED");
  assert.ok(Math.abs(bx0 - back.x - arm.ROCKET_BACK_SPEED * 0.4) < 0.7, "behind at ROCKET_BACK_SPEED");
});

test("Ghoul Rush's ahead and behind rockets bend toward a monster above or below their line on their side, and stay straight with none", () => {
  for (const [name, y, dir, x] of [["above ahead", 22, "fwd", 96], ["below ahead", -4, "fwd", 96], ["above behind", 22, "back", 24]]) {
    const round = open();
    const bat = put(round, "bat", x, { y, hp: 5 });
    bat.awake = true;
    bat.stunMs = 1e9;
    launch(round);
    const r = rocketsOf(round).find((h) => h.dir === dir);
    const y0 = r.y;
    run(round, 160);
    assert.ok(r.dead || Math.sign(r.vy) === Math.sign(y - y0), `${name}: it bends toward the monster (vy ${r.vy})`);
    assert.ok(r.dead || Math.abs(Math.hypot(r.vx, r.vy) - (dir === "fwd" ? arm.ROCKET_SPEED : arm.ROCKET_BACK_SPEED)) < 0.5, `${name}: speed is kept`);
  }
  // A monster on the rocket's line, or on the other side, changes nothing.
  const level = open();
  const walker = put(level, "zombie", 96, { hp: 5 });
  walker.stunMs = 1e9;
  launch(level);
  const f = rocketsOf(level)[0];
  run(level, 100);
  assert.equal(f.vy, 0, "level with it: straight on");
  const behind = open();
  const bat = put(behind, "bat", 24, { y: 22, hp: 5 });
  bat.awake = true;
  bat.stunMs = 1e9;
  launch(behind);
  const ahead = rocketsOf(behind)[0];
  run(behind, 100);
  assert.equal(ahead.vy, 0, "a monster behind does not bend the rocket going ahead");
});

test("Ghoul Rush's up rocket climbs straight, then curves over and homes on a flyer ahead or above, and arcs forward and drops with nothing there", () => {
  // A bat on high, ahead.
  const round = open();
  const bat = put(round, "bat", 90, { y: 24, hp: 5 });
  bat.awake = true;
  bat.stunMs = 1e9;
  launch(round);
  const up = rocketsOf(round)[1];
  const x0 = up.x;
  run(round, arm.ROCKET_UP_MS - 20);
  assert.equal(up.x, x0, "straight up");
  assert.ok(up.vy > 0);
  run(round, 1400);
  assert.ok(bat.dead, "it homed on the bat");
  // A bat overhead and a little behind: above counts wherever it is in view.
  const over = open();
  const high = put(over, "bat", 52, { y: 26, hp: 5 });
  high.awake = true;
  high.stunMs = 1e9;
  launch(over);
  run(over, 1800);
  assert.ok(high.dead, "above and a little behind counts");
  // Nothing to chase: up, over, forward and down onto the floor, ahead of him.
  const none = open();
  launch(none);
  const u = rocketsOf(none)[1];
  let peak = 0;
  let boom = null;
  for (let t = 0; t < 2000 && !boom; t += 4) {
    ghoul.advance(none, 4, steady);
    if (rocketsOf(none).includes(u)) peak = Math.max(peak, u.y);
    boom = boomsOf(none).find((b) => b.y < 9 && b.x > 64) || null;
  }
  assert.ok(peak > 20, `a high arc (${peak})`);
  assert.ok(boom, "it came down on the floor");
  assert.ok(boom.x > 75, `ahead of him (${boom.x})`);
  assert.ok(!rocketsOf(none).includes(u));
});

test("Ghoul Rush's up rocket facing left arcs left", () => {
  const round = open();
  standAt(round, 120, -1);
  launch(round);
  let boom = null;
  for (let t = 0; t < 2000 && !boom; t += 4) {
    ghoul.advance(round, 4, steady);
    boom = boomsOf(round).find((b) => b.y < 9 && b.x < 118) || null;
  }
  assert.ok(boom, "it came down");
  assert.ok(boom.x < 100, `ahead of him, to the left (${boom.x})`);
});

test("Ghoul Rush's rockets each go off on a monster, on a wall and on the floor, and at the end of their life", () => {
  // On a monster: the ahead rocket stops on the first one it meets.
  const round = open();
  const near = put(round, "zombie", 80, { hp: 3 });
  const far = put(round, "zombie", 130, { hp: 3 });
  near.stunMs = far.stunMs = 1e9;
  launch(round);
  run(round, 400);
  assert.ok(near.dead, "the near one is blown up");
  assert.ok(!far.dead, "the far one was shielded by it");
  assert.equal(rocketsOf(round).filter((h) => h.dir === "fwd").length, 0);
  // A wall: ground that steps up ahead.
  const wall = open();
  wall.spec = { ...wall.spec, ground: [[0, 90, 6], [90, 400, 30]], shelves: [] };
  launch(wall);
  run(wall, 300);
  assert.ok(boomsOf(wall).some((b) => Math.abs(b.x - 90) < 3), "gone off at the wall");
  assert.equal(rocketsOf(wall).filter((h) => h.dir === "fwd").length, 0);
  // The floor: a rocket pointing down.
  const floor = open();
  launch(floor);
  const f = rocketsOf(floor)[0];
  f.vx = 0;
  f.vy = -50;
  run(floor, 200);
  assert.ok(boomsOf(floor).some((b) => b.y <= 7), "gone off on the floor");
  // The end of its life: nothing in the way for the ahead rocket.
  const far2 = roomOf(null, "hall");
  far2.spec = { ...far2.spec, ground: [[0, 900, 6]], length: 900, shelves: [] };
  standAt(far2, 20);
  launch(far2);
  const fw = rocketsOf(far2)[0];
  run(far2, arm.ROCKET_LIFE_MS - 40);
  assert.ok(rocketsOf(far2).includes(fw), "still flying just before");
  run(far2, 80);
  assert.ok(!rocketsOf(far2).includes(fw), "gone at ROCKET_LIFE_MS");
  assert.ok(boomsOf(far2).some((b) => b.x > 200), "it went off where it was");
  assert.ok(arm.ROCKET_LIFE_MS >= 1800 && arm.ROCKET_LIFE_MS <= 2200);
});

test("Ghoul Rush's rocket blast is wider, kills ordinary monsters and hits each monster in it once", () => {
  assert.ok(arm.ROCKET_BLAST_R >= 6, "bigger");
  const round = open();
  const lead = put(round, "zombie", 82, { hp: 100 });
  const inside = [put(round, "zombie", 85.2, { hp: 100 }), put(round, "glutton", 87.2, { hp: 100 })];
  const out = put(round, "zombie", 96, { hp: 100 });
  for (const m of [lead, ...inside, out]) m.stunMs = 1e9;
  launch(round);
  run(round, 500);
  for (const m of [lead, ...inside]) assert.equal(m.hp, 100 - arm.ROCKET_DMG, "hit once each, by the blast");
  assert.equal(out.hp, 100, "outside the radius");
  // Anything ordinary dies of one blast.
  const kill = open();
  const tough = [put(kill, "skeleton", 81, {}), put(kill, "zombie", 83, {}), put(kill, "glutton", 86, {})];
  for (const m of tough) m.stunMs = 1e9;
  const score = kill.score;
  launch(kill);
  run(kill, 500);
  assert.ok(tough.every((m) => m.dead), "all dead");
  assert.equal(kill.stats.kills, 3);
  assert.ok(kill.score > score);
  assert.ok(events(kill, "kill").every((e) => e.how === "blast"));
  assert.equal(kill.drops.length, 0, "no drops");
  assert.ok(arm.ROCKET_DMG >= 20);
});

test("Ghoul Rush's rocket spares what cannot be hit just now, the unseen", () => {
  const round = open();
  const unseen = put(round, "zombie", 82, { hp: 5 });
  unseen.unseen = true;
  const hurtMe = put(round, "zombie", 80, { hp: 5 });
  hurtMe.stunMs = 1e9;
  launch(round);
  run(round, 500);
  assert.ok(hurtMe.dead);
  assert.ok(!unseen.dead, "unseen is not hit");
});

test("Ghoul Rush's rockets on a boss go through armBossDamage: scaled, capped in all, a guard shows and a hidden boss is missed", () => {
  const fight = fightOf("manor", "ballroom");
  const b = fight.boss;
  b.stunMs = 1e9;
  standAt(fight, b.x - 7);
  const hp = b.hp;
  launch(fight);
  run(fight, 2400);
  assert.equal(b.state, "fight", "not killed");
  assert.ok(b.hp < hp);
  assert.ok(hp - b.hp <= 3 * arm.ROCKET_BOSS, "at most three weapon hits");
  assert.equal(fight.armBossDmg, hp - b.hp, "counted by armBossDamage");
  assert.equal(rocketsOf(fight).length, 0);
  // Deep in a run the same rockets take the same share of a tougher boss.
  const deep = fightOf("manor", "ballroom", 7);
  deep.boss.stunMs = 1e9;
  standAt(deep, deep.boss.x - 7);
  const before = deep.boss.hp;
  launch(deep);
  run(deep, 1500);
  assert.ok(before - deep.boss.hp > hp - b.hp, "more off a tougher boss");
  // Past the share cap every hit is 1, the three rockets together.
  const capped = fightOf("manor", "ballroom");
  capped.boss.stunMs = 1e9;
  capped.armBossDmg = capped.spec.bossHp * arm.ARM_BOSS_SHARE;
  standAt(capped, capped.boss.x - 7);
  const ch = capped.boss.hp;
  launch(capped);
  run(capped, 1500);
  assert.ok(ch - capped.boss.hp >= 1 && ch - capped.boss.hp <= 3, "1 a hit past the cap");
  // A guard shows and nothing is taken.
  const mourn = fightOf("graveyard", "angel");
  const m = mourn.boss;
  m.act = "weep";
  m.stunMs = 1e9;
  const mh = m.hp;
  standAt(mourn, m.x - 7);
  launch(mourn);
  run(mourn, 1500);
  assert.equal(m.hp, mh, "guarded");
  assert.ok(events(mourn, "bossBlock").length >= 1);
  // A hidden boss is missed: the blast takes nothing off it.
  const tommy = fightOf("mine", "seam");
  tommy.boss.hidden = true;
  tommy.boss.stunMs = 1e9;
  standAt(tommy, tommy.boss.x - 7);
  const th = tommy.boss.hp;
  launch(tommy);
  run(tommy, 1500);
  assert.equal(tommy.boss.hp, th);
});

test("Ghoul Rush's rockets never hurt Planny, who stands in their blasts", () => {
  const round = open();
  const lives = round.lives;
  round.you.safeMs = 0;
  // A wall right at his back and a monster in his face: blasts on top of him.
  round.spec = { ...round.spec, ground: [[0, 62, 6], [62, 400, 30]], shelves: [] };
  const z = put(round, "zombie", 56, { hp: 5 });
  z.stunMs = 1e9;
  launch(round);
  run(round, 1500);
  assert.equal(round.lives, lives);
  assert.equal(round.you.out, 0);
  assert.equal(events(round, "lose").length, 0);
  assert.ok(z.dead, "but it blew up the monster beside him");
});

test("Ghoul Rush's rocket sparks are multicolored, thrown behind, 6 to 10 a frame, and fade inside half a second", () => {
  assert.deepEqual([...arm.SPARK_COLORS], ["#ff3b30", "#ff9500", "#ffe14d", "#3ddc5a", "#33e0ff", "#ff4fd8"]);
  const round = open();
  launch(round);
  const [fwd] = rocketsOf(round);
  const n0 = round.sparkN || 0;
  run(round, 200);
  const shed = (round.sparkN - n0) / 3;
  const perFrame = (shed / 200) * (1000 / 60);
  assert.ok(perFrame >= 6 && perFrame <= 10, `per 60 fps frame (${perFrame})`);
  const live = fwd.sparks;
  assert.ok(live.length > 10);
  assert.equal(new Set(live.map((p) => p.c)).size, 6, "all six colors");
  assert.ok(live.every((p) => p.life <= arm.SPARK_LIFE_MS + arm.SPARK_LIFE_VARY + 1 && p.age < p.life));
  assert.ok(live.every((p) => p.x < fwd.x + 0.5), "trailing back behind a rocket flying ahead");
  assert.ok(arm.SPARK_LIFE_MS + arm.SPARK_LIFE_VARY <= 450);
  // The same spacing at a slower frame rate: by distance.
  const a = open();
  const b = open();
  launch(a);
  launch(b);
  for (let t = 0; t < 240; t += 4) ghoul.advance(a, 4, steady);
  for (let t = 0; t < 240; t += 40) ghoul.advance(b, 40, steady);
  assert.ok(Math.abs(a.sparkN - b.sparkN) <= 8, `frame-rate independent (${a.sparkN} v ${b.sparkN})`);
});

test("Ghoul Rush's sparks draw no random number, do not shift the rng and replay the same, and are capped", () => {
  const real = Math.random;
  Math.random = () => {
    throw new Error("Math.random drawn");
  };
  try {
    const draws = [];
    const rng = () => {
      draws.push(1);
      return 0.5;
    };
    const play = (fire) => {
      const round = open();
      if (fire) launch(round, 2);
      for (let t = 0; t < 700; t += 4) ghoul.advance(round, 4, rng);
      return JSON.stringify(round.hazards.map((h) => h.sparks || null));
    };
    const a = play(true);
    const withRockets = draws.length;
    const b = play(true);
    assert.equal(a, b, "the same sparks every time");
    assert.ok(a.length > 1000);
    draws.length = 0;
    play(false);
    assert.equal(withRockets, draws.length, "no rng draw for rockets or sparks");
    // Volley after volley never passes the cap.
    const heavy = open();
    let most = 0;
    for (let v = 0; v < 8; v++) {
      heavy.armCool = 0;
      heavy.tap = null;
      launch(heavy, 2);
      for (let t = 0; t < 120; t += 4) {
        ghoul.advance(heavy, 4, steady);
        most = Math.max(most, sparkTotal(heavy));
      }
    }
    assert.ok(most > 150, `plenty of sparks (${most})`);
    assert.ok(most <= arm.SPARK_CAP, `capped at ${arm.SPARK_CAP} (${most})`);
  } finally {
    Math.random = real;
  }
});

test("Ghoul Rush's rockets carry between rooms in the bag, and are cleared by a room change and a life lost, endless lives change nothing", () => {
  const round = roomOf("wing", "kitchen");
  standAt(round, 40);
  launch(round, 3);
  assert.equal(rocketsOf(round).length, 3);
  assert.equal(round.arms[0].n, 2);
  through(round);
  assert.equal(rocketStuff(round), 0, "a room change clears them");
  assert.equal(round.arms[0].kind, "rocket");
  assert.equal(round.arms[0].n, 2, "and the bag stays");
  const dead = open();
  launch(dead, 3);
  dead.you.safeMs = 0;
  ghoul.lose(dead, "bone");
  for (let i = 0; i < 600 && dead.phase !== "play"; i++) ghoul.advance(dead, 16, steady);
  run(dead, 40);
  assert.equal(rocketStuff(dead), 0, "a respawn clears them");
  assert.equal(dead.arms[0].n, 2);
  const infinite = open();
  infinite.infinite = true;
  launch(infinite);
  assert.equal(rocketsOf(infinite).length, 3);
  assert.equal(ghoul.POWERS.rocket.max, 6);
});

test("Ghoul Rush's rockets and their sparks freeze while the game is paused", () => {
  const { g, round } = game();
  standAt(round, 60);
  give(round, "rocket", 2);
  ghoul.pressFire(round);
  ghoul.releaseFire(round);
  ghoul.pressFire(round);
  g.tick(100);
  const rs = rocketsOf(round);
  assert.equal(rs.length, 3);
  const at = rs.map((h) => [h.x, h.y, h.t, h.sparks.length]);
  g.pause();
  g.tick(500);
  assert.deepEqual(rs.map((h) => [h.x, h.y, h.t, h.sparks.length]), at, "paused");
  g.resume();
  g.tick(100);
  assert.ok(rs[0].t > at[0][2]);
});

test("Ghoul Rush's rocket launch sounds once per volley with a quieter copy, and the blasts share one sound", () => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name, v) => played.push([name, v]), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 0 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: ghoul };
  react({ type: "armUse", kind: "rocket", x: 1, y: 1, face: 1 }, kit);
  assert.equal(played.length, 2);
  assert.ok(played.every(([name]) => name === "ghoulArmRocket"), "the wired rocket tone, no new file");
  assert.ok(played[0][1] > played[1][1], "the volley's, then a lower copy for the other two");
  assert.ok(ghoulSfx.default.tones.ghoulArmRocket);
  played.length = 0;
  react({ type: "armBoom", x: 1, y: 1 }, kit);
  assert.equal(played.length, 1);
  assert.ok(ghoulSfx.default.tones[played[0][0]]);
  // Three blasts at once raise a few events at most, one use event a volley.
  const round = open();
  launch(round);
  run(round, 2200);
  assert.ok(events(round, "armBoom").length >= 1 && events(round, "armBoom").length <= 3);
  assert.equal(events(round, "armUse").length, 1);
});

test("Ghoul Rush's rockets, their sparks and their burst draw in a dark room and a lit one, and light the dark", () => {
  for (const dark of [false, true]) {
    const { g, round } = game();
    round.dark = dark;
    standAt(round, 60);
    const z = put(round, "zombie", 84, { hp: 3 });
    z.stunMs = 1e9;
    give(round, "rocket", 2);
    g.key("action");
    g.tick(8);
    g.release("action");
    g.tick(8);
    g.key("action");
    g.tick(16);
    g.release("action");
    let flight = false;
    let burst = false;
    for (let i = 0; i < 40; i++) {
      g.tick(32);
      flight ||= rocketsOf(round).some((h) => h.sparks.length > 4);
      burst ||= boomsOf(round).length > 0;
    }
    assert.ok(flight, `sparks in flight, dark ${dark}`);
    assert.ok(burst, `a burst, dark ${dark}`);
  }
  const round = open();
  launch(round);
  const lit = [];
  rocketArt({ circle: () => {} }).lights({ round }, (...a) => lit.push(a));
  assert.ok(lit.length >= 4, "three heads and the muzzle");
  assert.ok(lit.every(([, , r, s]) => r >= 8 && s > 0));
});

/* ------------------------------------------------------------------- bosses */

test("Ghoul Rush's boss takes a weapon's damage scaled to its hp at this depth, and past 35% of its hp in a fight only 1 a hit", () => {
  const fight = fightOf("manor", "ballroom");
  const b = fight.boss;
  const near = () => fight.hazards.push({ kind: "stick", x: b.x, y: 6, vx: 0, vy: 0, fuse: 4, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  b.stunMs = 1e9;
  const hp0 = b.hp;
  near();
  run(fight, 12);
  assert.equal(hp0 - b.hp, arm.DYN_BOSS_DMG, "8 at the first depth");
  // Deep in a run it takes the same share of a tougher boss.
  const deep = fightOf("manor", "ballroom", 7);
  assert.ok(deep.boss.max > hp0);
  deep.boss.stunMs = 1e9;
  const before = deep.boss.hp;
  deep.hazards.push({ kind: "stick", x: deep.boss.x, y: 6, vx: 0, vy: 0, fuse: 4, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(deep, 12);
  assert.equal(before - deep.boss.hp, Math.round((arm.DYN_BOSS_DMG * deep.boss.max) / hp0));
  // The cap: use the numbers straight on.
  const cap = fightOf("manor", "ballroom");
  cap.boss.stunMs = 1e9;
  let taken = 0;
  for (let i = 0; i < 40 && cap.boss.state === "fight"; i++) {
    const was = cap.boss.hp;
    cap.hazards.push({ kind: "stick", x: cap.boss.x, y: 6, vx: 0, vy: 0, fuse: 4, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
    run(cap, 12);
    const d = was - cap.boss.hp;
    taken += d;
    if (taken > cap.boss.max * arm.ARM_BOSS_SHARE + arm.DYN_BOSS_DMG) assert.equal(d, 1, "past the cap only 1");
  }
  assert.ok(cap.armBossDmg <= cap.boss.max * arm.ARM_BOSS_SHARE + arm.DYN_BOSS_DMG);
});

test("Ghoul Rush's weapons respect a boss's guard and a hidden boss, and a weapon that fells a boss leaves the hazards tidy", () => {
  // Mother Mourning, weeping: shrugs it off, and it shows.
  const mourn = fightOf("graveyard", "angel");
  const m = mourn.boss;
  m.act = "weep";
  m.stunMs = 1e9;
  const hp = m.hp;
  mourn.hazards.push({ kind: "stick", x: m.x, y: 6, vx: 0, vy: 0, fuse: 4, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(mourn, 12);
  assert.equal(m.hp, hp, "guarded");
  assert.ok(events(mourn, "bossBlock").length >= 1);
  // The Tommyknocker, hidden in the seam.
  const tommy = fightOf("mine", "seam");
  tommy.boss.hidden = true;
  tommy.boss.stunMs = 1e9;
  const th = tommy.boss.hp;
  tommy.hazards.push({ kind: "stick", x: tommy.boss.x, y: 6, vx: 0, vy: 0, fuse: 4, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(tommy, 12);
  assert.equal(tommy.boss.hp, th);
  // A blast that fells him, with other hazards still alive on the list.
  const end = fightOf("manor", "ballroom");
  end.boss.hp = 1;
  end.boss.stunMs = 1e9;
  end.hazards.push({ kind: "armSalt", x: 10, y: 6, life: 1e6, max: 1e6, tick: 1e6, bossDone: 0, w: arm.SALT_W, h: 1, live: 0, cause: "" });
  end.hazards.push({ kind: "stick", x: end.boss.x, y: 6, vx: 0, vy: 0, fuse: 4, max: 1000, spin: 0, rest: true, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  run(end, 40);
  assert.equal(end.boss.state, "down");
  assert.ok(end.hazards.every(Boolean), "no holes");
});

test("Ghoul Rush's Tuning Fork strikes the Choirmaster's pipes, a stake too, harder than a bolt", () => {
  const fight = fightOf("chapel", "choir");
  const b = fight.boss;
  assert.ok(b.pipes?.length === 4);
  b.stunMs = 1e9;
  const p = b.pipes[0];
  const hp = p.hp;
  fight.hazards.push({ kind: "armRing", x: p.x, y: 6, r: 0, life: arm.RING_MS, max: arm.RING_MS, hit: [], hitPipe: [], hitBoss: false, w: 1, h: 1, live: 0, cause: "" });
  standAt(fight, p.x - 1);
  fight.lockX = fight.spec.arena;
  run(fight, arm.RING_MS + 8);
  assert.equal(p.hp, hp - arm.RING_PIPE);
  assert.ok(events(fight, "pipeHit").length >= 1);
  assert.equal(b.hp, b.max, "he stays guarded");
});

test("Ghoul Rush's Flash Powder and Bear Trap hold a boss still for a moment, and the Matron's beam goes dark", () => {
  const fight = fightOf("sanatorium", "ward");
  const b = fight.boss;
  const hp = b.hp;
  fight.hazards.push({ kind: "armPod", pay: "flash", x: b.x - 2, y: b.y + 1, vx: 0, vy: -10, spin: 0, w: 0.8, h: 0.8, live: 0, cause: "" });
  run(fight, 200);
  assert.ok(b.stunMs > 0, "dazed");
  assert.ok(events(fight, "armDaze").length === 1);
  assert.equal(hp - b.hp, arm.FLASH_BOSS_DMG);
  const t = b.t;
  const heat = b.heat;
  run(fight, 300);
  assert.equal(b.heat, heat, "no heat builds");
  assert.ok(b.t > t);
  const trap = fightOf("village", "green");
  const beast = trap.boss;
  trap.hazards.push({ kind: "armTrap", x: beast.x, y: beast.y, vy: 0, rest: true, arm: 0, life: 1e6, shut: 0, w: 2.4, h: 1, live: 0, cause: "" });
  const was = beast.hp;
  run(trap, 8);
  assert.equal(was - beast.hp, arm.TRAP_BOSS);
  assert.ok(beast.stunMs > 0, "pinned");
  // A guarded boss is neither hurt nor held: that would only cut short the moment she can be hurt.
  const weep = fightOf("graveyard", "angel");
  const angel = weep.boss;
  angel.act = "weep";
  const her = angel.hp;
  weep.hazards.push({ kind: "armTrap", x: angel.x, y: angel.y, vy: 0, rest: true, arm: 0, life: 1e6, shut: 0, w: 2.4, h: 1, live: 0, cause: "" });
  weep.hazards.push({ kind: "armPod", pay: "flash", x: angel.x, y: angel.y + 1, vx: 0, vy: -10, spin: 0, w: 0.8, h: 0.8, live: 0, cause: "" });
  ghoul.advance(weep, 4, steady);
  assert.equal(angel.hp, her);
  assert.ok(!(angel.stunMs > 0), "no daze");
});

test("Ghoul Rush's boss at half hp gives an empty bag its stage's weapon, once a fight, and never while you hold one", () => {
  const fight = fightOf("wing", "crypt");
  fight.boss.stunMs = 1e9;
  fight.boss.hp = Math.floor(fight.boss.max / 2);
  run(fight, 8);
  assert.deepEqual(fight.drops.map((d) => d.kind), ["skillet"]);
  fight.drops.length = 0;
  run(fight, 8);
  assert.equal(fight.drops.length, 0, "once");
  const holding = fightOf("wing", "crypt");
  holding.boss.stunMs = 1e9;
  holding.arms = [{ kind: "dyn", n: 1 }];
  holding.boss.hp = Math.floor(holding.boss.max / 2);
  run(holding, 8);
  assert.equal(holding.drops.length, 0);
});

/* ---------------------------------------------------------------- Bat wings */

test("Ghoul Rush's Bat wings catch a fall down a pit: no life or die spent, he flies back to where he last stood, no key working, safe on landing, and the wings are spent", () => {
  const round = roomOf("manor", "gallery");
  ghoul.applyPower(round, "wings");
  round.dice = 2;
  round.you.garlic = true;
  round.you.safeMs = 0;
  standAt(round, 96);
  run(round, 8);
  const lives = round.lives;
  // Off the edge at 100 and down the pit.
  Object.assign(round.you, { x: 104, state: "air", vy: 0, face: 1 });
  round.input.right = true;
  for (let k = 0; k < 500 && !round.you.lift; k++) ghoul.advance(round, 4, steady);
  round.input.right = false;
  assert.ok(round.you.lift, "they caught him");
  assert.equal(round.phase, "play", "no crash, no roll");
  assert.equal(round.effects.wings, 0, "spent at once");
  assert.equal(events(round, "wingSave").length, 1);
  assert.equal(events(round, "lose").length, 0);
  // No key works on the way, not even a double tap.
  round.input.left = true;
  give(round, "stake", 1);
  tapTap(round);
  assert.equal(round.arms[0].n, 1, "nothing thrown in flight");
  run(round, ghoul.WING_SAVE_MS / 2);
  assert.ok(round.you.y > ghoul.PIT_Y, "on the way up");
  round.input.left = false;
  run(round, ghoul.WING_SAVE_MS / 2 + 8);
  const you = round.you;
  assert.equal(you.lift, null);
  assert.equal(you.state, "run", "standing");
  assert.equal(you.y, 6);
  assert.ok(you.x > 80 && you.x <= 98.5, `back on the ledge he fell from, clear of its edge (${you.x})`);
  assert.ok(you.safeMs > 0, "still safe as he lands");
  assert.equal(round.lives, lives);
  assert.equal(round.dice, 2, "no die spent");
  assert.equal(you.garlic, true, "the shield is kept");
  // He can play on, and a second fall, wings gone, costs a life as ever.
  run(round, 8);
  assert.equal(round.phase, "play");
  Object.assign(you, { x: 104, state: "air", vy: 0, safeMs: 0 });
  round.dice = 0;
  for (let k = 0; k < 500 && round.phase === "play"; k++) ghoul.advance(round, 4, steady);
  assert.equal(round.phase, "crash");
  assert.equal(round.lives, lives - 1);
  assert.equal(events(round, "wingSave").length, 1, "no second save");
});

test("Ghoul Rush's Bat wings carry him back up to a shelf he fell from, and a life lost in flight drops the carry", () => {
  const round = roomOf("manor", "gallery");
  ghoul.applyPower(round, "wings");
  const [x0, x1, top] = round.spec.shelves[0];
  Object.assign(round.you, { x: (x0 + x1) / 2, y: top, state: "run", shelf: 0, vy: 0, safeMs: 1e9 });
  round.camX = Math.max(0, round.you.x - 36);
  run(round, 8);
  const x = round.you.x;
  Object.assign(round.you, { state: "air", y: ghoul.PIT_Y + 0.1, vy: -60, shelf: -1 });
  run(round, 12);
  assert.ok(round.you.lift);
  run(round, ghoul.WING_SAVE_MS + 8);
  assert.equal(round.you.y, top);
  assert.equal(round.you.shelf, 0, "on the shelf");
  assert.ok(Math.abs(round.you.x - x) <= 10);
  // The clock running out mid-flight.
  const late = roomOf("manor", "gallery");
  ghoul.applyPower(late, "wings");
  standAt(late, 96);
  run(late, 8);
  Object.assign(late.you, { x: 104, state: "air", y: ghoul.PIT_Y + 0.1, vy: -60 });
  run(late, 12);
  assert.ok(late.you.lift);
  ghoul.lose(late, "time");
  assert.equal(late.you.lift, null);
  assert.equal(late.phase, "crash");
});

/* ------------------------------------------------------- placing and dropping */

test("Ghoul Rush's every stage has a weapon of its own in every room, each only there, and the hall teaches a stick early", () => {
  for (const st of ghoul.STAGES) {
    const own = STAGE_ARMS[st.id];
    assert.ok(own, `${st.id} has its own`);
    for (const id of st.rooms) {
      const room = ghoul.roomById(id);
      // A ride (the Runaway Cart) has no floor to place one on; what you carry still works.
      if (room.ride) continue;
      const weapons = room.items.filter((i) => ghoul.POWERS[i[0]].arm).map((i) => i[0]);
      assert.ok(weapons.includes(own), `${id} has ${own}`);
      assert.ok(weapons.length >= 1 && weapons.length <= 2 + (st.id === "mine" ? 1 : 0), `${id}: ${weapons}`);
      for (const w of weapons) assert.ok(w === own || COMMON.includes(w), `${id}: ${w} is its stage's or common`);
    }
  }
  const hall = ghoul.roomById("hall");
  const stick = hall.items.find((i) => i[0] === "dyn");
  assert.ok(stick && stick[1] < 60, "the first thing you find");
  for (const [stage, kind] of Object.entries(STAGE_ARMS)) {
    if (kind === "dyn") continue;
    assert.equal(ghoul.powerHere({ dark: true, stage }, kind), true);
    assert.equal(ghoul.powerHere({ dark: true, stage: stage === "manor" ? "wing" : "manor" }, kind), false, `${kind} elsewhere`);
    assert.equal(ghoul.powerHere({ dark: true, stage: null }, kind), false, `${kind} in the hall`);
  }
  // Every placed weapon is in the room's loot as itself.
  const round = roomOf(null, "hall");
  const at = round.spec.items.findIndex((i) => i[0] === "dyn");
  assert.equal(round.loot[at], "dyn");
});

test("Ghoul Rush's weapons drop from their own band of a kill's roll, with no extra draw: never from pickPower, mostly the common ones, the stage's own first", () => {
  const rnd = ghoul.seeded(3);
  for (const stage of [null, ...Object.keys(STAGE_ARMS)]) {
    for (let i = 0; i < 300; i++) {
      for (const dropping of [false, true]) assert.ok(!ghoul.POWERS[pickPower(rnd, { dark: i % 2 === 0, stage }, "", dropping)].arm, `${stage}`);
    }
  }
  assert.equal(armDrop({ stage: "wing" }, 0), "skillet");
  assert.equal(armDrop({ stage: "wing" }, ARM_DROP_OWN - 0.01), "skillet");
  assert.ok(COMMON.includes(armDrop({ stage: "wing" }, ARM_DROP_OWN + 0.01)));
  assert.ok(COMMON.includes(armDrop({ stage: null }, 0)), "the hall has none of its own");
  const seen = new Set();
  for (let t = 0; t < 1; t += 0.01) seen.add(armDrop({ stage: null }, t));
  assert.deepEqual([...seen].sort(), [...COMMON].sort());
  // Exactly one draw for a kill, drop or no drop.
  const round = roomOf(null, "hall");
  standAt(round, 40);
  const m = put(round, "zombie", 60);
  let draws = 0;
  ghoul.kill(round, m, "shot", () => (draws++, 0.07 + ghoul.DROP_CANDY + ARM_DROP / 2));
  assert.equal(draws, 1);
  assert.equal(round.drops.length, 1);
  assert.ok(ghoul.POWERS[round.drops[0].kind].arm);
  // A horde kill leaves nothing, as ever.
  const horde = put(round, "zombie", 62, { horde: true });
  round.drops.length = 0;
  ghoul.kill(round, horde, "shot", () => 0.38);
  assert.equal(round.drops.length, 0);
});

test("Ghoul Rush's stage select comes with the stage's weapon and the common ones full, to try them", () => {
  const round = ghoul.newRound(5);
  round.dice = 0;
  round.practice = true;
  round.phase = "select";
  const at = ghoul.STAGES.findIndex((s) => s.id === "wing");
  round.select = { at, room: 0 };
  assert.equal(ghoul.takeSelect(round), true);
  assert.equal(round.arms[0].kind, "skillet");
  assert.equal(round.arms[0].n, ghoul.POWERS.skillet.max);
  assert.deepEqual(round.arms.map((a) => a.kind).sort(), ["dyn", "rocket", "skillet", "stake"]);
});

/* ------------------------------------------------------------- art and sound */

test("Ghoul Rush's weapons all draw and every sound they name exists", () => {
  const tones = ghoulSfx.default.tones;
  for (const [name, def] of Object.entries(ARMS_SFX.tones)) {
    assert.ok(name.startsWith("ghoulArm"), name);
    assert.ok(tones[name], `${name} merged`);
    for (const l of def.layers) {
      assert.ok(l.gain > 0 && l.gain <= 1, `${name} gain`);
      assert.ok((l.delay || 0) + l.seconds <= 1.2, `${name} ends in time`);
    }
  }
  const noop = () => {};
  const played = [];
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 0 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: ghoul };
  for (const kind of ALL) react({ type: "armUse", kind, x: 1, y: 1, face: 1 }, kit);
  for (const type of ["armBounce", "armClang", "armTurn", "armSalt", "armFlash", "armSnap", "armDaze", "armBoom"]) react({ type, kind: "zombie", x: 1, y: 1 }, kit);
  for (const name of played) assert.ok(tones[name], `${name} exists`);
  // A real frame with every weapon on the field and in the air, in a boss's room, the HUD showing each badge.
  const ctx = new Proxy({}, { get: (t, name) => (name in t ? t[name] : () => {}), set: (t, name, value) => ((t[name] = value), true) });
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  g.resize(900, 900);
  g.key("action");
  g.tick(16);
  const round = g.round;
  round.phase = "play";
  round.you.safeMs = 1e9;
  for (const kind of ALL) {
    round.arms = [{ kind, n: 2 }];
    round.armCool = 0;
    round.tap = null;
    g.key("action");
    g.tick(8);
    g.release("action");
    g.tick(8);
    g.key("action");
    g.tick(40);
    g.release("action");
    g.tick(320);
    round.drops.push({ id: 0, kind, x: round.you.x + 5, y: 12, vx: 0, vy: 0, life: 900, rest: true });
    g.tick(16);
  }
  assert.ok(round.score >= 0);
});

test("Ghoul Rush's Dynamite, Road Flare, Salt and Flash Powder are aimed: they land on the first monster ahead, or the middle of the group around it, and fly the old fixed throw with nothing ahead", () => {
  const landsAt = (kind, setup, tail) => {
    const round = roomOf("village", "inn");
    standAt(round, 40);
    give(round, kind, 3);
    setup(round);
    tapTap(round);
    const hz = round.hazards.find((h) => ["stick", "armRoadFlare", "armPod"].includes(h.kind));
    assert.ok(hz, `${kind} thrown`);
    for (let i = 0; i < 400 && round.hazards.includes(hz) && !hz.rest; i++) run(round, 16);
    return hz.x;
  };
  const still = (round, x) => put(round, "zombie", x, { stunMs: 1e9 });
  for (const kind of ["dyn", "flare", "salt", "flash"]) {
    const lone = landsAt(kind, (r) => still(r, 70));
    assert.ok(Math.abs(lone - 70) < (kind === "salt" || kind === "flash" ? 8 : 2), `${kind} lands on a lone monster (${lone})`);
    const group = landsAt(kind, (r) => { still(r, 62); still(r, 66); still(r, 70); still(r, 130); });
    assert.ok(Math.abs(group - 66) < (kind === "salt" || kind === "flash" ? 8 : 2), `${kind} lands in the middle of the group (${group})`);
    const behind = landsAt(kind, (r) => still(r, 10));
    const none = landsAt(kind, () => {});
    assert.ok(Math.abs(behind - none) < 0.5, `${kind} ignores what is behind`);
  }
  // The Creampie keeps its fixed lob.
  const pie = roomOf("village", "inn");
  standAt(pie, 40);
  give(pie, "pie", 3);
  put(pie, "zombie", 62, { stunMs: 1e9 });
  tapTap(pie);
  const lob = pie.hazards.find((h) => h.kind === "armPie");
  assert.ok(lob && Math.abs(lob.vx - arm.PIE_VX) < 1e-9, "the pie is not aimed");
});
