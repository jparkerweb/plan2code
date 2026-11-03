// Plan2Code Web Console - Ghoul Rush's Gardener's Revenge, its drawing: a night ride on a rusty ride-on mower down a long overgrown lawn. A moon and stars, the manor on its hill and a far row of topiary and iron railings that scroll by at different speeds, the lawn with its mow stripes, ponds and ha-ha ditches, the things on it (tall grass that is cut as the blades pass, weeds, thorn hedges, gnomes, barrows, flowerpots, snapping topiary beasts, checkpoint lanterns, the finish gate), and in front the mower itself with its blades and heat gauge, the hedge arches and clothes lines of gloves, the lawn gauge and the glyphs that say what to do about what is coming.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain data
// (the sounds are in ghoul-sfx-mower.js); mowerArt(d) takes ghoul-draw.js's drawing helpers (`d`) and
// hands back the drawing by kind, so this file never reaches back into it. Drawn in room units, the way
// ghoul-draw.js draws: y counted down from the field's top, so a world height `y` is drawn at
// `FIELD_H - y`. The still layers' pit is dark under the whole ride, so the sky, the far scenery, the
// lawn and what stands on it are drawn by `moving` (every frame, over the cached still layers):
// parallax tiles and lawn chunks are cached in offscreen canvases of this file's own (no random
// numbers: everything comes from a hash). The lows, the mower and the gauges are drawn by `front`.
// What the art reads off the rules (ghoul-mower.js):
//
// - the room: `spec.ride` ({ track, gaps, junk, lows [x0, x1, y, kind], hedges, beasts, grass,
//   weeds, checks, finish }), `spec.ground` (the lawn at the start and at the end).
// - `round.runner` (id "mower"; null in any other room): `v`, `line` (-1 in the air), `check`, `done`,
//   `heat`, `jam` (ms left), `blade` (down), `lawn` (0 to 1), `grass` [[cut cells]], `hedges` [cut],
//   `weeds` [cut], `beasts` [{ state "idle" | "warn" | "snap" | "sink" | "spent" | "broken", t }].
// - Planny: `you.state`, `you.vy` (tilts the mower in the air), `you.ducking`, `you.x`, `you.y`.
// - events leave short-lived bits in the view's `fx` (`mowerBits`, `mowerLand`).

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "mower", custom: true, noMoon: true, pit: "#05090a", ...o });
export const LOOKS = freeze({
  mower: pit({ wallTop: "#04080f", wallLow: "#1b2d33", paper: "#0e1a12", wainscot: "#0a160c", floorTop: "#4c8a34", floor: "#2a2012", floorEdge: "#080c06", shelf: "#2a4a22", shelfTop: "#437a34", window: "#e8f0d8", decor: "plants", color: "#9fe08a", dark: 0.5 }),
});

// How each new kind sounds, by act (the sounds are in ghoul-sfx-mower.js).
export const VOICES = freeze({
  mower: freeze({ jump: "ghoulMowerJump", land: "ghoulMowerLand", duck: "ghoulMowerDuck", crash: "ghoulMowerCrash", check: "ghoulMowerCheck", finish: "ghoulMowerFinish", grass: "ghoulMowerGrass", hedge: "ghoulMowerHedge", weed: "ghoulMowerWeed", jam: "ghoulMowerJam" }),
  mowerbeast: freeze({ warn: "ghoulMowerBeastWarn", snap: "ghoulMowerBeastSnap", hit: "ghoulMowerBeastHit", break: "ghoulMowerBeastBreak" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  mowerJump: ["mower", "jump"],
  mowerLand: ["mower", "land"],
  mowerDuck: ["mower", "duck"],
  mowerCrash: ["mower", "crash"],
  mowerCheck: ["mower", "check"],
  mowerFinish: ["mower", "finish"],
  mowerGrass: ["mower", "grass"],
  mowerHedge: ["mower", "hedge"],
  mowerWeed: ["mower", "weed"],
  mowerJam: ["mower", "jam"],
  mowerBeastWarn: ["mowerbeast", "warn"],
  mowerBeastSnap: ["mowerbeast", "snap"],
  mowerBeastHit: ["mowerbeast", "hit"],
  mowerBeastBreak: ["mowerbeast", "break"],
});
export const LOSE_WORDS = freeze({
  gnome: "Ran over a gnome",
  barrow: "Hit a wheelbarrow",
  pot: "Smashed a flowerpot",
  arch: "Hit a hedge arch",
  line: "Tangled in the washing",
  thorns: "Caught in the thorns",
  snap: "Snapped up by topiary",
  pond: "Drove into the pond",
  ditch: "Fell in the ditch",
});
export const LOSE_SOUNDS = freeze({
  gnome: ["smash", 0.5, 1.1],
  barrow: ["clank", 0.6, 0.8],
  pot: ["smash", 0.6, 0.8],
  arch: ["clank", 0.5, 0.7],
  line: ["ghoulHandsGrab", 0.5, 1],
  thorns: ["ghoulHandsGrab", 0.5, 0.8],
  snap: ["clank", 0.5, 1.2],
  pond: ["splashBig", 0.6, 1],
  ditch: ["ghoulPitFall", 0.55, 0.9],
});

const FW = 96;
const CH = 48;
const SEAM = 0.5;
const LANE = 12;
const BLADE_REACH = 9;
let FH = 54;

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

/* --------------------------------------------------- cached offscreen layers */

const layers = new Map();
let layerScale = 0;
const offscreen = (w, h) => {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width: w, height: h });
  return null;
};
// A layer of `w` by `h` units painted once by paint(c) in unit coordinates, then reused; null where
// the context cannot say its scale (the caller paints direct).
function layerFor(ctx, key, w, h, paint) {
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!m || !(m.a > 0)) return null;
  const a = m.a;
  if (a !== layerScale) {
    layers.clear();
    layerScale = a;
  }
  let layer = layers.get(key);
  if (layer) {
    layers.delete(key);
    layers.set(key, layer);
    return layer;
  }
  try {
    layer = offscreen(Math.ceil(w * a), Math.ceil(h * a));
    const g = layer && layer.getContext("2d");
    if (!g) return null;
    g.scale(a, a);
    paint(g);
  } catch {
    return null;
  }
  layers.set(key, layer);
  if (layers.size > 40) layers.delete(layers.keys().next().value);
  return layer;
}

// A soft round glow sprite per color, drawn scaled at a light.
const HALO = freeze({ warm: "255,196,110", red: "255,70,50", green: "90,240,130", cold: "150,205,255", white: "235,245,255", lime: "190,255,120" });
function halo(ctx, kind, x, y, r, alpha) {
  const sprite = layerFor(ctx, `mower:halo:${kind}`, 8, 8, (g) => {
    g.fillStyle = rgrad(g, 4, 4, 4, [[0, `rgba(${HALO[kind]},1)`], [0.35, `rgba(${HALO[kind]},0.45)`], [1, `rgba(${HALO[kind]},0)`]]);
    g.fillRect(0, 0, 8, 8);
  });
  ctx.globalAlpha = alpha;
  if (sprite) ctx.drawImage(sprite, x - r, y - r, r * 2, r * 2);
  else {
    ctx.fillStyle = `rgb(${HALO[kind]})`;
    ctx.globalAlpha = alpha * 0.4;
    disc(ctx, x, y, r * 0.5);
  }
  ctx.globalAlpha = 1;
}

// Each tile is painted over [0, W + SEAM] and repeats every W: whatever sticks out of one edge is
// painted again a tile over, so the seams never show.
const wrap = (W, fn) => {
  fn(0);
  fn(-W);
  fn(W);
};

// Draws a repeating tile layer at parallax factor `f` (1 moves with the lawn).
function tile(ctx, key, W, f, cam, paint) {
  const ox = cam * (1 - f);
  const k0 = Math.floor((cam - ox) / W);
  const k1 = Math.floor((cam + FW - ox) / W);
  const layer = layerFor(ctx, key, W + SEAM, FH, paint);
  for (let k = k0; k <= k1; k++) {
    const x = Math.round((ox + k * W) * 8) / 8;
    if (layer) ctx.drawImage(layer, x, 0, W + SEAM, FH);
    else {
      ctx.save();
      ctx.translate(x, 0);
      paint(ctx);
      ctx.restore();
    }
  }
}

/* ------------------------------------------------------- sky and far scenery */

const LANE_Y = () => FH - LANE;
const WF = 168;
const WM = 120;

// The far tile: dark hills with the manor on one, its windows lit, and a few dead and pointed trees.
function paintFar(c) {
  const base = LANE_Y();
  wrap(WF, (o) => {
    c.fillStyle = "#0a1512";
    c.beginPath();
    c.moveTo(o - 2, base + 1);
    c.lineTo(o - 2, base - 6);
    c.bezierCurveTo(o + 30, base - 11, o + 50, base - 12, o + 84, base - 9);
    c.bezierCurveTo(o + 110, base - 7, o + 130, base - 10, o + WF + 2, base - 6);
    c.lineTo(o + WF + 2, base + 1);
    c.closePath();
    c.fill();
    // The manor on its hill.
    const mx = o + 66;
    const my = base - 10.5;
    c.fillStyle = "#070d0e";
    c.fillRect(mx, my - 9, 30, 9.5);
    poly(c, [[mx - 1, my - 9], [mx + 8, my - 14], [mx + 22, my - 14], [mx + 31, my - 9]]);
    c.fill();
    c.fillRect(mx + 11, my - 20, 8, 12);
    poly(c, [[mx + 10, my - 20], [mx + 15, my - 25], [mx + 20, my - 20]]);
    c.fill();
    c.fillRect(mx + 2, my - 17, 1.4, 4);
    c.fillRect(mx + 26, my - 17, 1.4, 4);
    for (let k = 0; k < 7; k++) {
      c.fillStyle = rnd(k, 3) < 0.6 ? "rgba(255,196,110,0.8)" : "rgba(255,196,110,0.25)";
      c.fillRect(mx + 3 + k * 4, my - 6.4, 1.2, 2);
    }
    c.fillStyle = "rgba(255,196,110,0.7)";
    c.fillRect(mx + 14.2, my - 17, 1.4, 2.2);
    // Trees: pines and a few bare ones.
    for (let k = 0; k < 11; k++) {
      const x = o + 4 + k * 14.5 + rnd(k, 5) * 4;
      if (x > o + 58 && x < o + 100) continue;
      const h = 6 + rnd(k, 6) * 7;
      const b = base - 5 + Math.sin(k) * 1.5;
      c.fillStyle = "#0b1a16";
      if (k % 4 === 3) {
        c.strokeStyle = "#0b1a16";
        c.lineWidth = 0.4;
        seg(c, x, b, x, b - h);
        seg(c, x, b - h * 0.6, x - 2, b - h * 0.95);
        seg(c, x, b - h * 0.45, x + 2.2, b - h * 0.8);
      } else {
        for (let t = 0; t < 3; t++) poly(c, [[x, b - h + t * h * 0.22], [x - 2.2 + t * 0.3, b - h * 0.45 + t * h * 0.2], [x + 2.2 - t * 0.3, b - h * 0.45 + t * h * 0.2]]), c.fill();
      }
    }
  });
}

// One topiary shape standing on `base`: a cone, a ball on a stem, tiers, or a hedge block with an arch.
function topiary(c, x, base, kind, s) {
  c.fillStyle = "#0d2417";
  if (kind === 0) poly(c, [[x - 1.6 * s, base], [x, base - 7 * s], [x + 1.6 * s, base]]), c.fill();
  else if (kind === 1) {
    c.fillRect(x - 0.3 * s, base - 4 * s, 0.6 * s, 4 * s);
    disc(c, x, base - 5.2 * s, 1.8 * s);
  } else if (kind === 2) {
    for (let t = 0; t < 3; t++) {
      c.beginPath();
      c.ellipse(x, base - (1.3 + t * 2.1) * s, (2.2 - t * 0.55) * s, 1.15 * s, 0, 0, TAU);
      c.fill();
    }
  } else {
    c.fillRect(x - 4 * s, base - 4 * s, 8 * s, 4 * s);
    c.fillStyle = "#06100b";
    c.beginPath();
    c.arc(x, base, 1.5 * s, Math.PI, 0);
    c.fill();
  }
}

// The mid tile: a row of clipped hedges and topiary behind iron railings with spiked tops, and a statue or two.
function paintMid(c) {
  const base = LANE_Y() + 0.6;
  wrap(WM, (o) => {
    c.fillStyle = "#0a1c12";
    c.fillRect(o - 1, base - 3.4, WM + 2, 3.4);
    for (let k = 0; k < 9; k++) topiary(c, o + 6 + k * 13 + rnd(k, 8) * 3, base - 2.4, k % 4, 0.9 + rnd(k, 9) * 0.4);
    // Statue pedestals.
    for (const sx of [22, 88]) {
      c.fillStyle = "#1c2b2a";
      c.fillRect(o + sx - 1.2, base - 4.2, 2.4, 2.4);
      c.fillStyle = "#2a3d3b";
      disc(c, o + sx, base - 6, 0.9);
      c.fillRect(o + sx - 0.7, base - 5.5, 1.4, 1.5);
    }
    // Railings.
    c.strokeStyle = "#101a1a";
    c.lineWidth = 0.18;
    seg(c, o - 1, base - 2.8, o + WM + 1, base - 2.8);
    seg(c, o - 1, base - 0.8, o + WM + 1, base - 0.8);
    for (let x = 0; x < WM + 1; x += 2.2) {
      seg(c, o + x, base, o + x, base - 3.3);
      poly(c, [[o + x - 0.3, base - 3.3], [o + x, base - 4.1], [o + x + 0.3, base - 3.3]]);
      c.fillStyle = "#101a1a";
      c.fill();
    }
  });
}

// The sky: a gradient, a moon with its glow and a scatter of stars.
function sky(ctx, cam, clock) {
  const h = LANE_Y();
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, "#04080f"], [0.6, "#0f1f26"], [1, "#2a4640"]]);
  ctx.fillRect(cam - 1, 0, FW + 2, h + 1);
  for (let k = 0; k < 46; k++) {
    const sx = (((rnd(k, 1) * 220 - cam * 0.04) % 220) + 220) % 220 - 10;
    const twinkle = 0.45 + 0.4 * Math.sin(clock / (500 + rnd(k, 3) * 700) + k);
    ctx.fillStyle = `rgba(235,245,255,${twinkle * (0.5 + rnd(k, 4) * 0.5)})`;
    ctx.fillRect(cam + sx, rnd(k, 2) * h * 0.7, 0.2, 0.2);
  }
  const mx = cam + 70 - cam * 0.03;
  halo(ctx, "white", mx, 10, 13, 0.35);
  ctx.fillStyle = "#f2f2dc";
  disc(ctx, mx, 10, 3.2);
  ctx.fillStyle = "rgba(160,160,140,0.35)";
  disc(ctx, mx - 0.9, 9.4, 0.7);
  disc(ctx, mx + 1.1, 11.2, 0.5);
}

/* ------------------------------------------------------------ the lawn */

// The lawn from xa to xb: soil under grass, with mow stripes.
function lawn(c, xa, xb) {
  const y = LANE_Y();
  c.fillStyle = vgrad(c, y, FH, [[0, "#5a9a3c"], [0.1, "#3b6e2a"], [0.2, "#3a2b18"], [1, "#120c06"]]);
  c.fillRect(xa, y, xb - xa, FH - y + 1);
  const s0 = Math.floor(xa / 6) * 6;
  for (let x = s0; x < xb; x += 12) {
    c.fillStyle = "rgba(255,255,255,0.06)";
    c.fillRect(Math.max(x, xa), y, Math.min(x + 6, xb) - Math.max(x, xa), 2.4);
  }
  c.fillStyle = "#79b84e";
  c.fillRect(xa, y, xb - xa, 0.3);
  // Stones and roots in the soil.
  for (let x = Math.ceil(xa / 5) * 5; x < xb; x += 5) {
    const r = rnd(x, 41);
    if (r < 0.5) continue;
    c.fillStyle = r < 0.8 ? "#2a1e10" : "#4a3a28";
    disc(c, x + rnd(x, 42) * 3, y + 3.5 + rnd(x, 43) * 6, 0.25 + rnd(x, 44) * 0.3);
  }
}

// A pond in the gap [a, b]: dark water with the moon's glints, reeds and lily pads at its edges.
function pond(c, a, b) {
  const y = LANE_Y();
  c.fillStyle = vgrad(c, y, FH, [[0, "#1c4a5a"], [0.4, "#0c2a38"], [1, "#04101a"]]);
  c.fillRect(a, y + 0.6, b - a, FH - y);
  c.strokeStyle = "rgba(220,235,240,0.35)";
  c.lineWidth = 0.1;
  for (let k = 0; k < 4; k++) seg(c, a + 1 + rnd(a, k) * (b - a - 3), y + 1 + k * 0.9, a + 2.2 + rnd(a, k) * (b - a - 3), y + 1 + k * 0.9);
  c.fillStyle = "#2f6a3a";
  for (let x = a + 1.5; x < b - 1; x += 2.6) {
    c.beginPath();
    c.ellipse(x + rnd(a, x) * 0.8, y + 0.6, 0.9, 0.22, 0, 0, TAU);
    c.fill();
  }
  c.strokeStyle = "#1c3a24";
  c.lineWidth = 0.18;
  seg(c, a + 0.3, y, a + 0.1, y - 2);
  seg(c, a + 0.9, y, a + 1.2, y - 2.4);
  seg(c, b - 0.4, y, b - 0.2, y - 2.1);
}

// A ha-ha ditch in the gap [a, b]: a dark trench with a brick wall on each face.
function ditch(c, a, b) {
  const y = LANE_Y();
  c.fillStyle = "#06080a";
  c.fillRect(a, y, b - a, FH - y);
  c.fillStyle = "#3a2a22";
  c.fillRect(a, y, 0.7, FH - y);
  c.fillRect(b - 0.7, y, 0.7, FH - y);
  c.strokeStyle = "#1e1612";
  c.lineWidth = 0.08;
  for (let r = 0; r < 8; r++) {
    seg(c, a, y + 1 + r * 1.3, a + 0.7, y + 1 + r * 1.3);
    seg(c, b - 0.7, y + 1 + r * 1.3, b, y + 1 + r * 1.3);
  }
  c.fillStyle = "rgba(140,160,120,0.5)";
  for (let k = 0; k < 6; k++) disc(c, a + 1 + rnd(a, k + 7) * (b - a - 2), y + 3 + rnd(a, k + 9) * 8, 0.18);
}

// A chunk of the lawn: the lines, with the ponds and ditches under the gaps between them.
function paintLane(c, R, xa, xb) {
  const lines = R.track.map((pts) => [pts[0][0], pts[pts.length - 1][0]]);
  lines.forEach(([x0, x1], i) => {
    if (i + 1 >= lines.length) return;
    const a = x1;
    const b = lines[i + 1][0];
    if (b < xa || a > xb) return;
    if (R.gaps[i]) ditch(c, a, b);
    else pond(c, a, b);
  });
  for (const [x0, x1] of lines) if (x1 > xa && x0 < xb) lawn(c, Math.max(x0, xa), Math.min(x1, xb));
}

/* ------------------------------------------------------------ telegraphs */

// What to do about what is coming, shown as a glyph that fades in ahead of it: DUCK for a hedge arch
// or a line of gloves (an arrow down, amber), JUMP for a pond, a ditch or junk (an arrow up, cyan), CUT for
// a thorn hedge (chevrons to the right, green: hold fire; a jump works too). Beasts, weeds and grass
// get none. Everything comes from the room's `ride` fields and where the mower is.
export const TELEGRAPH_SEE = 40;
export const TELEGRAPH_FULL = 30;
export const TELEGRAPH_WORDS = 3;
export const TELEGRAPH_ALPHA = 0.72;
export const ANSWERS = freeze({ pond: "JUMP", ditch: "JUMP", junk: "JUMP", arch: "DUCK", line: "DUCK", hedge: "CUT" });
export const ANSWER_COLORS = freeze({ JUMP: "#5fe3ff", DUCK: "#ffb02e", CUT: "#8cff6a" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lead (where it begins), x (its middle), up (height of
// the glyph's anchor), n (which of its kind), answer }, in the room's order.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lead, x, up) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lead, x, up, n, answer: ANSWERS[kind] });
  };
  for (let i = 0; i + 1 < R.track.length; i++) {
    const a = R.track[i].at(-1)[0];
    const b = R.track[i + 1][0][0];
    add(R.gaps[i] ? "ditch" : "pond", a, (a + b) / 2, LANE + 6.5);
  }
  for (const [x] of R.junk) add("junk", x, x, LANE + 7);
  for (const x of R.hedges) add("hedge", x, x, LANE + 7);
  for (const [x0, x1, y, kind] of R.lows) add(kind ? "line" : "arch", kind ? x0 - 5 : x0 - 4, (x0 + x1) / 2, y + 6.8);
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with the mower at `x`: { ...mark, alpha (0..1, before the pulse), words }.
export function telegraphs(R, x) {
  const out = [];
  for (const m of telegraphMarks(R)) {
    const d = m.lead - x;
    if (d > TELEGRAPH_SEE || d < -6) continue;
    const alpha = Math.min(clamp((TELEGRAPH_SEE - d) / (TELEGRAPH_SEE - TELEGRAPH_FULL), 0, 1), clamp((d + 4) / 6, 0, 1));
    if (alpha > 0.01) out.push({ ...m, alpha, words: m.n < TELEGRAPH_WORDS });
  }
  return out;
}

/* --------------------------------------------------------------------- art */

export function mowerArt(d) {
  const { ellipse, say, label, GOLD, EYE_PALE } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "mower" ? v.spec.ride : null);
  const state = (v) => (v.round && v.round.runner && v.round.runner.id === "mower" ? v.round.runner : null);
  const worldY = (y) => FH - y;

  /* ------------------------------------------------------------- the room */

  // The still layers only get the sky's color: the world is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The lawn at the start and at the end (drawn again by `moving`, over the sky).
  function ground(ctx, v, look, a, b, top) {
    FH = v.g.FIELD_H;
    lawn(ctx, a, b);
  }
  function shelf() {}

  /* ------------------------------------------------------------ the things */

  // Tall grass: tufts of long blades, swaying. A cut cell is a short stubble with a pale cut mark.
  function grassCells(ctx, v, g, row, gi) {
    const y = worldY(LANE);
    const clock = v.clock;
    for (let j = 0; j < row.length; j++) {
      const x = g[0] + j;
      if (x < v.round.camX - 2 || x > v.round.camX + FW + 2) continue;
      if (row[j]) {
        ctx.strokeStyle = "#8ccb5a";
        ctx.lineWidth = 0.16;
        seg(ctx, x + 0.2, y, x + 0.25, y - 0.45);
        seg(ctx, x + 0.7, y, x + 0.65, y - 0.4);
        continue;
      }
      const sway = Math.sin(clock / 420 + x * 0.6) * 0.3;
      for (let b = 0; b < 3; b++) {
        const hgt = 2.3 + rnd(gi * 41 + j, b) * 1.6;
        const bx = x + 0.15 + b * 0.32 + rnd(j, b + 5) * 0.1;
        ctx.strokeStyle = b === 1 ? "#6aab3c" : "#3f7a2a";
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        ctx.moveTo(bx, y + 0.1);
        ctx.quadraticCurveTo(bx + sway * 0.4, y - hgt * 0.6, bx + sway + (b - 1) * 0.25, y - hgt);
        ctx.stroke();
      }
    }
  }

  // A weed patch: a spiky clump with one sickly flower; cut it is a few short stubs.
  function weed(ctx, v, x, cut, i) {
    const y = worldY(LANE);
    if (cut) {
      ctx.strokeStyle = "#6a8a3a";
      ctx.lineWidth = 0.15;
      seg(ctx, x - 0.5, y, x - 0.5, y - 0.4);
      seg(ctx, x + 0.3, y, x + 0.3, y - 0.35);
      return;
    }
    const sway = Math.sin(v.clock / 300 + i) * 0.25;
    ctx.strokeStyle = "#5a7a2a";
    ctx.lineWidth = 0.2;
    for (let b = -3; b <= 3; b++) seg(ctx, x + b * 0.25, y, x + b * 0.5 + sway, y - 1.6 - (3 - Math.abs(b)) * 0.3);
    ctx.strokeStyle = "#4a6a22";
    seg(ctx, x, y, x + sway, y - 3.1);
    ctx.fillStyle = i % 2 ? "#d27ae0" : "#f0d65a";
    disc(ctx, x + sway, y - 3.3, 0.55);
    ctx.fillStyle = "#3a2a10";
    disc(ctx, x + sway, y - 3.3, 0.2);
  }

  // A thorn hedge: a clipped dark block, thorns bristling out of it and a few red berries; cut, a heap of shards.
  function hedge(ctx, v, x, cut, i) {
    const y = worldY(LANE);
    if (cut) {
      ctx.fillStyle = "#1e4a22";
      for (let k = 0; k < 6; k++) ctx.fillRect(x - 1.7 + k * 0.6, y - 0.5 - rnd(i, k) * 0.5, 0.5, 0.6);
      return;
    }
    const w = 3.4;
    const h = 3.8;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, x + 0.3, y + 0.05, w * 0.6, 0.3);
    ctx.fill();
    ctx.fillStyle = "#1c4a24";
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y);
    ctx.lineTo(x - w / 2, y - h * 0.8);
    ctx.quadraticCurveTo(x, y - h * 1.1, x + w / 2, y - h * 0.8);
    ctx.lineTo(x + w / 2, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2c6a30";
    ctx.fillRect(x - w / 2 + 0.2, y - h * 0.7, w - 0.4, 0.35);
    ctx.strokeStyle = "#7a5a3a";
    ctx.lineWidth = 0.14;
    for (let k = 0; k < 9; k++) {
      const tx = x - w / 2 + 0.2 + (k / 8) * (w - 0.4);
      const ty = y - 0.4 - rnd(i, k + 20) * (h * 0.85);
      seg(ctx, tx, ty, tx + (k % 2 ? 0.55 : -0.55), ty - 0.5);
    }
    ctx.fillStyle = "#d02828";
    for (let k = 0; k < 4; k++) disc(ctx, x - 1.2 + k * 0.8, y - 1 - rnd(i, k + 30) * 2.2, 0.2);
  }

  // Garden junk: a gnome with a pointy red hat and glowing eyes, a rusty wheelbarrow, a cracked flowerpot.
  function junk(ctx, v, x, kind, i) {
    const y = worldY(LANE);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, x + 0.3, y + 0.05, kind === 1 ? 3 : 1.5, 0.3);
    ctx.fill();
    if (kind === 0) {
      ctx.fillStyle = "#4a6a8a";
      ctx.fillRect(x - 0.9, y - 1.9, 1.8, 1.9);
      ctx.fillStyle = "#e8d8b8";
      disc(ctx, x, y - 2.6, 0.9);
      ctx.fillStyle = "#dcdcd0";
      poly(ctx, [[x - 0.8, y - 2.4], [x + 0.8, y - 2.4], [x, y - 1.4]]);
      ctx.fill();
      ctx.fillStyle = "#c42a2a";
      poly(ctx, [[x - 1.1, y - 3.0], [x + 1.1, y - 3.0], [x + 0.2, y - 4.4]]);
      ctx.fill();
      v.eyes.push(x - 0.35, y - 2.7, 0.24, EYE_PALE);
      v.eyes.push(x + 0.35, y - 2.7, 0.24, EYE_PALE);
      ctx.fillStyle = "#c8ff90";
      disc(ctx, x - 0.35, y - 2.7, 0.14);
      disc(ctx, x + 0.35, y - 2.7, 0.14);
    } else if (kind === 1) {
      ctx.fillStyle = "#7a3a1c";
      poly(ctx, [[x - 2.4, y - 2.4], [x + 1.6, y - 2.4], [x + 0.9, y - 1.0], [x - 1.4, y - 1.0]]);
      ctx.fill();
      ctx.fillStyle = "#4a2410";
      ctx.fillRect(x - 2.2, y - 2.6, 3.6, 0.3);
      ctx.strokeStyle = "#5a5048";
      ctx.lineWidth = 0.22;
      seg(ctx, x + 1.2, y - 1.8, x + 2.6, y - 2.9);
      seg(ctx, x - 2.2, y - 2.4, x - 2.6, y - 3.2);
      ctx.fillStyle = "#2a2a2a";
      disc(ctx, x + 0.9, y - 0.7, 0.7);
      ctx.fillStyle = "#6a6258";
      disc(ctx, x + 0.9, y - 0.7, 0.2);
      ctx.fillStyle = "#d8d0b8";
      for (let k = 0; k < 3; k++) ellipse(ctx, x - 1.2 + k * 0.9, y - 2.8, 0.5, 0.3), ctx.fill();
    } else {
      ctx.fillStyle = "#a8502c";
      poly(ctx, [[x - 1.1, y - 3.0], [x + 1.1, y - 3.0], [x + 0.7, y], [x - 0.7, y]]);
      ctx.fill();
      ctx.fillStyle = "#c06a3c";
      ctx.fillRect(x - 1.3, y - 3.4, 2.6, 0.7);
      ctx.strokeStyle = "#3a2410";
      ctx.lineWidth = 0.1;
      seg(ctx, x - 0.2, y - 3.0, x + 0.1, y - 1.2);
      ctx.strokeStyle = "#3a4a2a";
      ctx.lineWidth = 0.18;
      seg(ctx, x, y - 3.4, x - 0.5, y - 4.9);
      seg(ctx, x + 0.2, y - 3.4, x + 0.9, y - 4.6);
      ctx.fillStyle = "#8a2a4a";
      disc(ctx, x - 0.5, y - 5.0, 0.35);
    }
  }

  // A snapping topiary beast: a clipped hound of green hedge. Asleep it sits beside the lane; it shivers,
  // then lunges into it with its jaws opening and shutting; shot, it is a stump of leaves.
  function beast(ctx, v, x, b, i) {
    const y = worldY(LANE);
    const clock = v.clock;
    if (b.state === "broken") {
      ctx.fillStyle = "#1c4a24";
      ellipse(ctx, x, y - 0.3, 1.6, 0.5);
      ctx.fill();
      ctx.fillStyle = "#3a6a2a";
      for (let k = 0; k < 5; k++) ctx.fillRect(x - 1.5 + k * 0.7, y - 0.9 - rnd(i, k) * 0.4, 0.4, 0.5);
      return;
    }
    const lunge = b.state === "snap" ? clamp((1400 - b.t) / 160, 0, 1) : b.state === "sink" ? clamp(b.t / 300, 0, 1) : 0;
    const shake = b.state === "warn" ? Math.sin(clock / 26) * 0.2 : 0;
    const s = 0.85 + lunge * 0.15;
    const bx = x + shake - lunge * 0.4;
    ctx.save();
    ctx.translate(bx, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, 0.3, 0.05, 2.6, 0.35);
    ctx.fill();
    // The body, a clipped hound: haunch, back, shoulders, legs.
    ctx.fillStyle = "#1c4a24";
    ctx.beginPath();
    ctx.moveTo(-2.4, 0);
    ctx.lineTo(-2.5, -2.0);
    ctx.quadraticCurveTo(-2.2, -3.4, -0.8, -3.4);
    ctx.lineTo(0.9, -3.5);
    ctx.quadraticCurveTo(1.8, -3.5, 2.0, -2.6);
    ctx.lineTo(2.1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#2c6a30";
    ctx.fillRect(-2.1, -3.2, 3.7, 0.4);
    // The head with its jaws: they open wide while it snaps.
    const gape = b.state === "snap" ? 0.5 + 0.5 * Math.abs(Math.sin(clock / 90)) : b.state === "warn" ? 0.1 : 0.05;
    ctx.save();
    ctx.translate(1.6, -3.0);
    ctx.fillStyle = "#1c4a24";
    poly(ctx, [[0, 0], [1.9, -0.2 - gape], [1.9, -0.9 - gape], [0, -1.5]]);
    ctx.fill();
    poly(ctx, [[0, 0], [1.9, 0.2 + gape], [1.9, 0.9 + gape * 0.4], [0, 1.0]]);
    ctx.fill();
    ctx.fillStyle = "#f0ece0";
    for (let k = 0; k < 3; k++) {
      poly(ctx, [[0.5 + k * 0.5, -0.4 - gape * 0.4], [0.7 + k * 0.5, -0.1], [0.9 + k * 0.5, -0.4 - gape * 0.4]]);
      ctx.fill();
    }
    ctx.fillStyle = "#0a1a0c";
    ellipse(ctx, 0.1, -0.7, 0.5, 0.45);
    ctx.fill();
    // Ears of trimmed leaves.
    ctx.fillStyle = "#2c6a30";
    poly(ctx, [[-0.3, -1.3], [-0.1, -2.5], [0.6, -1.4]]);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    const awake = b.state !== "idle" && b.state !== "spent";
    if (awake) {
      const ex = bx + 1.9 * s;
      const ey = y - 3.7 * s;
      v.eyes.push(ex, ey, 0.34, "#ff4a2a");
      ctx.fillStyle = "#ff6a3a";
      disc(ctx, ex, ey, 0.22);
    }
  }

  // A checkpoint: a post with a lantern, red until passed, then green.
  function checkpoint(ctx, v, x, on, i) {
    const base = worldY(LANE);
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.35;
    seg(ctx, x, base + 0.2, x, base - 5.4);
    seg(ctx, x, base - 5.2, x + 1.1, base - 5.2);
    const pulse = on ? 1 : 0.7 + 0.3 * Math.sin(v.clock / 160 + i);
    halo(ctx, on ? "green" : "red", x + 1.1, base - 4.5, on ? 4.2 : 3.6, 0.7 * pulse);
    ctx.fillStyle = "#1c1a22";
    ctx.fillRect(x + 0.6, base - 5.3, 1, 1.7);
    ctx.fillStyle = on ? "#7dffa0" : "#ff5a40";
    ctx.fillRect(x + 0.75, base - 5.1, 0.7, 1.3);
  }

  // The finish: a garden arch with a string of lanterns and a checkered pennant.
  function finishGate(ctx, x) {
    const base = worldY(LANE);
    ctx.fillStyle = "#1c4a24";
    ctx.fillRect(x, base - 9, 2, 9);
    ctx.fillRect(x + 12, base - 9, 2, 9);
    ctx.beginPath();
    ctx.arc(x + 7, base - 9, 7, Math.PI, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1c4a24";
    ctx.stroke();
    for (let k = 0; k < 5; k++) {
      const a = Math.PI + ((k + 0.5) / 5) * Math.PI;
      const lx = x + 7 + Math.cos(a) * 7;
      const ly = base - 9 + Math.sin(a) * 7 + 0.8;
      halo(ctx, "warm", lx, ly, 2.6, 0.55);
      ctx.fillStyle = k % 2 ? "#ffcf6a" : "#ff8a4a";
      ctx.fillRect(lx - 0.35, ly - 0.2, 0.7, 1);
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c) % 2 ? "#14141a" : "#f4f4f8";
      ctx.fillRect(x + 4 + c * 0.9, base - 19 + r * 0.9, 0.9, 0.9);
    }
  }

  /* ---------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const clock = v.clock;
    cam = Math.round(cam * 8) / 8;
    sky(ctx, cam, clock);
    tile(ctx, "mower:far", WF, 0.12, cam, paintFar);
    tile(ctx, "mower:mid", WM, 0.34, cam, paintMid);
    const k0 = Math.max(0, Math.floor(cam / CH));
    const k1 = Math.floor((cam + FW) / CH);
    for (let k = k0; k <= k1; k++) {
      const layer = layerFor(ctx, `mower:lane:${k}`, CH + SEAM, FH, (g) => {
        g.translate(-k * CH, 0);
        paintLane(g, R, k * CH - 6, k * CH + CH + SEAM + 6);
      });
      if (layer) ctx.drawImage(layer, k * CH, 0, CH + SEAM, FH);
      else if (k === k0) paintLane(ctx, R, cam - 6, cam + FW + 6);
    }
    for (const [a, b, top] of v.spec.ground) if (a >= R.finish - 1 && b > cam - 8 && a < cam + FW + 8) ground(ctx, v, LOOKS.mower, a, b, top);
    const lo = cam - 8;
    const hi = cam + FW + 8;
    // Ripples on the ponds.
    R.track.forEach((pts, i) => {
      if (i + 1 >= R.track.length || R.gaps[i]) return;
      const a = pts.at(-1)[0];
      const b = R.track[i + 1][0][0];
      if (b < lo || a > hi) return;
      ctx.strokeStyle = "rgba(210,235,245,0.4)";
      ctx.lineWidth = 0.08;
      for (let k = 0; k < 3; k++) {
        const p = ((clock / 1800 + k / 3 + a * 0.01) % 1);
        ctx.beginPath();
        ctx.ellipse(a + (b - a) * (0.25 + 0.25 * k), worldY(LANE) + 0.9, 0.4 + p * 1.6, 0.12 + p * 0.25, 0, 0, TAU);
        ctx.stroke();
      }
    });
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, i <= c.check, i);
    });
    if (R.finish > lo - 14 && R.finish < hi) finishGate(ctx, R.finish + 12);
    R.grass.forEach((g, i) => {
      if (g[1] > lo && g[0] < hi) grassCells(ctx, v, g, c.grass[i], i);
    });
    R.weeds.forEach((x, i) => {
      if (x > lo && x < hi) weed(ctx, v, x, c.weeds[i], i);
    });
    R.hedges.forEach((x, i) => {
      if (x > lo && x < hi) hedge(ctx, v, x, c.hedges[i], i);
    });
    R.junk.forEach(([x, kind], i) => {
      if (x > lo && x < hi) junk(ctx, v, x, kind, i);
    });
    R.beasts.forEach((x, i) => {
      if (x > lo && x < hi) beast(ctx, v, x, c.beasts[i], i);
    });
    // A finished ride: the mower rests where it stopped, behind Planny as he walks out.
    if (c.done) mower(ctx, v, R, c);
    // Fireflies drifting over the lawn.
    for (let k = 0; k < 14; k++) {
      const fx = cam + ((rnd(k, 60) * 120 + clock / 90 * (0.4 + rnd(k, 61))) % 110);
      const fy = FH - LANE - 3 - rnd(k, 62) * 12 + Math.sin(clock / 700 + k) * 1.2;
      ctx.fillStyle = `rgba(200,255,140,${0.25 + 0.35 * Math.sin(clock / 330 + k * 2) ** 2})`;
      disc(ctx, fx, fy, 0.14);
    }
  }

  /* ------------------------------------------------------ the mower, in front */

  // Draws the ride-on mower with Planny on it (he is drawn by the game under it): a rusty deck, a seat,
  // a wheel with a cracked headlight, a smoking exhaust, and the blades out front.
  function mower(ctx, v, R, c) {
    const { round } = v;
    const you = round.you;
    const clock = v.clock;
    const fx = v.fx;
    const done = c.done;
    const x = done && c.restX !== undefined ? c.restX : you.x;
    const y = done ? LANE : you.y;
    const pitch = done || c.line >= 0 ? 0 : clamp(you.vy / 40, -1, 1) * 0.3;
    const bump = !done && c.line >= 0 ? Math.sin(clock / 37) * 0.05 * (c.blade ? 2 : 1) : 0;
    ctx.save();
    ctx.translate(x, FH - y + bump);
    ctx.rotate(-pitch);
    // The blade zone ahead: a faint cone while the blades are down, with a whirl of cut grass.
    if (c.blade && !done) {
      ctx.fillStyle = "rgba(180,255,120,0.12)";
      poly(ctx, [[2.6, -0.2], [BLADE_REACH, -1.6], [BLADE_REACH, 0.2]]);
      ctx.fill();
      ctx.strokeStyle = "rgba(210,255,170,0.55)";
      ctx.lineWidth = 0.12;
      for (let k = 0; k < 6; k++) {
        const p = ((clock / 160 + k * 0.17) % 1);
        seg(ctx, 3 + p * (BLADE_REACH - 3), -0.4 - p * 0.9 * (k % 3), 3.6 + p * (BLADE_REACH - 3), -0.6 - p * 0.9 * (k % 3));
      }
    }
    // The wheels turn with the lawn.
    const turn = (done ? 0 : x * 0.5) % TAU;
    const wheel = (wx, wy, r) => {
      ctx.fillStyle = "#16120e";
      disc(ctx, wx, wy, r);
      ctx.fillStyle = "#6a5a4a";
      disc(ctx, wx, wy, r * 0.5);
      ctx.strokeStyle = "#2a2018";
      ctx.lineWidth = 0.12;
      for (let k = 0; k < 4; k++) {
        const a = turn + (k * TAU) / 4;
        seg(ctx, wx, wy, wx + Math.cos(a) * r * 0.95, wy + Math.sin(a) * r * 0.95);
      }
    };
    // Exhaust smoke from a pipe at the back.
    if (!done) {
      for (let k = 0; k < 6; k++) {
        const p = ((clock / 700 + k / 6) % 1);
        ctx.fillStyle = `rgba(150,150,140,${(1 - p) * 0.45})`;
        disc(ctx, -2.8 - p * 3 - c.v * 0.04, -3.4 - p * 3, 0.25 + p * 0.6);
      }
    }
    wheel(-2.1, -1.2, 1.25);
    wheel(2.6, -0.7, 0.75);
    // The body: a rusty deck, an engine hood, a seat, a steering column, a headlight.
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, 0.2, 0.05, 4, 0.3);
    ctx.fill();
    ctx.fillStyle = vgrad(ctx, -3, 0, [[0, "#b8501c"], [0.6, "#7a3414"], [1, "#4a2008"]]);
    poly(ctx, [[-3.7, -1.2], [-3.7, -2.7], [-1.2, -2.9], [0.2, -2.5], [3.1, -2.1], [3.6, -1.1], [3.2, -0.5], [-3.2, -0.5]]);
    ctx.fill();
    ctx.strokeStyle = "#2a1004";
    ctx.lineWidth = 0.1;
    ctx.stroke();
    ctx.fillStyle = "#3a1a08";
    for (const [sx, sy] of [[-2.8, -1.5], [-0.4, -1.2], [1.6, -1.6]]) disc(ctx, sx, sy, 0.2);
    ctx.fillStyle = "#1c1a1a";
    ctx.fillRect(-3.4, -3.2, 2.2, 0.55);
    ctx.fillStyle = "#e8d89a";
    disc(ctx, 3.4, -1.4, 0.4);
    halo(ctx, "warm", 3.6, -1.4, 3.4, 0.5);
    // The steering wheel.
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.2;
    seg(ctx, 1.4, -2.3, 1.9, -4.2);
    seg(ctx, 1.4, -4.4, 2.5, -4.0);
    // The blade deck out front and its spinning blades (a blur when down, a dull bar when up).
    ctx.fillStyle = "#4a4640";
    ctx.fillRect(3, -0.9, 1.9, 0.7);
    if (c.blade && !done) {
      ctx.strokeStyle = "#e8f0f8";
      ctx.lineWidth = 0.2;
      for (let k = 0; k < 2; k++) {
        const a = (clock / 30 + k * Math.PI) % TAU;
        seg(ctx, 4 + Math.cos(a) * 1.3, -0.3 + Math.sin(a) * 0.3, 4 - Math.cos(a) * 1.3, -0.3 - Math.sin(a) * 0.3);
      }
      ctx.fillStyle = "rgba(220,240,255,0.3)";
      ellipse(ctx, 4, -0.3, 1.5, 0.4);
      ctx.fill();
    } else if (c.jam > 0) {
      ctx.fillStyle = "#a02a1a";
      ctx.fillRect(3.3, -0.7, 1.4, 0.3);
      for (let k = 0; k < 5; k++) {
        const p = ((clock / 500 + k / 5) % 1);
        ctx.fillStyle = `rgba(210,210,210,${(1 - p) * 0.6})`;
        disc(ctx, 3.8 + Math.sin(k * 3 + clock / 200) * 0.6, -1.2 - p * 3.4, 0.3 + p * 0.7);
      }
    } else {
      ctx.fillStyle = "#8a8a84";
      ctx.fillRect(3.3, -0.7, 1.4, 0.2);
    }
    // A landing's puff of dust.
    const land = fx && fx.mowerLand !== undefined ? fx.clock - fx.mowerLand.t0 : 1e9;
    if (land < 360) {
      for (let k = 0; k < 7; k++) {
        const p = land / 360;
        ctx.fillStyle = `rgba(190,210,160,${(1 - p) * 0.7})`;
        disc(ctx, (k - 3) * 0.9 * (0.5 + p * 1.3), -0.2 - p * (0.8 + rnd(k, 4) * 1.3), 0.25 + p * 0.3);
      }
    }
    ctx.restore();
    if (done) return;
    // The heat gauge over the mower: green to red; flashes while jammed.
    const gx = x - 2.6;
    const gy = FH - y - 8.6;
    ctx.fillStyle = "rgba(4,8,6,0.65)";
    ctx.fillRect(gx - 0.2, gy - 0.2, 5.4, 1.1);
    const hot = c.jam > 0 ? Math.floor(clock / 120) % 2 === 0 : false;
    ctx.fillStyle = c.jam > 0 ? (hot ? "#ff3a2a" : "#7a1a12") : c.heat > 0.75 ? "#ffb02e" : "#8cff6a";
    ctx.fillRect(gx, gy, 5 * clamp(c.heat, 0, 1), 0.7);
    if (c.jam > 0) label(ctx, "JAMMED", x, gy - 0.8, 1.8, "#ff6a4a", "center");
  }

  /* ----------------------------------------------------------- lows, glyphs */

  // A dark band along the lawn under a low: soft ends.
  function shadow(ctx, xa, xb, kind) {
    ctx.fillStyle = `rgba(4,8,6,${kind ? 0.25 : 0.4})`;
    ctx.fillRect(xa, worldY(LANE) - 0.2, xb - xa, 1.6);
  }

  // A hedge arch: two clipped pillars and a rounded lintel of hedge, with a rose or two; or a clothes line:
  // two posts, a sagging rope, and ghostly gloves hanging from it.
  function low(ctx, v, x0, x1, y, kind, i) {
    const clock = v.clock;
    const under = worldY(y);
    const w = x1 - x0;
    if (kind === 0) {
      const top = under - 3.2;
      const foot = worldY(LANE) + 0.2;
      for (const px of [x0 - 3, x1 + 1.4]) {
        ctx.fillStyle = "#1c4a24";
        ctx.fillRect(px, top, 1.8, foot - top);
        ctx.fillStyle = "#2c6a30";
        ctx.fillRect(px + 0.2, top, 0.4, foot - top);
      }
      ctx.fillStyle = "#1c4a24";
      ctx.beginPath();
      ctx.moveTo(x0 - 3.2, under + 0.2);
      ctx.lineTo(x0 - 3.2, top + 1.4);
      ctx.quadraticCurveTo((x0 + x1) / 2, top - 1.6, x1 + 3.4, top + 1.4);
      ctx.lineTo(x1 + 3.4, under + 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#2c6a30";
      for (let k = 0; k < 8; k++) disc(ctx, x0 - 2.6 + k * ((w + 5.8) / 7), top + 1.3 - Math.sin((k / 7) * Math.PI) * 1.2, 0.5);
      ctx.fillStyle = "#c42a3a";
      for (let k = 0; k < 4; k++) disc(ctx, x0 - 2 + k * ((w + 4) / 3), top + 1.5 - Math.sin((k / 3) * Math.PI) * 1.0, 0.28);
      ctx.strokeStyle = "#0e2a12";
      ctx.lineWidth = 0.14;
      for (let k = 0; k < 6; k++) seg(ctx, x0 - 2.5 + k * ((w + 5) / 5), under - 0.1, x0 - 2.3 + k * ((w + 5) / 5), under + 0.7);
      halo(ctx, "lime", (x0 + x1) / 2, under + 0.6, 4, 0.12);
      return;
    }
    // The posts at each end and the rope sagging between them.
    const px0 = x0 - 1.5;
    const px1 = x1 + 1.5;
    const topY = under - 4.4;
    const foot = worldY(LANE) + 0.2;
    ctx.strokeStyle = "#4a3a28";
    ctx.lineWidth = 0.5;
    seg(ctx, px0, foot, px0, topY);
    seg(ctx, px1, foot, px1, topY);
    seg(ctx, px0 - 0.6, topY + 0.3, px0 + 0.6, topY + 0.3);
    seg(ctx, px1 - 0.6, topY + 0.3, px1 + 0.6, topY + 0.3);
    const sag = (t) => topY + 0.3 + Math.sin(t * Math.PI) * 1.4;
    ctx.strokeStyle = "#d8d0b8";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    for (let k = 0; k <= 12; k++) ctx.lineTo(px0 + ((px1 - px0) * k) / 12, sag(k / 12));
    ctx.stroke();
    // Gloves hanging down to just over the lawn's reach: pale hands that sway.
    const n = Math.max(4, Math.round(w / 1.6));
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      const gx = px0 + (px1 - px0) * t;
      const gy = sag(t);
      const len = under + 0.9 - gy + rnd(i * 11 + k, 3) * 0.6;
      const sw = Math.sin(clock / 260 + k + i) * 0.35;
      ctx.strokeStyle = "rgba(200,215,230,0.7)";
      ctx.lineWidth = 0.22;
      seg(ctx, gx, gy, gx + sw * 0.4, gy + len - 1);
      ctx.fillStyle = "rgba(225,235,245,0.85)";
      ellipse(ctx, gx + sw * 0.5, gy + len - 0.5, 0.55, 0.75);
      ctx.fill();
      for (let f = 0; f < 4; f++) seg(ctx, gx + sw * 0.5 + (f - 1.5) * 0.22, gy + len - 0.1, gx + sw * 0.7 + (f - 1.5) * 0.3, gy + len + 0.45);
      if (k % 3 === 0) halo(ctx, "cold", gx + sw * 0.5, gy + len - 0.4, 1.8, 0.25);
    }
  }

  // A see-through glyph over an obstacle: a pair of chevrons and (for the first few) the word.
  function glyph(ctx, v, t) {
    const dir = t.answer === "JUMP" ? -1 : t.answer === "DUCK" ? 1 : 0;
    const col = ANSWER_COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const bob = Math.sin(v.clock / 260 + t.lead) * 0.35 * (dir || 1);
    const cy = Math.min(FH - 7, FH - t.up) + bob;
    const ay = cy + dir * 2.6;
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [pass, w, c] of [[0, 1.3, "rgba(4,8,6,0.8)"], [1, 0.6, col]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      for (let k = 0; k < 2; k++) {
        ctx.beginPath();
        if (dir) {
          const oy = ay + (k - 0.5) * 1.5 * dir - dir * 0.2;
          if (k === 1 && pass === 1) ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA * 0.55;
          ctx.moveTo(t.x - 1.7, oy - dir * 0.9);
          ctx.lineTo(t.x, oy + dir * 0.9);
          ctx.lineTo(t.x + 1.7, oy - dir * 0.9);
        } else {
          const ox = t.x + (k - 0.5) * 1.5;
          if (k === 1 && pass === 1) ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA * 0.55;
          ctx.moveTo(ox - 0.7, cy - 1.5);
          ctx.lineTo(ox + 0.7, cy);
          ctx.lineTo(ox - 0.7, cy + 1.5);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    }
    if (t.words) label(ctx, t.answer, t.x, cy + (dir < 0 ? 1.2 : dir > 0 ? -1.2 : 2.6), 2.3, col, "center");
    ctx.restore();
  }

  // The lawn gauge along the bottom: how much of the lawn is cut, with the mark where the die is won.
  function lawnGauge(ctx, v, cam, c) {
    const w = 30;
    const x = cam + (FW - w) / 2;
    const y = FH - 3.2;
    ctx.fillStyle = "rgba(4,8,6,0.7)";
    ctx.fillRect(x - 0.4, y - 0.4, w + 0.8, 2.1);
    ctx.fillStyle = "#3f7a2a";
    ctx.fillRect(x, y, w * clamp(c.lawn, 0, 1), 1.3);
    ctx.fillStyle = "#f0e08a";
    ctx.fillRect(x + w * 0.6 - 0.1, y - 0.4, 0.25, 2.1);
    label(ctx, `LAWN ${Math.round(clamp(c.lawn, 0, 1) * 100)}%`, x + w / 2, y + 1.15, 1.7, "#ffffff", "center");
  }

  function front(ctx, v) {
    const R = ride(v);
    const round = v.round;
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 8;
    const hi = cam + FW + 8;
    if (!c.done) mower(ctx, v, R, c);
    R.lows.forEach(([x0, x1, y, kind], i) => {
      if (x1 >= lo && x0 <= hi) {
        shadow(ctx, kind ? x0 - 1.5 : x0 - 3, kind ? x1 + 1.5 : x1 + 1.4, kind);
        low(ctx, v, x0, x1, y, kind, i);
      }
    });
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Clippings and splinters of hedge flying, tumbling.
    const bits = v.fx && v.fx.mowerBits;
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
    if (!c.done) lawnGauge(ctx, v, cam, c);
  }

  const dim = () => 0;

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const round = v.round;
    const c = state(v);
    if (!R || !c) return;
    const you = round.you;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    // The headlight's pool ahead.
    add(you.x + 6, you.y + 1.5, 11, 0.6);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 1.1, LANE + 4.5, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.beasts.forEach((x, i) => {
      if (x > lo && x < hi && (c.beasts[i].state === "warn" || c.beasts[i].state === "snap")) add(x, LANE + 3, 5, 0.3);
    });
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 > lo && x0 < hi) add((x0 + x1) / 2, y + 1, 6, 0.3 * (0.85 + 0.15 * Math.sin(v.clock / 200 + i)));
    });
    if (R.finish > lo - 14 && R.finish < hi) add(R.finish + 19, 17, 14, 0.6);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Leaves and splinters flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.mowerBits = (fx.mowerBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.mowerBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The cuts and the ducks repeat as the mower goes; keep them from stacking.
    if (e.type === "mowerDuck" && !gateOnce(fx, "mowerDuckMs", 160)) return true;
    if (e.type === "mowerGrass" && !gateOnce(fx, "mowerGrassMs", 140)) {
      burst(e.tx ?? e.x, e.y + 1, "#6aab3c", 3, 6, 300);
      return true;
    }
    say(tone, voice[0], voice[1], e.type === "mowerGrass" ? 0.35 : 0.5);
    switch (e.type) {
      case "mowerJump":
        burst(e.x, e.y, "#bcd89a", 5, 7, 300);
        break;
      case "mowerLand":
        fx.mowerLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, "#8ccb5a", e.big ? 12 : 6, e.big ? 11 : 8, 340);
        if (e.big) shake(180, 0.4);
        break;
      case "mowerCrash":
        shake(320, 1);
        flash(e.what === "pond" ? "#9fd0ff" : "#ffe0a0", 200);
        burst(e.x, e.y + 1, e.what === "pond" ? "#bfe6ff" : "#7a3a1c", 16, 16, 520);
        break;
      case "mowerCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "mowerFinish":
        shake(200, 0.5);
        burst(e.x, e.y, "#8ccb5a", 14, 12, 520);
        float(e.x, e.y + 5, "Mowed!", GOLD, 2.6);
        break;
      case "mowerGrass":
        burst(e.tx ?? e.x, e.y + 1, "#6aab3c", 6, 9, 360);
        break;
      case "mowerHedge":
        burst(e.x, e.y + 2, "#2c6a30", 14, 14, 480);
        splinter(fx, e.x, e.y + 2, ["#2c6a30", "#1c4a24", "#7a5a3a"]);
        float(e.x, e.y + 5, `+${e.points}`, GOLD, 2);
        break;
      case "mowerWeed":
        burst(e.x, e.y + 1, "#d27ae0", 6, 8, 340);
        float(e.x, e.y + 4, `+${e.points}`, GOLD, 1.8);
        break;
      case "mowerJam":
        shake(160, 0.5);
        burst(e.x + 4, e.y + 1, "#aaaaaa", 8, 6, 600);
        float(e.x, e.y + 6, "Jammed!", "#ff6a4a", 2.2);
        break;
      case "mowerBeastWarn":
        burst(e.x, e.y + 2, "#2c6a30", 5, 4, 420);
        break;
      case "mowerBeastSnap":
        burst(e.x, e.y + 2, "#2c6a30", 7, 8, 360);
        break;
      case "mowerBeastHit":
        burst(e.x, e.y, "#3a8a3a", 6, 9, 280);
        break;
      case "mowerBeastBreak":
        burst(e.x, e.y, "#2c6a30", 14, 14, 480);
        splinter(fx, e.x, e.y, ["#2c6a30", "#3a8a3a", "#1c4a24"]);
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
