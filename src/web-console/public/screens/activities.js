// Plan2Code Web Console - Activities: the top bar's die, its dialog, the frame timer, the keys and every pause rule.
//
// Small games for a long wait. The list of games is activities.js; each game
// is its own module under activities/, loaded with import() the first time it
// is picked, and answers the calls the list's header names. The window opens
// on a picker of game cards and plays one game at a time. This file owns
// everything around a game: the dialog, the picker, the one frame timer, the
// keys and the pauses. A game never runs a timer of its own, so a paused game cannot move:
// pausing is this file not ticking plus the game's own paused state. Nothing
// here talks to the agent or the session; it only reads whose turn it is, so
// a question, a sign-off or a finish always pauses play and says so.

import { page, redraw } from "../state.js";
import { finish, myTurn } from "../selectors.js";
import { looks, saveLooks } from "../looks.js";
import { el, lightDismiss, SVG_NS } from "../render.js";
import { tellApp } from "../app-bridge.js";
import { ACTIVITIES, bestKey, bestKeys, memoKey, musicKey, musicLevel } from "../activities.js";
import { hum as playHum, hushTones as hushSounds, tone as playTone, unlockTones } from "../tones.js";
import { hushMusic, music as playMusic } from "../music.js";

const $ = (id) => document.getElementById(id);

// Every sound the window and its games make goes through these two, so
// Preferences' Play activity sounds silences them all (and Play sounds, which
// tones.js checks, does too).
const tone = (...args) => {
  if (looks.activitySounds) playTone(...args);
};
const hum = (...args) => {
  if (looks.activitySounds) playHum(...args);
};
// And the music, which also needs Play activity music, at the game's own
// music volume (the window's Music slider). A song's "playing" or "ended"
// goes back to the game, which moves on to its next song on "ended".
const musicFor = (entry) => (name, intensity, options) => {
  if (looks.activitySounds && looks.gameMusic) return playMusic(name, intensity, musicLevel(entry, looks[musicKey(entry.id)]), options);
  return undefined;
};
const MUSIC_TITLE = "This game's music volume";
const MUSIC_OFF_TITLE = "Turn on Play activity music in User Preferences to hear it";

// Quiets every held sound and the music: the window stopped ticking a game.
function hushTones() {
  hushSounds();
  hushMusic();
}

const NOT_LOADED = "This activity could not be loaded. Close and open Activities to try again.";
const NEED_KEYBOARD = "Activities need a keyboard.";
const TOO_SMALL = "Make the window bigger to play.";
const TURN_BANNER = "Plan2Code needs you: a question is waiting.";
const FINISH_BANNER = "Plan2Code is finished.";
const RESET_LABEL = "Reset best scores";
const RESET_CONFIRM = "Reset? Click again";
const FULL_LABEL = "Full screen";
const EXIT_FULL_LABEL = "Exit full screen";

// How long Reset waits for its second click before going back to its label.
const RESET_CONFIRM_MS = 4000;

// A frame that arrives after a long gap (a slow machine, a debugger) is
// counted as this much at most, so the snake never jumps several cells at once.
const MAX_FRAME_MS = 250;

// Every start and every play-on counts down 3, 2, 1 before the game moves,
// so a round never begins or picks up before the person is ready. The game
// is already running while the count shows; this file just does not tick it.
const COUNT_FROM = 3;

// The game keys: arrows and W/A/S/D steer, space is the game's action.
const KEYS = Object.freeze({
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
  " ": "action",
});

// The list the window shows, and where frames come from. Both are swapped
// only by the page tests (setActivityList, setTickSource).
let list = ACTIVITIES;
let tickSource = (fn) => requestAnimationFrame(fn);
// How long each number of the countdown shows, in ms. Swapped only by the
// page tests (setCountdownMs); 0 skips the countdown.
let countStepMs = 700;

// The game objects loaded for the page's life, so a closed and reopened
// window, or a skill change on the same page, resumes the same round. Only one
// game is ever played at a time: picking another from the picker lets the
// last one go, round and all.
const games = new Map();
// A load in flight per game id, so two quick opens share one import().
const loading = new Map();
let currentId = null;
// What the window shows: "picker", the page of game cards, "courses", the
// dashboard of a game with courses (Mini golf's six), or "game", the board of
// the game on screen. With one game listed there is no picker.
let view = "game";
// The games that keep their lowest round as the best (their export says
// lowerIsBetter), not their highest.
const lowerIsBetter = new Set();
// Each loaded game's export, for a game with courses: its course cards and
// the art for them.
const defs = new Map();

// The frame timer. `gen` counts starts and stops, so a frame asked for before
// a stop does nothing when it arrives, whatever the tick source is.
let gen = 0;
let looping = false;
let lastFrame = null;
// The ms left of the countdown while one is showing, else 0. Game keys,
// clicks and presses on the board wait for it; P, Enter and Esc still pause.
let counting = 0;

// What renderActivities saw last time: the ids that were the person's to
// answer, and whether a finish was up. Null until the first render.
let seenTurn = null;
let seenFinish = false;

// Set when the person plays on after a turn or finish pause: the banner stays
// down until the next new question or finish.
let bannerDismissed = false;

// Set when a turn or finish pauses a round on an open window. A game key, a
// click or a press on the board was often already on its way and played on
// at once, hiding the banner unread, so while this holds only the banner's
// Unpause game button plays on. Go to it, or closing the window any other
// way, lets go: a round opened again later plays on from any game key. The
// held game, or null.
let held = null;

// Reset's confirm: the timer that puts its label back, while one is waiting.
let resetTimer = null;

// Go to it closes the window onto a question, so the close must not hand
// focus back to the die.
let goingTo = false;

// Full screen: the stage (the board, with a panel laid over it) filling the screen,
// set by the window's button or F on a game's board. `full` is the window's
// own state; `screenFull` is whether the browser also gave the stage the whole
// screen (it may refuse, and then the stage fills the page instead).
let full = false;
let screenFull = false;
// Hides the pointer once it has been still this long in full screen.
const IDLE_POINTER_MS = 2000;
let idleTimer = null;
// The black bar the board's shape leaves, beside it or below it, that is
// wide or tall enough to hold the panel. Where neither is, the panel floats
// over the board's top right corner and shrinks to the score line while a
// round plays and the pointer is still. The board never shrinks for it.
const RAIL_MIN = 220;
const STRIP_MIN = 110;

export function setTickSource(fn) {
  tickSource = fn;
}

export function setCountdownMs(ms) {
  countStepMs = ms;
}

export function setActivityList(next) {
  list = next;
  if (!list.some((e) => e.id === currentId)) currentId = null;
}

const game = () => (currentId ? games.get(currentId) || null : null);

const hasPicker = () => list.length > 1;

/* ----------------------------------------------------------- the notes */

function showNote(text) {
  const note = $("activities-note");
  note.textContent = text;
  note.hidden = !text;
}

const hasKeyboard = () => typeof matchMedia !== "function" || matchMedia("(any-pointer: fine)").matches;

/* ------------------------------------------------------------ drawing */

const entryOf = (id) => list.find((e) => e.id === id) || null;

const hasCourses = (id) => Boolean(entryOf(id) && entryOf(id).courses);

// The course a game with courses has on its board (its first before it is
// loaded), or undefined for a game without.
function courseNow(id) {
  if (!hasCourses(id)) return undefined;
  const g = games.get(id);
  return (g && g.course) || entryOf(id).courses[0];
}

// A game's best, or for a game with courses, the best on `course` (by default
// the course on its board).
const best = (id, course = courseNow(id)) => looks[bestKey(id, course)] || 0;

// A course's card from the game's export: { id, name, blurb, holes, par }.
const courseCard = (id, course) => ((defs.get(id) || {}).courses || []).find((c) => c.id === course) || null;

// "+3", "-4" or "E": a round against par.
const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "E");

// The header's " · Snake best: 12" for the game on screen, or "no best yet"
// before its first full round; " · Mini golf, Pirate Cove best: 52" for a
// game with courses, and " · Mini golf: pick a course" on its dashboard.
function paintTitle() {
  const entry = view === "game" || view === "courses" ? entryOf(currentId) : null;
  const card = entry && view === "game" ? courseCard(entry.id, courseNow(entry.id)) : null;
  const name = card ? `${entry.title}, ${card.name}` : entry ? entry.title : "";
  const n = entry ? best(entry.id) : 0;
  const text = !entry ? "" : view === "courses" ? ` · ${entry.title}: pick a course` : n ? ` · ${name} best: ${n}` : ` · ${name}: no best yet`;
  const span = $("activities-title-best");
  if (span.textContent !== text) span.textContent = text;
  if (full && entry) paintRail(name, n, lowerIsBetter.has(entry.id));
}

// The round on screen, for the best-score effects: which game, the state it
// was last painted in, whether this round has passed the best (the sparks
// fire once a round), and whether its end set a new best.
const watched = { g: null, state: null, passed: false, record: false };

// A new round has begun when the game on screen changed, or went back to
// running from anything but a pause.
function watchRound(g) {
  if (g !== watched.g || (g && g.state === "running" && watched.state !== "running" && watched.state !== "paused")) {
    watched.passed = false;
    watched.record = false;
  }
  watched.g = g;
  watched.state = g ? g.state : null;
}

const SPARK_COLORS = Object.freeze(["#ff4fa3", "#f5b301", "#1fb6d9", "#57b54a", "#a466ff", "#ff8a1f"]);
const SPARKS = 22;
const SPARK_MS = 1100;

const calm = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

// A fan of colored sparks up out of the score line's chips. They live on the
// dialog, not the line, since the line is rebuilt at every new score. Nothing
// under reduced motion; the colors alone mark the record there.
// In full screen they live on the stage, the one part of the page showing.
function sparks(line) {
  const host = full ? $("activities-stage") : $("activities-modal");
  if (!line || !host || calm()) return;
  const chips = line.firstElementChild;
  const box = host.getBoundingClientRect();
  const at = (chips || line).getBoundingClientRect();
  const x = at.left + (chips ? at.width / 2 : 40) - box.left - host.clientLeft;
  const y = at.top + at.height / 2 - box.top - host.clientTop;
  for (let i = 0; i < SPARKS; i++) {
    const a = Math.PI + (Math.PI * i) / (SPARKS - 1) + (Math.random() - 0.5) * 0.3;
    const d = 50 + Math.random() * 70;
    const s = el("span", "activities-spark");
    s.setAttribute("aria-hidden", "true");
    s.style.left = `${Math.round(x)}px`;
    s.style.top = `${Math.round(y)}px`;
    s.style.setProperty("--dx", `${Math.round(Math.cos(a) * d)}px`);
    s.style.setProperty("--dy", `${Math.round(Math.sin(a) * d)}px`);
    s.style.setProperty("--spin", `${Math.round((Math.random() - 0.5) * 720)}deg`);
    s.style.setProperty("--c", SPARK_COLORS[i % SPARK_COLORS.length]);
    host.append(s);
    setTimeout(() => s.remove(), SPARK_MS);
  }
}

// How long the burst of a passed best plays (its CSS animations' length)
// before the line settles.
const BURST_MS = 1200;
let burstTimer = null;

// Plays the burst again from its start, even mid-burst.
function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

// The burst of a passed best, once: the class comes off after it plays, so
// the chips a later score redraws do not pop and sweep all over again.
function celebrate(line) {
  replay(line, "burst");
  sparks(line);
  clearTimeout(burstTimer);
  burstTimer = setTimeout(() => line.classList.remove("burst"), BURST_MS);
}

// The line under the board, once a round has started: a score chip, a meter
// filling toward the best (for a game where the highest wins and a best is
// saved), then a best chip. Reaching the best lights it; passing it turns the
// line into a rainbow and fires the sparks, once a round. The chips are only
// styling: the line still reads "Score: 3 · Best: 9". Set only when it
// changes, since every frame asks. A lowest-wins game with no best yet says
// so: "Best: 0" would read as a perfect round.
function paintScore() {
  const g = game();
  watchRound(g);
  const line = $("activities-score");
  const running = Boolean(g && g.state !== "ready");
  const n = currentId ? best(currentId) : 0;
  const lower = lowerIsBetter.has(currentId);
  const score = running ? g.score : 0;
  // A lowest-wins game only knows it beat its best when the round ends.
  const chase = running && !lower && n > 0;
  const mood = !running ? "" : chase && score > n ? "passed" : chase && score === n ? "tied" : watched.record ? "passed" : "";
  const key = running ? `${score}|${n}|${lower}|${mood}` : "";
  if (line.dataset.key === key) return;
  line.dataset.key = key;
  line.classList.toggle("tied", mood === "tied");
  line.classList.toggle("passed", mood === "passed");
  if (!running) return line.replaceChildren();
  const chip = (cls, name, value) => {
    const c = el("span", `activities-chip ${cls}`, `${name}: `);
    c.append(el("b", null, value));
    return c;
  };
  const parts = [chip("score", "Score", String(score))];
  if (chase) {
    const meter = el("span", "activities-meter");
    meter.setAttribute("aria-hidden", "true");
    meter.style.setProperty("--fill", String(Math.min(1, score / n)));
    parts.push(meter);
  }
  parts.push(el("span", "activities-sep", " · "), chip("best", "Best", !n && lower ? "none yet" : String(n)));
  line.replaceChildren(...parts);
  if (mood === "passed" && !watched.passed) {
    watched.passed = true;
    celebrate(line);
  }
}

function paintOverlay() {
  const g = game();
  const overlay = $("activities-overlay");
  // A game played by pointer also starts and plays on with a click.
  const click = g && typeof g.pointer === "function";
  let text = "";
  if (g && g.state === "running" && counting > 0) text = String(Math.ceil(counting / countStepMs));
  else if (g && g.state === "ready") text = click ? "Press space or click to start" : "Press space to start";
  else if (g && g.state === "paused") text = held === g ? "Paused. Click Unpause game to play" : click ? "Paused. Press space, P or click to play" : "Paused. Press space or P to play";
  else if (g && g.state === "over") text = `Score: ${g.score}\nBest: ${best(currentId)}\n${hasCourses(currentId) ? (click ? "Press space or click to pick a course" : "Press space to pick a course") : click ? "Press space or click to play again" : "Press space to play again"}`;
  if (overlay.textContent !== text) overlay.textContent = text;
  overlay.classList.toggle("count", g !== null && g.state === "running" && counting > 0);
  // A round in play: in full screen a floating panel shrinks to its score.
  $("activities-stage").classList.toggle("live", Boolean(g && g.state === "running" && counting <= 0));
  paintScore();
  // Read after paintScore, which forgets the last round's record once a new one starts.
  overlay.classList.toggle("record", Boolean(g && g.state === "over" && watched.record));
}

/* ------------------------------------------------------------ best scores */

// Called only when a round ends, so a half-played round is never saved. A
// save that does not land stays in the page and its local copy, and the next
// save carries it (looks.js sends every key it has not heard back about).
// A best of 0 means none yet, so a lowerIsBetter game's first round always
// counts.
// A round that beats a best already saved is a record: the end screen says so
// and, for a lowest-wins game (which could not tell mid-round), the sparks fire
// now. A first best is only a best.
// A game with courses scores the course on its board.
function recordScore(id, score) {
  const course = courseNow(id);
  const was = best(id, course);
  if (!(lowerIsBetter.has(id) ? !was || score < was : score > was)) return;
  looks[bestKey(id, course)] = score;
  saveLooks();
  paintTitle();
  if (!was || id !== currentId) return;
  watched.record = true;
  if (lowerIsBetter.has(id)) {
    tone("best");
    watched.passed = true;
    celebrate($("activities-score"));
  }
}

function disarmReset() {
  clearTimeout(resetTimer);
  resetTimer = null;
  $("activities-reset").textContent = RESET_LABEL;
}

// The first click asks, inside the window; a second within a few seconds
// writes 0 to every listed game's best, every course's too (the server
// refuses null).
function resetBest() {
  if (!resetTimer) {
    $("activities-reset").textContent = RESET_CONFIRM;
    resetTimer = setTimeout(disarmReset, RESET_CONFIRM_MS);
    return;
  }
  disarmReset();
  for (const entry of list) for (const key of bestKeys(entry)) looks[key] = 0;
  saveLooks();
  paintOverlay();
  paintTitle();
  if (view === "picker") drawPicker();
  if (view === "courses") drawCourses(currentId);
}

// Sizes the game to the board. A board too small to play, or a page with no
// keyboard, shows its note in place of the board. A game that no longer fits
// stops moving, since nobody can see it.
function layout() {
  const board = $("activities-board");
  const g = game();
  if (!hasKeyboard()) {
    board.hidden = true;
    $("activities-picker").hidden = true;
    return showNote(NEED_KEYBOARD);
  }
  if (view === "picker" || view === "courses") {
    board.hidden = true;
    return showNote("");
  }
  if (!g) return;
  board.hidden = false;
  if ((full ? fitFull(g) : g.resize(board.clientWidth, board.clientHeight)) === false) {
    board.hidden = true;
    pauseAll("hidden");
    return showNote(TOO_SMALL);
  }
  showNote("");
}

/* -------------------------------------------------------- full screen */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Sizes the game to a full-screen stage: the whole screen, centered, with
// black bars where its shape leaves room. The panel then docks in the right
// bar when that bar is wide enough (Snake's square on a wide screen), in the
// bottom bar when that is tall enough (a tall screen), and otherwise floats
// over the board (Sunset Drive's 16:9 on a 16:9 screen). --bar holds the
// bar's size, which the CSS centers the panel in.
function fitFull(g) {
  const stage = $("activities-stage");
  const rail = $("activities-rail");
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  if (g.resize(w, h) === false) return false;
  const shape = $("activities-canvas").getBoundingClientRect();
  const side = (w - shape.width) / 2;
  const below = (h - shape.height) / 2;
  const dock = side >= RAIL_MIN ? "side" : below >= STRIP_MIN ? "below" : "float";
  stage.dataset.dock = dock;
  stage.style.setProperty("--bar", `${Math.floor(dock === "side" ? side : dock === "below" ? below : 0)}px`);
  rail.style.width = dock === "side" ? `${Math.floor(clamp(side - 32, RAIL_MIN - 32, 340))}px` : "";
  return true;
}

// The panel's name and best: the game on screen (with its course), and its
// best so far, painted with the header's (paintTitle).
function paintRail(name, n, lower) {
  const title = $("activities-rail-title");
  const line = $("activities-rail-best");
  const text = n ? `${lower ? "Best round" : "Best"}: ${n}` : "No best yet";
  if (title.textContent !== name) title.textContent = name;
  if (line.textContent !== text) line.textContent = text;
}

// Fills the screen with the stage, or puts the window back. Only the
// window's open game goes full screen; leaving it, closing the window, Esc,
// or Plan2Code needing the person (renderActivities) puts it back. The score
// line moves into the panel and back under the board. In the desktop app the
// app is asked to give the console its whole screen (`activities-full`),
// since its frame allows no full screen of its own. The board is laid out
// again at once, and again on the resize a full screen brings.
function setFull(on) {
  const dlg = $("activities-modal");
  const stage = $("activities-stage");
  const rail = $("activities-rail");
  const next = Boolean(on && dlg.open && view === "game");
  const btn = $("activities-full");
  btn.textContent = next ? EXIT_FULL_LABEL : FULL_LABEL;
  btn.setAttribute("aria-pressed", String(next));
  if (next === full) return;
  full = next;
  stage.classList.toggle("full", full);
  rail.hidden = !full;
  // The score line and the Music slider go into the rail while full screen.
  if (full) {
    $("activities-rail-score").append($("activities-score"));
    $("activities-rail-score").after($("activities-music"));
    wakePointer();
  } else {
    stage.after($("activities-score"));
    $("activities-full").before($("activities-music"));
    stage.classList.remove("idle");
    delete stage.dataset.dock;
    stage.style.removeProperty("--bar");
    rail.style.width = "";
    clearTimeout(idleTimer);
  }
  if (full && typeof stage.requestFullscreen === "function") stage.requestFullscreen().catch(() => {});
  // Leaving on purpose forgets the browser's full screen at once, so its
  // late change event cannot undo an F pressed again straight after.
  if (!full) screenFull = false;
  if (!full && document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
  tellApp("activities-full", { on: full });
  paintTitle();
  if (dlg.open) layout();
}

// The button and F: keys go back to the board, so the next space plays
// rather than pressing the button again.
function toggleFull() {
  setFull(!full);
  $("activities-board").focus({ preventScroll: true });
}

// The browser left its full screen by itself (its own Esc, F11): the window
// goes back to its size too.
function onFullscreenChange() {
  const mine = document.fullscreenElement === $("activities-stage");
  if (screenFull && !mine) setFull(false);
  screenFull = mine;
}

// A move in full screen shows the pointer again, until it is still a while.
function wakePointer() {
  const stage = $("activities-stage");
  stage.classList.remove("idle");
  clearTimeout(idleTimer);
  if (full) idleTimer = setTimeout(() => stage.classList.add("idle"), IDLE_POINTER_MS);
}

/* -------------------------------------------------------- frame timer */

function stopLoop() {
  hushTones();
  gen++;
  looping = false;
  counting = 0;
}

// Runs only while the dialog is open and the game is running, and stops
// itself the moment either is no longer true.
function startLoop() {
  const g = game();
  if (looping || !g || g.state !== "running" || !$("activities-modal").open) return;
  looping = true;
  lastFrame = null;
  counting = COUNT_FROM * countStepMs;
  if (counting > 0) tone("count");
  paintOverlay();
  const mine = ++gen;
  const frame = (now) => {
    if (mine !== gen) return;
    const t = typeof now === "number" ? now : performance.now();
    if (!$("activities-modal").open || g !== game() || g.state !== "running") {
      hushTones();
      looping = false;
      counting = 0;
      return paintOverlay();
    }
    // The countdown's time is never handed to the game: its first tick comes
    // a frame after the count ends.
    if (counting > 0) {
      const shown = Math.ceil(counting / countStepMs);
      if (lastFrame !== null) counting -= Math.min(Math.max(0, t - lastFrame), MAX_FRAME_MS);
      lastFrame = t;
      if (counting <= 0) {
        counting = 0;
        tone("go");
      } else if (Math.ceil(counting / countStepMs) !== shown) tone("count");
      paintOverlay();
      return tickSource(frame);
    }
    if (lastFrame !== null) g.tick(Math.min(Math.max(0, t - lastFrame), MAX_FRAME_MS));
    lastFrame = t;
    paintScore();
    if (g.state !== "running") {
      hushTones();
      looping = false;
      paintOverlay();
      return overLoop(g, mine);
    }
    tickSource(frame);
  };
  tickSource(frame);
}

// A game whose end screen moves (`animating`: Ghoul Rush's "G A M E - O V E R")
// keeps being ticked and painted, with no countdown, until the screen is left.
function overLoop(g, mine) {
  if (!g.animating) return;
  let last = null;
  const frame = (now) => {
    if (mine !== gen || looping || !$("activities-modal").open || g !== game() || g.state === "running" || !g.animating) return;
    const t = typeof now === "number" ? now : performance.now();
    if (last !== null) g.tick(Math.min(Math.max(0, t - last), MAX_FRAME_MS));
    last = t;
    tickSource(frame);
  };
  tickSource(frame);
}

// After anything the person does: the timer follows the game's state.
function follow() {
  const g = game();
  if (g && g.state === "running") startLoop();
  else stopLoop();
  paintOverlay();
}

// A finished round of a game with courses goes back to its dashboard, so
// the next press picks a course rather than replaying the one just played.
function toCoursesWhenOver(g) {
  if (!(g && g.state === "over" && view === "game" && hasCourses(currentId))) return false;
  showCourses(currentId);
  return true;
}

// Runs what the person did to the game; when it took a paused game back to
// running, the banner goes away until the next new question or finish.
function play(g, act) {
  if (held === g && g.state === "paused") return;
  if (toCoursesWhenOver(g)) return;
  const was = g.state;
  act();
  if (was === "paused" && g.state === "running") dismissBanner();
}

/* ------------------------------------------------------------- pauses */

// Every pause goes through here: "turn", "finish", "hidden", "blur" and
// "closed". None of them ever resumes or starts a round; only the person
// does: space, P, Enter or any other game key, a click on the overlay, or for a
// game that takes the pointer, a press on the board. A pause also drops a
// drag in progress.
function pauseAll(reason) {
  const g = game();
  if (g && g.state === "running") g.pause();
  dragging = false;
  if (g && typeof g.pointer === "function") g.pointer("cancel", 0, 0);
  stopLoop();
  paintOverlay();
}

/* ------------------------------------------------------------ loading */

async function loadGame(entry) {
  if (games.has(entry.id)) return games.get(entry.id);
  if (!loading.has(entry.id)) {
    const made = (async () => {
      const def = entry.game || (await import(entry.module)).default;
      defs.set(entry.id, def);
      if (def.lowerIsBetter) lowerIsBetter.add(entry.id);
      else lowerIsBetter.delete(entry.id);
      const onScore = (score) => {
        recordScore(entry.id, score);
        paintOverlay();
      };
      // The game's memo is saved like a best score: privately, in looks.json.
      const memo = {
        get: () => looks[memoKey(entry.id)] || 0,
        set: (n) => {
          if (looks[memoKey(entry.id)] === n) return;
          looks[memoKey(entry.id)] = n;
          saveLooks();
        },
      };
      const g = def.create({ canvas: $("activities-canvas"), tone, hum, music: musicFor(entry), onScore, best: () => best(entry.id), memo, course: courseNow(entry.id) });
      games.set(entry.id, g);
      return g;
    })();
    // A failed load is forgotten, so the next open tries again.
    loading.set(entry.id, made);
    made.finally(() => loading.delete(entry.id)).catch(() => {});
  }
  return loading.get(entry.id);
}

// Shows the picker, a course dashboard or the game on screen, and the parts
// of the window that go with each: the board and the score line with a game,
// All courses to get back to a game's dashboard, and All games to get back
// to the picker once there is one.
function applyView() {
  const picking = view === "picker" || view === "courses";
  const back = $("activities-back");
  $("activities-picker").hidden = !picking;
  $("activities-score").hidden = picking;
  const toCourses = view === "game" && hasCourses(currentId);
  back.textContent = toCourses ? "All courses" : "All games";
  back.hidden = view === "picker" || (!toCourses && !hasPicker());
  $("activities-full").hidden = view !== "game";
  paintMusic();
  if (picking) {
    $("activities-board").hidden = true;
    setFull(false);
  }
}

// The Music slider: shown with a game that has music, at its saved volume,
// and dimmed while the switches in User Preferences keep it silent anyway.
function paintMusic() {
  const entry = view === "game" ? list.find((e) => e.id === currentId) : null;
  const label = $("activities-music");
  const input = $("activities-music-level");
  label.hidden = !entry || entry.music === undefined;
  if (label.hidden) return;
  const off = !(looks.sound && looks.activitySounds && looks.gameMusic);
  input.value = String(Math.round(musicLevel(entry, looks[musicKey(entry.id)]) * 100));
  input.disabled = off;
  label.title = off ? MUSIC_OFF_TITLE : MUSIC_TITLE;
}

// A slider move is heard at once (the game asks for its track every frame)
// and saved once it is let go. Let go of with the mouse, it hands the keys
// back to the game, so the next arrow moves Planny, not the volume.
function onMusicLevel(e) {
  if (!currentId) return;
  looks[musicKey(currentId)] = Number(e.target.value);
  if (e.type === "change") saveLooks();
}

// Back goes one step up: from a game with courses to its dashboard, from
// anything else to the picker.
function goBack() {
  if (view === "game" && hasCourses(currentId)) return showCourses(currentId);
  showPicker();
}

// Makes `id` the game on screen, loaded, sized and drawn.
async function showGame(id) {
  const entry = list.find((e) => e.id === id);
  if (!entry) return;
  if (id !== currentId) dropCheats();
  currentId = id;
  view = "game";
  applyView();
  paintTitle();
  showNote("");
  $("activities-board").focus({ preventScroll: true });
  try {
    await loadGame(entry);
  } catch {
    if (currentId !== id || view !== "game") return;
    $("activities-board").hidden = true;
    return showNote(NOT_LOADED);
  }
  if (currentId !== id || view !== "game") return;
  layout();
  paintOverlay();
  // Keys go to the game next, not to the card just pressed.
  if (!$("activities-board").hidden) $("activities-board").focus({ preventScroll: true });
}

/* ------------------------------------------------------------- picker */

// Each card's cover, drawn as a little SVG scene: [tag, attributes] pairs on
// a 120 by 72 box. A `cv-` class carries one of the page's tokens
// (styles/activities.css), since the page's policy refuses a style attribute.
// A game with no cover of its own gets the plain one.
const COVERS = Object.freeze({
  snake: [
    ["rect", { width: 120, height: 72, class: "cv-panel" }],
    ...[0, 1, 2, 3, 4, 5].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((c) => (c + r) % 2).map((c) => ["rect", { x: c * 12, y: r * 12, width: 12, height: 12, class: "cv-rule" }])),
    ["polyline", { points: "18,54 18,30 54,30 54,42 78,42", fill: "none", "stroke-width": 9, "stroke-linecap": "round", "stroke-linejoin": "round", class: "cv-accent-line" }],
    ["circle", { cx: 80, cy: 42, r: 7, class: "cv-ink" }],
    ["circle", { cx: 82, cy: 39, r: 2, class: "cv-panel" }],
    ["circle", { cx: 82, cy: 45, r: 2, class: "cv-panel" }],
    ["circle", { cx: 101, cy: 42, r: 6, fill: "#d8283b" }],
    ["ellipse", { cx: 103, cy: 34, rx: 3.5, ry: 2, fill: "#57b54a" }],
  ],
  golf: [
    ["rect", { width: 120, height: 72, fill: "#1fb6d9" }],
    ["path", { d: "M8 20 Q8 8 22 8 H98 Q112 8 112 22 V50 Q112 64 98 64 H22 Q8 64 8 50 Z", fill: "#57b54a" }],
    ["ellipse", { cx: 74, cy: 46, rx: 14, ry: 7, fill: "#e9d39a" }],
    ["circle", { cx: 92, cy: 26, r: 4, fill: "#1d1a17" }],
    ["line", { x1: 92, y1: 26, x2: 92, y2: 8, stroke: "#ffffff", "stroke-width": 1.6 }],
    ["path", { d: "M92 8 L104 12 L92 16 Z", fill: "#e2553f" }],
    ["line", { x1: 30, y1: 48, x2: 84, y2: 30, stroke: "#ffffff", "stroke-width": 1.6, "stroke-dasharray": "2 4" }],
    ["circle", { cx: 28, cy: 49, r: 4, fill: "#ffffff" }],
  ],
  trails: [
    ["rect", { width: 120, height: 72, fill: "#1d1f3a" }],
    ...[1, 2, 3, 4, 5].map((r) => ["line", { x1: 0, y1: r * 12, x2: 120, y2: r * 12, stroke: "#ffffff", "stroke-opacity": 0.08 }]),
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => ["line", { x1: c * 12, y1: 0, x2: c * 12, y2: 72, stroke: "#ffffff", "stroke-opacity": 0.08 }]),
    ["polyline", { points: "10,60 10,18 46,18 46,44 66,44", fill: "none", "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round", "stroke-opacity": 0.35, class: "cv-accent-line" }],
    ["polyline", { points: "10,60 10,18 46,18 46,44 66,44", fill: "none", "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round", class: "cv-accent-line" }],
    ["polyline", { points: "112,12 88,12 88,56 74,56", fill: "none", "stroke-width": 8, "stroke-linecap": "round", "stroke-linejoin": "round", stroke: "#ff4fa3", "stroke-opacity": 0.35 }],
    ["polyline", { points: "112,12 88,12 88,56 74,56", fill: "none", "stroke-width": 3.5, "stroke-linecap": "round", "stroke-linejoin": "round", stroke: "#ff4fa3" }],
    ["circle", { cx: 68, cy: 44, r: 5, class: "cv-accent" }],
    ["circle", { cx: 72, cy: 56, r: 5, fill: "#ff4fa3" }],
  ],
  bugs: [
    ["rect", { width: 120, height: 72, class: "cv-panel" }],
    ...[0, 1, 2, 3, 4, 5].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter((c) => (c + r) % 2).map((c) => ["rect", { x: c * 12, y: r * 12 + 6, width: 12, height: 12, class: "cv-rule" }])),
    ...[24, 48, 72, 96].flatMap((x, i) => [
      ["ellipse", { cx: x, cy: 16 + (i % 2) * 4, rx: 6, ry: 7, fill: ["#e2553f", "#2fbf71", "#f5b301", "#ff8a1f"][i] }],
      ["circle", { cx: x, cy: 23 + (i % 2) * 4, r: 3.5, fill: "#1d1a17" }],
      ["circle", { cx: x - 1.5, cy: 23 + (i % 2) * 4, r: 1.2, fill: "#ffffff" }],
      ["circle", { cx: x + 1.5, cy: 23 + (i % 2) * 4, r: 1.2, fill: "#ffffff" }],
    ]),
    ["line", { x1: 60, y1: 50, x2: 60, y2: 36, "stroke-width": 3, "stroke-linecap": "round", class: "cv-accent-line" }],
    ["line", { x1: 60, y1: 32, x2: 60, y2: 26, "stroke-width": 3, "stroke-linecap": "round", class: "cv-accent-line" }],
    ["path", { d: "M60 50 L72 62 L64 60 L56 60 L48 62 Z", class: "cv-accent" }],
    ["ellipse", { cx: 60, cy: 58, rx: 5, ry: 8, class: "cv-accent" }],
    ["circle", { cx: 60, cy: 56, r: 3.2, class: "cv-ink" }],
    ["circle", { cx: 36, cy: 44, r: 2.5, fill: "#e2553f" }],
  ],
  drive: [
    ["rect", { width: 120, height: 36, fill: "#ff7a6b" }],
    ["rect", { width: 120, height: 14, fill: "#3b1e5e" }],
    ["circle", { cx: 60, cy: 34, r: 13, fill: "#ffd36b" }],
    ["rect", { x: 46, y: 28, width: 28, height: 1.5, fill: "#ff7a6b" }],
    ["rect", { x: 46, y: 32, width: 28, height: 2, fill: "#ff7a6b" }],
    ["path", { d: "M0 36 Q20 26 38 33 Q52 24 70 34 Q92 27 120 33 V36 H0 Z", fill: "#5a2f63" }],
    ["rect", { y: 36, width: 120, height: 36, fill: "#e7cd92" }],
    ["path", { d: "M56 36 H64 L104 72 H16 Z", fill: "#5d5a68" }],
    ["path", { d: "M59.4 40 H60.6 L61.4 50 H58.6 Z M58.2 56 H61.8 L62.6 68 H57.4 Z", fill: "#ffffff" }],
    ["path", { d: "M22 58 Q20 48 26 40", fill: "none", stroke: "#8a5a32", "stroke-width": 2 }],
    ["path", { d: "M26 40 q-8 -2 -12 4 M26 40 q8 -3 12 3 M26 40 q-3 -7 -9 -8 M26 40 q4 -7 10 -7", fill: "none", stroke: "#2f8f4a", "stroke-width": 2.5, "stroke-linecap": "round" }],
    ["rect", { x: 46, y: 56, width: 28, height: 12, rx: 3, class: "cv-accent" }],
    ["rect", { x: 47, y: 60, width: 6, height: 3, fill: "#b3262a" }],
    ["rect", { x: 67, y: 60, width: 6, height: 3, fill: "#b3262a" }],
    ["rect", { x: 48, y: 67, width: 6, height: 4, fill: "#16161a" }],
    ["rect", { x: 66, y: 67, width: 6, height: 4, fill: "#16161a" }],
    ["rect", { x: 50, y: 47, width: 9, height: 9, rx: 2, fill: "#ffffff", stroke: "#1d1a17", "stroke-width": 1 }],
    ["path", { d: "M54.5 49 L55.3 50.8 L57.2 50.9 L55.7 52.1 L56.2 54 L54.5 52.9 L52.8 54 L53.3 52.1 L51.8 50.9 L53.7 50.8 Z", fill: "#f5b301" }],
  ],
  stack: [
    ["rect", { width: 120, height: 72, fill: "#3e5fa8" }],
    ["rect", { y: 36, width: 120, height: 36, fill: "#ff9a6b", "fill-opacity": 0.55 }],
    ["rect", { y: 64, width: 120, height: 8, fill: "#4f8a3a" }],
    ["rect", { x: 38, y: 56, width: 44, height: 8, fill: "#2d3240", stroke: "#171a22" }],
    ["rect", { x: 41, y: 48, width: 40, height: 8, fill: "#2d3240", stroke: "#171a22" }],
    ["rect", { x: 41, y: 40, width: 36, height: 8, fill: "#d9c39a", stroke: "#8c7349" }],
    ["rect", { x: 43, y: 32, width: 34, height: 8, fill: "#f5b301", stroke: "#a67400" }],
    ...[44, 50, 56, 62, 68, 74].map((x, i) => ["rect", { x, y: i % 2 ? 51 : 59, width: 2, height: 2, fill: ["#57e38a", "#f5b301", "#1fb6d9"][i % 3] }]),
    ["path", { d: "M81 48 L88 50 L86 56 L80 56 Z", fill: "#2d3240", stroke: "#171a22" }],
    ["rect", { x: 54.5, y: 28, width: 2.2, height: 4, class: "cv-ink" }],
    ["rect", { x: 59.3, y: 28, width: 2.2, height: 4, class: "cv-ink" }],
    ["rect", { x: 52, y: 19, width: 12, height: 10, rx: 2.5, class: "cv-panel" }],
    ["rect", { x: 52, y: 19, width: 12, height: 10, rx: 2.5, fill: "none", "stroke-width": 1.4, class: "cv-ink3-line" }],
    ["path", { d: "M58 20.5 L58.9 22.7 L61.2 22.8 L59.4 24.2 L60 26.5 L58 25.2 L56 26.5 L56.6 24.2 L54.8 22.8 L57.1 22.7 Z", class: "cv-accent" }],
    ["rect", { x: 22, y: 8, width: 34, height: 8, class: "cv-accent" }],
    ["line", { x1: 8, y1: 12, x2: 18, y2: 12, stroke: "#ffffff", "stroke-width": 1.6, "stroke-dasharray": "2 3" }],
    ["line", { x1: 60, y1: 12, x2: 70, y2: 12, stroke: "#ffffff", "stroke-width": 1.6, "stroke-dasharray": "2 3" }],
  ],
  bumper: [
    ["rect", { width: 120, height: 72, fill: "#1b2238" }],
    ...[[8, 10], [20, 60], [104, 52], [112, 22], [14, 34], [98, 66]].map(([x, y]) => ["rect", { x, y, width: 1.2, height: 1.2, fill: "#8fa8ff", "fill-opacity": 0.6 }]),
    ["ellipse", { cx: 60, cy: 44, rx: 32, ry: 27, fill: "#000000", "fill-opacity": 0.35 }],
    ["circle", { cx: 60, cy: 40, r: 30, fill: "#2a4c80" }],
    ["circle", { cx: 60, cy: 38, r: 30, fill: "#3f6fb5" }],
    ["circle", { cx: 60, cy: 38, r: 29.2, fill: "none", stroke: "#f2e6c9", "stroke-width": 1.6 }],
    ["circle", { cx: 60, cy: 38, r: 17, fill: "none", stroke: "#ffffff", "stroke-opacity": 0.35, "stroke-width": 0.8 }],
    ["line", { x1: 67, y1: 29, x2: 80, y2: 19, stroke: "#ffffff", "stroke-width": 1.2, "stroke-dasharray": "2 2.5", "stroke-linecap": "round" }],
    ["line", { x1: 70, y1: 33, x2: 84, y2: 24, stroke: "#ffffff", "stroke-width": 1.2, "stroke-dasharray": "2 2.5", "stroke-linecap": "round" }],
    ["circle", { cx: 74, cy: 55, r: 7.5, fill: "#24232b" }],
    ["circle", { cx: 74, cy: 55, r: 6, fill: "#2fbf71" }],
    ["circle", { cx: 74.6, cy: 55.6, r: 3.6, fill: "#1d7a48" }],
    ["circle", { cx: 71, cy: 52.4, r: 1.7, fill: "#8fe0a8" }],
    ["circle", { cx: 90, cy: 13, r: 6.5, fill: "#24232b" }],
    ["circle", { cx: 90, cy: 13, r: 5.2, fill: "#e2553f" }],
    ["path", { d: "M86.6 10.6 L88.8 12.8 M88.8 10.6 L86.6 12.8 M91.2 10.6 L93.4 12.8 M93.4 10.6 L91.2 12.8", stroke: "#ffffff", "stroke-width": 1.1, "stroke-linecap": "round" }],
    ["path", { d: "M64.0 28.8 L64.7 31.3 L67.0 30.0 L65.7 32.3 L68.2 33.0 L65.7 33.7 L67.0 36.0 L64.7 34.7 L64.0 37.2 L63.3 34.7 L61.0 36.0 L62.3 33.7 L59.8 33.0 L62.3 32.3 L61.0 30.0 L63.3 31.3 Z", fill: "#f5b301" }],
    ["circle", { cx: 50, cy: 46, r: 9, fill: "#24232b" }],
    ["circle", { cx: 50, cy: 46, r: 7.3, class: "cv-accent" }],
    ["line", { x1: 45.5, y1: 45, x2: 54.4, y2: 40.2, "stroke-width": 1, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["line", { x1: 54.5, y1: 45, x2: 56.6, y2: 41.4, "stroke-width": 1, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["circle", { cx: 55.6, cy: 40.4, r: 1.6, fill: "none", "stroke-width": 0.9, class: "cv-ink3-line" }],
    ["rect", { x: 45.5, y: 41.5, width: 9, height: 9, rx: 2, class: "cv-panel" }],
    ["rect", { x: 45.5, y: 41.5, width: 9, height: 9, rx: 2, fill: "none", "stroke-width": 1, class: "cv-ink3-line" }],
    ["path", { d: "M50.0 42.7 L50.7 44.5 L52.6 44.6 L51.1 45.8 L51.6 47.6 L50.0 46.5 L48.4 47.6 L48.9 45.8 L47.4 44.6 L49.3 44.5 Z", class: "cv-accent" }],
  ],
  rapids: [
    ["rect", { width: 120, height: 72, fill: "#6fbf4a" }],
    ...[0, 2, 4, 6, 8].map((k) => ["rect", { y: k * 8, width: 120, height: 4, fill: "#64b041" }]),
    ["path", { d: "M38 0 H84 Q94 18 82 34 Q72 50 86 72 H42 Q28 50 42 34 Q52 18 38 0 Z", fill: "#2f7fc4" }],
    ["path", { d: "M38 0 Q52 18 42 34 Q28 50 42 72 M84 0 Q94 18 82 34 Q72 50 86 72", fill: "none", stroke: "#e6d29a", "stroke-width": 1.2 }],
    ["path", { d: "M50 22 v3 M76 40 v3 M56 44 v3 M70 14 v3 M48 58 v3 M78 60 v3", fill: "none", stroke: "#cfe8ff", "stroke-opacity": 0.55, "stroke-width": 0.8, "stroke-linecap": "round" }],
    ["circle", { cx: 18, cy: 20, r: 4, fill: "#2f7a3a" }],
    ["circle", { cx: 16.8, cy: 18.8, r: 2.2, fill: "#3e9a48" }],
    ["circle", { cx: 104, cy: 48, r: 4.5, fill: "#2f7a3a" }],
    ["circle", { cx: 102.6, cy: 46.6, r: 2.4, fill: "#3e9a48" }],
    ["circle", { cx: 22, cy: 60, r: 3.2, fill: "#2f7a3a" }],
    ["rect", { x: 41, y: 6, width: 46, height: 5, fill: "#b3ada3" }],
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((k) => ["rect", { x: 41 + k * 3.07, y: 6, width: 3.07, height: 1.4, fill: k % 2 ? "#1d1a17" : "#f5b301" }]),
    ["path", { d: "M58 7.4 l1 1.6 l-0.8 1.2 l0.9 0.8 M70 7.4 l-0.8 1.4 l1 1.4", fill: "none", stroke: "#3a3632", "stroke-width": 0.6 }],
    ["circle", { cx: 74, cy: 28, r: 4.2, fill: "#2fd08a", "fill-opacity": 0.3 }],
    ["rect", { x: 71.8, y: 25.4, width: 4.4, height: 5.2, rx: 1.2, fill: "#2fd08a", stroke: "#1d1a17", "stroke-width": 0.5 }],
    ["path", { d: "M74.4 26 L72.9 28.2 L74 28.2 L73.4 30.2 L75.1 27.5 L74 27.5 Z", fill: "#fff3a6" }],
    ["path", { d: "M52 31 Q55.5 28 55.5 24 L55 20 H49 L48.5 24 Q48.5 28 52 31 Z", fill: "#e2553f", stroke: "#1d1a17", "stroke-width": 0.5 }],
    ["rect", { x: 50, y: 21.4, width: 4, height: 3.4, rx: 0.8, fill: "#f4f1ea" }],
    ["path", { d: "M62 42 V34 M62 30 V24", fill: "none", "stroke-width": 1.6, "stroke-linecap": "round", class: "cv-accent-line" }],
    ["path", { d: "M58 61 L52 71 M66 61 L72 71 M59 61 L56 71 M65 61 L68 71", fill: "none", stroke: "#ffffff", "stroke-opacity": 0.75, "stroke-width": 1, "stroke-linecap": "round" }],
    ["path", { d: "M62 43 Q67.5 47 67.5 54 L66.5 61 H57.5 L56.5 54 Q56.5 47 62 43 Z", fill: "none", stroke: "#ffffff", "stroke-width": 2, "stroke-linejoin": "round" }],
    ["path", { d: "M62 43 Q67.5 47 67.5 54 L66.5 61 H57.5 L56.5 54 Q56.5 47 62 43 Z", class: "cv-accent" }],
    ["path", { d: "M62 43 Q67.5 47 67.5 54 L66.5 61 H57.5 L56.5 54 Q56.5 47 62 43 Z", fill: "none", stroke: "#1d1a17", "stroke-width": 0.6 }],
    ["rect", { x: 60.4, y: 61, width: 1.2, height: 1.6, fill: "#ff8a1f" }],
    ["rect", { x: 62.4, y: 61, width: 1.2, height: 1.6, fill: "#ff8a1f" }],
    ["path", { d: "M59.2 54 L58.6 49 M64.8 54 L65.4 49 M58 49 H66", fill: "none", "stroke-width": 0.9, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["rect", { x: 59, y: 49.4, width: 6, height: 6, rx: 1.5, class: "cv-panel" }],
    ["rect", { x: 59, y: 49.4, width: 6, height: 6, rx: 1.5, fill: "none", "stroke-width": 0.8, class: "cv-ink3-line" }],
    ["path", { d: "M62.0 50.0 L62.6 51.5 L64.2 51.6 L63.0 52.6 L63.4 54.2 L62.0 53.3 L60.6 54.2 L61.0 52.6 L59.8 51.6 L61.4 51.5 Z", class: "cv-accent" }],
  ],
  flock: [
    ...[0, 1, 2, 3, 4, 5].map((k) => ["rect", { y: k * 10, width: 120, height: 10, fill: ["#4b2a7a", "#6a3b8f", "#944a9c", "#c75b93", "#ec6f7a", "#f5965c"][k] }]),
    ["circle", { cx: 90, cy: 58, r: 8, fill: "#fff3b0" }],
    ["rect", { y: 60, width: 120, height: 12, fill: "#f7c35e" }],
    ...[[8, 22], [18, 28], [28, 24], [38, 30], [48, 34]].map(([x, y]) => ["path", { d: "M-5 0 Q-2.5 -4 0 -0.5 Q2.5 -4 5 0 Q2.5 -1.5 0 1.5 Q-2.5 -1.5 -5 0 Z", transform: `translate(${x} ${y})`, fill: "#2b2140" }]),
    ["path", { d: "M96 6 Q106 6 106 18 Q106 30 98 36 H94 Q86 30 86 18 Q86 6 96 6 Z", fill: "#e2553f", stroke: "#2b2140", "stroke-width": 1 }],
    ["rect", { x: 91, y: 9, width: 3, height: 23, fill: "#f4f1ea" }],
    ["rect", { x: 98, y: 9, width: 3, height: 23, fill: "#f4f1ea" }],
    ["path", { d: "M94 36 L93 39 M98 36 L99 39", stroke: "#2b2140", "stroke-width": 0.8 }],
    ["rect", { x: 92.5, y: 39, width: 7, height: 4.5, rx: 1, fill: "#8a5a30" }],
    ["rect", { transform: "translate(36 6)", x: 20, y: 28, width: 28, height: 22, rx: 9, class: "cv-accent" }],
    ["path", { transform: "translate(36 6)", d: "M47 34 L53 37 L47 40 Z", fill: "#ff8a1f" }],
    ["path", { transform: "translate(36 6)", d: "M24 40 Q32 47 42 40 Q36 46 24 44 Z", fill: "#000000", "fill-opacity": 0.22 }],
    ["path", { transform: "translate(36 6)", d: "M34 31.4 L34.9 33.8 L37.4 33.9 L35.4 35.5 L36.1 37.9 L34 36.5 L31.9 37.9 L32.6 35.5 L30.6 33.9 L33.1 33.8 Z", fill: "#f5b301" }],
    ["path", { transform: "translate(36 6)", d: "M28 50 V53 H31 M37 50 V53 H40", fill: "none", "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round", class: "cv-accent-line" }],
  ],
  fuse: [
    ["rect", { width: 120, height: 72, fill: "#dcc9a6" }],
    ...[0, 1, 2, 3, 4, 5].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7].filter((c) => (c + r) % 2).map((c) => ["rect", { x: c * 16, y: r * 12, width: 16, height: 12, fill: "#d1bc95" }])),
    ["rect", { x: 1, y: 1, width: 118, height: 70, fill: "none", stroke: "#7a5c43", "stroke-width": 2 }],
    ["rect", { x: 78, y: 40, width: 30, height: 14, fill: "#000000", "fill-opacity": 0.2 }],
    ["rect", { x: 76, y: 38, width: 30, height: 14, fill: "#7d5330" }],
    ["rect", { x: 76, y: 38, width: 30, height: 10, fill: "#b07a45" }],
    ["ellipse", { cx: 26, cy: 58, rx: 6, ry: 2, fill: "#000000", "fill-opacity": 0.2 }],
    ["circle", { cx: 26, cy: 50, r: 6, fill: "#ff8a1f" }],
    ["circle", { cx: 23.5, cy: 49, r: 1.5, fill: "#ffffff" }],
    ["circle", { cx: 28.5, cy: 49, r: 1.5, fill: "#ffffff" }],
    ["circle", { cx: 22.8, cy: 49, r: 0.8, fill: "#1d1a17" }],
    ["circle", { cx: 27.8, cy: 49, r: 0.8, fill: "#1d1a17" }],
    ["line", { x1: 20, y1: 46, x2: 32, y2: 46, stroke: "#ffffff", "stroke-width": 1.2 }],
    ["path", { d: "M33 50 h6 M34 53 h5 M33 47 h4", stroke: "#ffffff", "stroke-width": 1, "stroke-linecap": "round" }],
    ["ellipse", { cx: 56, cy: 60, rx: 7, ry: 2, fill: "#000000", "fill-opacity": 0.2 }],
    ["path", { d: "M53 58 l-1 3 M59 58 l1 3", "stroke-width": 1.4, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["path", { d: "M50 48 L45 39 M62 48 L68 40", "stroke-width": 1.4, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["rect", { x: 49, y: 44, width: 14, height: 14, rx: 3, class: "cv-panel" }],
    ["rect", { x: 49, y: 44, width: 14, height: 14, rx: 3, fill: "none", "stroke-width": 1.2, class: "cv-ink3-line" }],
    ["path", { d: "M56 46 L57.2 48.9 L60.3 49.1 L57.9 51.1 L58.7 54.1 L56 52.4 L53.3 54.1 L54.1 51.1 L51.7 49.1 L54.8 48.9 Z", class: "cv-accent" }],
    ["circle", { cx: 57, cy: 30, r: 9, fill: "#ff3b1f", "fill-opacity": 0.25 }],
    ["circle", { cx: 57, cy: 30, r: 7, fill: "#d8283b" }],
    ["rect", { x: 50.6, y: 28.7, width: 12.8, height: 2.6, fill: "#ffffff" }],
    ["path", { d: "M53 28.9 l-1.2 1.1 l1.2 1.1 M56 28.9 l-1.2 1.1 l1.2 1.1 M59 28.9 l-1.2 1.1 l1.2 1.1 M62 28.9 l-1.2 1.1 l1.2 1.1", fill: "none", stroke: "#d8283b", "stroke-width": 0.7 }],
    ["circle", { cx: 54.5, cy: 26.5, r: 1.6, fill: "#ffffff", "fill-opacity": 0.4 }],
    ["path", { d: "M57 23 Q59 18 62 17 Q64 15 63 12", fill: "none", stroke: "#8a6a3c", "stroke-width": 1.2 }],
    ["path", { d: "M63 7.5 L64.1 10.6 L67.4 10.8 L64.8 12.8 L65.7 16 L63 14.2 L60.3 16 L61.2 12.8 L58.6 10.8 L61.9 10.6 Z", fill: "#f5b301" }],
    ["circle", { cx: 63, cy: 12, r: 1, fill: "#ffffff" }],
  ],
  hop: [
    ["rect", { width: 120, height: 72, fill: "#8ccf5f" }],
    ["rect", { width: 120, height: 9, fill: "#f0d27a" }],
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map((k) => ["rect", { x: k * 6, y: 7, width: 3, height: 2, fill: "#1d1a17" }]),
    ["circle", { cx: 100, cy: 14, r: 4, fill: "#3e8a3a" }],
    ["circle", { cx: 105.5, cy: 15, r: 3.5, fill: "#3e8a3a" }],
    ["circle", { cx: 99, cy: 12.6, r: 1.6, fill: "#5fae4f" }],
    ["rect", { y: 20, width: 120, height: 26, fill: "#3b87c9" }],
    ["path", { d: "M4 27 q2 -1.5 4 0 M40 41 q2 -1.5 4 0 M88 26 q2 -1.5 4 0 M20 40 q2 -1.5 4 0", fill: "none", stroke: "#ffffff", "stroke-opacity": 0.35, "stroke-width": 0.8 }],
    ["rect", { x: 8, y: 23, width: 40, height: 8, rx: 3, fill: "#9a6a3c" }],
    ["ellipse", { cx: 45.5, cy: 27, rx: 1.6, ry: 3.2, fill: "#d9b07a" }],
    ["rect", { x: 62, y: 36, width: 46, height: 8, rx: 3, fill: "#9a6a3c" }],
    ["ellipse", { cx: 64.5, cy: 40, rx: 1.6, ry: 3.2, fill: "#d9b07a" }],
    ["rect", { y: 46, width: 120, height: 14, fill: "#4c505c" }],
    ["rect", { x: 80, y: 48.5, width: 20, height: 9, rx: 2.5, fill: "#e8483c" }],
    ["rect", { x: 94.5, y: 50, width: 2.4, height: 6, fill: "#bfe6ff" }],
    ["rect", { x: 99, y: 49.2, width: 1, height: 1.8, fill: "#fff3a6" }],
    ["rect", { x: 99, y: 55, width: 1, height: 1.8, fill: "#fff3a6" }],
    ["rect", { x: 14, y: 48.5, width: 16, height: 9, rx: 2.5, fill: "#3fa7e0" }],
    ["rect", { x: 15.2, y: 50, width: 2.4, height: 6, fill: "#bfe6ff" }],
    ["rect", { y: 60, width: 120, height: 12, fill: "#d9d1c3" }],
    ...[0, 2, 4, 6, 8].map((k) => ["rect", { x: k * 12, y: 60, width: 12, height: 12, fill: "#cdc4b4" }]),
    ["ellipse", { cx: 23.5, cy: 15, rx: 1.5, ry: 4, fill: "#ff8a1f" }],
    ["ellipse", { cx: 29.5, cy: 15, rx: 1.5, ry: 4, fill: "#ff8a1f" }],
    ["circle", { cx: 26.5, cy: 22.5, r: 5, fill: "#ff8a1f" }],
    ["circle", { cx: 24.6, cy: 21.6, r: 1.3, fill: "#ffffff" }],
    ["circle", { cx: 28.4, cy: 21.6, r: 1.3, fill: "#ffffff" }],
    ["circle", { cx: 24.8, cy: 21.2, r: 0.6, fill: "#1d1a17" }],
    ["circle", { cx: 28.6, cy: 21.2, r: 0.6, fill: "#1d1a17" }],
    ["path", { d: "M56 66 Q52 52 62 42", fill: "none", stroke: "#ffffff", "stroke-width": 1.2, "stroke-dasharray": "2 2.5", "stroke-linecap": "round" }],
    ["path", { d: "M66 36 v3.4 h-1.2 M70 36 v3.4 h1.2", fill: "none", "stroke-width": 1.1, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["path", { d: "M63 29 L59.5 23.5 M73 29 L76.5 23.5", fill: "none", "stroke-width": 1.1, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["rect", { x: 63, y: 26, width: 10, height: 10, rx: 2.5, class: "cv-panel" }],
    ["rect", { x: 63, y: 26, width: 10, height: 10, rx: 2.5, fill: "none", "stroke-width": 1, class: "cv-ink3-line" }],
    ["path", { d: "M68.0 27.3 L68.8 29.3 L70.9 29.4 L69.3 30.8 L69.8 32.9 L68.0 31.8 L66.2 32.9 L66.7 30.8 L65.1 29.4 L67.2 29.3 Z", class: "cv-accent" }],
  ],
  bounce: [
    ["rect", { width: 120, height: 72, fill: "#6fbf4a" }],
    ...[0, 2, 4, 6, 8].map((k) => ["rect", { y: k * 8, width: 120, height: 4, fill: "#64b041" }]),
    ["rect", { y: 25, width: 120, height: 16, fill: "#3b87c9" }],
    ["rect", { y: 25, width: 120, height: 1.2, fill: "#c9b98a" }],
    ["rect", { y: 39.8, width: 120, height: 1.2, fill: "#c9b98a" }],
    ["path", { d: "M8 31 q2 -1.5 4 0 M92 35 q2 -1.5 4 0 M24 37 q2 -1.5 4 0 M104 29 q2 -1.5 4 0", fill: "none", stroke: "#ffffff", "stroke-opacity": 0.4, "stroke-width": 0.8 }],
    ["rect", { x: 42, width: 36, height: 25, fill: "#454a55" }],
    ["rect", { x: 42, y: 41, width: 36, height: 31, fill: "#454a55" }],
    ["rect", { x: 43.2, width: 1, height: 25, fill: "#f4f1ea" }],
    ["rect", { x: 75.8, width: 1, height: 25, fill: "#f4f1ea" }],
    ["rect", { x: 43.2, y: 41, width: 1, height: 31, fill: "#f4f1ea" }],
    ["rect", { x: 75.8, y: 41, width: 1, height: 31, fill: "#f4f1ea" }],
    ...[2, 14, 46, 58].map((y) => ["rect", { x: 59.4, y, width: 1.2, height: 6, fill: "#ffd84a" }]),
    ["rect", { x: 49, y: 25, width: 22, height: 4, fill: "#b07a45" }],
    ["rect", { x: 49, y: 36, width: 22, height: 5, fill: "#b07a45" }],
    ["path", { d: "M49 29 l2 1 l2 -1 l2 1.2 l2 -1 l2 1 l2 -1.1 l2 1 l2 -1 l2 1.2 l2 -1 l2 1 V29 Z M49 36 l2 -1 l2 1 l2 -1.2 l2 1 l2 -1 l2 1.1 l2 -1 l2 1 l2 -1.2 l2 1 l2 -1 V36 Z", fill: "#7d5330" }],
    ["rect", { x: 64, y: 6, width: 7, height: 11, rx: 1, fill: "#ff8a1f", stroke: "#1d1a17", "stroke-width": 0.6 }],
    ["rect", { x: 65, y: 9, width: 5, height: 6, fill: "#000000", "fill-opacity": 0.25 }],
    ["rect", { x: 46, y: 50, width: 7.6, height: 3, rx: 1.4, fill: "#a466ff", stroke: "#1d1a17", "stroke-width": 0.5 }],
    ["path", { d: "M45 47 l1.6 -1.6 M53.6 47 l1.6 -1.6 M45 56 l1.6 1.6 M53.6 56 l1.6 1.6", stroke: "#ffd84a", "stroke-width": 0.9, "stroke-linecap": "round" }],
    ["rect", { x: 52, y: 47, width: 8, height: 12, rx: 2.4, fill: "#000000", "fill-opacity": 0.28 }],
    ["path", { d: "M60 43 v-6 M60 47 v-2", stroke: "#ffffff", "stroke-width": 0.9, "stroke-dasharray": "1.5 1.5", "stroke-linecap": "round" }],
    ["rect", { x: 53.6, y: 26, width: 2, height: 3.6, rx: 0.6, fill: "#16161a" }],
    ["rect", { x: 64.4, y: 26, width: 2, height: 3.6, rx: 0.6, fill: "#16161a" }],
    ["rect", { x: 53.6, y: 35.4, width: 2, height: 3.6, rx: 0.6, fill: "#16161a" }],
    ["rect", { x: 64.4, y: 35.4, width: 2, height: 3.6, rx: 0.6, fill: "#16161a" }],
    ["rect", { x: 55, y: 23, width: 10, height: 17, rx: 3, class: "cv-accent" }],
    ["rect", { x: 56.4, y: 24.4, width: 7.2, height: 2.4, rx: 1, fill: "#bfe6ff" }],
    ["path", { d: "M56.6 31 L53.4 25.6 M63.4 31 L66.6 25.6", fill: "none", "stroke-width": 1, "stroke-linecap": "round", class: "cv-ink3-line" }],
    ["rect", { x: 56.6, y: 29, width: 6.8, height: 6.8, rx: 1.8, class: "cv-panel" }],
    ["rect", { x: 56.6, y: 29, width: 6.8, height: 6.8, rx: 1.8, fill: "none", "stroke-width": 0.8, class: "cv-ink3-line" }],
    ["path", { d: "M60.0 29.9 L60.6 31.4 L62.2 31.5 L61.0 32.5 L61.4 34.1 L60.0 33.2 L58.6 34.1 L59.0 32.5 L57.8 31.5 L59.4 31.4 Z", class: "cv-accent" }],
  ],
  ghoul: [
    ["rect", { width: 120, height: 72, fill: "#2e2140" }],
    ...[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((c) => ["path", { d: `M${c * 12 + 6 + (r % 2) * 6} ${r * 12 + 3} l1.4 2 l-1.4 2 l-1.4 -2 Z`, fill: "#62466b" }])),
    ["rect", { x: 50, y: 7, width: 18, height: 32, rx: 9, fill: "#3f2a28" }],
    ["rect", { x: 52, y: 9, width: 14, height: 28, rx: 7, fill: "#101626" }],
    ["circle", { cx: 56.5, cy: 16, r: 3.2, fill: "#a8c8ff" }],
    ["path", { d: "M59 10 v27 M52 25 h14", stroke: "#3f2a28", "stroke-width": 1 }],
    ["path", { d: "M99 13 l-6 -3.5 l1.8 4 l-3.4 0.8 Z M105 13 l6 -3.5 l-1.8 4 l3.4 0.8 Z", fill: "#5a3f9a" }],
    ["circle", { cx: 102, cy: 13.5, r: 2.4, fill: "#8b6fd6" }],
    ["circle", { cx: 101.2, cy: 13.2, r: 0.6, fill: "#ffffff" }],
    ["circle", { cx: 102.8, cy: 13.2, r: 0.6, fill: "#ffffff" }],
    ["rect", { y: 50, width: 120, height: 8, fill: "#3f2a28" }],
    ["rect", { y: 58, width: 120, height: 14, fill: "#5c3c27" }],
    ["rect", { y: 58, width: 120, height: 2, fill: "#9a6a44" }],
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => ["rect", { x: k * 12 + 8, y: 58, width: 0.6, height: 2, fill: "#2b1b12" }]),
    ["path", { d: "M40 46 L82 37 L82 55 Z", fill: "#fff3b0", "fill-opacity": 0.35 }],
    ["rect", { x: 56, y: 45.2, width: 7, height: 1.6, rx: 0.8, fill: "#fff3b0" }],
    ["rect", { x: 70, y: 45.2, width: 7, height: 1.6, rx: 0.8, fill: "#fff3b0" }],
    ["circle", { cx: 66, cy: 62.5, r: 1.6, fill: "#ff6fae" }],
    ["circle", { cx: 72, cy: 62.5, r: 1.6, fill: "#7fd8ff" }],
    ["path", { d: "M93 58 l-1.4 -7 M98 58 l1.4 -7", stroke: "#3f6a35", "stroke-width": 1.8, "stroke-linecap": "round" }],
    ["rect", { x: 89.5, y: 41, width: 11, height: 10.5, rx: 2, fill: "#6a4a8a" }],
    ["path", { d: "M90 44 h-9 M91 47.5 h-8", stroke: "#7fc96b", "stroke-width": 1.9, "stroke-linecap": "round" }],
    ["rect", { x: 89.5, y: 31.5, width: 10, height: 9.5, rx: 3.2, fill: "#7fc96b" }],
    ["circle", { cx: 92, cy: 35.5, r: 1.9, fill: "#ffffff" }],
    ["circle", { cx: 96.4, cy: 35.5, r: 1.3, fill: "#ffffff" }],
    ["circle", { cx: 91.4, cy: 35.7, r: 0.8, fill: "#1d1a17" }],
    ["circle", { cx: 95.9, cy: 35.7, r: 0.6, fill: "#1d1a17" }],
    ["path", { d: "M91.5 38.8 h5 M92.5 38.3 v1 M94 38.3 v1 M95.5 38.3 v1", stroke: "#2f4a28", "stroke-width": 0.5 }],
    ["path", { d: "M24.5 58 l0.8 -4.5 M30.5 58 l-0.8 -4.5 M21 46 l-3.5 4.5 M33 45.5 L37 45.5", fill: "none", stroke: "#f0ece5", "stroke-width": 1.2, "stroke-linecap": "round" }],
    ["ellipse", { cx: 24.6, cy: 58.3, rx: 2, ry: 1, fill: "#f0ece5" }],
    ["ellipse", { cx: 30.8, cy: 58.3, rx: 2, ry: 1, fill: "#f0ece5" }],
    ["rect", { x: 36.5, y: 44.2, width: 4, height: 2.6, fill: "#4a4f5a" }],
    ["rect", { x: 40, y: 43.6, width: 1, height: 3.8, fill: "#c9ced6" }],
    ["rect", { x: 21, y: 40, width: 12, height: 13, rx: 3, class: "cv-panel" }],
    ["rect", { x: 21, y: 40, width: 12, height: 13, rx: 3, fill: "none", "stroke-width": 1, class: "cv-ink3-line" }],
    ["path", { d: "M27.4 41.4 L28.3 43.6 L30.7 43.7 L28.9 45.3 L29.5 47.6 L27.4 46.3 L25.3 47.6 L25.9 45.3 L24.1 43.7 L26.5 43.6 Z", class: "cv-accent" }],
    ["path", { d: "M25.2 49.6 q2.2 1.8 4.4 0", fill: "none", "stroke-width": 0.9, "stroke-linecap": "round", class: "cv-ink3-line" }],
  ],
  plain: [
    ["rect", { width: 120, height: 72, class: "cv-panel" }],
    ["rect", { x: 44, y: 20, width: 32, height: 32, rx: 7, fill: "none", "stroke-width": 2.5, class: "cv-ink3-line" }],
    ["circle", { cx: 53, cy: 29, r: 3, class: "cv-ink2" }],
    ["circle", { cx: 60, cy: 36, r: 3, class: "cv-ink2" }],
    ["circle", { cx: 67, cy: 43, r: 3, class: "cv-ink2" }],
  ],
});

function cover(id) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 120 72");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [tag, attrs] of COVERS[id] || COVERS.plain) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
    svg.append(node);
  }
  return svg;
}

// The round a card's game has waiting, if any: only the game last played can
// have one, since picking another lets it go.
const pausedRound = (id) => {
  const g = games.get(id);
  return g && g.state === "paused" ? g : null;
};

// The picker: a card per game with its cover, its line, its best and, for the
// game last played, whether a round of it is waiting.
function drawPicker() {
  const picker = $("activities-picker");
  if (!hasPicker()) return picker.replaceChildren();
  const cards = el("div", "activities-cards");
  cards.setAttribute("role", "group");
  cards.setAttribute("aria-label", "Pick a game");
  for (const entry of list) {
    const b = el("button", "activities-card");
    b.type = "button";
    b.dataset.activity = entry.id;
    const art = el("span", "activities-cover");
    art.append(cover(entry.id));
    const body = el("span", "activities-card-body");
    const n = best(entry.id);
    // A game with courses counts the courses it has a best on.
    const played = entry.courses ? entry.courses.filter((c) => best(entry.id, c)).length : 0;
    const bestText = entry.courses
      ? played ? `Best on ${played} of ${entry.courses.length} courses` : `${entry.courses.length} courses to play`
      : n ? `${lowerIsBetter.has(entry.id) ? "Best round" : "Best"}: ${n}` : "No best yet";
    body.append(el("span", "activities-card-title", entry.title), el("span", "activities-card-blurb", entry.blurb || ""), el("span", "activities-card-best", bestText));
    b.append(art, body);
    const waiting = pausedRound(entry.id);
    const tag = waiting ? `Round paused, score ${waiting.score}` : entry.id === looks.lastActivity ? "Last played" : "";
    if (tag) b.append(el("span", `activities-card-tag${waiting ? " waiting" : ""}`, tag));
    b.addEventListener("click", () => pick(entry.id));
    cards.append(b);
  }
  const parts = [cards];
  if (list.some((e) => pausedRound(e.id))) parts.push(el("p", "help activities-picker-note", "Picking a different game ends the paused round."));
  picker.replaceChildren(...parts);
}

// The game to put focus on when the picker shows: the one with a round
// waiting, else the last one played, else the first.
function focusId() {
  if (currentId && list.some((e) => e.id === currentId)) return currentId;
  if (list.some((e) => e.id === looks.lastActivity)) return looks.lastActivity;
  return list.length ? list[0].id : null;
}

function showPicker() {
  if (game()) pauseAll("closed");
  dropCheats();
  view = "picker";
  applyView();
  showNote("");
  paintTitle();
  drawPicker();
  layout();
  const card = $("activities-picker").querySelector(`[data-activity="${focusId()}"]`);
  if (card) card.focus({ preventScroll: true });
}

// A pick from the picker: the game last played is let go when it is not the
// one picked, so only one game is ever loaded with a round in it. A game
// with courses opens on its dashboard.
function pick(id) {
  if (looks.lastActivity !== id) {
    looks.lastActivity = id;
    saveLooks();
  }
  if (currentId && currentId !== id) {
    pauseAll("closed");
    games.delete(currentId);
  }
  if (hasCourses(id)) return showCourses(id);
  showGame(id);
}

/* ----------------------------------------------------- course dashboard */

// The size, in CSS pixels, each course card's art is drawn at; the card
// stretches it to its width.
const ART_W = 320;
const ART_H = 240;

// A game's course dashboard: a card per course with a picture of one of its
// holes, its line, its holes and par, its best, and for the course on the
// board, whether a round of it is waiting. Each course keeps its own best.
function drawCourses(id) {
  const picker = $("activities-picker");
  const def = defs.get(id);
  const g = games.get(id);
  if (!def || !g) return picker.replaceChildren();
  const cards = el("div", "activities-cards activities-courses");
  cards.setAttribute("role", "group");
  cards.setAttribute("aria-label", "Pick a course");
  for (const c of def.courses) {
    const b = el("button", "activities-card activities-course");
    b.type = "button";
    b.dataset.course = c.id;
    const art = el("span", "activities-cover");
    const canvas = el("canvas");
    canvas.setAttribute("aria-hidden", "true");
    try {
      def.preview(canvas, c.id, ART_W, ART_H);
    } catch {}
    // The card sizes the art, not the size it was drawn at.
    canvas.style.width = "";
    canvas.style.height = "";
    art.append(canvas);
    const body = el("span", "activities-card-body");
    const n = best(id, c.id);
    const bestText = n ? `Best round: ${n} (${signed(n - c.par)})` : "No best yet";
    body.append(
      el("span", "activities-card-title", c.name),
      el("span", "activities-card-blurb", c.blurb),
      el("span", "activities-card-meta", `${c.holes} holes · Par ${c.par}`),
      el("span", "activities-card-best", bestText)
    );
    b.append(art, body);
    const mine = g.course === c.id;
    const waiting = mine && g.state === "paused";
    const tag = waiting ? `Round paused, hole ${g.round.hole + 1}` : mine && g.state !== "ready" ? "Last played" : "";
    if (tag) b.append(el("span", `activities-card-tag${waiting ? " waiting" : ""}`, tag));
    b.addEventListener("click", () => playCourse(id, c.id));
    cards.append(b);
  }
  const parts = [cards];
  if (g.state === "paused") parts.push(el("p", "help activities-picker-note", "Picking a different course ends the paused round."));
  picker.replaceChildren(...parts);
}

// Shows game `id`'s course dashboard, loading the game first.
async function showCourses(id) {
  if (game()) pauseAll("closed");
  currentId = id;
  view = "courses";
  applyView();
  showNote("");
  paintTitle();
  $("activities-picker").replaceChildren();
  try {
    await loadGame(entryOf(id));
  } catch {
    if (currentId !== id || view !== "courses") return;
    return showNote(NOT_LOADED);
  }
  if (currentId !== id || view !== "courses") return;
  drawCourses(id);
  layout();
  const g = games.get(id);
  const card = $("activities-picker").querySelector(`[data-course="${g.course}"]`) || $("activities-picker").querySelector(".activities-card");
  if (card) card.focus({ preventScroll: true });
}

// A course picked on the dashboard: its round on the board, a fresh one
// unless the course picked is the one with a round waiting.
function playCourse(id, course) {
  const g = games.get(id);
  if (!g) return;
  g.setCourse(course);
  showGame(id);
}

// The arrows walk the cards: left and right one at a time, up and down a row.
function moveFocus(dir) {
  const cards = [...$("activities-picker").querySelectorAll(".activities-card")];
  if (!cards.length) return;
  const at = cards.indexOf(document.activeElement);
  if (at < 0) return cards[0].focus();
  const perRow = Math.max(1, cards.filter((c) => c.offsetTop === cards[0].offsetTop).length);
  const step = { left: -1, right: 1, up: -perRow, down: perRow }[dir];
  const next = cards[Math.min(cards.length - 1, Math.max(0, at + step))];
  next.focus();
}

/* ------------------------------------------------------------ opening */

// The window opens on the picker, unless a round is waiting: then straight
// back into it. With one game listed, it always opens on that game.
export async function openActivities() {
  unlockTones();
  const dlg = $("activities-modal");
  showNote("");
  if (!dlg.open) dlg.showModal();
  renderBanner();
  if (!list.length) return;
  const waiting = currentId && pausedRound(currentId);
  if (hasPicker() && !waiting) return showPicker();
  await showGame(waiting ? currentId : list[0].id);
}

function closeActivities() {
  pauseAll("closed");
  dropCheats();
  const dlg = $("activities-modal");
  if (dlg.open) dlg.close();
}

/* --------------------------------------------------------------- keys */

// The code for endless lives in any game that has lives (one whose game
// answers cheat(on)): typed on the board, each key passed on to the game as
// usual. It lasts for the round it was typed in (the game's start() makes a
// new round without it) and is dropped when the person leaves the game for
// the picker or closes the window.
export const CHEAT_CODE = Object.freeze(["ArrowUp", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a", " "]);
// The code for the stage select in a game that has one (one whose game
// answers stageSelect(), Ghoul Rush): the same arrows, then S. For testing:
// a practice round that starts on any stage and room.
export const STAGE_CODE = Object.freeze(["ArrowUp", "ArrowDown", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "s"]);
// How far into each code the keys typed so far are.
const typed = { cheat: 0, stage: 0 };
// The games the code is on in, to let go of on leaving.
const cheated = new Set();

// One key toward a code: whether it is the last one.
function codeStep(name, code, key) {
  if (key === code[typed[name]]) typed[name]++;
  else typed[name] = key === code[0] ? 1 : 0;
  if (typed[name] < code.length) return false;
  typed[name] = 0;
  return true;
}

function dropCheats() {
  for (const g of cheated) g.cheat(false);
  cheated.clear();
  typed.cheat = typed.stage = 0;
}

function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const done = view === "game" && !e.repeat && codeStep("cheat", CHEAT_CODE, key);
  const select = view === "game" && !e.repeat && codeStep("stage", STAGE_CODE, key);
  onGameKey(e, key);
  const g = done || select ? game() : null;
  if (select && g && typeof g.stageSelect === "function" && !$("activities-board").hidden && !(counting > 0)) {
    g.stageSelect();
    follow();
  }
  if (!done || !g || typeof g.cheat !== "function") return;
  g.cheat(true);
  cheated.add(g);
  tone("extraLife", 0.7);
}

function onGameKey(e, key) {
  const onButton = document.activeElement instanceof HTMLButtonElement && e.currentTarget.contains(document.activeElement);
  // The Music slider keeps its own arrows, Home, End and page keys.
  if (e.target === $("activities-music-level") && /^(Arrow|Home$|End$|Page)/.test(key)) return;
  // A window button keeps its own space and Enter.
  if (onButton && (key === " " || key === "Enter")) return;
  // Esc leaves full screen first, as the browser's own does; a second closes.
  if (key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    return full ? toggleFull() : closeActivities();
  }
  // On the picker and a course dashboard the arrows walk the cards, and
  // space and Enter press one.
  if (view === "picker" || view === "courses") {
    if (Object.hasOwn(KEYS, key) && KEYS[key] !== "action") {
      e.preventDefault();
      e.stopPropagation();
      moveFocus(KEYS[key]);
    }
    return;
  }
  const g = game();
  const hidden = $("activities-board").hidden;
  if (key === "f") {
    e.preventDefault();
    e.stopPropagation();
    if (!e.repeat) toggleFull();
    return;
  }
  if (key === "p") {
    e.preventDefault();
    e.stopPropagation();
    // A held P would flicker between the two; and a board nobody can see
    // never plays.
    if (e.repeat) return;
    if (g && g.state === "running") pauseAll("key");
    else if (g && g.state === "paused" && !hidden) play(g, () => g.resume());
    return follow();
  }
  // R starts the round over, from the countdown: running, paused or
  // finished, never from a game not yet begun. Held once, like P.
  if (key === "r") {
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || !g || hidden || g.state === "ready") return follow();
    play(g, () => {
      stopLoop();
      g.start();
    });
    return follow();
  }
  // Enter does all three: it pauses a running round, plays on from a pause
  // and starts a new round. Like P it pauses even during the countdown; a
  // held Enter acts once.
  if (key === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    if (e.repeat || !g) return follow();
    // A game holding for a key takes this one too.
    if (!hidden && counting <= 0 && g.anyKey?.()) return follow();
    if (g.state === "running") pauseAll("key");
    else if (hidden || counting > 0) return follow();
    else if (g.state === "paused") play(g, () => g.resume());
    else play(g, () => g.key("action"));
    return follow();
  }
  if (!Object.hasOwn(KEYS, key)) {
    // A printable key the window has no use for can still start a game holding for one.
    if (key.length === 1 && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey && !hidden && counting <= 0 && g?.anyKey?.()) {
      e.preventDefault();
      e.stopPropagation();
      follow();
    }
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  // A held space would restart a round the moment the last one ends; arrows
  // may repeat.
  if (e.repeat && KEYS[key] === "action") return;
  if (!g || hidden || counting > 0) return follow();
  // A repeat is marked as one, so a one-press game (Stack Deploy) can tell a
  // key held through the countdown from a fresh press.
  if (KEYS[key] === "action" && toCoursesWhenOver(g)) return;
  if (g.state !== "paused") g.key(KEYS[key], e.repeat);
  // Any game key plays on from a pause, a held one excepted. A direction is
  // passed on too, so one press resumes and steers; space only resumes, so it
  // never also starts a new round.
  else if (!e.repeat)
    play(g, () => {
      g.resume();
      if (KEYS[key] !== "action") g.key(KEYS[key]);
    });
  follow();
}

// For a game with release(): a game key let go, so a game can act on a key
// held down (Mini golf's fast-forward and its turning aim). Always passed on,
// paused or not, so nothing is left held; a game's pause() drops whatever it
// holds anyway, since a release can be lost to a blur.
function onKeyUp(e) {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (!Object.hasOwn(KEYS, key)) return;
  const g = game();
  if (g && typeof g.release === "function") g.release(KEYS[key]);
}

/* ------------------------------------------------------------ pointer */

const POINTER = Object.freeze({ pointerdown: "down", pointermove: "move", pointerup: "up", pointercancel: "cancel" });

// True from a down passed on to the game until its up, cancel or a pause, so
// the release of a press that only played on, or of a drag a pause dropped,
// never reaches the game.
let dragging = false;

// For a game with pointer(): positions in CSS pixels from the canvas's
// top-left. A press on a paused board plays on and starts nothing else; on a
// ready or finished game it is passed on, so the game can start a round.
function onPointer(e) {
  const g = game();
  if (!g || typeof g.pointer !== "function" || $("activities-board").hidden) return;
  const canvas = $("activities-canvas");
  const type = POINTER[e.type];
  // The countdown holds the board still: a press waits for it, and only the
  // release of a press made before it gets through.
  if (counting > 0 && type !== "up" && type !== "cancel") {
    if (type === "down") e.preventDefault();
    return;
  }
  if (type === "down") {
    if (e.button !== 0) return;
    e.preventDefault();
    $("activities-board").focus({ preventScroll: true });
    if (g.state === "paused") {
      play(g, () => g.resume());
      return follow();
    }
    if (toCoursesWhenOver(g)) return;
    // A drag that leaves the canvas still ends here with an up.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    dragging = true;
  } else if (type === "up" || type === "cancel") {
    if (!dragging) return;
    dragging = false;
  }
  const r = canvas.getBoundingClientRect();
  const used = g.pointer(type, e.clientX - r.left, e.clientY - r.top);
  if (type !== "move" || used) follow();
}

/* ------------------------------------------------------- whose turn */

// The banner takes height from the board, so the game is laid out again
// whenever it comes or goes; otherwise the board would clip the canvas.
function renderBanner() {
  const banner = $("activities-banner");
  const text = bannerDismissed ? "" : myTurn().length ? TURN_BANNER : finish() ? FINISH_BANNER : "";
  // A question answered elsewhere takes the banner, and its button, away:
  // the hold goes with it.
  if (!text) held = null;
  $("activities-banner-text").textContent = text;
  const g = game();
  $("activities-unpause").hidden = !(g && held === g && g.state === "paused");
  if (banner.hidden === !text) return;
  banner.hidden = !text;
  if ($("activities-modal").open) layout();
}

// From the render pass: a question that was not the person's a render ago,
// or a finish that was not up, pauses play. A stopped session or a dropped
// connection is not a reason; only the person's turn is.
export function renderActivities() {
  // The gear's Show Activities switch: off hides the die everywhere, and
  // closes a window left open, paused.
  $("btn-activities").hidden = looks.hideActivities;
  if (looks.hideActivities && $("activities-modal").open) closeActivities();
  const turn = new Set(myTurn().map((i) => i.id));
  const done = Boolean(finish());
  if (seenTurn) {
    if ([...turn].some((id) => !seenTurn.has(id))) {
      bannerDismissed = false;
      pauseAll("turn");
      hold();
    }
    if (done && !seenFinish) {
      bannerDismissed = false;
      pauseAll("finish");
      hold();
    }
  }
  seenTurn = turn;
  seenFinish = done;
  renderBanner();
}

// Holds a round the turn or finish just paused, if the window is open on it,
// and puts a full-screen window back to its size so the banner and the page
// behind it show.
function hold() {
  setFull(false);
  const g = game();
  if (!$("activities-modal").open || !g || g.state !== "paused") return;
  held = g;
  paintOverlay();
}

// The banner's Unpause game: the one way to play on while held.
function unpause() {
  held = null;
  const g = game();
  if (g && g.state === "paused") play(g, () => g.resume());
  follow();
  $("activities-board").focus({ preventScroll: true });
}

function dismissBanner() {
  if (bannerDismissed) return;
  bannerDismissed = true;
  renderBanner();
}

// Closes the window and, for a question, lands on the first one that is the
// person's, the way the page's own question list does.
function goToIt() {
  const first = myTurn()[0];
  goingTo = Boolean(first);
  closeActivities();
  if (!first) return;
  page.selected = first.id;
  page.view = "questions";
  redraw();
  const m = $("main");
  m.focus();
  m.scrollTop = 0;
}

/* -------------------------------------------------------------- wiring */

export function wireActivities() {
  const dlg = $("activities-modal");
  lightDismiss(dlg);
  $("btn-activities").addEventListener("click", openActivities);
  $("activities-close").addEventListener("click", closeActivities);
  $("activities-back").addEventListener("click", goBack);
  $("activities-reset").addEventListener("click", resetBest);
  $("activities-goto").addEventListener("click", goToIt);
  $("activities-unpause").addEventListener("click", unpause);
  $("activities-overlay").addEventListener("click", () => {
    const g = game();
    if (!g || counting > 0) return;
    // A paused game plays on through resume(), as from the keys: a game
    // never turns itself back to running.
    play(g, () => (g.state === "paused" ? g.resume() : g.key("action")));
    follow();
    $("activities-board").focus({ preventScroll: true });
  });
  dlg.addEventListener("keydown", onKey);
  dlg.addEventListener("keyup", onKeyUp);
  for (const type of Object.keys(POINTER)) $("activities-canvas").addEventListener(type, onPointer);
  // Esc, and any other way the browser cancels the dialog, takes the same
  // path as Close.
  dlg.addEventListener("cancel", (e) => {
    e.preventDefault();
    closeActivities();
  });
  $("activities-full").addEventListener("click", toggleFull);
  $("activities-music-level").addEventListener("input", onMusicLevel);
  $("activities-music-level").addEventListener("change", onMusicLevel);
  $("activities-music-level").addEventListener("pointerup", () => $("activities-board").focus({ preventScroll: true }));
  $("activities-rail-exit").addEventListener("click", toggleFull);
  $("activities-stage").addEventListener("pointermove", () => {
    if (full) wakePointer();
  });
  document.addEventListener("fullscreenchange", onFullscreenChange);
  dlg.addEventListener("close", () => {
    held = null;
    setFull(false);
    pauseAll("closed");
    disarmReset();
    if (!goingTo) $("btn-activities").focus();
    goingTo = false;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAll("hidden");
  });
  window.addEventListener("blur", () => pauseAll("blur"));
  window.addEventListener("resize", () => {
    if (dlg.open) layout();
  });
  applyView();
}
