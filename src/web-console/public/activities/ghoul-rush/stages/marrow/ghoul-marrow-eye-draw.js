// Plan2Code Web Console - Ghoul Rush's finale, its drawing for the finale's second kill, Marrow, Every Room at Once (the Eye): the dollhouse cutaway (nine rooms papered from the stages YOU came through, open door frames between them, a stair of landings at each end, a gable over all) standing in a giant dark nursery, each room's swinging lamp, the Eye splitting the wallpaper, the pale shades of the keepers YOU beat (each drawn small from that boss's own art), their moves, the lurching dresser, the kill (the Eye bursting, the paper peeling away, the floors cracking, the house sinking) and the stairway of bones it leaves at the door: LOOKS, VOICES, LOSE_WORDS, LOSE_SOUNDS and eyeArt(d), plugged into draw/ghoul-draw.js.
//
// eyeArt(d) takes ghoul-draw.js's own helpers (`d`: ellipse, circle, roundRect, line,
// rotate, eye, hash, say, gate, label, bossArt and the colors) and hands back the
// drawing by kind, so this file never reaches back into it. Everything is drawn in room
// units, y counted down from the field's top (screen y is FIELD_H - y). The backdrop is
// painted once into the still layers, so nothing in it moves: the lamps, the Eye, the
// sway and the kill's scene are drawn every frame by the boss's art, which lies over
// the still layer and under the monsters and YOU. lights() runs for every pack in every
// room and returns at once outside this file's room.

import { CRACK_AT, DRESSER_HP, EYE_CEIL, EYE_COLS, EYE_FLOORS, EYE_HI, EYE_LO, EYE_ROOMS, EYE_ROOM_W, EYE_SLAB, EYE_W, GASP_AT, GONE_AT, PEEL_AT, SCYTHE_LIVE_MS, SHADE_IN_MS, SHADE_OUT_MS, SINK_AT, phaseOf, roomBox } from "./ghoul-marrow-eye.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Inside the House: the "wall" is the giant nursery's dark paper the dollhouse stands
// against (`wallTop` to `wallLow`), `paper` its faded stripe. `custom` hands the room's
// walls, floor and shelves to this file.
export const LOOKS = freeze({
  dollhouse: freeze({ wallTop: "#0c0912", wallLow: "#22182a", paper: "#1a1222", wainscot: "#120c16", floorTop: "#4a3626", floor: "#1e140e", floorEdge: "#0a0605", shelf: "#3a281a", shelfTop: "#6a4e34", pit: "#020103", window: "#d8cfa8", hedge: "#33421f", decor: "none", dark: 0.72, custom: true, noMoon: true, pack: "dollhouse", color: "#e8c84a" }),
});

// How the Eye and its shades sound, by act (the user's picks from the sound vote, eye.html, in ghoul-sfx-marrow-eye.js).
export const VOICES = freeze({
  marroweye: freeze({ wake: "ghoulEyeWake", hurt: "ghoulEyeHurt", die: "ghoulEyeDie", flare: "ghoulEyeFlare", flareStep: "ghoulEyeFlareStep", open: "ghoulEyeOpen", shut: "ghoulEyeShut", dud: "ghoulEyeDud", door: "ghoulEyeDoor", creak: "ghoulEyeCreak", creakStep: "ghoulEyeCreakStep", lurch: "ghoulEyeLurch", crash: "ghoulEyeCrash", smash: "ghoulEyeSmash", burst: "ghoulEyeBurst", peel: "ghoulEyePeel", crack: "ghoulEyeCrack", gasp: "ghoulEyeGasp", sink: "ghoulEyeSink", gone: "ghoulEyeGone" }),
  eyeShade: freeze({ come: "ghoulEyeShadeIn", fade: "ghoulEyeShadeOut", wind: "ghoulEyeShadeWind", hurt: "ghoulEyeShadeHurt", die: "ghoulEyeShadeDie", slam: "ghoulEyeShadeSlam", throw: "ghoulEyeShadeThrow", grind: "ghoulEyeShadeGrind", scythe: "ghoulEyeShadeScythe", note: "ghoulEyeShadeNote", dash: "ghoulEyeShadeDash", leap: "ghoulEyeShadeLeap", pounce: "ghoulEyeShadePounce", knock: "ghoulEyeShadeKnock", rock: "ghoulEyeShadeRock", hoop: "ghoulEyeShadeHoop", icicle: "ghoulEyeShadeIcicle", mud: "ghoulEyeShadeMud" }),
});
export const LOSE_WORDS = freeze({ marroweye: "Shown to your room", eyeShade: "Haunted by an old friend", eyeRipple: "Rippled under", eyeSkull: "Skull returned", eyeScythe: "Trimmed", eyeNote: "Sung out", eyePounce: "Pounced", eyeRock: "Knocked flat", eyeHoop: "Jumped through hoops", eyeIcicle: "Iced", eyeMud: "Mudded under", eyeDresser: "Flattened by a dresser" });
export const LOSE_SOUNDS = freeze({
  marroweye: ["smash", 0.6, 0.6],
  eyeShade: ["thud", 0.55, 1.2],
  eyeRipple: ["thud", 0.55, 0.9],
  eyeSkull: ["crunch", 0.55, 1.2],
  eyeScythe: ["ghoulCrack", 0.55, 1.1],
  eyeNote: ["thud", 0.5, 1.4],
  eyePounce: ["thud", 0.65, 0.7],
  eyeRock: ["smash", 0.55, 0.9],
  eyeHoop: ["thud", 0.5, 1.1],
  eyeIcicle: ["ghoulCrack", 0.55, 1.3],
  eyeMud: ["thud", 0.6, 0.6],
  eyeDresser: ["smash", 0.65, 0.7],
});

// Each room's paper, from the stages YOU came through: by room (0 to 8, left to right
// along the ground, then up), its base, its pattern's ink, its trim and its floor.
const THEMES = freeze([
  freeze({ paper: "#2e3a2c", ink: "#4a5c42", trim: "#2a2018", floor: "tiles", pattern: "ivy" }), // the kitchen
  freeze({ paper: "#3e1820", ink: "#64283a", trim: "#5a4020", floor: "parquet", pattern: "damask" }), // the ballroom
  freeze({ paper: "#2c3a36", ink: "#46605a", trim: "#26302e", floor: "lino", pattern: "tile" }), // the ward
  freeze({ paper: "#22223a", ink: "#3c3462", trim: "#2a2436", floor: "stone", pattern: "arches" }), // the chapel
  freeze({ paper: "#361626", ink: "#5e2438", trim: "#4a2a12", floor: "boards", pattern: "stripes" }), // the big top
  freeze({ paper: "#1c2a38", ink: "#34506a", trim: "#2a3a48", floor: "boards", pattern: "frost" }), // the lodge
  freeze({ paper: "#202a1a", ink: "#38462a", trim: "#2a2a18", floor: "boards", pattern: "reeds" }), // the bog
  freeze({ paper: "#2a2016", ink: "#463622", trim: "#3a2a18", floor: "boards", pattern: "timber" }), // the mine
  freeze({ paper: "#34281e", ink: "#54402e", trim: "#3a2a1c", floor: "boards", pattern: "floral" }), // the village
]);

// The House's inks.
const FRAME = "#3a2a1e";
const FRAME_LIT = "#5e4630";
const FRAME_DARK = "#1c130c";
const LATH = "#4a3422";
const LATH_DARK = "#24180e";
const PLASTER = "#8a7a66";
const ROOF = "#1a1218";
const SHINGLE = "#2c2028";
const SHINGLE_LIT = "#46343e";
const LAMP = "#d8b060";
const LAMP_HOT = "#fff2b8";
const LAMP_RED = "#ff5a2a";
const BRASS = "#8a6a2a";
const SCLERA = "#efe2c0";
const SCLERA_SICK = "#d8c890";
const VEIN = "#a0202a";
const IRIS = "#e8a020";
const IRIS_DEEP = "#9a4a10";
const PUPIL = "#120406";
const LID = "#2a0a10";
const FLESH = "#6a1a24";
const ICHOR = "#7a1020";
const DUST = "#6a5e52";
const BONE = "#d8cfb4";
const BONE_DARK = "#8a7e66";
const SHADE = "#cfe0f2";
const SHADE_GLOW = "#9ec8ff";
const WOOD = "#5a3a22";
const WOOD_LIT = "#7a5634";
const WOOD_DARK = "#2a1a0e";
const MUD = "#6a5228";
const MUD_LIT = "#9a8048";
const ICE = "#cfefff";
const ICE_DEEP = "#7ab4d8";
const ROCK = "#5a5048";
const ROCK_LIT = "#7a7066";
const HOOP_RED = "#d8384a";
const NOTE_GOLD = "#ffe08a";

export function eyeArt(d) {
  const { ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, label, bossArt, DANGER, GOLD } = d;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mix = (a, b, p) => a + (b - a) * p;
  const ease = (p) => p * p * (3 - 2 * p);
  const ours = (v) => !!(v && v.spec && LOOKS[v.spec.id]);

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

  // A closed polygon through [x, y, x, y, ...].
  function poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
  }

  /* ------------------------------------------------------- the backdrop */

  // The giant nursery the dollhouse stands in, from x0 to x1: its dark paper with a
  // faded stripe and hearts, a skirting board, and out on the landing a toy block
  // bigger than YOU and the WELCOME mat the ride spat YOU out on.
  function nursery(ctx, v, look, x0, x1) {
    const H = v.g.FIELD_H;
    const wall = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, H) : null;
    if (wall && typeof wall.addColorStop === "function") {
      wall.addColorStop(0, look.wallTop);
      wall.addColorStop(1, look.wallLow);
      ctx.fillStyle = wall;
    } else ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, H);
    ctx.fillStyle = look.paper;
    for (let x = Math.floor(x0 / 9) * 9; x < x1 + 9; x += 9) {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, 0, 3.4, H - 9);
      // A faded heart between the stripes, every other row.
      for (let y = 6 + (Math.round(x / 9) % 2) * 7; y < H - 12; y += 14) {
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#3a2232";
        circle(ctx, x + 5.6, y, 0.7);
        ctx.fill();
        circle(ctx, x + 6.8, y, 0.7);
        ctx.fill();
        poly(ctx, [x + 4.95, y + 0.3, x + 7.45, y + 0.3, x + 6.2, y + 1.9]);
        ctx.fill();
        ctx.fillStyle = look.paper;
      }
    }
    ctx.globalAlpha = 1;
    // The skirting board.
    ctx.fillStyle = "#1a1016";
    ctx.fillRect(x0, H - 9, x1 - x0, 3);
    ctx.fillStyle = "#2a1c24";
    ctx.fillRect(x0, H - 9, x1 - x0, 0.4);
  }

  // A toy block taller than YOU, its letter worn, on the landing.
  function toyBlock(ctx, x, y) {
    ctx.fillStyle = "#3a2030";
    ctx.fillRect(x - 5, y - 10, 10, 10);
    ctx.fillStyle = "#4e2a40";
    poly(ctx, [x - 5, y - 10, x - 3, y - 12, x + 7, y - 12, x + 5, y - 10]);
    ctx.fill();
    ctx.fillStyle = "#2a1622";
    poly(ctx, [x + 5, y - 10, x + 7, y - 12, x + 7, y - 2, x + 5, y]);
    ctx.fill();
    ctx.strokeStyle = "#5e3a4e";
    ctx.lineWidth = 0.3;
    ctx.strokeRect(x - 4.2, y - 9.2, 8.4, 8.4);
    label(ctx, "M", x, y - 5, 6, "#6a4458", "center", undefined, true);
  }

  // The WELCOME mat, crumpled where it landed.
  function mat(ctx, x, y) {
    ctx.fillStyle = "#5a3a1e";
    poly(ctx, [x - 6, y, x - 5.4, y - 0.9, x - 2, y - 0.6, x + 1, y - 1.5, x + 4.6, y - 0.8, x + 6, y]);
    ctx.fill();
    ctx.fillStyle = "#7a5228";
    ctx.fillRect(x - 5, y - 0.5, 10, 0.25);
    label(ctx, "WELCOME", x - 0.2, y - 1.1, 0.9, "#2a1a0c", "center", 9);
  }

  // One room's back wall: its paper and pattern, a dado rail, a picture or a fixture by
  // its theme, the ceiling rose its lamp hangs from. `r` is roomBox's room.
  function roomWall(ctx, v, r) {
    const H = v.g.FIELD_H;
    const th = THEMES[r.i];
    const yt = H - r.top;
    const yb = H - r.floor;
    ctx.fillStyle = th.paper;
    ctx.fillRect(r.x0, yt, r.x1 - r.x0, yb - yt);
    ctx.fillStyle = th.ink;
    ctx.strokeStyle = th.ink;
    const w = r.x1 - r.x0;
    const pat = th.pattern;
    if (pat === "stripes") {
      for (let x = r.x0; x < r.x1; x += 3.2) ctx.fillRect(x, yt, 1.6, yb - yt);
    } else if (pat === "damask" || pat === "floral") {
      for (let y = yt + 2; y < yb - 2; y += 3.6) {
        for (let x = r.x0 + ((Math.round(y) % 2) ? 1.8 : 0) + 1; x < r.x1 - 0.5; x += 3.6) {
          if (pat === "damask") {
            poly(ctx, [x, y - 1.2, x + 0.8, y, x, y + 1.2, x - 0.8, y]);
            ctx.fill();
          } else {
            for (let k = 0; k < 4; k++) {
              circle(ctx, x + Math.cos((k * TAU) / 4) * 0.5, y + Math.sin((k * TAU) / 4) * 0.5, 0.35);
              ctx.fill();
            }
          }
        }
      }
    } else if (pat === "tile") {
      ctx.lineWidth = 0.12;
      for (let y = yt + 2; y < yb; y += 2) line(ctx, r.x0, y, r.x1, y);
      for (let y = yt; y < yb; y += 2) for (let x = r.x0 + ((Math.round(y / 2) % 2) ? 1 : 0); x < r.x1; x += 2) line(ctx, x, y, x, Math.min(yb, y + 2));
    } else if (pat === "arches") {
      ctx.lineWidth = 0.3;
      for (let x = r.x0 + 4; x < r.x1 - 2; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x - 2.4, yb - 2);
        ctx.lineTo(x - 2.4, yt + 5);
        ctx.arc(x, yt + 5, 2.4, Math.PI, 0);
        ctx.lineTo(x + 2.4, yb - 2);
        ctx.stroke();
      }
    } else if (pat === "frost") {
      ctx.lineWidth = 0.14;
      for (let x = r.x0 + 1.5; x < r.x1; x += 2.6) line(ctx, x, yt, x, yb);
      ctx.fillStyle = "#4a6e8a";
      for (let k = 0; k < 10; k++) {
        const h = hash(r.i * 31 + k, 5);
        ctx.globalAlpha = 0.5;
        circle(ctx, r.x0 + (h % 300) / 300 * w, yt + 1 + (h % 7) * 0.9, 0.3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (pat === "reeds") {
      ctx.lineWidth = 0.18;
      for (let x = r.x0 + 1; x < r.x1; x += 1.7) {
        const h = hash(Math.round(x * 3), r.i);
        line(ctx, x, yb, x + ((h % 5) - 2) * 0.3, yt + 3 + (h % 6));
      }
    } else if (pat === "timber") {
      ctx.lineWidth = 0.5;
      for (let x = r.x0 + 4; x < r.x1; x += 9) line(ctx, x, yt, x, yb);
      line(ctx, r.x0, yt + 1.2, r.x1, yt + 1.2);
      ctx.lineWidth = 0.12;
      for (let y = yt + 3; y < yb; y += 1.4) line(ctx, r.x0, y, r.x1, y);
    } else if (pat === "ivy") {
      ctx.lineWidth = 0.16;
      for (let x = r.x0 + 2; x < r.x1; x += 5) {
        ctx.beginPath();
        ctx.moveTo(x, yt);
        for (let y = yt; y < yb; y += 1) ctx.lineTo(x + Math.sin(y * 0.9 + x) * 0.6, y);
        ctx.stroke();
        for (let y = yt + 1.5; y < yb; y += 2.2) {
          ellipse(ctx, x + Math.sin(y * 0.9 + x) * 0.6 + 0.5, y, 0.45, 0.25);
          ctx.fill();
        }
      }
    }
    // The dado rail and the darker paper under it.
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(r.x0, yb - 2.4, w, 2.4);
    ctx.fillStyle = th.trim;
    ctx.fillRect(r.x0, yb - 2.6, w, 0.35);
    // A picture to one side, off the Eye's middle.
    const side = r.i % 2 ? 1 : -1;
    const px = r.cx + side * 9;
    const py = yt + (yb - yt) * 0.42;
    ctx.fillStyle = th.trim;
    ctx.fillRect(px - 2.2, py - 1.7, 4.4, 3.4);
    ctx.fillStyle = "#0e0a0c";
    ctx.fillRect(px - 1.7, py - 1.2, 3.4, 2.4);
    ctx.fillStyle = th.ink;
    ctx.globalAlpha = 0.8;
    ellipse(ctx, px, py - 0.1, 0.7, 0.9);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Its ceiling rose.
    ctx.fillStyle = PLASTER;
    ctx.globalAlpha = 0.5;
    ellipse(ctx, r.cx, yt + 0.25, 1.4, 0.35);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Stains run down from the ceiling.
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    for (let k = 0; k < 2; k++) {
      const h = hash(r.i, k + 40);
      const sx = r.x0 + 3 + (h % 26);
      const len = 3 + (h % 6);
      poly(ctx, [sx - 1, yt, sx + 1.2, yt, sx + 0.3, yt + len]);
      ctx.fill();
    }
  }

  // An open door frame between two rooms at `x`, on a floor from `floor` to `top`:
  // two jambs and a lintel, the wall over the lintel, open below.
  function doorFrame(ctx, v, x, floor, top) {
    const H = v.g.FIELD_H;
    const lintel = Math.min(top - 1, floor + 9.5);
    ctx.fillStyle = "#1a1210";
    ctx.fillRect(x - 2.2, H - top, 4.4, top - lintel);
    ctx.fillStyle = FRAME;
    ctx.fillRect(x - 2.4, H - lintel - 0.7, 4.8, 0.7);
    ctx.fillRect(x - 2.4, H - lintel, 0.6, lintel - floor);
    ctx.fillRect(x + 1.8, H - lintel, 0.6, lintel - floor);
    ctx.fillStyle = FRAME_LIT;
    ctx.fillRect(x - 2.4, H - lintel - 0.7, 4.8, 0.15);
    // Through the doorway, a little darker.
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(x - 1.8, H - lintel, 3.6, lintel - floor);
  }

  // A flight of stairs, drawn only (the landings are the shelves): from (xa, ya) up to (xb, yb).
  function flight(ctx, v, xa, ya, xb, yb) {
    const H = v.g.FIELD_H;
    const n = 5;
    const dir = Math.sign(xb - xa);
    ctx.fillStyle = WOOD_DARK;
    poly(ctx, [xa, H - ya, xb, H - yb, xb, H - yb + 1.2, xa + dir * 1.2, H - ya]);
    ctx.fill();
    for (let k = 0; k < n; k++) {
      const p = k / n;
      const x = mix(xa, xb, p);
      const y = mix(ya, yb, p);
      ctx.fillStyle = k % 2 ? WOOD : WOOD_LIT;
      ctx.fillRect(Math.min(x, x + dir * ((xb - xa) / n) * dir), H - y - (yb - ya) / n, Math.abs(xb - xa) / n + 0.1, 0.4);
    }
  }

  // The dollhouse's carcass over the rooms: its thick end walls cut raw at the front,
  // the ceiling under the attic, the gable roof (clipped by the field's top), the
  // shingles' edge.
  function carcass(ctx, v, x0, x1) {
    const spec = v.spec;
    const H = v.g.FIELD_H;
    const a = spec.arena;
    const b = spec.length;
    // The attic: a gable over the whole house, its slope rising to the middle.
    ctx.fillStyle = ROOF;
    poly(ctx, [a - 3, H - EYE_CEIL, (a + b) / 2, -6, b + 3, H - EYE_CEIL]);
    ctx.fill();
    ctx.fillStyle = "#24161e";
    poly(ctx, [a + 4, H - EYE_CEIL - 0.6, (a + b) / 2, H - EYE_CEIL - 5.6, b - 4, H - EYE_CEIL - 0.6]);
    ctx.fill();
    // Rafters in the attic, and a small round window in the gable.
    ctx.strokeStyle = FRAME_DARK;
    ctx.lineWidth = 0.4;
    for (let x = a + 10; x < b - 6; x += 12) line(ctx, x, H - EYE_CEIL, x, H - EYE_CEIL - Math.max(0, 5.4 - Math.abs(x - (a + b) / 2) * 0.11));
    ctx.fillStyle = SHINGLE_LIT;
    for (let x = Math.max(a - 3, Math.floor(x0)); x < Math.min(b + 3, x1 + 1); x += 1.4) {
      const t = Math.abs(x - (a + b) / 2) / ((b - a) / 2 + 3);
      const y = mix(-6, H - EYE_CEIL, t);
      ctx.globalAlpha = 0.7;
      ctx.fillRect(x, y - 0.3, 1.2, 0.5);
    }
    ctx.globalAlpha = 1;
    // The ceiling of the top floor.
    ctx.fillStyle = FRAME;
    ctx.fillRect(a - 1.6, H - EYE_CEIL, b - a + 3.2, EYE_SLAB);
    ctx.fillStyle = FRAME_LIT;
    ctx.fillRect(a - 1.6, H - EYE_CEIL + EYE_SLAB - 0.3, b - a + 3.2, 0.3);
    // The end walls, cut raw where the front was torn off: plaster, lath, studs.
    for (const [wx, dir] of [[a, -1], [b, 1]]) {
      ctx.fillStyle = FRAME_DARK;
      ctx.fillRect(dir < 0 ? wx - 1.6 : wx - 0.2, H - EYE_CEIL, 1.8, EYE_CEIL - EYE_FLOORS[0]);
      ctx.fillStyle = PLASTER;
      ctx.globalAlpha = 0.45;
      ctx.fillRect(dir < 0 ? wx - 1.6 : wx + 1.2, H - EYE_CEIL, 0.4, EYE_CEIL - EYE_FLOORS[0]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = LATH;
      for (let y = H - EYE_CEIL + 1; y < H - EYE_FLOORS[0]; y += 1.3) {
        const h = hash(Math.round(y * 3), Math.round(wx));
        ctx.fillRect(dir < 0 ? wx - 1.6 - (h % 3) * 0.3 : wx + 1.4, y, 0.4 + (h % 3) * 0.3, 0.35);
      }
    }
  }

  function backdrop(ctx, v, look, x0, x1) {
    const spec = v.spec;
    const H = v.g.FIELD_H;
    nursery(ctx, v, look, x0, x1);
    if (x0 < 22 && x1 > 4) toyBlock(ctx, 14, H - EYE_FLOORS[0]);
    if (!spec || spec.arena < 0) return;
    for (let i = 0; i < EYE_ROOMS; i++) {
      const r = roomBox(spec, i);
      if (r.x1 < x0 - 1 || r.x0 > x1 + 1) continue;
      roomWall(ctx, v, r);
    }
    // Door frames between the rooms, on every floor.
    for (let row = 0; row < EYE_FLOORS.length; row++) {
      const r = roomBox(spec, row * EYE_COLS);
      for (let c = 1; c < EYE_COLS; c++) {
        const x = spec.arena + c * EYE_ROOM_W;
        if (x < x0 - 4 || x > x1 + 4) continue;
        doorFrame(ctx, v, x, r.floor, r.top);
      }
    }
    // The stairs at each end: a flight up to each landing, and on up toward the floor over it.
    const a = spec.arena;
    const b = spec.length;
    for (const [lo, hi] of [[EYE_FLOORS[0], EYE_FLOORS[1]], [EYE_FLOORS[1], EYE_FLOORS[2]]]) {
      const mid = (lo + hi) / 2;
      flight(ctx, v, a + 13, lo, a + 7, mid);
      flight(ctx, v, a + 7, mid, a + 13, hi - EYE_SLAB);
      flight(ctx, v, b - 13, lo, b - 7, mid);
      flight(ctx, v, b - 7, mid, b - 13, hi - EYE_SLAB);
    }
    carcass(ctx, v, x0, x1);
  }

  /* ----------------------------------------------------- floors, landings */

  // The ground floor: the nursery's giant boards out on the landing (the mat on them),
  // each room's own floor inside the house.
  function ground(ctx, v, look, a, b, top) {
    const spec = v.spec;
    const H = v.g.FIELD_H;
    const fy = H - top;
    ctx.fillStyle = look.floor;
    ctx.fillRect(a, fy, b - a, top);
    const arena = spec && spec.arena >= 0 ? spec.arena : b;
    // The nursery's boards, huge.
    for (let x = Math.ceil(a / 8) * 8; x < Math.min(b, arena); x += 8) {
      ctx.fillStyle = "#2a1c14";
      ctx.fillRect(x, fy, 0.25, top);
    }
    ctx.fillStyle = look.floorTop;
    ctx.fillRect(a, fy, Math.min(b, arena) - a, 0.7);
    if (a < 12 && b > 0) mat(ctx, 6, fy);
    if (!spec || spec.arena < 0) return;
    // Inside: each ground room's floor by its theme.
    for (let c = 0; c < EYE_COLS; c++) {
      const r = roomBox(spec, c);
      const lo = Math.max(a, r.x0);
      const hi = Math.min(b, r.x1);
      if (hi <= lo) continue;
      floorTop(ctx, THEMES[r.i].floor, lo, hi, fy, r.i);
    }
    // The house's sill under it all.
    ctx.fillStyle = FRAME_DARK;
    ctx.fillRect(Math.max(a, spec.arena - 1.6), fy + 0.8, Math.min(b, spec.length) - Math.max(a, spec.arena - 1.6), 1.2);
  }

  // The top of a floor from lo to hi at screen y `fy`, by its finish.
  function floorTop(ctx, kind, lo, hi, fy, seed) {
    if (kind === "tiles") {
      for (let x = Math.floor(lo / 1.6) * 1.6; x < hi; x += 1.6) {
        ctx.fillStyle = Math.round(x / 1.6) % 2 ? "#d8d0bc" : "#2a2420";
        ctx.fillRect(Math.max(lo, x), fy, Math.min(1.6, hi - Math.max(lo, x)), 0.8);
      }
    } else if (kind === "parquet") {
      ctx.fillStyle = "#6a4426";
      ctx.fillRect(lo, fy, hi - lo, 0.8);
      ctx.fillStyle = "#8a5a32";
      for (let x = Math.ceil(lo / 1.2) * 1.2; x < hi; x += 1.2) ctx.fillRect(x, fy + (Math.round(x / 1.2) % 2) * 0.4, 0.6, 0.4);
    } else if (kind === "lino") {
      ctx.fillStyle = "#4a6058";
      ctx.fillRect(lo, fy, hi - lo, 0.8);
      ctx.fillStyle = "#2c3a34";
      for (let x = Math.ceil(lo / 3) * 3; x < hi; x += 3) ctx.fillRect(x, fy, 0.12, 0.8);
    } else if (kind === "stone") {
      ctx.fillStyle = "#4a4652";
      ctx.fillRect(lo, fy, hi - lo, 0.8);
      ctx.fillStyle = "#2a2830";
      for (let x = Math.ceil(lo / 2.6) * 2.6; x < hi; x += 2.6) ctx.fillRect(x + (hash(Math.round(x), seed) % 3) * 0.2, fy, 0.14, 0.8);
    } else {
      ctx.fillStyle = WOOD;
      ctx.fillRect(lo, fy, hi - lo, 0.8);
      ctx.fillStyle = WOOD_DARK;
      for (let x = Math.ceil(lo / 2.4) * 2.4; x < hi; x += 2.4) ctx.fillRect(x, fy, 0.12, 0.8);
      ctx.fillStyle = WOOD_LIT;
      ctx.fillRect(lo, fy, hi - lo, 0.15);
    }
  }

  // A floor of the house (a shelf right across it) or a stair's landing, its top at
  // screen y `y`: a floor is a slab EYE_SLAB thick, each room's finish on top, joists
  // and the plaster ceiling of the room below under it; a landing a box on a newel post.
  function shelf(ctx, v, look, a, b, y) {
    const spec = v.spec;
    if (b - a > 20 && spec && spec.arena >= 0) {
      ctx.fillStyle = FRAME;
      ctx.fillRect(a - 1.6, y, b - a + 3.2, EYE_SLAB);
      ctx.fillStyle = PLASTER;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(a, y + EYE_SLAB - 0.35, b - a, 0.35);
      ctx.globalAlpha = 1;
      // The joists' cut ends along the front.
      ctx.fillStyle = FRAME_DARK;
      for (let x = a + 1; x < b; x += 3) ctx.fillRect(x, y + 0.85, 0.7, 0.55);
      const up = v.g.FIELD_H - y;
      const row = EYE_FLOORS.findIndex((f) => Math.abs(f - up) < 0.01);
      for (let c = 0; c < EYE_COLS; c++) {
        const r = roomBox(spec, Math.max(0, row) * EYE_COLS + c);
        const lo = Math.max(a, r.x0);
        const hi = Math.min(b, r.x1);
        if (hi > lo) floorTop(ctx, THEMES[r.i].floor, lo, hi, y, r.i);
      }
      return;
    }
    // A landing: boards on a box, a newel post with its knob.
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(a, y, b - a, 1.4);
    ctx.fillStyle = WOOD_LIT;
    ctx.fillRect(a, y, b - a, 0.4);
    ctx.fillStyle = WOOD;
    for (let x = a + 0.8; x < b; x += 1.4) ctx.fillRect(x, y - 2.6, 0.25, 2.6);
    ctx.fillRect(a, y - 2.8, b - a, 0.35);
    const nx = spec && a < spec.arena + 20 ? b : a;
    ctx.fillStyle = WOOD_LIT;
    ctx.fillRect(nx - 0.4, y - 3.4, 0.8, 3.4);
    circle(ctx, nx, y - 3.6, 0.5);
    ctx.fill();
  }

  /* -------------------------------------------------------- the Eye's art */

  // The Eye's state for drawing: its turn from the rules, or on a card one open in the middle.
  function eyeOf(v, b) {
    if (!v.round || !b.eye) return { state: "open", room: 4, decoy: -1, ms: 2000, full: 4000 };
    return b.eye;
  }

  // A lamp hanging from the middle of a room's ceiling at (x, top), swung by `swing`
  // radians, lit to `heat` (0 dim, 1 flaring white hot), `red` once the Eye is out.
  function lamp(ctx, x, top, swing, heat, red, clock, seed) {
    ctx.save();
    ctx.translate(x, top);
    rotate(ctx, swing);
    ctx.strokeStyle = "#1a1210";
    ctx.lineWidth = 0.18;
    line(ctx, 0, 0, 0, 2.2);
    const flick = heat > 0 ? 0.85 + 0.15 * Math.sin(clock / 23 + seed) : 1;
    const glow = red ? LAMP_RED : heat > 0.55 ? LAMP_HOT : LAMP;
    halo(ctx, 0, 3.1, 2.4 + heat * 7, glow, (0.22 + heat * 0.8) * flick);
    ctx.fillStyle = glow;
    circle(ctx, 0, 3.1, 0.45 + heat * 0.25);
    ctx.fill();
    // Its fringed shade.
    ctx.fillStyle = red ? "#5a1a14" : "#5a3a1a";
    poly(ctx, [-0.8, 2.2, 0.8, 2.2, 1.6, 3.4, -1.6, 3.4]);
    ctx.fill();
    ctx.fillStyle = BRASS;
    ctx.fillRect(-1.6, 3.3, 3.2, 0.2);
    ctx.restore();
  }

  // The Eye in room `r`'s wall: a seam that bulges and splits while its lamp flares
  // (`p` of the flare done), the torn paper peeled back as lids and the eyeball staring
  // out at YOU while open (`open` 0 to 1), flashing on a hit.
  function theEye(ctx, v, b, r, state, p, look) {
    const H = v.g.FIELD_H;
    const cx = r.cx;
    const cy = H - (r.floor + (EYE_LO + EYE_HI) / 2);
    const rw = EYE_W / 2 + 1.1;
    const rh = (EYE_HI - EYE_LO) / 2 + 0.2;
    const th = THEMES[r.i] || THEMES[4];
    if (state === "flare") {
      // The paper swelling, veins creeping out from a seam that opens.
      const k = ease(clamp(p, 0, 1));
      ctx.fillStyle = FLESH;
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ellipse(ctx, cx, cy, rw * (0.4 + 0.6 * k), rh * 0.18 + rh * 0.35 * k);
      ctx.fill();
      ctx.globalAlpha = 0.5 + 0.5 * k;
      ctx.strokeStyle = VEIN;
      ctx.lineWidth = 0.14;
      for (let n = 0; n < 7; n++) {
        const a = (n / 7) * TAU + 0.3;
        const len = (1.8 + (hash(n, r.i) % 4) * 0.5) * (0.4 + k);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * rw * 0.5, cy + Math.sin(a) * rh * 0.4);
        ctx.lineTo(cx + Math.cos(a) * (rw * 0.5 + len), cy + Math.sin(a) * (rh * 0.4 + len * 0.6));
        ctx.stroke();
      }
      ctx.strokeStyle = PUPIL;
      ctx.lineWidth = 0.25;
      line(ctx, cx - rw * k, cy, cx + rw * k, cy);
      ctx.globalAlpha = 1;
      return;
    }
    const open = clamp(p, 0, 1);
    if (open <= 0.02) return;
    // The torn paper curled back around the hole.
    ctx.fillStyle = th.paper;
    for (const s of [-1, 1]) {
      poly(ctx, [cx - rw - 0.6, cy, cx - rw * 0.5, cy + s * (rh + 1.1) * open, cx, cy + s * (rh + 1.5) * open, cx + rw * 0.5, cy + s * (rh + 1.1) * open, cx + rw + 0.6, cy]);
      ctx.fill();
    }
    ctx.fillStyle = LID;
    ellipse(ctx, cx, cy, rw + 0.2, rh * open + 0.2);
    ctx.fill();
    // The eyeball, and its look at YOU.
    ctx.save();
    ellipse(ctx, cx, cy, rw, rh * open);
    if (typeof ctx.clip === "function") ctx.clip();
    const hurt = b.hurt > 0;
    ctx.fillStyle = hurt ? "#ffffff" : phaseOf(b) === 2 ? SCLERA_SICK : SCLERA;
    ellipse(ctx, cx, cy, rw, rh);
    ctx.fill();
    ctx.strokeStyle = VEIN;
    ctx.lineWidth = 0.12;
    for (let n = 0; n < 8; n++) {
      const a = (n / 8) * TAU;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * rw, cy + Math.sin(a) * rh);
      ctx.lineTo(cx + Math.cos(a) * rw * 0.55 + Math.sin(n) * 0.3, cy + Math.sin(a) * rh * 0.55);
      ctx.stroke();
    }
    const you = v.round && v.round.you;
    const lx = you ? clamp((you.x - cx) / 30, -1, 1) * rw * 0.45 : 0;
    const ly = you ? clamp((cy - (H - you.y - 2)) / -20, -1, 1) * rh * 0.3 : 0;
    ctx.fillStyle = IRIS_DEEP;
    circle(ctx, cx + lx, cy + ly, rh * 0.82);
    ctx.fill();
    ctx.fillStyle = IRIS;
    circle(ctx, cx + lx, cy + ly, rh * 0.66);
    ctx.fill();
    ctx.fillStyle = PUPIL;
    ellipse(ctx, cx + lx, cy + ly, 0.32 + (state === "open" ? 0.1 * Math.sin(v.clock / 200) : 0), rh * 0.6);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.7;
    circle(ctx, cx + lx - 0.5, cy + ly - 0.6, 0.28);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    eye(v, cx + lx, cy + ly, 0.35, "#ffb030");
    // The lids' wet rims.
    ctx.strokeStyle = FLESH;
    ctx.lineWidth = 0.35;
    ellipse(ctx, cx, cy, rw, rh * open);
    ctx.stroke();
  }

  // Veins spreading over the paper as it weakens: more of them each phase.
  function rot(ctx, v, r, phase) {
    if (!phase) return;
    const H = v.g.FIELD_H;
    ctx.strokeStyle = VEIN;
    ctx.globalAlpha = 0.18 + phase * 0.12;
    ctx.lineWidth = 0.12;
    for (let n = 0; n < phase * 3; n++) {
      const h = hash(r.i * 7 + n, 77);
      let x = r.x0 + 2 + (h % 28);
      let y = H - r.top + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += ((hash(h, k) % 5) - 2) * 0.5;
        y += 1 + (hash(k, h) % 3) * 0.4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Each room's lamp: its swing (the sway, and the house's lean), how hot it burns.
  function lamps(ctx, v, b, e) {
    const spec = v.spec;
    const clock = v.clock;
    const tilt = b.tilt || 0;
    for (let i = 0; i < EYE_ROOMS; i++) {
      const r = roomBox(spec, i);
      let heat = 0;
      if (e.state === "flare" && (i === e.room || i === e.decoy)) {
        const p = 1 - e.ms / (e.full || 1);
        heat = 0.25 + 0.75 * ease(clamp(p, 0, 1));
      }
      const red = (e.state === "open" || e.state === "closing") && i === e.room;
      const swing = Math.sin(clock / 700 + i * 1.3) * 0.05 + tilt * 0.45;
      lamp(ctx, r.cx, v.g.FIELD_H - r.top, swing, red ? 0.4 : heat, red, clock, i);
    }
  }

  // Dust shaken from the ceilings while the house creaks and lurches.
  function shakeDust(ctx, v, b) {
    const tilt = Math.abs(b.tilt || 0);
    if (tilt < 0.05) return;
    const spec = v.spec;
    const H = v.g.FIELD_H;
    ctx.fillStyle = DUST;
    for (let n = 0; n < 40; n++) {
      const h = hash(n, 19);
      const r = roomBox(spec, h % EYE_ROOMS);
      const fall = ((v.clock / (600 + (h % 400)) + (h % 100) / 100) % 1);
      const x = r.x0 + 2 + ((h * 7) % 28) + (b.tilt || 0) * fall * 3;
      const y = H - r.top + fall * (r.top - r.floor);
      ctx.globalAlpha = tilt * 0.6 * (1 - fall);
      ctx.fillRect(x, y, 0.25, 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // The retreat by `b.t`: the Eye's burst, the paper peeling away to bare lath and dark,
  // the floors cracking from the top, a weeping socket and lamps blown out at the gasp,
  // the rooms sinking into the cellar's dark, and at last the stairway of bones.
  function retreat(ctx, v, b, look) {
    const spec = v.spec;
    const H = v.g.FIELD_H;
    const t = b.t || 0;
    const peel = clamp((t - PEEL_AT) / 900, 0, 1);
    const sink = clamp((t - SINK_AT) / (GONE_AT - SINK_AT), 0, 1);
    for (let i = 0; i < EYE_ROOMS; i++) {
      const r = roomBox(spec, i);
      const yt = H - r.top;
      const yb = H - r.floor;
      // Bare lath behind the paper as it falls.
      if (peel > 0) {
        ctx.fillStyle = LATH_DARK;
        ctx.fillRect(r.x0, yt, EYE_ROOM_W, (yb - yt) * peel);
        ctx.fillStyle = LATH;
        for (let y = yt + 0.4; y < yt + (yb - yt) * peel; y += 1.1) ctx.fillRect(r.x0 + 0.2, y, EYE_ROOM_W - 0.4, 0.4);
        // The paper's curling edge, coming down, and gone once it is all down.
        if (peel < 1) {
          ctx.fillStyle = THEMES[i].paper;
          const edge = yt + (yb - yt) * peel;
          for (let x = r.x0; x < r.x1; x += 2) {
            const h = hash(Math.round(x), i);
            poly(ctx, [x, edge - 0.2, x + 2, edge - 0.2, x + 1.4, edge + 0.8 + (h % 3) * 0.3, x + 0.4, edge + 0.4]);
            ctx.fill();
          }
        }
      }
      // The house sinking into the cellar: the dark coming down over each room from its ceiling.
      if (sink > 0) {
        ctx.fillStyle = "#050306";
        ctx.globalAlpha = 0.86;
        ctx.fillRect(r.x0, yt, EYE_ROOM_W, (yb - yt) * Math.min(1, sink * 1.15));
        ctx.globalAlpha = 1;
      }
      // Lamps: guttering at the gasp, then out.
      if (t < GASP_AT + 400) lamp(ctx, r.cx, yt, Math.sin(v.clock / 300 + i) * 0.2 * (1 - sink), t < GASP_AT ? 0.15 : 0.15 * (Math.sin(v.clock / 40 + i) > 0 ? 1 : 0), false, v.clock, i);
    }
    // The landings stand in the dark too.
    for (const [a, c, y] of spec.shelves) if (c - a <= 20) shelf(ctx, v, look, a, c, H - y);
    // The floors cracking, one after another from the top.
    CRACK_AT.forEach((at, n) => {
      if (t < at) return;
      const y = H - EYE_FLOORS[EYE_FLOORS.length - 1 - n];
      ctx.strokeStyle = "#0a0604";
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      let x = spec.arena;
      ctx.moveTo(x, y + 0.6);
      while (x < spec.length) {
        x += 1.6 + (hash(Math.round(x), n) % 3) * 0.6;
        ctx.lineTo(Math.min(x, spec.length), y + 0.2 + (hash(Math.round(x), n + 9) % 5) * 0.3);
      }
      ctx.stroke();
    });
    // The burst Eye's socket, weeping.
    if (b.eye && b.eye.room >= 0 && t < SINK_AT + 800) {
      const r = roomBox(spec, b.eye.room);
      const cy = H - (r.floor + (EYE_LO + EYE_HI) / 2);
      ctx.fillStyle = LID;
      ellipse(ctx, r.cx, cy, EYE_W / 2 + 0.6, 1.6);
      ctx.fill();
      ctx.fillStyle = ICHOR;
      const drip = clamp(t / 1500, 0, 1) * (r.floor + (EYE_LO + EYE_HI) / 2 - r.floor);
      ctx.fillRect(r.cx - 0.4, cy, 0.8, drip);
      if (t >= GASP_AT) {
        ctx.globalAlpha = 0.6;
        circle(ctx, r.cx, cy - 1.5 - ((t - GASP_AT) / 300) % 2, 0.6);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    if (b.gone) boneStair(ctx, v, spec.door, H - EYE_FLOORS[0]);
    else shutDoor(ctx, spec.door, H - EYE_FLOORS[0]);
  }

  // Its front door, held shut over the open exit while the house dies around it.
  function shutDoor(ctx, x, fy) {
    ctx.fillStyle = "#0e0806";
    roundRect(ctx, x - 4.4, fy - 13, 8.8, 13, [4.4, 4.4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#2a1a10";
    roundRect(ctx, x - 3.6, fy - 12.2, 7.2, 12.2, [3.6, 3.6, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#0e0806";
    ctx.lineWidth = 0.3;
    line(ctx, x, fy - 12, x, fy);
  }

  // While the house leans, chevrons running down each floor the way everything slides.
  function slideMarks(ctx, v, b) {
    const tilt = b.tilt || 0;
    if (Math.abs(tilt) < 0.3) return;
    const spec = v.spec;
    const H = v.g.FIELD_H;
    const dir = Math.sign(tilt);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = (Math.abs(tilt) - 0.3) * 0.7;
    const run = ((v.clock / 60) % 6) * dir;
    for (const f of EYE_FLOORS) {
      const y = H - f - 0.9;
      for (let x = spec.arena + 3 + run; x < spec.length - 2; x += 6) {
        if (x < spec.arena + 1) continue;
        ctx.beginPath();
        ctx.moveTo(x - dir * 0.5, y - 0.5);
        ctx.lineTo(x + dir * 0.3, y);
        ctx.lineTo(x - dir * 0.5, y + 0.5);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // The stairway of bones down through its front door: an arch of long bones round a
  // doorway into the dark, steps of bone and skull going down, a warm light far below.
  function boneStair(ctx, v, x, fy) {
    ctx.fillStyle = "#070405";
    roundRect(ctx, x - 4.2, fy - 12.6, 8.4, 12.6, [4.2, 4.2, 0, 0]);
    ctx.fill();
    halo(ctx, x, fy - 1, 6, "#ffb060", 0.35 + 0.1 * Math.sin(v.clock / 300));
    for (let k = 0; k < 5; k++) {
      const w = 6.4 - k * 1.1;
      const y = fy - 0.6 - k * 1.5;
      ctx.fillStyle = k % 2 ? BONE_DARK : BONE;
      ctx.globalAlpha = 1 - k * 0.16;
      roundRect(ctx, x - w / 2, y, w, 0.6, 0.3);
      ctx.fill();
      circle(ctx, x - w / 2, y + 0.3, 0.4);
      ctx.fill();
      circle(ctx, x + w / 2, y + 0.3, 0.4);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The arch of bones and a skull at its keystone.
    ctx.strokeStyle = BONE;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(x - 4.4, fy);
    ctx.lineTo(x - 4.4, fy - 8.4);
    ctx.arc(x, fy - 8.4, 4.4, Math.PI, 0);
    ctx.lineTo(x + 4.4, fy);
    ctx.stroke();
    ctx.fillStyle = BONE;
    for (let k = 0; k < 7; k++) {
      const a = Math.PI + (k / 6) * Math.PI;
      circle(ctx, x + Math.cos(a) * 4.4, fy - 8.4 + Math.sin(a) * 4.4, 0.45);
      ctx.fill();
    }
    circle(ctx, x, fy - 13.1, 1);
    ctx.fill();
    ctx.fillStyle = "#1a1010";
    circle(ctx, x - 0.35, fy - 13.2, 0.25);
    ctx.fill();
    circle(ctx, x + 0.35, fy - 13.2, 0.25);
    ctx.fill();
    label(ctx, "DOWN", x, fy - 15.4, 1.5, BONE, "center", undefined, true);
  }

  // The card's picture: the dollhouse in small, nine lit rooms, the Eye open in the
  // middle one, standing on its feet at (b.x, b.y).
  function cardHouse(ctx, v, b) {
    const H = v.g.FIELD_H;
    const x0 = b.x - 15;
    const y0 = H - b.y;
    ctx.fillStyle = ROOF;
    poly(ctx, [x0 - 2, y0 - 24, b.x, y0 - 31, x0 + 32, y0 - 24]);
    ctx.fill();
    ctx.fillStyle = FRAME_DARK;
    ctx.fillRect(x0 - 1, y0 - 24.5, 32, 24.5);
    for (let i = 0; i < EYE_ROOMS; i++) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const rx = x0 + col * 10;
      const ry = y0 - (row + 1) * 8;
      ctx.fillStyle = THEMES[i].paper;
      ctx.fillRect(rx + 0.3, ry + 0.4, 9.4, 7.2);
      ctx.fillStyle = THEMES[i].ink;
      for (let x = rx + 1; x < rx + 9.6; x += 1.6) ctx.fillRect(x, ry + 0.4, 0.6, 7.2);
      halo(ctx, rx + 5, ry + 2, 3, i === 4 ? LAMP_RED : LAMP, 0.5);
      ctx.fillStyle = i === 4 ? LAMP_RED : LAMP;
      circle(ctx, rx + 5, ry + 1.6, 0.4);
      ctx.fill();
      ctx.fillStyle = WOOD;
      ctx.fillRect(rx, ry + 7.6, 10, 0.5);
    }
    const r = { i: 4, cx: b.x, floor: b.y + 8, top: b.y + 16 };
    ctx.save();
    ctx.translate(0, 0);
    theEye(ctx, v, b, { ...r, x0: x0 + 10, x1: x0 + 20 }, "open", 1, LOOKS.dollhouse);
    ctx.restore();
  }

  // The House itself: on a card, its picture; in the fight, each room's lamp, the Eye,
  // the rot and the dust; after its kill, the retreat's scene.
  function marroweye(ctx, v, b) {
    if (!ours(v) || !v.round) return cardHouse(ctx, v, b);
    const spec = v.spec;
    const look = LOOKS.dollhouse;
    if (b.state === "down") return retreat(ctx, v, b, look);
    const e = eyeOf(v, b);
    const phase = b.max ? phaseOf(b) : 0;
    for (let i = 0; i < EYE_ROOMS; i++) rot(ctx, v, roomBox(spec, i), phase);
    if (e.room >= 0) {
      const r = roomBox(spec, e.room);
      if (e.state === "flare") {
        theEye(ctx, v, b, r, "flare", 1 - e.ms / (e.full || 1), look);
        if (e.decoy >= 0) theEye(ctx, v, b, roomBox(spec, e.decoy), "flare", 1 - e.ms / (e.full || 1), look);
      } else if (e.state === "open") theEye(ctx, v, b, r, "open", clamp((e.full - e.ms) / 180, 0, 1), look);
      else if (e.state === "closing") theEye(ctx, v, b, r, "closing", e.ms / 400, look);
    }
    lamps(ctx, v, b, e);
    shakeDust(ctx, v, b);
    slideMarks(ctx, v, b);
  }

  /* ------------------------------------------------------------ the shades */

  // A shade: the keeper's own figure from its art, drawn small, pale and see-through,
  // faded in and out, with a cold glow round it; while it winds up its move, a sign of
  // what is coming (a crouch, a glint, a mark where it will land).
  const SHADE_W = 6;
  const SHADE_H = 6;
  function eyeShade(ctx, v, m, x, y, t, flash) {
    const fade = m.act === "in" ? 1 - clamp(m.wait / SHADE_IN_MS, 0, 1) : m.act === "out" ? clamp(m.wait / SHADE_OUT_MS, 0, 1) : 1;
    const was = ctx.globalAlpha;
    const wind = m.act === "wind" ? 1 - clamp(m.wait / (m.full || 1), 0, 1) : 0;
    // The cold glow, and on a wind-up a warning red in it.
    halo(ctx, x, y - 2.6, 4.2, wind > 0 ? DANGER : SHADE_GLOW, (0.35 + wind * 0.4) * fade);
    if (m.move === "leap" && m.act === "wind" && Number.isFinite(m.tx)) {
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.25;
      ctx.globalAlpha = was * (0.4 + 0.6 * wind);
      ellipse(ctx, m.tx, v.g.FIELD_H - m.floor - 0.1, 2.6 - wind, 0.5);
      ctx.stroke();
      ctx.globalAlpha = was;
    }
    if (m.move === "dash" && m.act === "wind") {
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.18;
      ctx.globalAlpha = was * wind;
      for (let k = 0; k < 3; k++) line(ctx, x + m.dir * (2 + k * 2), y - 1.2 - k * 0.9, x + m.dir * (4 + k * 2.4), y - 1.2 - k * 0.9);
      ctx.globalAlpha = was;
    }
    const def = (v.bosses && v.bosses[m.of]) || { w: 10, h: 10 };
    const art = bossArt ? bossArt(m.of) : null;
    const k = Math.min(SHADE_H / def.h, SHADE_W / def.w);
    const squash = m.move === "hop" || m.move === "leap" ? 1 - 0.15 * wind : 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k * squash);
    ctx.globalAlpha = was * fade * (flash ? 0.95 : 0.6 + 0.08 * Math.sin(t / 90));
    if ("filter" in ctx || typeof ctx.filter === "string") ctx.filter = "grayscale(1) brightness(1.7) contrast(0.85)";
    let drawn = false;
    if (typeof art === "function") {
      try {
        const pic = { g: { FIELD_H: 0 }, clock: v.clock, spec: null, groundAt: () => 0, eyes: [], bosses: v.bosses };
        const fb = { kind: m.of, x: 0, y: 0, w: def.w, h: def.h, hurt: 0, dir: m.dir, wait: Infinity, landX: 0, windup: 0, act: "", state: "fight", t: 0, hp: 1, max: 1, lit: true };
        art(ctx, pic, fb);
        drawn = true;
      } catch {
        drawn = false;
      }
    }
    if ("filter" in ctx || typeof ctx.filter === "string") ctx.filter = "none";
    ctx.restore();
    if (!drawn) {
      ctx.globalAlpha = was * fade * 0.6;
      ctx.fillStyle = SHADE;
      ellipse(ctx, x, y - 2.4, 1.5, 2.4);
      ctx.fill();
    }
    // A pale wash over it and a wisp at its feet: a ghost of the thing, not the thing.
    ctx.globalAlpha = was * fade * 0.18;
    ctx.fillStyle = SHADE;
    ellipse(ctx, x, y - 2.8, 2.6, 3.2);
    ctx.fill();
    ctx.globalAlpha = was * fade * 0.4;
    for (let n = 0; n < 4; n++) {
      ellipse(ctx, x + Math.sin(t / 160 + n * 1.7) * 1.2, y - 0.2, 0.9 - n * 0.15, 0.3);
      ctx.fill();
    }
    ctx.globalAlpha = was;
    eye(v, x - 0.5 * m.dir, y - 4.2, 0.2, SHADE_GLOW);
  }

  /* -------------------------------------------------------------- hazards */

  // A door in the wall creaking open, cold light behind it, the shade's outline in the gap.
  function eyeDoorway(ctx, v, h) {
    const H = v.g.FIELD_H;
    const p = 1 - h.warn / (h.full || 1);
    const x = h.x;
    const fy = H - h.y;
    ctx.fillStyle = "#08060a";
    ctx.fillRect(x - 1.7, fy - 5.6, 3.4, 5.6);
    halo(ctx, x, fy - 2.8, 3 + p * 3, SHADE_GLOW, 0.3 + 0.5 * p);
    ctx.fillStyle = FRAME;
    ctx.fillRect(x - 2, fy - 6, 4, 0.5);
    ctx.fillRect(x - 2, fy - 6, 0.4, 6);
    ctx.fillRect(x + 1.6, fy - 6, 0.4, 6);
    // The leaf swinging in.
    ctx.fillStyle = WOOD;
    ctx.fillRect(x - 1.6, fy - 5.5, 3.2 * (1 - 0.8 * ease(p)), 5.5);
    ctx.fillStyle = BRASS;
    circle(ctx, x - 1.6 + 3.2 * (1 - 0.8 * ease(p)) - 0.5, fy - 2.6, 0.2);
    ctx.fill();
    if (p > 0.5) {
      ctx.globalAlpha = (p - 0.5) * 1.2;
      ctx.fillStyle = SHADE;
      ellipse(ctx, x + 0.6, fy - 2.6, 0.9, 2.2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // A pale ripple of the floor running along it.
  function eyeRipple(ctx, v, h) {
    const H = v.g.FIELD_H;
    const fy = H - h.y;
    ctx.fillStyle = SHADE_GLOW;
    ctx.globalAlpha = 0.35;
    ellipse(ctx, h.x - h.dir * 1.2, fy - 0.4, 2.4, 0.5);
    ctx.fill();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = SHADE;
    poly(ctx, [h.x - 1, fy, h.x - 0.3, fy - h.h, h.x + 0.2, fy - h.h * 0.8, h.x + 1, fy]);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // The thrown skull, spinning, a pale streak behind it.
  function eyeSkull(ctx, v, h) {
    const H = v.g.FIELD_H;
    const y = H - h.y - h.h / 2;
    const dir = h.back ? -h.dir : h.dir;
    ctx.strokeStyle = SHADE_GLOW;
    ctx.lineWidth = 0.4;
    ctx.globalAlpha = 0.4;
    line(ctx, h.x - dir * 3, y, h.x, y);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(h.x, y);
    rotate(ctx, (v.clock / 70) * dir);
    ctx.fillStyle = BONE;
    circle(ctx, 0, -0.1, 0.75);
    ctx.fill();
    ctx.fillRect(-0.4, 0.3, 0.8, 0.5);
    ctx.fillStyle = "#1a1010";
    circle(ctx, -0.3, -0.15, 0.2);
    ctx.fill();
    circle(ctx, 0.3, -0.15, 0.2);
    ctx.fill();
    ctx.restore();
  }

  // The scythe: its reach marked along the floor while it winds up (brighter as it
  // comes), then a pale crescent sweeping across.
  function eyeScythe(ctx, v, h) {
    const H = v.g.FIELD_H;
    const fy = H - h.y;
    const x0 = h.x - h.w / 2;
    if (h.warn > 0) {
      const p = 1 - h.warn / (h.full || 1);
      ctx.fillStyle = DANGER;
      ctx.globalAlpha = 0.12 + 0.3 * p;
      ctx.fillRect(x0, fy - h.h, h.w, h.h);
      ctx.globalAlpha = 0.5 + 0.5 * p;
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.2;
      for (let x = x0; x < x0 + h.w; x += 1.2) line(ctx, x, fy - 0.1, x + 0.6, fy - 0.1);
      ctx.globalAlpha = 1;
      return;
    }
    const p = 1 - clamp(h.live / SCYTHE_LIVE_MS, 0, 1);
    const at = h.dir > 0 ? x0 + h.w * p : x0 + h.w * (1 - p);
    ctx.fillStyle = SHADE;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.ellipse?.(at, fy - 0.8, 2.6, 0.9, 0, Math.PI, TAU);
    ctx.fill();
    ctx.globalAlpha = 0.3;
    ctx.fillRect(Math.min(at, h.dir > 0 ? x0 : x0 + h.w), fy - 1.2, Math.abs(at - (h.dir > 0 ? x0 : x0 + h.w)), 0.6);
    ctx.globalAlpha = 1;
  }

  // A sung note gliding along the floor.
  function eyeNote(ctx, v, h) {
    const H = v.g.FIELD_H;
    const fy = H - h.y - 0.3 + Math.sin(v.clock / 90) * 0.2;
    halo(ctx, h.x, fy - 0.9, 2, NOTE_GOLD, 0.45);
    ctx.fillStyle = NOTE_GOLD;
    ellipse(ctx, h.x, fy - 0.4, 0.6, 0.42, -0.4);
    ctx.fill();
    ctx.fillRect(h.x + 0.45, fy - 2, 0.2, 1.6);
    poly(ctx, [h.x + 0.65, fy - 2, h.x + 1.5, fy - 1.4, h.x + 0.65, fy - 1.6]);
    ctx.fill();
  }

  // The ringmaster's hoop, rolling.
  function eyeHoop(ctx, v, h) {
    const H = v.g.FIELD_H;
    const r = h.h / 2;
    const cy = H - h.y - r;
    ctx.lineWidth = 0.45;
    for (let k = 0; k < 8; k++) {
      const a0 = (k / 8) * TAU + (v.clock / 120) * h.dir;
      ctx.strokeStyle = k % 2 ? "#f0e6e0" : HOOP_RED;
      ctx.beginPath();
      ctx.ellipse?.(h.x, cy, r * 0.45, r, 0, a0, a0 + TAU / 8);
      ctx.stroke();
    }
  }

  // A wave of bog mud, bubbling as it comes.
  function eyeMud(ctx, v, h) {
    const H = v.g.FIELD_H;
    const fy = H - h.y;
    ctx.fillStyle = MUD;
    poly(ctx, [h.x - h.w, fy, h.x - h.w * 0.4, fy - h.h * 0.7, h.x + h.dir * 0.4, fy - h.h, h.x + h.dir * h.w * 0.6, fy - h.h * 0.5, h.x + h.w, fy]);
    ctx.fill();
    ctx.fillStyle = MUD_LIT;
    for (let k = 0; k < 3; k++) {
      circle(ctx, h.x - h.w * 0.5 + k, fy - h.h * 0.6 - Math.abs(Math.sin(v.clock / 150 + k)) * 0.5, 0.3);
      ctx.fill();
    }
  }

  // A rock or an icicle: a growing mark on the floor and a sign at the ceiling while it
  // warns (dust trickling, a glint and a drip), then falling.
  function drop(ctx, v, h, ice) {
    const H = v.g.FIELD_H;
    const fy = H - h.floor;
    const ty = H - h.top;
    if (h.warn > 0) {
      const p = 1 - h.warn / (h.full || 1);
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = 0.25 + 0.45 * p;
      ellipse(ctx, h.x, fy - 0.1, h.w * (0.5 + 0.6 * p), 0.35);
      ctx.fill();
      ctx.globalAlpha = 0.4 + 0.5 * p;
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.2;
      ellipse(ctx, h.x, fy - 0.1, h.w * (1.4 - 0.5 * p), 0.5);
      ctx.stroke();
      // A dashed line of warning from the ceiling down to where it lands.
      ctx.globalAlpha = 0.2 + 0.45 * p;
      ctx.lineWidth = 0.14;
      for (let y = ty + 0.4; y < fy - 0.6; y += 1.2) line(ctx, h.x, y, h.x, Math.min(fy - 0.6, y + 0.6));
      ctx.globalAlpha = 1;
      if (ice) {
        ctx.fillStyle = ICE;
        poly(ctx, [h.x - h.w / 2, ty, h.x + h.w / 2, ty, h.x, ty + h.h * (0.6 + 0.4 * p)]);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(v.clock / 60);
        circle(ctx, h.x - 0.2, ty + 0.6, 0.18);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = ICE_DEEP;
        circle(ctx, h.x, ty + h.h + ((v.clock / 400) % 1) * (h.top - h.floor - h.h), 0.15);
        ctx.fill();
      } else {
        ctx.fillStyle = DUST;
        for (let k = 0; k < 4; k++) {
          const f = ((v.clock / 300 + k / 4) % 1);
          ctx.globalAlpha = 0.7 * (1 - f);
          ctx.fillRect(h.x - 0.4 + k * 0.25, ty + f * (h.top - h.floor), 0.2, 0.35);
        }
        ctx.globalAlpha = 1;
      }
      return;
    }
    const y = H - h.y - h.h;
    if (ice) {
      ctx.fillStyle = ICE;
      poly(ctx, [h.x - h.w / 2, y, h.x + h.w / 2, y, h.x, y + h.h]);
      ctx.fill();
    } else {
      ctx.fillStyle = ROCK;
      poly(ctx, [h.x - h.w / 2, y + h.h * 0.7, h.x - h.w * 0.3, y, h.x + h.w * 0.4, y + 0.2, h.x + h.w / 2, y + h.h, h.x - h.w * 0.2, y + h.h]);
      ctx.fill();
      ctx.fillStyle = ROCK_LIT;
      ctx.fillRect(h.x - h.w * 0.2, y + 0.3, h.w * 0.4, 0.3);
    }
  }
  const eyeRock = (ctx, v, h) => drop(ctx, v, h, false);
  const eyeIcicle = (ctx, v, h) => drop(ctx, v, h, true);

  // The beast's landing: a ring of dust.
  function eyePounce(ctx, v, h) {
    const H = v.g.FIELD_H;
    ctx.strokeStyle = SHADE;
    ctx.lineWidth = 0.3;
    ctx.globalAlpha = 0.7;
    ellipse(ctx, h.x, H - h.y - 0.3, h.w * 0.6, 0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The dresser: rocking at the uphill end through the creak, then sliding with the
  // house's lean, scraping; cracked by each bolt it takes.
  function eyeDresser(ctx, v, h) {
    const H = v.g.FIELD_H;
    const fy = H - h.y;
    const rock = h.warn > 0 ? Math.sin(v.clock / 70) * 0.08 * (1 - h.warn / (h.full || 1)) : 0.06 * h.dir;
    ctx.save();
    ctx.translate(h.x + (h.warn > 0 ? 0 : -h.dir * h.w / 2), fy);
    rotate(ctx, rock);
    const x0 = h.warn > 0 ? -h.w / 2 : h.dir > 0 ? 0 : -h.w;
    ctx.fillStyle = WOOD_DARK;
    ctx.fillRect(x0, -h.h, h.w, h.h);
    ctx.fillStyle = WOOD;
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(x0 + 0.3, -h.h + 0.5 + k * 1.2, h.w - 0.6, 1);
      ctx.fillStyle = BRASS;
      circle(ctx, x0 + h.w / 2, -h.h + 1 + k * 1.2, 0.15);
      ctx.fill();
      ctx.fillStyle = WOOD;
    }
    ctx.fillStyle = WOOD_LIT;
    ctx.fillRect(x0 - 0.2, -h.h - 0.3, h.w + 0.4, 0.35);
    // A mirror on top.
    ctx.fillStyle = "#8a9aa4";
    ctx.globalAlpha = 0.6;
    ellipse(ctx, x0 + h.w / 2, -h.h - 1.2, 0.9, 0.9);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (h.hp < DRESSER_HP) {
      ctx.strokeStyle = "#0a0604";
      ctx.lineWidth = 0.15;
      for (let k = 0; k < DRESSER_HP - h.hp; k++) line(ctx, x0 + 0.6 + k, -h.h + 0.3, x0 + 1.4 + k * 0.8, -0.4);
    }
    ctx.restore();
    if (h.warn <= 0) {
      ctx.strokeStyle = DUST;
      ctx.lineWidth = 0.15;
      ctx.globalAlpha = 0.6;
      for (let k = 1; k < 4; k++) line(ctx, h.x - h.dir * (h.w / 2 + k * 1.2), fy - 0.15, h.x - h.dir * (h.w / 2 + k * 1.2 + 0.8), fy - 0.15);
      ctx.globalAlpha = 1;
    }
  }

  /* ------------------------------------------------------------- lights */

  // Each lamp's warm pool (a flaring one blazing), the open Eye's amber, the shades'
  // cold glow, a note's and an icicle's glint, and the bone stair's light.
  function lights(v, add) {
    if (!ours(v) || !v.round) return;
    const round = v.round;
    const spec = v.spec;
    const b = round.boss;
    if (b && b.kind === "marroweye") {
      const e = b.eye;
      const down = b.state === "down";
      for (let i = 0; i < EYE_ROOMS; i++) {
        const r = roomBox(spec, i);
        let s = down ? (b.t < GASP_AT ? 0.35 : 0) : 0.4;
        if (!down && e && e.state === "flare" && (i === e.room || i === e.decoy)) s = 0.5 + 0.5 * (1 - e.ms / (e.full || 1));
        if (s > 0) add(r.cx, r.top - 3, 7 + s * 8, s);
      }
      if (!down && e && (e.state === "open" || e.state === "closing") && e.room >= 0) {
        const r = roomBox(spec, e.room);
        add(r.cx, r.floor + 3, 8, 0.8);
      }
      if (b.gone) add(spec.door, EYE_FLOORS[0] + 4, 10, 0.8);
    }
    for (const m of round.monsters) if (m.kind === "eyeShade" && !m.dead) add(m.x, m.y + 2.6, 5, 0.5);
    for (const h of round.hazards) {
      if (h.kind === "eyeNote") add(h.x, h.y + 1, 3, 0.5);
      else if (h.kind === "eyeDoorway") add(h.x, h.y + 3, 4, 0.5);
      else if ((h.kind === "eyeIcicle" || h.kind === "eyeRock") && h.warn > 0) add(h.x, h.floor + 1, 3, 0.4);
      else if (h.kind === "eyeScythe") add(h.x, h.y + 1, 5, 0.4);
    }
  }

  /* ------------------------------------------------------------- events */

  // A telegraph's words, on the first few times only (counted in fx).
  function told(fx, key) {
    fx.eyeTold = fx.eyeTold || {};
    fx.eyeTold[key] = (fx.eyeTold[key] || 0) + 1;
    return fx.eyeTold[key] <= 3;
  }

  const SHADE_WORDS = freeze({ hop: "It hops!", skull: "Duck the skull!", scythe: "Jump the scythe!", note: "A note!", dash: "She dashes!", leap: "It leaps!", knock: "Knock knock!", hoop: "Jump the hoop!", icicles: "Icicles!", mud: "Mud!" });

  // What the Eye's events look and sound like, beside ghoul-draw.js's own (the shared
  // bossWake, bossHit, bossDown and bossBlock, and a shade's hit and kill, are its): true
  // when `e` was one of them. Each plays one voice; the ones that come several at once
  // are gated.
  function react(e, k) {
    const { tone, burst, float, ring, glow, shake, flash, fx } = k;
    if (e.type === "eyeFlare") {
      if (gate(fx, "eyeFlareMs", 150)) say(tone, "marroweye", "flare", 0.5);
      glow(e.x, e.y + 6, 7, 0.7, 500);
      ring(e.x, e.y, GOLD, 1, 5, 700);
      if (!e.decoy && told(fx, "flare")) float(e.x, e.y + 8, "Its lamp flares!", GOLD, 2.2);
    } else if (e.type === "eyeFlareStep") {
      say(tone, "marroweye", "flareStep", 0.5);
      ring(e.x, e.y, DANGER, 0.6, 4, 450);
    } else if (e.type === "eyeOpen") {
      say(tone, "marroweye", "open", 0.6);
      burst(e.x, e.y, FLESH, 10, 8, 400);
      shake(90, 0.25);
      if (told(fx, "open")) float(e.x, e.y + 6, "Shoot the Eye!", GOLD, 2.4);
    } else if (e.type === "eyeDud") {
      say(tone, "marroweye", "dud", 0.4);
      burst(e.x, e.y + 5, DUST, 6, 5, 400);
    } else if (e.type === "eyeShut") {
      say(tone, "marroweye", "shut", 0.5);
      burst(e.x, e.y, FLESH, 6, 6, 300);
    } else if (e.type === "eyeDoor") {
      if (gate(fx, "eyeDoorMs", 150)) say(tone, "marroweye", "door", 0.45);
      glow(e.x, e.y + 3, 4, 0.5, 600);
    } else if (e.type === "eyeShadeIn") {
      say(tone, "eyeShade", "come", 0.5);
      burst(e.x, e.y + 2.5, SHADE, 10, 6, 500);
    } else if (e.type === "eyeShadeOut") {
      if (gate(fx, "eyeShadeOutMs", 150)) say(tone, "eyeShade", "fade", 0.4);
      burst(e.x, e.y + 1, SHADE, 8, 5, 500);
    } else if (e.type === "eyeShadeWind") {
      if (gate(fx, "eyeShadeWindMs", 120)) say(tone, "eyeShade", "wind", 0.5);
      ring(e.x, e.y, DANGER, 0.8, 3.5, 600);
      if (e.tx !== undefined) ring(e.tx, e.y - 3, DANGER, 0.6, 3, 800);
      for (const x of e.xs || []) ring(x, e.ty, DANGER, 0.5, 2.4, 700);
      if (told(fx, `shade-${e.move}`) && SHADE_WORDS[e.move]) float(e.x, e.y + 5, SHADE_WORDS[e.move], DANGER, 2.2);
    } else if (e.type === "eyeShadeSlam") {
      say(tone, "eyeShade", "slam", 0.5);
      burst(e.x, e.y + 0.4, SHADE, 10, 9, 350);
      shake(70, 0.2);
    } else if (e.type === "eyeSkullThrow") {
      say(tone, "eyeShade", "throw", 0.45);
    } else if (e.type === "eyeSkullTurn") {
      ring(e.x, e.y, SHADE, 0.4, 1.6, 250);
    } else if (e.type === "eyeShadeGrind") {
      if (gate(fx, "eyeGrindMs", 400)) say(tone, "eyeShade", "grind", 0.45);
    } else if (e.type === "eyeScythe") {
      say(tone, "eyeShade", "scythe", 0.55);
    } else if (e.type === "eyeNote") {
      say(tone, "eyeShade", "note", 0.5);
    } else if (e.type === "eyeShadeDash") {
      say(tone, "eyeShade", "dash", 0.5);
    } else if (e.type === "eyeShadeLeap") {
      say(tone, "eyeShade", "leap", 0.5);
    } else if (e.type === "eyePounce") {
      say(tone, "eyeShade", "pounce", 0.55);
      burst(e.x, e.y + 0.4, DUST, 12, 9, 400);
      shake(100, 0.3);
    } else if (e.type === "eyeKnock") {
      say(tone, "eyeShade", "knock", 0.4 + e.n * 0.08);
      ring(e.at, e.ty, DANGER, 0.5, 2.4, 700);
    } else if (e.type === "eyeRockLand") {
      if (gate(fx, "eyeRockMs", 100)) say(tone, "eyeShade", "rock", 0.5);
      burst(e.x, e.y + 0.4, ROCK_LIT, 8, 8, 350);
    } else if (e.type === "eyeHoop") {
      say(tone, "eyeShade", "hoop", 0.5);
    } else if (e.type === "eyeIcicleLand") {
      if (gate(fx, "eyeIcicleMs", 100)) say(tone, "eyeShade", "icicle", 0.5);
      burst(e.x, e.y + 0.4, ICE, 10, 9, 350);
    } else if (e.type === "eyeMud") {
      say(tone, "eyeShade", "mud", 0.5);
      burst(e.x, e.y, MUD_LIT, 8, 7, 350);
    } else if (e.type === "eyeCreak") {
      say(tone, "marroweye", "creak", 0.55);
      shake(200, 0.15);
      if (told(fx, "creak")) float(e.x, e.y + 8, e.dir > 0 ? "It leans right!" : "It leans left!", DANGER, 2.4);
    } else if (e.type === "eyeCreakStep") {
      say(tone, "marroweye", "creakStep", 0.55);
      shake(160, 0.2);
    } else if (e.type === "eyeLurch") {
      say(tone, "marroweye", "lurch", 0.65);
      shake(420, 0.55);
    } else if (e.type === "eyeDresserCrash") {
      if (gate(fx, "eyeCrashMs", 120)) say(tone, "marroweye", "crash", 0.5);
      burst(e.x, e.y, WOOD_LIT, 10, 8, 400);
    } else if (e.type === "eyeDresserSmash") {
      say(tone, "marroweye", "smash", 0.55);
      burst(e.x, e.y, WOOD_LIT, 16, 12, 500);
      burst(e.x, e.y, "#8a9aa4", 8, 10, 400);
    } else if (e.type === "eyeBurst") {
      say(tone, "marroweye", "burst", 0.75);
      burst(e.x, e.y, ICHOR, 30, 18, 700);
      burst(e.x, e.y, SCLERA, 14, 14, 600);
      flash("#ffd0a0", 180);
    } else if (e.type === "eyePeel") {
      say(tone, "marroweye", "peel", 0.6);
    } else if (e.type === "eyeCrack") {
      say(tone, "marroweye", "crack", 0.6);
      burst(e.x, e.y, DUST, 18, 10, 600);
      shake(220, 0.45);
    } else if (e.type === "eyeGasp") {
      say(tone, "marroweye", "gasp", 0.7);
      shake(240, 0.25);
    } else if (e.type === "eyeSink") {
      say(tone, "marroweye", "sink", 0.7);
      burst(e.x, 7, DUST, 26, 12, 900);
      shake(1100, 0.7);
    } else if (e.type === "eyeGone") {
      say(tone, "marroweye", "gone", 0.6);
      burst(e.x, e.y, BONE, 14, 8, 700);
      glow(e.x, e.y, 8, 0.6, 600);
      float(e.x, e.y + 8, "Down the stairs!", GOLD, 2.4);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    decor: freeze({}),
    monsters: freeze({ eyeShade }),
    bosses: freeze({ marroweye }),
    missiles: freeze({}),
    hazards: freeze({ eyeDoorway, eyeRipple, eyeSkull, eyeScythe, eyeNote, eyeHoop, eyeMud, eyeRock, eyeIcicle, eyePounce, eyeDresser }),
    waves: freeze({}),
    powers: freeze({}),
    lights,
    react,
  });
}
