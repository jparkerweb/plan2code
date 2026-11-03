// Plan2Code Web Console - Ghoul Rush's Runaway Cart, its drawing: a mine cart ride over a bottomless chasm (think of the chase in Temple of Doom): deep parallax cave walls, hanging chains and lanterns, timber trestles, ragged track ends, the riveted cart, beams, rubble, crates, slides, the boulder, the ledge imps and what the room's events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and
// LOSE_SOUNDS are plain data (the voices borrow older tones until the room's
// own sounds are picked); cartArt(d) takes ghoul-draw.js's own drawing helpers
// (`d`) and hands back the drawing by kind, so this file never reaches back
// into it. Drawn in room units, the way ghoul-draw.js draws: y counted down
// from the field's top, so a world height `y` is drawn at `FIELD_H - y`. The
// still layers' pit is black under the whole ride, so the cave, the track and
// what stands on it are drawn by `moving` (every frame, over the cached still
// layers): parallax tiles and track chunks are cached in offscreen canvases of
// this file's own (no random numbers: everything comes from a hash). The cart,
// the boulder, the beams, flying splinters and the speed streaks are drawn by
// `front` (over Planny); once the cart has stopped it is drawn by `moving`, so
// Planny walks out past it. What the art reads off the rules (ghoul-cart.js):
//
// - the room: `spec.ride` ({ track: lines of [x, y] points, beams [x0, x1, y]
//   (the underside's height, the lintel runs up to the roof), rubble [x, line],
//   crates [x, line], checks (x positions), stop (the buffer stop's x) }); the
//   cave floor is `spec.ground` (the start and the end only); a ledge imp's
//   spawn row (`spec.spawns`, ["ledgeimp", x, y]) gets a rock pillar to perch on.
// - `round.cart` (null in any other room): `v` (speed across, 14 to 46), `line`
//   (the track line under the cart, -1 in the air), `check` (the last checkpoint
//   passed, -1 for none), `boulder` (its x; it is as high as the track under it),
//   `rumble` (0 to 1, how close it is), `brake` (left held), `crates` (hp left
//   of each crate, 0 is broken), `slides` ({ x, y, warn (ms of dust left),
//   down }), `done` (the cart has stopped at the buffer).
// - Planny: `you.state` ("run" on the track, "air"), `you.vy` (tilts the cart in
//   the air), `you.ducking`, `you.x`, `you.y`; the cart's slope under it is read
//   off `spec.ride.track`; `round.input.right` leans it forward.
// - a ledge imp: `m.act` ("perch" on its ledge, "crouch", "leap", "fall"), `m.dir`,
//   `m.stole` (holds a spark).
// - events leave short-lived bits in the view's `fx` (`cartBits`, `cartPours`,
//   `cartLand`, `cartStop`) for the art to draw.

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "cart", custom: true, noMoon: true, pit: "#010101", ...o });
export const LOOKS = freeze({
  cart: pit({ wallTop: "#0b0806", wallLow: "#2a1e14", paper: "#382a1c", wainscot: "#4a3420", floorTop: "#6a5a46", floor: "#2e251c", floorEdge: "#0c0907", shelf: "#4a3220", shelfTop: "#8a6a44", window: "#e0a050", decor: "timber", color: "#e8a850", dark: 0.8 }),
});

// How each new kind sounds, by act: the cart's own, and the ledge imp's (all
// borrowed from older tones until the sounds are picked).
export const VOICES = freeze({
  cart: freeze({ jump: "ghoulFlap", land: "ghoulRockLand", launch: "ghoulGargoyleDive", brake: "ghoulSizzle", duck: "ghoulStep", crash: "ghoulCrack", stop: "ghoulRockBounce", check: "ghoulKey" }),
  crate: freeze({ hit: "ghoulBoneDrop", break: "ghoulGlass" }),
  boulder: freeze({ near: "ghoulRockFall" }),
  slide: freeze({ warn: "ghoulRockWarn", fall: "ghoulRockFall" }),
  ledgeimp: freeze({ appear: "ghoulImpAppear", leap: "ghoulHoundLunge", hurt: "ghoulImpHurt", die: "ghoulImpDie" }),
});

// What each of the pack's events plays: [kind, act], once. A hit, a kill and a
// spawn are the game's own (they carry their kind); a ledge imp's theft is the
// Mine's `impSteal`.
export const EVENT_VOICE = freeze({
  cartJump: ["cart", "jump"],
  cartLand: ["cart", "land"],
  cartLaunch: ["cart", "launch"],
  cartBrake: ["cart", "brake"],
  cartDuck: ["cart", "duck"],
  cartCrash: ["cart", "crash"],
  cartStop: ["cart", "stop"],
  checkpoint: ["cart", "check"],
  crateHit: ["crate", "hit"],
  crateBreak: ["crate", "break"],
  boulderNear: ["boulder", "near"],
  boulderSurge: ["boulder", "near"],
  slideWarn: ["slide", "warn"],
  slideFall: ["slide", "fall"],
  ledgeLeap: ["ledgeimp", "leap"],
});
export const LOSE_WORDS = freeze({ beam: "Ducked too late", crash: "Wrecked", boulder: "Flattened", derail: "Off the rails" });
export const LOSE_SOUNDS = freeze({
  beam: ["clank", 0.5, 0.8],
  crash: ["smash", 0.6, 0.7],
  boulder: ["smash", 0.7, 0.4],
  derail: ["ghoulPitFall", 0.55, 0.9],
});

const DUST = "#8a7a68";
const FW = 96;
const CH = 48;
const SEAM = 0.5;
const TIE_GAP = 1.6;
const TRESTLE_GAP = 12;
const LAMP_GAP = 38;
const CART_W = 2.6;
const BOULDER_R = 6;
const BUFFER_GAP = 3;
const CART_V = 40;
const WHEEL_R = 0.72;
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
const grad = (c, make, stops) => {
  const g = make ? make() : null;
  if (!g || typeof g.addColorStop !== "function") return stops[stops.length >> 1][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
const vgrad = (c, y0, y1, stops) => grad(c, c.createLinearGradient && (() => c.createLinearGradient(0, y0, 0, y1)), stops);
const hgrad = (c, x0, x1, stops) => grad(c, c.createLinearGradient && (() => c.createLinearGradient(x0, 0, x1, 0)), stops);
const rgrad = (c, x, y, r, stops) => grad(c, c.createRadialGradient && (() => c.createRadialGradient(x, y, 0, x, y, r)), stops);

// A timber shade, from the lit top of a trestle down to near black.
const TIM = [128, 92, 54];
const TIM_D = [18, 12, 8];
const timberAt = (f) => {
  const t = clamp(f, 0, 1);
  return `rgb(${(TIM[0] + (TIM_D[0] - TIM[0]) * t) | 0},${(TIM[1] + (TIM_D[1] - TIM[1]) * t) | 0},${(TIM[2] + (TIM_D[2] - TIM[2]) * t) | 0})`;
};

/* --------------------------------------------------- cached offscreen layers */

const layers = new Map();
let layerScale = 0;
const offscreen = (w, h) => {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width: w, height: h });
  return null;
};
// A layer of `w` by `h` units painted once by paint(c) in unit coordinates, then
// reused; null where the context cannot say its scale (the caller paints direct).
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
const HALO = freeze({ warm: "255,176,80", red: "255,70,50", green: "90,240,130", gold: "255,224,100", cold: "140,200,255", spark: "255,214,120" });
function halo(ctx, kind, x, y, r, alpha) {
  const sprite = layerFor(ctx, `halo:${kind}`, 8, 8, (g) => {
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

/* ----------------------------------------------- the parallax cave, tile by tile */

// Each tile is painted over [0, W + SEAM] and repeats every W: whatever sticks
// out of one edge is painted again a tile over, so the seams never show.
const wrap = (W, fn) => {
  fn(0);
  fn(-W);
  fn(W);
};

// The far cavern wall: fluted rock with strata, fissures, tunnel mouths with
// a far lamp in them, the dark of the drop below and a faint glow at the bottom.
const WF = 128;
function paintFar(c) {
  c.fillStyle = vgrad(c, 0, FH, [[0, "#090605"], [0.2, "#1a130f"], [0.5, "#2b2018"], [0.72, "#1b1419"], [1, "#07050b"]]);
  c.fillRect(0, 0, WF + SEAM, FH);
  for (let k = 0; k < 11; k++) {
    c.strokeStyle = k % 3 ? "rgba(96,72,50,0.22)" : "rgba(160,120,80,0.14)";
    c.lineWidth = 0.16 + (k % 3) * 0.1;
    c.beginPath();
    for (let x = -4; x <= WF + SEAM + 4; x += 4) {
      const y = 3 + k * 3.7 + 1.4 * Math.sin((TAU * x * (1 + (k % 3))) / WF + k * 1.7) + 0.5 * Math.sin((TAU * x * 5) / WF + k);
      if (x < 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  wrap(WF, (dx) => {
    for (let i = 0; i < 9; i++) {
      const x = (i * WF) / 9 + rnd(i, 1) * 5 + dx;
      const w = 3 + rnd(i, 2) * 5;
      c.fillStyle = hgrad(c, x, x + w, [[0, "rgba(0,0,0,0.32)"], [0.4, "rgba(150,110,70,0.09)"], [1, "rgba(0,0,0,0.38)"]]);
      c.fillRect(x, 0, w, FH * 0.78);
    }
    c.strokeStyle = "rgba(0,0,0,0.5)";
    c.lineWidth = 0.22;
    for (let i = 0; i < 5; i++) {
      let x = (i * WF) / 5 + 6 + rnd(i, 3) * 8 + dx;
      let y = 1 + rnd(i, 4) * 6;
      c.beginPath();
      c.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        x += (rnd(i, 10 + s) - 0.5) * 2.4;
        y += 2 + rnd(i, 20 + s) * 2.2;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    for (let i = 0; i < 3; i++) {
      const x = 14 + i * 43 + rnd(i, 5) * 8 + dx;
      const yb = FH * 0.5 + rnd(i, 6) * 8;
      c.fillStyle = "#040202";
      c.beginPath();
      c.moveTo(x - 3.4, yb);
      c.lineTo(x - 3.4, yb - 4);
      c.quadraticCurveTo(x, yb - 9.5, x + 3.4, yb - 4);
      c.lineTo(x + 3.4, yb);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(150,110,70,0.3)";
      c.lineWidth = 0.2;
      c.stroke();
      c.fillStyle = rgrad(c, x, yb - 1.5, 3.6, [[0, "rgba(255,170,70,0.55)"], [1, "rgba(255,150,50,0)"]]);
      c.fillRect(x - 3.6, yb - 5, 7.2, 7);
      c.fillStyle = "#ffcf80";
      disc(c, x, yb - 1.5, 0.22);
    }
  });
  c.fillStyle = vgrad(c, FH * 0.55, FH, [[0, "rgba(5,3,9,0)"], [1, "rgba(5,3,9,0.93)"]]);
  c.fillRect(0, FH * 0.55, WF + SEAM, FH * 0.45);
  c.fillStyle = vgrad(c, FH - 11, FH, [[0, "rgba(190,70,20,0)"], [1, "rgba(210,86,26,0.4)"]]);
  c.fillRect(0, FH - 11, WF + SEAM, 11);
  for (let i = 0; i < 26; i++) {
    c.fillStyle = `rgba(255,${120 + ((rnd(i, 7) * 80) | 0)},60,${0.35 + rnd(i, 8) * 0.4})`;
    disc(c, rnd(i, 9) * WF, FH - 0.4 - rnd(i, 11) * 4.5, 0.1 + rnd(i, 12) * 0.12);
  }
}

// Far lamps hung on chains in the middle layer: [x, y] in its tile.
const WM = 160;
const MID_LAMPS = freeze([[18, 21], [71, 17], [122, 24]]);
// Ore glints on the middle wall: [x, y, color].
const GLINTS = freeze([[9, 11, "#7adfff"], [30, 24, "#ffd060"], [47, 15, "#7affc8"], [66, 28, "#7adfff"], [92, 12, "#ffd060"], [109, 22, "#9aa8ff"], [133, 16, "#7affc8"], [150, 27, "#ffd060"]]);

// The middle layer: roof stalactites, hanging chains (some with a far lamp or an
// ore bucket), a far track on trestles and clusters of ore.
function paintMid(c) {
  wrap(WM, (dx) => {
    c.fillStyle = "#130d0a";
    c.beginPath();
    c.moveTo(dx - 2, -1);
    for (let x = -2; x <= WM + 2; x += 4) c.lineTo(x + dx, 2.4 + 1.3 * Math.sin((TAU * x * 3) / WM) + 0.6 * Math.sin((TAU * x * 8) / WM));
    c.lineTo(WM + dx + 2, -1);
    c.closePath();
    c.fill();
    for (let i = 0; i < 16; i++) {
      const x = i * 10 + rnd(i, 21) * 6 + dx;
      const len = (i % 4 ? 3.5 : 8) + rnd(i, 22) * 7;
      const w = 1.6 + rnd(i, 23) * 2.4;
      c.fillStyle = i % 2 ? "#17100c" : "#1c1410";
      poly(c, [[x - w / 2, 1], [x + w / 2, 1], [x + w * 0.2, len * 0.6], [x + (rnd(i, 24) - 0.5) * 0.8, len]]);
      c.fill();
      c.strokeStyle = "rgba(190,140,90,0.2)";
      c.lineWidth = 0.14;
      seg(c, x - w / 2, 1, x, len);
    }
    // The far track: a wavering rail on thin trestles, deep in the haze.
    const ty = (x) => 35 + 3.5 * Math.sin((TAU * x * 2) / WM + 0.7) + 1.8 * Math.sin((TAU * x * 5) / WM);
    c.strokeStyle = "rgba(96,76,58,0.55)";
    c.lineWidth = 0.28;
    c.beginPath();
    for (let x = -4; x <= WM + 4; x += 4) (x < -3 ? c.moveTo(x + dx, ty(x)) : c.lineTo(x + dx, ty(x)));
    c.stroke();
    c.strokeStyle = "rgba(30,20,14,0.9)";
    c.lineWidth = 0.4;
    for (let x = 6; x < WM; x += 8) {
      seg(c, x + dx - 0.9, FH, x + dx, ty(x) + 0.4);
      seg(c, x + dx + 0.9, FH, x + dx, ty(x) + 0.4);
      if ((x / 8) % 2) {
        c.lineWidth = 0.2;
        seg(c, x + dx - 0.7, ty(x) + 5, x + dx + 0.7, ty(x) + 9);
        c.lineWidth = 0.4;
      }
    }
    // Chains from the roof; some end in a hook, a bucket or a lamp.
    for (let i = 0; i < 7; i++) {
      const x = 8 + i * 22 + rnd(i, 31) * 6 + dx;
      const len = 7 + rnd(i, 32) * 14;
      chain(c, x, 0, len, 0.7);
      if (i % 3 === 1) {
        c.fillStyle = "#241a14";
        poly(c, [[x - 0.9, len], [x + 0.9, len], [x + 0.6, len + 1.6], [x - 0.6, len + 1.6]]);
        c.fill();
      } else {
        c.strokeStyle = "#2a2018";
        c.lineWidth = 0.18;
        c.beginPath();
        c.arc(x, len + 0.5, 0.5, 0, Math.PI);
        c.stroke();
      }
    }
    for (const [lx, ly] of MID_LAMPS) {
      const x = lx + dx;
      chain(c, x, 0, ly - 0.8, 0.8);
      c.fillStyle = rgrad(c, x, ly, 6, [[0, "rgba(255,170,70,0.5)"], [0.4, "rgba(255,150,50,0.18)"], [1, "rgba(255,130,40,0)"]]);
      c.fillRect(x - 6, ly - 6, 12, 12);
      c.fillStyle = "#2a2018";
      c.fillRect(x - 0.55, ly - 0.9, 1.1, 0.25);
      c.fillRect(x - 0.55, ly + 0.55, 1.1, 0.25);
      c.fillStyle = "#ffbf60";
      c.fillRect(x - 0.4, ly - 0.65, 0.8, 1.2);
      c.fillStyle = "#fff0c0";
      c.fillRect(x - 0.15, ly - 0.4, 0.3, 0.7);
    }
    for (const [gx, gy, col] of GLINTS) {
      c.fillStyle = col;
      c.globalAlpha = 0.55;
      for (let k = 0; k < 3; k++) {
        const px = gx + dx + (k - 1) * 0.7;
        const h = 0.9 + ((k + 1) % 3) * 0.5;
        poly(c, [[px - 0.28, gy + 0.6], [px, gy + 0.6 - h], [px + 0.28, gy + 0.6]]);
        c.fill();
      }
      c.globalAlpha = 1;
    }
  });
}

// A hanging chain of links from (x, y0) down `len`.
function chain(c, x, y0, len, w) {
  c.strokeStyle = "#2a2118";
  c.lineWidth = 0.13 * w;
  for (let y = y0, i = 0; y < y0 + len; y += 0.5, i++) {
    if (i % 2) {
      c.beginPath();
      c.ellipse ? c.ellipse(x, y + 0.25, 0.2 * w, 0.32, 0, 0, TAU) : c.arc(x, y + 0.25, 0.25 * w, 0, TAU);
      c.stroke();
    } else seg(c, x, y, x, y + 0.5);
  }
}

// Low mist over the chasm: soft pale blobs, drifting slowly.
const WMI = 96;
function paintMist(c) {
  wrap(WMI, (dx) => {
    for (let i = 0; i < 6; i++) {
      const x = i * 16 + rnd(i, 41) * 8 + dx;
      const y = FH - 4.5 - rnd(i, 42) * 9;
      const rx = 12 + rnd(i, 43) * 10;
      const ry = 2.2 + rnd(i, 44) * 2.6;
      c.save();
      c.translate(x, y);
      c.scale(rx / ry, 1);
      c.fillStyle = rgrad(c, 0, 0, ry, [[0, "rgba(120,130,160,0.2)"], [1, "rgba(120,130,160,0)"]]);
      c.fillRect(-ry, -ry, ry * 2, ry * 2);
      c.restore();
    }
  });
}

// The near layer, just behind the track: a heavy roof, tall timber props with
// knee braces (one snapped), and rock spires rising out of the dark.
const WN = 192;
function paintNear(c) {
  wrap(WN, (dx) => {
    c.fillStyle = "#0c0807";
    c.beginPath();
    c.moveTo(dx - 2, -1);
    for (let x = -2; x <= WN + 2; x += 3) c.lineTo(x + dx, 3.6 + 1.6 * Math.sin((TAU * x * 4) / WN) + 0.9 * Math.sin((TAU * x * 11) / WN));
    c.lineTo(WN + dx + 2, -1);
    c.closePath();
    c.fill();
    for (let i = 0; i < 9; i++) {
      const x = i * 21.3 + rnd(i, 51) * 9 + dx;
      const len = 4 + rnd(i, 52) * 5 + (i % 3 === 0 ? 8 : 0);
      const w = 2.6 + rnd(i, 53) * 3.4;
      c.fillStyle = "#0e0908";
      poly(c, [[x - w / 2, 3], [x + w / 2, 3], [x + w * 0.22, len * 0.65], [x + (rnd(i, 54) - 0.5), len + 3]]);
      c.fill();
      c.strokeStyle = "rgba(190,140,90,0.16)";
      c.lineWidth = 0.16;
      seg(c, x - w / 2, 3.2, x, len + 2.6);
    }
    // Timber props: a post to the roof, a cap and knee braces.
    for (let i = 0; i < 4; i++) {
      const x = 17 + i * 48 + dx;
      const snapped = i === 2;
      const bot = FH;
      const top = snapped ? 19 : 3;
      c.fillStyle = hgrad(c, x - 0.9, x + 0.9, [[0, "#3a2916"], [0.3, "#2a1c0e"], [1, "#150d07"]]);
      c.fillRect(x - 0.9, top, 1.8, bot - top);
      c.strokeStyle = "rgba(0,0,0,0.4)";
      c.lineWidth = 0.1;
      for (let y = top + 3; y < bot; y += 4.5) seg(c, x - 0.8, y, x + 0.8, y + 0.4);
      if (snapped) {
        poly(c, [[x - 0.9, 19], [x - 0.2, 17.2], [x + 0.3, 18.4], [x + 0.9, 16.8], [x + 0.9, 19]]);
        c.fillStyle = "#4a351c";
        c.fill();
        c.fillStyle = "#1a1109";
        poly(c, [[x + 1.4, 3], [x + 3, 3], [x + 1.4, 12]]);
        c.fill();
        continue;
      }
      c.fillStyle = "#2e1f10";
      c.fillRect(x - 4.5, 3.4, 9, 1.2);
      c.strokeStyle = "#241709";
      c.lineWidth = 0.7;
      seg(c, x - 0.8, 12, x - 5.2, 4.6);
      seg(c, x + 0.8, 12, x + 5.2, 4.6);
      c.fillStyle = "rgba(200,170,120,0.35)";
      disc(c, x - 3.4, 4, 0.14);
      disc(c, x + 3.4, 4, 0.14);
    }
    // Rock spires at the bottom of the view, in the haze.
    for (let i = 0; i < 7; i++) {
      const x = i * 27.4 + rnd(i, 61) * 8 + dx;
      const h = 3 + rnd(i, 62) * 6;
      const w = 5 + rnd(i, 63) * 5;
      c.fillStyle = "#0a0709";
      poly(c, [[x - w / 2, FH], [x - w * 0.18, FH - h * 0.7], [x - w * 0.04, FH - h], [x + w * 0.16, FH - h * 0.6], [x + w / 2, FH]]);
      c.fill();
      c.strokeStyle = "rgba(160,110,70,0.18)";
      c.lineWidth = 0.14;
      seg(c, x - w * 0.18, FH - h * 0.7, x - w * 0.04, FH - h);
    }
  });
}

// The foreground silhouettes, racing past in front of everything: black stalactite
// tips overhead and rock teeth at the bottom edge.
const WFO = 224;
function paintFore(c) {
  wrap(WFO, (dx) => {
    c.fillStyle = "#040202";
    for (let i = 0; i < 6; i++) {
      const x = i * 37.3 + rnd(i, 71) * 10 + dx;
      const len = 3.5 + rnd(i, 72) * 5 + (i % 3 === 0 ? 3 : 0);
      const w = 4 + rnd(i, 73) * 5;
      poly(c, [[x - w / 2, -1], [x + w / 2, -1], [x + w * 0.2, len * 0.55], [x + (rnd(i, 74) - 0.5) * 0.8, len]]);
      c.fill();
    }
    c.fillRect(dx, -1, WFO, 1.6);
    for (let i = 0; i < 6; i++) {
      const x = i * 36.9 + 9 + rnd(i, 75) * 10 + dx;
      const h = 1.8 + rnd(i, 76) * 2;
      const w = 6 + rnd(i, 77) * 6;
      poly(c, [[x - w / 2, FH + 1], [x - w * 0.15, FH - h], [x + w * 0.08, FH - h * 0.7], [x + w / 2, FH + 1]]);
      c.fill();
    }
  });
}

// Draws a repeating tile layer at parallax factor `f` (1 moves with the track).
function tile(ctx, key, W, f, cam, shift, paint) {
  const ox = cam * (1 - f) + shift;
  const k0 = Math.floor((cam - ox) / W);
  const k1 = Math.floor((cam + FW - ox) / W);
  const layer = layerFor(ctx, key, W + SEAM, FH, paint);
  for (let k = k0; k <= k1; k++) {
    const x = Math.round((ox + k * W) * 8) / 8;
    if (layer) ctx.drawImage(layer, x, -0.8, W + SEAM, FH + 1.6);
    else {
      ctx.save();
      ctx.translate(x, 0);
      paint(ctx);
      ctx.restore();
    }
  }
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
const groundAt = (spec, x) => {
  for (const [a, b, top] of spec.ground) if (x >= a - 0.4 && x <= b + 0.4) return top;
  return null;
};

// A timber bent: two splayed posts, ties, X braces and bolts, darker the deeper it goes.
function trestle(c, x, y, floor, seed, ladder) {
  const top = FH - y + 1.7;
  const bottom = floor === null ? FH + 3 : FH - floor;
  const depth = bottom - top;
  if (depth < 2.5) return;
  const bays = Math.max(1, Math.round(depth / 5.5));
  const bh = depth / bays;
  const spread = Math.min(2.6, depth * 0.07);
  const px = (i, s) => x + s * (1.45 + (spread * i) / bays);
  for (let i = 0; i < bays; i++) {
    const y0 = top + i * bh;
    const y1 = y0 + bh;
    const f0 = (y0 - top) / 30;
    const f1 = (y1 - top) / 30;
    c.lineCap = "butt";
    c.strokeStyle = timberAt(f1);
    c.lineWidth = 0.34;
    if (rnd(seed, i * 2) > 0.1) seg(c, px(i, -1), y0, px(i + 1, 1), y1);
    if (rnd(seed, i * 2 + 1) > 0.1) seg(c, px(i, 1), y0, px(i + 1, -1), y1);
    c.lineWidth = 0.46;
    seg(c, px(i + 1, -1) - 0.2, y1, px(i + 1, 1) + 0.2, y1);
    c.lineWidth = 0.76;
    c.strokeStyle = timberAt(f0 * 0.6 + f1 * 0.4);
    seg(c, px(i, -1), y0, px(i + 1, -1), y1);
    seg(c, px(i, 1), y0, px(i + 1, 1), y1);
    c.strokeStyle = `rgba(255,205,140,${0.28 * Math.max(0, 1 - f0 * 1.4)})`;
    c.lineWidth = 0.1;
    seg(c, px(i, -1) - 0.28, y0, px(i + 1, -1) - 0.28, y1);
    c.fillStyle = `rgba(210,200,180,${0.5 * Math.max(0, 1 - f1 * 1.5)})`;
    disc(c, px(i + 1, -1), y1, 0.13);
    disc(c, px(i + 1, 1), y1, 0.13);
  }
  if (ladder) {
    c.strokeStyle = timberAt(0.35);
    c.lineWidth = 0.14;
    seg(c, x - 0.45, top, x - 0.45, Math.min(bottom, top + 22));
    seg(c, x + 0.45, top, x + 0.45, Math.min(bottom, top + 22));
    for (let y = top + 0.8; y < Math.min(bottom, top + 22); y += 0.9) seg(c, x - 0.45, y, x + 0.45, y);
  }
  c.fillStyle = timberAt(0.02);
  c.fillRect(x - 3.1, top - 0.35, 6.2, 0.8);
  c.fillStyle = "rgba(255,210,150,0.3)";
  c.fillRect(x - 3.1, top - 0.35, 6.2, 0.12);
}

// A rock pillar to carry a ledge imp's perch: strata, a flat top, wearing away into the dark.
function pillar(c, x, y, seed) {
  const top = FH - y;
  const n = 9;
  const hw = (i, side) => {
    const f = i / n;
    const base = 3.5 - 1.4 * Math.sin(Math.min(1, f * 1.5) * Math.PI * 0.5) + 3.4 * Math.pow(Math.max(0, f - 0.55) / 0.45, 2);
    return base + (rnd(seed + side, i) - 0.5) * 0.9;
  };
  const span = FH + 1 - top;
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const yy = top + 0.5 + (span * i) / n;
    left.push([x - hw(i, 1), yy]);
    right.push([x + hw(i, 2), yy]);
  }
  c.fillStyle = vgrad(c, top, FH, [[0, "#41332a"], [0.3, "#2a1f19"], [1, "#07050a"]]);
  poly(c, [[x - 3.9, top - 0.1], [x + 3.9, top - 0.1], [x + 3.9, top + 0.9], ...right, ...left.slice().reverse(), [x - 3.9, top + 0.9]]);
  c.fill();
  // The lit left side and the strata.
  c.fillStyle = "rgba(190,140,90,0.1)";
  poly(c, [[x - 3.9, top], [x - 1.2, top], ...left.map(([lx, ly]) => [lx + 1.8, ly]).slice(0, 6), ...left.slice(0, 6).reverse()]);
  c.fill();
  c.strokeStyle = "rgba(150,110,74,0.28)";
  c.lineWidth = 0.15;
  for (let i = 0; i < 9; i++) {
    const yy = top + 1.8 + i * 2.4;
    const k = Math.min(n, Math.max(0, Math.round(((yy - top) / span) * n)));
    c.beginPath();
    c.moveTo(left[k][0] + 0.2, yy + rnd(seed, i));
    c.lineTo(x, yy + 0.4 + rnd(seed, i + 9) * 0.6);
    c.lineTo(right[k][0] - 0.2, yy + 0.2 + rnd(seed, i + 19) * 0.8);
    c.stroke();
  }
  c.strokeStyle = "rgba(0,0,0,0.5)";
  c.lineWidth = 0.18;
  seg(c, x + 0.6, top + 1.4, x + 0.1, top + 5);
  seg(c, x + 0.1, top + 5, x + 0.9, top + 8.2);
  // The flat lip the imp perches on, with a few loose stones and a rusted spike.
  c.fillStyle = "#5a4634";
  c.fillRect(x - 3.9, top - 0.2, 7.8, 0.5);
  c.fillStyle = "rgba(255,210,150,0.3)";
  c.fillRect(x - 3.9, top - 0.2, 7.8, 0.13);
  c.fillStyle = "#4a3a2c";
  disc(c, x + 2.7, top - 0.35, 0.28);
  disc(c, x + 2.3, top - 0.25, 0.2);
  c.strokeStyle = "#5a3a22";
  c.lineWidth = 0.18;
  seg(c, x - 3.1, top + 0.3, x - 3.4, top + 2.6);
}

// A heap of rubble `w` wide and `h` high, standing on `base` (drawn y), built up by `grow` (0 to 1).
function rocks(c, x, base, w, h, seed, grow = 1) {
  const U = [-0.95, 0.9, -0.6, 0.55, -0.3, 0.3, -0.05, 0.12, -0.18];
  c.lineJoin = "round";
  c.fillStyle = "rgba(0,0,0,0.35)";
  c.beginPath();
  if (c.ellipse) c.ellipse(x, base + 0.05, w * 0.55, 0.28, 0, 0, TAU);
  else c.arc(x, base, 0.3, 0, TAU);
  c.fill();
  for (let i = 0; i < U.length; i++) {
    if (i / U.length > grow) break;
    const u = U[i];
    const px = x + u * w * 0.4;
    const hh = h * (0.3 + 0.62 * (1 - Math.abs(u) * 0.8)) * (0.75 + 0.45 * rnd(seed, i)) * (0.45 + 0.55 * grow);
    const rw = hh * (0.62 + 0.55 * rnd(seed, i + 20));
    const cy = base - hh * 0.5;
    const pts = [];
    for (let j = 0; j < 6; j++) {
      const a = (j / 6) * TAU + rnd(seed, i * 7 + j) * 0.5;
      pts.push([px + Math.cos(a) * rw * (0.75 + 0.4 * rnd(seed, i * 9 + j)), Math.min(base, cy + Math.sin(a) * hh * 0.5 * (0.8 + 0.4 * rnd(seed, i * 5 + j)))]);
    }
    c.fillStyle = ["#5a5046", "#4a4036", "#6a5e50"][(i + seed) % 3];
    poly(c, pts);
    c.fill();
    c.strokeStyle = "#1c1410";
    c.lineWidth = 0.1;
    c.stroke();
    c.strokeStyle = "rgba(190,170,140,0.5)";
    c.lineWidth = 0.1;
    const top = pts.reduce((m, p) => (p[1] < m[1] ? p : m), pts[0]);
    seg(c, top[0] - rw * 0.4, top[1] + hh * 0.12, top[0] + rw * 0.1, top[1]);
  }
  c.fillStyle = "#4a4036";
  for (let i = 0; i < 4; i++) disc(c, x + (rnd(seed, 90 + i) - 0.5) * (w + 1.6), base - 0.08, 0.1 + rnd(seed, 94 + i) * 0.12);
  c.lineJoin = "miter";
}

// One line of track: a timber stringer, ties, a far and a near rail, joint plates, hazard paint on a ramp.
function laySteel(c, pts, xa, xb, ragged0, ragged1, ramp) {
  const x0 = pts[0][0];
  const x1 = pts[pts.length - 1][0];
  const lo = Math.max(xa, x0);
  const hi = Math.min(xb, x1);
  if (hi <= lo) return;
  const path = (dy, fn) => {
    c.beginPath();
    let first = true;
    const at = (x) => {
      const px = clamp(x, lo, hi);
      if (first) c.moveTo(px, FH - yOn(pts, px) + dy);
      else c.lineTo(px, FH - yOn(pts, px) + dy);
      first = false;
    };
    at(lo);
    for (const [px] of pts) if (px > lo && px < hi) at(px);
    at(hi);
    fn();
  };
  c.lineJoin = "round";
  // The stringer under the ties.
  c.strokeStyle = "#2c1d10";
  c.lineWidth = 1.1;
  path(1.4, () => c.stroke());
  c.strokeStyle = "#4a3018";
  c.lineWidth = 0.13;
  path(0.9, () => c.stroke());
  c.strokeStyle = "#120b06";
  c.lineWidth = 0.18;
  path(1.95, () => c.stroke());
  // Ties, end on.
  for (let i = 0; i + 1 < pts.length; i++) {
    const [xs, ys] = pts[i];
    const [xe, ye] = pts[i + 1];
    const a = Math.max(xs, lo);
    const b = Math.min(xe, hi);
    if (b <= a) continue;
    const s = (ye - ys) / (xe - xs);
    const L = Math.hypot(1, s);
    const ux = 1 / L;
    const uy = -s / L;
    const nx = s / L;
    const ny = 1 / L;
    for (let x = Math.ceil(a / TIE_GAP) * TIE_GAP; x <= b; x += TIE_GAP) {
      if (ragged0 && x < x0 + 0.5) continue;
      const idx = Math.round(x / TIE_GAP);
      const px = x;
      const py = FH - (ys + s * (x - xs));
      const hw = 0.3 + 0.05 * rnd(idx, 3);
      const d0 = 0.15;
      const d1 = 0.85 + 0.08 * rnd(idx, 5);
      const hazard = ramp && x > x1 - 12;
      c.fillStyle = hazard ? (idx % 2 ? "#e8b020" : "#241a10") : idx % 3 ? "#5a3e22" : "#4a3219";
      poly(c, [[px - ux * hw + nx * d0, py - uy * hw + ny * d0], [px + ux * hw + nx * d0, py + uy * hw + ny * d0], [px + ux * hw + nx * d1, py + uy * hw + ny * d1], [px - ux * hw + nx * d1, py - uy * hw + ny * d1]]);
      c.fill();
      c.fillStyle = "rgba(255,210,150,0.28)";
      poly(c, [[px - ux * hw + nx * d0, py - uy * hw + ny * d0], [px + ux * hw + nx * d0, py + uy * hw + ny * d0], [px + ux * hw + nx * (d0 + 0.1), py + uy * hw + ny * (d0 + 0.1)], [px - ux * hw + nx * (d0 + 0.1), py - uy * hw + ny * (d0 + 0.1)]]);
      c.fill();
    }
  }
  // The far rail, then the near rail with its bright head.
  c.strokeStyle = "#26262e";
  c.lineWidth = 0.18;
  path(-0.3, () => c.stroke());
  c.strokeStyle = "#51515d";
  c.lineWidth = 0.26;
  path(0.13, () => c.stroke());
  c.strokeStyle = "#cdcdda";
  c.lineWidth = 0.1;
  path(0.03, () => c.stroke());
  // Joint plates every so often.
  c.fillStyle = "#8a8a98";
  for (let x = Math.ceil(lo / 9) * 9; x < hi - 1; x += 9) {
    const y = FH - yOn(pts, x);
    c.fillRect(x - 0.28, y - 0.02, 0.56, 0.3);
    c.fillStyle = "#1c1c22";
    disc(c, x - 0.12, y + 0.14, 0.04);
    disc(c, x + 0.12, y + 0.14, 0.04);
    c.fillStyle = "#8a8a98";
  }
  // Ragged ends over the gaps: a splintered stringer, bent rails, a dangling tie.
  const end = (x, dir) => {
    const y = FH - yOn(pts, x);
    const seed = Math.round(x);
    if (x < xa - 8 || x > xb + 8) return;
    c.fillStyle = "#2c1d10";
    poly(c, [[x, y + 0.85], [x + dir * (0.7 + rnd(seed, 1)), y + 1.2], [x + dir * 0.35, y + 1.7], [x + dir * (1.2 + rnd(seed, 2)), y + 2.0], [x, y + 1.95]]);
    c.fill();
    c.strokeStyle = "#51515d";
    c.lineWidth = 0.26;
    c.beginPath();
    c.moveTo(x, y + 0.13);
    c.lineTo(x + dir * 0.8, y + 0.2);
    c.quadraticCurveTo(x + dir * 1.9, y + 0.35, x + dir * 2.1, y + 2.1);
    c.stroke();
    c.strokeStyle = "#26262e";
    c.lineWidth = 0.18;
    c.beginPath();
    c.moveTo(x, y - 0.3);
    c.lineTo(x + dir * 1.2, y - 0.2);
    c.quadraticCurveTo(x + dir * 2.0, y - 0.05, x + dir * 1.6, y + 1.5);
    c.stroke();
    c.save();
    c.translate(x + dir * 0.1, y + 0.2);
    c.rotate(dir * 0.28);
    c.fillStyle = "#4a3219";
    c.fillRect(-0.3, 0, 0.6, 1.7);
    c.fillStyle = "#3a2612";
    c.fillRect(-0.3, 1.2, 0.6, 0.5);
    c.strokeStyle = "#8a8a98";
    c.lineWidth = 0.1;
    seg(c, 0, -0.1, 0, 0.35);
    c.restore();
  };
  if (ragged0) end(x0, -1);
  if (ragged1) end(x1, 1);
  c.lineJoin = "miter";
}

// A signal post at a checkpoint (the lamp itself is drawn each frame).
function signalPost(c, x, y) {
  const base = FH - y;
  c.fillStyle = "#3a2814";
  c.fillRect(x - 0.22, base - 4.6, 0.44, 4.6);
  c.fillStyle = "rgba(255,210,150,0.25)";
  c.fillRect(x - 0.22, base - 4.6, 0.1, 4.6);
  c.strokeStyle = "#2c1d10";
  c.lineWidth = 0.22;
  seg(c, x, base - 1.4, x - 1.2, base - 0.1);
  seg(c, x, base - 1.4, x + 1.2, base - 0.1);
  c.fillStyle = "#2a2a32";
  c.fillRect(x - 0.85, base - 6.6, 1.7, 2.1);
  c.fillStyle = "#4a4a56";
  c.fillRect(x - 0.85, base - 6.6, 1.7, 0.25);
  c.fillRect(x - 1.0, base - 4.7, 2.0, 0.28);
  c.fillStyle = "#08060a";
  disc(c, x, base - 5.55, 0.62);
}

// The buffer stop: a heavy timber block bound in iron with a striped bumper and two buffers.
function bufferStop(c, x, y) {
  const base = FH - y;
  const face = x + BUFFER_GAP;
  c.fillStyle = "#2c1d10";
  c.fillRect(face, base - 3.2, 4.8, 3.6);
  for (let i = 0; i < 3; i++) {
    c.fillStyle = i % 2 ? "#6a4a2a" : "#5a3e22";
    c.fillRect(face, base - 3.2 + i * 1.05, 4.8, 1.0);
    c.fillStyle = "rgba(255,210,150,0.25)";
    c.fillRect(face, base - 3.2 + i * 1.05, 4.8, 0.1);
    c.fillStyle = "#14100c";
    disc(c, face + 0.6, base - 2.7 + i * 1.05, 0.1);
    disc(c, face + 4.2, base - 2.7 + i * 1.05, 0.1);
  }
  c.fillStyle = "#32323a";
  c.fillRect(face + 0.4, base - 3.3, 0.5, 3.4);
  c.fillRect(face + 3.9, base - 3.3, 0.5, 3.4);
  // Bumper plate with hazard stripes, and two buffer cylinders.
  c.fillStyle = "#3a3a44";
  c.fillRect(face - 0.55, base - 2.9, 0.6, 2.6);
  for (let i = 0; i < 5; i++) {
    c.fillStyle = i % 2 ? "#e8b020" : "#241a10";
    c.fillRect(face - 0.55, base - 2.9 + i * 0.52, 0.6, 0.52);
  }
  for (const by of [1.0, 2.1]) {
    c.fillStyle = "#4a4a56";
    c.fillRect(face - 1.5, base - by - 0.18, 1.0, 0.36);
    c.fillStyle = "#8a8a98";
    c.fillRect(face - 1.5, base - by - 0.18, 1.0, 0.08);
    c.fillStyle = "#5a5a66";
    c.fillRect(face - 1.75, base - by - 0.38, 0.3, 0.76);
  }
  c.fillStyle = "#2a2a32";
  c.fillRect(face + 1.6, base - 4.5, 0.3, 1.3);
  c.fillStyle = "#3a1410";
  c.fillRect(face + 1.15, base - 5.3, 1.2, 0.9);
  c.fillStyle = "#ff4a30";
  c.fillRect(face + 1.3, base - 5.15, 0.9, 0.6);
}

// The start: a timber portal with a hanging lamp, a snapped brake lever, barrels.
function station(c, y) {
  const base = FH - y;
  c.fillStyle = hgrad(c, 23.2, 24.8, [[0, "#4a3418"], [0.5, "#32220f"], [1, "#1a1108"]]);
  c.fillRect(23.2, 0, 1.6, base);
  c.fillStyle = "#3a2814";
  c.fillRect(19, 6.8, 11, 1.4);
  c.fillStyle = "rgba(255,210,150,0.25)";
  c.fillRect(19, 6.8, 11, 0.12);
  c.strokeStyle = "#2c1d10";
  c.lineWidth = 0.7;
  seg(c, 23.4, 14, 19.4, 8.2);
  seg(c, 24.6, 14, 28.6, 8.2);
  chain(c, 21, 8.2, 3.4, 0.9);
  // A brake lever on its stand, snapped off short.
  c.fillStyle = "#2c2c34";
  c.fillRect(1.2, base - 0.5, 3.4, 0.5);
  c.fillRect(2.4, base - 4, 1.0, 3.6);
  c.fillStyle = "#4a4a56";
  c.fillRect(2.4, base - 4, 0.2, 3.6);
  c.strokeStyle = "#5a5a66";
  c.lineWidth = 0.4;
  seg(c, 2.9, base - 3.7, 3.7, base - 5.2);
  c.fillStyle = "#5a5a66";
  poly(c, [[3.5, base - 5.2], [4.1, base - 5.3], [3.9, base - 4.8], [4.3, base - 4.6], [3.7, base - 4.5]]);
  c.fill();
  c.strokeStyle = "#3a3a42";
  c.lineWidth = 0.14;
  c.beginPath();
  c.moveTo(3.2, base - 3.5);
  c.quadraticCurveTo(5.4, base - 2.4, 4.4, base - 0.5);
  c.stroke();
  // Barrels.
  for (const [bx, bw] of [[27.8, 1.6], [29.4, 1.4]]) {
    c.fillStyle = "#4a3219";
    c.fillRect(bx - bw / 2, base - 2.3, bw, 2.3);
    c.fillStyle = "#26262e";
    c.fillRect(bx - bw / 2, base - 1.9, bw, 0.18);
    c.fillRect(bx - bw / 2, base - 0.7, bw, 0.18);
    c.fillStyle = "rgba(255,210,150,0.2)";
    c.fillRect(bx - bw / 2, base - 2.3, 0.15, 2.3);
  }
}

// The cave floor's crumbling lip where it meets the chasm.
function cliff(c, x, top, dir) {
  const y = FH - top;
  c.fillStyle = "#2e251c";
  poly(c, [[x, y], [x + dir * 0.9, y + 1.2], [x + dir * 0.3, y + 2.6], [x + dir * 1.4, y + 4.4], [x + dir * 0.4, y + 6.8], [x + dir * 1.0, y + 9.4], [x, y + 11]]);
  c.fill();
  c.strokeStyle = "rgba(190,150,100,0.3)";
  c.lineWidth = 0.14;
  c.beginPath();
  c.moveTo(x, y);
  c.lineTo(x + dir * 0.9, y + 1.2);
  c.lineTo(x + dir * 0.3, y + 2.6);
  c.stroke();
  c.fillStyle = "#3a2e22";
  disc(c, x + dir * 1.2, y + 3.3, 0.35);
  disc(c, x + dir * 0.8, y + 8.0, 0.28);
}

// A fork sign: a post on the lower line and two painted arrows.
function forkSign(c, x, y) {
  const base = FH - y;
  c.fillStyle = "#3a2814";
  c.fillRect(x - 0.2, base - 8.2, 0.4, 8.2);
  c.fillStyle = "#6a4a2a";
  c.fillRect(x - 3, base - 11, 6, 3.6);
  c.strokeStyle = "#1c1209";
  c.lineWidth = 0.14;
  c.strokeRect(x - 3, base - 11, 6, 3.6);
  c.fillStyle = "#e8b020";
  poly(c, [[x - 2.1, base - 9.2], [x - 1.1, base - 10.5], [x - 0.1, base - 9.2], [x - 0.8, base - 9.2], [x - 0.8, base - 8.7], [x - 1.4, base - 8.7], [x - 1.4, base - 9.2]]);
  c.fill();
  poly(c, [[x + 0.1, base - 9.8], [x + 1.1, base - 8.6], [x + 2.1, base - 9.8], [x + 1.4, base - 9.8], [x + 1.4, base - 10.4], [x + 0.8, base - 10.4], [x + 0.8, base - 9.8]]);
  c.fill();
}

// Everything that stands still along the track between xa and xb.
function paintTrack(c, R, spec, xa, xb) {
  for (const [a, b, top] of spec.ground) {
    if (a > 0.5 && a >= xa - 4 && a <= xb + 4) cliff(c, a, top, -1);
    if (b < spec.length - 0.5 && b >= xa - 4 && b <= xb + 4) cliff(c, b, top, 1);
  }
  if (xa < 36) station(c, groundAt(spec, 20) ?? 18);
  for (const s of spec.spawns) if (s[0] === "ledgeimp" && s[1] > xa - 8 && s[1] < xb + 8) pillar(c, s[1], s[2], Math.round(s[1]));
  const lines = R.track.map((pts) => {
    const last = pts[pts.length - 1];
    if (last[0] >= R.stop - 0.5) return pts.concat([[R.stop + BUFFER_GAP + 0.4, last[1]]]);
    return pts;
  });
  lines.forEach((pts, li) => {
    const x0 = pts[0][0];
    const x1 = pts[pts.length - 1][0];
    for (let x = Math.ceil(Math.max(xa, x0 + 2.5) / TRESTLE_GAP) * TRESTLE_GAP; x <= Math.min(xb, x1 - 2.5); x += TRESTLE_GAP) {
      const idx = Math.round(x / TRESTLE_GAP);
      trestle(c, x, yOn(pts, x), groundAt(spec, x), idx * 7 + li, rnd(idx, li + 3) < 0.25);
    }
  });
  lines.forEach((pts, li) => {
    const x0 = pts[0][0];
    const x1 = pts[pts.length - 1][0];
    const n = pts.length;
    const rampEnd = n > 1 && (pts[n - 1][1] - pts[n - 2][1]) / (pts[n - 1][0] - pts[n - 2][0]) >= 0.2;
    laySteel(c, pts, xa, xb, groundAt(spec, x0) === null, groundAt(spec, x1) === null && x1 < R.stop - 0.5, rampEnd);
    // A fork: a line that starts over another one gets a sign on the lower line.
    if (x0 >= xa - 6 && x0 <= xb + 6) {
      const below = R.track.findIndex((o, oi) => oi !== li && o[0][0] < x0 - 14 && o[o.length - 1][0] > x0);
      if (below >= 0) forkSign(c, x0 - 18, yOn(R.track[below], x0 - 18));
    }
  });
  R.checks.forEach((x) => {
    if (x >= xa - 3 && x <= xb + 3) signalPost(c, x, heightAt(R, x) ?? 10);
  });
  if (R.stop >= xa - 12 && R.stop <= xb + 12) bufferStop(c, R.stop, heightAt(R, R.stop - 0.5) ?? 8.6);
  R.rubble.forEach(([x, li], i) => {
    if (x >= xa - 3 && x <= xb + 3) rocks(c, x, FH - yOn(R.track[li], x), 3.4, 1.8, i + 1);
  });
}

/* -------------------------------------------------- the boulder, as sprites */

function paintBoulder(c, r) {
  c.save();
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.clip();
  c.fillStyle = "#4a3f35";
  c.fillRect(-r, -r, r * 2, r * 2);
  // Strata bands, arcs across the ball.
  for (let k = 0; k < 7; k++) {
    c.strokeStyle = k % 2 ? "rgba(20,12,8,0.4)" : "rgba(150,120,90,0.22)";
    c.lineWidth = 0.18 + (k % 3) * 0.12;
    c.beginPath();
    c.moveTo(-r, -r * 0.8 + k * r * 0.27);
    c.quadraticCurveTo(0, -r * 0.8 + k * r * 0.27 + (k % 2 ? 1.3 : -1.1), r, -r * 0.8 + k * r * 0.27 + 0.4);
    c.stroke();
  }
  // Craters, with a dark floor and a lit rim.
  for (let i = 0; i < 8; i++) {
    const a = rnd(i, 101) * TAU;
    const d = Math.sqrt(rnd(i, 102)) * r * 0.85;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    const cr = 0.5 + rnd(i, 103) * 0.9;
    c.fillStyle = "rgba(14,9,6,0.55)";
    disc(c, x, y, cr);
    c.strokeStyle = "rgba(190,160,120,0.35)";
    c.lineWidth = 0.14;
    c.beginPath();
    c.arc(x, y, cr, Math.PI * 0.9, Math.PI * 1.9);
    c.stroke();
  }
  // Cracks.
  c.strokeStyle = "rgba(8,5,3,0.75)";
  c.lineWidth = 0.18;
  for (let i = 0; i < 4; i++) {
    let x = (rnd(i, 111) - 0.5) * r * 1.5;
    let y = (rnd(i, 112) - 0.5) * r * 1.5;
    c.beginPath();
    c.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (rnd(i, 120 + s) - 0.5) * 1.6;
      y += (rnd(i, 130 + s) - 0.5) * 1.6;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // Ore glints in the rock.
  for (let i = 0; i < 7; i++) {
    const a = rnd(i, 141) * TAU;
    const d = Math.sqrt(rnd(i, 142)) * r * 0.8;
    c.fillStyle = i % 2 ? "#7adfff" : "#ffd060";
    c.globalAlpha = 0.7;
    const x = Math.cos(a) * d;
    const y = Math.sin(a) * d;
    poly(c, [[x - 0.2, y + 0.2], [x, y - 0.35], [x + 0.2, y + 0.2]]);
    c.fill();
  }
  c.globalAlpha = 1;
  c.restore();
  c.strokeStyle = "#140d08";
  c.lineWidth = 0.35;
  c.beginPath();
  c.arc(0, 0, r - 0.1, 0, TAU);
  c.stroke();
}
// The light and shade over the ball, which does not turn with it.
function paintShade(c, r) {
  c.fillStyle = rgrad(c, -r * 0.3, -r * 0.35, r * 1.5, [[0, "rgba(255,220,170,0.26)"], [0.4, "rgba(0,0,0,0)"], [0.75, "rgba(0,0,0,0.38)"], [1, "rgba(0,0,0,0.7)"]]);
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();
}

/* ------------------------------------------------------------ cart art */

export function cartArt(d) {
  const { ellipse, circle, line, say, GOLD, DANGER, FLASH, EYE_AMBER } = d;
  const ride = (v) => (v.spec && v.spec.ride) || null;

  /* ------------------------------------------------------------- the room */

  // The still layers only get a plain wall: the cave itself is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The cave floor at the start and the end: gravel, strata and ballast under the ties.
  function ground(ctx, v, look, a, b, top) {
    const y = v.g.FIELD_H - top;
    ctx.fillStyle = "#1e1812";
    ctx.fillRect(a, y + 1.1, b - a, top);
    for (let x = Math.ceil(a / 0.8) * 0.8; x < b; x += 0.8) {
      const i = Math.round(x / 0.8);
      ctx.fillStyle = rnd(i, 1) > 0.5 ? "#7a6a56" : "#4a3e30";
      ctx.fillRect(x, y + 0.1 + rnd(i, 2) * 0.6, 0.3 + rnd(i, 3) * 0.3, 0.18);
    }
    ctx.strokeStyle = "rgba(120,92,64,0.22)";
    ctx.lineWidth = 0.14;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      for (let x = a; x <= b; x += 3) ctx.lineTo(x, y + 2.4 + k * 2.6 + Math.sin(x * 0.2 + k) * 0.5);
      ctx.stroke();
    }
  }
  function shelf() {}

  // Clips out the cave floor, so the cave behind the ride never paints over it.
  function clipOutGround(ctx, v, cam) {
    if (typeof ctx.clip !== "function") return;
    ctx.beginPath();
    ctx.rect(cam - 2, -2, FW + 4, FH + 4);
    for (const [a, b, top] of v.spec.ground) if (b > cam - 2 && a < cam + FW + 2) ctx.rect(a, FH - top, b - a, top + 2);
    ctx.clip("evenodd");
  }

  // Walks the hanging lamps in view: cb(x, y) with y a world height.
  function eachLamp(v, R, lo, hi, cb) {
    for (let i = Math.ceil((lo - 24) / LAMP_GAP); 24 + i * LAMP_GAP <= hi; i++) {
      const x = 24 + i * LAMP_GAP;
      if (x > R.stop || R.beams.some(([a, b]) => x > a - 8 && x < b + 8) || v.spec.spawns.some((s) => s[0] === "ledgeimp" && Math.abs(s[1] - x) < 7)) continue;
      cb(x, clamp((heightAt(R, x) ?? 20) + 11, 16, 46));
    }
  }

  function lamp(ctx, v, x, y, i) {
    const clock = v.clock;
    const rum = (v.round.cart && v.round.cart.rumble) || 0;
    const sway = 0.05 * Math.sin(clock / 640 + x) + rum * 0.1 * Math.sin(clock / 53 + x);
    const top = 0;
    const len = FH - y - 0.9;
    ctx.save();
    ctx.translate(x, top);
    ctx.rotate(sway);
    chain(ctx, 0, 0, len, 1);
    ctx.translate(0, len);
    const fl = 0.85 + 0.15 * Math.sin(clock / 90 + i * 2);
    halo(ctx, "warm", 0, 0.8, 6.5, 0.55 * fl);
    ctx.fillStyle = "#2a2018";
    ctx.fillRect(-0.6, -0.1, 1.2, 0.3);
    ctx.fillRect(-0.45, -0.35, 0.9, 0.25);
    ctx.fillRect(-0.6, 1.5, 1.2, 0.3);
    ctx.strokeStyle = "#2a2018";
    ctx.lineWidth = 0.1;
    seg(ctx, -0.5, 0.2, -0.5, 1.6);
    seg(ctx, 0.5, 0.2, 0.5, 1.6);
    ctx.fillStyle = "#ffb84a";
    ctx.fillRect(-0.4, 0.25, 0.8, 1.25);
    ctx.fillStyle = `rgba(255,244,196,${fl})`;
    ctx.fillRect(-0.18, 0.5, 0.36, 0.7);
    ctx.restore();
  }

  /* ---------------------------------------------------- crates, slides, dust */

  function crate(ctx, x, base, hp) {
    const w = 3;
    const h = 3.2;
    const x0 = x - w / 2;
    const y0 = base - h;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x0 - 0.1, base - 0.1, w + 0.2, 0.25);
    ctx.fillStyle = "#8a6438";
    ctx.fillRect(x0, y0, w, h);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? "#946c3c" : "#7e5a32";
      ctx.fillRect(x0 + 0.25 + i * 0.63, y0 + 0.25, 0.6, h - 0.5);
      ctx.fillStyle = "rgba(40,24,10,0.45)";
      ctx.fillRect(x0 + 0.25 + i * 0.63 + 0.57, y0 + 0.25, 0.05, h - 0.5);
    }
    ctx.strokeStyle = "#4a2e14";
    ctx.lineWidth = 0.34;
    seg(ctx, x0 + 0.3, y0 + h - 0.3, x0 + w - 0.3, y0 + 0.3);
    ctx.strokeStyle = "rgba(255,210,150,0.2)";
    ctx.lineWidth = 0.08;
    seg(ctx, x0 + 0.3, y0 + h - 0.45, x0 + w - 0.3, y0 + 0.15);
    // The frame and the iron bands.
    ctx.strokeStyle = "#4a2e14";
    ctx.lineWidth = 0.3;
    ctx.strokeRect(x0 + 0.15, y0 + 0.15, w - 0.3, h - 0.3);
    ctx.fillStyle = "#34343c";
    for (const by of [y0 + 0.15, y0 + h - 0.75]) {
      ctx.fillRect(x0 + 0.05, by, w - 0.1, 0.6);
      ctx.fillStyle = "#54545e";
      ctx.fillRect(x0 + 0.05, by, w - 0.1, 0.1);
      ctx.fillStyle = "#14141a";
      for (const bx of [0.35, w - 0.35]) disc(ctx, x0 + bx, by + 0.32, 0.07);
      ctx.fillStyle = "#34343c";
    }
    // A stencil mark.
    ctx.strokeStyle = "#1c1209";
    ctx.lineWidth = 0.14;
    seg(ctx, x - 0.4, y0 + 1.2, x + 0.4, y0 + 2.0);
    seg(ctx, x + 0.4, y0 + 1.2, x - 0.4, y0 + 2.0);
    if (hp < 2) {
      // One shot: a crack, a loose plank, splinters sticking out.
      ctx.fillStyle = "#0e0804";
      poly(ctx, [[x0 + 1.9, y0 + 0.3], [x0 + 2.4, y0 + 0.3], [x0 + 2.2, y0 + 1.4], [x0 + 2.6, y0 + 2.1], [x0 + 1.9, y0 + 2.6], [x0 + 2.1, y0 + 1.4]]);
      ctx.fill();
      ctx.strokeStyle = "#0e0804";
      ctx.lineWidth = 0.12;
      seg(ctx, x0 + 0.8, y0 + 1.0, x0 + 1.6, y0 + 1.6);
      seg(ctx, x0 + 1.6, y0 + 1.6, x0 + 1.3, y0 + 2.5);
      ctx.fillStyle = "#b08a52";
      poly(ctx, [[x0 + 2.4, y0 + 0.3], [x0 + 3.2, y0 - 0.5], [x0 + 3.0, y0 + 0.2], [x0 + 2.7, y0 + 0.6]]);
      ctx.fill();
      poly(ctx, [[x0 + 2.6, y0 + 2.1], [x0 + 3.4, y0 + 2.5], [x0 + 2.8, y0 + 2.5]]);
      ctx.fill();
    }
  }

  // What is left of a broken crate: a few planks lying on the rails.
  function wreck(ctx, x, base, i) {
    ctx.fillStyle = "#6a4a28";
    for (let k = 0; k < 4; k++) {
      const px = x + (k - 1.5) * 0.85 + (rnd(i, k) - 0.5) * 0.4;
      ctx.save();
      ctx.translate(px, base - 0.12);
      ctx.rotate((rnd(i, k + 5) - 0.5) * 0.8);
      ctx.fillRect(-0.7, -0.14, 1.4, 0.28);
      ctx.restore();
    }
  }

  // Dust trickling from a crack in the roof, then the slide itself pouring down.
  function slideDust(ctx, v, s, base) {
    const clock = v.clock;
    const left = clamp(s.warn / 900, 0, 1);
    const k = 1 - left;
    ctx.fillStyle = "rgba(10,6,4,0.7)";
    poly(ctx, [[s.x - 1.6, 0], [s.x + 1.8, 0], [s.x + 0.6, 1.2], [s.x - 0.1, 2.3], [s.x - 0.7, 1.1]]);
    ctx.fill();
    for (let n = 0; n < 9 + ((k * 14) | 0); n++) {
      const p = ((clock / (520 - 220 * k) + n * 0.097) % 1);
      const x = s.x + (rnd(n, 1) - 0.5) * 3.4 * (0.6 + p * 0.5);
      ctx.fillStyle = n % 2 ? "rgba(150,128,100,0.75)" : "rgba(104,88,70,0.8)";
      ctx.fillRect(x, 1.5 + p * (base - 1.8), 0.14 + rnd(n, 2) * 0.12, 0.3 + rnd(n, 3) * 0.3);
    }
    ctx.fillStyle = `rgba(140,120,96,${0.04 + 0.1 * k})`;
    ctx.beginPath();
    ctx.moveTo(s.x - 0.5, 1);
    ctx.lineTo(s.x + 0.5, 1);
    ctx.lineTo(s.x + 2.2, base);
    ctx.lineTo(s.x - 2.2, base);
    ctx.closePath();
    ctx.fill();
    // Pebbles hopping on the rails where it will land.
    ctx.fillStyle = "#6a5e50";
    for (let n = 0; n < 3; n++) {
      const p = ((clock / 260 + n * 0.37) % 1);
      disc(ctx, s.x + (rnd(n, 5) - 0.5) * 3, base - Math.sin(p * Math.PI) * 0.9 * k - 0.1, 0.13);
    }
  }
  function pour(ctx, v, x, base, age) {
    const f = clamp(age / 800, 0, 1);
    for (let n = 0; n < 11; n++) {
      const p = ((age / 420 + n * 0.091) % 1);
      if (age > 700 && p > 0.7) continue;
      const rx = x + (rnd(n, 1) - 0.5) * 3.2;
      ctx.fillStyle = n % 2 ? "#6a5e50" : "#4a4036";
      const rs = 0.2 + rnd(n, 2) * 0.35;
      ctx.fillRect(rx - rs / 2, p * (base - 0.5) - rs, rs, rs);
    }
    ctx.fillStyle = `rgba(150,128,100,${0.12 * (1 - f)})`;
    ctx.fillRect(x - 1.8, 0, 3.6, base);
  }

  /* ---------------------------------------------- the track, every frame */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.cart;
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const clock = v.clock;
    const rum = c.rumble || 0;
    // The cave: parallax tiles, shaking a little as the boulder nears.
    ctx.save();
    clipOutGround(ctx, v, cam);
    const jy = rum > 0.05 ? (Math.sin(clock / 41) * 0.5 + Math.sin(clock / 17) * 0.3) * rum * 0.5 : 0;
    ctx.translate(0, jy);
    tile(ctx, "cart:far", WF, 0.16, cam, 0, paintFar);
    tile(ctx, "cart:mid", WM, 0.4, cam, 0, paintMid);
    // Ore glints twinkle on the middle wall.
    for (let k = Math.floor((cam - cam * 0.6) / WM) - 1; k <= Math.floor((cam + FW - cam * 0.6) / WM); k++) {
      GLINTS.forEach(([gx, gy], gi) => {
        const x = cam * 0.6 + k * WM + gx;
        if (x < cam - 2 || x > cam + FW + 2) return;
        const tw = Math.sin(clock / 260 + gi * 2.1 + k);
        if (tw < 0.55) return;
        ctx.strokeStyle = `rgba(255,248,220,${(tw - 0.55) * 1.6})`;
        ctx.lineWidth = 0.12;
        seg(ctx, x - 0.8, gy, x + 0.8, gy);
        seg(ctx, x, gy - 0.8, x, gy + 0.8);
      });
    }
    tile(ctx, "cart:mist", WMI, 0.55, cam, clock * 0.0035, paintMist);
    tile(ctx, "cart:near", WN, 0.8, cam, 0, paintNear);
    ctx.restore();
    // Dust shaken from the roof while the boulder is close.
    if (rum > 0.3) {
      for (let n = 0; n < 9; n++) {
        const p = ((clock / 700 + n * 0.113) % 1);
        ctx.fillStyle = n % 2 ? "rgba(120,100,80,0.8)" : "rgba(80,66,52,0.9)";
        const px = cam + rnd(n, Math.floor(clock / 700) + 3) * FW;
        ctx.fillRect(px, 2 + p * 40, 0.16 + rnd(n, 5) * 0.12, 0.3 + rnd(n, 6) * 0.4);
      }
    }
    // The track, in cached chunks.
    const k0 = Math.max(0, Math.floor(cam / CH));
    const k1 = Math.floor((cam + FW) / CH);
    for (let k = k0; k <= k1; k++) {
      const layer = layerFor(ctx, `cart:track:${k}`, CH + SEAM, FH, (g) => {
        g.translate(-k * CH, 0);
        paintTrack(g, R, v.spec, k * CH - 6, k * CH + CH + SEAM + 6);
      });
      if (layer) ctx.drawImage(layer, k * CH, 0, CH + SEAM, FH);
      else if (k === k0) paintTrack(ctx, R, v.spec, cam - 6, cam + FW + 6);
    }
    // Lamps hung from the roof.
    eachLamp(v, R, cam - 4, cam + FW + 4, (x, y) => lamp(ctx, v, x, y, Math.round(x)));
    // Signal lamps at the checkpoints: red until passed, then green.
    R.checks.forEach((x, i) => {
      if (x < cam - 4 || x > cam + FW + 4) return;
      const y = FH - ((heightAt(R, x) ?? 10) + 5.55);
      const on = i <= c.check;
      const pulse = on ? 1 : 0.7 + 0.3 * Math.sin(clock / 160);
      halo(ctx, on ? "green" : "red", x, y, on ? 4.2 : 3.6, 0.7 * pulse);
      ctx.fillStyle = on ? "#7dffa0" : "#ff5a40";
      disc(ctx, x, y, 0.5);
      ctx.fillStyle = on ? "#eaffee" : "#ffc0a0";
      disc(ctx, x - 0.12, y - 0.14, 0.17);
    });
    // Crates, whole or splintered, and the slides.
    R.crates.forEach(([x, li], i) => {
      if (x < cam - 4 || x > cam + FW + 4) return;
      const base = FH - yOn(R.track[li], x);
      if (c.crates[i] > 0) crate(ctx, x, base, c.crates[i]);
      else wreck(ctx, x, base, i);
    });
    const pours = v.fx && v.fx.cartPours;
    for (const s of c.slides) {
      if (s.x < cam - 4 || s.x > cam + FW + 4) continue;
      const base = FH - s.y;
      if (s.down) {
        let age = 1e9;
        if (pours) for (const p of pours) if (Math.abs(p.x - s.x) < 2) age = Math.min(age, v.fx.clock - p.t0);
        if (age < 800) pour(ctx, v, s.x, base, age);
        rocks(ctx, s.x, base, 3.4, 1.8, 40 + Math.round(s.x), age < 800 ? 0.3 + 0.7 * (age / 800) : 1);
      } else slideDust(ctx, v, s, base);
    }
    // A finished ride: the cart rests at the buffer, behind Planny as he walks out.
    if (c.done) cartBody(ctx, v, R, c);
  }

  /* ------------------------------------------------------ the cart, in front */

  const SPARK = ["#fff6c0", "#ffd94a", "#ff9a30", "#e0501c"];
  // Sparks flying back off a wheel's contact at (wx, 0) in the cart's frame.
  function sparks(ctx, clock, wx, n, power) {
    ctx.lineWidth = 0.15;
    for (let k = 0; k < n; k++) {
      const p = ((clock / (150 + (k % 4) * 30) + k * 0.137) % 1);
      const sx = wx - p * (1.6 + (k % 5) * 0.7) * power - 0.2;
      const sy = -0.1 - (p * (2.3 + (k % 3) * 0.9) - 3.1 * p * p) * power;
      ctx.strokeStyle = SPARK[Math.min(3, (p * 4) | 0)];
      seg(ctx, sx, sy, sx + 0.7 * (1 - p), sy + 0.45 * (1 - p) * (k % 2 ? 1 : -1));
    }
  }

  function cartBody(ctx, v, R, c) {
    const { round } = v;
    const you = round.you;
    const clock = v.clock;
    const fx = v.fx;
    const done = c.done;
    const x = done ? R.stop : you.x;
    // Tilted by the slope under it (a longer look than a wheelbase, so joints do not snap), or by its flight.
    let pitch;
    let y = you.y;
    if (done || c.line >= 0) {
      const pts = R.track[done ? R.track.length - 1 : c.line];
      pitch = Math.atan2(yOn(pts, x + CART_W) - yOn(pts, x - CART_W), CART_W * 2);
      if (done) y = yOn(pts, x);
    } else pitch = clamp(you.vy / Math.max(14, c.v), -1, 1) * 0.55 + 0.04 * Math.sin(clock / 70);
    // Leaning forward when right is held, back when braking, rocked when it stops.
    const dt = clamp(clock - (fx.cartT ?? clock), 0, 100);
    fx.cartT = clock;
    const target = done ? 0 : c.brake ? -1 : round.input && round.input.right ? 1 : 0;
    fx.cartLean = (fx.cartLean ?? 0) + (target - (fx.cartLean ?? 0)) * Math.min(1, dt / 90);
    let lean = fx.cartLean;
    if (fx.cartStop !== undefined && fx.clock - fx.cartStop < 700) lean -= 1.1 * Math.max(0, 1 - (fx.clock - fx.cartStop) / 700) * Math.cos((fx.clock - fx.cartStop) / 55);
    const onRail = (done || c.line >= 0);
    const shake = onRail && !done ? Math.sin(clock / 23) * 0.035 * (c.v / CART_V) : 0;
    const spin = done ? 0 : x / WHEEL_R;
    ctx.save();
    ctx.translate(x, FH - y + shake);
    ctx.rotate(-pitch);
    // Speed streaks behind it.
    if (!done && c.v > 34) {
      ctx.strokeStyle = `rgba(255,236,200,${clamp((c.v - 34) / 24, 0, 0.35)})`;
      ctx.lineWidth = 0.1;
      for (let k = 0; k < 3; k++) seg(ctx, -3.4 - k * 0.9, -0.9 - k * 0.7, -6.6 - k * 1.6 - (c.v - 34) * 0.15, -0.9 - k * 0.7);
    }
    // The frame under the tub, and the buffers at each end.
    ctx.fillStyle = "#1c1c22";
    ctx.fillRect(-2.7, -0.62, 5.4, 0.5);
    ctx.fillStyle = "#3a3a44";
    ctx.fillRect(-2.7, -0.62, 5.4, 0.08);
    ctx.fillStyle = "#34343c";
    ctx.fillRect(2.55, -1.2, 0.8, 0.5);
    ctx.fillRect(-3.35, -1.2, 0.8, 0.5);
    ctx.fillStyle = "#6a6a76";
    ctx.fillRect(3.25, -1.28, 0.16, 0.66);
    ctx.fillRect(-3.5, -1.28, 0.16, 0.66);
    ctx.strokeStyle = "#34343c";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.arc(-3.55, -0.8, 0.32, -1.2, 1.4);
    ctx.stroke();
    // The tub, leaning from the frame: a flared iron box with ribs, rust and a riveted band.
    ctx.save();
    ctx.translate(0, -0.5);
    ctx.transform(1, 0, -0.2 * lean, 1, 0, 0);
    ctx.fillStyle = vgrad(ctx, -1.9, 0, [[0, "#7a7a8a"], [0.45, "#5a5a67"], [1, "#2e2e36"]]);
    ctx.beginPath();
    ctx.moveTo(-1.95, 0);
    ctx.quadraticCurveTo(-2.45, -1.0, -2.8, -1.9);
    ctx.lineTo(2.8, -1.9);
    ctx.quadraticCurveTo(2.45, -1.0, 1.95, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#12100e";
    ctx.lineWidth = 0.16;
    ctx.stroke();
    ctx.fillStyle = "rgba(150,80,40,0.4)";
    ellipse(ctx, -1.3, -0.45, 0.7, 0.26);
    ctx.fill();
    ellipse(ctx, 1.7, -1.4, 0.55, 0.22);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ellipse(ctx, 0.6, -0.7, 0.5, 0.3);
    ctx.fill();
    ctx.strokeStyle = "#3a3a44";
    ctx.lineWidth = 0.22;
    for (const rx of [-1.6, 0, 1.6]) seg(ctx, rx * 0.8, -0.05, rx * 1.15, -1.85);
    ctx.strokeStyle = "#a0a0b0";
    ctx.lineWidth = 0.07;
    for (const rx of [-1.6, 0, 1.6]) seg(ctx, rx * 0.8 - 0.09, -0.05, rx * 1.15 - 0.09, -1.85);
    ctx.fillStyle = "#44444e";
    ctx.fillRect(-2.6, -1.25, 5.2, 0.34);
    ctx.fillStyle = "#c8c8d4";
    for (let rx = -2.35; rx < 2.5; rx += 0.45) disc(ctx, rx, -1.08, 0.07);
    ctx.fillStyle = "#14141a";
    for (let rx = -2.35; rx < 2.5; rx += 0.45) disc(ctx, rx + 0.03, -1.05, 0.03);
    // The rolled rim.
    ctx.fillStyle = "#8c8c9c";
    ctx.fillRect(-2.98, -2.38, 5.96, 0.5);
    ctx.fillStyle = "#d0d0dc";
    ctx.fillRect(-2.98, -2.38, 5.96, 0.11);
    ctx.fillStyle = "#4a4a56";
    ctx.fillRect(-2.98, -1.96, 5.96, 0.08);
    ctx.restore();
    // Wheels, in front of the tub's foot: iron tires, a bright rim, spokes that turn with the miles.
    for (const wx of [-1.6, 1.6]) {
      ctx.fillStyle = "#14141a";
      circle(ctx, wx, -WHEEL_R, WHEEL_R);
      ctx.fill();
      ctx.fillStyle = "#505060";
      circle(ctx, wx, -WHEEL_R, WHEEL_R * 0.8);
      ctx.fill();
      ctx.strokeStyle = "#a8a8b8";
      ctx.lineWidth = 0.11;
      for (let s = 0; s < 6; s++) {
        const a = spin + (s * TAU) / 6;
        seg(ctx, wx, -WHEEL_R, wx + Math.cos(a) * WHEEL_R * 0.78, -WHEEL_R + Math.sin(a) * WHEEL_R * 0.78);
      }
      ctx.fillStyle = "#c8c8d4";
      circle(ctx, wx, -WHEEL_R, 0.16);
      ctx.fill();
      ctx.fillStyle = "#26262e";
      circle(ctx, wx + Math.cos(spin) * WHEEL_R * 0.6, -WHEEL_R + Math.sin(spin) * WHEEL_R * 0.6, 0.06);
      ctx.fill();
    }
    // The headlamp on the nose.
    ctx.fillStyle = "#6a4a1a";
    ctx.fillRect(3.0, -2.45, 0.5, 0.55);
    ctx.fillStyle = "#e8b050";
    ctx.fillRect(2.95, -3.1, 0.9, 0.66);
    ctx.fillStyle = "#fff4c8";
    ctx.fillRect(3.58, -2.95, 0.25, 0.36);
    halo(ctx, "warm", 3.9, -2.78, 3.2, 0.65);
    // Sparks from the wheels: braking, or a hard landing.
    const landAge = fx.cartLand !== undefined ? fx.clock - fx.cartLand.t0 : 1e9;
    if (!done && c.line >= 0 && c.brake && c.v > 15) for (const wx of [-1.6, 1.6]) sparks(ctx, clock, wx, 10, 1);
    else if (landAge < (fx.cartLand && fx.cartLand.big ? 420 : 160)) for (const wx of [-1.6, 1.6]) sparks(ctx, clock, wx, fx.cartLand.big ? 14 : 6, fx.cartLand.big ? 1.5 : 0.8);
    ctx.restore();
  }

  // The boulder: huge, rolling behind the cart on the track under it, grit flying.
  function boulderBall(ctx, v, R, c) {
    const { round } = v;
    const r = BOULDER_R;
    const bx = c.boulder;
    if (bx < round.camX - r - 8 || bx > round.camX + FW + r) return;
    const clock = v.clock;
    const gy = heightAt(R, bx) ?? round.you.y;
    const cy = FH - gy - r;
    const rum = c.rumble || 0;
    const wob = rum * 0.12 * Math.sin(clock / 31);
    // Dust and grit kicked up behind it.
    ctx.fillStyle = DUST;
    for (let k = 0; k < 9; k++) {
      const p = ((clock / (520 + k * 40) + k * 0.19) % 1);
      ctx.globalAlpha = (1 - p) * 0.45;
      circle(ctx, bx - r * 0.5 - p * (5 + k * 0.5), FH - gy - 0.5 - p * (1.5 + (k % 3) * 1.1), 0.5 + p * (1.3 + (k % 2) * 0.7));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The ball, turning with its roll.
    const ang = bx / r;
    const sprite = layerFor(ctx, "cart:boulder", r * 2, r * 2, (g) => {
      g.translate(r, r);
      paintBoulder(g, r);
    });
    const shade = layerFor(ctx, "cart:shade", r * 2, r * 2, (g) => {
      g.translate(r, r);
      paintShade(g, r);
    });
    ctx.save();
    ctx.translate(bx, cy + wob);
    if (sprite) {
      ctx.save();
      ctx.rotate(ang);
      ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
      ctx.restore();
      if (shade) ctx.drawImage(shade, -r, -r, r * 2, r * 2);
    } else {
      ctx.rotate(ang);
      paintBoulder(ctx, r);
    }
    ctx.restore();
    // Grit flying forward off its top, and sparks where it grinds the rails.
    ctx.fillStyle = "#6a5e50";
    for (let k = 0; k < 6; k++) {
      const p = ((clock / 430 + k * 0.167) % 1);
      circle(ctx, bx + r * 0.6 + p * (3 + k * 0.6), cy - r * 0.5 - (p * (3 + (k % 3)) - 5.5 * p * p) * 1.2, 0.14 + (k % 2) * 0.08);
      ctx.fill();
    }
    ctx.lineWidth = 0.1;
    for (let k = 0; k < 5; k++) {
      const p = ((clock / 190 + k * 0.2) % 1);
      ctx.strokeStyle = SPARK[Math.min(3, (p * 4) | 0)];
      seg(ctx, bx + 1 - p * 4, FH - gy - 0.2 - p * (1.4 + (k % 2)) * (1 - p * 0.5), bx + 1.4 - p * 4, FH - gy - 0.1 - p * (1.4 + (k % 2)) * (1 - p * 0.5));
    }
  }

  // A low beam: a stack of cribbing from the roof to a heavy lintel, hazard paint under it, a red lamp beside it.
  function beam(ctx, v, x0, x1, y, i) {
    const clock = v.clock;
    const w = x1 - x0;
    const under = FH - y;
    const top = under - 3.2;
    const xm = (x0 + x1) / 2;
    // Cribbing: rows of logs from the roof down.
    for (let r = 0, yy = 0; yy < top; r++, yy += 1.5) {
      const hh = Math.min(1.5, top - yy);
      ctx.fillStyle = r % 2 ? "#3a2814" : "#33230f";
      ctx.fillRect(x0 - 0.2, yy, w + 0.4, hh);
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x0 - 0.2, yy + hh - 0.1, w + 0.4, 0.1);
      ctx.fillStyle = "rgba(255,210,150,0.12)";
      ctx.fillRect(x0 - 0.2, yy, w + 0.4, 0.08);
      ctx.fillStyle = "#16100a";
      disc(ctx, x0 + 0.5 + (r % 2) * 0.4, yy + hh * 0.5, 0.09);
      disc(ctx, x1 - 0.5 - (r % 2) * 0.4, yy + hh * 0.5, 0.09);
    }
    // Hazard chevrons painted on the stack above the lintel.
    ctx.strokeStyle = "#e8b020";
    ctx.lineWidth = 0.34;
    ctx.lineJoin = "miter";
    for (const dy of [3.4, 5.3]) {
      ctx.beginPath();
      ctx.moveTo(xm - 1.1, top - dy - 0.7);
      ctx.lineTo(xm, top - dy + 0.2);
      ctx.lineTo(xm + 1.1, top - dy - 0.7);
      ctx.stroke();
    }
    // The lintel, end on: a squared timber with its rings, bound with iron.
    ctx.fillStyle = "#7a5530";
    ctx.fillRect(x0 - 0.6, top, w + 1.2, 3.2);
    ctx.fillStyle = "#a07844";
    ctx.fillRect(x0 - 0.6, top, w + 1.2, 0.18);
    ctx.strokeStyle = "rgba(60,36,16,0.55)";
    ctx.lineWidth = 0.1;
    for (let k = 1; k <= 3; k++) {
      ctx.strokeRect(xm - w * 0.12 * k - 0.4, top + 1.6 - 0.24 * k - 0.1, w * 0.24 * k + 0.8, 0.48 * k + 0.2);
    }
    ctx.strokeStyle = "rgba(20,10,4,0.7)";
    ctx.lineWidth = 0.1;
    seg(ctx, x0 + 0.4, top + 0.6, xm - 0.3, top + 1.5);
    seg(ctx, x1 - 0.5, top + 2.4, xm + 0.4, top + 1.7);
    ctx.fillStyle = "#32323a";
    for (const bx of [x0 - 0.1, x1 - 0.5]) {
      ctx.fillRect(bx, top - 0.1, 0.6, 3.4);
      ctx.fillStyle = "#14141a";
      disc(ctx, bx + 0.3, top + 0.5, 0.08);
      disc(ctx, bx + 0.3, top + 2.6, 0.08);
      ctx.fillStyle = "#32323a";
    }
    // Hazard stripes along its underside.
    for (let sx = x0 - 0.6, n = 0; sx < x1 + 0.6; sx += 0.9, n++) {
      ctx.fillStyle = n % 2 ? "#241a10" : "#e8b020";
      ctx.beginPath();
      ctx.moveTo(sx, under);
      ctx.lineTo(Math.min(sx + 0.9, x1 + 0.6), under);
      ctx.lineTo(Math.min(sx + 1.3, x1 + 0.6), under - 0.75);
      ctx.lineTo(sx + 0.4, under - 0.75);
      ctx.closePath();
      ctx.fill();
    }
    // A red warning lamp on a bracket, swinging.
    const sw = 0.12 * Math.sin(clock / 300 + i);
    ctx.strokeStyle = "#26262e";
    ctx.lineWidth = 0.2;
    seg(ctx, x0 - 0.6, top + 0.5, x0 - 1.5, top + 0.5);
    ctx.save();
    ctx.translate(x0 - 1.5, top + 0.5);
    ctx.rotate(sw);
    seg(ctx, 0, 0, 0, 0.7);
    halo(ctx, "red", 0, 1.3, 3.6, 0.55 + 0.3 * Math.sin(clock / 130 + i));
    ctx.fillStyle = "#2a1210";
    ctx.fillRect(-0.4, 0.65, 0.8, 1.3);
    ctx.fillStyle = "#ff4a30";
    ctx.fillRect(-0.28, 0.8, 0.56, 0.95);
    ctx.fillStyle = "#ffd0b0";
    ctx.fillRect(-0.1, 0.95, 0.2, 0.4);
    ctx.restore();
  }

  function front(ctx, v) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.cart;
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 6;
    const hi = cam + FW + 6;
    if (!c.done) cartBody(ctx, v, R, c);
    R.beams.forEach(([x0, x1, y], i) => {
      if (x1 >= lo && x0 <= hi) beam(ctx, v, x0, x1, y, i);
    });
    boulderBall(ctx, v, R, c);
    // Splinters of a broken crate, tumbling.
    const bits = v.fx && v.fx.cartBits;
    if (bits) {
      for (const b of bits) {
        const t = (v.fx.clock - b.t0) / 1000;
        if (t < 0 || t > 0.9) continue;
        ctx.save();
        ctx.translate(b.x + b.vx * t, FH - (b.y + b.vy * t - 30 * t * t));
        ctx.rotate(b.rot + b.vr * t);
        ctx.globalAlpha = clamp(1.6 - t * 1.6, 0, 1);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -0.14, b.w, 0.28);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    // Wind streaks and the foreground rock racing past.
    if (!c.done) {
      const sf = clamp((c.v - 10) / 34, 0.15, 1);
      ctx.strokeStyle = `rgba(255,236,200,${0.07 + 0.16 * sf})`;
      ctx.lineWidth = 0.08;
      for (let k = 0; k < 16; k++) {
        const x = cam + ((((k * 13.7 - cam * 1.8) % 120) + 120) % 120) - 12;
        const y = 4 + rnd(k, 1) * 40;
        seg(ctx, x, y, x + 2.5 + sf * 7 * (0.5 + rnd(k, 2)), y);
      }
    }
    tile(ctx, "cart:fore", WFO, 1.45, cam, 0, paintFore);
  }

  const dim = () => 0;

  /* ------------------------------------------------------------ the imp */

  // Runs fn(glow) in a frame at (x, y) facing `dir`, y counted up from the feet.
  function upright(ctx, v, x, y, dir, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, -1);
    fn((lx, ly, r, color) => v.eyes.push(x + dir * lx, y - ly, r, color));
    ctx.restore();
  }
  function bone(ctx, pts, w, color, out) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [lw, col] of [[w + 0.14, out], [w, color]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }
  const outlined = (ctx, pts, fill, out, lw = 0.1) => {
    poly(ctx, pts);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = lw;
    ctx.stroke();
  };

  // A ledge imp: the Knocker imp's wiry green goblin with its great ears, hooked nose and amber eyes,
  // sitting hunched on its pillar, coiled to spring, flung out at the cart with claws forward, or
  // tumbling away with the stolen spark.
  function ledgeimp(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || -1;
    const act = m.act || "perch";
    const crouch = act === "crouch";
    const leap = act === "leap";
    const fall = act === "fall";
    const skin = flash ? FLASH : "#7c9058";
    const skinD = flash ? FLASH : "#506238";
    const cloth = flash ? FLASH : "#7a4e2e";
    const clothD = flash ? FLASH : "#4a2e1c";
    const out = flash ? FLASH : "#14100a";
    upright(ctx, v, x, y, dir, (glow) => {
      // A fall tumbles the whole imp about its middle.
      if (fall) {
        ctx.translate(0, 1.1);
        ctx.rotate(-t / 130);
        ctx.translate(0, -1.1);
      }
      const shiver = crouch ? Math.sin(t / 34) * 0.05 : 0;
      const hipY = (crouch ? 0.62 : leap ? 1.15 : fall ? 1.0 : 0.95 + Math.sin(t / 260) * 0.03) + shiver;
      const lean = crouch ? 0.62 : leap ? 1.15 : fall ? 0.2 : 0.12 + Math.sin(t / 700) * 0.04;
      // Speed streaks and a trail behind a leaper.
      if (leap && !flash) {
        ctx.strokeStyle = "rgba(220,200,160,0.45)";
        ctx.lineWidth = 0.1;
        for (let k = 0; k < 4; k++) line(ctx, -1.2 - k * 0.4, 0.3 + k * 0.55, -3.0 - k * 0.8, 0.3 + k * 0.55);
      }
      // Legs: folded under a crouch, trailing in a leap, kicking in a fall, standing otherwise.
      for (let i = 0; i < 2; i++) {
        const col = i ? skin : skinD;
        let knee;
        let foot;
        if (crouch) {
          knee = [0.55 - i * 0.2, 0.72];
          foot = [0.25 + i * 0.28, 0.1];
        } else if (leap) {
          knee = [-0.45 - i * 0.15, hipY - 0.45];
          foot = [-1.25 - i * 0.35, hipY - 0.85 - i * 0.2];
        } else if (fall) {
          const a = t / 70 + i * Math.PI;
          knee = [0.2 + Math.sin(a) * 0.5, hipY - 0.55];
          foot = [Math.sin(a + 1) * 0.9, hipY - 1.0 + Math.cos(a) * 0.3];
        } else {
          knee = [0.28 + i * 0.05, hipY * 0.5];
          foot = [0.1 + i * 0.22, 0.12];
        }
        bone(ctx, [[-0.05 + i * 0.1, hipY - 0.1], knee, foot], 0.3, col, out);
        ctx.fillStyle = col;
        poly(ctx, [[foot[0] - 0.2, foot[1] + 0.2], [foot[0] + 0.7, foot[1] + 0.15], [foot[0] + 0.75, foot[1]], [foot[0] - 0.2, foot[1]]]);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(-lean);
      const tp = (px, py) => [px * Math.cos(lean) + py * Math.sin(lean), -px * Math.sin(lean) + py * Math.cos(lean) + hipY];
      const gl = (px, py, r, col) => {
        const [gx, gy] = tp(px, py);
        glow(gx, gy, r, col);
      };
      // A ragged tunic over a bent back, and the far arm.
      outlined(ctx, [[-0.55, 0.1], [-0.7, 0.9], [-0.2, 1.3], [0.45, 1.15], [0.6, 0.15], [0.35, -0.05], [0.1, 0.15], [-0.15, -0.1]], cloth, out);
      ctx.fillStyle = clothD;
      ctx.fillRect(-0.62, 0.55, 1.2, 0.14);
      ctx.fillStyle = skinD;
      ellipse(ctx, -0.4, 0.95, 0.35, 0.3);
      ctx.fill();
      const flail = fall ? Math.sin(t / 60) * 0.7 : 0;
      if (leap) bone(ctx, [[0.0, 1.0], [0.7, 1.35], [1.5, 1.6]], 0.24, skinD, out);
      else if (crouch) bone(ctx, [[0.0, 1.0], [-0.5, 0.75], [-0.85, 0.35]], 0.24, skinD, out);
      else bone(ctx, [[0.0, 1.0], [-0.35, 0.55], [-0.5 + flail * 0.4, 0.2 + flail * 0.3]], 0.24, skinD, out);
      // The head: big, bald, the ears swept back (flapping in the wind of a leap), a hooked nose.
      const hx = 0.5;
      const hy = 1.52;
      const flap = leap || fall ? Math.sin(t / 45) * 0.28 : Math.sin(t / 400) * 0.05;
      const back = crouch ? 0.3 : 0;
      outlined(ctx, [[hx - 0.2, hy + 0.35], [hx - 1.5 - back, hy + 0.95 + flap], [hx - 1.15, hy + 0.35], [hx - 0.1, hy - 0.2]], skinD, out);
      outlined(ctx, [[hx + 0.05, hy + 0.5], [hx - 1.0, hy + 1.35 + flap], [hx - 1.85 - back, hy + 0.95 + flap * 1.4], [hx - 0.95, hy + 0.55], [hx - 0.2, hy + 0.1]], skin, out);
      ctx.fillStyle = flash ? FLASH : "#c88a7a";
      poly(ctx, [[hx - 0.2, hy + 0.5], [hx - 0.95, hy + 1.1 + flap], [hx - 1.45, hy + 0.9 + flap], [hx - 0.8, hy + 0.55]]);
      ctx.fill();
      ctx.fillStyle = skin;
      circle(ctx, hx, hy, 0.66);
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.1;
      ctx.stroke();
      outlined(ctx, [[hx + 0.55, hy + 0.1], [hx + 1.3, hy - 0.35], [hx + 0.95, hy - 0.08], [hx + 0.6, hy - 0.2]], skin, out, 0.08);
      // The mouth: a grin, wider before the jump, a shout in the air.
      if (leap || fall) {
        ctx.fillStyle = flash ? FLASH : "#1c0a08";
        ellipse(ctx, hx + 0.55, hy - 0.42, 0.3, 0.26);
        ctx.fill();
        ctx.fillStyle = flash ? FLASH : "#f2ecd8";
        ctx.fillRect(hx + 0.4, hy - 0.62, 0.09, 0.14);
        ctx.fillRect(hx + 0.6, hy - 0.62, 0.09, 0.14);
      } else {
        const grin = crouch ? 0.3 : 0.1;
        ctx.strokeStyle = out;
        ctx.lineWidth = 0.09;
        ctx.beginPath();
        ctx.moveTo(hx + 0.2, hy - 0.4);
        ctx.quadraticCurveTo(hx + 0.55, hy - 0.62 - grin, hx + 0.9, hy - 0.32);
        ctx.stroke();
        ctx.fillStyle = flash ? FLASH : "#f2ecd8";
        for (const tx of [0.34, 0.52, 0.7]) ctx.fillRect(hx + tx - 0.04, hy - 0.52 - grin * 0.4, 0.09, 0.16);
      }
      // Eyes burning over the dark: slits when it coils.
      const er = crouch ? 0.11 : 0.16;
      ctx.fillStyle = flash ? FLASH : "#ffc040";
      ellipse(ctx, hx + 0.38, hy + 0.12, 0.2, er);
      ctx.fill();
      ellipse(ctx, hx + 0.02, hy + 0.1, 0.17, er * 0.9);
      ctx.fill();
      ctx.fillStyle = out;
      ctx.fillRect(hx + 0.4, hy + 0.04, 0.08, 0.2);
      ctx.fillRect(hx + 0.04, hy + 0.03, 0.07, 0.18);
      gl(hx + 0.38, hy + 0.12, crouch ? 0.34 : 0.2, EYE_AMBER);
      gl(hx + 0.02, hy + 0.1, crouch ? 0.3 : 0.16, EYE_AMBER);
      // The near arm: a pick on the pillar, hooked claws forward in a leap, the cupped spark when it has stolen the light.
      const sh = [0.3, 1.0];
      if (m.stole) {
        const cup = [1.0, 0.85];
        bone(ctx, [sh, [0.7, 0.6], cup], 0.25, skin, out);
        bone(ctx, [[0.05, 0.95], [0.55, 0.55], [cup[0] - 0.1, cup[1] - 0.1]], 0.22, skinD, out);
        const pulse = 0.85 + 0.15 * Math.sin(t / 70);
        ctx.fillStyle = "rgba(255, 230, 120, 0.3)";
        circle(ctx, cup[0], cup[1] + 0.2, 0.62 * pulse);
        ctx.fill();
        ctx.fillStyle = "#fff6b0";
        circle(ctx, cup[0], cup[1] + 0.2, 0.26);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 244, 170, 0.8)";
        ctx.lineWidth = 0.07;
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + t / 300;
          line(ctx, cup[0] + Math.cos(a) * 0.38, cup[1] + 0.2 + Math.sin(a) * 0.38, cup[0] + Math.cos(a) * 0.62, cup[1] + 0.2 + Math.sin(a) * 0.62);
        }
        gl(cup[0], cup[1] + 0.2, 0.34, "#fff0a0");
        ctx.fillStyle = skin;
        circle(ctx, cup[0] + 0.05, cup[1] - 0.12, 0.2);
        ctx.fill();
      } else if (leap) {
        bone(ctx, [sh, [1.0, 1.55], [1.9, 1.85]], 0.25, skin, out);
        ctx.strokeStyle = flash ? FLASH : "#e8e0c8";
        ctx.lineWidth = 0.08;
        for (let k = -1; k <= 1; k++) line(ctx, 1.9, 1.85, 2.4, 1.85 + k * 0.28);
      } else if (crouch) {
        bone(ctx, [sh, [-0.1, 0.65], [-0.55, 0.2]], 0.25, skin, out);
      } else if (fall) {
        bone(ctx, [sh, [0.6 - flail * 0.3, 1.5], [1.0 + flail * 0.2, 2.0 + flail * 0.4]], 0.25, skin, out);
      } else {
        // A little pick held at the hip.
        const hand = [0.75, 0.6];
        bone(ctx, [sh, [0.7, 0.8], hand], 0.25, skin, out);
        bone(ctx, [[hand[0] - 0.1, hand[1] - 0.2], [hand[0] + 0.6, hand[1] + 0.6]], 0.12, flash ? FLASH : "#7a5630", out);
        ctx.fillStyle = flash ? FLASH : "#9a9aa8";
        poly(ctx, [[hand[0] + 0.3, hand[1] + 0.95], [hand[0] + 0.95, hand[1] + 0.8], [hand[0] + 0.7, hand[1] + 0.5]]);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.cart;
    if (!R || !c) return;
    const you = round.you;
    const clock = v.clock;
    // The cart's headlamp ahead of it, sparks under it, a pool of its own.
    add(you.x + 6, you.y + 2.5, 16, 0.8);
    if (c.brake && c.line >= 0 && c.v > 15) add(you.x, you.y + 0.4, 4.5, 0.5);
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    eachLamp(v, R, lo, hi, (x, y) => add(x, y - 0.8, 15, 0.72 * (0.93 + 0.07 * Math.sin(clock / 90 + x))));
    // Far lamps in the middle layer.
    const f = 0.4;
    for (let k = Math.floor(((round.camX * (1 - f)) * -1 + round.camX) / WM) - 1; k <= Math.floor((round.camX + FW - round.camX * (1 - f)) / WM); k++) {
      for (const [lx, ly] of MID_LAMPS) {
        const x = round.camX * (1 - f) + k * WM + lx;
        if (x > round.camX - 4 && x < round.camX + FW + 4) add(x, FH - ly, 9, 0.5);
      }
    }
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x, (heightAt(R, x) ?? 10) + 5.5, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.beams.forEach(([x0, x1, y], i) => {
      if (x1 > lo && x0 < hi) add(x0 - 1.5, y + 2.2, 7, 0.55 * (0.8 + 0.2 * Math.sin(clock / 130 + i)));
    });
    if (R.stop > lo && R.stop < hi) add(R.stop + BUFFER_GAP + 2.4, (heightAt(R, R.stop - 0.5) ?? 8.6) + 5, 8, 0.5);
    // The boulder shows a little, so it can be seen coming.
    add(c.boulder, (heightAt(R, c.boulder) ?? you.y) + 5, 9, 0.38);
    for (const m of round.monsters) {
      if (m.dead) continue;
      if (m.kind === "ledgeimp") add(m.x, m.y + 1.5, m.stole ? 4.5 : 3.5, m.stole ? 0.55 : 0.35);
    }
    for (const s of c.slides) if (!s.down) add(s.x, s.y + 3, 5, 0.3);
    if (v.fx && v.fx.cartLand && v.fx.clock - v.fx.cartLand.t0 < 260) add(you.x, you.y + 1, 6, 0.5);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Splinters of a crate, thrown out of its middle.
  function splinter(fx, x, y) {
    fx.cartBits = (fx.cartBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.cartBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 16, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.7 + rnd(k, 5) * 1.0, c: k % 3 ? "#8a6438" : "#b08a52" });
  }

  // What the pack's events look and sound like; true when the event is its own.
  // Each of its sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, banner, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The boulder's rumble gets louder, and the view shakes harder, as it comes.
    if (e.type === "boulderNear") {
      if (gateOnce(fx, "rumbleMs", 300)) {
        const lv = e.level || 0;
        say(tone, voice[0], voice[1], 0.25 + 0.5 * lv);
        shake(480, 0.25 + 0.9 * lv);
        burst(e.x - 8, e.y + 6, DUST, 2 + ((lv * 6) | 0), 4, 500);
      }
      return true;
    }
    say(tone, voice[0], voice[1], 0.5);
    switch (e.type) {
      case "cartJump":
        burst(e.x, e.y, DUST, 4, 6, 300);
        break;
      case "cartLand":
        fx.cartLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, "#ffd94a", e.big ? 14 : 5, e.big ? 12 : 8, 340);
        burst(e.x, e.y, DUST, e.big ? 8 : 3, 6, 400);
        if (e.big) shake(220, 0.6);
        break;
      case "cartLaunch":
        burst(e.x, e.y, "#ffd94a", 10, 14, 380);
        float(e.x, e.y + 5, "Launch!", GOLD, 2.2);
        break;
      case "cartBrake":
        burst(e.x - 2, e.y, "#ffd94a", 6, 9, 280);
        break;
      case "cartCrash":
        shake(320, 1);
        flash("#ffb050", 200);
        burst(e.x, e.y + 1, e.what === "crate" ? "#8a6a3a" : DUST, 18, 17, 520);
        burst(e.x, e.y + 1, "#ffd94a", 8, 14, 360);
        break;
      case "checkpoint":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "cartStop":
        fx.cartStop = fx.clock;
        shake(340, 0.9);
        burst(e.x, e.y, DUST, 16, 13, 560);
        burst(e.x + 2, e.y + 1.5, "#ffd94a", 8, 12, 400);
        float(e.x, e.y + 5, "Whoa!", GOLD, 2.4);
        break;
      case "crateHit":
        burst(e.x, e.y, "#8a6a3a", 6, 11, 320);
        break;
      case "crateBreak":
        burst(e.x, e.y, "#8a6a3a", 16, 17, 520);
        splinter(fx, e.x, e.y);
        float(e.x, e.y + 3, "Smash!", GOLD, 2);
        break;
      case "boulderSurge":
        shake(600, 0.7);
        banner("It's gaining!", "Hold right to lean ahead of it", DANGER, 2200);
        break;
      case "slideWarn":
        burst(e.x, 48, DUST, 5, 4, 700);
        float(e.x, e.y + 8, "!", DANGER, 2.8);
        break;
      case "slideFall":
        fx.cartPours = (fx.cartPours || []).filter((p) => fx.clock - p.t0 < 1000);
        fx.cartPours.push({ x: e.x, t0: fx.clock });
        shake(260, 0.6);
        burst(e.x, e.y + 0.6, DUST, 12, 11, 520);
        break;
      case "ledgeLeap":
        float(e.x, e.y + 3, "!", DANGER, 2.4);
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
    monsters: freeze({ ledgeimp }),
    bosses: freeze({}),
    missiles: freeze({}),
    hazards: freeze({}),
    powers: freeze({}),
    lights,
    react,
  });
}
