// Web console tests, Ghoul Rush's Old Rattlebones: his volley and slam, the skull he throws like a boomerang (and is headless without), the bone rain and the skeletons he raises once his rage begins, the double slam, and what each move looks and sounds like.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as bn from "../src/web-console/public/activities/ghoul-rush/stages/wing/ghoul-bones.js";
import { LOSE_SOUNDS, LOSE_WORDS } from "../src/web-console/public/activities/ghoul-rush/stages/wing/ghoul-bones-draw.js";
import { VOICES, react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round in the East Wing's Crypt with the boss awake and fighting, you
// safe, his next attack held off until a test starts one.
function crypt() {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.offer = ["wing"];
  round.phaseMs = 0;
  ghoul.pickStage(round, 0);
  while (round.spec.id !== "crypt") through(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  standAt(round, round.spec.arena + ghoul.BOSS_LOCK + 2);
  ghoul.advance(round, 4, steady);
  ghoul.advance(round, ghoul.BOSS_INTRO_MS + 8, steady);
  assert.equal(round.boss.state, "fight");
  round.events.length = 0;
  round.boss.t = -1e9;
  round.you.safeMs = 1e9;
  return round;
}

function standAt(round, x, shelf = -1) {
  const y = shelf >= 0 ? round.spec.shelves[shelf][2] : ghoul.groundAt(round.spec, x);
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, out: 0, safeMs: 0, face: 1 });
  round.camX = Math.max(0, Math.min(round.spec.length - ghoul.FIELD_W, x - 36));
}

// He stands `gap` to the right of you, in the middle of the arena.
function faceOff(round, gap = 18) {
  const b = round.boss;
  standAt(round, round.spec.arena + 30);
  b.x = round.you.x + gap;
  b.y = ghoul.groundAt(round.spec, b.x);
  round.you.safeMs = 1e9;
  return b;
}

// Starts his `act` at once, and runs it out of its windup.
function wind(round, act) {
  const b = round.boss;
  b.act = act;
  b.windup = 1;
  ghoul.advance(round, 4, steady);
}

const step = (round, ms = 4, random = steady) => ghoul.advance(round, ms, random);

test("Ghoul Rush: Old Rattlebones has 90 hp, attacks every 1250 ms (950 in his rage), and his hint tells you to jump the skull and then aim for it", () => {
  assert.equal(ghoul.BOSSES.bones.hp, 90);
  assert.equal(ghoul.BONES_MS, 1250);
  assert.equal(ghoul.BONES_RAGE_MS, 950);
  assert.match(ghoul.BOSSES.bones.sub, /skull/i);
  const round = crypt();
  assert.equal(round.boss.hp, round.spec.bossHp);
  assert.ok(round.boss.hp >= 90);
});

test("Ghoul Rush: Old Rattlebones' first attack is a volley, then each is picked at random, never the same one three times running, and bone rain waits for his rage", () => {
  const b = { attacks: 0, raged: false };
  assert.equal(bn.pickAct(b, () => 0.99), "volley", "the first is always a volley");
  const seen = new Set();
  for (const r of [0, 0.34, 0.67, 0.99]) {
    const act = bn.pickAct({ attacks: 1, raged: false, last: ["volley", "slam"] }, () => r);
    seen.add(act);
  }
  assert.deepEqual([...seen].sort(), ["skull", "slam", "volley"], "all three, and no rain");
  assert.ok(!bn.pickAct({ attacks: 1, raged: false }, () => 0.99).includes("rain"));
  assert.notEqual(bn.pickAct({ attacks: 3, raged: true, last: ["slam", "slam"] }, () => 0.5), "slam", "not a third slam");
  const rain = bn.pickAct({ attacks: 3, raged: true, last: ["slam", "volley"] }, () => 0.99);
  assert.equal(rain, "rain", "bone rain is open in the rage");
  // Run for real: a long fight never repeats an act three times in a row.
  const round = crypt();
  const b2 = faceOff(round);
  b2.t = 0;
  const acts = [];
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let ms = 0; ms < 120000; ms += 4) {
    ghoul.advance(round, 4, random);
    if (round.boss.state !== "fight") break;
    for (const e of round.events) {
      if (e.type === "windup" && e.boss) acts.push(e.act);
      else if (e.type === "skullWind") acts.push("skull");
      else if (e.type === "rainWind") acts.push("rain");
    }
    round.events.length = 0;
    round.you.safeMs = 1e9;
    b2.hp = b2.max;
  }
  assert.ok(acts.length > 30, `many attacks (${acts.length})`);
  assert.equal(acts[0], "volley");
  for (let i = 2; i < acts.length; i++) assert.ok(!(acts[i] === acts[i - 1] && acts[i] === acts[i - 2]), `no three ${acts[i]} in a row`);
  assert.ok(["volley", "slam", "skull"].every((a) => acts.includes(a)), "and all three get thrown");
  assert.ok(!acts.includes("rain"), "no rain before the rage");
});

test("Ghoul Rush: a volley throws one bone at each VOLLEY scale, and a slam sends a shockwave both ways that a jump clears", () => {
  const round = crypt();
  faceOff(round);
  wind(round, "volley");
  assert.equal(events(round, "throw").length, ghoul.VOLLEY.length, "a volley");
  assert.ok(events(round, "throw").every((e) => e.by === "bones"));
  round.bones.length = 0;
  wind(round, "slam");
  assert.deepEqual(round.waves.map((w) => w.dir).sort(), [-1, 1]);
  assert.equal(events(round, "slam").length, 1, "one slam, no echo outside the rage");
  step(round, 600);
  assert.equal(round.waves.filter((w) => w.dir === 1).length > 0, true);
  const wave = (jumped) => {
    const r = crypt();
    standAt(r, r.spec.arena + 30);
    r.you.safeMs = 0;
    r.waves.push({ x: r.you.x + 8, y: 6, dir: -1, life: 6000 });
    let hit = false;
    for (let ms = 0; ms < 1000 && !hit; ms += 4) {
      if (jumped && Math.abs(r.waves[0]?.x - r.you.x) < 4 && r.you.state === "run" && r.you.vy === 0 && !r.input.jump) {
        r.input.jump = ghoul.JUMP_BUFFER_MS;
        r.input.up = true;
      }
      step(r);
      hit = r.phase !== "play";
    }
    return hit;
  };
  assert.equal(wave(false), true, "standing still, the wave hits");
  assert.equal(wave(true), false, "a jump clears it");
});

test("Ghoul Rush: his skull flies out level at your chest, turns past you and curves back to his neck, headless meanwhile", () => {
  const round = crypt();
  const b = faceOff(round);
  b.act = "skull";
  b.windup = bn.SKULL_WINDUP_MS;
  step(round, bn.SKULL_WINDUP_MS - 20);
  assert.equal(b.headless, undefined, "still has his head while he winds up");
  assert.equal(round.hazards.length, 0);
  step(round, 40);
  const h = round.hazards.find((q) => q.kind === "skull");
  assert.ok(h, "the skull is out");
  assert.equal(b.headless, true);
  assert.equal(events(round, "skullThrow").length, 1);
  assert.ok(Math.abs(h.fy - (round.you.y + ghoul.SHOT_Y)) < 0.01, "at your chest");
  assert.equal(h.dir, -1, "toward you");
  let past = false;
  let ys = [];
  let turned = false;
  let home = false;
  for (let ms = 0; ms < 6000 && !home; ms += 4) {
    step(round);
    const s = round.hazards.find((q) => q.kind === "skull");
    if (!s) {
      home = true;
      break;
    }
    if (s.state === "out") ys.push(s.fy);
    if (s.state === "back") turned = true;
    if (s.x < round.you.x - 1) past = true;
    assert.equal(b.headless, true, "headless the whole flight");
  }
  assert.ok(past, "it goes past you");
  assert.ok(turned, "and turns");
  assert.ok(home, "and comes home");
  assert.ok(ys.every((y) => Math.abs(y - ys[0]) < 1e-9), "level going out");
  assert.equal(b.headless, false, "his head is back");
  assert.equal(events(round, "skullBack").length, 1);
  assert.equal(events(round, "skullTurn").length, 1);
  assert.equal(b.t < 100, true, "his next attack waits a full beat from the catch");
});

test("Ghoul Rush: the skull hurts you if you stand, and a jump clears it going out and again coming back", () => {
  const fly = (jump) => {
    const round = crypt();
    const b = faceOff(round);
    round.you.safeMs = 0;
    b.act = "skull";
    b.windup = 1;
    let lost;
    let jumps = 0;
    for (let ms = 0; ms < 8000; ms += 4) {
      const s = round.hazards.find((q) => q.kind === "skull");
      if (jump && s && Math.abs(s.x - round.you.x) < 7 && round.you.state === "run" && round.you.vy === 0 && !round.input.jump) {
        round.input.jump = ghoul.JUMP_BUFFER_MS;
        round.input.up = true;
        jumps++;
      }
      step(round);
      if (round.phase !== "play") {
        lost = round.events.find((e) => e.type === "lose")?.cause;
        break;
      }
      if (b.headless === false && ms > 400) break;
    }
    return { lost, jumps, back: b.headless === false };
  };
  assert.equal(fly(false).lost, "skull", "standing, the skull takes a life");
  const done = fly(true);
  assert.equal(done.lost, undefined, "jumping, it passes");
  assert.ok(done.jumps >= 2 && done.jumps <= 3, `a jump going and a jump coming back (${done.jumps})`);
  assert.equal(done.back, true);
});

test("Ghoul Rush: while the skull is out his body takes single shots with no weak spot, and a bolt to the skull does three, used up on it, with a beat before the next counts", () => {
  const round = crypt();
  const b = faceOff(round);
  const head = () => ({ x: b.x - b.w / 2 - 0.3, y: b.y + b.h * 0.9, vx: 80, vy: 0, gone: 0 });
  let hp = b.hp;
  round.shots.push(head());
  step(round);
  assert.equal(b.hp, hp - 2, "his skull on his shoulders: double");
  wind(round, "skull");
  assert.equal(b.headless, true);
  hp = b.hp;
  b.x += 0;
  round.shots.push(head());
  step(round);
  assert.equal(b.hp, hp - 1, "headless, the neck is just body");
  // A bolt to the skull itself.
  const sk = round.hazards.find((q) => q.kind === "skull");
  hp = b.hp;
  round.shots.push({ x: sk.x + 1, y: sk.fy, vx: -80, vy: 0, gone: 0 });
  step(round);
  assert.equal(b.hp, hp - bn.SKULL_HIT, "the skull takes SKULL_HIT");
  assert.equal(round.shots.length, 0, "the bolt is used up");
  assert.ok(events(round, "bossHit").some((e) => e.how === "skull" && e.kind === "bones"), "a hit event carrying kind");
  hp = b.hp;
  const again = round.hazards.find((q) => q.kind === "skull");
  round.shots.push({ x: again.x + 1, y: again.fy, vx: -80, vy: 0, gone: 0 });
  step(round);
  assert.equal(b.hp, hp, "no second hit inside the stagger");
  assert.equal(round.shots.length, 0, "but the bolt is still eaten");
  step(round, bn.SKULL_STAGGER_MS + 20);
  const later = round.hazards.find((q) => q.kind === "skull");
  if (later) {
    round.shots.push({ x: later.x + 1, y: later.fy, vx: -80, vy: 0, gone: 0 });
    step(round);
    assert.equal(b.hp, hp - bn.SKULL_HIT, "after the stagger it counts again");
  }
});

test("Ghoul Rush: his skull in flight does not hurt a boss that is already down, and killing him with it out clears it", () => {
  const round = crypt();
  const b = faceOff(round);
  wind(round, "skull");
  b.hp = bn.SKULL_HIT;
  const sk = round.hazards.find((q) => q.kind === "skull");
  round.shots.push({ x: sk.x + 1, y: sk.fy, vx: -80, vy: 0, gone: 0 });
  step(round);
  assert.equal(b.state, "down");
  assert.equal(round.hazards.length, 0);
  step(round, 100);
  assert.equal(round.hazards.length, 0);
});

test("Ghoul Rush: at half his hp he shakes and his eyes flare (one event), attacks faster, and a slam comes in a double with the second wave a beat behind", () => {
  const round = crypt();
  const b = faceOff(round);
  b.hp = Math.ceil(b.max / 2) + 1;
  step(round);
  assert.ok(!b.raged);
  b.hp = Math.floor(b.max / 2);
  step(round);
  assert.equal(b.raged, true);
  assert.equal(events(round, "bonesRage").length, 1);
  assert.ok(b.shake > 0, "he shakes");
  step(round, bn.BONES_SHAKE_MS + 20);
  step(round, 200);
  assert.equal(events(round, "bonesRage").length, 1, "only the once");
  // The cadence: the next attack winds up BONES_RAGE_MS after the shake.
  b.t = 0;
  round.events.length = 0;
  step(round, bn.BONES_RAGE_MS - 20);
  assert.equal(events(round, "windup").length + events(round, "skullWind").length + events(round, "rainWind").length, 0);
  step(round, 40);
  assert.equal(events(round, "windup").length + events(round, "skullWind").length + events(round, "rainWind").length, 1, "winds up on the rage beat");
  // A double slam.
  round.events.length = 0;
  b.windup = 0;
  b.t = -1e9;
  round.waves.length = 0;
  wind(round, "slam");
  assert.equal(round.waves.length, 2, "the first pair");
  const xs = round.waves.map((w) => w.x);
  step(round, bn.DOUBLE_GAP_MS - 20);
  assert.equal(round.waves.length, 2);
  step(round, 40);
  assert.equal(round.waves.length, 4, "the second pair a beat later");
  assert.equal(events(round, "slam").length, 2);
  assert.equal(events(round, "slam")[1].echo, true);
  const gap = Math.abs(round.waves[0].x - round.waves[2].x);
  assert.ok(gap > 10 && gap < 30, `waves ${gap.toFixed(1)} apart: ${xs.join()}`);
});

test("Ghoul Rush: in his rage bone rain throws bones up that come down at spots around you, each on a shadow first, and a bone landing on you costs a life unless lives are endless", () => {
  const round = crypt();
  const b = faceOff(round);
  b.raged = true;
  b.raiseIn = 1e9;
  wind(round, "rain");
  const bones = round.hazards.filter((h) => h.kind === "rain");
  assert.equal(bones.length, bn.RAIN_N, "a handful");
  assert.equal(events(round, "rainThrow").length, 1);
  assert.ok(bones.every((h) => h.warn >= bn.RAIN_WARN_MS - 8 && h.live === 0 && h.cause === "rain"), "all in shadow");
  assert.ok(bones.some((h) => Math.abs(h.x - round.you.x) < 2), "one near where you stand");
  assert.ok(bones.every((h) => Math.abs(h.x - round.you.x) < bn.RAIN_SPREAD * 3), "all around you");
  assert.equal(new Set(bones.map((h) => h.warn)).size, bn.RAIN_N, "landing one after another");
  // Standing in a shadow when the bone lands costs a life.
  const lives = round.lives;
  const spot = bones.find((h) => Math.abs(h.x - round.you.x) < 2);
  standAt(round, spot.x);
  round.you.safeMs = 0;
  step(round, bn.RAIN_WARN_MS - 100);
  assert.equal(round.phase, "play", "the shadow alone does nothing");
  step(round, bn.RAIN_STAGGER_MS * bn.RAIN_N + 200);
  assert.equal(round.phase, "crash");
  assert.equal(round.lives, lives - 1);
  assert.equal(events(round, "lose")[0].cause, "rain");
  assert.ok(events(round, "rainLand").length >= 1);
  // Endless lives: the same bone, no life.
  const inf = crypt();
  inf.infinite = true;
  const b2 = faceOff(inf);
  b2.raged = true;
  b2.raiseIn = 1e9;
  wind(inf, "rain");
  const mine = inf.hazards.find((h) => h.kind === "rain" && Math.abs(h.x - inf.you.x) < 2);
  standAt(inf, mine.x);
  inf.you.safeMs = 0;
  const before = inf.lives;
  step(inf, bn.RAIN_WARN_MS + bn.RAIN_STAGGER_MS * bn.RAIN_N);
  assert.equal(inf.lives, before, "endless lives skip the loss");
  assert.ok(events(inf, "lose").length >= 1);
  // Moving off the spot in time is safe.
  const safe = crypt();
  const b3 = faceOff(safe);
  b3.raged = true;
  b3.raiseIn = 1e9;
  wind(safe, "rain");
  const xsAll = safe.hazards.filter((h) => h.kind === "rain").map((h) => h.x);
  let free = safe.spec.arena + 3;
  while (xsAll.some((x) => Math.abs(x - free) < bn.RAIN_W + 1)) free += 0.5;
  standAt(safe, free);
  safe.you.safeMs = 0;
  step(safe, bn.RAIN_WARN_MS + bn.RAIN_STAGGER_MS * bn.RAIN_N + bn.RAIN_LIVE_MS * 2 + 100);
  assert.equal(safe.phase, "play", "between the bones is safe");
  assert.equal(safe.hazards.filter((h) => h.kind === "rain").length, 0, "and they are gone after");
});

test("Ghoul Rush: in his rage he has skeletons come up out of the floor, the floor cracking first, never more than two about", () => {
  const round = crypt();
  const b = faceOff(round);
  b.raged = true;
  b.raiseIn = 0;
  step(round);
  const crack = round.hazards.find((h) => h.kind === "raise");
  assert.ok(crack, "the floor cracks");
  assert.equal(events(round, "raiseWind").length, 1);
  assert.ok(Math.abs(crack.x - round.you.x) >= 6 && Math.abs(crack.x - b.x) >= b.w / 2 + 2, "clear of you and of him");
  step(round, bn.RAISE_WARN_MS - 20);
  assert.equal(round.monsters.length, 0, "not yet");
  step(round, 40);
  assert.equal(round.monsters.filter((m) => m.kind === "skeleton").length, 1, "up it comes");
  assert.equal(events(round, "raised").length, 1);
  // Over a long fight, never more than two.
  round.events.length = 0;
  let most = 0;
  let raised = 0;
  for (let ms = 0; ms < 60000; ms += 8) {
    step(round, 8);
    round.you.safeMs = 1e9;
    b.t = -1e9;
    const alive = round.monsters.filter((m) => m.kind === "skeleton" && !m.dead).length + round.hazards.filter((h) => h.kind === "raise").length;
    most = Math.max(most, alive);
    raised += events(round, "raised").length;
    round.events.length = 0;
  }
  assert.equal(most, bn.MAX_BONY, "two at most, and he gets to two");
  assert.equal(raised, 1, "a second came up, and none past the cap");
  // Shoot one down and he raises another after a beat.
  round.monsters.length = 0;
  b.raiseIn = 0;
  step(round, 8);
  assert.ok(round.hazards.some((h) => h.kind === "raise"), "a freed place is filled");
  // Not before the rage.
  const calm = crypt();
  faceOff(calm);
  calm.boss.raiseIn = 0;
  step(calm, 3000);
  assert.equal(calm.hazards.filter((h) => h.kind === "raise").length + calm.monsters.length, 0);
});

test("Ghoul Rush: his fall clears the skull, the rain and the cracks, and a life lost mid-fight puts his head back on", () => {
  const round = crypt();
  const b = faceOff(round);
  b.raged = true;
  b.raiseIn = 0;
  step(round);
  wind(round, "rain");
  assert.ok(round.hazards.length > 3);
  b.hp = 1;
  round.shots.push({ x: b.x - b.w / 2 - 0.3, y: b.y + 5, vx: 80, vy: 0, gone: 0 });
  step(round);
  assert.equal(b.state, "down");
  assert.equal(round.hazards.length, 0);
  const lost = crypt();
  const b2 = faceOff(lost);
  b2.hp = 60;
  wind(lost, "skull");
  assert.equal(lost.boss.headless, true);
  ghoul.lose(lost, "skull");
  step(lost, ghoul.CRASH_MS + 10);
  assert.equal(lost.hazards.length, 0);
  assert.ok(!lost.boss.headless, "a new boss in the arena");
  assert.equal(lost.boss.hp, 60, "with the hp kept");
});

test("Ghoul Rush: Old Rattlebones' new moves each play one sound, and the new deaths have their words and sounds", () => {
  const names = new Set(Object.values(VOICES).flatMap((v) => Object.values(v)));
  const heard = (e) => {
    const played = [];
    const floats = [];
    const noop = () => {};
    const kit = { tone: (name) => played.push(name), burst: noop, float: (x, y, text) => floats.push(text), ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6 };
    react(e, kit);
    return { played, voices: played.filter((n) => names.has(n)), floats };
  };
  const at = { x: 10, y: 6, kind: "bones" };
  for (const type of ["skullWind", "skullThrow", "rainWind", "bonesRage"]) assert.equal(heard({ ...at, type }).voices.length, 1, `${type}: one voice`);
  for (const type of ["skullBack", "skullTurn", "rainThrow", "rainLand", "raiseWind", "raised"]) {
    const { played } = heard({ ...at, type });
    assert.ok(played.length <= 2 && played.length >= (type === "raised" ? 0 : 1), `${type}: ${played.join()}`);
    assert.equal(heard({ ...at, type }).voices.length, 0, `${type}: no cry on top`);
  }
  // A bolt to the skull plays the boss's hurt cry once, like any boss hit.
  assert.equal(heard({ type: "bossHit", kind: "bones", x: 1, y: 1, how: "skull" }).voices.length, 1);
  // Every cause that can take a life here has its words and a sound.
  for (const cause of ["skull", "rain"]) assert.ok(LOSE_WORDS[cause] && LOSE_SOUNDS[cause], cause);
  assert.ok(!/\u2014/.test(Object.values(LOSE_WORDS).join("")), "no em dash");
});
