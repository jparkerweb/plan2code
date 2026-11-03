// Plan2Code Web Console - Ghoul Rush's Holy Roller, its world: the nave seen from behind the pew, in pseudo-3D. Drawn by ghoul-pew-draw.js's `field`; reads the rules in ghoul-pew.js, draws no random number (every scatter is a hash).
//
// THE PROJECTION (reusable for any "run into the screen" view, field units, the field being 96 wide and 54 high):
// a point is (l, dz, h): `l` across the aisle in lanes (0 the middle lane, +1 the right one), `dz` how far down the
// aisle ahead of the pew (negative once passed), `h` its height. With scale = NEAR / (NEAR + dz) it lands at
//   x = VPX + (l - camL) * LW * scale,   y = HOR + (GY0 - HOR) * scale - h * HS * scale
// so the horizon (dz infinite) is the vanishing point (VPX, HOR) and the pew (dz 0) stands at scale 1 on the floor line GY0.
// The camera slides a little with the pew's lane (camL). The scene goes far to near in CELL-deep cells anchored to the world
// (so they scroll), each with its floor tiles, wall, window and its light, pews and pillar with a rib over the aisle, then the
// things standing in the cell; fog is the cell's alpha going to nothing over FADE_D. The art of the things is in `thing`.

import { BUMP_MS, KINDS, LOW_Y, V0, V_MAX, cuesOf, gargRise } from "./ghoul-pew.js";

const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const VPX = 48;
export const HOR = 19;
export const GY0 = 46;
export const NEAR = 26;
export const LW = 14.5;
export const HS = 2.1;
export const CELL = 16;
export const TILE = 8;
export const SEE = 290;
export const FADE_D = 250;
export const BPM = 132;
export const BEAT_MS = 60000 / BPM;
export const ANSWER_COLORS = Object.freeze({ JUMP: "#5fe3ff", SLIDE: "#ffb02e", SWITCH: "#ff5a6a", SHOOT: "#ff8a4a" });
const GLASS = Object.freeze(["216,50,60", "60,111,224", "240,180,58", "63,181,106", "166,90,216"]);
const WALL_L = 5.8;

// A number in 0..1 from two integers, the same every time (no random draws).
export const rnd = (a, b = 0) => {
  let h = Math.imul((a | 0) + 0x9e37, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
const grad = (make, stops) => {
  const g = make ? make() : null;
  if (!g || typeof g.addColorStop !== "function") return stops[stops.length >> 1][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
const vgrad = (c, y0, y1, stops) => grad(c.createLinearGradient && (() => c.createLinearGradient(0, y0, 0, y1)), stops);
const rgrad = (c, x, y, r, stops) => grad(c.createRadialGradient && (() => c.createRadialGradient(x, y, 0, x, y, r)), stops);
const quad = (c, a, b, e, f) => {
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.lineTo(e[0], e[1]);
  c.lineTo(f[0], f[1]);
  c.closePath();
};
const seg = (c, a, b) => {
  c.beginPath();
  c.moveTo(a[0], a[1]);
  c.lineTo(b[0], b[1]);
  c.stroke();
};
const disc = (c, x, y, r) => {
  c.beginPath();
  c.arc(x, y, Math.max(0.01, r), 0, TAU);
  c.fill();
};

// The beat: 1 on the organ's stroke, falling away.
export const pulse = (clock) => Math.exp(-((clock % BEAT_MS) / BEAT_MS) * 4.5);
// How much of a thing `dz` ahead the fog leaves.
export const fog = (dz) => (dz < 120 ? 1 : clamp(1 - (dz - 120) / (FADE_D - 120), 0, 1));

export function worldArt(d) {
  const { label, circle } = d;
  let camL = 0;
  let FW = 96;
  let FH = 54;
  let clock = 0;
  let beat = 0;
  // Where (l, dz, h) lands: [x, y, scale].
  // (The view narrows a little as the ride speeds up: `near` falls from NEAR.)
  let near = NEAR;
  const sc = (dz) => near / (near + Math.max(dz, -near * 0.55));
  const P = (l, dz, h = 0) => {
    const s = sc(dz);
    return [VPX + (l - camL) * LW * s, HOR + (GY0 - HOR) * s - h * HS * s, s];
  };
  // A box from lateral l0..l1, near depth z0 to far z1, height h0..h1: the faces the camera sees.
  function box(ctx, l0, l1, z0, z1, h0, h1, c) {
    const eye = (GY0 - HOR) / HS;
    const n = [P(l0, z0, h0), P(l1, z0, h0), P(l1, z0, h1), P(l0, z0, h1)];
    if (c.side) {
      const left = l1 <= camL;
      const l = left ? l1 : l0;
      if (left || l0 >= camL) {
        quad(ctx, P(l, z0, h0), P(l, z1, h0), P(l, z1, h1), P(l, z0, h1));
        ctx.fillStyle = c.side;
        ctx.fill();
      }
    }
    if (c.top && h1 < eye) {
      quad(ctx, P(l0, z0, h1), P(l1, z0, h1), P(l1, z1, h1), P(l0, z1, h1));
      ctx.fillStyle = c.top;
      ctx.fill();
    }
    quad(ctx, n[0], n[1], n[2], n[3]);
    ctx.fillStyle = c.front;
    ctx.fill();
    return n;
  }
  // A wall-plane (or floor) quad between two corners at depths za..zb.
  const wall = (ctx, l, za, zb, h0, h1, fill) => {
    quad(ctx, P(l, za, h0), P(l, zb, h0), P(l, zb, h1), P(l, za, h1));
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const floor = (ctx, l0, l1, za, zb, fill) => {
    quad(ctx, P(l0, za, 0), P(l1, za, 0), P(l1, zb, 0), P(l0, zb, 0));
    ctx.fillStyle = fill;
    ctx.fill();
  };
  const glow = (ctx, x, y, r, rgb, a) => {
    if (a <= 0.01 || r < 0.2) return;
    ctx.globalAlpha = a;
    ctx.fillStyle = rgrad(ctx, x, y, r, [[0, `rgba(${rgb},0.9)`], [0.4, `rgba(${rgb},0.35)`], [1, `rgba(${rgb},0)`]]);
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  /* ------------------------------------------------------------ the room */

  // The vault, the far altar's glow and the floor's base.
  function backdrop(ctx) {
    ctx.fillStyle = vgrad(ctx, 0, HOR + 8, [[0, "#070a18"], [0.7, "#141a38"], [1, "#2a3052"]]);
    ctx.fillRect(0, 0, FW, FH);
    ctx.fillStyle = vgrad(ctx, HOR, FH, [[0, "#242a4a"], [0.5, "#161a30"], [1, "#0c0e1c"]]);
    ctx.fillRect(0, HOR, FW, FH - HOR);
    // The altar at the end of the nave: a rose window and its warm blaze.
    const a = 0.75 + 0.25 * beat;
    glow(ctx, VPX, HOR - 1, 34, "255,196,120", 0.55 * a);
    glow(ctx, VPX, HOR - 1, 14, "255,236,190", 0.9 * a);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1b1a2c";
    ctx.fillRect(VPX - 3, HOR - 3.4, 6, 3.4);
    ctx.fillStyle = "#ffe7a8";
    ctx.fillRect(VPX - 0.25, HOR - 3.4, 0.5, 2.2);
    ctx.fillRect(VPX - 1, HOR - 2.7, 2, 0.4);
    ctx.fillStyle = `rgba(255,214,130,${0.7 + 0.3 * beat})`;
    for (const k of [-2.2, -1.2, 1.2, 2.2]) disc(ctx, VPX + k, HOR - 3.8, 0.35);
  }

  function cell(ctx, you, c, j) {
    const z0 = j * CELL - you.x;
    const f = fog(z0);
    if (f <= 0.02) return;
    ctx.globalAlpha = f;
    const warm = "255,190,110";
    // Floor: two tiles, flagstone then carpet.
    for (let t = 0; t < 2; t++) {
      const za = z0 + t * TILE;
      const zb = za + TILE;
      const alt = (j * 2 + t) % 2;
      floor(ctx, -WALL_L, WALL_L, za, zb, alt ? "#2b3150" : "#252a46");
      floor(ctx, -2.65, 2.65, za, zb, alt ? "#3a4166" : "#333a5e");
      floor(ctx, -1.5, 1.5, za, zb, alt ? "#6b1c2e" : "#5c1727");
      // Tile joints and the carpet's gold edge and lane stitching.
      ctx.strokeStyle = "rgba(8,10,24,0.55)";
      ctx.lineWidth = 0.22 * sc(za);
      seg(ctx, P(-2.65, za), P(2.65, za));
    }
    ctx.strokeStyle = "rgba(231,180,76,0.75)";
    ctx.lineWidth = Math.max(0.12, 0.34 * sc(z0));
    seg(ctx, P(-1.5, z0), P(-1.5, z0 + CELL));
    seg(ctx, P(1.5, z0), P(1.5, z0 + CELL));
    ctx.strokeStyle = "rgba(231,180,76,0.32)";
    ctx.lineWidth = Math.max(0.1, 0.22 * sc(z0));
    for (const l of [-0.5, 0.5]) {
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const a = P(l, z0 + k * 4);
        const b = P(l, z0 + k * 4 + 2.6);
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
      }
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      const wl = side * WALL_L;
      // The wall, its wainscot and cornice, and the clerestory's lancet window with its light.
      wall(ctx, wl, z0, z0 + CELL, 0, 44, side < 0 ? "#222844" : "#262c4a");
      wall(ctx, wl, z0, z0 + CELL, 0, 5.5, "#161a30");
      box(ctx, side < 0 ? -WALL_L : WALL_L - 0.55, side < 0 ? -WALL_L + 0.55 : WALL_L, z0, z0 + CELL, 13.2, 14.4, { front: "#59629a", side: "#6f7ab0", top: "#8a96c4" });
      // The slim shaft that carries a rib up the wall.
      box(ctx, side < 0 ? -WALL_L : WALL_L - 0.5, side < 0 ? -WALL_L + 0.5 : WALL_L, z0, z0 + 2, 14.4, 32, { front: "#4b5480", side: "#6a76a6" });
      const gi = Math.abs(j * 3 + (side > 0 ? 1 : 0)) % GLASS.length;
      const rgb = GLASS[(gi + (side > 0 ? 2 : 0)) % GLASS.length];
      const lit = 0.6 + 0.35 * beat;
      const w = [
        [z0 + 4, 16.5],
        [z0 + 12, 16.5],
        [z0 + 12, 27],
        [z0 + 8, 32],
        [z0 + 4, 27],
      ];
      ctx.beginPath();
      w.forEach(([z, h], i) => {
        const p = P(wl, z, h);
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = "#0d1020";
      ctx.fill();
      ctx.fillStyle = `rgba(${rgb},${lit})`;
      ctx.fill();
      ctx.strokeStyle = "rgba(10,12,28,0.85)";
      ctx.lineWidth = Math.max(0.08, 0.26 * sc(z0 + 8));
      ctx.stroke();
      seg(ctx, P(wl, z0 + 8, 16.5), P(wl, z0 + 8, 32));
      seg(ctx, P(wl, z0 + 4, 22), P(wl, z0 + 12, 22));
      // God rays: a slanted shaft from the window to a patch on the floor, in the glass's color.
      ctx.globalCompositeOperation = "lighter";
      const patch = side * 0.8;
      quad(ctx, P(wl, z0 + 4, 16.5), P(wl, z0 + 12, 16.5), P(patch, z0 + 14, 0), P(patch + side * 2.1, z0 + 5, 0));
      ctx.fillStyle = `rgba(${rgb},${0.05 + 0.04 * beat})`;
      ctx.fill();
      quad(ctx, P(patch + side * 2.1, z0 + 5, 0), P(patch, z0 + 14, 0), P(patch - side * 0.9, z0 + 15, 0), P(patch + side * 1.3, z0 + 6, 0));
      ctx.fillStyle = `rgba(${rgb},${0.1 + 0.07 * beat})`;
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      // The pews along the aisle: seat and back.
      const l0 = side < 0 ? -4.2 : 3.1;
      const l1 = side < 0 ? -3.1 : 4.2;
      for (let k = 0; k < 2; k++) {
        const za = z0 + 8 * k + 0.8;
        const tint = (j + k) % 2;
        box(ctx, l0, l1, za, za + 6.4, 0, 1.7, { front: tint ? "#4a2c1a" : "#42261a", side: tint ? "#6a4128" : "#5e3a24", top: "#8a5a36" });
        const b0 = side < 0 ? l0 : l1 - 0.35;
        const b1 = side < 0 ? l0 + 0.35 : l1;
        box(ctx, b0, b1, za, za + 6.4, 1.7, 4.2, { front: "#3a2114", side: "#5a361f", top: "#7a4c2c" });
      }
      // The pillar, with a sconce on it, and the rib across the vault.
      const pl = side * 4.75;
      const stone = { front: "#4b5480", side: "#6a76a6", top: "#7e8ab8" };
      const cap = { front: "#59629a", side: "#77839f", top: "#8a96bc" };
      box(ctx, pl - 0.55, pl + 0.55, z0, z0 + 2.4, 0, 13, stone);
      box(ctx, pl - 0.8, pl + 0.8, z0 - 0.2, z0 + 2.6, 0, 1.6, cap);
      box(ctx, pl - 0.8, pl + 0.8, z0 - 0.2, z0 + 2.6, 11.6, 13.2, cap);
      const sp = P(pl - side * 0.6, z0 + 0.3, 8);
      glow(ctx, sp[0], sp[1], 9 * sp[2] + 0.5, warm, 0.5 * f * (0.8 + 0.2 * beat));
      ctx.globalAlpha = f;
      ctx.fillStyle = "#ffd890";
      disc(ctx, sp[0], sp[1], 0.4 * sp[2] + 0.1);
      if (side > 0) {
        ctx.strokeStyle = "#59629a";
        ctx.lineWidth = Math.max(0.2, 1.0 * sc(z0));
        const a = P(-5.4, z0 + 1, 32);
        const b = P(5.4, z0 + 1, 32);
        const m = P(0, z0 + 1, 45);
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.quadraticCurveTo(m[0], m[1] - 2 * m[2] * HS, b[0], b[1]);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------- the things */

  // A telegraph glyph over a thing: a colored mark, with its word on the first few.
  function glyph(ctx, kind, answer, l, dz, h, words, extra) {
    if (dz > 130 || dz < -6) return;
    const p = P(l, dz, h);
    const s = p[2];
    const col = ANSWER_COLORS[answer];
    const a = clamp((130 - dz) / 50, 0, 1) * (dz < 0 ? clamp(1 + dz / 6, 0, 1) : 1) * (0.72 + 0.28 * Math.sin(clock / 130));
    if (a < 0.03) return;
    ctx.globalAlpha = a;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(0.3, 0.7 * s);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const r = Math.max(0.7, 2.3 * s);
    const x = p[0];
    const y = p[1];
    if (answer === "JUMP") {
      ctx.beginPath();
      ctx.moveTo(x - r, y + r * 0.5);
      ctx.lineTo(x, y - r * 0.6);
      ctx.lineTo(x + r, y + r * 0.5);
      ctx.moveTo(x - r, y + r * 1.5);
      ctx.lineTo(x, y + r * 0.4);
      ctx.lineTo(x + r, y + r * 1.5);
      ctx.stroke();
    } else if (answer === "SLIDE") {
      ctx.beginPath();
      ctx.moveTo(x - r, y - r * 0.5);
      ctx.lineTo(x, y + r * 0.6);
      ctx.lineTo(x + r, y - r * 0.5);
      ctx.moveTo(x - r, y - r * 1.5);
      ctx.lineTo(x, y - r * 0.4);
      ctx.lineTo(x + r, y - r * 1.5);
      ctx.stroke();
    } else if (answer === "SHOOT") {
      circle(ctx, x, y, r);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 1.5, y);
      ctx.lineTo(x + r * 1.5, y);
      ctx.moveTo(x, y - r * 1.5);
      ctx.lineTo(x, y + r * 1.5);
      ctx.stroke();
    } else {
      // SWITCH: an arrow toward each free lane beside it.
      for (const dir of extra) {
        ctx.beginPath();
        ctx.moveTo(x + dir * r * 0.4, y - r * 0.9);
        ctx.lineTo(x + dir * r * 1.6, y);
        ctx.lineTo(x + dir * r * 0.4, y + r * 0.9);
        ctx.moveTo(x - dir * r * 0.6, y);
        ctx.lineTo(x + dir * r * 1.6, y);
        ctx.stroke();
      }
    }
    if (words && s > 0.2) label(ctx, answer === "SWITCH" ? "MOVE" : answer, x, y - r * 2.1, clamp(2.8 * s, 1.2, 2.6), col, "center", 20);
    ctx.globalAlpha = 1;
  }

  const trim = (ctx, pts, col, w) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.stroke();
  };

  // Red and white hazard stripes across a block's foot: the "go round me" mark.
  function hazard(ctx, l0, l1, z, h) {
    const n = 6;
    for (let k = 0; k < n; k++) {
      const a = l0 + ((l1 - l0) * k) / n;
      const b = l0 + ((l1 - l0) * (k + 1)) / n;
      const lo = P(a, z, 0.2);
      const hi = P(b, z, h);
      ctx.fillStyle = k % 2 ? "#e8e0d0" : "#d6303c";
      ctx.beginPath();
      ctx.moveTo(lo[0], lo[1]);
      ctx.lineTo(P(b, z, 0.2)[0], P(b, z, 0.2)[1]);
      ctx.lineTo(hi[0], hi[1]);
      ctx.lineTo(P(a, z, h)[0], P(a, z, h)[1]);
      ctx.closePath();
      ctx.fill();
    }
  }

  function thing(ctx, you, c, q, openSides, words) {
    const k = KINDS[q.kind];
    const z0 = q.x - you.x;
    const z1 = q.end - you.x;
    const f = fog(z0);
    if (f <= 0.02 || z1 < -9) return;
    const l = q.lane - 1;
    ctx.globalAlpha = f;
    const col = ANSWER_COLORS[k.answer];
    const wide = 0.42;
    let top = 0;
    // The mark on the floor ahead of it, in its answer's color.
    if (k.answer !== "SHOOT" || q.kind === "garg") {
      ctx.globalAlpha = f * 0.3;
      floor(ctx, l - 0.47, l + 0.47, z0 - 5, z0 - 3.2, col);
      ctx.globalAlpha = f;
    }
    switch (q.kind) {
      case "pillar": {
        box(ctx, l - wide, l + wide, z0, z1, 0, 9, { front: "#7b86b4", side: "#59638f", top: "#a0aad0" });
        hazard(ctx, l - wide, l + wide, z0, 1.6);
        ctx.strokeStyle = "rgba(30,36,70,0.5)";
        ctx.lineWidth = Math.max(0.1, 0.2 * sc(z0));
        for (const o of [-0.25, 0, 0.25]) seg(ctx, P(l + o, z0, 1.7), P(l + o, z0, 8.6));
        top = 11;
        break;
      }
      case "confessional": {
        box(ctx, l - wide, l + wide, z0, z1, 0, 8.5, { front: "#4a2a1a", side: "#6a3c26", top: "#8a5636" });
        const a = P(l - 0.3, z0, 6.4);
        const b = P(l + 0.3, z0, 3.4);
        ctx.fillStyle = "#14090a";
        ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        ctx.strokeStyle = "#a07a46";
        ctx.lineWidth = Math.max(0.1, 0.22 * sc(z0));
        ctx.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
        hazard(ctx, l - wide, l + wide, z0, 1.6);
        top = 10.5;
        break;
      }
      case "pewx": {
        box(ctx, l - wide - 0.03, l + wide + 0.03, z0, z1, 0, 2.6, { front: "#4a2c1a", side: "#6a4128", top: "#8a5a36" });
        box(ctx, l - wide - 0.03, l + wide + 0.03, z0 + 0.2, z1, 2.6, 5.6, { front: "#3a2114", side: "#5a361f", top: "#7a4c2c" });
        hazard(ctx, l - wide, l + wide, z0, 1.4);
        top = 7.5;
        break;
      }
      case "kneeler": {
        box(ctx, l - wide, l + wide, z0, z1, 0, 1.3, { front: "#3a2114", side: "#5a361f", top: "#7a4c2c" });
        box(ctx, l - wide + 0.04, l + wide - 0.04, z0, z1, 1.3, k.h, { front: "#a8283c", side: "#7c1a2c", top: "#d04a5c" });
        trim(ctx, [P(l - wide, z0, k.h), P(l + wide, z0, k.h)], col, Math.max(0.2, 0.55 * sc(z0)));
        top = k.h + 2.4;
        break;
      }
      case "stand": {
        box(ctx, l - 0.28, l + 0.28, z0, z1, 0, 0.9, { front: "#2a2a38", side: "#3c3c50", top: "#58586e" });
        ctx.strokeStyle = "#2c2c3c";
        ctx.lineWidth = Math.max(0.2, 0.5 * sc(z0));
        seg(ctx, P(l, z0 + 1, 0.8), P(l, z0 + 1, 3));
        box(ctx, l - 0.4, l + 0.4, z0, z1, 2.8, 3.4, { front: "#6a6a82", side: "#4a4a60", top: "#9a9ab4" });
        for (const o of [-0.26, 0, 0.26]) {
          const p = P(l + o, z0 + 1, 4.2);
          glow(ctx, p[0], p[1], 3.8 * p[2] + 0.3, "255,190,100", 0.7 * f);
          ctx.globalAlpha = f;
          ctx.fillStyle = "#fff0b8";
          ctx.beginPath();
          ctx.ellipse(p[0], p[1], Math.max(0.1, 0.4 * p[2]), Math.max(0.12, 0.8 * p[2]), 0, 0, TAU);
          ctx.fill();
          ctx.fillStyle = "#f4efe0";
          const w = P(l + o, z0 + 1, 3.4);
          ctx.fillRect(w[0] - 0.25 * w[2], w[1], 0.5 * w[2], Math.max(0.2, p[1] - w[1]) * -1);
        }
        trim(ctx, [P(l - 0.4, z0, 3.4), P(l + 0.4, z0, 3.4)], col, Math.max(0.2, 0.55 * sc(z0)));
        top = 6.4;
        break;
      }
      case "cracks":
      case "hatch": {
        const hatch = q.kind === "hatch";
        floor(ctx, l - 0.46, l + 0.46, z0, z1, hatch ? "#05060c" : "#4a5074");
        if (hatch) {
          box(ctx, l - 0.46, l + 0.46, z1 - 0.7, z1, 0, 2.3, { front: "#6a7090", side: "#4a5074", top: "#8a90b0" });
          ctx.globalCompositeOperation = "lighter";
          floor(ctx, l - 0.3, l + 0.3, z0 + 1, z1 - 1, "rgba(120,255,160,0.1)");
          ctx.globalCompositeOperation = "source-over";
        } else {
          ctx.strokeStyle = "#12142a";
          ctx.lineWidth = Math.max(0.12, 0.34 * sc(z0));
          for (let m = 0; m < 3; m++) {
            ctx.beginPath();
            for (let n = 0; n <= 6; n++) {
              const pp = P(l - 0.4 + m * 0.4 + (n % 2 ? 0.1 : -0.1), z0 + (n * (z1 - z0)) / 6, 0.05);
              if (n) ctx.lineTo(pp[0], pp[1]);
              else ctx.moveTo(pp[0], pp[1]);
            }
            ctx.stroke();
          }
          box(ctx, l - 0.4, l - 0.2, z0 + 1.2, z0 + 2.4, 0, 0.8, { front: "#7a82a8", side: "#5a628a", top: "#9aa2c8" });
          box(ctx, l + 0.1, l + 0.3, z1 - 2.6, z1 - 1.4, 0, 0.7, { front: "#7a82a8", side: "#5a628a", top: "#9aa2c8" });
        }
        trim(ctx, [P(l - 0.46, z0, 0), P(l + 0.46, z0, 0)], col, Math.max(0.25, 0.7 * sc(z0)));
        trim(ctx, [P(l - 0.46, z1, 0), P(l + 0.46, z1, 0)], col, Math.max(0.2, 0.5 * sc(z1)));
        top = 3.4;
        break;
      }
      case "censer": {
        const sway = Math.sin(clock / 380 + q.i * 1.7) * 0.22;
        const hang = P(l, z0 + 1, 34);
        const ball = P(l + sway, z0 + 1, LOW_Y + 1.3);
        ctx.strokeStyle = "#8a7a52";
        ctx.lineWidth = Math.max(0.15, 0.4 * ball[2]);
        seg(ctx, hang, ball);
        ctx.fillStyle = "#c79a3a";
        disc(ctx, ball[0], ball[1], 1.6 * HS * ball[2] * 0.5 + 0.2);
        ctx.fillStyle = "#6a4a14";
        disc(ctx, ball[0], ball[1] + 0.2 * ball[2], 0.7 * HS * ball[2] * 0.5);
        ctx.globalAlpha = f * 0.35;
        ctx.fillStyle = "#cfd2e6";
        for (let m = 0; m < 3; m++) disc(ctx, ball[0] + Math.sin(clock / 260 + m * 2) * 0.6 * ball[2], ball[1] - (1.6 + m * 1.4) * ball[2] * HS * 0.5, (0.5 + m * 0.3) * ball[2]);
        ctx.globalAlpha = f;
        trim(ctx, [P(l - 0.4, z0, LOW_Y), P(l + 0.4, z0, LOW_Y)], col, Math.max(0.2, 0.55 * sc(z0)));
        top = 8;
        break;
      }
      case "banner": {
        const a = P(l - 0.44, z0, 15);
        const b = P(l + 0.44, z0, 15);
        const lo0 = P(l - 0.44, z0, LOW_Y);
        const lo1 = P(l + 0.44, z0, LOW_Y);
        const tail = P(l, z0, LOW_Y - 0.9);
        ctx.fillStyle = "#5c1a6a";
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.lineTo(lo1[0], lo1[1]);
        ctx.lineTo(tail[0], tail[1]);
        ctx.lineTo(lo0[0], lo0[1]);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#e0b04a";
        ctx.lineWidth = Math.max(0.12, 0.3 * sc(z0));
        ctx.stroke();
        const cx = P(l, z0, 8.5);
        ctx.strokeStyle = "#f0d078";
        ctx.lineWidth = Math.max(0.2, 0.6 * cx[2]);
        seg(ctx, P(l, z0, 11), P(l, z0, 5.6));
        seg(ctx, P(l - 0.22, z0, 9.2), P(l + 0.22, z0, 9.2));
        trim(ctx, [lo0, tail, lo1], col, Math.max(0.2, 0.6 * sc(z0)));
        top = 17;
        break;
      }
      case "beam": {
        for (const o of [-0.4, 0.4]) {
          ctx.strokeStyle = "#8a7a52";
          ctx.lineWidth = Math.max(0.12, 0.3 * sc(z0));
          seg(ctx, P(l + o, z0 + 1, 5.2), P(l + o, z0 + 1, 34));
        }
        box(ctx, l - 0.5, l + 0.5, z0, z1, LOW_Y, 5.2, { front: "#6a4128", side: "#4a2c1a", top: "#8a5a36" });
        trim(ctx, [P(l - 0.5, z0, LOW_Y), P(l + 0.5, z0, LOW_Y)], col, Math.max(0.25, 0.7 * sc(z0)));
        top = 8;
        break;
      }
      case "garg":
        gargoyle(ctx, you, c, q, z0, f, col);
        top = ["stun", "broken"].includes(c.gargs[q.i].state) ? 0 : (c.gargs[q.i].state === "perch" || c.gargs[q.i].state === "warn" ? 17 : 11);
        break;
      case "bell":
        bell(ctx, c, q, z0, f);
        top = 0;
        break;
      default:
        break;
    }
    // Its glyph, for what to do about it.
    if (top) {
      const free = [];
      if (k.answer === "SWITCH") for (const dir of [-1, 1]) if (q.lane + dir >= 0 && q.lane + dir <= 2 && !openSides.some((o) => o === q.lane + dir)) free.push(dir);
      glyph(ctx, q.kind, k.answer, l, z0 + 1, top, words, free);
    }
    ctx.globalAlpha = 1;
  }

  // A gargoyle: perched in the arch above its lane, shuddering, dropping, standing, dazed or broken.
  function gargoyle(ctx, you, c, q, z0, f, col) {
    const g = c.gargs[q.i];
    const l = q.lane - 1;
    const rise = gargRise(g);
    const shake = g.state === "warn" ? Math.sin(clock / 22) * 0.18 : 0;
    const p = P(l + shake, z0 + 1.5, rise * 1.2 + (g.state === "perch" || g.state === "warn" ? 11 : 0));
    const s = p[2] * HS * 1.4;
    const x = p[0];
    const y = p[1];
    if (g.state === "broken") {
      ctx.fillStyle = "#59638f";
      for (const [ox, oy, r] of [[-0.6, 0, 0.5], [0.4, 0.05, 0.6], [0, -0.3, 0.4]]) disc(ctx, x + ox * s * 1.3, y + oy * s, r * s * 0.8);
      return;
    }
    // The shadow it will fall on.
    if (g.state === "perch" || g.state === "warn" || g.state === "drop") {
      const fl = P(l, z0 + 1.5, 0);
      ctx.globalAlpha = f * (g.state === "perch" ? 0.18 : 0.45);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(fl[0], fl[1], 4.4 * fl[2], 1.3 * fl[2], 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = f;
    }
    const dazed = g.state === "stun";
    ctx.fillStyle = dazed ? "#7a84b0" : "#6f7aa8";
    ctx.strokeStyle = "#232a4a";
    ctx.lineWidth = Math.max(0.12, 0.3 * s);
    // Wings.
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sd * s * 0.9, y - s * 2.6);
      ctx.lineTo(x + sd * s * 3.5, y - s * (dazed ? 2.2 : 4.4));
      ctx.lineTo(x + sd * s * 3.0, y - s * 1.0);
      ctx.lineTo(x + sd * s * 1.0, y - s * 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // Body, head and horns.
    roundish(ctx, x, y - s * 1.6, s * 1.6, s * 2.1);
    ctx.fillStyle = dazed ? "#8a94c0" : "#8490c0";
    disc(ctx, x, y - s * 3.5, s * 1.15);
    ctx.fillStyle = "#59638f";
    for (const sd of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + sd * s * 0.6, y - s * 4.3);
      ctx.lineTo(x + sd * s * 1.1, y - s * 5.6);
      ctx.lineTo(x + sd * s * 1.2, y - s * 4.1);
      ctx.fill();
    }
    const eye = dazed ? "#9ab0ff" : g.state === "perch" ? "#80402c" : "#ff4a30";
    ctx.fillStyle = eye;
    for (const sd of [-1, 1]) disc(ctx, x + sd * s * 0.45, y - s * 3.6, s * 0.22);
    if (!dazed && (g.state === "stand" || g.state === "drop")) {
      glow(ctx, x, y - s * 3.5, 4.5 * s, "255,70,40", 0.45 * f);
      ctx.globalAlpha = f;
      if (g.hp < 2) {
        ctx.strokeStyle = "#10142a";
        ctx.lineWidth = Math.max(0.1, 0.25 * s);
        seg(ctx, [x - s * 0.5, y - s * 2.6], [x + s * 0.3, y - s * 0.9]);
      }
    }
    if (dazed) {
      ctx.fillStyle = "#ffe48a";
      for (let m = 0; m < 3; m++) disc(ctx, x + Math.cos(clock / 200 + m * 2.1) * s * 1.6, y - s * 5.2 + Math.sin(clock / 200 + m * 2.1) * s * 0.4, s * 0.28);
    }
  }
  function roundish(ctx, x, y, rx, ry) {
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(0.05, rx), Math.max(0.05, ry), 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // A bell rope: from the vault down to a tassel, the bell up in the dark; rung, it swings.
  function bell(ctx, c, q, z0, f) {
    const rung = c.bells[q.i];
    const l = q.lane - 1;
    const sw = rung ? Math.sin(clock / 90) * 0.18 : 0;
    const top = P(l, z0, 34);
    const bot = P(l + sw, z0, 5.6);
    ctx.strokeStyle = "#b9a374";
    ctx.lineWidth = Math.max(0.3, 1.0 * bot[2]);
    seg(ctx, top, bot);
    ctx.fillStyle = "#d9b45a";
    disc(ctx, bot[0], bot[1], Math.max(0.4, 0.9 * bot[2]));
    const b = P(l + sw * 2, z0, 14);
    ctx.fillStyle = rung ? "#ffe9a0" : "#c79a3a";
    ctx.beginPath();
    ctx.moveTo(b[0] - 1.5 * b[2] * HS * 0.8, b[1] + 1.2 * b[2] * HS * 0.8);
    ctx.quadraticCurveTo(b[0] - 1.2 * b[2] * HS * 0.8, b[1] - 1.8 * b[2] * HS * 0.8, b[0], b[1] - 1.8 * b[2] * HS * 0.8);
    ctx.quadraticCurveTo(b[0] + 1.2 * b[2] * HS * 0.8, b[1] - 1.8 * b[2] * HS * 0.8, b[0] + 1.5 * b[2] * HS * 0.8, b[1] + 1.2 * b[2] * HS * 0.8);
    ctx.closePath();
    ctx.fill();
    if (rung) glow(ctx, b[0], b[1], 7 * b[2] + 1, "255,226,140", 0.6 * f);
    ctx.globalAlpha = f;
    trim(ctx, [P(l - 0.3, z0, 6), P(l + 0.3, z0, 6)], ANSWER_COLORS.SHOOT, 0.3);
    if (!rung) glyph(ctx, "bell", "SHOOT", l, z0, 10.5, true, []);
  }

  /* --------------------------------------------------------------- souls */

  // A wax soul: a golden candle flame with a white core; a halo, a gold ring that draws souls in.
  function soul(ctx, c, you, s, i) {
    const [sx, lane, h, type] = s;
    let dz = sx - you.x;
    const f = fog(dz);
    if (f <= 0.02 || dz < -7) return;
    let l = lane - 1;
    let hh = h;
    if (c.magnet > 0 && dz < 26) {
      const k = clamp(1 - dz / 26, 0, 1) ** 2;
      l += (c.lane - 1 - l) * k;
      hh += (c.h + 2.2 - hh) * k;
      dz *= 1 - k * 0.5;
    }
    const p = P(l, dz, hh + Math.sin(clock / 260 + i) * 0.25);
    const r = p[2] * HS;
    ctx.globalAlpha = f;
    if (type === 1) {
      glow(ctx, p[0], p[1], 6 * r + 1, "255,220,120", 0.7 * f);
      ctx.globalAlpha = f;
      ctx.strokeStyle = "#ffd75a";
      ctx.lineWidth = Math.max(0.2, 0.55 * r);
      ctx.beginPath();
      ctx.ellipse(p[0], p[1], 1.5 * r, 0.55 * r, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(p[0], p[1] - 0.2 * r, 1.1 * r, 0.4 * r, 0, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "#fff4c0";
      disc(ctx, p[0], p[1] + 1.1 * r, 0.55 * r);
      return;
    }
    glow(ctx, p[0], p[1], 2.8 * r + 0.4, "255,190,70", 0.55 * f);
    ctx.globalAlpha = f;
    const w = Math.max(0.18, 0.55 * r);
    ctx.fillStyle = "#ffbc3a";
    ctx.beginPath();
    ctx.moveTo(p[0], p[1] - 1.3 * r);
    ctx.quadraticCurveTo(p[0] + w * 1.5, p[1] + 0.1 * r, p[0], p[1] + 0.9 * r);
    ctx.quadraticCurveTo(p[0] - w * 1.5, p[1] + 0.1 * r, p[0], p[1] - 1.3 * r);
    ctx.fill();
    ctx.fillStyle = "#fff6d0";
    ctx.beginPath();
    ctx.ellipse(p[0], p[1] + 0.25 * r, w * 0.55, 0.55 * r, 0, 0, TAU);
    ctx.fill();
  }

  /* ------------------------------------------------------------- the pew */

  // A bolt flying down its lane.
  function bolt(ctx, you, s) {
    const dz = s.x - you.x;
    if (dz < -4 || dz > 120) return;
    const lane = s.lane === undefined ? 1 : s.lane;
    const p = P(lane - 1, dz, 2.4);
    const q = P(lane - 1, dz - 6, 2.4);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,244,170,0.55)";
    ctx.lineWidth = Math.max(0.3, 1.1 * p[2]);
    ctx.lineCap = "round";
    seg(ctx, p, q);
    glow(ctx, p[0], p[1], 4 * p[2] + 0.5, "255,240,150", 0.8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#fffbe0";
    disc(ctx, p[0], p[1], Math.max(0.3, 0.7 * p[2]));
  }

  // The pew and YOU on it from behind: runners with sparks, the backrest ahead, the seat, the rear panel, then YOU,
  // a little blue square with stick arms, the flashlight out in front and its beam down the aisle.
  function hero(ctx, v, you, c) {
    const lean = c.lean;
    const hx = P(c.lane - 1, 0, 0)[0];
    const lift = c.h * HS;
    const gy = GY0;
    const slide = c.slide > 0 && c.h <= 0;
    const speedK = clamp((c.v - V0) / (V_MAX - V0), 0, 1);
    const bob = c.h > 0 ? 0 : Math.sin(clock / 55) * 0.18 * (0.5 + speedK);
    const bump = c.bump > 0 ? Math.sin(clock / 18) * 0.5 * (c.bump / BUMP_MS) : 0;
    const x = hx + bump;
    const y = gy - lift + bob;
    const blink = you.safeMs > 0 && Math.floor(v.clock / 90) % 2 === 0;
    // Shadow on the floor.
    ctx.globalAlpha = 0.4 / (1 + c.h * 0.12);
    ctx.fillStyle = "#04050c";
    ctx.beginPath();
    ctx.ellipse(hx, gy + 0.9, 6.2 / (1 + c.h * 0.05), 1.6, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = blink ? 0.45 : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(lean * 0.17 + (c.h > 0 ? clamp(c.vh / 260, -0.1, 0.1) : 0));
    // Beam of the flashlight, drawn first so everything of the pew is over it.
    ctx.globalCompositeOperation = "lighter";
    const beam = ctx.createLinearGradient ? ctx.createLinearGradient(0, -7, 0, -26) : null;
    if (beam && beam.addColorStop) {
      beam.addColorStop(0, "rgba(255,236,170,0.5)");
      beam.addColorStop(1, "rgba(255,236,170,0)");
    }
    ctx.fillStyle = beam || "rgba(255,236,170,0.2)";
    ctx.beginPath();
    ctx.moveTo(3.4, -7);
    ctx.lineTo(1.5, -26);
    ctx.lineTo(13, -26);
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    // Runners and sparks.
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(-4.7, -0.9, 9.4, 0.9);
    if (c.h <= 0) {
      ctx.fillStyle = "#ffd36a";
      for (let k = 0; k < 2 + Math.floor(speedK * 5); k++) {
        const t = (clock / 120 + k * 0.37) % 1;
        const sx = (k % 2 ? 1 : -1) * (3.5 + rnd(k, 3) * 1.2);
        disc(ctx, sx + (k % 2 ? 1 : -1) * t * 2, -0.3 - t * 2.2, 0.28 * (1 - t));
      }
    }
    const sq = slide ? 0.55 : 1;
    // Backrest (ahead of him, seen from behind), the seat, the rear panel.
    ctx.fillStyle = "#3a2114";
    ctx.fillRect(-5.2, -8.2 * sq - 1, 10.4, 3.1 * sq);
    ctx.fillStyle = "#7a4c2c";
    ctx.fillRect(-5.2, -8.2 * sq - 1, 10.4, 0.6);
    ctx.fillStyle = "#6a4128";
    ctx.fillRect(-4.6, -3.2, 9.2, 0.8);
    ctx.fillStyle = "#4a2c1a";
    ctx.beginPath();
    ctx.moveTo(-4.8, -0.9);
    ctx.lineTo(4.8, -0.9);
    ctx.lineTo(4.8, -3.1);
    ctx.quadraticCurveTo(0, -4.2, -4.8, -3.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a5a36";
    ctx.lineWidth = 0.22;
    ctx.stroke();
    ctx.fillStyle = "#c9a24a";
    disc(ctx, 0, -2.1, 0.45);
    // YOU: legs, arms, the blue square back, the flashlight in the right hand.
    const ink = (v.colors && v.colors.ink) || "#1d1a17";
    const body = (v.colors && v.colors.you) || "#206cc3";
    ctx.save();
    ctx.translate(0, -3.2);
    ctx.scale(1, sq);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.4;
    ctx.lineCap = "round";
    const step = Math.sin(clock / 70) * 0.25 * (c.h > 0 ? 0 : 1);
    seg(ctx, [-1.1, -1.2], [-1.4 + step, 0]);
    seg(ctx, [1.1, -1.2], [1.4 - step, 0]);
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(-1.5 + step, 0.1, 0.8, 0.4, 0, 0, TAU);
    ctx.ellipse(1.5 - step, 0.1, 0.8, 0.4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.35;
    ctx.fillRect(-3, -7.6, 6, 6.4);
    ctx.strokeRect(-3, -7.6, 6, 6.4);
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-2.6, -7.2, 1.4, 5.6);
    ctx.fillStyle = ink;
    ctx.fillRect(-1.2, -9.0, 2.4, 1.4);
    // Arms out ahead, bracing, the light in the right hand.
    ctx.lineWidth = 0.45;
    seg(ctx, [-3, -5.6], [-4.3, -7.4 + step]);
    seg(ctx, [3, -5.6], [4.2, -8.6]);
    ctx.fillStyle = "#e8e4d4";
    ctx.fillRect(3.4, -10.2, 1.6, 2);
    ctx.fillStyle = "#fff4c0";
    disc(ctx, 4.2, -10.4, 0.8);
    ctx.restore();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Garlic and the halo's ring around him.
    if (c.magnet > 0) {
      ctx.strokeStyle = "rgba(255,215,90,0.8)";
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.ellipse(hx, y - 5, 8 + Math.sin(clock / 120) * 0.6, 7, 0, 0, TAU);
      ctx.stroke();
    }
  }

  /* ----------------------------------------------------------- the frame */

  // Dust in the shafts, and the speed: streaks and a vignette that rise with the ride's pace.
  function air(ctx, you, c) {
    ctx.fillStyle = "#ffdca0";
    for (let i = 0; i < 46; i++) {
      const zz = ((rnd(i, 1) * SEE - you.x * 0.9) % SEE + SEE) % SEE;
      const l = (rnd(i, 2) - 0.5) * 8;
      const h = 1 + rnd(i, 3) * 20;
      const p = P(l + Math.sin(clock / 1700 + i) * 0.2, zz, h + Math.cos(clock / 1300 + i * 2) * 0.3);
      ctx.globalAlpha = fog(zz) * (0.1 + 0.3 * rnd(i, 4)) * (0.6 + 0.4 * beat);
      disc(ctx, p[0], p[1], Math.max(0.08, 0.28 * p[2]));
    }
    const k = clamp((c.v - V0) / (V_MAX - V0), 0, 1);
    ctx.globalAlpha = 1;
    // Streaks from the vanishing point, longer and brighter the faster it goes.
    ctx.lineCap = "round";
    for (let i = 0; i < 26; i++) {
      const a = rnd(i, 7) * TAU;
      const run = (you.x * 0.02 * (0.5 + rnd(i, 8)) + rnd(i, 9)) % 1;
      const r0 = 14 + run * run * 66;
      const r1 = r0 + 3 + k * 22 * run;
      ctx.strokeStyle = `rgba(200,220,255,${(0.1 + 0.6 * k) * run})`;
      ctx.lineWidth = 0.15 + 0.5 * run;
      ctx.beginPath();
      ctx.moveTo(VPX + Math.cos(a) * r0 * 1.5, HOR + 8 + Math.sin(a) * r0 * 0.75);
      ctx.lineTo(VPX + Math.cos(a) * r1 * 1.5, HOR + 8 + Math.sin(a) * r1 * 0.75);
      ctx.stroke();
    }
    ctx.fillStyle = rgrad(ctx, VPX, 30, 76, [[0.45, "rgba(3,4,14,0)"], [1, `rgba(3,4,14,${0.3 + 0.4 * k})`]]);
    ctx.fillRect(0, 0, FW, FH);
  }

  function paint(ctx, v) {
    const { round } = v;
    const c = round.runner;
    const you = round.you;
    FW = v.g.FIELD_W;
    FH = v.g.FIELD_H;
    clock = v.fx && typeof v.fx.clock === "number" ? v.fx.clock : v.clock || 0;
    beat = pulse(clock);
    camL = (c.lane - 1) * 0.55;
    near = NEAR - 6 * clamp((c.v - V0) / (V_MAX - V0), 0, 1);
    const R = round.spec.ride;
    backdrop(ctx);
    const j1 = Math.floor((you.x + SEE) / CELL);
    const j0 = Math.floor((you.x - 10) / CELL);
    const cues = cuesOf(R);
    const flank = new Map();
    // Which lanes of a block's row stay open, for the arrows.
    for (const q of cues) {
      if (KINDS[q.kind].answer !== "SWITCH") continue;
      const key = Math.round(q.x);
      if (!flank.has(key)) flank.set(key, []);
      flank.get(key).push(q.lane);
    }
    // The things and souls bucketed by the cell their near end stands in, drawn far to near.
    const lo = (list, get, x) => {
      let a = 0;
      let b = list.length;
      while (a < b) {
        const m = (a + b) >> 1;
        if (get(list[m]) < x) a = m + 1;
        else b = m;
      }
      return a;
    };
    const first = lo(cues, (q) => q.x, you.x - 12);
    const sFirst = lo(R.souls, (s) => s[0], you.x - 8);
    const after = [];
    // The cues to draw, in order of depth, with the nearest (already passed) after the hero.
    const draw = [];
    for (let i = first; i < cues.length && cues[i].x < you.x + SEE; i++) draw.push(cues[i]);
    for (let i = Math.max(0, first - 8); i < first; i++) if (cues[i].end > you.x - 10) draw.push(cues[i]);
    draw.sort((a, b) => b.x - a.x);
    // Count the "words" in order of approach, nearest first.
    const order = {};
    for (const q of cues) {
      const a = KINDS[q.kind].answer;
      order[q.id] = ((order[a] = (order[a] || 0) + 1) <= 3);
    }
    let di = 0;
    let si = Math.min(R.souls.length, sFirst + 400);
    // Souls to draw, nearest first.
    while (si > sFirst && R.souls[si - 1][0] > you.x + SEE) si--;
    const soulsNear = [];
    for (let j = j1; j >= j0; j--) {
      cell(ctx, you, c, j);
      const zEnd = j * CELL;
      // Things and souls whose near end lies from this cell's start to the next one's.
      while (di < draw.length && draw[di].x >= zEnd) {
        const q = draw[di++];
        if ((q.x + q.end) / 2 < you.x - 1) after.push(q);
        else thing(ctx, you, c, q, flank.get(Math.round(q.x)) || [], order[q.id]);
      }
      while (si > sFirst && R.souls[si - 1][0] >= zEnd) {
        si--;
        if (c.souls[si] === 0) soulsNear.push(si);
      }
      // Draw this cell's souls (far end first) now.
      while (soulsNear.length) {
        const n = soulsNear.shift();
        soul(ctx, c, you, R.souls[n], n);
      }
    }
    while (di < draw.length) {
      const q = draw[di++];
      if ((q.x + q.end) / 2 < you.x - 1) after.push(q);
      else thing(ctx, you, c, q, flank.get(Math.round(q.x)) || [], order[q.id]);
    }
    for (const s of round.shots) if (!s.arm && !s.free) bolt(ctx, you, s);
    hero(ctx, v, you, c);
    for (const q of after) thing(ctx, you, c, q, flank.get(Math.round(q.x)) || [], false);
    air(ctx, you, c);
    ctx.globalAlpha = 1;
  }

  return { paint };
}
