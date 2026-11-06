// Plan2Code Web Console - Stack Deploy, the sixth activity: the stacking rules, twists, tower styles, drawing and the game contract.
//
// The Activities window (screens/activities.js) drives everything: it ticks
// the game, hands it keys and presses on the board, and pauses it. A game
// never runs a timer or listens for a key of its own, so a paused game cannot
// move. The rules are plain functions over a round object (newRound,
// spawnBlock, advance, drop, grow), exported so the unit suite can drive them
// without a canvas; the default export is the contract every listed game
// answers.
//
// One button. A block slides back and forth above the tower, and a press
// drops it: whatever hangs past the block below is sliced off, so the next
// block is narrower, and a block that misses the tower ends the round. A drop
// close enough to exact is a perfect: it snaps on, nothing is sliced, and
// every GROW_EVERY perfects in a row grow the block back. The floors speed up
// and bring twists as the tower climbs (blocks that turn back, lag spikes,
// wind), and the tower changes style as it goes, from server racks to
// rockets. The highest floor a player has ever reached is the host's memo: a
// dashed marker across the stack, and the start screen's next style.

import { drawPill } from "./pills.js";

// The board, in units. The canvas is a whole number of pixels a unit.
export const W = 48;
export const H = 36;

// Below this many pixels a unit, the board is too small to play.
export const MIN_CELL = 8;

// The blocks, in units: each floor's height and the base's width (no block is
// ever wider). The slider runs HOVER above the top of the tower, so Planny
// fits under it, and the base stands GROUND_H above the bottom of the board.
export const BLOCK_H = 2;
export const BASE_W = 28;
const HOVER = 3.2;
const GROUND_H = 4;

// A kept part narrower than this falls off too: no block is a sliver.
export const MIN_W = 0.3;

// A perfect: a drop within PERFECT of the block's width of exact, or within
// the distance the block slides in PERFECT_MS, whichever is more, and never
// under MIN_ZONE_PX on screen, so it stays within reach on a small window and
// at speed. It is never more than half the block's width, so a perfect always
// lands on the block below. Every GROW_EVERY perfects in a row, the block
// grows back by GROW.
export const PERFECT = 0.03;
export const PERFECT_MS = 18;
export const MIN_ZONE_PX = 4;
export const GROW_EVERY = 3;
export const GROW = BASE_W * 0.08;

// The slide, in board widths a second: slow at first, 2% quicker every floor
// from RAMP_FROM, never past SPEED_CAP, and everything a fifth faster from
// FAST_FROM.
const SPEED_START = 0.6;
const SPEED_RAMP = 1.02;
const RAMP_FROM = 10;
const SPEED_CAP = 1.6;
const FAST_FROM = 90;
const FAST = 1.2;

// Points: one a floor; a perfect adds PERFECT_POINTS times the run of
// perfects (up to MAX_COMBO), and a perfect on a gold block GOLD_POINTS more.
export const FLOOR_POINTS = 1;
export const PERFECT_POINTS = 2;
export const MAX_COMBO = 5;
export const GOLD_POINTS = 10;

// Gold blocks: from GOLD_FROM, a GOLD_CHANCE each floor.
export const GOLD_FROM = 15;
const GOLD_CHANCE = 0.08;

// The twists' numbers: how often a block turns back (and where), how often
// it freezes, when and for how long, and how wind and rush hour bend its pace.
const TURN_CHANCE = 0.3;
const LAG_CHANCE = 0.4;
export const LAG_MS = 150;
const WIND_LOW = 0.3;
const WIND_GAIN = 1.2;
const RUSH = 1.6;
const RUSH_SLOW = 0.85;

// After a miss, the tower is shown whole for this long before the round ends.
export const OUTRO_MS = 1400;

// Time is handed out in slices this long, so a long frame never carries the
// block through a wall.
const SLICE_MS = 8;

const deepFreeze = (o) => Object.freeze(o.map((v) => Object.freeze(v)));

const GOLD = "#f5b301";
const DANGER = "#e2553f";

// What each stretch of floors brings, kept as each next one arrives.
export const TWISTS = deepFreeze([
  { id: "plain", from: 1, name: "Plain sliding", sub: "" },
  { id: "ramp", from: RAMP_FROM, name: "Speeding up", sub: "Every floor slides a little faster now" },
  { id: "turn", from: 20, name: "Mixed signals", sub: "Blocks come from either side, and some turn back" },
  { id: "lag", from: 30, name: "Lag spikes", sub: "A block may freeze for a beat, then jump" },
  { id: "wind", from: 40, name: "Wind", sub: "Blocks ease in and out as they swing" },
  { id: "rush", from: 70, name: "Rush hour", sub: "Blocks speed up through the middle" },
  { id: "fast", from: FAST_FROM, name: "Everything, faster", sub: "Hold on to Planny" },
]);

// The tower's looks, by the floor each starts at.
export const STYLES = deepFreeze([
  { id: "racks", from: 1, name: "Server racks", the: "the server racks", body: "#2d3240", edge: "#171a22", trim: "#4a5163", lights: ["#57e38a", "#f5b301", "#1fb6d9"] },
  { id: "offices", from: 25, name: "Office floors", the: "the office floors", body: "#d9c39a", edge: "#8c7349", trim: "#b89c6c", lights: ["#ffe08a", "#8fd3ff"] },
  { id: "glass", from: 50, name: "Glass towers", the: "the glass towers", body: "#4fa3cf", edge: "#1f5677", trim: "#a9e2f7", lights: ["#e6f7ff"] },
  { id: "rockets", from: 75, name: "Rockets", the: "the rockets", body: "#eef1f5", edge: "#8e97a6", trim: "#e2553f", lights: ["#1fb6d9"] },
]);

// The sky by height in floors: day, dusk, night, then space.
const SKY = Object.freeze([
  { at: 0, top: "#6fbcef", bottom: "#d8f0ff" },
  { at: 30, top: "#3e5fa8", bottom: "#ff9a6b" },
  { at: 55, top: "#0d1440", bottom: "#3a2d6b" },
  { at: 85, top: "#000006", bottom: "#0b0f2a" },
]);

// A perfect run climbs a major scale, in semitones.
const SCALE = Object.freeze([0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23, 24]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const top = (round) => round.blocks[round.blocks.length - 1];

/* ---------------------------------------------------------------- rules */

// How fast floor `floor` slides, in units a second.
export function speedAt(floor) {
  const ramp = SPEED_RAMP ** Math.max(0, floor - RAMP_FROM + 1);
  return W * Math.min(SPEED_CAP, SPEED_START * ramp) * (floor >= FAST_FROM ? FAST : 1);
}

export const twistsAt = (floor) => TWISTS.filter((t) => floor >= t.from).map((t) => t.id);

export const styleAt = (floor) => STYLES.reduce((found, s) => (floor >= s.from ? s : found), STYLES[0]);

// The pitch a drop sounds at with `streak` perfects in a row: a step up the
// scale for each, back to the bottom when the run breaks.
export const comboPitch = (streak) => 2 ** (SCALE[clamp(streak, 0, SCALE.length - 1)] / 12);

export function newRound(random = Math.random) {
  const round = {
    blocks: [{ x: (W - BASE_W) / 2, w: BASE_W, floor: 0, gold: false }],
    slider: null,
    floor: 0,
    score: 0,
    streak: 0,
    bestStreak: 0,
    perfects: 0,
    side: 1,
    clock: 0,
    // The smallest perfect zone, in units, for the canvas's size: set by the
    // game at each resize, so the rules need no canvas.
    minZone: 0,
    lost: false,
    outroMs: 0,
    over: false,
    events: [],
  };
  spawnBlock(round, random);
  return round;
}

// The next block, as wide as the top of the tower, at one wall and moving to
// the other. Sides take turns until the turn twist mixes them up. A twist or
// a style that starts on its floor is announced.
export function spawnBlock(round, random = Math.random) {
  const floor = round.floor + 1;
  const has = new Set(twistsAt(floor));
  const side = has.has("turn") ? (random() < 0.5 ? -1 : 1) : -round.side;
  round.side = side;
  const w = top(round).w;
  const s = {
    floor,
    w,
    x: side < 0 ? 0 : W - w,
    dir: side < 0 ? 1 : -1,
    speed: speedAt(floor),
    run: 0,
    t: 0,
    gold: floor >= GOLD_FROM && random() < GOLD_CHANCE,
    // How far into its travel it turns back once, and when it freezes.
    turnAt: has.has("turn") && random() < TURN_CHANCE ? 0.3 + random() * 0.4 : null,
    lagAt: has.has("lag") && random() < LAG_CHANCE ? 250 + random() * 700 : null,
    frozen: 0,
    wind: has.has("wind"),
    rush: has.has("rush"),
  };
  round.slider = s;
  const twist = TWISTS.find((t) => t.from === floor && t.sub);
  if (twist) round.events.push({ type: "twist", id: twist.id, floor });
  const style = STYLES.find((st) => st.from === floor && floor > 1);
  if (style) round.events.push({ type: "style", id: style.id, floor });
  return s;
}

const travel = (s) => W - s.w;

// The slider's pace where it is now: the floor's speed, eased near the walls
// in the wind, and quicker through the middle at rush hour.
function paceAt(s) {
  const p = travel(s) > 0 ? clamp(s.x / travel(s), 0, 1) : 0.5;
  let v = s.speed;
  if (s.wind) v *= (WIND_LOW + (1 - WIND_LOW) * Math.sin(Math.PI * p)) * WIND_GAIN;
  if (s.rush) v *= Math.abs(p - 0.5) < 0.18 ? RUSH : RUSH_SLOW;
  return v;
}

function slide(s, ms) {
  const span = travel(s);
  const dx = paceAt(s) * (ms / 1000);
  s.x += dx * s.dir;
  s.run += dx;
  if (s.x <= 0) {
    s.x = Math.min(span, -s.x);
    s.dir = 1;
  } else if (s.x >= span) {
    s.x = Math.max(0, 2 * span - s.x);
    s.dir = -1;
  }
  if (s.turnAt !== null && s.run >= s.turnAt * span) {
    s.dir = -s.dir;
    s.turnAt = null;
  }
}

// True while a lag spike holds the slider still.
export const frozen = (s) => Boolean(s && s.lagAt !== null && s.t >= s.lagAt);

function update(round, ms) {
  round.clock += ms;
  if (round.lost) {
    round.outroMs = Math.max(0, round.outroMs - ms);
    if (round.outroMs === 0) round.over = true;
    return;
  }
  const s = round.slider;
  if (!s) return;
  s.t += ms;
  if (!frozen(s)) return slide(s, ms);
  s.frozen += ms;
  if (s.frozen < LAG_MS) return;
  // The spike is over: the block jumps to where it would have been.
  for (let left = s.frozen; left > 0; left -= SLICE_MS) slide(s, Math.min(left, SLICE_MS));
  s.lagAt = null;
  s.frozen = 0;
  round.events.push({ type: "lag", floor: s.floor });
}

// Moves the round on by `ms`, in small slices.
export function advance(round, ms) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    update(round, slice);
  }
  return round.over ? "over" : "running";
}

// How close to exact counts as perfect for the block sliding now, in units:
// never more than half its width, so a drop that misses the tower is never a
// perfect.
export function zoneOf(round) {
  const s = round.slider;
  if (!s) return 0;
  return Math.min(s.w / 2, Math.max(s.w * PERFECT, (s.speed * PERFECT_MS) / 1000, round.minZone || 0));
}

// `offset` is how far the slider's left edge sits from the top block's.
export const isPerfect = (round, offset) => Math.abs(offset) <= zoneOf(round);

// Widens the top of the tower by `amount` about its middle, never past the
// base's width or off the board. Returns how much it grew.
export function grow(round, amount = GROW) {
  const b = top(round);
  const w = Math.min(BASE_W, b.w + amount);
  const added = w - b.w;
  if (added <= 0) return 0;
  b.x = clamp(b.x + b.w / 2 - w / 2, 0, W - w);
  b.w = w;
  return added;
}

// The press: drops the slider where it is drawn now, not where the next tick
// would put it. Returns what happened, or null with nothing to drop.
export function drop(round, random = Math.random) {
  const s = round.slider;
  if (!s || round.lost || round.over) return null;
  const below = top(round);
  const offset = s.x - below.x;
  if (isPerfect(round, offset)) {
    round.streak += 1;
    round.perfects += 1;
    round.bestStreak = Math.max(round.bestStreak, round.streak);
    round.blocks.push({ x: below.x, w: s.w, floor: s.floor, gold: s.gold });
    round.floor = s.floor;
    const points = FLOOR_POINTS + PERFECT_POINTS * Math.min(MAX_COMBO, round.streak) + (s.gold ? GOLD_POINTS : 0);
    round.score += points;
    let grew = s.gold ? grow(round, GROW * 2) : 0;
    if (round.streak % GROW_EVERY === 0) grew += grow(round);
    round.events.push({ type: "perfect", floor: s.floor, x: top(round).x, w: top(round).w, streak: round.streak, points, gold: s.gold, grew });
    spawnBlock(round, random);
    return { kept: s.w, sliced: 0, perfect: true, miss: false };
  }
  round.streak = 0;
  const left = Math.max(s.x, below.x);
  const right = Math.min(s.x + s.w, below.x + below.w);
  const kept = right - left;
  if (kept < MIN_W) {
    round.lost = true;
    round.outroMs = OUTRO_MS;
    round.slider = null;
    round.events.push({ type: "miss", floor: s.floor, x: s.x, w: s.w, gold: s.gold, dir: offset > 0 ? 1 : -1 });
    return { kept: 0, sliced: s.w, perfect: false, miss: true };
  }
  round.blocks.push({ x: left, w: kept, floor: s.floor, gold: s.gold });
  round.floor = s.floor;
  round.score += FLOOR_POINTS;
  // The overhang falls off the side it hung over.
  const piece = offset > 0 ? { x: right, w: s.w - kept, dir: 1 } : { x: s.x, w: s.w - kept, dir: -1 };
  round.events.push({ type: "drop", floor: s.floor, x: left, w: kept, piece, gold: s.gold, points: FLOOR_POINTS, share: piece.w / s.w });
  spawnBlock(round, random);
  return { kept, sliced: piece.w, perfect: false, miss: false };
}

/* -------------------------------------------------------------- drawing */

const FALLBACK_COLORS = Object.freeze({ board: "#ffffff", line: "#e4ddd1", you: "#206cc3", head: "#1d1a17" });

// The page's tokens, read again at each round and each resize, so text and
// Planny follow a theme or highlight change made while the game sat paused. A
// stub canvas in Node has no computed style, so every color falls back.
function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return {
    board: pick("--panel", FALLBACK_COLORS.board),
    line: pick("--rule", FALLBACK_COLORS.line),
    you: pick("--accent", FALLBACK_COLORS.you),
    head: pick("--ink", FALLBACK_COLORS.head),
  };
}

const SHADE = "rgba(0, 0, 0, 0.55)";

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Text with a dark edge, so it reads on any sky in either theme. `max`, when
// given, squeezes a long line to fit that many pixels.
function label(ctx, text, x, y, size, color, align = "center", max = undefined) {
  ctx.font = `800 ${Math.round(size)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(2, size / 6);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
  if (max === undefined) {
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return;
  }
  ctx.strokeText(text, x, y, max);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, max);
}

function star(ctx, x, y, outer, inner) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

const hex = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, p) => `rgb(${hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * p)).join(", ")})`;
const hash = (n) => {
  const v = Math.sin(n * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

// The sky for a camera `floors` up: a blend of the two stops around it, with
// stars coming out from dusk on.
function drawSky(ctx, u, floors, clock) {
  const w = W * u;
  const h = H * u;
  const next = SKY.findIndex((s) => s.at > floors);
  const a = SKY[next < 0 ? SKY.length - 1 : Math.max(0, next - 1)];
  const b = SKY[next < 0 ? SKY.length - 1 : next];
  const p = b === a ? 0 : clamp((floors - a.at) / (b.at - a.at), 0, 1);
  const g = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, h) : null;
  if (g && g.addColorStop) {
    g.addColorStop(0, mix(a.top, b.top, p));
    g.addColorStop(1, mix(a.bottom, b.bottom, p));
    ctx.fillStyle = g;
  } else ctx.fillStyle = a.top;
  ctx.fillRect(0, 0, w, h);
  const stars = clamp((floors - 35) / 30, 0, 1);
  if (stars > 0) {
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 40; i++) {
      ctx.globalAlpha = stars * (0.4 + 0.6 * Math.abs(Math.sin(clock / 700 + i)));
      ctx.fillRect(hash(i) * w, hash(i + 99) * h, Math.max(1, u * 0.15), Math.max(1, u * 0.15));
    }
    ctx.globalAlpha = 1;
  }
}

// The city behind the tower, sinking a little slower than the tower climbs so
// it reads as far off, then the ground the base stands on. Drawn in the
// zoomed view, as wide as the view at `zoom` (a pull back over a tall tower
// sees far past the board's own width) and deep enough for it.
function drawGround(ctx, u, floors, cam, zoom = 1) {
  const left = W / 2 - W / (2 * zoom) - 4.2;
  const right = W / 2 + W / (2 * zoom) + 4.2;
  const base = (H - GROUND_H + cam * 0.6) * u;
  if (base - 9 * u < H * u) {
    ctx.fillStyle = mix("#8aa6bd", "#1b1f3a", clamp(floors / 50, 0, 1));
    for (let i = Math.floor(left / 4.2); i < Math.ceil(right / 4.2); i++) {
      const bw = (2.5 + hash(i + 19) * 3) * u;
      const bh = (2 + hash(i + 43) * 7) * u;
      ctx.fillRect(i * 4.2 * u - u, base - bh, bw, bh + u * GROUND_H);
    }
  }
  const ground = (H - GROUND_H + cam) * u;
  ctx.fillStyle = "#4f8a3a";
  ctx.fillRect(left * u, ground, (right - left) * u, H * u * 2);
  ctx.fillStyle = "#3d6f2c";
  ctx.fillRect(left * u, ground, (right - left) * u, u * 0.4);
}

// One block in its floor's style, at screen pixels. The base reads `main`,
// the rest a release number.
function drawBlock(ctx, b, x, y, u, clock, glitch = false) {
  const st = styleAt(b.floor);
  const w = b.w * u;
  const h = BLOCK_H * u;
  if (glitch) {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = "#ff4fa3";
    ctx.fillRect(x - u * 0.4, y, w, h);
    ctx.fillStyle = "#1fb6d9";
    ctx.fillRect(x + u * 0.4, y, w, h);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = b.gold ? GOLD : st.body;
  ctx.fillRect(x, y, w, h);
  const lights = st.lights;
  if (st.id === "racks") {
    ctx.fillStyle = st.trim;
    ctx.fillRect(x, y + h * 0.48, w, Math.max(1, u * 0.12));
    for (let i = 0, cx = x + u * 0.8; cx < x + w - u * 0.3; i++, cx += u * 1.1) {
      const on = hash(b.floor * 31 + i + Math.floor(clock / 400 + hash(i) * 5)) > 0.35;
      ctx.fillStyle = on ? lights[i % lights.length] : st.trim;
      ctx.fillRect(cx, y + h * 0.22, u * 0.32, u * 0.32);
    }
  } else if (st.id === "offices") {
    // Lit by the window's place on the block, not on screen, so a moving
    // block's windows keep their colors.
    for (let i = 0, cx = x + u * 0.5; cx < x + w - u * 0.9; i++, cx += u * 1.6) {
      ctx.fillStyle = hash(b.floor * 17 + i) > 0.4 ? lights[0] : lights[1];
      ctx.fillRect(cx, y + h * 0.25, u * 0.9, h * 0.5);
    }
  } else if (st.id === "glass") {
    ctx.fillStyle = st.trim;
    for (let cx = x + u * 1.2; cx < x + w; cx += u * 1.8) ctx.fillRect(cx, y, Math.max(1, u * 0.1), h);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = lights[0];
    ctx.fillRect(x, y + h * 0.1, w, h * 0.2);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = st.trim;
    ctx.fillRect(x, y + h * 0.7, w, h * 0.16);
    ctx.fillStyle = lights[0];
    for (let cx = x + u * 1.2; cx < x + w - u * 0.5; cx += u * 2.4) {
      ctx.beginPath();
      ctx.arc(cx, y + h * 0.38, u * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (b.gold) {
    ctx.globalAlpha = 0.5 + 0.3 * Math.sin(clock / 120);
    ctx.fillStyle = "#fff4c2";
    ctx.fillRect(x, y, w, h * 0.22);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = b.gold ? "#a67400" : st.edge;
  ctx.lineWidth = Math.max(1, u * 0.12);
  ctx.strokeRect(x, y, w, h);
  if (w > u * 3.4) {
    ctx.font = `700 ${Math.round(u * 0.75)}px ui-monospace, Consolas, monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    // Light on a dark rack, dark on everything else, a gold rack too.
    ctx.fillStyle = st.id === "racks" && !b.gold ? "#c9d1e0" : "#1d1a17";
    ctx.globalAlpha = 0.75;
    ctx.fillText(b.floor ? `v${b.floor}` : "main", x + u * 0.3, y + h * 0.72);
    ctx.globalAlpha = 1;
  }
}

// Planny, feet at x, y: a box with a star eye, tipping by `angle`, arms up
// while he cheers.
function drawPlanny(ctx, x, y, u, colors, angle, cheer) {
  const s = u * 1.05;
  ctx.save();
  ctx.translate(x, y);
  if (typeof ctx.rotate === "function") ctx.rotate(angle);
  ctx.fillStyle = colors.head;
  ctx.fillRect(-s * 0.55, -s * 0.36, s * 0.3, s * 0.36);
  ctx.fillRect(s * 0.25, -s * 0.36, s * 0.3, s * 0.36);
  roundRect(ctx, -s, -s * 2.25, s * 2, s * 1.9, s * 0.4);
  ctx.fillStyle = colors.board;
  ctx.fill();
  ctx.lineWidth = Math.max(1.5, u * 0.16);
  ctx.strokeStyle = colors.head;
  ctx.stroke();
  star(ctx, 0, -s * 1.62, s * 0.45, s * 0.2);
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, -s * 1.15, s * 0.28, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.beginPath();
  const lift = cheer ? -1 : 1;
  ctx.moveTo(-s, -s * 1.3);
  ctx.lineTo(-s * 1.5, -s * 1.3 + lift * s * 0.7);
  ctx.moveTo(s, -s * 1.3);
  ctx.lineTo(s * 1.5, -s * 1.3 + lift * s * 0.7);
  ctx.stroke();
  ctx.restore();
}

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${Math.round(h * 0.62)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = h * 0.7 + text.length * h * 0.42;
  drawPill(ctx, x, y, w, h, text, color, fill, y + h / 2 + 1);
  return w;
}

// The score big at the top, the floor and style beside it, and the run of
// perfects with how near the next grow-back is.
function drawHud(ctx, round, u) {
  label(ctx, String(round.score), (W * u) / 2, u * 2.1, u * 2.6, "#ffffff");
  const h = Math.max(14, u * 1.05);
  let x = u * 0.5;
  x += pill(ctx, x, u * 0.45, h, `FLOOR ${round.floor}`, "#ffffff") + 6;
  if (round.streak > 0) pill(ctx, x, u * 0.45, h, `x${Math.min(MAX_COMBO, round.streak)} PERFECT`, GOLD, (round.streak % GROW_EVERY || GROW_EVERY) / GROW_EVERY);
  const name = styleAt(Math.max(1, round.floor + 1)).name.toUpperCase();
  pill(ctx, W * u - u * 0.5 - (h * 0.7 + name.length * h * 0.42), u * 0.45, h, name, "#8fd3ff");
}

// A banner is a light strip low on the board, under the slider once the
// camera climbs. On the first floors the slider is still that low, so while
// it is under the strip the banner fades to BANNER_SEE_THROUGH over
// BANNER_FADE_MS.
const BANNER_Y = H * 0.72;
const BANNER_SHADE = "rgba(0, 0, 0, 0.3)";
const BANNER_SEE_THROUGH = 0.12;
const BANNER_FADE_MS = 140;

// Whether a block whose top sits `top` units down the board overlaps the
// banner's strip.
export const underBanner = (top) => top + BLOCK_H > BANNER_Y - 2.6 && top < BANNER_Y + 2.6;

function drawBanner(ctx, b, u) {
  const w = W * u;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = BANNER_Y * u;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - u * 2.1, w, u * 4.2);
  label(ctx, b.title, w / 2, y - u * 0.5, u * 1.6 * pop, b.color);
  if (b.sub) label(ctx, b.sub, w / 2, y + u * 1.2, u * 0.85, "#ffffff");
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip across the top: a line or two, then one
// dot per tower style, lit for those reached.
function drawStrip(ctx, u, lines, furthest) {
  const w = W * u;
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, 0, w, u * 6.4);
  lines.forEach((text, i) => label(ctx, text, w / 2, u * (1.3 + i * 1.6), u * (i ? 0.9 : 1.1), i ? "#ffffff" : GOLD, "center", w - u * 2));
  const r = u * 0.45;
  const gap = r * 4;
  const x = w / 2 - ((STYLES.length - 1) * gap) / 2;
  STYLES.forEach((st, i) => {
    ctx.beginPath();
    ctx.arc(x + i * gap, u * 5.1, r, 0, Math.PI * 2);
    if (Math.max(1, furthest) >= st.from) {
      ctx.fillStyle = st.id === "racks" ? "#57e38a" : st.body;
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  });
}

// The nudge to play again: the next style not yet reached (the racks, on
// floor 1, are where every tower starts).
function teaser(furthest) {
  const next = STYLES.find((st) => st.from > Math.max(1, furthest));
  return next ? `${next.name} start at floor ${next.from}.` : "Now beat your best!";
}

/* ------------------------------------------------------------- contract */

const MAX_PARTS = 300;
const DROP_MS = 90;
const HOP_MS = 220;

// Sounds: the landing's thump by the tower's style, how long a sliced piece
// or a missed block falls before it hits the ground, and the twists' own cues
// on top of the banner's chime.
const LAND_PITCH = Object.freeze({ racks: 1.1, offices: 0.85, glass: 1.25, rockets: 1.05 });
const DEBRIS_MS = 420;
const COLLAPSE_MS = 650;
const TWIST_CUES = Object.freeze({ ramp: "riser", turn: "stackTurn", lag: "stackGlitch", wind: "gust", rush: "honk", fast: "boost" });
// Within this share of the block sliced, a drop was nearly perfect; past
// this share, it only just caught the edge.
const CLOSE_SHARE = 0.06;
const TEETER_SHARE = 0.7;
// The top block narrower than this share of the base sounds a warning once
// (again only after it has grown back past it).
const NARROW_SHARE = 0.25;
// Wall knocks are at most this often, so a quick slide never rattles.
const BUMP_GAP_MS = 120;

function create({ canvas, tone = () => {}, hum = () => {}, onScore = () => {}, best = () => 0, memo = null }) {
  const ctx = canvas.getContext("2d");
  let colors = null;
  let round = newRound();
  let state = "ready";
  let u = MIN_CELL;
  let bestAtStart = 0;
  let beaten = false;
  // A press waits for the first tick after a start or a play-on, so the key
  // that plays on (an arrow passed on with the resume) never also drops.
  let armed = false;
  // Up held down: the window passes on an arrow's key repeats (it drops only
  // space's), marked as repeats, so up drops once a press and waits for its
  // release. A repeat never drops either: up held through the countdown,
  // whose first press the window keeps, must not drop at its first repeat.
  let held = false;
  // The highest floor ever reached. Without a memo (the unit suite) it lasts
  // as long as the game. The marker stays where it was when the round began.
  let furthest = 0;
  try {
    furthest = Math.max(0, memo ? Number(memo.get()) | 0 : 0);
  } catch {}
  let ghost = 0;
  let ghostPassed = false;
  let fx = null;
  const resetFx = () =>
    (fx = { parts: [], pieces: [], rings: [], floats: [], banners: [], shake: 0, flash: null, clock: 0, cam: 0, lostCam: 0, land: null, hop: null, wobble: 0, cheer: 0, later: [], run: 0, floor: 0, narrow: false, bumpMs: 0 });
  resetFx();

  // Saved only as a round pauses or ends, not at every floor.
  const keepFurthest = () => {
    if (round.floor <= furthest) return;
    furthest = round.floor;
    try {
      if (memo) memo.set(furthest);
    } catch {}
  };

  const minZone = () => MIN_ZONE_PX / u;
  const blockY = (i) => i * BLOCK_H;
  const sliderY = () => blockY(round.blocks.length) + HOVER;
  // Planny's feet: on the top block, or between two tops mid-hop.
  const plannyAt = () => {
    const b = top(round);
    const to = { x: b.x + b.w / 2, y: blockY(round.blocks.length) };
    if (!fx.hop) return to;
    const p = clamp(fx.hop.ms / HOP_MS, 0, 1);
    return { x: fx.hop.x + (to.x - fx.hop.x) * p, y: fx.hop.y + (to.y - fx.hop.y) * p + Math.sin(Math.PI * p) * 1.6 };
  };

  const burst = (x, y, color, n, speed = 8) => {
    for (let i = 0; i < n && fx.parts.length < MAX_PARTS; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.65);
      fx.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 400 + Math.random() * 400, max: 800, color, size: 0.2 + Math.random() * 0.25 });
    }
  };
  const float = (x, y, text, color) => fx.floats.push({ x, y, text, color, life: 900, max: 900 });
  const banner = (title, sub, color, ms = 1600) => {
    if (fx.banners.length >= 3 || fx.banners.some((b) => b.title === title)) return;
    fx.banners.push({ title, sub, color, life: ms, max: ms, see: 1 });
  };
  const flash = (color, ms = 260) => (fx.flash = { color, life: ms, max: ms });
  // A sound a moment from now (a piece landing far below): it waits on the
  // round's own ticks, so a pause holds it too. Sound only, never state.
  const soon = (ms, name, level = 1, pitch = 1) => fx.later.push({ ms, name, level, pitch });
  const landTone = (floor, level = 0.8) => tone("stackLand", level, LAND_PITCH[styleAt(floor).id] || 1);
  // The top block growing narrow: a warning once, again after it widens.
  const checkNarrow = () => {
    const thin = top(round).w < BASE_W * NARROW_SHARE;
    if (thin && !fx.narrow) tone("warn", 0.35);
    fx.narrow = thin;
  };
  // A block just landed: it falls the last bit of the way, and Planny hops
  // up onto it from the block below.
  const landed = () => {
    const b = round.blocks[round.blocks.length - 2];
    fx.hop = { x: b.x + b.w / 2, y: blockY(round.blocks.length - 1), ms: 0 };
    fx.land = { index: round.blocks.length - 1, ms: 0 };
    fx.cheer = 0;
  };

  const handle = (e) => {
    const mid = e.x + e.w / 2;
    const y = blockY(e.floor) + BLOCK_H;
    if (e.type === "perfect") {
      landed();
      tone("thunk", 1, comboPitch(e.streak));
      tone("perfect", 0.8, comboPitch(e.streak - 1));
      landTone(e.floor, 0.6);
      // A sparkle up the same scale, brighter the longer the run.
      tone("sparkle", Math.min(0.75, 0.25 + e.streak * 0.08), comboPitch(e.streak - 1));
      if (e.streak === MAX_COMBO) tone("stackComboMax", 0.8);
      fx.run = e.streak;
      fx.rings.push({ x: e.x, w: e.w, y: blockY(e.floor), life: 500, max: 500 });
      fx.cheer = 700;
      float(mid, y + 1, e.streak > 1 ? `Perfect! x${Math.min(MAX_COMBO, e.streak)}` : "Perfect!", GOLD);
      if (e.gold) {
        tone("coin");
        tone("coinUp", 0.7);
        burst(mid, y, GOLD, 30, 10);
        fx.shake = 160;
        float(mid, y + 2.4, `Gold! +${GOLD_POINTS}`, GOLD);
      }
      if (e.grew > 0) {
        tone("power");
        tone("stackGrow", 0.7);
        float(mid, y - 1, "Wider!", "#57e38a");
      }
    } else if (e.type === "drop") {
      landed();
      tone("thunk", 1, 1);
      tone("slice", 0.5);
      landTone(e.floor);
      // The bigger the cut, the louder and lower the blade.
      tone("stackSlice", clamp(0.35 + e.share, 0.35, 1), 1.2 - e.share * 0.4);
      if (e.share <= CLOSE_SHARE) tone("stackSoClose", 0.5);
      else if (e.share >= TEETER_SHARE) tone("stackTeeter", 0.7);
      // A run of GROW_EVERY or more perfects, broken.
      if (fx.run >= GROW_EVERY) tone("powerDown", 0.4);
      fx.run = 0;
      soon(DEBRIS_MS, "stackDebris", clamp(0.25 + e.share * 0.6, 0.25, 0.8), 1.3 - e.share * 0.5);
      const pc = e.piece;
      fx.pieces.push({ x: pc.x, w: pc.w, y: blockY(e.floor), floor: e.floor, gold: e.gold, vx: pc.dir * (2 + pc.w), vy: 3, rot: 0, vr: pc.dir * 2.5, life: 1400, max: 1400 });
      fx.wobble = Math.min(0.45, e.share * 1.4);
    } else if (e.type === "miss") {
      tone("crash");
      tone("fall", 0.7);
      tone("stackTopple", 0.8);
      soon(150, "whoosh", 0.5, 0.7);
      soon(COLLAPSE_MS, "stackCollapse", 0.9);
      fx.pieces.push({ x: e.x, w: e.w, y: blockY(e.floor) + HOVER, floor: e.floor, gold: e.gold, vx: e.dir * 3, vy: 0, rot: 0, vr: e.dir * 1.8, life: OUTRO_MS + 400, max: OUTRO_MS + 400 });
      fx.shake = 380;
      fx.wobble = 0.6;
      fx.lostCam = fx.cam;
      fx.banners = [];
      flash(DANGER, 300);
    } else if (e.type === "lag") {
      tone("zap", 0.3);
      tone("swoosh", 0.35, 1.3);
    }
    else if (e.type === "twist") {
      const t = TWISTS.find((k) => k.id === e.id);
      tone("levelup");
      if (TWIST_CUES[e.id]) soon(220, TWIST_CUES[e.id], 0.6);
      banner(`Floor ${e.floor}: ${t.name}`, t.sub, "#8fd3ff");
    } else if (e.type === "style") {
      const st = STYLES.find((k) => k.id === e.id);
      tone("levelup");
      soon(200, "fanfare", 0.6);
      if (st.id === "rockets") soon(700, "stackLiftoff", 0.8);
      banner(`Floor ${e.floor}: ${st.name}`, "The tower takes on a new look", "#ffffff");
    }
  };

  // Once a round each: past the highest floor ever (the dashed marker), and
  // past the best score this round began with.
  const checkMarks = () => {
    if (!ghostPassed && ghost > 0 && round.floor > ghost) {
      ghostPassed = true;
      tone("ace");
      tone("cheer", 0.5);
      flash("#ffffff", 300);
      banner("Highest floor yet!", `Past floor ${ghost}`, GOLD);
    }
    if (beaten || !(bestAtStart > 0) || round.score <= bestAtStart) return;
    beaten = true;
    tone("best");
    tone("applause", 0.5);
    banner("New best!", "Every floor from here is a record", GOLD, 1800);
  };

  const drain = () => {
    colors ||= readColors(canvas);
    for (const e of round.events.splice(0)) handle(e);
    // Every tenth floor landed chimes, the hundredth with the full victory,
    // and the next block rolls out with a chirp.
    if (round.floor > fx.floor && !round.lost) {
      fx.floor = round.floor;
      if (round.floor % 100 === 0) tone("victory", 0.8);
      else if (round.floor % 10 === 0) soon(120, "stackMilestone", 0.7);
      soon(140, "stackSpawn", 0.25, 0.9 + Math.min(0.6, round.floor / 150));
      checkNarrow();
    }
    checkMarks();
  };

  const runFx = (ms) => {
    fx.clock += ms;
    const s = ms / 1000;
    fx.parts = fx.parts.filter((p) => {
      p.life -= ms;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.vx *= 0.94;
      p.vy = p.vy * 0.94 - 8 * s;
      return p.life > 0;
    });
    fx.pieces = fx.pieces.filter((p) => {
      p.life -= ms;
      p.vy -= 30 * s;
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.rot += p.vr * s;
      return p.life > 0;
    });
    fx.rings = fx.rings.filter((r) => (r.life -= ms) > 0);
    fx.floats = fx.floats.filter((f) => {
      f.life -= ms;
      f.y += 1.8 * s;
      return f.life > 0;
    });
    if (fx.banners.length) {
      const b = fx.banners[0];
      const row = H - GROUND_H - (sliderY() + BLOCK_H - fx.cam);
      const target = round.slider && underBanner(row) ? BANNER_SEE_THROUGH : 1;
      b.see += (target - b.see) * Math.min(1, ms / BANNER_FADE_MS);
      b.life -= ms;
      if (b.life <= 0) fx.banners.shift();
    }
    if (fx.land && (fx.land.ms += ms) >= DROP_MS) fx.land = null;
    if (fx.hop && (fx.hop.ms += ms) >= HOP_MS) fx.hop = null;
    fx.bumpMs = Math.max(0, fx.bumpMs - ms);
    fx.later = fx.later.filter((l) => {
      if ((l.ms -= ms) > 0) return true;
      tone(l.name, l.level, l.pitch);
      return false;
    });
    fx.wobble *= Math.exp(-ms / 450);
    fx.cheer = Math.max(0, fx.cheer - ms);
    fx.shake = Math.max(0, fx.shake - ms);
    if (fx.flash && (fx.flash.life -= ms) <= 0) fx.flash = null;
    // The camera eases up to keep the slider about 40% from the top.
    const want = Math.max(0, sliderY() + BLOCK_H - (H * 0.6 - GROUND_H));
    if (!round.lost) fx.cam += (want - fx.cam) * Math.min(1, ms / 220);
  };

  const paint = () => {
    if (!ctx) return;
    colors ||= readColors(canvas);
    const w = W * u;
    const h = H * u;
    const clock = fx.clock;
    // After a miss the camera pulls back to show the whole tower once.
    let cam = fx.cam;
    let zoom = 1;
    if (round.lost || state === "over") {
      const p = clamp(1 - round.outroMs / OUTRO_MS, 0, 1) / 0.7;
      const e = p >= 1 ? 1 : -Math.cos(Math.min(1, p) * Math.PI) / 2 + 0.5;
      const height = blockY(round.blocks.length) + GROUND_H + 3;
      zoom = 1 + (Math.min(1, (H - 8) / height) - 1) * e;
      cam = fx.lostCam * (1 - e);
    }
    const sx = (x) => x * u;
    const sy = (y) => (H - GROUND_H - (y - cam)) * u;
    ctx.save();
    if (fx.shake > 0) ctx.translate((Math.random() - 0.5) * 0.6 * u, (Math.random() - 0.5) * 0.6 * u);
    drawSky(ctx, u, cam / BLOCK_H, clock);
    ctx.save();
    ctx.translate(w / 2, h);
    ctx.scale(zoom, zoom);
    ctx.translate(-w / 2, -h);
    drawGround(ctx, u, cam / BLOCK_H, cam, zoom);
    // Only the floors on screen are drawn.
    const low = Math.max(0, Math.floor((cam - GROUND_H) / BLOCK_H) - 1);
    const high = Math.min(round.blocks.length - 1, Math.ceil((cam + H / zoom) / BLOCK_H) + 1);
    for (let i = low; i <= high; i++) {
      const b = round.blocks[i];
      const fall = fx.land && fx.land.index === i ? HOVER * (1 - (fx.land.ms / DROP_MS) ** 2) : 0;
      drawBlock(ctx, b, sx(b.x), sy(blockY(i) + BLOCK_H + fall), u, clock);
    }
    if (ghost > 0) {
      const gy = sy(blockY(ghost + 1));
      ctx.globalAlpha = ghostPassed ? 0.35 : 0.85;
      ctx.strokeStyle = ghostPassed ? GOLD : "#ffffff";
      ctx.lineWidth = Math.max(1, u * 0.14);
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([u * 0.8, u * 0.6]);
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
      label(ctx, `Top floor ${ghost}`, w - u * 0.5, gy - u * 0.7, u * 0.8, ghostPassed ? GOLD : "#ffffff", "right");
      ctx.globalAlpha = 1;
    }
    const pl = plannyAt();
    const sway = fx.wobble * Math.sin(clock / 70);
    drawPlanny(ctx, sx(pl.x), sy(pl.y), u, colors, round.lost ? fx.wobble * Math.sin(clock / 50) : sway, fx.cheer > 0);
    const s = round.slider;
    if (s) drawBlock(ctx, s, sx(s.x), sy(sliderY() + BLOCK_H), u, clock, state !== "ready" && frozen(s));
    for (const p of fx.pieces) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.translate(sx(p.x + p.w / 2), sy(p.y + BLOCK_H / 2));
      if (typeof ctx.rotate === "function") ctx.rotate(p.rot);
      drawBlock(ctx, p, (-p.w / 2) * u, (-BLOCK_H / 2) * u, u, clock);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    for (const r of fx.rings) {
      const p = 1 - r.life / r.max;
      const grow = p * 2.2;
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1.5, u * 0.25 * (1 - p));
      roundRect(ctx, sx(r.x - grow), sy(r.y + BLOCK_H + grow), (r.w + grow * 2) * u, (BLOCK_H + grow * 2) * u, u * 0.6);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(sx(p.x - p.size / 2), sy(p.y + p.size / 2), p.size * u, p.size * u);
    }
    for (const f of fx.floats) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      label(ctx, f.text, sx(f.x), sy(f.y), u * 1.1, f.color);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
    if (fx.flash) {
      ctx.globalAlpha = 0.28 * (fx.flash.life / fx.flash.max);
      ctx.fillStyle = fx.flash.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if ((state === "running" || state === "paused") && !round.lost) drawHud(ctx, round, u);
    if (state === "running" && fx.banners.length) drawBanner(ctx, fx.banners[0], u);
    if (state !== "ready" && state !== "over") return;
    const reached = furthest > 0 ? `Highest floor ${furthest}: you have reached ${styleAt(furthest).the}. ${teaser(furthest)}` : `Land a block dead on to grow it back. ${teaser(0)}`;
    if (state === "ready") drawStrip(ctx, u, ["Space, up or a click drops the block", reached], furthest);
    else drawStrip(ctx, u, [`Floor ${round.floor}, ${round.perfects} perfect${round.perfects === 1 ? "" : "s"}, best run ${round.bestStreak}${beaten ? ", with a new best!" : ""}`, reached], furthest);
  };

  // The held sounds, asked for at every tick of a running round: the gantry's
  // motor under the slider (quiet while a lag spike holds it, pitched with its
  // pace), a gold block's shimmer, the wind growing as the tower gets tall
  // (and stronger once the wind twist blows), and the style's own room: the
  // racks' fans low down, the rockets' engines at the top.
  const hums = () => {
    const s = round.slider;
    if (s) {
      const pace = paceAt(s) / speedAt(1);
      hum("stack:slide", "stackSlide", frozen(s) ? 0 : 0.7, clamp(0.75 + pace * 0.3, 0.6, 2.4));
      if (s.gold) hum("stack:gold", "stackGold", 0.8, 1);
    }
    const height = Math.max(round.floor, fx.cam / BLOCK_H);
    const wind = clamp((height - 12) / 60, 0, 1) * 0.8 + (s && s.wind ? 0.25 : 0);
    if (wind > 0) hum("stack:wind", "wind", Math.min(1, wind), 0.7 + Math.min(1, height / 100) * 0.6);
    const style = styleAt(Math.max(1, round.floor + 1)).id;
    if (style === "racks") hum("stack:room", "stackServerFans", clamp(1 - round.floor / 25, 0.3, 1) * 0.8, 1);
    else if (style === "rockets") hum("stack:room", "stackThrusters", 0.5 + Math.min(0.5, (round.floor - 75) / 50), 1 + Math.min(0.5, (round.floor - 75) / 60));
  };

  // What the slider did this tick that the rules keep no event for: a knock
  // off a wall, a turn back mid-air, and the moment a lag spike freezes it.
  const sliderSounds = (s, before) => {
    if (!s || round.slider !== s) return;
    if (!before.frozen && frozen(s)) tone("stackGlitch", 0.45);
    if (s.dir === before.dir) return;
    if (before.turnAt !== null && s.turnAt === null) tone("stackTurn", 0.45);
    else if (fx.bumpMs === 0) {
      tone("stackBump", 0.3, clamp(0.8 + (paceAt(s) / speedAt(1)) * 0.2, 0.8, 1.6));
      fx.bumpMs = BUMP_GAP_MS;
    }
  };

  const start = () => {
    colors = null;
    round = newRound();
    round.minZone = minZone();
    state = "running";
    armed = false;
    resetFx();
    ghost = furthest;
    ghostPassed = false;
    try {
      bestAtStart = Number(best()) || 0;
    } catch {
      bestAtStart = 0;
    }
    beaten = false;
    tone("stackBoot", 0.6);
    drain();
    paint();
  };

  const end = () => {
    state = "over";
    // A round that set a record ends on a win, any other on the sad slide.
    if (beaten || ghostPassed) tone("victory", 0.7);
    else tone("gameOver", 0.6);
    keepFurthest();
    onScore(round.score);
  };

  // The one action: a drop, once the round has had its first tick.
  const press = () => {
    if (!armed || round.lost) return;
    if (!drop(round)) return;
    drain();
    paint();
  };

  return {
    get score() {
      return round.score;
    },
    get state() {
      return state;
    },
    // For the tests only: the window never reads it.
    get round() {
      return round;
    },
    start,
    pause() {
      if (state === "running") state = "paused";
      held = false;
      keepFurthest();
      paint();
    },
    resume() {
      if (state !== "paused") return;
      state = "running";
      armed = false;
    },
    key(name, repeat = false) {
      if (name !== "action" && name !== "up") return false;
      if (name === "up") {
        if (held || repeat) return true;
        held = true;
      }
      if (state === "ready" || state === "over") {
        if (name === "action") start();
      } else if (state === "paused") {
        state = "running";
        armed = false;
      } else press();
      return true;
    },
    // Up let go: the next press of it drops again.
    release(name) {
      if (name === "up") held = false;
    },
    // A press on the board: starts a round, or drops the block.
    pointer(type) {
      if (type !== "down") return false;
      if (state === "ready" || state === "over") start();
      else if (state === "running") press();
      else return false;
      return true;
    },
    tick(ms) {
      if (state !== "running") return;
      runFx(ms);
      const s = round.slider;
      const before = s ? { dir: s.dir, turnAt: s.turnAt, frozen: frozen(s) } : null;
      advance(round, ms);
      sliderSounds(s, before);
      drain();
      if (!round.over) hums();
      if (round.over) end();
      paint();
      armed = true;
    },
    resize(w, h) {
      const next = Math.floor(Math.min(w / W, h / H));
      if (!(next >= MIN_CELL)) return false;
      u = next;
      round.minZone = minZone();
      colors = null;
      const ratio = typeof devicePixelRatio === "number" && devicePixelRatio > 0 ? devicePixelRatio : 1;
      canvas.width = Math.round(W * u * ratio);
      canvas.height = Math.round(H * u * ratio);
      if (canvas.style) {
        canvas.style.width = `${W * u}px`;
        canvas.style.height = `${H * u}px`;
      }
      if (ctx && typeof ctx.setTransform === "function") ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      paint();
      return true;
    },
  };
}

export default Object.freeze({ id: "stack", title: "Stack Deploy", create });
