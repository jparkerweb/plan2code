// Plan2Code Web Console - Ghoul Rush's Bog Runner, its drawing: a fan-boat skim down a black channel through the night swamp. A pale low moon and a few stars, drowned cypress trees that scroll by at their own speeds, mist, the black water of the channel in front and the raised mud flats behind it (joined by a mud ramp at each bank), sunken snags, cypress knees, moss veils and low limbs, the hag's charms hanging on strings, gas pockets bubbling up, the fan boat with its caged propeller and the leech swarm that boils in its wake.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain
// data (the voices are the room's own tones, in ghoul-sfx-bogboat.js); bogboatArt(d) takes
// ghoul-draw.js's drawing helpers (`d`) and hands back the drawing by kind, so this file never
// reaches back into it. Drawn in room units, the way ghoul-draw.js draws: y counted down from
// the field's top, so a world height `y` is drawn at `FIELD_H - y`. The still layers are only
// the sky's color: the world is drawn by `moving` (every frame, over them; no cached layers, no
// random numbers: everything comes from a hash), the lows, the bow, the mist, the signs and the
// two gauges in front of Planny by `front`. What the art reads off the rules (ghoul-bogboat.js):
//
// - the room: `spec.ride` ({ banks, snags, knees, veils, limbs, props, gas, checks, finish }),
//   the flat floor in `spec.ground`.
// - `round.runner` (id "bogboat"; null in any other room): `lane`, `from`, `swMs`, `h`, `air`,
//   `v`, `gap`, `panic`, `clog`, `stall`, `done`, `restX`, `check`, `props` [{ state "up" |
//   "broken" }], `gas` [{ state "up" | "burst" | "spent", t }].
// - Planny: `you.x`, `you.y`, `you.vy`, `you.ducking`.
// - events leave short-lived bits in the view's `fx` (`bogboatBits`, `bogboatLand`).

import { CLOG_MAX, CLOG_WARN, GAP_MAX, GAS_BURST_MS, GAS_H, GAS_UP, GAS_W, KNEE_W, LANE_Y, LOW_Y, PANIC_ON, PROP_H, PROP_UP, SNAG_W, WAKE_CATCH, baseOf, laneNow } from "./ghoul-bogboat.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const water = (o) => freeze({ pack: "bogboat", custom: true, noMoon: true, pit: "#010303", ...o });
export const LOOKS = freeze({
  bogboat: water({ wallTop: "#04080c", wallLow: "#0d1a22", paper: "#16262e", wainscot: "#0a1216", floorTop: "#2c3a3e", floor: "#182226", floorEdge: "#060a0c", shelf: "#242c28", shelfTop: "#3c4a42", window: "#bcd6d0", decor: "plants", color: "#8aa8b4", dark: 0.5 }),
});

// How each new kind sounds, by act (the room's own tones, ghoul-sfx-bogboat.js).
export const VOICES = freeze({
  bogboat: freeze({ jump: "ghoulBogboatJump", land: "ghoulBogboatLand", duck: "ghoulBogboatDuck", switch: "ghoulBogboatSwitch", crash: "ghoulBogboatCrash", check: "ghoulBogboatCheck", finish: "ghoulBogboatFinish" }),
  bogboatwake: freeze({ panic: "ghoulBogboatPanic", catch: "ghoulBogboatCatch" }),
  bogboatfan: freeze({ clog: "ghoulBogboatClog", stall: "ghoulBogboatStall" }),
  bogboatshot: freeze({ gas: "ghoulBogboatGas", prop: "ghoulBogboatProp" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  bogboatJump: ["bogboat", "jump"],
  bogboatLand: ["bogboat", "land"],
  bogboatDuck: ["bogboat", "duck"],
  bogboatSwitch: ["bogboat", "switch"],
  bogboatCrash: ["bogboat", "crash"],
  bogboatCheck: ["bogboat", "check"],
  bogboatFinish: ["bogboat", "finish"],
  bogboatPanic: ["bogboatwake", "panic"],
  bogboatCatch: ["bogboatwake", "catch"],
  bogboatClog: ["bogboatfan", "clog"],
  bogboatStall: ["bogboatfan", "stall"],
  bogboatGas: ["bogboatshot", "gas"],
  bogboatProp: ["bogboatshot", "prop"],
});
export const LOSE_WORDS = freeze({ snag: "Ran onto a snag", knee: "Hit the cypress knees", veil: "Tangled in moss", limb: "Ducked too late", wake: "Swarmed" });
export const LOSE_SOUNDS = freeze({
  snag: ["smash", 0.6, 0.7],
  knee: ["clank", 0.5, 0.6],
  veil: ["squish", 0.45, 0.8],
  limb: ["clank", 0.5, 0.8],
  wake: ["squish", 0.5, 0.7],
});

const FW = 96;
const WATER_Y = LANE_Y[0];
const FLATS_Y = LANE_Y[1];
let FH = 54;
const MOSS = "#3a5a34";
const MOSS_D = "#223a22";
const MUD = "#3a2d1c";
const MUD_D = "#1c150c";
const MUD_LIT = "#6a5632";
const WOOD = "#3a2e1e";
const WOOD_D = "#1e160e";
const HULL = "#2e3a3a";
const HULL_LIT = "#52666a";
const RUST = "#7a3a1e";
const SWARM = "#1a1210";
const GAS = "#c8f06a";
const BONE = "#d8d0b8";

// A number in 0..1 from two integers, the same every time (no random draws).
const rnd = (a, b = 0) => {
  let h = Math.imul((a | 0) + 0x9e37, 0x85ebca6b) ^ Math.imul((b | 0) + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
const poly = (c, pts) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
};
const seg = (c, x0, y0, x1, y1) => {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.stroke();
};
const disc = (c, x, y, r) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
};
const grad = (make, stops) => {
  const g = make ? make() : null;
  if (!g || typeof g.addColorStop !== "function") return stops[stops.length >> 1][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
const vgrad = (c, y0, y1, stops) => grad(c.createLinearGradient && (() => c.createLinearGradient(0, y0, 0, y1)), stops);
const rgrad = (c, x, y, r, stops) => grad(c.createRadialGradient && (() => c.createRadialGradient(x, y, 0, x, y, r)), stops);
const Y = (y) => FH - y;
// A soft glow: a radial gradient, a flat disc where the canvas cannot do one.
function halo(ctx, x, y, r, color, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgrad(ctx, x, y, r, [[0, color], [1, "rgba(0,0,0,0)"]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------- telegraphs */

// What to do about each obstacle, shown as a glyph that fades in ahead of it, for the lane the
// boat is in: JUMP (an arrow up, cyan) over snags and cypress knees, DUCK (an arrow down, amber)
// under moss veils and limbs, SHOOT (a crosshair, red) at the first gas pockets. Everything comes
// from the room's `ride` fields and where the boat is (no random numbers, no rules).
export const TELEGRAPH_SEE = 40;
export const TELEGRAPH_FULL = 30;
export const TELEGRAPH_WORDS = 3;
export const TELEGRAPH_ALPHA = 0.78;
export const SHOOT_GLYPHS = 4;
export const ANSWERS = freeze({ snag: "JUMP", knee: "JUMP", veil: "DUCK", limb: "DUCK", gas: "SHOOT" });
export const ANSWER_COLORS = freeze({ JUMP: "#5fe3ff", DUCK: "#ffb02e", SHOOT: "#ff6a6a" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lane, lead (where it begins), x (its middle), up (height of
// the glyph's anchor), n (which of its kind), answer }, in the room's order. Only the first SHOOT_GLYPHS
// gas pockets of the ride are marked: the lesson, then the player knows.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lane, lead, x, up) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lane, lead, x, up: LANE_Y[lane] + up, n, answer: ANSWERS[kind] });
  };
  for (const [x, lane] of R.snags) add("snag", lane, x - 3, x, 7.6);
  for (const [x, lane] of R.knees) add("knee", lane, x - 3.4, x, 6.2);
  for (const [x0, x1, lane] of R.veils) add("veil", lane, x0 - 3.2, (x0 + x1) / 2, 7.4);
  for (const [x0, x1, lane] of R.limbs) add("limb", lane, x0 - 3.2, (x0 + x1) / 2, 7.4);
  for (const [x, lane] of R.gas) add("gas", lane, x - 2, x, 8);
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out.filter((m) => m.kind !== "gas" || m.n < SHOOT_GLYPHS));
  return marks.get(R);
}

// The glyphs showing with the boat at `x` in `lane`: { ...mark, alpha (0..1, before the pulse), words }.
export function telegraphs(R, x, lane) {
  const out = [];
  for (const m of telegraphMarks(R)) {
    if (m.lane !== lane) continue;
    const d = m.lead - x;
    if (d > TELEGRAPH_SEE || d < -6) continue;
    const alpha = Math.min(clamp((TELEGRAPH_SEE - d) / (TELEGRAPH_SEE - TELEGRAPH_FULL), 0, 1), clamp((d + 4) / 6, 0, 1));
    if (alpha > 0.01) out.push({ ...m, alpha, words: m.n < TELEGRAPH_WORDS });
  }
  return out;
}

/* --------------------------------------------------------------------- art */

export function bogboatArt(d) {
  const { ellipse, say, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "bogboat" ? v.spec.ride : null);
  const runner = (v) => (v.round && v.round.runner && v.round.runner.id === "bogboat" ? v.round.runner : null);

  // The still layers get only the sky's color; `moving` draws the world.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  function ground() {}
  function shelf() {}

  /* ---------------------------------------------------------- the sky and far scenery */

  function sky(ctx, v, cam) {
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#03070a"], [0.55, "#0c1a20"], [1, "#1c3036"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    for (let k = 0; k < 34; k++) {
      const x = cam + ((((rnd(k, 1) * FW - cam * 0.02) % FW) + FW) % FW);
      ctx.globalAlpha = 0.18 + 0.4 * rnd(k, 3) * (0.7 + 0.3 * Math.sin(v.clock / 600 + k));
      ctx.fillStyle = "#cfe2dc";
      ctx.fillRect(x, rnd(k, 2) * 24, 0.2, 0.2);
    }
    ctx.globalAlpha = 1;
    // The moon: low, pale green and smeared by mist, riding with the view.
    const mx = cam + 68;
    halo(ctx, mx, 11, 15, "rgba(170,215,200,0.5)", 0.5);
    ctx.fillStyle = "#d4ece4";
    disc(ctx, mx, 11, 3.8);
    ctx.fillStyle = "rgba(120,160,150,0.45)";
    disc(ctx, mx - 1.1, 10.4, 0.9);
    disc(ctx, mx + 1, 12, 0.6);
    ctx.fillStyle = "rgba(10,22,26,0.5)";
    for (let k = 0; k < 3; k++) ellipse(ctx, cam + ((((rnd(k, 9) * 140 - v.clock / 110 - cam * 0.05) % 140) + 140) % 140) - 20, 9 + k * 2.6, 12 + rnd(k, 4) * 6, 0.55);
    ctx.fill();
  }

  // Drowned cypresses at a slow parallax: a trunk, flared foot, a few bare limbs and a hanging rag of moss.
  function trees(ctx, cam, par, base, scale, color, seed) {
    const u0 = cam * par;
    const gap = 17;
    for (let slot = Math.floor((u0 - 6) / gap); slot <= Math.floor((u0 + FW + 8) / gap); slot++) {
      const r = rnd(slot, seed);
      if (r < 0.18) continue;
      const x = cam + (slot * gap - u0) + r * 7;
      const h = (9 + rnd(slot, seed + 1) * 9) * scale;
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      poly(ctx, [[x - 1.1 * scale, base], [x - 0.35 * scale, base - h], [x + 0.35 * scale, base - h], [x + 1.1 * scale, base]]);
      ctx.fill();
      ctx.lineWidth = 0.3 * scale;
      for (let k = 0; k < 3; k++) {
        const dir = (k + slot) % 2 ? 1 : -1;
        seg(ctx, x, base - h * (0.5 + k * 0.17), x + dir * (2.6 - k * 0.5) * scale, base - h * (0.6 + k * 0.17));
      }
      ctx.lineWidth = 0.16 * scale;
      for (let k = 0; k < 3; k++) seg(ctx, x + (k - 1) * 0.9 * scale, base - h * 0.62, x + (k - 1) * 0.95 * scale, base - h * 0.62 + (2 + rnd(slot, k + 5) * 2) * scale);
    }
  }

  // Mist: low soft bands drifting along the water.
  function mist(ctx, v, cam, alpha) {
    for (let k = 0; k < 5; k++) {
      const x = cam + ((((rnd(k, 21) * FW * 1.4 - v.clock / (900 + k * 150) - cam * 0.1) % (FW * 1.4)) + FW * 1.4) % (FW * 1.4)) - 14;
      ctx.globalAlpha = alpha * (0.6 + 0.4 * rnd(k, 22));
      ctx.fillStyle = "#9cb8b0";
      ellipse(ctx, x, Y(WATER_Y + 1.2 + k * 1.6), 16 + rnd(k, 23) * 8, 1.1 + k * 0.25);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- the water and the flats */

  // The channel: black water with the moon's sheen sliding by and the raised mud flats behind it.
  function channel(ctx, v, cam, R) {
    const top = Y(WATER_Y);
    ctx.fillStyle = vgrad(ctx, top, FH, [[0, "#0c1e22"], [0.25, "#061014"], [1, "#020608"]]);
    ctx.fillRect(cam - 1, top, FW + 2, WATER_Y + 1);
    ctx.fillStyle = "rgba(150,200,190,0.16)";
    for (let k = Math.floor(cam / 3.2); k < Math.floor((cam + FW) / 3.2) + 1; k++) {
      if (rnd(k, 31) < 0.4) continue;
      ctx.fillRect(k * 3.2 + Math.sin(v.clock / 700 + k) * 0.6, top + 0.5 + rnd(k, 34) * 6, 0.9 + rnd(k, 35) * 1.6, 0.18);
    }
    // The flats: a raised terrace of mud behind the channel, gleaming, reeds along its top.
    const fy = Y(FLATS_Y);
    ctx.fillStyle = vgrad(ctx, fy, top, [[0, MUD_LIT], [0.1, MUD], [1, MUD_D]]);
    ctx.fillRect(cam - 1, fy, FW + 2, top - fy + 0.1);
    ctx.fillStyle = "rgba(180,170,120,0.22)";
    for (let k = Math.floor(cam / 4); k < Math.floor((cam + FW) / 4) + 1; k++) ctx.fillRect(k * 4 + rnd(k, 41) * 2, fy + 0.5 + rnd(k, 42) * 3.4, 1.6 + rnd(k, 43), 0.2);
    ctx.fillStyle = "#4a5a34";
    ctx.fillRect(cam - 1, fy, FW + 2, 0.35);
    ctx.strokeStyle = "#5a6a3a";
    ctx.lineWidth = 0.14;
    for (let k = Math.floor(cam / 2.2); k < Math.floor((cam + FW) / 2.2) + 1; k++) {
      if (rnd(k, 44) < 0.4) continue;
      const h = 1.4 + rnd(k, 45) * 1.6;
      seg(ctx, k * 2.2, fy + 0.2, k * 2.2 + Math.sin(v.clock / 900 + k) * 0.3, fy - h);
    }
    ctx.fillStyle = "#14201c";
    ctx.fillRect(cam - 1, top - 0.9, FW + 2, 0.9);
    ctx.fillStyle = "#2c4a44";
    ctx.fillRect(cam - 1, top - 0.9, FW + 2, 0.18);
    // At each bank the edge is a mud ramp, with chevrons pointing up it.
    for (const [a, b] of R.banks) {
      if (b < cam - 4 || a > cam + FW + 4) continue;
      ctx.fillStyle = "#2a2012";
      poly(ctx, [[a, top], [a, fy], [b, fy]]);
      ctx.fill();
      ctx.strokeStyle = "#6a5632";
      ctx.lineWidth = 0.35;
      seg(ctx, a, top, b, fy);
      ctx.strokeStyle = "rgba(200,230,170,0.55)";
      ctx.lineWidth = 0.22;
      for (let k = 0; k < 3; k++) {
        const cx = a + 3 + k * 4.2;
        const cy = top - ((cx - a) / (b - a)) * (top - fy) - 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - 0.8, cy + 0.6);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx - 0.8, cy - 0.6);
        ctx.stroke();
      }
    }
  }

  // A bank's posts: a leaning stake with a dim green lantern at each end of the ramp.
  function bankPosts(ctx, v, a, b) {
    for (const [px, lit] of [[a - 0.4, 1], [b + 0.4, 0]]) {
      ctx.fillStyle = WOOD;
      ctx.fillRect(px - 0.4, Y(WATER_Y + 4.4), 0.8, 4.4);
      ctx.fillStyle = "#7dffa0";
      ctx.globalAlpha = 0.65 + 0.25 * Math.sin(v.clock / 330 + lit);
      disc(ctx, px, Y(WATER_Y + 5.1), 0.5);
      ctx.globalAlpha = 1;
      halo(ctx, px, Y(WATER_Y + 5.1), 4, "rgba(125,255,160,0.8)", 0.3);
    }
  }

  /* ---------------------------------------------------------------- the things */

  // A sunken snag: a rotting log lying across the lane, a broken stub up, weed on it.
  function snag(ctx, x, lane, i) {
    const y = Y(LANE_Y[lane]);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, 0, 0.05, SNAG_W * 0.9, 0.3);
    ctx.fill();
    ctx.fillStyle = WOOD;
    poly(ctx, [[-1.7, 0], [-1.5, -1.2], [-0.4, -1.5], [0.6, -3.8], [1.3, -3.9], [1.4, -1.6], [1.8, -1.0], [1.7, 0]]);
    ctx.fill();
    ctx.fillStyle = WOOD_D;
    ctx.fillRect(-1.7, -0.5, 3.4, 0.5);
    ctx.fillStyle = "#5a4a32";
    ctx.fillRect(0.7, -3.8, 0.35, 2.4);
    ctx.strokeStyle = MOSS;
    ctx.lineWidth = 0.14;
    for (let k = 0; k < 3; k++) seg(ctx, -1.2 + k * 1.1, -1.3, -1.2 + k * 1.1 + Math.sin(i + k) * 0.4, -2.3 - rnd(i, k) * 0.6);
    ctx.restore();
  }

  // Cypress knees: three gray cones breaking the surface, wet at the foot.
  function knees(ctx, x, lane, i) {
    const y = Y(LANE_Y[lane]);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, 0, 0.05, KNEE_W * 0.6, 0.3);
    ctx.fill();
    [[-1.6, 1.7, 1.2], [0, 2.4, 1.5], [1.7, 1.5, 1.1]].forEach(([dx, h, w], k) => {
      ctx.fillStyle = k % 2 ? "#5a5a48" : "#4a4a3a";
      poly(ctx, [[dx - w / 2, 0], [dx - w * 0.15, -h], [dx + w * 0.15, -h * 0.95], [dx + w / 2, 0]]);
      ctx.fill();
      ctx.fillStyle = "rgba(180,200,190,0.18)";
      ctx.fillRect(dx - w / 2, -0.3, w, 0.3);
    });
    ctx.restore();
  }

  // A curtain of moss hung from a cypress limb: its underside LOW_Y over the lane.
  function veil(ctx, v, x0, x1, lane, i) {
    const under = Y(LANE_Y[lane]) - LOW_Y;
    const tx = x1 + 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0e0a06";
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(tx, FH + 1);
    ctx.quadraticCurveTo(tx + 0.5, under + 6, tx - 0.3, under - 3);
    ctx.stroke();
    ctx.lineWidth = 0.7;
    seg(ctx, tx - 0.2, under - 1.8, x0 - 2, under - 1.2);
    ctx.lineCap = "butt";
    for (let k = 0; k < 11; k++) {
      const hx = x0 - 1.5 + (k * (x1 - x0 + 3)) / 10;
      const len = 1.0 + rnd(i * 13 + k, 2) * 2.2;
      const sway = Math.sin(v.clock / 520 + hx) * 0.35;
      ctx.strokeStyle = k % 2 ? MOSS : MOSS_D;
      ctx.lineWidth = 0.3;
      seg(ctx, hx, under - 1.2, hx + sway, under + len);
    }
  }

  // A low cypress limb: twisted, bare, with a few moss rags.
  function limb(ctx, v, x0, x1, lane, i) {
    const under = Y(LANE_Y[lane]) - LOW_Y;
    const tx = x1 + 3.4;
    ctx.lineCap = "round";
    for (const [col, extra] of [["rgba(150,190,180,0.35)", 0.3], ["#0e0a06", 0]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.8 + extra;
      ctx.beginPath();
      ctx.moveTo(tx, FH + 1);
      ctx.quadraticCurveTo(tx + 0.6, under + 6, tx - 0.4, under - 2.4);
      ctx.stroke();
      ctx.lineWidth = 0.95 + extra;
      ctx.beginPath();
      ctx.moveTo(tx - 0.2, under - 1);
      ctx.quadraticCurveTo(x1 - 1, under - 1.8, x0 - 2.4, under - 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#0e0a06";
    ctx.lineWidth = 0.4;
    seg(ctx, x0 + 1.2, under - 0.8, x0 - 0.2, under + 0.6);
    ctx.lineCap = "butt";
    for (let k = 0; k < 4; k++) {
      const hx = x0 - 1.4 + k * ((x1 - x0 + 3) / 3);
      ctx.strokeStyle = k % 2 ? MOSS : MOSS_D;
      ctx.lineWidth = 0.22;
      seg(ctx, hx, under - 0.3, hx + Math.sin(v.clock / 480 + hx) * 0.25, under + 0.8 + rnd(i * 7 + k, 3) * 1.4);
    }
  }

  // One of the hag's charms on a string from a bent pole: a skull (kind 0) or a blue bottle (kind 1).
  function prop(ctx, v, x, lane, kind, p, i) {
    const base = Y(LANE_Y[lane]);
    const sway = Math.sin(v.clock / 600 + i * 1.7) * 0.45;
    const top = base - PROP_UP - PROP_H - 3.2;
    ctx.strokeStyle = WOOD;
    ctx.lineWidth = 0.3;
    seg(ctx, x + 3, base + 0.4, x + 3, top);
    seg(ctx, x + 3, top, x + sway * 0.3, top - 0.4);
    ctx.strokeStyle = "#8a7a5a";
    ctx.lineWidth = 0.1;
    seg(ctx, x + sway * 0.3, top - 0.4, x + sway, base - PROP_UP - PROP_H - 0.2);
    if (p.state === "broken") return;
    const cy = base - PROP_UP - PROP_H / 2;
    if (kind === 0) {
      ctx.fillStyle = BONE;
      disc(ctx, x + sway, cy - 0.2, 1.05);
      ctx.fillRect(x + sway - 0.6, cy + 0.6, 1.2, 0.8);
      ctx.fillStyle = "#14100c";
      ctx.fillRect(x + sway - 0.55, cy - 0.45, 0.4, 0.45);
      ctx.fillRect(x + sway + 0.15, cy - 0.45, 0.4, 0.45);
    } else {
      ctx.fillStyle = "#4a8cc8";
      poly(ctx, [[x + sway - 0.4, cy - 1.2], [x + sway + 0.4, cy - 1.2], [x + sway + 0.4, cy - 0.4], [x + sway + 1.0, cy + 0.2], [x + sway + 1.0, cy + 1.2], [x + sway - 1.0, cy + 1.2], [x + sway - 1.0, cy + 0.2], [x + sway - 0.4, cy - 0.4]]);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillRect(x + sway - 0.7, cy + 0.1, 0.25, 0.9);
    }
    halo(ctx, x + sway, cy, 3, "rgba(190,230,255,0.8)", 0.22);
  }

  // A gas pocket: a cluster of sickly bubbles rising over the lane; once shot, a cloud that spreads and thins.
  function gasPocket(ctx, v, x, lane, g, i) {
    const cy = Y(LANE_Y[lane] + GAS_UP + GAS_H / 2);
    if (g.state === "spent") return;
    if (g.state === "burst") {
      const p = 1 - g.t / GAS_BURST_MS;
      ctx.fillStyle = GAS;
      for (let k = 0; k < 9; k++) {
        ctx.globalAlpha = (1 - p) * 0.42;
        disc(ctx, x + (rnd(k, 51) - 0.5) * (3 + p * 11), cy + (rnd(k, 52) - 0.6) * (2 + p * 4), 1.2 + p * 2.2);
      }
      ctx.globalAlpha = 1;
      return;
    }
    halo(ctx, x, cy, 4.4, "rgba(200,240,100,0.9)", 0.3 + 0.1 * Math.sin(v.clock / 260 + i));
    for (let k = 0; k < 6; k++) {
      const ph = ((v.clock / 1300 + rnd(i, k + 60)) % 1);
      const bx = x + (rnd(i * 5 + k, 53) - 0.5) * GAS_W * 0.8;
      const by = cy + GAS_H * 0.5 - ph * GAS_H;
      ctx.globalAlpha = 0.85 * Math.sin(ph * Math.PI);
      ctx.strokeStyle = GAS;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.arc(bx, by, 0.5 + rnd(i * 3 + k, 54) * 0.7, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // A checkpoint: a stake across the channel with a black pennant and a gold star, lit once passed.
  function checkpoint(ctx, v, x, passed) {
    const top = Y(30);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x - 0.3, top, 0.6, Y(WATER_Y) - top);
    ctx.fillStyle = passed ? "#244a30" : "#10181a";
    poly(ctx, [[x + 0.3, top + 0.4], [x + 6, top + 0.4 + Math.sin(v.clock / 300) * 0.3], [x + 5, top + 3.4], [x + 6, top + 6.2], [x + 0.3, top + 6.2]]);
    ctx.fill();
    ctx.fillStyle = passed ? "#7dffa0" : GOLD;
    const sx = x + 3;
    const sy = top + 3.2;
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 0.5 : 1.3;
      ctx.lineTo(sx + Math.sin((k * Math.PI) / 5) * r, sy - Math.cos((k * Math.PI) / 5) * r);
    }
    ctx.closePath();
    ctx.fill();
    halo(ctx, sx, sy, 5, passed ? "rgba(125,255,160,0.8)" : "rgba(255,210,90,0.8)", 0.3);
  }

  // The landing at the end of the channel: a plank pier on stilts with two lantern posts and the stilt shack's door.
  function landing(ctx, v, x) {
    const gy = Y(WATER_Y);
    ctx.fillStyle = WOOD;
    ctx.fillRect(x - 12, gy - 0.9, 28, 0.9);
    ctx.fillStyle = WOOD_D;
    for (let k = -3; k <= 3; k++) ctx.fillRect(x + k * 4, gy, 0.7, 4);
    for (const px of [x - 6, x + 8]) {
      ctx.fillStyle = WOOD;
      ctx.fillRect(px - 0.4, gy - 8, 0.8, 7.1);
      ctx.fillStyle = "#ffcf5a";
      ctx.globalAlpha = 0.8 + 0.15 * Math.sin(v.clock / 200 + px);
      disc(ctx, px, gy - 8.6, 0.7);
      ctx.globalAlpha = 1;
      halo(ctx, px, gy - 8.6, 6, "rgba(255,200,90,0.9)", 0.35);
    }
    ctx.fillStyle = "#1c150c";
    ctx.fillRect(x + 1, gy - 12, 6, 11.1);
    ctx.fillStyle = "#6a4a28";
    ctx.fillRect(x + 2.2, gy - 9.6, 3.6, 8.7);
    ctx.fillStyle = "#ffcf5a";
    ctx.fillRect(x + 4.8, gy - 5, 0.5, 0.5);
    poly(ctx, [[x, gy - 12], [x + 4, gy - 15.4], [x + 8, gy - 12]]);
    ctx.fillStyle = "#2a2012";
    ctx.fill();
  }

  /* ------------------------------------------------------------------ the swarm */

  // The leech swarm boiling in the wake: dark blobs and flicking tails just under the surface, `gap` units
  // behind the boat, thicker and higher the closer it is, red eyes once it is close.
  function swarm(ctx, v, c, x, base) {
    const near = clamp(1 - (c.gap - WAKE_CATCH) / (GAP_MAX - WAKE_CATCH), 0, 1);
    const sx = x - c.gap;
    const n = 9 + Math.round(near * 16);
    const boil = c.panic ? 1 : 0.35;
    ctx.fillStyle = SWARM;
    for (let k = 0; k < n; k++) {
      const wob = Math.sin(v.clock / (110 + k * 17) + k * 2.3);
      const bx = sx + (rnd(k, 71) - 0.5) * (6 + near * 10) + wob * 0.9 * boil;
      const by = base + 0.6 - Math.abs(Math.sin(v.clock / (170 + k * 23) + k)) * (0.8 + near * 2.2) * boil;
      ellipse(ctx, bx, by, 1.3 + rnd(k, 72) * 1.1, 0.55 + rnd(k, 73) * 0.4);
      ctx.fill();
      if (c.panic && k % 3 === 0) {
        ctx.fillStyle = "#ff4a3a";
        ctx.fillRect(bx + 0.3, by - 0.3, 0.32, 0.32);
        ctx.fillStyle = SWARM;
      }
    }
    ctx.strokeStyle = "rgba(150,200,190,0.5)";
    ctx.lineWidth = 0.14;
    for (let k = 0; k < 4; k++) {
      const p = (v.clock / 600 + k / 4) % 1;
      ctx.globalAlpha = (1 - p) * (0.3 + near * 0.4);
      ctx.beginPath();
      ctx.arc(sx + (k - 1.5) * 1.8, base + 0.2, 0.6 + p * 2.2, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------------------- the boat */

  // The boat's transform: at Planny's feet (the water under it), tilted nose up on the way up, a gentle bob.
  function place(ctx, v, c, fn) {
    const you = v.round.you;
    const x = c.done ? c.restX : you.x;
    const y = c.done ? WATER_Y : you.y;
    const tilt = c.air ? clamp(c.vy / 320, -0.16, 0.16) : 0;
    const bob = !c.done && !c.air ? Math.sin(v.clock / 260) * 0.12 : 0;
    ctx.save();
    ctx.translate(x, Y(y) + bob);
    ctx.rotate(-tilt);
    fn(x);
    ctx.restore();
  }

  // The back: the hull, the fan's cage on its mast with the blades turning, the spray it throws, the lantern.
  function boatBack(ctx, v, c, x) {
    const speed = clamp(c.v / 40, 0, 1.2);
    // The spray and the wake behind the stern.
    if (!c.done) {
      for (let k = 0; k < 7; k++) {
        const p = (v.clock / 480 + k / 7) % 1;
        ctx.fillStyle = `rgba(190,225,215,${(1 - p) * 0.42 * speed})`;
        disc(ctx, -9.5 - p * 8 * speed - 1, 0.1 - Math.sin(p * Math.PI) * (1 + speed * 1.4), 0.3 + p * 0.8);
      }
      ctx.strokeStyle = "rgba(190,225,215,0.35)";
      ctx.lineWidth = 0.16;
      seg(ctx, -8, 0.15, -8 - 12 * speed, 0.3);
      seg(ctx, -7, 0.55, -7 - 8 * speed, 0.7);
    }
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, -2, 0.1, 8, 0.4);
    ctx.fill();
    // The flat hull: a long dark tub with a rusted patch and a pale gunwale line.
    ctx.fillStyle = HULL;
    poly(ctx, [[-8.6, -0.1], [-8.6, -2.1], [-7.2, -2.7], [4.6, -2.7], [6.2, -1.9], [6.4, -0.1]]);
    ctx.fill();
    ctx.fillStyle = "#1c2626";
    ctx.fillRect(-8.6, -0.7, 15, 0.7);
    ctx.fillStyle = RUST;
    ctx.fillRect(-3.8, -2.0, 2.1, 0.9);
    ctx.fillStyle = HULL_LIT;
    ctx.fillRect(-7.2, -2.8, 11.8, 0.3);
    // The fan's mast and cage at the stern, the blades a flicker of spokes.
    ctx.fillStyle = "#2a3030";
    ctx.fillRect(-8.4, -7.4, 0.8, 4.8);
    ctx.fillRect(-9.2, -2.9, 2.4, 0.5);
    ctx.strokeStyle = "#7a8a86";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.arc(-8, -6.1, 2.4, 0, TAU);
    ctx.stroke();
    const a = c.done || c.stall > 0 ? 0 : v.clock / 28;
    ctx.lineWidth = 0.22;
    for (let k = 0; k < 3; k++) seg(ctx, -8, -6.1, -8 + Math.cos(a + (k * TAU) / 3) * 2.2 * 0.3, -6.1 + Math.sin(a + (k * TAU) / 3) * 2.2);
    ctx.fillStyle = "#4a5a58";
    disc(ctx, -8, -6.1, 0.35);
    if (c.stall > 0 && !c.done) {
      ctx.fillStyle = MUD;
      disc(ctx, -8, -6.1, 1.1);
      ctx.fillStyle = "rgba(60,46,28,0.7)";
      disc(ctx, -9.2, -4.6, 0.7);
    }
    // A lantern on a post at the bow, glowing.
    ctx.fillStyle = "#2a3030";
    ctx.fillRect(5.2, -4.8, 0.4, 2.2);
    ctx.fillStyle = "#e8ffb0";
    disc(ctx, 5.4, -5.1, 0.6);
    halo(ctx, 5.4, -5.1, 7, "rgba(210,255,150,0.9)", 0.4);
  }

  // The front: the gunwale over Planny's legs and the low windshield.
  function boatFront(ctx) {
    ctx.fillStyle = HULL;
    poly(ctx, [[-2.6, -0.4], [4.4, -0.4], [4.4, -2.1], [3.6, -2.4], [-2.6, -2.4]]);
    ctx.fill();
    ctx.fillStyle = HULL_LIT;
    ctx.fillRect(-2.5, -2.45, 6.1, 0.22);
    ctx.fillStyle = "#1c2626";
    ctx.fillRect(-2.6, -0.9, 7, 0.5);
    ctx.strokeStyle = "#7a8a86";
    ctx.lineWidth = 0.22;
    seg(ctx, 3.6, -2.4, 3.2, -4.4);
    ctx.fillStyle = "rgba(150,200,210,0.2)";
    poly(ctx, [[3.4, -2.5], [3.1, -4.2], [2.2, -4.2], [2.5, -2.5]]);
    ctx.fill();
  }

  /* ----------------------------------------------------------------- mist and signs */

  // A see-through glyph over an obstacle: chevrons or a crosshair, and (for the first few) the word.
  function glyph(ctx, v, t) {
    const col = ANSWER_COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const cy = Math.min(FH - 7, FH - t.up) + Math.sin(v.clock / 260 + t.lead) * 0.35;
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (t.answer === "SHOOT") {
      for (const [w, c] of [[1.2, "rgba(2,8,10,0.8)"], [0.5, col]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(t.x, cy - 1.2, 1.5, 0, TAU);
        ctx.stroke();
        seg(ctx, t.x - 2.4, cy - 1.2, t.x - 0.6, cy - 1.2);
        seg(ctx, t.x + 0.6, cy - 1.2, t.x + 2.4, cy - 1.2);
        seg(ctx, t.x, cy - 3.6, t.x, cy - 1.8);
        seg(ctx, t.x, cy - 0.6, t.x, cy + 1.2);
      }
      if (t.words) label(ctx, "SHOOT", t.x, cy + 2.4, 2.1, col, "center");
    } else {
      const up = t.answer === "JUMP";
      const dir = up ? -1 : 1;
      const ay = cy + (up ? -2.6 : 2.6);
      for (const [w, c] of [[1.3, "rgba(2,8,10,0.8)"], [0.6, col]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        for (let k = 0; k < 2; k++) {
          const oy = ay + (k - 0.5) * 1.5 * dir - dir * 0.2;
          ctx.beginPath();
          ctx.moveTo(t.x - 1.7, oy - dir * 0.9);
          ctx.lineTo(t.x, oy + dir * 0.9);
          ctx.lineTo(t.x + 1.7, oy - dir * 0.9);
          ctx.stroke();
        }
      }
      if (t.words) label(ctx, t.answer, t.x, cy + (up ? 1.2 : -1.2), 2.3, col, "center");
    }
    ctx.restore();
  }

  // The wake meter across the top (the swarm at one end, the boat at the other, red as they close,
  // THEY ARE CLOSE inside PANIC_ON) and the fan's clog gauge beside it.
  function gauges(ctx, v, c, cam) {
    const x = cam + 2.4;
    const y = 3.2;
    const W = 34;
    const p = clamp((c.gap - WAKE_CATCH) / (GAP_MAX - WAKE_CATCH), 0, 1);
    ctx.fillStyle = "rgba(2,8,10,0.72)";
    ctx.fillRect(x - 0.6, y - 1, W + 1.2, 8.2);
    ctx.fillStyle = "#16222a";
    ctx.fillRect(x + 6, y + 0.2, W - 12, 1.7);
    const close = c.gap < PANIC_ON;
    const pulse = close ? 0.65 + 0.35 * Math.sin(v.clock / 110) : 1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = close ? "#ff4a3a" : p < 0.55 ? "#ffb02e" : "#7dffa0";
    ctx.fillRect(x + 6, y + 0.2, (W - 12) * p, 1.7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = SWARM;
    ellipse(ctx, x + 2.4, y + 1.1, 1.6, 0.75);
    ctx.fill();
    if (close) {
      ctx.fillStyle = "#ff4a3a";
      ctx.fillRect(x + 2.9, y + 0.7, 0.3, 0.3);
    }
    ctx.fillStyle = HULL_LIT;
    poly(ctx, [[x + W - 5, y + 1.8], [x + W - 4.4, y + 0.5], [x + W - 1.4, y + 0.5], [x + W - 0.6, y + 1.8]]);
    ctx.fill();
    label(ctx, close ? "THEY ARE CLOSE" : "WAKE", x + 6, y + 4, 1.5, close ? "#ff6a6a" : "#bcd6d0", "left");
    // The clog gauge.
    const q = c.clog / CLOG_MAX;
    const hot = c.clog >= CLOG_WARN || c.stall > 0;
    ctx.fillStyle = "#16222a";
    ctx.fillRect(x + 6, y + 5.3, W - 12, 1.3);
    ctx.globalAlpha = hot ? 0.6 + 0.4 * Math.sin(v.clock / 100) : 1;
    ctx.fillStyle = hot ? "#ff5a3a" : q > 0.4 ? "#ffb02e" : "#9ac8b8";
    ctx.fillRect(x + 6, y + 5.3, (W - 12) * q, 1.3);
    ctx.globalAlpha = 1;
    label(ctx, c.stall > 0 ? "STALLED" : "FAN", x, y + 6.6, 1.3, c.stall > 0 ? "#ff6a6a" : "#bcd6d0", "left");
  }

  /* ------------------------------------------------------------------- the room */

  const lanePass = (ctx, v, R, c, cam, lane) => {
    const lo = cam - 12;
    const hi = cam + FW + 12;
    R.snags.forEach(([x, l], i) => {
      if (l === lane && x > lo && x < hi) snag(ctx, x, l, i);
    });
    R.knees.forEach(([x, l], i) => {
      if (l === lane && x > lo && x < hi) knees(ctx, x, l, i);
    });
    R.props.forEach(([x, l, kind], i) => {
      if (l === lane && x > lo && x < hi) prop(ctx, v, x, l, kind, c.props[i], i);
    });
    R.gas.forEach(([x, l], i) => {
      if (l === lane && x > lo && x < hi) gasPocket(ctx, v, x, l, c.gas[i], i);
    });
  };

  // The whole world, over the still layers: sky, trees, water and flats, the things by lane, the boat, the swarm.
  function moving(ctx, v, cam) {
    const R = ride(v);
    const c = runner(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    sky(ctx, v, cam);
    trees(ctx, cam, 0.14, Y(FLATS_Y + 1), 0.8, "#0a161a", 3);
    trees(ctx, cam, 0.3, Y(FLATS_Y + 0.6), 1.15, "#0e1e22", 7);
    mist(ctx, v, cam, 0.16);
    channel(ctx, v, cam, R);
    R.banks.forEach(([a, b]) => {
      if (b > cam - 4 && a < cam + FW + 4) bankPosts(ctx, v, a, b);
    });
    R.checks.forEach((x, i) => {
      if (x > cam - 8 && x < cam + FW + 8) checkpoint(ctx, v, x, i <= c.check);
    });
    if (R.finish > cam - 20 && R.finish < cam + FW + 20) landing(ctx, v, R.finish + 16);
    const here = laneNow(c);
    const inWater = c.done || here === 0;
    lanePass(ctx, v, R, c, cam, 1);
    if (!inWater) swarm(ctx, v, c, v.round.you.x, Y(baseOf(c)));
    if (!inWater) place(ctx, v, c, (x) => boatBack(ctx, v, c, x));
    lanePass(ctx, v, R, c, cam, 0);
    if (inWater && !c.done) swarm(ctx, v, c, v.round.you.x, Y(baseOf(c)));
    if (inWater) place(ctx, v, c, (x) => boatBack(ctx, v, c, x));
    // A landing's splash.
    const fx = v.fx;
    const land = fx && fx.bogboatLand !== undefined ? fx.clock - fx.bogboatLand.t0 : 1e9;
    if (land < 380) {
      const p = land / 380;
      ctx.fillStyle = `rgba(170,210,200,${(1 - p) * 0.7})`;
      for (let k = 0; k < 8; k++) disc(ctx, v.round.you.x + (k - 3.5) * 1.1 * (0.6 + p * 1.5), Y(baseOf(c)) - 0.3 - p * (0.8 + rnd(k, 4) * 1.4), 0.3 + p * 0.3);
    }
  }

  // In front of Planny: the gunwale, the lows (veils and limbs), the splinters, the mist, the signs, the gauges.
  function front(ctx, v) {
    const R = ride(v);
    const c = runner(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const round = v.round;
    const cam = Math.round(round.camX * 8) / 8;
    place(ctx, v, c, () => boatFront(ctx));
    R.veils.forEach(([x0, x1, lane], i) => {
      if (x1 >= cam - 10 && x0 <= cam + FW + 10) veil(ctx, v, x0, x1, lane, i);
    });
    R.limbs.forEach(([x0, x1, lane], i) => {
      if (x1 >= cam - 10 && x0 <= cam + FW + 10) limb(ctx, v, x0, x1, lane, i);
    });
    mist(ctx, v, cam, 0.12);
    if (!c.done) for (const t of telegraphs(R, round.you.x, laneNow(c))) glyph(ctx, v, t);
    const bits = v.fx && v.fx.bogboatBits;
    if (bits) {
      for (const b of bits) {
        const t = (v.fx.clock - b.t0) / 1000;
        if (t < 0 || t > 0.9) continue;
        ctx.save();
        ctx.translate(b.x + b.vx * t, FH - (b.y + b.vy * t - 30 * t * t));
        ctx.rotate(b.rot + b.vr * t);
        ctx.globalAlpha = clamp(1.6 - t * 1.6, 0, 1);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -0.12, b.w, 0.24);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    gauges(ctx, v, c, cam);
  }

  const dim = () => 0;

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const c = runner(v);
    if (!R || !c) return;
    const round = v.round;
    const you = round.you;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    // The bow lantern's pool on the water ahead and its warmth over the boat.
    add(you.x + 6, you.y + 2.4, 14, 0.7);
    add(you.x - 3, you.y + 3, 8, 0.4);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 3, 26, 9, i <= c.check ? 0.55 : 0.4);
    });
    R.banks.forEach(([a, b]) => {
      if (b > lo && a < hi) {
        add(a - 0.4, WATER_Y + 5, 5, 0.35);
        add(b + 0.4, WATER_Y + 5, 5, 0.35);
      }
    });
    R.gas.forEach(([x, lane], i) => {
      if (x > lo && x < hi && c.gas[i].state === "up") add(x, LANE_Y[lane] + GAS_UP + 1.6, 5, 0.4);
    });
    if (R.finish > lo - 20 && R.finish < hi) add(R.finish + 16, 18, 14, 0.6);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Splinters of wood and weed flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.bogboatBits = (fx.bogboatBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.bogboatBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    if (e.type === "bogboatDuck" && !gateOnce(fx, "bogboatDuckMs", 160)) return true;
    say(k.tone, voice[0], voice[1], 0.5);
    const SPRAY = "#9cc4b8";
    switch (e.type) {
      case "bogboatJump":
        burst(e.x, e.y, SPRAY, 5, 7, 300);
        break;
      case "bogboatLand":
        fx.bogboatLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, SPRAY, e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(180, 0.45);
        break;
      case "bogboatSwitch":
        burst(e.x, e.y, MUD_LIT, 6, 8, 320);
        float(e.x, e.y + 6, e.to ? "Flats" : "Channel", "#7dffa0", 2);
        break;
      case "bogboatCrash":
        shake(320, 1);
        flash("#b8e0d0", 200);
        burst(e.x, e.y + 1, e.what === "veil" ? MOSS : "#6a5a3a", 18, 17, 520);
        burst(e.x, e.y + 1, SPRAY, 8, 14, 360);
        splinter(fx, e.x, e.y + 2, e.what === "veil" ? [MOSS, MOSS_D] : ["#2a1e14", "#4a3c28", "#5a5a48"]);
        break;
      case "bogboatCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "bogboatFinish":
        shake(240, 0.6);
        burst(e.x, e.y, SPRAY, 14, 13, 560);
        float(e.x, e.y + 6, "Made it!", GOLD, 2.6);
        break;
      case "bogboatPanic":
        flash("#102018", 220);
        float(e.x, e.y + 8, "They are close!", "#ff6a6a", 2.4);
        break;
      case "bogboatCatch":
        shake(300, 0.9);
        flash("#3a0a0a", 240);
        burst(e.x - 8, e.y, SWARM, 14, 12, 460);
        float(e.x, e.y + 7, "Swarmed!", "#ff6a6a", 2.4);
        break;
      case "bogboatClog":
        float(e.x, e.y + 8, "The fan is clogging", "#ffb02e", 2.2);
        break;
      case "bogboatStall":
        shake(200, 0.5);
        burst(e.x - 8, e.y + 3, MUD, 10, 9, 420);
        float(e.x, e.y + 8, "Stalled!", "#ff6a6a", 2.4);
        break;
      case "bogboatGas":
        flash("#e8ff9a", 140);
        burst(e.x, e.y, GAS, 14, 13, 520);
        ring(e.x, e.y, GAS, 1, 9, 420);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "bogboatProp":
        burst(e.x, e.y, e.kind ? "#4a8cc8" : BONE, 12, 12, 440);
        splinter(fx, e.x, e.y, e.kind ? ["#4a8cc8", "#9cd0ff"] : [BONE, "#8a7a5a"]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      default:
        break;
    }
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    front,
    moving,
    dim,
    monsters: freeze({}),
    bosses: freeze({}),
    missiles: freeze({}),
    hazards: freeze({}),
    powers: freeze({}),
    lights,
    react,
  });
}
