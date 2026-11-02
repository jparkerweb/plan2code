// Plan2Code Web Console - Ghoul Rush's Frozen Lake, the world it is set in: a night of snow over the Ice Fishing Huts (huts for boards, taut lines, pines), the Snowbound Lodge (a hall the roof fell into, frosted windows, dead hearths), the Black Ice (dead trees, mist, faces under the surface) and the Widow's Web (a frozen cavern hung with webs and cocoons), with slippery ice, thin ice in its three stages, open water in the holes and the snow that falls over it all.
//
// ghoul-frozen-draw.js plugs it in. frozenWorld(d) takes ghoul-draw.js's own
// drawing helpers (`d`) and hands back, by hook: `sky` (the night, the moon and
// aurora, the far mountains, drawn every frame under the still layers), `backdrop`
// (the still scenery of a room, cached in the layers), `ground` (the snow on a
// floor piece and the gloss of its ice spans), `shelf` (a hut's roof, a lodge's
// mantel, an ice ledge), `moving` (open water in the holes, thin ice window by
// window, the glints on the ice, the faces under the Black Ice, the falling snow)
// and `lights`. Drawn in room units, y counted down from the field's top, a floor
// piece's `top` counted up. Every hook does nothing outside the Frozen Lake's rooms.
//
// What it reads off the rules (ghoul-frozen.js): `spec.id`, `spec.length`,
// `spec.arena`, `spec.ice` (spans of slippery floor), `spec.base.ground` (the whole
// floor: a hole is a gap in it), `round.thin.tiles` ({ x0, x1, y, t, state: "ok" |
// "crack" | "broken", back }: a tile is drawn from this, never from `spec.ground`,
// whose broken tiles are cut out and whose still layers are kept per room), `round.camX`,
// `round.you.x`. No random number is drawn: each piece keeps its place through `hash`.

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ROOM = freeze({ huts: 1, lodge: 1, blackice: 1, widow: 1 });

// The thin ice's clock (ghoul-frozen.js): a crack shows at THIN_WARN_MS, it breaks at THIN_MS, and it freezes over again in its last REFREEZE_MS.
const THIN_WARN_MS = 500;
const THIN_MS = 1300;
const REFREEZE_MS = 1400;

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

export function frozenWorld(d) {
  const { ellipse, circle, line, hash } = d;
  const unit = (a, b) => hash(Math.round(a), b) / 997;

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

  // The spans of `spans` that reach [a, b], cut to it.
  const within = (spans, a, b) => (spans || []).map(([s0, s1]) => [Math.max(s0, a), Math.min(s1, b)]).filter(([s0, s1]) => s1 > s0);
  // The spans that reach [a, b], whole (a scene set on a span's middle must not move with the layer that draws it).
  const reaching = (spans, a, b) => (spans || []).filter(([s0, s1]) => s1 > a && s0 < b);

  // A pine on the snow: three tiers of needles, the snow lying on each.
  function pine(ctx, cx, base, h, dark) {
    const w = h * 0.34;
    for (let k = 0; k < 3; k++) {
      const y0 = base - h * (0.12 + k * 0.28);
      const y1 = y0 - h * 0.42;
      const ww = w * (1 - k * 0.27);
      ctx.fillStyle = dark ? "#06161c" : "#0b2630";
      poly(ctx, [cx - ww, y0, cx + ww, y0, cx, y1]);
      ctx.fill();
      ctx.fillStyle = dark ? "rgba(150, 190, 215, 0.55)" : "rgba(222, 240, 252, 0.85)";
      poly(ctx, [cx - ww * 0.92, y0 - 0.15, cx - ww * 0.3, y0 - h * 0.1, cx + ww * 0.1, y0 - 0.55, cx + ww * 0.6, y0 - h * 0.12, cx + ww * 0.92, y0 - 0.15, cx, y1 + 0.1]);
      ctx.fill();
    }
    ctx.fillStyle = "#1c1410";
    ctx.fillRect(cx - 0.3, base - h * 0.12, 0.6, h * 0.14);
  }

  // A bare tree, its branches loaded with snow.
  function deadTree(ctx, cx, base, h, n) {
    ctx.strokeStyle = "#04080e";
    ctx.lineCap = "round";
    ctx.lineWidth = 0.55;
    line(ctx, cx, base, cx + (unit(n, 3) - 0.5) * 0.8, base - h);
    ctx.lineWidth = 0.28;
    for (let k = 0; k < 5; k++) {
      const by = base - h * (0.35 + k * 0.13);
      const dir = k % 2 ? 1 : -1;
      const len = h * (0.34 - k * 0.04) * (0.8 + unit(n, 5 + k) * 0.5);
      line(ctx, cx, by, cx + dir * len, by - len * 0.55);
      ctx.strokeStyle = "rgba(190, 215, 235, 0.55)";
      ctx.lineWidth = 0.14;
      line(ctx, cx + dir * len * 0.15, by - len * 0.1 - 0.12, cx + dir * len * 0.9, by - len * 0.55 - 0.12);
      ctx.strokeStyle = "#04080e";
      ctx.lineWidth = 0.28;
    }
    ctx.lineCap = "butt";
  }

  // A web: spokes from (cx, cy) out to r, rings of sagging threads between them.
  function web(ctx, cx, cy, r, spokes, rings, alpha, a0 = 0) {
    ctx.strokeStyle = rgba("#dff3ff", alpha);
    ctx.lineWidth = 0.14;
    for (let i = 0; i < spokes; i++) line(ctx, cx, cy, cx + Math.cos(a0 + (i * TAU) / spokes) * r, cy + Math.sin(a0 + (i * TAU) / spokes) * r);
    ctx.lineWidth = 0.1;
    for (let k = 1; k <= rings; k++) {
      const rr = (r * k) / rings;
      ctx.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = a0 + (i * TAU) / spokes;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        if (!i) ctx.moveTo(px, py);
        else {
          const am = a - TAU / spokes / 2;
          ctx.quadraticCurveTo(cx + Math.cos(am) * rr * 0.9, cy + Math.sin(am) * rr * 0.9, px, py);
        }
      }
      ctx.stroke();
    }
  }

  // An icicle hanging from (x, y).
  function icicle(ctx, x, y, len, w, a = 0.8) {
    ctx.fillStyle = rgba("#d8f2ff", a);
    poly(ctx, [x - w / 2, y, x + w / 2, y, x + w * 0.1, y + len]);
    ctx.fill();
    ctx.fillStyle = rgba("#ffffff", a * 0.7);
    poly(ctx, [x - w * 0.3, y, x - w * 0.05, y, x - w * 0.05, y + len * 0.6]);
    ctx.fill();
  }

  /* ================================================================== the sky */

  // The huts' sky: deep blue to a pale haze at the snow, stars, a moon, the aurora and far mountains.
  function skyNight(ctx, v, cam, black) {
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    const t = v.clock;
    ctx.fillStyle = black ? grad(ctx, 0, 0, 0, H, [[0, "#010409"], [0.5, "#06142a"], [0.85, "#14304a"], [1, "#27465e"]]) : grad(ctx, 0, 0, 0, H, [[0, "#020817"], [0.45, "#0d2750"], [0.8, "#2c5a82"], [1, "#6a98b8"]]);
    ctx.fillRect(cam - 1, 0, W + 2, H);
    for (let i = 0; i < 50; i++) {
      const sx = ((((hash(i, 3) / 997) * W * 1.6 - cam * 0.12) % W) + W) % W;
      const sy = (hash(i, 5) / 997) * H * 0.55;
      ctx.fillStyle = `rgba(236, 244, 255, ${0.3 + 0.28 * (i % 3) + 0.2 * Math.sin(t / 700 + i * 1.9)})`;
      const s = 0.14 + (i % 3) * 0.07;
      ctx.fillRect(cam + sx, sy, s, s);
    }
    // The aurora: a few ribbons of upright strokes that sway.
    const ribbons = black ? [["#7a5aff", 0.07, 7, 11], ["#3affc0", 0.1, 10, 9]] : [["#4aff9a", 0.09, 6, 12], ["#3ac8ff", 0.07, 11, 9]];
    ribbons.forEach(([color, alpha, y0, len], r) => {
      for (let x = 0; x < W; x += 1.6) {
        const sway = Math.sin((x + cam * 0.3) / 9 + t / 2200 + r * 2) * 2.6 + Math.sin((x + cam * 0.3) / 4 - t / 1500) * 0.9;
        ctx.fillStyle = grad(ctx, 0, y0 + sway, 0, y0 + sway + len, [[0, rgba(color, 0)], [0.25, rgba(color, alpha)], [1, rgba(color, 0)]]);
        ctx.fillRect(cam + x, y0 + sway, 1.7, len);
      }
    });
    if (!black) {
      // The moon, far out, with its halo.
      far(cam, W, 0.06, 420, 140, 20, (x) => {
        ctx.fillStyle = "rgba(190, 225, 255, 0.07)";
        circle(ctx, x, 9, 9);
        ctx.fill();
        ctx.fillStyle = "rgba(210, 236, 255, 0.12)";
        circle(ctx, x, 9, 5.8);
        ctx.fill();
        ctx.fillStyle = "#eef8ff";
        circle(ctx, x, 9, 3.1);
        ctx.fill();
        ctx.fillStyle = "rgba(150, 185, 215, 0.55)";
        for (const [dx, dy, r] of [[-0.9, -0.5, 0.55], [0.7, 0.6, 0.4], [0.5, -1.0, 0.3]]) {
          circle(ctx, x + dx, 9 + dy, r);
          ctx.fill();
        }
      });
      // Far mountains, snow on their heads.
      far(cam, W, 0.24, 44, 8, 30, (x, n) => {
        const h = 10 + (hash(n, 71) % 9);
        const base = H - 6;
        ctx.fillStyle = "#1b3550";
        poly(ctx, [x - 26, base, x - 4, base - h * 0.75, x + 2, base - h, x + 9, base - h * 0.7, x + 26, base]);
        ctx.fill();
        ctx.fillStyle = "rgba(220, 238, 252, 0.8)";
        poly(ctx, [x - 4.6, base - h * 0.7, x + 2, base - h, x + 8.4, base - h * 0.66, x + 4, base - h * 0.8, x + 1, base - h * 0.62, x - 2, base - h * 0.8]);
        ctx.fill();
      });
    }
  }

  function sky(ctx, v, cam) {
    const id = v.spec.id;
    if (!ROOM[id]) return;
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    if (id === "huts") skyNight(ctx, v, cam, false);
    else if (id === "blackice") skyNight(ctx, v, cam, true);
    else if (id === "lodge") {
      ctx.fillStyle = "#0a0806";
      ctx.fillRect(cam - 1, 0, W + 2, H);
    } else {
      ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, "#030a1c"], [0.5, "#0c2442"], [1, "#1d4668"]]);
      ctx.fillRect(cam - 1, 0, W + 2, H);
    }
  }

  /* ================================================================ the rooms */

  function backdropHuts(ctx, v, look, x0, x1, H) {
    const FY = H - 6;
    // Snowbanks behind the lake, and the pines on them.
    ctx.fillStyle = grad(ctx, 0, FY - 9, 0, FY, [[0, "rgba(120, 160, 195, 0)"], [1, "#9ec2dc"]]);
    ctx.fillRect(x0, FY - 9, x1 - x0, 9);
    ctx.fillStyle = "#4a7090";
    for (let x = Math.floor(x0 / 6) * 6; x < x1 + 6; x += 6) {
      const h = Math.max(0.4, 2.8 + 1.6 * Math.sin(x * 0.07) + 1.0 * Math.sin(x * 0.19 + 1));
      ellipse(ctx, x + 3, FY - 1.2, 5, h);
      ctx.fill();
    }
    eachAt(x0, x1, 9, 3, 8, (cx, n) => {
      if (hash(n, 40) % 3 === 0) return;
      pine(ctx, cx + (hash(n, 41) % 5) - 2, FY - 0.6 - (hash(n, 42) % 3) * 0.5, 9 + (hash(n, 43) % 8), false);
    });
    // Far huts with a warm window, and the poles with their taut lines into the ice.
    eachAt(x0, x1, 61, 17, 14, (cx, n) => {
      const hh = 4.4;
      ctx.fillStyle = "#16202e";
      ctx.fillRect(cx - 3, FY - hh, 6, hh);
      ctx.fillStyle = "#20324a";
      poly(ctx, [cx - 3.6, FY - hh, cx, FY - hh - 2.4, cx + 3.6, FY - hh]);
      ctx.fill();
      ctx.fillStyle = "rgba(235, 248, 255, 0.9)";
      poly(ctx, [cx - 3.7, FY - hh + 0.1, cx, FY - hh - 2.5, cx + 3.7, FY - hh + 0.1, cx + 2.4, FY - hh - 0.5, cx, FY - hh - 1.4, cx - 2.4, FY - hh - 0.5]);
      ctx.fill();
      ctx.fillStyle = "#ffcf7a";
      ctx.fillRect(cx - 1.2, FY - hh + 1, 1.3, 1.2);
    });
    eachAt(x0, x1, 23, 9, 8, (cx, n) => {
      if (hash(n, 44) % 2) return;
      const lean = 0.8 + (hash(n, 45) % 3) * 0.3;
      ctx.strokeStyle = "#2a1c12";
      ctx.lineWidth = 0.25;
      line(ctx, cx, FY, cx - lean, FY - 5.2);
      ctx.strokeStyle = "rgba(230, 245, 255, 0.55)";
      ctx.lineWidth = 0.07;
      line(ctx, cx - lean, FY - 5.2, cx + 3.4, FY + 0.5);
    });
  }

  function backdropBlack(ctx, v, look, x0, x1, H) {
    const FY = H - 6;
    ctx.fillStyle = grad(ctx, 0, FY - 14, 0, FY, [[0, "rgba(40, 80, 110, 0)"], [1, "rgba(60, 110, 140, 0.5)"]]);
    ctx.fillRect(x0, FY - 14, x1 - x0, 14);
    ctx.fillStyle = "#050c14";
    for (let x = Math.floor(x0 / 7) * 7; x < x1 + 7; x += 7) {
      const h = Math.max(0.4, 2.2 + 1.2 * Math.sin(x * 0.09 + 2) + 0.8 * Math.sin(x * 0.23));
      ellipse(ctx, x + 3.5, FY - 0.6, 5.5, h);
      ctx.fill();
    }
    eachAt(x0, x1, 17, 5, 8, (cx, n) => {
      if (hash(n, 50) % 3 === 0) return;
      deadTree(ctx, cx + (hash(n, 51) % 7) - 3, FY - 0.4, 7 + (hash(n, 52) % 9), n);
    });
    // Stakes with a frozen rag, left where someone went through.
    eachAt(x0, x1, 71, 33, 8, (cx) => {
      ctx.fillStyle = "#06101a";
      ctx.fillRect(cx - 0.18, FY - 4, 0.36, 4);
      ctx.fillStyle = "rgba(170, 205, 225, 0.5)";
      poly(ctx, [cx + 0.18, FY - 4, cx + 2.1, FY - 3.5, cx + 0.8, FY - 2.9, cx + 1.9, FY - 2.1, cx + 0.18, FY - 2.4]);
      ctx.fill();
    });
    ctx.fillStyle = grad(ctx, 0, FY - 4, 0, FY, [[0, "rgba(120, 175, 205, 0)"], [1, "rgba(120, 175, 205, 0.28)"]]);
    ctx.fillRect(x0, FY - 4, x1 - x0, 4);
  }

  // The lodge: a long hall of planks, rafters, frosted windows, dead hearths, and the roof fallen in over the ice.
  function backdropLodge(ctx, v, look, x0, x1, H) {
    ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, look.wallTop], [1, look.wallLow]]);
    ctx.fillRect(x0, 0, x1 - x0, H);
    ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
    for (let x = Math.floor(x0 / 3.2) * 3.2; x < x1; x += 3.2) ctx.fillRect(x, 0, 0.12, H);
    ctx.fillStyle = look.wainscot;
    ctx.fillRect(x0, H - 20, x1 - x0, 14);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.fillRect(x0, H - 20, x1 - x0, 0.4);
    // Rafters.
    ctx.fillStyle = "#0b0807";
    ctx.fillRect(x0, 0, x1 - x0, 3.2);
    eachAt(x0, x1, 24, 0, 4, (cx) => {
      ctx.fillStyle = "#14100d";
      ctx.fillRect(cx - 0.6, 0, 1.2, 8);
      for (const s of [-1, 1]) {
        ctx.strokeStyle = "#14100d";
        ctx.lineWidth = 0.9;
        line(ctx, cx, 3, cx + s * 9, 0);
      }
    });
    // The roof gone in over each stretch of ice: a hole of night, light falling through.
    const holes = reaching(v.spec.ice, x0 - 30, x1 + 30);
    for (const [s0, s1] of holes) {
      const cx = (s0 + s1) / 2;
      const w = Math.min(46, (s1 - s0) * 0.85);
      ctx.fillStyle = grad(ctx, 0, 0, 0, 14, [[0, "#04122c"], [1, "#27527a"]]);
      poly(ctx, [cx - w / 2, 0, cx + w / 2, 0, cx + w * 0.42, 5, cx + w * 0.28, 9.5, cx + w * 0.1, 7, cx - w * 0.06, 12, cx - w * 0.22, 8, cx - w * 0.36, 10.5, cx - w * 0.46, 5]);
      ctx.fill();
      ctx.fillStyle = "rgba(236, 244, 255, 0.7)";
      for (let i = 0; i < 9; i++) ctx.fillRect(cx - w * 0.4 + unit(s0 + i, 61) * w * 0.8, unit(s0 + i, 62) * 5, 0.16, 0.16);
      // The broken rafters, and the beam that hangs.
      ctx.strokeStyle = "#14100d";
      ctx.lineWidth = 1.1;
      line(ctx, cx - w * 0.45, 2, cx - w * 0.2, 11);
      line(ctx, cx + w * 0.4, 1, cx + w * 0.12, 8.5);
      ctx.fillStyle = "rgba(170, 210, 255, 0.06)";
      poly(ctx, [cx - w * 0.3, 8, cx + w * 0.3, 8, cx + w * 0.62, H - 6, cx - w * 0.62, H - 6]);
      ctx.fill();
      // The snow that came in with it.
      ctx.fillStyle = "rgba(226, 240, 252, 0.88)";
      for (let k = -2; k <= 2; k++) {
        ellipse(ctx, cx + k * w * 0.16, H - 6.4, w * 0.12, 1.4 + (2 - Math.abs(k)) * 0.8);
        ctx.fill();
      }
    }
    // Windows, frosted over, a pale moon behind the glass.
    eachAt(x0, x1, 58, 20, 8, (cx, n) => {
      if (holes.some(([s0, s1]) => cx > s0 - 6 && cx < s1 + 6)) return;
      ctx.fillStyle = look.wainscot;
      ellipse(ctx, cx, 15, 4.8, 4.8);
      ctx.fill();
      ctx.fillRect(cx - 4.8, 15, 9.6, 8);
      ctx.fillStyle = "#08162a";
      ellipse(ctx, cx, 15, 4.1, 4.1);
      ctx.fill();
      ctx.fillRect(cx - 4.1, 15, 8.2, 7.4);
      ctx.fillStyle = "rgba(210, 232, 255, 0.5)";
      circle(ctx, cx + (n % 3) - 1, 14, 1.3);
      ctx.fill();
      ctx.strokeStyle = "rgba(235, 248, 255, 0.55)";
      ctx.lineWidth = 0.12;
      for (let k = 0; k < 7; k++) {
        const a = unit(n * 9 + k, 63) * Math.PI;
        line(ctx, cx - 4 + unit(n * 9 + k, 64) * 8, 22.4, cx - 4 + unit(n * 9 + k, 64) * 8 + Math.cos(a) * 1.4, 22.4 - Math.sin(a) * 3.2);
      }
      ctx.strokeStyle = look.wainscot;
      ctx.lineWidth = 0.4;
      line(ctx, cx, 11, cx, 23);
      line(ctx, cx - 4, 17.5, cx + 4, 17.5);
      ctx.fillStyle = "rgba(240, 248, 255, 0.8)";
      ellipse(ctx, cx, 23.2, 5.2, 0.55);
      ctx.fill();
    });
    // A dead hearth with a stopped clock over it.
    eachAt(x0, x1, 140, 96, 10, (cx, n) => {
      if (holes.some(([s0, s1]) => cx > s0 - 8 && cx < s1 + 8)) return;
      const fy = H - 6;
      ctx.fillStyle = "#2a2420";
      ctx.fillRect(cx - 6, fy - 12, 12, 12);
      ctx.fillStyle = "#171210";
      ctx.fillRect(cx - 3.6, fy - 7.6, 7.2, 7.6);
      ctx.fillStyle = "#383028";
      ctx.fillRect(cx - 7, fy - 12.8, 14, 1.2);
      ctx.fillStyle = "rgba(160, 160, 160, 0.35)";
      ellipse(ctx, cx, fy - 0.7, 3, 0.55);
      ctx.fill();
      ctx.fillStyle = "rgba(235, 248, 255, 0.55)";
      for (let k = 0; k < 5; k++) ctx.fillRect(cx - 3.4 + k * 1.5, fy - 7.6, 0.16, 1 + (k % 3) * 0.6);
      ctx.fillStyle = "#cfc5ae";
      circle(ctx, cx, fy - 16.4, 1.7);
      ctx.fill();
      ctx.strokeStyle = "#1a1612";
      ctx.lineWidth = 0.14;
      line(ctx, cx, fy - 16.4, cx + 0.5, fy - 17.4);
      line(ctx, cx, fy - 16.4, cx - 0.9, fy - 16.2);
    });
    // Icicles on the beams.
    eachAt(x0, x1, 5.5, 1, 3, (cx, n) => {
      if (hash(n, 66) % 3 === 0) icicle(ctx, cx, 3.2, 1.2 + (hash(n, 67) % 5) * 0.5, 0.5, 0.7);
    });
  }

  // The cavern: ice walls streaked like a frozen waterfall, stalactites, a great web across the arena's roof, cocoons.
  function backdropWidow(ctx, v, look, x0, x1, H) {
    const arena = v.spec.arena;
    ctx.fillStyle = grad(ctx, 0, 0, 0, H, [[0, "#030a1c"], [0.5, "#0e2a4a"], [1, "#245a80"]]);
    ctx.fillRect(x0, 0, x1 - x0, H);
    // The frozen falls: pale columns, bright at the edge.
    eachAt(x0, x1, 17, 4, 8, (cx, n) => {
      const w = 3 + (hash(n, 80) % 5);
      ctx.fillStyle = grad(ctx, cx - w, 0, cx + w, 0, [[0, "rgba(160, 215, 245, 0)"], [0.5, "rgba(170, 225, 250, 0.2)"], [1, "rgba(160, 215, 245, 0)"]]);
      ctx.fillRect(cx - w, 4, w * 2, H);
      ctx.fillStyle = "rgba(235, 248, 255, 0.16)";
      ctx.fillRect(cx - w * 0.3, 4, 0.22, H);
    });
    // Stalactites from the roof.
    eachAt(x0, x1, 6.5, 0, 4, (cx, n) => {
      const len = 4 + (hash(n, 82) % 9);
      ctx.fillStyle = "#12304e";
      poly(ctx, [cx - 1.6, 0, cx + 1.6, 0, cx + 0.2, len]);
      ctx.fill();
      ctx.fillStyle = "rgba(190, 236, 255, 0.45)";
      poly(ctx, [cx - 1.0, 0, cx - 0.2, 0, cx - 0.1, len * 0.7]);
      ctx.fill();
    });
    // The Widow's web, over the arena: a great wheel and the guy lines to the walls.
    const mid = arena + 52;
    web(ctx, mid, 4, 40, 14, 7, 0.34, 0.05);
    ctx.strokeStyle = "rgba(225, 244, 255, 0.28)";
    ctx.lineWidth = 0.14;
    for (const [ax, ay] of [[arena - 4, 0], [arena + 100, 0], [arena + 6, 30], [arena + 98, 30]]) line(ctx, mid, 4, ax, ay);
    // Cocoons hung in webbing: pale, wrapped, a shape inside.
    eachAt(x0, x1, 23, 7, 6, (cx, n) => {
      if (hash(n, 84) % 3 === 0) return;
      const len = 6 + (hash(n, 85) % 12);
      ctx.strokeStyle = "rgba(220, 242, 255, 0.4)";
      ctx.lineWidth = 0.13;
      line(ctx, cx, 0, cx, len);
      ctx.fillStyle = "rgba(214, 236, 250, 0.82)";
      ellipse(ctx, cx, len + 2.4, 1.15, 2.6);
      ctx.fill();
      ctx.strokeStyle = "rgba(90, 130, 165, 0.7)";
      ctx.lineWidth = 0.1;
      for (let k = 0; k < 5; k++) line(ctx, cx - 1.1, len + 0.8 + k * 0.85, cx + 1.1, len + 1.2 + k * 0.85);
      ctx.fillStyle = "rgba(60, 90, 120, 0.6)";
      ellipse(ctx, cx, len + 0.9, 0.5, 0.65);
      ctx.fill();
    });
  }

  function backdrop(ctx, v, look, x0, x1) {
    const id = v.spec.id;
    const H = v.g.FIELD_H;
    if (id === "huts") backdropHuts(ctx, v, look, x0, x1, H);
    else if (id === "blackice") backdropBlack(ctx, v, look, x0, x1, H);
    else if (id === "lodge") backdropLodge(ctx, v, look, x0, x1, H);
    else if (id === "widow") backdropWidow(ctx, v, look, x0, x1, H);
  }

  /* ============================================================== the floor */

  // Snow on a floor piece: drifts along its edge. The ice spans of the piece are glossy instead.
  function ground(ctx, v, look, a, b, top) {
    const id = v.spec.id;
    if (!ROOM[id]) return;
    const H = v.g.FIELD_H;
    const fy = H - top;
    const ice = within(v.spec.ice, a, b);
    const onIce = (x) => ice.some(([s0, s1]) => x >= s0 && x <= s1);
    const black = id === "blackice";
    const snow = id === "lodge" ? "rgba(214, 232, 246, 0.85)" : "#e6f2fa";
    for (let x = Math.ceil(a / 3.1) * 3.1; x < b - 0.4; x += 3.1) {
      if (onIce(x)) continue;
      const h = hash(Math.round(x * 3), 90);
      ctx.fillStyle = black ? "rgba(120, 165, 195, 0.7)" : snow;
      ellipse(ctx, x + (h % 5) * 0.1, fy + 0.05, 1.4 + (h % 4) * 0.35, 0.28 + (h % 3) * 0.09);
      ctx.fill();
    }
    if (!ice.length) return;
    for (const [s0, s1] of ice) {
      const w = s1 - s0;
      // The sheet: clear and glossy on top, the dark of the water through the body.
      ctx.fillStyle = black ? grad(ctx, 0, fy, 0, fy + 1.1, [[0, "#3d6682"], [1, "#16304a"]]) : grad(ctx, 0, fy, 0, fy + 1.1, [[0, "#c4ecff"], [1, "#5aa6d6"]]);
      ctx.fillRect(s0, fy, w, 1.1);
      ctx.fillStyle = grad(ctx, 0, fy + 1.1, 0, fy + 4, [[0, black ? "rgba(70, 120, 160, 0.4)" : "rgba(120, 200, 245, 0.34)"], [1, "rgba(60, 120, 170, 0)"]]);
      ctx.fillRect(s0, fy + 1.1, w, 2.9);
      ctx.fillStyle = black ? "rgba(190, 225, 245, 0.5)" : "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(s0, fy + 0.08, w, 0.22);
      // Long glints leaning across it.
      ctx.strokeStyle = black ? "rgba(200, 232, 250, 0.45)" : "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 0.1;
      for (let x = Math.ceil(s0 / 6.2) * 6.2; x < s1 - 1.6; x += 6.2) {
        const h = hash(Math.round(x), 91);
        line(ctx, x + (h % 3) * 0.4, fy + 0.2, x + 1.7 + (h % 3) * 0.4, fy + 0.95);
        if (h % 2) line(ctx, x + 2.3, fy + 0.2, x + 3.1, fy + 0.7);
      }
      // Bubbles and hairline cracks held in the ice below.
      for (let x = Math.ceil(s0 / 4.4) * 4.4; x < s1 - 0.5; x += 4.4) {
        const h = hash(Math.round(x * 2), 92);
        ctx.fillStyle = "rgba(220, 245, 255, 0.4)";
        circle(ctx, x + (h % 7) * 0.2, fy + 1.9 + (h % 4) * 0.6, 0.12 + (h % 3) * 0.06);
        ctx.fill();
        if (h % 5 === 0) {
          ctx.strokeStyle = "rgba(20, 60, 100, 0.5)";
          ctx.lineWidth = 0.08;
          line(ctx, x, fy + 1.2, x + 0.9, fy + 2.4);
          line(ctx, x + 0.9, fy + 2.4, x + 0.5, fy + 3.2);
        }
      }
      // The ice ends in a bright lip.
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(s0, fy, 0.18, 1.1);
      ctx.fillRect(s1 - 0.18, fy, 0.18, 1.1);
    }
  }

  // What a board is, by room: a hut's roof, a mantel or table, a floe, a frozen ledge.
  function shelf(ctx, v, look, a, b, y) {
    const id = v.spec.id;
    if (!ROOM[id]) return;
    const H = v.g.FIELD_H;
    const w = b - a;
    const n = hash(Math.round(a), 65);
    if (id === "huts") {
      const up = H - y - v.groundAt(v.spec, (a + b) / 2);
      // A hut under the roof when it is low enough: planks, a door, a warm window.
      if (up > 0.5 && up <= 12.6) {
        const base = y + up;
        ctx.fillStyle = "#3a2a1c";
        ctx.fillRect(a + 0.4, y + 0.8, w - 0.8, up - 0.8);
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        for (let x = a + 1.2; x < b - 0.4; x += 1.4) ctx.fillRect(x, y + 0.8, 0.1, up - 0.8);
        ctx.fillStyle = "#1c130c";
        ctx.fillRect(a + w * 0.18, base - Math.min(up - 1.2, 5), 2.6, Math.min(up - 1.2, 5));
        if (up > 5) {
          ctx.fillStyle = "#ffd27a";
          ctx.fillRect(b - w * 0.3, y + 2, 2.4, Math.min(2.2, up - 3));
          ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
          ctx.fillRect(b - w * 0.3 + 1.15, y + 2, 0.12, Math.min(2.2, up - 3));
        }
        ctx.fillStyle = "rgba(235, 246, 255, 0.55)";
        ctx.fillRect(a + 0.4, base - 0.4, w - 0.8, 0.4);
      } else {
        // High up: a plank on posts of frozen rope.
        ctx.strokeStyle = "rgba(210, 232, 248, 0.5)";
        ctx.lineWidth = 0.12;
        line(ctx, a + 1, y + 0.8, a + 1, y + 3);
        line(ctx, b - 1, y + 0.8, b - 1, y + 3);
      }
      ctx.fillStyle = "#6a4a2c";
      ctx.fillRect(a - 0.4, y, w + 0.8, 0.9);
      ctx.fillStyle = "#2a1a0e";
      ctx.fillRect(a - 0.4, y + 0.72, w + 0.8, 0.18);
      // Snow lying on the roof, icicles from the eave.
      ctx.fillStyle = "#eaf5fc";
      ctx.fillRect(a - 0.2, y - 0.28, w + 0.4, 0.4);
      for (let x = a + 1; x < b - 0.6; x += 2.8) {
        ellipse(ctx, x, y - 0.25, 1.1, 0.34);
        ctx.fill();
      }
      for (let x = a + 0.8; x < b - 0.4; x += 1.7) if (hash(Math.round(x * 3), 68) % 3) icicle(ctx, x, y + 0.9, 0.6 + (hash(Math.round(x * 3), 69) % 4) * 0.35, 0.34, 0.8);
      // A lantern on some, its glow in the dark (see `lights`).
      if (n % 3 === 0) {
        ctx.strokeStyle = "#12100c";
        ctx.lineWidth = 0.12;
        line(ctx, a + w * 0.5, y - 0.2, a + w * 0.5, y - 1.6);
        ctx.fillStyle = "#ffcf6a";
        ctx.fillRect(a + w * 0.5 - 0.35, y - 2.5, 0.7, 0.95);
        ctx.fillStyle = "#3a2a1c";
        ctx.fillRect(a + w * 0.5 - 0.45, y - 2.65, 0.9, 0.18);
      }
    } else if (id === "lodge") {
      // A mantel, a table, a bookshelf: dark wood, a gilt line, frost over the top.
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(a - 0.3, y, w + 0.6, 1.1);
      ctx.fillStyle = "#4a3320";
      ctx.fillRect(a - 0.3, y, w + 0.6, 0.34);
      ctx.fillStyle = "#b08a3a";
      ctx.fillRect(a - 0.3, y + 0.55, w + 0.6, 0.1);
      ctx.fillStyle = "#1a110a";
      for (let x = a + 0.4; x < b - 0.6; x += 2.6) ctx.fillRect(x, y + 1.1, 0.5, Math.min(4.5, 1.6 + (hash(Math.round(x * 2), 60) % 3)));
      ctx.fillStyle = "rgba(235, 247, 255, 0.85)";
      ctx.fillRect(a - 0.3, y - 0.2, w + 0.6, 0.3);
      for (let x = a + 0.6; x < b - 0.5; x += 1.5) if (hash(Math.round(x * 3), 61) % 2) icicle(ctx, x, y + 1.1, 0.9 + (hash(Math.round(x * 3), 62) % 5) * 0.4, 0.4, 0.75);
    } else if (id === "blackice") {
      // A slab of ice shoved up out of the lake: glassy, blue, a bright top.
      ctx.fillStyle = "#1b3d5c";
      ctx.fillRect(a - 0.3, y, w + 0.6, 1.0);
      ctx.fillStyle = "#6aaed6";
      ctx.fillRect(a - 0.3, y, w + 0.6, 0.38);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      ctx.fillRect(a - 0.3, y + 0.02, w + 0.6, 0.12);
      ctx.fillStyle = "rgba(150, 205, 240, 0.35)";
      poly(ctx, [a, y + 1, b, y + 1, b - 1.4, y + 2.6, a + 1.6, y + 2.1]);
      ctx.fill();
      for (let x = a + 1; x < b - 0.6; x += 2.2) if (hash(Math.round(x * 3), 63) % 2) icicle(ctx, x, y + 1, 0.8 + (hash(Math.round(x * 3), 64) % 4) * 0.4, 0.4, 0.7);
    } else {
      // The cavern's ledges: frozen, a web slung under.
      ctx.fillStyle = "#17415f";
      ctx.fillRect(a - 0.3, y, w + 0.6, 1.0);
      ctx.fillStyle = "#9fdcf5";
      ctx.fillRect(a - 0.3, y, w + 0.6, 0.38);
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(a - 0.3, y + 0.02, w + 0.6, 0.12);
      ctx.strokeStyle = "rgba(225, 244, 255, 0.5)";
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(a, y + 1);
      ctx.quadraticCurveTo((a + b) / 2, y + 3.2, b, y + 1);
      ctx.stroke();
      for (let x = a + 1; x < b - 0.6; x += 2.4) if (hash(Math.round(x * 3), 63) % 2) icicle(ctx, x, y + 1, 0.9 + (hash(Math.round(x * 3), 64) % 4) * 0.4, 0.4, 0.7);
    }
  }

  /* ============================================================= what moves */

  // Open water between x0 and x1 from the floor's top `fy` down: its surface rippling, slabs of ice drifting on it.
  function water(ctx, v, x0, x1, fy, H, seed) {
    const w = x1 - x0;
    const t = v.clock;
    ctx.fillStyle = grad(ctx, 0, fy, 0, H, [[0, "#0d5d8c"], [0.16, "#06304f"], [1, "#010812"]]);
    ctx.fillRect(x0, fy, w, H - fy + 0.2);
    ctx.lineWidth = 0.15;
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = rgba("#bfe8ff", 0.4 - i * 0.08);
      ctx.beginPath();
      for (let x = x0; x <= x1 + 0.01; x += 0.7) {
        const yy = fy + 0.4 + i * 0.75 + Math.sin(x * 1.3 + t / (300 + i * 90) + i + seed) * 0.13;
        if (x === x0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    // Slabs bobbing, and a bubble or two rising.
    const slabs = Math.max(1, Math.floor(w / 6));
    for (let i = 0; i < slabs; i++) {
      const sx = x0 + ((i + 0.5) / slabs) * w + Math.sin(t / 1100 + i * 2 + seed) * 0.7;
      const sw = 1.2 + (hash(i + seed, 95) % 4) * 0.35;
      ctx.fillStyle = "#cfeeff";
      poly(ctx, [sx - sw, fy + 0.2 + Math.sin(t / 800 + i) * 0.1, sx + sw, fy + 0.2 + Math.cos(t / 900 + i) * 0.1, sx + sw * 0.7, fy + 0.7, sx - sw * 0.8, fy + 0.75]);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.fillRect(sx - sw * 0.8, fy + 0.2, sw * 1.3, 0.1);
      const rise = (t / 1700 + i * 0.37) % 1;
      ctx.fillStyle = rgba("#bfe8ff", 0.45 * (1 - rise));
      circle(ctx, sx + 1.4, fy + 5 - rise * 4.6, 0.14);
      ctx.fill();
    }
  }

  // A thin tile: a pane of glass over dark water that clouds and cracks as it fails, open water once it breaks, a film again before it heals.
  function thinTile(ctx, v, tile, H) {
    const fy = H - tile.y;
    const { x0, x1 } = tile;
    const w = x1 - x0;
    const t = v.clock;
    if (tile.state === "broken") {
      water(ctx, v, x0, x1, fy, H, x0);
      // Jagged teeth of ice round the hole.
      ctx.fillStyle = "#dff4ff";
      for (let i = 0; i < 4; i++) {
        const dy = 0.5 + (hash(i, Math.round(x0)) % 5) * 0.2;
        poly(ctx, [x0, fy + i * 0.9, x0 + 0.6 + dy * 0.5, fy + i * 0.9 + 0.35, x0, fy + i * 0.9 + 0.8]);
        ctx.fill();
        poly(ctx, [x1, fy + i * 0.9, x1 - 0.6 - dy * 0.5, fy + i * 0.9 + 0.35, x1, fy + i * 0.9 + 0.8]);
        ctx.fill();
      }
      // Freezing over: a pale film creeps in from both sides in its last moments.
      const back = tile.back || 0;
      if (back > 0 && back < REFREEZE_MS) {
        const p = 1 - back / REFREEZE_MS;
        ctx.fillStyle = rgba("#d8f2ff", 0.5 * p);
        ctx.fillRect(x0, fy, w, 0.5);
        ctx.fillStyle = rgba("#ffffff", 0.7);
        ctx.fillRect(x0, fy, w * p * 0.5, 0.3);
        ctx.fillRect(x1 - w * p * 0.5, fy, w * p * 0.5, 0.3);
      }
      return;
    }
    const prog = clamp(tile.t / THIN_MS, 0, 1);
    const crack = tile.state === "crack";
    // The shake of a tile about to go.
    const jx = crack ? Math.sin(t / 21 + x0) * 0.07 * prog : 0;
    ctx.save();
    ctx.translate(jx, 0);
    // Dark water seen through it, and the glassy skin on top.
    ctx.fillStyle = grad(ctx, 0, fy, 0, fy + 3.6, [[0, "#2f86b6"], [0.35, "#18577f"], [1, "#0a2c4c"]]);
    ctx.fillRect(x0, fy, w, 3.6);
    ctx.fillStyle = rgba("#d2f4ff", crack ? 0.6 : 0.88);
    ctx.fillRect(x0, fy, w, 0.62);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(x0 + 0.2, fy + 0.06, w - 0.4, 0.14);
    // A green-grey tint as it weakens, and hairlines that lengthen with the weight on it.
    ctx.fillStyle = rgba("#2a5a70", 0.2 + 0.4 * prog);
    ctx.fillRect(x0, fy + 0.62, w, 0.5);
    const lines = Math.ceil(prog * 7);
    for (let i = 0; i < lines; i++) {
      const bx = x0 + 0.5 + unit(i * 7 + x0, 96) * (w - 1);
      let px = bx;
      let py = fy + 0.05;
      ctx.beginPath();
      ctx.moveTo(px, py);
      const segs = 2 + Math.floor(prog * 3);
      for (let s = 0; s < segs; s++) {
        px += (unit(i * 13 + s, Math.round(x0)) - 0.5) * 1.3;
        py += 0.55 + unit(i + s * 5, Math.round(x0) + 1) * 0.5 * (crack ? 1.6 : 1);
        ctx.lineTo(clamp(px, x0 + 0.1, x1 - 0.1), Math.min(py, fy + 3.4));
      }
      ctx.strokeStyle = "rgba(2, 14, 28, 0.9)";
      ctx.lineWidth = crack ? 0.2 : 0.12;
      ctx.stroke();
      ctx.strokeStyle = "rgba(235, 248, 255, 0.7)";
      ctx.lineWidth = 0.05;
      ctx.stroke();
    }
    if (crack) {
      // Chips lifting off the top, a seep of black water in the cracks.
      for (let i = 0; i < 4; i++) {
        const a = (t / 120 + i * 1.7) % 1;
        ctx.fillStyle = rgba("#dff4ff", 0.8 * (1 - a));
        ctx.fillRect(x0 + unit(i, Math.round(x0) + 3) * w, fy - a * 1.1, 0.2, 0.2);
      }
      ctx.fillStyle = rgba("#020a14", 0.35 + 0.4 * ((prog - 0.38) / 0.62));
      ctx.fillRect(x0 + w * 0.3, fy, w * 0.4, 0.34);
    }
    ctx.restore();
    // The tile's two edges: a thin dark seam, so a pane reads as a pane.
    ctx.fillStyle = "rgba(2, 12, 24, 0.7)";
    ctx.fillRect(x0 - 0.06, fy, 0.12, 1.1);
    ctx.fillRect(x1 - 0.06, fy, 0.12, 1.1);
  }

  // Snow falling: `n` flakes of a layer, the near ones bigger, quicker and sideways.
  function snowfall(ctx, v, cam, n, layer, alpha) {
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    const t = v.clock / 1000;
    ctx.fillStyle = `rgba(244, 250, 255, ${alpha})`;
    for (let i = 0; i < n; i++) {
      const hx = hash(i, 11 + layer * 7) / 997;
      const hy = hash(i, 13 + layer * 5) / 997;
      const fall = 3 + layer * 3.4 + hy * 2.6;
      const sway = Math.sin(t * 0.8 + i) * 0.9;
      const x = cam - 6 + ((hx * (W + 12) + t * (1.4 + layer * 1.6) + sway + (W + 12) * 8) % (W + 12));
      const y = (hy * H + t * fall) % H;
      const s = 0.13 + layer * 0.07 + (i % 3) * 0.03;
      ctx.fillRect(x, y, s, s);
    }
  }

  // A faint star of light on the ice, twinkling.
  function glint(ctx, x, y, k) {
    if (k <= 0) return;
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * k})`;
    ctx.lineWidth = 0.09;
    const r = 0.26 + 0.6 * k;
    line(ctx, x - r, y, x + r, y);
    line(ctx, x, y - r * 1.3, x, y + r * 1.3);
  }

  // Faces held under the Black Ice, turned to watch you pass.
  function faces(ctx, v, cam, W, H) {
    const you = v.round.you;
    eachAt(cam, cam + W, 21, 9, 4, (x, n) => {
      if (hash(n, 97) % 5 > 2) return;
      if (!within(v.spec.ice, x - 1, x + 1).length) return;
      const top = v.groundAt(v.spec, x);
      if (!(top > -Infinity)) return;
      const fy = H - top;
      const cy = fy + 2.2 + (hash(n, 98) % 4) * 0.4;
      const look = clamp((you.x - x) / 18, -1, 1);
      const pulse = 0.2 + 0.1 * Math.sin(v.clock / 700 + n);
      ctx.fillStyle = `rgba(185, 222, 245, ${pulse})`;
      ellipse(ctx, x, cy, 0.95, 1.2);
      ctx.fill();
      ctx.fillStyle = "rgba(3, 12, 26, 0.7)";
      for (const s of [-1, 1]) {
        ellipse(ctx, x + s * 0.38 + look * 0.1, cy - 0.2, 0.2, 0.28);
        ctx.fill();
      }
      ellipse(ctx, x + look * 0.12, cy + 0.5, 0.2, 0.34 + 0.08 * Math.sin(v.clock / 500 + n));
      ctx.fill();
      ctx.fillStyle = `rgba(210, 240, 255, ${pulse + 0.25})`;
      for (const s of [-1, 1]) {
        circle(ctx, x + s * 0.38 + look * 0.2, cy - 0.2, 0.06);
        ctx.fill();
      }
      // A hand pressed flat to the underside of the ice, now and then.
      if (hash(n, 99) % 2) {
        ctx.fillStyle = `rgba(185, 222, 245, ${pulse * 0.8})`;
        ellipse(ctx, x + 2.1, fy + 1.55, 0.5, 0.36);
        ctx.fill();
        for (let k = 0; k < 4; k++) line(ctx, x + 1.75 + k * 0.24, fy + 1.4, x + 1.7 + k * 0.28, fy + 1.0);
      }
    });
  }

  function moving(ctx, v, cam) {
    const id = v.spec.id;
    if (!ROOM[id] || !v.round) return;
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    const round = v.round;
    // The holes in the ice (the pits) and the tiles that have gone.
    const whole = (v.spec.base || v.spec).ground;
    for (let i = 0; i + 1 < whole.length; i++) {
      const a = whole[i][1];
      const b = whole[i + 1][0];
      if (b - a < 0.5 || b < cam - 2 || a > cam + W + 2) continue;
      water(ctx, v, a, b, H - Math.min(whole[i][2], whole[i + 1][2]), H, a);
    }
    if (round.thin) for (const tile of round.thin.tiles) if (tile.x1 > cam - 2 && tile.x0 < cam + W + 2) thinTile(ctx, v, tile, H);
    // Glints along the ice, twinkling out of step.
    for (const [s0, s1] of within(v.spec.ice, cam - 2, cam + W + 2)) {
      for (let x = Math.ceil(s0 / 3.7) * 3.7; x < s1; x += 3.7) {
        const h = hash(Math.round(x * 2), 93);
        const top = v.groundAt(v.spec, x);
        if (!(top > -Infinity)) continue;
        glint(ctx, x + (h % 5) * 0.3, H - top + 0.5, Math.max(0, Math.sin(v.clock / (260 + (h % 5) * 60) + h)) - 0.45);
      }
    }
    if (id === "blackice") faces(ctx, v, cam, W, H);
    if (id === "widow") {
      // The web over the arena stirs, and a thread now and then catches the light.
      const arena = v.spec.arena;
      const t = v.clock;
      ctx.strokeStyle = "rgba(235, 248, 255, 0.5)";
      ctx.lineWidth = 0.1;
      for (let i = 0; i < 6; i++) {
        const x = arena + 10 + i * 15 + Math.sin(t / 1900 + i) * 1.2;
        const k = Math.max(0, Math.sin(t / 900 + i * 1.7));
        ctx.globalAlpha = k * 0.8;
        line(ctx, x, 1, x + Math.sin(t / 1300 + i) * 0.8, 4 + k * 5);
      }
      ctx.globalAlpha = 1;
    }
    if (id !== "lodge") {
      snowfall(ctx, v, cam, id === "widow" ? 26 : 56, 0, id === "blackice" ? 0.28 : 0.4);
      snowfall(ctx, v, cam, id === "widow" ? 14 : 34, 1, 0.55);
    } else {
      // Snow drifting down through the holes in the roof.
      for (const [s0, s1] of reaching(v.spec.ice, cam - 20, cam + W + 20)) {
        const cx = (s0 + s1) / 2;
        const w = Math.min(46, (s1 - s0) * 0.85);
        ctx.fillStyle = "rgba(240, 248, 255, 0.7)";
        for (let i = 0; i < 24; i++) {
          const fall = ((v.clock / 1000) * (3 + (i % 4)) + unit(i, 100) * 40) % 40;
          const sx = cx + (unit(i + Math.round(s0), 101) - 0.5) * w * (0.5 + fall / 40) + Math.sin(v.clock / 900 + i) * 0.6;
          ctx.fillRect(sx, 4 + fall, 0.15, 0.15);
        }
      }
    }
  }

  /* ================================================================ lights */

  function lights(v, add) {
    const id = v.spec && v.spec.id;
    if (!ROOM[id] || !v.round) return;
    const H = v.g.FIELD_H;
    const cam = v.round.camX;
    const W = v.g.FIELD_W;
    const t = v.clock;
    if (id === "huts") {
      for (const [a, b, y] of v.spec.shelves) if (b > cam - 6 && a < cam + W + 6 && hash(Math.round(a), 65) % 3 === 0) add((a + b) / 2, y + 2.2, 9, 0.5 + 0.05 * Math.sin(t / 220 + a));
      eachAt(cam - 10, cam + W + 10, 61, 17, 14, (x) => add(x, H - 8, 6, 0.28));
    } else if (id === "lodge") {
      for (const [s0, s1] of reaching(v.spec.ice, cam - 30, cam + W + 30)) add((s0 + s1) / 2, H - 6, 18, 0.34);
      eachAt(cam - 10, cam + W + 10, 58, 20, 8, (x) => add(x, H - 15, 8, 0.28));
    } else if (id === "blackice") {
      eachAt(cam - 10, cam + W + 10, 21, 9, 4, (x, n) => {
        if (hash(n, 97) % 5 <= 2) add(x, H - 6 - 2.2, 2.6, 0.18);
      });
      eachAt(cam - 10, cam + W + 10, 71, 33, 8, (x) => add(x, 4, 5, 0.18));
    } else {
      const arena = v.spec.arena;
      eachAt(cam - 10, cam + W + 10, 40, 8, 4, (x) => add(x, H - 22, 16, 0.2));
      add(arena + 52, H - 4, 26, 0.18 + 0.03 * Math.sin(t / 700));
      for (const [a, b, y] of v.spec.shelves) add((a + b) / 2, y + 0.6, 4, 0.2);
    }
  }

  return freeze({ sky, backdrop, ground, shelf, moving, lights });
}
