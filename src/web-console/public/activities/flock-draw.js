// Plan2Code Web Console - Flock Dash's drawing: the sunset sky, the hazards and the portal, the strays and the flock, Planny as the lead bird with a star for an eye, the pills and the banners, from a view flock.js refills.
//
// Drawing only: no rules and no state of its own. flock.js hands drawScene()
// one view object of the moment (the round, the board's geometry, the colors
// readColors() took from the page), so the rules never touch a canvas and this
// file never decides anything. Everything is drawn in field units under one
// scale. Anything that moves on its own (wings, a stray's bob) follows the
// view's clock, never Math.random(), so a paused game's frame stays still.
//
// The sky (one palette per stage), the hazards and the birds keep their own fixed
// colors, the same in light and dark. The pills are opaque dark with text that reads on them at 4.5:1
// (pills.js). The strip the pills sit on and Planny (in your highlight) follow
// the page.

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
export const STAGE_COLOR = "#ff9a4d";
export const DANGER = "#ff5a5a";
export const FLOCK_COLOR = "#2b2140";
export const STRAY_COLOR = "#fff3dc";
export const HAZARD_COLORS = Object.freeze({ balloon: "#e8413c", gust: "#d9f2ff", stream: "#7fe3f0", cluster: "#b44fd6", storm: "#3a3550", kite: "#2fbf71" });
export const POWER_COLORS = Object.freeze({ tailwind: "#5fd7a8", shield: "#4fc3f7", magnet: "#c58bff" });
export const SUCCESS = "#5fd77a";
const STRAY_RIM = "#2b2140";

// One palette per stage, golden afternoon deepening through sunset to violet
// dusk: the sky's three colors, the clouds' tint, the sun's color and how far
// down the field it sits (past 1 it has set), and the pale rim followers need
// once the sky is as dark as they are. The first stars come out at stage 8.
export const SKIES = Object.freeze({
  1: Object.freeze({ top: "#5b8fc7", mid: "#e9a95c", horizon: "#ffcb6b", cloud: "#fff4dc", sun: "#fff3b0", sunY: 0.55, rim: null, stars: 0 }),
  2: Object.freeze({ top: "#4f76b8", mid: "#ea9a58", horizon: "#ffc062", cloud: "#ffe9cc", sun: "#ffeaa0", sunY: 0.62, rim: null, stars: 0 }),
  3: Object.freeze({ top: "#4a5fa6", mid: "#e8834f", horizon: "#ffb05a", cloud: "#ffdcc0", sun: "#ffe08a", sunY: 0.68, rim: null, stars: 0 }),
  4: Object.freeze({ top: "#4a4d96", mid: "#e26c5a", horizon: "#ff9a52", cloud: "#ffcdb8", sun: "#ffd070", sunY: 0.74, rim: null, stars: 0 }),
  5: Object.freeze({ top: "#453f88", mid: "#cf5a72", horizon: "#f98a55", cloud: "#f4b8b8", sun: "#ffb860", sunY: 0.8, rim: null, stars: 0 }),
  6: Object.freeze({ top: "#3d3378", mid: "#b44d86", horizon: "#ef7a5c", cloud: "#dfa0c0", sun: "#ff9f58", sunY: 0.86, rim: "#ffd9a8", stars: 0 }),
  7: Object.freeze({ top: "#2f2866", mid: "#8a4392", horizon: "#d9656c", cloud: "#b784c4", sun: "#ff8a5c", sunY: 0.93, rim: "#ffd9a8", stars: 0 }),
  8: Object.freeze({ top: "#1c1a4a", mid: "#4f2f80", horizon: "#a8487c", cloud: "#7c63a8", sun: "#ff7a6a", sunY: 1.02, rim: "#ffd9a8", stars: 26 }),
});
const skyFor = (stage) => SKIES[stage] || SKIES[1];
const SUN_X = 0.72;
const SUN_R = 6.5;
const RIM = 0.32;
// The two cloud layers: how fast each scrolls against the sky, how many clouds,
// their size and strength, and the band of height they keep to.
const CLOUD_LAYERS = Object.freeze([
  Object.freeze({ rate: 0.3, count: 5, size: 0.8, alpha: 0.35, top: 0.04, band: 0.4 }),
  Object.freeze({ rate: 0.6, count: 4, size: 1.3, alpha: 0.5, top: 0.22, band: 0.55 }),
]);
// Past each edge a cloud wraps out of sight: half this is more than the widest reaches.
const CLOUD_RUN = 40;
const BLINK_MS = 110;
const LEADER_TILT = 0.5;
const LEADER_W = 5;
const LEADER_H = 4;
const LEADER_INK = "#1d1a17";
const BALLOON_CREAM = "#fff3dc";
const BASKET = "#7a4d2b";
const PARTY = Object.freeze([HAZARD_COLORS.cluster, "#ff5fa2", "#38b6ff", "#ffd23f", "#2fbf71"]);
const GLOW_STEPS = 3;
const GLOW = 2.2;
const GLOW_FINAL = 4;
const RING_RX = 3.4;
const RING_RX_FINAL = 2.6;
const V_FADE_MS = 400;
const JAG_STEPS = 7;
const BOB = 0.6;
const BOB_RATE = 0.003;
const FLAP_RATE = 0.014;
const TAU = Math.PI * 2;
const STREAK_GAP = 11;
const STREAK_LEN = 5;
const LOOSE_ALPHA_MIN = 0.25;
const BANNER_SHADE = "rgba(0, 0, 0, 0.3)";
const END_SHADE = "rgba(0, 0, 0, 0.55)";
const END_H = 18;
const CRATE_BOX = 2.6;
const CRATE_GLOW = 3.4;
const WIND_STREAKS = 5;
const WIND_RUN = 18;
const WIND_LEN = 4;
const WIND_RATE = 40;

const pillWidth = (h, text) => h * 0.7 + text.length * h * 0.42;

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${h * 0.62}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  drawPill(ctx, x, y, pillWidth(h, text), h, text, color, fill, y + h * 0.54);
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
  put(hud.stage, STAGE_COLOR);
  put(livesText(lives), LIVES);
  put(`Score ${hud.score}`, GOLD);
  put(`Flock ${hud.flock} / ${hud.min}`, hud.flock >= hud.min ? SUCCESS : STRAY_COLOR);
  if (hud.combo > 1) put(`x${hud.combo}`, GOLD);
  for (const p of hud.powers || []) put(p.text, p.color, p.fill);
  const drop = Math.max(0, (stripH - (y + h) - y0) / 2);
  for (const p of out) {
    p.y += drop;
    p.h = h;
  }
  return { out, over: stripH ? y + h > stripH : false };
}

// Where the pills go, `h` units tall in a strip `stripH` tall on a board `W`
// wide: the stage, lives, the score and the flock against the portal's minimum
// (in the success color once met) from the left, then the combo
// while it is above 1 and the power-ups running. A row that
// would leave the strip shrinks every pill a step at a time until it fits; only
// past HUD_SHRINK_MIN does a row spill below the strip, over the field, where
// drawScene paints the pills last.
export function hudLayout(h, W, lives, hud, stripH = 0) {
  let k = 1;
  let laid = layPills(h, W, lives, hud, stripH);
  while (laid.over && k > HUD_SHRINK_MIN) {
    k = Math.max(HUD_SHRINK_MIN, k * HUD_SHRINK);
    laid = layPills(h * k, W, lives, hud, stripH);
  }
  return laid.out;
}

function drawHud(ctx, v) {
  const { g, colors } = v;
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, g.W, g.HUD_H);
  ctx.fillStyle = colors.line;
  ctx.fillRect(0, g.HUD_H - 0.25, g.W, 0.25);
}

function drawPills(ctx, v) {
  const { g } = v;
  if (v.state !== "running" && v.state !== "paused") return;
  for (const p of hudLayout(v.pillH, g.W, v.round.infinite ? Infinity : v.round.lives, v.hud, g.HUD_H)) pill(ctx, p.x, p.y, p.h, p.text, p.color, p.fill);
}

// A number from 0 to 1 for a seed and an index, so the clouds and stars of a
// round always sit in the same places.
function scatter(seed, k) {
  let t = Math.imul((seed >>> 0) ^ Math.imul(k + 1, 0x9e3779b1), 0x5bd1e995);
  t ^= t >>> 15;
  t = Math.imul(t, t | 61);
  t ^= t >>> 13;
  return (t >>> 0) / 4294967296;
}

function disc(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawStars(ctx, v, sky) {
  const { g, round } = v;
  ctx.fillStyle = "#ffffff";
  for (let k = 0; k < sky.stars; k++) {
    ctx.globalAlpha = 0.45 + 0.45 * Math.abs(Math.sin(v.clock * 0.0012 + k));
    ctx.fillRect(scatter(round.seed, 1000 + k) * g.FIELD_W, scatter(round.seed, 2000 + k) * g.FIELD_H * 0.6, 0.3, 0.3);
  }
  ctx.globalAlpha = 1;
}

function drawSun(ctx, g, sky) {
  const x = g.FIELD_W * SUN_X;
  const y = g.FIELD_H * sky.sunY;
  ctx.globalAlpha = 0.16;
  disc(ctx, x, y, SUN_R * 1.9, sky.sun);
  ctx.globalAlpha = 0.28;
  disc(ctx, x, y, SUN_R * 1.4, sky.sun);
  ctx.globalAlpha = 1;
  disc(ctx, x, y, SUN_R, sky.sun);
}

// Two layers of clouds drifting behind everything, slower than the sky, wrapping
// around from their places in the round's seed.
function drawClouds(ctx, v, sky) {
  const { g, round } = v;
  const run = g.FIELD_W + CLOUD_RUN;
  ctx.fillStyle = sky.cloud;
  CLOUD_LAYERS.forEach((layer, l) => {
    ctx.globalAlpha = layer.alpha;
    for (let k = 0; k < layer.count; k++) {
      const key = (l + 1) * 100 + k * 3;
      const home = scatter(round.seed, key) * run - round.scroll * layer.rate;
      const x = ((home % run) + run) % run - CLOUD_RUN / 2;
      const y = (layer.top + scatter(round.seed, key + 1) * layer.band) * g.FIELD_H;
      const w = (6 + scatter(round.seed, key + 2) * 8) * layer.size;
      ctx.beginPath();
      ctx.ellipse(x, y, w, w * 0.28, 0, 0, TAU);
      ctx.ellipse(x - w * 0.35, y - w * 0.14, w * 0.42, w * 0.26, 0, 0, TAU);
      ctx.ellipse(x + w * 0.25, y - w * 0.2, w * 0.5, w * 0.32, 0, 0, TAU);
      ctx.fill();
    }
  });
  ctx.globalAlpha = 1;
}

function drawSky(ctx, v) {
  const { g, round } = v;
  const palette = skyFor(round.stage);
  const sky = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, g.FIELD_H) : null;
  if (sky) {
    sky.addColorStop(0, palette.top);
    sky.addColorStop(0.58, palette.mid);
    sky.addColorStop(1, palette.horizon);
  }
  ctx.fillStyle = sky || palette.mid;
  ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
  drawStars(ctx, v, palette);
  drawSun(ctx, g, palette);
  drawClouds(ctx, v, palette);
}

// How a wing sits at this moment of its beat, from -1 (down) to 1 (up).
const flapAt = (clock, phase) => Math.sin(clock * FLAP_RATE + phase);

function birdBody(ctx, x, y, r) {
  ctx.moveTo(x + r, y);
  ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU);
  ctx.moveTo(x + r * 0.85, y - r * 0.2);
  ctx.lineTo(x + r * 1.5, y);
  ctx.lineTo(x + r * 0.85, y + r * 0.2);
  ctx.closePath();
}

// A wing from the shoulder at x, its tip `lift` above the body and swept back.
function birdWing(ctx, x, y, r, lift) {
  ctx.moveTo(x + r * 0.4, y);
  ctx.quadraticCurveTo(x, y - lift * 0.7, x - r * 0.75, y - lift);
  ctx.quadraticCurveTo(x - r * 0.3, y - lift * 0.25, x - r * 0.45, y);
  ctx.closePath();
}

// A small bird flying right, `r` units long: a body and two wings on their beat,
// each filled on its own, with a rim under them when the sky needs one.
function drawBird(ctx, x, y, r, color, beat, rim) {
  const near = r * 1.5 * beat;
  const far = r * 1.05 * beat;
  const back = x - r * 0.4;
  if (rim) {
    ctx.strokeStyle = rim;
    ctx.lineWidth = RIM;
    ctx.beginPath();
    birdBody(ctx, x, y, r);
    birdWing(ctx, x, y, r, near);
    birdWing(ctx, back, y, r, far);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  birdBody(ctx, x, y, r);
  ctx.fill();
  ctx.beginPath();
  birdWing(ctx, back, y, r, far);
  ctx.fill();
  ctx.beginPath();
  birdWing(ctx, x, y, r, near);
  ctx.fill();
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = LEADER_INK;
  ctx.lineWidth = 0.14;
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const d = k % 2 ? r * 0.42 : r;
    if (k) ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
    else ctx.moveTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
}

function roundedBox(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Planny leads, in bird form: his box in your highlight, the star for an eye, two
// wings on the beat and his feet tucked up, tilted with his climb. He blinks
// while nothing can hit him.
function drawLeader(ctx, v) {
  const { leader } = v.round;
  const you = v.colors.you;
  const beat = flapAt(v.clock, 0);
  if (leader.grace > 0 && Math.floor(v.clock / BLINK_MS) % 2) ctx.globalAlpha = 0.35;
  ctx.save();
  ctx.translate(leader.sx, leader.y);
  ctx.rotate(Math.max(-1, Math.min(1, leader.vy / v.g.CLIMB)) * LEADER_TILT);
  const wing = (x, lift) => {
    ctx.beginPath();
    birdWing(ctx, x, 0, 2.2, lift);
    ctx.fillStyle = you;
    ctx.fill();
    ctx.strokeStyle = LEADER_INK;
    ctx.lineWidth = 0.22;
    ctx.stroke();
  };
  wing(-1.2, 2.7 * beat);
  ctx.strokeStyle = LEADER_INK;
  ctx.lineWidth = 0.32;
  ctx.beginPath();
  ctx.moveTo(-0.9, LEADER_H / 2);
  ctx.lineTo(-1.9, LEADER_H / 2 + 0.55);
  ctx.moveTo(0.5, LEADER_H / 2);
  ctx.lineTo(-0.5, LEADER_H / 2 + 0.55);
  ctx.stroke();
  ctx.fillStyle = GOLD;
  ctx.beginPath();
  ctx.moveTo(LEADER_W / 2 - 0.1, -0.6);
  ctx.lineTo(LEADER_W / 2 + 1.1, 0.1);
  ctx.lineTo(LEADER_W / 2 - 0.1, 0.8);
  ctx.closePath();
  ctx.fill();
  roundedBox(ctx, -LEADER_W / 2, -LEADER_H / 2, LEADER_W, LEADER_H, 1.1);
  ctx.fillStyle = you;
  ctx.fill();
  ctx.strokeStyle = LEADER_INK;
  ctx.lineWidth = 0.25;
  ctx.stroke();
  drawStar(ctx, 0.75, -0.45, 1.1, GOLD);
  wing(-0.5, 3.1 * beat);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// A hot-air balloon: the striped envelope (its hit circle), ropes and a basket.
function drawHotAir(ctx, x, y, r) {
  disc(ctx, x, y, r, HAZARD_COLORS.balloon);
  ctx.fillStyle = BALLOON_CREAM;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.62, r * 0.98, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = HAZARD_COLORS.balloon;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.26, r * 0.98, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = BASKET;
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.5, y + r * 0.85);
  ctx.lineTo(x - 0.6, y + r + 0.9);
  ctx.moveTo(x + r * 0.5, y + r * 0.85);
  ctx.lineTo(x + 0.6, y + r + 0.9);
  ctx.stroke();
  ctx.fillStyle = BASKET;
  ctx.fillRect(x - 0.7, y + r + 0.9, 1.4, 1);
}

// A bunch of party balloons, their strings meeting at a knot under them.
function drawBunch(ctx, x, y, h) {
  const knotY = y + h.h / 2 + 1;
  ctx.strokeStyle = STRAY_RIM;
  ctx.lineWidth = 0.14;
  ctx.beginPath();
  for (const p of h.parts) {
    ctx.moveTo(x + p.dx, y + p.dy + p.r);
    ctx.lineTo(x, knotY);
  }
  ctx.stroke();
  h.parts.forEach((p, i) => {
    disc(ctx, x + p.dx, y + p.dy, p.r, PARTY[i % PARTY.length]);
    ctx.globalAlpha = 0.45;
    disc(ctx, x + p.dx - p.r * 0.35, y + p.dy - p.r * 0.35, p.r * 0.25, "#ffffff");
    ctx.globalAlpha = 1;
  });
}

function drawBand(ctx, x, y, w, h, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x, y - h / 2, w, h);
  ctx.globalAlpha = 1;
}

// A gust's warning: arrows at its height along the right edge, pulsing.
function drawGustWarning(ctx, v, h) {
  const { g } = v;
  ctx.globalAlpha = 0.55 + 0.45 * Math.sin(v.clock * 0.014);
  ctx.strokeStyle = HAZARD_COLORS.gust;
  ctx.lineWidth = 0.5;
  for (let k = 0; k < 3; k++) {
    const x = g.FIELD_W - 2 - k * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, h.y - h.h / 2);
    ctx.lineTo(x - 1.6, h.y);
    ctx.lineTo(x, h.y + h.h / 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// A live gust: a white band, streaked along its way.
function drawGust(ctx, v, h, sx) {
  drawBand(ctx, sx, h.y, h.w, h.h, HAZARD_COLORS.gust, 0.28);
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.28;
  for (let k = 0; k < 7; k++) {
    const at = (k * 5.3 + v.clock * 0.03) % h.w;
    const y = h.y + ((k % 3) - 1) * (h.h / 3.2);
    ctx.beginPath();
    ctx.moveTo(sx + h.w - at, y);
    ctx.lineTo(sx + h.w - at + 4, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Streaks flowing toward the player at twice the stage's speed.
function drawStream(ctx, v, h, sx) {
  drawBand(ctx, sx, h.y, h.w, h.h, HAZARD_COLORS.stream, 0.22);
  ctx.strokeStyle = HAZARD_COLORS.stream;
  ctx.lineWidth = 0.25;
  for (const y of [h.y - h.h / 2, h.y + h.h / 2]) {
    ctx.beginPath();
    ctx.moveTo(sx, y);
    ctx.lineTo(sx + h.w, y);
    ctx.stroke();
  }
  const flow = (v.clock / 1000) * v.round.speed * 2;
  for (let row = 0; row < 3; row++) {
    const y = h.y + (row - 1) * (h.h / 3);
    for (let at = (row * 7 - flow) % STREAK_GAP; at < h.w; at += STREAK_GAP) {
      if (at < 0) continue;
      ctx.beginPath();
      ctx.moveTo(sx + at, y);
      ctx.lineTo(sx + Math.min(h.w, at + STREAK_LEN), y);
      ctx.stroke();
    }
  }
}

// A kite on its string, the line that snaps a bird: a diamond with its spars and
// a tail of bows that swings with the kite, hanging away from its string.
function drawKite(ctx, v, h, sx, tipX) {
  const { g } = v;
  const R = g.KITE_R;
  ctx.strokeStyle = STRAY_RIM;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.moveTo(sx, h.top ? 0 : g.FIELD_H);
  ctx.lineTo(tipX, h.y);
  ctx.stroke();
  ctx.fillStyle = HAZARD_COLORS.kite;
  ctx.beginPath();
  ctx.moveTo(tipX, h.y - R);
  ctx.lineTo(tipX + R, h.y);
  ctx.lineTo(tipX, h.y + R);
  ctx.lineTo(tipX - R, h.y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = BALLOON_CREAM;
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  ctx.moveTo(tipX, h.y - R);
  ctx.lineTo(tipX, h.y + R);
  ctx.moveTo(tipX - R, h.y);
  ctx.lineTo(tipX + R, h.y);
  ctx.stroke();
  const swing = Math.sin(v.clock * 0.004 + h.phase) * 0.7;
  const away = h.top ? 1 : -1;
  ctx.fillStyle = "#ffd23f";
  for (let k = 1; k <= 3; k++) {
    const x = tipX + swing * k * 0.6 - k * 0.5;
    const y = h.y + away * (R + k * 1.1);
    ctx.beginPath();
    ctx.moveTo(x - 0.5, y - 0.3);
    ctx.lineTo(x + 0.5, y + 0.3);
    ctx.lineTo(x + 0.5, y - 0.3);
    ctx.lineTo(x - 0.5, y + 0.3);
    ctx.closePath();
    ctx.fill();
  }
}

// A dark cloud; while it beats, a warning column that pulses, then the strike
// down it as a jagged bolt inside the column it can hit.
function drawStorm(ctx, v, h, sx) {
  const { g, round } = v;
  disc(ctx, sx - h.w * 0.25, h.y, h.h * 0.8, HAZARD_COLORS.storm);
  disc(ctx, sx + h.w * 0.25, h.y, h.h * 0.8, HAZARD_COLORS.storm);
  disc(ctx, sx, h.y - h.h * 0.2, h.h, HAZARD_COLORS.storm);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = "#5a5474";
  ctx.beginPath();
  ctx.ellipse(sx, h.y - h.h * 0.45, h.w * 0.32, h.h * 0.4, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  if (h.phase === "idle") return;
  const [lo, hi] = h.top ? [h.y, h.y + g.STORM_REACH] : [h.y - g.STORM_REACH, h.y];
  const mid = h.col - round.scroll;
  const col = mid - g.STORM_COL / 2;
  if (h.phase === "warn") {
    drawBand(ctx, col, (lo + hi) / 2, g.STORM_COL, hi - lo, DANGER, 0.2 + 0.2 * Math.abs(Math.sin(v.clock * 0.02)));
    return;
  }
  drawBand(ctx, col, (lo + hi) / 2, g.STORM_COL, hi - lo, "#fff7b0", 0.5);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.55;
  ctx.beginPath();
  for (let k = 0; k <= JAG_STEPS; k++) {
    const t = k / JAG_STEPS;
    const x = mid + (k === 0 ? 0 : (scatter(round.seed, Math.floor(h.beat) + k) - 0.5) * g.STORM_COL * 0.9);
    const y = h.top ? lo + (hi - lo) * t : hi - (hi - lo) * t;
    if (k) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.stroke();
}

function drawHazards(ctx, v) {
  const { g, round } = v;
  for (const h of round.hazards) {
    const sx = h.x - round.scroll;
    if (h.kind === "gust") {
      if (h.warnAt === undefined) continue;
      if (h.live) drawGust(ctx, v, h, sx);
      else drawGustWarning(ctx, v, h);
      continue;
    }
    if (sx - h.w > g.FIELD_W || sx + h.w < 0) continue;
    if (h.kind === "balloon") drawHotAir(ctx, sx, h.y, h.r);
    else if (h.kind === "cluster") drawBunch(ctx, sx, h.y, h);
    else if (h.kind === "kite") drawKite(ctx, v, h, sx, h.tipX - round.scroll);
    else if (h.kind === "stream") drawStream(ctx, v, h, sx);
    else if (h.kind === "storm") drawStorm(ctx, v, h, sx);
  }
}

// The jet stream's glowing swirl ring, seen a little from the side. The last one
// has the smaller ring and the larger glow.
function drawPortal(ctx, v) {
  const { portal, scroll, stage } = v.round;
  const final = stage === v.g.MAX_STAGE;
  const glow = final ? GLOW_FINAL : GLOW;
  const rx = final ? RING_RX_FINAL : RING_RX;
  const ry = portal.h / 2;
  const sx = portal.x - scroll;
  if (sx < -rx - glow * GLOW_STEPS || sx > v.g.FIELD_W + rx + glow * GLOW_STEPS) return;
  ctx.strokeStyle = GOLD;
  ctx.globalAlpha = 0.14;
  for (let k = GLOW_STEPS; k >= 1; k--) {
    ctx.lineWidth = 0.8 + k * glow;
    ctx.beginPath();
    ctx.ellipse(sx, portal.y, rx, ry, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(sx, portal.y, rx, ry, 0, 0, TAU);
  ctx.stroke();
  ctx.strokeStyle = "#fff7d6";
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 4; k++) {
    const from = v.clock * 0.005 + (k * TAU) / 4;
    ctx.beginPath();
    ctx.ellipse(sx, portal.y, rx * 0.68, ry * 0.92, 0, from, from + 1.1);
    ctx.stroke();
  }
}

// While the V forms: a faint gold line along each arm as the flock glides in.
function drawV(ctx, v) {
  const { portal, flock, leader, scroll } = v.round;
  if (!portal.v || !flock.length) return;
  const ends = [flock[flock.length - 1], flock[Math.max(0, flock.length - 2)]];
  if (typeof ends[0].x !== "number" || typeof ends[1].x !== "number") return;
  ctx.globalAlpha = 0.5 * Math.max(0, Math.min(1, Math.min(portal.v.t, v.g.V_MS - portal.v.t) / V_FADE_MS));
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 0.4;
  ctx.beginPath();
  ctx.moveTo(ends[0].x - scroll, ends[0].y);
  ctx.lineTo(leader.sx, leader.y);
  ctx.lineTo(ends[1].x - scroll, ends[1].y);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Loose birds fade through their last second, but stay faintly in sight as they
// fly off.
function drawScattered(ctx, v) {
  const { round } = v;
  for (const b of round.scattered) {
    ctx.globalAlpha = Math.max(LOOSE_ALPHA_MIN, Math.min(1, (b.until - round.now) / 1000));
    drawBird(ctx, b.x - round.scroll, b.y, 1.3, STRAY_COLOR, flapAt(v.clock, b.id * 1.7), STRAY_RIM);
  }
  ctx.globalAlpha = 1;
}

// A crate: a small box in its power's color with a soft glow.
function drawCrates(ctx, v) {
  const { g, round } = v;
  for (const c of round.crates) {
    const sx = c.x - round.scroll;
    if (sx < -CRATE_GLOW || sx > g.FIELD_W + CRATE_GLOW) continue;
    const color = POWER_COLORS[c.kind];
    ctx.globalAlpha = 0.3;
    disc(ctx, sx, c.y, CRATE_GLOW, color);
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(sx - CRATE_BOX / 2, c.y - CRATE_BOX / 2, CRATE_BOX, CRATE_BOX);
    ctx.strokeStyle = FLOCK_COLOR;
    ctx.lineWidth = 0.25;
    ctx.strokeRect(sx - CRATE_BOX / 2, c.y - CRATE_BOX / 2, CRATE_BOX, CRATE_BOX);
  }
}

// How far the magnet reaches, as a faint ring around the leader.
function drawMagnetRing(ctx, v) {
  const { g, round } = v;
  if (round.active.magnet <= 0 || !round.leader.alive) return;
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = POWER_COLORS.magnet;
  ctx.lineWidth = 0.3;
  ctx.beginPath();
  ctx.arc(round.leader.sx, round.leader.y, g.MAGNET_REACH, 0, TAU);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Speed streaks rushing away behind the last bird of the line.
function drawTailwind(ctx, v) {
  const { round } = v;
  if (round.active.tailwind <= 0 || !round.leader.alive) return;
  const last = round.flock[round.flock.length - 1];
  const tail = last && typeof last.x === "number" ? last : { x: round.leader.x, y: round.leader.y };
  const x = tail.x - round.scroll - 2;
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = POWER_COLORS.tailwind;
  ctx.lineWidth = 0.3;
  for (let k = 0; k < WIND_STREAKS; k++) {
    const back = (k * 5 + (v.clock / 1000) * WIND_RATE) % WIND_RUN;
    const y = tail.y + (k - (WIND_STREAKS - 1) / 2) * 1.4;
    ctx.beginPath();
    ctx.moveTo(x - back, y);
    ctx.lineTo(x - back - WIND_LEN, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function label(ctx, text, x, y, size, color, maxWidth) {
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, maxWidth);
}

// A strip across the field, its place chosen away from the leader, fading out
// at the end of its time and to see-through while anything is under it.
function drawBanner(ctx, v, b) {
  const { g, round } = v;
  const p = 1 - Math.max(0, b.until - round.now) / b.ms;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, b.row - g.BANNER_HALF, g.FIELD_W, g.BANNER_HALF * 2);
  label(ctx, b.text, g.FIELD_W / 2, b.row - 1, 4.2, b.color, g.FIELD_W - 4);
  if (b.sub) label(ctx, b.sub, g.FIELD_W / 2, b.row + 3.2, 2.2, "#ffffff", g.FIELD_W - 4);
  ctx.globalAlpha = 1;
}

// The end of a run, along the bottom of the field (the window's own message sits
// in the middle): how it went, the score, the best, and the nudge to go again.
function drawEnd(ctx, v, end) {
  const { g } = v;
  const top = g.FIELD_H - END_H;
  const mid = g.FIELD_W / 2;
  ctx.fillStyle = END_SHADE;
  ctx.fillRect(0, top, g.FIELD_W, END_H);
  const title = end.won ? (end.flawless ? `You made it! Flawless +${end.flawless}` : "You made it!") : "Out of lives";
  label(ctx, title, mid, top + 2.8, 2.8, end.won ? GOLD : "#ffffff", g.FIELD_W - 4);
  label(ctx, String(end.score), mid, top + 7.8, 6, GOLD, g.FIELD_W - 4);
  label(ctx, end.fresh ? `A new best! ${end.best}` : `Best ${end.best}`, mid, top + 12.2, 2.2, "#ffffff", g.FIELD_W - 4);
  label(ctx, end.teaser, mid, top + 15.6, 2.2, "#ffffff", g.FIELD_W - 4);
}

export function drawScene(ctx, v) {
  const { g, round } = v;
  ctx.save();
  ctx.scale(v.u, v.u);
  ctx.fillStyle = v.colors.board;
  ctx.fillRect(0, 0, g.W, g.H);
  drawHud(ctx, v);
  ctx.translate(g.PAD, g.HUD_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, g.FIELD_W, g.FIELD_H);
  if (typeof ctx.clip === "function") ctx.clip();
  drawSky(ctx, v);
  drawHazards(ctx, v);
  drawPortal(ctx, v);
  drawCrates(ctx, v);
  drawMagnetRing(ctx, v);
  drawTailwind(ctx, v);
  drawV(ctx, v);
  for (const s of round.strays) {
    drawBird(ctx, s.x - round.scroll, s.y + Math.sin(v.clock * BOB_RATE + s.bob) * BOB, 1.3, STRAY_COLOR, flapAt(v.clock, s.bob), STRAY_RIM);
  }
  const { rim } = skyFor(round.stage);
  for (const b of round.flock) {
    if (typeof b.x === "number") drawBird(ctx, b.x - round.scroll, b.y, 1.4, FLOCK_COLOR, flapAt(v.clock, b.id * 1.7), rim);
  }
  drawScattered(ctx, v);
  if (round.leader.alive || v.state === "over") drawLeader(ctx, v);
  if (v.end) drawEnd(ctx, v, v.end);
  else if (round.banner && round.banner.row !== null) drawBanner(ctx, v, round.banner);
  ctx.restore();
  ctx.translate(-g.PAD, -g.HUD_H);
  drawPills(ctx, v);
  ctx.restore();
}
