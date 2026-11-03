// Plan2Code Web Console - Ghoul Rush's drawing: each room of the haunted house in its own dark look, the floors, pits, shelves, doors and chandeliers, the souls, power-ups and key, the zombies, crawlers, bats, ghosts, skeletons, hellhounds, widows, wraiths, bloaters and bosses, Planny and his flashlight blaster, the dark and what lights it, the pills and the banners, from a view ghoul.js refills, and what each event looks and sounds like.
//
// Drawing only: no rules and no state of its own beyond the still layers and
// the dark layer it keeps (react() turns an event into effects in the object
// ghoul.js keeps). ghoul.js hands drawScene() one view object of the moment
// (the round, its room, the board's geometry, the effects running, the
// colors readColors() took from the page), so the rules never touch a canvas
// and this file never decides anything. Everything is drawn in room units
// under one scale, y turned the right way up (the rules count it up from the
// floor), the field scrolled by the round's camera. Anything that moves on
// its own (a soul's flicker, a bat's wings) follows the view's clock, never
// Math.random(), so a paused game's frame stays still.
//
// The house is dark. The world is drawn first, then a layer of near black
// over the whole field with holes cut where there is light: a glow around
// Planny, his flashlight's cone the way he faces, its muzzle flash and bolts,
// the chandeliers' candles, moonlight from the windows, the open door, the
// key and the pickups, and the flare of each kill; a flash of lightning now
// and then lifts the dark for a moment. Over the dark go what burns in it:
// the monsters' eyes, the bolts, the souls and the Gourd's carved face.
//
// The rooms, the monsters and the pickups keep their own fixed colors, the
// same in light and dark, and what never moves in a room (the walls, the
// windows and pictures, the floors, the shelves that stay put, the doors in
// the walls) is drawn once per room, scale and CHUNK of its length into
// layers kept off screen, which every frame copies. The floating words and
// the banners are light text with a dark edge, which reads on any wall, and
// the pills are opaque dark with text that reads on them at 4.5:1 (pills.js).
// The strip the pills sit on, Planny's box and his star (in your highlight)
// follow the page.

import { drawPill, LIVES, livesText, PILL, pillInk } from "../../pills.js";
import { LOSE_SOUNDS as BONES_LOSE_SOUNDS, LOSE_WORDS as BONES_LOSE_WORDS, boneArt } from "../stages/wing/ghoul-bones-draw.js";
import { LOOKS as GRAVEYARD_LOOKS, graveyardArt } from "../stages/graveyard/ghoul-graveyard-draw.js";
import { LOOKS as GROUNDS_LOOKS, LOSE_SOUNDS as GROUNDS_LOSE_SOUNDS, LOSE_WORDS as GROUNDS_LOSE_WORDS, VOICES as GROUNDS_VOICES, groundsArt } from "../stages/grounds/ghoul-grounds-draw.js";
import { LOOKS as CHAPEL_LOOKS, LOSE_SOUNDS as CHAPEL_LOSE_SOUNDS, LOSE_WORDS as CHAPEL_LOSE_WORDS, VOICES as CHAPEL_VOICES, chapelArt } from "../stages/chapel/ghoul-chapel-draw.js";
import { LOOKS as SANATORIUM_LOOKS, LOSE_SOUNDS as SANATORIUM_LOSE_SOUNDS, LOSE_WORDS as SANATORIUM_LOSE_WORDS, VOICES as SANATORIUM_VOICES, sanatoriumArt } from "../stages/sanatorium/ghoul-sanatorium-draw.js";
import { LOOKS as VILLAGE_LOOKS, LOSE_SOUNDS as VILLAGE_LOSE_SOUNDS, LOSE_WORDS as VILLAGE_LOSE_WORDS, VOICES as VILLAGE_VOICES, villageArt } from "../stages/village/ghoul-village-draw.js";
import { LOOKS as MINE_LOOKS, LOSE_SOUNDS as MINE_LOSE_SOUNDS, LOSE_WORDS as MINE_LOSE_WORDS, VOICES as MINE_VOICES, mineArt } from "../stages/mine/ghoul-mine-draw.js";
import { LOOKS as CART_LOOKS, LOSE_SOUNDS as CART_LOSE_SOUNDS, LOSE_WORDS as CART_LOSE_WORDS, VOICES as CART_VOICES, cartArt } from "../rides/cart/ghoul-cart-draw.js";
import { LOOKS as WAGON_LOOKS, LOSE_SOUNDS as WAGON_LOSE_SOUNDS, LOSE_WORDS as WAGON_LOSE_WORDS, VOICES as WAGON_VOICES, wagonArt } from "../rides/wagon/ghoul-wagon-draw.js";
import { LOOKS as SLED_LOOKS, LOSE_SOUNDS as SLED_LOSE_SOUNDS, LOSE_WORDS as SLED_LOSE_WORDS, VOICES as SLED_VOICES, sledArt } from "../rides/sled/ghoul-sled-draw.js";
import { LOOKS as BANISTER_LOOKS, LOSE_SOUNDS as BANISTER_LOSE_SOUNDS, LOSE_WORDS as BANISTER_LOSE_WORDS, VOICES as BANISTER_VOICES, banisterArt } from "../rides/banister/ghoul-banister-draw.js";
import { LOOKS as HEARSE_LOOKS, LOSE_SOUNDS as HEARSE_LOSE_SOUNDS, LOSE_WORDS as HEARSE_LOSE_WORDS, VOICES as HEARSE_VOICES, hearseArt } from "../rides/hearse/ghoul-hearse-draw.js";
import { LOOKS as GURNEY_LOOKS, LOSE_SOUNDS as GURNEY_LOSE_SOUNDS, LOSE_WORDS as GURNEY_LOSE_WORDS, VOICES as GURNEY_VOICES, gurneyArt } from "../rides/gurney/ghoul-gurney-draw.js";
import { LOOKS as PEW_LOOKS, LOSE_SOUNDS as PEW_LOSE_SOUNDS, LOSE_WORDS as PEW_LOSE_WORDS, VOICES as PEW_VOICES, pewArt } from "../rides/pew/ghoul-pew-draw.js";
import { LOOKS as MOWER_LOOKS, LOSE_SOUNDS as MOWER_LOSE_SOUNDS, LOSE_WORDS as MOWER_LOSE_WORDS, VOICES as MOWER_VOICES, mowerArt } from "../rides/mower/ghoul-mower-draw.js";
import { LOOKS as TRAY_LOOKS, LOSE_SOUNDS as TRAY_LOSE_SOUNDS, LOSE_WORDS as TRAY_LOSE_WORDS, VOICES as TRAY_VOICES, trayArt } from "../rides/tray/ghoul-tray-draw.js";
import { LOOKS as CARNIVAL_LOOKS, LOSE_SOUNDS as CARNIVAL_LOSE_SOUNDS, LOSE_WORDS as CARNIVAL_LOSE_WORDS, VOICES as CARNIVAL_VOICES, carnivalArt } from "../stages/carnival/ghoul-carnival-draw.js";
import { LOOKS as FROZEN_LOOKS, LOSE_SOUNDS as FROZEN_LOSE_SOUNDS, LOSE_WORDS as FROZEN_LOSE_WORDS, VOICES as FROZEN_VOICES, frozenArt } from "../stages/frozen/ghoul-frozen-draw.js";
import { LOOKS as BOG_LOOKS, LOSE_SOUNDS as BOG_LOSE_SOUNDS, LOSE_WORDS as BOG_LOSE_WORDS, VOICES as BOG_VOICES, bogArt } from "../stages/bog/ghoul-bog-draw.js";
import { LOOKS as LANTERN_LOOKS, LOSE_SOUNDS as LANTERN_LOSE_SOUNDS, LOSE_WORDS as LANTERN_LOSE_WORDS, VOICES as LANTERN_VOICES, lanternArt } from "../rides/lantern/ghoul-lantern-draw.js";
import { diceArt } from "../core/ghoul-dice-draw.js";
import { gameOverBanner } from "../story/ghoul-gameover-draw.js";
import { introArt } from "../story/ghoul-intro-draw.js";
import { storyArt } from "../story/ghoul-story-draw.js";
import { bonusArt } from "../core/ghoul-bonus-draw.js";
import { LOOKS as RIDE_LOOKS, LOSE_SOUNDS as RIDE_LOSE_SOUNDS, LOSE_WORDS as RIDE_LOSE_WORDS, VOICES as RIDE_VOICES, react as rideReact } from "../rides/dark-ride/ghoul-ride-voices.js";
import { rideArt } from "../rides/dark-ride/ghoul-ride-draw.js";
import { armsArt } from "../arms/ghoul-arms-draw.js";
import { pickerArt } from "./ghoul-picker-draw.js";
import { bossIntroArt } from "../story/ghoul-bossintro-draw.js";
import { monsterArt } from "./ghoul-monsters-draw.js";

const FALLBACK_COLORS = Object.freeze({ board: "#ffffff", line: "#e4ddd1", you: "#206cc3", ink: "#1d1a17" });

// The page's tokens, read again at each round and each resize, so the board
// follows a theme or highlight change made while the game sat paused. A stub
// canvas in Node has no computed style, so every color falls back.
export function readColors(canvas) {
  let style = null;
  try {
    style = typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
  } catch {}
  const pick = (name, fallback) => (style && style.getPropertyValue(name).trim()) || fallback;
  return {
    board: pick("--panel", FALLBACK_COLORS.board),
    line: pick("--rule", FALLBACK_COLORS.line),
    you: pick("--accent", FALLBACK_COLORS.you),
    ink: pick("--ink", FALLBACK_COLORS.ink),
  };
}

export const GOLD = "#f5b301";
export const DANGER = "#e2553f";
// The banner's shade, used for nothing else (the unit suite finds a banner by it).
export const BANNER_SHADE = "rgba(0, 0, 0, 0.5)";
const SHADE = "rgba(0, 0, 0, 0.6)";
const SCORE_SHADE = "rgba(0, 0, 0, 0.45)";
const EDGE_DARK = "rgba(0, 0, 0, 0.75)";
const TAU = Math.PI * 2;
// What a hurt monster flashes, and what spills.
const FLASH = "#efe6d6";
const BLOOD = "#7a0a0a";
const BLOOD_DARK = "#3a0505";
const ACID = "#9acd32";
const BONE = "#cfc4a6";
// Eyes in the dark.
const EYE_RED = "#ff2a12";
const EYE_AMBER = "#ff7a00";
const EYE_PALE = "#bfe8ff";
const EYE_SICK = "#d8ff3a";
const SOUL = "#bfefff";

// A still layer covers this many units of a room's length, and SEAM more,
// so two layers side by side overlap and no hairline shows between them.
export const CHUNK = 48;
export const SEAM = 0.5;

// Each room's look: the wall's top and bottom, its old paper, the wainscot,
// the floor (boards on top, the side, the dark edge), the shelves, the pits,
// the moonlight in the windows, the decor drawn along the wall, the color
// the room's name shows in, and how dark it is (the dark layer's alpha).
export const LOOKS = Object.freeze({
  hall: Object.freeze({ wallTop: "#100c12", wallLow: "#241a22", paper: "#33252e", wainscot: "#18100e", floorTop: "#46302a", floor: "#281a14", floorEdge: "#0e0806", shelf: "#382416", shelfTop: "#583c26", pit: "#020103", window: "#8a94b0", decor: "portraits", color: "#b9a3c9", dark: 0.84 }),
  foyer: Object.freeze({ wallTop: "#120d14", wallLow: "#2a1d26", paper: "#3a2933", wainscot: "#1a1210", floorTop: "#4a3426", floor: "#2a1c14", floorEdge: "#0e0806", shelf: "#3a2618", shelfTop: "#5a3e28", pit: "#020103", window: "#8a9ab8", decor: "stairs", color: "#c7a6d9", dark: 0.86 }),
  gallery: Object.freeze({ wallTop: "#0e1018", wallLow: "#1e2334", paper: "#2c3346", wainscot: "#16100e", floorTop: "#46322a", floor: "#271a14", floorEdge: "#0c0806", shelf: "#3a2a1e", shelfTop: "#5a4430", pit: "#020204", window: "#9ab0d8", decor: "portraits", color: "#9ab0d8", dark: 0.87 }),
  library: Object.freeze({ wallTop: "#0d120c", wallLow: "#1d2619", paper: "#2a3624", wainscot: "#1a120a", floorTop: "#46361f", floor: "#271d10", floorEdge: "#0c0904", shelf: "#3a2412", shelfTop: "#5a3c20", pit: "#020302", window: "#a6c48e", decor: "books", color: "#a6c48e", dark: 0.88 }),
  ballroom: Object.freeze({ wallTop: "#160709", wallLow: "#331219", paper: "#451b25", wainscot: "#1e0e08", floorTop: "#5a3e24", floor: "#2e1e10", floorEdge: "#0e0805", shelf: "#4a2e18", shelfTop: "#6a4a28", pit: "#040102", window: "#e0a0b0", decor: "curtains", color: "#e07a8c", dark: 0.85 }),
  kitchen: Object.freeze({ wallTop: "#14130c", wallLow: "#2c2919", paper: "#3a3622", wainscot: "#221c12", floorTop: "#5e5a4c", floor: "#2c281c", floorEdge: "#0e0c08", shelf: "#3c2c1a", shelfTop: "#5c4630", pit: "#030302", window: "#d9c27a", decor: "pots", color: "#d9c27a", dark: 0.87 }),
  conservatory: Object.freeze({ wallTop: "#071211", wallLow: "#122822", paper: "#18362d", wainscot: "#1a1a14", floorTop: "#4a4c42", floor: "#262822", floorEdge: "#0a0c08", shelf: "#2c3424", shelfTop: "#46523a", pit: "#010404", window: "#9fe0c8", decor: "plants", color: "#7fd1b5", dark: 0.88 }),
  attic: Object.freeze({ wallTop: "#120d08", wallLow: "#281d13", paper: "#33271a", wainscot: "#1e160e", floorTop: "#4e3c28", floor: "#2c2016", floorEdge: "#0e0a06", shelf: "#3c2c1c", shelfTop: "#5a442c", pit: "#030201", window: "#d9a066", decor: "rafters", color: "#d9a066", dark: 0.9 }),
  ...GRAVEYARD_LOOKS,
  ...GROUNDS_LOOKS,
  ...CHAPEL_LOOKS,
  ...SANATORIUM_LOOKS,
  ...VILLAGE_LOOKS,
  ...MINE_LOOKS,
  ...CART_LOOKS,
  ...SLED_LOOKS,
  ...BANISTER_LOOKS,
  ...HEARSE_LOOKS,
  ...GURNEY_LOOKS,
  ...PEW_LOOKS,
  ...MOWER_LOOKS,
  ...TRAY_LOOKS,
  ...WAGON_LOOKS,
  ...CARNIVAL_LOOKS,
  ...FROZEN_LOOKS,
  ...RIDE_LOOKS,
  ...BOG_LOOKS,
  ...LANTERN_LOOKS,
  crypt: Object.freeze({ wallTop: "#0a0b0e", wallLow: "#1b1e25", paper: "#262a33", wainscot: "#14161b", floorTop: "#43474f", floor: "#22252b", floorEdge: "#0a0b0d", shelf: "#30343c", shelfTop: "#4a4f58", pit: "#010102", window: "#b4bfd1", decor: "tombs", color: "#b4bfd1", dark: 0.9 }),
});
export const lookOf = (id) => LOOKS[id] || LOOKS.foyer;

// The ink for what is drawn straight over the walls (Planny's arms and feet,
// a monster's edge): whichever of a dark and a light ink stands out more
// from both ends of the wall and the floor. The rooms keep their colors in
// either theme, so the page's ink would vanish on some.
export const DARK_INK = "#1d1a17";
export const LIGHT_INK = "#f0ece5";

// The relative luminance of "#rrggbb", and the contrast of two of them.
export function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((k) => {
    const c = parseInt(hex.slice(k, k + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const better = (...tones) => {
  const worst = (ink) => Math.min(...tones.map((t) => contrast(ink, t)));
  return worst(DARK_INK) >= worst(LIGHT_INK) ? DARK_INK : LIGHT_INK;
};
const LIMBS = Object.freeze(Object.fromEntries(Object.entries(LOOKS).map(([k, t]) => [k, better(t.wallTop, t.wallLow, t.paper)])));
export const limbInk = (look) => LIMBS[look] || LIGHT_INK;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

const ellipse = (ctx, x, y, rx, ry, rot = 0) => {
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
  else ctx.arc(x, y, Math.max(rx, ry), 0, TAU);
};

const circle = (ctx, x, y, r) => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
};

const line = (ctx, x0, y0, x1, y1) => {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
};

const rotate = (ctx, a) => {
  if (typeof ctx.rotate === "function") ctx.rotate(a);
};

const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

// Text with a dark edge, so it reads on any wall in either theme. `max`,
// when given, squeezes a long line to fit that many units; `serif` sets it
// in the banners' old-house serif.
export function label(ctx, text, x, y, size, color, align = "center", max = undefined, serif = false) {
  ctx.font = serif ? `700 ${size}px ${SERIF}` : `800 ${size}px ${SANS}`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.lineWidth = Math.max(0.3, size / 6);
  ctx.lineJoin = "round";
  ctx.strokeStyle = EDGE_DARK;
  if (max === undefined) {
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    return;
  }
  ctx.strokeText(text, x, y, max);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y, max);
}

// Where a centered label of `text` at `size` goes so it stays inside a
// field `w` by `h`: at (x, y) when it fits, else moved in from the edge. A
// line too long for the field is squeezed to it (`max`).
export function labelSpot(text, x, y, size, w, h) {
  const width = Math.min(w - 1, String(text).length * size * 0.62);
  return { x: Math.min(w - width / 2 - 0.5, Math.max(width / 2 + 0.5, x)), y: Math.min(h - size / 2 - 0.4, Math.max(size / 2 + 0.4, y)), max: width };
}

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

// A small whole-number hash, for the decor, so each piece keeps its place.
const hash = (a, b) => {
  let h = Math.imul(a + 0x9e37, 0x85ebca6b) ^ Math.imul(b + 0x7f4a, 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) % 997;
};

// A point (ex, ey) of a drawing at (x, y) turned by `a`, for an eye on a
// body drawn leaning.
const turned = (x, y, ex, ey, a) => [x + ex * Math.cos(a) - ey * Math.sin(a), y + ex * Math.sin(a) + ey * Math.cos(a)];

// An eye that burns in the dark: kept for the pass over the dark layer.
const eye = (v, x, y, r, color) => v.eyes.push(x, y, r, color);

// The generic monsters' drawing (ghoul-monsters-draw.js), handed the helpers
// they paint with.
const { drawZombie, drawZombieKin, drawHuntsman, drawCrawler, drawBat, drawGhost, drawSkeleton, drawHound, drawSpider, drawWraith, drawSpitter, drawGourdling, drawBoneShape, drawGlob } = monsterArt({ ellipse, circle, line, rotate, turned, eye, FLASH, BLOOD, BLOOD_DARK, ACID, BONE, EYE_RED, EYE_AMBER, EYE_PALE, EYE_SICK });

// The stage packs' drawing, handed this file's helpers: their outdoor
// backdrops (a look's `pack` names whose, the Graveyard's by default), graves,
// monsters, bosses, missiles, hazards, waves, power-up badges and lights by
// kind, and what their events look and sound like.
const HELP = { paintDark, hudLayout, drawPower, ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, label, drawBoneShape, BONE, DANGER, GOLD, FLASH, EYE_RED, EYE_PALE, EYE_AMBER };
const ARMS_ART = armsArt(HELP);
const PACK_ART = { arms: ARMS_ART, bones: boneArt(HELP), graveyard: graveyardArt(HELP), grounds: groundsArt(HELP), chapel: chapelArt(HELP), sanatorium: sanatoriumArt(HELP), village: villageArt(HELP), mine: mineArt(HELP), cart: cartArt(HELP), sled: sledArt(HELP), banister: banisterArt(HELP), hearse: hearseArt(HELP), codeblue: gurneyArt(HELP), pew: pewArt(HELP), lantern: lanternArt(HELP), mower: mowerArt(HELP), tray: trayArt(HELP), wagon: wagonArt(HELP), carnival: carnivalArt(HELP), frozen: frozenArt(HELP), bog: bogArt(HELP), ride: { backdrop() {}, lights() {}, react: rideReact } };
const packs = Object.values(PACK_ART);
const DICE = diceArt(HELP);
const OVER_BANNER = gameOverBanner(HELP);
const INTRO_CARD = introArt(HELP);
const STORY_CARD = storyArt({ ...HELP, LOOKS });
const BONUS = bonusArt(HELP, DICE.die);
// The Carnival's dark ride draws the whole field itself (ghoul-ride-draw.js).
const RIDE = rideArt(HELP, DICE.die);
// A bonus room's card clicks as each die lands (called each frame by ghoul.js).
export const bonusTick = (round, k) => (round.gallery ? RIDE.tick(round, k) : BONUS.tick(round, k));
const joined = (key) => Object.assign({}, ...packs.map((a) => a[key]));
const ART = {
  // A secondary weapon in flight and on the HUD (ghoul-arms-draw.js).
  armShot: ARMS_ART.shot,
  armPill: ARMS_ART.pill,
  grave: PACK_ART.graveyard.grave,
  openGrave: PACK_ART.graveyard.openGrave,
  backdrop: (ctx, v, look, x0, x1) => PACK_ART[look.pack || "graveyard"].backdrop(ctx, v, look, x0, x1),
  // A pack may also draw its floor pieces (over the plain ones) and its shelves.
  ground: (ctx, v, look, a, b, top) => PACK_ART[look.pack || "graveyard"].ground?.(ctx, v, look, a, b, top),
  shelf: (ctx, v, look, a, b, y) => {
    const art = PACK_ART[look.pack || "graveyard"];
    if (art.shelf) art.shelf(ctx, v, look, a, b, y);
    else drawShelf(ctx, look, a, b, y);
  },
  // A pack may draw the decor along an indoor room's wall, by the look's `decor`.
  decor: joined("decor"),
  monsters: joined("monsters"),
  bosses: joined("bosses"),
  missiles: joined("missiles"),
  hazards: joined("hazards"),
  waves: joined("waves"),
  powers: joined("powers"),
  lights: (v, add) => packs.forEach((a) => a.lights(v, add)),
  // A pack may draw over Planny (before the dark) and dim the whole room, a blackout: the alpha it wants the dark at, 0 for none.
  front: (ctx, v) => packs.forEach((a) => a.front?.(ctx, v)),
  dim: (v) => Math.max(0, ...packs.map((a) => a.dim?.(v) || 0)),
  // A pack may draw the sky behind the still layers and what moves in its scenery over them (the Village's moon, curtains and fires).
  sky: (ctx, v, cam) => packs.forEach((a) => a.sky?.(ctx, v, cam)),
  moving: (ctx, v, cam) => packs.forEach((a) => a.moving?.(ctx, v, cam)),
  react: (e, k) => packs.some((a) => a.react(e, k)),
};

/* ------------------------------------------------------------ the rooms */

// A tall arched window, the night and a sickly moon in it, one pane broken.
function drawWindow(ctx, look, x, top, w, h, n) {
  ctx.fillStyle = look.wainscot;
  roundRect(ctx, x - 0.6, top - 0.6, w + 1.2, h + 1.2, w / 2);
  ctx.fill();
  ctx.fillStyle = "#05070d";
  roundRect(ctx, x, top, w, h, w / 2);
  ctx.fill();
  ctx.fillStyle = look.window;
  ctx.globalAlpha = 0.55;
  circle(ctx, x + w * (0.3 + (n % 3) * 0.2), top + h * 0.3, w * 0.16);
  ctx.fill();
  // A cloud across the moon.
  ctx.fillStyle = "#05070d";
  ctx.globalAlpha = 0.7;
  ellipse(ctx, x + w * (0.25 + (n % 3) * 0.2), top + h * 0.34, w * 0.22, w * 0.07);
  ctx.fill();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = look.window;
  ctx.fillRect(x, top + h * 0.55, w, h * 0.45);
  ctx.globalAlpha = 1;
  // A broken pane: a jagged hole with the night behind it.
  if (n % 2 === 0) {
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.moveTo(x + w * 0.55, top + h * 0.6);
    ctx.lineTo(x + w * 0.95, top + h * 0.58);
    ctx.lineTo(x + w * 0.8, top + h * 0.7);
    ctx.lineTo(x + w * 0.95, top + h * 0.82);
    ctx.lineTo(x + w * 0.62, top + h * 0.74);
    ctx.closePath();
    ctx.fill();
  }
  ctx.strokeStyle = look.wainscot;
  ctx.lineWidth = 0.4;
  line(ctx, x + w / 2, top + 0.6, x + w / 2, top + h);
  line(ctx, x, top + h * 0.55, x + w, top + h * 0.55);
}

// A smear of old blood on the wall, a handprint at its head, dripping.
function drawSmear(ctx, x, y, h) {
  ctx.fillStyle = BLOOD_DARK;
  ctx.globalAlpha = 0.75;
  ellipse(ctx, x, y, 0.9, 1.1);
  ctx.fill();
  for (let k = 0; k < 4; k++) {
    const a = -1.1 + k * 0.45;
    ctx.fillRect(x + Math.cos(a - Math.PI / 2) * 1.2 - 0.18, y - 1 - (k === 0 ? -0.6 : 0.4 * Math.sin(k)), 0.36, 1.2);
  }
  ctx.strokeStyle = BLOOD_DARK;
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x, y + 0.6);
  ctx.quadraticCurveTo(x + (h % 3) - 1, y + 3, x + (h % 5) - 2, y + 5 + (h % 4));
  ctx.stroke();
  ctx.lineWidth = 0.18;
  for (const k of [-0.4, 0.3]) line(ctx, x + k, y + 0.8, x + k, y + 2.5 + (h % 6) * 0.6);
  ctx.globalAlpha = 1;
}

// One piece of a room's decor at `x` on the wall, by the room's kind.
function drawDecor(ctx, look, kind, x, floorY, n) {
  if (ART.decor[kind]) return ART.decor[kind](ctx, look, x, floorY, n);
  const h = hash(n, 11);
  if (kind === "portraits" || (kind === "stairs" && h % 2)) {
    // A portrait in a tarnished frame: a long pale face with empty eyes.
    // Some have been slashed.
    const top = floorY - 26 - (h % 4);
    ctx.fillStyle = "#4a3a1a";
    ctx.fillRect(x - 3.6, top - 0.6, 7.2, 9.2);
    ctx.fillStyle = ["#141a14", "#1a1018", "#10141e"][h % 3];
    ctx.fillRect(x - 3, top, 6, 8);
    ctx.fillStyle = "#7a7468";
    ellipse(ctx, x, top + 3.6, 1.4, 2.3);
    ctx.fill();
    ctx.fillStyle = "#000000";
    ellipse(ctx, x - 0.55, top + 3.1, 0.32, 0.5);
    ctx.fill();
    ellipse(ctx, x + 0.55, top + 3.1, 0.32, 0.5);
    ctx.fill();
    ellipse(ctx, x, top + 4.9, 0.3, 0.5);
    ctx.fill();
    ctx.fillStyle = "#1a1210";
    ctx.fillRect(x - 2.6, top + 6, 5.2, 2);
    if (h % 3 === 0) {
      ctx.strokeStyle = look.wallLow;
      ctx.lineWidth = 0.35;
      line(ctx, x - 2.6, top + 0.6, x + 1.6, top + 7.4);
      line(ctx, x - 1.4, top + 0.4, x + 2.6, top + 6.6);
    }
  } else if (kind === "books") {
    // A bookcase against the wall, its books gone dark, a web in its corner.
    const top = floorY - 22;
    ctx.fillStyle = "#1e120a";
    ctx.fillRect(x - 6, top, 12, 22);
    for (let row = 0; row < 4; row++) {
      const y = top + 1 + row * 5.2;
      for (let bx = x - 5.4, k = 0; bx < x + 5.2; k++) {
        const bw = 0.7 + (hash(n * 13 + row, k) % 4) * 0.2;
        if (hash(n + k, row * 7) % 6) {
          ctx.fillStyle = ["#3a1414", "#14202e", "#1e2a16", "#3a2e12", "#24141e"][hash(n + k, row) % 5];
          ctx.fillRect(bx, y + (hash(k, n) % 2) * 0.6, bw, 4.2);
        }
        bx += bw + 0.1;
      }
      ctx.fillStyle = "#0e0804";
      ctx.fillRect(x - 6, y + 4.3, 12, 0.6);
    }
    ctx.strokeStyle = "rgba(200, 200, 210, 0.3)";
    ctx.lineWidth = 0.12;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(x - 6, top, k * 1.2, 0, Math.PI / 2);
      ctx.stroke();
    }
    line(ctx, x - 6, top, x - 2.2, top + 3.4);
  } else if (kind === "curtains") {
    // Rotten velvet, torn at the hem.
    const top = 4;
    ctx.fillStyle = "#2e0810";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + s * 1, top);
      ctx.quadraticCurveTo(x + s * 5, floorY - 18, x + s * 3, floorY - 4);
      for (let k = 0; k <= 4; k++) ctx.lineTo(x + s * (3 + k * 0.75), floorY - 4 + (k % 2 ? 2.6 : 0.4));
      ctx.lineTo(x + s * 6, top);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#4a3a1a";
    ctx.fillRect(x - 6.5, top - 0.6, 13, 1);
  } else if (kind === "pots") {
    // A rail of meat hooks, something still hanging on one, and a cleaver.
    const top = floorY - 22;
    ctx.fillStyle = "#3a3630";
    ctx.fillRect(x - 6, top, 12, 0.5);
    ctx.strokeStyle = "#6a6a6a";
    ctx.lineWidth = 0.25;
    for (const k of [-4, 0, 4]) {
      line(ctx, x + k, top + 0.5, x + k, top + 2.4);
      ctx.beginPath();
      ctx.arc(x + k + 0.4, top + 2.4, 0.4, Math.PI, Math.PI * 0.2, true);
      ctx.stroke();
    }
    ctx.fillStyle = "#4a1010";
    ellipse(ctx, x + (h % 2 ? -3.6 : 4.4), top + 5.4, 1.1, 2.6);
    ctx.fill();
    ctx.fillStyle = BLOOD_DARK;
    ctx.fillRect(x + (h % 2 ? -3.8 : 4.2), top + 8, 0.25, 1.4 + (h % 3));
    ctx.fillStyle = "#8a8f96";
    ctx.fillRect(x - 1.6, top + 6, 2.4, 1.6);
    ctx.fillStyle = "#2a1a10";
    ctx.fillRect(x + 0.8, top + 6.5, 1.6, 0.5);
  } else if (kind === "plants") {
    // A dead thing in a cracked pot, all thorns.
    ctx.fillStyle = "#3a2216";
    ctx.beginPath();
    ctx.moveTo(x - 2.4, floorY - 4);
    ctx.lineTo(x + 2.4, floorY - 4);
    ctx.lineTo(x + 1.8, floorY);
    ctx.lineTo(x - 1.8, floorY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#0e0806";
    ctx.lineWidth = 0.15;
    line(ctx, x + 0.4, floorY - 4, x - 0.2, floorY - 1.6);
    ctx.strokeStyle = "#2e2a18";
    ctx.lineWidth = 0.4;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.moveTo(x, floorY - 4);
      ctx.quadraticCurveTo(x + k * 1.6, floorY - 12, x + k * 2.6, floorY - 9 - Math.abs(k) * 1.6);
      ctx.stroke();
      line(ctx, x + k * 1.3, floorY - 9, x + k * 1.3 + 0.6, floorY - 9.6);
    }
  } else if (kind === "rafters") {
    ctx.strokeStyle = "#0e0a06";
    ctx.lineWidth = 1.4;
    line(ctx, x - 10, 3, x + 10, 14);
    line(ctx, x + 10, 3, x - 10, 14);
    // Webs thick in the corners of the beams, and a chain hanging down.
    ctx.strokeStyle = "rgba(210, 210, 220, 0.3)";
    ctx.lineWidth = 0.14;
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      ctx.arc(x, 8.5, k * 1.4, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }
    for (let k = 0; k < 5; k++) line(ctx, x, 8.5, x + Math.cos(0.3 + k * 0.6) * 6, 8.5 + Math.sin(0.3 + k * 0.6) * 6);
    ctx.strokeStyle = "#3a3a3a";
    ctx.lineWidth = 0.2;
    const len = 8 + (h % 10);
    for (let y = 14; y < 14 + len; y += 0.9) {
      ellipse(ctx, x + 4, y, 0.25, 0.45);
      ctx.stroke();
    }
  } else if (kind === "tombs") {
    // A cracked headstone, and a skull at its foot.
    ctx.fillStyle = "#2c3038";
    roundRect(ctx, x - 2.6, floorY - 7, 5.2, 7, [2.6, 2.6, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#0a0b0d";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(x - 0.6, floorY - 7);
    ctx.lineTo(x + 0.3, floorY - 5);
    ctx.lineTo(x - 0.4, floorY - 3.2);
    ctx.lineTo(x + 0.6, floorY - 1.4);
    ctx.stroke();
    if (h % 2) {
      ctx.fillStyle = "#8a8270";
      circle(ctx, x + 3.4, floorY - 0.8, 0.8);
      ctx.fill();
      ctx.fillStyle = "#000000";
      circle(ctx, x + 3.1, floorY - 0.9, 0.2);
      ctx.fill();
      circle(ctx, x + 3.7, floorY - 0.9, 0.2);
      ctx.fill();
    }
  } else {
    // A candle sconce, the candle burned low.
    ctx.fillStyle = "#3a2e16";
    ctx.fillRect(x - 0.3, floorY - 24, 0.6, 3);
    ctx.fillStyle = "#b8ae94";
    ctx.fillRect(x - 0.45, floorY - 25.4, 0.9, 1.4);
    ctx.fillStyle = "#ffb84a";
    ellipse(ctx, x, floorY - 26.1, 0.35, 0.7);
    ctx.fill();
  }
}

// A plain door in the wall (where zombies come out), shut, clawed from inside.
function drawWallDoor(ctx, x, floorY) {
  ctx.fillStyle = "#0e0806";
  roundRect(ctx, x - 3.4, floorY - 10.4, 6.8, 10.4, [3.4, 3.4, 0, 0]);
  ctx.fill();
  ctx.fillStyle = "#2a1a10";
  roundRect(ctx, x - 2.8, floorY - 9.8, 5.6, 9.8, [2.8, 2.8, 0, 0]);
  ctx.fill();
  ctx.strokeStyle = "#0e0806";
  ctx.lineWidth = 0.25;
  line(ctx, x, floorY - 9.6, x, floorY);
  ctx.strokeStyle = "#5a4636";
  ctx.lineWidth = 0.1;
  for (const k of [-1.8, -1.3, -0.8]) line(ctx, x + k, floorY - 7, x + k + 0.6, floorY - 4.2);
  ctx.fillStyle = "#4a3a1a";
  circle(ctx, x + 1.6, floorY - 4.6, 0.3);
  ctx.fill();
}

// A shelf (bookcase top, counter, rafter): a board on two brackets.
function drawShelf(ctx, look, x0, x1, y, cracked = false) {
  ctx.fillStyle = look.shelf;
  ctx.fillRect(x0, y, x1 - x0, 1.2);
  ctx.fillStyle = look.shelfTop;
  ctx.fillRect(x0, y, x1 - x0, 0.35);
  ctx.fillStyle = look.floorEdge;
  ctx.fillRect(x0, y + 1.0, x1 - x0, 0.2);
  if (!cracked) {
    ctx.strokeStyle = look.floorEdge;
    ctx.lineWidth = 0.3;
    for (const bx of [x0 + 1.5, x1 - 1.5]) line(ctx, bx, y + 1.2, bx + (bx < (x0 + x1) / 2 ? 1.2 : -1.2), y + 3);
    return;
  }
  ctx.strokeStyle = look.floorEdge;
  ctx.lineWidth = 0.18;
  for (const t of [0.3, 0.7]) {
    const cx = x0 + (x1 - x0) * t;
    ctx.beginPath();
    ctx.moveTo(cx - 0.4, y);
    ctx.lineTo(cx + 0.2, y + 0.6);
    ctx.lineTo(cx - 0.1, y + 1.2);
    ctx.stroke();
  }
}

// Where the windows sit along a room, every WINDOW_EVERY units: the still
// layers draw them and the dark lets their moonlight through.
const WINDOW_EVERY = 64;
const windowAt = (look, x) => (look.decor !== "rafters" && look.decor !== "tombs" ? { x: x - 4, top: 7, w: 8, h: 16 } : { x: x - 3, top: 9, w: 6, h: 6 });

// What never moves in a room: the wall, its rotting paper, stains, cracks
// and blood, the windows, the decor, the floor pieces and the pits between,
// the shelves that stay put, the doors in the wall and the loose boards
// crawlers come up through. Drawn from `x0` to `x1` of the room (in room
// units, already translated).
function drawStill(ctx, v, x0, x1) {
  const { spec, g } = v;
  const look = lookOf(spec.id);
  const Y = (y) => g.FIELD_H - y;
  // `custom`: an indoor look a stage pack draws whole (walls, floor, shelves).
  if (look.outdoor || look.custom) ART.backdrop(ctx, v, look, x0, x1);
  else drawWalls(ctx, v, look, x0, x1);
  // Pits: a black drop between the pieces, a few embers far down.
  for (let i = 0; i + 1 < spec.ground.length; i++) {
    const a = spec.ground[i][1];
    const b = spec.ground[i + 1][0];
    if (b <= a || b < x0 - 1 || a > x1 + 1) continue;
    ctx.fillStyle = look.pit;
    ctx.fillRect(a, Y(Math.min(spec.ground[i][2], spec.ground[i + 1][2])) - 5, b - a, g.FIELD_H);
    ctx.fillStyle = "rgba(170, 30, 10, 0.5)";
    for (let k = 0; k < 4; k++) ctx.fillRect(a + ((hash(i, k) % 100) / 100) * (b - a), g.FIELD_H - 0.6 - (hash(k, i) % 3) * 0.4, 0.2, 0.2);
  }
  for (const [a, b, top] of spec.ground) {
    if (b < x0 - 1 || a > x1 + 1) continue;
    ctx.fillStyle = look.floor;
    ctx.fillRect(a, Y(top), b - a, top);
    ctx.fillStyle = look.floorTop;
    ctx.fillRect(a, Y(top), b - a, 1.1);
    ctx.fillStyle = look.floorEdge;
    ctx.fillRect(a, Y(top) + 1.1, b - a, 0.25);
    for (let x = Math.ceil(a / 4) * 4; x < b; x += 4) ctx.fillRect(x, Y(top), 0.15, 1.1);
    if (look.outdoor || look.custom) ART.ground(ctx, v, look, a, b, top);
    if (spec.id === "kitchen") {
      ctx.fillStyle = "#1a1810";
      for (let x = Math.ceil(a / 2) * 2; x < b; x += 4) ctx.fillRect(x, Y(top), 2, 0.55);
    }
    // Old stains soaked into the boards.
    ctx.fillStyle = BLOOD_DARK;
    ctx.globalAlpha = 0.6;
    for (let x = Math.ceil(a / 22) * 22; x < b - 3; x += 22) {
      const h = hash(Math.round(x / 22), 57);
      if (h % 3) continue;
      ellipse(ctx, x + (h % 5), Y(top) + 0.3, 1.4 + (h % 3) * 0.5, 0.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The edge of a piece standing over a lower one.
    ctx.fillStyle = look.floorEdge;
    ctx.fillRect(a, Y(top), 0.25, top);
    ctx.fillRect(b - 0.25, Y(top), 0.25, top);
  }
  spec.shelves.forEach(([a, b, y, kind]) => {
    if (kind === "crumble" || b < x0 - 2 || a > x1 + 2) return;
    if (look.outdoor || look.custom) ART.shelf(ctx, v, look, a, b, Y(y));
    else drawShelf(ctx, look, a, b, Y(y));
  });
  for (const s of spec.spawns) {
    if (s[1] < x0 - 8 || s[1] > x1 + 8) continue;
    const fy = Y(v.groundAt(spec, s[1]));
    if (s[0] === "door") {
      if (look.outdoor) ART.grave(ctx, s[1], fy);
      else drawWallDoor(ctx, s[1], fy);
    }
    else if (s[0] === "crawl") {
      // A loose board, nails half out.
      ctx.fillStyle = look.floorEdge;
      ctx.fillRect(s[1] - 1.8, fy + 0.2, 3.6, 0.5);
      ctx.fillStyle = "#6a6458";
      ctx.fillRect(s[1] - 1.5, fy - 0.3, 0.25, 0.4);
      ctx.fillRect(s[1] + 1.3, fy - 0.3, 0.25, 0.4);
    }
  }
}

// A room's walls from x0 to x1: the paper, its stains and cracks, the
// windows, blood, the wainscot and the room's decor along it.
function drawWalls(ctx, v, look, x0, x1) {
  const { spec, g } = v;
  const Y = (y) => g.FIELD_H - y;
  const wall = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, g.FIELD_H) : null;
  if (wall && typeof wall.addColorStop === "function") {
    wall.addColorStop(0, look.wallTop);
    wall.addColorStop(1, look.wallLow);
    ctx.fillStyle = wall;
  } else ctx.fillStyle = look.wallLow;
  ctx.fillRect(x0, 0, x1 - x0, g.FIELD_H);
  // Old striped paper, a strip peeled away here and there.
  ctx.fillStyle = look.paper;
  for (let x = Math.floor(x0 / 4) * 4; x < x1 + 4; x += 4) {
    const n = Math.round(x / 4);
    ctx.globalAlpha = 0.3 + (hash(n, 5) % 3) * 0.08;
    const torn = hash(n, 9) % 7 === 0 ? 8 + (hash(n, 2) % 16) : 0;
    ctx.fillRect(x, 0, 1.6, g.FIELD_H - 8 - torn);
  }
  ctx.globalAlpha = 1;
  // Water stains run down from the ceiling.
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  for (let x = Math.floor(x0 / 18) * 18; x < x1 + 18; x += 18) {
    const h = hash(Math.round(x / 18), 21);
    if (h % 3) continue;
    const sx = x + (h % 9);
    const len = 8 + (h % 18);
    ctx.beginPath();
    ctx.moveTo(sx - 2.5, 0);
    ctx.quadraticCurveTo(sx - 1.4, len * 0.6, sx - 0.4, len);
    ctx.lineTo(sx + 0.6, len * 0.9);
    ctx.quadraticCurveTo(sx + 2, len * 0.5, sx + 3, 0);
    ctx.closePath();
    ctx.fill();
  }
  // Cracks.
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  ctx.lineWidth = 0.18;
  for (let x = Math.floor(x0 / 26) * 26; x < x1 + 26; x += 26) {
    const h = hash(Math.round(x / 26), 41);
    if (h % 2) continue;
    let cx = x + (h % 11);
    let cy = 2 + (h % 12);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let k = 0; k < 5; k++) {
      cx += ((hash(h, k) % 5) - 2) * 0.6;
      cy += 1.2 + (hash(k, h) % 3) * 0.5;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }
  // Windows, then the room's decor, every so often along the wall.
  const floorAt = (x) => {
    const gy = v.groundAt(spec, x);
    return Y(gy > -Infinity ? gy : 6);
  };
  for (let x = Math.floor(x0 / WINDOW_EVERY) * WINDOW_EVERY + 20; x < x1 + 16; x += WINDOW_EVERY) {
    const w = windowAt(look, x);
    drawWindow(ctx, look, w.x, w.top, w.w, w.h, Math.round(x / WINDOW_EVERY));
  }
  // Blood on the walls.
  for (let x = Math.floor(x0 / 40) * 40; x < x1 + 40; x += 40) {
    const h = hash(Math.round(x / 40), 33);
    if (h % 4) continue;
    drawSmear(ctx, x + (h % 12), 20 + (h % 12), h);
  }
  // The wainscot along each floor piece, the decor standing in front of it,
  // then the floor itself.
  for (const [a, b, top] of spec.ground) {
    if (b < x0 - 1 || a > x1 + 1) continue;
    ctx.fillStyle = look.wainscot;
    ctx.fillRect(a, Y(top) - 5, b - a, 5);
    ctx.fillStyle = look.floorEdge;
    ctx.fillRect(a, Y(top) - 5.3, b - a, 0.3);
  }
  for (let x = Math.floor(x0 / 32) * 32 + 4; x < x1 + 16; x += 32) {
    const n = Math.round(x / 32);
    if (hash(n, 3) % 3 === 0 && look.decor !== "rafters") continue;
    if (v.groundAt(spec, x) === -Infinity && look.decor !== "rafters") continue;
    drawDecor(ctx, look, look.decor, x, floorAt(x), n);
  }
}

// The still layers, CHUNK units of the room each, drawn off screen once per
// room and scale and copied each frame; a few are kept. Null where no
// second canvas can be made (as in Node): the frame then draws the room
// itself.
const layers = new Map();
const KEEP_LAYERS = 6;

// A canvas off screen `w` by `h` pixels, or null where none can be made.
function offscreen(w, h) {
  if (typeof OffscreenCanvas === "function") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined") return Object.assign(document.createElement("canvas"), { width: w, height: h });
  return null;
}

function stillLayer(ctx, v, k) {
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!m || !(m.a > 0)) return null;
  const a = m.a;
  const key = `${v.spec.id}:${k}:${a}`;
  if (layers.has(key)) {
    const layer = layers.get(key);
    layers.delete(key);
    layers.set(key, layer);
    return layer;
  }
  try {
    const layer = offscreen(Math.ceil((CHUNK + SEAM) * a), Math.ceil(v.g.FIELD_H * a));
    const off = layer && layer.getContext("2d");
    if (!off) return null;
    off.setTransform(a, 0, 0, a, -k * CHUNK * a, 0);
    drawStill(off, v, k * CHUNK, (k + 1) * CHUNK + SEAM);
    layers.set(key, layer);
    while (layers.size > KEEP_LAYERS) layers.delete(layers.keys().next().value);
    return layer;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- what moves */

// The exit door: shut with a rusted padlock until the key is held, then
// open on a cold light.
function drawExit(ctx, v) {
  const { spec, round, g } = v;
  const x = spec.door;
  const fy = g.FIELD_H - v.groundAt(spec, x);
  const open = round.hasKey;
  ctx.fillStyle = "#0e0806";
  roundRect(ctx, x - 4.4, fy - 13, 8.8, 13, [4.4, 4.4, 0, 0]);
  ctx.fill();
  if (open) {
    ctx.fillStyle = "#d9e4ff";
    ctx.globalAlpha = 0.45 + 0.2 * Math.sin(v.clock / 180);
    roundRect(ctx, x - 3.6, fy - 12.2, 7.2, 12.2, [3.6, 3.6, 0, 0]);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath();
    ctx.moveTo(x - 3.6, fy);
    ctx.lineTo(x - 3.6, fy - 12);
    ctx.lineTo(x - 6, fy - 11);
    ctx.lineTo(x - 6, fy - 0.6);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = "#2a1a10";
    roundRect(ctx, x - 3.6, fy - 12.2, 7.2, 12.2, [3.6, 3.6, 0, 0]);
    ctx.fill();
    ctx.strokeStyle = "#0e0806";
    ctx.lineWidth = 0.3;
    line(ctx, x, fy - 12, x, fy);
    // The padlock, rusted.
    ctx.strokeStyle = "#5a5048";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.arc(x, fy - 6.4, 0.9, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = "#6a4a20";
    roundRect(ctx, x - 1.2, fy - 6.4, 2.4, 2, 0.4);
    ctx.fill();
  }
  // Over it, scratched into the wood: OUT, red until it opens.
  label(ctx, "OUT", x, fy - 14.6, 1.6, open ? "#d9e4ff" : "#8a1a1a", "center", undefined, true);
}

// The crumbling boards (shaking, dropping, coming back), the chandeliers,
// and a wall door standing open while it lets zombies out.
function drawMoving(ctx, v) {
  const { spec, round, g } = v;
  const look = lookOf(spec.id);
  const Y = (y) => g.FIELD_H - y;
  spec.shelves.forEach(([a, b, y, kind], i) => {
    if (kind !== "crumble") return;
    let dy = 0;
    let dx = 0;
    let alpha = 1;
    const down = round.down[i];
    if (down > 0) {
      const gone = g.CRUMBLE_BACK_MS - down;
      if (gone < 500) {
        dy = (gone / 500) ** 2 * 10;
        alpha = 1 - gone / 500;
      } else if (down < 400) alpha = 1 - down / 400;
      else return;
    } else if (round.shake[i] > 0) dx = Math.sin(v.clock / 25) * 0.25;
    ctx.globalAlpha = alpha;
    drawShelf(ctx, look, a + dx, b + dx, Y(y) + dy, true);
    ctx.globalAlpha = 1;
  });
  spec.spawns.forEach((s, i) => {
    const st = round.spawns[i];
    if (s[0] !== "door" || !st || !st.on || st.over) return;
    const fy = Y(v.groundAt(spec, s[1]));
    if (look.outdoor) return ART.openGrave(ctx, v, s[1], fy);
    ctx.fillStyle = "#000000";
    roundRect(ctx, s[1] - 2.8, fy - 9.8, 5.6, 9.8, [2.8, 2.8, 0, 0]);
    ctx.fill();
    // Something in there, watching.
    const blink = Math.floor((v.clock + s[1] * 97) / 1700) % 5 === 0;
    if (!blink) {
      eye(v, s[1] - 0.7, fy - 6.4, 0.2, EYE_RED);
      eye(v, s[1] + 0.7, fy - 6.4, 0.2, EYE_RED);
    }
  });
  for (const c of round.falls) {
    const sway = c.state === "shake" ? Math.sin(v.clock / 30) * 0.5 : 0;
    const x = c.x + sway;
    const y = Y(c.y);
    if (c.state === "hang" || c.state === "shake") {
      ctx.strokeStyle = "#1e1a16";
      ctx.lineWidth = 0.25;
      line(ctx, c.x, 0, x, y - 1.6);
    }
    if (c.state === "down") {
      // Broken on the floor.
      ctx.fillStyle = "#2a2420";
      ctx.fillRect(x - 3.6, y + 1.2, 7.2, 0.8);
      ctx.fillStyle = "#8a8070";
      for (const k of [-2.6, -0.4, 2]) ctx.fillRect(x + k, y + 0.6, 0.6, 0.6);
      continue;
    }
    ctx.fillStyle = "#2a2420";
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y);
    ctx.quadraticCurveTo(x, y + 2.4, x + 3.5, y);
    ctx.lineTo(x + 3, y - 0.4);
    ctx.quadraticCurveTo(x, y + 1.4, x - 3, y - 0.4);
    ctx.closePath();
    ctx.fill();
    for (const k of [-3, -1, 1, 3]) {
      ctx.fillStyle = "#b8ae94";
      ctx.fillRect(x + k - 0.25, y - 1.4, 0.5, 1.2);
      ctx.fillStyle = "#ffb84a";
      ellipse(ctx, x + k, y - 1.8 - Math.abs(Math.sin(v.clock / 70 + k)) * 0.15, 0.25, 0.5);
      ctx.fill();
    }
  }
}

/* ------------------------------------------------------------ pickups */

// A soul: a pale flame, flickering.
function drawSoul(ctx, x, y, n, clock) {
  const f = Math.sin(clock / 80 + n * 1.7) * 0.18;
  ctx.fillStyle = "rgba(150, 220, 255, 0.3)";
  ellipse(ctx, x, y, 1, 1.3);
  ctx.fill();
  ctx.fillStyle = SOUL;
  ctx.beginPath();
  ctx.moveTo(x + f, y - 1.4);
  ctx.quadraticCurveTo(x + 0.75, y - 0.1, x, y + 0.65);
  ctx.quadraticCurveTo(x - 0.75, y - 0.1, x + f, y - 1.4);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ellipse(ctx, x, y + 0.15, 0.22, 0.32);
  ctx.fill();
}

// A power-up's badge: a ring in its color with its sign inside.
function drawPower(ctx, v, kind, x, y) {
  if (kind === "die") return DICE.drop(ctx, x, y, v.clock);
  const spec = v.powers[kind];
  ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  circle(ctx, x, y, 1.7);
  ctx.fill();
  circle(ctx, x, y, 1.4);
  ctx.fillStyle = spec.color;
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = 0.2;
  ctx.stroke();
  ctx.strokeStyle = DARK_INK;
  ctx.fillStyle = DARK_INK;
  ctx.lineWidth = 0.28;
  if (kind === "spread") {
    for (const a of [-0.45, 0, 0.45]) line(ctx, x - 0.7, y, x - 0.7 + Math.cos(a) * 1.4, y + Math.sin(a) * 1.4);
  } else if (kind === "rapid") {
    for (const dx of [-0.5, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - 0.3, y - 0.6);
      ctx.lineTo(x + dx + 0.3, y);
      ctx.lineTo(x + dx - 0.3, y + 0.6);
      ctx.stroke();
    }
  } else if (kind === "garlic") {
    ctx.fillStyle = "#fffbe8";
    ellipse(ctx, x, y + 0.2, 0.8, 0.7);
    ctx.fill();
    ctx.stroke();
    line(ctx, x, y - 0.5, x, y - 0.9);
  } else if (kind === "lantern") {
    // A lantern: a handle, a lit glass and a cap.
    line(ctx, x - 0.4, y - 0.7, x, y - 1.05);
    line(ctx, x, y - 1.05, x + 0.4, y - 0.7);
    ctx.fillRect(x - 0.5, y - 0.75, 1, 0.22);
    ctx.fillStyle = "#fff4c2";
    ctx.fillRect(x - 0.38, y - 0.53, 0.76, 0.95);
    ctx.strokeRect(x - 0.38, y - 0.53, 0.76, 0.95);
    ctx.fillStyle = DARK_INK;
    ctx.fillRect(x - 0.5, y + 0.42, 1, 0.22);
  } else if (kind === "wings") {
    // A bat's wings, spread.
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y - 0.2);
      ctx.lineTo(x + s * 1.05, y - 0.55);
      ctx.lineTo(x + s * 0.9, y + 0.2);
      ctx.lineTo(x + s * 0.6, y);
      ctx.lineTo(x + s * 0.35, y + 0.35);
      ctx.closePath();
      ctx.fill();
    }
  } else if (kind === "bell") {
    // A bell, its clapper showing.
    ctx.beginPath();
    ctx.moveTo(x - 0.85, y + 0.5);
    ctx.quadraticCurveTo(x - 0.6, y - 0.95, x, y - 0.95);
    ctx.quadraticCurveTo(x + 0.6, y - 0.95, x + 0.85, y + 0.5);
    ctx.closePath();
    ctx.fill();
    circle(ctx, x, y + 0.72, 0.22);
    ctx.fill();
  } else if (kind === "hourglass") {
    // An hourglass.
    ctx.fillRect(x - 0.65, y - 0.85, 1.3, 0.2);
    ctx.fillRect(x - 0.65, y + 0.65, 1.3, 0.2);
    ctx.beginPath();
    ctx.moveTo(x - 0.5, y - 0.65);
    ctx.lineTo(x + 0.5, y - 0.65);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 0.5, y + 0.65);
    ctx.lineTo(x - 0.5, y + 0.65);
    ctx.lineTo(x, y);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = "#fff4c2";
    ctx.beginPath();
    ctx.moveTo(x - 0.3, y + 0.62);
    ctx.lineTo(x + 0.3, y + 0.62);
    ctx.lineTo(x, y + 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (ART.powers[kind]) {
    ART.powers[kind](ctx, x, y);
  } else if (kind === "silver") {
    // A silver bolt going clean through a ring.
    ctx.lineWidth = 0.2;
    circle(ctx, x + 0.1, y, 0.55);
    ctx.stroke();
    ctx.lineWidth = 0.32;
    line(ctx, x - 1, y + 0.45, x + 0.9, y - 0.4);
    ctx.beginPath();
    ctx.moveTo(x + 1.15, y - 0.52);
    ctx.lineTo(x + 0.55, y - 0.6);
    ctx.lineTo(x + 0.85, y - 0.05);
    ctx.closePath();
    ctx.fill();
  } else {
    // A heart.
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(x, y + 0.7);
    ctx.bezierCurveTo(x - 1.1, y - 0.1, x - 0.6, y - 0.9, x, y - 0.35);
    ctx.bezierCurveTo(x + 0.6, y - 0.9, x + 1.1, y - 0.1, x, y + 0.7);
    ctx.fill();
  }
}

// The key: old gold, turning slowly, with a glint now and then.
function drawKey(ctx, x, y, clock) {
  ctx.save();
  ctx.translate(x, y);
  rotate(ctx, Math.sin(clock / 400) * 0.2);
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = 0.2;
  circle(ctx, -0.9, 0, 0.9);
  ctx.fillStyle = "#c8921a";
  ctx.fill();
  ctx.stroke();
  circle(ctx, -0.9, 0, 0.35);
  ctx.fillStyle = "#2a1a06";
  ctx.fill();
  ctx.fillStyle = "#c8921a";
  ctx.fillRect(-0.1, -0.25, 2, 0.5);
  ctx.fillRect(1.3, 0.2, 0.35, 0.6);
  ctx.fillRect(1.75, 0.2, 0.3, 0.45);
  ctx.restore();
  const p = (clock / 900) % 1;
  if (p < 0.3) {
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 1 - p / 0.3;
    star(ctx, x + 1.4, y - 1.2, 0.6, 0.2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// A crystal: a cut violet gem with a glint that comes and goes.
const CRYSTAL = "#b48cff";
function drawCrystal(ctx, x, y, clock) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  circle(ctx, x, y, 1.6);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x, y - 1.3);
  ctx.lineTo(x + 0.9, y - 0.3);
  ctx.lineTo(x, y + 1.3);
  ctx.lineTo(x - 0.9, y - 0.3);
  ctx.closePath();
  ctx.fillStyle = CRYSTAL;
  ctx.fill();
  ctx.strokeStyle = DARK_INK;
  ctx.lineWidth = 0.15;
  ctx.stroke();
  ctx.fillStyle = "#e9dcff";
  ctx.beginPath();
  ctx.moveTo(x, y - 1.3);
  ctx.lineTo(x + 0.9, y - 0.3);
  ctx.lineTo(x, y - 0.1);
  ctx.closePath();
  ctx.fill();
  const p = (clock / 1100) % 1;
  if (p < 0.25) {
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 1 - p / 0.25;
    star(ctx, x - 0.6, y - 0.9, 0.55, 0.18);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPickups(ctx, v) {
  const { spec, round, g } = v;
  const Y = (y) => g.FIELD_H - y;
  const lo = round.camX - 4;
  const hi = round.camX + g.FIELD_W + 4;
  spec.items.forEach(([, x, y], k) => {
    const kind = round.loot[k];
    if (round.items[k] || x < lo || x > hi) return;
    drawPower(ctx, v, kind, x, Y(y + 1.8) - 0.3 * Math.sin(v.clock / 250 + k));
  });
  // Up high, where Bat wings reach: crystals and the odd power-up.
  spec.sky.forEach(([kind, x, y], k) => {
    if (round.sky[k] || x < lo || x > hi) return;
    const bob = 0.3 * Math.sin(v.clock / 300 + k);
    if (kind === "crystal") drawCrystal(ctx, x, Y(y) - bob, v.clock + k * 300);
    else drawPower(ctx, v, kind, x, Y(y) - bob);
  });
  for (const d of round.drops) {
    if (d.kind === "candy") continue;
    if (d.life < 1500 && Math.floor(d.life / 120) % 2 === 0) ctx.globalAlpha = 0.4;
    drawPower(ctx, v, d.kind, d.x, Y(d.y + 0.5));
    ctx.globalAlpha = 1;
    if (d.mercy) drawMercy(ctx, v, d, Y(d.y + 0.5));
  }
  if (spec.key && !round.hasKey) {
    const [x, y] = spec.key;
    ctx.globalAlpha = 0.25 + 0.15 * Math.sin(v.clock / 200);
    circle(ctx, x, Y(y + 1.8), 2.2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.globalAlpha = 1;
    drawKey(ctx, x, Y(y + 1.8) - 0.3 * Math.sin(v.clock / 300), v.clock);
  }
}

// Retry mercy's gentle shimmer: a thin ring breathing round the pickup and a few
// sparkles circling it.
function drawMercy(ctx, v, d, y) {
  const t = v.clock / 600;
  ctx.save();
  ctx.strokeStyle = v.powers[d.kind].color;
  ctx.lineWidth = 0.25;
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 2);
  circle(ctx, d.x, y, 2.4 + 0.3 * Math.sin(t * 2));
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  for (let i = 0; i < 4; i++) {
    const a = t + (i * TAU) / 4;
    ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + i);
    circle(ctx, d.x + 2.6 * Math.cos(a), y + 2.6 * Math.sin(a), 0.22);
    ctx.fill();
  }
  ctx.restore();
}

// The souls burn over the dark, so they are drawn after it.
function drawSouls(ctx, v) {
  const { spec, round, g } = v;
  const Y = (y) => g.FIELD_H - y;
  const lo = round.camX - 4;
  const hi = round.camX + g.FIELD_W + 4;
  spec.candyAt.forEach((c, k) => {
    if (round.candy[k] || c.x < lo || c.x > hi) return;
    drawSoul(ctx, c.x, Y(c.y) - 0.3 * Math.sin(v.clock / 260 + k), k, v.clock);
  });
  for (const d of round.drops) {
    if (d.kind !== "candy") continue;
    if (d.life < 1500 && Math.floor(d.life / 120) % 2 === 0) ctx.globalAlpha = 0.4;
    drawSoul(ctx, d.x, Y(d.y), d.id, v.clock);
    ctx.globalAlpha = 1;
  }
}

/* ----------------------------------------------------------- monsters */

function drawMonsters(ctx, v) {
  const { round, g } = v;
  const Y = (y) => g.FIELD_H - y;
  const lo = round.camX - 6;
  const hi = round.camX + g.FIELD_W + 6;
  for (const m of round.monsters) {
    if (m.x < lo || m.x > hi) continue;
    const x = m.x;
    const y = Y(m.y);
    const flash = m.hurt > 0 && Math.floor(m.hurt / 55) % 2 === 0;
    const t = m.t + m.id * 37;
    if (ART.monsters[m.kind]) ART.monsters[m.kind](ctx, v, m, x, y, t, flash);
    else if (g.ZOMBIES.has(m.kind)) {
      // Stepping out of its door, it fades in.
      ctx.globalAlpha = m.rise > 0 ? Math.max(0.15, 1 - m.rise / g.EMERGE_MS) : 1;
      if (m.kind === "zombie") drawZombie(ctx, v, m, x, y, t, flash);
      else drawZombieKin(ctx, v, m, x, y, t, flash);
      ctx.globalAlpha = 1;
    } else if (m.kind === "huntsman") drawHuntsman(ctx, v, m, x, y, t, flash);
    else if (m.kind === "crawler") drawCrawler(ctx, v, m, x, y, t, flash, g);
    else if (m.kind === "bat") drawBat(ctx, v, m, x, y, t, flash);
    else if (m.kind === "ghost") drawGhost(ctx, v, m, x, y, t, flash);
    else if (m.kind === "skeleton") drawSkeleton(ctx, v, m, x, y, t, flash);
    else if (m.kind === "hound") drawHound(ctx, v, m, x, y, t, flash);
    else if (m.kind === "spider") drawSpider(ctx, v, m, x, y, t, flash);
    else if (m.kind === "wraith") drawWraith(ctx, v, m, x, y, t, flash);
    else if (m.kind === "spitter") drawSpitter(ctx, v, m, x, y, t, flash, g);
    else drawGourdling(ctx, v, m, x, y, t, flash);
  }
  for (const b of round.bones) {
    if (b.kind === "acid") drawGlob(ctx, b.x, Y(b.y), v.clock + b.id * 31);
    else if (ART.missiles[b.kind]) ART.missiles[b.kind](ctx, b.x, Y(b.y), b.spin);
    else drawBoneShape(ctx, b.x, Y(b.y), b.spin);
  }
  for (const h of round.hazards) if (ART.hazards[h.kind]) ART.hazards[h.kind](ctx, v, h);
  for (const p of round.puddles) {
    const y = Y(p.y);
    ctx.globalAlpha = Math.min(1, p.life / 400) * 0.85;
    ctx.fillStyle = "#4a6a10";
    ellipse(ctx, p.x, y - 0.1, g.PUDDLE_W / 2, 0.35);
    ctx.fill();
    ctx.fillStyle = ACID;
    ellipse(ctx, p.x, y - 0.15, g.PUDDLE_W / 2 - 0.4, 0.22);
    ctx.fill();
    for (let k = 0; k < 3; k++) {
      const bp = ((v.clock + p.id * 77 + k * 230) % 700) / 700;
      circle(ctx, p.x - 1.1 + k * 1.1, y - 0.3 - bp * 0.8, 0.18 * (1 - bp) + 0.05);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  for (const w of round.waves) {
    const y = Y(w.y);
    if (w.kind === "gourd") {
      drawGourdWave(ctx, v, w, y);
      continue;
    }
    if (ART.waves[w.kind]) {
      ART.waves[w.kind](ctx, v, w, y);
      continue;
    }
    ctx.fillStyle = "#6a6050";
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(w.x - w.dir * 2.4, y);
    ctx.quadraticCurveTo(w.x - w.dir * 0.6, y - g.WAVE_H * 1.2, w.x + w.dir * 0.6, y);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.45;
    for (let k = 1; k <= 3; k++) {
      circle(ctx, w.x - w.dir * k * 1.2, y - 0.4 - ((v.clock / 40 + k) % 3) * 0.3, 0.35);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

// The Gourd's quake running along the floor: a glowing crest of burning
// pumpkin, orange with a yellow-hot core, trailing rotten-green embers, so
// it shows against the dark boards.
const WAVE_GLOW = "#ff7a1a";
const WAVE_CORE = "#ffd23f";
const WAVE_EMBER = "#9dff3a";
function drawGourdWave(ctx, v, w, y) {
  const H = v.g.WAVE_H;
  const d = w.dir;
  const flick = 0.85 + 0.15 * Math.sin(v.clock / 45 + w.x);
  const crest = (scale, color, alpha) => {
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(w.x - d * 2.8 * scale, y);
    ctx.quadraticCurveTo(w.x - d * 0.6 * scale, y - H * 1.5 * scale * flick, w.x + d * 0.8 * scale, y);
    ctx.closePath();
    ctx.fill();
  };
  crest(1.6, WAVE_GLOW, 0.3);
  crest(1, WAVE_GLOW, 0.95);
  crest(0.55, WAVE_CORE, 1);
  ctx.fillStyle = WAVE_EMBER;
  for (let k = 1; k <= 4; k++) {
    const p = (v.clock / 260 + k * 0.27) % 1;
    ctx.globalAlpha = 0.9 * (1 - p);
    circle(ctx, w.x - d * (k * 1.1 + p * 1.5), y - 0.4 - p * 2.2, 0.32 * (1 - p * 0.5));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* -------------------------------------------------------------- bosses */

function drawGourd(ctx, v, b) {
  const { g } = v;
  const x = b.x;
  const y = g.FIELD_H - b.y;
  const flash = b.hurt > 0;
  const air = b.y > v.groundAt(v.spec, b.x) + 0.05;
  // Its shadow on the floor, where it will come down.
  const floorY = g.FIELD_H - v.groundAt(v.spec, air ? b.landX : b.x);
  ctx.fillStyle = air ? "rgba(200, 30, 20, 0.5)" : "rgba(0, 0, 0, 0.4)";
  ellipse(ctx, air ? b.landX : x, floorY - 0.2, b.w / 2, 0.8);
  ctx.fill();
  const squash = air ? 0.08 : b.wait < 400 ? 0.06 * Math.sin(v.clock / 30) : 0;
  const w = b.w / 2 + squash * 4;
  const h = b.h / 2 - squash * 4;
  const cy = y - h;
  for (let k = -2; k <= 2; k++) {
    ctx.fillStyle = flash ? FLASH : k % 2 ? "#5e2c0c" : "#7a3a10";
    ellipse(ctx, x + k * w * 0.32, cy, w * (0.5 - Math.abs(k) * 0.07), h);
    ctx.fill();
  }
  if (!flash) {
    // Rot spreading over it.
    ctx.fillStyle = "#2a1406";
    for (const [px, py, r] of [[-0.5, -0.4, 0.22], [0.55, 0.3, 0.18], [-0.2, 0.55, 0.14], [0.3, -0.6, 0.12]]) {
      ellipse(ctx, x + px * w, cy + py * h, r * w, r * h * 0.7);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#1a2a0e";
  ctx.fillRect(x - 0.6, cy - h - 2, 1.2, 2.4);
  // Vines like feelers, curling.
  ctx.strokeStyle = "#1a2a0e";
  ctx.lineWidth = 0.4;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * 0.4, cy - h - 1.4);
    ctx.quadraticCurveTo(x + s * 3.6, cy - h - 3 + Math.sin(v.clock / 200 + s) * 0.8, x + s * 4.6, cy - h + 0.4);
    ctx.stroke();
  }
  // The carved face, black here; its fire burns over the dark.
  ctx.fillStyle = "#120602";
  gourdFace(ctx, x, cy, b.dir);
  ctx.fill();
}

// The carved face's shape, as one path: two eyes slashed down toward the
// middle in a glare, and a mouth torn wide, crowded with crooked fangs.
function gourdFace(ctx, x, cy, dir) {
  const o = dir * 0.6;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    ctx.moveTo(x + s * 0.8 + o, cy - 0.7);
    ctx.lineTo(x + s * 3.6 + o, cy - 3.2);
    ctx.lineTo(x + s * 3.0 + o, cy - 0.6);
    ctx.closePath();
  }
  const n = 12;
  const left = x - 4.6 + o;
  const span = 9.2;
  const sag = (t) => 1.1 * (1 - (2 * t - 1) ** 2);
  ctx.moveTo(left, cy + 0.6);
  for (let k = 1; k <= n; k++) {
    const t = k / n;
    ctx.lineTo(left + span * t, cy + 0.6 + sag(t) + (k % 2 ? 1.0 + (k % 3) * 0.25 : 0));
  }
  for (let k = n - 1; k >= 0; k--) {
    const t = k / n;
    ctx.lineTo(left + span * t, cy + 4.2 + sag(t) * 0.6 - (k % 2 ? 1.1 + (k % 4) * 0.2 : 0));
  }
  ctx.closePath();
}

// The Gourd's face on fire, drawn over the dark.
function drawGourdFire(ctx, v, b) {
  const { g } = v;
  const air = b.y > v.groundAt(v.spec, b.x) + 0.05;
  const squash = air ? 0.08 : b.wait < 400 ? 0.06 * Math.sin(v.clock / 30) : 0;
  const cy = g.FIELD_H - b.y - (b.h / 2 - squash * 4);
  ctx.fillStyle = b.state === "fight" ? "#ff8a1a" : "#8a3a0a";
  ctx.globalAlpha = 0.8 + 0.2 * Math.sin(v.clock / 60);
  gourdFace(ctx, b.x, cy, b.dir);
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawBoss(ctx, v) {
  const b = v.round.boss;
  if (!b) return;
  const was = ctx.globalAlpha;
  if (b.state === "down") {
    if (b.t > 900) return;
    ctx.globalAlpha = was * (1 - b.t / 900);
  }
  BOSS_ART[b.kind]?.(ctx, v, b);
  ctx.globalAlpha = was;
}

// Each boss's figure, standing on its feet at (b.x, b.y).
const BOSS_ART = Object.freeze({ gourd: drawGourd, ...ART.bosses });

// The boss's name and hp along the top of the field while it fights.
function drawBossBar(ctx, v) {
  const b = v.round.boss;
  if (!b || b.state === "sleep" || b.state === "down") return;
  const { g } = v;
  const def = v.bosses[b.kind];
  const w = g.FIELD_W * 0.6;
  const x = (g.FIELD_W - w) / 2;
  label(ctx, def.name, g.FIELD_W / 2, 2.4, 2, "#ffffff", "center", w, true);
  roundRect(ctx, x, 4, w, 1.6, 0.8);
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fill();
  roundRect(ctx, x + 0.2, 4.2, (w - 0.4) * Math.max(0, b.hp / b.max), 1.2, 0.6);
  ctx.fillStyle = "#a01010";
  ctx.fill();
}

/* -------------------------------------------------------------- Planny */

// Planny, standing on his feet at (x, y): his box, its star eye in your
// highlight in every state, stick arms and two small feet. One hand holds
// the flashlight blaster out the way he faces, flaring as it fires; running,
// his legs step and the other arm swings; in the air or cheering, his free
// arm is up; hit, he spins with a little "o" of a mouth; at the end he
// slumps. A Garlic shield circles him while he has one.
function drawPlanny(ctx, v) {
  const { round, colors, g } = v;
  const you = round.you;
  const ink = limbInk(v.spec.id);
  const x = you.x;
  const y = g.FIELD_H - you.y;
  const hurt = you.out > 0 && !v.lost;
  const flying = you.state === "air" && !hurt;
  const cheer = v.cheer && !hurt && !v.lost;
  const face = you.face || 1;
  const was = ctx.globalAlpha;
  if (you.safeMs > 0 && Math.floor(v.clock / 90) % 2 === 0) ctx.globalAlpha = was * 0.45;
  if (you.garlic && !hurt) {
    ctx.strokeStyle = "#e6e0b8";
    ctx.lineWidth = 0.25;
    ctx.globalAlpha = was * 0.6;
    circle(ctx, x, y - g.YOU_H / 2, g.YOU_H * 0.7);
    ctx.stroke();
    ctx.globalAlpha = was;
    ctx.fillStyle = "#fffbe8";
    for (let k = 0; k < 3; k++) {
      const a = v.clock / 500 + (k * TAU) / 3;
      ellipse(ctx, x + Math.cos(a) * g.YOU_H * 0.7, y - g.YOU_H / 2 + Math.sin(a) * g.YOU_H * 0.7, 0.5, 0.45);
      ctx.fill();
    }
  }
  if ((round.effects.wings > 0 || you.lift) && !hurt) {
    // Bat wings on his back, beating while he is in the air (folded once flapped).
    const beat = flying && !you.flapped ? Math.sin(v.clock / 60) * 0.5 : -0.3;
    ctx.fillStyle = v.powers.wings.color;
    ctx.strokeStyle = "#3a2a5a";
    ctx.lineWidth = 0.18;
    for (const s of [-1, 1]) {
      const wx = x + s * 1.2;
      const wy = y - g.YOU_H * 0.62;
      ctx.beginPath();
      ctx.moveTo(x, wy);
      ctx.lineTo(wx + s * 1.8, wy - 1.6 - beat);
      ctx.lineTo(wx + s * 1.5, wy + 0.4 - beat * 0.4);
      ctx.lineTo(wx + s * 0.7, wy + 0.1);
      ctx.lineTo(wx + s * 0.4, wy + 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  // Drawn 4.4 units tall, then scaled to YOU_H.
  const S = 1.6;
  const top = -4.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(g.YOU_H / 4.4, g.YOU_H / 4.4);
  // Ducked: squashed down onto his feet, a little wider for it.
  if (you.ducking && !hurt) ctx.scale(1.15, 0.55);
  if (hurt) {
    const p = 1 - you.out / g.CRASH_MS;
    ctx.translate(0, -2.8);
    rotate(ctx, p * 4 * face);
    ctx.translate(0, 2.8);
  }
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 0.32;
  ctx.lineCap = "round";
  const stepT = you.runMs / 45;
  for (const s of [-1, 1]) {
    let fx = s * 0.75;
    let fy = 0;
    if (flying) {
      fx = s * 0.95;
      fy = -0.45;
    } else if (you.runMs > 0 && !v.lost) fx += Math.sin(stepT + (s > 0 ? Math.PI : 0)) * 0.7;
    line(ctx, s * 0.6, -1.2, fx, fy - 0.2);
    ellipse(ctx, fx + face * 0.15, fy - 0.18, 0.6, 0.32);
    ctx.fill();
  }
  // The free arm (behind), then his box, then the blaster arm in front.
  const wave = Math.sin(v.clock / 90) * 0.35;
  ctx.beginPath();
  ctx.moveTo(-face * S, -2.7);
  if (hurt) ctx.lineTo(-face * (S + 1.2), -3.8);
  else if (cheer || flying) ctx.lineTo(-face * (S + 1.1), -5.3 + wave);
  else if (v.lost) ctx.lineTo(-face * (S + 0.35), -1.0);
  else if (you.runMs > 0) ctx.lineTo(-face * (S + 0.7), -1.7 + Math.sin(stepT) * 0.6);
  else ctx.lineTo(-face * (S + 0.55), -1.5);
  ctx.stroke();
  roundRect(ctx, -S, top, S * 2, S * 2, S * 0.32);
  ctx.fillStyle = colors.board;
  ctx.fill();
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.22;
  ctx.stroke();
  star(ctx, face * 0.15, top + S * 0.78, S * 0.58, S * 0.25, hurt ? v.clock / 60 : 0);
  const eyeWas = ctx.globalAlpha;
  if (v.lost) ctx.globalAlpha = eyeWas * 0.75;
  ctx.fillStyle = colors.you;
  ctx.fill();
  ctx.globalAlpha = eyeWas;
  ctx.strokeStyle = colors.ink;
  ctx.lineWidth = 0.18;
  ctx.beginPath();
  if (hurt) ctx.arc(face * 0.15, top + S * 1.5, S * 0.17, 0, TAU);
  else if (v.lost) ctx.arc(face * 0.15, top + S * 1.8, S * 0.3, 1.15 * Math.PI, 1.85 * Math.PI);
  else ctx.arc(face * 0.15, top + S * 1.3, S * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.32;
  if (cheer) {
    line(ctx, face * S, -2.7, face * (S + 1.1), -5.3 - wave);
  } else if (!hurt && !v.lost) {
    // The flashlight blaster, held out level with his chest.
    const hy = -2.25;
    line(ctx, face * S, -2.6, face * (S + 0.9), hy);
    ctx.fillStyle = "#4a4f5a";
    ctx.fillRect(face > 0 ? S + 0.7 : -S - 2.3, hy - 0.35, 1.6, 0.7);
    ctx.fillStyle = "#c9ced6";
    ctx.fillRect(face > 0 ? S + 2.1 : -S - 2.5, hy - 0.5, 0.4, 1);
    if (you.fireFx > 0) {
      ctx.fillStyle = "#fff3b0";
      ctx.globalAlpha = eyeWas * (you.fireFx / 90);
      ctx.beginPath();
      ctx.moveTo(face * (S + 2.5), hy - 0.5);
      ctx.lineTo(face * (S + 5.5), hy - 1.6);
      ctx.lineTo(face * (S + 5.5), hy + 1.6);
      ctx.lineTo(face * (S + 2.5), hy + 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = eyeWas;
    }
  } else line(ctx, face * S, -2.7, face * (S + (hurt ? 1.2 : 0.35)), hurt ? -3.8 : -1);
  ctx.lineCap = "butt";
  ctx.restore();
  ctx.globalAlpha = was;
}

// The bolts: short streaks of light with a bright head.
function drawShots(ctx, v) {
  const { round, g } = v;
  // Silver bolts burn a cold blue-white rather than the lamp's warm yellow.
  const silver = round.effects.silver > 0;
  // Cotton Candy's bolts are pink and sticky-looking.
  const floss = round.effects.floss > 0 && !silver;
  for (const s of round.shots) {
    const y = g.FIELD_H - s.y;
    if (s.arm) {
      ART.armShot(ctx, v, s, y);
      continue;
    }
    const dx = Math.sign(s.vx) * 3;
    const dy = (s.vy / Math.max(1, Math.abs(s.vx))) * 3;
    ctx.strokeStyle = silver ? "rgba(214, 228, 242, 0.45)" : floss ? "rgba(255, 150, 215, 0.5)" : "rgba(255, 243, 176, 0.4)";
    ctx.lineWidth = 0.9;
    line(ctx, s.x - dx, y + dy, s.x, y);
    ctx.strokeStyle = silver ? "#d6e4f2" : floss ? "#ff9ad5" : "#fff3b0";
    ctx.lineWidth = 0.4;
    line(ctx, s.x - dx * 0.6, y + dy * 0.6, s.x, y);
    ctx.fillStyle = "#ffffff";
    circle(ctx, s.x, y, 0.32);
    ctx.fill();
  }
}

/* ------------------------------------------------------------- the dark */

// The dark layer: the field's size at the frame's scale (and a margin, so a
// shake never shows its edge), kept and redrawn each frame. Null where no
// second canvas can be made (as in Node): the frame then goes undarkened.
const DARK_MARGIN = 2;
// A lit room keeps this share of its look's dark: dim, not black.
const LIT_DARK = 0.3;
let dark = null;

function darkCanvas(ctx, g) {
  const m = typeof ctx.getTransform === "function" ? ctx.getTransform() : null;
  if (!m || !(m.a > 0)) return null;
  const a = m.a;
  const w = Math.ceil((g.FIELD_W + DARK_MARGIN * 2) * a);
  const h = Math.ceil((g.FIELD_H + DARK_MARGIN * 2) * a);
  if (dark && dark.w === w && dark.h === h) return dark;
  try {
    const canvas = offscreen(w, h);
    const c = canvas && canvas.getContext("2d");
    dark = c ? { canvas, c, w, h, a } : null;
  } catch {
    dark = null;
  }
  return dark;
}

// The lights of the moment, as [x, y, r, strength] in field units (y down,
// x from the field's left edge): what the dark lets through.
const lights = [];

function gatherLights(v, cam) {
  const { round, spec, g, fx } = v;
  const look = lookOf(spec.id);
  lights.length = 0;
  const Y = (y) => g.FIELD_H - y;
  const add = (x, y, r, s) => {
    if (x - cam > -r && x - cam < g.FIELD_W + r) lights.push(x - cam, Y(y), r, s);
  };
  const you = round.you;
  const lit = you.out > 0 ? 0.6 : 1;
  // An imp's stolen light (you.dimMs): a sliver, and no cone or Lantern pool.
  const dim = you.dimMs > 0;
  add(you.x, you.y + g.YOU_H / 2, dim ? 4 : 12, 0.95 * lit);
  // The Lantern: a wide warm pool around you, fading in its last second.
  const lantern = Math.min(1, (round.effects.lantern || 0) / 1000);
  if (lantern > 0 && !dim) add(you.x, you.y + g.YOU_H / 2, 34, 0.9 * lantern * lit);
  if (you.fireFx > 0) add(you.x + you.face * 4, you.y + (you.ducking ? g.DUCK_SHOT_Y : g.SHOT_Y), 10, (0.9 * you.fireFx) / 90);
  for (const s of round.shots) add(s.x, s.y, 5, 0.75);
  for (const w of round.waves) if (w.kind === "gourd") add(w.x, w.y + 1, 7, 0.8);
  for (const c of round.falls) {
    const flicker = Math.sin(v.clock / 70 + c.x) * 0.6 + Math.sin(v.clock / 23 + c.x * 3) * 0.3;
    add(c.x, c.y - 1, c.state === "down" ? 4 : 11 + flicker, c.state === "down" ? 0.35 : 0.8);
  }
  if (!look.outdoor && !look.noMoon && !ART.dim(v)) {
    for (let x = Math.floor(cam / WINDOW_EVERY) * WINDOW_EVERY + 20; x < cam + g.FIELD_W + 16; x += WINDOW_EVERY) {
      const w = windowAt(look, x);
      add(w.x + w.w / 2, g.FIELD_H - w.top - w.h * 0.55, w.w, 0.35);
    }
  }
  ART.lights(v, add);
  const dy = v.groundAt(spec, spec.door);
  add(spec.door, dy + 6, round.hasKey ? 14 : 6, round.hasKey ? 0.9 : 0.3);
  if (spec.key && !round.hasKey) add(spec.key[0], spec.key[1] + 1.8, 7, 0.65);
  spec.items.forEach(([, x, y], k) => {
    if (!round.items[k]) add(x, y + 1.8, 4, 0.5);
  });
  spec.sky.forEach(([, x, y], k) => {
    if (!round.sky[k]) add(x, y, 4, 0.55);
  });
  spec.candyAt.forEach((c, k) => {
    if (!round.candy[k]) add(c.x, c.y, 2.8, 0.45);
  });
  for (const d of round.drops) add(d.x, d.y, 3, 0.45);
  for (const b of round.bones) if (b.kind === "acid") add(b.x, b.y, 2.6, 0.45);
  for (const p of round.puddles) add(p.x, p.y + 0.5, 3.6, 0.4 * Math.min(1, p.life / 400));
  const b = round.boss;
  if (b && b.kind === "gourd" && b.state !== "sleep" && b.state !== "down") add(b.x, b.y + b.h / 2, 11, 0.55);
  for (const gl of fx.glows) {
    const f = gl.life / gl.max;
    add(gl.x, gl.y, gl.r * (0.6 + f * 0.4), gl.s * f);
  }
}

// A soft hole in the dark: full strength at the middle, none at its edge.
function hole(c, x, y, r, s) {
  const gr = typeof c.createRadialGradient === "function" ? c.createRadialGradient(x, y, 0, x, y, r) : null;
  if (gr && typeof gr.addColorStop === "function") {
    gr.addColorStop(0, `rgba(0, 0, 0, ${s})`);
    gr.addColorStop(0.55, `rgba(0, 0, 0, ${s * 0.6})`);
    gr.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = gr;
    c.fillRect(x - r, y - r, r * 2, r * 2);
    return;
  }
  c.fillStyle = `rgba(0, 0, 0, ${s * 0.6})`;
  circle(c, x, y, r * 0.7);
  c.fill();
}

// A night over the whole field with a hole for each of `lights` ([x, y, r, strength], field units, y down): a room that
// is drawn whole by its own art (the Drowned Lantern) uses it, since it has no scrolling and no still layers to dim.
// False where the page cannot make the layer (the caller dims plainly instead).
function paintDark(ctx, v, alpha, lit) {
  const { g } = v;
  const d = darkCanvas(ctx, g);
  if (!d) return false;
  const { c, a } = d;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, d.w, d.h);
  c.fillStyle = `rgba(2, 5, 7, ${alpha.toFixed(3)})`;
  c.fillRect(0, 0, d.w, d.h);
  c.setTransform(a, 0, 0, a, DARK_MARGIN * a, DARK_MARGIN * a);
  c.globalCompositeOperation = "destination-out";
  for (const [x, y, r, s] of lit) hole(c, x, y, r, s);
  c.globalCompositeOperation = "source-over";
  ctx.drawImage(d.canvas, -DARK_MARGIN, -DARK_MARGIN, g.FIELD_W + DARK_MARGIN * 2, g.FIELD_H + DARK_MARGIN * 2);
  return true;
}

// The flashlight's cone, out from the blaster the way Planny faces.
const CONE_LEN = 46;
const CONE_HALF = 0.36;

function cone(c, x, y, face) {
  const a = face > 0 ? 0 : Math.PI;
  const gr = typeof c.createRadialGradient === "function" ? c.createRadialGradient(x, y, 1, x, y, CONE_LEN) : null;
  if (gr && typeof gr.addColorStop === "function") {
    gr.addColorStop(0, "rgba(0, 0, 0, 0.95)");
    gr.addColorStop(0.6, "rgba(0, 0, 0, 0.7)");
    gr.addColorStop(1, "rgba(0, 0, 0, 0)");
    c.fillStyle = gr;
  } else c.fillStyle = "rgba(0, 0, 0, 0.6)";
  c.beginPath();
  c.moveTo(x, y);
  c.arc(x, y, CONE_LEN, a - CONE_HALF, a + CONE_HALF);
  c.closePath();
  c.fill();
}

// Lays the dark over the field, holes cut at every light, lifted by a
// flash of lightning, and redder at the edges on the last life.
function drawDark(ctx, v, cam) {
  const { g, round } = v;
  const d = darkCanvas(ctx, g);
  if (!d) return;
  const { c, a } = d;
  const look = lookOf(v.spec.id);
  // The Lantern also thins the dark everywhere a little.
  const lantern = Math.min(1, (round.effects.lantern || 0) / 1000);
  let alpha = look.dark * (round.dark ? 1 : LIT_DARK) * (1 - 0.8 * v.lightning) * (1 - 0.25 * lantern);
  alpha = Math.max(alpha, ART.dim(v) * (1 - 0.8 * v.lightning));
  if (v.state === "ready" || v.state === "over") alpha *= 0.75;
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, d.w, d.h);
  c.fillStyle = `rgba(3, 1, 6, ${alpha.toFixed(3)})`;
  c.fillRect(0, 0, d.w, d.h);
  c.setTransform(a, 0, 0, a, DARK_MARGIN * a, DARK_MARGIN * a);
  c.globalCompositeOperation = "destination-out";
  gatherLights(v, cam);
  for (let i = 0; i < lights.length; i += 4) hole(c, lights[i], lights[i + 1], lights[i + 2], lights[i + 3]);
  const you = round.you;
  if (you.out <= 0 && !v.lost && !(you.dimMs > 0)) cone(c, you.x - cam + you.face * 2.6, g.FIELD_H - you.y - (you.ducking ? g.DUCK_SHOT_Y : g.SHOT_Y), you.face);
  c.globalCompositeOperation = "source-over";
  ctx.drawImage(d.canvas, cam - DARK_MARGIN, -DARK_MARGIN, g.FIELD_W + DARK_MARGIN * 2, g.FIELD_H + DARK_MARGIN * 2);
}

// What burns in the dark, drawn over it: eyes (a dim halo and a hot
// point), the Gourd's face, the souls, the bolts.
function drawGlowing(ctx, v) {
  const e = v.eyes;
  for (let i = 0; i < e.length; i += 4) {
    ctx.fillStyle = e[i + 3];
    ctx.globalAlpha = 0.16;
    circle(ctx, e[i], e[i + 1], e[i + 2] * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    circle(ctx, e[i], e[i + 1], e[i + 2]);
    ctx.fill();
  }
  const b = v.round.boss;
  if (b && b.kind === "gourd" && !(b.state === "down" && b.t > 900)) drawGourdFire(ctx, v, b);
  drawSouls(ctx, v);
  drawShots(ctx, v);
}

/* ------------------------------------------------------------ feedback */

const KILL_WORDS = Object.freeze({ head: "Headshot!", stomp: "Crunch!", crush: "Flattened!", garlic: "Garlic!" });
const LOSE_WORDS = Object.freeze({ time: "Out of time", pit: "Into the dark", bone: "Skull cracked", chandelier: "Crushed", acid: "Burned alive", wave: "Thrown down", ...BONES_LOSE_WORDS, ...BANISTER_LOSE_WORDS, ...GROUNDS_LOSE_WORDS, ...CHAPEL_LOSE_WORDS, ...SANATORIUM_LOSE_WORDS, ...VILLAGE_LOSE_WORDS, ...MINE_LOSE_WORDS, ...CART_LOSE_WORDS, ...SLED_LOSE_WORDS, ...HEARSE_LOSE_WORDS, ...GURNEY_LOSE_WORDS, ...PEW_LOSE_WORDS, ...MOWER_LOSE_WORDS, ...TRAY_LOSE_WORDS, ...WAGON_LOSE_WORDS, ...CARNIVAL_LOSE_WORDS, ...FROZEN_LOSE_WORDS,...RIDE_LOSE_WORDS, ...BOG_LOSE_WORDS, ...LANTERN_LOSE_WORDS, hound: "Mauled", spider: "Bitten", wraith: "Taken", hands: "Dragged under", mourner: "Mourned", robber: "Buried alive", crow: "Pecked", legs: "Kicked down", stone: "Struck by a headstone", fist: "Crushed by stone", angel: "Turned to stone" });
// What spills from each kind when it dies, and whether it leaves a stain.
const STAINS = Object.freeze({ ghost: false, wraith: false, skeleton: false, bat: true });

// What each of the round's events looks and sounds like: the sparks, rings,
// floating words, banners, shakes and flashes ghoul.js keeps in its effects,
// the flares of light and the stains on the floor, and the sounds: each
// event's old blip with a richer layer beside it (a kill's sound by kind, a
// death's by cause, a boss's intro, stinger and fall, the key's jingle, the
// door slamming as a room begins). Sounds kept to one at a time (`gate`)
// count on `fx.clock`, and only a sound's pitch is ever random. `k` hands
// over the effect makers and the tables: { tone, burst, float, ring, banner,
// shake, flash, glow, splat, floorAt, fx, roomBanner, markFurthest,
// monsters, powers, bosses, g }.
export function react(e, k) {
  const { tone, burst, float, ring, banner, shake, flash, glow, splat, fx, monsters: MONSTERS, powers: POWERS, bosses: BOSSES, g } = k;
  if (e.type === "jump") {
    tone("hop", 0.18);
    tone("jump", 0.22, vary(0.12));
    burst(e.x, e.y, "#4a3e48", 4, 6, 350);
  } else if (e.type === "duck") {
    tone("thunk", 0.12, 1.8);
  } else if (e.type === "land") {
    tone("thunk", 0.2, 1.4);
    tone("land", 0.3, vary(0.15));
    burst(e.x, e.y, "#4a3e48", 3, 5, 300);
  } else if (e.type === "fire") tone("ghoulBlast", e.spread ? 0.28 : 0.22, 0.95 + Math.random() * 0.1);
  else if (e.type === "puff") {
    burst(e.x, e.y, "#fff3b0", 3, 8, 220);
    if (gate(fx, "puffMs", 90)) tone("tickSoft", 0.2, vary(0.3));
  } else if (e.type === "hit") {
    tone("bump", 0.22, 0.7);
    // Its own cry, one at a time under held fire; a kind with none just thuds.
    if (!VOICES[e.kind]?.hurt) tone("hit", 0.18, vary(0.16));
    else if (gate(fx, "hurtMs", 140)) say(tone, e.kind, "hurt", 0.3);
    burst(e.x, e.y, MONSTERS[e.kind] ? MONSTERS[e.kind].color : BLOOD, 6, 12, 320);
  } else if (e.type === "kill") {
    const def = MONSTERS[e.kind];
    tone(e.kind === "bat" ? "batSwoop" : "zombiePop", 0.5, Math.min(2, 1 + 0.07 * (e.mult - 1)));
    // The Hedge shears' snip stands in for the dying cry (see ghoul-grounds-draw.js).
    if (e.how !== "shears") say(tone, e.kind, "die", 0.5);
    if (e.how === "head") tone("ghoulHeadshot", 0.45, vary(0.08));
    else if (e.how === "crush") tone("crunch", 0.5, 0.8);
    if (e.mult > 1) tone("combo", 0.3, 1 + 0.05 * Math.min(10, e.mult));
    // A chain climbing past x3 sparkles, a step higher each kill.
    if (e.mult >= 3) tone("sparkle", 0.18, Math.min(1.6, 0.8 + 0.06 * e.mult));
    burst(e.x, e.y, def.color, 18, 20, 650);
    burst(e.x, e.y, e.kind === "skeleton" ? BONE : BLOOD_DARK, 8, 14, 500);
    glow(e.x, e.y, 9, 0.7, 220);
    if (STAINS[e.kind] !== false) {
      const floor = k.floorAt(e.x);
      if (floor > -Infinity && floor <= e.y) splat(e.x, floor, 1.4 + Math.random() * 1.4, def.color);
    }
    const word = KILL_WORDS[e.how];
    float(e.x, e.y + 3, word ? `${word} +${e.points}` : `+${e.points}`, e.mult > 1 || word ? GOLD : "#ffffff", word ? 2.4 : 2.1);
    if (e.mult >= 2) fx.combo = { mult: e.mult, life: 900, max: 900 };
    shake(e.how === "head" || e.how === "crush" ? 110 : 60, e.how === "head" || e.how === "crush" ? 0.35 : 0.15);
  } else if (e.type === "stomp") {
    tone("ghoulStomp", 0.55);
    tone("squish", 0.35, vary(0.2));
    ring(e.x, e.y, "#ffffff", 1, 4, 260);
  } else if (e.type === "bone") {
    tone("wall", 0.3, 1.5);
    tone(e.kind === "acid" ? "ghoulSizzle" : "clank", 0.22, vary(0.2));
    burst(e.x, e.y, e.kind === "acid" ? ACID : BONE, 6, 10, 300);
    float(e.x, e.y + 2, `+${e.points}`, "#ffffff", 1.9);
  } else if (e.type === "spawn") {
    if (e.kind === "crawler") tone("creakBoard", 0.4);
    // Each kind's own arrival, one at a time when a room wakes several (a
    // runner's is its warning, a bat's its waking, a wraith's its noticing you).
    if (VOICES[e.kind]?.appear && gate(fx, "spawnMs", 160)) say(tone, e.kind, "appear", 0.4);
  } else if (e.type === "door") {
    tone("doorCreak", 0.3, vary(0.2));
  } else if (e.type === "bat") say(tone, "bat", "wake", 0.4);
  // Only Old Rattlebones winds up as a boss; a skeleton's arm creaks.
  else if (e.type === "windup") {
    if (e.boss) say(tone, "bones", "windup", 0.5);
    else tone("creakBoard", 0.25, 1.6);
  }
  // A hound's growl and lunge carry no kind; a Huntsman's do.
  else if (e.type === "growl") say(tone, e.kind || "hound", "growl", 0.45);
  else if (e.type === "lunge") say(tone, e.kind || "hound", "lunge", 0.45);
  else if (e.type === "skitter") say(tone, "spider", "appear", 0.4);
  else if (e.type === "wraith") say(tone, "wraith", "notice", 0.4);
  else if (e.type === "shriek") say(tone, "wraith", "shriek", 0.45);
  else if (e.type === "runner") {
    // A runner coming: its war cry and a "!" where it will appear.
    say(tone, "runner", "warn", 0.5);
    float(e.x, e.y + 1.5, "!", DANGER, 3);
  } else if (e.type === "dive") say(tone, "wraith", "dive", 0.45);
  else if (e.type === "spit") say(tone, e.kind, "spit", e.kind === "gourd" ? 0.6 : 0.4);
  else if (e.type === "splash") {
    tone("ghoulSpit", 0.25, 0.5);
    tone("ghoulSizzle", 0.3, vary(0.2));
    burst(e.x, e.y + 0.5, ACID, 6, 8, 350);
  } else if (e.type === "clatter") tone("ghoulBoneDrop", 0.25, vary(0.2));
  else if (e.type === "burst") {
    tone("splashBig", 0.45, 0.6);
    burst(e.x, e.y, ACID, 22, 18, 600);
    glow(e.x, e.y, 10, 0.6, 300);
    shake(140, 0.4);
  } else if (e.type === "crystal") {
    tone("sparkle", 0.4, 1);
    tone("coinUp", 0.3, 0.8);
    burst(e.x, e.y, CRYSTAL, 10, 9, 500);
    float(e.x, e.y + 2, `Crystal +${e.points}`, CRYSTAL, 2.2);
  } else if (e.type === "candy") {
    fx.candyRun = fx.candyMs > 0 ? Math.min(8, fx.candyRun + 1) : 0;
    fx.candyMs = 600;
    tone("ghoulCandy", 0.3, 1 + 0.06 * fx.candyRun);
    // A full run of souls rings out.
    if (fx.candyRun === 8) tone("coinUp", 0.3);
    burst(e.x, e.y, SOUL, 5, 7, 400);
  } else if (e.type === "power") {
    const spec = POWERS[e.kind];
    tone("power", 0.4);
    // A stage-only power-up with its own pickup sound (VOICES[kind].active) plays that instead.
    if (VOICES[e.kind]?.active) say(tone, e.kind, "active", 0.5);
    else tone(POWER_SOUNDS[e.kind] || "powerUp", 0.5);
    burst(e.x, e.y, spec.color, 14, 12);
    ring(e.x, e.y, spec.color, 1, 6, 500);
    glow(e.x, e.y, 9, 0.6, 400);
    banner(spec.name, e.teach ? "Tap fire twice to use it" : e.gift ? "A little help after a quick fall" : spec.blurb, spec.color, e.teach ? 2200 : 1100);
  } else if (e.type === "retry") {
    // Retry mercy (ghoul-powers.js): a power-up set out a few steps ahead after a loss.
    if (gate(fx, "retryMs", 1500)) tone("sparkle", 0.3, 1.3);
    ring(e.x, e.y, POWERS[e.kind].color, 1, 5, 700);
    float(e.x, e.y + 4, "TRY AGAIN: +POWER", POWERS[e.kind].color, 2);
  } else if (e.type === "key") {
    tone("doorUnlock", 0.6);
    tone("ghoulKey", 0.45);
    burst(e.x, e.y, GOLD, 16, 14);
    ring(e.x, e.y, GOLD, 1, 7, 500);
    banner("The key", "Now find the door. Fast", GOLD, 1100);
  } else if (e.type === "keyDark") {
    tone("ghoulLightsOut", 0.6);
    flash("#000000", 200);
    shake(160, 0.3);
    float(e.x, e.y + 5, "The lights go out!", DANGER, 2.4);
  } else if (e.type === "garlic") {
    tone("shield");
    tone("ghoulGarlicPop", 0.55);
    ring(e.x, e.y + 2.5, POWERS.garlic.color, 2, 7, 500);
    float(e.x, e.y + 7, "Garlic!", POWERS.garlic.color, 2.4);
    shake(100, 0.3);
  } else if (e.type === "lose") {
    tone(e.cause === "pit" ? "fall" : "crash", 0.7);
    const [name, level, pitch] = LOSE_SOUNDS[e.cause] || LOSE_SOUNDS.zombie;
    tone(name, level, pitch);
    if (e.cause !== "pit") tone("lifeLost", 0.4);
    burst(e.x, e.y + 2.5, BLOOD, 18, 16);
    shake(300, 0.9);
    flash(DANGER, 260);
    float(e.x, Math.max(6, e.y + 7), LOSE_WORDS[e.cause] || "Torn apart", DANGER, 2.6);
    BONUS.react(e, k);
  } else if (e.type === "respawn") {
    // Back on your feet; on the last life, the heart starts pounding.
    tone(e.lives === 1 ? "heartbeat" : "whoosh", e.lives === 1 ? 0.6 : 0.25, e.lives === 1 ? 1 : 0.7);
    const last = e.hearts !== undefined ? e.hearts === 1 : e.lives === 1;
    banner("Ready?", e.hearts !== undefined ? `${e.hearts} bonus ${last ? "heart" : "hearts"} left` : last ? "Last life. Don't stop" : `${e.lives} lives left`, last ? DANGER : "#ffffff", g.READY_MS, { phase: "ready" });
  } else if (e.type === "go") tone("go", 0.5);
  else if (e.type === "creak") {
    tone("creakBoard", 0.5, 0.8);
    tone("doorCreak", 0.3, 1.4);
  } else if (e.type === "crash") {
    tone("boom", 0.6);
    tone("smash", 0.6, 0.8);
    tone("ghoulGlass", 0.45, vary(0.12));
    burst(e.x, e.y + 1, "#ffb84a", 18, 16);
    glow(e.x, e.y + 1, 10, 0.7, 300);
    shake(200, 0.6);
  } else if (e.type === "crumble") {
    tone("creakBoard", 0.45, 1.2);
    tone("rattle", 0.18, 0.5);
  } else if (e.type === "drop") {
    tone("fall", 0.3);
    tone("crumble", 0.45, vary(0.16));
  } else if (e.type === "back") tone("knock", 0.2, 0.7);
  else if (e.type === "flap") {
    tone("ghoulFlap", 0.4, 0.9);
    tone("whoosh", 0.2, 1.3);
    burst(e.x, e.y + 1, POWERS.wings.color, 8, 8, 300);
  } else if (e.type === "wingSave") {
    tone("ghoulFlap", 0.6, 0.8);
    tone("whoosh", 0.4, 0.9);
    burst(e.x, e.y, POWERS.wings.color, 16, 14, 500);
    banner(POWERS.wings.name, "Saved! Now they are spent", POWERS.wings.color, 1200);
  } else if (e.type === "tick") {
    // The clock's last seconds, sharper and louder as they run out.
    tone(e.left <= 3 ? "tick" : "tickSoft", e.left <= 3 ? 0.5 : 0.35, e.left <= 3 ? 1.3 : 1);
    if (e.left === 10) banner("Ten seconds", "The house is closing in", DANGER, 1100);
  } else if (e.type === "timeUp") {
    tone("bell", 0.7, 0.7);
  } else if (e.type === "ponder") {
    // A walker at a pit's edge, sizing it up.
    float(e.x, e.y + 1.5, "?", "#ffffff", 1.6);
  } else if (e.type === "leap") {
    say(tone, e.kind, e.kind === "seed" ? "hop" : "climb", 0.35);
    tone("whoosh", 0.15, 0.8);
  } else if (e.type === "scale") {
    // A walker setting its hands to a wall and hauling itself up.
    tone("creakBoard", 0.25, 0.8);
    say(tone, e.kind, "climb", 0.3);
  } else if (e.type === "climb") {
    say(tone, "zombie", "climb", 0.6);
    float(e.x, e.y + 6, "They're climbing!", DANGER, 2.6);
  } else if (e.type === "hurry") {
    tone("bell", 0.7);
    tone("ghoulToll", 0.6, 0.9);
    banner("They smell you", "The bonus is gone, and the dead are coming", DANGER, 1500);
  } else if (e.type === "expire") {
    tone("shank", 0.25);
    tone("powerDown", 0.35);
  } else if (e.type === "bossWake") {
    const def = BOSSES[e.kind];
    say(tone, e.kind, "wake", 0.8);
    tone("bossIntro", 0.7, e.kind === "bones" ? 1.2 : 1);
    tone("rumbleLong", 0.6);
    shake(400, 0.7);
    flash("#400000", 400);
    banner(def.name, def.sub, def.color, g.BOSS_INTRO_MS + 600);
  } else if (e.type === "bossGo") {
    tone("go", 0.5);
    tone("ghoulStinger", 0.55, e.kind === "bones" ? 0.9 : 1);
  } else if (e.type === "hop") {
    say(tone, "gourd", "hop", 0.55);
    tone("whoosh", 0.35, 0.6);
  } else if (e.type === "slam") {
    tone("boom", e.big ? 0.8 : 0.6);
    say(tone, e.kind, "slam", e.big ? 0.7 : 0.55);
    if (e.kind === "bones") tone("ghoulShock", 0.6);
    shake(e.big ? 360 : 220, e.big ? 1 : 0.6);
    burst(e.x, e.y, "#6a6050", 16, 18);
  } else if (e.type === "bossHit") {
    tone("bump", 0.25, e.how === "head" ? 1.2 : 0.7);
    if (e.how === "stomp") tone("thud", 0.5, 0.8);
    if (gate(fx, "bossHitMs", 160)) {
      // A boss's weak spot has its own cry, never the hurt beside it.
      say(tone, e.kind, e.weak && VOICES[e.kind]?.weak ? "weak" : "hurt", 0.45);
      if (e.how === "head") tone("clank", 0.3, vary(0.16));
    }
    burst(e.x, e.y, e.how === "head" ? BONE : BLOOD, 4, 10, 260);
    if (e.how === "head") float(e.x, e.y + 6, "Skull!", GOLD, 2);
    else if (e.weak) float(e.x, e.y + 4, e.kind === "keeper" ? "Lantern!" : e.kind === "motherbog" ? "Triple!" : "Double!", GOLD, 2);
  } else if (e.type === "bossDown") {
    tone("explode", 0.9, 0.8);
    say(tone, e.kind, "die", 0.8);
    tone("victory", 0.6);
    flash(GOLD, 380);
    shake(500, 1.1);
    burst(e.x, e.y, BOSSES[e.kind].color, 50, 26, 900);
    burst(e.x, e.y, BLOOD_DARK, 30, 20, 800);
    ring(e.x, e.y, GOLD, 2, 12, 700);
    glow(e.x, e.y, 22, 0.9, 900);
    fx.cheer = 1600;
    banner(`${BOSSES[e.kind].name} is dead`, e.life ? `+${e.points}, a life back, and the door is open` : `+${e.points}, and the door is open`, GOLD, 1800);
  } else if (e.type === "poof") {
    if (gate(fx, "poofMs", 80)) tone("ghoulPoof", 0.3, vary(0.3));
    burst(e.x, e.y, MONSTERS[e.kind] ? MONSTERS[e.kind].color : "#ffffff", 8, 12);
  } else if (e.type === "clear") {
    tone("doorThrough");
    tone("doorCreak", 0.35, 0.8);
    if (e.flawless) tone("sparkle", 0.35);
    flash("#d9e4ff", 300);
    fx.cheer = g.CLEAR_MS;
    burst(e.x, e.y + 3, SOUL, 22, 16);
    banner(e.flawless ? "Untouched" : "Escaped", e.flawless ? `+${e.points}, not a scratch` : `+${e.points} (time bonus ${e.bonus})`, GOLD, g.CLEAR_MS);
  } else if (e.type === "room") {
    fx.splats.length = 0;
    // The door slams behind you, each room's boom a different depth.
    tone("ghoulRoomIn", 0.6, ROOM_PITCH[(e.room - 1) % ROOM_PITCH.length]);
    k.roomBanner(e.room);
  } else if (e.type === "stageClear") {
    tone("fanfare", 0.4);
    k.markFurthest(e.n, banner("Stage cleared", `${e.n} of ${e.of}`, GOLD, 1400));
  } else if (e.type === "offer") {
    // The next doors on offer: a toll, a groan of hinges.
    tone("ghoulToll", 0.35, 1.2);
    tone("doorCreak", 0.3, 0.7);
  } else if (e.type === "pickMove") tone("tickSoft", 0.3, 1.2);
  else if (e.type === "intro") tone("ghoulStageIntro", 0.6);
  else if (e.type === "bossIntro") tone("ghoulBossIntro", 0.75);
  // The intro story (ghoul-story.js): a page turns, a timed sound, the last page opens the hall.
  else if (e.type === "storyPage") e.page && tone("ghoulStoryPage", 0.3);
  else if (e.type === "storyTone") tone(e.name, e.vol, e.rate);
  else if (e.type === "storyEnd") flash("#fff3c4", 320);
  else if (e.type === "stage") {
    tone("doorUnlock", 0.5);
    tone("ghoulThunder", 0.4, 0.9);
    flash("#d9e4ff", 260);
  } else if (e.type === "bossBlock") {
    if (gate(fx, "blockMs", 120)) tone("clank", 0.3, 1.4);
    burst(e.x, e.y, "#b4bcc3", 3, 8, 220);
  } else if (e.type === "throw") {
    // A skeleton's own throw, a volley's once for its three bones; acid
    // (the Bloater's and the Gourd's spit already said) just flies.
    if (e.by === "skeleton" || (e.by === "bones" && gate(fx, "volleyMs", 100))) say(tone, e.by, "throw", 0.4);
    else if (e.by === "villager") say(tone, "villager", "throw", 0.4);
    else if (e.kind === "barbell") { /* the strongman's own throw sound (ghoul-carnival-draw.js) */ }
    else if (e.by !== "bones") tone("swoosh", 0.15, e.kind === "acid" ? 0.7 : 1.2);
  } else if (!DICE.react(e, k) && !BONUS.react(e, k)) ART.react(e, k);
  if (e.type === "lose" || e.type === "respawn") fx.combo = null;
}

// A pitch a little either side of 1 (a share `n` wide), so a sound heard
// again and again never repeats exactly. Only the sound's pitch: never state.
const vary = (n = 0.1) => 1 - n / 2 + Math.random() * n;

// Whether a sound kept to one every `ms` may play now (it then waits its
// turn): a room waking several monsters at once, or a boss under fire.
function gate(fx, key, ms) {
  if ((fx[key] || 0) > fx.clock) return false;
  fx[key] = fx.clock + ms;
  return true;
}

// Each kind's own voice, by what it does (the sounds in ghoul-sfx.js): it
// comes in (`appear`; a runner's `warn`, a bat's `wake`, a wraith's
// `notice`), climbs or hops, growls, lunges, shrieks, dives, spits, throws,
// takes a hit (`hurt`) and dies; a boss wakes, hops, slams and winds up.
export const VOICES = Object.freeze({
  zombie: Object.freeze({ appear: "ghoulZombieAppear", climb: "ghoulZombieClimb", hurt: "ghoulZombieHurt", die: "ghoulZombieDie" }),
  runner: Object.freeze({ warn: "ghoulRunnerWarn", climb: "ghoulRunnerClimb", die: "ghoulRunnerDie" }),
  glutton: Object.freeze({ appear: "ghoulGluttonAppear", hurt: "ghoulGluttonHurt", die: "ghoulGluttonDie" }),
  crawler: Object.freeze({ appear: "ghoulCrawlerAppear", climb: "ghoulCrawlerClimb", hurt: "ghoulCrawlerHurt", die: "ghoulCrawlerDie" }),
  bat: Object.freeze({ wake: "ghoulBatWake", hurt: "ghoulBatHurt", die: "ghoulBatDie" }),
  ghost: Object.freeze({ appear: "ghoulGhostAppear", hurt: "ghoulGhostHurt", die: "ghoulGhostDie" }),
  wraith: Object.freeze({ notice: "ghoulWraithNotice", shriek: "ghoulWraithShriek", dive: "ghoulWraithDive", hurt: "ghoulWraithHurt", die: "ghoulWraithDie" }),
  skeleton: Object.freeze({ appear: "ghoulSkeletonAppear", throw: "ghoulSkeletonThrow", hurt: "ghoulSkeletonHurt", die: "ghoulSkeletonDie" }),
  seed: Object.freeze({ appear: "ghoulGourdlingAppear", hop: "ghoulGourdlingHop", die: "ghoulGourdlingDie" }),
  hound: Object.freeze({ appear: "ghoulHoundAppear", growl: "ghoulHoundGrowl", lunge: "ghoulHoundLunge", hurt: "ghoulHoundHurt", die: "ghoulHoundDie" }),
  spider: Object.freeze({ appear: "ghoulWidowAppear", hurt: "ghoulWidowHurt", die: "ghoulWidowDie" }),
  huntsman: Object.freeze({ appear: "ghoulHuntsmanAppear", growl: "ghoulHuntsmanGrowl", lunge: "ghoulHuntsmanLunge", hurt: "ghoulHuntsmanHurt", die: "ghoulHuntsmanDie" }),
  spitter: Object.freeze({ appear: "ghoulBloaterAppear", spit: "ghoulBloaterSpit", hurt: "ghoulBloaterHurt", die: "ghoulBloaterDie" }),
  gourd: Object.freeze({ wake: "ghoulGourdWake", hop: "ghoulGourdHop", slam: "ghoulGourdSlam", spit: "ghoulGourdSpit", hurt: "ghoulGourdHurt", die: "ghoulGourdDie" }),
  bones: Object.freeze({ wake: "ghoulBonesWake", windup: "ghoulBonesWindup", throw: "ghoulBonesThrow", slam: "ghoulBonesSlam", hurt: "ghoulBonesHurt", die: "ghoulBonesDie" }),
  // The Graveyard's.
  hands: Object.freeze({ appear: "ghoulHandsAppear", grab: "ghoulHandsGrab", hurt: "ghoulHandsHurt", die: "ghoulHandsDie" }),
  mourner: Object.freeze({ appear: "ghoulMournerAppear", wail: "ghoulMournerWail", hurt: "ghoulMournerHurt", die: "ghoulMournerDie" }),
  robber: Object.freeze({ appear: "ghoulRobberAppear", dig: "ghoulRobberDig", unearth: "ghoulRobberUnearth", hurt: "ghoulRobberHurt", die: "ghoulRobberDie" }),
  rotter: Object.freeze({ appear: "ghoulRotterAppear", climb: "ghoulRotterClimb", hurt: "ghoulRotterHurt", die: "ghoulRotterDie" }),
  legs: Object.freeze({ appear: "ghoulLegsAppear", die: "ghoulLegsDie" }),
  crow: Object.freeze({ wake: "ghoulCrowWake", dive: "ghoulCrowDive", hurt: "ghoulCrowHurt", die: "ghoulCrowDie" }),
  ...GROUNDS_VOICES,
  ...CHAPEL_VOICES,
  ...SANATORIUM_VOICES,
  ...VILLAGE_VOICES,
  ...MINE_VOICES,
  ...CART_VOICES,
  ...SLED_VOICES,
  ...BANISTER_VOICES,
  ...HEARSE_VOICES,
  ...GURNEY_VOICES,
  ...PEW_VOICES,
  ...MOWER_VOICES,
  ...TRAY_VOICES,
  ...WAGON_VOICES,
  ...CARNIVAL_VOICES,
  ...FROZEN_VOICES,
  ...RIDE_VOICES,
  angel: Object.freeze({ wake: "ghoulAngelWake", weep: "ghoulAngelWeep", watch: "ghoulAngelWatch", see: "ghoulAngelSee", slam: "ghoulAngelSlam", wings: "ghoulAngelWings", hurt: "ghoulAngelHurt", die: "ghoulAngelDie" }),
  ...BOG_VOICES,
  ...LANTERN_VOICES,
});
// Plays a kind's voice for an act, if it has one, its pitch a touch varied.
function say(tone, kind, act, level) {
  const name = VOICES[kind] && VOICES[kind][act];
  if (name) tone(name, level, vary(0.08));
}
// Each power-up's own reward, beside the shared grab.
const POWER_SOUNDS = Object.freeze({ spread: "powerUp", rapid: "powerUp", garlic: "shieldUp", life: "extraLife", lantern: "powerUp", wings: "powerUp", bell: "bell", hourglass: "driveClock", silver: "powerUp", shears: "powerUp", holy: "powerUp", salts: "powerUp", saw: "powerUp", bane: "powerUp" });
// How each way of dying sounds, beside the crash: [name, level, pitch].
const LOSE_SOUNDS = Object.freeze({
  time: ["ghoulToll", 0.6, 0.7],
  pit: ["ghoulPitFall", 0.55, 1],
  bone: ["clank", 0.5, 0.7],
  chandelier: ["smash", 0.6, 0.9],
  acid: ["ghoulSizzle", 0.5, 0.8],
  wave: ["thud", 0.6, 0.8],
  hound: ["crunch", 0.55, 0.8],
  spider: ["squish", 0.5, 0.9],
  wraith: ["wail", 0.35, 0.5],
  zombie: ["crunch", 0.5, 1],
  seed: ["squish", 0.5, 1.2],
  gourd: ["splat", 0.6, 0.5],
  bones: ["crunch", 0.6, 0.7],
  hands: ["squish", 0.5, 0.7],
  stone: ["clank", 0.55, 0.5],
  fist: ["smash", 0.7, 0.6],
  angel: ["smash", 0.6, 0.5],
  ...BONES_LOSE_SOUNDS,
  ...GROUNDS_LOSE_SOUNDS,
  ...CHAPEL_LOSE_SOUNDS,
  ...SANATORIUM_LOSE_SOUNDS,
  ...VILLAGE_LOSE_SOUNDS,
  ...MINE_LOSE_SOUNDS,
  ...CARNIVAL_LOSE_SOUNDS,
  ...FROZEN_LOSE_SOUNDS,
  ...CART_LOSE_SOUNDS,
  ...SLED_LOSE_SOUNDS,
  ...BANISTER_LOSE_SOUNDS,
  ...HEARSE_LOSE_SOUNDS,
  ...GURNEY_LOSE_SOUNDS,
  ...PEW_LOSE_SOUNDS,
  ...MOWER_LOSE_SOUNDS,
  ...TRAY_LOSE_SOUNDS,
  ...WAGON_LOSE_SOUNDS,
  ...RIDE_LOSE_SOUNDS,
  ...BOG_LOSE_SOUNDS,
  ...LANTERN_LOSE_SOUNDS,
});
// The door's boom in each of the eight rooms, the Crypt deepest.
const ROOM_PITCH = Object.freeze([1, 1.1, 0.95, 1.2, 1.05, 1.15, 0.9, 0.75]);

/* ------------------------------------------------------------- the pills */

const pillWidth = (h, text) => h * 0.7 + text.length * h * 0.42;

function pill(ctx, x, y, h, text, color, fill = 1) {
  ctx.font = `800 ${h * 0.62}px ${SANS}`;
  const w = pillWidth(h, text);
  drawPill(ctx, x, y, w, h, text, color, fill, y + h * 0.54);
  return w;
}

// The blaster's gauge, GAUGE_W pill heights wide: its label, then the bar.
export const GAUGE_W = 9;
const GAUGE_LABEL_W = 2.9;
// The bar's fill: pale flashlight while the bolts fly at the full rate, amber
// as the notch nears, red once they slow; Rapid fire's own color while it runs.
export const GAUGE_COOL = "#ffe9a8";
export const GAUGE_WARM = "#ff8a1f";
export const GAUGE_HOT = "#e2553f";
const GAUGE_WARN = 0.75;

// The gauge's fill color for heat `fill` (0 to 1) with the notch at `free`.
export function gaugeColor(fill, free, rapid = null) {
  if (rapid) return rapid;
  if (fill > free) return GAUGE_HOT;
  return fill >= free * GAUGE_WARN ? GAUGE_WARM : GAUGE_COOL;
}

// Where the pills go, `h` units tall in a strip `stripH` tall on a board `W`
// wide: the stage's name and how many stages are cleared, lives, the time
// bonus, the chain while it runs, the key once held, and the power-ups held,
// from the left, and the blaster's gauge (when `hud.gauge` is set) kept at
// the right end of the first row. A pill that would run into the gauge or
// off the board starts a row below, and the rows sit in the strip's middle.
// The strip holds one row, so a row that would leave it (a long stage name
// with everything showing) shrinks every pill a step at a time until it fits.
// Only past HUD_SHRINK_MIN (the smallest boards with everything showing) does
// a second row spill below the strip, over the top of the field, where
// drawScene paints it last so it is never drawn over. Nothing overlaps. Each
// pill carries its height `h`.
export function hudLayout(h, W, lives, hud, stripH) {
  let k = 1;
  let laid = layPills(h, W, lives, hud, stripH);
  while (laid.over && k > HUD_SHRINK_MIN) {
    k = Math.max(HUD_SHRINK_MIN, k * HUD_SHRINK);
    laid = layPills(h * k, W, lives, hud, stripH);
  }
  return laid.out;
}
const HUD_SHRINK = 0.92;
const HUD_SHRINK_MIN = 0.6;

function layPills(h, W, lives, hud, stripH) {
  const gap = h * 0.3;
  const edge = h * 0.4;
  const y0 = h * 0.35;
  const out = [];
  const gw = hud.gauge ? GAUGE_W * h : 0;
  // The secondary weapon's pill keeps its own spot, against the gauge.
  const aw = hud.arm ? h * 1.36 + hud.arm.text.length * h * 0.42 : 0;
  const held = (gw ? gw + gap : 0) + (aw ? aw + gap : 0);
  let x = edge;
  let y = y0;
  const put = (text, color, fill = 1) => {
    const w = pillWidth(h, text);
    const right = W - edge - (y === y0 ? held : 0);
    if (x > edge && x + w > right) {
      x = edge;
      y += h + gap;
    }
    out.push({ x, y, w, h, text, color, fill });
    x += w + gap;
  };
  put(hud.room, "#ffffff");
  if (hud.stage) put(hud.stage, "#ffffff");
  put(livesText(lives), LIVES);
  if (hud.time > 0) put(`TIME ${hud.time}`, hud.timeLow ? DANGER : "#ffffff");
  if (hud.hearts) put(hud.hearts, GOLD);
  else put(`BONUS ${hud.bonus}`, hud.bonus > 0 ? GOLD : DANGER);
  if (hud.chain > 1) put(`CHAIN x${hud.chain}`, GOLD, hud.chainFill);
  if (hud.key) {
    out.push({ x, y, w: h * 1.5, h, key: hud.key, color: GOLD });
    x += h * 1.5 + gap;
  }
  for (const e of hud.effects) put(e.text, e.color, e.fill);
  if (gw) out.push({ x: W - edge - gw, y: y0, w: gw, h, gauge: true });
  if (aw) out.push({ x: W - edge - (gw ? gw + gap : 0) - aw, y: y0, w: aw, h, arm: true, text: hud.arm.text });
  const drop = Math.max(0, (stripH - (y + h) - y0) / 2);
  for (const p of out) p.y += drop;
  return { out, over: y + h > stripH };
}

function drawHud(ctx, v) {
  const { g, colors } = v;
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, g.W, g.HUD_H);
  ctx.fillStyle = colors.line;
  ctx.fillRect(0, g.HUD_H - 0.25, g.W, 0.25);
}

// The pills, painted after the field so a row spilled below the strip (the
// smallest boards only) sits over the field rather than under it.
function drawPills(ctx, v) {
  const { g } = v;
  if (v.state !== "running" && v.state !== "paused") return;
  for (const p of hudLayout(v.pillH, g.W, v.round.infinite ? Infinity : v.round.lives, v.hud, g.HUD_H)) {
    if (p.gauge) drawGauge(ctx, p.x, p.y, p.w, p.h, v.hud.gauge, v.clock);
    else if (p.arm) ART.armPill(ctx, p, v, SANS);
    else if (p.key) drawKeyPill(ctx, p, v.clock);
    else pill(ctx, p.x, p.y, p.h, p.text, p.color, p.fill);
  }
}

// The room's key in the strip: a gold key on a pill once it is found, a dotted
// outline of one (dim, waiting) until then.
function drawKeyPill(ctx, p, clock) {
  const { x, y, w, h } = p;
  const have = p.key === "have";
  ctx.fillStyle = PILL;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x + w / 2, y + h * 0.52);
  const u = h * 0.34;
  ctx.rotate(-0.6);
  ctx.beginPath();
  ctx.arc(-u * 1.05, 0, u * 0.7, 0, Math.PI * 2);
  ctx.moveTo(-u * 0.35, 0);
  ctx.lineTo(u * 1.35, 0);
  ctx.moveTo(u * 0.85, 0);
  ctx.lineTo(u * 0.85, u * 0.7);
  ctx.moveTo(u * 1.35, 0);
  ctx.lineTo(u * 1.35, u * 0.7);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (have) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = u * 0.5;
    ctx.stroke();
  } else {
    ctx.globalAlpha = 0.5 + 0.12 * Math.sin(clock / 400);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = u * 0.34;
    ctx.setLineDash([u * 0.45, u * 0.55]);
    ctx.stroke();
  }
  ctx.restore();
}

// The blaster's gauge: LIGHT on the pill's dark backing, then a bar that
// fills as the blaster heats and empties as it cools, with a notch where the
// bolts start to slow and the stretch past it tinted red. Past the notch the
// label reads HOT and the bar throbs, so a glance says to let go.
function drawGauge(ctx, x, y, w, h, gauge, clock = 0) {
  const { fill, free, rapid } = gauge;
  const hot = !rapid && fill > free;
  const color = gaugeColor(fill, free, rapid);
  ctx.fillStyle = PILL;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.font = `800 ${h * 0.5}px ${SANS}`;
  ctx.fillStyle = pillInk(hot ? GAUGE_HOT : rapid || GAUGE_COOL);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(hot ? "HOT" : "LIGHT", x + (GAUGE_LABEL_W * h) / 2 + h * 0.15, y + h * 0.54);
  const bx = x + GAUGE_LABEL_W * h;
  const bw = w - GAUGE_LABEL_W * h - h * 0.4;
  const bh = h * 0.42;
  const by = y + (h - bh) / 2;
  const notch = bx + bw * free;
  // The track, and the slow stretch past the notch faintly red.
  ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
  roundRect(ctx, bx, by, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = "rgba(226, 85, 63, 0.28)";
  ctx.fillRect(notch, by, bx + bw - notch - bh / 2, bh);
  if (fill > 0) {
    ctx.globalAlpha = hot ? 0.75 + 0.25 * Math.sin(clock / 70) : 1;
    ctx.fillStyle = color;
    roundRect(ctx, bx, by, Math.max(bh, bw * Math.min(1, fill)), bh, bh / 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(notch - h * 0.04, by - h * 0.12, h * 0.08, bh + h * 0.24);
}

// A banner is a shaded strip across the field, placed away from Planny.
function drawBanner(ctx, v, b) {
  const { g } = v;
  const w = g.FIELD_W;
  const p = 1 - b.life / b.max;
  const pop = p < 0.12 ? 0.6 + (p / 0.12) * 0.55 : p < 0.22 ? 1.15 - ((p - 0.12) / 0.1) * 0.15 : 1;
  ctx.globalAlpha = (p > 0.82 ? Math.max(0, (1 - p) / 0.18) : 1) * b.see;
  const y = Math.min(g.FIELD_H - 7, Math.max(7, b.y));
  ctx.fillStyle = BANNER_SHADE;
  ctx.fillRect(0, y - 7, w, 14);
  if (b.tag) label(ctx, b.tag, w / 2, y - 4.6, 2.1, GOLD, "center", w - 4);
  label(ctx, b.title, w / 2, y - 0.4, 4.4 * pop, b.color, "center", w - 4, true);
  if (b.sub) label(ctx, b.sub, w / 2, y + 4.2, 2.3, "#ffffff", "center", w - 4);
  ctx.globalAlpha = 1;
}

// The ready and over screens' strip along the bottom of the field: a line
// or two, then a dot per stage, lit in its color for each cleared this run
// (in gold, before a run, for as many as the record). The over
// screen adds the round's score, big, above it.
function drawTally(ctx, v, lines) {
  const { g } = v;
  const top = g.FIELD_H - 17;
  if (v.big) {
    ctx.fillStyle = SCORE_SHADE;
    ctx.fillRect(0, top - 12, g.FIELD_W, 11.6);
    label(ctx, "SCORE", g.FIELD_W / 2, top - 10.2, 2, "#ffffff");
    label(ctx, v.big, g.FIELD_W / 2, top - 5, 7, GOLD);
  }
  ctx.fillStyle = SHADE;
  ctx.fillRect(0, top, g.FIELD_W, 17);
  lines.forEach((text, i) => label(ctx, text, g.FIELD_W / 2, top + 3.4 + i * 4.2, i ? 2 : 2.5, i ? "#ffffff" : GOLD, "center", g.FIELD_W - 4));
  const n = v.dots.length;
  const r = 1.2;
  const step = r * 3.4;
  const x = g.FIELD_W / 2 - ((n - 1) * step) / 2;
  for (let k = 0; k < n; k++) {
    circle(ctx, x + k * step, top + 13.2, r);
    const dot = v.dots[k];
    if (dot) {
      const st = v.stageById(dot);
      ctx.fillStyle = st ? stageColor(st) : dot;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 0.25;
      ctx.stroke();
    } else {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 0.3;
      ctx.stroke();
    }
  }
}

/* -------------------------------------------------------- the stages */

// The choice of stage, the stage select and each stage's color (ghoul-picker-draw.js).
const { drawPicker, drawSelect, stageColor } = pickerArt({ lookOf, label, roundRect, circle, BOSS_ART, drawGourdFire, GOLD });
const BOSS_CARD = bossIntroArt({ label, circle, BOSS_ART, drawGourdFire, GOLD, BONE });

/* --------------------------------------------------------------- scene */

// A bonus room's hearts, a row near the field's bottom left: a red heart for each
// one left, a dark outline for each one lost, the last one beating.
function drawBonusHearts(ctx, v) {
  const b = v.round.bonusRound;
  const y = v.g.FIELD_H - 2.6;
  for (let i = 0; i < b.max; i++) {
    const full = i < b.hearts;
    const beat = b.hearts === 1 && full ? 1 + Math.abs(Math.sin(v.clock / 140)) * 0.2 : 1;
    const x = 3.6 + i * 3.1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(beat * 1.5, beat * 1.5);
    ctx.beginPath();
    ctx.moveTo(0, 0.7);
    ctx.bezierCurveTo(-1.1, -0.1, -0.6, -0.9, 0, -0.35);
    ctx.bezierCurveTo(0.6, -0.9, 1.1, -0.1, 0, 0.7);
    ctx.globalAlpha = 1;
    ctx.fillStyle = full ? "#e8283a" : "rgba(42, 20, 24, 0.75)";
    ctx.fill();
    ctx.strokeStyle = full ? "#ffb0b6" : "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 0.1;
    ctx.stroke();
    ctx.restore();
  }
}

const eyesBuf = [];

// The whole frame. `v` is the view ghoul.js refills: the round and its
// room, the board's geometry `g`, the scale `u`, the colors, the effects,
// the state, the pill numbers, the lightning and the lines for the start
// and end screens.
export function drawScene(ctx, v) {
  const { g, round } = v;
  const Y = (y) => g.FIELD_H - y;
  eyesBuf.length = 0;
  v.eyes = eyesBuf;
  ctx.save();
  ctx.scale(v.u, v.u);
  ctx.fillStyle = v.colors.board;
  ctx.fillRect(0, 0, g.W, g.H);
  drawHud(ctx, v);
  ctx.translate(g.PAD, g.HUD_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, g.FIELD_W, g.FIELD_H);
  if (typeof ctx.clip === "function") ctx.clip();
  // The Carnival's dark ride is a shooting gallery drawn whole by its own art, under the
  // with the words of a heart lost and the lost card over it (the won card is the ride's own cascade; its title is its intro, so no banner).
  if (round.gallery) {
    RIDE.field(ctx, v);
    for (const f of v.fx.floats) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      const at = labelSpot(f.text, f.x, Y(f.y) - f.rise, f.size, g.FIELD_W, g.FIELD_H);
      label(ctx, f.text, at.x, at.y, f.size, f.color, "center", at.max);
    }
    ctx.globalAlpha = 1;
    if (v.state === "running" && round.phase === "clear" && !(round.bonusRound && round.bonusRound.won)) BONUS.card(ctx, v);
    ctx.restore();
    ctx.translate(-g.PAD, -g.HUD_H);
    drawPills(ctx, v);
    ctx.restore();
    return;
  }
  // Holy Roller is an endless-runner drawn whole by its own art (ghoul-pew-draw.js): the nave in pseudo-3D from behind the
  // pew. The hearts, the flash, the banner, the cards and the HUD pills go over it as they do over the dark ride.
  if (round.runner && (round.runner.id === "pew" || round.runner.id === "lantern")) {
    PACK_ART[round.runner.id].field(ctx, v);
    for (const f of v.fx.floats) {
      ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
      const at = labelSpot(f.text, f.x, Y(f.y) - f.rise, f.size, g.FIELD_W, g.FIELD_H);
      label(ctx, f.text, at.x, at.y, f.size, f.color, "center", at.max);
    }
    ctx.globalAlpha = 1;
    if (round.bonusRound && (v.state === "running" || v.state === "paused")) drawBonusHearts(ctx, v);
    if (v.flash) {
      ctx.globalAlpha = 0.24 * (v.flash.life / v.flash.max);
      ctx.fillStyle = v.flash.color;
      ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
      ctx.globalAlpha = 1;
    }
    if (v.state === "running" && round.phase === "clear") BONUS.card(ctx, v);
    if (v.state === "running" && v.banner && round.phase !== "pick" && round.phase !== "select" && round.phase !== "roll" && round.phase !== "ask") drawBanner(ctx, v, v.banner);
    if (v.state === "running" && v.fx.lucky) DICE.lucky(ctx, v);
    ctx.restore();
    ctx.translate(-g.PAD, -g.HUD_H);
    drawPills(ctx, v);
    ctx.restore();
    return;
  }
  const cam = Math.round(round.camX * 8) / 8;
  if (v.shake) ctx.translate(v.shake.x, v.shake.y);
  ctx.translate(-cam, 0);
  ART.sky(ctx, v, cam);
  const k0 = Math.max(0, Math.floor(cam / CHUNK));
  const k1 = Math.floor((cam + g.FIELD_W) / CHUNK);
  let copied = true;
  for (let k = k0; k <= k1; k++) {
    const layer = stillLayer(ctx, v, k);
    if (!layer) {
      copied = false;
      break;
    }
    ctx.drawImage(layer, k * CHUNK, 0, CHUNK + SEAM, g.FIELD_H);
  }
  if (!copied) drawStill(ctx, v, cam - 2, cam + g.FIELD_W + 2);
  ART.moving(ctx, v, cam);
  drawMoving(ctx, v);
  // Stains where things died, soaking into the floor.
  for (const s of v.fx.splats) {
    ctx.globalAlpha = Math.min(1, s.life / 2500) * 0.85;
    ctx.fillStyle = s.color;
    ellipse(ctx, s.x, Y(s.y) + 0.15, s.r, s.r * 0.22);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawExit(ctx, v);
  drawPickups(ctx, v);
  drawBoss(ctx, v);
  drawMonsters(ctx, v);
  drawPlanny(ctx, v);
  ART.front(ctx, v);
  for (const p of v.fx.parts) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, Y(p.y) - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  drawDark(ctx, v, cam);
  drawGlowing(ctx, v);
  for (const r of v.fx.rings) {
    const p = 1 - r.life / r.max;
    ctx.globalAlpha = (1 - p) * 0.8;
    circle(ctx, r.x, Y(r.y), r.r0 + p * r.grow);
    ctx.strokeStyle = EDGE_DARK;
    ctx.lineWidth = 0.5 * (1 - p) + 0.45;
    ctx.stroke();
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 0.5 * (1 - p) + 0.15;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.translate(cam, 0);
  if (v.shake) ctx.translate(-v.shake.x, -v.shake.y);
  for (const f of v.fx.floats) {
    ctx.globalAlpha = Math.min(1, (f.life / f.max) * 1.6);
    const at = labelSpot(f.text, f.x - cam, Y(f.y) - f.rise, f.size, g.FIELD_W, g.FIELD_H);
    label(ctx, f.text, at.x, at.y, f.size, f.color, "center", at.max);
  }
  ctx.globalAlpha = 1;
  // A bonus room's hearts along the bottom, as the dark ride keeps its own.
  if (round.bonusRound && (v.state === "running" || v.state === "paused")) drawBonusHearts(ctx, v);
  // The chain's multiplier, big, beside Planny while it is fresh.
  if (v.combo && v.state === "running") {
    const you = round.you;
    const p = 1 - v.combo.life / v.combo.max;
    ctx.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
    const text = `x${v.combo.mult}`;
    const size = 5 * (p < 0.15 ? 0.7 + p * 2 : 1);
    const sx = you.x - cam;
    const at = labelSpot(text, sx + (sx < g.FIELD_W / 2 ? 9 : -9), Y(you.y) - 7, size, g.FIELD_W, g.FIELD_H);
    label(ctx, text, at.x, at.y, size, GOLD, "center", at.max);
    ctx.globalAlpha = 1;
  }
  if (v.state === "running" || v.state === "paused") drawBossBar(ctx, v);
  // On the last life the edges pulse red, like a heartbeat.
  if (v.state === "running" && round.lives === 1) {
    const beat = Math.max(0, Math.sin(v.clock / 160)) ** 6;
    ctx.globalAlpha = 0.06 + 0.12 * beat;
    ctx.fillStyle = "#a00000";
    ctx.fillRect(0, 0, g.FIELD_W, 2);
    ctx.fillRect(0, g.FIELD_H - 2, g.FIELD_W, 2);
    ctx.fillRect(0, 0, 2, g.FIELD_H);
    ctx.fillRect(g.FIELD_W - 2, 0, 2, g.FIELD_H);
    ctx.globalAlpha = 1;
  }
  if (v.flash) {
    ctx.globalAlpha = 0.24 * (v.flash.life / v.flash.max);
    ctx.fillStyle = v.flash.color;
    ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
    ctx.globalAlpha = 1;
  }
  if (v.state === "running" && round.phase === "roll") DICE.roll(ctx, v);
  if (v.state === "running" && round.phase === "ask") DICE.ask(ctx, v);
  if (v.state === "running" && round.phase === "clear") BONUS.card(ctx, v);
  if (v.state === "running" && v.banner && round.phase !== "pick" && round.phase !== "select" && round.phase !== "roll" && round.phase !== "ask") drawBanner(ctx, v, v.banner);
  if (v.state === "running" && v.fx.lucky) DICE.lucky(ctx, v);
  if ((v.state === "running" || v.state === "paused") && round.phase === "pick" && round.offer) drawPicker(ctx, v);
  if ((v.state === "running" || v.state === "paused") && round.phase === "select" && round.select) drawSelect(ctx, v);
  if ((v.state === "running" || v.state === "paused") && round.phase === "intro") INTRO_CARD(ctx, v);
  if ((v.state === "running" || v.state === "paused") && round.phase === "bossintro") BOSS_CARD(ctx, v);
  if ((v.state === "running" || v.state === "paused") && round.phase === "story") STORY_CARD(ctx, v);
  if (v.state === "over" && v.lost && !v.won) OVER_BANNER(ctx, v);
  if (v.tally) drawTally(ctx, v, v.tally);
  ctx.restore();
  ctx.translate(-g.PAD, -g.HUD_H);
  drawPills(ctx, v);
  ctx.restore();
}
