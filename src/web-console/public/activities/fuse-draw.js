// Plan2Code Web Console - Hot Potato's drawing: each venue's floor and the things on it, the runners, Planny on his feet, the bomb and its fuse, the dark, the pills and the banners, from a view fuse.js refills.
//
// Drawing only: no rules and no state of its own. fuse.js hands drawScene()
// one view object of the moment (the round, the board's geometry, the
// effects running, the colors readColors() took from the page), so the rules
// never touch a canvas and this file never decides anything. Everything is
// drawn in arena units under one scale to the board. Anything that moves on
// its own (a spark, a flicker, a belt) follows the view's clock, never
// Math.random(), so a paused game's frame stays still.
//
// Each venue paints its floor in its own fixed colors, the same in light and
// dark, and so are the words and banners (light text with a dark edge,
// which reads on every floor) and the pills (opaque dark, with text that
// reads on them at 4.5:1, from pills.js). The strip the pills sit on, the margin
// round the floor and Planny follow the page.

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
export const CHAR = "#2b2622";
export const SAFE_RING = "rgba(255, 255, 255, 0.9)";
export const SAFE_EDGE = "rgba(0, 0, 0, 0.45)";
const TAU = Math.PI * 2;

// Each venue's look: the floor's two tiles, its walls, and a tint for the
// things on it.
const THEMES = Object.freeze({
  1: Object.freeze({ a: "#dcc9a6", b: "#d1bc95", wall: "#7a5c43", dot: "#c9a36a" }),
  2: Object.freeze({ a: "#93a7bb", b: "#899db2", wall: "#4d5d70", dot: "#5e7fa3" }),
  3: Object.freeze({ a: "#2e3743", b: "#343e4b", wall: "#151a21", dot: "#3fd0c9" }),
  4: Object.freeze({ a: "#a19c92", b: "#979287", wall: "#6a655c", dot: "#8fb9d9" }),
  5: Object.freeze({ a: "#d3e6f0", b: "#c6dcea", wall: "#6d8ea3", dot: "#8fd3ff" }),
  6: Object.freeze({ a: "#a8a8a0", b: "#9e9e96", wall: "#5b5b55", dot: "#f5b301" }),
  7: Object.freeze({ a: "#bdb6aa", b: "#b3ac9f", wall: "#59534a", dot: "#a466ff" }),
  8: Object.freeze({ a: "#cfac91", b: "#c5a286", wall: "#6b4a3a", dot: "#e2553f" }),
  9: Object.freeze({ a: "#3d2c58", b: "#453262", wall: "#1d1430", dot: GOLD }),
});

export const themeFor = (level) => THEMES[Math.min(9, Math.max(1, Math.floor(level) || 1))];

// The dot each venue lights on the start and end screens.
export const venueColor = (level) => themeFor(level).dot;

// The ink for what is drawn straight on the floor (Planny's arms and feet, a
// rival's feet and arms): whichever of a dark and a light ink stands out more
// from both of the venue's tiles. The floors keep their colors in either
// theme, so the page's ink would vanish on some (dark on the Server Room,
// light on the Break Room).
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
    Object.entries(THEMES).map(([n, t]) => {
      const worst = (ink) => Math.min(contrast(ink, t.a), contrast(ink, t.b));
      return [n, worst(DARK_INK) >= worst(LIGHT_INK) ? DARK_INK : LIGHT_INK];
    }),
  ),
);
export const limbInk = (level) => LIMBS[Math.min(9, Math.max(1, Math.floor(level) || 1))];

// The things on the floor: a top, a front and a trim color for each kind.
const BLOCKS = Object.freeze({
  table: Object.freeze({ top: "#b07a45", front: "#7d5330", trim: "#d9a46b" }),
  cooler: Object.freeze({ top: "#e8eef2", front: "#b8c3cc", trim: "#5fb6e8" }),
  desk: Object.freeze({ top: "#e6dfd2", front: "#a89f8e", trim: "#2d3240" }),
  rack: Object.freeze({ top: "#20252e", front: "#11151b", trim: "#57e38a" }),
  vent: Object.freeze({ top: "#c3c6cc", front: "#868a92", trim: "#5d6170" }),
  tank: Object.freeze({ top: "#d9dde3", front: "#9aa1ab", trim: "#6d7480" }),
  box: Object.freeze({ top: "#c99a5e", front: "#9a7240", trim: "#e3c08c" }),
  icebox: Object.freeze({ top: "#f4fbff", front: "#b9d8ea", trim: "#1fb6d9" }),
  crate: Object.freeze({ top: "#b8894f", front: "#86602f", trim: "#5e4220" }),
  pillar: Object.freeze({ top: "#cfccc4", front: "#9a968c", trim: "#7d796f" }),
  cubicle: Object.freeze({ top: "#8b9bb4", front: "#5e6d85", trim: "#b8c4d6" }),
});

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// Text with a dark edge, so it reads on any floor in either theme. `max`,
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

/* ------------------------------------------------------------ the floor */

function drawFloor(ctx, v) {
  const { g, round } = v;
  const theme = themeFor(v.level);
  ctx.fillStyle = theme.a;
  ctx.fillRect(0, 0, g.AW, g.AH);
  ctx.fillStyle = theme.b;
  for (let y = 0; y < g.AH; y += 7) for (let x = (y / 7) % 2 ? 0 : 8; x < g.AW; x += 16) ctx.fillRect(x, y, 8, 7);
  // Ice: pale, with a shine.
  for (const p of round.ice) {
    ctx.fillStyle = "rgba(235, 250, 255, 0.75)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(p.x - p.r * 0.5, p.y - p.r * 0.1);
    ctx.lineTo(p.x - p.r * 0.1, p.y - p.r * 0.5);
    ctx.moveTo(p.x - p.r * 0.2, p.y + p.r * 0.2);
    ctx.lineTo(p.x + p.r * 0.3, p.y - p.r * 0.3);
    ctx.stroke();
  }
  // Belts: dark rubber, rollers along the edges and chevrons that run.
  for (const b of round.belts) {
    ctx.fillStyle = "#3a3a3e";
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#6a6a70";
    ctx.fillRect(b.x, b.y, b.w, 0.6);
    ctx.fillRect(b.x, b.y + b.h - 0.6, b.w, 0.6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(b.x, b.y, b.w, b.h);
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.strokeStyle = "rgba(245, 179, 1, 0.65)";
    ctx.lineWidth = 0.7;
    const shift = ((((v.clock / 1000) * v.beltSpeed * b.dx) % 8) + 8) % 8;
    for (let x = b.x - 8 + shift; x < b.x + b.w + 8; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x - b.dx * 1.5, b.y + b.h * 0.25);
      ctx.lineTo(x + b.dx * 1.5, b.y + b.h * 0.5);
      ctx.lineTo(x - b.dx * 1.5, b.y + b.h * 0.75);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// The walls round the floor; the Rooftop has none at the bottom, only the
// drop to the street.
function drawWalls(ctx, v) {
  const { g, round } = v;
  const theme = themeFor(v.level);
  ctx.strokeStyle = theme.wall;
  ctx.lineWidth = 1.2;
  ctx.lineCap = "butt";
  ctx.beginPath();
  if (round.open) {
    ctx.moveTo(-0.6, g.AH);
    ctx.lineTo(-0.6, -0.6);
    ctx.lineTo(g.AW + 0.6, -0.6);
    ctx.lineTo(g.AW + 0.6, g.AH);
    ctx.stroke();
    // The ledge, striped, and the sky below it.
    ctx.fillStyle = "#7cc4f0";
    ctx.fillRect(-g.PAD, g.AH, g.AW + g.PAD * 2, 4);
    ctx.fillStyle = "#4b7aa8";
    for (let x = -2; x < g.AW + 2; x += 9) ctx.fillRect(x, g.AH + 1.2 + ((x * 7) % 3) * 0.3, 5, 3);
    ctx.fillStyle = DANGER;
    for (let x = 0; x < g.AW; x += 4) ctx.fillRect(x, g.AH - 0.7, 2, 0.7);
    ctx.fillStyle = "#ffffff";
    for (let x = 2; x < g.AW; x += 4) ctx.fillRect(x, g.AH - 0.7, 2, 0.7);
  } else {
    ctx.rect(-0.6, -0.6, g.AW + 1.2, g.AH + 1.2);
    ctx.stroke();
  }
}

// One thing on the floor, seen from a little above: a shadow, its front
// face along the bottom and its top, then what makes it that thing.
function drawBlock(ctx, b, v) {
  const look = BLOCKS[b.kind] || BLOCKS.crate;
  const front = Math.min(2.4, b.h * 0.3);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(b.x + 0.8, b.y + 0.9, b.w, b.h);
  ctx.fillStyle = look.front;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = look.top;
  ctx.fillRect(b.x, b.y, b.w, b.h - front);
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 0.25;
  ctx.strokeRect(b.x, b.y, b.w, b.h);
  const top = b.h - front;
  ctx.fillStyle = look.trim;
  ctx.strokeStyle = look.trim;
  if (b.kind === "table") {
    ctx.fillRect(b.x + 0.6, b.y + 0.6, b.w - 1.2, 0.4);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.3, b.y + top * 0.5, 1, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6b3f1f";
    ctx.beginPath();
    ctx.arc(b.x + b.w * 0.3, b.y + top * 0.5, 0.6, 0, TAU);
    ctx.fill();
  } else if (b.kind === "cooler") {
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + top / 2, Math.min(b.w, top) * 0.36, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  } else if (b.kind === "desk") {
    for (const fx of [0.25, 0.75]) {
      ctx.fillRect(b.x + b.w * fx - 2, b.y + 0.8, 4, 2.4);
      ctx.fillStyle = "#5fb6e8";
      ctx.fillRect(b.x + b.w * fx - 1.6, b.y + 1.1, 3.2, 1.6);
      ctx.fillStyle = look.trim;
    }
  } else if (b.kind === "rack") {
    for (let x = b.x + 1.2; x < b.x + b.w - 0.8; x += 2.4) {
      const on = Math.floor(v.clock / 300 + x * 1.7) % 3;
      ctx.fillStyle = on ? look.trim : "#ffb347";
      ctx.fillRect(x, b.y + b.h - front + 0.5, 0.6, 0.5);
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    for (let x = b.x + 2.4; x < b.x + b.w; x += 4.8) ctx.fillRect(x, b.y, 0.3, top);
  } else if (b.kind === "vent") {
    ctx.lineWidth = 0.4;
    for (let y = b.y + 1.2; y < b.y + top - 0.6; y += 1.4) {
      ctx.beginPath();
      ctx.moveTo(b.x + 1, y);
      ctx.lineTo(b.x + b.w - 1, y);
      ctx.stroke();
    }
  } else if (b.kind === "tank") {
    ctx.fillStyle = look.top;
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + top / 2, Math.min(b.w, top) * 0.48, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 0.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x + b.w / 2, b.y + top / 2, Math.min(b.w, top) * 0.25, 0, TAU);
    ctx.stroke();
  } else if (b.kind === "box" || b.kind === "crate") {
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    if (b.kind === "crate") {
      ctx.moveTo(b.x + 0.5, b.y + 0.5);
      ctx.lineTo(b.x + b.w - 0.5, b.y + top - 0.5);
      ctx.moveTo(b.x + b.w - 0.5, b.y + 0.5);
      ctx.lineTo(b.x + 0.5, b.y + top - 0.5);
    } else {
      ctx.moveTo(b.x + b.w / 2, b.y);
      ctx.lineTo(b.x + b.w / 2, b.y + top);
    }
    ctx.stroke();
  } else if (b.kind === "icebox") {
    ctx.fillRect(b.x + 1, b.y + 1, b.w - 2, 1.2);
    ctx.fillStyle = "#ffffff";
    for (let k = 0; k < 5; k++) ctx.fillRect(b.x + 2 + ((k * 3.1) % (b.w - 4)), b.y + 3.2 + ((k * 2.3) % Math.max(1, top - 4.5)), 1.4, 1.4);
  } else if (b.kind === "pillar") {
    ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
    ctx.fillRect(b.x + b.w * 0.6, b.y, b.w * 0.4, top);
  } else if (b.kind === "cubicle") {
    ctx.fillRect(b.x, b.y, b.w, 0.5);
  }
}

/* -------------------------------------------------------------- pickups */

// A pickup's picture, white, centered on x, y and about 2s across.
function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.24;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "freeze") {
    for (let k = 0; k < 3; k++) {
      const a = (k * Math.PI) / 3;
      ctx.moveTo(x - Math.cos(a) * s * 0.85, y - Math.sin(a) * s * 0.85);
      ctx.lineTo(x + Math.cos(a) * s * 0.85, y + Math.sin(a) * s * 0.85);
    }
    ctx.stroke();
  } else if (kind === "sneakers") {
    ctx.moveTo(x - s * 0.8, y + s * 0.5);
    ctx.lineTo(x - s * 0.6, y - s * 0.5);
    ctx.lineTo(x - s * 0.1, y - s * 0.3);
    ctx.lineTo(x + s * 0.3, y + s * 0.05);
    ctx.lineTo(x + s * 0.85, y + s * 0.2);
    ctx.lineTo(x + s * 0.85, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "extra") {
    ctx.moveTo(x - s * 0.7, y + s * 0.6);
    ctx.quadraticCurveTo(x - s * 0.2, y - s * 0.6, x + s * 0.4, y - s * 0.2);
    ctx.stroke();
    star(ctx, x + s * 0.55, y - s * 0.4, s * 0.45, s * 0.2);
    ctx.fill();
  } else if (kind === "swap") {
    ctx.moveTo(x - s * 0.8, y - s * 0.3);
    ctx.lineTo(x + s * 0.7, y - s * 0.3);
    ctx.moveTo(x + s * 0.35, y - s * 0.65);
    ctx.lineTo(x + s * 0.75, y - s * 0.3);
    ctx.lineTo(x + s * 0.35, y + s * 0.05);
    ctx.moveTo(x + s * 0.8, y + s * 0.4);
    ctx.lineTo(x - s * 0.7, y + s * 0.4);
    ctx.moveTo(x - s * 0.35, y + s * 0.05);
    ctx.lineTo(x - s * 0.75, y + s * 0.4);
    ctx.lineTo(x - s * 0.35, y + s * 0.75);
    ctx.stroke();
  }
}

function drawPickups(ctx, v) {
  for (const p of v.round.pickups) {
    if (p.ttl < 2000 && Math.floor(v.clock / 120) % 2 === 0) continue;
    const color = v.powers[p.kind].color;
    const s = 2.3 * (1 + 0.08 * Math.sin(v.clock / 120 + p.x));
    const bob = Math.sin(v.clock / 260 + p.y) * 0.4;
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    if (typeof ctx.ellipse === "function") ctx.ellipse(p.x, p.y + 1.6, s * 0.9, s * 0.35, 0, 0, TAU);
    ctx.fill();
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    roundRect(ctx, p.x - s, p.y - s + bob, s * 2, s * 2, s * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 0.3;
    ctx.stroke();
    glyph(ctx, p.kind, p.x, p.y + bob, s * 0.6);
  }
}

/* -------------------------------------------------------------- runners */

// Two small feet under a runner, stepping as it goes.
function feet(ctx, x, y, stride, color, w) {
  const step = Math.sin(stride * 0.9);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - 0.9, y - 0.2);
  ctx.lineTo(x - 0.9 + step * 0.5, y + 0.6);
  ctx.moveTo(x + 0.9, y - 0.2);
  ctx.lineTo(x + 0.9 - step * 0.5, y + 0.6);
  ctx.stroke();
}

// Planny on his feet: a box with a star for an eye and a smile, stick arms
// (flailing while he holds a bomb, both up when he cheers) and two small feet.
// Blown up, he is still Planny, charred: a sooty box, his star eye dimmed and
// his arms down as he waddles off.
function drawPlanny(ctx, r, v, opts) {
  const { colors, clock } = v;
  const s = 2.1;
  const bx = r.x;
  const by = r.y - 2.6;
  const limb = opts.charred ? "#1a1612" : limbInk(v.level);
  feet(ctx, bx, r.y - 0.4, r.stride, limb, 0.42);
  ctx.strokeStyle = limb;
  ctx.lineWidth = 0.38;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (opts.charred) {
    ctx.moveTo(bx - s, by + 0.2);
    ctx.lineTo(bx - s - 0.9, by + 1.8);
    ctx.moveTo(bx + s, by + 0.2);
    ctx.lineTo(bx + s + 0.9, by + 1.8);
  } else if (opts.holding) {
    // Flailing: both arms up, waving wildly.
    const a = Math.sin(clock / 55) * 0.6;
    ctx.moveTo(bx - s, by);
    ctx.lineTo(bx - s - 1.3 + a, by - 2.2);
    ctx.moveTo(bx + s, by);
    ctx.lineTo(bx + s + 1.3 + a, by - 2.2);
  } else if (opts.cheer) {
    ctx.moveTo(bx - s, by - 0.4);
    ctx.lineTo(bx - s - 1.2, by - 2.6);
    ctx.moveTo(bx + s, by - 0.4);
    ctx.lineTo(bx + s + 1.2, by - 2.6);
  } else {
    const swing = Math.sin(r.stride * 0.9) * 0.5;
    ctx.moveTo(bx - s, by + 0.2);
    ctx.lineTo(bx - s - 0.9, by + 1.8 + swing);
    ctx.moveTo(bx + s, by + 0.2);
    ctx.lineTo(bx + s + 0.9, by + 1.8 - swing);
  }
  ctx.stroke();
  roundRect(ctx, bx - s, by - s, s * 2, s * 2, s * 0.35);
  ctx.fillStyle = opts.charred ? CHAR : colors.board;
  ctx.fill();
  ctx.strokeStyle = opts.charred ? "rgba(0, 0, 0, 0.5)" : colors.ink;
  ctx.lineWidth = 0.32;
  ctx.stroke();
  star(ctx, bx + r.face * 0.15, by - s * 0.25, s * 0.55, s * 0.24, opts.scared ? Math.PI / 5 : 0);
  const was = ctx.globalAlpha;
  if (opts.charred) ctx.globalAlpha = was * 0.6;
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.globalAlpha = was;
  ctx.strokeStyle = opts.charred ? LIGHT_INK : colors.ink;
  ctx.lineWidth = 0.26;
  ctx.beginPath();
  if (opts.scared) ctx.arc(bx, by + s * 0.55, s * 0.18, 0, TAU);
  else ctx.arc(bx, by + s * 0.3, s * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// A rival: a round body in its color with two eyes looking the way it runs,
// two small feet and its personality's mark.
function drawRival(ctx, r, v, opts) {
  const { clock } = v;
  const color = opts.charred ? CHAR : v.colorOf(r.id);
  const rr = 2.5;
  const bx = r.x;
  const by = r.y - 2.6;
  const limb = limbInk(v.level);
  feet(ctx, bx, r.y - 0.4, r.stride, opts.charred ? "#1a1612" : limb, 0.42);
  // A wound-up rival crouches and revs: a ring pulsing at it.
  if (r.windup > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.4;
    ctx.globalAlpha *= 0.5 + 0.5 * Math.abs(Math.sin(clock / 45));
    ctx.beginPath();
    ctx.arc(bx, by + 0.6, rr + 1.2 + Math.abs(Math.sin(clock / 45)) * 0.7, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = opts.alpha;
  }
  const squash = r.windup > 0 ? 0.85 : 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(bx, by + (1 - squash) * rr, rr * (2 - squash), rr * squash, 0, 0, TAU);
  else ctx.arc(bx, by, rr, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = 0.25;
  ctx.stroke();
  if (!opts.charred) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(bx - rr * 0.35, by - rr * 0.4, rr * 0.38, 0, TAU);
    ctx.fill();
  }
  // Holding a bomb, arms up under it.
  if (opts.holding && !opts.charred) {
    const a = Math.sin(clock / 70 + r.id) * 0.4;
    ctx.strokeStyle = limb;
    ctx.lineWidth = 0.34;
    ctx.beginPath();
    ctx.moveTo(bx - rr * 0.9, by - 0.3);
    ctx.lineTo(bx - rr * 0.9 - 0.8 + a, by - 2.7);
    ctx.moveTo(bx + rr * 0.9, by - 0.3);
    ctx.lineTo(bx + rr * 0.9 + 0.8 + a, by - 2.7);
    ctx.stroke();
  } else if (r.kind === "clingy" && !opts.charred) {
    // Arms out for a hug.
    ctx.strokeStyle = limb;
    ctx.lineWidth = 0.34;
    ctx.beginPath();
    ctx.moveTo(bx - rr * 0.9, by + 0.2);
    ctx.lineTo(bx - rr * 0.9 - 1.4, by - 0.8);
    ctx.moveTo(bx + rr * 0.9, by + 0.2);
    ctx.lineTo(bx + rr * 0.9 + 1.4, by - 0.8);
    ctx.stroke();
  }
  // The eyes, looking the way it runs (crosses when charred).
  const sp = Math.hypot(r.vx, r.vy);
  const lx = sp > 3 ? r.vx / sp : r.face;
  const ly = sp > 3 ? r.vy / sp : 0;
  for (const side of [-1, 1]) {
    const ex = bx + side * rr * 0.36 + lx * 0.4;
    const ey = by - rr * 0.1 + ly * 0.3;
    if (opts.charred) {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.moveTo(ex - 0.4, ey - 0.4);
      ctx.lineTo(ex + 0.4, ey + 0.4);
      ctx.moveTo(ex + 0.4, ey - 0.4);
      ctx.lineTo(ex - 0.4, ey + 0.4);
      ctx.stroke();
      continue;
    }
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(ex, ey, 0.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#1d1a17";
    ctx.beginPath();
    ctx.arc(ex + lx * 0.25, ey + ly * 0.25, 0.3, 0, TAU);
    ctx.fill();
  }
  if (opts.charred) return;
  if (r.kind === "sprinter") {
    // A headband with its tails flying behind.
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(bx - rr * 0.95, by - rr * 0.6);
    ctx.lineTo(bx + rr * 0.95, by - rr * 0.6);
    ctx.moveTo(bx - lx * rr, by - rr * 0.6);
    ctx.lineTo(bx - lx * (rr + 1.4), by - rr * 0.6 + Math.sin(clock / 80) * 0.5);
    ctx.stroke();
  } else if (r.kind === "hider") {
    // A cardboard box worn as a hat.
    ctx.fillStyle = "#c99a5e";
    ctx.fillRect(bx - 1.5, by - rr - 1.3, 3, 1.7);
    ctx.strokeStyle = "#7d5a30";
    ctx.lineWidth = 0.2;
    ctx.strokeRect(bx - 1.5, by - rr - 1.3, 3, 1.7);
  } else if (r.kind === "trickster") {
    // A jester's two-pointed hat with bells.
    ctx.fillStyle = "#3a2a5a";
    ctx.beginPath();
    ctx.moveTo(bx - 1.6, by - rr * 0.7);
    ctx.lineTo(bx - 2.2, by - rr - 1.6);
    ctx.lineTo(bx, by - rr * 0.95);
    ctx.lineTo(bx + 2.2, by - rr - 1.6);
    ctx.lineTo(bx + 1.6, by - rr * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = GOLD;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(bx + side * 2.2, by - rr - 1.6, 0.4, 0, TAU);
      ctx.fill();
    }
  } else if (r.kind === "pal") {
    // Rosy cheeks and a big smile.
    ctx.fillStyle = "rgba(255, 120, 150, 0.7)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(bx + side * rr * 0.65, by + rr * 0.25, 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = "#1d1a17";
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.arc(bx, by + rr * 0.2, rr * 0.35, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  }
}

// One runner where it stands, or blown out (charred, waddling off and
// fading) or off the roof (falling away).
function drawRunner(ctx, r, v) {
  const you = r.id === 0;
  let alpha = 1;
  let scale = 1;
  let charred = false;
  if (!r.alive) {
    if (r.outMs <= 0) return;
    if (r.out === "fall") {
      const t = 1 - r.outMs / v.fallMs;
      scale = Math.max(0.1, 1 - t * 0.8);
      alpha = 1 - t;
    } else {
      charred = true;
      const t = 1 - r.outMs / v.outMs;
      alpha = t > 0.7 ? Math.max(0, (1 - t) / 0.3) : 1;
    }
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(r.x, r.y);
  // A charred runner waddles: a side to side rock.
  if (charred && typeof ctx.rotate === "function") ctx.rotate(Math.sin(r.stride * 1.2) * 0.18);
  ctx.scale(scale, scale);
  ctx.translate(-r.x, -r.y);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(r.x, r.y + 0.2, 2.4, 0.9, 0, 0, TAU);
  ctx.fill();
  // Safe from a tag-back: a white ring at its feet, so a touch that passes
  // nothing is no surprise.
  // A dark edge under the white keeps it plain on the pale floors (the Break
  // Room, the Ice Machine) as well as the dark ones.
  if (r.alive && v.safeOf && v.safeOf(r.id)) {
    ctx.beginPath();
    if (typeof ctx.ellipse === "function") ctx.ellipse(r.x, r.y + 0.2, 3.6, 1.5, 0, 0, TAU);
    ctx.strokeStyle = SAFE_EDGE;
    ctx.lineWidth = 0.75;
    ctx.stroke();
    ctx.strokeStyle = SAFE_RING;
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
  const holding = r.alive && v.holderOf(r.id);
  if (you) drawPlanny(ctx, r, v, { holding, charred, cheer: v.cheer && r.alive, scared: !r.alive || (holding && v.hot) });
  else drawRival(ctx, r, v, { holding, charred, alpha });
  if (charred) {
    // Smoke curling up.
    ctx.fillStyle = "rgba(90, 90, 90, 0.5)";
    for (let k = 0; k < 3; k++) {
      const p = ((v.clock / 600 + k / 3) % 1 + 1) % 1;
      ctx.globalAlpha = alpha * (1 - p) * 0.6;
      ctx.beginPath();
      ctx.arc(r.x + Math.sin(p * 6 + k) * 0.8, r.y - 6 - p * 4, 0.6 + p * 0.8, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Speed lines behind a dashing runner.
function drawStreaks(ctx, v) {
  for (const s of v.fx.streaks) {
    ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.45;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y - 2.4, s.r * (0.5 + 0.5 * (s.life / s.max)), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------- the bomb */

// The bomb over its holder's head: a red ball with a white band of <<<
// markers, growing and glowing redder as its fuse burns, flashing white
// while it cannot be passed on, and its fuse a curl that shortens to a spark.
function drawBomb(ctx, v, b, x, y, footY) {
  const left = Math.max(0, Math.min(1, b.fuse / b.max));
  const R = 1.7 + 0.9 * (1 - left);
  const pulse = 1 + (left < 0.25 ? 0.08 * Math.abs(Math.sin(v.clock / (40 + 120 * left))) : 0);
  const r = R * pulse;
  const locked = b.lock > 0 && v.round.phase === "play" && Math.floor(v.clock / 70) % 2 === 0;
  ctx.shadowColor = "#ff3b1f";
  ctx.shadowBlur = 3 + 10 * (1 - left);
  ctx.fillStyle = locked ? "#ffffff" : left < 0.3 ? "#ff3b1f" : "#d8283b";
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 0.22;
  ctx.stroke();
  // The <<<<<<< band.
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fillRect(x - r * 0.9, y - r * 0.18, r * 1.8, r * 0.36);
  ctx.strokeStyle = "#d8283b";
  ctx.lineWidth = 0.16;
  ctx.beginPath();
  for (let k = -2; k <= 2; k++) {
    const cx = x + k * r * 0.32;
    ctx.moveTo(cx + r * 0.1, y - r * 0.12);
    ctx.lineTo(cx - r * 0.08, y);
    ctx.lineTo(cx + r * 0.1, y + r * 0.12);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.4, r * 0.28, 0, TAU);
  ctx.fill();
  // The fuse: a cap, a curl as long as the time left, the spark at its end.
  ctx.fillStyle = "#3a3a3e";
  ctx.fillRect(x - 0.35, y - r - 0.5, 0.7, 0.6);
  const n = 10;
  const length = 0.6 + 3.2 * left;
  let fx = x;
  let fy = y - r - 0.4;
  ctx.strokeStyle = "#8a6a3c";
  ctx.lineWidth = 0.28;
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  for (let k = 1; k <= n; k++) {
    const t = (k / n) * length;
    fx = x + Math.sin(t * 1.4) * 0.9;
    fy = y - r - 0.4 - t * 0.8;
    ctx.lineTo(fx, fy);
  }
  ctx.stroke();
  const frozen = v.round.freeze > 0;
  const flick = 0.5 + 0.5 * Math.abs(Math.sin(v.clock / 37 + b.max));
  ctx.fillStyle = frozen ? "#bfefff" : GOLD;
  star(ctx, fx, fy, 0.6 + 0.4 * flick, 0.25, v.clock / 90);
  ctx.fill();
  if (!frozen) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(fx, fy, 0.25 * flick, 0, TAU);
    ctx.fill();
  }
  // The last seconds, in big numbers.
  if (b.fuse < 3000 && b.fuse > 0) label(ctx, String(Math.ceil(b.fuse / 1000)), x, countY(y, r, footY), COUNT_SIZE, left < 0.12 ? DANGER : "#ffffff");
}

// Where the last seconds' number sits: over the bomb, or, with no room for it
// there (a holder near the top wall), under the holder's feet, so it never
// runs over the pills or off the top of the board.
const COUNT_SIZE = 3.2;
export function countY(bombY, r, footY) {
  const above = bombY - r - 5;
  return above - COUNT_SIZE / 2 >= 0 ? above : footY + 3;
}

// Each lit bomb over its holder, or for the moment just after a pass, on its
// way across between the two in a little hop.
function drawBombs(ctx, v) {
  const { round } = v;
  round.bombs.forEach((b) => {
    if (!b.lit) return;
    const h = round.runners[b.holder];
    let x = h.x;
    let y = h.y - 7.6;
    const hop = v.fx.hops.find((k) => k.to === b.holder);
    if (hop && b.from) {
      const f = round.runners[hop.from];
      const t = 1 - hop.life / hop.max;
      x = f.x + (h.x - f.x) * t;
      y = f.y - 7.6 + (h.y - f.y) * t - Math.sin(t * Math.PI) * 4;
    }
    drawBomb(ctx, v, b, x, y, h.y);
  });
}

// A cartoon cloud of smoke and stars where a bomb blew.
function drawClouds(ctx, v) {
  for (const c of v.fx.clouds) {
    const p = 1 - c.life / c.max;
    ctx.globalAlpha = p > 0.6 ? (1 - p) / 0.4 : 1;
    const R = 3 + p * 6;
    ctx.fillStyle = p < 0.15 ? "#fff3c4" : "#d8d2c8";
    for (let k = 0; k < 7; k++) {
      const a = (k * TAU) / 7 + c.seed;
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(a) * R * 0.6, c.y - 2 + Math.sin(a) * R * 0.45, R * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = GOLD;
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4 + p * 2;
      star(ctx, c.x + Math.cos(a) * R * 1.1, c.y - 2 + Math.sin(a) * R * 0.8, 1.1, 0.45, p * 4);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------- the dark */

// The Blackout's dark: the floor in cells, each as dark as its distance from
// the nearest light (you, every bomb, a pickup's glow), in a few steps, so
// it costs a handful of fills a frame.
const DARK_STEPS = 10;
const DARK_CELL = 1.5;
// Each cell's step of dark, worked out once a frame.
let DARK = new Uint8Array(0);

function drawDark(ctx, v) {
  const { g, round } = v;
  const lights = [];
  const you = round.runners[0];
  if (you.alive) lights.push([you.x, you.y - 2, 15]);
  for (const b of round.bombs) {
    if (!b.lit) continue;
    const h = round.runners[b.holder];
    lights.push([h.x, h.y - 5, 10 + 2 * Math.sin(v.clock / 60 + b.max)]);
  }
  for (const p of round.pickups) lights.push([p.x, p.y, 5]);
  for (const c of v.fx.clouds) lights.push([c.x, c.y, 14 * (c.life / c.max)]);
  const cols = Math.ceil(g.AW / DARK_CELL);
  const rows = Math.ceil(g.AH / DARK_CELL);
  if (DARK.length < cols * rows) DARK = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let lit = 0;
      for (const [lx, ly, lr] of lights) lit = Math.max(lit, 1 - Math.hypot((i + 0.5) * DARK_CELL - lx, (j + 0.5) * DARK_CELL - ly) / lr);
      DARK[j * cols + i] = Math.round((1 - Math.max(0, lit)) * DARK_STEPS);
    }
  }
  for (let step = 1; step <= DARK_STEPS; step++) {
    ctx.beginPath();
    let any = false;
    for (let k = 0; k < cols * rows; k++) {
      if (DARK[k] !== step) continue;
      ctx.rect((k % cols) * DARK_CELL, Math.floor(k / cols) * DARK_CELL, DARK_CELL + 0.02, DARK_CELL + 0.02);
      any = true;
    }
    if (!any) continue;
    ctx.fillStyle = `rgba(6, 6, 18, ${((step / DARK_STEPS) * 0.92).toFixed(3)})`;
    ctx.fill();
  }
  // The rivals' eyes still shine in the dark.
  for (const r of round.runners) {
    if (r.id === 0 || !r.alive) continue;
    ctx.fillStyle = "#fff8c4";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(r.x + side * 0.9, r.y - 2.9, 0.4, 0, TAU);
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

// Where the pills go, `h` units tall on a board `W` wide: the venue, lives,
// dash charges (the next one filling) and runners left along the top, then
// your effects and the hot streak; the fuse on the right. A pill that would
// run into the fuse or off the board starts a row below. Given the strip's
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
  let fuse = null;
  if (hud.fuse) {
    const w = pillWidth(h, hud.fuse.text);
    fuse = { x: W - w - edge, y: y0, w, text: hud.fuse.text, color: hud.fuse.color, fill: 1 };
  }
  let x = edge;
  let y = y0;
  const place = (text, color, fill = 1) => {
    const w = pillWidth(h, text);
    const limit = y === y0 && fuse ? fuse.x - gap : W - edge;
    if (x > edge && x + w > limit) {
      x = edge;
      y += h + gap;
    }
    out.push({ x, y, w, text, color, fill });
    x += w + gap;
  };
  place(hud.venue, "#ffffff");
  place(livesText(lives), LIVES);
  place(`DASH ${"●".repeat(hud.charges)}${"○".repeat(Math.max(0, hud.maxCharges - hud.charges))}`, "#ff8a1f", hud.charges < hud.maxCharges ? hud.recharge : 1);
  place(`${hud.left} LEFT`, "#ffffff");
  for (const e of hud.effects) place(e.text, e.color, e.fill);
  if (hud.streak > 0) place(`HOT x${hud.streak}`, GOLD);
  if (fuse) out.push(fuse);
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

// A banner is a light strip across the arena, on the half away from you,
// fading almost clear while you run under it.
function drawBanner(ctx, v, b) {
  const w = v.g.AW;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = b.row;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - 7, w, 14);
  if (b.tag) label(ctx, b.tag, w / 2, y - 4.6, 2.2, GOLD);
  label(ctx, b.title, w / 2, y - 0.4, 5.2 * pop, b.color, "center", w - 8);
  if (b.sub) label(ctx, b.sub, w / 2, y + 4.3, 2.6, "#ffffff", "center", w - 8);
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip along the bottom of the arena: a line or
// two, then one dot per venue, lit for those reached, and past the ninth the
// Finale reached. The over screen adds the round's score, big, above it.
function drawTally(ctx, v, lines) {
  const { g } = v;
  const top = g.AH - 17;
  // Kept low, clear of the window's own end-of-round note in the middle.
  if (v.big) {
    ctx.fillStyle = BANNER_SHADE;
    ctx.fillRect(0, top - 12, g.AW, 11.6);
    label(ctx, "SCORE", g.AW / 2, top - 10.2, 2, "#ffffff");
    label(ctx, v.big, g.AW / 2, top - 5, 7, GOLD);
  }
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, g.AW, 17);
  lines.forEach((text, i) => label(ctx, text, g.AW / 2, top + 3.4 + i * 4.2, i ? 2.4 : 2.9, i ? "#ffffff" : GOLD, "center", g.AW - 6));
  const r = 1.2;
  const step = r * 3.2;
  const x = g.AW / 2 - ((v.maxVenue - 1) * step) / 2;
  const y = top + 13.2;
  for (let i = 0; i < v.maxVenue; i++) {
    ctx.beginPath();
    ctx.arc(x + i * step, y, r, 0, TAU);
    if (i < v.furthest) {
      ctx.fillStyle = venueColor(i + 1);
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
  if (v.furthest > v.maxVenue) label(ctx, `+${v.furthest - v.maxVenue}`, x + v.maxVenue * step + 0.6, y, 2.2, GOLD, "left");
}

/* --------------------------------------------------------------- scene */

// The whole frame. `v` is the view fuse.js refills: the round, the board's
// geometry `g`, the scale `u`, the colors, the effects, the state, the pill
// numbers and the lines for the start and end screens.
export function drawScene(ctx, v) {
  const { g, round } = v;
  ctx.save();
  ctx.scale(v.u, v.u);
  ctx.fillStyle = v.colors.board;
  ctx.fillRect(0, 0, g.W, g.H);
  drawHud(ctx, v);
  ctx.translate(g.PAD, g.HUD_H);
  if (v.shake) ctx.translate(v.shake.x, v.shake.y);
  drawFloor(ctx, v);
  drawWalls(ctx, v);
  for (const b of round.blocks) drawBlock(ctx, b, v);
  drawPickups(ctx, v);
  drawStreaks(ctx, v);
  // Front to back by where each stands, so a runner below another is drawn
  // over it; the knocked out under the rest.
  const order = round.runners.slice().sort((a, b) => (a.alive === b.alive ? a.y - b.y : a.alive ? 1 : -1));
  for (const r of order) drawRunner(ctx, r, v);
  if (round.dark && (v.state === "running" || v.state === "paused")) drawDark(ctx, v);
  drawBombs(ctx, v);
  drawClouds(ctx, v);
  for (const p of v.fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  for (const ring of v.fx.rings) {
    const p = 1 - ring.life / ring.max;
    ctx.globalAlpha = (1 - p) * 0.8;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 0.6 * (1 - p) + 0.15;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.r0 + p * ring.grow, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Before a match: everyone's name over their head.
  if (round.phase === "ready" && (v.state === "running" || v.state === "paused")) {
    for (const r of round.runners) label(ctx, r.id === 0 ? "YOU" : v.nameOf(r.id).toUpperCase(), r.x, r.y - 7.5 - (v.holderOf(r.id) ? 5 : 0), 2.2, r.id === 0 ? "#ffffff" : v.colorOf(r.id));
  }
  for (const f of v.fx.floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
    label(ctx, f.text, f.x, f.y, f.size || 2.8, f.color);
  }
  ctx.globalAlpha = 1;
  if (v.combo) {
    const you = round.runners[0];
    const p = v.combo.life / v.combo.max;
    ctx.globalAlpha = Math.min(1, p * 3);
    label(ctx, `x${v.combo.n}`, you.x + 6, you.y - 9, 4 + (1 - Math.min(1, (1 - p) * 6)) * 2.5, GOLD);
    ctx.globalAlpha = 1;
  }
  // The last second of a fuse: the edges pulse red, harder on yours.
  if (v.pulse > 0 && v.state === "running") {
    ctx.globalAlpha = v.pulse * (0.35 + 0.45 * Math.abs(Math.sin(v.clock / 70)));
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 2.4;
    ctx.strokeRect(1.2, 1.2, g.AW - 2.4, g.AH - 2.4);
    ctx.globalAlpha = 1;
  }
  if (v.flash) {
    ctx.globalAlpha = 0.28 * (v.flash.life / v.flash.max);
    ctx.fillStyle = v.flash.color;
    ctx.fillRect(-2, -2, g.AW + 4, g.AH + 4);
    ctx.globalAlpha = 1;
  }
  if (v.shake) ctx.translate(-v.shake.x, -v.shake.y);
  if (v.state === "running" && v.banner) drawBanner(ctx, v, v.banner);
  if (v.tally) drawTally(ctx, v, v.tally);
  ctx.translate(-g.PAD, -g.HUD_H);
  drawPills(ctx, v);
  ctx.restore();
}
