// Plan2Code Web Console - Crossing Rush's drawing: the lanes and what moves on them, Planny on his stick feet and the rival critters, the pickups, the night, the pills, the race bar and the banners, from a view hop.js refills.
//
// Drawing only: no rules and no state of its own. hop.js hands drawScene()
// one view object of the moment (the round, the board's geometry, the view's
// height, the effects running, the colors readColors() took from the page),
// so the rules never touch a canvas and this file never decides anything.
// Everything is drawn in board units under one scale. Anything that moves on
// its own (a ripple, a blink, a lantern) follows the view's clock or a lane's
// flow, never Math.random(), so a paused game's frame stays still.
//
// The lanes keep their own fixed colors, the same in light and dark, and so
// do the floating words and the banners (light text with a dark edge, which
// reads on every lane) and the pills (opaque dark, with text that reads on
// them at 4.5:1, from pills.js). The strip the pills sit on, the margins,
// the race bar and Planny follow the page.

import { drawPill, LIVES, livesText } from "./pills.js";

const FALLBACK_COLORS = Object.freeze({ board: "#ffffff", line: "#e4ddd1", you: "#206cc3", ink: "#1d1a17" });

// The page's tokens, read again at each round and each resize, so the board
// follows a theme or highlight change made while the game sat paused. A stub
// canvas in Node has no computed style, so every color falls back.
export function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return {
    board: pick("--panel", FALLBACK_COLORS.board),
    line: pick("--rule", FALLBACK_COLORS.line),
    you: pick("--accent", FALLBACK_COLORS.you),
    ink: pick("--ink", FALLBACK_COLORS.ink),
  };
}

export const GOLD = "#f5b301";
export const DANGER = "#e2553f";
const SHADE = "rgba(0, 0, 0, 0.55)";
const BANNER_SHADE = "rgba(0, 0, 0, 0.32)";
const TAU = Math.PI * 2;

// Each lane's look: its two tones (alternating cells), the same in either
// theme. An icy road is its own look.
export const LANES = Object.freeze({
  start: Object.freeze({ a: "#d9d1c3", b: "#cdc4b4" }),
  grass: Object.freeze({ a: "#8ccf5f", b: "#81c556" }),
  goal: Object.freeze({ a: "#f0d27a", b: "#e8c86c" }),
  road: Object.freeze({ a: "#4c505c", b: "#484c57" }),
  ice: Object.freeze({ a: "#bcd9ea", b: "#b2d1e4" }),
  river: Object.freeze({ a: "#3b87c9", b: "#3782c3" }),
  rail: Object.freeze({ a: "#8e8273", b: "#887c6d" }),
});

export const lookOf = (lane) => (lane.icy ? "ice" : lane.kind);

// The dot each zone lights on the start and end screens.
const ZONE_DOTS = Object.freeze(["#8ccf5f", "#3b87c9", "#e2553f", "#2fa36b", GOLD, "#a466ff", "#1fb6d9", "#bcd9ea", "#ff4fa3"]);
export const zoneColor = (level) => ZONE_DOTS[Math.min(9, Math.max(1, Math.floor(level) || 1)) - 1];

// The ink for what is drawn straight on a lane (Planny's arms and feet, a
// rival's feet): whichever of a dark and a light ink stands out more from
// both of that lane's tones. The lanes keep their colors in either theme, so
// the page's ink would vanish on some (dark on the road, light on the grass).
export const DARK_INK = "#1d1a17";
export const LIGHT_INK = "#f0ece5";

// The relative luminance of "#rrggbb", and the contrast of two of them.
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => {
    const c = parseInt(hex.slice(k, k + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const LIMBS = Object.freeze(
  Object.fromEntries(
    Object.entries(LANES).map(([k, t]) => {
      const worst = (ink) => Math.min(contrast(ink, t.a), contrast(ink, t.b));
      return [k, worst(DARK_INK) >= worst(LIGHT_INK) ? DARK_INK : LIGHT_INK];
    }),
  ),
);
export const limbInk = (look) => LIMBS[look] || DARK_INK;

const CAR_TINTS = Object.freeze(["#e8483c", "#f2b134", "#3fa7e0", "#f4f1ea", "#7a5cd6", "#2fbf71"]);
const TRUCK_TINTS = Object.freeze(["#d9483b", "#2f6fb8", "#3b8a4f", "#e08a1f"]);
const LOG_TINTS = Object.freeze(["#9a6a3c", "#8a5e34", "#a87644"]);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const ellipse = (ctx, x, y, rx, ry) => {
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  else ctx.arc(x, y, Math.max(rx, ry), 0, TAU);
};

// Text with a dark edge, so it reads on any lane in either theme. `max`,
// when given, squeezes a long line to fit that many units.
export function label(ctx, text, x, y, size, color, align = "center", max = undefined) {
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(0.3, size / 6);
  ctx.lineJoin = "round";
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

// Where a centered label of `text` at `size` goes so it stays inside a
// field `w` by `h`: at (x, y) when it fits, else moved in from the edge. A
// line too long for the field is squeezed to it (`max`).
export function labelSpot(text, x, y, size, w, h) {
  const width = Math.min(w - 1, String(text).length * size * 0.62);
  return { x: Math.min(w - width / 2 - 0.5, Math.max(width / 2 + 0.5, x)), y: Math.min(h - size / 2 - 0.4, Math.max(size / 2 + 0.4, y)), max: width };
}

function star(ctx, x, y, outer, inner, spin = 0) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = spin - Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// A small whole-number hash, for the grass's tufts and the gravel, so each
// cell keeps its look from frame to frame.
const hash = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) % 997;
};

/* ------------------------------------------------------------- geometry */

// The top of row `row` on the field, with the view's bottom row at `cam`.
const rowTop = (v, row) => v.g.FIELD_H - (row - v.cam + 1) * v.g.CELL;
// The center of column `x` (whole or not) on the field.
const colX = (v, x) => (x + 0.5) * v.g.CELL;

/* ------------------------------------------------------------ the lanes */

function drawLane(ctx, v, lane, y) {
  const { g, clock } = v;
  const C = g.CELL;
  const look = LANES[lookOf(lane)];
  ctx.fillStyle = look.a;
  ctx.fillRect(0, y, g.FIELD_W, C + 0.02);
  if (lane.kind === "start") {
    ctx.fillStyle = look.b;
    for (let c = 0; c < g.COLS; c += 2) ctx.fillRect(c * C, y, C, C);
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fillRect(0, y, g.FIELD_W, 0.4);
  } else if (lane.kind === "grass") {
    ctx.fillStyle = look.b;
    for (let c = lane.row % 2; c < g.COLS; c += 2) ctx.fillRect(c * C, y, C, C);
    // Tufts and the odd flower, the same each frame.
    for (let c = 0; c < g.COLS; c++) {
      const n = hash(lane.row, c);
      const tx = c * C + 1 + (n % 4);
      const ty = y + 1.4 + ((n >> 2) % 3);
      ctx.strokeStyle = "rgba(40, 110, 40, 0.55)";
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(tx, ty + 0.9);
      ctx.lineTo(tx - 0.4, ty);
      ctx.moveTo(tx, ty + 0.9);
      ctx.lineTo(tx + 0.4, ty);
      ctx.stroke();
      if (n % 5 === 0) {
        ctx.fillStyle = n % 2 ? "#fff3c4" : "#ff9ec4";
        ctx.beginPath();
        ctx.arc(c * C + 3.6, y + 4.2, 0.45, 0, TAU);
        ctx.fill();
      }
    }
    if (v.round.dark) {
      // The market's lantern strings.
      ctx.strokeStyle = "rgba(60, 40, 30, 0.6)";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      for (let c = 0; c <= g.COLS; c += 3) {
        ctx.moveTo(c * C, y + 0.6);
        ctx.quadraticCurveTo(c * C + C * 1.5, y + 2, c * C + C * 3, y + 0.6);
      }
      ctx.stroke();
    }
  } else if (lane.kind === "goal") {
    ctx.fillStyle = look.b;
    for (let c = 1; c < g.COLS; c += 2) ctx.fillRect(c * C, y + 1.4, C, C - 1.4);
    // A checkered finish line along its bottom edge.
    const s = 1.1;
    for (let k = 0; k * s < g.FIELD_W; k++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (k + j) % 2 ? "#1d1a17" : "#ffffff";
        ctx.fillRect(k * s, y + C - s * (2 - j), s, s);
      }
    }
  } else if (lane.kind === "road") {
    if (lane.icy) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      for (let c = 0; c < g.COLS; c++) {
        const n = hash(lane.row, c);
        const sx = c * C + (n % 5);
        const sy = y + 1 + ((n >> 3) % 4);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + 1.6, sy - 0.5);
      }
      ctx.stroke();
    }
    const above = v.round.lanes[lane.row + 1];
    if (above && above.kind === "road") {
      // A dashed line between two roads.
      ctx.fillStyle = "rgba(240, 236, 229, 0.55)";
      for (let x = 0.8; x < g.FIELD_W; x += 4) ctx.fillRect(x, y - 0.15, 2, 0.3);
    }
    if (lane.surge) {
      // Chevrons the lane's way, bright while it is fast.
      ctx.strokeStyle = lane.fast ? "rgba(245, 179, 1, 0.6)" : "rgba(245, 179, 1, 0.22)";
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let x = 4; x < g.FIELD_W; x += 11) {
        ctx.moveTo(x - lane.dir * 0.8, y + C * 0.3);
        ctx.lineTo(x + lane.dir * 0.8, y + C * 0.5);
        ctx.lineTo(x - lane.dir * 0.8, y + C * 0.7);
      }
      ctx.stroke();
    }
  } else if (lane.kind === "river") {
    // Ripples drifting with the water.
    const off = ((((lane.shift * C) % 9) + 9) % 9);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    for (let x = -9 + off; x < g.FIELD_W + 9; x += 9) {
      for (const [dx, dy] of [
        [0, 1.6],
        [4.5, 4.2],
      ]) {
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(x + dx + 0.8, y + dy - 0.5, x + dx + 1.6, y + dy);
      }
    }
    ctx.stroke();
    if (lane.flip) {
      // Rapids: arrows the way the water runs, blinking before it turns.
      const soon = lane.flipIn < 1000 && Math.floor(clock / 120) % 2 === 0;
      ctx.strokeStyle = soon ? "rgba(255, 255, 255, 0.9)" : "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      for (const x of [1.4, g.FIELD_W - 1.4]) {
        ctx.moveTo(x - lane.dir * 0.7, y + C * 0.32);
        ctx.lineTo(x + lane.dir * 0.7, y + C * 0.5);
        ctx.lineTo(x - lane.dir * 0.7, y + C * 0.68);
      }
      ctx.stroke();
    }
  } else if (lane.kind === "rail") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let c = 0; c < g.COLS * 3; c++) {
      const n = hash(lane.row, c);
      ctx.fillRect(c * 2 + (n % 2) * 0.5, y + 0.6 + (n % 5), 0.5, 0.5);
    }
    ctx.fillStyle = "#5a4636";
    for (let x = 0.6; x < g.FIELD_W; x += 2.4) ctx.fillRect(x, y + 1.2, 1, C - 2.4);
    ctx.fillStyle = "#c7cbd1";
    ctx.fillRect(0, y + 1.9, g.FIELD_W, 0.45);
    ctx.fillRect(0, y + C - 2.35, g.FIELD_W, 0.45);
    if (lane.phase === "warn") {
      const on = Math.floor(clock / 160) % 2 === 0;
      ctx.fillStyle = on ? "rgba(226, 85, 63, 0.38)" : "rgba(226, 85, 63, 0.16)";
      ctx.fillRect(0, y, g.FIELD_W, C);
    }
    // The signal at the end the train comes from, lit while it is coming.
    const sx = lane.dir > 0 ? 1.2 : g.FIELD_W - 1.2;
    ctx.fillStyle = "#2b2622";
    ctx.fillRect(sx - 0.25, y + 0.6, 0.5, C - 1.2);
    const lit = lane.phase === "warn" ? Math.floor(clock / 160) % 2 === 0 : lane.phase === "pass";
    ctx.fillStyle = lit ? "#ff3b1f" : "#6b2a20";
    ctx.beginPath();
    ctx.arc(sx, y + 1.3, 0.75, 0, TAU);
    ctx.fill();
  }
  // Bushes and rocks.
  for (let c = 0; c < g.COLS; c++) {
    const t = lane.trees[c];
    if (!t) continue;
    const cx = c * C + C / 2;
    const cy = y + C / 2;
    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ellipse(ctx, cx + 0.4, cy + 1.6, 2.4, 0.9);
    ctx.fill();
    if (t === 1) {
      ctx.fillStyle = "#3e8a3a";
      for (const [dx, dy, r] of [
        [-1.1, 0.3, 1.5],
        [1.1, 0.3, 1.5],
        [0, -0.8, 1.7],
      ]) {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, r, 0, TAU);
        ctx.fill();
      }
      ctx.fillStyle = "#5fae4f";
      ctx.beginPath();
      ctx.arc(cx - 0.5, cy - 1.2, 0.8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "#e2553f";
      ctx.beginPath();
      ctx.arc(cx + 0.9, cy, 0.35, 0, TAU);
      ctx.arc(cx - 1.1, cy + 0.6, 0.35, 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = "#8d9096";
      roundRect(ctx, cx - 2, cy - 1.3, 4, 2.8, 1.1);
      ctx.fill();
      ctx.fillStyle = "#b3b6bb";
      roundRect(ctx, cx - 1.4, cy - 1.1, 2, 1, 0.5);
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------- what moves on */

// A car, a van or a truck, seen from above, nose the way its lane runs.
function drawVehicle(ctx, v, lane, it, x0, y, dir) {
  const C = v.g.CELL;
  const w = it.len * C;
  const x = x0;
  const top = y + 1;
  const h = C - 2;
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  roundRect(ctx, x + 0.5, top + 0.6, w - 0.6, h, 1);
  ctx.fill();
  const front = dir > 0 ? x + w : x;
  // Wheels.
  ctx.fillStyle = "#1d1a17";
  for (const fx of [0.18, 0.82]) {
    ctx.fillRect(x + w * fx - 0.7, top - 0.3, 1.4, 0.6);
    ctx.fillRect(x + w * fx - 0.7, top + h - 0.3, 1.4, 0.6);
  }
  if (it.kind === "truck") {
    const cab = 1.4 * C * 0.6;
    const cabX = dir > 0 ? x + w - cab : x;
    const boxX = dir > 0 ? x + 0.2 : x + cab + 0.3;
    ctx.fillStyle = "#e4ded2";
    roundRect(ctx, boxX, top, w - cab - 0.5, h, 0.5);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    for (let sx = boxX + 1.5; sx < boxX + w - cab - 1; sx += 2.2) ctx.fillRect(sx, top + 0.3, 0.3, h - 0.6);
    ctx.fillStyle = TRUCK_TINTS[it.tint % TRUCK_TINTS.length];
    roundRect(ctx, cabX, top, cab, h, 1);
    ctx.fill();
    ctx.fillStyle = "#bfe6ff";
    ctx.fillRect(dir > 0 ? cabX + cab - 1.6 : cabX + 0.6, top + 0.5, 1, h - 1);
  } else {
    ctx.fillStyle = CAR_TINTS[it.tint % CAR_TINTS.length];
    roundRect(ctx, x + 0.2, top, w - 0.4, h, 1.1);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 0.2;
    ctx.stroke();
    // Windshield at the nose, the roof, a back window.
    ctx.fillStyle = "#bfe6ff";
    const ws = dir > 0 ? x + w - 2.4 : x + 1.4;
    ctx.fillRect(ws, top + 0.6, 1, h - 1.2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.fillRect(x + w * 0.3, top + 0.8, w * 0.35, h - 1.6);
    if (it.kind === "van") {
      ctx.fillStyle = "#bfe6ff";
      ctx.fillRect(dir > 0 ? x + 1 : x + w - 1.8, top + 0.8, 0.8, h - 1.6);
    }
  }
  // Headlights and taillights.
  ctx.fillStyle = "#fff3a6";
  ctx.fillRect(front - (dir > 0 ? 0.5 : 0), top + 0.3, 0.5, 0.8);
  ctx.fillRect(front - (dir > 0 ? 0.5 : 0), top + h - 1.1, 0.5, 0.8);
  ctx.fillStyle = "#c2261b";
  const back = dir > 0 ? x + 0.2 : x + w - 0.6;
  ctx.fillRect(back, top + 0.4, 0.4, 0.6);
  ctx.fillRect(back, top + h - 1, 0.4, 0.6);
}

function drawLog(ctx, v, it, x, y) {
  const C = v.g.CELL;
  const w = it.len * C;
  ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
  roundRect(ctx, x + 0.4, y + 1.6, w, C - 2.4, 1.4);
  ctx.fill();
  ctx.fillStyle = LOG_TINTS[it.tint % LOG_TINTS.length];
  roundRect(ctx, x, y + 1, w, C - 2.2, 1.4);
  ctx.fill();
  ctx.strokeStyle = "rgba(60, 35, 15, 0.45)";
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  for (let k = 1.5; k < w - 1; k += 3.1) {
    ctx.moveTo(x + k, y + 2);
    ctx.lineTo(x + k + 1.6, y + 2);
    ctx.moveTo(x + k + 0.8, y + C - 2.2);
    ctx.lineTo(x + k + 2.2, y + C - 2.2);
  }
  ctx.stroke();
  // The cut ends, with their rings.
  for (const ex of [x + 0.9, x + w - 0.9]) {
    ctx.fillStyle = "#d9b07a";
    ellipse(ctx, ex, y + C / 2 - 0.1, 0.8, (C - 2.4) / 2);
    ctx.fill();
    ctx.strokeStyle = "#9a6a3c";
    ctx.lineWidth = 0.15;
    ellipse(ctx, ex, y + C / 2 - 0.1, 0.4, (C - 2.4) / 4);
    ctx.stroke();
  }
}

// A group of turtles, one a cell: shells up, sinking (blinking, paler) or
// under (only the ripples show).
function drawTurtles(ctx, v, lane, it, x, y, dir) {
  const C = v.g.CELL;
  const st = v.turtleState(it, v.round.clock);
  for (let k = 0; k < it.len; k++) {
    const cx = x + (k + 0.5) * C;
    const cy = y + C / 2;
    if (st === 2) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 0.3;
      ellipse(ctx, cx, cy, 2.2, 1.2);
      ctx.stroke();
      continue;
    }
    const was = ctx.globalAlpha;
    if (st === 1) ctx.globalAlpha = was * (Math.floor(v.clock / 110) % 2 ? 0.45 : 0.75);
    ctx.fillStyle = "#2f7a52";
    ctx.beginPath();
    ctx.arc(cx + dir * 2.2, cy, 0.8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#3e9a6a";
    ellipse(ctx, cx, cy, 2.3, 1.9);
    ctx.fill();
    ctx.strokeStyle = "#a6d98a";
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(cx - 1.2, cy);
    ctx.lineTo(cx + 1.2, cy);
    ctx.moveTo(cx, cy - 1.4);
    ctx.lineTo(cx, cy + 1.4);
    ctx.stroke();
    if (it.dive) {
      // A diver wears a little red mark, so it can be told apart.
      ctx.fillStyle = "#e2553f";
      ctx.beginPath();
      ctx.arc(cx, cy, 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = was;
  }
}

function drawTrain(ctx, v, lane, y) {
  const C = v.g.CELL;
  const [a, b] = v.trainSpan(lane, v.passMs - lane.phaseMs);
  const x0 = (a + 0.5) * C;
  const x1 = (b + 0.5) * C;
  const nose = lane.dir > 0 ? x1 : x0;
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.fillRect(x0 + 0.5, y + 1.4, x1 - x0, C - 1.8);
  ctx.fillStyle = "#3a5f8f";
  ctx.fillRect(x0, y + 0.6, x1 - x0, C - 1.2);
  ctx.fillStyle = "#bfe6ff";
  for (let x = x0 + 1.2; x < x1 - 1; x += 3.2) ctx.fillRect(x, y + 1.6, 1.6, 1.2);
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  for (let x = x0 + 7.4; x < x1; x += 8) ctx.fillRect(x, y + 0.6, 0.35, C - 1.2);
  // The engine.
  const ew = 6;
  ctx.fillStyle = "#d9483b";
  ctx.fillRect(lane.dir > 0 ? nose - ew : nose, y + 0.6, ew, C - 1.2);
  ctx.fillStyle = GOLD;
  ctx.fillRect(lane.dir > 0 ? nose - ew : nose, y + C - 1.6, ew, 0.5);
  ctx.fillStyle = "#fff3a6";
  ctx.fillRect(lane.dir > 0 ? nose - 0.6 : nose, y + C / 2 - 0.5, 0.6, 1);
}

function drawMovers(ctx, v, lane, y) {
  const C = v.g.CELL;
  if (lane.kind === "rail") {
    if (lane.phase === "pass") drawTrain(ctx, v, lane, y);
    return;
  }
  if (lane.kind !== "road" && lane.kind !== "river") return;
  for (const it of lane.items) {
    const a = v.itemX(lane, it, lane.shift);
    if (a > v.g.COLS || a + it.len < -1) continue;
    const x = (a + 0.5) * C;
    if (lane.kind === "road") drawVehicle(ctx, v, lane, it, x, y, lane.dir);
    else if (it.kind === "turtle") drawTurtles(ctx, v, lane, it, x, y, lane.dir);
    else drawLog(ctx, v, it, x, y);
  }
}

/* -------------------------------------------------------------- pickups */

// A pickup's picture, white, centered on x, y and about 2s across.
function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.22;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "spring") {
    ctx.moveTo(x - s * 0.6, y + s * 0.7);
    for (let k = 0; k < 4; k++) ctx.lineTo(x + (k % 2 ? -0.6 : 0.6) * s, y + s * 0.7 - (k + 1) * s * 0.35);
    ctx.stroke();
  } else if (kind === "shield") {
    ctx.moveTo(x, y - s * 0.8);
    ctx.lineTo(x + s * 0.7, y - s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.4, x, y + s * 0.85);
    ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.4, x - s * 0.7, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "coin") {
    star(ctx, x, y, s * 0.75, s * 0.32);
    ctx.fill();
  } else if (kind === "horn") {
    ctx.moveTo(x - s * 0.7, y - s * 0.25);
    ctx.lineTo(x - s * 0.1, y - s * 0.25);
    ctx.lineTo(x + s * 0.7, y - s * 0.7);
    ctx.lineTo(x + s * 0.7, y + s * 0.7);
    ctx.lineTo(x - s * 0.1, y + s * 0.25);
    ctx.lineTo(x - s * 0.7, y + s * 0.25);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPickups(ctx, v) {
  for (const p of v.round.pickups) {
    const y = rowTop(v, p.row);
    if (y > v.g.FIELD_H || y < -v.g.CELL) continue;
    const color = v.powers[p.kind].color;
    const cx = colX(v, p.x);
    const cy = y + v.g.CELL / 2 + Math.sin(v.clock / 260 + p.x) * 0.3;
    const s = 1.9 * (1 + 0.06 * Math.sin(v.clock / 140 + p.row));
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ellipse(ctx, cx, y + v.g.CELL - 1.2, s * 0.9, s * 0.35);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, cx - s, cy - s, s * 2, s * 2, s * 0.45);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 0.3;
    ctx.stroke();
    glyph(ctx, p.kind, cx, cy, s * 0.6);
  }
}

/* -------------------------------------------------------------- hoppers */

// Where a hopper is drawn: its row and column (between two mid-hop or flying
// back), how high off the ground, how far round it has spun, and its stretch.
const POSE = { row: 0, x: 0, lift: 0, spin: 0, stretch: 1, flying: false };

function poseOf(h, C) {
  POSE.spin = 0;
  POSE.stretch = 1;
  POSE.flying = false;
  POSE.lift = 0;
  if (h.back) {
    const t = Math.min(1, h.back.ms / h.back.max);
    const e = 1 - (1 - t) * (1 - t);
    POSE.row = h.back.fromRow + (h.back.toRow - h.back.fromRow) * e;
    POSE.x = h.back.fromX + (h.back.toX - h.back.fromX) * e;
    POSE.lift = Math.sin(Math.PI * t) * C * 1.1;
    POSE.spin = t * TAU * 1.5;
    POSE.flying = true;
  } else if (h.hop) {
    const p = h.hop;
    const t = Math.min(1, p.ms / p.max);
    POSE.row = p.fromRow + (p.toRow - p.fromRow) * t;
    POSE.x = p.fromX + (p.toX - p.fromX) * t;
    if (p.kind === "hop" || p.kind === "spring") {
      POSE.lift = Math.sin(Math.PI * t) * C * (p.kind === "spring" ? 0.8 : 0.4);
      POSE.stretch = 1 + Math.sin(Math.PI * t) * 0.18;
    }
  } else {
    POSE.row = h.row;
    POSE.x = h.x;
  }
  return POSE;
}

// Two stick feet under a body, with little toes the way it faces.
function feet(ctx, x, y, face, color, w, splay = 0) {
  const toe = face === "left" ? -0.5 : face === "right" ? 0.5 : 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const fx = x + side * (0.7 + splay);
    ctx.moveTo(fx, y - 0.9);
    ctx.lineTo(fx, y);
    ctx.lineTo(fx + side * 0.25 + toe, y + 0.05);
  }
  ctx.stroke();
}

// Planny: a box with a star for an eye and a smile, stick arms and two stick
// feet. Mid-hop his arms go up and he stretches; cheering, both arms up;
// flying back he spins with an "o" of a mouth; beaten, he slumps, arms
// hanging and a frown. His star eye is there in every one of them.
function drawPlanny(ctx, v, h, x, y, pose, look) {
  const { colors, clock } = v;
  const s = 1.55;
  const limb = limbInk(look);
  const lost = v.lost && !h.finished;
  const cheer = v.cheer && h.finished;
  ctx.save();
  ctx.translate(x, y);
  if (pose.spin && typeof ctx.rotate === "function") ctx.rotate(pose.spin);
  else if (lost && typeof ctx.rotate === "function") ctx.rotate(-0.12);
  ctx.scale(1 / Math.sqrt(pose.stretch), pose.stretch);
  const by = -2.4;
  feet(ctx, 0, 0, h.face, limb, 0.38, lost ? 0.25 : 0);
  ctx.strokeStyle = limb;
  ctx.lineWidth = 0.34;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (cheer || (h.hop && h.hop.kind !== "push" && h.hop.kind !== "slide")) {
    const wave = cheer ? Math.sin(clock / 90) * 0.4 : 0;
    ctx.moveTo(-s, by - 0.2);
    ctx.lineTo(-s - 1, by - 2.1 + wave);
    ctx.moveTo(s, by - 0.2);
    ctx.lineTo(s + 1, by - 2.1 - wave);
  } else if (lost) {
    ctx.moveTo(-s, by + 0.4);
    ctx.lineTo(-s - 0.4, by + 2.2);
    ctx.moveTo(s, by + 0.4);
    ctx.lineTo(s + 0.4, by + 2.2);
  } else {
    ctx.moveTo(-s, by + 0.2);
    ctx.lineTo(-s - 0.8, by + 1.6);
    ctx.moveTo(s, by + 0.2);
    ctx.lineTo(s + 0.8, by + 1.6);
  }
  ctx.stroke();
  roundRect(ctx, -s, by - s, s * 2, s * 2, s * 0.35);
  ctx.fillStyle = colors.board;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.3;
  ctx.stroke();
  const fx = h.face === "left" ? -0.2 : h.face === "right" ? 0.2 : 0;
  star(ctx, fx, by - s * 0.25, s * 0.55, s * 0.24, pose.flying ? clock / 60 : 0);
  const was = ctx.globalAlpha;
  if (lost) ctx.globalAlpha = was * 0.75;
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.globalAlpha = was;
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.24;
  ctx.beginPath();
  if (pose.flying) ctx.arc(0, by + s * 0.5, s * 0.18, 0, TAU);
  else if (lost) ctx.arc(0, by + s * 0.75, s * 0.3, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(0, by + s * 0.3, s * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// A rival: a round critter in its color, eyes the way it faces, stick feet,
// and its kind's ears or gear: a Hopper's long ears, a Daredevil's goggles, a
// Bruiser's small round ears and brow, a Tagalong's tuft and beak. Its body
// is edged in the lane's limb ink: some rival colors sit close to the water,
// a log or the tracks (the Tagalong's brown on a log), and the edge keeps
// them apart.
function drawCritter(ctx, v, h, x, y, pose, look) {
  const color = v.colorOf(h.id);
  const r = h.kind === "bruiser" ? 2.05 : 1.8;
  const limb = limbInk(look);
  ctx.save();
  ctx.translate(x, y);
  if (pose.spin && typeof ctx.rotate === "function") ctx.rotate(pose.spin);
  ctx.scale(1 / Math.sqrt(pose.stretch), pose.stretch);
  const by = -2.3;
  feet(ctx, 0, 0, h.face, limb, 0.36);
  if (h.kind === "hopper") {
    ctx.fillStyle = color;
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 0.8, by - r - 0.9, 0.55, 1.5);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd1e3";
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 0.8, by - r - 0.8, 0.25, 1);
      ctx.fill();
    }
  } else if (h.kind === "daredevil") {
    ctx.fillStyle = color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(side * 0.5, by - r + 0.4);
      ctx.lineTo(side * 1.5, by - r - 1.1);
      ctx.lineTo(side * 1.7, by - r + 0.8);
      ctx.closePath();
      ctx.fill();
    }
  } else if (h.kind === "bruiser") {
    ctx.fillStyle = color;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(side * 1.4, by - r + 0.3, 0.75, 0, TAU);
      ctx.fill();
    }
  } else if (h.kind === "tagalong") {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(0, by - r + 0.2);
    ctx.quadraticCurveTo(0.6, by - r - 1.2, 1.1, by - r - 0.6);
    ctx.moveTo(0, by - r + 0.2);
    ctx.quadraticCurveTo(-0.5, by - r - 1, -0.9, by - r - 0.7);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, by, r, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = limb;
  ctx.lineWidth = 0.32;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.beginPath();
  ctx.arc(0, by + r * 0.35, r * 0.55, 0, TAU);
  ctx.fill();
  const lx = h.face === "left" ? -0.35 : h.face === "right" ? 0.35 : 0;
  const ly = h.face === "down" ? 0.25 : h.face === "up" ? -0.2 : 0;
  if (h.kind === "daredevil") {
    ctx.fillStyle = "#1d1a17";
    ctx.fillRect(-r, by - 0.9, r * 2, 0.5);
  }
  for (const side of [-1, 1]) {
    const ex = side * r * 0.4 + lx;
    const ey = by - r * 0.15 + ly;
    if (h.kind === "daredevil") {
      ctx.fillStyle = "#cfefff";
      ctx.beginPath();
      ctx.arc(ex, ey, 0.75, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#1d1a17";
      ctx.lineWidth = 0.25;
      ctx.stroke();
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ex, ey, 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "#1d1a17";
    ctx.beginPath();
    ctx.arc(ex + lx * 0.4, ey + ly * 0.4, pose.flying ? 0.15 : 0.28, 0, TAU);
    ctx.fill();
  }
  if (h.kind === "bruiser") {
    ctx.strokeStyle = "#1d1a17";
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(-r * 0.75, by - r * 0.6);
    ctx.lineTo(-r * 0.15, by - r * 0.35);
    ctx.moveTo(r * 0.75, by - r * 0.6);
    ctx.lineTo(r * 0.15, by - r * 0.35);
    ctx.stroke();
  } else if (h.kind === "tagalong") {
    ctx.fillStyle = "#ff9d2e";
    ctx.beginPath();
    ctx.moveTo(lx - 0.6, by + 0.35);
    ctx.lineTo(lx + 0.6, by + 0.35);
    ctx.lineTo(lx, by + 1.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawHopper(ctx, v, h) {
  const { g } = v;
  const C = g.CELL;
  const pose = poseOf(h, C);
  const top = rowTop(v, pose.row);
  if (top > g.FIELD_H + C || top < -C * 2) return;
  const x = colX(v, pose.x);
  const ground = top + C * 0.8;
  const lane = v.round.lanes[Math.max(0, Math.min(v.round.lanes.length - 1, Math.round(pose.row)))];
  const look = lookOf(lane);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ellipse(ctx, x, ground + 0.2, 2 * (1 - Math.min(0.5, pose.lift / (C * 2))), 0.75);
  ctx.fill();
  const y = ground - pose.lift;
  if (h.shield > 0) {
    // A Shield about to run out blinks.
    ctx.strokeStyle = v.powers.shield.color;
    ctx.globalAlpha = h.shield < 700 && Math.floor(v.clock / 90) % 2 === 0 ? 0.2 : 0.55 + 0.25 * Math.sin(v.clock / 120);
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(x, y - 2.4, 3, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (h.spring) {
    ctx.strokeStyle = v.powers.spring.color;
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(x - 1, y + 0.3);
    for (let k = 0; k < 4; k++) ctx.lineTo(x + (k % 2 ? -1 : 1), y + 0.3 + ((k + 1) * 0.25));
    ctx.stroke();
  }
  if (h.daze > 0) ctx.globalAlpha = 0.7;
  if (h.id === 0) drawPlanny(ctx, v, h, x, y, pose, look);
  else drawCritter(ctx, v, h, x, y, pose, look);
  ctx.globalAlpha = 1;
  // Dazed: stars round its head.
  if (h.daze > 0) {
    ctx.fillStyle = GOLD;
    for (let k = 0; k < 3; k++) {
      const a = v.clock / 120 + (k * TAU) / 3;
      star(ctx, x + Math.cos(a) * 1.8, y - 5.4 + Math.sin(a) * 0.5, 0.55, 0.22);
      ctx.fill();
    }
  }
}

// A hopper above or below the view: an arrow at that edge in its color.
function drawOffView(ctx, v, h) {
  const { g } = v;
  const pose = poseOf(h, g.CELL);
  const top = rowTop(v, pose.row);
  let y;
  let up;
  if (top + g.CELL < 0) {
    y = 1.4;
    up = true;
  } else if (top > g.FIELD_H) {
    y = g.FIELD_H - 1.4;
    up = false;
  } else return;
  const x = Math.min(g.FIELD_W - 2, Math.max(2, colX(v, pose.x)));
  ctx.fillStyle = h.id === 0 ? v.colors.you : v.colorOf(h.id);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(x, y + (up ? -0.9 : 0.9));
  ctx.lineTo(x + 1.3, y + (up ? 0.9 : -0.9));
  ctx.lineTo(x - 1.3, y + (up ? 0.9 : -0.9));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/* -------------------------------------------------------------- the night */

// The Night Market's dark, with a soft pool of light round every hopper, the
// cars' headlights, the lanterns, the pickups and a coming train's lamp. In
// a browser the lights are cut out of a dark layer the size of the field
// (NIGHT_RES pixels a unit), so their edges are smooth; with no second
// canvas to hand (the unit suite) the field goes dark in thirds of a cell,
// each as dark as its distance from the nearest light, in DARK_STEPS steps.
// The headlights' beams go on over it.
const DARK_STEPS = 12;
const NIGHT_RES = 3;
// The dark is a dusk, not a blackout: every lane and car can be read through
// it, and the lights only brighten what is near them.
const NIGHT_DIM = 0.38;
const NIGHT_INK = `rgba(8, 8, 24, ${NIGHT_DIM})`;
let DARK = new Uint8Array(0);
const LIGHTS = [];
let NIGHT = null;

// The dark layer, made once and kept while the field's size holds; null
// where no canvas can be made. It keeps one light, a radial gradient of
// radius 1 round the origin, made once and drawn scaled to each light, so a
// frame makes no gradients.
function nightLayer(w, h) {
  if (NIGHT && NIGHT.w === w && NIGHT.h === h) return NIGHT;
  let canvas = null;
  try {
    if (typeof OffscreenCanvas === "function") canvas = new OffscreenCanvas(w, h);
    else if (typeof document !== "undefined") canvas = Object.assign(document.createElement("canvas"), { width: w, height: h });
  } catch {}
  const c = canvas && canvas.getContext("2d");
  let glow = null;
  if (c) {
    glow = c.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, "rgba(0, 0, 0, 1)");
    glow.addColorStop(0.45, "rgba(0, 0, 0, 0.85)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
  }
  NIGHT = c ? { canvas, ctx: c, w, h, glow } : null;
  return NIGHT;
}

// The dark as a layer with the lights cut out, drawn over the field.
function softDark(ctx, v, layer) {
  const { g } = v;
  const c = layer.ctx;
  c.setTransform(NIGHT_RES, 0, 0, NIGHT_RES, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, g.FIELD_W, g.FIELD_H);
  c.fillStyle = NIGHT_INK;
  c.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
  c.globalCompositeOperation = "destination-out";
  c.fillStyle = layer.glow;
  for (let k = 0; k < LIGHTS.length; k += 3) {
    const r = LIGHTS[k + 2];
    c.setTransform(NIGHT_RES * r, 0, 0, NIGHT_RES * r, NIGHT_RES * LIGHTS[k], NIGHT_RES * LIGHTS[k + 1]);
    c.fillRect(-1, -1, 2, 2);
  }
  c.setTransform(NIGHT_RES, 0, 0, NIGHT_RES, 0, 0);
  c.globalCompositeOperation = "source-over";
  ctx.drawImage(layer.canvas, 0, 0, g.FIELD_W, g.FIELD_H);
}

function drawDark(ctx, v) {
  const { g, round } = v;
  const C = g.CELL;
  LIGHTS.length = 0;
  const add = (x, y, r) => LIGHTS.push(x, y, r);
  for (const h of round.hoppers) {
    const pose = poseOf(h, C);
    add(colX(v, pose.x), rowTop(v, pose.row) + C * 0.5, C * 3.2);
  }
  const row0 = Math.max(0, Math.floor(v.cam) - 1);
  const row1 = Math.min(round.lanes.length - 1, Math.ceil(v.cam + g.VIEW_ROWS) + 1);
  for (let r = row0; r <= row1; r++) {
    const lane = round.lanes[r];
    const y = rowTop(v, r) + C / 2;
    if (lane.kind === "road") {
      for (const it of lane.items) {
        const a = v.itemX(lane, it, lane.shift);
        if (a > g.COLS + 2 || a + it.len < -3) continue;
        const nose = lane.dir > 0 ? (a + it.len + 0.5) * C : (a + 0.5) * C;
        add(nose + lane.dir * C * 0.9, y, C * 1.25);
      }
    } else if (lane.kind === "grass") {
      for (let c = 1; c < g.COLS; c += 3) add(c * C + C * 0.5, y - C * 0.3, C * 0.9);
    } else if (lane.kind === "rail" && lane.phase !== "idle") add(lane.dir > 0 ? 1.2 : g.FIELD_W - 1.2, y, C * 2.2);
  }
  for (const p of round.pickups) add(colX(v, p.x), rowTop(v, p.row) + C / 2, C);
  const layer = nightLayer(Math.ceil(g.FIELD_W * NIGHT_RES), Math.ceil(g.FIELD_H * NIGHT_RES));
  if (layer) softDark(ctx, v, layer);
  else gridDark(ctx, v);
  beams(ctx, v, row0, row1);
}

// The dark in steps, for a page with no second canvas.
function gridDark(ctx, v) {
  const { g } = v;
  const cell = g.CELL / 3;
  const cols = Math.ceil(g.FIELD_W / cell);
  const rows = Math.ceil(g.FIELD_H / cell);
  if (DARK.length < cols * rows) DARK = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const px = (i + 0.5) * cell;
      const py = (j + 0.5) * cell;
      let lit = 0;
      for (let k = 0; k < LIGHTS.length; k += 3) lit = Math.max(lit, 1 - Math.hypot(px - LIGHTS[k], py - LIGHTS[k + 1]) / LIGHTS[k + 2]);
      DARK[j * cols + i] = Math.round((1 - Math.max(0, lit)) * DARK_STEPS);
    }
  }
  for (let step = 1; step <= DARK_STEPS; step++) {
    ctx.beginPath();
    let any = false;
    for (let k = 0; k < cols * rows; k++) {
      if (DARK[k] !== step) continue;
      ctx.rect((k % cols) * cell, Math.floor(k / cols) * cell, cell + 0.02, cell + 0.02);
      any = true;
    }
    if (!any) continue;
    ctx.fillStyle = `rgba(8, 8, 24, ${((step / DARK_STEPS) * NIGHT_DIM).toFixed(3)})`;
    ctx.fill();
  }
}

// The beams ahead of every car, and the lanterns lit, over the dark.
function beams(ctx, v, row0, row1) {
  const { g, round } = v;
  const C = g.CELL;
  ctx.fillStyle = "rgba(255, 240, 170, 0.2)";
  for (let r = row0; r <= row1; r++) {
    const lane = round.lanes[r];
    const y = rowTop(v, r);
    if (lane.kind === "road") {
      for (const it of lane.items) {
        const a = v.itemX(lane, it, lane.shift);
        if (a > g.COLS + 2 || a + it.len < -3) continue;
        const nose = lane.dir > 0 ? (a + it.len + 0.5) * C : (a + 0.5) * C;
        ctx.beginPath();
        ctx.moveTo(nose, y + 1.4);
        ctx.lineTo(nose + lane.dir * C * 2.4, y + 0.2);
        ctx.lineTo(nose + lane.dir * C * 2.4, y + C - 0.2);
        ctx.lineTo(nose, y + C - 1.4);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  const tints = ["#ff8a5c", "#ffd36b", "#7fe0ff"];
  for (let r = row0; r <= row1; r++) {
    if (round.lanes[r].kind !== "grass") continue;
    const y = rowTop(v, r);
    for (let c = 0; c < g.COLS * 2; c++) {
      ctx.fillStyle = tints[(c + r) % 3];
      ctx.beginPath();
      ctx.arc(c * C * 0.5 + 1.5, y + 1 + Math.abs(Math.sin((c + 0.5) * 1.57)) * 0.8, 0.35, 0, TAU);
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------------ the chrome */

const pillWidth = (h, text) => h * 0.7 + text.length * h * 0.42;

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${h * 0.62}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = pillWidth(h, text);
  drawPill(ctx, x, y, w, h, text, color, fill, y + h * 0.54);
  return w;
}

// Where the pills go, `h` units tall on a board `W` wide: the zone, lives,
// your daze and Shield (each filling down as it runs out), the pickup space
// uses next and how many wait behind it, and the clean streak along the top, your place on the right. A pill that would run
// into your place or off the board starts a row below. Given the strip's
// height `stripH`, the rows sit in its middle.
// The strip holds one row: a row that would leave it shrinks every pill a
// step at a time until it fits. Only past HUD_SHRINK_MIN (the smallest boards
// with everything showing) does a row spill below the strip, over the top of
// the field, where drawScene paints the pills last. Each pill carries its
// height `h`.
export function hudLayout(h, W, lives, hud, stripH = 0) {
  let k = 1;
  let laid = layPills(h, W, lives, hud, stripH);
  while (laid.over && k > HUD_SHRINK_MIN) {
    k = Math.max(HUD_SHRINK_MIN, k * HUD_SHRINK);
    laid = layPills(h * k, W, lives, hud, stripH);
  }
  return laid.out;
}
const HUD_SHRINK = 0.92;
const HUD_SHRINK_MIN = 0.6;

function layPills(h, W, lives, hud, stripH = 0) {
  const gap = h * 0.3;
  const edge = h * 0.4;
  const y0 = h * 0.35;
  const out = [];
  const placeText = `${hud.place}`;
  const pw = pillWidth(h, placeText);
  const place = { x: W - pw - edge, y: y0, w: pw, text: placeText, color: hud.first ? GOLD : "#ffffff", fill: 1 };
  let x = edge;
  let y = y0;
  const put = (text, color, fill = 1) => {
    const w = pillWidth(h, text);
    const limit = y === y0 ? place.x - gap : W - edge;
    if (x > edge && x + w > limit) {
      x = edge;
      y += h + gap;
    }
    out.push({ x, y, w, text, color, fill });
    x += w + gap;
  };
  put(hud.zone, "#ffffff");
  put(livesText(lives), LIVES);
  for (const e of hud.effects) put(e.text, e.color, e.fill);
  if (hud.streak > 1) put(`CLEAN x${hud.streak}`, GOLD);
  out.push(place);
  const drop = stripH ? Math.max(0, (stripH - (y + h) - y0) / 2) : 0;
  for (const p of out) p.y += drop;
  for (const p of out) p.h = h;
  return { out, over: stripH ? y + h > stripH : false };
}

function drawHud(ctx, v) {
  const { g, colors } = v;
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, g.W, g.HUD_H);
  ctx.fillStyle = colors.line;
  ctx.fillRect(0, g.HUD_H - 0.25, g.W, 0.25);
}

// The pills, painted after the field so a row spilled below the strip (the
// smallest boards only) sits over the field rather than under it.
function drawPills(ctx, v) {
  const { g } = v;
  if (v.state !== "running" && v.state !== "paused") return;
  for (const p of hudLayout(v.pillH, g.W, v.round.infinite ? Infinity : v.round.lives, v.hud, g.HUD_H)) pill(ctx, p.x, p.y, p.h, p.text, p.color, p.fill);
}

// The race bar beside the field, in the page's colors: the zone from the
// pavement up to the flag, the part on the board shaded, a dot for each
// rival at its height and you, a little box with your star, in front.
function drawBar(ctx, v) {
  const { g, round, colors } = v;
  const x = g.FIELD_W + g.GAP;
  const top = 3;
  const bottom = g.FIELD_H - 2;
  const cx = x + g.BAR_W / 2;
  const at = (row) => bottom - (row / Math.max(1, round.rows - 1)) * (bottom - top);
  ctx.fillStyle = colors.line;
  roundRect(ctx, cx - 0.9, top, 1.8, bottom - top, 0.9);
  ctx.fill();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = colors.ink;
  const lo = at(v.cam);
  const hi = at(Math.min(round.rows - 1, v.cam + g.VIEW_ROWS - 1));
  roundRect(ctx, cx - 1.6, hi, 3.2, lo - hi, 1);
  ctx.fill();
  ctx.globalAlpha = 1;
  // The grass rows, as ticks.
  ctx.fillStyle = colors.ink;
  ctx.globalAlpha = 0.35;
  for (const lane of round.lanes) if (lane.kind === "grass") ctx.fillRect(cx - 0.9, at(lane.row) - 0.1, 1.8, 0.2);
  ctx.globalAlpha = 1;
  // The flag at the top.
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.25;
  ctx.beginPath();
  ctx.moveTo(cx, top - 0.2);
  ctx.lineTo(cx, top - 2.8);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(cx, top - 2.8);
  ctx.lineTo(cx + 2, top - 2.2);
  ctx.lineTo(cx, top - 1.6);
  ctx.closePath();
  ctx.fill();
  for (let i = round.hoppers.length - 1; i >= 0; i--) {
    const h = round.hoppers[i];
    const pose = poseOf(h, g.CELL);
    const y = at(Math.max(0, Math.min(round.rows - 1, pose.row)));
    if (h.id === 0) {
      roundRect(ctx, cx - 1.5, y - 1.5, 3, 3, 0.6);
      ctx.fillStyle = colors.board;
      ctx.fill();
      ctx.strokeStyle = colors.ink;
      ctx.lineWidth = 0.25;
      ctx.stroke();
      star(ctx, cx, y, 1.1, 0.48);
      ctx.fillStyle = colors.you;
      ctx.fill();
    } else {
      ctx.fillStyle = v.colorOf(h.id);
      ctx.beginPath();
      ctx.arc(cx + (i % 2 ? -1.6 : 1.6), y, 1.05, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
      ctx.lineWidth = 0.22;
      ctx.stroke();
    }
  }
}

// A banner is a light strip across the field, on the half away from you,
// fading almost clear while you hop under it.
function drawBanner(ctx, v, b) {
  const w = v.g.FIELD_W;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = b.row;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - 7, w, 14);
  if (b.tag) label(ctx, b.tag, w / 2, y - 4.6, 2.1, GOLD, "center", w - 4);
  label(ctx, b.title, w / 2, y - 0.4, 4.6 * pop, b.color, "center", w - 4);
  if (b.sub) label(ctx, b.sub, w / 2, y + 4.2, 2.3, "#ffffff", "center", w - 4);
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip along the bottom of the field: a line or
// two, then one dot per zone, lit for those reached, and past the ninth how
// many Rush Hours more. The over screen adds the round's score, big, above it.
function drawTally(ctx, v, lines) {
  const { g } = v;
  const top = g.FIELD_H - 17;
  if (v.big) {
    ctx.fillStyle = BANNER_SHADE;
    ctx.fillRect(0, top - 12, g.FIELD_W, 11.6);
    label(ctx, "SCORE", g.FIELD_W / 2, top - 10.2, 2, "#ffffff");
    label(ctx, v.big, g.FIELD_W / 2, top - 5, 7, GOLD);
  }
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, g.FIELD_W, 17);
  lines.forEach((text, i) => label(ctx, text, g.FIELD_W / 2, top + 3.4 + i * 4.2, i ? 2.1 : 2.6, i ? "#ffffff" : GOLD, "center", g.FIELD_W - 4));
  const r = 1.2;
  const step = r * 3.2;
  const x = g.FIELD_W / 2 - ((v.maxZone - 1) * step) / 2;
  const y = top + 13.2;
  for (let i = 0; i < v.maxZone; i++) {
    ctx.beginPath();
    ctx.arc(x + i * step, y, r, 0, TAU);
    if (i < v.furthest) {
      ctx.fillStyle = zoneColor(i + 1);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 0.25;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  }
  if (v.furthest > v.maxZone) label(ctx, `+${v.furthest - v.maxZone}`, x + v.maxZone * step + 0.6, y, 2.1, GOLD, "left");
}

/* --------------------------------------------------------------- scene */

// The whole frame. `v` is the view hop.js refills: the round, the board's
// geometry `g`, the scale `u`, the view's height `cam`, the colors, the
// effects, the state, the pill numbers and the lines for the start and end
// screens.
export function drawScene(ctx, v) {
  const { g, round } = v;
  const C = g.CELL;
  ctx.save();
  ctx.scale(v.u, v.u);
  ctx.fillStyle = v.colors.board;
  ctx.fillRect(0, 0, g.W, g.H);
  drawHud(ctx, v);
  ctx.translate(g.PAD, g.HUD_H);
  drawBar(ctx, v);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, g.FIELD_W, g.FIELD_H);
  if (typeof ctx.clip === "function") ctx.clip();
  if (v.shake) ctx.translate(v.shake.x, v.shake.y);
  const row0 = Math.max(0, Math.floor(v.cam) - 1);
  const row1 = Math.min(round.lanes.length - 1, Math.ceil(v.cam + g.VIEW_ROWS) + 1);
  for (let r = row0; r <= row1; r++) drawLane(ctx, v, round.lanes[r], rowTop(v, r));
  for (let r = row0; r <= row1; r++) drawMovers(ctx, v, round.lanes[r], rowTop(v, r));
  drawPickups(ctx, v);
  // Higher rows first, so a hopper lower down is drawn over one above it;
  // you over a rival on the same row.
  const order = round.hoppers.slice().sort((a, b) => poseOf(b, C).row - poseOf(a, C).row || b.id - a.id);
  for (const h of order) if (!h.back) drawHopper(ctx, v, h);
  if (round.dark && (v.state === "running" || v.state === "paused")) drawDark(ctx, v);
  // Flying back, over everything (and the dark).
  for (const h of order) if (h.back) drawHopper(ctx, v, h);
  for (const p of v.fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y + (v.cam - p.cam) * C - p.size / 2, p.size, p.size);
  }
  for (const ring of v.fx.rings) {
    const p = 1 - ring.life / ring.max;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 0.5 * (1 - p) + 0.15;
    ctx.beginPath();
    ctx.arc(ring.x, rowTop(v, ring.row) + C / 2, ring.r0 + p * ring.grow, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const h of round.hoppers) drawOffView(ctx, v, h);
  if (v.shake) ctx.translate(-v.shake.x, -v.shake.y);
  // Before a heat: everyone's name over their head.
  if (round.phase === "ready" && (v.state === "running" || v.state === "paused")) {
    for (const h of round.hoppers) {
      const text = h.id === 0 ? "YOU" : v.nameOf(h.id).toUpperCase();
      const at = labelSpot(text, colX(v, h.x), rowTop(v, h.row) - 1.8, 2, g.FIELD_W, g.FIELD_H);
      label(ctx, text, at.x, at.y, 2, h.id === 0 ? "#ffffff" : v.colorOf(h.id), "center", at.max);
    }
  }
  for (const f of v.fx.floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
    const at = labelSpot(f.text, f.x, rowTop(v, f.row) - 1 - f.rise, f.size, g.FIELD_W, g.FIELD_H);
    label(ctx, f.text, at.x, at.y, f.size, f.color, "center", at.max);
  }
  ctx.globalAlpha = 1;
  if (v.combo) {
    const p = v.combo.life / v.combo.max;
    ctx.globalAlpha = Math.min(1, p * 3);
    const size = 4 + (1 - Math.min(1, (1 - p) * 6)) * 2.5;
    const at = labelSpot(`x${v.combo.n}`, g.FIELD_W / 2, g.FIELD_H * 0.5, size, g.FIELD_W, g.FIELD_H);
    label(ctx, `x${v.combo.n}`, at.x, at.y, size, GOLD);
    ctx.globalAlpha = 1;
  }
  if (v.flash) {
    ctx.globalAlpha = 0.26 * (v.flash.life / v.flash.max);
    ctx.fillStyle = v.flash.color;
    ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
    ctx.globalAlpha = 1;
  }
  if (v.state === "running" && v.banner) drawBanner(ctx, v, v.banner);
  if (v.tally) drawTally(ctx, v, v.tally);
  ctx.restore();
  ctx.translate(-g.PAD, -g.HUD_H);
  drawPills(ctx, v);
  ctx.restore();
}
