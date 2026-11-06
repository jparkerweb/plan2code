// Plan2Code Web Console - Ghoul Rush's finale, its drawing for the finale's first ride, Down the Hatch: the House's wet, ribbed throat seen side on. A back wall of cartilage rings that throb when a squeeze is coming, a fleshy roof and a glistening tongue of a floor that swallows in ridges, gristle ledges over the holes where it forks (an acid glow far below), bile stretches with their bubbles, rib bones, uvulas with a swallowed lamp at the tip, rings of muscle that squeeze down from the roof, tumbling swallowed furniture, the front step at the start and the cellar at the end, and the WELCOME mat with YOU on it. LOOKS, VOICES, LOSE_WORDS, LOSE_SOUNDS and matArt(d), plugged into draw/ghoul-draw.js.
//
// LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain data; matArt(d) takes the
// game's drawing helpers (`d`) and hands back the drawing by kind, so this file never reaches back
// into the game. Drawn in room units, the way the game draws: y counted down from the field's top,
// so a world height `y` is drawn at `FIELD_H - y`. The still layers only get the wall's color: the
// throat is drawn by `moving` (every frame, over the cached still layers); the uvulas, the
// squeezes, the mat, the telegraphs and the flying bits by `front`. Both start by checking that the
// room is this ride's and return at once otherwise. No random numbers: everything comes from a
// hash or the clock. What the art reads off the rules (ghoul-mat.js):
//
// - the room: `spec.ride` ({ track, rails, ribs, lows, squeezes, furniture, bile, checks, finish }),
//   `spec.ground` (the front step at the start and the cellar floor at the end), `spec.door`.
// - `round.runner` (id "mat"; null in any other room): `v`, `line` (-1 in the air), `check`,
//   `done`, `restX`, `bile`, `squeezes` [{ state, t }], `furniture` [{ state, t, x }].
// - YOU: `you.state`, `you.vy`, `you.ducking`, `you.x`, `you.y`.
// - events leave short-lived bits in the view's `fx` (`matBits`, `matLand`, `matSaid`).

import { linesOf, trackY } from "../cart/ghoul-cart.js";
import { FURN_H, FURN_W, RIB_H, SQ_W, SQ_WARN_MS, furnitureLift, squeezeLow } from "./ghoul-mat.js";
import { ANSWER_COLORS, TELEGRAPH_ALPHA, TELEGRAPH_FULL, TELEGRAPH_SEE, TELEGRAPH_WORDS } from "../sled/ghoul-sled-draw.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const LOOKS = freeze({
  mat: freeze({ pack: "mat", custom: true, noMoon: true, pit: "#12040a", wallTop: "#300a12", wallLow: "#4e121e", paper: "#5e1824", wainscot: "#24070c", floorTop: "#d06a7a", floor: "#6a1a2a", floorEdge: "#2a0810", shelf: "#cdb8a0", shelfTop: "#efe0c8", window: "#ffb0a0", decor: "throat", color: "#e0607a", dark: 0.5 }),
});

// How each new kind sounds, by act (the user's picks from the sound vote, mat.html, in ghoul-sfx-mat.js).
export const VOICES = freeze({
  mat: freeze({ jump: "ghoulMatJump", land: "ghoulMatLand", launch: "ghoulMatLaunch", duck: "ghoulMatDuck", switch: "ghoulMatSwitch", crash: "ghoulMatCrash", check: "ghoulMatCheck", finish: "ghoulMatFinish", bile: "ghoulMatBile" }),
  matsqueeze: freeze({ throb: "ghoulMatThrob", close: "ghoulMatClose" }),
  matfurn: freeze({ drop: "ghoulMatFurnDrop", land: "ghoulMatFurnLand", hit: "ghoulMatFurnHit", break: "ghoulMatFurnBreak" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  matJump: ["mat", "jump"],
  matLand: ["mat", "land"],
  matLaunch: ["mat", "launch"],
  matDuck: ["mat", "duck"],
  matSwitch: ["mat", "switch"],
  matCrash: ["mat", "crash"],
  matCheck: ["mat", "check"],
  matFinish: ["mat", "finish"],
  matBile: ["mat", "bile"],
  matSqueezeThrob: ["matsqueeze", "throb"],
  matSqueezeClose: ["matsqueeze", "close"],
  matFurnDrop: ["matfurn", "drop"],
  matFurnLand: ["matfurn", "land"],
  matFurnHit: ["matfurn", "hit"],
  matFurnBreak: ["matfurn", "break"],
});
export const LOSE_WORDS = freeze({ matRib: "Ribbed", matUvula: "Hung up on the uvula", matSqueeze: "Squeezed", matFurniture: "Floored by the furniture", matPlunge: "Swallowed whole" });
export const LOSE_SOUNDS = freeze({
  matRib: ["ghoulMatRib", 0.5, 1],
  matUvula: ["ghoulMatUvula", 0.6, 1],
  matSqueeze: ["ghoulMatSqueeze", 0.6, 1],
  matFurniture: ["smash", 0.6, 0.9],
  matPlunge: ["ghoulPitFall", 0.55, 0.8],
});

const FW = 96;
const MAT_V = 46;
const ROOF = 24;
const FLESH = "#b84a5e";
const FLESH_D = "#4a0e1c";
const FLESH_L = "#f0a0ac";
const WET = "rgba(255,230,235,0.8)";
const BONE = "#efe6d2";
const BONE_D = "#9a8a70";
const BILE = "#b8d03a";
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
  c.arc(x, y, Math.max(0.01, r), 0, TAU);
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
const HALO = freeze({ warm: "255,190,110", red: "255,60,70", green: "120,255,120", bile: "200,240,80", gold: "255,220,130", pink: "255,150,170" });
function halo(ctx, kind, x, y, r, alpha) {
  ctx.globalAlpha = clamp(alpha, 0, 1);
  ctx.fillStyle = rgrad(ctx, x, y, r, [[0, `rgba(${HALO[kind]},0.9)`], [0.4, `rgba(${HALO[kind]},0.3)`], [1, `rgba(${HALO[kind]},0)`]]);
  disc(ctx, x, y, r);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ the floor */

// The floor's height at x (the highest floor line), null over a hole.
const floorAt = (R, x) => {
  let best = null;
  for (let i = 0; i < R.rails; i++) {
    const y = trackY(R, i, x);
    if (y !== null && (best === null || y > best)) best = y;
  }
  return best;
};
// The throat's line at x, carried straight across a hole (for the roof and the walls).
const profAt = (R, x) => {
  const y = floorAt(R, x);
  if (y !== null) return y;
  const lines = linesOf(R).slice(0, R.rails);
  const before = lines.filter((L) => L.x1 <= x).sort((a, b) => b.x1 - a.x1)[0];
  const after = lines.filter((L) => L.x0 >= x).sort((a, b) => a.x0 - b.x0)[0];
  if (before && after) {
    const ya = before.pts.at(-1)[1];
    const yb = after.pts[0][1];
    return ya + ((yb - ya) * (x - before.x1)) / (after.x0 - before.x1);
  }
  if (before) return before.pts.at(-1)[1];
  return after ? after.pts[0][1] : 20;
};

// The roof's underside at x: ROOF over the throat's line, but never off the top of the field, so a
// sliver of it (and what hangs from it) always shows.
const roofAt = (R, x) => Math.min(profAt(R, x) + ROOF, FH - 1.6);

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

export const ANSWERS = freeze({ rib: "JUMP", fork: "JUMP", uvula: "DUCK", squeeze: "DUCK" });
export const COLORS = freeze({ ...ANSWER_COLORS });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lead (where it begins), x (its middle), up (height of
// the glyph's anchor), n (which of its kind), answer }, in the room's order. Furniture is shot or
// jumped as it comes, and warns by itself, so it gets none; a fork gets a JUMP where its ledge begins.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lead, x, up) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lead, x, up, n, answer: ANSWERS[kind] });
  };
  for (const [x, line] of R.ribs) add("rib", x - 2, x, (trackY(R, line, x) ?? 10) + 8);
  for (let i = R.rails; i < R.track.length; i++) {
    const L = linesOf(R)[i];
    add("fork", L.x0 - 4, L.x0 + 6, L.pts[0][1] + 6.5);
  }
  for (const [x0, x1, y] of R.lows) add("uvula", x0 - 3.2, (x0 + x1) / 2, y + 6.8);
  for (const [x, line] of R.squeezes) add("squeeze", x - SQ_W / 2 - 3, x, (trackY(R, line, x) ?? 10) + 9);
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

// How hard the walls throb at x (0 to 1): near a squeeze that is throbbing, closing or shut, the more
// the closer its close comes. For the art and the scene tool.
export function throbAt(R, c, x) {
  let best = 0;
  R.squeezes.forEach(([sx], i) => {
    const s = c.squeezes[i];
    if (!s || s.state === "wait" || s.state === "done") return;
    const near = clamp(1 - Math.abs(x - sx) / 26, 0, 1);
    const p = s.state === "throb" ? 0.35 + 0.65 * (1 - s.t / SQ_WARN_MS) : s.state === "ease" ? 0.4 : 1;
    best = Math.max(best, near * p);
  });
  return best;
}

/* --------------------------------------------------------------------- art */

export function matArt(d) {
  const { ellipse, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "mat" ? v.spec.ride : null);
  const state = (v) => (v.round && v.round.runner && v.round.runner.id === "mat" ? v.round.runner : null);
  const sy = (y) => FH - y;
  // Calls fn(x, k) for each repeat of a layer of spacing `W` at parallax `par` (1 moves with the floor).
  const strips = (cam, par, W, w, fn) => {
    const ox = cam * (1 - par);
    const k0 = Math.floor((cam - ox - w) / W);
    const k1 = Math.floor((cam + FW - ox) / W);
    for (let k = k0; k <= k1; k++) fn(ox + k * W, k);
  };

  /* ------------------------------------------------------------- the room */

  // The still layers only get the wall's color: the throat is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The front step at the start (worn boards at the threshold) and the cellar floor at the end (old flagstones).
  function ground(ctx, v, look, a, b, top) {
    const y = v.g.FIELD_H - top;
    const cellar = a > 100;
    // The step is a slab of boards over the throat's mouth; the cellar floor is solid down to the bottom.
    const deep = cellar ? top + 2 : 2.4;
    ctx.fillStyle = vgrad(ctx, y, y + deep, cellar ? [[0, "#8a8478"], [0.15, "#4a463e"], [1, "#16130f"]] : [[0, "#9a7448"], [0.5, "#5a3c20"], [1, "#2a1a0c"]]);
    ctx.fillRect(a, y, b - a, deep);
    ctx.strokeStyle = cellar ? "rgba(10,8,6,0.7)" : "rgba(20,10,4,0.7)";
    ctx.lineWidth = 0.14;
    for (let x = a; x < b; x += cellar ? 5 : 3.2) seg(ctx, x, y, x, y + (cellar ? 2.6 : 1.6));
    if (cellar) for (let x = a + 2.5; x < b; x += 5) seg(ctx, x, y + 2.6, x, y + 5.2);
    ctx.fillStyle = cellar ? "#b8b2a4" : "#a07a50";
    ctx.fillRect(a, y, b - a, 0.3);
  }
  function shelf() {}

  // The back wall: wet crimson, veins at a slower parallax, and the cartilage rings of the gullet
  // that throb when a squeeze is near.
  function wall(ctx, v, R, c, cam) {
    const clock = v.clock;
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#2a0810"], [0.5, "#5a1624"], [1, "#2a0810"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    // Veins, far back.
    ctx.strokeStyle = "rgba(120,20,50,0.5)";
    ctx.lineWidth = 0.35;
    strips(cam, 0.5, 34, 30, (x, k) => {
      ctx.beginPath();
      let px = x;
      let py = 4 + rnd(k, 1) * 10;
      ctx.moveTo(px, py);
      for (let q = 0; q < 6; q++) {
        px += 3 + rnd(k, q + 2) * 4;
        py += 6 + rnd(k, q + 9) * 3;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
    // The rings of the gullet: a band of cartilage from roof to floor every 16 units.
    strips(cam, 1, 16, 4, (x, k) => {
      const base = profAt(R, x);
      const top = sy(roofAt(R, x) + 2);
      const bot = sy(base - 1);
      const t = throbAt(R, c, x);
      const pulse = t > 0 ? t * (0.5 + 0.5 * Math.sin(clock / 70 - x * 0.15)) : 0;
      const w = 1.6 + pulse * 2.6;
      ctx.fillStyle = t > 0 ? `rgba(${200 + 55 * pulse | 0},${60 - 30 * pulse | 0},${80 - 30 * pulse | 0},${0.5 + 0.4 * pulse})` : "rgba(150,40,64,0.5)";
      ctx.beginPath();
      ctx.moveTo(x - w / 2, top);
      ctx.quadraticCurveTo(x - w / 2 - 1.2 - pulse, (top + bot) / 2, x - w / 2, bot);
      ctx.lineTo(x + w / 2, bot);
      ctx.quadraticCurveTo(x + w / 2 - 1.2 - pulse, (top + bot) / 2, x + w / 2, top);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = t > 0 ? `rgba(255,170,170,${0.3 + 0.5 * pulse})` : "rgba(255,170,180,0.22)";
      ctx.lineWidth = 0.18;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 0.3, top);
      ctx.quadraticCurveTo(x - w / 2 - 0.9 - pulse, (top + bot) / 2, x - w / 2 + 0.3, bot);
      ctx.stroke();
      // A slow drip off the ring.
      const p = (clock / (1800 + (k % 5) * 300) + rnd(k, 3)) % 1;
      ctx.fillStyle = "rgba(255,210,220,0.55)";
      ellipse(ctx, x + 0.4, top + 1 + p * (bot - top - 2), 0.14, 0.3);
      ctx.fill();
    });
  }

  // The roof: a fleshy ceiling ROOF over the throat's line, ridged, with a wet lip along its edge.
  function roof(ctx, R, lo, hi) {
    ctx.fillStyle = vgrad(ctx, 0, FH * 0.5, [[0, "#1e050b"], [1, "#7a2032"]]);
    ctx.beginPath();
    ctx.moveTo(lo, -2);
    for (let x = lo; x <= hi; x += 2) ctx.lineTo(x, sy(roofAt(R, x)) + Math.sin(x * 0.4) * 0.4);
    ctx.lineTo(hi, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(255,180,190,0.45)";
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    for (let x = lo; x <= hi; x += 2) {
      const y = sy(roofAt(R, x)) + Math.sin(x * 0.4) * 0.4;
      x === lo ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // The floor: a glistening tongue under each floor line, with the ridges of a swallow and a wet top.
  function floorBand(ctx, v, R, lo, hi) {
    const clock = v.clock;
    for (let i = 0; i < R.rails; i++) {
      const pts = pathOf(R, i, lo, hi);
      if (pts.length < 2) continue;
      ctx.fillStyle = vgrad(ctx, FH * 0.3, FH, [[0, FLESH], [0.4, "#7a1e30"], [1, "#2a0610"]]);
      ctx.beginPath();
      pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y)) : ctx.moveTo(x, sy(y))));
      ctx.lineTo(pts.at(-1)[0], FH + 1);
      ctx.lineTo(pts[0][0], FH + 1);
      ctx.closePath();
      ctx.fill();
      // Folds under the top, following it.
      ctx.strokeStyle = "rgba(60,8,20,0.45)";
      ctx.lineWidth = 0.3;
      for (const dy of [2.2, 4.6]) {
        ctx.beginPath();
        pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + dy + Math.sin(x * 0.3) * 0.3) : ctx.moveTo(x, sy(y) + dy)));
        ctx.stroke();
      }
      // The ridges across it, a little closer on the climbs.
      const L = linesOf(R)[i];
      for (let x = Math.ceil(Math.max(lo, L.x0) / 5) * 5; x < Math.min(hi, L.x1); x += 5) {
        const y = sy(trackY(R, i, x));
        ctx.strokeStyle = "rgba(90,14,30,0.5)";
        ctx.lineWidth = 0.25;
        seg(ctx, x, y + 0.5, x - 0.8, y + 2.6);
      }
      // The wet top and its glints.
      ctx.strokeStyle = FLESH_L;
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + 0.1) : ctx.moveTo(x, sy(y) + 0.1)));
      ctx.stroke();
      for (let x = Math.ceil(Math.max(lo, L.x0) / 7) * 7; x < Math.min(hi, L.x1); x += 7) {
        const a = 0.4 + 0.4 * Math.sin(clock / 400 + x);
        ctx.fillStyle = `rgba(255,240,245,${a})`;
        ellipse(ctx, x, sy(trackY(R, i, x)) + 0.4, 0.6, 0.12);
        ctx.fill();
      }
      // A hole's lips: a puckered rim where the floor ends over it (not at the start or the lip).
      for (const end of [L.x0, L.x1]) {
        if (end < lo || end > hi) continue;
        if ((end === L.x0 && i === 0) || (end === L.x1 && i === R.rails - 1)) continue;
        const y = sy(trackY(R, i, end));
        ctx.fillStyle = "#d86a7e";
        ellipse(ctx, end, y + 0.6, 1.2, 1.1);
        ctx.fill();
        ctx.fillStyle = FLESH_D;
        ellipse(ctx, end + (end === L.x1 ? 0.5 : -0.5), y + 1.2, 0.7, 1.4);
        ctx.fill();
      }
    }
  }

  // A hole where the throat forks: darkness falling away, and acid far down glowing green.
  function holes(ctx, v, R, lo, hi) {
    const lines = linesOf(R);
    for (let i = 0; i + 1 < R.rails; i++) {
      const a = lines[i].x1;
      const b = lines[i + 1].x0;
      if (b < lo || a > hi) continue;
      ctx.fillStyle = vgrad(ctx, sy(profAt(R, a)), FH, [[0, "#140208"], [0.7, "#060103"], [1, "#0e2a08"]]);
      ctx.beginPath();
      ctx.moveTo(a, sy(lines[i].pts.at(-1)[1]));
      ctx.lineTo(b, sy(lines[i + 1].pts[0][1]));
      ctx.lineTo(b, FH + 1);
      ctx.lineTo(a, FH + 1);
      ctx.closePath();
      ctx.fill();
      const p = 0.6 + 0.4 * Math.sin(v.clock / 300 + i);
      halo(ctx, "green", (a + b) / 2, FH + 2, (b - a) * 0.6, 0.35 * p);
      for (let q = 0; q < 6; q++) {
        const t = (v.clock / (900 + q * 130) + rnd(i, q)) % 1;
        ctx.fillStyle = `rgba(170,255,120,${0.6 * (1 - t)})`;
        disc(ctx, a + (b - a) * rnd(i, q + 7), FH - t * 8, 0.3);
      }
    }
  }

  // A gristle ledge over a hole: a pale band of cartilage with sinew hanging under it.
  function ledges(ctx, v, R, lo, hi) {
    for (let i = R.rails; i < R.track.length; i++) {
      const pts = pathOf(R, i, lo, hi);
      if (pts.length < 2) continue;
      const L = linesOf(R)[i];
      ctx.strokeStyle = "rgba(240,200,190,0.35)";
      ctx.lineWidth = 0.2;
      for (let x = Math.ceil(Math.max(lo, L.x0 + 1) / 3) * 3; x < Math.min(hi, L.x1 - 1); x += 3) {
        const y = sy(trackY(R, i, x));
        const hang = 2 + rnd(x | 0, 2) * 3 + Math.sin(v.clock / 600 + x) * 0.3;
        seg(ctx, x, y + 1, x + 0.3, y + 1 + hang);
      }
      const trace = (dy) => {
        ctx.beginPath();
        pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) + dy) : ctx.moveTo(x, sy(y) + dy)));
        ctx.stroke();
      };
      ctx.lineCap = "round";
      ctx.strokeStyle = "#5a3a30";
      ctx.lineWidth = 1.9;
      trace(0.75);
      ctx.strokeStyle = "#cdb8a0";
      ctx.lineWidth = 1.4;
      trace(0.6);
      ctx.strokeStyle = "#fff4e4";
      ctx.lineWidth = 0.3;
      trace(0.05);
      ctx.lineCap = "butt";
    }
  }

  // Bile on the floor: a yellow-green film along the stretch, its bubbles rising.
  function bile(ctx, v, R, lo, hi) {
    R.bile.forEach(([a, b], n) => {
      if (b < lo || a > hi) return;
      for (let i = 0; i < R.rails; i++) {
        const pts = pathOf(R, i, Math.max(a, lo), Math.min(b, hi));
        if (pts.length < 2) continue;
        ctx.strokeStyle = "rgba(170,210,40,0.85)";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) - 0.15) : ctx.moveTo(x, sy(y) - 0.15)));
        ctx.stroke();
        ctx.strokeStyle = "rgba(240,255,170,0.75)";
        ctx.lineWidth = 0.18;
        ctx.beginPath();
        pts.forEach(([x, y], q) => (q ? ctx.lineTo(x, sy(y) - 0.45) : ctx.moveTo(x, sy(y) - 0.45)));
        ctx.stroke();
      }
      for (let x = Math.ceil(Math.max(a, lo) / 4) * 4; x < Math.min(b, hi); x += 4) {
        const f = floorAt(R, x);
        if (f === null) continue;
        const p = (v.clock / (700 + ((x * 7) % 5) * 90) + rnd(x | 0, n)) % 1;
        ctx.strokeStyle = `rgba(220,250,120,${0.8 * (1 - p)})`;
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.arc(x + rnd(x | 0, 3) * 2, sy(f) - 0.4 - p * 1.6, 0.18 + p * 0.25, 0, TAU);
        ctx.stroke();
      }
    });
  }

  // A rib bone arching up out of the floor and back into it, a fainter one behind for depth: a
  // hoop of bone RIB_H tall to jump.
  function rib(ctx, x, base, i) {
    ctx.fillStyle = "rgba(40,6,14,0.55)";
    ellipse(ctx, x, base + 0.2, 2.0, 0.4);
    ctx.fill();
    const arch = (dx, h, w, dark) => {
      ctx.beginPath();
      ctx.moveTo(x + dx - w, base + 0.3);
      ctx.bezierCurveTo(x + dx - w - 0.2, base - h * 0.9, x + dx + w * 0.4, base - h * 1.15, x + dx + w, base + 0.3);
      ctx.strokeStyle = dark ? "#5a4a3a" : BONE_D;
      ctx.lineWidth = dark ? 0.7 : 1.15;
      ctx.stroke();
      if (dark) return;
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(x + dx - w - 0.15, base - 0.2);
      ctx.bezierCurveTo(x + dx - w - 0.35, base - h * 0.85, x + dx + w * 0.3, base - h * 1.05, x + dx + w - 0.2, base - 0.6);
      ctx.stroke();
    };
    ctx.lineCap = "round";
    arch(0.9, RIB_H * 0.8, 1.0, true);
    arch(0, RIB_H, 1.2 + rnd(i, 1) * 0.15, false);
    ctx.lineCap = "butt";
    // Knuckles where it meets the floor.
    ctx.fillStyle = BONE;
    disc(ctx, x - 1.25, base, 0.42);
    disc(ctx, x + 1.25, base, 0.42);
  }

  // A swallowed porch lantern stuck in the wall at a checkpoint: amber, green once passed.
  function checkpoint(ctx, v, x, base, passed, i) {
    const f = 0.85 + 0.15 * Math.sin(v.clock / 110 + i);
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(x - 0.15, base - 9, 0.3, 2);
    ctx.fillStyle = "#3a2a18";
    poly(ctx, [[x - 0.9, base - 7], [x + 0.9, base - 7], [x + 0.7, base - 4.4], [x - 0.7, base - 4.4]]);
    ctx.fill();
    ctx.fillStyle = passed ? "#7dffa0" : "#ffcf6a";
    ctx.globalAlpha = f;
    ctx.fillRect(x - 0.55, base - 6.7, 1.1, 2);
    ctx.globalAlpha = 1;
    halo(ctx, passed ? "green" : "warm", x, base - 5.6, 5.5, passed ? 0.5 : 0.35);
  }

  // The House's front door at the start, the threshold YOU stepped over.
  function frontDoor(ctx, x) {
    const top = sy(38.4);
    ctx.fillStyle = "#2a1410";
    ctx.fillRect(x - 6, top - 16, 12, 16);
    ctx.fillStyle = "#e8b860";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - 5, top - 15, 10, 15);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#140806";
    ctx.lineWidth = 0.6;
    ctx.strokeRect(x - 6, top - 16, 12, 16);
    halo(ctx, "gold", x, top - 8, 12, 0.35);
  }

  // A piece of swallowed furniture: a chair (kind 0), a side table (1), a mantel clock (2), centered
  // on its box, turned `rot`, outlined dark so it reads against the flesh.
  function furnitureShape(ctx, kind, x, cy, rot) {
    ctx.save();
    ctx.translate(x, cy);
    ctx.rotate(rot);
    ctx.scale(1.15, 1.15);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const edge = () => {
      ctx.strokeStyle = "#1a0a06";
      ctx.lineWidth = 0.22;
      ctx.stroke();
    };
    if (kind === 0) {
      // A dining chair: legs, a red cushioned seat and a tall slatted back.
      ctx.strokeStyle = "#1a0a06";
      ctx.lineWidth = 0.6;
      seg(ctx, -1.2, 1.7, -1.2, 0.1);
      seg(ctx, 1.1, 1.7, 1.1, 0.1);
      ctx.strokeStyle = "#a0623a";
      ctx.lineWidth = 0.36;
      seg(ctx, -1.2, 1.7, -1.2, 0.1);
      seg(ctx, 1.1, 1.7, 1.1, 0.1);
      ctx.fillStyle = "#c03a58";
      poly(ctx, [[-1.55, -0.5], [1.5, -0.5], [1.5, 0.35], [-1.55, 0.35]]);
      ctx.fill();
      edge();
      ctx.fillStyle = "#a0623a";
      poly(ctx, [[0.9, -1.75], [1.55, -1.75], [1.55, -0.5], [0.9, -0.5]]);
      ctx.fill();
      edge();
      ctx.fillStyle = "#ffd0d8";
      ctx.fillRect(-1.3, -0.45, 2.4, 0.14);
    } else if (kind === 1) {
      // A round side table with a lace doily and a pedestal.
      ctx.fillStyle = "#8a5a32";
      poly(ctx, [[-0.3, -1.2], [0.3, -1.2], [0.4, 1.4], [-0.4, 1.4]]);
      ctx.fill();
      edge();
      poly(ctx, [[-1.2, 1.35], [1.2, 1.35], [1.2, 1.7], [-1.2, 1.7]]);
      ctx.fill();
      edge();
      ctx.fillStyle = "#b07a48";
      ellipse(ctx, 0, -1.35, 1.7, 0.42);
      ctx.fill();
      edge();
      ctx.fillStyle = "#f4ecd8";
      ellipse(ctx, 0, -1.55, 0.9, 0.2);
      ctx.fill();
    } else {
      // A mantel clock: a dark wooden case with a domed top, a white face and brass feet.
      ctx.fillStyle = "#6a3e20";
      ctx.beginPath();
      ctx.moveTo(-1.35, 1.5);
      ctx.lineTo(-1.35, -0.8);
      ctx.arc(0, -0.8, 1.35, Math.PI, 0);
      ctx.lineTo(1.35, 1.5);
      ctx.closePath();
      ctx.fill();
      edge();
      ctx.fillStyle = "#f4ecd2";
      disc(ctx, 0, -0.35, 0.9);
      ctx.strokeStyle = "#201008";
      ctx.lineWidth = 0.14;
      seg(ctx, 0, -0.35, 0, -1.0);
      seg(ctx, 0, -0.35, 0.5, -0.1);
      ctx.fillStyle = "#d9b050";
      ctx.fillRect(-1.45, 1.45, 2.9, 0.3);
    }
    ctx.lineCap = "butt";
    ctx.restore();
  }

  function furniture(ctx, v, R, i, f) {
    if (f.state !== "drop" && f.state !== "roll") return;
    const [hx, line, kind] = R.furniture[i];
    const L = linesOf(R)[line];
    const floor = trackY(R, line, clamp(f.x, L.x0, L.x1));
    const lift = furnitureLift(f);
    // While it drops: a shadow on the floor growing, and a streak from the roof.
    if (f.state === "drop") {
      const p = 1 - lift / 18;
      ctx.fillStyle = `rgba(20,0,6,${0.25 + 0.45 * p})`;
      ellipse(ctx, f.x, sy(floor) + 0.2, 0.8 + 1.4 * p, 0.3);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,200,180,0.25)";
      ctx.lineWidth = 0.15;
      ctx.setLineDash && ctx.setLineDash([0.6, 0.6]);
      seg(ctx, f.x, sy(floor) - FURN_H - lift, f.x, sy(roofAt(R, f.x)));
      ctx.setLineDash && ctx.setLineDash([]);
    } else {
      ctx.fillStyle = "rgba(20,0,6,0.5)";
      ellipse(ctx, f.x, sy(floor) + 0.2, 1.8, 0.3);
      ctx.fill();
    }
    const rot = f.state === "roll" ? -(hx - f.x) / (FURN_H / 2) : Math.sin(v.clock / 120 + i) * 0.3;
    furnitureShape(ctx, kind, f.x, sy(floor + lift + FURN_H / 2), rot);
    // A wet sheen on it: it came down the same way YOU are going.
    ctx.fillStyle = "rgba(255,220,230,0.25)";
    ellipse(ctx, f.x - 0.4, sy(floor + lift + FURN_H * 0.75), FURN_W * 0.3, 0.2);
    ctx.fill();
  }

  /* ---------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    cam = Math.round(cam * 8) / 8;
    const lo = cam - 8;
    const hi = cam + FW + 8;
    wall(ctx, v, R, c, cam);
    holes(ctx, v, R, lo, hi);
    floorBand(ctx, v, R, lo, hi);
    bile(ctx, v, R, lo, hi);
    ledges(ctx, v, R, lo, hi);
    roof(ctx, R, lo, hi);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, sy(profAt(R, x)), i <= c.check, i);
    });
    R.ribs.forEach(([x, line], i) => {
      if (x > lo && x < hi) rib(ctx, x, sy(trackY(R, line, x) ?? 10), i);
    });
    R.furniture.forEach(([hx], i) => {
      const f = c.furniture[i];
      if (f.x > lo - 4 && f.x < hi && hx < hi + 20) furniture(ctx, v, R, i, f);
    });
    // The front step and the cellar floor, over the throat.
    for (const [a, b, top] of v.spec.ground) if (b > lo && a < hi) ground(ctx, v, LOOKS.mat, a, b, top);
    if (lo < 10) frontDoor(ctx, 3);
    const cellar = v.spec.ground.at(-1);
    if (v.spec.door > lo - 16 && v.spec.door < hi + 16) halo(ctx, "warm", v.spec.door, sy(cellar[2]) - 6, 14, 0.45);
    // A finished ride: the mat lies where it stopped, behind YOU as you walk out.
    if (c.done) mat(ctx, v, R, c);
  }

  /* ------------------------------------------------------ the things in front */

  // A uvula hanging from the roof, plump and wet, with a swallowed lamp at its tip, its glow over the floor.
  function uvula(ctx, v, R, x0, x1, y, i) {
    const cx = (x0 + x1) / 2;
    const w = (x1 - x0) / 2;
    const top = sy(roofAt(R, cx)) - 1;
    const tip = sy(y) - 1.6;
    const sway = Math.sin(v.clock / 700 + i * 1.3) * 0.4;
    ctx.fillStyle = vgrad(ctx, top, tip + 1, [[0, "#5a1222"], [0.6, "#b84a5e"], [1, "#e07a8c"]]);
    ctx.beginPath();
    ctx.moveTo(cx - w - 1.4, top);
    ctx.bezierCurveTo(cx - w * 0.5, top + (tip - top) * 0.4, cx - w - 0.4 + sway, tip - 2.6, cx - w * 0.75 + sway, tip - 0.6);
    ctx.bezierCurveTo(cx - w * 0.6 + sway, tip + 1.0, cx + w * 0.6 + sway, tip + 1.0, cx + w * 0.75 + sway, tip - 0.6);
    ctx.bezierCurveTo(cx + w + 0.4 + sway, tip - 2.6, cx + w * 0.5, top + (tip - top) * 0.4, cx + w + 1.4, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3a0814";
    ctx.lineWidth = 0.22;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,200,210,0.5)";
    ctx.lineWidth = 0.25;
    seg(ctx, cx - w * 0.4 + sway * 0.5, top + 1.5, cx - w * 0.55 + sway, tip - 1.2);
    // The lamp it swallowed, sticking out of its tip: a fringed shade and a lit bulb.
    const lx = cx + sway;
    const ly = tip + 0.5;
    halo(ctx, "warm", lx, ly + 1.2, 7, 0.45 + 0.08 * Math.sin(v.clock / 140 + i));
    ctx.fillStyle = "#e0b860";
    poly(ctx, [[lx - 1.5, ly + 1.0], [lx + 1.5, ly + 1.0], [lx + 0.8, ly - 0.5], [lx - 0.8, ly - 0.5]]);
    ctx.fill();
    ctx.strokeStyle = "#6a4010";
    ctx.lineWidth = 0.14;
    ctx.stroke();
    for (let k = -1.25; k <= 1.3; k += 0.5) seg(ctx, lx + k, ly + 1.0, lx + k, ly + 1.4);
    ctx.fillStyle = "#fff4c0";
    disc(ctx, lx, ly + 1.35, 0.42);
  }

  // A ring of muscle hanging from the roof at the squeeze: at rest a ridge of it shows; while it
  // throbs it sags and pulses, more as the close nears; shut, its thick lip comes down to SQ_LOW over
  // the floor (a ducked head clears it).
  function squeeze(ctx, v, R, i, s) {
    const [x, line] = R.squeezes[i];
    const floor = trackY(R, line, x) ?? 10;
    const roofY = roofAt(R, x);
    const top = sy(roofY) - 1.5;
    const t = s.state === "throb" ? 1 - s.t / SQ_WARN_MS : 0;
    const pulse = s.state === "throb" ? (0.5 + 0.5 * Math.sin(v.clock / 60)) * (0.4 + 0.6 * t) : 0;
    const shut = s.state === "close" || s.state === "shut" || s.state === "ease";
    // Its lowest point: the rule's while it closes, else a resting ridge (sagging as it throbs).
    const rest = 2.2 + (s.state === "throb" ? 1.5 * t + 1.2 * pulse : 0);
    const low = shut ? Math.min(squeezeLow(s), roofY - floor - rest) : roofY - floor - rest;
    const bot = sy(floor + low);
    const w = SQ_W / 2 + pulse * 0.9;
    // A warning glow on the throat while it throbs, stronger as it nears the close.
    if (s.state === "throb" || shut) halo(ctx, "red", x, sy(floor + 8), 12 + 6 * t, shut ? 0.35 : 0.15 + 0.35 * t * (0.5 + pulse));
    ctx.fillStyle = vgrad(ctx, top, bot + 1, [[0, "#5a0e1c"], [0.7, s.state === "throb" ? "#d0405a" : "#b23a50"], [1, "#e47088"]]);
    ctx.beginPath();
    ctx.moveTo(x - w - 0.6, top);
    ctx.quadraticCurveTo(x - w - 1.2 - pulse, (top + bot) / 2, x - w * 0.8, bot - 0.4);
    ctx.quadraticCurveTo(x, bot + 1.2, x + w * 0.8, bot - 0.4);
    ctx.quadraticCurveTo(x + w + 1.2 + pulse, (top + bot) / 2, x + w + 0.6, top);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#3a0814";
    ctx.lineWidth = 0.22;
    ctx.stroke();
    // Its fibers, and a wet rim on the lower lip.
    ctx.strokeStyle = "rgba(60,6,16,0.55)";
    ctx.lineWidth = 0.2;
    for (let k = -2; k <= 2; k++) seg(ctx, x + k * w * 0.35, top + 0.5, x + k * w * 0.3, bot - 0.6);
    ctx.strokeStyle = WET;
    ctx.lineWidth = 0.25;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.8, bot - 0.4);
    ctx.quadraticCurveTo(x, bot + 1.0, x + w * 0.8, bot - 0.4);
    ctx.stroke();
    // A drip off its lip while it is shut.
    if (shut) {
      const p = (v.clock / 500 + i * 0.3) % 1;
      ctx.fillStyle = "rgba(255,210,220,0.7)";
      ellipse(ctx, x + 0.6, bot + 0.6 + p * (sy(floor) - bot - 0.6), 0.15, 0.32);
      ctx.fill();
    }
  }

  // The WELCOME mat under YOU (YOU are drawn by the game under it): coir, a border, the word.
  function mat(ctx, v, R, c) {
    const round = v.round;
    const you = round.you;
    const done = c.done;
    const x = done && c.restX !== undefined ? c.restX : you.x;
    const y = done ? (v.spec.ground.at(-1)[2]) : you.y;
    let pitch = 0;
    if (!done && c.line >= 0) {
      const ya = trackY(R, c.line, x - 3);
      const yb = trackY(R, c.line, x + 3);
      if (ya !== null && yb !== null) pitch = Math.atan2(yb - ya, 6);
    } else if (!done) pitch = clamp(you.vy / Math.max(14, c.v), -1, 1) * 0.4;
    const wobble = !done && c.line >= 0 ? Math.sin(v.clock / 37) * 0.03 * (c.v / MAT_V) : 0;
    ctx.save();
    ctx.translate(x, FH - y + wobble);
    ctx.rotate(-pitch);
    ctx.scale(1.15, 1.15);
    // Spray off its back edge: spit, or bile on a bile stretch.
    if (!done && c.line >= 0) {
      const slick = c.bile >= 0;
      for (let k = 0; k < 12; k++) {
        const p = ((v.clock / (300 + (k % 4) * 60) + k * 0.113) % 1);
        ctx.fillStyle = slick ? `rgba(200,240,80,${(1 - p) * 0.85})` : `rgba(255,220,230,${(1 - p) * 0.7})`;
        disc(ctx, -3.6 - p * (2.6 + (c.v / MAT_V) * 3.4) * (0.6 + rnd(k, 1)), -0.2 - p * (0.6 + rnd(k, 2) * 1.5), 0.14 + (1 - p) * 0.18);
      }
    }
    ctx.fillStyle = "rgba(30,4,10,0.35)";
    ellipse(ctx, 0.2, 0.55, 3.9, 0.3);
    ctx.fill();
    // The mat: a curled front edge, coir brown with a dark border.
    ctx.fillStyle = "#3a2410";
    ctx.beginPath();
    ctx.moveTo(-3.7, 0.45);
    ctx.lineTo(-3.7, -0.35);
    ctx.lineTo(3.0, -0.35);
    ctx.quadraticCurveTo(3.9, -0.4, 3.9, -1.0);
    ctx.quadraticCurveTo(4.1, 0.1, 3.2, 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#b08040";
    ctx.fillRect(-3.4, -0.25, 6.3, 0.5);
    ctx.fillStyle = "#3a2410";
    ctx.font = "bold 0.55px sans-serif";
    if (ctx.fillText) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("WELCOME", -0.25, 0.02);
    }
    // Its bristles.
    ctx.strokeStyle = "rgba(60,36,16,0.6)";
    ctx.lineWidth = 0.06;
    for (let k = -3.5; k < 3.2; k += 0.45) seg(ctx, k, 0.3, k - 0.12, 0.55);
    // A landing's splat.
    const fx = v.fx;
    const land = fx && fx.matLand !== undefined ? fx.clock - fx.matLand.t0 : 1e9;
    if (land < 380) {
      for (let k = 0; k < 8; k++) {
        const p = land / 380;
        ctx.fillStyle = `rgba(255,200,215,${(1 - p) * 0.8})`;
        disc(ctx, (k - 3.5) * 0.9 * (0.5 + p * 1.4), -0.3 - p * (1 + rnd(k, 4) * 1.4) * (fx.matLand.big ? 1.6 : 1), 0.3 + p * 0.3);
      }
    }
    ctx.restore();
  }

  // A glyph over an obstacle: chevrons and (for the first few of a kind) the word.
  function glyph(ctx, v, t) {
    const up = t.answer === "JUMP";
    const col = COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const bob = Math.sin(v.clock / 260 + t.lead) * 0.35 * (up ? -1 : 1);
    const cy = clamp(FH - t.up, 5, FH - 7) + bob;
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

  function front(ctx, v) {
    const R = ride(v);
    const round = v.round;
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 10;
    const hi = cam + FW + 10;
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 >= lo && x0 <= hi) uvula(ctx, v, R, x0, x1, y, i);
    });
    R.squeezes.forEach(([x], i) => {
      if (x + SQ_W >= lo && x - SQ_W <= hi) squeeze(ctx, v, R, i, c.squeezes[i]);
    });
    if (!c.done) mat(ctx, v, R, c);
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Splinters of wood, bone and spit, tumbling.
    const bits = v.fx && v.fx.matBits;
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
    // A pool of light around you: the throat is lit by what it swallowed.
    add(you.x + 2, you.y + 2.4, 11, 0.6);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x, profAt(R, x) + 5.6, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 > lo && x0 < hi) add((x0 + x1) / 2, y + 0.4, 9, 0.6 + 0.05 * Math.sin(clock / 140 + i));
    });
    R.squeezes.forEach(([x, line], i) => {
      const s = c.squeezes[i];
      if (x > lo && x < hi && s.state !== "wait" && s.state !== "done") add(x, (trackY(R, line, x) ?? 10) + 7, 9, 0.35);
    });
    R.bile.forEach(([a, b]) => {
      for (let x = Math.max(a, lo); x < Math.min(b, hi); x += 16) {
        const f = floorAt(R, x);
        if (f !== null) add(x, f + 0.5, 5, 0.25);
      }
    });
    const lines = linesOf(R);
    for (let i = 0; i + 1 < R.rails; i++) {
      const m = (lines[i].x1 + lines[i + 1].x0) / 2;
      if (m > lo && m < hi) add(m, 4, 10, 0.4);
    }
    add(v.spec.door, v.spec.ground.at(-1)[2] + 6, 13, 0.6);
    if (lo < 20) add(3, 46, 10, 0.5);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Words over the first few of a kind only.
  function firstFew(fx, kind, n = 3) {
    fx.matSaid = fx.matSaid || {};
    fx.matSaid[kind] = (fx.matSaid[kind] || 0) + 1;
    return fx.matSaid[kind] <= n;
  }
  // Bits flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.matBits = (fx.matBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.matBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its sounds
  // plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The ducking repeats as you hold the key; keep it from stacking.
    if (e.type === "matDuck" && !gateOnce(fx, "matDuckMs", 160)) return true;
    d.say(tone, voice[0], voice[1], e.type === "matSqueezeThrob" ? 0.45 + 0.15 * (e.n || 1) : 0.5);
    const SPIT = "#f4c0cc";
    switch (e.type) {
      case "matJump":
        burst(e.x, e.y, SPIT, 5, 7, 300);
        break;
      case "matLand":
        fx.matLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, SPIT, e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(200, 0.5);
        break;
      case "matLaunch":
        burst(e.x, e.y, SPIT, 12, 14, 380);
        float(e.x, e.y + 5, e.last ? "Spat out!" : "Hup!", GOLD, 2.2);
        break;
      case "matSwitch":
        ring(e.x, e.y + 1, e.up ? "#efe0c8" : "#f0a0ac", 1, 6, 360);
        if (e.up && firstFew(fx, "ledge", 2)) float(e.x, e.y + 4, "Onto the gristle", GOLD, 1.8);
        break;
      case "matCrash":
        shake(320, 1);
        flash("#ffd0d8", 180);
        burst(e.x, e.y + 1, e.what === "rib" ? BONE : e.what === "furniture" ? "#8a5232" : FLESH, 18, 17, 520);
        burst(e.x, e.y + 1, SPIT, 8, 14, 360);
        splinter(fx, e.x, e.y, e.what === "rib" ? [BONE, BONE_D] : e.what === "furniture" ? ["#8a5232", "#c9a24a", "#e8e0c8"] : [FLESH, FLESH_L]);
        break;
      case "matCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "matFinish":
        shake(260, 0.7);
        burst(e.x, e.y, SPIT, e.big ? 22 : 14, 13, 560);
        float(e.x, e.y + 5, "Feet wiped!", GOLD, 2.6);
        break;
      case "matBile":
        burst(e.x, e.y, BILE, 10, 9, 420);
        if (firstFew(fx, "bile")) float(e.x + 12, e.y + 9, "Bile! Faster!", "#d8f060", 2);
        break;
      case "matSqueezeThrob":
        ring(e.x, e.y + 17, "#ff5a6a", 2, 8 + 4 * (e.n || 1), 520);
        if ((e.n || 1) === 1 && firstFew(fx, "squeeze")) float(e.x - 12, e.y + 15, "It throbs: duck!", "#ff8a9a", 2.1);
        if ((e.n || 1) === 2) shake(160, 0.3);
        break;
      case "matSqueezeClose":
        shake(220, 0.6);
        burst(e.x, e.y + 4, SPIT, 10, 10, 400);
        break;
      case "matFurnDrop":
        if (firstFew(fx, "furniture")) float(e.x, Math.min(e.y, 44), "Look out above!", "#ffd27a", 2);
        break;
      case "matFurnLand":
        shake(180, 0.5);
        burst(e.x, e.y + 0.5, SPIT, 10, 10, 380);
        break;
      case "matFurnHit":
        burst(e.x, e.y, "#c9a24a", 5, 9, 280);
        break;
      case "matFurnBreak":
        burst(e.x, e.y, "#8a5232", 14, 14, 480);
        splinter(fx, e.x, e.y, ["#8a5232", "#c9a24a", "#e8e0c8"]);
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
    decor: freeze({}),
    monsters: freeze({}),
    bosses: freeze({}),
    missiles: freeze({}),
    hazards: freeze({}),
    waves: freeze({}),
    powers: freeze({}),
    lights,
    react,
  });
}
