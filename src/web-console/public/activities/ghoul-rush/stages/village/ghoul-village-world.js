// Plan2Code Web Console - Ghoul Rush's Hollow End Village, the world it is set in: the night sky and the climbing moon, the crooked timber-framed houses of the street and the square (windows with shutters, lit panes, curtains that twitch as you pass, signs, chimneys), the church and its spire, the gallows' beams, the green's ring of far cottages, its old well and the walls at the ends of the Beast's arena, the Crooked Inn (a timber tavern with a hearth, barrels, a bar, hanging lanterns and the moon in its windows), the cobbles, planks and turf of the floors, and the awnings, rooftops, balconies, tables, carts and thatch of the shelves.
//
// ghoul-village-draw.js plugs it in. villageWorld(d) takes ghoul-draw.js's own
// drawing helpers (`d`) and hands back, by hook: `sky` (the sky and the moon,
// drawn every frame under the still layers, so the houses and the walls are
// drawn with the sky left clear behind them; in the inn, the night in each
// window), `backdrop` (the still scenery of a room), `ground`, `shelf`,
// `moving` (what moves in the scenery, over the still layers: curtains, the
// hearths, the lanterns, the moonlight falling in), `front` (the moonlight
// wash over everything at full moon, Wolfsbane's petals round Planny, the
// Beast's rage), `lights` (what the dark lets through: the moon, the lit
// windows, the hearths, the lanterns) and `moonAt`. Drawn in room units, y
// counted down from the field's top. The houses are drawn in a local frame with
// y counted up from the field's floor (a house stands on the bottom).
//
// What it reads off the rules (ghoul-village.js): `round.twist.moon` (0 to 1)
// and `.full`, the room's spawn rows (a shutter ghoul's window is a house's
// window; a hanged man's beam is a gallows), `spec.arena` and `spec.length` (the
// walls the Beast clings to).

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const mix = (a, b, p) => a + (b - a) * p;

const RGB = new Map();
function rgb(hex) {
  let c = RGB.get(hex);
  if (!c) {
    c = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    RGB.set(hex, c);
  }
  return c;
}
// A color `p` of the way from `a` to `b`, and a color at an alpha.
export const mixHex = (a, b, p) => {
  const [r, g, bl] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  const h = (n) => Math.round(n).toString(16).padStart(2, "0");
  return `#${h(mix(r, r2, p))}${h(mix(g, g2, p))}${h(mix(bl, b2, p))}`;
};
export const rgba = (hex, a) => {
  const [r, g, b] = rgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

// A gradient as a fill style, or the first stop's color where the context makes none.
export function gradient(ctx, kind, args, stops) {
  const gr = typeof ctx[kind] === "function" ? ctx[kind](...args) : null;
  if (gr && typeof gr.addColorStop === "function") {
    for (const [at, color] of stops) gr.addColorStop(at, color);
    return gr;
  }
  return stops[Math.floor(stops.length / 2)][1];
}

// Which scene each of the Village's rooms is.
const SCENE = freeze({ street: "street", inn: "inn", square: "square", green: "green" });

/* ------------------------------------------------------------ the moon */

// The moon's colors at progress p: a cold pale one low, a cream one halfway,
// a red-gold one at full.
const MOON_CORE = ["#c9d2ee", "#f3e7bd", "#ffc86a"];
const MOON_HALO = ["#8c9acb", "#e6c98a", "#ff9650"];
const stop3 = (list, p) => (p < 0.5 ? mixHex(list[0], list[1], p * 2) : mixHex(list[1], list[2], (p - 0.5) * 2));
export const moonCore = (p) => stop3(MOON_CORE, clamp(p, 0, 1));
export const moonHalo = (p) => stop3(MOON_HALO, clamp(p, 0, 1));

// The moon's progress as the art shows it: it follows the rules' number, easing
// the small jump when the Beast rages, and snapping when a room starts over.
function shownMoon(v) {
  const tw = v.round.twist;
  const target = tw && typeof tw.moon === "number" ? clamp(tw.moon, 0, 1) : 0;
  const fx = v.fx;
  if (!fx) return target;
  const at = v.clock || 0;
  if (typeof fx.vMoon !== "number" || Math.abs(target - fx.vMoon) > 0.2) fx.vMoon = target;
  else fx.vMoon += (target - fx.vMoon) * clamp((at - (fx.vMoonAt || at)) / 500, 0, 1);
  fx.vMoonAt = at;
  return fx.vMoon;
}

// Where the moon is on the screen (field units from the left edge) at p: out of
// the roofs low on the left, up and across, higher and bigger and nearer full.
export function moonSpot(g, p, scene) {
  const big = scene === "green" ? 1.7 : 1;
  return { x: g.FIELD_W * (0.12 + 0.6 * p), y: g.FIELD_H * (0.74 - 0.52 * Math.sin((p * Math.PI) / 2)), r: (3.4 + 2.2 * p) * big };
}

/* ------------------------------------------------------------- layout */

const CELL = 24;
const PLASTER = freeze(["#4d4559", "#564a5c", "#434c5a", "#5b5148", "#47513f", "#554356", "#4a4f5c"]);
const SHUTTER = freeze(["#4b5a3a", "#6a3c30", "#3c4a6a", "#7a6232"]);
const AWNING = freeze([["#8a2f3a", "#d9cdb2"], ["#b3862e", "#d9cdb2"], ["#2f6a52", "#d9cdb2"], ["#3b4f8a", "#d9cdb2"]]);
const TIMBER = "#1d1510";
const WIN_W = 3.2;
export const GHOUL_WIN = freeze({ w: 3.8, h: 5.2 });

const layouts = new WeakMap();

// The houses along a street or square, the same for every chunk drawn: cells of
// CELL units, a house in each (a few cells of the square stay clear), and a
// house standing right on every shutter ghoul's window, straight, so the
// ghoul's window is the house's.
function layoutOf(spec, hash) {
  if (layouts.has(spec)) return layouts.get(spec);
  const scene = SCENE[spec.id];
  const houses = [];
  const ring = scene === "green";
  const cell = ring ? 20 : CELL;
  for (let n = -1; n * cell < spec.length + cell; n++) {
    const s = hash(n, 11);
    if (scene === "square" && s % 5 === 0) continue;
    if (ring && s % 4 === 0) continue;
    const w = (ring ? 17 : 19) + (s % 4);
    const x = n * cell + 1 + (hash(n, 12) % 3);
    houses.push(makeHouse(hash, n, x, w, s, ring ? 0.66 : 1, ring));
  }
  for (const sp of spec.spawns) {
    if (sp[0] !== "shutter") continue;
    const n = 1000 + Math.round(sp[1]);
    const s = hash(n, 11);
    const h = makeHouse(hash, n, sp[1] - 10, 20, s, 1, false, { x: sp[1], y: sp[2] });
    houses.push(h);
  }
  layouts.set(spec, houses);
  return houses;
}

function makeHouse(hash, n, x, w, s, sc, far, ghoul = null) {
  const E = Math.max(26 + (s % 7), ghoul ? ghoul.y + 9.4 : 0);
  const h = { n, x, w, s, sc, far, E, rh: 5.5 + (s % 4), cx: x + w / 2, tilt: ghoul ? 0 : ((hash(n, 13) % 7) - 3) * 0.006, plaster: PLASTER[s % PLASTER.length], shut: SHUTTER[(s >> 2) % SHUTTER.length], roof: s % 5 === 0 ? "hip" : "gable", apex: ((hash(n, 14) % 5) - 2) * 0.6, chimney: s % 3 === 0, sign: s % 9 === 1, wins: [] };
  const floors = [[13, 4.6], [22.6, 4.2]];
  floors.forEach(([yb, wh], f) => {
    if (yb + wh + 1.2 > E) return;
    const count = w >= 21 ? 3 : 2;
    const span = w / count;
    for (let i = 0; i < count; i++) {
      const q = hash(s + f * 7 + i, 21);
      const lx = -w / 2 + span * (i + 0.5);
      if (ghoul && Math.abs(x + w / 2 + lx - ghoul.x) < 4.6 + WIN_W / 2 && Math.abs(yb - ghoul.y) < 7) continue;
      if (q % 7 === 0) continue;
      const lit = q % 3 === 0;
      h.wins.push({ lx, y: yb, w: WIN_W, h: wh, lit, curtain: lit ? q % 2 === 0 : q % 5 === 0, shutters: ["open", "open", "closed", "none"][q % 4], figure: lit && q % 9 === 0, q });
    }
  });
  if (ghoul) h.wins.push({ lx: ghoul.x - (x + w / 2), y: ghoul.y, w: GHOUL_WIN.w, h: GHOUL_WIN.h, ghoul: true, q: s });
  for (const wn of h.wins) wn.wx = h.cx + wn.lx + h.tilt * (wn.y + wn.h / 2);
  return h;
}

// Every window in view of x0 to x1 that is lit, for the dark's holes and the curtains.
const inRange = (list, x0, x1, pad = 12) => list.filter((h) => h.cx > x0 - pad && h.cx < x1 + pad);

/* --------------------------------------------------------------- world */

export function villageWorld(d) {
  const { ellipse, circle, roundRect, line, hash } = d;
  // Fill a rectangle in a house's local frame (y up from the floor of the field).
  const R = (ctx, x, yb, w, h) => ctx.fillRect(x, yb, w, h);
  const poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };

  /* ------------------------------------------------------------ the sky */

  function skyColors(p) {
    return [mixHex("#04050d", "#0c0a17", p), mixHex("#0d1022", "#1a1426", p), mixHex("#1b2139", "#4a3038", p * p)];
  }

  // The moon, lit like a waxing moon: dark side faint, lit side cream to red-gold,
  // maria in it, a halo, and a red-gold rim near full.
  function moonDisc(ctx, cx, cy, r, p, clock) {
    const halo = moonHalo(p);
    const core = moonCore(p);
    const glow = gradient(ctx, "createRadialGradient", [cx, cy, r * 0.8, cx, cy, r * (4.6 + p * 2)], [[0, rgba(halo, 0.2 + 0.3 * p)], [0.35, rgba(halo, 0.08 + 0.1 * p)], [1, rgba(halo, 0)]]);
    ctx.fillStyle = glow;
    ctx.fillRect(cx - r * 7, cy - r * 7, r * 14, r * 14);
    ctx.fillStyle = "rgba(24, 30, 48, 0.85)";
    circle(ctx, cx, cy, r);
    ctx.fill();
    const k = 0.3 + 0.7 * Math.pow(p, 0.9);
    ctx.save();
    ctx.beginPath();
    if (k > 0.985) ctx.arc(cx, cy, r, 0, TAU);
    else {
      const t = r * (1 - 2 * k);
      ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, false);
      if (typeof ctx.ellipse === "function") ctx.ellipse(cx, cy, Math.max(0.01, Math.abs(t)), r, 0, Math.PI / 2, t > 0 ? -Math.PI / 2 : (Math.PI * 3) / 2, t > 0);
      ctx.closePath();
    }
    ctx.fillStyle = core;
    ctx.fill();
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.fillStyle = rgba(mixHex("#7a7f98", "#b0703a", p), 0.34);
    for (const [mx, my, rx, ry] of [[-0.32, -0.22, 0.34, 0.26], [0.18, -0.38, 0.22, 0.2], [0.1, 0.14, 0.4, 0.3], [-0.42, 0.34, 0.2, 0.16], [0.46, 0.3, 0.18, 0.18]]) {
      ellipse(ctx, cx + mx * r, cy + my * r, rx * r, ry * r);
      ctx.fill();
    }
    ctx.fillStyle = rgba("#ffffff", 0.18);
    circle(ctx, cx - r * 0.18, cy - r * 0.28, r * 0.12);
    ctx.fill();
    ctx.restore();
    if (p > 0.55) {
      ctx.strokeStyle = rgba("#ff9a50", 0.5 * (p - 0.55) * 2.2);
      ctx.lineWidth = r * 0.07;
      circle(ctx, cx, cy, r * 1.01);
      ctx.stroke();
    }
    if (p > 0.92) {
      // Bats across the full moon.
      ctx.fillStyle = "#07060c";
      for (let b = 0; b < 3; b++) {
        const q = ((clock || 0) / (5200 + b * 900) + b * 0.31) % 1;
        const bx = cx - r * 3 + q * r * 6.4;
        const by = cy - r * 0.9 + Math.sin(q * 9 + b) * r * 0.5 + b * r * 0.35;
        const fl = Math.sin((clock || 0) / 70 + b * 2) * 0.5;
        poly(ctx, [[bx - 0.9, by - fl], [bx - 0.3, by - 0.2], [bx, by + 0.15], [bx + 0.3, by - 0.2], [bx + 0.9, by - fl], [bx + 0.35, by + 0.3], [bx, by + 0.2], [bx - 0.35, by + 0.3]]);
        ctx.fill();
      }
    }
  }

  function skyBase(ctx, x, w, H, p) {
    const [top, mid, low] = skyColors(p);
    ctx.fillStyle = gradient(ctx, "createLinearGradient", [0, 0, 0, H], [[0, top], [0.55, mid], [1, low]]);
    ctx.fillRect(x, 0, w, H);
  }

  function stars(ctx, x, W, H, p, clock, skip) {
    ctx.fillStyle = "#e9eeff";
    for (let i = 0; i < 46; i++) {
      const sx = ((hash(i, 3) % 997) / 997) * W;
      const sy = ((hash(i, 5) % 997) / 997) * H * 0.6;
      if (skip && skip(sx, sy)) continue;
      ctx.globalAlpha = (0.35 + (i % 4) * 0.12 + 0.2 * Math.sin(clock / 700 + i * 1.7)) * (1 - 0.6 * p);
      const s = 0.14 + (i % 3) * 0.07;
      ctx.fillRect(x + sx, sy, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // Slow dark clouds crossing the sky: a flat base with puffs on it, a thin lit
  // edge where the moon shines on it.
  function clouds(ctx, x, W, H, p, clock, moon) {
    for (let k = 0; k < 4; k++) {
      const drift = ((clock || 0) / (1500 + k * 450) + k * 41) % (W + 80);
      const cx = x + drift - 40;
      const cy = H * (0.12 + k * 0.1) + (k % 2) * 3;
      const sc = 0.8 + (k % 3) * 0.25;
      ctx.fillStyle = rgba("#0a0b16", 0.46);
      for (const [dx, dy, r] of [[-6.5, 0.2, 1.0], [-5, -0.3, 1.5], [-2.5, -1.1, 2.1], [0, 0.3, 1.6], [1, -1.4, 2.4], [3, 0.2, 1.5], [4.2, -0.8, 1.8], [6.6, -0.1, 1.2], [7.6, 0.3, 0.9]]) {
        circle(ctx, cx + dx * sc, cy + dy * sc, r * sc);
        ctx.fill();
      }
      if (moon) {
        const lit = clamp(1 - Math.hypot(cx - (x + moon.x), cy - moon.y) / 44, 0, 1);
        ctx.strokeStyle = rgba(moonHalo(p), 0.5 * lit);
        ctx.lineWidth = 0.2;
        ctx.beginPath();
        ctx.ellipse?.(cx + sc, cy - 0.6 * sc, 6 * sc, 1.7 * sc, 0, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    }
  }

  // The night: gradient, stars, the moon, clouds. In the inn, the same night in
  // each window (and the moon climbing inside it).
  function sky(ctx, v, cam) {
    const scene = SCENE[v.spec.id];
    if (!scene) return;
    const { g } = v;
    const p = shownMoon(v);
    const clock = v.clock || 0;
    if (scene === "inn") {
      for (const w of innWindows(v.spec, cam - 6, cam + g.FIELD_W + 6)) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(w.x, w.top, w.w, w.h);
        if (typeof ctx.clip === "function") ctx.clip();
        skyBase(ctx, w.x, w.w, g.FIELD_H, p);
        ctx.fillStyle = "#e9eeff";
        for (let i = 0; i < 6; i++) ctx.fillRect(w.x + ((hash(i + w.n, 4) % 90) / 100) * w.w, w.top + ((hash(i, w.n) % 60) / 100) * w.h, 0.16, 0.16);
        const r = Math.min(w.w * 0.3, 2.2 + p * 0.7);
        moonDisc(ctx, w.x + w.w * 0.56, w.top + w.h - r - 0.6 - p * (w.h - r * 2 - 2.2), r, p, clock);
        ctx.restore();
      }
      return;
    }
    skyBase(ctx, cam - 1, g.FIELD_W + 2, g.FIELD_H, p);
    const m = moonSpot(g, p, scene);
    stars(ctx, cam, g.FIELD_W, g.FIELD_H, p, clock, (sx, sy) => Math.hypot(sx - m.x, sy - m.y) < m.r * 1.6);
    // The horizon warms toward the moon as it climbs.
    const horizon = gradient(ctx, "createRadialGradient", [cam + m.x, g.FIELD_H, 2, cam + m.x, g.FIELD_H, g.FIELD_W * 0.8], [[0, rgba(moonHalo(p), 0.1 + 0.2 * p)], [1, rgba(moonHalo(p), 0)]]);
    ctx.fillStyle = horizon;
    ctx.fillRect(cam, g.FIELD_H * 0.4, g.FIELD_W, g.FIELD_H * 0.6);
    moonDisc(ctx, cam + m.x, m.y, m.r, p, clock);
    clouds(ctx, cam, g.FIELD_W, g.FIELD_H, p, clock, m);
  }

  /* ---------------------------------------------------- houses and roofs */

  // Tile courses over a roof polygon: dark lines every row, offset ticks.
  function tiles(ctx, x0, x1, y0, y1, row, ink) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    let r = 0;
    for (let y = y0 + row; y < y1; y += row, r++) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      for (let x = x0 + (r % 2) * 0.7; x < x1; x += 1.4) {
        ctx.moveTo(x, y - row);
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  // One window of a house (in its local frame): the opening, lit or dark, the
  // frame, mullions, shutters, a sill and flower box. Curtains twitch in `moving`.
  function windowAt(ctx, h, wn, far) {
    const x = wn.lx - wn.w / 2;
    const { y, w, h: hh } = wn;
    ctx.fillStyle = TIMBER;
    R(ctx, x - 0.45, y - 0.45, w + 0.9, hh + 0.9);
    if (wn.ghoul) {
      ctx.fillStyle = "#08060a";
      R(ctx, x, y, w, hh);
      ctx.fillStyle = "#3a2a1c";
      R(ctx, x - 0.9, y + hh + 0.45, w + 1.8, 0.7);
      R(ctx, x - 0.7, y - 1, w + 1.4, 0.7);
      return;
    }
    if (wn.lit) {
      ctx.fillStyle = "#cf7f2e";
      R(ctx, x, y, w, hh);
      ctx.fillStyle = "#ffcf80";
      ctx.globalAlpha = 0.85;
      R(ctx, x + 0.3, y + 0.3, w - 0.6, hh - 0.6);
      ctx.globalAlpha = 1;
      if (wn.figure) {
        // Someone stands at the glass.
        ctx.fillStyle = "#2a1810";
        circle(ctx, x + w * 0.5, y + hh * 0.58, 0.6);
        ctx.fill();
        R(ctx, x + w * 0.5 - 0.95, y, 1.9, hh * 0.42);
      }
    } else {
      ctx.fillStyle = "#0b0a12";
      R(ctx, x, y, w, hh);
      ctx.fillStyle = rgba("#7d86ac", 0.2);
      poly(ctx, [[x + 0.2, y + hh - 0.2], [x + w * 0.55, y + hh - 0.2], [x + 0.2, y + hh * 0.45]]);
      ctx.fill();
    }
    if (!far) {
      ctx.fillStyle = TIMBER;
      R(ctx, x + w / 2 - 0.12, y, 0.24, hh);
      R(ctx, x, y + hh * 0.52, w, 0.22);
    }
    // The sill and, under some, a flower box.
    ctx.fillStyle = "#3a2c22";
    R(ctx, x - 0.5, y - 0.9, w + 1, 0.55);
    if (!far && wn.q % 4 === 1) {
      ctx.fillStyle = "#4a321f";
      R(ctx, x - 0.2, y - 1.6, w + 0.4, 0.8);
      ctx.fillStyle = ["#b0485a", "#c8a24a", "#7a5ac0"][wn.q % 3];
      for (let i = 0; i < 5; i++) {
        circle(ctx, x + 0.3 + i * (w - 0.6) / 4, y - 1.7 + (i % 2) * 0.2, 0.34);
        ctx.fill();
      }
    }
    if (wn.shutters === "open") {
      ctx.fillStyle = h.shut;
      for (const s of [-1, 1]) {
        const sx = s < 0 ? x - 1.55 : x + w + 0.1;
        R(ctx, sx, y - 0.2, 1.45, hh + 0.4);
        if (!far) {
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          for (let k = 1; k < 5; k++) R(ctx, sx, y - 0.2 + (k * (hh + 0.4)) / 5, 1.45, 0.12);
          ctx.fillStyle = h.shut;
        }
      }
    } else if (wn.shutters === "closed") {
      ctx.fillStyle = h.shut;
      R(ctx, x, y, w, hh);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      for (let k = 1; k < 7; k++) R(ctx, x, y + (k * hh) / 7, w, 0.12);
      ctx.fillStyle = TIMBER;
      R(ctx, x + w / 2 - 0.1, y, 0.2, hh);
    }
  }

  // A whole house in its local frame: plaster and timber over a stone foot, a
  // jettied upper floor on corbels, windows, a sign, and a roof with a chimney.
  function house(ctx, h, v) {
    const far = h.far;
    const { w, E, rh } = h;
    const hw = w / 2;
    const dim = far ? 0.5 : 0;
    const col = (c) => (far ? mixHex(c, "#12162a", dim) : c);
    ctx.save();
    ctx.translate(h.cx, v.g.FIELD_H);
    ctx.scale(h.sc, -h.sc);
    ctx.transform(1, 0, h.tilt, 1, 0, 0);
    // The stone foot, first floor, the jetty and its beam.
    ctx.fillStyle = col("#2b2732");
    R(ctx, -hw, 0, w, 12.5);
    ctx.fillStyle = col(h.plaster);
    R(ctx, -hw, 12.5, w, 9.6);
    R(ctx, -hw - 0.9, 22, w + 1.8, E - 22);
    ctx.fillStyle = col(TIMBER);
    R(ctx, -hw - 0.9, 21.4, w + 1.8, 0.7);
    R(ctx, -hw, 12.2, w, 0.5);
    R(ctx, -hw - 0.9, E - 0.5, w + 1.8, 0.5);
    if (!far) {
      // Corbels under the jetty, then the timbers: posts, and a brace in some panels.
      for (let c = -hw + 1.6; c < hw; c += 4.6) {
        poly(ctx, [[c - 0.45, 21.4], [c + 0.45, 21.4], [c + 0.45, 20.3], [c - 0.45, 19.9]]);
        ctx.fill();
      }
      ctx.fillRect(-hw - 0.9, 22, 0.55, E - 22);
      ctx.fillRect(hw + 0.35, 22, 0.55, E - 22);
      const posts = Math.round(w / 4.6);
      for (let i = 0; i <= posts; i++) {
        const px = -hw + (i * w) / posts;
        ctx.fillRect(px - 0.28, 12.5, 0.56, 9.2);
        ctx.fillRect(px - 0.28, 22, 0.56, E - 22);
      }
      ctx.strokeStyle = TIMBER;
      ctx.lineWidth = 0.4;
      for (let i = 0; i < posts; i++) {
        const q = hash(h.s + i, 17);
        const px = -hw + (i * w) / posts;
        const pw = w / posts;
        if (q % 3 === 0) line(ctx, px + 0.3, 12.7, px + pw - 0.3, 21.4);
        else if (q % 3 === 1) line(ctx, px + pw - 0.3, 12.7, px + 0.3, 21.4);
        if (q % 4 === 0) line(ctx, px + 0.3, 22.2, px + pw - 0.3, E - 0.8);
      }
      // Plaster stains and a patched corner.
      ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      for (let i = 0; i < 4; i++) {
        const q = hash(h.s, 30 + i);
        R(ctx, -hw + (q % 17), 13 + (q % 7), 1.6 + (q % 3), 2.2);
      }
    }
    for (const wn of h.wins) windowAt(ctx, h, wn, far);
    // A tavern's sign on an iron arm, a lantern by the door.
    if (!far && h.sign) {
      ctx.strokeStyle = "#101010";
      ctx.lineWidth = 0.28;
      line(ctx, hw, 20.4, hw + 4.2, 20.4);
      line(ctx, hw + 4.2, 20.4, hw + 4.2, 19.4);
      ctx.fillStyle = "#5a3a1c";
      R(ctx, hw + 2.2, 16.2, 3.8, 3);
      ctx.fillStyle = "#e0c070";
      circle(ctx, hw + 4.1, 17.7, 0.9);
      ctx.fill();
      ctx.fillStyle = "#5a3a1c";
      circle(ctx, hw + 4.4, 17.7, 0.78);
      ctx.fill();
    }
    // The roof.
    const ax = h.apex;
    const ink = col("#15111e");
    ctx.fillStyle = col("#272032");
    const eave = hw + 1.4;
    if (h.roof === "gable") {
      poly(ctx, [[-eave, E - 0.2], [ax, E + rh], [eave, E - 0.2]]);
      ctx.fill();
      ctx.save();
      poly(ctx, [[-eave, E - 0.2], [ax, E + rh], [eave, E - 0.2]]);
      if (typeof ctx.clip === "function") ctx.clip();
      tiles(ctx, -eave, eave, E, E + rh, 0.9, rgba("#000000", far ? 0.2 : 0.4));
      ctx.restore();
      ctx.strokeStyle = col("#7a7aa0");
      ctx.globalAlpha = far ? 0.3 : 0.5;
      ctx.lineWidth = 0.22;
      line(ctx, ax, E + rh, eave, E - 0.2);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 0.4;
      line(ctx, -eave, E - 0.2, ax, E + rh);
      // The gable's loft window, a warm lamp in it now and then.
      if (!far && h.s % 4 === 2) {
        ctx.fillStyle = TIMBER;
        circle(ctx, ax, E + rh * 0.38, 1.1);
        ctx.fill();
        ctx.fillStyle = h.s % 8 === 2 ? "#ffcf80" : "#0b0a12";
        circle(ctx, ax, E + rh * 0.38, 0.8);
        ctx.fill();
      }
    } else {
      poly(ctx, [[-eave, E - 0.2], [-hw + 2.4, E + rh * 0.75], [hw - 2.4, E + rh * 0.75], [eave, E - 0.2]]);
      ctx.fill();
      tiles(ctx, -eave, eave, E, E + rh * 0.75, 0.9, rgba("#000000", far ? 0.2 : 0.4));
      ctx.strokeStyle = col("#7a7aa0");
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = 0.2;
      line(ctx, -hw + 2.4, E + rh * 0.75, hw - 2.4, E + rh * 0.75);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = ink;
    R(ctx, -eave, E - 0.5, eave * 2, 0.55);
    if (h.chimney) {
      const cx = hw * 0.45;
      ctx.fillStyle = col("#3a2a2a");
      R(ctx, cx - 0.9, E + 1.2, 1.8, rh * 0.8);
      ctx.fillStyle = col("#1a1214");
      R(ctx, cx - 1.1, E + 1.2 + rh * 0.8, 2.2, 0.5);
      if (!far) {
        ctx.fillStyle = "rgba(170, 170, 190, 0.1)";
        for (let k = 0; k < 4; k++) {
          circle(ctx, cx + k * 0.6, E + rh * 0.8 + 2 + k * 1.7, 0.9 + k * 0.45);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /* -------------------------------------------------------- church, gallows */

  // The church: a long nave with tall pointed windows glowing dim, and a square
  // tower whose clock face and belfry arches are lit, and a shingled spire with
  // a weathercock, a head taller than the rooftops.
  function church(ctx, x, v) {
    const H = v.g.FIELD_H;
    ctx.save();
    ctx.translate(x, H);
    ctx.scale(1, -1);
    // The nave, to the left of the tower.
    ctx.fillStyle = "#2c2a38";
    R(ctx, -44, 0, 44, 25);
    ctx.fillStyle = "#1c1a28";
    poly(ctx, [[-46, 25], [-22, 33], [2, 25]]);
    ctx.fill();
    ctx.strokeStyle = rgba("#9aa0c8", 0.35);
    ctx.lineWidth = 0.22;
    line(ctx, -22, 33, 2, 25);
    for (let k = 0; k < 4; k++) {
      const wx = -38 + k * 10;
      ctx.fillStyle = "#14121c";
      poly(ctx, [[wx - 1.6, 8], [wx + 1.6, 8], [wx + 1.6, 18], [wx, 21.4], [wx - 1.6, 18]]);
      ctx.fill();
      ctx.fillStyle = rgba(["#b05a5a", "#c8a24a", "#5a78b0", "#6aa07a"][k], 0.55);
      poly(ctx, [[wx - 1.2, 8.4], [wx + 1.2, 8.4], [wx + 1.2, 17.8], [wx, 20.4], [wx - 1.2, 17.8]]);
      ctx.fill();
      ctx.fillStyle = "#14121c";
      R(ctx, wx - 0.1, 8.4, 0.2, 12);
    }
    ctx.fillStyle = "#1a1824";
    for (let k = 0; k < 5; k++) R(ctx, -44 + k * 10.5, 0, 1.4, 22);
    // The tower.
    ctx.fillStyle = "#34323f";
    R(ctx, 0, 0, 14, 34);
    ctx.fillStyle = "#292733";
    R(ctx, 10.4, 0, 3.6, 34);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    for (let y = 2; y < 34; y += 2.4) {
      ctx.moveTo(0, y);
      ctx.lineTo(14, y);
    }
    ctx.stroke();
    // The clock face, lit, and the belfry's arches.
    ctx.fillStyle = "#1a1824";
    circle(ctx, 7, 25, 3.3);
    ctx.fill();
    ctx.fillStyle = "#e8d8a8";
    circle(ctx, 7, 25, 2.8);
    ctx.fill();
    ctx.strokeStyle = "#1a1824";
    ctx.lineWidth = 0.28;
    line(ctx, 7, 25, 7, 27.2);
    line(ctx, 7, 25, 8.6, 24.2);
    ctx.fillStyle = "#0c0b12";
    for (const ax of [2.8, 8]) {
      poly(ctx, [[ax, 29], [ax + 3.2, 29], [ax + 3.2, 33], [ax + 1.6, 34.8], [ax, 33]]);
      ctx.fill();
    }
    ctx.fillStyle = "#e0b060";
    ctx.globalAlpha = 0.5;
    poly(ctx, [[3.3, 29.2], [5.5, 29.2], [5.5, 32.6], [4.4, 33.8], [3.3, 32.6]]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#14121c";
    poly(ctx, [[2.5, 4], [4.5, 4], [4.5, 9], [3.5, 10.6], [2.5, 9]]);
    ctx.fill();
    // The spire.
    ctx.fillStyle = "#222030";
    poly(ctx, [[-0.8, 34], [14.8, 34], [7, 52]]);
    ctx.fill();
    ctx.fillStyle = "#18161f";
    poly(ctx, [[7, 52], [14.8, 34], [10.6, 34]]);
    ctx.fill();
    ctx.strokeStyle = rgba("#8a90b8", 0.45);
    ctx.lineWidth = 0.2;
    line(ctx, -0.8, 34, 7, 52);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    for (let y = 36; y < 51; y += 1.1) {
      const half = ((52 - y) / 18) * 7.8;
      ctx.moveTo(7 - half, y);
      ctx.lineTo(7 + half, y);
    }
    ctx.stroke();
    // The weathercock.
    ctx.strokeStyle = "#0c0b10";
    ctx.lineWidth = 0.22;
    line(ctx, 7, 52, 7, 54.6);
    line(ctx, 5.4, 53.2, 8.6, 53.2);
    ctx.fillStyle = "#0c0b10";
    ellipse(ctx, 7.4, 54.4, 1, 0.55);
    ctx.fill();
    ctx.restore();
  }

  // The nearest surface under x at or below `y` (counted up): a shelf or the floor.
  function standing(v, x, y) {
    let top = v.groundAt(v.spec, x);
    if (!(top > -Infinity)) top = 0;
    for (const [a, b, sy, kind] of v.spec.shelves) if (kind !== "crumble" && x >= a && x <= b && sy < y - 3 && sy > top) top = sy;
    return top;
  }

  // The gallows: a beam over each group of hanged men (or a gibbet for one) on
  // posts to the platform or the street, braces at each end, iron hooks.
  function gallows(ctx, v, x0, x1) {
    const rows = v.spec.spawns.filter((s) => s[0] === "hanged").sort((a, b) => a[1] - b[1]);
    const groups = [];
    for (const s of rows) {
      const last = groups[groups.length - 1];
      if (last && s[1] - last.x1 <= 26 && s[2] === last.y) last.x1 = s[1];
      else groups.push({ x0: s[1], x1: s[1], y: s[2] });
    }
    const H = v.g.FIELD_H;
    for (const gr of groups) {
      if (gr.x1 + 12 < x0 || gr.x0 - 12 > x1) continue;
      const lone = gr.x0 === gr.x1;
      const a = lone ? gr.x0 - 4 : gr.x0 - 5;
      const b = lone ? gr.x0 + 3 : gr.x1 + 5;
      const by = H - gr.y;
      const postX = lone ? [a] : [a + 0.4, b - 0.4];
      ctx.fillStyle = "#2a1c12";
      for (const px of postX) {
        const floor = H - standing(v, px, gr.y);
        ctx.fillRect(px - 0.7, by - 1.2, 1.4, floor - by + 1.2);
        ctx.fillStyle = "#4a3220";
        ctx.fillRect(px - 0.7, by - 1.2, 0.35, floor - by + 1.2);
        ctx.fillStyle = "#2a1c12";
      }
      ctx.fillRect(a - 0.8, by - 1.5, b - a + 1.6, 1.5);
      ctx.fillStyle = "#4a3220";
      ctx.fillRect(a - 0.8, by - 1.5, b - a + 1.6, 0.35);
      ctx.strokeStyle = "#2a1c12";
      ctx.lineWidth = 0.55;
      for (const [px, s] of lone ? [[a, 1]] : [[a + 0.4, 1], [b - 0.4, -1]]) line(ctx, px, by + 4, px + s * 3.4, by - 0.2);
      // Iron hooks for the ropes, and old rope ends.
      ctx.strokeStyle = "#0e0e10";
      ctx.lineWidth = 0.2;
      for (const s of rows) if (s[2] === gr.y && s[1] >= gr.x0 && s[1] <= gr.x1) {
        circle(ctx, s[1], by + 0.1, 0.34);
        ctx.stroke();
      }
    }
  }

  // An old well: a stone drum, two posts and a little shingled roof, a crank, a
  // bucket on its rope.
  function well(ctx, x, fy) {
    ctx.fillStyle = "#3a3640";
    ctx.beginPath();
    ctx.ellipse?.(x, fy - 3.4, 4.4, 0.8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#4a4652";
    ctx.fillRect(x - 4.4, fy - 3.6, 8.8, 3.6);
    ctx.fillStyle = "#34303c";
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) ctx.fillRect(x - 4.4 + ((c + (r % 2) * 0.5) * 8.8) / 5 + 0.05, fy - 3.6 + r * 1.2 + 0.05, 8.8 / 5 - 0.12, 1.1);
    ctx.fillStyle = "#1a2016";
    ctx.beginPath();
    ctx.ellipse?.(x, fy - 3.6, 3.5, 0.6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#6a6672";
    ctx.fillRect(x - 4.4, fy - 3.7, 8.8, 0.35);
    ctx.fillStyle = "#2a1c12";
    for (const s of [-3.4, 3.4]) ctx.fillRect(x + s - 0.35, fy - 10.4, 0.7, 7);
    ctx.fillRect(x - 3.6, fy - 8.2, 7.2, 0.5);
    ctx.fillStyle = "#2c2433";
    poly(ctx, [[x - 5.2, fy - 9.6], [x, fy - 12.8], [x + 5.2, fy - 9.6]]);
    ctx.fill();
    ctx.strokeStyle = rgba("#8a90b8", 0.45);
    ctx.lineWidth = 0.18;
    line(ctx, x, fy - 12.8, x + 5.2, fy - 9.6);
    ctx.strokeStyle = "#5a4630";
    ctx.lineWidth = 0.14;
    line(ctx, x, fy - 8, x, fy - 5.2);
    ctx.fillStyle = "#4a3220";
    ctx.fillRect(x - 0.7, fy - 5.3, 1.4, 1.1);
    ctx.strokeStyle = "#6a5a3a";
    ctx.lineWidth = 0.22;
    line(ctx, x + 3.4, fy - 8.2, x + 4.6, fy - 7.4);
  }

  // A bare, gnarled tree in the dark.
  function tree(ctx, x, fy, s, tall) {
    ctx.fillStyle = "#0b0b14";
    ctx.beginPath();
    ctx.moveTo(x - 0.9, fy);
    ctx.quadraticCurveTo(x - 0.5, fy - tall * 0.5, x - 0.2, fy - tall);
    ctx.lineTo(x + 0.3, fy - tall);
    ctx.quadraticCurveTo(x + 0.7, fy - tall * 0.5, x + 1, fy);
    ctx.fill();
    ctx.strokeStyle = "#0b0b14";
    for (let k = 0; k < 6; k++) {
      const q = hash(s, 50 + k);
      const by = fy - tall * (0.4 + (k / 6) * 0.6);
      const dir = k % 2 ? 1 : -1;
      const len = 3.2 + (q % 5) * 0.8;
      ctx.lineWidth = 0.5 - k * 0.04;
      ctx.beginPath();
      ctx.moveTo(x + 0.1, by);
      ctx.quadraticCurveTo(x + dir * len * 0.5, by - len * 0.2, x + dir * len, by - len * 0.7);
      ctx.stroke();
      ctx.lineWidth = 0.2;
      line(ctx, x + dir * len * 0.7, by - len * 0.45, x + dir * len * 1.05, by - len * 0.4);
    }
  }

  /* ------------------------------------------------------------ the inn */

  const INN_WIN = freeze({ every: 48, w: 8, top: 7, h: 15 });
  const HEARTH_EVERY = 112;

  function innHearths(x0, x1) {
    const out = [];
    for (let n = Math.floor((x0 - 20) / HEARTH_EVERY); n * HEARTH_EVERY < x1 + 20; n++) if (hash(n, 61) % 3 !== 0) out.push({ x: n * HEARTH_EVERY + 56, n });
    return out;
  }

  function innWindows(spec, x0, x1) {
    const hearths = innHearths(x0 - 50, x1 + 50);
    const out = [];
    for (let n = Math.floor((x0 - 20) / INN_WIN.every); n * INN_WIN.every < x1 + 20; n++) {
      const cx = n * INN_WIN.every + 24;
      if (hearths.some((hr) => Math.abs(hr.x - cx) < 13)) continue;
      out.push({ x: cx - INN_WIN.w / 2, top: INN_WIN.top, w: INN_WIN.w, h: INN_WIN.h, n });
    }
    return out;
  }

  const LANTERN_EVERY = 38;
  function innLanterns(x0, x1) {
    const out = [];
    for (let n = Math.floor((x0 - 10) / LANTERN_EVERY); n * LANTERN_EVERY < x1 + 10; n++) {
      const q = hash(n, 71);
      if (q % 4 === 0) continue;
      out.push({ x: n * LANTERN_EVERY + 14 + (q % 9), drop: 6 + (q % 5), n });
    }
    return out;
  }

  function barrel(ctx, x, fy, s, big) {
    const w = big ? 3.8 : 3;
    const h = big ? 4.4 : 3.4;
    ctx.fillStyle = "#4a2e18";
    ctx.beginPath();
    ctx.moveTo(x - w * 0.42, fy);
    ctx.quadraticCurveTo(x - w * 0.62, fy - h * 0.5, x - w * 0.42, fy - h);
    ctx.lineTo(x + w * 0.42, fy - h);
    ctx.quadraticCurveTo(x + w * 0.62, fy - h * 0.5, x + w * 0.42, fy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6a4426";
    ctx.fillRect(x - w * 0.45, fy - h * 0.5, w * 0.12, h * 0.4);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let k = -1; k <= 1; k++) ctx.fillRect(x + k * w * 0.2 - 0.05, fy - h, 0.1, h);
    ctx.fillStyle = "#1c1c20";
    ctx.fillRect(x - w * 0.5, fy - h * 0.8, w, 0.36);
    ctx.fillRect(x - w * 0.5, fy - h * 0.2, w, 0.36);
    ctx.fillStyle = "#2a1a0c";
    circle(ctx, x + w * 0.1, fy - h * 0.5, 0.3);
    ctx.fill();
    if (big && s % 2) {
      ctx.fillStyle = "#6a6a70";
      ctx.fillRect(x + w * 0.5, fy - h * 0.45, 0.9, 0.35);
    }
  }

  function hearth(ctx, x, fy, n) {
    ctx.fillStyle = "#3a3440";
    ctx.fillRect(x - 7.2, fy - 18, 14.4, 18);
    ctx.fillStyle = "#4a4452";
    ctx.fillRect(x - 7.2, fy - 18, 14.4, 0.8);
    ctx.fillStyle = "#2a2630";
    for (let r = 0; r < 7; r++) for (let c = 0; c < 4; c++) ctx.fillRect(x - 7.2 + ((c + (r % 2) * 0.5) * 14.4) / 4, fy - 17 + r * 2.4, 14.4 / 4 - 0.15, 0.12);
    ctx.fillStyle = "#07050a";
    ctx.beginPath();
    ctx.moveTo(x - 4.6, fy);
    ctx.lineTo(x - 4.6, fy - 8.4);
    ctx.quadraticCurveTo(x, fy - 12.6, x + 4.6, fy - 8.4);
    ctx.lineTo(x + 4.6, fy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(x - 3.6, fy - 1, 7.2, 0.9);
    ctx.fillStyle = "#4a3220";
    ctx.fillRect(x - 3, fy - 1.9, 6, 0.9);
    // The mantel: mugs, a clock, and a wolf's head mounted above.
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(x - 8.2, fy - 19, 16.4, 1.3);
    ctx.fillStyle = "#6a5a40";
    for (const dx of [-5.8, -4.6, 5]) ctx.fillRect(x + dx, fy - 21, 0.9, 2);
    if (n % 2 === 0) {
      ctx.fillStyle = "#4a3a2a";
      ctx.fillRect(x - 1.3, fy - 23, 2.6, 3.6);
      ctx.fillStyle = "#d8c898";
      circle(ctx, x, fy - 21.4, 0.9);
      ctx.fill();
    } else {
      ctx.fillStyle = "#4a4650";
      ellipse(ctx, x, fy - 23.6, 2, 1.5);
      ctx.fill();
      poly(ctx, [[x - 1.9, fy - 24.4], [x - 1.4, fy - 26.6], [x - 0.7, fy - 24.8]]);
      ctx.fill();
      poly(ctx, [[x + 1.9, fy - 24.4], [x + 1.4, fy - 26.6], [x + 0.7, fy - 24.8]]);
      ctx.fill();
      ctx.fillStyle = "#e8e0d0";
      for (const dx of [-0.7, 0.7]) ctx.fillRect(x + dx - 0.1, fy - 22.6, 0.2, 0.7);
      ctx.fillStyle = "#e8a030";
      circle(ctx, x - 0.8, fy - 23.9, 0.18);
      circle(ctx, x + 0.8, fy - 23.9, 0.18);
      ctx.fill();
    }
  }

  function innBar(ctx, x, fy, n) {
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(x - 10, fy - 12, 20, 12);
    ctx.fillStyle = "#1c120a";
    ctx.fillRect(x - 10, fy - 12, 20, 0.5);
    ctx.fillRect(x - 10, fy - 8, 20, 0.4);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 11; k++) {
      ctx.fillStyle = ["#2a5a38", "#6a3a1c", "#3a4a78", "#7a6a2a"][(k + r + n) % 4];
      ctx.fillRect(x - 9.2 + k * 1.7, fy - 11.6 + r * 3.8, 0.9, 2.6);
      ctx.fillRect(x - 9 + k * 1.7, fy - 12.4 + r * 3.8, 0.5, 0.9);
    }
    // The bar itself, with its taps.
    ctx.fillStyle = "#5a3a1c";
    ctx.fillRect(x - 11, fy - 5, 22, 0.9);
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(x - 10.4, fy - 4.1, 20.8, 4.1);
    ctx.fillStyle = "#8a6a2a";
    for (const dx of [-3, 0, 3]) {
      ctx.fillRect(x + dx - 0.2, fy - 6.4, 0.4, 1.4);
      ctx.fillRect(x + dx - 0.55, fy - 6.7, 1.1, 0.4);
    }
  }

  function innWindowFrame(ctx, w) {
    // The wall piece around is cut out; here, the frame, leaded panes and curtains.
    const { x, top, w: ww, h } = w;
    ctx.fillStyle = "#1c120a";
    ctx.fillRect(x - 0.7, top - 0.7, ww + 1.4, 0.7);
    ctx.fillRect(x - 0.7, top - 0.7, 0.7, h + 1.4);
    ctx.fillRect(x + ww, top - 0.7, 0.7, h + 1.4);
    ctx.fillRect(x - 1, top + h, ww + 2, 0.9);
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(x - 1.2, top + h + 0.9, ww + 2.4, 0.4);
    ctx.fillStyle = "rgba(140, 170, 200, 0.12)";
    ctx.fillRect(x, top, ww, h);
    ctx.strokeStyle = "#2a1a10";
    ctx.lineWidth = 0.15;
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      ctx.moveTo(x, top + k * (h / 8));
      ctx.lineTo(x + ww, top + k * (h / 8));
    }
    for (let k = 0; k <= 4; k++) {
      ctx.moveTo(x + k * (ww / 4), top);
      ctx.lineTo(x + k * (ww / 4), top + h);
    }
    ctx.stroke();
    ctx.lineWidth = 0.38;
    line(ctx, x + ww / 2, top, x + ww / 2, top + h);
    line(ctx, x, top + h * 0.5, x + ww, top + h * 0.5);
    // A candle on the sill.
    ctx.fillStyle = "#e8e0c0";
    ctx.fillRect(x + ww * 0.78, top + h - 0.1, 0.5, 1);
  }

  function innScene(ctx, v, x0, x1) {
    const { spec, g } = v;
    const H = g.FIELD_H;
    const floorAt = (x) => {
      const gy = v.groundAt(spec, x);
      return gy > -Infinity ? H - gy : null;
    };
    const wins = innWindows(spec, x0, x1);
    // The wall: plaster over a wainscot, with the windows cut out clear.
    ctx.fillStyle = "#3a2a22";
    ctx.beginPath();
    ctx.rect(x0, 0, x1 - x0, H);
    for (const w of wins) ctx.rect(w.x, w.top, w.w, w.h);
    ctx.fill("evenodd");
    ctx.fillStyle = "#2c1c14";
    ctx.fillRect(x0, 0, x1 - x0, 4);
    ctx.fillStyle = "#4a3426";
    ctx.fillRect(x0, 4, x1 - x0, 0.4);
    ctx.fillStyle = "#1c120b";
    ctx.fillRect(x0, 27, x1 - x0, H - 27);
    ctx.fillStyle = "#34261c";
    for (let x = Math.floor(x0 / 5) * 5; x < x1; x += 5) ctx.fillRect(x + 0.2, 28.2, 4.6, H - 28.6);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    for (let x = Math.floor(x0 / 5) * 5; x < x1; x += 5) ctx.fillRect(x, 27.6, 0.2, H);
    ctx.fillStyle = "#4a3222";
    ctx.fillRect(x0, 27, x1 - x0, 0.9);
    // Old oak posts and tie beams, with a brace at each post's head.
    for (let x = Math.floor((x0 - 4) / 32) * 32; x < x1 + 4; x += 32) {
      ctx.fillStyle = "#1c120a";
      ctx.fillRect(x - 0.9, 0, 1.8, H);
      ctx.fillStyle = "#2c1c10";
      ctx.fillRect(x - 0.9, 0, 0.45, H);
      ctx.strokeStyle = "#1c120a";
      ctx.lineWidth = 0.9;
      line(ctx, x + 0.9, 8.6, x + 5, 4);
      line(ctx, x - 0.9, 8.6, x - 5, 4);
    }
    for (let x = Math.floor(x0 / 16) * 16; x < x1 + 16; x += 16) {
      ctx.fillStyle = "#24160c";
      ctx.fillRect(x, 4, 1.6, 2);
    }
    for (const w of wins) innWindowFrame(ctx, w);
    for (const hr of innHearths(x0 - 10, x1 + 10)) {
      const fy = floorAt(hr.x);
      if (fy !== null) hearth(ctx, hr.x, fy, hr.n);
    }
    // The bar, and barrels and kegs standing about.
    for (let n = Math.floor((x0 - 14) / 190); n * 190 < x1 + 14; n++) {
      const x = n * 190 + 150;
      const fy = floorAt(x);
      if (hash(n, 66) % 3 !== 0 && fy !== null && floorAt(x - 10) === fy && floorAt(x + 10) === fy && !innHearths(x - 20, x + 20).some((hr) => Math.abs(hr.x - x) < 20)) innBar(ctx, x, fy, n);
    }
    for (let n = Math.floor((x0 - 10) / 44); n * 44 < x1 + 10; n++) {
      const q = hash(n, 73);
      const x = n * 44 + 8 + (q % 24);
      const fy = floorAt(x);
      if (fy === null || q % 3 === 0 || floorAt(x - 4) !== fy || floorAt(x + 4) !== fy) continue;
      if (innHearths(x - 10, x + 10).some((hr) => Math.abs(hr.x - x) < 11)) continue;
      barrel(ctx, x - 1.7, fy, q, true);
      barrel(ctx, x + 1.9, fy, q + 1, false);
      if (q % 2) barrel(ctx, x + 0.1, fy - 4.2, q + 2, false);
    }
    // Hanging iron lanterns on their chains, the ceiling beams over them.
    for (const l of innLanterns(x0 - 8, x1 + 8)) {
      ctx.strokeStyle = "#101010";
      ctx.lineWidth = 0.14;
      line(ctx, l.x, 4, l.x, 4 + l.drop);
      ctx.fillStyle = "#181410";
      ctx.fillRect(l.x - 0.9, 4 + l.drop, 1.8, 0.4);
      ctx.fillRect(l.x - 0.7, 4 + l.drop + 2.2, 1.4, 0.3);
      ctx.strokeStyle = "#181410";
      ctx.lineWidth = 0.18;
      line(ctx, l.x - 0.8, 4 + l.drop, l.x - 0.8, 4 + l.drop + 2.3);
      line(ctx, l.x + 0.8, 4 + l.drop, l.x + 0.8, 4 + l.drop + 2.3);
      ctx.fillStyle = rgba("#ffb858", 0.35);
      ctx.fillRect(l.x - 0.7, 4 + l.drop + 0.4, 1.4, 1.8);
    }
  }

  /* ------------------------------------------------------------ the scenes */

  // The far hills and a row of far, small roofs, under the near scenery.
  function farRow(ctx, v, x0, x1, seed, base, tone) {
    const H = v.g.FIELD_H;
    ctx.fillStyle = tone;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    for (let x = Math.floor(x0 / 4) * 4; x <= x1 + 4; x += 4) ctx.lineTo(x, H - base - 3 * Math.sin(x / 31 + seed) - 2 * Math.sin(x / 13 + seed * 2));
    ctx.lineTo(x1 + 4, H);
    ctx.closePath();
    ctx.fill();
  }

  // The green's arena: a tall wall at each end for the Beast to cling to, a house's
  // timbered side on the left, the churchyard's stone and ivy on the right, deep
  // claw gouges in both.
  function arenaWalls(ctx, v) {
    const { spec, g } = v;
    const H = g.FIELD_H;
    const wallW = 2.4;
    // On the way in, the left wall is the side of a house with a gateway through it (to the floor's height and a doorway wide).
    const floorY = H - v.groundAt(spec, spec.arena - 4);
    const gate = { a: spec.arena - 8, b: spec.arena - 0.2, top: floorY - 11.5 };
    ctx.fillStyle = "#3c3446";
    ctx.fillRect(gate.a - 3, 0, 3, H);
    ctx.fillRect(gate.a, 0, gate.b - gate.a, gate.top);
    ctx.fillRect(gate.b, 0, 0.2 + wallW, H);
    ctx.fillStyle = TIMBER;
    ctx.fillRect(gate.a - 3, 0, 0.5, H);
    ctx.fillRect(gate.a, gate.top - 0.5, gate.b - gate.a, 0.7);
    for (let y = 2; y < gate.top; y += 9) ctx.fillRect(gate.a - 3, y, gate.b - gate.a + 3, 0.5);
    ctx.fillStyle = "#4a3a52";
    ctx.beginPath();
    ctx.moveTo(gate.a, floorY);
    ctx.lineTo(gate.a, gate.top);
    ctx.lineTo(gate.b, gate.top);
    ctx.lineTo(gate.b, floorY);
    ctx.lineTo(gate.b - 0.7, floorY);
    ctx.lineTo(gate.b - 0.7, gate.top + 0.7);
    ctx.lineTo(gate.a + 0.7, gate.top + 0.7);
    ctx.lineTo(gate.a + 0.7, floorY);
    ctx.closePath();
    ctx.fill();
    for (const side of [-1, 1]) {
      const x = side < 0 ? spec.arena : spec.length - wallW;
      if (side > 0) {
        ctx.fillStyle = "#36343c";
        ctx.fillRect(x, 0, wallW, H);
      }
      if (side < 0) {
        ctx.fillStyle = TIMBER;
        for (let y = 2; y < H; y += 9) ctx.fillRect(x, y, wallW, 0.5);
        ctx.fillRect(x + 0.9, 0, 0.5, H);
        ctx.strokeStyle = TIMBER;
        ctx.lineWidth = 0.35;
        for (let y = 2; y < H - 9; y += 18) line(ctx, x, y + 9, x + wallW, y);
      } else {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        for (let y = 1.6; y < H; y += 2.6) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + wallW, y);
          ctx.moveTo(x + wallW * (0.3 + (y % 2) * 0.4), y);
          ctx.lineTo(x + wallW * (0.3 + (y % 2) * 0.4), y + 2.6);
        }
        ctx.stroke();
        ctx.fillStyle = "#1c2c1c";
        for (let k = 0; k < 14; k++) {
          const q = hash(k, 91);
          ellipse(ctx, x + (q % 24) / 10, 6 + k * 3.4, 0.5, 1.1);
          ctx.fill();
        }
      }
      // The inner face lit by the moon, and the gouges.
      ctx.fillStyle = rgba("#aab0d8", 0.18);
      ctx.fillRect(side < 0 ? x + wallW - 0.35 : x, 0, 0.35, H);
      ctx.strokeStyle = "rgba(6, 4, 8, 0.85)";
      ctx.lineWidth = 0.22;
      for (let k = 0; k < 3; k++) {
        const gy = H - 11 - k * 1.8;
        line(ctx, x + 0.2, gy, x + wallW - 0.2, gy + 3.2);
        line(ctx, x + 0.5, gy - 0.5, x + wallW - 0.1, gy + 2.5);
      }
    }
  }

  function backdrop(ctx, v, look, x0, x1) {
    const { spec, g } = v;
    const scene = SCENE[spec.id];
    const H = g.FIELD_H;
    if (scene === "inn") return innScene(ctx, v, x0, x1);
    const dark = mixHex("#0b0d1a", "#181a2c", 0.4);
    farRow(ctx, v, x0, x1, 1.3, 16, dark);
    farRow(ctx, v, x0, x1, 4.1, 11, "#10122a");
    const houses = layoutOf(spec, hash);
    for (const h of inRange(houses, x0, x1, 30)) {
      if (h.far) house(ctx, h, v);
    }
    if (scene === "street" || scene === "square") {
      if (scene === "square") {
        for (let n = Math.floor((x0 - 120) / 300); n * 300 < x1 + 60; n++) church(ctx, n * 300 + 164, v);
      }
      for (const h of inRange(houses, x0, x1, 30)) if (!h.far && h.n < 1000) house(ctx, h, v);
      for (const h of inRange(houses, x0, x1, 30)) if (!h.far && h.n >= 1000) house(ctx, h, v);
      gallows(ctx, v, x0, x1);
    } else {
      for (let n = Math.floor((x0 - 20) / 37); n * 37 < x1 + 20; n++) {
        const q = hash(n, 81);
        if (q % 3 === 0) continue;
        const x = n * 37 + (q % 20);
        const gy = v.groundAt(spec, x);
        if (gy > -Infinity) tree(ctx, x, H - gy, n, 14 + (q % 8));
      }
      for (const wx of [spec.arena + 48, 52]) if (wx > x0 - 8 && wx < x1 + 8) well(ctx, wx, H - 6);
      // A lantern on a post along the approach.
      for (let x = Math.floor((x0 - 20) / 46) * 46 + 18; x < x1 + 20; x += 46) {
        if (x > spec.arena - 4) break;
        ctx.fillStyle = "#14101a";
        ctx.fillRect(x - 0.25, H - 17, 0.5, 11);
        ctx.fillRect(x - 0.9, H - 17.8, 1.8, 0.7);
        ctx.fillStyle = rgba("#ffb858", 0.8);
        ctx.fillRect(x - 0.55, H - 17.2, 1.1, 1.2);
      }
      if (spec.arena >= 0) arenaWalls(ctx, v);
    }
  }

  /* --------------------------------------------------------- floors, shelves */

  function stones(ctx, a, b, fy, depth, seed, base, lit) {
    let row = 0;
    for (let y = 0; y < depth; y += 1.3, row++) {
      let x = a + ((hash(seed, row) % 10) / 10) * 1.6 - 1.6;
      while (x < b) {
        const q = hash(Math.round(x * 3) + row * 131, seed + row);
        const w = 1.5 + (q % 8) * 0.12;
        const x2 = Math.min(b, x + w);
        if (x2 > a) {
          ctx.fillStyle = mixHex(base, "#000000", (q % 4) * 0.1 + row * 0.04);
          ctx.fillRect(Math.max(a, x) + 0.06, fy + y + 0.05, x2 - Math.max(a, x) - 0.12, 1.15);
          if (row === 0) {
            ctx.fillStyle = rgba(lit, 0.28 + (q % 3) * 0.08);
            ctx.fillRect(Math.max(a, x) + 0.1, fy + y + 0.05, x2 - Math.max(a, x) - 0.2, 0.2);
          }
        }
        x += w;
      }
    }
  }

  // The floor pieces, over the plain ones: cobbles, ashlar steps, the tavern's
  // planks and the green's turf.
  function ground(ctx, v, look, a, b, top) {
    const scene = SCENE[v.spec.id];
    const fy = v.g.FIELD_H - top;
    const seed = Math.round(a);
    if (scene === "street" || scene === "square") {
      ctx.fillStyle = "#1c1824";
      ctx.fillRect(a, fy, b - a, top);
      stones(ctx, a, b, fy, top > 8 ? Math.min(top, 7.8) : 3.9, seed, top > 8 ? "#4b4658" : "#4a443f", "#cfd2f0");
      // Moss and gutter-wet in the cracks, now and then a weed.
      ctx.fillStyle = "rgba(60, 100, 50, 0.45)";
      for (let x = Math.ceil(a / 7) * 7; x < b - 1; x += 7) {
        const q = hash(Math.round(x), 41);
        if (q % 2) continue;
        ctx.fillRect(x + (q % 5) * 0.2, fy, 0.8 + (q % 3) * 0.4, 0.35);
      }
      ctx.strokeStyle = "#2f4a2a";
      ctx.lineWidth = 0.12;
      for (let x = Math.ceil(a / 9) * 9; x < b - 1; x += 9) if (hash(Math.round(x), 43) % 3 === 0) line(ctx, x, fy, x - 0.2, fy - 0.8);
      if (top <= 8) {
        // Cart ruts and puddles that hold the moon on the street.
        ctx.fillStyle = rgba("#9aa4d8", 0.16);
        for (let x = Math.ceil(a / 31) * 31 + 9; x < b - 6; x += 31) if (hash(Math.round(x), 45) % 2 === 0) {
          ellipse(ctx, x, fy + 0.5, 2.4, 0.22);
          ctx.fill();
        }
      }
    } else if (scene === "inn") {
      ctx.fillStyle = "#24160c";
      ctx.fillRect(a, fy, b - a, top);
      for (let y = 0; y < Math.min(top, 7); y += 1.4) {
        let x = a + ((hash(seed, Math.round(y * 5)) % 9) / 9) * 6 - 6;
        while (x < b) {
          const q = hash(Math.round(x * 2), Math.round(y * 7));
          const w = 5.2 + (q % 5) * 0.7;
          const x1 = Math.max(a, x);
          const x2 = Math.min(b, x + w);
          if (x2 > x1) {
            ctx.fillStyle = mixHex("#6a4528", "#2a1a0e", 0.12 * (q % 4) + y * 0.05);
            ctx.fillRect(x1 + 0.05, fy + y + 0.05, x2 - x1 - 0.1, 1.3);
            if (y === 0) {
              ctx.fillStyle = "rgba(255, 220, 160, 0.16)";
              ctx.fillRect(x1 + 0.05, fy + y + 0.05, x2 - x1 - 0.1, 0.2);
            }
            if (q % 7 === 0) {
              ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
              ellipse(ctx, x1 + w * 0.4, fy + y + 0.7, 0.28, 0.2);
              ctx.fill();
            }
          }
          x += w;
        }
      }
      // Sawdust and a spill by the bar.
      ctx.fillStyle = "rgba(220, 190, 130, 0.12)";
      for (let x = Math.ceil(a / 13) * 13; x < b - 2; x += 13) if (hash(Math.round(x), 47) % 2) ctx.fillRect(x, fy + 0.1, 1.6, 0.3);
    } else {
      // Turf: tufts, a worn path, clover, the odd flower, mist low in the grass.
      ctx.fillStyle = "#16240f";
      ctx.fillRect(a, fy, b - a, Math.min(top, 6));
      ctx.fillStyle = "#2c4a22";
      ctx.fillRect(a, fy, b - a, 1.4);
      ctx.fillStyle = "#4a7a38";
      ctx.fillRect(a, fy, b - a, 0.35);
      ctx.fillStyle = "#6a5a3a";
      for (let x = Math.ceil(a / 24) * 24 + 4; x < b - 8; x += 24) if (hash(Math.round(x), 49) % 2 === 0) {
        ellipse(ctx, x + 4, fy + 0.5, 6, 0.45);
        ctx.fill();
      }
      ctx.strokeStyle = "#4f8a3c";
      ctx.lineWidth = 0.11;
      for (let x = a + 0.5; x < b - 0.5; x += 0.85) {
        const q = hash(Math.round(x * 10), 51);
        const hh = 0.6 + (q % 5) * 0.28;
        line(ctx, x, fy + 0.2, x + ((q % 3) - 1) * 0.35, fy - hh);
      }
      for (let x = Math.ceil(a / 17) * 17 + 3; x < b - 1; x += 17) {
        const q = hash(Math.round(x), 53);
        if (q % 3) continue;
        ctx.fillStyle = ["#e8e0f0", "#d8a8e8", "#f0d878"][q % 3];
        circle(ctx, x, fy - 0.9, 0.22);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(140, 160, 190, 0.07)";
      for (let x = Math.ceil(a / 22) * 22; x < b - 4; x += 22) {
        ellipse(ctx, x + 3, fy - 0.5, 9, 1);
        ctx.fill();
      }
    }
  }

  // A shelf's plank-and-bracket, seen from the side, between a and b at y.
  function awning(ctx, a, b, y, seed) {
    const [c1, c2] = AWNING[seed % AWNING.length];
    const w = b - a;
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(a, y, w, 0.5);
    let i = 0;
    for (let x = a; x < b; x += 1.6, i++) {
      const sw = Math.min(1.6, b - x);
      ctx.fillStyle = i % 2 ? c2 : c1;
      ctx.fillRect(x, y + 0.5, sw, 0.8);
      ctx.beginPath();
      ctx.moveTo(x, y + 1.3);
      ctx.lineTo(x + sw, y + 1.3);
      ctx.quadraticCurveTo(x + sw / 2, y + 3.1, x, y + 1.3);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.fillRect(a, y, w, 0.2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(a, y + 1.2, w, 0.18);
    ctx.strokeStyle = "#2a1c12";
    ctx.lineWidth = 0.28;
    for (const [bx, s] of [[a + 0.6, 1], [b - 0.6, -1]]) line(ctx, bx, y + 0.5, bx + s * 0.1, y + 4.4);
    // A little lantern swinging under the middle one.
    ctx.strokeStyle = "#101010";
    ctx.lineWidth = 0.1;
    line(ctx, (a + b) / 2, y + 3, (a + b) / 2, y + 4);
    ctx.fillStyle = rgba("#ffb858", 0.9);
    ctx.fillRect((a + b) / 2 - 0.4, y + 4, 0.8, 1);
  }

  function rooftop(ctx, a, b, y, seed, fy) {
    const w = b - a;
    ctx.fillStyle = "#2a2234";
    ctx.fillRect(a, y, w, 1.9);
    ctx.save();
    ctx.beginPath();
    ctx.rect(a, y, w, 1.9);
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.45)";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    for (let r = 0; r < 2; r++) for (let x = a + (r % 2) * 0.6; x < b; x += 1.2) {
      ctx.moveTo(x, y + r * 0.95);
      ctx.lineTo(x, y + r * 0.95 + 0.95);
    }
    ctx.moveTo(a, y + 0.95);
    ctx.lineTo(b, y + 0.95);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "#8a90b8";
    ctx.globalAlpha = 0.65;
    ctx.fillRect(a, y, w, 0.28);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#14101c";
    ctx.fillRect(a - 0.5, y + 1.7, w + 1, 0.5);
    // The house under the roof: a band of plaster and timber fading into the dark.
    const band = gradient(ctx, "createLinearGradient", [0, y + 2.2, 0, y + 6.6], [[0, rgba("#4a4256", 0.95)], [1, rgba("#4a4256", 0)]]);
    ctx.fillStyle = band;
    ctx.fillRect(a + 0.4, y + 2.2, w - 0.8, 4.4);
    ctx.fillStyle = rgba(TIMBER, 0.9);
    for (let x = a + 0.4; x < b - 0.4; x += 4.2) ctx.fillRect(x, y + 2.2, 0.5, 3.2);
    ctx.fillRect(a + 0.4, y + 2.2, w - 0.8, 0.45);
    if (w > 12) {
      ctx.fillStyle = seed % 2 ? "#ffcf80" : "#0b0a12";
      ctx.fillRect(a + w * 0.5 - 0.9, y + 3.1, 1.8, 2.2);
      ctx.fillStyle = TIMBER;
      ctx.fillRect(a + w * 0.5 - 0.06, y + 3.1, 0.12, 2.2);
    }
    for (const bx of [a + 1.2, b - 1.8]) {
      ctx.fillStyle = "#2a1c12";
      ctx.beginPath();
      ctx.moveTo(bx, y + 2.2);
      ctx.lineTo(bx + 0.6, y + 2.2);
      ctx.lineTo(bx + 0.6, y + 3.8);
      ctx.closePath();
      ctx.fill();
    }
    // A chimney on some, with its smoke; a weathervane on others.
    if (seed % 3 === 0 && w > 10) {
      const cx = a + w * 0.7;
      ctx.fillStyle = "#3a2a2a";
      ctx.fillRect(cx - 0.9, y - 3.6, 1.8, 3.6);
      ctx.fillStyle = "#1a1214";
      ctx.fillRect(cx - 1.1, y - 4.1, 2.2, 0.55);
      ctx.fillStyle = "rgba(170, 170, 190, 0.11)";
      for (let k = 0; k < 3; k++) {
        circle(ctx, cx + k * 0.5, y - 5.4 - k * 1.6, 0.9 + k * 0.4);
        ctx.fill();
      }
    }
  }

  function balcony(ctx, a, b, y, seed) {
    const w = b - a;
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(a, y, w, 0.9);
    ctx.fillStyle = "#6a4528";
    ctx.fillRect(a, y, w, 0.28);
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(a, y + 0.9, w, 1.1);
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let x = a + 1.6; x < b; x += 1.6) ctx.fillRect(x, y + 0.9, 0.12, 1.1);
    // Balusters and a rail behind.
    ctx.fillStyle = "#4a3018";
    ctx.fillRect(a, y - 2.6, w, 0.4);
    for (let x = a + 0.4; x < b; x += 1.3) ctx.fillRect(x, y - 2.3, 0.35, 2.3);
    ctx.fillRect(a, y - 2.9, 0.6, 2.9);
    ctx.fillRect(b - 0.6, y - 2.9, 0.6, 2.9);
    // Corbels and a flower box.
    ctx.fillStyle = "#2a1a0e";
    for (const bx of [a + 1, b - 1.8]) {
      ctx.beginPath();
      ctx.moveTo(bx, y + 2);
      ctx.lineTo(bx + 0.8, y + 2);
      ctx.lineTo(bx + 0.8, y + 3.8);
      ctx.closePath();
      ctx.fill();
    }
    if (seed % 2) {
      ctx.fillStyle = "#4a321f";
      ctx.fillRect(a + 2, y - 1.5, 3.4, 1.3);
      ctx.fillStyle = ["#b0485a", "#c8a24a", "#7a5ac0"][seed % 3];
      for (let k = 0; k < 4; k++) {
        circle(ctx, a + 2.5 + k * 0.85, y - 1.7, 0.4);
        ctx.fill();
      }
    }
  }

  function scaffold(ctx, a, b, y, fy) {
    const w = b - a;
    ctx.fillStyle = "#3a2412";
    ctx.fillRect(a, y, w, 1.2);
    ctx.fillStyle = "#6a4528";
    ctx.fillRect(a, y, w, 0.3);
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    for (let x = a + 2.4; x < b; x += 2.4) ctx.fillRect(x, y, 0.12, 1.2);
    // A trapdoor with its hinges, and posts with cross-braces down to the street.
    ctx.fillStyle = "#1a1008";
    ctx.fillRect(a + w * 0.4, y - 0.02, 4.4, 0.4);
    ctx.fillStyle = "#2a1a0e";
    for (const px of [a + 1, a + w * 0.5 - 0.4, b - 1.8]) ctx.fillRect(px, y + 1.2, 0.8, Math.max(0.5, fy - y - 1.2));
    ctx.strokeStyle = "#2a1a0e";
    ctx.lineWidth = 0.3;
    line(ctx, a + 1.4, y + 1.4, a + w * 0.5, fy - 0.2);
    line(ctx, b - 1.4, y + 1.4, a + w * 0.5, fy - 0.2);
  }

  function table(ctx, a, b, y, seed, fy) {
    const w = b - a;
    ctx.fillStyle = "#5a3a1c";
    ctx.fillRect(a, y, w, 0.9);
    ctx.fillStyle = "#8a6034";
    ctx.fillRect(a, y, w, 0.25);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    for (let x = a + 2.8; x < b; x += 2.8) ctx.fillRect(x, y, 0.1, 0.9);
    ctx.fillStyle = "#3a2412";
    for (const lx of [a + 1.4, b - 2.2]) ctx.fillRect(lx, y + 0.9, 0.8, Math.max(1, fy - y - 0.9));
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(a + 1.4, y + (fy - y) * 0.6, w - 2.8, 0.4);
    // What stands on it: tankards, a loaf, a candle in its dish.
    ctx.fillStyle = "#c8c4b8";
    for (let x = a + 2.2; x < b - 2; x += 4.6) {
      ctx.fillRect(x, y - 1.1, 0.8, 1.1);
      ctx.fillStyle = "#8a7a50";
      ctx.fillRect(x - 0.25, y - 1.1, 0.3, 0.8);
      ctx.fillStyle = "#c8c4b8";
    }
    ctx.fillStyle = "#b07a3a";
    ellipse(ctx, a + w * 0.55, y - 0.3, 0.9, 0.5);
    ctx.fill();
    ctx.fillStyle = "#e8e0c0";
    ctx.fillRect(a + w * 0.28, y - 1.2, 0.4, 1.2);
    ctx.fillStyle = "#ffb858";
    ellipse(ctx, a + w * 0.28 + 0.2, y - 1.5, 0.22, 0.38);
    ctx.fill();
  }

  function stoneWall(ctx, a, b, y, fy) {
    const w = b - a;
    ctx.fillStyle = "#2c2a34";
    ctx.fillRect(a + 0.3, y + 2.4, w - 0.6, Math.max(0, fy - y - 2.4));
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    for (let r = 3.6; r < fy - y; r += 1.2) ctx.fillRect(a + 0.3, y + r, w - 0.6, 0.12);
    ctx.fillStyle = "#3c3a44";
    ctx.fillRect(a, y, w, 2.4);
    ctx.fillStyle = "#4a4852";
    for (let x = a; x < b; x += 1.7) ctx.fillRect(x + 0.05, y + 0.1, 1.55, 1.1);
    ctx.fillStyle = "#2a2830";
    for (let x = a + 0.8; x < b; x += 1.9) ctx.fillRect(x, y + 1.3, 1.5, 1.0);
    ctx.fillStyle = "#8a90b8";
    ctx.globalAlpha = 0.5;
    ctx.fillRect(a, y, w, 0.25);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#2c4a2a";
    for (let x = a + 1; x < b - 1; x += 3.4) {
      if (hash(Math.round(x * 4), 55) % 2) continue;
      ellipse(ctx, x, y, 0.8, 0.28);
      ctx.fill();
    }
  }

  function cart(ctx, a, b, y, fy) {
    const w = b - a;
    ctx.fillStyle = "#6a5a2a";
    ellipse(ctx, a + w / 2, y + 0.2, w / 2, 1.1);
    ctx.fill();
    ctx.fillStyle = "#a08a44";
    ctx.fillRect(a + 0.5, y, w - 1, 0.35);
    ctx.fillStyle = "#4a3018";
    ctx.fillRect(a, y + 0.9, w, 1.6);
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    for (let x = a + 1.4; x < b; x += 1.4) ctx.fillRect(x, y + 0.9, 0.1, 1.6);
    const wr = Math.min(1.8, (fy - y - 2) / 2);
    ctx.strokeStyle = "#2a1a0e";
    ctx.lineWidth = 0.26;
    for (const wx of [a + w * 0.25, b - w * 0.25]) {
      circle(ctx, wx, y + 2.6 + wr, wr);
      ctx.stroke();
      for (let k = 0; k < 4; k++) {
        const an = (k * Math.PI) / 4;
        line(ctx, wx - Math.cos(an) * wr, y + 2.6 + wr - Math.sin(an) * wr, wx + Math.cos(an) * wr, y + 2.6 + wr + Math.sin(an) * wr);
      }
    }
  }

  function thatch(ctx, a, b, y, seed, fy) {
    const w = b - a;
    ctx.fillStyle = "#2a1c12";
    for (const px of [a + 1.2, b - 1.8]) ctx.fillRect(px, y + 2.4, 0.7, Math.max(0, fy - y - 2.4));
    ctx.fillStyle = "#6a5a2a";
    ctx.beginPath();
    ctx.moveTo(a - 0.6, y + 2.4);
    ctx.quadraticCurveTo(a - 0.3, y, a + 1, y);
    ctx.lineTo(b - 1, y);
    ctx.quadraticCurveTo(b + 0.3, y, b + 0.6, y + 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 44, 14, 0.7)";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    for (let x = a; x < b; x += 0.7) {
      ctx.moveTo(x, y + 0.3);
      ctx.lineTo(x - 0.1 + (hash(Math.round(x * 5), seed) % 3) * 0.1, y + 2.5);
    }
    ctx.stroke();
    ctx.fillStyle = "#a89048";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(a + 0.6, y, w - 1.2, 0.3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#4a3c1a";
    for (let x = a - 0.4; x < b + 0.4; x += 0.8) ctx.fillRect(x, y + 2.1, 0.45, 0.5 + (hash(Math.round(x * 5), seed + 1) % 3) * 0.3);
  }

  function shelf(ctx, v, look, a, b, y) {
    const { spec, g } = v;
    const scene = SCENE[spec.id];
    const gy = v.groundAt(spec, (a + b) / 2);
    const fy = gy > -Infinity ? g.FIELD_H - gy : y + 6;
    const hgt = fy - y;
    const seed = Math.round(a);
    if (scene === "inn") {
      if (hgt <= 6.6) table(ctx, a, b, y, seed, fy);
      else balcony(ctx, a, b, y, seed);
    } else if (scene === "green") {
      if (hgt <= 7) {
        if (seed % 2) cart(ctx, a, b, y, fy);
        else stoneWall(ctx, a, b, y, fy);
      } else thatch(ctx, a, b, y, seed, fy);
    } else if (b - a >= 24 && scene === "square") scaffold(ctx, a, b, y, fy);
    else if (hgt <= 6.6) awning(ctx, a, b, y, seed);
    else if (hgt <= 10) balcony(ctx, a, b, y, seed);
    else rooftop(ctx, a, b, y, seed, fy);
  }

  /* --------------------------------------------------- what moves, the wash */

  // The windows of the street and the square that are in view, by house.
  const windowsIn = (v, x0, x1) => {
    const out = [];
    const scene = SCENE[v.spec.id];
    if (scene === "inn" || !scene || scene === "green") return out;
    for (const h of inRange(layoutOf(v.spec, hash), x0, x1, 14)) if (!h.far) for (const wn of h.wins) if (wn.wx > x0 - 6 && wn.wx < x1 + 6) out.push({ h, wn });
    return out;
  };

  // Curtains: a pair of cloth panels in each lit window and some dark ones; as
  // Planny passes, one is pulled aside and a pale face looks out.
  function curtains(ctx, v, cam) {
    const { g, round } = v;
    const clock = v.clock || 0;
    for (const { wn } of windowsIn(v, cam, cam + g.FIELD_W)) {
      if (!wn.curtain || wn.ghoul) continue;
      const wy = g.FIELD_H - wn.y - wn.h;
      const x = wn.wx - wn.w / 2;
      const near = clamp(1 - Math.abs(round.you.x - wn.wx) / 34, 0, 1);
      const a = Math.pow(Math.max(0, Math.sin(clock / (300 - near * 150) + wn.q * 1.9)), 8) * near;
      const cloth = wn.lit ? "#e8c890" : "#5a4a5a";
      if (a > 0.5 && !wn.figure) {
        // The face at the gap.
        ctx.fillStyle = wn.lit ? "#2a1810" : "#c8c4cc";
        ellipse(ctx, wn.wx + 0.3, wy + wn.h * 0.5, 0.8, 1.05);
        ctx.fill();
        ctx.fillStyle = wn.lit ? "#ffcf80" : "#0a0a10";
        ctx.fillRect(wn.wx - 0.1, wy + wn.h * 0.45, 0.26, 0.2);
        ctx.fillRect(wn.wx + 0.55, wy + wn.h * 0.45, 0.26, 0.2);
      }
      ctx.globalAlpha = wn.lit ? 0.85 : 0.6;
      ctx.fillStyle = cloth;
      const open = 0.15 + a * 1.1;
      const lw = wn.w / 2 - open * 0.5;
      ctx.beginPath();
      ctx.moveTo(x, wy);
      ctx.lineTo(x + lw, wy);
      ctx.quadraticCurveTo(x + lw * 0.8, wy + wn.h * 0.5, x + lw - open * 0.3, wy + wn.h * 0.82);
      ctx.lineTo(x, wy + wn.h * 0.85);
      ctx.closePath();
      ctx.fill();
      const rw = wn.w / 2 - 0.15;
      const sway = a * 0.9;
      ctx.beginPath();
      ctx.moveTo(x + wn.w, wy);
      ctx.lineTo(x + wn.w - rw, wy);
      ctx.quadraticCurveTo(x + wn.w - rw * 0.8 + sway * 0.2, wy + wn.h * 0.45, x + wn.w - rw + sway * 1.1, wy + wn.h * 0.82);
      ctx.lineTo(x + wn.w, wy + wn.h * 0.85);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // Fire in a hearth, tongues rising and leaning; a coal bed under it.
  function hearthFire(ctx, x, fy, clock, n) {
    ctx.fillStyle = "#6a1a08";
    ctx.fillRect(x - 3, fy - 2.4, 6, 1.4);
    for (const [layer, color, hs, ws] of [[0, "#e2452a", 1, 1], [1, "#ff9a2e", 0.74, 0.72], [2, "#ffe27a", 0.48, 0.4]]) {
      for (let k = 0; k < 6; k++) {
        const fx = x - 2.6 + (k * 5.2) / 5;
        const flick = Math.abs(Math.sin(clock / 90 + k * 1.9 + layer + n));
        const tall = 6.4 * hs * (0.5 + flick * 0.5) * (1 - Math.abs(k - 2.5) / 7);
        const sway = Math.sin(clock / 130 + k * 2.3) * 0.35;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(fx - 0.9 * ws, fy - 2);
        ctx.quadraticCurveTo(fx - 0.5 * ws, fy - 2 - tall * 0.55, fx + sway, fy - 2 - tall);
        ctx.quadraticCurveTo(fx + 0.5 * ws, fy - 2 - tall * 0.5, fx + 0.9 * ws, fy - 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = "#ffd070";
    for (let k = 0; k < 4; k++) {
      const q = (clock / 800 + k / 4 + n) % 1;
      ctx.globalAlpha = 1 - q;
      ctx.fillRect(x - 2 + k * 1.3 + Math.sin(q * 7 + k) * 0.6, fy - 4 - q * 9, 0.2, 0.2);
    }
    ctx.globalAlpha = 1;
  }

  function innMoving(ctx, v, cam) {
    const { g, spec } = v;
    const clock = v.clock || 0;
    const H = g.FIELD_H;
    const p = shownMoon(v);
    for (const hr of innHearths(cam - 10, cam + g.FIELD_W + 10)) {
      const gy = v.groundAt(spec, hr.x);
      if (gy > -Infinity) hearthFire(ctx, hr.x, H - gy, clock, hr.n);
    }
    for (const l of innLanterns(cam - 8, cam + g.FIELD_W + 8)) {
      const fl = 0.75 + 0.25 * Math.sin(clock / 110 + l.n * 2.1) * Math.sin(clock / 37 + l.n);
      const ly = 4 + l.drop + 1.3;
      ctx.fillStyle = rgba("#ffb858", 0.5 * fl);
      circle(ctx, l.x, ly, 0.5 + fl * 0.15);
      ctx.fill();
      ctx.fillStyle = rgba("#ffe0a0", 0.9);
      circle(ctx, l.x, ly, 0.26);
      ctx.fill();
    }
    // Moonlight falling in: a pale shaft from each window to the floor, brighter
    // and warmer as the moon climbs, with dust turning in it.
    for (const w of innWindows(spec, cam - 6, cam + g.FIELD_W + 6)) {
      const fy = H - (v.groundAt(spec, w.x + w.w / 2) > -Infinity ? v.groundAt(spec, w.x + w.w / 2) : 6);
      const sh = 5 + p * 5;
      const grd = gradient(ctx, "createLinearGradient", [w.x, w.top + w.h, w.x + sh, fy], [[0, rgba(moonHalo(p), 0.2 + 0.16 * p)], [1, rgba(moonHalo(p), 0.02)]]);
      ctx.fillStyle = grd;
      poly(ctx, [[w.x, w.top + w.h], [w.x + w.w, w.top + w.h], [w.x + w.w + sh + 4, fy], [w.x + sh - 2, fy]]);
      ctx.fill();
      ctx.fillStyle = rgba("#fff6d8", 0.5);
      for (let k = 0; k < 5; k++) {
        const q = (clock / 4000 + k / 5 + w.n * 0.13) % 1;
        ctx.fillRect(w.x + w.w / 2 + q * sh + Math.sin(q * 8 + k) * 1.2, w.top + w.h + q * (fy - w.top - w.h), 0.14, 0.14);
      }
    }
  }

  function moving(ctx, v, cam) {
    const scene = SCENE[v.spec.id];
    if (!scene) return;
    if (scene === "inn") innMoving(ctx, v, cam);
    else curtains(ctx, v, cam);
  }

  // Over everything before the dark: at full moon its light washes the room, a
  // gold haze from the moon and a cool lift everywhere; Wolfsbane's petals turn
  // round Planny; the Beast's rage reddens the edges.
  function front(ctx, v) {
    const { g, round } = v;
    const scene = SCENE[v.spec.id];
    if (!scene) return;
    const cam = Math.round(round.camX * 8) / 8;
    const p = shownMoon(v);
    const wash = clamp((p - 0.75) / 0.25, 0, 1);
    if (wash > 0) {
      const m = moonSpot(g, p, scene);
      const cx = scene === "inn" ? cam + g.FIELD_W * 0.5 : cam + m.x;
      const cy = scene === "inn" ? g.FIELD_H * 0.3 : m.y;
      ctx.fillStyle = gradient(ctx, "createRadialGradient", [cx, cy, 2, cx, cy, g.FIELD_W * 0.95], [[0, rgba("#ffd890", 0.26 * wash)], [0.5, rgba("#ffc070", 0.1 * wash)], [1, rgba("#9aa8e0", 0.07 * wash)]]);
      ctx.fillRect(cam, 0, g.FIELD_W, g.FIELD_H);
    }
    const b = round.boss;
    if (b && b.kind === "beast" && b.raged && b.state !== "down") {
      const pulse = 0.5 + 0.5 * Math.sin((v.clock || 0) / 260);
      ctx.fillStyle = gradient(ctx, "createRadialGradient", [cam + g.FIELD_W / 2, g.FIELD_H / 2, g.FIELD_H * 0.5, cam + g.FIELD_W / 2, g.FIELD_H / 2, g.FIELD_W * 0.62], [[0, "rgba(160, 20, 10, 0)"], [1, `rgba(160, 20, 10, ${0.16 + 0.1 * pulse})`]]);
      ctx.fillRect(cam, 0, g.FIELD_W, g.FIELD_H);
    }
    const bane = round.effects ? round.effects.bane : 0;
    if (bane > 0) {
      const you = round.you;
      const fade = Math.min(1, bane / 1000);
      const cx = you.x;
      const cy = g.FIELD_H - you.y - 2.5;
      ctx.fillStyle = rgba("#a58ae0", 0.16 * fade);
      circle(ctx, cx, cy, 3.6);
      ctx.fill();
      for (let k = 0; k < 7; k++) {
        const an = (v.clock || 0) / 520 + (k * TAU) / 7;
        const px = cx + Math.cos(an) * 3.1;
        const py = cy + Math.sin(an) * 2.3;
        ctx.globalAlpha = fade * (0.55 + 0.35 * Math.sin(an * 2));
        ctx.fillStyle = k % 2 ? "#c8b4f4" : "#8a68d0";
        ellipse(ctx, px, py, 0.34, 0.5, an);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // What the dark lets through here: the moon (wide, and wider at full), the
  // lit windows, the inn's hearths, lanterns and moonlit windows.
  function lights(v, add) {
    const { g, round } = v;
    const scene = SCENE[v.spec.id];
    if (!scene) return;
    const cam = round.camX;
    const p = shownMoon(v);
    const wash = clamp((p - 0.75) / 0.25, 0, 1);
    if (scene === "inn") {
      for (const w of innWindows(v.spec, cam - 10, cam + g.FIELD_W + 10)) add(w.x + w.w / 2 + 2, w.top + w.h * 0.6, 12 + p * 5, 0.3 + 0.3 * p + 0.2 * wash);
      for (const hr of innHearths(cam - 14, cam + g.FIELD_W + 14)) {
        const gy = v.groundAt(v.spec, hr.x);
        if (gy > -Infinity) add(hr.x, g.FIELD_H - gy - 4, 17 + Math.sin((v.clock || 0) / 120 + hr.n) * 1.2, 0.8);
      }
      for (const l of innLanterns(cam - 8, cam + g.FIELD_W + 8)) add(l.x, 4 + l.drop + 1.4, 8, 0.55);
      if (wash > 0) add(cam + g.FIELD_W / 2, g.FIELD_H * 0.4, 60, 0.4 * wash);
      return;
    }
    const m = moonSpot(g, p, scene);
    add(cam + m.x, m.y, m.r * 5.2, 0.4 + 0.4 * p);
    if (wash > 0) add(cam + g.FIELD_W / 2, g.FIELD_H * 0.55, 74, 0.62 * wash);
    for (const { wn } of windowsIn(v, cam - 8, cam + g.FIELD_W + 8)) if (wn.lit) add(wn.wx, g.FIELD_H - wn.y - wn.h / 2, 7, 0.4);
  }

  // The moon in room coordinates now (what the Beast howls at).
  const moonWorld = (v) => {
    const p = shownMoon(v);
    const m = moonSpot(v.g, p, SCENE[v.spec.id]);
    return { x: v.round.camX + m.x, y: m.y, r: m.r, p };
  };

  return freeze({ sky, backdrop, ground, shelf, moving, front, lights, moonWorld });
}
