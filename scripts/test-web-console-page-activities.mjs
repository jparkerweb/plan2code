// Page tests for Activities: the die in the top bar on every screen, the
// window opening into Snake with the picker for Snake and Mini golf, the keys
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
import { pageSuite, openSession, drawn, itemCard } from "./page-test-helpers.mjs";
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

async function openActivities(s) {
  await s.page.click("#btn-activities");
  await s.page.locator("#activities-modal[open]").waitFor();
  await until(async () => (await overlay(s)) !== "", 5000);
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

test("the die sits right of the megaphone and opens into Snake on the dashboard, with the picker for both games", async (t) => {
  savedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await pastTheIntro(s);
  await iconUsable(s, "the dashboard");
  const next = await s.page.evaluate(() => document.getElementById("btn-feedback").nextElementSibling?.id);
  assert.equal(next, "btn-activities");
  await openActivities(s);
  assert.equal(await overlay(s), "Press space to start");
  const picker = s.page.locator("#activities-picker");
  assert.ok(await picker.isVisible(), "two games listed: the picker shows");
  assert.deepEqual(await picker.locator("button").allInnerTexts(), ["Snake", "Mini golf"]);
  assert.equal(await picker.locator('button[data-activity="snake"]').getAttribute("aria-pressed"), "true", "with no last pick, the first game");
  assert.ok(await s.page.locator("#activities-canvas").isVisible());
  const focused = await s.page.evaluate(() => document.activeElement?.id);
  assert.equal(focused, "activities-board", "keys reach the game with no extra click");
});

test("picking Mini golf shows it, saves it as the last activity, and keys reach it with no extra click", async (t) => {
  savedLooks(t);
  const s = await openSession(await suite.browser(), { t, workflow: "dashboard" });
  await pastTheIntro(s);
  await handTicks(s);
  await openActivities(s);
  const picker = s.page.locator("#activities-picker");
  await picker.locator('button[data-activity="golf"]').click();
  assert.equal(await picker.locator('button[data-activity="golf"]').getAttribute("aria-pressed"), "true");
  assert.equal(await picker.locator('button[data-activity="snake"]').getAttribute("aria-pressed"), "false");
  await until(async () => (await overlay(s)) === "Press space or click to start", 5000);
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Mini golf: no best yet", "the header follows the pick");
  // Golf's course is wider than tall: the canvas takes its shape, not Snake's square.
  const box = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(box.width / box.height - 4 / 3) < 0.02, `a 4:3 board, not ${box.width} by ${box.height}`);
  // Focus moved to the board, so space plays the pick instead of pressing the button again.
  assert.equal(await s.page.evaluate(() => document.activeElement?.id), "activities-board");
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space started the picked game");
  await until(
    () => s.page.evaluate(async () => ((await (await fetch("/looks")).json()).looks || {}).lastActivity === "golf"),
    5000,
  );
  // Back to Snake: golf's round waits, paused, and Snake's board is square again.
  await picker.locator('button[data-activity="snake"]').click();
  await until(async () => (await overlay(s)) === "Press space to start", 5000);
  const square = await s.page.locator("#activities-canvas").boundingBox();
  assert.ok(Math.abs(square.width - square.height) < 1, "Snake's board is square");
  await picker.locator('button[data-activity="golf"]').click();
  await until(async () => (await overlay(s)) === "Paused. Press space, P or click to play", 5000);
});

test("a new session opens on the last pick, and a last pick that is no longer listed falls back to Snake", async (t) => {
  savedLooks(t, { welcomeSeen: true, lastActivity: "golf" });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openActivities(s);
  const picker = s.page.locator("#activities-picker");
  assert.equal(await overlay(s), "Press space or click to start", "it opens on Mini golf");
  assert.equal(await picker.locator('button[data-activity="golf"]').getAttribute("aria-pressed"), "true");
  assert.equal(await s.page.locator("#activities-title").innerText(), "Activities · Mini golf: no best yet");

  fs.writeFileSync(LOOKS_FILE, JSON.stringify({ looks: { welcomeSeen: true, lastActivity: "chess" } }));
  const again = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openActivities(again);
  assert.equal(await overlay(again), "Press space to start", "an unknown pick opens on Snake");
  assert.equal(await again.page.locator('#activities-picker button[data-activity="snake"]').getAttribute("aria-pressed"), "true");
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
  const box = itemCard(s.page, "q1").locator("textarea, input[type=text]").first();
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
  assert.equal(await box.inputValue(), "", "nothing was typed into the answer box");
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
  assert.ok(await banner.isVisible(), "the banner shows");
  await s.page.locator("#activities-board").focus();
  await s.page.keyboard.press(" ");
  assert.equal(await overlay(s), "", "space plays again");
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
  assert.equal(await overlay(s), "", "space plays on");
  assert.ok(await s.page.locator("#activities-banner").isHidden(), "playing on puts the finish banner away too");
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

test("a drag on the board reaches a pointer game, a question mid-drag cancels it, and a press on the paused board plays on", async (t) => {
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
  assert.equal(await overlay(s), "", "a press on the paused board plays on");
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
  await openActivities(s);
  await s.page.locator('#activities-picker button[data-activity="golf"]').click();
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

test("Mini golf: a question mid-swing holds the meter with no stroke, one mid-roll stops the ball, and a click or an arrow plays on", async (t) => {
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

  // The banner pushed the board down: a click on the board plays on.
  const box = await s.page.locator("#activities-canvas").boundingBox();
  await s.page.mouse.click(box.x + 8, box.y + 8);
  assert.equal(await overlay(s), "", "a click on the paused board plays on");
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

  await s.page.locator("#activities-board").focus();
  await s.page.keyboard.press("ArrowUp");
  assert.equal(await overlay(s), "", "an arrow plays on too");
  assert.ok(await banner.isHidden());
  await step(s, 5, 16);
  assert.notDeepEqual(await golfRound(s), stopped, "and the ball rolls on");
});

test("Mini golf: a full round saves its total as the best, a lower one replaces it, a higher one does not, and Reset clears both games", async (t) => {
  savedLooks(t, { welcomeSeen: true, activityBestSnake: 9 });
  const s = await openSession(await suite.browser(), { t, workflow: "plan", payload: PLAN_WORKING });
  await openGolf(s);
  const title = s.page.locator("#activities-title");
  assert.equal(await title.innerText(), "Activities · Mini golf: no best yet");
  // Plays all eighteen holes through the game's own calls, each in `each`
  // strokes: the ball set down beside the cup, extra strokes counted first.
  const playRound = (each) =>
    s.page.evaluate(async (each) => {
      const { HOLES } = await import("/activities/golf-holes.js");
      const g = window.__golf;
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
  const golfBest = async () => (await serverLooks(s)).activityBestGolf;

  assert.equal(await playRound(2), "over");
  await until(async () => (await golfBest()) === 36, 5000);
  assert.equal(await title.innerText(), "Activities · Mini golf best: 36", "a first round is the best");
  assert.equal(await playRound(1), "over");
  await until(async () => (await golfBest()) === 18, 5000);
  assert.equal(await title.innerText(), "Activities · Mini golf best: 18", "lower is better");
  assert.equal(await playRound(3), "over");
  await step(s, 2);
  assert.equal((await pageLooks(s)).activityBestGolf, 18, "a higher round keeps the best");
  assert.equal(await golfBest(), 18);
  assert.equal(await title.innerText(), "Activities · Mini golf best: 18");

  const reset = s.page.locator("#activities-reset");
  await reset.click();
  await reset.click();
  await until(async () => (await golfBest()) === 0 && (await serverLooks(s)).activityBestSnake === 0, 5000);
  assert.equal(await title.innerText(), "Activities · Mini golf: no best yet");
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

test("the server serves the activities' scripts, golf's four included", () => {
  const server = fs.readFileSync(new URL("../src/web-console/static.mjs", import.meta.url), "utf8");
  const servable = server.slice(server.indexOf("const SERVABLE = new Set(["), server.indexOf("]);", server.indexOf("const SERVABLE = new Set([")));
  for (const file of ["activities.js", "tones.js", "activities/snake.js", "screens/activities.js", "activities/golf.js", "activities/golf-holes.js", "activities/golf-draw.js", "activities/golf-decor.js"]) {
    assert.ok(servable.includes(`"${file}"`), `SERVABLE includes ${file}`);
  }
});
