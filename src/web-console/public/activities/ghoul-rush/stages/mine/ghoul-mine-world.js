// Plan2Code Web Console - Ghoul Rush's Deep Seam Mine, the world it is set in: the rough rock with its strata, the timber that holds it up (props and cap beams, scaffolds, galleries), the rails along the floor, the oil lamps on their hooks and their flames, the shaft with its cage lifts on cables, the flooded tunnels with their water, pipes, pump and drips, the collapse with its broken props, rubble and buried cart, the Mother Seam with its glittering ore, and the rocks that fall.
//
// ghoul-mine-draw.js plugs it in. mineWorld(d) takes ghoul-draw.js's own
// drawing helpers (`d`) and hands back, by hook: `backdrop` (the still scenery
// of a room, cached in the layers), `ground` (what lies on a floor piece),
// `shelf` (a landing, scaffold or gallery), `moving` (flames, drips, dust,
// glints, over the still layers), `front` (the water over Planny's legs and
// the front bars of a cage), `lights` (the lamps), `cage` (a lift on its
// cable) and `rock` (the hazard in its three states). Drawn in room units, y
// counted down from the field's top, a floor piece's `top` counted up.
//
// What it reads off the rules (ghoul-mine.js): `spec.id`, `spec.length`,
// `spec.water` ([x0, x1] spans), `spec.shelves`, the cage spawn rows ["cage",
// x, lowest bottom, highest bottom], `round.blackout` (the lamps are out),
// `you.wet` and `you.face`, a cage's `m.y`, `m.lo`, `m.hi`, `m.rest`, and a
// rock's `x`, `y`, `w`, `h`, `floor`, `state`, `warn`, `total`, `rub`.

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const IRON = "#3a3a42";
const IRON_HI = "#8a8a96";
const RUST = "#7a4a2a";
const BRASS = "#b08a3a";
const DUST = "#8a7a68";

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

// A vertical gradient as a fill style (the first stop's middle where the
// context makes none).
function vgrad(ctx, y0, y1, stops) {
  const g = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, y0, 0, y1) : null;
  if (g && typeof g.addColorStop === "function") {
    for (const [at, color] of stops) g.addColorStop(at, color);
    return g;
  }
  return stops[stops.length >> 1][1];
}

const ROOM = freeze({ shaft: 1, tunnels: 1, collapse: 1, seam: 1 });

// How deep the water is (knee-deep) and how long a rubble heap lies.
const WATER_DEEP = 1.8;
const RUBBLE_MS = 4500;

export function mineWorld(d) {
  const { ellipse, circle, line, hash, FLASH } = d;
  const unit = (a, b) => hash(a, b) / 997;

  /* ------------------------------------------------------------- shapes */

  // A lumpy stone round (cx, cy), `seed` deciding its corners.
  function lump(ctx, cx, cy, rx, ry, seed) {
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + unit(seed, i) * 0.5;
      const k = 0.7 + unit(seed + 3, i) * 0.42;
      const px = cx + Math.cos(a) * rx * k;
      const py = cy + Math.sin(a) * ry * k;
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.closePath();
  }

  // A boulder: a lump, lit on top, shadowed underneath.
  function boulder(ctx, cx, cy, rx, ry, seed, base) {
    ctx.fillStyle = base;
    lump(ctx, cx, cy, rx, ry, seed);
    ctx.fill();
    ctx.fillStyle = shade(base, 0.28);
    ctx.globalAlpha = 0.55;
    lump(ctx, cx - rx * 0.12, cy - ry * 0.28, rx * 0.66, ry * 0.5, seed + 9);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = 0.3;
    ctx.fillRect(cx - rx * 0.8, cy + ry * 0.55, rx * 1.6, ry * 0.3);
    ctx.globalAlpha = 1;
  }

  // A jagged crack from (x0, y0) toward (x1, y1).
  function crack(ctx, x0, y0, x1, y1, seed, amp, step) {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i <= n; i++) {
      const f = i / n;
      const j = (unit(seed, i) - 0.5) * 2 * amp * (i === n ? 0.3 : 1);
      ctx.lineTo(x0 + (x1 - x0) * f + j, y0 + (y1 - y0) * f + (unit(seed + 7, i) - 0.5) * amp * 0.8);
    }
    ctx.stroke();
  }

  function bolt(ctx, x, y) {
    ctx.fillStyle = "#16161a";
    ctx.fillRect(x - 0.22, y - 0.22, 0.44, 0.44);
    ctx.fillStyle = IRON_HI;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x - 0.16, y - 0.18, 0.18, 0.16);
    ctx.globalAlpha = 1;
  }

  // An upright timber from y0 to y1, w across, lit down its left.
  function post(ctx, x, y0, y1, w, wood, hi, seed) {
    ctx.fillStyle = shade(wood, -0.55);
    ctx.fillRect(x - w / 2, y0, w, y1 - y0);
    ctx.fillStyle = wood;
    ctx.fillRect(x - w / 2 + w * 0.1, y0, w * 0.66, y1 - y0);
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x - w / 2 + w * 0.14, y0, Math.max(0.12, w * 0.14), y1 - y0);
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = shade(wood, -0.6);
    ctx.fillRect(x - w * 0.02 + (unit(seed, 1) - 0.5) * w * 0.3, y0, 0.07, y1 - y0);
    ctx.fillRect(x + w * 0.2, y0 + unit(seed, 2) * 3, 0.07, (y1 - y0) * 0.7);
    ctx.globalAlpha = 1;
  }

  // A level timber from x0 to x1, its top at y, h thick.
  function beam(ctx, x0, y, x1, h, wood, hi) {
    ctx.fillStyle = shade(wood, -0.55);
    ctx.fillRect(x0, y, x1 - x0, h);
    ctx.fillStyle = wood;
    ctx.fillRect(x0, y, x1 - x0, h * 0.7);
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x0, y, x1 - x0, Math.max(0.12, h * 0.16));
    ctx.globalAlpha = 1;
  }

  // A slanted timber, w thick.
  function brace(ctx, x0, y0, x1, y1, w, wood, hi) {
    ctx.lineCap = "butt";
    ctx.strokeStyle = shade(wood, -0.55);
    ctx.lineWidth = w;
    line(ctx, x0, y0, x1, y1);
    ctx.strokeStyle = wood;
    ctx.lineWidth = w * 0.62;
    line(ctx, x0, y0, x1, y1);
    ctx.strokeStyle = hi;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = w * 0.14;
    line(ctx, x0, y0 - w * 0.2, x1, y1 - w * 0.2);
    ctx.globalAlpha = 1;
  }

  // A hanging chain from y0 to y1.
  function chain(ctx, x, y0, y1) {
    for (let y = y0, i = 0; y < y1; y += 0.8, i++) {
      ctx.fillStyle = i % 2 ? "#6a6a74" : "#2a2a30";
      ctx.fillRect(x - (i % 2 ? 0.07 : 0.22), y, i % 2 ? 0.14 : 0.44, 0.78);
    }
  }

  function ladder(ctx, x, y0, y1, wood, hi) {
    ctx.fillStyle = shade(wood, -0.35);
    ctx.fillRect(x - 0.95, y0, 0.28, y1 - y0);
    ctx.fillRect(x + 0.67, y0, 0.28, y1 - y0);
    ctx.fillStyle = hi;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(x - 0.9, y0, 0.08, y1 - y0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade(wood, -0.2);
    for (let y = y0 + 0.8; y < y1 - 0.3; y += 1.25) ctx.fillRect(x - 0.7, y, 1.4, 0.2);
  }

  /* ----------------------------------------------------------- the layout */

  // Where the props, lamps, drips and the rest sit in each room, from the
  // room alone (so the still layers and the moving ones agree), kept.
  const LAYOUTS = new Map();

  // The rock ceiling's lower edge at x (a low tunnel, a cracked roof).
  function ceilY(id, x) {
    const n = Math.round(x / 4);
    if (id === "tunnels") return 5.4 + Math.sin(x * 0.11) * 0.9 + unit(n, 9) * 1.3;
    if (id === "collapse") return 3.6 + Math.sin(x * 0.07) * 1.4 + unit(Math.round(x / 5), 11) * 3.4;
    return 0;
  }

  // Where the ore seam's middle runs across the Mother Seam's back wall.
  const veinY = (x) => 33 - x * 0.115 + Math.sin(x * 0.045) * 4.5 + Math.sin(x * 0.13) * 1.2;

  function layoutOf(v) {
    const spec = v.spec;
    if (!spec || !ROOM[spec.id]) return null;
    let L = LAYOUTS.get(spec.id);
    if (L) return L;
    const id = spec.id;
    const H = v.g.FIELD_H;
    const len = spec.length;
    const solid = (x) => v.groundAt(spec, x) > -Infinity;
    const floorAt = (x) => H - (solid(x) ? v.groundAt(spec, x) : 6);
    const water = spec.water || [];
    const wet = (x) => water.some(([a, b]) => x > a && x < b);
    L = { id, H, len, frames: [], lamps: [], drips: [], glints: [], heaps: [], cracks: [], chains: [], ladders: [], pumps: [], carts: [], seep: [], stalac: [], cols: [], cages: [], lining: [], motes: id === "collapse" ? 22 : id === "seam" ? 12 : 8 };
    // Timber props, a set every so often.
    const step = { shaft: 34, tunnels: 27, collapse: 29, seam: 38 }[id];
    const vary = { shaft: 10, tunnels: 8, collapse: 14, seam: 10 }[id];
    for (let x = 10 + (len % 8), i = 0; x < len - 6; i++) {
      const h = hash(i, len + 5);
      if (solid(x)) L.frames.push({ x, i, h, fy: floorAt(x), state: id === "collapse" ? [0, 1, 1, 2, 0, 3, 1][h % 7] : 0, lean: ((h % 7) - 3) * 0.045 });
      x += step + (h % vary);
    }
    // Oil lamps, on hooks beside the props.
    if (id === "seam") {
      for (let x = 14, n = 0; x < len - 4; x += 22 + (hash(n, 4) % 6), n++) L.lamps.push({ x, y: 22 + (n % 2) * 5, n });
      for (const [a, b, y] of spec.shelves) if (y > 16) L.lamps.push({ x: a + 0.5, y: H - y - 5.2, n: L.lamps.length });
    } else {
      let n = 0;
      for (const f of L.frames) if (f.i % 2 === 0 && f.state < 2) L.lamps.push({ x: f.x + 2.3, y: 26 + (f.h % 5), n: n++ });
    }
    // Drips from the ceiling (or grit, in the collapse).
    const dripEvery = { shaft: 52, tunnels: 21, collapse: 34, seam: 46 }[id];
    for (let x = 6, n = 0; x < len - 4; x += dripEvery + (hash(n, 6) % 11), n++) {
      if (!solid(x)) continue;
      const w = wet(x);
      const y0 = id === "seam" ? 2 + (n % 3) * 3 : id === "shaft" ? 1 : ceilY(id, x) + 0.4;
      L.drips.push({ x, y0, fy: floorAt(x) - (w ? WATER_DEEP : 0), per: 1700 + (hash(n, 8) % 1800), off: hash(n, 9) * 5, grit: id === "collapse", wet: w, n });
    }
    if (id === "shaft") {
      for (let x = 20, n = 0; x < len - 10; x += 28 + (hash(n, 12) % 22), n++) L.chains.push({ x, len: 9 + (hash(n, 13) % 22), n });
      for (let x = 70, n = 0; x < len - 20; x += 90 + (hash(n, 14) % 50), n++) if (solid(x)) L.ladders.push({ x, top: 8 + (hash(n, 15) % 10), fy: floorAt(x) });
      for (let x = 0, n = 0; x < len; n++) {
        const w = 46 + (hash(n, 16) % 40);
        L.lining.push([x, x + w]);
        x += w + 10 + (hash(n, 17) % 16);
      }
      for (const s of spec.spawns) if (s[0] === "cage") L.cages.push({ x: s[1], low: H - s[2], high: H - s[3] });
    }
    if (id === "tunnels") {
      for (let x = 12, n = 0; x < len; x += 13 + (hash(n, 18) % 12), n++) L.seep.push({ x, y0: 5 + (n % 3) * 2, len: 12 + (hash(n, 19) % 24), n });
      for (const x of [164, 248]) L.pumps.push({ x, fy: floorAt(x) });
    }
    if (id === "collapse") {
      for (let x = 14, n = 0; x < len - 6; x += 24 + (hash(n, 20) % 22), n++) L.cracks.push({ x, y: ceilY(id, x), len: 9 + (hash(n, 21) % 18), n });
      for (let x = 24, n = 0; x < len - 12; x += 30 + (hash(n, 22) % 20), n++) {
        if (!solid(x) || !solid(x + 7) || v.groundAt(spec, x) !== v.groundAt(spec, x + 7)) continue;
        L.heaps.push({ x, w: 6 + (hash(n, 23) % 7), h: 2 + (hash(n, 24) % 4), fy: floorAt(x), n });
      }
      for (const x of [186, 430]) L.carts.push({ x, fy: floorAt(x) });
    }
    if (id === "seam") {
      for (let x = 4, n = 0; x < len; x += 7 + (hash(n, 25) % 12), n++) L.stalac.push({ x, len: 3 + (hash(n, 26) % 11), w: 1.4 + (hash(n, 27) % 4) * 0.5, n });
      for (let x = 30, n = 0; x < len - 10; x += 38 + (hash(n, 28) % 24), n++) L.cols.push({ x, w: 6 + (hash(n, 29) % 5), n });
      for (let n = 0; n < 70; n++) {
        const x = 2 + unit(n, 30) * (len - 4);
        L.glints.push({ x, y: veinY(x) + (unit(n, 31) - 0.5) * 7, per: 1400 + (hash(n, 32) % 1800), off: hash(n, 33) * 5, s: 0.8 + unit(n, 34) });
      }
    }
    LAYOUTS.set(id, L);
    return L;
  }

  /* ----------------------------------------------------------- the rock */

  const bandY = (x, i) => 2 + i * 6.9 + Math.sin(x * 0.05 + i * 1.9) * 1.5 + (hash(Math.round(x / 6), i) % 10) * 0.12;

  // The rock wall from x0 to x1: a gradient, strata bands, facets and cracks.
  function rockWall(ctx, look, x0, x1, H, wet) {
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, look.wallTop], [0.5, look.wallLow], [1, shade(look.wallLow, -0.3)]]);
    ctx.fillRect(x0, 0, x1 - x0, H);
    const lo = Math.floor(x0 / 6) * 6 - 6;
    const hi = lo + Math.ceil((x1 + 6 - lo) / 6) * 6;
    ctx.strokeStyle = shade(look.paper, 0.3);
    ctx.lineWidth = 0.1;
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = look.paper;
      ctx.globalAlpha = 0.2 + (i % 2) * 0.08;
      ctx.beginPath();
      for (let x = lo; x <= hi; x += 6) {
        if (x === lo) ctx.moveTo(x, bandY(x, i));
        else ctx.lineTo(x, bandY(x, i));
      }
      const th = 0.5 + (i % 3) * 0.45;
      for (let x = hi; x >= lo; x -= 6) ctx.lineTo(x, bandY(x, i) + th + (hash(Math.round(x / 6), i + 20) % 4) * 0.15);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.14;
      ctx.stroke();
    }
    // Facets of the rock face, some lit, some in shadow.
    const c0 = Math.floor(x0 / 9) - 1;
    const c1 = Math.ceil(x1 / 9);
    for (const light of [false, true]) {
      ctx.fillStyle = light ? shade(look.paper, 0.2) : "#000000";
      ctx.globalAlpha = light ? 0.15 : 0.22;
      for (let cx = c0; cx <= c1; cx++) {
        for (let cy = 0; cy < 6; cy++) {
          const h = hash(cx, cy + 40);
          if (h % 3 === 0 || (h % 2 === 1) !== light) continue;
          lump(ctx, cx * 9 + (h % 7), cy * 9 + 3 + ((h >> 3) % 6), 1.8 + (h % 4), 1.2 + ((h >> 2) % 3), h);
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
    // Hairline cracks, and the wet's pale sheen.
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 0.14;
    for (let x = Math.floor(x0 / 23) * 23 - 23; x < x1 + 23; x += 23) {
      const h = hash(Math.round(x / 23), 41);
      if (h % 2) continue;
      crack(ctx, x + (h % 9), 6 + (h % 20), x + (h % 9) + ((h % 5) - 2) * 2, 14 + (h % 24), h, 0.7, 2.4);
    }
    if (wet) {
      ctx.strokeStyle = "rgba(160, 225, 225, 0.3)";
      ctx.lineWidth = 0.12;
      for (let cx = c0; cx <= c1; cx++) {
        for (let cy = 0; cy < 6; cy++) {
          const h = hash(cx, cy + 60);
          if (h % 3) continue;
          const px = cx * 9 + (h % 7);
          const py = cy * 9 + 2 + ((h >> 3) % 7);
          line(ctx, px, py, px + 1.6 + (h % 3), py - 0.5);
        }
      }
    }
  }

  // The dark closing in toward the roof.
  function roofShade(ctx, x0, x1, H, a) {
    ctx.fillStyle = vgrad(ctx, 0, H * 0.5, [[0, `rgba(0, 0, 0, ${a})`], [1, "rgba(0, 0, 0, 0)"]]);
    ctx.fillRect(x0, 0, x1 - x0, H * 0.5);
  }

  /* ------------------------------------------------------ lamps and hooks */

  // The unlit part of an oil lamp: its bracket, hook and brass lantern (the
  // flame is drawn by `moving`).
  function lampBody(ctx, lx, ly) {
    ctx.fillStyle = "#3a2c1c";
    ctx.fillRect(lx - 2.2, ly - 2.5, 0.9, 1.7);
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.18;
    line(ctx, lx - 1.8, ly - 2.1, lx, ly - 2.1);
    line(ctx, lx, ly - 2.1, lx, ly - 1.3);
    ctx.fillStyle = IRON;
    ctx.fillRect(lx - 0.75, ly - 1.25, 1.5, 0.35);
    ctx.fillStyle = "rgba(255, 190, 90, 0.75)";
    ctx.fillRect(lx - 0.55, ly - 0.9, 1.1, 1.5);
    ctx.fillStyle = BRASS;
    ctx.fillRect(lx - 0.7, ly + 0.6, 1.4, 0.35);
    ctx.fillRect(lx - 0.7, ly - 0.95, 0.18, 1.6);
    ctx.fillRect(lx + 0.52, ly - 0.95, 0.18, 1.6);
  }

  function lampsIn(ctx, L, x0, x1) {
    for (const lamp of L.lamps) if (lamp.x > x0 - 3 && lamp.x < x1 + 3) lampBody(ctx, lamp.x, lamp.y);
  }

  /* ---------------------------------------------------------- the frames */

  // A T of timber: a post to the floor under a cap beam, knee braces to its
  // ends. `state`: 0 standing, 1 leaning, 2 snapped, 3 gone but its stump.
  function frameT(ctx, look, f, capY, pw, capLen) {
    const wood = look.wainscot;
    const hi = look.shelfTop;
    const fy = f.fy + 0.4;
    if (f.state === 3) {
      post(ctx, f.x, fy - 1.6, fy, pw, wood, hi, f.h);
      ctx.fillStyle = shade(wood, -0.55);
      ctx.beginPath();
      ctx.moveTo(f.x - pw / 2, fy - 1.6);
      ctx.lineTo(f.x - pw * 0.2, fy - 2.5);
      ctx.lineTo(f.x + pw * 0.1, fy - 1.8);
      ctx.lineTo(f.x + pw / 2, fy - 2.3);
      ctx.lineTo(f.x + pw / 2, fy - 1.6);
      ctx.fill();
      return;
    }
    ctx.save();
    if (f.state === 1) {
      ctx.translate(f.x, fy);
      ctx.rotate(f.lean * 2.2 + (f.lean < 0 ? -0.07 : 0.07));
      ctx.translate(-f.x, -fy);
    }
    const top = f.state === 2 ? fy - (fy - capY) * 0.55 : capY;
    post(ctx, f.x, top, fy, pw, wood, hi, f.h);
    if (f.state === 2) {
      // The post breaks in a splintered point; the cap beam hangs from a chain.
      ctx.fillStyle = shade(wood, -0.2);
      ctx.beginPath();
      ctx.moveTo(f.x - pw / 2, top);
      ctx.lineTo(f.x - pw * 0.15, top - 1.7);
      ctx.lineTo(f.x + pw * 0.1, top - 0.6);
      ctx.lineTo(f.x + pw / 2, top - 1.3);
      ctx.lineTo(f.x + pw / 2, top);
      ctx.fill();
      ctx.restore();
      const dir = f.h % 2 ? 1 : -1;
      chain(ctx, f.x + dir * capLen * 0.45, 0, capY + 1);
      ctx.save();
      ctx.translate(f.x + dir * capLen * 0.45, capY + 1);
      ctx.rotate(dir * 0.5);
      beam(ctx, -capLen * 0.9, 0, capLen * 0.1, pw * 0.55, wood, hi);
      ctx.restore();
      return;
    }
    beam(ctx, f.x - capLen / 2, capY, f.x + capLen / 2, pw * 0.55, wood, hi);
    bolt(ctx, f.x, capY + pw * 0.27);
    const by = capY + pw * 0.55;
    brace(ctx, f.x, by + capLen * 0.34, f.x - capLen * 0.4, by, pw * 0.34, wood, hi);
    if (f.state === 0) brace(ctx, f.x, by + capLen * 0.34, f.x + capLen * 0.4, by, pw * 0.34, wood, hi);
    ctx.restore();
  }

  /* ----------------------------------------------------------- the shaft */

  function wallShaft(ctx, v, look, x0, x1, L, H) {
    rockWall(ctx, look, x0, x1, H, false);
    const wood = look.wainscot;
    const hi = look.shelfTop;
    // Timber lining, plank by plank, in stretches between bare rock.
    for (const [a, b] of L.lining) {
      if (b < x0 || a > x1) continue;
      for (let px = a; px < b; px += 1.7) {
        if (px + 1.7 < x0 || px > x1) continue;
        const h = hash(Math.round(px * 2), 7);
        ctx.fillStyle = shade(wood, -0.5 + (h % 5) * 0.05);
        ctx.fillRect(px, 0, 1.62, H);
        ctx.fillStyle = hi;
        ctx.globalAlpha = 0.14;
        ctx.fillRect(px + 0.1, 0, 0.22, H);
        ctx.globalAlpha = 1;
        if (h % 5 === 0) {
          ctx.fillStyle = shade(wood, -0.75);
          ellipse(ctx, px + 0.8, 6 + (h % 36), 0.3, 0.55);
          ctx.fill();
        }
      }
    }
    // The shaft's dark opening and guide rails where a cage runs.
    for (const c of L.cages) {
      if (c.x + 12 < x0 || c.x - 12 > x1) continue;
      ctx.fillStyle = vgrad(ctx, 0, H, [[0, "rgba(0, 0, 0, 0.8)"], [0.6, "rgba(0, 0, 0, 0.5)"], [1, "rgba(0, 0, 0, 0.3)"]]);
      ctx.fillRect(c.x - 4.9, 0, 9.8, c.low + 0.5);
      for (const s of [-3.7, 3.7]) {
        ctx.fillStyle = IRON;
        ctx.fillRect(c.x + s - 0.25, 0, 0.5, c.low + 0.5);
        ctx.fillStyle = IRON_HI;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(c.x + s - 0.2, 0, 0.12, c.low + 0.5);
        ctx.globalAlpha = 1;
        for (let y = 5; y < c.low; y += 9) {
          ctx.fillStyle = "#26262c";
          ctx.fillRect(c.x + s - (s < 0 ? 1.2 : 0), y, 1.2, 0.5);
        }
      }
    }
    // Walers across the shaft, studs on the lining, braces in some bays.
    for (const y of [4.5, 21, 37.5]) {
      beam(ctx, x0, y, x1, 1.7, wood, hi);
      for (let x = Math.floor(x0 / 11) * 11; x < x1 + 11; x += 11) bolt(ctx, x + 2, y + 0.85);
    }
    const near = L.frames.filter((f) => f.x > x0 - 14 && f.x < x1 + 14);
    for (let k = 0; k + 1 < near.length; k++) {
      const f = near[k];
      const g = near[k + 1];
      if (f.h % 3 !== 0) continue;
      const y = [4.5, 21][f.h % 2];
      brace(ctx, f.x, y + 1.7, g.x, y + 16.5, 0.9, wood, hi);
      brace(ctx, g.x, y + 1.7, f.x, y + 16.5, 0.9, wood, hi);
    }
    for (const c of L.chains) {
      if (c.x < x0 - 2 || c.x > x1 + 2) continue;
      ctx.fillStyle = IRON;
      ctx.fillRect(c.x - 0.45, 0, 0.9, 0.7);
      chain(ctx, c.x, 0.7, 0.7 + c.len);
      ctx.fillStyle = IRON;
      ellipse(ctx, c.x, 1.2 + c.len, 0.4, 0.5);
      ctx.fill();
      if (c.n % 2) {
        ctx.fillStyle = "#4a4a52";
        ctx.fillRect(c.x - 0.9, 1.4 + c.len, 1.8, 1.6);
        ctx.fillStyle = IRON_HI;
        ctx.globalAlpha = 0.4;
        ctx.fillRect(c.x - 0.9, 1.4 + c.len, 1.8, 0.25);
        ctx.globalAlpha = 1;
      }
    }
    for (const lad of L.ladders) if (lad.x > x0 - 3 && lad.x < x1 + 3) ladder(ctx, lad.x, lad.top, lad.fy, wood, hi);
    for (const f of L.frames) {
      if (f.x < x0 - 3 || f.x > x1 + 3) continue;
      post(ctx, f.x, 0, f.fy + 0.4, 2.2, wood, hi, f.h);
      for (const y of [4.5, 21, 37.5]) if (y < f.fy) bolt(ctx, f.x, y + 0.85);
    }
    // The headframe above a cage: a heavy beam on two legs.
    for (const c of L.cages) {
      if (c.x + 14 < x0 || c.x - 8 > x1) continue;
      beam(ctx, c.x - 7, 0, c.x + 11.5, 2.6, wood, hi);
      for (const lx of [c.x - 6, c.x + 10.5]) post(ctx, lx, 2.6, 16, 1.4, wood, hi, c.x);
      brace(ctx, c.x - 6, 11, c.x - 2.5, 2.6, 0.9, wood, hi);
      brace(ctx, c.x + 10.5, 11, c.x + 7, 2.6, 0.9, wood, hi);
    }
    lampsIn(ctx, L, x0, x1);
    roofShade(ctx, x0, x1, H, 0.55);
  }

  /* --------------------------------------------------------- the tunnels */

  // A rusty pipe from x0 to x1 at y, h thick.
  function pipe(ctx, x0, y, x1, h, seed) {
    ctx.fillStyle = "#2c2622";
    ctx.fillRect(x0, y, x1 - x0, h);
    ctx.fillStyle = "#5a4a3c";
    ctx.fillRect(x0, y + h * 0.12, x1 - x0, h * 0.58);
    ctx.fillStyle = "#9a8a76";
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x0, y + h * 0.14, x1 - x0, h * 0.18);
    ctx.globalAlpha = 0.5;
    for (let x = Math.ceil(x0 / 6) * 6; x < x1; x += 6) {
      const q = hash(Math.round(x / 6), seed);
      if (q % 3 === 0) {
        ctx.fillStyle = RUST;
        ctx.fillRect(x + (q % 4) * 0.3, y + h * 0.3, 1.2 + (q % 3) * 0.6, h * 0.4);
      } else if (q % 3 === 1 && q % 5 === 1) {
        ctx.fillStyle = "#4a8a78";
        ctx.fillRect(x, y + h * 0.5, 1.6, h * 0.35);
      }
    }
    ctx.globalAlpha = 1;
  }

  function flange(ctx, x, y, h) {
    ctx.fillStyle = "#26221e";
    ctx.fillRect(x - 0.45, y - 0.3, 0.9, h + 0.6);
    ctx.fillStyle = "#6a5a4a";
    ctx.fillRect(x - 0.35, y - 0.3, 0.3, h + 0.6);
    bolt(ctx, x, y - 0.1);
    bolt(ctx, x, y + h + 0.1);
  }

  // The stalled pump: a boiler on a plinth, a flywheel with its crank rod, a
  // gauge whose needle has dropped to nothing, an intake to the floor.
  function pump(ctx, p) {
    const x = p.x;
    const fy = p.fy;
    ctx.fillStyle = "#26221e";
    ctx.fillRect(x - 6.6, fy - 1.4, 13.2, 1.6);
    ctx.fillStyle = "#4a4640";
    ctx.fillRect(x - 6.6, fy - 1.4, 13.2, 0.3);
    // The boiler.
    ctx.fillStyle = vgrad(ctx, fy - 8, fy - 1.4, [[0, "#6a5a4a"], [0.35, "#8a7662"], [1, "#2e2822"]]);
    ctx.fillRect(x - 4.4, fy - 8, 5.6, 6.6);
    ctx.fillStyle = "#3a322a";
    for (const dy of [2.6, 5.2]) ctx.fillRect(x - 4.4, fy - 8 + dy, 5.6, 0.3);
    for (let k = 0; k < 4; k++) {
      bolt(ctx, x - 3.8, fy - 7 + k * 1.6);
      bolt(ctx, x + 0.6, fy - 7 + k * 1.6);
    }
    ctx.fillStyle = RUST;
    ctx.globalAlpha = 0.45;
    ctx.fillRect(x - 4.4, fy - 4.2, 2.1, 2.6);
    ctx.globalAlpha = 1;
    // Its stack and the gauge.
    ctx.fillStyle = "#3a322a";
    ctx.fillRect(x - 2.4, fy - 12.5, 1.6, 4.6);
    ctx.fillStyle = "#524840";
    ctx.fillRect(x - 2.8, fy - 12.9, 2.4, 0.6);
    ctx.fillStyle = "#c8c0a8";
    circle(ctx, x - 1.6, fy - 6.2, 1);
    ctx.fill();
    ctx.strokeStyle = "#26221e";
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.strokeStyle = "#a02820";
    ctx.lineWidth = 0.14;
    line(ctx, x - 1.6, fy - 6.2, x - 2.2, fy - 5.5);
    // The flywheel and its rod to the piston.
    const wx = x + 5.2;
    const wy = fy - 4.6;
    ctx.strokeStyle = "#2a2622";
    ctx.lineWidth = 0.7;
    circle(ctx, wx, wy, 3);
    ctx.stroke();
    ctx.strokeStyle = "#6a5a4a";
    ctx.lineWidth = 0.2;
    circle(ctx, wx, wy, 3.2);
    ctx.stroke();
    ctx.strokeStyle = "#3a322c";
    ctx.lineWidth = 0.4;
    for (let k = 0; k < 6; k++) line(ctx, wx, wy, wx + Math.cos((k / 6) * TAU + 0.3) * 2.9, wy + Math.sin((k / 6) * TAU + 0.3) * 2.9);
    ctx.fillStyle = "#4a423a";
    circle(ctx, wx, wy, 0.7);
    ctx.fill();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.35;
    line(ctx, wx + 1.7, wy - 1.9, wx - 0.4, fy - 9.6);
    ctx.fillStyle = "#4a423a";
    ctx.fillRect(wx - 1.4, fy - 11, 2.2, 1.8);
    // Pipes: up to the main run, and down into the floor.
    ctx.fillStyle = "#4a3e32";
    ctx.fillRect(wx - 0.1, 16.5, 1, fy - 11 - 16.5);
    ctx.fillStyle = "#8a7a66";
    ctx.globalAlpha = 0.35;
    ctx.fillRect(wx - 0.1, 16.5, 0.25, fy - 11 - 16.5);
    ctx.globalAlpha = 1;
    flange(ctx, wx + 0.4, 26, 1);
    ctx.fillStyle = "#4a3e32";
    ctx.fillRect(x - 7.6, fy - 0.6, 1.1, 0.8);
    ctx.fillRect(x - 7.6, fy - 3.4, 1.1, 2.8);
    ctx.fillRect(x - 7.6, fy - 3.4, 3.2, 0.9);
  }

  function wallTunnels(ctx, v, look, x0, x1, L, H) {
    rockWall(ctx, look, x0, x1, H, true);
    const wood = look.wainscot;
    const hi = look.shelfTop;
    // Water seeping down the rock.
    for (const s of L.seep) {
      if (s.x < x0 - 3 || s.x > x1 + 3) continue;
      ctx.fillStyle = "rgba(0, 20, 22, 0.28)";
      ctx.fillRect(s.x - 0.9, s.y0, 1.8, s.len);
      ctx.strokeStyle = "rgba(170, 230, 230, 0.35)";
      ctx.lineWidth = 0.13;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y0);
      for (let k = 1; k <= 6; k++) ctx.lineTo(s.x + Math.sin(k * 1.7 + s.n) * 0.35, s.y0 + (s.len * k) / 6);
      ctx.stroke();
    }
    // The low roof of wet rock.
    const lo = Math.floor(x0 / 3) * 3 - 3;
    ctx.fillStyle = shade(look.wallLow, -0.55);
    ctx.beginPath();
    ctx.moveTo(lo, 0);
    for (let x = lo; x <= x1 + 6; x += 3) ctx.lineTo(x, ceilY("tunnels", x));
    ctx.lineTo(x1 + 6, 0);
    ctx.fill();
    ctx.strokeStyle = "rgba(160, 225, 225, 0.4)";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    for (let x = lo; x <= x1 + 6; x += 3) {
      if (x === lo) ctx.moveTo(x, ceilY("tunnels", x));
      else ctx.lineTo(x, ceilY("tunnels", x));
    }
    ctx.stroke();
    for (const dr of L.drips) {
      if (dr.x < x0 - 2 || dr.x > x1 + 2) continue;
      ctx.fillStyle = shade(look.wallTop, -0.45);
      ctx.beginPath();
      ctx.moveTo(dr.x - 0.5, dr.y0 - 0.5);
      ctx.lineTo(dr.x, dr.y0 + 0.9);
      ctx.lineTo(dr.x + 0.5, dr.y0 - 0.5);
      ctx.fill();
    }
    // The stringer under the roof, posts with knee braces.
    beam(ctx, x0, 7.2, x1, 1.7, wood, hi);
    for (let x = Math.floor(x0 / 12) * 12; x < x1 + 12; x += 12) bolt(ctx, x + 3, 8);
    for (const f of L.frames) {
      if (f.x < x0 - 6 || f.x > x1 + 6) continue;
      brace(ctx, f.x, 14.5, f.x - 4.6, 8.9, 0.9, wood, hi);
      brace(ctx, f.x, 14.5, f.x + 4.6, 8.9, 0.9, wood, hi);
      post(ctx, f.x, 7.2, f.fy + 0.4, 2, wood, hi, f.h);
      bolt(ctx, f.x, 8);
      // Slime at the foot of the post.
      ctx.fillStyle = "rgba(60, 110, 80, 0.4)";
      ctx.fillRect(f.x - 1, f.fy - 3 - (f.h % 3), 2, 3 + (f.h % 3));
    }
    // The pipes: a main run, a thin one, flanges, a valve.
    pipe(ctx, x0, 16.5, x1, 1.5, 70);
    pipe(ctx, x0, 20.2, x1, 0.8, 71);
    for (let x = Math.floor(x0 / 14) * 14 + 5; x < x1 + 14; x += 14) {
      flange(ctx, x, 16.5, 1.5);
      if (hash(Math.round(x / 14), 72) % 3 === 0) {
        ctx.strokeStyle = "#8a2a20";
        ctx.lineWidth = 0.2;
        circle(ctx, x + 5.4, 14.5, 0.9);
        ctx.stroke();
        line(ctx, x + 5.4, 14.5, x + 5.4, 16.5);
        line(ctx, x + 4.7, 14.5, x + 6.1, 14.5);
      }
    }
    for (const f of L.frames) if (f.x > x0 - 3 && f.x < x1 + 3) {
      ctx.fillStyle = "#26221e";
      ctx.fillRect(f.x - 1.2, 16.2, 2.4, 0.4);
      ctx.fillRect(f.x - 1.2, 18.6, 2.4, 0.4);
    }
    for (const p of L.pumps) if (p.x > x0 - 14 && p.x < x1 + 14) pump(ctx, p);
    lampsIn(ctx, L, x0, x1);
    roofShade(ctx, x0, x1, H, 0.5);
  }

  /* --------------------------------------------------------- the collapse */

  // A buried mine cart: tipped, half under rubble, its ore spilled.
  function cart(ctx, c) {
    const x = c.x;
    const fy = c.fy;
    ctx.save();
    ctx.translate(x, fy - 1);
    ctx.rotate(-0.22);
    ctx.scale(1.3, 1.3);
    ctx.fillStyle = "#2a2a30";
    ctx.beginPath();
    ctx.moveTo(-4.4, -4.6);
    ctx.lineTo(4.6, -4.6);
    ctx.lineTo(3.6, 0.6);
    ctx.lineTo(-3.6, 0.6);
    ctx.fill();
    ctx.fillStyle = "#4a4a54";
    ctx.beginPath();
    ctx.moveTo(-4.4, -4.6);
    ctx.lineTo(4.6, -4.6);
    ctx.lineTo(4.3, -3.6);
    ctx.lineTo(-4.1, -3.6);
    ctx.fill();
    ctx.fillStyle = RUST;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-3.4, -3.2, 2.4, 2.6);
    ctx.fillRect(1.4, -2, 1.8, 2);
    ctx.globalAlpha = 1;
    for (let k = 0; k < 4; k++) {
      bolt(ctx, -3 + k * 2.1, -4);
      bolt(ctx, -2.7 + k * 1.9, -0.2);
    }
    ctx.fillStyle = "#1a1a1e";
    ctx.fillRect(-4.6, -5.1, 9.4, 0.55);
    // A wheel and a bent axle.
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.55;
    circle(ctx, -2.6, 1.2, 1.4);
    ctx.stroke();
    ctx.lineWidth = 0.2;
    for (let k = 0; k < 4; k++) line(ctx, -2.6, 1.2, -2.6 + Math.cos(k * 1.57 + 0.5) * 1.3, 1.2 + Math.sin(k * 1.57 + 0.5) * 1.3);
    ctx.restore();
    // The ore, spilled out on the floor.
    for (let k = 0; k < 7; k++) {
      const q = hash(k, Math.round(x));
      ctx.fillStyle = q % 3 === 0 ? "#8a6a3a" : "#34302c";
      lump(ctx, x + 4.4 + k * 0.85 + (q % 3) * 0.2, fy - 0.45 - (k % 2) * 0.4, 0.55 + (q % 3) * 0.12, 0.45, q);
      ctx.fill();
    }
    // The heap over its back end.
    for (let k = 0; k < 6; k++) boulder(ctx, x - 6.4 + k * 1.1, fy - 0.9 - Math.sin((k / 5) * Math.PI) * 1.8, 1.2 + (k % 3) * 0.3, 1 + (k % 2) * 0.4, k + Math.round(x), "#4a4640");
  }

  function wallCollapse(ctx, v, look, x0, x1, L, H) {
    rockWall(ctx, look, x0, x1, H, false);
    const wood = look.wainscot;
    const hi = look.shelfTop;
    // Great slabs of the roof, split.
    const lo = Math.floor(x0 / 3) * 3 - 3;
    ctx.fillStyle = shade(look.wallLow, -0.5);
    ctx.beginPath();
    ctx.moveTo(lo, 0);
    for (let x = lo; x <= x1 + 6; x += 3) ctx.lineTo(x, ceilY("collapse", x));
    ctx.lineTo(x1 + 6, 0);
    ctx.fill();
    ctx.strokeStyle = shade(look.paper, 0.25);
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    for (let x = lo; x <= x1 + 6; x += 3) {
      if (x === lo) ctx.moveTo(x, ceilY("collapse", x));
      else ctx.lineTo(x, ceilY("collapse", x));
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Cracks running down from the roof, and the chunks about to follow.
    for (const c of L.cracks) {
      if (c.x < x0 - 12 || c.x > x1 + 12) continue;
      ctx.strokeStyle = "#050403";
      ctx.lineWidth = 0.5;
      crack(ctx, c.x, c.y, c.x + ((c.n % 5) - 2) * 2.4, c.y + c.len, c.n + 100, 1, 2.2);
      ctx.strokeStyle = shade(look.paper, 0.3);
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 0.12;
      crack(ctx, c.x + 0.5, c.y, c.x + 0.5 + ((c.n % 5) - 2) * 2.4, c.y + c.len, c.n + 100, 1, 2.2);
      ctx.globalAlpha = 1;
      if (c.n % 3 === 0) {
        ctx.fillStyle = shade(look.wallLow, -0.3);
        lump(ctx, c.x + 0.6, c.y + 1.8, 2.3, 1.7, c.n);
        ctx.fill();
        ctx.strokeStyle = "#050403";
        ctx.lineWidth = 0.2;
        ctx.stroke();
      }
    }
    // Rubble heaps against the wall, a cart under one.
    for (const hp of L.heaps) {
      if (hp.x + hp.w < x0 - 2 || hp.x - hp.w > x1 + 2) continue;
      const n = 4 + hp.h;
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        const hh = Math.sin(f * Math.PI) * hp.h;
        boulder(ctx, hp.x - hp.w / 2 + f * hp.w, hp.fy - hh * 0.5, 1 + hp.h * 0.2 + (k % 3) * 0.3, 0.8 + hh * 0.5, hp.n * 7 + k, ["#4a4640", "#5a5248", "#3e3a36"][k % 3]);
      }
      // A plank sticking out of it.
      if (hp.n % 2) brace(ctx, hp.x - 1, hp.fy - hp.h, hp.x + 2.6, hp.fy - hp.h - 2.4, 0.7, wood, hi);
    }
    for (const c of L.carts) if (c.x > x0 - 10 && c.x < x1 + 10) cart(ctx, c);
    // Props: some standing, some leaning, some snapped.
    for (const f of L.frames) {
      if (f.x < x0 - 8 || f.x > x1 + 8) continue;
      frameT(ctx, look, f, 2.2 + (f.h % 3), 2.1, 9.5);
    }
    lampsIn(ctx, L, x0, x1);
    roofShade(ctx, x0, x1, H, 0.5);
  }

  /* ------------------------------------------------------------ the seam */

  function wallSeam(ctx, v, look, x0, x1, L, H) {
    rockWall(ctx, look, x0, x1, H, false);
    const wood = look.wainscot;
    const hi = look.shelfTop;
    // The ore: a broad vein across the back wall, copper dark and gold lit.
    const lo = Math.floor(x0 / 3) * 3 - 3;
    const top = (x) => veinY(x) - 3.4 - Math.sin(x * 0.21) * 1.2;
    const bot = (x) => veinY(x) + 3.6 + Math.sin(x * 0.17 + 2) * 1.4;
    ctx.fillStyle = vgrad(ctx, 0, H, [[0, "#4a2408"], [0.5, "#7a4414"], [1, "#4a2408"]]);
    ctx.beginPath();
    for (let x = lo; x <= x1 + 6; x += 3) {
      const y = top(x) + (hash(Math.round(x / 3), 50) % 5) * 0.2;
      if (x === lo) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    for (let x = x1 + 6; x >= lo; x -= 3) ctx.lineTo(x, bot(x) - (hash(Math.round(x / 3), 51) % 5) * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    ctx.lineWidth = 0.25;
    ctx.stroke();
    // Its crystals and nuggets, each with a lit face.
    for (let x = Math.floor(x0 / 2.4) * 2.4 - 2.4; x < x1 + 2.4; x += 2.4) {
      const n = Math.round(x / 2.4);
      const h = hash(n, 52);
      const y = veinY(x) + (unit(n, 53) - 0.5) * (bot(x) - top(x)) * 0.85;
      const s = 0.55 + (h % 5) * 0.2;
      ctx.fillStyle = h % 4 === 0 ? "#f0d070" : h % 4 === 1 ? "#c8801c" : h % 4 === 2 ? "#a05c18" : "#e0a040";
      ctx.beginPath();
      ctx.moveTo(x - s, y + s * 0.8);
      ctx.lineTo(x - s * 0.4, y - s);
      ctx.lineTo(x + s * 0.5, y - s * 0.7);
      ctx.lineTo(x + s, y + s * 0.8);
      ctx.fill();
      ctx.fillStyle = "#fff4c0";
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(x - s * 0.4, y - s);
      ctx.lineTo(x + s * 0.5, y - s * 0.7);
      ctx.lineTo(x - s * 0.1, y + s * 0.1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Thin veins running off it.
    ctx.strokeStyle = "rgba(240, 190, 80, 0.55)";
    ctx.lineWidth = 0.22;
    for (let x = Math.floor(x0 / 17) * 17 - 17; x < x1 + 17; x += 17) {
      const n = Math.round(x / 17);
      const up = n % 2 ? -1 : 1;
      crack(ctx, x, up > 0 ? bot(x) - 1 : top(x) + 1, x + ((n % 5) - 2) * 3, (up > 0 ? bot(x) : top(x)) + up * (8 + (n % 4) * 3), n + 200, 1, 2.4);
    }
    // Rock columns standing between the floor and the roof, far off.
    for (const c of L.cols) {
      if (c.x + c.w < x0 || c.x - c.w > x1) continue;
      ctx.fillStyle = "rgba(10, 6, 4, 0.55)";
      ctx.beginPath();
      ctx.moveTo(c.x - c.w * 0.9, H - 6);
      ctx.lineTo(c.x - c.w * 0.3, 14);
      ctx.lineTo(c.x - c.w * 0.4, 0);
      ctx.lineTo(c.x + c.w * 0.4, 0);
      ctx.lineTo(c.x + c.w * 0.3, 16);
      ctx.lineTo(c.x + c.w * 0.9, H - 6);
      ctx.fill();
    }
    // Stalactites from the dome.
    for (const s of L.stalac) {
      if (s.x < x0 - 3 || s.x > x1 + 3) continue;
      ctx.fillStyle = "#1e1208";
      ctx.beginPath();
      ctx.moveTo(s.x - s.w, 0);
      ctx.lineTo(s.x + 0.1, s.len);
      ctx.lineTo(s.x + s.w, 0);
      ctx.fill();
      ctx.fillStyle = shade(look.paper, 0.1);
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(s.x - s.w, 0);
      ctx.lineTo(s.x + 0.1, s.len);
      ctx.lineTo(s.x - s.w * 0.2, 0);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Great props and cap beams holding up the dome.
    for (const f of L.frames) {
      if (f.x < x0 - 10 || f.x > x1 + 10) continue;
      frameT(ctx, look, f, 3.4, 3, 15);
    }
    lampsIn(ctx, L, x0, x1);
    roofShade(ctx, x0, x1, H, 0.45);
  }

  /* ----------------------------------------------------------------- hooks */

  function backdrop(ctx, v, look, x0, x1) {
    const L = layoutOf(v);
    if (!L) return;
    const H = L.H;
    if (L.id === "shaft") wallShaft(ctx, v, look, x0, x1, L, H);
    else if (L.id === "tunnels") wallTunnels(ctx, v, look, x0, x1, L, H);
    else if (L.id === "collapse") wallCollapse(ctx, v, look, x0, x1, L, H);
    else wallSeam(ctx, v, look, x0, x1, L, H);
  }

  // What lies on a floor piece (a, b) whose top is `top` high: rock below the
  // surface, rails, and the room's own litter.
  function ground(ctx, v, look, a, b, top) {
    const L = layoutOf(v);
    if (!L) return;
    const H = L.H;
    const fy = H - top;
    const id = L.id;
    // Strata and stones inside the floor.
    ctx.strokeStyle = look.paper;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 0.12;
    for (let k = 0; k < Math.max(1, Math.floor((H - fy - 1.5) / 2.4)); k++) {
      const y = fy + 2.4 + k * 2.4;
      ctx.beginPath();
      for (let x = Math.floor(a / 5) * 5; x < b + 5; x += 5) {
        const yy = y + Math.sin(x * 0.2 + k * 2) * 0.35;
        if (x === Math.floor(a / 5) * 5) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#000000";
    for (let x = Math.ceil(a / 7) * 7; x < b - 1; x += 7) {
      const h = hash(Math.round(x), 80);
      if (h % 3) continue;
      lump(ctx, x + (h % 4), fy + 2 + (h % 3) * 1.2, 1 + (h % 3) * 0.5, 0.6, h);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Gravel on the surface.
    for (let x = Math.ceil(a / 1.7) * 1.7; x < b - 0.3; x += 1.7) {
      const h = hash(Math.round(x * 3), 81);
      ctx.fillStyle = h % 2 ? shade(look.floorTop, 0.2) : shade(look.floorTop, -0.35);
      ctx.globalAlpha = 0.6;
      ctx.fillRect(x + (h % 5) * 0.12, fy + (h % 3) * 0.35, 0.28 + (h % 3) * 0.1, 0.2);
    }
    ctx.globalAlpha = 1;
    // Rails and sleepers along a long piece.
    if (b - a >= 12) {
      const broken = id === "collapse";
      for (let x = Math.ceil(a / 3) * 3 + 1; x < b - 1.6; x += 3) {
        if (broken && hash(Math.round(x / 3), 82) % 4 === 0) continue;
        ctx.fillStyle = "#1c120a";
        ctx.fillRect(x, fy - 0.42, 1.7, 0.5);
        ctx.fillStyle = shade(look.wainscot, -0.1);
        ctx.fillRect(x, fy - 0.42, 1.7, 0.16);
      }
      ctx.fillStyle = "#26262c";
      ctx.fillRect(a, fy - 0.62, b - a, 0.2);
      ctx.fillStyle = IRON_HI;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(a, fy - 0.62, b - a, 0.07);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a1a1e";
      ctx.fillRect(a, fy - 0.02, b - a, 0.1);
      if (broken) {
        // A rail bent up out of the rubble.
        for (let x = Math.ceil(a / 40) * 40 + 9; x < b - 4; x += 40) {
          ctx.strokeStyle = IRON;
          ctx.lineWidth = 0.22;
          ctx.beginPath();
          ctx.moveTo(x, fy - 0.6);
          ctx.quadraticCurveTo(x + 1.6, fy - 0.8, x + 2.6, fy - 2.2);
          ctx.stroke();
        }
      }
    }
    if (id === "tunnels" && b - a >= 12) {
      // Puddles that hold the lamplight.
      for (let x = Math.ceil(a / 19) * 19 + 3; x < b - 5; x += 19) {
        const h = hash(Math.round(x), 83);
        if (h % 2) continue;
        ctx.fillStyle = "rgba(10, 36, 38, 0.8)";
        ellipse(ctx, x, fy + 0.35, 2.4 + (h % 3), 0.34);
        ctx.fill();
        ctx.fillStyle = "rgba(170, 230, 230, 0.5)";
        ctx.fillRect(x - 1.2, fy + 0.2, 1.6, 0.1);
      }
    }
    if (id === "seam") {
      // Ore dust and nuggets on the floor.
      for (let x = Math.ceil(a / 5) * 5; x < b - 1; x += 5) {
        const h = hash(Math.round(x), 84);
        if (h % 3) continue;
        ctx.fillStyle = h % 2 ? "#e0a040" : "#8a5a20";
        lump(ctx, x + (h % 3), fy + 0.1, 0.6, 0.4, h);
        ctx.fill();
      }
    }
    // A raised piece is a heap or a rock ledge: stones along its top.
    if (top > 7 && (id === "collapse" || b - a < 10)) {
      for (let x = a + 0.8; x < b - 0.6; x += 1.9) {
        const h = hash(Math.round(x * 2), 85);
        ctx.globalAlpha = 0.9;
        boulder(ctx, x, fy + 0.5, 0.9 + (h % 3) * 0.25, 0.6 + (h % 2) * 0.3, h, id === "collapse" ? "#4a4640" : shade(look.floorTop, -0.35));
      }
      ctx.globalAlpha = 1;
    }
    // Rail ends past the lip of a pit.
    if (b - a >= 12) {
      const gapAfter = v.groundAt(v.spec, b + 0.5) === -Infinity;
      const gapBefore = v.groundAt(v.spec, a - 0.5) === -Infinity;
      for (const [on, sx, dir] of [[gapAfter, b, 1], [gapBefore, a, -1]]) {
        if (!on) continue;
        ctx.strokeStyle = IRON;
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        ctx.moveTo(sx - dir * 0.2, fy - 0.55);
        ctx.quadraticCurveTo(sx + dir * 1.2, fy - 0.4, sx + dir * 1.8, fy + 1.4);
        ctx.stroke();
        ctx.fillStyle = shade(look.wainscot, -0.2);
        ctx.fillRect(sx - dir * 0.2 - (dir < 0 ? 1.7 : 0), fy - 0.42, 1.7, 0.5);
      }
    }
  }

  // A landing, scaffold or gallery of planks whose top is `y` (screen).
  function shelf(ctx, v, look, a, b, y) {
    const L = layoutOf(v);
    if (!L) return;
    const H = L.H;
    const id = L.id;
    const mid = v.groundAt(v.spec, (a + b) / 2);
    const fy = H - (mid > -Infinity ? mid : 6);
    const seed = Math.round(a * 3);
    let wood = look.shelf;
    let hi = look.shelfTop;
    if (id === "tunnels") {
      wood = shade(wood, -0.1);
      hi = shade(hi, -0.2);
    }
    const drop = fy - y;
    const post0 = a + 0.9;
    const post1 = b - 0.9;
    // Back railing first (a gallery's, a shaft landing's rope), behind the planks.
    if (id === "seam" && y < H - 14) {
      beam(ctx, a, y - 3.1, b, 0.45, wood, hi);
      for (let x = a + 0.4; x < b; x += 2.1) {
        ctx.fillStyle = shade(wood, -0.4);
        ctx.fillRect(x, y - 2.7, 0.3, 2.7);
      }
      for (const px of [a + 0.9, b - 0.9]) post(ctx, px, y - 5.4, y, 0.8, wood, hi, seed);
    } else if (id === "shaft" && b - a > 14 && seed % 2) {
      ctx.strokeStyle = "#8a7a56";
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(a + 0.5, y - 2.6);
      ctx.quadraticCurveTo((a + b) / 2, y - 1.8, b - 0.5, y - 2.6);
      ctx.stroke();
      for (const px of [a + 0.5, b - 0.5]) post(ctx, px, y - 2.8, y, 0.5, wood, hi, seed);
    }
    // Posts and cross braces down to the floor.
    if (drop > 2.6) {
      const levels = Math.max(1, Math.round(drop / 9));
      const lh = (drop - 1.7) / levels;
      for (let k = 0; k < levels; k++) {
        const ya = y + 1.7 + k * lh;
        if (b - a >= 7) {
          brace(ctx, post0, ya, post1, ya + lh, 0.55, wood, hi);
          if (id !== "collapse" || seed % 3 !== 0) brace(ctx, post1, ya, post0, ya + lh, 0.55, wood, hi);
        }
        if (k > 0) beam(ctx, post0, ya - 0.2, post1, 0.45, wood, hi);
      }
      const dead = id === "collapse" ? seed % 3 : -1;
      for (const [px, i] of [[post0, 0], [post1, 1]]) {
        if (dead === i + 1) {
          // A post snapped halfway: the landing hangs from the other.
          post(ctx, px, y + 1.7 + drop * 0.55, fy + 0.4, 0.95, wood, hi, seed + i);
          ctx.fillStyle = shade(wood, -0.2);
          ctx.beginPath();
          ctx.moveTo(px - 0.48, y + 1.7 + drop * 0.55);
          ctx.lineTo(px, y + 0.9 + drop * 0.55);
          ctx.lineTo(px + 0.48, y + 1.5 + drop * 0.55);
          ctx.fill();
        } else post(ctx, px, y + 1.7, fy + 0.4, 0.95, wood, hi, seed + i);
        if (id === "tunnels") {
          ctx.fillStyle = "rgba(60, 110, 80, 0.45)";
          ctx.fillRect(px - 0.5, fy - 2.4, 1, 2.8);
        }
      }
      if (b - a > 13) post(ctx, (a + b) / 2, y + 1.7, fy + 0.4, 0.95, wood, hi, seed + 2);
      if (id === "shaft" && seed % 3 === 0) ladder(ctx, b + 0.2, y, fy, wood, hi);
    }
    // The planks.
    ctx.fillStyle = shade(wood, -0.35);
    ctx.fillRect(a + 0.5, y + 0.95, b - a - 1, 0.75);
    ctx.fillStyle = wood;
    ctx.fillRect(a, y + 0.38, b - a, 0.62);
    ctx.fillStyle = hi;
    ctx.fillRect(a, y, b - a, 0.42);
    ctx.fillStyle = shade(hi, 0.25);
    ctx.globalAlpha = 0.45;
    ctx.fillRect(a, y, b - a, 0.1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = shade(wood, -0.6);
    for (let x = a + 1.3, k = 0; x < b - 0.6; x += 2.4 + (hash(seed, k) % 4) * 0.15, k++) {
      ctx.fillRect(x, y + 0.05, 0.1, 0.95);
      ctx.fillRect(x - 0.55, y + 0.14, 0.14, 0.14);
      ctx.fillRect(x + 0.45, y + 0.14, 0.14, 0.14);
    }
    ctx.fillRect(a, y + 0.4, 0.2, 1.3);
    ctx.fillRect(b - 0.2, y + 0.4, 0.2, 1.3);
    if (id === "collapse") {
      // A split plank, a spill of stones and dust on the boards.
      ctx.fillStyle = "#050403";
      ctx.fillRect(a + 2.6 + (seed % 5), y, 0.14, 0.8);
      ctx.fillStyle = shade(wood, -0.3);
      ctx.beginPath();
      ctx.moveTo(b - 1.4, y);
      ctx.lineTo(b - 0.2, y + 0.3);
      ctx.lineTo(b - 1.6, y + 1.1);
      ctx.fill();
      for (let k = 0; k < 4; k++) {
        ctx.fillStyle = k % 2 ? "#5a5248" : "#3e3a36";
        lump(ctx, a + 2 + ((seed + k * 5) % Math.max(2, Math.round(b - a - 4))), y - 0.1, 0.5, 0.36, seed + k);
        ctx.fill();
      }
    }
    if (id === "seam") {
      // Heavy cleats at the ends.
      ctx.fillStyle = shade(wood, -0.5);
      ctx.fillRect(a - 0.2, y + 0.4, 0.5, 1.9);
      ctx.fillRect(b - 0.3, y + 0.4, 0.5, 1.9);
    }
  }

  /* ------------------------------------------------------------ the cage */

  // A cage lift on its cable: a floor plate and skids, iron bars, a roof, four
  // chains to a ring, one cable up over the winch wheel on the headframe, and
  // the counterweight that rides the other way.
  function cage(ctx, v, m, x, y, t, flash) {
    const H = v.g.FIELD_H;
    const lo = m.lo ?? m.y;
    const lowY = H - lo;
    const board = y - 1.2;
    const roof = board - 5.9;
    const iron = flash ? FLASH : IRON;
    // The counterweight: a stack of iron plates on the cable that comes off the wheel's far side.
    const wx = x + 3.5;
    const wr = 3.4;
    const cwx = wx + wr;
    const cwBottom = 14 + (lowY - y);
    ctx.fillStyle = "#26262c";
    ctx.fillRect(cwx - 0.09, 1, 0.18, cwBottom - 4.6);
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = k % 2 ? "#44444c" : "#5a5a64";
      ctx.fillRect(cwx - 1.2, cwBottom - 4.4 + k * 1.1, 2.4, 1.02);
      ctx.fillStyle = IRON_HI;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(cwx - 1.2, cwBottom - 4.4 + k * 1.1, 2.4, 0.14);
      ctx.globalAlpha = 1;
    }
    // The winch wheel at the top of the shaft, turning as the cable pays out.
    const spin = -y / wr;
    ctx.strokeStyle = "#1c1c20";
    ctx.lineWidth = 0.9;
    circle(ctx, wx, 1, wr);
    ctx.stroke();
    ctx.strokeStyle = "#6a6a76";
    ctx.lineWidth = 0.22;
    circle(ctx, wx, 1, wr + 0.3);
    ctx.stroke();
    ctx.strokeStyle = "#3a3a42";
    ctx.lineWidth = 0.45;
    for (let k = 0; k < 8; k++) line(ctx, wx, 1, wx + Math.cos(spin + (k / 8) * TAU) * (wr - 0.3), 1 + Math.sin(spin + (k / 8) * TAU) * (wr - 0.3));
    ctx.fillStyle = "#4a4a54";
    circle(ctx, wx, 1, 0.8);
    ctx.fill();
    ctx.fillStyle = IRON_HI;
    circle(ctx, wx - 0.2, 0.8, 0.28);
    ctx.fill();
    // The cable down to the cage's ring, two chains to the roof.
    const ring = roof - 3.4;
    ctx.strokeStyle = "#1c1c20";
    ctx.lineWidth = 0.4;
    line(ctx, x, 1, x, ring);
    ctx.strokeStyle = "#7a7a86";
    ctx.lineWidth = 0.1;
    line(ctx, x - 0.08, 1, x - 0.08, ring);
    ctx.strokeStyle = "#2c2c32";
    ctx.lineWidth = 0.22;
    line(ctx, x, ring, x - 3.9, roof);
    line(ctx, x, ring, x + 3.9, roof);
    ctx.strokeStyle = iron;
    ctx.lineWidth = 0.3;
    circle(ctx, x, ring, 0.55);
    ctx.stroke();
    // The cage: roof, back bars, posts, rails, the floor plate and its skids.
    ctx.fillStyle = flash ? FLASH : "#2c2c32";
    ctx.beginPath();
    ctx.moveTo(x - 4.3, roof + 0.5);
    ctx.lineTo(x - 1.4, roof - 0.8);
    ctx.lineTo(x + 1.4, roof - 0.8);
    ctx.lineTo(x + 4.3, roof + 0.5);
    ctx.fill();
    ctx.fillStyle = flash ? FLASH : IRON;
    ctx.fillRect(x - 4.1, roof + 0.4, 8.2, 0.5);
    ctx.fillStyle = IRON_HI;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - 4.1, roof + 0.4, 8.2, 0.12);
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#16161a";
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x - 3.9, roof + 0.9, 7.8, board - roof - 0.9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = iron;
    for (let bx = -3.1; bx < 3.9; bx += 1.05) ctx.fillRect(x + bx, roof + 0.9, 0.16, board - roof - 0.9);
    ctx.fillRect(x - 3.95, roof + 0.9, 0.3, board - roof - 0.9);
    ctx.fillRect(x + 3.65, roof + 0.9, 0.3, board - roof - 0.9);
    ctx.fillRect(x - 3.9, board - 2.6, 7.8, 0.22);
    ctx.fillStyle = flash ? FLASH : "#5a5a64";
    ctx.fillRect(x - 4.3, board, 8.6, 0.55);
    ctx.fillStyle = "#8a8a94";
    ctx.fillRect(x - 4.3, board, 8.6, 0.16);
    ctx.fillStyle = flash ? FLASH : "#2e2e34";
    ctx.fillRect(x - 4.4, board + 0.55, 8.8, 0.65);
    for (let k = 0; k < 5; k++) bolt(ctx, x - 3.6 + k * 1.8, board + 0.85);
    // Guide shoes hugging the rails.
    ctx.fillStyle = "#26262c";
    for (const s of [-1, 1]) ctx.fillRect(x + s * 3.7 - 0.55, board - 0.3, 1.1, 1.6);
    // The signal lamp on the roof: green at rest, amber under way.
    const col = m.rest > 0 ? "#6ae860" : "#ffb040";
    ctx.fillStyle = "#26262c";
    ctx.fillRect(x - 0.4, roof - 1.2, 0.8, 0.5);
    ctx.fillStyle = col;
    circle(ctx, x, roof - 1.5, 0.38);
    ctx.fill();
    v.eyes.push(x, roof - 1.5, 0.3, col);
  }

  /* ---------------------------------------------------------------- rocks */

  // A crack in the roof (y0 is where the rock begins) with a pale rim so it
  // shows against the dark.
  function roofCrack(ctx, x, y0, alpha) {
    ctx.globalAlpha = alpha;
    for (const [w, color] of [[0.9, "#b8a890"], [0.5, "#050403"]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x - 1.8, y0 - 0.5);
      ctx.lineTo(x - 0.6, y0 + 1.2);
      ctx.lineTo(x + 0.6, y0 + 0.7);
      ctx.lineTo(x + 0.2, y0 + 2.4);
      ctx.lineTo(x + 1.6, y0 + 3.4);
      ctx.stroke();
    }
    ctx.lineJoin = "miter";
    ctx.globalAlpha = 1;
  }

  function stoneAt(ctx, x, y, w, h, spin, seed) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.fillStyle = "#6a5e50";
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.15);
    ctx.lineTo(-w * 0.34, -h * 0.5);
    ctx.lineTo(w * 0.1, -h * 0.55);
    ctx.lineTo(w * 0.5, -h * 0.1);
    ctx.lineTo(w * 0.36, h * 0.5);
    ctx.lineTo(-w * 0.2, h * 0.52);
    ctx.fill();
    ctx.fillStyle = "#b0a490";
    ctx.beginPath();
    ctx.moveTo(-w * 0.34, -h * 0.5);
    ctx.lineTo(w * 0.1, -h * 0.55);
    ctx.lineTo(w * 0.5, -h * 0.1);
    ctx.lineTo(w * 0.05, -h * 0.05);
    ctx.fill();
    ctx.fillStyle = "#3a3228";
    ctx.beginPath();
    ctx.moveTo(w * 0.5, -h * 0.1);
    ctx.lineTo(w * 0.36, h * 0.5);
    ctx.lineTo(-w * 0.2, h * 0.52);
    ctx.lineTo(w * 0.1, h * 0.05);
    ctx.fill();
    ctx.strokeStyle = "#16120e";
    ctx.lineWidth = 0.14;
    line(ctx, -w * 0.2, -h * 0.1, w * 0.1, h * 0.3);
    ctx.restore();
  }

  // A rock: dust trickling from a crack in the roof and a shadow growing on
  // the floor while it waits, a jagged stone and its trail as it falls, a heap
  // once it has.
  function rock(ctx, v, h) {
    const H = v.g.FIELD_H;
    const t = v.clock || 0;
    const fy = H - h.floor;
    const L = layoutOf(v);
    const y0 = L ? ceilY(L.id, h.x) : 0;
    if (h.state === "warn") {
      const prog = clamp(1 - h.warn / h.total, 0, 1);
      roofCrack(ctx, h.x, y0, 1);
      // A curtain of dust from the crack to the floor, thickening as the rock lets go.
      const cy = y0 + 2.4;
      ctx.beginPath();
      ctx.moveTo(h.x - 0.6, cy);
      ctx.lineTo(h.x + 0.6, cy);
      ctx.lineTo(h.x + h.w * 0.5, fy);
      ctx.lineTo(h.x - h.w * 0.5, fy);
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, cy, fy, [[0, rgba("#c8b898", 0.55 * (0.4 + 0.6 * prog))], [1, rgba("#a89878", 0.08 + 0.12 * prog)]]);
      ctx.fill();
      // Grit pouring down it, bigger and thicker as it goes.
      for (let k = 0; k < 20; k++) {
        const f = (t / 480 + k / 20) % 1;
        const spread = (0.6 + f * h.w * 0.45) * (((k * 7) % 5) / 2.5 - 1);
        ctx.globalAlpha = (0.95 - f * 0.45) * (0.55 + 0.45 * prog);
        ctx.fillStyle = k % 3 ? "#c8b898" : "#8a7a68";
        const sz = 0.3 + (k % 3) * 0.14 + f * 0.1;
        ctx.fillRect(h.x + spread, cy + f * (fy - cy - 0.6), sz, sz);
      }
      ctx.globalAlpha = 0.25 + 0.3 * prog;
      ctx.fillStyle = "#b8a890";
      ellipse(ctx, h.x, y0 + 3.2, 1.6 + prog * 1.4, 0.9 + prog * 0.6);
      ctx.fill();
      ctx.globalAlpha = 0.25 + 0.5 * prog;
      ctx.fillStyle = "#000000";
      ellipse(ctx, h.x, fy - 0.15, (h.w / 2) * (0.4 + 0.6 * prog), 0.35 + 0.35 * prog);
      ctx.fill();
      // Pebbles bouncing in the shadow.
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = "#8a7e6e";
      for (let k = 0; k < 4; k++) {
        const q = (t / 260 + k * 0.29) % 1;
        ctx.fillRect(h.x - 1.4 + k * 0.95, fy - 0.35 - Math.sin(q * Math.PI) * 0.9 * (0.4 + prog), 0.34, 0.34);
      }
      ctx.globalAlpha = 1;
      return;
    }
    const top = H - h.y - h.h;
    if (h.state === "fall") {
      roofCrack(ctx, h.x, y0, 0.6);
      // The trail: streaks of dust above the stone.
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = DUST;
      for (let k = -1; k <= 1; k++) ctx.fillRect(h.x + k * 0.9 - 0.08, Math.max(0, top - 9), 0.16 + (k === 0 ? 0.2 : 0), top - Math.max(0, top - 9) + 1);
      ctx.globalAlpha = 1;
      stoneAt(ctx, h.x, top + h.h / 2, h.w, h.h, top * 0.14, 3);
      // The shadow it is racing to.
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#000000";
      ellipse(ctx, h.x, fy - 0.15, h.w / 2, 0.55);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    // Rubble: a heap of stones, with a puff of dust settling and then fading away.
    const age = clamp(1 - h.rub / RUBBLE_MS, 0, 1);
    ctx.globalAlpha = clamp(h.rub / 600, 0, 1);
    for (const [dx, s, c] of [[-1.5, 0.95, "#4a4238"], [1.5, 0.85, "#554a40"], [0.1, 1.25, "#5e5246"], [-0.5, 0.7, "#3e362e"], [0.9, 0.6, "#6a5e50"]]) {
      boulder(ctx, h.x + dx, fy - s * 0.75, s * 1.1, s * 0.85, Math.round(h.x * 3) + Math.round(dx * 10), c);
    }
    if (age < 0.28) {
      const p = age / 0.28;
      ctx.globalAlpha = (1 - p) * 0.5 * clamp(h.rub / 600, 0, 1);
      ctx.fillStyle = DUST;
      ellipse(ctx, h.x, fy - 1.4 - p * 1.6, 2.2 + p * 2.4, 1.1 + p * 1.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- front */

  // The bars across the front of each cage (over Planny, so he stands inside),
  // and the water over everyone's legs.
  function front(ctx, v) {
    const spec = v.spec;
    const L = layoutOf(v);
    if (!L) return;
    const H = L.H;
    const cam = v.round.camX;
    if (L.id === "shaft") {
      for (const m of v.round.monsters) {
        if (m.kind !== "cage" || m.x < cam - 8 || m.x > cam + v.g.FIELD_W + 8) continue;
        const board = H - m.y - 1.2;
        const roof = board - 5.9;
        ctx.fillStyle = IRON;
        ctx.globalAlpha = 0.7;
        for (let bx = -3.5; bx < 3.9; bx += 1.05) ctx.fillRect(m.x + bx, roof + 0.9, 0.14, board - roof - 0.9);
        ctx.fillRect(m.x - 4, board - 2.6, 8, 0.2);
        ctx.fillRect(m.x - 4.05, roof + 0.4, 8.1, 0.45);
        ctx.fillStyle = IRON_HI;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(m.x - 4.05, roof + 0.4, 8.1, 0.1);
        ctx.globalAlpha = 1;
      }
      return;
    }
    const water = spec.water;
    if (!water || !water.length) return;
    const t = v.clock || 0;
    const lo = cam - 2;
    const hi = cam + v.g.FIELD_W + 2;
    for (const [x0, x1] of water) {
      if (x1 < lo || x0 > hi) continue;
      const a = Math.max(x0, lo);
      const b = Math.min(x1, hi);
      const fy = H - v.groundAt(spec, (a + b) / 2);
      const surf = fy - WATER_DEEP;
      const wave = (x) => surf + Math.sin(x * 0.9 + t / 520) * 0.1 + Math.sin(x * 0.37 - t / 770) * 0.09;
      // The edge: the water thins out to nothing over the last few units.
      const edge = (x) => clamp((x - x0) / 3, 0, 1) * clamp((x1 - x) / 3, 0, 1);
      const lvl = (x) => fy - (fy - wave(x)) * edge(x);
      ctx.beginPath();
      ctx.moveTo(a, fy);
      for (let x = a; x <= b + 0.01; x += 1.5) ctx.lineTo(x, lvl(x));
      ctx.lineTo(b, lvl(b));
      ctx.lineTo(b, fy);
      ctx.closePath();
      ctx.fillStyle = vgrad(ctx, surf, fy, [[0, "rgba(14, 52, 50, 0.72)"], [0.45, "rgba(6, 28, 28, 0.88)"], [1, "rgba(2, 12, 12, 0.95)"]]);
      ctx.fill();
      // The lit surface line and a second, fainter, under it.
      ctx.strokeStyle = "rgba(190, 240, 230, 0.8)";
      ctx.lineWidth = 0.17;
      ctx.beginPath();
      for (let x = a; x <= b + 0.01; x += 1.5) {
        if (x === a) ctx.moveTo(x, lvl(x));
        else ctx.lineTo(x, lvl(x));
      }
      ctx.stroke();
      ctx.strokeStyle = "rgba(120, 200, 190, 0.28)";
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      for (let x = a; x <= b + 0.01; x += 1.5) {
        const y = lvl(x) + 0.45 + Math.sin(x * 0.6 - t / 600) * 0.07;
        if (x === a) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // Glints sliding across it.
      for (let x = Math.ceil(a / 3.4) * 3.4; x < b - 1; x += 3.4) {
        const q = hash(Math.round(x), 90);
        const wob = Math.sin(t / 450 + q) * 0.5;
        ctx.globalAlpha = (0.2 + 0.25 * Math.sin(t / 380 + q * 2)) * edge(x);
        ctx.fillStyle = "#c8f0e8";
        ctx.fillRect(x + wob, lvl(x) + 0.25 + (q % 3) * 0.28, 0.9 + (q % 3) * 0.3, 0.1);
      }
      ctx.globalAlpha = 1;
    }
    // Planny's wake: rings spreading from his legs and a V of ripples behind.
    const you = v.round.you;
    if (you.wet) {
      const fy = H - v.groundAt(spec, you.x);
      const surf = fy - WATER_DEEP;
      const moving = Math.abs(you.vx || 0) > 1;
      for (let k = 0; k < 3; k++) {
        const p = ((t / 640 + k / 3) % 1);
        ctx.strokeStyle = `rgba(200, 245, 235, ${(1 - p) * (moving ? 0.7 : 0.4)})`;
        ctx.lineWidth = 0.13;
        ellipse(ctx, you.x - you.face * p * (moving ? 3 : 0.6), surf + 0.1, 0.9 + p * 3.3, 0.14 + p * 0.32);
        ctx.stroke();
      }
      if (moving) {
        ctx.strokeStyle = "rgba(210, 248, 240, 0.65)";
        ctx.lineWidth = 0.14;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(you.x - you.face * 1.2, surf + 0.05);
          ctx.lineTo(you.x - you.face * 4.4, surf + 0.05 + s * 0.45);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(220, 250, 245, 0.8)";
        for (let k = 0; k < 4; k++) ctx.fillRect(you.x - you.face * (1.4 + k * 0.7), surf - 0.25 - Math.abs(Math.sin(t / 110 + k * 2)) * 0.55, 0.2, 0.2);
      }
    }
  }

  /* --------------------------------------------------------------- moving */

  // A teardrop of flame at (x, y), `s` big.
  function flame(ctx, x, y, s, sway) {
    ctx.fillStyle = "#ff7a22";
    ctx.beginPath();
    ctx.moveTo(x, y + 0.55);
    ctx.quadraticCurveTo(x - 0.5 * s, y, x + sway, y - 1.0 * s);
    ctx.quadraticCurveTo(x + 0.5 * s, y, x, y + 0.55);
    ctx.fill();
    ctx.fillStyle = "#ffe08a";
    ctx.beginPath();
    ctx.moveTo(x, y + 0.45);
    ctx.quadraticCurveTo(x - 0.25 * s, y + 0.1, x + sway * 0.6, y - 0.5 * s);
    ctx.quadraticCurveTo(x + 0.25 * s, y + 0.1, x, y + 0.45);
    ctx.fill();
  }

  // What moves in the scenery, over the still layers: flames, drips and grit,
  // drifting dust, the ore's glints.
  function moving(ctx, v, cam) {
    const L = layoutOf(v);
    if (!L) return;
    const t = v.clock || 0;
    const H = L.H;
    const W = v.g.FIELD_W;
    const lo = cam - 14;
    const hi = cam + W + 14;
    const out = Boolean(v.round && v.round.blackout);
    for (const lamp of L.lamps) {
      if (lamp.x < lo || lamp.x > hi) continue;
      if (out) {
        // The glass gone dark, a thread of smoke.
        ctx.fillStyle = "#1a120c";
        ctx.fillRect(lamp.x - 0.55, lamp.y - 0.9, 1.1, 1.5);
        ctx.strokeStyle = "rgba(120, 110, 100, 0.35)";
        ctx.lineWidth = 0.12;
        ctx.beginPath();
        ctx.moveTo(lamp.x, lamp.y - 1.3);
        for (let k = 1; k <= 4; k++) ctx.lineTo(lamp.x + Math.sin(t / 400 + k + lamp.n) * 0.3 * k, lamp.y - 1.3 - k * 0.8);
        ctx.stroke();
        continue;
      }
      const fl = 0.86 + 0.14 * Math.sin(t / (90 + lamp.n * 7) + lamp.n) + 0.05 * Math.sin(t / 37 + lamp.n * 3);
      const glow = typeof ctx.createRadialGradient === "function" ? ctx.createRadialGradient(lamp.x, lamp.y, 0, lamp.x, lamp.y, 10) : null;
      if (glow && typeof glow.addColorStop === "function") {
        glow.addColorStop(0, `rgba(255, 176, 70, ${0.34 * fl})`);
        glow.addColorStop(1, "rgba(255, 150, 40, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(lamp.x - 10, lamp.y - 10, 20, 20);
      }
      flame(ctx, lamp.x, lamp.y + 0.1, 0.8 + fl * 0.4, Math.sin(t / 130 + lamp.n * 2) * 0.12);
    }
    for (const dr of L.drips) {
      if (dr.x < lo || dr.x > hi) continue;
      const T = (t + dr.off) % dr.per;
      const fall = dr.grit ? 700 : 520;
      if (T < fall) {
        const p = T / fall;
        const y = dr.y0 + p * p * (dr.fy - dr.y0 - 0.2);
        if (dr.grit) {
          ctx.fillStyle = "#8a7e6e";
          ctx.fillRect(dr.x - 0.15, y, 0.28, 0.28);
          ctx.globalAlpha = 0.4;
          ctx.fillRect(dr.x + 0.5, y - 1.2 * p, 0.2, 0.2);
          ctx.globalAlpha = 1;
        } else {
          ctx.fillStyle = "rgba(190, 235, 240, 0.9)";
          ellipse(ctx, dr.x, y, 0.13, 0.25);
          ctx.fill();
        }
      } else if (T < fall + 360) {
        const p = (T - fall) / 360;
        if (dr.grit) {
          ctx.globalAlpha = (1 - p) * 0.5;
          ctx.fillStyle = DUST;
          ellipse(ctx, dr.x, dr.fy - 0.2, 0.6 + p * 1.3, 0.25 + p * 0.3);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          ctx.strokeStyle = `rgba(190, 235, 240, ${(1 - p) * 0.75})`;
          ctx.lineWidth = 0.12;
          ellipse(ctx, dr.x, dr.fy, 0.3 + p * 1.5, 0.08 + p * 0.22);
          ctx.stroke();
        }
      } else if (!dr.grit && T > dr.per - 600) {
        // The bead swelling at the tip before it lets go.
        const q = (T - (dr.per - 600)) / 600;
        ctx.fillStyle = "rgba(190, 235, 240, 0.85)";
        ellipse(ctx, dr.x, dr.y0 + 0.2 + q * 0.2, 0.06 + q * 0.1, 0.1 + q * 0.2);
        ctx.fill();
      }
    }
    // Dust drifting in the air.
    const span = W + 28;
    ctx.fillStyle = L.id === "seam" ? "#f0c070" : "#c8bca8";
    for (let k = 0; k < L.motes; k++) {
      const x = lo + ((unit(k, 11) * span + (t / 1000) * (1.2 + (k % 3) * 0.7)) % span);
      const y = 6 + unit(k, 12) * (H - 16) + Math.sin(t / 900 + k * 1.7) * 1.3;
      ctx.globalAlpha = 0.22 + 0.2 * Math.sin(t / 700 + k * 2.3);
      ctx.fillRect(x, y, 0.22, 0.22);
    }
    ctx.globalAlpha = 1;
    // The ore winking.
    if (L.id === "seam") {
      ctx.strokeStyle = "#fff0b0";
      ctx.lineWidth = 0.12;
      for (const g of L.glints) {
        if (g.x < lo || g.x > hi) continue;
        const p = ((t + g.off) % g.per) / g.per;
        if (p > 0.16) continue;
        const s = Math.sin((p / 0.16) * Math.PI) * g.s;
        ctx.globalAlpha = s;
        line(ctx, g.x - 0.9 * s, g.y, g.x + 0.9 * s, g.y);
        line(ctx, g.x, g.y - 0.9 * s, g.x, g.y + 0.9 * s);
      }
      ctx.globalAlpha = 1;
    }
  }

  // The lamps' holes in the dark (none while the lamps are out).
  function lights(v, add) {
    const L = layoutOf(v);
    if (!L || (v.round && v.round.blackout)) return;
    const lo = v.round.camX - 14;
    const hi = v.round.camX + v.g.FIELD_W + 14;
    for (const lamp of L.lamps) if (lamp.x > lo && lamp.x < hi) add(lamp.x, L.H - lamp.y, 16, 0.72 * (0.93 + 0.07 * Math.sin(v.clock / 110 + lamp.n * 3)));
  }

  return freeze({ backdrop, ground, shelf, moving, front, lights, cage, rock });
}
