// Plan2Code Web Console - Ghoul Rush's Chapel stage, its drawing: the rooms' looks (a nave of stone arches and stained glass, a timber bell tower, an organ loft, a red and gold choir), its monsters (stone gargoyles, choir ghosts, censer monks, bats in the bells), the Choirmaster at his organ with the four pipes and his notes, the swinging bell and the freeze it tolls, the smoke, Holy Water's badge, and what its events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, LOSE_WORDS and LOSE_SOUNDS are
// plain data; chapelArt(d) takes ghoul-draw.js's own drawing helpers (`d`:
// ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, DANGER,
// GOLD, FLASH and the eye colors) and hands back the drawing by kind, so this
// file never reaches back into it. Everything is drawn in room units, the way
// ghoul-draw.js draws: y counted down from the field's top, a monster from
// (x, y) at its feet (a flier from the bottom of its box). The figures
// (gargoyle, ghost, monk, Choirmaster) are drawn in a local frame turned to
// face the way they look, y counted up from the feet. Each function says
// what it draws and what in the rules (ghoul-chapel.js) it follows.

import { CENSER_WIND_MS, CUE_MS, GAPS, HASTE_RANGE, PIPE_AT, PIPE_DROP_MS, PIPE_H, PIPE_W, ROW_GAP, SMOKE_MS } from "./ghoul-chapel.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Indoors, but drawn by this file (`custom`: ghoul-draw.js hands the walls,
// the floor and the shelves to chapelArt() through `pack`, the way an
// outdoor look does): the walls, a floor and boards (the pews and the beams)
// in each room's colors; `scene` names what the room is made of, `decor` what
// stands along its wall (see decor() below) and `glass` the colors of the
// windows in it.
const chapel = (o) => freeze({ pack: "chapel", custom: true, ...o });
export const LOOKS = freeze({
  nave: chapel({ scene: "nave", wallTop: "#10121c", wallLow: "#2c3144", paper: "#394058", wainscot: "#1a1d2b", floorTop: "#6a6670", floor: "#2e2c34", floorEdge: "#0c0b0f", shelf: "#4a3220", shelfTop: "#8a6440", pit: "#020204", window: "#b58ae0", decor: "pews", color: "#c9a8ee", dark: 0.84, glass: freeze(["#7a3fc0", "#c04f7a", "#3f6fc0", "#e0b040"]) }),
  tower: chapel({ scene: "tower", wallTop: "#120e09", wallLow: "#33291d", paper: "#443525", wainscot: "#21190f", floorTop: "#78684a", floor: "#33291c", floorEdge: "#0d0b08", shelf: "#4a321a", shelfTop: "#8a6430", pit: "#020201", window: "#e0b878", decor: "belfry", color: "#e0b878", dark: 0.88, glass: freeze(["#c08a30", "#a05a2a", "#c0a050"]) }),
  loft: chapel({ scene: "loft", wallTop: "#0c1414", wallLow: "#1f3434", paper: "#2c4a4a", wainscot: "#162626", floorTop: "#6a6a58", floor: "#2c2e28", floorEdge: "#0a0b09", shelf: "#3a3220", shelfTop: "#c8a850", pit: "#010303", window: "#8fd0c4", decor: "organ", color: "#8fd0c4", dark: 0.88, glass: freeze(["#2f8f8a", "#4f6fc0", "#6fc0a0"]) }),
  choir: chapel({ scene: "choir", wallTop: "#1c070a", wallLow: "#481219", paper: "#62202a", wainscot: "#2c0c10", floorTop: "#8a5a40", floor: "#3a2220", floorEdge: "#100608", shelf: "#5a2c1e", shelfTop: "#c89a40", pit: "#040102", window: "#ff9a8a", decor: "choir", color: "#e86a78", dark: 0.86, glass: freeze(["#c0303a", "#e07040", "#a02060", "#e0b040"]) }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-chapel.js).
// `bell` and `holy` are no monsters: the bell's swing and toll, and Holy Water's splash.
// The bell's thaw after a toll is quiet on purpose: the toll just rang.
export const VOICES = freeze({
  gargoyle: freeze({ appear: "ghoulGargoyleAppear", glance: "ghoulGargoyleGlance", wake: "ghoulGargoyleWake", dive: "ghoulGargoyleDive", perch: "ghoulGargoylePerch", hurt: "ghoulGargoyleHurt", die: "ghoulGargoyleDie" }),
  chorister: freeze({ appear: "ghoulChoristerAppear", sing: "ghoulChoristerSing", hush: "ghoulChoristerHush", hurt: "ghoulChoristerHurt", die: "ghoulChoristerDie" }),
  monk: freeze({ appear: "ghoulMonkAppear", censer: "ghoulMonkCenser", smoke: "ghoulMonkSmoke", hurt: "ghoulMonkHurt", die: "ghoulMonkDie" }),
  bellbat: freeze({ appear: "ghoulBellbatAppear", burst: "ghoulBellbatBurst", hurt: "ghoulBellbatHurt", die: "ghoulBellbatDie" }),
  choirmaster: freeze({ wake: "ghoulChoirmasterWake", cue: "ghoulChoirmasterCue", notes: "ghoulChoirmasterNotes", pipeSpew: "ghoulChoirmasterPipeSpew", pipeHit: "ghoulChoirmasterPipeHit", pipeSilence: "ghoulChoirmasterPipeSilence", pipeSound: "ghoulChoirmasterPipeSound", open: "ghoulChoirmasterOpen", rage: "ghoulChoirmasterRage", hurt: "ghoulChoirmasterHurt", die: "ghoulChoirmasterDie" }),
  bell: freeze({ swing: "ghoulBellSwing", toll: "ghoulBellToll" }),
  holy: freeze({ splash: "ghoulHolySplash" }),
});
// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({ gargoyle: "Dive-bombed", chorister: "Sung under", monk: "Smothered", bellbat: "Clapped", choirmaster: "Conducted", note: "Out of tune" });
export const LOSE_SOUNDS = freeze({
  gargoyle: ["crunch", 0.55, 0.7],
  chorister: ["wail", 0.35, 0.7],
  monk: ["thud", 0.5, 0.8],
  bellbat: ["squish", 0.4, 1.3],
  choirmaster: ["smash", 0.6, 0.5],
  note: ["clank", 0.5, 1.2],
});

// Stone (a gargoyle, the arches), its lit and shadowed faces and the glow in
// its cracks; the monk's wool; bronze and brass (bells, censer, pipes); the
// ghosts' pale; the Choirmaster's cassock and surplice; Holy Water's blue.
const STONE = "#8a909a";
const STONE_LIT = "#bcc3cf";
const STONE_DARK = "#4c515c";
const STONE_SHADE = "#2e323b";
const CRACK = "#ff8a3a";
const ROBE = "#6a4a32";
const ROBE_LIT = "#8a6444";
const ROBE_DARK = "#3a281c";
const ROPE = "#b8a37a";
const SMOKE = "#d8d0c4";
const BRONZE = "#b0803a";
const BRONZE_LIT = "#f0c878";
const BRONZE_DARK = "#5a3c14";
const BRASS = "#d8b050";
const BRASS_LIT = "#fff0a8";
const PIPE_DULL = "#6e695c";
const PIPE_DULL_LIT = "#a39d8c";
const PIPE_DARK = "#2e2b24";
const PIPE_LIT = "#f2d878";
const NOTE_COLOR = "#f4ead0";
const NOTE_FAST = "#ff9a6a";
const NOTE_SLOW = "#9fd0ff";
const INK = "#0e0a14";
const HOLY = "#9fd8ff";
const GHOSTLY = "#c9d6f2";
const GHOST_PALE = "#eef2ff";
const CASSOCK = "#3a0f18";
const CASSOCK_LIT = "#6a1e2c";
const SURPLICE = "#d8ccd0";
const BONE_PALE = "#d8ccc0";
const WOOD = "#3a2616";
const WOOD_LIT = "#6a4a2c";
const WOOD_DARK = "#1e130a";
const FROST = "#cfeaff";

// Where the windows sit along a room (every WINDOW_EVERY units, the first at
// WINDOW_AT: ghoul-draw.js lets the dark's moonlight through there), and how
// far each bay of the wall reaches.
const WINDOW_EVERY = 64;
const WINDOW_AT = 20;
// How much of a room is drawn at once (a still layer's chunk and then some).
const REACH = 112;

export function chapelArt(d) {
  const { ellipse, circle, line, rotate, eye, hash, say, gate, DANGER, GOLD, FLASH, EYE_RED, EYE_PALE, EYE_AMBER } = d;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  /* ------------------------------------------------------------ helpers */

  // A gradient as a fill style: `stops` are [offset, color], `plain` what a
  // canvas without gradients paints instead (the first color by default).
  function linear(ctx, x0, y0, x1, y1, stops, plain) {
    const gr = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(x0, y0, x1, y1) : null;
    if (!gr || typeof gr.addColorStop !== "function") return plain || stops[0][1];
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }

  function radial(ctx, x, y, r, stops) {
    const gr = typeof ctx.createRadialGradient === "function" ? ctx.createRadialGradient(x, y, 0, x, y, r) : null;
    if (!gr || typeof gr.addColorStop !== "function") return null;
    for (const [o, c] of stops) gr.addColorStop(o, c);
    return gr;
  }

  // A soft glow round (x, y), `a` the strength at the middle.
  function halo(ctx, x, y, r, color, a) {
    const was = ctx.globalAlpha;
    const gr = radial(ctx, x, y, r, [[0, rgba(color, a)], [0.45, rgba(color, a * 0.4)], [1, rgba(color, 0)]]);
    if (gr) {
      ctx.fillStyle = gr;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      return;
    }
    ctx.fillStyle = color;
    for (const [k, s] of [[1, 0.2], [0.72, 0.25], [0.46, 0.3], [0.24, 0.35]]) {
      ctx.globalAlpha = was * a * s;
      circle(ctx, x, y, r * k);
      ctx.fill();
    }
    ctx.globalAlpha = was;
  }

  // The part of [a, b] a still layer draws (a floor piece or a shelf is
  // handed whole, and a layer is only a chunk wide).
  function reach(ctx, a, b) {
    const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
    if (!m || !(m.a > 0)) return [a, b];
    const lo = -m.e / m.a - 4;
    return [Math.max(a, lo), Math.min(b, lo + REACH)];
  }

  // A pointed arch: its feet at `base`, `w` across, the curve springing at
  // `spring` and meeting at `apex` (smaller y is higher).
  function archPath(ctx, cx, base, w, apex, spring) {
    const hw = w / 2;
    const rise = spring - apex;
    ctx.beginPath();
    ctx.moveTo(cx - hw, base);
    ctx.lineTo(cx - hw, spring);
    ctx.bezierCurveTo(cx - hw, spring - rise * 0.55, cx - hw * 0.25, apex + rise * 0.2, cx, apex);
    ctx.bezierCurveTo(cx + hw * 0.25, apex + rise * 0.2, cx + hw, spring - rise * 0.55, cx + hw, spring);
    ctx.lineTo(cx + hw, base);
    ctx.closePath();
  }

  // Courses of cut stone over a wall: a joint every `rowH` down and every
  // `colW` along, each row shifted half a stone.
  function courses(ctx, x0, x1, y0, y1, rowH, colW, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    let r = 0;
    for (let y = y0; y <= y1; y += rowH, r++) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      if (y >= y1) break;
      for (let x = Math.floor(x0 / colW) * colW + (r % 2) * (colW / 2); x < x1; x += colW) {
        ctx.moveTo(x, y);
        ctx.lineTo(x, Math.min(y + rowH, y1));
      }
    }
    ctx.stroke();
  }

  // A round stone column from `y0` to `y1`, `w` wide, lit from the left, with
  // a capital and a base.
  function column(ctx, x, w, y0, y1, body, lit) {
    ctx.fillStyle = linear(ctx, x - w / 2, 0, x + w / 2, 0, [[0, STONE_SHADE], [0.28, lit], [0.62, body], [1, STONE_SHADE]], body);
    ctx.fillRect(x - w / 2, y0, w, y1 - y0);
    ctx.fillStyle = lit;
    ctx.fillRect(x - w * 0.8, y0, w * 1.6, 0.7);
    ctx.fillStyle = body;
    ctx.fillRect(x - w * 0.68, y0 + 0.7, w * 1.36, 0.9);
    ctx.fillStyle = STONE_SHADE;
    ctx.fillRect(x - w * 0.68, y0 + 1.6, w * 1.36, 0.25);
  }

  // The spots a room's decor stands at between x0 and x1: every 32 units, a
  // third left empty (as ghoul-draw.js spaces its own), none over a pit.
  function spots(v, x0, x1) {
    const out = [];
    for (let x = Math.floor(x0 / 32) * 32 + 4; x < x1 + 16; x += 32) {
      const n = Math.round(x / 32);
      if (hash(n, 3) % 3 === 0) continue;
      if (v.groundAt(v.spec, x) === -Infinity) continue;
      out.push([x, n]);
    }
    return out;
  }

  /* ----------------------------------------------------------- windows */

  // A pointed window of stained glass, its apex at `top`, `w` wide and `h`
  // tall: lead cames over panes in `colors` (a rose in the head and a
  // medallion in the body), and its light spilling faintly round it.
  function glass(ctx, cx, top, w, h, colors, seed) {
    const base = top + h;
    const spring = top + w * 0.8;
    archPath(ctx, cx, base, w, top, spring);
    ctx.fillStyle = "#07060a";
    ctx.fill();
    ctx.save();
    archPath(ctx, cx, base, w, top, spring);
    if (typeof ctx.clip === "function") ctx.clip();
    const rows = Math.max(3, Math.round(h / 2.4));
    const rh = (h - w * 0.8) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.globalAlpha = 0.82;
        ctx.fillStyle = colors[hash(seed * 7 + r, c + 3) % colors.length];
        ctx.fillRect(cx - w / 2 + (w * c) / 2, spring + r * rh, w / 2, rh + 0.05);
      }
    }
    ctx.globalAlpha = 1;
    // The head's rose: a bright eye, a ring of petals.
    const ry = top + w * 0.5;
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = colors[(k + seed) % colors.length];
      ctx.globalAlpha = 0.85;
      ellipse(ctx, cx + Math.cos((k * TAU) / 8) * w * 0.22, ry + Math.sin((k * TAU) / 8) * w * 0.22, w * 0.11, w * 0.11);
      ctx.fill();
    }
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = "#fff0b0";
    circle(ctx, cx, ry, w * 0.1);
    ctx.fill();
    // A medallion of gold in the body.
    ctx.fillStyle = "#f0d070";
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    const my = spring + (h - w * 0.8) * 0.45;
    ctx.moveTo(cx, my - rh * 1.3);
    ctx.lineTo(cx + w * 0.22, my);
    ctx.lineTo(cx, my + rh * 1.3);
    ctx.lineTo(cx - w * 0.22, my);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    // A light top, a dim foot.
    ctx.fillStyle = linear(ctx, 0, top, 0, base, [[0, "rgba(255, 255, 255, 0.28)"], [0.5, "rgba(255, 255, 255, 0)"], [1, "rgba(0, 0, 0, 0.35)"]], "rgba(0, 0, 0, 0)");
    ctx.fillRect(cx - w / 2, top, w, h);
    // The lead.
    ctx.strokeStyle = "#0a0910";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(cx, top);
    ctx.lineTo(cx, base);
    for (let r = 0; r <= rows; r++) {
      ctx.moveTo(cx - w / 2, spring + r * rh);
      ctx.lineTo(cx + w / 2, spring + r * rh);
    }
    for (let k = 0; k < 8; k++) {
      ctx.moveTo(cx, ry);
      ctx.lineTo(cx + Math.cos((k * TAU) / 8) * w * 0.32, ry + Math.sin((k * TAU) / 8) * w * 0.32);
    }
    ctx.stroke();
    ctx.restore();
    halo(ctx, cx, top + h * 0.45, w * 1.4, colors[seed % colors.length], 0.14);
  }

  // A dim shaft of a window's light down to the floor, slanting right.
  function shaft(ctx, cx, w, from, floorY, color) {
    ctx.fillStyle = linear(ctx, 0, from, 0, floorY, [[0, rgba(color, 0.13)], [1, rgba(color, 0)]], rgba(color, 0.05));
    ctx.beginPath();
    ctx.moveTo(cx - w / 2, from);
    ctx.lineTo(cx + w / 2, from);
    ctx.lineTo(cx + w / 2 + (floorY - from) * 0.55, floorY);
    ctx.lineTo(cx - w / 2 + (floorY - from) * 0.55 + 1, floorY);
    ctx.closePath();
    ctx.fill();
  }

  /* ------------------------------------------------------------- decor */

  // An iron stand with three candles, their flames lit and glowing.
  function candles(ctx, x, floorY, n) {
    ctx.strokeStyle = "#1a1612";
    ctx.lineWidth = 0.3;
    line(ctx, x, floorY, x, floorY - 5);
    line(ctx, x - 1.3, floorY - 5.2, x + 1.3, floorY - 5.2);
    ctx.fillStyle = "#1a1612";
    ctx.fillRect(x - 0.8, floorY - 0.4, 1.6, 0.4);
    for (const s of [-1.2, 0, 1.2]) {
      const h = 1.1 + ((n + Math.round(s * 5) + 9) % 3) * 0.45;
      ctx.fillStyle = BONE_PALE;
      ctx.fillRect(x + s - 0.22, floorY - 5.2 - h, 0.44, h);
      halo(ctx, x + s, floorY - 5.9 - h, 1.9, "#ffb43c", 0.5);
      ctx.fillStyle = "#ffcf5a";
      ellipse(ctx, x + s, floorY - 5.9 - h, 0.22, 0.42);
      ctx.fill();
      ctx.fillStyle = "#fff6c8";
      ellipse(ctx, x + s, floorY - 5.8 - h, 0.1, 0.2);
      ctx.fill();
    }
  }

  // A row of pews from the side: a paneled back under a lit rail, a post and
  // finial at each end, hymnals on the rail; `depth` 1 is the row behind.
  function pewRow(ctx, x, floorY, len, depth, n) {
    const hgt = 4.4 - depth * 0.7;
    const base = floorY - depth * 0.9;
    const top = base - hgt;
    ctx.fillStyle = depth ? "#1c120a" : "#2c1d12";
    ctx.fillRect(x, top, len, hgt - 0.2);
    ctx.fillStyle = depth ? "#130b06" : "#1e130b";
    for (let c = x + 0.5; c < x + len - 1.4; c += 2.3) {
      ctx.fillRect(c, top + 0.9, 1.7, hgt - 1.7);
      ctx.fillStyle = depth ? "#32220f" : "#3a2818";
      ctx.fillRect(c, top + 0.9, 1.7, 0.18);
      ctx.fillStyle = depth ? "#130b06" : "#1e130b";
    }
    ctx.fillStyle = depth ? "#4a3624" : "#74533a";
    ctx.fillRect(x - 0.2, top - 0.1, len + 0.4, 0.6);
    ctx.fillStyle = depth ? "#2c1d12" : "#4a3220";
    ctx.fillRect(x - 0.2, top + 0.5, len + 0.4, 0.25);
    for (const px of [x - 0.35, x + len - 0.55]) {
      ctx.fillStyle = depth ? "#2c1d12" : "#4a3220";
      ctx.fillRect(px, top - 0.9, 0.9, hgt + 0.9);
      ctx.fillStyle = depth ? "#4a3624" : "#74533a";
      circle(ctx, px + 0.45, top - 1.15, 0.5);
      ctx.fill();
    }
    const book = ["#5a1a1a", "#1a2a5a", "#3a3a1a"];
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = book[(n + k + depth) % 3];
      ctx.fillRect(x + 2.5 + k * 4.4 + ((n * 3 + k) % 3) * 0.5, top - 0.55, 1.1, 0.5);
    }
  }

  // The nave's decor: a pair of pew rows and a candle stand.
  function pews(ctx, look, x, floorY, n) {
    pewRow(ctx, x - 7, floorY - 0.2, 13, 1, n + 1);
    pewRow(ctx, x - 6, floorY, 14, 0, n);
    candles(ctx, x + 12, floorY, n);
  }

  // The tower's decor: a ladder up the wall beside a bell rope with its knot.
  function belfry(ctx, look, x, floorY, n) {
    const top = floorY - 27;
    ctx.fillStyle = WOOD;
    for (const rx of [x - 1.5, x + 1.1]) ctx.fillRect(rx, top, 0.5, 27);
    ctx.fillStyle = WOOD_LIT;
    for (const rx of [x - 1.5, x + 1.1]) ctx.fillRect(rx, top, 0.14, 27);
    ctx.fillStyle = "#5a3e22";
    for (let y = top + 1.2; y < floorY - 0.5; y += 1.7) {
      ctx.fillRect(x - 1.5, y, 3.1, 0.34);
      ctx.fillStyle = WOOD_LIT;
      ctx.fillRect(x - 1.5, y, 3.1, 0.1);
      ctx.fillStyle = "#5a3e22";
    }
    const rx = x + 7;
    const sway = Math.sin(n * 1.7) * 0.8;
    ctx.strokeStyle = "#9a8a62";
    ctx.lineWidth = 0.42;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.quadraticCurveTo(rx + sway, (floorY - 11) * 0.55, rx + sway * 0.4, floorY - 11);
    ctx.stroke();
    ctx.strokeStyle = "#5a4a2a";
    ctx.lineWidth = 0.14;
    for (let y = 2; y < floorY - 12; y += 1.1) line(ctx, rx + sway * (y / floorY) - 0.25, y, rx + sway * (y / floorY) + 0.25, y + 0.7);
    ctx.fillStyle = "#c8b888";
    ctx.beginPath();
    ctx.moveTo(rx + sway * 0.4 - 0.7, floorY - 11);
    ctx.quadraticCurveTo(rx + sway * 0.4, floorY - 8.2, rx + sway * 0.4 + 0.7, floorY - 11);
    ctx.closePath();
    ctx.fill();
    candles(ctx, x + 12, floorY, n);
  }

  // A bank of organ pipes standing from `floorY`: `n` pipes `pw` wide in a
  // rising and falling row, mouths cut and lips lit, `tall` the tallest.
  function pipeBank(ctx, x, floorY, n, pw, tall, body, lit, seed) {
    for (let k = 0; k < n; k++) {
      const mid = (n - 1) / 2;
      const h = tall * (0.55 + 0.45 * (1 - Math.abs(k - mid) / (mid || 1))) * (0.92 + (hash(seed, k) % 9) * 0.01);
      const px = x + k * pw;
      ctx.fillStyle = linear(ctx, px, 0, px + pw, 0, [[0, PIPE_DARK], [0.3, lit], [0.6, body], [1, PIPE_DARK]], body);
      ctx.fillRect(px + 0.06, floorY - h, pw - 0.12, h);
      ctx.fillStyle = PIPE_DARK;
      ctx.fillRect(px + pw * 0.2, floorY - h * 0.74, pw * 0.6, pw * 0.5);
      ctx.fillStyle = lit;
      ctx.fillRect(px + pw * 0.2, floorY - h * 0.74 - 0.12, pw * 0.6, 0.16);
      ctx.fillStyle = "#07070a";
      ellipse(ctx, px + pw / 2, floorY - h, pw * 0.4, 0.2);
      ctx.fill();
      ctx.fillStyle = PIPE_DARK;
      ctx.beginPath();
      ctx.moveTo(px + pw * 0.1, floorY - h * 0.7);
      ctx.lineTo(px + pw / 2, floorY - h * 0.52);
      ctx.lineTo(px + pw * 0.9, floorY - h * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  // The loft's decor: a case of pipes standing against the wall, gilt
  // fretwork over their feet, and a hymn board with its three numbers.
  function organ(ctx, look, x, floorY, n) {
    const pw = 1.55;
    const cnt = 9;
    const left = x - (cnt * pw) / 2;
    pipeBank(ctx, left, floorY - 2.6, cnt, pw, 26 + (n % 3) * 2, "#9a916a", "#e0d49a", n);
    ctx.fillStyle = "#2a2012";
    ctx.fillRect(left - 0.6, floorY - 2.8, cnt * pw + 1.2, 2.8);
    ctx.fillStyle = look.shelfTop;
    ctx.fillRect(left - 0.6, floorY - 2.9, cnt * pw + 1.2, 0.4);
    ctx.fillStyle = "#4a3a1a";
    for (let k = 0; k < cnt; k++) ctx.fillRect(left + k * pw + 0.3, floorY - 2.1, pw - 0.6, 1.4);
    // The hymn board, its numbers worn and dusty.
    const bx = x + 11;
    ctx.fillStyle = "#6a5028";
    ctx.fillRect(bx - 2.2, floorY - 22.5, 4.4, 6.4);
    ctx.fillStyle = "#101010";
    ctx.fillRect(bx - 1.9, floorY - 22.2, 3.8, 5.8);
    ctx.fillStyle = "#d8d0b0";
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.globalAlpha = 0.35 + ((n + r * 3 + c) % 3) * 0.2;
        ctx.fillRect(bx - 1.4 + c * 1.0, floorY - 21.4 + r * 1.7, 0.6, 1.0);
      }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(210, 200, 180, 0.25)";
    ctx.fillRect(bx - 2.2, floorY - 17.3, 4.4, 0.3);
    candles(ctx, x + 17, floorY, n);
  }

  // The choir's decor: a pair of carved stalls, tall backs under pointed
  // canopies, red cushions, and gold on the finials.
  function stalls(ctx, look, x, floorY, n) {
    for (let s = 0; s < 2; s++) {
      const sx = x - 7 + s * 7;
      ctx.fillStyle = "#2a0e0c";
      ctx.fillRect(sx, floorY - 11, 6.4, 11);
      ctx.fillStyle = "#4a1a14";
      ctx.fillRect(sx + 0.5, floorY - 10.2, 5.4, 5.6);
      archPath(ctx, sx + 3.2, floorY - 4.6, 4.6, floorY - 9.6, floorY - 7.4);
      ctx.fillStyle = "#1c0807";
      ctx.fill();
      ctx.strokeStyle = look.shelfTop;
      ctx.lineWidth = 0.18;
      ctx.stroke();
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(sx - 0.2, floorY - 11.3, 6.8, 0.5);
      ctx.beginPath();
      ctx.moveTo(sx + 2.4, floorY - 11.3);
      ctx.lineTo(sx + 3.2, floorY - 13.2);
      ctx.lineTo(sx + 4, floorY - 11.3);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#7a1a24";
      ctx.fillRect(sx + 0.3, floorY - 4.2, 5.8, 1.1);
      ctx.fillStyle = "#9a2a34";
      ctx.fillRect(sx + 0.3, floorY - 4.2, 5.8, 0.25);
      ctx.fillStyle = "#3a1410";
      ctx.fillRect(sx + 0.2, floorY - 3.1, 6, 3.1);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(sx + 0.2, floorY - 3.1, 6, 0.22);
    }
    candles(ctx, x + 11, floorY, n);
  }

  /* ----------------------------------------------------------- the walls */

  // The Nave: courses of cut stone, a pointed arch between two columns
  // round each window of stained glass (its light across the floor), and a
  // saint in a niche between the bays.
  function naveWall(ctx, v, look, x0, x1, H, floorAt) {
    courses(ctx, x0, x1, 0, H, 3.4, 6.2, "rgba(0, 0, 0, 0.34)");
    ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
    for (let y = 0, r = 0; y < H; y += 3.4, r++) {
      for (let x = Math.floor(x0 / 6.2) * 6.2 + (r % 2) * 3.1; x < x1; x += 6.2) {
        if (hash(Math.round(x), r) % 3 === 0) ctx.fillRect(x + 0.1, y + 0.1, 6, 3.2);
      }
    }
    for (let k = Math.floor((x0 - WINDOW_AT - 30) / WINDOW_EVERY); k * WINDOW_EVERY + WINDOW_AT < x1 + 30; k++) {
      const cx = k * WINDOW_EVERY + WINDOW_AT;
      const fy = floorAt(cx);
      archPath(ctx, cx, fy, 17.4, 1.4, 11);
      ctx.fillStyle = "rgba(6, 6, 12, 0.34)";
      ctx.fill();
      shaft(ctx, cx, 8, 22, fy, look.glass[k & 1 ? 1 : 0]);
      glass(ctx, cx, 6, 8, 17, look.glass, k & 3);
      // The window's own frame, its sill and the arch round it.
      archPath(ctx, cx, 23.2, 9.6, 4.8, 11.4);
      ctx.strokeStyle = "#7a829c";
      ctx.lineWidth = 0.55;
      ctx.stroke();
      archPath(ctx, cx, fy, 17.4, 1.4, 11);
      ctx.strokeStyle = "#6a7290";
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
      ctx.lineWidth = 0.2;
      ctx.stroke();
      ctx.fillStyle = "#8a92ac";
      ctx.fillRect(cx - 5.4, 23.2, 10.8, 0.7);
      ctx.fillStyle = "#3a4052";
      ctx.fillRect(cx - 5.4, 23.9, 10.8, 0.4);
      for (const s of [-1, 1]) column(ctx, cx + s * 9.4, 2.4, 9.4, fy, "#4e5670", "#7a82a0");
      // The saint in a niche between this bay and the next.
      const nx = cx + WINDOW_EVERY / 2;
      archPath(ctx, nx, 29, 5.2, 14.8, 20);
      ctx.fillStyle = "#07070d";
      ctx.fill();
      ctx.strokeStyle = "#6a7290";
      ctx.lineWidth = 0.4;
      ctx.stroke();
      ctx.fillStyle = "#6a7088";
      ctx.beginPath();
      ctx.moveTo(nx - 1.1, 28.6);
      ctx.lineTo(nx - 0.7, 21.4);
      ctx.lineTo(nx + 0.7, 21.4);
      ctx.lineTo(nx + 1.1, 28.6);
      ctx.closePath();
      ctx.fill();
      circle(ctx, nx, 20.2, 0.85);
      ctx.fill();
      ctx.strokeStyle = rgba(GOLD, 0.7);
      ctx.lineWidth = 0.18;
      circle(ctx, nx, 20.2, 1.4);
      ctx.stroke();
      ctx.fillStyle = "#8a92ac";
      ctx.fillRect(nx - 2.2, 29, 4.4, 0.6);
    }
  }

  // The Bell Tower: upright boards and heavy timbers, posts either side of
  // each louvered opening, braces between them, the huge bells in the dark
  // overhead and the rope.
  function towerWall(ctx, v, look, x0, x1, H, floorAt) {
    for (let x = Math.floor(x0 / 2) * 2; x < x1 + 2; x += 2) {
      const n = Math.round(x / 2);
      ctx.fillStyle = n % 2 ? "rgba(255, 200, 120, 0.05)" : "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(x, 0, 2, H);
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.fillRect(x, 0, 0.12, H);
      if (hash(n, 7) % 4 === 0) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(x + 0.9, 3 + (hash(n, 9) % 40), 0.1, 3 + (hash(n, 4) % 5));
      }
    }
    // The beams across: a heavy one under the roof and one at the boards' feet.
    for (const [by, bh] of [[3.6, 2.2], [33, 1.8]]) {
      ctx.fillStyle = "#2e200f";
      ctx.fillRect(x0, by, x1 - x0, bh);
      ctx.fillStyle = "#6a4a26";
      ctx.fillRect(x0, by, x1 - x0, 0.3);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(x0, by + bh - 0.25, x1 - x0, 0.25);
    }
    for (let k = Math.floor((x0 - WINDOW_AT - 60) / WINDOW_EVERY); k * WINDOW_EVERY + WINDOW_AT < x1 + 60; k++) {
      const cx = k * WINDOW_EVERY + WINDOW_AT;
      // A great bell asleep in the dark above the next bay.
      const bx = cx + WINDOW_EVERY / 2;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#08060a";
      ctx.fillRect(bx - 0.4, 0, 0.8, 5);
      ctx.beginPath();
      ctx.moveTo(bx - 2.6, 5);
      ctx.quadraticCurveTo(bx - 4.2, 12, bx - 7.4, 17);
      ctx.lineTo(bx + 7.4, 17);
      ctx.quadraticCurveTo(bx + 4.2, 12, bx + 2.6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#24160a";
      ctx.fillRect(bx - 2.2, 6, 0.9, 10);
      ctx.fillStyle = "#08060a";
      circle(ctx, bx, 17.8, 1);
      ctx.fill();
      ctx.globalAlpha = 1;
      // The opening: night through slanted louvers.
      archPath(ctx, cx, 24, 9, 6, 11);
      ctx.fillStyle = "#06070d";
      ctx.fill();
      ctx.fillStyle = rgba(look.window, 0.18);
      circle(ctx, cx + 1.4, 11, 1.1);
      ctx.fill();
      ctx.save();
      archPath(ctx, cx, 24, 9, 6, 11);
      if (typeof ctx.clip === "function") ctx.clip();
      for (let y = 7; y < 24; y += 1.5) {
        ctx.fillStyle = "#3a2a14";
        ctx.beginPath();
        ctx.moveTo(cx - 4.6, y + 0.9);
        ctx.lineTo(cx + 4.6, y - 0.2);
        ctx.lineTo(cx + 4.6, y + 0.5);
        ctx.lineTo(cx - 4.6, y + 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#8a6a38";
        ctx.lineWidth = 0.14;
        line(ctx, cx - 4.6, y + 0.9, cx + 4.6, y - 0.2);
      }
      ctx.restore();
      archPath(ctx, cx, 24, 9.4, 5.8, 11);
      ctx.strokeStyle = "#7a5a30";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // Posts either side, strapped in iron; braces to the next bay's.
      for (const s of [-1, 1]) {
        const px = cx + s * 8.4;
        ctx.fillStyle = linear(ctx, px - 1.2, 0, px + 1.2, 0, [[0, "#6a4a26"], [0.3, "#4a3218"], [1, "#24180a"]], "#3a2812");
        ctx.fillRect(px - 1.2, 0, 2.4, H);
        ctx.fillStyle = "#14100c";
        for (const sy of [11, 28]) {
          ctx.fillRect(px - 1.3, sy, 2.6, 1.1);
          ctx.fillStyle = "#6a6458";
          circle(ctx, px - 0.6, sy + 0.55, 0.14);
          ctx.fill();
          circle(ctx, px + 0.6, sy + 0.55, 0.14);
          ctx.fill();
          ctx.fillStyle = "#14100c";
        }
      }
      const gx = cx + 8.4 + 1.2;
      const gw = WINDOW_EVERY - 2 * (8.4 + 1.2);
      ctx.strokeStyle = "#35250f";
      ctx.lineWidth = 1.5;
      line(ctx, gx, 6, gx + gw, 32);
      line(ctx, gx + gw, 6, gx, 32);
      ctx.strokeStyle = "#5a3e1e";
      ctx.lineWidth = 0.25;
      line(ctx, gx - 0.2, 5.5, gx + gw - 0.2, 31.5);
      line(ctx, gx + gw + 0.2, 5.5, gx + 0.2, 31.5);
    }
  }

  // The Organ Loft: panels of green paneling under a cornice, a balustrade
  // along the gallery and pointed windows of blue glass.
  function loftWall(ctx, v, look, x0, x1, H, floorAt) {
    for (let x = Math.floor(x0 / 8) * 8; x < x1 + 8; x += 8) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctx.fillRect(x + 0.5, 6, 7, H);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ctx.fillRect(x + 1.2, 7.5, 5.6, H);
      ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
      ctx.fillRect(x + 1.2, 7.5, 5.6, 0.2);
    }
    ctx.fillStyle = "#0a1414";
    ctx.fillRect(x0, 0, x1 - x0, 5.2);
    ctx.fillStyle = look.shelfTop;
    ctx.fillRect(x0, 5.2, x1 - x0, 0.45);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(x0, 5.65, x1 - x0, 0.6);
    // The gallery's balustrade, turned balusters under a gilt rail.
    for (let x = Math.floor(x0 / 1.4) * 1.4; x < x1 + 1.4; x += 1.4) {
      ctx.fillStyle = "#1c1810";
      ctx.fillRect(x + 0.2, 27.2, 0.7, 4.2);
      ctx.fillStyle = "#6a5a2a";
      ctx.fillRect(x + 0.1, 28.4, 0.9, 0.7);
      ctx.fillRect(x + 0.2, 27.2, 0.2, 4.2);
    }
    ctx.fillStyle = "#c8a850";
    ctx.fillRect(x0, 26.5, x1 - x0, 0.8);
    ctx.fillStyle = "#fff0a8";
    ctx.fillRect(x0, 26.5, x1 - x0, 0.2);
    ctx.fillStyle = "#3a2c10";
    ctx.fillRect(x0, 31.4, x1 - x0, 0.7);
    for (let k = Math.floor((x0 - WINDOW_AT - 20) / WINDOW_EVERY); k * WINDOW_EVERY + WINDOW_AT < x1 + 20; k++) {
      const cx = k * WINDOW_EVERY + WINDOW_AT;
      shaft(ctx, cx, 7, 22, floorAt(cx), look.glass[k & 1]);
      glass(ctx, cx, 7, 7, 16, look.glass, k & 3);
      archPath(ctx, cx, 23.2, 8.4, 6.2, 12.2);
      ctx.strokeStyle = "#c8a850";
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
  }

  // The Choir: deep red damask under gold, tall windows of red and gold, a
  // banner hung between the bays, and, in the boss's arena, the staff's five
  // lines across the wall and the great organ behind them.
  function choirWall(ctx, v, look, x0, x1, H, floorAt) {
    for (let x = Math.floor(x0 / 6) * 6; x < x1 + 6; x += 6) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(x, 0, 3, H);
      ctx.fillStyle = "rgba(200, 154, 64, 0.1)";
      ctx.fillRect(x + 2.9, 0, 0.14, H);
      ctx.fillStyle = "rgba(200, 154, 64, 0.1)";
      for (let y = 2 + (Math.round(x / 6) % 2) * 3; y < H; y += 6) {
        ctx.beginPath();
        ctx.moveTo(x + 1.5, y - 1);
        ctx.lineTo(x + 2.4, y);
        ctx.lineTo(x + 1.5, y + 1);
        ctx.lineTo(x + 0.6, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = "#c89a40";
    ctx.fillRect(x0, 2.4, x1 - x0, 0.4);
    ctx.fillStyle = "#2a0a0e";
    ctx.fillRect(x0, 0, x1 - x0, 2.4);
    for (let k = Math.floor((x0 - WINDOW_AT - 40) / WINDOW_EVERY); k * WINDOW_EVERY + WINDOW_AT < x1 + 40; k++) {
      const cx = k * WINDOW_EVERY + WINDOW_AT;
      shaft(ctx, cx, 8, 22, floorAt(cx), look.glass[k & 1]);
      glass(ctx, cx, 6, 8, 17, look.glass, k & 3);
      archPath(ctx, cx, 23.4, 9.6, 4.8, 11.4);
      ctx.strokeStyle = "#c89a40";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // A banner between this bay and the next, gold-fringed, a gold lyre on it.
      const bx = cx + WINDOW_EVERY / 2;
      ctx.fillStyle = "#c89a40";
      ctx.fillRect(bx - 3.6, 4.2, 7.2, 0.5);
      ctx.fillStyle = "#6a1420";
      ctx.beginPath();
      ctx.moveTo(bx - 3, 4.7);
      ctx.lineTo(bx + 3, 4.7);
      ctx.lineTo(bx + 3, 19);
      ctx.lineTo(bx, 21.4);
      ctx.lineTo(bx - 3, 19);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#e0b850";
      ctx.lineWidth = 0.28;
      ctx.stroke();
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.arc(bx, 10.8, 1.5, 0.2, Math.PI - 0.2);
      ctx.moveTo(bx - 1.5, 10.2);
      ctx.lineTo(bx - 1.5, 7.6);
      ctx.moveTo(bx + 1.5, 10.2);
      ctx.lineTo(bx + 1.5, 7.6);
      ctx.stroke();
      line(ctx, bx, 10, bx, 14);
    }
    const spec = v.spec;
    if (spec && spec.arena !== undefined && x1 > spec.arena) greatOrgan(ctx, v, look, spec, H);
  }

  // The great organ across the wall behind the arena: a case of gilt wood with
  // three towers of pipes and flats between, a cornice of fretwork, the
  // staff's five lines run across it all (where his notes fly).
  function greatOrgan(ctx, v, look, spec, H) {
    const fy = H - 6;
    const left = spec.arena + 10;
    const right = spec.length - 3;
    const w = right - left;
    ctx.fillStyle = "#1a0a0a";
    ctx.fillRect(left, 11, w, fy - 11);
    ctx.fillStyle = "#3a1410";
    ctx.fillRect(left, fy - 10, w, 10);
    ctx.fillStyle = look.shelfTop;
    ctx.fillRect(left, fy - 10.4, w, 0.5);
    ctx.fillStyle = "#4a1c16";
    for (let x = left + 1; x < right - 4; x += 5.2) ctx.fillRect(x, fy - 9, 4, 8.4);
    ctx.fillStyle = "#2a0e0c";
    for (let x = left + 1; x < right - 4; x += 5.2) ctx.fillRect(x + 0.4, fy - 8.6, 3.2, 7.6);
    // Three towers, flats between.
    const towers = [0.17, 0.5, 0.83].map((p) => left + w * p);
    for (const [i, tx] of towers.entries()) {
      pipeBank(ctx, tx - 5.4, fy - 10.4, 7, 1.55, 36 - (i === 1 ? 0 : 4), "#8a6a36", "#d8b060", i);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(tx - 6, 8.6 + (i === 1 ? 0 : 4), 12, 0.5);
      ctx.beginPath();
      ctx.moveTo(tx - 6, 8.6 + (i === 1 ? 0 : 4));
      ctx.lineTo(tx, 6 + (i === 1 ? 0 : 4));
      ctx.lineTo(tx + 6, 8.6 + (i === 1 ? 0 : 4));
      ctx.closePath();
      ctx.fill();
    }
    for (let seg = 0; seg < 2; seg++) {
      const sx = towers[seg] + 7;
      const cnt = Math.floor((towers[seg + 1] - 7 - sx) / 1.3);
      pipeBank(ctx, sx, fy - 10.4, cnt, 1.3, 15, "#6a5230", "#b89048", seg + 7);
    }
    // Dim behind the pipes he sounds, so they stand out from it.
    ctx.fillStyle = "rgba(14, 3, 5, 0.55)";
    ctx.fillRect(left - 1, 4, w + 2, fy - 4);
    // The cornice's fretwork.
    ctx.fillStyle = "#2a0e0c";
    ctx.fillRect(left - 1, 10, w + 2, 1.4);
    ctx.fillStyle = look.shelfTop;
    ctx.fillRect(left - 1, 10, w + 2, 0.3);
    for (let x = left; x < right; x += 1.6) circle(ctx, x + 0.8, 11.8, 0.4), ctx.fill();
    // The staff, lit gold, with bar lines.
    const base = H - v.groundAt(spec, spec.length - 12);
    ctx.strokeStyle = rgba("#f0c860", 0.3);
    ctx.lineWidth = 0.2;
    for (let i = 0; i < 5; i++) line(ctx, spec.arena + 2, base - (2.2 + i * 5.2), right + 3, base - (2.2 + i * 5.2));
    for (let x = spec.arena + 26; x < right; x += 26) line(ctx, x, base - 2.2, x, base - 2.2 - 4 * 5.2);
    line(ctx, spec.arena + 2, base - 2.2, spec.arena + 2, base - 2.2 - 4 * 5.2);
  }

  // A room's whole wall from x0 to x1 (what ghoul-draw.js draws with a
  // `custom` look): the room's own, its wainscot along each floor piece, and
  // the decor standing in front.
  function backdrop(ctx, v, look, x0, x1) {
    const { spec, g } = v;
    const H = g.FIELD_H;
    const floorAt = (x) => {
      const gy = v.groundAt(spec, x);
      return H - (gy > -Infinity ? gy : 6);
    };
    ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, look.wallTop], [1, look.wallLow]], look.wallLow);
    ctx.fillRect(x0, 0, x1 - x0, H);
    if (look.scene === "tower") towerWall(ctx, v, look, x0, x1, H, floorAt);
    else if (look.scene === "loft") loftWall(ctx, v, look, x0, x1, H, floorAt);
    else if (look.scene === "choir") choirWall(ctx, v, look, x0, x1, H, floorAt);
    else naveWall(ctx, v, look, x0, x1, H, floorAt);
    // Paneling to the height of a man along each floor piece.
    for (const [a, b, top] of spec.ground) {
      if (b < x0 - 1 || a > x1 + 1) continue;
      const fy = H - top;
      const lo = Math.max(a, x0);
      const hi = Math.min(b, x1);
      ctx.fillStyle = look.wainscot;
      ctx.fillRect(lo, fy - 5, hi - lo, 5);
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      ctx.fillRect(lo, fy - 5, hi - lo, 0.3);
      ctx.fillStyle = look.floorEdge;
      ctx.fillRect(lo, fy - 5.3, hi - lo, 0.3);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      for (let x = Math.ceil(lo / 3.2) * 3.2; x < hi; x += 3.2) ctx.fillRect(x, fy - 4.3, 0.14, 3.6);
    }
    for (const [x, n] of spots(v, x0, x1)) DECOR[look.decor]?.(ctx, look, x, floorAt(x), n);
  }

  /* ------------------------------------------------- floor and shelves */

  // What a floor piece (a, b, top) is paved in over the plain one: stone
  // flags (the nave), planks (the tower), boards with a brass edge (the
  // loft), a red carpet on marble (the choir).
  function ground(ctx, v, look, a, b, top) {
    const fy = v.g.FIELD_H - top;
    const [lo, hi] = reach(ctx, a, b);
    if (hi <= lo) return;
    const sc = look.scene;
    if (sc === "tower") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      for (let x = Math.ceil(lo / 2.6) * 2.6; x < hi; x += 2.6) ctx.fillRect(x, fy, 0.16, top);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      for (let y = fy + 1.1; y < fy + Math.min(top, 5); y += 1.9) ctx.fillRect(lo, y, hi - lo, 0.14);
      ctx.fillStyle = "#14100a";
      for (let x = Math.ceil(lo / 7.8) * 7.8; x < hi; x += 7.8) {
        circle(ctx, x + 0.5, fy + 0.55, 0.14);
        ctx.fill();
        circle(ctx, x + 2.1, fy + 0.55, 0.14);
        ctx.fill();
      }
    } else if (sc === "loft") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      for (let x = Math.ceil(lo / 5) * 5; x < hi; x += 5) ctx.fillRect(x, fy, 0.14, Math.min(top, 5));
      for (let y = fy + 1.4, r = 0; y < fy + Math.min(top, 5); y += 1.4, r++) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fillRect(lo, y, hi - lo, 0.12);
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        for (let x = Math.ceil(lo / 5) * 5 + (r % 2) * 2.5; x < hi; x += 5) ctx.fillRect(x, y, 0.12, 1.4);
      }
      ctx.fillStyle = "#c8a850";
      ctx.fillRect(lo, fy + 1.1, hi - lo, 0.22);
    } else if (sc === "choir") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      for (let x = Math.ceil(lo / 3) * 3; x < hi; x += 3) ctx.fillRect(x, fy + 1.1, 0.14, Math.min(top, 5));
      ctx.fillStyle = "#8a1a28";
      ctx.fillRect(lo, fy, hi - lo, 0.7);
      ctx.fillStyle = "#c84a58";
      ctx.fillRect(lo, fy, hi - lo, 0.2);
      ctx.fillStyle = "#e0b850";
      ctx.fillRect(lo, fy + 0.7, hi - lo, 0.2);
      ctx.fillStyle = "#5a0e18";
      for (let x = Math.ceil(lo / 3.6) * 3.6; x < hi; x += 3.6) ctx.fillRect(x + 1, fy + 0.15, 1.2, 0.35);
    } else {
      for (let x = Math.ceil(lo / 5) * 5; x < hi; x += 5) {
        const n = Math.round(x / 5);
        ctx.fillStyle = n % 2 ? "rgba(255, 255, 255, 0.07)" : "rgba(0, 0, 0, 0.16)";
        ctx.fillRect(x, fy, 5, 1.1);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fillRect(x, fy, 0.14, Math.min(top, 5));
      }
      for (let y = fy + 1.1, r = 0; y < fy + Math.min(top, 5); y += 1.8, r++) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
        ctx.fillRect(lo, y, hi - lo, 0.14);
        for (let x = Math.ceil(lo / 6) * 6 + (r % 2) * 3; x < hi; x += 6) ctx.fillRect(x, y, 0.14, 1.8);
      }
      for (let x = Math.ceil(lo / 37) * 37; x < hi; x += 37) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(x, fy);
        ctx.lineTo(x + 0.6, fy + 0.5);
        ctx.lineTo(x + 0.3, fy + 1.1);
        ctx.stroke();
      }
    }
  }

  // A shelf from a to b with its top at y: the nave's is a pew back with its
  // panels and posts, the tower's a timber with an iron strap, the loft's a
  // gallery front with balusters under a gilt rail, the choir's a stall of
  // carved red wood edged in gold.
  function shelf(ctx, v, look, a, b, y) {
    const [lo, hi] = reach(ctx, a, b);
    if (hi <= lo) return;
    const w = b - a;
    const sc = look.scene;
    if (sc === "tower") {
      ctx.fillStyle = linear(ctx, 0, y, 0, y + 1.8, [[0, "#7a5a30"], [0.25, look.shelf], [1, "#24160a"]], look.shelf);
      ctx.fillRect(a, y, w, 1.8);
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      for (let x = Math.ceil(a / 3.4) * 3.4; x < b; x += 3.4) ctx.fillRect(x, y + 0.3, 0.12, 1.3);
      ctx.fillStyle = "#14100c";
      for (const sx of [a + 1.3, b - 2.6]) {
        ctx.fillRect(sx, y - 0.05, 1.3, 1.9);
        ctx.fillStyle = "#6a6458";
        circle(ctx, sx + 0.65, y + 0.9, 0.18);
        ctx.fill();
        ctx.fillStyle = "#14100c";
      }
      ctx.fillStyle = "#b09060";
      ctx.fillRect(a, y, w, 0.25);
      ctx.strokeStyle = "#5a4a2a";
      ctx.lineWidth = 0.3;
      for (const bx of [a + 1.4, b - 1.4]) line(ctx, bx, y + 1.8, bx + (bx < (a + b) / 2 ? 1 : -1), y + 3.6);
    } else if (sc === "loft") {
      ctx.fillStyle = "#c8a850";
      ctx.fillRect(a, y, w, 0.5);
      ctx.fillStyle = "#fff0a8";
      ctx.fillRect(a, y, w, 0.16);
      ctx.fillStyle = "#2a2014";
      ctx.fillRect(a, y + 0.5, w, 2.6);
      for (let x = a + 0.4; x < b - 0.4; x += 0.9) {
        ctx.fillStyle = "#6a5a2a";
        ctx.fillRect(x, y + 0.7, 0.34, 2.2);
        ctx.fillStyle = "#c8a850";
        ctx.fillRect(x - 0.06, y + 1.5, 0.46, 0.34);
      }
      ctx.fillStyle = "#1a1408";
      ctx.fillRect(a, y + 3.1, w, 0.4);
    } else if (sc === "choir") {
      ctx.fillStyle = look.shelf;
      ctx.fillRect(a, y, w, 2.8);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(a, y, w, 0.5);
      ctx.fillStyle = "#e8c860";
      ctx.fillRect(a, y, w, 0.16);
      ctx.fillStyle = "#2a0e0c";
      for (let x = a + 0.7; x < b - 1.3; x += 2) {
        archPath(ctx, x + 0.55, y + 2.5, 1.1, y + 0.85, y + 1.4);
        ctx.fill();
      }
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(a, y + 2.6, w, 0.3);
      for (const px of [a, b - 0.6]) {
        ctx.fillRect(px, y - 0.7, 0.6, 3.4);
        circle(ctx, px + 0.3, y - 0.8, 0.4);
        ctx.fill();
      }
    } else {
      ctx.fillStyle = "#2a1a10";
      ctx.fillRect(a, y, w, 3.2);
      ctx.fillStyle = "#1a0f08";
      for (let x = a + 0.6; x < b - 1.4; x += 2.2) ctx.fillRect(x, y + 0.9, 1.6, 1.9);
      ctx.fillStyle = "#3a2818";
      for (let x = a + 0.6; x < b - 1.4; x += 2.2) ctx.fillRect(x, y + 0.9, 1.6, 0.14);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(a, y, w, 0.55);
      ctx.fillStyle = "#b08860";
      ctx.fillRect(a, y, w, 0.16);
      ctx.fillStyle = "#4a3220";
      ctx.fillRect(a, y + 0.55, w, 0.28);
      for (const px of [a - 0.1, b - 0.8]) {
        ctx.fillStyle = "#4a3220";
        ctx.fillRect(px, y - 0.5, 0.9, 3.7);
        ctx.fillStyle = look.shelfTop;
        circle(ctx, px + 0.45, y - 0.7, 0.5);
        ctx.fill();
      }
    }
  }

  // What stands along each look's wall, by its `decor` (ghoul-draw.js calls
  // the same through ART.decor on any room it draws itself).
  const DECOR = { pews, belfry, organ, choir: stalls };

  /* ------------------------------------------------------------ figures */

  // Runs `draw` in a frame at (x, y) turned to face `dir`: +x forward, +y up,
  // the figure's feet at the origin.
  function framed(ctx, x, y, dir, draw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, -1);
    draw();
    ctx.restore();
  }

  // An eighth note at (x, y) `s` big (its head at the point), drawn up the
  // page (not in a frame): head, stem and flag.
  function noteGlyph(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ellipse(ctx, x, y, 0.62 * s, 0.44 * s, -0.45);
    ctx.fill();
    ctx.lineWidth = 0.17 * s;
    line(ctx, x + 0.55 * s, y - 0.1 * s, x + 0.55 * s, y - 2.3 * s);
    ctx.beginPath();
    ctx.moveTo(x + 0.55 * s, y - 2.3 * s);
    ctx.quadraticCurveTo(x + 1.35 * s, y - 1.8 * s, x + 1.15 * s, y - 0.9 * s);
    ctx.stroke();
  }

  // A wing in a y-up frame: its arm from the shoulder (sx, sy) out `len` at
  // angle `a` (from +x, turning up), a bend at the wrist, the membrane's
  // scalloped edge back to the hip (hx, hy), the fingers along it.
  function wing(ctx, sx, sy, a, len, hx, hy, fill, rib, rim) {
    const ex = sx + Math.cos(a - 0.45) * len * 0.55;
    const ey = sy + Math.sin(a - 0.45) * len * 0.55;
    const tx = sx + Math.cos(a) * len;
    const ty = sy + Math.sin(a) * len;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(tx, ty);
    const notch = [];
    let px = tx;
    let py = ty;
    for (let k = 1; k <= 3; k++) {
      const qx = lerp(tx, hx, k / 3);
      const qy = lerp(ty, hy, k / 3);
      ctx.quadraticCurveTo(lerp((px + qx) / 2, sx, 0.4), lerp((py + qy) / 2, sy, 0.4), qx, qy);
      notch.push([qx, qy]);
      px = qx;
      py = qy;
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rib;
    ctx.lineWidth = 0.14;
    line(ctx, ex, ey, tx, ty);
    for (const [qx, qy] of notch.slice(0, 2)) line(ctx, ex, ey, qx, qy);
    ctx.strokeStyle = rim;
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  /* ------------------------------------------------------------ monsters */

  // The stone bracket a gargoyle sits on, its top at the perch (x, fy).
  function corbel(ctx, x, fy) {
    for (const [w, h, dy] of [[5.4, 0.7, 0], [4.2, 0.8, 0.7], [3, 0.9, 1.5], [1.8, 0.9, 2.4]]) {
      ctx.fillStyle = dy ? STONE_DARK : STONE;
      ctx.fillRect(x - w / 2, fy + dy, w, h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillRect(x - w / 2, fy + dy, w, 0.14);
      ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(x - w / 2, fy + dy + h - 0.14, w, 0.14);
    }
  }

  // A gargoyle: a crouching winged grotesque of gray stone on its corbel
  // (`perch`, and `wake` as it shakes, cracks and its eyes light), then in
  // the air (`dive`, wings spread, jaws open; `return`, flapping home). Stone
  // never glows: only a waking or awake one has light in its cracks and eyes.
  function gargoyle(ctx, v, m, x, y, t, flash) {
    const d = m.dir || 1;
    const waking = m.act === "wake";
    const stone = m.act === "perch" || waking;
    const px = m.px ?? m.x;
    const home = v.g.FIELD_H - (m.home ?? m.y);
    corbel(ctx, px, home);
    const crack = waking ? clamp(1 - m.wait / 500, 0, 1) : stone ? 0 : 1;
    const body = flash ? FLASH : stone ? STONE : "#a4a8b4";
    const lit = flash ? FLASH : stone ? STONE_LIT : "#d0d4de";
    const dark = flash ? FLASH : stone ? STONE_DARK : "#5e6270";
    const deep = flash ? FLASH : STONE_SHADE;
    // Cracks, drawn by the same lines in both poses (a waking one's grow).
    const cracks = (lines) => {
      if (flash || crack <= 0) return;
      ctx.strokeStyle = CRACK;
      ctx.globalAlpha = 0.35 + 0.65 * crack;
      ctx.lineWidth = 0.14;
      for (const l of lines) {
        ctx.beginPath();
        ctx.moveTo(l[0], l[1]);
        for (let k = 2; k < l.length; k += 2) ctx.lineTo(l[k], l[k + 1]);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    if (stone) {
      const sx = x + (waking ? Math.sin(t / 20) * 0.13 : 0);
      framed(ctx, sx, y, d, () => {
        // The tail curling behind, a spade at its end.
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(-1.4, 0.7);
        ctx.quadraticCurveTo(-2.7, 0.3, -2.8, 1.3);
        ctx.quadraticCurveTo(-2.8, 1.9, -2.2, 1.8);
        ctx.stroke();
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(-2.2, 1.5);
        ctx.lineTo(-1.8, 2.1);
        ctx.lineTo(-2.5, 2.0);
        ctx.closePath();
        ctx.fill();
        // Wings folded up the back: a ridge, ribs, a lit edge.
        ctx.fillStyle = dark;
        ctx.beginPath();
        ctx.moveTo(-0.2, 2.6);
        ctx.lineTo(-1.2, 4.35);
        ctx.lineTo(-1.95, 3.7);
        ctx.lineTo(-1.5, 1.6);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = deep;
        ctx.beginPath();
        ctx.moveTo(-0.2, 2.6);
        ctx.lineTo(-0.6, 3.7);
        ctx.lineTo(-1.2, 4.35);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = lit;
        ctx.lineWidth = 0.18;
        line(ctx, -0.2, 2.6, -1.2, 4.35);
        ctx.strokeStyle = deep;
        ctx.lineWidth = 0.12;
        line(ctx, -1.2, 4.3, -1.5, 1.8);
        line(ctx, -1.2, 4.3, -0.7, 2.5);
        // The haunch, the hind foot and its toes.
        ctx.fillStyle = body;
        ellipse(ctx, -0.8, 1.0, 1.2, 1.0, 0.2);
        ctx.fill();
        ctx.fillStyle = dark;
        ellipse(ctx, -0.2, 0.2, 1.0, 0.24);
        ctx.fill();
        ctx.fillStyle = lit;
        for (const tx of [0.4, 0.75, 1.1]) ctx.fillRect(tx, 0, 0.18, 0.3);
        // The hunched torso and its lit shoulder.
        ctx.fillStyle = body;
        ellipse(ctx, 0.0, 1.95, 1.45, 1.05, 0.55);
        ctx.fill();
        ctx.fillStyle = lit;
        ellipse(ctx, -0.25, 2.6, 0.75, 0.38, 0.5);
        ctx.fill();
        ctx.fillStyle = dark;
        ellipse(ctx, 0.5, 1.3, 0.5, 0.55);
        ctx.fill();
        // The forearm planted on the ledge, three claws.
        ctx.strokeStyle = body;
        ctx.lineWidth = 0.7;
        line(ctx, 0.55, 2.1, 1.3, 0.5);
        ctx.strokeStyle = lit;
        ctx.lineWidth = 0.2;
        line(ctx, 0.35, 2.2, 1.1, 0.55);
        ctx.strokeStyle = dark;
        ctx.lineWidth = 0.17;
        for (const [cx, cy] of [[1.9, 0.12], [1.75, 0.0], [1.5, -0.04]]) line(ctx, 1.3, 0.35, cx, cy + 0.05);
        // The head: brow, muzzle, jaw, fangs, horns and ears.
        ctx.strokeStyle = body;
        ctx.lineWidth = 0.34;
        ctx.lineCap = "round";
        line(ctx, 0.55, 3.55, 0.05, 4.3);
        line(ctx, 1.25, 3.7, 1.15, 4.45);
        ctx.strokeStyle = lit;
        ctx.lineWidth = 0.1;
        line(ctx, 0.5, 3.6, 0.05, 4.3);
        ctx.lineCap = "butt";
        ctx.fillStyle = body;
        ellipse(ctx, 1.05, 3.1, 0.95, 0.8, -0.1);
        ctx.fill();
        ellipse(ctx, 1.72, 2.9, 0.62, 0.42);
        ctx.fill();
        ctx.fillStyle = dark;
        ellipse(ctx, 1.55, 2.5 - (waking ? 0.1 : 0), 0.5, 0.22);
        ctx.fill();
        ctx.fillStyle = flash ? FLASH : BONE_PALE;
        for (const fx of [1.35, 1.8]) {
          ctx.beginPath();
          ctx.moveTo(fx - 0.1, 2.62);
          ctx.lineTo(fx, 2.2 - (waking ? 0.12 : 0));
          ctx.lineTo(fx + 0.1, 2.62);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = body;
        ctx.beginPath();
        ctx.moveTo(0.25, 3.3);
        ctx.lineTo(-0.35, 3.75);
        ctx.lineTo(0.3, 3.65);
        ctx.closePath();
        ctx.fill();
        // The brow, heavy over the eye; the eye itself dark and hollow.
        ctx.strokeStyle = deep;
        ctx.lineWidth = 0.26;
        line(ctx, 0.8, 3.52, 1.75, 3.18);
        ctx.fillStyle = waking ? "#3a1c0c" : "#14161c";
        ellipse(ctx, 1.3, 3.22, 0.22, 0.16);
        ctx.fill();
        // Chips and weathering on the stone.
        if (!flash) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
          for (const [cx, cy] of [[-0.9, 1.4], [0.2, 2.5], [-0.3, 0.8], [1.0, 3.5]]) ctx.fillRect(cx, cy, 0.3, 0.2);
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          for (const [cx, cy] of [[-1.2, 0.9], [0.4, 1.6], [0.9, 3.0]]) ctx.fillRect(cx, cy, 0.25, 0.25);
        }
        cracks([[-0.6, 2.4, -0.3, 1.9, -0.7, 1.4, -0.5, 0.9], [0.1, 2.7, 0.5, 2.3, 0.3, 1.8], [0.9, 3.5, 1.0, 3.2, 0.8, 3.0]]);
      });
      if (waking && !flash) {
        eye(v, x + d * 1.3, y - 3.22, 0.18, EYE_AMBER);
        for (let k = 0; k < 3; k++) {
          const p = (t / 280 + k / 3) % 1;
          ctx.fillStyle = rgba(STONE_LIT, 0.7 * (1 - p));
          ctx.fillRect(x + d * (-1 + k * 1.2) + Math.sin(k * 5 + t / 40) * 0.2, y - 0.4 - p * 1.5, 0.22, 0.22);
        }
      }
      return;
    }
    // In the air: wings spread (diving) or beating (flying home).
    const diving = m.act === "dive";
    let pitch = 0;
    if (diving) pitch = Math.atan2(m.vy || 0, Math.abs(m.vx) || 1);
    else pitch = Math.atan2((m.home ?? m.y) - m.y, Math.abs(px - m.x) || 1);
    pitch = clamp(pitch, -1.15, 1.15) * 0.8;
    const beat = diving ? Math.sin(t / 130) * 0.1 : Math.sin(t / 58);
    const cy = 2.3;
    const P = (lx, ly) => [x + d * (lx * Math.cos(pitch) - ly * Math.sin(pitch)), y - cy - (lx * Math.sin(pitch) + ly * Math.cos(pitch))];
    framed(ctx, x, y - cy, d, () => {
      rotate(ctx, pitch);
      // The far wing, dim; the tail streaming behind with its spade.
      wing(ctx, -0.1, 0.5, 1.75 + beat * 0.5 - (diving ? 0 : 0.05), 4.2, -1.1, -0.8, deep, dark, dark);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.45;
      ctx.beginPath();
      ctx.moveTo(-1.5, -0.1);
      ctx.bezierCurveTo(-2.4, -0.2, -2.8, 0.5 + beat * 0.2, -3.5, 0.2);
      ctx.stroke();
      ctx.fillStyle = dark;
      ctx.beginPath();
      ctx.moveTo(-3.4, 0.55);
      ctx.lineTo(-4.1, 0.2);
      ctx.lineTo(-3.4, -0.2);
      ctx.closePath();
      ctx.fill();
      // Hind legs trailing.
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.5;
      line(ctx, -0.9, -0.5, -2.0, -1.0);
      ctx.lineWidth = 0.14;
      for (const [cx, cy2] of [[-2.5, -0.7], [-2.5, -1.1], [-2.3, -1.4]]) line(ctx, -2.0, -1.0, cx, cy2);
      // The body, chest and haunch.
      ctx.fillStyle = body;
      ellipse(ctx, -0.1, 0, 1.45, 0.95, -0.1);
      ctx.fill();
      ctx.fillStyle = lit;
      ellipse(ctx, 0.1, 0.35, 0.95, 0.35, -0.1);
      ctx.fill();
      ctx.fillStyle = dark;
      ellipse(ctx, -0.95, -0.15, 0.75, 0.55);
      ctx.fill();
      // Forearms thrown forward, claws spread.
      ctx.strokeStyle = body;
      ctx.lineWidth = 0.66;
      line(ctx, 0.8, -0.4, 2.35, -0.95);
      ctx.strokeStyle = dark;
      ctx.lineWidth = 0.16;
      for (const [cx, cy2] of [[3.0, -0.6], [3.05, -1.0], [2.85, -1.45]]) line(ctx, 2.35, -0.95, cx, cy2);
      // The head: horns swept back, ears, jaws gaping with fangs.
      ctx.strokeStyle = body;
      ctx.lineWidth = 0.34;
      ctx.lineCap = "round";
      line(ctx, 1.1, 0.95, 0.2, 1.7);
      line(ctx, 1.5, 1.0, 0.85, 1.95);
      ctx.lineCap = "butt";
      ctx.fillStyle = body;
      ellipse(ctx, 1.5, 0.35, 0.88, 0.68, 0.1);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(1.1, 0.8);
      ctx.lineTo(0.6, 1.3);
      ctx.lineTo(1.4, 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = body;
      ellipse(ctx, 2.15, 0.45, 0.6, 0.34);
      ctx.fill();
      ctx.save();
      ctx.translate(1.75, -0.05);
      rotate(ctx, -0.5);
      ctx.fillStyle = dark;
      ellipse(ctx, 0.35, 0, 0.58, 0.24);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#1a0a0a";
      ellipse(ctx, 2.0, 0.05, 0.42, 0.2, -0.35);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : BONE_PALE;
      for (const [fx, fy] of [[1.85, 0.2], [2.25, 0.3]]) {
        ctx.beginPath();
        ctx.moveTo(fx - 0.1, fy + 0.1);
        ctx.lineTo(fx, fy - 0.38);
        ctx.lineTo(fx + 0.1, fy + 0.1);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = deep;
      ctx.lineWidth = 0.22;
      line(ctx, 1.35, 0.78, 2.05, 0.62);
      // The near wing over it all, its beat from high to low.
      wing(ctx, 0.35, 0.5, 1.95 + beat * (diving ? 0.45 : 0.75), 5.1, -1.0, -0.6, body, deep, lit);
      cracks([[-0.7, 0.2, -0.3, -0.1, -0.6, -0.4], [0.2, 0.5, 0.5, 0.2, 0.3, -0.1], [1.4, 0.6, 1.2, 0.3]]);
    });
    if (!flash) {
      const [ex, ey] = P(1.72, 0.6);
      eye(v, ex, ey, 0.2, diving ? EYE_RED : EYE_AMBER);
    }
  }

  // The ring that shows a singing ghost's reach (HASTE_RANGE round it) and a
  // chevron over every monster inside it that its song speeds up.
  function songRing(ctx, v, m, x, cy, t) {
    const R = HASTE_RANGE;
    const disc = radial(ctx, x, cy, R, [[0, "rgba(201, 214, 242, 0)"], [0.75, "rgba(201, 214, 242, 0.05)"], [1, "rgba(225, 235, 255, 0.2)"]]);
    if (disc) {
      ctx.fillStyle = disc;
      circle(ctx, x, cy, R);
      ctx.fill();
    }
    ctx.strokeStyle = rgba("#e6eeff", 0.6);
    ctx.lineWidth = 0.3;
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash([1.5, 1.0]);
      ctx.lineDashOffset = -t / 70;
    }
    circle(ctx, x, cy, R);
    ctx.stroke();
    if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
    for (let k = 0; k < 2; k++) {
      const p = (t / 1100 + k * 0.5) % 1;
      ctx.strokeStyle = rgba("#f0f4ff", (1 - p) * 0.4);
      ctx.lineWidth = 0.2;
      circle(ctx, x, cy, R * p);
      ctx.stroke();
    }
    // The hurry in what it reaches: two chevrons rising over each.
    for (const o of v.round.monsters) {
      if (o === m || o.dead || Math.hypot(o.x - m.x, o.y - m.y) > R) continue;
      const ox = o.x;
      const oy = v.g.FIELD_H - o.y - o.h - 0.8 - Math.sin(t / 120) * 0.2;
      ctx.strokeStyle = GOLD;
      ctx.lineWidth = 0.28;
      for (const dy of [0, 0.7]) {
        ctx.beginPath();
        ctx.moveTo(ox - 0.7, oy - dy - 0.5);
        ctx.lineTo(ox, oy - dy);
        ctx.lineTo(ox + 0.7, oy - dy - 0.5);
        ctx.stroke();
      }
    }
  }

  // A choir ghost: a pale robed singer floating with its hymnal. While it
  // sings (`m.sing`) its head tips back, its mouth opens, glowing notes
  // spiral up and a ring marks how far its song reaches.
  function chorister(ctx, v, m, x, y, t, flash) {
    const d = m.dir || 1;
    const singing = m.sing > 0;
    const bob = Math.sin(t / 380 + m.id) * 0.3;
    const cy = y - 2.5 - bob;
    if (singing && !flash) songRing(ctx, v, m, x, cy, t);
    const tilt = singing ? 0.28 : 0;
    const was = ctx.globalAlpha;
    framed(ctx, x, y - bob - 0.15, d, () => {
      ctx.globalAlpha = was * 0.9;
      // Wisps of the hem trailing down.
      ctx.strokeStyle = flash ? FLASH : rgba(GHOSTLY, 0.55);
      ctx.lineWidth = 0.34;
      for (const [wx, ph] of [[-0.9, 0], [-0.2, 1.7], [0.6, 3.1], [1.2, 4.4]]) {
        ctx.beginPath();
        ctx.moveTo(wx, 1.1);
        ctx.quadraticCurveTo(wx + Math.sin(t / 300 + ph) * 0.5, 0.6, wx - 0.3 + Math.sin(t / 260 + ph) * 0.6, 0.0);
        ctx.stroke();
      }
      // The robe: fuller at the hem, ragged, paler at the foot.
      ctx.fillStyle = flash ? FLASH : linear(ctx, 0, 3.0, 0, 0.7, [[0, GHOST_PALE], [0.5, GHOSTLY], [1, rgba(GHOSTLY, 0.4)]], GHOSTLY);
      ctx.beginPath();
      ctx.moveTo(-0.65, 3.05);
      ctx.quadraticCurveTo(-1.35, 2.8, -1.55, 2.0);
      ctx.lineTo(-1.6, 1.2);
      const hem = [[-1.2, 0.8], [-0.8, 1.2], [-0.4, 0.7], [0.0, 1.15], [0.4, 0.65], [0.8, 1.15], [1.2, 0.75], [1.6, 1.2]];
      for (const [hx, hy] of hem) ctx.lineTo(hx, hy + Math.sin(t / 240 + hx * 3) * 0.12);
      ctx.lineTo(1.55, 2.0);
      ctx.quadraticCurveTo(1.35, 2.8, 0.65, 3.05);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "rgba(120, 140, 190, 0.35)";
        ctx.lineWidth = 0.1;
        for (const fx of [-0.9, -0.3, 0.3, 0.9]) line(ctx, fx * 0.5, 2.9, fx * 1.1, 1.0);
      }
      // The ruff at the neck.
      ctx.fillStyle = flash ? FLASH : "#ffffff";
      ellipse(ctx, 0, 3.05, 0.85, 0.3);
      ctx.fill();
      // The hymnal held at the chest (raised a little while singing), its
      // hands, a gold cross on its cover and the pages' edge.
      ctx.save();
      ctx.translate(0.95, 2.05 + (singing ? 0.35 : 0));
      rotate(ctx, -0.25 + (singing ? 0.2 : 0));
      ctx.fillStyle = flash ? FLASH : "#24305a";
      ctx.fillRect(-0.75, -0.55, 1.5, 1.1);
      if (!flash) {
        ctx.fillStyle = "#f0ead8";
        ctx.fillRect(-0.7, -0.6, 1.4, 0.16);
        ctx.fillStyle = GOLD;
        ctx.fillRect(-0.06, -0.3, 0.12, 0.7);
        ctx.fillRect(-0.28, 0.0, 0.56, 0.12);
        ctx.fillRect(-0.75, -0.55, 0.1, 1.1);
      }
      ctx.restore();
      ctx.fillStyle = flash ? FLASH : GHOST_PALE;
      for (const [hx, hy] of [[0.3, 2.0], [1.65, 2.3]]) {
        circle(ctx, hx, hy + (singing ? 0.35 : 0), 0.27);
        ctx.fill();
      }
      ctx.strokeStyle = flash ? FLASH : GHOSTLY;
      ctx.lineWidth = 0.5;
      line(ctx, 0.9, 2.8, 0.4, 2.1 + (singing ? 0.35 : 0));
      line(ctx, -0.9, 2.7, -0.7, 2.0);
      // The head tipped back to sing: pale, hollow-eyed, the mouth open.
      ctx.save();
      ctx.translate(0, 3.1);
      rotate(ctx, tilt);
      ctx.fillStyle = flash ? FLASH : GHOST_PALE;
      ellipse(ctx, 0.1, 0.65, 0.8, 0.9);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#1a2236";
        ellipse(ctx, 0.5, 0.85, 0.17, 0.26);
        ctx.fill();
        ellipse(ctx, -0.12, 0.85, 0.17, 0.26);
        ctx.fill();
        ellipse(ctx, 0.28, 0.12, singing ? 0.27 : 0.2, singing ? 0.46 : 0.1);
        ctx.fill();
        ctx.fillStyle = "rgba(150, 165, 205, 0.4)";
        ellipse(ctx, 0.2, 0.45, 0.07, 0.15);
        ctx.fill();
      }
      ctx.restore();
    });
    ctx.globalAlpha = was;
    if (!flash) {
      eye(v, x + d * 0.5, y - bob - 0.15 - 3.1 - 0.85 * Math.cos(tilt), 0.1, EYE_PALE);
      eye(v, x - d * 0.12, y - bob - 0.15 - 3.1 - 0.85 * Math.cos(tilt), 0.1, EYE_PALE);
    }
    if (singing && !flash) {
      for (let k = 0; k < 4; k++) {
        const p = (t / 900 + k / 4) % 1;
        const nx = x + d * 0.6 + Math.sin(p * 7 + k * 2.1) * 1.4;
        const ny = cy - 1.5 - p * 5.5;
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.6);
        noteGlyph(ctx, nx, ny, 0.75, k % 2 ? NOTE_COLOR : "#ffe29a");
        if (p < 0.6) eye(v, nx, ny, 0.22, "#ffe9a0");
      }
      ctx.globalAlpha = was;
    }
  }

  // A censer monk: a hooded brown habit tied with rope, amber eyes in the
  // dark of the hood, and a smoking censer on a chain. Winding up (`windup`)
  // it leans back and swings the censer round overhead, flinging it forward.
  function monk(ctx, v, m, x, y, t, flash) {
    const d = m.dir || 1;
    const p = m.windup > 0 ? clamp(1 - m.windup / CENSER_WIND_MS, 0, 1) : 0;
    const walk = Math.sin(t / 130);
    const lean = p > 0 ? (p < 0.7 ? (-0.16 * p) / 0.7 : -0.16 + ((p - 0.7) / 0.3) * 0.32) : 0;
    const robe = flash ? FLASH : ROBE;
    const shade = flash ? FLASH : ROBE_DARK;
    const lit = flash ? FLASH : ROBE_LIT;
    // The censer's chain: down and swinging at rest, round overhead on a wind-up.
    const ease = p * p * (3 - 2 * p);
    const ang = p > 0 ? lerp(0.3, -4.9, ease) : 0.35 + Math.sin(t / 260) * 0.45;
    const hand = p > 0 ? [lerp(1.2, 0.5, Math.min(1, p * 1.6)), lerp(2.5, 4.3, Math.min(1, p * 1.6))] : [1.2, 2.5];
    const L = 2.3;
    const censer = (a) => [hand[0] + Math.sin(a) * L, hand[1] - Math.cos(a) * L];
    const [cx, cy] = censer(ang);
    framed(ctx, x, y, d, () => {
      rotate(ctx, lean);
      ctx.fillStyle = flash ? FLASH : "#2a1a10";
      ellipse(ctx, -0.5 + walk * 0.3, 0.16, 0.5, 0.2);
      ctx.fill();
      ellipse(ctx, 0.6 - walk * 0.3, 0.16, 0.5, 0.2);
      ctx.fill();
      // The habit, flared at the hem, a darker side, folds, mud on the hem.
      ctx.fillStyle = robe;
      ctx.beginPath();
      ctx.moveTo(-1.55, 0.12);
      ctx.quadraticCurveTo(-1.2, 1.9, -0.95, 3.7);
      ctx.lineTo(0.95, 3.7);
      ctx.quadraticCurveTo(1.25, 1.9, 1.55, 0.12);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
        ctx.beginPath();
        ctx.moveTo(-1.55, 0.12);
        ctx.quadraticCurveTo(-1.2, 1.9, -0.95, 3.7);
        ctx.lineTo(-0.2, 3.7);
        ctx.quadraticCurveTo(-0.5, 1.9, -0.5, 0.12);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 0.1;
        for (const fx of [0.3, 0.8, 1.2]) line(ctx, fx * 0.55, 3.4, fx * 1.1, 0.4);
        ctx.fillStyle = shade;
        ctx.fillRect(-1.55, 0.12, 3.1, 0.3);
        ctx.strokeStyle = ROPE;
        ctx.lineWidth = 0.26;
        line(ctx, -1.08, 1.85, 1.08, 1.85);
        ctx.fillStyle = ROPE;
        circle(ctx, 0.55, 1.85, 0.24);
        ctx.fill();
        ctx.lineWidth = 0.16;
        line(ctx, 0.55, 1.7, 0.5, 1.2);
        line(ctx, 0.6, 1.7, 0.72, 1.25);
      }
      // The back arm, folded into the sleeve at the belly.
      ctx.strokeStyle = shade;
      ctx.lineWidth = 0.85;
      line(ctx, -0.4, 3.3, 0.4, 2.3);
      // The hood: a point behind, a deep opening, amber eyes in the dark.
      ctx.fillStyle = flash ? FLASH : "#4e3624";
      ctx.beginPath();
      ctx.moveTo(-1.05, 3.55);
      ctx.bezierCurveTo(-1.6, 4.4, -1.1, 5.3, -0.2, 5.4);
      ctx.bezierCurveTo(0.7, 5.5, 1.35, 5.0, 1.3, 4.2);
      ctx.bezierCurveTo(1.25, 3.85, 0.8, 3.65, 0.4, 3.6);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = lit;
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(-1.1, 4.2);
        ctx.bezierCurveTo(-1.0, 5.0, -0.5, 5.35, -0.1, 5.38);
        ctx.stroke();
        ctx.fillStyle = "#0b0508";
        ellipse(ctx, 0.62, 4.4, 0.58, 0.7);
        ctx.fill();
        ctx.fillStyle = "#6a6a62";
        ellipse(ctx, 0.78, 3.95, 0.22, 0.12);
        ctx.fill();
      }
      // The front arm out to the censer's chain, a bony hand at its end.
      ctx.strokeStyle = robe;
      ctx.lineWidth = 0.85;
      line(ctx, 0.6, 3.4, hand[0] - 0.1, hand[1] + 0.1);
      ctx.fillStyle = flash ? FLASH : "#b9a58a";
      circle(ctx, hand[0], hand[1], 0.28);
      ctx.fill();
      // Where the censer has been: dim copies along its swing.
      if (p > 0 && !flash) {
        for (let k = 4; k >= 1; k--) {
          const [tx, ty] = censer(lerp(0.3, -4.9, Math.max(0, p - k * 0.05) ** 2 * (3 - 2 * Math.max(0, p - k * 0.05))));
          ctx.fillStyle = rgba(BRASS, 0.09 * (5 - k));
          circle(ctx, tx, ty, 0.55);
          ctx.fill();
        }
      }
      // The chain and the censer: a cap, a perforated bowl, glowing through.
      ctx.strokeStyle = flash ? FLASH : "#8a7a58";
      ctx.lineWidth = 0.15;
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([0.28, 0.14]);
      line(ctx, hand[0], hand[1], cx, cy + 0.5);
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
      ctx.fillStyle = flash ? FLASH : BRASS;
      circle(ctx, cx, cy, 0.62);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#6a4a1c";
        ctx.fillRect(cx - 0.3, cy + 0.5, 0.6, 0.28);
        ctx.beginPath();
        ctx.moveTo(cx - 0.4, cy + 0.55);
        ctx.lineTo(cx, cy + 1.0);
        ctx.lineTo(cx + 0.4, cy + 0.55);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#ff9a3a";
        for (const [ox, oy] of [[-0.25, 0.1], [0.2, 0.18], [0.0, -0.22]]) ctx.fillRect(cx + ox - 0.07, cy + oy - 0.07, 0.14, 0.14);
        ctx.fillStyle = BRASS_LIT;
        circle(ctx, cx - 0.22, cy + 0.2, 0.16);
        ctx.fill();
      }
    });
    if (flash) return;
    const wx = x + d * cx;
    const wy = y - cy;
    eye(v, x + d * 0.82, y - 4.5, 0.12, EYE_AMBER);
    eye(v, x + d * 0.42, y - 4.52, 0.1, EYE_AMBER);
    eye(v, wx, wy, 0.2, "#ff9a3a");
    // A thread of incense trailing from it (thicker while it is flung).
    for (let k = 0; k < 4; k++) {
      const q = (t / 900 + k / 4) % 1;
      ctx.fillStyle = rgba(SMOKE, (1 - q) * (p > 0.5 ? 0.6 : 0.45));
      circle(ctx, wx + Math.sin(q * 5 + k) * 0.45 - d * q * 0.8, wy - 0.5 - q * 2.4, 0.22 + q * 0.42);
      ctx.fill();
    }
  }

  // A bell bat. Roosting, a small bronze bell hung from the beams by a cord
  // with a bat asleep inside (its folded wings out of the mouth, ears and
  // red eyes below), shivering as the bell begins to swing. Flying, a purple
  // bat flapping with a little brass bell at its chest, glinting.
  function bellbat(ctx, v, m, x, y, t, flash) {
    if (m.act === "roost") {
      const tw = v.round.twist;
      const shiver = tw && (tw.swing || tw.frozen) && !(v.round.stunMs > 0) ? Math.sin(t / 35) * 0.1 : 0;
      const pivot = y - 6.1;
      const cordTop = pivot - 3 > 6 ? 5.8 : pivot - 3;
      ctx.fillStyle = WOOD;
      ctx.fillRect(x - 2.4, cordTop - 0.9, 4.8, 0.9);
      ctx.fillStyle = WOOD_LIT;
      ctx.fillRect(x - 2.4, cordTop - 0.9, 4.8, 0.2);
      ctx.strokeStyle = "#9a8a62";
      ctx.lineWidth = 0.26;
      line(ctx, x, cordTop, x, pivot);
      ctx.fillStyle = "#14100c";
      circle(ctx, x, cordTop, 0.3);
      ctx.fill();
      ctx.save();
      ctx.translate(x, pivot);
      rotate(ctx, shiver);
      // The bell: a bronze crown and flared lip, a bright strip down it.
      ctx.fillStyle = flash ? FLASH : linear(ctx, -1.8, 0, 1.8, 0, [[0, BRONZE_DARK], [0.3, BRONZE_LIT], [0.55, BRONZE], [1, BRONZE_DARK]], BRONZE);
      ctx.beginPath();
      ctx.moveTo(-0.55, 0);
      ctx.quadraticCurveTo(-0.85, 2.0, -1.75, 3.4);
      ctx.lineTo(1.75, 3.4);
      ctx.quadraticCurveTo(0.85, 2.0, 0.55, 0);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = BRONZE_DARK;
        ctx.fillRect(-1.85, 3.2, 3.7, 0.35);
        ctx.fillStyle = BRONZE_LIT;
        ctx.fillRect(-1.85, 3.2, 3.7, 0.1);
        ctx.fillRect(-0.45, 0.4, 0.3, 2.4);
        // The sheen sliding down it now and then.
        const gl = (t / 900) % 3;
        if (gl < 1) {
          ctx.fillStyle = rgba(BRASS_LIT, 0.8 * (1 - gl));
          ctx.fillRect(-0.9, 0.6 + gl * 2.2, 0.35, 0.5);
        }
        // The bat hanging from the clapper: wings folded round it, ears
        // and eyes at the foot.
        ctx.fillStyle = "#2a1236";
        ellipse(ctx, 0, 4.1, 0.95, 1.1);
        ctx.fill();
        ctx.strokeStyle = "#4a2a5a";
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.arc(-0.3, 4.1, 0.8, 1.2, 4.5);
        ctx.stroke();
        ctx.fillStyle = "#3a1c4a";
        ellipse(ctx, 0, 5.0, 0.62, 0.52);
        ctx.fill();
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(s * 0.62, 5.0);
          ctx.lineTo(s * 0.5, 5.9);
          ctx.lineTo(s * 0.18, 5.2);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
      if (!flash) {
        eye(v, x - 0.28, pivot + 5.0, 0.11, EYE_RED);
        eye(v, x + 0.28, pivot + 5.0, 0.11, EYE_RED);
      }
      return;
    }
    const flap = Math.sin(t / 42);
    const d = m.vx < 0 ? -1 : 1;
    const cy = y - 0.8;
    const skin = flash ? FLASH : m.color || "#5a2a6a";
    const wingC = flash ? FLASH : "#40204e";
    for (const s of [-1, 1]) {
      const tipY = cy - 0.7 - flap * 1.0;
      ctx.fillStyle = wingC;
      ctx.beginPath();
      ctx.moveTo(x + s * 0.3, cy - 0.2);
      ctx.lineTo(x + s * 1.3, tipY - 0.3);
      ctx.lineTo(x + s * 2.7, tipY + 0.2);
      ctx.quadraticCurveTo(x + s * 2.3, cy + 0.2, x + s * 2.0, cy + 0.35);
      ctx.quadraticCurveTo(x + s * 1.7, cy + 0.0, x + s * 1.4, cy + 0.45);
      ctx.quadraticCurveTo(x + s * 0.9, cy + 0.15, x + s * 0.45, cy + 0.55);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "#8a5a9a";
        ctx.lineWidth = 0.12;
        line(ctx, x + s * 1.3, tipY - 0.3, x + s * 2.0, cy + 0.35);
        line(ctx, x + s * 1.3, tipY - 0.3, x + s * 1.4, cy + 0.45);
        ctx.lineWidth = 0.2;
        ctx.beginPath();
        ctx.moveTo(x + s * 0.3, cy - 0.2);
        ctx.lineTo(x + s * 1.3, tipY - 0.3);
        ctx.lineTo(x + s * 2.7, tipY + 0.2);
        ctx.stroke();
      }
    }
    ctx.fillStyle = skin;
    ellipse(ctx, x, cy, 0.62, 0.62);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 0.45, cy - 0.4);
    ctx.lineTo(x - 0.5, cy - 1.15);
    ctx.lineTo(x - 0.1, cy - 0.6);
    ctx.moveTo(x + 0.45, cy - 0.4);
    ctx.lineTo(x + 0.5, cy - 1.15);
    ctx.lineTo(x + 0.1, cy - 0.6);
    ctx.fill();
    if (flash) return;
    ctx.fillStyle = BONE_PALE;
    ctx.fillRect(x - 0.22, cy + 0.2, 0.1, 0.22);
    ctx.fillRect(x + 0.12, cy + 0.2, 0.1, 0.22);
    // The little brass bell at its chest, and its glint.
    ctx.fillStyle = BRASS;
    ctx.beginPath();
    ctx.moveTo(x - 0.2, cy + 0.45);
    ctx.quadraticCurveTo(x - 0.28, cy + 0.9, x - 0.5, cy + 1.1);
    ctx.lineTo(x + 0.5, cy + 1.1);
    ctx.quadraticCurveTo(x + 0.28, cy + 0.9, x + 0.2, cy + 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = BRASS_LIT;
    ctx.fillRect(x - 0.15, cy + 0.55, 0.12, 0.4);
    const gl = (t / 260) % 2;
    if (gl < 0.5) {
      ctx.strokeStyle = rgba("#ffffff", 1 - gl * 2);
      ctx.lineWidth = 0.12;
      line(ctx, x - 0.65, cy + 0.7, x - 0.1, cy + 0.7);
      line(ctx, x - 0.38, cy + 0.42, x - 0.38, cy + 0.98);
    }
    eye(v, x - 0.24 + d * 0.06, cy - 0.12, 0.1, EYE_RED);
    eye(v, x + 0.24 + d * 0.06, cy - 0.12, 0.1, EYE_RED);
  }

  /* -------------------------------------------------------------- hazards */

  // A cloud of the monk's incense over its box (h.w wide, h.h tall from the
  // floor y): soft billows that fill in, hold thick enough to hide whatever
  // is in them, and thin away at the end. It covers the monsters drawn before
  // it and puts out their eyes (you are drawn over it, so you see yourself).
  function smoke(ctx, v, h) {
    const fade = clamp(Math.min(h.age / 400, h.life / 700), 0, 1);
    if (fade <= 0) return;
    const fy = v.g.FIELD_H - h.y;
    const cx = h.x;
    const cy = fy - h.h / 2;
    const n = 26;
    for (let k = 0; k < n; k++) {
      const a = (k * 2.399 + h.x * 0.37) % TAU;
      const r = Math.sqrt((k + 0.5) / n);
      const px = cx + Math.cos(a) * r * h.w * 0.5 + Math.sin(v.clock / 900 + k * 1.3) * 0.5;
      const py = cy + Math.sin(a) * r * h.h * 0.5 + Math.cos(v.clock / 1100 + k) * 0.4;
      const pr = 2.7 + (k % 4) * 0.55;
      const gr = radial(ctx, px, py, pr, [[0, rgba(k % 3 ? SMOKE : "#e8e2d6", 0.95 * fade)], [0.6, rgba("#c0b8ac", 0.75 * fade)], [1, rgba("#a8a094", 0)]]);
      if (gr) {
        ctx.fillStyle = gr;
        circle(ctx, px, py, pr);
        ctx.fill();
      } else {
        ctx.fillStyle = SMOKE;
        ctx.globalAlpha = 0.55 * fade;
        circle(ctx, px, py, pr);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (fade > 0.6 && v.eyes) {
      for (let i = v.eyes.length - 4; i >= 0; i -= 4) {
        const ex = v.eyes[i];
        const ey = v.eyes[i + 1];
        if (Math.abs(ex - h.x) < h.w / 2 && ey > fy - h.h && ey < fy) v.eyes.splice(i, 4);
      }
    }
  }

  // The great bell swinging from a beam at the top of the view: a bronze bell
  // as big as a room's door on its yoke, swinging wider through the swing
  // (h.p, 0 to 1), its earlier places trailing behind it and amber closing in
  // at the screen's edges as the toll comes. Once it tolls (`round.stunMs`),
  // the bell holds at the end of its swing and the whole view freezes: a ring
  // spreads from it again and again, frost glints across the field and over
  // every monster and you, and a pale shimmer lies on everything.
  function bell(ctx, v, h) {
    const { g, round } = v;
    const frozen = round.stunMs > 0;
    const px = h.x;
    const W = g.FIELD_W;
    const amp = 0.62;
    const swingAt = (p) => (frozen ? amp : Math.sin(p * TAU * 2.5) * amp * Math.min(1, p * 2));
    const swing = swingAt(h.p);
    const left = px - W / 2;
    if (!frozen && h.p > 0.55) {
      // Amber closing in as the toll nears.
      const k = clamp((h.p - 0.55) / 0.45, 0, 1) * (0.55 + 0.45 * Math.sin(v.clock / 70));
      for (const [x0, x1] of [[left, left + 12], [left + W, left + W - 12]]) {
        ctx.fillStyle = linear(ctx, x0, 0, x1, 0, [[0, rgba(BRONZE_LIT, 0.4 * k)], [1, rgba(BRONZE_LIT, 0)]], rgba(BRONZE_LIT, 0.1 * k));
        ctx.fillRect(Math.min(x0, x1), 0, 12, g.FIELD_H);
      }
    }
    // The beam and the bell's yoke.
    ctx.fillStyle = "#2a1a0c";
    ctx.fillRect(px - 9, 0, 18, 1.8);
    ctx.fillStyle = "#6a4a26";
    ctx.fillRect(px - 9, 0, 18, 0.3);
    ctx.fillStyle = "#14100c";
    ctx.fillRect(px - 9, 1.5, 18, 0.3);
    const drawBell = (sw, alpha) => {
      ctx.save();
      ctx.translate(px, 1.8);
      rotate(ctx, sw);
      ctx.globalAlpha = alpha;
      // The yoke: a wheel and an iron strap holding the crown.
      ctx.fillStyle = "#3a2410";
      ctx.fillRect(-4.2, 0, 8.4, 1.3);
      ctx.fillStyle = "#6a4a26";
      ctx.fillRect(-4.2, 0, 8.4, 0.25);
      ctx.fillStyle = "#14100c";
      ctx.fillRect(-0.7, 1.3, 1.4, 1.5);
      // The bell.
      ctx.fillStyle = linear(ctx, -6, 0, 6, 0, [[0, BRONZE_DARK], [0.28, BRONZE_LIT], [0.55, BRONZE], [1, BRONZE_DARK]], BRONZE);
      ctx.beginPath();
      ctx.moveTo(-1.8, 2.6);
      ctx.quadraticCurveTo(-2.6, 8, -5.6, 13);
      ctx.lineTo(5.6, 13);
      ctx.quadraticCurveTo(2.6, 8, 1.8, 2.6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = BRONZE_LIT;
      ctx.fillRect(-1.4, 3.2, 0.7, 8);
      ctx.fillStyle = BRONZE_DARK;
      for (const by of [5.6, 9]) ctx.fillRect(-3.3 - (by - 5.6) * 0.3, by, 6.6 + (by - 5.6) * 0.6, 0.35);
      ctx.fillRect(-5.8, 12.2, 11.6, 0.9);
      ctx.fillStyle = BRONZE_LIT;
      ctx.fillRect(-5.8, 12.2, 11.6, 0.18);
      ctx.fillStyle = INK;
      ellipse(ctx, 0, 13.1, 5.6, 0.55);
      ctx.fill();
      // The clapper, swinging the other way.
      ctx.strokeStyle = "#1a1208";
      ctx.lineWidth = 0.4;
      line(ctx, 0, 3, -sw * 2.6, 13);
      ctx.fillStyle = "#1a1208";
      circle(ctx, -sw * 2.6, 13.6, 0.85);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    };
    if (!frozen) for (const k of [3, 2, 1]) drawBell(swingAt(Math.max(0, h.p - k * 0.025)), 0.08 * (4 - k));
    drawBell(swing, 1);
    if (!frozen) return;
    // The freeze: a pale shimmer, rings from the bell, frost on everything.
    const t = v.clock;
    ctx.fillStyle = "rgba(200, 228, 255, 0.1)";
    ctx.fillRect(left - 2, 0, W + 4, g.FIELD_H);
    for (const [x0, x1] of [[left, left + 16], [left + W, left + W - 16]]) {
      ctx.fillStyle = linear(ctx, x0, 0, x1, 0, [[0, rgba(FROST, 0.5)], [1, rgba(FROST, 0)]], rgba(FROST, 0.15));
      ctx.fillRect(Math.min(x0, x1), 0, 16, g.FIELD_H);
    }
    ctx.fillStyle = linear(ctx, 0, g.FIELD_H, 0, g.FIELD_H - 12, [[0, rgba(FROST, 0.45)], [1, rgba(FROST, 0)]], rgba(FROST, 0.12));
    ctx.fillRect(left, g.FIELD_H - 12, W, 12);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    for (let k = 0; k < 9; k++) ctx.fillRect(left, ((k * 7 + t / 40) % 60) % g.FIELD_H, W, 0.4);
    for (let k = 0; k < 3; k++) {
      const q = (t / 650 + k / 3) % 1;
      ctx.strokeStyle = rgba(k % 2 ? FROST : BRONZE_LIT, (1 - q) * 0.75);
      ctx.lineWidth = 0.7 * (1 - q) + 0.15;
      circle(ctx, px, 8.4, 3 + q * 70);
      ctx.stroke();
    }
    halo(ctx, px, 8.4, 14, BRONZE_LIT, 0.4);
    for (let k = 0; k < 16; k++) {
      const gx = left + (hash(k, 11) / 997) * W;
      const gy = 6 + (hash(11, k) / 997) * (g.FIELD_H - 10);
      const tw = Math.max(0, Math.sin(t / 160 + k * 1.9));
      ctx.strokeStyle = rgba("#ffffff", tw * 0.85);
      ctx.lineWidth = 0.14;
      line(ctx, gx - 0.6, gy, gx + 0.6, gy);
      line(ctx, gx, gy - 0.6, gx, gy + 0.6);
    }
    const iced = (ix, iy, rx, ry) => {
      ctx.strokeStyle = rgba(FROST, 0.55);
      ctx.lineWidth = 0.22;
      ellipse(ctx, ix, iy, rx, ry);
      ctx.stroke();
      ctx.fillStyle = rgba("#ffffff", 0.55);
      for (const [dx, dy] of [[-0.8, -0.9], [0.9, -0.5], [0, 1]]) ctx.fillRect(ix + dx * rx - 0.15, iy + dy * ry - 0.15, 0.3, 0.3);
    };
    for (const m of round.monsters) if (!m.dead && m.x > left - 4 && m.x < left + W + 4) iced(m.x, g.FIELD_H - m.y - m.h / 2, m.w * 0.8 + 0.6, m.h * 0.62 + 0.4);
    iced(round.you.x, g.FIELD_H - round.you.y - g.YOU_H / 2, 3.2, g.YOU_H * 0.62);
  }

  // A note of the Choirmaster's, a big black eighth note edged in light so it
  // reads on any wall, a tail of staff behind it; and, once per column, a gold
  // bracket on the staff where the column has its gap. A fast column has a hot
  // edge and a long tail, a slow one a cold edge and a short tail.
  function note(ctx, v, h) {
    const cx = h.x;
    const cy = v.g.FIELD_H - h.y - h.h / 2;
    const pace = h.pace ?? 1;
    const edge = pace > 1.2 ? NOTE_FAST : pace < 0.9 ? NOTE_SLOW : NOTE_COLOR;
    ctx.strokeStyle = rgba(pace > 1.2 ? NOTE_FAST : "#f0c860", 0.28);
    ctx.lineWidth = 0.16;
    line(ctx, cx + 0.4, cy, cx + 0.4 + 8.6 * pace, cy);
    const mates = v.round.hazards.filter((o) => o.kind === "note" && Math.abs(o.x - h.x) < 0.2);
    const first = mates.reduce((lo, o) => (o.row < lo.row ? o : lo), mates[0]);
    if (first === h) {
      let gap = -1;
      for (let r = 0; r < GAPS; r++) if (!mates.some((o) => o.row === r)) gap = r;
      if (gap >= 0) {
        const gy = cy + (h.row - gap) * ROW_GAP;
        const pulse = 0.55 + 0.35 * Math.sin(v.clock / 110);
        ctx.fillStyle = rgba("#f0d070", 0.12 + 0.1 * pulse);
        ctx.fillRect(cx - 1.4, gy - 1.5, 4.4, 3);
        ctx.strokeStyle = rgba("#ffe9a0", 0.9 * pulse);
        ctx.lineWidth = 0.26;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(cx + 0.8 + s * 0.8 + s * 0.5, gy - 1.5);
          ctx.lineTo(cx + 0.8 + s * 1.8, gy - 1.5);
          ctx.lineTo(cx + 0.8 + s * 1.8, gy + 1.5);
          ctx.lineTo(cx + 0.8 + s * 0.8 + s * 0.5, gy + 1.5);
          ctx.stroke();
        }
      }
    }
    // The note: a pale edge, then the black.
    for (const [c, s] of [[edge, 1.38], [INK, 1.2]]) noteGlyph(ctx, cx, cy + 0.5, s, c);
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
    ellipse(ctx, cx - 0.2, cy + 0.3, 0.3, 0.14, -0.45);
    ctx.fill();
    eye(v, cx + 0.4, cy - 0.6, 0.16, "#ffe9a0");
  }

  // A fresh pipe falling from over the field onto the dead one it replaces,
  // gathering speed as it comes.
  function fallingPipe(ctx, v, p) {
    pipe(ctx, v, p, false, false);
    const fallen = 1 - Math.min(1, p.dropMs / PIPE_DROP_MS);
    ctx.save();
    ctx.translate(0, -v.g.FIELD_H * (1 - fallen * fallen));
    pipe(ctx, v, p, true, false);
    ctx.restore();
  }

  /* -------------------------------------------------------- Choirmaster */

  // One organ pipe standing on the floor at `p.x`, tall and brass. Sounding
  // it shakes, glows, breathes puffs and sound from its mouth and sends notes
  // up, with an hp sign hung over it once it has been hit; silenced it is
  // dark, dented and cracked, its top bent, its mouth sooty and cold, and it
  // rattles (`stir`) when the next column will bring the pipes back.
  function pipe(ctx, v, p, on, hurt, stir) {
    const w = p.w;
    const t = v.clock;
    const fy = v.g.FIELD_H - p.y;
    const x = p.x + (on ? Math.sin(t / 15 + p.i * 2) * 0.09 : stir ? Math.sin(t / 22 + p.i * 2) * 0.22 : 0);
    const top = fy - p.h;
    const mouth = fy - 1.9 - (p.h - 1.9) * 0.2;
    const was = ctx.globalAlpha;
    if (on) halo(ctx, x, fy - p.h * 0.55, p.h * 0.65, "#ffd36a", 0.3 + 0.08 * Math.sin(t / 90 + p.i));
    // The foot, a cone.
    ctx.fillStyle = on ? "#a07c2c" : PIPE_DARK;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.18, fy);
    ctx.lineTo(x - w * 0.5, fy - 1.9);
    ctx.lineTo(x + w * 0.5, fy - 1.9);
    ctx.lineTo(x + w * 0.18, fy);
    ctx.closePath();
    ctx.fill();
    // The body, round: a bright strip on the left, dark on the right.
    ctx.fillStyle = hurt ? FLASH : on ? linear(ctx, x - w / 2, 0, x + w / 2, 0, [[0, "#8a6a1c"], [0.25, BRASS_LIT], [0.55, "#e8c050"], [1, "#7a5a14"]], BRASS) : linear(ctx, x - w / 2, 0, x + w / 2, 0, [[0, PIPE_DARK], [0.25, "#6e6a5e"], [0.55, "#4c483f"], [1, PIPE_DARK]], "#4c483f");
    ctx.fillRect(x - w / 2, top, w, p.h - 1.9);
    if (!hurt) {
      // Bands, and the mouth cut in it: a lit lip over a black slot.
      ctx.fillStyle = on ? BRASS_LIT : "#4a463c";
      for (const k of [0.5, 0.88]) ctx.fillRect(x - w / 2 - 0.1, fy - p.h * k, w + 0.2, 0.28);
      ctx.fillStyle = INK;
      ctx.fillRect(x - w * 0.37, mouth - w * 0.25, w * 0.74, w * 0.5);
      ctx.fillStyle = on ? BRASS_LIT : PIPE_DULL_LIT;
      ctx.fillRect(x - w * 0.37, mouth - w * 0.3, w * 0.74, 0.2);
      ctx.fillStyle = on ? "#a07c2c" : PIPE_DARK;
      for (const s of [-1, 1]) ctx.fillRect(x + s * w * 0.4 - 0.12, mouth - w * 0.3, 0.24, w * 0.6);
      ctx.fillStyle = INK;
      ellipse(ctx, x, top, w / 2 - 0.1, 0.34);
      ctx.fill();
      ctx.strokeStyle = on ? PIPE_LIT : PIPE_DULL_LIT;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.arc(x, top, w / 2 - 0.1, Math.PI, TAU);
      ctx.stroke();
    }
    if (!on && !hurt) {
      // The dents, a split seam, the bent top and the soot.
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ellipse(ctx, x - w * 0.14, fy - p.h * 0.66, w * 0.3, 0.8, 0.3);
      ctx.fill();
      ellipse(ctx, x + w * 0.1, fy - p.h * 0.36, w * 0.26, 0.6, -0.4);
      ctx.fill();
      ctx.fillStyle = "rgba(190, 184, 170, 0.35)";
      ellipse(ctx, x - w * 0.1, fy - p.h * 0.66 + 0.5, w * 0.24, 0.2, 0.3);
      ctx.fill();
      ctx.strokeStyle = "#0a0908";
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(x + w * 0.2, fy - p.h * 0.45);
      ctx.lineTo(x + w * 0.05, fy - p.h * 0.52);
      ctx.lineTo(x + w * 0.22, fy - p.h * 0.6);
      ctx.lineTo(x + w * 0.08, fy - p.h * 0.7);
      ctx.stroke();
      ctx.fillStyle = PIPE_DARK;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, top);
      ctx.lineTo(x - w * 0.1, top + 1.5);
      ctx.lineTo(x + w * 0.3, top + 0.2);
      ctx.lineTo(x + w / 2, top + 1.2);
      ctx.lineTo(x + w / 2, top - 0.1);
      ctx.lineTo(x - w / 2, top - 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = linear(ctx, 0, mouth - 2.2, 0, mouth, [[0, "rgba(0, 0, 0, 0)"], [1, "rgba(0, 0, 0, 0.5)"]], "rgba(0, 0, 0, 0.2)");
      ctx.fillRect(x - w / 2, mouth - 2.2, w, 2.2);
      // A thin curl of cold smoke from the dead mouth.
      ctx.strokeStyle = rgba("#9a948a", 0.28);
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.5, mouth);
      ctx.quadraticCurveTo(x - w * 0.5 - 1, mouth - 1 + Math.sin(t / 400 + p.i) * 0.3, x - w * 0.5 - 0.4, mouth - 2.4);
      ctx.stroke();
    }
    if (hurt) {
      ctx.fillStyle = FLASH;
      ctx.fillRect(x - w / 2, top, w, p.h);
    }
    if (on) {
      // The sound out of its mouth, in arcs; breath and notes from its top.
      for (let k = 0; k < 3; k++) {
        const q = (t / 520 + k / 3 + p.i * 0.17) % 1;
        ctx.strokeStyle = rgba(NOTE_COLOR, (1 - q) * 0.7);
        ctx.lineWidth = 0.28;
        ctx.beginPath();
        ctx.arc(x - w * 0.35, mouth, 1 + q * 5.5, Math.PI - 0.95, Math.PI + 0.95);
        ctx.stroke();
      }
      for (let k = 0; k < 3; k++) {
        const q = (t / 900 + k / 3 + p.i * 0.23) % 1;
        ctx.fillStyle = rgba("#fff6d0", (1 - q) * 0.5);
        circle(ctx, x + Math.sin(q * 5 + p.i + k) * 0.9, top - 0.5 - q * 3.2, 0.3 + q * 0.6);
        ctx.fill();
      }
      const q = (t / 1100 + p.i * 0.31) % 1;
      ctx.globalAlpha = was * (1 - q);
      noteGlyph(ctx, x + Math.sin(q * 6 + p.i) * 1.3, top - 2.4 - q * 4, 0.8, NOTE_COLOR);
      ctx.globalAlpha = was;
      // Its hp, on a little sign over it, once it has been hit.
      if (p.hp < p.max) {
        const sw = p.max * 0.62 + 0.8;
        const sy = top - 4.2 + Math.sin(t / 300 + p.i) * 0.15;
        ctx.fillStyle = "#1c1208";
        ctx.fillRect(x - sw / 2, sy, sw, 1.4);
        ctx.strokeStyle = BRASS;
        ctx.lineWidth = 0.18;
        ctx.strokeRect(x - sw / 2, sy, sw, 1.4);
        ctx.fillStyle = "#1c1208";
        ctx.beginPath();
        ctx.moveTo(x - 0.5, sy + 1.4);
        ctx.lineTo(x, sy + 2.1);
        ctx.lineTo(x + 0.5, sy + 1.4);
        ctx.closePath();
        ctx.fill();
        for (let k = 0; k < p.max; k++) {
          ctx.fillStyle = k < p.hp ? (p.hp <= 2 ? "#ff6a4a" : DANGER) : "#3a2a1c";
          ctx.fillRect(x - sw / 2 + 0.5 + k * 0.62, sy + 0.4, 0.46, 0.6);
        }
      }
    }
  }

  // The Choirmaster: a gaunt ghostly conductor in a tattered choir robe, his
  // surplice in rags over a dark red cassock, the hem dissolving into wisps
  // below him, a long skull of a face with amber eyes and white hair, and a
  // baton. He beats time (`idle`), lifts the baton high on the cue (the
  // telegraph: it flares, with sparks), flicks a second beat (`pair`) and
  // glides to his place with the robe streaming behind (`glide`). Sounding
  // pipes put a shimmer round him (he cannot be hurt); with all of them
  // silent he is open, pale and bowed. In his rage (`raged`) the robe and
  // hair flare, the baton is a blur and his eyes burn red. His four pipes
  // stand behind him (they stand at the rules' PIPE_AT / PIPE_H until the
  // fight makes them).
  function choirmaster(ctx, v, b) {
    const flash = b.hurt > 0;
    const t = v.clock;
    const d = b.dir || -1;
    const x = b.x;
    const fy = v.g.FIELD_H - b.y;
    const was = ctx.globalAlpha;
    if (v.spec) {
      const pipes = b.pipes || PIPE_AT.map((dx, i) => ({ i, x: v.spec.arena + dx, y: b.y, w: PIPE_W, h: PIPE_H[i], hp: 1, max: 1, on: true, hurt: 0 }));
      for (const p of pipes) {
        if (p.dropMs > 0) fallingPipe(ctx, v, p);
        else pipe(ctx, v, p, p.on, p.hurt > 0, b.quiet === 1);
      }
    }
    const sounding = Boolean(v.spec) && (!b.pipes || b.pipes.some((p) => p.on));
    const open = Boolean(v.spec) && Boolean(b.pipes) && !sounding;
    const rage = Boolean(b.raged) || (b.max > 1 && b.hp <= b.max * 0.5);
    const gliding = b.act === "glide";
    const cueing = b.act === "cue";
    const pairing = b.act === "pair";
    const hv = 1.2 + Math.sin(t / 500) * 0.35 + (gliding ? 0.5 : 0);
    const sway = Math.sin(t / (rage ? 170 : 380)) * (rage ? 0.5 : 0.3);
    const slump = open ? 0.12 : 0;
    const body = flash ? FLASH : CASSOCK;
    const pale = flash ? FLASH : BONE_PALE;
    if (rage && !flash) halo(ctx, x, fy - hv - 9, 11, "#ff3a2a", 0.28 + 0.08 * Math.sin(t / 90));
    else if (open && !flash) halo(ctx, x, fy - hv - 11, 9, "#bfe8ff", 0.22);
    // The arm that conducts: where the hand is and how the baton points.
    const beat = t / (rage ? 150 : 260);
    let hand = [3.2 + Math.sin(beat) * 0.7, 10.6 + Math.cos(beat * 2) * 0.8];
    let batonAng = 0.9 + Math.sin(beat) * 0.35;
    if (cueing) {
      hand = [2.2, 15.4 + Math.sin(t / 55) * 0.2];
      batonAng = 1.55;
    } else if (pairing) {
      hand = [3.6, 12.4 + Math.sin(t / 85) * 3.2];
      batonAng = 0.5 + Math.sin(t / 85) * 0.9;
    } else if (gliding) {
      hand = [-1.5, 10.4];
      batonAng = -0.4;
    }
    framed(ctx, x + sway * 0.3, fy - hv, d, () => {
      rotate(ctx, gliding ? 0.14 : -slump);
      // The hem dissolving into tongues of cloth, streaming back when he glides.
      for (let k = 0; k < 9; k++) {
        const sx = -3.8 + k * 0.95;
        const bend = Math.sin(t / 300 + k * 1.4) * 0.6 - (gliding ? 1.6 : 0) - (rage ? 0.4 : 0);
        const tip = 0.1 + ((hash(k, 6) % 5) * 0.28) + (rage ? 0.3 : 0);
        ctx.fillStyle = flash ? FLASH : rgba(k % 2 ? "#7a2234" : "#4a1220", 0.5);
        ctx.beginPath();
        ctx.moveTo(sx - 0.6, 3.2);
        ctx.quadraticCurveTo(sx - 0.2 + bend * 0.4, 1.8, sx + bend * 1.5 - (gliding ? 1 : 0), tip);
        ctx.quadraticCurveTo(sx + 0.3 + bend * 0.6, 1.6, sx + 0.6, 3.2);
        ctx.closePath();
        ctx.fill();
      }
      // The cassock: narrow shoulders, a long fall.
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(-0.85, 13.1);
      ctx.quadraticCurveTo(-2.4, 12.6, -2.5, 11.2);
      ctx.quadraticCurveTo(-1.9, 8.2, -3.5, 5.2);
      ctx.lineTo(-4.1, 2.8);
      for (let k = 0; k <= 8; k++) ctx.lineTo(-4.1 + k * 1.025, k % 2 ? 2.1 + (hash(k, 5) % 5) * 0.2 : 3.2 + (hash(k, 8) % 4) * 0.15);
      ctx.lineTo(4.1, 2.8);
      ctx.lineTo(3.5, 5.2);
      ctx.quadraticCurveTo(1.9, 8.2, 2.5, 11.2);
      ctx.quadraticCurveTo(2.4, 12.6, 0.85, 13.1);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = CASSOCK_LIT;
        ctx.beginPath();
        ctx.moveTo(-0.85, 13.1);
        ctx.quadraticCurveTo(-2.4, 12.6, -2.5, 11.2);
        ctx.quadraticCurveTo(-1.9, 8.2, -3.5, 5.2);
        ctx.lineTo(-4.1, 2.8);
        ctx.lineTo(-3.1, 2.8);
        ctx.lineTo(-2.7, 5.2);
        ctx.quadraticCurveTo(-1.0, 8.5, -1.3, 11.5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
        ctx.lineWidth = 0.14;
        for (const fx of [-1.7, -0.6, 0.7, 1.9]) line(ctx, fx * 0.45, 9.5, fx * 1.5, 5.4);
        // The surplice: ragged lace over the chest, a gold stole down it.
        ctx.fillStyle = rgba(SURPLICE, 0.9);
        ctx.beginPath();
        ctx.moveTo(-0.85, 13.1);
        ctx.quadraticCurveTo(-2.2, 12.6, -2.3, 11.2);
        ctx.lineTo(-2.5, 9.0);
        for (let k = 0; k < 6; k++) ctx.lineTo(-2.2 + k * 0.9, k % 2 ? 7.6 : 8.7 + ((k * 3) % 4) * 0.2);
        ctx.lineTo(2.3, 9.0);
        ctx.lineTo(2.3, 11.2);
        ctx.quadraticCurveTo(2.2, 12.6, 0.85, 13.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(60, 30, 40, 0.35)";
        ctx.fillRect(-2.1, 9.3, 1.1, 0.14);
        ctx.fillRect(0.9, 9.0, 1.2, 0.14);
        ctx.fillStyle = "#c8a040";
        ctx.fillRect(-0.3, 7.7, 0.6, 5.2);
        ctx.fillStyle = "#3a0f18";
        for (const cy of [8.6, 10.1, 11.6]) ctx.fillRect(-0.22, cy, 0.44, 0.14);
        ctx.fillStyle = "#ffffff";
        ellipse(ctx, 0, 13.0, 1.55, 0.5);
        ctx.fill();
      }
      // The left arm: down to a sheet of music, or up flat on the cue.
      const lh = cueing ? [-2.6, 14.4] : gliding ? [-2.4, 9.4] : [-3.1, 10.8 + Math.sin(beat * 0.5) * 0.4];
      ctx.strokeStyle = body;
      ctx.lineWidth = 0.9;
      line(ctx, -1.5, 12.2, lerp(-1.5, lh[0], 0.55) - 0.3, lerp(12.2, lh[1], 0.55) - 0.5);
      line(ctx, lerp(-1.5, lh[0], 0.55) - 0.3, lerp(12.2, lh[1], 0.55) - 0.5, lh[0], lh[1]);
      if (!cueing && !gliding && !flash) {
        ctx.fillStyle = "#e8dfc8";
        ctx.save();
        ctx.translate(lh[0] - 0.6, lh[1] - 0.2);
        rotate(ctx, 0.25);
        ctx.fillRect(-0.9, -0.6, 1.8, 1.4);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        for (let k = 0; k < 3; k++) ctx.fillRect(-0.7, -0.35 + k * 0.4, 1.4, 0.06);
        ctx.restore();
      }
      ctx.fillStyle = pale;
      circle(ctx, lh[0], lh[1], 0.34);
      ctx.fill();
      // The head: a long skull, the hollows of his cheeks, a wide mouth.
      ctx.fillStyle = pale;
      ellipse(ctx, 0.2, 14.5, 0.95, 1.55);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(60, 40, 60, 0.4)";
        ellipse(ctx, 0.75, 13.9, 0.28, 0.5);
        ctx.fill();
        ellipse(ctx, -0.35, 13.9, 0.28, 0.5);
        ctx.fill();
        ctx.fillStyle = "#14080e";
        ellipse(ctx, 0.62, 14.95, 0.28, 0.38);
        ctx.fill();
        ellipse(ctx, -0.12, 14.95, 0.28, 0.38);
        ctx.fill();
        ctx.fillRect(0.28, 14.1, 0.14, 0.5);
        ctx.fillStyle = "#14080e";
        ellipse(ctx, 0.28, 13.3, 0.4, cueing ? 0.5 : 0.2);
        ctx.fill();
        ctx.fillStyle = pale;
        for (const tx of [0.0, 0.28, 0.56]) ctx.fillRect(tx - 0.05, 13.52, 0.1, 0.18);
      }
      // The hair: white wisps swept back, flaring when he rages.
      ctx.strokeStyle = flash ? FLASH : "#f0ece6";
      ctx.lineWidth = 0.2;
      ctx.lineCap = "round";
      for (let k = 0; k < 8; k++) {
        const hx = -0.5 + k * 0.17;
        const len = (rage ? 3.6 : 2.4) + (k % 3) * 0.5;
        ctx.beginPath();
        ctx.moveTo(hx, 15.9 - (k % 2) * 0.1);
        ctx.quadraticCurveTo(hx - len * 0.5, 16.6 + Math.sin(t / 200 + k) * 0.4 + (rage ? 0.8 : 0), hx - len, 15.7 - k * 0.2 + Math.sin(t / 230 + k) * 0.5 + (rage ? 1.0 : 0));
        ctx.stroke();
      }
      ctx.lineCap = "butt";
      // The baton arm: a long dark sleeve, a bony hand, the thin white baton.
      const sh = [1.5, 12.2];
      const el = [lerp(sh[0], hand[0], 0.5) + 0.2, lerp(sh[1], hand[1], 0.5) - 1.0];
      ctx.strokeStyle = body;
      ctx.lineWidth = 0.95;
      line(ctx, sh[0], sh[1], el[0], el[1]);
      ctx.lineWidth = 0.7;
      line(ctx, el[0], el[1], hand[0], hand[1]);
      ctx.fillStyle = pale;
      circle(ctx, hand[0], hand[1], 0.36);
      ctx.fill();
      const bl = 4.3;
      const tipX = hand[0] + Math.cos(batonAng) * bl;
      const tipY = hand[1] + Math.sin(batonAng) * bl;
      if (rage && !flash) {
        ctx.strokeStyle = "rgba(255, 220, 200, 0.28)";
        ctx.lineWidth = 0.2;
        for (const o of [-0.5, 0.5]) line(ctx, hand[0], hand[1], hand[0] + Math.cos(batonAng + o) * bl, hand[1] + Math.sin(batonAng + o) * bl);
      }
      ctx.strokeStyle = flash ? FLASH : "#f4f0ea";
      ctx.lineWidth = 0.22;
      line(ctx, hand[0], hand[1], tipX, tipY);
      ctx.fillStyle = "#ffffff";
      circle(ctx, tipX, tipY, 0.2);
      ctx.fill();
      if (cueing) {
        // The cue: the baton's tip flares, sparks around it, the arm's lift
        // trailed in the air.
        halo(ctx, tipX, tipY, 4.2, "#fff2b0", 0.7);
        ctx.strokeStyle = rgba("#fff2b0", 0.8);
        ctx.lineWidth = 0.22;
        for (let k = 0; k < 8; k++) {
          const a = (k * TAU) / 8 + t / 140;
          line(ctx, tipX + Math.cos(a) * 0.9, tipY + Math.sin(a) * 0.9, tipX + Math.cos(a) * (1.7 + (k % 2) * 0.7), tipY + Math.sin(a) * (1.7 + (k % 2) * 0.7));
        }
        ctx.strokeStyle = rgba("#fff2b0", 0.3);
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.arc(1.0, 11, 5.2, 0.15, 1.2);
        ctx.stroke();
      }
    });
    if (!flash) {
      const ex = rage ? EYE_RED : open ? EYE_PALE : EYE_AMBER;
      const lean = gliding ? 0.14 : -slump;
      const ey = fy - hv - 14.95 * Math.cos(lean);
      eye(v, x + sway * 0.3 + d * 0.62, ey, 0.17, ex);
      eye(v, x + sway * 0.3 - d * 0.12, ey, 0.17, ex);
    }
    // The shimmer of the sounding pipes: he is not to be hurt.
    if (sounding && b.state !== "down") {
      const cx = x;
      const cyy = fy - b.h / 2;
      ctx.fillStyle = rgba(BRASS, 0.07 + 0.03 * Math.sin(t / 150));
      ellipse(ctx, cx, cyy, b.w * 0.74, b.h * 0.58);
      ctx.fill();
      ctx.strokeStyle = rgba(BRASS_LIT, 0.55 + 0.2 * Math.sin(t / 160));
      ctx.lineWidth = 0.28;
      if (typeof ctx.setLineDash === "function") {
        ctx.setLineDash([1.6, 1.2]);
        ctx.lineDashOffset = -t / 50;
      }
      ellipse(ctx, cx, cyy, b.w * 0.74, b.h * 0.58);
      ctx.stroke();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([]);
      for (let k = 0; k < 2; k++) {
        const a = t / 600 + k * Math.PI;
        ctx.globalAlpha = was * 0.9;
        noteGlyph(ctx, cx + Math.cos(a) * b.w * 0.74, cyy + Math.sin(a) * b.h * 0.58 * 0.9, 0.9, rgba(BRASS_LIT, 1));
        ctx.globalAlpha = was;
      }
    }
  }

  /* ------------------------------------------------------------- power */

  // Holy Water's badge (inside the ring every power-up shares): a drop with a
  // glint and a small cross in it.
  function holy(ctx, x, y) {
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(x, y - 1.2);
    ctx.quadraticCurveTo(x + 1.15, y + 0.2, x + 0.75, y + 0.75);
    ctx.quadraticCurveTo(x, y + 1.35, x - 0.75, y + 0.75);
    ctx.quadraticCurveTo(x - 1.15, y + 0.2, x, y - 1.2);
    ctx.stroke();
    ctx.lineWidth = 0.2;
    line(ctx, x, y - 0.1, x, y + 0.85);
    line(ctx, x - 0.4, y + 0.3, x + 0.4, y + 0.3);
    line(ctx, x - 0.55, y - 0.15, x - 0.35, y - 0.55);
  }

  // What lights the dark here: the candles along the walls, a choir ghost's
  // pale glow (wide while it sings), a censer's ember and the incense, a
  // waking gargoyle's eyes (a stone one only a trace, so its shape shows),
  // a bat's bell, every note, the great bell in its swing and the whole
  // field lifting when it freezes, the Choirmaster's baton on the cue and the
  // sounding pipes.
  function lights(v, add) {
    const round = v.round;
    const spec = v.spec;
    const look = LOOKS[spec.id];
    if (look && look.custom) {
      for (const [x] of spots(v, round.camX - 24, round.camX + v.g.FIELD_W + 24)) {
        const dy = v.groundAt(spec, x);
        add(x + (look.decor === "pews" ? 12 : look.decor === "organ" ? 17 : 11 + (look.decor === "belfry" ? 1 : 0)), dy + 6.2, 5, 0.5);
      }
    }
    for (const m of round.monsters) {
      if (m.dead) continue;
      if (m.kind === "chorister") add(m.x, m.y + 2.4, m.sing > 0 ? 8 : 4, m.sing > 0 ? 0.65 : 0.4);
      else if (m.kind === "monk") add(m.x + (m.dir || 1) * 1.5, m.y + 2.5, 3.4, 0.4);
      else if (m.kind === "gargoyle") {
        if (m.act === "perch") add(m.x, m.y + 2, 2.6, 0.12);
        else add(m.x, m.y + 2, 3.4, 0.4);
      } else if (m.kind === "bellbat" && m.act !== "roost") add(m.x, m.y + 0.5, 2.2, 0.25);
    }
    for (const h of round.hazards) {
      if (h.kind === "note") add(h.x, h.y + 0.8, 2.8, 0.6);
      else if (h.kind === "smoke") add(h.x, h.y + h.h / 2, h.w * 0.7, 0.3 * clamp(Math.min(h.age / 400, h.life / 700), 0, 1));
      else if (h.kind === "bell") {
        add(h.x, h.y - 4, 10, 0.5);
        if (round.stunMs > 0) add(h.x, 30, 62, 0.28);
      }
    }
    const b = round.boss;
    if (b && b.kind === "choirmaster" && b.state !== "down") {
      add(b.x, b.y + b.h * 0.55, 8, 0.45);
      if (b.act === "cue") add(b.x - 2, b.y + b.h + 1, 7, 0.7);
      if (b.pipes) for (const p of b.pipes) if (p.on && !(p.dropMs > 0)) add(p.x, p.y + p.h * 0.6, 6.5, 0.5);
    }
  }

  /* ------------------------------------------------------------- events */

  // What the Chapel's events look and sound like, beside ghoul-draw.js's own:
  // true when `e` was one of them. `k` is the same kit react() is handed.
  function react(e, k) {
    const { tone, burst, float, ring, flash, glow, shake, fx } = k;
    if (e.type === "glance") {
      if (gate(fx, "glanceMs", 120)) say(tone, e.kind, "glance", 0.3);
      burst(e.x, e.y, STONE_LIT, 3, 8, 200);
    } else if (e.type === "gargoyleWake") {
      say(tone, e.kind, "wake", 0.45);
      burst(e.x, e.y, STONE, 8, 8, 400);
      float(e.x, e.y + 3, "!", DANGER, 2.6);
    } else if (e.type === "gargoyleDive") {
      say(tone, e.kind, "dive", 0.45);
    } else if (e.type === "gargoylePerch") {
      if (gate(fx, "perchMs", 200)) say(tone, e.kind, "perch", 0.3);
      burst(e.x, e.y, STONE, 6, 6, 300);
    } else if (e.type === "choirSing") {
      if (gate(fx, "singMs", 400)) say(tone, e.kind, "sing", 0.45);
      float(e.x, e.y + 4, "Kill it first", GOLD, 1.8);
    } else if (e.type === "choirHush") {
      if (gate(fx, "hushMs", 400)) say(tone, e.kind, "hush", 0.25);
    } else if (e.type === "censerWind") {
      if (gate(fx, "censerMs", 200)) say(tone, e.kind, "censer", 0.3);
    } else if (e.type === "smokePuff") {
      say(tone, e.kind, "smoke", 0.4);
      burst(e.x, e.y, SMOKE, 12, 8, SMOKE_MS / 8);
    } else if (e.type === "bellBurst") {
      if (gate(fx, "burstMs", 200)) say(tone, e.kind, "burst", 0.5);
      burst(e.x, e.y, "#5a2a6a", 10, 14, 500);
    } else if (e.type === "bellSwing") {
      say(tone, "bell", "swing", 0.4);
      float(e.x, e.y - 12, "The bell...", BRONZE_LIT, 2.2);
    } else if (e.type === "toll") {
      say(tone, "bell", "toll", 0.8);
      flash("#fff3d0", 320);
      shake(Math.min(900, e.ms), 0.9);
      ring(e.x, e.y - 8, BRONZE_LIT, 2, 30, e.ms);
      float(e.x, e.y - 12, "Frozen!", GOLD, 3);
    } else if (e.type === "tollEnd") {
      // The thaw is quiet: the toll's own sound is still ringing out.
      glow(e.x, e.y, 6, 0.3, 300);
    } else if (e.type === "holySplash") {
      if (gate(fx, "holyMs", 100)) say(tone, "holy", "splash", 0.3);
      ring(e.x, e.y, HOLY, 0.5, 4, 280);
      burst(e.x, e.y, HOLY, 6, 10, 300);
    } else if (e.type === "pipeSpew") {
      say(tone, "choirmaster", "pipeSpew", 0.4);
      burst(e.x, e.y, GHOSTLY, 8, 8, 400);
    } else if (e.type === "pipeHit") {
      if (gate(fx, "pipeHitMs", 90)) say(tone, e.kind, "pipeHit", 0.3);
      burst(e.x, e.y, PIPE_LIT, 3, 8, 200);
    } else if (e.type === "pipeSilence") {
      say(tone, e.kind, "pipeSilence", 0.6);
      burst(e.x, e.y, PIPE_DULL, 16, 14, 500);
      shake(200, 0.5);
      float(e.x, e.y + 6, e.left ? `${e.left} to go` : "Silent!", GOLD, 2.2);
    } else if (e.type === "pipeSound") {
      say(tone, e.kind, "pipeSound", 0.5);
      glow(e.x, e.y, 8, 0.6, 400);
      burst(e.x, 6, PIPE_DULL, 10, 12, 350);
      shake(160, 0.5);
      float(e.x, e.y + 6, "It sounds again!", DANGER, 2.2);
    } else if (e.type === "pipesStir") {
      float(e.x, e.y + 6, "The pipes stir!", DANGER, 2.4);
    } else if (e.type === "choirOpen") {
      say(tone, e.kind, "open", 0.6);
      flash("#bfe8ff", 300);
      float(e.x, e.y + 6, "He is open!", GOLD, 2.6);
    } else if (e.type === "choirRage") {
      say(tone, e.kind, "rage", 0.8);
      flash("#c0303a", 400);
      shake(400, 0.8);
      k.banner("The hymn quickens", "Faster notes, closer together", "#e86a78", 1600);
    } else if (e.type === "notesCue") {
      say(tone, e.kind, "cue", 0.45);
      glow(e.x, e.y, 5, 0.6, CUE_MS);
    } else if (e.type === "notes") {
      if (!e.pair || gate(fx, "notesMs", 300)) say(tone, e.kind, "notes", 0.45);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    decor: freeze({ pews, belfry, organ, choir: stalls }),
    monsters: freeze({ gargoyle, chorister, monk, bellbat }),
    bosses: freeze({ choirmaster }),
    missiles: freeze({}),
    hazards: freeze({ smoke, bell, note }),
    waves: freeze({}),
    powers: freeze({ holy }),
    lights,
    react,
  });
}
