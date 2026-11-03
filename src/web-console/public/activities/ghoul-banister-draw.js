// Plan2Code Web Console - Ghoul Rush's Grand Banister, its drawing: a night ride down the Manor's grand staircase on its endless polished banister. A wall of damask and moonlit windows, a zig-zag of staircase flights and landings behind you, portraits whose eyes follow YOU, the mahogany handrail on its balusters (and the brass under-rail where the track splits), vases and candlesticks on the rail, hanging portrait frames, chandeliers swinging on a visible pendulum, ghostly butlers with silver trays, cobwebs, the attic landing at the start and the foyer at the end.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain
// data; banisterArt(d) takes ghoul-draw.js's drawing helpers (`d`) and hands back the drawing by
// kind, so this file never reaches back into it. Drawn in room units, the way ghoul-draw.js draws:
// y counted down from the field's top, so a world height `y` is drawn at `FIELD_H - y`. The still
// layers' pit is dark under the whole ride, so the wall, the stairs, the rail and what stands on
// it are drawn by `moving` (every frame, over the cached still layers); the hanging frames, the
// chandeliers, the sparks off your feet and the telegraphs by `front`. No random numbers:
// everything comes from a hash. What the art reads off the rules (ghoul-banister.js):
//
// - the room: `spec.ride` ({ track, rails, props, lows, swings, butlers, webs, checks, finish }),
//   `spec.ground` (the attic landing at the start and the foyer floor at the end), `spec.door`.
// - `round.runner` (id "banister"; null in any other room): `v`, `line` (-1 in the air), `check`,
//   `done`, `clock` (the pendulums' time), `dive`, `butlers` [{ state "wait" | "warn" | "lunge" |
//   "broken" | "spent", t, x }], `webs` ["up" | "torn" | "shot"].
// - YOU: `you.state`, `you.vy`, `you.ducking`, `you.x`, `you.y` (the portraits' eyes follow).
// - events leave short-lived bits in the view's `fx` (`banBits`, `banLand`).

import { linesOf, trackY } from "./ghoul-cart.js";
import { BUTLER_H, CANDLE_H, SWING_BOB_W, WEB_HI, WEB_LO, lowerLine, swingAt } from "./ghoul-banister.js";
import { ANSWER_COLORS, TELEGRAPH_ALPHA, TELEGRAPH_FULL, TELEGRAPH_SEE, TELEGRAPH_WORDS } from "./ghoul-sled-draw.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "banister", custom: true, noMoon: true, pit: "#0a0610", ...o });
export const LOOKS = freeze({
  banister: pit({ wallTop: "#1a0b12", wallLow: "#2f1220", paper: "#3d1828", wainscot: "#1c0d12", floorTop: "#8a6a44", floor: "#3a2616", floorEdge: "#140a0c", shelf: "#3a2616", shelfTop: "#8a6a44", window: "#cfd8ff", decor: "stairs", color: "#d9a35a", dark: 0.45 }),
});

// How each new kind sounds, by act (the sounds are in ghoul-sfx-banister.js).
export const VOICES = freeze({
  ban: freeze({ jump: "ghoulBanJump", land: "ghoulBanLand", launch: "ghoulBanLaunch", duck: "ghoulBanDuck", switch: "ghoulBanSwitch", crash: "ghoulBanCrash", check: "ghoulBanCheck", finish: "ghoulBanFinish" }),
  banbutler: freeze({ warn: "ghoulBanButlerWarn", lunge: "ghoulBanButlerLunge", hit: "ghoulBanButlerHit", break: "ghoulBanButlerBreak" }),
  banweb: freeze({ tear: "ghoulBanWebTear", shot: "ghoulBanWebShot" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  banJump: ["ban", "jump"],
  banLand: ["ban", "land"],
  banLaunch: ["ban", "launch"],
  banDuck: ["ban", "duck"],
  banSwitch: ["ban", "switch"],
  banCrash: ["ban", "crash"],
  banCheck: ["ban", "check"],
  banFinish: ["ban", "finish"],
  banButlerWarn: ["banbutler", "warn"],
  banButlerLunge: ["banbutler", "lunge"],
  banButlerHit: ["banbutler", "hit"],
  banButlerBreak: ["banbutler", "break"],
  banWebTear: ["banweb", "tear"],
  banWebShot: ["banweb", "shot"],
});
export const LOSE_WORDS = freeze({ vase: "Smashed a vase", candle: "Hit a candlestick", frame: "Hit a hanging frame", swing: "Struck by the chandelier", butler: "Tray to the face", plunge: "Fell off the banister" });
export const LOSE_SOUNDS = freeze({
  vase: ["smash", 0.6, 1.2],
  candle: ["clank", 0.5, 1.1],
  frame: ["thud", 0.6, 0.9],
  swing: ["smash", 0.6, 0.7],
  butler: ["clank", 0.6, 0.7],
  plunge: ["ghoulPitFall", 0.55, 0.9],
});

const FW = 96;
const BAN_V = 46;
const DUCK_H = 2.4;
const WOOD = "#6b2f1a";
const WOOD_D = "#2a0f0a";
const WOOD_L = "#e0a070";
const BRASS = "#d9b050";
const BRASS_L = "#fff0b0";
const GHOST = "#b8d0ec";
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

// A soft glow at a light.
const HALO = freeze({ warm: "255,190,100", red: "255,70,50", green: "90,240,130", cold: "170,200,255", gold: "255,220,130" });
function halo(ctx, kind, x, y, r, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgrad(ctx, x, y, r, [[0, `rgba(${HALO[kind]},0.9)`], [0.4, `rgba(${HALO[kind]},0.3)`], [1, `rgba(${HALO[kind]},0)`]]);
  disc(ctx, x, y, r);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ the rails */

// The y of a line at x (null off its ends).
const yOf = (R, line, x) => trackY(R, line, x);
// The handrail's height at x (null over a break).
const heightAt = (R, x) => {
  let best = null;
  for (let i = 0; i < R.rails; i++) {
    const y = trackY(R, i, x);
    if (y !== null && (best === null || y > best)) best = y;
  }
  return best;
};

// The points of line `line` over [xa, xb] (its own, and the ends clipped to the range).
function pathOf(R, line, xa, xb) {
  const L = linesOf(R)[line];
  const lo = Math.max(xa, L.x0);
  const hi = Math.min(xb, L.x1);
  if (hi <= lo) return [];
  const out = [[lo, trackY(R, line, lo)]];
  for (const [px, py] of L.pts) if (px > lo + 0.01 && px < hi - 0.01) out.push([px, py]);
  out.push([hi, trackY(R, line, hi)]);
  return out;
}

/* ------------------------------------------------------------ telegraphs */

export const ANSWERS = freeze({ gap: "JUMP", vase: "JUMP", candle: "JUMP", frame: "DUCK", swing: "DUCK", end: "JUMP", dive: "DIVE" });
export const COLORS = freeze({ ...ANSWER_COLORS, DIVE: "#d28bff" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lead (where it begins), x (its middle), up (height of
// the glyph's anchor), n (which of its kind), answer }, in the room's order. Butlers and webs are
// shot, so they get none; the under-rails get a DIVE at their start and a JUMP at their end.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lead, x, up) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lead, x, up, n, answer: ANSWERS[kind] });
  };
  for (let i = 0; i + 1 < R.rails; i++) {
    const a = R.track[i].at(-1)[0];
    const b = R.track[i + 1][0][0];
    add("gap", a, (a + b) / 2, Math.max(heightAt(R, a - 0.1) ?? 0, heightAt(R, b + 0.1) ?? 0) + 6.5);
  }
  for (const [x, line, kind] of R.props) add(kind ? "candle" : "vase", x - 2, x, (yOf(R, line, x) ?? 10) + 7.5);
  for (const [x0, x1, y] of R.lows) add("frame", x0 - 3.2, (x0 + x1) / 2, y + 6.8);
  for (const [cx, line, amp] of R.swings) add("swing", cx - amp - 4, cx, (yOf(R, line, cx) ?? 10) + 9);
  for (let i = R.rails; i < R.track.length; i++) {
    const L = linesOf(R)[i];
    add("dive", L.x0 - 14, L.x0 + 4, (heightAt(R, L.x0 + 4) ?? 20) + 7);
    add("end", L.x1 - 7, L.x1 - 2, L.pts.at(-1)[1] + 6.5);
  }
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with you at `x`: { ...mark, alpha (0..1, before the pulse), words }.
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

export function banisterArt(d) {
  const { ellipse, say, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "banister" ? v.spec.ride : null);
  const state = (v) => (v.round && v.round.runner && v.round.runner.id === "banister" ? v.round.runner : null);
  const sy = (y) => FH - y;
  // Calls fn(x, k) for each repeat of a layer of spacing `W` at parallax `par` (1 moves with the rail).
  const strips = (cam, par, W, w, fn) => {
    const ox = cam * (1 - par);
    const k0 = Math.floor((cam - ox - w) / W);
    const k1 = Math.floor((cam + FW - ox) / W);
    for (let k = k0; k <= k1; k++) fn(ox + k * W, k);
  };

  /* ------------------------------------------------------------- the room */

  // The still layers only get the wall's color: the hall is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The attic landing at the start (bare boards, a trunk) and the foyer floor at the end (marble).
  function ground(ctx, v, look, a, b, top) {
    const y = v.g.FIELD_H - top;
    const foyer = a > 100;
    ctx.fillStyle = vgrad(ctx, y, y + top, foyer ? [[0, "#d8d2c8"], [0.2, "#8e8878"], [1, "#2a2620"]] : [[0, "#8a6a44"], [0.2, "#4a3420"], [1, "#1c120a"]]);
    ctx.fillRect(a, y, b - a, top + 2);
    if (foyer) {
      ctx.fillStyle = "rgba(20,18,16,0.55)";
      for (let x = Math.floor(a / 4) * 4, k = 0; x < b; x += 4, k++) if (k % 2 === 0) ctx.fillRect(x, y, 4, 1.6);
    } else {
      ctx.strokeStyle = "rgba(20,10,4,0.7)";
      ctx.lineWidth = 0.12;
      for (let x = a; x < b; x += 3.5) seg(ctx, x, y, x, y + 1.8);
    }
    ctx.fillStyle = foyer ? "#f2ece0" : "#b08a58";
    ctx.fillRect(a, y, b - a, 0.3);
  }
  function shelf() {}

  // The wall: damask in stripes, gilt dado, and the moonlit tall windows with their shafts.
  function wall(ctx, cam, clock) {
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#12070d"], [0.5, "#2c1120"], [1, "#150910"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    strips(cam, 0.9, 6, 1, (x, k) => {
      ctx.fillStyle = k % 2 ? "rgba(90,30,48,0.28)" : "rgba(30,10,20,0.3)";
      ctx.fillRect(x, 0, 3, FH);
      ctx.fillStyle = "rgba(200,150,90,0.1)";
      for (let q = 0; q < 6; q++) {
        poly(ctx, [[x + 1.5, 4 + q * 8], [x + 2.2, 5.2 + q * 8], [x + 1.5, 6.4 + q * 8], [x + 0.8, 5.2 + q * 8]]);
        ctx.fill();
      }
    });
    strips(cam, 0.55, 72, 8, (x, k) => {
      const wx = x + 30;
      ctx.fillStyle = "rgba(150,170,230,0.07)";
      poly(ctx, [[wx - 3, 8], [wx + 3, 8], [wx + 16, FH], [wx - 10, FH]]);
      ctx.fill();
      ctx.fillStyle = vgrad(ctx, 5, 30, [[0, "#9db4e8"], [1, "#2c3a66"]]);
      ctx.beginPath();
      ctx.moveTo(wx - 3.6, 30);
      ctx.lineTo(wx - 3.6, 12);
      ctx.arc(wx, 12, 3.6, Math.PI, 0);
      ctx.lineTo(wx + 3.6, 30);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#1a0d12";
      ctx.lineWidth = 0.35;
      ctx.stroke();
      seg(ctx, wx, 8.4, wx, 30);
      seg(ctx, wx - 3.6, 17, wx + 3.6, 17);
      seg(ctx, wx - 3.6, 23, wx + 3.6, 23);
      // A tall drape each side.
      ctx.fillStyle = "#4a1020";
      poly(ctx, [[wx - 6.4, 5], [wx - 4, 5], [wx - 4.6, 34], [wx - 7.4, 34]]);
      ctx.fill();
      poly(ctx, [[wx + 4, 5], [wx + 6.4, 5], [wx + 7.4, 34], [wx + 4.6, 34]]);
      ctx.fill();
    });
    // Dust in the shafts.
    for (let q = 0; q < 14; q++) {
      const p = (clock / (5200 + (q % 5) * 700) + rnd(q, 1)) % 1;
      const mx = cam + ((((rnd(q, 2) * FW - cam * 0.5 - p * 6) % FW) + FW) % FW);
      ctx.fillStyle = `rgba(220,226,255,${0.15 + 0.2 * rnd(q, 3)})`;
      ctx.fillRect(mx, 6 + p * 40, 0.22, 0.22);
    }
  }

  // A portrait in a gilt frame whose eyes follow YOU: centered (x, y) in screen units, w by h.
  function portrait(ctx, x, y, w, h, n, tx, ty, lit) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x - w / 2 + 0.4, y - h / 2 + 0.4, w, h);
    ctx.fillStyle = lit ? "#b88a30" : "#8a6420";
    ctx.fillRect(x - w / 2, y - h / 2, w, h);
    ctx.fillStyle = "#3a2a10";
    ctx.fillRect(x - w / 2 + 0.55, y - h / 2 + 0.55, w - 1.1, h - 1.1);
    const tone = ["#14100e", "#101418", "#18100e"][n % 3];
    ctx.fillStyle = tone;
    ctx.fillRect(x - w / 2 + 0.8, y - h / 2 + 0.8, w - 1.6, h - 1.6);
    // The sitter: a dark coat, a pale face, and eyes that look at you.
    ctx.fillStyle = ["#2a2036", "#2c1c1c", "#1c2a30"][n % 3];
    poly(ctx, [[x - w * 0.34, y + h / 2 - 0.8], [x - w * 0.22, y + h * 0.1], [x + w * 0.22, y + h * 0.1], [x + w * 0.34, y + h / 2 - 0.8]]);
    ctx.fill();
    ctx.fillStyle = "#cfc4a8";
    ellipse(ctx, x, y - h * 0.08, w * 0.19, h * 0.2);
    ctx.fill();
    const ex = w * 0.085;
    const ey = y - h * 0.11;
    const dx = tx - x;
    const dy = ty - ey;
    const len = Math.hypot(dx, dy) || 1;
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#f4efe0";
      ellipse(ctx, x + s * ex, ey, w * 0.06, w * 0.04);
      ctx.fill();
      ctx.fillStyle = "#120808";
      disc(ctx, x + s * ex + (dx / len) * w * 0.026, ey + (dy / len) * w * 0.016, w * 0.024);
    }
    ctx.strokeStyle = "#5a4a3a";
    ctx.lineWidth = 0.14;
    seg(ctx, x - w * 0.06, y + h * 0.02, x + w * 0.06, y + h * 0.02);
  }

  // The grand staircase behind you: switchback flights and landings stacked in a zig-zag, each a
  // dark mass with a stepped edge, a rail and balusters; a block of it every 150 units.
  function stairHall(ctx, cam) {
    strips(cam, 0.4, 150, 140, (ox) => {
      const flights = [[ox + 6, 18, ox + 118, 30], [ox + 134, 31, ox + 22, 43], [ox + 6, 44.5, ox + 118, 56]];
      flights.forEach(([x0, y0, x1, y1], f) => {
        const dir = Math.sign(x1 - x0);
        // The mass under the flight, stepped.
        ctx.fillStyle = f % 2 ? "#190a12" : "#210e18";
        ctx.beginPath();
        ctx.moveTo(x0, y0 + 9);
        for (let s = 0; s <= 28; s++) {
          const t = s / 28;
          ctx.lineTo(x0 + (x1 - x0) * t, y0 + (y1 - y0) * Math.floor(t * 28) / 28);
          ctx.lineTo(x0 + (x1 - x0) * Math.min(1, (s + 1) / 28), y0 + (y1 - y0) * Math.floor(t * 28) / 28);
        }
        ctx.lineTo(x1, y1 + 9);
        ctx.closePath();
        ctx.fill();
        // The tread edges catch the moon.
        ctx.strokeStyle = "rgba(190,170,210,0.28)";
        ctx.lineWidth = 0.18;
        for (let s = 0; s <= 28; s += 2) {
          const t = s / 28;
          seg(ctx, x0 + (x1 - x0) * t, y0 + (y1 - y0) * Math.floor(t * 28) / 28, x0 + (x1 - x0) * Math.min(1, (s + 1) / 28), y0 + (y1 - y0) * Math.floor(t * 28) / 28);
        }
        // Its own rail and balusters above.
        ctx.strokeStyle = "#5a2a22";
        ctx.lineWidth = 0.6;
        seg(ctx, x0, y0 - 5, x1, y1 - 5);
        ctx.strokeStyle = "#3a1a18";
        ctx.lineWidth = 0.3;
        for (let s = 0; s <= 14; s++) seg(ctx, x0 + (x1 - x0) * (s / 14), y0 + (y1 - y0) * (s / 14) - 5, x0 + (x1 - x0) * (s / 14), y0 + (y1 - y0) * (s / 14));
        // The landing past the end of it, with a newel post.
        ctx.fillStyle = "#2c1420";
        ctx.fillRect(Math.min(x1, x1 + dir * 16), y1, 16, 1.6);
        ctx.fillStyle = "#5a2a22";
        ctx.fillRect(x1 + dir * 14 - 0.5, y1 - 6, 1, 6);
        disc(ctx, x1 + dir * 14, y1 - 6.4, 0.7);
      });
    });
  }

  // The rail itself: mahogany on its balusters (the handrail), and the brass under-rail beside it.
  function rails(ctx, v, R, cam) {
    const lo = cam - 6;
    const hi = cam + FW + 6;
    const lines = linesOf(R);
    // The stringer and balusters under each handrail line.
    for (let i = 0; i < R.rails; i++) {
      const L = lines[i];
      if (L.x1 < lo || L.x0 > hi) continue;
      const pts = pathOf(R, i, lo, hi);
      if (pts.length < 2) continue;
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + 5.2) : ctx.moveTo(x, sy(y) + 5.2)));
      ctx.stroke();
      ctx.strokeStyle = "#4a1e16";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + 4.9) : ctx.moveTo(x, sy(y) + 4.9)));
      ctx.stroke();
      for (let x = Math.ceil(Math.max(lo, L.x0 + 1) / 3.2) * 3.2; x < Math.min(hi, L.x1 - 0.5); x += 3.2) {
        const y = sy(trackY(R, i, x));
        ctx.strokeStyle = "#3a160f";
        ctx.lineWidth = 0.36;
        seg(ctx, x, y + 0.5, x, y + 5);
        ctx.fillStyle = "#4e2016";
        ellipse(ctx, x, y + 2.3, 0.5, 0.75);
        ctx.fill();
      }
    }
    // The handrails: a dark underside, the wood, a bright line along the top.
    for (let i = 0; i < R.rails; i++) {
      const L = lines[i];
      if (L.x1 < lo || L.x0 > hi) continue;
      const pts = pathOf(R, i, lo, hi);
      if (pts.length < 2) continue;
      const trace = (dy) => {
        ctx.beginPath();
        pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + dy) : ctx.moveTo(x, sy(y) + dy)));
        ctx.stroke();
      };
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = WOOD_D;
      ctx.lineWidth = 1.7;
      trace(0.2);
      ctx.strokeStyle = WOOD;
      ctx.lineWidth = 1.35;
      trace(0);
      ctx.strokeStyle = WOOD_L;
      ctx.lineWidth = 0.28;
      trace(-0.42);
      ctx.lineCap = "butt";
      // The ends: a newel post and a ragged broken stub (not at the very first or last).
      for (const end of [L.x0, L.x1]) {
        if (end < lo || end > hi) continue;
        if (end === L.x0 && i === 0) continue;
        if (end === L.x1 && i === R.rails - 1) continue;
        const y = sy(trackY(R, i, end));
        const left = end === L.x1;
        ctx.fillStyle = "#4a1e16";
        ctx.fillRect(end - 0.55, y - 1.4, 1.1, 7.2);
        ctx.fillStyle = "#6b2f1a";
        disc(ctx, end, y - 1.7, 0.85);
        ctx.fillStyle = WOOD_D;
        for (let q = 0; q < 3; q++) {
          poly(ctx, [[end, y - 0.2 + q * 0.5], [end + (left ? 1.4 : -1.4) * (1 + q * 0.3), y + 0.1 + q * 0.5], [end, y + 0.5 + q * 0.5]]);
          ctx.fill();
        }
      }
    }
    // The brass under-rails.
    for (let i = R.rails; i < R.track.length; i++) {
      const L = lines[i];
      if (L.x1 < lo || L.x0 > hi) continue;
      const pts = pathOf(R, i, lo, hi);
      if (pts.length < 2) continue;
      const trace = (dy) => {
        ctx.beginPath();
        pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + dy) : ctx.moveTo(x, sy(y) + dy)));
        ctx.stroke();
      };
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 1.1;
      trace(0.3);
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 0.8;
      trace(0);
      ctx.strokeStyle = BRASS_L;
      ctx.lineWidth = 0.18;
      trace(-0.25);
      ctx.lineCap = "butt";
      for (let x = Math.ceil(Math.max(lo, L.x0 + 2) / 9) * 9; x < Math.min(hi, L.x1 - 1); x += 9) {
        const y = sy(trackY(R, i, x));
        ctx.fillStyle = "#8a6a2c";
        ctx.fillRect(x - 0.3, y + 0.3, 0.6, 2.4);
        disc(ctx, x, y + 0.2, 0.55);
      }
      // The end hangs in the air: a flare of brass.
      const end = L.x1;
      if (end > lo && end < hi) {
        const y = sy(L.pts.at(-1)[1]);
        ctx.fillStyle = BRASS;
        disc(ctx, end, y, 0.75);
        ctx.fillStyle = BRASS_L;
        disc(ctx, end - 0.2, y - 0.2, 0.25);
      }
    }
  }

  /* ------------------------------------------------------------ the things */

  // A vase (kind 0): a blue and white urn with handles; a candlestick (kind 1): a brass stick with a flame.
  function prop(ctx, v, x, base, kind, i) {
    const clock = v.clock;
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, x + 0.3, base + 0.1, 1.7, 0.3);
    ctx.fill();
    if (kind === 0) {
      ctx.fillStyle = "#e8eef8";
      ctx.beginPath();
      ctx.moveTo(x - 0.8, base);
      ctx.bezierCurveTo(x - 1.9, base - 1.2, x - 1.6, base - 2.4, x - 0.7, base - 2.7);
      ctx.lineTo(x - 0.9, base - 3.4);
      ctx.lineTo(x + 0.9, base - 3.4);
      ctx.lineTo(x + 0.7, base - 2.7);
      ctx.bezierCurveTo(x + 1.6, base - 2.4, x + 1.9, base - 1.2, x + 0.8, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#3a5ca8";
      ctx.fillRect(x - 1.5, base - 1.9, 3, 0.5);
      poly(ctx, [[x - 0.5, base - 1.2], [x, base - 0.6], [x + 0.5, base - 1.2], [x, base - 1.8]]);
      ctx.fill();
      ctx.strokeStyle = "#e8eef8";
      ctx.lineWidth = 0.25;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(x + s * 1.2, base - 2.9, 0.7, s > 0 ? -1.3 : Math.PI + 1.3, s > 0 ? 1.4 : Math.PI - 1.4, s < 0);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(10,16,40,0.25)";
      ctx.fillRect(x + 0.2, base - 2.5, 0.7, 2.4);
      return;
    }
    ctx.fillStyle = BRASS;
    ctx.fillRect(x - 0.18, base - CANDLE_H + 1.2, 0.36, CANDLE_H - 1.8);
    ellipse(ctx, x, base - 0.3, 0.8, 0.35);
    ctx.fill();
    ellipse(ctx, x, base - 2.6, 0.38, 0.55);
    ctx.fill();
    ctx.fillStyle = "#f0e8d2";
    ctx.fillRect(x - 0.28, base - CANDLE_H + 0.1, 0.56, 1.5);
    const f = 0.8 + 0.2 * Math.sin(clock / 90 + i * 2);
    halo(ctx, "warm", x, base - CANDLE_H - 0.2, 3.6, 0.4 * f);
    ctx.fillStyle = "#ffcf6a";
    ellipse(ctx, x, base - CANDLE_H - 0.15, 0.3 * f, 0.62);
    ctx.fill();
    ctx.fillStyle = "#fff6c8";
    ellipse(ctx, x, base - CANDLE_H - 0.05, 0.14, 0.32);
    ctx.fill();
  }

  // A ghostly butler: pale, translucent, a tailcoat, a bow tie and a silver tray held out.
  function butler(ctx, v, b, line, R, i) {
    if (b.state === "broken" || b.state === "spent") return;
    const clock = v.clock;
    const L = linesOf(R)[line];
    const x = b.x;
    const base = sy(trackY(R, line, clamp(x, L.x0, L.x1)));
    const wait = b.state === "wait";
    const lunge = b.state === "lunge";
    const warn = b.state === "warn";
    const bow = warn ? clamp((500 - b.t) / 260, 0, 1) : lunge ? 1 : 0;
    ctx.save();
    ctx.translate(x, base);
    ctx.globalAlpha = wait ? 0.22 + 0.06 * Math.sin(clock / 300 + i) : lunge ? 0.9 : 0.8;
    ctx.rotate(-0.1 * bow);
    // A trail behind a lunge.
    if (lunge) {
      for (let k = 1; k < 4; k++) {
        ctx.globalAlpha = 0.16 / k;
        ctx.fillStyle = GHOST;
        ctx.fillRect(k * 1.3 - 1, -BUTLER_H + 0.4, 1.8, BUTLER_H - 1);
      }
      ctx.globalAlpha = 0.9;
    }
    const bob = Math.sin(clock / 240 + i) * 0.12;
    ctx.translate(0, bob - 0.2);
    // The tails, the coat, the shirt front and the legs fading to wisps.
    ctx.fillStyle = "#1c2236";
    poly(ctx, [[-1.1, -2.2], [1.1, -2.2], [1.5, -0.4], [0.2, -1.1], [-0.2, -0.2], [-1.4, -0.6]]);
    ctx.fill();
    ctx.fillStyle = "#222a44";
    poly(ctx, [[-1.15, -4.1], [1.15, -4.1], [1.0, -2.1], [-1.0, -2.1]]);
    ctx.fill();
    ctx.fillStyle = "#e8ecf4";
    poly(ctx, [[-0.3, -4.1], [0.3, -4.1], [0.4, -2.4], [-0.4, -2.4]]);
    ctx.fill();
    ctx.fillStyle = "#101828";
    poly(ctx, [[-0.5, -4.1], [0, -3.85], [0.5, -4.1], [0.5, -3.7], [0, -3.95], [-0.5, -3.7]]);
    ctx.fill();
    ctx.fillStyle = GHOST;
    ctx.globalAlpha *= 0.75;
    for (const s of [-0.5, 0.5]) {
      ellipse(ctx, s, -0.7, 0.34, 0.9);
      ctx.fill();
    }
    ctx.globalAlpha = wait ? 0.22 : lunge ? 0.9 : 0.8;
    // The head: long, pale, with hollow glowing eyes and thin hair.
    ctx.fillStyle = "#dfe8f4";
    ellipse(ctx, -0.1 - bow * 0.3, -4.9, 0.72, 0.9);
    ctx.fill();
    ctx.fillStyle = "#8a96ae";
    ctx.fillRect(-0.8 - bow * 0.3, -5.7, 1.4, 0.25);
    ctx.fillStyle = warn || lunge ? "#ff5a3a" : "#7ec8ff";
    disc(ctx, -0.4 - bow * 0.3, -5.0, 0.16);
    disc(ctx, 0.2 - bow * 0.3, -5.0, 0.16);
    // The arm out in front (toward you) holding the tray: raised on a bow, level in a lunge.
    ctx.strokeStyle = "#222a44";
    ctx.lineWidth = 0.45;
    const ty = -3.1 - (warn ? bow * 0.5 : 0);
    seg(ctx, -0.7, -3.7, -2.0 - bow * 0.5, ty);
    // The silver tray, edge on, with a covered dish that gleams.
    ctx.fillStyle = "#e6ecf2";
    ctx.fillRect(-3.4 - bow * 0.5, ty - 0.12, 2.6, 0.26);
    ctx.fillStyle = "#b8c4d4";
    ctx.beginPath();
    ctx.arc(-2.1 - bow * 0.5, ty - 0.12, 0.8, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    disc(ctx, -2.3 - bow * 0.5, ty - 0.55, 0.14);
    ctx.restore();
    if (!wait) halo(ctx, "cold", x, base - 2.5, 4.2, warn ? 0.2 : 0.28);
    // The bow's little "!" over his head.
    if (warn) {
      ctx.fillStyle = "#ff8a6a";
      ctx.fillRect(x - 0.15, base - BUTLER_H - 2.4, 0.3, 1.1);
      ctx.fillRect(x - 0.15, base - BUTLER_H - 1, 0.3, 0.3);
    }
  }

  // A cobweb strung across the rail: spokes and rings, in tatters once torn.
  function web(ctx, x, base, state, i) {
    if (state === "shot") return;
    const cy = base - (WEB_LO + WEB_HI) / 2;
    const r = (WEB_HI - WEB_LO) / 2;
    const torn = state === "torn";
    ctx.strokeStyle = torn ? "rgba(230,230,240,0.35)" : "rgba(235,235,245,0.7)";
    ctx.lineWidth = 0.09;
    const spokes = torn ? 4 : 8;
    for (let s = 0; s < spokes; s++) {
      const a = (s / 8) * TAU + 0.3;
      const rr = torn ? r * (0.4 + 0.5 * rnd(i, s)) : r;
      seg(ctx, x, cy, x + Math.cos(a) * rr * 0.75, cy + Math.sin(a) * rr);
    }
    if (!torn) {
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        for (let s = 0; s <= 8; s++) {
          const a = (s / 8) * TAU + 0.3;
          const rr = r * ring * 0.3 * (1 - 0.1 * Math.sin(s * 2 + i));
          s ? ctx.lineTo(x + Math.cos(a) * rr * 0.75, cy + Math.sin(a) * rr) : ctx.moveTo(x + Math.cos(a) * rr * 0.75, cy + Math.sin(a) * rr);
        }
        ctx.stroke();
      }
      // The anchors to the stairs.
      seg(ctx, x - 1.8, cy - r, x - 3, base - WEB_HI - 1.4);
      seg(ctx, x + 1.8, cy + r, x + 2.4, base + 0.2);
      ctx.fillStyle = "#14080c";
      disc(ctx, x + 0.3, cy - 0.4, 0.2);
    }
  }

  // A lamp on the newel at a checkpoint: flame green once passed.
  function checkpoint(ctx, v, x, base, passed, i) {
    const clock = v.clock;
    ctx.fillStyle = "#3a2410";
    ctx.fillRect(x + 1, base - 4.8, 0.45, 4.8);
    ctx.fillStyle = BRASS;
    ellipse(ctx, x + 1.22, base - 4.8, 0.9, 0.35);
    ctx.fill();
    const f = 0.85 + 0.15 * Math.sin(clock / 110 + i);
    ctx.fillStyle = passed ? "#7dffa0" : "#ffcf6a";
    ellipse(ctx, x + 1.22, base - 5.5, 0.42 * f, 0.75);
    ctx.fill();
    halo(ctx, passed ? "green" : "warm", x + 1.2, base - 5.4, 5, passed ? 0.5 : 0.32);
  }

  // The foyer: a great arched front door at the end, lit from outside.
  function frontDoor(ctx, v, x) {
    const top = sy(10);
    const w = 7;
    halo(ctx, "gold", x, top - 7, 16, 0.5);
    ctx.fillStyle = "#3a1a12";
    ctx.fillRect(x - w - 1, top - 20, (w + 1) * 2, 20);
    ctx.fillStyle = "#6b3a22";
    ctx.beginPath();
    ctx.moveTo(x - w, top);
    ctx.lineTo(x - w, top - 14);
    ctx.arc(x, top - 14, w, Math.PI, 0);
    ctx.lineTo(x + w, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2a1208";
    ctx.lineWidth = 0.3;
    seg(ctx, x, top - 21, x, top);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,220,150,0.25)";
    ctx.beginPath();
    ctx.moveTo(x - w + 1, top);
    ctx.lineTo(x - w + 1, top - 14);
    ctx.arc(x, top - 14, w - 1, Math.PI, 0);
    ctx.lineTo(x + w - 1, top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BRASS;
    disc(ctx, x - 1, top - 8, 0.4);
    disc(ctx, x + 1, top - 8, 0.4);
  }

  /* ---------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const round = v.round;
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const clock = v.clock;
    cam = Math.round(cam * 8) / 8;
    const you = round.you;
    wall(ctx, cam, clock);
    stairHall(ctx, cam);
    // The portraits along the wall, their eyes on YOU.
    strips(cam, 0.8, 44, 8, (x, k) => {
      const w = 5.4 + 1.4 * rnd(k, 5);
      const h = w * 1.3;
      ctx.globalAlpha = 0.62;
      portrait(ctx, x + 22, 8.5 + (k % 3) * 0.6, w, h, k, you.x, sy(you.y) - 2, false);
      ctx.globalAlpha = 1;
    });
    const lo = cam - 8;
    const hi = cam + FW + 8;
    rails(ctx, v, R, cam);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, sy(heightAt(R, x) ?? 10), i <= c.check, i);
    });
    R.webs.forEach(([x, line], i) => {
      if (x > lo && x < hi) web(ctx, x, sy(yOf(R, line, x) ?? 10), c.webs[i], i);
    });
    R.props.forEach(([x, line, kind], i) => {
      if (x > lo && x < hi) prop(ctx, v, x, sy(yOf(R, line, x) ?? 10), kind, i);
    });
    R.butlers.forEach(([hx, line], i) => {
      if (c.butlers[i].x > lo - 4 && c.butlers[i].x < hi && hx < hi + 20) butler(ctx, v, c.butlers[i], line, R, i);
    });
    // The attic landing and the foyer floor, over the wall.
    for (const [a, b, top] of v.spec.ground) if (b > lo && a < hi) ground(ctx, v, LOOKS.banister, a, b, top);
    if (v.spec.door > lo - 8 && v.spec.door < hi + 8) frontDoor(ctx, v, v.spec.door - 6);
    // Dust drifting down in the dark.
    for (let q = 0; q < 10; q++) {
      const p = (clock / (3600 + (q % 4) * 500) + rnd(q, 9)) % 1;
      const mx = cam + ((((rnd(q, 8) * FW - cam * 0.3) % FW) + FW) % FW);
      ctx.fillStyle = "rgba(230,220,200,0.35)";
      ctx.fillRect(mx, p * FH, 0.2, 0.2);
    }
  }

  /* ------------------------------------------------------ the things in front */

  // A hanging portrait frame: two chains from the roof, a gilt frame, a face that watches YOU.
  function frame(ctx, v, x0, x1, y, i, you) {
    const clock = v.clock;
    const w = x1 - x0;
    const top = sy(y) - 4.6;
    const sway = Math.sin(clock / 900 + i * 1.7) * 0.025;
    ctx.save();
    ctx.translate((x0 + x1) / 2, -2);
    ctx.rotate(sway);
    ctx.translate(-(x0 + x1) / 2, 2);
    ctx.strokeStyle = "#8a7a60";
    ctx.lineWidth = 0.18;
    for (const cx of [x0 + 0.9, x1 - 0.9]) {
      ctx.setLineDash && ctx.setLineDash([0.5, 0.35]);
      seg(ctx, cx, -3, cx, top + 0.2);
      ctx.setLineDash && ctx.setLineDash([]);
    }
    portrait(ctx, (x0 + x1) / 2, top + 2.3, w, 4.6, i + 4, you.x, sy(you.y) - 2, true);
    ctx.restore();
    halo(ctx, "warm", (x0 + x1) / 2, sy(y) + 0.4, 4.5, 0.14);
  }

  // A chandelier on its pendulum: the chain from the roof, the arc it swings through marked in
  // dots, the bob lit red while it hangs too low to duck under, amber while it is safe to.
  function chandelier(ctx, v, R, i, c) {
    const [cx, line, amp] = R.swings[i];
    const clock = v.clock;
    const s = swingAt(R, i, c.clock);
    const bx = s.x;
    const by = sy(s.bottom) - 1.4;
    const rail = yOf(R, line, clamp(bx, linesOf(R)[line].x0, linesOf(R)[line].x1)) ?? 10;
    const lethal = s.bottom < rail + DUCK_H + 0.35;
    // The arc it swings through, dotted, so the beat can be read ahead of it.
    for (let k = -6; k <= 6; k++) {
      const u = k / 6;
      const bottom = (yOf(R, line, clamp(cx + amp * u, linesOf(R)[line].x0, linesOf(R)[line].x1)) ?? 10) + 2.2 + 3 * u * u;
      ctx.fillStyle = Math.abs(u) < 0.32 ? "rgba(255,110,90,0.55)" : "rgba(255,210,130,0.4)";
      disc(ctx, cx + amp * u, sy(bottom) - 1.4, 0.16);
    }
    // The chain.
    ctx.strokeStyle = "#a89870";
    ctx.lineWidth = 0.22;
    ctx.setLineDash && ctx.setLineDash([0.55, 0.3]);
    seg(ctx, cx, -12, bx, by - 1.1);
    ctx.setLineDash && ctx.setLineDash([]);
    halo(ctx, lethal ? "red" : "gold", bx, by, 8, lethal ? 0.4 : 0.28);
    // The bob: a cap, two tiers of arms, five candles, crystal drops (drawn a third bigger than its box, so it reads at a glance).
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(1.3, 1.3);
    ctx.translate(-bx, -by);
    ctx.fillStyle = BRASS;
    ellipse(ctx, bx, by - 1.0, 0.5, 0.4);
    ctx.fill();
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 0.3;
    for (const [rx, ry, dy] of [[SWING_BOB_W / 2, 0.55, 0.2], [SWING_BOB_W / 3, 0.4, -0.5]]) {
      ctx.beginPath();
      ctx.ellipse ? ctx.ellipse(bx, by + dy, rx, ry, 0, 0, Math.PI) : ctx.arc(bx, by + dy, rx, 0, Math.PI);
      ctx.stroke();
    }
    seg(ctx, bx, by - 0.8, bx, by + 0.9);
    for (let k = -2; k <= 2; k++) {
      const px = bx + k * (SWING_BOB_W / 5);
      ctx.fillStyle = "#f0e8d2";
      ctx.fillRect(px - 0.14, by - 1.3 + Math.abs(k) * 0.12, 0.28, 0.9);
      const f = 0.8 + 0.2 * Math.sin(clock / 80 + k * 2 + i);
      ctx.fillStyle = "#ffcf6a";
      ellipse(ctx, px, by - 1.5 + Math.abs(k) * 0.12, 0.2 * f, 0.4);
      ctx.fill();
      ctx.fillStyle = "rgba(220,240,255,0.85)";
      poly(ctx, [[px - 0.12, by + 0.7], [px, by + 1.35 + 0.15 * Math.abs(k)], [px + 0.12, by + 0.7]]);
      ctx.fill();
    }
    ctx.restore();
  }

  // A glyph over an obstacle: chevrons and (for the first few of a kind) the word.
  function glyph(ctx, v, t) {
    const up = t.answer === "JUMP";
    const dive = t.answer === "DIVE";
    const col = COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const bob = Math.sin(v.clock / 260 + t.lead) * 0.35 * (up ? -1 : 1);
    const cy = Math.min(FH - 7, FH - t.up) + bob;
    const dir = up ? -1 : 1;
    const ay = cy + (up ? -2.6 : 2.6);
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [pass, w, c] of [[0, 1.3, "rgba(8,2,6,0.8)"], [1, 0.6, col]]) {
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

  // Sparks and wood shavings off the rail under your feet, longer the faster you go.
  function sparks(ctx, v, R, c) {
    const you = v.round.you;
    const clock = v.clock;
    const lower = lowerLine(R, c.line);
    for (let k = 0; k < 12; k++) {
      const p = (clock / (300 + (k % 4) * 60) + k * 0.113) % 1;
      const x = you.x - 0.6 - p * (2.5 + (c.v / BAN_V) * 3.5) * (0.6 + rnd(k, 1));
      const y = yOf(R, c.line, x) ?? you.y;
      ctx.fillStyle = lower ? `rgba(255,230,140,${(1 - p) * 0.9})` : `rgba(255,190,110,${(1 - p) * 0.8})`;
      disc(ctx, x, sy(y) - 0.25 - p * (0.6 + rnd(k, 2) * 1.6), 0.12 + (1 - p) * 0.14);
    }
    ctx.strokeStyle = lower ? "rgba(255,240,170,0.5)" : "rgba(255,220,170,0.4)";
    ctx.lineWidth = 0.1;
    for (let k = 0; k < 3; k++) {
      const y0 = yOf(R, c.line, you.x - 3) ?? you.y;
      seg(ctx, you.x - 3.2 - k, sy(y0) - 0.1, you.x - 6.5 - k * 2 - (c.v - 30) * 0.1, sy(yOf(R, c.line, you.x - 6.5 - k * 2) ?? y0) - 0.1);
    }
    // A landing's puff of dust.
    const fx = v.fx;
    const land = fx && fx.banLand !== undefined ? fx.clock - fx.banLand.t0 : 1e9;
    if (land < 380) {
      for (let k = 0; k < 8; k++) {
        const p = land / 380;
        ctx.fillStyle = `rgba(230,210,190,${(1 - p) * 0.7})`;
        disc(ctx, you.x + (k - 3.5) * 0.9 * (0.5 + p * 1.4), sy(you.y) - 0.3 - p * (1 + rnd(k, 4) * 1.4) * (fx.banLand.big ? 1.6 : 1), 0.28 + p * 0.28);
      }
    }
  }

  function front(ctx, v) {
    const R = ride(v);
    const round = v.round;
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 10;
    const hi = cam + FW + 10;
    if (!c.done && c.line >= 0) sparks(ctx, v, R, c);
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 >= lo && x0 <= hi) frame(ctx, v, x0, x1, y, i, round.you);
    });
    R.swings.forEach(([cx, , amp], i) => {
      if (cx + amp + 4 >= lo && cx - amp - 4 <= hi) chandelier(ctx, v, R, i, c);
    });
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Splinters of glass, wood and porcelain, tumbling.
    const bits = v.fx && v.fx.banBits;
    if (bits) {
      for (const b of bits) {
        const t = (v.fx.clock - b.t0) / 1000;
        if (t < 0 || t > 0.9) continue;
        ctx.save();
        ctx.translate(b.x + b.vx * t, sy(b.y + b.vy * t - 30 * t * t));
        ctx.rotate(b.rot + b.vr * t);
        ctx.globalAlpha = clamp(1.6 - t * 1.6, 0, 1);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -0.12, b.w, 0.24);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  const dim = () => 0;

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const round = v.round;
    const c = state(v);
    if (!R || !c) return;
    const you = round.you;
    const clock = v.clock;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    // A pool of candlelight around you.
    add(you.x + 2, you.y + 2.4, 10, 0.55);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 1.2, (heightAt(R, x) ?? 10) + 5.4, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.props.forEach(([x, line, kind]) => {
      if (kind && x > lo && x < hi) add(x, (yOf(R, line, x) ?? 10) + CANDLE_H, 5, 0.35);
    });
    R.swings.forEach(([cx, , amp], i) => {
      if (cx + amp > lo && cx - amp < hi) {
        const s = swingAt(R, i, c.clock);
        add(s.x, s.bottom + 1.4, 9, 0.5 + 0.05 * Math.sin(clock / 120 + i));
      }
    });
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 > lo && x0 < hi) add((x0 + x1) / 2, y + 2, 5, 0.22 * (0.85 + 0.15 * Math.sin(clock / 220 + i)));
    });
    R.butlers.forEach(([, line], i) => {
      const b = c.butlers[i];
      if (b.x > lo && b.x < hi && (b.state === "warn" || b.state === "lunge")) add(b.x, (yOf(R, line, clamp(b.x, linesOf(R)[line].x0, linesOf(R)[line].x1)) ?? 10) + 2.5, 5, 0.3);
    });
    add(v.spec.door - 6, 18, 14, 0.6);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Glass, wood and china flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.banBits = (fx.banBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.banBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The ducking repeats as you hold the key; keep it from stacking.
    if (e.type === "banDuck" && !gateOnce(fx, "banDuckMs", 160)) return true;
    say(tone, voice[0], voice[1], 0.5);
    const DUST = "#d8c8b0";
    switch (e.type) {
      case "banJump":
        burst(e.x, e.y, DUST, 5, 7, 300);
        break;
      case "banLand":
        fx.banLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, DUST, e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(200, 0.5);
        break;
      case "banLaunch":
        burst(e.x, e.y, DUST, 12, 14, 380);
        float(e.x, e.y + 5, e.last ? "Jump!" : "Whee!", GOLD, 2.2);
        break;
      case "banSwitch":
        ring(e.x, e.y + 1, e.lower ? "#ffe08a" : "#e0a070", 1, 6, 360);
        float(e.x, e.y + 4, e.lower ? "Under-rail" : "Handrail", GOLD, 1.8);
        break;
      case "banCrash":
        shake(320, 1);
        flash("#ffe8c8", 180);
        burst(e.x, e.y + 1, e.what === "vase" ? "#e8eef8" : e.what === "swing" ? "#e8d8a0" : "#8a4a2a", 18, 17, 520);
        burst(e.x, e.y + 1, "#c9a24a", 8, 14, 360);
        splinter(fx, e.x, e.y, e.what === "vase" ? ["#e8eef8", "#3a5ca8"] : ["#8a4a2a", "#c9a24a", "#e8d8a0"]);
        break;
      case "banCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "banFinish":
        shake(260, 0.7);
        burst(e.x, e.y, DUST, e.big ? 22 : 14, 13, 560);
        float(e.x, e.y + 5, "Made it!", GOLD, 2.6);
        break;
      case "banButlerWarn":
        ring(e.x, e.y + 5, "#9ad0ff", 1, 5, 420);
        break;
      case "banButlerLunge":
        burst(e.x, e.y + 2, GHOST, 6, 8, 360);
        break;
      case "banButlerHit":
        burst(e.x, e.y, "#e6ecf2", 5, 9, 280);
        break;
      case "banButlerBreak":
        burst(e.x, e.y, GHOST, 14, 14, 480);
        splinter(fx, e.x, e.y, ["#e6ecf2", "#b8d0ec"]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "banWebTear":
        burst(e.x, e.y, "#e6e6f0", 6, 5, 380);
        break;
      case "banWebShot":
        burst(e.x, e.y, "#f4f4ff", 10, 8, 420);
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
