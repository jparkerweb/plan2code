// Plan2Code Web Console - Ghoul Rush's Blackmoor Sanatorium stage, its drawing: the rooms' looks (a derelict 1910s asylum in green-gray tile: admissions with its desk and iron beds, the hydrotherapy baths with their tubs and pipes, the surgical theater with its gallery and great lamp, the night ward with its beds and medicine cabinets), the ceiling lamps that stutter and the blackout, the orderly, gurney, flicker and specimen bloater, the Night Matron with her lantern's cone, her syringes and the arm through the wall, the jar and the formaldehyde, the Smelling Salts and the Bone Saw, and what its events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, LOSE_WORDS and LOSE_SOUNDS are
// plain data (the voices borrow the house's, the Graveyard's and the Chapel's
// tones until the stage's own sounds are picked); sanatoriumArt(d) takes
// ghoul-draw.js's own drawing helpers (`d`) and hands back the drawing by
// kind, so this file never reaches back into it. Everything is drawn in room
// units, the way ghoul-draw.js draws: y counted down from the field's top, a
// monster from (x, y) at its feet. The figures are drawn in a local frame
// turned to face the way they look, y counted up from the feet. What the art
// reads off the rules (ghoul-sanatorium.js): `m.unseen` / `m.shown` / `m.act`
// on a flicker ("creep" or "lunge"), `m.act` on an orderly ("walk", "reach",
// "hold", "rest") and a gurney ("parked", "rattle", "roll", "rest"),
// `round.blackout` and `round.twist` ({ stage: "calm" | "stutter" | "out",
// left }), on the Matron `b.beam` ({ x, y, angle, half, range, dep, on,
// blocked }), `b.heat` (0 to 1), `b.cabinets` ([x0, x1, top]), `b.act` and
// `b.raged`, and on Planny `heldMs` and `flingMs`.
//
// The room is drawn once per layer (the walls, floors, boards, the cabinets
// and the tubs); what moves (the ceiling lamps, the water in the tubs, the
// orderly's fingers over Planny, the Matron's heat on him) is drawn by
// `front`, over Planny and before the dark, and a blackout is the dark
// layer's alpha, raised by `dim`.

import { LANTERN_LIGHT, SALTS_GLOW, STUTTER_MS, GURNEY_RATTLE_MS, ORDERLY_REACH_MS, ORDERLY_HOLD_MS, JAR_WIND_MS, SYRINGE_WIND_MS, ARM_WARN_MS, BEAM_ORIGIN_X, BEAM_ORIGIN_Y } from "./ghoul-sanatorium.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Indoors, but drawn by this file (`custom`: ghoul-draw.js hands the walls,
// the floor and the shelves to sanatoriumArt() through `pack`, the way the
// Chapel's are): `scene` names what the room is made of, `decor` what stands
// along its wall, `clinic` marks the stage's picture on its card.
const ward = (o) => freeze({ pack: "sanatorium", custom: true, clinic: true, noMoon: true, pit: "#010303", ...o });
export const LOOKS = freeze({
  admissions: ward({ scene: "admissions", wallTop: "#0f1613", wallLow: "#26352f", paper: "#34483f", wainscot: "#1b2823", floorTop: "#6f7f76", floor: "#2c3631", floorEdge: "#0b0f0d", shelf: "#4a3a2a", shelfTop: "#8a7452", window: "#c4e4d4", decor: "beds", color: "#a8d8c0", dark: 0.86 }),
  baths: ward({ scene: "baths", wallTop: "#0a1416", wallLow: "#173a40", paper: "#245560", wainscot: "#12262b", floorTop: "#6a8088", floor: "#26343a", floorEdge: "#080e10", shelf: "#9aa8a4", shelfTop: "#d4dedb", window: "#a8dcea", decor: "pipes", color: "#8fd0e0", dark: 0.88 }),
  theater: ward({ scene: "theater", wallTop: "#10130e", wallLow: "#2a3222", paper: "#394430", wainscot: "#1b2116", floorTop: "#727a66", floor: "#2c3228", floorEdge: "#0c0e0a", shelf: "#4a3220", shelfTop: "#8a6440", window: "#d0e4b4", decor: "lamp", color: "#c4d8a0", dark: 0.88 }),
  ward: ward({ scene: "ward", wallTop: "#0c1210", wallLow: "#1e2e2a", paper: "#2b3f38", wainscot: "#141f1b", floorTop: "#62736a", floor: "#262e2a", floorEdge: "#090d0b", shelf: "#3a3f3c", shelfTop: "#a8b0aa", window: "#c0e8d8", decor: "wardbeds", color: "#b0e0cc", dark: 0.9 }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-sanatorium.js).
// `lights` is the ceiling lamps (stutter, out, on), `salts` and `saw` are the power-ups.
export const VOICES = freeze({
  orderly: freeze({ appear: "ghoulOrderlyAppear", reach: "ghoulOrderlyReach", grab: "ghoulOrderlyGrab", throw: "ghoulOrderlyThrow", hurt: "ghoulOrderlyHurt", die: "ghoulOrderlyDie" }),
  gurney: freeze({ appear: "ghoulGurneyAppear", rattle: "ghoulGurneyRattle", roll: "ghoulGurneyRoll", hurt: "ghoulGurneyHurt", die: "ghoulGurneyDie" }),
  flicker: freeze({ appear: "ghoulFlickerAppear", show: "ghoulFlickerShow", lunge: "ghoulFlickerLunge", hurt: "ghoulFlickerHurt", die: "ghoulFlickerDie" }),
  specimen: freeze({ appear: "ghoulSpecimenAppear", wind: "ghoulSpecimenWind", jar: "ghoulSpecimenJar", hurt: "ghoulSpecimenHurt", die: "ghoulSpecimenDie" }),
  matron: freeze({ wake: "ghoulMatronWake", beam: "ghoulMatronBeam", heat: "ghoulMatronHeat", syringeWind: "ghoulMatronSyringeWind", syringes: "ghoulMatronSyringes", armWarn: "ghoulMatronArmWarn", armReach: "ghoulMatronArmReach", rage: "ghoulMatronRage", hurt: "ghoulMatronHurt", die: "ghoulMatronDie" }),
  lights: freeze({ warn: "ghoulLightsWarn", out: "ghoulLightsOut", on: "ghoulLightsOn" }),
  salts: freeze({ active: "ghoulSaltsActive", break: "ghoulSaltsBreak" }),
  saw: freeze({ active: "ghoulSawActive", cut: "ghoulSawCut" }),
});
// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({ orderly: "Handled", gurney: "Run over", flicker: "Lights out", specimen: "Preserved", formaldehyde: "Pickled", matron: "Sedated", lantern: "Seen", arm: "Reached for", syringe: "Injected" });
export const LOSE_SOUNDS = freeze({
  orderly: ["thud", 0.5, 0.7],
  gurney: ["clank", 0.55, 0.6],
  flicker: ["wail", 0.35, 0.8],
  specimen: ["squish", 0.5, 0.8],
  formaldehyde: ["ghoulSizzle", 0.5, 0.8],
  matron: ["smash", 0.6, 0.6],
  lantern: ["ghoulSizzle", 0.5, 1.2],
  arm: ["thud", 0.6, 0.6],
  syringe: ["squish", 0.4, 1.4],
});

// Colors: the enamel and linen whites, rust, iron, rubber glove yellow, the
// formaldehyde green, the lamplight and the lantern's flame.
const LINEN = "#d4d8cc";
const LINEN_LIT = "#eef0e6";
const LINEN_DARK = "#8e9488";
const LINEN_SHADE = "#5c6258";
const STAIN = "#8a6a3a";
const BLOOD = "#6a2a1e";
const RUST = "#8a4a26";
const RUST_DARK = "#4e2a14";
const IRON = "#2a2f2f";
const IRON_LIT = "#5a6262";
const STEEL = "#aab4b4";
const STEEL_LIT = "#e4eeee";
const GLOVE = "#c8b86a";
const GLOVE_DARK = "#8a7c3a";
const SKIN = "#cdd2c0";
const SKIN_DARK = "#8a9486";
const FORMOL = "#9ae8a0";
const FORMOL_DARK = "#3a7a46";
const LAMP = "#f2f0c8";
const FLAME = "#ffc866";
const FLAME_HOT = "#ff7a3a";
const GOWN = "#a8c4b8";
const GOWN_DARK = "#6a8a7c";
const INK = "#0a0e0c";
const WINDOW_EVERY = 64;
const WINDOW_AT = 20;
const LAMP_EVERY = 44;
const LAMP_AT = 24;
const REACH = 112;

export function sanatoriumArt(d) {
  const { ellipse, circle, line, rotate, eye, hash, say, gate, DANGER, GOLD, FLASH, EYE_RED, EYE_PALE, EYE_AMBER } = d;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = (p) => p * p * (3 - 2 * p);
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  };

  /* ------------------------------------------------------------ helpers */

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

  // The part of [a, b] a still layer draws.
  function reach(ctx, a, b) {
    const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
    if (!m || !(m.a > 0)) return [a, b];
    const lo = -m.e / m.a - 4;
    return [Math.max(a, lo), Math.min(b, lo + REACH)];
  }

  // Runs `draw` in a frame at (x, y) turned to face `dir`: +x forward, +y up,
  // the figure's feet at the origin.
  function framed(ctx, x, y, dir, draw) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, -1);
    draw();
    ctx.restore();
  }

  const rect = (ctx, color, x, y, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // A polygon from a flat list of points.
  function poly(ctx, pts, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  // A two-bone limb from (sx, sy) to (tx, ty), `a` and `b` long, the elbow
  // bent `bend` (1 or -1) to one side; strokes both bones, `w` thick at the
  // shoulder and `w2` at the wrist, and gives back the elbow and the hand.
  function limb(ctx, sx, sy, tx, ty, a, b, bend, w, w2, color, shade) {
    let dx = tx - sx;
    let dy = ty - sy;
    let len = Math.hypot(dx, dy) || 0.001;
    const max = a + b - 0.02;
    if (len > max) {
      tx = sx + (dx / len) * max;
      ty = sy + (dy / len) * max;
      dx = tx - sx;
      dy = ty - sy;
      len = max;
    }
    const c = (a * a + len * len - b * b) / (2 * a * len);
    const ang = Math.atan2(dy, dx) + bend * Math.acos(clamp(c, -1, 1));
    const ex = sx + Math.cos(ang) * a;
    const ey = sy + Math.sin(ang) * a;
    ctx.lineCap = "round";
    ctx.strokeStyle = shade || color;
    ctx.lineWidth = w + 0.1;
    line(ctx, sx, sy, ex, ey);
    ctx.lineWidth = w2 + 0.1;
    line(ctx, ex, ey, tx, ty);
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    line(ctx, sx, sy, ex, ey);
    ctx.lineWidth = w2;
    line(ctx, ex, ey, tx, ty);
    return [ex, ey, tx, ty];
  }

  /* -------------------------------------------------------- lamps (time) */

  // How lit the ceiling lamp `i` is: 1 when the lamps are on, 0 in a blackout,
  // and in a stutter a flicker that fails more and more as the blackout nears.
  function lampLevel(v, i) {
    const r = v.round;
    if (r.blackout || (r.twist && r.twist.stage === "out")) return 0;
    const tw = r.twist;
    if (!tw || tw.stage !== "stutter") return 1;
    const p = 1 - Math.max(0, tw.left) / STUTTER_MS;
    const c = v.clock;
    const s = Math.sin(c / 37 + i * 2.1) + Math.sin(c / 53 + i) + Math.sin(c / 91 + i * 0.7);
    return clamp((s - (-1.4 + p * 2.4)) * 3 + 0.5, 0.06, 1);
  }

  // The lamps standing in [x0, x1], as [x, index].
  function lampsIn(x0, x1) {
    const out = [];
    for (let k = Math.floor((x0 - LAMP_AT - 8) / LAMP_EVERY); k * LAMP_EVERY + LAMP_AT < x1 + 8; k++) out.push([k * LAMP_EVERY + LAMP_AT, k]);
    return out;
  }

  /* ----------------------------------------------------------- the walls */

  // The spots a room's decor stands at between x0 and x1: every 32 units, a
  // third left empty, none over a pit.
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

  // A grid of glazed tiles over (x0, y0) to (x1, y1), `size` square: each a
  // little lighter or darker than the rest, a few cracked or gone, the
  // grout dark between them.
  function tiles(ctx, x0, x1, y0, y1, size, tint, salt) {
    for (let r = 0, y = y0; y < y1; y += size, r++) {
      for (let x = Math.floor(x0 / size) * size; x < x1; x += size) {
        const h = hash(Math.round(x / size), r + salt);
        if (h % 5 === 0) rect(ctx, "rgba(0, 0, 0, 0.2)", x, y, size, Math.min(size, y1 - y));
        else if (h % 7 === 1) rect(ctx, tint, x, y, size, Math.min(size, y1 - y));
        if (h % 23 === 3) {
          ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
          ctx.lineWidth = 0.12;
          ctx.beginPath();
          ctx.moveTo(x + size * 0.2, y);
          ctx.lineTo(x + size * 0.5, y + size * 0.45);
          ctx.lineTo(x + size * 0.35, y + size);
          ctx.stroke();
        }
      }
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.42)";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    for (let y = y0; y <= y1; y += size) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    for (let x = Math.floor(x0 / size) * size; x < x1; x += size) {
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y1);
    }
    ctx.stroke();
  }

  // A streak of rust or damp running down the wall from (x, y).
  function streak(ctx, x, y, len, w, color, a) {
    const gr = linear(ctx, 0, y, 0, y + len, [[0, rgba(color, a)], [1, rgba(color, 0)]], rgba(color, a * 0.5));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.3, y + len * 0.6, x - w * 0.15, y + len);
    ctx.lineTo(x + w * 0.2, y + len * 0.95);
    ctx.quadraticCurveTo(x + w * 0.4, y + len * 0.5, x + w, y);
    ctx.closePath();
    ctx.fill();
  }

  // A window with wired glass behind iron bars, a moon's pale in it, one pane
  // cracked; its sill below.
  function window(ctx, look, cx, n) {
    const x = cx - 4;
    const top = 7;
    const w = 8;
    const h = 16;
    rect(ctx, look.wainscot, x - 0.7, top - 0.7, w + 1.4, h + 1.4);
    rect(ctx, "#08100e", x, top, w, h);
    ctx.fillStyle = linear(ctx, 0, top, 0, top + h, [[0, rgba(look.window, 0.55)], [1, rgba(look.window, 0.12)]], rgba(look.window, 0.3));
    ctx.fillRect(x, top, w, h);
    // Wired glass: a diamond mesh, clipped to the pane.
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, top, w, h);
    ctx.clip();
    ctx.fillStyle = "#08100e";
    ctx.globalAlpha = 0.9;
    ctx.fillRect(x, top, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = linear(ctx, 0, top, 0, top + h, [[0, rgba(look.window, 0.5)], [1, rgba(look.window, 0.1)]], rgba(look.window, 0.3));
    ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    for (let k = -h; k < w + h; k += 1.6) {
      ctx.moveTo(x + k, top);
      ctx.lineTo(x + k + h, top + h);
      ctx.moveTo(x + k + h, top);
      ctx.lineTo(x + k, top + h);
    }
    ctx.stroke();
    if (n % 3 === 0) {
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.5, top + h * 0.55);
      ctx.lineTo(x + w, top + h * 0.5);
      ctx.lineTo(x + w, top + h * 0.8);
      ctx.lineTo(x + w * 0.7, top + h * 0.72);
      ctx.lineTo(x + w * 0.62, top + h * 0.9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // Bars and the cross-rail.
    ctx.fillStyle = IRON;
    for (let k = 1; k <= 3; k++) ctx.fillRect(x + (w * k) / 4 - 0.22, top - 0.2, 0.44, h + 0.4);
    ctx.fillRect(x - 0.3, top + h * 0.45, w + 0.6, 0.44);
    ctx.fillStyle = IRON_LIT;
    for (let k = 1; k <= 3; k++) ctx.fillRect(x + (w * k) / 4 - 0.22, top, 0.12, h);
    rect(ctx, "#8a9490", x - 1, top + h + 0.7, w + 2, 0.7);
    rect(ctx, "#2c3430", x - 1, top + h + 1.4, w + 2, 0.4);
    streak(ctx, x + 1 + (n % 4) * 1.6, top + h + 1.8, 6 + (n % 3) * 2, 0.35, RUST, 0.22);
    // Its light across the wall below.
    ctx.fillStyle = rgba(look.window, 0.05);
    poly(ctx, [x, top + h, x + w, top + h, x + w + 14, 48, x + 10, 48]);
    ctx.fill();
  }

  // Pipes along the ceiling: two runs with brackets, a joint with a rust
  // stain, a valve wheel now and then; thicker in the baths.
  function ceiling(ctx, look, x0, x1) {
    const sc = look.scene;
    rect(ctx, "rgba(0, 0, 0, 0.45)", x0, 0, x1 - x0, 1.5);
    rect(ctx, look.floorEdge, x0, 1.5, x1 - x0, 0.3);
    const runs = sc === "baths" ? [[3.4, 1.1], [6, 0.7]] : [[3.4, 0.55]];
    for (const [y, t] of runs) {
      ctx.fillStyle = IRON;
      ctx.fillRect(x0, y - t / 2, x1 - x0, t);
      ctx.fillStyle = IRON_LIT;
      ctx.fillRect(x0, y - t / 2, x1 - x0, t * 0.22);
      for (let x = Math.ceil(x0 / 24) * 24; x < x1; x += 24) {
        rect(ctx, "#3a4040", x - 0.5, y - t / 2 - 0.2, 1, t + 0.4);
        const h = hash(Math.round(x / 24), 7);
        if (h % 3 === 0) streak(ctx, x, y + t / 2, 5 + (h % 6), 0.35, RUST, 0.25);
        if (sc === "baths" && h % 2 === 0) {
          ctx.strokeStyle = IRON_LIT;
          ctx.lineWidth = 0.18;
          line(ctx, x, y - t / 2, x, y - t / 2 - 1.1);
          circle(ctx, x, y - t / 2 - 1.5, 0.7);
          ctx.stroke();
          line(ctx, x - 0.7, y - t / 2 - 1.5, x + 0.7, y - t / 2 - 1.5);
        }
      }
    }
  }

  // A room's whole wall from x0 to x1 (what ghoul-draw.js draws with a
  // `custom` look): the plaster and its stains, the tiled dado, the ceiling,
  // the windows, the room's own flourish, and the decor standing in front.
  function backdrop(ctx, v, look, x0, x1) {
    const { spec, g } = v;
    const H = g.FIELD_H;
    const sc = look.scene;
    const floorAt = (x) => {
      const gy = v.groundAt(spec, x);
      return H - (gy > -Infinity ? gy : 6);
    };
    ctx.fillStyle = linear(ctx, 0, 0, 0, H, [[0, look.wallTop], [1, look.wallLow]], look.wallLow);
    ctx.fillRect(x0, 0, x1 - x0, H);
    // Plaster, paint peeling from it in patches, damp rising and falling.
    ctx.fillStyle = look.paper;
    for (let x = Math.floor(x0 / 5) * 5; x < x1 + 5; x += 5) {
      const n = Math.round(x / 5);
      ctx.globalAlpha = 0.07 + (hash(n, 5) % 4) * 0.025;
      const tall = 20 + (hash(n, 9) % 8);
      ctx.fillRect(x, 3, 3.2, tall);
    }
    ctx.globalAlpha = 1;
    for (let x = Math.floor(x0 / 26) * 26; x < x1 + 26; x += 26) {
      const h = hash(Math.round(x / 26), 21);
      if (h % 3 === 0) {
        streak(ctx, x + (h % 11), 3, 14 + (h % 9), 1.6 + (h % 3) * 0.5, "#000000", 0.22);
      }
      if (h % 4 === 1) {
        // Paint lifting from the plaster: a ragged pale patch.
        const px = x + (h % 13);
        const py = 18 + (h % 7);
        poly(ctx, [px, py, px + 2.4, py - 0.6, px + 3.4, py + 1.4, px + 2.2, py + 3.6, px + 0.4, py + 2.8, px - 0.6, py + 1], "rgba(190, 200, 170, 0.07)");
      }
      if (h % 5 === 2) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 0.16;
        let cx = x + (h % 9);
        let cy = 3;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        for (let k = 0; k < 6; k++) {
          cx += ((hash(h, k) % 5) - 2) * 0.55;
          cy += 1.4 + (hash(k, h) % 3) * 0.5;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
    }
    ceiling(ctx, look, x0, x1);
    // The dado: glazed tile to the height of a man, a rail along its top.
    const dadoTop = 33;
    ctx.fillStyle = linear(ctx, 0, dadoTop, 0, H, [[0, look.wallLow], [1, look.wainscot]], look.wainscot);
    ctx.fillRect(x0, dadoTop, x1 - x0, H - dadoTop);
    tiles(ctx, x0, x1, dadoTop + 0.6, H, sc === "baths" ? 1.8 : 2.2, "rgba(255, 255, 255, 0.07)", 31);
    rect(ctx, look.floorEdge, x0, dadoTop - 0.4, x1 - x0, 0.5);
    rect(ctx, sc === "theater" ? "#7a8a5a" : sc === "baths" ? "#4aa0aa" : "#6a9a86", x0, dadoTop + 0.1, x1 - x0, 0.7);
    rect(ctx, "rgba(255, 255, 255, 0.18)", x0, dadoTop + 0.1, x1 - x0, 0.15);
    // Windows, every WINDOW_EVERY along.
    for (let x = Math.floor((x0 - WINDOW_AT - 6) / WINDOW_EVERY) * WINDOW_EVERY + WINDOW_AT; x < x1 + 16; x += WINDOW_EVERY) window(ctx, look, x, Math.round(x / WINDOW_EVERY));
    if (sc === "theater") observation(ctx, look, x0, x1);
    // Old stains soaked into the plaster: rust and brown.
    for (let x = Math.floor(x0 / 31) * 31; x < x1 + 31; x += 31) {
      const h = hash(Math.round(x / 31), 17);
      if (h % 4 === 0) streak(ctx, x + (h % 13), dadoTop + 1, 5 + (h % 9), 0.9, sc === "theater" ? BLOOD : RUST, 0.38);
    }
    // Paneling to the height of a man along each floor piece, the baseboard.
    for (const [a, b, top] of spec.ground) {
      if (b < x0 - 1 || a > x1 + 1) continue;
      const fy = H - top;
      const lo = Math.max(a, x0);
      const hi = Math.min(b, x1);
      rect(ctx, look.floorEdge, lo, fy - 1, hi - lo, 1);
      rect(ctx, "rgba(255, 255, 255, 0.07)", lo, fy - 1, hi - lo, 0.2);
    }
    for (const [x, n] of spots(v, x0, x1)) DECOR[look.decor]?.(ctx, look, x, floorAt(x), n);
  }

  // The surgical theater's gallery: recessed viewing boxes high in the wall
  // with pale faces looking down, taking notes.
  function observation(ctx, look, x0, x1) {
    for (let x = Math.floor((x0 - 8) / 22) * 22; x < x1 + 8; x += 22) {
      const n = Math.round(x / 22);
      if (hash(n, 4) % 3 === 0) continue;
      const bx = x + 3;
      rect(ctx, look.wainscot, bx - 0.5, 9.5, 11, 8);
      rect(ctx, "#050806", bx, 10, 10, 7);
      rect(ctx, rgba(look.window, 0.08), bx, 10, 10, 7);
      for (let k = 0; k < 2; k++) {
        if (hash(n, k + 12) % 4 === 0) continue;
        const fx = bx + 2.4 + k * 4.6;
        const fy = 13.4 + (hash(n, k) % 3) * 0.5;
        ctx.fillStyle = "#1c2420";
        ellipse(ctx, fx, fy + 3.8, 1.9, 2.4);
        ctx.fill();
        ctx.fillStyle = SKIN;
        ctx.globalAlpha = 0.75;
        ellipse(ctx, fx, fy, 0.8, 1.05);
        ctx.fill();
        ctx.globalAlpha = 1;
        rect(ctx, "#06080a", fx - 0.55, fy - 0.2, 0.35, 0.4);
        rect(ctx, "#06080a", fx + 0.2, fy - 0.2, 0.35, 0.4);
        // A notebook held up, a pen scratching.
        rect(ctx, "#b8b8a4", fx - 0.7 + (k ? 1.6 : -1.2), fy + 1.7, 1.5, 1.1);
      }
      rect(ctx, look.floorEdge, bx - 0.5, 17, 11, 0.7);
      rect(ctx, "#6a7468", bx - 0.8, 17.7, 11.6, 0.5);
    }
  }

  /* -------------------------------------------------------------- decor */

  // An iron bed frame standing against the wall: bars in the head and the
  // foot, a sagging spring mattress, a folded gray blanket.
  function ironBed(ctx, x, fy, w, sheet) {
    const hx = x - w / 2;
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.34;
    for (const px of [hx, hx + w]) line(ctx, px, fy, px, fy - (px === hx ? 7.4 : 5));
    ctx.lineWidth = 0.14;
    for (let k = 0.6; k < 3.4; k += 0.7) {
      line(ctx, hx + k * 0.0 + 0.2 + k * 0.0, fy - 3.6, hx + 0.2, fy - 3.6);
      line(ctx, hx + (k - 0.6) * 0.5, fy - 3.5, hx + (k - 0.6) * 0.5, fy - 7.0);
    }
    for (let k = 0; k < 4; k++) line(ctx, hx + w - 0.2 - k * 0.7, fy - 3.4, hx + w - 0.2 - k * 0.7, fy - 4.9);
    ctx.lineWidth = 0.3;
    line(ctx, hx, fy - 7.2, hx + 2.8, fy - 7.2);
    line(ctx, hx + w - 2.7, fy - 4.9, hx + w, fy - 4.9);
    ctx.strokeStyle = IRON_LIT;
    ctx.lineWidth = 0.1;
    line(ctx, hx + 0.12, fy - 7.4, hx + 0.12, fy);
    // Springs: a zig-zag under a sagging mattress.
    ctx.strokeStyle = RUST_DARK;
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    for (let k = 0; k <= 20; k++) ctx.lineTo(hx + 0.6 + (k / 20) * (w - 1.2), fy - 2.5 + (k % 2) * 0.5 + Math.sin((k / 20) * Math.PI) * 0.5);
    ctx.stroke();
    ctx.fillStyle = sheet || LINEN_DARK;
    ctx.beginPath();
    ctx.moveTo(hx + 0.4, fy - 2.5);
    ctx.quadraticCurveTo(x, fy - 1.4, hx + w - 0.4, fy - 2.5);
    ctx.lineTo(hx + w - 0.4, fy - 3.4);
    ctx.quadraticCurveTo(x, fy - 2.4, hx + 0.4, fy - 3.4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = STAIN;
    ctx.globalAlpha = 0.5;
    ellipse(ctx, x + 1.2, fy - 2.4, 1.2, 0.35);
    ctx.fill();
    ctx.globalAlpha = 1;
    // A pillow with a dent in it.
    ctx.fillStyle = LINEN;
    ellipse(ctx, hx + 1.9, fy - 3.7, 1.5, 0.55);
    ctx.fill();
  }

  // A wheelchair folded against the wall: two big wheels, a canvas seat.
  function wheelchair(ctx, x, fy) {
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.26;
    circle(ctx, x - 1, fy - 2.4, 2.4);
    ctx.stroke();
    ctx.lineWidth = 0.1;
    for (let k = 0; k < 8; k++) line(ctx, x - 1, fy - 2.4, x - 1 + Math.cos((k * TAU) / 8) * 2.4, fy - 2.4 + Math.sin((k * TAU) / 8) * 2.4);
    ctx.lineWidth = 0.3;
    circle(ctx, x + 2.6, fy - 0.6, 0.6);
    ctx.stroke();
    ctx.lineWidth = 0.34;
    ctx.beginPath();
    ctx.moveTo(x - 2.4, fy - 7);
    ctx.lineTo(x - 2.2, fy - 3.6);
    ctx.lineTo(x + 2.2, fy - 3.4);
    ctx.lineTo(x + 2.8, fy - 0.6);
    ctx.stroke();
    ctx.fillStyle = "#3a3a30";
    ctx.fillRect(x - 2.2, fy - 3.8, 4.4, 0.5);
    ctx.fillStyle = "#4a4a3a";
    ctx.fillRect(x - 2.6, fy - 6.8, 0.7, 3);
  }

  // A notice board: pinned papers, a faded red SILENCE, one corner curling.
  function noticeBoard(ctx, x, fy, n) {
    const top = fy - 17;
    rect(ctx, "#2a2218", x - 4.8, top, 9.6, 7.4);
    rect(ctx, "#6a5a3a", x - 4.4, top + 0.4, 8.8, 6.6);
    for (const [px, py, pw, ph, rot] of [[-3.8, 0.9, 3, 3.4, -0.04], [0.3, 1.2, 3.4, 2.6, 0.05], [-1.4, 4.2, 4.4, 2.2, 0.0]]) {
      ctx.save();
      ctx.translate(x + px + pw / 2, top + py + ph / 2);
      rotate(ctx, rot);
      rect(ctx, "#b8b49c", -pw / 2, -ph / 2, pw, ph);
      ctx.fillStyle = "#6a6a5a";
      for (let k = 0; k < 4; k++) ctx.fillRect(-pw / 2 + 0.3, -ph / 2 + 0.5 + k * (ph / 5), pw - 0.7 - (k % 2) * 0.8, 0.14);
      ctx.restore();
    }
    rect(ctx, "#8a2a24", x + 0.9, top + 1.6, 2.4, 0.5);
    ctx.fillStyle = "#a02a24";
    circle(ctx, x - 2.4, top + 1.1, 0.22);
    ctx.fill();
    circle(ctx, x + 2.6, top + 1.4, 0.22);
    ctx.fill();
    // A clock stopped at midnight beside it.
    ctx.strokeStyle = "#8a8a78";
    ctx.lineWidth = 0.3;
    circle(ctx, x + 8.4, top + 3.2, 1.8);
    ctx.stroke();
    ctx.fillStyle = "#d8d4c0";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.16;
    line(ctx, x + 8.4, top + 3.2, x + 8.4, top + 1.8);
    line(ctx, x + 8.4, top + 3.2, x + 8.4, top + 2.2);
  }

  function beds(ctx, look, x, fy, n) {
    const k = n % 3;
    if (k === 0) {
      ironBed(ctx, x + 6, fy, 11, LINEN_DARK);
      ironBed(ctx, x + 19, fy, 11, "#8a8478");
    } else if (k === 1) {
      noticeBoard(ctx, x + 8, fy, n);
      wheelchair(ctx, x + 20, fy);
    } else {
      wheelchair(ctx, x + 4, fy);
      ironBed(ctx, x + 18, fy, 11, LINEN_DARK);
    }
  }

  // A claw-foot tub's pipes and taps standing on the wall: a vertical pipe
  // with a gauge and a valve wheel, a rust ring at the flange.
  function pipes(ctx, look, x, fy, n) {
    const k = n % 2;
    const px = x + 4 + k * 8;
    ctx.fillStyle = IRON;
    ctx.fillRect(px - 0.7, 3, 1.4, fy - 3);
    ctx.fillStyle = IRON_LIT;
    ctx.fillRect(px - 0.7, 3, 0.3, fy - 3);
    for (const y of [10, 20, 29]) {
      rect(ctx, "#3a4242", px - 1.1, y, 2.2, 0.7);
      streak(ctx, px, y + 0.7, 5 + (hash(n, y) % 5), 0.6, RUST, 0.5);
    }
    // A gauge and a valve wheel.
    ctx.fillStyle = "#cfd4c4";
    circle(ctx, px + 2.6, 15, 1.3);
    ctx.fill();
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.25;
    circle(ctx, px + 2.6, 15, 1.3);
    ctx.stroke();
    ctx.lineWidth = 0.14;
    line(ctx, px + 2.6, 15, px + 3.2, 14.3);
    line(ctx, px + 0.7, 15, px + 1.4, 15);
    circle(ctx, px - 2.4, 24, 1.6);
    ctx.stroke();
    ctx.lineWidth = 0.18;
    line(ctx, px - 4, 24, px - 0.8, 24);
    line(ctx, px - 2.4, 22.4, px - 2.4, 25.6);
    line(ctx, px - 0.8, 24, px, 24);
    if (k === 0) {
      // A canvas hoist strap hanging from a ceiling rail, a hook at its end.
      ctx.fillStyle = "#8a8266";
      ctx.fillRect(px + 8, 3, 1.4, 14);
      ctx.fillStyle = "#6a644e";
      ctx.fillRect(px + 8, 17, 1.4, 0.8);
      ctx.strokeStyle = IRON_LIT;
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.arc(px + 8.7, 19, 0.9, -1.2, 2.6);
      ctx.stroke();
    } else {
      // A radiator under it, ribbed, rusted along the foot.
      for (let r = 0; r < 7; r++) rect(ctx, r % 2 ? "#4a5252" : "#5e6868", px + 3 + r * 0.9, fy - 8, 0.8, 6.4);
      rect(ctx, RUST_DARK, px + 3, fy - 1.6, 6.3, 0.5);
    }
  }

  // The surgical theater's great lamp on its boom over an operating table with
  // a draped shape; or an instrument cabinet and an anatomy chart.
  function lampDecor(ctx, look, x, fy, n) {
    if (n % 2 === 0) {
      const lx = x + 12;
      ctx.strokeStyle = IRON_LIT;
      ctx.lineWidth = 0.5;
      line(ctx, lx, 2, lx, 15);
      ctx.lineWidth = 0.4;
      line(ctx, lx, 15, lx + 4.4, 17);
      // The lamp: a broad disc with a ring of bulbs.
      ctx.fillStyle = "#3a4244";
      ellipse(ctx, lx + 5, 17.6, 5.6, 1.6);
      ctx.fill();
      ctx.fillStyle = "#5a6668";
      ellipse(ctx, lx + 5, 17.2, 5.6, 1.1);
      ctx.fill();
      ctx.fillStyle = LAMP;
      for (let k = 0; k < 7; k++) {
        circle(ctx, lx + 5 + (k - 3) * 1.45, 18.5, 0.42);
        ctx.fill();
      }
      ctx.fillStyle = rgba(LAMP, 0.07);
      poly(ctx, [lx, 19, lx + 10, 19, lx + 13, fy - 4, lx - 3, fy - 4]);
      ctx.fill();
      // The table and a shape under a sheet.
      ctx.fillStyle = IRON;
      ctx.fillRect(lx + 4.4, fy - 4, 1, 3.6);
      ctx.fillRect(lx + 2, fy - 0.8, 6, 0.6);
      rect(ctx, STEEL, lx - 2, fy - 4.4, 14, 0.7);
      ctx.fillStyle = LINEN;
      ctx.beginPath();
      ctx.moveTo(lx - 1.4, fy - 4.4);
      ctx.quadraticCurveTo(lx + 1, fy - 6.4, lx + 3, fy - 5.6);
      ctx.quadraticCurveTo(lx + 6, fy - 6.2, lx + 8, fy - 5);
      ctx.lineTo(lx + 11, fy - 4.4);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = STAIN;
      ctx.globalAlpha = 0.55;
      ellipse(ctx, lx + 5.2, fy - 5.2, 1.4, 0.5);
      ctx.fill();
      ctx.fillStyle = BLOOD;
      ellipse(ctx, lx + 3.4, fy - 5.4, 0.7, 0.35);
      ctx.fill();
      ctx.globalAlpha = 1;
      // An instrument tray on a stand.
      rect(ctx, IRON, lx + 14.2, fy - 5, 0.4, 5);
      rect(ctx, STEEL, lx + 12.4, fy - 5.2, 4, 0.5);
      ctx.fillStyle = STEEL_LIT;
      for (let k = 0; k < 4; k++) ctx.fillRect(lx + 12.8 + k * 0.9, fy - 5.9, 0.16, 0.7);
    } else {
      // A glass instrument cabinet and an anatomy chart.
      const cx = x + 4;
      rect(ctx, "#202826", cx - 0.4, fy - 15.4, 8.8, 15.4);
      rect(ctx, "#0a0f0d", cx, fy - 15, 8, 14.2);
      ctx.fillStyle = rgba(look.window, 0.1);
      ctx.fillRect(cx, fy - 15, 8, 14.2);
      for (const y of [-11, -7, -3]) {
        rect(ctx, "#4a5250", cx, fy + y, 8, 0.3);
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = (k + n) % 2 ? STEEL : "#6a7a72";
          ctx.fillRect(cx + 0.7 + k * 1.5, fy + y - 1.8, 0.5 + (k % 2) * 0.3, 1.8);
        }
      }
      ctx.strokeStyle = rgba(STEEL_LIT, 0.25);
      ctx.lineWidth = 0.14;
      line(ctx, cx + 1, fy - 14.6, cx + 3.4, fy - 11);
      const px = x + 17;
      rect(ctx, "#8a8668", px, fy - 20, 6.4, 9);
      rect(ctx, "#a8a488", px + 0.3, fy - 19.7, 5.8, 8.4);
      ctx.fillStyle = "#8a2a24";
      ellipse(ctx, px + 3.2, fy - 15.6, 0.9, 1.5);
      ctx.fill();
      ctx.strokeStyle = "#5a2a24";
      ctx.lineWidth = 0.12;
      line(ctx, px + 3.2, fy - 17.4, px + 3.2, fy - 13.6);
      line(ctx, px + 1.4, fy - 16, px + 5, fy - 16);
    }
  }

  // The ward: iron beds in a row, a curtain rail, a night light on the wall
  // and a chart board at the foot of one.
  function wardBeds(ctx, look, x, fy, n) {
    const k = n % 2;
    if (k === 0) {
      ironBed(ctx, x + 6, fy, 11, LINEN);
      ironBed(ctx, x + 19, fy, 11, "#a8aca0");
      rect(ctx, "#4a5250", x + 11.6, fy - 4.2, 1.6, 4.2);
    } else {
      ironBed(ctx, x + 8, fy, 11, "#a8aca0");
      ctx.strokeStyle = "#7a8280";
      ctx.lineWidth = 0.2;
      line(ctx, x + 14, 15, x + 28, 15);
      ctx.fillStyle = "rgba(180, 196, 188, 0.35)";
      for (let c = 0; c < 6; c++) {
        ctx.beginPath();
        ctx.moveTo(x + 14.4 + c * 2.3, 15);
        ctx.quadraticCurveTo(x + 15.2 + c * 2.3, 24, x + 14.4 + c * 2.3 + (c % 2) * 0.6, fy - 4);
        ctx.lineTo(x + 15.8 + c * 2.3, fy - 4);
        ctx.quadraticCurveTo(x + 15.6 + c * 2.3, 24, x + 15.6 + c * 2.3, 15);
        ctx.closePath();
        ctx.fill();
      }
    }
    // A night light on the wall: a green glass dome, its light leaking.
    ctx.fillStyle = "#3a4442";
    ctx.fillRect(x + 26.8, 17.2, 2.4, 0.8);
    ctx.fillStyle = "#8ae0b8";
    ellipse(ctx, x + 28, 17, 1.1, 0.9);
    ctx.fill();
    halo(ctx, x + 28, 18, 3.6, "#8ae0b8", 0.12);
  }

  const DECOR = { beds, pipes, lamp: lampDecor, wardbeds: wardBeds };

  /* ------------------------------------------------- floor and boards */

  // The raised floor blocks of the ward are its medicine cabinets: a steel
  // frame, glass doors, shelves of bottles and a cross, a keyhole.
  function cabinet(ctx, v, look, a, b, top) {
    const H = v.g.FIELD_H;
    const fy = H - top;
    const h = top - 6;
    const w = b - a;
    rect(ctx, "#9aa49e", a, fy, w, h);
    rect(ctx, "#6a746e", a, fy, w, 0.7);
    rect(ctx, STEEL_LIT, a, fy, w, 0.16);
    const inner = [a + 0.5, fy + 0.9, w - 1, h - 1.2];
    rect(ctx, "#0a100e", ...inner);
    for (let s = 0; s < 2; s++) {
      const dx = inner[0] + s * (inner[2] / 2);
      const dw = inner[2] / 2;
      ctx.fillStyle = linear(ctx, dx, inner[1], dx + dw, inner[1] + inner[3], [[0, rgba(look.window, 0.32)], [1, rgba(look.window, 0.08)]], rgba(look.window, 0.2));
      ctx.fillRect(dx, inner[1], dw, inner[3]);
      // Two shelves of bottles behind the glass.
      for (let row = 0; row < 2; row++) {
        const sy = inner[1] + (row + 1) * (inner[3] / 2) - 0.2;
        rect(ctx, "#4a544e", dx + 0.1, sy, dw - 0.2, 0.2);
        for (let k = 0; k < 4; k++) {
          const hh = hash(s * 9 + k, row + Math.round(a));
          ctx.fillStyle = ["#6a9a62", "#b0803a", "#5a7aa0", "#8a5a62", "#c8c4a0"][hh % 5];
          ctx.globalAlpha = 0.85;
          const bh = 0.9 + (hh % 3) * 0.25;
          ctx.fillRect(dx + 0.35 + k * ((dw - 0.7) / 4), sy - bh, 0.5, bh);
          ctx.fillRect(dx + 0.42 + k * ((dw - 0.7) / 4), sy - bh - 0.2, 0.36, 0.2);
        }
        ctx.globalAlpha = 1;
      }
      // The glass catches a streak of light.
      ctx.strokeStyle = rgba(STEEL_LIT, 0.35);
      ctx.lineWidth = 0.14;
      line(ctx, dx + dw * 0.2, inner[1] + 0.3, dx + dw * 0.8, inner[1] + inner[3] * 0.6);
      rect(ctx, "#6a746e", dx - 0.1, inner[1], 0.2, inner[3]);
    }
    rect(ctx, "#6a746e", inner[0] + inner[2] / 2 - 0.1, inner[1], 0.2, inner[3]);
    ctx.fillStyle = "#b8483e";
    ctx.fillRect(a + w / 2 - 0.1, fy + 0.18, 0.2, 0.5);
    ctx.fillRect(a + w / 2 - 0.25, fy + 0.33, 0.5, 0.2);
    ctx.fillStyle = STEEL_LIT;
    circle(ctx, a + w / 2 + 0.5, fy + h - 0.3, 0.14);
    ctx.fill();
    rect(ctx, look.floorEdge, a, fy, 0.25, h);
    rect(ctx, look.floorEdge, b - 0.25, fy, 0.25, h);
  }

  // A claw-foot tub sunk in the floor between two pieces: an enamel rim on
  // each side, the dark of the water in it. The water moves (see front()).
  function tub(ctx, v, look, a, b, topL, topR) {
    const H = v.g.FIELD_H;
    const w = b - a;
    const rimY = H - Math.max(topL, topR);
    rect(ctx, "#05100f", a, rimY, w, H);
    ctx.fillStyle = linear(ctx, 0, rimY, 0, rimY + 14, [[0, "#15302e"], [1, "#030808"]], "#0a1c1a");
    ctx.fillRect(a, rimY + 1.4, w, H);
    // Enamel walls inside, shaded.
    ctx.fillStyle = linear(ctx, a, 0, b, 0, [[0, "#9aa8a2"], [0.15, "#d6e0da"], [0.3, "#2a3836"], [0.7, "#2a3836"], [0.85, "#c0ccc6"], [1, "#8a9892"]], "#7a8a84");
    ctx.fillRect(a, rimY + 0.4, w, 1.2);
    // The rims, rolled over each side, chipped and rust-spotted.
    for (const [rx, rw] of [[a - 1, 2.2], [b - 1.2, 2.2]]) {
      ctx.fillStyle = "#e4ebe6";
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(rx, rimY - 0.2, rw, 1.3, 0.55) : ctx.rect(rx, rimY - 0.2, rw, 1.3);
      ctx.fill();
      rect(ctx, "#a8b4ae", rx, rimY + 0.7, rw, 0.4);
    }
    ctx.fillStyle = RUST;
    ctx.globalAlpha = 0.7;
    circle(ctx, a + 0.4, rimY + 0.3, 0.2);
    ctx.fill();
    circle(ctx, b - 0.5, rimY + 0.5, 0.16);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // What a floor piece (a, b, top) is paved in over the plain one: green-gray
  // tile in big squares, cracked and stained; a drain now and then; in the
  // baths the tubs it borders; in the ward its cabinets.
  function ground(ctx, v, look, a, b, top) {
    const fy = v.g.FIELD_H - top;
    const sc = look.scene;
    if (sc === "ward" && top - 6 > 3 && b - a < 14) return cabinet(ctx, v, look, a, b, top);
    const [lo, hi] = reach(ctx, a, b);
    if (hi <= lo) return;
    const size = sc === "baths" ? 2.4 : 4;
    const depth = Math.min(top, 5);
    // The generic pit is black from five above the floor: wall over that part.
    const next = v.spec.ground[v.spec.ground.findIndex((p) => p[0] === a && p[1] === b) + 1];
    if (next && next[0] > b) {
      const hi2 = v.g.FIELD_H - Math.max(top, next[2]);
      ctx.fillStyle = look.wallLow;
      ctx.fillRect(b, hi2 - 5.4, next[0] - b, 5.4);
      tiles(ctx, b, next[0], hi2 - 5.4, hi2, sc === "baths" ? 1.8 : 2.2, "rgba(255, 255, 255, 0.07)", 31);
    }
    for (let x = Math.floor(lo / size) * size, c = 0; x < hi; x += size, c++) {
      const n = Math.round(x / size);
      if ((n + (sc === "ward" ? 0 : Math.floor(top))) % 2) rect(ctx, "rgba(255, 255, 255, 0.06)", x, fy, size, 1.1);
      else rect(ctx, "rgba(0, 0, 0, 0.12)", x, fy, size, 1.1);
      rect(ctx, "rgba(0, 0, 0, 0.4)", x, fy, 0.12, depth);
    }
    for (let y = fy + 1.1; y < fy + depth; y += 1.4) rect(ctx, "rgba(0, 0, 0, 0.3)", lo, y, hi - lo, 0.12);
    // Cracks through the tile, a drain, a dark stain.
    for (let x = Math.ceil(lo / 29) * 29; x < hi; x += 29) {
      const h = hash(Math.round(x / 29), 5);
      if (h % 3 === 0) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
        ctx.lineWidth = 0.14;
        ctx.beginPath();
        ctx.moveTo(x, fy);
        ctx.lineTo(x + 0.5, fy + 0.5);
        ctx.lineTo(x + 0.1, fy + 1.1);
        ctx.lineTo(x + 0.9, fy + 2.4);
        ctx.stroke();
      } else if (h % 3 === 1) {
        ctx.fillStyle = sc === "theater" ? rgba(BLOOD, 0.5) : rgba(RUST_DARK, 0.5);
        ellipse(ctx, x + 1, fy + 0.4, 1.6 + (h % 3) * 0.5, 0.3);
        ctx.fill();
      } else if (sc !== "ward") {
        ctx.fillStyle = "#0a0f0e";
        ctx.fillRect(x, fy + 0.15, 2, 0.5);
        ctx.fillStyle = "#4a5450";
        for (let k = 0; k < 4; k++) ctx.fillRect(x + 0.2 + k * 0.45, fy + 0.2, 0.18, 0.4);
      }
    }
    // The tubs: for a piece with a gap right of it, if this room's baths.
    if (sc === "baths") {
      const pieces = v.spec.ground;
      const i = pieces.findIndex((p) => p[0] === a && p[1] === b);
      const next = pieces[i + 1];
      if (next && next[0] > b) tub(ctx, v, look, b, next[0], top, next[2]);
    }
  }

  // A board from a to b with its top at y. The admissions' are waiting
  // benches and the reception desk, the baths' tiled ledges, the theater's
  // gallery tiers with a brass rail, the ward's iron beds.
  function shelf(ctx, v, look, a, b, y) {
    const [lo, hi] = reach(ctx, a, b);
    if (hi <= lo) return;
    const w = b - a;
    const sc = look.scene;
    const floor = v.g.FIELD_H - v.groundAt(v.spec, (a + b) / 2);
    const drop = floor - y;
    if (sc === "baths") {
      ctx.fillStyle = "#d6dcd4";
      ctx.fillRect(a, y, w, 2.4);
      ctx.fillStyle = "#e8eee8";
      ctx.fillRect(a, y, w, 0.4);
      ctx.fillStyle = "#4aa0aa";
      ctx.fillRect(a, y + 1.9, w, 0.5);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      for (let x = Math.ceil(a / 2) * 2; x < b; x += 2) {
        ctx.moveTo(x, y + 0.4);
        ctx.lineTo(x, y + 1.9);
      }
      ctx.moveTo(a, y + 1.2);
      ctx.lineTo(b, y + 1.2);
      ctx.stroke();
      ctx.fillStyle = IRON;
      for (const bx of [a + 1.2, b - 2.2]) {
        ctx.fillRect(bx, y + 2.4, 1, 0.5);
        ctx.fillRect(bx + 0.3, y + 2.4, 0.4, 1.4);
      }
      ctx.fillStyle = rgba(RUST, 0.6);
      ctx.fillRect(a + w * 0.4, y + 0.4, 0.3, 1.5);
    } else if (sc === "theater") {
      ctx.fillStyle = "#3a2618";
      ctx.fillRect(a, y, w, 1.2);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(a, y, w, 0.4);
      ctx.fillStyle = "#24160c";
      ctx.fillRect(a, y + 1.2, w, 1.8);
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      for (let x = Math.ceil(a / 3) * 3; x < b; x += 3) ctx.fillRect(x, y + 1.4, 0.14, 1.4);
      // A brass rail on posts.
      ctx.strokeStyle = "#c8a850";
      ctx.lineWidth = 0.22;
      line(ctx, a + 0.4, y - 1.7, b - 0.4, y - 1.7);
      ctx.lineWidth = 0.18;
      for (let x = a + 0.4; x <= b - 0.3; x += 4) line(ctx, x, y - 1.7, x, y);
      ctx.fillStyle = "#fff0a8";
      ctx.fillRect(a + 0.4, y - 1.8, w - 0.8, 0.08);
    } else if (sc === "ward") {
      // A bed: a gray mattress with a folded sheet, a pillow, the iron head.
      ctx.fillStyle = "#4a5250";
      ctx.fillRect(a, y + 1.5, w, 0.4);
      ctx.strokeStyle = RUST_DARK;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      for (let k = 0; k <= w * 2; k++) ctx.lineTo(a + k * 0.5, y + 1.9 + (k % 2) * 0.5);
      ctx.stroke();
      ctx.fillStyle = "#9aa098";
      ctx.fillRect(a, y, w, 1.5);
      ctx.fillStyle = LINEN;
      ctx.fillRect(a, y, w, 0.5);
      ctx.fillStyle = "#c8ccc0";
      ctx.fillRect(a + 2.4, y - 0.1, w - 2.4, 0.6);
      ctx.fillStyle = LINEN_LIT;
      ellipse(ctx, a + 1.5, y - 0.1, 1.4, 0.55);
      ctx.fill();
      ctx.fillStyle = STAIN;
      ctx.globalAlpha = 0.45;
      ellipse(ctx, a + w * 0.6, y + 0.4, 1.1, 0.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = IRON;
      ctx.lineWidth = 0.3;
      line(ctx, a + 0.15, y - 2.8, a + 0.15, y + 3.2);
      line(ctx, b - 0.15, y - 1.4, b - 0.15, y + 3.2);
      ctx.lineWidth = 0.12;
      for (let k = 0.7; k < 2.6; k += 0.7) line(ctx, a + 0.15 + k * 0.0 + 0.0, y - 2.8 + k, a + 0.15, y - 2.8 + k);
      line(ctx, a + 0.15, y - 2.8, a + 2.2, y - 2.8);
    } else if (w >= 24 && drop <= 9) {
      // The reception desk: a counter with a front of panels, a brass bell.
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(a, y, w, Math.max(drop, 3));
      ctx.fillStyle = "#4a3422";
      for (let x = a + 0.6; x < b - 1.5; x += 3.6) ctx.fillRect(x, y + 1.2, 3, Math.max(drop, 3) - 1.8);
      ctx.fillStyle = "#6a4c30";
      for (let x = a + 0.6; x < b - 1.5; x += 3.6) ctx.fillRect(x, y + 1.2, 3, 0.14);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(a - 0.4, y, w + 0.8, 0.7);
      ctx.fillStyle = "#b09c78";
      ctx.fillRect(a - 0.4, y, w + 0.8, 0.16);
      // A bell and a ledger; a sign of what visiting is not allowed.
      ctx.fillStyle = "#c8a850";
      ellipse(ctx, a + 4, y - 0.15, 0.7, 0.35);
      ctx.fill();
      circle(ctx, a + 4, y - 0.5, 0.2);
      ctx.fill();
      rect(ctx, "#6a5a3a", a + w - 6, y - 0.5, 3, 0.5);
      rect(ctx, "#b8b49c", a + w - 5.8, y - 0.7, 2.6, 0.3);
    } else if (w >= 24) {
      // A filing ledge: a steel shelf on brackets with a row of boxes.
      ctx.fillStyle = "#5a6662";
      ctx.fillRect(a, y, w, 0.9);
      ctx.fillStyle = STEEL;
      ctx.fillRect(a, y, w, 0.2);
      ctx.fillStyle = IRON;
      for (const bx of [a + 1, a + w / 2, b - 2]) {
        ctx.fillRect(bx, y + 0.9, 0.5, 2.4);
        ctx.fillRect(bx, y + 3, 1.6, 0.4);
      }
      for (let x = a + 3; x < b - 4; x += 4.6) {
        const hh = hash(Math.round(x), 8);
        ctx.fillStyle = hh % 2 ? "#6a644a" : "#7a7258";
        ctx.fillRect(x, y - 1.6 - (hh % 3) * 0.3, 3.6, 1.6);
      }
    } else {
      // A waiting bench: a plank seat, a slatted back, iron ends.
      ctx.fillStyle = look.shelf;
      ctx.fillRect(a, y, w, 0.9);
      ctx.fillStyle = look.shelfTop;
      ctx.fillRect(a, y, w, 0.25);
      ctx.fillStyle = "#3a2c1e";
      for (let k = 0; k < 2; k++) ctx.fillRect(a + 0.4, y - 2.8 + k * 1.1, w - 0.8, 0.7);
      ctx.fillStyle = IRON;
      ctx.fillRect(a + 0.4, y - 3, 0.5, 3.5);
      ctx.fillRect(b - 0.9, y - 3, 0.5, 3.5);
      const leg = Math.min(drop, 6);
      for (const bx of [a + 1, b - 2.2]) {
        ctx.fillRect(bx, y + 0.9, 1.2, 0.5);
        ctx.fillRect(bx + 0.3, y + 0.9, 0.6, leg - 0.9);
        ctx.fillRect(bx - 0.3, y + leg - 0.3, 1.8, 0.3);
      }
    }
    // A shadow under every board.
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.fillRect(a, y + 3.4, w, 0.5);
  }

  /* ----------------------------------------------------------- monsters */

  // A rubber glove at (x, y) in a y-up frame: open (fingers fanned toward `a`)
  // or a fist; `s` the size.
  function hand(ctx, x, y, a, open, s, flash) {
    const skin = flash ? FLASH : GLOVE;
    const dark = flash ? FLASH : GLOVE_DARK;
    ctx.fillStyle = skin;
    ellipse(ctx, x, y, 0.62 * s, 0.5 * s, a);
    ctx.fill();
    ctx.strokeStyle = skin;
    ctx.lineCap = "round";
    if (open) {
      ctx.lineWidth = 0.22 * s;
      for (let k = -1.5; k <= 1.5; k++) {
        const fa = a + k * 0.3;
        const len = (k === -1.5 || k === 1.5 ? 0.8 : 1.15) * s;
        line(ctx, x + Math.cos(a) * 0.4 * s, y + Math.sin(a) * 0.4 * s, x + Math.cos(fa) * (0.5 * s + len), y + Math.sin(fa) * (0.5 * s + len));
      }
    } else {
      ctx.fillStyle = dark;
      for (let k = -1; k <= 1; k++) {
        circle(ctx, x + Math.cos(a) * 0.55 * s - Math.sin(a) * k * 0.3 * s, y + Math.sin(a) * 0.55 * s + Math.cos(a) * k * 0.3 * s, 0.24 * s);
        ctx.fill();
      }
    }
  }

  // The orderly: a huge attendant in yellowed whites, a flat cap, a surgical
  // mask over a blank face, arms down to his knees in rubber gloves, a belt of
  // keys and leather straps. `walk` lumbers with the arms swinging low,
  // `reach` lifts an arm toward you over ORDERLY_REACH_MS, `hold` has it
  // clamped on Planny (the fingers come over him in front()), `rest` slumps.
  function orderly(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const you = v.round.you;
    const reaching = m.act === "reach";
    const holding = m.act === "hold";
    const resting = m.act === "rest";
    const p = reaching ? clamp(1 - m.wait / ORDERLY_REACH_MS, 0, 1) : holding ? 1 : 0;
    const stride = m.act === "walk" || m.act === undefined ? Math.sin(t / 240) : 0;
    const bob = Math.abs(stride) * 0.12;
    const white = flash ? FLASH : "#d6d8c8";
    const shade = flash ? FLASH : "#9ea294";
    const dark = flash ? FLASH : "#6a6e60";
    const slump = resting ? 0.25 + Math.sin(t / 380) * 0.04 : 0;
    // Where the grasping hand goes: ahead, rising to chest height, then to Planny.
    let tx = lerp(1.6, 4.2, ease(p));
    let ty = lerp(1.2, 5.6, ease(p));
    if (holding) {
      tx = (you.x - m.x) * dir;
      ty = you.y + 2.3 - m.y;
    } else if (reaching) {
      const gx = (you.x - m.x) * dir;
      tx = lerp(tx, clamp(gx, 2.5, 6.4), ease(p) * 0.7);
    }
    framed(ctx, x, y, dir, () => {
      // Legs: heavy trousers, black shoes.
      for (const s of [-1, 1]) {
        const sw = stride * s * 0.7;
        ctx.fillStyle = shade;
        poly(ctx, [-0.2 + s * 0.15 + sw * 0.4, 3.6, 1.55 + s * 0.15 + sw * 0.4, 3.6, 1.4 + sw, 0.5, -0.1 + sw, 0.5]);
        ctx.fill();
        ctx.fillStyle = flash ? FLASH : "#16181a";
        ellipse(ctx, 0.7 + sw + 0.4, 0.3, 1.1, 0.4);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(0, bob);
      rotate(ctx, -slump);
      // The back arm hangs behind, swinging against the stride.
      const back = holding ? [-0.5, 1.2] : [-0.6 - stride * 1.4, 1.1 + Math.abs(stride) * 0.3];
      limb(ctx, -0.5, 6.1, back[0] - 0.4, back[1], 3.1, 3.3, 1, 1.15, 0.85, dark, dark);
      hand(ctx, back[0] - 0.4, back[1] - 0.2, -1.6, false, 1.15, flash);
      // The tunic: broad shoulders, a body that tapers to a belted waist, the
      // hem over the trousers; yellowed, with old stains.
      ctx.fillStyle = white;
      poly(ctx, [-2.1, 6.4, -1.6, 6.9, 1.7, 6.9, 2.3, 6.4, 1.8, 3.4, 1.9, 2.5, -1.7, 2.5, -1.6, 3.4]);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        poly(ctx, [-2.1, 6.4, -1.6, 6.9, -0.4, 6.9, -0.7, 2.5, -1.7, 2.5, -1.6, 3.4]);
        ctx.fill();
        ctx.fillStyle = rgba(STAIN, 0.55);
        ellipse(ctx, 0.8, 4.6, 0.7, 1.1, 0.3);
        ctx.fill();
        ctx.fillStyle = rgba(BLOOD, 0.55);
        ellipse(ctx, 0.2, 3.5, 0.9, 0.5);
        ctx.fill();
        circle(ctx, 1.2, 5.6, 0.22);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 0.1;
        line(ctx, 0, 6.5, 0, 3.4);
        for (const by of [6, 5.2, 4.4]) circle(ctx, 0.25, by, 0.1);
        ctx.fillStyle = "#26282a";
        ctx.fillRect(-1.75, 3.1, 3.7, 0.5);
        ctx.fillStyle = "#8a7a4a";
        ctx.fillRect(0.1, 3.05, 0.7, 0.6);
        // Keys on a ring and straps with buckles hanging from the belt.
        ctx.strokeStyle = "#c8b060";
        ctx.lineWidth = 0.14;
        circle(ctx, -1.3, 2.7, 0.35);
        ctx.stroke();
        ctx.fillStyle = "#c8b060";
        for (let k = 0; k < 3; k++) ctx.fillRect(-1.55 + k * 0.28, 2.0 - k * 0.1, 0.18, 0.55);
        ctx.fillStyle = "#3a2c20";
        ctx.fillRect(-0.4, 1.6, 0.35, 1.5);
        ctx.fillRect(0.2, 1.9, 0.35, 1.2);
        ctx.fillStyle = "#b0b4a8";
        ctx.fillRect(-0.42, 1.55, 0.4, 0.3);
      }
      // The head: small on all that, a cap, a mask, the eyes slits of dark.
      ctx.fillStyle = flash ? FLASH : SKIN;
      ellipse(ctx, 0.35, 7.5 - slump * 2, 0.95, 1.05);
      ctx.fill();
      ctx.fillStyle = white;
      ctx.beginPath();
      ctx.moveTo(-0.7, 7.85 - slump * 2);
      ctx.quadraticCurveTo(0.2, 9.15 - slump * 2, 1.4, 7.9 - slump * 2);
      ctx.lineTo(1.3, 7.7 - slump * 2);
      ctx.lineTo(-0.6, 7.7 - slump * 2);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#b8d0c4";
        poly(ctx, [-0.35, 7.5 - slump * 2, 1.3, 7.5 - slump * 2, 1.15, 6.55 - slump * 2, -0.15, 6.55 - slump * 2]);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 0.08;
        for (const k of [0.2, 0.45, 0.7]) line(ctx, -0.3, 6.55 - slump * 2 + k, 1.2, 6.55 - slump * 2 + k);
        ctx.fillStyle = INK;
        ctx.fillRect(0.5, 7.75 - slump * 2, 0.55, 0.14);
        ctx.fillRect(-0.12, 7.75 - slump * 2, 0.4, 0.14);
      }
      // The front arm: swinging, reaching, or clamped.
      const front = reaching || holding ? [tx, ty] : [1.4 + stride * 1.2, 1.2 + Math.abs(stride) * 0.3];
      limb(ctx, 0.9, 6.2, front[0], front[1], 3.2, 3.4, reaching || holding ? 1 : 1, 1.25, 0.9, white, shade);
      hand(ctx, front[0], front[1], reaching || holding ? Math.atan2(ty - 5, tx - 1) : -1.3, reaching && !holding, 1.2, flash);
      // The cuff.
      ctx.restore();
    });
    if (flash) return;
    eye(v, x + dir * 0.9, y - 7.8 + slump * 2, 0.1, "#8aa8a0");
  }

  // A gurney: a rusty hospital cart on four casters with a sheet over a
  // lump, a hand slipped out from under it. Parked it sits quiet; rattling it
  // shakes and the hand twitches; rolling the wheels turn, the sheet streams
  // back, sparks fly and the motion rolls off it in lines; resting it
  // coasts to a stop.
  function gurney(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const rattle = m.act === "rattle";
    const rolling = m.act === "roll";
    const coast = m.act === "rest" ? clamp(m.wait / 700, 0, 1) : 0;
    const shake = rattle ? Math.sin(t / 14) * 0.13 * (1 + clamp(1 - m.wait / GURNEY_RATTLE_MS, 0, 1)) : rolling ? Math.sin(t / 22) * 0.05 : 0;
    const spin = rolling ? t / 32 : m.act === "rest" ? t / (60 + (1 - coast) * 600) : rattle ? Math.sin(t / 18) * 0.5 : 0;
    const metal = flash ? FLASH : "#7a8280";
    const rust = flash ? FLASH : RUST;
    if (rolling && !flash) {
      // Motion rolling off it in lines, dust under the casters.
      for (let k = 0; k < 4; k++) {
        const q = ((t / 140 + k * 0.27) % 1);
        ctx.strokeStyle = rgba(LINEN, (1 - q) * 0.45);
        ctx.lineWidth = 0.14;
        const yy = y - 0.8 - k * 0.65;
        line(ctx, x - dir * (3.8 + q * 3.2), yy, x - dir * (6 + q * 5.5), yy);
      }
      for (let k = 0; k < 5; k++) {
        const q = ((t / 190 + k * 0.2) % 1);
        ctx.fillStyle = rgba("#8a8a78", (1 - q) * 0.4);
        circle(ctx, x - dir * (2 + q * 4.5), y - 0.2 - q * 0.7, 0.35 + q * 0.5);
        ctx.fill();
      }
      ctx.fillStyle = FLAME;
      for (let k = 0; k < 3; k++) {
        const q = ((t / 90 + k * 0.33) % 1);
        ctx.globalAlpha = 1 - q;
        ctx.fillRect(x - dir * (2.6 + q * 1.6), y - 0.35 - q * 0.8 - k * 0.1, 0.18, 0.18);
      }
      ctx.globalAlpha = 1;
    }
    framed(ctx, x + shake, y, dir, () => {
      ctx.lineCap = "round";
      // Casters and legs: an X-brace under the frame.
      ctx.strokeStyle = flash ? FLASH : IRON;
      ctx.lineWidth = 0.22;
      line(ctx, -2.6, 1.45, 2.6, 0.6);
      line(ctx, 2.6, 1.45, -2.6, 0.6);
      for (const wx of [-2.7, 2.7]) {
        ctx.strokeStyle = metal;
        ctx.lineWidth = 0.26;
        line(ctx, wx, 1.5, wx, 0.65);
        ctx.fillStyle = flash ? FLASH : "#16181a";
        circle(ctx, wx, 0.55, 0.55);
        ctx.fill();
        ctx.strokeStyle = flash ? FLASH : "#7a8280";
        ctx.lineWidth = 0.1;
        for (let k = 0; k < 3; k++) line(ctx, wx + Math.cos(spin + (k * Math.PI) / 3) * 0.5, 0.55 + Math.sin(spin + (k * Math.PI) / 3) * 0.5, wx - Math.cos(spin + (k * Math.PI) / 3) * 0.5, 0.55 - Math.sin(spin + (k * Math.PI) / 3) * 0.5);
        ctx.fillStyle = flash ? FLASH : "#aab0ac";
        circle(ctx, wx, 0.55, 0.14);
        ctx.fill();
      }
      // The frame and its rusted rails, the push bar at the foot.
      ctx.fillStyle = metal;
      ctx.fillRect(-3.4, 1.3, 6.8, 0.38);
      ctx.fillStyle = flash ? FLASH : STEEL;
      ctx.fillRect(-3.4, 1.62, 6.8, 0.08);
      ctx.strokeStyle = metal;
      ctx.lineWidth = 0.22;
      ctx.beginPath();
      ctx.moveTo(-3.3, 1.5);
      ctx.lineTo(-3.5, 2.6);
      ctx.lineTo(-3.5, 2.78);
      ctx.stroke();
      if (!flash) {
        ctx.fillStyle = rgba(rust, 0.7);
        for (const [rx, rw] of [[-2.8, 1.1], [0.3, 0.7], [2.2, 0.9]]) ctx.fillRect(rx, 1.3, rw, 0.38);
        ctx.fillStyle = rgba(RUST_DARK, 0.8);
        circle(ctx, -2.7, 1.1, 0.16);
        ctx.fill();
      }
      // The mattress, thin and stained, and a sheet over it.
      ctx.fillStyle = flash ? FLASH : "#6a6a58";
      ctx.fillRect(-3.3, 1.7, 6.6, 0.45);
      const wave = rolling ? Math.sin(t / 60) * 0.18 : rattle ? Math.sin(t / 25) * 0.12 : Math.sin(t / 700) * 0.03;
      ctx.fillStyle = flash ? FLASH : LINEN;
      ctx.beginPath();
      ctx.moveTo(-3.4, 2.15);
      ctx.quadraticCurveTo(-3.1, 2.95 + wave, -2.1, 2.7);
      ctx.quadraticCurveTo(-0.9, 2.5 + wave, 0.2, 2.75);
      ctx.quadraticCurveTo(1.4, 3.05, 2.4, 2.55 - wave);
      ctx.lineTo(3.4, 2.15);
      ctx.lineTo(3.3, 1.35);
      // The hem hangs in folds along the near side.
      for (let k = 6; k >= 0; k--) ctx.lineTo(-3.3 + k * 1.1, 1.4 + (k % 2) * 0.2 + (rolling ? Math.sin(t / 50 + k) * 0.08 : 0));
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
        ctx.beginPath();
        ctx.moveTo(-3.3, 1.5);
        ctx.lineTo(-3.4, 2.15);
        ctx.quadraticCurveTo(-3.1, 2.95 + wave, -2.1, 2.7);
        ctx.lineTo(-2.1, 1.45);
        ctx.closePath();
        ctx.fill();
        // The lump of a body under it: head and knees.
        ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
        ellipse(ctx, -2.4, 2.9 + wave, 0.75, 0.55);
        ctx.fill();
        ctx.fillStyle = rgba(STAIN, 0.65);
        ellipse(ctx, 0.6, 2.35, 0.95, 0.38, 0.1);
        ctx.fill();
        ctx.fillStyle = rgba(BLOOD, 0.7);
        ellipse(ctx, -1.4, 2.5, 0.55, 0.3);
        ctx.fill();
        circle(ctx, 1.9, 2.25, 0.2);
        ctx.fill();
        // Leather straps across it with buckles.
        ctx.fillStyle = "#3a2c20";
        for (const sx of [-0.9, 1.5]) ctx.fillRect(sx, 1.4, 0.4, 1.5);
        ctx.fillStyle = "#b0b4a8";
        for (const sx of [-0.9, 1.5]) ctx.fillRect(sx - 0.05, 2.5, 0.5, 0.25);
        // A pale hand slipped out from under the sheet, swaying.
        const sway = rattle ? Math.sin(t / 16) * 0.5 : rolling ? Math.sin(t / 45) * 0.35 : Math.sin(t / 900) * 0.07;
        ctx.strokeStyle = SKIN;
        ctx.lineWidth = 0.34;
        ctx.beginPath();
        ctx.moveTo(2.9, 1.9);
        ctx.quadraticCurveTo(3.1 + sway * 0.5, 1.2, 3.0 + sway, 0.7);
        ctx.stroke();
        ctx.fillStyle = SKIN;
        ellipse(ctx, 3.0 + sway, 0.55, 0.22, 0.34, sway * 0.3);
        ctx.fill();
        ctx.lineWidth = 0.1;
        for (let k = -1; k <= 1; k++) line(ctx, 3.0 + sway + k * 0.12, 0.35, 3.0 + sway + k * 0.2 + sway * 0.3, 0.05);
      }
    });
  }

  // How a flicker looked last frame: its opacity eases to full when it shows
  // and fades out over about half a second when it does not, so there is an
  // afterimage of it going; a faint trace is all that stays.
  const seen = new WeakMap();
  const FADE_IN_MS = 90;
  const FADE_OUT_MS = 520;
  const TRACE = 0.07;

  // The flicker: a gaunt pale patient in a torn gown, bald, with sockets for
  // eyes and a pinpoint of light in each, arms hanging to the knees. Unseen it
  // creeps hunched, drawn only as a trace; shown it lunges, stretched out
  // toward you with its mouth open, its afterimages streaming behind.
  function flickerFigure(ctx, x, y, dir, lunge, t, flash, a, v) {
    const lean = lunge ? 0.55 : 0.28 + Math.sin(t / 420) * 0.04;
    const step = Math.sin(t / (lunge ? 70 : 260));
    const gown = flash ? FLASH : "#b8c4b8";
    const skin = flash ? FLASH : "#d8dccf";
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * a;
    framed(ctx, x, y, dir, () => {
      ctx.lineCap = "round";
      // Thin legs, bare feet.
      ctx.strokeStyle = skin;
      ctx.lineWidth = 0.42;
      for (const s of [-1, 1]) {
        const sw = step * s * (lunge ? 1.1 : 0.55);
        line(ctx, s * 0.25, 2.4, s * 0.25 + sw * 0.5, 0.15);
        ctx.fillStyle = skin;
        ellipse(ctx, s * 0.25 + sw * 0.5 + 0.25, 0.1, 0.4, 0.14);
        ctx.fill();
      }
      ctx.save();
      ctx.translate(0, 2.3);
      rotate(ctx, -lean);
      // The gown: a thin shift hanging to the knee, torn at the hem.
      ctx.fillStyle = gown;
      ctx.beginPath();
      ctx.moveTo(-0.7, 0.2);
      ctx.lineTo(-0.5, 2.5);
      ctx.lineTo(0.6, 2.5);
      ctx.lineTo(0.85, 0.2);
      for (let k = 0; k < 5; k++) ctx.lineTo(0.85 - k * 0.38, 0.2 - 0.45 * (k % 2) - 0.1);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.fillRect(-0.6, 0.0, 0.5, 2.5);
        ctx.fillStyle = rgba(STAIN, 0.5);
        ellipse(ctx, 0.3, 1.3, 0.3, 0.55);
        ctx.fill();
        // The wristband, and ribs showing through.
        ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
        ctx.lineWidth = 0.07;
        for (const ry of [1.6, 1.95, 2.3]) line(ctx, -0.3, ry, 0.5, ry + 0.06);
      }
      // Arms: long, hanging, or thrust out ahead in a lunge.
      const reachX = lunge ? 2.5 : 0.35 + step * 0.2;
      const reachY = lunge ? 1.6 + Math.sin(t / 55) * 0.25 : -0.9;
      ctx.strokeStyle = skin;
      ctx.lineWidth = 0.34;
      for (const s of [0, 1]) {
        const ax = reachX - s * (lunge ? 0.1 : 0.5);
        const ay = reachY - s * (lunge ? 0.5 : 0.2);
        ctx.beginPath();
        ctx.moveTo(0.1, 2.35);
        ctx.quadraticCurveTo(0.3 + ax * 0.5, 2.3 + ay * 0.3, ax + 0.2, 2.2 + ay);
        ctx.stroke();
        ctx.lineWidth = 0.1;
        for (let f = -1; f <= 1; f++) line(ctx, ax + 0.2, 2.2 + ay, ax + 0.2 + (lunge ? 0.7 : 0.1 * f), 2.2 + ay + (lunge ? f * 0.25 : -0.55));
        ctx.lineWidth = 0.34;
      }
      // The head: long, hollow, bald; sockets, a mouth.
      ctx.fillStyle = skin;
      ellipse(ctx, 0.5, 3.15, 0.62, 0.9, -0.3);
      ctx.fill();
      ctx.fillRect(0.12, 2.5, 0.28, 0.5);
      if (!flash) {
        ctx.fillStyle = "#070a08";
        ellipse(ctx, 0.78, 3.28, 0.2, 0.28);
        ctx.fill();
        ellipse(ctx, 0.3, 3.3, 0.18, 0.26);
        ctx.fill();
        ctx.fillStyle = "#0a0c0a";
        ellipse(ctx, 0.62, 2.75, 0.2, lunge ? 0.35 : 0.1);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = 0.08;
        line(ctx, 0.2, 3.9, 0.55, 3.75);
        line(ctx, 0.4, 3.55, 0.7, 3.5);
      }
      ctx.restore();
    });
    ctx.globalAlpha = was;
  }

  function flicker(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    let s = seen.get(m);
    if (!s) seen.set(m, (s = { a: m.unseen ? TRACE : 1, at: v.clock }));
    const dt = clamp(v.clock - s.at, 0, 120);
    s.at = v.clock;
    const want = m.unseen ? TRACE : 1;
    s.a = want > s.a ? Math.min(want, s.a + dt / FADE_IN_MS) : Math.max(want, s.a - dt / FADE_OUT_MS);
    const lunge = m.act === "lunge" || !m.unseen;
    const fading = m.unseen && s.a > TRACE + 0.02;
    // Afterimages: where it was a moment ago, stretched back along its path.
    if (lunge || fading) {
      for (let k = 3; k >= 1; k--) flickerFigure(ctx, x - dir * k * 1.5, y, dir, lunge, t - k * 40, false, s.a * (0.2 - k * 0.04), v);
    }
    flickerFigure(ctx, x, y, dir, lunge, t, flash, s.a, v);
    if (s.a > 0.5 && !flash) {
      const hx = x + dir * (lunge ? 1.85 : 0.95);
      const hy = y - (lunge ? 4.2 : 4.9);
      eye(v, hx + dir * 0.1, hy, 0.09, EYE_PALE);
      eye(v, hx - dir * 0.38, hy + 0.1, 0.09, EYE_PALE);
    }
  }

  // The specimen bloater: the house Bloater in a hospital gown, swollen on
  // stumps, a sick head, a jar of formaldehyde clutched to its belly with
  // something pale floating in it. Winding up it swells and hoists the jar
  // overhead.
  function specimen(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const p = m.windup > 0 ? clamp(1 - m.windup / JAR_WIND_MS, 0, 1) : 0;
    const swell = 1 + p * 0.2 + Math.sin(t / 300) * 0.03;
    const skin = flash ? FLASH : "#8e9e86";
    const gown = flash ? FLASH : GOWN;
    framed(ctx, x, y, dir, () => {
      ctx.lineCap = "round";
      const step = Math.sin(t / 200) * 0.3;
      ctx.strokeStyle = flash ? FLASH : "#586450";
      ctx.lineWidth = 0.6;
      line(ctx, -0.8, 1.2, -0.8 + step, 0.1);
      line(ctx, 0.8, 1.2, 0.8 - step, 0.1);
      // The belly, veined, with the back of the gown tied across it.
      ctx.fillStyle = skin;
      ellipse(ctx, 0, 2.5, 2.05 * swell, 1.95 * swell);
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "#5a3a4a";
        ctx.lineWidth = 0.08;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(-1.2 + k * 0.7, 3.8);
          ctx.quadraticCurveTo(-0.8 + k * 0.6, 2.6, -1.4 + k * 0.9, 1.4);
          ctx.stroke();
        }
      }
      // The gown: from the neck over the chest, flared to the hem, a darker side.
      ctx.fillStyle = gown;
      ctx.beginPath();
      ctx.moveTo(-0.9, 4.15);
      ctx.quadraticCurveTo(-2.4 * swell, 3.3, -2.2 * swell, 1.55);
      ctx.lineTo(0.2, 1.3);
      ctx.lineTo(2.1 * swell, 1.75);
      ctx.quadraticCurveTo(2.3 * swell, 3.4, 1.0, 4.15);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.beginPath();
        ctx.moveTo(-0.9, 4.15);
        ctx.quadraticCurveTo(-2.4 * swell, 3.3, -2.2 * swell, 1.55);
        ctx.lineTo(-0.7, 1.45);
        ctx.quadraticCurveTo(-1.2, 3, -0.6, 4.1);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = GOWN_DARK;
        for (const [px, py] of [[-0.9, 3.0], [0.3, 3.6], [1.0, 2.6], [-0.2, 2.1], [-1.4, 2.0], [0.9, 1.8]]) ctx.fillRect(px, py, 0.18, 0.18);
        ctx.fillStyle = rgba(STAIN, 0.5);
        ellipse(ctx, 0.5, 2.1, 0.8, 0.45);
        ctx.fill();
        ctx.fillStyle = rgba("#e0e8e0", 0.7);
        for (const ty of [3.9, 3.6]) ctx.fillRect(-2.3, ty - 1.6, 0.9, 0.12);
      }
      // The head, small on all that, and its mouth, drooling.
      const hy = 4.55 * swell + 0.2;
      ctx.fillStyle = skin;
      ellipse(ctx, 0.5, hy, 0.78, 0.7);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#1a2008";
        ellipse(ctx, 0.9, hy - 0.2, 0.3, 0.2 + p * 0.25);
        ctx.fill();
        ctx.fillStyle = "#8ae890";
        ctx.fillRect(0.84, hy - 0.5 - (0.5 + p * 0.9), 0.12, 0.5 + p * 0.9 + Math.abs(Math.sin(t / 150)) * 0.3);
        // A hospital band round the wrist, a tag on the gown's tie.
        ctx.fillStyle = "#d8d8c8";
        ctx.fillRect(-0.4, hy + 0.55, 0.3, 0.3);
      }
      // The jar: held out at the belly, hoisted overhead as it winds up.
      const jx = lerp(1.55, 0.7, ease(p));
      const jy = lerp(2.8, hy + 2.1, ease(p));
      ctx.strokeStyle = skin;
      ctx.lineWidth = 0.45;
      line(ctx, 0.3, 3.4, jx - 0.4, jy - 0.3);
      line(ctx, -0.2, 3.1, jx + 0.4, jy - 0.4);
      jar(ctx, jx, jy, 1.05, t, flash, 0);
    });
    if (flash) return;
    eye(v, x + dir * 0.7, y - (4.55 * swell + 0.4), 0.11, EYE_AMBER);
    eye(v, x + dir * 1.1, y - (4.55 * swell + 0.38), 0.11, EYE_AMBER);
  }

  // A glass jar, r wide, in a y-up frame at (x, y): a lid, green liquid
  // sloshing, something pale in it, a label. `a` tilts it.
  function jar(ctx, x, y, r, t, flash, a) {
    ctx.save();
    ctx.translate(x, y);
    rotate(ctx, a);
    ctx.fillStyle = flash ? FLASH : rgba(FORMOL, 0.28);
    ctx.beginPath();
    ctx.moveTo(-r, -r * 1.15);
    ctx.lineTo(-r, r * 0.95);
    ctx.lineTo(r, r * 0.95);
    ctx.lineTo(r, -r * 1.15);
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      const sl = Math.sin(t / 120) * 0.12 * r;
      ctx.fillStyle = rgba(FORMOL, 0.75);
      ctx.beginPath();
      ctx.moveTo(-r, -r * 1.15);
      ctx.lineTo(-r, r * 0.35 + sl);
      ctx.lineTo(r, r * 0.35 - sl);
      ctx.lineTo(r, -r * 1.15);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#e4e8d8";
      ellipse(ctx, Math.sin(t / 500) * 0.2 * r, -r * 0.2, r * 0.45, r * 0.32);
      ctx.fill();
      ctx.fillStyle = INK;
      circle(ctx, Math.sin(t / 500) * 0.2 * r - 0.1 * r, -r * 0.25, r * 0.1);
      ctx.fill();
      ctx.fillStyle = "#cfd0b4";
      ctx.fillRect(-r * 0.6, -r * 0.95, r * 1.2, r * 0.42);
      ctx.fillStyle = "#5a2a24";
      ctx.fillRect(-r * 0.4, -r * 0.82, r * 0.8, r * 0.1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.fillRect(-r * 0.78, -r * 0.7, r * 0.14, r * 1.3);
    }
    ctx.fillStyle = flash ? FLASH : "#6a6a5a";
    ctx.fillRect(-r * 1.05, r * 0.95, r * 2.1, r * 0.45);
    ctx.fillStyle = flash ? FLASH : "#8a8a78";
    ctx.fillRect(-r * 1.05, r * 0.95, r * 2.1, r * 0.12);
    ctx.restore();
  }

  // The missiles are drawn at (x, y) down the page with a spin: a tumbling jar
  // and a tumbling syringe, a glint along its needle.
  function jarMissile(ctx, x, y, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, -1);
    halo(ctx, 0, 0, 3.6, FORMOL, 0.35);
    jar(ctx, 0, 0, 0.95, spin * 120, false, spin);
    ctx.restore();
  }

  function syringeMissile(ctx, x, y, spin) {
    ctx.save();
    ctx.translate(x, y);
    rotate(ctx, -spin);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.fillRect(-0.9, -0.28, 1.8, 0.56);
    ctx.fillStyle = FORMOL;
    ctx.fillRect(-0.7, -0.2, 1.1, 0.4);
    ctx.fillStyle = "#4a4e4c";
    ctx.fillRect(-1.2, -0.45, 0.3, 0.9);
    ctx.fillRect(-1.7, -0.1, 0.55, 0.2);
    ctx.fillStyle = "#5a5e5c";
    ctx.fillRect(0.9, -0.12, 0.35, 0.24);
    ctx.fillStyle = STEEL_LIT;
    ctx.beginPath();
    ctx.moveTo(1.25, -0.06);
    ctx.lineTo(2.5, 0);
    ctx.lineTo(1.25, 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /* ------------------------------------------------------------ hazards */

  // The formaldehyde a jar left: a green slick with a gloss on it, bubbling,
  // steam curling up off it. `h.live` runs down from `h.max`.
  function puddle(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const fade = clamp(h.live / 500, 0, 1) * clamp((h.max - h.live) / 120 + 0.35, 0, 1);
    const w = h.w / 2 + 0.5;
    const t = v.clock + h.x * 37;
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * fade;
    ctx.fillStyle = FORMOL_DARK;
    ellipse(ctx, h.x, fy - 0.1, w + 0.25, 0.5);
    ctx.fill();
    ctx.fillStyle = linear(ctx, h.x - w, 0, h.x + w, 0, [[0, "#4aa862"], [0.5, FORMOL], [1, "#4aa862"]], FORMOL);
    ellipse(ctx, h.x, fy - 0.2, w, 0.38);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    ellipse(ctx, h.x - w * 0.35, fy - 0.32, w * 0.3, 0.09);
    ctx.fill();
    // A bubble or two, popping.
    ctx.fillStyle = "rgba(220, 255, 220, 0.75)";
    for (let k = 0; k < 3; k++) {
      const q = ((t + k * 310) % 900) / 900;
      circle(ctx, h.x - w * 0.5 + k * w * 0.5, fy - 0.35 - q * 0.45, 0.17 * (1 - q * 0.5));
      ctx.fill();
    }
    // Steam: pale curls rising and spreading.
    for (let k = 0; k < 5; k++) {
      const q = ((t / 1400 + k * 0.2) % 1);
      ctx.fillStyle = rgba("#d8ffd8", (1 - q) * 0.3);
      circle(ctx, h.x - w * 0.6 + k * w * 0.3 + Math.sin(q * 6 + k * 2) * 0.5, fy - 0.5 - q * 3.2, 0.3 + q * 0.7);
      ctx.fill();
    }
    ctx.globalAlpha = was;
  }

  // The arm through the wall. First a crack of light where it will come: jagged
  // seams opening in the plaster at your height, light leaking, dust falling.
  // Then the arm itself: a ragged sleeve out of a hole, a long pale arm with
  // veins, a hospital band at the wrist and a hand with long fingers, shooting
  // across the ward.
  function arm(ctx, v, h) {
    const top = v.g.FIELD_H - h.y - h.h;
    const mid = top + h.h / 2;
    const t = v.clock;
    const into = h.dirx || 1;
    if (!(h.live > 0)) {
      const p = clamp(1 - h.warn / ARM_WARN_MS, 0, 1);
      const wx = h.wall;
      halo(ctx, wx + into * 1.2, mid, 2.4 + p * 4.4, "#fff0b0", 0.25 + p * 0.5);
      ctx.save();
      ctx.beginPath();
      ctx.rect(Math.min(wx, wx + into * 14), top - 3, 14, h.h + 6);
      ctx.clip();
      for (let c = 0; c < 6; c++) {
        const a = (c / 5 - 0.5) * 2.1;
        const len = (1.1 + (hash(c, 4) % 4) * 0.8) * (0.4 + p) * 1.6;
        ctx.strokeStyle = rgba("#fffbd0", 0.55 + 0.4 * p);
        ctx.lineWidth = 0.14 + p * 0.1;
        ctx.beginPath();
        let cx = wx + into * 0.2;
        let cy = mid + (c - 2.5) * 0.12;
        ctx.moveTo(cx, cy);
        for (let s = 1; s <= 4; s++) {
          cx += into * Math.cos(a) * len * 0.25 + ((hash(c, s) % 5) - 2) * 0.05;
          cy += Math.sin(a) * len * 0.25 + ((hash(s, c) % 5) - 2) * 0.12;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      ctx.restore();
      // A line of light along the seam where the arm will go.
      ctx.fillStyle = rgba("#fff0b0", 0.12 + p * 0.3);
      ctx.fillRect(Math.min(wx, wx + into * 0.9), top, 0.9, h.h);
      ctx.fillStyle = rgba(LINEN, 0.7);
      for (let k = 0; k < 5; k++) {
        const q = ((t / 600 + k * 0.23) % 1);
        ctx.fillRect(wx + into * (0.5 + k * 0.4), mid - 0.6 + q * (h.h * 0.9), 0.16, 0.16);
      }
      return;
    }
    const len = Math.max(0.1, h.len);
    ctx.save();
    ctx.translate(h.wall, mid);
    ctx.scale(into, 1);
    const th = h.h / 2;
    const reaching = h.len < h.span;
    // Motion trailing off it while it flies.
    if (reaching) {
      ctx.fillStyle = "rgba(240, 244, 230, 0.12)";
      for (let k = 0; k < 3; k++) ctx.fillRect(0, -th * 0.6 + k * th * 0.55, len - 1, 0.35);
    }
    // The hole it came through.
    ctx.fillStyle = "#020403";
    ellipse(ctx, 0, 0, 1.6, th + 0.8);
    ctx.fill();
    ctx.fillStyle = rgba(LINEN, 0.8);
    for (let k = 0; k < 5; k++) ctx.fillRect(1.6 + (k % 3) * 0.5, -th - 0.2 + k * (th * 0.5), 0.5, 0.35);
    // The arm: pale, tapering from the sleeve to the wrist.
    const wristAt = Math.max(2, len - 3.7);
    const sway = Math.sin(t / 130) * 0.1;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.moveTo(0, -th * 0.92);
    ctx.lineTo(wristAt, -th * 0.55 + sway);
    ctx.lineTo(wristAt, th * 0.55 + sway);
    ctx.lineTo(0, th * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
    ctx.beginPath();
    ctx.moveTo(0, th * 0.1);
    ctx.lineTo(wristAt, th * 0.06);
    ctx.lineTo(wristAt, th * 0.55 + sway);
    ctx.lineTo(0, th * 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 90, 100, 0.55)";
    ctx.lineWidth = 0.1;
    for (const o of [-0.25, 0.1, 0.4]) {
      ctx.beginPath();
      ctx.moveTo(1.6, th * o);
      for (let s = 1; s <= 8; s++) ctx.lineTo(1.6 + (wristAt - 1.6) * (s / 8), th * o * (1 - (s / 8) * 0.5) + Math.sin(s * 1.7 + o * 9) * 0.13);
      ctx.stroke();
    }
    // The sleeve: dingy white, torn, a cuff of stained cloth.
    ctx.fillStyle = LINEN;
    ctx.beginPath();
    ctx.moveTo(0, -th * 0.9);
    ctx.lineTo(2.9, -th * 0.74);
    for (let k = 0; k < 6; k++) ctx.lineTo(3.2 - (k % 2) * 0.8, -th * 0.74 + (k + 1) * ((th * 1.48) / 6));
    ctx.lineTo(0, th * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = rgba(STAIN, 0.55);
    ellipse(ctx, 1.4, th * 0.3, 0.9, 0.5);
    ctx.fill();
    ctx.fillStyle = rgba(BLOOD, 0.6);
    ellipse(ctx, 2.0, -th * 0.4, 0.35, 0.6);
    ctx.fill();
    // The wristband.
    ctx.fillStyle = "#e4e6d8";
    ctx.fillRect(wristAt - 0.1, -th * 0.58 + sway, 0.75, th * 1.16);
    ctx.fillStyle = "#8a2a24";
    ctx.fillRect(wristAt + 0.1, -th * 0.58 + sway, 0.14, th * 1.16);
    // The hand: a long palm, four fingers spread and curling, a thumb.
    const hx = wristAt + 0.7;
    ctx.fillStyle = SKIN;
    ctx.beginPath();
    ctx.moveTo(hx, -th * 0.58 + sway);
    ctx.lineTo(hx + 1.3, -th * 0.62);
    ctx.lineTo(hx + 1.5, th * 0.62);
    ctx.lineTo(hx, th * 0.58 + sway);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = SKIN;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.34;
    const fan = reaching ? 0.1 : 0.32 + Math.sin(t / 200) * 0.04;
    for (let f = 0; f < 4; f++) {
      const fyy = -th * 0.5 + f * (th / 1.5);
      const a = (f - 1.5) * fan;
      ctx.beginPath();
      ctx.moveTo(hx + 1.3, fyy);
      ctx.quadraticCurveTo(hx + 2.3, fyy + a * 2, hx + 3.2, fyy + a * 4 - (f === 1 || f === 2 ? 0.2 : 0));
      ctx.stroke();
      ctx.fillStyle = "#3a3a30";
      circle(ctx, hx + 3.25, fyy + a * 4, 0.16);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(hx + 0.4, -th * 0.5);
    ctx.quadraticCurveTo(hx + 1.2, -th * 0.95, hx + 2.2, -th * 0.9);
    ctx.stroke();
    ctx.restore();
  }

  /* ----------------------------------------------------------- the Matron */

  // Marches a ray from (bx, by) (y up) at `ang` until the ground (a cabinet or
  // the floor) is in the way, `range` at most; gives the distance.
  function march(v, bx, by, ang, range) {
    const cx = Math.cos(ang);
    const cy = Math.sin(ang);
    for (let s = 0.6; s <= range; s += 0.6) if (v.groundAt(v.spec, bx + cx * s) > by + cy * s) return s;
    return range;
  }

  // The lantern's cone as points down the page, each edge cut where it meets
  // the floor or a cabinet: [origin x, y, then each ray's end], and how far the
  // middle one runs.
  function beamPoints(v, beam) {
    const H = v.g.FIELD_H;
    const pts = [beam.x, H - beam.y];
    const rays = 9;
    let mid = 0;
    for (let i = 0; i < rays; i++) {
      const a = beam.angle - beam.half + (i / (rays - 1)) * beam.half * 2;
      const s = march(v, beam.x, beam.y, a, beam.range);
      pts.push(beam.x + Math.cos(a) * s, H - (beam.y + Math.sin(a) * s));
      if (i === (rays - 1) / 2) mid = s;
    }
    return { pts, mid };
  }

  // The cone itself, a warm wedge fading with distance, a hotter core when it
  // is on Planny, dust turning in it; where it stops at a cabinet the glass
  // flares.
  function drawBeam(ctx, v, b) {
    const beam = b.beam;
    const rage = Boolean(b.raged);
    const { pts, mid } = beamPoints(v, beam);
    const H = v.g.FIELD_H;
    const ox = beam.x;
    const oy = H - beam.y;
    const ex = ox + Math.cos(beam.angle) * mid;
    const ey = oy - Math.sin(beam.angle) * mid;
    const warm = rage ? "#ff9a6a" : beam.on ? "#ffc880" : "#ffefb0";
    const was = ctx.globalAlpha;
    // A wider, fainter bloom round it, then the cone itself.
    ctx.fillStyle = linear(ctx, ox, oy, ex, ey, [[0, rgba(warm, 0.2)], [1, rgba(warm, 0.04)]], rgba(warm, 0.1));
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    for (const f of [-1.9, 1.9]) ctx.lineTo(ox + Math.cos(beam.angle + beam.half * f) * mid, oy - Math.sin(beam.angle + beam.half * f) * mid);
    ctx.closePath();
    ctx.fill();
    const gr = linear(ctx, ox, oy, ex, ey, [[0, rgba(warm, beam.on ? 0.75 : 0.6)], [0.7, rgba(warm, beam.on ? 0.45 : 0.32)], [1, rgba(warm, beam.on ? 0.34 : 0.24)]], rgba(warm, 0.4));
    ctx.fillStyle = gr;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
    // A bright seam along each edge.
    ctx.strokeStyle = rgba(warm, 0.55);
    ctx.lineWidth = 0.16;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[2], pts[3]);
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[pts.length - 2], pts[pts.length - 1]);
    ctx.stroke();
    // Dust motes drifting in it.
    ctx.fillStyle = rgba("#fff6d0", 0.5);
    for (let k = 0; k < 14; k++) {
      const q = ((v.clock / 2600 + k * 0.071) % 1);
      const s = q * mid;
      const sp = Math.sin(k * 5.3) * beam.half * 0.8;
      const ang = beam.angle + sp;
      ctx.globalAlpha = was * (1 - q) * 0.9;
      ctx.fillRect(ox + Math.cos(ang) * s, oy - Math.sin(ang) * s + Math.sin(v.clock / 400 + k) * 0.25, 0.16, 0.16);
    }
    ctx.globalAlpha = was;
    // Where it lands: a pool of light on the floor, or a flare on the cabinet.
    if (beam.blocked) {
      halo(ctx, ex, ey, 3.8, "#fff0c0", 0.7);
      ctx.strokeStyle = rgba("#ffffff", 0.7);
      ctx.lineWidth = 0.14;
      line(ctx, ex - 1.4, ey - 1, ex + 1.4, ey + 1);
      line(ctx, ex - 1.4, ey + 1, ex + 1.4, ey - 1);
    } else {
      ctx.fillStyle = rgba(warm, 0.28);
      ellipse(ctx, ex, ey, 2.6, 0.5);
      ctx.fill();
    }
  }

  // The Night Matron: a tall gaunt nurse in a gray 1910s uniform, a starched
  // apron with a faded cross, a high collar, a cap with a long veil. She holds
  // a lantern out at arm's length; the other hand hangs, or hoists a fan of
  // syringes, or lifts a finger to her lips as the wall cracks. In her rage her
  // veil streams, her hair comes loose, her eyes burn red and the flame is
  // hot.
  function matron(ctx, v, b) {
    const flash = b.hurt > 0;
    const rage = Boolean(b.raged);
    const t = v.clock;
    const dir = b.dir || -1;
    const x = b.x;
    const fy = v.g.FIELD_H - b.y;
    const round = v.round;
    const hz = (round && round.hazards) || [];
    const armWarn = hz.some((h) => h.kind === "arm" && h.warn > 0);
    const armOut = hz.some((h) => h.kind === "arm" && h.live > 0);
    const walking = b.act === "walk";
    const syr = b.act === "syringeWind" ? ease(clamp(1 - b.wait / SYRINGE_WIND_MS, 0, 1)) : 0;
    const threw = b.act === "rest" && !armWarn && !armOut ? 0 : 0;
    const sway = Math.sin(t / (rage ? 150 : 640)) * (rage ? 0.4 : 0.16);
    const glide = walking ? Math.sin(t / 240) * 0.3 : 0;
    if (b.beam && v.spec) drawBeam(ctx, v, b);
    else if (b.lit) {
      // A card's picture: a short wedge of lamplight across the floor.
      ctx.fillStyle = "rgba(255, 239, 176, 0.22)";
      poly(ctx, [dir * BEAM_ORIGIN_X + x, fy - BEAM_ORIGIN_Y, x + dir * 40, fy - 4, x + dir * 40, fy + 0.2]);
      ctx.fill();
    }
    const dress = flash ? FLASH : "#59635d";
    const dressDark = flash ? FLASH : "#363f3a";
    const apron = flash ? FLASH : "#cfd2c2";
    const pale = flash ? FLASH : "#d8dccc";
    const paleDark = flash ? FLASH : "#9ea898";
    if (rage && !flash) halo(ctx, x, fy - 8, 12, "#ff2a2a", 0.22 + 0.08 * Math.sin(t / 80));
    // Where the lantern hangs, in the room: (3.5, 8) from her feet.
    const lx = BEAM_ORIGIN_X;
    const ly = BEAM_ORIGIN_Y + 0.2;
    framed(ctx, x, fy, dir, () => {
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.save();
      ctx.translate(sway, 0);
      // The veil streaming behind from the cap.
      const wave = Math.sin(t / (rage ? 90 : 520));
      ctx.fillStyle = flash ? FLASH : "rgba(214, 220, 206, 0.78)";
      ctx.beginPath();
      ctx.moveTo(-0.2, 15.6);
      ctx.quadraticCurveTo(-2.2 - wave * 0.4, rage ? 16.2 : 14.6, -3.4 - wave * 0.6, rage ? 15 : 11.2 + wave * 0.4);
      ctx.lineTo(-3 - wave * 0.4, 9.4);
      ctx.lineTo(-2.2, 10.6 + wave * 0.3);
      ctx.lineTo(-1.8, 8.8);
      ctx.lineTo(-1, 11.6);
      ctx.lineTo(-0.6, 13.6);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.lineWidth = 0.08;
        for (const k of [0.3, 0.55, 0.8]) line(ctx, -0.4, 15.2, -3 * k - 0.2, 10.6 + k);
      }
      // The skirt: a long bell to the floor, ragged at the hem, trailing back.
      ctx.fillStyle = dress;
      ctx.beginPath();
      ctx.moveTo(-1.15, 8.6);
      ctx.bezierCurveTo(-1.5, 5.5, -3.2 - glide, 2.6, -3.5 - glide, 0.3);
      for (let k = 0; k <= 6; k++) ctx.lineTo(-3.5 - glide + k * (7 / 6) + glide * (k / 6), 0.3 + (k % 2) * 0.35);
      ctx.bezierCurveTo(3.2, 2.6, 1.4, 5.5, 1.25, 8.6);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = dressDark;
        ctx.beginPath();
        ctx.moveTo(-1.15, 8.6);
        ctx.bezierCurveTo(-1.5, 5.5, -3.2 - glide, 2.6, -3.5 - glide, 0.3);
        ctx.lineTo(-1.6, 0.3);
        ctx.bezierCurveTo(-1.4, 3.5, -0.7, 5.5, -0.4, 8.6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        ctx.lineWidth = 0.1;
        for (const k of [-1.6, 0.2, 1.8]) line(ctx, k * 0.4, 8.2, k * 1.7, 0.7);
        // Mud on the hem; two black shoes.
        ctx.fillStyle = "rgba(60, 40, 24, 0.5)";
        ctx.fillRect(-3.3, 0.3, 6.6, 0.55);
        ctx.fillStyle = "#101214";
        ellipse(ctx, 1.8, 0.28, 0.8, 0.28);
        ctx.fill();
        ellipse(ctx, -0.6, 0.28, 0.8, 0.28);
        ctx.fill();
      }
      // The apron: long, stained at the hem, strings at the waist.
      ctx.fillStyle = apron;
      ctx.beginPath();
      ctx.moveTo(-0.3, 11.4);
      ctx.lineTo(1.4, 11.4);
      ctx.lineTo(1.5, 8.6);
      ctx.bezierCurveTo(2.2, 5.5, 2.6, 3.2, 2.8, 1.1);
      ctx.lineTo(-0.9, 1.1);
      ctx.bezierCurveTo(-0.8, 3.2, -0.6, 5.5, -0.8, 8.6);
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
        ctx.fillRect(-0.9, 1.1, 0.7, 7.6);
        ctx.fillStyle = rgba(STAIN, 0.5);
        ellipse(ctx, 1.4, 2.4, 0.8, 0.9);
        ctx.fill();
        ctx.fillStyle = rgba(BLOOD, 0.55);
        ellipse(ctx, 0.2, 1.7, 0.6, 0.35);
        ctx.fill();
        circle(ctx, 1.9, 4.6, 0.2);
        ctx.fill();
        // The faded red cross on the bib.
        ctx.fillStyle = "#8a2a24";
        ctx.fillRect(0.45, 9.9, 0.34, 1.1);
        ctx.fillRect(0.07, 10.25, 1.1, 0.34);
        ctx.fillStyle = "#26302c";
        ctx.fillRect(-0.9, 8.45, 3.0, 0.32);
        ctx.fillStyle = "#c8a850";
        ctx.fillRect(1.6, 8.35, 0.3, 0.5);
        // A chatelaine of keys and scissors at the waist.
        ctx.strokeStyle = STEEL;
        ctx.lineWidth = 0.1;
        line(ctx, 1.8, 8.4, 2.0, 6.8);
        line(ctx, 2.0, 6.8, 1.8, 6.1);
        line(ctx, 2.0, 6.8, 2.3, 6.1);
      }
      // The bodice, narrow, a high collar and a pleat of lace.
      ctx.fillStyle = dress;
      poly(ctx, [-1.1, 8.7, -1.7, 12.0, -1.0, 12.5, 1.6, 12.5, 2.0, 12.0, 1.35, 8.7]);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = dressDark;
        poly(ctx, [-1.1, 8.7, -1.7, 12.0, -1.0, 12.5, -0.3, 12.5, -0.5, 8.7]);
        ctx.fill();
      }
      ctx.fillStyle = pale;
      poly(ctx, [-0.9, 12.3, -0.8, 13.5, 1.5, 13.5, 1.6, 12.3, 0.4, 11.6]);
      ctx.fill();
      // Neck and a long gaunt face.
      ctx.fillStyle = flash ? FLASH : paleDark;
      ctx.fillRect(-0.05, 13.3, 0.8, 0.6);
      ctx.fillStyle = flash ? FLASH : pale;
      ellipse(ctx, 0.55, 14.7, 0.82, 1.28, -0.12);
      ctx.fill();
      if (!flash) {
        // Sunken cheeks, a thin mouth, a long nose, dark sockets.
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ellipse(ctx, 0.8, 14.2, 0.35, 0.55);
        ctx.fill();
        ctx.fillStyle = "#06090a";
        ellipse(ctx, 1.0, 14.95, 0.3, 0.38);
        ctx.fill();
        ellipse(ctx, 0.15, 14.95, 0.25, 0.34);
        ctx.fill();
        ctx.strokeStyle = "rgba(60, 20, 20, 0.7)";
        ctx.lineWidth = 0.1;
        if (rage) {
          ctx.fillStyle = "#1a0606";
          ellipse(ctx, 0.9, 13.75, 0.28, 0.2 + Math.abs(Math.sin(t / 60)) * 0.1);
          ctx.fill();
        } else line(ctx, 0.55, 13.75, 1.25, 13.8);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
        line(ctx, 1.2, 14.6, 1.55, 14.1);
        line(ctx, 1.55, 14.1, 1.2, 14.05);
        // Hair scraped into a bun, or loose and wild in the rage.
        ctx.strokeStyle = "#1a1612";
        ctx.lineWidth = 0.13;
        if (rage) {
          for (let k = 0; k < 9; k++) {
            const a = 2.2 + k * 0.22 + Math.sin(t / 110 + k) * 0.12;
            line(ctx, -0.1, 15.5, -0.1 + Math.cos(a) * 2.8, 15.5 + Math.sin(a) * 2.8);
          }
        } else {
          ctx.fillStyle = "#1a1612";
          circle(ctx, -0.55, 15.1, 0.5);
          ctx.fill();
        }
      }
      // The cap: a starched white band, a red cross.
      ctx.fillStyle = flash ? FLASH : "#e4e6da";
      poly(ctx, [-0.35, 15.5, 1.3, 15.6, 1.2, 16.1, -0.25, 16.1]);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#8a2a24";
        ctx.fillRect(0.5, 15.6, 0.22, 0.45);
        ctx.fillRect(0.38, 15.72, 0.46, 0.2);
      }
      // The puffed shoulder, the sleeve to the elbow.
      ctx.fillStyle = dress;
      circle(ctx, 0.4, 11.9, 1.05);
      ctx.fill();
      // The free arm behind, then the lantern arm in front.
      const idle = [-0.9, 7.2];
      let target = idle;
      let hand = 0;
      if (syr > 0) {
        target = [lerp(idle[0], 1.9, syr), lerp(idle[1], 14.6 + Math.sin(t / 50) * 0.1, syr)];
        hand = 2;
      } else if (armWarn) {
        target = [1.5, 13.4];
        hand = 3;
      } else if (armOut) {
        target = [2.2, 10.6];
        hand = 4;
      }
      limb(ctx, -0.3, 11.5, target[0], target[1], 2.8, 2.9, hand ? 1 : -1, 0.8, 0.6, dressDark, dressDark);
      ctx.fillStyle = flash ? FLASH : paleDark;
      circle(ctx, target[0], target[1], 0.4);
      ctx.fill();
      if (hand === 2) {
        const n = rage ? 5 : 3;
        for (let k = 0; k < n; k++) {
          const a = 0.55 + (k - (n - 1) / 2) * (rage ? 0.34 : 0.42);
          const sx = target[0] + Math.cos(a) * 0.5;
          const sy = target[1] + Math.sin(a) * 0.5;
          ctx.save();
          ctx.translate(sx, sy);
          rotate(ctx, a);
          ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
          ctx.fillRect(0, -0.16, 1.5, 0.32);
          ctx.fillStyle = FORMOL;
          ctx.fillRect(0.1, -0.1, 0.9, 0.2);
          ctx.fillStyle = STEEL_LIT;
          ctx.fillRect(1.5, -0.04, 1.3, 0.08);
          ctx.restore();
        }
      } else if (hand === 3) {
        ctx.strokeStyle = flash ? FLASH : pale;
        ctx.lineWidth = 0.14;
        line(ctx, target[0], target[1], target[0] + 0.1, target[1] + 0.9);
      }
      const lantern = limb(ctx, 0.8, 11.6, lx, ly + 1.25, 2.6, 2.7, -1, 0.9, 0.65, dress, dressDark);
      ctx.fillStyle = flash ? FLASH : pale;
      circle(ctx, lx, ly + 1.25, 0.4);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#e4e6da";
      ctx.fillRect(lantern[0] * 0 + lx - 0.5, ly + 1.1, 1.0, 0.28);
      // The lantern: a brass cap and base, a glass chimney, the flame.
      ctx.strokeStyle = flash ? FLASH : "#8a7a42";
      ctx.lineWidth = 0.14;
      circle(ctx, lx, ly + 1.0, 0.36);
      ctx.stroke();
      const hot = rage ? FLAME_HOT : FLAME;
      ctx.fillStyle = flash ? FLASH : rgba(hot, 0.35);
      ctx.fillRect(lx - 0.6, ly - 0.7, 1.2, 1.7);
      ctx.fillStyle = flash ? FLASH : "#b8983a";
      ctx.fillRect(lx - 0.75, ly + 0.8, 1.5, 0.3);
      ctx.fillRect(lx - 0.75, ly - 0.95, 1.5, 0.3);
      ctx.strokeStyle = flash ? FLASH : "#8a7a42";
      line(ctx, lx - 0.6, ly - 0.7, lx - 0.6, ly + 0.8);
      line(ctx, lx + 0.6, ly - 0.7, lx + 0.6, ly + 0.8);
      const fl = 0.5 + Math.sin(t / 60) * 0.12 + (rage ? 0.25 : 0);
      ctx.fillStyle = hot;
      ctx.beginPath();
      ctx.moveTo(lx, ly + 0.55 + fl);
      ctx.quadraticCurveTo(lx + 0.45, ly - 0.05, lx, ly - 0.55);
      ctx.quadraticCurveTo(lx - 0.45, ly - 0.05, lx, ly + 0.55 + fl);
      ctx.fill();
      ctx.fillStyle = "#fff6d0";
      ellipse(ctx, lx, ly - 0.15, 0.14, 0.3);
      ctx.fill();
      ctx.restore();
    });
    if (flash) return;
    // Her eyes burn through the dark; the lantern's flame.
    const ex = x + dir * 0.9;
    const ey = fy - 14.95;
    if (rage) {
      eye(v, ex, ey, 0.17, EYE_RED);
      eye(v, x + dir * 0.2, ey, 0.15, EYE_RED);
    } else {
      eye(v, ex, ey, 0.1, EYE_PALE);
      eye(v, x + dir * 0.2, ey, 0.09, EYE_PALE);
    }
    eye(v, x + dir * lx, fy - ly, 0.28, rage ? "#ff7a3a" : "#ffc866");
  }

  /* -------------------------------------------------------------- power */

  // Smelling Salts' badge (inside the ring every power-up shares): a small
  // brown bottle with a cork, a pungent wisp rising from it.
  function salts(ctx, x, y) {
    ctx.fillStyle = "#6a3e1c";
    ctx.beginPath();
    ctx.moveTo(x - 0.3, y - 0.3);
    ctx.lineTo(x + 0.3, y - 0.3);
    ctx.lineTo(x + 0.62, y + 0.1);
    ctx.lineTo(x + 0.62, y + 0.95);
    ctx.lineTo(x - 0.62, y + 0.95);
    ctx.lineTo(x - 0.62, y + 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 0.16;
    ctx.stroke();
    ctx.fillStyle = "#e8d8a8";
    ctx.fillRect(x - 0.4, y + 0.25, 0.8, 0.42);
    ctx.fillStyle = "#c89a5a";
    ctx.fillRect(x - 0.28, y - 0.62, 0.56, 0.34);
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(x + 0.1, y - 0.75);
    ctx.quadraticCurveTo(x - 0.35, y - 1.05, x + 0.2, y - 1.3);
    ctx.stroke();
  }

  // The Bone Saw's badge: a curved blade with teeth along its edge and a
  // handle.
  function saw(ctx, x, y) {
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(x - 1.0, y + 0.55);
    ctx.quadraticCurveTo(x - 0.1, y - 0.95, x + 1.15, y - 0.35);
    ctx.lineTo(x + 1.15, y - 0.05);
    ctx.quadraticCurveTo(x + 0.2, y - 0.6, x - 1.0, y + 0.55);
    ctx.closePath();
    ctx.fill();
    for (let k = 0; k < 5; k++) {
      const q = k / 4;
      const px = x - 0.75 + q * 1.8;
      const py = y + 0.55 - Math.sin(q * 1.6) * 0.9 + q * 0.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 0.12, py + 0.4);
      ctx.lineTo(px + 0.32, py + 0.08);
      ctx.stroke();
    }
    ctx.lineWidth = 0.38;
    line(ctx, x - 1.0, y + 0.55, x - 1.2, y + 1.0);
  }

  /* -------------------------------------------------------------- the dark */

  // What lights the dark here: the ceiling lamps while they are lit (and
  // their failing), a flicker's pale, a jar's green and the puddle's, the
  // syringes' glint, the arm's, the Salts' wide glow, a faint floor-edge
  // light under Planny in a blackout, and the Matron's lantern and her cone.
  function lights(v, add) {
    const round = v.round;
    const spec = v.spec;
    const look = LOOKS[spec.id];
    if (!look || !look.custom || look.pack !== "sanatorium") return;
    const cam = round.camX;
    const H = v.g.FIELD_H;
    for (const [lx, i] of lampsIn(cam - 24, cam + v.g.FIELD_W + 24)) {
      const level = lampLevel(v, i);
      if (level > 0.02) add(lx, H - 6, 18, 0.5 * level);
    }
    const you = round.you;
    if (!round.blackout && !(round.twist && round.twist.stage === "out")) {
      for (let x = Math.floor((cam - WINDOW_AT - 10) / WINDOW_EVERY) * WINDOW_EVERY + WINDOW_AT; x < cam + v.g.FIELD_W + 16; x += WINDOW_EVERY) {
        add(x, H - 12, 5.4, 0.34);
        add(x, H - 19, 5.4, 0.34);
      }
    }
    if (round.blackout) add(you.x, you.y + 0.6, 16, 0.3);
    if (round.effects.salts > 0) add(you.x, you.y + 2.4, SALTS_GLOW, 0.7 * Math.min(1, round.effects.salts / 1000));
    for (const m of round.monsters) {
      if (m.dead) continue;
      if (m.kind === "flicker" && !m.unseen) add(m.x, m.y + 2.6, 4.2, 0.4);
      else if (m.kind === "specimen") add(m.x + (m.dir || 1) * 1.5, m.y + 2.8, 4, 0.42);
    }
    for (const b of round.bones) {
      if (b.kind === "jar") add(b.x, b.y, 4.2, 0.5);
      else if (b.kind === "syringe") add(b.x, b.y, 2.6, 0.35);
    }
    for (const h of round.hazards) {
      if (h.kind === "formaldehyde") add(h.x, h.y + 0.6, 5.4, 0.5 * clamp(h.live / 500, 0, 1));
      else if (h.kind === "arm") {
        if (h.live > 0) add(h.wall + h.dirx * h.len, h.y + h.h / 2, 5.4, 0.5);
        else add(h.wall + h.dirx * 1.5, h.y + h.h / 2, 3 + 5 * (1 - h.warn / ARM_WARN_MS), 0.6);
      }
    }
    const b = round.boss;
    if (b && b.kind === "matron" && b.state !== "down") {
      add(b.x - 1, b.y + 12, 5, 0.3);
      add(b.x + b.dir * BEAM_ORIGIN_X, b.y + BEAM_ORIGIN_Y, 8, 0.8);
      const beam = b.beam;
      if (beam) {
        const mid = march(v, beam.x, beam.y, beam.angle, beam.range);
        for (let s = 5; s <= mid; s += 5) add(beam.x + Math.cos(beam.angle) * s, beam.y + Math.sin(beam.angle) * s, 3.4 + s * 0.13, 0.7 - (s / beam.range) * 0.3);
        if (beam.blocked) add(beam.x + Math.cos(beam.angle) * mid, beam.y + Math.sin(beam.angle) * mid, 6, 0.7);
      }
    }
  }

  // The blackout: the dark at nearly full. A stutter dims the room in step
  // with the first lamp failing.
  function dim(v) {
    const r = v.round;
    if (!r || !v.spec || !LOOKS[v.spec.id]) return 0;
    if (r.blackout) return 0.965;
    if (r.twist && r.twist.stage === "stutter") return 0.62 * (1 - lampLevel(v, 0));
    return 0;
  }

  /* --------------------------------------------------- over the figures */

  // The ceiling lamps: an enamel dome on a conduit, a cage, a bulb, and its
  // light a faint cone down the wall; a lamp failing buzzes and gutters.
  function lamp(ctx, v, lx, i) {
    const level = lampLevel(v, i);
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.2;
    line(ctx, lx, 0, lx, 2.6);
    ctx.fillStyle = "#4a5452";
    ctx.beginPath();
    ctx.moveTo(lx - 2.3, 4.6);
    ctx.quadraticCurveTo(lx - 2, 2.6, lx, 2.5);
    ctx.quadraticCurveTo(lx + 2, 2.6, lx + 2.3, 4.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6a7472";
    ctx.fillRect(lx - 2.3, 4.4, 4.6, 0.25);
    if (level > 0.02) {
      const was = ctx.globalAlpha;
      ctx.globalAlpha = was * level * 0.055;
      ctx.fillStyle = LAMP;
      poly(ctx, [lx - 1.6, 4.8, lx + 1.6, 4.8, lx + 13, 48, lx - 13, 48]);
      ctx.fill();
      ctx.globalAlpha = was;
      halo(ctx, lx, 5.2, 7, LAMP, 0.5 * level);
    }
    ctx.fillStyle = level > 0.3 ? LAMP : "#6a6e5a";
    circle(ctx, lx, 4.9, 0.62);
    ctx.fill();
    ctx.strokeStyle = "#2a3030";
    ctx.lineWidth = 0.1;
    for (const k of [-0.5, 0, 0.5]) line(ctx, lx + k, 4.4, lx + k * 0.8, 5.6);
  }

  // The water in each tub, moving: a dark green surface with a slow ripple, a
  // gleam, now and then a bubble rising from below.
  function water(ctx, v) {
    const spec = v.spec;
    const H = v.g.FIELD_H;
    const cam = v.round.camX;
    const pieces = spec.ground;
    for (let i = 0; i + 1 < pieces.length; i++) {
      const a = pieces[i][1];
      const b = pieces[i + 1][0];
      if (b <= a || b < cam - 4 || a > cam + v.g.FIELD_W + 4) continue;
      const top = H - Math.max(pieces[i][2], pieces[i + 1][2]);
      const t = v.clock / 600 + a;
      ctx.fillStyle = "rgba(14, 36, 34, 0.96)";
      ctx.beginPath();
      ctx.moveTo(a, top + 1.9);
      for (let x = a; x <= b; x += 0.8) ctx.lineTo(x, top + 1.9 + Math.sin(x * 1.3 + t * 2) * 0.12);
      ctx.lineTo(b, top + 8);
      ctx.lineTo(a, top + 8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(160, 220, 200, 0.4)";
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      for (let x = a + 0.4; x <= b - 0.4; x += 0.6) ctx.lineTo(x, top + 1.9 + Math.sin(x * 1.3 + t * 2) * 0.12);
      ctx.stroke();
      ctx.fillStyle = "rgba(210, 255, 240, 0.35)";
      ellipse(ctx, a + (b - a) * (0.3 + 0.2 * Math.sin(t)), top + 2.05, 0.9, 0.08);
      ctx.fill();
      const q = (v.clock / 1700 + a * 0.13) % 1;
      ctx.fillStyle = rgba("#9ae8d0", (1 - q) * 0.6);
      circle(ctx, a + (b - a) * 0.55 + Math.sin(q * 6) * 0.3, top + 6 - q * 4, 0.2);
      ctx.fill();
    }
  }

  // Over Planny and before the dark: the lamps, the water, the Salts' and the
  // Lantern's tint, the heat of the Matron's light on him, the orderly's
  // fingers closing over him, the streaks of a throw.
  function front(ctx, v) {
    const round = v.round;
    const spec = v.spec;
    const look = LOOKS[spec.id];
    if (!look || look.pack !== "sanatorium") return;
    const g = v.g;
    const H = g.FIELD_H;
    const cam = round.camX;
    for (const [lx, i] of lampsIn(cam - 8, cam + g.FIELD_W + 8)) lamp(ctx, v, lx, i);
    if (look.scene === "baths") water(ctx, v);
    const you = round.you;
    const yx = you.x;
    const yy = H - you.y;
    const hw = (g.YOU_W || 3.6) / 2;
    const hh = g.YOU_H || 5;
    // The Salts: a cool pale glow round him that makes flickers show; the Lantern's warm pool.
    if (round.effects.salts > 0) {
      const k = Math.min(1, round.effects.salts / 1000);
      halo(ctx, yx, yy - hh / 2, SALTS_GLOW, "#c8f0d8", 0.22 * k);
      ctx.strokeStyle = rgba("#c8f0d8", 0.25 * k);
      ctx.lineWidth = 0.18;
      circle(ctx, yx, yy - hh / 2, SALTS_GLOW * (0.97 + 0.03 * Math.sin(v.clock / 160)));
      ctx.stroke();
    }
    if (round.blackout && round.effects.lantern > 0) halo(ctx, yx, yy - hh / 2, LANTERN_LIGHT, "#ffd890", 0.18 * Math.min(1, round.effects.lantern / 1000));
    // A throw: streaks trailing off him.
    if (you.flingMs > 0 && you.state === "air") {
      const dx = Math.sign(you.flingVx || 1);
      ctx.strokeStyle = "rgba(230, 236, 224, 0.5)";
      ctx.lineWidth = 0.16;
      for (let k = 0; k < 4; k++) line(ctx, yx - dx * (1.8 + k * 0.4), yy - 1 - k * 0.9, yx - dx * (4.4 + k * 1.2), yy - 1 - k * 0.9 + 0.5);
    }
    // The orderly's glove closing over him: fingers across his front.
    for (const m of round.monsters) {
      if (m.kind !== "orderly" || m.act !== "hold" || m.dead || !(you.heldMs > 0)) continue;
      const dir = m.dir || 1;
      ctx.save();
      ctx.translate(yx, yy - hh * 0.46);
      ctx.scale(dir, 1);
      const squeeze = Math.sin(v.clock / 55) * 0.06;
      // The palm at his side, four fingers wrapped across his front, a thumb over the top.
      ctx.fillStyle = GLOVE_DARK;
      ellipse(ctx, -hw - 0.1, 0.1, 1.2, 1.55);
      ctx.fill();
      ctx.fillStyle = GLOVE;
      ellipse(ctx, -hw - 0.2, 0.05, 1.05, 1.4);
      ctx.fill();
      ctx.lineCap = "round";
      for (let f = 0; f < 4; f++) {
        const fy = -1.0 + f * 0.62;
        const len = hw * 2 - 0.2 - squeeze * f + (f === 0 || f === 3 ? -0.5 : 0);
        ctx.strokeStyle = "#5a4e1c";
        ctx.lineWidth = 0.7;
        line(ctx, -hw, fy, -hw + len, fy + 0.1);
        ctx.strokeStyle = f % 2 ? GLOVE : "#d2c27a";
        ctx.lineWidth = 0.56;
        line(ctx, -hw, fy, -hw + len, fy + 0.1);
        ctx.strokeStyle = "rgba(90, 78, 28, 0.6)";
        ctx.lineWidth = 0.08;
        line(ctx, -hw + len * 0.4, fy - 0.2, -hw + len * 0.4, fy + 0.25);
        line(ctx, -hw + len * 0.72, fy - 0.2, -hw + len * 0.72, fy + 0.25);
      }
      ctx.strokeStyle = GLOVE;
      ctx.lineWidth = 0.6;
      line(ctx, -hw - 0.4, -0.9, -hw + 1.4, -1.5);
      ctx.restore();
    }
    // The Matron's light on him: he glows, red-orange, steam lifting off.
    const b = round.boss;
    if (b && b.kind === "matron" && b.heat > 0.02 && b.state === "fight") {
      const h = b.heat;
      halo(ctx, yx, yy - hh / 2, 5 + h * 4, h > 0.7 ? "#ff5a2a" : "#ffb060", 0.3 + h * 0.55);
      ctx.fillStyle = rgba(h > 0.7 ? "#ff3a1a" : "#ff9a3a", 0.12 + h * 0.4);
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(yx - hw, yy - hh, hw * 2, hh, 0.8) : ctx.rect(yx - hw, yy - hh, hw * 2, hh);
      ctx.fill();
      if (h > 0.5) {
        ctx.strokeStyle = rgba("#fff0c0", 0.4 + 0.4 * Math.sin(v.clock / 50));
        ctx.lineWidth = 0.2;
        ctx.beginPath();
        ctx.roundRect ? ctx.roundRect(yx - hw - 0.2, yy - hh - 0.2, hw * 2 + 0.4, hh + 0.4, 0.9) : ctx.rect(yx - hw, yy - hh, hw * 2, hh);
        ctx.stroke();
      }
      for (let k = 0; k < 4; k++) {
        const q = ((v.clock / 700 + k * 0.25) % 1);
        ctx.fillStyle = rgba("#f0f0e0", (1 - q) * 0.35 * h);
        circle(ctx, yx + Math.sin(q * 7 + k * 2) * 0.9, yy - hh - q * 3, 0.3 + q * 0.5);
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------------------- events */

  // What the Sanatorium's events look and sound like, beside ghoul-draw.js's own:
  // true when `e` was one of them. `k` is the same kit react() is handed.
  function react(e, k) {
    const { tone, burst, float, ring, flash, glow, shake, fx } = k;
    if (e.type === "orderlyReach") {
      if (gate(fx, "reachMs", 200)) say(tone, "orderly", "reach", 0.4);
      float(e.x, e.y + 3, "!", DANGER, 2.6);
      burst(e.x, e.y, LINEN, 4, 5, 200);
    } else if (e.type === "orderlyGrab") {
      say(tone, "orderly", "grab", 0.5);
      shake(180, 0.5);
      burst(e.x, e.y, GLOVE, 8, 7, 250);
    } else if (e.type === "orderlyThrow") {
      say(tone, "orderly", "throw", 0.6);
      shake(260, 0.8);
      burst(e.x, e.y, LINEN, 10, 12, 350);
      ring(e.x, e.y, LINEN_LIT, 1, 6, 300);
    } else if (e.type === "saltsBreak") {
      say(tone, "salts", "break", 0.5);
      float(e.x, e.y + 3, "Free!", "#c8f0d8", 2.4);
      ring(e.x, e.y, "#c8f0d8", 1, 8, 450);
      glow(e.x, e.y, 9, 0.6, 400);
    } else if (e.type === "gurneyRattle") {
      if (gate(fx, "rattleMs", 200)) say(tone, "gurney", "rattle", 0.4);
      burst(e.x, e.y, RUST, 5, 6, 300);
    } else if (e.type === "gurneyRoll") {
      if (gate(fx, "rollMs", 200)) say(tone, "gurney", "roll", 0.4);
      burst(e.x - (e.dir || 1) * 3, e.y - 1.8, "#8a8a78", 6, 6, 300);
    } else if (e.type === "flickerShow") {
      if (gate(fx, "showMs", 200)) say(tone, "flicker", "show", 0.4);
      ring(e.x, e.y + 1, LINEN_LIT, 0.4, 2, 220);
    } else if (e.type === "flickerLunge") {
      if (gate(fx, "lungeMs", 150)) say(tone, "flicker", "lunge", 0.4);
    } else if (e.type === "jarWind") say(tone, "specimen", "wind", 0.3);
    else if (e.type === "jarBreak") {
      say(tone, "specimen", "jar", 0.4);
      burst(e.x, e.y + 0.5, FORMOL, 10, 9, 400);
      burst(e.x, e.y + 0.5, "#e8f4ec", 6, 11, 300);
      glow(e.x, e.y + 1, 5, 0.6, 400);
    } else if (e.type === "flickerWarn") {
      say(tone, "lights", "warn", 0.4);
      float(e.x, e.y - 12, "The lamps...", "#c8f0d8", 2.2);
    } else if (e.type === "lightsOut") {
      say(tone, "lights", "out", 0.6);
      flash("#000000", 200);
      shake(160, 0.3);
    } else if (e.type === "lightsOn") {
      say(tone, "lights", "on", 0.3);
      flash("#f2f0c8", 140);
    } else if (e.type === "syringeWind") say(tone, "matron", "syringeWind", 0.4);
    else if (e.type === "syringes") {
      say(tone, "matron", "syringes", 0.5);
      burst(e.x, e.y, STEEL_LIT, 8, 12, 300);
      ring(e.x, e.y, FORMOL, 0.5, 4, 250);
    } else if (e.type === "armWarn") {
      if (gate(fx, "armWarnMs", 200)) say(tone, "matron", "armWarn", 0.4);
      burst(e.x, e.y, LINEN, 6, 5, 400);
      float(e.x + (e.side || 1) * -6, e.y + 3, "The wall...", "#fff0b0", 2);
    } else if (e.type === "armReach") {
      if (gate(fx, "armReachMs", 200)) say(tone, "matron", "armReach", 0.5);
      shake(320, 0.9);
      burst(e.x, e.y, LINEN, 14, 14, 450);
      flash("#fff0b0", 120);
    } else if (e.type === "matronBeam") {
      if (gate(fx, "beamMs", 600)) say(tone, "matron", "beam", 0.25);
      glow(e.x, e.y, 8, 0.4, 300);
    } else if (e.type === "matronHeat") {
      if (gate(fx, "heatMs", 300)) say(tone, "matron", "heat", 0.3);
      float(e.x, e.y + 3, "Hot!", "#ffb060", 2);
    } else if (e.type === "sawCut") {
      if (gate(fx, "sawMs", 80)) say(tone, "saw", "cut", 0.3);
      burst(e.x, e.y, "#e0d4b8", 5, 10, 250);
    } else if (e.type === "matronRage") {
      say(tone, "matron", "rage", 0.8);
      flash("#c0303a", 400);
      shake(400, 0.8);
      k.banner("Lights out", "Her lantern is the only light", "#b0e0cc", 1600);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    decor: freeze({ beds, pipes, lamp: lampDecor, wardbeds: wardBeds }),
    monsters: freeze({ orderly, gurney, flicker, specimen }),
    bosses: freeze({ matron }),
    missiles: freeze({ jar: jarMissile, syringe: syringeMissile }),
    hazards: freeze({ formaldehyde: puddle, arm }),
    waves: freeze({}),
    powers: freeze({ salts, saw }),
    lights,
    front,
    dim,
    react,
  });
}
