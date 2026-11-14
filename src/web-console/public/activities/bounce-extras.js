// Plan2Code Web Console - Bounce Road's extras: the three bosses that are no car (the Robo-Vac, the Whirlybird and the Cat's paw), what the later rivals carry (a turret, blades, spikes, a bomb, a magnet, a crate), the weapons in flight and lying in wait (rockets, bolts, bombs, lobbed barrels, oil), explosions, the glow round your car in a Fever, the boss's health bar, the Fever meter, the arcade logo of the start and end screens with the run's ranks, and the scanlines over the field.
//
// Drawing only: no rules and no state. bounce-draw.js calls in with the view
// bounce.js refills each frame. Everything is in field units; anything that
// moves follows the view's clock (or the round's), never Math.random(), so a
// paused game's frame stays still. Every color here is fixed, the same in
// light and dark. The words go through the label() bounce-draw.js hands in,
// so this file never imports that one (it imports this).

import { DARK_INK, circle, drawDropped, drawPickup, ellipse, hash, roundRect, star } from "./bounce-scenery.js";
import { BOMBER_DROPS, LOB_MS } from "./bounce-rivals.js";
import { shade } from "./bounce-cars.js";

const TAU = Math.PI * 2;
const EDGE = "rgba(0, 0, 0, 0.75)";
const HOT = Object.freeze(["#ff6fb5", "#ffd84a", "#7fe3ff", "#7ad151"]);
const FONT = `"Arial Black", "Segoe UI Black", Impact, system-ui, -apple-system, "Segoe UI", sans-serif`;

// The styles drawn here instead of by bounce-cars.js.
export const CUSTOM_STYLES = Object.freeze(["vac", "chopper", "paw"]);

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
const alphaOf = (ctx) => (Number.isFinite(ctx.globalAlpha) ? ctx.globalAlpha : 1);

/* ------------------------------------------------------------ the bosses */

// The size, the lift and the pancake factors `o` asks for, as bounce-cars.js
// works them out for a car: `air` 0 to 1 scales the body up by 0.35 and
// throws its shadow down and right, `squash` 0 to 1 flattens it.
function frameOf(o) {
  const w = Number.isFinite(o.w) && o.w > 0 ? o.w : 10;
  const h = Number.isFinite(o.h) && o.h > 0 ? o.h : w;
  const air = num(o.air, 0, 1, 0);
  const squash = num(o.squash, 0, 1, 0);
  return { w, h, air, squash, sx: 1 + 0.2 * squash, sy: 1 - 0.5 * squash, k: 1 + 0.35 * air };
}

function shadowOf(ctx, style, f, o) {
  const ox = f.w * (0.04 + 0.4 * f.air);
  const oy = f.h * (0.05 + 0.35 * f.air);
  const hx = (f.w / 2) * f.sx * (1 - 0.1 * f.air);
  const hy = (f.h / 2) * f.sy * (1 - 0.1 * f.air);
  ctx.fillStyle = `rgba(0, 0, 0, ${(0.28 - 0.12 * f.air) * (1 - 0.45 * num(o.fade, 0, 1, 0))})`;
  if (style === "chopper") {
    // The fuselage and the tail, and the rotor's faint disc.
    ellipse(ctx, ox, oy - hy * 0.25, hx * 0.62, hy * 0.6);
    ctx.fill();
    ctx.fillRect(ox - hx * 0.12, oy, hx * 0.24, hy * 0.92);
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
    circle(ctx, ox, oy - hy * 0.2, Math.min(hx, hy));
    ctx.fill();
  } else if (style === "vac") {
    ellipse(ctx, ox, oy, hx, hy);
    ctx.fill();
  } else {
    roundRect(ctx, ox - hx, oy - hy, hx * 2, hy * 2, f.w * 0.3);
    ctx.fill();
  }
}

// Only a boss's shadow, as drawBossBody() would draw it, in its own save()
// and restore(): the same call shape as bounce-cars.js's drawCarShadow().
// `fade` (0 to 1) pales it, for the Whirlybird up high.
export function drawBossShadow(ctx, style, opts) {
  const o = opts ?? {};
  ctx.save();
  shadowOf(ctx, style, frameOf(o), o);
  ctx.restore();
}

// Scratches and, past two thirds, smoke: a boss's damage, 0 to 1.
function scars(ctx, w, h, damage, clock) {
  if (!(damage > 0)) return;
  const n = Math.ceil(damage * 4);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = Math.min(w, h) * 0.025;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1;
    const y = -h * 0.28 + k * h * 0.16;
    ctx.moveTo(side * w * 0.34, y);
    ctx.lineTo(side * w * 0.16, y + h * 0.05);
    ctx.lineTo(side * w * 0.22, y + h * 0.07);
  }
  ctx.stroke();
  if (damage <= 0.66) return;
  for (let k = 0; k < 3; k++) {
    const p = (((clock / 700 + k / 3) % 1) + 1) % 1;
    const r = Math.min(w, h) * (0.1 + p * 0.14);
    const x = Math.sin(clock / 400 + k * 2) * w * 0.14;
    const y = -h * 0.1 + p * h * 0.3;
    ctx.fillStyle = `rgba(52, 52, 56, ${0.62 * (1 - p)})`;
    circle(ctx, x, y, r);
    ctx.fill();
  }
}

// The Robo-Vac from above: a round disc in its bumper, two side brushes
// spinning past its front, a lid, and a visor with one light that sweeps
// from side to side, and turns red (flashing, then held) when it is about
// to charge and while it does. Its front, and its eye, face down the road
// at you.
function vac(ctx, w, h, o, paint) {
  const r = Math.min(w, h) / 2;
  const hot = o.mode === "warn" || o.mode === "charge";
  const lit = o.mode === "warn" ? Math.floor(o.clock / 90) % 2 === 0 : hot;
  ctx.strokeStyle = "#f4f1ea";
  ctx.lineWidth = r * 0.05;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const a = side * (o.clock / 70) + (k * TAU) / 3;
      ctx.moveTo(side * r * 0.62, r * 0.62);
      ctx.lineTo(side * r * 0.62 + Math.cos(a) * r * 0.3, r * 0.62 + Math.sin(a) * r * 0.3);
    }
  }
  ctx.stroke();
  if (lit) {
    ctx.fillStyle = "rgba(255, 50, 40, 0.3)";
    circle(ctx, 0, 0, r);
    ctx.fill();
  }
  circle(ctx, 0, 0, r * 0.95);
  ctx.fillStyle = "#23262e";
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = r * 0.05;
  ctx.stroke();
  circle(ctx, 0, 0, r * 0.82);
  ctx.fillStyle = paint;
  ctx.fill();
  // The bumper, thick round its front half.
  ctx.strokeStyle = lit ? "#ff3b3b" : "#3d424d";
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, 0.08 * Math.PI, 0.92 * Math.PI);
  ctx.stroke();
  circle(ctx, 0, -r * 0.1, r * 0.5);
  ctx.fillStyle = shade(paint, -0.18);
  ctx.fill();
  ctx.strokeStyle = shade(paint, -0.45);
  ctx.lineWidth = r * 0.035;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
  ellipse(ctx, -r * 0.28, -r * 0.36, r * 0.26, r * 0.14);
  ctx.fill();
  // The power button on the lid.
  circle(ctx, 0, -r * 0.1, r * 0.12);
  ctx.fillStyle = lit ? "#ff3b3b" : "#f4f1ea";
  ctx.fill();
  // The visor and its light.
  roundRect(ctx, -r * 0.5, r * 0.36, r, r * 0.26, r * 0.13);
  ctx.fillStyle = "#14161b";
  ctx.fill();
  const ex = hot ? 0 : Math.sin(o.clock / 320) * r * 0.3;
  if (lit) {
    ctx.fillStyle = "rgba(255, 60, 40, 0.5)";
    circle(ctx, ex, r * 0.49, r * 0.22);
    ctx.fill();
  }
  circle(ctx, ex, r * 0.49, r * 0.09);
  ctx.fillStyle = hot ? (lit ? "#ff3b3b" : "#7a1712") : "#5ef2e0";
  ctx.fill();
}

// The Whirlybird from above, nose up: skids, a tail boom with its fin and
// little rotor, a fuselage with a glass nose, and the main rotor, always
// turning: a faint disc, two blades and the ghost of where they just were.
function chopper(ctx, w, h, o, paint) {
  const dark = shade(paint, -0.4);
  const lw = Math.min(w, h) * 0.03;
  ctx.strokeStyle = "#2b2f38";
  ctx.lineWidth = lw * 1.6;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(side * w * 0.3, -h * 0.36);
    ctx.lineTo(side * w * 0.3, h * 0.1);
    ctx.moveTo(side * w * 0.3, -h * 0.24);
    ctx.lineTo(0, -h * 0.2);
    ctx.moveTo(side * w * 0.3, -h * 0.02);
    ctx.lineTo(0, -h * 0.06);
  }
  ctx.stroke();
  // The tail: the boom, the fin across it and the rotor on its end.
  ctx.fillStyle = dark;
  ctx.fillRect(-w * 0.055, 0, w * 0.11, h * 0.46);
  roundRect(ctx, -w * 0.24, h * 0.35, w * 0.48, h * 0.07, h * 0.02);
  ctx.fillStyle = paint;
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = "rgba(230, 236, 242, 0.6)";
  ellipse(ctx, w * 0.11, h * 0.45, w * 0.035, h * 0.05 * (0.5 + 0.5 * Math.abs(Math.sin(o.clock / 30))));
  ctx.fill();
  // The fuselage, a stripe down it and the glass nose.
  ellipse(ctx, 0, -h * 0.13, w * 0.28, h * 0.3);
  ctx.fillStyle = paint;
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = lw;
  ctx.stroke();
  ctx.fillStyle = dark;
  ctx.fillRect(-w * 0.05, -h * 0.12, w * 0.1, h * 0.26);
  ellipse(ctx, 0, -h * 0.28, w * 0.2, h * 0.12);
  ctx.fillStyle = "#22364b";
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(206, 232, 255, 0.55)";
  ellipse(ctx, -w * 0.07, -h * 0.31, w * 0.07, h * 0.04);
  ctx.fill();
  // The rotor.
  const R = Math.min(w, h) * 0.5;
  const cy = -h * 0.1;
  const a = o.clock / 42;
  ctx.fillStyle = "rgba(225, 232, 240, 0.16)";
  circle(ctx, 0, cy, R);
  ctx.fill();
  for (const [turn, color, wide] of [[-0.5, "rgba(43, 47, 56, 0.25)", 1.4], [-0.25, "rgba(43, 47, 56, 0.4)", 1.2], [0, "#2b2f38", 1]]) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw * 2.2 * wide;
    ctx.beginPath();
    ctx.moveTo(-Math.cos(a + turn) * R, cy - Math.sin(a + turn) * R);
    ctx.lineTo(Math.cos(a + turn) * R, cy + Math.sin(a + turn) * R);
    ctx.stroke();
  }
  circle(ctx, 0, cy, w * 0.07);
  ctx.fillStyle = "#f4f1ea";
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = lw;
  ctx.stroke();
}

// The Cat's paw from above, reaching down the road at you: a striped
// foreleg from the top of its box, the paw, four pale toes and their
// claws, drawn further out while the paw is up or sweeping.
function paw(ctx, w, h, o, fur) {
  const dark = shade(fur, -0.35);
  const pale = shade(fur, 0.6);
  const lw = Math.min(w, h) * 0.028;
  const out = o.mode === "swipe" || o.air > 0 ? 1 : 0.5;
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = lw;
  // The foreleg and its tabby stripes.
  roundRect(ctx, -w * 0.3, -h / 2, w * 0.6, h * 0.62, w * 0.16);
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = dark;
  for (const [f, side] of [[-0.43, -1], [-0.33, 1], [-0.23, -1], [-0.13, 1]]) {
    ctx.beginPath();
    ctx.moveTo(side * w * 0.29, f * h);
    ctx.lineTo(side * w * 0.29, (f + 0.05) * h);
    ctx.lineTo(-side * w * 0.04, (f + 0.035) * h);
    ctx.closePath();
    ctx.fill();
  }
  const toes = [[-0.33, 0.25], [-0.115, 0.32], [0.115, 0.32], [0.33, 0.25]];
  // The claws, under the toes.
  ctx.fillStyle = "#f4f1ea";
  for (const [tx, ty] of toes) {
    ctx.beginPath();
    ctx.moveTo(tx * w - w * 0.045, (ty + 0.07) * h);
    ctx.lineTo(tx * w * 1.02, (ty + 0.07 + 0.105 * out) * h);
    ctx.lineTo(tx * w + w * 0.045, (ty + 0.07) * h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  ellipse(ctx, 0, h * 0.09, w * 0.46, h * 0.26);
  ctx.fillStyle = fur;
  ctx.fill();
  ctx.stroke();
  for (const [tx, ty] of toes) {
    ellipse(ctx, tx * w, ty * h, w * 0.112, h * 0.1);
    ctx.fillStyle = pale;
    ctx.fill();
    ctx.stroke();
  }
  // The fur's shading: a stripe or two across the paw, and a sheen.
  ctx.fillStyle = dark;
  ctx.fillRect(-w * 0.2, h * 0.02, w * 0.4, h * 0.022);
  ctx.fillRect(-w * 0.13, h * 0.09, w * 0.26, h * 0.022);
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ellipse(ctx, -w * 0.16, -h * 0.02, w * 0.16, h * 0.09);
  ctx.fill();
  if (o.mode === "swipe") {
    // Sweeping: streaks trailing off the side it came from.
    const side = num(o.tilt, -1, 1, 0) >= 0 ? -1 : 1;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = lw * 1.4;
    ctx.beginPath();
    for (const f of [0.14, 0.24, 0.34]) {
      ctx.moveTo(side * w * 0.36, f * h);
      ctx.lineTo(side * w * 0.5, f * h);
    }
    ctx.stroke();
  }
}

// One boss about the origin, filling `opts.w` by `opts.h`, in the call shape
// of bounce-cars.js's drawCarBody(): `style` is one of CUSTOM_STYLES, and
// `opts` carries `color`, `air`, `squash`, `clock`, `damage` (0 to 1), `mode`
// (the boss's own), `tilt` and `shadow: false` to leave the shadow to
// drawBossShadow(). One save() and one restore() round it all.
export function drawBossBody(ctx, style, opts) {
  const o = opts ?? {};
  const f = frameOf(o);
  const view = { ...o, clock: Number.isFinite(o.clock) ? o.clock : 0, air: f.air };
  const paint = shade(typeof o.color === "string" ? o.color : "", 0);
  ctx.save();
  if (o.shadow !== false) shadowOf(ctx, style, f, o);
  ctx.scale(f.k * f.sx, f.k * f.sy);
  if (style === "vac") vac(ctx, f.w, f.h, view, o.color ? paint : "#8fd3c8");
  else if (style === "chopper") chopper(ctx, f.w, f.h, view, o.color ? paint : "#b7d957");
  else paw(ctx, f.w, f.h, view, o.color ? paint : "#f0a04b");
  scars(ctx, f.w, f.h, num(o.damage, 0, 1, 0), view.clock);
  ctx.restore();
}

/* -------------------------------------------------- what the rivals carry */

// A bomb `r` round at (x, y): a black ball, its cap and its fuse, the spark
// on it bright while `lit`.
function bombAt(ctx, x, y, r, lit) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, x + r * 0.3, y + r * 0.4, r, r * 0.8);
  ctx.fill();
  circle(ctx, x, y, r);
  ctx.fillStyle = "#1c1c20";
  ctx.fill();
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = r * 0.14;
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.24);
  ctx.fill();
  ctx.fillStyle = "#6d7279";
  ctx.fillRect(x + r * 0.3, y - r * 1.05, r * 0.5, r * 0.4);
  ctx.strokeStyle = "#c9a36a";
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(x + r * 0.55, y - r * 1.05);
  ctx.lineTo(x + r * 0.95, y - r * 1.5);
  ctx.stroke();
  if (lit) {
    star(ctx, x + r * 0.95, y - r * 1.5, r * 0.62, r * 0.26, 0.3);
    ctx.fillStyle = "#ffd84a";
    ctx.fill();
    circle(ctx, x + r * 0.95, y - r * 1.5, r * 0.2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
  } else {
    circle(ctx, x + r * 0.95, y - r * 1.5, r * 0.2);
    ctx.fillStyle = "#ff8a1f";
    ctx.fill();
  }
}

// Three stars wheeling over a dazed boss.
function dazed(ctx, w, h, clock) {
  for (let k = 0; k < 3; k++) {
    const a = clock / 260 + (k * TAU) / 3;
    star(ctx, Math.cos(a) * w * 0.32, -h * 0.08 + Math.sin(a) * h * 0.16, 0.95, 0.4, a);
    ctx.fillStyle = "#ffd84a";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.18;
    ctx.stroke();
  }
}

// What a rival carries or shows, drawn over its body in the body's own
// frame (the origin its middle, nose up, turned with it): the Blaster's
// turret (glowing while it aims), the Slasher's blades (glinting half out as
// a warning, then right out and red tipped), the Spike's roof of spikes,
// the Bomber's next bomb, the Phantom's shimmer while it is out of reach,
// the Magnet's horseshoe, the Supply truck's crate, the Big Rig's tank, the
// sparks of a zap, the swirl of a spin and a dazed boss's stars. `o` is the
// options the body was drawn with, `a0` the alpha before the car's own.
export function drawCarExtras(ctx, car, v, o, a0 = 1) {
  if (car.id === 0) return;
  const spec = v.rivals[car.kind];
  if (!spec) return;
  const w = car.w;
  const h = car.l;
  const t = v.clock;
  const k = 1 + 0.35 * num(o.air, 0, 1, 0);
  const lw = Math.max(0.12, Math.min(w, h / 1.6) * 0.05);
  ctx.save();
  ctx.scale(k, k);
  ctx.lineJoin = "round";
  const live = car.out <= 0;
  if (live && car.kind === "blaster") {
    const hot = car.aimMs > 0;
    const ty = h * 0.2;
    if (hot) {
      ctx.fillStyle = `rgba(240, 107, 255, ${0.35 + 0.2 * Math.sin(t / 40)})`;
      circle(ctx, 0, ty + h * 0.12, w * 0.5);
      ctx.fill();
    }
    ctx.fillStyle = "#2b2f38";
    ctx.fillRect(-w * 0.075, ty, w * 0.15, h * 0.3);
    ctx.fillStyle = hot ? "#ffffff" : "#8a8f99";
    ctx.fillRect(-w * 0.1, ty + h * 0.26, w * 0.2, h * 0.05);
    circle(ctx, 0, ty, w * 0.21);
    ctx.fillStyle = "#3d424d";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = lw;
    ctx.stroke();
    circle(ctx, 0, ty, w * 0.1);
    ctx.fillStyle = hot ? (Math.floor(t / 60) % 2 ? "#ffffff" : "#f06bff") : "#8a3a96";
    ctx.fill();
  } else if (live && car.kind === "slasher" && car.blade) {
    const full = car.blade === "out";
    const reach = w * (full ? 0.6 : 0.26);
    for (const side of [-1, 1]) {
      const x0 = side * w * 0.4;
      const tip = side * (w * 0.4 + reach);
      ctx.beginPath();
      ctx.moveTo(x0, -h * 0.22);
      ctx.lineTo(tip, -h * 0.03);
      ctx.lineTo(tip, h * 0.03);
      ctx.lineTo(x0, h * 0.22);
      ctx.closePath();
      ctx.fillStyle = "#d9dfe8";
      ctx.fill();
      ctx.strokeStyle = DARK_INK;
      ctx.lineWidth = lw;
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      ctx.beginPath();
      ctx.moveTo(x0, -h * 0.2);
      ctx.lineTo(tip, -h * 0.03);
      ctx.lineTo(x0, -h * 0.1);
      ctx.closePath();
      ctx.fill();
      if (full) {
        ctx.fillStyle = "#ff2d2d";
        ctx.beginPath();
        ctx.moveTo(side * (w * 0.4 + reach * 0.5), -h * 0.125);
        ctx.lineTo(tip, -h * 0.03);
        ctx.lineTo(tip, h * 0.03);
        ctx.lineTo(side * (w * 0.4 + reach * 0.5), h * 0.125);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (Math.floor(t / 110) % 2 === 0) {
        star(ctx, tip, 0, w * 0.2, w * 0.07, t / 200);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
      }
    }
  } else if (live && spec.spiky) {
    const s = Math.min(w, h) * 0.115;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 2; c++) {
        const cx = (c - 0.5) * w * 0.38;
        const cy = (r - 1) * h * 0.22 + h * 0.03;
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s);
        ctx.lineTo(cx - s, cy);
        ctx.closePath();
        ctx.fillStyle = "#f4f6f9";
        ctx.fill();
        ctx.strokeStyle = DARK_INK;
        ctx.lineWidth = lw * 0.8;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx, cy - s);
        ctx.lineTo(cx + s, cy);
        ctx.lineTo(cx, cy + s);
        ctx.closePath();
        ctx.fillStyle = "#7d8796";
        ctx.fill();
        ctx.fillStyle = "#ff3b3b";
        ctx.fillRect(cx - s * 0.2, cy - s * 0.2, s * 0.4, s * 0.4);
      }
    }
  } else if (live && car.kind === "bomber") {
    // A rack across its tail, with the next bomb on it while it has one.
    ctx.fillStyle = "#3d424d";
    ctx.fillRect(-w * 0.34, h * 0.3, w * 0.68, h * 0.05);
    if (car.drops < BOMBER_DROPS) bombAt(ctx, 0, h * 0.34, w * 0.2, Math.floor(t / 140) % 2 === 0);
  } else if (live && car.kind === "magnet") {
    // The horseshoe, its open end toward you.
    const you = v.round.cars[0];
    const dir = you.d > car.d ? -1 : 1;
    const R = w * 0.25;
    const cy = -h * 0.02;
    const shoe = () => {
      ctx.beginPath();
      if (dir > 0) ctx.arc(0, cy, R, Math.PI, 0);
      else ctx.arc(0, cy, R, 0, Math.PI);
      ctx.moveTo(-R, cy);
      ctx.lineTo(-R, cy + dir * R * 1.2);
      ctx.moveTo(R, cy);
      ctx.lineTo(R, cy + dir * R * 1.2);
      ctx.stroke();
    };
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = w * 0.2;
    shoe();
    ctx.strokeStyle = "#e8483c";
    ctx.lineWidth = w * 0.13;
    shoe();
    ctx.fillStyle = car.pulling && Math.floor(t / 80) % 2 ? "#7fe3ff" : "#f4f1ea";
    for (const side of [-1, 1]) ctx.fillRect(side * R - w * 0.065, cy + dir * R * 1.2 - (dir > 0 ? R * 0.35 : 0), w * 0.13, R * 0.35);
  } else if (live && car.kind === "supply" && !car.gave) {
    // The crate on its roof, a ring round it beating: land here.
    const s = w * 0.26;
    const cy = h * 0.14;
    const beat = 0.5 + 0.5 * Math.sin(t / 160);
    ctx.strokeStyle = `rgba(122, 209, 81, ${0.35 + 0.5 * beat})`;
    ctx.lineWidth = lw * 1.6;
    circle(ctx, 0, cy, s * (1.5 + 0.25 * beat));
    ctx.stroke();
    roundRect(ctx, -s, cy - s, s * 2, s * 2, s * 0.2);
    ctx.fillStyle = "#c98a3c";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = lw;
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(-s, cy - s * 0.12, s * 2, s * 0.24);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${s * 1.7}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 0, cy + s * 0.08, s * 1.8);
  } else if (live && car.kind === "tanker") {
    // The tank on its back: a sheen down it, a red band, three hatches.
    const y0 = -h * 0.25;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(-w * 0.16, y0, w * 0.1, h * 0.72);
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    ctx.fillRect(w * 0.16, y0, w * 0.12, h * 0.72);
    ctx.fillStyle = "#e8483c";
    ctx.fillRect(-w * 0.33, -h * 0.2, w * 0.66, h * 0.03);
    ctx.fillRect(-w * 0.33, h * 0.42, w * 0.66, h * 0.03);
    for (const f of [-0.1, 0.12, 0.34]) {
      circle(ctx, 0, f * h, w * 0.13);
      ctx.fillStyle = "#8a8f99";
      ctx.fill();
      ctx.strokeStyle = DARK_INK;
      ctx.lineWidth = lw * 0.8;
      ctx.stroke();
      circle(ctx, 0, f * h, w * 0.06);
      ctx.fillStyle = "#3d424d";
      ctx.fill();
    }
  }
  if (live && car.phased) {
    // Out of reach: pale lines sliding down it, and a faint edge.
    ctx.globalAlpha = a0 * 0.6;
    ctx.fillStyle = "#ffffff";
    for (let n = 0; n < 3; n++) {
      const p = (((t / 700 + n / 3) % 1) + 1) % 1;
      ctx.fillRect(-w / 2, -h / 2 + p * h, w, 0.2);
    }
    roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.3);
    ctx.strokeStyle = "rgba(223, 232, 255, 0.8)";
    ctx.lineWidth = 0.16;
    ctx.stroke();
    ctx.globalAlpha = a0 * 0.28;
  }
  if (live && car.zapMs > 0) {
    // Fried: jagged sparks jumping over it, new ones every few frames.
    const step = Math.floor(t / 70);
    for (const [color, wide] of [["#5ef2e0", 0.32], ["#ffffff", 0.12]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = wide;
      ctx.beginPath();
      for (let n = 0; n < 3; n++) {
        let x = ((hash(step, n) % 100) / 100 - 0.5) * w;
        let y = -h / 2 + ((hash(step, n + 9) % 100) / 100) * h * 0.4;
        ctx.moveTo(x, y);
        for (let seg = 0; seg < 4; seg++) {
          x += ((hash(step + seg, n + 20) % 100) / 100 - 0.5) * w * 0.7;
          y += h * 0.14;
          ctx.lineTo(Math.max(-w * 0.6, Math.min(w * 0.6, x)), y);
        }
      }
      ctx.stroke();
    }
  }
  if (live && car.spinMs > 0) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 0.25;
    const R = Math.max(w, h) * 0.58;
    for (const a of [0, Math.PI]) {
      ctx.beginPath();
      ctx.arc(0, 0, R, a, a + 1.5);
      ctx.stroke();
    }
  }
  if (live && spec.boss && car.stunMs > 0) dazed(ctx, w, h, t);
  ctx.restore();
}

// The pull between a Magnet rival and your car while it drags you over
// (beads running along three arcs from you to its horseshoe), and the
// Robo-Vac's suction while it sweeps (streaks drawn in to its front).
export function drawPulls(ctx, v) {
  const you = v.round.cars[0];
  const t = v.clock;
  if (you.out > 0) return;
  const yy = v.yOf(you.d);
  for (const car of v.round.cars) {
    if (car.id === 0 || car.out > 0) continue;
    const cy = v.yOf(car.d);
    if (cy < -20 || cy > v.g.FIELD_H + 20) continue;
    if (car.kind === "magnet" && car.pulling) {
      const dx = car.x - you.x;
      const dy = cy - yy;
      const len = Math.hypot(dx, dy) || 1;
      for (const bend of [-3.5, 0, 3.5]) {
        const mx = (you.x + car.x) / 2 - (dy / len) * bend;
        const my = (yy + cy) / 2 + (dx / len) * bend;
        for (let n = 0; n < 9; n++) {
          const p = (((t / 620 + n / 9) % 1) + 1) % 1;
          const q = 1 - p;
          ctx.fillStyle = n % 2 ? "#7fe3ff" : "#ff5d3a";
          ctx.globalAlpha = 0.35 + 0.6 * Math.sin(Math.PI * p);
          circle(ctx, q * q * you.x + 2 * q * p * mx + p * p * car.x, q * q * yy + 2 * q * p * my + p * p * cy, 0.45);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    } else if (car.kind === "vac" && !(car.stunMs > 0) && (car.mode === "sweep" || car.mode === "warn")) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      for (let n = 0; n < 8; n++) {
        const p = (((t / 450 + n / 8) % 1) + 1) % 1;
        const fan = ((hash(n, 5) % 100) / 100 - 0.5) * 26 * (1 - p);
        const y = cy + car.l / 2 + 1 + (1 - p) * 26;
        ctx.moveTo(car.x + fan, y);
        ctx.lineTo(car.x + fan * 0.9, y - 2.4);
      }
      ctx.stroke();
    }
  }
}

/* ----------------------------------------------------------------- you */

// Under your car: the Star magnet's reach (a faint ring, beads drawn in
// along it) and a Fever's glow (rings in four hot colors, beating).
export function drawYouUnder(ctx, v, at) {
  const you = v.round.cars[0];
  if (you.out > 0) return;
  const t = v.clock;
  if (you.magnetMs > 0) {
    const R = 15;
    ctx.strokeStyle = "rgba(255, 111, 181, 0.4)";
    ctx.lineWidth = 0.3;
    circle(ctx, at.x, at.y, R);
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 111, 181, 0.75)";
    for (let n = 0; n < 8; n++) {
      const a = (n * TAU) / 8 + t / 1400;
      const rr = R * (1 - ((((t / 800 + n / 8) % 1) + 1) % 1) * 0.7);
      circle(ctx, at.x + Math.cos(a) * rr, at.y + Math.sin(a) * rr, 0.32);
      ctx.fill();
    }
  }
  if (v.round.feverMs > 0) {
    const beat = 0.5 + 0.5 * Math.sin(t / 90);
    const step = Math.floor(t / 110);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ellipse(ctx, at.x, at.y, you.w * 0.95, you.l * 0.72);
    ctx.fill();
    for (let n = 0; n < 3; n++) {
      ellipse(ctx, at.x, at.y, you.w * (0.8 + n * 0.17) + beat * 0.4, you.l * (0.62 + n * 0.1) + beat * 0.4);
      ctx.strokeStyle = HOT[(n + step) % HOT.length];
      ctx.globalAlpha = 0.9 - n * 0.25;
      ctx.lineWidth = 0.5 - n * 0.1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

// Over your car: the gadget you hold, as a small crate riding behind it.
export function drawYouOver(ctx, v, at) {
  const you = v.round.cars[0];
  if (you.out > 0 || !you.held) return;
  const spec = v.powers[you.held.kind];
  if (!spec) return;
  drawPickup(ctx, you.held.kind, at.x, at.y + you.l / 2 + 1.9 + 0.15 * Math.sin(v.clock / 180), 1.15, spec.color, true);
}

/* ------------------------------------------------------------- weapons */

// The oil on the road: a boss's is the black of a slick, yours has a
// purple cast, so you can tell which one you may drive through. Each thins
// out as its time ends.
export function drawSpills(ctx, v) {
  const t = v.round.clock;
  for (const sp of v.round.spills) {
    const y = v.yOf(sp.d);
    if (y < -8 || y > v.g.FIELD_H + 8) continue;
    const was = alphaOf(ctx);
    ctx.globalAlpha = was * Math.max(0, Math.min(1, (sp.until - t) / 700));
    ctx.fillStyle = sp.foe ? "rgba(20, 16, 24, 0.84)" : "rgba(66, 30, 110, 0.82)";
    ellipse(ctx, sp.x, y, sp.w / 2, sp.l / 2);
    ctx.fill();
    circle(ctx, sp.x - sp.w * 0.3, y + sp.l * 0.22, sp.w * 0.22);
    ctx.fill();
    circle(ctx, sp.x + sp.w * 0.32, y - sp.l * 0.2, sp.w * 0.18);
    ctx.fill();
    ellipse(ctx, sp.x - sp.w * 0.12, y - sp.l * 0.12, sp.w * 0.22, sp.l * 0.1);
    ctx.fillStyle = sp.foe ? "rgba(160, 120, 255, 0.45)" : "rgba(210, 170, 255, 0.7)";
    ctx.fill();
    ellipse(ctx, sp.x + sp.w * 0.15, y + sp.l * 0.15, sp.w * 0.12, sp.l * 0.06);
    ctx.fillStyle = sp.foe ? "rgba(90, 255, 200, 0.35)" : "rgba(255, 255, 255, 0.5)";
    ctx.fill();
    ctx.globalAlpha = was;
  }
}

// How far through its flight a lobbed thing is, 0 as it is thrown to 1 as
// it lands.
const lobAt = (h, t) => Math.max(0, Math.min(1, 1 - (h.at - t) / LOB_MS));

// The threats lying on the road, under the cars: a Bomber's bombs, each
// with its fuse blinking faster as its time comes and a ring for its
// blast, and the shadow growing where a lobbed thing will land (with its
// blast's ring, when it is a bomb).
export function drawThreatsLow(ctx, v) {
  const t = v.round.clock;
  const ring = (x, y, r, heat) => {
    circle(ctx, x, y, r);
    ctx.fillStyle = `rgba(255, 59, 59, ${0.05 + 0.13 * heat})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 59, 59, ${0.3 + 0.6 * heat})`;
    ctx.lineWidth = 0.3;
    ctx.stroke();
  };
  for (const b of v.round.bombs) {
    const y = v.yOf(b.d);
    if (y < -12 || y > v.g.FIELD_H + 12) continue;
    const left = b.at - t;
    const heat = Math.max(0, Math.min(1, 1 - left / Math.max(1, b.at - b.t0)));
    ring(b.x, y, b.r, heat);
    const lit = Math.floor(t / (left < 350 ? 60 : left < 800 ? 110 : 200)) % 2 === 0;
    bombAt(ctx, b.x, y, 1.3, lit);
    if (lit && left < 800) {
      ctx.fillStyle = "rgba(255, 60, 40, 0.5)";
      circle(ctx, b.x, y, 1.3);
      ctx.fill();
    }
  }
  for (const h of v.round.lobs) {
    const y = v.yOf(h.d);
    if (y < -12 || y > v.g.FIELD_H + 12) continue;
    const p = lobAt(h, t);
    if (h.boom > 0) ring(h.x, y, h.boom, p);
    ellipse(ctx, h.x, y, (h.w / 2) * (0.4 + 0.6 * p), (h.l / 2) * (0.4 + 0.6 * p));
    ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.35 * p})`;
    ctx.fill();
    ellipse(ctx, h.x, y, h.w / 2 + 0.6, h.l / 2 + 0.6);
    ctx.strokeStyle = Math.floor(t / 120) % 2 ? "#ff3b3b" : "#ffffff";
    ctx.lineWidth = 0.35;
    ctx.stroke();
  }
}

// An explosion: a blocky fireball, growing fast to its size, a white core,
// yellow, orange and red round it and dark smoke at its edge, the fire
// burning down to smoke as it fades.
function drawBoom(ctx, v, b) {
  const p = Math.max(0, Math.min(1, 1 - b.life / b.max));
  const R = b.r * (0.35 + 0.65 * Math.min(1, p / 0.3));
  const cell = Math.max(0.55, b.r / 6);
  const n = Math.ceil(R / cell);
  const x0 = b.x;
  const y0 = v.yOf(b.d);
  if (y0 < -R - 2 || y0 > v.g.FIELD_H + R + 2) return;
  const heat = 1 - p;
  const seed = Math.round(b.x * 7 + b.d * 3) + Math.floor(p * 7);
  const bands = [0.42 * heat, 0.7 * heat, 0.55 + 0.4 * heat, 0.75 + 0.2 * heat, 1];
  const colors = ["#ffffff", "#ffe14a", "#ff8a1f", "#d63a1a", "#3a3238"];
  const was = alphaOf(ctx);
  ctx.globalAlpha = was * (p > 0.7 ? Math.max(0, (1 - p) / 0.3) : 1);
  for (let band = 4; band >= 0; band--) {
    const lo = band ? bands[band - 1] : -1;
    const hi = bands[band];
    if (hi <= lo) continue;
    ctx.fillStyle = colors[band];
    ctx.beginPath();
    for (let iy = -n; iy <= n; iy++) {
      for (let ix = -n; ix <= n; ix++) {
        const q = (Math.hypot(ix, iy) * cell) / R + ((hash(ix + 31 + seed, iy + 57) % 100) / 100 - 0.5) * 0.3;
        if (q > lo && q <= hi) ctx.rect(x0 + (ix - 0.5) * cell, y0 + (iy - 0.5) * cell, cell, cell);
      }
    }
    ctx.fill();
  }
  ctx.globalAlpha = was;
}

// The threats in flight, over the cars: your rockets going up the road, a
// Blaster's bolts coming down it, what a boss lobbed on its way down, and
// the explosions.
export function drawThreatsHigh(ctx, v) {
  const t = v.round.clock;
  const H = v.g.FIELD_H;
  for (const s of v.round.shots) {
    const y = v.yOf(s.d);
    if (y < -5 || y > H + 5) continue;
    const flick = 0.75 + 0.25 * Math.sin(t / 23 + s.x);
    for (const [color, k] of [["#ff7a1a", 1], ["#ffd84a", 0.6], ["#ffffff", 0.3]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(s.x - 0.5 * k, y + 1.1);
      ctx.lineTo(s.x, y + 1.1 + 2.8 * k * flick);
      ctx.lineTo(s.x + 0.5 * k, y + 1.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#e8483c";
    ctx.beginPath();
    ctx.moveTo(s.x - 1.1, y + 1.3);
    ctx.lineTo(s.x, y - 0.2);
    ctx.lineTo(s.x + 1.1, y + 1.3);
    ctx.closePath();
    ctx.fill();
    roundRect(ctx, s.x - 0.6, y - 1.5, 1.2, 2.7, 0.4);
    ctx.fillStyle = "#f4f1ea";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.2;
    ctx.stroke();
    ctx.fillStyle = "#e8483c";
    ctx.beginPath();
    ctx.moveTo(s.x - 0.6, y - 1.3);
    ctx.lineTo(s.x, y - 2.5);
    ctx.lineTo(s.x + 0.6, y - 1.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  for (const b of v.round.bolts) {
    const y = v.yOf(b.d);
    if (y < -5 || y > H + 5) continue;
    const flick = 0.8 + 0.2 * Math.sin(t / 19 + b.x);
    ctx.fillStyle = "rgba(240, 107, 255, 0.4)";
    ellipse(ctx, b.x, y, 1.5 * flick, 2.9 * flick);
    ctx.fill();
    for (const [color, k] of [["#ff3df0", 1], ["#ffffff", 0.5]]) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(b.x, y + 2.3 * k);
      ctx.lineTo(b.x + 0.8 * k, y);
      ctx.lineTo(b.x, y - 1.7 * k);
      ctx.lineTo(b.x - 0.8 * k, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#ff9df7";
    ctx.fillRect(b.x - 0.15, y - 2.6 - flick, 0.3, 0.7);
    ctx.fillRect(b.x - 0.6, y - 2.2, 0.25, 0.5);
    ctx.fillRect(b.x + 0.35, y - 2.4, 0.25, 0.5);
  }
  for (const h of v.round.lobs) {
    const p = lobAt(h, t);
    const up = Math.sin(Math.PI * p);
    const x = h.fx + (h.x - h.fx) * p;
    const y = v.yOf(h.fd) + (v.yOf(h.d) - v.yOf(h.fd)) * p - up * 16;
    if (y < -10 || y > H + 10) continue;
    const size = Math.max(h.w, h.l) * (1 + up * 0.45);
    if (h.what === "barrel") drawDropped(ctx, "barrel", x, y, size);
    else bombAt(ctx, x, y, size * 0.42, Math.floor(t / 70) % 2 === 0);
  }
  for (const b of v.fx.booms) drawBoom(ctx, v, b);
}

/* ----------------------------------------------------------------- HUD */

// The Fever meter: a thin bar along the foot of the pills' strip, filling
// from the left in hot pink to gold, and a run of four hot colors,
// marching, while the Fever burns. In board units (the strip's own).
export function drawFever(ctx, v) {
  const { g } = v;
  if (v.state !== "running" && v.state !== "paused") return;
  const tall = 0.42;
  const y = g.HUD_H - tall;
  ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
  ctx.fillRect(0, y, g.W, tall);
  const fill = Math.max(0, Math.min(1, v.hud.fever || 0));
  if (v.hud.feverOn) {
    const step = Math.floor(v.clock / 80);
    const each = g.W / 26;
    for (let n = 0; n < 26; n++) {
      ctx.fillStyle = HOT[(((n - step) % HOT.length) + HOT.length) % HOT.length];
      ctx.fillRect(n * each, y, each + 0.02, tall);
    }
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.25 * Math.sin(v.clock / 90)})`;
    ctx.fillRect(0, y, g.W, tall);
    return;
  }
  if (fill <= 0) return;
  const grad = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, g.W, 0) : null;
  if (grad && typeof grad.addColorStop === "function") {
    grad.addColorStop(0, "#ff3d9a");
    grad.addColorStop(1, "#ffd21f");
    ctx.fillStyle = grad;
  } else ctx.fillStyle = "#ff6fb5";
  ctx.fillRect(0, y, g.W * fill, tall);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(Math.max(0, g.W * fill - 0.35), y, 0.35, tall);
}

// The boss's health bar across the top of the field: its name on the left,
// then a segment for each of its hits, lit while it has them, the last one
// blinking, all of them flashing while it is dazed.
export function drawBossBar(ctx, v, label) {
  const b = v.hud.boss;
  if (!b || !(b.max > 0) || (v.state !== "running" && v.state !== "paused")) return;
  const W = v.g.FIELD_W;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, W, 4.6);
  ctx.fillStyle = "#e8483c";
  ctx.fillRect(0, 4.6, W, 0.2);
  label(ctx, String(b.name).toUpperCase(), 1.4, 2.35, 2.2, "#ffffff", "left", 23);
  const x0 = 26;
  const x1 = W - 1.5;
  const gap = 0.45;
  const each = (x1 - x0 - gap * (b.max - 1)) / b.max;
  const blink = Math.floor(v.clock / 160) % 2 === 0;
  for (let k = 0; k < b.max; k++) {
    const x = x0 + k * (each + gap);
    const lit = k < b.hp;
    roundRect(ctx, x, 1.15, each, 2.4, 0.35);
    if (!lit) ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    else if (b.stun && blink) ctx.fillStyle = "#ffffff";
    else if (b.hp === 1 && blink) ctx.fillStyle = "#ffd84a";
    else ctx.fillStyle = b.hp * 2 > b.max ? "#ff4d4d" : "#ff8a1f";
    ctx.fill();
    ctx.strokeStyle = EDGE;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    if (lit) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(x + 0.3, 1.45, each - 0.6, 0.45);
    }
  }
}

/* -------------------------------------------------------- title screens */

const SUNSET = Object.freeze([[0, "#fff7a8"], [0.46, "#ffd21f"], [0.54, "#ff7a1a"], [1, "#ff3d7f"]]);
const CHROME = Object.freeze([[0, "#f2fdff"], [0.46, "#7fe3ff"], [0.54, "#2a6fd6"], [1, "#b08cff"]]);

// One word of the logo, its middle at (x, y): slanted, heavy letters with a
// hard drop shadow, a block of depth stepping down and right, a dark edge,
// a face in a banded gradient (the flat `flat` where a context has none)
// and a thin shine along its top.
function chunky(ctx, text, x, y, size, max, stops, flat, depth) {
  ctx.font = `italic 900 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const s = size / 10;
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  ctx.fillText(text, x + 1.3 * s, y + 1.5 * s, max);
  ctx.strokeStyle = depth;
  ctx.fillStyle = depth;
  ctx.lineWidth = size * 0.14;
  for (let k = 4; k >= 1; k--) {
    ctx.strokeText(text, x + k * 0.2 * s, y + k * 0.24 * s, max);
    ctx.fillText(text, x + k * 0.2 * s, y + k * 0.24 * s, max);
  }
  ctx.strokeStyle = "#1a0b2e";
  ctx.lineWidth = size * 0.17;
  ctx.strokeText(text, x, y, max);
  const grad = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, y - size * 0.42, 0, y + size * 0.42) : null;
  if (grad && typeof grad.addColorStop === "function") {
    for (const [at, color] of stops) grad.addColorStop(at, color);
    ctx.fillStyle = grad;
  } else ctx.fillStyle = flat;
  ctx.fillText(text, x, y, max);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  ctx.lineWidth = size * 0.012;
  ctx.strokeText(text, x - 0.04 * s, y - 0.06 * s, max);
}

const RANK_COLORS = Object.freeze({ S: "#ffd21f", A: "#7ad151", B: "#7fe3ff", C: "#c9ccd2" });

// The start and end screens' top: the arcade logo, BOUNCE over ROAD, with
// three racing stripes under it and a glint on it; then "PRESS SPACE",
// blinking, on the start screen, or "GAME OVER" and a badge for each
// stage's rank (the last fifteen) on the end screen. All of it sits above
// the tally strip and the big score at the foot of the field.
export function drawTitle(ctx, v, label) {
  const W = v.g.FIELD_W;
  const over = !!v.lost;
  const top = over ? 2.6 : 8;
  const s1 = over ? 7.4 : 11.5;
  const s2 = over ? 8.8 : 14;
  const y1 = top + s1 * 0.55;
  const y2 = y1 + s1 * 0.5 + s2 * 0.52;
  chunky(ctx, "BOUNCE", W / 2 - s1 * 0.12, y1, s1, W - 9, SUNSET, "#ffd21f", "#8a1f6b");
  chunky(ctx, "ROAD", W / 2 + s2 * 0.1, y2, s2, W - 9, CHROME, "#7fe3ff", "#1f2f8a");
  // The stripes, on a dark strip so they read on any yard.
  const ys = y2 + s2 * 0.62;
  const half = over ? 15 : 23;
  const k = over ? 0.65 : 1;
  ctx.fillStyle = EDGE;
  ctx.fillRect(W / 2 - half - 0.4, ys - 0.3 * k, half * 2 + 0.8, 3.1 * k);
  for (const [dy, tall, color, inset] of [[0, 0.9, "#ff3df0", 0], [1.15, 0.7, "#ffd21f", 2.5], [2.05, 0.45, "#38e8ff", 5]]) {
    ctx.fillStyle = color;
    ctx.fillRect(W / 2 - half + inset, ys + dy * k, (half - inset) * 2, tall * k);
  }
  // A glint off the first letter.
  const gl = 0.75 + 0.25 * Math.sin(v.clock / 300);
  star(ctx, W / 2 - s1 * 2.15, y1 - s1 * 0.4, s1 * 0.2 * gl, s1 * 0.045, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (!over) {
    if (Math.floor(v.clock / 450) % 2 === 0) label(ctx, "PRESS SPACE", W / 2, ys + 9, 3.4, "#ffd21f", "center", W - 6);
    return;
  }
  label(ctx, "GAME OVER", W / 2, ys + 7.2, 6.4, "#ff4d4d", "center", W - 6);
  const ranks = Array.isArray(v.ranks) ? v.ranks.slice(-15) : [];
  const yr = ys + 14.2;
  if (ranks.length) {
    label(ctx, "STAGE RANKS", W / 2, yr, 1.8, "#ffffff", "center", W - 6);
    const size = 3.5;
    const step = 4.3;
    const x0 = W / 2 - ((ranks.length - 1) * step) / 2;
    ranks.forEach((rank, i) => {
      const color = RANK_COLORS[rank] || RANK_COLORS.C;
      const x = x0 + i * step;
      roundRect(ctx, x - size / 2, yr + 1.9, size, size, 0.7);
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 0.3;
      ctx.stroke();
      label(ctx, String(rank), x, yr + 1.9 + size / 2 + 0.1, 2.4, color, "center", size - 0.6);
    });
  }
  label(ctx, "PRESS SPACE TO PLAY AGAIN", W / 2, yr + (ranks.length ? 9.2 : 2.5), 2.3, "#ffd21f", "center", W - 6);
}

// Scanlines over the field, for the look of an old arcade tube: one faint
// dark line every few pixels, set on whole device pixels where the context
// can tell its transform (so they stay crisp), in one path and one fill.
export function drawScanlines(ctx, v) {
  const { g } = v;
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  const px = m && m.d > 0 && Number.isFinite(m.f) ? m.d : 0;
  ctx.fillStyle = "rgba(0, 0, 0, 0.11)";
  ctx.beginPath();
  if (px) {
    const pitch = Math.max(3, Math.round(px / 3));
    const thick = Math.max(1, Math.round(pitch / 3));
    for (let y = Math.ceil(m.f / pitch) * pitch; (y - m.f) / px < g.FIELD_H; y += pitch) ctx.rect(0, (y - m.f) / px, g.FIELD_W, thick / px);
  } else for (let y = 0; y < g.FIELD_H; y += 0.4) ctx.rect(0, y, g.FIELD_W, 0.13);
  ctx.fill();
}
