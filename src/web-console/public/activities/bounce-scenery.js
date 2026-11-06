// Plan2Code Web Console - Bounce Road's scenery: each stage's look, the road drawn a chunk of rows at a time (yards, kitchen tiles, sand, carpet, pond, roof shingles, night lawn, the Monster's dirt), and the parts drawn fresh each frame over it: drawbridges, swaying bridges, crumbling road, boost strips, ramps, slicks, barriers, stars, signs, power-ups, trains, balls, sprinklers, falling things, gusts and the dark of Night Lights.
//
// Drawing only: no rules and no state beyond the chunks of road it keeps.
// bounce-draw.js calls in with the view bounce.js refills each frame; where
// a moving part is comes from bounce-road.js's plain functions of the
// round's clock, so a paused game's frame stays still. Everything is in
// field units. The yard, the road and its things keep their own fixed
// colors, the same in light and dark.

import { DRAW_MOVE_MS, DROP_FALL_MS, FIELD_W, MARK, ROW, TRAIN_WARN_MS, ballX, crumbleAt, drawLift, gustAt, sprayAt, swayOff, trainAt } from "./bounce-road.js";

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
  else alt(false);
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

// Boost strips (chevrons that run), ramps (a striped wedge up to its lip)
// and slicks (a glossy pool).
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
    } else if (p.kind === "ramp") {
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

// A barrier or a dropped thing: a row of cones, a toy block, a flowerpot, a
// bucket, an acorn or a tire. A knocked cone tumbles off and fades.
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
    circle(ctx, x, y, b.w / 2);
    ctx.fillStyle = "#1c1c20";
    ctx.fill();
    circle(ctx, x, y, b.w / 4);
    ctx.fillStyle = "#8a8f99";
    ctx.fill();
  } else {
    const what = b.what || "block";
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(x - b.w / 2 + 0.6, y - b.l / 2 + 0.7, b.w, b.l);
    if (what === "pot" || what === "bucket" || what === "acorn") drawDropped(ctx, what, x, y, b.w);
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

// A flowerpot, a bucket or an acorn, seen from above, `size` across.
function drawDropped(ctx, what, x, y, size) {
  const r = size / 2;
  if (what === "pot") {
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
// chicane or a swaying bridge).
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
    } else {
      ctx.fillRect(s.x - 0.15, y - 0.9, 0.3, 1);
      ctx.fillRect(s.x - 0.15, y + 0.35, 0.3, 0.3);
    }
  }
}

// The power-ups lying on the road, bobbing, each with its mark.
export function drawItems(ctx, v) {
  const r = v.g.ITEM_R;
  for (const it of inView(v, v.road.items, "d", 4)) {
    if (it.taken) continue;
    const y = v.yOf(it.d) - 0.3 * Math.sin(v.clock / 220 + it.d);
    const spec = v.powers[it.kind];
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ellipse(ctx, it.x + 0.4, v.yOf(it.d) + 0.8, r * 0.9, r * 0.5);
    ctx.fill();
    circle(ctx, it.x, y, r);
    ctx.fillStyle = spec.color;
    ctx.fill();
    ctx.strokeStyle = DARK_INK;
    ctx.lineWidth = 0.3;
    ctx.stroke();
    ctx.strokeStyle = DARK_INK;
    ctx.fillStyle = DARK_INK;
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    if (it.kind === "spring") {
      ctx.moveTo(it.x - 0.8, y + 0.9);
      for (let n = 0; n < 4; n++) ctx.lineTo(it.x + (n % 2 ? -0.8 : 0.8), y + 0.9 - (n + 1) * 0.45);
      ctx.stroke();
    } else if (it.kind === "bubble") {
      ctx.arc(it.x, y, r * 0.55, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      circle(ctx, it.x - 0.4, y - 0.4, 0.3);
      ctx.fill();
    } else if (it.kind === "mega") {
      ctx.arc(it.x, y, r * 0.6, 0, TAU);
      ctx.stroke();
      circle(ctx, it.x, y, r * 0.25);
      ctx.fill();
    } else {
      ctx.moveTo(it.x - 0.3, y - 1);
      ctx.lineTo(it.x + 0.7, y - 0.1);
      ctx.lineTo(it.x, y);
      ctx.lineTo(it.x + 0.3, y + 1);
      ctx.lineTo(it.x - 0.7, y + 0.1);
      ctx.lineTo(it.x, y);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// The hazards under the cars: the crossing lights and a train, a ball
// rolling across, a falling thing's shadow growing where it will land.
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
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ellipse(ctx, bx + 0.8, y + 0.9, h.r, h.r * 0.8);
      ctx.fill();
      circle(ctx, bx, y, h.r);
      ctx.fillStyle = "#ff8a1f";
      ctx.fill();
      // Stripes that roll with it.
      const roll = (bx / h.r) % TAU;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.5;
      for (let k = 0; k < 2; k++) {
        const off = Math.sin(roll + k * Math.PI) * h.r * 0.75;
        ctx.beginPath();
        ctx.moveTo(bx + off, y - Math.sqrt(Math.max(0, h.r * h.r - off * off)));
        ctx.lineTo(bx + off, y + Math.sqrt(Math.max(0, h.r * h.r - off * off)));
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      circle(ctx, bx - h.r * 0.35, y - h.r * 0.35, h.r * 0.25);
      ctx.fill();
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
// streaks blowing across, a thing still falling (big and high).
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
