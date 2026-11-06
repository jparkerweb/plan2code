// Plan2Code Web Console - Ghoul Rush's finale, its drawing for the finale's second ride, down The Bone Stair ahead of the collapse: LOOKS, VOICES, LOSE_WORDS, LOSE_SOUNDS and bonestairArt(d), plugged into draw/ghoul-draw.js. The shaft of a spiral stair under the House: stone walls scrolling up as YOU go down, the far side of the spiral in the gloom, treads of bones with skulls in the risers ("every step down is someone"), a rail of arm bones, a column of vertebrae at every turn of the spiral (in front of YOU), missing treads, treads that crack and give way, hanging ribcages, skeletons climbing up, bone hands at the rail, masonry with its shadow, the wall of rubble coming down behind YOU with its meter, and the last step broken off over the Pit's dark, a red pulse far below. No random numbers: everything comes from a hash or the clock.
//
// LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain data (the sounds live in
// ghoul-sfx-bonestair.js); bonestairArt(d) takes draw/ghoul-draw.js's helpers (`d`) and hands back
// the drawing by kind, so this file never reaches back into it. Drawn in room units, y counted
// down from the field's top (a world height `y` is drawn at FIELD_H - y). The still layers get
// only the shaft's color; the shaft, the stair and what is on it are drawn by `moving` (every
// frame, behind YOU); the columns, the ribcages, the hands, the falling blocks, the rubble, the
// glyphs and the meter by `front`. What the art reads off the rules (ghoul-bonestair.js): the
// room's `spec.ride`, `round.runner` (gap, close, done, check, flight, rot, skels, hands,
// stones), YOU (`state`, `ducking`, `x`, `y`), and its events.

import { CATCH_GAP, CLOSE_ON, GAP_MAX, HAND_GRAB_MS, HAND_H, HAND_W, HAND_WARN_MS, PILE_H, PILE_W, RIB_W, SKEL_H, SKEL_RISE_MS, STONE_MS, flightAt, seams, stairY, stoneDrop } from "./ghoul-bonestair.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const LOOKS = freeze({
  bonestair: freeze({ pack: "bonestair", custom: true, noMoon: true, pit: "#030205", wallTop: "#120d10", wallLow: "#1e1418", paper: "#261a1c", wainscot: "#1a1214", floorTop: "#d8ccb0", floor: "#4a3e34", floorEdge: "#120c0a", shelf: "#3a2e26", shelfTop: "#c8b898", window: "#ffb070", decor: "pots", color: "#e8dcc0", dark: 0.55 }),
});

// How each kind sounds, by act (the user's picks from the sound vote, bonestair.html, in ghoul-sfx-bonestair.js).
export const VOICES = freeze({
  stair: freeze({ jump: "ghoulStairJump", land: "ghoulStairLand", crash: "ghoulStairCrash", drop: "ghoulStairDrop", check: "ghoulStairCheck", turn: "ghoulStairTurn", edge: "ghoulStairEdge", finish: "ghoulStairFinish", close: "ghoulStairClose", catch: "ghoulStairCatch", rot: "ghoulStairRot" }),
  stairskel: freeze({ rise: "ghoulStairRise", hit: "ghoulStairSkelHit", down: "ghoulStairSkelDown" }),
  stairhand: freeze({ reach: "ghoulStairReach", grab: "ghoulStairGrab" }),
  stairstone: freeze({ creak: "ghoulStairCreak", crack: "ghoulStairCrack", thud: "ghoulStairThud" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  stairJump: ["stair", "jump"],
  stairLand: ["stair", "land"],
  stairCrash: ["stair", "crash"],
  stairDrop: ["stair", "drop"],
  stairCheck: ["stair", "check"],
  stairTurn: ["stair", "turn"],
  stairEdge: ["stair", "edge"],
  stairFinish: ["stair", "finish"],
  stairClose: ["stair", "close"],
  stairCatch: ["stair", "catch"],
  stairRot: ["stair", "rot"],
  stairRise: ["stairskel", "rise"],
  stairSkelHit: ["stairskel", "hit"],
  stairSkelDown: ["stairskel", "down"],
  stairReach: ["stairhand", "reach"],
  stairGrab: ["stairhand", "grab"],
  stairCreak: ["stairstone", "creak"],
  stairCrack: ["stairstone", "crack"],
  stairThud: ["stairstone", "thud"],
});
export const LOSE_WORDS = freeze({ stairGap: "Missed a step", stairGive: "The stair gave way", stairRib: "Caught in the ribs", stairSkel: "Dragged back up", stairHand: "Grabbed by the ankle", stairStone: "Flattened by masonry", stairRubble: "Buried by the house" });
export const LOSE_SOUNDS = freeze({
  stairGap: ["ghoulPitFall", 0.55, 1.1],
  stairGive: ["ghoulPitFall", 0.55, 0.85],
  stairRib: ["crunch", 0.5, 1.1],
  stairSkel: ["crunch", 0.5, 0.8],
  stairHand: ["ghoulStairGrab", 0.55, 0.9],
  stairStone: ["thud", 0.6, 0.7],
  stairRubble: ["ghoulStairCatch", 0.6, 0.9],
});

const FW = 96;
let FH = 54;
// A tread's width, and how far the stair's body hangs under its nosings.
const TW = 3.5;
const BODY = 5.5;
const COL_W = 8;

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
const hgrad = (c, x0, x1, stops) => grad(c.createLinearGradient && (() => c.createLinearGradient(x0, 0, x1, 0)), stops);
const rgrad = (c, x, y, r, stops) => grad(c.createRadialGradient && (() => c.createRadialGradient(x, y, 0, x, y, r)), stops);

function glow(ctx, rgb, x, y, r, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgrad(ctx, x, y, r, [[0, `rgba(${rgb},0.9)`], [0.4, `rgba(${rgb},0.35)`], [1, `rgba(${rgb},0)`]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}
const CANDLE = "255,180,90";
const BONE = "#e2d6b8";
const BONE_DIM = "#a89a80";
const BONE_DARK = "#5a4c3c";

/* ------------------------------------------------------------- telegraphs */

// What to do about what is coming, as a glyph that fades in ahead of it: JUMP for missing
// treads, a hand or a pile of masonry, DUCK for a ribcage, SHOOT for a skeleton, RUN where the
// treads will give way. Everything comes from the room's `ride` fields and where YOU are.
export const TELEGRAPH_SEE = 42;
export const TELEGRAPH_FULL = 32;
export const TELEGRAPH_WORDS = 3;
export const TELEGRAPH_ALPHA = 0.74;
export const ANSWERS = freeze({ gap: "JUMP", hand: "JUMP", stone: "JUMP", rib: "DUCK", skel: "SHOOT", rot: "RUN" });
export const ANSWER_COLORS = freeze({ JUMP: "#5fe3ff", DUCK: "#ffb02e", SHOOT: "#ff6a8a", RUN: "#8aff7a" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lead (where YOU act), x (its middle), up (the
// glyph's anchor height), n (which of its kind), answer, see }, in the room's order.
export function telegraphMarks(R) {
  if (marks.has(R)) return marks.get(R);
  const out = [];
  const count = {};
  const add = (kind, lead, x, up, see = TELEGRAPH_SEE) => {
    const n = count[kind] || 0;
    count[kind] = n + 1;
    out.push({ kind, lead, x, up, n, answer: ANSWERS[kind], see });
  };
  const at = (x) => stairY(R, x) ?? 20;
  for (const [x0, x1] of R.gaps) add("gap", x0 - 3, (x0 + x1) / 2, at(x0) + 7.5);
  for (const [x0, x1] of R.rot) add("rot", x0, x0 + 6, at(x0) + 8);
  for (const [x, under] of R.ribs) add("rib", x - RIB_W / 2 - 3, x, under + 7);
  for (const [x] of R.skels) add("skel", x - 30, x - 6, at(x) + 10, TELEGRAPH_SEE + 22);
  for (const [x] of R.hands) add("hand", x - 5, x, at(x) + 7);
  for (const [x] of R.stones) add("stone", x - 6, x, at(x) + 8, TELEGRAPH_SEE + 10);
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with YOU at `x`: { ...mark, alpha (0..1, before the pulse), words }.
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

export function bonestairArt(d) {
  const { label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "bonestair" ? v.spec.ride : null);
  const Y = (y) => FH - y;
  const mine = (v) => {
    const R = ride(v);
    const c = v.round && v.round.runner;
    return R && c && c.id === "bonestair" ? [R, c] : [null, null];
  };
  // How far down the shaft x is: a flight's height for each flight before it, and the way down this one.
  const depthAt = (R, x) => {
    const i = flightAt(R, x);
    if (i < 0) return x < R.flights[0][0] ? 0 : R.flights.length * (R.flights[0][2] - R.flights[0][3]);
    return i * (R.flights[0][2] - R.flights[0][3]) + (R.flights[i][2] - (stairY(R, x) ?? 0));
  };
  // How near the bottom the camera is, 0 at the top of the stair and 1 over the Pit.
  const nearEnd = (R, cam) => clamp((cam + FW * 0.4 - R.flights[0][0]) / (R.finish - R.flights[0][0]), 0, 1);

  /* ------------------------------------------------------------- the room */

  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.pit;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The cellar landing at the top (packed bone), the Pit's floor at the end (black rock).
  function ground(ctx, v, look, a, b, top) {
    const R = ride(v);
    const y = v.g.FIELD_H - top;
    if (R && a >= R.finish - 1) {
      ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#1a0c0c"], [0.3, "#0c0606"], [1, "#020101"]]);
      ctx.fillRect(a, y, b - a, top + 2);
      ctx.fillStyle = "#3a1414";
      ctx.fillRect(a, y, b - a, 0.25);
      return;
    }
    // The cellar landing: packed bone like the stair's body, bones laid along its top.
    ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#3a2e24"], [0.15, "#2a2018"], [1, "#0c0806"]]);
    ctx.fillRect(a, y, b - a, top + 2);
    for (let x = a; x + TW <= b + 0.01; x += TW) femur(ctx, x + 0.05, x + TW + 0.1, y + 0.35, 0.62, BONE);
    ctx.strokeStyle = "rgba(160,140,110,0.3)";
    ctx.lineWidth = 0.16;
    for (let x = a + 0.8; x < b; x += 1.6) seg(ctx, x, y + 2 + rnd(Math.round(x * 3), 1) * 6, x + 1.1, y + 2.4 + rnd(Math.round(x * 3), 2) * 6);
  }
  function shelf() {}

  /* ------------------------------------------------------------ the shaft */

  // The stone walls of the shaft, their courses rising as YOU go down; the far side of the spiral
  // in the gloom; dust drifting down; the Pit's red glow growing from below near the end.
  function shaft(ctx, v, R, cam) {
    const clock = v.clock;
    const you = v.round.you;
    const depth = depthAt(R, clamp(you.x, R.flights[0][0], R.finish));
    const end = nearEnd(R, cam);
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#140e12"], [0.6, "#1c1216"], [1, `rgb(${Math.round(30 + 60 * end)},${Math.round(14 + 4 * end)},${Math.round(16 + 2 * end)})`]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    // Courses of stone, at a slow parallax across and rising with the depth.
    const f = 0.3;
    const rise = (depth * 0.55) % 6;
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 0.2;
    for (let row = -1; row < FH / 3 + 2; row++) {
      const yy = row * 3 - rise + 6;
      seg(ctx, cam - 1, yy, cam + FW + 1, yy);
      const off = ((row + Math.floor((depth * 0.55) / 6) * 2) % 2) * 3;
      for (let n = Math.floor((cam * f) / 6) - 1; n * 6 < cam * f + FW + 6; n++) {
        const xx = n * 6 + off + cam * (1 - f);
        seg(ctx, xx, yy, xx, yy + 3);
        if (rnd(n * 13 + row, 7) > 0.86) {
          ctx.fillStyle = "rgba(60,40,40,0.25)";
          ctx.fillRect(xx + 0.3, yy + 0.3, 5.4, 2.4);
        }
      }
    }
    // The far side of the spiral: a dim stair going the other way, high and low.
    ctx.fillStyle = "rgba(10,6,8,0.55)";
    const f2 = 0.55;
    for (let k = -1; k < 3; k++) {
      const span = 120;
      const bx = Math.floor((cam * f2) / span) * span + k * span + cam * (1 - f2);
      const yTop = Y(40) + ((depth * 0.8) % 22) - 22 + k * 0;
      for (let s = 0; s < span; s += 3) {
        const yy = yTop + 22 - (s / span) * 22;
        ctx.fillRect(bx + s, yy, 3.1, 1.4 + (s % 6 === 0 ? 0.4 : 0));
      }
    }
    // Dust sifting down from the collapse above.
    for (let k = 0; k < 30; k++) {
      const sx = cam + ((((rnd(k, 1) * FW - cam * 0.2) % FW) + FW) % FW);
      const sy = (rnd(k, 2) * FH + clock * (0.006 + rnd(k, 3) * 0.01)) % FH;
      ctx.fillStyle = `rgba(200,180,160,${0.12 + 0.2 * rnd(k, 4)})`;
      ctx.fillRect(sx, sy, 0.18, 0.4);
    }
    // Far below, the Pit: its red pulse, stronger near the end.
    if (end > 0.4) {
      const beat = 0.5 + 0.5 * Math.max(0, Math.sin(clock / 260)) * Math.max(0, Math.sin(clock / 130));
      ctx.globalAlpha = (end - 0.4) * 1.2 * (0.55 + 0.45 * beat);
      ctx.fillStyle = vgrad(ctx, FH * 0.55, FH, [[0, "rgba(160,20,20,0)"], [1, "rgba(200,30,24,0.75)"]]);
      ctx.fillRect(cam - 1, FH * 0.55, FW + 2, FH * 0.45);
      ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------ the stair */

  // A bone lying across (a femur, its knobbed ends), from x0 to x1 at height y (drawn), r thick.
  function femur(ctx, x0, x1, y, r, col) {
    ctx.fillStyle = col;
    ctx.fillRect(x0 + r * 0.8, y - r * 0.55, x1 - x0 - r * 1.6, r * 1.1);
    disc(ctx, x0 + r * 0.7, y - r * 0.45, r * 0.62);
    disc(ctx, x0 + r * 0.7, y + r * 0.45, r * 0.62);
    disc(ctx, x1 - r * 0.7, y - r * 0.45, r * 0.62);
    disc(ctx, x1 - r * 0.7, y + r * 0.45, r * 0.62);
  }
  // A little skull, facing out of a riser: someone.
  function skull(ctx, x, y, s, lit) {
    ctx.fillStyle = BONE_DIM;
    disc(ctx, x, y, 0.62 * s);
    ctx.fillRect(x - 0.42 * s, y + 0.2 * s, 0.84 * s, 0.55 * s);
    ctx.fillStyle = "#120a08";
    disc(ctx, x - 0.24 * s, y + 0.05 * s, 0.17 * s);
    disc(ctx, x + 0.24 * s, y + 0.05 * s, 0.17 * s);
    if (lit) {
      ctx.fillStyle = "rgba(255,90,60,0.8)";
      disc(ctx, x - 0.24 * s, y + 0.05 * s, 0.07 * s);
      disc(ctx, x + 0.24 * s, y + 0.05 * s, 0.07 * s);
    }
    ctx.fillRect(x - 0.06 * s, y + 0.28 * s, 0.12 * s, 0.14 * s);
  }

  // Whether the tread from tx to tx + TW is there: not over missing treads, nor where the stair gave way.
  function treadState(R, c, tx) {
    const mid = tx + TW / 2;
    for (const [x0, x1] of R.gaps) if (mid > x0 && mid < x1) return { gone: true };
    for (const [i, [x0, x1]] of R.rot.entries()) {
      if (mid < x0 || mid > x1) continue;
      const r = c.rot[i];
      if (r.state === "wait") return { cracked: true, rot: i };
      if (mid < r.front) return { gone: true, falling: r.front - mid };
      return { cracked: true, rot: i, near: r.front > mid - 6 };
    }
    return {};
  }

  // One flight from lo to hi: the rail behind, the stringer of packed bones under it, the treads.
  function flight(ctx, v, R, c, i, lo, hi) {
    const [x0, x1, y0, y1] = R.flights[i];
    const a = Math.max(x0, lo);
    const b = Math.min(x1, hi);
    if (b <= a) return;
    const yAt = (x) => y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    const clock = v.clock;
    // The rail: arm bones standing on every other tread, a spine along their tops.
    ctx.strokeStyle = "#6a5c4a";
    ctx.lineWidth = 0.34;
    const k0 = Math.floor((a - x0) / TW);
    for (let k = k0; x0 + k * TW < b; k++) {
      const tx = x0 + k * TW;
      if (k % 2) continue;
      if (treadState(R, c, tx).gone) continue;
      seg(ctx, tx + 0.6, Y(yAt(tx)) - 0.2, tx + 0.6, Y(yAt(tx) + 5.6));
    }
    ctx.strokeStyle = "#8a7a62";
    ctx.lineWidth = 0.5;
    seg(ctx, a, Y(yAt(a) + 5.8), b, Y(yAt(b) + 5.8));
    ctx.fillStyle = "#9a8a70";
    for (let x = Math.ceil(a / 1.4) * 1.4; x < b; x += 1.4) disc(ctx, x, Y(yAt(x) + 5.8), 0.28);
    // The stringer: the stair's body of packed bones under the treads, to the void below.
    ctx.fillStyle = "#2a2018";
    poly(ctx, [[a, Y(yAt(a))], [b, Y(yAt(b))], [b, Y(yAt(b) - BODY)], [a, Y(yAt(a) - BODY)]]);
    ctx.fill();
    ctx.strokeStyle = "rgba(160,140,110,0.35)";
    ctx.lineWidth = 0.16;
    for (let x = Math.floor(a / 1.6) * 1.6; x < b; x += 1.6) {
      const n = Math.round(x / 1.6);
      const yy = Y(yAt(x)) + 1.4 + rnd(n, 3) * (BODY - 2);
      seg(ctx, x, yy, x + 1.2, yy + (rnd(n, 4) - 0.5) * 0.8);
    }
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    poly(ctx, [[a, Y(yAt(a) - BODY + 1)], [b, Y(yAt(b) - BODY + 1)], [b, Y(yAt(b) - BODY)], [a, Y(yAt(a) - BODY)]]);
    ctx.fill();
    // The treads, each a bone laid across, a skull in every third riser.
    for (let k = k0; x0 + k * TW < b; k++) {
      const tx = x0 + k * TW;
      const st = treadState(R, c, tx);
      // Each tread level at the line's height under its middle, so a step down at each end.
      const top = Y(yAt(Math.min(x1, tx + TW / 2)));
      if (st.gone) {
        // A hole in the stair, or a tread still falling where it gave way.
        ctx.fillStyle = "rgba(6,4,5,0.5)";
        ctx.fillRect(tx, top - 0.2, TW + 0.05, BODY + 0.4);
        if (st.falling !== undefined && st.falling < 10) {
          const t = st.falling / 36;
          ctx.save();
          ctx.translate(tx + TW / 2, top + 0.5 + 60 * t * t + st.falling * 0.3);
          ctx.rotate((st.falling * 0.4 * (rnd(k, 5) - 0.5)) * 1.2);
          femur(ctx, -TW / 2, TW / 2, 0, 0.62, BONE_DIM);
          ctx.restore();
        } else if (rnd(k, 9) > 0.6) {
          ctx.strokeStyle = BONE_DARK;
          ctx.lineWidth = 0.3;
          seg(ctx, tx + 0.3, top + 0.2, tx + 0.6, top + 1.4 + rnd(k, 8));
        }
        continue;
      }
      const shake = st.near ? Math.sin(clock / 30 + k) * 0.15 : 0;
      ctx.fillStyle = "#3a2e24";
      ctx.fillRect(tx, top, TW + 0.05, 1.6);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(tx + TW - 0.12, top, 0.16, 1.6);
      femur(ctx, tx + 0.05, tx + TW + 0.1, top + 0.35 + shake, 0.62, st.cracked ? "#c8bc98" : BONE);
      if (k % 3 === 1) skull(ctx, tx + TW / 2, top + 1.7, 1.3, k % 7 === 4);
      if (st.cracked) {
        ctx.strokeStyle = "#2a1a10";
        ctx.lineWidth = 0.14;
        seg(ctx, tx + 0.5 + rnd(k, 1), top + 0.05, tx + 0.9 + rnd(k, 2), top + 0.6);
        seg(ctx, tx + 0.9 + rnd(k, 2), top + 0.6, tx + 1.3 + rnd(k, 3), top + 0.25);
        // Sickly dust where it will go.
        if (Math.sin(clock / 160 + k) > 0.6) {
          ctx.fillStyle = "rgba(170,200,120,0.35)";
          ctx.fillRect(tx + rnd(k, 6) * TW, top + 0.7 + ((clock / 40 + k * 3) % 3), 0.15, 0.3);
        }
      }
    }
    // The missing treads cut exactly where the rules have them, broken bone at each edge.
    for (const [g0, g1] of R.gaps) {
      if (g1 < a || g0 > b) continue;
      // The shaft shows through, dimmed: the stair's body is cut away there.
      ctx.save();
      ctx.beginPath();
      ctx.rect(g0, Y(yAt(g0) + 1.2), g1 - g0, BODY + 1.6 + yAt(g0) - yAt(g1));
      ctx.clip();
      shaft(ctx, v, R, Math.round(v.round.camX * 8) / 8);
      ctx.restore();
      ctx.fillStyle = "rgba(6,4,5,0.45)";
      poly(ctx, [[g0, Y(yAt(g0) + 1)], [g1, Y(yAt(g1) + 1)], [g1, Y(yAt(g1) - BODY - 0.2)], [g0, Y(yAt(g0) - BODY - 0.2)]]);
      ctx.fill();
      ctx.fillStyle = BONE_DIM;
      poly(ctx, [[g0 - 0.2, Y(yAt(g0) + 0.3)], [g0 + 0.7, Y(yAt(g0) - 0.1)], [g0 - 0.2, Y(yAt(g0) - 0.9)]]);
      ctx.fill();
      poly(ctx, [[g1 + 0.2, Y(yAt(g1) + 0.3)], [g1 - 0.7, Y(yAt(g1))], [g1 + 0.2, Y(yAt(g1) - 0.9)]]);
      ctx.fill();
    }
  }

  // A checkpoint: a candle in a skull sconce on the rail, lit once passed.
  function sconce(ctx, v, x, base, passed) {
    const y = Y(base + 7.4);
    skull(ctx, x, y + 0.9, 1.6, false);
    ctx.fillStyle = passed ? "#efe2c0" : "#8a7e68";
    ctx.fillRect(x - 0.3, y - 1.6, 0.6, 1.6);
    if (passed) {
      const f = 0.85 + 0.15 * Math.sin(v.clock / 70 + x);
      ctx.fillStyle = "#ffcf6a";
      ctx.beginPath();
      ctx.ellipse?.(x, y - 2.1, 0.32 * f, 0.6 * f, 0, 0, TAU);
      ctx.fill();
      glow(ctx, CANDLE, x, y - 2, 6, 0.32);
    }
  }

  // A skeleton climbing up the stair at YOU (facing left), `p` of the way up out of the treads.
  function skeleton(ctx, v, x, base, p, i, state, t) {
    const clock = v.clock;
    const y = Y(base) + (1 - p) * SKEL_H;
    const climb = state === "climb" ? Math.sin(clock / 120 + i) : 0;
    ctx.save();
    ctx.translate(x, y);
    if (state === "down") {
      // Knocked apart: the bones tumbling down the stair.
      const q = Math.min(1, t / 700);
      ctx.globalAlpha = 1 - q;
      for (let k = 0; k < 6; k++) {
        ctx.save();
        ctx.translate((rnd(k, i) - 0.3) * 8 * q, -2 - k * 0.6 + 10 * q * q);
        ctx.rotate(q * 6 * (rnd(k, 2) - 0.5));
        femur(ctx, -0.8, 0.8, 0, 0.35, BONE);
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
      return;
    }
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 0.34;
    ctx.lineCap = "round";
    // Legs, a step up and a step down.
    seg(ctx, 0, -2.2, -0.8 - climb * 0.3, -1.1);
    seg(ctx, -0.8 - climb * 0.3, -1.1, -0.9, 0);
    seg(ctx, 0, -2.2, 0.7 + climb * 0.3, -1.2);
    seg(ctx, 0.7 + climb * 0.3, -1.2, 0.8, 0);
    // Spine and ribs, leaning up the stair.
    seg(ctx, 0, -2.2, -0.5, -4.1);
    for (let r = 0; r < 3; r++) {
      const ry = -2.8 - r * 0.45;
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.ellipse?.(-0.35 - r * 0.05, ry, 0.7, 0.22, 0, 0, TAU);
      ctx.stroke();
    }
    // Arms reaching for YOU.
    ctx.lineWidth = 0.3;
    seg(ctx, -0.5, -3.8, -1.9, -3.4 + climb * 0.5);
    seg(ctx, -1.9, -3.4 + climb * 0.5, -2.7, -3.9 + climb * 0.3);
    seg(ctx, -0.5, -3.8, -1.6, -2.9 - climb * 0.4);
    seg(ctx, -1.6, -2.9 - climb * 0.4, -2.5, -2.6);
    // The skull, its eyes lit.
    ctx.fillStyle = BONE;
    disc(ctx, -0.7, -4.7, 0.62);
    ctx.fillRect(-1.05, -4.4, 0.7, 0.5);
    ctx.fillStyle = "#ff4a3a";
    disc(ctx, -1.0, -4.75, 0.14);
    disc(ctx, -0.55, -4.75, 0.14);
    ctx.restore();
    glow(ctx, "255,70,50", x - 0.8, y - 4.7, 2.6, 0.35);
  }

  // A pile of fallen masonry on a tread.
  function pile(ctx, x, base, i) {
    const y = Y(base);
    for (let k = 0; k < 4; k++) {
      const w = 1.2 + rnd(i * 4 + k, 1) * 0.9;
      const h = 0.9 + rnd(i * 4 + k, 2) * 0.6;
      const px = x - PILE_W / 2 + rnd(i * 4 + k, 3) * (PILE_W - w);
      const py = y - (k < 2 ? 0 : 1) * 1.1 - h;
      ctx.fillStyle = k % 2 ? "#5a5050" : "#6e625a";
      ctx.fillRect(px, py, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(px, py, w, 0.18);
    }
    ctx.fillStyle = "rgba(180,170,150,0.3)";
    ctx.fillRect(x - PILE_W / 2 - 0.4, y - 0.15, PILE_W + 0.8, 0.2);
  }

  // A block of masonry: a carved stone with a scrap of the house's wallpaper on it.
  function block(ctx, x, yBottom, rot, i) {
    ctx.save();
    ctx.translate(x, Y(yBottom) - PILE_H / 2);
    ctx.rotate(rot);
    ctx.fillStyle = "#6e625a";
    ctx.fillRect(-PILE_W / 2, -PILE_H / 2, PILE_W, PILE_H);
    ctx.fillStyle = i % 2 ? "#4a2a3a" : "#2a3a4a";
    ctx.fillRect(-PILE_W / 2, -PILE_H / 2, PILE_W * 0.45, PILE_H * 0.5);
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 0.14;
    ctx.strokeRect(-PILE_W / 2, -PILE_H / 2, PILE_W, PILE_H);
    ctx.restore();
  }

  function moving(ctx, v, cam) {
    const [R, c] = mine(v);
    if (!R) return;
    FH = v.g.FIELD_H;
    cam = Math.round(cam * 8) / 8;
    const lo = cam - 10;
    const hi = cam + FW + 10;
    shaft(ctx, v, R, cam);
    // Skeletons still coming up from under the treads go behind them.
    R.skels.forEach(([sx], i) => {
      const s = c.skels[i];
      if (s.state !== "rise" || s.x < lo || s.x > hi) return;
      skeleton(ctx, v, s.x, stairY(R, s.x) ?? 20, 1 - Math.max(0, s.t) / SKEL_RISE_MS, i, "rise", 0);
    });
    R.flights.forEach((_, i) => flight(ctx, v, R, c, i, lo, hi));
    // The last step, broken off over the dark.
    const end = R.finish;
    if (end < hi + 10) {
      const y = Y(R.flights.at(-1)[3]);
      // Past it, the Pit's dark: the shaft fades to black, a red pulse far down.
      ctx.fillStyle = hgrad(ctx, end, end + 10, [[0, "rgba(2,1,2,0)"], [1, "rgba(2,1,2,0.86)"]]);
      ctx.fillRect(end, 0, Math.max(0, hi - end) + 10, FH);
      ctx.fillStyle = BONE_DIM;
      poly(ctx, [[end - 0.2, y], [end + 1.4, y + 0.6], [end + 0.4, y + 1.6], [end - 0.2, y + BODY]]);
      ctx.fill();
    }
    // The cellar landing at the top and the Pit's floor, over the shaft.
    for (const [a, b, top] of v.spec.ground) if (b > lo && a < hi) ground(ctx, v, LOOKS.bonestair, a, b, top);
    // Checkpoints.
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) sconce(ctx, v, x, stairY(R, x) ?? 20, i <= c.check);
    });
    // Shadows of masonry about to fall, and the piles.
    R.stones.forEach(([x], i) => {
      if (x < lo || x > hi) return;
      const s = c.stones[i];
      const base = stairY(R, x) ?? 20;
      if (s.state === "warn") {
        const p = clamp(1 - s.t / STONE_MS, 0, 1);
        ctx.globalAlpha = 0.25 + 0.6 * p;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.ellipse?.(x, Y(base) - 0.1, 0.8 + 1.6 * p, 0.25 + 0.3 * p, 0, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (s.state === "pile") pile(ctx, x, base, i);
    });
    // Skeletons up on the stair.
    R.skels.forEach(([sx], i) => {
      const s = c.skels[i];
      if ((s.state !== "climb" && s.state !== "down") || s.x < lo || s.x > hi) return;
      const since = v.fx && v.fx.stairDown && v.fx.stairDown[i] !== undefined ? v.fx.clock - v.fx.stairDown[i] : 999;
      skeleton(ctx, v, s.x, stairY(R, s.x) ?? 20, 1, i, s.state, s.state === "down" ? since : 0);
    });
  }

  /* -------------------------------------------------------------- in front */

  // The central column at a seam: vertebrae stacked floor to roof, in front of YOU.
  function column(ctx, v, x) {
    const l = x - COL_W / 2;
    ctx.fillStyle = hgrad(ctx, l - 2, l + COL_W + 2, [[0, "rgba(0,0,0,0)"], [0.2, "#1a1210"], [0.5, "#3a2e26"], [0.8, "#1a1210"], [1, "rgba(0,0,0,0)"]]);
    ctx.fillRect(l - 2, 0, COL_W + 4, FH);
    for (let k = 0; k < FH / 2.6 + 1; k++) {
      const y = k * 2.6;
      ctx.fillStyle = k % 2 ? "#b8aa8c" : "#cbbd9c";
      ctx.fillRect(l + 1.2, y + 0.2, COL_W - 2.4, 2.0);
      // The side processes.
      ctx.fillStyle = "#9a8c70";
      poly(ctx, [[l + 1.2, y + 0.6], [l - 0.2, y + 1.0], [l + 1.2, y + 1.6]]);
      ctx.fill();
      poly(ctx, [[l + COL_W - 1.2, y + 0.6], [l + COL_W + 0.2, y + 1.0], [l + COL_W - 1.2, y + 1.6]]);
      ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(l + 1.2, y + 2.0, COL_W - 2.4, 0.4);
    }
    ctx.fillStyle = hgrad(ctx, l, l + COL_W, [[0, "rgba(0,0,0,0.45)"], [0.5, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,0.55)"]]);
    ctx.fillRect(l, 0, COL_W, FH);
  }

  // A ribcage hanging on a chain, its lowest rib at `under`.
  function ribcage(ctx, v, x, under, i) {
    const sway = Math.sin(v.clock / 520 + i * 1.7) * 0.25;
    const bottom = Y(under);
    const top = bottom - 5.2;
    ctx.strokeStyle = "#5a5048";
    ctx.lineWidth = 0.22;
    seg(ctx, x, 0, x + sway, top);
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 0.42;
    seg(ctx, x + sway, top, x + sway, bottom - 0.4);
    ctx.lineWidth = 0.3;
    for (let r = 0; r < 5; r++) {
      const ry = top + 0.8 + r * 0.95;
      const w = RIB_W / 2 - Math.abs(r - 2.4) * 0.25;
      ctx.beginPath();
      ctx.moveTo(x + sway, ry);
      ctx.quadraticCurveTo(x + sway - w * 1.1, ry + 0.3, x + sway - w * 0.7, ry + 1.0);
      ctx.moveTo(x + sway, ry);
      ctx.quadraticCurveTo(x + sway + w * 1.1, ry + 0.3, x + sway + w * 0.7, ry + 1.0);
      ctx.stroke();
    }
    ctx.fillStyle = BONE;
    ctx.fillRect(x + sway - 0.9, bottom - 0.5, 1.8, 0.5);
  }

  // A bone hand at the rail: its wrist up from under the tread's edge, a palm, four long fingers
  // (splayed and twitching while it reaches, curled down over the tread as it grabs), outlined dark.
  function hand(ctx, v, x, base, state, t, i) {
    const y = Y(base);
    const p = state === "reach" ? clamp(1 - t / HAND_WARN_MS, 0, 1) : 1;
    const closed = state === "grab" ? clamp(1 - t / HAND_GRAB_MS, 0, 1) : state === "hold" ? 1 : 0;
    glow(ctx, "190,220,255", x, y - 1.4, 6, 0.18 + 0.22 * p);
    ctx.save();
    // Rising from below while it reaches; up to its full height (HAND_H and a little) to grab.
    ctx.translate(x, y + (1 - p) * 2.6);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const top = -(HAND_H + 0.5);
    const palm = [HAND_W / 2 - 0.3, top + 1.4];
    for (const [w, col] of [[0.95, "rgba(10,6,8,0.85)"], [0.5, "#efe6d0"]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      // The wrist and forearm.
      seg(ctx, HAND_W / 2 + 0.7, 2.6, palm[0], palm[1]);
      ctx.lineWidth = w * 0.78;
      for (let f = 0; f < 4; f++) {
        const twitch = state === "reach" ? Math.sin(v.clock / 70 + f * 1.3) * 0.25 : 0;
        const kx = palm[0] - 0.4 - f * 0.55;
        const ky = top + 0.1 + f * 0.22 + twitch;
        const tx = kx - 0.9 - closed * 0.2;
        const ty = ky + 0.5 + closed * 1.4;
        seg(ctx, palm[0], palm[1], kx, ky);
        seg(ctx, kx, ky, tx, ty);
      }
      // The thumb.
      seg(ctx, palm[0], palm[1], palm[0] - 0.5, palm[1] + 0.9);
    }
    ctx.fillStyle = "#efe6d0";
    disc(ctx, palm[0], palm[1], 0.55);
    ctx.restore();
  }

  // The wall of rubble coming down the stair behind YOU, its face at x.
  function rubbleWall(ctx, v, R, c, cam, face) {
    const clock = v.clock;
    if (face < cam - 6) return;
    ctx.fillStyle = hgrad(ctx, face - 14, face + 3, [[0, "#0c0808"], [0.7, "#241a18"], [1, "rgba(36,26,24,0)"]]);
    ctx.fillRect(cam - 2, 0, face - cam + 5, FH);
    // Blocks tumbling down its face, beams and bones among them.
    for (let k = 0; k < 26; k++) {
      const speed = 0.02 + rnd(k, 1) * 0.02;
      const yy = ((rnd(k, 2) * FH + clock * speed) % (FH + 8)) - 4;
      const xx = face - 1 - rnd(k, 3) * 10 + Math.sin(clock / 300 + k) * 0.5;
      if (xx < cam - 4) continue;
      const w = 1.2 + rnd(k, 4) * 2.2;
      ctx.save();
      ctx.translate(xx, yy);
      ctx.rotate(clock / (200 + rnd(k, 5) * 300) + k);
      ctx.fillStyle = k % 5 === 0 ? "#6a4a2a" : k % 7 === 0 ? BONE_DIM : k % 2 ? "#5a5050" : "#463c3a";
      if (k % 5 === 0) ctx.fillRect(-w, -0.25, w * 2, 0.5);
      else ctx.fillRect(-w / 2, -w / 2, w, w * 0.8);
      ctx.restore();
    }
    // The dust it throws ahead.
    ctx.fillStyle = rgrad(ctx, face, FH * 0.6, 14, [[0, "rgba(150,130,110,0.4)"], [1, "rgba(150,130,110,0)"]]);
    ctx.fillRect(face - 14, FH * 0.6 - 14, 28, 28);
    const near = clamp(1 - c.gap / GAP_MAX, 0, 1);
    if (near > 0.5) {
      ctx.globalAlpha = (near - 0.5) * 1.2 * (0.6 + 0.4 * Math.sin(clock / 90));
      ctx.fillStyle = hgrad(ctx, cam, cam + 30, [[0, "rgba(255,60,30,0.5)"], [1, "rgba(255,60,30,0)"]]);
      ctx.fillRect(cam, 0, 30, FH);
      ctx.globalAlpha = 1;
    }
  }

  // A see-through glyph over an obstacle: chevrons and (for the first few) the word.
  function glyph(ctx, v, t) {
    const col = ANSWER_COLORS[t.answer];
    const dir = t.answer === "DUCK" ? 1 : t.answer === "JUMP" ? -1 : 0;
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const cy = Math.max(9, Math.min(FH - 7, FH - t.up)) + Math.sin(v.clock / 260 + t.lead) * 0.35;
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, cc] of [[1.3, "rgba(4,4,16,0.8)"], [0.6, col]]) {
      ctx.strokeStyle = cc;
      ctx.lineWidth = w;
      if (dir) {
        const ay = cy + 2.6 * -dir * -1;
        for (let k = 0; k < 2; k++) {
          const oy = ay + (k - 0.5) * 1.5 * dir - dir * 0.2;
          ctx.beginPath();
          ctx.moveTo(t.x - 1.7, oy - dir * 0.9);
          ctx.lineTo(t.x, oy + dir * 0.9);
          ctx.lineTo(t.x + 1.7, oy - dir * 0.9);
          ctx.stroke();
        }
      } else if (t.answer === "SHOOT") {
        // A crosshair.
        ctx.beginPath();
        ctx.arc(t.x, cy + 2.6, 1.4, 0, TAU);
        ctx.stroke();
        seg(ctx, t.x - 2.2, cy + 2.6, t.x + 2.2, cy + 2.6);
        seg(ctx, t.x, cy + 0.4, t.x, cy + 4.8);
      } else {
        // RUN: chevrons pointing on down the stair.
        for (let k = 0; k < 2; k++) {
          const ox = t.x - 1 + k * 1.6;
          ctx.beginPath();
          ctx.moveTo(ox - 0.9, cy + 1.0);
          ctx.lineTo(ox + 0.9, cy + 2.6);
          ctx.lineTo(ox - 0.9, cy + 4.2);
          ctx.stroke();
        }
      }
    }
    if (t.words) label(ctx, t.answer, t.x, cy + (dir === 1 ? -1.2 : dir === -1 ? 1.2 : -1.2), 2.3, col, "center");
    ctx.restore();
  }

  // The collapse's meter along the top left: how near it is, red as it closes.
  function meter(ctx, v, c, cam) {
    // High in the shaft, over the stair's rail at its highest and over YOU.
    const x = cam + 4;
    const y = 2.2;
    const w = 34;
    const near = clamp(1 - c.gap / GAP_MAX, 0, 1);
    ctx.fillStyle = "rgba(6,4,10,0.62)";
    ctx.fillRect(x - 0.8, y - 0.8, w + 1.6, 2.6);
    ctx.fillStyle = "#1c1618";
    ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = near < 0.35 ? "#6ee08a" : near < 0.62 ? "#ffc23a" : "#ff4a3a";
    ctx.fillRect(x, y, w * near, 1);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + w * (1 - CATCH_GAP / GAP_MAX), y - 0.3, 0.25, 1.6);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(x + w * (1 - CLOSE_ON / GAP_MAX), y - 0.2, 0.18, 1.4);
    const close = c.gap < CLOSE_ON;
    label(ctx, close ? "IT IS RIGHT BEHIND YOU" : "THE HOUSE IS COMING DOWN", x, y + 3.1, 1.7, close ? (Math.sin(v.clock / 110) > 0 ? "#ff6a4a" : "#ffd25a") : "#d8d0c8", "left");
    // A tumbling block at the meter's tip.
    ctx.save();
    ctx.translate(x + w * near, y + 0.5);
    ctx.rotate(v.clock / 260);
    ctx.fillStyle = "#8a7e74";
    ctx.fillRect(-0.7, -0.7, 1.4, 1.4);
    ctx.restore();
  }

  function front(ctx, v) {
    const [R, c] = mine(v);
    if (!R) return;
    FH = v.g.FIELD_H;
    const round = v.round;
    const cam = Math.round(round.camX * 8) / 8;
    const lo = cam - 8;
    const hi = cam + FW + 8;
    R.ribs.forEach(([x, under], i) => {
      if (x > lo - 4 && x < hi + 4) ribcage(ctx, v, x, under, i);
    });
    R.hands.forEach(([x], i) => {
      const h = c.hands[i];
      if (x < lo || x > hi || h.state === "wait" || h.state === "gone") return;
      hand(ctx, v, x, stairY(R, x) ?? 20, h.state, h.t, i);
    });
    // Masonry on its way down.
    R.stones.forEach(([x], i) => {
      const s = c.stones[i];
      if (s.state !== "warn" || x < lo || x > hi) return;
      const base = stairY(R, x) ?? 20;
      const drop = stoneDrop(s.t);
      if (drop !== null) block(ctx, x, base + drop, drop * 0.05, i);
      // Grit trickling from above as it works loose.
      const p = clamp(1 - s.t / STONE_MS, 0, 1);
      ctx.fillStyle = "rgba(200,180,150,0.6)";
      for (let k = 0; k < 6; k++) {
        const yy = (((v.clock * 0.03 + k * 9) % 40) / 40) * Y(base);
        ctx.fillRect(x - 0.8 + rnd(k, i) * 1.6, yy, 0.18, 0.5 + p);
      }
    });
    // The columns at every turn of the spiral, in front of YOU.
    for (const s of seams(R)) if (s.x > lo - COL_W && s.x < hi + COL_W) column(ctx, v, s.x);
    if (!c.done) {
      for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
      const fx = v.fx || {};
      fx.stairGap = fx.stairGap === undefined ? c.gap : fx.stairGap + (c.gap - fx.stairGap) * 0.22;
      rubbleWall(ctx, v, R, c, cam, round.you.x - fx.stairGap);
      meter(ctx, v, c, cam);
    }
    // Bits from a crash, tumbling.
    const bits = v.fx && v.fx.stairBits;
    if (bits) {
      for (const b of bits) {
        const t = (v.fx.clock - b.t0) / 1000;
        if (t < 0 || t > 0.9) continue;
        ctx.save();
        ctx.translate(b.x + b.vx * t, FH - (b.y + b.vy * t - 30 * t * t));
        ctx.rotate(b.rot + b.vr * t);
        ctx.globalAlpha = clamp(1.6 - t * 1.6, 0, 1);
        ctx.fillStyle = b.c;
        ctx.fillRect(-b.w / 2, -0.15, b.w, 0.3);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  }

  const dim = () => 0;

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const [R, c] = mine(v);
    if (!R) return;
    const round = v.round;
    const you = round.you;
    const lo = round.camX - 10;
    const hi = round.camX + FW + 10;
    add(you.x + 3, you.y + 2.2, 10, 0.6);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi && i <= c.check) add(x, (stairY(R, x) ?? 20) + 9, 8, 0.6);
    });
    R.skels.forEach(([x], i) => {
      const s = c.skels[i];
      if ((s.state === "rise" || s.state === "climb") && s.x > lo && s.x < hi) add(s.x, (stairY(R, s.x) ?? 20) + 4.5, 4, 0.4);
    });
  }

  /* -------------------------------------------------------------- events */

  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  function splinter(fx, x, y, colors) {
    fx.stairBits = (fx.stairBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 10; k++) fx.stairBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 24, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each sound plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    if (e.type === "stairLand" && !gateOnce(fx, "stairLandMs", 120)) return true;
    d.say(tone, voice[0], voice[1], 0.5);
    switch (e.type) {
      case "stairJump":
        burst(e.x, e.y, "#c8bca0", 4, 6, 260);
        break;
      case "stairLand":
        burst(e.x, e.y, "#c8bca0", e.big ? 10 : 5, 7, 320);
        break;
      case "stairCrash":
        shake(320, 1);
        flash("#ffe0c0", 200);
        burst(e.x, e.y + 1, "#e2d6b8", 16, 16, 520);
        splinter(fx, e.x, e.y + 1, [BONE, BONE_DIM, "#6e625a"]);
        break;
      case "stairDrop":
        shake(260, 0.8);
        burst(e.x, e.y, "#a89a80", 12, 10, 420);
        float(e.x, e.y + 6, e.cause === "stairGive" ? "It gave way!" : "Mind the gap!", "#ff8a6a", 2.2);
        break;
      case "stairCheck":
        float(e.x, e.y + 6, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#ffd27a", 1, 8, 500);
        break;
      case "stairTurn":
        break;
      case "stairEdge":
        float(e.x, e.y + 6, "Down you go!", GOLD, 2.4);
        break;
      case "stairFinish":
        shake(300, 0.9);
        flash("#801818", 260);
        burst(e.x, e.y, "#3a1414", 18, 12, 560);
        float(e.x, e.y + 6, "Into the dark", "#ff9a7a", 2.6);
        break;
      case "stairClose":
        float(e.x, e.y + 7, "Faster!", "#ff8a5a", 2.2);
        break;
      case "stairCatch":
        shake(420, 1.3);
        flash("#c8b8a0", 260);
        float(e.x, e.y + 7, "It caught you!", "#ff6a4a", 2.4);
        break;
      case "stairRot":
        shake(180, 0.4);
        burst(e.x, e.y, "#a8c080", 8, 6, 400);
        break;
      case "stairRise":
        burst(e.x, e.y, "#e2d6b8", 6, 6, 360);
        break;
      case "stairSkelHit":
        burst(e.x, e.y, BONE, 6, 8, 280);
        break;
      case "stairSkelDown": {
        fx.stairDown = { ...(fx.stairDown || {}), [e.n]: fx.clock };
        burst(e.x, e.y, BONE, 14, 13, 460);
        splinter(fx, e.x, e.y, [BONE, BONE_DIM]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      }
      case "stairReach":
        burst(e.x, e.y, "#c8d8e8", 4, 4, 300);
        break;
      case "stairGrab":
        burst(e.x, e.y + 1, BONE, 5, 5, 260);
        break;
      case "stairCreak":
        burst(e.x, e.y + 30, "#c8b8a0", 5, 5, 600);
        break;
      case "stairCrack":
        shake(140, 0.3);
        break;
      case "stairThud":
        shake(240, 0.8);
        burst(e.x, e.y + 0.5, "#8a7e74", 14, 10, 460);
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
    waves: freeze({}),
    powers: freeze({}),
    lights,
    react,
  });
}
