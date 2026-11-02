// Web console tests, Ghoul Rush's game over: a lost end plays the mechanical laugh track (and a win does not), and the "G A M E - O V E R" banner drops in letter by letter and draws on a fake canvas.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul.js";
import { dropAt, gameOverBanner, OVER_WORD } from "../src/web-console/public/activities/ghoul-gameover-draw.js";
import { toneNames } from "../src/web-console/public/tones.js";

function fakeCtx(texts) {
  return new Proxy({}, {
    get: (t, name) => (name in t ? t[name] : name === "fillText" ? (s) => texts.push(s) : () => {}),
    set: (t, name, value) => ((t[name] = value), true),
  });
}

// Clears every stage the way the main suite does.
function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, () => 0.5);
}
function winRun(h) {
  const r = h.round;
  through(r);
  while (!r.over) {
    r.phaseMs = 0;
    ghoul.pickStage(r);
    for (let k = 0; k < 4; k++) through(r);
  }
}

function playTo(end) {
  const sounds = [];
  const texts = [];
  const ctx = fakeCtx(texts);
  const h = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, tone: (name) => sounds.push(name) });
  h.resize(900, 900);
  h.key("action");
  for (let k = 0; k < 40; k++) h.tick(16);
  end(h);
  for (let k = 0; k < 300 && h.state === "running"; k++) h.tick(16);
  return { h, sounds, texts };
}

test("Ghoul Rush: the laugh track is a house tone", () => {
  assert.ok(toneNames().includes("ghoulLaughTrack"));
});

test("Ghoul Rush: a lost end plays the laugh track, a win does not", () => {
  const lost = playTo((h) => {
    h.round.dice = 0;
    h.round.lives = 1;
    ghoul.lose(h.round, "zombie");
  });
  assert.equal(lost.h.state, "over");
  assert.ok(lost.sounds.includes("gameOver") && lost.sounds.includes("ghoulLaughTrack"), "the loss laughs");
  const won = playTo(winRun);
  assert.equal(won.h.state, "over");
  assert.ok(won.sounds.includes("victory") && !won.sounds.includes("ghoulLaughTrack"), "a win stays quiet");
});

test("Ghoul Rush: the game over banner is drawn on a loss only, letter by letter", () => {
  const lost = playTo((h) => {
    h.round.dice = 0;
    h.round.lives = 1;
    ghoul.lose(h.round, "zombie");
  });
  for (let k = 0; k < 200; k++) lost.h.tick(16);
  assert.ok(["ghoulLaughTrack2", "ghoulLaughTrack3"].every((n) => lost.sounds.includes(n)), "the laugh runs on, a second a part");
  assert.equal(lost.sounds.filter((n) => n === "ghoulLaughTrack3").length, 1, "each part plays once");
  lost.texts.length = 0;
  lost.h.tick(16);
  assert.equal(lost.texts.filter((s) => OVER_WORD.includes(s) && s.length === 1).length, OVER_WORD.length * 2, "every letter drawn, shadow and face");
  const won = playTo(winRun);
  won.texts.length = 0;
  won.h.tick(16);
  assert.ok(!won.texts.includes("G"), "no banner on a win");
});

test("Ghoul Rush: a letter falls, bounces once and rests", () => {
  assert.equal(dropAt(-5), 1);
  assert.ok(dropAt(100) < 1 && dropAt(100) > 0.5);
  assert.equal(dropAt(10000), 0);
  let thrown = null;
  try {
    gameOverBanner({ label() {}, BONE: "#fff", DANGER: "#f00" })(fakeCtx([]), { g: { FIELD_W: 96, FIELD_H: 54 }, overMs: 300, clock: 300 });
  } catch (e) {
    thrown = e;
  }
  assert.equal(thrown, null);
});
