// Plan2Code Web Console - Bounce Road's scenery: each stage's look, the road drawn a chunk of rows at a time (yards, kitchen and bathroom tiles, sand, carpet, pond, roof shingles, night lawn, the pinball table, a desk, ice, cushions over lava, and the arenas' dirt, concrete, floorboards and couch), and the parts drawn fresh each frame over it: drawbridges, swaying bridges, crumbling road, boost strips, ramps, conveyors, spring pads, slicks, barriers, bumpers, stars, signs, power-ups, trains, balls, rollers, lasers, stompers, sprinklers, falling things, gusts, bubbling lava, an icy sheen, rain and the dark of a stage with its lights out.
//
// Drawing only: no rules and no state beyond the chunks of road it keeps.
// bounce-draw.js calls in with the view bounce.js refills each frame; where
// a moving part is comes from bounce-road.js's plain functions of the
// round's clock, so a paused game's frame stays still. Everything is in
// field units. The yard, the road and its things keep their own fixed
// colors, the same in light and dark.

import { DRAW_MOVE_MS, DROP_FALL_MS, FIELD_W, MARK, ROW, TRAIN_WARN_MS, ballX, crumbleAt, drawLift, gustAt, laserAt, sprayAt, stomperAt, swayOff, trainAt } from "./bounce-road.js";

const TAU = Math.PI * 2;
export const DARK_INK = "#1d1a17";
export const LIGHT_INK = "#f0ece5";

// Each stage's look: the yard (`ground`, and `alt` for its pattern), the
// road, its edge lines and dashes, the water and its banks, the planks of a
// bridge, a hole and its rim, a flowerbed's soil and bricks, the decor's
// colors, the color the stage's name shows in, and the yard's `pattern`.
const look = (o) => Object.freeze({ ...o, decor: Object.freeze(o.decor) });
export const LOOKS = Object.freeze({
  chalk: look({ pattern: "slabs", ground: "#cfc8bb", alt: "#b9b1a3", road: "#4a5160", edge: "#f4f1ea", dash: "#f4f1ea", water: "#3b87c9", ripple: "#7fb7e6", bank: "#d8c9a8", plank: "#b07a45", seam: "#7d5330", hole: "#2b2420", rim: "#6d5f52", soil: "#6b4a33", brick: "#b5543c", decor: ["#ff7eb6", "#ffd84a", "#7fd8ff"], color: "#ff7eb6" }),
  hose: look({ pattern: "stripes", ground: "#6fbf4a", alt: "#64b041", road: "#454a55", edge: "#f4f1ea", dash: "#ffd84a", water: "#3b87c9", ripple: "#7fb7e6", bank: "#c9b98a", plank: "#b07a45", seam: "#7d5330", hole: "#3a2a1c", rim: "#7a5a3a", soil: "#6b4a33", brick: "#b5543c", decor: ["#ffffff", "#ffd84a", "#3e8a3a"], color: "#3b87c9" }),
  kitchen: look({ pattern: "tiles", ground: "#e9e4da", alt: "#c95c4c", road: "#3d4250", edge: "#ffffff", dash: "#ffd84a", water: "#4a9ad6", ripple: "#9bd0f2", bank: "#d8d2c4", plank: "#a87a4a", seam: "#6e4a2a", hole: "#231d1a", rim: "#5d5148", soil: "#6b4a33", brick: "#b5543c", decor: ["#ff8a1f", "#7ad151", "#ffffff"], color: "#ff8a1f" }),
  beds: look({ pattern: "stripes", ground: "#7ac35a", alt: "#6db44f", road: "#474440", edge: "#f4f1ea", dash: "#f4f1ea", water: "#3f8fd0", ripple: "#86bfe9", bank: "#c9b98a", plank: "#b07a45", seam: "#7d5330", hole: "#3a2a1c", rim: "#7a5a3a", soil: "#6b4a33", brick: "#b5543c", decor: ["#ff4fa3", "#ffd84a", "#a466ff"], color: "#ff4fa3" }),
  sand: look({ pattern: "sand", ground: "#e8cf8f", alt: "#d6ba74", road: "#4c453f", edge: "#fff3d6", dash: "#fff3d6", water: "#3b9ad0", ripple: "#8cc8ea", bank: "#f2e2b4", plank: "#a87644", seam: "#6e4a2a", hole: "#4a3420", rim: "#a4875c", soil: "#7a5a3a", brick: "#c46a3f", decor: ["#ff8a1f", "#e8483c", "#3fa7e0"], color: "#e0a030" }),
  toys: look({ pattern: "rug", ground: "#5a78b8", alt: "#4b68a5", road: "#2f3340", edge: "#ffd84a", dash: "#ffffff", water: "#3b87c9", ripple: "#7fb7e6", bank: "#c9b98a", plank: "#8a5a30", seam: "#5a3a1e", hole: "#15131a", rim: "#3b3550", soil: "#6b4a33", brick: "#b5543c", decor: ["#ff4f4f", "#ffd84a", "#7ad151"], color: "#7fa8ff" }),
  pond: look({ pattern: "stripes", ground: "#5aa04e", alt: "#519446", road: "#45494f", edge: "#e6ecf2", dash: "#e6ecf2", water: "#2f7fb3", ripple: "#78b6dc", bank: "#a99e79", plank: "#9a6a3c", seam: "#6a4524", hole: "#2e2418", rim: "#6a5238", soil: "#5a3d26", brick: "#a24c35", decor: ["#ff9ad5", "#ffffff", "#2f7a3a"], color: "#2fc4a0" }),
  gutter: look({ pattern: "shingles", ground: "#8e4a3c", alt: "#743a2f", road: "#3f444b", edge: "#e6ecf2", dash: "#e6ecf2", water: "#3b87c9", ripple: "#7fb7e6", bank: "#9aa0a6", plank: "#5d6369", seam: "#363a40", hole: "#141214", rim: "#4a4e54", soil: "#5a3d26", brick: "#a24c35", decor: ["#c9b98a", "#7a5a3a", "#3e8a3a"], color: "#c9d3dd" }),
  night: look({ pattern: "stripes", ground: "#2e4862", alt: "#2a425b", road: "#1d212b", edge: "#d9dde6", dash: "#ffd84a", water: "#1d3f66", ripple: "#4f77a8", bank: "#4e4a56", plank: "#6d4e34", seam: "#42301f", hole: "#0b090d", rim: "#3d3842", soil: "#3e2c22", brick: "#7e3d2f", decor: ["#ffe98a", "#a466ff", "#7fd8ff"], color: "#a466ff" }),
  giant: look({ pattern: "dirt", ground: "#9a7349", alt: "#86623d", road: "#33302e", edge: "#ffd84a", dash: "#f4f1ea", water: "#3b87c9", ripple: "#7fb7e6", bank: "#c9b98a", plank: "#a87644", seam: "#6e4a2a", hole: "#1a120c", rim: "#5a4028", soil: "#5a3d26", brick: "#a24c35", decor: ["#e8483c", "#ffd84a", "#f4f1ea"], color: "#e8483c" }),
  // The later themes: the bathroom's small tiles and soapy water, the pinball table's lit grid, the desk's wood and spilled ink, the freezer's ice, the lava under the cushions (its `hole` glows), and the four new arenas: the garage's stained concrete, the hall's runner on floorboards, the dim attic and the couch's weave.
  bath: look({ pattern: "bath", ground: "#d3e8ee", alt: "#9fd0dd", road: "#3f4a57", edge: "#ffffff", dash: "#9be7ff", water: "#58b4d6", ripple: "#f1fcff", bank: "#f4f8fa", plank: "#3a8f80", seam: "#256b5f", hole: "#1b2a33", rim: "#7d97a3", soil: "#6b4a33", brick: "#b5543c", decor: ["#ffffff", "#ffd84a", "#ff9ad5"], color: "#57d9e8" }),
  pinball: look({ pattern: "grid", ground: "#14173a", alt: "#2c3380", road: "#474c61", edge: "#ff4fd8", dash: "#38e8ff", water: "#2a1f6b", ripple: "#7d6bff", bank: "#3a3f66", plank: "#7654b8", seam: "#3d2b7a", hole: "#06060c", rim: "#8a3fd0", soil: "#2a2440", brick: "#8d93a8", decor: ["#ff4fd8", "#38e8ff", "#ffe14a"], color: "#ff3df0" }),
  desk: look({ pattern: "wood", ground: "#bb8c58", alt: "#a57744", road: "#40444f", edge: "#f4f1ea", dash: "#ff8a8a", water: "#2b3a8c", ripple: "#6f83e0", bank: "#ece5d2", plank: "#b5722e", seam: "#6e4a2a", hole: "#1b1410", rim: "#6a4a2c", soil: "#6b4a33", brick: "#b5543c", decor: ["#ff8fa8", "#ffd23f", "#f4f1ea"], color: "#ffe066" }),
  ice: look({ pattern: "ice", ground: "#cfe9f5", alt: "#a9d2e8", road: "#3e4a5c", edge: "#ffffff", dash: "#bfeaff", water: "#2f6fa8", ripple: "#9fd0f0", bank: "#f4fbff", plank: "#5f7f98", seam: "#3d5568", hole: "#16222e", rim: "#8fb4cc", soil: "#5a3d26", brick: "#7d97a3", decor: ["#ffffff", "#9fe8ff", "#7fb7e6"], color: "#d6f3ff" }),
  lava: look({ pattern: "cushion", ground: "#7d4c63", alt: "#6c3f55", road: "#463c44", edge: "#f2d9b0", dash: "#f2d9b0", water: "#e8501a", ripple: "#ffc04a", bank: "#5a1408", plank: "#8a6a4a", seam: "#5a3d26", hole: "#f0541a", rim: "#6b1a0c", soil: "#5a2d3c", brick: "#c9a36a", decor: ["#ffd84a", "#c9b3e6", "#e8d9c0"], color: "#ff5a1f" }),
  garage: look({ pattern: "concrete", ground: "#9c9ea1", alt: "#84878b", road: "#3a3d42", edge: "#f2c230", dash: "#f4f1ea", water: "#3b87c9", ripple: "#7fb7e6", bank: "#c2c4c7", plank: "#6d7279", seam: "#3d4147", hole: "#17150f", rim: "#5c5a52", soil: "#5a3d26", brick: "#a24c35", decor: ["#2b2b30", "#c0392b", "#d9dce2"], color: "#8fa3b8" }),
  hall: look({ pattern: "boards", ground: "#b58252", alt: "#96673d", road: "#4c3038", edge: "#e6c36a", dash: "#e6c36a", water: "#3b87c9", ripple: "#7fb7e6", bank: "#c9b98a", plank: "#8a5a30", seam: "#5a3a1e", hole: "#1c130d", rim: "#6a4a2c", soil: "#5a3d26", brick: "#a24c35", decor: ["#c9ccd2", "#e8483c", "#ffd84a"], color: "#b5e04a" }),
  attic: look({ pattern: "boards", ground: "#6f5b46", alt: "#5a4836", road: "#34302e", edge: "#d9c9a8", dash: "#d9c9a8", water: "#2f5f86", ripple: "#6f9cc0", bank: "#8a7a66", plank: "#7a5a3c", seam: "#4a3524", hole: "#0f0b08", rim: "#4a3a2c", soil: "#3e2c22", brick: "#7e3d2f", decor: ["#c9b98a", "#e6dcc8", "#8fb4cc"], color: "#d9b38c" }),
  couch: look({ pattern: "weave", ground: "#6f93b8", alt: "#5c7fa4", road: "#3b3d4a", edge: "#f4f1ea", dash: "#ffd84a", water: "#3b87c9", ripple: "#7fb7e6", bank: "#c9b98a", plank: "#8a5a30", seam: "#5a3a1e", hole: "#14121a", rim: "#3f5670", soil: "#5a3d26", brick: "#a24c35", decor: ["#ff9ec4", "#f4f1ea", "#ffd84a"], color: "#ff9d5c" }),
});
export const lookOf = (id) => LOOKS[id] || LOOKS.chalk;
export const stageColor = (id) => lookOf(id).color;

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
// Whichever of a dark and a light ink stands out more from all of `tones`.
export const better = (...tones) => {
  const worst = (ink) => Math.min(...tones.map((t) => contrast(ink, t)));
  return worst(DARK_INK) >= worst(LIGHT_INK) ? DARK_INK : LIGHT_INK;
};

// A small whole-number hash, for the decor, so each piece keeps its place.
export const hash = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) % 997;
};

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}
export const ellipse = (ctx, x, y, rx, ry) => {
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU);
  else ctx.arc(x, y, Math.max(rx, ry), 0, TAU);
};
export const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
};
export function star(ctx, x, y, outer, inner, spin = 0) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = spin - Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------- the road */

const SEAM = 0.12;

// A band across a row, `x0b` to `x1b` at its near end (the bottom, `y + h`)
// and `x0t` to `x1t` at its far end (the top, `y`): the road's edges slant
// from row to row, never a stair step.
function band(ctx, x0b, x1b, x0t, x1t, y, h) {
  ctx.beginPath();
  ctx.moveTo(x0b, y + h);
  ctx.lineTo(x1b, y + h);
  ctx.lineTo(x1t, y);
  ctx.lineTo(x0t, y);
  ctx.closePath();
  ctx.fill();
}

// The yard under a row, in its look's pattern (pass 0, under the road).
function yard(ctx, lk, i, fy, fh, W) {
  const alt = (on) => {
    ctx.fillStyle = on ? lk.alt : lk.ground;
    ctx.fillRect(0, fy, W, fh);
  };
  if (lk.pattern === "stripes" || lk.pattern === "rug") alt(Math.floor(i / 4) % 2 === 1);
  else if (lk.pattern === "cushion") alt(Math.floor(i / 5) % 2 === 1);
  else alt(false);
  if (lk.pattern === "bath") {
    // Small bathroom tiles: a tinted one here and there, white grout both ways.
    const h = hash(i >> 1, 51);
    ctx.fillStyle = lk.alt;
    ctx.fillRect((h % 18) * 4, fy, 4, fh);
    if (h % 3 === 0) ctx.fillRect(((h * 7) % 18) * 4, fy, 4, fh);
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
    for (let x = 0; x < W; x += 4) ctx.fillRect(x - 0.12, fy, 0.24, fh);
    if (i % 2 === 0) ctx.fillRect(0, fy + fh - SEAM - 0.24, W, 0.24);
  } else if (lk.pattern === "grid") {
    // The pinball table's lit grid, a lamp at a crossing here and there.
    ctx.fillStyle = lk.alt;
    for (let x = 3; x < W; x += 6) ctx.fillRect(x - 0.1, fy, 0.2, fh);
    if (i % 3 === 0) {
      ctx.fillRect(0, fy + fh - SEAM - 0.2, W, 0.2);
      const h = hash(i, 52);
      ctx.fillStyle = lk.decor[h % 3];
      ctx.fillRect(3 + (h % 12) * 6 - 0.35, fy + fh - SEAM - 0.45, 0.7, 0.7);
    }
  } else if (lk.pattern === "wood") {
    // A desk's grain: long streaks across it, a join between its boards.
    ctx.fillStyle = lk.alt;
    for (let n = 0; n < 3; n++) {
      const h = hash(i, n + 60);
      ctx.fillRect((h * 7.3) % W, fy + 0.3 + (h % 7) / 5, 6 + (h % 9), 0.2);
    }
    if (i % 11 === 0) ctx.fillRect(0, fy + fh - SEAM - 0.3, W, 0.3);
  } else if (lk.pattern === "ice") {
    // Ice: a hairline crack or two and a glint of frost.
    ctx.fillStyle = lk.alt;
    for (let n = 0; n < 2; n++) {
      const h = hash(i, n + 70);
      const x = (h * 7.3) % W;
      ctx.fillRect(x, fy + 0.4 + (h % 6) / 5, 3 + (h % 5), 0.18);
      ctx.fillRect(x + 1 + (h % 3), fy + 0.4 + (h % 6) / 5, 0.18, 0.7);
    }
    ctx.fillStyle = "#ffffff";
    const h = hash(i, 72);
    ctx.fillRect((h * 5.9) % W, fy + 0.5 + (h % 5) / 5, 0.45, 0.45);
  } else if (lk.pattern === "cushion") {
    // Cushions: a button every so often along each band.
    if (i % 5 === 2) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      for (let x = Math.floor(i / 5) % 2 ? 4.5 : 9; x < W; x += 9) ctx.fillRect(x - 0.4, fy + 0.7, 0.8, 0.8);
    }
  } else if (lk.pattern === "concrete") {
    // Poured slabs: a joint between them, and specks of grit and grease.
    ctx.fillStyle = lk.alt;
    if (i % 10 === 0) ctx.fillRect(0, fy + fh - SEAM - 0.3, W, 0.3);
    for (let x = Math.floor(i / 10) % 2 ? 12 : 0; x < W; x += 24) ctx.fillRect(x, fy, 0.3, fh);
    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    for (let n = 0; n < 3; n++) {
      const h = hash(i, n + 80);
      ctx.fillRect((h * 7.3) % W, fy + 0.3 + (h % 8) / 6, 0.5 + (h % 3) * 0.5, 0.45);
    }
  } else if (lk.pattern === "boards") {
    // Floorboards running the way the road does, each with an end joint now
    // and then, and a knot here and there.
    ctx.fillStyle = lk.alt;
    for (let x = 0, c = 0; x < W; x += 6, c++) {
      ctx.fillRect(x, fy, 0.3, fh);
      if ((i + c * 5) % 13 === 0) ctx.fillRect(x, fy + fh - SEAM - 0.3, 6, 0.3);
    }
    const h = hash(i, 85);
    if (h % 5 === 0) ctx.fillRect((h * 7.3) % W, fy + 0.7, 0.8, 0.5);
  } else if (lk.pattern === "weave") {
    // A basket weave: strands across in one square, along in the next.
    ctx.fillStyle = lk.alt;
    const cy = Math.floor(i / 2);
    for (let x = 0, c = 0; x < W; x += 4, c++) {
      if ((c + cy) % 2) ctx.fillRect(x + 1.85, fy, 0.3, fh);
      else ctx.fillRect(x + 0.3, fy + fh / 2 - 0.15, 3.4, 0.3);
    }
  }
  if (lk.pattern === "tiles") {
    ctx.fillStyle = lk.alt;
    // Inside the row only: a tile reaching over the seam would leave a line
    // of the next row's grout across it.
    for (let x = Math.floor(i / 3) % 2 ? 6 : 0; x < W; x += 12) ctx.fillRect(x, fy + SEAM, 6, fh - SEAM * 2);
  } else if (lk.pattern === "sand" || lk.pattern === "dirt") {
    ctx.fillStyle = lk.alt;
    for (let n = 0; n < 4; n++) {
      const h = hash(i, n + 40);
      ctx.fillRect((h * 7.3) % W, fy + (h % 10) / 6, 0.6, 0.5);
    }
  } else if (lk.pattern === "shingles") {
    if (i % 3 === 0) {
      ctx.fillStyle = lk.alt;
      ctx.fillRect(0, fy + fh - 0.5, W, 0.5);
    }
    ctx.fillStyle = lk.alt;
    for (let x = Math.floor(i / 3) % 2 ? 2.5 : 0; x < W; x += 5) ctx.fillRect(x, fy, 0.35, fh);
  }
  if (lk.pattern === "rug" && i % 8 === 0) {
    ctx.fillStyle = "#ffd84a";
    ctx.fillRect(0, fy, W, 0.4);
  }
}

// One row of the road, its far end at `y` (rows run up the board), in one
// of three passes over a chunk: 0 the yard, 1 the road's surface (road,
// planks or a flowerbed), 2 the details on them. The fills of the first two
// passes reach SEAM past the row both ways, so no hairline of the yard shows
// where two rows of road meet; every detail stays inside its own row, so a
// chunk's edge never cuts one. A swaying bridge is not drawn here: it moves.
export function drawRow(ctx, v, i, y, pass) {
  const { road, g, ground } = v;
  const k = Math.min(road.rows - 1, Math.max(0, i));
  const R = g.ROW;
  const fy = y - SEAM;
  const fh = R + SEAM * 2;
  const lk = lookOf(v.stageFor(road.stageOf[k]).id);
  const under = road.under[k];
  const W = g.FIELD_W;
  const L = road.L[k];
  const Rr = road.R[k];
  const Lb = k > 0 ? road.L[k - 1] : L;
  const Rb = k > 0 ? road.R[k - 1] : Rr;
  const deck = road.deck[k] === 1;
  const bed = road.ML[k] < road.MR[k];
  const near = (j) => road.under[Math.min(road.rows - 1, Math.max(0, j))];
  if (pass === 0) {
    if (under === ground.water) {
      ctx.fillStyle = lk.water;
      ctx.fillRect(0, fy, W, fh);
    } else if (under === ground.hole) {
      ctx.fillStyle = lk.hole;
      ctx.fillRect(0, fy, W, fh);
    } else yard(ctx, lk, i, fy, fh, W);
    return;
  }
  if (pass === 1) {
    if (!deck) return;
    ctx.fillStyle = under === ground.water ? lk.plank : lk.road;
    band(ctx, Lb, Rb, L, Rr, fy, fh);
    if (bed) {
      ctx.fillStyle = lk.brick;
      ctx.fillRect(road.ML[k], fy, road.MR[k] - road.ML[k], fh);
      ctx.fillStyle = lk.soil;
      ctx.fillRect(road.ML[k] + 0.7, fy, road.MR[k] - road.ML[k] - 1.4, fh);
    }
    if (under !== ground.water) {
      ctx.fillStyle = lk.edge;
      band(ctx, Lb + 0.5, Lb + 0.95, L + 0.5, L + 0.95, fy, fh);
      band(ctx, Rb - 0.95, Rb - 0.5, Rr - 0.95, Rr - 0.5, fy, fh);
    }
    return;
  }
  // The yard's details: ripples and banks, a hole's rims, patio grout, decor.
  if (under === ground.water) {
    ctx.fillStyle = lk.ripple;
    for (let n = 0; n < 3; n++) {
      const h = hash(i, n);
      const x = (h * 7) % W;
      // Never across a bridge's planks.
      if (h % 3 || (road.deck[k] && x + 2.2 > L - 1 && x < Rr + 1)) continue;
      ctx.fillRect(x, y + 0.7, 2.2, 0.35);
    }
    if (lk === LOOKS.pond && hash(i, 9) % 5 === 0) {
      // A lily pad.
      const x = (hash(i, 8) * 3.1) % W;
      if (x < L - 3 || x > Rr + 3 || !deck) {
        ctx.fillStyle = "#4f9a3e";
        circle(ctx, x, y + R / 2, 0.9);
        ctx.fill();
      }
    }
    ctx.fillStyle = lk.bank;
    if (near(k + 1) !== ground.water) ctx.fillRect(0, y, W, 0.6);
    if (near(k - 1) !== ground.water) ctx.fillRect(0, y + R - 0.6, W, 0.6);
  } else if (under === ground.hole) {
    ctx.fillStyle = lk.rim;
    if (near(k + 1) !== ground.hole) ctx.fillRect(0, y, W, 0.5);
    if (near(k - 1) !== ground.hole) ctx.fillRect(0, y + R - 0.7, W, 0.7);
    if (lk === LOOKS.lava) {
      // Lava: bright flecks and a dark crust floating on it, never over a
      // row of road.
      for (let n = 0; n < 3; n++) {
        const h = hash(i, n + 90);
        const x = (h * 7.3) % W;
        if (road.deck[k] && x + 3.2 > L - 1 && x < Rr + 1) continue;
        ctx.fillStyle = n === 0 ? "#ffd84a" : n === 1 ? "#ff9a2f" : "#b3260d";
        ctx.fillRect(x, y + 0.3 + (h % 5) / 4, 1.2 + (h % 4) * 0.6, n === 2 ? 0.6 : 0.35);
      }
    }
  } else {
    if (lk.pattern === "slabs") {
      ctx.fillStyle = lk.alt;
      if (i % 6 === 0) ctx.fillRect(0, y + R - 0.3, Lb, 0.3), ctx.fillRect(Rb, y + R - 0.3, W - Rb, 0.3);
      const off = Math.floor(i / 6) % 2 ? 9 : 0;
      for (let x = off; x < W; x += 18) if (x < Math.min(L, Lb) - 0.3 || x > Math.max(Rr, Rb)) ctx.fillRect(x, y, 0.3, R);
    }
    const h = hash(i, 11);
    if (h % 4 === 0) {
      const left = h % 8 === 0;
      const lo = left ? 1.5 : Math.max(Rr, Rb) + 2.5;
      const hi = left ? Math.min(L, Lb) - 2.5 : W - 1.5;
      if (hi > lo) drawDecor(ctx, lk, lo + (((h * 13) % 100) / 100) * (hi - lo), y + R / 2, h);
    }
  }
  if (road.mark[k] === MARK.rails) {
    // Sleepers and two rails right across the field.
    ctx.fillStyle = "#6a4a30";
    for (let x = 0.5; x < W; x += 2.2) ctx.fillRect(x, y + 0.1, 0.9, R - 0.2);
    ctx.fillStyle = "#c9ccd2";
    if (road.mark[Math.max(0, k - 1)] !== MARK.rails) ctx.fillRect(0, y + R - 0.75, W, 0.4);
    if (road.mark[Math.min(road.rows - 1, k + 1)] !== MARK.rails) ctx.fillRect(0, y + 0.35, W, 0.4);
  }
  if (!deck) {
    if (under === ground.water && road.deck[k] === 0 && hash(i, 5) % 3 === 0) {
      ctx.fillStyle = lk.plank;
      ctx.fillRect(L + ((hash(i, 6) % 10) / 10) * (Rr - L - 3), y + 0.6, 3, 0.7);
    }
    return;
  }
  if (road.mark[k] === MARK.crumble) {
    // Cracked road over the pit: a crazed line or two a row.
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    const h = hash(i, 21);
    ctx.fillRect(L + 1 + (h % 10) * ((Rr - L - 4) / 10), y + 0.3, 2.4, 0.22);
    ctx.fillRect(L + 1 + ((h >> 3) % 10) * ((Rr - L - 4) / 10), y + 1.2, 0.22, 0.7);
  }
  if (under === ground.water) {
    ctx.fillStyle = lk.seam;
    ctx.fillRect(L, y + R - 0.25, Rr - L, 0.25);
    ctx.fillRect(L, y, 0.5, R);
    ctx.fillRect(Rr - 0.5, y, 0.5, R);
    if (i % 4 === 0) {
      ctx.fillRect(L - 0.9, y + 0.4, 0.9, 1.2);
      ctx.fillRect(Rr, y + 0.4, 0.9, 1.2);
    }
    for (const [j, top] of [
      [k + 1, true],
      [k - 1, false],
    ]) {
      if (j < 0 || j >= road.rows || road.deck[j]) continue;
      ctx.fillStyle = lk.water;
      for (let x = L + 0.5; x < Rr - 0.5; x += 2) {
        const depth = 0.3 + (hash(i + x * 3, 2) % 6) / 10;
        ctx.fillRect(x, top ? y : y + R - depth, 1, depth);
      }
    }
  }
  if (bed) {
    const ml = road.ML[k];
    const mr = road.MR[k];
    const bedRow = (j) => j >= 0 && j < road.rows && road.ML[j] < road.MR[j];
    ctx.fillStyle = lk.brick;
    if (!bedRow(k - 1)) ctx.fillRect(ml, y + R - 0.7, mr - ml, 0.7);
    if (!bedRow(k + 1)) ctx.fillRect(ml, y, mr - ml, 0.7);
    const h = hash(i, 3);
    for (let n = 0; n < 2; n++) {
      const x = ml + 1.6 + ((((h + n * 37) * 7) % 100) / 100) * (mr - ml - 3.2);
      ctx.fillStyle = lk.decor[(h + n) % 3];
      circle(ctx, x, y + R / 2, 0.55);
      ctx.fill();
    }
  } else if (under !== ground.water && !road.mark[k] && i % 6 < 3) {
    ctx.fillStyle = lk.dash;
    const cb = (Lb + Rb) / 2;
    const ct = (L + Rr) / 2;
    band(ctx, cb - 0.25, cb + 0.25, ct - 0.25, ct + 0.25, y, R);
  }
  if (v.lines.has(i)) {
    for (let x = L, n = 0; x < Rr; x += 1.5, n++) {
      ctx.fillStyle = n % 2 ? "#f4f1ea" : "#1d1a17";
      ctx.fillRect(x, y, Math.min(1.5, Rr - x), R / 2);
      ctx.fillStyle = n % 2 ? "#1d1a17" : "#f4f1ea";
      ctx.fillRect(x, y + R / 2, Math.min(1.5, Rr - x), R / 2);
    }
  }
}

// One piece of verge decor, small enough to stay in its row, in the look's
// own kind: flowers and pebbles, crumbs, toys, shells, lamps.
function drawDecor(ctx, lk, x, y, h) {
  const kind = h % 3;
  ctx.fillStyle = lk.decor[h % lk.decor.length];
  if (lk.pattern === "tiles") {
    // A crumb or a pea.
    circle(ctx, x, y, 0.35 + (h % 3) * 0.12);
    ctx.fill();
  } else if (lk.pattern === "rug") {
    // A toy brick with its studs.
    ctx.fillRect(x - 0.9, y - 0.6, 1.8, 1.2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    ctx.fillRect(x - 0.6, y - 0.3, 0.35, 0.35);
    ctx.fillRect(x + 0.25, y - 0.3, 0.35, 0.35);
  } else if (lk.pattern === "shingles") {
    // A leaf in the gutter.
    ellipse(ctx, x, y, 0.8, 0.35);
    ctx.fill();
  } else if (lk.pattern === "bath") {
    if (kind === 1) {
      // A rubber duck.
      ctx.fillStyle = "#ffd84a";
      ellipse(ctx, x, y + 0.1, 0.8, 0.6);
      ctx.fill();
      circle(ctx, x + 0.5, y - 0.3, 0.42);
      ctx.fill();
      ctx.fillStyle = "#ff8a1f";
      ctx.fillRect(x + 0.8, y - 0.4, 0.4, 0.22);
    } else {
      // A soap bubble or two.
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.16;
      for (const [bx, by, r] of [[0, 0, 0.7], [0.95, 0.35, 0.35]]) {
        circle(ctx, x + bx, y + by, r);
        ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 0.35, y - 0.35, 0.25, 0.25);
    }
  } else if (lk.pattern === "grid") {
    // A lamp set in the table, lit.
    const color = ctx.fillStyle;
    ctx.globalAlpha = 0.3;
    circle(ctx, x, y, 0.95);
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, x, y, 0.5);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    circle(ctx, x, y, 0.2);
    ctx.fill();
    ctx.fillStyle = color;
  } else if (lk.pattern === "wood") {
    if (kind === 0) {
      // An eraser.
      ctx.fillStyle = "#ff8fa8";
      ctx.fillRect(x - 0.9, y - 0.5, 1.8, 1);
      ctx.fillStyle = "#4f7fd0";
      ctx.fillRect(x - 0.9, y - 0.5, 0.6, 1);
    } else if (kind === 1) {
      // A pencil stub.
      ctx.fillStyle = "#ffd23f";
      ctx.fillRect(x - 1, y - 0.25, 1.6, 0.5);
      ctx.fillStyle = "#e6c49a";
      ctx.fillRect(x + 0.6, y - 0.25, 0.4, 0.5);
      ctx.fillStyle = DARK_INK;
      ctx.fillRect(x + 1, y - 0.12, 0.2, 0.24);
    } else {
      // A scrap of paper with a line of ink on it.
      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(x - 0.8, y - 0.7, 1.6, 1.4);
      ctx.fillStyle = "#2b3a8c";
      ctx.fillRect(x - 0.5, y - 0.3, 1, 0.15);
      ctx.fillRect(x - 0.5, y + 0.15, 0.7, 0.15);
    }
  } else if (lk.pattern === "ice") {
    if (kind === 0) {
      // An ice cube.
      ctx.fillStyle = "#e6f6ff";
      ctx.fillRect(x - 0.7, y - 0.7, 1.4, 1.4);
      ctx.fillStyle = "#9fd0f0";
      ctx.fillRect(x - 0.7, y + 0.3, 1.4, 0.4);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 0.45, y - 0.45, 0.4, 0.4);
    } else {
      // A snowflake.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 0.85, y - 0.1, 1.7, 0.2);
      ctx.fillRect(x - 0.1, y - 0.85, 0.2, 1.7);
      ctx.fillRect(x - 0.55, y - 0.55, 0.3, 0.3);
      ctx.fillRect(x + 0.25, y - 0.55, 0.3, 0.3);
      ctx.fillRect(x - 0.55, y + 0.25, 0.3, 0.3);
      ctx.fillRect(x + 0.25, y + 0.25, 0.3, 0.3);
    }
  } else if (lk.pattern === "cushion") {
    // A throw pillow, with its button.
    roundRect(ctx, x - 0.9, y - 0.75, 1.8, 1.5, 0.4);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    circle(ctx, x, y, 0.22);
    ctx.fill();
  } else if (lk.pattern === "concrete") {
    if (kind === 0) {
      // An oil stain.
      ctx.fillStyle = "rgba(20, 18, 24, 0.55)";
      ellipse(ctx, x, y, 0.95, 0.6);
      ctx.fill();
      ctx.fillStyle = "rgba(160, 120, 255, 0.4)";
      ellipse(ctx, x - 0.2, y - 0.1, 0.4, 0.2);
      ctx.fill();
    } else if (kind === 1) {
      // A rag.
      ctx.fillStyle = "#c0392b";
      ctx.fillRect(x - 0.8, y - 0.5, 1.5, 1);
      ctx.fillRect(x - 0.4, y - 0.75, 1.3, 0.9);
    } else {
      // A nut off some bolt.
      ctx.fillStyle = "#d9dce2";
      circle(ctx, x, y, 0.6);
      ctx.fill();
      ctx.fillStyle = "#3a3d42";
      circle(ctx, x, y, 0.26);
      ctx.fill();
    }
  } else if (lk.pattern === "boards" && lk === LOOKS.attic) {
    if (kind === 0) {
      // A cardboard box, taped shut.
      ctx.fillStyle = "#b08a5a";
      ctx.fillRect(x - 0.9, y - 0.8, 1.8, 1.6);
      ctx.fillStyle = "#e6dcc8";
      ctx.fillRect(x - 0.15, y - 0.8, 0.3, 1.6);
    } else {
      // A cobweb.
      ctx.strokeStyle = "rgba(240, 240, 240, 0.6)";
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      for (let n = 0; n < 4; n++) {
        const a = (n * Math.PI) / 4;
        ctx.moveTo(x - Math.cos(a) * 0.9, y - Math.sin(a) * 0.9);
        ctx.lineTo(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9);
      }
      ctx.stroke();
      circle(ctx, x, y, 0.5);
      ctx.stroke();
    }
  } else if (lk.pattern === "boards") {
    if (kind === 0) {
      // A dust bunny.
      ctx.fillStyle = "rgba(210, 212, 218, 0.85)";
      for (const [bx, by, r] of [[-0.35, 0, 0.5], [0.3, -0.15, 0.45], [0.15, 0.3, 0.4]]) {
        circle(ctx, x + bx, y + by, r);
        ctx.fill();
      }
    } else if (kind === 1) {
      // A lost sock.
      ctx.fillStyle = "#e8483c";
      ctx.fillRect(x - 0.9, y - 0.35, 1.4, 0.7);
      ctx.fillRect(x + 0.2, y - 0.35, 0.7, 1.1);
      ctx.fillStyle = "#f4f1ea";
      ctx.fillRect(x - 0.9, y - 0.35, 0.35, 0.7);
    } else {
      // A coin.
      ctx.fillStyle = "#ffd84a";
      circle(ctx, x, y, 0.55);
      ctx.fill();
      ctx.fillStyle = "#c98a1a";
      circle(ctx, x, y, 0.28);
      ctx.fill();
    }
  } else if (lk.pattern === "weave") {
    if (kind === 0) {
      // A ball of yarn.
      circle(ctx, x, y, 0.75);
      ctx.fill();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(x - 0.6, y - 0.3);
      ctx.lineTo(x + 0.5, y + 0.4);
      ctx.moveTo(x - 0.4, y + 0.5);
      ctx.lineTo(x + 0.6, y - 0.3);
      ctx.stroke();
    } else if (kind === 1) {
      // A button.
      circle(ctx, x, y, 0.6);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(x - 0.3, y - 0.1, 0.2, 0.2);
      ctx.fillRect(x + 0.1, y - 0.1, 0.2, 0.2);
    } else {
      // A fish treat.
      ellipse(ctx, x - 0.15, y, 0.7, 0.4);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x + 0.4, y);
      ctx.lineTo(x + 1, y - 0.45);
      ctx.lineTo(x + 1, y + 0.45);
      ctx.closePath();
      ctx.fill();
    }
  } else if (lk.pattern === "stripes" && lk === LOOKS.night && kind === 0) {
    // A garden lamp, lit.
    ctx.fillStyle = "rgba(255, 233, 138, 0.25)";
    circle(ctx, x, y, 0.95);
    ctx.fill();
    ctx.fillStyle = "#ffe98a";
    circle(ctx, x, y, 0.35);
    ctx.fill();
  } else if (kind === 0) {
    for (let n = 0; n < 4; n++) {
      circle(ctx, x + Math.cos((n * TAU) / 4) * 0.45, y + Math.sin((n * TAU) / 4) * 0.45, 0.32);
      ctx.fill();
    }
    ctx.fillStyle = "#ffd84a";
    circle(ctx, x, y, 0.25);
    ctx.fill();
  } else if (kind === 1) {
    ellipse(ctx, x, y, 0.8, 0.5);
    ctx.fill();
  } else {
    ctx.fillRect(x - 0.6, y - 0.6, 0.3, 1.2);
    ctx.fillRect(x - 0.1, y - 0.8, 0.3, 1.5);
    ctx.fillRect(x + 0.4, y - 0.5, 0.3, 1.1);
  }
}

/* ----------------------------------------------- drawn fresh each frame */

// The window of a list along the road in view (a little either side).
function* inView(v, list, key, pad = 6) {
  for (let k = v.firstAt(list, key, v.cam - pad); k < list.length; k++) {
    const e = list[k];
    if (e[key] > v.cam + v.g.FIELD_H + pad) return;
    yield e;
  }
}

// The timed sections: a drawbridge's span lifting (water showing between
// its two leaves), a swaying bridge where it is now, crumbled road gone to
// the pit and the rows about to go shaking.
export function drawTimed(ctx, v) {
  const { road } = v;
  const t = v.round.clock;
  for (let k = v.firstAt(road.dyn, "d1", v.cam - 4); k < road.dyn.length; k++) {
    const s = road.dyn[k];
    if (s.d0 > v.cam + v.g.FIELD_H + 4) break;
    const lk = lookOf(v.stageFor(road.stageOf[Math.min(road.rows - 1, Math.floor(s.d0 / ROW))]).id);
    const i0 = Math.floor(s.d0 / ROW);
    const L = road.L[i0];
    const R = road.R[i0];
    const top = v.yOf(s.d1);
    const bottom = v.yOf(s.d0);
    if (s.kind === "draw") {
      const lift = drawLift(s, t);
      // The lights on the posts: red while it lifts or will in a moment.
      const soon = (t + s.phase) % s.period > s.period - 700 || lift > 0;
      for (const x of [L - 1.6, R + 1.6]) {
        circle(ctx, x, bottom - 0.6, 0.6);
        ctx.fillStyle = soon && Math.floor(t / 180) % 2 ? "#ff4040" : "#5a1a1a";
        ctx.fill();
      }
      if (lift <= 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(L, top - 0.15, R - L, 0.3);
        ctx.fillRect(L, bottom - 0.15, R - L, 0.3);
        continue;
      }
      ctx.fillStyle = lk.water;
      ctx.fillRect(L, top, R - L, bottom - top);
      // The two leaves, standing up toward the middle as they lift: drawn
      // shorter and paler the higher they stand.
      const leaf = ((bottom - top) / 2) * (1 - 0.75 * lift);
      ctx.fillStyle = lk.plank;
      ctx.fillRect(L, bottom - leaf, R - L, leaf);
      ctx.fillRect(L, top, R - L, leaf);
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(L, bottom - leaf, R - L, 0.4);
      ctx.fillRect(L, top + leaf - 0.4, R - L, 0.4);
      ctx.fillStyle = "#ffd84a";
      for (let x = L; x < R - 1; x += 2) {
        ctx.fillRect(x, bottom - leaf + 0.4, 1, 0.5);
        ctx.fillRect(x + 1, top + leaf - 0.9, 1, 0.5);
      }
    } else if (s.kind === "sway") {
      const off = swayOff(s, t);
      const x0 = s.c - s.bw / 2 + off;
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(x0 + 0.8, top + 0.8, s.bw, bottom - top);
      ctx.fillStyle = lk.plank;
      ctx.fillRect(x0, top, s.bw, bottom - top);
      ctx.fillStyle = lk.seam;
      for (let y = top; y < bottom; y += 2) ctx.fillRect(x0, y, s.bw, 0.25);
      ctx.fillRect(x0, top, 0.5, bottom - top);
      ctx.fillRect(x0 + s.bw - 0.5, top, 0.5, bottom - top);
      // Ropes back to the banks, where it hangs from.
      ctx.strokeStyle = "#e6d3a3";
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(s.c - s.bw / 2, bottom + 1);
      ctx.lineTo(x0, bottom);
      ctx.moveTo(s.c + s.bw / 2, bottom + 1);
      ctx.lineTo(x0 + s.bw, bottom);
      ctx.moveTo(s.c - s.bw / 2, top - 1);
      ctx.lineTo(x0, top);
      ctx.moveTo(s.c + s.bw / 2, top - 1);
      ctx.lineTo(x0 + s.bw, top);
      ctx.stroke();
    } else if (s.kind === "crumble" && s.start !== null) {
      for (let d = Math.max(s.d0, v.cam - 2); d < Math.min(s.d1, v.cam + v.g.FIELD_H + 2); d += ROW) {
        const i = Math.floor(d / ROW);
        const left = crumbleAt(s, i * ROW + ROW / 2) - t;
        const y = v.yOf(i * ROW + ROW);
        if (left <= 0) {
          ctx.fillStyle = lk.hole;
          ctx.fillRect(road.L[i] - 0.2, y - 0.1, road.R[i] - road.L[i] + 0.4, ROW + 0.2);
          ctx.fillStyle = lk.rim;
          ctx.fillRect(road.L[i] + ((hash(i, 31) % 10) / 10) * (road.R[i] - road.L[i] - 3), y + 0.6, 2, 0.6);
        } else if (left < 450) {
          const j = Math.sin(t / 25 + i) * 0.25;
          ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
          ctx.fillRect(road.L[i] + j, y + 0.8, road.R[i] - road.L[i], 0.3);
        }
      }
    }
  }
}

// Boost strips (chevrons that run), ramps (a striped wedge up to its lip),
// conveyors (chevrons running sideways), spring pads (a round launcher) and
// slicks (a glossy pool).
export function drawPads(ctx, v) {
  const t = v.clock;
  for (const p of inView(v, v.road.pads, "d", 8)) {
    const y = v.yOf(p.d);
    const x0 = p.x - p.w / 2;
    const y0 = y - p.l / 2;
    if (p.kind === "boost") {
      roundRect(ctx, x0, y0, p.w, p.l, 0.6);
      ctx.fillStyle = "#123a52";
      ctx.fill();
      for (let n = 0; n < 3; n++) {
        const cy = y0 + p.l - 1.2 - n * 2.4;
        const lit = Math.floor(t / 110) % 3 === n;
        ctx.strokeStyle = lit ? "#ffffff" : "#38d6ff";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.w / 2 + 0.8, cy);
        ctx.lineTo(p.x, cy - 1.3);
        ctx.lineTo(p.x + p.w / 2 - 0.8, cy);
        ctx.stroke();
      }
    } else if (p.kind === "ramp" || p.kind === "kicker") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(x0 + 0.5, y0 + 0.6, p.w, p.l);
      ctx.fillStyle = "#c98a3c";
      ctx.fillRect(x0, y0, p.w, p.l);
      ctx.fillStyle = "#e6b25c";
      ctx.fillRect(x0, y0, p.w, p.l * 0.35);
      ctx.fillStyle = DARK_INK;
      for (let x = x0; x < x0 + p.w - 0.5; x += 2) ctx.fillRect(x, y0, 1, 0.6);
      ctx.fillStyle = "#ffd84a";
      ctx.beginPath();
      ctx.moveTo(p.x, y0 + 1);
      ctx.lineTo(p.x + 1.2, y0 + 2.6);
      ctx.lineTo(p.x - 1.2, y0 + 2.6);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === "belt") {
      // A conveyor right across the road: a dark rubber belt between two
      // striped rails, its chevrons running the way it carries you.
      ctx.fillStyle = "#23262e";
      ctx.fillRect(x0, y0, p.w, p.l);
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      for (let cy = y0 + 2; cy < y0 + p.l; cy += 4) ctx.fillRect(x0, cy, p.w, 2);
      const run = (((t / 1000) * 14 * p.dir) % 5 + 5) % 5;
      ctx.strokeStyle = "#ffb02e";
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      for (let cy = y0 + 2.2; cy < y0 + p.l - 1.2; cy += 4.2) {
        for (let cx = x0 + 1.2 + run; cx < x0 + p.w - 1.2; cx += 5) {
          ctx.moveTo(cx - p.dir * 0.8, cy - 1);
          ctx.lineTo(cx + p.dir * 0.4, cy);
          ctx.lineTo(cx - p.dir * 0.8, cy + 1);
        }
      }
      ctx.stroke();
      for (const ry of [y0, y0 + p.l - 0.7]) {
        ctx.fillStyle = "#8a8f99";
        ctx.fillRect(x0, ry, p.w, 0.7);
        ctx.fillStyle = DARK_INK;
        for (let cx = x0 + ((run * 0.5) % 2); cx < x0 + p.w - 0.9; cx += 2) ctx.fillRect(cx, ry + 0.15, 0.9, 0.4);
      }
    } else if (p.kind === "pop") {
      // A spring pad: a round launcher, its coil breathing and its arrow lit.
      const beat = 0.5 + 0.5 * Math.sin(t / 140);
      // A trampoline is a row of them right across the road.
      const n = Math.max(1, Math.round(p.w / 6.5));
      const rx = p.w / n / 2 - (n > 1 ? 0.25 : 0);
      const ry = n > 1 ? 2.5 : p.l / 2;
      for (let k = 0; k < n; k++) {
      const px = p.x - p.w / 2 + (p.w / n) * (k + 0.5);
      ellipse(ctx, px + 0.4, y + 0.5, rx, ry);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fill();
      ellipse(ctx, px, y, rx, ry);
      ctx.fillStyle = "#2b2f38";
      ctx.fill();
      ctx.strokeStyle = "#c9ccd2";
      ctx.lineWidth = 0.3;
      for (const k of [0.84, 0.66]) {
        ellipse(ctx, px, y, rx * (k + 0.05 * beat), ry * (k + 0.05 * beat));
        ctx.stroke();
      }
      ellipse(ctx, px, y, rx * (0.46 + 0.06 * beat), ry * (0.46 + 0.06 * beat));
      ctx.fillStyle = beat > 0.6 ? "#ff6b4a" : "#e8483c";
      ctx.fill();
      ctx.strokeStyle = DARK_INK;
      ctx.lineWidth = 0.2;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(px, y - ry * 0.34);
      ctx.lineTo(px + rx * 0.26, y + ry * 0.1);
      ctx.lineTo(px + rx * 0.1, y + ry * 0.1);
      ctx.lineTo(px + rx * 0.1, y + ry * 0.3);
      ctx.lineTo(px - rx * 0.1, y + ry * 0.3);
      ctx.lineTo(px - rx * 0.1, y + ry * 0.1);
      ctx.lineTo(px - rx * 0.26, y + ry * 0.1);
      ctx.closePath();
      ctx.fill();
      }
    } else {
      ellipse(ctx, p.x, y, p.w / 2, p.l / 2);
      ctx.fillStyle = "rgba(20, 16, 24, 0.82)";
      ctx.fill();
      ellipse(ctx, p.x - p.w * 0.12, y - p.l * 0.12, p.w * 0.22, p.l * 0.1);
      ctx.fillStyle = "rgba(160, 120, 255, 0.45)";
      ctx.fill();
      ellipse(ctx, p.x + p.w * 0.15, y + p.l * 0.15, p.w * 0.12, p.l * 0.06);
      ctx.fillStyle = "rgba(90, 255, 200, 0.35)";
      ctx.fill();
    }
  }
}

// A barrier or a dropped thing: a row of cones, a toy block, a pinball
// bumper, a flowerpot, a bucket, a barrel, a rock, an acorn or a tire. A
// knocked cone tumbles off and fades.
function drawBlock(ctx, v, b) {
  const t = v.round.clock;
  let y = v.yOf(b.d);
  let x = b.x;
  let alpha = 1;
  if (b.hit) {
    const p = Math.min(1, (t - b.hit) / 500);
    if (p >= 1) return;
    x += (b.side || 1) * p * 8;
    y -= p * 6;
    alpha = 1 - p;
  }
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * alpha;
  if (b.kind === "cone") {
    const n = Math.max(1, Math.round(b.w / 2.4));
    for (let k = 0; k < n; k++) {
      const cx = x - b.w / 2 + (b.w / n) * (k + 0.5);
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      circle(ctx, cx + 0.4, y + 0.4, 1.1);
      ctx.fill();
      ctx.fillStyle = "#ff7a1a";
      circle(ctx, cx, y, 1.05);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      circle(ctx, cx, y, 0.55);
      ctx.fill();
      ctx.fillStyle = "#ff7a1a";
      circle(ctx, cx, y, 0.3);
      ctx.fill();
    }
  } else if (b.kind === "tire") {
    drawDropped(ctx, "tire", x, y, b.w);
  } else if (b.kind === "bumper") {
    // A pinball bumper: a chrome skirt, a bright cap and its star, flashing
    // for a moment after a car comes off it.
    const r = b.w / 2;
    const lit = t - b.lit >= 0 && t - b.lit < 200;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    circle(ctx, x + 0.5, y + 0.6, r);
    ctx.fill();
    if (lit) {
      ctx.fillStyle = "rgba(255, 240, 150, 0.45)";
      circle(ctx, x, y, r * 1.5);
      ctx.fill();
    }
    circle(ctx, x, y, r);
    ctx.fillStyle = "#d9dce2";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    circle(ctx, x, y, r * 0.76);
    ctx.fillStyle = lit ? "#fff6c4" : "#e8483c";
    ctx.fill();
    ctx.stroke();
    star(ctx, x, y, r * 0.5, r * 0.22, v.clock / 900);
    ctx.fillStyle = lit ? "#ff8a1f" : "#ffd84a";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    circle(ctx, x - r * 0.4, y - r * 0.42, r * 0.14);
    ctx.fill();
  } else {
    const what = b.what || "block";
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    if (what === "barrel" || what === "rock") ellipse(ctx, x + 0.6, y + 0.7, b.w / 2, b.l / 2), ctx.fill();
    else ctx.fillRect(x - b.w / 2 + 0.6, y - b.l / 2 + 0.7, b.w, b.l);
    if (DROPPED.has(what)) drawDropped(ctx, what, x, y, Math.min(b.w, b.l));
    else {
      // A row of toy blocks, each with a letter's worth of trim.
      const n = Math.max(1, Math.round(b.w / 3));
      const cols = ["#e8483c", "#3a6df0", "#ffd21f", "#2fbf71"];
      for (let k = 0; k < n; k++) {
        const bx = x - b.w / 2 + (b.w / n) * k;
        ctx.fillStyle = cols[(k + Math.round(b.d)) % 4];
        ctx.fillRect(bx, y - b.l / 2, b.w / n - 0.15, b.l);
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fillRect(bx + 0.5, y - b.l / 2 + 0.5, b.w / n - 1.15, 0.4);
        ctx.strokeStyle = DARK_INK;
        ctx.lineWidth = 0.2;
        ctx.strokeRect(bx, y - b.l / 2, b.w / n - 0.15, b.l);
      }
    }
  }
  ctx.globalAlpha = was;
}

// A flowerpot, a bucket, an oil barrel, a rock, a tire or an acorn, seen
// from above, `size` across.
const DROPPED = new Set(["pot", "bucket", "acorn", "barrel", "rock", "tire"]);
export function drawDropped(ctx, what, x, y, size) {
  const r = size / 2;
  if (what === "barrel") {
    // An oil drum on its end: the rim, the lid's ring, its bung and a
    // warning mark.
    circle(ctx, x, y, r);
    ctx.fillStyle = "#b3261e";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    circle(ctx, x, y, r * 0.8);
    ctx.fillStyle = "#e8483c";
    ctx.fill();
    ctx.strokeStyle = "#7a1712";
    ctx.lineWidth = 0.2;
    ctx.stroke();
    circle(ctx, x, y, r * 0.48);
    ctx.stroke();
    ctx.fillStyle = "#ffd84a";
    ctx.beginPath();
    ctx.moveTo(x, y - r * 0.34);
    ctx.lineTo(x + r * 0.32, y + r * 0.22);
    ctx.lineTo(x - r * 0.32, y + r * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2b2f38";
    circle(ctx, x + r * 0.5, y - r * 0.38, r * 0.13);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    circle(ctx, x - r * 0.42, y - r * 0.42, r * 0.16);
    ctx.fill();
  } else if (what === "rock") {
    // A lump of rock: a rough outline, a lit face and a crack.
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k * TAU) / 8;
      const rr = r * (k % 2 ? 0.82 : 1) * (k === 3 ? 0.9 : 1);
      if (k) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fillStyle = "#6d6a72";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    ctx.fillStyle = "#96929c";
    ctx.beginPath();
    ctx.moveTo(x - r * 0.55, y - r * 0.15);
    ctx.lineTo(x - r * 0.1, y - r * 0.6);
    ctx.lineTo(x + r * 0.35, y - r * 0.3);
    ctx.lineTo(x - r * 0.1, y + r * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(x + r * 0.05, y + r * 0.2, r * 0.5, r * 0.1);
  } else if (what === "tire") {
    circle(ctx, x, y, r);
    ctx.fillStyle = "#1c1c20";
    ctx.fill();
    circle(ctx, x, y, r / 2);
    ctx.fillStyle = "#8a8f99";
    ctx.fill();
  } else if (what === "pot") {
    circle(ctx, x, y, r);
    ctx.fillStyle = "#c4643a";
    ctx.fill();
    circle(ctx, x, y, r * 0.78);
    ctx.fillStyle = "#5a3d26";
    ctx.fill();
    ctx.fillStyle = "#3e8a3a";
    for (let k = 0; k < 5; k++) {
      ellipse(ctx, x + Math.cos((k * TAU) / 5) * r * 0.4, y + Math.sin((k * TAU) / 5) * r * 0.4, r * 0.32, r * 0.18);
      ctx.fill();
    }
    ctx.fillStyle = "#ff4fa3";
    circle(ctx, x, y, r * 0.22);
    ctx.fill();
  } else if (what === "bucket") {
    circle(ctx, x, y, r);
    ctx.fillStyle = "#e8483c";
    ctx.fill();
    circle(ctx, x, y, r * 0.75);
    ctx.fillStyle = "#e8cf8f";
    ctx.fill();
    ctx.strokeStyle = "#ffd84a";
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ellipse(ctx, x, y + r * 0.15, r * 0.8, r);
    ctx.fillStyle = "#a8743c";
    ctx.fill();
    ellipse(ctx, x, y - r * 0.4, r * 0.9, r * 0.5);
    ctx.fillStyle = "#6a4524";
    ctx.fill();
  }
}

export function drawBlocks(ctx, v) {
  for (const b of inView(v, v.road.blocks, "d", 10)) drawBlock(ctx, v, b);
  for (const b of v.round.drops) {
    const y = v.yOf(b.d);
    if (y > -6 && y < v.g.FIELD_H + 6) drawBlock(ctx, v, b);
  }
}

// The stars to take: gold, turning, bobbing a little.
export function drawStars(ctx, v) {
  for (const s of inView(v, v.road.stars, "d", 3)) {
    if (s.taken) continue;
    const y = v.yOf(s.d) - 0.25 * Math.sin(v.clock / 200 + s.d);
    star(ctx, s.x, y, 1.15, 0.5, v.clock / 600 + s.d);
    ctx.fillStyle = "#ffd21f";
    ctx.fill();
    ctx.strokeStyle = "#7a4a00";
    ctx.lineWidth = 0.2;
    ctx.stroke();
  }
}

// A sign on the verge before something to watch for: a yellow diamond with
// a mark for what it is (a hole, a train, a gust, a ball, crumbling road, a
// chicane, a swaying bridge, a conveyor, bumpers, a laser or a stomper).
export function drawSigns(ctx, v) {
  for (const s of inView(v, v.road.signs, "d", 4)) {
    const y = v.yOf(s.d);
    ctx.fillStyle = "#5a4a3a";
    ctx.fillRect(s.x - 0.2, y, 0.4, 2.4);
    ctx.beginPath();
    ctx.moveTo(s.x, y - 1.8);
    ctx.lineTo(s.x + 1.6, y);
    ctx.lineTo(s.x, y + 1.6);
    ctx.lineTo(s.x - 1.6, y);
    ctx.closePath();
    ctx.fillStyle = s.kind === "train" ? "#ffffff" : "#ffd84a";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    ctx.fillStyle = DARK_INK;
    ctx.strokeStyle = DARK_INK;
    if (s.kind === "train") {
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(s.x - 0.8, y - 0.8);
      ctx.lineTo(s.x + 0.8, y + 0.8);
      ctx.moveTo(s.x + 0.8, y - 0.8);
      ctx.lineTo(s.x - 0.8, y + 0.8);
      ctx.stroke();
    } else if (s.kind === "ball") {
      circle(ctx, s.x, y, 0.6);
      ctx.fill();
    } else if (s.kind === "wind") {
      ctx.fillRect(s.x - 0.8, y - 0.5, 1.6, 0.25);
      ctx.fillRect(s.x - 0.5, y, 1.3, 0.25);
      ctx.fillRect(s.x - 0.8, y + 0.5, 1.1, 0.25);
    } else if (s.kind === "crumble" || s.kind === "chicane" || s.kind === "sway") {
      ctx.lineWidth = 0.25;
      ctx.beginPath();
      ctx.moveTo(s.x - 0.7, y + 0.7);
      ctx.lineTo(s.x - 0.2, y - 0.2);
      ctx.lineTo(s.x + 0.2, y + 0.3);
      ctx.lineTo(s.x + 0.7, y - 0.7);
      ctx.stroke();
    } else if (s.kind === "belt") {
      // Two arrows, one each way.
      for (const [dir, ay] of [[1, -0.4], [-1, 0.4]]) {
        ctx.fillRect(s.x - 0.7, y + ay - 0.12, 1.4, 0.24);
        ctx.beginPath();
        ctx.moveTo(s.x + dir * 1, y + ay);
        ctx.lineTo(s.x + dir * 0.4, y + ay - 0.4);
        ctx.lineTo(s.x + dir * 0.4, y + ay + 0.4);
        ctx.closePath();
        ctx.fill();
      }
    } else if (s.kind === "bumper") {
      // A ring with its cap.
      ctx.lineWidth = 0.25;
      circle(ctx, s.x, y, 0.7);
      ctx.stroke();
      circle(ctx, s.x, y, 0.3);
      ctx.fill();
    } else if (s.kind === "laser") {
      // A beam between two posts.
      ctx.fillRect(s.x - 1, y - 0.4, 0.35, 0.8);
      ctx.fillRect(s.x + 0.65, y - 0.4, 0.35, 0.8);
      ctx.fillStyle = "#e8483c";
      ctx.fillRect(s.x - 0.65, y - 0.14, 1.3, 0.28);
    } else if (s.kind === "stomper") {
      // An arrow down onto the road.
      ctx.fillRect(s.x - 0.15, y - 0.95, 0.3, 0.8);
      ctx.beginPath();
      ctx.moveTo(s.x, y + 0.45);
      ctx.lineTo(s.x - 0.6, y - 0.3);
      ctx.lineTo(s.x + 0.6, y - 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillRect(s.x - 0.85, y + 0.6, 1.7, 0.25);
    } else {
      ctx.fillRect(s.x - 0.15, y - 0.9, 0.3, 1);
      ctx.fillRect(s.x - 0.15, y + 0.35, 0.3, 0.3);
    }
  }
}

// A power-up's mark, about (x, y) for a pickup `r` round: a coil, a bubble,
// a wheel, a rocket, a drop of oil, an arrow down onto the road, a bolt in
// a ring of sparks, a horseshoe magnet, a heart, and a plain bolt for Nitro.
export function itemMark(ctx, kind, x, y, r) {
  const s = r / 1.8;
  ctx.strokeStyle = DARK_INK;
  ctx.fillStyle = DARK_INK;
  ctx.lineWidth = 0.28 * s;
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (kind === "spring") {
    ctx.moveTo(x - 0.8 * s, y + 0.9 * s);
    for (let n = 0; n < 4; n++) ctx.lineTo(x + (n % 2 ? -0.8 : 0.8) * s, y + (0.9 - (n + 1) * 0.45) * s);
    ctx.stroke();
  } else if (kind === "bubble") {
    ctx.arc(x, y, r * 0.55, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    circle(ctx, x - 0.4 * s, y - 0.4 * s, 0.3 * s);
    ctx.fill();
  } else if (kind === "mega") {
    ctx.arc(x, y, r * 0.6, 0, TAU);
    ctx.stroke();
    circle(ctx, x, y, r * 0.25);
    ctx.fill();
  } else if (kind === "rocket") {
    ctx.moveTo(x, y - 1.15 * s);
    ctx.lineTo(x + 0.45 * s, y - 0.4 * s);
    ctx.lineTo(x + 0.45 * s, y + 0.45 * s);
    ctx.lineTo(x + 0.95 * s, y + 1.05 * s);
    ctx.lineTo(x - 0.95 * s, y + 1.05 * s);
    ctx.lineTo(x - 0.45 * s, y + 0.45 * s);
    ctx.lineTo(x - 0.45 * s, y - 0.4 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    circle(ctx, x, y - 0.2 * s, 0.24 * s);
    ctx.fill();
  } else if (kind === "oil") {
    ctx.moveTo(x, y - 1.15 * s);
    ctx.lineTo(x + 0.68 * s, y + 0.15 * s);
    ctx.lineTo(x - 0.68 * s, y + 0.15 * s);
    ctx.closePath();
    ctx.fill();
    circle(ctx, x, y + 0.3 * s, 0.72 * s);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    circle(ctx, x - 0.28 * s, y + 0.3 * s, 0.2 * s);
    ctx.fill();
  } else if (kind === "pound") {
    ctx.moveTo(x - 0.28 * s, y - 1.1 * s);
    ctx.lineTo(x + 0.28 * s, y - 1.1 * s);
    ctx.lineTo(x + 0.28 * s, y - 0.2 * s);
    ctx.lineTo(x + 0.8 * s, y - 0.2 * s);
    ctx.lineTo(x, y + 0.6 * s);
    ctx.lineTo(x - 0.8 * s, y - 0.2 * s);
    ctx.lineTo(x - 0.28 * s, y - 0.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - 1.05 * s, y + 0.78 * s, 2.1 * s, 0.26 * s);
  } else if (kind === "zap") {
    ctx.moveTo(x + 0.25 * s, y - 1.15 * s);
    ctx.lineTo(x - 0.55 * s, y + 0.1 * s);
    ctx.lineTo(x - 0.05 * s, y + 0.1 * s);
    ctx.lineTo(x - 0.3 * s, y + 1.15 * s);
    ctx.lineTo(x + 0.55 * s, y - 0.2 * s);
    ctx.lineTo(x + 0.05 * s, y - 0.2 * s);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    for (const side of [-1, 1]) {
      ctx.moveTo(x + side * 0.85 * s, y - 0.55 * s);
      ctx.lineTo(x + side * 1.15 * s, y - 0.8 * s);
      ctx.moveTo(x + side * 0.95 * s, y + 0.1 * s);
      ctx.lineTo(x + side * 1.3 * s, y + 0.1 * s);
      ctx.moveTo(x + side * 0.85 * s, y + 0.7 * s);
      ctx.lineTo(x + side * 1.15 * s, y + 0.95 * s);
    }
    ctx.stroke();
  } else if (kind === "magnet") {
    ctx.lineWidth = 0.55 * s;
    ctx.arc(x, y - 0.15 * s, 0.68 * s, Math.PI, 0);
    ctx.lineTo(x + 0.68 * s, y + 0.5 * s);
    ctx.moveTo(x - 0.68 * s, y - 0.15 * s);
    ctx.lineTo(x - 0.68 * s, y + 0.5 * s);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x - 0.96 * s, y + 0.5 * s, 0.56 * s, 0.42 * s);
    ctx.fillRect(x + 0.4 * s, y + 0.5 * s, 0.56 * s, 0.42 * s);
  } else if (kind === "heart") {
    ctx.fillStyle = "#ffffff";
    ctx.moveTo(x, y + 1 * s);
    ctx.lineTo(x - 1.02 * s, y - 0.12 * s);
    ctx.lineTo(x + 1.02 * s, y - 0.12 * s);
    ctx.closePath();
    ctx.fill();
    for (const side of [-1, 1]) {
      circle(ctx, x + side * 0.5 * s, y - 0.32 * s, 0.56 * s);
      ctx.fill();
    }
  } else {
    ctx.moveTo(x - 0.3 * s, y - 1 * s);
    ctx.lineTo(x + 0.7 * s, y - 0.1 * s);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 0.3 * s, y + 1 * s);
    ctx.lineTo(x - 0.7 * s, y + 0.1 * s);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.fill();
  }
}

// A pickup about (x, y), `r` round, in `color`: a gadget (one held and set
// off later) is a square crate with strapped corners, the rest a round
// token, each with its mark.
export function drawPickup(ctx, kind, x, y, r, color, gadget) {
  if (gadget) {
    roundRect(ctx, x - r, y - r, r * 2, r * 2, r * 0.25);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = r * 0.17;
    ctx.stroke();
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) ctx.fillRect(x + sx * r * 0.8 - r * 0.15, y + sy * r * 0.8 - r * 0.15, r * 0.3, r * 0.3);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.fillRect(x - r * 0.5, y - r * 0.86, r, r * 0.14);
  } else {
    circle(ctx, x, y, r);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = r * 0.17;
    ctx.stroke();
  }
  itemMark(ctx, kind, x, y, gadget ? r * 0.94 : r);
}

// The power-ups lying on the road, bobbing: the round ones work as they are
// taken, a crate is a gadget to hold.
export function drawItems(ctx, v) {
  const r = v.g.ITEM_R;
  for (const it of inView(v, v.road.items, "d", 4)) {
    if (it.taken) continue;
    const y = v.yOf(it.d) - 0.3 * Math.sin(v.clock / 220 + it.d);
    const spec = v.powers[it.kind];
    if (!spec) continue;
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ellipse(ctx, it.x + 0.4, v.yOf(it.d) + 0.8, r * 0.9, r * 0.5);
    ctx.fill();
    drawPickup(ctx, it.kind, it.x, y, r, spec.color, !!spec.uses);
  }
}

// A ball rolling across, `r` round at (bx, y), drawn as what the stage
// rolls: an orange (the plain one), a steel pinball, a snowball, a ball of
// yarn or a toy ball. Its marks turn with `roll`.
function drawBall(ctx, what, bx, y, r, roll) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ellipse(ctx, bx + 0.8, y + 0.9, r, r * 0.8);
  ctx.fill();
  const chord = (off) => Math.sqrt(Math.max(0, r * r - off * off));
  circle(ctx, bx, y, r);
  if (what === "steel") {
    ctx.fillStyle = "#aab3c0";
    ctx.fill();
    ctx.strokeStyle = "#4a515e";
    ctx.lineWidth = 0.3;
    ctx.stroke();
    circle(ctx, bx + r * 0.15, y + r * 0.2, r * 0.7);
    ctx.fillStyle = "#7d8796";
    ctx.fill();
    circle(ctx, bx - r * 0.1, y - r * 0.1, r * 0.62);
    ctx.fillStyle = "#d9dfe8";
    ctx.fill();
    // A glint that slides as it rolls.
    ctx.fillStyle = "#ffffff";
    circle(ctx, bx - r * 0.3 + Math.sin(roll) * r * 0.15, y - r * 0.4, r * 0.2);
    ctx.fill();
    return;
  }
  if (what === "snow") {
    ctx.fillStyle = "#f4fbff";
    ctx.fill();
    ctx.strokeStyle = "#8fb4cc";
    ctx.lineWidth = 0.25;
    ctx.stroke();
    ctx.fillStyle = "#c4e1f2";
    for (let k = 0; k < 4; k++) {
      const a = roll + (k * TAU) / 4;
      circle(ctx, bx + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.5, r * (0.16 + (k % 2) * 0.08));
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    circle(ctx, bx - r * 0.35, y - r * 0.35, r * 0.25);
    ctx.fill();
    return;
  }
  if (what === "yarn") {
    ctx.fillStyle = "#ff7eb6";
    ctx.fill();
    ctx.strokeStyle = "#a83a72";
    ctx.lineWidth = 0.25;
    ctx.stroke();
    // The wound strands, turning with it, and a loose end trailing.
    ctx.strokeStyle = "#ffc2dd";
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const off = Math.sin(roll + (k * TAU) / 3) * r * 0.7;
      ctx.moveTo(bx + off, y - chord(off) * 0.9);
      ctx.lineTo(bx + off, y + chord(off) * 0.9);
      ctx.moveTo(bx - chord(off) * 0.9, y + off * 0.8);
      ctx.lineTo(bx + chord(off) * 0.9, y - off * 0.5);
    }
    ctx.stroke();
    ctx.strokeStyle = "#ff7eb6";
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(bx, y + r);
    ctx.lineTo(bx - Math.sin(roll) * r * 0.6, y + r * 1.35);
    ctx.lineTo(bx + Math.cos(roll) * r * 0.4, y + r * 1.6);
    ctx.stroke();
    return;
  }
  if (what === "ball") {
    // A toy ball in four colored panels, turning.
    const cols = ["#e8483c", "#ffd21f", "#3a6df0", "#f4f1ea"];
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.moveTo(bx, y);
      ctx.arc(bx, y, r, roll + (k * TAU) / 4, roll + ((k + 1) * TAU) / 4);
      ctx.closePath();
      ctx.fillStyle = cols[k];
      ctx.fill();
    }
    circle(ctx, bx, y, r);
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    circle(ctx, bx, y, r * 0.2);
    ctx.fillStyle = "#f4f1ea";
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
    circle(ctx, bx - r * 0.35, y - r * 0.35, r * 0.25);
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#ff8a1f";
  ctx.fill();
  // Stripes that roll with it.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 0.5;
  for (let k = 0; k < 2; k++) {
    const off = Math.sin(roll + k * Math.PI) * r * 0.75;
    ctx.beginPath();
    ctx.moveTo(bx + off, y - chord(off));
    ctx.lineTo(bx + off, y + chord(off));
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
  circle(ctx, bx - r * 0.35, y - r * 0.35, r * 0.25);
  ctx.fill();
}

// A long thing rolling across the road on its side, `2 * half` long and
// `2 * r` thick with its middle at (bx, y): a rolling pin, a pencil or a
// burning log. It is a crash, so it is drawn solid: a hard shadow, a dark
// edge all round, and a red line under its leading side.
function drawRoller(ctx, h, bx, y, t) {
  const x0 = bx - h.half;
  const w = h.half * 2;
  const r = h.r;
  const roll = (bx / r) % TAU;
  ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
  ctx.fillRect(x0 + 0.7, y - r + 0.9, w, r * 2);
  // The lines along it that turn as it rolls.
  const turns = (color, lw, x1, x2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = roll + (k * TAU) / 3;
      if (Math.cos(a) < -0.2) continue;
      ctx.moveTo(x1, y + Math.sin(a) * r * 0.8);
      ctx.lineTo(x2, y + Math.sin(a) * r * 0.8);
    }
    ctx.stroke();
  };
  if (h.what === "pencil") {
    const e0 = x0 + w * 0.1;
    const t0 = x0 + w * 0.86;
    ctx.fillStyle = "#ff8fa8";
    roundRect(ctx, x0, y - r, w * 0.1 + 0.2, r * 2, r * 0.5);
    ctx.fill();
    ctx.fillStyle = "#b8c2cc";
    ctx.fillRect(e0, y - r, w * 0.05, r * 2);
    ctx.fillStyle = "#ffc928";
    ctx.fillRect(e0 + w * 0.05, y - r, t0 - e0 - w * 0.05, r * 2);
    turns("#d99a0a", 0.22, e0 + w * 0.05, t0);
    ctx.fillStyle = "#e6c49a";
    ctx.beginPath();
    ctx.moveTo(t0, y - r);
    ctx.lineTo(x0 + w, y);
    ctx.lineTo(t0, y + r);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = DARK_INK;
    ctx.beginPath();
    ctx.moveTo(x0 + w * 0.955, y - r * 0.33);
    ctx.lineTo(x0 + w, y);
    ctx.lineTo(x0 + w * 0.955, y + r * 0.33);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(x0 + 0.3, y - r);
    ctx.lineTo(t0, y - r);
    ctx.lineTo(x0 + w, y);
    ctx.lineTo(t0, y + r);
    ctx.lineTo(x0 + 0.3, y + r);
    ctx.closePath();
    ctx.stroke();
  } else if (h.what === "ember") {
    // A burning log: a glow round it, charred bark with lit cracks, and
    // flames along its top, flickering.
    ctx.fillStyle = "rgba(255, 120, 30, 0.22)";
    ellipse(ctx, bx, y, h.half + 1.2, r + 1.4);
    ctx.fill();
    roundRect(ctx, x0, y - r, w, r * 2, r * 0.6);
    ctx.fillStyle = "#3a2418";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.28;
    ctx.stroke();
    turns("#ff7a1a", 0.3, x0 + 1, x0 + w - 1);
    ctx.fillStyle = "#ffd84a";
    for (let k = 0; k < 5; k++) ctx.fillRect(x0 + 1 + ((hash(k, 41) % 100) / 100) * (w - 2.6), y - r * 0.5 + (k % 3) * r * 0.4, 0.6, 0.3);
    for (let k = 0; k < 6; k++) {
      const fx = x0 + 1 + (k + 0.5) * ((w - 2) / 6);
      const tall = r * (0.8 + 0.5 * Math.sin(t / 70 + k * 1.9) * Math.sin(t / 43 + k));
      ctx.fillStyle = k % 2 ? "#ff8a1f" : "#ffb02e";
      ctx.beginPath();
      ctx.moveTo(fx - 0.7, y - r * 0.6);
      ctx.lineTo(fx + Math.sin(t / 90 + k) * 0.3, y - r * 0.6 - tall);
      ctx.lineTo(fx + 0.7, y - r * 0.6);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // A rolling pin: its barrel between two handles.
    ctx.fillStyle = "#8a5a30";
    roundRect(ctx, x0, y - r * 0.42, w, r * 0.84, r * 0.4);
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25;
    ctx.stroke();
    roundRect(ctx, x0 + w * 0.15, y - r, w * 0.7, r * 2, r * 0.55);
    ctx.fillStyle = "#e0b276";
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.28;
    ctx.stroke();
    turns("#b98447", 0.22, x0 + w * 0.18, x0 + w * 0.82);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(x0 + w * 0.2, y - r * 0.72, w * 0.6, r * 0.3);
  }
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(x0 + 0.4, y + r + 0.1, w - 0.8, 0.3);
}

// A stomper, `k` times its size, its middle at (x, y): a heavy book (its
// cover, spine, pages and a title) or a mallet's head with its handle
// running off toward the nearer side of the field.
function drawStomper(ctx, h, x, y, k) {
  const w = h.w * k;
  const l = h.l * k;
  if (h.what === "mallet") {
    const side = h.x < FIELD_W / 2 ? -1 : 1;
    ctx.fillStyle = "#b07a45";
    ctx.fillRect(side > 0 ? x : x - w * 1.6, y - l * 0.09, w * 1.6, l * 0.18);
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.25 * k;
    ctx.strokeRect(side > 0 ? x : x - w * 1.6, y - l * 0.09, w * 1.6, l * 0.18);
    roundRect(ctx, x - w / 2, y - l / 2, w, l, Math.min(w, l) * 0.18);
    ctx.fillStyle = "#c0392b";
    ctx.fill();
    ctx.lineWidth = 0.3 * k;
    ctx.stroke();
    ctx.fillStyle = "#ffd84a";
    ctx.fillRect(x - w / 2 + 0.15 * k, y - l * 0.36, w - 0.3 * k, l * 0.1);
    ctx.fillRect(x - w / 2 + 0.15 * k, y + l * 0.26, w - 0.3 * k, l * 0.1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(x - w * 0.36, y - l * 0.2, w * 0.2, l * 0.4);
    return;
  }
  roundRect(ctx, x - w / 2, y - l / 2, w, l, 0.5 * k);
  ctx.fillStyle = "#f4f1ea";
  ctx.fill();
  roundRect(ctx, x - w / 2, y - l / 2, w - 0.5 * k, l - 0.4 * k, 0.5 * k);
  ctx.fillStyle = "#3a57c9";
  ctx.fill();
  ctx.fillStyle = "#24388a";
  ctx.fillRect(x - w / 2, y - l / 2 + 0.25 * k, w * 0.12, l - 0.9 * k);
  ctx.fillStyle = "#ffd84a";
  ctx.fillRect(x - w * 0.24, y - l * 0.26, w * 0.52, l * 0.09);
  ctx.fillRect(x - w * 0.16, y - l * 0.1, w * 0.36, l * 0.06);
  roundRect(ctx, x - w / 2, y - l / 2, w, l, 0.5 * k);
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = 0.3 * k;
  ctx.stroke();
}

// The laser gates: a post each side of the road, blinking before the beam
// comes on, then a bright red beam with a glow between them. Drawn with the
// hazards under the cars, and once more over the dark of a stage with its
// lights out, so a beam never hides in it.
export function drawBeams(ctx, v) {
  const t = v.round.clock;
  for (const h of inView(v, v.road.hazards, "d", 70)) {
    if (h.kind !== "laser") continue;
    const y = v.yOf(h.d);
    if (y < -4 || y > v.g.FIELD_H + 4) continue;
    const lz = laserAt(h, t);
    const blink = Math.floor(t / 90) % 2 === 0;
    if (lz.on) {
      const flick = 0.75 + 0.25 * Math.sin(t / 23);
      ctx.fillStyle = `rgba(255, 40, 40, ${0.22 * flick})`;
      ctx.fillRect(h.x0, y - h.half - 0.9, h.x1 - h.x0, h.half * 2 + 1.8);
      ctx.fillStyle = "#ff2d2d";
      ctx.fillRect(h.x0, y - h.half * 0.62, h.x1 - h.x0, h.half * 1.24);
      ctx.fillStyle = "#ffd6d6";
      ctx.fillRect(h.x0, y - h.half * 0.2 * flick, h.x1 - h.x0, h.half * 0.4 * flick);
    } else if (lz.warn && blink) {
      // A thin dotted line where the beam is about to be.
      ctx.fillStyle = "rgba(255, 60, 60, 0.75)";
      for (let x = h.x0 + 1; x < h.x1 - 1; x += 2.4) ctx.fillRect(x, y - 0.12, 1.2, 0.24);
    }
    for (const x of [h.x0, h.x1]) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(x - 0.7, y - 0.9, 1.9, 2.3);
      roundRect(ctx, x - 1, y - 1.3, 2, 2.6, 0.5);
      ctx.fillStyle = "#3a3d44";
      ctx.fill();
      ctx.strokeStyle = DARK_INK;
      ctx.lineWidth = 0.22;
      ctx.stroke();
      circle(ctx, x, y, 0.6);
      ctx.fillStyle = lz.on || (lz.warn && blink) ? "#ff3b3b" : "#5a1a1a";
      ctx.fill();
      if (lz.on) {
        ctx.fillStyle = "#ffffff";
        circle(ctx, x, y, 0.25);
        ctx.fill();
      }
    }
  }
}

// The hazards under the cars: the crossing lights and a train, a ball or a
// roller on its way across, a laser gate, a falling thing's shadow growing
// where it will land, and a stomper's shadow, then the stomper itself once
// it sits on the road.
export function drawHazardsLow(ctx, v) {
  const t = v.round.clock;
  for (const h of inView(v, v.road.hazards, "d", 70)) {
    const y = v.yOf(h.d);
    if (h.kind === "train") {
      const tr = trainAt(h, t);
      for (const x of [1.4, v.g.FIELD_W - 1.4]) {
        circle(ctx, x, y + h.half + 1.2, 0.7);
        ctx.fillStyle = tr.warn && Math.floor(t / 200) % 2 ? "#ff3b3b" : "#4a1414";
        ctx.fill();
      }
      if (!tr.on) {
        // Arrows on the crossing while the train is coming, pointing its way.
        if (tr.warn && Math.floor(t / 200) % 2) {
          ctx.fillStyle = "#ff3b3b";
          const ax = h.dir > 0 ? 4 : v.g.FIELD_W - 4;
          ctx.beginPath();
          ctx.moveTo(ax + h.dir * 1.6, y);
          ctx.lineTo(ax, y - 1.2);
          ctx.lineTo(ax, y + 1.2);
          ctx.closePath();
          ctx.fill();
        }
        continue;
      }
      drawTrain(ctx, h, tr, y);
    } else if (h.kind === "ball") {
      const bx = ballX(h, t);
      drawBall(ctx, h.what, bx, y, h.r, (bx / h.r) % TAU);
    } else if (h.kind === "roller") {
      drawRoller(ctx, h, ballX(h, t), y, t);
    } else if (h.kind === "stomper") {
      const st = stomperAt(h, t);
      if (st.down) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(h.x - h.w / 2 + 0.7, y - h.l / 2 + 0.9, h.w, h.l);
        drawStomper(ctx, h, h.x, y, 1);
      } else if (st.fall > 0) {
        const p = st.fall;
        roundRect(ctx, h.x - (h.w / 2) * (0.4 + 0.6 * p), y - (h.l / 2) * (0.4 + 0.6 * p), h.w * (0.4 + 0.6 * p), h.l * (0.4 + 0.6 * p), 0.6);
        ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.35 * p})`;
        ctx.fill();
        roundRect(ctx, h.x - h.w / 2 - 0.5, y - h.l / 2 - 0.5, h.w + 1, h.l + 1, 0.8);
        ctx.strokeStyle = Math.floor(t / 120) % 2 ? "#ff3b3b" : "#ffffff";
        ctx.lineWidth = 0.35;
        ctx.stroke();
      } else {
        // At rest, up out of sight: a faint mark of where it comes down.
        roundRect(ctx, h.x - h.w / 2, y - h.l / 2, h.w, h.l, 0.6);
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fill();
      }
    } else if (h.kind === "drop" && h.at && !h.landed) {
      const p = Math.max(0, Math.min(1, 1 - (h.at - t) / DROP_FALL_MS));
      ellipse(ctx, h.x, y, (h.w / 2) * (0.4 + 0.6 * p), (h.l / 2) * (0.4 + 0.6 * p));
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.35 * p})`;
      ctx.fill();
      ellipse(ctx, h.x, y, h.w / 2 + 0.6, h.l / 2 + 0.6);
      ctx.strokeStyle = Math.floor(t / 120) % 2 ? "#ff3b3b" : "#ffffff";
      ctx.lineWidth = 0.35;
      ctx.stroke();
    } else if (h.kind === "sprinkler") {
      circle(ctx, h.x, y, 1);
      ctx.fillStyle = "#4a4e54";
      ctx.fill();
      circle(ctx, h.x, y, 0.45);
      ctx.fillStyle = "#c9ccd2";
      ctx.fill();
    }
  }
  drawBeams(ctx, v);
}

// A toy train: an engine and its cars across the track.
function drawTrain(ctx, h, tr, y) {
  const top = y - h.half + 0.2;
  const tall = h.half * 2 - 0.4;
  const cars = Math.max(2, Math.round(h.len / 14));
  const each = h.len / cars;
  const colors = ["#e8483c", "#3a6df0", "#ffd21f", "#2fbf71"];
  for (let k = 0; k < cars; k++) {
    // From the head back.
    const x1 = h.dir > 0 ? tr.x1 - k * each : tr.x0 + (k + 1) * each;
    const x0 = x1 - each + 0.6;
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x0 + 0.5, top + 0.6, each - 0.6, tall);
    ctx.fillStyle = k === 0 ? "#2b2f38" : colors[k % 4];
    roundRect(ctx, x0, top, each - 0.6, tall, 0.6);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ctx.fillRect(x0 + 0.6, top + 0.5, each - 1.8, 0.5);
    if (k === 0) {
      // The engine's boiler and a puff of smoke.
      ctx.fillStyle = "#e8483c";
      circle(ctx, h.dir > 0 ? x1 - 2.2 : x0 + 1.6, y, 1.1);
      ctx.fill();
      ctx.fillStyle = "rgba(240, 240, 240, 0.7)";
      circle(ctx, h.dir > 0 ? x1 - 4 : x0 + 3.4, y - 1.8, 1.2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#1c1c20";
      ctx.fillRect(x1 - 0.6, y - 0.2, 0.6, 0.4);
    }
  }
}

// The hazards over the cars: a sprinkler's jet and its drops, a gust's
// streaks blowing across, and a thing still falling or a stomper on its
// way down (big and high).
export function drawHazardsHigh(ctx, v) {
  const t = v.round.clock;
  for (const h of inView(v, v.road.hazards, "d", 70)) {
    if (h.kind === "sprinkler") {
      const s = sprayAt(h, t);
      const x0 = s.x0;
      const y0 = v.yOf(s.d0);
      const x1 = s.x1;
      const y1 = v.yOf(s.d1);
      ctx.strokeStyle = "rgba(190, 230, 255, 0.55)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.fillStyle = "#e8f6ff";
      for (let k = 1; k <= 9; k++) {
        const f = (k / 9 + (t / 600) % (1 / 9)) % 1;
        circle(ctx, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f + Math.sin(k + t / 90) * 0.4, 0.3);
        ctx.fill();
      }
    } else if (h.kind === "wind") {
      const g = gustAt(h, t);
      if (g <= 0) continue;
      const y0 = Math.max(0, v.yOf(h.d1));
      const y1 = Math.min(v.g.FIELD_H, v.yOf(h.d));
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.45 * g})`;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      for (let k = 0; k < 14; k++) {
        const y = y0 + ((hash(k, 7) / 997) * (y1 - y0));
        const x = (((hash(k, 3) * 0.13 + (h.dir * t) / 30) % FIELD_W) + FIELD_W) % FIELD_W;
        ctx.moveTo(x, y);
        ctx.lineTo(x - h.dir * 5, y);
      }
      ctx.stroke();
    } else if (h.kind === "stomper") {
      const st = stomperAt(h, t);
      if (st.down || st.fall <= 0) continue;
      const p = st.fall;
      const was = ctx.globalAlpha;
      ctx.globalAlpha = was * Math.min(1, p * 3);
      drawStomper(ctx, h, h.x, v.yOf(h.d) - (1 - p) * 30, 1 + (1 - p) * 0.8);
      ctx.globalAlpha = was;
    } else if (h.kind === "drop" && h.at && !h.landed) {
      const p = Math.max(0, Math.min(1, 1 - (h.at - t) / DROP_FALL_MS));
      const y = v.yOf(h.d) - (1 - p) * 30;
      const was = ctx.globalAlpha;
      ctx.globalAlpha = was * Math.min(1, p * 3);
      const what = h.what === "cone" ? "pot" : h.what;
      drawDropped(ctx, what === "block" ? "pot" : what, h.x, y, h.w * (1 + (1 - p) * 0.8));
      ctx.globalAlpha = was;
    }
  }
}

// The lava under The Floor Is Lava, alive: a bubble swelling and popping
// here and there in the holes in view, never over a row of road.
export function drawLava(ctx, v) {
  const { road, g, ground } = v;
  const first = Math.max(0, Math.floor(v.cam / ROW) - 1);
  const last = Math.min(road.rows - 1, Math.floor((v.cam + g.FIELD_H) / ROW) + 1);
  for (let i = first; i <= last; i++) {
    if (road.under[i] !== ground.hole) continue;
    const h = hash(i, 95);
    if (h % 3 || lookOf(v.stageFor(road.stageOf[i]).id) !== LOOKS.lava) continue;
    const x = (h * 7.3) % g.FIELD_W;
    if (road.deck[i] && x > road.L[i] - 2 && x < road.R[i] + 2) continue;
    const p = (((v.clock / 1500 + h / 997) % 1) + 1) % 1;
    const y = v.yOf(i * ROW + ROW / 2);
    ctx.fillStyle = `rgba(255, 216, 74, ${0.85 * (1 - p)})`;
    circle(ctx, x, y, 0.3 + p * 0.9);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * (1 - p)})`;
    circle(ctx, x - 0.15, y - 0.15, 0.12 + p * 0.25);
    ctx.fill();
  }
}

// An icy stage's sheen: glints on the road that come and go, and a pale
// band slanting across it now and then, both fixed to the road so they
// scroll with it. Under the cars.
export function drawSheen(ctx, v) {
  if (!v.stageFor(v.round.stage).ice) return;
  const { road, g, ground } = v;
  const first = Math.max(0, Math.floor(v.cam / ROW) - 3);
  const last = Math.min(road.rows - 1, Math.floor((v.cam + g.FIELD_H) / ROW) + 1);
  for (let i = first; i <= last; i++) {
    if (road.deck[i] !== 1 || road.under[i] === ground.water) continue;
    const L = road.L[i];
    const R = road.R[i];
    const y = v.yOf(i * ROW + ROW);
    if (i % 16 === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      for (const [dy, tall] of [[0, 2.2], [3.4, 0.7]]) {
        ctx.beginPath();
        ctx.moveTo(L + 1, y + 2 + dy);
        ctx.lineTo(R - 1, y - 4 + dy);
        ctx.lineTo(R - 1, y - 4 + dy + tall);
        ctx.lineTo(L + 1, y + 2 + dy + tall);
        ctx.closePath();
        ctx.fill();
      }
    }
    const h = hash(i, 77);
    if (h % 5) continue;
    const a = 0.2 + 0.5 * Math.sin(v.clock / 260 + i * 1.3);
    if (a <= 0.05) continue;
    const x = L + 1.5 + ((hash(i, 78) % 100) / 100) * Math.max(0, R - L - 3);
    ctx.fillStyle = `rgba(255, 255, 255, ${a})`;
    ctx.fillRect(x - 0.6, y + 0.9, 1.2, 0.16);
    ctx.fillRect(x - 0.08, y + 0.38, 0.16, 1.2);
  }
}

// A downpour (the wet road of a stage with that twist): streaks slanting
// down the whole field and rings where drops land. Over the cars.
export function drawRain(ctx, v) {
  if (v.stageFor(v.round.stage).twist !== "rain") return;
  const t = v.clock;
  const W = v.g.FIELD_W;
  const H = v.g.FIELD_H;
  ctx.strokeStyle = "rgba(205, 228, 255, 0.4)";
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  for (let k = 0; k < 46; k++) {
    const x = (hash(k, 3) * 0.731) % W;
    const y = ((hash(k, 7) / 997) * H + t * (0.09 + (k % 5) * 0.012)) % H;
    ctx.moveTo(x, y);
    ctx.lineTo(x - 0.9, y + 3.2);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(225, 240, 255, 0.5)";
  ctx.lineWidth = 0.14;
  for (let k = 0; k < 9; k++) {
    const beat = t / 520 + k / 9;
    const p = beat % 1;
    const n = Math.floor(beat);
    ellipse(ctx, (hash(n, k + 11) * 0.731) % W, (hash(n, k + 23) * 0.917) % H, 0.3 + p * 1.3, 0.2 + p * 0.8);
    ctx.globalAlpha = 1 - p;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Night Lights: the field in the dark but for your headlights' reach and a
// soft pool round your car.
export function drawNight(ctx, v) {
  const you = v.round.cars[0];
  const x = you.x;
  const y = v.yOf(you.d);
  const W = v.g.FIELD_W;
  const Hh = v.g.FIELD_H;
  const reach = 46;
  ctx.fillStyle = "rgba(5, 8, 20, 0.62)";
  ctx.beginPath();
  ctx.rect(0, 0, W, Hh);
  ctx.moveTo(x - 4, y - 2);
  ctx.lineTo(x - 15, y - reach);
  ctx.lineTo(x + 15, y - reach);
  ctx.lineTo(x + 4, y - 2);
  ctx.lineTo(x + 6, y + 6);
  ctx.lineTo(x - 6, y + 6);
  ctx.closePath();
  if (typeof ctx.fill === "function") ctx.fill("evenodd");
  ctx.fillStyle = "rgba(5, 8, 20, 0.25)";
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 2);
  ctx.lineTo(x - 15, y - reach);
  ctx.lineTo(x + 15, y - reach);
  ctx.lineTo(x + 4, y - 2);
  ctx.closePath();
  ctx.fill();
}

// Fireflies at Night Lights, drifting with the clock.
export function drawFireflies(ctx, v) {
  ctx.fillStyle = "#ffe98a";
  for (let n = 0; n < 12; n++) {
    const x = (hash(n, 1) % v.g.FIELD_W) + Math.sin(v.clock / 900 + n) * 3;
    const y = (hash(n, 2) % v.g.FIELD_H) + Math.cos(v.clock / 1100 + n * 2) * 3;
    ctx.globalAlpha = 0.45 + 0.4 * Math.sin(v.clock / 300 + n * 1.7);
    circle(ctx, x, y, 0.35);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export { DRAW_MOVE_MS, TRAIN_WARN_MS };
