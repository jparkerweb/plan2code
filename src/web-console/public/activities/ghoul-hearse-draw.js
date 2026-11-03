// Plan2Code Web Console - Ghoul Rush's Midnight Hearse, its drawing: a night drive along a cemetery road in a runaway black hearse. A moon and stars, far hills and a mid layer of crypts, dead trees and iron fences that scroll by at their own speeds, the gravel road in front and the raised grass verge behind it (joined by a ramp at each lane gate), open graves, headstones and fallen crosses, low branches and the lychgate arch, hands in grave mounds, crows, closed stretches (a fallen oak, a hedge wall), lanterns, fog banks, the hearse with its coffins and the ghouls that sit up out of the ones thrown out.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain
// data (the voices are the room's own tones, in ghoul-sfx-hearse.js); hearseArt(d) takes
// ghoul-draw.js's drawing helpers (`d`) and hands back the drawing by kind, so this file
// never reaches back into it. Drawn in room units, the way ghoul-draw.js draws: y counted down
// from the field's top, so a world height `y` is drawn at `FIELD_H - y`. The still layers are
// only the sky's color: the world is drawn by `moving` (every frame, over them; no cached
// layers, no random numbers: everything comes from a hash), the lows, the cab's door, the fog,
// the signs and the lamp gauge in front of Planny by `front`. What the art reads off the rules
// (ghoul-hearse.js):
//
// - the room: `spec.ride` ({ gates, graves, stones, lows, hands, crows, blocks, lanterns, fog,
//   checks, finish }), the flat road in `spec.ground`.
// - `round.runner` (id "hearse"; null in any other room): `lane`, `from`, `swMs`, `h`, `air`, `lamp`,
//   `out`, `fog`, `coffins`, `lit` [taken], `done`, `restX`, `check`, `hands` [{ state "mound" | "warn" |
//   "up" | "sink" | "broken" | "spent", t }], `crows` [{ state "perch" | "fly" | "gone" | "broken", x }],
//   `sitters` [{ x, ox, lane, state "fly" | "sit" | "hid" | "broken", t }].
// - Planny: `you.x`, `you.y`, `you.vy`, `you.ducking`.
// - events leave short-lived bits in the view's `fx` (`hearseBits`, `hearseLand`).

import { CROW_H, FLY_MS, GRAVE_W, HAND_H, LANE_Y, LAMP_MAX, LOW_Y, SIT_MS, SIT_RISE_MS, baseOf, laneNow } from "./ghoul-hearse.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "hearse", custom: true, noMoon: true, pit: "#05080f", ...o });
export const LOOKS = freeze({
  hearse: pit({ wallTop: "#04060d", wallLow: "#1b2438", paper: "#10162a", wainscot: "#0a0e1c", floorTop: "#3b332c", floor: "#241f1a", floorEdge: "#0a0805", shelf: "#3a3a44", shelfTop: "#7a7a88", window: "#dfe6f0", decor: "graves", color: "#c8b8d8", dark: 0.5 }),
});

// How each new kind sounds, by act (the room's own tones, ghoul-sfx-hearse.js).
export const VOICES = freeze({
  hearse: freeze({ jump: "ghoulHearseJump", land: "ghoulHearseLand", duck: "ghoulHearseDuck", switch: "ghoulHearseSwitch", crash: "ghoulHearseCrash", check: "ghoulHearseCheck", finish: "ghoulHearseFinish" }),
  hearsehand: freeze({ warn: "ghoulHearseHandWarn", up: "ghoulHearseHandUp", hit: "ghoulHearseHandHit", break: "ghoulHearseHandBreak" }),
  hearsecrow: freeze({ wake: "ghoulHearseCrowWake", hit: "ghoulHearseCrowHit" }),
  hearselamp: freeze({ lantern: "ghoulHearseLantern", out: "ghoulHearseLampOut", lit: "ghoulHearseLampLit" }),
  hearsecoffin: freeze({ fly: "ghoulHearseCoffin", up: "ghoulHearseSitUp", hit: "ghoulHearseSitHit" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  hearseJump: ["hearse", "jump"],
  hearseLand: ["hearse", "land"],
  hearseDuck: ["hearse", "duck"],
  hearseSwitch: ["hearse", "switch"],
  hearseCrash: ["hearse", "crash"],
  hearseCheck: ["hearse", "check"],
  hearseFinish: ["hearse", "finish"],
  hearseHandWarn: ["hearsehand", "warn"],
  hearseHandUp: ["hearsehand", "up"],
  hearseHandHit: ["hearsehand", "hit"],
  hearseHandBreak: ["hearsehand", "break"],
  hearseCrowWake: ["hearsecrow", "wake"],
  hearseCrowHit: ["hearsecrow", "hit"],
  hearseLantern: ["hearselamp", "lantern"],
  hearseLampOut: ["hearselamp", "out"],
  hearseLampLit: ["hearselamp", "lit"],
  hearseCoffin: ["hearsecoffin", "fly"],
  hearseSitUp: ["hearsecoffin", "up"],
  hearseSitHit: ["hearsecoffin", "hit"],
});
export const LOSE_WORDS = freeze({ grave: "Fell in a grave", tomb: "Hit a headstone", cross: "Hit a fallen cross", branch: "Ducked too late", grasp: "Grabbed by a hand", crow: "Pecked by a crow", wreck: "Wrecked on the road" });
export const LOSE_SOUNDS = freeze({
  grave: ["ghoulRockLand", 0.55, 0.8],
  tomb: ["smash", 0.6, 0.7],
  cross: ["clank", 0.5, 0.7],
  branch: ["clank", 0.5, 0.8],
  grasp: ["ghoulHandsGrab", 0.5, 1],
  crow: ["ghoulShriek", 0.3, 0.8],
  wreck: ["smash", 0.65, 0.6],
});

const FW = 96;
const ROAD = LANE_Y[0];
const VERGE = LANE_Y[1];
const BLOCK_H = 14.5;
let FH = 54;
const BONE = "#d8d0b8";
const STONE_C = "#8d949b";
const STONE_D = "#4e545b";
const MOSS = "#2d3b24";
const BLACK = "#14121a";
const CHROME = "#b9b2a0";
const VELVET = "#5a1020";
const SOIL = "#3a2c1e";
const SOIL_D = "#1e160e";

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
// hearse is in: JUMP (an arrow up, cyan) over graves, headstones and crosses, DUCK (an arrow down,
// amber) under low branches and the arch, SHOOT (a crosshair, red) at hands and crows, SWITCH (green,
// the lane to take) at the gate before a closed stretch. Everything comes from the room's `ride`
// fields and where the hearse is (no random numbers, no rules).
export const TELEGRAPH_SEE = 40;
export const TELEGRAPH_FULL = 30;
export const TELEGRAPH_WORDS = 3;
export const TELEGRAPH_ALPHA = 0.78;
export const ANSWERS = freeze({ grave: "JUMP", stone: "JUMP", cross: "JUMP", branch: "DUCK", arch: "DUCK", hand: "SHOOT", crow: "SHOOT", block: "SWITCH" });
export const ANSWER_COLORS = freeze({ JUMP: "#5fe3ff", DUCK: "#ffb02e", SHOOT: "#ff6a6a", SWITCH: "#7dffa0" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lane, lead (where it begins), x (its middle), up (height of
// the glyph's anchor), n (which of its kind), answer }, in the room's order. A closed stretch's glyph
// stands at the gate before it (the last one that ends 22 or more short of it) and names the other lane.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lane, lead, x, up) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lane, lead, x, up: LANE_Y[lane] + up, n, answer: ANSWERS[kind] });
  };
  for (const [x, lane] of R.graves) add("grave", lane, x - 6, x, 8.4);
  for (const [x, lane, kind] of R.stones) add(kind ? "cross" : "stone", lane, x - 3, x, kind ? 6.4 : 7.6);
  for (const [x0, x1, lane, kind] of R.lows) add(kind ? "arch" : "branch", lane, x0 - 3.2, (x0 + x1) / 2, kind ? 7.6 : 7.4);
  for (const [x, lane] of R.hands) add("hand", lane, x - 2, x, 8);
  for (const [x, lane, up] of R.crows) add("crow", lane, x - 17 - 2, x - 17, up + 4.6);
  for (const [x0, , lane] of R.blocks) {
    const gate = R.gates.filter(([, b]) => b + 22 <= x0).at(-1);
    if (gate) add("block", lane, gate[1], (gate[0] + gate[1]) / 2, 16);
  }
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with the hearse at `x` in `lane`: { ...mark, alpha (0..1, before the pulse), words }.
export function telegraphs(R, x, lane) {
  const out = [];
  for (const m of telegraphMarks(R)) {
    if (m.lane !== lane) continue;
    const d = m.lead - x;
    if (d > TELEGRAPH_SEE || d < -6) continue;
    const alpha = Math.min(clamp((TELEGRAPH_SEE - d) / (TELEGRAPH_SEE - TELEGRAPH_FULL), 0, 1), clamp((d + 4) / 6, 0, 1));
    if (alpha > 0.01) out.push({ ...m, alpha, words: m.n < TELEGRAPH_WORDS || m.kind === "block" });
  }
  return out;
}

/* --------------------------------------------------------------------- art */

export function hearseArt(d) {
  const { ellipse, say, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "hearse" ? v.spec.ride : null);
  const runner = (v) => (v.round && v.round.runner && v.round.runner.id === "hearse" ? v.round.runner : null);

  // The still layers get only the sky's color; `moving` draws the world.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  function ground() {}
  function shelf() {}

  /* ---------------------------------------------------------- the sky and far scenery */

  function sky(ctx, v, cam) {
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#04060d"], [0.55, "#121a2e"], [1, "#2a3552"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    const clock = v.clock;
    for (let k = 0; k < 46; k++) {
      const x = cam + ((((rnd(k, 1) * FW - cam * 0.02) % FW) + FW) % FW);
      ctx.globalAlpha = 0.25 + 0.5 * rnd(k, 3) * (0.7 + 0.3 * Math.sin(clock / 500 + k));
      ctx.fillStyle = "#dfe6f4";
      ctx.fillRect(x, rnd(k, 2) * 26, 0.22, 0.22);
    }
    ctx.globalAlpha = 1;
    // The moon: pale, with a halo and a few maria, riding with the view.
    const mx = cam + 74;
    const my = 9;
    halo(ctx, mx, my, 16, "rgba(190,205,240,0.5)", 0.55);
    ctx.fillStyle = "#e8edf6";
    disc(ctx, mx, my, 4.4);
    ctx.fillStyle = "rgba(150,160,190,0.45)";
    disc(ctx, mx - 1.3, my - 0.8, 1.1);
    disc(ctx, mx + 1.2, my + 1.2, 0.8);
    disc(ctx, mx + 0.6, my - 1.8, 0.5);
    // Cloud streaks sliding across it.
    ctx.fillStyle = "rgba(20,28,48,0.55)";
    for (let k = 0; k < 3; k++) ellipse(ctx, cam + ((((rnd(k, 9) * 140 - clock / 90 - cam * 0.05) % 140) + 140) % 140) - 20, 5 + k * 3.4, 12 + rnd(k, 4) * 6, 0.6);
    ctx.fill();
  }

  // Far hills: a soft ridge made of sines, at a slow parallax.
  function hills(ctx, cam, par, base, amp, color, seed) {
    const u0 = cam * par;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cam - 1, FH);
    for (let px = -1; px <= FW + 3; px += 3) {
      const u = u0 + px;
      ctx.lineTo(cam + px, Y(base + amp * (0.5 * Math.sin(u * 0.045 + seed) + 0.35 * Math.sin(u * 0.11 + seed * 2) + 0.15 * Math.sin(u * 0.27))));
    }
    ctx.lineTo(cam + FW + 3, FH);
    ctx.closePath();
    ctx.fill();
  }

  // The mid layer (parallax 0.35): crypts, dead trees, crosses and iron fence, every 14 units a slot.
  function cemetery(ctx, cam) {
    const par = 0.35;
    const base = Y(VERGE + 0.4);
    const u0 = cam * par;
    for (let slot = Math.floor((u0 - 4) / 14); slot <= Math.floor((u0 + FW + 8) / 14); slot++) {
      const r = rnd(slot, 11);
      const x = cam + (slot * 14 - u0) + r * 6;
      ctx.fillStyle = "#0d1322";
      ctx.strokeStyle = "#0d1322";
      if (r < 0.2) {
        // A crypt: a box, a gable, a dark door.
        ctx.fillRect(x - 3.2, base - 6, 6.4, 6);
        poly(ctx, [[x - 4, base - 6], [x, base - 9], [x + 4, base - 6]]);
        ctx.fill();
        ctx.fillStyle = "#04060c";
        ctx.fillRect(x - 0.9, base - 3.6, 1.8, 3.6);
      } else if (r < 0.45) {
        // A dead tree: a trunk and bare limbs.
        ctx.lineWidth = 0.5;
        seg(ctx, x, base, x + 0.3, base - 8);
        ctx.lineWidth = 0.28;
        for (let k = 0; k < 4; k++) seg(ctx, x + 0.2, base - 3 - k * 1.5, x + (k % 2 ? 2.8 : -2.8) * (1 - k * 0.12), base - 4.6 - k * 1.6);
      } else if (r < 0.7) {
        // A cross and a slab.
        ctx.fillRect(x - 0.3, base - 4.4, 0.6, 4.4);
        ctx.fillRect(x - 1.3, base - 3.5, 2.6, 0.55);
        ctx.fillRect(x + 2.4, base - 2.6, 1.8, 2.6);
      } else {
        // Iron fence with spear tops.
        ctx.lineWidth = 0.12;
        for (let k = 0; k < 9; k++) {
          seg(ctx, x + k * 0.8 - 3, base, x + k * 0.8 - 3, base - 3);
          poly(ctx, [[x + k * 0.8 - 3.2, base - 3], [x + k * 0.8 - 3, base - 3.7], [x + k * 0.8 - 2.8, base - 3]]);
          ctx.fill();
        }
        seg(ctx, x - 3, base - 1, x + 4, base - 1);
      }
    }
  }

  /* -------------------------------------------------------------- the road and the verge */

  // The gravel road (the floor's dark slab) with its ruts and pebbles, and the raised verge behind it.
  function roadway(ctx, v, cam, R) {
    const top = Y(ROAD);
    ctx.fillStyle = vgrad(ctx, top, top + ROAD, [[0, "#4a4036"], [0.2, "#322a23"], [1, "#171310"]]);
    ctx.fillRect(cam - 1, top, FW + 2, ROAD + 1);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(cam - 1, top + 2.2, FW + 2, 0.35);
    ctx.fillRect(cam - 1, top + 4.4, FW + 2, 0.3);
    for (let k = Math.floor(cam / 2.5); k < Math.floor((cam + FW) / 2.5) + 1; k++) {
      if (rnd(k, 31) < 0.55) continue;
      ctx.fillStyle = rnd(k, 32) < 0.5 ? "rgba(120,106,90,0.5)" : "rgba(10,8,6,0.5)";
      ctx.fillRect(k * 2.5 + rnd(k, 33), top + 0.5 + rnd(k, 34) * 6, 0.35 + rnd(k, 35) * 0.5, 0.25);
    }
    // The verge: a raised terrace behind the road, a stone curb at its foot, grass on top.
    const vy = Y(VERGE);
    ctx.fillStyle = vgrad(ctx, vy, top, [[0, "#2e3d26"], [0.12, "#1f2a1a"], [1, "#16110c"]]);
    ctx.fillRect(cam - 1, vy, FW + 2, top - vy + 0.1);
    ctx.fillStyle = "#4a5a38";
    ctx.fillRect(cam - 1, vy, FW + 2, 0.4);
    for (let k = Math.floor(cam / 1.7); k < Math.floor((cam + FW) / 1.7) + 1; k++) {
      const h = 0.4 + rnd(k, 41) * 0.7;
      ctx.fillStyle = k % 3 ? "#3b4d2c" : "#2a3a20";
      ctx.fillRect(k * 1.7, vy - h + 0.3, 0.16, h);
    }
    ctx.fillStyle = "#5c5c66";
    ctx.fillRect(cam - 1, top - 1.2, FW + 2, 1.2);
    ctx.fillStyle = "#3a3a44";
    for (let k = Math.floor(cam / 5); k < Math.floor((cam + FW) / 5) + 1; k++) ctx.fillRect(k * 5, top - 1.2, 0.15, 1.2);
    ctx.fillStyle = "#7a7a88";
    ctx.fillRect(cam - 1, top - 1.2, FW + 2, 0.2);
    // At each lane gate the bank is a ramp, with chevrons painted on it.
    for (const [a, b] of R.gates) {
      if (b < cam - 4 || a > cam + FW + 4) continue;
      // The bank is cut away above the ramp (a dirt slope up from the road to the verge).
      ctx.fillStyle = "#2a241d";
      poly(ctx, [[a, top], [a, vy], [b, vy]]);
      ctx.fill();
      ctx.strokeStyle = "#6a5a46";
      ctx.lineWidth = 0.35;
      seg(ctx, a, top, b, vy);
      ctx.strokeStyle = "rgba(240,230,190,0.6)";
      ctx.lineWidth = 0.22;
      for (let k = 0; k < 3; k++) {
        const cx = a + 3 + k * 4.2;
        const cy = top - ((cx - a) / (b - a)) * (top - vy) - 0.6;
        ctx.beginPath();
        ctx.moveTo(cx - 0.8, cy + 0.6);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx - 0.8, cy - 0.6);
        ctx.stroke();
      }
    }
  }

  /* ---------------------------------------------------------------- the things */

  // The gate's posts: a stone post with a lamp at each end of the ramp, and a dim green lantern between.
  function gatePosts(ctx, v, a, b) {
    for (const [px, lit] of [[a - 0.4, 1], [b + 0.4, 0]]) {
      ctx.fillStyle = "#4a4a54";
      ctx.fillRect(px - 0.5, Y(ROAD + 4.2), 1, 4.2);
      ctx.fillStyle = "#6a6a76";
      ctx.fillRect(px - 0.7, Y(ROAD + 4.2), 1.4, 0.4);
      ctx.fillStyle = "#7dffa0";
      ctx.globalAlpha = 0.7 + 0.25 * Math.sin(v.clock / 300 + lit);
      disc(ctx, px, Y(ROAD + 5), 0.55);
      ctx.globalAlpha = 1;
      halo(ctx, px, Y(ROAD + 5), 4, "rgba(125,255,160,0.8)", 0.35);
    }
  }

  // An open grave at x on a lane: a dark pit between heaps of soil, a shovel in one, a plank across the edge.
  function grave(ctx, x, lane, i) {
    const y = Y(LANE_Y[lane]);
    const w = GRAVE_W;
    ctx.fillStyle = "#04030a";
    poly(ctx, [[x - w / 2 + 0.6, y - 0.1], [x + w / 2 - 0.6, y - 0.1], [x + w / 2 - 1.6, y + 2.6], [x - w / 2 + 1.6, y + 2.6]]);
    ctx.fill();
    ctx.fillStyle = SOIL_D;
    ctx.fillRect(x - w / 2 + 1.6, y + 1.5, w - 3.2, 1.1);
    // The soil heaped each side and its cut face.
    for (const s of [-1, 1]) {
      ctx.fillStyle = SOIL;
      poly(ctx, [[x + s * (w / 2 - 0.5), y], [x + s * (w / 2 + 1.2), y - 1.7], [x + s * (w / 2 + 3.2), y - 0.6], [x + s * (w / 2 + 4.4), y]]);
      ctx.fill();
      ctx.fillStyle = "#4e3b28";
      ctx.fillRect(x + s * (w / 2 + 0.3) - 0.2, y - 0.8, 0.4, 0.4);
    }
    // A shovel stuck in the right heap.
    ctx.strokeStyle = "#7a5a34";
    ctx.lineWidth = 0.22;
    seg(ctx, x + w / 2 + 2.2, y - 0.6, x + w / 2 + 1.8, y - 3.4);
    ctx.fillStyle = "#8a8a94";
    poly(ctx, [[x + w / 2 + 1.5, y - 3.4], [x + w / 2 + 2.1, y - 3.4], [x + w / 2 + 2.2, y - 4.4], [x + w / 2 + 1.4, y - 4.4]]);
    ctx.fill();
    // A pale rim of an old coffin's corner showing in the pit.
    ctx.fillStyle = "rgba(180,160,120,0.35)";
    poly(ctx, [[x - 1.5, y + 1.4], [x + 2.2, y + 1.9], [x + 2.4, y + 2.5], [x - 1.7, y + 2.2]]);
    ctx.fill();
    if (rnd(i, 7) < 0.5) {
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.18;
      seg(ctx, x - 2.4, y + 2.1, x - 1.2, y + 1.5);
    }
  }

  // A leaning headstone (a slab, an obelisk or a rounded one) or a fallen cross lying in the road.
  function stone(ctx, x, lane, kind, i) {
    const y = Y(LANE_Y[lane]);
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, 0.3, 0.05, kind ? 3.2 : 2, 0.3);
    ctx.fill();
    if (kind) {
      // A cross knocked flat: the long beam, the arm, a broken base, moss.
      ctx.rotate(-0.04);
      ctx.fillStyle = STONE_C;
      ctx.fillRect(-2.7, -1.0, 5.4, 0.95);
      ctx.fillRect(-0.4, -1.8, 0.9, 1.8);
      ctx.fillStyle = STONE_D;
      ctx.fillRect(-2.7, -0.4, 5.4, 0.35);
      ctx.fillStyle = MOSS;
      ctx.fillRect(-2.1, -1.05, 1.4, 0.2);
      ctx.fillRect(1.0, -1.05, 1.1, 0.2);
      ctx.fillStyle = STONE_C;
      poly(ctx, [[2.7, -1.0], [3.4, -0.5], [2.9, 0], [2.7, 0]]);
      ctx.fill();
    } else {
      ctx.rotate((rnd(i, 4) - 0.5) * 0.2);
      const shape = i % 3;
      ctx.fillStyle = STONE_C;
      if (shape === 0) {
        ctx.beginPath();
        ctx.moveTo(-1.3, 0);
        ctx.lineTo(-1.3, -3.2);
        ctx.arc(0, -3.2, 1.3, Math.PI, 0);
        ctx.lineTo(1.3, 0);
        ctx.closePath();
        ctx.fill();
      } else if (shape === 1) {
        poly(ctx, [[-1.1, 0], [-0.8, -3.7], [0, -4.4], [0.8, -3.7], [1.1, 0]]);
        ctx.fill();
      } else {
        poly(ctx, [[-1.3, 0], [-1.3, -2.6], [-0.2, -3.3], [0.4, -2.8], [1.3, -3.4], [1.3, 0]]);
        ctx.fill();
      }
      ctx.fillStyle = STONE_D;
      ctx.fillRect(0.5, -3, 0.8, 3);
      ctx.strokeStyle = "#394048";
      ctx.lineWidth = 0.13;
      seg(ctx, -0.7, -2.4, 0.6, -2.4);
      seg(ctx, -0.7, -1.7, 0.2, -1.7);
      ctx.fillStyle = MOSS;
      ctx.fillRect(-1.3, -0.5, 1.3, 0.5);
    }
    ctx.restore();
  }

  // A hand in its mound: a heap of soil that stirs, then an arm reaching up with grasping fingers.
  function hand(ctx, v, x, lane, h, i) {
    const y = Y(LANE_Y[lane]);
    const clock = v.clock;
    const shake = h.state === "warn" ? Math.sin(clock / 30) * 0.18 : 0;
    ctx.fillStyle = SOIL;
    poly(ctx, [[x - 2.2, y], [x - 1.1 + shake, y - 1.1], [x + 0.8 + shake, y - 1.3], [x + 2.2, y]]);
    ctx.fill();
    ctx.fillStyle = "#4e3b28";
    ctx.fillRect(x - 0.5, y - 1.1, 0.4, 0.3);
    const rise = h.state === "up" ? clamp((1600 - h.t) / 260, 0, 1) : h.state === "sink" ? clamp(h.t / 300, 0, 1) : 0;
    if (rise <= 0) return;
    const top = y - 0.8 - (HAND_H - 0.8) * rise;
    ctx.strokeStyle = "#7a8a64";
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    const sway = Math.sin(clock / 160 + i) * 0.25;
    ctx.beginPath();
    ctx.moveTo(x, y - 0.6);
    ctx.quadraticCurveTo(x + sway, (y + top) / 2, x + sway * 1.4, top + 0.8);
    ctx.stroke();
    ctx.lineWidth = 0.22;
    for (let k = -2; k <= 2; k++) seg(ctx, x + sway * 1.4 + k * 0.28, top + 0.9, x + sway * 1.4 + k * 0.5 + Math.sin(clock / 90 + k) * 0.2, top - 0.2 - (2 - Math.abs(k)) * 0.15);
    ctx.fillStyle = "#6b7a5e";
    ctx.fillRect(x + sway * 1.4 - 0.7, top + 0.7, 1.4, 0.9);
    ctx.lineCap = "butt";
  }

  // A crow: perched on a fence post, or flying left with its wings going.
  function crow(ctx, v, w, lane, up, i) {
    const base = Y(LANE_Y[lane]);
    const clock = v.clock;
    const ink = "#2c2836";
    if (w.state === "perch") {
      const py = base - up + 0.2;
      ctx.fillStyle = "#3a2c1e";
      ctx.fillRect(w.x - 0.3, py + 0.4, 0.6, up);
      ctx.fillStyle = ink;
      ellipse(ctx, w.x, py - 0.4, 1.1, 0.8);
      ctx.fill();
      disc(ctx, w.x - 0.9, py - 1.1, 0.45);
      poly(ctx, [[w.x - 1.3, py - 1.1], [w.x - 2.1, py - 0.95], [w.x - 1.3, py - 0.8]]);
      ctx.fill();
      ctx.fillStyle = "#ff4a3a";
      ctx.fillRect(w.x - 1.1, py - 1.25, 0.16, 0.16);
      ctx.fillStyle = "#5a5470";
      poly(ctx, [[w.x + 0.9, py - 0.2], [w.x + 2.1, py + 0.3], [w.x + 0.7, py + 0.3]]);
      ctx.fill();
      return;
    }
    if (w.state !== "fly") return;
    const cy = base - up - CROW_H / 2;
    const flap = Math.sin(clock / 55 + i * 2);
    ctx.fillStyle = ink;
    ellipse(ctx, w.x, cy, 1.15, 0.6);
    ctx.fill();
    disc(ctx, w.x - 1.1, cy - 0.15, 0.42);
    poly(ctx, [[w.x - 1.45, cy - 0.15], [w.x - 2.3, cy], [w.x - 1.45, cy + 0.1]]);
    ctx.fill();
    ctx.fillStyle = "#ff4a3a";
    ctx.fillRect(w.x - 1.3, cy - 0.3, 0.14, 0.14);
    ctx.fillStyle = "#5a5470";
    poly(ctx, [[w.x - 0.3, cy - 0.2], [w.x + 0.9, cy - 0.2 - flap * 1.5], [w.x + 1.9, cy - 0.4 - flap * 1.9], [w.x + 0.6, cy + 0.1]]);
    ctx.fill();
    poly(ctx, [[w.x + 1.0, cy + 0.1], [w.x + 2.2, cy + 0.1], [w.x + 1.0, cy + 0.4]]);
    ctx.fillStyle = ink;
    ctx.fill();
  }

  // A closed stretch: a fallen oak's tangle across the road (lane 0), or a hedge wall with an iron fence (lane 1).
  function block(ctx, v, x0, x1, lane, i) {
    const y = Y(LANE_Y[lane]);
    const w = x1 - x0;
    if (lane === 0) {
      // The root ball at the left, the trunk, snapped limbs bristling up.
      ctx.fillStyle = "#1a130d";
      ctx.fillRect(x0 + 2, y - 9.6, w - 3, 9.6);
      ctx.fillStyle = "#2a1e14";
      ctx.fillRect(x0 + 2, y - 9.6, w - 3, 1.2);
      ctx.fillStyle = "#0f0b08";
      for (let k = 0; k < 14; k++) ctx.fillRect(x0 + 3 + rnd(i * 20 + k, 1) * (w - 6), y - 9 + rnd(i * 20 + k, 2) * 8.6, 0.2, 1.4 + rnd(i * 20 + k, 3) * 2);
      ctx.fillStyle = "#1a130d";
      disc(ctx, x0 + 4, y - 7.2, 7);
      ctx.fillStyle = SOIL_D;
      disc(ctx, x0 + 2.4, y - 7.4, 4.6);
      ctx.strokeStyle = "#1a130d";
      ctx.lineCap = "round";
      for (let k = 0; k < 11; k++) {
        const a = Math.PI * 0.55 + (k / 10) * Math.PI * 0.9;
        ctx.lineWidth = 0.5 - k * 0.02;
        seg(ctx, x0 + 4 + Math.cos(a) * 5, y - 7.2 - Math.sin(a) * 5, x0 + 4 + Math.cos(a) * 9.4, y - 7.2 - Math.sin(a) * 9.4);
      }
      ctx.lineCap = "butt";
      ctx.lineWidth = 0.7;
      for (let k = 0; k < 9; k++) {
        const bx = x0 + 8 + k * ((w - 10) / 8);
        const top = y - BLOCK_H * (0.6 + 0.4 * rnd(i * 9 + k, 5));
        seg(ctx, bx, y - 8.6, bx + (rnd(i * 9 + k, 6) - 0.5) * 3, top);
        seg(ctx, bx + (rnd(i * 9 + k, 6) - 0.5) * 1.5, (y - 8.6 + top) / 2, bx + (rnd(i * 9 + k, 7) - 0.3) * 4, top + 2);
      }
      ctx.fillStyle = "rgba(160,200,240,0.18)";
      ctx.fillRect(x0 + 2, y - 9.6, w - 3, 0.25);
    } else {
      // A hedge wall (dense, clipped, with a tall dead top) and the bars of an iron fence along its foot.
      ctx.fillStyle = "#16240f";
      ctx.fillRect(x0, y - BLOCK_H, w, BLOCK_H);
      ctx.fillStyle = "#223616";
      for (let k = 0; k < 40; k++) disc(ctx, x0 + rnd(i * 50 + k, 1) * w, y - rnd(i * 50 + k, 2) * BLOCK_H, 0.9 + rnd(i * 50 + k, 3) * 1.4);
      ctx.fillStyle = "#0e1a09";
      for (let k = 0; k < 6; k++) ctx.fillRect(x0 + (k + 0.5) * (w / 6), y - BLOCK_H, 0.35, BLOCK_H);
      ctx.strokeStyle = "#0a0a10";
      ctx.lineWidth = 0.2;
      for (let k = 0; k <= w; k += 1.4) {
        seg(ctx, x0 + k, y, x0 + k, y - 4.6);
        poly(ctx, [[x0 + k - 0.25, y - 4.6], [x0 + k, y - 5.4], [x0 + k + 0.25, y - 4.6]]);
        ctx.fillStyle = "#0a0a10";
        ctx.fill();
      }
      seg(ctx, x0, y - 2.4, x1, y - 2.4);
      // Red eyes in the leaves.
      ctx.fillStyle = "#ff3a2a";
      ctx.globalAlpha = 0.6 + 0.3 * Math.sin(v.clock / 400 + i);
      for (let k = 0; k < 3; k++) {
        const ex = x0 + 4 + rnd(i * 7 + k, 8) * (w - 8);
        const ey = y - 6 - rnd(i * 7 + k, 9) * 6;
        ctx.fillRect(ex, ey, 0.22, 0.22);
        ctx.fillRect(ex + 0.7, ey, 0.22, 0.22);
      }
      ctx.globalAlpha = 1;
    }
  }

  // A lantern on a post in a lane: glowing until it is taken.
  function lantern(ctx, v, x, lane, taken, i) {
    const y = Y(LANE_Y[lane]);
    ctx.strokeStyle = "#2a2a34";
    ctx.lineWidth = 0.28;
    seg(ctx, x + 1, y, x + 1, y - 4.8);
    seg(ctx, x + 1, y - 4.8, x, y - 4.8);
    ctx.fillStyle = "#2a2a34";
    ctx.fillRect(x - 0.6, y - 4.8, 1.2, 0.3);
    if (taken) return;
    const flick = 0.85 + 0.15 * Math.sin(v.clock / 120 + i * 3);
    ctx.fillStyle = "#ffcf5a";
    ctx.globalAlpha = flick;
    ctx.fillRect(x - 0.45, y - 4.4, 0.9, 1.1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#ffe9a0";
    ctx.fillRect(x - 0.2, y - 4.1, 0.4, 0.55);
    ctx.strokeStyle = "#2a2a34";
    ctx.lineWidth = 0.12;
    ctx.strokeRect(x - 0.45, y - 4.4, 0.9, 1.1);
    halo(ctx, x, y - 3.9, 4.2, "rgba(255,200,90,0.9)", 0.4 * flick);
  }

  // A checkpoint: a pole across the road with a black banner and a gold star, lit once passed.
  function checkpoint(ctx, v, x, passed) {
    const top = Y(30);
    ctx.fillStyle = "#2a2a34";
    ctx.fillRect(x - 0.3, top, 0.6, Y(ROAD) - top);
    ctx.fillStyle = passed ? "#244a30" : "#1a1420";
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

  // The cemetery gate at the end of the road: two stone piers and an iron arch with a cross.
  function finishGate(ctx, v, x) {
    const gy = Y(ROAD);
    for (const px of [x - 7, x + 7]) {
      ctx.fillStyle = "#5a5a66";
      ctx.fillRect(px - 1.4, gy - 15, 2.8, 15);
      ctx.fillStyle = "#7a7a88";
      ctx.fillRect(px - 1.8, gy - 15.6, 3.6, 0.9);
      ctx.fillStyle = "#3a3a44";
      ctx.fillRect(px + 0.5, gy - 15, 0.9, 15);
      ctx.fillStyle = "#7dffa0";
      disc(ctx, px, gy - 17, 0.8);
      halo(ctx, px, gy - 17, 6, "rgba(125,255,160,0.8)", 0.4);
    }
    ctx.strokeStyle = "#0e0e14";
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    ctx.moveTo(x - 7, gy - 14);
    ctx.quadraticCurveTo(x, gy - 22, x + 7, gy - 14);
    ctx.stroke();
    ctx.lineWidth = 0.22;
    for (let k = -5; k <= 5; k++) seg(ctx, x + k * 1.2, gy - 14.8 - (1 - (k / 6) ** 2) * 4.4, x + k * 1.2, gy - 11);
    seg(ctx, x, gy - 20.2, x, gy - 23);
    seg(ctx, x - 1, gy - 22, x + 1, gy - 22);
  }

  /* --------------------------------------------------------- coffins and sitters */

  // A coffin, side on: a long hexagon with a brass plate; `open` shows the lid propped up.
  function coffin(ctx, w, h, open) {
    ctx.fillStyle = "#4a2e1c";
    poly(ctx, [[-w / 2, 0], [-w / 2 + h * 0.5, -h], [w / 2 - h * 0.5, -h], [w / 2, 0]]);
    ctx.fill();
    ctx.fillStyle = "#6a4528";
    ctx.fillRect(-w / 2 + h * 0.6, -h, w - h * 1.2, h * 0.25);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(-0.4, -h * 0.65, 0.8, h * 0.3);
    if (open) {
      ctx.save();
      ctx.translate(-w / 2 + 0.2, -h);
      ctx.rotate(-0.9);
      ctx.fillStyle = "#6a4528";
      ctx.fillRect(0, -0.35, w * 0.9, 0.35);
      ctx.restore();
    }
  }

  // A pale ghoul sitting up out of a coffin lid at (x, base): rises over SIT_RISE_MS and lurches.
  function ghoul(ctx, v, x, base, rise, i) {
    const up = 3.2 * clamp(rise, 0, 1);
    const sway = Math.sin(v.clock / 180 + i) * 0.3 * rise;
    ctx.fillStyle = "#8a9a7e";
    poly(ctx, [[x - 1.3 + sway, base - 0.6], [x - 1.1 + sway, base - 0.6 - up * 0.7], [x + 1.1 + sway, base - 0.6 - up * 0.7], [x + 1.3 + sway, base - 0.6]]);
    ctx.fill();
    ctx.fillStyle = "#a9b89c";
    disc(ctx, x + sway, base - 0.6 - up, 0.95);
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(x - 0.5 + sway, base - 0.85 - up, 0.35, 0.4);
    ctx.fillRect(x + 0.2 + sway, base - 0.85 - up, 0.35, 0.4);
    ctx.fillRect(x - 0.3 + sway, base - 0.2 - up, 0.6, 0.35);
    ctx.fillStyle = "#ff4a3a";
    ctx.fillRect(x - 0.4 + sway, base - 0.8 - up, 0.15, 0.15);
    ctx.fillRect(x + 0.3 + sway, base - 0.8 - up, 0.15, 0.15);
    ctx.strokeStyle = "#8a9a7e";
    ctx.lineWidth = 0.28;
    seg(ctx, x - 1.1 + sway, base - 0.6 - up * 0.6, x - 2.2 + sway, base - 1.2 - up * 0.2);
    seg(ctx, x + 1.1 + sway, base - 0.6 - up * 0.6, x + 2.2 + sway, base - 1.2 - up * 0.3);
  }

  // The coffins thrown out: tumbling through the air, then lying in the lane with the lid up and a ghoul sat up in it.
  function sitters(ctx, v, c, lane) {
    c.sitters.forEach((s, i) => {
      if (s.lane !== lane) return;
      const base = Y(LANE_Y[s.lane]);
      if (s.state === "fly") {
        const p = 1 - s.t / FLY_MS;
        const ox = s.ox - 4;
        ctx.save();
        ctx.translate(ox + (s.x - ox) * p, base - 3 - Math.sin(p * Math.PI) * 9 + 3 * p);
        ctx.rotate(p * 9);
        coffin(ctx, 7, 1.9, false);
        ctx.restore();
        return;
      }
      ctx.save();
      ctx.translate(s.x, base);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ellipse(ctx, 0, 0.05, 4, 0.3);
      ctx.fill();
      coffin(ctx, 7, 1.7, s.state !== "hid");
      ctx.restore();
      if (s.state === "sit") ghoul(ctx, v, s.x + 0.8, base - 1.0, (SIT_MS - s.t) / SIT_RISE_MS, i);
    });
  }

  /* ------------------------------------------------------------------ the hearse */

  // The hearse's transform: at Planny's feet (the road under it), tilted nose up on the way up, rumbling a little.
  function place(ctx, v, c, fn) {
    const round = v.round;
    const you = round.you;
    const x = c.done ? c.restX : you.x;
    const y = c.done ? ROAD : you.y;
    const tilt = c.air ? clamp(c.vy / 320, -0.16, 0.16) : 0;
    const rumble = !c.done && !c.air ? Math.sin(v.clock / 45) * 0.07 : 0;
    ctx.save();
    ctx.translate(x, Y(y) + rumble);
    ctx.rotate(-tilt);
    fn(x);
    ctx.restore();
  }

  // The back: wheels, chassis, the coffin bay with its coffins under glass, cab seat, the lamp. Local y counts down.
  function hearseBack(ctx, v, c, x) {
    const clock = v.clock;
    const lamp = c.lamp > 0;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, -4.5, 0.05, 9, 0.4);
    ctx.fill();
    // Ghostly exhaust drifting back.
    if (!c.done) {
      for (let k = 0; k < 6; k++) {
        const p = ((clock / 520 + k / 6) % 1);
        ctx.fillStyle = `rgba(150,230,170,${(1 - p) * 0.4})`;
        disc(ctx, -12.9 - p * 6, -1.4 - p * 2.6, 0.35 + p * 0.9);
      }
    }
    // Chassis and fenders.
    ctx.fillStyle = BLACK;
    ctx.fillRect(-12.8, -1.6, 16.2, 0.9);
    for (const wx of [-9.3, 0.9]) {
      ctx.beginPath();
      ctx.arc(wx, -1.6, 1.95, Math.PI, 0);
      ctx.fill();
    }
    // The coffin bay: dark inside, the coffins on end in a row, glass over them.
    ctx.fillStyle = BLACK;
    ctx.fillRect(-12.6, -5.8, 10.3, 4.4);
    ctx.fillStyle = "#07060b";
    ctx.fillRect(-12.1, -5.1, 9.3, 3.3);
    const rattle = c.done || c.air ? 0 : 0.05;
    for (let k = 0; k < c.coffins; k++) {
      const cx = -11.2 + k * 1.82;
      const ry = Math.sin(clock / 60 + k * 2) * rattle;
      ctx.fillStyle = "#4a2e1c";
      poly(ctx, [[cx - 0.8, -1.9 + ry], [cx - 0.95, -3.7 + ry], [cx - 0.45, -4.9 + ry], [cx + 0.45, -4.9 + ry], [cx + 0.95, -3.7 + ry], [cx + 0.8, -1.9 + ry]]);
      ctx.fill();
      ctx.fillStyle = "#6a4528";
      ctx.fillRect(cx - 0.45, -4.8 + ry, 0.9, 0.3);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(cx - 0.18, -3.5 + ry, 0.36, 0.5);
    }
    ctx.fillStyle = "rgba(120,160,200,0.2)";
    ctx.fillRect(-12.1, -5.1, 9.3, 3.3);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    poly(ctx, [[-12.1, -5.1], [-9.6, -5.1], [-11.2, -1.8], [-12.1, -1.8]]);
    ctx.fill();
    // Velvet curtains at the glass's ends, brass rail, roof trim, urns and plumes.
    ctx.fillStyle = VELVET;
    poly(ctx, [[-12.1, -5.1], [-11.1, -5.1], [-12.1, -2.4]]);
    ctx.fill();
    poly(ctx, [[-2.8, -5.1], [-3.8, -5.1], [-2.8, -2.4]]);
    ctx.fill();
    ctx.fillStyle = CHROME;
    ctx.fillRect(-12.8, -6.3, 10.7, 0.55);
    ctx.fillRect(-12.6, -1.5, 10.3, 0.22);
    ctx.fillStyle = "#c9a24a";
    for (const ux of [-12, -7.5, -3]) {
      ctx.fillRect(ux - 0.2, -7.0, 0.4, 0.8);
      disc(ctx, ux, -7.3, 0.55);
    }
    ctx.strokeStyle = "#0a0910";
    ctx.lineWidth = 0.38;
    ctx.lineCap = "round";
    for (const [px, dir] of [[-12.2, -1], [-3.2, 1]]) {
      const sway = Math.sin(clock / 130 + px) * 0.35;
      ctx.beginPath();
      ctx.moveTo(px, -6.6);
      ctx.quadraticCurveTo(px + dir * 1.4 + sway, -9, px + dir * 3.2 + sway, -8.1);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    // The cab: a bench seat, the wheel, the dash, the front fascia with its lamp.
    ctx.fillStyle = VELVET;
    ctx.fillRect(-2.2, -3.8, 1.2, 2.4);
    ctx.fillRect(-2.2, -1.9, 3, 0.5);
    ctx.fillStyle = BLACK;
    ctx.fillRect(-2.3, -2.5, 5.7, 1.1);
    ctx.strokeStyle = "#7a5a34";
    ctx.lineWidth = 0.2;
    seg(ctx, 1.9, -3.6, 1.2, -2.7);
    ctx.lineWidth = 0.14;
    ellipse(ctx, 2.0, -3.7, 0.25, 0.7);
    ctx.stroke();
    ctx.fillStyle = CHROME;
    ctx.fillRect(3.2, -2.9, 0.5, 2);
    ctx.fillStyle = lamp ? "#e8ffb0" : "#26302a";
    disc(ctx, 3.7, -2.4, 0.65);
    if (lamp) halo(ctx, 3.7, -2.4, 7, "rgba(210,255,150,0.9)", 0.45);
    // The wheels turn with the road.
    for (const wx of [-9.3, 0.9]) {
      ctx.fillStyle = "#0a0a0c";
      disc(ctx, wx, -1.55, 1.55);
      ctx.fillStyle = CHROME;
      disc(ctx, wx, -1.55, 1.0);
      ctx.fillStyle = "#1a1a20";
      disc(ctx, wx, -1.55, 0.78);
      ctx.strokeStyle = CHROME;
      ctx.lineWidth = 0.1;
      const a = c.done ? 0 : x / 1.55;
      for (let k = 0; k < 6; k++) seg(ctx, wx, -1.55, wx + Math.cos(a + (k * TAU) / 6) * 0.95, -1.55 + Math.sin(a + (k * TAU) / 6) * 0.95);
      ctx.fillStyle = CHROME;
      disc(ctx, wx, -1.55, 0.22);
    }
  }

  // The front: the cab's door over Planny's legs and the windshield post.
  function hearseFront(ctx, v, c) {
    ctx.fillStyle = BLACK;
    poly(ctx, [[-2.3, -0.5], [3.3, -0.5], [3.3, -2.2], [2.5, -2.45], [-2.3, -2.45]]);
    ctx.fill();
    ctx.strokeStyle = CHROME;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(-2.1, -2.2);
    ctx.lineTo(3.1, -2.2);
    ctx.stroke();
    ctx.fillStyle = CHROME;
    ctx.fillRect(-0.4, -1.9, 0.9, 0.18);
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(-2.1, -2.35, 5.2, 0.2);
    ctx.strokeStyle = CHROME;
    ctx.lineWidth = 0.26;
    seg(ctx, 2.9, -2.4, 2.5, -4.6);
    ctx.fillStyle = "rgba(150,190,230,0.2)";
    poly(ctx, [[2.7, -2.5], [2.4, -4.4], [1.4, -4.4], [1.7, -2.5]]);
    ctx.fill();
  }

  /* ----------------------------------------------------------------- fog and signs */

  // A fog bank: banks of soft blobs along the road, thick at the ground, fading at its ends.
  function fog(ctx, v, x0, x1, cam, i) {
    const clock = v.clock;
    const lo = Math.max(x0, cam - 20);
    const hi = Math.min(x1, cam + FW + 20);
    for (let x = Math.floor(lo / 9) * 9; x < hi; x += 9) {
      const edge = Math.min(clamp((x - x0) / 30, 0, 1), clamp((x1 - x) / 30, 0, 1));
      if (edge <= 0) continue;
      for (let k = 0; k < 3; k++) {
        const bx = x + rnd(i * 90 + x, k) * 9 + Math.sin(clock / 1700 + x + k) * 2;
        const by = Y(2.5 + k * 5.5 + rnd(x, k + 5) * 3);
        ctx.globalAlpha = 0.34 * edge * (1 - k * 0.22);
        ctx.fillStyle = "#b9c4d4";
        ellipse(ctx, bx, by, 9 + rnd(x, k + 8) * 4, 2.4 + k * 0.4);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

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
      for (const [w, c] of [[1.2, "rgba(4,8,22,0.8)"], [0.5, col]]) {
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
    } else if (t.answer === "SWITCH") {
      // A pair of arrows, the lane to take written under them: LEFT is the road, RIGHT the verge.
      const road = t.lane === 1;
      const dir = road ? -1 : 1;
      for (const [w, c] of [[1.3, "rgba(4,8,22,0.8)"], [0.6, col]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        for (let k = 0; k < 2; k++) {
          const ox = t.x + dir * (k * 1.6 - 1.6);
          ctx.beginPath();
          ctx.moveTo(ox - dir * 0.9, cy - 1.7);
          ctx.lineTo(ox + dir * 0.9, cy);
          ctx.lineTo(ox - dir * 0.9, cy + 1.7);
          ctx.stroke();
        }
      }
      label(ctx, road ? "LEFT: ROAD" : "RIGHT: VERGE", t.x, cy + 3.4, 2.1, col, "center");
    } else {
      const up = t.answer === "JUMP";
      const dir = up ? -1 : 1;
      const ay = cy + (up ? -2.6 : 2.6);
      for (const [w, c] of [[1.3, "rgba(4,8,22,0.8)"], [0.6, col]]) {
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

  // The lamp gauge and the coffins left, in the corner of the view.
  function gauge(ctx, v, c, cam) {
    const x = cam + 2.4;
    const y = 8.2;
    const p = c.lamp / LAMP_MAX;
    const low = p < 0.25;
    ctx.fillStyle = "rgba(4,6,14,0.7)";
    ctx.fillRect(x - 0.6, y - 1, 30.2, 4.6);
    ctx.fillStyle = "#1a1a24";
    ctx.fillRect(x + 4.2, y + 0.2, 17, 1.7);
    const pulse = low ? 0.6 + 0.4 * Math.sin(v.clock / 120) : 1;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = low ? "#ff5a3a" : p < 0.5 ? "#ffb02e" : "#ffe27a";
    ctx.fillRect(x + 4.2, y + 0.2, 17 * p, 1.7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c.out ? "#555a66" : "#ffcf5a";
    ctx.fillRect(x + 0.4, y + 0.1, 1.8, 2.2);
    ctx.fillStyle = "#2a2a34";
    ctx.fillRect(x + 0.9, y - 0.5, 0.8, 0.6);
    label(ctx, c.out ? "OUT" : "LAMP", x + 4.4, y + 3.2, 1.5, c.out ? "#ff6a6a" : "#ffe9a0", "left");
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = k < c.coffins ? "#8a5a34" : "#2a2a34";
      poly(ctx, [[x + 22.2 + k * 1.5, y + 2.2], [x + 22.4 + k * 1.5, y + 0.6], [x + 23.0 + k * 1.5, y + 0.2], [x + 23.6 + k * 1.5, y + 0.6], [x + 23.8 + k * 1.5, y + 2.2]]);
      ctx.fill();
    }
  }

  /* ------------------------------------------------------------------- the room */

  const lanePass = (ctx, v, R, c, cam, lane) => {
    const lo = cam - 12;
    const hi = cam + FW + 12;
    R.graves.forEach(([x, l], i) => {
      if (l === lane && x > lo && x < hi) grave(ctx, x, l, i);
    });
    R.stones.forEach(([x, l, kind], i) => {
      if (l === lane && x > lo && x < hi) stone(ctx, x, l, kind, i);
    });
    R.hands.forEach(([x, l], i) => {
      if (l === lane && x > lo && x < hi) hand(ctx, v, x, l, c.hands[i], i);
    });
    R.lanterns.forEach(([x, l], i) => {
      if (l === lane && x > lo && x < hi) lantern(ctx, v, x, l, c.lit[i], i);
    });
    R.crows.forEach(([x, l, up], i) => {
      const w = c.crows[i];
      if (l === lane && w.x > lo && w.x < hi) crow(ctx, v, w, l, up, i);
    });
    R.blocks.forEach(([x0, x1, l], i) => {
      if (l === lane && x1 > lo && x0 < hi) block(ctx, v, x0, x1, l, i);
    });
    sitters(ctx, v, c, lane);
  };

  // The whole world, over the still layers: sky, hills, the cemetery, road and verge, the things by lane, the hearse.
  function moving(ctx, v, cam) {
    const R = ride(v);
    const c = runner(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    sky(ctx, v, cam);
    hills(ctx, cam, 0.12, 26, 6, "#0b1020", 1.3);
    hills(ctx, cam, 0.22, 20, 5, "#0e1526", 4.1);
    cemetery(ctx, cam);
    roadway(ctx, v, cam, R);
    R.gates.forEach(([a, b]) => {
      if (b > cam - 4 && a < cam + FW + 4) gatePosts(ctx, v, a, b);
    });
    R.checks.forEach((x, i) => {
      if (x > cam - 8 && x < cam + FW + 8) checkpoint(ctx, v, x, i <= c.check);
    });
    if (R.finish > cam - 20 && R.finish < cam + FW + 20) finishGate(ctx, v, R.finish + 16);
    const here = laneNow(c);
    const inRoad = c.done || here === 0;
    lanePass(ctx, v, R, c, cam, 1);
    if (!inRoad) place(ctx, v, c, (x) => hearseBack(ctx, v, c, x));
    lanePass(ctx, v, R, c, cam, 0);
    if (inRoad) place(ctx, v, c, (x) => hearseBack(ctx, v, c, x));
    // A landing's puff of dust.
    const fx = v.fx;
    const land = fx && fx.hearseLand !== undefined ? fx.clock - fx.hearseLand.t0 : 1e9;
    if (land < 380) {
      const p = land / 380;
      ctx.fillStyle = `rgba(150,130,110,${(1 - p) * 0.7})`;
      for (let k = 0; k < 8; k++) disc(ctx, v.round.you.x + (k - 3.5) * 1.1 * (0.6 + p * 1.5), Y(baseOf(c)) - 0.3 - p * (0.8 + rnd(k, 4) * 1.4), 0.3 + p * 0.3);
    }
  }

  // In front of Planny: the cab's door, the lows (branches and the arch), the splinters, the fog, the signs, the gauge.
  function front(ctx, v) {
    const R = ride(v);
    const c = runner(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const round = v.round;
    const cam = Math.round(round.camX * 8) / 8;
    place(ctx, v, c, () => hearseFront(ctx, v, c));
    R.lows.forEach(([x0, x1, lane, kind], i) => {
      if (x1 >= cam - 10 && x0 <= cam + FW + 10) low(ctx, v, x0, x1, lane, kind, i);
    });
    R.fog.forEach(([a, b], i) => {
      if (b > cam - 20 && a < cam + FW + 20) fog(ctx, v, a, b, cam, i);
    });
    if (!c.done && !c.out) for (const t of telegraphs(R, round.you.x, laneNow(c))) glyph(ctx, v, t);
    const bits = v.fx && v.fx.hearseBits;
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
    gauge(ctx, v, c, cam);
  }

  // A low branch (kind 0: a gnarled limb across the lane from a trunk to the right, with moss and hanging chains)
  // or the lychgate arch (kind 1: two stone posts and a tiled roof): its underside is LOW_Y over the lane.
  function low(ctx, v, x0, x1, lane, kind, i) {
    const base = Y(LANE_Y[lane]);
    const under = base - LOW_Y;
    const w = x1 - x0;
    const clock = v.clock;
    if (kind === 1) {
      const top = under - 3.4;
      for (const px of [x0 - 4.4, x1 + 2.8]) {
        ctx.fillStyle = "#6a5a40";
        ctx.fillRect(px, top, 1.6, base - top);
        ctx.fillStyle = "#4a3c28";
        ctx.fillRect(px + 1.0, top, 0.6, base - top);
        ctx.fillStyle = "#8a7a5a";
        ctx.fillRect(px - 0.3, base - 0.5, 2.2, 0.5);
      }
      ctx.fillStyle = "#3a2c1e";
      ctx.fillRect(x0 - 4.7, top + 2.4, w + 9.4, 1.0);
      // The pitched, tiled roof.
      ctx.fillStyle = "#2a2230";
      poly(ctx, [[x0 - 5.6, top + 2.4], [(x0 + x1) / 2, top - 2.2], [x1 + 5.6, top + 2.4]]);
      ctx.fill();
      ctx.strokeStyle = "#171320";
      ctx.lineWidth = 0.12;
      for (let k = 1; k < 4; k++) seg(ctx, x0 - 5.6 + k * 0.8, top + 2.4 - k * 0.9, x1 + 5.6 - k * 0.8, top + 2.4 - k * 0.9);
      ctx.fillStyle = "#5a5a66";
      ctx.fillRect((x0 + x1) / 2 - 0.2, top - 3.0, 0.4, 1.2);
      ctx.fillRect((x0 + x1) / 2 - 0.8, top - 2.6, 1.6, 0.35);
      // A lamp hanging from the beam.
      const mx = (x0 + x1) / 2;
      ctx.strokeStyle = "#2a2a34";
      ctx.lineWidth = 0.12;
      seg(ctx, mx, top + 3.4, mx, top + 4.2);
      ctx.fillStyle = "#ffcf5a";
      ctx.globalAlpha = 0.75 + 0.2 * Math.sin(clock / 150 + i);
      ctx.fillRect(mx - 0.35, top + 4.2, 0.7, 0.9);
      ctx.globalAlpha = 1;
      halo(ctx, mx, top + 4.6, 4.4, "rgba(255,200,90,0.9)", 0.3);
      return;
    }
    const tx = x1 + 3.6;
    ctx.lineCap = "round";
    for (const [col, extra] of [["rgba(170,190,230,0.4)", 0.3], ["#150f0a", 0]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.75 + extra;
      ctx.beginPath();
      ctx.moveTo(tx, FH + 1);
      ctx.quadraticCurveTo(tx + 0.6, under + 6, tx - 0.4, under - 2.4);
      ctx.stroke();
      ctx.lineWidth = 0.95 + extra;
      ctx.beginPath();
      ctx.moveTo(tx - 0.2, under - 1.0);
      ctx.quadraticCurveTo(x1 - 1, under - 1.6, x0 - 3.2, under - 0.5);
      ctx.stroke();
    }
    ctx.strokeStyle = "#150f0a";
    ctx.lineWidth = 0.45;
    seg(ctx, x0 + 1.5, under - 0.8, x0 - 0.5, under + 0.55);
    seg(ctx, x0 - 2.4, under - 0.45, x0 - 3.6, under + 0.7);
    seg(ctx, x1 - 1, under - 1.4, x1 - 1.8, under - 3.6);
    ctx.lineCap = "butt";
    // Moss and rotted rope dangling from the limb.
    for (let k = 0; k < 6; k++) {
      const hx = x0 - 2.7 + k * (w + 4.5) / 5;
      const len = 0.9 + rnd(i * 9 + k, 2) * 1.5;
      const sway = Math.sin(clock / 500 + hx) * 0.2;
      ctx.strokeStyle = k % 2 ? "#3b4d2c" : "#2a3a20";
      ctx.lineWidth = 0.18;
      seg(ctx, hx, under - 0.3, hx + sway, under + len);
    }
    ctx.strokeStyle = "#7a7a84";
    ctx.lineWidth = 0.1;
    seg(ctx, x0 + w / 2, under - 0.4, x0 + w / 2 + 0.2, under + 1.6);
    ctx.fillStyle = "#7a7a84";
    ctx.fillRect(x0 + w / 2 - 0.2, under + 1.6, 0.6, 0.4);
  }

  const dim = (v) => {
    const c = runner(v);
    return c && c.out ? 0.8 : 0;
  };

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const c = runner(v);
    if (!R || !c) return;
    const round = v.round;
    const you = round.you;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    // The headlamp's pool on the road ahead, and the lamp's warmth over the hearse; both shrink with the lamp.
    const f = c.out ? 0.2 : 0.55 + 0.45 * (c.lamp / LAMP_MAX);
    add(you.x + 6, you.y + 2.4, 14 * f + 3, 0.7);
    add(you.x - 3, you.y + 3, 9 * f + 2, 0.5);
    R.lanterns.forEach(([x, l], i) => {
      if (x > lo && x < hi && !c.lit[i]) add(x, LANE_Y[l] + 3.9, 7, 0.55);
    });
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 3, 26, 9, i <= round.runner.check ? 0.55 : 0.4);
    });
    R.gates.forEach(([a, b]) => {
      if (b > lo && a < hi) {
        add(a - 0.4, ROAD + 5, 5, 0.35);
        add(b + 0.4, ROAD + 5, 5, 0.35);
      }
    });
    R.hands.forEach(([x, l], i) => {
      const h = c.hands[i];
      if (x > lo && x < hi && (h.state === "up" || h.state === "warn")) add(x, LANE_Y[l] + 2, 4, 0.3);
    });
    for (const s of c.sitters) if (s.state === "sit") add(s.x, LANE_Y[s.lane] + 2, 5, 0.4);
    R.lows.forEach(([x0, x1, l, kind]) => {
      if (kind && x1 > lo && x0 < hi) add((x0 + x1) / 2, LANE_Y[l] + 6.5, 6, 0.4);
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
  // Splinters of wood and bone flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.hearseBits = (fx.hearseBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.hearseBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    if (e.type === "hearseDuck" && !gateOnce(fx, "hearseDuckMs", 160)) return true;
    say(tone, voice[0], voice[1], 0.5);
    const DUST = "#8a7a66";
    switch (e.type) {
      case "hearseJump":
        burst(e.x, e.y, DUST, 5, 7, 300);
        break;
      case "hearseLand":
        fx.hearseLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, DUST, e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(180, 0.45);
        break;
      case "hearseSwitch":
        burst(e.x, e.y, DUST, 6, 8, 320);
        float(e.x, e.y + 6, e.to ? "Verge" : "Road", "#7dffa0", 2);
        break;
      case "hearseCrash":
        shake(320, 1);
        flash("#ffd9a0", 200);
        burst(e.x, e.y + 1, e.what === "stone" || e.what === "cross" ? STONE_C : "#6a4528", 18, 17, 520);
        burst(e.x, e.y + 1, DUST, 8, 14, 360);
        if (e.what === "wreck") splinter(fx, e.x, e.y + 2, ["#2a1e14", "#4a3c28", "#3b4d2c"]);
        break;
      case "hearseCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "hearseFinish":
        shake(240, 0.6);
        burst(e.x, e.y, DUST, 14, 13, 560);
        float(e.x, e.y + 6, "Made it!", GOLD, 2.6);
        break;
      case "hearseHandWarn":
        burst(e.x, e.y + 0.5, SOIL, 5, 4, 460);
        break;
      case "hearseHandUp":
        burst(e.x, e.y + 1, SOIL, 8, 8, 360);
        break;
      case "hearseHandHit":
        burst(e.x, e.y, "#7a8a64", 5, 9, 280);
        break;
      case "hearseHandBreak":
        burst(e.x, e.y, "#7a8a64", 14, 14, 480);
        splinter(fx, e.x, e.y, [BONE, "#7a8a64"]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "hearseCrowWake":
        burst(e.x, e.y, "#2c2836", 6, 8, 340);
        break;
      case "hearseCrowHit":
        burst(e.x, e.y, "#2c2836", 14, 13, 460);
        burst(e.x, e.y, "#5a5470", 8, 10, 380);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "hearseLantern":
        burst(e.x, e.y, "#ffcf5a", 10, 9, 420);
        float(e.x, e.y + 3, "Lamp", "#ffe27a", 2);
        break;
      case "hearseLampOut":
        flash("#05060c", 260);
        float(e.x, e.y + 8, "The lamp is out!", "#ff6a6a", 2.4);
        break;
      case "hearseLampLit":
        flash("#ffe9a0", 160);
        ring(e.x, e.y + 3, "#ffe27a", 1, 9, 420);
        break;
      case "hearseCoffin":
        shake(160, 0.5);
        burst(e.x, e.y, "#6a4528", 8, 12, 400);
        float(e.x, e.y + 5, e.left ? "A coffin flies!" : "The last coffin!", "#ffb02e", 2.2);
        break;
      case "hearseSitUp":
        burst(e.x, e.y + 1, DUST, 8, 8, 400);
        ring(e.x, e.y + 2, "#a9b89c", 1, 6, 400);
        break;
      case "hearseSitHit":
        burst(e.x, e.y, "#a9b89c", 14, 14, 480);
        splinter(fx, e.x, e.y, [BONE, "#6a4528"]);
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

