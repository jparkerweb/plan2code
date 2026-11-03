// Plan2Code Web Console - Ghoul Rush's Torch Mob, its drawing: a night race out of Hollow End on a stolen hay wagon. A warm-edged night sky and a moon, far rooftops and a church spire, the lit houses of the street, the cobbled road with its ditches, the old stone bridge over a dark river with its collapsed span, barrels and crates, washing lines and inn signs, villagers in windows and on roofs with pitchforks and torches, spooked horses, the hay wagon with its horse and its load (burning, when a torch lands), and the mob behind, torches and pitchforks and moonhounds, closer or further as the rules say. No random numbers: everything comes from a hash.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain
// data (the sounds live in ghoul-sfx-wagon.js); wagonArt(d) takes ghoul-draw.js's drawing
// helpers (`d`) and hands back the drawing by kind, so this file never reaches back into it.
// Drawn in room units, the way ghoul-draw.js draws: y counted down from the field's top, so a
// world height `y` is drawn at `FIELD_H - y`. The still layers' pit is dark under the whole
// ride, so the sky, the houses, the road and what stands on it are drawn by `moving` (every
// frame, behind Planny); the lows (washing lines, signs), the throws in the air, the hay's fire
// and the mob's meter by `front`. What the art reads off the rules (ghoul-wagon.js):
//
// - the room: `spec.ride` ({ track, blocks, lows, throwers, horses, checks, bridge, finish }),
//   `spec.ground` (the cobbles at the start and the green at the end).
// - `round.runner` (null in any other room): `gap`, `v`, `line` (-1 in the air), `check`,
//   `done`, `panic`, `fireMs`, `throwers` [{ state, t }], `props` [{ kind, x0, y0, x1, y1, x,
//   y, s, dead, age }], `horses` [{ state, t, x }], `smashed`.
// - Planny: `you.state`, `you.vy`, `you.ducking`, `you.x`, `you.y`.
// - events leave short-lived bits in the view's `fx` (`wagonBits`, `wagonLand`).

import { ANSWER_COLORS, TELEGRAPH_ALPHA } from "../sled/ghoul-sled-draw.js";
import { CATCH_GAP, GAP_MAX, PANIC_ON, REACH, THROW_MEET, WAGON_V, WIND_MS } from "./ghoul-wagon.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "wagon", custom: true, noMoon: true, pit: "#05060f", ...o });
export const LOOKS = freeze({
  wagon: pit({ wallTop: "#0a0d22", wallLow: "#1a1830", paper: "#2a2038", wainscot: "#1c1626", floorTop: "#5a5560", floor: "#26222c", floorEdge: "#100c14", shelf: "#3a2c24", shelfTop: "#7a5c40", window: "#ffc878", decor: "pots", color: "#ffb35a", dark: 0.5 }),
});

// How each new kind sounds, by act (the sounds are in ghoul-sfx-wagon.js).
export const VOICES = freeze({
  wagon: freeze({ jump: "ghoulWagonJump", land: "ghoulWagonLand", launch: "ghoulWagonLaunch", brake: "ghoulWagonBrake", crash: "ghoulWagonCrash", check: "ghoulWagonCheck", finish: "ghoulWagonFinish", panic: "ghoulWagonPanic", catch: "ghoulWagonCatch", fire: "ghoulWagonFire", out: "ghoulWagonOut" }),
  wagonthrow: freeze({ wind: "ghoulWagonWind", throw: "ghoulWagonThrow", shot: "ghoulWagonShot", ember: "ghoulWagonEmber" }),
  wagonhorse: freeze({ rear: "ghoulWagonRear", hit: "ghoulWagonHorseHit", turn: "ghoulWagonHorseTurn" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  wagonJump: ["wagon", "jump"],
  wagonLand: ["wagon", "land"],
  wagonLaunch: ["wagon", "launch"],
  wagonBrake: ["wagon", "brake"],
  wagonCrash: ["wagon", "crash"],
  wagonCheck: ["wagon", "check"],
  wagonFinish: ["wagon", "finish"],
  wagonPanic: ["wagon", "panic"],
  wagonCatch: ["wagon", "catch"],
  wagonFire: ["wagon", "fire"],
  wagonOut: ["wagon", "out"],
  wagonWind: ["wagonthrow", "wind"],
  wagonThrow: ["wagonthrow", "throw"],
  wagonShot: ["wagonthrow", "shot"],
  wagonEmber: ["wagonthrow", "ember"],
  wagonRear: ["wagonhorse", "rear"],
  wagonHorseHit: ["wagonhorse", "hit"],
  wagonHorseTurn: ["wagonhorse", "turn"],
});
export const LOSE_WORDS = freeze({ barrel: "Hit a barrel", crate: "Hit a crate", wash: "Tangled in the washing", sign: "Signed off", fork: "Pitchforked", torch: "Set alight", horse: "Trampled", ditch: "Fell in a ditch", river: "Into the river", mob: "Caught by the mob" });
export const LOSE_SOUNDS = freeze({
  barrel: ["clank", 0.5, 0.7],
  crate: ["smash", 0.5, 0.9],
  wash: ["squish", 0.4, 1.1],
  sign: ["clank", 0.5, 0.8],
  fork: ["crunch", 0.5, 1],
  torch: ["ghoulSizzle", 0.5, 0.8],
  horse: ["thud", 0.6, 0.7],
  ditch: ["ghoulPitFall", 0.55, 1],
  river: ["splash", 0.6, 0.8],
  mob: ["ghoulToll", 0.6, 0.7],
});

const FW = 96;
const WHEEL = 2.2;
const WATER = 7;
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

// A soft glow of "r,g,b" at a spot.
function glow(ctx, rgb, x, y, r, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgrad(ctx, x, y, r, [[0, `rgba(${rgb},0.9)`], [0.4, `rgba(${rgb},0.35)`], [1, `rgba(${rgb},0)`]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
const WARM = "255,170,80";

/* ----------------------------------------------------------- the geometry */

// The deck's height at x (the highest line under it), or null over a gap.
const yOn = (pts, x) => {
  for (let i = 0; i + 1 < pts.length; i++) {
    if (x <= pts[i + 1][0]) return pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * (x - pts[i][0])) / (pts[i + 1][0] - pts[i][0]);
  }
  return pts[pts.length - 1][1];
};
const heightAt = (R, x) => {
  let best = null;
  for (const pts of R.track) if (x >= pts[0][0] && x <= pts[pts.length - 1][0]) best = Math.max(best ?? -Infinity, yOn(pts, x));
  return best;
};
// The nearest deck height, over a gap too.
const deckNear = (R, x) => {
  const h = heightAt(R, x);
  if (h !== null) return h;
  let best = 16;
  let bd = Infinity;
  for (const pts of R.track) {
    for (const e of [pts[0], pts[pts.length - 1]]) {
      if (Math.abs(e[0] - x) < bd) {
        bd = Math.abs(e[0] - x);
        best = e[1];
      }
    }
  }
  return best;
};

/* ------------------------------------------------------------- telegraphs */

// What to do about what is coming, as a glyph that fades in ahead of it: DUCK for a washing line,
// an inn sign or a hurled pitchfork, JUMP for a barrel, a crate, a ditch, the bridge, a hurled
// torch or a horse. Everything comes from the room's `ride` fields and where the wagon is (no
// random numbers, no rules).
export const TELEGRAPH_SEE = 40;
export const TELEGRAPH_FULL = 30;
export const THROW_SEE = 66;
export const TELEGRAPH_WORDS = 3;
export const ANSWERS = freeze({ ditch: "JUMP", bridge: "JUMP", barrel: "JUMP", crate: "JUMP", horse: "JUMP", torch: "JUMP", wash: "DUCK", sign: "DUCK", fork: "DUCK" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lead (where the wagon acts), x (its middle), up (height of
// the glyph's anchor), n (which of its kind), answer, see }, in the room's order.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lead, x, up, see = TELEGRAPH_SEE) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lead, x, up, n, answer: ANSWERS[kind], see });
  };
  for (let i = 0; i + 1 < R.track.length; i++) {
    const a = R.track[i].at(-1)[0];
    const b = R.track[i + 1][0][0];
    const bridge = R.bridge && a >= R.bridge[0] && a <= R.bridge[1];
    add(bridge ? "bridge" : "ditch", a - (bridge ? 6 : 3), (a + b) / 2, (heightAt(R, a - 0.1) ?? 16) + 7.5);
  }
  for (const [x, line, kind] of R.blocks) add(kind ? "crate" : "barrel", x - REACH - 3, x, (heightAt(R, x) ?? 16) + 8);
  for (const [x0, x1, y, kind] of R.lows) add(kind ? "sign" : "wash", x0 - 3.2, (x0 + x1) / 2, y + 6.4);
  for (const [x, line, kind] of R.throwers) add(kind ? "torch" : "fork", x - THROW_MEET - 2, x - THROW_MEET, (heightAt(R, x - THROW_MEET) ?? 16) + 9, THROW_SEE);
  for (const [x] of R.horses) add("horse", x - 24, x - 14, (heightAt(R, x) ?? 16) + 9, TELEGRAPH_SEE + 20);
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with the wagon at `x`: { ...mark, alpha (0..1, before the pulse), words }.
export function telegraphs(R, x) {
  const out = [];
  for (const m of telegraphMarks(R)) {
    const d = m.lead - x;
    if (d > m.see || d < -6) continue;
    const alpha = Math.min(clamp((m.see - d) / (TELEGRAPH_SEE - TELEGRAPH_FULL), 0, 1), clamp((d + 4) / 6, 0, 1));
    if (alpha > 0.01) out.push({ ...m, alpha, words: m.n < TELEGRAPH_WORDS });
  }
  return out;
}

/* --------------------------------------------------------------------- art */

export function wagonArt(d) {
  const { ellipse, say, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "wagon" ? v.spec.ride : null);
  const Y = (y) => FH - y;
  const roadAt = (R, x) => deckNear(R, x) - WHEEL;

  /* ------------------------------------------------------------- the room */

  // The still layers only get the sky's color: the world is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The cobbles at the start, the green's grass at the end.
  function ground(ctx, v, look, a, b, top) {
    const y = v.g.FIELD_H - top;
    const R = ride(v);
    if (R && a >= R.finish - 1) {
      ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#4c7a3a"], [0.25, "#2c5028"], [1, "#101c14"]]);
      ctx.fillRect(a, y, b - a, top + 2);
      ctx.fillStyle = "#6a9a4a";
      ctx.fillRect(a, y, b - a, 0.3);
      ctx.strokeStyle = "#1c3820";
      ctx.lineWidth = 0.12;
      for (let x = a; x < b; x += 1.4) seg(ctx, x, y, x + 0.3 * (rnd(x * 10, 2) - 0.5), y - 0.7 - rnd(x * 10, 1) * 0.6);
      return;
    }
    ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#6a6470"], [0.3, "#3e3a46"], [1, "#16121a"]]);
    ctx.fillRect(a, y, b - a, top + 2);
  }
  function shelf() {}

  /* ------------------------------------------------------------- the sky */

  function sky(ctx, cam, clock) {
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#060a1e"], [0.5, "#161a3c"], [0.8, "#3c2438"], [1, "#6a3a30"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    for (let k = 0; k < 40; k++) {
      const sx = cam + ((((rnd(k, 1) * FW - cam * 0.05) % FW) + FW) % FW);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(clock / 700 + k));
      ctx.fillStyle = `rgba(235,240,255,${0.2 + 0.45 * tw * rnd(k, 3)})`;
      ctx.fillRect(sx, 1 + rnd(k, 2) * 20, 0.22 + rnd(k, 4) * 0.12, 0.22);
    }
    const mx = cam + 68 - cam * 0.02;
    glow(ctx, "220,228,255", mx, 10, 13, 0.4);
    ctx.fillStyle = "#f2efe2";
    disc(ctx, mx, 10, 3.8);
    ctx.fillStyle = "rgba(160,160,180,0.5)";
    disc(ctx, mx - 1.1, 9, 0.9);
    disc(ctx, mx + 1.3, 11, 1);
  }

  // A row of roofs at parallax `f`: gabled houses `slot` wide on a base `base` down from the top, the
  // tall ones a church spire, `lit` the share of windows glowing.
  function skyline(ctx, cam, f, slot, base, hmin, hmax, body, roof, lit, clock, seed) {
    const lo = cam * f - 24;
    const hi = cam * f + FW + 24;
    for (let n = Math.floor(lo / slot); n * slot < hi; n++) {
      const x = n * slot + cam * (1 - f);
      const w = slot * (0.62 + rnd(n, seed) * 0.34);
      const h = hmin + rnd(n, seed + 1) * (hmax - hmin);
      const top = base - h;
      ctx.fillStyle = body;
      ctx.fillRect(x, top, w, h + 8);
      ctx.fillStyle = roof;
      poly(ctx, [[x - 0.8, top], [x + w / 2, top - w * 0.38], [x + w + 0.8, top]]);
      ctx.fill();
      if (rnd(n, seed + 2) > 0.55) ctx.fillRect(x + w * 0.7, top - w * 0.4, 1.1, w * 0.4);
      if (n % 9 === 4) {
        ctx.fillStyle = roof;
        poly(ctx, [[x + w * 0.3, top], [x + w / 2, top - 15], [x + w * 0.7, top]]);
        ctx.fill();
      }
      if (lit > 0) {
        for (let r = 0; r < 2; r++) {
          for (let cx = 0; cx < 2; cx++) {
            const on = rnd(n * 7 + r * 2 + cx, seed + 3) < lit && Math.sin(clock / (600 + rnd(n, 9) * 500) + n + r) > -0.7;
            if (!on) continue;
            ctx.fillStyle = "#ffc070";
            ctx.fillRect(x + w * (0.22 + cx * 0.4), top + 2 + r * 4.2, 1.5, 2.1);
          }
        }
      }
    }
  }

  /* ------------------------------------------------------------ the street */

  // The houses along the street at the road's own pace: a door, windows, a lantern, a sign over a tavern.
  function street(ctx, v, R, cam, lo, hi) {
    const clock = v.clock;
    const base = Y(13.8);
    for (let n = Math.floor((cam - 14) / 24); n * 24 < cam + FW + 14; n++) {
      const x = n * 24 + 1;
      const mid = x + 11;
      if (R.bridge && mid > R.bridge[0] - 14 && mid < R.bridge[1] + 12) continue;
      if (mid > R.finish - 10) continue;
      const w = 21 + rnd(n, 1) * 2;
      const h = 17 + rnd(n, 2) * 8;
      const top = base - h;
      const tone = rnd(n, 3);
      ctx.fillStyle = tone < 0.34 ? "#241c30" : tone < 0.67 ? "#2c2028" : "#1e2230";
      ctx.fillRect(x, top, w, h + 1);
      // Timber framing.
      ctx.strokeStyle = "rgba(10,6,12,0.55)";
      ctx.lineWidth = 0.28;
      seg(ctx, x + w * 0.33, top, x + w * 0.33, base);
      seg(ctx, x + w * 0.66, top, x + w * 0.66, base);
      seg(ctx, x, top + h * 0.45, x + w, top + h * 0.45);
      // The roof, with a chimney.
      ctx.fillStyle = "#14101c";
      poly(ctx, [[x - 1.4, top + 0.2], [x + w / 2, top - 6.4 - rnd(n, 4) * 2], [x + w + 1.4, top + 0.2]]);
      ctx.fill();
      ctx.fillRect(x + w * (0.15 + rnd(n, 5) * 0.55), top - 6, 1.6, 4);
      // Windows, some lit and one a twitching curtain.
      for (const [wx, wy] of [[0.12, 0.12], [0.5, 0.12], [0.12, 0.55], [0.5, 0.55]]) {
        if (wy > 0.5 && wx < 0.3 && rnd(n, 6) > 0.5) continue;
        const px = x + w * wx + 0.5;
        const py = top + h * wy + 1.5;
        const on = rnd(n * 5 + Math.round(wx * 9), 8) > 0.38;
        ctx.fillStyle = on ? "#ffbe62" : "#0c0a14";
        ctx.fillRect(px, py, 3.4, 4.2);
        ctx.strokeStyle = "#0a0610";
        ctx.lineWidth = 0.2;
        seg(ctx, px + 1.7, py, px + 1.7, py + 4.2);
        seg(ctx, px, py + 2.1, px + 3.4, py + 2.1);
        if (on && rnd(n, 11) > 0.5 && Math.sin(clock / 500 + n * 3 + wx * 9) > 0.55) {
          ctx.fillStyle = "#6a3a2a";
          ctx.fillRect(px + 1.2, py, 1.1, 3.4);
        }
        if (on) glow(ctx, WARM, px + 1.7, py + 2.1, 4.4, 0.3);
      }
      // The door, and a lantern beside it.
      const dx = x + w * (0.72 + rnd(n, 12) * 0.08);
      ctx.fillStyle = "#1a0e0a";
      ctx.fillRect(dx, base - 6.4, 3.4, 6.4);
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(dx + 0.3, base - 6.1, 2.8, 0.3);
      ctx.fillStyle = "#2a3a2a";
      ctx.fillRect(dx - 0.6, base - 0.5, 4.6, 0.5);
      const lx = dx - 1.4;
      ctx.fillStyle = "#ffcf7a";
      ctx.fillRect(lx, base - 6.6, 0.8, 1.2);
      glow(ctx, WARM, lx + 0.4, base - 6, 5, 0.4 + 0.1 * Math.sin(clock / 170 + n));
      // A tavern's hanging sign.
      if (rnd(n, 13) > 0.7) {
        ctx.fillStyle = "#3a2616";
        ctx.fillRect(x + w - 0.2, top + h * 0.3, 3.2, 0.3);
        ctx.fillStyle = "#5a3c20";
        ctx.fillRect(x + w + 0.8, top + h * 0.3 + 0.3, 1.9, 2.2);
      }
    }
  }

  /* ------------------------------------------------------------- the road */

  // The cobbled road on each line, a dark earth under it, the ditches between.
  function road(ctx, R, lo, hi) {
    for (const pts of R.track) {
      const a = pts[0][0];
      const b = pts[pts.length - 1][0];
      if (b < lo || a > hi) continue;
      const top = pts.map(([x, y]) => [x, Y(y - WHEEL)]);
      ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#16121c"], [1, "#0a0810"]]);
      poly(ctx, [...top, [b, FH + 1], [a, FH + 1]]);
      ctx.fill();
      // The cobbled face.
      ctx.fillStyle = vgrad(ctx, FH - 24, FH, [[0, "#6c6672"], [1, "#2a2630"]]);
      poly(ctx, [...top, ...top.map(([x, y]) => [x, y + 3.4]).reverse()]);
      ctx.fill();
      ctx.strokeStyle = "rgba(10,8,14,0.55)";
      ctx.lineWidth = 0.14;
      for (let x = Math.max(a, Math.floor(lo / 2.2) * 2.2); x <= Math.min(b, hi); x += 2.2) {
        const y = yOn(pts, x);
        seg(ctx, x, Y(y - WHEEL) + 0.1, x + 0.2, Y(y - WHEEL) + 3.2);
      }
      for (let r = 1; r < 3; r++) {
        ctx.beginPath();
        for (let x = Math.max(a, lo); x <= Math.min(b, hi); x += 2.2) ctx.lineTo(x, Y(yOn(pts, x) - WHEEL) + r * 1.1);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(255,225,190,0.35)";
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      for (let x = Math.max(a, lo); x <= Math.min(b, hi); x += 2.2) ctx.lineTo(x, Y(yOn(pts, x) - WHEEL));
      ctx.stroke();
    }
  }

  // The gaps between lines: a ditch of dark mud and a puddle's glint, or the river under the bridge.
  function gaps(ctx, v, R, lo, hi) {
    for (let i = 0; i + 1 < R.track.length; i++) {
      const a = R.track[i].at(-1);
      const b = R.track[i + 1][0];
      if (b[0] < lo || a[0] > hi) continue;
      const ya = Y(a[1] - WHEEL);
      const yb = Y(b[1] - WHEEL);
      const bridge = R.bridge && a[0] >= R.bridge[0] && a[0] <= R.bridge[1];
      // The broken edges, jagged stone.
      ctx.fillStyle = bridge ? "#3c3a48" : "#2a242c";
      poly(ctx, [[a[0], ya], [a[0] + 0.6, ya + 1.4], [a[0] - 0.4, ya + 2.6], [a[0] + 0.5, ya + 4], [a[0] - 0.2, ya + 6], [a[0] - 3, ya + 6], [a[0] - 3, ya]]);
      ctx.fill();
      poly(ctx, [[b[0], yb], [b[0] - 0.6, yb + 1.6], [b[0] + 0.4, yb + 3], [b[0] - 0.5, yb + 4.4], [b[0] + 0.2, yb + 6], [b[0] + 3, yb + 6], [b[0] + 3, yb]]);
      ctx.fill();
      if (!bridge) {
        ctx.fillStyle = "#07060e";
        ctx.fillRect(a[0], Math.min(ya, yb), b[0] - a[0], FH - Math.min(ya, yb) + 1);
        ctx.fillStyle = "rgba(60,90,130,0.45)";
        ellipse(ctx, (a[0] + b[0]) / 2, FH - 3.2, (b[0] - a[0]) / 2, 0.5);
        ctx.fill();
      }
    }
  }

  // The old stone bridge: the arches under the hump, the river below with the moon's glint, the parapet along the top.
  function bridge(ctx, v, R, cam, lo, hi) {
    const [bx0, bx1] = R.bridge;
    if (bx1 < lo || bx0 > hi) return;
    const clock = v.clock;
    const wy = FH - WATER;
    // The river, behind everything under the road.
    ctx.fillStyle = vgrad(ctx, wy, FH, [[0, "#14284a"], [1, "#060a18"]]);
    ctx.fillRect(Math.max(bx0 - 6, lo), wy, Math.min(bx1 + 6, hi) - Math.max(bx0 - 6, lo), WATER + 1);
    ctx.strokeStyle = "rgba(190,210,255,0.25)";
    ctx.lineWidth = 0.16;
    for (let k = 0; k < 14; k++) {
      const x = Math.max(bx0 - 6, lo) + rnd(k, 5) * (Math.min(bx1 + 6, hi) - Math.max(bx0 - 6, lo));
      const y = wy + 1 + rnd(k, 6) * (WATER - 1.5);
      seg(ctx, x, y, x + 2 + Math.sin(clock / 500 + k) * 0.6, y);
    }
    // The stone body of the bridge under the line's hump, with arches cut out.
    for (const pts of R.track) {
      const a = Math.max(pts[0][0], bx0, lo);
      const b = Math.min(pts[pts.length - 1][0], bx1, hi);
      if (b <= a) continue;
      const top = [];
      for (let x = a; x <= b + 0.01; x += 2) top.push([x, Y(yOn(pts, x) - WHEEL)]);
      top.push([b, Y(yOn(pts, b) - WHEEL)]);
      ctx.fillStyle = "#2c2a3a";
      poly(ctx, [...top, [b, wy + 0.5], [a, wy + 0.5]]);
      ctx.fill();
      ctx.fillStyle = "#060914";
      for (let x = Math.ceil(a / 44) * 44 + 20; x < b - 6; x += 44) {
        ctx.beginPath();
        ctx.moveTo(x - 9, wy + 0.5);
        ctx.lineTo(x - 9, wy - 4.5);
        ctx.arc(x, wy - 4.5, 9, Math.PI, 0);
        ctx.lineTo(x + 9, wy + 0.5);
        ctx.closePath();
        ctx.fill();
      }
      // The parapet along the top, with a capstone, and a lamp now and then.
      ctx.fillStyle = "#3a384a";
      poly(ctx, [...top.map(([x, y]) => [x, y - 3]), ...top.slice().reverse()]);
      ctx.fill();
      ctx.fillStyle = "#54516a";
      poly(ctx, [...top.map(([x, y]) => [x, y - 3.3]), ...top.map(([x, y]) => [x, y - 2.8]).reverse()]);
      ctx.fill();
      ctx.strokeStyle = "rgba(10,8,18,0.5)";
      ctx.lineWidth = 0.14;
      for (let x = Math.ceil(a / 3.6) * 3.6; x < b; x += 3.6) {
        const y = Y(yOn(pts, x) - WHEEL);
        seg(ctx, x, y - 3, x, y);
      }
    }
    for (let x = Math.ceil(bx0 / 60) * 60 + 10; x < bx1; x += 60) {
      if (x < lo || x > hi) continue;
      const y = Y((heightAt(R, x) ?? deckNear(R, x)) - WHEEL);
      ctx.fillStyle = "#1c1a26";
      ctx.fillRect(x - 0.25, y - 8.5, 0.5, 5.5);
      ctx.fillStyle = "#ffd488";
      ctx.fillRect(x - 0.7, y - 9.6, 1.4, 1.3);
      glow(ctx, WARM, x, y - 9, 6, 0.4 + 0.08 * Math.sin(clock / 150 + x));
    }
  }

  /* ----------------------------------------------------------- the things */

  // A barrel with hoops, or a crate with an X: tall from the road, with the cargo's top a little over the deck.
  function block(ctx, x, base, kind, i) {
    const h = WHEEL + 3.4;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, x + 0.4, base, kind ? 2 : 1.7, 0.35);
    ctx.fill();
    if (kind) {
      const w = 3.4;
      ctx.fillStyle = "#7a5a34";
      ctx.fillRect(x - w / 2, base - h, w, h);
      ctx.fillStyle = "#5a3e22";
      ctx.fillRect(x - w / 2, base - h, w, 0.5);
      ctx.fillRect(x - w / 2, base - 0.5, w, 0.5);
      ctx.fillRect(x - w / 2, base - h, 0.5, h);
      ctx.fillRect(x + w / 2 - 0.5, base - h, 0.5, h);
      ctx.strokeStyle = "#5a3e22";
      ctx.lineWidth = 0.3;
      seg(ctx, x - w / 2 + 0.4, base - h + 0.4, x + w / 2 - 0.4, base - 0.4);
      seg(ctx, x + w / 2 - 0.4, base - h + 0.4, x - w / 2 + 0.4, base - 0.4);
      ctx.fillStyle = "rgba(255,225,170,0.2)";
      ctx.fillRect(x - w / 2 + 0.3, base - h + 0.3, w - 0.6, 0.25);
      return;
    }
    const w = 2.6;
    ctx.fillStyle = "#6a4426";
    ctx.beginPath();
    ctx.moveTo(x - w / 2, base);
    ctx.quadraticCurveTo(x - w / 2 - 0.5, base - h / 2, x - w / 2, base - h);
    ctx.lineTo(x + w / 2, base - h);
    ctx.quadraticCurveTo(x + w / 2 + 0.5, base - h / 2, x + w / 2, base);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,210,150,0.22)";
    ctx.fillRect(x - w / 2 + 0.2, base - h, 0.5, h);
    ctx.fillStyle = "#2c2c34";
    for (const f of [0.18, 0.5, 0.82]) ctx.fillRect(x - w / 2 - 0.3, base - h * f - 0.2, w + 0.6, 0.4);
    ctx.fillStyle = "#3a2414";
    ellipse(ctx, x, base - h, w / 2, 0.4);
    ctx.fill();
    if (i % 2) {
      ctx.fillStyle = "#c8b890";
      ctx.fillRect(x - 0.5, base - h * 0.62, 1, 1.2);
    }
  }

  // A thrower's perch: a lit window with a shutter (kind 0) or a roof ledge (kind 1) and the villager in it.
  function thrower(ctx, v, x, deck, kind, t) {
    const clock = v.clock;
    const wind = t.state === "wind" ? 1 - clamp(t.t / WIND_MS, 0, 1) : t.state === "spent" ? 1 : 0;
    if (kind === 0) {
      const cy = Y(deck + 8.5);
      ctx.fillStyle = "#120c14";
      ctx.fillRect(x - 2.4, cy - 3, 4.8, 5.8);
      ctx.fillStyle = "#ffb85a";
      ctx.fillRect(x - 1.9, cy - 2.5, 3.8, 4.8);
      glow(ctx, WARM, x, cy, 7, 0.5);
      // Him: a face, a nightcap and a shoulder, the pitchfork arm cocked back as he winds up.
      ctx.fillStyle = "#281a20";
      ellipse(ctx, x, cy + 2.3, 1.6, 1.3);
      ctx.fill();
      ctx.fillStyle = "#d9b08a";
      disc(ctx, x, cy - 0.3, 0.95);
      ctx.fillStyle = "#e8e0d0";
      poly(ctx, [[x - 1, cy - 0.9], [x + 0.2, cy - 2.7], [x + 1.1, cy - 0.9]]);
      ctx.fill();
      ctx.fillStyle = "#1c1014";
      disc(ctx, x - 0.35, cy - 0.35, 0.18);
      disc(ctx, x + 0.35, cy - 0.35, 0.18);
      ctx.fillRect(x - 0.4, cy + 0.2, 0.8, 0.25);
      if (t.state !== "spent") {
        const ang = -0.5 - wind * 0.9;
        ctx.save();
        ctx.translate(x + 0.6, cy + 1.6);
        ctx.rotate(ang);
        ctx.strokeStyle = "#5a4028";
        ctx.lineWidth = 0.28;
        seg(ctx, -0.5, 0, 3.6, 0);
        ctx.strokeStyle = "#b0b4c0";
        ctx.lineWidth = 0.2;
        seg(ctx, 3.6, -0.6, 3.6, 0.6);
        for (const o of [-0.6, 0, 0.6]) seg(ctx, 3.6, o, 4.8, o);
        ctx.restore();
      }
      // The open shutters.
      ctx.fillStyle = "#3a2a1e";
      ctx.fillRect(x - 3.4, cy - 3, 1, 5.8);
      ctx.fillRect(x + 2.4, cy - 3, 1, 5.8);
      return;
    }
    // On the roof: a ledge of tiles, and a villager raising a torch.
    const ry = Y(deck + 11);
    ctx.fillStyle = "#1a1220";
    poly(ctx, [[x - 4.6, ry + 1.2], [x - 3.4, ry - 0.2], [x + 3.4, ry - 0.2], [x + 4.6, ry + 1.2]]);
    ctx.fill();
    ctx.fillStyle = "#2c2030";
    ctx.fillRect(x - 3.4, ry - 0.2, 6.8, 0.35);
    ctx.fillStyle = "#1c141c";
    ellipse(ctx, x, ry - 1.9, 1.1, 1.8);
    ctx.fill();
    ctx.fillStyle = "#d4aa84";
    disc(ctx, x, ry - 4.2, 0.9);
    ctx.fillStyle = "#14101a";
    poly(ctx, [[x - 1.1, ry - 4.7], [x, ry - 6.1], [x + 1.1, ry - 4.7]]);
    ctx.fill();
    if (t.state !== "spent") {
      const up = 0.7 + wind * 0.9;
      ctx.strokeStyle = "#1c141c";
      ctx.lineWidth = 0.4;
      seg(ctx, x + 0.6, ry - 2.8, x + 1.4 + wind * 0.8, ry - 2.8 - up * 1.8);
      torch(ctx, x + 1.4 + wind * 0.8, ry - 2.8 - up * 1.8, -0.2, clock, 0.9);
    }
  }

  // A torch held at (x, y), tilted by `ang` off upright: the stick and a flame that flickers.
  function torch(ctx, x, y, ang, clock, size = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = "#3a2414";
    ctx.lineWidth = 0.34 * size;
    seg(ctx, 0, 1.2 * size, 0, -0.3 * size);
    const f = 1 + 0.18 * Math.sin(clock / 60 + x * 3) + 0.1 * Math.sin(clock / 37 + y);
    ctx.fillStyle = "#ff7a22";
    poly(ctx, [[-0.7 * size, -0.2 * size], [0, -2.5 * size * f], [0.75 * size, -0.2 * size]]);
    ctx.fill();
    ctx.fillStyle = "#ffd25a";
    poly(ctx, [[-0.4 * size, -0.2 * size], [0, -1.6 * size * f], [0.45 * size, -0.2 * size]]);
    ctx.fill();
    ctx.restore();
    glow(ctx, WARM, x, y - 1.2 * size, 4.4 * size, 0.55);
  }

  // A pitchfork flying left: the shaft and three tines, along its line of flight.
  function fork(ctx, x, y, ang) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.strokeStyle = "#5a4028";
    ctx.lineWidth = 0.3;
    seg(ctx, -1.8, 0, 1.6, 0);
    ctx.strokeStyle = "#c4c8d4";
    ctx.lineWidth = 0.2;
    seg(ctx, -1.8, -0.7, -1.8, 0.7);
    for (const o of [-0.7, 0, 0.7]) seg(ctx, -1.8, o, -3.1, o);
    ctx.restore();
  }

  // A horse seen side on at (x, base), facing `dir`: galloping (`pose` "run"), rearing, or standing, its color, `lift` of the legs tucking in the air.
  function horse(ctx, x, base, dir, pose, clock, color, mane, tuck = 0) {
    ctx.save();
    ctx.translate(x, base);
    ctx.scale(dir, 1);
    const rear = pose === "rear";
    if (rear) ctx.rotate(-0.75);
    const gal = Math.sin(clock / 65 + x);
    // Legs behind the body.
    ctx.strokeStyle = "#1c1218";
    ctx.lineWidth = 0.55;
    const leg = (hx, ph, front) => {
      const sw = rear && front ? -1.2 : Math.sin(clock / 65 + ph) * (pose === "run" ? 1.5 : 0.3) * (1 - tuck);
      const lift = pose === "run" ? Math.max(0, Math.cos(clock / 65 + ph)) * 0.8 * (1 - tuck) : 0;
      ctx.beginPath();
      ctx.moveTo(hx, -2.1);
      ctx.lineTo(hx + sw * 0.5, -1.1 - lift - tuck);
      ctx.lineTo(hx + sw, -lift - tuck * 1.2);
      ctx.stroke();
    };
    leg(-1.7, 0, false);
    leg(-1.1, 1.6, false);
    ctx.fillStyle = color;
    // The body, the neck and the head.
    ellipse(ctx, 0, -2.9 + gal * 0.12, 2.5, 1.25);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1.3, -3.4);
    ctx.quadraticCurveTo(2.5, -4.6, 2.9, -5.6);
    ctx.lineTo(3.9, -5.3);
    ctx.quadraticCurveTo(3.4, -4.0, 2.2, -2.7);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(2.9, -5.9);
    ctx.lineTo(4.9, -5.3);
    ctx.lineTo(4.7, -4.5);
    ctx.lineTo(2.9, -4.8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mane;
    poly(ctx, [[1.1, -3.7], [2.2, -5.5], [2.8, -6.1], [2.6, -5.0], [1.7, -3.4]]);
    ctx.fill();
    poly(ctx, [[-2.4, -3.2], [-3.6, -2.3 + gal * 0.4], [-3.4, -3.8], [-2.3, -3.6]]);
    ctx.fill();
    ctx.fillStyle = "#fff4e0";
    disc(ctx, 3.8, -5.35, 0.22);
    ctx.fillStyle = "#ff5a3a";
    disc(ctx, 3.85, -5.35, 0.1);
    leg(1.5, 0.8, true);
    leg(1.0, 2.4, true);
    ctx.restore();
  }

  // A villager of the mob, running right: legs, a cloak, the head, and a torch or a pitchfork held high.
  function mobber(ctx, x, base, i, clock, close) {
    const ph = clock / 80 + i * 1.7;
    const h = 4.6 + rnd(i, 1) * 0.6;
    ctx.strokeStyle = "#0c0810";
    ctx.lineWidth = 0.5;
    seg(ctx, x - 0.2, base - 2, x - 0.2 + Math.sin(ph) * 1.1, base - Math.max(0, Math.cos(ph)) * 0.7);
    seg(ctx, x + 0.2, base - 2, x + 0.2 - Math.sin(ph) * 1.1, base - Math.max(0, -Math.cos(ph)) * 0.7);
    ctx.fillStyle = ["#2a1c22", "#1e2230", "#2a2418", "#201a2c"][i % 4];
    poly(ctx, [[x - 1.3, base - 1.7 + Math.sin(ph * 2) * 0.1], [x - 0.9, base - h + 1], [x + 0.8, base - h + 1], [x + 1.1, base - 1.7], [x + 0.2, base - 1.2]]);
    ctx.fill();
    ctx.fillStyle = "#cfa882";
    disc(ctx, x + 0.2, base - h + 0.2, 0.85);
    ctx.fillStyle = "#14101a";
    if (i % 3 === 0) poly(ctx, [[x - 0.9, base - h + 0.1], [x + 0.2, base - h - 1.2], [x + 1.3, base - h + 0.1]]);
    else ctx.fillRect(x - 0.9, base - h - 0.5, 2.2, 0.7);
    ctx.fill();
    // The arm and what it holds, lit by the torches.
    const ax = x + 0.7;
    const ay = base - h + 1.6;
    ctx.strokeStyle = "#1c141c";
    ctx.lineWidth = 0.4;
    if (i % 3 === 1) {
      seg(ctx, ax, ay, ax + 0.9, ay - 1.8);
      ctx.strokeStyle = "#5a4028";
      ctx.lineWidth = 0.28;
      seg(ctx, ax + 0.9, ay + 0.4, ax + 1.4, ay - 4.4);
      ctx.strokeStyle = "#c0c4d0";
      ctx.lineWidth = 0.2;
      seg(ctx, ax + 0.8, ay - 4.4, ax + 2.0, ay - 4.4);
      for (const o of [0.8, 1.4, 2.0]) seg(ctx, ax + o, ay - 4.4, ax + o + 0.1, ay - 5.6);
    } else {
      seg(ctx, ax, ay, ax + 0.9, ay - 1.6);
      torch(ctx, ax + 1.0, ay - 2.4 + Math.sin(ph) * 0.2, 0.1 + 0.05 * Math.sin(ph), clock + i * 40, 1);
    }
    void close;
  }

  // A moonhound at a gallop, running right: lean gray, long legs, eyes that glow.
  function hound(ctx, x, base, i, clock) {
    const ph = clock / 55 + i * 2.1;
    const bob = Math.sin(ph) * 0.35;
    ctx.save();
    ctx.translate(x, base);
    ctx.strokeStyle = "#8a90a4";
    ctx.lineWidth = 0.42;
    for (const [lx, o] of [[-1.5, 0], [-0.9, 1.6], [1.0, 0.8], [1.6, 2.4]]) {
      const sw = Math.sin(ph + o) * 1.5;
      ctx.beginPath();
      ctx.moveTo(lx, -1.9);
      ctx.lineTo(lx + sw * 0.5, -1.0 - Math.max(0, Math.cos(ph + o)) * 0.7);
      ctx.lineTo(lx + sw, -Math.max(0, Math.cos(ph + o)) * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = "#a4abbe";
    ellipse(ctx, 0, -2.6 + bob, 2.2, 0.95);
    ctx.fill();
    poly(ctx, [[1.5, -3.2 + bob], [3.2, -3.9 + bob], [4.5, -3.3 + bob], [3.3, -2.6 + bob], [1.6, -2.4 + bob]]);
    ctx.fill();
    ctx.fillStyle = "#6a7088";
    poly(ctx, [[2.4, -3.8 + bob], [2.9, -4.9 + bob], [3.3, -3.8 + bob]]);
    ctx.fill();
    poly(ctx, [[-2.1, -2.7 + bob], [-3.8, -3.4 + bob + Math.sin(ph) * 0.3], [-2.0, -2.3 + bob]]);
    ctx.fill();
    ctx.fillStyle = "#ffd25a";
    disc(ctx, 3.3, -3.4 + bob, 0.2);
    ctx.restore();
    glow(ctx, "255,210,90", x + 3.3, base - 3.4 + bob, 1.6, 0.5);
  }

  // The mob behind the wagon: the front man `gap` back, the villagers and the hounds streaming after,
  // lit by their own torches.
  function theMob(ctx, v, R, c, fx) {
    const you = v.round.you;
    const clock = v.clock;
    const gd = fx.wagonGap;
    const front = you.x - gd;
    const close = clamp(1 - gd / GAP_MAX, 0, 1);
    glow(ctx, WARM, front - 6, Y(roadAt(R, front) + 6), 26, 0.35 + 0.35 * close);
    // The hounds run ahead of the men.
    for (let i = 0; i < 3; i++) {
      const hx = front + 3.6 - i * 3.2 + Math.sin(clock / 300 + i) * 0.5;
      hound(ctx, hx, Y(deckNear(R, hx) - WHEEL), i, clock);
    }
    for (let i = 0; i < 12; i++) {
      const mx = front - 1.5 - i * 2.4 - rnd(i, 4) * 1.2;
      if (mx < v.round.camX - 4) break;
      const by = Y(deckNear(R, mx) - WHEEL) + (i % 2 ? 0.15 : -0.1);
      mobber(ctx, mx, by, i, clock, close);
    }
  }

  /* ------------------------------------------------------------- the wagon */

  // The wagon, side on: the horse, the pole, the bed with its wheels, the hay load (charred and burning
  // when a torch has landed). Planny stands on the bed; the game draws him after this.
  function wagon(ctx, v, R, c) {
    const you = v.round.you;
    const clock = v.clock;
    const air = c.line < 0;
    const x = c.done && c.restX !== undefined ? c.restX : you.x;
    const y = c.done ? Y(deckNear(R, x)) : Y(you.y);
    const tilt = air ? clamp(you.vy / 90, -0.22, 0.22) : 0;
    const burning = c.fireMs > 0;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-tilt);
    // The horse, galloping hard, ahead of the pole.
    horse(ctx, 8.6, WHEEL - 0.1 + (air ? 0 : Math.sin(clock / 65) * 0.12), 1, c.done ? "stand" : "run", clock, "#5a4030", "#1c1410", air ? 0.8 : c.braking ? 0.3 : 0);
    // The harness and the pole.
    ctx.strokeStyle = "#3a2616";
    ctx.lineWidth = 0.4;
    seg(ctx, 3.2, 0.3, 7.6, -1.4);
    ctx.strokeStyle = "#8a6a44";
    ctx.lineWidth = 0.14;
    seg(ctx, 7.8, -2.2, 3.4, -0.6);
    // The bed and the side rails.
    ctx.fillStyle = "#6a4a2c";
    ctx.fillRect(-5.4, 0, 9, 0.9);
    ctx.fillStyle = "#4a3220";
    ctx.fillRect(-5.4, 0.7, 9, 0.35);
    ctx.fillStyle = "#7c5a36";
    ctx.fillRect(-5.4, -2.8, 0.5, 2.8);
    ctx.fillRect(2.9, -2.4, 0.5, 2.4);
    // The hay: a heap of bales over the bed's back half.
    const hay = burning ? ["#6a4a20", "#4a3418", "#2c2014"] : ["#e0bf5a", "#c8a040", "#a68230"];
    ctx.fillStyle = hay[0];
    ctx.beginPath();
    ctx.moveTo(-5.0, 0);
    ctx.quadraticCurveTo(-5.2, -3.8, -3.2, -4.2);
    ctx.quadraticCurveTo(-1.2, -4.6, -0.6, -2.4);
    ctx.lineTo(-0.5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = hay[2];
    ctx.lineWidth = 0.14;
    for (let k = 0; k < 6; k++) seg(ctx, -4.6 + k * 0.7, -0.6, -4.4 + k * 0.7 + (k % 2) * 0.4, -3.6 + (k % 3) * 0.3);
    ctx.fillStyle = hay[1];
    ctx.fillRect(-5, -2.1, 4.4, 0.25);
    ctx.fillRect(-4.4, -3.5, 3.4, 0.25);
    // The driver's footboard.
    ctx.fillStyle = "#4a3220";
    ctx.fillRect(1.2, -1.2, 1.7, 1.2);
    ctx.fillStyle = "#3a2616";
    ctx.fillRect(1.2, -1.2, 1.7, 0.3);
    // The wheels, spokes turning with the road.
    const roll = (x * 0.55) % TAU;
    for (const wx of [-3.2, 2.0]) {
      ctx.save();
      ctx.translate(wx, 0.2);
      ctx.fillStyle = "rgba(0,0,0,0.0)";
      ctx.strokeStyle = "#2a1c12";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL - 0.2, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = "#7c5a36";
      ctx.lineWidth = 0.28;
      ctx.beginPath();
      ctx.arc(0, 0, WHEEL - 0.55, 0, TAU);
      ctx.stroke();
      ctx.lineWidth = 0.22;
      for (let k = 0; k < 6; k++) seg(ctx, 0, 0, Math.cos(roll + (k * TAU) / 6) * (WHEEL - 0.6), Math.sin(roll + (k * TAU) / 6) * (WHEEL - 0.6));
      ctx.fillStyle = "#c9a24a";
      disc(ctx, 0, 0, 0.35);
      ctx.restore();
    }
    ctx.restore();
    // Sparks off the wheels while braking, dust behind.
    if (!c.done && c.line >= 0) {
      const f = clamp(c.v / WAGON_V, 0.4, 1.4);
      for (let k = 0; k < 8; k++) {
        const p = (clock / (300 + (k % 3) * 60) + k * 0.137) % 1;
        ctx.fillStyle = `rgba(120,108,128,${(1 - p) * 0.4})`;
        disc(ctx, x - 5 - p * 4 * f * (0.6 + rnd(k, 1)), y + WHEEL - 0.4 - p * (0.6 + rnd(k, 2) * 1.2), 0.25 + p * 0.35);
      }
      if (c.braking) {
        for (let k = 0; k < 7; k++) {
          const p = (clock / 160 + k * 0.19) % 1;
          ctx.fillStyle = `rgba(255,${180 + ((k * 17) % 60)},90,${1 - p})`;
          ctx.fillRect(x - 3.2 - p * 3.5, y + WHEEL - 0.5 - p * 0.9 * rnd(k, 3), 0.28, 0.28);
          ctx.fillRect(x + 2.0 - p * 3, y + WHEEL - 0.5 - p * 0.9 * rnd(k, 4), 0.28, 0.28);
        }
      }
    }
  }

  // The hay's fire, in front of Planny: flames licking up off the load, smoke streaming back.
  function hayFire(ctx, v, c) {
    const you = v.round.you;
    const clock = v.clock;
    const x = you.x;
    const y = Y(you.y);
    const k = clamp(c.fireMs / 500, 0.3, 1);
    for (let i = 0; i < 9; i++) {
      const fx0 = x - 4.8 + (i % 5) * 0.95 + rnd(i, 1) * 0.3;
      const hh = (1.4 + rnd(i, 2) * 1.5 + Math.sin(clock / 70 + i * 2) * 0.5) * k;
      const by = y - 1.6 - (i % 3) * 0.55;
      ctx.fillStyle = i % 2 ? "#ff7a22" : "#ff5a1a";
      poly(ctx, [[fx0 - 0.55, by], [fx0 + Math.sin(clock / 90 + i) * 0.3, by - hh * 1.4], [fx0 + 0.55, by]]);
      ctx.fill();
      ctx.fillStyle = "#ffd25a";
      poly(ctx, [[fx0 - 0.3, by], [fx0, by - hh * 0.8], [fx0 + 0.3, by]]);
      ctx.fill();
    }
    glow(ctx, "255,120,40", x - 2.8, y - 3, 9, 0.5 * k + 0.1 * Math.sin(clock / 60));
    for (let i = 0; i < 6; i++) {
      const p = (clock / 700 + i * 0.17) % 1;
      ctx.fillStyle = `rgba(40,34,44,${(1 - p) * 0.5})`;
      disc(ctx, x - 4 - p * 7, y - 4 - p * 3.4, 0.5 + p * 1.1);
    }
  }

  /* ------------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.runner;
    if (!R || !c || c.id !== "wagon") return;
    FH = v.g.FIELD_H;
    const clock = v.clock;
    cam = Math.round(cam * 8) / 8;
    const lo = cam - 10;
    const hi = cam + FW + 10;
    sky(ctx, cam, clock);
    skyline(ctx, cam, 0.14, 14, FH - 18, 7, 13, "#0c1128", "#0a0e22", 0, clock, 10);
    skyline(ctx, cam, 0.4, 22, FH - 13, 11, 18, "#171630", "#0f0e20", 0.7, clock, 20);
    street(ctx, v, R, cam, lo, hi);
    bridge(ctx, v, R, cam, lo, hi);
    road(ctx, R, lo, hi);
    gaps(ctx, v, R, lo, hi);
    // Checkpoints: a lamp post and a bell.
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, Y(roadAt(R, x)), i <= c.check);
    });
    if (R.finish > lo - 14 && R.finish < hi) gate(ctx, v, R, R.finish);
    // The throwers' perches, the things in the road, the loose horses.
    R.throwers.forEach(([x, line, kind], i) => {
      if (x > lo - 6 && x < hi + 6) thrower(ctx, v, x, deckNear(R, x), kind, c.throwers[i]);
    });
    R.blocks.forEach(([x, line, kind], i) => {
      if (x > lo && x < hi && !c.smashed[i]) block(ctx, x, Y(roadAt(R, x)), kind, i);
    });
    R.horses.forEach(([hx, line], i) => {
      const h = c.horses[i];
      if (h.state === "gone" || h.x < lo - 6 || h.x > hi + 6) return;
      const dir = h.state === "fled" ? -1 : -1;
      const base = Y(roadAt(R, h.x));
      horse(ctx, h.x, h.state === "hit" ? base - 0.5 : base, dir, h.state === "rear" ? "rear" : h.state === "wait" ? "stand" : "run", clock, "#c9c2b6", "#5a5460");
      if (h.state === "rear") glow(ctx, "255,230,200", h.x, base - 4, 6, 0.18);
    });
    // The end of the road: the green's grass over the sky.
    for (const [a, b, top] of v.spec.ground) if (a >= R.finish - 1 && b > lo && a < hi) ground(ctx, v, LOOKS.wagon, a, b, top);
    const fx = v.fx || {};
    fx.wagonGap = fx.wagonGap === undefined ? c.gap : fx.wagonGap + (c.gap - fx.wagonGap) * 0.22;
    if (!c.done) theMob(ctx, v, R, c, fx);
    wagon(ctx, v, R, c);
  }

  // A lamp post with a bell: dim until passed, then lit green.
  function checkpoint(ctx, v, x, base, passed) {
    ctx.fillStyle = "#1c1a24";
    ctx.fillRect(x - 0.3, base - 8, 0.6, 8);
    ctx.fillRect(x - 0.3, base - 8, 2.4, 0.5);
    ctx.fillStyle = passed ? "#9cffb0" : "#ffcf7a";
    ctx.fillRect(x + 1.5, base - 7.6, 1, 1.4);
    glow(ctx, passed ? "120,255,160" : WARM, x + 2, base - 7, 6, passed ? 0.55 : 0.4);
    ctx.fillStyle = "#c9a24a";
    poly(ctx, [[x - 1.4, base - 5.2], [x - 0.9, base - 6.2], [x - 0.4, base - 5.2]]);
    ctx.fill();
  }

  // The village gate at the end of the road: two stone posts with braziers, and the green beyond.
  function gate(ctx, v, R, x) {
    const base = Y(deckNear(R, x - 14) - WHEEL);
    for (const px of [x + 3, x + 24]) {
      ctx.fillStyle = "#3c3a4a";
      ctx.fillRect(px, base - 15, 2.4, 15);
      ctx.fillStyle = "#54516a";
      ctx.fillRect(px - 0.4, base - 15.6, 3.2, 0.8);
      ctx.fillStyle = "#1c1a24";
      ctx.fillRect(px - 0.2, base - 17.4, 2.8, 1.8);
      ctx.fillStyle = "#ff8a30";
      poly(ctx, [[px + 0.2, base - 17.3], [px + 1.2, base - 20 + Math.sin(v.clock / 70 + px) * 0.4], [px + 2.2, base - 17.3]]);
      ctx.fill();
      glow(ctx, WARM, px + 1.2, base - 18.4, 9, 0.5);
    }
    ctx.strokeStyle = "#2a2434";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x + 5.4, base - 14);
    ctx.quadraticCurveTo(x + 14, base - 17, x + 24, base - 14);
    ctx.stroke();
  }

  /* ------------------------------------------------------------ in front */

  // A washing line: two poles, a sagging rope with shirts hanging down to its underside `y`.
  // An inn sign: a post, a bracket and a board swinging from it, down to `y`.
  function low(ctx, v, R, x0, x1, y, kind, i) {
    const clock = v.clock;
    const under = Y(y);
    const road = Y(roadAt(R, x0));
    if (kind === 0) {
      const xa = x0 - 1.6;
      const xb = x1 + 1.6;
      ctx.fillStyle = "#2c2018";
      ctx.fillRect(xa - 0.25, under - 7.4, 0.5, road - under + 7.4);
      ctx.fillRect(xb - 0.25, under - 7.4, 0.5, road - under + 7.4);
      ctx.strokeStyle = "#8a7a60";
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(xa, under - 5.6);
      ctx.quadraticCurveTo((xa + xb) / 2, under - 4.6, xb, under - 5.6);
      ctx.stroke();
      const cols = ["#d8d4cc", "#b04a4a", "#6a8ac0", "#e0c878", "#9a7ac0"];
      for (let k = 0; k < 4; k++) {
        const px = xa + 1.2 + k * ((xb - xa - 2.4) / 3);
        const sway = Math.sin(clock / 330 + k + i) * 0.25;
        const drop = 4.6 - (k % 2) * 0.4;
        ctx.fillStyle = cols[(k + i) % cols.length];
        poly(ctx, [[px - 1, under - 5.2], [px + 1, under - 5.2], [px + 1.1 + sway, under - 5.2 + drop - 0.1], [px - 0.9 + sway, under - 5.2 + drop]]);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(px - 1, under - 5.2, 2, 0.3);
      }
      glow(ctx, WARM, (x0 + x1) / 2, under - 2, 6, 0.12);
      return;
    }
    const px = x1 + 2.6;
    ctx.fillStyle = "#3a2616";
    ctx.fillRect(px - 0.3, under - 7.2, 0.6, road - under + 7.2);
    ctx.fillRect(x0 - 0.8, under - 6.9, px - x0 + 0.8, 0.5);
    ctx.strokeStyle = "#8a8a98";
    ctx.lineWidth = 0.12;
    const sw = Math.sin(clock / 420 + i) * 0.35;
    seg(ctx, x0, under - 6.4, x0 + sw * 0.4, under - 2.4);
    seg(ctx, x1, under - 6.4, x1 + sw * 0.4, under - 2.4);
    ctx.fillStyle = "#5a3c20";
    ctx.fillRect(x0 - 0.9 + sw, under - 2.6, x1 - x0 + 1.8, 2.7);
    ctx.fillStyle = "#c9a24a";
    ctx.fillRect(x0 - 0.9 + sw, under - 2.6, x1 - x0 + 1.8, 0.3);
    ctx.fillStyle = "#e8d8a8";
    const mx = (x0 + x1) / 2 + sw;
    ctx.fillRect(mx - 0.8, under - 1.9, 1.3, 1.3);
    ctx.strokeStyle = "#e8d8a8";
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(mx + 0.9, under - 1.3, 0.5, -1.4, 1.4);
    ctx.stroke();
    glow(ctx, WARM, mx, under - 1.2, 5, 0.18);
  }

  // A see-through glyph over an obstacle: a pair of chevrons and (for the first few) the word.
  function glyph(ctx, v, t) {
    const up = t.answer === "JUMP";
    const col = ANSWER_COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const bob = Math.sin(v.clock / 260 + t.lead) * 0.35 * (up ? -1 : 1);
    const cy = Math.max(9, Math.min(FH - 7, FH - t.up)) + bob;
    const ay = cy + (up ? -2.6 : 2.6);
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const dir = up ? -1 : 1;
    for (const [pass, w, c] of [[0, 1.3, "rgba(4,4,16,0.8)"], [1, 0.6, col]]) {
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

  // The mob's meter along the top left: how far back they are, red as they close, with a word when it matters.
  function meter(ctx, v, c) {
    const x = 4;
    const y = 9.2;
    const w = 34;
    const near = clamp(1 - c.gap / GAP_MAX, 0, 1);
    ctx.fillStyle = "rgba(6,4,14,0.62)";
    ctx.fillRect(x - 0.8, y - 0.8, w + 1.6, 2.6);
    ctx.fillStyle = "#1c1824";
    ctx.fillRect(x, y, w, 1);
    const col = near < 0.35 ? "#6ee08a" : near < 0.62 ? "#ffc23a" : "#ff4a3a";
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w * near, 1);
    // The catch line, and the panic line.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + w * (1 - CATCH_GAP / GAP_MAX), y - 0.3, 0.25, 1.6);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + w * (1 - PANIC_ON / GAP_MAX), y - 0.2, 0.18, 1.4);
    const word = c.fireMs > 0 ? "HAY ON FIRE" : c.gap < PANIC_ON ? "THEY ARE CLOSE" : "THE MOB";
    const wc = c.fireMs > 0 || c.gap < PANIC_ON ? (Math.sin(v.clock / 110) > 0 ? "#ff6a4a" : "#ffd25a") : "#d8d0e0";
    label(ctx, word, x, y + 3.1, 1.7, wc, "left");
    torch(ctx, x + w * near, y - 0.6, 0, v.clock, 0.7);
  }

  function front(ctx, v) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.runner;
    if (!R || !c || c.id !== "wagon") return;
    FH = v.g.FIELD_H;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 8;
    const hi = cam + FW + 8;
    if (c.fireMs > 0 && !c.done) hayFire(ctx, v, c);
    R.lows.forEach(([x0, x1, y, kind], i) => {
      if (x1 >= lo - 4 && x0 <= hi) low(ctx, v, R, x0, x1, y, kind, i);
    });
    // The throws in the air.
    for (const p of c.props) {
      if (p.x === undefined) continue;
      if (p.dead && !p.kind) continue;
      if (p.dead) {
        // A torch burned out on the road: a last flicker.
        if (p.age < 400) {
          ctx.globalAlpha = 1 - p.age / 400;
          torch(ctx, p.x, Y(p.y) , 1.2, v.clock, 0.8);
          ctx.globalAlpha = 1;
        }
        continue;
      }
      const ahead = propDir(p);
      if (p.kind) torch(ctx, p.x, Y(p.y), ((v.clock / 110) % TAU) * 1, v.clock, 1.1);
      else fork(ctx, p.x, Y(p.y), ahead);
    }
    // What to do about what is coming, over it.
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Splinters, sparks and straw from a crash, tumbling.
    const bits = v.fx && v.fx.wagonBits;
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
    // The mob closing in: the edge of the screen goes red.
    if (!c.done) {
      const red = clamp((PANIC_ON + 6 - c.gap) / 14, 0, 1);
      if (red > 0) {
        ctx.fillStyle = rgrad(ctx, cam, FH / 2, 40, [[0, "rgba(255,50,30,0.5)"], [1, "rgba(255,50,30,0)"]]);
        ctx.globalAlpha = red * (0.5 + 0.3 * Math.sin(v.clock / 120));
        ctx.fillRect(cam, 0, 40, FH);
        ctx.globalAlpha = 1;
      }
      meter(ctx, v, c);
    }
  }

  // The direction a pitchfork flies, as an angle for drawing it.
  const propDir = (p) => Math.atan2(p.y1 - p.y0, p.x0 - p.x1);

  const dim = () => 0;

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const R = ride(v);
    const round = v.round;
    const c = round && round.runner;
    if (!R || !c || c.id !== "wagon") return;
    const you = round.you;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    add(you.x + 3, you.y + 2.2, 10, 0.6);
    if (c.fireMs > 0) add(you.x - 2.5, you.y + 2.5, 12, 0.9);
    add(you.x - c.gap, roadAt(R, you.x - c.gap) + 5, 18 + 12 * clamp(1 - c.gap / GAP_MAX, 0, 1), 0.8);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 2, roadAt(R, x) + 7, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.throwers.forEach(([x, , kind], i) => {
      if (x > lo && x < hi && c.throwers[i].state !== "spent") add(x, deckNear(R, x) + (kind ? 11 : 8.5), 6, 0.45);
    });
    for (const p of c.props) if (!p.dead && p.kind && p.x !== undefined) add(p.x, p.y, 6, 0.6);
    if (v.fx && v.fx.wagonLand && v.fx.clock - v.fx.wagonLand.t0 < 260) add(you.x, you.y + 1, 6, 0.4);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Wood, straw or sparks flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.wagonBits = (fx.wagonBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 10; k++) fx.wagonBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 24, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The brake repeats as it is held; keep it from stacking.
    if (e.type === "wagonBrake" && !gateOnce(fx, "wagonBrakeMs", 220)) return true;
    say(tone, voice[0], voice[1], 0.5);
    switch (e.type) {
      case "wagonJump":
        burst(e.x, e.y, "#8a8496", 5, 7, 300);
        break;
      case "wagonLand":
        fx.wagonLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, "#8a8496", e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(200, 0.5);
        break;
      case "wagonLaunch":
        burst(e.x, e.y, "#ffcf7a", 12, 14, 380);
        float(e.x, e.y + 5, e.last ? "Gate!" : "Jump!", GOLD, 2.2);
        break;
      case "wagonBrake":
        burst(e.x, e.y, "#ffb04a", 4, 6, 240);
        break;
      case "wagonCrash":
        shake(320, 1);
        flash("#ffd8a0", 200);
        burst(e.x, e.y + 1, "#8a5a30", 16, 16, 520);
        splinter(fx, e.x, e.y + 1, ["#8a5a30", "#5a3c20", "#c9a24a"]);
        break;
      case "wagonCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "wagonFinish":
        shake(260, 0.7);
        burst(e.x, e.y, "#6a9a4a", e.big ? 22 : 14, 13, 560);
        float(e.x, e.y + 5, "Made it!", GOLD, 2.6);
        break;
      case "wagonPanic":
        float(e.x, e.y + 6, "Faster!", "#ff8a5a", 2.2);
        break;
      case "wagonCatch":
        shake(360, 1.2);
        flash("#ff5a30", 240);
        float(e.x, e.y + 6, "They got you!", "#ff6a4a", 2.4);
        break;
      case "wagonFire":
        flash("#ff8a30", 180);
        burst(e.x - 2, e.y + 2, "#ff8a30", 14, 12, 460);
        float(e.x, e.y + 7, "Hay's on fire!", "#ffb04a", 2.2);
        break;
      case "wagonOut":
        burst(e.x - 2, e.y + 3, "#8a8496", 8, 6, 460);
        break;
      case "wagonWind":
        burst(e.x, e.y, "#ffb04a", 4, 4, 360);
        break;
      case "wagonThrow":
        break;
      case "wagonShot":
        burst(e.x, e.y, e.kind ? "#ffb04a" : "#c4c8d4", 12, 13, 440);
        splinter(fx, e.x, e.y, e.kind ? ["#ffb04a", "#ff7a22", "#ffd25a"] : ["#5a4028", "#c4c8d4"]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "wagonEmber":
        burst(e.x, e.y, "#ff8a30", 6, 6, 320);
        break;
      case "wagonRear":
        burst(e.x, e.y + 0.5, "#8a8496", 6, 6, 400);
        break;
      case "wagonHorseHit":
        burst(e.x, e.y, "#c9c2b6", 5, 8, 280);
        break;
      case "wagonHorseTurn":
        burst(e.x, e.y, "#c9c2b6", 12, 12, 440);
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
