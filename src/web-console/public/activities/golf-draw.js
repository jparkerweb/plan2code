// Plan2Code Web Console - mini golf's drawing: the course, the ball, the aim and the scorecard, from a view golf.js builds.
//
// Drawing only: no rules and no state of its own. golf.js hands drawCourse()
// a plain view of the moment (the hole, the ball, the aim, the card) and the
// colors readColors() took from the page, so the rules never touch a canvas
// and this file never decides anything. Everything is drawn in course units;
// golf.js scales the context to the board. Decoration that moves (ripples,
// the flag, the sharks and bats in golf-decor.js) follows the round's clock,
// never Math.random(), so a paused game's frame stays still.
//
// The course itself is painted in its theme's own fixed colors (a pirate sea,
// a dark cave), the same in light and dark; the scorecard, the pills and the
// words on them follow the page through readColors().

import { circle, decorLights, drawBumperLook, drawDecor, drawMoverLook, drawPowerIcon, drawSpinnerLook, ellipse, polygon, radial } from "./golf-decor.js";

const FALLBACK_COLORS = Object.freeze({
  shadow: "rgba(0, 0, 0, 0.22)",
  ball: "#fbfaf7",
  aim: "#fbfaf7",
  pole: "#f4f1ea",
  power: "#206cc3",
  card: "#ffffff",
  ink: "#1d1a17",
  ink2: "#5d564d",
  under: "#2f6b45",
  over: "#9c3327",
  burst: "#e0ab4c",
  font: "sans-serif",
});

// Each theme's course colors. `dark` is how deep a cave's darkness gets away
// from the ball's light; 0 is none.
const THEMES = Object.freeze({
  pirate: Object.freeze({
    theme: "pirate",
    rough: "#1b6d99",
    roughMark: "#2f8cbd",
    foam: "rgba(225, 247, 252, 0.55)",
    shore: "#ead39a",
    turf: "#55b25f",
    stripe: "#4ba455",
    deck: "#b07a43",
    deckLine: "#7d5228",
    moss: "#55b25f",
    stone: "#a39b8a",
    stoneLine: "#857d6d",
    sand: "#f3dea0",
    speckle: "#cfae62",
    wall: "#7a4a22",
    wallTop: "#c58f52",
    slope: "#63bd6c",
    arrow: "rgba(255, 255, 255, 0.6)",
    bridge: "#a9773f",
    plank: "#6f4720",
    spinner: "#6b3f1d",
    hub: "#e0b030",
    portalA: "#efe6d0",
    portalB: "#d9c9a3",
    cup: "#111111",
    flag: "#141414",
    flagMark: "#f4f1ea",
    pad: "#ffe27a",
    spy: "#ffe27a",
    dark: 0,
  }),
  cave: Object.freeze({
    theme: "cave",
    rough: "#16121e",
    roughMark: "#262033",
    foam: "rgba(0, 0, 0, 0)",
    shore: "#3b3448",
    turf: "#2d5a51",
    stripe: "#285147",
    deck: "#4b4659",
    deckLine: "#3a3646",
    moss: "#2d5a51",
    stone: "#4c4759",
    stoneLine: "#3a3646",
    sand: "#5d4630",
    speckle: "#7d6248",
    wall: "#6d6779",
    wallTop: "#aaa3b9",
    slope: "#2f6a5f",
    arrow: "rgba(150, 255, 230, 0.6)",
    bridge: "#6a6375",
    plank: "#463f50",
    spinner: "#5b5566",
    hub: "#c9a23a",
    portalA: "#49e3ff",
    portalB: "#ff5bd6",
    cup: "#050507",
    flag: "#49e3ff",
    flagMark: "#e9fbff",
    pad: "#7dfff0",
    spy: "#7dfff0",
    dark: 0.74,
  }),
});

// What each kind of water looks like; the rule for all of them is the same.
const LIQUIDS = Object.freeze({
  sea: Object.freeze({ fill: "#1f80b6", ripple: "#a6def2", glow: null }),
  pool: Object.freeze({ fill: "#11898c", ripple: "#7ff5e6", glow: "rgba(80, 255, 230, 0.3)" }),
  lava: Object.freeze({ fill: "#df4f18", ripple: "#ffc449", glow: "rgba(255, 120, 30, 0.45)" }),
  chasm: Object.freeze({ fill: "#030206", ripple: "#2e2246", glow: null }),
});

// The --golf-* custom properties styles/activities.css builds from the page's
// tokens, read again at each round and each resize, so the pills and card
// follow a theme change made while the game sat paused. A stub canvas in Node
// has no computed style, so every color falls back to its plain value.
export function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  const colors = {};
  for (const [key, fallback] of Object.entries(FALLBACK_COLORS)) {
    if (key === "font") continue;
    colors[key] = pick(`--golf-${key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`, fallback);
  }
  colors.font = (style && style.fontFamily) || FALLBACK_COLORS.font;
  return colors;
}

// The palette for a hole: its theme's colors with the page's shadow.
const palettes = new WeakMap();
function paletteFor(v) {
  let byTheme = palettes.get(v.colors);
  if (!byTheme) {
    byTheme = {};
    palettes.set(v.colors, byTheme);
  }
  return (byTheme[v.hole.theme] ||= { ...(THEMES[v.hole.theme] || THEMES.pirate), shadow: v.colors.shadow });
}

/* --------------------------------------------------------------- helpers */

// A fixed scatter of points in a box: the same every frame, with no random.
function* scatter(box, step, seed) {
  let n = seed;
  for (let y = box.y + step / 2; y < box.y + box.h; y += step) {
    for (let x = box.x + step / 2; x < box.x + box.w; x += step) {
      n = (n * 9301 + 49297) % 233280;
      const jx = (n / 233280 - 0.5) * step;
      n = (n * 9301 + 49297) % 233280;
      const jy = (n / 233280 - 0.5) * step;
      yield { x: x + jx, y: y + jy };
    }
  }
}

const bounds = (points) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};

function text(ctx, colors, str, x, y, { size = 10, weight = 600, align = "left", color = colors.ink, outline = null } = {}) {
  ctx.font = `${weight} ${size}px ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = size / 4;
    ctx.lineJoin = "round";
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// How wide `str` is at `size`; a stub context measures nothing, so a guess
// from its length stands in.
function measure(ctx, colors, str, size, weight = 600) {
  ctx.font = `${weight} ${size}px ${colors.font}`;
  const m = typeof ctx.measureText === "function" ? ctx.measureText(str) : null;
  return m && m.width > 0 ? m.width : str.length * size * 0.55;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const signed = (n) => (n > 0 ? `+${n}` : n < 0 ? `${n}` : "E");

// What a hole's strokes were against its par, in golf's words.
export function holeWord(strokes, par, pickedUp) {
  if (pickedUp) return "Picked up";
  if (strokes === 1) return "Hole in one!";
  const d = strokes - par;
  if (d <= -2) return "Eagle";
  return { "-1": "Birdie", 0: "Par", 1: "Bogey", 2: "Double bogey" }[d] || `${d} over par`;
}

// A silly line to go with the hole's word, in the hole's own voice.
export function holeQuip(strokes, par, pickedUp, theme) {
  const cave = theme === "cave";
  if (pickedUp) return cave ? "The cave keeps that one. Forever." : "Fed to the fishes. Next!";
  if (strokes === 1) return cave ? "The bats are applauding. Eerily." : "The whole crew does a jig!";
  const d = strokes - par;
  if (d <= -2) return cave ? "Legendary! The dragon stirs..." : "Captain material, that is!";
  if (d === -1) return cave ? "A birdie! Well, a bat. Close enough." : "The parrot approves. SQUAWK!";
  if (d === 0) return cave ? "Steady as stone." : "Shipshape and proper.";
  if (d === 1) return cave ? "The skeletons chuckle softly." : "Arr, nearly had it.";
  return cave ? "Did something in the dark just laugh?" : "Swab the deck and try again.";
}

/* ---------------------------------------------------------------- course */

// What never moves on a hole: the sea or the rock round it, the green, and
// the sand. Most of a frame's calls are their speckles, so stillLayer() draws
// them once.
function drawStill(ctx, v) {
  const { hole, course } = v;
  const p = paletteFor(v);
  ctx.fillStyle = p.rough;
  ctx.fillRect(0, 0, course.w, course.h);
  if (p.theme === "pirate") {
    // Little wave marks across the sea.
    ctx.strokeStyle = p.roughMark;
    ctx.lineWidth = 1;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 22, 11)) {
      ctx.beginPath();
      ctx.arc(q.x, q.y, 3, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = p.roughMark;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 7, 5)) ctx.fillRect(q.x, q.y, 1.5, 1.5);
  }

  // The rim: surf and a beach round a pirate green, bare rock round a cave's.
  ctx.lineJoin = "round";
  polygon(ctx, hole.outline);
  ctx.strokeStyle = p.foam;
  ctx.lineWidth = 18;
  ctx.stroke();
  ctx.strokeStyle = p.shore;
  ctx.lineWidth = 11;
  ctx.stroke();

  ctx.save();
  polygon(ctx, hole.outline);
  ctx.clip();
  drawGroundCover(ctx, p, hole.ground, course);
  for (const s of hole.sand) drawSand(ctx, p, s);
  ctx.restore();
}

function drawGroundCover(ctx, p, ground, course) {
  if (ground === "deck") {
    ctx.fillStyle = p.deck;
    ctx.fillRect(0, 0, course.w, course.h);
    for (let y = 0, row = 0; y < course.h; y += 12, row++) {
      ctx.fillStyle = p.deckLine;
      ctx.fillRect(0, y, course.w, 1);
      for (let x = (row % 2) * 30; x < course.w; x += 60) {
        ctx.fillRect(x, y, 1, 12);
        ctx.fillRect(x + 4, y + 5, 1.2, 1.2);
      }
    }
    return;
  }
  if (ground === "stone") {
    ctx.fillStyle = p.stone;
    ctx.fillRect(0, 0, course.w, course.h);
    ctx.fillStyle = p.stoneLine;
    for (let y = 0, row = 0; y < course.h; y += 20, row++) {
      ctx.fillRect(0, y, course.w, 1.2);
      for (let x = (row % 2) * 17; x < course.w; x += 34) ctx.fillRect(x, y, 1.2, 20);
    }
    return;
  }
  // Grass and moss: mown stripes, moss with soft clumps.
  ctx.fillStyle = p.turf;
  ctx.fillRect(0, 0, course.w, course.h);
  ctx.fillStyle = p.stripe;
  for (let x = 0; x < course.w; x += 40) ctx.fillRect(x, 0, 20, course.h);
  if (ground === "moss") {
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 16, 3)) {
      circle(ctx, q.x, q.y, 2.5);
      ctx.fill();
    }
  }
}

// The still layer, drawn off screen once per hole, board size and set of
// colors (golf.js reads a fresh set on each round and resize, so a theme
// change redraws it). Null where there is no OffscreenCanvas, as in Node:
// the frame then draws the still layer itself.
let still = null;

function stillLayer(ctx, v) {
  const target = ctx.canvas;
  if (typeof OffscreenCanvas !== "function" || !target || typeof ctx.getTransform !== "function") return null;
  const transform = ctx.getTransform();
  const key = `${v.holeNo}:${target.width}x${target.height}:${transform.a}`;
  if (still && still.key === key && still.colors === v.colors) return still.layer;
  try {
    const layer = new OffscreenCanvas(target.width, target.height);
    const off = layer.getContext("2d");
    if (!off) return null;
    off.setTransform(transform);
    drawStill(off, v);
    still = { key, colors: v.colors, layer };
    return layer;
  } catch {
    return null;
  }
}

// What moves on the ground, over the still layer: the slopes' arrows and the
// water's ripples, and the bridges laid over the water.
function drawGround(ctx, v, p) {
  const { hole } = v;
  ctx.save();
  polygon(ctx, hole.outline);
  ctx.clip();
  // A slope laid over a bridge (an updraft) shows only its arrows, over the
  // planks; any other slope is its own patch of ground.
  const overBridge = (s) => {
    const a = bounds(s.points);
    return hole.bridges.some((b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);
  };
  for (const s of hole.slopes) if (!overBridge(s)) drawSlope(ctx, v, p, s);
  for (const w of hole.water) drawWater(ctx, v, w);
  for (const b of hole.bridges) drawBridge(ctx, p, b, hole.liquid);
  for (const s of hole.slopes) if (overBridge(s)) drawArrows(ctx, v, p, s);
  ctx.restore();
}

function drawSlope(ctx, v, p, s) {
  polygon(ctx, s.points);
  ctx.fillStyle = p.slope;
  ctx.fill();
  drawArrows(ctx, v, p, s);
}

function drawArrows(ctx, v, p, s) {
  const len = Math.hypot(s.push.x, s.push.y) || 1;
  const ux = s.push.x / len;
  const uy = s.push.y / len;
  // The arrows drift gently downhill, so a slope reads as a slope at a glance.
  const drift = ((v.clock / 1000) * 6) % 24;
  ctx.save();
  polygon(ctx, s.points);
  ctx.clip();
  ctx.strokeStyle = p.arrow;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  const box = bounds(s.points);
  for (let y = box.y - 12; y < box.y + box.h + 12; y += 24) {
    for (let x = box.x + 12; x < box.x + box.w; x += 24) {
      const cx = x + ux * drift;
      const cy = y + uy * drift;
      ctx.beginPath();
      ctx.moveTo(cx - ux * 5, cy - uy * 5);
      ctx.lineTo(cx + ux * 5, cy + uy * 5);
      ctx.moveTo(cx + ux * 5 - (ux + uy) * 3, cy + uy * 5 - (uy - ux) * 3);
      ctx.lineTo(cx + ux * 5, cy + uy * 5);
      ctx.lineTo(cx + ux * 5 - (ux - uy) * 3, cy + uy * 5 - (uy + ux) * 3);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawSand(ctx, p, points) {
  polygon(ctx, points);
  ctx.fillStyle = p.sand;
  ctx.fill();
  ctx.save();
  polygon(ctx, points);
  ctx.clip();
  ctx.fillStyle = p.speckle;
  for (const q of scatter(bounds(points), 5, Math.round(points[0].x + points[0].y))) ctx.fillRect(q.x, q.y, 1, 1);
  ctx.restore();
}

function drawWater(ctx, v, points) {
  const liquid = LIQUIDS[v.hole.liquid] || LIQUIDS.sea;
  polygon(ctx, points);
  ctx.fillStyle = liquid.fill;
  ctx.fill();
  ctx.save();
  polygon(ctx, points);
  ctx.clip();
  const box = bounds(points);
  const t = v.clock / 1000;
  if (v.hole.liquid === "chasm") {
    // Rings sinking into the dark, forever.
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    ctx.strokeStyle = liquid.ripple;
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const r = ((i * 20 + t * 14) % 120) + 4;
      const wide = box.w > box.h;
      ellipse(ctx, cx, cy, r * (wide ? 1 : 0.5), r * (wide ? 0.5 : 1));
      ctx.stroke();
    }
  } else {
    ctx.strokeStyle = liquid.ripple;
    ctx.lineWidth = 1;
    for (let y = box.y + 6; y < box.y + box.h; y += 12) {
      ctx.beginPath();
      for (let x = box.x; x <= box.x + box.w; x += 4) {
        const wy = y + Math.sin(x / 9 + t * (v.hole.liquid === "lava" ? 0.8 : 1.6) + y) * 1.5;
        if (x === box.x) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    if (v.hole.liquid === "lava") {
      // Bubbles that swell and pop.
      let i = 0;
      for (const q of scatter(box, 26, 17)) {
        const k = (t * 0.7 + i * 0.37) % 1;
        circle(ctx, q.x, q.y, 1 + k * 4);
        ctx.fillStyle = `rgba(255, 210, 90, ${0.9 - k * 0.9})`;
        ctx.fill();
        i++;
      }
    }
  }
  ctx.restore();
}

function drawBridge(ctx, p, b, liquid) {
  ctx.fillStyle = p.shadow;
  ctx.fillRect(b.x, b.y + 2, b.w, b.h);
  ctx.fillStyle = p.bridge;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = p.plank;
  for (let x = b.x + 7; x < b.x + b.w; x += 7) ctx.fillRect(x, b.y, 0.8, b.h);
  ctx.fillRect(b.x, b.y, b.w, 1.5);
  ctx.fillRect(b.x, b.y + b.h - 1.5, b.w, 1.5);
  if (liquid === "chasm") {
    // Rope rails that sag between posts.
    ctx.strokeStyle = "#c9a26a";
    ctx.lineWidth = 1;
    for (const y of [b.y + 1, b.y + b.h - 1]) {
      ctx.beginPath();
      ctx.moveTo(b.x, y);
      ctx.quadraticCurveTo(b.x + b.w / 2, y + (y === b.y + 1 ? 3 : -3), b.x + b.w, y);
      ctx.stroke();
    }
  }
}

function drawWalls(ctx, p, walls) {
  ctx.lineCap = "round";
  const cave = p.theme === "cave";
  const stroke = (color, width, dx, dy) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const w of walls) {
      ctx.moveTo(w.x1 + dx, w.y1 + dy);
      ctx.lineTo(w.x2 + dx, w.y2 + dy);
    }
    ctx.stroke();
  };
  stroke(p.shadow, cave ? 5.5 : 4.5, 1.5, 2);
  stroke(p.wall, cave ? 5 : 4, 0, 0);
  stroke(p.wallTop, 1.2, -0.4, -0.4);
}

// A stone crusher: a heavy block with an angry face while shut, a slot with
// a warning glow while open, shaking just before it slams.
function drawGates(ctx, v, p) {
  for (const g of v.gates) {
    const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    const angle = Math.atan2(g.y2 - g.y1, g.x2 - g.x1);
    const soon = !g.shut && g.phase > g.open - 0.15;
    const shake = soon ? Math.sin(v.clock / 18) * 1.2 : 0;
    ctx.save();
    ctx.translate((g.x1 + g.x2) / 2 + shake, (g.y1 + g.y2) / 2);
    ctx.rotate(angle);
    if (g.shut) {
      ctx.fillStyle = p.shadow;
      ctx.fillRect(-len / 2 + 2, -5, len, 12);
      ctx.fillStyle = "#6b6577";
      ctx.fillRect(-len / 2, -6, len, 12);
      ctx.fillStyle = "#8d869b";
      ctx.fillRect(-len / 2, -6, len, 3);
      // Angry eyebrows, angry eyes.
      for (const dx of [-8, 8]) {
        ctx.fillStyle = "#1d1a17";
        ctx.fillRect(dx - 3, -1, 6, 2.5);
      }
    } else {
      ctx.fillStyle = soon ? "rgba(255, 70, 40, 0.55)" : "rgba(0, 0, 0, 0.35)";
      for (let x = -len / 2; x < len / 2; x += 10) ctx.fillRect(x, -1.5, 6, 3);
    }
    ctx.restore();
  }
}

// Skull mouths on the front nine, swirling portals in the caves.
function drawTunnels(ctx, v, p) {
  v.hole.tunnels.forEach((t, i) => {
    const ring = i % 2 ? p.portalB : p.portalA;
    for (const [k, m] of [t.a, t.b].entries()) {
      circle(ctx, m.x, m.y, v.tunnelR);
      ctx.fillStyle = p.cup;
      ctx.fill();
      if (p.theme === "cave") {
        const spin = v.clock / 300 + k;
        ctx.strokeStyle = k ? p.portalB : p.portalA;
        ctx.lineWidth = 2;
        for (let a = 0; a < 3; a++) {
          ctx.beginPath();
          ctx.arc(m.x, m.y, v.tunnelR - 1 - a * 2.5, spin + a, spin + a + 3.6);
          ctx.stroke();
        }
      } else {
        // A skull above the mouth, its jaw the mouth itself.
        ctx.strokeStyle = ring;
        ctx.lineWidth = 3;
        circle(ctx, m.x, m.y, v.tunnelR);
        ctx.stroke();
        circle(ctx, m.x, m.y - v.tunnelR - 5, 7);
        ctx.fillStyle = ring;
        ctx.fill();
        for (const dx of [-2.6, 2.6]) {
          circle(ctx, m.x + dx, m.y - v.tunnelR - 6, 1.7);
          ctx.fillStyle = "#1d1a17";
          ctx.fill();
        }
      }
    }
  });
}

// The power-up pads still on the hole: a pulsing disc and the icon.
function drawPads(ctx, v, p) {
  v.pads.forEach((pad, i) => {
    if (pad.taken) return;
    const pulse = Math.sin(v.clock / 220 + i) * 0.5 + 0.5;
    const bob = Math.sin(v.clock / 300 + i) * 1.2;
    circle(ctx, pad.x, pad.y, v.padR + 2 + pulse * 2);
    ctx.globalAlpha = 0.35 + pulse * 0.25;
    ctx.fillStyle = p.pad;
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, pad.x, pad.y, v.padR);
    ctx.strokeStyle = p.pad;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([2, 2]);
    ctx.stroke();
    ctx.setLineDash([]);
    drawPowerIcon(ctx, pad.kind, pad.x, pad.y + bob, v.padR * 0.75);
  });
}

function drawCup(ctx, v, p) {
  const { hole } = v;
  const { x, y } = hole.cup;
  const r = v.cupDraw;
  if (v.magnetR) {
    // The magnet's reach, a slow dashed ring.
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -v.clock / 40;
    circle(ctx, x, y, v.magnetR);
    ctx.strokeStyle = "rgba(255, 80, 70, 0.6)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  circle(ctx, x, y, r + 1.5);
  ctx.fillStyle = p.shadow;
  ctx.fill();
  circle(ctx, x, y, r);
  ctx.fillStyle = p.cup;
  ctx.fill();
  if (r > v.cupR) {
    circle(ctx, x, y, r + 2);
    ctx.strokeStyle = "#f0c22c";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // The pole leans out of the cup, and the flag waves with the clock: a
  // Jolly Roger on the front nine, a glowing pennant in the caves.
  const wave = Math.sin(v.clock / 260) * 1.5;
  ctx.strokeStyle = v.colors.pole;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 4, y - 26);
  ctx.stroke();
  ctx.fillStyle = p.flag;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 26);
  ctx.quadraticCurveTo(x + 11, y - 23 + wave, x + 18, y - 22 + wave);
  ctx.lineTo(x + 3, y - 16);
  ctx.closePath();
  ctx.fill();
  circle(ctx, x + 9, y - 21 + wave * 0.5, 1.8);
  ctx.fillStyle = p.flagMark;
  ctx.fill();
}

function drawBall(ctx, v, p) {
  const { colors, ball } = v;
  let r = v.ballR;
  if (v.sinking !== null) {
    // Into the cup: shrinks over the first moments of the card.
    r *= Math.max(0, 1 - v.sinking);
    if (r <= 0.2) return;
  }
  const ghost = v.active === "ghost";
  const tint = v.active === "cannon" ? "#2b2b30" : ghost ? "#dfe8ff" : colors.ball;
  v.trail.forEach((q, i) => {
    ctx.globalAlpha = ((i + 1) / v.trail.length) * (v.active ? 0.6 : 0.35);
    circle(ctx, q.x, q.y, r * 0.8);
    ctx.fillStyle = v.active === "cannon" ? "#ff9a2e" : v.active ? p.pad : colors.ball;
    ctx.fill();
  });
  ctx.globalAlpha = ghost ? 0.65 : 1;
  circle(ctx, ball.x + 1.2, ball.y + 1.6, r);
  ctx.fillStyle = colors.shadow;
  ctx.fill();
  circle(ctx, ball.x, ball.y, r);
  ctx.fillStyle = tint;
  ctx.fill();
  circle(ctx, ball.x - r * 0.3, ball.y - r * 0.3, r * 0.3);
  ctx.fillStyle = colors.pole;
  ctx.fill();
  if (v.active === "bouncy") {
    // A duck rides along, obviously.
    drawPowerIcon(ctx, "bouncy", ball.x + 4, ball.y - 6, 4);
  }
  ctx.globalAlpha = 1;
}

// The spyglass's view of the putt being aimed: a dotted line where it rolls.
function drawSpy(ctx, v, p) {
  if (!v.spy || v.spy.length < 2) return;
  ctx.save();
  ctx.strokeStyle = p.spy;
  ctx.lineWidth = 1.6;
  ctx.setLineDash([2, 3]);
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  let pen = false;
  for (const q of v.spy) {
    if (!q) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
    pen = true;
  }
  ctx.stroke();
  const end = v.spy.at(-1);
  if (end) {
    ctx.setLineDash([]);
    circle(ctx, end.x, end.y, 3);
    ctx.stroke();
  }
  ctx.restore();
}

// The meter's bands are the same bright gold and red on every hole, so MAX
// and the overswing read the same in the cove and in the dark caves.
const MAX_GOLD = "#ffd23f";
const OVER_RED = "#ff4d3d";

const zoneColor = (zone, colors) => (zone === "max" ? MAX_GOLD : zone === "over" ? OVER_RED : colors.aim);

// The aim: a dotted line from the ball. Resting, it is a short pointer; once
// the meter runs it grows with the needle, gold in the MAX band and red past
// it.
function drawAim(ctx, v) {
  const { colors, ball, aim } = v;
  const ux = Math.cos(aim.angle);
  const uy = Math.sin(aim.angle);
  const reach = aim.needle === null ? 34 : 16 + 70 * Math.min(aim.needle, 1.1);
  const color = zoneColor(aim.zone, colors);
  ctx.globalAlpha = aim.needle === null ? 0.75 : 0.95;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(ball.x + ux * 7, ball.y + uy * 7);
  ctx.lineTo(ball.x + ux * reach, ball.y + uy * reach);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ball.x + ux * reach, ball.y + uy * reach);
  ctx.lineTo(ball.x + ux * (reach - 6) - uy * 4, ball.y + uy * (reach - 6) + ux * 4);
  ctx.lineTo(ball.x + ux * (reach - 6) + uy * 4, ball.y + uy * (reach - 6) - ux * 4);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.globalAlpha = 1;
}

// The shot clock: a ring round the resting ball that drains as it waits,
// faint at first, then flashing red for its last third.
function drawShotClock(ctx, v) {
  if (v.shotClock === null || v.phase !== "aim") return;
  const { ball, ballR, colors } = v;
  const late = v.shotClock < 1 / 3;
  ctx.save();
  ctx.globalAlpha = late ? 0.95 : 0.4;
  ctx.strokeStyle = late && Math.floor(v.clock / 160) % 2 ? OVER_RED : colors.aim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ballR + 6, -Math.PI / 2, -Math.PI / 2 + v.shotClock * Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// The power meter while it runs: a bar beside the ball, on the side away from
// the aim so it never crosses the aim line (unless the course edge leaves no
// room), with the MAX band and the overswing at the top, a mark where the
// last swing stopped, the needle, and a dot for each trip left before the
// ball dribbles.
const METER_W = 8;
const METER_H = 72;
function drawMeter(ctx, v) {
  const m = v.meter;
  if (!m) return;
  const { ball, course, colors } = v;
  const right = ball.x + 12;
  const left = ball.x - 12 - METER_W;
  const fitsRight = right + METER_W <= course.w - 4;
  const fitsLeft = left >= 4;
  const x = v.aim && Math.cos(v.aim.angle) > 0 ? (fitsLeft ? left : right) : fitsRight ? right : left;
  const top = Math.max(28, Math.min(course.h - 14 - METER_H, ball.y - METER_H / 2));
  const bottom = top + METER_H;
  const at = (pos) => bottom - (pos / m.top) * METER_H;
  ctx.save();
  roundRect(ctx, x - 1.5, top - 1.5, METER_W + 3, METER_H + 3, 3);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = "#10151c";
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.power;
  ctx.fillRect(x, at(m.maxFrom), METER_W, bottom - at(m.maxFrom));
  ctx.fillStyle = MAX_GOLD;
  ctx.fillRect(x, at(1), METER_W, at(m.maxFrom) - at(1));
  ctx.fillStyle = OVER_RED;
  ctx.fillRect(x, top, METER_W, at(1) - top);
  // Above the needle the bar is dimmed, so the fill reads as the power.
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#10151c";
  ctx.fillRect(x, top, METER_W, at(m.needle) - top);
  ctx.globalAlpha = 1;
  if (m.last !== null) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 0.8;
    ctx.setLineDash([1.5, 1.5]);
    ctx.beginPath();
    ctx.moveTo(x - 2, at(m.last));
    ctx.lineTo(x + METER_W + 2, at(m.last));
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const ny = at(m.needle);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(x - 2.5, ny);
  ctx.lineTo(x + METER_W + 2.5, ny);
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  const side = x < ball.x ? x + METER_W + 2.5 : x - 2.5;
  const dir = x < ball.x ? 1 : -1;
  ctx.moveTo(side, ny);
  ctx.lineTo(side + dir * 4, ny - 3);
  ctx.lineTo(side + dir * 4, ny + 3);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < m.tripsLeft; i++) {
    circle(ctx, x + METER_W / 2 + (i - (m.tripsLeft - 1) / 2) * 4, bottom + 5, 1.2);
    ctx.fill();
  }
  ctx.restore();
}

// A cave is dark: only a pool of light round the ball, and whatever glows.
function drawDarkness(ctx, v, p) {
  if (!p.dark) return;
  const { course, ball } = v;
  const shade = `rgba(6, 4, 14, ${p.dark})`;
  const g = radial(ctx, ball.x, ball.y, 30, 190, [[0, "rgba(6, 4, 14, 0)"], [0.45, `rgba(6, 4, 14, ${p.dark * 0.45})`], [1, shade]]);
  ctx.fillStyle = g || `rgba(6, 4, 14, ${p.dark * 0.4})`;
  ctx.fillRect(0, 0, course.w, course.h);
  if (!g) return;
  // The lights, added on top of the dark.
  const lights = [
    ...decorLights(v.hole.decor),
    { x: v.hole.cup.x, y: v.hole.cup.y, r: 40, color: "rgba(80, 230, 255, 0.4)" },
    ...v.pads.filter((q) => !q.taken).map((q) => ({ x: q.x, y: q.y, r: 22, color: "rgba(125, 255, 240, 0.35)" })),
    ...v.hole.bumpers.filter((b) => b.look === "crystal" || b.look === "mushroom" || !b.look).map((b) => ({ x: b.x, y: b.y, r: b.r * 3, color: b.look === "crystal" ? "rgba(150, 110, 255, 0.4)" : "rgba(255, 90, 180, 0.35)" })),
    ...v.movers.filter((m) => m.look === "fireball").map((m) => ({ x: m.x, y: m.y, r: 50, color: "rgba(255, 130, 40, 0.5)" })),
    ...v.hole.tunnels.flatMap((t) => [t.a, t.b]).map((m) => ({ x: m.x, y: m.y, r: 26, color: "rgba(120, 220, 255, 0.35)" })),
  ];
  const liquid = LIQUIDS[v.hole.liquid];
  if (liquid && liquid.glow) {
    for (const w of v.hole.water) {
      const b = bounds(w);
      lights.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) * 0.75, color: liquid.glow });
    }
  }
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const l of lights) {
    const lg = radial(ctx, l.x, l.y, 0, l.r, [[0, l.color], [1, "rgba(0, 0, 0, 0)"]]);
    if (!lg) continue;
    ctx.fillStyle = lg;
    ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  ctx.restore();
}

// Words that pop up where something happened, drifting up as they fade.
function drawToasts(ctx, v) {
  const { colors } = v;
  for (const t of v.toasts) {
    const size = t.big ? 12 : 9;
    const x = Math.max(60, Math.min(v.course.w - 60, t.x));
    const y = Math.max(40, t.y - t.age * 18);
    ctx.globalAlpha = Math.max(0, 1 - t.age * t.age);
    text(ctx, colors, t.text, x, y, { size, weight: 800, align: "center", color: t.big ? "#ffe27a" : "#ffffff", outline: "rgba(20, 12, 4, 0.85)" });
  }
  ctx.globalAlpha = 1;
}

function drawHeader(ctx, v) {
  const { colors, course, hole } = v;
  // A pill sized to its words, at one top corner or the other.
  const pill = (str, right) => {
    const w = measure(ctx, colors, str, 8.5) + 12;
    roundRect(ctx, right ? course.w - 6 - w : 6, 6, w, 18, 6);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = colors.card;
    ctx.fill();
    ctx.globalAlpha = 1;
    text(ctx, colors, str, right ? course.w - 12 : 12, 15, { size: 8.5, align: right ? "right" : "left" });
  };
  pill(`${hole.theme === "cave" ? "Cave" : "Cove"} ${v.holeNo} · ${hole.name} · Par ${hole.par}`, false);
  pill(`Strokes ${v.strokes} · Round ${signed(v.toPar)}`, true);
  if (v.fast) {
    // The roll fast-forwarding, bottom left.
    const str = `>> ${v.fast}x`;
    const w = measure(ctx, colors, str, 8.5, 800) + 12;
    roundRect(ctx, 6, course.h - 24, w, 18, 6);
    ctx.globalAlpha = 0.88;
    ctx.fillStyle = colors.card;
    ctx.fill();
    ctx.globalAlpha = 1;
    text(ctx, colors, str, 12, course.h - 15, { size: 8.5, weight: 800 });
  }
  if (v.held) {
    // The power-up waiting for the next putt, bottom right.
    const str = `Next putt: ${v.held.name}, ${v.held.blurb}`;
    const size = 7.5;
    const w = Math.min(course.w - 100, measure(ctx, colors, str, size) + 30);
    const x = course.w - 6 - w;
    const y = course.h - 24;
    roundRect(ctx, x, y, w, 18, 6);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = colors.card;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#e0ab4c";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    drawPowerIcon(ctx, v.held.kind, x + 11, y + 9, 6);
    ctx.save();
    roundRect(ctx, x, y, w, 18, 6);
    ctx.clip();
    text(ctx, colors, str, x + 21, y + 9.5, { size, weight: 700 });
    ctx.restore();
  }
}

// The hole's quip on a banner as it starts: a scroll in the cove, a stone
// tablet in the caves.
function drawIntro(ctx, v) {
  if (v.phase === "card" || v.phase === "done" || v.holeMs > 3800 || !v.hole.quip) return;
  const { colors, course, hole } = v;
  const fade = Math.min(1, v.holeMs / 300, (3800 - v.holeMs) / 500);
  const size = 8;
  const w = Math.min(course.w - 40, measure(ctx, colors, hole.quip, size, 700) + 26);
  const x = (course.w - w) / 2;
  const y = 30;
  const cave = hole.theme === "cave";
  ctx.globalAlpha = fade * 0.95;
  roundRect(ctx, x, y, w, 20, cave ? 3 : 8);
  ctx.fillStyle = cave ? "#2c2736" : "#f1e2b8";
  ctx.fill();
  ctx.strokeStyle = cave ? "#7dfff0" : "#8a5a2b";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  text(ctx, colors, hole.quip, course.w / 2, y + 10.5, { size, weight: 700, align: "center", color: cave ? "#d9fffb" : "#4a2c12" });
  ctx.globalAlpha = 1;
}

// One nine of the card as a table: hole numbers, pars, then strokes so far,
// and the nine's sum (plus the round's total after the back nine).
function drawTable(ctx, v, x, y, w, from, to, sumLabel, withTotal) {
  const { colors } = v;
  const holes = v.card.slice(from, to);
  // The label takes two columns; each hole, the sum and the total take one.
  const col = w / (holes.length + 4);
  const sum = (key) => holes.reduce((n, c) => n + (c[key] || 0), 0);
  const played = holes.some((c) => c.strokes !== null);
  const rows = [
    ["Hole", ...holes.map((_, i) => String(from + i + 1)), sumLabel, withTotal ? "Total" : ""],
    ["Par", ...holes.map((c) => String(c.par)), String(sum("par")), withTotal ? String(v.parTotal) : ""],
    ["Strokes", ...holes.map((c) => (c.strokes === null ? "" : String(c.strokes))), played ? String(sum("strokes")) : "", withTotal ? String(v.total) : ""],
  ];
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      const cx = c === 0 ? x : x + col * (c + 1.5);
      const hole = holes[c - 1];
      let color = r === 0 ? colors.ink2 : colors.ink;
      if (r === 2 && hole && hole.strokes !== null) color = hole.strokes < hole.par ? colors.under : hole.strokes > hole.par ? colors.over : colors.ink;
      text(ctx, colors, cell, cx, y + r * 11, { size: 7.5, weight: r === 2 ? 700 : 500, align: c === 0 ? "left" : "center", color });
    });
  });
}

function drawCard(ctx, v) {
  const { colors, course } = v;
  const done = v.state === "over";
  const w = 320;
  const h = done ? 104 : v.turn ? 166 : 152;
  const x = (course.w - w) / 2;
  // The final card sits high, clear of the window's own message in the middle.
  const y = done ? 12 : (course.h - h) / 2;
  ctx.globalAlpha = done ? 0.95 : Math.min(1, v.cardMs / 250);
  ctx.fillStyle = colors.shadow;
  roundRect(ctx, x + 2, y + 3, w, h, 10);
  ctx.fill();
  roundRect(ctx, x, y, w, h, 10);
  ctx.fillStyle = colors.card;
  ctx.fill();
  const last = v.card.filter((c) => c.strokes !== null).at(-1);
  let top = y + 16;
  if (done) {
    text(ctx, colors, `Round over: ${v.total} strokes, ${signed(v.toPar)} for par ${v.parTotal}. You survived!`, course.w / 2, top, { size: 9.5, align: "center" });
    top += 14;
  } else if (last) {
    text(ctx, colors, `${v.hole.theme === "cave" ? "Cave" : "Cove"} ${v.holeNo}: ${v.hole.name}`, course.w / 2, top, { size: 9, weight: 500, align: "center", color: colors.ink2 });
    const word = holeWord(last.strokes, last.par, v.pickedUp);
    const color = last.strokes < last.par ? colors.under : last.strokes > last.par ? colors.over : colors.ink;
    text(ctx, colors, `${word} · ${last.strokes} ${last.strokes === 1 ? "stroke" : "strokes"}`, course.w / 2, top + 17, { size: 12, weight: 700, align: "center", color });
    text(ctx, colors, holeQuip(last.strokes, last.par, v.pickedUp, v.hole.theme), course.w / 2, top + 32, { size: 8, weight: 500, align: "center", color: colors.ink2 });
    text(ctx, colors, `Round ${signed(v.toPar)}`, course.w / 2, top + 45, { size: 8.5, align: "center" });
    top += 54;
    if (v.turn) {
      text(ctx, colors, "Front nine plundered! Grab a torch: the Caves of Doom await...", course.w / 2, top, { size: 8.5, weight: 700, align: "center", color: colors.over });
      top += 14;
    }
  }
  drawTable(ctx, v, x + 14, top + 4, w - 28, 0, v.frontNine, "Out", false);
  drawTable(ctx, v, x + 14, top + 42, w - 28, v.frontNine, v.card.length, "In", true);
  if (!done) text(ctx, colors, "Space or click for the next hole", course.w / 2, y + h - 8, { size: 7, weight: 400, align: "center", color: colors.ink2 });
  ctx.globalAlpha = 1;
}

// Confetti and rays out of the cup after a hole in one, over the card's
// first second and a bit.
function drawBurst(ctx, v) {
  const { colors, hole } = v;
  const t = Math.min(1, v.cardMs / 1400);
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = colors.burst;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r0 = 8 + t * 30;
    const r1 = r0 + 12;
    ctx.beginPath();
    ctx.moveTo(hole.cup.x + Math.cos(a) * r0, hole.cup.y + Math.sin(a) * r0);
    ctx.lineTo(hole.cup.x + Math.cos(a) * r1, hole.cup.y + Math.sin(a) * r1);
    ctx.stroke();
  }
  const confetti = ["#f0c22c", "#e4312b", "#49e3ff", "#5bff9a", "#ff5bd6"];
  for (let i = 0; i < 30; i++) {
    const a = (i * 2.399) % (Math.PI * 2);
    const speed = 50 + (i * 37) % 70;
    const cx = hole.cup.x + Math.cos(a) * speed * t;
    const cy = hole.cup.y + Math.sin(a) * speed * t + 60 * t * t;
    ctx.fillStyle = confetti[i % confetti.length];
    ctx.fillRect(cx, cy, 3, 2);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ frame */

// One frame. `v` is the view golf.js builds: { course, hole, holeNo, clock,
// holeMs, spinners, movers, gates, pads, ball, ballR, cupR, cupDraw, magnetR,
// tunnelR, padR, trail, aim, meter, shotClock, fast, spy, held, active,
// toasts, sinking, phase, cardMs, card, frontNine, turn, total, parTotal,
// toPar, strokes, pickedUp, ace, state, colors }.
export function drawCourse(ctx, v) {
  const p = paletteFor(v);
  const layer = stillLayer(ctx, v);
  if (layer) {
    // The layer is already at the board's pixel size: copy it unscaled.
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(layer, 0, 0);
    ctx.restore();
  } else {
    drawStill(ctx, v);
  }
  drawGround(ctx, v, p);
  drawDecor(ctx, p, v.hole.decor, v.clock, "low");
  drawWalls(ctx, p, v.hole.walls);
  drawGates(ctx, v, p);
  drawTunnels(ctx, v, p);
  drawPads(ctx, v, p);
  for (const b of v.hole.bumpers) drawBumperLook(ctx, p, b, v.clock);
  for (const m of v.movers) drawMoverLook(ctx, p, m, v.clock);
  drawCup(ctx, v, p);
  for (const s of v.spinners) drawSpinnerLook(ctx, p, s, v.clock);
  if (v.phase !== "done") drawBall(ctx, v, p);
  drawDecor(ctx, p, v.hole.decor, v.clock, "high");
  drawDarkness(ctx, v, p);
  drawDecor(ctx, p, v.hole.decor, v.clock, "glow");
  if (v.aim) {
    drawSpy(ctx, v, p);
    drawAim(ctx, v);
  }
  drawShotClock(ctx, v);
  drawMeter(ctx, v);
  drawHeader(ctx, v);
  drawIntro(ctx, v);
  if (v.ace && v.phase === "card") drawBurst(ctx, v);
  if (v.phase === "card" || v.state === "over") drawCard(ctx, v);
  // Over everything, the card too, so a shout is never hidden or in the way.
  drawToasts(ctx, v);
}
