// Plan2Code Web Console - Bounce Road's cars: one toy car seen from above in any of a dozen styles, Planny's little convertible among them, with its tires, glass, lights and trim, rolled into a turn, lifted into a jump, flattened, dented, braking, boosting or with its siren going.
//
// Drawing only, no imports and no state: drawCarBody(ctx, style, opts) draws
// one car about the current origin, nose toward -y (up the board), in the
// caller's units (bounce-draw.js's field units). The car fills `opts.w` across
// and `opts.h` long exactly, the tires at its four corners, so the caller sizes
// the art and the hitbox together; carLength(style, w) is the length a style
// looks right at for a width. Every color is worked out here from `color` and
// `accent` (#rgb, #rrggbb or rgb()), never read from the page, and anything
// that moves (a flame's flicker, the siren, smoke, the dazed stars, a wave)
// follows `opts.clock` (or `opts.siren`), never Math.random(), so a paused
// game's frame stays still. One save() and one restore() round the whole car.
//
// What draws outside the w by h box (carReach() gives the exact extents):
// - `air` (0..1): this file draws the shadow and the lift, so the caller must
//   not. The shadow sits on the road, offset down and to the right by
//   (0.04 + 0.4 air) w and (0.05 + 0.35 air) h; the car above it scales up
//   about its middle by 1 + 0.35 air (up to 0.175 w and 0.175 h past each side).
//   With `shadow: false` the body is drawn without it: a caller can then draw
//   every car's shadow first with drawCarShadow(ctx, style, opts), each at
//   the car's place but not turned with its heading or tumble (so it always
//   falls down and right, and never paints over a car drawn before it), and
//   then the bodies, turned as they are, with `shadow: false`.
// - `squash` (0..1): the car pancakes to 1 + 0.2 squash wide (0.1 w past each
//   side) and 1 - 0.5 squash long.
// - `lights`: the headlight beams reach 1.3 h ahead of the nose and 0.35 w
//   past either side.
// - `boost`: the exhaust flame reaches 0.45 h behind the tail.
// Everything else (mirrors, the spoiler, the light bar, smoke, the dazed
// stars) stays inside the box. Kept cheap for a dozen cars a frame: flat
// fills and a few see-through highlight shapes, no gradients and no
// shadowBlur, and on the order of a hundred path calls a car (the taxi's
// checker strip, say, is two paths of rects, not one fill per square).

const TAU = Math.PI * 2;
const INK = "#1d1a17";
const LINE = "rgba(18, 15, 13, 0.85)";
const TIRE = "#1b1b1f";
const RIM = "#5d616b";
const TREAD = "#34363d";
const GLASS = "#22364b";
const GLINT = "rgba(206, 232, 255, 0.55)";
const SHEEN = "rgba(255, 255, 255, 0.14)";
const HEAD = "#fff4c4";
const TAIL = "#9e1b14";
const TAIL_ON = "#ff3a2a";
const TAIL_GLOW = "rgba(255, 58, 42, 0.5)";
const BEAM = "rgba(255, 236, 170, 0.2)";
const BEAM_CORE = "rgba(255, 242, 196, 0.28)";
const SIREN_RED = "#ff2d2d";
const SIREN_BLUE = "#2d6bff";

// The margins carReach() and the header list, as shares of w or h.
export const MARGINS = Object.freeze({ lift: 0.35, shadowX: 0.4, shadowY: 0.35, squashW: 0.2, squashH: 0.5, beamAhead: 1.3, beamSide: 0.35, flame: 0.45 });

/* ------------------------------------------------------------- colors */

const RGB = new Map();

// [r, g, b] of "#rgb", "#rrggbb" (an alpha pair or digit is ignored) or
// "rgb(a)(...)", or null for anything else.
export function rgbOf(color) {
  const key = typeof color === "string" ? color : "";
  if (RGB.has(key)) return RGB.get(key);
  const c = key.trim();
  let m;
  let rgb = null;
  if ((m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c))) rgb = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
  else if ((m = /^#([0-9a-f]{3})[0-9a-f]?$/i.exec(c))) rgb = [...m[1]].map((h) => parseInt(h + h, 16));
  else if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(c))) rgb = [m[1], m[2], m[3]].map((n) => Math.min(255, Math.max(0, Math.round(Number(n)))));
  // Frozen: the cached array is handed to every caller.
  if (rgb) Object.freeze(rgb);
  if (RGB.size > 512) RGB.clear();
  RGB.set(key, rgb);
  return rgb;
}

const SHADES = new Map();

// `color` toward white (amt > 0) or black (amt < 0), as "#rrggbb". A color
// rgbOf() cannot read comes back as mid gray; a missing or non-number
// amount is 0.
export function shade(color, amt) {
  amt = Number(amt) || 0;
  const key = `${color}|${amt}`;
  if (SHADES.has(key)) return SHADES.get(key);
  const rgb = rgbOf(color) || [128, 128, 128];
  const to = amt > 0 ? 255 : 0;
  const t = Math.min(1, Math.abs(amt));
  const hex = "#" + rgb.map((v) => Math.round(v + (to - v) * t).toString(16).padStart(2, "0")).join("");
  if (SHADES.size > 1024) SHADES.clear();
  SHADES.set(key, hex);
  return hex;
}

// The paint, as "#rrggbb", so two spellings of one color draw alike.
const hexOf = (color, fallback) => (rgbOf(color) ? shade(color, 0) : fallback);

/* ------------------------------------------------------------- styles */

// A style, in shares of the car's size: `aspect` its natural length over
// width, `paint` and `accent` its colors when none are given, `body` the
// shell (`w` its half width over half the car's, so the tires peek out past
// it; `nose` and `tail` the half width at each end over the full, `nl` and
// `tl` how far along the length the taper runs; `y0` and `y1` where along the
// length it starts and ends), `wheels` (`w` of the width, `l` of the length,
// `at` each axle along the length), `cabin` (`w` its half width over the
// body's; `ws` the windshield's front edge, `rf` and `rr` the roof's front and
// back, `rw` the rear window's back edge, along the length), `head` and
// `tails` the lamps' shape, and the flags for each type's extras.
const deep = (o) => {
  for (const v of Object.values(o)) if (v && typeof v === "object") deep(v);
  return Object.freeze(o);
};

export const CAR_STYLES = deep({
  planny: { aspect: 1.62, paint: "#206cc3", accent: "#f4f1ea", body: { w: 0.86, nose: 0.62, nl: 0.24, tail: 0.74, tl: 0.15 }, wheels: { w: 0.21, l: 0.19, at: [0.21, 0.79] }, cabin: { w: 0.8, ws: 0.27, rf: 0.33, rr: 0.8, rw: 0.84 }, head: "round", tails: "round", open: "planny" },
  hatch: { aspect: 1.62, paint: "#3fa34d", accent: "#f4f1ea", body: { w: 0.85, nose: 0.66, nl: 0.18, tail: 0.86, tl: 0.07 }, wheels: { w: 0.2, l: 0.17, at: [0.2, 0.8] }, cabin: { w: 0.84, ws: 0.27, rf: 0.39, rr: 0.84, rw: 0.93 }, head: "round", tails: "tall", rails: true },
  sedan: { aspect: 2.05, paint: "#3f6fb5", accent: "#f4f1ea", body: { w: 0.85, nose: 0.7, nl: 0.13, tail: 0.78, tl: 0.09 }, wheels: { w: 0.2, l: 0.15, at: [0.19, 0.8] }, cabin: { w: 0.84, ws: 0.29, rf: 0.41, rr: 0.64, rw: 0.75 }, head: "slim", tails: "wide", creases: true },
  coupe: { aspect: 1.95, paint: "#c0392b", accent: "#f4f1ea", body: { w: 0.85, nose: 0.55, nl: 0.2, tail: 0.68, tl: 0.13 }, wheels: { w: 0.21, l: 0.16, at: [0.2, 0.8] }, cabin: { w: 0.8, ws: 0.36, rf: 0.48, rr: 0.66, rw: 0.79 }, head: "slim", tails: "slim", sunroof: true },
  muscle: { aspect: 2.1, paint: "#e8590c", accent: "#f4f1ea", body: { w: 0.87, nose: 0.82, nl: 0.08, tail: 0.9, tl: 0.06 }, wheels: { w: 0.22, l: 0.16, at: [0.19, 0.81] }, cabin: { w: 0.78, ws: 0.38, rf: 0.48, rr: 0.66, rw: 0.76 }, head: "quad", tails: "bar", scoop: true, stripes: true },
  pickup: { aspect: 2.25, paint: "#8d5a3b", accent: "#d9d4ca", body: { w: 0.85, nose: 0.8, nl: 0.09, tail: 0.94, tl: 0.03 }, wheels: { w: 0.21, l: 0.14, at: [0.17, 0.8] }, cabin: { w: 0.86, ws: 0.27, rf: 0.36, rr: 0.5, rw: 0.54 }, head: "square", tails: "tall", bed: [0.57, 0.96] },
  van: { aspect: 2.0, paint: "#e6e3dc", accent: "#3f6fb5", body: { w: 0.88, nose: 0.78, nl: 0.1, tail: 0.92, tl: 0.04 }, wheels: { w: 0.2, l: 0.14, at: [0.16, 0.82] }, cabin: { w: 0.9, ws: 0.07, rf: 0.17, rr: 0.95, rw: 0.97 }, head: "square", tails: "tall", ridges: true },
  truck: { aspect: 2.0, paint: "#c62828", accent: "#f5b301", body: { w: 0.86, nose: 0.86, nl: 0.06, tail: 0.92, tl: 0.03, y0: 0, y1: 0.3 }, wheels: { w: 0.19, l: 0.12, at: [0.13, 0.72, 0.87] }, cabin: { w: 0.9, ws: 0.035, rf: 0.11, rr: 0.26, rw: 0.27 }, head: "square", tails: "tall", box: [0.315, 1] },
  police: { aspect: 2.05, paint: "#1d2233", accent: "#f4f1ea", body: { w: 0.85, nose: 0.7, nl: 0.13, tail: 0.8, tl: 0.09 }, wheels: { w: 0.2, l: 0.15, at: [0.19, 0.8] }, cabin: { w: 0.84, ws: 0.3, rf: 0.42, rr: 0.64, rw: 0.75 }, head: "slim", tails: "wide", doors: true, bar: true, push: true },
  racer: { aspect: 1.9, paint: "#7b2ff7", accent: "#ffd84a", body: { w: 0.8, nose: 0.34, nl: 0.32, tail: 0.86, tl: 0.07 }, wheels: { w: 0.24, l: 0.17, at: [0.22, 0.8] }, cabin: { w: 0.62, ws: 0.42, rf: 0.5, rr: 0.63, rw: 0.7 }, head: "slit", tails: "bar", spoiler: true, roundel: true },
  taxi: { aspect: 2.05, paint: "#ffc61a", accent: "#1d1a17", body: { w: 0.85, nose: 0.72, nl: 0.12, tail: 0.8, tl: 0.09 }, wheels: { w: 0.2, l: 0.15, at: [0.19, 0.8] }, cabin: { w: 0.84, ws: 0.29, rf: 0.41, rr: 0.64, rw: 0.75 }, head: "slim", tails: "wide", sign: true, checker: true },
  jeep: { aspect: 1.62, paint: "#5b7a3a", accent: "#2b2a27", body: { w: 0.84, nose: 0.9, nl: 0.05, tail: 0.94, tl: 0.03, y1: 0.9 }, wheels: { w: 0.23, l: 0.18, at: [0.19, 0.75] }, cabin: { w: 0.86, ws: 0.3, rf: 0.36, rr: 0.84, rw: 0.86 }, head: "round", tails: "tall", open: "jeep", spare: true, grille: true },
  monster: { aspect: 1.45, paint: "#2e7d32", accent: "#ffd84a", body: { w: 0.6, nose: 0.82, nl: 0.1, tail: 0.92, tl: 0.05, y0: 0.06, y1: 0.94 }, wheels: { w: 0.32, l: 0.3, at: [0.21, 0.79] }, cabin: { w: 0.86, ws: 0.3, rf: 0.39, rr: 0.55, rw: 0.59 }, head: "square", tails: "tall", bed: [0.62, 0.91], big: true, flames: true },
});

export const STYLE_NAMES = Object.freeze(Object.keys(CAR_STYLES));

// A style by name, or a style object as given; anything else is a sedan.
export function styleOf(style) {
  if (style && typeof style === "object" && style.body && style.wheels) return style;
  return CAR_STYLES[style] || CAR_STYLES.sedan;
}

// The length a style looks right at for a width `w` (1 by default: the
// aspect ratio itself).
export const carLength = (style, w = 1) => w * styleOf(style).aspect;

/* -------------------------------------------------------------- shapes */

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  else ctx.rect(x, y, w, h);
}

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
};

function star(ctx, x, y, outer, inner, spin = 0) {
  ctx.beginPath();
  for (let k = 0; k < 10; k++) {
    const a = spin - Math.PI / 2 + (k * Math.PI) / 5;
    const r = k % 2 ? inner : outer;
    if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    else ctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

// A rectangle `hx` by `hy` half sizes about (x, y), turned by `a`, as a path.
function quad(ctx, x, y, hx, hy, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  ctx.beginPath();
  for (const [k, [px, py]] of [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].entries()) {
    const qx = x + px * c - py * s;
    const qy = y + px * s + py * c;
    if (k) ctx.lineTo(qx, qy);
    else ctx.moveTo(qx, qy);
  }
  ctx.closePath();
}

// The shell's outline from `y0` to `y1`, `hw` half wide, narrowing to the
// style's nose and tail widths over its taper lengths.
function hull(ctx, y0, y1, hw, b) {
  const len = y1 - y0;
  const nl = Math.min(len * 0.45, len * b.nl * (1 / Math.max(0.01, (b.y1 ?? 1) - (b.y0 ?? 0))));
  const tl = Math.min(len * 0.45, len * b.tl * (1 / Math.max(0.01, (b.y1 ?? 1) - (b.y0 ?? 0))));
  const nw = hw * b.nose;
  const tw = hw * b.tail;
  ctx.beginPath();
  ctx.moveTo(-nw, y0);
  ctx.lineTo(nw, y0);
  ctx.quadraticCurveTo(hw, y0, hw, y0 + nl);
  ctx.lineTo(hw, y1 - tl);
  ctx.quadraticCurveTo(hw, y1, tw, y1);
  ctx.lineTo(-tw, y1);
  ctx.quadraticCurveTo(-hw, y1, -hw, y1 - tl);
  ctx.lineTo(-hw, y0 + nl);
  ctx.quadraticCurveTo(-hw, y0, -nw, y0);
  ctx.closePath();
}

/* --------------------------------------------------------------- parts */

// A tire at each end of each axle, its outer face on the box's edge, with
// tread across it; the front pair turned with the steering (pulled in, and
// back from the nose, so a turned tire still stays inside the box).
function tires(ctx, s, w, h, steer) {
  const hx = (w * s.wheels.w) / 2;
  const hy = (h * s.wheels.l) / 2;
  s.wheels.at.forEach((f, i) => {
    const a = i === 0 ? steer : 0;
    const ex = hx * Math.cos(a) + hy * Math.abs(Math.sin(a));
    const ey = hy * Math.cos(a) + hx * Math.abs(Math.sin(a));
    const y = Math.min(h / 2 - ey, Math.max(-h / 2 + ey, -h / 2 + f * h));
    for (const side of [-1, 1]) {
      const x = side * (w / 2 - ex);
      quad(ctx, x, y, hx, hy, a);
      ctx.fillStyle = TIRE;
      ctx.fill();
      // Tread across the tire (chunkier on a monster), turned with it.
      const c = Math.cos(a);
      const sn = Math.sin(a);
      const n = s.big ? 2 : 1;
      ctx.strokeStyle = TREAD;
      ctx.lineWidth = hy * (s.big ? 0.12 : 0.16);
      ctx.beginPath();
      for (let k = -n; k <= n; k++) {
        const ty = (k * hy * 0.66) / n;
        ctx.moveTo(x - hx * 0.8 * c - ty * sn, y - hx * 0.8 * sn + ty * c);
        ctx.lineTo(x + hx * 0.8 * c - ty * sn, y + hx * 0.8 * sn + ty * c);
      }
      ctx.stroke();
    }
  });
}

// The shell in three flat coats: the darker edge, the paint inset from it,
// and a sheen down the middle that leans with the roll.
function shell(ctx, y0, y1, hw, b, paint, lw, dx) {
  hull(ctx, y0, y1, hw, b);
  ctx.fillStyle = shade(paint, -0.3);
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw;
  ctx.stroke();
  const i = Math.min(hw * 0.15, (y1 - y0) * 0.05);
  hull(ctx, y0 + i * 0.7, y1 - i * 0.7, hw - i, b);
  ctx.fillStyle = paint;
  ctx.fill();
  roundRect(ctx, -hw * 0.45 + dx, y0 + (y1 - y0) * 0.05, hw * 0.55, (y1 - y0) * 0.9, hw * 0.25);
  ctx.fillStyle = SHEEN;
  ctx.fill();
}

// The glass house: a windshield, side windows and a rear window in one
// shape, then the roof over it (rounded, a touch lighter than the paint) and
// a glint across the windshield. `dx` shifts it all with the roll.
function cabin(ctx, c, hw, Y, roof, lw, dx) {
  const cw = hw * c.w;
  const ys = Y(c.ws);
  const yf = Y(c.rf);
  const yr = Y(c.rr);
  const yw = Y(c.rw);
  ctx.beginPath();
  ctx.moveTo(-cw * 0.8 + dx, ys);
  ctx.lineTo(cw * 0.8 + dx, ys);
  ctx.quadraticCurveTo(cw + dx, ys, cw + dx, yf);
  ctx.lineTo(cw * 0.97 + dx, yr);
  ctx.quadraticCurveTo(cw * 0.97 + dx, yw, cw * 0.78 + dx, yw);
  ctx.lineTo(-cw * 0.78 + dx, yw);
  ctx.quadraticCurveTo(-cw * 0.97 + dx, yw, -cw * 0.97 + dx, yr);
  ctx.lineTo(-cw + dx, yf);
  ctx.quadraticCurveTo(-cw + dx, ys, -cw * 0.8 + dx, ys);
  ctx.closePath();
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
  const rw = cw * 0.74;
  roundRect(ctx, -rw + dx * 1.3, yf, rw * 2, yr - yf, rw * 0.35);
  ctx.fillStyle = roof;
  ctx.fill();
  ctx.lineWidth = lw * 0.6;
  ctx.stroke();
  // The glint: a slanted band on the windshield's left, a sliver on the back.
  const t = yf - ys;
  ctx.beginPath();
  ctx.moveTo(-cw * 0.62 + dx, ys + t * 0.22);
  ctx.lineTo(-cw * 0.2 + dx, ys + t * 0.22);
  ctx.lineTo(-cw * 0.42 + dx, yf - t * 0.18);
  ctx.lineTo(-cw * 0.78 + dx, yf - t * 0.18);
  ctx.closePath();
  ctx.fillStyle = GLINT;
  ctx.fill();
  if (yw - yr > 0.02) {
    ctx.fillRect(-cw * 0.55 + dx, yr + (yw - yr) * 0.3, cw * 0.35, (yw - yr) * 0.3);
  }
  return { cw, rw, ys, yf, yr, yw };
}

// Side mirrors: a small nub each side just behind the windshield's foot.
function mirrors(ctx, hw, w, y, paint) {
  const m = Math.min(w * 0.07, w / 2 - hw);
  ctx.fillStyle = shade(paint, -0.4);
  for (const side of [-1, 1]) {
    roundRect(ctx, side > 0 ? hw - m * 0.3 : -hw - m * 0.7, y, m, w * 0.07, m * 0.4);
    ctx.fill();
  }
}

// The lamps: headlights at the nose, taillights at the tail (brighter, with
// a glow, while braking), each in the style's shape.
function lamps(ctx, s, hw, y0, y1, h, lw, brake) {
  const b = s.body;
  const near = (w) => (w + (hw - w) * 0.35) * 0.72;
  const hx = near(hw * b.nose);
  const tx = near(hw * b.tail);
  const lh = h * 0.035;
  const head = s.head;
  ctx.fillStyle = HEAD;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw * 0.5;
  for (const side of [-1, 1]) {
    if (head === "round") circle(ctx, side * hx, y0 + lh * 1.3, lh * 0.95);
    else if (head === "quad") {
      circle(ctx, side * hx, y0 + lh * 1.2, lh * 0.7);
      ctx.fill();
      ctx.stroke();
      circle(ctx, side * (hx - lh * 1.5), y0 + lh * 1.2, lh * 0.7);
    } else if (head === "slit") roundRect(ctx, side * hx - hw * 0.18, y0 + lh * 1.6, hw * 0.36, lh * 0.7, lh * 0.35);
    else if (head === "square") roundRect(ctx, side * hx - hw * 0.14, y0 + lh * 0.5, hw * 0.28, lh * 1.1, lh * 0.25);
    else roundRect(ctx, side * hx - hw * 0.17, y0 + lh * 0.7, hw * 0.34, lh * 0.9, lh * 0.4);
    ctx.fill();
    ctx.stroke();
  }
  const tails = s.tails;
  const ty = y1 - lh * 1.15;
  if (brake) {
    ctx.fillStyle = TAIL_GLOW;
    roundRect(ctx, -tx - hw * 0.3, y1 - lh * 3, tx * 2 + hw * 0.6, lh * 3, lh * 1.2);
    ctx.fill();
  }
  ctx.fillStyle = brake ? TAIL_ON : TAIL;
  if (tails === "bar") {
    roundRect(ctx, -tx - hw * 0.12, ty, (tx + hw * 0.12) * 2, lh * 0.8, lh * 0.4);
    ctx.fill();
    ctx.stroke();
    return;
  }
  for (const side of [-1, 1]) {
    if (tails === "round") circle(ctx, side * tx, ty + lh * 0.2, lh * 0.75);
    else if (tails === "tall") roundRect(ctx, side * (tx + hw * 0.1) - hw * 0.08, ty - lh * 0.8, hw * 0.16, lh * 1.8, lh * 0.3);
    else if (tails === "slim") roundRect(ctx, side * tx - hw * 0.15, ty, hw * 0.3, lh * 0.65, lh * 0.3);
    else roundRect(ctx, side * tx - hw * 0.2, ty - lh * 0.1, hw * 0.4, lh * 0.9, lh * 0.35);
    ctx.fill();
    ctx.stroke();
  }
}

// Headlight beams on the road ahead, for the night stages: a faint wide
// cone and a brighter core from each lamp.
function beams(ctx, s, hw, w, h) {
  const y0 = -h / 2;
  const hx = (hw * s.body.nose + (hw - hw * s.body.nose) * 0.35) * 0.72;
  const far = y0 - h * MARGINS.beamAhead;
  const out = w / 2 + w * MARGINS.beamSide;
  for (const [fill, spread, reach] of [
    [BEAM, 1, 1],
    [BEAM_CORE, 0.45, 0.7],
  ]) {
    ctx.fillStyle = fill;
    const end = y0 + (far - y0) * reach;
    for (const side of [-1, 1]) {
      // From the lamp, fanning out ahead, the far end rounded.
      const outer = side * Math.min(out, hx + (out - hx) * spread);
      const inner = side * Math.max(0, hx - (out - hx) * spread * 0.4);
      ctx.beginPath();
      ctx.moveTo(side * hx - hw * 0.1, y0 + h * 0.03);
      ctx.lineTo(side * hx + hw * 0.1, y0 + h * 0.03);
      ctx.lineTo(outer, end + h * 0.25 * reach);
      ctx.quadraticCurveTo((outer + inner) / 2, end, inner, end + h * 0.25 * reach);
      ctx.closePath();
      ctx.fill();
    }
  }
}

// An exhaust flame behind the tail, flickering with the clock: orange
// outside, yellow, then white at the root.
function flame(ctx, s, hw, h, clock) {
  const y1 = h / 2;
  const pipes = s.stripes || s.spoiler || s.big ? [-hw * 0.4, hw * 0.4] : [hw * 0.45];
  const r = hw * (pipes.length > 1 ? 0.24 : 0.3);
  pipes.forEach((x, i) => {
    const flick = 0.78 + 0.22 * Math.sin(clock / 37 + i * 2.1) * Math.sin(clock / 23 + i);
    const len = h * MARGINS.flame * flick;
    for (const [fill, k] of [
      ["#ff7a1a", 1],
      ["#ffd84a", 0.62],
      ["#fff6d6", 0.3],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - r * k, y1 - h * 0.02);
      ctx.quadraticCurveTo(x - r * k, y1 + len * k * 0.5, x, y1 + len * k);
      ctx.quadraticCurveTo(x + r * k, y1 + len * k * 0.5, x + r * k, y1 - h * 0.02);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
  });
}

/* --------------------------------------------------- each type's extras */

// Two racing stripes in the accent from `y0` to `y1`, shifted with the roll.
function stripes(ctx, y0, y1, w, accent, dx = 0) {
  ctx.fillStyle = accent;
  ctx.fillRect(-w * 0.13 + dx, y0, w * 0.08, y1 - y0);
  ctx.fillRect(w * 0.05 + dx, y0, w * 0.08, y1 - y0);
}

// The open seats of Planny's convertible or the jeep: a windscreen, the
// tub, a seat back, and for the jeep two seats and a roll bar across.
function tub(ctx, s, hw, Y, paint, lw, dx) {
  const c = s.cabin;
  const cw = hw * c.w;
  // A low windscreen in its frame.
  roundRect(ctx, -cw + dx * 0.5, Y(c.ws), cw * 2, Y(c.rf) - Y(c.ws), cw * 0.2);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw * 0.7;
  ctx.stroke();
  ctx.fillStyle = GLINT;
  ctx.fillRect(-cw * 0.7 + dx * 0.5, Y(c.ws) + (Y(c.rf) - Y(c.ws)) * 0.3, cw * 0.5, (Y(c.rf) - Y(c.ws)) * 0.3);
  roundRect(ctx, -cw * 0.92 + dx, Y(c.rf) + lw, cw * 1.84, Y(c.rr) - Y(c.rf) - lw, cw * 0.3);
  // The tub: cream leather in Planny's car, so his dark arms show, dark in the jeep.
  ctx.fillStyle = s.open === "jeep" ? "#2b2522" : "#d9c8a9";
  ctx.fill();
  ctx.stroke();
  if (s.open === "jeep") {
    // Two seats, then the roll bar over them.
    ctx.fillStyle = "#4a423d";
    for (const side of [-1, 1]) {
      roundRect(ctx, side * cw * 0.46 - cw * 0.32 + dx, Y(c.rf + 0.12), cw * 0.64, Y(c.rf + 0.28) - Y(c.rf + 0.12), cw * 0.12);
      ctx.fill();
    }
    ctx.fillStyle = "#4a423d";
    roundRect(ctx, -cw * 0.78 + dx, Y(c.rr - 0.16), cw * 1.56, Y(c.rr - 0.04) - Y(c.rr - 0.16), cw * 0.1);
    ctx.fill();
    ctx.strokeStyle = "#c9ccd2";
    ctx.lineWidth = lw * 1.6;
    ctx.lineCap = "round";
    ctx.beginPath();
    const yb = Y(c.rf + 0.34);
    ctx.moveTo(-cw * 0.95 + dx * 1.4, yb);
    ctx.lineTo(cw * 0.95 + dx * 1.4, yb);
    ctx.moveTo(-cw * 0.9 + dx * 1.4, yb);
    ctx.lineTo(-cw * 0.9 + dx, Y(c.rr) - lw);
    ctx.moveTo(cw * 0.9 + dx * 1.4, yb);
    ctx.lineTo(cw * 0.9 + dx, Y(c.rr) - lw);
    ctx.stroke();
    return;
  }
  // Planny's seat back, in a deeper shade of the paint.
  roundRect(ctx, -cw * 0.75 + dx, Y(c.rr - 0.11), cw * 1.5, Y(c.rr - 0.01) - Y(c.rr - 0.11), cw * 0.2);
  ctx.fillStyle = shade(paint, -0.45);
  ctx.fill();
}

// Planny in his seat, upright so his star eye always shows: his box head,
// arms to the steering wheel across the foot of his box (or `up`, or `down`), and a little "o" of a
// mouth while dazed. The star is in `o.star`, his box in `o.face`.
function planny(ctx, s, w, h, Y, o) {
  const c = s.cabin;
  const S = Math.min(w * 0.21, h * 0.13);
  const by = Y(c.rf + (c.rr - c.rf) * 0.68);
  const bx = o.dx;
  const wheelY = by + S * 0.8;
  const lw = Math.max(0.05, S * 0.17);
  ctx.strokeStyle = o.ink;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (o.arms === "up") {
    const wave = Math.sin(o.clock / 90) * S * 0.25;
    ctx.moveTo(bx - S, by - S * 0.2);
    ctx.lineTo(bx - S * 1.45, by - S * 1.9 + wave);
    ctx.moveTo(bx + S, by - S * 0.2);
    ctx.lineTo(bx + S * 1.45, by - S * 1.9 - wave);
  } else if (o.arms === "down") {
    ctx.moveTo(bx - S, by + S * 0.2);
    ctx.lineTo(bx - S * 1.2, by + S * 1.1);
    ctx.moveTo(bx + S, by + S * 0.2);
    ctx.lineTo(bx + S * 1.2, by + S * 1.1);
  }
  ctx.stroke();
  roundRect(ctx, bx - S, by - S, S * 2, S * 2, S * 0.35);
  ctx.fillStyle = o.face;
  ctx.fill();
  ctx.strokeStyle = o.ink;
  ctx.lineWidth = lw * 0.75;
  ctx.stroke();
  star(ctx, bx, by - S * 0.22, S * 0.6, S * 0.26, o.dazed ? o.clock / 60 : 0);
  ctx.fillStyle = o.star;
  ctx.fill();
  // A firm ink edge, so a pale highlight still reads on the white box.
  ctx.lineJoin = "round";
  ctx.lineWidth = lw * 0.75;
  ctx.stroke();
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  if (o.dazed) ctx.arc(bx, by + S * 0.55, S * 0.16, 0, TAU);
  else ctx.arc(bx, by + S * 0.3, S * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  if (o.arms === "up" || o.arms === "down") return;
  // Driving: he faces you over the wheel, a short bar across the foot of
  // his box, his arms straight from his sides to its ends.
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    ctx.moveTo(bx + side * S, by + S * 0.05);
    ctx.lineTo(bx + side * S * 0.62, wheelY);
  }
  ctx.stroke();
  roundRect(ctx, bx - S * 0.72, wheelY - S * 0.13, S * 1.44, S * 0.26, S * 0.13);
  ctx.fillStyle = o.ink;
  ctx.fill();
}

// The police light bar across the roof: red one side, blue the other, each
// lit in turn on the siren's clock with a halo on the road around it.
function lightBar(ctx, cw, y, h, lw, siren, dx) {
  const bh = h * 0.05;
  const on = Number.isFinite(siren) ? (Math.floor(siren / 160) % 2 ? 1 : -1) : 0;
  if (on) {
    ctx.fillStyle = on < 0 ? "rgba(255, 45, 45, 0.38)" : "rgba(45, 107, 255, 0.38)";
    circle(ctx, on * cw * 0.5 + dx, y + bh / 2, cw * 0.62);
    ctx.fill();
  }
  roundRect(ctx, -cw * 0.95 + dx, y, cw * 1.9, bh, bh * 0.4);
  ctx.fillStyle = "#2a2d34";
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = lw * 0.5;
  ctx.stroke();
  ctx.fillStyle = on < 0 ? SIREN_RED : shade(SIREN_RED, -0.45);
  ctx.fillRect(-cw * 0.88 + dx, y + bh * 0.2, cw * 0.82, bh * 0.6);
  ctx.fillStyle = on > 0 ? SIREN_BLUE : shade(SIREN_BLUE, -0.45);
  ctx.fillRect(cw * 0.06 + dx, y + bh * 0.2, cw * 0.82, bh * 0.6);
}

// The racer's number roundel on the hood.
function roundel(ctx, x, y, r, number, accent, lw) {
  circle(ctx, x, y, r);
  ctx.fillStyle = "#f4f1ea";
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = lw * 0.9;
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.font = `800 ${r * 1.3}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), x, y + r * 0.08, r * 1.6);
}

// Damage: scratches on the paint, a crack across the windshield past a
// third, and smoke curling off the hood past two thirds.
function scuffs(ctx, damage, hw, h, Y, cab, lw, clock) {
  const n = Math.ceil(damage * 4);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
  ctx.lineWidth = lw * 0.45;
  ctx.beginPath();
  for (let k = 0; k < n; k++) {
    const side = k % 2 ? 1 : -1;
    const y = Y(0.14 + k * 0.19);
    ctx.moveTo(side * hw * 0.82, y);
    ctx.lineTo(side * hw * 0.45, y + h * 0.05);
    ctx.lineTo(side * hw * 0.58, y + h * 0.06);
  }
  ctx.stroke();
  // A dent: a dark smudge on the front corner.
  ctx.fillStyle = `rgba(0, 0, 0, ${0.12 + damage * 0.18})`;
  circle(ctx, hw * 0.55, Y(0.1), Math.min(hw * 0.22, h * 0.09) * damage);
  ctx.fill();
  if (damage > 0.33 && cab) {
    const cx = -cab.cw * 0.2;
    const cy = cab.ys + (cab.yf - cab.ys) * 0.5;
    const t = cab.yf - cab.ys;
    ctx.strokeStyle = "rgba(240, 248, 255, 0.85)";
    ctx.lineWidth = lw * 0.35;
    ctx.beginPath();
    for (const [ax, ay] of [[-0.6, -0.4], [0.7, -0.35], [0.5, 0.45], [-0.45, 0.42], [0.05, -0.48]]) {
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + ax * cab.cw * 0.8, cy + ay * t);
    }
    ctx.stroke();
  }
  if (damage > 0.66) {
    for (let k = 0; k < 3; k++) {
      const p = ((clock / 700 + k / 3) % 1 + 1) % 1;
      // Each puff rises off the hood and drifts back over the car as it fades.
      // Capped by the length too, so a short wide car keeps its smoke inside.
      const r = Math.min(hw * (0.22 + p * 0.3), h * (0.13 + p * 0.3));
      const x = Math.sin(clock / 400 + k * 2) * hw * 0.3;
      const y = Y(0.14 + p * 0.3);
      ctx.fillStyle = `rgba(52, 52, 56, ${0.62 * (1 - p)})`;
      circle(ctx, x, y, r);
      ctx.fill();
      ctx.fillStyle = `rgba(190, 190, 196, ${0.45 * (1 - p)})`;
      circle(ctx, x - r * 0.25, y - r * 0.25, r * 0.5);
      ctx.fill();
    }
  }
}

// Dazed: three small stars wheeling over a flattened car, and creases.
function dazed(ctx, w, h, clock, lw) {
  ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  for (const f of [-0.2, 0.05, 0.28]) {
    ctx.moveTo(-w * 0.32, f * h);
    ctx.lineTo(-w * 0.05, f * h + h * 0.03);
    ctx.lineTo(w * 0.32, f * h - h * 0.02);
  }
  ctx.stroke();
  for (let k = 0; k < 3; k++) {
    const a = clock / 260 + (k * TAU) / 3;
    star(ctx, Math.cos(a) * w * 0.28, Math.sin(a) * h * 0.14, w * 0.12, w * 0.05, a);
    ctx.fillStyle = "#ffd84a";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = lw * 0.4;
    ctx.stroke();
  }
}

/* ---------------------------------------------------------------- the car */

const num = (v, lo, hi, d) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
// A size: a positive finite number, else the default.
const size = (v, d) => (Number.isFinite(v) && v > 0 ? Math.min(v, 1e6) : d);

// The size and the pancake and lift factors opts ask for.
function frame(s, opts) {
  const w = size(opts.w, 4.2);
  const h = size(opts.h, w * s.aspect);
  const squash = num(opts.squash, 0, 1, 0);
  const air = num(opts.air, 0, 1, 0);
  return { w, h, squash, air, sx: 1 + MARGINS.squashW * squash, sy: 1 - MARGINS.squashH * squash, k: 1 + MARGINS.lift * air };
}

// The shadow on the road, under where the car would sit, in the frame the
// caller set up (no save or restore of its own).
// `turn` (radians), when given, turns the footprint about its own middle
// once it is offset, so a turned car's shadow keeps its shape but still
// falls down and right of it.
function shadowOf(ctx, f, turn = 0) {
  const lift = 1 - 0.1 * f.air;
  const ox = f.w * (0.04 + MARGINS.shadowX * f.air);
  const oy = f.h * (0.05 + MARGINS.shadowY * f.air);
  const hx = (f.w / 2) * f.sx * lift;
  const hy = (f.h / 2) * f.sy * lift;
  if (turn) {
    ctx.translate(ox, oy);
    if (typeof ctx.rotate === "function") ctx.rotate(turn);
    roundRect(ctx, -hx, -hy, hx * 2, hy * 2, f.w * 0.3);
  } else roundRect(ctx, ox - hx, oy - hy, hx * 2, hy * 2, f.w * 0.3);
  ctx.fillStyle = `rgba(0, 0, 0, ${0.28 - 0.12 * f.air})`;
  ctx.fill();
}

// Only a car's shadow, as drawCarBody() would draw it (the same w, h,
// squash and air), wrapped in its own save() and restore(). Draw every
// car's shadow this way first, at the car's place but not turned with it
// (pass the car's heading as `opts.turn`, in radians, to turn the
// footprint itself), then the bodies with `shadow: false`. carReach()'s
// shadow figures are for no turn; a turned footprint reaches out by its
// own turned half sizes from the offset middle.
export function drawCarShadow(ctx, style, opts) {
  opts = opts ?? {};
  ctx.save();
  shadowOf(ctx, frame(styleOf(style), opts), Number.isFinite(opts.turn) ? opts.turn : 0);
  ctx.restore();
}

// The extents a car drawn with `opts` reaches from its middle, in the
// caller's units: { left, right, top, bottom }, each a distance (top is how
// far ahead of the middle, bottom how far behind). With no options, w / 2
// and h / 2 (plus the resting shadow's small offset right and down, unless
// `shadow` is false).
export function carReach(style, opts) {
  opts = opts ?? {};
  const { w, h, air, sx, sy, k } = frame(styleOf(style), opts);
  const side = (w / 2 + (opts.lights ? w * MARGINS.beamSide : 0)) * sx * k;
  const top = (h / 2 + (opts.lights ? h * MARGINS.beamAhead : 0)) * sy * k;
  const back = (h / 2 + (opts.boost ? h * MARGINS.flame : 0)) * sy * k;
  const shadowX = w * (0.04 + MARGINS.shadowX * air) + (w / 2) * sx;
  const shadowY = h * (0.05 + MARGINS.shadowY * air) + (h / 2) * sy;
  if (opts.shadow === false) return { left: side, right: side, top, bottom: back };
  return { left: side, right: Math.max(side, shadowX), top, bottom: Math.max(back, shadowY) };
}

// One car about the origin, nose up. `style` is a name in CAR_STYLES or a
// style object; `opts` as the header lists, plus `accent` (stripes, trim),
// `star`, `face` and `ink` (Planny's star eye, box and lines), `arms`
// ("wheel", "up" or "down", Planny's), `number` (the racer's roundel) and
// `clock` (ms, for anything that moves); `shadow: false` leaves the shadow
// to drawCarShadow().
export function drawCarBody(ctx, style, opts) {
  opts = opts ?? {};
  const s = styleOf(style);
  const f = frame(s, opts);
  const { w, h, squash, sx, sy, k } = f;
  const tilt = num(opts.tilt, -1, 1, 0);
  const damage = num(opts.damage, 0, 1, 0);
  const clock = Number.isFinite(opts.clock) ? opts.clock : Number.isFinite(opts.siren) ? opts.siren : 0;
  const paint = hexOf(opts.color, s.paint);
  const accent = hexOf(opts.accent, s.accent);
  const lw = Math.max(0.04, Math.min(w, h / 1.6) * 0.055);
  const b = s.body;
  const hw = (w / 2) * b.w;
  const Y = (f) => -h / 2 + f * h;
  const y0 = Y(b.y0 ?? 0);
  const y1 = Y(b.y1 ?? 1);
  // Roll: the roof and the sheen lean out of the turn.
  const dx = -tilt * w * 0.07;

  ctx.save();
  if (opts.shadow !== false) shadowOf(ctx, f);
  ctx.scale(k * sx, k * sy);
  if (opts.lights) beams(ctx, s, hw, w, h);
  if (opts.boost) flame(ctx, s, hw, h, clock);
  if (s.big) {
    // The monster's axles and springs under the body.
    ctx.fillStyle = "#3a3a40";
    for (const f of s.wheels.at) ctx.fillRect(-w * 0.4, Y(f) - h * 0.025, w * 0.8, h * 0.05);
  }
  tires(ctx, s, w, h, tilt * 0.3);
  shell(ctx, y0, y1, hw, b, paint, lw, dx);
  if (s.creases) {
    // Hood lines from the windshield to the nose.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
    ctx.lineWidth = lw * 0.5;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.45, Y(s.cabin.ws));
    ctx.lineTo(-hw * 0.35, y0 + h * 0.04);
    ctx.moveTo(hw * 0.45, Y(s.cabin.ws));
    ctx.lineTo(hw * 0.35, y0 + h * 0.04);
    ctx.stroke();
  }
  if (s.doors) {
    // Police doors in white, the length of the cabin.
    ctx.fillStyle = "#f4f1ea";
    roundRect(ctx, -hw * 0.93, Y(s.cabin.ws + 0.05), hw * 1.86, Y(s.cabin.rw - 0.03) - Y(s.cabin.ws + 0.05), hw * 0.2);
    ctx.fill();
  }
  if (s.checker) {
    // The checker strip along each side.
    const n = 7;
    const y = Y(s.cabin.ws + 0.04);
    const step = (Y(s.cabin.rw - 0.02) - y) / n;
    // Two paths, one per color, each a run of squares down both sides.
    for (const odd of [0, 1]) {
      ctx.beginPath();
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i++) {
          for (let j = 0; j < 2; j++) if ((i + j) % 2 === odd) ctx.rect(side > 0 ? hw * (0.74 + j * 0.11) : -hw * (0.96 - j * 0.11), y + i * step, hw * 0.11, step);
        }
      }
      ctx.fillStyle = odd ? "#f4f1ea" : accent;
      ctx.fill();
    }
  }
  if (s.stripes) stripes(ctx, y0 + h * 0.01, y1 - h * 0.01, w, accent);
  if (s.flames) {
    // A jagged decal on the hood, in the accent.
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.7, Y(0.1));
    for (let i = 0; i <= 6; i++) ctx.lineTo(-hw * 0.7 + (i * hw * 1.4) / 6, i % 2 ? Y(s.cabin.ws - 0.02) : Y(0.19));
    ctx.lineTo(hw * 0.7, Y(0.1));
    ctx.closePath();
    ctx.fill();
  }
  if (s.scoop) {
    roundRect(ctx, -hw * 0.3, Y(0.15), hw * 0.6, h * 0.12, hw * 0.12);
    ctx.fillStyle = shade(paint, -0.2);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = lw * 0.5;
    ctx.stroke();
    ctx.fillStyle = "#151517";
    ctx.fillRect(-hw * 0.2, Y(0.165), hw * 0.4, h * 0.03);
  }
  if (s.grille) {
    // The jeep's flat grille slots along the nose.
    ctx.fillStyle = shade(paint, -0.5);
    for (let i = -2; i <= 2; i++) ctx.fillRect(i * hw * 0.12 - hw * 0.03, y0 + h * 0.015, hw * 0.06, h * 0.05);
  }
  if (s.push) {
    // A push bar over the police nose.
    roundRect(ctx, -hw * 0.6, y0, hw * 1.2, h * 0.035, h * 0.015);
    ctx.fillStyle = "#2a2d34";
    ctx.fill();
  }
  if (s.bed) {
    // An open bed: its floor with ribs, the walls the body around it.
    const by0 = Y(s.bed[0]);
    const by1 = Y(s.bed[1]);
    roundRect(ctx, -hw * 0.8, by0, hw * 1.6, by1 - by0, hw * 0.1);
    ctx.fillStyle = shade(paint, -0.5);
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = lw * 0.5;
    ctx.stroke();
    ctx.strokeStyle = shade(paint, -0.25);
    ctx.beginPath();
    for (const f of [-0.4, 0, 0.4]) {
      ctx.moveTo(f * hw, by0 + h * 0.02);
      ctx.lineTo(f * hw, by1 - h * 0.02);
    }
    ctx.stroke();
  }
  let cab = null;
  if (s.open) tub(ctx, s, hw, Y, paint, lw, dx);
  else cab = cabin(ctx, s.cabin, hw, Y, s.doors ? "#f4f1ea" : shade(paint, 0.12), lw, dx);
  if (!s.open) mirrors(ctx, hw, w, Y(s.cabin.ws) + (Y(s.cabin.rf) - Y(s.cabin.ws)) * 0.15, paint);
  if (s.box) {
    // The box truck's cargo box: its roof, ribs across, a band in the paint.
    const by0 = Y(s.box[0]);
    const by1 = Y(s.box[1]);
    const bw = w / 2 - w * s.wheels.w * 0.42;
    roundRect(ctx, -bw, by0, bw * 2, by1 - by0, bw * 0.12);
    ctx.fillStyle = "#c9cbd1";
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = lw;
    ctx.stroke();
    roundRect(ctx, -bw * 0.9, by0 + h * 0.012, bw * 1.8, by1 - by0 - h * 0.024, bw * 0.08);
    ctx.fillStyle = "#e7e6e1";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.14)";
    ctx.lineWidth = lw * 0.5;
    ctx.beginPath();
    for (let i = 1; i < 7; i++) {
      const y = by0 + ((by1 - by0) * i) / 7;
      ctx.moveTo(-bw * 0.9, y);
      ctx.lineTo(bw * 0.9, y);
    }
    ctx.stroke();
    ctx.fillStyle = paint;
    ctx.fillRect(-bw * 0.9, by0 + h * 0.012, bw * 0.16, by1 - by0 - h * 0.024);
    ctx.fillRect(bw * 0.74, by0 + h * 0.012, bw * 0.16, by1 - by0 - h * 0.024);
    ctx.fillStyle = accent;
    ctx.fillRect(-bw * 0.74, by0 + h * 0.012, bw * 0.05, by1 - by0 - h * 0.024);
    ctx.fillRect(bw * 0.69, by0 + h * 0.012, bw * 0.05, by1 - by0 - h * 0.024);
  }
  if (cab) {
    if (s.stripes) stripes(ctx, cab.yf + lw * 0.4, cab.yr - lw * 0.4, w, accent, dx * 1.3);
    if (s.sunroof) {
      roundRect(ctx, -cab.rw * 0.55 + dx * 1.3, cab.yf + (cab.yr - cab.yf) * 0.18, cab.rw * 1.1, (cab.yr - cab.yf) * 0.5, cab.rw * 0.15);
      ctx.fillStyle = GLASS;
      ctx.fill();
    }
    if (s.rails) {
      ctx.fillStyle = "#3a3d44";
      ctx.fillRect(-cab.rw * 0.82 + dx * 1.3, cab.yf + h * 0.02, cab.rw * 0.1, cab.yr - cab.yf - h * 0.04);
      ctx.fillRect(cab.rw * 0.72 + dx * 1.3, cab.yf + h * 0.02, cab.rw * 0.1, cab.yr - cab.yf - h * 0.04);
    }
    if (s.ridges) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
      ctx.lineWidth = lw * 0.6;
      ctx.beginPath();
      for (let i = 1; i < 5; i++) {
        const y = cab.yf + ((cab.yr - cab.yf) * i) / 5;
        ctx.moveTo(-cab.rw * 0.8 + dx * 1.3, y);
        ctx.lineTo(cab.rw * 0.8 + dx * 1.3, y);
      }
      ctx.stroke();
    }
    if (s.sign) {
      const sy0 = cab.yf + (cab.yr - cab.yf) * 0.36;
      roundRect(ctx, -cab.rw * 0.55 + dx * 1.3, sy0, cab.rw * 1.1, h * 0.05, h * 0.012);
      ctx.fillStyle = "#fff3c4";
      ctx.fill();
      ctx.strokeStyle = LINE;
      ctx.lineWidth = lw * 0.5;
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.fillRect(-cab.rw * 0.35 + dx * 1.3, sy0 + h * 0.019, cab.rw * 0.7, h * 0.012);
    }
    if (s.bar || Number.isFinite(opts.siren)) lightBar(ctx, cab.rw, cab.yf + (cab.yr - cab.yf) * 0.3, h, lw, opts.siren, dx * 1.3);
  }
  if (s.spoiler) {
    // The racer's wing across the tail, on two posts.
    ctx.fillStyle = shade(paint, -0.45);
    ctx.fillRect(-w * 0.22, Y(0.9), w * 0.05, h * 0.06);
    ctx.fillRect(w * 0.17, Y(0.9), w * 0.05, h * 0.06);
    roundRect(ctx, -w * 0.44, Y(0.93), w * 0.88, h * 0.065, h * 0.02);
    ctx.fillStyle = accent;
    ctx.fill();
    ctx.strokeStyle = LINE;
    ctx.lineWidth = lw * 0.7;
    ctx.stroke();
  }
  if (s.roundel) roundel(ctx, 0, Y(0.2), Math.min(hw * 0.42, h * 0.08), Number.isFinite(opts.number) ? Math.min(99, Math.max(0, Math.round(opts.number))) : 7, accent, lw);
  if (s.spare) {
    // The jeep's spare on its tailgate.
    const r = Math.min(hw * 0.42, h * 0.1);
    circle(ctx, 0, h / 2 - r, r);
    ctx.fillStyle = TIRE;
    ctx.fill();
    circle(ctx, 0, h / 2 - r, r * 0.5);
    ctx.fillStyle = RIM;
    ctx.fill();
    circle(ctx, 0, h / 2 - r, r * 0.18);
    ctx.fillStyle = TIRE;
    ctx.fill();
  }
  if (s.open && Number.isFinite(opts.siren)) {
    // A siren on an open car: the bar on the jeep's roll bar, or across
    // Planny's rear deck behind his seat.
    const cw = hw * s.cabin.w;
    lightBar(ctx, cw * 0.8, s.open === "jeep" ? Y(s.cabin.rf + 0.34) - h * 0.025 : Y(s.cabin.rr + 0.01), h, lw, opts.siren, dx);
  }
  // The lamps last of the body, so no wing, spare or bar ever hides them.
  lamps(ctx, s, hw, y0, s.box ? Y(1) : y1, h, lw, !!opts.brake);
  if (s.open === "planny") {
    planny(ctx, s, w, h, Y, {
      dx,
      clock,
      star: hexOf(opts.star, "#206cc3"),
      face: hexOf(opts.face, "#ffffff"),
      ink: hexOf(opts.ink, INK),
      arms: opts.arms === "up" || opts.arms === "down" ? opts.arms : "wheel",
      dazed: squash > 0.2 || damage > 0.66,
    });
  }
  if (damage > 0) scuffs(ctx, damage, hw, h, Y, cab, lw, clock);
  if (squash > 0.2) dazed(ctx, w, h, clock, lw);
  ctx.restore();
}
