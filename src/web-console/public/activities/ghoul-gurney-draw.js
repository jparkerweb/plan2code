// Plan2Code Web Console - Ghoul Rush's Code Blue, its drawing: a runaway hospital gurney down the sanatorium's corridors at night. A mint wall with doors, a handrail and a ceiling of fluorescent tubes that buzz and flicker, linoleum floors that rise and fall in ramps, elevator shafts open to a black drop, wheelchairs rolling, IV stands, doorways with orderlies in them, hanging surgical lamps and swinging doors, buzzing surge lamps hung high, the gurney with Planny strapped to it, and a heartbeat monitor trace across the top.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are
// plain data; gurneyArt(d) takes ghoul-draw.js's drawing helpers (`d`) and hands back the
// drawing by kind, so this file never reaches back into it. Drawn in room units, the way
// ghoul-draw.js draws: y counted down from the field's top, so a world height `y` is drawn
// at `FIELD_H - y`. The still layers' pit is dark under the whole ride, so the wall, the
// floor and what stands on it are drawn by `moving` (every frame, over the still layers);
// the lows, the gurney in front of Planny, the telegraphs, the countdown and the monitor are
// drawn by `front`. No random numbers: everything comes from a hash.
//
// THE TWIST ON THE SCREEN: the game's own dark (ghoul-draw.js drawDark) lies over the field,
// cut open at each light and by Planny's flashlight cone. `dim` is how dark the corridor is
// (0.97 in a blackout, a hash of the clock flickering in the countdown), and `lights` is
// what stays lit in it: the dying emergency strips along the floor, a faint pool on what
// is near (so an obstacle shows as an outline), the telegraph glyphs, the surge lamps, the
// checkpoints and the monitor's band across the top. What the art reads off the rules
// (ghoul-gurney.js):
//
// - the room: `spec.ride` ({ track, chairs, stands, lows [x0, x1, y, kind], orderlies, lamps,
//   waves, checks, finish }), `spec.ground` (the start's floor and the ambulance bay).
// - `round.runner` ({ pack: "codeblue", ... }, null in any other room): `v`, `line` (-1 in
//   the air), `check`, `done`, `phase`, `n`, `dark`, `pulse`, `every`, `flat`, `orderlies`
//   [{ state "door" | "warn" | "up" | "sink" | "broken" | "spent", t }], `chairs` [{ x,
//   rolling }], `lamps` [broken], `waves` [{ off }]; `round.bonusRound.hearts`.
// - Planny: `you.state`, `you.vy` (tilts the gurney in the air), `you.ducking`, `you.x`, `you.y`.
// - events leave short-lived bits in the view's `fx` (`blueBits`, `blueLand`).

import { ANSWER_COLORS } from "./ghoul-sled-draw.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const ID = "codeblue";
const pit = (o) => freeze({ pack: ID, custom: true, noMoon: true, pit: "#05090c", ...o });
export const LOOKS = freeze({
  codeblue: pit({ wallTop: "#0c1412", wallLow: "#1c2b27", paper: "#2b3f38", wainscot: "#141f1b", floorTop: "#8fa79c", floor: "#3a4a43", floorEdge: "#0a100e", shelf: "#3a4a43", shelfTop: "#a8b8b0", window: "#c0e8d8", decor: "none", color: "#b0e0cc", dark: 0.5 }),
});

// How each new kind sounds, by act (the sounds are in ghoul-sfx-gurney.js).
export const VOICES = freeze({
  blue: freeze({ jump: "ghoulBlueJump", land: "ghoulBlueLand", launch: "ghoulBlueLaunch", duck: "ghoulBlueDuck", crash: "ghoulBlueCrash", check: "ghoulBlueCheck", finish: "ghoulBlueFinish", warn: "ghoulBlueWarn", dark: "ghoulBlueDark", lit: "ghoulBlueLit", beat: "ghoulBlueBeat", flat: "ghoulBlueFlat", chair: "ghoulBlueChair" }),
  blueorderly: freeze({ warn: "ghoulBlueOrderlyWarn", up: "ghoulBlueOrderlyUp", hit: "ghoulBlueOrderlyHit", break: "ghoulBlueOrderlyBreak" }),
  bluelamp: freeze({ break: "ghoulBlueLampBreak" }),
});

// What each of the pack's events plays: [kind, act], once (a beat on the flat is its own act).
export const EVENT_VOICE = freeze({
  blueJump: ["blue", "jump"],
  blueLand: ["blue", "land"],
  blueLaunch: ["blue", "launch"],
  blueDuck: ["blue", "duck"],
  blueCrash: ["blue", "crash"],
  blueCheck: ["blue", "check"],
  blueFinish: ["blue", "finish"],
  blueWarn: ["blue", "warn"],
  blueDark: ["blue", "dark"],
  blueLit: ["blue", "lit"],
  blueBeat: ["blue", "beat"],
  blueChair: ["blue", "chair"],
  blueOrderlyWarn: ["blueorderly", "warn"],
  blueOrderlyUp: ["blueorderly", "up"],
  blueOrderlyHit: ["blueorderly", "hit"],
  blueOrderlyBreak: ["blueorderly", "break"],
  blueLamp: ["bluelamp", "break"],
});
export const LOSE_WORDS = freeze({ wheelchair: "Hit a wheelchair", ivstand: "Tangled in an IV stand", overhead: "Ducked too late", lunged: "Tackled by an orderly", elevator: "Down the elevator shaft" });
export const LOSE_SOUNDS = freeze({
  wheelchair: ["clank", 0.6, 0.8],
  ivstand: ["clank", 0.5, 1.2],
  overhead: ["smash", 0.5, 0.9],
  lunged: ["ghoulHandsGrab", 0.5, 0.9],
  elevator: ["ghoulPitFall", 0.55, 0.8],
});

const FW = 96;
const GURNEY_V = 48;
const WALL = "#33493f";
const METAL = "#9aa8a4";
const METAL_D = "#5c6a66";
const SHEET = "#e8f0ea";
const SHEET_D = "#b4c4ba";

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
const ring = (c, x, y, r) => {
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.stroke();
};
const grad = (make, stops) => {
  const g = make ? make() : null;
  if (!g || typeof g.addColorStop !== "function") return stops[stops.length >> 1][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
const vgrad = (c, y0, y1, stops) => grad(c.createLinearGradient && (() => c.createLinearGradient(0, y0, 0, y1)), stops);
const rgrad = (c, x, y, r, stops) => grad(c.createRadialGradient && (() => c.createRadialGradient(x, y, 0, x, y, r)), stops);
const ellipse = (c, x, y, rx, ry, rot = 0) => {
  c.beginPath();
  if (typeof c.ellipse === "function") c.ellipse(x, y, rx, ry, rot, 0, TAU);
  else c.arc(x, y, Math.max(rx, ry), 0, TAU);
};

// A soft round glow per color, drawn as a radial gradient (a plain disc where the context has none).
const HALO = freeze({ warm: "255,214,140", red: "255,70,50", green: "90,240,130", cold: "170,230,255", white: "235,245,255", amber: "255,170,40" });
function halo(ctx, kind, x, y, r, alpha) {
  if (alpha <= 0.01) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = rgrad(ctx, x, y, r, [[0, `rgba(${HALO[kind]},0.9)`], [0.4, `rgba(${HALO[kind]},0.35)`], [1, `rgba(${HALO[kind]},0)`]]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------ the track */

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

/* ------------------------------------------------------------- telegraphs */

// What to do about each obstacle, a glyph that fades in ahead of it: DUCK for a lamp or a door
// overhead (an arrow down, amber), JUMP for a shaft, a wheelchair or an IV stand (an arrow up,
// cyan), SHOOT for a surge lamp (red). Orderlies get none: their door shivering is their warning.
export const TELEGRAPH_SEE = 40;
export const TELEGRAPH_FULL = 30;
export const TELEGRAPH_WORDS = 3;
export const TELEGRAPH_ALPHA = 0.72;
export const ANSWERS = freeze({ shaft: "JUMP", chair: "JUMP", stand: "JUMP", lamp: "DUCK", door: "DUCK", surge: "SHOOT" });
const COLORS = freeze({ ...ANSWER_COLORS, SHOOT: "#ff6a50" });

const marks = new WeakMap();
// Every obstacle that wants a glyph: { kind, lead (where it begins), x (its middle), up (height
// of the glyph's anchor), n (which of its kind), answer }, in the room's order.
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
    add("shaft", a, (a + b) / 2, Math.max(heightAt(R, a - 0.1) ?? 0, heightAt(R, b + 0.1) ?? 0) + 6.5);
  }
  for (const [x] of R.chairs) add("chair", x - 8, x, (heightAt(R, x) ?? 10) + 7);
  for (const [x] of R.stands) add("stand", x, x, (heightAt(R, x) ?? 10) + 9);
  for (const [x0, x1, y, kind] of R.lows) add(kind ? "door" : "lamp", x0 - 3.2, (x0 + x1) / 2, y + 6.8);
  for (const [x, line] of R.lamps) add("surge", x - 24, x, (R.track[line] ? yOn(R.track[line], x) : 10) + 12.5);
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with the gurney at `x`: { ...mark, alpha (0..1, before the pulse), words }.
export function telegraphs(R, x) {
  const out = [];
  for (const m of telegraphMarks(R)) {
    const d = m.lead - x;
    if (d > TELEGRAPH_SEE || d < -6) continue;
    const alpha = Math.min(clamp((TELEGRAPH_SEE - d) / (TELEGRAPH_SEE - TELEGRAPH_FULL), 0, 1), clamp((d + 4) / 6, 0, 1));
    if (alpha > 0.01) out.push({ ...m, alpha, words: m.n < (m.kind === "surge" ? 2 : TELEGRAPH_WORDS) });
  }
  return out;
}

/* --------------------------------------------------------------------- art */

export function gurneyArt(d) {
  const { say, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === ID ? v.spec.ride : null);
  const state = (v) => (v.round && v.round.runner && v.round.runner.pack === ID ? v.round.runner : null);
  let FH = 54;
  const worldY = (y) => FH - y;
  const baseOf = (R, x, line) => FH - (R.track[line] && x >= R.track[line][0][0] && x <= R.track[line].at(-1)[0] ? yOn(R.track[line], x) : (heightAt(R, x) ?? 10));

  /* ------------------------------------------------------------- the room */

  // The still layers only get the corridor's color: the world is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The start's floor and the ambulance bay at the end: bare concrete with painted lines.
  function ground(ctx, v, look, a, b, top) {
    const y = v.g.FIELD_H - top;
    ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#7a8480"], [0.3, "#4a5450"], [1, "#1c2220"]]);
    ctx.fillRect(a, y, b - a, top + 2);
    ctx.fillStyle = "#c8d2cc";
    ctx.fillRect(a, y, b - a, 0.3);
    ctx.fillStyle = "#e6c84a";
    for (let x = a + 2; x < b - 2; x += 6) ctx.fillRect(x, y + 1.6, 3, 0.35);
  }
  function shelf() {}

  /* ------------------------------------------------- the corridor itself */

  // The ceiling tubes' state: lit (a few flicker), buzzing in the countdown, dead in the dark.
  function tubeOn(c, clock, k) {
    if (c && c.phase === "dark") return false;
    if (c && c.phase === "warn") return rnd(Math.floor(clock / 65), k + 11 * c.n) > 0.18 + 0.2 * (4 - c.n);
    return rnd(Math.floor(clock / 110), k) > 0.05;
  }

  function wall(ctx, v, R, c, cam) {
    const clock = v.clock;
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#070c0b"], [0.12, "#16231f"], [0.55, WALL], [1, "#1e2b26"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    // The ceiling: a dark band with a tube every 24 units.
    ctx.fillStyle = "#0a1210";
    ctx.fillRect(cam - 1, 0, FW + 2, 4.2);
    ctx.fillStyle = "#1e2c27";
    ctx.fillRect(cam - 1, 4.2, FW + 2, 0.4);
    const k0 = Math.floor((cam - 8) / 24);
    const k1 = Math.floor((cam + FW + 8) / 24);
    for (let k = k0; k <= k1; k++) {
      const x = k * 24 + 6;
      const on = tubeOn(c, clock, k);
      ctx.fillStyle = on ? "#f0fff6" : "#26332e";
      ctx.fillRect(x, 3.2, 10, 0.7);
      ctx.fillStyle = METAL_D;
      ctx.fillRect(x - 0.5, 3.0, 11, 0.25);
      if (on) halo(ctx, "white", x + 5, 4.6, 11, 0.28);
    }
    // The wall's doors, a room number over each, every 48 units, on the local floor; a window between.
    const j0 = Math.floor((cam - 12) / 48);
    const j1 = Math.floor((cam + FW + 6) / 48);
    for (let j = j0; j <= j1; j++) {
      const x = j * 48 + 14;
      const fy = heightAt(R, x + 2.5) ?? heightAt(R, x) ?? 14;
      const base = worldY(fy);
      ctx.fillStyle = "#101a17";
      ctx.fillRect(x - 0.5, base - 12.4, 6, 12.4);
      ctx.fillStyle = "#4a5f55";
      ctx.fillRect(x, base - 12, 5, 12);
      ctx.fillStyle = "#6f8a7e";
      ctx.fillRect(x + 1, base - 10.6, 3, 2.6);
      ctx.fillStyle = METAL;
      ctx.fillRect(x + 4, base - 5.6, 0.5, 0.9);
      ctx.fillStyle = "#d0d8d2";
      ctx.fillRect(x + 1.6, base - 13.5, 1.8, 0.8);
      const wx = j * 48 + 38;
      ctx.fillStyle = "#0d1614";
      ctx.fillRect(wx - 0.4, 8.4, 6.8, 7.2);
      ctx.fillStyle = "#1c3a44";
      ctx.fillRect(wx, 8.8, 6, 6.4);
      ctx.fillStyle = "rgba(190,230,255,0.18)";
      poly(ctx, [[wx + 0.6, 15], [wx + 3.4, 9], [wx + 4.6, 9], [wx + 1.8, 15]]);
      ctx.fill();
      ctx.strokeStyle = "#0d1614";
      ctx.lineWidth = 0.25;
      seg(ctx, wx + 3, 8.8, wx + 3, 15.2);
    }
    // The handrail along the wall, following the floor (a line each, none over a shaft).
    ctx.strokeStyle = "#7d8c86";
    ctx.lineWidth = 0.35;
    for (const pts of R.track) {
      if (pts[pts.length - 1][0] < cam - 4 || pts[0][0] > cam + FW + 4) continue;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, worldY(y + 5.2)) : ctx.moveTo(x, worldY(y + 5.2))));
      ctx.stroke();
    }
  }

  // The elevator shafts: a black drop between two lines, door frames at each lip, cables, a car's glow far below.
  function shafts(ctx, v, R, c, cam) {
    const clock = v.clock;
    for (let i = 0; i + 1 < R.track.length; i++) {
      const [xa, ya] = R.track[i].at(-1);
      const [xb, yb] = R.track[i + 1][0];
      if (xb < cam - 6 || xa > cam + FW + 6) continue;
      const top = worldY(Math.max(ya, yb) + 12);
      ctx.fillStyle = "#020405";
      ctx.fillRect(xa, top, xb - xa, FH - top + 1);
      ctx.strokeStyle = "#2a3532";
      ctx.lineWidth = 0.12;
      for (let k = 1; k < 4; k++) seg(ctx, xa + ((xb - xa) * k) / 4, top, xa + ((xb - xa) * k) / 4, FH);
      halo(ctx, "amber", (xa + xb) / 2, FH - 1.5, 9, 0.4);
      // The door frames and the floor indicator over the opening.
      for (const [x, y, side] of [[xa, ya, -1], [xb, yb, 1]]) {
        ctx.fillStyle = METAL_D;
        ctx.fillRect(x - (side < 0 ? 1.4 : 0), worldY(y + 9.2), 1.4, 9.2);
        ctx.fillStyle = METAL;
        ctx.fillRect(x - (side < 0 ? 0.4 : 0), worldY(y + 9.2), 0.4, 9.2);
      }
      const my = worldY(Math.max(ya, yb) + 9.8);
      ctx.fillStyle = METAL_D;
      ctx.fillRect(xa - 1.4, my, xb - xa + 2.8, 0.9);
      const blink = 0.5 + 0.5 * Math.sin(clock / 220 + i);
      ctx.fillStyle = `rgba(255,170,40,${0.5 + 0.5 * blink})`;
      ctx.fillRect((xa + xb) / 2 - 0.8, my + 0.15, 1.6, 0.6);
      halo(ctx, "amber", (xa + xb) / 2, my + 0.5, 4, 0.35 * blink);
    }
  }

  // The floors: linoleum with a bright lip, a baseboard stripe, and a ragged edge at each line's end.
  function floors(ctx, R, cam) {
    for (const pts of R.track) {
      if (pts[pts.length - 1][0] < cam - 4 || pts[0][0] > cam + FW + 4) continue;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, worldY(y)) : ctx.moveTo(x, worldY(y))));
      ctx.lineTo(pts.at(-1)[0], FH + 1);
      ctx.lineTo(pts[0][0], FH + 1);
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, 8, FH, [[0, "#9fb4aa"], [0.12, "#51645c"], [0.4, "#26332e"], [1, "#0a100e"]]);
      ctx.fill();
      ctx.strokeStyle = "#e4f2ea";
      ctx.lineWidth = 0.32;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, worldY(y)) : ctx.moveTo(x, worldY(y))));
      ctx.stroke();
      // The floor's checker seams, dashes following the slope.
      ctx.fillStyle = "rgba(10,20,16,0.4)";
      const a = Math.max(pts[0][0], Math.floor((cam - 2) / 8) * 8);
      const b = Math.min(pts.at(-1)[0], cam + FW + 2);
      for (let x = a; x < b; x += 8) ctx.fillRect(x, worldY(yOn(pts, x)) + 1.0, 4, 0.3);
    }
  }

  /* ------------------------------------------------------------ the things */

  // A wheelchair, side on: a big spoked wheel, a caster, a vinyl seat and back, handles, a footrest.
  function chair(ctx, v, x, base, ch, i) {
    const spin = (ch.rolling ? -(ch.x * 0.9) : 0) + i;
    ctx.save();
    ctx.translate(x, base);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, 0, 0.05, 2.6, 0.3);
    ctx.fill();
    ctx.strokeStyle = METAL_D;
    ctx.lineWidth = 0.28;
    // The frame, seat and back.
    seg(ctx, -1.2, -1.6, 1.4, -1.6);
    seg(ctx, -1.2, -1.6, -1.6, -3.6);
    seg(ctx, 1.4, -1.6, 2.0, -0.7);
    seg(ctx, -1.6, -3.6, -2.2, -3.6);
    ctx.fillStyle = "#2a2e3a";
    ctx.fillRect(-1.4, -2.0, 2.8, 0.5);
    ctx.fillRect(-1.9, -3.7, 0.7, 1.9);
    // The big wheel, with spokes turning, and a caster at the front.
    ctx.strokeStyle = "#1a1e22";
    ctx.lineWidth = 0.34;
    ring(ctx, -0.6, -1.5, 1.5);
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 0.1;
    ring(ctx, -0.6, -1.5, 1.1);
    for (let k = 0; k < 6; k++) {
      const a = spin + (k * TAU) / 6;
      seg(ctx, -0.6, -1.5, -0.6 + Math.cos(a) * 1.4, -1.5 + Math.sin(a) * 1.4);
    }
    ctx.fillStyle = "#1a1e22";
    disc(ctx, 1.9, -0.45, 0.45);
    ctx.fillStyle = METAL;
    ctx.fillRect(1.9, -0.5, 0.1, -0.2);
    seg(ctx, 2.0, -0.7, 2.6, -0.9);
    ctx.restore();
  }

  // An IV stand: a five-footed base on casters, a tall pole, a hook with a swaying bag and its tube.
  function stand(ctx, v, x, base, i) {
    const sway = Math.sin(v.clock / 380 + i) * 0.15;
    ctx.save();
    ctx.translate(x, base);
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 0.22;
    seg(ctx, 0, -0.6, 0, -6.2);
    seg(ctx, -1.5, -0.45, 1.5, -0.45);
    seg(ctx, -1.5, -0.45, -1.2, -0.1);
    seg(ctx, 1.5, -0.45, 1.2, -0.1);
    ctx.fillStyle = "#1a1e22";
    disc(ctx, -1.4, -0.2, 0.22);
    disc(ctx, 1.4, -0.2, 0.22);
    seg(ctx, -1.2, -6.1, 1.2, -6.1);
    // The bag: translucent blue, a tube down to a dripping tip.
    ctx.fillStyle = "rgba(150,210,235,0.75)";
    poly(ctx, [[0.9 + sway, -6.0], [1.9 + sway, -6.0], [2.0 + sway, -4.4], [1.4 + sway, -3.9], [0.8 + sway, -4.4]]);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(1.0 + sway, -5.8, 0.25, 1.2);
    ctx.strokeStyle = "rgba(200,230,240,0.8)";
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(1.4 + sway, -3.9);
    ctx.quadraticCurveTo(0.2, -3.0, 0.5, -1.4);
    ctx.stroke();
    ctx.restore();
  }

  // A doorway in the wall with an orderly in it: a shut door, shivering, flung open with a hulking orderly lunging out, sinking back, or empty.
  function doorway(ctx, v, x, base, o, i) {
    const clock = v.clock;
    const open = o.state === "up" || o.state === "sink" || o.state === "spent" || o.state === "broken";
    ctx.fillStyle = "#0b1210";
    ctx.fillRect(x - 3.1, base - 8.6, 6.2, 8.6);
    ctx.fillStyle = open ? "#16100e" : "#4a5f55";
    ctx.fillRect(x - 2.7, base - 8.2, 5.4, 8.2);
    if (!open) {
      const shake = o.state === "warn" ? Math.sin(clock / 24) * 0.22 : 0;
      ctx.fillStyle = "#586f64";
      ctx.fillRect(x - 2.4 + shake, base - 7.9, 4.8, 7.9);
      ctx.fillStyle = "#6f8a7e";
      ctx.fillRect(x - 1.6 + shake, base - 6.8, 3.2, 2.4);
      if (o.state === "warn") {
        halo(ctx, "red", x, base - 4.5, 5, 0.5 + 0.3 * Math.sin(clock / 60));
        ctx.fillStyle = "rgba(255,90,60,0.7)";
        ctx.fillRect(x + 2.3 + shake, base - 8.0, 0.35, 8);
      }
      ctx.fillStyle = METAL;
      ctx.fillRect(x + 1.5 + shake, base - 3.6, 0.5, 0.8);
      return;
    }
    // The door flung back against the wall.
    ctx.fillStyle = "#586f64";
    poly(ctx, [[x - 2.7, base - 8.2], [x - 3.6, base - 7.6], [x - 3.6, base - 0.4], [x - 2.7, base]]);
    ctx.fill();
    if (o.state === "spent" || o.state === "broken") {
      if (o.state === "broken") {
        ctx.fillStyle = "#3a1a1e";
        ellipse(ctx, x, base - 0.2, 1.6, 0.3);
        ctx.fill();
      }
      return;
    }
    // The orderly: a huge figure in a stained white coat, a bald pale head, a gauze mask, arms reaching.
    const out = o.state === "sink" ? clamp(o.t / 300, 0, 1) : clamp((1600 - o.t) / 160, 0, 1);
    const lean = 1.4 * out + Math.sin(clock / 90 + i) * 0.15;
    ctx.save();
    ctx.translate(x, base);
    ctx.fillStyle = "#cdd8d0";
    poly(ctx, [[-1.8, 0], [-1.6, -3.4], [-0.8, -4.7], [0.9 + lean * 0.5, -4.7], [1.8 + lean, -3.2], [1.9 + lean * 0.3, 0]]);
    ctx.fill();
    ctx.fillStyle = "#8a2a2a";
    ctx.fillRect(-0.4, -3.6, 1.2, 1.5);
    ctx.fillRect(0.2, -2.0, 0.8, 0.9);
    ctx.fillStyle = "#b8c4b8";
    ellipse(ctx, 0.5 + lean * 0.6, -5.4, 0.85, 0.95);
    ctx.fill();
    ctx.fillStyle = "#e0e8dc";
    ctx.fillRect(-0.2 + lean * 0.6, -5.3, 1.4, 0.8);
    ctx.fillStyle = "#0b1218";
    ctx.fillRect(0.0 + lean * 0.6, -5.8, 0.35, 0.3);
    ctx.fillRect(0.8 + lean * 0.6, -5.8, 0.35, 0.3);
    ctx.strokeStyle = "#cdd8d0";
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    seg(ctx, 1.4 + lean * 0.5, -4.2, 3.2 + lean * 1.2, -3.6 + Math.sin(clock / 70) * 0.3);
    seg(ctx, 0.8, -4.0, 2.6 + lean, -2.6);
    ctx.lineCap = "butt";
    ctx.restore();
    v.eyes.push(x + 0.2 + lean * 0.6, base - 5.65, 0.3, "#ff5a4a");
    v.eyes.push(x + 1.0 + lean * 0.6, base - 5.65, 0.3, "#ff5a4a");
  }

  // A surge lamp: a caged emergency lamp hung high on a chain, buzzing and spitting sparks; shot, it shorts out and smokes.
  function surge(ctx, v, x, base, broken, i, wave) {
    const clock = v.clock;
    const cy = base - 7.4;
    ctx.strokeStyle = "#3a4642";
    ctx.lineWidth = 0.18;
    seg(ctx, x, 0, x, cy - 1.5);
    ctx.fillStyle = METAL_D;
    ctx.fillRect(x - 0.9, cy - 1.7, 1.8, 0.5);
    ctx.fillStyle = broken ? "#1a1e1e" : "#ffe6a0";
    ellipse(ctx, x, cy, 1.1, 1.3);
    ctx.fill();
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 0.14;
    ring(ctx, x, cy, 1.4);
    seg(ctx, x - 1.4, cy, x + 1.4, cy);
    seg(ctx, x, cy - 1.4, x, cy + 1.4);
    if (broken) {
      for (let k = 0; k < 4; k++) {
        const p = ((clock / 700 + k * 0.27) % 1);
        ctx.fillStyle = `rgba(110,120,120,${0.5 * (1 - p)})`;
        disc(ctx, x + (rnd(k, i) - 0.5) * 1.2, cy - 1.6 - p * 3, 0.3 + p * 0.5);
      }
      return;
    }
    const buzz = 0.5 + 0.5 * Math.sin(clock / 45 + i * 3);
    halo(ctx, "warm", x, cy, 6, 0.35 + 0.4 * buzz * (rnd(Math.floor(clock / 60), i) > 0.4 ? 1 : 0.3));
    ctx.strokeStyle = "#fff6c8";
    ctx.lineWidth = 0.12;
    for (let k = 0; k < 3; k++) {
      const a = rnd(Math.floor(clock / 80), i * 4 + k) * TAU;
      const r = 1.6 + rnd(Math.floor(clock / 80), i * 5 + k) * 1.4;
      seg(ctx, x + Math.cos(a) * 1.3, cy + Math.sin(a) * 1.3, x + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
  }

  // A checkpoint: a post with a lantern, red until passed, then green.
  function checkpoint(ctx, v, x, base, on, i) {
    const clock = v.clock;
    ctx.strokeStyle = "#1a2220";
    ctx.lineWidth = 0.35;
    seg(ctx, x, base + 0.2, x, base - 5.4);
    seg(ctx, x, base - 5.2, x + 1.1, base - 5.2);
    const pulse = on ? 1 : 0.7 + 0.3 * Math.sin(clock / 160 + i);
    halo(ctx, on ? "green" : "red", x + 1.1, base - 4.5, on ? 4.2 : 3.6, 0.7 * pulse);
    ctx.fillStyle = "#14181a";
    ctx.fillRect(x + 0.6, base - 5.3, 1, 1.7);
    ctx.fillStyle = on ? "#7dffa0" : "#ff5a40";
    ctx.fillRect(x + 0.75, base - 5.1, 0.7, 1.3);
    ctx.fillStyle = on ? "#eaffee" : "#ffc0a0";
    ctx.fillRect(x + 0.95, base - 4.9, 0.25, 0.5);
  }

  // The finish: the ambulance doors thrown open on the bay, a green EXIT sign, and an ambulance's flashing lights.
  function finishGate(ctx, v, x, base) {
    const clock = v.clock;
    ctx.fillStyle = "#0a100e";
    ctx.fillRect(x - 2, base - 15, 20, 15);
    ctx.fillStyle = "#26332e";
    ctx.fillRect(x - 1, base - 14, 18, 14);
    // The ambulance's back: a white box, a red cross, its lights turning.
    ctx.fillStyle = "#e8eeea";
    ctx.fillRect(x + 3, base - 10.5, 11, 10.5);
    ctx.fillStyle = "#c8d2cc";
    ctx.fillRect(x + 3, base - 4.2, 11, 0.5);
    ctx.fillStyle = "#d62a34";
    ctx.fillRect(x + 7.8, base - 8.6, 1.6, 4.6);
    ctx.fillRect(x + 6.4, base - 7.1, 4.4, 1.6);
    const sw = Math.floor(clock / 220) % 2;
    ctx.fillStyle = sw ? "#ff3a3a" : "#3a6aff";
    ctx.fillRect(x + 3.4, base - 11.3, 2.2, 0.8);
    ctx.fillStyle = sw ? "#3a6aff" : "#ff3a3a";
    ctx.fillRect(x + 11.4, base - 11.3, 2.2, 0.8);
    halo(ctx, "red", x + 4.5, base - 11, 7, sw ? 0.5 : 0.15);
    halo(ctx, "cold", x + 12.5, base - 11, 7, sw ? 0.15 : 0.5);
    ctx.fillStyle = "#14181a";
    disc(ctx, x + 6, base - 0.2, 1.2);
    disc(ctx, x + 12, base - 0.2, 1.2);
    ctx.fillStyle = "#1f8a4a";
    ctx.fillRect(x + 5, base - 14.8, 7, 1.6);
    label(ctx, "EXIT", x + 8.5, base - 13.4, 1.3, "#d8ffe4", "center");
  }

  /* ---------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    cam = Math.round(cam * 8) / 8;
    wall(ctx, v, R, c, cam);
    shafts(ctx, v, R, c, cam);
    floors(ctx, R, cam);
    const lo = cam - 8;
    const hi = cam + FW + 8;
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, baseOf(R, x, R.track.findIndex((p) => x >= p[0][0] && x <= p.at(-1)[0])), i <= c.check, i);
    });
    if (R.finish > lo - 14 && R.finish < hi) finishGate(ctx, v, R.finish + 10, worldY(10));
    R.orderlies.forEach(([x, line], i) => {
      if (x > lo && x < hi) doorway(ctx, v, x, baseOf(R, x, line), c.orderlies[i], i);
    });
    R.lamps.forEach(([x, line], i) => {
      if (x > lo && x < hi) surge(ctx, v, x, baseOf(R, x, line), Boolean(c.lamps[i]), i, c.waves[i]);
    });
    R.stands.forEach(([x, line], i) => {
      if (x > lo && x < hi) stand(ctx, v, x, baseOf(R, x, line), i);
    });
    R.chairs.forEach(([x0, line], i) => {
      const ch = c.chairs[i];
      if (ch.x > lo && ch.x < hi) chair(ctx, v, ch.x, baseOf(R, ch.x, line), ch, i);
    });
    // The bay and the start's floor, over the wall (the still layers' were painted under it).
    for (const [a, b, top] of v.spec.ground) if (b > lo && a < hi) ground(ctx, v, LOOKS.codeblue, a, b, top);
    // A finished ride: the gurney rests where it came to a stop, behind Planny as he walks out.
    if (c.done) gurney(ctx, v, R, c);
  }

  /* ---------------------------------------------------- the gurney, in front */

  // The gurney with Planny strapped on (he is drawn by the game behind its sheet and belts): frame, wheels, mattress, sheet, straps, an IV pole and a beacon.
  function gurney(ctx, v, R, c) {
    const { round } = v;
    const you = round.you;
    const clock = v.clock;
    const fx = v.fx;
    const done = c.done;
    const x = done && c.restX !== undefined ? c.restX : you.x;
    let y = done ? (v.spec.ground.find(([a, b]) => x >= a && x <= b) || [0, 0, 10])[2] : you.y;
    let pitch;
    if (done) pitch = 0;
    else if (c.line >= 0) pitch = Math.atan2((heightAt(R, x + 3) ?? y) - (heightAt(R, x - 3) ?? y), 6) * 0.95;
    else pitch = clamp(you.vy / Math.max(14, c.v), -1, 1) * 0.4;
    const fast = !done && c.line >= 0;
    const shake = fast ? Math.sin(clock / 29) * 0.04 * (c.v / GURNEY_V) : 0;
    ctx.save();
    ctx.translate(x, FH - y + shake);
    ctx.rotate(-pitch);
    // Sparks off the squealing wheels, longer the faster it goes.
    if (fast) {
      for (let k = 0; k < 10; k++) {
        const p = ((clock / (260 + (k % 4) * 50) + k * 0.131) % 1);
        ctx.fillStyle = `rgba(255,${190 - Math.floor(p * 90)},80,${(1 - p) * 0.9})`;
        disc(ctx, -2.6 - p * (2.5 + (c.v / GURNEY_V) * 3) * (0.6 + rnd(k, 1)), -0.2 - p * (0.6 + rnd(k, 2) * 1.5), 0.12 + (1 - p) * 0.14);
      }
    }
    ctx.save();
    ctx.scale(1.1, 1.3);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, 0.1, 0.1, 3.8, 0.25);
    ctx.fill();
    // The undercarriage: two legs with a cross brace, and the wheels with a hub that turns.
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 0.18;
    seg(ctx, -2.8, -1.1, -2.8, -0.4);
    seg(ctx, 2.8, -1.1, 2.8, -0.4);
    seg(ctx, -2.8, -1.0, 2.8, -0.6);
    ctx.strokeStyle = "#1a1e22";
    ctx.lineWidth = 0.3;
    for (const wx of [-2.8, 2.8]) {
      ring(ctx, wx, -0.45, 0.45);
      ctx.strokeStyle = METAL;
      ctx.lineWidth = 0.1;
      const a = x * 1.3 + wx;
      seg(ctx, wx, -0.45, wx + Math.cos(a) * 0.4, -0.45 + Math.sin(a) * 0.4);
      ctx.strokeStyle = "#1a1e22";
      ctx.lineWidth = 0.3;
    }
    // The mattress on its steel frame, a side rail, the head raised, and a pillow.
    ctx.fillStyle = METAL_D;
    ctx.fillRect(-3.8, -1.35, 7.6, 0.28);
    ctx.fillStyle = "#3a5a6a";
    ctx.beginPath();
    ctx.moveTo(-3.7, -1.35);
    ctx.lineTo(3.7, -1.35);
    ctx.lineTo(3.7, -1.9);
    ctx.lineTo(-3.7, -1.9);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 0.1;
    seg(ctx, -3.6, -2.5, 3.6, -2.5);
    seg(ctx, -2.4, -2.5, -2.4, -1.35);
    seg(ctx, 0.4, -2.5, 0.4, -1.35);
    seg(ctx, 2.6, -2.5, 2.6, -1.35);
    ctx.restore();
    // The sheet over his legs and the two belts across him, in front of Planny.
    ctx.fillStyle = SHEET;
    poly(ctx, [[-3.5, -0.9], [-3.3, -2.7], [-2.2, -3.0], [0.2, -2.8], [2.2, -3.0], [3.5, -2.6], [3.6, -0.9]]);
    ctx.fill();
    ctx.fillStyle = SHEET_D;
    poly(ctx, [[-0.6, -0.9], [-0.4, -2.8], [0.6, -2.85], [0.9, -0.9]]);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,140,130,0.6)";
    ctx.lineWidth = 0.08;
    seg(ctx, -2.4, -2.6, -2.1, -1.3);
    seg(ctx, 1.8, -2.7, 2.0, -1.2);
    for (const by of [-3.0, -2.2]) {
      ctx.fillStyle = "#2a3a6a";
      ctx.fillRect(-3.0, by * 1.0 - 0.18, 6.0, 0.4);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(0.2, by * 1.0 - 0.22, 0.5, 0.48);
    }
    // The IV pole at the foot and its swaying bag, and a red beacon that blinks.
    ctx.strokeStyle = METAL;
    ctx.lineWidth = 0.14;
    seg(ctx, 3.9, -2.5, 3.9, -7.4);
    seg(ctx, 3.9, -7.4, 3.0, -7.4);
    const sw = Math.sin(clock / 210) * 0.2;
    ctx.fillStyle = "rgba(150,210,235,0.8)";
    poly(ctx, [[2.6 + sw, -7.3], [3.4 + sw, -7.3], [3.5 + sw, -5.9], [3.0 + sw, -5.5], [2.5 + sw, -5.9]]);
    ctx.fill();
    const blink = Math.floor(clock / 260) % 2;
    ctx.fillStyle = blink ? "#ff4a3a" : "#5a1a16";
    disc(ctx, -3.9, -2.3, 0.28);
    if (blink && !done) halo(ctx, "red", -3.9, -2.3, 3.2, 0.5);
    // A landing's puff of dust.
    const land = fx && fx.blueLand !== undefined ? fx.clock - fx.blueLand.t0 : 1e9;
    if (land < 380) {
      for (let k = 0; k < 7; k++) {
        const p = land / 380;
        ctx.fillStyle = `rgba(200,210,205,${(1 - p) * 0.7})`;
        disc(ctx, (k - 3) * 0.9 * (0.5 + p * 1.4), -0.3 - p * (0.8 + rnd(k, 4) * 1.4) * (fx.blueLand.big ? 1.6 : 1), 0.25 + p * 0.3);
      }
    }
    ctx.restore();
  }

  // A hanging surgical lamp (kind 0): a ceiling arm and a big disc of bulbs; or a pair of swinging doors (kind 1) hung from the ceiling, their bottom edge the underside.
  function low(ctx, v, x0, x1, y, kind, i) {
    const clock = v.clock;
    const cx = (x0 + x1) / 2;
    const bottom = worldY(y);
    const sway = Math.sin(clock / 330 + i * 1.7) * 0.5;
    if (!kind) {
      ctx.strokeStyle = METAL_D;
      ctx.lineWidth = 0.4;
      seg(ctx, cx, 0, cx, bottom - 1.4);
      seg(ctx, cx, bottom - 1.4, cx + sway, bottom - 0.9);
      ctx.fillStyle = "#c8d2cc";
      ellipse(ctx, cx + sway, bottom - 0.5, (x1 - x0) / 2 + 0.6, 0.85);
      ctx.fill();
      ctx.fillStyle = "#7a8682";
      ellipse(ctx, cx + sway, bottom - 0.2, (x1 - x0) / 2 + 0.2, 0.45);
      ctx.fill();
      ctx.fillStyle = "#fff6d8";
      for (let k = 0; k < 5; k++) disc(ctx, cx + sway + (k - 2) * ((x1 - x0) / 5.5), bottom + 0.05, 0.28);
      halo(ctx, "warm", cx + sway, bottom + 0.4, 6, 0.4);
      return;
    }
    // Two door slabs with portholes, swinging on their hinges at each side and a rubber strip along the bottom.
    const w = (x1 - x0) / 2;
    for (const side of [-1, 1]) {
      const hx = side < 0 ? x0 : x1;
      const lean = sway * side * -1;
      ctx.fillStyle = "#586f64";
      poly(ctx, [[hx, 0], [hx - side * w, 0], [hx - side * w + lean, bottom], [hx + lean * 0.2, bottom]]);
      ctx.fill();
      ctx.fillStyle = "#6f8a7e";
      poly(ctx, [[hx - side * w * 0.2, bottom - 2.4], [hx - side * w * 0.8, bottom - 2.4], [hx - side * w * 0.8 + lean * 0.8, bottom - 4.6], [hx - side * w * 0.2 + lean * 0.3, bottom - 4.6]]);
      ctx.fill();
      ctx.fillStyle = "#1c3a44";
      disc(ctx, hx - side * w * 0.5 + lean * 0.6, bottom - 3.6, 0.7);
      ctx.fillStyle = "#14181a";
      ctx.fillRect(Math.min(hx, hx - side * w + lean), bottom - 0.3, w, 0.3);
    }
    ctx.strokeStyle = "#2a3430";
    ctx.lineWidth = 0.15;
    seg(ctx, cx, 0, cx, bottom);
  }

  // A glyph over an obstacle, saying what to do about it.
  function glyph(ctx, v, t) {
    const up = t.answer === "JUMP";
    const shoot = t.answer === "SHOOT";
    const col = COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const bob = Math.sin(v.clock / 260 + t.lead) * 0.35 * (up ? -1 : 1);
    const cy = Math.min(FH - 7, FH - t.up) + bob;
    const ay = cy + (up ? -2.6 : 2.6);
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (shoot) {
      for (const [w, cc] of [[1.2, "rgba(4,8,22,0.8)"], [0.5, col]]) {
        ctx.strokeStyle = cc;
        ctx.lineWidth = w;
        ring(ctx, t.x, cy - 1.8, 1.6);
        seg(ctx, t.x - 2.4, cy - 1.8, t.x - 0.9, cy - 1.8);
        seg(ctx, t.x + 0.9, cy - 1.8, t.x + 2.4, cy - 1.8);
        seg(ctx, t.x, cy - 3.3, t.x, cy - 4.4);
      }
    } else {
      const dir = up ? -1 : 1;
      for (const [pass, w, cc] of [[0, 1.3, "rgba(4,8,22,0.8)"], [1, 0.6, col]]) {
        ctx.strokeStyle = cc;
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
    }
    if (t.words) label(ctx, t.answer, t.x, shoot ? cy + 1.2 : cy + (up ? 1.2 : -1.2), 2.3, col, "center");
    ctx.restore();
  }

  /* ------------------------------------------- the countdown and the monitor */

  // The heartbeat monitor: a trace across the top that scrolls left, a spike per beat, the beats closer the fewer hearts are left, a flat red line at the last heart.
  function monitor(ctx, v, c, cam) {
    const b = v.round.bonusRound;
    const hearts = b ? b.hearts : 5;
    const flat = Boolean(c.flat) || hearts <= 1;
    const every = c.every || 1000;
    const y0 = 9.4;
    const amp = 2.3;
    const x0 = cam + 5;
    const W = 80;
    const speed = 30;
    ctx.fillStyle = "rgba(2,10,8,0.55)";
    ctx.fillRect(x0 - 1, y0 - 3.4, W + 12, 6.8);
    ctx.strokeStyle = flat ? "#ff5a4a" : "#6dffb0";
    ctx.lineWidth = 0.22;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const age0 = c.pulse * every;
    for (let px = 0; px <= W; px += 0.5) {
      const ago = ((W - px) / speed) * 1000;
      let s = 0;
      if (!flat) {
        for (let k = 0; k < 6; k++) {
          const dt = (age0 + k * every - ago) / 1000;
          if (dt < -0.3 || dt > 0.5) continue;
          s += 0.18 * Math.exp(-(((dt + 0.16) / 0.035) ** 2)) - 0.22 * Math.exp(-(((dt + 0.03) / 0.012) ** 2)) + Math.exp(-((dt / 0.014) ** 2)) - 0.4 * Math.exp(-(((dt - 0.035) / 0.014) ** 2)) + 0.32 * Math.exp(-(((dt - 0.22) / 0.05) ** 2));
        }
      }
      const yy = y0 - s * amp;
      if (px === 0) ctx.moveTo(x0 + px, yy);
      else ctx.lineTo(x0 + px, yy);
    }
    ctx.stroke();
    ctx.fillStyle = flat ? "#ff5a4a" : "#d8ffe8";
    disc(ctx, x0 + W, y0, 0.4);
    label(ctx, flat ? "FLAT" : `${Math.round(60000 / every)}`, x0 + W + 10, y0 + 0.7, 2.2, flat ? "#ff5a4a" : "#6dffb0", "right");
  }

  // LIGHTS OUT and its countdown, in the middle of the screen, red.
  function countdown(ctx, v, c, cam) {
    if (c.phase !== "warn") return;
    const pulse = 0.7 + 0.3 * Math.sin(v.clock / 70);
    ctx.globalAlpha = pulse;
    label(ctx, "LIGHTS OUT", cam + FW / 2, 16, 2.6, "#ff8070", "center");
    label(ctx, String(c.n), cam + FW / 2, 24, 8, "#ff4a3a", "center");
    ctx.globalAlpha = 1;
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
    if (!c.done) gurney(ctx, v, R, c);
    R.lows.forEach(([x0, x1, y, kind], i) => {
      if (x1 >= lo && x0 <= hi) low(ctx, v, x0, x1, y, kind, i);
    });
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Glass and sparks from a shot lamp, tumbling.
    const bits = v.fx && v.fx.blueBits;
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
    countdown(ctx, v, c, cam);
    monitor(ctx, v, c, cam);
  }

  /* -------------------------------------------------- the dark and its lights */

  // How dark the corridor is: the blackout's fade, a flicker in the countdown, none otherwise.
  function dim(v) {
    const c = state(v);
    if (!c || !ride(v)) return 0;
    if (c.phase === "dark") return 0.97 * c.dark;
    if (c.phase === "warn") return rnd(Math.floor(v.clock / 70), 7 + c.n) > 0.62 - 0.12 * (3 - c.n) ? 0.8 : 0;
    return 0;
  }

  // What stays lit in the dark: the monitor's band across the top, the telegraph glyphs, a faint
  // pool on every obstacle near (so it shows as an outline) and the emergency strips along the
  // floor, dying away through the blackout; lit always: the surge lamps, the checkpoints, the lip.
  function lights(v, add) {
    const R = ride(v);
    const c = state(v);
    if (!R || !c) return;
    const round = v.round;
    const you = round.you;
    const clock = v.clock;
    const cam = round.camX;
    const lo = cam - 10;
    const hi = cam + FW + 10;
    const dark = c.phase === "dark" || c.phase === "warn";
    // The monitor's band.
    for (const dx of [16, 48, 80]) add(cam + dx, FH - 9, 22, 0.85);
    if (c.phase === "warn") add(cam + FW / 2, FH - 20, 14, 0.8);
    // The pool of light the gurney's beacon throws.
    add(you.x - 1, you.y + 2, 7, 0.4);
    if (dark) {
      // The emergency strips, red, along the floor every 20 units, dying away.
      const w = R.waves[c.wave] || R.waves.find(([x0, x1]) => you.x < x1) || [0, 1];
      const left = clamp(1 - (you.x - w[0]) / Math.max(1, w[1] - w[0]), 0, 1);
      const a = 0.12 + 0.2 * left;
      for (let x = Math.floor(lo / 20) * 20; x < hi; x += 20) {
        const fy = heightAt(R, x);
        if (fy === null) continue;
        add(x + 6, fy + 0.8, 6.5, a * (0.7 + 0.3 * Math.sin(clock / 230 + x)) * (rnd(Math.floor(clock / 140), x | 0) > 0.08 ? 1 : 0.3));
      }
      // Each thing near, a faint pool: the outline.
      const near = (x) => x > you.x - 4 && x < you.x + 62;
      R.chairs.forEach(([x0, line], i) => {
        if (near(c.chairs[i].x)) add(c.chairs[i].x, (heightAt(R, c.chairs[i].x) ?? 10) + 2, 4, 0.2);
      });
      R.stands.forEach(([x]) => near(x) && add(x, (heightAt(R, x) ?? 10) + 3, 4, 0.2));
      R.orderlies.forEach(([x], i) => near(x) && c.orderlies[i].state !== "spent" && add(x, (heightAt(R, x) ?? 10) + 3, 4.5, c.orderlies[i].state === "up" ? 0.3 : 0.18));
      R.lows.forEach(([x0, x1, y]) => near((x0 + x1) / 2) && add((x0 + x1) / 2, y + 0.5, 5, 0.22));
      for (let i = 0; i + 1 < R.track.length; i++) {
        const [xa, ya] = R.track[i].at(-1);
        if (near(xa)) add(xa + 6, Math.max(ya, R.track[i + 1][0][1]) + 1.5, 8, 0.28 + 0.1 * Math.sin(clock / 200 + i));
      }
      for (const t of telegraphs(R, you.x)) add(t.x, t.up, 3.6, 0.32 * t.alpha);
    }
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x + 1.1, (heightAt(R, x) ?? 10) + 4.5, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.lamps.forEach(([x, line], i) => {
      if (x > lo && x < hi && !c.lamps[i]) add(x, (heightAt(R, x) ?? 10) + 7.4, 6, 0.7);
    });
    R.orderlies.forEach(([x], i) => {
      if (x > lo && x < hi && c.orderlies[i].state === "warn") add(x, (heightAt(R, x) ?? 10) + 4, 5, 0.5);
    });
    if (R.finish > lo - 14 && R.finish < hi) add(R.finish + 19, 17, 14, 0.6);
    if (v.fx && v.fx.blueLand && v.fx.clock - v.fx.blueLand.t0 < 260) add(you.x, you.y + 1, 6, 0.4);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // Glass and sparks flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.blueBits = (fx.blueBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.blueBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring: ringFx, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    if (e.type === "blueDuck" && !gateOnce(fx, "blueDuckMs", 160)) return true;
    say(tone, voice[0], e.type === "blueBeat" && e.flat ? "flat" : voice[1], e.type === "blueBeat" ? 0.4 : 0.5);
    switch (e.type) {
      case "blueJump":
        burst(e.x, e.y, "#cfd8d4", 5, 7, 300);
        break;
      case "blueLand":
        fx.blueLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, "#ffb060", e.big ? 12 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(200, 0.5);
        break;
      case "blueLaunch":
        burst(e.x, e.y, "#ffb060", 12, 14, 380);
        float(e.x, e.y + 5, e.last ? "Out the doors!" : "Whee!", GOLD, 2.2);
        break;
      case "blueCrash":
        shake(320, 1);
        flash("#ffd0d0", 200);
        burst(e.x, e.y + 1, e.what === "orderly" ? "#cdd8d0" : "#9aa8a4", 18, 17, 520);
        burst(e.x, e.y + 1, "#ff6a50", 8, 14, 360);
        break;
      case "blueCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ringFx(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "blueFinish":
        shake(260, 0.7);
        burst(e.x, e.y, "#cfd8d4", e.big ? 22 : 14, 13, 560);
        float(e.x, e.y + 5, "Made it!", GOLD, 2.6);
        break;
      case "blueWarn":
        flash("#ff4030", 70);
        ringFx(e.x, e.y + 3, "#ff5a4a", 1, 10, 420);
        break;
      case "blueDark":
        shake(160, 0.6);
        break;
      case "blueLit":
        float(e.x, e.y + 6, "Lights on", GOLD, 2.2);
        break;
      case "blueChair":
        burst(e.x, e.y + 0.5, "#cfd8d4", 4, 5, 300);
        break;
      case "blueOrderlyWarn":
        burst(e.x, e.y + 3, "#ff6a50", 5, 4, 380);
        break;
      case "blueOrderlyUp":
        burst(e.x, e.y + 1, "#cfd8d4", 8, 8, 360);
        shake(120, 0.4);
        break;
      case "blueOrderlyHit":
        burst(e.x, e.y, "#cdd8d0", 5, 9, 280);
        break;
      case "blueOrderlyBreak":
        burst(e.x, e.y, "#cdd8d0", 14, 14, 480);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "blueLamp":
        burst(e.x, e.y, "#fff0b0", 14, 14, 460);
        splinter(fx, e.x, e.y, ["#fff6c8", "#ffd060", "#ffffff"]);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        float(e.x, e.y - 2, "Lights stay on", "#d8ffe4", 2);
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
