// Plan2Code Web Console - Bounce Road's drawing: the road a chunk at a time, the layers over it (from bounce-scenery.js), the cars (from bounce-cars.js, Planny's convertible and every rival's), jumps and their landing rings, the pills, the stage bar, the banners and the start and end screens, from a view bounce.js refills.
//
// Drawing only: no rules and no state of its own beyond the chunks of road
// it keeps. bounce.js hands drawScene() one view object of the moment (the
// round, the road, the board's geometry, the effects running, the colors
// readColors() took from the page), so the rules never touch a canvas and
// this file never decides anything. Everything is drawn in field units under
// one scale. Anything that moves on its own follows the view's clock, never
// Math.random(), so a paused game's frame stays still.
//
// The yard, the road and its things keep their own fixed colors, the same
// in light and dark, and the road is drawn a chunk of rows at a time into
// layers kept off screen, which every frame copies. The floating words and
// the banners are light text with a dark edge, which reads on any yard, and
// the pills are opaque dark with text that reads on them at 4.5:1
// (pills.js). The strip the pills sit on, the stage bar's frame and
// Planny's car (in your highlight, his box in the page's panel color)
// follow the page.

import { drawPill, LIVES, livesText } from "./pills.js";
import { drawCarBody, drawCarShadow } from "./bounce-cars.js";
import { DARK_INK, LIGHT_INK, LOOKS, better, circle, contrast, drawBlocks, drawFireflies, drawHazardsHigh, drawHazardsLow, drawItems, drawNight, drawPads, drawRow, drawSigns, drawStars, drawTimed, ellipse, luminance, lookOf, roundRect, star, stageColor } from "./bounce-scenery.js";

export { DARK_INK, LIGHT_INK, LOOKS, contrast, luminance, lookOf, stageColor };

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
const EDGE_DARK = "rgba(0, 0, 0, 0.75)";

// The ink for what is drawn straight over the road (a landing ring's edge,
// the Monster's lives): whichever of a dark and a light ink stands out more
// from the road and a bridge's planks.
const LIMBS = Object.freeze(Object.fromEntries(Object.entries(LOOKS).map(([k, t]) => [k, better(t.road)])));
export const limbInk = (id) => LIMBS[id] || DARK_INK;

// The same choice for any "#rrggbb" (or rgb()) color, for what is drawn on
// Planny's car, which is in your highlight.
const INK_ON = new Map();
export function inkOn(color) {
  if (INK_ON.has(color)) return INK_ON.get(color);
  let hex = null;
  const c = String(color || "").trim();
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) hex = c;
  else if ((m = /^#([0-9a-f]{3})$/i.exec(c))) hex = "#" + [...m[1]].map((h) => h + h).join("");
  else if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i.exec(c))) hex = "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("");
  const ink = hex ? better(hex) : DARK_INK;
  INK_ON.set(color, ink);
  return ink;
}

// Text with a dark edge, so it reads on any yard in either theme. `max`,
// when given, squeezes a long line to fit that many units.
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

/* ------------------------------------------------------------- the road */

// The road a chunk at a time: CHUNK_ROWS rows drawn off screen once per
// road and scale, a few kept, and copied each frame. Null where no second
// canvas can be made (as in Node), or the road is not built that far yet:
// the frame then draws those rows itself.
export const CHUNK_ROWS = 24;
const KEEP_CHUNKS = 6;
const chunks = { key: "", map: new Map() };

function chunkLayer(ctx, v, n) {
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!m || !(m.a > 0)) return null;
  const a = m.a;
  const key = `${v.road.id}:${a}`;
  if (chunks.key !== key) {
    chunks.key = key;
    chunks.map.clear();
  }
  if (chunks.map.has(n)) return chunks.map.get(n);
  if ((n + 1) * CHUNK_ROWS > v.road.rows) return null;
  const len = CHUNK_ROWS * v.g.ROW;
  try {
    const w = Math.ceil(v.g.FIELD_W * a);
    const h = Math.ceil(len * a);
    let layer = null;
    if (typeof OffscreenCanvas === "function") layer = new OffscreenCanvas(w, h);
    else if (typeof document !== "undefined") layer = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const off = layer && layer.getContext("2d");
    if (!off) return null;
    off.setTransform(a, 0, 0, a, 0, 0);
    for (let pass = 0; pass < 3; pass++) for (let r = 0; r < CHUNK_ROWS; r++) drawRow(off, v, n * CHUNK_ROWS + r, len - (r + 1) * v.g.ROW, pass);
    chunks.map.set(n, layer);
    if (chunks.map.size > KEEP_CHUNKS) chunks.map.delete(chunks.map.keys().next().value);
    return layer;
  } catch {
    return null;
  }
}

function drawRoad(ctx, v) {
  const { g } = v;
  const len = CHUNK_ROWS * g.ROW;
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  // Each chunk's top on a whole device pixel, so two chunks meet with no seam.
  const px = m && m.d > 0 ? m.d : 1;
  const f = m && m.d > 0 ? m.f : 0;
  for (let n = Math.floor(v.cam / len); n * len < v.cam + g.FIELD_H; n++) {
    const top = (Math.round(f + (g.FIELD_H - ((n + 1) * len - v.cam)) * px) - f) / px;
    const layer = chunkLayer(ctx, v, n);
    if (layer) {
      ctx.drawImage(layer, 0, top, g.FIELD_W, len);
      continue;
    }
    for (let pass = 0; pass < 3; pass++) {
      for (let r = 0; r < CHUNK_ROWS; r++) {
        const y = top + len - (r + 1) * g.ROW;
        if (y > g.FIELD_H || y + g.ROW < 0) continue;
        drawRow(ctx, v, n * CHUNK_ROWS + r, y, pass);
      }
    }
  }
}

/* ------------------------------------------------------------ the cars */

// How far through its tumble a car is, 0 to 1: your crash lasts CRASH_MS, a
// rival's OUT_MS.
const tumbleOf = (car, v) => (car.out > 0 && car.outKind ? 1 - Math.min(1, car.out / (car.id === 0 ? v.g.CRASH_MS : v.g.OUT_MS)) : 0);

// A car's look for bounce-cars.js: its style and the options of the moment.
function carOpts(car, v) {
  const night = v.night;
  const how = car.outKind;
  const o = {
    w: car.w,
    h: car.l,
    air: v.heightOf(car),
    tilt: Math.max(-1, Math.min(1, (car.vx + car.kx) / 40)),
    clock: v.clock,
    lights: night && car.out <= 0,
    squash: how === "flat" || how === "squash" ? 1 : 0,
  };
  if (car.id === 0) {
    const { colors } = v;
    const hurt = car.out > 0;
    o.color = colors.you;
    o.star = colors.you;
    o.face = colors.board;
    o.ink = colors.ink;
    o.arms = v.lost ? "down" : (car.air > 0 || v.cheer) && !hurt ? "up" : "wheel";
    o.boost = car.nitroMs > 0 || car.boostMs > 0;
    o.brake = !!v.round.input.down && !hurt;
    o.damage = hurt && how !== "squash" ? 0.75 : 0;
    return ["planny", o];
  }
  const spec = v.rivals[car.kind];
  o.color = v.colorOf(car);
  if (car.kind === "cop") {
    o.color = undefined;
    o.accent = undefined;
    if (car.mode === "chase") o.siren = v.clock;
  }
  if (car.kind === "racer") o.number = 1 + (car.id % 9);
  if (car.kind === "brick") o.brake = car.mode === "brake";
  if (car.kind === "monster") o.damage = 1 - car.hp / 5;
  if (car.kind === "racer" || car.kind === "nudge") o.boost = car.mode === "chase";
  return [spec.style, o];
}

// Where a car is drawn, or null off the board: its middle, its tumble's
// spin and fade.
function placeOf(car, v) {
  const y = v.yOf(car.d);
  if (y < -car.l * 2 - 8 || y > v.g.FIELD_H + car.l + 8) return null;
  const out = tumbleOf(car, v);
  const how = car.outKind;
  let spin = 0;
  let alpha = 1;
  let scale = 1;
  if (how === "flat") alpha = out > 0.6 ? Math.max(0, (1 - out) / 0.4) : 1;
  else if (how === "splash" || how === "fall") {
    scale = Math.max(0.25, 1 - out * (how === "fall" ? 0.8 : 0.45));
    alpha = car.id === 0 ? Math.max(0.45, 1 - out * 0.55) : Math.max(0, 1 - out);
  } else if (how === "tip" || how === "crash") {
    spin = out * (how === "crash" ? 5 : 2.6) * (car.kx >= 0 ? 1 : -1);
    alpha = car.id === 0 ? 1 : Math.max(0, 1 - out * 1.1);
  } else if (how === "gone") alpha = Math.max(0, 1 - out);
  if (car.id === 0 && car.ghostMs > 0 && Math.floor(v.clock / 90) % 2 === 0) alpha *= 0.45;
  return alpha > 0 ? { x: car.x, y, spin, alpha, scale } : null;
}

// A car where it is, in one of two passes: its shadow on the road (placed
// upright, only its footprint turned with a tumble), or its body (lifted
// for a jump by bounce-cars.js), turned and faded through its tumble once
// it is out: tipping, sinking, falling or flattened.
function drawCar(ctx, car, v, pass) {
  const at = placeOf(car, v);
  if (!at) return;
  const [style, o] = carOpts(car, v);
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * at.alpha;
  ctx.save();
  ctx.translate(at.x, at.y);
  if (pass !== "shadow" && at.spin && typeof ctx.rotate === "function") ctx.rotate(at.spin);
  if (at.scale !== 1) ctx.scale(at.scale, at.scale);
  if (pass === "shadow") {
    o.turn = at.spin;
    drawCarShadow(ctx, style, o);
  } else {
    o.shadow = false;
    drawCarBody(ctx, style, o);
  }
  ctx.restore();
  ctx.globalAlpha = was;
  if (car.kind === "monster" && pass !== "shadow" && car.out <= 0) drawBossLives(ctx, car, v, at);
}

// The Monster's lives: a pip each above it, lit while it has them.
function drawBossLives(ctx, car, v, at) {
  const n = 5;
  const y = at.y - car.l / 2 - 2.4 - v.heightOf(car) * 4;
  for (let k = 0; k < n; k++) {
    const x = at.x + (k - (n - 1) / 2) * 2.2;
    star(ctx, x, y, 0.95, 0.42);
    ctx.fillStyle = k < car.hp ? GOLD : "rgba(0, 0, 0, 0.4)";
    ctx.fill();
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.2;
    ctx.stroke();
  }
}

// Where a car in the air comes down (its speed holds up there): a ring on
// the road, in red for a rival, so a landing on you never comes from
// nowhere, and in your highlight, the size of your car, for you, so you can
// see whether a jump ends on a rival, the road or the water.
function drawLandings(ctx, v) {
  for (const car of v.round.cars) {
    if (car.air <= 0 || car.out > 0) continue;
    const y = v.yOf(car.d + (car.v * car.air) / 1000);
    if (y < -3 || y > v.g.FIELD_H + 3) continue;
    const mine = car.id === 0;
    const big = car.kind === "monster";
    const r = mine ? car.w / 2 : big ? car.w / 2 : 1.6 + (car.air / Math.max(1, car.airMax)) * 1.6;
    ellipse(ctx, car.x, y, r, mine || big ? car.l / 2 : r * 0.8);
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.strokeStyle = mine ? v.colors.you : DANGER;
    ctx.lineWidth = 0.35;
    ctx.stroke();
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
// wide: the stage, lives, the power-ups held, the chain and the combo, from
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
  put(hud.stage, "#ffffff");
  put(livesText(lives), LIVES);
  for (const e of hud.effects) put(e.text, e.color, e.fill);
  if (hud.chain > 1) put(`CHAIN x${hud.chain}`, GOLD);
  if (hud.combo) put(`COMBO x${hud.combo.mult}`, "#7fe3ff", hud.combo.fill);
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

// The stage bar beside the field: how far through the stage you are, a
// flag at the top for its line.
function drawBar(ctx, v) {
  const { g, colors } = v;
  const x = g.PAD + g.FIELD_W + g.GAP;
  const y = g.HUD_H;
  const h = g.FIELD_H;
  roundRect(ctx, x, y, g.BAR_W, h, g.BAR_W / 2);
  ctx.fillStyle = colors.line;
  ctx.fill();
  const p = v.state === "running" || v.state === "paused" ? v.hud.progress : 0;
  const top = y + 3 + (h - 6) * (1 - p);
  roundRect(ctx, x + 1, top, g.BAR_W - 2, y + h - 1 - top, (g.BAR_W - 2) / 2);
  ctx.fillStyle = GOLD;
  ctx.globalAlpha = 0.6;
  ctx.fill();
  ctx.globalAlpha = 1;
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = k % 2 ? "#f4f1ea" : "#1d1a17";
    ctx.fillRect(x + 1 + (k % 2) * ((g.BAR_W - 2) / 2), y + 1 + Math.floor(k / 2), (g.BAR_W - 2) / 2, 1);
    ctx.fillStyle = k % 2 ? "#1d1a17" : "#f4f1ea";
    ctx.fillRect(x + 1 + ((k + 1) % 2) * ((g.BAR_W - 2) / 2), y + 1 + Math.floor(k / 2), (g.BAR_W - 2) / 2, 1);
  }
  star(ctx, x + g.BAR_W / 2, top, 1.6, 0.7);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = 0.3;
  ctx.stroke();
}

// A banner is a light strip across the field, in its top part, well above
// your car.
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
  label(ctx, b.title, w / 2, y - 0.4, 4.4 * pop, b.color, "center", w - 4);
  if (b.sub) label(ctx, b.sub, w / 2, y + 4.2, 2.3, "#ffffff", "center", w - 4);
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip along the bottom of the field: a line
// or two, then a dot per stage, lit in its color for those reached. The over
// screen adds the round's score, big, above it.
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
  lines.forEach((text, i) => label(ctx, text, g.FIELD_W / 2, top + 3.4 + i * 4.2, i ? 2 : 2.5, i ? "#ffffff" : GOLD, "center", g.FIELD_W - 4));
  const n = v.maxStage;
  const r = 1.2;
  const step = r * 3.4;
  const x = g.FIELD_W / 2 - ((n - 1) * step) / 2;
  for (let k = 0; k < n; k++) {
    circle(ctx, x + k * step, top + 13.2, r);
    if (k < v.furthest) {
      ctx.fillStyle = stageColor(v.stageFor(k + 1).id);
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

// The whole frame. `v` is the view bounce.js refills: the round and its
// road, the board's geometry `g`, the scale `u`, the colors, the effects,
// the state, the pill numbers and the lines for the start and end screens.
export function drawScene(ctx, v) {
  const { g, round } = v;
  v.night = v.stageFor(round.stage).id === "night";
  ctx.save();
  ctx.scale(v.u, v.u);
  ctx.fillStyle = v.colors.board;
  ctx.fillRect(0, 0, g.W, g.H);
  drawHud(ctx, v);
  drawBar(ctx, v);
  if (!v.lines || v.lines.road !== v.road || v.lines.count !== v.road.stageAt.length) v.lines = linesOf(v.road, g.ROW);
  ctx.translate(g.PAD, g.HUD_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, g.FIELD_W, g.FIELD_H);
  if (typeof ctx.clip === "function") ctx.clip();
  if (v.shake) ctx.translate(v.shake.x, v.shake.y);
  drawRoad(ctx, v);
  drawTimed(ctx, v);
  drawPads(ctx, v);
  drawSigns(ctx, v);
  drawItems(ctx, v);
  drawBlocks(ctx, v);
  drawHazardsLow(ctx, v);
  drawStars(ctx, v);
  drawLandings(ctx, v);
  // Cars further up the road first, those in the air over the rest; every
  // shadow before any car, so no car's shadow falls across another car.
  const order = v.order;
  order.length = 0;
  for (const car of round.cars) order.push(car);
  order.sort((a, b) => (a.air > 0) - (b.air > 0) || b.d - a.d);
  for (const car of order) drawCar(ctx, car, v, "shadow");
  for (const car of order) drawCar(ctx, car, v, "body");
  drawHazardsHigh(ctx, v);
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
  if (v.night) {
    drawNight(ctx, v);
    drawFireflies(ctx, v);
  }
  if (v.shake) ctx.translate(-v.shake.x, -v.shake.y);
  for (const f of v.fx.floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
    const at = labelSpot(f.text, f.x, v.yOf(f.d) - f.rise, f.size, g.FIELD_W, g.FIELD_H);
    label(ctx, f.text, at.x, at.y, f.size, f.color, "center", at.max);
  }
  ctx.globalAlpha = 1;
  // The chain, big, beside your car while it climbs.
  if (v.combo && v.state === "running") {
    const you = round.cars[0];
    const p = 1 - v.combo.life / v.combo.max;
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    const text = `x${v.combo.n}`;
    const size = 5 * (p < 0.15 ? 0.7 + p * 2 : 1);
    const at = labelSpot(text, you.x + (you.x < g.FIELD_W / 2 ? 9 : -9), v.yOf(you.d) - 2, size, g.FIELD_W, g.FIELD_H);
    label(ctx, text, at.x, at.y, size, GOLD, "center", at.max);
    ctx.globalAlpha = 1;
  }
  if (v.flash) {
    ctx.globalAlpha = 0.24 * (v.flash.life / v.flash.max);
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

// The rows that hold a stage line, worked out again only when a stage is
// added to the road.
function linesOf(road, row) {
  const set = new Set();
  for (const d of road.stageAt) if (d > 0) set.add(Math.floor(d / row));
  set.road = road;
  set.count = road.stageAt.length;
  return set;
}
