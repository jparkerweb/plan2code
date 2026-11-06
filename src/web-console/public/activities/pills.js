// Plan2Code Web Console - the pills every game but Mini golf draws along its top: one opaque dark backing, a timer's tint, and text in the pill's own color lifted toward white just as far as it needs to read.
//
// A pill was once a see-through shade over whatever lay under it, which came
// out mid gray on a light page, where pink lives and a red warning were hard
// to read. The backing is now one opaque dark, the same in light and dark and
// over any scene, so the text has a single color to stand out from. A pill
// with a timer tints the part still left at PILL_TINT of its own color. The
// text keeps its color's meaning (lives stay pink, a warning stays red): it is
// mixed toward white only as far as it takes to read at PILL_CONTRAST on the
// backing (and on the tint, while a timer runs), and a color that already
// does is drawn as it is.
//
// Lives are the one pill drawn solid: LIVES_BACK under white hearts, one
// heart per life, so how many are left reads at a glance without reading a
// number. A game asks for it by drawing `livesText(n)` in the LIVES color;
// endless lives (the Activities window's code) are n = Infinity, "♥ x∞".

export const PILL = "#1d1a17";
export const LIVES = "#ff4fa3";
export const LIVES_BACK = "#c8175f";
export const LIVES_INK = "#ffffff";
export const PILL_TINT = 0.25;
export const PILL_CONTRAST = 4.5;

// "#rgb", "#rrggbb" or "rgb(r, g, b)" as [r, g, b], or null for anything else.
function rgbOf(color) {
  const s = String(color).trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(s);
  return m ? [m[1], m[2], m[3]].map(Number) : null;
}

// The lives pill's text: a heart per life up to five, a count past that, an
// empty heart at none.
export function livesText(n) {
  if (n === Infinity) return "♥ x∞";
  const k = Math.max(0, Math.floor(n));
  if (k === 0) return "♡";
  return k <= 5 ? "♥".repeat(k) : `♥ x${k}`;
}

const hexOf = (rgb) => `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The contrast of two colors, each "#rrggbb", "#rgb" or "rgb(...)".
export function pillContrast(a, b) {
  const [x, y] = [luminance(rgbOf(a) || [255, 255, 255]), luminance(rgbOf(b) || [255, 255, 255])].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// What the timer's tint of `color` looks like over the backing.
export function pillTint(color) {
  const rgb = rgbOf(color);
  return rgb ? hexOf(mix(rgbOf(PILL), rgb, PILL_TINT)) : PILL;
}

const INKS = new Map();

// The text color for a pill of `color`, `tinted` while a timer runs: the
// color itself when it reads on the backing (and the tint), else the least
// step toward white that does.
export function pillInk(color, tinted = false) {
  const key = `${color}|${tinted}`;
  if (INKS.has(key)) return INKS.get(key);
  const rgb = rgbOf(color);
  let ink = "#ffffff";
  if (rgb) {
    const under = tinted ? [PILL, pillTint(color)] : [PILL];
    for (let k = 0; k <= 20; k++) {
      const t = k / 20;
      const at = hexOf(mix(rgb, [255, 255, 255], t));
      if (Math.min(...under.map((u) => pillContrast(at, u))) >= PILL_CONTRAST) {
        ink = k === 0 ? color : at;
        break;
      }
    }
  }
  INKS.set(key, ink);
  return ink;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// One pill `w` by `h` at (x, y), its text centered at `textY` in the font the
// game set: the backing, the share `fill` of a timer still left tinted, then
// the text. A pill in the LIVES color is drawn solid (see above).
export function drawPill(ctx, x, y, w, h, text, color, fill, textY) {
  const lives = color === LIVES;
  ctx.fillStyle = lives ? LIVES_BACK : PILL;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  if (fill < 1) {
    ctx.fillStyle = color;
    ctx.globalAlpha = PILL_TINT;
    roundRect(ctx, x, y, w * Math.max(0, fill), h, h / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = lives ? LIVES_INK : pillInk(color, fill < 1);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, textY);
}
