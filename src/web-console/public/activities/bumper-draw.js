// Plan2Code Web Console - Bumper Ring's drawing: the ring over the void, its floor, the cars, Planny at the wheel, the pills and the banners, from a view bumper.js builds.
//
// Drawing only: no rules and no state of its own. bumper.js hands drawScene()
// a plain view of the moment (the round, the board's geometry, the effects
// running, the colors readColors() took from the page), so the rules never
// touch a canvas and this file never decides anything. Everything is drawn in
// arena units under one scale to the board. Anything that moves on its own
// (the void's specks, a pulse, a wobble) follows the view's clock, never
// Math.random(), so a paused game's frame stays still.
//
// Each arena paints its ring in its own fixed colors, the same in light and
// dark, and so are the words and banners (light text with a dark edge,
// which reads on every floor) and the pills (opaque dark, with text that
// reads on them at 4.5:1, from pills.js). Planny and his car follow the page.

import { drawPill, LIVES, livesText } from "./pills.js";

const FALLBACK_COLORS = Object.freeze({ board: "#ffffff", you: "#206cc3", head: "#1d1a17" });

// The page's tokens, read again at each round and each resize, so Planny and
// his car follow a theme or highlight change made while the game sat paused.
// A stub canvas in Node has no computed style, so every color falls back.
export function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return {
    board: pick("--panel", FALLBACK_COLORS.board),
    you: pick("--accent", FALLBACK_COLORS.you),
    head: pick("--ink", FALLBACK_COLORS.head),
  };
}

export const GOLD = "#f5b301";
export const DANGER = "#e2553f";
const SHADE = "rgba(0, 0, 0, 0.55)";
const BANNER_SHADE = "rgba(0, 0, 0, 0.32)";
const RUBBER = "#24232b";
const TAU = Math.PI * 2;

// Each arena's look: the void around the ring, the mat, its rim and the
// marks drawn on it.
const THEMES = Object.freeze({
  1: Object.freeze({ void: "#1b2238", speck: "#8fa8ff", mat: "#3f6fb5", side: "#2a4c80", rim: "#f2e6c9", mark: "#ffffff" }),
  2: Object.freeze({ void: "#26172e", speck: "#ff9ad5", mat: "#c9a36a", side: "#8a6a3c", rim: "#7a4a2a", mark: "#fff3d6" }),
  3: Object.freeze({ void: "#10202a", speck: "#7fe0d8", mat: "#2f8f8a", side: "#1d5e5a", rim: "#ffd84a", mark: "#d9fff8" }),
  4: Object.freeze({ void: "#0f1f33", speck: "#cfe6ff", mat: "#8fb9d9", side: "#5a86a8", rim: "#ffffff", mark: "#e8f6ff" }),
  5: Object.freeze({ void: "#17151c", speck: "#ff7a6b", mat: "#2a2830", side: "#141318", rim: "#e2553f", mark: "#4a4752" }),
  6: Object.freeze({ void: "#2a1a0f", speck: "#ffd36b", mat: "#f2c14e", side: "#b8892a", rim: "#d9a520", mark: "#ffe39a" }),
  7: Object.freeze({ void: "#1d1430", speck: "#a466ff", mat: "#8a8f9e", side: "#5d6170", rim: "#e2553f", mark: "#c3c8d4" }),
  8: Object.freeze({ void: "#120f22", speck: "#d9c6ff", mat: "#b8a7e8", side: "#7d6db3", rim: "#ffffff", mark: "#ece6ff" }),
  9: Object.freeze({ void: "#0c0c14", speck: GOLD, mat: "#d9a520", side: "#8a6510", rim: "#1d1a17", mark: "#ffe08a" }),
});

export const themeFor = (level) => THEMES[Math.min(9, Math.max(1, Math.floor(level) || 1))];

// The dot each arena lights on the start and end screens.
export const arenaColor = (level) => themeFor(level).mat;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

function radial(ctx, x, y, r0, r1, stops) {
  if (typeof ctx.createRadialGradient !== "function") return null;
  let g = null;
  try {
    g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  } catch {
    return null;
  }
  if (!g || typeof g.addColorStop !== "function") return null;
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
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

// The ring's outline at radius r: a circle, or the Hall of Mirrors' square.
function ringPath(ctx, g, r, shape) {
  ctx.beginPath();
  if (shape === "square") {
    const k = Math.min(r * 0.18, 2.5);
    if (typeof ctx.roundRect === "function") ctx.roundRect(g.CX - r, g.CY - r, r * 2, r * 2, k);
    else ctx.rect(g.CX - r, g.CY - r, r * 2, r * 2);
  } else ctx.arc(g.CX, g.CY, Math.max(0, r), 0, TAU);
}

/* ------------------------------------------------------------- the void */

function drawVoid(ctx, v) {
  const { g, theme } = v;
  ctx.fillStyle = theme.void;
  ctx.fillRect(-2, -2, g.W + 4, g.H + 4);
  // Specks drift slowly past, always in the same places for an arena.
  let seed = Math.imul(Math.min(9, v.level) + 11, 2654435761) >>> 0;
  const next = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = theme.speck;
  for (let i = 0; i < 70; i++) {
    const x = (next() * g.W + v.clock / (180 + next() * 400)) % g.W;
    const y = next() * g.H;
    const s = 0.15 + next() * 0.35;
    ctx.globalAlpha = 0.2 + 0.35 * Math.abs(Math.sin(v.clock / 900 + i));
    ctx.fillRect(x, y, s, s);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------- the ring */

function drawPlatform(ctx, v) {
  const { g, theme, round } = v;
  const R = round.R;
  // A shadow far below, then the platform's own side, then its top.
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#000000";
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(g.CX, g.CY + 4.5, R * 0.96, R * 0.9, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.side;
  ctx.save();
  ctx.translate(0, 1.6);
  ringPath(ctx, g, R, round.shape);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = theme.mat;
  ringPath(ctx, g, R, round.shape);
  ctx.fill();
  // The marks turn with the Turntable.
  ctx.save();
  ringPath(ctx, g, R, round.shape);
  if (typeof ctx.clip === "function") ctx.clip();
  ctx.translate(g.CX, g.CY);
  if (typeof ctx.rotate === "function") ctx.rotate(round.turn || 0);
  ctx.strokeStyle = theme.mark;
  ctx.fillStyle = theme.mark;
  ctx.lineWidth = 0.5;
  ctx.globalAlpha = 0.35;
  if (v.level === 5) {
    // A record's grooves and its label.
    for (let r = 8; r < g.RING_R; r += 2.2) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.rim;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-3.4, -0.5, 6.8, 1);
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, g.RING_R * 0.62, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 3.2, 0, TAU);
    ctx.stroke();
    // Two start lines, sumo style.
    ctx.fillRect(-8, -5.5, 5, 0.9);
    ctx.fillRect(3, 4.6, 5, 0.9);
    if (v.level === 6) {
      ctx.globalAlpha = 0.25;
      for (let k = 0; k < 14; k++) {
        const a = k * 2.4;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * (8 + k * 2.3), Math.sin(a) * (8 + k * 2.3), 0.8 + (k % 3) * 0.4, 0, TAU);
        ctx.fill();
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // The rim, striped, so a turn shows.
  ctx.save();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = theme.rim;
  ringPath(ctx, g, R - 0.7, round.shape);
  ctx.stroke();
  if (round.shape !== "square" && typeof ctx.setLineDash === "function") {
    ctx.strokeStyle = theme.side;
    ctx.setLineDash([1.6, 2.4]);
    ctx.lineDashOffset = -(round.turn || 0) * R;
    ringPath(ctx, g, R - 0.7, round.shape);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

// The band about to drop flashes red, and a sudden death says so.
function drawWarnings(ctx, v) {
  const { g, round } = v;
  if (v.shrinkWarn) {
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.45 * Math.abs(Math.sin(v.clock / 90));
    ctx.fillStyle = DANGER;
    ringPath(ctx, g, round.R, round.shape);
    ringPath2(ctx, g, v.nextR, round.shape);
    ctx.fill("evenodd");
    ctx.restore();
  }
  // The square's corners flash before the ring goes round again.
  if (v.shapeWarn === "round") {
    ctx.save();
    ctx.globalAlpha = 0.3 + 0.45 * Math.abs(Math.sin(v.clock / 90));
    ctx.fillStyle = DANGER;
    ringPath(ctx, g, round.R, "square");
    ringPath2(ctx, g, round.R, "round");
    ctx.fill("evenodd");
    ctx.restore();
  } else if (v.shapeWarn === "square") {
    ctx.save();
    ctx.globalAlpha = 0.25 + 0.25 * Math.abs(Math.sin(v.clock / 140));
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.5;
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([1.5, 1.5]);
    ringPath(ctx, g, round.R, "square");
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    ctx.restore();
  }
}

// A second outline added to the current path, for an even-odd band.
function ringPath2(ctx, g, r, shape) {
  if (shape === "square") {
    ctx.moveTo(g.CX - r, g.CY - r);
    ctx.lineTo(g.CX + r, g.CY - r);
    ctx.lineTo(g.CX + r, g.CY + r);
    ctx.lineTo(g.CX - r, g.CY + r);
    ctx.closePath();
  } else {
    ctx.moveTo(g.CX + r, g.CY);
    ctx.arc(g.CX, g.CY, Math.max(0, r), 0, TAU);
  }
}

// Floor that has just dropped: a band falling away and fading.
function drawDrops(ctx, v) {
  const { g } = v;
  for (const d of v.fx.drops) {
    const p = 1 - d.life / d.max;
    ctx.save();
    ctx.globalAlpha = 0.8 * (1 - p);
    ctx.translate(g.CX, g.CY + p * 6);
    ctx.scale(1 - p * 0.15, 1 - p * 0.15);
    ctx.translate(-g.CX, -g.CY);
    ctx.fillStyle = v.theme.side;
    ringPath(ctx, g, d.from, d.shape);
    ringPath2(ctx, g, d.to, d.shape);
    ctx.fill("evenodd");
    ctx.restore();
  }
}

function drawIce(ctx, v) {
  for (const p of v.round.ice) {
    ctx.fillStyle = "rgba(240, 250, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // Shine streaks.
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(p.x - p.r * 0.5, p.y - p.r * 0.1);
    ctx.lineTo(p.x - p.r * 0.1, p.y - p.r * 0.5);
    ctx.moveTo(p.x - p.r * 0.2, p.y + p.r * 0.2);
    ctx.lineTo(p.x + p.r * 0.3, p.y - p.r * 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  for (const p of v.round.slicks) {
    ctx.globalAlpha = Math.min(1, p.ttl / 800) * 0.75;
    ctx.fillStyle = "#2a2733";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha *= 0.6;
    ctx.strokeStyle = "#a466ff";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.arc(p.x - 0.4, p.y - 0.4, p.r * 0.55, 3.6, 5.4);
    ctx.stroke();
    ctx.strokeStyle = "#1fb6d9";
    ctx.beginPath();
    ctx.arc(p.x - 0.4, p.y - 0.4, p.r * 0.75, 3.8, 5.0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawHoles(ctx, v) {
  for (const h of v.holes) {
    if (h.state === "shut") {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
      ctx.lineWidth = 0.4;
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([1, 1]);
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, TAU);
      ctx.stroke();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
      continue;
    }
    if (h.state === "warn") {
      ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(v.clock / 80));
      ctx.fillStyle = DANGER;
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const grad = radial(ctx, h.x, h.y, 0, h.r, [[0, "#000000"], [0.7, "#0d0906"], [1, "#3a2410"]]);
    ctx.fillStyle = grad || "#0d0906";
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#b8892a";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }
}

function drawBumpers(ctx, v) {
  for (const b of v.round.bumpers) {
    const lit = v.fx.bumps.some((h) => Math.abs(h.x - b.x) < 0.5 && Math.abs(h.y - b.y) < 0.5);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.beginPath();
    ctx.arc(b.x + 0.4, b.y + 0.8, b.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? "#ffffff" : "#e2553f";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.62, 0, TAU);
    ctx.fill();
    ctx.fillStyle = lit ? GOLD : "#e2553f";
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r * 0.32, 0, TAU);
    ctx.fill();
  }
}

// The magnet in the middle, its rings running in (a pull) or out (a push),
// and flashing before it turns.
function drawMagnet(ctx, v) {
  const m = v.round.magnet;
  if (!m) return;
  const { g } = v;
  const pull = m.pull > 0;
  const color = pull ? "#1fb6d9" : DANGER;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.6;
  for (let k = 0; k < 4; k++) {
    let p = ((v.clock / 1400 + k / 4) % 1 + 1) % 1;
    if (pull) p = 1 - p;
    ctx.globalAlpha = 0.45 * Math.sin(p * Math.PI);
    ctx.beginPath();
    ctx.arc(g.CX, g.CY, 5 + p * (v.round.R - 6), 0, TAU);
    ctx.stroke();
  }
  ctx.globalAlpha = v.magnetWarn ? 0.5 + 0.5 * Math.abs(Math.sin(v.clock / 80)) : 1;
  ctx.fillStyle = "#3a3d48";
  ctx.beginPath();
  ctx.arc(g.CX, g.CY, 4.2, 0, TAU);
  ctx.fill();
  // A horseshoe.
  ctx.lineWidth = 1.5;
  ctx.lineCap = "butt";
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(g.CX, g.CY + 0.4, 2, Math.PI, TAU);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(g.CX - 2.75, g.CY + 0.3, 1.5, 1.2);
  ctx.fillRect(g.CX + 1.25, g.CY + 0.3, 1.5, 1.2);
  ctx.globalAlpha = 1;
}

/* ---------------------------------------------------------------- pads */

// A pad's picture, white, centered on x, y and about 2s across.
function glyph(ctx, kind, x, y, s) {
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = s * 0.24;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "heavy") {
    // A weight with a handle.
    ctx.moveTo(x - s * 0.75, y + s * 0.7);
    ctx.lineTo(x - s * 0.5, y - s * 0.3);
    ctx.lineTo(x + s * 0.5, y - s * 0.3);
    ctx.lineTo(x + s * 0.75, y + s * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - s * 0.45, s * 0.28, Math.PI, TAU);
    ctx.stroke();
  } else if (kind === "spring") {
    ctx.moveTo(x - s * 0.6, y + s * 0.8);
    for (let k = 0; k < 5; k++) ctx.lineTo(x + (k % 2 ? -0.6 : 0.6) * s, y + s * (0.5 - k * 0.32));
    ctx.stroke();
  } else if (kind === "charge") {
    ctx.moveTo(x + s * 0.2, y - s * 0.9);
    ctx.lineTo(x - s * 0.5, y + s * 0.1);
    ctx.lineTo(x - s * 0.05, y + s * 0.1);
    ctx.lineTo(x - s * 0.2, y + s * 0.9);
    ctx.lineTo(x + s * 0.5, y - s * 0.15);
    ctx.lineTo(x + s * 0.05, y - s * 0.15);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "shield") {
    ctx.moveTo(x, y - s * 0.85);
    ctx.lineTo(x + s * 0.7, y - s * 0.5);
    ctx.quadraticCurveTo(x + s * 0.6, y + s * 0.5, x, y + s * 0.9);
    ctx.quadraticCurveTo(x - s * 0.6, y + s * 0.5, x - s * 0.7, y - s * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "grow") {
    ctx.moveTo(x - s * 0.7, y - s * 0.2);
    ctx.lineTo(x - s * 0.7, y - s * 0.7);
    ctx.lineTo(x - s * 0.2, y - s * 0.7);
    ctx.moveTo(x + s * 0.7, y + s * 0.2);
    ctx.lineTo(x + s * 0.7, y + s * 0.7);
    ctx.lineTo(x + s * 0.2, y + s * 0.7);
    ctx.moveTo(x - s * 0.6, y - s * 0.6);
    ctx.lineTo(x + s * 0.6, y + s * 0.6);
    ctx.stroke();
  } else if (kind === "ghost") {
    ctx.arc(x, y - s * 0.1, s * 0.6, Math.PI, 0);
    ctx.lineTo(x + s * 0.6, y + s * 0.75);
    ctx.lineTo(x + s * 0.3, y + s * 0.5);
    ctx.lineTo(x, y + s * 0.75);
    ctx.lineTo(x - s * 0.3, y + s * 0.5);
    ctx.lineTo(x - s * 0.6, y + s * 0.75);
    ctx.closePath();
    ctx.fill();
  } else if (kind === "slick") {
    ctx.moveTo(x, y - s * 0.9);
    ctx.quadraticCurveTo(x + s * 0.75, y + s * 0.05, x + s * 0.55, y + s * 0.45);
    ctx.arc(x, y + s * 0.35, s * 0.56, 0.2, Math.PI - 0.2);
    ctx.quadraticCurveTo(x - s * 0.75, y + s * 0.05, x, y - s * 0.9);
    ctx.fill();
  }
}

function drawPads(ctx, v) {
  for (const pad of v.round.pads) {
    if (pad.ttl < 2000 && Math.floor(v.clock / 120) % 2 === 0) continue;
    const color = v.powers[pad.kind].color;
    const s = 2.6 * (1 + 0.08 * Math.sin(v.clock / 120 + pad.x));
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    roundRect(ctx, pad.x - s, pad.y - s, s * 2, s * 2, s * 0.45);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 0.3;
    ctx.stroke();
    glyph(ctx, pad.kind, pad.x, pad.y, s * 0.6);
  }
}

/* ---------------------------------------------------------------- cars */

// Planny upright in his seat: a box with a star for an eye and a smile, his
// stick arms out to the wheel at the front of the car.
function drawPlanny(ctx, car, colors, cheer, scared) {
  const s = car.r * 0.46;
  const fx = Math.cos(car.face);
  const fy = Math.sin(car.face);
  const wheel = { x: fx * car.r * 0.62, y: fy * car.r * 0.62 };
  ctx.lineWidth = Math.max(0.3, s * 0.22);
  ctx.lineCap = "round";
  ctx.strokeStyle = colors.head;
  // The wheel, then the arms reaching for it (both up when he cheers).
  ctx.beginPath();
  ctx.arc(wheel.x, wheel.y, s * 0.42, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  if (cheer) {
    ctx.moveTo(-s, -s * 0.3);
    ctx.lineTo(-s * 1.55, -s * 1.3);
    ctx.moveTo(s, -s * 0.3);
    ctx.lineTo(s * 1.55, -s * 1.3);
  } else {
    ctx.moveTo(-s, s * 0.1);
    ctx.lineTo(wheel.x - fy * s * 0.4, wheel.y + fx * s * 0.4);
    ctx.moveTo(s, s * 0.1);
    ctx.lineTo(wheel.x + fy * s * 0.4, wheel.y - fx * s * 0.4);
  }
  ctx.stroke();
  roundRect(ctx, -s, -s, s * 2, s * 2, s * 0.4);
  ctx.fillStyle = colors.board;
  ctx.fill();
  ctx.stroke();
  star(ctx, 0, -s * 0.28, s * 0.5, s * 0.22, scared ? Math.PI / 5 : 0);
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.beginPath();
  if (scared) ctx.arc(0, s * 0.62, s * 0.18, 0, TAU);
  else ctx.arc(0, s * 0.3, s * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

// A rival's face on its car, looking the way it pushes.
function drawFace(ctx, car, look, ko) {
  const r = car.r;
  const px = -look.y;
  const py = look.x;
  if (car.kind === "turtle") {
    // A shell hump, and the head peeking out at the front.
    ctx.fillStyle = "#1d7a48";
    ctx.beginPath();
    ctx.arc(-look.x * r * 0.12, -look.y * r * 0.12, r * 0.58, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#57e39a";
    ctx.lineWidth = 0.25;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(-look.x * r * 0.12, -look.y * r * 0.12);
      ctx.lineTo(-look.x * r * 0.12 + Math.cos(a) * r * 0.55, -look.y * r * 0.12 + Math.sin(a) * r * 0.55);
      ctx.stroke();
    }
    ctx.fillStyle = "#8fe0a8";
    ctx.beginPath();
    ctx.arc(look.x * r * 0.62, look.y * r * 0.62, r * 0.26, 0, TAU);
    ctx.fill();
  }
  const ex = car.kind === "turtle" ? look.x * r * 0.68 : look.x * r * 0.22;
  const ey = car.kind === "turtle" ? look.y * r * 0.68 : look.y * r * 0.22;
  const spread = car.kind === "turtle" ? r * 0.12 : r * 0.28;
  const eye = car.kind === "turtle" ? r * 0.09 : r * 0.2;
  for (const side of [-1, 1]) {
    const x = ex + px * side * spread;
    const y = ey + py * side * spread;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, eye, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = "#1d1a17";
    ctx.fillStyle = "#1d1a17";
    ctx.lineWidth = Math.max(0.15, eye * 0.35);
    if (ko) {
      ctx.beginPath();
      ctx.moveTo(x - eye * 0.6, y - eye * 0.6);
      ctx.lineTo(x + eye * 0.6, y + eye * 0.6);
      ctx.moveTo(x + eye * 0.6, y - eye * 0.6);
      ctx.lineTo(x - eye * 0.6, y + eye * 0.6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(x + look.x * eye * 0.35, y + look.y * eye * 0.35, eye * 0.5, 0, TAU);
      ctx.fill();
    }
    if (car.kind === "bully" && !ko) {
      // Angry brows, slanting in.
      ctx.lineWidth = r * 0.09;
      ctx.beginPath();
      ctx.moveTo(x - look.x * eye * 1.3 + px * side * eye * 0.9, y - look.y * eye * 1.3 + py * side * eye * 0.9);
      ctx.lineTo(x + look.x * eye * 0.1 - px * side * eye * 0.9 + look.x * eye * 1.6, y + look.y * eye * 0.1 - py * side * eye * 0.9 + look.y * eye * 1.6);
      ctx.stroke();
    }
  }
  if (car.kind === "sniper") {
    // A visor band across the eyes.
    ctx.strokeStyle = "rgba(20, 10, 40, 0.75)";
    ctx.lineWidth = eye * 1.1;
    ctx.beginPath();
    ctx.moveTo(ex - px * r * 0.5, ey - py * r * 0.5);
    ctx.lineTo(ex + px * r * 0.5, ey + py * r * 0.5);
    ctx.stroke();
    ctx.fillStyle = "#ff4fa3";
    ctx.beginPath();
    ctx.arc(ex + px * spread, ey + py * spread, eye * 0.35, 0, TAU);
    ctx.fill();
  } else if (car.kind === "scrapper") {
    // A bandage over one eye's corner.
    ctx.save();
    ctx.translate(-look.x * r * 0.3 - px * r * 0.35, -look.y * r * 0.3 - py * r * 0.35);
    if (typeof ctx.rotate === "function") ctx.rotate(Math.atan2(look.y, look.x) + 0.6);
    ctx.fillStyle = "#f2d3a7";
    ctx.fillRect(-r * 0.32, -r * 0.1, r * 0.64, r * 0.2);
    ctx.restore();
  } else if (car.kind === "mirror") {
    // A shine across the chrome.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = r * 0.12;
    ctx.beginPath();
    ctx.moveTo(-r * 0.55, r * 0.05);
    ctx.lineTo(-r * 0.05, -r * 0.55);
    ctx.stroke();
  }
}

// One car: the rubber bumper all round, the body, the nose it faces with,
// any power it holds, and its driver. `t` is how far it has fallen (0 to 1).
function drawCar(ctx, car, v, opts) {
  const { colors, clock } = v;
  const you = car.id === 0;
  const color = you ? colors.you : car.color;
  const t = car.alive ? 0 : 1 - car.fall / v.fallMs;
  const scale = car.alive ? 1 : Math.max(0.05, 1 - t * 0.9);
  ctx.save();
  ctx.translate(car.x, car.y + (car.alive ? 0 : t * 3));
  ctx.scale(scale, scale);
  const alpha = car.alive ? (car.ghost ? 0.45 : 1) : Math.max(0, 1 - t);
  ctx.globalAlpha = alpha;
  const wob = opts.teeter ? Math.sin(clock / 40) * 0.25 : 0;
  if (typeof ctx.rotate === "function") ctx.rotate(car.alive ? wob : car.face);
  const r = car.r;
  // A wound-up rival revs: a ring pulsing at it.
  if (car.windup > 0) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = alpha * (0.5 + 0.5 * Math.abs(Math.sin(clock / 45)));
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.2 + Math.abs(Math.sin(clock / 45)) * 0.8, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  if (car.alive) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.beginPath();
    ctx.arc(0.35, 0.8, r, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = car.heavy ? "#0e0d12" : RUBBER;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.8, 0, TAU);
  ctx.fill();
  const fx = Math.cos(car.face);
  const fy = Math.sin(car.face);
  if (car.alive) {
    // The nose.
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(fx * r * 0.82, fy * r * 0.82, r * 0.2, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(-r * 0.25, -r * 0.3, r * 0.42, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = alpha;
  }
  if (car.heavy) {
    ctx.strokeStyle = "#7a5cff";
    ctx.lineWidth = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, r - 0.3, 0, TAU);
    ctx.stroke();
  }
  if (car.spring) {
    ctx.strokeStyle = "#ff4fa3";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a = (k / 24) * TAU + clock / 300;
      const rr = r + 0.6 + (k % 2 ? 0.55 : 0);
      if (k) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.stroke();
  }
  if (car.shield) {
    ctx.strokeStyle = "#1fb6d9";
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = alpha * (0.6 + 0.3 * Math.sin(clock / 120));
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.1, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }
  if (!car.alive && typeof ctx.rotate === "function") ctx.rotate(-car.face);
  if (you) drawPlanny(ctx, car, colors, opts.cheer, opts.teeter || !car.alive);
  else {
    const look = car.push && (car.push.x || car.push.y) ? car.push : { x: fx, y: fy };
    drawFace(ctx, car, look, !car.alive);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Speed lines behind a dashing car.
function drawTrails(ctx, v) {
  for (const s of v.fx.streaks) {
    ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.5;
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * (0.5 + 0.5 * (s.life / s.max)), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ----------------------------------------------------------- the chrome */

const pillWidth = (h, text) => h * 0.7 + text.length * h * 0.42;

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${h * 0.62}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = pillWidth(h, text);
  drawPill(ctx, x, y, w, h, text, color, fill, y + h * 0.54);
  return w;
}

// Where the pills go, `h` units tall on a board `W` wide: the arena, lives,
// dash charges (the next one filling) and rivals left along the top, then
// each power you hold; the ring's countdown on the right. A pill that would
// run into the countdown or off the board starts a row below, so on a small
// board with a few powers held nothing overlaps.
export function hudLayout(h, W, lives, hud) {
  const gap = h * 0.3;
  const edge = h * 0.4;
  const y0 = h * 0.35;
  const out = [];
  let ring = null;
  if (hud.ring) {
    const w = pillWidth(h, hud.ring.text);
    ring = { x: W - w - edge, y: y0, w, text: hud.ring.text, color: hud.ring.color, fill: 1 };
  }
  let x = edge;
  let y = y0;
  const place = (text, color, fill = 1) => {
    const w = pillWidth(h, text);
    const limit = y === y0 && ring ? ring.x - gap : W - edge;
    if (x > edge && x + w > limit) {
      x = edge;
      y += h + gap;
    }
    out.push({ x, y, w, text, color, fill });
    x += w + gap;
  };
  place(hud.arena, "#ffffff");
  place(livesText(lives), LIVES);
  place(`DASH ${"●".repeat(hud.charges)}${"○".repeat(Math.max(0, hud.maxCharges - hud.charges))}`, "#ff8a1f", hud.charges < hud.maxCharges ? hud.recharge : 1);
  place(hud.left === 1 ? "1 RIVAL" : `${hud.left} RIVALS`, "#ffffff");
  for (const p of hud.powers) place(p.text, p.color, p.fill);
  if (ring) out.push(ring);
  return out;
}

function drawHud(ctx, v) {
  for (const p of hudLayout(v.pillH, v.g.W, v.round.infinite ? Infinity : v.round.lives, v.hud)) pill(ctx, p.x, p.y, v.pillH, p.text, p.color, p.fill);
}

// A banner is a light strip across the board, on the half away from you,
// fading almost clear while you drive under it.
function drawBanner(ctx, v, b) {
  const w = v.g.W;
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

// The ready and over screens' strip along the bottom: a line or two, then one
// dot per arena, lit for those reached, and past the ninth the Final reached.
function drawTally(ctx, v, lines) {
  const { g } = v;
  const top = g.H - 17;
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, g.W, 17);
  lines.forEach((text, i) => label(ctx, text, g.W / 2, top + 3.4 + i * 4.2, i ? 2.5 : 3, i ? "#ffffff" : GOLD, "center", g.W - 6));
  const r = 1.2;
  const step = r * 3.2;
  const x = g.W / 2 - ((v.maxArena - 1) * step) / 2;
  const y = top + 13.2;
  for (let i = 0; i < v.maxArena; i++) {
    ctx.beginPath();
    ctx.arc(x + i * step, y, r, 0, TAU);
    if (i < v.furthest) {
      ctx.fillStyle = arenaColor(i + 1);
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
  if (v.furthest > v.maxArena) label(ctx, `+${v.furthest - v.maxArena}`, x + v.maxArena * step + 0.6, y, 2.2, GOLD, "left");
}

/* --------------------------------------------------------------- scene */

// The whole frame. `v` is the view bumper.js builds: the round, the board's
// geometry `g`, the scale `u`, the colors, the effects, the state and the
// lines for the start and end screens.
export function drawScene(ctx, v) {
  ctx.save();
  ctx.scale(v.u, v.u);
  if (v.shake) ctx.translate(v.shake.x, v.shake.y);
  drawVoid(ctx, v);
  // Cars falling into the void are drawn under the ring.
  const fallen = v.round.cars.filter((c) => !c.alive && c.fall > 0 && !c.hole);
  for (const car of fallen) drawCar(ctx, car, v, {});
  drawDrops(ctx, v);
  drawPlatform(ctx, v);
  drawIce(ctx, v);
  drawHoles(ctx, v);
  for (const car of v.round.cars) if (!car.alive && car.fall > 0 && car.hole) drawCar(ctx, car, v, {});
  drawMagnet(ctx, v);
  drawWarnings(ctx, v);
  drawBumpers(ctx, v);
  drawPads(ctx, v);
  drawTrails(ctx, v);
  // You on top of everyone.
  const order = v.round.cars.filter((c) => c.alive).sort((a, b) => b.id - a.id);
  for (const car of order) drawCar(ctx, car, v, { teeter: car.id === 0 && v.teeter, cheer: car.id === 0 && v.cheer });
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
  // Before a heat: everyone's name over their car.
  if (v.round.phase === "ready" && (v.state === "running" || v.state === "paused")) {
    for (const car of v.round.cars) label(ctx, car.id === 0 ? "YOU" : car.name.toUpperCase(), car.x, car.y - car.r - 2.4, 2.4, car.id === 0 ? "#ffffff" : car.color);
  }
  for (const f of v.fx.floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
    label(ctx, f.text, f.x, f.y, f.size || 2.8, f.color);
  }
  ctx.globalAlpha = 1;
  if (v.combo) {
    const you = v.round.cars[0];
    const p = v.combo.life / v.combo.max;
    ctx.globalAlpha = Math.min(1, p * 3);
    label(ctx, `x${v.combo.n}`, you.x + you.r + 3.5, you.y - you.r - 2, 4 + (1 - Math.min(1, (1 - p) * 6)) * 2.5, GOLD);
    ctx.globalAlpha = 1;
  }
  if (v.flash) {
    ctx.globalAlpha = 0.28 * (v.flash.life / v.flash.max);
    ctx.fillStyle = v.flash.color;
    ctx.fillRect(-2, -2, v.g.W + 4, v.g.H + 4);
    ctx.globalAlpha = 1;
  }
  if (v.shake) ctx.translate(-v.shake.x, -v.shake.y);
  if (v.state === "running" || v.state === "paused") drawHud(ctx, v);
  if (v.state === "running" && v.banner) drawBanner(ctx, v, v.banner);
  if (v.tally) drawTally(ctx, v, v.tally);
  ctx.restore();
}
