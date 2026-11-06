// Web console tests, Ghoul Rush's finale, Kill II, Every Room at Once (the dollhouse): the room
// agrees with the rules' house, the boss's box out of reach and always guarded, the Eye (a lamp
// flares first, it opens, never twice running in one room, hit only through its open box from its
// own floor, a clank while it flares or shuts, two lamps and one true in its last phase), the
// shades (the keepers beaten this run, a fixed three in practice, every stage's boss with a move,
// a door first, at most SHADE_CAP, each move telegraphed, costing a life with its own cause and
// dodged), the lurch (a creak first, YOU slid and stopped at the end walls, a dresser to jump or
// shoot apart), the kill and its retreat in order with the door kept until it has gone, a bot's
// fight length, the voices, words and drawing.
// Run with: node --test scripts/test-web-console-activities-ghoul-eye.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as ey from "../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow-eye.js";
import { LOOKS, LOSE_SOUNDS, LOSE_WORDS, VOICES } from "../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow-eye-draw.js";
import { react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { bossIntroFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-boss-intros.js";
import { toneNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
const events = (round, type) => round.events.filter((e) => e.type === type);
const seededRandom = (seed) => {
  let s = seed;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
};

function stubCanvas() {
  const calls = { count: 0 };
  const ctx = new Proxy({}, {
    get: (target, name) => (name in target ? target[name] : () => { calls.count += 1; }),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, calls, ctx };
}

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

function skipCard(round) {
  round.introMs = ghoul.INTRO_MIN_MS;
  return ghoul.takeIntro(round);
}

// YOU standing on the floor `row` (0 to 2) at x, or on a shelf by index.
function standAt(round, x, row = 0) {
  const y = ey.EYE_FLOORS[row];
  const shelf = row ? round.spec.shelves.findIndex(([a, b, top]) => top === y && b - a > 20) : -1;
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, cuttable: false, out: 0, safeMs: 0, face: 1, ducking: false });
}

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

// A run's way to the dollhouse: the finale entered at `depth` stages, on through its rooms to
// this one, its boss's card passed, nothing else woken.
function eyeRound(depth = ghoul.RUN_STAGES) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.cleared = ghoul.STAGES.slice(0, depth).map((st) => st.id);
  round.offer = null;
  through(round);
  for (let n = 0; round.spec.id !== "dollhouse"; n++) {
    assert.ok(n < 10, "the dollhouse is in the finale");
    skipCard(round);
    skipCard(round);
    through(round);
  }
  skipCard(round);
  round.phase = "play";
  round.items.fill(true);
  round.candy.fill(true);
  round.events.length = 0;
  return round;
}

// Nothing coming: the Eye shut a long while, no lurch, no door, no shade.
function calm(round) {
  const b = round.boss;
  Object.assign(b.eye, { state: "shut", ms: 1e9, room: -1, decoy: -1 });
  Object.assign(b.lurch, { state: "wait", ms: 1e9 });
  b.shadeMs = 1e9;
  round.hazards.length = 0;
  round.monsters.length = 0;
}

// The fight under way: YOU in the arena, the boss awake, everything calm.
function eyeFight(depth = ghoul.RUN_STAGES) {
  const round = eyeRound(depth);
  standAt(round, round.spec.arena + 14);
  run(round, ghoul.BOSS_INTRO_MS + 100);
  assert.equal(round.boss.state, "fight");
  calm(round);
  round.events.length = 0;
  return round;
}

// The Eye opened now in room `i`.
function openIn(round, i) {
  Object.assign(round.boss.eye, { state: "open", ms: 1e9, full: 4000, room: i, decoy: -1 });
}

/* --------------------------------------------------------------- the house */

test("Ghoul Rush's dollhouse: the room agrees with the rules' house, comes after the lawn and the mat in the finale, and its boss is the Eye, named on its card", () => {
  const base = ghoul.roomById("dollhouse");
  assert.equal(base.boss, "marroweye");
  const rooms = ghoul.FINALE.rooms;
  assert.ok(rooms.indexOf("dollhouse") > rooms.indexOf("lawn"), "after the lawn");
  if (rooms.includes("mat")) assert.ok(rooms.indexOf("dollhouse") > rooms.indexOf("mat"), "after the mat");
  const spec = ghoul.roomFor("dollhouse");
  assert.equal(spec.arena + ey.EYE_COLS * ey.EYE_ROOM_W, spec.length, "the rooms fill the arena");
  assert.equal(ghoul.groundAt(spec, spec.arena + 1), ey.EYE_FLOORS[0]);
  for (const f of ey.EYE_FLOORS.slice(1)) assert.ok(spec.shelves.some(([a, b, y]) => y === f && a === spec.arena && b === spec.length), `a floor right across at ${f}`);
  // A landing between each floor at each end, a jump from each to the next.
  for (const [lo, hi] of [[ey.EYE_FLOORS[0], ey.EYE_FLOORS[1]], [ey.EYE_FLOORS[1], ey.EYE_FLOORS[2]]]) {
    const landings = spec.shelves.filter(([a, b, y]) => b - a < 20 && y > lo && y < hi);
    assert.equal(landings.length, 2, `two landings between ${lo} and ${hi}`);
    for (const [, , y] of landings) assert.ok(y - lo <= ghoul.JUMP_TOP - 1 && hi - y <= ghoul.JUMP_TOP - 1, "a jump up to it and on");
  }
  assert.equal(ghoul.BOSSES.marroweye.name, bossIntroFor("marroweye").name);
  assert.ok(LOOKS.dollhouse, "a look");
});

test("Ghoul Rush's dollhouse: the Eye's box is out of everything's reach and always guarded, a lost life keeps its hp, and the fight never costs a life by its box's touch", () => {
  const round = eyeFight();
  const b = round.boss;
  assert.equal(ghoul.guarded(b), true);
  assert.ok(b.y > ghoul.FIELD_H, "its box above the field");
  assert.equal(b.max, round.spec.bossHp);
  b.hp -= 10;
  round.lives = 5;
  ghoul.lose(round, "eyeRock");
  run(round, ghoul.CRASH_MS + ghoul.READY_MS + 100);
  assert.notEqual(round.boss, b, "a new boss object after the life lost");
  assert.equal(round.boss.hp, b.hp, "the same hp");
  // A climb to the top floor and back, under the box's x: no touch.
  const r = eyeFight();
  for (const row of [0, 1, 2]) {
    standAt(r, r.spec.length - 2, row);
    jumpUp(r);
    run(r, 900);
  }
  assert.deepEqual(events(r, "lose"), []);
});

/* ----------------------------------------------------------------- the Eye */

test("Ghoul Rush's dollhouse: a lamp flares before the Eye opens (a second step heard), it opens in that room, shuts, and never opens in the same room twice running; its open time shrinks with its phase", () => {
  const round = eyeFight();
  const b = round.boss;
  Object.assign(b.eye, { state: "shut", ms: 1 });
  const order = [];
  const random = ghoul.seeded(17);
  for (let t = 0; t < 420000; t += 4) {
    round.you.safeMs = 1e9;
    b.shadeMs = 1e9;
    b.lurch.ms = 1e9;
    ghoul.advance(round, 4, random);
    for (const e of round.events) if (e.type.startsWith("eye")) order.push([e.type, e.room, t]);
    round.events.length = 0;
    round.hazards.length = 0;
    round.monsters.length = 0;
  }
  const flares = order.filter(([type]) => type === "eyeFlare");
  const opens = order.filter(([type]) => type === "eyeOpen");
  assert.ok(opens.length >= 10, `it opened many times (${opens.length})`);
  for (let i = 0; i < opens.length; i++) {
    const f = flares[i];
    assert.equal(f[1], opens[i][1], "it opens where its lamp flared");
    assert.ok(opens[i][2] - f[2] >= ey.EYE_FLARE_MS - 8, "after the whole flare");
    if (i) assert.notEqual(opens[i][1], opens[i - 1][1], "never the same room twice running");
  }
  const steps = order.filter(([type]) => type === "eyeFlareStep").length;
  assert.ok(steps >= opens.length && steps <= flares.length, "one step heard each flare");
  assert.ok(ey.EYE_OPEN_MS[0] > ey.EYE_OPEN_MS[1] && ey.EYE_OPEN_MS[1] > ey.EYE_OPEN_MS[2], "shorter open each phase");
  assert.equal(new Set(opens.map(([, room]) => room)).size, ey.EYE_ROOMS, "every room gets its turn");
});

test("Ghoul Rush's dollhouse: in its last phase two lamps flare and only one is true; the other pops out as the Eye opens", () => {
  const round = eyeFight();
  const b = round.boss;
  b.hp = Math.floor(b.max * ey.PHASE_HP[1]) - 1;
  assert.equal(ey.phaseOf(b), 2);
  Object.assign(b.eye, { state: "shut", ms: 1 });
  run(round, 8);
  const flares = events(round, "eyeFlare");
  assert.equal(flares.length, 2);
  assert.equal(flares.filter((e) => e.decoy).length, 1);
  assert.notEqual(flares[0].room, flares[1].room);
  round.events.length = 0;
  run(round, ey.EYE_FLARE_MS + 20);
  assert.equal(events(round, "eyeOpen")[0].room, flares.find((e) => !e.decoy).room, "the true one opens");
  assert.equal(events(round, "eyeDud")[0].room, flares.find((e) => e.decoy).room, "the false one pops out");
});

test("Ghoul Rush's dollhouse: the open Eye is hurt from its own floor by a bolt standing or ducked, from either side, never from another floor; flaring or shutting it clanks; shut, bolts pass", () => {
  for (let i = 0; i < ey.EYE_ROOMS; i++) {
    const r = ey.roomBox(eyeFight().spec, i);
    for (const [side, duck] of [[-1, false], [1, true]]) {
      const round = eyeFight();
      openIn(round, i);
      const x = Math.min(round.spec.length - 2, Math.max(round.spec.arena + 2, r.cx + side * 12));
      standAt(round, x, r.row);
      round.you.face = -side;
      const hp = round.boss.hp;
      run(round, 500, { fire: true, down: duck });
      assert.ok(round.boss.hp < hp, `room ${i} from the ${side < 0 ? "left" : "right"}${duck ? ", ducked" : ""}`);
      assert.ok(events(round, "bossHit").every((e) => e.how === "eye" && Math.abs(e.x - r.cx) < 0.01), "the hit shows at the Eye");
      // From the floor over it, nothing.
      const other = eyeFight();
      openIn(other, i);
      standAt(other, x, (r.row + 1) % 3);
      other.you.face = -side;
      run(other, 500, { fire: true });
      assert.equal(other.boss.hp, other.boss.max, `room ${i}: not from another floor`);
    }
  }
  for (const state of ["flare", "closing"]) {
    const round = eyeFight();
    Object.assign(round.boss.eye, { state, ms: 1e9, full: 1e9, room: 1 });
    standAt(round, ey.roomBox(round.spec, 1).cx - 12);
    run(round, 400, { fire: true });
    assert.equal(round.boss.hp, round.boss.max, `${state}: no harm`);
    assert.ok(events(round, "bossBlock").length > 0, `${state}: a clank`);
  }
  const shut = eyeFight();
  standAt(shut, ey.roomBox(shut.spec, 1).cx - 12);
  run(shut, 400, { fire: true });
  assert.deepEqual([shut.boss.hp, events(shut, "bossBlock").length], [shut.boss.max, 0], "shut: bolts fly on");
});

/* -------------------------------------------------------------- the shades */

test("Ghoul Rush's dollhouse: every boss of every stage has a shade's move, a run's shades are the keepers it beat, and practice meets a fixed three", () => {
  for (const st of ghoul.STAGES) assert.ok(ey.SHADE_MOVES[st.boss], `${st.boss} (${st.id}) has a shade move`);
  for (const of of Object.keys(ey.SHADE_MOVES)) assert.ok(ghoul.BOSSES[of], `${of} is a boss`);
  const round = eyeRound();
  assert.deepEqual(ey.shadesOf(round, { stageById: ghoul.stageById }), round.cleared.map((id) => ghoul.stageById(id).boss));
  assert.deepEqual(ey.shadesOf({ cleared: [] }, { stageById: ghoul.stageById }), [...ey.PRACTICE_SHADES]);
  assert.equal(ey.PRACTICE_SHADES.length, 3);
});

test("Ghoul Rush's dollhouse: a door creaks open before its shade steps out, the shade fades in harmless and unhittable, never more than SHADE_CAP, and it fades away at the end of its life", () => {
  const round = eyeFight();
  const b = round.boss;
  round.you.safeMs = 1e9;
  b.shadeMs = 0;
  run(round, 8);
  assert.equal(events(round, "eyeDoor").length, 1, "the door first");
  assert.equal(round.monsters.length, 0, "no shade yet");
  const door = round.hazards.find((h) => h.kind === "eyeDoorway");
  assert.ok(door && round.boss.lastShade === door.of && ey.shadesOf(round, { stageById: ghoul.stageById }).includes(door.of));
  run(round, ey.EYE_DOOR_MS);
  const m = round.monsters.find((q) => q.kind === "eyeShade");
  assert.ok(m, "out steps a shade");
  assert.equal(ghoul.solid(m), false, "fading in");
  assert.ok(Math.abs(m.x - round.you.x) >= ey.SHADE_CLEAR / 2 || m.y !== round.you.y, "not on top of YOU");
  run(round, ey.SHADE_IN_MS + 20);
  assert.equal(ghoul.solid(m), true, "then solid");
  for (let t = 0; t < 20000; t += 4) {
    round.you.safeMs = 1e9;
    ghoul.advance(round, 4, steady);
    const alive = round.monsters.filter((q) => q.kind === "eyeShade").length + round.hazards.filter((h) => h.kind === "eyeDoorway").length;
    assert.ok(alive <= ey.SHADE_CAP[ey.phaseOf(round.boss)], "never past the cap");
  }
  assert.ok(!round.monsters.includes(m), "gone at the end of its life");
  const g = eyeFight();
  g.you.safeMs = 1e9;
  g.boss.shadeMs = 0;
  run(g, 8);
  g.boss.shadeMs = 1e9;
  run(g, ey.EYE_DOOR_MS + ey.SHADE_LIFE_MS + 100);
  assert.equal(g.monsters.length, 0, "a shade left alone fades by itself");
  assert.equal(events(g, "eyeShadeOut").length, 1);
});

// A shade of `of` put in at x on YOUR floor, out and ready to move at once.
function shadeAt(round, of, x, row = 0) {
  const y = ey.EYE_FLOORS[row];
  round.hazards.push({ kind: "eyeDoorway", x, y, w: 3, h: 5, warn: 1, full: 1, live: 0, of, cause: "marroweye" });
  run(round, 4);
  const m = round.monsters.find((q) => q.kind === "eyeShade" && q.of === of);
  Object.assign(m, { act: "idle", wait: 0, life: 1e9 });
  round.events.length = 0;
  return m;
}

// A full jump: the press, and up held (it stays held: holding it does nothing else) so it is not cut short.
const jumpUp = (r) => {
  r.input.jump = ghoul.JUMP_BUFFER_MS;
  r.input.up = true;
};

// How YOU dodge each move, called each slice: the shade `m`.
const floorThings = new Set(["eyeRipple", "eyeNote", "eyeHoop", "eyeMud"]);
const DODGE = {
  hop: (r) => {
    if (r.hazards.some((h) => floorThings.has(h.kind) && Math.abs(h.x - r.you.x) < 2 + h.speed * r.spec.pace * 0.1 && Math.sign(r.you.x - h.x) === h.dir)) jumpUp(r);
  },
  skull: (r) => {
    r.input.down = r.hazards.some((h) => h.kind === "eyeSkull" && Math.abs(h.x - r.you.x) < 6);
  },
  creep: (r, m) => {
    r.you.face = Math.sign(m.x - r.you.x) || 1;
  },
  scythe: (r) => {
    if (r.hazards.some((h) => h.kind === "eyeScythe" && h.warn > 0 && h.warn < 100)) jumpUp(r);
  },
  dash: (r, m) => {
    if (m.going && Math.abs(m.x - r.you.x) < 8 && Math.sign(r.you.x - m.x) === m.dir) jumpUp(r);
  },
  // Off its mark, away from it, each time it marks YOU.
  leap: (r, m) => {
    if (m.act === "wind" && Math.abs(m.tx - r.you.x) < 4) {
      const away = Math.sign(r.you.x - m.x) || 1;
      const x = r.you.x + away * 8;
      standAt(r, x > r.spec.arena + 3 && x < r.spec.length - 3 ? x : r.you.x - away * 8);
    }
  },
  // Away from the knocker, out from under each rock marked at YOU.
  knock: (r, m) => {
    if (!r.hazards.some((q) => q.kind === "eyeRock" && q.warn > 0 && Math.abs(q.x - r.you.x) < 3)) return;
    const away = Math.sign(r.you.x - m.x) || 1;
    const x = r.you.x + away * 7;
    standAt(r, x > r.spec.arena + 3 && x < r.spec.length - 3 ? x : r.you.x - away * 14);
  },
  // Back the way YOU came: the second icicle falls a step ahead.
  icicles: (r) => {
    if (!r.hazards.some((q) => q.kind === "eyeIcicle" && q.warn > 0 && Math.abs(q.x - r.you.x) < 2.5)) return;
    const x = r.you.x - (r.you.face || 1) * 9;
    standAt(r, x > r.spec.arena + 3 && x < r.spec.length - 3 ? x : r.you.x + (r.you.face || 1) * 15);
  },
};
DODGE.note = DODGE.hop;
DODGE.hoop = DODGE.hop;
DODGE.mud = DODGE.hop;

const CAUSE = { hop: "eyeRipple", skull: "eyeSkull", creep: "eyeShade", scythe: "eyeScythe", note: "eyeNote", dash: "eyeShade", leap: ["eyePounce", "eyeShade"], knock: "eyeRock", hoop: "eyeHoop", icicles: "eyeIcicle", mud: "eyeMud" };

test("Ghoul Rush's dollhouse: each keeper's shade telegraphs its move before it can hurt, hurts standing YOU with its own cause, and is dodged", () => {
  for (const st of ghoul.STAGES) {
    const of = st.boss;
    const move = ey.SHADE_MOVES[of];
    const near = move === "scythe" ? 7 : move === "dash" || move === "leap" || move === "creep" ? 12 : 16;
    const hit = eyeFight();
    standAt(hit, 70);
    const m = shadeAt(hit, of, 70 + near);
    // The angel comes on only while YOU look away.
    if (move === "creep") hit.you.face = -1;
    const losses = [];
    let told = Infinity;
    for (let t = 0; t < 6000 && !losses.length; t += 4) {
      ghoul.advance(hit, 4, steady);
      if (events(hit, "eyeShadeWind").length && told === Infinity) told = t;
      losses.push(...events(hit, "lose").map((e) => [e.cause, t]));
      hit.events.length = 0;
    }
    assert.equal(losses.length, 1, `${of} (${move}): it hurts`);
    assert.ok([CAUSE[move]].flat().includes(losses[0][0]), `${of} (${move}): as ${CAUSE[move]} (${losses[0][0]})`);
    if (move !== "creep") assert.ok(losses[0][1] - told >= 600, `${of} (${move}): telegraphed well before (${losses[0][1] - told} ms)`);
    const safe = eyeFight();
    standAt(safe, 70);
    const s = shadeAt(safe, of, 70 + near);
    const lost = [];
    for (let t = 0; t < 6000; t += 4) {
      safe.input.down = false;
      DODGE[move](safe, s);
      ghoul.advance(safe, 4, steady);
      lost.push(...events(safe, "lose").map((e) => e.cause));
      safe.events.length = 0;
    }
    assert.deepEqual(lost, [], `${of} (${move}): dodged`);
    assert.ok(m.hp > 0, "its hp");
  }
});

test("Ghoul Rush's dollhouse: a shade takes bolts and dies for points, and endless lives spare every hit", () => {
  const round = eyeFight();
  standAt(round, 60);
  const m = shadeAt(round, "gourd", 75);
  m.wait = 1e9;
  const score = round.score;
  run(round, 2000, { fire: true });
  assert.ok(!round.monsters.includes(m), "shot down");
  assert.ok(events(round, "kill").some((e) => e.kind === "eyeShade"));
  assert.ok(round.score > score);
  const r = eyeFight();
  r.infinite = true;
  standAt(r, 70);
  shadeAt(r, "keeper", 77);
  const lives = r.lives;
  run(r, 3000);
  assert.ok(events(r, "lose").length >= 1, "hit");
  assert.equal(r.lives, lives, "no life spent");
});

/* --------------------------------------------------------------- the lurch */

test("Ghoul Rush's dollhouse: the house creaks before it lurches, slides YOU while YOU stand (never in the air) and stops YOU at its end walls; a dresser comes down YOUR floor: jump it, or shoot it apart", () => {
  const round = eyeFight();
  const b = round.boss;
  standAt(round, 70);
  round.you.safeMs = 1e9;
  Object.assign(b.lurch, { ms: 0 });
  b.planLurch = 1;
  run(round, 8);
  assert.equal(events(round, "eyeCreak").length, 1, "a creak first");
  assert.equal(round.you.x, 70, "nothing slides yet");
  const dresser = round.hazards.find((h) => h.kind === "eyeDresser");
  assert.ok(dresser && dresser.y === round.you.y && dresser.x < round.you.x, "a dresser uphill on YOUR floor");
  run(round, ey.EYE_CREAK_MS);
  assert.equal(events(round, "eyeLurch").length, 1);
  const x = round.you.x;
  run(round, 500);
  assert.ok(round.you.x > x + 4, `slid (${(round.you.x - x).toFixed(1)})`);
  standAt(round, round.spec.length - 2);
  run(round, 800);
  assert.ok(round.you.x <= round.spec.length - ey.WALL_PAD + 0.01, "held at the end wall");
  // In the air, nothing pushes.
  const air = eyeFight();
  Object.assign(air.boss.lurch, { state: "go", ms: 1e9, dir: 1 });
  standAt(air, 70);
  Object.assign(air.you, { state: "air", vy: 0, y: 30, shelf: -1 });
  const ax = air.you.x;
  ghoul.advance(air, 4, steady);
  assert.equal(air.you.x, ax);
  // The dresser: it costs a life, a jump clears it, three bolts break it.
  const go = () => {
    const r = eyeFight();
    standAt(r, 64);
    r.boss.lurch.ms = 0;
    r.boss.planLurch = 1;
    run(r, 8);
    return r;
  };
  const hit = go();
  let lost = [];
  for (let t = 0; t < 5000 && !lost.length; t += 4) {
    ghoul.advance(hit, 4, steady);
    lost = events(hit, "lose").map((e) => e.cause);
    hit.events.length = 0;
  }
  assert.deepEqual(lost, ["eyeDresser"]);
  const jump = go();
  for (let t = 0; t < 5000; t += 4) {
    const d = jump.hazards.find((h) => h.kind === "eyeDresser" && h.live > 0);
    if (d && jump.you.x - d.x < 8 && jump.you.x > d.x) jumpUp(jump);
    ghoul.advance(jump, 4, steady);
    assert.deepEqual(events(jump, "lose"), [], "jumped");
    jump.events.length = 0;
  }
  const shoot = go();
  shoot.you.face = -1;
  run(shoot, 2500, { fire: true });
  assert.equal(events(shoot, "eyeDresserSmash").length, 1, "shot apart");
  assert.deepEqual(events(shoot, "lose"), []);
});

/* ---------------------------------------------------------------- the kill */

test("Ghoul Rush's dollhouse: the last bolt in the Eye is a boss kill; its retreat plays once and in order; the door is kept from YOU until it has gone, then leads on", () => {
  const round = eyeFight();
  const b = round.boss;
  b.hp = 1;
  openIn(round, 1);
  standAt(round, ey.roomBox(round.spec, 1).cx - 12);
  const lives = round.lives;
  run(round, 400, { fire: true });
  assert.equal(b.state, "down");
  assert.equal(round.lives, lives + 1, "a life, as every boss gives");
  assert.equal(round.hasKey, true);
  const order = [];
  for (let t = 0; t < ey.GONE_AT + 1500 && round.phase !== "clear"; t += 4) {
    standAt(round, round.spec.door);
    round.input.right = true;
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (e.type.startsWith("eye")) order.push([e.type, Math.round(b.t)]);
    round.events.length = 0;
    if (!b.gone) assert.ok(round.you.x <= round.spec.door - ey.DOOR_KEEP + 0.2, "no door until it has gone");
  }
  assert.deepEqual(order.map(([t]) => t), ["eyeBurst", "eyePeel", "eyeCrack", "eyeCrack", "eyeCrack", "eyeGasp", "eyeSink", "eyeGone"]);
  assert.ok(order[1][1] >= ey.PEEL_AT && order.at(-1)[1] >= ey.GONE_AT, "on the retreat's clock");
  assert.equal(b.gone, true);
  assert.equal(round.phase, "clear", "down its stairway of bones");
  const next = ghoul.FINALE.rooms[ghoul.FINALE.rooms.indexOf("dollhouse") + 1];
  run(round, ghoul.CLEAR_MS + 50);
  if (next) assert.equal(round.spec.id, next, "on to the next room");
  else assert.equal(round.won, true, "or the win while it is the last");
});

/* --------------------------------------------------------------- the fight */

// A steady player: when a lamp flares it goes to that room's floor (CLIMB_MS a floor, firing nothing
// on the way: the bot is put there after), stands a way off the Eye facing it and fires while it is
// open; jumps what runs along its floor, the dresser, a dashing shade; ducks a skull; steps out from
// under a rock, an icicle or a beast's mark; and shoots what shade is on its floor while the Eye is shut.
const CLIMB_MS = 1500;
function fight(seed, skilled = true) {
  const round = eyeFight();
  const random = seededRandom(seed);
  Object.assign(round.boss.eye, { state: "shut", ms: 600 });
  round.boss.lurch.ms = ey.EYE_LURCH_FIRST_MS;
  round.boss.shadeMs = ey.SHADE_FIRST_DOOR_MS;
  let at = 0;
  let travel = 0;
  let t = 0;
  const causes = [];
  const spec = round.spec;
  for (; t < 300000 && round.boss.state !== "down" && !round.over; t += 4) {
    const you = round.you;
    const inp = round.input;
    const b = round.boss;
    inp.left = inp.right = inp.fire = inp.down = false;
    if (round.phase === "ask") ghoul.answerDie(round, false);
    if (skilled && round.phase === "play" && you.out <= 0 && you.state === "run") {
      const row = ey.rowOf(you.y);
      const level = (h) => Math.abs(h.y - ey.EYE_FLOORS[row]) < 0.5;
      const runner = round.hazards.find((h) => (floorThings.has(h.kind) || h.kind === "eyeDresser") && h.live > 0 && level(h) && Math.abs(h.x - you.x) < 3 + (h.speed || ey.DRESSER_SPEED) * 0.13 && Math.sign(you.x - h.x) === (h.dir || 1));
      const scythe = round.hazards.find((h) => h.kind === "eyeScythe" && level(h) && h.warn > 0 && h.warn < 100 && Math.abs(h.x - you.x) < h.w / 2 + 2);
      const dasher = round.monsters.find((m) => m.kind === "eyeShade" && m.going && m.move === "dash" && Math.abs(m.floor - you.y) < 0.5 && Math.abs(m.x - you.x) < 7);
      const skull = round.hazards.find((h) => h.kind === "eyeSkull" && Math.abs(h.y - ey.SKULL_UP - you.y) < 0.5 && Math.abs(h.x - you.x) < 6);
      const above = round.hazards.find((h) => (h.kind === "eyeRock" || h.kind === "eyeIcicle") && h.warn > 0 && Math.abs(h.floor - you.y) < 0.5 && Math.abs(h.x - you.x) < 3);
      const mark = round.monsters.find((m) => m.kind === "eyeShade" && m.move === "leap" && (m.act === "wind" || m.going) && Math.abs(m.floor - you.y) < 0.5 && Math.abs(m.tx - you.x) < 4);
      const e = b.eye;
      if (runner || scythe || dasher) jumpUp(round);
      else if (skull) inp.down = true;
      else if (above || mark) {
        const from = above ? above.x : mark.tx;
        const dir = from >= you.x ? -1 : 1;
        inp[you.x + dir * 4 < spec.arena + 2 || you.x + dir * 4 > spec.length - 2 ? (dir < 0 ? "right" : "left") : dir < 0 ? "left" : "right"] = true;
      } else if (travel > 0) travel -= 4;
      else if (e && e.room >= 0 && e.state !== "shut") {
        const r = ey.roomBox(spec, e.room);
        if (r.row !== at) {
          travel = CLIMB_MS * Math.abs(r.row - at);
          at = r.row;
        } else {
          const side = r.cx - 13 > spec.arena + 2 ? -1 : 1;
          const x = r.cx + side * 13;
          if (row !== r.row || Math.abs(you.x - x) > 5) standAt(round, x, r.row);
          you.face = -side;
          inp.fire = e.state === "open";
        }
      } else {
        const m = round.monsters.find((q) => q.kind === "eyeShade" && ghoul.solid(q) && Math.abs(q.floor - you.y) < 0.5 && Math.abs(q.x - you.x) < 40);
        if (m) {
          you.face = Math.sign(m.x - you.x) || you.face;
          inp.fire = true;
        }
      }
    }
    ghoul.advance(round, 4, random);
    causes.push(...events(round, "lose").map((e) => e.cause));
    round.events.length = 0;
  }
  return { won: round.boss.state === "down", secs: t / 1000, causes, round };
}

test("Ghoul Rush's dollhouse takes a steady player a real fight at full depth: 60 to 120 seconds on most seeds, with lives to spare; a player who stands still dies", () => {
  const times = [];
  const lives = [];
  let good = 0;
  for (const seed of [3, 7, 19, 41]) {
    const f = fight(seed);
    assert.ok(f.won, `seed ${seed}: it fell (${f.causes}; ${f.secs.toFixed(1)} s, hp ${f.round.boss.hp})`);
    assert.ok(f.round.lives > 0, `seed ${seed}: lives to spare (${f.causes})`);
    for (const c of f.causes) assert.ok(LOSE_WORDS[c] || ghoul.MONSTERS[c], `${c} is the House's or one of the dead`);
    if (process.env.EYE_DEBUG) console.log(`seed ${seed}: ${f.won ? "won" : "lost"} in ${f.secs.toFixed(1)} s, lives ${f.round.lives}, ${f.causes}`);
    if (f.secs >= 60 && f.secs <= 120) good++;
    times.push(f.secs);
    lives.push(f.round.lives);
  }
  assert.ok(good >= 3, `most seeds in 60 to 120 s (${times.map((x) => x.toFixed(1))}; lives ${lives})`);
  const idle = fight(7, false);
  assert.equal(idle.won, false);
  assert.ok(idle.round.over, `game over (${idle.causes})`);
  assert.equal(idle.round.boss.hp, idle.round.boss.max, "and not a scratch on it");
});

/* ------------------------------------------------- voices, words, drawing */

const heard = (e) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6, splats: [] }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, markFurthest: noop };
  react(e, kit);
  return played;
};

test("Ghoul Rush's Eye: a voice for every act in tones.js, every event plays its own sound once, and every cause has words and a sound", () => {
  const known = new Set(toneNames());
  for (const kind of ["marroweye", "eyeShade"]) for (const [act, name] of Object.entries(VOICES[kind])) assert.ok(known.has(name), `${kind} ${act}: ${name} is a tone`);
  const eye = { marroweye: { eyeFlare: "flare", eyeFlareStep: "flareStep", eyeOpen: "open", eyeShut: "shut", eyeDud: "dud", eyeDoor: "door", eyeCreak: "creak", eyeCreakStep: "creakStep", eyeLurch: "lurch", eyeDresserCrash: "crash", eyeDresserSmash: "smash", eyeBurst: "burst", eyePeel: "peel", eyeCrack: "crack", eyeGasp: "gasp", eyeSink: "sink", eyeGone: "gone", bossWake: "wake", bossHit: "hurt", bossDown: "die" }, eyeShade: { eyeShadeIn: "come", eyeShadeOut: "fade", eyeShadeWind: "wind", eyeShadeSlam: "slam", eyeSkullThrow: "throw", eyeShadeGrind: "grind", eyeScythe: "scythe", eyeNote: "note", eyeShadeDash: "dash", eyeShadeLeap: "leap", eyePounce: "pounce", eyeKnock: "knock", eyeRockLand: "rock", eyeHoop: "hoop", eyeIcicleLand: "icicle", eyeMud: "mud", hit: "hurt", kill: "die" } };
  for (const [kind, cases] of Object.entries(eye)) {
    for (const [type, act] of Object.entries(cases)) {
      const played = heard({ type, kind, x: 80, y: 20, xs: [70], ty: 20, tx: 70, at: 70, n: 1, dir: 1, move: "hop", how: "eye", points: 1, mult: 1, life: true });
      assert.equal(played.filter((n) => n === VOICES[kind][act]).length, 1, `${type}: ${VOICES[kind][act]} once`);
    }
  }
  // Every event the rules push is one of those.
  const pushed = new Set();
  const round = eyeFight();
  round.you.safeMs = 1e9;
  round.boss.hp = Math.floor(round.boss.max * 0.3);
  Object.assign(round.boss.eye, { state: "shut", ms: 1 });
  round.boss.lurch.ms = 0;
  round.boss.shadeMs = 0;
  const random = seededRandom(9);
  for (let t = 0; t < 60000; t += 4) {
    round.you.safeMs = 1e9;
    ghoul.advance(round, 4, random);
    for (const e of round.events) if (e.type.startsWith("eye")) pushed.add(e.type);
    round.events.length = 0;
  }
  const all = new Set([...Object.keys(eye.marroweye), ...Object.keys(eye.eyeShade), "eyeSkullTurn"]);
  for (const type of pushed) assert.ok(all.has(type), `${type} has a reaction`);
  for (const cause of ["marroweye", "eyeShade", "eyeRipple", "eyeSkull", "eyeScythe", "eyeNote", "eyePounce", "eyeRock", "eyeHoop", "eyeIcicle", "eyeMud", "eyeDresser"]) {
    assert.ok(LOSE_WORDS[cause], `${cause}: words`);
    assert.ok(known.has(LOSE_SOUNDS[cause][0]), `${cause}: a sound`);
  }
});

test("Ghoul Rush's dollhouse draws: the landing, the fight with the Eye in every state, every keeper's shade and move, the lurch, every beat of the retreat, lit and dark, and its card with the card's fake view", () => {
  const { canvas, calls, ctx } = stubCanvas();
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) g.key("down");
  for (let i = 0; i < ghoul.FINALE.rooms.indexOf("dollhouse"); i++) g.key("right");
  g.key("action");
  for (let n = 0; n < 2 && g.round.phase !== "ready"; n++) {
    for (let ms = 0; ms < ghoul.INTRO_MIN_MS + 50; ms += 16) g.tick(16);
    g.key("action");
  }
  const r = g.round;
  assert.equal(r.spec.id, "dollhouse");
  r.infinite = true;
  const frame = (label) => {
    const before = calls.count;
    g.tick(16);
    assert.ok(calls.count > before, `${label} draws`);
  };
  for (const dark of [false, true]) {
    r.dark = dark;
    standAt(r, 10);
    frame("the landing");
    standAt(r, r.spec.arena + 14);
    // The House's intro runs a seed-dependent while: tick until its Eye exists, not a fixed time.
    for (let ms = 0; ms < 1600 || (!r.boss.eye && ms < 20000); ms += 16) g.tick(16);
    for (const [state, decoy] of [["flare", -1], ["flare", 6], ["open", -1], ["closing", -1], ["shut", -1]]) {
      Object.assign(r.boss.eye, { state, ms: 300, full: 1000, room: 4, decoy });
      frame(`the Eye ${state}`);
    }
    for (const st of ghoul.STAGES) {
      Object.assign(r, { phase: "play" });
      Object.assign(r.you, { out: 0, safeMs: 1e9 });
      shadeAt(r, st.boss, 90, 1);
      for (let ms = 0; ms < 1500; ms += 16) frame(`${st.boss}'s shade`);
      r.monsters.length = 0;
      r.hazards.length = 0;
    }
    Object.assign(r.boss.lurch, { state: "creak", ms: 300 });
    r.boss.planLurch = 1;
    for (let ms = 0; ms < 2000; ms += 16) frame("the lurch");
    for (const t of [100, ey.PEEL_AT + 300, ey.CRACK_AT[2] + 100, ey.GASP_AT + 200, ey.SINK_AT + 900, ey.GONE_AT + 100]) {
      Object.assign(r.boss, { state: "down", t, gone: t >= ey.GONE_AT });
      frame(`the retreat at ${t}`);
    }
    Object.assign(r.boss, { state: "fight", t: 0, gone: false });
  }
  // The card draws the boss with its own fake view: no round, no spec, FIELD_H 0.
  const before = calls.count;
  g.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) g.key("down");
  for (let i = 0; i < ghoul.FINALE.rooms.indexOf("dollhouse"); i++) g.key("right");
  g.key("action");
  assert.equal(g.round.phase, "bossintro");
  for (let ms = 0; ms < 3000; ms += 100) {
    g.round.introMs = ms;
    g.tick(1);
  }
  assert.ok(calls.count > before, "the card draws");
});

test("Ghoul Rush's Eye draws on its card through its own art with the card's fake view, and every shade through its keeper's", async () => {
  const { eyeArt } = await import("../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow-eye-draw.js");
  const { ctx } = stubCanvas();
  const noop = () => {};
  let borrowed = 0;
  const art = eyeArt({ ellipse: noop, circle: noop, roundRect: noop, line: noop, rotate: noop, eye: noop, hash: (a, b) => Math.abs(a * 31 + b) % 997, say: noop, gate: () => true, label: noop, bossArt: () => () => borrowed++, DANGER: "#f00", GOLD: "#fc0" });
  const v = { g: { FIELD_H: 0 }, clock: 1000, spec: null, groundAt: () => 0, eyes: [] };
  const b = { kind: "marroweye", x: 0, y: 0, w: 30, h: 30, hurt: 0, dir: -1, state: "fight", t: 0, hp: 1, max: 1 };
  assert.doesNotThrow(() => art.bosses.marroweye(ctx, v, b));
  const game = { g: { FIELD_H: 54 }, clock: 1000, spec: ghoul.roomFor("dollhouse"), round: {}, bosses: ghoul.BOSSES, eyes: [] };
  for (const st of ghoul.STAGES) art.monsters.eyeShade(ctx, game, { of: st.boss, act: "idle", wait: 0, dir: 1, move: ey.SHADE_MOVES[st.boss], floor: 6, y: 6 }, 60, 48, 0, false);
  assert.equal(borrowed, ghoul.STAGES.length, "each shade drawn through its keeper's art");
});
