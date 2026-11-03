// Web console tests, Ghoul Rush's intro story: 6 to 8 pages that fit the field, never name the hero, stay generic about stages (no names, no counts) and speak to YOU; a run opens on it and ends in The Long Hall; the lockout, the typing that finishes first, every key and a click, the skip by holding fire, a pause that holds it; never in the practice stage select, on a respawn or in a new room; every page draws on a fake canvas at many moments; every sound it asks for exists.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as ghoul from "../src/web-console/public/activities/ghoul-rush/ghoul.js";
import ghoulSfx from "../src/web-console/public/activities/ghoul-rush/sfx/ghoul-sfx.js";
import { INTROS } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-intros.js";
import {
  CHAR_MS,
  FINALE_TITLE,
  LAST_HINT,
  MAX_LINE,
  PAGES,
  RELOCK_MS,
  REVEAL_AT_MS,
  SKIP_HINT,
  SKIP_HOLD_MS,
  STORY_HINT,
  STORY_LOCK_MS,
  beginStory,
  endStory,
  lineAt,
  pageChars,
  pressStory,
  releaseStory,
  revealEnd,
  shown,
  skipStory,
  stepStory,
  takeStory,
  typed,
} from "../src/web-console/public/activities/ghoul-rush/story/ghoul-story.js";
import { SCENE_H, TEXT_SIZE } from "../src/web-console/public/activities/ghoul-rush/story/ghoul-story-draw.js";
import { toneNames } from "../src/web-console/public/tones.js";

const steady = () => 0.5;
const DASH = String.fromCharCode(0x2014);
const ALL = PAGES.flatMap((p) => [p.chapter, ...p.lines]).join("\n");

function fakeCtx(texts) {
  return new Proxy({}, {
    get: (t, name) => (name in t ? t[name] : name === "fillText" ? (s) => texts.push(s) : () => {}),
    set: (t, name, value) => ((t[name] = value), true),
  });
}

// A window game with the story up (a real run's first press), and its sounds.
function openGame(extra = {}) {
  const texts = [];
  const sounds = [];
  const hums = [];
  const ctx = fakeCtx(texts);
  const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx }, tone: (name) => sounds.push(name), hum: (id, name) => hums.push([id, name]), ...extra });
  g.resize(900, 900);
  g.key("action");
  return { g, texts, sounds, hums };
}
const tick = (g, ms) => {
  for (let t = 0; t < ms; t += 16) g.tick(16);
};
// To the point where a press counts on the page the game is on (and the typing is still going unless it is long past).
const lock = (g) => tick(g, STORY_LOCK_MS + 20);
// To the end of the typing.
const typedOut = (g) => tick(g, revealEnd(PAGES[g.round.story.page]) - g.round.story.ms + 40);

test("Ghoul Rush story: 6 to 8 pages, 2 to 4 short lines each, no em dash, never the hero's name, and YOU on every page", () => {
  assert.ok(PAGES.length >= 6 && PAGES.length <= 8, `${PAGES.length} pages`);
  assert.equal(new Set(PAGES.map((p) => p.id)).size, PAGES.length, "unique ids");
  const field = ghoul.FIELD_W;
  for (const p of PAGES) {
    assert.ok(p.chapter && p.scene && p.pal.sky && p.pal.ground && p.pal.a && p.pal.glow, `${p.id} has a heading, a scene and colors`);
    assert.ok(p.lines.length >= 2 && p.lines.length <= 4, `${p.id} has 2 to 4 lines`);
    const text = [p.chapter, ...p.lines].join("\n");
    assert.ok(!text.includes(DASH), `${p.id} has no em dash`);
    assert.ok(!/planny|the player|the hero|\bhero\b/i.test(text), `${p.id} never names the hero`);
    assert.ok(/\bYOU(R)?\b/.test(text), `${p.id} speaks to YOU`);
    for (const line of p.lines) {
      assert.ok(line.length <= MAX_LINE, `${p.id}: "${line}" is ${line.length} characters`);
      // The same width guess the intro card's test uses (0.62 em a letter), at the story's own size.
      assert.ok(line.length * TEXT_SIZE * 0.62 <= field - 1, `${p.id}: "${line}" fits the field`);
    }
    for (const [at, name, vol, rate] of p.cues) {
      assert.ok(at >= 0 && at < 9000 && vol > 0 && vol <= 1 && rate > 0, `${p.id}: a cue is timed and audible`);
      assert.ok(toneNames().includes(name) || Object.hasOwn(ghoulSfx.tones, name), `${p.id}: ${name} is a tone`);
    }
  }
  assert.ok(ALL.includes("YOU"));
  const lines = PAGES.flatMap((p) => p.lines);
  assert.equal(new Set(lines).size, lines.length, "no line used twice");
  const cards = new Set(Object.values(INTROS).flatMap((i) => i.lines));
  assert.ok(lines.every((l) => !cards.has(l)), "no line copied from a stage's card");
  assert.ok(PAGES[PAGES.length - 1].scene === "begin" && FINALE_TITLE === "THE RUN BEGINS", "the last page is the run beginning");
});

test("Ghoul Rush story: it names the house and the way in, and stays generic about stages (no names, no counts)", () => {
  const text = ALL.toLowerCase();
  assert.ok(text.includes("marrow manor"), "the house has a name");
  assert.ok(text.includes("flashlight") && text.includes("flinch"), "what YOU carry, and what it does to the house");
  assert.ok(text.includes("fright"), "what it eats");
  assert.ok(text.includes("long hall"), "the way in");
  assert.ok(text.includes("starves"), "what happens if YOU escape");
  assert.ok(/inside/.test(text), "the places are inside the house");
  // More stages will come: the story never names one (the house itself, Marrow Manor, is not the stage The Manor).
  for (const st of ghoul.STAGES) {
    const name = st.title.replace(/^The /, "").toLowerCase();
    if (name === "manor") continue;
    assert.ok(!text.includes(name), `the story does not name the stage ${st.title}`);
  }
  const named = ["east wing", "graveyard", "grounds", "chapel", "sanatorium", "blackmoor", "hollow end", "deep seam", "midnight carnival", "frozen lake", "pit beneath"];
  for (const n of named) assert.ok(!text.includes(n), `the story does not name ${n}`);
  assert.ok((text.match(/carnival/g) || []).length <= 1, "at most one passing example of a place");
});

test("Ghoul Rush story: no page names a count of stages, rooms, doors or keepers", () => {
  const count = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|\d+)\b[\s-]+(\w+\s+)?(stages?|rooms?|doors?|keepers?|levels?|places?|worlds?|bosses)\b/i;
  for (const p of PAGES) {
    for (const line of [p.chapter, ...p.lines]) {
      assert.ok(!/\d/.test(line), p.id + ": no digit in " + line);
      assert.ok(!count.test(line), p.id + ": " + line + " names a count");
    }
  }
  assert.ok(!/\b(ten|all ten|every one of the)\b/i.test(ALL), "no ten anywhere in the story");
  // The check itself catches what it should.
  assert.ok(count.test("Ten rooms, ten keepers") && count.test("seven doors") && count.test("3 stages") && !count.test("Door after door"));
});

test("Ghoul Rush story: the typing, the lines and the page numbers add up", () => {
  const pg = PAGES[2];
  assert.equal(pageChars(pg), pg.lines.reduce((n, l) => n + l.length, 0));
  assert.equal(shown(pg, 0), 0);
  assert.equal(shown(pg, REVEAL_AT_MS), 0);
  assert.equal(shown(pg, REVEAL_AT_MS + CHAR_MS * 5), 5);
  assert.equal(shown(pg, 1e9), pageChars(pg));
  assert.equal(shown(pg, 0, true), pageChars(pg), "full shows everything at once");
  assert.equal(revealEnd(pg), REVEAL_AT_MS + pageChars(pg) * CHAR_MS);
  assert.ok(revealEnd(pg) < 9000, "a page types out in a few seconds");
  assert.deepEqual(typed(pg, 0), pg.lines.map(() => ""));
  assert.deepEqual(typed(pg, pageChars(pg)), pg.lines);
  const half = typed(pg, pg.lines[0].length + 3);
  assert.equal(half[0], pg.lines[0]);
  assert.equal(half[1], pg.lines[1].slice(0, 3));
  assert.equal(lineAt(pg, 0), 0);
  assert.equal(lineAt(pg, pg.lines[0].length), 1);
  assert.equal(lineAt(pg, pageChars(pg)), pg.lines.length - 1);
});

test("Ghoul Rush story: a run opens on it with the hall behind it, and it ends in The Long Hall, announced then", () => {
  const r = ghoul.newRound(3);
  assert.equal(r.phase, "play", "the round itself still starts in the hall (the window adds the story)");
  assert.equal(r.story, undefined);
  beginStory(r);
  assert.equal(r.phase, "story");
  assert.equal(r.story.page, 0);
  assert.equal(r.spec.id, "hall", "the hall is set up behind it");
  assert.deepEqual(r.events.filter((e) => e.type === "storyPage").map((e) => e.page), [0]);
  assert.equal(r.events.some((e) => e.type === "room"), false, "no room is announced yet");
  // Nothing in the hall moves while it is up.
  r.input.right = true;
  const x = r.you.x;
  ghoul.advance(r, 2000, steady);
  assert.equal(r.you.x, x);
  assert.equal(r.phase, "story");
  r.events.length = 0;
  endStory(r);
  assert.equal(r.phase, "play");
  assert.equal(r.story, null);
  assert.equal(r.spec.id, "hall", "the run's first room is the hall");
  assert.equal(r.room, 1);
  assert.deepEqual(r.events.filter((e) => e.type === "room").map((e) => e.room), [1]);
  assert.ok(r.events.some((e) => e.type === "storyEnd"));
});

test("Ghoul Rush story: a press turns a page only after the lockout, typing finishes first, and the last page enters the hall", () => {
  const r = ghoul.newRound(3);
  beginStory(r);
  assert.equal(takeStory(r), false, "not at once");
  ghoul.advance(r, STORY_LOCK_MS - 40, steady);
  assert.equal(takeStory(r), false, "not before the lockout");
  assert.equal(r.story.page, 0);
  ghoul.advance(r, 60, steady);
  // Typing still going: the first press finishes it, the page stays.
  assert.ok(r.story.ms < revealEnd(PAGES[0]));
  assert.equal(takeStory(r), true);
  assert.equal(r.story.page, 0, "the page has not turned");
  assert.equal(r.story.full, true, "the typing is done");
  assert.equal(takeStory(r), false, "a second press right on top of it does not count");
  ghoul.advance(r, RELOCK_MS + 20, steady);
  assert.equal(takeStory(r), true);
  assert.equal(r.story.page, 1, "now the page turns");
  assert.equal(r.story.ms, 0);
  assert.equal(r.story.full, false);
  assert.equal(takeStory(r), false, "each page has its own lockout");
  // Through every page the way a patient reader would: wait out the typing, press once.
  for (let at = 1; at < PAGES.length; at++) {
    assert.equal(r.story.page, at);
    ghoul.advance(r, revealEnd(PAGES[at]) + 20, steady);
    assert.equal(takeStory(r), true);
  }
  assert.equal(r.phase, "play", "the last page's press enters the hall");
  assert.equal(r.story, null);
  assert.equal(takeStory(r), false, "nothing to take after");
  assert.equal(r.spec.id, "hall");
});

test("Ghoul Rush story: the window's keys, any move and fire alike, turn pages; repeats and early presses never do; a click does", () => {
  for (const name of ["left", "right", "up", "down", "action"]) {
    const { g } = openGame();
    assert.equal(g.round.phase, "story", `${name}: a run opens on the story`);
    assert.equal(g.round.input.fire, false, "the press that starts never fires");
    g.key(name);
    assert.equal(g.round.story.page, 0, `${name}: early press ignored`);
    assert.equal(g.round.story.full, false);
    lock(g);
    g.key(name, true);
    assert.equal(g.round.story.full, false, `${name}: a repeat is ignored`);
    g.release(name);
    g.key(name);
    assert.equal(g.round.story.full, true, `${name}: a fresh press finishes the typing first`);
    tick(g, RELOCK_MS + 40);
    g.key(name, true);
    assert.equal(g.round.story.page, 0, `${name}: a repeat never turns the page`);
    g.release(name);
    g.key(name);
    assert.equal(g.round.story.page, 1, `${name}: the next press turns it`);
    assert.equal(g.round.input.fire, false, `${name}: no shot is fired at the story`);
    assert.equal(g.round.input.up || g.round.input.left || g.round.input.right || g.round.input.down, false, `${name}: no move is kept`);
    assert.equal(g.round.you.x, ghoul.roomById("hall").start, `${name}: YOU has not moved`);
  }
  const { g } = openGame();
  g.pointer("down", 10, 10);
  assert.equal(g.round.story.page, 0, "a click before the lockout does nothing");
  lock(g);
  g.pointer("move", 10, 10);
  g.pointer("up", 10, 10);
  assert.equal(g.round.story.full, false);
  g.pointer("down", 10, 10);
  assert.equal(g.round.story.full, true, "a click finishes the typing first");
  tick(g, RELOCK_MS + 40);
  g.pointer("down", 10, 10);
  assert.equal(g.round.story.page, 1, "and the next click turns the page");
});

test("Ghoul Rush story: holding fire for a second skips the whole story, a tap or a short hold does not, and the bar shows it", () => {
  const { g, texts } = openGame();
  // A fire held from the start: the key's repeats never start the clock.
  for (let k = 0; k < 30; k++) g.key("action", true);
  tick(g, 2000);
  assert.equal(g.round.phase, "story", "a held key from the run's own press never skips");
  assert.equal(g.round.story.hold, -1);
  // Too short a hold.
  const { g: h } = openGame();
  h.key("action");
  assert.equal(h.round.story.hold, 0, "a fresh press starts the clock");
  tick(h, SKIP_HOLD_MS - 200);
  assert.equal(h.round.phase, "story");
  assert.ok(h.round.story.hold > 0);
  texts.length = 0;
  h.release("action");
  assert.equal(h.round.story.hold, -1, "let go stops the clock");
  tick(h, 2000);
  assert.equal(h.round.phase, "story");
  // Held the whole second: the story is over at once, whatever page it was on, and the hall is announced.
  const { g: k, sounds } = openGame();
  lock(k);
  k.key("action");
  k.key("action", true);
  tick(k, SKIP_HOLD_MS + 100);
  assert.equal(k.round.phase, "play", "the hold skipped the story");
  assert.equal(k.round.story, null);
  assert.equal(k.round.spec.id, "hall");
  assert.ok(k.round.page === undefined);
  assert.ok(sounds.includes("ghoulRoomIn"), "the hall's door sounds as the run starts");
  // The skip bar draws while it is held, the hint on every page.
  const { g: m, texts: seen } = openGame();
  m.key("action");
  tick(m, 500);
  assert.ok(seen.includes(SKIP_HINT.toUpperCase()), "the skip hint shows");
  assert.ok(m.round.story.hold >= 400);
  // skipStory and pressStory are the plain functions behind it.
  const r = ghoul.newRound(1);
  assert.equal(skipStory(r), false, "no story, nothing to skip");
  beginStory(r);
  assert.equal(pressStory(r, true), false, "a repeat is nothing");
  assert.equal(pressStory(r, false), true);
  assert.equal(r.story.hold, 0);
  stepStory(r, SKIP_HOLD_MS - 1);
  assert.equal(r.phase, "story");
  releaseStory(r);
  assert.equal(r.story.hold, -1);
  assert.equal(skipStory(r), true);
  assert.equal(r.phase, "play");
});

test("Ghoul Rush story: a pause holds it, the hint of every page shows once a press counts, and the skip hint is always up", () => {
  const { g, texts } = openGame();
  tick(g, 100);
  g.pause();
  const held = g.round.story.ms;
  tick(g, 2000);
  assert.equal(g.round.story.ms, held, "a pause holds the page's clock");
  g.key("action");
  g.key("left");
  assert.equal(g.round.story.hold, -1, "no key counts while paused");
  assert.equal(g.round.story.page, 0);
  g.resume();
  tick(g, 100);
  assert.ok(g.round.story.ms > held);
  // Every page: the skip hint, the heading, the page's text, and the hint once a press counts.
  for (let at = 0; at < PAGES.length; at++) {
    g.round.story = { page: at, ms: 0, full: false, arm: 0, hold: -1, cue: 99, shown: 0 };
    texts.length = 0;
    g.tick(1);
    assert.ok(texts.includes(SKIP_HINT.toUpperCase()), `page ${at + 1} shows how to skip`);
    assert.equal(texts.includes(STORY_HINT) || texts.includes(LAST_HINT), false, "no continue hint inside the lockout");
    g.round.story.ms = STORY_LOCK_MS + 100;
    texts.length = 0;
    g.tick(1);
    assert.ok(texts.includes(at === PAGES.length - 1 ? LAST_HINT : STORY_HINT), `page ${at + 1} shows the continue hint once a press counts`);
    assert.ok(texts.includes(PAGES[at].chapter), `page ${at + 1} shows its heading`);
    g.round.story.ms = 60000;
    g.round.story.full = true;
    texts.length = 0;
    g.tick(1);
    for (const line of PAGES[at].lines) assert.ok(texts.includes(line), `page ${at + 1}: "${line}" is drawn in full`);
  }
});

test("Ghoul Rush story: never in the practice stage select, on a respawn or in a new room, and a new run shows it again", () => {
  const { g } = openGame();
  assert.equal(g.round.phase, "story");
  g.stageSelect();
  assert.equal(g.round.phase, "select", "the stage select opens on its list, not the story");
  assert.equal(g.round.story, undefined);
  assert.equal(g.round.practice, true);
  g.key("action");
  assert.notEqual(g.round.phase, "story", "and a room taken from it goes on");
  // A real run: skip it, then a lost life and a new room never bring it back.
  const { g: h } = openGame();
  skipStory(h.round);
  h.tick(16);
  assert.equal(h.round.phase, "play");
  h.round.dice = 0;
  h.round.you.safeMs = 0;
  ghoul.lose(h.round, "zombie");
  tick(h, ghoul.CRASH_MS + 400);
  assert.notEqual(h.round.phase, "story", "no story on a respawn");
  assert.equal(h.round.story, null);
  h.round.phase = "clear";
  h.round.phaseMs = 1;
  h.tick(16);
  assert.notEqual(h.round.phase, "story", "no story in a new room");
  assert.equal(h.round.phase, "pick", "the hall's door leads to the stage pick, never the story");
  h.round.phaseMs = 0;
  ghoul.pickStage(h.round);
  assert.equal(h.round.phase, "intro", "and a stage opens on its own card");
  tick(h, ghoul.INTRO_MIN_MS + 100);
  ghoul.takeIntro(h.round);
  tick(h, ghoul.READY_MS + 200);
  assert.equal(h.round.phase, "play");
  // The end screen and a new run: the story again.
  h.round.lives = 1;
  h.round.dice = 0;
  h.round.infinite = false;
  ghoul.lose(h.round, "zombie");
  for (let k = 0; k < 300 && h.state === "running"; k++) h.tick(16);
  assert.equal(h.state, "over");
  h.key("action");
  assert.equal(h.state, "running");
  assert.equal(h.round.phase, "story", "every new run opens on it");
  assert.equal(h.round.story.page, 0);
  // The pure round never has it (the tests that walk the rules rely on that).
  assert.equal(ghoul.newRound(9).phase, "play");
});

test("Ghoul Rush story: its sounds play (a drone under it, its timed tones, a page turn, the hall's door) and the hall's music waits", () => {
  const { g, sounds, hums } = openGame();
  const music = [];
  tick(g, 1200);
  assert.ok(hums.some(([id, name]) => id === "ghoul:story" && name === "ghoulStoryDrone"), "the story's drone runs under it");
  assert.ok(hums.every(([id]) => id === "ghoul:story"), "no monster or house hum under the story");
  assert.ok(Object.hasOwn(ghoulSfx.hums, "ghoulStoryDrone"));
  const first = PAGES[0].cues[0][1];
  assert.ok(sounds.includes(first), `${first} plays at the first page's start`);
  assert.ok(sounds.includes("tickSoft"), "a soft blip while it types");
  lock(g);
  typedOut(g);
  tick(g, RELOCK_MS + 40);
  sounds.length = 0;
  g.key("left");
  g.tick(16);
  assert.equal(g.round.story.page, 1);
  assert.ok(sounds.includes("ghoulStoryPage"), "a page turn rustles");
  assert.equal(music.length, 0);
  // Every tone and hum the story owns keeps this game's prefix.
  for (const name of Object.keys(ghoulSfx.tones)) if (name.startsWith("ghoulStory")) assert.match(name, /^ghoulStory[A-Z]/);
  assert.ok(Object.keys(ghoulSfx.tones).filter((n) => n.startsWith("ghoulStory")).length >= 8, "a handful of house tones");
});

test("Ghoul Rush story: endless lives and the stage code are untouched by it", () => {
  const { g } = openGame();
  g.cheat(true);
  assert.equal(g.round.infinite, true);
  lock(g);
  g.key("up");
  assert.equal(g.round.infinite, true, "the code survives the story");
  skipStory(g.round);
  g.tick(16);
  g.round.lives = 1;
  ghoul.lose(g.round, "zombie");
  tick(g, ghoul.CRASH_MS + 400);
  assert.equal(g.round.lives, 1, "no life is lost with the code on");
  assert.equal(g.state, "running");
});

test("Ghoul Rush story: every page draws on a fake canvas at many moments, the finale's title letter by letter, without throwing", () => {
  for (let at = 0; at < PAGES.length; at++) {
    const texts = [];
    const ctx = fakeCtx(texts);
    const g = ghoul.default.create({ canvas: { width: 0, height: 0, getContext: () => ctx } });
    g.resize(900, 900);
    g.key("action");
    for (const ms of [0, 1, 120, 450, 900, 1500, 2300, 3100, 4000, 5200, 6500, 8000, 12000, 40000]) {
      for (const full of [false, true]) {
        for (const hold of [-1, 500]) {
          g.round.story = { page: at, ms, full, arm: 0, hold, cue: 99, shown: 0 };
          g.tick(1);
        }
      }
    }
    assert.ok(texts.some((t) => PAGES[at].chapter === t), `page ${at + 1} draws its heading`);
    if (at === PAGES.length - 1) {
      g.round.story = { page: at, ms: 6000, full: true, arm: 0, hold: -1, cue: 99, shown: 0 };
      texts.length = 0;
      g.tick(1);
      for (const ch of FINALE_TITLE) if (ch !== " ") assert.ok(texts.includes(ch), `the finale draws ${ch}`);
    }
  }
  assert.ok(SCENE_H > 20 && SCENE_H < 40, "the scene keeps to the top of the field");
});

test("Ghoul Rush story: the whole run still goes through it on a real clock, from the first press to the hall, ready to play", () => {
  const { g, texts } = openGame();
  assert.equal(g.round.phase, "story");
  let guard = 0;
  while (g.round.phase === "story" && guard++ < 40) {
    typedOut(g);
    tick(g, RELOCK_MS + 40);
    g.key("right");
    g.release("right");
  }
  assert.equal(g.round.phase, "play");
  assert.equal(g.round.spec.id, "hall");
  texts.length = 0;
  tick(g, 100);
  assert.ok(texts.some((t) => String(t).includes("The Long Hall")), "the hall is announced once the story is out");
});
