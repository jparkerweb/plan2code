// Web console tests, Ghoul Rush's finale, Kill III, The Pit: the room (dark, a pit each side of the
// heart's plinth, the door at its end), the beat (its interval falling with hp, a wave each way on
// the dub, the ribs open only between beats: a bolt counts then and clanks otherwise), each move's
// warning seen and heard before it can hurt, its cost and its dodge, the beat stopping dead and the
// big double wave, the last hp no bolt can take and the HOLD FIRE flood that ends it (the meter,
// the weak beats that only knock it back, the white, the last thump, the fall, the daylight and its
// door), a life lost keeping it all, a bot's fight length at full depth, the voices, words and drawing.
// Run with: node --test scripts/test-web-console-activities-ghoul-heart.mjs
import "./seed-random.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import * as hr from "../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow-heart.js";
import { LOSE_SOUNDS, LOSE_WORDS, VOICES, heartArt } from "../src/web-console/public/activities/ghoul-rush/stages/marrow/ghoul-marrow-heart-draw.js";
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

function standAt(round, x, shelf = -1) {
  const y = shelf >= 0 ? round.spec.shelves[shelf][2] : ghoul.groundAt(round.spec, x);
  Object.assign(round.you, { x, y, vx: 0, vy: 0, state: "run", shelf, coyote: 0, drop: -1, cuttable: false, out: 0, safeMs: 0, face: 1 });
}

function run(round, ms, keys = {}, random = steady) {
  Object.assign(round.input, keys);
  for (let t = 0; t < ms; t += 4) ghoul.advance(round, 4, random);
  for (const k of Object.keys(keys)) round.input[k] = false;
}

// A run in the Pit, `depth` stages behind it, the finale's last room, nothing else awake.
function pitRound(depth = ghoul.RUN_STAGES) {
  const round = ghoul.newRound(5);
  round.dice = 0;
  round.cleared = ghoul.STAGES.slice(0, depth).map((st) => st.id);
  round.stage = ghoul.FINALE.id;
  round.stageAt = ghoul.FINALE.rooms.indexOf("pit");
  ghoul.setupRoom(round, "pit");
  round.phase = "play";
  round.items.fill(true);
  round.candy.fill(true);
  round.events.length = 0;
  return round;
}

// The fight under way: in the arena, the heart awake, the next move a long way off.
function pitFight(depth = ghoul.RUN_STAGES) {
  const round = pitRound(depth);
  standAt(round, 100);
  run(round, ghoul.BOSS_INTRO_MS + 100);
  assert.equal(round.boss.state, "fight");
  calm(round);
  return round;
}

// Nothing coming: no move for a long while, no beat due, nothing on the field.
function calm(round) {
  Object.assign(round.boss, { act: "idle", wait: 1e9, beatMs: -1e9, dubbed: true, opened: true, stopMs: 0, echo: 0 });
  round.hazards.length = 0;
  round.waves.length = 0;
  round.events.length = 0;
}

// The ribs held open (or shut) a long while.
const holdOpen = (b) => Object.assign(b, { beatT: 1e9, beatMs: hr.OPEN_AT + 1, opened: true, dubbed: true });
const holdShut = (b) => Object.assign(b, { beatT: 1e9, beatMs: -1e9, opened: true, dubbed: true });

/* ------------------------------------------------------------ the room */

test("Ghoul Rush's Pit: the finale's last room, always dark, the heart's boss room with a pit each side of its plinth and the door at the end, and its card", () => {
  assert.equal(ghoul.FINALE.rooms.at(-1), "pit");
  const base = ghoul.roomById("pit");
  assert.equal(base.boss, "marrowheart");
  assert.equal(base.dark, true);
  assert.ok(base.door > base.length - 14);
  const spec = ghoul.roomFor("pit", ghoul.RUN_STAGES);
  assert.equal(ghoul.groundAt(spec, hr.HEART_X), 6, "the plinth");
  assert.equal(ghoul.groundAt(spec, hr.LEFT_LIP + 1), -Infinity, "a pit on its left");
  assert.equal(ghoul.groundAt(spec, hr.RIGHT_LIP - 1), -Infinity, "and on its right");
  assert.ok(spec.arena < hr.LEFT_LIP - 40, "room to fight on the left");
  const info = bossIntroFor("marrowheart");
  assert.deepEqual([info.name, info.epithet], ["The Heart of Marrow", "It has never once skipped a beat"]);
  assert.equal(ghoul.BOSSES.marrowheart.name, info.name);
  const r = pitFight();
  const b = r.boss;
  assert.deepEqual([b.x, b.y, b.w, b.h], [hr.HEART_X, 6, hr.HEART_BOX_W, hr.HEART_BOX_H], "its box is the plinth");
  assert.ok(b.x - b.w / 2 <= hr.LEFT_LIP + 6 && b.x + b.w / 2 >= hr.RIGHT_LIP - 6, "nowhere to stand beside it");
  assert.equal(r.dark, true);
  // A fall down a pit costs a life.
  standAt(r, hr.LEFT_LIP + 2);
  r.you.y = 6;
  r.you.state = "air";
  r.you.vy = -10;
  const lives = r.lives;
  run(r, 1500);
  assert.ok(events(r, "lose").some((e) => e.cause === "pit") || r.lives < lives, "into the dark");
});

/* ------------------------------------------------------------ the beat */

test("Ghoul Rush's Pit: the beat comes every 1.5 s at full hp and quickens toward 0.75 s, a lub then the dub, and the dub sends a wave each way from the lips of the pits", () => {
  assert.equal(hr.beatFor(1), 1500);
  assert.equal(hr.beatFor(0), 750);
  assert.ok(hr.openFor(1) > hr.openFor(0.2), "the ribs' window narrows with hp");
  const r = pitFight();
  const b = r.boss;
  Object.assign(b, { beatT: 1500, beatMs: 1499, dubbed: true, opened: true });
  run(r, 8);
  assert.equal(events(r, "heartBeat").length, 1, "the lub");
  assert.equal(r.waves.length, 0, "no wave yet");
  run(r, hr.DUB_MS);
  assert.equal(events(r, "heartWave").length, 1, "the dub");
  const xs = r.waves.map((w) => [w.kind, w.dir, Math.round(w.x)]);
  assert.deepEqual(xs.sort(), [["heartBeat", -1, hr.LEFT_LIP - 1], ["heartBeat", 1, hr.RIGHT_LIP + 1]].sort(), "out of each pit's lip");
  // Low on hp, the beats come faster.
  calm(r);
  b.hp = Math.round(b.max * 0.1);
  Object.assign(b, { beatT: 1500, beatMs: 1499 });
  let lubs = 0;
  const times = [];
  for (let t = 0; t < 6000; t += 4) {
    ghoul.advance(r, 4, steady);
    r.you.safeMs = 1e9;
    if (events(r, "heartBeat").length) times.push(t);
    lubs += events(r, "heartBeat").length;
    r.events.length = 0;
  }
  const gap = times[2] - times[1];
  assert.ok(gap >= 780 && gap <= 900, `quick beats at a tenth of its hp (${gap} ms)`);
});

test("Ghoul Rush's Pit: a bolt into the open ribs hurts it, one while they are shut clanks off, and its weak spot is open only between beats", () => {
  const r = pitFight();
  const b = r.boss;
  standAt(r, 100);
  holdShut(b);
  run(r, 600, { fire: true });
  assert.equal(b.hp, b.max, "shut: no damage");
  assert.ok(events(r, "bossBlock").length > 0, "a clank");
  calm(r);
  r.heat = 0;
  r.events.length = 0;
  holdOpen(b);
  run(r, 600, { fire: true });
  assert.ok(b.hp < b.max, "open: it hurts");
  assert.ok(events(r, "bossHit").length > 0);
  // Over a normal beat, open only in its window.
  calm(r);
  Object.assign(b, { beatT: 1500, beatMs: 1499 });
  const open = [];
  for (let t = 0; t < 1500; t += 4) {
    r.you.safeMs = 1e9;
    ghoul.advance(r, 4, steady);
    open.push([t, b.open]);
  }
  const first = open.find(([, o]) => o);
  const last = open.filter(([, o]) => o).at(-1);
  assert.ok(first[0] >= hr.OPEN_AT - 10 && first[0] <= hr.OPEN_AT + 10, "opens after the dub");
  assert.ok(last[0] - first[0] <= hr.openFor(1) * 1500 + 10, "for its share of the beat");
  assert.equal(events(r, "heartOpen").length, 1, "heard once");
});

test("Ghoul Rush's Pit: the beat's wave costs a life standing still (shaken off your feet) and is jumped", () => {
  const r = pitFight();
  const b = r.boss;
  standAt(r, 100);
  Object.assign(b, { beatT: 1e9, beatMs: hr.DUB_MS - 1, dubbed: false });
  run(r, 900);
  assert.deepEqual(events(r, "lose").map((e) => e.cause), ["heartBeat"]);
  const j = pitFight();
  standAt(j, 100);
  Object.assign(j.boss, { beatT: 1e9, beatMs: hr.DUB_MS - 1, dubbed: false });
  for (let t = 0; t < 900; t += 4) {
    const w = j.waves.find((q) => q.dir < 0);
    if (w && w.x - j.you.x > 0 && w.x - j.you.x < 4 && j.you.state === "run") j.input.jump = ghoul.JUMP_BUFFER_MS;
    ghoul.advance(j, 4, steady);
  }
  assert.deepEqual(events(j, "lose"), [], "jumped");
});

/* ------------------------------------------------------------ the moves */

// The fight with `move` next, YOU at x (on a ledge's index when given).
function moveRound(move, x = 100, shelf = -1, share = 1) {
  const r = pitFight();
  r.boss.hp = Math.max(2, Math.round(r.boss.max * share));
  standAt(r, x, shelf);
  holdShut(r.boss);
  Object.assign(r.boss, { plan: move, wait: 0 });
  return r;
}

const HAZARD = { roots: "heartRoot", grab: "heartGrab", clots: "heartClot", quake: "heartChunk" };
const WIND = { roots: "heartRootWind", grab: "heartGrabWind", clots: "heartClotWind", quake: "heartQuake" };

test("Ghoul Rush's Pit: every move is seen and heard well before it can hurt, hurts standing YOU with its own cause, and is dodged", () => {
  const cases = [["roots", 100, -1, 1], ["grab", 99, 1, 1], ["clots", 100, -1, 1], ["quake", 100, -1, 0.2]];
  for (const [move, x, shelf, share] of cases) {
    const r = moveRound(move, x, shelf, share);
    ghoul.advance(r, 4, steady);
    assert.equal(events(r, WIND[move]).length, 1, `${move}: its warning, heard`);
    const hz = r.hazards.filter((h) => h.kind === HAZARD[move]);
    assert.ok(hz.length >= 1, `${move}: something placed`);
    assert.ok(hz.every((h) => !(h.live > 0) && h.warn >= 900), `${move}: a warning of nearly a second or more before any can hurt`);
    // Standing still (the ledge's grab: staying on it) costs a life with its cause.
    const lost = [];
    for (let t = 0; t < 2500 && !lost.length; t += 4) {
      ghoul.advance(r, 4, steady);
      if (r.boss.act === "idle") r.boss.wait = 1e9;
      lost.push(...events(r, "lose"));
      r.events.length = 0;
    }
    assert.deepEqual(lost.map((e) => e.cause), [HAZARD[move]], `${move}: hurts`);
    // Dodged: off the ledge, or a few steps aside from where it will come.
    const d = moveRound(move, x, shelf, share);
    ghoul.advance(d, 4, steady);
    const far = [];
    for (let t = 0; t < 2500; t += 4) {
      if (d.phase === "play") {
        const threat = d.hazards.find((h) => Math.abs(h.x - d.you.x) < (h.w + 2.4) / 2 + 1.2);
        if (shelf >= 0) {
          if (d.you.shelf >= 0) standAt(d, 75);
        } else if (threat) standAt(d, Math.max(d.spec.arena + 4, Math.min(hr.LEFT_LIP - 3, threat.x + (threat.x > d.you.x ? -3.6 : 3.6))));
      }
      ghoul.advance(d, 4, steady);
      if (d.boss.act === "idle") d.boss.wait = 1e9;
      far.push(...events(d, "lose"));
      d.events.length = 0;
    }
    assert.deepEqual(far.map((e) => e.cause), [], `${move}: dodged`);
  }
});

test("Ghoul Rush's Pit: the pick never plays a move three times running, grabs only while YOU are on a ledge, and the quake only below a quarter", () => {
  const b = {};
  const random = seededRandom(4);
  const picks = [];
  for (let i = 0; i < 300; i++) picks.push(hr.pickMove(b, 0, random, false));
  for (let i = 2; i < picks.length; i++) assert.ok(!(picks[i] === picks[i - 1] && picks[i] === picks[i - 2]), "never three running");
  assert.ok(!picks.includes("grab") && !picks.includes("quake"));
  const high = [];
  for (let i = 0; i < 200; i++) high.push(hr.pickMove(b, 2, random, true));
  assert.ok(high.includes("grab") && high.includes("quake"));
  assert.ok(high.filter((p) => p === "grab").length > high.filter((p) => p === "roots").length, "on a ledge, grabs most of all");
  assert.equal(hr.phaseFor(0.6), 0);
  assert.equal(hr.phaseFor(0.5), 1);
  assert.equal(hr.phaseFor(0.25), 2);
});

/* ------------------------------------------------------- the beat stops dead */

test("Ghoul Rush's Pit: below half the beat stops dead: silence, its swell heard well before, then a big double wave each way, and a long gasp of open ribs", () => {
  const r = pitFight();
  const b = r.boss;
  b.hp = Math.round(b.max * 0.45);
  r.you.safeMs = 1e9;
  Object.assign(b, { beatT: 1500, beatMs: 1499, beats: 99, stopAt: 3 });
  const seen = [];
  let opened = 0;
  let wasOpen = false;
  let openMs = 0;
  for (let t = 0; t < hr.STOP_MS + 1500; t += 4) {
    r.you.safeMs = 1e9;
    ghoul.advance(r, 4, steady);
    for (const e of r.events) if (e.type.startsWith("heart")) seen.push([e.type, t, !!e.echo]);
    if (b.open) openMs += 4;
    if (b.open && !wasOpen) opened++;
    wasOpen = b.open;
    r.events.length = 0;
  }
  const types = seen.map(([type]) => type);
  assert.equal(types[0], "heartStop");
  const swell = seen.find(([type]) => type === "heartSwell");
  const slams = seen.filter(([type]) => type === "heartSlam");
  assert.ok(swell && swell[1] >= hr.STOP_MS - hr.SWELL_MS - 10 && swell[1] <= hr.STOP_MS - hr.SWELL_MS + 10, "the swell, SWELL_MS before");
  assert.ok(!types.slice(0, types.indexOf("heartSlam")).includes("heartBeat"), "no beat in the silence");
  assert.equal(slams.length, 2, "a double wave");
  assert.ok(Math.abs(slams[1][1] - slams[0][1] - hr.BIG_GAP_MS) <= 8, "BIG_GAP_MS apart");
  assert.ok(openMs >= hr.openFor(0.45) * hr.beatFor(0.45) * hr.GASP * 0.9, `a long gasp open after it (${openMs} ms)`);
});

/* ------------------------------------------------------------ the hold */

test("Ghoul Rush's Pit: no bolt takes its last hp: it holds at 1, the ribs lock open and HOLD FIRE begins, once, with the story's click; the blaster fires nothing and cools", () => {
  const r = pitFight();
  const b = r.boss;
  standAt(r, 100);
  holdOpen(b);
  b.hp = 3;
  r.heat = 20;
  run(r, 1500, { fire: true });
  assert.equal(b.hp, 1, "held at 1");
  assert.equal(b.state, "fight");
  assert.equal(events(r, "heartHold").length, 1, "the hold, once");
  assert.equal(r.flood, true);
  assert.equal(r.heart.hold, true);
  assert.equal(VOICES.marrowheart.hold, "ghoulStoryClick");
  const shots = r.stats.shots;
  const heat = r.heat;
  run(r, 600, { fire: true });
  assert.equal(r.stats.shots, shots, "fire held fires nothing");
  assert.ok(r.heat <= heat, "and the heat cools");
  // A weapon's blow glances off in the hold (the guard).
  assert.equal(ghoul.guarded(r.boss), true);
});

test("Ghoul Rush's Pit: in the hold the meter fills over about 4 s of fire held, drains slowly let go; weak beats every 1.5 s send ripples that only knock it back, never a life", () => {
  const r = pitFight();
  const b = r.boss;
  standAt(r, 100);
  b.hp = 1;
  hr.startHold(r, b);
  r.events.length = 0;
  // No weak beat for now: the meter alone.
  r.heart.beatMs = -1e9;
  run(r, 2000, { fire: true });
  assert.ok(Math.abs(r.heart.meter - 2000 / hr.HOLD_FILL_MS) < 0.03, `filling (${r.heart.meter})`);
  const m = r.heart.meter;
  run(r, 1000);
  assert.ok(r.heart.meter < m && r.heart.meter > m - 0.2, "drains slowly");
  r.heart.beatMs = 0;
  run(r, hr.HOLD_BEAT_MS + 20);
  assert.equal(events(r, "heartWeakBeat").length, 1, "a weak beat");
  assert.equal(r.heart.waves.length, 1, "and its ripple");
  r.heart.waves.length = 0;
  // A ripple reaching YOU knocks the meter back and costs nothing.
  const lives = r.lives;
  r.heart.meter = 0.6;
  r.heart.waves.push({ x: r.you.x + 0.5, y: 6, dir: -1 });
  run(r, 40, { fire: true });
  assert.equal(events(r, "heartKnock").length, 1);
  assert.ok(r.heart.meter < 0.6 - hr.HOLD_KNOCK + 0.05, "knocked back");
  assert.equal(r.lives, lives);
  assert.deepEqual(events(r, "lose"), []);
  // The flood swells out loud at each quarter climbed.
  r.heart.meter = 0.2;
  r.heart.step = 0;
  r.heart.beatMs = -1e9;
  r.heart.waves.length = 0;
  r.events.length = 0;
  run(r, 2400, { fire: true });
  assert.deepEqual(events(r, "heartFlood").map((e) => e.n), [1, 2, 3]);
});

test("Ghoul Rush's Pit: the meter full turns the screen white, the last thump, the fall (a life, the points), then the daylight and its door, the finale's end", () => {
  const r = pitFight();
  const b = r.boss;
  standAt(r, 100);
  b.hp = 1;
  hr.startHold(r, b);
  r.heart.meter = 0.99;
  r.heart.step = 3;
  r.events.length = 0;
  const lives = r.lives;
  const order = [];
  for (let t = 0; t < hr.FALL_AT + hr.DAYLIGHT_AT + 800; t += 4) {
    r.input.fire = t < 300;
    ghoul.advance(r, 4, steady);
    for (const e of r.events) if (e.type.startsWith("heart") || e.type === "bossDown") order.push([e.type, t]);
    if (t > 400 && t < hr.WHITE_HOLD_MS) assert.ok(hr.whiteOf(r) > 0.9, "white");
    // (The fall's own slice hands the key over; the next takes it back till the daylight.)
    if (b.state === "down" && !b.gone && b.t > 8) assert.equal(r.hasKey, false, "no door until the daylight");
    r.events.length = 0;
  }
  assert.deepEqual(order.map(([type]) => type), ["heartWhite", "heartLast", "bossDown", "heartDaylight"]);
  assert.ok(order[1][1] - order[0][1] >= hr.LAST_AT - 10, "the last thump, after the white");
  assert.ok(order[2][1] - order[0][1] >= hr.FALL_AT - 10, "then the fall");
  assert.equal(b.state, "down");
  assert.equal(r.lives, lives + 1, "a life, as every boss gives");
  assert.equal(b.gone, true);
  assert.equal(r.hasKey, true);
  assert.equal(r.flood, false);
  assert.equal(hr.whiteOf(r), 0, "the white gone again");
  // Through the door of light: the finale's end.
  standAt(r, r.spec.door);
  run(r, 50);
  assert.equal(r.phase, "clear");
  run(r, ghoul.CLEAR_MS + 50);
  assert.ok(r.phase === "ending" || r.won, `the run's end (${r.phase})`);
});

test("Ghoul Rush's Pit: a life lost keeps its hp and the hold, and the endless-lives code spares every hit", () => {
  const r = pitFight();
  const b = r.boss;
  b.hp = Math.round(b.max * 0.7);
  const hp = b.hp;
  standAt(r, 100);
  Object.assign(b, { beatT: 1e9, beatMs: hr.DUB_MS - 1, dubbed: false });
  run(r, 4000);
  assert.ok(events(r, "lose").length >= 1);
  assert.equal(r.boss.hp, hp, "its hp kept");
  // In the hold, a respawn holds on.
  const h = pitFight();
  h.boss.hp = 1;
  hr.startHold(h, h.boss);
  h.heart.meter = 0.4;
  standAt(h, hr.LEFT_LIP - 1);
  h.you.x = hr.LEFT_LIP + 2;
  h.you.state = "air";
  run(h, 3500);
  assert.ok(events(h, "lose").some((e) => e.cause === "pit"));
  assert.equal(h.boss.hp, 1);
  assert.equal(h.heart.hold, true);
  run(h, ghoul.BOSS_INTRO_MS + 200);
  assert.equal(h.flood, true, "still holding");
  // The endless-lives code.
  const e = moveRound("roots");
  e.infinite = true;
  const lives = e.lives;
  run(e, 2500);
  assert.ok(events(e, "lose").length >= 1, "hit");
  assert.equal(e.lives, lives, "no life spent");
});

/* ------------------------------------------------------------ the fight */

// A steady player on the floor at HOME: fires so its bolts land while the ribs are open, jumps each wave,
// steps aside from a root, a clot or a chunk, and in the hold holds fire and jumps the ripples.
const HOME = 100;
function fight(seed, skilled = true) {
  const round = pitFight();
  const random = seededRandom(seed);
  const b = round.boss;
  Object.assign(b, { wait: 600, beatT: 0 });
  let t = 0;
  const causes = [];
  for (; t < 240000 && b.state !== "down" && !round.over; t += 4) {
    const you = round.you;
    const inp = round.input;
    inp.left = inp.right = inp.fire = false;
    if (round.phase === "ask") ghoul.answerDie(round, false);
    if (skilled && round.phase === "play" && you.out <= 0) {
      const h = round.heart;
      const waves = h && h.hold ? h.waves : round.waves;
      const wave = waves.find((w) => w.dir < 0 && w.x - you.x > 0 && w.x - you.x < (h && h.hold ? 3 : 5));
      const threat = round.hazards.find((q) => (q.warn > 0 || q.live > 0) && Math.abs(q.x - you.x) < (q.w + 2.4) / 2 + 0.8);
      if (wave && you.state === "run") inp.jump = ghoul.JUMP_BUFFER_MS;
      if (threat) {
        const dir = threat.x >= you.x ? -1 : 1;
        const lo = round.spec.arena + 4;
        const hi = hr.LEFT_LIP - 4;
        inp[(dir < 0 ? you.x - 3 > lo : you.x + 3 > hi) ? "left" : "right"] = true;
      } else if (Math.abs(you.x - HOME) > 6 && !round.hazards.length) inp[you.x < HOME ? "right" : "left"] = true;
      else you.face = 1;
      // Fired so each bolt lands while the ribs are open (the way a player learns the beat).
      const travel = ((hr.HEART_X - hr.HEART_BOX_W / 2 - you.x - 1.8) / 130) * 1000;
      const span = hr.openFor(b.hp / b.max) * b.beatT * (b.gasp ? hr.GASP : 1);
      const at = (b.beatMs || 0) + travel;
      inp.fire = h && h.hold ? true : !(b.stopMs > 0) && at >= hr.OPEN_AT + 10 && at <= hr.OPEN_AT + span - 10 && you.face === 1;
    }
    ghoul.advance(round, 4, random);
    causes.push(...events(round, "lose").map((e) => e.cause));
    round.events.length = 0;
  }
  return { won: b.state === "down", secs: t / 1000, causes, round };
}

test("Ghoul Rush's Pit takes a steady player a real fight at full depth: 60 to 120 seconds on most seeds, with lives to spare; a player who stands still dies", () => {
  const times = [];
  const lives = [];
  let good = 0;
  for (const seed of [3, 7, 19, 41]) {
    const f = fight(seed);
    assert.ok(f.won, `seed ${seed}: it stopped (${f.causes}; ${f.secs.toFixed(1)} s, hp ${f.round.boss.hp})`);
    assert.ok(f.round.lives > 0, `seed ${seed}: lives to spare (${f.causes})`);
    for (const c of f.causes) assert.ok(LOSE_WORDS[c] || c === "pit", `${c} is the heart's`);
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
  const kit = { tone: (name) => played.push(name), burst: noop, float: noop, ring: noop, banner: () => null, shake: noop, flash: noop, glow: noop, splat: noop, fx: { clock: 1e6 }, monsters: ghoul.MONSTERS, powers: ghoul.POWERS, bosses: ghoul.BOSSES, g: {}, floorAt: () => 6, markFurthest: noop };
  react(e, kit);
  return played;
};

test("Ghoul Rush's heart: a voice for every act in tones.js, every event plays its own sound once, and every cause has words and a sound", () => {
  const known = new Set(toneNames());
  for (const [act, name] of Object.entries(VOICES.marrowheart)) assert.ok(known.has(name), `${act}: ${name} is a tone`);
  const at = { kind: "marrowheart", x: 120, y: 20, xs: [100], n: 1 };
  const cases = { heartBeat: "beat", heartOpen: "open", heartRootWind: "rootWind", heartRootCrack: "rootCrack", heartRootUp: "rootUp", heartGrabWind: "grabWind", heartGrabTense: "grabTense", heartGrabLash: "grabLash", heartClotWind: "clotWind", heartClotLand: "clotLand", heartQuake: "quake", heartChunkLand: "chunk", heartStop: "stop", heartSwell: "swell", heartSlam: "slam", heartHold: "hold", heartWeakBeat: "weakBeat", heartKnock: "knock", heartFlood: "flood", heartWhite: "white", heartLast: "last", heartDaylight: "daylight", bossWake: "wake", bossHit: "hurt", bossDown: "die" };
  for (const [type, act] of Object.entries(cases)) {
    const played = heard({ type, ...at, how: "shot", points: 1, life: true });
    assert.equal(played.filter((n) => n === VOICES.marrowheart[act]).length, 1, `${type}: ${VOICES.marrowheart[act]} once`);
  }
  assert.deepEqual(heard({ type: "heartWave", ...at }), [], "the dub is the beat's own second thump");
  for (const cause of ["marrowheart", "heartBeat", "heartBig", "heartRoot", "heartGrab", "heartClot", "heartChunk"]) {
    assert.ok(LOSE_WORDS[cause], `${cause}: words`);
    assert.ok(known.has(LOSE_SOUNDS[cause][0]), `${cause}: a sound`);
  }
});

test("Ghoul Rush's Pit draws: the walk in, the heart asleep, every beat's moment, every move's warning and hit, the stopped beat and the slam, the hold, the white, the stopped heart and the daylight, lit and dark, and its card", () => {
  const { canvas, calls } = stubCanvas();
  const g = ghoul.default.create({ canvas });
  g.resize(900, 900);
  g.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) g.key("down");
  for (let i = 0; i < ghoul.FINALE.rooms.indexOf("pit"); i++) g.key("right");
  g.key("action");
  for (let n = 0; n < 3 && g.round.phase !== "ready" && g.round.phase !== "play"; n++) {
    for (let ms = 0; ms < ghoul.INTRO_MIN_MS + 50; ms += 16) g.tick(16);
    g.key("action");
  }
  const r = g.round;
  assert.equal(r.spec.id, "pit");
  r.infinite = true;
  const frame = (label) => {
    const before = calls.count;
    g.tick(16);
    assert.ok(calls.count > before, `${label} draws`);
  };
  for (const dark of [false, true]) {
    r.dark = dark;
    standAt(r, 20);
    frame("the walk in");
    standAt(r, 100);
    for (let ms = 0; ms < 1600; ms += 16) g.tick(16);
    for (const beatMs of [10, 200, 320, 500, 1300]) {
      Object.assign(r.boss, { beatT: 1500, beatMs, wait: 1e9 });
      frame(`the beat at ${beatMs}`);
    }
    for (const [move, share] of [["roots", 1], ["clots", 0.6], ["quake", 0.2]]) {
      r.boss.hp = Math.round(r.boss.max * share);
      Object.assign(r.boss, { plan: move, act: "idle", wait: 0 });
      for (let ms = 0; ms < 1600; ms += 16) frame(move);
    }
    standAt(r, 99, 1);
    Object.assign(r.boss, { plan: "grab", act: "idle", wait: 0 });
    for (let ms = 0; ms < 1600; ms += 16) frame("grab");
    standAt(r, 100);
    Object.assign(r.boss, { stopMs: 1200, swelled: false });
    for (let ms = 0; ms < 1800; ms += 16) frame("the stop and the slam");
  }
  r.boss.hp = 1;
  hr.startHold(r, r.boss);
  r.heart.meter = 0.5;
  r.input.fire = true;
  for (let ms = 0; ms < 2600; ms += 16) frame("the hold");
  for (let ms = 0; ms < 6000; ms += 16) frame("the white, the fall and the daylight");
  assert.equal(r.boss.state, "down");
  // The boss card's fake view: no round, no room, the floor at 0.
  const def = ghoul.BOSSES.marrowheart;
  assert.ok(def.w >= 30 && def.h >= 36, "the card sizes its spotlight to the whole heart");
  const noop = () => {};
  const art = heartArt({ ellipse: noop, circle: noop, roundRect: noop, line: noop, rotate: noop, hash: (a, b) => Math.abs(a * 31 + b * 17) % 997, say: noop, gate: () => true, label: noop, DANGER: "#ff3030", GOLD: "#f5b301" });
  const card = stubCanvas();
  const fake = { kind: "marrowheart", x: 0, y: 0, w: def.w, h: def.h, hp: 1, max: 1, state: "fight", t: 0 };
  for (const clock of [0, 400, 900]) art.bosses.marrowheart(card.ctx, { g: { FIELD_H: 0 }, clock, spec: null, groundAt: () => 0, eyes: [] }, fake);
  assert.ok(card.calls.count > 50, "the card's heart draws");
});
