// Plan2Code Web Console - Ghoul Rush's intro story, drawn: eight animated scenes (a lonely road, the house on its hill, the hunger, the long arms, the world inside the windows, why YOU, no way back, The Long Hall as the game draws it) in canvas shapes, with the page's heading, its lines typing out, the hints and the skip bar over them.
//
// ghoul-draw.js plugs it in, the way it plugs in ghoul-intro-draw.js:
// storyArt(d) takes its drawing helpers (`d`: label, GOLD, BONE, LOOKS) and hands back
// `(ctx, v)`, drawn over the whole field while `round.phase === "story"` (also
// while paused). `round.story.ms` is the page's clock (it stops with the game,
// so a pause holds every animation). The words, colors and sounds live in
// ghoul-story.js. Field units (96 by 54), y counted down from the field's top;
// a scene gets the top SCENE_H units, the words the band below. No gradients
// (the tests' fake canvas has none): bands of flat color and alpha instead.

import { INTROS } from "./ghoul-intros.js";
import { dot, faint, flame, poly, rnd, stroke, titleLayout, dropAt } from "./ghoul-intro-draw.js";
import { CHAR_MS, FINALE_TITLE, LAST_HINT, PAGES, SKIP_HINT, REVEAL_AT_MS, SKIP_HOLD_MS, STORY_HINT, lineAt, ready, revealEnd, shown, typed } from "./ghoul-story.js";

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

// A sky of flat bands: the page's sky color, lighter toward the horizon.
function sky(ctx, pal, to = SCENE_H) {
  rect(ctx, 0, 0, W, to, pal.sky);
  for (let i = 0; i < 6; i++) faint(ctx, 0.05, () => rect(ctx, 0, to - (i + 1) * (to / 7), W, to / 7, pal.glow));
}
function stars(ctx, t, n, maxY, color = "#ffffff") {
  for (let i = 0; i < n; i++) faint(ctx, 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t / (300 + rnd(i, 4) * 500) + i)), () => dot(ctx, rnd(i) * W, rnd(i, 1) * maxY, 0.14 + rnd(i, 2) * 0.16, color));
}
function moon(ctx, x, y, r, color, t) {
  for (let i = 3; i >= 1; i--) faint(ctx, 0.05 + 0.01 * Math.sin(t / 700), () => circle(ctx, x, y, r * (1 + i * 0.5), color));
  circle(ctx, x, y, r, color);
  faint(ctx, 0.18, () => {
    circle(ctx, x - r * 0.3, y - r * 0.2, r * 0.22, "#8a93b8");
    circle(ctx, x + r * 0.35, y + r * 0.3, r * 0.15, "#8a93b8");
    circle(ctx, x + r * 0.1, y - r * 0.5, r * 0.12, "#8a93b8");
  });
}
// A rolling hill line filled down to `to`, scrolled by `off` units.
function hills(ctx, base, amp, color, off, seed, to = SCENE_H) {
  const pts = [[0, to]];
  for (let x = 0; x <= W + 2; x += 2) pts.push([x, base - amp * (0.6 * Math.sin((x + off) * 0.07 + seed) + 0.4 * Math.sin((x + off) * 0.17 + seed * 2))]);
  pts.push([W + 2, to]);
  poly(ctx, pts, color);
}
// A dead tree, trunk at (x, y), `h` tall, three bare limbs.
function tree(ctx, x, y, h, color, sway = 0) {
  const limb = (x1, y1, x2, y2, w) => stroke(ctx, x1, y1, x2, y2, color, w);
  limb(x, y, x + sway * 0.2, y - h, h * 0.07);
  limb(x + sway * 0.2, y - h * 0.55, x - h * 0.3 + sway * 0.4, y - h * 0.85, h * 0.04);
  limb(x + sway * 0.2, y - h * 0.7, x + h * 0.32 + sway * 0.5, y - h * 0.98, h * 0.04);
  limb(x + sway * 0.2, y - h * 0.9, x + h * 0.08 + sway, y - h * 1.15, h * 0.03);
}
// Drifting banks of fog.
function fog(ctx, t, y, color, alpha, speed = 0.01, n = 5) {
  for (let i = 0; i < n; i++) {
    faint(ctx, alpha, () => {
      ctx.beginPath();
      ctx.ellipse((((t * speed * 1000) / 1000 + i * (W / n + 7)) % (W + 40)) - 20, y + (i % 2) * 1.2, 15, 1.8, 0, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
    });
  }
}
function lightning(ctx, t, times, S = SCENE_H) {
  let a = 0;
  for (const at of times) {
    const d = t - at;
    if (d >= 0 && d < 420) a = Math.max(a, d < 60 ? 1 : d < 160 ? 0.3 : d < 220 ? 0.8 : 0.9 * (1 - (d - 220) / 200));
  }
  if (a > 0) faint(ctx, a * 0.55, () => rect(ctx, 0, 0, W, S, "#e6ecff"));
  return a;
}

// A house in silhouette, its feet at (x, y), `s` times its size (about 34 units wide, 25 tall at s 1: a turret on the left, the main roof, a wing on the right, a chimney). It stands on a stone foundation course along its whole width; draw a hill (knoll) over its feet afterward so no part of the base hangs in the air. `o`: t, body color, win(i) -> { c, a } for each of ten windows, mouth (the door a gaping mouth, 0..1 open).
const WINS = [[-14, -14], [-14, -9], [-8.5, -9], [-5, -9], [3.5, -9], [7, -9], [-8.5, -4.6], [7, -4.6], [11.5, -5.4], [-1, -15.2]];
// The main roof's height over x (house units, x from -11 to 11): the chimney stands on this.
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
  // The chimney runs down INTO the roof: past the slope at both its sides, to the eaves.
  const cx0 = 4.8;
  const cx1 = 7.2;
  rr(cx0, -22, cx1 - cx0, Math.max(roofAt(cx0), roofAt(cx1)) + 22 + 1.5, body);
  rr(cx0 - 0.4, -22.5, cx1 - cx0 + 0.8, 0.8, body);
  rr(-11.5, -17.2, 9, 0.4, "#1a1228");
  // The stone foundation course, wall to wall, with its blocks.
  const stone = o.stone || "#1b1530";
  rr(-16.5, -1.5, 35, 1.5, stone);
  rr(-16.5, -1.5, 35, 0.2, "#2a2146");
  for (let k = -16.5; k < 18.5; k += 2.4) rr(k + ((Math.round(k) % 2) ? 0.6 : 0), -1.5, 0.14, 1.5, body);
  rr(-16.5, -0.75, 35, 0.12, body);
  WINS.forEach(([dx, dy], i) => {
    const w = o.win ? o.win(i) : { c: "#ffd27a", a: flick(i, t) };
    if (!w || !(w.a > 0)) {
      rr(dx, dy, 2, 2.6, "#05030a");
      return;
    }
    faint(ctx, w.a * 0.12, () => rr(dx - 0.6, dy - 0.6, 3.2, 3.8, w.c));
    faint(ctx, w.a, () => rr(dx, dy, 2, 2.6, w.c));
    rr(dx + 0.9, dy, 0.2, 2.6, body);
    rr(dx, dy + 1.2, 2, 0.2, body);
  });
  // The door: an arch, or a mouth.
  const open = o.mouth || 0;
  rr(-1.7, -4.8 - open * 0.8, 3.4, 4.8 + open * 0.8, o.mouth !== undefined ? "#2a0508" : "#050308");
  circle(ctx, x, y - 4.8 * s - open * 0.8 * s, 1.7 * s, o.mouth !== undefined ? "#2a0508" : "#050308");
  if (o.mouth !== undefined) {
    faint(ctx, 0.5 + 0.3 * Math.sin(t / 200), () => rr(-1.2, -3.2, 2.4, 2.8, "#ff3b30"));
    for (let i = 0; i < 4; i++) {
      tri([[-1.6 + i * 0.85, -4.9 - open * 0.8], [-1.2 + i * 0.85, -3.7 - open * 0.8 * 0.4], [-0.8 + i * 0.85, -4.9 - open * 0.8]], "#efe6cf");
      tri([[-1.6 + i * 0.85, 0], [-1.2 + i * 0.85, -1.2 - open * 0.3], [-0.8 + i * 0.85, 0]], "#efe6cf");
    }
  }
}

// The little hero, facing right, feet at (x, y), `s` times its size (4.4 units tall at s 1): a box, a star for an eye, stick arms and two small feet, a flashlight in one hand. `o`: t, walk, lit (the beam's alpha, for a glow at the lens), cheer.
function hero(ctx, x, y, s, face, o = {}) {
  const t = o.t || 0;
  const stepA = o.walk ? Math.sin(t / 110) : 0;
  const bob = o.walk ? Math.abs(stepA) * 0.28 : 0;
  ctx.save();
  ctx.translate(x, y - bob * s);
  ctx.scale(s * face, s);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#cfc4a6";
  ctx.lineWidth = 0.32;
  for (const k of [-1, 1]) {
    const fx = k * 0.75 + (o.walk ? stepA * 0.7 * k : 0);
    stroke(ctx, k * 0.6, -1.2, fx, -0.2, "#cfc4a6", 0.32);
    ctx.beginPath();
    ctx.ellipse(fx + 0.15, -0.18, 0.6, 0.32, 0, 0, TAU);
    ctx.fillStyle = "#cfc4a6";
    ctx.fill();
  }
  // The free arm behind, then the box.
  stroke(ctx, -1.6, -2.7, -2.2 - (o.cheer ? 0.4 : 0), o.cheer ? -5.2 : -1.6 + (o.walk ? stepA * 0.5 : 0), "#cfc4a6", 0.32);
  rect(ctx, -1.6, -4.4, 3.2, 3.2, "#1e2838");
  ctx.strokeStyle = "#cfc4a6";
  ctx.lineWidth = 0.22;
  ctx.strokeRect(-1.6, -4.4, 3.2, 3.2);
  star(ctx, 0.15, -3.6, 0.95, 0.4, "#ffd24a", o.t ? Math.sin(t / 900) * 0.15 : 0);
  ctx.beginPath();
  ctx.arc(0.15, -2.55, 0.45, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.lineWidth = 0.18;
  ctx.strokeStyle = "#cfc4a6";
  ctx.stroke();
  // The flashlight, held out level.
  stroke(ctx, 1.6, -2.6, 2.5, -2.25, "#cfc4a6", 0.32);
  rect(ctx, 2.3, -2.6, 1.6, 0.7, "#4a4f5a");
  rect(ctx, 3.7, -2.75, 0.4, 1, "#c9ced6");
  ctx.lineCap = "butt";
  ctx.restore();
  if (o.lit > 0) faint(ctx, o.lit * 0.9, () => circle(ctx, x + face * 4.1 * s, y - 2.25 * s - bob * s, 0.7 * s, "#fffbe0"));
  return { x: x + face * 4.2 * s, y: y - 2.25 * s - bob * s };
}
// A cone of light from `from` out `len` units, `spread` wide at the far end.
function beam(ctx, from, len, spread, alpha, color = "#fff3b0", tilt = 0) {
  if (!(alpha > 0)) return;
  for (let i = 0; i < 3; i++) {
    const sp = spread * (1 - i * 0.3);
    faint(ctx, alpha * (0.12 + i * 0.06), () => poly(ctx, [[from.x, from.y - 0.3], [from.x + len, from.y + tilt - sp], [from.x + len, from.y + tilt + sp], [from.x, from.y + 0.3]], color));
  }
}

// A mix of two #rrggbb colors, `k` of the way from a to b.
const mix = (a, b, k) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * k)).join(",")})`;
};
const ell = (ctx, x, y, rx, ry, fill) => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
};
// An arch: a door or window, its feet at y + h, a half circle on top.
function archPath(ctx, x, y, w, h) {
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
}
function arch(ctx, x, y, w, h, fill) {
  archPath(ctx, x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fill();
}
// A shambling dark shape, feet at (x, y): head, hunched body, arms out in front (toward the left), `a` its alpha.
function ghoulShape(ctx, x, y, s, t, i, a = 1) {
  const c = "#060409";
  const lurch = Math.sin(t / 380 + i * 1.7);
  faint(ctx, a, () => {
    stroke(ctx, x - 0.5 * s, y - 2.2 * s, x - 0.9 * s + lurch * 0.3, y, c, 0.6 * s);
    stroke(ctx, x + 0.5 * s, y - 2.2 * s, x + 0.9 * s - lurch * 0.3, y, c, 0.6 * s);
    poly(ctx, [[x - 1.3 * s, y - 2.4 * s], [x + 1.4 * s, y - 2.4 * s], [x + 1 * s, y - 4.3 * s], [x - 1 * s, y - 4.3 * s]], c);
    stroke(ctx, x - 0.8 * s, y - 3.8 * s, x - 3.2 * s, y - 3.5 * s + lurch * 0.3, c, 0.45 * s);
    stroke(ctx, x - 0.6 * s, y - 3.4 * s, x - 3 * s, y - 2.9 * s - lurch * 0.3, c, 0.45 * s);
    circle(ctx, x - 0.2 * s, y - 4.7 * s, 0.95 * s, c);
  });
}
// A hill's top: flat under the whole of what stands on it (`flat` each side of cx, at height y), then rounded shoulders easing down `depth` over `slope` units to the ground behind. Draw it AFTER the house so the base is set into it.
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

// The three little places seen through the house's windows (each drawn inside its window's clip: `x`, `y` the window's top left, `w` by `h`).
function lakeInside(ctx, x, y, w, h, t) {
  rect(ctx, x, y, w, h, "#0e1a30");
  for (let i = 0; i < 9; i++) faint(ctx, 0.4 + 0.5 * Math.sin(t / 500 + i), () => dot(ctx, x + rnd(i, 3) * w, y + 1 + rnd(i, 4) * 6, 0.17, "#ffffff"));
  poly(ctx, [[x, y + 11], [x + 5, y + 8.6], [x + 11, y + 10.8], [x + 17, y + 8.8], [x + w, y + 10.5], [x + w, y + h], [x, y + h]], "#0a1020");
  for (const [px, ph] of [[3, 5], [6.5, 4], [18, 5.2], [20.5, 3.6]]) poly(ctx, [[x + px - 1.1, y + 11.6], [x + px, y + 11.6 - ph], [x + px + 1.1, y + 11.6]], "#050a14");
  ell(ctx, x + w / 2, y + h - 3.6, w * 0.55, 2.9, "#bae6fd");
  stroke(ctx, x + 4, y + h - 3.6, x + 10, y + h - 4.4, "#e0f2fe", 0.15);
  stroke(ctx, x + 10, y + h - 4.4, x + 16, y + h - 3, "#e0f2fe", 0.15);
  const rise = 0.65 + 0.35 * Math.sin(t / 900);
  stroke(ctx, x + 14.5, y + h - 3.8, x + 14.5, y + h - 3.8 - 3 * rise, "#8fb7d1", 0.4);
  for (let i = -1; i <= 1; i++) stroke(ctx, x + 14.5 + i * 0.4, y + h - 6.8 * rise - 0.8 + 3 * (1 - rise) * 0.2, x + 14.5 + i * 0.6, y + h - 7.8 * rise, "#8fb7d1", 0.2);
}
function wheelInside(ctx, x, y, w, h, t) {
  rect(ctx, x, y, w, h, "#241628");
  for (let i = 0; i < 6; i++) rect(ctx, x + i * 4 + 1, y, 1.4, h, "#2f1d34");
  const cx = x + w / 2;
  const cy = y + h - 7.2;
  const r = 6.3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, TAU);
  ctx.strokeStyle = "#f472b6";
  ctx.lineWidth = 0.3;
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = t / 2200 + (i * TAU) / 8;
    const gx = cx + Math.cos(a) * r;
    const gy = cy + Math.sin(a) * r;
    stroke(ctx, cx, cy, gx, gy, "#c04a8a", 0.18);
    circle(ctx, gx, gy + 0.5, 0.65, i % 2 ? "#fde047" : "#fb7185");
  }
  for (let i = 0; i < 16; i++) faint(ctx, 0.5 + 0.5 * Math.sin(t / 220 + i), () => dot(ctx, cx + Math.cos((i * TAU) / 16) * r, cy + Math.sin((i * TAU) / 16) * r, 0.2, "#fff1c4"));
  stroke(ctx, cx - 2.6, y + h - 2.2, cx, cy, "#6a3a60", 0.35);
  stroke(ctx, cx + 2.6, y + h - 2.2, cx, cy, "#6a3a60", 0.35);
  circle(ctx, cx, cy, 0.7, "#fbcfe8");
}
function villageInside(ctx, x, y, w, h, t) {
  rect(ctx, x, y, w, h, "#10142e");
  circle(ctx, x + 16, y + 4.5, 1.7, "#f3e9c0");
  for (let i = 0; i < 6; i++) faint(ctx, 0.5 + 0.4 * Math.sin(t / 450 + i), () => dot(ctx, x + rnd(i, 7) * 12 + 1, y + 1 + rnd(i, 8) * 5, 0.16, "#ffffff"));
  poly(ctx, [[x, y + 12], [x + 8, y + 9.6], [x + 15, y + 11.4], [x + w, y + 10], [x + w, y + h], [x, y + h]], "#0a0d22");
  for (let i = 0; i < 4; i++) {
    const hx = x + 2 + i * 5;
    const hh = 3.2 + (i % 2) * 1.2;
    rect(ctx, hx, y + h - 2.2 - hh, 3.4, hh, "#2e2a66");
    poly(ctx, [[hx - 0.4, y + h - 2.2 - hh], [hx + 1.7, y + h - 2.2 - hh - 1.7], [hx + 3.8, y + h - 2.2 - hh]], "#1d1a4a");
    rect(ctx, hx + 1.1, y + h - 2.2 - hh + 0.9, 1.2, 1.2, Math.sin(t / 700 + i * 2) > -0.4 ? "#ffd27a" : "#0b0a22");
  }
}

/* ------------------------------------------------------------- scenes */

const SCENES = {
  // I. A lonely road at night: parallax hills and trees, a moon, a house far off with one winking window, eyes in the bushes, YOU walking with the flashlight.
  road(ctx, p) {
    const { t, pal } = p;
    sky(ctx, pal);
    stars(ctx, t, 46, 19);
    moon(ctx, 76, 9, 4.6, "#dfe9ff", t);
    hills(ctx, 21, 2.4, "#0e1838", 0, 1);
    // The house on the far hill, one window winking.
    house(ctx, 70, 19.6, 0.28, { t, body: "#080b1c", stone: "#12183a", win: (i) => (i === 3 ? { c: "#ffd27a", a: Math.sin(t / 800) > -0.3 ? 0.9 : 0 } : null) });
    // Its ridge: a hilltop flat under the whole house, so its base is set into the land.
    knoll(ctx, 70.2, 19.6, 6, 34, 12, "#060a16");
    tufts(ctx, 64, 77, 19.6, "#080b1c", t);
    hills(ctx, 25, 3, "#0a1028", t * 0.006, 3);
    for (let i = 0; i < 4; i++) tree(ctx, ((i * 31 - t * 0.012) % (W + 24) + (W + 24)) % (W + 24) - 8, 28, 9 + (i % 2) * 3, "#05060f", Math.sin(t / 500 + i) * 1.4);
    fog(ctx, t, 27.3, "#8da4e0", 0.1, 0.012);
    rect(ctx, 0, 28, W, SCENE_H - 28, pal.ground);
    rect(ctx, 0, 28.4, W, 2.6, "#171c36");
    // The road runs on from here up the land to the house on its ridge.
    poly(ctx, [[45, 28.6], [56, 28.6], [70.9, 19.8], [69.5, 19.8]], "#1d2342");
    for (let i = 0; i < 9; i++) rect(ctx, (((i * 13 - t * 0.02) % (W + 14)) + W + 14) % (W + 14) - 6, 29.5, 5, 0.4, "#2b3358");
    // Fence posts racing past, and grass bending in the wind.
    for (let i = 0; i < 6; i++) {
      const x = (((i * 19 - t * 0.03) % (W + 19)) + W + 19) % (W + 19) - 4;
      rect(ctx, x, 30.2, 0.7, 3, "#03040a");
    }
    for (let i = 0; i < 40; i++) stroke(ctx, i * 2.4 + 0.5, 33, i * 2.4 + 0.5 + Math.sin(t / 300 + i * 0.8) * 0.9 + 0.6, 31.2, "#03040a", 0.2);
    // Two eyes in the dark that open, then close.
    const blink = (t % 5200) / 5200;
    if (blink > 0.35 && blink < 0.8 && blink % 0.18 > 0.02) {
      circle(ctx, 62, 26.2, 0.32, "#ffe14a");
      circle(ctx, 63.6, 26.2, 0.32, "#ffe14a");
    }
    const lens = hero(ctx, 24, 30.2, 1.15, 1, { t, walk: true });
    beam(ctx, lens, 24, 3.4, 0.7 + 0.1 * Math.sin(t / 90));
  },

  // II. The house on the hill: lightning, flickering windows, bats, clouds over the moon, a pale shape in the tower, a slow push-in.
  house(ctx, p) {
    const { t, pal } = p;
    sky(ctx, pal);
    stars(ctx, t, 30, 14);
    moon(ctx, 18, 8, 4.2, "#e8dcff", t);
    for (let i = 0; i < 4; i++) {
      faint(ctx, 0.85, () => {
        ctx.beginPath();
        ctx.ellipse((((t / 120 + i * 29) % (W + 40)) - 20), 7 + (i % 2) * 5, 14, 2.4, 0, 0, TAU);
        ctx.fillStyle = "#120a26";
        ctx.fill();
      });
    }
    const k = 1 + t / 60000;
    ctx.save();
    ctx.translate(60, 22);
    ctx.scale(k, k);
    ctx.translate(-60, -22);
    hills(ctx, 31, 0, "#0a0614", 0, 0);
    const lit = (i) => {
      if (i === 0 && t > 3800 && t < 5600) return { c: "#e8f2ff", a: 0.95 };
      return { c: "#ffc15a", a: flick(i, t) };
    };
    house(ctx, 60, 22, 1.05, { t, win: lit });
    // The hill: a wide dome flat under the whole house (turret to wing), set over its foundation.
    knoll(ctx, 61, 22, 19.5, 22, 9, "#07040d");
    tufts(ctx, 41, 81, 22, "#030207", t);
    // A pale shape in the tower window, a while in.
    if (t > 3800 && t < 5600) {
      rect(ctx, 60 - 14 * 1.05 + 0.5, 22 - 14 * 1.05 + 1, 0.9, 1.5, "#04030a");
      circle(ctx, 60 - 14 * 1.05 + 0.95, 22 - 14 * 1.05 + 0.9, 0.4, "#04030a");
    }
    // The fence in front.
    for (let x = 30; x < 92; x += 2.2) {
      rect(ctx, x, 27.5, 0.35, 5, "#030207");
      poly(ctx, [[x - 0.3, 27.5], [x + 0.18, 26.2], [x + 0.65, 27.5]], "#030207");
    }
    rect(ctx, 30, 29, 62, 0.3, "#030207");
    ctx.restore();
    // Bats, and clouds sliding over the moon.
    for (let i = 0; i < 4; i++) {
      const x = ((t / 22 + i * 29) % (W + 20)) - 10;
      const y = 6 + i * 4 + Math.sin(t / 380 + i) * 2;
      const f = Math.sin(t / 70 + i) * 1.4;
      poly(ctx, [[x, y], [x - 2.6, y - 1.3 + f], [x - 1.2, y + 0.4], [x, y + 0.7], [x + 1.2, y + 0.4], [x + 2.6, y - 1.3 + f]], "#04030a");
    }
    lightning(ctx, t, [150, 3100]);
  },

  // III. The hunger: the house's door is a mouth; small frightened figures walk toward it and their fright streams in as light.
  hunger(ctx, p) {
    const { t, pal } = p;
    sky(ctx, pal);
    const beat = Math.max(0, Math.sin(t / 380)) ** 6;
    faint(ctx, 0.12 + 0.18 * beat, () => rect(ctx, 0, 0, W, SCENE_H, "#7f1d1d"));
    rect(ctx, 0, 29, W, SCENE_H - 29, pal.ground);
    house(ctx, 66, 29.5, 1.05, { t, mouth: 0.5 + 0.5 * Math.sin(t / 650), win: (i) => ({ c: "#ff2d2d", a: 0.5 + 0.5 * flick(i, t) }) });
    // The chimney glows with each swallow.
    faint(ctx, 0.3 + 0.7 * beat, () => circle(ctx, 66 + 6 * 1.05, 29.5 - 21 * 1.05, 2, "#ff5a36"));
    // Little figures with their arms up, each shedding fright that flies to the mouth.
    for (let i = 0; i < 4; i++) {
      const fx = 8 + i * 9;
      const fy = 29.5;
      const sway = Math.sin(t / 240 + i * 2) * 0.4;
      stroke(ctx, fx, fy - 1.2, fx + sway, fy - 3, "#d8cfe8", 0.35);
      stroke(ctx, fx + sway, fy - 2.6, fx + sway - 1, fy - 3.8, "#d8cfe8", 0.25);
      stroke(ctx, fx + sway, fy - 2.6, fx + sway + 1, fy - 3.8, "#d8cfe8", 0.25);
      stroke(ctx, fx, fy - 1.2, fx - 0.5, fy, "#d8cfe8", 0.25);
      stroke(ctx, fx, fy - 1.2, fx + 0.5, fy, "#d8cfe8", 0.25);
      circle(ctx, fx + sway, fy - 3.7, 0.8, "#d8cfe8");
      circle(ctx, fx + sway, fy - 3.6, 0.28, "#2a0508");
      for (let j = 0; j < 6; j++) {
        const q = ((t / 1800 + j / 6 + i * 0.13) % 1);
        const x0 = fx + sway;
        const y0 = fy - 3.7;
        const x1 = 66;
        const y1 = 29.5 - 2.4;
        const cx = (x0 + x1) / 2;
        const cy = Math.min(y0, y1) - 9 - i;
        const mx = (1 - q) * (1 - q) * x0 + 2 * (1 - q) * q * cx + q * q * x1;
        const my = (1 - q) * (1 - q) * y0 + 2 * (1 - q) * q * cy + q * q * y1;
        faint(ctx, Math.sin(q * Math.PI), () => circle(ctx, mx, my, 0.45 - q * 0.2, "#fecaca"));
      }
    }
    fog(ctx, t, 29, "#7f1d1d", 0.18, 0.008, 4);
    ctx.globalAlpha = 1;
  },

  // IV. A house with long arms: the house on its hill, its windows waking, its shadow stretching across the ground and long dark arms reaching out of it to both edges; things it swallowed ride the arms back in.
  arms(ctx, p) {
    const { t, pal, line, full, grow } = p;
    sky(ctx, pal);
    stars(ctx, t, 24, 12);
    moon(ctx, 86, 7, 2.8, "#cfe9dc", t);
    hills(ctx, 27.5, 1.2, "#07140f", 0, 6);
    rect(ctx, 0, 29, W, SCENE_H - 29, "#0d251c");
    const on = (n) => full || line >= n;
    const wake = grow(0, 900);
    const reach = 0.1 + 0.9 * grow(1, 1700);
    // The shadow: the house's, thrown a long way across the ground.
    const len = 6 + 40 * grow(1, 1700);
    faint(ctx, 0.8, () => poly(ctx, [[38, 29.2], [38 - len, 31.4], [38 - len * 0.92, 32.2], [46, 33]], "#020604"));
    // The house on its hill, its windows eyes, its door a mouth.
    house(ctx, 48, 28, 0.85, { t, mouth: 0.15 + 0.5 * wake * (0.5 + 0.5 * Math.sin(t / 600)), win: (i) => ({ c: pal.glow, a: 0.12 + wake * (0.3 + 0.5 * flick(i, t)) }) });
    knoll(ctx, 48.5, 28, 16, 14, 1, "#0d251c");
    tufts(ctx, 33, 65, 28, "#030a07", t);
    // One arm: a quadratic curve out of the house, tapering to a hooked hand; returns where a point `q` along it is.
    const arm = (x0, y0, cx, cy, x1, y1, seed) => {
      const at = (q) => {
        const k = q * reach;
        const wob = Math.sin(t / 520 + seed * 2 + q * 5) * 0.6 * q;
        return [(1 - k) * (1 - k) * x0 + 2 * (1 - k) * k * cx + k * k * x1 + wob * 0.4, (1 - k) * (1 - k) * y0 + 2 * (1 - k) * k * cy + k * k * y1 + wob];
      };
      ctx.lineCap = "round";
      let prev = at(0);
      for (let i = 1; i <= 16; i++) {
        const cur = at(i / 16);
        const w = 1.1 * (1 - (i / 16) * 0.75) + 0.2;
        faint(ctx, 0.35, () => stroke(ctx, prev[0], prev[1], cur[0], cur[1], pal.glow, w + 0.25));
        prev = cur;
      }
      faint(ctx, 1, () => {
        let a = at(0);
        for (let i = 1; i <= 16; i++) {
          const b = at(i / 16);
          stroke(ctx, a[0], a[1], b[0], b[1], "#030a06", 1.2 * (1 - (i / 16) * 0.75) + 0.25);
          a = b;
        }
      });
      const end = at(1);
      const dir = x1 < x0 ? -1 : 1;
      for (let f = -1; f <= 1; f++) stroke(ctx, end[0], end[1], end[0] + dir * 1.3, end[1] + f * 0.9 + Math.sin(t / 300 + f) * 0.2, "#041009", 0.25);
      ctx.lineCap = "butt";
      return at;
    };
    const arms = [
      arm(41, 27, 22, 33, 3, 30, 1),
      arm(40.5, 19, 21, 6, 4, 14, 2),
      arm(56, 27, 76, 33, 93, 29, 3),
      arm(57, 20, 78, 7, 93, 13, 4),
    ];
    // What it has swallowed rides the arms home: small lights in the colors of other places.
    if (on(2)) {
      const cols = ["#bae6fd", "#f472b6", "#fde68a", "#fca5a5"];
      arms.forEach((at, i) => {
        for (let j = 0; j < 3; j++) {
          const q = 1 - ((t / 2600 + j / 3 + i * 0.21) % 1);
          const [mx, my] = at(q);
          faint(ctx, Math.sin(q * Math.PI) * 0.9, () => circle(ctx, mx, my, 0.5, cols[(i + j) % 4]));
        }
      });
    }
    fog(ctx, t, 30.5, "#6ee7b7", 0.07, 0.008, 4);
  },

  // V. A world inside: the house's front is a wall of windows, and through each one a whole tiny place sits inside a room (a frozen lake, a ferris wheel, a village), lighting one by one.
  far(ctx, p) {
    const { t, pal, full, grow } = p;
    sky(ctx, pal);
    stars(ctx, t, 26, 6);
    // The front of the house: a wall, a gable and a chimney.
    const wall = "#0b0a1e";
    rect(ctx, 5, 9, 86, SCENE_H - 9, wall);
    poly(ctx, [[2, 9.5], [48, 0.8], [94, 9.5]], wall);
    rect(ctx, 74, 1.5, 3, 6, wall);
    rect(ctx, 5, 28.4, 86, 0.4, "#1a1838");
    const windows = [[9, 0], [37, 1], [65, 2]];
    windows.forEach(([x0, n]) => {
      const lit = full ? 1 : n === 0 ? grow(1, 900) : grow(n + 1, 900);
      const y0 = 11.5;
      const w = 22;
      const h = 16.5;
      arch(ctx, x0 - 1, y0 - 1, w + 2, h + 1, "#1d1a40");
      // Seen through: the room inside.
      ctx.save();
      archPath(ctx, x0, y0, w, h);
      ctx.clip();
      rect(ctx, x0, y0, w, h, "#0a0818");
      if (n === 0) lakeInside(ctx, x0, y0, w, h, t);
      else if (n === 1) wheelInside(ctx, x0, y0, w, h, t);
      else villageInside(ctx, x0, y0, w, h, t);
      // The room: a hanging bulb on its cord, boards in front and a baseboard.
      stroke(ctx, x0 + w / 2, y0, x0 + w / 2, y0 + 2.6, "#0a0818", 0.15);
      faint(ctx, 0.14 * flick(n * 3 + 1, t), () => circle(ctx, x0 + w / 2, y0 + 3.2, 2.4, "#ffd27a"));
      circle(ctx, x0 + w / 2, y0 + 3.2, 0.5, "#fff1c4");
      rect(ctx, x0, y0 + h - 2.2, w, 2.2, "#2a1c14");
      rect(ctx, x0, y0 + h - 2.2, w, 0.3, "#4a3424");
      for (let k = 0; k < 4; k++) rect(ctx, x0 + 2 + k * 6 + n, y0 + h - 1.9, 0.15, 1.9, "#120c08");
      // Dark until its line is typed.
      faint(ctx, 0.85 * (1 - lit), () => rect(ctx, x0, y0, w, h, "#06050f"));
      ctx.restore();
      // The frame, the sill and the cross bar.
      rect(ctx, x0 - 1.5, y0 + h, w + 3, 0.9, "#1d1a40");
    });
    // The ground at its feet.
    rect(ctx, 0, 30.4, W, SCENE_H - 30.4, pal.ground);
    tufts(ctx, 3, 93, 30.4, "#030210", t);
    fog(ctx, t, 31.5, "#a78bfa", 0.06, 0.008, 4);
  },

  // VI. Why YOU: in the dark, the house watches with dim red windows; the flashlight clicks on, the house flinches and goes dark, then winks at YOU.
  why(ctx, p) {
    const { t, pal } = p;
    sky(ctx, pal);
    stars(ctx, t, 26, 15);
    const click = 1500;
    const wink = 3400;
    const lit = t >= click;
    const since = t - click;
    const shake = lit && since < 800 ? (rnd(Math.floor(t / 40)) - 0.5) * 1.4 * (1 - since / 800) : 0;
    rect(ctx, 0, 29, W, SCENE_H - 29, pal.ground);
    house(ctx, 73 + shake, 29.5, 1.05, {
      t,
      win: (i) => {
        if (t < click) return { c: "#7f1d1d", a: 0.3 + 0.4 * flick(i, t) };
        if (t < wink) return null;
        const open = Math.floor((t - wink) / 260);
        return i <= open ? { c: "#fde047", a: i === open ? 0.4 : 0.9 } : null;
      },
    });
    const lens = hero(ctx, 18, 30.2, 1.3, 1, { t, lit: lit ? clamp(1 - since / 500, 0, 1) : 0 });
    if (lit) {
      const a = clamp(since / 250) * (0.8 + 0.1 * Math.sin(t / 70));
      beam(ctx, lens, 38, 5.5, a);
      faint(ctx, a * 0.4, () => {
        ctx.beginPath();
        ctx.ellipse(61 + shake, 23, 3, 8, 0, 0, TAU);
        ctx.fillStyle = "#fff3b0";
        ctx.fill();
      });
      // Flinch marks off the house's corners.
      if (since < 700) for (let i = 0; i < 5; i++) stroke(ctx, 57 + i * 1.2, 14 + i * 2.2, 54 + i * 0.4 - since / 90, 12 + i * 2.2, "#fff3b0", 0.25);
    }
    fog(ctx, t, 30, "#8da4e0", 0.07, 0.01, 4);
    if (!lit) faint(ctx, 0.25 * (1 - Math.min(1, t / 1500)), () => rect(ctx, 0, 0, W, SCENE_H, "#000"));
    // The click's bloom.
    if (since >= 0 && since < 200) faint(ctx, 0.35 * (1 - since / 200), () => rect(ctx, 0, 0, W, SCENE_H, "#fffbe0"));
  },

  // VII. No way back: the road behind YOU folds up like a napkin; a row of doors runs on ahead past the edge, each with its keeper's light under it, and they lock one by one.
  trap(ctx, p) {
    const { t, pal } = p;
    sky(ctx, pal);
    rect(ctx, 0, 7, W, 22, "#12070f");
    const glows = Object.values(INTROS).map((i) => i.palette.glow);
    for (let i = 0; i < 11; i++) {
      const glow = glows[i % glows.length];
      const x = 5 + i * 9;
      const lockAt = 1400 + i * 420;
      const locked = t >= lockAt;
      rect(ctx, x, 13, 7, 15, "#1f0e1c");
      // The keeper's light under the door, until it is locked.
      if (!locked) faint(ctx, 0.55 + 0.35 * Math.sin(t / 150 + i), () => rect(ctx, x + 0.4, 26.5, 6.2, 1.5, glow));
      else if (t < lockAt + 200) faint(ctx, 1 - (t - lockAt) / 200, () => rect(ctx, x + 0.4, 13.4, 6.2, 14.4, glow));
      rect(ctx, x, 13, 7, 0.5, "#3a1a34");
      circle(ctx, x + 3.5, 15.2, 0.6, glow);
      circle(ctx, x + 5.4, 21, 0.35, "#c9ced6");
      if (locked) {
        const pop = clamp((t - lockAt) / 160);
        rect(ctx, x + 3.4 - 1.1 * pop, 19.5, 2.2 * pop, 1.8 * pop, "#ef4444");
        ctx.beginPath();
        ctx.arc(x + 3.5, 19.5, 0.9 * pop, Math.PI, 0);
        ctx.strokeStyle = "#c9ced6";
        ctx.lineWidth = 0.3;
        ctx.stroke();
      }
    }
    rect(ctx, 0, 28, W, SCENE_H - 28, pal.ground);
    // The road behind YOU, pleating up from the far end toward YOU.
    const front = clamp(t / 3200) * 8;
    for (let i = 0; i < 8; i++) {
      const x0 = i * 5;
      const fold = smooth(front - (7 - i) + 1);
      const h = fold * 6;
      const up = i % 2;
      poly(ctx, [[x0, 31], [x0 + 5, 31], [x0 + 5, 31 - (up ? h * 0.3 : h)], [x0, 31 - (up ? h : h * 0.3)]], i % 2 ? "#2a2440" : "#1b1830");
      if (fold > 0.02) faint(ctx, 0.5, () => rect(ctx, x0, 31 - (up ? h * 0.3 : h) - 0.2, 5, 0.3, "#8a7fb0"));
    }
    rect(ctx, 40, 29.5, W - 40, 1.6, "#1b1830");
    const lens = hero(ctx, 50, 31, 1.25, 1, { t });
    beam(ctx, lens, 22, 3, 0.55);
    fog(ctx, t, 31, "#c084fc", 0.07, 0.01, 4);
  },

  // VIII. The Long Hall as the game draws it, side on: the hall's own wall colors, striped paper, arched windows, a portrait, candle sconces, the wainscot and the floor boards, the exit door at the far end; YOU at the left switch the flashlight on and its cone lights the hall, where dark shapes with glowing eyes wait; THE RUN BEGINS drops in letter by letter and the light flares.
  begin(ctx, p) {
    const { t, pal, look } = p;
    const FY = 28;
    // The wall: the hall's top and bottom colors in flat bands, and the old striped paper.
    for (let i = 0; i < 10; i++) rect(ctx, 0, (i * FY) / 10, W, FY / 10 + 0.1, mix(look.wallTop, look.wallLow, i / 9));
    for (let x = 0; x < W + 4; x += 4) {
      const n = Math.round(x / 4);
      faint(ctx, 0.3 + (n % 3) * 0.08, () => rect(ctx, x, 0, 1.6, FY - 2, look.paper));
    }
    // A crack, and the arched windows with the sickly moon (the game's own window).
    stroke(ctx, 41, 2, 40.4, 6, "rgba(0, 0, 0, 0.5)", 0.18);
    stroke(ctx, 40.4, 6, 41.2, 9, "rgba(0, 0, 0, 0.5)", 0.18);
    for (const [wx, n] of [[28.5, 0], [64.5, 1]]) {
      const x = wx - 3.5;
      const top = 5;
      const w = 7;
      const h = 14;
      arch(ctx, x - 0.5, top - 0.5, w + 1, h + 0.5, look.wainscot);
      arch(ctx, x, top, w, h, "#05070d");
      faint(ctx, 0.55, () => circle(ctx, x + w * (0.3 + n * 0.2), top + h * 0.28, w * 0.16, look.window));
      faint(ctx, 0.7, () => ell(ctx, x + w * (0.25 + n * 0.2), top + h * 0.31, w * 0.22, w * 0.07, "#05070d"));
      faint(ctx, 0.12, () => rect(ctx, x, top + h * 0.55, w, h * 0.45, look.window));
      rect(ctx, x + w / 2 - 0.2, top + 0.5, 0.4, h - 0.5, look.wainscot);
      rect(ctx, x, top + h * 0.55, w, 0.4, look.wainscot);
    }
    // A portrait in a tarnished frame: a long pale face with empty eyes.
    rect(ctx, 44.2, 7.6, 5.6, 7.4, "#4a3a1a");
    rect(ctx, 44.7, 8.1, 4.6, 6.4, "#141a14");
    ell(ctx, 47, 10.8, 1.1, 1.8, "#7a7468");
    ell(ctx, 46.55, 10.4, 0.25, 0.4, "#000000");
    ell(ctx, 47.45, 10.4, 0.25, 0.4, "#000000");
    ell(ctx, 47, 11.8, 0.25, 0.4, "#000000");
    rect(ctx, 45, 12.9, 4, 1.4, "#1a1210");
    // The wainscot, then the floor: its lit edge, its boards and their seams.
    rect(ctx, 0, FY - 4, W, 4, look.wainscot);
    rect(ctx, 0, FY - 4.25, W, 0.25, look.floorEdge);
    rect(ctx, 0, FY, W, SCENE_H - FY, look.floor);
    rect(ctx, 0, FY, W, 1.2, look.floorTop);
    rect(ctx, 0, FY, W, 0.25, look.floorEdge);
    for (let i = 0; i < 12; i++) rect(ctx, 2 + i * 8.5, FY + 0.25, 0.16, 0.95, look.floorEdge);
    for (let i = 0; i < 12; i++) rect(ctx, 6 + i * 8.5, FY + 1.2, 0.16, SCENE_H - FY - 1.2, look.floorEdge);
    rect(ctx, 0, FY + 2.6, W, 0.16, look.floorEdge);
    // The exit at the right end: an arched door in its frame, a thin gold line round it.
    arch(ctx, 82.4, FY - 15.2, 9.6, 15.2, look.shelf);
    arch(ctx, 83.2, FY - 14.4, 8, 14.4, "#0e0806");
    faint(ctx, 0.25 + 0.15 * Math.sin(t / 500), () => {
      rect(ctx, 83.2, FY - 0.5, 8, 0.5, "#fbbf24");
      rect(ctx, 86.9, FY - 14.4, 0.4, 14.4, "#fbbf24");
    });
    rect(ctx, 89.2, FY - 7.4, 0.5, 1.4, "#c9a24a");
    // Candle sconces, the candle burned low, a warm pool on the wall.
    [18, 38, 55, 76].forEach((sx, i) => {
      const f = flick(i + 2, t);
      faint(ctx, 0.035 * f, () => circle(ctx, sx, 11.5, 7, "#ffb84a"));
      faint(ctx, 0.05 * f, () => circle(ctx, sx, 11.5, 3.4, "#ffb84a"));
      rect(ctx, sx - 0.3, 12, 0.6, 2.4, "#3a2e16");
      rect(ctx, sx - 0.45, 10.6, 0.9, 1.5, "#b8ae94");
      flame(ctx, sx, 10.6, 1.7, t, sx, "#ffb84a");
    });
    // The far end of the hall sinks into the dark.
    for (let i = 0; i < 8; i++) faint(ctx, 0.07, () => rect(ctx, 50 + i * 6, 0, W - 50 - i * 6, SCENE_H, "#050308"));
    // YOU click the flashlight on at the left and its cone lights the hall.
    const clickAt = 450;
    const lit = smooth((t - clickAt) / 260);
    const lens = hero(ctx, 10, FY + 1.3, 1.3, 1, { t, lit: t >= clickAt ? clamp(1 - (t - clickAt) / 500) : 0 });
    beam(ctx, lens, 78, 6.4, lit * (0.8 + 0.08 * Math.sin(t / 80)), "#fff3b0", 0.4);
    if (t >= clickAt && t < clickAt + 200) faint(ctx, 0.25 * (1 - (t - clickAt) / 200), () => rect(ctx, 0, 0, W, SCENE_H, "#fffbe0"));
    // Dark shapes far down the hall, their eyes opening one by one.
    [[55, 1.15, "#ff3b30"], [66, 1.05, "#ffe14a"], [75, 1.2, "#ff3b30"]].forEach(([mx, ms, eye], i) => {
      const sway = Math.sin(t / 700 + i * 2) * 0.9;
      const open = smooth((t - 1200 - i * 600) / 400);
      ghoulShape(ctx, mx + sway, FY + 1.1, ms, t, i, i === 2 ? 0.55 : 1);
      if (open > 0) {
        const bx = mx + sway - 0.2 * ms;
        const by = FY + 1.1 - 4.6 * ms;
        faint(ctx, open * 0.35, () => {
          circle(ctx, bx - 0.5 * ms, by, 0.55 * ms, eye);
          circle(ctx, bx + 0.5 * ms, by, 0.55 * ms, eye);
        });
        faint(ctx, open, () => {
          circle(ctx, bx - 0.5 * ms, by, 0.28 * ms, eye);
          circle(ctx, bx + 0.5 * ms, by, 0.28 * ms, eye);
        });
      }
    });
    // The title, on a dark band so it reads over the windows.
    faint(ctx, 0.6 * smooth((t - 2800) / 400), () => rect(ctx, 0, 3.4, W, 13, "#050308"));
    const { size, xs } = titleLayout(FINALE_TITLE, 88);
    const chars = [...FINALE_TITLE];
    const base = 3000;
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === " ") continue;
      const at = t - base - i * 70;
      const fall = dropAt(at);
      p.label(ctx, chars[i], 48 + xs[i] + 0.3, 9.8 - fall * 15 + 0.5, size * 0.95, "rgba(0, 0, 0, 0.7)", "center");
      const landed = at >= 520;
      if (at > -40) {
        if (landed) faint(ctx, 0.25 + 0.2 * Math.sin(t / 280 - i * 0.5), () => p.label(ctx, chars[i], 48 + xs[i], 9.8, size * 1.1, pal.glow, "center"));
        p.label(ctx, chars[i], 48 + xs[i], 9.8 - fall * 15 + (landed ? Math.sin(t / 260 - i * 0.6) * size * 0.04 : 0), size * 0.95, i % 2 ? "#fbbf24" : "#fff3c4", "center");
      }
    }
    // The flare as the last stinger lands.
    const flare = t - 3900;
    if (flare >= 0 && flare < 700) faint(ctx, 0.55 * (1 - flare / 700), () => rect(ctx, 0, 0, W, SCENE_H, "#fff3c4"));
  },
};

/* --------------------------------------------------------------- the page */

// The width of `text` as the label helper sets it (it must have just set the font), or a guess where a canvas cannot measure.
const widthOf = (ctx, text, size) => {
  const m = typeof ctx.measureText === "function" ? ctx.measureText(text) : null;
  return m && typeof m.width === "number" ? m.width : text.length * size * 0.58;
};

export function storyArt(d) {
  const { label, GOLD, BONE, LOOKS } = d;
  return function storyPage(ctx, v) {
    const { round } = v;
    const s = round.story;
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
    // grow(n, ms): 0 to 1 over ms from when line n starts typing (1 once the page is typed out).
    const startOf = (i) => REVEAL_AT_MS + pg.lines.slice(0, i).reduce((c, l) => c + l.length, 0) * CHAR_MS;
    const grow = (i, ms = 1200) => (s.full || done ? 1 : smooth((t - startOf(i)) / ms));
    SCENES[pg.scene](ctx, { t, pal: pg.pal, line, full: s.full || done, label, grow, look: LOOKS.hall });
    ctx.restore();
    ctx.globalAlpha = 1;
    // A soft dark foot to the scene, and the band for the words.
    for (let i = 0; i < 4; i++) faint(ctx, 0.12, () => rect(ctx, 0, SCENE_H - (i + 1) * 0.6, W, 0.6, "#050308"));
    rect(ctx, 0, SCENE_H, W, H - SCENE_H, "#07050c");
    rect(ctx, 0, SCENE_H, W, 0.25, pg.pal.glow);
    // The heading, fading in, with the page's dots and the skip hint along the top.
    faint(ctx, clamp((t - 150) / 350), () => {
      label(ctx, pg.chapter, W / 2, SCENE_H + 2.3, 2.1, pg.pal.a, "center", W - 8);
      stroke(ctx, W / 2 - 14, SCENE_H + 4.1, W / 2 + 14, SCENE_H + 4.1, pg.pal.glow, 0.2);
    });
    // The lines typing out.
    const shownLines = typed(pg, n);
    shownLines.forEach((text, i) => {
      if (!text) return;
      const size = TEXT_SIZE;
      const full = pg.lines[i];
      label(ctx, "", 0, 0, size, BONE, "left");
      const x0 = W / 2 - widthOf(ctx, full, size) / 2;
      const y = SCENE_H + 6.7 + i * 3.35;
      label(ctx, text, x0, y, size, BONE, "left", W - 4);
      if (i === line && !done) {
        const w = widthOf(ctx, text, size);
        faint(ctx, 0.5 + 0.5 * Math.sin(t / 110), () => rect(ctx, x0 + w + 0.3, y - 1, 0.7, 2, pg.pal.glow));
      }
    });
    // The page dots, the skip hint and its bar.
    PAGES.forEach((_, i) => circle(ctx, 3 + i * 2.2, 3, i === s.page ? 0.7 : 0.35, i === s.page ? pg.pal.glow : "rgba(255, 255, 255, 0.35)"));
    faint(ctx, 0.85, () => label(ctx, SKIP_HINT.toUpperCase(), W - 3, 3, 1.5, BONE, "right", 40));
    if (s.hold >= 0) {
      const k = clamp(s.hold / SKIP_HOLD_MS);
      rect(ctx, W - 3 - 30, 4.9, 30, 0.7, "rgba(255, 255, 255, 0.2)");
      rect(ctx, W - 3 - 30, 4.9, 30 * k, 0.7, GOLD);
    }
    // The hint, pulsing once a press counts.
    if (ready(s)) {
      const last = s.page === PAGES.length - 1;
      faint(ctx, 0.55 + 0.45 * Math.sin(t / 260), () => label(ctx, last ? LAST_HINT : STORY_HINT, W / 2, H - 1.5, 1.6, pg.pal.glow, "center", W - 6));
    }
    // A fade up from black as each page opens.
    if (t < 500) faint(ctx, 1 - t / 500, () => rect(ctx, 0, 0, W, H, "#000"));
    ctx.restore();
    ctx.globalAlpha = 1;
  };
}
// The ms a page's typing ends, for the tests.
export { revealEnd };
