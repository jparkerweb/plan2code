// Web console tests, Ghoul Rush's stage intro cards: every stage has one (3 or 4 lines, short, no em dash, never the hero's name), the card shows when a stage is entered and not before the pick, any move key or fire moves it on after the minimum (repeats and early presses never do) and it never moves on by itself, and it draws on a fake canvas.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import { INTROS, MAX_LINE, introFor } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-intros.js";
import { INTRO_HINT, LINE_SIZE, TITLE_SIZE, dropAt, titleLayout } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-intro-draw.js";
import { toneNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
const DASH = String.fromCharCode(0x2014);

function fakeCtx(texts) {
  return new Proxy({}, {
    get: (t, name) => (name in t ? t[name] : name === "fillText" ? (s) => texts.push(s) : () => {}),
    set: (t, name, value) => ((t[name] = value), true),
  });
}

// A round at the stage pick, the offer settled.
function atPick(seed = 3) {
  const r = ghoul.newRound(seed);
  r.dice = 0;
  r.phase = "clear";
  r.phaseMs = 1;
  ghoul.advance(r, 4, steady);
  ghoul.advance(r, ghoul.PICK_HOLD_MS, steady);
  return r;
}

test("Ghoul Rush intros: every stage has a card of 3 or 4 short lines, no em dash, YOU and never Planny", () => {
  const field = ghoul.FIELD_W;
  for (const st of ghoul.STAGES) {
    const info = introFor(st.id);
    assert.ok(info, `${st.id} has an intro`);
    assert.ok(info.title && info.kicker && info.boss, `${st.id} has a title, a kicker and a boss`);
    assert.ok(info.lines.length >= 3 && info.lines.length <= 4, `${st.id} has 3 or 4 lines`);
    assert.ok(/^#[0-9a-f]{6}$/i.test(info.palette.a) && /^#[0-9a-f]{6}$/i.test(info.palette.b) && /^#[0-9a-f]{6}$/i.test(info.palette.glow), `${st.id} has a palette`);
    assert.equal(info.title, st.title, `${st.id} keeps the stage's title`);
    assert.equal(info.kicker, st.sub, `${st.id} keeps the stage's tagline`);
    assert.equal(info.boss, ghoul.BOSSES[st.boss].name, `${st.id} names its boss`);
    const text = [info.title, info.kicker, info.boss, ...info.lines].join("\n");
    assert.ok(!text.includes(DASH), `${st.id} has no em dash`);
    assert.ok(!/planny|the player/i.test(text), `${st.id} never names the hero`);
    assert.ok(info.lines.some((l) => l.includes("YOU")), `${st.id} speaks to YOU`);
    for (const line of info.lines) {
      assert.ok(line.length <= MAX_LINE, `${st.id}: "${line}" is ${line.length} characters`);
      // The same width guess the field's label helper uses (0.62 em a letter).
      assert.ok(line.length * LINE_SIZE * 0.62 <= field - 1, `${st.id}: "${line}" fits the field`);
    }
    const { size, xs } = titleLayout(info.title);
    assert.ok(size > 0 && size <= TITLE_SIZE, `${st.id}'s title has a size`);
    assert.ok(Math.abs(xs[0]) < field / 2 && Math.abs(xs[xs.length - 1]) < field / 2, `${st.id}'s title fits the field`);
  }
  assert.deepEqual(Object.keys(INTROS).sort(), ghoul.STAGES.map((st) => st.id).sort(), "no intro for a stage that does not exist");
  assert.equal(new Set(ghoul.STAGES.flatMap((st) => introFor(st.id).lines)).size, ghoul.STAGES.reduce((n, st) => n + introFor(st.id).lines.length, 0), "no line used twice");
  assert.ok(toneNames().includes("ghoulStageIntro"));
});

test("Ghoul Rush intros: the card shows when a stage is entered and not before the pick, and holds the room back", () => {
  const r = ghoul.newRound(3);
  assert.equal(r.phase, "play", "the hall has no card");
  const p = atPick();
  assert.equal(p.phase, "pick");
  assert.equal(p.events.some((e) => e.type === "intro"), false, "no card before the pick");
  const want = p.offer[p.pick];
  p.events.length = 0;
  assert.equal(ghoul.pickStage(p), true);
  assert.equal(p.phase, "intro");
  assert.deepEqual(p.events.filter((e) => e.type === "intro").map((e) => e.stage), [want]);
  assert.equal(p.events.some((e) => e.type === "room"), false, "the room's announcement waits for the card");
  assert.equal(p.spec.id, ghoul.stageById(want).rooms[0], "the first room is set up behind it");
  // Nothing in the room moves while the card is up.
  const at = p.you.x;
  p.input.right = true;
  ghoul.advance(p, 600, steady);
  assert.equal(p.you.x, at);
  assert.equal(p.phase, "intro");
});

test("Ghoul Rush intros: fire, jump or a click moves on after the minimum, and nothing moves it on alone", () => {
  const p = atPick();
  ghoul.pickStage(p);
  assert.equal(ghoul.takeIntro(p), false, "not at once");
  ghoul.advance(p, ghoul.INTRO_MIN_MS - 50, steady);
  assert.equal(ghoul.takeIntro(p), false, "not before the minimum");
  assert.equal(p.phase, "intro");
  ghoul.advance(p, 60, steady);
  p.events.length = 0;
  assert.equal(ghoul.takeIntro(p), true);
  assert.equal(p.phase, "ready");
  assert.equal(p.phaseMs, ghoul.READY_MS);
  assert.equal(p.events.filter((e) => e.type === "room").length, 1, "the room is announced now");
  ghoul.advance(p, ghoul.READY_MS + 20, steady);
  assert.equal(p.phase, "play");
  // It never advances on its own: not after a minute, not after an hour.
  const q = atPick(5);
  ghoul.pickStage(q);
  for (const ms of [15000, 60000, 3600000]) {
    ghoul.advance(q, ms, steady);
    assert.equal(q.phase, "intro", `still waiting after ${ms} ms more`);
  }
  assert.equal(ghoul.INTRO_MAX_MS, undefined, "the auto-advance timeout is gone");
  assert.ok(ghoul.INTRO_MIN_MS >= 1000 && ghoul.INTRO_MIN_MS <= 2000);
  assert.equal(ghoul.takeIntro(q), true, "a press still works after any wait");
});

test("Ghoul Rush intros: with the window's keys, a held fire never skips it, a fresh press does, and a pause holds it", () => {
  const texts = [];
  const sounds = [];
  const ctx = fakeCtx(texts);
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, tone: (name) => sounds.push(name) });
  g.resize(900, 900);
  g.key("action");
  g.round.dice = 0;
  g.round.phase = "clear";
  g.round.phaseMs = 1;
  for (let ms = 0; ms < ghoul.PICK_HOLD_MS + 200; ms += 16) g.tick(16);
  assert.equal(g.round.phase, "pick");
  g.key("action");
  assert.equal(g.round.phase, "intro");
  for (let k = 0; k < 5; k++) g.key("action", true);
  g.key("action");
  assert.equal(g.round.phase, "intro", "too soon, and repeats never count");
  assert.equal(g.round.input.fire, false, "no shot fired at the card");
  g.tick(16);
  assert.ok(sounds.includes("ghoulStageIntro"), "the stinger plays when the card opens");
  const title = introFor(g.round.stage).title;
  // The card is on screen, paused too.
  for (let ms = 0; ms < 3000; ms += 16) g.tick(16);
  texts.length = 0;
  g.tick(16);
  assert.ok(texts.includes(INTRO_HINT), "the hint shows");
  assert.match(INTRO_HINT, /any move key or fire/);
  assert.ok(title.split("").every((ch) => ch === " " || texts.includes(ch)), "every letter of the title is drawn");
  const line = introFor(g.round.stage).lines[0];
  assert.ok(texts.includes(line), "the flavor text is drawn");
  g.pause();
  const held = g.round.introMs;
  for (let k = 0; k < 20; k++) g.tick(16);
  assert.equal(g.round.introMs, held, "a pause holds the card");
  g.resume();
  g.key("up");
  assert.equal(g.round.phase, "ready", "jump moves on too");
  // Each of the other keys, and fire, moves a card on once the lockout has passed; a repeat or an early press never does.
  for (const name of ["left", "right", "up", "down", "action"]) {
    const k = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    k.resize(900, 900);
    k.key("action");
    k.round.dice = 0;
    k.round.phase = "clear";
    k.round.phaseMs = 1;
    for (let ms = 0; ms < ghoul.PICK_HOLD_MS + 200; ms += 16) k.tick(16);
    k.key("action");
    assert.equal(k.round.phase, "intro", name);
    k.key(name);
    assert.equal(k.round.phase, "intro", `${name}: an early press is ignored`);
    for (let ms = 0; ms < ghoul.INTRO_MIN_MS + 100; ms += 16) k.tick(16);
    k.key(name, true);
    assert.equal(k.round.phase, "intro", `${name}: a repeat is ignored`);
    k.release(name);
    k.key(name);
    assert.equal(k.round.phase, "ready", `${name}: a fresh press moves on`);
    assert.equal(k.round.input.fire, false, "no shot fired at the card");
  }
  // A click works as well.
  const h = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
  h.resize(900, 900);
  h.key("action");
  h.round.dice = 0;
  h.round.phase = "clear";
  h.round.phaseMs = 1;
  for (let ms = 0; ms < ghoul.PICK_HOLD_MS + 200; ms += 16) h.tick(16);
  h.key("action");
  for (let ms = 0; ms < 1300; ms += 16) h.tick(16);
  h.pointer("down", 10, 10);
  assert.equal(h.round.phase, "ready", "a click moves on");
});

test("Ghoul Rush intros: the stage select shows the card on a stage's first room only", () => {
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => fakeCtx([]) } });
  g.resize(900, 900);
  g.key("action");
  const r = g.round;
  r.phase = "select";
  r.select = { at: 3, room: 0 };
  r.practice = true;
  g.key("action");
  assert.equal(r.phase, "intro", "the first room opens on the card");
  assert.equal(r.stage, ghoul.STAGES[3].id);
  const s = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => fakeCtx([]) } });
  s.resize(900, 900);
  s.key("action");
  s.round.phase = "select";
  s.round.select = { at: 3, room: 2 };
  s.round.practice = true;
  s.key("action");
  assert.equal(s.round.phase, "ready", "a room mid-stage has no card");
});

test("Ghoul Rush intros: every card draws on a fake canvas at every moment without throwing", () => {
  for (const st of ghoul.STAGES) {
    const texts = [];
    const ctx = fakeCtx(texts);
    const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    g.resize(900, 900);
    g.key("action");
    g.round.phase = "select";
    g.round.select = { at: ghoul.STAGES.indexOf(st), room: 0 };
    g.key("action");
    assert.equal(g.round.phase, "intro", st.id);
    for (let ms = 0; ms < 5000; ms += 80) {
      g.round.introMs = ms;
      g.tick(1);
    }
    assert.ok(texts.includes(`BOSS: ${introFor(st.id).boss.toUpperCase()}`), `${st.id} names its boss`);
  }
});

test("Ghoul Rush intros: the title's letters fall once and bounce", () => {
  assert.equal(dropAt(-1), 1);
  assert.equal(dropAt(10000), 0);
  assert.ok(dropAt(100) < 1 && dropAt(100) > 0.5);
  let peak = 0;
  for (let t = 330; t < 520; t += 10) peak = Math.max(peak, dropAt(t));
  assert.ok(peak > 0 && peak < 0.2, "one small bounce");
});
