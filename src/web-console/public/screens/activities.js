// Plan2Code Web Console - Activities: the top bar's die, its dialog, the frame timer, the keys and every pause rule.
//
// Small games for a long wait. The list of games is activities.js; each game
// is its own module under activities/, loaded with import() the first time it
// is opened, and answers the calls the list's header names. This file owns
// everything around a game: the dialog, the one frame timer, the keys and the
// pauses. A game never runs a timer of its own, so a paused game cannot move:
// pausing is this file not ticking plus the game's own paused state. Nothing
// here talks to the agent or the session; it only reads whose turn it is, so
// a question, a sign-off or a finish always pauses play and says so.

import { page, redraw } from "../state.js";
import { finish, myTurn } from "../selectors.js";
import { looks, saveLooks } from "../looks.js";
import { el, lightDismiss } from "../render.js";
import { ACTIVITIES, bestKey, memoKey } from "../activities.js";
import { tone, unlockTones } from "../tones.js";

const $ = (id) => document.getElementById(id);

const NOT_LOADED = "This activity could not be loaded. Close and open Activities to try again.";
const NEED_KEYBOARD = "Activities need a keyboard.";
const TOO_SMALL = "Make the window bigger to play.";
const TURN_BANNER = "Plan2Code needs you: a question is waiting.";
const FINISH_BANNER = "Plan2Code is finished.";
const RESET_LABEL = "Reset best scores";
const RESET_CONFIRM = "Reset? Click again";

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

// One game object per listed game for the page's life, so a closed and
// reopened window, or a skill change on the same page, resumes the same round.
const games = new Map();
// A load in flight per game id, so two quick opens share one import().
const loading = new Map();
let currentId = null;
// The games that keep their lowest round as the best (their export says
// lowerIsBetter), not their highest.
const lowerIsBetter = new Set();

// The frame timer. `gen` counts starts and stops, so a frame asked for before
// a stop does nothing when it arrives, whatever the tick source is.
let gen = 0;
let looping = false;
let lastFrame = null;
// The ms left of the countdown while one is showing, else 0. Game keys,
// clicks and presses on the board wait for it; P and Esc still pause.
let counting = 0;

// What renderActivities saw last time: the ids that were the person's to
// answer, and whether a finish was up. Null until the first render.
let seenTurn = null;
let seenFinish = false;

// Set when the person plays on after a turn or finish pause: the banner stays
// down until the next new question or finish.
let bannerDismissed = false;

// Reset's confirm: the timer that puts its label back, while one is waiting.
let resetTimer = null;

// Go to it closes the window onto a question, so the close must not hand
// focus back to the die.
let goingTo = false;

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

/* ----------------------------------------------------------- the notes */

function showNote(text) {
  const note = $("activities-note");
  note.textContent = text;
  note.hidden = !text;
}

const hasKeyboard = () => typeof matchMedia !== "function" || matchMedia("(any-pointer: fine)").matches;

/* ------------------------------------------------------------ drawing */

const best = (id) => looks[bestKey(id)] || 0;

// The header's " · Snake best: 12" for the game on screen, or "no best yet"
// before its first full round.
function paintTitle() {
  const entry = list.find((e) => e.id === currentId);
  const n = entry ? best(entry.id) : 0;
  const text = entry ? (n ? ` · ${entry.title} best: ${n}` : ` · ${entry.title}: no best yet`) : "";
  const span = $("activities-title-best");
  if (span.textContent !== text) span.textContent = text;
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
function sparks(line) {
  const dialog = $("activities-modal");
  if (!line || !dialog || calm()) return;
  const chips = line.firstElementChild;
  const x = line.offsetLeft + (chips ? chips.offsetLeft + chips.offsetWidth / 2 : 40);
  const y = line.offsetTop + line.offsetHeight / 2;
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
    dialog.append(s);
    setTimeout(() => s.remove(), SPARK_MS);
  }
}

// Plays the burst again from its start, even mid-burst.
function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
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
    replay(line, "burst");
    sparks(line);
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
  else if (g && g.state === "paused") text = click ? "Paused. Press space, P or click to play" : "Paused. Press space or P to play";
  else if (g && g.state === "over") text = `Score: ${g.score}\nBest: ${best(currentId)}\n${click ? "Press space or click to play again" : "Press space to play again"}`;
  if (overlay.textContent !== text) overlay.textContent = text;
  overlay.classList.toggle("count", g !== null && g.state === "running" && counting > 0);
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
function recordScore(id, score) {
  const was = best(id);
  if (!(lowerIsBetter.has(id) ? !was || score < was : score > was)) return;
  looks[bestKey(id)] = score;
  saveLooks();
  paintTitle();
  if (!was || id !== currentId) return;
  watched.record = true;
  if (lowerIsBetter.has(id)) {
    tone("best");
    watched.passed = true;
    replay($("activities-score"), "burst");
    sparks($("activities-score"));
  }
}

function disarmReset() {
  clearTimeout(resetTimer);
  resetTimer = null;
  $("activities-reset").textContent = RESET_LABEL;
}

// The first click asks, inside the window; a second within a few seconds
// writes 0 to every listed game's best (the server refuses null).
function resetBest() {
  if (!resetTimer) {
    $("activities-reset").textContent = RESET_CONFIRM;
    resetTimer = setTimeout(disarmReset, RESET_CONFIRM_MS);
    return;
  }
  disarmReset();
  for (const entry of list) looks[bestKey(entry.id)] = 0;
  saveLooks();
  paintOverlay();
  paintTitle();
}

// Sizes the game to the board. A board too small to play, or a page with no
// keyboard, shows its note in place of the board. A game that no longer fits
// stops moving, since nobody can see it.
function layout() {
  const board = $("activities-board");
  const g = game();
  if (!hasKeyboard()) {
    board.hidden = true;
    return showNote(NEED_KEYBOARD);
  }
  if (!g) return;
  board.hidden = false;
  if (g.resize(board.clientWidth, board.clientHeight) === false) {
    board.hidden = true;
    pauseAll("hidden");
    return showNote(TOO_SMALL);
  }
  showNote("");
}

/* -------------------------------------------------------- frame timer */

function stopLoop() {
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
      looping = false;
      return paintOverlay();
    }
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

// Runs what the person did to the game; when it took a paused game back to
// running, the banner goes away until the next new question or finish.
function play(g, act) {
  const was = g.state;
  act();
  if (was === "paused" && g.state === "running") dismissBanner();
}

/* ------------------------------------------------------------- pauses */

// Every pause goes through here: "turn", "finish", "hidden", "blur" and
// "closed". None of them ever resumes or starts a round; only the person
// does: space, P or any other game key, a click on the overlay, or for a
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
      const g = def.create({ canvas: $("activities-canvas"), tone, onScore, best: () => best(entry.id), memo });
      games.set(entry.id, g);
      return g;
    })();
    // A failed load is forgotten, so the next open tries again.
    loading.set(entry.id, made);
    made.finally(() => loading.delete(entry.id)).catch(() => {});
  }
  return loading.get(entry.id);
}

// Makes `id` the game on screen: the one before it is paused, then the new
// one is loaded, sized and drawn.
async function showGame(id) {
  const entry = list.find((e) => e.id === id);
  if (!entry) return;
  if (currentId && currentId !== id) pauseAll("closed");
  currentId = id;
  drawPicker();
  paintTitle();
  try {
    await loadGame(entry);
  } catch {
    if (currentId !== id) return;
    $("activities-board").hidden = true;
    return showNote(NOT_LOADED);
  }
  if (currentId !== id) return;
  layout();
  paintOverlay();
  // Keys go to the game next, not to the picker button just pressed.
  if (!$("activities-board").hidden) $("activities-board").focus({ preventScroll: true });
}

/* ------------------------------------------------------------- picker */

// Shown only once two or more games are listed; with one, the window opens
// straight into it.
function drawPicker() {
  const picker = $("activities-picker");
  if (list.length < 2) {
    picker.hidden = true;
    picker.replaceChildren();
    return;
  }
  picker.hidden = false;
  picker.replaceChildren(
    ...list.map((entry) => {
      const b = el("button", "btn small ghost", entry.title);
      b.type = "button";
      b.dataset.activity = entry.id;
      b.setAttribute("aria-pressed", String(entry.id === currentId));
      b.addEventListener("click", () => pick(entry.id));
      return b;
    })
  );
}

function pick(id) {
  if (looks.lastActivity !== id) {
    looks.lastActivity = id;
    saveLooks();
  }
  showGame(id);
}

/* ------------------------------------------------------------ opening */

function startingId() {
  if (currentId && list.some((e) => e.id === currentId)) return currentId;
  if (list.length > 1 && list.some((e) => e.id === looks.lastActivity)) return looks.lastActivity;
  return list.length ? list[0].id : null;
}

export async function openActivities() {
  unlockTones();
  const dlg = $("activities-modal");
  showNote("");
  if (!dlg.open) dlg.showModal();
  renderBanner();
  paintTitle();
  $("activities-board").focus({ preventScroll: true });
  const id = startingId();
  if (id) await showGame(id);
}

function closeActivities() {
  pauseAll("closed");
  const dlg = $("activities-modal");
  if (dlg.open) dlg.close();
}

/* --------------------------------------------------------------- keys */

function onKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const onButton = document.activeElement instanceof HTMLButtonElement && e.currentTarget.contains(document.activeElement);
  // A window button keeps its own space and Enter.
  if (onButton && (key === " " || key === "Enter")) return;
  if (key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    return closeActivities();
  }
  const g = game();
  const hidden = $("activities-board").hidden;
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
  if (!Object.hasOwn(KEYS, key)) return;
  e.preventDefault();
  e.stopPropagation();
  // A held space would restart a round the moment the last one ends; arrows
  // may repeat.
  if (e.repeat && KEYS[key] === "action") return;
  if (!g || hidden || counting > 0) return follow();
  if (g.state !== "paused") g.key(KEYS[key]);
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
  $("activities-banner-text").textContent = text;
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
    }
    if (done && !seenFinish) {
      bannerDismissed = false;
      pauseAll("finish");
    }
  }
  seenTurn = turn;
  seenFinish = done;
  renderBanner();
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
  $("activities-reset").addEventListener("click", resetBest);
  $("activities-goto").addEventListener("click", goToIt);
  $("activities-overlay").addEventListener("click", () => {
    const g = game();
    if (!g || counting > 0) return;
    play(g, () => g.key("action"));
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
  dlg.addEventListener("close", () => {
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
}
