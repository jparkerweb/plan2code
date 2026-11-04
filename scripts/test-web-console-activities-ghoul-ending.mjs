// Web console tests, Ghoul Rush's ending: four pages that obey the story's rules (2 to 4 short lines, no digits, no em dash, YOU on each, the gag's FINAL NOTICE); the House's last room opens it instead of the win; a press turns pages only after the lockout and finishes the typing first; holding fire skips it, a tap never does; the last page wins the run once, with n = round.winN; the window's keys, a click, a pause, its track and its sounds; every scene draws on a fake canvas at many moments; every event it raises has a react; every tone it names exists.
// Run with: node --test scripts/test-web-console-activities-ghoul-ending.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { react } from "../src/web-console/public/activities/ghoul-rush/draw/ghoul-draw.js";
import { PAGES as STORY_PAGES } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-story.js";
import {
  CLICK_OFF_MS,
  ENDING_HINT,
  ENDING_LOCK_MS,
  ENDING_TRACK,
  FLAG_MS,
  LAST_HINT,
  LIGHTS_OUT,
  MAX_LINE,
  PAGES,
  RELOCK_MS,
  SKIP_HINT,
  SKIP_HOLD_MS,
  SLIDE_MS,
  STAMP_MS,
  UNFOLD_MS,
  beginEnding,
  pressEnding,
  releaseEnding,
  revealEnd,
  skipEnding,
  stepEnding,
  takeEnding,
} from "../src/web-console/public/activities/ghoul-rush/story/ghoul-ending.js";
import { SCENE_H, TEXT_SIZE, endingArt, roadFlat, windowLit } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-ending-draw.js";
import { compileTrack } from "../src/web-console/public/music.js";
import { toneNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
const DASH = String.fromCharCode(0x2014);
const events = (round, type) => round.events.filter((e) => e.type === type);
const isTone = (name) => toneNames().includes(name) || Object.hasOwn(ghoulSfx.tones, name);

function fakeCtx(texts) {
  return new Proxy({}, {
    get: (t, name) => (name in t ? t[name] : name === "fillText" ? (s) => texts.push(String(s)) : () => {}),
    set: (t, name, value) => ((t[name] = value), true),
  });
}

function through(round) {
  round.phase = "clear";
  round.phaseMs = 1;
  ghoul.advance(round, 4, steady);
}

// A round walked through the hall and every stage to the House, then through each of the finale's rooms until the ending opens.
function toEnding(seed = 4) {
  const round = ghoul.newRound(seed);
  round.dice = 0;
  through(round);
  round.cleared = ghoul.STAGES.slice(0, ghoul.RUN_STAGES).map((st) => st.id);
  round.offer = null;
  through(round);
  assert.equal(round.stage, ghoul.FINALE.id, "the House");
  for (let k = 0; k < 20 && round.phase !== "ending"; k++) through(round);
  assert.equal(round.phase, "ending", "the House's last room opens the ending");
  return round;
}

// A window game in the ending, from the stage select's last entry (the House), and its sounds.
function openGame() {
  const texts = [];
  const sounds = [];
  const tracks = [];
  const ctx = fakeCtx(texts);
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, tone: (name) => sounds.push(name), music: (name) => tracks.push(name) });
  g.resize(900, 900);
  g.stageSelect();
  for (let i = 0; i < ghoul.SELECTABLE.length; i++) g.key("down");
  g.key("action");
  assert.equal(g.round.stage, ghoul.FINALE.id);
  for (let k = 0; k < 20 && g.round.phase !== "ending"; k++) through(g.round);
  assert.equal(g.round.phase, "ending");
  g.tick(16);
  return { g, texts, sounds, tracks };
}
const tick = (g, ms) => {
  for (let t = 0; t < ms; t += 16) g.tick(16);
};
const lock = (g) => tick(g, ENDING_LOCK_MS + 20);
// To the point the page can turn: its typing done and its scene played out.
const playedOut = (pg) => Math.max(revealEnd(pg), pg.wait);
const typedOut = (g) => tick(g, playedOut(PAGES[g.round.ending.page]) - g.round.ending.ms + 40);

test("Ghoul Rush ending: four pages, 2 to 4 short lines each that fit the field, no digits, no em dash, never the hero's name, YOU on every page", () => {
  assert.equal(PAGES.length, 4);
  assert.deepEqual(PAGES.map((p) => p.chapter), ["LIGHTS OUT", "THE ROAD", "MORNING", "FINAL NOTICE"]);
  assert.equal(new Set(PAGES.map((p) => p.id)).size, PAGES.length, "unique ids");
  for (const p of PAGES) {
    assert.ok(p.chapter && p.scene && p.pal.sky && p.pal.ground && p.pal.a && p.pal.glow, `${p.id} has a heading, a scene and colors`);
    assert.ok(p.lines.length >= 2 && p.lines.length <= 4, `${p.id} has 2 to 4 lines`);
    const text = [p.chapter, ...p.lines].join("\n");
    assert.ok(!text.includes(DASH), `${p.id} has no em dash`);
    assert.ok(!/\d/.test(text), `${p.id} has no digit`);
    assert.ok(!/planny|the player|the hero|\bhero\b/i.test(text), `${p.id} never names the hero`);
    assert.ok(/\bYOU\b/.test(p.lines.join(" ")), `${p.id} speaks to YOU`);
    for (const line of p.lines) {
      assert.ok(line.length <= MAX_LINE, `${p.id}: "${line}" is ${line.length} characters`);
      assert.ok(line.length * TEXT_SIZE * 0.62 <= ghoul.FIELD_W - 1, `${p.id}: "${line}" fits the field`);
    }
    for (const [at, name, vol, rate] of p.cues) {
      assert.ok(at >= 0 && at < 9000 && vol > 0 && vol <= 1 && rate > 0, `${p.id}: a cue is timed and audible`);
      assert.ok(isTone(name), `${p.id}: ${name} is a tone`);
    }
    assert.ok(p.cues.every((c, i) => i === 0 || c[0] >= p.cues[i - 1][0]), `${p.id}: its cues are in order`);
  }
  const lines = PAGES.flatMap((p) => p.lines);
  assert.equal(new Set(lines).size, lines.length, "no line used twice");
  const story = new Set(STORY_PAGES.flatMap((p) => p.lines));
  assert.ok(lines.every((l) => !story.has(l)), "no line copied from the intro story");
  const all = lines.join("\n");
  assert.ok(all.includes("FINAL NOTICE") && /unpaid bills/.test(all), "the mailbox gag lands");
  assert.ok(/unfolds/.test(all) && /cottage/.test(all), "the road and the cottage it was once");
  assert.equal(ENDING_TRACK, "ghoulMarrowEnding");
});

test("Ghoul Rush ending: the scene timings agree with the cues (a falling tone per window, the click, the flag, the slide, the stamp)", () => {
  const lights = PAGES[0].cues.filter(([, n]) => n === "ghoulEndingWindow" || n === "ghoulEndingLast");
  assert.deepEqual(lights.map(([ms]) => ms), LIGHTS_OUT.map(([, ms]) => ms), "a tone as each window goes out");
  assert.equal(lights.at(-1)[1], "ghoulEndingLast", "the last window has its own tone");
  const rates = lights.slice(0, -1).map((c) => c[3]);
  assert.ok(rates.every((r, i) => i === 0 || r < rates[i - 1]), "each window's tone a little lower");
  assert.equal(new Set(LIGHTS_OUT.map(([i]) => i)).size, 10, "every one of the house's ten windows goes out");
  assert.ok(LIGHTS_OUT.at(-1)[1] - LIGHTS_OUT.at(-2)[1] >= 1000, "a long breath before the last");
  for (const [i, ms] of LIGHTS_OUT) {
    assert.equal(windowLit(i, ms - 1), 1);
    assert.equal(windowLit(i, ms + 2000), 0);
  }
  assert.equal(roadFlat(0, 0), 0, "the road starts folded");
  assert.equal(roadFlat(0, 20000), 1, "and ends flat");
  assert.ok(roadFlat(10, UNFOLD_MS + 600) > roadFlat(0, UNFOLD_MS + 600), "it unfolds from the far end toward YOU");
  const cue = (pg, name) => PAGES[pg].cues.find(([, n]) => n === name)?.[0];
  assert.equal(cue(1, "ghoulEndingClickOff"), CLICK_OFF_MS);
  assert.equal(cue(1, "ghoulEndingFold"), UNFOLD_MS);
  assert.equal(cue(3, "ghoulEndingFlag"), FLAG_MS);
  assert.equal(cue(3, "ghoulEndingPaper"), SLIDE_MS);
  assert.equal(cue(3, "ghoulEndingStamp"), STAMP_MS);
});

test("Ghoul Rush ending: the House's end opens it instead of the win, and nothing else moves while it is up", () => {
  const round = toEnding();
  assert.equal(round.won, false, "not won yet");
  assert.equal(round.over, false);
  assert.equal(round.winN, ghoul.RUN_STAGES + 1);
  assert.equal(events(round, "won").length, 0);
  assert.deepEqual(events(round, "endingPage").map((e) => e.page), [0]);
  assert.equal(round.ending.page, 0);
  round.input.right = true;
  const x = round.you.x;
  const clock = round.clock;
  ghoul.advance(round, 2000, steady);
  assert.equal(round.you.x, x, "YOU stay put");
  assert.equal(round.clock, clock, "the room's clock holds");
  assert.equal(round.phase, "ending");
  assert.ok(round.ending.ms >= 2000);
  assert.equal(beginEnding({ ...round, events: [], input: {} }), true, "beginEnding says there is an ending");
});

test("Ghoul Rush ending: a press turns a page only after the lockout, typing finishes first, and the last page wins the run once with n = winN", () => {
  const round = toEnding();
  round.events.length = 0;
  assert.equal(takeEnding(round), false, "not at once");
  ghoul.advance(round, ENDING_LOCK_MS - 40, steady);
  assert.equal(takeEnding(round), false, "not before the lockout");
  ghoul.advance(round, 60, steady);
  assert.ok(round.ending.ms < revealEnd(PAGES[0]));
  assert.equal(takeEnding(round), true);
  assert.equal(round.ending.page, 0, "the first press finishes the typing");
  assert.equal(round.ending.full, true);
  assert.equal(takeEnding(round), false, "a press right on top of it does not count");
  ghoul.advance(round, RELOCK_MS + 20, steady);
  assert.equal(takeEnding(round), false, "the page waits for its scene to play out (the last window)");
  assert.equal(round.ending.page, 0);
  ghoul.advance(round, PAGES[0].wait - round.ending.ms + 10, steady);
  assert.ok(round.ending.ms >= LIGHTS_OUT.at(-1)[1], "every window is out by then");
  assert.equal(takeEnding(round), true);
  assert.equal(round.ending.page, 1, "now the page turns");
  assert.equal(round.ending.ms, 0);
  assert.equal(takeEnding(round), false, "each page has its own lockout");
  for (let at = 1; at < PAGES.length; at++) {
    assert.equal(round.ending.page, at);
    assert.equal(round.won, false, `not won on page ${at + 1}`);
    ghoul.advance(round, playedOut(PAGES[at]) + 20, steady);
    assert.equal(takeEnding(round), true);
  }
  assert.deepEqual(events(round, "endingPage").map((e) => e.page), [1, 2, 3]);
  assert.equal(round.won, true, "the last page's press wins");
  assert.equal(round.over, true);
  assert.equal(round.ending, null);
  assert.notEqual(round.phase, "ending");
  assert.deepEqual(events(round, "won"), [{ type: "won", stages: round.cleared.length, n: ghoul.RUN_STAGES + 1 }]);
  assert.equal(takeEnding(round), false, "nothing to take after");
  assert.equal(skipEnding(round), false, "nothing to skip after");
  ghoul.advance(round, 2000, steady);
  assert.equal(events(round, "won").length, 1, "the won event fires once");
});

test("Ghoul Rush ending: holding fire for a second skips it all on any page, a tap or a short hold does not, and a skip always works", () => {
  const r = toEnding();
  assert.equal(pressEnding(r, true), false, "a repeat is nothing");
  assert.equal(r.ending.hold, -1);
  assert.equal(pressEnding(r, false), true);
  assert.equal(r.ending.hold, 0, "a fresh press starts the clock");
  stepEnding(r, SKIP_HOLD_MS - 50);
  assert.equal(r.phase, "ending");
  releaseEnding(r);
  assert.equal(r.ending.hold, -1, "let go stops the clock");
  stepEnding(r, 3000);
  assert.equal(r.phase, "ending");
  pressEnding(r, false);
  stepEnding(r, SKIP_HOLD_MS + 10);
  assert.equal(r.won, true, "the hold skipped it all");
  assert.equal(r.over, true);
  assert.equal(events(r, "won").length, 1);
  // A skip from any page.
  for (let at = 0; at < PAGES.length; at++) {
    const s = toEnding(at + 7);
    s.ending.page = at;
    assert.equal(skipEnding(s), true);
    assert.equal(s.won, true);
    assert.equal(events(s, "won")[0].n, s.winN);
  }
  assert.equal(skipEnding(ghoul.newRound(1)), false, "no ending, nothing to skip");
});

test("Ghoul Rush ending: the window's keys, any move and fire alike, turn pages; repeats and early presses never do; a click does; a pause holds it", () => {
  for (const name of ["left", "right", "up", "down", "action"]) {
    const { g } = openGame();
    g.key(name);
    assert.equal(g.round.ending.full, false, `${name}: early press ignored`);
    g.release(name);
    lock(g);
    g.key(name, true);
    assert.equal(g.round.ending.full, false, `${name}: a repeat is ignored`);
    g.key(name);
    assert.equal(g.round.ending.full, true, `${name}: a fresh press finishes the typing first`);
    g.release(name);
    typedOut(g);
    g.key(name);
    assert.equal(g.round.ending.page, 1, `${name}: the next press turns it`);
    g.release(name);
    assert.equal(g.round.input.fire || g.round.input.left || g.round.input.right || g.round.input.up || g.round.input.down, false, `${name}: nothing is kept held`);
  }
  const { g } = openGame();
  lock(g);
  g.pointer("down", 10, 10);
  assert.equal(g.round.ending.full, true, "a click finishes the typing");
  typedOut(g);
  g.pointer("down", 10, 10);
  assert.equal(g.round.ending.page, 1, "and the next click turns the page");
  g.pause();
  const held = g.round.ending.ms;
  tick(g, 2000);
  assert.equal(g.round.ending.ms, held, "a pause holds the page's clock");
  g.key("action");
  assert.equal(g.round.ending.hold, -1, "no key counts while paused");
  g.resume();
  tick(g, 100);
  assert.ok(g.round.ending.ms > held);
});

test("Ghoul Rush ending: through every page on a real clock to the end screen, with its track, its tones, page turns and the escape", () => {
  const { g, texts, sounds, tracks } = openGame();
  tick(g, 1300);
  assert.ok(tracks.length && tracks.every((t) => t === ENDING_TRACK), "only the ending's track plays under it");
  assert.ok(sounds.includes("ghoulEndingHush") && sounds.includes("ghoulEndingWindow"), "the first page's tones play");
  let guard = 0;
  while (g.state === "running" && guard++ < 20) {
    typedOut(g);
    tick(g, RELOCK_MS + 40);
    g.key("right");
    g.release("right");
    tick(g, 16);
  }
  assert.equal(g.state, "over");
  assert.equal(g.round.won, true);
  assert.ok(sounds.includes("ghoulStoryPage"), "a page turn rustles");
  for (const n of ["ghoulEndingFold", "ghoulEndingClickOff", "ghoulEndingBird", "ghoulEndingFlag", "ghoulEndingStamp"]) assert.ok(sounds.includes(n), `${n} played`);
  texts.length = 0;
  g.resize(900, 900);
  assert.ok(texts.some((t) => t.startsWith("You escaped! Marrow starves")), "the end screen follows");
  // Held fire skips it in the window too.
  const { g: h } = openGame();
  for (let k = 0; k < 20; k++) h.key("action", true);
  tick(h, 2000);
  assert.equal(h.round.phase, "ending", "a held key from before never skips");
  h.key("action");
  h.key("action", true);
  tick(h, SKIP_HOLD_MS + 100);
  assert.equal(h.state, "over");
  assert.equal(h.round.won, true);
});

test("Ghoul Rush ending: every scene draws on a fake canvas at many moments, with its heading, hints and lines, without throwing", () => {
  const { g, texts } = openGame();
  for (let at = 0; at < PAGES.length; at++) {
    for (const ms of [0, 1, 120, 600, 900, 1100, 1500, 2300, 2900, 3100, 4000, 4600, 5200, 6200, 6500, 8000, 12000, 40000]) {
      for (const full of [false, true]) {
        for (const hold of [-1, 500]) {
          g.round.ending = { page: at, ms, full, arm: 0, hold, cue: 99, shown: 0, back: "clear" };
          g.tick(1);
        }
      }
    }
    g.round.ending = { page: at, ms: 100, full: false, arm: 0, hold: -1, cue: 99, shown: 0, back: "clear" };
    texts.length = 0;
    g.tick(1);
    assert.ok(texts.includes(SKIP_HINT.toUpperCase()), `page ${at + 1} shows how to skip`);
    assert.equal(texts.includes(ENDING_HINT) || texts.includes(LAST_HINT), false, "no continue hint inside the lockout");
    if (PAGES[at].wait) {
      g.round.ending.ms = PAGES[at].wait - 100;
      g.round.ending.full = true;
      texts.length = 0;
      g.tick(1);
      assert.equal(texts.includes(ENDING_HINT) || texts.includes(LAST_HINT), false, `page ${at + 1}: no continue hint while its scene plays out`);
    }
    g.round.ending.ms = 60000;
    g.round.ending.full = true;
    texts.length = 0;
    g.tick(1);
    assert.ok(texts.includes(PAGES[at].chapter), `page ${at + 1} draws its heading`);
    assert.ok(texts.includes(at === PAGES.length - 1 ? LAST_HINT : ENDING_HINT), `page ${at + 1} shows the continue hint`);
    for (const line of PAGES[at].lines) assert.ok(texts.includes(line), `page ${at + 1}: "${line}" is drawn in full`);
  }
  assert.ok(texts.includes("FINAL NOTICE"), "the stamp reads FINAL NOTICE");
  assert.ok(SCENE_H > 20 && SCENE_H < 40, "the scene keeps to the top of the field");
  // The art alone, with no ending: draws nothing and does not throw.
  const art = endingArt({ label() {}, GOLD: "#fc0", BONE: "#eee" });
  art.card(fakeCtx([]), { round: { ending: null } });
});

test("Ghoul Rush ending: every event it raises has a react, its own react answers only its own events, and every tone it owns is a real, prefixed sound", () => {
  const round = toEnding();
  const s = round.ending;
  for (let at = 0; at < PAGES.length; at++) {
    s.page = at;
    s.ms = 0;
    s.cue = 0;
    s.full = false;
    stepEnding(round, 10000);
    s.arm = 0;
    takeEnding(round);
  }
  skipEnding(round);
  const kinds = new Set(round.events.map((e) => e.type));
  for (const kind of ["endingPage", "storyTone", "won"]) assert.ok(kinds.has(kind), `${kind} is raised`);
  const played = [];
  const marks = [];
  const fx = { tone: (n) => played.push(n), burst() {}, float() {}, ring() {}, banner: () => ({}), shake() {}, flash() {}, glow() {}, splat() {}, fx: { clock: 0, banners: [] }, markFurthest: (n) => marks.push(n), roomBanner() {}, monsters: {}, powers: {}, bosses: {}, g: ghoul };
  for (const e of round.events) {
    if (!["endingPage", "storyTone", "won"].includes(e.type)) continue;
    react(e, fx);
  }
  assert.ok(played.includes("ghoulStoryPage"), "a page turn plays its rustle");
  assert.ok(played.includes("ghoulEndingWindow") && played.includes("ghoulEndingGag"), "the timed tones play through the story's own event");
  assert.deepEqual(marks, [ghoul.RUN_STAGES + 1], "the win marks the House beaten");
  const art = endingArt({ label() {}, GOLD: "#fc0", BONE: "#eee" });
  const k = { tone() {} };
  assert.equal(art.react({ type: "endingPage", page: 1 }, k), true);
  for (const type of ["won", "storyTone", "storyPage", "kill", "hit", "room"]) assert.equal(art.react({ type }, k), false, `${type} is not its own`);
  const own = Object.keys(ghoulSfx.tones).filter((n) => n.startsWith("ghoulEnding"));
  assert.ok(own.length >= 10, "a handful of the ending's own tones");
  for (const p of PAGES) for (const [, name] of p.cues) assert.ok(isTone(name), `${name} exists`);
  const track = ghoulSfx.music[ENDING_TRACK];
  assert.ok(track, "the ending's track is in the game's music");
  const song = compileTrack(track);
  assert.ok(song.length >= 64, "it runs a few bars");
  // The user's pick (eighties horror end credits): a steady middle tempo, never a race.
  assert.ok(track.bpm >= 84 && track.bpm <= 120, "a middle tempo");
  assert.equal(track.rush || 0, 0, "it never races");
});
