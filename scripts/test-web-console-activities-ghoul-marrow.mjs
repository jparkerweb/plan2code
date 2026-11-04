// Web console tests, Ghoul Rush's finale: the win condition (RUN_STAGES stages, then the House
// with no offer, its record one past every stage), the words that count the stages, and Kill I,
// The Lawn: the windows (hit from the surface that serves each row, passed while shuttered, out
// for good across a life lost), the rows opening, each move's telegraph, hit and dodge, the
// weighted pick, the wall in front of the house, the retreat in order and its standing door, a
// bot's fight length, the voices, words and drawing.
// Run with: node --test scripts/test-web-console-activities-ghoul-marrow.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as mw from "../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow.js";
import { LOSE_SOUNDS, LOSE_WORDS, VOICES } from "../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow-draw.js";
import { react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { bossIntroFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-boss-intros.js";
import { introFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-intros.js";
import { skipStory } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-story.js";
import { skipEnding } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-ending.js";
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
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, calls };
}

function textCanvas() {
  const texts = [];
  const ctx = new Proxy({}, {
    get: (target, name) => (name === "fillText" ? (text) => texts.push([String(text)]) : name in target ? target[name] : () => {}),
    set: (target, name, value) => { target[name] = value; return true; },
  });
  return { canvas: { width: 0, height: 0, getContext: () => ctx }, texts };
}

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// Through the rest of the House, room by room (each card passed), then past the ending's pages: the win.
function finishHouse(round, g = null) {
  for (let n = 0; n < 20 && !round.over; n++) {
    if (round.phase === "ending") skipEnding(round);
    else {
      if (round.phase === "intro" || round.phase === "bossintro") skipCard(round);
      if (round.phase === "intro" || round.phase === "bossintro") skipCard(round);
      through(round);
    }
    if (g) g.tick(16);
  }
}

function skipCard(round) {
  round.introMs = ghoul.INTRO_MIN_MS;
  return ghoul.takeIntro(round);
}

function standAt(round, x, shelf = -1) {
  const y = shelf >= 0 ? round.spec.shelves[shelf][2] : ghoul.groundAt(round.spec, x);
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, cuttable: false, out: 0, safeMs: 0, face: 1 });
}

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

// A run's way to the House: out of the hall, `depth` stages already behind it, into the
// finale (its stage card and the boss's passed), nothing else woken.
function lawnRound(depth = ghoul.RUN_STAGES) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  through(round);
  round.cleared = ghoul.STAGES.slice(0, depth).map((st) => st.id);
  round.offer = null;
  through(round);
  assert.equal(round.spec.id, "lawn");
  skipCard(round);
  skipCard(round);
  round.phase = "play";
  for (const st of round.spawns) st.over = true;
  round.monsters.length = 0;
  round.hordeMs = Infinity;
  round.items.fill(true);
  round.candy.fill(true);
  round.events.length = 0;
  return round;
}

// Nothing moves: no window lit, the next move a long way off.
function calm(round) {
  const b = round.boss;
  for (const w of round.marrow.windows) if (w.state === "lit") w.state = "dark";
  Object.assign(b, { act: "idle", wait: 1e9, litMs: 1e9, relight: 0 });
  round.hazards.length = 0;
  round.waves.length = 0;
  round.monsters.length = 0;
}

// The fight under way: in the arena, the boss awake and idle a long while, no window lit.
function lawnFight(depth = ghoul.RUN_STAGES) {
  const round = lawnRound(depth);
  standAt(round, 130);
  run(round, ghoul.BOSS_INTRO_MS + 100);
  assert.equal(round.boss.state, "fight");
  calm(round);
  round.events.length = 0;
  return round;
}

// Where each row is shot from: [x, shelf index or -1 for the floor].
const SERVES = Object.freeze({ 0: [160, -1], 1: [145, 2], 2: [145, 5], 3: [162, 6] });

function lightOnly(round, id) {
  for (const w of round.marrow.windows) if (w.state !== "out") w.state = w.id === id ? "lit" : "dark";
}

/* ------------------------------------------------------- the win condition */

test("Ghoul Rush's finale: a run offers RUN_STAGES picks of stages that never repeat, then goes to the House with no offer, its card and the boss's first; clearing it wins", () => {
  const round = ghoul.newRound(9);
  round.dice = 0;
  through(round);
  let picks = 0;
  while (round.phase === "pick") {
    picks++;
    round.phaseMs = 0;
    ghoul.pickStage(round);
    for (let k = 0, n = ghoul.stageById(round.stage).rooms.length; k < n; k++) through(round);
  }
  assert.equal(picks, ghoul.RUN_STAGES, "six picks");
  assert.equal(new Set(round.cleared).size, ghoul.RUN_STAGES, "no stage twice");
  assert.equal(events(round, "offer").length, ghoul.RUN_STAGES, "no offer for the House");
  assert.deepEqual([round.stage, round.spec.id, round.phase], [ghoul.FINALE.id, "lawn", "intro"], "the sixth clear opens the House's card");
  assert.deepEqual(events(round, "stage").at(-1), { type: "stage", stage: "marrow", n: ghoul.RUN_STAGES, of: ghoul.RUN_STAGES });
  assert.ok(events(round, "stageClear").every((e) => e.of === ghoul.RUN_STAGES));
  assert.ok(introFor("marrow") && bossIntroFor("marrow"), "both cards exist");
  assert.equal(skipCard(round), true);
  assert.equal(round.phase, "bossintro", "then the boss's card");
  assert.equal(skipCard(round), true);
  assert.equal(round.phase, "ready");
  assert.equal(round.spec.depth, ghoul.RUN_STAGES, "played at full depth");
  finishHouse(round);
  assert.equal(round.won, true);
  assert.deepEqual(events(round, "won").map((e) => e.n), [ghoul.RUN_STAGES + 1]);
});

test("Ghoul Rush's finale is never offered, and the stage select lists it last, played at depth 0", () => {
  assert.ok(!ghoul.STAGES.includes(ghoul.FINALE));
  assert.equal(ghoul.SELECTABLE.at(-1), ghoul.FINALE);
  assert.equal(ghoul.stageById("marrow"), ghoul.FINALE);
  assert.equal(ghoul.FINALE.rooms[0], "lawn");
  assert.equal(ghoul.roomById("lawn").boss, "marrow");
  for (let seed = 1; seed < 30; seed++) {
    const r = ghoul.newRound(seed);
    r.dice = 0;
    through(r);
    assert.ok(!r.offer.includes("marrow"));
  }
  const g = ghoul.default.create({ canvas: stubCanvas().canvas });
  g.resize(900, 900);
  g.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length + 2; i++) g.key("down");
  assert.equal(g.round.select.at, ghoul.SELECTABLE.length - 1);
  g.key("action");
  assert.deepEqual([g.round.stage, g.round.spec.id, g.round.phase], ["marrow", "lawn", "intro"]);
  assert.equal(g.round.spec.depth, 0, "practice plays it at depth 0");
});

test("Ghoul Rush's record: the memo counts stages up to RUN_STAGES, goes one past only on a win, never from practice, and the words count RUN_STAGES whatever STAGES holds", () => {
  const { canvas, texts } = textCanvas();
  let saved = 0;
  const g = ghoul.default.create({ canvas, memo: { get: () => saved, set: (n) => (saved = n) } });
  g.resize(900, 900);
  assert.ok(ghoul.STAGES.length !== ghoul.RUN_STAGES, "the pool is bigger than a run");
  assert.ok(texts.some(([t]) => t === `Run. Shoot. Clear ${ghoul.RUN_STAGES} stages, then kill the house`));
  assert.ok(texts.some(([t]) => t.includes(`Best: 0 of ${ghoul.RUN_STAGES} stages`)));
  g.key("action");
  if (g.round.phase === "story") {
    skipStory(g.round);
    g.tick(0);
  }
  const r = g.round;
  r.dice = 0;
  const last = ghoul.STAGES[ghoul.RUN_STAGES - 1];
  r.cleared = ghoul.STAGES.slice(0, ghoul.RUN_STAGES - 1).map((s) => s.id);
  r.stage = last.id;
  r.stageAt = last.rooms.length - 1;
  through(r);
  g.tick(16);
  assert.equal(saved, ghoul.RUN_STAGES, "every stage, not yet the House");
  assert.equal(g.hud.stage, "THE HOUSE: KILL 1 OF 3");
  finishHouse(r, g);
  g.tick(16);
  assert.equal(g.state, "over");
  assert.equal(saved, ghoul.RUN_STAGES + 1, "the House beaten");
  texts.length = 0;
  g.resize(900, 900);
  assert.ok(texts.some(([t]) => t.startsWith("You escaped! Marrow starves")));
  // A memo from before reads as beaten, and the start screen says so.
  const again = textCanvas();
  const g2 = ghoul.default.create({ canvas: again.canvas, memo: { get: () => 11, set: () => {} } });
  g2.resize(900, 900);
  assert.ok(again.texts.some(([t]) => t.includes("You have killed the House")));
  // Practice never writes it.
  let p = 0;
  const g3 = ghoul.default.create({ canvas: stubCanvas().canvas, memo: { get: () => p, set: (n) => (p = n) } });
  g3.resize(900, 900);
  g3.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) g3.key("down");
  g3.key("action");
  finishHouse(g3.round, g3);
  g3.tick(16);
  assert.equal(g3.round.won, true);
  assert.equal(p, 0, "practice keeps nothing");
});

/* --------------------------------------------------------------- the lawn */

test("Ghoul Rush's lawn: the house fills the arena's right, YOU are kept off it, its box is out of reach and always guarded, and its hp is its windows' sum", () => {
  const round = lawnFight();
  const b = round.boss;
  const spec = round.spec;
  assert.equal(ghoul.roomById("lawn").boss, "marrow");
  assert.equal(mw.houseLeft(spec), 172);
  assert.ok(b.x > mw.houseLeft(spec) + mw.HOUSE_W, "its box past the house's far wall");
  assert.equal(ghoul.guarded(b), true);
  const share = Math.ceil(spec.bossHp / mw.WINDOWS.length);
  assert.equal(b.max, share * mw.WINDOWS.length);
  assert.equal(b.hp, round.marrow.windows.reduce((s, w) => s + w.hp, 0));
  standAt(round, 160);
  run(round, 1500, { right: true });
  assert.ok(round.you.x <= mw.houseLeft(spec) - mw.WALL_GAP + 0.5, `held off the house (${round.you.x.toFixed(2)})`);
});

test("Ghoul Rush's lawn: every window can be shot from the surface that serves its row; a shuttered one lets the bolts by", () => {
  mw.WINDOWS.forEach(([row, dx], id) => {
    const round = lawnFight();
    const win = round.marrow.windows[id];
    const [x, shelf] = SERVES[row];
    standAt(round, x, shelf);
    const full = win.hp;
    run(round, 1200, { fire: true });
    assert.equal(win.hp, full, `window ${id}: shuttered, untouched`);
    lightOnly(round, id);
    round.heat = 0;
    round.events.length = 0;
    run(round, 800, { fire: true });
    assert.ok(win.hp < full, `window ${id} (row ${row}): hit from ${shelf < 0 ? "the floor" : `shelf ${shelf}`}`);
    assert.equal(round.boss.hp, round.marrow.windows.reduce((s, q) => s + q.hp, 0), "hp is the windows' sum");
    assert.ok(events(round, "bossHit").every((e) => e.how === "window" && Math.abs(e.x - (mw.houseCenter(round.spec) + dx)) < 0.01), "the hit shows at the window");
  });
});

test("Ghoul Rush's lawn: a window shot out stays out across a life lost, and lit windows come only from the rows open by how many are out", () => {
  assert.deepEqual([0, 3, 4, 7, 8, 12].map(mw.rowsOpen), [1, 1, 2, 2, 3, 3]);
  const round = lawnFight();
  const b = round.boss;
  const win = round.marrow.windows[0];
  b.hp -= win.hp - 1;
  win.hp = 1;
  lightOnly(round, 0);
  standAt(round, 160);
  run(round, 400, { fire: true });
  assert.equal(win.state, "out");
  assert.deepEqual(events(round, "marrowWindowOut").map((e) => e.left), [mw.WINDOWS.length - 1]);
  const hp = round.boss.hp;
  round.lives = 5;
  ghoul.lose(round, "marrowShingle");
  run(round, ghoul.CRASH_MS + ghoul.READY_MS + 100);
  assert.notEqual(round.boss, b, "a new boss object after the life lost");
  assert.equal(round.marrow.windows[0].state, "out", "still out");
  assert.equal(round.boss.hp, hp, "the same hp");
  const r2 = lawnFight();
  const random = seededRandom(4);
  r2.boss.litMs = 0;
  for (let t = 0; t < 60000; t += 4) {
    r2.you.safeMs = 1e9;
    r2.boss.wait = 1e9;
    ghoul.advance(r2, 4, random);
    const out = r2.marrow.windows.filter((w) => w.state === "out").length;
    for (const w of r2.marrow.windows) if (w.state === "lit") assert.ok(w.row <= mw.rowsOpen(out), `row ${w.row} lit with ${out} out`);
    // Shoot one out now and then, so every row gets its turn.
    if (t % 2000 === 0 && out < mw.WINDOWS.length - 1) {
      const lit = r2.marrow.windows.find((w) => w.state === "lit");
      if (lit) {
        r2.boss.hp -= lit.hp;
        Object.assign(lit, { hp: 0, state: "out" });
        r2.boss.relight = mw.RELIGHT_MS;
      }
    }
    r2.events.length = 0;
  }
  assert.ok(r2.marrow.windows.filter((w) => w.state === "out").length >= 9, "the fight reached the eyes");
});

test("Ghoul Rush's lawn: the pick opens on the carpet, never one move three times running, the slow moves sit out their cooldown, the doormen only under their cap, and each phase's moves only", () => {
  const random = seededRandom(11);
  for (const phase of [0, 1, 2]) {
    const b = {};
    const picks = [];
    for (let i = 0; i < 400; i++) picks.push(mw.pickMove(b, phase, random, 0));
    assert.equal(picks[0], "carpet");
    for (let i = 2; i < picks.length; i++) assert.ok(!(picks[i] === picks[i - 1] && picks[i] === picks[i - 2]), `phase ${phase}: never three running`);
    for (const [move, n] of Object.entries(mw.COOLDOWN)) {
      const at = picks.flatMap((p, i) => (p === move ? [i] : []));
      for (let i = 1; i < at.length; i++) assert.ok(at[i] - at[i - 1] > n, `phase ${phase}: ${move} sits out ${n}`);
    }
    for (const [move, w] of Object.entries(mw.WEIGHTS)) if (!w[phase]) assert.ok(!picks.includes(move), `phase ${phase}: no ${move}`);
    assert.ok(new Set(picks).size >= [3, 5, 6][phase], `phase ${phase}: varied (${[...new Set(picks)]})`);
  }
  const b = { picks: 3 };
  for (let i = 0; i < 100; i++) assert.notEqual(mw.pickMove(b, 1, random, mw.DOORMEN_CAP), "doormen");
  // Up in the oak the lightning and the crows join, and only there; the crows under their cap.
  for (const phase of [0, 1, 2]) {
    const up = {};
    const picks = [];
    for (let i = 0; i < 400; i++) picks.push(mw.pickMove(up, phase, random, 0, true, 0));
    assert.ok(picks.includes("lightning") && picks.includes("crows"), `phase ${phase}: high moves when high`);
    const capped = { picks: 3 };
    for (let i = 0; i < 100; i++) assert.notEqual(mw.pickMove(capped, phase, random, 0, true, mw.CROWS_CAP), "crows");
  }
  const round = lawnFight();
  standAt(round, 160);
  assert.equal(mw.isHigh(round), false, "the lawn is not high");
  standAt(round, 143, 2);
  assert.equal(mw.isHigh(round), true, "a branch is");
});

test("Ghoul Rush's lawn: up in the oak, lightning glows on YOUR branch before it strikes (a life, struck down), and a step along it or a drop dodges it; from the second phase a second bolt waits ahead", () => {
  const go = (outs) => {
    const round = lawnFight();
    for (const w of round.marrow.windows.slice(0, outs)) {
      round.boss.hp -= w.hp;
      Object.assign(w, { hp: 0, state: "out" });
    }
    standAt(round, 141, 2);
    Object.assign(round.boss, { plan: "lightning", wait: 0, picks: 1 });
    run(round, 4);
    return round;
  };
  const hit = go(0);
  assert.equal(events(hit, "marrowStorm").length, 1, "the storm gathers first");
  const bolts = hit.hazards.filter((h) => h.kind === "marrowBolt");
  assert.deepEqual(bolts.map((h) => [h.x, h.y]), [[141, 18]], "one glow where YOU stand, at YOUR height");
  const losses = [];
  const heard = [];
  for (let t = 0; t < 3000 && !losses.length; t += 4) {
    ghoul.advance(hit, 4, steady);
    losses.push(...events(hit, "lose"));
    for (const e of hit.events) if (e.type === "marrowCharge" || e.type === "marrowStrike") heard.push([e.type, t]);
    if (t < mw.LIGHTNING_WARN_MS) assert.equal(losses.length, 0, "never before its glow has run");
    hit.events.length = 0;
  }
  assert.deepEqual(losses.map((e) => e.cause), ["marrowBolt"]);
  assert.deepEqual(heard.map(([type]) => type), ["marrowCharge", "marrowCharge", "marrowStrike"], "it charges up out loud twice before it strikes");
  assert.ok(heard[0][1] >= 400 && heard[2][1] - heard[1][1] >= 400, "each step well apart");
  for (const dodge of [(r) => standAt(r, 145.5, 2), (r) => standAt(r, 141)]) {
    const safe = go(0);
    dodge(safe);
    const lost = [];
    for (let t = 0; t < 2500; t += 4) {
      ghoul.advance(safe, 4, steady);
      if (safe.boss.act === "idle") safe.boss.wait = 1e9;
      lost.push(...events(safe, "lose"));
      safe.events.length = 0;
    }
    assert.deepEqual(lost, [], "dodged");
  }
  const two = go(4);
  assert.equal(two.hazards.filter((h) => h.kind === "marrowBolt").length, 2, "a second bolt from the second phase");
});

test("Ghoul Rush's lawn: up in the oak, crows burst out of the door's mouth, climb and dive at YOU, never more than CROWS_CAP of its own", () => {
  const round = lawnFight();
  standAt(round, 143, 2);
  round.you.safeMs = 1e9;
  Object.assign(round.boss, { plan: "crows", wait: 0, picks: 1 });
  run(round, 4);
  assert.equal(round.boss.act, "crowsWind");
  run(round, 4);
  assert.equal(round.boss.mouth, true, "the door is open");
  run(round, mw.CROWS_WIND_MS + 40);
  const crows = round.monsters.filter((m) => m.houseCrow);
  assert.equal(crows.length, mw.CROWS_N[0]);
  assert.ok(crows.every((m) => m.kind === "crow" && Math.abs(m.x - mw.houseLeft(round.spec)) < 8), "out of the door");
  assert.equal(events(round, "marrowCrows").length, 1);
  run(round, 900);
  assert.ok(round.monsters.some((m) => m.houseCrow && m.act === "dive"), "a dive at YOU");
  Object.assign(round.boss, { plan: "crows", wait: 0 });
  run(round, mw.CROWS_WIND_MS + 60);
  assert.ok(round.monsters.filter((m) => m.houseCrow && !m.dead).length <= mw.CROWS_CAP);
});

// A move started now, YOU on the floor at `x`, `outs` windows already shot out (for its phase).
function moveRound(move, x = 150, outs = 0) {
  const round = lawnFight();
  for (const w of round.marrow.windows.slice(0, outs)) {
    round.boss.hp -= w.hp;
    Object.assign(w, { hp: 0, state: "out" });
  }
  standAt(round, x);
  Object.assign(round.boss, { plan: move, wait: 0, picks: 1 });
  run(round, 4);
  assert.equal(round.boss.move, move);
  return round;
}

// Steps YOU once out from under the first warning of `kind` that lands where YOU stand.
const stepOut = (kind, dx) => (r) => {
  if (r.stepped) return;
  const h = r.hazards.find((q) => q.kind === kind && q.warn > 0 && Math.abs(q.x - r.you.x) < 3);
  if (!h) return;
  r.stepped = true;
  standAt(r, r.you.x + dx, r.you.shelf);
};

test("Ghoul Rush's lawn: each move telegraphs before it can hurt, hurts standing YOU with its own cause, and is dodged", () => {
  const cases = [
    ["shingles", "marrowRoof", "marrowShingle", 0, (r) => r.stepped || ((r.stepped = true), standAt(r, 146))],
    ["pickets", "marrowPicketWind", "marrowPicket", 0, (r) => r.stepped || ((r.stepped = true), standAt(r, 146))],
    ["carpet", "marrowDoor", "marrowCarpet", 0, (r) => r.stepped || ((r.stepped = true), standAt(r, 143, 2))],
    ["bricks", "marrowCough", "marrowBrick", 4, stepOut("marrowBrick", -6)],
    ["stomp", "marrowRear", "marrowQuake", 8, (r) => { if (!r.climbed) { r.climbed = true; standAt(r, 143, 2); } stepOut("marrowShingle", 4)(r); }],
  ];
  for (const [move, tell, cause, outs, dodge] of cases) {
    const hit = moveRound(move, 150, outs);
    assert.equal(events(hit, tell).length, 1, `${move}: ${tell} first`);
    const losses = [];
    for (let t = 0; t < 4000 && !losses.length; t += 4) {
      ghoul.advance(hit, 4, steady);
      losses.push(...events(hit, "lose"));
      hit.events.length = 0;
      if (t < 300) assert.equal(losses.length, 0, `${move}: never before its warning has run`);
    }
    assert.deepEqual(losses.map((e) => e.cause), [cause], `${move}: costs a life as ${cause}`);
    const safe = moveRound(move, 150, outs);
    const lost = [];
    for (let t = 0; t < 4000; t += 4) {
      dodge(safe);
      ghoul.advance(safe, 4, steady);
      // The move played out, nothing comes after it.
      if (safe.boss.act === "idle") safe.boss.wait = 1e9;
      lost.push(...events(safe, "lose"));
      safe.events.length = 0;
    }
    assert.deepEqual(lost.map((e) => e.cause), [], `${move}: dodged`);
  }
});

test("Ghoul Rush's lawn: the doormen step out of the door, never more than DOORMEN_CAP of its own, and endless lives spare every hit", () => {
  const round = moveRound("doormen", 130, 4);
  round.you.safeMs = 1e9;
  run(round, mw.DOORMEN_WIND_MS + 50);
  assert.equal(round.monsters.filter((m) => m.doorman).length, mw.DOORMEN_N);
  assert.equal(events(round, "marrowDoormen").length, 1);
  Object.assign(round.boss, { plan: "doormen", wait: 0 });
  run(round, mw.DOORMEN_WIND_MS + 60);
  assert.ok(round.monsters.filter((m) => m.doorman && !m.dead).length <= mw.DOORMEN_CAP);
  const r = moveRound("pickets", 150);
  r.infinite = true;
  const lives = r.lives;
  run(r, 2000);
  assert.ok(events(r, "lose").length >= 1, "hit");
  assert.equal(r.lives, lives, "no life spent");
});

test("Ghoul Rush's lawn: the last window out is a boss kill, then the retreat plays its beats once and in order, and only then is the door there to walk through", () => {
  const round = lawnFight();
  const b = round.boss;
  for (const w of round.marrow.windows.slice(1)) Object.assign(w, { hp: 0, state: "out" });
  round.marrow.windows[0].hp = 1;
  b.hp = 1;
  lightOnly(round, 0);
  const lives = round.lives;
  standAt(round, 160);
  run(round, 400, { fire: true });
  assert.equal(b.state, "down");
  assert.equal(round.lives, lives + 1, "a life, as every boss gives");
  assert.equal(round.hasKey, true);
  const order = [];
  for (let t = 0; t < mw.GONE_AT + 1500 && round.phase !== "clear"; t += 4) {
    standAt(round, round.spec.door);
    round.input.right = true;
    ghoul.advance(round, 4, steady);
    for (const e of round.events) if (e.type.startsWith("marrow") && e.type !== "marrowWindowOut") order.push([e.type, Math.round(b.t)]);
    round.events.length = 0;
    if (!b.gone) assert.ok(round.you.x <= mw.houseLeft(round.spec), "no door until it has gone");
  }
  assert.deepEqual(order.map(([t]) => t), ["marrowSag", "marrowFalseWin", "marrowLaugh", "marrowSink", "marrowGone"]);
  assert.ok(order[1][1] >= mw.FALSE_AT && order[4][1] >= mw.GONE_AT, "on the retreat's clock");
  assert.equal(b.gone, true);
  assert.equal(round.phase, "clear", "through the door it left standing");
  run(round, ghoul.CLEAR_MS + 50);
  // On down the House's throat, or (the lawn the finale's only room) the win.
  if (ghoul.FINALE.rooms.length > 1) assert.equal(round.spec.id, ghoul.FINALE.rooms[1], "on to the next of the House's rooms");
  else assert.ok(round.won || round.phase === "ending");
});

/* ------------------------------------------------------------ the fight */

// A steady player: shoots the lowest lit window from the surface serving it (getting there
// takes CLIMB_MS a row, about two branches of the oak, firing nothing on the way: the bot is put there after), jumps the
// carpet and the quake on the floor, and steps out from under a slate, a ripple or a brick.
const CLIMB_MS = 1500;
function fight(seed, skilled = true) {
  const round = lawnFight();
  const random = seededRandom(seed);
  Object.assign(round.boss, { wait: 600, litMs: 0 });
  let at = 0;
  let travel = 0;
  let t = 0;
  const causes = [];
  for (; t < 240000 && round.boss.state !== "down" && !round.over; t += 4) {
    const you = round.you;
    const inp = round.input;
    inp.left = inp.right = inp.fire = false;
    if (round.phase === "ask") ghoul.answerDie(round, false);
    if (skilled && round.phase === "play" && you.out <= 0 && you.state === "run") {
      const lit = round.marrow.windows.filter((w) => w.state === "lit").sort((a, c) => a.row - c.row);
      const threat = round.hazards.find((h) => (h.warn > 0 || h.live > 0) && Math.abs(h.x - you.x) < (h.w + 1.6) / 2 + 0.6 && (h.kind === "marrowShingle" || you.y === h.y));
      const wave = round.waves.find((w) => w.y === you.y && w.x - you.x > 0 && w.x - you.x < 5);
      if (wave) inp.jump = ghoul.JUMP_BUFFER_MS;
      else if (threat) {
        const s = you.shelf >= 0 ? round.spec.shelves[you.shelf] : [mw.houseLeft(round.spec) - 60, mw.houseLeft(round.spec) - 2];
        const dir = threat.x >= you.x ? -1 : 1;
        inp[(dir < 0 ? you.x - 3 > s[0] : you.x + 3 > s[1]) ? "left" : "right"] = true;
      } else if (travel > 0) travel -= 4;
      else if (lit.length) {
        const row = lit[0].row;
        const [x, shelf] = SERVES[row];
        if (row !== at) {
          travel = CLIMB_MS * Math.abs(row - at);
          at = row;
        } else {
          if (you.shelf !== shelf || Math.abs(you.x - x) > 4) standAt(round, x, shelf);
          you.face = 1;
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

test("Ghoul Rush's lawn takes a steady player a real fight at full depth: 60 to 120 seconds on most seeds, with lives to spare; a player who stands still dies", () => {
  const times = [];
  const lives = [];
  let good = 0;
  for (const seed of [3, 7, 19, 41]) {
    const f = fight(seed);
    assert.ok(f.won, `seed ${seed}: it fell (${f.causes}; ${f.secs.toFixed(1)} s, hp ${f.round.boss.hp})`);
    assert.ok(f.round.lives > 0, `seed ${seed}: lives to spare (${f.causes})`);
    for (const c of f.causes) assert.ok(LOSE_WORDS[c] || ghoul.MONSTERS[c], `${c} is the House's or one of the dead`);
    if (f.secs >= 60 && f.secs <= 120) good++;
    times.push(f.secs);
    lives.push(f.round.lives);
  }
  assert.ok(good >= 3, `most seeds in 60 to 120 s (${times.map((x) => x.toFixed(1))}; lives ${lives})`);
  const idle = fight(7, false);
  assert.equal(idle.won, false);
  assert.ok(idle.round.over, `game over (${idle.causes})`);
  assert.equal(idle.round.boss.hp, idle.round.boss.max, "and not a window touched");
});

/* ------------------------------------------------- voices, words, drawing */

const heard = (e) => {
  const played = [];
  const noop = () => {};
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, markFurthest: noop };
  react(e, kit);
  return played;
};

test("Ghoul Rush's House: a voice for every act in tones.js, every event plays its own sound once, and every cause has words and a sound", () => {
  const known = new Set(toneNames());
  for (const [act, name] of Object.entries(VOICES.marrow)) assert.ok(known.has(name), `${act}: ${name} is a tone`);
  const at = { kind: "marrow", x: 190, y: 20, xs: [150], left: 3 };
  const cases = { marrowLight: "light", marrowWindowOut: "windowOut", marrowRoof: "roof", marrowDoor: "door", marrowCarpet: "carpet", marrowPicketWind: "picketWind", marrowPicketUp: "picketUp", marrowShingleLand: "shingle", marrowCough: "cough", marrowBrickLand: "brick", marrowDoormen: "doormen", marrowRear: "rear", marrowStomp: "stomp", marrowSag: "sag", marrowFalseWin: "falseWin", marrowLaugh: "laugh", marrowSink: "sink", marrowGone: "gone", marrowStorm: "storm", marrowCharge: "charge", marrowStrike: "strike", marrowCrows: "crows", bossWake: "wake", bossHit: "hurt", bossDown: "die" };
  for (const [type, act] of Object.entries(cases)) {
    const played = heard({ type, ...at, how: "window", points: 1, life: true });
    assert.equal(played.filter((n) => n === VOICES.marrow[act]).length, 1, `${type}: ${VOICES.marrow[act]} once`);
  }
  for (const cause of ["marrow", "marrowShingle", "marrowCarpet", "marrowPicket", "marrowBrick", "marrowQuake", "marrowBolt"]) {
    assert.ok(LOSE_WORDS[cause], `${cause}: words`);
    assert.ok(known.has(LOSE_SOUNDS[cause][0]), `${cause}: a sound`);
  }
});

test("Ghoul Rush's lawn draws: the run up, the fight with windows of every state, every move's warning and hit, every beat of the retreat, lit and dark", () => {
  const { canvas, calls } = stubCanvas();
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) g.key("down");
  g.key("action");
  for (let n = 0; n < 2; n++) {
    for (let ms = 0; ms < ghoul.INTRO_MIN_MS + 50; ms += 16) g.tick(16);
    g.key("action");
  }
  const r = g.round;
  r.infinite = true;
  const frame = (label) => {
    const before = calls.count;
    g.tick(16);
    assert.ok(calls.count > before, `${label} draws`);
  };
  for (const dark of [false, true]) {
    r.dark = dark;
    standAt(r, 40);
    frame("the run up");
    standAt(r, 130);
    for (let ms = 0; ms < 1600; ms += 16) g.tick(16);
    r.marrow.windows.forEach((w, i) => (w.state = ["lit", "dark", "out"][i % 3]));
    frame("windows lit, shuttered and out");
    for (const move of ["shingles", "pickets", "carpet", "bricks", "doormen", "stomp", "lightning", "crows"]) {
      Object.assign(r.boss, { plan: move, wait: 0 });
      for (let ms = 0; ms < 1400; ms += 16) frame(move);
    }
    for (const t of [100, mw.FALSE_AT + 100, mw.LAUGH_AT + 100, mw.SINK_AT + 800, mw.GONE_AT + 100]) {
      Object.assign(r.boss, { state: "down", t, gone: t >= mw.GONE_AT });
      frame(`the retreat at ${t}`);
    }
    Object.assign(r.boss, { state: "fight", t: 0, gone: false });
  }
});

