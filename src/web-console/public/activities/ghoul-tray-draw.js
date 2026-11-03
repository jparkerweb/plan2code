// Plan2Code Web Console - Ghoul Rush's Servants' Back Stairs, its drawing: a rush down the back stairs and through the basement kitchens on a silver serving tray. A tiled wall of arches behind, a rail of hanging copper pots and ovens in the middle distance, steam and drifting flour, the shelves and stair flights the tray rides (a sheen of grease on the quick stretches), rolling pots and cutlery, hams and copper pans hanging from the ceiling, spectral cooks flinging dishes, silver domes and flying plates with a dessert, service bells for checkpoints, the dining table at the end, and the tray with Planny on it.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and LOSE_SOUNDS are plain
// data; trayArt(d) takes ghoul-draw.js's drawing helpers (`d`) and hands back the drawing by
// kind, so this file never reaches back into it. Drawn in room units, the way ghoul-draw.js
// draws: y counted down from the field's top, so a world height `y` is drawn at `FIELD_H - y`.
// The still layers' pit is dark under the whole ride, so the world is drawn by `moving` (every
// frame, over them); the ham and pans (lows), the tray itself, the flour in front and the
// glyphs that say what to do are drawn by `front`. No random numbers: everything comes from a
// hash. What the art reads off the rules (ghoul-tray.js):
//
// - the room: `spec.ride` ({ track, pots, lows [x0, x1, y, kind], cooks, domes, plates, grease,
//   checks, finish }), `spec.ground` (the landing at the start and the dining table at the end).
// - `round.runner` (id "tray"; any other state is none of ours): `v`, `line` (-1 in the air),
//   `check`, `done`, `served`, `domes` [taken], `plates` [caught], `cooks` [{ state "down" | "up"
//   | "toss" | "spent" | "broken", t, dish: null | { x, y } }].
// - Planny: `you.state`, `you.vy` (tilts the tray in the air), `you.ducking`, `you.x`, `you.y`.
// - events leave short-lived bits in the view's `fx` (`trayBits`, `trayLand`).

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const pit = (o) => freeze({ pack: "tray", custom: true, noMoon: true, pit: "#0c0706", ...o });
export const LOOKS = freeze({
  tray: pit({ wallTop: "#1a120e", wallLow: "#3a2a22", paper: "#4a3a30", wainscot: "#2c201a", floorTop: "#c9bfa6", floor: "#6a5a48", floorEdge: "#2a1e16", shelf: "#6a4a30", shelfTop: "#a8825a", window: "#ffd9a0", decor: "kitchen", color: "#e8c890", dark: 0.45 }),
});

// How each new kind sounds, by act (first drafts, in ghoul-sfx-tray.js).
export const VOICES = freeze({
  tray: freeze({ jump: "ghoulTrayJump", land: "ghoulTrayLand", launch: "ghoulTrayLaunch", duck: "ghoulTrayDuck", crash: "ghoulTrayCrash", check: "ghoulTrayCheck", finish: "ghoulTrayFinish" }),
  traydome: freeze({ get: "ghoulTrayDome" }),
  trayplate: freeze({ catch: "ghoulTrayPlate" }),
  traycook: freeze({ up: "ghoulTrayCookUp", toss: "ghoulTrayToss", hit: "ghoulTrayCookHit" }),
  traydish: freeze({ break: "ghoulTrayDishBreak" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  trayJump: ["tray", "jump"],
  trayLand: ["tray", "land"],
  trayLaunch: ["tray", "launch"],
  trayDuck: ["tray", "duck"],
  trayCrash: ["tray", "crash"],
  trayCheck: ["tray", "check"],
  trayFinish: ["tray", "finish"],
  trayDome: ["traydome", "get"],
  trayPlate: ["trayplate", "catch"],
  trayCookUp: ["traycook", "up"],
  trayToss: ["traycook", "toss"],
  trayCookHit: ["traycook", "hit"],
  trayDishBreak: ["traydish", "break"],
});
export const LOSE_WORDS = freeze({ pot: "Tripped on a pot", cutlery: "Skewered by cutlery", ham: "Hit by a ham", pans: "Clonked by the pans", dish: "Hit by a dish", tumble: "Down the stairs" });
export const LOSE_SOUNDS = freeze({
  pot: ["clank", 0.6, 0.8],
  cutlery: ["clank", 0.5, 1.3],
  ham: ["smash", 0.5, 0.8],
  pans: ["clank", 0.6, 0.6],
  dish: ["smash", 0.6, 1],
  tumble: ["ghoulPitFall", 0.55, 0.9],
});

const FW = 96;
let FH = 54;
const COPPER = "#c8793a";
const COPPER_D = "#8a4a22";
const SILVER = "#dde3ee";
const SILVER_D = "#9aa4b8";
const CHINA = "#f4f1e8";

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
// A vertical gradient, or its middle color on a context with none.
const vgrad = (c, y0, y1, stops) => {
  const g = typeof c.createLinearGradient === "function" ? c.createLinearGradient(0, y0, 0, y1) : null;
  if (!g || typeof g.addColorStop !== "function") return stops[stops.length >> 1][1];
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
};
// A soft glow: a few stacked translucent discs (cheap, and the same on any context).
function glow(c, x, y, r, rgb, alpha) {
  for (let k = 3; k >= 1; k--) {
    c.fillStyle = `rgba(${rgb},${alpha * (0.14 + (3 - k) * 0.1)})`;
    disc(c, x, y, (r * k) / 3);
  }
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

/* ------------------------------------------------------------ telegraphs */

// What to do about each obstacle, as a glyph that fades in ahead of it: DUCK for a ham or pans (an
// arrow down, amber), JUMP for a gap, a pot or cutlery (an arrow up, cyan), SHOOT for a cook (a
// ring, red; a jump over his dish works too). Domes and plates are rewards and get none. It all
// comes from the room's `ride` fields and where the tray is (no random numbers, no rules).
export const TELEGRAPH_SEE = 40;
export const TELEGRAPH_FULL = 30;
export const TELEGRAPH_WORDS = 3;
export const TELEGRAPH_ALPHA = 0.72;
export const ANSWERS = freeze({ gap: "JUMP", pot: "JUMP", cutlery: "JUMP", ham: "DUCK", pans: "DUCK", cook: "SHOOT" });
export const ANSWER_COLORS = freeze({ JUMP: "#5fe3ff", DUCK: "#ffb02e", SHOOT: "#ff7a6a" });

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
    add("gap", a, (a + b) / 2, Math.max(heightAt(R, a - 0.1) ?? 0, heightAt(R, b + 0.1) ?? 0) + 6.5);
  }
  for (const [x, , kind] of R.pots) add(kind ? "cutlery" : "pot", x, x, (heightAt(R, x) ?? 10) + 7);
  for (const [x0, x1, y, kind] of R.lows) add(kind ? "pans" : "ham", x0 - 3.2, (x0 + x1) / 2, y + (kind ? 7 : 7.4));
  for (const [x] of R.cooks) add("cook", x - 40, x, (heightAt(R, x) ?? 10) + 9);
  out.sort((p, q) => p.lead - q.lead);
  marks.set(R, out);
  return out;
}

// The glyphs showing with the tray at `x`: { ...mark, alpha (0..1, before the pulse), words }.
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

export function trayArt(d) {
  const { ellipse, say, label, GOLD } = d;
  const ride = (v) => (v.spec && v.spec.ride && v.spec.ride.runner === "tray" ? v.spec.ride : null);
  const state = (v) => (v.round && v.round.runner && v.round.runner.id === "tray" ? v.round.runner : null);
  const worldY = (y) => FH - y;
  const baseOf = (R, x, line) => worldY(heightAt(R, x) ?? 10);

  /* ------------------------------------------------------------- the room */

  // The still layers only get the wall's color: the world is drawn by `moving`.
  function backdrop(ctx, v, look, x0, x1) {
    ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  // The landing at the top of the stairs (flagstones), and the dining table at the end (a long
  // table under a white cloth, a runner of red along it).
  function ground(ctx, v, look, a, b, top) {
    const R = ride(v);
    const y = v.g.FIELD_H - top;
    if (R && a >= R.finish - 1) {
      ctx.fillStyle = "#5a3a22";
      ctx.fillRect(a, y, b - a, top + 2);
      ctx.fillStyle = "#f2efe6";
      ctx.fillRect(a, y, b - a, 1.1);
      ctx.fillStyle = "#b2182b";
      ctx.fillRect(a, y + 0.1, b - a, 0.35);
      ctx.fillStyle = "#d9d3c4";
      for (let x = a; x < b; x += 3.2) ctx.fillRect(x, y + 1.1, 1.4, Math.min(top, 5));
      return;
    }
    ctx.fillStyle = vgrad(ctx, y, y + top, [[0, "#c9bfa6"], [0.3, "#8f846c"], [1, "#2a2018"]]);
    ctx.fillRect(a, y, b - a, top + 2);
    ctx.strokeStyle = "rgba(20,14,8,0.4)";
    ctx.lineWidth = 0.1;
    for (let x = a; x <= b; x += 4) seg(ctx, x, y, x, y + 3);
    seg(ctx, a, y + 1.5, b, y + 1.5);
    ctx.fillStyle = "#f2ead2";
    ctx.fillRect(a, y, b - a, 0.3);
  }
  function shelf() {}

  /* --------------------------------------------------------- the distance */

  // The kitchen behind: warm dark, a wall of white tile with arches, a rail of hanging pots and
  // ladles, brick ovens, drifting steam. Parallax tiles drawn straight, no layers cached.
  function distance(ctx, cam, clock) {
    ctx.fillStyle = vgrad(ctx, 0, FH, [[0, "#0e0908"], [0.5, "#241813"], [1, "#4a3426"]]);
    ctx.fillRect(cam - 1, 0, FW + 2, FH);
    // The tiled wall, a band of white tile lines, behind.
    const wall = cam * 0.88;
    ctx.fillStyle = "rgba(214,206,186,0.14)";
    ctx.fillRect(cam - 1, 12, FW + 2, 34);
    ctx.strokeStyle = "rgba(230,222,200,0.12)";
    ctx.lineWidth = 0.1;
    for (let r = 0; r < 9; r++) seg(ctx, cam - 1, 13 + r * 3.8, cam + FW + 1, 13 + r * 3.8);
    for (let x = Math.floor(wall / 3.8) * 3.8; x < wall + FW + 4; x += 3.8) seg(ctx, x + cam - wall, 12, x + cam - wall, 46);
    // Arches every 36 with a hanging lamp, slow.
    const par = 0.82;
    for (let k = Math.floor((cam * par - 10) / 36); k <= Math.floor((cam * par + FW + 10) / 36); k++) {
      const ax = cam + (k * 36 - cam * par);
      ctx.fillStyle = "rgba(10,6,4,0.55)";
      ctx.beginPath();
      ctx.moveTo(ax, 46);
      ctx.lineTo(ax, 24);
      ctx.arc(ax + 7, 24, 7, Math.PI, 0);
      ctx.lineTo(ax + 14, 46);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#5a4a3a";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      glow(ctx, ax + 7, 10 + rnd(k, 1) * 3, 6, "255,190,110", 0.5 + 0.1 * Math.sin(clock / 300 + k));
    }
    // The rail of hanging pots and ladles in the middle distance.
    const mid = 0.62;
    ctx.strokeStyle = "#2a1e16";
    ctx.lineWidth = 0.5;
    seg(ctx, cam - 1, 9, cam + FW + 1, 9);
    for (let k = Math.floor((cam * mid - 4) / 11); k <= Math.floor((cam * mid + FW + 4) / 11); k++) {
      const px = cam + (k * 11 - cam * mid);
      const drop = 3 + rnd(k, 2) * 5;
      const kind = Math.floor(rnd(k, 3) * 3);
      ctx.strokeStyle = "#2a1e16";
      ctx.lineWidth = 0.18;
      seg(ctx, px, 9, px, 9 + drop);
      ctx.fillStyle = kind === 2 ? SILVER_D : COPPER_D;
      if (kind === 0) {
        ctx.fillRect(px - 1.5, 9 + drop, 3, 2.4);
        ctx.fillStyle = "rgba(255,200,140,0.3)";
        ctx.fillRect(px - 1.2, 9 + drop + 0.2, 0.5, 2);
      } else if (kind === 1) {
        disc(ctx, px, 9 + drop + 1.6, 1.7);
        ctx.fillStyle = "#1a120c";
        disc(ctx, px, 9 + drop + 1.6, 0.9);
      } else {
        ctx.fillRect(px - 0.2, 9 + drop, 0.4, 3.4);
        disc(ctx, px, 9 + drop + 3.6, 0.9);
      }
    }
    // Steam, rising and fading.
    for (let k = 0; k < 14; k++) {
      const p = (clock / (3200 + (k % 5) * 400) + rnd(k, 7)) % 1;
      const sx = cam + ((((rnd(k, 8) * 120 - cam * 0.5) % 120) + 120) % 120) - 12 - p * 4;
      ctx.fillStyle = `rgba(235,235,230,${0.16 * (1 - p)})`;
      disc(ctx, sx, FH - 8 - p * 34, 2 + p * 4);
    }
  }

  /* ------------------------------------------------------------ the track */

  // The shelves and stair flights of every line in view: a wooden fill down to the bottom, a
  // pale rim, plank lines and brackets on the shelves, step noses and risers on the flights, and
  // a ragged lip at each line's end over the dark gap.
  function paintTrack(ctx, R, lo, hi, clock) {
    for (const pts of R.track) {
      if (pts[pts.length - 1][0] < lo || pts[0][0] > hi) continue;
      const top = pts.map(([x, y]) => [x, FH - y]);
      ctx.fillStyle = vgrad(ctx, FH - 40, FH, [[0, "#6a4a30"], [0.6, "#3a281c"], [1, "#150e0a"]]);
      poly(ctx, [...top, [pts.at(-1)[0], FH + 1], [pts[0][0], FH + 1]]);
      ctx.fill();
      for (let i = 0; i + 1 < pts.length; i++) {
        const [xa, ya] = pts[i];
        const [xb, yb] = pts[i + 1];
        if (xb < lo || xa > hi) continue;
        const slope = (yb - ya) / (xb - xa);
        if (slope < -0.08) {
          // Stairs: a nose every 2.2 across with a dark riser under it.
          for (let x = xa; x < xb; x += 2.2) {
            const y = FH - yOn(pts, x);
            ctx.fillStyle = "#c9a878";
            ctx.fillRect(x, y, 2.2, 0.35);
            ctx.fillStyle = "rgba(10,6,4,0.55)";
            poly(ctx, [[x, y + 0.35], [x + 2.2, y + 0.35 + 0.37 * 2.2 * 0.5], [x, y + 0.35 + 0.9]]);
            ctx.fill();
          }
        } else {
          // A shelf: a pale board, plank joins, brackets underneath, and a jar here and there.
          ctx.fillStyle = "#a8825a";
          poly(ctx, [[xa, FH - ya], [xb, FH - yb], [xb, FH - yb + 0.9], [xa, FH - ya + 0.9]]);
          ctx.fill();
          ctx.fillStyle = "#e0c08c";
          poly(ctx, [[xa, FH - ya], [xb, FH - yb], [xb, FH - yb + 0.25], [xa, FH - ya + 0.25]]);
          ctx.fill();
          ctx.strokeStyle = "rgba(30,18,10,0.5)";
          ctx.lineWidth = 0.1;
          for (let x = Math.ceil(xa / 9) * 9; x < xb; x += 9) seg(ctx, x, FH - yOn(pts, x), x, FH - yOn(pts, x) + 0.9);
          for (let x = Math.ceil(xa / 14) * 14; x < xb; x += 14) {
            const y = FH - yOn(pts, x);
            ctx.strokeStyle = "#2a1e16";
            ctx.lineWidth = 0.3;
            seg(ctx, x, y + 0.9, x - 1.6, y + 3.4);
          }
        }
      }
      // The ragged lip at the end of the line, over the gap.
      const [ex, ey] = pts[pts.length - 1];
      ctx.fillStyle = "#2a1e16";
      poly(ctx, [[ex, FH - ey], [ex + 0.5, FH - ey + 1.6], [ex - 0.4, FH - ey + 2.6], [ex, FH - ey + 4]]);
      ctx.fill();
    }
    // The grease: a sheen on the quick stretches, with a glint that slides along.
    for (const [a, b] of R.grease) {
      if (b < lo || a > hi) continue;
      for (let x = Math.max(a, lo); x < Math.min(b, hi); x += 1) {
        const y = FH - (heightAt(R, x) ?? 10);
        ctx.fillStyle = "rgba(255,226,120,0.5)";
        ctx.fillRect(x, y - 0.05, 1.05, 0.38);
      }
      const gx = a + (((clock / 14) % (b - a + 12)) - 6);
      if (gx > a && gx < b) {
        ctx.fillStyle = "rgba(255,255,230,0.8)";
        ctx.fillRect(gx, FH - (heightAt(R, gx) ?? 10) - 0.05, 3, 0.4);
      }
    }
  }

  /* ------------------------------------------------------------ the things */

  // A service bell on a post: red until passed, then green.
  function checkpoint(ctx, v, x, base, on, i) {
    ctx.strokeStyle = "#2a1e16";
    ctx.lineWidth = 0.35;
    seg(ctx, x, base + 0.2, x, base - 4.4);
    ctx.fillStyle = on ? "#bff0c8" : SILVER;
    ctx.beginPath();
    ctx.arc(x, base - 4.4, 1.5, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SILVER_D;
    ctx.fillRect(x - 1.8, base - 4.5, 3.6, 0.3);
    disc(ctx, x, base - 6, 0.3);
    const pulse = on ? 1 : 0.7 + 0.3 * Math.sin(v.clock / 160 + i);
    glow(ctx, x, base - 5, 3.6, on ? "90,240,130" : "255,70,50", 0.7 * pulse);
  }

  // A rolling pot: a copper stockpot on its side with a handle, wobbling; or a heap of dropped cutlery.
  function pot(ctx, v, x, base, kind, i) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ellipse(ctx, x, base + 0.1, kind ? 2.8 : 1.9, 0.3);
    ctx.fill();
    if (kind) {
      ctx.lineCap = "round";
      for (let k = 0; k < 7; k++) {
        const a = -0.5 + k * 0.17 + (rnd(i, k) - 0.5) * 0.3;
        ctx.strokeStyle = k % 2 ? SILVER : SILVER_D;
        ctx.lineWidth = 0.22;
        const bx = x - 2 + k * 0.65;
        seg(ctx, bx, base, bx + Math.sin(a) * 2.2, base - 1.2 - Math.abs(Math.cos(a)) * 0.5);
        ctx.fillStyle = SILVER;
        disc(ctx, bx + Math.sin(a) * 2.2, base - 1.4, 0.3);
      }
      ctx.lineCap = "butt";
      return;
    }
    ctx.save();
    ctx.translate(x, base - 1.4);
    ctx.rotate(Math.sin(v.clock / 140 + i) * 0.12);
    ctx.fillStyle = COPPER;
    ctx.fillRect(-1.4, -1.4, 2.8, 2.8);
    ctx.fillStyle = COPPER_D;
    ctx.fillRect(-1.4, 0.7, 2.8, 0.7);
    ctx.fillStyle = "rgba(255,220,170,0.55)";
    ctx.fillRect(-1.1, -1.2, 0.5, 2.2);
    ctx.fillStyle = "#1a120c";
    ellipse(ctx, 1.4, 0, 0.3, 1.2);
    ctx.fill();
    ctx.strokeStyle = "#2a1e16";
    ctx.lineWidth = 0.28;
    seg(ctx, -1.4, -0.4, -2.6, -0.8);
    ctx.restore();
  }

  // A silver dome (a cloche) on its plate, a handle ball on top, a shine; gone once run through.
  function dome(ctx, v, x, y, i) {
    const bob = Math.sin(v.clock / 300 + i * 1.7) * 0.25;
    ctx.save();
    ctx.translate(x, y + bob);
    glow(ctx, 0, -1.4, 3.2, "230,240,255", 0.45);
    ctx.fillStyle = SILVER_D;
    ellipse(ctx, 0, -0.15, 1.9, 0.3);
    ctx.fill();
    ctx.fillStyle = vgrad(ctx, -2.4, 0, [[0, "#ffffff"], [0.5, SILVER], [1, SILVER_D]]);
    ctx.beginPath();
    ctx.moveTo(-1.6, -0.2);
    ctx.arc(0, -0.2, 1.6, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = SILVER;
    disc(ctx, 0, -2.0, 0.28);
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ellipse(ctx, -0.6, -1.1, 0.3, 0.55, -0.5);
    ctx.fill();
    ctx.restore();
  }

  // A flying plate with a dessert (a little cake and a cherry), turning end over end a little.
  function plate(ctx, v, x, y, i) {
    const t = v.clock / 160 + i * 2.1;
    const bob = Math.sin(v.clock / 260 + i) * 0.35;
    ctx.save();
    ctx.translate(x, y + bob);
    glow(ctx, 0, 0, 3.6, "255,200,220", 0.4);
    ctx.rotate(Math.sin(t) * 0.35);
    ctx.fillStyle = CHINA;
    ellipse(ctx, 0, 0.5, 1.7, 0.4);
    ctx.fill();
    ctx.strokeStyle = "#5a7ac8";
    ctx.lineWidth = 0.1;
    ellipse(ctx, 0, 0.5, 1.3, 0.28);
    ctx.stroke();
    ctx.fillStyle = "#8a5a3a";
    ctx.fillRect(-0.7, -0.5, 1.4, 0.9);
    ctx.fillStyle = "#ffd0e0";
    ctx.fillRect(-0.7, -0.75, 1.4, 0.35);
    ctx.fillStyle = "#d4162e";
    disc(ctx, 0, -1.05, 0.34);
    ctx.restore();
  }

  // A spectral cook: a pale, see-through chef with a tall hat and a dark glowing eye, a plate in his raised hand while he winds up, flung forward after.
  function cook(ctx, v, x, base, o, i) {
    if (o.state === "down" || o.state === "spent") return;
    const clock = v.clock;
    if (o.state === "broken") return;
    const wind = o.state === "up" ? clamp(1 - o.t / 700, 0, 1) : 1;
    const rise = o.state === "up" ? Math.min(1, (700 - o.t) / 160) : 1;
    ctx.save();
    ctx.translate(x, base + (1 - rise) * 4);
    ctx.globalAlpha = 0.7 + 0.15 * Math.sin(clock / 180 + i);
    glow(ctx, 0, -3, 5, "170,220,255", 0.4);
    ctx.fillStyle = "#cfe3f0";
    // The body: an apron over a rounded coat.
    poly(ctx, [[-1.6, 0], [-1.3, -3.4], [1.3, -3.4], [1.6, 0]]);
    ctx.fill();
    ctx.fillStyle = "#f4f8fc";
    ctx.fillRect(-1, -2.6, 2, 2.6);
    ctx.fillStyle = "#cfe3f0";
    disc(ctx, 0, -4.1, 1.05);
    // The hat.
    ctx.fillStyle = "#f4f8fc";
    ctx.fillRect(-0.9, -5.3, 1.8, 0.7);
    disc(ctx, -0.6, -5.7, 0.8);
    disc(ctx, 0.6, -5.7, 0.8);
    disc(ctx, 0, -6.1, 0.9);
    // The eyes and a hungry mouth.
    ctx.fillStyle = "#101820";
    disc(ctx, -0.35, -4.2, 0.2);
    disc(ctx, 0.35, -4.2, 0.2);
    ctx.fillRect(-0.45, -3.7, 0.9, 0.18);
    // The arm: up with a plate while winding, then out toward the tray.
    ctx.strokeStyle = "#cfe3f0";
    ctx.lineWidth = 0.5;
    ctx.lineCap = "round";
    const ax = o.state === "toss" ? -2.8 : -1.6 - wind * 0.4;
    const ay = o.state === "toss" ? -3.1 : -3 - wind * 2.2;
    seg(ctx, -1.2, -3, ax, ay);
    ctx.lineCap = "butt";
    if (o.state === "up") {
      ctx.fillStyle = CHINA;
      ellipse(ctx, ax, ay - 0.3, 1.3, 0.3);
      ctx.fill();
    }
    ctx.restore();
  }

  // A dish in flight, spinning, toward the tray.
  function dish(ctx, v, dd, i) {
    ctx.save();
    ctx.translate(dd.x, worldY(dd.y) - 0.7);
    glow(ctx, 0, 0, 2.6, "255,235,200", 0.35);
    ctx.fillStyle = CHINA;
    ellipse(ctx, 0, 0, 1.1, 0.25 + 0.5 * Math.abs(Math.sin(v.clock / 70 + i)));
    ctx.fill();
    ctx.strokeStyle = "#5a7ac8";
    ctx.lineWidth = 0.08;
    ellipse(ctx, 0, 0, 0.8, 0.15 + 0.35 * Math.abs(Math.sin(v.clock / 70 + i)));
    ctx.stroke();
    ctx.restore();
  }

  // The dining table's banner over the door: LAST ORDERS, lit.
  function banner(ctx, v, x) {
    ctx.strokeStyle = "#2a1e16";
    ctx.lineWidth = 0.4;
    seg(ctx, x - 14, FH - 30, x + 20, FH - 30);
    ctx.fillStyle = "#7a1426";
    poly(ctx, [[x - 12, FH - 30], [x + 18, FH - 30], [x + 18, FH - 23], [x + 3, FH - 21], [x - 12, FH - 23]]);
    ctx.fill();
    label(ctx, "LAST ORDERS", x + 3, FH - 25.6, 3, "#ffd98a", "center");
  }

  /* ---------------------------------------------------------- the world */

  function moving(ctx, v, cam) {
    const R = ride(v);
    const c = state(v);
    if (!R || !c) return;
    FH = v.g.FIELD_H;
    const clock = v.clock;
    cam = Math.round(cam * 8) / 8;
    distance(ctx, cam, clock);
    const lo = cam - 8;
    const hi = cam + FW + 8;
    paintTrack(ctx, R, lo - 6, hi + 6, clock);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) checkpoint(ctx, v, x, baseOf(R, x), i <= c.check, i);
    });
    if (R.finish > lo - 24 && R.finish < hi) banner(ctx, v, R.finish + 28);
    // The shadow of a ham or pans on the shelf beneath it.
    for (const [x0, x1, , kind] of R.lows) {
      if (x1 < lo || x0 > hi) continue;
      ctx.fillStyle = `rgba(4,2,2,${kind ? 0.3 : 0.4})`;
      ctx.fillRect(x0 - 0.5, baseOf(R, x0) - 0.1, x1 - x0 + 1, 0.5);
    }
    R.pots.forEach(([x, line, kind], i) => {
      if (x > lo && x < hi) pot(ctx, v, x, baseOf(R, x, line), kind, i);
    });
    R.cooks.forEach(([x, line], i) => {
      const o = c.cooks[i];
      if (x > lo && x < hi) cook(ctx, v, x, baseOf(R, x, line), o, i);
      if (o.dish) dish(ctx, v, o.dish, i);
    });
    R.domes.forEach(([x, line, lift], i) => {
      if (x > lo && x < hi && !c.domes[i]) dome(ctx, v, x, baseOf(R, x, line) - lift, i);
    });
    R.plates.forEach(([x, line, lift], i) => {
      if (x > lo && x < hi && !c.plates[i]) plate(ctx, v, x, baseOf(R, x, line) - lift - 1.4, i);
    });
    // The dining table, over the sky (the still layers' was painted under it).
    for (const [a, b, top] of v.spec.ground) if (a >= R.finish - 1 && b > lo && a < hi) ground(ctx, v, LOOKS.tray, a, b, top);
  }

  /* ----------------------------------------------------- the tray, in front */

  // The big silver tray, side on: a shallow oval with a raised rim, two handles, a shine and a dent;
  // clattering on the stairs, scattering crumbs. Planny is drawn by the game over it.
  function tray(ctx, v, R, c) {
    const { round } = v;
    const you = round.you;
    const clock = v.clock;
    const done = c.done;
    const x = done && c.restX !== undefined ? c.restX : you.x;
    const y = done ? (v.spec.ground.find(([a, b]) => x >= a && x <= b) || [0, 0, 10])[2] : you.y;
    let pitch = 0;
    if (!done) pitch = c.line >= 0 ? Math.atan2((heightAt(R, x + 3) ?? y) - (heightAt(R, x - 3) ?? y), 6) * 0.95 : clamp(you.vy / Math.max(14, c.v), -1, 1) * 0.5;
    const shake = !done && c.line >= 0 ? Math.sin(clock / 29) * 0.04 * (c.v / 44) : 0;
    ctx.save();
    ctx.translate(x, FH - y + shake);
    ctx.rotate(-pitch);
    // Sparks and crumbs off the rim, longer the faster it goes.
    if (!done && c.line >= 0) {
      for (let k = 0; k < 9; k++) {
        const p = (clock / (300 + (k % 4) * 60) + k * 0.13) % 1;
        ctx.fillStyle = `rgba(255,230,160,${(1 - p) * 0.8})`;
        disc(ctx, -3.4 - p * (2.5 + (c.v / 44) * 3) * (0.6 + rnd(k, 1)), -0.1 - p * (0.8 + rnd(k, 2) * 1.6), 0.12 + (1 - p) * 0.16);
      }
    }
    ctx.scale(1.12, 1.3);
    ctx.fillStyle = "rgba(10,6,4,0.35)";
    ellipse(ctx, 0, 0.6, 3.9, 0.25);
    ctx.fill();
    // The dish of the tray: a shallow silver bowl, a rim, a bright top.
    ctx.fillStyle = vgrad(ctx, -0.6, 0.6, [[0, "#ffffff"], [0.4, SILVER], [1, SILVER_D]]);
    ctx.beginPath();
    ctx.moveTo(-3.9, -0.3);
    ctx.quadraticCurveTo(-3.6, 0.5, -2.4, 0.5);
    ctx.lineTo(2.4, 0.5);
    ctx.quadraticCurveTo(3.6, 0.5, 3.9, -0.3);
    ctx.lineTo(3.3, -0.3);
    ctx.lineTo(-3.3, -0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7a8498";
    ctx.lineWidth = 0.1;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-3.6, -0.34, 7.2, 0.14);
    // The handles at each end, and a few dents.
    ctx.strokeStyle = SILVER_D;
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(-3.95, -0.1, 0.35, Math.PI * 1.5, Math.PI * 0.5, true);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(3.95, -0.1, 0.35, Math.PI * 1.5, Math.PI * 0.5, false);
    ctx.stroke();
    ctx.fillStyle = "rgba(110,120,140,0.5)";
    ellipse(ctx, 1.6, 0.1, 0.35, 0.12);
    ctx.fill();
    // A landing's puff of flour.
    const fx = v.fx;
    const land = fx && fx.trayLand !== undefined ? fx.clock - fx.trayLand.t0 : 1e9;
    if (land < 380) {
      for (let k = 0; k < 8; k++) {
        const p = land / 380;
        ctx.fillStyle = `rgba(250,246,236,${(1 - p) * 0.8})`;
        disc(ctx, (k - 3.5) * 0.9 * (0.5 + p * 1.4), -0.3 - p * (1 + rnd(k, 4) * 1.6) * (fx.trayLand.big ? 1.6 : 1), 0.3 + p * 0.3);
      }
    }
    ctx.restore();
  }

  // Hams on hooks, or a rack of copper pans, hanging from the ceiling over the track.
  function low(ctx, v, x0, x1, y, kind, i) {
    const clock = v.clock;
    const under = worldY(y);
    const xm = (x0 + x1) / 2;
    if (kind === 0) {
      // A rail with two hams swinging a little on ropes.
      ctx.strokeStyle = "#2a1e16";
      ctx.lineWidth = 0.4;
      seg(ctx, x0 - 1, 1.5, x1 + 1, 1.5);
      for (const [h, px] of [[0, x0 + 1.8], [1, x1 - 1.8]]) {
        const sw = Math.sin(clock / 380 + i * 1.3 + h * 1.9) * 0.5;
        const len = under - 3.4 - 1.5;
        ctx.strokeStyle = "#6a5030";
        ctx.lineWidth = 0.16;
        seg(ctx, px, 1.5, px + sw, 1.5 + len);
        ctx.save();
        ctx.translate(px + sw, 1.5 + len);
        ctx.fillStyle = "#b8545a";
        ellipse(ctx, 0, 1.7, 1.5, 1.9);
        ctx.fill();
        ctx.fillStyle = "#d98a8a";
        ellipse(ctx, -0.4, 1.2, 0.5, 0.9);
        ctx.fill();
        ctx.fillStyle = "#e8dcc0";
        ctx.fillRect(-0.2, -0.4, 0.4, 0.9);
        ctx.restore();
      }
    } else {
      // A rack with copper pans on ropes, their bases about the underside.
      ctx.strokeStyle = "#2a1e16";
      ctx.lineWidth = 0.3;
      seg(ctx, x0 - 1, 1.5, x0 - 1, under - 3.6);
      seg(ctx, x1 + 1, 1.5, x1 + 1, under - 3.6);
      ctx.lineWidth = 0.45;
      seg(ctx, x0 - 1.4, under - 3.6, x1 + 1.4, under - 3.6);
      const n = 4;
      for (let k = 0; k < n; k++) {
        const px = x0 + 0.6 + (k * (x1 - x0 - 1.2)) / (n - 1);
        const sw = Math.sin(clock / 420 + i + k * 1.4) * 0.15;
        ctx.strokeStyle = "#6a5030";
        ctx.lineWidth = 0.14;
        seg(ctx, px, under - 3.6, px + sw, under - 2.8);
        ctx.fillStyle = COPPER;
        ctx.beginPath();
        ctx.arc(px + sw, under - 1.6, 1.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#1a120c";
        disc(ctx, px + sw, under - 1.6, 0.8);
        ctx.fillStyle = COPPER_D;
        ctx.fillRect(px + sw - 0.2, under - 0.4, 0.4, 0.4);
      }
    }
    ctx.globalAlpha = 0.4 + 0.15 * Math.sin(clock / 400 + i);
    glow(ctx, xm, under + 0.2, 4, "255,200,130", 0.4);
    ctx.globalAlpha = 1;
  }

  // A see-through glyph over an obstacle: a pair of chevrons (a ring for a cook) and, for the first few, the word.
  function glyph(ctx, v, t) {
    const up = t.answer === "JUMP";
    const col = ANSWER_COLORS[t.answer];
    const pulse = 0.85 + 0.15 * Math.sin(v.clock / 260 + t.lead);
    const cy = Math.min(FH - 7, FH - t.up) + Math.sin(v.clock / 260 + t.lead) * 0.35;
    ctx.save();
    ctx.globalAlpha = t.alpha * pulse * TELEGRAPH_ALPHA;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (t.answer === "SHOOT") {
      for (const [w, c] of [[1.2, "rgba(8,4,4,0.8)"], [0.5, col]]) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(t.x, cy - 2.2, 1.4, 0, TAU);
        ctx.stroke();
        seg(ctx, t.x - 2.2, cy - 2.2, t.x + 2.2, cy - 2.2);
        seg(ctx, t.x, cy - 4.4, t.x, cy);
      }
    } else {
      const dir = up ? -1 : 1;
      const ay = cy + (up ? -2.6 : 2.6);
      for (const [w, c] of [[1.3, "rgba(8,4,4,0.8)"], [0.6, col]]) {
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
    }
    if (t.words) label(ctx, t.answer, t.x, cy + (up || t.answer === "SHOOT" ? 1.2 : -1.2), 2.3, col, "center");
    ctx.restore();
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
    tray(ctx, v, R, c);
    R.lows.forEach(([x0, x1, y, kind], i) => {
      if (x1 >= lo && x0 <= hi) low(ctx, v, x0, x1, y, kind, i);
    });
    // Clouds of flour drifting over the route, here and there: they dim the view, never hide a glyph.
    for (let n = Math.max(0, Math.floor((cam - 40) / 230)); n <= Math.floor((cam + FW + 40) / 230); n++) {
      const bx = 140 + n * 230;
      for (let k = 0; k < 5; k++) {
        const px = bx + (rnd(n, k) - 0.3) * 26 + Math.sin(v.clock / 900 + k + n) * 1.5;
        if (px < lo - 10 || px > hi + 10) continue;
        const py = FH - (heightAt(R, px) ?? 20) - 2 - rnd(n, k + 9) * 5;
        ctx.fillStyle = `rgba(246,240,226,${0.1 + 0.05 * rnd(n, k + 3)})`;
        disc(ctx, px, py, 3 + rnd(n, k + 5) * 4);
      }
    }
    if (!c.done) for (const t of telegraphs(R, round.you.x)) glyph(ctx, v, t);
    // Splinters of china and tin from a broken dish or a cook, tumbling.
    const bits = v.fx && v.fx.trayBits;
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
    // The course count, a small plate of dots under the hearts' pill: one per course, a gold one for each eaten.
    if (!c.done && round.phase === "play") {
      const goal = 7;
      for (let k = 0; k < goal; k++) {
        const x = cam + FW / 2 - (goal * 2.2) / 2 + k * 2.2 + 1.1;
        ctx.fillStyle = k < c.served ? "#ffd24a" : "rgba(220,220,230,0.28)";
        disc(ctx, x, 8.6, 0.8);
        ctx.strokeStyle = "rgba(20,12,8,0.6)";
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        ctx.arc(x, 8.6, 0.8, 0, TAU);
        ctx.stroke();
      }
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
    add(you.x + 2, you.y + 2.4, 10, 0.6);
    R.checks.forEach((x, i) => {
      if (x > lo && x < hi) add(x, (heightAt(R, x) ?? 10) + 5, i <= c.check ? 8 : 7, i <= c.check ? 0.6 : 0.5);
    });
    R.domes.forEach(([x, line, lift], i) => {
      if (x > lo && x < hi && !c.domes[i]) add(x, (heightAt(R, x) ?? 10) + lift + 1.5, 4, 0.3);
    });
    R.plates.forEach(([x, line, lift], i) => {
      if (x > lo && x < hi && !c.plates[i]) add(x, (heightAt(R, x) ?? 10) + lift + 1.4, 4, 0.3);
    });
    R.cooks.forEach(([x], i) => {
      if (x > lo && x < hi && (c.cooks[i].state === "up" || c.cooks[i].state === "toss")) add(x, (heightAt(R, x) ?? 10) + 3, 5, 0.3);
    });
    R.lows.forEach(([x0, x1, y], i) => {
      if (x1 > lo && x0 < hi) add((x0 + x1) / 2, y + 1, 6, 0.3 * (0.85 + 0.15 * Math.sin(clock / 200 + i)));
    });
    if (R.finish > lo - 24 && R.finish < hi) add(R.finish + 28, 22, 16, 0.6);
    if (v.fx && v.fx.trayLand && v.fx.clock - v.fx.trayLand.t0 < 260) add(you.x, you.y + 1, 6, 0.4);
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }
  // China and tin flying out of a spot.
  function splinter(fx, x, y, colors) {
    fx.trayBits = (fx.trayBits || []).filter((b) => fx.clock - b.t0 < 1000);
    for (let k = 0; k < 9; k++) fx.trayBits.push({ x, y, t0: fx.clock, vx: (rnd(k, 1) - 0.5) * 22, vy: 8 + rnd(k, 2) * 14, rot: rnd(k, 3) * TAU, vr: (rnd(k, 4) - 0.5) * 22, w: 0.5 + rnd(k, 5) * 0.9, c: colors[k % colors.length] });
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its
  // sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { shake, flash, burst, float, ring, fx, tone } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    if (e.type === "trayDuck" && !gateOnce(fx, "trayDuckMs", 160)) return true;
    say(tone, voice[0], voice[1], 0.5);
    switch (e.type) {
      case "trayJump":
        burst(e.x, e.y, CHINA, 5, 7, 300);
        break;
      case "trayLand":
        fx.trayLand = { t0: fx.clock, big: Boolean(e.big) };
        burst(e.x, e.y, SILVER, e.big ? 14 : 6, e.big ? 12 : 8, 360);
        if (e.big) shake(200, 0.5);
        break;
      case "trayLaunch":
        burst(e.x, e.y, SILVER, 12, 14, 380);
        float(e.x, e.y + 5, e.last ? "Jump!" : "Whee!", GOLD, 2.2);
        break;
      case "trayCrash":
        shake(320, 1);
        flash("#ffe2b0", 200);
        burst(e.x, e.y + 1, e.what === "pot" || e.what === "pans" ? COPPER : SILVER, 18, 17, 520);
        burst(e.x, e.y + 1, "#f4f1e8", 8, 14, 360);
        break;
      case "trayCheck":
        float(e.x, e.y + 5, "Checkpoint", GOLD, 2.2);
        ring(e.x, e.y + 3, "#7dffa0", 1, 8, 500);
        break;
      case "trayFinish":
        shake(260, 0.7);
        burst(e.x, e.y, CHINA, e.big ? 22 : 14, 13, 560);
        float(e.x, e.y + 5, e.served >= 7 ? "Seven courses!" : "Made it!", GOLD, 2.6);
        break;
      case "trayDome":
        burst(e.x, e.y, SILVER, 10, 10, 420);
        ring(e.x, e.y, "#cfe6ff", 1, 6, 400);
        float(e.x, e.y + 3, `Course ${e.n}`, GOLD, 2);
        break;
      case "trayPlate":
        burst(e.x, e.y, "#ffd0e0", 12, 12, 460);
        splinter(fx, e.x, e.y, [CHINA, "#5a7ac8", "#ffd0e0"]);
        float(e.x, e.y + 3, `Course ${e.n}`, GOLD, 2);
        break;
      case "trayCookUp":
        burst(e.x, e.y + 1, "#cfe3f0", 6, 6, 400);
        break;
      case "trayToss":
        burst(e.x, e.y, CHINA, 4, 6, 260);
        break;
      case "trayCookHit":
        burst(e.x, e.y, "#cfe3f0", 14, 14, 480);
        float(e.x, e.y + 3, `+${e.points}`, GOLD, 2);
        break;
      case "trayDishBreak":
        burst(e.x, e.y, CHINA, 10, 12, 380);
        splinter(fx, e.x, e.y, [CHINA, "#5a7ac8"]);
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
