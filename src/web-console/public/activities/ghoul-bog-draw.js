// Plan2Code Web Console - Ghoul Rush's Gallows Bog stage, its drawing: the rooms' looks out on the night swamp (sagging boardwalk planks over black water, mud sheen in the dips, moss veils and fireflies in the hollow, the hag's stilt house lit warm, the open water of her arena), its monsters (a lurker's eyes, a leech swarm, a will-o'-wisp, a bog body), Old Mother Bog and her cauldron, the mud wave and the muck patches, the Stilt Boots' and Harpoon's badges, and what its events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, LOSE_WORDS and LOSE_SOUNDS are
// plain data; bogArt(d) takes ghoul-draw.js's own drawing helpers (`d`:
// ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, label,
// DANGER, GOLD, FLASH and the eye colors) and hands back the drawing by
// kind, so this file never reaches back into it. Everything is drawn in
// room units, the way ghoul-draw.js draws: y counted down from the field's
// top, a monster from (x, y) at its feet. The bigger figures (the snapping
// lurker, Old Mother Bog) are drawn in a local frame turned to face the
// way they look, y counted up from the feet. Each function says what it
// draws and what in the rules (ghoul-bog.js) it follows.
//
// The sounds are all borrowed house tones until the stage's own are picked
// (the sound page's vote lands in Phase 5); the acts each event asks for
// are already named so the picks drop in.

import { BOG_RISE_MS, LURKER_SINK_MS, MOTHER_SINK_MS, MOTHER_WIND_MS, MUCK_LAND_MS, RESURFACE_MS, SNAP_MS, SPIT_WIND_MS, WISP_REKINDLE_MS } from "./ghoul-bog.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Out on the night swamp, like the Grounds but wetter: the "wall" is the
// sky (`wallTop` to `wallLow`), `paper` the far tree line, `wainscot` the
// black water behind, `window` the moon, `scene` what each room's backdrop
// is made of, and `pack` names this file's drawing for ghoul-draw.js. The
// floor and shelf colors are what the planks are drawn in under ground()
// and shelf() below. `hedge` is the lighter green of a mossy edge.
const swamp = (o) => freeze({ wallTop: "#060b08", wallLow: "#12201a", paper: "#1d2e24", wainscot: "#101a12", floorTop: "#3a4430", floor: "#20281a", floorEdge: "#080d06", shelf: "#2a2418", shelfTop: "#463a24", pit: "#010402", window: "#8fb89a", hedge: "#3a5a34", decor: "plants", dark: 0.88, outdoor: true, pack: "bog", ...o });
export const LOOKS = freeze({
  boardwalk: swamp({ color: "#8fb89a", scene: "boardwalk" }),
  hollow: swamp({ color: "#84b3a0", scene: "hollow", wallTop: "#050a0a", wallLow: "#0f1d1c", paper: "#1a2c2a", wainscot: "#0e1614", floorTop: "#36402c", floor: "#1e2618", floorEdge: "#070c05", shelf: "#262217", shelfTop: "#423722", pit: "#010403", window: "#6f9a8a", dark: 0.89 }),
  stilts: swamp({ color: "#b3a07a", scene: "stilts", wallTop: "#0a0806", wallLow: "#1c150e", paper: "#2a2116", wainscot: "#161009", floorTop: "#40392a", floor: "#242014", floorEdge: "#0a0805", shelf: "#2e2416", shelfTop: "#4a3c22", pit: "#020201", window: "#a8946a", decor: "rafters", dark: 0.9 }),
  drowning: swamp({ color: "#a4b488", scene: "drowning", wallTop: "#070a06", wallLow: "#141c10", paper: "#202a18", wainscot: "#101408", floorTop: "#3c3e2c", floor: "#222418", floorEdge: "#0a0b06", shelf: "#2c281a", shelfTop: "#484026", pit: "#010301", window: "#8aa878", decor: "tombs", dark: 0.9 }),
});

// How each new kind sounds, by act (the stage's own tones, ghoul-sfx-bog.js: option 1 of each act
// until the vote, then the picks). The act names are the ones each event and each shared handler
// (`appear`, `hurt`, `die`) asks for.
export const VOICES = freeze({
  lurker: freeze({ appear: "ghoulLurkerAppear", snap: "ghoulLurkerSnap", sink: "ghoulLurkerSink", hurt: "ghoulLurkerHurt", die: "ghoulLurkerDie" }),
  leech: freeze({ appear: "ghoulLeechAppear", latch: "ghoulLeechLatch", hurt: "ghoulLeechHurt", die: "ghoulLeechDie" }),
  wisp: freeze({ appear: "ghoulWispAppear", out: "ghoulWispOut", relight: "ghoulWispRelight", on: "ghoulWispOn", hurt: "ghoulWispHurt", die: "ghoulWispDie" }),
  bogbody: freeze({ appear: "ghoulBogbodyAppear", rise: "ghoulBogbodyRise", hurt: "ghoulBogbodyHurt", die: "ghoulBogbodyDie" }),
  motherbog: freeze({ wake: "ghoulMotherWake", wind: "ghoulMotherWind", wave: "ghoulMotherWave", spitWind: "ghoulMotherSpitWind", spit: "ghoulMotherSpit", open: "ghoulMotherOpen", sink: "ghoulMotherSink", bubble: "ghoulMotherBubble", rise: "ghoulMotherRise", muck: "ghoulMotherMuck", hurt: "ghoulMotherHurt", weak: "ghoulMotherWeak", die: "ghoulMotherDie" }),
});
// The words on a life lost to each new cause, and the sound beside the
// crash: the lurker's snap, a leech latch, the wisp's cold light, a bog
// body's grip, the mud wave, a muck patch and the hag's own touch.
export const LOSE_WORDS = freeze({ lurker: "Snapped", leeches: "Drained", wisp: "Misled", bogbody: "Dragged down", mudwave: "Swamped", muck: "Scalded", motherbog: "Stewed" });
export const LOSE_SOUNDS = freeze({
  lurker: ["crunch", 0.55, 0.8],
  leeches: ["squish", 0.5, 0.7],
  wisp: ["wail", 0.35, 0.6],
  bogbody: ["squish", 0.5, 0.8],
  mudwave: ["thud", 0.6, 0.7],
  muck: ["ghoulSizzle", 0.55, 0.7],
  motherbog: ["splat", 0.6, 0.5],
});

// The bog's inks: wet wood, black water, old mud and the wisp's cold green.
const PLANK = "#4a4634";
const PLANK_DARK = "#2c2a1c";
const PLANK_LIT = "#6a6248";
const PLANK_EDGE = "#17140c";
const WATER = "#060a08";
const WATER_SHEEN = "#284038";
const MUD = "#33291a";
const MUD_LIT = "#5a4a2c";
const MUD_DARK = "#1c150c";
const MOSS = "#3a5a34";
const MOSS_LIT = "#6a8a4c";
const WISP = "#9adfc0";
const WISP_HOT = "#e8fff2";
const WISP_DIM = "#3a4a40";
const BOGSKIN = "#4a3a22";
const BOGSKIN_LIT = "#7a6440";
const BOGSKIN_DARK = "#241a0e";
const HAG = "#5a4a2a";
const HAG_DARK = "#362a14";
const HAG_LIT = "#8a7448";
const CAULDRON = "#1e1c14";
const CAULDRON_LIT = "#7ac86a";
const LURKER = "#2a3a18";
const LURKER_LIT = "#54683a";
const LURKER_MAW = "#b8482e";
const LEECH = "#3d2a24";
const LEECH_LIT = "#6a463a";
const FIRE_FLY = "#d8e88a";

export function bogArt(d) {
  const { ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, DANGER, GOLD, FLASH, EYE_PALE, EYE_AMBER } = d;
  const rnd = (a, b) => hash(a, b) / 997;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mix = (a, b, p) => a + (b - a) * p;

  // A soft glow as a few stacked discs, `a` the strength at the middle.
  function halo(ctx, x, y, r, color, a) {
    const was = ctx.globalAlpha;
    ctx.fillStyle = color;
    for (const [k, s] of [[1, 0.2], [0.72, 0.25], [0.46, 0.3], [0.24, 0.35]]) {
      ctx.globalAlpha = was * a * s;
      circle(ctx, x, y, r * k);
      ctx.fill();
    }
    ctx.globalAlpha = was;
  }

  /* ------------------------------------------------------- the backdrop */

  // A dead cypress, bare trunk forking into a few limbs, standing in the
  // water line. `h` tall from its base at (x, base).
  function deadTree(ctx, x, base, h, color, seed) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.4, h * 0.045);
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + (rnd(seed, 1) - 0.5) * h * 0.12, base - h * 0.55, x + (rnd(seed, 2) - 0.5) * h * 0.2, base - h);
    ctx.stroke();
    ctx.lineWidth = Math.max(0.25, h * 0.022);
    for (let k = 0; k < 4; k++) {
      const t = 0.45 + k * 0.14;
      const bx = x + (rnd(seed, 2) - 0.5) * h * 0.2 * t;
      const by = base - h * t;
      const dir = rnd(seed, 3 + k) > 0.5 ? 1 : -1;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + dir * h * 0.1, by - h * 0.08, bx + dir * h * (0.14 + rnd(seed, k + 9) * 0.1), by - h * 0.2);
      ctx.stroke();
    }
  }

  // The night behind a room, from x0 to x1: the sky and its stars, the moon
  // thin behind cloud, a far line of drowned trees, and the black water of
  // the mire along the bottom with the moon's sheen in it and fog bands
  // drifting.
  function swampNight(ctx, v, look, x0, x1) {
    const { g } = v;
    const sky = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, g.FIELD_H) : null;
    if (sky && typeof sky.addColorStop === "function") {
      sky.addColorStop(0, look.wallTop);
      sky.addColorStop(0.72, look.wallLow);
      sky.addColorStop(1, look.wainscot);
      ctx.fillStyle = sky;
    } else ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, g.FIELD_H);
    // Stars, fewer and dimmer than the garden's: the swamp eats light.
    ctx.fillStyle = "#c8d8c8";
    for (let x = Math.floor(x0 / 3) * 3; x < x1 + 3; x += 3) {
      const h = hash(Math.round(x / 3), 71);
      if (h % 6) continue;
      ctx.globalAlpha = 0.16 + (h % 4) * 0.09;
      ctx.fillRect(x + (h % 3), 1 + (h % 21), 0.18, 0.18);
    }
    ctx.globalAlpha = 1;
    // The moon, low and smeared by mist.
    for (let x = Math.floor(x0 / 260) * 260 + 170; x < x1 + 12; x += 260) {
      halo(ctx, x, 8.5, 10, look.window, 0.42);
      ctx.fillStyle = look.window;
      ctx.globalAlpha = 0.85;
      circle(ctx, x, 8.5, 3.4);
      ctx.fill();
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = "#5a6a58";
      for (const [cx, cy, cr] of [[-1, -0.8, 0.9], [1.1, 0.9, 0.7], [0.3, -1.7, 0.45], [-1.5, 1.2, 0.4]]) {
        circle(ctx, x + cx, 8.5 + cy, cr);
        ctx.fill();
      }
    }
    // Thin cloud banks under it.
    for (let x = Math.floor(x0 / 110) * 110 + 30; x < x1 + 40; x += 110) {
      const h = hash(Math.round(x / 110), 19);
      ctx.globalAlpha = 0.05 + (h % 3) * 0.014;
      ctx.fillStyle = "#8aa098";
      ellipse(ctx, x + (h % 34), 12 + (h % 8), 19 + (h % 9), 1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The far shore: a drowned tree line on the black water.
    const shore = g.FIELD_H - 13.5;
    ctx.fillStyle = look.paper;
    ctx.beginPath();
    ctx.moveTo(x0, g.FIELD_H);
    for (let x = x0; x <= x1 + 1; x += 2) ctx.lineTo(x, shore + Math.sin(x / 53) * 1.1 + Math.sin(x / 17 + 2) * 0.5);
    ctx.lineTo(x1 + 1, g.FIELD_H);
    ctx.closePath();
    ctx.fill();
    for (let x = Math.floor(x0 / 21) * 21; x < x1 + 21; x += 21) {
      const n = Math.round(x / 21);
      const h = hash(n, 5);
      if (h % 5 === 0) continue;
      deadTree(ctx, x + (h % 8), shore + 1 + (h % 2), 7 + (h % 6) * 1.1, h % 3 ? look.paper : look.wainscot, n * 13 + 7);
    }
    // The water itself: black, with the moon's broken sheen and the odd
    // bubble where something breathes underneath.
    ctx.fillStyle = look.wainscot;
    ctx.fillRect(x0, shore + 4, x1 - x0, g.FIELD_H - shore - 4);
    for (let x = Math.floor(x0 / 7) * 7; x < x1 + 7; x += 7) {
      const n = Math.round(x / 7);
      const h = hash(n, 23);
      if (h % 4 === 0) continue;
      ctx.globalAlpha = 0.05 + (h % 5) * 0.02;
      ctx.fillStyle = WATER_SHEEN;
      ctx.fillRect(x + (h % 4), shore + 5.5 + (h % 4) * 1.4, 3 + (h % 4), 0.4);
    }
    for (let x = Math.floor(x0 / 43) * 43 + 11; x < x1 + 43; x += 43) {
      const n = Math.round(x / 43);
      const h = hash(n, 29);
      if (h % 3 === 0) continue;
      ctx.globalAlpha = 0.1;
      ctx.strokeStyle = WATER_SHEEN;
      ctx.lineWidth = 0.15;
      ellipse(ctx, x + (h % 13), shore + 8 + (h % 3), 1.2 + (h % 2) * 0.6, 0.4);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Fog bands over the water.
    ctx.fillStyle = "#7a9080";
    for (let x = Math.floor(x0 / 19) * 19; x < x1 + 19; x += 19) {
      const h = hash(Math.round(x / 19), 31);
      ctx.globalAlpha = 0.05 + (h % 4) * 0.016;
      ellipse(ctx, x + (h % 11), g.FIELD_H - 6.5 - (h % 4), 13, 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return shore;
  }

  // A moss veil: strands hanging from a branch or an eave, swaying never
  // (the still layer), pale at their moonlit tips.
  function mossVeil(ctx, x, top, len, seed) {
    for (let k = 0; k < 5; k++) {
      const mx = x + (k - 2) * 0.9 + (rnd(seed, k) - 0.5) * 0.6;
      const l = len * (0.5 + rnd(seed, k + 11) * 0.7);
      ctx.strokeStyle = k % 2 ? MOSS : "#2c4528";
      ctx.lineWidth = 0.3;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.moveTo(mx, top);
      ctx.quadraticCurveTo(mx + (rnd(seed, k + 21) - 0.5) * 1.6, top + l * 0.6, mx + (rnd(seed, k + 31) - 0.5) * 2, top + l);
      ctx.stroke();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = MOSS_LIT;
      ctx.fillRect(mx + (rnd(seed, k + 31) - 0.5) * 2 - 0.2, top + l - 0.4, 0.45, 0.6);
    }
    ctx.globalAlpha = 1;
  }

  // The hollow: closer dead cypress between you and the water, moss veils
  // on their limbs, cypress knees poking out of the pools, firefly flecks
  // hanging in the dark.
  function hollowStand(ctx, v, look, x0, x1, shore, floorAt) {
    const { g } = v;
    for (let x = Math.floor(x0 / 37) * 37 + 9; x < x1 + 37; x += 37) {
      const n = Math.round(x / 37);
      const h = hash(n, 7);
      if (h % 4 === 0) continue;
      const tx = x + (h % 12);
      deadTree(ctx, tx, g.FIELD_H - 2, 16 + (h % 8), "#122016", n * 17 + 3);
      if (h % 3 === 0) mossVeil(ctx, tx + 1.5, g.FIELD_H - 11 - (h % 5), 6 + (h % 4), n * 7);
    }
    // Cypress knees along the floor line.
    ctx.fillStyle = "#131c12";
    for (let x = Math.floor(x0 / 9) * 9 + 3; x < x1 + 9; x += 9) {
      const n = Math.round(x / 9);
      const fy = floorAt(x);
      if (fy === null || hash(n, 13) % 3 === 0) continue;
      ctx.beginPath();
      ctx.moveTo(x - 0.8, fy);
      ctx.lineTo(x, fy - 2.4 - (hash(n, 15) % 3) * 0.7);
      ctx.lineTo(x + 0.8, fy);
      ctx.closePath();
      ctx.fill();
    }
    // Fireflies: small warm flecks adrift above the pools.
    for (let x = Math.floor(x0 / 23) * 23 + 6; x < x1 + 23; x += 23) {
      const n = Math.round(x / 23);
      const h = hash(n, 41);
      if (h % 3 === 0) continue;
      const fy = floorAt(x + (h % 9));
      if (fy === null) continue;
      ctx.globalAlpha = 0.3 + (h % 4) * 0.14;
      ctx.fillStyle = FIRE_FLY;
      ctx.fillRect(x + (h % 9), fy - 3 - (h % 7), 0.3, 0.3);
      ctx.globalAlpha = 0.12;
      circle(ctx, x + (h % 9) + 0.15, fy - 3 - (h % 7) + 0.15, 0.8);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The hag's house on its stilts over the water: leaning piles, a sagging
  // shack of gray boards, one window warm against the whole cold swamp.
  function stiltHouse(ctx, v, x0, x1) {
    const { g } = v;
    const base = g.FIELD_H - 4;
    for (let x = Math.floor(x0 / 130) * 130 + 60; x < x1 + 130; x += 130) {
      const n = Math.round(x / 130);
      const h = hash(n, 3);
      const hx = x + (h % 20) - 10;
      const w = 26 + (h % 8);
      const top = base - 15 - (h % 4);
      // The stilts, two of them a touch splayed.
      ctx.strokeStyle = "#171008";
      ctx.lineWidth = 0.9;
      line(ctx, hx - w * 0.34, base + 2, hx - w * 0.38, top);
      line(ctx, hx + w * 0.34, base + 2, hx + w * 0.38, top);
      ctx.lineWidth = 0.5;
      line(ctx, hx - w * 0.36, base - 4, hx + w * 0.36, base - 7);
      // The shack, leaning a little, roof of sod.
      ctx.save();
      ctx.translate(hx, top);
      rotate(ctx, (rnd(n, 9) - 0.5) * 0.06);
      ctx.fillStyle = "#241a10";
      ctx.fillRect(-w / 2, -8, w, 8);
      ctx.strokeStyle = "#0e0a05";
      ctx.lineWidth = 0.18;
      for (let bx = -w / 2 + 1; bx < w / 2; bx += 2.1) line(ctx, bx, -8, bx, 0);
      ctx.fillStyle = "#161009";
      ctx.beginPath();
      ctx.moveTo(-w / 2 - 2.5, -8);
      ctx.lineTo(-w * 0.1, -12.5);
      ctx.lineTo(w / 2 + 2.5, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#0c0804";
      ctx.lineWidth = 0.16;
      for (let k = 0; k < 6; k++) line(ctx, -w / 2 - 2 + k * (w / 5), -8 - k * 0.7, -w / 2 - 2 + (k + 2.6) * (w / 5), -8 - k * 0.7);
      // The one warm window, cross-barred, a figure's shadow never still.
      ctx.fillStyle = "#c8923e";
      ctx.globalAlpha = 0.85;
      ctx.fillRect(-w * 0.16, -6.4, w * 0.2, 4);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#1a120a";
      ctx.fillRect(-w * 0.16 + w * 0.09, -6.4, 0.5, 4);
      ctx.fillRect(-w * 0.16, -4.6, w * 0.2, 0.5);
      halo(ctx, 0, -4.4, 4.5, "#c8923e", 0.3);
      // A door like a hole.
      ctx.fillStyle = "#0a0603";
      ctx.fillRect(w * 0.2, -5.5, w * 0.14, 5.5);
      mossVeil(ctx, -w / 2 + 1.5, -8, 5, n * 11);
      ctx.restore();
    }
  }

  // The Drowning Pool's middle: open water, only the far trees and the
  // arena's mooring posts with their rope.
  function drowningWater(ctx, v, x0, x1, shore) {
    const { g } = v;
    for (let x = Math.floor(x0 / 34) * 34 + 8; x < x1 + 34; x += 34) {
      const n = Math.round(x / 34);
      const h = hash(n, 11);
      if (h % 4 === 0) continue;
      const px = x + (h % 10);
      ctx.fillStyle = "#14100a";
      ctx.fillRect(px - 0.5, shore + 2, 1, g.FIELD_H - shore - 4);
      ctx.fillStyle = "#0a0805";
      ctx.fillRect(px - 0.8, shore + 1.4, 1.6, 0.8);
      ctx.strokeStyle = "#241c10";
      ctx.lineWidth = 0.18;
      ctx.beginPath();
      ctx.moveTo(px, shore + 3.4);
      ctx.quadraticCurveTo(px + 8, shore + 5.4, px + 16, shore + 3.6);
      ctx.stroke();
    }
  }

  // The boardwalk behind you: more of the same sagging planks running back
  // along the water on their posts, sinking out of sight.
  function farBoardwalk(ctx, v, x0, x1, shore) {
    const { g } = v;
    ctx.strokeStyle = "#141c14";
    ctx.lineWidth = 0.5;
    const deckY = shore + 6.5;
    ctx.beginPath();
    ctx.moveTo(x0, deckY);
    for (let x = x0; x <= x1 + 1; x += 4) ctx.lineTo(x, deckY + Math.sin(x / 31) * 0.8);
    ctx.stroke();
    ctx.lineWidth = 0.35;
    for (let x = Math.floor(x0 / 11) * 11 + 4; x < x1 + 11; x += 11) {
      const n = Math.round(x / 11);
      if (hash(n, 8) % 4 === 0) continue;
      const py = deckY + Math.sin(x / 31) * 0.8;
      line(ctx, x, py, x + (hash(n, 5) % 3 - 1) * 0.5, g.FIELD_H - 1);
    }
  }

  // The night behind a room, then what the room is: the hollow's trees and
  // moss, the stilt house, the arena's moorings.
  function backdrop(ctx, v, look, x0, x1) {
    const { spec, g } = v;
    const Y = (y) => g.FIELD_H - y;
    const floorAt = (x) => {
      const gy = v.groundAt(spec, x);
      return gy > -Infinity ? Y(gy) : null;
    };
    const shore = swampNight(ctx, v, look, x0, x1);
    if (look.scene === "boardwalk") farBoardwalk(ctx, v, x0, x1, shore);
    else if (look.scene === "hollow") hollowStand(ctx, v, look, x0, x1, shore, floorAt);
    else if (look.scene === "stilts") {
      hollowStand(ctx, v, look, x0, x1, shore, floorAt);
      stiltHouse(ctx, v, x0, x1);
    } else if (look.scene === "drowning") drowningWater(ctx, v, x0, x1, shore);
  }

  /* ----------------------------------------------------- floors, shelves */

  // Where a span of `spans` ([x0, x1] pairs) covers [a, b]: the overlaps,
  // as [max, min] pairs inside the piece.
  function spansIn(spec, key, a, b) {
    const out = [];
    for (const [s0, s1] of spec[key] || []) {
      const lo = Math.max(s0, a);
      const hi = Math.min(s1, b);
      if (hi - lo > 0.4) out.push([lo, hi]);
    }
    return out;
  }

  // A mud sheen over [a, b] at floor top fy: glossy muck lapping over the
  // planks, a lighter meniscus at its edge, bubbles where it breathes.
  function mudSheen(ctx, a, b, fy, seed) {
    ctx.fillStyle = MUD_DARK;
    ctx.beginPath();
    ctx.moveTo(a, fy);
    for (let x = a; x <= b; x += 2) ctx.lineTo(x, fy - 0.5 - Math.sin(x / 5 + seed) * 0.3);
    ctx.lineTo(b, fy + 1.6);
    ctx.lineTo(a, fy + 1.6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MUD;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(a, fy - 0.2);
    for (let x = a; x <= b; x += 2) ctx.lineTo(x, fy - 0.7 - Math.sin(x / 5 + seed) * 0.3);
    ctx.lineTo(b, fy + 0.9);
    ctx.lineTo(a, fy + 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = MUD_LIT;
    for (let x = a + 1; x < b - 0.6; x += 3.4) {
      const h = hash(seed + Math.round(x * 10), 7);
      if (h % 3) ctx.fillRect(x, fy - 0.9 - Math.sin(x / 5 + seed) * 0.3, 1.4 + (h % 3) * 0.4, 0.28);
    }
    for (let x = a + 2; x < b - 1; x += 5.2) {
      const h = hash(seed + Math.round(x * 10), 11);
      if (h % 4) continue;
      circle(ctx, x, fy - 0.5, 0.22 + (h % 3) * 0.08);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // A pool of black water on the boards [a, b] at fy: the surface a shade
  // off the planks, the moon's sheen broken across it.
  function poolSheen(ctx, a, b, fy, seed) {
    ctx.fillStyle = WATER;
    ctx.fillRect(a, fy - 0.5, b - a, 1.6);
    ctx.fillStyle = WATER_SHEEN;
    ctx.globalAlpha = 0.4;
    for (let x = a + 0.8; x < b - 0.8; x += 3.1) {
      const h = hash(seed + Math.round(x * 10), 5);
      if (h % 3 === 0) continue;
      ctx.fillRect(x, fy - 0.35 + (h % 3) * 0.3, 1.6 + (h % 4) * 0.4, 0.22);
    }
    ctx.globalAlpha = 1;
  }

  // One floor piece, [a, b] with its top at `top`: the boardwalk's planks,
  // sagging a little between their posts, grain and nails, rotted edges;
  // where the spec's mud lies over it a wet sheen sits in the dip, where a
  // pool lies the water laps the boards.
  function ground(ctx, v, look, a, b, top) {
    const { spec, g } = v;
    const fy = g.FIELD_H - top;
    const w = b - a;
    const seed = Math.round(a * 7);
    const sag = Math.min(1.1, w / 60);
    // The planks, top down to the water line: a deck of weathered boards
    // with a sagging lower edge.
    ctx.fillStyle = look.floor;
    ctx.beginPath();
    ctx.moveTo(a, fy);
    for (let x = a; x <= b; x += 3) ctx.lineTo(x, fy + Math.sin(((x - a) / w) * Math.PI) * sag * 0.4);
    ctx.lineTo(b, fy + top);
    ctx.lineTo(a, fy + top);
    ctx.closePath();
    ctx.fill();
    // Board seams and the pale worn top edge.
    ctx.fillStyle = look.floorTop;
    ctx.globalAlpha = 0.9;
    for (let x = a; x < b; x += 3) ctx.fillRect(x, fy + Math.sin(((x - a) / w) * Math.PI) * sag * 0.4, Math.min(2.7, b - x), 0.9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PLANK_EDGE;
    for (let x = a + 2.7; x < b - 0.5; x += 3) ctx.fillRect(x, fy, 0.35, top);
    // Grain flecks and nail heads.
    for (let x = a + 0.8; x < b - 0.6; x += 1.7) {
      const h = hash(seed + Math.round(x * 10), 3);
      ctx.fillStyle = h % 2 ? PLANK_DARK : "#3c3a28";
      ctx.globalAlpha = 0.5;
      ctx.fillRect(x, fy + 1.4 + (h % 4) * 0.7, 1 + (h % 3) * 0.5, 0.3);
      ctx.globalAlpha = 1;
    }
    for (let x = a + 1.6; x < b - 1; x += 6) {
      const h = hash(seed + Math.round(x), 9);
      if (h % 3 === 0) continue;
      ctx.fillStyle = "#171310";
      ctx.fillRect(x, fy + Math.sin(((x - a) / w) * Math.PI) * sag * 0.4 + 0.35, 0.3, 0.3);
    }
    // A rotted bite out of the far edge now and then.
    const edge = hash(seed, 17) % 5;
    if (edge < 2 && w > 12) {
      const ex = edge ? a + 1 : b - 1;
      ctx.fillStyle = look.wainscot;
      ctx.beginPath();
      ctx.moveTo(ex, fy + 1);
      for (let k = 0; k < 4; k++) ctx.lineTo(ex + (edge ? -1 : 1) * (0.4 + k * 0.5), fy + 1 + k * (top / 4));
      ctx.lineTo(ex, fy + top);
      ctx.closePath();
      ctx.fill();
    }
    // Where the mire reaches over it: mud sheen in the dips, pool water in
    // the wet spans.
    for (const [m0, m1] of spansIn(spec, "mud", a, b)) mudSheen(ctx, m0, m1, fy, seed + Math.round(m0));
    for (const [w0, w1] of spansIn(spec, "water", a, b)) poolSheen(ctx, w0, w1, fy, seed + Math.round(w0));
  }

  // One shelf: more of the same planks on two posts, sagging in the middle.
  function shelf(ctx, v, look, a, b, y) {
    const { spec, g } = v;
    const w = b - a;
    const sag = Math.min(0.8, w / 40);
    ctx.fillStyle = look.shelf;
    ctx.beginPath();
    ctx.moveTo(a, y);
    for (let x = a; x <= b; x += 2) ctx.lineTo(x, y + Math.sin(((x - a) / w) * Math.PI) * sag);
    ctx.lineTo(b, y + 1.7);
    ctx.lineTo(a, y + 1.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = look.shelfTop;
    for (let x = a; x < b; x += 2) {
      const sy = y + Math.sin(((x - a) / w) * Math.PI) * sag;
      ctx.fillRect(x, sy, Math.min(1.6, b - x), 0.55);
    }
    ctx.fillStyle = PLANK_EDGE;
    for (let x = a + 1.7; x < b - 0.4; x += 2) ctx.fillRect(x, y + Math.sin(((x - a) / w) * Math.PI) * sag, 0.28, 1.7);
    // The posts: two under each board, off into the water.
    const gy = v.groundAt(spec, (a + b) / 2);
    const postBase = gy > -Infinity ? g.FIELD_H - gy : y + 7;
    ctx.fillStyle = "#1a140c";
    for (const px of [a + 1.2, b - 1.6]) {
      ctx.fillRect(px, y + 1.5, 0.7, postBase - y - 1.5);
    }
  }

  /* ------------------------------------------------------------- kinds */

  // The lurker: while `eyes` just a brow line and two pale eyes at the
  // waterline, a ripple either side; while `snap` the whole beast lunging
  // out of the water, jaws open on you (SNAP_MS of lunge); while `sink` a
  // swirl going back down, the eyes last to go.
  function lurker(ctx, v, m, x, y, t, flash) {
    const C = (c) => (flash ? FLASH : c);
    const d = m.dir || 1;
    if (m.act === "snap") {
      const p = m.wait > 0 ? clamp(1 - m.wait / SNAP_MS, 0, 1) : 1;
      // Out of the water fastest at first, settling into the lunge.
      const up = Math.min(1, p * 3);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(d, 1);
      // The wake it threw up.
      ctx.globalAlpha = 0.5 * (1 - p * 0.6);
      ctx.fillStyle = WATER_SHEEN;
      ellipse(ctx, -d * 0.5, 0.1, m.w * 0.75 * up + 0.5, 0.5);
      ctx.fill();
      ctx.globalAlpha = 1;
      // The lunge: head and shoulders rearing well clear of the water.
      const rise = -up * (m.h * 1.15);
      ctx.fillStyle = C(LURKER);
      ctx.beginPath();
      ctx.moveTo(-m.w * 0.55, 0);
      ctx.quadraticCurveTo(-m.w * 0.5, rise - 1.2, m.w * 0.34, rise - 1.05);
      ctx.lineTo(m.w * 0.62, rise - 0.5);
      ctx.lineTo(m.w * 0.5, rise - 0.1);
      ctx.quadraticCurveTo(0, rise + 0.7, -m.w * 0.55, 0);
      ctx.closePath();
      ctx.fill();
      // The jaw, dropped open on the lunge.
      const gape = Math.sin(Math.min(1, p * 2) * Math.PI * 0.5);
      ctx.fillStyle = C(LURKER_MAW);
      ctx.beginPath();
      ctx.moveTo(m.w * 0.5, rise - 0.12);
      ctx.lineTo(m.w * (0.56 - 0.1 * gape), rise + 0.9 * gape + 0.15);
      ctx.lineTo(-m.w * 0.1, rise + 0.75 * gape + 0.1);
      ctx.closePath();
      ctx.fill();
      // Needle teeth along the upper jaw.
      ctx.fillStyle = "#d8dcc8";
      for (let k = 0; k < 5; k++) {
        const tx = m.w * 0.44 - k * m.w * 0.11;
        ctx.beginPath();
        ctx.moveTo(tx, rise - 0.14);
        ctx.lineTo(tx + 0.12, rise - 0.14);
        ctx.lineTo(tx + 0.05, rise + 0.22 * gape);
        ctx.closePath();
        ctx.fill();
      }
      // Back ridges and the one eye.
      ctx.fillStyle = C(LURKER_LIT);
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-m.w * 0.5 + k * 0.9, rise * 0.35 - 0.1);
        ctx.lineTo(-m.w * 0.28 + k * 0.9, rise * 0.9 - 0.9);
        ctx.lineTo(-m.w * 0.1 + k * 0.9, rise * 0.35 - 0.1);
        ctx.closePath();
        ctx.fill();
      }
      eye(v, x + d * m.w * 0.3, y + rise - 0.62, 0.3, EYE_AMBER);
      ctx.restore();
      return;
    }
    if (m.act === "sink") {
      // A swirl where it went down, the eyes just under, going dim.
      const p = m.wait > 0 ? clamp(m.wait / LURKER_SINK_MS, 0, 1) : 0;
      ctx.strokeStyle = WATER_SHEEN;
      ctx.lineWidth = 0.2;
      ctx.globalAlpha = 0.7;
      for (const [rx, ry] of [[m.w * 0.5, 0.35], [m.w * 0.32, 0.24]]) {
        ellipse(ctx, x, y + 0.1, rx * (1.6 - p * 0.6), ry * (1.6 - p * 0.6));
        ctx.stroke();
      }
      ctx.globalAlpha = p;
      eye(v, x - 0.62, y - 0.1, 0.24, EYE_PALE);
      eye(v, x + 0.62, y - 0.1, 0.24, EYE_PALE);
      ctx.globalAlpha = 1;
      return;
    }
    // `eyes`: two at the waterline under one heavy brow, a slow blink now
    // and then (closed a tenth of the time), a small wake either side.
    const blink = (t / 1600 + m.id * 0.13) % 1 > 0.93 ? 0.25 : 1;
    ctx.strokeStyle = WATER_SHEEN;
    ctx.lineWidth = 0.16;
    ctx.globalAlpha = 0.55;
    ellipse(ctx, x - 1.1, y + 0.15, 1.5, 0.3);
    ctx.stroke();
    ellipse(ctx, x + 1.1, y + 0.15, 1.5, 0.3);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The brow: a low dome of wet hide, its moonlit rim keeping the shape
    // readable in a dark room.
    ctx.fillStyle = C(LURKER);
    ctx.beginPath();
    ctx.moveTo(x - 1.6, y + 0.15);
    ctx.quadraticCurveTo(x, y - 1.5 * blink, x + 1.6, y + 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = C(LURKER_LIT);
    ctx.lineWidth = 0.2;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(x - 1.3, y - 0.12);
    ctx.quadraticCurveTo(x, y - 1.35 * blink, x + 1.3, y - 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (blink === 1) {
      ctx.fillStyle = C("#cfe0d0");
      circle(ctx, x - 0.55, y - 0.5, 0.26);
      ctx.fill();
      circle(ctx, x + 0.55, y - 0.5, 0.26);
      ctx.fill();
      ctx.fillStyle = C(LURKER_MAW);
      circle(ctx, x - 0.55, y - 0.5, 0.12);
      ctx.fill();
      circle(ctx, x + 0.55, y - 0.5, 0.12);
      ctx.fill();
      eye(v, x - 0.55, y - 0.5, 0.16, EYE_PALE);
      eye(v, x + 0.55, y - 0.5, 0.16, EYE_PALE);
    }
  }

  // The leech swarm: a roiling blob that never sits still, paler leech
  // squiggles curling through it; `drop` is it letting go and falling off
  // you, strewn a little.
  function leech(ctx, v, m, x, y, t, flash) {
    const C = (c) => (flash ? FLASH : c);
    const roil = Math.sin(t / 140);
    ctx.fillStyle = C(LEECH);
    ellipse(ctx, x, y - m.h * 0.45, m.w * 0.52, m.h * 0.45 + roil * 0.12);
    ctx.fill();
    ellipse(ctx, x - m.w * 0.22, y - m.h * 0.3, m.w * 0.3, m.h * 0.3 - roil * 0.1);
    ctx.fill();
    ellipse(ctx, x + m.w * 0.24, y - m.h * 0.52, m.w * 0.28, m.h * 0.28 + roil * 0.08);
    ctx.fill();
    // The squiggles: leech curls over the mass.
    ctx.strokeStyle = C(LEECH_LIT);
    ctx.lineWidth = 0.2;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU + t / 300;
      const sx = x + Math.cos(a) * m.w * 0.3;
      const sy = y - m.h * 0.45 + Math.sin(a) * m.h * 0.26;
      ctx.beginPath();
      ctx.moveTo(sx - 0.4, sy + Math.sin(a * 3) * 0.14);
      ctx.quadraticCurveTo(sx, sy - 0.3, sx + 0.4, sy + Math.cos(a * 2) * 0.14);
      ctx.stroke();
    }
    // A wet rim under it.
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = WATER_SHEEN;
    ellipse(ctx, x, y + 0.05, m.w * 0.6, 0.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    eye(v, x - m.w * 0.14, y - m.h * 0.55, 0.14, EYE_PALE);
    eye(v, x + m.w * 0.18, y - m.h * 0.5, 0.14, EYE_PALE);
  }

  // The will-o'-wisp: `bright` a flame-licked orb of cold light, pulsing,
  // shedding a spark or two; `dim` a grey ember sinking; `rekindle` a glow
  // gathering where it will burn again, brighter the nearer it is.
  function wisp(ctx, v, m, x, y, t, flash) {
    const cy = y - m.h / 2;
    if (m.act === "dim") {
      ctx.fillStyle = WISP_DIM;
      ctx.globalAlpha = 0.7;
      circle(ctx, x, cy, 0.35);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      circle(ctx, x, cy, 0.8);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    if (m.act === "rekindle") {
      const p = m.wait > 0 ? clamp(1 - m.wait / WISP_REKINDLE_MS, 0, 1) : 1;
      halo(ctx, x, cy, 1.4 + p * 1.2, WISP, 0.3 + p * 0.4);
      ctx.fillStyle = WISP;
      ctx.globalAlpha = 0.4 + p * 0.55;
      circle(ctx, x, cy, 0.3 + p * 0.5);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const pulse = 0.85 + Math.sin(t / 210 + m.id) * 0.15;
    halo(ctx, x, cy, 2.8 * pulse, WISP, 0.55);
    // The flame: a teardrop of near-white in the green.
    ctx.fillStyle = flash ? FLASH : WISP;
    ctx.beginPath();
    ctx.moveTo(x, cy - m.h * 0.72 * pulse);
    ctx.quadraticCurveTo(x + m.w * 0.5, cy - m.h * 0.2, x + m.w * 0.4, cy + m.h * 0.3);
    ctx.quadraticCurveTo(x, cy + m.h * 0.62, x - m.w * 0.4, cy + m.h * 0.3);
    ctx.quadraticCurveTo(x - m.w * 0.5, cy - m.h * 0.2, x, cy - m.h * 0.72 * pulse);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = WISP_HOT;
    ctx.beginPath();
    ctx.moveTo(x, cy - m.h * 0.4 * pulse);
    ctx.quadraticCurveTo(x + m.w * 0.22, cy - m.h * 0.05, x, cy + m.h * 0.3);
    ctx.quadraticCurveTo(x - m.w * 0.22, cy - m.h * 0.05, x, cy - m.h * 0.4 * pulse);
    ctx.closePath();
    ctx.fill();
    // A spark drifting off, now and then.
    const sp = (t / 900 + m.id * 0.37) % 1;
    if (sp < 0.4) {
      ctx.globalAlpha = 0.5 * (1 - sp / 0.4);
      ctx.fillStyle = WISP;
      ctx.fillRect(x + 0.7 + sp * 2, cy - 0.5 - sp * 3, 0.22, 0.22);
      ctx.globalAlpha = 1;
    }
  }

  // The bog body: a zombie in every way but the muck: while `rise` it is
  // climbing out of a wet hole, mud sheeting off; while `walk` it shambles,
  // weeds in its shoulders, drips falling off its arms; `lurching` leans it
  // further.
  function bogbody(ctx, v, m, x, y, t, flash) {
    const C = (c) => (flash ? FLASH : c);
    const d = m.dir || 1;
    const up = m.act === "rise" ? (m.rise > 0 ? clamp(1 - m.rise / BOG_RISE_MS, 0, 1) : 0.4) : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d, 1);
    // The hole it came from, while rising.
    if (m.act === "rise") {
      ctx.fillStyle = MUD_DARK;
      ellipse(ctx, 0, 0.1, 2.4, 0.5);
      ctx.fill();
      ctx.fillStyle = MUD;
      ctx.globalAlpha = 0.6;
      ellipse(ctx, 0, 0, 2, 0.35);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.translate(0, -up * m.h * 0.04);
    const step = m.act === "walk" ? Math.sin(t / 170) : 0;
    const lean = m.lurching ? 0.16 : 0.08;
    ctx.translate(0, (1 - up) * m.h * 0.8);
    ctx.scale(1, up);
    ctx.save();
    ctx.rotate(lean * d);
    // Legs, caked to the knee.
    ctx.strokeStyle = C(BOGSKIN_DARK);
    ctx.lineWidth = 0.55;
    line(ctx, -0.5, -m.h * 0.42, -0.5 - step * 0.6, -0.1);
    line(ctx, 0.5, -m.h * 0.42, 0.5 + step * 0.6, -0.1);
    // The trunk: hunched, mud plates cracked open over gray skin.
    ctx.fillStyle = C(BOGSKIN);
    ctx.beginPath();
    ctx.moveTo(-1.15, -m.h * 0.45);
    ctx.quadraticCurveTo(-1.3, -m.h * 0.86, -0.5, -m.h * 0.94);
    ctx.lineTo(0.7, -m.h * 0.94);
    ctx.quadraticCurveTo(1.3, -m.h * 0.8, 1.15, -m.h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C(BOGSKIN_LIT);
    for (const [px, py, s] of [[-0.6, -m.h * 0.62, 0.5], [0.3, -m.h * 0.55, 0.42], [0.75, -m.h * 0.78, 0.4], [-0.2, -m.h * 0.8, 0.36]]) {
      ellipse(ctx, px, py, s, s * 0.6, 0.4);
      ctx.fill();
    }
    // Arms, hanging and dripping, the front one reaching a little.
    ctx.strokeStyle = C(BOGSKIN);
    ctx.lineWidth = 0.5;
    const reach = m.lurching ? 0.9 : 0.4;
    line(ctx, 0.9, -m.h * 0.8, 1.15 + reach, -m.h * 0.34 - reach * 0.4);
    line(ctx, -0.9, -m.h * 0.8, -1.05, -m.h * 0.32);
    // The head: low, sunk between the shoulders, weeds over it.
    ctx.fillStyle = C(BOGSKIN_DARK);
    ellipse(ctx, 0.3, -m.h * 0.97, 0.72, 0.62);
    ctx.fill();
    ctx.strokeStyle = MOSS_LIT;
    ctx.lineWidth = 0.18;
    for (const [lx, ly, bend] of [[-0.1, -m.h * 1.22, -0.4], [0.4, -m.h * 1.28, 0.2], [0.75, -m.h * 1.18, 0.6], [-0.55, -m.h * 1.12, -0.7]]) {
      ctx.beginPath();
      ctx.moveTo(lx, -m.h * 0.98);
      ctx.quadraticCurveTo(lx + bend * 0.4, -m.h * 1.05, lx + bend, ly);
      ctx.stroke();
    }
    // Drips off the reaching arm.
    ctx.fillStyle = MUD_LIT;
    ctx.globalAlpha = 0.7;
    const drip = (t / 700 + m.id * 0.3) % 1;
    if (drip < 0.5) ctx.fillRect(1.15 + reach - 0.1, -m.h * 0.34 + drip * 2.6, 0.18, 0.3);
    ctx.globalAlpha = 1;
    ctx.restore();
    eye(v, x + d * 0.12, y - m.h * 0.97 * up - (1 - up) * 0.5, 0.2, EYE_PALE);
    eye(v, x + d * 0.52, y - m.h * 0.95 * up - (1 - up) * 0.5, 0.2, EYE_PALE);
    ctx.restore();
  }

  /* ---------------------------------------------------- Old Mother Bog */

  // Her cauldron at (cx, feet): a potted belly of black iron on three feet
  // over a small fire. `lit` is the weak window: the lid off and the green
  // glow out of it, readable at a glance.
  function cauldron(ctx, v, cx, fy, lit, t, flash) {
    // The fire under it, always low; brighter while it is open.
    ctx.fillStyle = "#c86a2e";
    ctx.globalAlpha = lit ? 0.85 : 0.4;
    for (let k = 0; k < 3; k++) {
      const fl = Math.abs(Math.sin(t / 90 + k * 2));
      ctx.beginPath();
      ctx.moveTo(cx - 0.8 + k * 0.8, fy);
      ctx.quadraticCurveTo(cx - 0.7 + k * 0.8, fy - 0.9 - fl * 0.7, cx - 0.5 + k * 0.8, fy - 1.1 - fl * 0.9);
      ctx.quadraticCurveTo(cx - 0.3 + k * 0.8, fy - 0.8, cx - 0.2 + k * 0.8, fy);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = flash ? FLASH : CAULDRON;
    ellipse(ctx, cx, fy - 1.7, 1.7, 1.35);
    ctx.fill();
    ctx.fillRect(cx - 1.6, fy - 1.9, 3.2, 0.5);
    for (const s of [-1, 0, 1]) {
      ctx.fillRect(cx + s * 1.1 - 0.18, fy - 0.8, 0.36, 0.8);
    }
    // The rim.
    ctx.fillStyle = flash ? FLASH : "#3a382a";
    ellipse(ctx, cx, fy - 3, 1.5, 0.5);
    ctx.fill();
    if (lit) {
      // Open: a green stew glowing up out of it, a lick of vapor.
      ctx.fillStyle = CAULDRON_LIT;
      ellipse(ctx, cx, fy - 3, 1.2, 0.36);
      ctx.fill();
      halo(ctx, cx, fy - 3.3, 2.4, CAULDRON_LIT, 0.7);
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = CAULDRON_LIT;
      for (let k = 0; k < 3; k++) {
        const p = (t / 700 + k / 3) % 1;
        circle(ctx, cx - 0.5 + k * 0.5 + Math.sin(p * 6 + k) * 0.3, fy - 3.4 - p * 2, 0.2 * (1 - p) + 0.06);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // The lid, off and leaning on its side.
      ctx.fillStyle = flash ? FLASH : "#3a382a";
      ctx.save();
      ctx.translate(cx + 2, fy - 0.8);
      rotate(ctx, 1.2);
      ellipse(ctx, 0, 0, 1.2, 0.4);
      ctx.fill();
      ctx.restore();
    } else {
      // Lidded: a gray lid with its ring handle.
      ctx.fillStyle = flash ? FLASH : "#2c2a20";
      ellipse(ctx, cx, fy - 3.1, 1.35, 0.45);
      ctx.fill();
      ctx.strokeStyle = "#4a4836";
      ctx.lineWidth = 0.15;
      ellipse(ctx, cx, fy - 3.5, 0.35, 0.2);
      ctx.stroke();
    }
  }

  // Old Mother Bog herself, feet at (b.x, y): a stooping hag of mud and
  // reed, her cauldron beside her. `idle` she hunches over it, drifting;
  // `wind` she throws both arms wide to pull the mud wave up; `rest` she
  // sags, the cauldron cracking open late in it; `throwWind` she leans in
  // to spit; `sink` she is going down in a swirl, `under` only her bubbles
  // remain, `resurface` she is coming up wet.
  function motherbog(ctx, v, b) {
    const { g } = v;
    const t = v.clock;
    const flash = b.hurt > 0;
    const d = b.dir || 1;
    // Under the water there is no hag to draw: `sink` shows the swirl where
    // she went down, `under` the bubbles over the spot she will rise.
    if (b.act === "under") {
      const bx = b.sinkX ?? b.x;
      const fy = g.FIELD_H - (b.home ?? b.y);
      ctx.strokeStyle = WATER_SHEEN;
      ctx.lineWidth = 0.2;
      ctx.globalAlpha = 0.6;
      ellipse(ctx, bx, fy + 0.1, 3.4, 0.7);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#d8f0e0";
      for (let k = 0; k < 8; k++) {
        const p = (t / 560 + k / 8) % 1;
        ctx.globalAlpha = 0.9 * (1 - p * 0.7);
        circle(ctx, bx - 2 + ((k * 53) % 40) / 10 + Math.sin(p * 7 + k) * 0.5, fy - p * 3, 0.42 * (1 - p * 0.4));
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    if (b.act === "sink") {
      const fy = g.FIELD_H - (b.home ?? b.y);
      ctx.strokeStyle = WATER_SHEEN;
      ctx.lineWidth = 0.22;
      ctx.globalAlpha = 0.8;
      ellipse(ctx, b.x, fy + 0.1, b.w * 0.6, 0.9);
      ctx.stroke();
      ellipse(ctx, b.x, fy + 0.1, b.w * 0.38, 0.55);
      ctx.stroke();
      ctx.globalAlpha = 1;
      // The last of her hat going under.
      const p = b.wait > 0 && Number.isFinite(b.wait) ? clamp(1 - b.wait / MOTHER_SINK_MS, 0, 1) : 1;
      ctx.fillStyle = flash ? FLASH : HAG_DARK;
      ctx.globalAlpha = 1 - p;
      ctx.beginPath();
      ctx.moveTo(b.x - 1.6, fy + 0.4);
      ctx.lineTo(b.x, fy - 2.6 * (1 - p));
      ctx.lineTo(b.x + 1.6, fy + 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const x = b.x;
    const y = g.FIELD_H - b.y;
    const C = (c) => (flash ? FLASH : c);
    const resurface = b.act === "resurface" && Number.isFinite(b.wait) ? clamp(b.wait / RESURFACE_MS, 0, 1) : 0;
    const wind = b.act === "wind" && Number.isFinite(b.wait) ? clamp(1 - b.wait / MOTHER_WIND_MS, 0, 1) : 0;
    const throwP = b.act === "throwWind" && Number.isFinite(b.wait) ? clamp(1 - b.wait / SPIT_WIND_MS, 0, 1) : 0;
    const breathe = Math.sin(t / 800);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(d, 1);
    ctx.translate(0, resurface * b.h * 0.8);
    ctx.scale(1, 1 - resurface * 0.9);
    // Rising: a ring and water sheeting off her.
    if (resurface > 0) {
      ctx.strokeStyle = WATER_SHEEN;
      ctx.lineWidth = 0.2;
      ellipse(ctx, 0, 0.2, b.w * 0.62, 0.8);
      ctx.stroke();
    }
    // The cauldron on her far side, close enough to tend.
    cauldron(ctx, v, b.w * 0.5 + 1.6, 0, b.lit, t, flash);
    ctx.save();
    ctx.rotate((b.act === "rest" ? 0.05 : 0.02) * Math.sin(t / 900));
    // The hag's cloak of mud and reed, a humped stoop.
    const hunch = b.act === "rest" ? 0.12 : 0;
    ctx.fillStyle = C(HAG);
    ctx.beginPath();
    ctx.moveTo(-b.w * 0.42, 0);
    ctx.quadraticCurveTo(-b.w * 0.5, -b.h * 0.4, -b.w * 0.3, -b.h * (0.62 - hunch));
    ctx.quadraticCurveTo(-b.w * 0.16, -b.h * (0.8 - hunch), 0, -b.h * (0.82 - hunch));
    ctx.quadraticCurveTo(b.w * 0.3, -b.h * (0.8 - hunch), b.w * 0.42, -b.h * 0.42);
    ctx.quadraticCurveTo(b.w * 0.5, -b.h * 0.2, b.w * 0.44, 0);
    ctx.closePath();
    ctx.fill();
    // Mud plates and reed fringes over the cloak.
    ctx.fillStyle = C(HAG_LIT);
    for (const [px, py, s] of [[-1.6, -2.2, 0.7], [0.4, -3.4, 0.8], [1.8, -1.8, 0.6], [-0.6, -1.4, 0.5]]) {
      ellipse(ctx, px, py, s, s * 0.55, 0.5);
      ctx.fill();
    }
    ctx.strokeStyle = C(HAG_DARK);
    ctx.lineWidth = 0.2;
    for (let k = 0; k < 7; k++) {
      const fx = -b.w * 0.4 + k * (b.w * 0.8) / 6;
      const l = 1 + (hash(k * 13, 5) % 3) * 0.5;
      line(ctx, fx, -0.4 - (k % 2) * 0.5, fx + (hash(k, 3) % 3 - 1) * 0.4, -0.4 - (k % 2) * 0.5 + l);
    }
    // Her arms: thrown wide for the wind, raised over the cauldron for the
    // spit, hanging long otherwise.
    ctx.strokeStyle = C(HAG_DARK);
    ctx.lineWidth = 0.7;
    if (b.act === "wind") {
      const spread = wind * 1.9;
      line(ctx, -0.5, -b.h * 0.62, -1.4 - spread, -b.h * 0.62 - spread * 0.8);
      line(ctx, 0.5, -b.h * 0.62, 1.4 + spread, -b.h * 0.62 - spread * 0.8);
      // Mud gathered over her head, growing as she pulls.
      ctx.fillStyle = MUD_LIT;
      circle(ctx, 0, -b.h * 0.62 - spread * 1.6 - 0.8, 0.6 + wind * 1);
      ctx.fill();
      ctx.fillStyle = MUD;
      circle(ctx, 0, -b.h * 0.62 - spread * 1.6 - 0.8, 0.42 + wind * 0.75);
      ctx.fill();
      ctx.fillStyle = "#8a7448";
      ctx.globalAlpha = 0.8;
      circle(ctx, -0.25, -b.h * 0.62 - spread * 1.6 - 1.15, 0.2 + wind * 0.25);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (b.act === "throwWind") {
      line(ctx, -0.5, -b.h * 0.62, -1.2, -b.h * 0.5);
      line(ctx, 0.5, -b.h * 0.62, 1.2 + throwP * 1.2, -b.h * 0.68 - throwP * 1.4);
      // The drip of coming spit at her lip.
      ctx.fillStyle = CAULDRON_LIT;
      ctx.globalAlpha = 0.7;
      circle(ctx, 1.9 + throwP * 0.6, -b.h * 0.72 - throwP * 1.6, 0.22 + throwP * 0.2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      line(ctx, -0.5, -b.h * 0.62, -1.1, -b.h * 0.3 - breathe * 0.2);
      line(ctx, 0.5, -b.h * 0.62, 1.15, -b.h * 0.3 + breathe * 0.2);
    }
    // Her head: a long chin, one good eye, a wisp of hair, her pointed hat
    // gone soft with wet.
    const headY = -b.h * (0.86 - hunch);
    ctx.fillStyle = C("#6a5836");
    ellipse(ctx, 0.3, headY, 0.85, 0.8);
    ctx.fill();
    ctx.fillStyle = C(HAG_DARK);
    ctx.beginPath();
    ctx.moveTo(-0.9, headY - 0.3);
    ctx.quadraticCurveTo(0, headY - 1.9, 1.15, headY - 1.15);
    ctx.quadraticCurveTo(1.5, headY - 0.9, 1.1, headY - 0.4);
    ctx.lineTo(1.35, headY - 0.3);
    ctx.quadraticCurveTo(0.4, headY - 1.05, -0.9, headY - 0.3);
    ctx.closePath();
    ctx.fill();
    // The chin and a wart.
    ctx.fillStyle = C("#6a5836");
    ctx.beginPath();
    ctx.moveTo(0.7, headY + 0.2);
    ctx.quadraticCurveTo(1.5, headY + 0.7, 1.05, headY + 1.15);
    ctx.lineTo(0.5, headY + 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C(HAG_LIT);
    circle(ctx, 1.28, headY + 0.75, 0.12);
    ctx.fill();
    ctx.restore();
    // The one good eye, greener while the cauldron is open.
    eye(v, x + d * 0.42, y + headY - 0.1, 0.22, b.lit ? CAULDRON_LIT : EYE_AMBER);
    ctx.restore();
  }

  /* ------------------------------------------------- hazards and waves */

  // A muck patch from her cauldron: in the air it is a glob arcing from
  // (sx, sy) to where it lands, a ring closing on the spot; then a steaming
  // mound of burning muck for MUCK_MS, glowing at its cracks.
  function muck(ctx, v, h) {
    const { g } = v;
    const fy = g.FIELD_H - h.y;
    if (h.warn > 0) {
      const p = 1 - h.warn / MUCK_LAND_MS;
      const bx = h.sx + (h.x - h.sx) * p;
      const by = g.FIELD_H - (h.sy + (h.y - h.sy) * p + Math.sin(p * Math.PI) * 10);
      ctx.strokeStyle = "rgba(122, 200, 106, 0.7)";
      ctx.lineWidth = 0.3;
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.3 - p * 0.3), 0.55);
      ctx.stroke();
      ctx.fillStyle = "rgba(90, 150, 80, 0.18)";
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.3 - p * 0.3), 0.55);
      ctx.fill();
      // The glob, wet and heavy.
      ctx.fillStyle = MUD;
      circle(ctx, bx, by, 0.8);
      ctx.fill();
      ctx.fillStyle = MUD_LIT;
      circle(ctx, bx - 0.25, by - 0.3, 0.32);
      ctx.fill();
      ctx.globalAlpha = 0.5;
      circle(ctx, bx - Math.sign(h.x - h.sx || 1) * 1.2, by + 0.6, 0.3);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const fade = Math.min(1, h.live / 600);
    ctx.globalAlpha = fade;
    // The mound: dark muck with green-lit cracks, steaming.
    ctx.fillStyle = "#241c0e";
    ctx.beginPath();
    ctx.moveTo(h.x - h.w / 2 - 0.3, fy);
    ctx.quadraticCurveTo(h.x - h.w * 0.3, fy - h.h * 0.9, h.x, fy - h.h * 0.95);
    ctx.quadraticCurveTo(h.x + h.w * 0.3, fy - h.h * 0.9, h.x + h.w / 2 + 0.3, fy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = MUD;
    ctx.globalAlpha = fade * 0.6;
    ctx.beginPath();
    ctx.moveTo(h.x - h.w / 2, fy);
    ctx.quadraticCurveTo(h.x - h.w * 0.26, fy - h.h * 0.7, h.x, fy - h.h * 0.75);
    ctx.quadraticCurveTo(h.x + h.w * 0.26, fy - h.h * 0.7, h.x + h.w / 2, fy);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = CAULDRON_LIT;
    ctx.lineWidth = 0.22;
    ctx.globalAlpha = fade * 0.9;
    for (const [k, bend] of [[0, -0.4], [1, 0.3], [2, -0.2]]) {
      ctx.beginPath();
      ctx.moveTo(h.x - h.w * 0.28 + k * h.w * 0.28, fy - 0.2);
      ctx.quadraticCurveTo(h.x - h.w * 0.2 + k * h.w * 0.28 + bend, fy - h.h * 0.5, h.x - h.w * 0.1 + k * h.w * 0.28, fy - h.h * 0.8);
      ctx.stroke();
    }
    ctx.globalAlpha = fade;
    // Steam.
    ctx.fillStyle = "#8aa88e";
    for (let k = 0; k < 4; k++) {
      const p = (v.clock / 1500 + k / 4) % 1;
      ctx.globalAlpha = fade * 0.14 * (1 - p);
      ellipse(ctx, h.x - h.w * 0.3 + k * h.w * 0.2 + Math.sin(p * 5 + k) * 0.6, fy - h.h - p * 3.5, 1 + p * 0.8, 0.8 + p * 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The mud wave: a low ridge of muck rolling along the planks, crested
  // and dripping, a wet wake behind it. `y` is the floor on screen.
  function mudwave(ctx, v, w, y) {
    ctx.fillStyle = MUD_DARK;
    ellipse(ctx, w.x - w.dir * 2.6, y - 0.1, 2.6, 0.4);
    ctx.fill();
    ctx.fillStyle = MUD;
    ctx.beginPath();
    ctx.moveTo(w.x - w.dir * 2.4, y);
    ctx.quadraticCurveTo(w.x - w.dir * 1.2, y - 3.1, w.x + w.dir * 0.4, y - 2.6);
    ctx.quadraticCurveTo(w.x + w.dir * 1.3, y - 1.9, w.x + w.dir * 1.1, y);
    ctx.closePath();
    ctx.fill();
    // The curl of its lip, facing the way it rolls.
    ctx.fillStyle = MUD_LIT;
    ctx.beginPath();
    ctx.moveTo(w.x + w.dir * 0.4, y - 2.6);
    ctx.quadraticCurveTo(w.x + w.dir * 1.5, y - 2.9, w.x + w.dir * 1.6, y - 1.7);
    ctx.quadraticCurveTo(w.x + w.dir * 1.1, y - 1.9, w.x + w.dir * 0.9, y - 1.4);
    ctx.closePath();
    ctx.fill();
    // Dripping clods off the top.
    ctx.fillStyle = MUD;
    for (let k = 0; k < 4; k++) {
      const p = (v.clock / 300 + k / 4) % 1;
      ctx.globalAlpha = 0.8 * (1 - p);
      circle(ctx, w.x - w.dir * (0.6 + k * 0.5) + Math.sin(k * 3) * 0.3, y - 2.4 - p * 1.2, 0.22 - p * 0.1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* --------------------------------------------------------- the badges */

  // The Stilt Boots' badge (inside the ring every power-up shares): two
  // tall boots on their stilts, in the ink already set.
  function boots(ctx, x, y) {
    ctx.lineWidth = 0.26;
    for (const s of [-1, 1]) {
      // The boot, then the pole of its stilt under it.
      line(ctx, x + s * 0.55 - 0.28, y - 0.9, x + s * 0.55 - 0.28, y - 0.25);
      line(ctx, x + s * 0.55 - 0.28, y - 0.25, x + s * 0.55 + 0.38, y - 0.25);
      line(ctx, x + s * 0.55 + 0.38, y - 0.25, x + s * 0.55 + 0.38, y - 0.45);
      line(ctx, x + s * 0.55 + 0.05, y - 0.25, x + s * 0.55 + 0.05, y + 0.95);
      line(ctx, x + s * 0.55 - 0.12, y + 0.95, x + s * 0.55 + 0.22, y + 0.95);
    }
  }

  // The Harpoon's badge: a barbed spear with its line coiled off the butt.
  function harpoon(ctx, x, y) {
    ctx.lineWidth = 0.24;
    line(ctx, x - 0.9, y + 0.9, x + 0.7, y - 0.7);
    // The barbed head.
    line(ctx, x + 0.7, y - 0.7, x + 1.05, y - 1.05);
    line(ctx, x + 0.7, y - 0.7, x + 0.42, y - 0.42);
    line(ctx, x + 0.62, y - 0.78, x + 0.9, y - 0.5);
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.arc(x - 0.75, y + 0.95, 0.3, 0, TAU);
    ctx.stroke();
  }

  /* -------------------------------------------------------------- light */

  // What lights the dark here: the wisp's cold glow (a great lamp while
  // bright, a coal while dim, a gathering while it rekindles), the open
  // cauldron's green fire, a muck patch's smoulder.
  function lights(v, add) {
    for (const m of v.round.monsters) {
      if (m.kind !== "wisp") continue;
      if (m.act === "bright") add(m.x, m.y + m.h / 2, 6, 0.7);
      else if (m.act === "rekindle") add(m.x, m.y + m.h / 2, 3, 0.4);
      else if (m.act === "dim") add(m.x, m.y + m.h / 2, 1.2, 0.15);
    }
    for (const h of v.round.hazards) if (h.kind === "muck" && h.live > 0) add(h.x, h.y + 1, 4, 0.35 * Math.min(1, h.live / 600));
    const b = v.round.boss;
    if (b && b.kind === "motherbog" && b.state !== "down" && !b.hidden) {
      add(b.x + (b.dir || 1) * (b.w * 0.5 + 1.6), b.y + 3, b.lit ? 8 : 3.5, b.lit ? 0.85 : 0.4);
      if (!b.hidden && b.act !== "under") add(b.x + (b.dir || 1) * 0.4, b.y + b.h * 0.86, 4, 0.2);
    }
  }

  /* ------------------------------------------------------------- events */

  // What the bog's events look and sound like, beside ghoul-draw.js's own:
  // true when `e` was one of them. `k` is the same kit react() is handed.
  function react(e, k) {
    const { tone, burst, float, ring, glow, shake, fx } = k;
    if (e.type === "lurkerSnap") {
      say(tone, e.kind, "snap", 0.5);
      burst(e.x, e.y, WATER_SHEEN, 8, 8, 350);
      shake(140, 0.35);
    } else if (e.type === "lurkerSink") {
      if (gate(fx, "lurkMs", 300)) say(tone, e.kind, "sink", 0.35);
      ring(e.x, e.y, WATER_SHEEN, 0.8, 3, 500);
    } else if (e.type === "leechLatch") {
      say(tone, e.kind, "latch", 0.45);
      float(e.x, e.y + 3, "Latched!", DANGER, 2.2);
    } else if (e.type === "leechDie") {
      // The kill event already cried its `die`; this is the swarm coming
      // apart, visual only.
      burst(e.x, e.y, LEECH_LIT, 12, 9, 400);
    } else if (e.type === "bogRise") {
      say(tone, e.kind, "rise", 0.4);
      burst(e.x, e.y + 0.4, MUD_LIT, 9, 8, 380);
    } else if (e.type === "wispOut") {
      say(tone, e.kind, "out", 0.4);
      burst(e.x, e.y, WISP, 8, 7, 300);
    } else if (e.type === "wispRelight") {
      say(tone, e.kind, "relight", 0.35);
      glow(e.x, e.y, 4, 0.5, 400);
    } else if (e.type === "wispOn") {
      say(tone, e.kind, "on", 0.4);
      glow(e.x, e.y, 6, 0.65, 450);
    } else if (e.type === "wispLure") {
      float(e.x, e.y + 4, "Drawn!", GOLD, 2);
      glow(e.x, e.y, 4, 0.4, 350);
    } else if (e.type === "motherWind") {
      say(tone, e.kind, "wind", 0.5);
      float(e.x, e.y + 5, "Mud wave!", DANGER, 2.4);
    } else if (e.type === "mudWave") {
      say(tone, e.kind, "wave", 0.55);
      shake(180, 0.45);
    } else if (e.type === "spitWind") {
      say(tone, e.kind, "spitWind", 0.4);
      glow(e.x, e.y, 5, 0.5, 400);
    } else if (e.type === "cauldronSpit") {
      say(tone, e.kind, "spit", 0.5);
      if (e.tx !== undefined) ring(e.tx, e.ty, CAULDRON_LIT, 1, 5, 700);
      if (e.tx2 !== undefined) ring(e.tx2, e.ty2, CAULDRON_LIT, 1, 5, 700);
    } else if (e.type === "cauldronOpen") {
      if (gate(fx, "openMs", 400)) say(tone, e.kind, "open", 0.4);
      glow(e.x, e.y, 7, 0.7, 400);
      float(e.x, e.y + 4, "Now!", GOLD, 2.2);
    } else if (e.type === "muckLand") {
      if (gate(fx, "muckMs", 200)) say(tone, "motherbog", "muck", 0.5);
      burst(e.x, e.y + 0.5, MUD_LIT, 12, 10, 450);
      glow(e.x, e.y + 1, 6, 0.5, 400);
      shake(140, 0.4);
    } else if (e.type === "motherSink") {
      say(tone, e.kind, "sink", 0.5);
      shake(220, 0.5);
    } else if (e.type === "motherBubble") {
      say(tone, e.kind, "bubble", 0.4);
      ring(e.x, e.y, WATER_SHEEN, 1, 4.5, 650);
    } else if (e.type === "motherRise") {
      say(tone, e.kind, "rise", 0.55);
      burst(e.x, e.y + 1, WATER_SHEEN, 14, 12, 500);
      shake(200, 0.55);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    decor: freeze({}),
    monsters: freeze({ lurker, leech, wisp, bogbody }),
    bosses: freeze({ motherbog }),
    missiles: freeze({}),
    hazards: freeze({ muck }),
    waves: freeze({ mudwave }),
    powers: freeze({ boots, harpoon }),
    lights,
    react,
  });
}
