// Plan2Code Web Console - Ghoul Rush's Grounds stage, its drawing: the rooms' looks out under the night sky (clipped hedge walls and a gravel path, topiary and leaf piles, a white gazebo and its dead paper lanterns, a potting shed and compost), its monsters, the Groundskeeper and his mower, the scythe's sweep, the lantern's fire, the Hedge shears' badge, and what its events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, LOSE_WORDS and LOSE_SOUNDS are
// plain data; groundsArt(d) takes ghoul-draw.js's own drawing helpers (`d`:
// ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, DANGER,
// GOLD, FLASH and the eye colors) and hands back the drawing by kind, so this
// file never reaches back into it. Everything is drawn in room units, the
// way ghoul-draw.js draws: y counted down from the field's top, a monster
// from (x, y) at its feet. The bigger figures (the beasts, the Groundskeeper)
// are drawn in a local frame turned to face the way they look, y counted up
// from the feet. Each function says what it draws and what in the rules
// (ghoul-grounds.js) it follows.

import { FIRE_FLIGHT_MS, KEEPER_MOUNT_MS, KEEPER_QUICK, LANTERN_BACK, LANTERN_WIND_MS, MULCH_BURST_MS, ROOT_SINK_MS, ROOT_UP_MS, ROOT_WARN_MS, SCYTHE_REST_MS, SCYTHE_WIND_MS, SWEEP_LOW, SWEEP_TOP } from "./ghoul-grounds.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Out under the night sky like the Graveyard: the "wall" is the sky (`wallTop`
// to `wallLow`), `paper` the far hills and trees, `wainscot` the hedges
// behind, `window` the moon, `hedge` the lighter green of a hedge's top,
// `scene` what each room's backdrop is made of, and `pack` names this file's
// drawing for ghoul-draw.js. The floor and shelf colors are what the floor
// and shelves are drawn in under ground() and shelf() below.
const garden = (o) => freeze({ wallTop: "#04080f", wallLow: "#1c2c2c", paper: "#0e1a12", wainscot: "#0a160c", floorTop: "#3a6a2c", floor: "#1c2a14", floorEdge: "#080c06", shelf: "#2a4a22", shelfTop: "#437a34", pit: "#020302", window: "#e8f0d8", hedge: "#2c5a28", decor: "plants", dark: 0.8, outdoor: true, pack: "grounds", ...o });
export const LOOKS = freeze({
  maze: garden({ color: "#7fd86a", scene: "maze", wallLow: "#162a2c", paper: "#0a1c14", wainscot: "#0b2012", floorTop: "#8a8672", floor: "#2c2a22", shelf: "#14341a", shelfTop: "#3e8434" }),
  topiary: garden({ color: "#9fe08a", scene: "topiary", wallLow: "#1c2e2a", floorTop: "#427a30", floor: "#241a12", shelf: "#4a4e46", shelfTop: "#8a9084" }),
  gazebo: garden({ color: "#e8b86a", scene: "gazebo", wallTop: "#070912", wallLow: "#2c2a3a", paper: "#161620", wainscot: "#101018", floorTop: "#46682e", floor: "#201a12", shelf: "#b6b09a", shelfTop: "#d8d2bc" }),
  yard: garden({ color: "#e0a850", scene: "yard", wallLow: "#3a2a1c", paper: "#1c150c", wainscot: "#150f08", floorTop: "#6a5538", floor: "#2a2012", shelf: "#6a4a2a", shelfTop: "#a07a46" }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-grounds.js).
// `shears` is no monster: its `snip` plays when the Hedge shears cut one down.
export const VOICES = freeze({
  topiary: freeze({ appear: "ghoulTopiaryAppear", rustle: "ghoulTopiaryRustle", freeze: "ghoulTopiaryFreeze", hurt: "ghoulTopiaryHurt", die: "ghoulTopiaryDie" }),
  rootling: freeze({ appear: "ghoulRootlingAppear", warn: "ghoulRootlingWarn", up: "ghoulRootlingUp", hurt: "ghoulRootlingHurt", die: "ghoulRootlingDie" }),
  moth: freeze({ appear: "ghoulMothAppear", hurt: "ghoulMothHurt", die: "ghoulMothDie" }),
  mulch: freeze({ appear: "ghoulMulchAppear", leaves: "ghoulMulchLeaves", hurt: "ghoulMulchHurt", die: "ghoulMulchDie" }),
  keeper: freeze({ wake: "ghoulKeeperWake", scytheWind: "ghoulKeeperScytheWind", scytheSweep: "ghoulKeeperScytheSweep", lanternWind: "ghoulKeeperLanternWind", lanternThrow: "ghoulKeeperLanternThrow", fire: "ghoulKeeperFire", lanternOpen: "ghoulKeeperLanternOpen", mower: "ghoulKeeperMower", rev: "ghoulKeeperRev", charge: "ghoulKeeperCharge", stall: "ghoulKeeperStall", hurt: "ghoulKeeperHurt", weak: "ghoulKeeperWeak", die: "ghoulKeeperDie" }),
  shears: freeze({ snip: "ghoulShearsSnip" }),
});
// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({ topiary: "Trimmed", rootling: "Uprooted", moth: "Swarmed", mulch: "Mulched", keeper: "Pruned", scythe: "Reaped", fire: "Set alight", mower: "Run over" });
export const LOSE_SOUNDS = freeze({
  topiary: ["crunch", 0.55, 0.9],
  rootling: ["squish", 0.5, 0.7],
  moth: ["squish", 0.4, 1.4],
  mulch: ["squish", 0.5, 0.9],
  keeper: ["smash", 0.6, 0.6],
  scythe: ["clank", 0.6, 0.6],
  fire: ["ghoulSizzle", 0.6, 0.7],
  mower: ["crunch", 0.65, 0.5],
});

// The leaves of a beast, lit and dark, and its moonlit rim.
const LEAF = "#46893a";
const LEAF_LIT = "#7ac85c";
const LEAF_DARK = "#1b4421";
const LEAF_RIM = "#b4ec92";
const DIRT = "#4a3320";
const DIRT_DARK = "#241a10";
const DIRT_LIT = "#7a5a36";
const ROOT = "#7a5632";
const ROOT_DARK = "#3a2512";
const MULCH = "#9a5f26";
const MULCH_DARK = "#4a2a12";
const MULCH_LEAVES = ["#a8641f", "#c08a2c", "#7a3f1a", "#5c6a2a", "#8a4a1c"];
const MOTH_WING = "#f4e6b4";
const FIRE_HOT = "#ffe27a";
const FIRE_ORANGE = "#ff9a2e";
const FIRE_RED = "#e2452a";
const COAT = "#5d5538";
const COAT_DARK = "#3c3622";
const COAT_LIT = "#8d8156";
const STRAW = "#c0a35f";
const SKIN = "#9c8b6a";
const IRON = "#1c160e";
const STEEL = "#c6ced2";
const RUST = "#9a5230";
const RUST_DARK = "#5a2c18";

export function groundsArt(d) {
  const { ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, DANGER, GOLD, FLASH, EYE_AMBER } = d;
  const rnd = (a, b) => hash(a, b) / 997;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mix = (a, b, p) => a + (b - a) * p;

  // A soft glow as a few stacked discs, `a` the strength at the middle.
  function halo(ctx, x, y, r, color, a) {
    const was = ctx.globalAlpha;
    ctx.fillStyle = color;
    for (const [k, s] of [[1, 0.2], [0.72, 0.25], [0.46, 0.3], [0.24, 0.35]]) {
      ctx.globalAlpha = was * a * s;
      circle(ctx, x, y, r * k);
      ctx.fill();
    }
    ctx.globalAlpha = was;
  }

  // Specks of `colors` scattered over an ellipse, each `size` units across.
  function flecks(ctx, x, y, rx, ry, n, seed, colors, size = 0.22) {
    for (let k = 0; k < n; k++) {
      const a = rnd(seed, k) * TAU;
      const r = Math.sqrt(rnd(seed, k + 61));
      ctx.fillStyle = colors[k % colors.length];
      ctx.fillRect(x + Math.cos(a) * r * rx, y + Math.sin(a) * r * ry, size * (1 + (k % 2)), size);
    }
  }

  // A leaf of `color` at (x, y) `s` long, turned by `rot`.
  function leaf(ctx, x, y, s, rot, color) {
    ctx.fillStyle = color;
    ellipse(ctx, x, y, s, s * 0.42, rot);
    ctx.fill();
  }

  /* ------------------------------------------------------- the backdrop */

  // A block of clipped hedge from (x, top) to the bottom, `w` wide: leaf
  // flecks in rows, brighter near the moonlit top.
  function hedgeBlock(ctx, x, top, w, bottom, seed, dim = 1) {
    ctx.fillStyle = "#0b2012";
    ctx.fillRect(x, top, w, bottom - top);
    const rows = Math.min(16, Math.floor((bottom - top) / 1.3));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < Math.ceil(w / 1.5); c++) {
        const h = hash(seed + c, r * 7 + 3);
        if (h % 3) continue;
        ctx.globalAlpha = (r < 3 ? 0.95 : 0.55 - r * 0.02) * dim;
        ctx.fillStyle = r < 2 && h % 2 ? "#4f9640" : h % 2 ? "#245a2a" : "#133a1b";
        ctx.fillRect(x + c * 1.5 + (h % 5) * 0.12, top + r * 1.3 + 0.5, 0.9, 0.5);
      }
    }
    ctx.globalAlpha = dim * 0.7;
    ctx.fillStyle = "#6cb552";
    ctx.fillRect(x, top, w, 0.35);
    ctx.globalAlpha = 1;
  }

  // A topiary shape drawn flat, from its base at (x, y), `s` times its size:
  // `shape` 0 a tiered cone, 1 three balls, 2 a hare, 3 a hound, 4 a cake of
  // tiers, 5 a bird with a fan of a tail. Moonlit along its upper left.
  function shape(ctx, x, y, s, kind, ink, rim) {
    const blobs = [];
    const polys = [];
    if (kind === 0) {
      for (let k = 0; k < 4; k++) polys.push([[-3.2 + k * 0.6, -k * 2.7], [3.2 - k * 0.6, -k * 2.7], [2.2 - k * 0.6, -(k + 1) * 2.7 - 0.3], [-2.2 + k * 0.6, -(k + 1) * 2.7 - 0.3]]);
      polys.push([[-0.6, -10.8], [0.6, -10.8], [0, -13]]);
    } else if (kind === 1) blobs.push([0, -2.4, 3.1, 2.4], [0.1, -6.2, 2.4, 1.9], [0, -9.1, 1.6, 1.3], [0, -11, 0.7, 0.7]);
    else if (kind === 2) {
      blobs.push([-0.7, -2.4, 2.3, 2.1], [0.5, -5.1, 1.7, 2.4], [1.4, -7.8, 1.3, 1.1], [2.4, -7.5, 0.7, 0.5], [0.8, -11.1, 0.5, 1.8], [-0.3, -10.9, 0.45, 1.7], [-3.1, -2.8, 0.7, 0.7]);
    } else if (kind === 3) {
      blobs.push([0, -5.2, 4.1, 2], [4.6, -7.2, 1.7, 1.4], [6.1, -6.6, 1.1, 0.8], [3.6, -9.1, 0.5, 1], [-4.2, -6.2, 0.7, 1.6]);
      polys.push([[-3.4, -3.6], [-2.2, -3.6], [-2.2, 0], [-3.4, 0]], [[-0.4, -3.6], [0.8, -3.6], [0.8, 0], [-0.4, 0]], [[2.2, -3.6], [3.4, -3.6], [3.4, 0], [2.2, 0]], [[4.4, -3.6], [5.4, -3.6], [5.4, 0], [4.4, 0]]);
    } else if (kind === 4) {
      for (let k = 0; k < 3; k++) polys.push([[-3.4 + k * 0.9, -k * 3.3], [3.4 - k * 0.9, -k * 3.3], [3.4 - k * 0.9, -(k + 1) * 3.3 + 0.5], [-3.4 + k * 0.9, -(k + 1) * 3.3 + 0.5]]);
      blobs.push([0, -10.7, 1.3, 1.3]);
    } else {
      blobs.push([-0.8, -3.4, 2.5, 1.8], [2.4, -6.4, 1.1, 1.3], [3.3, -7.8, 0.8, 0.7]);
      for (let k = -3; k <= 3; k++) blobs.push([-3.4 + k * 0.5, -8.6 - (3 - Math.abs(k)) * 1.2, 0.9, 1.7]);
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = ink;
    for (const p of polys) {
      ctx.beginPath();
      p.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.closePath();
      ctx.fill();
    }
    for (const [bx, by, rx, ry] of blobs) {
      ellipse(ctx, bx, by, rx, ry);
      ctx.fill();
    }
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 0.35;
    for (const [bx, by, rx, ry] of blobs) {
      if (typeof ctx.ellipse !== "function") break;
      ctx.beginPath();
      ctx.ellipse(bx, by, rx, ry, 0, Math.PI * 0.95, Math.PI * 1.55);
      ctx.stroke();
    }
    for (const p of polys) {
      ctx.beginPath();
      ctx.moveTo(p[0][0], p[0][1]);
      ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // A tall dark cypress, a pointed flame of leaves from (x, base).
  function cypress(ctx, x, base, h, color, rim) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.13, base);
    ctx.quadraticCurveTo(x - h * 0.17, base - h * 0.6, x, base - h);
    ctx.quadraticCurveTo(x + h * 0.17, base - h * 0.6, x + h * 0.13, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rim;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(x - h * 0.15, base - h * 0.2);
    ctx.quadraticCurveTo(x - h * 0.16, base - h * 0.6, x - 0.1, base - h + 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The night behind a room, from x0 to x1: the sky and its stars, the moon
  // with a thin cloud across it, far hills and a tree line along them.
  // Returns where the hills are, for what stands on them.
  function night(ctx, v, look, x0, x1) {
    const { g } = v;
    const sky = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, g.FIELD_H) : null;
    if (sky && typeof sky.addColorStop === "function") {
      sky.addColorStop(0, look.wallTop);
      sky.addColorStop(0.75, look.wallLow);
      sky.addColorStop(1, look.wallLow);
      ctx.fillStyle = sky;
    } else ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, g.FIELD_H);
    ctx.fillStyle = "#d6e4d0";
    for (let x = Math.floor(x0 / 3) * 3; x < x1 + 3; x += 3) {
      const h = hash(Math.round(x / 3), 71);
      if (h % 5) continue;
      ctx.globalAlpha = 0.25 + (h % 4) * 0.12;
      ctx.fillRect(x + (h % 3), 1 + (h % 23), 0.18, 0.18);
    }
    ctx.globalAlpha = 1;
    for (let x = Math.floor(x0 / 240) * 240 + 150; x < x1 + 12; x += 240) {
      halo(ctx, x, 9, 9, look.window, 0.5);
      ctx.fillStyle = look.window;
      ctx.globalAlpha = 0.92;
      circle(ctx, x, 9, 3.6);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#7a8a70";
      for (const [cx, cy, cr] of [[-1.1, -0.9, 0.9], [1.2, 0.8, 0.7], [0.4, -1.8, 0.45], [-1.6, 1.3, 0.4]]) {
        circle(ctx, x + cx, 9 + cy, cr);
        ctx.fill();
      }
    }
    for (let x = Math.floor(x0 / 90) * 90 + 20; x < x1 + 40; x += 90) {
      const h = hash(Math.round(x / 90), 17);
      ctx.globalAlpha = 0.04 + (h % 3) * 0.012;
      ctx.fillStyle = "#aab8b0";
      ellipse(ctx, x + (h % 30), 14 + (h % 9), 16 + (h % 8), 0.9);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const hill = (x) => g.FIELD_H - 14 - Math.sin(x / 41) * 2.4 - Math.sin(x / 15 + 1) * 0.8;
    ctx.fillStyle = look.paper;
    ctx.beginPath();
    ctx.moveTo(x0, g.FIELD_H);
    for (let x = x0; x <= x1 + 1; x += 2) ctx.lineTo(x, hill(x));
    ctx.lineTo(x1 + 1, g.FIELD_H);
    ctx.closePath();
    ctx.fill();
    // A line of round-topped trees along the hills.
    for (let x = Math.floor(x0 / 13) * 13; x < x1 + 13; x += 13) {
      const n = Math.round(x / 13);
      const h = hash(n, 3);
      if (h % 4 === 0) continue;
      const tx = x + (h % 7);
      const ty = hill(tx) + 1;
      ctx.fillStyle = look.paper;
      circle(ctx, tx, ty - 3.2 - (h % 3) * 0.5, 3 + (h % 3) * 0.5);
      ctx.fill();
      ctx.fillRect(tx - 0.3, ty - 2, 0.6, 3);
    }
    return hill;
  }

  // The clipped hedge walls of the maze: two layers of them, the far one taller
  // and darker, each cut into blocks with a notch between, with arches cut
  // through the near one that show the far wall, a pale patch of moonlit
  // path and an urn on a plinth.
  function mazeWalls(ctx, v, x0, x1, floorAt) {
    const { g } = v;
    for (const [layer, top, wide, dim] of [[0, g.FIELD_H - 36, 17, 0.5], [1, g.FIELD_H - 29, 13, 1]]) {
      for (let x = Math.floor(x0 / wide) * wide - wide; x < x1 + wide; x += wide) {
        const n = Math.round(x / wide);
        const t = top + (hash(n, 3 + layer) % 4) * 0.6 - (layer ? 0 : (hash(n, 9) % 2) * 1.4);
        hedgeBlock(ctx, x + 0.3, t, wide - 0.6, g.FIELD_H, n * 5 + layer * 99, dim);
      }
    }
    for (let x = Math.floor(x0 / 78) * 78; x < x1 + 78; x += 78) {
      const n = Math.round(x / 78);
      const ax = x + 22 + (hash(n, 6) % 30);
      const fy = floorAt(ax);
      if (fy === null || floorAt(ax - 6) !== fy || floorAt(ax + 6) !== fy || hash(n, 4) % 3 === 0) continue;
      ctx.fillStyle = "#040c08";
      ctx.beginPath();
      ctx.moveTo(ax - 4.4, fy);
      ctx.lineTo(ax - 4.4, fy - 10);
      ctx.quadraticCurveTo(ax, fy - 17, ax + 4.4, fy - 10);
      ctx.lineTo(ax + 4.4, fy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a9a84";
      ctx.globalAlpha = 0.22;
      ellipse(ctx, ax, fy - 0.3, 3.4, 0.6);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a2418";
      ctx.fillRect(ax - 0.9, fy - 3, 1.8, 3);
      ellipse(ctx, ax, fy - 4.1, 1.1, 1.3);
      ctx.fill();
      ctx.fillStyle = "#7a8a74";
      ctx.fillRect(ax - 0.9, fy - 3, 0.3, 3);
    }
  }

  // A garden full of shaped hedges: a long low clipped hedge, cypresses and
  // topiary on stone plinths, a hare or a hound among them, and here and
  // there a heap of dead leaves.
  function topiaryLawns(ctx, v, look, x0, x1, floorAt, hill) {
    const { g } = v;
    ctx.fillStyle = "#0b1d10";
    for (let x = Math.floor(x0 / 7) * 7; x < x1 + 7; x += 7) {
      const n = Math.round(x / 7);
      ctx.fillRect(x, g.FIELD_H - 21 - (hash(n, 2) % 3) * 0.4, 7.1, 22);
    }
    ctx.fillStyle = "#245a2a";
    ctx.globalAlpha = 0.5;
    for (let x = Math.floor(x0 / 7) * 7; x < x1 + 7; x += 7) ctx.fillRect(x, g.FIELD_H - 21 - (hash(Math.round(x / 7), 2) % 3) * 0.4, 7.1, 0.3);
    ctx.globalAlpha = 1;
    for (let x = Math.floor(x0 / 31) * 31 + 6; x < x1 + 31; x += 31) {
      const n = Math.round(x / 31);
      cypress(ctx, x + (hash(n, 8) % 9), hill(x) + 6, 18 + (hash(n, 4) % 6), "#0a1c10", "#7ab868");
    }
    for (let x = Math.floor(x0 / 24) * 24 + 8; x < x1 + 24; x += 24) {
      const n = Math.round(x / 24);
      const px = x + (hash(n, 12) % 8);
      const fy = floorAt(px);
      if (fy === null || floorAt(px - 3) !== fy || floorAt(px + 3) !== fy) continue;
      if (hash(n, 5) % 4 === 0) continue;
      const kind = hash(n, 14) % 6;
      const s = 0.95 + (hash(n, 15) % 3) * 0.12;
      ctx.fillStyle = "#5a6058";
      ctx.fillRect(px - 3.2, fy - 1.3, 6.4, 1.3);
      ctx.fillStyle = "#8a9084";
      ctx.fillRect(px - 3.2, fy - 1.3, 6.4, 0.3);
      shape(ctx, px, fy - 1.3, s, kind, "#14381b", "#a6e08a");
    }
    for (let x = Math.floor(x0 / 17) * 17; x < x1 + 17; x += 17) {
      const n = Math.round(x / 17);
      const fy = floorAt(x + 5);
      if (fy === null || hash(n, 22) % 3 || floorAt(x) !== fy || floorAt(x + 10) !== fy) continue;
      // A box hedge border low along the lawn, and a heap of dead leaves.
      ctx.fillStyle = "#123018";
      roundRect(ctx, x, fy - 1.9, 11, 1.9, 0.7);
      ctx.fill();
      ctx.fillStyle = "#3e8434";
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x + 0.6, fy - 1.9, 9.8, 0.25);
      ctx.globalAlpha = 1;
    }
    for (let x = Math.floor(x0 / 43) * 43; x < x1 + 43; x += 43) {
      const n = Math.round(x / 43);
      const lx = x + 6 + (hash(n, 31) % 20);
      const fy = floorAt(lx);
      if (fy === null || floorAt(lx - 3) !== fy || floorAt(lx + 3) !== fy || hash(n, 32) % 2) continue;
      ctx.fillStyle = "#4a3016";
      ellipse(ctx, lx, fy - 0.4, 3.3, 1.1);
      ctx.fill();
      flecks(ctx, lx, fy - 0.7, 2.9, 0.7, 14, n * 3 + 1, MULCH_LEAVES, 0.3);
    }
  }

  // A tall, thin pole of dark wood with a cap, strings of dead paper lanterns
  // swagged between them, and a bunting of faded flags.
  function lanternStrings(ctx, v, x0, x1, floorAt) {
    const colors = ["#8a3a34", "#9a7a3a", "#3a6a66", "#a89a78", "#6a4a7a"];
    const sag = 3.4;
    const pole = (n) => 20 + n * 58 + (hash(n, 7) % 9);
    const top = (n) => v.g.FIELD_H - 24 - (hash(n, 8) % 3);
    for (let n = Math.floor((x0 - 70) / 58); pole(n) < x1 + 70; n++) {
      const px = pole(n);
      const fy = floorAt(px) ?? v.g.FIELD_H - 6;
      ctx.fillStyle = "#14100a";
      ctx.fillRect(px - 0.35, top(n), 0.7, fy - top(n));
      ctx.fillRect(px - 0.7, top(n) - 0.5, 1.4, 0.6);
      const nx = pole(n + 1);
      const ay = top(n);
      const by = top(n + 1);
      // The string, sagging between the two.
      ctx.strokeStyle = "#20180f";
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(px, ay);
      ctx.quadraticCurveTo((px + nx) / 2, (ay + by) / 2 + sag * 2, nx, by);
      ctx.stroke();
      const count = Math.floor((nx - px) / 4.6);
      for (let k = 1; k <= count; k++) {
        const p = k / (count + 1);
        const lx = mix(px, nx, p);
        const ly = (1 - p) * (1 - p) * ay + 2 * p * (1 - p) * ((ay + by) / 2 + sag * 2) + p * p * by;
        const h = hash(n * 31 + k, 9);
        ctx.strokeStyle = "#20180f";
        line(ctx, lx, ly, lx, ly + 0.8);
        ctx.fillStyle = colors[h % colors.length];
        ctx.globalAlpha = 0.85;
        ellipse(ctx, lx, ly + 1.9, 0.9, 1.1);
        ctx.fill();
        ctx.globalAlpha = 0.45;
        ctx.strokeStyle = "#0a0806";
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.ellipse?.(lx, ly + 1.9, 0.4, 1.1, 0, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#14100a";
        ctx.fillRect(lx - 0.35, ly + 0.8, 0.7, 0.25);
        ctx.fillRect(lx - 0.3, ly + 2.95, 0.6, 0.2);
        if (h % 4 === 0) {
          ctx.fillStyle = "#04060a";
          ellipse(ctx, lx + 0.2, ly + 2.2, 0.3, 0.35);
          ctx.fill();
        }
      }
    }
  }

  // A long party table under a cloth gone gray, set for guests who never
  // left: plates, a tipped glass, candle stubs and a cake gone to mold.
  function partyTable(ctx, x, fy, n) {
    const w = 11;
    ctx.fillStyle = "#12100c";
    for (const s of [-1, 1]) ctx.fillRect(x + s * (w / 2 - 0.8) - 0.3, fy - 3, 0.6, 3);
    ctx.fillStyle = "#a8a290";
    ctx.fillRect(x - w / 2, fy - 3.8, w, 0.4);
    ctx.fillStyle = "#847f6e";
    ctx.beginPath();
    ctx.moveTo(x - w / 2, fy - 3.4);
    ctx.lineTo(x + w / 2, fy - 3.4);
    for (let k = 0; k <= 8; k++) ctx.lineTo(x + w / 2 - k * (w / 8), fy - 1.2 + (k % 2) * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(20, 14, 8, 0.55)";
    for (const k of [-3.4, 0.8, 3.6]) ellipse(ctx, x + k, fy - 2.4, 0.7, 0.4);
    ctx.fill();
    ctx.fillStyle = "#c8c4b2";
    for (const k of [-4, -2.6, 2.2]) {
      ellipse(ctx, x + k, fy - 4, 0.65, 0.2);
      ctx.fill();
    }
    ctx.fillStyle = "#4a6a42";
    roundRect(ctx, x - 0.2, fy - 5.2, 2, 1.4, [0.9, 0.9, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#d8d2bc";
    for (const k of [0.2, 0.9, 1.5]) ctx.fillRect(x + k, fy - 6.1, 0.18, 0.9);
    if (n % 2) {
      ctx.fillStyle = "#12100c";
      ctx.fillRect(x + w / 2 + 1, fy - 2.4, 0.5, 2.4);
      ctx.fillRect(x + w / 2 + 0.4, fy - 2.4, 1.7, 0.4);
    }
  }

  // The white gazebo over the raised floor: eight posts, lattice between
  // them, a scalloped trim, a shingled roof rising to a finial.
  function gazebo(ctx, a, b, fy) {
    const w = b - a;
    const post = (i) => a + (w * i) / 5;
    // The roof, behind everything.
    ctx.fillStyle = "#1c2624";
    ctx.beginPath();
    ctx.moveTo(a - 4, fy - 17);
    ctx.lineTo(a + w * 0.34, fy - 28);
    ctx.lineTo(a + w * 0.66, fy - 28);
    ctx.lineTo(b + 4, fy - 17);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0a1210";
    ctx.lineWidth = 0.15;
    for (let k = 1; k < 5; k++) line(ctx, mix(a - 4, a + w * 0.34, k / 5), mix(fy - 17, fy - 28, k / 5), mix(b + 4, a + w * 0.66, k / 5), mix(fy - 17, fy - 28, k / 5));
    ctx.strokeStyle = "#8aa09a";
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.55;
    line(ctx, a - 4, fy - 17, a + w * 0.34, fy - 28);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1c2624";
    ctx.fillRect(a + w * 0.5 - 2.2, fy - 31.5, 4.4, 3.6);
    ctx.beginPath();
    ctx.moveTo(a + w * 0.5 - 3, fy - 31.5);
    ctx.lineTo(a + w * 0.5, fy - 35.5);
    ctx.lineTo(a + w * 0.5 + 3, fy - 31.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c9ccc2";
    ctx.fillRect(a + w * 0.5 - 0.15, fy - 38.5, 0.3, 3.2);
    circle(ctx, a + w * 0.5, fy - 38.8, 0.5);
    ctx.fill();
    // The eave: a trim of white with a scalloped edge under it.
    ctx.fillStyle = "#c9ccc2";
    ctx.fillRect(a - 4, fy - 17.4, w + 8, 0.9);
    for (let x = a - 3; x < b + 3; x += 1.6) {
      ellipse(ctx, x + 0.8, fy - 16.5, 0.8, 0.8);
      ctx.fill();
    }
    // Lattice between the posts, then the posts over it.
    ctx.strokeStyle = "#a8aea4";
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.14;
    for (let i = 0; i < 5; i++) {
      for (let x = post(i); x < post(i + 1) - 0.4; x += 1.4) {
        line(ctx, x, fy - 6, Math.min(x + 1.4, post(i + 1)), fy - 15);
        line(ctx, x + 1.4, fy - 6, Math.max(x, post(i)), fy - 15);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c9ccc2";
    ctx.fillRect(a, fy - 6.4, w, 0.5);
    ctx.fillRect(a, fy - 15.3, w, 0.5);
    for (let i = 0; i <= 5; i++) {
      ctx.fillRect(post(i) - 0.6, fy - 17, 1.2, 17);
      ctx.fillStyle = "#8c9088";
      ctx.fillRect(post(i) + 0.2, fy - 17, 0.4, 17);
      ctx.fillStyle = "#c9ccc2";
    }
  }

  // A potting shed with a tin roof gone to rust and a lit window, tools
  // hung on its wall.
  function shed(ctx, x, fy) {
    ctx.fillStyle = "#1a120a";
    ctx.fillRect(x - 11, fy - 13, 22, 13);
    ctx.strokeStyle = "#0c0804";
    ctx.lineWidth = 0.14;
    for (let k = -10; k < 11; k += 1.8) line(ctx, x + k, fy - 13, x + k, fy);
    ctx.fillStyle = "#3a2c22";
    ctx.beginPath();
    ctx.moveTo(x - 13, fy - 12.6);
    ctx.lineTo(x - 11, fy - 17);
    ctx.lineTo(x + 11, fy - 17);
    ctx.lineTo(x + 13, fy - 12.6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = RUST;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 0.18;
    for (let k = -10; k < 11; k += 2.2) line(ctx, x + k, fy - 16.9, x + k * 1.1, fy - 12.8);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#c98a3a";
    ctx.globalAlpha = 0.75;
    ctx.fillRect(x + 3, fy - 10, 5, 4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a120a";
    ctx.fillRect(x + 5.4, fy - 10, 0.3, 4);
    ctx.fillRect(x + 3, fy - 8.1, 5, 0.3);
    ctx.fillStyle = "#0c0804";
    ctx.fillRect(x - 8, fy - 9.5, 4.4, 9.5);
    ctx.fillStyle = "#c98a3a";
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x - 7.6, fy - 9.2, 0.3, 9);
    ctx.globalAlpha = 1;
  }

  // A rake leaning against something, tines up.
  function rake(ctx, x, fy, lean) {
    ctx.strokeStyle = "#2a1c10";
    ctx.lineWidth = 0.3;
    line(ctx, x, fy, x + lean * 3, fy - 10);
    ctx.lineWidth = 0.18;
    line(ctx, x + lean * 3 - 1.4, fy - 10.2, x + lean * 3 + 1.4, fy - 10.2);
    for (let k = -2; k <= 2; k++) line(ctx, x + lean * 3 + k * 0.6, fy - 10.2, x + lean * 3 + k * 0.6, fy - 11.4);
  }

  // A wheelbarrow tipped on its barrow, rust-red, one wheel.
  function barrow(ctx, x, fy) {
    ctx.fillStyle = "#4a2418";
    ctx.beginPath();
    ctx.moveTo(x - 3, fy - 3.6);
    ctx.lineTo(x + 3, fy - 3.2);
    ctx.lineTo(x + 2, fy - 1.4);
    ctx.lineTo(x - 2, fy - 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1c120a";
    ctx.lineWidth = 0.28;
    line(ctx, x - 2.4, fy - 1.6, x - 5, fy - 3.4);
    line(ctx, x + 2, fy - 2, x + 3.4, fy - 0.3);
    ctx.lineWidth = 0.2;
    circle(ctx, x + 3.6, fy - 1, 1);
    ctx.stroke();
    ctx.fillStyle = "#2a1c10";
    ctx.fillRect(x - 2.2, fy - 1.3, 0.4, 1.3);
  }

  // A compost heap: a mound of dark rot behind a few slats, steaming.
  function compost(ctx, x, fy, t) {
    ctx.fillStyle = "#1a1208";
    ellipse(ctx, x, fy - 1.4, 5, 2.6);
    ctx.fill();
    flecks(ctx, x, fy - 2.2, 4.4, 1.6, 20, Math.round(x), ["#3a2810", "#4a5a22", "#2a1c0c", "#5a4a1c"], 0.35);
    ctx.fillStyle = "#2a1c10";
    for (const s of [-1, 0, 1]) ctx.fillRect(x + s * 3.4 - 0.2, fy - 3, 0.4, 3);
    ctx.fillRect(x - 5.4, fy - 1.2, 10.8, 0.35);
    ctx.fillStyle = "#8aa08a";
    for (let k = 0; k < 3; k++) {
      const p = ((t / 2600 + k / 3) % 1);
      ctx.globalAlpha = 0.12 * (1 - p);
      ellipse(ctx, x + (k - 1) * 1.6 + Math.sin(p * 6 + k) * 0.6, fy - 3 - p * 5, 0.9 + p, 0.7 + p * 0.6);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The night behind a room, from x0 to x1: the sky, stars, the moon, far
  // hills and trees, and then what the room is: the maze's hedge walls, the
  // topiary lawns, the gazebo with its dead lanterns, or the yard with its
  // shed and compost; fog along the lawn.
  function backdrop(ctx, v, look, x0, x1) {
    const { spec, g } = v;
    const Y = (y) => g.FIELD_H - y;
    const hill = night(ctx, v, look, x0, x1);
    const floorAt = (x) => {
      const gy = v.groundAt(spec, x);
      return gy > -Infinity ? Y(gy) : null;
    };
    if (look.scene === "maze") mazeWalls(ctx, v, x0, x1, floorAt);
    else if (look.scene === "topiary") topiaryLawns(ctx, v, look, x0, x1, floorAt, hill);
    else if (look.scene === "gazebo") {
      lanternStrings(ctx, v, x0, x1, floorAt);
      for (const [a, b, top] of spec.ground) if (top > 6.5 && b - a > 40 && a < x1 + 40 && b > x0 - 40) gazebo(ctx, a + 2, b - 2, Y(top));
      for (let x = Math.floor(x0 / 46) * 46 + 14; x < x1 + 46; x += 46) {
        const n = Math.round(x / 46);
        const fy = floorAt(x);
        if (fy !== null && floorAt(x - 6) === fy && floorAt(x + 6) === fy && hash(n, 5) % 2 === 0 && !(x > 218 && x < 296)) partyTable(ctx, x, fy, n);
      }
    } else if (look.scene === "yard") {
      ctx.fillStyle = "#0b1d10";
      for (let x = Math.floor(x0 / 9) * 9; x < x1 + 9; x += 9) ctx.fillRect(x, g.FIELD_H - 22 - (hash(Math.round(x / 9), 2) % 3) * 0.5, 9.1, 22);
      ctx.fillStyle = "#245a2a";
      ctx.globalAlpha = 0.4;
      for (let x = Math.floor(x0 / 9) * 9; x < x1 + 9; x += 9) ctx.fillRect(x, g.FIELD_H - 22 - (hash(Math.round(x / 9), 2) % 3) * 0.5, 9.1, 0.3);
      ctx.globalAlpha = 1;
      // A picket fence of gray boards along the back.
      for (let x = Math.floor(x0 / 2.2) * 2.2; x < x1 + 3; x += 2.2) {
        const fy = floorAt(x);
        if (fy === null) continue;
        const n = Math.round(x / 2.2);
        if (hash(n, 4) % 11 === 0) continue;
        ctx.fillStyle = "#241a12";
        ctx.fillRect(x, fy - 7 - (hash(n, 6) % 3) * 0.3, 1.5, 7.3);
        ctx.beginPath();
        ctx.moveTo(x, fy - 7 - (hash(n, 6) % 3) * 0.3);
        ctx.lineTo(x + 0.75, fy - 8.1 - (hash(n, 6) % 3) * 0.3);
        ctx.lineTo(x + 1.5, fy - 7 - (hash(n, 6) % 3) * 0.3);
        ctx.fill();
      }
      for (let x = Math.floor(x0 / 52) * 52 + 14; x < x1 + 52; x += 52) {
        const n = Math.round(x / 52);
        const fy = floorAt(x);
        if (fy === null) continue;
        const pick = hash(n, 9) % 4;
        if (pick === 0) shed(ctx, x + 4, fy);
        else if (pick === 1) compost(ctx, x, fy, v.clock);
        else if (pick === 2) {
          barrow(ctx, x - 4, fy);
          rake(ctx, x + 4, fy, 0.18);
          rake(ctx, x + 6, fy, 0.3);
        } else {
          shed(ctx, x - 6, fy);
          compost(ctx, x + 18, fy, v.clock);
        }
      }
    }
    // Fog over the lawn.
    ctx.fillStyle = "#8aa08a";
    for (let x = Math.floor(x0 / 16) * 16; x < x1 + 16; x += 16) {
      const h = hash(Math.round(x / 16), 27);
      ctx.globalAlpha = 0.05 + (h % 4) * 0.015;
      ellipse(ctx, x + (h % 9), g.FIELD_H - 10 - (h % 5), 11, 2.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------- floors, shelves */

  // The floor pieces, drawn over ghoul-draw.js's plain ones: the maze's
  // gravel path (and its hedge blocks, the pieces over 6.5 high), the lawns
  // (a stone terrace where they step up), the gazebo's deck (white boards over
  // lattice) and the yard's packed earth.
  function ground(ctx, v, look, a, b, top) {
    const fy = v.g.FIELD_H - top;
    const w = b - a;
    const raised = top > 6.5;
    const sc = look.scene;
    const seed = Math.round(a);
    if (sc === "maze" && raised) {
      ctx.fillStyle = "#0b2012";
      ctx.fillRect(a, fy, w, top);
      for (let r = 0; r < Math.min(11, top / 1.2); r++) {
        for (let c = 0; c < Math.ceil(w / 1.4); c++) {
          const h = hash(seed + c, r * 5 + 1);
          if (h % 3 === 0) continue;
          ctx.fillStyle = r < 2 && h % 2 ? "#3f8a38" : h % 2 ? "#1f5226" : "#133a1b";
          ctx.globalAlpha = r < 2 ? 0.95 : Math.max(0.25, 0.7 - r * 0.05);
          ctx.fillRect(a + c * 1.4 + (h % 4) * 0.15, fy + 1.2 + r * 1.2, 0.9, 0.55);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#2f6a2c";
      ctx.fillRect(a, fy, w, 1.1);
      ctx.fillStyle = "#4c9a40";
      for (let x = a + 0.4; x < b - 0.6; x += 2.6) ctx.fillRect(x, fy + 0.15, 1.3, 0.35);
      ctx.fillStyle = "#8ad06a";
      ctx.globalAlpha = 0.6;
      ctx.fillRect(a, fy, w, 0.25);
      ctx.globalAlpha = 1;
    } else if (sc === "maze") {
      // Gravel: a pale moonlit top, pebbles through it and darker below.
      ctx.fillStyle = "#8a8672";
      ctx.fillRect(a, fy, w, 1.1);
      ctx.fillStyle = "#2c2a22";
      ctx.fillRect(a, fy + 1.1, w, top - 1.1);
      for (let x = Math.ceil(a / 0.9) * 0.9; x < b - 0.4; x += 0.9) {
        const h = hash(Math.round(x * 10), 5);
        ctx.fillStyle = ["#a8a38c", "#6a665a", "#bcb79f", "#7a7664"][h % 4];
        ctx.fillRect(x, fy + 0.1 + (h % 3) * 0.3, 0.45 + (h % 3) * 0.12, 0.3);
        if (h % 5 === 0) {
          ctx.fillStyle = "#4a463a";
          ellipse(ctx, x, fy + 1.9 + (h % 4) * 0.8, 0.55, 0.3);
          ctx.fill();
        }
      }
      ctx.fillStyle = "#3a5a2c";
      for (let x = Math.ceil(a / 7) * 7; x < b; x += 7) {
        const h = hash(Math.round(x), 8);
        if (h % 3 === 0) ctx.fillRect(x, fy - 0.5, 0.15, 0.55);
      }
    } else if (sc === "gazebo" && raised) {
      // The deck: white boards on a fascia over a dark lattice.
      ctx.fillStyle = "#14141a";
      ctx.fillRect(a, fy, w, top);
      ctx.strokeStyle = "#8e8f86";
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.14;
      for (let x = a; x < b; x += 1.6) {
        for (let y = fy + 1.6; y < fy + Math.min(top, 7); y += 1.6) {
          line(ctx, x, y, Math.min(x + 1.6, b), y + 1.6);
          line(ctx, Math.min(x + 1.6, b), y, x, y + 1.6);
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#d7d1bd";
      ctx.fillRect(a, fy, w, 1);
      ctx.fillStyle = "#b9b39d";
      ctx.fillRect(a, fy + 1, w, 0.7);
      ctx.fillStyle = "#8a846e";
      for (let x = Math.ceil(a / 2.4) * 2.4; x < b; x += 2.4) ctx.fillRect(x, fy, 0.14, 1);
    } else if (sc === "yard") {
      ctx.fillStyle = "#6a5538";
      ctx.fillRect(a, fy, w, 1.1);
      ctx.fillStyle = "#2a2012";
      ctx.fillRect(a, fy + 1.1, w, top - 1.1);
      for (let x = Math.ceil(a / 1.1) * 1.1; x < b - 0.3; x += 1.1) {
        const h = hash(Math.round(x * 10), 6);
        if (h % 3) continue;
        ctx.fillStyle = h % 2 ? "#8a7048" : "#4a3a24";
        ctx.fillRect(x, fy + 0.1 + (h % 3) * 0.25, 0.45, 0.3);
      }
      ctx.strokeStyle = "#a8924a";
      ctx.lineWidth = 0.1;
      for (let x = Math.ceil(a / 9) * 9; x < b; x += 9) {
        const h = hash(Math.round(x), 14);
        if (h % 3 === 0) continue;
        line(ctx, x, fy, x + 1.1, fy - 0.35);
        line(ctx, x + 0.5, fy, x + 1.7, fy - 0.2);
      }
      ctx.fillStyle = "#1a1208";
      for (let x = Math.ceil(a / 13) * 13; x < b; x += 13) {
        const h = hash(Math.round(x), 15);
        if (h % 2) ellipse(ctx, x + 2, fy + 0.7, 0.6, 0.18);
        ctx.fill();
      }
    } else {
      // Lawn: mown stripes, soil below with stones, blades of grass above.
      ctx.fillStyle = look.floorTop;
      ctx.fillRect(a, fy, w, 1.1);
      if (sc === "topiary" && raised) {
        ctx.fillStyle = "#3c4038";
        ctx.fillRect(a, fy + 1.1, w, top - 1.1);
        ctx.strokeStyle = "#1c1e1a";
        ctx.lineWidth = 0.14;
        for (let r = 0, y = fy + 1.1; y < fy + top; r++, y += 1.7) {
          line(ctx, a, y, b, y);
          for (let x = a + (r % 2) * 1.8; x < b; x += 3.6) line(ctx, x, y, x, Math.min(y + 1.7, fy + top));
        }
        ctx.fillStyle = "#4a6a3a";
        ctx.globalAlpha = 0.5;
        for (let x = Math.ceil(a / 4) * 4; x < b; x += 4) ctx.fillRect(x, fy + 1.1, 1.4, 0.5);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = look.floor;
        ctx.fillRect(a, fy + 1.1, w, top - 1.1);
        for (let x = Math.ceil(a / 5) * 5; x < b - 1; x += 5) {
          const h = hash(Math.round(x), 11);
          ctx.fillStyle = h % 2 ? "#4a4036" : "#14100a";
          ellipse(ctx, x + 1, fy + 2.2 + (h % 3) * 1.2, 0.7, 0.4);
          ctx.fill();
          if (h % 4 === 0) {
            ctx.strokeStyle = "#5a3e22";
            ctx.lineWidth = 0.14;
            line(ctx, x + 1.5, fy + 1.2, x + 0.8, fy + 3);
          }
        }
      }
      ctx.fillStyle = "#4f9a3c";
      ctx.globalAlpha = 0.35;
      for (let x = Math.ceil(a / 12) * 12; x < b; x += 12) ctx.fillRect(x, fy, 6, 1.1);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#4c9a3a";
      ctx.lineWidth = 0.13;
      for (let x = Math.ceil(a / 2.1) * 2.1; x < b - 0.4; x += 2.1) {
        const h = hash(Math.round(x * 10), 12);
        if (h % 2) continue;
        const bh = 0.5 + (h % 5) * 0.14;
        line(ctx, x, fy + 0.1, x - 0.2, fy - bh);
        line(ctx, x + 0.3, fy + 0.1, x + 0.55, fy - bh * 0.8);
        if (h % 4 === 0) line(ctx, x + 0.6, fy + 0.1, x + 0.9, fy - bh * 0.6);
      }
      // A few dead leaves on the grass.
      for (let x = Math.ceil(a / 9) * 9; x < b - 1; x += 9) {
        const h = hash(Math.round(x), 18);
        if (h % 3) continue;
        ctx.fillStyle = MULCH_LEAVES[h % 5];
        ctx.fillRect(x + (h % 4) * 0.4, fy + 0.2, 0.5, 0.25);
      }
    }
  }

  // A shelf in the room's own terms, its top surface at screen y `y`: a
  // hanging block of hedge in the maze, an ivy-grown stone ledge in the
  // topiary garden, a table under a gray cloth or a shingled roof in the
  // gazebo, a weathered plank on posts in the yard.
  function shelf(ctx, v, look, a, b, y) {
    const { spec, g } = v;
    const w = b - a;
    const gy = v.groundAt(spec, (a + b) / 2);
    const fy = gy > -Infinity ? g.FIELD_H - gy : y + 6;
    const seed = Math.round(a);
    if (look.scene === "maze") {
      ctx.fillStyle = "#0b2012";
      ctx.fillRect(a, y, w, 2.6);
      for (let x = a + 0.6; x < b; x += 1.2) {
        circle(ctx, x, y + 2.6, 0.8 + (hash(Math.round(x * 10), 3) % 3) * 0.15);
        ctx.fill();
      }
      for (let c = 0; c < Math.ceil(w / 1.4); c++) {
        const h = hash(seed + c, 33);
        ctx.fillStyle = h % 2 ? "#245a2a" : "#18461f";
        ctx.fillRect(a + c * 1.4, y + 0.6 + (h % 4) * 0.4, 0.9, 0.5);
      }
      ctx.fillStyle = "#3e8434";
      ctx.fillRect(a, y, w, 0.6);
      ctx.fillStyle = "#8ad06a";
      ctx.globalAlpha = 0.6;
      ctx.fillRect(a, y, w, 0.25);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#245a2a";
      ctx.lineWidth = 0.14;
      for (let x = a + 1.4; x < b - 1; x += 3.1) line(ctx, x, y + 3, x + 0.3, y + 3.9 + (hash(Math.round(x * 10), 4) % 3) * 0.5);
    } else if (look.scene === "topiary") {
      ctx.fillStyle = "#3a3e36";
      ctx.fillRect(a, y, w, 1.7);
      ctx.fillStyle = "#8a9084";
      ctx.fillRect(a, y, w, 0.4);
      ctx.fillStyle = "#1c1e1a";
      ctx.fillRect(a, y + 1.5, w, 0.2);
      ctx.fillStyle = "#4a4e46";
      for (const s of [a + 1, b - 3]) {
        ctx.beginPath();
        ctx.moveTo(s, y + 1.7);
        ctx.lineTo(s + 2, y + 1.7);
        ctx.lineTo(s + 1, y + 3.4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#3e8434";
      for (let x = a + 1; x < b - 0.6; x += 1.9) {
        const h = hash(Math.round(x * 10), 36);
        if (h % 3 === 0) continue;
        ellipse(ctx, x, y + 0.9 + (h % 3) * 0.2, 0.5, 0.3, 0.5);
        ctx.fill();
        if (h % 4 === 0) line(ctx, x, y + 1.5, x - 0.1, y + 2.6 + (h % 4) * 0.5);
      }
    } else if (look.scene === "gazebo" && fy - y >= 14) {
      // A shingled roof, trimmed in white, a dead lantern hung under it.
      ctx.fillStyle = "#26302e";
      ctx.fillRect(a, y, w, 1.8);
      ctx.strokeStyle = "#0a1210";
      ctx.lineWidth = 0.12;
      for (let r = 0; r < 2; r++) for (let x = a + (r % 2) * 0.9; x < b; x += 1.8) line(ctx, x, y + r * 0.9, x, y + r * 0.9 + 0.9);
      ctx.fillStyle = "#8aa09a";
      ctx.fillRect(a, y, w, 0.4);
      ctx.fillStyle = "#c9ccc2";
      ctx.fillRect(a, y + 1.8, w, 0.6);
      for (let x = a + 0.8; x < b; x += 1.6) {
        ellipse(ctx, x, y + 2.4, 0.8, 0.7);
        ctx.fill();
      }
      ctx.strokeStyle = "#20180f";
      ctx.lineWidth = 0.12;
      const lx = (a + b) / 2;
      line(ctx, lx, y + 3.1, lx, y + 4.4);
      ctx.fillStyle = ["#8a3a34", "#9a7a3a", "#3a6a66"][seed % 3];
      ellipse(ctx, lx, y + 5.4, 0.9, 1.1);
      ctx.fill();
    } else if (look.scene === "gazebo") {
      // A table: a gray cloth with a scalloped hem over dark legs.
      ctx.fillStyle = "#12100c";
      for (const s of [a + 1.2, b - 1.8]) ctx.fillRect(s, y + 1, 0.6, Math.max(1, fy - y - 1));
      ctx.fillStyle = "#c8c3ae";
      ctx.fillRect(a, y, w, 0.45);
      ctx.fillStyle = "#9a9582";
      ctx.fillRect(a, y + 0.45, w, 1.1);
      ctx.beginPath();
      ctx.moveTo(a, y + 1.5);
      ctx.lineTo(b, y + 1.5);
      for (let k = 0; k <= 10; k++) ctx.lineTo(b - (w * k) / 10, y + 2.6 + (k % 2) * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(20, 14, 8, 0.5)";
      for (let x = a + 2; x < b - 1; x += 4.4) {
        ellipse(ctx, x, y + 1.5, 0.6, 0.35);
        ctx.fill();
      }
    } else {
      // Weathered planks on two posts with a cross brace.
      ctx.fillStyle = "#4a3018";
      ctx.fillRect(a, y, w, 1.3);
      ctx.fillStyle = "#a07a46";
      ctx.fillRect(a, y, w, 0.4);
      ctx.fillStyle = "#1c1208";
      for (let x = a + 2.2; x < b - 1; x += 2.6) ctx.fillRect(x, y, 0.14, 1.3);
      ctx.fillStyle = "#8a8a82";
      for (const s of [a + 0.5, b - 0.9]) ctx.fillRect(s, y + 0.5, 0.3, 0.3);
      ctx.fillStyle = "#3a2814";
      const down = Math.max(1, fy - y - 1.3);
      for (const s of [a + 1.2, b - 1.8]) ctx.fillRect(s, y + 1.3, 0.6, down);
      ctx.strokeStyle = "#3a2814";
      ctx.lineWidth = 0.22;
      for (const [s, k] of [[a + 1.5, 1], [b - 1.5, -1]]) line(ctx, s, y + 3.2, s + k * 1.8, y + 1.3);
    }
  }

  /* ----------------------------------------------------------- monsters */

  // The beast's body as a list of leafy blobs [x, y, rx, ry, rot], y up from
  // its feet in a frame facing +x. Still it is a hare sitting up like a pruned
  // ornament, ears erect; creeping it is mid-lunge, stretched low, ears laid
  // back, jaws open, forelegs reaching. `p` is its stride, 0 to 1.
  function beastShapes(creep, p) {
    if (!creep) {
      return [[-0.6, 1.8, 1.45, 1.15, 0], [0.15, 2.9, 1.0, 1.45, 0.1], [0.95, 3.95, 0.72, 0.6, 0], [1.65, 3.8, 0.48, 0.3, 0], [0.5, 4.95, 0.2, 0.95, 0.3], [-0.2, 4.9, 0.2, 0.9, -0.05], [-2.0, 1.8, 0.4, 0.4, 0], [1.0, 1.0, 0.55, 0.3, 0]];
    }
    const s = Math.sin(p * TAU);
    return [[-0.1, 2.2 + s * 0.15, 1.9, 1.05, 0.12], [-1.5, 2.0 + s * 0.2, 1.1, 1.0, 0], [1.9, 2.7 + s * 0.2, 0.95, 0.72, 0.1], [2.75, 2.5 + s * 0.2, 0.62, 0.38, 0.1], [0.9, 3.45 + s * 0.15, 1.25, 0.24, 0.35], [0.5, 3.2 + s * 0.15, 1.1, 0.22, 0.4], [-2.6, 2.4, 0.4, 0.4, 0], [-0.8, 0.5, 0.9, 0.35, 0], [2.6 + s * 0.5, 0.5, 0.5, 0.3, 0]];
  }

  // A topiary beast: a hedge clipped into a hare. Frozen (`still`) it sits
  // on its clipped plinth like an ornament, ears up, shears' marks neat and
  // no face to speak of; creeping, it tears free of the plinth in a lunge,
  // ragged leaves and tufts standing out, leaves shedding, a pair of amber
  // eyes lit.
  function topiary(ctx, v, m, x, y, t, flash) {
    const d = m.dir || 1;
    const creep = m.act === "creep";
    const p = creep ? (t / 260 + rnd(m.id, 2)) % 1 : 0;
    const bob = creep ? Math.abs(Math.sin(p * TAU)) * 0.3 : 0;
    const blobs = beastShapes(creep, p);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(creep ? d * 0.88 : d, -1);
    ctx.translate(0, bob);
    const dark = flash ? FLASH : LEAF_DARK;
    const main = flash ? FLASH : LEAF;
    if (!creep) {
      // The plinth: a clipped cube of hedge it sits on.
      ctx.fillStyle = dark;
      ctx.fillRect(-1.9, 0, 3.8, 0.95);
      if (!flash) {
        ctx.fillStyle = LEAF;
        ctx.fillRect(-1.9, 0.8, 3.8, 0.15);
        ctx.fillStyle = "#0e2a12";
        for (const k of [-1.2, 0, 1.2]) ctx.fillRect(k - 0.1, 0.1, 0.2, 0.6);
      }
    }
    // Legs, when it runs: strokes of leaf and clawed toes.
    if (creep) {
      ctx.strokeStyle = main;
      ctx.lineCap = "round";
      ctx.lineWidth = 0.5;
      const sw = Math.sin(p * TAU) * 0.6;
      line(ctx, 1.1, 1.8, 2.5 + sw, 0.6);
      line(ctx, 0.6, 1.8, 1.6 - sw, 0.5);
      line(ctx, -1.6, 1.6, -2.5 - sw, 0.5);
      line(ctx, -1.0, 1.6, -1.6 + sw, 0.4);
      ctx.lineCap = "butt";
    }
    ctx.fillStyle = dark;
    for (const [bx, by, rx, ry, rot] of blobs) {
      ellipse(ctx, bx, by - 0.2, rx + 0.12, ry + 0.12, rot);
      ctx.fill();
    }
    ctx.fillStyle = main;
    for (const [bx, by, rx, ry, rot] of blobs) {
      ellipse(ctx, bx, by, rx, ry, rot);
      ctx.fill();
    }
    if (!flash) {
      // Moonlit leaves on the upper left, a rim along the top.
      for (let k = 0; k < blobs.length; k++) {
        const [bx, by, rx, ry] = blobs[k];
        flecks(ctx, bx - rx * 0.15, by + ry * 0.2, rx * 0.8, ry * 0.7, creep ? 5 : 4, m.id * 7 + k, creep ? [LEAF_LIT, LEAF_LIT, LEAF_DARK] : [LEAF_LIT, LEAF_DARK], 0.2);
        ctx.strokeStyle = LEAF_RIM;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 0.18;
        if (typeof ctx.ellipse === "function") {
          ctx.beginPath();
          ctx.ellipse(bx, by, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.7);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (creep) {
        // Ragged tufts along the back and a mouth hung open with leaf teeth.
        ctx.fillStyle = LEAF_LIT;
        for (let k = 0; k < 5; k++) {
          const tx = -1.6 + k * 0.85;
          ctx.beginPath();
          ctx.moveTo(tx - 0.25, 3.0 + Math.sin(k * 1.7) * 0.15);
          ctx.lineTo(tx + 0.1, 3.7 + (k % 2) * 0.35);
          ctx.lineTo(tx + 0.3, 3.0);
          ctx.fill();
        }
        ctx.fillStyle = "#08180a";
        ctx.beginPath();
        ctx.moveTo(2.15, 2.5);
        ctx.lineTo(3.3, 2.2 + (Math.sin(p * TAU) * 0.2));
        ctx.lineTo(2.3, 1.85);
        ctx.fill();
        ctx.fillStyle = LEAF_RIM;
        for (const k of [2.45, 2.75]) ctx.fillRect(k, 2.0, 0.12, 0.3);
      } else {
        // A shut face: only the dents where eyes would go.
        ctx.fillStyle = "#12301a";
        for (const k of [1.25, 0.8]) ctx.fillRect(k, 4.2, 0.22, 0.12);
      }
    }
    ctx.restore();
    if (creep) {
      // Leaves shaking loose behind it.
      if (!flash) {
        for (let k = 0; k < 4; k++) {
          const f = (t / 520 + k * 0.25 + rnd(m.id, k)) % 1;
          leaf(ctx, x - d * (0.8 + k * 0.7 + f * 0.8), y - 3.4 + f * 3.2 + Math.sin(f * 9 + k) * 0.3, 0.38, f * 6 + k, k % 2 ? LEAF_LIT : LEAF);
        }
        eye(v, x + d * 2.15 * 0.88, y - 3.0 - bob, 0.17, EYE_AMBER);
        eye(v, x + d * 1.55 * 0.88, y - 3.05 - bob, 0.15, EYE_AMBER);
      }
    }
  }

  // A rootling: while it trails, the lawn humps and a crack runs behind a
  // lump of turf, dirt hopping off it; warning, the crack gapes and glows a
  // hot red-orange, dirt spitting up out of it and a ring closing in on the
  // spot; up, a gnarled root with side roots and a bulb face and a few green
  // sprouts, rising and sinking in step with the rules' timers.
  function rootling(ctx, v, m, x, y, t, flash) {
    const d = m.dir || 1;
    if (m.act === "trail" || m.act === "warn") {
      const warn = m.act === "warn";
      const hump = warn ? 0.25 : 0.55 + Math.abs(Math.sin(t / 110)) * 0.15;
      // The crack, running back from where it is, jagged.
      ctx.strokeStyle = DIRT_DARK;
      ctx.lineWidth = warn ? 0.5 : 0.28;
      ctx.beginPath();
      ctx.moveTo(x, y - 0.05);
      for (let k = 1; k <= 6; k++) ctx.lineTo(x - d * k * 0.75, y - 0.05 + ((k + Math.floor(m.id)) % 2 ? -0.18 : 0.12));
      ctx.stroke();
      if (warn) {
        const burn = 1 - clamp(m.wait / ROOT_WARN_MS, 0, 1);
        const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t / (110 - burn * 70)));
        // The ring closes in; the gap burns.
        ctx.strokeStyle = `rgba(255, 120, 50, ${0.35 + burn * 0.5})`;
        ctx.lineWidth = 0.28;
        ellipse(ctx, x, y - 0.1, 3.4 - burn * 1.7, 0.7);
        ctx.stroke();
        ctx.fillStyle = "#0e0804";
        ellipse(ctx, x, y - 0.1, 1.5, 0.4);
        ctx.fill();
        ctx.fillStyle = pulse > 0.5 ? FIRE_ORANGE : FIRE_RED;
        ellipse(ctx, x, y - 0.1, 1.1, 0.22);
        ctx.fill();
        eye(v, x, y - 0.3, 0.3 + burn * 0.25, FIRE_ORANGE);
        // Dirt thrown up in arcs.
        for (let k = 0; k < 8; k++) {
          const f = (t / 260 + k / 8) % 1;
          const side = k % 2 ? 1 : -1;
          ctx.fillStyle = k % 3 ? DIRT : DIRT_LIT;
          ctx.fillRect(x + side * (0.3 + f * (0.9 + (k % 3) * 0.5)), y - Math.sin(f * Math.PI) * (1.8 + (k % 4) * 0.5), 0.3, 0.3);
        }
      } else {
        // A lump of turf, grass tilted on it, riding the crack.
        ctx.fillStyle = DIRT;
        ellipse(ctx, x, y - 0.1, 1.6, hump);
        ctx.fill();
        ctx.fillStyle = turf(x);
        ellipse(ctx, x, y - 0.1 - hump * 0.45, 1.3, hump * 0.6);
        ctx.fill();
        ctx.strokeStyle = "#4c9a3a";
        ctx.lineWidth = 0.13;
        for (let k = -2; k <= 2; k++) line(ctx, x + k * 0.5, y - 0.2 - hump * 0.6, x + k * 0.5 + d * 0.3, y - 0.9 - hump * 0.6 - (k % 2) * 0.2);
        for (let k = 0; k < 3; k++) {
          const f = (t / 240 + k / 3) % 1;
          ctx.fillStyle = DIRT_LIT;
          ctx.fillRect(x - d * (0.4 + f * 1.3), y - Math.sin(f * Math.PI) * 0.9 - 0.2, 0.25, 0.25);
        }
      }
      return;
    }
    // Up or sinking.
    const rise = m.act === "sink" ? m.wait / ROOT_SINK_MS : clamp((ROOT_UP_MS - m.wait) / 260, 0, 1);
    const h = m.h * clamp(rise, 0, 1);
    const sway = Math.sin(t / 150 + m.id) * 0.35 * rise;
    const tx = x + sway;
    const ty = y - h;
    // The root flare along the ground and the churned earth around it.
    ctx.fillStyle = DIRT;
    ellipse(ctx, x, y - 0.1, 2.4, 0.5);
    ctx.fill();
    ctx.strokeStyle = flash ? FLASH : ROOT_DARK;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.6;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.4, y - 0.2);
      ctx.quadraticCurveTo(x + s * 1.4, y - 0.1, x + s * 2.2, y + 0.05);
      ctx.stroke();
    }
    // The trunk: a twisted root, dark under light, side roots and tendrils.
    const trunk = (w, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(x, y - 0.2);
      ctx.bezierCurveTo(x + 0.9, y - h * 0.3, x - 0.9, y - h * 0.65, tx, ty + 0.5);
      ctx.stroke();
    };
    trunk(1.5, flash ? FLASH : ROOT_DARK);
    trunk(1.05, flash ? FLASH : ROOT);
    if (!flash) {
      ctx.strokeStyle = DIRT_LIT;
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(x - 0.25, y - 0.3);
      ctx.bezierCurveTo(x + 0.5, y - h * 0.3, x - 1.2, y - h * 0.65, tx - 0.3, ty + 0.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = flash ? FLASH : ROOT;
    ctx.lineWidth = 0.4;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.2, y - h * (0.4 + (s > 0 ? 0.12 : 0)));
      ctx.quadraticCurveTo(x + s * 1.2, y - h * 0.55, x + s * 1.5 + sway * 0.5, y - h * (0.7 + (s > 0 ? 0.1 : 0)));
      ctx.stroke();
      ctx.lineWidth = 0.18;
      line(ctx, x + s * 1.3, y - h * 0.6, x + s * 1.9, y - h * 0.62);
      ctx.lineWidth = 0.4;
    }
    ctx.lineCap = "butt";
    if (rise > 0.5) {
      // The bulb on top: pale, blushed below, with a face and green sprouts.
      const r = 0.95;
      ctx.fillStyle = flash ? FLASH : "#b87aa0";
      circle(ctx, tx, ty, r);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#e0d3a8";
      ellipse(ctx, tx, ty - 0.2, r * 0.95, r * 0.75);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#4f9a3c";
        for (const [sx, sr] of [[-0.35, -0.5], [0.05, 0], [0.4, 0.5]]) {
          ellipse(ctx, tx + sx + sway * 0.2, ty - r - 0.35 + Math.abs(sx) * 0.3, 0.17, 0.55, sr);
          ctx.fill();
        }
        ctx.fillStyle = "#1a0e08";
        for (const s of [-0.35, 0.35]) {
          circle(ctx, tx + s, ty - 0.05, 0.26);
          ctx.fill();
        }
        ellipse(ctx, tx, ty + 0.5, 0.28, 0.2);
        ctx.fill();
        eye(v, tx - 0.35, ty - 0.05, 0.16, EYE_AMBER);
        eye(v, tx + 0.35, ty - 0.05, 0.16, EYE_AMBER);
      }
    }
  }

  // The lawn's own green, a little different each place so a run of turf is
  // not one flat color.
  function turf(x) {
    return hash(Math.round(x), 5) % 2 ? "#3c7a2e" : "#468a34";
  }

  // A lantern moth: pale wings of two pairs, an eye-spot on each, fluttering
  // on a furry body with feathery antennae, a soft glow around it.
  function moth(ctx, v, m, x, y, t, flash) {
    const flap = Math.sin(t / 38 + m.id * 2);
    const cx = x;
    const cy = y - 0.75;
    if (!flash) halo(ctx, cx, cy, 2.1, "#ffe9a0", 0.5);
    for (const s of [-1, 1]) {
      const up = 0.15 + (flap * 0.5 + 0.5) * 0.9;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(s, 1);
      // Upper wing, a big rounded blade; lower wing, a small tail lobe.
      ctx.fillStyle = flash ? FLASH : MOTH_WING;
      ctx.beginPath();
      ctx.moveTo(0.1, 0);
      ctx.quadraticCurveTo(0.5, -up * 1.6, 1.25, -up * 0.9);
      ctx.quadraticCurveTo(1.5, -up * 0.2, 0.1, 0.1);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#e6d28e";
      ctx.beginPath();
      ctx.moveTo(0.1, 0.05);
      ctx.quadraticCurveTo(1, 0.1 - up * 0.1, 0.9, 0.55 + up * 0.15);
      ctx.quadraticCurveTo(0.4, 0.55, 0.1, 0.25);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#a4803c";
        circle(ctx, 0.85, -up * 0.75, 0.16);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.fillStyle = flash ? FLASH : "#6a5a3a";
    ellipse(ctx, cx, cy + 0.1, 0.28, 0.58);
    ctx.fill();
    if (!flash) {
      ctx.strokeStyle = "#6a5a3a";
      ctx.lineWidth = 0.08;
      for (const s of [-1, 1]) line(ctx, cx + s * 0.1, cy - 0.45, cx + s * 0.55, cy - 0.95);
      eye(v, cx + 0.12, cy - 0.28, 0.1, "#fff0b0");
      eye(v, cx - 0.12, cy - 0.28, 0.1, "#fff0b0");
    }
  }

  // A heap of leaves of every autumn color, `rx` wide, shaking at `shake`.
  function leafPile(ctx, x, y, rx, ry, seed, shake) {
    ctx.fillStyle = MULCH_DARK;
    ellipse(ctx, x, y - ry * 0.5, rx, ry);
    ctx.fill();
    for (let k = 0; k < 16; k++) {
      const a = rnd(seed, k) * Math.PI;
      const r = Math.sqrt(rnd(seed, k + 40));
      leaf(ctx, x - Math.cos(a) * rx * 0.85 * r + shake * (k % 2 ? 1 : -1) * 0.5, y - Math.sin(a) * ry * 1.7 * r, 0.65, rnd(seed, k + 90) * TAU, MULCH_LEAVES[k % 5]);
    }
  }

  // A mulch crawler: a pile of wet leaves in its pile (twitching now and
  // then, a gleam of eyes peeking), leaves flying up and out as it bursts,
  // and crawling, a low lump of leaves and rotten mulch on twig legs, matted,
  // with leaves hanging off it and a dark gap of a mouth.
  function mulch(ctx, v, m, x, y, t, flash) {
    if (m.act === "pile" || m.act === "burst") {
      const burst = m.act === "burst";
      const p = burst ? 1 - clamp(m.wait / MULCH_BURST_MS, 0, 1) : 0;
      const tw = Math.floor(t / 90 + m.id) % 14;
      const twitch = !burst && tw < 2 ? 0.25 : 0;
      leafPile(ctx, x, y, 2 - p * 0.3, 1.05 + twitch * 0.5 + p * 0.5, m.id, twitch);
      if (!burst && Math.floor((t + m.id * 211) / 1500) % 4 === 0) {
        eye(v, x - 0.45, y - 1.05, 0.13, EYE_AMBER);
        eye(v, x + 0.45, y - 1.05, 0.13, EYE_AMBER);
      }
      if (burst) {
        for (let k = 0; k < 14; k++) {
          const a = (rnd(m.id, k) - 0.5) * 2.6 + (k % 2 ? 0.3 : -0.3);
          const sp = 1 + (k % 4) * 0.7;
          leaf(ctx, x + Math.sin(a) * p * 4.2 * sp * 0.6, y - 0.6 - Math.cos(a) * p * 3.4 * sp * 0.8 + p * p * 1.6, 0.55, k + p * 9, MULCH_LEAVES[k % 5]);
        }
      }
      return;
    }
    const d = m.dir || 1;
    const step = Math.sin(t / 85 + m.id);
    ctx.fillStyle = flash ? FLASH : MULCH_DARK;
    ctx.strokeStyle = flash ? FLASH : "#3a2210";
    ctx.lineWidth = 0.22;
    for (const [k, s] of [-1.1, -0.35, 0.4, 1.1].entries()) line(ctx, x + s, y - 0.9, x + s + (k % 2 ? step : -step) * 0.45, y);
    // The matted body: dark, then leaves laid on it, rotted at the edges.
    ctx.fillStyle = flash ? FLASH : MULCH_DARK;
    ellipse(ctx, x, y - 1.3 + Math.abs(step) * 0.08, 1.55, 0.95);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = MULCH;
      ellipse(ctx, x - d * 0.1, y - 1.5, 1.35, 0.7);
      ctx.fill();
      for (let k = 0; k < 8; k++) leaf(ctx, x - 1.1 + (k % 4) * 0.7 + (k > 3 ? 0.3 : 0), y - 1.1 - (k > 3 ? 0.5 : 0) - rnd(m.id, k) * 0.35, 0.6, rnd(m.id, k + 5) * 3 - 1.5, MULCH_LEAVES[(k + m.id) % 5]);
      // Leaves hanging off it, swaying; a trail of them.
      for (const s of [-1, 0.5, 1.2]) leaf(ctx, x - d * 1.4 * Math.sign(s) * 0.9 + s * 0.2, y - 0.5 + Math.sin(t / 130 + s) * 0.12, 0.55, 1.2 * s, MULCH_LEAVES[(Math.abs(s) * 3) | 0]);
      // A brim of leaf over two eyes, the mouth a dark gap under it.
      ctx.fillStyle = "#150a04";
      ellipse(ctx, x + d * 1.15, y - 1.2, 0.5, 0.3);
      ctx.fill();
      leaf(ctx, x + d * 0.8, y - 1.85, 0.7, -d * 0.3, "#5c6a2a");
      eye(v, x + d * 1.0, y - 1.5, 0.16, EYE_AMBER);
      eye(v, x + d * 0.5, y - 1.55, 0.16, EYE_AMBER);
    }
  }

  /* ------------------------------------------------------- the keeper */

  // The lantern at (cx, cy) in the keeper's frame (y up, facing +x), a box of
  // 2.4 by 3: dull and shuttered, its slit a sullen red; or, as `open` swings
  // it wide, its shutter flung back on a blazing flame, a pulsing ring around
  // it and rays reaching out. `fire` (0 to 1) is the flame building to be
  // thrown. Returns nothing; the burning part also goes over the dark.
  function lantern(ctx, v, cx, cy, open, fire, t, flash) {
    const hot = open || fire > 0;
    if (hot && !flash) halo(ctx, cx, cy, open ? 4.6 : 2.6 + fire * 2.4, open ? "#ffd070" : FIRE_ORANGE, open ? 0.75 : 0.5);
    if (open && !flash) {
      // Rays and a ring, pulsing: the weak spot.
      const pulse = 0.5 + 0.5 * Math.sin(t / 90);
      ctx.strokeStyle = "#fff4c0";
      ctx.lineWidth = 0.22;
      ctx.globalAlpha = 0.55 + pulse * 0.4;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + t / 700;
        line(ctx, cx + Math.cos(a) * 2.4, cy + Math.sin(a) * 2.4, cx + Math.cos(a) * (3.2 + pulse * 0.6), cy + Math.sin(a) * (3.2 + pulse * 0.6));
      }
      ctx.lineWidth = 0.3;
      circle(ctx, cx, cy, 2.2 + pulse * 0.5);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // The cage: a cap, a base and four posts, the glass between.
    ctx.fillStyle = flash ? FLASH : IRON;
    ctx.beginPath();
    ctx.moveTo(cx - 1.1, cy + 1.5);
    ctx.lineTo(cx + 1.1, cy + 1.5);
    ctx.lineTo(cx + 0.55, cy + 2.1);
    ctx.lineTo(cx - 0.55, cy + 2.1);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - 1.2, cy - 1.6, 2.4, 0.4);
    ctx.fillStyle = flash ? FLASH : open ? "#ffe9a0" : hot ? "#b5501e" : "#5a3a1a";
    ctx.fillRect(cx - 0.95, cy - 1.2, 1.9, 2.7);
    if (!flash) {
      if (open || fire > 0) {
        // The flame: a tongue of yellow in orange, licking.
        const f = open ? 1 : 0.5 + fire * 0.9;
        const fl = Math.sin(t / 60) * 0.18;
        ctx.fillStyle = FIRE_ORANGE;
        ctx.beginPath();
        ctx.moveTo(cx - 0.8, cy - 1.2);
        ctx.quadraticCurveTo(cx - 0.7 + fl, cy + 0.2 * f, cx + fl, cy + 1.5 * f);
        ctx.quadraticCurveTo(cx + 0.7 - fl, cy + 0.1, cx + 0.8, cy - 1.2);
        ctx.fill();
        ctx.fillStyle = FIRE_HOT;
        ctx.beginPath();
        ctx.moveTo(cx - 0.4, cy - 1.2);
        ctx.quadraticCurveTo(cx - 0.3 + fl, cy, cx + fl * 0.5, cy + 0.9 * f);
        ctx.quadraticCurveTo(cx + 0.3, cy - 0.1, cx + 0.4, cy - 1.2);
        ctx.fill();
      } else {
        ctx.fillStyle = "#d8541c";
        ctx.fillRect(cx - 0.12, cy - 0.7, 0.24, 1.3);
      }
    }
    ctx.fillStyle = flash ? FLASH : IRON;
    for (const s of [-1, 1]) ctx.fillRect(cx + s * 0.95 - 0.12, cy - 1.2, 0.24, 2.7);
    if (open && !flash) {
      // The shutter flung back on its hinge, a dark door beside the glass.
      ctx.fillStyle = IRON;
      ctx.beginPath();
      ctx.moveTo(cx + 0.95, cy - 1.2);
      ctx.lineTo(cx + 2.1, cy - 1.7);
      ctx.lineTo(cx + 2.1, cy + 0.9);
      ctx.lineTo(cx + 0.95, cy + 1.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#4a3a22";
      ctx.fillRect(cx + 1.35, cy - 0.9, 0.3, 1.8);
    }
  }

  // The rusted mower under him, at the origin of his frame (y up, facing +x):
  // a big rear wheel and a small front one, a hood of flaking rust red with a
  // grille, a seat, a steering wheel and a deck low in front over a spinning
  // blade; the rev shakes it (exhaust puffing), the charge throws up grass
  // and dust, the stall smokes from the hood and sparks.
  function mower(ctx, v, b, t, flash) {
    const rev = b.act === "rev";
    const charge = b.act === "charge";
    const stall = b.act === "stall";
    const body = flash ? FLASH : RUST;
    const dark = flash ? FLASH : RUST_DARK;
    // The deck, its flap, and the blade turning under it.
    ctx.fillStyle = flash ? FLASH : "#5a5e60";
    ctx.fillRect(0.2, 0.6, 4.2, 1);
    ctx.fillStyle = flash ? FLASH : "#2a2a2a";
    ctx.fillRect(4, 0.2, 0.6, 1.3);
    const blade = Math.cos((t / (charge ? 20 : 45)) % TAU);
    ctx.strokeStyle = flash ? FLASH : STEEL;
    ctx.lineWidth = 0.25;
    line(ctx, 2.3 - blade * 1.9, 0.4, 2.3 + blade * 1.9, 0.4);
    // Wheels, spokes turning.
    const spin = charge ? t / 25 : rev ? t / 40 : 0;
    for (const [wx, wy, r] of [[-3.5, 3, 3], [4.1, 1.8, 1.8]]) {
      ctx.fillStyle = flash ? FLASH : "#15110d";
      circle(ctx, wx, wy, r);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#3a3028";
      circle(ctx, wx, wy, r * 0.72);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : RUST;
      circle(ctx, wx, wy, r * 0.42);
      ctx.fill();
      ctx.strokeStyle = flash ? FLASH : "#15110d";
      ctx.lineWidth = 0.25;
      for (let k = 0; k < 4; k++) {
        const a = spin + (k * Math.PI) / 2;
        line(ctx, wx, wy, wx + Math.cos(a) * r * 0.68, wy + Math.sin(a) * r * 0.68);
      }
      ctx.fillStyle = flash ? FLASH : "#15110d";
      circle(ctx, wx, wy, r * 0.12);
      ctx.fill();
    }
    // The frame and a rear body over the big wheel.
    ctx.fillStyle = flash ? FLASH : "#3a2a1c";
    ctx.fillRect(-5.6, 2.9, 11, 1.1);
    ctx.fillStyle = body;
    roundRect(ctx, -5.8, 3.6, 5.4, 1.6, 0.5);
    ctx.fill();
    // The hood: popped up a little (and hot) in a stall.
    ctx.save();
    if (stall) {
      ctx.translate(-0.2, 4);
      rotate(ctx, 0.2 + Math.sin(t / 55) * 0.05);
      ctx.translate(0.2, -4);
    }
    roundRect(ctx, -0.2, 4, 5.2, 2.6, 0.6);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#b8683a";
      ctx.fillRect(0, 6.35, 4.8, 0.25);
      ctx.fillStyle = dark;
      for (const [px, py, pw] of [[0.5, 5.2, 0.9], [2, 4.5, 1.3], [3.4, 5.8, 0.7], [1.3, 6, 0.6]]) ctx.fillRect(px, py, pw, 0.35);
      ctx.fillStyle = IRON;
      for (let k = 0; k < 5; k++) ctx.fillRect(4.1, 4.3 + k * 0.42, 0.8, 0.2);
    }
    ctx.restore();
    // The seat and the steering.
    ctx.fillStyle = flash ? FLASH : "#2a2018";
    roundRect(ctx, -4.4, 4.9, 3.2, 0.8, 0.3);
    ctx.fill();
    ctx.fillRect(-4.4, 5.4, 0.8, 2.2);
    ctx.strokeStyle = flash ? FLASH : "#4a4a48";
    ctx.lineWidth = 0.32;
    line(ctx, 1.8, 6.4, 1, 9.6);
    ctx.lineWidth = 0.4;
    ellipse(ctx, 1, 9.7, 1.1, 0.25, -0.3);
    ctx.stroke();
    // The exhaust and its puffs, the headlamp and the hook for the lantern.
    ctx.lineWidth = 0.45;
    line(ctx, -0.4, 6.6, -0.4, 9.4);
    ctx.fillStyle = flash ? FLASH : "#f0d890";
    circle(ctx, 5, 5.4, 0.4);
    ctx.fill();
    ctx.strokeStyle = flash ? FLASH : IRON;
    ctx.lineWidth = 0.25;
    line(ctx, 4.9, 6.3, 5.9, 6.3);
    if (!flash) {
      const puffs = stall ? 7 : rev ? 6 : charge ? 5 : 3;
      for (let k = 0; k < puffs; k++) {
        const p = (t / (stall ? 700 : rev ? 420 : 900) + k / puffs) % 1;
        ctx.fillStyle = stall ? "#3a3a3a" : "#5a5a58";
        ctx.globalAlpha = (1 - p) * (stall ? 0.7 : rev ? 0.6 : 0.3);
        circle(ctx, (stall ? 2.2 : -0.4) - p * (1 + (charge ? 4 : 0)) + Math.sin(p * 7 + k) * 0.3, (stall ? 6.8 : 9.6) + p * (stall ? 5.5 : 4), (stall ? 0.7 : 0.4) + p * (stall ? 1.5 : 0.9));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (charge) {
        // Grass and dirt flung out from the deck and a cloud of dust behind.
        for (let k = 0; k < 9; k++) {
          const p = (t / 220 + k / 9) % 1;
          ctx.fillStyle = k % 3 ? "#4f9a3c" : "#6a4a28";
          ctx.fillRect(4.6 - p * 9 - (k % 3) * 0.8, 1 + Math.sin(p * Math.PI) * (2.8 + (k % 4) * 0.6), 0.34, 0.24);
        }
        ctx.fillStyle = "#8a7a60";
        for (let k = 0; k < 4; k++) {
          const p = (t / 330 + k / 4) % 1;
          ctx.globalAlpha = (1 - p) * 0.35;
          ellipse(ctx, -6 - p * 5, 0.8 + p * 0.6, 1.3 + p * 1.5, 0.7 + p * 0.9);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      if (stall) {
        for (let k = 0; k < 6; k++) {
          const p = (t / 260 + k * 0.17) % 1;
          ctx.fillStyle = k % 2 ? FIRE_HOT : FIRE_ORANGE;
          ctx.fillRect(4.6 + p * 1.8 * (1 + (k % 3) * 0.4), 4.6 + Math.sin(p * Math.PI) * 2.2 - p * p * 2, 0.22, 0.22);
        }
      }
    }
  }

  // The Groundskeeper, standing at (b.x, b.y): a hulking old gardener in a
  // long oilcloth coat with a patched elbow, a straw hat gone to a brim of
  // tatters, hunched, a knotted face and a pale beard under it, a scythe in
  // his far hand, and in the near hand a lantern on a chain hung out in
  // front of him where a shot can reach it. Through the scythe's wind-up it
  // goes back over his shoulder and he leans away; the sweep brings it
  // down and out along the ground, and he stays low with it planted while the
  // lantern swings open (b.lit: its shutter back, the flame blazing, a ring
  // and rays around it, over the dark). The throw lifts the lantern behind
  // him, its fire building. Mounted (b.mower) he sits a smaller figure on
  // the rusted mower, the lantern hung from its bumper; he leans into the
  // charge and slumps against the stall.
  function keeper(ctx, v, b) {
    const { g } = v;
    const x = b.x;
    const y = g.FIELD_H - b.y;
    const t = v.clock;
    const flash = b.hurt > 0;
    const d = b.dir || 1;
    const mounted = Boolean(b.mower);
    const quick = mounted ? KEEPER_QUICK : 1;
    const pace = (v.spec && v.spec.pace) || 1;
    const E = (lx, ly, r, c) => eye(v, x + d * lx, y - ly, r, c);
    // Where he is in each move.
    const wind = b.act === "wind" ? clamp(1 - b.wait / ((SCYTHE_WIND_MS * quick) / pace), 0, 1) : 0;
    const swung = b.act === "rest" ? clamp(((SCYTHE_REST_MS * quick) / pace - b.wait) / 200, 0, 1) : 0;
    const resting = b.act === "rest";
    const throwP = b.act === "throwWind" ? clamp(1 - b.wait / ((LANTERN_WIND_MS * quick) / pace), 0, 1) : 0;
    const mountP = b.act === "mount" ? clamp(1 - b.wait / KEEPER_MOUNT_MS, 0, 1) : 1;
    const ease = (p) => p * p * (3 - 2 * p);
    // The scythe: the pole's angle and the blade's, in degrees. For a high
    // sweep it is raised overhead (not drawn back low) and swung level.
    const high = Boolean(b.high) && (b.act === "wind" || resting);
    const from = high ? 128 : 162;
    const phiFrom = high ? 50 : 80;
    let theta = 100;
    let phi = 12;
    if (b.act === "wind") {
      theta = mix(100, from, ease(wind));
      phi = mix(12, phiFrom, ease(wind));
    } else if (resting) {
      theta = mix(from, high ? 4 : -14, ease(swung));
      phi = mix(phiFrom, high ? -10 : -26, ease(swung));
    } else if (b.act === "charge") {
      theta = 168;
      phi = 80;
    }
    let lean = Math.sin(t / 800) * 0.12;
    if (b.act === "wind") lean = -wind * 1.5;
    else if (resting) lean = mix(-1.5, 1.2, ease(swung));
    else if (b.act === "throwWind") lean = -throwP * 1;
    else if (b.act === "rev") lean = Math.sin(t / 25) * 0.25;
    else if (b.act === "charge") lean = 1.4;
    else if (b.act === "stall") lean = 1 + Math.sin(t / 70) * 0.12;
    const open = Boolean(b.lit);
    // A high sweep's wind-up: a pale band hangs in the air ahead of him, from
    // SWEEP_LOW up, its lower edge dashed red. Stay under it.
    if (b.act === "wind" && b.high) {
      const x0 = x + d * (b.w / 2);
      ctx.fillStyle = "#c8e4f0";
      ctx.globalAlpha = 0.1 + wind * 0.2;
      ctx.fillRect(Math.min(x0, x0 + d * 80), y - SWEEP_TOP, 80, SWEEP_TOP - SWEEP_LOW);
      ctx.globalAlpha = 0.35 + wind * 0.5;
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.22;
      ctx.setLineDash([1.2, 0.8]);
      line(ctx, x0, y - SWEEP_LOW, x0 + d * 80, y - SWEEP_LOW);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d, -1);
    if (b.act === "rev") ctx.translate(Math.sin(t / 23) * 0.22, Math.abs(Math.sin(t / 31)) * 0.18);
    if (b.act === "stall") ctx.translate(Math.sin(t / 45) * 0.12, 0);
    if (mounted && b.act !== "mount") mower(ctx, v, b, t, flash);
    else if (b.act === "mount") {
      ctx.save();
      ctx.globalAlpha = ease(mountP);
      mower(ctx, v, b, t, flash);
      ctx.restore();
    }
    // The rider: scaled down on the mower, lifted onto its seat.
    const s = mounted ? 0.7 : 1;
    const lift = mounted ? mix(0, 3.6, ease(mountP)) + Math.sin(mountP * Math.PI) * (b.act === "mount" ? 2.5 : 0) : 0;
    const sx = mounted ? -2.2 : 0;
    ctx.save();
    ctx.translate(sx, lift);
    ctx.scale(s, s);
    const C = (c) => (flash ? FLASH : c);
    if (!mounted) {
      // Boots, and the trousers above them.
      ctx.fillStyle = C("#241c14");
      for (const bx of [-2.4, 0.9]) {
        roundRect(ctx, bx, 0, 2.5, 1.7, 0.5);
        ctx.fill();
        ellipse(ctx, bx + 2.4, 0.5, 0.5, 0.5);
        ctx.fill();
      }
      ctx.fillStyle = C("#28221a");
      ctx.fillRect(-2.2, 1.6, 1.9, 1.8);
      ctx.fillRect(1.1, 1.6, 1.9, 1.8);
    }
    // The far arm and the scythe, behind the coat.
    const hx = -0.6 + lean * 0.4 + (resting ? ease(swung) * 1.4 : 0);
    const hy = high ? (resting ? mix(12.8, 9.6, ease(swung)) : mix(8.4, 12.8, ease(wind))) : resting ? mix(8.4, 6.5, ease(swung)) : 8.4;
    const L = 12.6;
    const th = (theta * Math.PI) / 180;
    const ph = (phi * Math.PI) / 180;
    const tipX = hx + Math.cos(th) * L;
    const tipY = hy + Math.sin(th) * L;
    // A smear behind a swing in progress: the arc the blade has just crossed.
    if (resting && swung < 1 && swung > 0 && !flash) {
      ctx.strokeStyle = STEEL;
      ctx.lineWidth = 0.6;
      for (const [k, al] of [[0.35, 0.18], [0.22, 0.3], [0.1, 0.45]]) {
        ctx.globalAlpha = al;
        ctx.beginPath();
        ctx.arc(hx, hy, L + 2, (mix(from, high ? 4 : -14, ease(Math.max(0, swung - k))) * Math.PI) / 180, (theta * Math.PI) / 180, true);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = C("#7a5a34");
    ctx.lineCap = "round";
    ctx.lineWidth = 0.45;
    line(ctx, hx - Math.cos(th) * 1.6, hy - Math.sin(th) * 1.6, tipX, tipY);
    ctx.strokeStyle = C("#3a2814");
    ctx.lineWidth = 0.3;
    line(ctx, hx + Math.cos(th) * 3.2, hy + Math.sin(th) * 3.2, hx + Math.cos(th) * 3.2 + 0.3, hy + Math.sin(th) * 3.2 + 0.3);
    // The blade: a crescent off the pole's end, bowed away from the edge.
    const bl = 4.6;
    const ex = tipX + Math.cos(ph) * bl;
    const ey = tipY + Math.sin(ph) * bl;
    const cx = tipX + Math.cos(ph) * bl * 0.5 + Math.sin(ph) * 1.1;
    const cy = tipY + Math.sin(ph) * bl * 0.5 - Math.cos(ph) * 1.1;
    ctx.fillStyle = C(STEEL);
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.quadraticCurveTo(cx - Math.sin(ph) * 0.55 - Math.cos(ph) * 0.2, cy + Math.cos(ph) * 0.55 - Math.sin(ph) * 0.2, tipX, tipY);
    ctx.fill();
    ctx.strokeStyle = C("#f4f8fa");
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ctx.stroke();
    ctx.lineCap = "butt";
    // The coat: long, hunched, a ragged hem; its back darker, its front lit.
    const sh = lean;
    const coat = (col, inset) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-3.7 + inset, 2.3);
      ctx.lineTo(-4 + inset + sh * 0.1, 6);
      ctx.lineTo(-3.8 + inset + sh * 0.5, 9.5);
      ctx.lineTo(-3.4 + inset + sh * 0.8, 11.9);
      ctx.lineTo(-1.8 + sh, 13.2);
      ctx.lineTo(0.8 + sh, 13.1);
      ctx.lineTo(2.5 + sh, 12.3);
      ctx.lineTo(3.3 - inset + sh * 0.7, 10.2);
      ctx.lineTo(3.2 - inset + sh * 0.3, 6.5);
      ctx.lineTo(3.9 - inset, 2.3);
      for (let k = 0; k <= 8; k++) ctx.lineTo(3.9 - inset - k * ((7.6 - inset * 2) / 8), 2.3 + (k % 2 ? 0.55 : -0.1) + Math.sin(k * 2.3) * 0.18);
      ctx.closePath();
      ctx.fill();
    };
    coat(C(COAT_DARK), 0);
    coat(C(COAT), 0.5);
    // A hump of shoulders: a hulking man stooped over.
    ctx.fillStyle = C(COAT);
    ellipse(ctx, -0.9 + sh, 11.9, 3.1, 1.6, -0.12);
    ctx.fill();
    ctx.fillStyle = C(COAT_DARK);
    ellipse(ctx, -1.7 + sh, 11.5, 2.2, 1.2, -0.12);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = COAT_LIT;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      ctx.moveTo(2.4, 3);
      ctx.lineTo(3.1, 3);
      ctx.lineTo(2.6 + sh * 0.3, 6.5);
      ctx.lineTo(2.9 + sh * 0.7, 10.2);
      ctx.lineTo(2.1 + sh, 11.9);
      ctx.lineTo(1.8, 10);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      // The belt, its buckle, buttons, a pocket and a patch on the elbow.
      ctx.fillStyle = "#1c160e";
      ctx.fillRect(-3.5 + sh * 0.2, 6.6, 7.2, 0.9);
      ctx.fillStyle = "#b8943c";
      ctx.fillRect(0.8 + sh * 0.2, 6.55, 0.9, 1);
      ctx.fillStyle = COAT_LIT;
      for (const by of [8.4, 9.8, 11.2]) {
        circle(ctx, 2.2 + sh * 0.6 + (by - 8.4) * 0.05, by, 0.2);
        ctx.fill();
      }
      ctx.fillStyle = "#6a6040";
      ctx.fillRect(-2.6, 3.4, 2.3, 1.9);
      ctx.fillStyle = COAT_DARK;
      ctx.fillRect(-2.6, 5.2, 2.3, 0.2);
      ctx.fillStyle = "#4a4228";
      ctx.fillRect(-3.1 + sh * 0.5, 8.8, 1.6, 1.3);
      ctx.strokeStyle = "#1c1810";
      ctx.lineWidth = 0.1;
      for (const [px, py] of [[-3.1, 9.6], [-1.6, 10]]) line(ctx, px + sh * 0.5, py, px + sh * 0.5 + 0.2, py - 0.2);
    }
    // The far arm: a sleeve out to the hand on the scythe's handle.
    ctx.strokeStyle = C(COAT_DARK);
    ctx.lineCap = "round";
    ctx.lineWidth = 1.9;
    line(ctx, -0.6 + sh, 11.5, hx, hy + 0.3);
    ctx.lineCap = "butt";
    ctx.fillStyle = C("#7a6a50");
    circle(ctx, hx, hy, 0.85);
    ctx.fill();
    // The near arm: a thick sleeve out to the hand that holds the lantern.
    const lanternX = b.w / 2 - LANTERN_BACK;
    const lanternY = 3.2;
    let handX = 3.9 + sh * 0.3;
    let handY = 7.2;
    if (mounted) {
      handX = 4.6;
      handY = 8.6;
    }
    if (throwP > 0) {
      handX = mix(handX, -1.6, ease(throwP));
      handY = mix(handY, 14.8, ease(throwP));
    }
    ctx.strokeStyle = C(COAT_DARK);
    ctx.lineCap = "round";
    ctx.lineWidth = 2.3;
    line(ctx, 1 + sh, 11.4, handX, handY + 0.4);
    ctx.strokeStyle = C(COAT);
    ctx.lineWidth = 1.7;
    line(ctx, 1 + sh, 11.4, handX, handY + 0.4);
    ctx.lineCap = "butt";
    if (!flash) {
      ctx.fillStyle = "#4a4228";
      ctx.fillRect(mix(1 + sh, handX, 0.5) - 0.5, mix(11.4, handY, 0.5) - 0.5, 1, 1);
    }
    ctx.fillStyle = C(SKIN);
    circle(ctx, handX, handY, 0.8);
    ctx.fill();
    // His head, stooped forward: the face in the hat's shade, a hooked nose, a
    // scruff of pale beard, two sunken eyes.
    const hdx = 1.9 + sh;
    ctx.fillStyle = C("#8a7a5a");
    ellipse(ctx, hdx - 0.5, 12.3, 1.5, 1.2);
    ctx.fill();
    ctx.fillStyle = C(SKIN);
    ellipse(ctx, hdx, 12.9, 1.4, 1.55);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hdx + 1.1, 12.9);
    ctx.lineTo(hdx + 2.1, 12.2);
    ctx.lineTo(hdx + 1.2, 12.1);
    ctx.fill();
    ctx.fillStyle = C("#d6d0bc");
    ctx.beginPath();
    ctx.moveTo(hdx - 0.8, 12.2);
    ctx.lineTo(hdx + 1.5, 12.2);
    ctx.lineTo(hdx + 1.2, 11.2);
    ctx.lineTo(hdx + 0.4, 10.4);
    ctx.lineTo(hdx - 0.6, 11.2);
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#1a1208";
      ctx.globalAlpha = 0.55;
      ellipse(ctx, hdx, 13.9, 1.7, 0.6);
      ctx.fill();
      ctx.globalAlpha = 1;
      for (const s of [0.55, 1.35]) {
        ellipse(ctx, hdx + s, 13.15, 0.3, 0.22);
        ctx.fill();
      }
    }
    // The hat: a wide brim gone ragged with a crown, a band and a hole, a
    // weed sprouting from it.
    ctx.fillStyle = C("#5a4824");
    ellipse(ctx, hdx, 14.35, 4.7, 0.62);
    ctx.fill();
    ctx.fillStyle = C(STRAW);
    ellipse(ctx, hdx, 14.55, 4.7, 0.6);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hdx - 2, 14.6);
    ctx.quadraticCurveTo(hdx - 1.9, 16.5, hdx, 16.55);
    ctx.quadraticCurveTo(hdx + 1.9, 16.5, hdx + 2, 14.6);
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#2a2014";
      ctx.fillRect(hdx - 2, 14.8, 4, 0.55);
      ctx.fillStyle = "#6a5428";
      ellipse(ctx, hdx + 0.7, 15.7, 0.45, 0.3);
      ctx.fill();
      ctx.fillStyle = "#08060a";
      ellipse(ctx, hdx + 0.7, 15.7, 0.3, 0.18);
      ctx.fill();
      ctx.strokeStyle = "#4f9a3c";
      ctx.lineWidth = 0.14;
      line(ctx, hdx - 0.9, 16.3, hdx - 1.5, 17.3);
      line(ctx, hdx - 0.8, 16.3, hdx - 0.5, 17.4);
      ctx.strokeStyle = "#8a7430";
      for (const k of [-4.1, -2.8, 3.1, 4.2]) line(ctx, hdx + k, 14.5, hdx + k + (k > 0 ? 0.5 : -0.5), 14.1);
    }
    ctx.restore();
    // The lantern: on a chain from his hand (or the mower's bumper); lifted
    // behind him, burning, while he winds up the throw.
    let lx = lanternX;
    let ly = lanternY;
    if (throwP > 0) {
      const hp = ease(throwP);
      lx = mix(lanternX, -1.6 * s + sx, hp);
      ly = mix(lanternY, 11.6 * s + lift, hp) + Math.sin(t / 70) * hp * 0.3;
    }
    const topY = ly + 2.1;
    ctx.strokeStyle = flash ? FLASH : "#3a3028";
    ctx.lineWidth = 0.14;
    if (mounted && throwP === 0) {
      line(ctx, 5.9, 6.3, lx, topY);
    } else if (throwP === 0) {
      ctx.save();
      ctx.translate(0, lift);
      line(ctx, handX, handY * s - lift * 0, lx, topY);
      ctx.restore();
    } else line(ctx, mix(lanternX, handX * s + sx, ease(throwP)), mix(topY, handY * s + lift, ease(throwP)), lx, topY);
    lantern(ctx, v, lx, ly, open, throwP, t, flash);
    ctx.restore();
    // Eyes, and the flame, burn over the dark.
    if (!flash) {
      const ex = (1.9 + lean) * s + sx;
      const ey = 12.9 * s + lift;
      E(ex + 0.55 * s, ey + 0.25 * s, 0.14, b.act === "rev" || b.act === "charge" ? "#ff5a1a" : EYE_AMBER);
      E(ex + 1.35 * s, ey + 0.25 * s, 0.14, b.act === "rev" || b.act === "charge" ? "#ff5a1a" : EYE_AMBER);
      if (open) E(lx, ly, 0.95, "#ffe9a0");
      else if (throwP > 0) E(lx, ly, 0.4 + throwP * 0.7, FIRE_ORANGE);
      if (mounted && (b.act === "rev" || b.act === "charge")) E(5.1, 4.4, 0.45, "#f0d890");
    }
  }

  /* ------------------------------------------------- waves and hazards */

  // The scythe's sweep on the floor: a tall silver crescent running the way it
  // was swung, its edge bright, motes of grass and dust trailing off it, `y`
  // the floor on screen.
  function scytheWave(ctx, v, w, y) {
    const d = w.dir;
    ctx.fillStyle = "#8aa0ac";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(w.x - d * 2.2, y);
    ctx.quadraticCurveTo(w.x - d * 1.2, y - 2.7, w.x + d * 1.4, y - 2.5);
    ctx.quadraticCurveTo(w.x + d * 0.1, y - 1.3, w.x - d * 0.4, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = STEEL;
    ctx.beginPath();
    ctx.moveTo(w.x - d * 1.4, y - 0.1);
    ctx.quadraticCurveTo(w.x - d * 0.6, y - 2, w.x + d * 1.4, y - 2.5);
    ctx.quadraticCurveTo(w.x + d * 0.1, y - 1.1, w.x - d * 0.1, y - 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f4f8fa";
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(w.x - d * 1.2, y - 0.3);
    ctx.quadraticCurveTo(w.x - d * 0.5, y - 2.1, w.x + d * 1.4, y - 2.5);
    ctx.stroke();
    for (let k = 0; k < 7; k++) {
      const f = (v.clock / 160 + k / 7) % 1;
      ctx.globalAlpha = (1 - f) * 0.8;
      ctx.fillStyle = k % 3 ? "#7ac060" : "#9aa8b0";
      ctx.fillRect(w.x - d * (1.6 + f * 4) , y - 0.25 - ((k * 37) % 10) * 0.1 - f * 0.6, 0.3, 0.2);
    }
    ctx.globalAlpha = 1;
  }

  // A high sweep: the same silver crescent, stretched tall and hung in the air
  // from SWEEP_LOW up, a pale halo around it, `y` the floor on screen.
  function sweep(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    halo(ctx, h.x, fy - (SWEEP_LOW + SWEEP_TOP) / 2, 6, "#c8e4f0", 0.3);
    ctx.save();
    ctx.translate(h.x, fy - SWEEP_LOW - 0.2);
    ctx.scale(1.5, 3.2);
    scytheWave(ctx, v, { x: 0, dir: h.dir }, 0);
    ctx.restore();
  }

  // One lantern thrown: tumbling end over end, its flame streaming back.
  function thrownLantern(ctx, v, bx, by, dir, spin) {
    for (let k = 3; k >= 1; k--) {
      ctx.globalAlpha = 0.5 - k * 0.1;
      ctx.fillStyle = k % 2 ? FIRE_RED : FIRE_ORANGE;
      circle(ctx, bx - dir * k * 1.1, by + k * 0.35, 0.95 - k * 0.15);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    halo(ctx, bx, by, 3.2, FIRE_ORANGE, 0.6);
    ctx.save();
    ctx.translate(bx, by);
    rotate(ctx, spin);
    ctx.fillStyle = IRON;
    ctx.fillRect(-0.7, -0.9, 1.4, 1.8);
    ctx.fillStyle = FIRE_HOT;
    ctx.fillRect(-0.45, -0.65, 0.9, 1.3);
    ctx.fillStyle = FIRE_ORANGE;
    ctx.fillRect(-0.2, -0.65, 0.4, 0.5);
    ctx.restore();
    eye(v, bx, by, 0.5, FIRE_HOT);
  }

  // The lantern's fire: in the air as the lantern itself, tumbling in an arc
  // from his belt to where it will come down, a ring on the floor marking
  // the spot and closing in; then a patch of burning grass: scorched earth,
  // flame in three layers swaying and licking up, embers rising, burning
  // down in its last moments.
  function fire(ctx, v, h) {
    const { g } = v;
    const fy = g.FIELD_H - h.y;
    if (h.warn > 0) {
      const p = 1 - h.warn / FIRE_FLIGHT_MS;
      const bx = h.sx + (h.x - h.sx) * p;
      const by = g.FIELD_H - (h.sy + (h.y - h.sy) * p + Math.sin(p * Math.PI) * 14);
      ctx.strokeStyle = "rgba(255, 150, 50, 0.7)";
      ctx.lineWidth = 0.3;
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.3 - p * 0.3), 0.55);
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 120, 40, 0.18)";
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.3 - p * 0.3), 0.55);
      ctx.fill();
      thrownLantern(ctx, v, bx, by, Math.sign(h.x - h.sx) || 1, v.clock / 70);
      return;
    }
    const fade = Math.min(1, h.live / 500);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#1a0c06";
    ellipse(ctx, h.x, fy - 0.1, h.w / 2 + 0.3, 0.5);
    ctx.fill();
    ctx.fillStyle = "#8a2a10";
    ctx.globalAlpha = fade * 0.5;
    ellipse(ctx, h.x, fy - 0.15, h.w / 2 - 0.3, 0.35);
    ctx.fill();
    ctx.globalAlpha = fade;
    const tongues = 9;
    for (const [layer, color, hs, ws] of [[0, FIRE_RED, 1, 1], [1, FIRE_ORANGE, 0.78, 0.72], [2, FIRE_HOT, 0.5, 0.44]]) {
      for (let k = 0; k < tongues; k++) {
        const fx = h.x - h.w / 2 + 0.5 + (k * (h.w - 1)) / (tongues - 1);
        const flick = Math.abs(Math.sin(v.clock / 80 + k * 1.7 + layer));
        const tall = h.h * hs * (0.5 + flick * 0.5) * (1 - (Math.abs(k - (tongues - 1) / 2) / tongues) * 0.7);
        const sway = Math.sin(v.clock / 110 + k * 2.1) * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(fx - 0.6 * ws, fy);
        ctx.quadraticCurveTo(fx - 0.4 * ws, fy - tall * 0.55, fx + sway, fy - tall);
        ctx.quadraticCurveTo(fx + 0.4 * ws, fy - tall * 0.5, fx + 0.6 * ws, fy);
        ctx.fill();
      }
    }
    for (let k = 0; k < 6; k++) {
      const p = (v.clock / 900 + k / 6) % 1;
      ctx.fillStyle = k % 2 ? FIRE_HOT : FIRE_ORANGE;
      ctx.globalAlpha = fade * (1 - p);
      ctx.fillRect(h.x - h.w / 2 + 0.6 + ((k * 53) % 100) * 0.01 * (h.w - 1.2) + Math.sin(p * 7 + k) * 0.4, fy - h.h * 0.5 - p * 5, 0.25, 0.25);
    }
    ctx.globalAlpha = 1;
    eye(v, h.x, fy - 0.8, 0.4 * fade, FIRE_HOT);
  }

  // The Hedge shears' badge (inside the ring every power-up shares): two
  // crossed blades and their round handles, in the ink already set.
  function shears(ctx, x, y) {
    ctx.lineWidth = 0.28;
    line(ctx, x - 0.8, y + 0.7, x + 0.9, y - 0.9);
    line(ctx, x - 0.8, y - 0.7, x + 0.9, y + 0.9);
    for (const s of [-1, 1]) {
      circle(ctx, x - 0.95, y + s * 0.78, 0.3);
      ctx.stroke();
    }
  }

  // What lights the dark here: a moth's soft glow, the burning patch, a root's
  // red warning, the Groundskeeper's lantern (a wide blaze in the open, a
  // flame kindling for the throw), the mower's headlamp and its sparks.
  function lights(v, add) {
    for (const m of v.round.monsters) {
      if (m.kind === "moth") add(m.x, m.y + 0.7, 3.6, 0.5);
      else if (m.kind === "rootling" && m.act === "warn") add(m.x, m.y + 0.5, 3.4, 0.35);
    }
    for (const h of v.round.hazards) if (h.kind === "fire") add(h.x, h.y + (h.warn > 0 ? 1 + Math.sin((1 - h.warn / FIRE_FLIGHT_MS) * Math.PI) * 14 : 1.5), h.warn > 0 ? 5 : 8, h.warn > 0 ? 0.8 : 0.85 * Math.min(1, h.live / 400));
    const b = v.round.boss;
    if (b && b.kind === "keeper" && b.state !== "down") {
      const lx = b.x + b.dir * (b.w / 2 - 0.6);
      add(lx, b.y + 3.2, b.lit ? 10 : 4.5, b.lit ? 0.95 : 0.4);
      if (b.mower && (b.act === "rev" || b.act === "charge")) add(b.x + b.dir * 7, b.y + 4.4, 9, 0.55);
    }
  }

  /* ------------------------------------------------------------- events */

  // What the Grounds' events look and sound like, beside ghoul-draw.js's own:
  // true when `e` was one of them. `k` is the same kit react() is handed.
  function react(e, k) {
    const { tone, burst, float, ring, flash, glow, shake, fx } = k;
    if (e.type === "rustle") {
      if (gate(fx, "rustleMs", 260)) say(tone, e.kind, "rustle", 0.35);
      burst(e.x, e.y - 1, LEAF_LIT, 5, 6, 250);
    } else if (e.type === "freeze") {
      if (gate(fx, "freezeMs", 260)) say(tone, e.kind, "freeze", 0.3);
    } else if (e.type === "rootWarn") {
      say(tone, e.kind, "warn", 0.35);
      float(e.x, e.y + 4, "!", DANGER, 2.6);
    } else if (e.type === "rootUp") {
      say(tone, e.kind, "up", 0.45);
      burst(e.x, e.y + 0.5, DIRT, 10, 10, 400);
      shake(120, 0.3);
    } else if (e.type === "leaves") {
      say(tone, e.kind, "leaves", 0.4);
      burst(e.x, e.y + 1, MULCH, 12, 10, 450);
    } else if (e.type === "snip") {
      say(tone, "shears", "snip", 0.45);
      burst(e.x, e.y, LEAF_LIT, 12, 12, 450);
      float(e.x, e.y + 3, "Snip!", GOLD, 2.2);
    } else if (e.type === "scytheWind") {
      say(tone, e.kind, "scytheWind", 0.5);
      if (e.high) float(e.x, e.y + 5, "Stay low!", DANGER, 2.4);
    }
    else if (e.type === "scytheSweep") {
      say(tone, e.kind, "scytheSweep", 0.55);
      shake(160, 0.4);
    } else if (e.type === "lanternWind") {
      say(tone, e.kind, "lanternWind", 0.4);
      glow(e.x, e.y, 6, 0.5, 400);
    } else if (e.type === "lanternThrow") {
      say(tone, e.kind, "lanternThrow", 0.5);
      ring(e.tx, e.ty, "#ffb43c", 1, 5, 700);
      if (e.tx2 !== undefined) ring(e.tx2, e.ty2, "#ffb43c", 1, 5, 700);
    } else if (e.type === "fireLand") {
      // Two patches land together: one sound.
      if (gate(fx, "fireMs", 200)) say(tone, "keeper", "fire", 0.5);
      burst(e.x, e.y + 0.5, FIRE_RED, 14, 12, 500);
      glow(e.x, e.y + 1, 9, 0.7, 500);
      shake(180, 0.5);
    } else if (e.type === "mothCall") {
      float(e.x, e.y + 5, "Moths!", GOLD, 2.2);
      glow(e.x, e.y, 7, 0.6, 500);
    } else if (e.type === "lanternOpen") {
      if (gate(fx, "openMs", 400)) say(tone, e.kind, "lanternOpen", 0.35);
      glow(e.x, e.y, 6, 0.6, 300);
    } else if (e.type === "keeperMower") {
      say(tone, e.kind, "mower", 0.8);
      flash("#c8a24a", 300);
      shake(400, 0.8);
      k.banner("On the mower", "Hold the shelves when he revs", "#c8a24a", 1600);
    } else if (e.type === "mowerRev") {
      say(tone, e.kind, "rev", 0.6);
      float(e.x, e.y + 8, "He revs", DANGER, 2.4);
    } else if (e.type === "mowerCharge") {
      say(tone, e.kind, "charge", 0.6);
    } else if (e.type === "mowerStall") {
      say(tone, e.kind, "stall", 0.7);
      shake(400, 0.9);
      burst(e.x, e.y, FIRE_HOT, 14, 14, 500);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    monsters: freeze({ topiary, rootling, moth, mulch }),
    bosses: freeze({ keeper }),
    missiles: freeze({}),
    hazards: freeze({ fire, sweep }),
    waves: freeze({ scythe: scytheWave }),
    powers: freeze({ shears }),
    lights,
    react,
  });
}
