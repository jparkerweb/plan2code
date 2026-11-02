// Plan2Code Web Console - Ghoul Rush's Hollow End Village stage, its drawing: the rooms' looks (a moonlit street, square and green under the night sky, and the Crooked Inn), the torch mob's villagers (angry peasants who, at full moon, shudder and tear into wolf-men), hanged men on their ropes, shutter ghouls bursting out of windows, moonhounds with a glowing mane when grown, the Beast of Hollow End (a huge werewolf: clinging to a wall, leaping, pouncing under its shadow, swiping, howling, raging), the torch and its fire, Wolfsbane's badge, and what each of its events looks and sounds like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and
// LOSE_SOUNDS are plain data (the voices borrow the house's, the Graveyard's,
// the Grounds' and the Sanatorium's tones until the stage's own sounds are
// picked); villageArt(d) takes ghoul-draw.js's own drawing helpers (`d`) and
// hands back the drawing by kind, so this file never reaches back into it. The
// world (sky and moon, houses, floors, shelves) is ghoul-village-world.js and
// the werewolf's skeleton ghoul-village-wolf.js. Everything is drawn in room
// units, the way ghoul-draw.js draws: y counted down from the field's top, a
// monster from (x, y) at its feet. What the art reads off the rules
// (ghoul-village.js):
//
// - `round.twist` ({ moon, full, ms }, null in a room with no moon): `moon` is
//   the moon's progress, 0 to 1, `full` whether it is full (the villagers turn
//   and the hounds grow).
// - a villager: `m.act` ("walk", "wind" while it swings a torch with `m.windup`
//   ms to go, "turn" for the 800 ms it turns with `m.wait` ms left, then
//   "prowl", "crouch", "leap", "rest"), `m.turned`, `m.shy`; a moonhound:
//   `m.act` ("prowl", "crouch", "leap", "rest"), `m.grown`, `m.shy`.
// - a hanged man: `m.beam` (the beam's height), `m.rest` (where his feet hang
//   at rest), `m.act` ("sway", "warn", "drop", "hold", "haul"), `m.wait`, `m.y`.
// - a shutter ghoul: `m.hx`, `m.hy` (its window's foot), `m.ext` (0 to 1 out of
//   it), `m.rx`, `m.ry` (where it reaches), `m.act` ("hide", "rattle", "lunge",
//   "out", "pull").
// - the Beast: `b.act` ("idle", "bound", "cling", "pounce", "crouch", "rest",
//   "swipeWind", "howl"), `b.side` (the wall it bounds to, -1 left, 1 right),
//   `b.dir`, `b.wait` (ms left of a wind-up or howl), `b.fly` ({ x0, y0, x1, y1,
//   T, t, arc }), `b.raged`, `b.swipeCool` (it has just swiped while it is
//   near 1500).
// - hazards: `torchfire` ({ x, y, w, h, live, max }), `shadow` ({ x, y, w,
//   warn, total }: the Beast's landing), `claw` ({ x, y, w, h, dir, live, max }).
// - the `torch` missile (`b.spin`).

import { gradient, villageWorld } from "./ghoul-village-world.js";
import { POSES, mixPose, wolfKit } from "./ghoul-village-wolf.js";
import { HOWL_MS, SWIPE_COOL_MS, SWIPE_WIND_MS, VILLAGER_TURN_MS } from "./ghoul-village.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const ease = (p) => p * p * (3 - 2 * p);

// Out under the night sky: the "wall" is the sky (`wallTop` to `wallLow`),
// `paper` the roofs, `wainscot` the house fronts, `window` the moon and the
// lit windows; `pack` names this file's drawing for ghoul-draw.js (the sky, the
// houses and the floors are drawn by the world, so the colors here are the
// stage's card and what the generic floor falls back on). The inn is a custom
// room too, indoors. `village` marks the stage's picture on its card.
const night = (o) => freeze({ wallTop: "#06070f", wallLow: "#26283a", paper: "#14151f", wainscot: "#0c0c14", floorTop: "#4a4338", floor: "#2a2420", floorEdge: "#0c0a08", shelf: "#4a3826", shelfTop: "#7a5a3a", pit: "#020202", window: "#f0e8d0", decor: "pots", dark: 0.8, outdoor: true, pack: "village", village: true, ...o });
export const LOOKS = freeze({
  street: night({ color: "#e0b070", scene: "street" }),
  inn: freeze({ wallTop: "#140d0a", wallLow: "#2c1c14", paper: "#3a2618", wainscot: "#1c120c", floorTop: "#5a4026", floor: "#2c1e12", floorEdge: "#0e0805", shelf: "#4a2e18", shelfTop: "#7a5030", pit: "#020103", window: "#e8b060", decor: "pots", color: "#d8a050", dark: 0.84, custom: true, pack: "village", noMoon: true }),
  square: night({ color: "#b8b0d8", scene: "square", wallLow: "#2a2a40" }),
  green: night({ color: "#8fb070", scene: "green", floorTop: "#3a5a2c", floor: "#1c2a14", wallLow: "#22303a" }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-village.js).
// `villager.turn` is the change begun, `wolf` the wolf-man it has become, `wind` a torch swung;
// `moon.full` is the moon coming full and `bane.active` the Wolfsbane pickup.
export const VOICES = freeze({
  villager: freeze({ appear: "ghoulVillagerAppear", wind: "ghoulVillagerWind", throw: "ghoulVillagerThrow", land: "ghoulVillagerLand", turn: "ghoulVillagerTurn", wolf: "ghoulVillagerWolf", hurt: "ghoulVillagerHurt", die: "ghoulVillagerDie", growl: "ghoulHoundGrowl", lunge: "ghoulHoundLunge" }),
  hanged: freeze({ appear: "ghoulHangedAppear", warn: "ghoulHangedWarn", drop: "ghoulHangedDrop", snap: "ghoulHangedSnap", haul: "ghoulHangedHaul", hurt: "ghoulHangedHurt", die: "ghoulHangedDie" }),
  shutter: freeze({ appear: "ghoulShutterAppear", rattle: "ghoulShutterRattle", lunge: "ghoulShutterLunge", pull: "ghoulShutterPull", hurt: "ghoulShutterHurt", die: "ghoulShutterDie" }),
  moonhound: freeze({ appear: "ghoulMoonhoundAppear", growl: "ghoulMoonhoundGrowl", lunge: "ghoulMoonhoundLunge", grow: "ghoulMoonhoundGrow", shy: "ghoulMoonhoundShy", hurt: "ghoulMoonhoundHurt", die: "ghoulMoonhoundDie" }),
  beast: freeze({ wake: "ghoulBeastWake", leap: "ghoulBeastLeap", cling: "ghoulBeastCling", pounce: "ghoulBeastPounce", land: "ghoulBeastLand", swipeWind: "ghoulBeastSwipeWind", swipe: "ghoulBeastSwipe", howl: "ghoulBeastHowl", moon: "ghoulBeastMoon", hurt: "ghoulBeastHurt", weak: "ghoulBeastWeak", die: "ghoulBeastDie" }),
  moon: freeze({ full: "ghoulMoonFull" }),
  bane: freeze({ active: "ghoulBaneActive" }),
});

// What each of the pack's events plays: [kind, act], once. A hit, a kill, a
// spawn, a growl, a lunge, a torch thrown and a boss's wake, hit and fall are the
// game's own (they carry their kind). `houndCall` is quiet: the hounds' own
// arrival is heard as they spawn.
export const EVENT_VOICE = freeze({
  fullMoon: ["moon", "full"],
  villagerTurn: ["villager", "turn"],
  villagerWolf: ["villager", "wolf"],
  torchWind: ["villager", "wind"],
  torchLand: ["villager", "land"],
  houndGrow: ["moonhound", "grow"],
  baneShy: ["moonhound", "shy"],
  hangedWarn: ["hanged", "warn"],
  hangedDrop: ["hanged", "drop"],
  hangedSnap: ["hanged", "snap"],
  hangedHaul: ["hanged", "haul"],
  shutterRattle: ["shutter", "rattle"],
  shutterLunge: ["shutter", "lunge"],
  shutterPull: ["shutter", "pull"],
  beastLeap: ["beast", "leap"],
  beastCling: ["beast", "cling"],
  beastPounce: ["beast", "pounce"],
  beastLand: ["beast", "land"],
  swipeWind: ["beast", "swipeWind"],
  beastSwipe: ["beast", "swipe"],
  beastHowl: ["beast", "howl"],
  beastMoon: ["beast", "moon"],
});
// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({ villager: "Mobbed", hanged: "Strung up", shutter: "Shuttered", moonhound: "Savaged", beast: "Mauled by the Beast", torch: "Torched", claw: "Clawed" });
export const LOSE_SOUNDS = freeze({
  villager: ["crunch", 0.5, 0.9],
  hanged: ["thud", 0.5, 0.6],
  shutter: ["wail", 0.35, 0.8],
  moonhound: ["crunch", 0.55, 0.8],
  beast: ["smash", 0.6, 0.5],
  torch: ["ghoulSizzle", 0.5, 1],
  claw: ["crunch", 0.6, 0.6],
});

// The peasants' tunics, skins and the tools they carry.
const TUNICS = freeze(["#7a4a2c", "#4a5a3a", "#5a4a6a", "#8a6a3a", "#6a3a3a", "#3a5a6a"]);
const SKIN = "#d8b690";
const FIRE_RED = "#e2452a";
const FIRE_ORANGE = "#ff9a2e";
const FIRE_HOT = "#ffe27a";
const WOOD = "#5a3a1c";
const IRON = "#3a3a42";
const ROPE = "#8a7048";

export function villageArt(d) {
  const { ellipse, circle, line, say, FLASH, EYE_RED, EYE_AMBER, EYE_PALE, DANGER, GOLD } = d;
  const world = villageWorld(d);
  const wolf = wolfKit(d);
  const poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  const seg = (ctx, x0, y0, x1, y1, w, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.lineCap = "round";
    line(ctx, x0, y0, x1, y1);
    ctx.lineCap = "butt";
  };

  // A flame at (x, y) standing up, `s` big: red, orange and hot yellow tongues.
  function flame(ctx, x, y, s, t, seed) {
    for (const [color, k] of [[FIRE_RED, 1], [FIRE_ORANGE, 0.72], [FIRE_HOT, 0.42]]) {
      const fl = 0.8 + 0.2 * Math.sin(t / 70 + seed + k * 3);
      const hh = 1.6 * s * k * fl;
      const sway = Math.sin(t / 90 + seed) * 0.22 * s;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - 0.52 * s * k, y);
      ctx.quadraticCurveTo(x - 0.6 * s * k, y - hh * 0.55, x + sway, y - hh);
      ctx.quadraticCurveTo(x + 0.6 * s * k, y - hh * 0.5, x + 0.52 * s * k, y);
      ctx.fill();
    }
  }

  // A torch: a stick, a rag wound round its head, the flame.
  function torchAt(ctx, x, y, ang, t, seed, s = 1) {
    const tx = x + Math.cos(ang) * 1.55 * s;
    const ty = y + Math.sin(ang) * 1.55 * s;
    seg(ctx, x, y, tx, ty, 0.3 * s, WOOD);
    seg(ctx, tx - Math.cos(ang) * 0.5 * s, ty - Math.sin(ang) * 0.5 * s, tx, ty, 0.52 * s, "#2a1c12");
    flame(ctx, tx + Math.cos(ang) * 0.1, ty + Math.sin(ang) * 0.1, 0.9 * s, t, seed);
    return [tx, ty];
  }

  /* ---------------------------------------------------------- villagers */

  // A peasant in a local frame (feet at the origin, y down, facing +x): a patched
  // tunic and belt, a hat, an angry shouting face, a torch in the throwing hand
  // (swung back over the shoulder as it winds up) and a pitchfork or an axe in the
  // other. `o.lean` hunches him, `o.torch` hides the torch (dropped).
  function peasant(ctx, v, m, t, flash, o) {
    const id = m.id || 0;
    const tunic = flash ? FLASH : TUNICS[id % TUNICS.length];
    const trou = flash ? FLASH : "#3a3028";
    const skin = flash ? FLASH : SKIN;
    const wind = m.act === "wind" ? clamp(1 - (m.windup || 0) / 500, 0, 1) : 0;
    const sw = o.still ? 0 : Math.sin(t / 130) * 0.7;
    ctx.save();
    ctx.rotate(o.lean - wind * 0.1);
    // The far arm and its tool, behind.
    const tool = id % 3;
    seg(ctx, 0.2, -3.5, 1.3, -2.5, 0.55, flash ? FLASH : "#5a3a24");
    if (tool === 0) {
      seg(ctx, 0.9, -0.2, 2.0, -6.1, 0.2, WOOD);
      for (const dx of [-0.5, 0, 0.5]) seg(ctx, 2.0 + dx * 0.9, -6.1 - Math.abs(dx) * 0.2, 2.0 + dx * 1.05, -7.0, 0.14, IRON);
      seg(ctx, 1.5, -6.1, 2.5, -6.1, 0.2, IRON);
    } else if (tool === 1) {
      seg(ctx, 1.1, -1.4, 1.9, -5.6, 0.22, WOOD);
      poly(ctx, [[1.75, -5.7], [2.9, -5.9], [2.8, -4.7], [1.95, -4.9]]);
      ctx.fillStyle = IRON;
      ctx.fill();
    }
    ctx.fillStyle = skin;
    circle(ctx, 1.4, -2.5, 0.38);
    ctx.fill();
    // Legs: boots, trousers, a stride.
    seg(ctx, -0.1, -2.0, -0.4 - sw * 0.8, -0.2, 0.62, flash ? FLASH : "#2a2420");
    seg(ctx, -0.4 - sw * 0.8, -0.2, 0.1 - sw * 0.8, 0, 0.75, flash ? FLASH : "#1c1612");
    seg(ctx, 0.2, -2.0, 0.55 + sw * 0.8, -0.2, 0.62, trou);
    seg(ctx, 0.55 + sw * 0.8, -0.2, 1.05 + sw * 0.8, 0, 0.75, flash ? FLASH : "#1c1612");
    // The tunic, belted, a patch on it, a collar.
    ctx.fillStyle = tunic;
    poly(ctx, [[-0.8, -3.7], [0.95, -3.7], [1.1, -1.8], [-0.9, -1.8]]);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      poly(ctx, [[-0.8, -3.7], [-0.2, -3.7], [-0.3, -1.8], [-0.9, -1.8]]);
      ctx.fill();
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(-0.9, -2.5, 2, 0.28);
      ctx.fillStyle = "#c8a24a";
      ctx.fillRect(0.1, -2.53, 0.34, 0.34);
      ctx.fillStyle = "#a89870";
      ctx.fillRect(0.15, -3.3, 0.55, 0.55);
      ctx.fillStyle = "#d8cfae";
      poly(ctx, [[-0.45, -3.75], [0.55, -3.75], [0.1, -3.4]]);
      ctx.fill();
    }
    // The head and its hat.
    const hx = 0.3;
    const hy = -4.35;
    ctx.fillStyle = skin;
    circle(ctx, hx, hy, 0.85);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(190, 80, 70, 0.35)";
      circle(ctx, hx + 0.45, hy + 0.25, 0.26);
      ctx.fill();
      ctx.fillStyle = "rgba(40, 30, 24, 0.5)";
      for (let k = 0; k < 6; k++) ctx.fillRect(hx - 0.1 + (k % 3) * 0.3, hy + 0.35 + Math.floor(k / 3) * 0.2, 0.08, 0.08);
      // A shouting mouth, an eye under a furious brow.
      ctx.fillStyle = "#3a0a0a";
      ellipse(ctx, hx + 0.55, hy + 0.38, 0.3, 0.22 + Math.abs(Math.sin(t / 160)) * 0.1);
      ctx.fill();
      ctx.fillStyle = "#e8e4d4";
      ctx.fillRect(hx + 0.38, hy + 0.2, 0.3, 0.1);
      ctx.fillStyle = "#f4f0e0";
      circle(ctx, hx + 0.5, hy - 0.12, 0.2);
      ctx.fill();
      ctx.fillStyle = "#2a1408";
      circle(ctx, hx + 0.57, hy - 0.1, 0.1);
      ctx.fill();
      seg(ctx, hx + 0.12, hy - 0.52, hx + 0.8, hy - 0.28, 0.14, "#2a1c12");
      seg(ctx, hx + 0.92, hy + 0.05, hx + 1.0, hy + 0.12, 0.2, skin);
    }
    const hat = id % 3;
    ctx.fillStyle = flash ? FLASH : ["#5a4630", "#c8b070", "#3a3a4a"][hat];
    if (hat === 0) {
      poly(ctx, [[hx - 0.9, hy - 0.45], [hx + 0.95, hy - 0.5], [hx + 0.7, hy - 1.05], [hx - 0.6, hy - 1.1]]);
      ctx.fill();
      ctx.fillRect(hx + 0.3, hy - 0.62, 0.9, 0.18);
    } else if (hat === 1) {
      ellipse(ctx, hx, hy - 0.55, 1.35, 0.26);
      ctx.fill();
      poly(ctx, [[hx - 0.65, hy - 0.6], [hx - 0.5, hy - 1.25], [hx + 0.5, hy - 1.25], [hx + 0.65, hy - 0.6]]);
      ctx.fill();
    } else {
      // A hood pulled up, the face left open.
      ctx.beginPath();
      ctx.arc(hx - 0.05, hy - 0.05, 1.0, Math.PI * 0.55, Math.PI * 1.88);
      ctx.lineTo(hx + 0.6, hy - 0.62);
      ctx.lineTo(hx - 0.2, hy - 0.3);
      ctx.lineTo(hx - 0.35, hy + 0.45);
      ctx.closePath();
      ctx.fill();
    }
    // The near arm and its torch: held up, or swung back as the wind-up runs.
    const sh = [0.4, -3.5];
    const ha = -0.95 - wind * 1.75;
    const hand = [sh[0] + Math.cos(ha) * 1.35, sh[1] + Math.sin(ha) * 1.35];
    const el = [sh[0] + Math.cos(ha + 0.55) * 0.7, sh[1] + Math.sin(ha + 0.55) * 0.7 + 0.3];
    seg(ctx, sh[0], sh[1], el[0], el[1], 0.6, tunic);
    seg(ctx, el[0], el[1], hand[0], hand[1], 0.5, flash ? FLASH : "#5a3a24");
    ctx.fillStyle = skin;
    circle(ctx, hand[0], hand[1], 0.36);
    ctx.fill();
    if (o.torch) {
      const ang = -1.4 - wind * 1.5;
      const tip = torchAt(ctx, hand[0], hand[1], ang, t, id, 1);
      if (wind > 0.1) {
        // The torch's smoke trail behind the swing.
        ctx.strokeStyle = "rgba(255, 170, 70, 0.35)";
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        ctx.moveTo(tip[0], tip[1]);
        ctx.quadraticCurveTo(tip[0] + 0.8, tip[1] + 0.8, tip[0] + 1.8, tip[1] + 0.6);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // The poses of a turned villager, by act.
  function wolfPose(m, t) {
    let base;
    const walk = (P, ph, amp) => {
      const k = mixPose(P, P, 0);
      const swing = Math.sin(ph) * amp;
      const lift = Math.max(0, Math.cos(ph)) * amp;
      const lift2 = Math.max(0, -Math.cos(ph)) * amp;
      k.ln[1][0] += swing * 0.9;
      k.ln[2][0] += swing * 1.3;
      k.ln[3][0] += swing * 1.3;
      k.ln[3][1] += lift * 0.9;
      k.lf[1][0] -= swing * 0.9;
      k.lf[2][0] -= swing * 1.3;
      k.lf[3][0] -= swing * 1.3;
      k.lf[3][1] += lift2 * 0.9;
      k.an[2][0] -= swing * 0.9;
      k.an[1][0] -= swing * 0.4;
      k.af[2][0] += swing * 0.9;
      k.af[1][0] += swing * 0.4;
      k.chest[1] += Math.abs(Math.sin(ph)) * 0.15 * amp;
      return k;
    };
    if (m.shy) return walk(POSES.shy, t / 190, 0.5);
    if (m.act === "crouch") {
      const k = mixPose(POSES.crouch, POSES.crouch, 0);
      k.chest[1] += Math.sin(t / 24) * 0.06;
      k.jaw = 0.55;
      return k;
    }
    if (m.act === "leap") return { ...mixPose(POSES.leap, POSES.leap, 0) };
    if (m.act === "rest") {
      base = mixPose(POSES.rest, POSES.rest, 0);
      base.jaw = 0.35 + Math.abs(Math.sin(t / 150)) * 0.3;
      return base;
    }
    return walk(POSES.stand, t / 105, 1.1);
  }

  const WOLFMAN = 0.48;
  // A turned villager: the wolf figure at half size in the rags of his clothes.
  function wolfman(ctx, v, m, x, y, t, flash, alpha = 1, tr = 1) {
    const dir = m.dir || 1;
    const pose = wolfPose(m, t);
    let rot = 0;
    if (m.act === "leap") rot = Math.atan2(m.vy || 0, Math.abs(m.vx || 1)) * 0.75;
    if (alpha < 1) ctx.globalAlpha = alpha;
    wolf.figure(ctx, v, { x, y, dir, sc: WOLFMAN * (0.82 + 0.18 * tr), pose, t, style: flash ? "flash" : "wolfman", rot, rags: flash ? FLASH : TUNICS[(m.id || 0) % TUNICS.length], eyeR: 0.4 });
    ctx.globalAlpha = 1;
  }

  // The torch mob's villager: a peasant; turning, he shudders, drops his torch,
  // grows fur and a muzzle and tears his clothes (an 800 ms change drawn as the
  // peasant giving way to the wolf-man); turned, a wolf-man in rags.
  function villager(ctx, v, m, x, y, t, flash) {
    const q = m.act === "turn" ? 1 - clamp(m.wait, 0, VILLAGER_TURN_MS) / VILLAGER_TURN_MS : m.turned ? 1 : 0;
    const dir = m.dir || 1;
    if (q >= 1) return wolfman(ctx, v, m, x, y, t, flash);
    if (q <= 0) {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(dir, 1);
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ellipse(ctx, 0.1, -0.05, 1.5, 0.28);
        ctx.fill();
      }
      peasant(ctx, v, m, t, flash, { lean: 0, torch: true, still: false });
      ctx.restore();
      return;
    }
    // The turn: the peasant fades as the wolf-man rises in his place.
    const shake = Math.sin(t / 22) * 0.32 * (1 - q * 0.6);
    const peasantA = clamp(1 - (q - 0.28) / 0.45, 0, 1);
    const wolfA = clamp((q - 0.3) / 0.45, 0, 1);
    if (peasantA > 0) {
      ctx.save();
      ctx.globalAlpha = peasantA;
      ctx.translate(x + shake, y);
      ctx.scale(dir, 1);
      ctx.scale(1, 1 - q * 0.12);
      peasant(ctx, v, m, t, flash, { lean: q * 0.55, torch: q < 0.15, still: true });
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    if (wolfA > 0) wolfman(ctx, v, { ...m, act: "crouch", turned: true }, x + shake, y, t, flash, wolfA, q);
    // The torch dropped where he stood, burning on the cobbles.
    if (q >= 0.15) {
      ctx.save();
      ctx.translate(x + dir * 1.8, y);
      seg(ctx, -0.8, -0.15, 0.8, -0.1, 0.26, WOOD);
      flame(ctx, 0.8, -0.1, 0.55, t, m.id || 0);
      ctx.restore();
    }
    // Scraps of cloth torn away, and the moon's glow on him.
    if (!flash) {
      ctx.fillStyle = TUNICS[(m.id || 0) % TUNICS.length];
      for (let k = 0; k < 6; k++) {
        const a = k * 1.1 + 0.4;
        const r = 0.6 + q * (1.4 + (k % 3) * 0.6);
        ctx.globalAlpha = clamp(1.3 - q, 0, 1) * clamp(q * 3, 0, 1);
        ctx.fillRect(x + Math.cos(a) * r - 0.2, y - 2.4 + Math.sin(a) * r * 0.9 - q * 1.5 - 0.15, 0.44, 0.3);
      }
      ctx.globalAlpha = Math.sin(q * Math.PI);
      ctx.fillStyle = gradient(ctx, "createRadialGradient", [x, y - 2.6, 0.3, x, y - 2.6, 3.4], [[0, "rgba(255, 216, 144, 0.32)"], [1, "rgba(255, 216, 144, 0)"]]);
      ctx.fillRect(x - 3.6, y - 6.2, 7.2, 7.2);
      ctx.globalAlpha = 1;
      if (peasantA > 0.2) v.eyes.push(x + dir * 0.75, y - 4.45, 0.14 + q * 0.1, q > 0.5 ? EYE_RED : EYE_AMBER);
    }
  }

  /* --------------------------------------------------------- hanged man */

  // A hanged man: a rope from the beam to a noose, the neck bent, the head
  // lolling, grey shirt and trousers, bare feet turning, arms limp; he swings on
  // his rope, creaks before he drops, flings his arms up as he falls, bounces at the
  // rope's end and kicks as he is hauled up.
  function hanged(ctx, v, m, x, y, t, flash) {
    const H = v.g.FIELD_H;
    const beamY = H - (m.beam ?? m.y + 8);
    const neck = y - 3.6;
    const len = Math.max(0.6, neck - beamY);
    const act = m.act || "sway";
    const jolt = act === "hold" ? clamp((m.wait || 0) / 450, 0, 1) : 0;
    let ang = Math.sin(t / 520) * 0.06;
    if (act === "warn") ang = Math.sin(t / 22) * 0.1;
    else if (act === "hold") ang = Math.sin(t / 60) * 0.2 * jolt * jolt;
    else if (act === "drop") ang = Math.sin(t / 40) * 0.03;
    const skin = flash ? FLASH : "#9aa08a";
    const shirt = flash ? FLASH : "#7a7a68";
    const pants = flash ? FLASH : "#3a3a32";
    ctx.save();
    ctx.translate(x, beamY);
    ctx.rotate(ang);
    // The rope, twisted.
    ctx.strokeStyle = flash ? FLASH : ROPE;
    ctx.lineWidth = 0.3;
    line(ctx, 0, 0, 0, len);
    ctx.strokeStyle = flash ? FLASH : "#4a3a22";
    ctx.lineWidth = 0.1;
    for (let k = 0.3; k < len; k += 0.55) line(ctx, -0.14, k, 0.14, k + 0.25);
    const flail = act === "haul" ? Math.sin(t / 55) : 0;
    const up = act === "drop" ? 1 : act === "hold" ? 0.6 * jolt : 0;
    // Legs, bare feet dangling (kicking while he is hauled).
    seg(ctx, -0.3, len + 2.2, -0.45 - flail * 0.7, len + 3.55, 0.5, pants);
    seg(ctx, 0.3, len + 2.2, 0.5 + flail * 0.7, len + 3.55, 0.5, pants);
    ctx.fillStyle = skin;
    ellipse(ctx, -0.5 - flail * 0.7, len + 3.75, 0.34, 0.2, -0.5);
    ctx.fill();
    ellipse(ctx, 0.55 + flail * 0.7, len + 3.75, 0.34, 0.2, 0.5);
    ctx.fill();
    // The shirt, torn at the hem, and the arms: limp, or flung up.
    ctx.fillStyle = shirt;
    poly(ctx, [[-0.95, len + 0.3], [0.95, len + 0.3], [0.85, len + 2.3], [0.5, len + 2.5], [0.1, len + 2.2], [-0.3, len + 2.55], [-0.85, len + 2.3]]);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(-0.95, len + 0.3, 0.5, 2);
    }
    const armA = 1.35 - up * 2.4;
    for (const s of [-1, 1]) {
      const sx = s * 0.95;
      const ex = sx + Math.cos(Math.PI / 2 - s * armA) * 0.0 + s * (0.25 + up * 0.5);
      seg(ctx, sx, len + 0.5, ex + s * 0.1, len + 0.5 + Math.cos(armA * 0.6) * 1.3 + (up ? -1.3 * up : 0), 0.45, shirt);
      ctx.fillStyle = skin;
      circle(ctx, ex + s * 0.1, len + 0.5 + Math.cos(armA * 0.6) * 1.3 + (up ? -1.3 * up : 0) + (up ? 0 : 0.7), 0.3);
      ctx.fill();
    }
    // The head, bent to a side over the noose, mouth open, eyes dull.
    ctx.save();
    ctx.translate(0.15, len - 0.1);
    ctx.rotate(0.45);
    ctx.fillStyle = skin;
    ellipse(ctx, 0.3, -0.7, 0.78, 0.9);
    ctx.fill();
    ctx.fillStyle = flash ? FLASH : "#2a2420";
    poly(ctx, [[-0.4, -1.1], [0.9, -1.45], [1.0, -0.85], [-0.45, -0.7]]);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#1a1410";
      ellipse(ctx, 0.55, -0.35, 0.2, 0.3);
      ctx.fill();
      ctx.fillStyle = "#c8cbb8";
      for (const ex of [0.15, 0.62]) {
        circle(ctx, ex, -0.8, 0.17);
        ctx.fill();
      }
    }
    ctx.restore();
    // The noose, knot at the neck.
    ctx.strokeStyle = flash ? FLASH : ROPE;
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.ellipse?.(0.05, len + 0.15, 0.65, 0.22, 0, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = flash ? FLASH : "#6a5636";
    circle(ctx, 0.5, len + 0.1, 0.3);
    ctx.fill();
    ctx.restore();
    if (!flash) {
      // His eyes, through the head's tilt and the rope's swing.
      const lit = act !== "sway";
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      for (const ex of [0.15, 0.62]) {
        const bx = 0.15 + ex * Math.cos(0.45) + 0.8 * Math.sin(0.45);
        const by = len - 0.1 + ex * Math.sin(0.45) - 0.8 * Math.cos(0.45);
        v.eyes.push(x + bx * ca - by * sa, beamY + bx * sa + by * ca, lit ? 0.2 : 0.12, lit ? EYE_PALE : "#7a9a8a");
      }
    }
    if (act === "drop" || act === "haul") {
      // Speed streaks beside him.
      ctx.strokeStyle = "rgba(230, 230, 240, 0.3)";
      ctx.lineWidth = 0.12;
      const dy = act === "drop" ? -1 : 1;
      for (const s of [-1.4, 1.4]) line(ctx, x + s, y - 3 + dy * 0.3, x + s, y - 3 - dy * 2.4);
    }
  }

  /* ------------------------------------------------------- shutter ghoul */

  // The two leaves of a pair of shutters over a window (closed), shaking when it
  // rattles, with slats, hinges and a bar.
  function closedShutters(ctx, x, top, bottom, w, shake, flash, t) {
    for (const s of [-1, 1]) {
      const lx = s < 0 ? x - w / 2 - 0.2 : x + 0.02;
      const off = shake * s;
      ctx.fillStyle = flash ? FLASH : "#4a3a28";
      ctx.fillRect(lx + off, top - 0.1, w / 2 + 0.18, bottom - top + 0.2);
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        for (let k = 1; k < 7; k++) ctx.fillRect(lx + off, top + (k * (bottom - top)) / 7, w / 2 + 0.18, 0.12);
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(lx + off, top - 0.1, 0.14, bottom - top + 0.2);
        ctx.fillStyle = "#1c1c20";
        ctx.fillRect(lx + off, top + 0.5, w / 2 + 0.18, 0.28);
        ctx.fillRect(lx + off, bottom - 0.9, w / 2 + 0.18, 0.28);
      }
    }
    if (!flash) {
      ctx.fillStyle = "#1c1c20";
      ctx.fillRect(x - 0.12, top + (bottom - top) * 0.45, 0.24, 0.5);
    }
  }

  // A ghoul in a window: gaunt grey, nightshirt, long black hair, a mouth full of
  // needles, eyes burning; when it lunges its neck and arms stretch out from the
  // window to where it reaches, hands clawed and grasping.
  function shutter(ctx, v, m, x, y, t, flash) {
    const H = v.g.FIELD_H;
    const hx = m.hx ?? x;
    const hy = H - (m.hy ?? m.y);
    const w = 3.8;
    const hh = 5.2;
    const top = hy - hh;
    const act = m.act || "hide";
    if (act === "hide" || act === "rattle") {
      const rattle = act === "rattle";
      const k = rattle ? Math.sin(t / 22) * 0.3 : 0;
      // Between the slats, eyes in the dark; a clawed finger at the gap.
      if (rattle) {
        ctx.fillStyle = "#08060a";
        ctx.fillRect(hx - w / 2, top, w, hh);
        v.eyes.push(hx - 0.55, top + hh * 0.42, 0.22, EYE_RED, hx + 0.55, top + hh * 0.42, 0.22, EYE_RED);
        ctx.fillStyle = "#c8c8b0";
        poly(ctx, [[hx - 0.3 + k, top + hh * 0.55], [hx + 0.3 + k, top + hh * 0.55], [hx + 0.05, top + hh * 0.75]]);
        ctx.fill();
      }
      closedShutters(ctx, hx, top, hy, w, k, flash, t);
      if (rattle) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        ctx.lineWidth = 0.12;
        for (const s of [-1, 1]) for (const dy of [0.25, 0.5, 0.75]) line(ctx, hx + s * (w / 2 + 0.5), top + hh * dy, hx + s * (w / 2 + 1.2), top + hh * dy - 0.2);
      }
      return;
    }
    // Out: the shutters thrown open against the wall either side, and the ghoul.
    for (const s of [-1, 1]) {
      ctx.fillStyle = flash ? FLASH : "#4a3a28";
      poly(ctx, [[hx + s * (w / 2 + 0.2), top - 0.1], [hx + s * (w / 2 + 1.7), top + 0.5], [hx + s * (w / 2 + 1.7), hy - 0.4], [hx + s * (w / 2 + 0.2), hy + 0.1]]);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        for (let k = 1; k < 7; k++) ctx.fillRect(hx + s * (w / 2 + 0.2) - (s < 0 ? 1.5 : 0), top + (k * (hy - top)) / 7, 1.5, 0.1);
      }
    }
    const dir = m.dir || 1;
    const cx = hx;
    const cy = hy - hh * 0.5;
    const px = x;
    const py = y - m.h * 0.62;
    const skin = flash ? FLASH : "#8a9478";
    const shirt = flash ? FLASH : "#b4b4a4";
    const len = Math.hypot(px - cx, py - cy) || 1;
    const ux = (px - cx) / len;
    const uy = (py - cy) / len;
    // The body: a nightshirt stretching out of the window to the head.
    const nx2 = -uy;
    const ny2 = ux;
    ctx.fillStyle = flash ? FLASH : gradient(ctx, "createLinearGradient", [cx, cy, px, py], [[0, "#2e2e2c"], [0.5, "#8a8a80"], [1, shirt]]);
    poly(ctx, [[cx + nx2 * 1.0, cy + 0.4 + ny2 * 1.0], [px + nx2 * 1.4, py + 0.6 + ny2 * 1.4], [px - nx2 * 1.4, py + 0.6 - ny2 * 1.4], [cx - nx2 * 1.0, cy + 0.4 - ny2 * 1.0]]);
    ctx.fill();
    circle(ctx, cx, cy + 0.4, 1.0);
    ctx.fill();
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.85;
    ctx.lineCap = "round";
    line(ctx, px - ux * 0.9, py - uy * 0.9 + 0.2, px - ux * 0.2, py - uy * 0.2);
    ctx.lineCap = "butt";
    if (!flash) {
      ctx.strokeStyle = "rgba(0, 0, 0, 0.3)";
      ctx.lineWidth = 0.12;
      for (let k = 0.15; k < 0.75; k += 0.17) {
        const wd = 1.3 - k * 0.8;
        line(ctx, cx + ux * len * k - uy * wd, cy + 0.4 + uy * len * k + ux * wd, cx + ux * len * k + uy * wd, cy + 0.4 + uy * len * k - ux * wd);
      }
    }
    // Arms reaching further than the head, fingers spread with long nails.
    for (const [s, spread] of [[1, 0.32], [-1, -0.28]]) {
      const ang = Math.atan2(uy, ux) + spread;
      const ax = px + Math.cos(ang) * 2.5;
      const ay = py + Math.sin(ang) * 2.5 + 0.2;
      seg(ctx, px - uy * 0.2 * s, py + ux * 0.2 * s, ax, ay, 0.5, skin);
      ctx.fillStyle = skin;
      circle(ctx, ax, ay, 0.38);
      ctx.fill();
      ctx.strokeStyle = flash ? FLASH : "#d8d4bc";
      ctx.lineWidth = 0.1;
      for (let f = -2; f <= 2; f++) {
        const fa = ang + f * 0.3;
        line(ctx, ax, ay, ax + Math.cos(fa) * 1.3, ay + Math.sin(fa) * 1.3);
      }
    }
    // The head: long black hair streaming back, a gaunt face, a gaping mouth.
    ctx.fillStyle = flash ? FLASH : "#0c0a0c";
    for (let k = 0; k < 8; k++) {
      const hs = Math.sin(t / 130 + k) * 0.35;
      const q = k / 7 - 0.5;
      ctx.beginPath();
      ctx.moveTo(px + q * 1.5 - 0.15, py - 1.05 + Math.abs(q) * 0.5);
      ctx.quadraticCurveTo(px + q * 3 - ux * 0.8 + hs, py - 0.2 + Math.abs(q) * 0.3, px + q * 3.4 - ux * 1.2 + hs * 1.6, py + 2.2 + (k % 3) * 0.5);
      ctx.lineTo(px + q * 1.5 + 0.2, py - 1.0 + Math.abs(q) * 0.5);
      ctx.fill();
    }
    ctx.fillStyle = skin;
    ellipse(ctx, px, py, 1.1, 1.38);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#08060a";
      ellipse(ctx, px + dir * 0.1, py + 0.6, 0.62, 0.7);
      ctx.fill();
      ctx.fillStyle = "#e4e0c8";
      for (let k = -2; k <= 2; k++) {
        poly(ctx, [[px + dir * 0.1 + k * 0.2 - 0.07, py + 0.0], [px + dir * 0.1 + k * 0.2 + 0.07, py + 0.0], [px + dir * 0.1 + k * 0.2, py + 0.38]]);
        ctx.fill();
        poly(ctx, [[px + dir * 0.1 + k * 0.2 - 0.07, py + 1.15], [px + dir * 0.1 + k * 0.2 + 0.07, py + 1.15], [px + dir * 0.1 + k * 0.2, py + 0.78]]);
        ctx.fill();
      }
      ctx.fillStyle = "#0a080a";
      ellipse(ctx, px - 0.38, py - 0.32, 0.3, 0.38);
      ctx.fill();
      ellipse(ctx, px + 0.38, py - 0.32, 0.3, 0.38);
      ctx.fill();
      v.eyes.push(px - 0.36, py - 0.3, 0.2, EYE_RED, px + 0.4, py - 0.3, 0.2, EYE_RED);
    }
  }

  /* ----------------------------------------------------------- moonhound */

  // A moonhound: a gaunt wolfhound, ribs and spine showing, long legs, silver-grey
  // coat; trotting, coiled with its hackles up, stretched in its leap, panting after
  // it, or cowering from Wolfsbane (ears flat, tail between its legs, low). Grown,
  // it is half again as big with a mane that glows.
  function moonhound(ctx, v, m, x, y, t, flash) {
    const s = m.w / 3.8;
    const dir = m.dir || 1;
    const grown = Boolean(m.grown);
    const out = flash ? FLASH : "#15131c";
    const fur = flash ? FLASH : grown ? "#6c6c88" : "#62627a";
    const far = flash ? FLASH : "#3e3e52";
    const lit = flash ? FLASH : "#aab0d0";
    const act = m.shy ? "shy" : m.act || "prowl";
    // Joints, up from the feet in a frame facing +x.
    let sh = [1.0, 1.9];
    let rp = [-1.1, 1.75];
    let hd = [2.15, 2.15];
    let jaw = 0.1;
    let ear = 0;
    let tl = [[-1.3, 1.8], [-2.2, 1.2], [-2.7, 0.4]];
    const ph = t / 120;
    const sw = Math.sin(ph);
    let legs = [
      [[0.85, 1.4], [1.1 + sw * 0.5, 0.7], [0.9 + sw * 0.7, 0]],
      [[-1.0, 1.4], [-1.3 - sw * 0.5, 0.7], [-1.0 - sw * 0.7, 0]],
      [[0.8, 1.4], [0.9 - sw * 0.5, 0.7], [0.8 - sw * 0.7, 0]],
      [[-0.9, 1.4], [-1.1 + sw * 0.5, 0.7], [-0.9 + sw * 0.7, 0]],
    ];
    if (act === "prowl") {
      hd = [2.15, 2.05 + Math.abs(sw) * 0.1];
      sh[1] = 1.9 + Math.abs(sw) * 0.08;
      rp[1] = 1.75 + Math.abs(sw) * 0.08;
    } else if (act === "crouch") {
      sh = [1.1, 1.15];
      rp = [-1.1, 1.85];
      hd = [2.2, 1.2];
      jaw = 0.5 + Math.sin(t / 30) * 0.05;
      tl = [[-1.3, 2.0], [-2.1, 2.6], [-2.6, 3.4]];
      legs = [[[1.1, 1.0], [1.7, 0.5], [1.9, 0]], [[-1.0, 1.7], [-0.3, 0.9], [-0.9, 0]], [[1.0, 1.0], [1.5, 0.4], [1.6, 0]], [[-0.9, 1.7], [-1.5, 0.9], [-1.1, 0]]];
      ear = 0.3;
    } else if (act === "leap") {
      sh = [1.0, 1.95];
      rp = [-1.2, 1.9];
      hd = [2.35, 2.35];
      jaw = 0.8;
      tl = [[-1.4, 1.9], [-2.4, 2.1], [-3.4, 2.0]];
      legs = [[[1.2, 1.7], [2.3, 2.0], [3.1, 2.3]], [[-1.2, 1.7], [-2.3, 1.5], [-3.2, 1.2]], [[1.1, 1.6], [2.2, 1.7], [3.0, 1.8]], [[-1.1, 1.6], [-2.1, 1.3], [-3.0, 0.8]]];
    } else if (act === "rest") {
      hd = [1.9, 1.6];
      jaw = 0.4 + Math.abs(Math.sin(t / 130)) * 0.35;
      sh[1] = 1.75 + Math.sin(t / 140) * 0.08;
      tl = [[-1.3, 1.5], [-2.2, 0.8], [-2.9, 0.2]];
    } else if (act === "shy") {
      sh = [0.9, 1.4];
      rp = [-1.0, 1.55];
      hd = [1.6, 0.95];
      ear = 1;
      tl = [[-1.2, 1.4], [-0.6, 0.5], [0.3, 0.3]];
      legs = [[[0.8, 1.0], [1.2 + sw * 0.2, 0.5], [1.0 + sw * 0.3, 0]], [[-0.9, 1.1], [-1.2, 0.5], [-1.0, 0]], [[0.7, 1.0], [0.9, 0.5], [0.8, 0]], [[-0.8, 1.1], [-1.0, 0.5], [-0.8, 0]]];
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir * s, -s);
    const L = (a, b, r0, r1, c, th = 0.14) => wolf.limb(ctx, { out }, a, b, r0, r1, c, th);
    // A grown hound's mane shines: a pale haze round its back and neck.
    if (grown && !flash) {
      ctx.fillStyle = "rgba(205, 222, 255, 0.2)";
      ellipse(ctx, 0.5, 2.5, 2.8, 1.7);
      ctx.fill();
      ctx.fillStyle = "rgba(205, 222, 255, 0.12)";
      ellipse(ctx, 0.5, 2.5, 3.6, 2.3);
      ctx.fill();
    }
    // The far legs, then the body, then the near legs.
    for (const i of [1, 3]) {
      L(legs[i][0], legs[i][1], 0.42, 0.28, far, 0.1);
      L(legs[i][1], legs[i][2], 0.28, 0.2, far, 0.1);
    }
    L(tl[0], tl[1], 0.32, 0.26, fur, 0.1);
    L(tl[1], tl[2], 0.26, 0.1, fur, 0.1);
    L(rp, sh, 1.0, 1.1, fur, 0.14);
    // The neck and the head.
    L(sh, [hd[0] - 0.3, hd[1] - 0.15], 0.75, 0.5, fur, 0.12);
    ctx.save();
    ctx.translate(hd[0], hd[1]);
    ctx.rotate(Math.atan2(hd[1] - sh[1], hd[0] - sh[0]) * 0.25 - 0.1);
    ctx.fillStyle = out;
    ellipse(ctx, 0.1, 0, 0.78, 0.62);
    ctx.fill();
    ctx.fillStyle = fur;
    ellipse(ctx, 0.1, 0, 0.66, 0.5);
    ctx.fill();
    // The long muzzle, the lower jaw swinging open, the fangs.
    ctx.fillStyle = out;
    poly(ctx, [[0.3, 0.38], [1.55, 0.2], [1.7, -0.02], [1.5, -0.22], [0.4, -0.3]]);
    ctx.fill();
    ctx.fillStyle = fur;
    poly(ctx, [[0.35, 0.3], [1.45, 0.16], [1.58, -0.02], [1.4, -0.16], [0.45, -0.22]]);
    ctx.fill();
    ctx.save();
    ctx.translate(0.4, -0.24);
    ctx.rotate(-jaw * 0.7);
    ctx.fillStyle = out;
    poly(ctx, [[0, 0.06], [1.2, 0.02], [1.25, -0.2], [0, -0.3]]);
    ctx.fill();
    ctx.fillStyle = far;
    poly(ctx, [[0.05, 0.02], [1.1, 0], [1.14, -0.14], [0.05, -0.22]]);
    ctx.fill();
    ctx.restore();
    if (jaw > 0.12) {
      ctx.fillStyle = "#4a0e14";
      poly(ctx, [[0.45, -0.22], [1.5, -0.18], [1.4, -0.22 - jaw * 0.8], [0.4, -0.3 - jaw * 0.3]]);
      ctx.fill();
      ctx.fillStyle = "#d85a6a";
      if (act === "rest") ellipse(ctx, 1.0, -0.4 - jaw * 0.35, 0.3, 0.12 + jaw * 0.15);
      else ellipse(ctx, 0.9, -0.28 - jaw * 0.3, 0.3, 0.1);
      ctx.fill();
    }
    ctx.fillStyle = "#e8e2d0";
    for (const fx of [1.35, 0.9]) {
      poly(ctx, [[fx - 0.09, -0.18], [fx + 0.09, -0.18], [fx, -0.55 - jaw * 0.1]]);
      ctx.fill();
    }
    ctx.fillStyle = "#08060a";
    circle(ctx, 1.68, 0.05, 0.14);
    ctx.fill();
    // The ears, up and swept back, or flat.
    ctx.fillStyle = out;
    ctx.save();
    ctx.translate(-0.2, 0.45);
    ctx.rotate(-0.4 - ear * 1.0);
    poly(ctx, [[-0.35, 0], [-0.05, 1.15], [0.35, 0]]);
    ctx.fill();
    ctx.fillStyle = far;
    poly(ctx, [[-0.2, 0.05], [-0.04, 0.85], [0.2, 0.05]]);
    ctx.fill();
    ctx.restore();
    ctx.restore();
    // Spine and ribs: the starved look.
    ctx.fillStyle = lit;
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < 6; k++) {
      const q = k / 5;
      const bx = rp[0] + (sh[0] - rp[0]) * q;
      const by = rp[1] + (sh[1] - rp[1]) * q + 0.98;
      circle(ctx, bx, by, 0.14);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = far;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const bx = rp[0] + (sh[0] - rp[0]) * (0.35 + k * 0.1);
      const by = rp[1] + (sh[1] - rp[1]) * (0.35 + k * 0.1);
      ctx.moveTo(bx - 0.1, by + 0.65);
      ctx.quadraticCurveTo(bx + 0.1, by + 0.1, bx - 0.15, by - 0.55);
    }
    ctx.stroke();
    // Hackles up along the back when it crouches or grows.
    if (act === "crouch" || grown) {
      ctx.fillStyle = grown ? "#dfe8ff" : lit;
      for (let k = 0; k < 8; k++) {
        const q = k / 7;
        const bx = rp[0] + (sh[0] - rp[0]) * q + (sh[0] - rp[0]) * 0.15 * q;
        const by = rp[1] + (sh[1] - rp[1]) * q + 1.0 + (q > 0.7 ? 0.1 : 0);
        poly(ctx, [[bx - 0.2, by - 0.05], [bx + 0.2, by - 0.05], [bx - 0.05, by + (grown ? 0.75 : 0.45)]]);
        ctx.fill();
      }
    }
    L(legs[0][0], legs[0][1], 0.45, 0.3, fur, 0.12);
    L(legs[0][1], legs[0][2], 0.3, 0.22, fur, 0.12);
    L(legs[2][0], legs[2][1], 0.42, 0.28, fur, 0.12);
    L(legs[2][1], legs[2][2], 0.28, 0.2, fur, 0.12);
    ctx.restore();
    const eyeAt = (lx, ly) => [x + dir * s * lx, y - s * ly];
    const [ex, ey] = eyeAt(hd[0] + 0.45, hd[1] + 0.2);
    if (!flash) v.eyes.push(ex, ey, grown ? 0.34 : 0.24, grown ? "#fff2b0" : "#ffd870");
  }

  /* ------------------------------------------------------- the Beast */

  // Fur and bones of the Beast's poses, then its effects.
  function beast(ctx, v, b) {
    const H = v.g.FIELD_H;
    const t = v.clock || 0;
    const fy = H - b.y;
    const raged = Boolean(b.raged);
    const hurt = b.hurt > 0 && Math.floor(b.hurt / 55) % 2 === 0;
    const style = hurt ? "flash" : raged ? "rage" : "beast";
    const asleep = b.state === "sleep";
    const act = asleep ? "sleep" : b.state === "down" ? "down" : b.act || "idle";
    const pace = raged ? 0.7 : 1;
    let dir = b.dir || -1;
    let rot = 0;
    let weak = false;
    let shut = false;
    let open;
    const idle = (ph, amp) => {
      const k = mixPose(POSES.stand, POSES.stand, 0);
      const swing = Math.sin(ph) * amp;
      const lift = Math.max(0, Math.cos(ph)) * amp;
      const lift2 = Math.max(0, -Math.cos(ph)) * amp;
      k.ln[1][0] += swing * 0.9;
      k.ln[2][0] += swing * 1.3;
      k.ln[3][0] += swing * 1.3;
      k.ln[3][1] += lift * 0.9;
      k.lf[1][0] -= swing * 0.9;
      k.lf[2][0] -= swing * 1.3;
      k.lf[3][0] -= swing * 1.3;
      k.lf[3][1] += lift2 * 0.9;
      k.an[2][0] -= swing * 0.7;
      k.af[2][0] += swing * 0.7;
      k.chest[1] += Math.sin(t / 330) * 0.14;
      k.neck[1] += Math.sin(t / 330) * 0.14;
      k.head[1] += Math.sin(t / 330) * 0.14;
      return k;
    };
    if (act === "howl") dir = Math.sign(world.moonWorld(v).x - b.x) || dir;
    let pose = idle(t / (raged ? 150 : 210), 0.55);
    let dust = 0;
    const f = b.fly;
    if (act === "bound" && f) {
      const p = clamp(f.t / f.T, 0, 1);
      const vx = f.x1 - f.x0;
      const vy = f.y1 - f.y0 + f.arc * 4 * (1 - 2 * p);
      dir = Math.sign(vx) || dir;
      rot = Math.atan2(vy, Math.abs(vx)) * 0.7;
      pose = mixPose(mixPose(POSES.crouch, POSES.leap, ease(clamp(p / 0.25, 0, 1))), POSES.cling, ease(clamp((p - 0.7) / 0.3, 0, 1)));
      rot *= 1 - clamp((p - 0.7) / 0.3, 0, 1);
    } else if (act === "pounce" && f) {
      const p = clamp(f.t / f.T, 0, 1);
      const vx = f.x1 - f.x0;
      const vy = f.y1 - f.y0 + f.arc * 4 * (1 - 2 * p);
      dir = Math.sign(vx) || dir;
      rot = Math.atan2(vy, Math.abs(vx)) * 0.75;
      pose = mixPose(mixPose(POSES.crouch, POSES.leap, ease(clamp(p / 0.16, 0, 1))), POSES.land, ease(clamp((p - 0.8) / 0.2, 0, 1)));
      rot *= 1 - clamp((p - 0.82) / 0.18, 0, 1);
    } else if (act === "cling") {
      dir = b.side || dir;
      pose = mixPose(POSES.cling, POSES.cling, 0);
      pose.chest[1] += Math.sin(t / 190) * 0.12;
      pose.jaw = 0.45 + Math.abs(Math.sin(t / 240)) * 0.35;
      weak = true;
    } else if (act === "crouch") {
      pose = mixPose(POSES.crouch, POSES.crouch, 0);
      pose.chest[1] += Math.sin(t / 26) * 0.07;
      pose.jaw = 0.6;
    } else if (act === "swipeWind") {
      const p = clamp(1 - (b.wait || 0) / (SWIPE_WIND_MS * pace), 0, 1);
      pose = mixPose(POSES.stand, POSES.rear, ease(p));
    } else if (act === "howl") {
      const p = clamp(1 - (b.wait || 0) / (HOWL_MS * pace), 0, 1);
      pose = mixPose(POSES.stand, POSES.howl, ease(clamp(p * 3.2, 0, 1)));
      pose.jaw = 0.5 + 0.4 * Math.min(1, p * 4);
      pose.chest[1] += Math.sin(t / 60) * 0.06;
    } else if (act === "rest") {
      const q = clamp(((b.swipeCool || 0) - (SWIPE_COOL_MS - 300)) / 300, 0, 1);
      if (q > 0) pose = mixPose(POSES.stand, POSES.swipe, ease(q));
      else {
        pose = mixPose(POSES.rest, POSES.rest, 0);
        pose.jaw = 0.35 + Math.abs(Math.sin(t / 140)) * 0.3;
        pose.chest[1] += Math.sin(t / 140) * 0.12;
        dust = clamp(1 - ((b.wait || 0) - 380) / 520, 0, 1);
      }
    } else if (act === "sleep") {
      pose = mixPose(POSES.sleep, POSES.sleep, 0);
      pose.chest[1] += Math.sin(t / 700) * 0.1;
      shut = true;
    } else if (act === "down") {
      pose = POSES.down;
      shut = true;
    }
    // On a stage's card (it stands there waiting) it rears, one claw raised.
    if (b.wait === Infinity && act === "idle") pose = mixPose(POSES.stand, POSES.rear, 0.85);
    const figureBox = { x: b.x, y: fy, dir, sc: 1, pose, t, style, rot, weak, shut, open, eyeR: raged ? 0.4 : 0.32 };
    // The rage: a gold haze round it, embers rising.
    if (raged && !hurt && act !== "down") {
      const pulse = 0.5 + 0.5 * Math.sin(t / 200);
      ctx.fillStyle = `rgba(255, 190, 90, ${0.1 + 0.07 * pulse})`;
      ellipse(ctx, b.x, fy - 5, 7.5, 7);
      ctx.fill();
      ctx.fillStyle = "#ffb050";
      for (let k = 0; k < 7; k++) {
        const q = (t / 1100 + k / 7) % 1;
        ctx.globalAlpha = (1 - q) * 0.8;
        ctx.fillRect(b.x + Math.sin(k * 2.3 + q * 5) * 4.2, fy - 1 - q * 12, 0.22, 0.22);
      }
      ctx.globalAlpha = 1;
    }
    // Speed streaks behind it in the air.
    if ((act === "pounce" || act === "bound") && f) {
      ctx.strokeStyle = "rgba(220, 224, 255, 0.28)";
      ctx.lineWidth = 0.18;
      for (let k = 0; k < 4; k++) line(ctx, b.x - dir * (3 + k * 0.4), fy - 3 - k * 1.3, b.x - dir * (8 + k * 1.2), fy - 3 - k * 1.3 + rot * -4);
    }
    // Loose chips fall from the wall where its claws are in.
    if (act === "cling") {
      const sx = b.x + dir * 2.8;
      ctx.fillStyle = "#8a8498";
      for (let k = 0; k < 5; k++) {
        const q = (t / 700 + k / 5) % 1;
        ctx.globalAlpha = 1 - q;
        ctx.fillRect(sx - dir * (0.2 + (k % 2) * 0.4), fy - 9 - k * 0.6 + q * 7, 0.2, 0.26);
      }
      ctx.globalAlpha = 1;
    }
    const got = wolf.figure(ctx, v, figureBox);
    // The howl's rings, rolling out from the muzzle toward the moon.
    if (act === "howl") {
      const p = clamp(1 - (b.wait || 0) / (HOWL_MS * pace), 0, 1);
      const [mx, my] = got.at(pose.head[0] + Math.cos(pose.ha) * 3.3, pose.head[1] + Math.sin(pose.ha) * 3.3);
      for (let k = 0; k < 4; k++) {
        const q = ((t / 520 + k / 4) % 1) * Math.min(1, p * 4);
        ctx.strokeStyle = raged ? `rgba(255, 190, 110, ${(1 - q) * 0.7})` : `rgba(220, 224, 255, ${(1 - q) * 0.6})`;
        ctx.lineWidth = 0.22;
        ctx.beginPath();
        ctx.arc(mx, my, 1 + q * 6, -Math.PI / 2 - 0.9 - (dir < 0 ? 0 : 0), -Math.PI / 2 + 0.9);
        ctx.stroke();
      }
    }
    if (act === "rest" && dust > 0) {
      // The dust of its landing, rolling out along the floor.
      ctx.fillStyle = "#8a8498";
      for (let k = 0; k < 8; k++) {
        const side = k % 2 ? 1 : -1;
        const r = 1.5 + dust * (3 + (k >> 1) * 1.4);
        ctx.globalAlpha = (1 - dust) * 0.5;
        ellipse(ctx, b.x + side * r, fy - 0.5 - (k >> 1) * 0.3, 0.9 + dust * 1.1, 0.5 + dust * 0.5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Its breath smokes in the night air when it pants, and always in its rage.
    if ((act === "rest" || raged) && act !== "down") {
      const [mx, my] = got.at(pose.head[0] + 3, pose.head[1]);
      ctx.fillStyle = "rgba(220, 224, 240, 0.18)";
      for (let k = 0; k < 3; k++) {
        const q = (t / 800 + k / 3) % 1;
        circle(ctx, mx + dir * q * 2.4, my - q * 1.2, 0.3 + q * 0.7);
        ctx.fill();
      }
    }
    if (asleep) {
      ctx.strokeStyle = "rgba(230, 230, 255, 0.7)";
      ctx.lineWidth = 0.16;
      for (let k = 0; k < 2; k++) {
        const q = (t / 1800 + k / 2) % 1;
        const zx = b.x + dir * (3.5 + q * 2.2);
        const zy = fy - 3.2 - q * 4;
        const zs = 0.45 + q * 0.5;
        ctx.globalAlpha = 1 - q;
        ctx.beginPath();
        ctx.moveTo(zx - zs, zy - zs);
        ctx.lineTo(zx + zs, zy - zs);
        ctx.lineTo(zx - zs, zy + zs);
        ctx.lineTo(zx + zs, zy + zs);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ----------------------------------------------- hazards and missiles */

  // A patch of burning oil on the cobbles: tongues of fire in three layers.
  function torchfire(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const fade = Math.min(1, h.live / 450) * Math.min(1, (h.max - h.live) / 120 + 0.25);
    const t = v.clock || 0;
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#1a0c06";
    ellipse(ctx, h.x, fy - 0.1, h.w / 2 + 0.2, 0.42);
    ctx.fill();
    ctx.fillStyle = "#8a2a10";
    ctx.globalAlpha = fade * 0.55;
    ellipse(ctx, h.x, fy - 0.15, h.w / 2 - 0.3, 0.3);
    ctx.fill();
    ctx.globalAlpha = fade;
    const tongues = 7;
    for (const [layer, color, hs, ws] of [[0, FIRE_RED, 1, 1], [1, FIRE_ORANGE, 0.76, 0.72], [2, FIRE_HOT, 0.48, 0.42]]) {
      for (let k = 0; k < tongues; k++) {
        const fx = h.x - h.w / 2 + 0.5 + (k * (h.w - 1)) / (tongues - 1);
        const flick = Math.abs(Math.sin(t / 80 + k * 1.7 + layer));
        const tall = h.h * hs * (0.5 + flick * 0.5) * (1 - (Math.abs(k - (tongues - 1) / 2) / tongues) * 0.7);
        const sway = Math.sin(t / 110 + k * 2.1) * 0.3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(fx - 0.55 * ws, fy);
        ctx.quadraticCurveTo(fx - 0.4 * ws, fy - tall * 0.55, fx + sway, fy - tall);
        ctx.quadraticCurveTo(fx + 0.4 * ws, fy - tall * 0.5, fx + 0.55 * ws, fy);
        ctx.fill();
      }
    }
    for (let k = 0; k < 5; k++) {
      const p = (t / 900 + k / 5) % 1;
      ctx.fillStyle = k % 2 ? FIRE_HOT : FIRE_ORANGE;
      ctx.globalAlpha = fade * (1 - p);
      ctx.fillRect(h.x - h.w / 2 + 0.6 + ((k * 53) % 100) * 0.01 * (h.w - 1.2) + Math.sin(p * 7 + k) * 0.4, fy - h.h * 0.5 - p * 4, 0.22, 0.22);
    }
    ctx.globalAlpha = 1;
    v.eyes.push(h.x, fy - 0.7, 0.34 * fade, FIRE_HOT);
  }

  // The Beast's landing marked on the floor: a dark ellipse that grows and darkens
  // as it comes down, a red ring flickering faster at the end, claws converging.
  function shadow(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const t = v.clock || 0;
    const prog = clamp(1 - h.warn / h.total, 0, 1);
    const rx = (h.w / 2) * (0.3 + 0.72 * prog);
    const ry = 0.5 + 0.55 * prog;
    ctx.globalAlpha = 0.28 + 0.5 * prog;
    ctx.fillStyle = "#000000";
    ellipse(ctx, h.x, fy - 0.15, rx, ry);
    ctx.fill();
    ctx.globalAlpha = 1;
    const flicker = Math.sin(t / (90 - prog * 60)) > 0 ? 1 : 0.5;
    ctx.strokeStyle = `rgba(210, 50, 30, ${(0.35 + 0.55 * prog) * flicker})`;
    ctx.lineWidth = 0.2;
    ellipse(ctx, h.x, fy - 0.15, h.w / 2, 0.8 + 0.3 * prog);
    ctx.stroke();
    ctx.strokeStyle = `rgba(210, 50, 30, ${0.5 * prog})`;
    ctx.lineWidth = 0.16;
    for (const s of [-1, 1]) {
      const a = (1 - prog) * 2.2 + 0.4;
      line(ctx, h.x + s * a, fy - 0.2, h.x + s * (a - 1.2), fy - 0.9);
      line(ctx, h.x + s * (a + 0.4), fy - 0.15, h.x + s * (a - 0.8), fy - 0.8);
    }
  }

  // A swipe: three white-hot slashes sweeping from high and near to low and far,
  // an orange edge round each, a red wedge of danger fading behind.
  function claw(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const f = clamp(h.live / h.max, 0, 1);
    const dir = h.dir || 1;
    ctx.globalAlpha = 0.2 * f;
    ctx.fillStyle = "#c82a1a";
    poly(ctx, [[h.x - dir * h.w * 0.5, fy - h.h], [h.x + dir * h.w * 0.5, fy], [h.x - dir * h.w * 0.5, fy]]);
    ctx.fill();
    ctx.globalAlpha = 0.4 + 0.6 * f;
    for (let k = 0; k < 3; k++) {
      const sx = h.x - dir * h.w * 0.46;
      const sy = fy - h.h * (0.96 - k * 0.2);
      const ex = h.x + dir * h.w * 0.5;
      const ey = fy - h.h * (0.1 + k * 0.18);
      const cx = h.x + dir * h.w * 0.1;
      const cy = fy - h.h * (1.05 - k * 0.16);
      for (const [lw, color] of [[0.65, "rgba(255, 150, 60, 0.55)"], [0.3, "#fff2d8"]]) {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();
      }
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
  }

  // The torch in the air: a stick with a rag head, tumbling end over end, flame
  // streaming, sparks.
  function torch(ctx, x, y, spin) {
    const a = spin;
    const tipx = x + Math.cos(a) * 0.9;
    const tipy = y + Math.sin(a) * 0.9;
    seg(ctx, x - Math.cos(a) * 0.8, y - Math.sin(a) * 0.8, tipx, tipy, 0.34, WOOD);
    seg(ctx, tipx - Math.cos(a) * 0.55, tipy - Math.sin(a) * 0.55, tipx, tipy, 0.62, "#2a1c12");
    flame(ctx, tipx, tipy - 0.15, 1.25, spin * 150, 1);
    ctx.fillStyle = FIRE_HOT;
    for (let k = 0; k < 3; k++) ctx.fillRect(tipx - Math.cos(a) * (0.6 + k * 0.5) + Math.sin(spin * 3 + k) * 0.3, tipy - Math.sin(a) * (0.6 + k * 0.5) - 0.5, 0.16, 0.16);
  }

  // Wolfsbane's badge (inside the ring every power-up shares): a sprig of hooded
  // purple flowers up a green stem, two leaves at its foot.
  function bane(ctx, x, y) {
    ctx.strokeStyle = "#1f5a2c";
    ctx.lineWidth = 0.2;
    ctx.lineCap = "round";
    line(ctx, x, y + 1.0, x + 0.05, y - 0.75);
    ctx.fillStyle = "#1f5a2c";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x, y + 0.75);
      ctx.quadraticCurveTo(x + s * 0.5, y + 0.3, x + s * 0.8, y + 0.55);
      ctx.quadraticCurveTo(x + s * 0.4, y + 0.85, x, y + 0.75);
      ctx.fill();
    }
    ctx.lineCap = "butt";
    // Hooded flowers, a nodding cluster, each a cowl with a lip.
    for (const [dx, dy, s] of [[0, -0.85, 0.8], [-0.4, -0.3, 1], [0.4, 0.05, 1], [-0.32, 0.4, 0.9]]) {
      ctx.fillStyle = "#3a1f7a";
      ctx.beginPath();
      ctx.moveTo(x + dx - 0.3 * s, y + dy + 0.28 * s);
      ctx.quadraticCurveTo(x + dx - 0.42 * s, y + dy - 0.25 * s, x + dx + 0.05 * s, y + dy - 0.36 * s);
      ctx.quadraticCurveTo(x + dx + 0.45 * s, y + dy - 0.2 * s, x + dx + 0.34 * s, y + dy + 0.3 * s);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#d4c0ff";
      ctx.fillRect(x + dx - 0.12 * s, y + dy + 0.1 * s, 0.24 * s, 0.1 * s);
    }
  }

  /* -------------------------------------------------------------- events */

  // What the pack's events look and sound like; true when the event is its own.
  // Each of its sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, glow, float, ring, banner, fx } = k;
    const voice = EVENT_VOICE[e.type];
    const known = voice || e.type === "houndCall";
    if (!known) return false;
    if (voice) say(tone, voice[0], voice[1], voice[0] === "beast" ? 0.6 : 0.5);
    switch (e.type) {
      case "fullMoon":
        flash("#ffd890", 380);
        ring(e.x, e.y, "#ffd890", 2, 18, 700);
        shake(260, 0.5);
        banner("Full moon", "They are turning", "#ffd890", 1500);
        break;
      case "villagerTurn":
        flash("#d9e4ff", 200);
        burst(e.x, e.y, "#8a5a32", 8, 8, 400);
        float(e.x, e.y + 4, "!", DANGER, 2.8);
        break;
      case "villagerWolf":
        burst(e.x, e.y, "#5e5046", 12, 12, 500);
        ring(e.x, e.y, "#ffb050", 1, 5, 360);
        shake(120, 0.3);
        break;
      case "houndGrow":
        ring(e.x, e.y, "#dfe8ff", 1, 6, 500);
        glow(e.x, e.y, 7, 0.6, 500);
        break;
      case "baneShy":
        float(e.x, e.y + 3, "Shoo!", "#c8b4f4", 2);
        burst(e.x, e.y, "#a58ae0", 6, 7, 400);
        break;
      case "torchWind":
        glow(e.x, e.y, 4, 0.4, 300);
        break;
      case "torchLand":
        burst(e.x, e.y + 1, FIRE_ORANGE, 9, 9, 380);
        glow(e.x, e.y + 1, 8, 0.7, 450);
        break;
      case "hangedWarn":
        float(e.x, e.y + 4, "!", DANGER, 2.4);
        break;
      case "hangedSnap":
        shake(130, 0.35);
        burst(e.x, e.y + 4, "#8a7048", 5, 6, 260);
        break;
      case "shutterRattle":
        burst(e.x, e.y, "#4a3a28", 4, 5, 260);
        break;
      case "shutterLunge":
        burst(e.x, e.y, "#4a3a28", 6, 9, 300);
        shake(100, 0.3);
        break;
      case "beastLeap":
        burst(e.x, e.y - 3, "#6a6478", 8, 10, 420);
        break;
      case "beastCling":
        burst(e.x + (e.side || 1) * -1.5, e.y, "#8a8498", 9, 9, 420);
        shake(120, 0.35);
        float(e.x + (e.side || 1) * -9, e.y + 5, "Shoot it!", GOLD, 2.2);
        break;
      case "beastPounce":
        burst(e.x, e.y, "#8a8498", 6, 8, 300);
        break;
      case "beastLand":
        shake(e.second ? 260 : 340, 0.8);
        burst(e.x, e.y + 0.4, "#8a8498", 18, 16, 560);
        ring(e.x, e.y + 0.4, "#d8d0e8", 1, 9, 420);
        break;
      case "swipeWind":
        float(e.x + (e.dir || 1) * 6, e.y + 3, "!", DANGER, 2.8);
        break;
      case "beastSwipe":
        shake(160, 0.45);
        burst(e.x + (e.dir || 1) * 5, e.y, "#fff2d8", 8, 14, 280);
        break;
      case "beastHowl":
        glow(e.x, e.y + 1, 10, 0.5, 700);
        if (gateOnce(fx, "howlMs", 600)) ring(e.x, e.y, "#dfe8ff", 1, 14, 900);
        break;
      case "houndCall":
        float(e.x, e.y + 5, "Hounds!", GOLD, 2.2);
        break;
      case "beastMoon":
        flash("#ffb050", 420);
        shake(420, 0.9);
        ring(e.x, e.y, "#ffb050", 2, 16, 800);
        banner("The moon is full", "The Beast rages", "#ffb050", 1700);
        break;
      default:
        break;
    }
    return true;
  }
  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }

  // The torches and fires light what is near, the hounds' manes glow.
  function lights(v, add) {
    world.lights(v, add);
    for (const m of v.round.monsters) {
      if (m.dead) continue;
      if (m.kind === "villager" && !m.turned && m.act !== "turn") add(m.x + m.dir * 1.5, m.y + m.h + 0.2, 5, 0.55);
      else if (m.kind === "villager" && m.act === "turn") add(m.x, m.y + 2.6, 5, 0.35);
      else if (m.kind === "moonhound" && m.grown) add(m.x, m.y + m.h * 0.6, 8, 0.45);
      else if (m.kind === "shutter" && m.act !== "hide") add(m.x, m.y + m.h * 0.6, 5, 0.3);
    }
    for (const h of v.round.hazards) {
      if (h.kind === "torchfire") add(h.x, h.y + 1, 9, 0.7 * Math.min(1, h.live / 450));
      else if (h.kind === "claw") add(h.x, h.y + h.h * 0.5, 9, 0.5 * (h.live / h.max));
    }
    for (const b of v.round.bones) if (b.kind === "torch") add(b.x, b.y, 6, 0.65);
    const be = v.round.boss;
    if (be && be.kind === "beast" && be.state !== "sleep" && be.state !== "down") add(be.x, be.y + 5, be.raged ? 13 : 8, be.raged ? 0.55 : 0.3);
  }

  return freeze({
    looks: LOOKS,
    backdrop: world.backdrop,
    ground: world.ground,
    shelf: world.shelf,
    sky: world.sky,
    moving: world.moving,
    front: world.front,
    monsters: freeze({ villager, hanged, shutter, moonhound }),
    bosses: freeze({ beast }),
    missiles: freeze({ torch }),
    hazards: freeze({ torchfire, shadow, claw }),
    powers: freeze({ bane }),
    lights,
    react,
  });
}
