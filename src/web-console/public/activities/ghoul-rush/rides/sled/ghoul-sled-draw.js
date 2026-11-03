// Plan2Code Web Console - Ghoul Rush's Coffin Sled, its drawing: a night ride down a long frozen cemetery hill. A moon and stars, far ridges and a crypt-studded mid hill that slope down to the right and scroll by at different speeds, the ice with its glittering rim and its dark cracks, headstones, snowdrifts, low branches and tombstone arches, ghoul hands stirring in the snow, ghouls that pop up beside the track, hanging icicles on a dead tree limb, the coffin lid with Planny on it, a spray of snow and racing streaks of flakes in front.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are
// plain data (the voices borrow older tones until the room's own sounds are picked);
// sledArt(d) takes ghoul-draw.js's drawing helpers (`d`) and hands back the drawing by
// kind, so this file never reaches back into it. Drawn in room units, the way
// ghoul-draw.js draws: y counted down from the field's top, so a world height `y` is
// drawn at `FIELD_H - y`. The still layers' pit is dark under the whole ride, so the sky,
// the hills, the ice and what stands on it are drawn by `moving` (every frame, over the
// cached still layers): parallax tiles and track chunks are cached in offscreen canvases of
// this file's own (no random numbers: everything comes from a hash). The lows (branches
// and arches), the lid and the flakes in front of Planny are drawn by `front`. What the art
// reads off the rules (ghoul-sled.js):
//
// - the room: `spec.ride` ({ track, stones, drifts, lows [x0, x1, y, kind], hands, icicles, pops,
//   checks, finish }), `spec.ground` (the hilltop at the start and the snowbank at the end).
// - `round.sled` (null in any other room): `v`, `line` (-1 in the air), `check`, `done`, `hands`
//   [{ state "snow" | "warn" | "up" | "sink" | "broken" | "spent", t }], `pops` [{ state "down" |
//   "up" | "hid" | "broken", t (ms left up) }], `icicles` [broken].
// - Planny: `you.state`, `you.vy` (tilts the lid in the air), `you.ducking`, `you.x`, `you.y`.
// - events leave short-lived bits in the view's `fx` (`sledBits`, `sledLand`, `sledFinish`).

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "sled", custom: true, noMoon: true, pit: "#060d1a", ...o });
export const LOOKS = freeze({
  sled: pit({ wallTop: "#0a1428", wallLow: "#1a3050", paper: "#2a4468", wainscot: "#1c2c44", floorTop: "#dfeaf6", floor: "#8fa8c4", floorEdge: "#2a3c58", shelf: "#3a4660", shelfTop: "#9ab0cc", window: "#cfe4ff", decor: "snow", color: "#bfe0ff", dark: 0.5 }),
});

// How each new kind sounds, by act (the sounds picked by ear, in ghoul-sfx-sled.js).
export const VOICES = freeze({
  sled: freeze({ jump: "ghoulSledJump", land: "ghoulSledLand", launch: "ghoulSledLaunch", duck: "ghoulSledDuck", crash: "ghoulSledCrash", check: "ghoulSledCheck", finish: "ghoulSledFinish" }),
  sledhand: freeze({ warn: "ghoulSledHandWarn", up: "ghoulSledHandUp", hit: "ghoulSledHandHit", break: "ghoulSledHandBreak" }),
  sledpop: freeze({ up: "ghoulSledPopUp", hit: "ghoulSledPopHit" }),
  sledicicle: freeze({ break: "ghoulSledIcicleBreak" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  sledJump: ["sled", "jump"],
  sledLand: ["sled", "land"],
  sledLaunch: ["sled", "launch"],
  sledDuck: ["sled", "duck"],
  sledCrash: ["sled", "crash"],
  sledCheck: ["sled", "check"],
  sledFinish: ["sled", "finish"],
  sledHandWarn: ["sledhand", "warn"],
  sledHandUp: ["sledhand", "up"],
  sledHandHit: ["sledhand", "hit"],
  sledHandBreak: ["sledhand", "break"],
  sledPopUp: ["sledpop", "up"],
  sledPopHit: ["sledpop", "hit"],
  sledIcicle: ["sledicicle", "break"],
});
export const LOSE_WORDS = freeze({ tomb: "Hit a headstone", drift: "Buried in a drift", branch: "Ducked too late", grasp: "Grabbed by a hand", crevasse: "Fell in a crack" });
export const LOSE_SOUNDS = freeze({
  tomb: ["smash", 0.6, 0.7],
  drift: ["ghoulRockLand", 0.5, 0.9],
  branch: ["clank", 0.5, 0.8],
  grasp: ["ghoulHandsGrab", 0.5, 1],
  crevasse: ["ghoulPitFall", 0.55, 0.9],
});

const FW = 96;
const CH = 48;
const SEAM = 0.5;
const SLED_V = 45;
const SNOW = "#eaf3fb";
const SNOW_D = "#b6cde4";
const STONE_C = "#8d98ac";
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
// A layer of `w` by `h` units painted once by paint(c) in unit coordinates, then reused; null
// where the context cannot say its scale (the caller paints direct).
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
const HALO = freeze({ warm: "255,196,110", red: "255,70,50", green: "90,240,130", cold: "150,205,255", white: "235,245,255" });
function halo(ctx, kind, x, y, r, alpha) {
  const sprite = layerFor(ctx, `sled:halo:${kind}`, 8, 8, (g) => {
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

// Each tile is painted over [0, W + SEAM] and repeats every W: whatever sticks out of one edge
// is painted again a tile over, so the seams never show.
const wrap = (W, fn) => {
  fn(0);
  fn(-W);
  fn(W);
};

// Draws a repeating tile layer at parallax factor `f` (1 moves with the track).
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

/* ----------------------------------------------------------- the hill, far and mid */

const WF = 168;
// The far ridge: a dark ridge that slopes down to the right and steps back up at the seam,
// behind a grove of pines; a church spire and a far crypt on it, and a few dead trees.
function pine(c, x, base, h, w) {
  c.fillStyle = "#0b1a2c";
  for (let k = 0; k < 4; k++) {
    const t = k / 4;
    const y = base - h * (0.25 + t * 0.75);
    poly(c, [[x, y - h * 0.34], [x - w * (1 - t * 0.55), y + h * 0.1], [x + w * (1 - t * 0.55), y + h * 0.1]]);
    c.fill();
  }
  c.fillStyle = "rgba(210,230,250,0.35)";
  for (let k = 0; k < 4; k++) {
    const t = k / 4;
    const y = base - h * (0.25 + t * 0.75);
    poly(c, [[x, y - h * 0.34], [x - w * (1 - t * 0.55) * 0.5, y - h * 0.08], [x + w * (1 - t * 0.55) * 0.2, y - h * 0.16]]);
    c.fill();
  }
}
function paintFar(c) {
  const ridge = (x) => 18 + (x / WF) * 11 + Math.sin(x * 0.11) * 1.1 + Math.sin(x * 0.27 + 1) * 0.5;
  c.fillStyle = vgrad(c, 14, 34, [[0, "#173055"], [1, "#0c1a30"]]);
  c.beginPath();
  c.moveTo(0, FH);
  for (let x = 0; x <= WF + SEAM; x += 2) c.lineTo(x, ridge(x));
  c.lineTo(WF + SEAM, FH);
  c.closePath();
  c.fill();
  // The snow on the ridge's top.
  c.strokeStyle = "rgba(190,215,240,0.4)";
  c.lineWidth = 0.35;
  c.beginPath();
  for (let x = 0; x <= WF + SEAM; x += 2) (x ? c.lineTo(x, ridge(x) + 0.1) : c.moveTo(x, ridge(x) + 0.1));
  c.stroke();
  // A far crypt, a church with its spire, and dead trees.
  const crypt = (x, w, h) => {
    const y = ridge(x);
    c.fillStyle = "#091524";
    c.fillRect(x - w / 2, y - h, w, h + 2);
    poly(c, [[x - w / 2 - 0.4, y - h], [x, y - h - w * 0.35], [x + w / 2 + 0.4, y - h]]);
    c.fill();
    c.fillStyle = "rgba(255,200,110,0.85)";
    c.fillRect(x - 0.35, y - h * 0.65, 0.7, h * 0.4);
  };
  crypt(46, 5, 4);
  crypt(118, 3.4, 3);
  const spireX = 82;
  const sy = ridge(spireX);
  c.fillStyle = "#091524";
  c.fillRect(spireX - 1.5, sy - 8, 3, 9);
  poly(c, [[spireX - 1.9, sy - 8], [spireX, sy - 14], [spireX + 1.9, sy - 8]]);
  c.fill();
  c.fillStyle = "rgba(255,200,110,0.8)";
  disc(c, spireX, sy - 6, 0.45);
  for (const [tx, th] of [[22, 6], [63, 5], [101, 7], [140, 5.5]]) {
    const ty = ridge(tx);
    c.strokeStyle = "#08121f";
    c.lineWidth = 0.4;
    seg(c, tx, ty + 1, tx, ty - th);
    for (let b = 0; b < 3; b++) {
      seg(c, tx, ty - th * (0.4 + b * 0.18), tx + (b % 2 ? 1.8 : -1.8), ty - th * (0.55 + b * 0.2));
    }
  }
  // The grove that hides the seam.
  wrap(WF, (o) => {
    for (let k = 0; k < 9; k++) pine(c, o + WF - 7 + k * 1.6 + (rnd(k, 3) - 0.5), ridge(Math.min(WF, Math.max(0, WF - 7 + k * 1.6 + o))) + 1.5, 6 + rnd(k, 1) * 4, 1.6 + rnd(k, 2) * 0.8);
  });
}

const WM = 120;
// The mid hill: a slope of snow down to the right under rows of leaning headstones, an iron
// fence and a crypt, with a knoll of dark pines at the seam where the slope steps back up.
function paintMid(c) {
  const slope = (x) => 30 + (x / WM) * 9;
  c.fillStyle = vgrad(c, 28, FH, [[0, "#38557c"], [0.5, "#223b5e"], [1, "#101e34"]]);
  c.beginPath();
  c.moveTo(0, FH);
  for (let x = 0; x <= WM + SEAM; x += 2) c.lineTo(x, slope(x) + Math.sin(x * 0.19) * 0.5);
  c.lineTo(WM + SEAM, FH);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(220,238,255,0.5)";
  c.lineWidth = 0.3;
  c.beginPath();
  for (let x = 0; x <= WM + SEAM; x += 2) (x ? c.lineTo(x, slope(x) + Math.sin(x * 0.19) * 0.5) : c.moveTo(x, slope(x) + Math.sin(x * 0.19) * 0.5));
  c.stroke();
  // Headstones, leaning, with snow caps.
  for (let k = 0; k < 17; k++) {
    const x = 4 + k * 6.9 + rnd(k, 1) * 2.4;
    if (x > WM - 8) continue;
    const y = slope(x) + 0.5;
    const h = 2.6 + rnd(k, 2) * 2.2;
    const w = 1.6 + rnd(k, 3) * 0.9;
    c.save();
    c.translate(x, y);
    c.rotate((rnd(k, 4) - 0.5) * 0.4);
    c.fillStyle = "#1a2a44";
    if (k % 4 === 0) {
      c.fillRect(-0.3, -h - 0.8, 0.6, h + 0.8);
      c.fillRect(-1.1, -h, 2.2, 0.55);
    } else {
      c.beginPath();
      c.moveTo(-w / 2, 0);
      c.lineTo(-w / 2, -h + w / 2);
      c.arc(0, -h + w / 2, w / 2, Math.PI, 0);
      c.lineTo(w / 2, 0);
      c.closePath();
      c.fill();
      c.fillStyle = "rgba(210,230,250,0.45)";
      c.fillRect(-w / 2, -h, w, 0.3);
    }
    c.restore();
  }
  // An iron fence along the slope, and a crypt.
  c.strokeStyle = "#0c1626";
  c.lineWidth = 0.18;
  for (let x = 8; x < 54; x += 1.4) seg(c, x, slope(x) + 0.5, x, slope(x) - 2);
  seg(c, 8, slope(8) - 1.2, 54, slope(54) - 1.2);
  const cx = 82;
  const cy = slope(cx) + 0.6;
  c.fillStyle = "#12203a";
  c.fillRect(cx - 5, cy - 6, 10, 6.6);
  poly(c, [[cx - 5.6, cy - 6], [cx, cy - 9.4], [cx + 5.6, cy - 6]]);
  c.fill();
  c.fillStyle = "#050b16";
  c.fillRect(cx - 1.3, cy - 4, 2.6, 4.6);
  c.fillStyle = "rgba(190,215,240,0.55)";
  c.fillRect(cx - 5.6, cy - 6.1, 11.2, 0.35);
  wrap(WM, (o) => {
    for (let k = 0; k < 8; k++) pine(c, o + WM - 6 + k * 1.5 + (rnd(k, 5) - 0.5), slope(Math.max(0, Math.min(WM, WM - 6 + k * 1.5 + o))) + 2, 8 + rnd(k, 6) * 4, 2 + rnd(k, 7));
  });
}

// The sky: night deepening up, a pale band at the horizon, a moon and stars (stars twinkle).
function sky(ctx, cam, clock) {
  ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#050a1c"], [0.45, "#10264a"], [0.75, "#3b6490"], [1, "#6b97b8"]]);
  ctx.fillRect(cam - 1, 0, FW + 2, FH);
  const par = 0.05;
  for (let k = 0; k < 46; k++) {
    const sx = cam + ((((rnd(k, 1) * FW - cam * par) % FW) + FW) % FW);
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(clock / 700 + k));
    ctx.fillStyle = `rgba(235,245,255,${0.25 + 0.5 * tw * rnd(k, 3)})`;
    ctx.fillRect(sx, 1 + rnd(k, 2) * 24, 0.22 + rnd(k, 4) * 0.12, 0.22);
  }
  const mx = cam + 70 - cam * 0.02;
  halo(ctx, "white", mx, 10, 13, 0.4);
  ctx.fillStyle = "#f4f8ff";
  disc(ctx, mx, 10, 4);
  ctx.fillStyle = "rgba(150,170,205,0.55)";
  disc(ctx, mx - 1.2, 9, 0.9);
  disc(ctx, mx + 1.4, 11.2, 1.1);
  disc(ctx, mx + 0.3, 8.1, 0.5);
}

/* -------------------------------------------------------- the track, in chunks */

const yOn = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  let i = 0;
  while (i < pts.length - 2 && x > pts[i + 1][0]) i++;
  const [xa, ya] = pts[i];
  const [xb, yb] = pts[i + 1];
  if (x >= xb) return yb;
  return ya + ((yb - ya) * (x - xa)) / (xb - xa);
};
const heightAt = (R, x) => {
  let best = null;
  for (const pts of R.track) {
    if (x < pts[0][0] || x > pts[pts.length - 1][0]) continue;
    const y = yOn(pts, x);
    if (best === null || y > best) best = y;
  }
  return best;
};

// The ice of every line over [xa, xb]: a fill of snow down to the bottom, a bright rim, glints
// and blue shade beneath; and at each line's end a ragged edge over a dark crack.
function paintTrack(c, R, xa, xb) {
  for (const pts of R.track) {
    const x0 = pts[0][0];
    const x1 = pts[pts.length - 1][0];
    const lo = Math.max(xa, x0);
    const hi = Math.min(xb, x1);
    if (hi <= lo) continue;
    const xs = [lo];
    for (const [px] of pts) if (px > lo && px < hi) xs.push(px);
    xs.push(hi);
    const top = (x) => FH - yOn(pts, x);
    // The body.
    c.fillStyle = vgrad(c, 0, FH, [[0, "#e8f2fb"], [0.5, "#b7cee6"], [1, "#5c7aa0"]]);
    c.beginPath();
    c.moveTo(lo, FH + 1);
    for (const x of xs) c.lineTo(x, top(x));
    c.lineTo(hi, FH + 1);
    c.closePath();
    c.fill();
    // A deeper band of shade following the slope (a long curve of blue below the rim).
    for (const [off, col] of [[1.6, "rgba(120,160,205,0.30)"], [4.2, "rgba(70,105,160,0.30)"], [8.4, "rgba(40,70,120,0.30)"]]) {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(lo, FH + 1);
      for (const x of xs) c.lineTo(x, top(x) + off);
      c.lineTo(hi, FH + 1);
      c.closePath();
      c.fill();
    }
    // Wind-carved ripples: long thin lines parallel to the slope.
    c.strokeStyle = "rgba(255,255,255,0.42)";
    c.lineWidth = 0.1;
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      let began = false;
      for (let x = Math.ceil(lo / 3) * 3; x <= hi; x += 3) {
        const y = top(x) + 0.9 + k * 1.3 + Math.sin(x * 0.4 + k * 2) * 0.22;
        if (!began) c.moveTo(x, y);
        else c.lineTo(x, y);
        began = true;
      }
      c.stroke();
    }
    // The bright rim.
    c.strokeStyle = "#ffffff";
    c.lineWidth = 0.34;
    c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(x, top(x)) : c.moveTo(x, top(x))));
    c.stroke();
    c.strokeStyle = "rgba(120,170,225,0.8)";
    c.lineWidth = 0.14;
    c.beginPath();
    xs.forEach((x, i) => (i ? c.lineTo(x, top(x) + 0.28) : c.moveTo(x, top(x) + 0.28)));
    c.stroke();
    // Glints.
    c.fillStyle = "#ffffff";
    for (let x = Math.ceil(lo / 5) * 5; x <= hi; x += 5) {
      const n = Math.round(x);
      if (rnd(n, 9) < 0.5) continue;
      const gy = top(x) + 0.5 + rnd(n, 1) * 3;
      c.fillRect(x, gy, 0.16 + rnd(n, 2) * 0.2, 0.1);
    }
    // A line's ends: the cracked edge.
    for (const [end, dir] of [[x0, -1], [x1, 1]]) {
      if (end < xa - 2 || end > xb + 2) continue;
      if ((dir < 0 && end <= R.track[0][0][0] + 0.5) || (dir > 0 && end >= R.track[R.track.length - 1].at(-1)[0] - 0.5)) continue;
      const ey = top(end);
      c.fillStyle = "#4d6d98";
      for (let k = 0; k < 6; k++) {
        const yy = ey + 0.6 + k * 2.1 + rnd(Math.round(end), k) * 0.8;
        poly(c, [[end, yy], [end - dir * (0.7 + rnd(Math.round(end), k + 9) * 1.4), yy + 1.1], [end, yy + 2.1]]);
        c.fill();
      }
      c.strokeStyle = "rgba(190,225,255,0.9)";
      c.lineWidth = 0.2;
      for (let k = 0; k < 3; k++) seg(c, end, ey + 0.2 + k * 4, end - dir * (0.8 + k * 0.3), ey + 3 + k * 4);
    }
  }
  // The cracks: a dark blue depth between one line's end and the next one's start.
  for (let i = 0; i + 1 < R.track.length; i++) {
    const a = R.track[i].at(-1)[0];
    const b = R.track[i + 1][0][0];
    if (b < xa - 2 || a > xb + 2) continue;
    c.fillStyle = vgrad(c, 0, FH, [[0, "#122646"], [0.5, "#08142a"], [1, "#02060e"]]);
    c.fillRect(a, FH - Math.max(heightAt(R, a - 0.1) ?? 0, heightAt(R, b + 0.1) ?? 0) + 0.8, b - a, FH);
    // Ice teeth hanging into the depth, and a cold glow far below.
    c.fillStyle = "#6f9bd0";
    for (let x = a + 0.8; x < b - 0.4; x += 1.7) {
      const n = Math.round(x * 10);
      poly(c, [[x - 0.4, FH - (heightAt(R, a - 0.1) ?? 0) + 1.3], [x, FH - (heightAt(R, a - 0.1) ?? 0) + 1.4 + 1.6 + rnd(n, 1) * 2.2], [x + 0.4, FH - (heightAt(R, a - 0.1) ?? 0) + 1.3]]);
      c.fill();
    }
    c.fillStyle = "rgba(110,190,255,0.28)";
    c.fillRect(a, FH - 3.6, b - a, 3.6);
  }
}

/* ------------------------------------------------------------- telegraphs */

// What to do about each obstacle, shown as a glyph that fades in ahead of it: DUCK for a low
// branch or an arch (an arrow down, warm amber), JUMP for a crack, a headstone or a drift (an
// arrow up, cyan). Hands, icicles and ghouls are shot, so they get none. Everything comes from
// the room's `ride` fields and where the sled is (no random numbers, no rules).
export const TELEGRAPH_SEE = 40; // starts fading in this far ahead
export const TELEGRAPH_FULL = 30; // fully in by here
export const TELEGRAPH_WORDS = 3; // the first this many of each kind also spell the word
export const TELEGRAPH_ALPHA = 0.72;
export const ANSWERS = freeze({ crack: "JUMP", stone: "JUMP", drift: "JUMP", branch: "DUCK", arch: "DUCK" });
export const ANSWER_COLORS = freeze({ JUMP: "#5fe3ff", DUCK: "#ffb02e" });

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
    add("crack", a, (a + b) / 2, Math.max(heightAt(R, a - 0.1) ?? 0, heightAt(R, b + 0.1) ?? 0) + 6.5);
  }
  for (const [x] of R.stones) add("stone", x, x, (heightAt(R, x) ?? 10) + 7);
  for (const [x] of R.drifts) add("drift", x, x, (heightAt(R, x) ?? 10) + 7);
  for (const [x0, x1, y, kind] of R.lows) add(kind ? "arch" : "branch", kind ? x0 - 4.6 : x0 - 3.2, (x0 + x1) / 2, y + (kind ? 6.8 : 7.4));
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with the sled at `x`: { ...mark, alpha (0..1, before the pulse), words }.
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

export function sledArt(d) {
  const { ellipse, say, label, GOLD, EYE_PALE } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.sled ? v.spec.ride : null);
  const worldY = (y) => FH - y;
  const slopeAt = (R, x) => {
    const y0 = heightAt(R, x - 2.2);
    const y1 = heightAt(R, x + 2.2);
    return y0 !== null && y1 !== null ? (y1 - y0) / 4.4 : 0;
  };

  // The snowbank's height at x (the ground piece there), for a lid at rest.
  const worldGround = (v, x) => {
    for (const [a, b, top] of v.spec.ground) if (x >= a && x <= b) return top;
    return 10;
  };

  /* ------------------------------------------------------------- the room */

  // The still layers only get the sky's color: the world is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The hilltop at the start and the snowbank at the end: snow with wind ripples.
  function ground(ctx, v, look, a, b, top) {
    const y = v.g.FIELD_H - top;
    ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#f2f8ff"], [0.3, "#bcd2ea"], [1, "#4f6f98"]]);
    ctx.fillRect(a, y, b - a, top + 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(a, y, b - a, 0.35);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 0.1;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      for (let x = a; x <= b; x += 3) ctx.lineTo(x, y + 1.3 + k * 1.5 + Math.sin(x * 0.3 + k) * 0.25);
      ctx.stroke();
    }
  }
  function shelf() {}

  /* ------------------------------------------------------------ the things */

  // A gravestone: a slab with a round top, a cross, or an obelisk, leaning a little, snow on top.
  function stone(ctx, x, base, i) {
    const kind = i % 3;
    const lean = (rnd(i, 4) - 0.5) * 0.12;
    ctx.save();
    ctx.translate(x, base);
    ctx.rotate(lean);
    ctx.fillStyle = "rgba(10,25,50,0.35)";
    ellipse(ctx, 0.3, 0.1, 1.9, 0.35);
    ctx.fill();
    ctx.fillStyle = STONE_C;
    if (kind === 0) {
      // A slab, round topped.
      ctx.beginPath();
      ctx.moveTo(-1.3, 0);
      ctx.lineTo(-1.3, -3.6);
      ctx.arc(0, -3.6, 1.3, Math.PI, 0);
      ctx.lineTo(1.3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#6b768c";
      ctx.fillRect(0.5, -3.7, 0.8, 3.7);
      ctx.strokeStyle = "#4a5468";
      ctx.lineWidth = 0.14;
      seg(ctx, -0.55, -4.4, 0.55, -4.4);
      seg(ctx, 0, -4.9, 0, -3.5);
      seg(ctx, -0.8, -2.2, 0.7, -2.2);
      seg(ctx, -0.8, -1.5, 0.4, -1.5);
    } else if (kind === 1) {
      // A cross.
      ctx.fillRect(-0.5, -5, 1, 5);
      ctx.fillRect(-1.5, -3.9, 3, 0.95);
      ctx.fillRect(-1.2, -0.8, 2.4, 0.8);
      ctx.fillStyle = "#6b768c";
      ctx.fillRect(0.1, -5, 0.4, 5);
    } else {
      // An obelisk.
      poly(ctx, [[-1.0, 0], [-0.75, -4.2], [0, -5], [0.75, -4.2], [1.0, 0]]);
      ctx.fill();
      ctx.fillStyle = "#6b768c";
      poly(ctx, [[0.2, 0], [0.2, -4.7], [0.75, -4.2], [1.0, 0]]);
      ctx.fill();
      ctx.fillStyle = "#a9b4c8";
      ctx.fillRect(-1.3, -0.5, 2.6, 0.5);
    }
    // Snow on its top and drifted against its foot.
    ctx.fillStyle = SNOW;
    if (kind === 0) {
      ctx.beginPath();
      ctx.arc(0, -3.6, 1.35, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(0, -3.9);
      ctx.fill();
    } else if (kind === 1) {
      ctx.fillRect(-1.55, -4.05, 3.1, 0.3);
      ctx.fillRect(-0.55, -5.15, 1.1, 0.3);
    } else {
      poly(ctx, [[-0.6, -4.6], [0, -5.1], [0.6, -4.6]]);
      ctx.fill();
    }
    poly(ctx, [[-2.2, 0.1], [-1.2, -0.7], [-0.4, 0.1]]);
    ctx.fill();
    ctx.restore();
  }

  // A snowdrift: a soft heap with a blue shadow side, a sparkle, and now and then a boot sticking out.
  function drift(ctx, x, base, i) {
    const w = 7.5;
    ctx.fillStyle = "rgba(10,25,50,0.3)";
    ellipse(ctx, x + 0.6, base + 0.05, w * 0.55, 0.4);
    ctx.fill();
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.bezierCurveTo(x - w * 0.34, base - 2.8, x - w * 0.08, base - 3.1, x + w * 0.12, base - 2.5);
    ctx.bezierCurveTo(x + w * 0.3, base - 2.1, x + w * 0.4, base - 1.2, x + w / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(130,170,215,0.55)";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, base - 2.3);
    ctx.bezierCurveTo(x + w * 0.3, base - 2.0, x + w * 0.42, base - 1.1, x + w / 2, base);
    ctx.lineTo(x + w * 0.05, base);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.4, base - 1.1);
    ctx.bezierCurveTo(x - w * 0.3, base - 2.5, x - w * 0.1, base - 2.9, x + w * 0.1, base - 2.4);
    ctx.stroke();
    if (i % 3 === 1) {
      ctx.fillStyle = "#3a2a20";
      ctx.fillRect(x - w * 0.18, base - 3.6, 0.7, 1.5);
      ctx.fillRect(x - w * 0.18, base - 3.7, 1.3, 0.5);
    }
  }

  // A hand in the snow: a stirring mound, a shiver of cracks, then a pale arm reaching up.
  function hand(ctx, v, x, base, h, i) {
    const clock = v.clock;
    if (h.state === "spent") {
      ctx.fillStyle = SNOW;
      ellipse(ctx, x, base, 1.7, 0.45);
      ctx.fill();
      return;
    }
    if (h.state === "broken") {
      ctx.fillStyle = SNOW_D;
      ellipse(ctx, x, base, 2, 0.5);
      ctx.fill();
      return;
    }
    // The mound.
    const shake = h.state === "warn" ? Math.sin(clock / 28) * 0.18 : 0;
    ctx.fillStyle = h.state === "snow" ? "#dce9f6" : SNOW;
    ctx.save();
    ctx.translate(x + shake, base);
    ctx.scale(1, (h.state === "snow" ? 0.7 : 1.0) / 2.3);
    ctx.beginPath();
    ctx.arc(0, 0, 2.3, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(60,90,140,0.7)";
    ctx.lineWidth = 0.14;
    seg(ctx, x - 1.4, base - 0.1, x - 0.2, base - 0.7);
    seg(ctx, x + 0.2, base - 0.7, x + 1.3, base - 0.2);
    if (h.state === "snow") return;
    if (h.state === "warn") {
      for (let k = 0; k < 6; k++) {
        const p = ((clock / 260 + k * 0.17) % 1);
        ctx.fillStyle = `rgba(240,248,255,${0.8 - p * 0.8})`;
        disc(ctx, x + (rnd(k, 2) - 0.5) * 3.4, base - 0.4 - p * 2.4, 0.18 + rnd(k, 3) * 0.15);
      }
      return;
    }
    // The arm: it rises (or sinks) over the first and last part of its time.
    const up = h.state === "up" ? clamp((1600 - h.t) / 220, 0, 1) : clamp(h.t / 300, 0, 1);
    const rise = 4.4 * (0.2 + 0.8 * up);
    const sway = Math.sin(clock / 130 + i) * 0.22;
    ctx.save();
    ctx.translate(x, base);
    ctx.strokeStyle = "#5d7fa8";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 0.2);
    ctx.quadraticCurveTo(0.4 + sway, -rise * 0.5, sway * 1.5, -rise + 0.8);
    ctx.stroke();
    ctx.strokeStyle = "#a8c8e6";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, 0.2);
    ctx.quadraticCurveTo(0.4 + sway, -rise * 0.5, sway * 1.5, -rise + 0.8);
    ctx.stroke();
    // The palm and four clutching fingers.
    ctx.fillStyle = "#b9d4ee";
    ellipse(ctx, sway * 1.5, -rise + 0.5, 0.85, 0.7);
    ctx.fill();
    ctx.strokeStyle = "#a0c0e0";
    ctx.lineWidth = 0.28;
    for (let f = 0; f < 4; f++) {
      const a = -1.2 + f * 0.8 + Math.sin(clock / 110 + f + i) * 0.2;
      seg(ctx, sway * 1.5 + (f - 1.5) * 0.4, -rise + 0.2, sway * 1.5 + (f - 1.5) * 0.55 + Math.sin(a) * 0.5, -rise - 1.0 - Math.cos(a) * 0.3);
    }
    ctx.lineCap = "butt";
    ctx.restore();
    if (h.state === "up") halo(ctx, "cold", x, base - rise * 0.6, 3, 0.25);
  }

  // A ghoul popped up from behind a bank: a hooded gray head, pale eyes, claws over the top.
  function pop(ctx, v, x, base, p, i) {
    if (p.state === "down" || p.state === "hid" || p.state === "broken") {
      // The bank it hides behind.
      ctx.fillStyle = p.state === "broken" ? SNOW_D : "#d6e5f4";
      ellipse(ctx, x, base, 2.4, p.state === "broken" ? 0.5 : 0.9);
      ctx.fill();
      return;
    }
    const age = 2400 - p.t;
    const out = clamp(age / 260, 0, 1) * clamp(p.t / 220, 0, 1);
    const clock = v.clock;
    const rise = 4.6 * (0.1 + 0.9 * out);
    const bob = Math.sin(clock / 150 + i) * 0.15;
    ctx.save();
    ctx.translate(x, base);
    // The body, torn gray cloth, and the hood.
    ctx.fillStyle = "#3b4a56";
    poly(ctx, [[-1.5, 0.4], [-1.2, -rise * 0.62], [-0.5, -rise * 0.85], [0.5, -rise * 0.85], [1.2, -rise * 0.62], [1.5, 0.4]]);
    ctx.fill();
    ctx.fillStyle = "#2a3640";
    poly(ctx, [[-0.5, -rise * 0.85], [0, -rise - bob], [0.5, -rise * 0.85]]);
    ctx.fill();
    ctx.fillStyle = "#9fb4a8";
    ellipse(ctx, 0, -rise * 0.82 + bob, 0.85, 0.95);
    ctx.fill();
    ctx.fillStyle = "#0b1218";
    ellipse(ctx, 0, -rise * 0.78 + bob, 0.6, 0.65);
    ctx.fill();
    // Raised claws.
    ctx.strokeStyle = "#8aa096";
    ctx.lineWidth = 0.42;
    ctx.lineCap = "round";
    const wave = Math.sin(clock / 110 + i) * 0.4;
    seg(ctx, -1.2, -rise * 0.5, -2.2 + wave, -rise * 0.9);
    seg(ctx, 1.2, -rise * 0.5, 2.2 - wave, -rise * 0.9);
    ctx.lineCap = "butt";
    ctx.restore();
    // The eyes burn in the dark.
    v.eyes.push(x - 0.3, base - rise * 0.8 + bob, 0.28, EYE_PALE);
    v.eyes.push(x + 0.3, base - rise * 0.8 + bob, 0.28, EYE_PALE);
    ctx.fillStyle = "#e8f6ff";
    disc(ctx, x - 0.3, base - rise * 0.8 + bob, 0.17);
    disc(ctx, x + 0.3, base - rise * 0.8 + bob, 0.17);
    // The bank in front of it.
    ctx.fillStyle = "#d6e5f4";
    ellipse(ctx, x, base, 2.4, 0.9);
    ctx.fill();
  }

  // A dead tree limb on a post with a cluster of icicles hanging from it.
  function icicles(ctx, v, x, base, broken, i) {
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.5;
    seg(ctx, x - 1.9, base + 0.2, x - 1.9, base - 8.4);
    ctx.lineWidth = 0.38;
    seg(ctx, x - 1.9, base - 8.2, x + 1.5, base - 7.9);
    seg(ctx, x + 1.5, base - 7.9, x + 2.1, base - 7.2);
    ctx.fillStyle = SNOW;
    ctx.fillRect(x - 2.4, base - 8.7, 1, 0.3);
    ctx.fillRect(x - 0.2, base - 8.2, 1.6, 0.25);
    const n = 5;
    for (let k = 0; k < n; k++) {
      const ix = x - 0.9 + k * 0.55;
      const len = broken ? 0.4 + rnd(i + k, 2) * 0.5 : 2.2 + rnd(i * 5 + k, 1) * 2.3 - Math.abs(k - 2) * 0.3;
      const top = base - 7.95 + (k - 2) * 0.03;
      ctx.fillStyle = "rgba(190,230,255,0.92)";
      poly(ctx, [[ix - 0.24, top], [ix, top + len], [ix + 0.24, top]]);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      poly(ctx, [[ix - 0.1, top], [ix - 0.02, top + len * 0.8], [ix + 0.06, top]]);
      ctx.fill();
    }
    if (!broken) halo(ctx, "cold", x, base - 6, 3.2, 0.22 + 0.1 * Math.sin(v.clock / 300 + i));
  }

  // A checkpoint: a post with a lantern, red until passed, then green.
  function checkpoint(ctx, v, x, base, on, i) {
    const clock = v.clock;
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.35;
    seg(ctx, x, base + 0.2, x, base - 5.4);
    seg(ctx, x, base - 5.2, x + 1.1, base - 5.2);
    const pulse = on ? 1 : 0.7 + 0.3 * Math.sin(clock / 160 + i);
    halo(ctx, on ? "green" : "red", x + 1.1, base - 4.5, on ? 4.2 : 3.6, 0.7 * pulse);
    ctx.fillStyle = "#1c1a22";
    ctx.fillRect(x + 0.6, base - 5.3, 1, 1.7);
    ctx.fillStyle = on ? "#7dffa0" : "#ff5a40";
    ctx.fillRect(x + 0.75, base - 5.1, 0.7, 1.3);
    ctx.fillStyle = on ? "#eaffee" : "#ffc0a0";
    ctx.fillRect(x + 0.95, base - 4.9, 0.25, 0.5);
  }

  // The finish: a string of lanterns across a pair of posts and a checkered pennant.
  function finishGate(ctx, v, x, base) {
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.5;
    seg(ctx, x, base, x, base - 9);
    seg(ctx, x + 14, base, x + 14, base - 9);
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(x, base - 8.6);
    ctx.quadraticCurveTo(x + 7, base - 6.2, x + 14, base - 8.6);
    ctx.stroke();
    for (let k = 1; k < 6; k++) {
      const t = k / 6;
      const lx = x + 14 * t;
      const ly = base - 8.6 + 4 * t * (1 - t) * 2.4 * 0.9 + 0.3;
      halo(ctx, "warm", lx, ly + 0.6, 2.8, 0.55);
      ctx.fillStyle = k % 2 ? "#ffcf6a" : "#ff8a4a";
      ctx.fillRect(lx - 0.35, ly, 0.7, 1);
    }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = (r + c) % 2 ? "#14141a" : "#f4f4f8";
      ctx.fillRect(x + 4 + c * 0.9, base - 12.2 + r * 0.9, 0.9, 0.9);
    }
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.2;
    seg(ctx, x + 4, base - 12.4, x + 4, base - 9);
  }

  /* ---------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.sled;
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const clock = v.clock;
    cam = Math.round(cam * 8) / 8;
    // The sky and the hills: parallax tiles, the hill sloping down to the right.
    sky(ctx, cam, clock);
    tile(ctx, "sled:far", WF, 0.12, cam, paintFar);
    tile(ctx, "sled:mid", WM, 0.34, cam, paintMid);
    // The ice, in cached chunks.
    const k0 = Math.max(0, Math.floor(cam / CH));
    const k1 = Math.floor((cam + FW) / CH);
    for (let k = k0; k <= k1; k++) {
      const layer = layerFor(ctx, `sled:track:${k}`, CH + SEAM, FH, (g) => {
        g.translate(-k * CH, 0);
        paintTrack(g, R, k * CH - 6, k * CH + CH + SEAM + 6);
      });
      if (layer) ctx.drawImage(layer, k * CH, 0, CH + SEAM, FH);
      else if (k === k0) paintTrack(ctx, R, cam - 6, cam + FW + 6);
    }
    const lo = cam - 8;
    const hi = cam + FW + 8;
    const baseOf = (x, line) => worldY(heightAt(R, x) ?? 10);
    // Checkpoints.
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, baseOf(x), i <= c.check, i);
    });
    if (R.finish > lo - 14 && R.finish < hi) finishGate(ctx, v, R.finish + 12, worldY(10));
    // The shadow a branch or an arch throws on the snow beneath it: it hangs over the sled.
    R.lows.forEach(([x0, x1, y, kind], i) => {
      if (x1 > lo && x0 < hi) shadow(ctx, R, kind ? x0 - 4.6 : x0 - 3.2, kind ? x1 + 4.6 : x1 + 0.5, kind);
    });
    // Icicle limbs, ghouls, hands, drifts and stones.
    R.icicles.forEach(([x, line], i) => {
      if (x > lo && x < hi) icicles(ctx, v, x, worldY(heightAt(R, x) ?? 10), Boolean(c.icicles[i]), i);
    });
    R.pops.forEach(([x, line], i) => {
      if (x > lo && x < hi) pop(ctx, v, x, baseOf(x, line), c.pops[i], i);
    });
    R.hands.forEach(([x, line], i) => {
      if (x > lo && x < hi) hand(ctx, v, x, baseOf(x, line), c.hands[i], i);
    });
    R.drifts.forEach(([x, line], i) => {
      if (x > lo && x < hi) drift(ctx, x, baseOf(x, line), i);
    });
    R.stones.forEach(([x, line], i) => {
      if (x > lo && x < hi) stone(ctx, x, baseOf(x, line), i);
    });
    // The hilltop and the snowbank, over the sky (the still layers' were painted under it).
    for (const [a, b, top] of v.spec.ground) if (a >= R.finish - 1 && b > lo && a < hi) ground(ctx, v, LOOKS.sled, a, b, top);
    // A finished ride: the lid rests where it came to a stop, behind Planny as he walks out.
    if (c.done) lid(ctx, v, R, c);
    // Flakes falling and blowing across, behind Planny.
    flakes(ctx, v, cam, c, 0);
  }

  // Snow in the air: three kinds of flake at different depths, slanted by the speed.
  function flakes(ctx, v, cam, c, layer) {
    const clock = v.clock;
    const sp = c.done ? 0.4 : clamp(c.v / SLED_V, 0.5, 1.5);
    const sets = layer === 0 ? [[0.6, 0.18, 34], [0.85, 0.26, 26]] : [[1.5, 0.42, 14]];
    sets.forEach(([par, size, n], si) => {
      const W = 160;
      for (let k = 0; k < n; k++) {
        const fall = (clock / (1700 - si * 250 + (k % 5) * 120) + rnd(k, si + 20)) % 1;
        const bx = rnd(k, si + 40) * W - cam * par - fall * 6 * sp;
        const x = cam + ((((bx) % W) + W) % W) - 12;
        if (x < cam - 1 || x > cam + FW + 1) continue;
        const y = fall * (FH + 4) - 2;
        ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.4 * rnd(k, 5)})`;
        if (layer === 0) ctx.fillRect(x, y, size, size);
        else seg2(ctx, x, y, x + 2.4 * sp, y + 0.2 + 0.1 * rnd(k, 6), size * 0.5);
      }
    });
  }
  function seg2(ctx, x0, y0, x1, y1, w) {
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = w;
    seg(ctx, x0, y0, x1, y1);
  }

  /* ------------------------------------------------------ the lid, in front */

  // Draws the lid of a coffin sled with Planny on it (he is drawn by the game under it).
  function lid(ctx, v, R, c) {
    const { round } = v;
    const you = round.you;
    const clock = v.clock;
    const fx = v.fx;
    const done = c.done;
    const x = done && c.restX !== undefined ? c.restX : you.x;
    let pitch;
    let y = done ? worldGround(v, x) : you.y;
    if (done) {
      pitch = 0;
    } else if (c.line >= 0) pitch = Math.atan2(heightAt(R, x + 3) - heightAt(R, x - 3), 6) * 0.95;
    else pitch = clamp(you.vy / Math.max(14, c.v), -1, 1) * 0.5;
    const shake = !done && c.line >= 0 ? Math.sin(clock / 31) * 0.03 * (c.v / SLED_V) : 0;
    ctx.save();
    ctx.translate(x, FH - y + shake);
    ctx.rotate(-pitch);
    // The snow spray off the runners, longer the faster it goes.
    if (!done && c.line >= 0) {
      for (let k = 0; k < 14; k++) {
        const p = ((clock / (330 + (k % 4) * 60) + k * 0.113) % 1);
        ctx.fillStyle = `rgba(250,253,255,${(1 - p) * 0.8})`;
        disc(ctx, -3.2 - p * (3 + (c.v / SLED_V) * 3.2) * (0.6 + rnd(k, 1)), -0.2 - p * (0.8 + rnd(k, 2) * 1.8), 0.16 + (1 - p) * 0.22 + rnd(k, 3) * 0.12);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 0.1;
      for (let k = 0; k < 3; k++) seg(ctx, -3.6 - k, -0.6 - k * 0.6, -7.5 - k * 2.3 - (c.v - 30) * 0.12, -0.6 - k * 0.6);
    }
    // The lid itself, side on: a long dark plank curled at the nose, with a brass cross plate and rope.
    ctx.save();
    ctx.scale(1.12, 1.45);
    ctx.fillStyle = "rgba(10,20,40,0.35)";
    ellipse(ctx, 0.2, 0.55, 3.8, 0.28);
    ctx.fill();
    const wood = vgrad(ctx, -0.9, 0.5, [[0, "#6b4a30"], [0.55, "#4a3020"], [1, "#2a1a10"]]);
    ctx.fillStyle = wood;
    ctx.beginPath();
    ctx.moveTo(-3.7, 0.2);
    ctx.lineTo(-3.7, -0.5);
    ctx.lineTo(2.4, -0.55);
    ctx.quadraticCurveTo(3.7, -0.6, 4.0, -1.5);
    ctx.quadraticCurveTo(3.95, -0.3, 3.2, 0.2);
    ctx.lineTo(-3.7, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1a0f08";
    ctx.lineWidth = 0.12;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,210,160,0.25)";
    ctx.lineWidth = 0.08;
    seg(ctx, -3.5, -0.4, 2.4, -0.45);
    seg(ctx, -3.2, 0.05, 3.0, 0.0);
    // The brass cross plate and nails.
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(-0.25, -0.5, 0.5, 0.3);
    ctx.fillRect(-0.55, -0.4, 1.1, 0.12);
    ctx.fillStyle = "#e8d38a";
    for (const nx of [-3.2, -1.8, 1.4, 2.8]) disc(ctx, nx, -0.2, 0.09);
    // The runners and the rope to his hand.
    ctx.strokeStyle = "#cfe0f2";
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(-3.6, 0.55);
    ctx.lineTo(2.9, 0.58);
    ctx.quadraticCurveTo(3.8, 0.6, 4.0, -0.3);
    ctx.stroke();
    ctx.strokeStyle = "#8a6a44";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(3.9, -1.3);
    ctx.quadraticCurveTo(2.2, -0.9, 1.2, -2.2);
    ctx.stroke();
    ctx.restore();
    // A landing's puff of snow.
    const land = fx && fx.sledLand !== undefined ? fx.clock - fx.sledLand.t0 : 1e9;
    if (land < 380) {
      for (let k = 0; k < 8; k++) {
        const p = land / 380;
        ctx.fillStyle = `rgba(250,253,255,${(1 - p) * 0.8})`;
        disc(ctx, (k - 3.5) * 0.9 * (0.5 + p * 1.4), -0.3 - p * (1 + rnd(k, 4) * 1.6) * (fx.sledLand.big ? 1.6 : 1), 0.3 + p * 0.3);
      }
    }
    ctx.restore();
  }

  // A dark band along the ice under a low: soft ends, following the hill.
  function shadow(ctx, R, xa, xb, kind) {
    const top = [];
    const bot = [];
    for (let x = xa; x <= xb + 0.01; x += 1) {
      const h = heightAt(R, x);
      if (h === null) continue;
      top.push([x, FH - h - 0.3]);
      bot.push([x, FH - h + 1.6]);
    }
    if (top.length < 2) return;
    ctx.fillStyle = `rgba(4,8,22,${kind ? 0.3 : 0.4})`;
    poly(ctx, top.concat(bot.reverse()));
    ctx.fill();
  }

  // A low branch: a gnarled limb across the track with snow along its top and icicles under it,
  // from a trunk behind; or a tombstone arch: two posts and a carved lintel.
  function low(ctx, v, x0, x1, y, kind, i, R) {
    const clock = v.clock;
    const under = worldY(y);
    const w = x1 - x0;
    if (kind === 1) {
      const top = under - 3.2;
      for (const px of [x0 - 4.6, x1 + 2.8]) {
        const foot = FH - (heightAt(R, px + 0.9) ?? 10) + 0.4;
        ctx.fillStyle = "#7c879c";
        ctx.fillRect(px, top, 1.8, foot - top);
        ctx.fillStyle = "#5b667c";
        ctx.fillRect(px + 1.2, top, 0.6, foot - top);
        ctx.fillStyle = "#a9b4c8";
        ctx.fillRect(px - 0.3, foot - 0.5, 2.4, 0.5);
        ctx.fillStyle = SNOW;
        ctx.fillRect(px - 0.2, top - 0.2, 2.2, 0.4);
      }
      ctx.fillStyle = "#8d98ac";
      ctx.fillRect(x0 - 4.9, top, w + 9.8, 3.2);
      ctx.fillStyle = "#a9b4c8";
      ctx.fillRect(x0 - 4.9, top, w + 9.8, 0.25);
      ctx.fillStyle = "#5b667c";
      ctx.fillRect(x0 - 4.9, top + 2.95, w + 9.8, 0.25);
      ctx.strokeStyle = "#4a5468";
      ctx.lineWidth = 0.12;
      for (let k = 0; k < 3; k++) seg(ctx, x0 - 1.4 + k * (w + 2.8) / 3, top + 0.7, x0 - 0.4 + k * (w + 2.8) / 3, top + 2.5);
      // A skull keystone.
      const xm = (x0 + x1) / 2;
      ctx.fillStyle = "#c9d2e2";
      ellipse(ctx, xm, top + 1.4, 0.8, 0.85);
      ctx.fill();
      ctx.fillStyle = "#1a2030";
      disc(ctx, xm - 0.3, top + 1.3, 0.2);
      disc(ctx, xm + 0.3, top + 1.3, 0.2);
      ctx.fillRect(xm - 0.15, top + 1.7, 0.3, 0.35);
      ctx.fillStyle = SNOW;
      poly(ctx, [[x0 - 5, top], [x0 - 2, top - 0.9], [x0 + 1, top - 0.2], [xm, top - 1.1], [x1 - 1, top - 0.3], [x1 + 2, top - 0.8], [x1 + 5, top]]);
      ctx.fill();
      // Icicles under it.
      for (let k = 0; k < 7; k++) {
        const ix = x0 - 2 + k * (w + 4) / 6;
        ctx.fillStyle = "rgba(190,230,255,0.9)";
        poly(ctx, [[ix - 0.22, under - 0.05], [ix, under + 0.6 + rnd(i * 7 + k, 1) * 1.1], [ix + 0.22, under - 0.05]]);
        ctx.fill();
      }
      halo(ctx, "cold", (x0 + x1) / 2, under + 1, 5, 0.18);
      return;
    }
    // A branch: the trunk to its right, a long limb, twigs, snow on top, icicles beneath.
    const tx = x1 + 3.4;
    // A thin trunk (it must not read as a wall) and a limb reaching over the track, each with a
    // pale rim so the dark wood shows against the night.
    ctx.lineCap = "round";
    for (const [col, extra] of [["rgba(160,200,240,0.5)", 0.32], ["#1c1612", 0]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7 + extra;
      ctx.beginPath();
      ctx.moveTo(tx, FH + 1);
      ctx.quadraticCurveTo(tx + 0.6, under + 6, tx - 0.4, under - 2.4);
      ctx.stroke();
      ctx.lineWidth = 0.95 + extra;
      ctx.beginPath();
      ctx.moveTo(tx - 0.2, under - 1.0);
      ctx.quadraticCurveTo(x1 - 1, under - 1.5, x0 - 3.2, under - 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#1c1612";
    ctx.lineWidth = 0.5;
    seg(ctx, x0 + 1.5, under - 0.8, x0 - 0.5, under + 0.55);
    seg(ctx, x0 - 2.4, under - 0.45, x0 - 3.6, under + 0.7);
    seg(ctx, x1 - 1, under - 1.4, x1 - 1.8, under - 3.6);
    seg(ctx, tx - 0.3, under - 2, tx - 2.2, under - 4.4);
    ctx.lineCap = "butt";
    ctx.fillStyle = SNOW;
    ctx.beginPath();
    ctx.moveTo(x0 - 3.2, under - 1.0);
    ctx.quadraticCurveTo(x1 - 1, under - 2.1, tx - 0.2, under - 1.5);
    ctx.lineTo(tx - 0.2, under - 1.2);
    ctx.quadraticCurveTo(x1 - 1, under - 1.9, x0 - 3.2, under - 0.8);
    ctx.fill();
    // Snow clumps hanging off the limb's underside, and long icicles: it hangs over the sled's head.
    for (let k = 0; k < 4; k++) {
      const t = 0.14 + k * 0.23 + rnd(i * 5 + k, 3) * 0.06;
      const px = (1 - t) * (1 - t) * (tx - 0.2) + 2 * t * (1 - t) * (x1 - 1) + t * t * (x0 - 3.2);
      const py = (1 - t) * (1 - t) * (under - 1.0) + 2 * t * (1 - t) * (under - 1.5) + t * t * (under - 0.5);
      ctx.fillStyle = SNOW;
      ellipse(ctx, px, py + 0.55, 0.85 + rnd(i * 5 + k, 4) * 0.4, 0.55);
      ctx.fill();
      ctx.fillStyle = SNOW_D;
      ellipse(ctx, px + 0.15, py + 0.8, 0.6, 0.25);
      ctx.fill();
    }
    for (let k = 0; k < 7; k++) {
      const ix = x0 - 2.7 + k * (w + 4.5) / 6;
      ctx.fillStyle = "rgba(200,236,255,0.95)";
      poly(ctx, [[ix - 0.24, under - 0.2], [ix, under + 1.0 + rnd(i * 9 + k, 2) * 1.7], [ix + 0.24, under - 0.2]]);
      ctx.fill();
    }
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(clock / 400 + i);
    halo(ctx, "cold", (x0 + x1) / 2, under + 0.4, 4, 0.2);
    ctx.globalAlpha = 1;
  }

  // A see-through glyph over an obstacle: a pair of chevrons and (for the first few) the word.
  function glyph(ctx, v, t) {
    const up = t.answer === "JUMP";
    const col = ANSWER_COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const bob = Math.sin(v.clock / 260 + t.lead) * 0.35 * (up ? -1 : 1);
    const cy = Math.min(FH - 7, FH - t.up) + bob;
    // Words on the far side from the obstacle, the arrow toward it (JUMP: arrow over the word).
    const ay = cy + (up ? -2.6 : 2.6);
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dir = up ? -1 : 1;
    for (const [pass, w, c] of [[0, 1.3, "rgba(4,8,22,0.8)"], [1, 0.6, col]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      for (let k = 0; k < 2; k++) {
        const oy = ay + (k - 0.5) * 1.5 * dir - dir * 0.2;
        if (k === 1 && pass === 1) ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA * 0.55;
        ctx.beginPath();
        ctx.moveTo(t.x - 1.7, oy - dir * 0.9);
        ctx.lineTo(t.x, oy + dir * 0.9);
        ctx.lineTo(t.x + 1.7, oy - dir * 0.9);
        ctx.stroke();
      }
      ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    }
    if (t.words) label(ctx, t.answer, t.x, cy + (up ? 1.2 : -1.2), 2.3, col, "center");
    ctx.restore();
  }

  function front(ctx, v) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.sled;
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 8;
    const hi = cam + FW + 8;
    if (!c.done) lid(ctx, v, R, c);
    R.lows.forEach(([x0, x1, y, kind], i) => {
      if (x1 >= lo && x0 <= hi) low(ctx, v, x0, x1, y, kind, i, R);
    });
    // What to do about what is coming, over it.
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Splinters of ice from a broken icicle or hand, tumbling.
    const bits = v.fx && v.fx.sledBits;
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
    // Streaks of wind-blown flakes racing past in front, faster with the sled.
    if (!c.done) flakes(ctx, v, cam, c, 1);
  }

  const dim = () => 0;

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.sled;
    if (!R || !c) return;
    const you = round.you;
    const clock = v.clock;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    // A pool of lantern light on the lid.
    add(you.x + 3, you.y + 2.2, 10, 0.6);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 1.1, (heightAt(R, x) ?? 10) + 4.5, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.hands.forEach(([x], i) => {
      const h = c.hands[i];
      if (x > lo && x < hi && (h.state === "up" || h.state === "warn")) add(x, (heightAt(R, x) ?? 10) + 2, 5, 0.3);
    });
    R.pops.forEach(([x], i) => {
      if (x > lo && x < hi && c.pops[i].state === "up") add(x, (heightAt(R, x) ?? 10) + 3, 4, 0.3);
    });
    R.icicles.forEach(([x], i) => {
      if (x > lo && x < hi && !c.icicles[i]) add(x, (heightAt(R, x) ?? 10) + 4, 4, 0.25);
    });
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 > lo && x0 < hi) add((x0 + x1) / 2, y + 1, 6, 0.3 * (0.85 + 0.15 * Math.sin(clock / 200 + i)));
    });
    if (R.finish > lo - 14 && R.finish < hi) add(R.finish + 19, 17, 14, 0.6);
    if (v.fx && v.fx.sledLand && v.fx.clock - v.fx.sledLand.t0 < 260) add(you.x, you.y + 1, 6, 0.4);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Ice and wood flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.sledBits = (fx.sledBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.sledBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The warnings repeat as the sled passes; keep them from stacking.
    if (e.type === "sledDuck" && !gateOnce(fx, "sledDuckMs", 160)) return true;
    say(tone, voice[0], voice[1], 0.5);
    switch (e.type) {
      case "sledJump":
        burst(e.x, e.y, SNOW, 5, 7, 300);
        break;
      case "sledLand":
        fx.sledLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, SNOW, e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(200, 0.5);
        break;
      case "sledLaunch":
        burst(e.x, e.y, SNOW, 12, 14, 380);
        float(e.x, e.y + 5, e.last ? "Jump!" : "Whee!", GOLD, 2.2);
        break;
      case "sledCrash":
        shake(320, 1);
        flash("#cfe6ff", 200);
        burst(e.x, e.y + 1, e.what === "stone" ? STONE_C : SNOW, 18, 17, 520);
        burst(e.x, e.y + 1, "#9fd0ff", 8, 14, 360);
        break;
      case "sledCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "sledFinish":
        shake(260, 0.7);
        burst(e.x, e.y, SNOW, e.big ? 22 : 14, 13, 560);
        float(e.x, e.y + 5, "Made it!", GOLD, 2.6);
        break;
      case "sledHandWarn":
        burst(e.x, e.y + 0.5, SNOW, 5, 4, 460);
        break;
      case "sledHandUp":
        burst(e.x, e.y + 1, SNOW, 8, 8, 360);
        break;
      case "sledHandHit":
        burst(e.x, e.y, "#a8c8e6", 5, 9, 280);
        break;
      case "sledHandBreak":
        burst(e.x, e.y, "#a8c8e6", 14, 14, 480);
        splinter(fx, e.x, e.y, ["#cfe6ff", "#a8c8e6"]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "sledPopUp":
        burst(e.x, e.y + 0.5, SNOW, 6, 6, 400);
        break;
      case "sledPopHit":
        burst(e.x, e.y, "#9fb4a8", 14, 14, 480);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "sledIcicle":
        burst(e.x, e.y, "#cfe6ff", 12, 13, 460);
        splinter(fx, e.x, e.y, ["#e8f6ff", "#bfe2ff", "#ffffff"]);
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
