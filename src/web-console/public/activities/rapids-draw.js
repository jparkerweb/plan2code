// Plan2Code Web Console - Rapids Run's drawing: the river and its banks, islands and dams in each stretch's look, the buoys, crates and foes, the mini-bosses, Planny's jet-skimmer and its wake, the shots and bolts, the pills, the battery gauge and the banners, from a view rapids.js refills.
//
// Drawing only: no rules and no state of its own. rapids.js hands
// drawScene() one view object of the moment (the round, its river, the
// board's geometry, the effects running, the colors readColors() took from
// the page), so the rules never touch a canvas and this file never decides
// anything. Everything is drawn in field units under one scale. Anything that
// moves on its own (the water's flow, a buoy's bob, a gull's wings) follows
// the view's clock, never Math.random(), so a paused game's frame stays still.
//
// The river, its banks and everything on it keep their own fixed colors, the
// same in light and dark. The floating words and the banners are light text
// with a dark edge, which reads on any water or bank, and the pills are
// opaque dark with text that reads on them at 4.5:1 (pills.js). The strip
// the pills sit on, the battery gauge's frame, Planny's box and his skimmer
// (in your highlight) follow the page.

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
export const CHARGE = "#2fd08a";
const SHADE = "rgba(0, 0, 0, 0.55)";
const BANNER_SHADE = "rgba(0, 0, 0, 0.32)";
const EDGE_DARK = "rgba(0, 0, 0, 0.75)";
const TAU = Math.PI * 2;

// Each stretch's look: the banks (`land`, and `alt` for their bands), the
// shore line, the water, its flow streaks, the trees (or rocks) on the
// banks, and the color the stretch's name shows in.
export const LOOKS = Object.freeze({
  meadow: Object.freeze({ land: "#6fbf4a", alt: "#64b041", shore: "#e6d29a", water: "#2f7fc4", foam: "#cfe8ff", tree: "#2f7a3a", leaf: "#3e9a48", color: "#57b54a" }),
  autumn: Object.freeze({ land: "#c98b4a", alt: "#bd7f40", shore: "#ecd6a0", water: "#3a7fb8", foam: "#d6ebff", tree: "#a8461f", leaf: "#e8892b", color: "#ff8a1f" }),
  canyon: Object.freeze({ land: "#c46a3f", alt: "#b55f37", shore: "#e2b48a", water: "#2f8fa8", foam: "#cff0f5", tree: "#7e4128", leaf: "#9c5534", color: "#e2553f" }),
  marsh: Object.freeze({ land: "#6d8a4a", alt: "#647f44", shore: "#b3a882", water: "#3b6f73", foam: "#d5ecec", tree: "#3e5a2a", leaf: "#567a36", color: "#2fbf71" }),
  dusk: Object.freeze({ land: "#4a3f63", alt: "#43395a", shore: "#857596", water: "#25486e", foam: "#a9c4e6", tree: "#2e2742", leaf: "#5a4a7a", color: "#a466ff" }),
  night: Object.freeze({ land: "#22303f", alt: "#1e2a38", shore: "#4a5c72", water: "#143152", foam: "#8fb3dc", tree: "#152030", leaf: "#2a3d52", color: "#4f7cff" }),
});
export const lookOf = (id) => LOOKS[id] || LOOKS.meadow;
export const lookColor = (id) => lookOf(id).color;

// A dark or a light ink, whichever stands out more on `color`: Planny's
// arms on your skimmer, in any highlight.
export const DARK_INK = "#1d1a17";
export const LIGHT_INK = "#f0ece5";

export function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return 0.5;
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

export const inkOn = (color) => (contrast(DARK_INK, color) >= contrast(LIGHT_INK, color) ? DARK_INK : LIGHT_INK);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const ellipse = (ctx, x, y, rx, ry, rot = 0) => {
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  else ctx.arc(x, y, Math.max(rx, ry), 0, TAU);
};

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, r), 0, TAU);
};

// Text with a dark edge, so it reads on any water or bank in either theme.
// `max`, when given, squeezes a long line to fit that many units.
export function label(ctx, text, x, y, size, color, align = "center", max = undefined) {
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(0.3, size / 6);
  ctx.lineJoin = "round";
  ctx.strokeStyle = EDGE_DARK;
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

// A small whole-number hash, so the trees and streaks sit in the same
// places every frame.
const hash = (a, b) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

/* --------------------------------------------------------------- river */

// The stretch a distance belongs to, for its look: the first whose dam (and
// the few units past it) is still ahead.
function stretchAtD(river, d) {
  for (let k = 1; k <= river.built; k++) if (d <= river.damAt[k] + 6) return k;
  return river.built;
}

function riverPoly(ctx, v, from, to, side) {
  const { river, yOf, riverAt } = v;
  const { ROW } = v.g;
  const a = riverAt(river, from);
  const b = riverAt(river, to);
  const edge = (r) => (side < 0 ? r.L : r.R);
  ctx.lineTo(edge(a), yOf(from));
  for (let i = Math.ceil(from / ROW); i * ROW < to; i++) {
    const r = riverAt(river, i * ROW);
    ctx.lineTo(edge(r), yOf(i * ROW));
  }
  ctx.lineTo(edge(b), yOf(to));
}

// One look's run of river between two distances: the banks with their
// bands, the water between them, its shore lines, then the islands.
function drawReach(ctx, v, from, to, look) {
  const { g, yOf, river, riverAt } = v;
  const L = lookOf(look);
  const top = yOf(to);
  const bottom = yOf(from);
  ctx.fillStyle = L.land;
  ctx.fillRect(0, top, g.FIELD_W, bottom - top);
  ctx.fillStyle = L.alt;
  for (let k = Math.floor(from / 12); k * 12 < to; k++) {
    if (k % 2) continue;
    const y0 = Math.max(top, yOf(k * 12 + 12));
    const y1 = Math.min(bottom, yOf(k * 12));
    if (y1 > y0) ctx.fillRect(0, y0, g.FIELD_W, y1 - y0);
  }
  // The water: up the left bank, back down the right.
  ctx.beginPath();
  ctx.moveTo(riverAt(river, from).L, bottom);
  riverPoly(ctx, v, from, to, -1);
  const back = [];
  for (let i = Math.ceil(from / g.ROW); i * g.ROW < to; i++) back.push(i * g.ROW);
  ctx.lineTo(riverAt(river, to).R, top);
  for (let k = back.length - 1; k >= 0; k--) ctx.lineTo(riverAt(river, back[k]).R, yOf(back[k]));
  ctx.lineTo(riverAt(river, from).R, bottom);
  ctx.closePath();
  ctx.fillStyle = L.water;
  ctx.fill();
  // The shore lines.
  ctx.strokeStyle = L.shore;
  ctx.lineWidth = 0.7;
  ctx.lineJoin = "round";
  for (const side of [-1, 1]) {
    ctx.beginPath();
    const a = riverAt(river, from);
    ctx.moveTo(side < 0 ? a.L : a.R, bottom);
    riverPoly(ctx, v, from, to, side);
    ctx.stroke();
  }
  drawIslands(ctx, v, from, to, L);
  drawFlow(ctx, v, from, to, L);
  drawTrees(ctx, v, from, to, L);
}

// Each island as a run of rows wide enough to be one, pointed at both ends.
function drawIslands(ctx, v, from, to, L) {
  const { g, river, yOf, riverAt } = v;
  const i0 = Math.max(0, Math.floor(from / g.ROW));
  const i1 = Math.min(river.rows - 1, Math.ceil(to / g.ROW));
  let i = i0;
  while (i <= i1) {
    if (river.IW[i] < 1) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= i1 && river.IW[j + 1] >= 1) j++;
    const lo = Math.max(from, (i - 1) * g.ROW);
    const hi = Math.min(to, (j + 1) * g.ROW);
    ctx.beginPath();
    ctx.moveTo(riverAt(river, lo).c, yOf(lo));
    for (let k = i; k <= j; k++) {
      const r = riverAt(river, k * g.ROW);
      ctx.lineTo(r.IL, yOf(k * g.ROW));
    }
    ctx.lineTo(riverAt(river, hi).c, yOf(hi));
    for (let k = j; k >= i; k--) {
      const r = riverAt(river, k * g.ROW);
      ctx.lineTo(r.IR, yOf(k * g.ROW));
    }
    ctx.closePath();
    ctx.fillStyle = L.land;
    ctx.fill();
    ctx.strokeStyle = L.shore;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    i = j + 1;
  }
}

// Streaks on the water, carried down the river a little quicker than the
// banks go by, so the water seems to flow.
const FLOW = 9;
const FLOW_SPAN = 120;
function drawFlow(ctx, v, from, to, L) {
  const { river, yOf, riverAt } = v;
  const shift = (v.clock / 1000) * FLOW;
  ctx.strokeStyle = L.foam;
  ctx.lineWidth = 0.35;
  ctx.lineCap = "round";
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  for (let k = 0; k < 26; k++) {
    const base = (hash(k, 7) % (FLOW_SPAN * 10)) / 10 - shift;
    const m = Math.ceil((from - base) / FLOW_SPAN);
    for (let d = base + m * FLOW_SPAN; d < to; d += FLOW_SPAN) {
      const r = riverAt(river, d);
      const x = r.L + 1 + ((hash(k, 11) % 1000) / 1000) * (r.w - 2);
      if (r.island && x > r.IL - 0.5 && x < r.IR + 0.5) continue;
      ctx.moveTo(x, yOf(d));
      ctx.lineTo(x, yOf(d) + 2.2);
    }
  }
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Trees (rocks in the canyon) on the banks and the wider islands.
function drawTrees(ctx, v, from, to, L) {
  const { g, river, yOf } = v;
  const i0 = Math.max(0, Math.ceil(from / g.ROW));
  const i1 = Math.min(river.rows - 1, Math.floor(to / g.ROW));
  const tree = (x, y, s) => {
    circle(ctx, x + 0.3, y + 0.4, s);
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fill();
    circle(ctx, x, y, s);
    ctx.fillStyle = L.tree;
    ctx.fill();
    circle(ctx, x - s * 0.3, y - s * 0.3, s * 0.55);
    ctx.fillStyle = L.leaf;
    ctx.fill();
  };
  for (let i = i0; i <= i1; i++) {
    const h = hash(i, 3);
    if (h % 4 !== 0) continue;
    const c = river.C[i];
    const w = river.Wd[i];
    const y = yOf(i * g.ROW);
    const s = 1.1 + (h % 5) * 0.2;
    const lx = c - w / 2 - 2.2 - (h % 7) * 0.8;
    const rx = c + w / 2 + 2.2 + ((h >>> 4) % 7) * 0.8;
    if (h % 8 === 0 && lx > 0.5) tree(lx, y, s);
    if ((h >>> 3) % 2 === 0 && rx < g.FIELD_W - 0.5) tree(rx, y, s);
    if (river.IW[i] >= 7 && (h >>> 6) % 3 === 0) tree(c, y, Math.min(s, river.IW[i] / 4));
  }
}

// The river from the bottom of the view to its top, one look at a time.
function drawRiver(ctx, v) {
  const { g, river } = v;
  const from = Math.max(0, v.cam - 2);
  const to = v.cam + g.FIELD_H + 2;
  let d = from;
  while (d < to) {
    const k = stretchAtD(river, d);
    const end = Math.min(to, k < river.built ? river.damAt[k] + 6 : to);
    drawReach(ctx, v, d, Math.max(end, d + 0.5), v.stretchFor(k).look);
    d = Math.max(end, d + 0.5);
  }
  if (v.cam < 2) {
    ctx.fillStyle = lookOf("meadow").land;
    ctx.fillRect(0, v.yOf(0), g.FIELD_W, g.FIELD_H);
  }
}

// The dams in view: the one ahead, whole and cracking as it is hit, with
// hazard stripes along its top; those behind, broken open.
function drawDams(ctx, v) {
  const { g, river, round, yOf, riverAt } = v;
  for (let k = Math.max(1, round.stretch - 1); k <= round.stretch; k++) {
    const d = river.damAt[k];
    const y = yOf(d);
    if (y < -6 || y > g.FIELD_H + 6) continue;
    const r = riverAt(river, d);
    const x0 = r.L - 3;
    const x1 = r.R + 3;
    const t = g.DAM_T;
    const whole = k === round.stretch && round.dam.hp > 0;
    if (!whole) {
      ctx.fillStyle = "#8f897f";
      for (const [x, s] of [[x0 + 1.4, 1.6], [x0 + 3.6, 1.1], [x1 - 1.4, 1.6], [x1 - 3.8, 1.2], [x0 + 5.6, 0.7], [x1 - 6, 0.8]]) {
        roundRect(ctx, x - s, y - s * 0.8, s * 2, s * 1.6, s * 0.4);
        ctx.fill();
      }
      ctx.strokeStyle = "#e6f4ff";
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      for (let x = r.L + 2; x < r.R - 2; x += 1.6) {
        ctx.moveTo(x, y + 0.4 + Math.sin(v.clock / 120 + x) * 0.3);
        ctx.lineTo(x + 0.8, y + 1.2);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }
    const dam = round.dam;
    // Water piled up against it, a darker band above.
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(r.L, y - t / 2 - 2, r.R - r.L, 2);
    ctx.fillStyle = dam.flash > 0 ? "#ffffff" : "#b3ada3";
    ctx.fillRect(x0, y - t / 2, x1 - x0, t);
    ctx.fillStyle = "#8f897f";
    ctx.fillRect(x0, y + t / 2 - 0.8, x1 - x0, 0.8);
    for (let x = x0, n = 0; x < x1; x += 1.6, n++) {
      ctx.fillStyle = n % 2 ? "#1d1a17" : GOLD;
      ctx.fillRect(x, y - t / 2, Math.min(1.6, x1 - x), 0.7);
    }
    // A crack for every share of it knocked out.
    const cracks = Math.ceil((1 - dam.hp / dam.max) * 7);
    ctx.strokeStyle = "#3a3632";
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    for (let c = 0; c < cracks; c++) {
      const cx = r.L + 2 + ((hash(k, c) % 1000) / 1000) * (r.R - r.L - 4);
      ctx.moveTo(cx, y - t / 2 + 0.7);
      ctx.lineTo(cx + 0.6, y - 0.2);
      ctx.lineTo(cx - 0.3, y + 0.4);
      ctx.lineTo(cx + 0.4, y + t / 2);
    }
    ctx.stroke();
    // A trickle through the cracks once it is close to going.
    if (dam.hp / dam.max < 0.5) {
      ctx.fillStyle = "#cfe8ff";
      ctx.globalAlpha = 0.6;
      for (let c = 0; c < cracks; c++) {
        const cx = r.L + 2 + ((hash(k, c) % 1000) / 1000) * (r.R - r.L - 4);
        ctx.fillRect(cx - 0.2, y + t / 2, 0.5, 1.2 + ((v.clock / 90 + c) % 3) * 0.4);
      }
      ctx.globalAlpha = 1;
    }
  }
}

/* ------------------------------------------------------------- pickups */

function drawBuoys(ctx, v) {
  for (const b of v.round.buoys) {
    const y = v.yOf(b.d);
    if (y < -3 || y > v.g.FIELD_H + 3) continue;
    const bob = Math.sin(v.clock / 260 + b.x) * 0.2;
    const glow = 0.5 + 0.5 * Math.sin(v.clock / 180 + b.d);
    circle(ctx, b.x, y, 2 + glow * 0.5);
    ctx.fillStyle = CHARGE;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ellipse(ctx, b.x, y + 0.5, 1.5, 0.7);
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fill();
    roundRect(ctx, b.x - 1.1, y - 1.3 + bob, 2.2, 2.4, 0.6);
    ctx.fillStyle = CHARGE;
    ctx.fill();
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.22;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(b.x - 1.1, y - 0.3 + bob, 2.2, 0.4);
    // A bolt on its side.
    ctx.fillStyle = "#fff3a6";
    ctx.beginPath();
    ctx.moveTo(b.x + 0.2, y - 1.1 + bob);
    ctx.lineTo(b.x - 0.5, y - 0.1 + bob);
    ctx.lineTo(b.x, y - 0.1 + bob);
    ctx.lineTo(b.x - 0.3, y + 0.9 + bob);
    ctx.lineTo(b.x + 0.5, y - 0.4 + bob);
    ctx.lineTo(b.x, y - 0.4 + bob);
    ctx.closePath();
    ctx.fill();
  }
}

function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(0.2, s * 0.24);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "spread") {
    for (const a of [-0.5, 0, 0.5]) {
      ctx.moveTo(x, y + s * 0.7);
      ctx.lineTo(x + Math.sin(a) * s * 0.9, y + s * 0.7 - Math.cos(a) * s * 1.3);
    }
    ctx.stroke();
  } else if (kind === "shield") {
    ctx.moveTo(x, y - s * 0.8);
    ctx.lineTo(x + s * 0.7, y - s * 0.5);
    ctx.lineTo(x + s * 0.6, y + s * 0.2);
    ctx.quadraticCurveTo(x + s * 0.4, y + s * 0.7, x, y + s * 0.9);
    ctx.quadraticCurveTo(x - s * 0.4, y + s * 0.7, x - s * 0.6, y + s * 0.2);
    ctx.lineTo(x - s * 0.7, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "magnet") {
    ctx.arc(x, y, s * 0.5, 0, Math.PI);
    ctx.moveTo(x - s * 0.5, y);
    ctx.lineTo(x - s * 0.5, y - s * 0.7);
    ctx.moveTo(x + s * 0.5, y);
    ctx.lineTo(x + s * 0.5, y - s * 0.7);
    ctx.stroke();
  } else {
    ctx.moveTo(x + s * 0.2, y - s);
    ctx.lineTo(x - s * 0.55, y + s * 0.1);
    ctx.lineTo(x, y + s * 0.1);
    ctx.lineTo(x - s * 0.25, y + s);
    ctx.lineTo(x + s * 0.55, y - s * 0.2);
    ctx.lineTo(x, y - s * 0.2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCrates(ctx, v) {
  for (const c of v.round.crates) {
    const y = v.yOf(c.d);
    if (y < -3 || y > v.g.FIELD_H + 3) continue;
    const color = v.powers[c.kind].color;
    const s = 1.35 * (1 + 0.08 * Math.sin(v.clock / 140 + c.x));
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    roundRect(ctx, c.x - s, y - s, s * 2, s * 2, s * 0.4);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.22;
    ctx.stroke();
    glyph(ctx, c.kind, c.x, y, s * 0.62);
  }
}

/* ---------------------------------------------------------------- foes */

function eyes(ctx, x, y, s, look) {
  for (const side of [-1, 1]) {
    circle(ctx, x + side * s, y, s * 0.75);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    circle(ctx, x + side * s + look, y + s * 0.2, s * 0.38);
    ctx.fillStyle = DARK_INK;
    ctx.fill();
  }
}

// A boat seen from above, its bow pointing down the river at you.
function hull(ctx, x, y, w, l, color) {
  ctx.beginPath();
  ctx.moveTo(x, y + l / 2);
  ctx.quadraticCurveTo(x + w / 2, y + l / 4, x + w / 2, y - l / 4);
  ctx.lineTo(x + w / 2 - 0.3, y - l / 2);
  ctx.lineTo(x - w / 2 + 0.3, y - l / 2);
  ctx.lineTo(x - w / 2, y - l / 4);
  ctx.quadraticCurveTo(x - w / 2, y + l / 4, x, y + l / 2);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = EDGE_DARK;
  ctx.lineWidth = 0.25;
  ctx.stroke();
}

function drawFoe(ctx, v, f) {
  const y = v.yOf(f.d);
  if (y < -5 || y > v.g.FIELD_H + 5) return;
  const spec = v.foes[f.kind];
  const color = f.flash > 0 ? "#ffffff" : spec.color;
  const look = Math.max(-0.25, Math.min(0.25, (v.round.ship.x - f.x) * 0.03));
  const { clock } = v;
  if (f.kind === "whirl") {
    ctx.strokeStyle = "#d5ecff";
    ctx.lineCap = "round";
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = 0.55 - k * 0.12;
      ctx.lineWidth = 0.5 - k * 0.1;
      ctx.beginPath();
      const spin = -clock / 300 + (k * TAU) / 3;
      for (let s = 0; s <= 24; s++) {
        const a = spin + s * 0.32;
        const r = 0.6 + s * 0.24;
        const px = f.x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r * 0.85;
        if (s) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    circle(ctx, f.x, y, 0.8);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fill();
    return;
  }
  if (f.kind === "skiff") {
    ellipse(ctx, f.x, y - 2.6, 1, 1.6);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fill();
    hull(ctx, f.x, y, 3.4, 4.6, color);
    roundRect(ctx, f.x - 1, y - 1.6, 2, 1.8, 0.4);
    ctx.fillStyle = "#f4f1ea";
    ctx.fill();
    eyes(ctx, f.x, y + 0.9, 0.45, look);
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(f.x + 0.9, y - 1.6);
    ctx.lineTo(f.x + 0.9, y - 3);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillRect(f.x + 0.9, y - 3, 1, 0.6);
    return;
  }
  if (f.kind === "darter") {
    ellipse(ctx, f.x, y - 2.8, 0.8, 1.8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(f.x, y + 2.6);
    ctx.lineTo(f.x + 1.6, y - 1.4);
    ctx.lineTo(f.x + 0.6, y - 2.2);
    ctx.lineTo(f.x - 0.6, y - 2.2);
    ctx.lineTo(f.x - 1.6, y - 1.4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    eyes(ctx, f.x, y + 0.2, 0.4, look);
    return;
  }
  if (f.kind === "mine") {
    const bob = 1 + 0.06 * Math.sin(clock / 300 + f.d);
    ctx.strokeStyle = "#3a3e48";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8 + 0.2;
      ctx.moveTo(f.x + Math.cos(a) * 1.1 * bob, y + Math.sin(a) * 1.1 * bob);
      ctx.lineTo(f.x + Math.cos(a) * 1.75 * bob, y + Math.sin(a) * 1.75 * bob);
    }
    ctx.stroke();
    circle(ctx, f.x, y, 1.25 * bob);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.2;
    ctx.stroke();
    circle(ctx, f.x - 0.35, y - 0.35, 0.35);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fill();
    circle(ctx, f.x, y, 0.32);
    ctx.fillStyle = Math.floor(clock / 400 + f.d) % 2 ? DANGER : "#5a1a12";
    ctx.fill();
    return;
  }
  if (f.kind === "sentry") {
    const ship = v.round.ship;
    const a = Math.atan2(v.yOf(ship.d) - y, ship.x - f.x);
    circle(ctx, f.x, y, 1.9);
    ctx.fillStyle = "#6d6a66";
    ctx.fill();
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.22;
    ctx.stroke();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(f.x, y);
    ctx.lineTo(f.x + Math.cos(a) * 2.4, y + Math.sin(a) * 2.4);
    ctx.stroke();
    circle(ctx, f.x, y, 1.2);
    ctx.fillStyle = color;
    ctx.fill();
    eyes(ctx, f.x, y, 0.32, look);
    return;
  }
  // A gull drone: its shadow on the water below, then wings that flap.
  const dir = f.vx >= 0 ? 1 : -1;
  const flap = Math.sin(clock / 70 + f.d) * 0.8;
  ellipse(ctx, f.x + 1.2, y + 1.8, 1.4, 0.6);
  ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.55;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(f.x - 2.4, y - 0.6 + flap);
  ctx.quadraticCurveTo(f.x - 1, y - 1.2, f.x, y);
  ctx.quadraticCurveTo(f.x + 1, y - 1.2, f.x + 2.4, y - 0.6 + flap);
  ctx.stroke();
  ellipse(ctx, f.x, y, 1.1, 0.6);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = EDGE_DARK;
  ctx.lineWidth = 0.18;
  ctx.stroke();
  ctx.fillStyle = "#ff8a1f";
  ctx.beginPath();
  ctx.moveTo(f.x + dir * 1.1, y - 0.2);
  ctx.lineTo(f.x + dir * 1.8, y);
  ctx.lineTo(f.x + dir * 1.1, y + 0.2);
  ctx.closePath();
  ctx.fill();
  circle(ctx, f.x + dir * 0.5, y - 0.15, 0.18);
  ctx.fillStyle = DARK_INK;
  ctx.fill();
}

function drawBoss(ctx, v) {
  const boss = v.round.boss;
  if (!boss) return;
  const spec = v.bosses[boss.kind];
  const x = boss.x;
  const y = v.yOf(boss.d);
  const color = boss.flash > 0 ? "#ffffff" : spec.color;
  const look = Math.max(-0.4, Math.min(0.4, (v.round.ship.x - x) * 0.03));
  ellipse(ctx, x, y - 6, 3, 3.5);
  ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
  ctx.fill();
  if (boss.kind === "leviathan") {
    // A great serpent: humps trailing up the river, then its head.
    for (let k = 3; k >= 1; k--) {
      const hx = x + Math.sin(v.clock / 400 + k) * 2;
      ellipse(ctx, hx, y - 3 - k * 3, 2.4 - k * 0.3, 1.4);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = EDGE_DARK;
      ctx.lineWidth = 0.25;
      ctx.stroke();
    }
    ellipse(ctx, x, y, 4.2, 3.6);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1d6a3f";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 2.6, y - 2.6);
      ctx.lineTo(x + s * 4.2, y - 4.4);
      ctx.lineTo(x + s * 3.4, y - 2);
      ctx.closePath();
      ctx.fill();
    }
    eyes(ctx, x, y + 0.2, 0.9, look);
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.arc(x, y + 1.6, 1.4, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
    return;
  }
  hull(ctx, x, y, 11, 10, color);
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  roundRect(ctx, x - 3.6, y - 4, 7.2, 5, 1);
  ctx.fill();
  if (boss.kind === "dredger") {
    // The bucket arm over the bow.
    ctx.strokeStyle = "#4a3a2a";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 2.5, y - 1);
    ctx.lineTo(x - 1, y + 4.5);
    ctx.stroke();
    roundRect(ctx, x - 2.2, y + 4, 2.4, 1.6, 0.4);
    ctx.fillStyle = "#6d6a66";
    ctx.fill();
  } else {
    // Rivets along the armor.
    ctx.fillStyle = "#4a4e57";
    for (let k = -2; k <= 2; k++) {
      circle(ctx, x + k * 1.8, y - 4.4, 0.25);
      ctx.fill();
      circle(ctx, x + k * 1.6, y + 2.2, 0.25);
      ctx.fill();
    }
  }
  for (const s of [-1, 1]) {
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + s * 3, y + 1);
    ctx.lineTo(x + s * 3.3, y + 3.2);
    ctx.stroke();
  }
  roundRect(ctx, x - 2.4, y - 2.8, 4.8, 3, 0.6);
  ctx.fillStyle = "#f4f1ea";
  ctx.fill();
  eyes(ctx, x, y - 1.3, 0.7, look);
}

/* ------------------------------------------------------- the skimmer */

// Planny's jet-skimmer in your highlight, Planny riding it with his star eye
// in your highlight too: hands on the bars, both up once a dam goes, his
// box bobbing on the water with the star spinning while he waits to go again.
function drawSkimmer(ctx, v) {
  const { round, colors, clock } = v;
  const ship = round.ship;
  const x = ship.x;
  const y = v.yOf(ship.d);
  const S = 1.05;
  if (!ship.alive) {
    if (round.phase !== "crash" && !v.lost) return;
    const p = round.phase === "crash" ? 1 - round.phaseMs / v.g.CRASH_MS : 1;
    ctx.globalAlpha = v.lost ? 0.85 : Math.max(0.2, 1 - p * 0.6);
    const bob = Math.sin(clock / 200) * 0.3;
    roundRect(ctx, x - S, y - S + bob, S * 2, S * 2, S * 0.35);
    ctx.fillStyle = colors.board;
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 0.22;
    ctx.stroke();
    star(ctx, x, y - S * 0.22 + bob, S * 0.58, S * 0.25, clock / 60);
    ctx.fillStyle = colors.you;
    ctx.fill();
    ctx.strokeStyle = colors.ink;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(x, y + S * 0.5 + bob, S * 0.17, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  let alpha = 1;
  if (ship.invuln > 0 && Math.floor(clock / 90) % 2 === 0) alpha = 0.45;
  ctx.globalAlpha = alpha;
  const { SHIP_W: w, SHIP_L: l } = v.g;
  // The wake: two lines of foam spreading out behind, longer the faster.
  const len = 2 + ship.v * 0.18;
  ctx.strokeStyle = "#ffffff";
  ctx.lineCap = "round";
  for (let k = 0; k < 3; k++) {
    ctx.globalAlpha = alpha * (0.55 - k * 0.15);
    ctx.lineWidth = 0.6 - k * 0.15;
    ctx.beginPath();
    for (const s of [-1, 1]) {
      ctx.moveTo(x + s * (w / 2 - 0.4), y + l / 2 - 0.3);
      ctx.lineTo(x + s * (w / 2 + len * 0.35 + k * 0.6), y + l / 2 + len - k * 0.4 + Math.sin(clock / 60 + s + k) * 0.25);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = alpha;
  // The hull, nose up the river.
  ctx.beginPath();
  ctx.moveTo(x, y - l / 2 - 0.4);
  ctx.quadraticCurveTo(x + w / 2, y - l / 4, x + w / 2, y + l / 4);
  ctx.lineTo(x + w / 2 - 0.4, y + l / 2);
  ctx.lineTo(x - w / 2 + 0.4, y + l / 2);
  ctx.lineTo(x - w / 2, y + l / 4);
  ctx.quadraticCurveTo(x - w / 2, y - l / 4, x, y - l / 2 - 0.4);
  ctx.closePath();
  // A white trim under a dark edge, so a blue highlight still stands out on
  // blue water.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.9;
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.strokeStyle = EDGE_DARK;
  ctx.lineWidth = 0.3;
  ctx.stroke();
  // Jets at the back, flickering.
  ctx.fillStyle = "#ff8a1f";
  const flick = 0.6 + 0.4 * Math.sin(clock / 30);
  for (const s of [-1, 1]) ctx.fillRect(x + s * 0.9 - 0.35, y + l / 2, 0.7, 0.5 + flick * (ship.v / 40));
  // Planny: arms to the bars (or up, cheering a dam), his box, his star.
  const ink = inkOn(colors.you);
  const by = 0.6;
  const cheer = v.cheer;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.28;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (cheer) {
    const wave = Math.sin(clock / 90) * 0.35;
    ctx.moveTo(x - S, y + by - 0.2);
    ctx.lineTo(x - S - 1, y + by - 2.1 + wave);
    ctx.moveTo(x + S, y + by - 0.2);
    ctx.lineTo(x + S + 1, y + by - 2.1 - wave);
  } else {
    ctx.moveTo(x - S, y + by);
    ctx.lineTo(x - 0.8, y + by - 1.9);
    ctx.moveTo(x + S, y + by);
    ctx.lineTo(x + 0.8, y + by - 1.9);
    ctx.moveTo(x - 1.1, y + by - 1.9);
    ctx.lineTo(x + 1.1, y + by - 1.9);
  }
  ctx.stroke();
  roundRect(ctx, x - S, y + by - S, S * 2, S * 2, S * 0.35);
  ctx.fillStyle = colors.board;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.2;
  ctx.stroke();
  star(ctx, x, y + by - S * 0.22, S * 0.58, S * 0.25);
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.16;
  ctx.beginPath();
  ctx.arc(x, y + by + S * 0.3, S * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  for (let i = 0; i < round.shield; i++) {
    ctx.strokeStyle = v.powers.shield.color;
    ctx.globalAlpha = alpha * (0.55 + 0.35 * Math.sin(clock / 110 + i));
    ctx.lineWidth = 0.35;
    circle(ctx, x, y, 3 + i * 0.7);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawShots(ctx, v) {
  const { round, colors, yOf } = v;
  ctx.lineCap = "round";
  ctx.strokeStyle = EDGE_DARK;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  for (const s of round.shots) {
    ctx.moveTo(s.x, yOf(s.d));
    ctx.lineTo(s.x - s.vx * 0.015, yOf(s.d) + 1.4);
  }
  ctx.stroke();
  ctx.strokeStyle = colors.you;
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.18;
  ctx.stroke();
  for (const b of round.bolts) {
    const y = yOf(b.d);
    circle(ctx, b.x, y, 0.75);
    ctx.fillStyle = EDGE_DARK;
    ctx.fill();
    circle(ctx, b.x, y, 0.55);
    ctx.fillStyle = DANGER;
    ctx.fill();
    circle(ctx, b.x, y, 0.22);
    ctx.fillStyle = "#fff0d8";
    ctx.fill();
  }
}

/* ------------------------------------------------------------- the pills */

const pillWidth = (h, text) => h * 0.7 + text.length * h * 0.42;

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${h * 0.62}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = pillWidth(h, text);
  drawPill(ctx, x, y, w, h, text, color, fill, y + h * 0.54);
  return w;
}

// Where the pills go, `h` units tall in a strip `stripH` tall on a board `W`
// wide: the stretch, lives, the shield and powers held and the combo, from
// the left. A pill that would run off the board starts a row below, and the
// rows sit in the strip's middle.
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

function layPills(h, W, lives, hud, stripH) {
  const gap = h * 0.3;
  const edge = h * 0.4;
  const y0 = h * 0.35;
  const out = [];
  let x = edge;
  let y = y0;
  const put = (text, color, fill = 1) => {
    const w = pillWidth(h, text);
    if (x > edge && x + w > W - edge) {
      x = edge;
      y += h + gap;
    }
    out.push({ x, y, w, text, color, fill });
    x += w + gap;
  };
  put(hud.stretch, hud.color);
  put(livesText(lives), LIVES);
  for (const e of hud.effects) put(e.text, e.color, e.fill);
  if (hud.combo > 1) put(`x${hud.combo} COMBO`, GOLD, hud.comboFill);
  const drop = Math.max(0, (stripH - (y + h) - y0) / 2);
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

// The battery gauge beside the field: full at the top, green, then amber,
// then red and blinking under the low mark, with a bolt at its head.
function drawBar(ctx, v) {
  const { g, colors } = v;
  const x = g.PAD + g.FIELD_W + g.GAP;
  const y = g.HUD_H;
  const h = g.FIELD_H;
  roundRect(ctx, x, y, g.BAR_W, h, g.BAR_W / 2);
  ctx.fillStyle = colors.line;
  ctx.fill();
  const playing = v.state === "running" || v.state === "paused";
  const p = playing ? Math.max(0, Math.min(1, v.hud.battery)) : 1;
  const inner = h - 8;
  const top = y + 6 + inner * (1 - p);
  const color = p > 0.5 ? CHARGE : p > g.LOW_BATTERY ? GOLD : DANGER;
  const blink = playing && v.hud.low && Math.floor(v.clock / 220) % 2 === 0;
  if (p > 0) {
    roundRect(ctx, x + 1, top, g.BAR_W - 2, y + h - 2 - top, (g.BAR_W - 2) / 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = blink ? 0.35 : 1;
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  // The low mark.
  ctx.fillStyle = DARK_INK;
  ctx.fillRect(x + 0.6, y + 6 + inner * (1 - g.LOW_BATTERY) - 0.15, g.BAR_W - 1.2, 0.3);
  const bx = x + g.BAR_W / 2;
  const by = y + 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(bx + 0.4, by - 2);
  ctx.lineTo(bx - 1.1, by + 0.2);
  ctx.lineTo(bx, by + 0.2);
  ctx.lineTo(bx - 0.5, by + 2);
  ctx.lineTo(bx + 1.1, by - 0.5);
  ctx.lineTo(bx, by - 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = EDGE_DARK;
  ctx.lineWidth = 0.2;
  ctx.stroke();
}

// The boss's health along the top of the field while it fights.
function drawBossBar(ctx, v) {
  const boss = v.round.boss;
  if (!boss || boss.enter > 0) return;
  const { g } = v;
  const bw = g.FIELD_W * 0.6;
  const bx = (g.FIELD_W - bw) / 2;
  ctx.fillStyle = SHADE;
  roundRect(ctx, bx, 1.4, bw, 1.4, 0.7);
  ctx.fill();
  ctx.fillStyle = v.bosses[boss.kind].color;
  roundRect(ctx, bx, 1.4, bw * Math.max(0, boss.hp / boss.max), 1.4, 0.7);
  ctx.fill();
  label(ctx, v.bosses[boss.kind].name.toUpperCase(), g.FIELD_W / 2, 4.6, 2, "#ffffff");
}

// A banner is a light strip across the field, in its top part, well above
// your skimmer.
function drawBanner(ctx, v, b) {
  const { g } = v;
  const w = g.FIELD_W;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = Math.min(g.FIELD_H - 7, Math.max(7, b.y));
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - 7, w, 14);
  if (b.tag) label(ctx, b.tag, w / 2, y - 4.6, 2.1, GOLD, "center", w - 4);
  label(ctx, b.title, w / 2, y - 0.4, 4.2 * pop, b.color, "center", w - 4);
  if (b.sub) label(ctx, b.sub, w / 2, y + 4.2, 2.2, "#ffffff", "center", w - 4);
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip: a line or more, each short enough to
// draw at full width, then a dot per named stretch, lit in its color for
// each dam blasted. The ready screen's sits at the top of the field, clear
// of your skimmer; the over screen's along the bottom, with the round's
// score, big, above it.
export const TALLY_TITLE = 2.4;
export const TALLY_LINE = 1.9;
const TALLY_STEP = 3.6;
export const tallyHeight = (lines) => 3.4 + lines * TALLY_STEP + 3;

function drawTally(ctx, v, lines) {
  const { g } = v;
  const h = tallyHeight(lines.length);
  const top = v.tallyTop ? 2 : g.FIELD_H - h;
  if (v.big) {
    ctx.fillStyle = BANNER_SHADE;
    ctx.fillRect(0, top - 12, g.FIELD_W, 11.6);
    label(ctx, "SCORE", g.FIELD_W / 2, top - 10.2, 2, "#ffffff");
    label(ctx, v.big, g.FIELD_W / 2, top - 5, 7, GOLD);
  }
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, g.FIELD_W, h);
  lines.forEach((text, i) => label(ctx, text, g.FIELD_W / 2, top + 3 + i * TALLY_STEP, i ? TALLY_LINE : TALLY_TITLE, i ? "#ffffff" : GOLD, "center", g.FIELD_W - 4));
  const n = Math.max(v.maxDots, Math.min(12, v.furthest));
  const r = 1.1;
  const step = r * 3.4;
  const x = g.FIELD_W / 2 - ((n - 1) * step) / 2;
  const y = top + h - 2.6;
  for (let k = 0; k < n; k++) {
    circle(ctx, x + k * step, y, r);
    if (k < v.furthest) {
      ctx.fillStyle = lookColor(v.stretchFor(k + 1).look);
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
}

/* --------------------------------------------------------------- scene */

// The whole frame. `v` is the view rapids.js refills: the round and its
// river, the board's geometry `g`, the scale `u`, the colors, the effects,
// the state, the pill numbers and the lines for the start and end screens.
export function drawScene(ctx, v) {
  const { g, round } = v;
  ctx.save();
  ctx.scale(v.u, v.u);
  ctx.fillStyle = v.colors.board;
  ctx.fillRect(0, 0, g.W, g.H);
  drawHud(ctx, v);
  drawBar(ctx, v);
  ctx.translate(g.PAD, g.HUD_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, g.FIELD_W, g.FIELD_H);
  if (typeof ctx.clip === "function") ctx.clip();
  if (v.shake) ctx.translate(v.shake.x, v.shake.y);
  drawRiver(ctx, v);
  drawDams(ctx, v);
  for (const f of round.foes) if (f.kind === "whirl") drawFoe(ctx, v, f);
  drawBuoys(ctx, v);
  drawCrates(ctx, v);
  for (const f of round.foes) if (f.kind !== "whirl" && f.kind !== "gull") drawFoe(ctx, v, f);
  drawBoss(ctx, v);
  drawSkimmer(ctx, v);
  for (const f of round.foes) if (f.kind === "gull") drawFoe(ctx, v, f);
  drawShots(ctx, v);
  for (const p of v.fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, v.yOf(p.d) - p.size / 2, p.size, p.size);
  }
  for (const r of v.fx.rings) {
    const p = 1 - r.life / r.max;
    ctx.globalAlpha = (1 - p) * 0.8;
    circle(ctx, r.x, v.yOf(r.d), r.r0 + p * r.grow);
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.5 * (1 - p) + 0.45;
    ctx.stroke();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 0.5 * (1 - p) + 0.15;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (v.shake) ctx.translate(-v.shake.x, -v.shake.y);
  for (const f of v.fx.floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
    const at = labelSpot(f.text, f.x, v.yOf(f.d) - f.rise, f.size, g.FIELD_W, g.FIELD_H);
    label(ctx, f.text, at.x, at.y, f.size, f.color, "center", at.max);
  }
  ctx.globalAlpha = 1;
  // The combo, big, beside your skimmer while it climbs.
  if (v.combo && v.state === "running" && round.ship.alive) {
    const ship = round.ship;
    const p = 1 - v.combo.life / v.combo.max;
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    const text = `x${v.combo.n}`;
    const size = 4.5 * (p < 0.15 ? 0.7 + p * 2 : 1);
    const at = labelSpot(text, ship.x + (ship.x < g.FIELD_W / 2 ? 8 : -8), v.yOf(ship.d) - 3, size, g.FIELD_W, g.FIELD_H);
    label(ctx, text, at.x, at.y, size, GOLD, "center", at.max);
    ctx.globalAlpha = 1;
  }
  if (v.flash) {
    ctx.globalAlpha = 0.24 * (v.flash.life / v.flash.max);
    ctx.fillStyle = v.flash.color;
    ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
    ctx.globalAlpha = 1;
  }
  drawBossBar(ctx, v);
  if (v.state === "running" && v.banner) drawBanner(ctx, v, v.banner);
  if (v.tally) drawTally(ctx, v, v.tally);
  ctx.restore();
  ctx.translate(-g.PAD, -g.HUD_H);
  drawPills(ctx, v);
  ctx.restore();
}
