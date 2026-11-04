// Web console tests, Ghoul Rush's boss intro cards: every boss room has an entry (the boss's exact name, an epithet, no em dash, never the hero's name), the card shows when a boss room is entered (after the bonus ride too) and in no other room, not again on a retry, any fresh move key, fire or click moves it on after the lockout (repeats and early presses never do), it never moves on by itself, a pause holds it, and it draws for every boss on a fake canvas (through the boss's own art, with a fallback when the art throws or is missing).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { BOSS_INTROS, MAX_EPITHET, bossIntroFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-boss-intros.js";
import { BOSS_HINT, BOSS_TITLE, beatAt, landAt, shakeAt, bossIntroArt } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-bossintro-draw.js";
import { INTROS } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-intros.js";
import { toneNames } from "../src/web-console/public/tones.js";
import { skipBossIntro } from "./ghoul-test-helpers.mjs";

const steady = () => 0.5;
const DASH = String.fromCharCode(0x2014);

function fakeCtx(texts) {
  return new Proxy({}, {
    get: (t, name) => (name in t ? t[name] : name === "fillText" ? (s) => texts.push(s) : () => {}),
    set: (t, name, value) => ((t[name] = value), true),
  });
}

function newGame(texts = [], opts = {}) {
  const ctx = fakeCtx(texts);
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, ...opts });
  g.resize(900, 900);
  g.key("action");
  g.round.dice = 0;
  return g;
}

// A game on the stage select, straight into room `room` of the stage at `at` (a boss room is the last).
function selectInto(at, room, texts = [], opts = {}) {
  const g = newGame(texts, opts);
  g.round.phase = "select";
  g.round.select = { at, room };
  g.round.practice = true;
  g.key("action");
  // A stage that opens on its boss's room (the finale) shows its own card first.
  if (g.round.phase === "intro") {
    g.round.introMs = ghoul.INTRO_MIN_MS;
    g.key("action");
  }
  return g;
}

const bossRooms = ghoul.ROOMS.filter((r) => r.boss);

// A round at the stage pick, the offer settled, then into `id`'s first room (the stage's intro card skipped).
function inStage(id) {
  const r = ghoul.newRound(3);
  r.dice = 0;
  r.phase = "clear";
  r.phaseMs = 1;
  ghoul.advance(r, 4, steady);
  r.offer = [id];
  r.phaseMs = 0;
  assert.equal(ghoul.pickStage(r, 0), true);
  r.introMs = ghoul.INTRO_MIN_MS;
  assert.equal(ghoul.takeIntro(r), true);
  return r;
}

const through = (round) => {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
};

test("Ghoul Rush boss intros: every boss room has an entry with the boss's exact name and a short epithet, no em dash, never the hero's name", () => {
  assert.ok(bossRooms.length >= 10, "the boss rooms are found");
  const ids = new Set(bossRooms.map((r) => r.boss));
  for (const id of ids) {
    const info = bossIntroFor(id);
    assert.ok(info, `the boss "${id}" needs an entry in ghoul-boss-intros.js (BOSS_INTROS)`);
    assert.equal(info.name, ghoul.BOSSES[id].name, `${id}: the name is the boss's own`);
    assert.ok(typeof info.epithet === "string" && info.epithet.length >= 8 && info.epithet.length <= MAX_EPITHET, `${id}: an epithet of 8 to ${MAX_EPITHET} characters`);
    for (const text of [info.name, info.epithet]) {
      assert.ok(!text.includes(DASH), `${id}: no em dash`);
      assert.ok(!/planny/i.test(text), `${id}: never the hero's name`);
    }
    if (info.accent) assert.match(info.accent, /^#[0-9a-f]{6}$/i);
  }
  for (const id of Object.keys(BOSS_INTROS)) assert.ok(ids.has(id), `${id} is no boss of any room`);
  for (const st of ghoul.STAGES) {
    assert.ok(INTROS[st.id], st.id);
    assert.equal(INTROS[st.id].boss, bossIntroFor(st.boss).name, `${st.id}: the stage card and the boss card agree on the name`);
    assert.equal(ghoul.roomById(st.rooms.at(-1)).boss, st.boss, `${st.id}: its last room holds its boss`);
  }
  assert.equal(bossIntroFor("nobody"), null);
  assert.ok(toneNames().includes("ghoulBossIntro"), "the sting is a real tone");
});

test("Ghoul Rush boss intros: a new boss room added without an entry would fail (the check reads every room)", () => {
  const missing = [...ghoul.ROOMS, { id: "fake", boss: "newfiend" }].filter((r) => r.boss && !bossIntroFor(r.boss)).map((r) => r.boss);
  assert.deepEqual(missing, ["newfiend"]);
});

test("Ghoul Rush boss intros: every stage's boss room opens on the card, after the bonus ride too, and no other room does", () => {
  for (const st of ghoul.STAGES) {
    const r = inStage(st.id);
    for (let i = 0; i < st.rooms.length; i++) {
      const id = st.rooms[i];
      assert.equal(r.spec.id, id);
      const boss = Boolean(ghoul.roomById(id).boss);
      if (i === st.rooms.length - 1) {
        assert.ok(boss, `${st.id}: the last room is the boss room`);
        assert.ok(ghoul.roomById(st.rooms[i - 1]).bonus, `${st.id}: the bonus ride comes right before the boss`);
      }
      if (!boss) {
        assert.notEqual(r.phase, "bossintro", `${st.id}/${id}: no card here`);
        assert.equal(r.phase, "ready", `${st.id}/${id}`);
        assert.equal(r.events.some((e) => e.type === "bossIntro"), false);
        r.events.length = 0;
        through(r);
        continue;
      }
      assert.equal(r.phase, "bossintro", `${st.id}: the boss room opens on its card`);
      assert.deepEqual(r.events.filter((e) => e.type === "bossIntro").map((e) => [e.boss, e.stage]), [[st.boss, st.id]]);
      assert.equal(r.events.some((e) => e.type === "room" && e.room === r.room), false, "the room's announcement waits for the card");
      assert.ok(r.boss && r.boss.kind === st.boss, "the boss room is set up behind the card");
      assert.equal(r.boss.state, "sleep");
      // Nothing moves while the card is up.
      const at = r.you.x;
      r.input.right = true;
      ghoul.advance(r, 600, steady);
      assert.equal(r.you.x, at);
      assert.equal(r.phase, "bossintro");
      r.input.right = false;
      // The lockout, then a press.
      ghoul.advance(r, ghoul.INTRO_MIN_MS - 650, steady);
      assert.equal(ghoul.takeIntro(r), false, "not before the lockout");
      ghoul.advance(r, 100, steady);
      r.events.length = 0;
      assert.equal(ghoul.takeIntro(r), true);
      assert.equal(r.phase, "ready");
      assert.equal(r.phaseMs, ghoul.READY_MS);
      assert.equal(r.events.filter((e) => e.type === "room").length, 1, "the boss room is announced now");
      assert.equal(ghoul.takeIntro(r), false, "taken once");
      ghoul.advance(r, ghoul.READY_MS + 20, steady);
      assert.equal(r.phase, "play");
    }
  }
});

test("Ghoul Rush boss intros: the last room's door shows the card, a retry inside the boss room never does", () => {
  const r = inStage("manor");
  while (!ghoul.roomById(r.spec.id).boss) through(r);
  assert.equal(r.phase, "bossintro");
  skipBossIntro(ghoul, r);
  ghoul.advance(r, ghoul.READY_MS + 20, steady);
  assert.equal(r.phase, "play");
  r.lives = 9;
  r.you.safeMs = 0;
  for (let n = 0; n < 3; n++) {
    r.events.length = 0;
    ghoul.lose(r, "zombie");
    for (let ms = 0; ms < ghoul.CRASH_MS + 400 && r.phase !== "ready" && r.phase !== "over"; ms += 16) {
      ghoul.advance(r, 16, steady);
      assert.notEqual(r.phase, "bossintro", "no card on a retry");
    }
    assert.equal(r.phase, "ready", `retry ${n + 1} restarts the room`);
    assert.equal(r.events.some((e) => e.type === "bossIntro"), false, "no card event on a retry");
    ghoul.advance(r, ghoul.READY_MS + 20, steady);
    r.you.safeMs = 0;
  }
});

test("Ghoul Rush boss intros: the stage select shows the card for a boss room only, like the stage's card on its first room", () => {
  ghoul.STAGES.forEach((st, at) => {
    const g = selectInto(at, st.rooms.length - 1);
    assert.equal(g.round.phase, "bossintro", `${st.id}: straight into the boss room`);
    assert.equal(g.round.stage, st.id);
    const mid = selectInto(at, 2);
    assert.equal(mid.round.phase, "ready", `${st.id}: a mid-stage room has no card`);
    const bonus = selectInto(at, st.rooms.length - 2);
    assert.equal(bonus.round.phase, "ready", `${st.id}: the bonus ride has none`);
  });
});

test("Ghoul Rush boss intros: with the window's keys, a held fire never skips it, a fresh press does after the lockout, a click works, and a pause holds it", () => {
  const sounds = [];
  const texts = [];
  const g = selectInto(0, ghoul.STAGES[0].rooms.length - 1, texts, { tone: (name) => sounds.push(name) });
  assert.equal(g.round.phase, "bossintro");
  for (let k = 0; k < 5; k++) g.key("action", true);
  g.key("action");
  assert.equal(g.round.phase, "bossintro", "too soon, and repeats never count");
  assert.equal(g.round.input.fire, false, "no shot fired at the card");
  g.tick(16);
  assert.ok(sounds.includes("ghoulBossIntro"), "the sting plays when the card opens");
  for (let ms = 0; ms < 3000; ms += 16) g.tick(16);
  texts.length = 0;
  g.tick(16);
  const info = bossIntroFor(ghoul.STAGES[0].boss);
  assert.ok(texts.includes(BOSS_HINT), "the hint shows");
  assert.match(BOSS_HINT, /any move key or fire to start the fight/);
  assert.ok(BOSS_TITLE.split("").every((ch) => ch === " " || texts.includes(ch)), "every letter of BOSS FIGHT is drawn");
  assert.ok(texts.includes(info.name.toUpperCase()), "the boss's name is drawn");
  assert.ok(texts.includes(info.epithet), "the epithet is drawn");
  g.pause();
  const held = g.round.introMs;
  for (let k = 0; k < 20; k++) g.tick(16);
  assert.equal(g.round.introMs, held, "a pause holds the card");
  texts.length = 0;
  g.tick(16);
  g.resume();
  g.key("action", true);
  assert.equal(g.round.phase, "bossintro", "a repeat still does nothing");
  g.release("action");
  g.key("action");
  assert.equal(g.round.phase, "ready", "a fresh press starts the fight");
  assert.equal(g.round.input.fire, false);
  // Each of the other keys, and a click.
  for (const name of ["left", "right", "up", "down", "action"]) {
    const k = selectInto(3, ghoul.STAGES[3].rooms.length - 1);
    k.key(name);
    assert.equal(k.round.phase, "bossintro", `${name}: an early press is ignored`);
    for (let ms = 0; ms < ghoul.INTRO_MIN_MS + 100; ms += 16) k.tick(16);
    k.key(name, true);
    assert.equal(k.round.phase, "bossintro", `${name}: a repeat is ignored`);
    k.release(name);
    k.key(name);
    assert.equal(k.round.phase, "ready", `${name}: a fresh press moves on`);
    assert.equal(k.round.input.fire, false, "no shot fired at the card");
  }
  const h = selectInto(5, ghoul.STAGES[5].rooms.length - 1);
  h.pointer("down", 10, 10);
  assert.equal(h.round.phase, "bossintro", "a click before the lockout is ignored");
  for (let ms = 0; ms < 1300; ms += 16) h.tick(16);
  h.pointer("down", 10, 10);
  assert.equal(h.round.phase, "ready", "a click moves on");
});

test("Ghoul Rush boss intros: it never moves on by itself, not after a minute and not after an hour", () => {
  const q = inStage("manor");
  while (!ghoul.roomById(q.spec.id).boss) through(q);
  assert.equal(q.phase, "bossintro");
  for (const ms of [15000, 60000, 3600000]) {
    ghoul.advance(q, ms, steady);
    assert.equal(q.phase, "bossintro", `still waiting after ${ms} ms more`);
  }
  assert.equal(q.boss.state, "sleep", "the boss has not woken");
  assert.equal(ghoul.takeIntro(q), true, "a press still works after any wait");
  const g = selectInto(2, ghoul.STAGES[2].rooms.length - 1);
  for (let ms = 0; ms < 120000; ms += 100) g.tick(100);
  assert.equal(g.round.phase, "bossintro");
});

test("Ghoul Rush boss intros: the card draws for every boss at many moments, through that boss's own art", () => {
  const sizes = { W: 96, H: 54 };
  for (const room of bossRooms) {
    const id = room.boss;
    // The stage that holds this boss's room (the finale holds three).
    const st = ghoul.SELECTABLE.find((s) => s.rooms.includes(room.id));
    const calls = [];
    const BOSS_ART = new Proxy({}, { get: (t, k) => (k === id ? (ctx, pic, b) => calls.push([pic, b]) : undefined) });
    const texts = [];
    const ctx = fakeCtx(texts);
    const draw = bossIntroArt({ label: (c, text) => c.fillText(text), circle: () => {}, BOSS_ART, drawGourdFire: () => {}, GOLD: "#fc0", BONE: "#eee" });
    const v = { g: { FIELD_W: sizes.W, FIELD_H: sizes.H }, round: { spec: { boss: id }, stage: st ? st.id : null, introMs: 0 }, bosses: ghoul.BOSSES };
    for (let t = 0; t <= 6000; t += 37) {
      v.round.introMs = t;
      draw(ctx, v);
    }
    assert.ok(calls.length > 50, `${id}: the boss's art was called`);
    assert.ok(calls.every(([pic, b]) => b.kind === id && b.w === ghoul.BOSSES[id].w && b.h === ghoul.BOSSES[id].h), `${id}: drawn as itself`);
    assert.ok(texts.includes(bossIntroFor(id).name.toUpperCase()), `${id}: the name`);
    assert.ok(texts.includes(bossIntroFor(id).epithet), `${id}: the epithet`);
    // The same through the game's own drawing, with the real art.
    const g2texts = [];
    const g = selectInto(ghoul.SELECTABLE.indexOf(st), st.rooms.indexOf(room.id), g2texts);
    assert.equal(g.round.phase, "bossintro", id);
    for (let ms = 0; ms < 5000; ms += 80) {
      g.round.introMs = ms;
      g.tick(1);
    }
    assert.ok(g2texts.includes(bossIntroFor(id).name.toUpperCase()), `${id}: the game draws the card`);
  }
});

test("Ghoul Rush boss intros: a boss whose art throws or is missing still gets its card, with a silhouette and its name", () => {
  const v = { g: { FIELD_W: 96, FIELD_H: 54 }, round: { spec: { boss: "bones" }, stage: "wing", introMs: 3000 }, bosses: ghoul.BOSSES };
  for (const BOSS_ART of [{ bones: () => { throw new Error("broken art"); } }, {}, { bones: "not a function" }]) {
    const texts = [];
    let shapes = 0;
    const ctx = new Proxy({}, {
      get: (t, name) => (name in t ? t[name] : name === "fillText" ? (s) => texts.push(s) : name === "ellipse" ? () => shapes++ : () => {}),
      set: (t, name, value) => ((t[name] = value), true),
    });
    const draw = bossIntroArt({ label: (c, text) => c.fillText(text), circle: () => {}, BOSS_ART, drawGourdFire: () => {}, GOLD: "#fc0", BONE: "#eee" });
    assert.doesNotThrow(() => draw(ctx, v));
    assert.ok(shapes > 0, "a silhouette is drawn");
    assert.ok(texts.includes("OLD RATTLEBONES"));
  }
  // A card for a room that holds no boss (or one with no entry) draws nothing and does not throw.
  const draw = bossIntroArt({ label: () => {}, circle: () => {}, BOSS_ART: {}, drawGourdFire: () => {}, GOLD: "#fc0", BONE: "#eee" });
  assert.doesNotThrow(() => draw(fakeCtx([]), { g: { FIELD_W: 96, FIELD_H: 54 }, round: { spec: { boss: null }, introMs: 10 }, bosses: ghoul.BOSSES }));
  assert.doesNotThrow(() => draw(fakeCtx([]), { g: { FIELD_W: 96, FIELD_H: 54 }, round: { spec: { boss: "newfiend" }, introMs: 10 }, bosses: ghoul.BOSSES }));
});

test("Ghoul Rush boss intros: the letters land one after another, each jolting the card, and the heartbeat thumps twice a second apart", () => {
  const lands = [...BOSS_TITLE].map((ch, i) => (ch === " " ? null : landAt(i))).filter((x) => x !== null);
  assert.deepEqual(lands, [...lands].sort((a, b) => a - b));
  assert.ok(lands.at(-1) < 1800, "the title is in before the name");
  assert.equal(shakeAt(0), 0);
  assert.ok(shakeAt(lands[0] + 10) > 0.5, "a jolt on a landing");
  assert.ok(shakeAt(lands[0] + 400) < shakeAt(lands[0] + 10), "which dies away");
  assert.ok(beatAt(0) > 0.9 && beatAt(120) < beatAt(0) && beatAt(200) > beatAt(120), "a thump, then a softer one");
  for (let t = 0; t < 5000; t += 17) assert.ok(beatAt(t) >= 0 && beatAt(t) <= 1.0001 && shakeAt(t) < 6);
});
