// Plan2Code Web Console - Ghoul Rush's Midnight Carnival, the world it is set in: the midway under a night sky (a Ferris wheel, striped tents, game booths and strings of bulbs), the Hall of Mirrors (gilded panels, warped reflections, cracks and glints), the Funhouse (crooked walls, spinning discs, a clown-mouth door and conveyor belts) and the Big Top (striped canvas, a ring, a crowd in the dark, trapeze boards, a gantry rail and the hounds' cages).
//
// ghoul-carnival-draw.js plugs it in. carnivalWorld(d) takes ghoul-draw.js's own
// drawing helpers (`d`) and hands back, by hook: `sky` (the midway's night and
// its Ferris wheel, drawn every frame under the still layers), `backdrop` (the
// still scenery of a room, cached in the layers), `ground` (what lies on a floor
// piece), `shelf` (a booth counter, a gilded ledge, a crooked plank, a trapeze
// board), `moving` (twinkling bulbs, glints, spinning discs, the belts' chevrons,
// spotlights and cages, over the still layers), `lights` (what the dark lets
// through) and `drawCage`. Drawn in room units, y counted down from the field's
// top, a floor piece's `top` counted up. Every hook does nothing outside the
// Carnival's own rooms (the packs' hooks all run in every room).
//
// What it reads off the rules (ghoul-carnival.js): `spec.id`, `spec.length`,
// `spec.arena`, `spec.door`, `spec.belts` ([x0, x1, speed] stretches of floor),
// `round.camX`, `round.boss` and its `raged` (the cages' doors stand open). No
// random number is drawn: each piece keeps its place through `hash`.

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, t) => a + (b - a) * t;
// An item of a list by any whole number, wrapping.
const at = (list, n) => list[((n % list.length) + list.length) % list.length];

const GOLD = "#d8b04a";
const GOLD_DK = "#8a6a2a";
const CREAM = "#f2e8d0";
const PAL = freeze(["#d93a3a", "#2f7fd0", "#e8b923", "#9b4bd6", "#2fa55a", "#ee7a1a"]);
const BULBS = freeze(["#ffd36a", "#ff7ab8", "#7ad0ff", "#9aff8a", "#ffb04a"]);
const FUN = freeze(["#8a2aaa", "#1a9a9a", "#e0701a", "#b01a5a", "#2a5ac8", "#3aa83a"]);
const ROOM = freeze({ midway: 1, mirrors: 1, funhouse: 1, bigtop: 1 });

// A color shaded toward black (k < 0) or white (k > 0), kept.
const SHADES = new Map();
function shade(hex, k) {
  const key = hex + k;
  let c = SHADES.get(key);
  if (c) return c;
  const n = parseInt(hex.slice(1, 7), 16);
  const to = k < 0 ? 0 : 255;
  const p = Math.abs(k);
  const m = (s) => Math.round(((n >> s) & 255) * (1 - p) + to * p);
  c = `rgb(${m(16)}, ${m(8)}, ${m(0)})`;
  SHADES.set(key, c);
  return c;
}
const ALPHAS = new Map();
function rgba(hex, a) {
  const key = hex + a;
  let c = ALPHAS.get(key);
  if (!c) {
    const n = parseInt(hex.slice(1, 7), 16);
    c = `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
    ALPHAS.set(key, c);
  }
  return c;
}

// A linear gradient as a fill style (the middle stop's color where the context makes none).
function grad(ctx, x0, y0, x1, y1, stops) {
  const g = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(x0, y0, x1, y1) : null;
  if (g && typeof g.addColorStop === "function") {
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  }
  return stops[stops.length >> 1][1];
}

export function carnivalWorld(d) {
  const { ellipse, circle, line, roundRect, hash, label } = d;
  const unit = (a, b) => hash(Math.round(a), b) / 997;

  // A filled polygon through points [x, y, x, y, ...].
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  // Every n of items spaced `spacing` apart from `offset` that reaches [x0, x1].
  function eachAt(x0, x1, spacing, offset, margin, fn) {
    for (let n = Math.floor((x0 - margin - offset) / spacing); n <= Math.ceil((x1 + margin - offset) / spacing); n++) fn(n * spacing + offset, n);
  }

  // The same, for scenery that scrolls at `p` of the camera's speed (drawn each frame).
  function far(cam, W, p, spacing, offset, margin, fn) {
    const lo = Math.floor((cam * p - margin - offset) / spacing);
    const hi = Math.ceil((cam * p + W + margin - offset) / spacing);
    for (let n = lo; n <= hi; n++) fn(cam + n * spacing + offset - cam * p, n);
  }

  // Stripes across a box, alternating `c1` and `c2`, `w` wide each.
  function stripes(ctx, x, y, w, h, sw, c1, c2, phase = 0) {
    for (let xs = 0, i = 0; xs < w; xs += sw, i++) {
      ctx.fillStyle = (i + phase) % 2 ? c2 : c1;
      ctx.fillRect(x + xs, y, Math.min(sw, w - xs) + 0.04, h);
    }
  }

  // A scalloped awning: stripes `sw` wide, `depth` deep, round at the bottom.
  function awning(ctx, x, y, w, depth, sw, c1, c2) {
    for (let xs = 0, i = 0; xs < w - 0.01; xs += sw, i++) {
      const ww = Math.min(sw, w - xs);
      ctx.fillStyle = i % 2 ? c2 : c1;
      ctx.fillRect(x + xs, y, ww + 0.04, depth);
      ellipse(ctx, x + xs + ww / 2, y + depth, ww / 2, ww * 0.42);
      ctx.fill();
    }
  }

  function bulb(ctx, x, y, color, glow, r = 0.42) {
    ctx.fillStyle = rgba(color, 0.2 * glow);
    circle(ctx, x, y, r * 3);
    ctx.fill();
    ctx.fillStyle = rgba(color, 0.9 * glow + 0.1);
    circle(ctx, x, y, r);
    ctx.fill();
    ctx.fillStyle = rgba("#ffffff", 0.7 * glow);
    circle(ctx, x - r * 0.25, y - r * 0.3, r * 0.4);
    ctx.fill();
  }

  /* ================================================================ midway */

  // The Ferris wheel's frame is `wheel(n)` away; one every 250 units on the sky.
  const WHEEL_SPACING = 250;
  const WHEEL_OFFSET = 140;
  const WHEEL_P = 0.5;

  function wheel(ctx, cx, cy, r, clock, H) {
    const a0 = clock / 7000;
    // The A-frame legs and the hub.
    ctx.strokeStyle = "#1a0e2a";
    ctx.lineWidth = 0.9;
    line(ctx, cx, cy, cx - 6.5, H - 6);
    line(ctx, cx, cy, cx + 6.5, H - 6);
    line(ctx, cx - 4.5, H - 11, cx + 4.5, H - 11);
    // The rim, double, and the spokes.
    ctx.strokeStyle = "#6a3a9a";
    ctx.lineWidth = 0.55;
    circle(ctx, cx, cy, r);
    ctx.stroke();
    circle(ctx, cx, cy, r * 0.62);
    ctx.stroke();
    ctx.lineWidth = 0.22;
    ctx.strokeStyle = "#8a58c0";
    for (let k = 0; k < 12; k++) line(ctx, cx, cy, cx + Math.cos(a0 + (k * TAU) / 12) * r, cy + Math.sin(a0 + (k * TAU) / 12) * r);
    // Lights around the rim, and the cars hanging from it.
    for (let k = 0; k < 24; k++) {
      const a = a0 + (k * TAU) / 24;
      const tw = 0.5 + 0.5 * Math.sin(clock / 260 + k * 1.7);
      ctx.fillStyle = rgba(BULBS[k % BULBS.length], 0.45 + 0.5 * tw);
      circle(ctx, cx + Math.cos(a) * (r + 0.3), cy + Math.sin(a) * (r + 0.3), 0.32);
      ctx.fill();
    }
    for (let k = 0; k < 12; k++) {
      const a = a0 + (k * TAU) / 12;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      ctx.strokeStyle = "#2a1640";
      ctx.lineWidth = 0.18;
      line(ctx, px, py, px, py + 1.2);
      ctx.fillStyle = PAL[k % PAL.length];
      roundRect(ctx, px - 1.1, py + 1.1, 2.2, 1.7, 0.5);
      ctx.fill();
      ctx.fillStyle = "#ffe9a8";
      ctx.fillRect(px - 0.7, py + 1.5, 1.4, 0.55);
    }
    ctx.fillStyle = "#c8a0f0";
    circle(ctx, cx, cy, 0.9);
    ctx.fill();
  }

  function sky(ctx, v, cam) {
    if (v.spec.id !== "midway") return;
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, "#05061a"], [0.45, "#1c0f40"], [0.8, "#4a1c52"], [1, "#7a2a58"]]);
    ctx.fillRect(cam - 1, 0, W + 2, H);
    // Stars, drifting a little slower than the field.
    for (let i = 0; i < 46; i++) {
      const sx = (((hash(i, 3) / 997) * W * 1.6 - cam * 0.18) % W + W) % W;
      const sy = (hash(i, 5) / 997) * H * 0.62;
      ctx.fillStyle = `rgba(240, 236, 255, ${0.3 + 0.28 * (i % 3) + 0.2 * Math.sin(v.clock / 600 + i * 1.9)})`;
      const s = 0.14 + (i % 3) * 0.07;
      ctx.fillRect(cam + sx, sy, s, s);
    }
    far(cam, W, WHEEL_P, WHEEL_SPACING, WHEEL_OFFSET, 24, (x, n) => wheel(ctx, x, 21 + (n % 2) * 1.5, 15.5, v.clock + n * 900, H));
  }

  // A pennant on a pole.
  function pennant(ctx, x, y, h, color) {
    ctx.strokeStyle = "#1a1220";
    ctx.lineWidth = 0.2;
    line(ctx, x, y, x, y - h);
    ctx.fillStyle = color;
    poly(ctx, [x, y - h, x + 2.6, y - h + 0.7, x, y - h + 1.4]);
    ctx.fill();
  }

  // A tent far back: a striped roof and a striped wall, in the night's colors.
  function farTent(ctx, cx, n, FY) {
    const c1 = shade(at(PAL, n), -0.6);
    const c2 = shade(CREAM, -0.72);
    const peak = 18 + (hash(n, 61) % 6);
    const wallTop = 32;
    const half = 17;
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? c2 : c1;
      const xa = cx - half + (k * 2 * half) / 8;
      const xb = xa + (2 * half) / 8;
      poly(ctx, [cx, peak, xa, wallTop, xb, wallTop]);
      ctx.fill();
    }
    stripes(ctx, cx - half + 1.4, wallTop, 2 * half - 2.8, FY - wallTop, 3, c1, c2);
    // The dark door and the scalloped valance.
    ctx.fillStyle = "#08040e";
    roundRect(ctx, cx - 3, FY - 8, 6, 8, [3, 3, 0, 0]);
    ctx.fill();
    awning(ctx, cx - half, wallTop, 2 * half, 1.4, 3, shade(at(PAL, n), -0.45), shade(CREAM, -0.6));
    pennant(ctx, cx, peak, 3.4, shade(at(PAL, n + 2), -0.1));
  }

  // One of four booths, centered on cx, its counter at `cy` (screen).
  function booth(ctx, cx, n, FY) {
    const kind = hash(n, 63) % 4;
    const base = PAL[hash(n, 64) % PAL.length];
    const top = 21;
    const cy = 41;
    // The posts and the painted back panel.
    ctx.fillStyle = "#1c1020";
    ctx.fillRect(cx - 11.6, top, 0.9, FY - top);
    ctx.fillRect(cx + 10.7, top, 0.9, FY - top);
    ctx.fillStyle = shade(base, -0.5);
    ctx.fillRect(cx - 10.8, top + 3, 21.6, cy - top - 3);
    ctx.fillStyle = shade(base, -0.3);
    ctx.fillRect(cx - 10.8, top + 3, 21.6, 0.5);
    if (kind === 0) {
      // Balloon darts: rows of balloons on a board, some already popped.
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 6; c++) {
          if (hash(n * 7 + r, c + 70) % 5 === 0) continue;
          ctx.fillStyle = shade(PAL[(r + c * 2) % PAL.length], -0.05);
          ellipse(ctx, cx - 8 + c * 3.2 + (r % 2) * 1.5, top + 8 + r * 3.4, 1.2, 1.5);
          ctx.fill();
          ctx.fillStyle = "rgba(255,255,255,0.45)";
          circle(ctx, cx - 8.4 + c * 3.2 + (r % 2) * 1.5, top + 7.4 + r * 3.4, 0.3);
          ctx.fill();
        }
      }
      label(ctx, "DARTS", cx, top + 1.2, 1.7, GOLD, "center", 12);
    } else if (kind === 1) {
      // Ring toss: shelves of bottles.
      for (let r = 0; r < 2; r++) {
        ctx.fillStyle = shade("#6a4a2a", -0.2);
        ctx.fillRect(cx - 9.8, top + 9 + r * 5, 19.6, 0.6);
        for (let c = 0; c < 9; c++) {
          ctx.fillStyle = shade(PAL[(c + r * 3) % PAL.length], -0.1);
          ctx.fillRect(cx - 9 + c * 2.2, top + 6.4 + r * 5, 0.9, 2.6);
          ctx.fillRect(cx - 8.8 + c * 2.2, top + 5.8 + r * 5, 0.5, 0.8);
        }
      }
      label(ctx, "RING TOSS", cx, top + 1.2, 1.6, GOLD, "center", 15);
    } else if (kind === 2) {
      // Test your strength: a tall tower with a bell on top.
      const tx = cx + 5;
      ctx.fillStyle = "#1c1020";
      ctx.fillRect(tx - 1.6, 7, 3.2, FY - 7);
      ctx.fillStyle = "#c8c0b0";
      ctx.fillRect(tx - 0.5, 9, 1, FY - 14);
      for (let k = 0; k < 9; k++) {
        ctx.fillStyle = k > 6 ? "#ff5a3a" : k > 3 ? "#ffd23a" : "#6ad87a";
        circle(ctx, tx, 11 + k * 3.1, 0.55);
        ctx.fill();
      }
      ctx.fillStyle = "#e8c040";
      poly(ctx, [tx - 1.5, 9, tx + 1.5, 9, tx + 1, 6.4, tx - 1, 6.4]);
      ctx.fill();
      circle(ctx, tx, 6, 0.4);
      ctx.fill();
      label(ctx, "STRENGTH", cx - 3.4, top + 1.2, 1.4, GOLD, "center", 11);
      // The hammer leaning on the counter.
      ctx.fillStyle = "#6a4a2a";
      ctx.fillRect(cx - 8.2, cy - 6, 0.7, 6);
      ctx.fillStyle = "#8a8a98";
      ctx.fillRect(cx - 9.4, cy - 7.2, 3.1, 1.8);
    } else {
      // Prizes: a row of plush toys, and ducks in a row.
      for (let c = 0; c < 6; c++) {
        ctx.fillStyle = shade(PAL[(c + 2) % PAL.length], 0.05);
        circle(ctx, cx - 8.2 + c * 3.3, top + 8.4, 1.4);
        ctx.fill();
        circle(ctx, cx - 8.2 + c * 3.3, top + 6.6, 0.9);
        ctx.fill();
        ctx.fillStyle = "#14101c";
        ctx.fillRect(cx - 8.6 + c * 3.3, top + 6.4, 0.3, 0.3);
        ctx.fillRect(cx - 7.8 + c * 3.3, top + 6.4, 0.3, 0.3);
      }
      ctx.fillStyle = shade("#e8c040", -0.25);
      for (let c = 0; c < 5; c++) {
        ellipse(ctx, cx - 7 + c * 3.6, top + 13, 1.2, 0.8);
        ctx.fill();
        circle(ctx, cx - 6.2 + c * 3.6, top + 12.2, 0.5);
        ctx.fill();
      }
      label(ctx, "WIN A PRIZE", cx, top + 1.2, 1.5, GOLD, "center", 17);
    }
    // The counter: its top, its striped front.
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(cx - 11.8, cy - 0.5, 23.6, 0.9);
    ctx.fillStyle = shade("#6a4a2a", 0.3);
    ctx.fillRect(cx - 11.8, cy - 0.5, 23.6, 0.25);
    stripes(ctx, cx - 11.4, cy + 0.4, 22.8, FY - cy - 0.4, 2.3, shade(base, -0.2), shade(CREAM, -0.45));
    // The awning over it.
    awning(ctx, cx - 13.5, top - 0.5, 27, 2.6, 3, base, shade(CREAM, -0.1));
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(cx - 13.5, top + 2.4, 27, 0.7);
  }

  // The swag of wire between two poles `i` and `i+1`: the point `t` of the way along it.
  const SWAG = 32;
  function swagAt(i, t) {
    const x = i * SWAG + t * SWAG;
    return [x, 11 + 5.2 * 4 * t * (1 - t) - 0.0];
  }

  function backdropMidway(ctx, v, look, x0, x1, H) {
    const FY = H - 6;
    // A dusty, dim ground behind the booths, so the sky never shows through low down.
    ctx.fillStyle = grad(ctx, 0, FY - 10, 0, FY, [[0, "rgba(40, 14, 40, 0)"], [1, "#26122a"]]);
    ctx.fillRect(x0, FY - 10, x1 - x0, 10);
    eachAt(x0, x1, 52, 20, 24, (cx, n) => farTent(ctx, cx, n, FY));
    eachAt(x0, x1, 38, 14, 18, (cx, n) => booth(ctx, cx + (hash(n, 62) % 5) - 2, n, FY));
    // Poles and the wire between them.
    eachAt(x0, x1, SWAG, 0, 6, (px, i) => {
      ctx.fillStyle = "#1c1020";
      ctx.fillRect(px - 0.35, 9.4, 0.7, FY - 9.4);
      ctx.fillStyle = GOLD_DK;
      circle(ctx, px, 9.4, 0.8);
      ctx.fill();
      ctx.strokeStyle = "#0e0814";
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(px, 11);
      ctx.quadraticCurveTo(px + SWAG / 2, 11 + 10.4, px + SWAG, 11);
      ctx.stroke();
    });
  }

  function groundMidway(ctx, v, look, a, b, top, H) {
    const fy = H - top;
    // Sawdust, straw, tickets and the dark of trodden dirt.
    for (let x = Math.ceil(a / 1.3) * 1.3; x < b - 0.2; x += 1.3) {
      const h = hash(Math.round(x * 5), 90);
      if (h % 3 === 0) continue;
      ctx.fillStyle = h % 3 === 1 ? shade(look.floorTop, 0.25) : shade(look.floorTop, -0.3);
      ctx.fillRect(x + (h % 7) * 0.1, fy + 0.15 + (h % 4) * 0.22, 0.45 + (h % 3) * 0.2, 0.14);
    }
    for (let x = Math.ceil(a / 9) * 9; x < b - 1; x += 9) {
      const h = hash(Math.round(x), 91);
      if (h % 4) continue;
      ctx.fillStyle = PAL[h % PAL.length];
      ctx.fillRect(x + (h % 3), fy - 0.12, 0.7, 0.18);
    }
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    for (let x = Math.ceil(a / 17) * 17 + 3; x < b - 4; x += 17) {
      if (hash(Math.round(x), 92) % 2) continue;
      ellipse(ctx, x, fy + 0.6, 2.8, 0.22);
      ctx.fill();
    }
    ctx.fillStyle = rgba("#ffe9a8", 0.35);
    ctx.fillRect(a, fy, b - a, 0.14);
  }

  function shelfMidway(ctx, v, look, a, b, y) {
    const base = PAL[hash(Math.round(a), 65) % PAL.length];
    // The striped valance under the top plank, scalloped.
    awning(ctx, a, y + 0.7, b - a, 1.2, 1.9, shade(base, -0.1), shade(CREAM, -0.12));
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(a, y + 0.7, b - a, 0.35);
    // The plank, bright on top so it reads against the booths behind.
    ctx.fillStyle = "#7a5230";
    ctx.fillRect(a - 0.3, y, b - a + 0.6, 0.8);
    ctx.fillStyle = "#ffe0a0";
    ctx.fillRect(a - 0.3, y, b - a + 0.6, 0.28);
    ctx.fillStyle = "#3a2210";
    ctx.fillRect(a - 0.3, y + 0.62, b - a + 0.6, 0.18);
  }

  /* ================================================================ mirrors */

  const PANEL = 22;

  function mirrorPanel(ctx, cx, n, H) {
    const top = 6;
    const bot = H - 9;
    const w = 14;
    const x = cx - w / 2;
    const variant = hash(n, 71) % 4;
    // The gilded frame, arched at the top.
    ctx.fillStyle = GOLD_DK;
    roundRect(ctx, x - 1.3, top - 1.3, w + 2.6, bot - top + 2.6, [w / 2 + 1.3, w / 2 + 1.3, 0.6, 0.6]);
    ctx.fill();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.32;
    roundRect(ctx, x - 0.9, top - 0.9, w + 1.8, bot - top + 1.8, [w / 2 + 0.9, w / 2 + 0.9, 0.4, 0.4]);
    ctx.stroke();
    // The glass and what it holds.
    ctx.save();
    roundRect(ctx, x, top, w, bot - top, [w / 2, w / 2, 0, 0]);
    ctx.fill();
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.fillStyle = grad(ctx, 0, top, 0, bot, [[0, "#4a5a8a"], [0.5, "#2c3660"], [1, "#161c36"]]);
    ctx.fillRect(x, top, w, bot - top);
    // A warped copy of the hall: sconce lights and the far panels as pale uprights, bent.
    ctx.lineWidth = 0.3;
    ctx.strokeStyle = "rgba(190, 210, 255, 0.22)";
    for (const off of [-4.2, 4.2]) {
      ctx.beginPath();
      for (let yy = top; yy <= bot; yy += 2) {
        const px = cx + off + Math.sin(yy * (variant === 1 ? 0.55 : 0.25) + n) * (variant === 1 ? 1.4 : 0.6);
        if (yy === top) ctx.moveTo(px, yy);
        else ctx.lineTo(px, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(255, 214, 140, 0.4)";
    ellipse(ctx, cx + (variant - 1.5) * 1.6, top + 11, 0.9, variant === 2 ? 0.9 : 2.6);
    ctx.fill();
    ellipse(ctx, cx - (variant - 1.5) * 1.2, top + 22, 0.7, variant === 2 ? 0.7 : 2);
    ctx.fill();
    // The reflected floor: tiles squeezed toward a point.
    ctx.strokeStyle = "rgba(170, 190, 255, 0.2)";
    ctx.lineWidth = 0.18;
    for (let k = -3; k <= 3; k++) line(ctx, cx + k * 1.6, bot - 5, cx + k * 3.4, bot);
    for (let k = 0; k < 3; k++) line(ctx, x, bot - 4 + k * 1.6, x + w, bot - 4 + k * 1.6);
    // A figure that is not quite there, in some of them.
    if (hash(n, 72) % 4 === 0) {
      ctx.fillStyle = "rgba(6, 8, 20, 0.5)";
      circle(ctx, cx + 1, bot - 13.5, 1.5);
      ctx.fill();
      roundRect(ctx, cx - 1.6, bot - 12, 5, 8, 1.2);
      ctx.fill();
      ctx.fillRect(cx - 1.2, bot - 4, 1.6, 4);
      ctx.fillRect(cx + 1.2, bot - 4, 1.6, 4);
    }
    // Cracks.
    if (variant === 3 || hash(n, 73) % 3 === 0) {
      const px = cx + ((hash(n, 74) % 7) - 3);
      const py = top + 14 + (hash(n, 75) % 8);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 0.14;
      for (let k = 0; k < 7; k++) {
        const ang = (k * TAU) / 7 + (hash(n, 76 + k) % 10) * 0.05;
        ctx.beginPath();
        ctx.moveTo(px, py);
        let cxx = px;
        let cyy = py;
        for (let s = 0; s < 4; s++) {
          cxx += Math.cos(ang + (s % 2 ? 0.25 : -0.25)) * (1.4 + s * 0.8);
          cyy += Math.sin(ang + (s % 2 ? 0.25 : -0.25)) * (1.4 + s * 0.8);
          ctx.lineTo(cxx, cyy);
        }
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(4, 4, 12, 0.75)";
      poly(ctx, [px, py, px + 2.4, py + 0.4, px + 1.2, py + 2.6]);
      ctx.fill();
    }
    // The gloss on the glass.
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    poly(ctx, [x, top, x + 5, top, x + 1, bot, x, bot]);
    ctx.fill();
    ctx.restore();
    // The frame's jewels.
    ctx.fillStyle = "#ff6a8a";
    circle(ctx, cx, top - 1.1, 0.6);
    ctx.fill();
    ctx.fillStyle = "#7ad0ff";
    for (const s of [-1, 1]) {
      circle(ctx, cx + s * (w / 2 + 0.2), bot - 4, 0.5);
      ctx.fill();
    }
  }

  function chandelier(ctx, cx) {
    ctx.strokeStyle = "#5a4a2a";
    ctx.lineWidth = 0.18;
    line(ctx, cx, 0, cx, 2.8);
    ctx.fillStyle = GOLD;
    ellipse(ctx, cx, 3.4, 3.2, 0.6);
    ctx.fill();
    ctx.fillStyle = "#fff0c0";
    for (const dx of [-2.6, -1.3, 0, 1.3, 2.6]) ctx.fillRect(cx + dx - 0.18, 2.4, 0.36, 1);
    ctx.fillStyle = "rgba(220, 235, 255, 0.8)";
    for (const dx of [-2.4, -1.2, 0, 1.2, 2.4]) {
      poly(ctx, [cx + dx - 0.25, 3.8, cx + dx + 0.25, 3.8, cx + dx, 5.2 + Math.abs(dx) * 0.2]);
      ctx.fill();
    }
  }

  function backdropMirrors(ctx, v, look, x0, x1, H) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, look.wallTop], [1, look.wallLow]]);
    ctx.fillRect(x0, 0, x1 - x0, H);
    // The cornice and its gold line.
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(x0, 0, x1 - x0, 3.4);
    ctx.fillStyle = GOLD_DK;
    ctx.fillRect(x0, 3.2, x1 - x0, 0.7);
    ctx.fillStyle = GOLD;
    ctx.fillRect(x0, 3.2, x1 - x0, 0.22);
    // Pilasters between the panels, fluted, with gold capitals and bases.
    eachAt(x0, x1, PANEL, PANEL / 2 + PANEL / 2, 6, (px) => {
      ctx.fillStyle = "#14121e";
      ctx.fillRect(px - 3, 4, 6, H - 12);
      ctx.fillStyle = "#222036";
      for (let k = -2; k <= 2; k++) ctx.fillRect(px + k * 1.1 - 0.2, 4.6, 0.4, H - 14);
      ctx.fillStyle = GOLD_DK;
      ctx.fillRect(px - 3.6, 4, 7.2, 1.2);
      ctx.fillRect(px - 3.6, H - 10.2, 7.2, 1.4);
      ctx.fillStyle = GOLD;
      ctx.fillRect(px - 3.6, 4, 7.2, 0.3);
    });
    eachAt(x0, x1, PANEL, PANEL / 2, 10, (cx, n) => mirrorPanel(ctx, cx, n, H));
    eachAt(x0, x1, 66, 33, 8, (cx) => chandelier(ctx, cx));
    // The plinth along the bottom.
    ctx.fillStyle = "#12101c";
    ctx.fillRect(x0, H - 9, x1 - x0, 3.1);
    ctx.fillStyle = GOLD_DK;
    ctx.fillRect(x0, H - 9, x1 - x0, 0.5);
  }

  function groundMirrors(ctx, v, look, a, b, top, H) {
    const fy = H - top;
    // A checkerboard on the face, polished.
    const rows = Math.max(1, Math.floor((top - 1.1) / 1.6));
    for (let r = 0; r < rows; r++) {
      for (let x = Math.floor(a / 2.6) * 2.6, i = Math.floor(a / 2.6); x < b; x += 2.6, i++) {
        if ((i + r) % 2) continue;
        ctx.fillStyle = r === 0 ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.07)";
        ctx.fillRect(Math.max(a, x), fy + 1.35 + r * 1.6, Math.min(b, x + 2.6) - Math.max(a, x), 1.6);
      }
    }
    // The top strip as black and white tiles.
    for (let x = Math.floor(a / 2.6) * 2.6, i = Math.floor(a / 2.6); x < b; x += 2.6, i++) {
      ctx.fillStyle = i % 2 ? "#c8cce0" : "#2a2e48";
      ctx.fillRect(Math.max(a, x), fy, Math.min(b, x + 2.6) - Math.max(a, x), 0.5);
    }
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fillRect(a, fy, b - a, 0.12);
  }

  function shelfMirrors(ctx, v, look, a, b, y) {
    // A gilded ledge: bright top, a carved frieze, a corbel at each end.
    ctx.fillStyle = GOLD_DK;
    ctx.fillRect(a - 0.3, y, b - a + 0.6, 0.9);
    ctx.fillStyle = "#ffe9a0";
    ctx.fillRect(a - 0.3, y, b - a + 0.6, 0.3);
    ctx.fillStyle = "#1a1420";
    ctx.fillRect(a, y + 0.9, b - a, 0.9);
    ctx.fillStyle = GOLD;
    for (let x = a + 0.6; x < b - 0.4; x += 1.2) {
      poly(ctx, [x, y + 1.35, x + 0.45, y + 0.95, x + 0.9, y + 1.35, x + 0.45, y + 1.75]);
      ctx.fill();
    }
    for (const [cx, dir] of [[a, 1], [b, -1]]) {
      ctx.fillStyle = GOLD_DK;
      poly(ctx, [cx, y + 0.9, cx + dir * 1.6, y + 0.9, cx, y + 3.2]);
      ctx.fill();
      ctx.fillStyle = GOLD;
      circle(ctx, cx + dir * 0.4, y + 1.7, 0.35);
      ctx.fill();
    }
  }

  /* ================================================================ funhouse */

  function backdropFunhouse(ctx, v, look, x0, x1, H) {
    const FY = H - 6;
    ctx.fillStyle = "#1a0e2a";
    ctx.fillRect(x0, 0, x1 - x0, H);
    // Crooked bands of wall, each leaning its own way.
    eachAt(x0, x1, 10, 0, 14, (bx, n) => {
      const lean = Math.sin(n * 0.83) * 5 + ((n % 3) - 1) * 1.5;
      const c = at(FUN, n);
      ctx.fillStyle = shade(c, -0.38);
      poly(ctx, [bx + lean, 0, bx + 10.4 + lean, 0, bx + 10.4 - lean * 0.4, FY, bx - lean * 0.4, FY]);
      ctx.fill();
      // A lighter stripe and polka dots on each band.
      ctx.fillStyle = shade(c, -0.15);
      poly(ctx, [bx + 2 + lean, 0, bx + 4.2 + lean, 0, bx + 4.2 - lean * 0.4, FY, bx + 2 - lean * 0.4, FY]);
      ctx.fill();
      ctx.fillStyle = rgba("#ffffff", 0.22);
      for (let k = 0; k < 5; k++) {
        const yy = 7 + k * 8 + (n % 2) * 3.5;
        circle(ctx, bx + 6.5 + lean * (1 - yy / FY * 1.4), yy, 0.9);
        ctx.fill();
      }
    });
    // Rafters across the top, with a chain here and there.
    ctx.fillStyle = "#0e0818";
    ctx.fillRect(x0, 0, x1 - x0, 3);
    ctx.fillStyle = "#2a1c3a";
    ctx.fillRect(x0, 2.7, x1 - x0, 0.3);
    eachAt(x0, x1, 18, 6, 4, (cx, n) => {
      ctx.fillStyle = "#1a1228";
      ctx.fillRect(cx - 0.5, 0, 1, 4 + (n % 3) * 3);
    });
    // A waist-high wavy checker.
    eachAt(x0, x1, 3, 0, 4, (cx, n) => {
      const wob = Math.sin(cx * 0.21) * 0.9;
      for (let r = 0; r < 3; r++) {
        ctx.fillStyle = (n + r) % 2 ? "#a890c8" : "#2a1448";
        ctx.fillRect(cx, FY - 8.4 + r * 2.8 + wob, 3.04, 2.8);
      }
    });
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x0, FY - 8.6, x1 - x0, 0.5);
    // Tilted funny-mirror frames on the wall.
    eachAt(x0, x1, 58, 31, 12, (cx, n) => {
      ctx.save();
      ctx.translate(cx, 21);
      ctx.rotate(((n % 2) * 2 - 1) * 0.16);
      ctx.fillStyle = "#e8c040";
      roundRect(ctx, -5.6, -9.4, 11.2, 18.8, 1);
      ctx.fill();
      ctx.fillStyle = "#4a2a7a";
      ctx.fillRect(-4.6, -8.4, 9.2, 16.8);
      for (let k = 0; k < 8; k++) {
        ctx.fillStyle = k % 2 ? "rgba(255, 150, 220, 0.5)" : "rgba(120, 230, 255, 0.5)";
        ctx.beginPath();
        ctx.moveTo(-4.6, -8.4 + k * 2.1);
        for (let s = 0; s <= 8; s++) ctx.lineTo(-4.6 + s * 1.15, -8.4 + k * 2.1 + Math.sin(s + k) * 0.7);
        ctx.lineTo(4.6, -8.4 + k * 2.1 + 1);
        ctx.lineTo(-4.6, -8.4 + k * 2.1 + 1);
        ctx.fill();
      }
      ctx.restore();
    });
    // The clown's mouth around the way out.
    const door = v.spec.door;
    if (door > x0 - 24 && door < x1 + 24) clown(ctx, door, H - v.groundAt(v.spec, door));
  }

  // A huge clown face looming over the exit, its open mouth the doorway.
  function clown(ctx, dx, fy) {
    const cy = fy - 25;
    // Hair, curls either side.
    for (const s of [-1, 1]) {
      for (const [ox, oy, r, c] of [[16, -12, 5.2, "#ff7a1a"], [19, -2, 5, "#ff3a8a"], [18, 9, 4.6, "#ff7a1a"], [13, -19, 4.6, "#ff3a8a"]]) {
        ctx.fillStyle = c;
        circle(ctx, dx + s * ox, cy + oy, r);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.18)";
        circle(ctx, dx + s * ox - 1, cy + oy - 1.2, r * 0.45);
        ctx.fill();
      }
    }
    // The cone hat with polka dots.
    ctx.fillStyle = "#2a5ac8";
    poly(ctx, [dx - 9, cy - 17, dx + 9, cy - 17, dx + 1.5, cy - 29]);
    ctx.fill();
    ctx.fillStyle = "#ffe14a";
    for (const [ox, oy] of [[-3.5, -20], [2, -22], [0, -25.5], [4, -19]]) {
      circle(ctx, dx + ox, cy + oy + 1, 0.9);
      ctx.fill();
    }
    ctx.fillStyle = "#ff3a8a";
    circle(ctx, dx + 1.5, cy - 29.4, 1.4);
    ctx.fill();
    // The white face, shaded at the edge.
    ctx.fillStyle = "#e8dcd8";
    ellipse(ctx, dx, cy, 17.4, 22);
    ctx.fill();
    ctx.fillStyle = "#f6eee8";
    ellipse(ctx, dx - 1.4, cy - 2.4, 14.4, 19);
    ctx.fill();
    // Cheeks.
    ctx.fillStyle = "rgba(230, 40, 80, 0.55)";
    for (const s of [-1, 1]) {
      circle(ctx, dx + s * 11, cy + 1, 4);
      ctx.fill();
    }
    // The eyes: blue diamonds painted over them, white with wandering irises.
    for (const s of [-1, 1]) {
      ctx.fillStyle = "#2a5ac8";
      poly(ctx, [dx + s * 7, cy - 17, dx + s * 11.6, cy - 8.6, dx + s * 7, cy - 1, dx + s * 2.6, cy - 8.6]);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ellipse(ctx, dx + s * 7, cy - 8.6, 3.9, 4.6);
      ctx.fill();
      ctx.fillStyle = "#1a8a3a";
      circle(ctx, dx + s * 7 + (s > 0 ? -1.2 : 1.4), cy - 8.2, 1.9);
      ctx.fill();
      ctx.fillStyle = "#08040e";
      circle(ctx, dx + s * 7 + (s > 0 ? -1.2 : 1.4), cy - 8.2, 0.9);
      ctx.fill();
      ctx.strokeStyle = "#08040e";
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(dx + s * 2.6, cy - 14.4);
      ctx.quadraticCurveTo(dx + s * 7, cy - 18.6 - s * 0.6, dx + s * 11.6, cy - 13);
      ctx.stroke();
    }
    // The nose.
    ctx.fillStyle = "#e0203a";
    circle(ctx, dx, cy + 2.4, 3.1);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    circle(ctx, dx - 1, cy + 1.2, 0.9);
    ctx.fill();
    // Lips round the doorway, the dark mouth, the teeth.
    ctx.fillStyle = "#d81f3a";
    roundRect(ctx, dx - 9.4, fy - 18.6, 18.8, 20.6, 9.4);
    ctx.fill();
    ctx.fillStyle = "#ff5a6a";
    roundRect(ctx, dx - 8.4, fy - 17.8, 16.8, 2.2, 1);
    ctx.fill();
    ctx.fillStyle = "#1a040c";
    roundRect(ctx, dx - 6.6, fy - 16, 13.2, 16.6, [6.6, 6.6, 0.6, 0.6]);
    ctx.fill();
    ctx.fillStyle = "#fffaf0";
    for (let k = 0; k < 5; k++) {
      roundRect(ctx, dx - 6 + k * 2.4, fy - 16, 2.2, 3.2, [0, 0, 0.8, 0.8]);
      ctx.fill();
    }
    ctx.strokeStyle = "#8a1428";
    ctx.lineWidth = 0.3;
    roundRect(ctx, dx - 9.4, fy - 18.6, 18.8, 20.6, 9.4);
    ctx.stroke();
  }

  function groundFunhouse(ctx, v, look, a, b, top, H) {
    const fy = H - top;
    // A checkered top and face.
    for (let x = Math.floor(a / 2.4) * 2.4, i = Math.floor(a / 2.4); x < b; x += 2.4, i++) {
      const xa = Math.max(a, x);
      const xb = Math.min(b, x + 2.4);
      ctx.fillStyle = i % 2 ? "rgba(255, 255, 255, 0.55)" : "rgba(0, 0, 0, 0.35)";
      ctx.fillRect(xa, fy, xb - xa, 0.6);
      const rows = Math.max(1, Math.floor((top - 1.1) / 1.4));
      for (let r = 0; r < rows; r++) {
        if ((i + r) % 2) continue;
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(xa, fy + 1.3 + r * 1.4, xb - xa, 1.4);
      }
    }
    // The belts' beds: a dark tread housing with end rollers and hazard stripes.
    for (const [bx0, bx1] of v.spec.belts || []) {
      const s0 = Math.max(a, bx0);
      const s1 = Math.min(b, bx1);
      if (s1 <= s0) continue;
      ctx.fillStyle = "#0e0a16";
      ctx.fillRect(s0, fy - 0.2, s1 - s0, 1.5);
      ctx.fillStyle = "#2a2438";
      ctx.fillRect(s0, fy - 0.2, s1 - s0, 0.22);
      for (let x = Math.ceil(s0 / 1.6) * 1.6; x < s1 - 0.8; x += 1.6) {
        ctx.fillStyle = Math.round(x / 1.6) % 2 ? "#ffd23a" : "#1a1420";
        poly(ctx, [x, fy + 1.3, x + 0.8, fy + 1.3, x + 1.2, fy + 1.9, x + 0.4, fy + 1.9]);
        ctx.fill();
      }
      if (s0 === bx0 || s1 === bx1) {
        for (const ex of [bx0, bx1]) {
          if (ex < a || ex > b) continue;
          ctx.fillStyle = "#6a6a7a";
          circle(ctx, ex, fy + 0.45, 0.75);
          ctx.fill();
          ctx.fillStyle = "#b8b8c8";
          circle(ctx, ex - 0.2, fy + 0.25, 0.25);
          ctx.fill();
        }
      }
    }
  }

  function shelfFunhouse(ctx, v, look, a, b, y) {
    const n = Math.round(a);
    const c1 = FUN[hash(n, 81) % FUN.length];
    const c2 = FUN[(hash(n, 81) + 2) % FUN.length];
    // The flat top stays flat; the fascia under it is skewed, in clashing colors with dots.
    const sk = ((hash(n, 82) % 2) * 2 - 1) * 0.9;
    for (let x = a, i = 0; x < b; x += 2.4, i++) {
      const xe = Math.min(b, x + 2.4);
      ctx.fillStyle = i % 2 ? c1 : c2;
      poly(ctx, [x, y + 0.8, xe, y + 0.8, xe + sk, y + 2.6, x + sk, y + 2.6]);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    for (let x = a + 1; x < b - 0.5; x += 2.4) {
      circle(ctx, x + sk * 0.5, y + 1.7, 0.3);
      ctx.fill();
    }
    ctx.fillStyle = "#2a1448";
    ctx.fillRect(a - 0.3, y, b - a + 0.6, 0.9);
    ctx.fillStyle = "#fff0a0";
    ctx.fillRect(a - 0.3, y, b - a + 0.6, 0.3);
  }

  /* ================================================================ big top */

  function crowd(ctx, x0, x1, H) {
    // Three tiers of stands, dark, with silhouettes of the audience; a few cheer.
    for (let t = 0; t < 3; t++) {
      const ty = 29 + t * 5;
      ctx.fillStyle = shade("#3a0a14", -0.3 + t * 0.05);
      ctx.fillRect(x0, ty, x1 - x0, 5.4);
      ctx.fillStyle = "rgba(255, 170, 120, 0.2)";
      ctx.fillRect(x0, ty, x1 - x0, 0.22);
      eachAt(x0, x1, 2.6, t * 1.1, 3, (px, n) => {
        const h = hash(n + t * 31, 91);
        if (h % 7 === 0) return;
        ctx.fillStyle = shade(PAL[h % PAL.length], -0.82);
        ellipse(ctx, px, ty + 3.4, 1.15, 1.5);
        ctx.fill();
        ctx.fillStyle = shade("#d8a888", -0.72);
        circle(ctx, px, ty + 1.45, 0.72);
        ctx.fill();
        if (h % 5 === 0) {
          ctx.strokeStyle = shade("#d8a888", -0.72);
          ctx.lineWidth = 0.22;
          line(ctx, px + 0.9, ty + 2.6, px + 1.6, ty + 0.4);
        }
      });
    }
  }

  function backdropBigtop(ctx, v, look, x0, x1, H) {
    const arena = v.spec.arena;
    const FY = H - 6;
    ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, "#12040a"], [0.5, look.wallLow], [1, "#3a0a12"]]);
    ctx.fillRect(x0, 0, x1 - x0, H);
    // Canvas stripes leaning in toward the tent pole.
    const apex = arena + 48;
    eachAt(x0, x1, 8, 0, 18, (sx, n) => {
      const shiftTop = clamp((apex - sx) * 0.3, -16, 16);
      ctx.fillStyle = n % 2 ? shade("#e8d8c0", -0.72) : shade("#c01828", -0.5);
      poly(ctx, [sx + shiftTop, -1, sx + shiftTop + 8.04, -1, sx + 8.04, 31, sx, 31]);
      ctx.fill();
    });
    ctx.fillStyle = grad(ctx, 0, 0, 0, 31, [[0, "rgba(0,0,0,0.6)"], [1, "rgba(0,0,0,0)"]]);
    ctx.fillRect(x0, 0, x1 - x0, 31);
    // The scalloped valance where the canvas meets the stands.
    awning(ctx, Math.floor(x0 / 8) * 8, 27.4, Math.ceil((x1 - x0) / 8) * 8 + 8, 1.8, 4, "#a01020", shade(CREAM, -0.3));
    crowd(ctx, x0, x1, H);
    // The stands' front rail and the wall under them.
    ctx.fillStyle = "#1a0608";
    ctx.fillRect(x0, 44, x1 - x0, H - 44);
    ctx.fillStyle = GOLD_DK;
    ctx.fillRect(x0, 44.2, x1 - x0, 0.45);
    eachAt(x0, x1, 3, 0, 4, (px, n) => {
      ctx.fillStyle = n % 2 ? "#8a8070" : "#6a0e18";
      ctx.fillRect(px, 44.8, 3.04, 3.2);
    });
    // The center pole, wrapped in stripes, and the guy rope's hint at the top.
    if (apex > x0 - 4 && apex < x1 + 4) {
      for (let yy = 0, i = 0; yy < 44; yy += 3, i++) {
        ctx.fillStyle = i % 2 ? "#f2e8d0" : "#c01828";
        poly(ctx, [apex - 1.7, yy + 1.5, apex + 1.7, yy, apex + 1.7, yy + 3, apex - 1.7, yy + 4.5]);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(apex, 0, 1.7, 44);
      ctx.fillStyle = GOLD;
      circle(ctx, apex, 0.4, 1.6);
      ctx.fill();
    }
    // The gantry rail high over the ring (the Ringmaster's platform rides it): a truss
    // under his feet at 34, hung from the roof.
    const gy = H - 34 + 0.5;
    const gx0 = Math.max(x0, arena + 2);
    const gx1 = Math.min(x1, v.spec.length - 1);
    if (gx1 > gx0) {
      ctx.fillStyle = "#2a2a34";
      ctx.fillRect(gx0, gy, gx1 - gx0, 0.7);
      ctx.fillRect(gx0, gy + 2.2, gx1 - gx0, 0.5);
      ctx.fillStyle = "#6a6a7a";
      ctx.fillRect(gx0, gy, gx1 - gx0, 0.2);
      ctx.strokeStyle = "#3a3a46";
      ctx.lineWidth = 0.22;
      for (let x = Math.ceil(gx0 / 3) * 3; x < gx1; x += 3) {
        ctx.beginPath();
        ctx.moveTo(x, gy + 0.6);
        ctx.lineTo(x + 1.5, gy + 2.3);
        ctx.lineTo(x + 3, gy + 0.6);
        ctx.stroke();
      }
      ctx.strokeStyle = "#1c1c24";
      ctx.lineWidth = 0.4;
      for (let x = Math.ceil(gx0 / 24) * 24; x < gx1; x += 24) line(ctx, x, -1, x, gy);
    }
  }

  function groundBigtop(ctx, v, look, a, b, top, H) {
    const fy = H - top;
    const arena = v.spec.arena;
    // Sawdust.
    for (let x = Math.ceil(a / 1.2) * 1.2; x < b - 0.2; x += 1.2) {
      const h = hash(Math.round(x * 5), 93);
      if (h % 3 === 0) continue;
      ctx.fillStyle = h % 3 === 1 ? shade(look.floorTop, 0.25) : shade(look.floorTop, -0.3);
      ctx.fillRect(x + (h % 7) * 0.1, fy + 0.15 + (h % 4) * 0.22, 0.4 + (h % 3) * 0.2, 0.14);
    }
    // The ring's curb across the arena: red and white blocks on the face.
    const ra = Math.max(a, arena + 3);
    const rb = Math.min(b, v.spec.length - 3);
    if (rb > ra) {
      for (let x = Math.floor(ra / 3) * 3, i = Math.floor(ra / 3); x < rb; x += 3, i++) {
        const xa = Math.max(ra, x);
        const xb = Math.min(rb, x + 3);
        ctx.fillStyle = i % 2 ? "#f2e8d0" : "#c01828";
        ctx.fillRect(xa, fy + 1.1, xb - xa, 1.3);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.fillRect(xa, fy + 1.1, xb - xa, 0.25);
      }
      ctx.fillStyle = "rgba(255, 233, 160, 0.4)";
      ctx.fillRect(ra, fy, rb - ra, 0.16);
    }
  }

  // A trapeze board hung on two ropes from the roof.
  function shelfBigtop(ctx, v, look, a, b, y) {
    ctx.strokeStyle = "#c8b890";
    ctx.lineWidth = 0.28;
    for (const rx of [a + 1.1, b - 1.1]) {
      line(ctx, rx, -1, rx, y);
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 0.1;
      line(ctx, rx + 0.14, -1, rx + 0.14, y);
      ctx.strokeStyle = "#c8b890";
      ctx.lineWidth = 0.28;
    }
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(a - 0.2, y, b - a + 0.4, 0.9);
    ctx.fillStyle = "#ffe0a0";
    ctx.fillRect(a - 0.2, y, b - a + 0.4, 0.3);
    for (let x = a, i = 0; x < b; x += 1.6, i++) {
      ctx.fillStyle = i % 2 ? "#f2e8d0" : "#c01828";
      ctx.fillRect(x, y + 0.9, Math.min(1.6, b - x), 0.5);
    }
    ctx.fillStyle = GOLD;
    for (const rx of [a + 1.1, b - 1.1]) {
      circle(ctx, rx, y + 0.45, 0.5);
      ctx.fill();
    }
  }

  /* ================================================================ the hooks */

  function backdrop(ctx, v, look, x0, x1) {
    const id = v.spec.id;
    const H = v.g.FIELD_H;
    if (id === "midway") backdropMidway(ctx, v, look, x0, x1, H);
    else if (id === "mirrors") backdropMirrors(ctx, v, look, x0, x1, H);
    else if (id === "funhouse") backdropFunhouse(ctx, v, look, x0, x1, H);
    else if (id === "bigtop") backdropBigtop(ctx, v, look, x0, x1, H);
  }

  function ground(ctx, v, look, a, b, top) {
    const id = v.spec.id;
    const H = v.g.FIELD_H;
    if (id === "midway") groundMidway(ctx, v, look, a, b, top, H);
    else if (id === "mirrors") groundMirrors(ctx, v, look, a, b, top, H);
    else if (id === "funhouse") groundFunhouse(ctx, v, look, a, b, top, H);
    else if (id === "bigtop") groundBigtop(ctx, v, look, a, b, top, H);
  }

  function shelf(ctx, v, look, a, b, y) {
    const id = v.spec.id;
    if (id === "midway") shelfMidway(ctx, v, look, a, b, y);
    else if (id === "mirrors") shelfMirrors(ctx, v, look, a, b, y);
    else if (id === "funhouse") shelfFunhouse(ctx, v, look, a, b, y);
    else if (id === "bigtop") shelfBigtop(ctx, v, look, a, b, y);
  }

  /* ---------------------------------------------------------------- moving */

  // A hound's cage on the floor at cx: iron bars and a dark inside, the glowing eyes of what waits, the door swung open once the Ringmaster rages.
  function drawCage(ctx, v, cx, side) {
    const H = v.g.FIELD_H;
    const FY = H - 6;
    const open = Boolean(v.round.boss && v.round.boss.raged);
    const w = 9;
    const h = 7;
    const x = cx - w / 2;
    ctx.fillStyle = "#0a0408";
    ctx.fillRect(x, FY - h, w, h);
    if (!open) {
      const t = v.clock;
      for (const ex of [-1.9, 1.5]) {
        const blink = Math.sin(t / 900 + cx) > 0.93 ? 0.1 : 1;
        ctx.fillStyle = `rgba(255, 176, 32, ${0.9 * blink})`;
        ellipse(ctx, cx + ex, FY - 2.8, 0.55, 0.36 * blink + 0.05);
        ctx.fill();
        ctx.fillStyle = `rgba(255, 176, 32, ${0.18 * blink})`;
        circle(ctx, cx + ex, FY - 2.8, 1.3);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(40, 16, 8, 0.8)";
      ellipse(ctx, cx, FY - 1.6, 3, 1.5);
      ctx.fill();
    }
    // The frame, the roof, the bars.
    ctx.fillStyle = "#3a3a46";
    ctx.fillRect(x - 0.4, FY - h - 0.6, w + 0.8, 0.8);
    ctx.fillRect(x - 0.4, FY - h, 0.7, h);
    ctx.fillRect(x + w - 0.3, FY - h, 0.7, h);
    ctx.fillStyle = "#6a6a7a";
    ctx.fillRect(x - 0.4, FY - h - 0.6, w + 0.8, 0.2);
    ctx.fillStyle = GOLD_DK;
    ctx.fillRect(x - 0.4, FY - 0.7, w + 0.8, 0.7);
    if (!open) {
      ctx.strokeStyle = "#5a5a68";
      ctx.lineWidth = 0.28;
      for (let bx = x + 0.9; bx < x + w - 0.5; bx += 1) line(ctx, bx, FY - h, bx, FY - 0.7);
      ctx.fillStyle = "#8a8a98";
      ctx.fillRect(x, FY - 3.6, w, 0.25);
    } else {
      // The door hanging open on its far hinge, a sliver of bars.
      const hx = side > 0 ? x + w : x;
      ctx.strokeStyle = "#5a5a68";
      ctx.lineWidth = 0.28;
      for (let k = 0; k < 4; k++) line(ctx, hx - side * (0.4 + k * 0.5), FY - h, hx - side * (0.4 + k * 0.5), FY - 0.7);
      ctx.fillStyle = "#3a3a46";
      ctx.fillRect(hx - side * 2.2, FY - h, 0.5, h - 0.7);
    }
  }

  function movingMidway(ctx, v, cam) {
    const clock = v.clock;
    // Bulbs on the wires, chasing.
    const lo = cam - 6;
    const hi = cam + v.g.FIELD_W + 6;
    for (let i = Math.floor(lo / SWAG) - 1; i <= Math.ceil(hi / SWAG); i++) {
      for (let k = 1; k < 10; k++) {
        const [x, y] = swagAt(i, k / 10);
        if (x < lo || x > hi) continue;
        const tw = 0.5 + 0.5 * Math.sin(clock / 240 + k * 1.1 + i * 2);
        bulb(ctx, x, y + 0.3, at(BULBS, k + i * 3), 0.55 + 0.45 * tw, 0.4);
      }
    }
  }

  function movingMirrors(ctx, v, cam) {
    const clock = v.clock;
    const H = v.g.FIELD_H;
    const top = 6;
    const bot = H - 9;
    eachAt(cam - 8, cam + v.g.FIELD_W + 8, PANEL, PANEL / 2, 10, (cx, n) => {
      const w = 14;
      const x = cx - w / 2;
      // A bright streak sweeping across the glass now and then.
      const ph = ((clock / 3400 + unit(n, 5)) % 1.6) / 1.6;
      if (ph < 0.62) {
        const sx = x - 4 + (ph / 0.62) * (w + 8);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, top + 4, w, bot - top - 4);
        if (typeof ctx.clip === "function") ctx.clip();
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * Math.sin((ph / 0.62) * Math.PI)})`;
        poly(ctx, [sx, top, sx + 2.4, top, sx - 4 + 2.4, bot, sx - 4, bot]);
        ctx.fill();
        ctx.restore();
      }
      // A sparkle on the frame.
      const sp = Math.sin(clock / 500 + n * 2.3);
      if (sp > 0.82) {
        const sy = top + 4 + (hash(n, 9) % 20);
        ctx.strokeStyle = `rgba(255, 255, 255, ${(sp - 0.82) * 5})`;
        ctx.lineWidth = 0.16;
        line(ctx, x - 1.6, sy, x - 0.6, sy);
        line(ctx, x - 1.1, sy - 0.5, x - 1.1, sy + 0.5);
      }
    });
    // The chandeliers' flames.
    eachAt(cam - 8, cam + v.g.FIELD_W + 8, 66, 33, 8, (cx, n) => {
      for (const dx of [-2.6, -1.3, 0, 1.3, 2.6]) {
        const fl = 0.8 + 0.2 * Math.sin(clock / 110 + dx * 3 + n);
        ctx.fillStyle = `rgba(255, 220, 130, ${fl})`;
        ellipse(ctx, cx + dx, 2.1, 0.22, 0.45 * fl);
        ctx.fill();
      }
    });
  }

  function disc(ctx, cx, cy, r, ang, c1, c2) {
    ctx.fillStyle = "#14081e";
    circle(ctx, cx, cy, r + 0.7);
    ctx.fill();
    for (let k = 0; k < 8; k++) {
      ctx.fillStyle = k % 2 ? c1 : c2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, ang + (k * TAU) / 8, ang + ((k + 1) * TAU) / 8);
      ctx.closePath();
      ctx.fill();
    }
    // The spiral arms over the wedges.
    ctx.strokeStyle = "rgba(10, 4, 20, 0.7)";
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    for (let s = 0; s <= 40; s++) {
      const rr = (s / 40) * r;
      const a = ang * 1.0 + s * 0.28;
      if (s) ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else ctx.moveTo(cx, cy);
    }
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    circle(ctx, cx, cy, 0.7);
    ctx.fill();
  }

  function movingFunhouse(ctx, v, cam) {
    const clock = v.clock;
    const H = v.g.FIELD_H;
    const lo = cam - 8;
    const hi = cam + v.g.FIELD_W + 8;
    eachAt(lo, hi, 70, 40, 10, (cx, n) => cx < v.spec.door - 28 && disc(ctx, cx, 15, 7, (clock / 1400) * (n % 2 ? 1 : -1), n % 2 ? "#ff3b8a" : "#2ad8d8", "#ffe14a"));
    // The chaser lights along the rafter.
    const step = Math.floor(clock / 170);
    for (let x = Math.ceil(lo / 3) * 3; x < hi; x += 3) {
      const i = Math.round(x / 3);
      const on = (i + step) % 3 === 0;
      bulb(ctx, x, 4.1, at(BULBS, i), on ? 1 : 0.25, 0.36);
    }
    // The belts: chevrons running the way they carry you.
    for (const [bx0, bx1, speed] of v.spec.belts || []) {
      if (bx1 < lo || bx0 > hi) continue;
      const fy = H - v.groundAt(v.spec, (bx0 + bx1) / 2);
      const dir = Math.sign(speed) || 1;
      const sp = 2.6;
      const off = (((clock / 1000) * Math.abs(speed) * dir) % sp + sp) % sp;
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.max(bx0, lo), fy - 0.15, Math.min(bx1, hi) - Math.max(bx0, lo), 1.35);
      if (typeof ctx.clip === "function") ctx.clip();
      ctx.fillStyle = "#1a1426";
      ctx.fillRect(bx0, fy - 0.15, bx1 - bx0, 1.35);
      ctx.strokeStyle = "#ffd23a";
      ctx.lineWidth = 0.32;
      for (let x = bx0 - sp + off; x < bx1 + sp; x += sp) {
        ctx.beginPath();
        ctx.moveTo(x - dir * 0.5, fy + 0.0);
        ctx.lineTo(x + dir * 0.5, fy + 0.5);
        ctx.lineTo(x - dir * 0.5, fy + 1.0);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(bx0, fy - 0.15, bx1 - bx0, 0.18);
      ctx.restore();
      // The arrows on the ends say which way it runs.
      bulb(ctx, dir > 0 ? bx1 + 0.4 : bx0 - 0.4, fy + 0.3, "#ffd23a", 0.7 + 0.3 * Math.sin(clock / 200), 0.3);
    }
  }

  function movingBigtop(ctx, v, cam) {
    const clock = v.clock;
    const H = v.g.FIELD_H;
    const arena = v.spec.arena;
    // Slow spotlights sweeping the ring.
    for (let i = 0; i < 3; i++) {
      const sx = arena + 18 + i * 30;
      const sway = Math.sin(clock / (2300 + i * 700) + i * 2) * 0.32;
      const tx = sx + Math.tan(sway) * 44;
      const g = grad(ctx, 0, 0, 0, H - 6, [[0, "rgba(255, 244, 200, 0.2)"], [1, "rgba(255, 244, 200, 0.05)"]]);
      ctx.fillStyle = g;
      poly(ctx, [sx - 0.5, 0, sx + 0.5, 0, tx + 7, H - 6, tx - 7, H - 6]);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 250, 220, 0.9)";
      circle(ctx, sx, 0.6, 1);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 244, 200, 0.14)";
      ellipse(ctx, tx, H - 6, 7, 0.9);
      ctx.fill();
    }
    drawCage(ctx, v, arena + 8, 1);
    drawCage(ctx, v, v.spec.length - 8, -1);
  }

  function moving(ctx, v, cam) {
    const id = v.spec.id;
    if (!ROOM[id]) return;
    if (id === "midway") movingMidway(ctx, v, cam);
    else if (id === "mirrors") movingMirrors(ctx, v, cam);
    else if (id === "funhouse") movingFunhouse(ctx, v, cam);
    else movingBigtop(ctx, v, cam);
  }

  /* ---------------------------------------------------------------- lights */

  function lights(v, add) {
    const id = v.spec && v.spec.id;
    if (!ROOM[id] || !v.round) return;
    const H = v.g.FIELD_H;
    const cam = v.round.camX;
    const W = v.g.FIELD_W;
    const t = v.clock;
    if (id === "midway") {
      eachAt(cam - 10, cam + W + 10, SWAG, SWAG / 2, 6, (x, i) => add(x, H - 13.5, 17, 0.5 + 0.06 * Math.sin(t / 300 + i)));
      far(cam, W, WHEEL_P, WHEEL_SPACING, WHEEL_OFFSET, 24, (x, n) => add(x, H - 22, 20, 0.34));
      eachAt(cam - 10, cam + W + 10, 38, 14, 18, (x) => add(x, H - 34, 12, 0.3));
    } else if (id === "mirrors") {
      eachAt(cam - 10, cam + W + 10, 66, 33, 8, (x, n) => add(x, H - 3, 22, 0.62 + 0.05 * Math.sin(t / 130 + n)));
      eachAt(cam - 10, cam + W + 10, PANEL, PANEL / 2, 10, (x) => add(x, H - 26, 12, 0.22));
    } else if (id === "funhouse") {
      eachAt(cam - 10, cam + W + 10, 24, 6, 6, (x, i) => add(x, H - 4, 14, 0.4));
      eachAt(cam - 10, cam + W + 10, 70, 40, 10, (x) => add(x, H - 15, 12, 0.42));
      for (const [bx0, bx1] of v.spec.belts || []) for (let x = bx0 + 6; x < bx1; x += 18) add(x, 7, 7, 0.28);
      add(v.spec.door, 10, 18, 0.5);
    } else {
      const arena = v.spec.arena;
      for (let i = 0; i < 3; i++) {
        const sway = Math.sin(t / (2300 + i * 700) + i * 2) * 0.32;
        add(arena + 18 + i * 30 + Math.tan(sway) * 44, 8, 22, 0.55);
      }
      add(arena + 48, 24, 20, 0.28);
      const b = v.round.boss;
      for (const cx of [arena + 8, v.spec.length - 8]) add(cx, 4, b && b.raged ? 9 : 7, 0.5);
    }
  }

  return freeze({ sky, backdrop, ground, shelf, moving, lights, drawCage });
}
