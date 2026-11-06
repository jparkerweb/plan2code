// Plan2Code Web Console - Ghoul Rush's ending, drawn: four animated scenes (the house from the hill as its windows go out one by one, the road unfolding at dawn while YOU walk, the cottage it was once in the morning sun, the mailbox's FINAL NOTICE in close-up) in canvas shapes, with the page's heading, its lines typing out, the hints and the skip bar over them, the same layout as the intro story's pages.
//
// draw/ghoul-draw.js plugs it in: endingArt(d) takes its drawing helpers
// (`d`: label, GOLD, BONE, ...) and hands back { card(ctx, v), react(e, k) }.
// `card` is drawn over the whole field while `round.phase === "ending"` (also
// while paused); `round.ending.ms` is the page's clock, so a pause holds every
// animation. `react` answers only the ending's own events (a page turning);
// its timed sounds go out as the story's `storyTone`, which the game already
// plays. The words, colors and timings live in ghoul-ending.js. Field units
// (96 by 54), y counted down from the field's top; a scene gets the top
// SCENE_H units, the words the band below. No gradients (the tests' fake
// canvas has none): bands of flat color and alpha instead. Nothing here uses
// Math.random(): anything that moves follows the clock or `rnd`.

import { dot, faint, poly, rnd, stroke } from "./ghoul-intro-draw.js";
import { CHAR_MS, CLICK_OFF_MS, FLAG_MS, GAG_MS, LAST_HINT, LIGHTS_OUT, PAGES, REVEAL_AT_MS, SKIP_HINT, SKIP_HOLD_MS, SLIDE_MS, STAMP_MS, UNFOLD_MS, ENDING_HINT, lineAt, shown, turnable, typed } from "./ghoul-ending.js";

export const SCENE_H = 33;
export const TEXT_SIZE = 2.3;
const TAU = Math.PI * 2;
const W = 96;
const H = 54;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
// Eases 0..1 in and out.
const smooth = (x) => {
  const k = clamp(x);
  return k * k * (3 - 2 * k);
};
const rect = (ctx, x, y, w, h, fill) => {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
};
const circle = (ctx, x, y, r, fill) => dot(ctx, x, y, r, fill);
const ell = (ctx, x, y, rx, ry, fill) => {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
};
const turn = (ctx, a) => {
  if (typeof ctx.rotate === "function") ctx.rotate(a);
};
const star = (ctx, cx, cy, R, r, fill, rot = 0) => {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r : R;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  poly(ctx, pts, fill);
};
// A flicker for light number `i`: mostly on, now and then guttering.
const flick = (i, t) => clamp(0.65 + 0.35 * Math.sin(t / (150 + (i % 5) * 41) + i * 1.9) + 0.2 * Math.sin(t / 53 + i), 0.15, 1);

/* ------------------------------------------------------- shared pieces */

// A sky of flat bands from `top` down to `low`, `n` of them.
function bands(ctx, top, low, n = 8, to = SCENE_H) {
  for (let i = 0; i < n; i++) rect(ctx, 0, (i * to) / n, W, to / n + 0.1, mix(top, low, i / (n - 1)));
}
function stars(ctx, t, n, maxY, alpha = 1, color = "#ffffff") {
  for (let i = 0; i < n; i++) faint(ctx, alpha * (0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / (300 + rnd(i, 4) * 500) + i))), () => dot(ctx, rnd(i) * W, rnd(i, 1) * maxY, 0.14 + rnd(i, 2) * 0.16, color));
}
// A rolling hill line filled down to `to`.
function hills(ctx, base, amp, color, off, seed, to = SCENE_H) {
  const pts = [[0, to]];
  for (let x = 0; x <= W + 2; x += 2) pts.push([x, base - amp * (0.6 * Math.sin((x + off) * 0.07 + seed) + 0.4 * Math.sin((x + off) * 0.17 + seed * 2))]);
  pts.push([W + 2, to]);
  poly(ctx, pts, color);
}
// A hill's top: flat under what stands on it, then rounded shoulders easing down. Draw it after the house.
function knoll(ctx, cx, y, flat, slope, depth, color, to = SCENE_H) {
  const x0 = cx - flat - slope;
  const x1 = cx + flat + slope;
  const pts = [[x0, to]];
  for (let x = x0; x < x1 + 0.5; x += 1) pts.push([Math.min(x, x1), y + depth * smooth((Math.abs(Math.min(x, x1) - cx) - flat) / slope)]);
  pts.push([x1, to]);
  poly(ctx, pts, color);
}
// Grass tufts along a crest.
function tufts(ctx, x0, x1, y, color, t = 0) {
  for (let x = x0; x < x1; x += 1.7) stroke(ctx, x, y + 0.2, x + 0.3 + Math.sin(t / 400 + x) * 0.3, y - 0.8 - rnd(x) * 0.5, color, 0.18);
}
// A soft round cloud of three puffs, `s` its size.
function cloud(ctx, x, y, s, color) {
  ell(ctx, x, y, 4 * s, 1.3 * s, color);
  circle(ctx, x - 1.6 * s, y - 0.7 * s, 1.5 * s, color);
  circle(ctx, x + 0.8 * s, y - 1.1 * s, 1.9 * s, color);
  circle(ctx, x + 2.6 * s, y - 0.4 * s, 1.2 * s, color);
}
// A bird far off: a little flapping V.
function bird(ctx, x, y, s, t, i, color = "#2a2a3a") {
  const f = Math.sin(t / 120 + i * 1.7) * 0.9;
  stroke(ctx, x - 1.2 * s, y - 0.5 * s + f * 0.5 * s, x, y, color, 0.22 * s);
  stroke(ctx, x, y, x + 1.2 * s, y - 0.5 * s + f * 0.5 * s, color, 0.22 * s);
}
// A mix of two #rrggbb colors, `k` of the way from a to b, as #rrggbb (so a mix can be mixed again).
function mix(a, b, k) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * clamp(k)).toString(16).padStart(2, "0")).join("")}`;
}

// The house in silhouette, the same as the intro story draws it (so YOU know it at once): its feet at (x, y), `s` times its size, about 34 units wide and 25 tall at s 1, ten windows (`win(i)` -> { c, a }, or null for a dark one).
const WINS = [[-14, -14], [-14, -9], [-8.5, -9], [-5, -9], [3.5, -9], [7, -9], [-8.5, -4.6], [7, -4.6], [11.5, -5.4], [-1, -15.2]];
const roofAt = (dx) => -19.5 + (Math.abs(dx) / 11) * 8.5;
function house(ctx, x, y, s, o = {}) {
  const t = o.t || 0;
  const body = o.body || "#0c0815";
  const rr = (dx, dy, w, h, c) => rect(ctx, x + dx * s, y + dy * s, w * s, h * s, c);
  const tri = (pts, c) => poly(ctx, pts.map(([px, py]) => [x + px * s, y + py * s]), c);
  rr(-15, -17, 5, 17, body);
  tri([[-16, -17], [-12.5, -25], [-9, -17]], body);
  rr(10, -8, 7, 8, body);
  tri([[9, -8], [13.5, -13.5], [18, -8]], body);
  rr(-10, -11, 20, 11, body);
  tri([[-11, -11], [0, -19.5], [11, -11]], body);
  rr(4.8, -22, 2.4, Math.max(roofAt(4.8), roofAt(7.2)) + 23.5, body);
  rr(4.4, -22.5, 3.2, 0.8, body);
  rr(-11.5, -17.2, 9, 0.4, o.trim || "#1a1228");
  rr(-16.5, -1.5, 35, 1.5, o.stone || "#1b1530");
  WINS.forEach(([dx, dy], i) => {
    const w = o.win ? o.win(i) : { c: "#ffd27a", a: flick(i, t) };
    if (!w || !(w.a > 0)) {
      rr(dx, dy, 2, 2.6, o.dark || "#05030a");
      return;
    }
    faint(ctx, w.a * 0.14, () => rr(dx - 0.7, dy - 0.7, 3.4, 4, w.c));
    faint(ctx, w.a, () => rr(dx, dy, 2, 2.6, w.c));
    rr(dx + 0.9, dy, 0.2, 2.6, body);
    rr(dx, dy + 1.2, 2, 0.2, body);
  });
  rr(-1.7, -4.8, 3.4, 4.8, o.dark || "#050308");
  circle(ctx, x, y - 4.8 * s, 1.7 * s, o.dark || "#050308");
}

// YOU, facing `face` (1 right, -1 left), feet at (x, y), `s` times the size (4.4 units tall at s 1): a box, a star for an eye, stick arms and two small feet, a flashlight in one hand. `o`: t, walk, lit (the lens's glow), wave (the free arm up), sweat (a drop by the head, 0..1).
function hero(ctx, x, y, s, face, o = {}) {
  const t = o.t || 0;
  const stepA = o.walk ? Math.sin(t / 130) : 0;
  const bob = o.walk ? Math.abs(stepA) * 0.28 : 0;
  ctx.save();
  ctx.translate(x, y - bob * s);
  ctx.scale(s * face, s);
  ctx.lineCap = "round";
  for (const k of [-1, 1]) {
    const fx = k * 0.75 + (o.walk ? stepA * 0.7 * k : 0);
    stroke(ctx, k * 0.6, -1.2, fx, -0.2, "#cfc4a6", 0.32);
    ell(ctx, fx + 0.15, -0.18, 0.6, 0.32, "#cfc4a6");
  }
  stroke(ctx, -1.6, -2.7, -2.2 - (o.wave ? 0.4 : 0), o.wave ? -5.2 + Math.sin(t / 160) * 0.4 : -1.6 + (o.walk ? stepA * 0.5 : 0), "#cfc4a6", 0.32);
  rect(ctx, -1.6, -4.4, 3.2, 3.2, "#1e2838");
  ctx.strokeStyle = "#cfc4a6";
  ctx.lineWidth = 0.22;
  ctx.strokeRect(-1.6, -4.4, 3.2, 3.2);
  star(ctx, 0.15, -3.6, 0.95, 0.4, "#ffd24a", Math.sin(t / 900) * 0.15);
  ctx.beginPath();
  ctx.arc(0.15, -2.55, 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 0.18;
  ctx.strokeStyle = "#cfc4a6";
  ctx.stroke();
  // The flashlight: held out level, or let down by YOUR side once it is off.
  if (o.down) {
    stroke(ctx, 1.6, -2.6, 1.9, -1.5, "#cfc4a6", 0.32);
    rect(ctx, 1.6, -1.6, 0.7, 1.4, "#4a4f5a");
  } else {
    stroke(ctx, 1.6, -2.6, 2.5, -2.25, "#cfc4a6", 0.32);
    rect(ctx, 2.3, -2.6, 1.6, 0.7, "#4a4f5a");
    rect(ctx, 3.7, -2.75, 0.4, 1, "#c9ced6");
  }
  if (o.sweat > 0) faint(ctx, o.sweat, () => {
    poly(ctx, [[-2.1, -4.9], [-2.5, -4.1], [-1.7, -4.1]], "#9fd8ff");
    circle(ctx, -2.1, -4.05, 0.4, "#9fd8ff");
  });
  ctx.lineCap = "butt";
  ctx.restore();
  if (o.lit > 0) faint(ctx, o.lit * 0.9, () => circle(ctx, x + face * 4.1 * s, y - 2.25 * s - bob * s, 0.7 * s, "#fffbe0"));
  return { x: x + face * 4.2 * s, y: y - 2.25 * s - bob * s };
}
// A cone of light from `from`, `len` units long (negative points left), `spread` wide at the far end, `tilt` down.
function beam(ctx, from, len, spread, alpha, color = "#fff3b0", tilt = 0) {
  if (!(alpha > 0)) return;
  for (let i = 0; i < 3; i++) {
    const sp = spread * (1 - i * 0.3);
    faint(ctx, alpha * (0.12 + i * 0.06), () => poly(ctx, [[from.x, from.y - 0.3], [from.x + len, from.y + tilt - sp], [from.x + len, from.y + tilt + sp], [from.x, from.y + 0.3]], color));
  }
}

/* ------------------------------------------------------------- scenes */

// How lit window `i` is at `t` on LIGHTS OUT: 1 before its time, fading over a moment after (null once out).
const OUT_FADE_MS = 320;
const outAt = Object.fromEntries(LIGHTS_OUT.map(([i, ms]) => [i, ms]));
const LAST_OUT = LIGHTS_OUT[LIGHTS_OUT.length - 1][1];
export function windowLit(i, t) {
  const at = outAt[i];
  if (at === undefined) return 1;
  return clamp(1 - (t - at) / OUT_FADE_MS);
}

// How far the road is flat on THE ROAD: segment `i` of `n` (0 nearest YOU) flops flat in turn, the far end first.
const ROAD_SEGS = 11;
const SEG_MS = 230;
export function roadFlat(i, t) {
  return smooth((t - UNFOLD_MS - (ROAD_SEGS - 1 - i) * SEG_MS) / 360);
}
// When the last segment (at YOUR feet) is flat and YOU set off.
const WALK_AT = UNFOLD_MS + ROAD_SEGS * SEG_MS + 200;

const SCENES = {
  // LIGHTS OUT: the house from the hill at night, every window lit; they go out one by one to a falling tone each, until only the attic's is left, a long breath, then that one too. As the house goes dark the stars come out, and YOU, small on the near hill, let the flashlight drop.
  lights(ctx, p) {
    const { t, pal } = p;
    bands(ctx, "#05040f", "#1e1a44", 8);
    const left = LIGHTS_OUT.filter(([i]) => windowLit(i, t) > 0).length;
    const dark = 1 - left / LIGHTS_OUT.length;
    const after = smooth((t - LAST_OUT) / 1500);
    stars(ctx, t, 60, 20, 0.25 + 0.75 * Math.max(dark, after));
    // A thin moon, low.
    circle(ctx, 18, 7, 2.2, "#e8e4ff");
    circle(ctx, 19, 6.4, 2, mix("#05040f", "#1e1a44", 0.2));
    faint(ctx, 0.06, () => circle(ctx, 18, 7, 4.5, "#e8e4ff"));
    hills(ctx, 24, 1.6, "#0b0920", 0, 2);
    // The house, its windows going out; the glow over it fading with them.
    house(ctx, 60, 24, 0.82, { t, body: "#07050f", win: (i) => {
      const k = windowLit(i, t);
      if (!(k > 0)) return null;
      // The very last, on its own: it holds steadier, like an eye left open.
      return { c: i === 9 ? "#ffe08a" : "#ffc15a", a: k * (left === 1 ? 0.95 : flick(i, t)) };
    } });
    // A puff of smoke from each window that goes out.
    for (const [i, at] of LIGHTS_OUT) {
      const q = (t - at) / 1100;
      if (q < 0 || q > 1) continue;
      const [dx, dy] = WINS[i];
      faint(ctx, 0.2 * (1 - q), () => circle(ctx, 60 + (dx + 1) * 0.82 + Math.sin(q * 6 + i) * 0.4, 24 + dy * 0.82 - q * 3.5, 0.4 + q * 0.8, "#8a86a8"));
    }
    knoll(ctx, 60.5, 24, 15, 24, 6, "#06050f");
    tufts(ctx, 46, 75, 24, "#030208", t);
    // The near hill, YOU on it, watching.
    poly(ctx, [[0, SCENE_H], [0, 27], [10, 26.2], [22, 26.6], [34, 28.5], [44, SCENE_H]], "#040309");
    tufts(ctx, 1, 33, 26.6, "#020105", t);
    const lens = hero(ctx, 15, 26.4, 1.1, 1, { t, down: t > LAST_OUT + 600 });
    if (t <= LAST_OUT + 600) beam(ctx, lens, 9, 1.4, 0.35 * (1 - smooth((t - LAST_OUT) / 600)), "#fff3b0", 2.6);
    // The very end: a breath of the house sagging down into its hill.
    if (after > 0) faint(ctx, 0.15 * after, () => rect(ctx, 0, 0, W, SCENE_H, "#05040f"));
  },

  // THE ROAD: dawn. The road out of the valley lies folded up like a napkin; it unfolds, segment by segment, from the far end toward YOU, creasing flat; then YOU walk it, toward the sunrise, the dark house far behind on its hill, and YOUR flashlight clicks off.
  road(ctx, p) {
    const { t, pal } = p;
    const dawn = smooth(t / 6000);
    bands(ctx, mix(pal.sky, "#4a3a6e", dawn), mix("#d9805a", "#ffb37a", dawn), 9, 27);
    stars(ctx, t, 20, 10, 0.5 * (1 - dawn));
    // The sun coming up over the far hills at the right.
    const sunY = 25 - dawn * 5;
    faint(ctx, 0.18, () => circle(ctx, 80, sunY, 9, "#ffd08a"));
    faint(ctx, 0.25, () => circle(ctx, 80, sunY, 6, "#ffe0a0"));
    circle(ctx, 80, sunY, 3.6, "#fff0c0");
    for (let i = 0; i < 3; i++) faint(ctx, 0.5, () => cloud(ctx, ((i * 37 + t / 260) % (W + 20)) - 10, 6 + i * 3.4, 0.8 + (i % 2) * 0.3, mix("#6a4a7a", "#ffc8a0", dawn * 0.8)));
    hills(ctx, 24, 1.8, mix("#2a1e3a", "#5a4060", dawn), 0, 4);
    // The house far behind at the left, dark on its hill, not a window lit.
    house(ctx, 12, 22.4, 0.3, { body: mix("#120c1e", "#3a2c40", dawn), stone: "#2a1f34", win: () => null });
    knoll(ctx, 12.2, 22.4, 5.5, 14, 5, mix("#1e162c", "#4a3650", dawn));
    hills(ctx, 27, 1.2, mix("#1c1428", "#3a2c3e", dawn), 30, 7);
    rect(ctx, 0, 28, W, SCENE_H - 28, mix(pal.ground, "#3a2c34", dawn));
    // The road along the ground: each segment folded up in a pleat until its turn, then flat, its creases still faintly showing.
    const segW = W / ROAD_SEGS;
    for (let i = 0; i < ROAD_SEGS; i++) {
      const x0 = i * segW;
      const flat = roadFlat(i, t);
      const h = (1 - flat) * 5;
      const up = i % 2;
      const top0 = 29.2 - (up ? h : h * 0.25);
      const top1 = 29.2 - (up ? h * 0.25 : h);
      poly(ctx, [[x0, 31], [x0 + segW, 31], [x0 + segW, top1], [x0, top0]], up ? "#4a4258" : "#3c354a");
      if (flat < 1) faint(ctx, 0.5 * (1 - flat), () => stroke(ctx, x0, top0, x0 + segW, top1, "#b8aac8", 0.18));
      faint(ctx, 0.25, () => rect(ctx, x0 - 0.06, 29.2, 0.12, 1.8, "#a898b8"));
      // The middle line, painted on, which only reads once a segment lies flat.
      if (flat > 0.9) rect(ctx, x0 + segW * 0.3, 30, segW * 0.4, 0.25, "#d8c890");
    }
    // A puff of dust as each segment slaps down.
    for (let i = 0; i < ROAD_SEGS; i++) {
      const at = UNFOLD_MS + (ROAD_SEGS - 1 - i) * SEG_MS + 300;
      const q = (t - at) / 600;
      if (q < 0 || q > 1) continue;
      faint(ctx, 0.3 * (1 - q), () => ell(ctx, (i + 0.5) * segW, 30.6 - q, 1.5 + q * 2, 0.5 + q * 0.4, "#c8b8c8"));
    }
    // YOU: waiting at the left until the road reaches YOUR feet, then walking.
    const walk = Math.max(0, t - WALK_AT);
    const x = 10 + Math.min(52, walk / 120);
    const off = t >= CLICK_OFF_MS;
    const lens = hero(ctx, x, 29.6, 1.25, 1, { t, walk: walk > 0, down: off });
    if (!off) beam(ctx, lens, 14, 1.8, 0.4 * (1 - dawn * 0.5), "#fff3b0", 0.6);
    // A bird crossing the dawn.
    if (t > 2400) bird(ctx, ((t - 2400) / 40) % (W + 10) - 5, 9 + Math.sin(t / 700) * 1.5, 1, t, 0);
  },

  // MORNING: broad day. The House is only a small, sagging, empty cottage on its hill in the sun: a bowed roof with shingles missing, a crooked chimney, a door hanging open, one boarded window, ivy and daisies; clouds drift, birds wheel, one hops along the ridge; YOU stand by the gate, the flashlight off at YOUR side.
  morning(ctx, p) {
    const { t, pal } = p;
    bands(ctx, "#5aa6e0", pal.sky, 8, 27);
    faint(ctx, 0.2, () => circle(ctx, 82, 6, 7, "#fff3b0"));
    circle(ctx, 82, 6, 3.4, "#fff6cc");
    for (let i = 0; i < 4; i++) cloud(ctx, ((i * 29 + t / 300) % (W + 24)) - 12, 5 + (i % 3) * 3, 0.9 + (i % 2) * 0.4, "#f4f8ff");
    hills(ctx, 25, 1.5, "#7cb46a", 0, 3);
    rect(ctx, 0, 27, W, SCENE_H - 27, pal.ground);
    knoll(ctx, 52, 25, 12, 16, 3, "#5d9a4c");
    // The cottage: a low box, a roof that sags in the middle.
    const cx = 52;
    const gy = 25;
    const wall = "#a89884";
    const sag = 0.9 + 0.08 * Math.sin(t / 1600);
    rect(ctx, cx - 10, gy - 8, 20, 8, wall);
    for (let k = 0; k < 6; k++) rect(ctx, cx - 10, gy - 8 + k * 1.35, 20, 0.12, "#8e7e6c");
    poly(ctx, [[cx - 11.5, gy - 8], [cx - 6, gy - 14.5], [cx, gy - 14.5 + sag * 1.6], [cx + 6, gy - 14.5], [cx + 11.5, gy - 8]], "#6a4a3a");
    // Shingles in rows, a few missing, kept inside the roof's outline.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 11.5, gy - 8);
    ctx.lineTo(cx - 6, gy - 14.5);
    ctx.lineTo(cx, gy - 14.5 + sag * 1.6);
    ctx.lineTo(cx + 6, gy - 14.5);
    ctx.lineTo(cx + 11.5, gy - 8);
    ctx.closePath();
    ctx.clip();
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 9; k++) {
        if (rnd(r * 9 + k, 3) < 0.18) continue;
        const sx = cx - 9.5 + k * 2.2 + (r % 2) * 1.1;
        const sy = gy - 9.2 - r * 1.4 + (Math.abs(sx - cx) < 6 ? sag * 1.6 * (1 - Math.abs(sx - cx) / 6) * (r / 4) : 0);
        rect(ctx, sx, sy, 1.9, 0.35, "#553a2e");
      }
    }
    ctx.restore();
    // The chimney, crooked, with no smoke at all.
    ctx.save();
    ctx.translate(cx + 5.5, gy - 14.2);
    turn(ctx, 0.12);
    rect(ctx, -0.9, -3.2, 1.8, 3.4, "#8a5a48");
    rect(ctx, -1.1, -3.5, 2.2, 0.5, "#6a4436");
    ctx.restore();
    // The door hanging open, the dark inside just dark.
    rect(ctx, cx - 1.4, gy - 4.8, 2.8, 4.8, "#2a201c");
    poly(ctx, [[cx + 1.4, gy - 4.8], [cx + 2.8, gy - 4.3], [cx + 2.8, gy - 0.3], [cx + 1.4, gy]], "#7a5a3e");
    // A window with its shutter hanging, and one boarded up.
    rect(ctx, cx - 7.5, gy - 6, 2.6, 2.4, "#3a4a5a");
    rect(ctx, cx - 6.3, gy - 6, 0.2, 2.4, wall);
    poly(ctx, [[cx - 4.9, gy - 6], [cx - 3.6, gy - 5.6], [cx - 3.9, gy - 3.4], [cx - 4.9, gy - 3.6]], "#5a7a5a");
    rect(ctx, cx + 4.6, gy - 6, 2.6, 2.4, "#3a4a5a");
    for (const [a, oy] of [[0.25, -5.6], [-0.2, -4.4]]) {
      ctx.save();
      ctx.translate(cx + 5.9, gy + oy);
      turn(ctx, a);
      rect(ctx, -1.8, -0.3, 3.6, 0.6, "#9a7a56");
      ctx.restore();
    }
    // Ivy up the left wall, daisies along the front.
    for (let k = 0; k < 14; k++) circle(ctx, cx - 9.6 + Math.sin(k * 1.3) * 0.6, gy - 0.5 - k * 0.55, 0.45, k % 2 ? "#3f7a3a" : "#4f8f44");
    for (let k = 0; k < 10; k++) {
      const fx = cx - 10 + k * 2.2 + rnd(k, 5);
      const sway = Math.sin(t / 500 + k) * 0.2;
      stroke(ctx, fx, gy + 0.6, fx + sway, gy - 0.6, "#3a6a2e", 0.12);
      circle(ctx, fx + sway, gy - 0.7, 0.32, "#ffffff");
      circle(ctx, fx + sway, gy - 0.7, 0.12, "#ffd34d");
    }
    tufts(ctx, 36, 70, gy, "#4a8a3a", t);
    // A bird hopping along the ridge, and two more wheeling over.
    const hop = Math.abs(Math.sin(t / 260)) * 0.6;
    const rx = cx - 4 + ((t / 900) % 8);
    ell(ctx, rx, gy - 14.9 + sag * 1.6 * (1 - Math.abs(rx - cx) / 6) - hop, 0.6, 0.4, "#3a3a4a");
    circle(ctx, rx + 0.5, gy - 15.3 + sag * 1.6 * (1 - Math.abs(rx - cx) / 6) - hop, 0.3, "#3a3a4a");
    for (let i = 0; i < 2; i++) bird(ctx, 30 + Math.cos(t / 1400 + i * 3) * 14, 8 + Math.sin(t / 900 + i) * 2.5, 1, t, i + 1);
    // The picket fence, a few pickets gone, and YOU by the gate.
    for (let x = 4; x < W; x += 2.4) {
      if (x > 20 && x < 27) continue;
      if (rnd(x, 9) < 0.12) continue;
      rect(ctx, x, 27.6, 0.6, 3.4, "#ece4d4");
      poly(ctx, [[x - 0.1, 27.6], [x + 0.3, 26.9], [x + 0.7, 27.6]], "#ece4d4");
    }
    rect(ctx, 0, 28.6, 20, 0.4, "#ddd4c0");
    rect(ctx, 27, 28.6, W - 27, 0.4, "#ddd4c0");
    hero(ctx, 23.5, 31.4, 1.2, 1, { t, down: true });
  },

  // FINAL NOTICE: the lawn's stuffed mailbox in close-up, in the sun, letters bursting from its mouth. The flag drops with a clack; a last envelope slides out on top of the pile; FINAL NOTICE thumps onto it in red; YOU, at the right, look at it and break into a sweat.
  notice(ctx, p) {
    const { t, pal } = p;
    bands(ctx, "#78b8e8", pal.sky, 6, 22);
    cloud(ctx, ((t / 340) % (W + 20)) - 10, 6, 1.1, "#f4f8ff");
    cloud(ctx, ((t / 340 + 55) % (W + 20)) - 10, 10, 0.8, "#f4f8ff");
    hills(ctx, 21, 1, "#86bc72", 0, 5);
    // The cottage, small and far off behind.
    rect(ctx, 14, 16.5, 7, 3.5, "#a89884");
    poly(ctx, [[13.4, 16.5], [15.5, 14.2], [17.5, 14.9], [19.5, 14.2], [21.6, 16.5]], "#6a4a3a");
    rect(ctx, 0, 22, W, SCENE_H - 22, pal.ground);
    tufts(ctx, 0, W, 22, "#3a6a2e", t);
    // The post.
    rect(ctx, 47, 20, 3, 14, "#5a4030");
    rect(ctx, 40, 19.4, 17, 1.4, "#4a3426");
    // Letters fallen in the grass.
    for (let k = 0; k < 5; k++) {
      ctx.save();
      ctx.translate(30 + k * 5 + rnd(k, 2) * 2, 30.5 + rnd(k, 4));
      turn(ctx, (rnd(k, 6) - 0.5) * 0.9);
      rect(ctx, -1.6, -0.9, 3.2, 1.8, k % 2 ? "#ece4cc" : "#d8cca8");
      ctx.restore();
    }
    // The box: a rounded tin tunnel, rusting, its mouth to the left.
    const bx = 36;
    const by = 9;
    const bw = 24;
    const bh = 10.4;
    ctx.beginPath();
    ctx.moveTo(bx, by + bh);
    ctx.lineTo(bx, by + bh * 0.45);
    ctx.arc(bx + bh * 0.45, by + bh * 0.45, bh * 0.45, Math.PI, Math.PI * 1.5);
    ctx.lineTo(bx + bw - bh * 0.45, by);
    ctx.arc(bx + bw - bh * 0.45, by + bh * 0.45, bh * 0.45, Math.PI * 1.5, 0);
    ctx.lineTo(bx + bw, by + bh);
    ctx.closePath();
    ctx.fillStyle = "#7a7682";
    ctx.fill();
    rect(ctx, bx + 3, by + 0.6, bw - 6, 1, "#9a96a2");
    faint(ctx, 0.6, () => ell(ctx, bx + 15, by + 7, 3.2, 1.2, "#8a4a2a"));
    faint(ctx, 0.5, () => ell(ctx, bx + 7, by + 8.6, 1.6, 0.6, "#8a4a2a"));
    rect(ctx, bx - 0.5, by + 1.2, 0.8, bh - 1.2, "#3a363e");
    // The bundle bursting out of its mouth.
    for (let k = 0; k < 7; k++) {
      ctx.save();
      ctx.translate(bx - 1, by + 2.4 + k * 1.1);
      turn(ctx, -0.4 + k * 0.13 + (rnd(k, 3) - 0.5) * 0.2);
      rect(ctx, -5 - (k % 3) * 0.6, -1, 6.5, 2, k % 2 ? "#ece4cc" : "#d4c8a2");
      ctx.strokeStyle = "#8a8070";
      ctx.lineWidth = 0.12;
      ctx.strokeRect(-5 - (k % 3) * 0.6, -1, 6.5, 2);
      ctx.restore();
    }
    // The flag at the right side: up, then down with a clack and a bounce.
    const drop = t < FLAG_MS ? 0 : clamp((t - FLAG_MS) / 160);
    const bounce = t < FLAG_MS + 160 ? 0 : Math.sin(clamp((t - FLAG_MS - 160) / 500) * Math.PI * 2) * 0.18 * (1 - clamp((t - FLAG_MS - 160) / 500));
    const ang = -Math.PI / 2 + drop * (Math.PI / 2) + bounce;
    ctx.save();
    ctx.translate(bx + bw - 3, by + 6);
    turn(ctx, ang);
    rect(ctx, 0, -0.35, 7, 0.7, "#c03030");
    rect(ctx, 5, -0.35, 2.4, 2.2, "#d84040");
    ctx.restore();
    circle(ctx, bx + bw - 3, by + 6, 0.5, "#3a363e");
    // The last envelope sliding out on top, then the stamp.
    const slide = smooth((t - SLIDE_MS) / 700);
    if (slide > 0) {
      ctx.save();
      // It comes out of the box's mouth: nothing of it shows inside the tin.
      ctx.beginPath();
      ctx.rect(0, 0, bx + 0.3, SCENE_H);
      ctx.clip();
      ctx.translate(bx + 5.5 - slide * 11, by + 2.4 - slide * 1.6);
      turn(ctx, -0.16 * slide);
      rect(ctx, -6, -2, 12, 4, "#f6f0dc");
      ctx.strokeStyle = "#8a8070";
      ctx.lineWidth = 0.14;
      ctx.strokeRect(-6, -2, 12, 4);
      poly(ctx, [[-6, -2], [0, 0.4], [6, -2]], "#e6dcc0");
      const pop = t < STAMP_MS ? 0 : clamp((t - STAMP_MS) / 140);
      if (pop > 0) {
        const k = 1 + (1 - pop) * 0.8;
        ctx.save();
        turn(ctx, -0.08);
        ctx.scale(k, k);
        ctx.strokeStyle = "#d42020";
        ctx.lineWidth = 0.3;
        ctx.strokeRect(-5.3, -1.4, 10.6, 2.8);
        ctx.font = "900 1.8px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#d42020";
        ctx.fillText("FINAL NOTICE", 0, 0.05, 10);
        ctx.restore();
      }
      ctx.restore();
    }
    // YOU at the right, looking at it, and then the sweat.
    const sweat = smooth((t - GAG_MS - 200) / 300);
    hero(ctx, 80, 31.6, 2.4, -1, { t, down: true, sweat });
    if (t >= STAMP_MS && t < STAMP_MS + 220) faint(ctx, 0.25 * (1 - (t - STAMP_MS) / 220), () => rect(ctx, 0, 0, W, SCENE_H, "#ffffff"));
  },
};

/* --------------------------------------------------------------- the page */

// The width of `text` as the label helper sets it (it must have just set the font), or a guess where a canvas cannot measure.
const widthOf = (ctx, text, size) => {
  const m = typeof ctx.measureText === "function" ? ctx.measureText(text) : null;
  return m && typeof m.width === "number" ? m.width : text.length * size * 0.58;
};

export function endingArt(d) {
  const { label, GOLD, BONE } = d;
  function card(ctx, v) {
    const { round } = v;
    const s = round.ending;
    if (!s) return;
    const pg = PAGES[s.page];
    const t = s.ms;
    const n = shown(pg, t, s.full);
    const line = lineAt(pg, n);
    const done = n >= pg.lines.reduce((c, l) => c + l.length, 0);
    ctx.save();
    ctx.globalAlpha = 1;
    rect(ctx, 0, 0, W, H, "#050308");
    // The scene, clipped to its top.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, SCENE_H);
    ctx.clip();
    const startOf = (i) => REVEAL_AT_MS + pg.lines.slice(0, i).reduce((c, l) => c + l.length, 0) * CHAR_MS;
    const grow = (i, ms = 1200) => (s.full || done ? 1 : smooth((t - startOf(i)) / ms));
    // A small shake as the stamp lands.
    const shake = pg.scene === "notice" && t >= STAMP_MS && t < STAMP_MS + 180 ? Math.sin(t / 12) * 0.35 * (1 - (t - STAMP_MS) / 180) : 0;
    if (shake) ctx.translate(shake, 0);
    SCENES[pg.scene](ctx, { t, pal: pg.pal, line, full: s.full || done, label, grow });
    ctx.restore();
    ctx.globalAlpha = 1;
    // A soft dark foot to the scene, and the band for the words.
    for (let i = 0; i < 4; i++) faint(ctx, 0.12, () => rect(ctx, 0, SCENE_H - (i + 1) * 0.6, W, 0.6, "#050308"));
    rect(ctx, 0, SCENE_H, W, H - SCENE_H, "#07050c");
    rect(ctx, 0, SCENE_H, W, 0.25, pg.pal.glow);
    // The heading, fading in.
    faint(ctx, clamp((t - 150) / 350), () => {
      label(ctx, pg.chapter, W / 2, SCENE_H + 2.3, 2.1, pg.pal.a, "center", W - 8);
      stroke(ctx, W / 2 - 14, SCENE_H + 4.1, W / 2 + 14, SCENE_H + 4.1, pg.pal.glow, 0.2);
    });
    // The lines typing out.
    typed(pg, n).forEach((text, i) => {
      if (!text) return;
      const full = pg.lines[i];
      label(ctx, "", 0, 0, TEXT_SIZE, BONE, "left");
      const x0 = W / 2 - widthOf(ctx, full, TEXT_SIZE) / 2;
      const y = SCENE_H + 6.7 + i * 3.35;
      label(ctx, text, x0, y, TEXT_SIZE, BONE, "left", W - 4);
      if (i === line && !done) {
        const w = widthOf(ctx, text, TEXT_SIZE);
        faint(ctx, 0.5 + 0.5 * Math.sin(t / 110), () => rect(ctx, x0 + w + 0.3, y - 1, 0.7, 2, pg.pal.glow));
      }
    });
    // The page dots, the skip hint and its bar.
    PAGES.forEach((_, i) => circle(ctx, 3 + i * 2.2, 3, i === s.page ? 0.7 : 0.35, i === s.page ? pg.pal.glow : "rgba(255, 255, 255, 0.45)"));
    faint(ctx, 0.85, () => label(ctx, SKIP_HINT.toUpperCase(), W - 3, 3, 1.5, BONE, "right", 40));
    if (s.hold >= 0) {
      const k = clamp(s.hold / SKIP_HOLD_MS);
      rect(ctx, W - 3 - 30, 4.9, 30, 0.7, "rgba(255, 255, 255, 0.2)");
      rect(ctx, W - 3 - 30, 4.9, 30 * k, 0.7, GOLD);
    }
    // The hint, pulsing once a press counts.
    if (turnable(s)) {
      const last = s.page === PAGES.length - 1;
      faint(ctx, 0.55 + 0.45 * Math.sin(t / 260), () => label(ctx, last ? LAST_HINT : ENDING_HINT, W / 2, H - 1.5, 1.6, pg.pal.glow, "center", W - 6));
    }
    // A slow fade up from black as each page opens (slower on the first, out of the fight).
    const fade = s.page === 0 ? 900 : 500;
    if (t < fade) faint(ctx, 1 - t / fade, () => rect(ctx, 0, 0, W, H, "#000"));
    ctx.restore();
    ctx.globalAlpha = 1;
  }
  // The ending's own events: a page turning rustles (the first opens in silence, under the hush).
  function react(e, k) {
    if (e.type !== "endingPage") return false;
    if (e.page) k.tone("ghoulStoryPage", 0.3);
    return true;
  }
  return Object.freeze({ card, react });
}
