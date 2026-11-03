// Plan2Code Web Console - Ghoul Rush's dark ride, its drawing helpers: the bound 2D context and the short fill, stroke and shape calls the ride's art is written in.
//
// The ride's art (ghoul-ride-draw-*.js) is a port of the prototype's canvas
// script (prototypes/ghoul-rush-ride/gallery.html), which drew through a global
// context `c` and a few one-letter helpers. This file keeps that shape: `c` is a
// live binding set by `bindCtx(ctx)` at the start of every frame, so the ported
// code reads the same. Field units (96 by 54), y counted down from the top. The
// calls the prototype made on a context that an older browser or a test's fake
// context might lack (roundRect, ellipse, setLineDash, gradients) go through
// guards here, so the art draws on any context that has the basics. Holds:
//
// - c, bindCtx          the context in use
// - MODE, setMode       "ride", "dead" (frozen under the crash fade), "end" (the cleared card)
//                       or "title": the prototype's G.mode, as the art reads it
// - F, S, rr, circ, ell, ln, poly, rect, star, txt, grad, glow, dash   the helpers
// - lgrad, rgrad        gradients that survive a context with none
// - tile, vgrad, circle, ellipse2, BLOOD   the scenery's own small helpers

import { TAU, W } from "./ghoul-ride-core.js";

export let c = null;
export const bindCtx = (ctx) => {
  c = ctx;
};

export let MODE = "ride";
export const setMode = (m) => {
  MODE = m;
};

export const BLOOD = ["#c4121c", "#9c0b14", "#e8283a", "#7a0910"];

export const F = (col) => {
  c.fillStyle = col;
};
export const S = (col, w) => {
  c.strokeStyle = col;
  c.lineWidth = w;
  c.lineCap = "round";
  c.lineJoin = "round";
};
export const rr = (x, y, w, h, r) => {
  c.beginPath();
  if (typeof c.roundRect === "function") c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
};
export const circ = (x, y, r) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
};
export const ell = (x, y, rx, ry, rot = 0) => {
  c.beginPath();
  rx = Math.max(0.01, rx);
  ry = Math.max(0.01, ry);
  if (typeof c.ellipse === "function") c.ellipse(x, y, rx, ry, rot, 0, TAU);
  else {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(rx, ry);
    c.arc(0, 0, 1, 0, TAU);
    c.restore();
  }
};
export const ln = (a, b, x, y) => {
  c.beginPath();
  c.moveTo(a, b);
  c.lineTo(x, y);
  c.stroke();
};
export const poly = (pts) => {
  c.beginPath();
  pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])));
  c.closePath();
};
export const rect = (x, y, w, h) => c.fillRect(x, y, w, h);
export function star(x, y, ro, ri, spin = 0) {
  c.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = spin - Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? ri : ro;
    c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  c.closePath();
}
export function txt(s, x, y, size, col, align = "center", font = "Impact, 'Arial Black', sans-serif") {
  c.font = `${size}px ${font}`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.fillStyle = col;
  c.fillText(s, x, y);
}
// A gradient object that takes color stops, or a stand-in when the context makes none.
const NO_GRAD = Object.freeze({ addColorStop() {} });
export const lgrad = (x0, y0, x1, y1) => (typeof c.createLinearGradient === "function" && c.createLinearGradient(x0, y0, x1, y1)) || NO_GRAD;
export const rgrad = (x0, y0, r0, x1, y1, r1) => (typeof c.createRadialGradient === "function" && c.createRadialGradient(x0, y0, r0, x1, y1, r1)) || NO_GRAD;
export function grad(x0, y0, x1, y1, stops) {
  const g = lgrad(x0, y0, x1, y1);
  stops.forEach((s) => g.addColorStop(s[0], s[1]));
  return g;
}
export function glow(x, y, r, col, a = 1) {
  const g = rgrad(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, "rgba(0,0,0,0)");
  c.globalAlpha *= a;
  c.fillStyle = g;
  c.fillRect(x - r, y - r, r * 2, r * 2);
  c.globalAlpha /= a || 1;
}
export const dash = (pattern) => {
  if (typeof c.setLineDash === "function") c.setLineDash(pattern);
};

// fn(x, i) for each tile of a repeating strip that scrolls by `scroll`.
export function tile(scroll, period, fn) {
  const i0 = Math.floor(scroll / period);
  for (let i = i0 - 1; i < i0 + Math.ceil(W / period) + 2; i++) fn(i * period - scroll, i);
}
export function vgrad(top, bot) {
  c.fillStyle = grad(0, 0, 0, 50, [[0, top], [1, bot]]);
  rect(0, 0, W, 50);
}
export function circle(x, y, r) {
  circ(x, y, r);
  c.fill();
}
export function ellipse2(x, y, rx, ry) {
  ell(x, y, rx, ry);
  c.fill();
}
