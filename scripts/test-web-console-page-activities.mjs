// Page tests for Activities: the die in the top bar on every screen, the
// window opening on the picker (a card per game, walked by the arrows, one
// game at a time, All games back to it), Light Trails, Bug Hunt, Sunset Drive, Stack Deploy, Bumper Ring, Rapids Run, Hot Potato, Crossing Rush, Bounce Road and Ghoul Rush in play, the keys
// staying inside the window, Esc and P, and every pause rule (a new question,
// a finish, a hidden page, a window blur), none of which ever resumes play by
// itself. Mini golf in the real window: aim by mouse, two clicks to putt,
// held keys (fast-forward, turning aim) let go through the window, pauses
// mid-swing and mid-roll, playing on by click or key, and its lower-is-better
// best. Then the
// saved side: best scores across sessions, Reset best scores, the Show
// Activities switch and the /looks keys. Also the page's content-security
// policy with a game running, and that the server serves the new scripts.
// Run with:
// node --test scripts/test-web-console-page-activities.mjs
//
// Each test drives the real console in a real Chrome or Edge through
// scripts/page-test-helpers.mjs: one browser for the file, a fresh console
// session per test. Time is stepped by hand through setTickSource(), never by
// real frames, so a busy machine cannot move the snake between two checks.

import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { pageSuite, openSession, drawn, itemCard, boxValue, fillBox } from "./page-test-helpers.mjs";
import { until, HOME } from "./web-console-test-helpers.mjs";

const suite = pageSuite(test);

// The person's saved looks, shared by every session in this console home.
const LOOKS_FILE = path.join(HOME, "looks.json");

// Starts a test from the given saved looks (none when left out) and leaves
// none behind, so a best score or a hidden die never leaks into the next test.
function savedLooks(t, looks) {
  if (looks) fs.writeFileSync(LOOKS_FILE, JSON.stringify({ looks }));
  else fs.rmSync(LOOKS_FILE, { force: true });
  t.after(() => fs.rmSync(LOOKS_FILE, { force: true }));
}

// The page's own copy of the saved looks, which a save is made from.
const pageLooks = (s) =>
  s.page.evaluate(async () => {
    const { looks } = await import("/looks.js");
    return { ...looks };
  });

// The server's copy of the saved looks, fetched by the page itself, which
// holds the session's cookie.
const serverLooks = (s) =>
  s.page.evaluate(async () => {
    const res = await fetch("/looks");
    return res.ok ? (await res.json()).looks || {} : {};
  });

// A plan session on the person's turn: one text question.
const PLAN_QUESTION = {
  items: [{ id: "q1", kind: "text", title: "What to call it", body: "A short name for the export." }],
  agent: { status: "waiting" },
};

// A plan session with the agent at work: nothing is the person's to answer.
const PLAN_WORKING = { agent: { status: "working", activity: "Reading the plan" } };

const overlay = (s) => s.page.locator("#activities-overlay").innerText();

// Frames come from a queue the test empties, never from the browser. The
// 3, 2, 1 before play is skipped unless a test asks for it (`countMs`).
async function handTicks(s, countMs = 0) {
  await s.page.evaluate(async (countMs) => {
    const m = await import("/screens/activities.js");
    window.__frames = [];
    window.__now = 0;
    m.setTickSource((fn) => window.__frames.push(fn));
    m.setCountdownMs(countMs);
  }, countMs);
}

// Runs `n` frames of `ms` each: every frame waiting is handed the new time.
const step = (s, n = 1, ms = 60) =>
  s.page.evaluate(
    ({ n, ms }) => {
      for (let i = 0; i < n; i++) {
        const due = window.__frames.splice(0);
        window.__now += ms;
        for (const fn of due) fn(window.__now);
      }
    },
    { n, ms },
  );

const framesWaiting = (s) => s.page.evaluate(() => window.__frames.length);

// Opens the window and, when it opens on the picker, picks `id` from it,
// and for a game with courses (Mini golf), `course` from its dashboard. A
// window that goes straight into a game (one game listed, or a round
// waiting) is left on that game.
async function openActivities(s, id = "snake", course = "pirate") {
  await s.page.click("#btn-activities");
  await s.page.locator("#activities-modal[open]").waitFor();
  const picker = s.page.locator("#activities-picker");
  const board = s.page.locator("#activities-board");
  await until(async () => (await picker.isVisible()) || (await board.isVisible()), 5000);
  if (await picker.isVisible()) {
    await picker.locator(`.activities-card[data-activity="${id}"]`).click();
    if (id === "golf") await courseCard(s, course).click();
  }
  await until(async () => (await board.isVisible()) && (await overlay(s)) !== "", 5000);
}

// Opens the window onto its picker, which it shows when no round is waiting.
async function openPicker(s) {
  await s.page.click("#btn-activities");
  await s.page.locator("#activities-modal[open]").waitFor();
  await s.page.locator("#activities-picker").waitFor();
}

// Opens the window and starts a round: running, with a frame waiting.
async function startGame(s) {
  await handTicks(s);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "a running game shows no overlay");
  assert.ok((await framesWaiting(s)) > 0, "the frame timer runs");
  await step(s, 3);
}

// A frame asked for before the pause may still be queued, as one from the
// browser would be; run it, and nothing may ask for another.
async function pausedNow(s) {
  await until(async () => (await overlay(s)).startsWith("Paused"), 5000);
  await step(s, 1);
  assert.equal(await framesWaiting(s), 0, "the frame timer stopped");
}

// Past Planny's wake-up and, on this console home's first run, the Welcome.
async function pastTheIntro(s) {
  const skip = s.page.getByRole("button", { name: "Skip the intro" });
  await skip.click();
  await skip.waitFor({ state: "hidden" });
  await s.page.locator("#main").getByRole("heading", { name: "What are we doing today?" }).waitFor();
  const welcomeDone = s.page.getByRole("button", { name: "Start building" });
  if (await welcomeDone.isVisible()) {
    await welcomeDone.click();
    await welcomeDone.waitFor({ state: "hidden" });
  }
}

async function iconUsable(s, where) {
  const btn = s.page.locator("#btn-activities");
  assert.ok(await btn.isVisible(), `the die shows on ${where}`);
  assert.ok(await btn.isEnabled(), `the die is usable on ${where}`);
}

const cardTitles = (s) => s.page.locator("#activities-picker .activities-card-title").allInnerTexts();
const card = (s, id) => s.page.locator(`#activities-picker .activities-card[data-activity="${id}"]`);
const focusedCard = (s) => s.page.evaluate(() => document.activeElement?.dataset?.activity || null);
const courseCard = (s, id) => s.page.locator(`#activities-picker .activities-course[data-course="${id}"]`);
const focusedCourse = (s) => s.page.evaluate(() => document.activeElement?.dataset?.course || null);

test("the die sits right of the megaphone and opens on the picker, a card per game with its best, and a card opens its game", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 12 });
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await pastTheIntro(s);
  await iconUsable(s, "the dashboard");
  const next = await s.page.evaluate(() => document.getElementById("btn-feedback").nextElementSibling?.id);
  assert.equal(next, "btn-activities");
  await openPicker(s);
  assert.deepEqual(await cardTitles(s), ["Snake", "Mini golf", "Light Trails", "Bug Hunt", "Sunset Drive", "Stack Deploy", "Bumper Ring", "Rapids Run", "Hot Potato", "Crossing Rush", "Bounce Road", "Ghoul Rush"]);
  assert.ok(await s.page.locator("#activities-board").isHidden(), "no board behind the picker");
  assert.ok(await s.page.locator("#activities-back").isHidden(), "nothing to go back to");
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities", "the header names no game");
  assert.match(await card(s, "snake").innerText(), /Best: 12/);
  assert.match(await card(s, "golf").innerText(), /6 courses to play/);
  assert.equal(await s.page.locator("#activities-picker svg").count(), (await cardTitles(s)).length, "each card has its cover");
  assert.equal(await focusedCard(s), "snake", "with no last pick, focus is on the first card");
  await card(s, "snake").click();
  await until(async () => (await overlay(s)) === "Press space to start", 5000);
  assert.ok(await s.page.locator("#activities-picker").isHidden(), "the game takes the window");
  assert.ok(await s.page.locator("#activities-back").isVisible(), "All games shows with a game");
  assert.equal(await s.page.evaluate(() => document.activeElement?.id), "activities-board", "keys reach the game with no extra click");
});

test("the arrows walk the picker's cards, and space or Enter opens the one in focus", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openPicker(s);
  assert.equal(await focusedCard(s), "snake");
  await s.page.keyboard.press("ArrowRight");
  assert.equal(await focusedCard(s), "golf");
  for (let i = 0; i < 11; i++) await s.page.keyboard.press("ArrowRight");
  assert.equal(await focusedCard(s), "ghoul", "the last card stays put");
  for (let i = 0; i < 10; i++) await s.page.keyboard.press("ArrowLeft");
  assert.equal(await focusedCard(s), "golf");
  await s.page.keyboard.press("Enter");
  // Mini golf opens on its course dashboard, walked the same way.
  await until(async () => (await focusedCourse(s)) === "pirate", 5000);
  await s.page.keyboard.press("ArrowRight");
  assert.equal(await focusedCourse(s), "cave");
  await s.page.keyboard.press("Enter");
  await until(async () => (await overlay(s)) === "Press space or click to start", 5000);
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Mini golf, Caves of Doom: no best yet");
  assert.equal(await s.page.locator("#activities-back").innerText(), "All courses");
  await s.page.click("#activities-back");
  await until(async () => (await focusedCourse(s)) === "cave", 5000);
  assert.equal(await s.page.locator("#activities-back").innerText(), "All games");
  await s.page.click("#activities-back");
  await s.page.locator("#activities-picker .activities-card[data-activity]").first().waitFor();
  assert.equal(await focusedCard(s), "golf", "back on the picker, the game just left is in focus");
  await s.page.keyboard.press("ArrowRight");
  await s.page.keyboard.press(" ");
  await until(async () => (await s.page.locator("#activities-title").innerText()) === "Activities · Light Trails: no best yet", 5000);
});

test("picking Mini golf shows it, saves it as the last played, and keys reach it with no extra click", async (t) => {
  savedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await pastTheIntro(s);
  await handTicks(s);
  await openActivities(s, "golf");
  assert.equal(await overlay(s), "Press space or click to start");
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Mini golf, Pirate Cove: no best yet", "the header follows the pick");
  // Golf's course is wider than tall: the canvas takes its shape, not Snake's square.
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, `a 4:3 board, not ${box.width} by ${box.height}`);
  assert.equal(await s.page.evaluate(() => document.activeElement?.id), "activities-board");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space started the picked game");
  await until(
    () => s.page.evaluate(async () => ((await (await fetch("/looks")).json()).looks || {}).lastActivity === "golf"),
    5000,
  );
  // Back to Snake, by way of the course dashboard: its board is square again.
  await s.page.click("#activities-back");
  await courseCard(s, "pirate").waitFor();
  await s.page.click("#activities-back");
  await card(s, "snake").click();
  await until(async () => (await overlay(s)) === "Press space to start", 5000);
  const square = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(square.width - square.height) < 1, "Snake's board is square");
});

test("one game at a time: All games keeps the round paused for its own card, and another pick lets it go", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  await s.page.click("#activities-back");
  await s.page.locator("#activities-picker").waitFor();
  await step(s, 1);
  assert.equal(await framesWaiting(s), 0, "the picker does not tick the game");
  assert.match(await card(s, "snake").innerText(), /Round paused, score 0/);
  assert.match(await s.page.locator("#activities-picker").innerText(), /Picking a different game ends the paused round/);
  // Closed and reopened with a round waiting: straight back into it.
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await s.page.click("#btn-activities");
  await until(async () => (await overlay(s)).startsWith("Paused"), 5000);
  // Its own card plays the same round on.
  await s.page.click("#activities-back");
  await card(s, "snake").click();
  await until(async () => (await overlay(s)).startsWith("Paused"), 5000);
  // Another game's card ends it: Snake starts fresh next time.
  await s.page.click("#activities-back");
  await card(s, "trails").click();
  await until(async () => (await overlay(s)) === "Press space to start", 5000);
  await s.page.click("#activities-back");
  assert.doesNotMatch(await s.page.locator("#activities-picker").innerText(), /Round paused/);
  await card(s, "snake").click();
  await until(async () => (await overlay(s)) === "Press space to start", 5000);
});

test("a new session's picker marks the last played and puts focus on it, and a last pick no longer listed falls back to the first card", async (t) => {
  savedLooks(t, { welcomeSeen: true, lastActivity: "golf" });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openPicker(s);
  assert.equal(await focusedCard(s), "golf");
  assert.match(await card(s, "golf").innerText(), /Last played/);
  assert.doesNotMatch(await card(s, "snake").innerText(), /Last played/);

  fs.writeFileSync(LOOKS_FILE, JSON.stringify({ looks: { welcomeSeen: true, lastActivity: "chess" } }));
  const again = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openPicker(again);
  assert.equal(await focusedCard(again), "snake", "an unknown pick puts focus on the first card");
  assert.equal(await again.page.locator("#activities-picker .activities-card-tag").count(), 0);
});

test("Light Trails plays in the real window: a wide board, the rivals ride, and an arrow steers you", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await openActivities(s, "trails");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, `a 4:3 board, not ${box.width} by ${box.height}`);
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await step(s, 20);
  await s.page.keyboard.press("ArrowUp");
  await step(s, 20);
  assert.equal(await overlay(s), "", "still riding");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  await s.page.keyboard.press("p");
  await pausedNow(s);
});

test("Bug Hunt plays in the real window: held space fires until let go, a held arrow slides the ship, and a pause lets go of both", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const hunt = (await import("/activities/bugs.js")).default;
    const watched = { ...hunt, create: (opts) => (window.__bugs = hunt.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "bugs" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "bugs");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, `a 4:3 board, not ${box.width} by ${box.height}`);
  const shots = () => s.page.evaluate(() => window.__bugs.round.shots.length);
  const input = () => s.page.evaluate(() => ({ ...window.__bugs.round.input }));
  await s.page.keyboard.down(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await step(s, 3, 60);
  assert.ok((await shots()) > 0, "held space fires");
  await s.page.keyboard.up(" ");
  assert.equal((await input()).fire, false, "let go, the firing stops");
  const x = await s.page.evaluate(() => window.__bugs.round.ship.x);
  await s.page.keyboard.down("ArrowLeft");
  await step(s, 4, 60);
  assert.ok((await s.page.evaluate(() => window.__bugs.round.ship.x)) < x, "a held arrow slides the ship");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  assert.deepEqual(await input(), { left: false, right: false, up: false, down: false, fire: false }, "a pause holds nothing");
  await s.page.keyboard.up("ArrowLeft");
});

test("Sunset Drive plays in the real window: a wide board, held up drives until let go, a held arrow steers, space burns nitro, and a pause lets go of every key", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const road = (await import("/activities/drive.js")).default;
    const watched = { ...road, create: (opts) => (window.__drive = road.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "drive" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "drive");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 16 / 9) < 0.02, `a 16:9 board, not ${box.width} by ${box.height}`);
  const round = () => s.page.evaluate(() => ({ ...window.__drive.round.input, speed: window.__drive.round.speed, x: window.__drive.round.x, nitro: window.__drive.round.nitro }));
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await s.page.keyboard.down("ArrowUp");
  await step(s, 6, 60);
  assert.ok((await round()).speed > 0, "held up drives");
  await s.page.keyboard.up("ArrowUp");
  assert.equal((await round()).up, false, "let go, the gas is off");
  const x = (await round()).x;
  await s.page.keyboard.down("ArrowLeft");
  await step(s, 4, 60);
  assert.ok((await round()).x < x, "a held arrow steers");
  await s.page.keyboard.press(" ");
  assert.equal((await round()).nitro, 1, "space burns a nitro can");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = await round();
  assert.deepEqual([held.left, held.right, held.up, held.down], [false, false, false, false], "a pause holds nothing");
  await s.page.keyboard.up("ArrowLeft");
});

test("Stack Deploy plays in the real window: space and a click on the board drop the block, an arrow that plays on does not, and a miss saves the best and the highest floor", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const tower = (await import("/activities/stack.js")).default;
    const watched = { ...tower, create: (opts) => (window.__stack = tower.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "stack" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "stack");
  assert.equal(await overlay(s), "Press space or click to start");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, `a 4:3 board, not ${box.width} by ${box.height}`);
  const round = () => s.page.evaluate(() => ({ floor: window.__stack.round.floor, streak: window.__stack.round.streak, x: window.__stack.round.slider?.x ?? null }));
  // Puts the sliding block right over the top of the tower, or clear of it.
  const aim = (off = 0) =>
    s.page.evaluate((off) => {
      const r = window.__stack.round;
      r.slider.x = r.blocks[r.blocks.length - 1].x + off;
    }, off);
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  assert.equal((await round()).floor, 0, "and drops nothing");
  await step(s, 2);
  await aim();
  await s.page.keyboard.press(" ");
  assert.deepEqual([(await round()).floor, (await round()).streak], [1, 1], "space drops, dead on is a perfect");
  await step(s, 2);
  await aim();
  await s.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  assert.equal((await round()).floor, 2, "a click on the board drops");
  await step(s, 2);
  // A key repeat of up (say, up held through the countdown) never drops.
  await aim();
  await s.page.evaluate(() => document.getElementById("activities-board").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", repeat: true, bubbles: true })));
  assert.equal((await round()).floor, 2, "a repeated up drops nothing");
  await step(s, 2);
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = (await round()).x;
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "", "an arrow plays on");
  assert.equal((await round()).floor, 2, "and drops nothing");
  assert.equal((await round()).x, held, "the block waits where it was");
  await step(s, 2);
  assert.notEqual((await round()).x, held, "then slides on");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  await aim(1000);
  await s.page.keyboard.press(" ");
  await step(s, 10, 200);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__stack.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestStack === score && looks.activityMemoStack === 2;
  }, 5000);
});

test("Bumper Ring plays in the real window: a 4:3 board, held arrows push until let go, space dashes, a pause lets go of every key, and the last fall saves the best and the furthest arena", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const ring = (await import("/activities/bumper.js")).default;
    const watched = { ...ring, create: (opts) => (window.__bumper = ring.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "bumper" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "bumper");
  assert.equal(await overlay(s), "Press space to start");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, `a 4:3 board, not ${box.width} by ${box.height}`);
  const you = () => s.page.evaluate(() => {
    const r = window.__bumper.round;
    return { ...r.input, y: r.cars[0].y, charges: r.cars[0].charges, phase: r.phase, level: r.level };
  });
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await step(s, 8);
  assert.equal((await you()).phase, "fight", "past the hold before the heat");
  const y = (await you()).y;
  await s.page.keyboard.down("ArrowUp");
  await step(s, 4);
  assert.ok((await you()).y < y - 2, "held up pushes up");
  await s.page.keyboard.up("ArrowUp");
  assert.equal((await you()).up, false, "let go, the push stops");
  await s.page.keyboard.down("ArrowLeft");
  await s.page.keyboard.press(" ");
  assert.equal((await you()).charges, 1, "space dashes");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = await you();
  assert.deepEqual([held.left, held.right, held.up, held.down], [false, false, false, false], "a pause holds nothing");
  await s.page.keyboard.up("ArrowLeft");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays on");
  assert.equal((await you()).charges, 1, "and does not also dash");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  // Knock the Bully off for a win (arena 2 is a new furthest), then fall
  // off on your last life.
  await s.page.evaluate(() => {
    const bully = window.__bumper.round.cars[1];
    Object.assign(bully, { x: bully.x, y: -20, vx: 0, vy: 0 });
  });
  await step(s, 1);
  await until(async () => (await you()).phase === "done", 5000);
  await step(s, 40);
  await until(async () => (await you()).level === 2, 5000);
  await step(s, 30);
  await s.page.evaluate(() => {
    const r = window.__bumper.round;
    r.lives = 1;
    Object.assign(r.cars[0], { y: 200, vx: 0, vy: 0 });
  });
  await step(s, 40);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__bumper.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestBumper === score && looks.activityMemoBumper === 2;
  }, 5000);
});

test("Hot Potato plays in the real window: a 106 by 76 unit board, held arrows run until let go, space dashes, a pause lets go of every key, and the last blast saves the best and the furthest venue", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const potato = (await import("/activities/fuse.js")).default;
    const watched = { ...potato, create: (opts) => (window.__fuse = potato.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "fuse" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "fuse");
  assert.equal(await overlay(s), "Press space to start");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  // fuse.js: W = AW + PAD * 2 = 106, H = HUD_H + AH + 1.5 = 76.
  assert.ok(Math.abs(box.width / box.height - 106 / 76) < 0.02, `a 106:76 board, not ${box.width} by ${box.height}`);
  const you = () =>
    s.page.evaluate(() => {
      const r = window.__fuse.round;
      return { ...r.input, y: r.runners[0].y, charges: r.runners[0].charges, phase: r.phase, level: r.level };
    });
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await step(s, 8);
  assert.equal((await you()).phase, "play", "past the hold before the match");
  // The rivals stand still, so nobody runs into you mid-test.
  await s.page.evaluate(() => {
    for (const r of window.__fuse.round.runners) if (r.id !== 0) Object.assign(r, { think: 1e9, push: { x: 0, y: 0 }, charges: 0 });
  });
  const y = (await you()).y;
  await s.page.keyboard.down("ArrowUp");
  await step(s, 4);
  assert.ok((await you()).y < y - 3, "held up runs up");
  await s.page.keyboard.up("ArrowUp");
  assert.equal((await you()).up, false, "let go, the running stops");
  await s.page.keyboard.down("ArrowLeft");
  await s.page.keyboard.press(" ");
  assert.equal((await you()).charges, 1, "space dashes");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = await you();
  assert.deepEqual([held.left, held.right, held.up, held.down], [false, false, false, false], "a pause holds nothing");
  await s.page.keyboard.up("ArrowLeft");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays on");
  assert.equal((await you()).charges, 1, "and does not also dash");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  // Win the match (venue 2 is a new furthest): everyone but the holder sits
  // out and its fuse runs out. Then the bomb blows on you on your last life.
  await s.page.evaluate(() => {
    const r = window.__fuse.round;
    const holder = r.bombs[0].holder;
    for (const o of r.runners) if (o.id !== 0 && o.id !== holder) Object.assign(o, { alive: false, outMs: 0 });
    r.bombs[0].fuse = 1;
  });
  await step(s, 1);
  await until(async () => (await you()).phase === "done", 5000);
  await step(s, 40);
  await until(async () => (await you()).level === 2, 5000);
  await step(s, 30);
  await s.page.evaluate(() => {
    const r = window.__fuse.round;
    r.lives = 1;
    Object.assign(r.bombs[0], { holder: 0, fuse: 1, lock: 0 });
  });
  await step(s, 40);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__fuse.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestFuse === score && looks.activityMemoFuse === 2;
  }, 5000);
});

test("Crossing Rush plays in the real window: its board's shape, an arrow hops once a press (a held one never again), space uses a pickup, a pause drops the queued hop, and the last heat lost saves the best and the furthest zone", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const rush = (await import("/activities/hop.js")).default;
    const watched = { ...rush, create: (opts) => (window.__hop = rush.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "hop" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "hop");
  assert.equal(await overlay(s), "Press space to start");
  const { W, H } = await s.page.evaluate(async () => {
    const { W, H } = await import("/activities/hop.js");
    return { W, H };
  });
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - W / H) < 0.02, `a ${W} by ${H} board, not ${box.width} by ${box.height}`);
  const you = () =>
    s.page.evaluate(() => {
      const r = window.__hop.round;
      const me = r.hoppers[0];
      return { row: me.row, x: me.x, hopping: Boolean(me.hop), queued: me.queued, phase: r.phase, level: r.level };
    });
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await step(s, 8);
  assert.equal((await you()).phase, "play", "past the hold before the heat");
  // The rivals stand still and the first rows are grass, so nothing runs
  // into you mid-test.
  await s.page.evaluate(() => {
    const r = window.__hop.round;
    for (const h of r.hoppers) if (h.id !== 0) Object.assign(h, { hop: null, think: 1e9, row: 0 });
    for (let row = 1; row <= 4; row++) Object.assign(r.lanes[row], { kind: "grass", items: [], speed: 0, trees: new Array(11).fill(0) });
    r.pickups = [];
  });
  await s.page.keyboard.press("ArrowUp");
  await step(s, 3);
  assert.equal((await you()).row, 1, "a press hops a cell");
  await s.page.keyboard.down("ArrowUp");
  await s.page.keyboard.down("ArrowUp");
  await s.page.keyboard.down("ArrowUp");
  await step(s, 6);
  assert.equal((await you()).row, 2, "a held arrow hops once, its repeats never");
  await s.page.keyboard.up("ArrowUp");
  await s.page.evaluate(() => {
    window.__hop.round.hoppers[0].powers = ["shield"];
  });
  await s.page.keyboard.press(" ");
  assert.equal(await s.page.evaluate(() => window.__hop.round.hoppers[0].shield > 0), true, "space uses the pickup");
  await step(s, 4);
  await s.page.keyboard.press("ArrowLeft");
  await s.page.keyboard.press("ArrowUp");
  assert.equal((await you()).queued, "up", "a press during a hop waits its turn");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  assert.equal((await you()).queued, null, "a pause drops it");
  const held = await you();
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays on");
  await step(s, 6);
  assert.equal((await you()).row, held.row, "and nothing hops on by itself");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  // Win the heat (zone 2 is a new furthest), then lose the last life with
  // both rivals home first.
  await s.page.evaluate(() => {
    const r = window.__hop.round;
    const top = r.rows - 1;
    Object.assign(r.lanes[top - 1], { kind: "grass", items: [], speed: 0, trees: new Array(11).fill(0) });
    Object.assign(r.hoppers[0], { row: top - 1, x: 5, hop: null, daze: 0 });
  });
  await s.page.keyboard.press("ArrowUp");
  await step(s, 3);
  await until(async () => (await you()).phase === "done", 5000);
  await step(s, 40);
  await until(async () => (await you()).level === 2, 5000);
  await step(s, 30);
  await s.page.evaluate(() => {
    const r = window.__hop.round;
    r.lives = 1;
    for (const h of r.hoppers.slice(1)) {
      Object.assign(h, { hop: null, think: 1e9, finished: true });
      r.finishers.push(h);
      h.place = r.finishers.length;
    }
  });
  await step(s, 40);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__hop.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestHop === score && looks.activityMemoHop === 2;
  }, 5000);
});

test("Bounce Road plays in the real window: its board's shape and cars big enough to read, held keys drive and steer until let go, space jumps once a press (never on its repeat, never with the press that plays on), a pause lets go of every key and holds a jump mid-air, and the last life lost saves the best and the furthest stage", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const bounce = (await import("/activities/bounce.js")).default;
    const watched = { ...bounce, create: (opts) => (window.__bounce = bounce.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "bounce" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "bounce");
  assert.equal(await overlay(s), "Press space to start");
  const { W, H, CAR_L } = await s.page.evaluate(async () => {
    const { W, H, CAR_L } = await import("/activities/bounce.js");
    return { W, H, CAR_L };
  });
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - W / H) < 0.02, `a ${W} by ${H} board, not ${box.width} by ${box.height}`);
  const carPx = (box.width / W) * CAR_L;
  assert.ok(carPx >= 24, `a car 24 px long or more in a 1280 by 800 window (${carPx.toFixed(1)} px)`);
  const you = () =>
    s.page.evaluate(() => {
      const r = window.__bounce.round;
      const me = r.cars[0];
      return { ...r.input, v: me.v, x: me.x, air: me.air, phase: r.phase, stage: r.stage };
    });
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space starts a round");
  await step(s, 2, 16);
  assert.equal((await you()).phase, "drive", "on the road at once after the window's 3, 2, 1");
  // No rivals, so nothing runs into you mid-test.
  await s.page.evaluate(() => {
    const r = window.__bounce.round;
    r.cars.length = 1;
    r.spawnMs = 1e9;
  });
  await s.page.keyboard.down("ArrowUp");
  await step(s, 40, 16);
  assert.ok((await you()).v > 30, "held up drives");
  const x = (await you()).x;
  await s.page.keyboard.down("ArrowLeft");
  await step(s, 6, 16);
  assert.ok((await you()).x < x, "held left steers");
  await s.page.keyboard.up("ArrowLeft");
  await s.page.keyboard.down(" ");
  await step(s, 2, 16);
  assert.ok((await you()).air > 0, "space jumps");
  await s.page.keyboard.down(" ");
  await s.page.keyboard.down(" ");
  await step(s, 80, 16);
  assert.equal((await you()).air, 0, "a held space, its repeats included, jumps once");
  await s.page.keyboard.up(" ");
  await s.page.keyboard.press(" ");
  await step(s, 4, 16);
  const air = (await you()).air;
  assert.ok(air > 0, "a fresh press jumps again");
  await s.page.keyboard.down("ArrowRight");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = await you();
  assert.deepEqual([held.up, held.right, held.jump], [false, false, 0], "a pause holds nothing");
  assert.equal(held.air, air, "and holds the jump mid-air");
  await s.page.keyboard.up("ArrowRight");
  await s.page.keyboard.up("ArrowUp");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays on");
  await step(s, 2, 16);
  const resumed = await you();
  assert.ok(resumed.air > 0 && resumed.air < air, "the jump carries on, and the press that played on started none");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  // Cross into stage 2 (a new furthest), then lose the last life in a hole.
  await s.page.evaluate(() => {
    const r = window.__bounce.round;
    const me = r.cars[0];
    Object.assign(me, { air: 0, d: r.road.stageAt[1] - 0.2 });
    const i = Math.floor(me.d / 2);
    me.x = (r.road.L[i] + r.road.R[i]) / 2;
  });
  await step(s, 4, 16);
  await until(async () => (await you()).stage === 2, 5000);
  await step(s, 10, 16);
  await s.page.evaluate(() => {
    const r = window.__bounce.round;
    const me = r.cars[0];
    r.lives = 1;
    const hole = r.road.holes.find((h) => h.d0 > me.d);
    Object.assign(me, { air: 0, d: hole.d0 - 3, v: 20, bubble: false });
  });
  await step(s, 120, 16);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__bounce.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestBounce === score && looks.activityMemoBounce === 2;
  }, 5000);
});

test("the die works on a skill screen and on a finished screen", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  await iconUsable(s, "a skill screen");
  await openActivities(s);
  await s.page.click("#activities-close");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);

  s.post({ settle: true, finish: { headline: "The plan is done", body: "All written down." } });
  await s.page.waitForFunction(() => document.getElementById("btn-stop").hidden);
  await iconUsable(s, "the finished screen");
  await openActivities(s);
});

test("arrows and space with the window open neither scroll the page nor reach the answer box behind it", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  const box = itemCard(s.page, "q1").locator(".md-host, input[type=text]").first();
  await box.click();
  await s.page.evaluate(() => {
    window.__leaked = 0;
    document.addEventListener("keydown", () => window.__leaked++);
  });
  const before = await s.page.evaluate(() => ({ y: scrollY, main: document.getElementById("main").scrollTop }));
  await startGame(s);
  for (const key of ["ArrowDown", "ArrowLeft", "ArrowUp", " ", "ArrowRight", "s", "d", "w", "a"]) {
    await s.page.keyboard.press(key);
  }
  const after = await s.page.evaluate(() => ({ y: scrollY, main: document.getElementById("main").scrollTop }));
  assert.deepEqual(after, before, "nothing scrolled");
  assert.equal(await boxValue(box), "", "nothing was typed into the answer box");
  assert.equal(await s.page.evaluate(() => window.__leaked), 0, "no game key reached the page");
});

test("Esc closes the window with the game paused, and P toggles pause", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.keyboard.press("p");
  assert.equal(await overlay(s), "", "P plays again");
  assert.ok((await framesWaiting(s)) > 0);
  await step(s, 2);

  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await step(s, 1);
  assert.equal(await framesWaiting(s), 0, "a closed window does not tick");
  await openActivities(s);
  assert.ok((await overlay(s)).startsWith("Paused"), "reopening resumes the same round, paused");
});

test("the endless-lives code typed on the board gives the round endless lives, from the start screen or mid-round, and a new round, a wrong key or closing the window takes it away", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const hunt = (await import("/activities/bugs.js")).default;
    const watched = { ...hunt, create: (opts) => (window.__bugs = hunt.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "bugs" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "bugs");
  const CODE = ["ArrowUp", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a", " "];
  const type = async (keys) => {
    for (const k of keys) await s.page.keyboard.press(k);
  };
  const endless = () => s.page.evaluate(() => Boolean(window.__bugs.round.infinite));
  // From the start screen: the code's space starts the round, endless.
  await type(CODE);
  assert.equal(await endless(), true, "typed before the round, it holds for the round its space starts");
  await step(s, 8, 60);
  assert.equal(await endless(), true, "and keeps holding");
  // R is a new round, without it.
  await s.page.keyboard.press("r");
  await step(s, 8, 60);
  assert.equal(await endless(), false, "a new round starts without it");
  // A wrong key on the way starts the code over.
  await type([...CODE.slice(0, 6), "ArrowUp", ...CODE.slice(6)]);
  assert.equal(await endless(), false, "a slip and it never takes");
  await type(CODE);
  assert.equal(await endless(), true, "typed mid-round");
  // Closing the window lets it go.
  await s.page.keyboard.press("Escape");
  assert.equal(await endless(), false, "closing the window lets it go");
});

test("the stage code typed on Ghoul Rush's board opens its stage select, the arrows pick a stage and room there, and space goes straight into that room", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const ghoul = (await import("/activities/ghoul-rush/ghoul.js")).default;
    const watched = { ...ghoul, create: (opts) => (window.__ghoul = ghoul.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "ghoul" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "ghoul");
  const CODE = ["ArrowUp", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "s"];
  const type = async (keys) => {
    for (const k of keys) await s.page.keyboard.press(k);
  };
  const now = () => s.page.evaluate(() => ({ state: window.__ghoul.state, phase: window.__ghoul.round.phase, select: window.__ghoul.round.select, stage: window.__ghoul.round.stage, at: window.__ghoul.round.stageAt }));
  // A slip on the way and nothing opens.
  await type([...CODE.slice(0, 5), "ArrowUp", ...CODE.slice(5)]);
  assert.equal((await now()).state, "ready", "a slip and it never opens");
  await type(CODE);
  let r = await now();
  assert.equal(r.state, "running");
  assert.equal(r.phase, "select", "the code opens the stage select from the start screen");
  await step(s, 4, 60);
  assert.equal((await now()).phase, "select", "it waits on a choice");
  await type(["ArrowDown", "ArrowRight", "ArrowRight"]);
  r = await now();
  assert.deepEqual(r.select, { at: 1, room: 2 });
  await s.page.keyboard.press(" ");
  r = await now();
  assert.equal(r.phase, "ready");
  assert.equal(r.stage, "wing");
  assert.equal(r.at, 2, "straight into the room picked");
});

test("Ghoul Rush's secondary weapon, with real keys in the window: a double tap of space uses it, a held key's repeats and a long hold never do, and held after the second tap the bolts carry on", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const ghoul = (await import("/activities/ghoul-rush/ghoul.js")).default;
    const watched = { ...ghoul, create: (opts) => (window.__ghoul = ghoul.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "ghoul" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "ghoul");
  // The stage code: a practice round in the Foyer, its bag full, straight in.
  for (const k of ["ArrowUp", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "s"]) await s.page.keyboard.press(k);
  await s.page.keyboard.press(" ");
  // The stage's intro card first: fire only moves it on after a moment.
  await step(s, 25, 60);
  await s.page.keyboard.press(" ");
  const now = () => s.page.evaluate(() => {
    const g = window.__ghoul;
    const r = g.round;
    return { phase: r.phase, kind: r.arms[0]?.kind, n: r.arms[0]?.n, balls: r.hazards.filter((h) => h.kind === "armBall").length, bolts: r.shots.filter((q) => !q.arm).length, hud: g.hud.arm && g.hud.arm.text };
  });
  for (let i = 0; i < 40 && (await now()).phase !== "play"; i++) await step(s, 1, 60);
  await s.page.evaluate(() => {
    const r = window.__ghoul.round;
    r.you.safeMs = 1e9;
    r.timeMs = 1e9;
  });
  let r = await now();
  assert.equal(r.phase, "play");
  assert.equal(r.kind, "ball", "the stage's own on top");
  const full = r.n;
  assert.equal(r.hud, `x${full} +3 TAP TAP`, "the HUD says so, and how");
  // A long hold, with the key's own repeats: bolts only.
  await s.page.keyboard.down(" ");
  await step(s, 1, 16);
  await s.page.keyboard.down(" ");
  await s.page.keyboard.down(" ");
  await step(s, 10, 40);
  await s.page.keyboard.up(" ");
  r = await now();
  assert.equal(r.n, full, "a hold and its repeats spend nothing");
  await step(s, 10, 40);
  // The double tap.
  await s.page.keyboard.press(" ");
  await step(s, 1, 16);
  await s.page.keyboard.press(" ");
  await step(s, 1, 16);
  r = await now();
  assert.equal(r.n, full - 1, "two taps, one weapon");
  assert.equal(r.balls, 1, "and it is on the floor");
  assert.equal(r.hud, `x${full - 1} +3`, "the prompt has done its job");
  await step(s, 16, 40);
  // Held after the second tap: used, then the blaster.
  await s.page.keyboard.press(" ");
  await step(s, 1, 16);
  await s.page.keyboard.down(" ");
  await step(s, 1, 16);
  await s.page.evaluate(() => (window.__ghoul.round.shots.length = 0));
  r = await now();
  assert.equal(r.n, full - 2, "used on the second press");
  await step(s, 10, 40);
  r = await now();
  assert.ok(r.bolts > 0, "held on, the bolts carry on");
  assert.equal(r.n, full - 2, "and no more spent");
  await s.page.keyboard.up(" ");
});

test("R starts the round over from the countdown, running or paused, and does nothing before a round has begun", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s, 100);
  await openActivities(s);
  const ready = await overlay(s);
  await s.page.keyboard.press("r");
  assert.equal(await overlay(s), ready, "no round yet: R does nothing");
  await s.page.keyboard.press(" ");
  await step(s, 8);
  assert.equal(await overlay(s), "", "playing");
  await s.page.keyboard.press("r");
  assert.equal(await overlay(s), "3", "R: a new round, from the count");
  await step(s, 8);
  await s.page.keyboard.press("p");
  assert.ok((await overlay(s)).startsWith("Paused"));
  await s.page.keyboard.press("r");
  assert.equal(await overlay(s), "3", "and from a pause");
});

test("in full screen the Music slider moves into the panel, and back under the board after", async (t) => {
  savedLooks(t, { gameMusic: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await s.page.setViewportSize({ width: 1600, height: 900 });
  await handTicks(s);
  await openActivities(s, "ghoul");
  const where = () => s.page.evaluate(() => (document.getElementById("activities-music").closest("#activities-rail") ? "rail" : "actions"));
  assert.equal(await where(), "actions");
  await s.page.keyboard.press("f");
  await until(async () => (await where()) === "rail", 5000);
  assert.equal(await s.page.locator("#activities-music-level").isVisible(), true, "shown in the panel");
  await s.page.keyboard.press("f");
  await until(async () => (await where()) === "actions", 5000);
  assert.equal(await s.page.locator("#activities-music-level").isVisible(), true);
});

test("starting and playing on count down 3, 2, 1 with the game held still, and P during the count pauses it", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s, 100);
  await openActivities(s);
  const snake = () => s.page.evaluate(() => document.getElementById("activities-score").innerText);
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "3", "space starts the count, not the snake");
  assert.equal(await s.page.locator("#activities-overlay.count").count(), 1, "the count shows as a big number");
  // Game keys and clicks wait for the count: a space does not start a second round.
  await s.page.keyboard.press(" ");
  await s.page.locator("#activities-overlay").click();
  await step(s, 1, 0);
  await step(s, 1, 100);
  assert.equal(await overlay(s), "2");
  await step(s, 1, 100);
  assert.equal(await overlay(s), "1");
  await step(s, 1, 100);
  assert.equal(await overlay(s), "", "the count ends and play begins");
  assert.equal(await s.page.locator("#activities-overlay.count").count(), 0);
  assert.ok((await framesWaiting(s)) > 0, "the frame timer runs on");
  assert.equal(await snake(), "Score: 0 · Best: 0");
  // A pause and a play-on count down again; P mid-count pauses.
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.keyboard.press("p");
  assert.equal(await overlay(s), "3", "playing on counts down again");
  await step(s, 1, 0);
  await step(s, 1, 100);
  assert.equal(await overlay(s), "2");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "3", "an arrow plays on with a fresh count");
});

test("a new question mid-game pauses it and shows the banner, and Go to it closes the window on that question", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  assert.ok(await s.page.locator("#activities-banner").isHidden(), "no banner while nothing is waiting");
  s.post({
    items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }],
    agent: { status: "waiting" },
  });
  await pausedNow(s);
  const banner = s.page.locator("#activities-banner");
  assert.ok(await banner.isVisible(), "the banner shows");
  assert.match(await banner.innerText(), /a question is waiting/);
  await step(s, 5);
  assert.ok((await overlay(s)).startsWith("Paused"), "nothing resumes by itself");

  await s.page.click("#activities-goto");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await itemCard(s.page, "q2").waitFor();
  assert.ok(await itemCard(s.page, "q2").isVisible(), "the question is on screen");
});

// The full-screen stage's parts, measured: the stage, the board's canvas and
// the panel, and where the score line sits.
const fullParts = (s) =>
  s.page.evaluate(() => {
    const rect = (id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, w: r.width, h: r.height };
    };
    const stage = document.getElementById("activities-stage");
    const rail = document.getElementById("activities-rail");
    return {
      full: stage.classList.contains("full"),
      dock: stage.dataset.dock || null,
      vw: innerWidth,
      vh: innerHeight,
      stage: rect("activities-stage"),
      canvas: rect("activities-canvas"),
      rail: rail.hidden ? null : rect("activities-rail"),
      scoreInRail: rail.contains(document.getElementById("activities-score")),
      railTitle: document.getElementById("activities-rail-title").textContent,
    };
  });

// The canvas as big as the screen allows, centered with even black bars,
// and the panel on the screen: docked in a bar (never over the canvas) when
// one holds it, floating over the canvas's corner otherwise.
function assertLaidOut(p, what) {
  const inside = (r) => r.left >= -1 && r.top >= -1 && r.right <= p.vw + 1 && r.bottom <= p.vh + 1;
  assert.ok(inside(p.canvas), `${what}: the board is on the screen ${JSON.stringify(p.canvas)}`);
  assert.ok(p.canvas.w >= p.vw * 0.92 || p.canvas.h >= p.vh * 0.92, `${what}: the board fills the screen one way ${JSON.stringify(p.canvas)}`);
  assert.ok(Math.abs(p.canvas.left - (p.vw - p.canvas.right)) <= 2 && Math.abs(p.canvas.top - (p.vh - p.canvas.bottom)) <= 2, `${what}: centered between even bars ${JSON.stringify(p.canvas)}`);
  assert.ok(p.rail && inside(p.rail), `${what}: the panel is on the screen ${JSON.stringify(p.rail)}`);
  if (p.dock === "side") assert.ok(p.canvas.right <= p.rail.left + 1, `${what}: a docked panel never covers the board ${JSON.stringify({ canvas: p.canvas, rail: p.rail })}`);
  else if (p.dock === "below") assert.ok(p.canvas.bottom <= p.rail.top + 1, `${what}: a docked panel never covers the board ${JSON.stringify({ canvas: p.canvas, rail: p.rail })}`);
  else assert.equal(p.dock, "float", `${what}: the panel floats where no bar holds it`);
}

test("Full screen gives the board the whole screen with a panel holding the score laid in its black bar, F and Esc put it back, and a new question mid-game puts it back too", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await s.page.setViewportSize({ width: 1600, height: 900 });
  await handTicks(s);
  await openPicker(s);
  const btn = s.page.locator("#activities-full");
  assert.ok(await btn.isHidden(), "no Full screen on the picker");
  await s.page.locator('.activities-card[data-activity="snake"]').click();
  await until(async () => (await overlay(s)) !== "", 5000);
  const before = await fullParts(s);
  assert.ok(!before.full && !before.rail && !before.scoreInRail, "the window opens at its own size, with no panel");

  await btn.click();
  await until(async () => (await fullParts(s)).full, 5000);
  const big = await fullParts(s);
  assert.equal(Math.round(big.stage.w), big.vw, "the stage is as wide as the screen");
  assert.equal(Math.round(big.stage.h), big.vh, "and as tall");
  assert.ok(big.canvas.h >= big.vh - 40, `the board takes (nearly) the whole height: ${big.canvas.h} of ${big.vh}`);
  assert.ok(big.canvas.w * big.canvas.h > before.canvas.w * before.canvas.h, "and grows");
  assertLaidOut(big, "Snake");
  assert.equal(big.dock, "side", "Snake's square on a wide screen docks the panel in the side bar");
  assert.ok(big.scoreInRail, "the score line moves into the panel");
  assert.equal(big.railTitle, "Snake", "which names the game");
  assert.equal(await s.page.locator("#activities-rail-best").innerText(), "No best yet");
  assert.equal(await s.page.evaluate(() => document.activeElement.id), "activities-board", "keys go back to the board");
  await s.page.keyboard.press(" ");
  await step(s, 3);
  assert.match(await s.page.locator("#activities-rail").innerText(), /Score: \d/, "the score shows in the panel while playing");
  await s.page.keyboard.press("p");

  await s.page.keyboard.press("f");
  const back = await fullParts(s);
  assert.ok(!back.full && !back.rail && !back.scoreInRail, "F puts it back, the score under the board again");
  await s.page.keyboard.press("f");
  assert.ok((await fullParts(s)).full, "and F fills it again");
  await s.page.click("#activities-rail-exit");
  assert.ok(!(await fullParts(s)).full, "the panel's Exit full screen puts it back");
  await s.page.keyboard.press("f");
  await s.page.keyboard.press("Escape");
  await until(async () => !(await fullParts(s)).full, 5000);
  assert.ok(await s.page.locator("#activities-modal[open]").isVisible(), "Esc leaves full screen before it closes the window");

  await s.page.keyboard.press("f");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "a running game");
  await step(s, 3);
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }], agent: { status: "waiting" } });
  await pausedNow(s);
  assert.ok(!(await fullParts(s)).full, "the question puts the window back to its size");
  assert.equal(await btn.innerText(), "Full screen");
  assert.ok(await s.page.locator("#activities-banner").isVisible(), "with the banner showing");
});

test("Full screen on a screen the board fills floats the panel over its corner, and a round in play with the pointer still shrinks it to the score line", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await s.page.setViewportSize({ width: 1600, height: 900 });
  await handTicks(s);
  await openActivities(s, "ghoul");
  await s.page.keyboard.press("f");
  await until(async () => (await fullParts(s)).dock === "float", 5000);
  assertLaidOut(await fullParts(s), "Ghoul Rush at 1600x900");
  const title = s.page.locator("#activities-rail-title");
  assert.ok(await title.isVisible(), "before a round the whole panel shows");
  await s.page.keyboard.press(" ");
  await step(s, 1, 0);
  for (let i = 0; i < 4; i++) await step(s, 1, 1000);
  assert.equal(await overlay(s), "", "playing");
  await step(s, 3);
  await until(async () => !(await title.isVisible()), 5000);
  assert.ok(await s.page.locator("#activities-rail .activities-score").isVisible(), "the score line stays");
  await s.page.mouse.move(200, 200);
  await s.page.mouse.move(220, 210);
  await until(async () => await title.isVisible(), 5000);
  await s.page.keyboard.press("p");
  assert.ok(await title.isVisible(), "a pause keeps the whole panel");
});

test("Full screen lays every game out on wide, 16:10, ultrawide and tall screens: the board as big as the screen allows, the panel docked in a bar that holds it or floating over the board", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  const screens = [[1920, 1080], [1440, 900], [2560, 1080], [900, 1400]];
  const ids = (await s.page.evaluate(async () => (await import("/activities.js")).ACTIVITIES.map((a) => a.id))).filter((id) => id !== "golf");
  for (const id of [...ids, "golf"]) {
    await s.page.setViewportSize({ width: 1600, height: 900 });
    await openActivities(s, id);
    await s.page.keyboard.press("f");
    for (const [w, h] of screens) {
      await s.page.setViewportSize({ width: w, height: h });
      // The resize event lays the game out a frame after the stage changes.
      await until(async () => {
        const p = await fullParts(s);
        if (!p.full || Math.round(p.stage.w) !== w || Math.round(p.stage.h) !== h) return false;
        try {
          assertLaidOut(p, "");
          return true;
        } catch {
          return false;
        }
      }, 5000);
      const p = await fullParts(s);
      assertLaidOut(p, `${id} at ${w}x${h}`);
      if (w === 2560) assert.equal(p.dock, "side", `${id} at ${w}x${h}: an ultrawide screen docks the panel at the side`);
    }
    await s.page.keyboard.press("Escape");
    await s.page.keyboard.press("Escape");
    await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  }
});

// A stand-in AudioContext that counts the oscillators made, so a test can
// tell whether a sound played.
const COUNT_SOUNDS = () => {
  window.__oscillators = 0;
  const node = () => ({ connect() {}, start() {}, stop() {}, disconnect() {}, frequency: param(), gain: param(), Q: param(), type: "" });
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  window.AudioContext = class {
    state = "running";
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    resume() { return Promise.resolve(); }
    createOscillator() { window.__oscillators++; return node(); }
    createGain() { return node(); }
    createBiquadFilter() { return node(); }
    createDynamicsCompressor() { return { ...node(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
    createBuffer() { return { getChannelData: () => new Float32Array(1) }; }
    createBufferSource() { return { ...node(), buffer: null, playbackRate: param(), loop: false }; }
  };
};

test("Play game sounds in User Preferences silences the games and the countdown, Play sounds off grays it out, and Back to default turns it back on", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING, init: COUNT_SOUNDS });
  const played = () => s.page.evaluate(() => window.__oscillators);
  // Starts a fresh round with the 3, 2, 1, which plays a blip, and closes it.
  const countdown = async () => {
    await handTicks(s, 50);
    await openActivities(s);
    const before = await played();
    await s.page.keyboard.press(" ");
    await step(s, 3);
    const after = await played();
    await s.page.keyboard.press("Escape");
    await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
    return after - before;
  };
  assert.ok((await countdown()) > 0, "with game sounds on, the countdown plays");

  await s.page.click("#btn-looks");
  await s.page.click("#prefs-tab-sounds");
  const box = s.page.locator("#looks-activity-sounds");
  assert.equal(await box.isChecked(), true, "on by default");
  await box.uncheck();
  await s.page.waitForFunction(async () => ((await (await fetch("/looks")).json()).looks || {}).activitySounds === false);
  await s.page.locator("#looks-sound").uncheck();
  assert.equal(await box.isDisabled(), true, "Play sounds off grays it out");
  await s.page.locator("#looks-sound").check();
  assert.equal(await box.isDisabled(), false);
  assert.equal(await box.isChecked(), false, "and it keeps its own tick");
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("looks-modal").open);
  assert.equal(await countdown(), 0, "with game sounds off, nothing plays");

  await s.page.click("#btn-looks");
  await s.page.click("#prefs-tab-sounds");
  const tune = s.page.locator("#looks-game-music");
  assert.equal(await tune.isChecked(), false, "game music is off by default");
  await tune.check();
  await s.page.waitForFunction(async () => ((await (await fetch("/looks")).json()).looks || {}).gameMusic === true);
  await s.page.click("#looks-reset");
  await s.page.locator("#looks-activity-sounds:checked").waitFor();
  await s.page.waitForFunction(async () => ((await (await fetch("/looks")).json()).looks || {}).gameMusic === false);
  await s.page.waitForFunction(async () => ((await (await fetch("/looks")).json()).looks || {}).activitySounds === true);
});

test("a game with music has its own Music slider, at its default until moved, kept once moved, and dimmed while Play game music is off", async (t) => {
  savedLooks(t, { gameMusic: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  const slider = s.page.locator("#activities-music-level");
  await openActivities(s, "snake");
  assert.equal(await s.page.locator("#activities-music").isVisible(), false, "Snake has no music, so no slider");
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await openActivities(s, "ghoul");
  assert.equal(await slider.isVisible(), true, "Ghoul Rush has one");
  assert.equal(await boxValue(slider), "65", "at its default");
  assert.equal(await slider.isDisabled(), false);
  await fillBox(slider, "80");
  await s.page.waitForFunction(async () => ((await (await fetch("/looks")).json()).looks || {}).activityMusicGhoul === 80);
  assert.equal((await pageLooks(s)).activityMusicDrive, 70, "another game keeps its own");
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await s.page.evaluate(async () => {
    const { looks } = await import("/looks.js");
    looks.gameMusic = false;
  });
  await openActivities(s, "ghoul");
  assert.equal(await boxValue(slider), "80", "kept");
  assert.equal(await slider.isDisabled(), true, "Play game music off: dimmed");
  assert.match(await s.page.locator("#activities-music").getAttribute("title"), /Play game music/, "and says why");
});

test("the board is laid out again when the banner appears, so the canvas is never clipped", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }], agent: { status: "waiting" } });
  await pausedNow(s);
  const r = await s.page.evaluate(() => {
    const b = document.getElementById("activities-board").getBoundingClientRect();
    const c = document.getElementById("activities-canvas").getBoundingClientRect();
    return { b: [b.top, b.bottom, b.left, b.right], c: [c.top, c.bottom, c.left, c.right] };
  });
  assert.ok(r.c[0] >= r.b[0] && r.c[1] <= r.b[1] && r.c[2] >= r.b[2] && r.c[3] <= r.b[3], `canvas ${r.c} inside board ${r.b}`);
});

test("a held P or space does not repeat", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  await s.page.keyboard.down("p");
  await pausedNow(s);
  await s.page.keyboard.down("p");
  await s.page.keyboard.down("p");
  await s.page.keyboard.up("p");
  assert.ok((await overlay(s)).startsWith("Paused"), "a held P stays paused");
  await s.page.keyboard.down(" ");
  assert.equal(await overlay(s), "", "the first space plays");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.keyboard.down(" ");
  await s.page.keyboard.up(" ");
  assert.ok((await overlay(s)).startsWith("Paused"), "a repeat of a held space does nothing");
});

test("Enter starts a round, pauses it and plays on, and a held Enter acts once", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await openActivities(s);
  await s.page.keyboard.press("Enter");
  assert.equal(await overlay(s), "", "Enter starts a round");
  await step(s, 3);
  await s.page.keyboard.press("Enter");
  await pausedNow(s);
  await s.page.keyboard.press("Enter");
  assert.equal(await overlay(s), "", "Enter plays on");
  await s.page.keyboard.down("Enter");
  await pausedNow(s);
  await s.page.keyboard.down("Enter");
  await s.page.keyboard.up("Enter");
  assert.ok((await overlay(s)).startsWith("Paused"), "a repeat of a held Enter does nothing");
});

test("a window too small to play shows the bigger-window note and pauses, and P cannot play it unseen", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  await s.page.setViewportSize({ width: 420, height: 300 });
  const note = s.page.locator("#activities-note");
  await until(async () => (await note.isVisible()) && (await note.innerText()) === "Make the window bigger to play.", 5000);
  assert.ok(await s.page.locator("#activities-board").isHidden(), "the board is hidden");
  await step(s, 1);
  assert.equal(await framesWaiting(s), 0, "the game stopped");
  await s.page.keyboard.press("p");
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("ArrowUp");
  await s.page.keyboard.press("d");
  await step(s, 3);
  assert.equal(await framesWaiting(s), 0, "no game key plays a hidden board");

  await s.page.setViewportSize({ width: 1280, height: 800 });
  await until(() => s.page.locator("#activities-board").isVisible(), 5000);
  assert.ok(await note.isHidden(), "the note goes once it fits");
  assert.ok((await overlay(s)).startsWith("Paused"), "and it waits, paused");
});

test("with no keyboard-like pointer the window says Activities need a keyboard", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await s.page.evaluate(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q) => (q === "(any-pointer: fine)" ? { matches: false, media: q, addEventListener() {}, removeEventListener() {} } : real(q));
  });
  await s.page.click("#btn-activities");
  await s.page.locator("#activities-modal[open]").waitFor();
  const note = s.page.locator("#activities-note");
  await until(async () => (await note.innerText()) === "Activities need a keyboard.", 5000);
  assert.ok(await s.page.locator("#activities-board").isHidden(), "no board without a keyboard");
});

test("playing on after a turn pause puts the banner away until the next new question", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }], agent: { status: "waiting" } });
  await pausedNow(s);
  const banner = s.page.locator("#activities-banner");
  const unpause = s.page.locator("#activities-unpause");
  assert.ok(await banner.isVisible(), "the banner shows");
  assert.ok(await unpause.isVisible(), "with Unpause game beside Go to it");
  await s.page.locator("#activities-board").focus();
  for (const key of [" ", "p", "Enter", "ArrowUp", "d"]) {
    await s.page.keyboard.press(key);
    assert.ok((await overlay(s)).startsWith("Paused"), `${JSON.stringify(key)} does not play on while the turn holds the round`);
  }
  await s.page.click("#activities-overlay");
  assert.ok((await overlay(s)).startsWith("Paused"), "nor does a click on the overlay");
  assert.ok(await banner.isVisible(), "and the banner stays up");
  await unpause.click();
  assert.equal(await overlay(s), "", "Unpause game plays on");
  assert.ok((await framesWaiting(s)) > 0);
  assert.ok(await banner.isHidden(), "playing on puts the banner away");
  await step(s, 2);

  s.post({ items: [{ id: "q3", kind: "text", title: "When it runs", body: "How often?" }] });
  await pausedNow(s);
  assert.ok(await banner.isVisible(), "the next new question shows it again");
});

test("an arrow resumes a paused game and steers it in one press, and a held one does not", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    let state = "ready";
    window.__keys = [];
    const game = {
      id: "snake",
      title: "Snake",
      create: () => ({
        score: 0,
        get state() {
          return state;
        },
        start: () => (state = "running"),
        pause: () => state === "running" && (state = "paused"),
        resume: () => state === "paused" && (state = "running"),
        key: (name) => {
          window.__keys.push(`${state}:${name}`);
          if (name === "action" && state !== "running") state = "running";
          return true;
        },
        tick: () => {},
        resize: () => true,
      }),
    };
    m.setActivityList([{ id: "snake", title: "Snake", game }]);
  });
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.evaluate(() => {
    window.__keys = [];
    document.getElementById("activities-board").dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp", repeat: true, bubbles: true }));
  });
  assert.ok((await overlay(s)).startsWith("Paused"), "a held arrow does not resume");
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "", "an arrow plays on");
  assert.ok((await framesWaiting(s)) > 0, "the frame timer runs again");
  assert.deepEqual(await s.page.evaluate(() => window.__keys), ["running:up"], "the same press steers, after the resume");

  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.evaluate(() => (window.__keys = []));
  await s.page.keyboard.press("d");
  assert.equal(await overlay(s), "", "W/A/S/D play on too");
  assert.deepEqual(await s.page.evaluate(() => window.__keys), ["running:right"]);
});

test("the real Snake plays on from a pause with an arrow", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.keyboard.press("ArrowDown");
  assert.equal(await overlay(s), "", "an arrow plays on");
  assert.ok((await framesWaiting(s)) > 0);
});

test("a finish pauses the game and says Plan2Code is finished", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  s.post({ finish: { headline: "The plan is done", body: "All written down." } });
  await pausedNow(s);
  assert.match(await s.page.locator("#activities-banner").innerText(), /Plan2Code is finished/);
  await step(s, 5);
  assert.ok((await overlay(s)).startsWith("Paused"), "nothing resumes by itself");
  await s.page.keyboard.press(" ");
  assert.ok((await overlay(s)).startsWith("Paused"), "space does not play on while the finish holds the round");
  await s.page.click("#activities-unpause");
  assert.equal(await overlay(s), "", "Unpause game plays on");
  assert.ok(await s.page.locator("#activities-banner").isHidden(), "playing on puts the finish banner away too");
});

test("after Go to it or a close, a round held by a question plays on from a game key when the window opens again", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }], agent: { status: "waiting" } });
  await pausedNow(s);
  await s.page.click("#activities-goto");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await s.page.click("#btn-activities");
  await s.page.locator("#activities-modal[open]").waitFor();
  await until(async () => (await overlay(s)).startsWith("Paused"), 5000);
  assert.ok(await s.page.locator("#activities-unpause").isHidden(), "no Unpause game once the person went to it");
  await s.page.locator("#activities-board").focus();
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays on again");

  s.post({ items: [{ id: "q3", kind: "text", title: "When it runs", body: "How often?" }] });
  await pausedNow(s);
  assert.ok(await s.page.locator("#activities-unpause").isVisible(), "the next question holds the round again");
  await s.page.click("#activities-close");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  await s.page.click("#btn-activities");
  await s.page.locator("#activities-modal[open]").waitFor();
  await until(async () => (await overlay(s)).startsWith("Paused"), 5000);
  await s.page.locator("#activities-board").focus();
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "", "after a close, an arrow plays on");
});

test("a hidden page and a window blur each pause the game, and neither resumes it", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  await s.page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await pausedNow(s);
  await s.page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await step(s, 3);
  assert.ok((await overlay(s)).startsWith("Paused"), "showing the page again does not resume");

  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "");
  await s.page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await pausedNow(s);
  await s.page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await step(s, 3);
  assert.ok((await overlay(s)).startsWith("Paused"), "coming back to the window does not resume");
});

/* -------------------------------------------------------- saved state */

// A stand-in for Snake under Snake's own id, so its best is saved under the
// real key: space starts a round, and "up" ends it with `score` points.
async function listScoringSnake(s, score) {
  await s.page.evaluate(async (score) => {
    const m = await import("/screens/activities.js");
    let state = "ready";
    const game = {
      id: "snake",
      title: "Snake",
      create: ({ onScore }) => ({
        get score() {
          return state === "ready" ? 0 : score;
        },
        get state() {
          return state;
        },
        start: () => (state = "running"),
        pause: () => state === "running" && (state = "paused"),
        resume: () => state === "paused" && (state = "running"),
        key: (name) => {
          if (name === "action" && state !== "running") state = "running";
          else if (name === "up" && state === "running") {
            state = "over";
            onScore(score);
          }
          return true;
        },
        tick: () => {},
        resize: () => true,
      }),
    };
    m.setActivityList([{ id: "snake", title: "Snake", game }]);
  }, score);
}

// Lets the real Snake run on, a few frames at a time, until it hits a wall.
async function playToTheEnd(s) {
  for (let i = 0; i < 400 && !(await overlay(s)).startsWith("Score:"); i++) await step(s, 5, 200);
  assert.ok((await overlay(s)).startsWith("Score:"), "the round ended");
}

test("a best score saved in one session is shown in a new session on a new port", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const first = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(first);
  await listScoringSnake(first, 7);
  await openActivities(first);
  await first.page.keyboard.press(" ");
  await first.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(first), "Score: 7\nBest: 7\nPress space to play again", "the over state shows the best");
  await until(async () => (await serverLooks(first)).activityBestSnake === 7, 5000);
  await first.stop();

  const second = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  assert.notEqual(new URL(second.url).port, new URL(first.url).port, "a new port");
  assert.equal((await serverLooks(second)).activityBestSnake, 7);
  await startGame(second);
  // Not the exact score: food can land right ahead of the snake in its first step.
  assert.match(await second.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 7$/, "the best sits beside the score while playing");
  await playToTheEnd(second);
  assert.match(await overlay(second), /^Score: \d+\nBest: 7\n/, "the real Snake's over state shows the saved best");
});

test("the score line is chips with a meter toward the best, glows on reaching it, and sparks once on passing it", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 7 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listScoringSnake(s, 7);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await step(s, 2);
  const line = s.page.locator("#activities-score");
  assert.equal(await line.innerText(), "Score: 7 · Best: 7", "the chips still read as the plain line");
  assert.equal(await line.locator(".activities-chip").count(), 2);
  assert.equal(await line.locator(".activities-meter").count(), 1, "a meter toward a saved best");
  assert.match(await line.getAttribute("class"), /tied/, "reaching the best lights it");
  assert.equal(await s.page.locator(".activities-spark").count(), 0, "no sparks for a tie");
  await s.page.keyboard.press("ArrowUp");
  assert.doesNotMatch(await s.page.locator("#activities-overlay").getAttribute("class"), /record/, "a tie is not a new best");
});

test("passing the best mid-round turns the line to a rainbow with sparks, once, and the end screen says New best", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 5 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listScoringSnake(s, 9);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await step(s, 2);
  const line = s.page.locator("#activities-score");
  assert.equal(await line.innerText(), "Score: 9 · Best: 5");
  assert.match(await line.getAttribute("class"), /passed/);
  const sparks = await s.page.locator(".activities-spark").count();
  assert.ok(sparks > 0, "the sparks fire");
  await step(s, 3);
  assert.ok((await s.page.locator(".activities-spark").count()) <= sparks, "and only once a round");
  assert.match(await line.getAttribute("class"), /burst/, "the burst plays");
  await until(async () => !/burst/.test(await line.getAttribute("class")), 5000);
  assert.match(await line.getAttribute("class"), /passed/, "then the line settles, still marked as a record");
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "Score: 9\nBest: 9\nPress space to play again", "the overlay's text is unchanged");
  assert.match(await s.page.locator("#activities-overlay").getAttribute("class"), /record/, "the end screen marks the new best");
  await s.page.keyboard.press(" ");
  assert.doesNotMatch(await s.page.locator("#activities-overlay").getAttribute("class") || "", /record/, "a new round forgets it");
});

test("a half-played round saves nothing, and a round below the best keeps it", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 9 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listScoringSnake(s, 4);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("Escape");
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  // The page's copy first: a wrong save changes it at once, before its POST lands.
  assert.equal((await pageLooks(s)).activityBestSnake, 9, "closing mid-round saves nothing");
  assert.equal((await serverLooks(s)).activityBestSnake, 9);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "Score: 4\nBest: 9\nPress space to play again", "a lower score keeps the best");
  assert.equal((await pageLooks(s)).activityBestSnake, 9);
  assert.equal((await serverLooks(s)).activityBestSnake, 9);
});

test("the header shows the game's best: none at first, then the saved one, and none again after Reset", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listScoringSnake(s, 7);
  await openActivities(s);
  const title = s.page.locator("#activities-title");
  assert.equal(await title.innerText(), "Activities · Snake: no best yet");
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("ArrowUp");
  await until(async () => (await title.innerText()) === "Activities · Snake best: 7", 5000);
  const reset = s.page.locator("#activities-reset");
  await reset.click();
  await reset.click();
  assert.equal(await title.innerText(), "Activities · Snake: no best yet", "Reset clears the header's best");
});

// A game that plays by pointer and keeps its lowest round as the best,
// listed under Snake's id so its best rides in activityBestSnake. Every
// pointer call lands in window.__pointer; the up key ends a round at
// window.__score, so listing it again changes the next round's score.
async function listPointerGame(s, score) {
  await s.page.evaluate(async (score) => {
    const m = await import("/screens/activities.js");
    let state = "ready";
    window.__pointer = [];
    window.__score = score;
    const game = {
      id: "snake",
      title: "Golf stub",
      lowerIsBetter: true,
      create: ({ onScore }) => ({
        get score() {
          return state === "ready" ? 0 : window.__score;
        },
        get state() {
          return state;
        },
        start: () => (state = "running"),
        pause: () => state === "running" && (state = "paused"),
        resume: () => state === "paused" && (state = "running"),
        key: (name) => {
          if (name === "action" && state !== "running") state = "running";
          else if (name === "up" && state === "running") {
            state = "over";
            onScore(window.__score);
          }
          return name === "action" || name === "up";
        },
        pointer: (type, x, y) => {
          window.__pointer.push({ type, state, x: Math.round(x), y: Math.round(y) });
          return state === "running";
        },
        tick: () => {},
        resize: () => true,
      }),
    };
    m.setActivityList([{ id: "snake", title: "Golf stub", game }]);
  }, score);
}

test("a lowerIsBetter game's first round is its best", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listPointerGame(s, 14);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("ArrowUp");
  await until(async () => (await serverLooks(s)).activityBestSnake === 14, 5000);
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Golf stub best: 14");
});

test("a lowerIsBetter game saves a lower round over a higher best, and keeps the best on a higher one", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 12 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listPointerGame(s, 5);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("ArrowUp");
  await until(async () => (await serverLooks(s)).activityBestSnake === 5, 5000);
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Golf stub best: 5");

  await listPointerGame(s, 9);
  await s.page.keyboard.press(" ");
  await s.page.keyboard.press("ArrowUp");
  assert.match(await overlay(s), /^Score: 9\nBest: 5\n/, "a higher round keeps the lower best");
  assert.equal((await pageLooks(s)).activityBestSnake, 5);
});

test("a drag on the board reaches a pointer game, a question mid-drag cancels it, and Unpause game, not a press on the board, plays on", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listPointerGame(s, 3);
  await openActivities(s);
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "running");
  const box = await s.page.locator("#activities-canvas").boundingBox();
  const at = (dx, dy) => [box.x + dx, box.y + dy];
  await s.page.mouse.move(...at(40, 40));
  await s.page.mouse.down();
  await s.page.mouse.move(...at(20, 30));
  await s.page.mouse.up();
  // A hover before the press reaches the game too; the drag is from the press on.
  const all = await s.page.evaluate(() => window.__pointer.map((p) => p.type));
  const drag = all.slice(all.indexOf("down"));
  assert.deepEqual([drag[0], drag.at(-1)], ["down", "up"], "the drag starts and ends");
  assert.ok(drag.includes("move"), "and moves between");
  assert.deepEqual(await s.page.evaluate(() => window.__pointer.find((p) => p.type === "down")), { type: "down", state: "running", x: 40, y: 40 }, "in CSS pixels from the canvas corner");

  await s.page.evaluate(() => (window.__pointer = []));
  await s.page.mouse.move(...at(40, 40));
  await s.page.mouse.down();
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }], agent: { status: "waiting" } });
  await pausedNow(s);
  await s.page.mouse.up();
  const types = await s.page.evaluate(() => window.__pointer.map((p) => p.type));
  assert.ok(types.includes("cancel"), "the pause cancels the drag");
  assert.ok(await s.page.locator("#activities-banner").isVisible());

  await s.page.evaluate(() => (window.__pointer = []));
  // The banner pushed the board down: measure the canvas again.
  const moved = await s.page.locator("#activities-canvas").boundingBox();
  await s.page.mouse.click(moved.x + 8, moved.y + 8);
  assert.ok((await overlay(s)).startsWith("Paused"), "a press on the board does not play on while the question holds the round");
  await s.page.click("#activities-unpause");
  assert.equal(await overlay(s), "", "Unpause game plays on");
  assert.ok(await s.page.locator("#activities-banner").isHidden(), "and puts the banner away");
  assert.deepEqual(
    (await s.page.evaluate(() => window.__pointer)).filter((p) => p.type === "down" || p.type === "up"),
    [],
    "the press that played on starts no drag, and its release reaches nothing",
  );

  // P with the button held drops the drag too, and its release reaches nothing.
  await s.page.evaluate(() => (window.__pointer = []));
  await s.page.mouse.move(moved.x + 40, moved.y + 40);
  await s.page.mouse.down();
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.mouse.up();
  const held = await s.page.evaluate(() => window.__pointer.map((p) => p.type));
  assert.ok(held.includes("cancel"), "P cancels the drag");
  assert.ok(!held.slice(held.indexOf("cancel")).includes("up"), "the release after the cancel reaches nothing");
});

/* ------------------------------------------------------------ Mini golf */

// Lists the real Mini golf, wrapped only so the test can reach the round it
// plays (window.__golf), then opens the window and picks it.
async function openGolf(s) {
  await handTicks(s);
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const golf = (await import("/activities/golf.js")).default;
    const watched = { ...golf, create: (opts) => (window.__golf = golf.create(opts)) };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "golf" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "golf");
  await until(async () => (await overlay(s)) === "Press space or click to start", 5000);
}

// Where the ball is on screen, in page pixels: the course is 400 units wide.
const ballOnScreen = (s) =>
  s.page.evaluate(() => {
    const r = document.getElementById("activities-canvas").getBoundingClientRect();
    const k = r.width / 400;
    const b = window.__golf.round.ball;
    return { x: r.left + b.x * k, y: r.top + b.y * k };
  });

const golfRound = (s) =>
  s.page.evaluate(() => {
    const r = window.__golf.round;
    return { strokes: r.strokes, phase: r.phase, x: r.ball.x, y: r.ball.y, swingMs: r.swingMs };
  });

// Aims at the spot (dx, dy) page pixels from the ball, clicks there to start
// the meter, puts the needle `ms` into its trip, and clicks again to putt.
async function swingAt(s, dx, dy, ms = 600) {
  const b = await ballOnScreen(s);
  await s.page.mouse.move(b.x + dx, b.y + dy);
  await s.page.mouse.click(b.x + dx, b.y + dy);
  await s.page.evaluate((ms) => (window.__golf.round.swingMs = ms), ms);
  await s.page.mouse.click(b.x + dx, b.y + dy);
}

test("Mini golf: the aim follows the mouse, a click starts the meter, and a second click putts toward the mouse", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openGolf(s);
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "running");
  const tee = await golfRound(s);
  const b = await ballOnScreen(s);
  await s.page.mouse.move(b.x + 120, b.y);
  await s.page.mouse.click(b.x + 120, b.y);
  assert.equal((await golfRound(s)).phase, "swing", "the click started the meter");
  await step(s, 30, 16);
  assert.ok((await golfRound(s)).swingMs >= 400, "and it runs on the window's frames");
  await s.page.mouse.click(b.x + 120, b.y);
  const hit = await golfRound(s);
  assert.equal(hit.strokes, 1, "one stroke");
  assert.equal(hit.phase, "rolling");
  assert.equal(await s.page.locator("#activities-score").innerText(), "Score: 1 · Best: none yet", "golf's lowest-wins best of 0 reads as none");
  await step(s, 20, 16);
  const rolled = await golfRound(s);
  assert.ok(rolled.x > tee.x + 20, `aimed right, it rolls right (from ${tee.x} to ${rolled.x})`);
});

// Starts a round and drops the ball into the last hole's cup, so the round
// is over on the next frames.
async function finishGolf(s) {
  await s.page.keyboard.press(" ");
  await s.page.evaluate(async () => {
    const { holesOf } = await import("/activities/golf.js");
    const r = window.__golf.round;
    r.hole = holesOf(r).length - 1;
    const { cup } = holesOf(r)[r.hole];
    Object.assign(r.ball, { x: cup.x, y: cup.y, vx: 1, vy: 0, moving: true });
    r.strokes = 1;
    r.putts = 1;
    r.phase = "rolling";
  });
  await step(s, 5, 16);
  await until(async () => /pick a course/.test(await overlay(s)), 5000);
}

test("Mini golf: once the round is over, space or a click goes back to the course dashboard rather than replaying the course, and the course picked there starts fresh", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openGolf(s);
  await finishGolf(s);
  assert.match(await overlay(s), /Press space or click to pick a course/);
  await s.page.keyboard.press(" ");
  await until(async () => (await courseCard(s, "pirate").count()) === 1, 5000);
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Mini golf: pick a course");
  assert.equal(await s.page.locator("#activities-board").isVisible(), false, "the board is put away");
  assert.match(await courseCard(s, "pirate").innerText(), /Last played/);
  await courseCard(s, "pirate").click();
  await until(async () => (await overlay(s)) === "Press space or click to start", 5000);
  assert.equal((await s.page.evaluate(() => window.__golf.round.hole)), 0, "a fresh round from hole 1");

  await finishGolf(s);
  await s.page.locator("#activities-overlay").click();
  await until(async () => (await courseCard(s, "pirate").count()) === 1, 5000);
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Mini golf: pick a course", "a click on the finish goes back too");
});

test("Mini golf: a held arrow turns the aim until it is let go, and holding space fast-forwards a roll until it is let go", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openGolf(s);
  await s.page.keyboard.press(" ");
  const aim = () => s.page.evaluate(() => window.__golf.round.aimAngle);
  const clock = () => s.page.evaluate(() => window.__golf.round.clock);

  const before = await aim();
  await s.page.keyboard.down("ArrowRight");
  await step(s, 10, 16);
  await s.page.keyboard.up("ArrowRight");
  const turned = await aim();
  assert.ok(turned > before + Math.PI / 180, `held, it turned (from ${before} to ${turned})`);
  await step(s, 10, 16);
  assert.equal(await aim(), turned, "let go, it stops");

  await swingAt(s, 0, -120);
  assert.equal((await golfRound(s)).phase, "rolling");
  await s.page.keyboard.down(" ");
  let at = await clock();
  await step(s, 5, 16);
  const fast = (await clock()) - at;
  assert.ok(Math.abs(fast - 240) <= 8, `held space plays the roll three times as fast (${fast} ms in 80)`);
  await s.page.keyboard.up(" ");
  at = await clock();
  await step(s, 5, 16);
  const plain = (await clock()) - at;
  assert.ok(Math.abs(plain - 80) <= 8, `let go, it plays at its own speed (${plain} ms in 80)`);
  assert.equal((await golfRound(s)).strokes, 1, "and holding space putts nothing");
});

test("Mini golf: a question mid-swing holds the meter with no stroke, one mid-roll stops the ball, and only Unpause game plays on", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openGolf(s);
  await s.page.keyboard.press(" ");
  const banner = s.page.locator("#activities-banner");

  const b = await ballOnScreen(s);
  await s.page.mouse.click(b.x + 100, b.y);
  await step(s, 5, 16);
  s.post({ items: [{ id: "q2", kind: "text", title: "Who uses it", body: "Who opens the export?" }], agent: { status: "waiting" } });
  await pausedNow(s);
  const held = await golfRound(s);
  assert.equal(held.phase, "swing");
  await step(s, 10, 16);
  assert.deepEqual(await golfRound(s), held, "the meter holds still while paused");
  assert.equal(held.strokes, 0, "with no stroke");
  assert.ok(await banner.isVisible());

  // The banner pushed the board down: a click on the board stays paused,
  // and Unpause game plays on.
  const box = await s.page.locator("#activities-canvas").boundingBox();
  await s.page.mouse.click(box.x + 8, box.y + 8);
  assert.ok((await overlay(s)).startsWith("Paused"), "a click on the board waits for Unpause game");
  await s.page.click("#activities-unpause");
  assert.equal(await overlay(s), "", "Unpause game plays on");
  assert.ok(await banner.isHidden(), "and puts the banner away");
  const resumed = await golfRound(s);
  assert.equal(resumed.strokes, 0, "that click putts nothing");
  assert.equal(resumed.phase, "swing", "the meter is still up");

  await s.page.evaluate(() => (window.__golf.round.swingMs = 600));
  await s.page.mouse.click(box.x + 8, box.y + 8);
  assert.equal((await golfRound(s)).strokes, 1, "the next click putts");
  await step(s, 6, 16);
  assert.equal((await golfRound(s)).phase, "rolling");
  s.post({ items: [{ id: "q3", kind: "text", title: "When it runs", body: "How often?" }] });
  await pausedNow(s);
  const stopped = await golfRound(s);
  await step(s, 10, 16);
  assert.deepEqual(await golfRound(s), stopped, "the ball holds still where the pause caught it");
  assert.ok(await banner.isVisible(), "the next new question shows the banner again");

  await s.page.click("#activities-unpause");
  await s.page.locator("#activities-board").focus();
  assert.equal(await overlay(s), "", "Unpause game plays on again");
  assert.ok(await banner.isHidden());
  await step(s, 5, 16);
  assert.notDeepEqual(await golfRound(s), stopped, "and the ball rolls on");
});

test("Mini golf: a full round saves its total as its course's best, a lower one replaces it, a higher one does not, each course keeps its own, and Reset clears them all", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 9 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openGolf(s);
  const title = s.page.locator("#activities-title");
  assert.equal(await title.innerText(), "Activities · Mini golf, Pirate Cove: no best yet");
  // Plays all eighteen holes through the game's own calls, each in `each`
  // strokes: the ball set down beside the cup, extra strokes counted first.
  const playRound = (each) =>
    s.page.evaluate(async (each) => {
      const { courseById } = await import("/activities/golf-holes.js");
      const g = window.__golf;
      const HOLES = courseById(g.course).holes;
      if (g.state !== "running") g.key("action");
      for (let h = 0; h < HOLES.length; h++) {
        const cup = HOLES[g.round.hole].cup;
        g.round.strokes = each - 1;
        Object.assign(g.round.ball, { x: cup.x - 10, y: cup.y });
        g.round.aimAngle = 0;
        // The meter up, then set about a tenth of the way up: a soft putt.
        g.key("action");
        g.round.swingMs = 200;
        g.key("action");
        g.tick(3000);
        if (h < HOLES.length - 1) g.key("action");
      }
      return g.state;
    }, each);
  const golfBest = async (course = "Pirate") => (await serverLooks(s))[`activityBestGolf${course}`];

  assert.equal(await playRound(2), "over");
  await until(async () => (await golfBest()) === 36, 5000);
  assert.equal(await title.innerText(), "Activities · Mini golf, Pirate Cove best: 36", "a first round is the best");
  assert.equal(await playRound(1), "over");
  await until(async () => (await golfBest()) === 18, 5000);
  assert.equal(await title.innerText(), "Activities · Mini golf, Pirate Cove best: 18", "lower is better");
  assert.equal(await playRound(3), "over");
  await step(s, 2);
  assert.equal((await pageLooks(s)).activityBestGolfPirate, 18, "a higher round keeps the best");
  assert.equal(await golfBest(), 18);
  assert.equal(await title.innerText(), "Activities · Mini golf, Pirate Cove best: 18");

  // The dashboard shows each course's own best; another course starts with none.
  await s.page.click("#activities-back");
  await courseCard(s, "pirate").waitFor();
  assert.match(await courseCard(s, "pirate").innerText(), /Best round: 18 \(-\d+\)/);
  assert.match(await courseCard(s, "space").innerText(), /No best yet/);
  assert.equal(await s.page.locator("#activities-picker .activities-course canvas").count(), 6, "each course card has its art");
  await courseCard(s, "space").click();
  await until(async () => (await overlay(s)) === "Press space or click to start", 5000);
  assert.equal(await title.innerText(), "Activities · Mini golf, Cosmic Glow: no best yet");
  assert.equal(await playRound(2), "over");
  await until(async () => (await golfBest("Space")) === 36, 5000);
  assert.equal(await golfBest(), 18, "Pirate Cove's best is its own");
  await s.page.click("#activities-back");
  await courseCard(s, "pirate").waitFor();
  await s.page.click("#activities-back");
  assert.match(await card(s, "golf").innerText(), /Best on 2 of 6 courses/);

  const reset = s.page.locator("#activities-reset");
  await reset.click();
  await reset.click();
  await until(async () => (await golfBest()) === 0 && (await golfBest("Space")) === 0 && (await serverLooks(s)).activityBestSnake === 0, 5000);
  assert.match(await card(s, "golf").innerText(), /6 courses to play/);
});

test("Mini golf running breaks no content-security rule and logs no error", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  const consoleErrors = [];
  s.page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await s.context.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`),
    );
  });
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await openGolf(s);
  await s.page.keyboard.press(" ");
  await swingAt(s, 120, 0);
  await step(s, 30, 16);
  assert.deepEqual(await s.page.evaluate(() => window.__violations), [], "no content-security violations");
  assert.deepEqual(consoleErrors, [], "no console errors");
});

test("saved Activities values that do not hold up fall back to their defaults", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: -5, hideActivities: "yes", lastActivity: 5 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  const looks = await pageLooks(s);
  assert.equal(looks.activityBestSnake, 0, "a negative best is none");
  assert.equal(looks.hideActivities, false, "a switch that is not a boolean is on");
  assert.equal(looks.lastActivity, "", "a last pick that is not a string is none");
  await iconUsable(s, "a skill screen");

  fs.writeFileSync(LOOKS_FILE, JSON.stringify({ looks: { welcomeSeen: true, activityBestSnake: 3.7 } }));
  const again = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  assert.equal((await pageLooks(again)).activityBestSnake, 3, "a best is a whole number");
});

test("Back to default turns Show Activities back on and keeps the best scores", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 12, lastActivity: "snake", hideActivities: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  assert.ok(await s.page.locator("#btn-activities").isHidden(), "the saved switch hides the die");
  await s.page.click("#btn-looks");
  await s.page.click("#prefs-tab-sounds");
  await s.page.locator("#looks-modal[open]").waitFor();
  await s.page.click("#looks-reset");
  await s.page.click("#looks-done");
  await iconUsable(s, "a skill screen after Back to default");
  await until(async () => (await serverLooks(s)).hideActivities === false, 5000);
  const saved = await serverLooks(s);
  assert.equal(saved.activityBestSnake, 12, "the best score stays");
  assert.equal(saved.lastActivity, "snake", "the last pick stays");
});

test("Reset best scores asks once inside the window, then writes 0", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 12 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  await listScoringSnake(s, 3);
  await openActivities(s);
  const reset = s.page.locator("#activities-reset");
  assert.equal(await reset.innerText(), "Reset best scores");
  await reset.click();
  assert.equal(await reset.innerText(), "Reset? Click again", "the first click only asks");
  assert.equal((await serverLooks(s)).activityBestSnake, 12, "nothing is cleared yet");
  assert.equal(await s.page.locator("dialog[open]").count(), 1, "the confirm stays inside the window");
  await reset.click();
  assert.equal(await reset.innerText(), "Reset best scores");
  await until(async () => (await serverLooks(s)).activityBestSnake === 0, 5000);
  await s.page.locator("#activities-board").focus();
  await s.page.keyboard.press(" ");
  assert.equal(await s.page.locator("#activities-score").innerText(), "Score: 3 · Best: 0", "the window shows the cleared best");
});

test("Show Activities in User Preferences hides the die on the dashboard and on a skill screen", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const dash = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await pastTheIntro(dash);
  await iconUsable(dash, "the dashboard");
  await dash.page.click("#btn-looks");
  await dash.page.click("#prefs-tab-sounds");
  await dash.page.locator("#looks-modal[open]").waitFor();
  const box = dash.page.locator("#looks-activities");
  assert.ok(await box.isChecked(), "on by default");
  await box.uncheck();
  await dash.page.click("#looks-done");
  assert.ok(await dash.page.locator("#btn-activities").isHidden(), "the die is gone from the dashboard");
  await until(async () => (await serverLooks(dash)).hideActivities === true, 5000);

  const skill = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_QUESTION });
  assert.ok(await skill.page.locator("#btn-activities").isHidden(), "and from a skill screen in a new session");
  await skill.page.click("#btn-looks");
  await skill.page.click("#prefs-tab-sounds");
  await skill.page.locator("#looks-modal[open]").waitFor();
  assert.equal(await skill.page.locator("#looks-activities").isChecked(), false, "the switch shows what was saved");
  await skill.page.locator("#looks-activities").check();
  await skill.page.click("#looks-done");
  await iconUsable(skill, "a skill screen once switched back on");
});

test("switching Show Activities off mid-game closes the window, paused", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await startGame(s);
  // The open window makes the gear unreachable by pointer, so the switch is
  // flipped from script, which still fires its change.
  await s.page.evaluate(() => document.getElementById("looks-activities").click());
  await s.page.waitForFunction(() => !document.getElementById("activities-modal").open);
  assert.ok(await s.page.locator("#btn-activities").isHidden(), "the die is hidden");
  await step(s, 1);
  assert.equal(await framesWaiting(s), 0, "a closed window does not tick");
  await s.page.evaluate(() => document.getElementById("looks-activities").click());
  await iconUsable(s, "the skill screen once switched back on");
  await openActivities(s);
  assert.ok((await overlay(s)).startsWith("Paused"), "the round waits, paused");
});

test("POST /looks takes hideActivities, lastActivity and activityBestSnake, and GET /looks returns them", async (t) => {
  savedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  const status = await s.page.evaluate(async () => {
    const res = await fetch("/looks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ looks: { hideActivities: true, lastActivity: "snake", activityBestSnake: 31 } }),
    });
    return res.status;
  });
  assert.equal(status, 200);
  const looks = await serverLooks(s);
  assert.equal(looks.hideActivities, true);
  assert.equal(looks.lastActivity, "snake");
  assert.equal(looks.activityBestSnake, 31);
});

test("a running game breaks no content-security rule and logs no error", async (t) => {
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  const consoleErrors = [];
  s.page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  await s.context.addInitScript(() => {
    window.__violations = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      window.__violations.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`),
    );
  });
  await s.page.reload({ waitUntil: "domcontentloaded" });
  await drawn(s.page);
  await startGame(s);
  await step(s, 10);
  assert.deepEqual(await s.page.evaluate(() => window.__violations), [], "no content-security violations");
  assert.deepEqual(consoleErrors, [], "no console errors");
  const styleTags = await s.page.evaluate(() => document.querySelectorAll("style").length);
  assert.equal(styleTags, 0, "no <style> element was added");
});

test("Rapids Run plays in the real window: its board's shape and Planny's skimmer big enough to read, Enter starts a round without leaving fire on, held arrows steer until let go and held up or down change the speed, held space fires until let go, a pause lets go of every key and holds the river still, space plays on, and the last life lost saves the best and the furthest dam", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  // The foes, bolts, buoys and crates are cleared before every tick and the
  // battery kept full, and the skimmer slides off the banks, so only the
  // keys move it.
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const rapids = (await import("/activities/rapids.js")).default;
    window.__calm = true;
    const watched = {
      ...rapids,
      create: (opts) => {
        const g = rapids.create(opts);
        const tick = g.tick;
        g.tick = (ms) => {
          const r = g.round;
          if (window.__calm && r) {
            r.foes.length = r.bolts.length = r.buoys.length = r.crates.length = 0;
            r.loaded = r.stretch + 1;
            r.battery = 100;
            r.ship.invuln = 1e9;
          }
          tick(ms);
        };
        return (window.__rapids = g);
      },
    };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "rapids" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "rapids");
  assert.equal(await overlay(s), "Press space to start");
  const { W, H, SHIP_L, CRUISE } = await s.page.evaluate(async () => {
    const { W, H, SHIP_L, CRUISE } = await import("/activities/rapids.js");
    return { W, H, SHIP_L, CRUISE };
  });
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - W / H) < 0.02, `a ${W} by ${H} board, not ${box.width} by ${box.height}`);
  const long = (box.width / W) * SHIP_L;
  assert.ok(long >= 20, `a skimmer 20 px long or more in a 1280 by 800 window (${long.toFixed(1)} px)`);
  const you = () =>
    s.page.evaluate(() => {
      const r = window.__rapids.round;
      return { ...r.input, x: r.ship.x, v: r.ship.v, d: r.ship.d, shots: r.shots.length, phase: r.phase, stretch: r.stretch, pace: 1 + Math.min(0.3, (r.stretch - 1) * 0.035) };
    });
  // Enter starts a round and has no release: it must not leave fire on.
  await s.page.keyboard.press("Enter");
  assert.equal(await overlay(s), "", "Enter starts a round");
  await step(s, 20, 16);
  let me = await you();
  assert.equal(me.fire, false, "the start leaves fire off");
  assert.equal(me.shots, 0, "and nothing is shot");
  assert.equal(me.phase, "run");
  // Held arrows steer until let go.
  await s.page.evaluate(async () => {
    const { riverAt } = await import("/activities/rapids.js");
    const r = window.__rapids.round;
    r.ship.x = riverAt(r.river, r.ship.d).c;
  });
  const x = (await you()).x;
  await s.page.keyboard.down("ArrowRight");
  await step(s, 6, 16);
  me = await you();
  assert.ok(me.right && me.x > x + 1, `held right steers right (${x} to ${me.x})`);
  await s.page.keyboard.up("ArrowRight");
  const right = await you();
  assert.equal(right.right, false, "let go, it stops steering");
  await s.page.keyboard.down("ArrowLeft");
  await step(s, 20, 16);
  me = await you();
  assert.ok(me.left && me.x < right.x - 1, `held left steers back (${right.x} to ${me.x})`);
  await s.page.keyboard.up("ArrowLeft");
  // Held up speeds up, held down slows, and let go it cruises again.
  await s.page.keyboard.down("ArrowUp");
  await step(s, 40, 16);
  me = await you();
  assert.ok(me.v > CRUISE * me.pace + 5, `held up speeds up (${me.v})`);
  await s.page.keyboard.up("ArrowUp");
  await s.page.keyboard.down("ArrowDown");
  await step(s, 60, 16);
  me = await you();
  assert.ok(me.v < CRUISE * me.pace - 5, `held down slows (${me.v})`);
  await s.page.keyboard.up("ArrowDown");
  await step(s, 60, 16);
  assert.ok(Math.abs((await you()).v - CRUISE * me.pace) < 0.01, "let go, it cruises");
  // Held space fires until let go.
  await s.page.keyboard.down(" ");
  await step(s, 10, 16);
  me = await you();
  assert.ok(me.fire && me.shots > 0, "held space fires");
  await s.page.keyboard.up(" ");
  assert.equal((await you()).fire, false, "let go, it stops");
  await step(s, 60, 16);
  assert.equal((await you()).shots, 0, "and the last shots fly off");
  // A pause lets go of every key and holds the river still.
  await s.page.keyboard.down("ArrowLeft");
  await s.page.keyboard.down("ArrowUp");
  await s.page.keyboard.down(" ");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = await you();
  assert.deepEqual([held.left, held.up, held.fire], [false, false, false], "a pause holds nothing");
  await step(s, 10, 16);
  assert.equal((await you()).d, held.d, "and the river holds still");
  await s.page.keyboard.up("ArrowLeft");
  await s.page.keyboard.up("ArrowUp");
  await s.page.keyboard.up(" ");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays on");
  await step(s, 4, 16);
  assert.ok((await you()).d > held.d, "and the river runs again");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  // Blast dam 1 and pass it (a new furthest), then lose the last life.
  await s.page.evaluate(async () => {
    const { riverAt } = await import("/activities/rapids.js");
    const r = window.__rapids.round;
    const dam = r.dam;
    dam.hp = 1;
    r.ship.d = dam.d - 30;
    r.ship.x = riverAt(r.river, r.ship.d).c;
    r.shots.push({ x: riverAt(r.river, dam.d).c, d: dam.d - 2, vx: 0, vd: 60 });
  });
  await until(async () => (await you()).stretch === 2 || (await step(s, 10, 16), false), 5000);
  await s.page.evaluate(async () => {
    const { lose } = await import("/activities/rapids.js");
    window.__calm = false;
    const r = window.__rapids.round;
    r.lives = 1;
    r.shield = 0;
    r.ship.invuln = 0;
    lose(r, "foe");
  });
  await step(s, 120, 16);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__rapids.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestRapids === score && looks.activityMemoRapids === 1;
  }, 5000);
});

test("Ghoul Rush plays in the real window: its board's shape and Planny big enough to read, Enter starts a round without leaving fire on, held arrows run until let go, up jumps once a press (never on its repeat, never with the press that plays on), held space fires until let go, a pause lets go of every key and holds a jump mid-air, a click on the paused board plays on, a stage is picked with space, and the last life lost saves the best and the most stages cleared", async (t) => {
  savedLooks(t, { welcomeSeen: true });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await handTicks(s);
  // Every spawner spent and the monsters, bones and shockwaves cleared
  // before every tick, so only the keys move Planny and nothing hits him.
  await s.page.evaluate(async () => {
    const m = await import("/screens/activities.js");
    const { ACTIVITIES } = await import("/activities.js");
    const ghoul = (await import("/activities/ghoul-rush/ghoul.js")).default;
    window.__calm = true;
    const watched = {
      ...ghoul,
      create: (opts) => {
        const g = ghoul.create(opts);
        const tick = g.tick;
        g.tick = (ms) => {
          const r = g.round;
          if (window.__calm && r) {
            for (const st of r.spawns) st.over = true;
            r.monsters.length = r.bones.length = r.waves.length = 0;
            r.bonus = 1000;
          }
          tick(ms);
        };
        return (window.__ghoul = g);
      },
    };
    m.setActivityList(ACTIVITIES.map((e) => (e.id === "ghoul" ? { ...e, game: watched } : e)));
  });
  await openActivities(s, "ghoul");
  assert.equal(await overlay(s), "Press space or click to start");
  const { W, H, YOU_H } = await s.page.evaluate(async () => {
    const { W, H, YOU_H } = await import("/activities/ghoul-rush/ghoul.js");
    return { W, H, YOU_H };
  });
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - W / H) < 0.02, `a ${W} by ${H} board, not ${box.width} by ${box.height}`);
  const tall = (box.width / W) * YOU_H;
  assert.ok(tall >= 20, `Planny 20 px tall or more in a 1280 by 800 window (${tall.toFixed(1)} px)`);
  const you = () =>
    s.page.evaluate(() => {
      const r = window.__ghoul.round;
      return { ...r.input, x: r.you.x, y: r.you.y, state: r.you.state, phase: r.phase, room: r.room, shots: r.stats.shots };
    });
  // Enter starts a round and has no release: it must not leave fire on.
  await s.page.keyboard.press("Enter");
  assert.equal(await overlay(s), "", "Enter starts a round");
  await step(s, 4, 16);
  assert.equal((await you()).phase, "story", "a run opens on the intro story");
  // Holding space for a second skips it, and shoots nothing at it.
  await s.page.keyboard.down(" ");
  await step(s, 70, 16);
  await s.page.keyboard.up(" ");
  await step(s, 20, 16);
  let me = await you();
  assert.deepEqual([me.fire, me.shots, me.phase], [false, 0, "play"], "the start leaves fire off and shoots nothing");
  // Held right runs until let go.
  await s.page.keyboard.down("ArrowRight");
  await step(s, 10, 16);
  me = await you();
  assert.ok(me.right && me.x > 10, `held right runs (${me.x})`);
  await s.page.keyboard.up("ArrowRight");
  const stopped = (await you()).x;
  await step(s, 4, 16);
  assert.equal((await you()).x, stopped, "let go, it stops");
  // Up jumps once a press: its repeats never jump again.
  await s.page.keyboard.down("ArrowUp");
  await step(s, 2, 16);
  assert.equal((await you()).state, "air", "up jumps");
  await s.page.keyboard.down("ArrowUp");
  await s.page.keyboard.down("ArrowUp");
  await step(s, 80, 16);
  assert.equal((await you()).state, "run", "a held up, its repeats included, jumps once");
  await s.page.keyboard.up("ArrowUp");
  // Held space fires until let go.
  await s.page.keyboard.down(" ");
  await step(s, 30, 16);
  me = await you();
  assert.ok(me.fire && me.shots >= 2, `held space fires (${me.shots})`);
  await s.page.keyboard.up(" ");
  assert.equal((await you()).fire, false, "let go, it stops");
  const shots = (await you()).shots;
  await step(s, 20, 16);
  assert.equal((await you()).shots, shots, "and fires no more");
  // A pause lets go of every key and holds a jump mid-air.
  await s.page.keyboard.press("ArrowUp");
  await step(s, 4, 16);
  const air = await you();
  assert.equal(air.state, "air", "a fresh press jumps again");
  await s.page.keyboard.down("ArrowLeft");
  await s.page.keyboard.down(" ");
  await s.page.keyboard.press("p");
  await pausedNow(s);
  const held = await you();
  assert.deepEqual([held.left, held.fire, held.jump], [false, false, 0], "a pause holds nothing");
  await step(s, 10, 16);
  assert.equal((await you()).y, held.y, "and holds the jump mid-air");
  await s.page.keyboard.up("ArrowLeft");
  await s.page.keyboard.up(" ");
  // A click on the paused board plays on.
  await s.page.click("#activities-overlay");
  assert.equal(await overlay(s), "", "a click plays on");
  await step(s, 2, 16);
  const resumed = await you();
  assert.ok(resumed.state === "air" && resumed.y !== held.y, "the jump carries on");
  await step(s, 80, 16);
  assert.equal((await you()).state, "run");
  // The up that plays on never jumps.
  await s.page.keyboard.press("p");
  await pausedNow(s);
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "", "up plays on");
  await step(s, 6, 16);
  assert.equal((await you()).state, "run", "and never jumps");
  assert.match(await s.page.locator("#activities-score").innerText(), /^Score: \d+ · Best: 0$/);
  // Through the hall's door to the pick of stage, which space takes once it
  // settles; then out of that stage as if its boss had fallen (a new record,
  // one stage cleared), and lose the last life.
  const outOf = (last) =>
    s.page.evaluate(async (last) => {
      const { groundAt, stageById } = await import("/activities/ghoul-rush/ghoul.js");
      const r = window.__ghoul.round;
      if (last) r.stageAt = stageById(r.stage).rooms.length - 1;
      r.hasKey = true;
      Object.assign(r.you, { x: r.spec.door, y: groundAt(r.spec, r.spec.door), state: "run", shelf: -1, vy: 0 });
    }, last);
  await outOf(false);
  await until(async () => (await you()).phase === "pick" || (await step(s, 10, 50), false), 5000);
  await step(s, 20, 50);
  await s.page.keyboard.press("Space");
  await until(async () => (await you()).room === 2 || (await step(s, 10, 50), false), 5000);
  await step(s, 30, 50);
  me = await you();
  assert.equal(me.fire, false, "the space that took the stage fires nothing");
  await outOf(true);
  await until(async () => (await you()).phase === "pick" || (await step(s, 10, 50), false), 5000);
  await s.page.evaluate(async () => {
    const { lose } = await import("/activities/ghoul-rush/ghoul.js");
    window.__calm = false;
    const r = window.__ghoul.round;
    r.lives = 1;
    r.phase = "play";
    r.you.safeMs = 0;
    lose(r, "zombie");
  });
  await step(s, 120, 16);
  await until(async () => (await overlay(s)).startsWith("Score:"), 5000);
  const score = await s.page.evaluate(() => window.__ghoul.score);
  assert.ok(score > 0);
  await until(async () => {
    const looks = await serverLooks(s);
    return looks.activityBestGhoul === score && looks.activityMemoGhoul === 1;
  }, 5000);
});

test("the server serves the activities' scripts, golf's seventeen, Light Trails, Bug Hunt, Sunset Drive, Stack Deploy, Bumper Ring's two, Rapids Run's two, Hot Potato's two, Crossing Rush's two, Bounce Road's seven, Ghoul Rush's eighty-three, every game's sound effects and the shared pills included", () => {
  const server = fs.readFileSync(new URL("../src/web-console/static.mjs", import.meta.url), "utf8");
  const servable = server.slice(server.indexOf("const SERVABLE = new Set(["), server.indexOf("]);", server.indexOf("const SERVABLE = new Set([")));
  for (const file of ["activities.js", "tones.js", "music.js", "activities/snake.js", "screens/activities.js", "activities/golf.js", "activities/golf-holes.js", "activities/golf-draw.js", "activities/golf-decor.js", "activities/golf-kit.js", "activities/golf-paint.js", "activities/golf-looks.js", "activities/golf-course-pirate.js", "activities/golf-course-cave.js", "activities/golf-course-dino.js", "activities/golf-course-candy.js", "activities/golf-course-space.js", "activities/golf-course-frost.js", "activities/golf-look-dino.js", "activities/golf-look-candy.js", "activities/golf-look-space.js", "activities/golf-look-frost.js", "activities/trails.js", "activities/bugs.js", "activities/drive.js", "activities/stack.js", "activities/bumper.js", "activities/bumper-draw.js", "activities/rapids.js", "activities/rapids-draw.js", "activities/fuse.js", "activities/fuse-draw.js", "activities/hop.js", "activities/hop-draw.js", "activities/bounce.js", "activities/bounce-draw.js", "activities/bounce-roads.js", "activities/bounce-road.js", "activities/bounce-rivals.js", "activities/bounce-scenery.js", "activities/bounce-cars.js", "activities/ghoul-rush/ghoul.js", "activities/ghoul-rush/draw/ghoul-draw.js", "activities/ghoul-rush/core/ghoul-rooms.js", "activities/ghoul-rush/stages/wing/ghoul-bones.js", "activities/ghoul-rush/stages/wing/ghoul-bones-draw.js", "activities/ghoul-rush/stages/graveyard/ghoul-graveyard.js", "activities/ghoul-rush/stages/graveyard/ghoul-graveyard-draw.js", "activities/ghoul-rush/stages/grounds/ghoul-grounds.js", "activities/ghoul-rush/stages/grounds/ghoul-grounds-draw.js", "activities/ghoul-rush/stages/chapel/ghoul-chapel.js", "activities/ghoul-rush/stages/chapel/ghoul-chapel-draw.js", "activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium.js", "activities/ghoul-rush/stages/sanatorium/ghoul-sanatorium-draw.js", "activities/ghoul-rush/stages/village/ghoul-village.js", "activities/ghoul-rush/stages/village/ghoul-village-draw.js", "activities/ghoul-rush/stages/village/ghoul-village-world.js", "activities/ghoul-rush/stages/village/ghoul-village-wolf.js", "activities/ghoul-rush/stages/mine/ghoul-mine.js", "activities/ghoul-rush/stages/mine/ghoul-mine-draw.js", "activities/ghoul-rush/stages/mine/ghoul-mine-world.js", "activities/ghoul-rush/stages/mine/ghoul-mine-tommy.js", "activities/ghoul-rush/rides/cart/ghoul-cart.js", "activities/ghoul-rush/rides/cart/ghoul-cart-draw.js", "activities/ghoul-rush/rides/sled/ghoul-sled.js", "activities/ghoul-rush/rides/sled/ghoul-sled-draw.js", "activities/ghoul-rush/rides/gurney/ghoul-gurney.js", "activities/ghoul-rush/rides/gurney/ghoul-gurney-draw.js", "activities/ghoul-rush/rides/banister/ghoul-banister.js", "activities/ghoul-rush/rides/banister/ghoul-banister-draw.js", "activities/ghoul-rush/rides/banister/ghoul-sfx-banister.js", "activities/ghoul-rush/rides/hearse/ghoul-hearse.js", "activities/ghoul-rush/rides/hearse/ghoul-hearse-draw.js", "activities/ghoul-rush/rides/wagon/ghoul-wagon.js", "activities/ghoul-rush/rides/wagon/ghoul-wagon-draw.js", "activities/ghoul-rush/rides/pew/ghoul-pew.js", "activities/ghoul-rush/rides/pew/ghoul-pew-draw.js", "activities/ghoul-rush/rides/pew/ghoul-pew-course.js", "activities/ghoul-rush/rides/pew/ghoul-pew-world.js", "activities/ghoul-rush/rides/mower/ghoul-mower.js", "activities/ghoul-rush/rides/mower/ghoul-mower-draw.js", "activities/ghoul-rush/rides/tray/ghoul-tray.js", "activities/ghoul-rush/rides/tray/ghoul-tray-draw.js", "activities/ghoul-rush/stages/carnival/ghoul-carnival.js", "activities/ghoul-rush/stages/carnival/ghoul-carnival-draw.js", "activities/ghoul-rush/stages/carnival/ghoul-carnival-world.js", "activities/ghoul-rush/stages/frozen/ghoul-frozen.js", "activities/ghoul-rush/stages/frozen/ghoul-frozen-draw.js", "activities/ghoul-rush/stages/frozen/ghoul-frozen-world.js", "activities/ghoul-rush/arms/ghoul-flare.js", "activities/ghoul-rush/stages/bog/ghoul-bog.js", "activities/ghoul-rush/stages/bog/ghoul-bog-draw.js", "activities/ghoul-rush/draw/ghoul-picker-draw.js", "activities/ghoul-rush/core/ghoul-powers.js", "activities/ghoul-rush/arms/ghoul-arms.js", "activities/ghoul-rush/arms/ghoul-arms-draw.js", "activities/ghoul-rush/arms/ghoul-rockets.js", "activities/ghoul-rush/arms/ghoul-rockets-draw.js", "activities/ghoul-rush/arms/ghoul-pans.js", "activities/ghoul-rush/arms/ghoul-sfx-arms.js", "activities/ghoul-rush/core/ghoul-run.js", "activities/ghoul-rush/core/ghoul-dice.js", "activities/ghoul-rush/core/ghoul-dice-draw.js", "activities/ghoul-rush/story/ghoul-gameover-draw.js", "activities/ghoul-rush/story/ghoul-intros.js", "activities/ghoul-rush/story/ghoul-intro-draw.js", "activities/ghoul-rush/story/ghoul-boss-intros.js", "activities/ghoul-rush/story/ghoul-bossintro-draw.js", "activities/ghoul-rush/story/ghoul-story.js", "activities/ghoul-rush/story/ghoul-story-draw.js", "activities/ghoul-rush/story/ghoul-sfx-story.js", "activities/ghoul-rush/core/ghoul-bonus.js", "activities/ghoul-rush/core/ghoul-bonus-draw.js", "activities/ghoul-rush/draw/ghoul-monsters-draw.js", "activities/pills.js", "activities/snake-sfx.js", "activities/golf-sfx.js", "activities/trails-sfx.js", "activities/bugs-sfx.js", "activities/drive-sfx.js", "activities/stack-sfx.js", "activities/bumper-sfx.js", "activities/rapids-sfx.js", "activities/fuse-sfx.js", "activities/hop-sfx.js", "activities/bounce-sfx.js", "activities/ghoul-rush/sfx/ghoul-sfx.js", "activities/ghoul-rush/stages/graveyard/ghoul-sfx-graveyard.js", "activities/ghoul-rush/stages/grounds/ghoul-sfx-grounds.js", "activities/ghoul-rush/stages/chapel/ghoul-sfx-chapel.js", "activities/ghoul-rush/stages/sanatorium/ghoul-sfx-sanatorium.js", "activities/ghoul-rush/stages/village/ghoul-sfx-village.js", "activities/ghoul-rush/stages/mine/ghoul-sfx-mine.js", "activities/ghoul-rush/stages/carnival/ghoul-sfx-carnival.js", "activities/ghoul-rush/stages/frozen/ghoul-sfx-frozen.js", "activities/ghoul-rush/rides/sled/ghoul-sfx-sled.js", "activities/ghoul-rush/rides/gurney/ghoul-sfx-gurney.js", "activities/ghoul-rush/rides/hearse/ghoul-sfx-hearse.js", "activities/ghoul-rush/stages/bog/ghoul-sfx-bog.js", "activities/ghoul-rush/rides/wagon/ghoul-sfx-wagon.js", "activities/ghoul-rush/rides/pew/ghoul-sfx-pew.js", "activities/ghoul-rush/rides/mower/ghoul-sfx-mower.js", "activities/ghoul-rush/rides/tray/ghoul-sfx-tray.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-core.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-scenes.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-gfx.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw-kinds.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw-sets.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw-hud.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-draw.js", "activities/ghoul-rush/rides/dark-ride/ghoul-ride-voices.js", "activities/ghoul-rush/rides/dark-ride/ghoul-sfx-ride.js"]) {
    assert.ok(servable.includes(`"${file}"`), `SERVABLE includes ${file}`);
  }
});
