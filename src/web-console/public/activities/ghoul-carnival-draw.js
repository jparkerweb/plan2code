// Plan2Code Web Console - Ghoul Rush's Midnight Carnival stage, its drawing: the rooms' looks (the Midway under the night sky, the Hall of Mirrors, the Funhouse, the Big Top), the grinner and its acid balloons, the marionette on its string, Mirror You and its bolts, the strongman and his barbell, the circus hound and its hoop of fire, the Ringmaster with his gantry, whip and giant puppet on three strings, the puppet's foot and shockwave, the whip's crack, Cotton Candy's badge and sticky look, the pie's cream on what it stunned, and what the stage's events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and
// LOSE_SOUNDS are plain data (the voices borrow the house's, the Village's, the
// Chapel's and the Mine's tones until the stage's own sounds are picked);
// carnivalArt(d) takes ghoul-draw.js's own drawing helpers (`d`) and hands back
// the drawing by kind, so this file never reaches back into it. The room's
// walls, floors, boards, belts, ring and cages are ghoul-carnival-world.js's
// (`carnivalWorld(d)`, composed in `carnivalArt`). Drawn in room units, the way
// ghoul-draw.js draws: y counted down from the field's top, a monster from
// (x, y) at its feet. What the art reads off the rules (ghoul-carnival.js):
//
// - `round.twist` ({ bolts: [{ x, y, vx }], ... }, null outside the Carnival):
//   Mirror You's bolts in flight, drawn by `front`.
// - `round.effects.floss` (Cotton Candy: ghoul-draw.js tints Planny's bolts
//   pink; `front` puffs pink floss over a monster with `m.floss` and
//   `m.hasteMs` over 0), `m.pied` with `m.stunMs` over 0 (custard cream over
//   the monster, drawn by `front`; the stars are ghoul-arms-draw.js's).
// - a grinner: `m.dir`, `m.act` ("walk", "honk" with `m.wait` ms of the 480 left).
// - a balloon: `m.dir`, `m.id` (its color), `m.t`, `m.life` (flickers in its last second).
// - a marionette: `m.act` ("hang", "warn" with `m.wait` of 380 left, "drop",
//   "dance"), `m.dir`, `m.y` (its feet), the string runs up to the field's top.
// - Mirror You: `m.act` ("wait" in its panel, "step" with `m.wait` of the 600 left,
//   "copy"), `m.dir`, `m.duck`, `m.rise` (height over the floor it stands on).
// - a strongman: `m.act` ("walk", "wind" with `m.wait` of the 600 left), `m.dir`.
// - a circus hound: `m.act` ("prowl", "crouch" with `m.wait` of the 450 left,
//   "leap", "rest", "burst" with `m.wait` of the 500 left), `m.dir`, `m.vx`, `m.vy`.
// - the Ringmaster (`b`): `b.rm` (set up), `b.act` ("idle", "rest" and "stalk" (walking
//   at you), "stompWind" with `b.wait`, "lashWind" with `b.wait` of 700 and `b.lashY`/`b.lashDir`,
//   "crouch" (a leap's wind-up, `b.wait` of `b.total`), "leap" (`b.air` of `b.airMs` ms, from
//   `b.fromX` to `b.toX`), "rear" (a charge's wind-up, `b.cdir` the lane), "charge", "crash" (dazed),
//   "fall", "open", "climb"), `b.puppet` ("up" | "down"), `b.px` (the puppet's x), its pose
//   (`b.lift`, `b.crouch`, `b.stretch`, `b.rear` and `b.squash` ms, `b.lean`, `b.walk` the speed, `b.dazed`),
//   `b.pts` (where the head and the two hands are, the strings' lower ends), `b.strings`
//   ([{ hp, max, hurt }] head, left hand, right hand), `b.open`, `b.floor`, `b.raged`, `b.dir`,
//   `b.hurt`, `b.state`; the gantry is at `b.x`, `b.y` (his feet).
// - hazards: `pfoot` ({ x, y, w, h, live, max }: the puppet's foot), `pcharge` ({ x, y, w, h, dir }: the
//   charge's hit box, riding the puppet), `lash`
//   ({ x, y, w, h, dir, live, max }: the whip's crack along chest height); waves
//   of kind "puppet"; the bone kind "barbell"; the pie's `armPod`/`armSplat`
//   are ghoul-arms-draw.js's.

import { carnivalWorld } from "./ghoul-carnival-world.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

const look = (o) => freeze({ pack: "carnival", custom: true, noMoon: true, carnival: true, pit: "#030208", ...o });
export const LOOKS = freeze({
  midway: look({ wallTop: "#0a0a22", wallLow: "#3a1442", paper: "#4a2050", wainscot: "#5a1a2a", floorTop: "#7a5a3a", floor: "#3a281a", floorEdge: "#120a06", shelf: "#6a2030", shelfTop: "#d8b04a", window: "#ffd070", decor: "bulbs", color: "#ff9ad5", dark: 0.8 }),
  mirrors: look({ wallTop: "#10121e", wallLow: "#242a44", paper: "#34406a", wainscot: "#1a1c2c", floorTop: "#4a4e6a", floor: "#22243a", floorEdge: "#0a0a12", shelf: "#3a3e5a", shelfTop: "#9ab0e0", window: "#bfe8ff", decor: "mirrors", color: "#bfe8ff", dark: 0.84 }),
  funhouse: look({ wallTop: "#140a24", wallLow: "#3a1a5a", paper: "#52307a", wainscot: "#2a1040", floorTop: "#6a4a8a", floor: "#2e1a46", floorEdge: "#0c0614", shelf: "#40206a", shelfTop: "#e8a0e0", window: "#ffa0f0", decor: "crooked", color: "#e8a0e0", dark: 0.84 }),
  bigtop: look({ wallTop: "#1a0608", wallLow: "#5a1018", paper: "#7a1a22", wainscot: "#3a0a10", floorTop: "#9a7a4a", floor: "#4a3220", floorEdge: "#140a06", shelf: "#5a1018", shelfTop: "#f0c050", window: "#ffd070", decor: "tent", color: "#f0c050", dark: 0.82 }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-carnival.js).
// `floss` is the power-up; the Custard Pie's two sounds are in ghoul-arms-draw.js.
export const VOICES = freeze({
  grinner: freeze({ appear: "ghoulGrinnerAppear", honk: "ghoulGrinnerHonk", hurt: "ghoulGrinnerHurt", die: "ghoulGrinnerDie" }),
  balloon: freeze({ appear: "ghoulBalloonAppear", die: "ghoulBalloonDie" }),
  marionette: freeze({ appear: "ghoulMarionetteAppear", jerk: "ghoulMarionetteJerk", drop: "ghoulMarionetteDrop", land: "ghoulMarionetteLand", cut: "ghoulMarionetteCut", hurt: "ghoulMarionetteHurt", die: "ghoulMarionetteDie" }),
  mirror: freeze({ appear: "ghoulMirrorAppear", step: "ghoulMirrorStep", shot: "ghoulMirrorShot", cancel: "ghoulMirrorCancel", shatter: "ghoulMirrorShatter", hurt: "ghoulMirrorHurt", die: "ghoulMirrorDie" }),
  strongman: freeze({ appear: "ghoulStrongmanAppear", wind: "ghoulStrongmanWind", throw: "ghoulStrongmanThrow", land: "ghoulStrongmanLand", hurt: "ghoulStrongmanHurt", die: "ghoulStrongmanDie" }),
  circushound: freeze({ appear: "ghoulCircusHoundAppear", crouch: "ghoulCircusHoundCrouch", leap: "ghoulCircusHoundLeap", land: "ghoulCircusHoundLand", hurt: "ghoulCircusHoundHurt", die: "ghoulCircusHoundDie" }),
  ringmaster: freeze({ wake: "ghoulRingmasterWake", puppetWind: "ghoulRingmasterPuppetWind", stomp: "ghoulRingmasterStomp", down: "ghoulRingmasterDown", open: "ghoulRingmasterOpen", climb: "ghoulRingmasterClimb", tie: "ghoulRingmasterTie", lashWind: "ghoulRingmasterLashWind", crack: "ghoulRingmasterCrack", stringHit: "ghoulRingmasterStringHit", stringCut: "ghoulRingmasterStringCut", cage: "ghoulRingmasterCage", rage: "ghoulRingmasterRage", hurt: "ghoulRingmasterHurt", die: "ghoulRingmasterDie" }),
  floss: freeze({ active: "ghoulFlossActive", stick: "ghoulFlossStick" }),
});

// What each of the pack's events plays: [kind, act], once. A hit, a kill, a
// spawn and a boss's wake, hit and fall are the game's own (they carry their
// kind). The Custard Pie's splat is ghoul-arms-draw.js's. A string cut on a
// marionette plays ["marionette", "cut"] instead (see `react`).
export const EVENT_VOICE = freeze({
  grinnerHonk: ["grinner", "honk"],
  balloonPop: ["balloon", "die"],
  marionetteJerk: ["marionette", "jerk"],
  marionetteDrop: ["marionette", "drop"],
  marionetteLand: ["marionette", "land"],
  stringHit: ["ringmaster", "stringHit"],
  stringCut: ["ringmaster", "stringCut"],
  mirrorStep: ["mirror", "step"],
  mirrorShot: ["mirror", "shot"],
  mirrorCancel: ["mirror", "cancel"],
  mirrorShatter: ["mirror", "shatter"],
  strongWind: ["strongman", "wind"],
  strongThrow: ["strongman", "throw"],
  barbellLand: ["strongman", "land"],
  houndCrouch: ["circushound", "crouch"],
  houndLeap: ["circushound", "leap"],
  houndLand: ["circushound", "land"],
  cageOpen: ["ringmaster", "cage"],
  flossStick: ["floss", "stick"],
  puppetWind: ["ringmaster", "puppetWind"],
  puppetStomp: ["ringmaster", "stomp"],
  puppetCrouch: ["ringmaster", "puppetWind"],
  puppetLeap: ["circushound", "leap"],
  puppetRear: ["ringmaster", "lashWind"],
  puppetCharge: ["ringmaster", "wake"],
  puppetCrash: ["ringmaster", "stomp"],
  puppetDown: ["ringmaster", "down"],
  ringOpen: ["ringmaster", "open"],
  ringClimb: ["ringmaster", "climb"],
  ringString: ["ringmaster", "tie"],
  lashWind: ["ringmaster", "lashWind"],
  lashCrack: ["ringmaster", "crack"],
  ringRage: ["ringmaster", "rage"],
});
// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({
  grinner: "Laughed at",
  balloon: "Burned by a balloon",
  marionette: "Strung along",
  mirror: "Beaten by yourself",
  mirrorbolt: "Shot by yourself",
  strongman: "Flattened",
  barbell: "Weighed down",
  circushound: "Run through the hoop",
  ringmaster: "Shown the door",
  puppet: "Stomped flat",
  lash: "Whipped",
});
export const LOSE_SOUNDS = freeze({
  grinner: ["squish", 0.5, 0.9],
  balloon: ["ghoulSizzle", 0.5, 0.9],
  marionette: ["thud", 0.5, 1.1],
  mirror: ["ghoulGlass", 0.6, 0.8],
  mirrorbolt: ["ghoulGlass", 0.5, 1.1],
  strongman: ["thud", 0.65, 0.7],
  barbell: ["clank", 0.6, 0.6],
  circushound: ["crunch", 0.5, 0.9],
  ringmaster: ["smash", 0.6, 0.6],
  puppet: ["smash", 0.7, 0.45],
  lash: ["ghoulCrack", 0.6, 0.9],
});

const INK = "#14100a";
const WOOD = "#b98a52";
const WOOD_D = "#7a5530";
const CREAM = "#fff6d0";
const PINK = "#ff9ad5";
const GLASS = "#9fe6ff";
const GLASS_D = "#4aa8c8";
const ACID = "#9acd32";

export function carnivalArt(d) {
  const world = carnivalWorld(d);
  const { ellipse, circle, line, say, drawPower, FLASH, EYE_AMBER, EYE_RED, EYE_PALE, DANGER, GOLD } = d;

  const poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  // A limb with a dark outline under it, through the points `pts`.
  function bone(ctx, pts, w, color, out = INK) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [lw, c] of [[w + 0.16, out], [w, color]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }
  const outlined = (ctx, pts, fill, out = INK, lw = 0.12) => {
    poly(ctx, pts);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  const blob = (ctx, x, y, rx, ry, fill, out = INK, lw = 0.12) => {
    ellipse(ctx, x, y, rx, ry);
    ctx.fillStyle = fill;
    ctx.fill();
    if (out) {
      ctx.strokeStyle = out;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  };
  // Runs fn(glow) in a frame at (x, y) facing `dir`, y counted up from the
  // feet; glow(lx, ly, r, color) hands a light to the dark's pass (room coordinates).
  function upright(ctx, v, x, y, dir, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, -1);
    fn((lx, ly, r, color) => v.eyes.push(x + dir * lx, y - ly, r, color));
    ctx.restore();
  }

  /* ------------------------------------------------------------ the grinner */

  const BALLOON_COLORS = freeze(["#e8323c", "#f5c518", "#3a8ee8", "#e85ac0", "#40c878"]);

  // A grinner: a round clown in a polka-dot jacket and a ruff, a huge fixed
  // grin on a white face, a red nose, a cone hat, big shoes. Honking, he lifts the
  // brass horn to his face and squeezes the bulb.
  function grinner(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const honk = m.act === "honk";
    const p = honk ? clamp(1 - (m.wait || 0) / 480, 0, 1) : 0;
    const walk = !honk ? t / 150 : 0;
    const bob = honk ? 0 : Math.abs(Math.sin(walk)) * 0.18;
    const jacket = flash ? FLASH : "#d8302e";
    const jacketD = flash ? FLASH : "#8a1a1e";
    const dot = flash ? FLASH : "#ffe45a";
    const skin = flash ? FLASH : "#fff0e0";
    upright(ctx, v, x, y, dir, (glow) => {
      // Big shoes and baggy striped legs.
      for (const s of [-1, 1]) {
        const step = honk ? 0 : Math.sin(walk + (s > 0 ? Math.PI : 0)) * 0.35;
        bone(ctx, [[s * 0.55, 1.5 + bob], [s * 0.6 + step * 0.3, 0.7]], 0.78, flash ? FLASH : s > 0 ? "#3a8ee8" : "#f5c518");
        blob(ctx, s * 0.6 + step + 0.35, 0.3, 0.98, 0.34, flash ? FLASH : "#e8682a");
      }
      // The round body.
      blob(ctx, 0, 2.55 + bob, 1.55, 1.4, jacket);
      for (const [dx, dy] of [[-0.8, 2.1], [0.7, 2.0], [0.1, 3.0], [-0.6, 3.0], [0.9, 2.9], [0, 1.7]]) {
        ctx.fillStyle = dot;
        circle(ctx, dx, dy + bob, 0.2);
        ctx.fill();
      }
      ctx.strokeStyle = jacketD;
      ctx.lineWidth = 0.1;
      line(ctx, 0, 1.3 + bob, 0, 2.2 + bob);
      // The far arm hangs; the near one has the horn.
      bone(ctx, [[-1.0, 3.2 + bob], [-1.5, 2.3], [-1.35, 1.6]], 0.5, jacket);
      blob(ctx, -1.35, 1.45, 0.34, 0.34, skin);
      const hand = honk ? [lerp(1.5, 0.95, ease(p)), lerp(2.2, 4.0, ease(p))] : [1.55, 2.3 + Math.sin(walk) * 0.15];
      bone(ctx, [[1.0, 3.2 + bob], [1.7, lerp(2.5, 3.5, p)], hand], 0.5, jacket);
      blob(ctx, hand[0], hand[1], 0.34, 0.34, skin);
      // The horn: brass cone with a red bulb the hand squeezes.
      const sq = honk && p > 0.6 ? 0.78 : 1;
      ctx.save();
      ctx.translate(hand[0], hand[1]);
      ctx.rotate(honk ? lerp(-0.2, 1.1, ease(p)) : -0.4);
      outlined(ctx, [[0.2, -0.28], [1.7, -0.9], [1.7, 0.9], [0.2, 0.28]], flash ? FLASH : "#e8b830", INK, 0.1);
      blob(ctx, -0.1, 0, 0.5 * sq, 0.5 * sq, flash ? FLASH : "#e8282a");
      ctx.restore();
      // A ruff and a head.
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = i % 2 ? "#ffffff" : "#bfe8ff";
        circle(ctx, -1.05 + i * 0.35, 3.85 + bob, 0.42);
        ctx.fill();
      }
      const hx = 0.2;
      const hy = 4.6 + bob;
      // Tufts of rainbow hair behind the cone.
      for (const [dx, dy, c] of [[-0.95, 0.1, "#40c878"], [-0.8, 0.55, "#f5c518"], [0.95, 0.1, "#e85ac0"], [0.8, 0.55, "#3a8ee8"]]) {
        ctx.fillStyle = flash ? FLASH : c;
        circle(ctx, hx + dx, hy + dy, 0.5);
        ctx.fill();
      }
      blob(ctx, hx, hy, 1.05, 1.0, skin);
      // The cone hat.
      outlined(ctx, [[hx - 0.8, hy + 0.7], [hx + 0.1, hy + 2.1], [hx + 0.8, hy + 0.7]], flash ? FLASH : "#3a8ee8", INK, 0.1);
      ctx.fillStyle = flash ? FLASH : "#f5c518";
      circle(ctx, hx + 0.1, hy + 2.15, 0.28);
      ctx.fill();
      // The nose, the eyes and the grin.
      blob(ctx, hx + 0.95, hy - 0.05, 0.36, 0.34, flash ? FLASH : "#ff2a2a");
      for (const [ex, ey] of [[0.18, 0.28], [0.72, 0.3]]) {
        blob(ctx, hx + ex, hy + ey, 0.2, 0.26, "#ffffff", INK, 0.08);
        ctx.fillStyle = INK;
        circle(ctx, hx + ex + 0.05, hy + ey, 0.1);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(hx - 0.6, hy - 0.35);
      ctx.quadraticCurveTo(hx + 0.2, hy - 1.5, hx + 0.9, hy - 0.5);
      ctx.quadraticCurveTo(hx + 0.2, hy - 0.5, hx - 0.6, hy - 0.35);
      ctx.fillStyle = flash ? FLASH : "#b0121e";
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.1;
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 4; i++) ctx.fillRect(hx - 0.35 + i * 0.28, hy - 0.52 - Math.sin((i / 3) * Math.PI) * 0.04, 0.17, 0.22);
      glow(hx + 0.95, hy - 0.05, 0.25, "#ff4a4a");
      glow(hx + 0.4, hy + 0.3, 0.2, "#ffe070");
    });
  }

  /* ------------------------------------------------------------ the balloon */

  // A glossy balloon, the acid inside it showing green at its heart, a drip at
  // its knot and a curling string. Bobbing, with a wobble.
  function balloon(ctx, v, m, x, y, t, flash) {
    const col = BALLOON_COLORS[m.id % BALLOON_COLORS.length];
    const wob = Math.sin(t / 300) * 0.1;
    const low = m.life !== undefined && m.life < 1000 && Math.floor(t / 90) % 2 === 0;
    ctx.save();
    ctx.translate(x, y - 0.2);
    ctx.rotate(wob);
    // The string, curling below the knot.
    ctx.strokeStyle = "#e8e0d0";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(0, 0.1);
    ctx.bezierCurveTo(0.6, 0.9, -0.6, 1.7, 0.2, 2.6);
    ctx.stroke();
    // The knot and a drip.
    const f = (t / 650) % 1;
    ctx.fillStyle = ACID;
    circle(ctx, 0.05, 0.25 + f * 1.6, 0.2 * (1 - f * 0.4));
    ctx.fill();
    // The balloon.
    ctx.fillStyle = flash ? FLASH : col;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-1.5, -0.4, -1.7, -2.5, 0, -3.15);
    ctx.bezierCurveTo(1.7, -2.5, 1.5, -0.4, 0, 0);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.12;
    ctx.stroke();
    // The acid inside: a sloshing green window.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-1.5, -0.4, -1.7, -2.5, 0, -3.15);
    ctx.bezierCurveTo(1.7, -2.5, 1.5, -0.4, 0, 0);
    ctx.clip();
    ctx.globalAlpha = low ? 0.95 : 0.78;
    ctx.fillStyle = ACID;
    const lvl = -0.55 + Math.sin(t / 200) * 0.12;
    ctx.beginPath();
    ctx.moveTo(-2, 0.4);
    for (let i = 0; i <= 8; i++) ctx.lineTo(-2 + i * 0.5, lvl + Math.sin(t / 160 + i) * 0.12);
    ctx.lineTo(2, 0.4);
    ctx.fill();
    ctx.fillStyle = "#d8ff70";
    circle(ctx, -0.3, lvl + 0.5, 0.15);
    ctx.fill();
    circle(ctx, 0.35, lvl + 0.8, 0.1);
    ctx.fill();
    ctx.restore();
    // The shine.
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    ellipse(ctx, -0.65, -2.35, 0.2, 0.5);
    ctx.fill();
    v.eyes.push(x, y - 1.5, 0.5, "#b6ff40");
    ctx.restore();
  }

  /* --------------------------------------------------------- the marionette */

  // A wooden puppet on a string that runs to the top of the field: limp and
  // swinging while it hangs, jerking when it is about to drop, strings slack
  // and stepping stiffly when it dances after you. Jointed limbs, a painted
  // face with a hinged jaw.
  function marionette(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const act = m.act || "hang";
    const hung = act === "hang" || act === "warn";
    const warn = act === "warn";
    const drop = act === "drop";
    const wood = flash ? FLASH : WOOD;
    const woodD = flash ? FLASH : WOOD_D;
    const jerk = warn ? (Math.floor(t / 45) % 2 ? 0.32 : -0.32) : 0;
    const sway = hung && !warn ? Math.sin(t / 520 + m.id) * 0.18 : 0;
    const step = act === "dance" ? Math.floor(t / 120) % 2 : 0;
    const topY = y - m.h;
    // The string, straight up (or slack and looping above it when it is free).
    ctx.strokeStyle = "rgba(235, 225, 200, 0.85)";
    ctx.lineWidth = 0.12;
    if (hung || drop) line(ctx, x + jerk + sway * 2, topY - 0.3, x + sway * 0.3, -2);
    else {
      ctx.beginPath();
      ctx.moveTo(x, topY - 0.3);
      ctx.bezierCurveTo(x + 1.6, topY - 2.2, x - 1.8, topY - 3.0, x + 0.4, topY - 4.2);
      ctx.stroke();
    }
    if (hung || drop) {
      ctx.fillStyle = "#e8d8b0";
      circle(ctx, x + jerk + sway * 2, topY - 0.3, 0.22);
      ctx.fill();
    }
    upright(ctx, v, x + jerk, y, dir, (glow) => {
      const swing = hung ? Math.sin(t / 420 + m.id) * 0.25 : 0;
      ctx.save();
      ctx.translate(0, m.h - 0.3);
      ctx.rotate(sway);
      ctx.translate(0, -(m.h - 0.3));
      // The legs: dangling, flung wide in the drop, stepping when it dances.
      const lift = drop ? 0.6 : hung ? 0 : 1;
      for (const s of [-1, 1]) {
        const ph = s > 0 ? step : 1 - step;
        const kx = s * 0.4 + (hung ? swing * s : 0) + (drop ? s * 0.5 : 0);
        const fx = kx + (act === "dance" ? ph * 0.8 - 0.2 : s * 0.1);
        const fy = act === "dance" ? ph * 0.5 : hung ? 0.5 : 0.45;
        bone(ctx, [[s * 0.3, 2.3], [kx, 1.4 + (hung ? 0.4 : 0)], [fx, fy + (hung ? 0.2 : 0)]], 0.42, wood);
        circle(ctx, kx, 1.4 + (hung ? 0.4 : 0), 0.26 * lift + 0.1);
        ctx.fillStyle = woodD;
        ctx.fill();
        blob(ctx, fx + 0.25, fy, 0.55, 0.25, flash ? FLASH : s > 0 ? "#c82a2a" : "#2a58c8");
      }
      // The body: a painted block with a belt, a bow tie and buttons.
      outlined(ctx, [[-0.9, 2.2], [-1.0, 3.7], [1.0, 3.7], [0.9, 2.2]], flash ? FLASH : "#3a8ee8", INK, 0.1);
      ctx.fillStyle = flash ? FLASH : "#f5c518";
      for (const by of [2.6, 3.1]) {
        circle(ctx, 0, by, 0.14);
        ctx.fill();
      }
      ctx.fillRect(-0.95, 2.2, 1.9, 0.22);
      // The arms: up on strings when it hangs? No: limp, hands trailing.
      for (const s of [-1, 1]) {
        const ax = s * 1.15 + (hung ? swing * 1.2 * s : 0) + (act === "dance" ? s * 0.4 * (step ? 1 : -1) : 0);
        const ay = drop ? 4.8 : hung ? 2.5 : act === "dance" ? 3.3 + (s > 0 ? step : 1 - step) * 0.6 : 2.8;
        bone(ctx, [[s * 0.85, 3.5], [s * 1.05 + (drop ? s * 0.4 : 0), (3.5 + ay) / 2], [ax, ay]], 0.36, wood);
        blob(ctx, ax, ay, 0.34, 0.34, flash ? FLASH : "#fff0e0");
      }
      // The head: a wooden ball with painted cheeks and a hinged jaw.
      const jaw = warn || drop ? 0.35 : act === "dance" ? (step ? 0.3 : 0.05) : 0.08;
      blob(ctx, 0, 4.4, 0.95, 0.9, flash ? FLASH : "#e8c898");
      blob(ctx, 0, 3.7 - jaw * 0.5, 0.7, 0.32 + jaw * 0.3, flash ? FLASH : "#d8b078");
      ctx.fillStyle = flash ? FLASH : "#e85a5a";
      circle(ctx, -0.55, 4.2, 0.2);
      ctx.fill();
      circle(ctx, 0.55, 4.2, 0.2);
      ctx.fill();
      // A pointed hat with a pompom.
      outlined(ctx, [[-0.9, 5.05], [0.1, 6.0], [0.9, 5.05]], flash ? FLASH : "#c82a2a", INK, 0.1);
      ctx.fillStyle = "#ffffff";
      circle(ctx, 0.1, 6.05, 0.22);
      ctx.fill();
      // Painted eyes: wide, red-ringed; the pupils track a limp swing.
      for (const ex of [-0.35, 0.38]) {
        blob(ctx, ex, 4.55, 0.25, 0.3, "#ffffff", INK, 0.08);
        ctx.fillStyle = warn || drop ? "#e01818" : INK;
        circle(ctx, ex + 0.04, 4.52, 0.12);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      ctx.moveTo(-0.4, 3.95 - jaw);
      ctx.quadraticCurveTo(0, 3.75 - jaw, 0.4, 3.95 - jaw);
      ctx.stroke();
      glow(0.0, 4.5, 0.25, warn || drop ? EYE_RED : "#ffd890");
      ctx.restore();
    });
  }

  /* -------------------------------------------------------------- Mirror You */

  // A glassy, tinted Planny, a little wrong: mirrored, a hairline crack across
  // him, a glitch band offset to one side, a glint sweeping over his face, and
  // an eye that sits too far out.
  function mirror(ctx, v, m, x, y, t, flash) {
    const act = m.act || "wait";
    const dir = m.dir || -1;
    const step = act === "step" ? clamp(1 - (m.wait || 0) / 600, 0, 1) : act === "wait" ? 0 : 1;
    const duck = Boolean(m.duck) && act === "copy";
    const alpha = act === "wait" ? 0.14 + 0.06 * Math.sin(t / 240) : 0.25 + 0.75 * step;
    const sink = (1 - step) * 1.2;
    const sh = duck ? 0.55 : 1;
    const glitch = Math.floor(t / 90) % 7 === 0 ? 0.35 : 0.12;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y + sink);
    ctx.scale(dir * (duck ? 1.15 : 1), sh);
    const body = (dx, tint, bodyTint) => {
      // Two small feet, a glass box, stick arms.
      for (const s of [-1, 1]) {
        blob(ctx, dx + s * 0.8, -0.25, 0.7, 0.28, tint);
        bone(ctx, [[dx + s * 1.5, -2.2], [dx + s * 2.3, -1.5], [dx + s * 2.5 + (act === "copy" ? Math.sin(t / 200) * 0.2 : 0), -0.8 + (s > 0 ? 0.3 : 0)]], 0.22, tint, "rgba(10, 40, 60, 0.9)");
      }
      ctx.fillStyle = bodyTint;
      roundBox(ctx, dx - 1.6, -4.6, 3.2, 4.2, 0.55);
      ctx.fill();
    };
    body(0, flash ? FLASH : GLASS, flash ? FLASH : "rgba(120, 214, 245, 0.92)");
    // The box's edge and the glass inside it.
    ctx.strokeStyle = "rgba(10, 60, 90, 0.95)";
    ctx.lineWidth = 0.16;
    roundBox(ctx, -1.6, -4.6, 3.2, 4.2, 0.55);
    ctx.stroke();
    ctx.fillStyle = "rgba(190, 240, 255, 0.55)";
    roundBox(ctx, -1.25, -4.3, 1.1, 3.6, 0.3);
    ctx.fill();
    // A diagonal glint sweeping across.
    const sweep = ((t / 900) % 2) - 0.5;
    ctx.save();
    roundBox(ctx, -1.6, -4.6, 3.2, 4.2, 0.55);
    ctx.clip();
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    poly(ctx, [[-1.6 + sweep * 4, -4.6], [-0.9 + sweep * 4, -4.6], [-2.1 + sweep * 4, -0.4], [-2.8 + sweep * 4, -0.4]]);
    ctx.fill();
    // The glitch band: a slice of the glass shifted aside.
    ctx.fillStyle = "rgba(255, 90, 200, 0.5)";
    ctx.fillRect(-1.6 + glitch * 3, -3.2, 3.2, 0.32);
    ctx.fillStyle = "rgba(40, 255, 230, 0.55)";
    ctx.fillRect(-1.6 - glitch * 3, -2.4, 3.2, 0.22);
    ctx.restore();
    // The hairline crack.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 0.08;
    ctx.beginPath();
    ctx.moveTo(0.9, -4.6);
    ctx.lineTo(0.35, -3.6);
    ctx.lineTo(0.8, -3.0);
    ctx.lineTo(-0.1, -2.1);
    ctx.lineTo(0.3, -1.4);
    ctx.stroke();
    // The star eye, set too far out, and a smile that is not quite level.
    ctx.fillStyle = "#e8fbff";
    ctx.strokeStyle = "rgba(10, 60, 90, 0.95)";
    ctx.lineWidth = 0.07;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU - Math.PI / 2 + Math.sin(t / 700) * 0.15;
      const r = i % 2 ? 0.2 : 0.52;
      ctx.lineTo(0.95 + Math.cos(a) * r, -3.55 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = "rgba(10, 60, 90, 0.95)";
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    ctx.moveTo(-0.6, -1.5);
    ctx.quadraticCurveTo(0.4, -0.9, 1.2, -1.75);
    ctx.stroke();
    ctx.restore();
    if (act !== "wait") v.eyes.push(x + dir * 0.95, y + sink - (duck ? 2.0 : 3.55), 0.3, "#9fe6ff");
    if (act === "wait") v.eyes.push(x, y - 2.2, 0.5 + Math.sin(t / 240) * 0.1, "#6acaf0");
  }

  function roundBox(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ----------------------------------------------------------- the strongman */

  // A barbell lying along (-len, len) at the origin, `plate` big plates at each end.
  function barbellShape(ctx, len, plate, flash) {
    bone(ctx, [[-len, 0], [len, 0]], 0.3, flash ? FLASH : "#9a9aa8");
    for (const s of [-1, 1]) {
      blob(ctx, s * len, 0, plate * 0.38, plate, flash ? FLASH : "#3a3a44");
      blob(ctx, s * (len - plate * 0.42), 0, plate * 0.3, plate * 0.82, flash ? FLASH : "#555563");
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(s * len - plate * 0.14, -plate * 0.8, plate * 0.12, plate * 1.3);
    }
  }

  // A strongman: a Glutton gone to the circus. Bald and bull-necked with a
  // curled handlebar mustache, a red-and-white striped singlet over a great
  // barrel chest, bulging arms, a belt, striped tights and boots. Winding up he
  // hoists the barbell over his head, leaning back.
  function strongman(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const wind = m.act === "wind";
    const p = wind ? clamp(1 - (m.wait || 0) / 600, 0, 1) : 0;
    const walk = wind ? 0 : t / 260;
    const bob = wind ? 0 : Math.abs(Math.sin(walk)) * 0.14;
    const skin = flash ? FLASH : "#e8a878";
    const skinD = flash ? FLASH : "#b87850";
    upright(ctx, v, x, y, dir, (glow) => {
      const lean = wind ? -0.12 * ease(p) : 0.05;
      // Boots and striped tights.
      for (const s of [-1, 1]) {
        const stp = wind ? 0 : Math.sin(walk + (s > 0 ? Math.PI : 0)) * 0.3;
        bone(ctx, [[s * 0.9, 2.9 + bob], [s * 1.0 + stp * 0.4, 1.4], [s * 1.0 + stp, 0.7]], 1.15, flash ? FLASH : s > 0 ? "#e8e0d0" : "#d8302e");
        outlined(ctx, [[s * 1.0 + stp - 0.7, 0.7], [s * 1.0 + stp + 0.9, 0.7], [s * 1.0 + stp + 1.15, 0.12], [s * 1.0 + stp - 0.7, 0.12]], flash ? FLASH : "#2a1a14");
      }
      ctx.save();
      ctx.translate(0, 3 + bob);
      ctx.rotate(-lean);
      // The barrel chest in a striped singlet.
      const torso = [[-1.9, 0], [-2.5, 1.9], [-1.5, 3.3], [1.5, 3.3], [2.5, 1.9], [1.9, 0]];
      poly(ctx, torso);
      ctx.fillStyle = flash ? FLASH : "#f2ece0";
      ctx.fill();
      ctx.save();
      poly(ctx, torso);
      ctx.clip();
      if (!flash) {
        ctx.fillStyle = "#d8302e";
        for (let i = -3; i <= 3; i += 2) ctx.fillRect(i * 0.55 - 0.28, -0.2, 0.55, 4);
      }
      // Straps and the bare shoulders.
      ctx.fillStyle = skin;
      ctx.fillRect(-2.7, 2.7, 1.1, 1);
      ctx.fillRect(1.6, 2.7, 1.1, 1);
      ctx.restore();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.14;
      poly(ctx, torso);
      ctx.stroke();
      // The belt and its buckle.
      ctx.fillStyle = flash ? FLASH : "#4a2a14";
      ctx.fillRect(-1.95, -0.1, 3.9, 0.55);
      ctx.fillStyle = flash ? FLASH : GOLD;
      ctx.fillRect(-0.3, -0.05, 0.6, 0.45);
      // The head: bald, small on its thick neck, a handlebar mustache.
      ctx.fillStyle = skin;
      ctx.fillRect(-0.6, 3.2, 1.2, 0.7);
      blob(ctx, 0.15, 4.5, 0.95, 0.9, skin);
      ctx.fillStyle = flash ? FLASH : "#3a2210";
      ctx.beginPath();
      ctx.moveTo(-0.05, 4.1);
      ctx.quadraticCurveTo(0.55, 3.85, 1.25, 4.15);
      ctx.quadraticCurveTo(1.7, 4.0, 1.7, 4.5);
      ctx.quadraticCurveTo(1.25, 4.05, 0.55, 4.25);
      ctx.quadraticCurveTo(0.2, 4.1, -0.5, 4.5);
      ctx.quadraticCurveTo(-0.7, 3.9, -0.05, 4.1);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(1.75, 4.65, 0.2, 0, TAU);
      ctx.stroke();
      for (const ex of [0.4, 1.0]) {
        blob(ctx, ex, 4.75, 0.17, 0.12, "#ffffff", null);
        ctx.fillStyle = INK;
        circle(ctx, ex + 0.04, 4.74, 0.07);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.1;
      line(ctx, 0.25, 4.95, 0.65, 4.88);
      line(ctx, 0.8, 4.88, 1.25, 4.98);
      // A brass-bound tuft on the brow.
      ctx.fillStyle = flash ? FLASH : "#3a2210";
      ctx.beginPath();
      ctx.moveTo(0.1, 5.35);
      ctx.quadraticCurveTo(0.1, 5.9, 0.4, 5.6);
      ctx.fill();
      glow(0.7, 7.75 + bob, 0.22, EYE_AMBER);
      // The arms: great knotted biceps. Down holding the bar at his side, or hoisting it overhead.
      const up = ease(p);
      for (const s of [-1, 1]) {
        const sx = s * 2.35;
        const hx = lerp(s * 2.9, s * 1.5, up);
        const hy = lerp(-0.2, 6.2, up);
        const ex = lerp(s * 3.5, s * 3.0, up);
        const ey = lerp(1.5, 4.5, up);
        bone(ctx, [[sx, 2.9], [ex, ey], [hx, hy]], 1.05, skin);
        blob(ctx, ex, ey + (up > 0.5 ? 0.3 : 0.1), 0.75, 0.62, skin, skinD, 0.1);
        blob(ctx, hx, hy, 0.45, 0.45, skin);
      }
      // The barbell: at his side while walking, overhead when winding up.
      ctx.save();
      ctx.translate(lerp(2.9, 0, up) * (wind ? 1 : 1), lerp(-0.2, 6.9, up));
      ctx.rotate(lerp(Math.PI / 2, 0, up));
      barbellShape(ctx, lerp(1.5, 2.7, up), 1.1, flash);
      ctx.restore();
      ctx.restore();
    });
  }

  /* ----------------------------------------------------------- circus hounds */

  // A hoop of fire, seen a little edge-on: a ring of flame with tongues licking
  // off it. `big` scales it and `k` is its flare, 0 to 1.
  function hoop(ctx, v, cx, cy, rx, ry, t, k) {
    if (k <= 0) return;
    ctx.save();
    ctx.globalAlpha = clamp(k, 0, 1);
    ctx.strokeStyle = "#ffe27a";
    ctx.lineWidth = 0.55;
    ellipse(ctx, cx, cy, rx, ry);
    ctx.stroke();
    ctx.strokeStyle = "#ff8a1a";
    ctx.lineWidth = 0.3;
    ellipse(ctx, cx, cy, rx + 0.2, ry + 0.2);
    ctx.stroke();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU + t / 700;
      const fl = 0.5 + 0.5 * Math.sin(t / 70 + i * 2.1);
      const px = cx + Math.cos(a) * (rx + 0.2);
      const py = cy + Math.sin(a) * (ry + 0.2);
      ctx.fillStyle = i % 2 ? "#ff8a1a" : "#ffd23a";
      poly(ctx, [[px - 0.18, py + 0.1], [px + Math.cos(a) * 0.5 * (0.6 + fl), py + Math.sin(a) * 0.9 * (0.6 + fl) - 0.4], [px + 0.18, py + 0.1]]);
      ctx.fill();
    }
    ctx.restore();
    v.eyes.push(cx, cy, Math.max(rx, ry) * 1.1 * k, "#ff9a3a");
  }

  // A circus hound: an orange dog with white spots, a ruff of red and yellow
  // zigzag, pricked ears and a bright eye. Crouching, it sinks onto its front
  // legs, haunches up, and a hoop of fire flares ahead of it; leaping, it is
  // stretched out and the hoop travels round its nose.
  function circushound(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const act = m.act || "prowl";
    const crouch = act === "crouch" ? clamp(1 - (m.wait || 0) / 450, 0, 1) : 0;
    const leap = act === "leap";
    const rest = act === "rest";
    const run = act === "prowl" || act === "burst";
    const ph = t / 70;
    const coat = flash ? FLASH : "#e8801e";
    const coatD = flash ? FLASH : "#b85a10";
    const white = flash ? FLASH : "#fff0e0";
    upright(ctx, v, x, y, dir, (glow) => {
      const pitch = leap ? clamp((m.vy || 0) / 90, -0.6, 0.6) : 0;
      ctx.save();
      ctx.translate(0, leap ? 1.7 : 1.45 - crouch * 0.4 + (rest ? -0.1 : 0));
      ctx.rotate(pitch * 0.8 + (crouch ? crouch * 0.12 : 0));
      // The legs: galloping while it prowls, folded and then stretched fore and aft.
      const legs = [[-1.1, 0], [-0.7, 1], [0.9, 0], [1.3, 1]];
      for (const [lx, far] of legs) {
        const a = ph + (far ? 0 : Math.PI) + lx;
        const fx = leap ? (lx > 0 ? lx + 1.0 : lx - 1.0) : lx + (run ? Math.sin(a) * 0.55 : 0) - (crouch && lx > 0 ? -0.35 * crouch : 0);
        const fy = leap ? -0.7 : -1.2 + crouch * 0.4 + (run ? Math.max(0, Math.cos(a)) * 0.5 : 0);
        bone(ctx, [[lx, -0.15], [(lx + fx) / 2, -0.7], [fx, fy]], 0.42, far ? coatD : coat);
        blob(ctx, fx + 0.12, fy - 0.05, 0.3, 0.17, white);
      }
      // The body, with spots.
      blob(ctx, 0, 0.1, 1.95, 0.9, coat);
      for (const [sx, sy, sr] of [[-1.0, 0.3, 0.3], [0.1, -0.1, 0.33], [-0.4, 0.55, 0.2], [0.9, 0.35, 0.26]]) {
        ctx.fillStyle = white;
        circle(ctx, sx, sy, sr);
        ctx.fill();
      }
      // The tail, wagging high.
      const wag = Math.sin(t / (run ? 55 : 130)) * 0.4;
      bone(ctx, [[-1.8, 0.4], [-2.4 + wag * 0.3, 1.2], [-2.5 + wag, 1.9]], 0.34, coat);
      // The ruff and the head.
      for (let i = 0; i < 6; i++) {
        const a = -1.4 + i * 0.55;
        outlined(ctx, [[1.5 + Math.cos(a) * 0.5, 0.45 + Math.sin(a) * 0.55], [1.5 + Math.cos(a - 0.2) * 1.15, 0.45 + Math.sin(a - 0.2) * 1.1], [1.5 + Math.cos(a + 0.2) * 1.15, 0.45 + Math.sin(a + 0.2) * 1.1]], i % 2 ? (flash ? FLASH : "#ffd23a") : flash ? FLASH : "#d8302e", INK, 0.07);
      }
      const hx = 2.35;
      const hy = 1.0 + (crouch ? -0.35 * crouch : 0);
      blob(ctx, hx, hy, 0.82, 0.72, coat);
      outlined(ctx, [[hx + 0.5, hy + 0.1], [hx + 1.55, hy - 0.05], [hx + 1.5, hy - 0.4], [hx + 0.55, hy - 0.5]], white);
      blob(ctx, hx + 1.55, hy - 0.08, 0.2, 0.15, "#14100a", null);
      outlined(ctx, [[hx - 0.5, hy + 0.5], [hx - 0.15, hy + 1.45], [hx + 0.2, hy + 0.55]], coatD, INK, 0.08);
      outlined(ctx, [[hx + 0.05, hy + 0.6], [hx + 0.45, hy + 1.4], [hx + 0.65, hy + 0.5]], coat, INK, 0.08);
      if (leap || crouch > 0.5) {
        ctx.fillStyle = "#b0121e";
        poly(ctx, [[hx + 0.6, hy - 0.25], [hx + 1.4, hy - 0.2], [hx + 1.2, hy - 0.65], [hx + 0.65, hy - 0.5]]);
        ctx.fill();
      }
      blob(ctx, hx + 0.35, hy + 0.2, 0.2, 0.17, "#ffffff", null);
      ctx.fillStyle = INK;
      circle(ctx, hx + 0.4, hy + 0.2, 0.08);
      ctx.fill();
      glow(hx + 0.35, hy + 0.2 + (leap ? 1.7 : 1.45 - crouch * 0.4), 0.2, "#ffb040");
      ctx.restore();
      // The hoop: flaring ahead as it crouches, round its nose in the leap.
      if (crouch > 0) hoop(ctx, v, 4.9, 2.7, 0.8 + crouch * 0.4, 2.9, t, ease(crouch));
      else if (leap) hoop(ctx, v, 4.7, 1.9 + clamp((m.vy || 0) / 60, -0.8, 0.8), 0.9, 3.0, t, 1);
    });
  }

  /* --------------------------------------------------------- the Ringmaster */

  const GANTRY_RAIL_Y = 50;
  const PUP_H = 18;
  const HAND_UP = 9;
  const HAND_X = 6.5;

  // The Ringmaster's gantry: a deck on two hangers from a rail along the top of
  // the tent, bulbs along its lip, the crossbar the three strings are tied to.
  function gantry(ctx, v, b, up, t) {
    const FH = v.g.FIELD_H;
    const spec = v.spec;
    const dy = FH - b.y;
    const x0 = spec.arena + 2;
    const x1 = spec.length - 2;
    ctx.strokeStyle = "#2a2a34";
    ctx.lineWidth = 0.5;
    line(ctx, x0, FH - GANTRY_RAIL_Y, x1, FH - GANTRY_RAIL_Y);
    ctx.strokeStyle = "#8a8a9a";
    ctx.lineWidth = 0.14;
    line(ctx, x0, FH - GANTRY_RAIL_Y - 0.2, x1, FH - GANTRY_RAIL_Y - 0.2);
    // The hangers and their wheels on the rail.
    for (const s of [-1, 1]) {
      const hx = b.x + s * 4.3;
      ctx.strokeStyle = "#4a4a58";
      ctx.lineWidth = 0.28;
      line(ctx, hx, FH - GANTRY_RAIL_Y, hx, dy + 0.3);
      blob(ctx, hx, FH - GANTRY_RAIL_Y + 0.1, 0.7, 0.7, "#6a6a7a");
    }
    // The deck.
    outlined(ctx, [[b.x - 5.2, dy], [b.x + 5.2, dy], [b.x + 4.8, dy + 0.9], [b.x - 4.8, dy + 0.9]], "#7a2a1e", INK, 0.12);
    ctx.fillStyle = GOLD;
    ctx.fillRect(b.x - 5.0, dy - 0.02, 10, 0.2);
    for (let i = 0; i < 6; i++) {
      const on = Math.floor(t / 260 + i) % 2 === 0;
      ctx.fillStyle = on ? "#ffe27a" : "#a07a2a";
      circle(ctx, b.x - 4.4 + i * 1.76, dy + 0.55, 0.22);
      ctx.fill();
    }
    // The crossbar of the control, with a peg for each string.
    if (up) {
      const by = dy - 1.0;
      bone(ctx, [[b.x - 4.8, by], [b.x + 4.8, by]], 0.4, "#c8a05a");
      for (const px of [-4, 0, 4]) {
        ctx.fillStyle = GOLD;
        circle(ctx, b.x + px, by, 0.3);
        ctx.fill();
      }
    }
  }

  // The Ringmaster himself, on the gantry or down on the floor: a red tailcoat,
  // white shirt, bow tie, great mustache and a tall hat; hands on the crossbar,
  // or raised with the whip coiled in one, or, open, dazed with stars about him.
  function ringman(ctx, v, b, t, flash) {
    const FH = v.g.FIELD_H;
    const dir = b.dir || -1;
    const x = b.x;
    const y = FH - b.y;
    const open = Boolean(b.open);
    const lashing = b.act === "lashWind";
    const coat = flash ? FLASH : b.raged ? "#c4101c" : "#b8202a";
    const coatD = flash ? FLASH : "#6a0e16";
    const skin = flash ? FLASH : "#f0c8a0";
    const sway = open ? Math.sin(t / 160) * 0.18 : Math.sin(t / 500) * 0.06;
    upright(ctx, v, x, y, dir, (glow) => {
      ctx.save();
      ctx.translate(0, 0);
      ctx.rotate(sway * 0.5);
      // Boots and striped trousers.
      for (const s of [-1, 1]) {
        bone(ctx, [[s * 0.8, 3.4], [s * 0.85, 1.6]], 1.05, flash ? FLASH : "#1a1620");
        ctx.fillStyle = flash ? FLASH : "#e8e0d0";
        ctx.fillRect(s * 0.8 - 0.07, 1.7, 0.14, 1.7);
        outlined(ctx, [[s * 0.85 - 0.7, 1.7], [s * 0.85 + 0.6, 1.7], [s * 0.85 + 1.2, 0.2], [s * 0.85 - 0.7, 0.2]], flash ? FLASH : "#0e0a10");
        ctx.fillStyle = flash ? FLASH : "#a8a0b0";
        ctx.fillRect(s * 0.85 - 0.7, 1.45, 1.3, 0.2);
      }
      // The tails of the coat, flaring behind.
      outlined(ctx, [[-0.9, 3.8], [-2.3, 2.0], [-1.4, 1.9], [-0.6, 2.6], [0.1, 1.9], [0.6, 3.4]], coatD);
      // The coat and the shirt front.
      outlined(ctx, [[-1.6, 3.4], [-1.9, 6.0], [-1.0, 6.9], [1.0, 6.9], [1.9, 6.0], [1.6, 3.4]], coat);
      outlined(ctx, [[-0.55, 6.9], [0.55, 6.9], [0.3, 4.0], [-0.3, 4.0]], flash ? FLASH : "#fffaf0", INK, 0.08);
      ctx.fillStyle = GOLD;
      for (const by of [4.6, 5.3, 6.0]) {
        circle(ctx, 0, by, 0.12);
        ctx.fill();
      }
      ctx.fillStyle = flash ? FLASH : "#d8101e";
      poly(ctx, [[-0.55, 6.6], [0, 6.35], [-0.55, 6.1]]);
      ctx.fill();
      poly(ctx, [[0.55, 6.6], [0, 6.35], [0.55, 6.1]]);
      ctx.fill();
      // Epaulettes.
      for (const s of [-1, 1]) blob(ctx, s * 1.65, 6.4, 0.45, 0.22, flash ? FLASH : GOLD);
      // Arms.
      const handF = [1.5, 3.3];
      const handB = [-0.1, 3.3];
      if (lashing) {
        // The whip arm up and back, the coil over his shoulder; the other out for balance.
        const p = clamp(1 - (b.wait || 0) / 700, 0, 1);
        const hand = [lerp(1.4, -1.2, ease(p)), lerp(3.4, 9.0, ease(p))];
        bone(ctx, [[0.9, 6.3], [lerp(1.8, -0.5, p), lerp(5, 8, p)], hand], 0.5, coat);
        blob(ctx, hand[0], hand[1], 0.38, 0.38, "#ffffff");
        ctx.strokeStyle = flash ? FLASH : "#3a2210";
        ctx.lineWidth = 0.18;
        ctx.beginPath();
        ctx.arc(hand[0] - 0.5, hand[1] + 0.9, 0.8 + 0.1 * Math.sin(t / 60), 0, TAU * 0.85);
        ctx.stroke();
        bone(ctx, [[-0.9, 6.3], [-2.4, 5.2], [-2.8, 6.4]], 0.5, coat);
        blob(ctx, -2.8, 6.5, 0.38, 0.38, "#ffffff");
      } else if (open) {
        // Dazed: arms hanging.
        for (const s of [-1, 1]) {
          bone(ctx, [[s * 1.0, 6.3], [s * 2.0, 4.5], [s * 2.3, 3.0 + Math.sin(t / 150 + s)]], 0.5, coat);
          blob(ctx, s * 2.3, 2.9 + Math.sin(t / 150 + s), 0.38, 0.38, "#ffffff");
        }
      } else {
        const wig = Math.sin(t / 130) * 0.15;
        bone(ctx, [[0.9, 6.3], [1.7, 4.6], [handF[0], handF[1] + wig]], 0.5, coat);
        blob(ctx, handF[0], handF[1] + wig, 0.38, 0.38, "#ffffff");
        bone(ctx, [[-0.9, 6.3], [-0.5, 4.6], [handB[0], handB[1] - wig]], 0.5, coat);
        blob(ctx, handB[0], handB[1] - wig, 0.38, 0.38, "#ffffff");
      }
      // The head.
      const tilt = open ? Math.sin(t / 200) * 0.2 : 0;
      ctx.save();
      ctx.translate(0.1, 7.7);
      ctx.rotate(tilt);
      blob(ctx, 0, 0, 1.0, 0.95, skin);
      // The mustache, curled, and the eyes.
      ctx.fillStyle = flash ? FLASH : "#1a1008";
      ctx.beginPath();
      ctx.moveTo(-0.1, -0.35);
      ctx.quadraticCurveTo(0.7, -0.7, 1.45, -0.15);
      ctx.quadraticCurveTo(1.95, -0.1, 1.9, 0.4);
      ctx.quadraticCurveTo(1.5, -0.15, 0.8, -0.2);
      ctx.quadraticCurveTo(0.2, -0.2, -0.6, 0.0);
      ctx.quadraticCurveTo(-0.7, -0.5, -0.1, -0.35);
      ctx.fill();
      for (const ex of [0.15, 0.7]) {
        blob(ctx, ex, 0.25, 0.2, 0.14, "#ffffff", null);
        ctx.fillStyle = b.raged ? "#ff2a12" : INK;
        circle(ctx, ex + 0.04, 0.25, 0.08);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.1;
      line(ctx, -0.05, 0.55, 0.4, 0.45);
      line(ctx, 0.55, 0.45, 1.0, 0.58);
      // The tall hat, a gold band and a red flower; askew when he is dazed.
      ctx.save();
      ctx.translate(0, 0.8);
      ctx.rotate(open ? 0.35 : 0);
      outlined(ctx, [[-1.5, 0], [1.5, 0], [1.4, 0.3], [-1.4, 0.3]], flash ? FLASH : "#16121c");
      outlined(ctx, [[-0.95, 0.2], [-0.85, 2.7], [0.85, 2.7], [0.95, 0.2]], flash ? FLASH : "#16121c");
      ctx.fillStyle = flash ? FLASH : GOLD;
      ctx.fillRect(-0.93, 0.5, 1.86, 0.4);
      ctx.fillStyle = "#d8101e";
      circle(ctx, 0.6, 0.7, 0.2);
      ctx.fill();
      ctx.restore();
      glow(0.7, 0.25, 0.25, b.raged ? EYE_RED : EYE_AMBER);
      ctx.restore();
      ctx.restore();
    });
    // The stars of a dazed man.
    if (open) {
      ctx.fillStyle = GOLD;
      for (let i = 0; i < 4; i++) {
        const a = t / 220 + (i * TAU) / 4;
        circle(ctx, x + Math.cos(a) * 2.3, y - 11.2 + Math.sin(a) * 0.55, 0.32);
        ctx.fill();
      }
    }
  }

  // A string: from the crossbar peg to the puppet, thin, sagging a little when it is slack; frayed once it
  // has been hit; cut, it hangs limp from the peg.
  function stringLine(ctx, ax, ay, bx, by, st, t, down, slack = 0, i = 0) {
    const cut = st.hp <= 0;
    const frac = st.hp / Math.max(1, st.max);
    ctx.lineCap = "round";
    if (cut || down) {
      ctx.strokeStyle = "rgba(235, 225, 200, 0.8)";
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax + Math.sin(t / 300 + ax) * 0.8, ay + 2.4, ax + Math.sin(t / 240 + ax) * 1.2, ay + 5);
      ctx.stroke();
    } else {
      const hurt = st.hurt > 0;
      ctx.strokeStyle = hurt ? "#ffffff" : "rgba(240, 230, 205, 0.9)";
      ctx.lineWidth = hurt ? 0.3 : 0.1 + 0.07 * frac;
      // Slack sags a little off the straight line (never farther than a bolt's reach of it), taut is straight.
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const off = slack * (0.55 + 0.25 * Math.sin(t / 260 + i * 2)) * 2 * (i % 2 ? 1 : -1);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2 - ((by - ay) / len) * off, (ay + by) / 2 + ((bx - ax) / len) * off, bx, by);
      ctx.stroke();
      if (frac < 1) {
        // Frayed: little kinks and loose threads along it.
        ctx.lineWidth = 0.08;
        for (let i = 1; i <= 3 - Math.round(frac * 2); i++) {
          const q = i / 4.2;
          const mx = lerp(ax, bx, q);
          const my = lerp(ay, by, q);
          line(ctx, mx, my, mx + 0.5 * (i % 2 ? 1 : -1), my + 0.35);
        }
      }
    }
    ctx.lineCap = "butt";
  }

  // The giant puppet at (px, floor): a wooden clown with a painted grin, a harlequin
  // jacket, jointed limbs and huge shoes, hung by head and hands. Its pose comes from
  // the boss's fields: `lift` (a leap's height), `crouch` (the leap's wind-up, a landing's
  // squash, a crash's slump), `stretch` (the leap, legs and arms flung wide), `rear` (the
  // charge's wind-up, up on its heels with the arms high), `lean` (-1 to 1, toward +x) and
  // `walk` (units a second: the gait, a run at the charge). The head and hands are where the
  // strings tie (`b.pts`). A cut hand string lets that arm drop; a cut head string lets the
  // head sag. Collapsed it lies in a heap.
  function puppet(ctx, v, b, t, flash) {
    const FH = v.g.FIELD_H;
    const px = b.px ?? b.x;
    const floor = b.floor ?? 6;
    const fl = FH - floor;
    const st = b.strings || [{ hp: 3, max: 3 }, { hp: 3, max: 3 }, { hp: 3, max: 3 }];
    const down = b.puppet === "down";
    const wood = flash ? FLASH : "#c8985a";
    const woodD = flash ? FLASH : "#8a5a2a";
    const jac1 = flash ? FLASH : "#2a8ee8";
    const jac2 = flash ? FLASH : "#f2c418";
    const stomping = b.act === "stompWind";
    const lift = stomping ? ease(clamp(1 - (b.wait || 0) / 750, 0, 1)) : 0;
    const air = b.lift || 0;
    const crouch = b.crouch || 0;
    const stretch = b.stretch || 0;
    const rear = b.rear || 0;
    const lean = b.lean || 0;
    const speed = b.walk === undefined ? 10 : b.walk;
    const walking = speed > 0.5;
    const running = b.act === "charge";
    const gait = running ? t / 75 : t / 240;
    const stride = running ? 1.7 : clamp(speed / 10, 0, 1);
    const bob = down ? 0 : Math.sin(t / 380) * 0.2;
    const dip = crouch * 2.8;
    const sq = b.squash > 0 ? b.squash / 260 : 0;
    ctx.save();
    ctx.translate(px, fl - air);
    ctx.scale(1, -1);
    if (sq > 0) {
      ctx.scale(1 + 0.14 * sq, 1 - 0.1 * sq);
    }
    if (down) {
      // A heap on the floor: the torso on its side, the head rolled off, limbs strewn.
      ctx.save();
      ctx.translate(0, 2.3);
      ctx.rotate(0.12);
      outlined(ctx, [[-3.6, -1.6], [3.6, -2.0], [3.4, 2.0], [-3.8, 1.8]], jac1);
      ctx.fillStyle = jac2;
      for (let i = -3; i <= 3; i += 2) poly(ctx, [[i - 0.5, -1.6], [i + 0.5, -1.7], [i + 0.1, 1.9], [i - 0.6, 1.8]]);
      ctx.fill();
      ctx.restore();
      bone(ctx, [[3.4, 1.0], [6.6, 0.5], [8.4, 1.4]], 1.2, wood);
      bone(ctx, [[-3.6, 0.8], [-6.4, 1.6], [-8.2, 0.6]], 1.2, wood);
      bone(ctx, [[1.4, 0.3], [3.4, -0.2], [5.0, 0.8]], 1.3, jac1);
      outlined(ctx, [[4.4, 0.9], [8.0, 1.0], [8.4, 0.1], [4.6, 0.0]], flash ? FLASH : "#d8101e");
      blob(ctx, -0.5, 4.6, 2.1, 2.0, flash ? FLASH : "#f2e4c8");
      face(ctx, -0.5, 4.6, 0.9, t, false, true);
      ctx.restore();
      return;
    }
    // Shoes and legs: the near foot rises before a stomp; knees bend wide in a crouch;
    // flung apart in a leap; pumping at a run.
    const hipY = 6.2 + bob - dip;
    for (const s of [-1, 1]) {
      const ph = gait + (s > 0 ? Math.PI : 0);
      const swing = walking ? Math.sin(ph) * stride : 0;
      const up = s > 0 ? lift * 3.2 : 0;
      const spread = crouch * 1.6 + stretch * 2.4 + rear * 0.8;
      const fx = s * (2.3 + spread) + swing * (running ? 1.8 : 0.5) + (stretch ? s * lean * 0.8 : 0);
      const fy = Math.max(0, swing) * (running ? 1.8 : 0.7) + up + stretch * 1.6;
      const kx = s * (2.0 + crouch * 2.6 + stretch * 1.6) + swing * 0.3;
      bone(ctx, [[s * 1.7, hipY], [kx, 3.8 + fy * 0.5 - crouch * 1.1], [fx, 1.5 + fy]], 1.9, jac2);
      ctx.fillStyle = jac1;
      circle(ctx, kx, 3.9 + fy * 0.5 - crouch * 1.1, 0.55);
      ctx.fill();
      outlined(ctx, [[fx - 1.4, 1.9 + fy], [fx + 2.6, 1.9 + fy], [fx + 3.0, 0.55 + fy], [fx + 2.7, 0.0 + fy], [fx - 1.5, 0.0 + fy]], flash ? FLASH : s > 0 ? "#d8101e" : "#2a58c8");
      ctx.fillStyle = "#ffffff";
      circle(ctx, fx + 1.3, 1.05 + fy, 0.5);
      ctx.fill();
    }
    // The torso (leaning from the hips): a harlequin jacket with great buttons and a ruff.
    ctx.save();
    ctx.translate(0, hipY);
    ctx.rotate(-lean * 0.2);
    ctx.translate(0, -hipY);
    const top = 12.6 + bob - dip;
    const tr = [[-3.5, hipY], [-3.9, top], [3.9, top], [3.5, hipY]];
    poly(ctx, tr);
    ctx.fillStyle = jac1;
    ctx.fill();
    ctx.save();
    poly(ctx, tr);
    ctx.clip();
    ctx.fillStyle = jac2;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if ((r + c) % 2) {
      const y0 = hipY + r * ((top - hipY) / 3.8);
      poly(ctx, [[-4.2 + c * 2.1, y0], [-3.1 + c * 2.1, y0 + 0.85], [-4.2 + c * 2.1 + 2.1, y0], [-3.1 + c * 2.1, y0 - 0.85]]);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.16;
    poly(ctx, tr);
    ctx.stroke();
    for (const f of [0.3, 0.64]) blob(ctx, 0, lerp(hipY, top, f), 0.62, 0.62, flash ? FLASH : "#d8101e");
    // The head: a pale wooden ball on a neck, sagging forward when its string is cut, the neck
    // stretching when it rears or leaps.
    const sag = st[0].hp <= 0 ? 1 : 0;
    ctx.save();
    ctx.translate(0, top);
    ctx.rotate(sag * 0.55);
    ctx.translate(0, -top + rear * 1.5 + stretch);
    bone(ctx, [[0, top - 0.2], [0, top + 1.4]], 1.2, woodD);
    const hy0 = top + 3.3;
    blob(ctx, 0, hy0, 2.3, 2.3, flash ? FLASH : "#f2e4c8");
    // A pointed hat with a ring at its tip, where the head string ties.
    outlined(ctx, [[-2.1, hy0 + 1.4], [0, hy0 + 4.5], [2.1, hy0 + 1.4]], flash ? FLASH : "#d8101e");
    ctx.fillStyle = flash ? FLASH : GOLD;
    ctx.fillRect(-2.15, hy0 + 1.3, 4.3, 0.5);
    ctx.strokeStyle = "#e8d8b0";
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.arc(0, hy0 + 4.9, 0.4, 0, TAU);
    ctx.stroke();
    face(ctx, 0, hy0 - 0.3, 1, t, b.raged, false, b.dazed);
    ctx.restore();
    ctx.restore();
    // The arms: out on their strings (the hands are where the strings tie), or let drop
    // when the string is cut.
    const armUp = stomping ? lift * 1.2 : 0;
    for (const [s, i] of [[-1, 1], [1, 2]]) {
      const cut = st[i].hp <= 0;
      const hand = b.pts ? b.pts[i] : [px + s * HAND_X, floor + HAND_UP];
      const hx = cut ? s * 5.0 + lean * 1.2 : hand[0] - px + (walking && !running ? Math.sin(gait + i) * 0.4 : 0);
      const hy = cut ? 4.5 - dip : hand[1] - floor - air + armUp + (running ? 0 : Math.sin(t / 310 + i) * 0.3);
      const shx = s * 3.5 + lean * 1.4;
      const shy = top - 0.6;
      const ex = cut ? s * 5.4 : (shx + hx) / 2 + s * 0.7;
      const ey = cut ? 8 - dip : (shy + hy) / 2 + (rear || stretch ? 0.4 : -0.3);
      bone(ctx, [[shx, shy], [ex, ey], [hx, hy]], 1.5, wood);
      blob(ctx, ex, ey, 0.8, 0.8, woodD);
      blob(ctx, hx, hy, 1.15, 1.15, flash ? FLASH : "#ffffff");
      for (let f = 0; f < 3; f++) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.1;
        line(ctx, hx + (f - 1) * 0.4, hy + 0.4, hx + (f - 1) * 0.45, hy + 0.95);
      }
    }
    ctx.restore();
  }

  // The puppet's painted face, in the flipped frame: a wide grin, round red cheeks, ringed eyes.
  function face(ctx, x, y, s, t, raged, lying, dizzy = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    for (const ex of [-0.9, 0.9]) {
      blob(ctx, ex, 0.6, 0.62, 0.72, "#ffffff", INK, 0.12);
      if (dizzy) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.14;
        line(ctx, ex - 0.35, 0.25, ex + 0.35, 0.95);
        line(ctx, ex - 0.35, 0.95, ex + 0.35, 0.25);
      } else {
        ctx.fillStyle = raged ? "#ff2a12" : INK;
        circle(ctx, ex + 0.08, 0.55, 0.28);
        ctx.fill();
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.14;
      line(ctx, ex - 0.6, 1.5, ex + 0.5, 1.7 - (ex > 0 ? 0.3 : 0));
    }
    for (const cx of [-1.45, 1.45]) {
      ctx.fillStyle = "#e8584a";
      circle(ctx, cx, -0.45, 0.5);
      ctx.fill();
    }
    blob(ctx, 0, -0.2, 0.34, 0.3, "#d8101e", INK, 0.1);
    ctx.beginPath();
    ctx.moveTo(-1.6, -1.0);
    ctx.quadraticCurveTo(0, lying ? -1.6 : -2.5, 1.6, -1.0);
    ctx.quadraticCurveTo(0, -1.2, -1.6, -1.0);
    ctx.fillStyle = "#6a0a14";
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.12;
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 5; i++) ctx.fillRect(-1.2 + i * 0.5, -1.1, 0.34, 0.4);
    ctx.restore();
  }

  // The stage card's picture (no room: ghoul-picker-draw.js hands a boss at 0, 0 and a field 0 tall): the
  // Ringmaster at his crossbar, a little puppet on three strings at his side.
  function ringmasterCard(ctx, v, b) {
    const t = v.clock;
    const man = { ...b, x: 0, y: 0, open: false, act: "idle", raged: false, dir: -1 };
    const full = [0, 1, 2].map(() => ({ hp: 3, max: 3, hurt: 0 }));
    ctx.save();
    ctx.scale(0.5, 0.5);
    puppet(ctx, v, { px: -24, floor: 0, puppet: "up", act: "idle", strings: full }, t, false);
    ctx.restore();
    ctx.strokeStyle = "rgba(240, 230, 205, 0.9)";
    ctx.lineWidth = 0.1;
    for (const [bx, by] of [[-12, -9.6], [-15.25, -4.5], [-8.75, -4.5]]) line(ctx, -0.5, -3.3, bx, by);
    bone(ctx, [[-1.6, -3.2], [1.6, -3.2]], 0.35, "#c8a05a");
    ringman(ctx, v, man, t, false);
  }

  function ringmaster(ctx, v, b) {
    if (!v.spec) return ringmasterCard(ctx, v, b);
    const FH = v.g.FIELD_H;
    const t = v.clock;
    const flash = b.hurt > 0 && Math.floor(b.hurt / 55) % 2 === 0;
    const up = b.puppet !== "down";
    const px = b.px ?? b.x;
    const floor = b.floor ?? 6;
    const st = b.strings || [{ hp: 3, max: 3, hurt: 0 }, { hp: 3, max: 3, hurt: 0 }, { hp: 3, max: 3, hurt: 0 }];
    const ground = FH - floor - 0.1;
    // The stomp's shadow, growing under the puppet.
    if (b.act === "stompWind" && up) {
      const p = clamp(1 - (b.wait || 0) / 750, 0, 1);
      landing(ctx, px, ground, p);
    }
    // The leap's shadow marks the whole flight where the foot will land, and the puppet's own
    // shadow shrinks as it climbs.
    if (b.act === "leap" && up) {
      const p = clamp((b.air || 0) / (b.airMs || 800), 0, 1);
      landing(ctx, b.toX, ground, 0.35 + 0.65 * p);
      ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
      ellipse(ctx, px, ground, 3.2 / (1 + (b.lift || 0) * 0.12), 0.5);
      ctx.fill();
    }
    // The crouch before a leap: a ring of dust puffs round its shoes.
    if ((b.act === "crouch" || b.act === "rear") && up) {
      const p = clamp(1 - (b.wait || 0) / (b.total || 600), 0, 1);
      ctx.globalAlpha = 0.25 + 0.5 * p;
      ctx.fillStyle = "#c8b890";
      for (let i = 0; i < 6; i++) {
        const s = i < 3 ? -1 : 1;
        circle(ctx, px + s * (3.5 + (i % 3) * 1.4 + p * 1.5), ground - 0.3 - (i % 3) * 0.3 - p * 0.6, 0.5 + (i % 3) * 0.2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // The charge's lane: a dashed line along the floor from the puppet to the wall, steady and
    // bright at the last.
    if (b.act === "rear" && up && b.cdir) {
      const p = clamp(1 - (b.wait || 0) / (b.total || 780), 0, 1);
      const last = (b.wait || 0) <= 200;
      const wall = b.cdir > 0 ? v.spec.length - 6 : v.spec.arena + 6;
      ctx.globalAlpha = last ? 1 : 0.3 + 0.4 * p;
      ctx.strokeStyle = last ? "#ffffff" : "#ff5a3a";
      ctx.lineWidth = last ? 0.5 : 0.3;
      const n = Math.max(2, Math.floor(Math.abs(wall - px) / 2));
      for (let i = 0; i < n; i += 2) line(ctx, lerp(px, wall, i / n), ground - 0.2, lerp(px, wall, Math.min(1, (i + 1) / n)), ground - 0.2);
      ctx.globalAlpha = 1;
    }
    // The whip's aim: a thin line out along its level from the Ringmaster, brightest at the end.
    if (b.act === "lashWind" && b.lashDir) {
      const p = clamp(1 - (b.wait || 0) / 700, 0, 1);
      const last = (b.wait || 0) <= 150;
      const y = FH - b.lashY - 0.8;
      const x0 = b.x;
      const x1 = clamp(b.x + b.lashDir * 70, v.round.camX - 4, v.round.camX + v.g.FIELD_W + 4);
      ctx.globalAlpha = last ? 1 : 0.3 + 0.4 * p;
      ctx.strokeStyle = last ? "#ffffff" : "#ff5a3a";
      ctx.lineWidth = last ? 0.34 : 0.16;
      const n = Math.max(2, Math.floor(Math.abs(x1 - x0) / 1.4));
      for (let i = 0; i < n; i += 2) line(ctx, lerp(x0, x1, i / n), y, lerp(x0, x1, Math.min(1, (i + 1) / n)), y);
      ctx.globalAlpha = 1;
    }
    gantry(ctx, v, b, up, t);
    // The strings run from the crossbar's pegs to the puppet's head and hands, wherever those are now:
    // slack when it crouches or stands, taut when it leaps or runs.
    const top = FH - (b.y + 1);
    const pts = b.pts || [[px, floor + PUP_H], [px - HAND_X, floor + HAND_UP], [px + HAND_X, floor + HAND_UP]];
    const taut = clamp((b.stretch || 0) + (b.act === "charge" ? 1 : 0) + (b.act === "rear" ? 0.5 : 0), 0, 1);
    const slack = clamp(0.35 + (b.crouch || 0) * 0.9 - taut * 0.6, 0, 1);
    const anchors = [[b.x, top], [b.x - 4, top], [b.x + 4, top]];
    if (up) {
      puppet(ctx, v, b, t, flash);
      anchors.forEach(([ax, ay], i) => stringLine(ctx, ax, ay, pts[i][0], FH - pts[i][1], st[i], t, false, slack, i));
    } else {
      puppet(ctx, v, b, t, flash);
      if (b.y > 14) anchors.forEach(([ax, ay], i) => stringLine(ctx, ax, ay, ax, ay, { hp: 0, max: 3 }, t, true, 0, i));
    }
    ringman(ctx, v, b, t, flash);
    if (b.open) {
      const k = 0.5 + 0.5 * Math.sin(t / 150);
      ctx.strokeStyle = `rgba(255, 226, 120, ${0.35 + 0.35 * k})`;
      ctx.lineWidth = 0.3;
      ellipse(ctx, b.x, FH - b.y - 4.3, 3.6 + k * 0.3, 5.6);
      ctx.stroke();
    }
    // Dazed after the crash: stars wheeling over the puppet's head.
    if (b.dazed && up) {
      ctx.fillStyle = GOLD;
      for (let i = 0; i < 4; i++) {
        const a = t / 200 + (i * TAU) / 4;
        circle(ctx, px + Math.cos(a) * 3, FH - floor - 18.5 + Math.sin(a) * 0.8, 0.4);
        ctx.fill();
      }
    }
    if (up) v.eyes.push(px, FH - floor - 15.6 - (b.lift || 0), 0.6, b.raged ? "#ff3a1a" : "#ffe9a0");
  }

  // The ground shadow where a foot will land: a dark ellipse that grows with `p` (0 to 1) inside a red ring.
  function landing(ctx, x, y, p) {
    ctx.fillStyle = `rgba(0, 0, 0, ${0.25 + 0.4 * p})`;
    ellipse(ctx, x, y, 4.5 * (0.5 + 0.5 * p), 0.7);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 70, 50, ${0.3 + 0.6 * p})`;
    ctx.lineWidth = 0.22;
    ellipse(ctx, x, y, 4.7, 0.85);
    ctx.stroke();
  }

  /* ------------------------------------------------------ hazards and waves */

  // The puppet's foot: a great striped shoe slamming down on the floor on its leg,
  // dust and stars flying.
  function pfoot(ctx, v, h) {
    const FH = v.g.FIELD_H;
    const gone = h.max - h.live;
    const drop = (1 - ease(clamp(gone / 70, 0, 1))) * 9;
    const fl = FH - h.y;
    const x = h.x;
    const f = clamp(h.live / h.max, 0, 1);
    ctx.save();
    ctx.translate(x, fl - drop);
    // The leg up out of the top of the field.
    ctx.fillStyle = "#f2c418";
    ctx.fillRect(-1.5, -fl - 4, 3, fl + 4 - 2.6);
    ctx.fillStyle = "#2a8ee8";
    for (let y = -fl; y < -2.6; y += 3) ctx.fillRect(-1.5, y, 3, 1.1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.14;
    ctx.strokeRect(-1.5, -fl - 4, 3, fl + 4 - 2.6);
    outlined(ctx, [[-4.4, 0], [4.4, 0], [4.7, -1.4], [3.4, -3.2], [-0.6, -3.4], [-1.6, -2.6], [-4.4, -2.4]], "#d8101e", INK, 0.16);
    ctx.fillStyle = "#ffffff";
    for (const dx of [-2.6, 0.4, 2.8]) {
      circle(ctx, dx, -1.2, 0.55);
      ctx.fill();
    }
    ctx.restore();
    // Dust rolling out and stars at the impact.
    ctx.globalAlpha = f;
    ctx.fillStyle = "#c8b890";
    for (let i = 0; i < 8; i++) {
      const s = i < 4 ? -1 : 1;
      const k = (i % 4) / 3;
      circle(ctx, x + s * (4.5 + k * 3.5 * (1 - f + 0.3)), fl - 0.5 - k * 0.8, 0.7 + k * 0.4);
      ctx.fill();
    }
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 5; i++) {
      const a = -0.4 - i * 0.55;
      circle(ctx, x + Math.cos(a) * (3 + (1 - f) * 6), fl - 1 + Math.sin(a) * (3 + (1 - f) * 5), 0.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    v.eyes.push(x, fl - 1.5, 3.2 * f, "#ffb050");
  }

  // The whip's crack: a bright lash flying out along chest height from the gantry's
  // man, wavering, a flash where it cracks, and a rope up to his hand.
  function lash(ctx, v, h) {
    const FH = v.g.FIELD_H;
    const t = v.clock;
    const dir = h.dir || -1;
    const x0 = h.x - dir * (h.w / 2);
    const y = FH - h.y - h.h / 2;
    const reach = clamp((1 - h.live / h.max) * 3.2, 0.1, 1) * h.w;
    const f = clamp(h.live / h.max, 0.15, 1);
    const b = v.round.boss;
    if (b) {
      ctx.strokeStyle = `rgba(80, 40, 16, ${f})`;
      ctx.lineWidth = 0.2;
      ctx.beginPath();
      ctx.moveTo(x0 - dir * 0.5, FH - (b.y + 3.3));
      ctx.quadraticCurveTo(x0 - dir * 1.5, (FH - (b.y + 3.3) + y) / 2, x0, y);
      ctx.stroke();
    }
    const pts = [];
    const n = 36;
    for (let i = 0; i <= n; i++) {
      const q = i / n;
      pts.push([x0 + dir * q * reach, y + Math.sin(q * 16 - t / 22) * 0.55 * (1 - q) * f]);
    }
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [w, c] of [[1.3, `rgba(255, 120, 40, ${0.55 * f})`], [0.7, `rgba(255, 230, 150, ${f})`], [0.28, "#ffffff"]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = w;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
    // The crack: a spiked star at the tip.
    const [tx, ty] = pts[n];
    ctx.fillStyle = "#ffffff";
    const star = [];
    for (let i = 0; i < 12; i++) star.push([tx + Math.cos((i / 12) * TAU) * (i % 2 ? 0.7 : 1.9) * f, ty + Math.sin((i / 12) * TAU) * (i % 2 ? 0.7 : 1.9) * f]);
    poly(ctx, star);
    ctx.fill();
    v.eyes.push(tx, ty, 1.6 * f, "#ffd890");
  }

  // The charge: a roiling trail of dust behind the running puppet and streaks over it (the puppet
  // itself is drawn with the boss; this hazard is its hit box, h.x following it).
  function pcharge(ctx, v, h) {
    const FH = v.g.FIELD_H;
    const t = v.clock;
    const d = h.dir || 1;
    const y = FH - h.y;
    for (let i = 0; i < 9; i++) {
      const k = i / 9;
      ctx.globalAlpha = 0.9 * (1 - k * 0.8);
      ctx.fillStyle = i % 2 ? "#c8b890" : "#a89870";
      circle(ctx, h.x - d * (4.2 + i * 1.5 + ((t / 55) % 1) * 1.5), y - 0.7 - k * 1.8 - (i % 3) * 0.3, 0.9 + k * 1.5);
      ctx.fill();
    }
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.14;
    for (let i = 0; i < 4; i++) {
      const x0 = h.x - d * (5 + ((t / 40 + i * 3) % 6));
      line(ctx, x0, y - 1.2 - i * 1.5, x0 - d * 4, y - 1.2 - i * 1.5);
    }
    ctx.globalAlpha = 1;
  }

  // The puppet's shockwave along the floor: a crest of orange dust with a bright edge.
  function puppetWave(ctx, v, w, y) {
    const t = v.clock;
    const d = w.dir;
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = "#e8702a";
    ctx.beginPath();
    ctx.moveTo(w.x - d * 3.6, y);
    ctx.quadraticCurveTo(w.x - d * 1.0, y - 3.0, w.x + d * 0.9, y - 0.6);
    ctx.quadraticCurveTo(w.x + d * 1.2, y - 0.2, w.x + d * 1.0, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffe27a";
    ctx.beginPath();
    ctx.moveTo(w.x - d * 2.0, y);
    ctx.quadraticCurveTo(w.x - d * 0.4, y - 1.8, w.x + d * 0.8, y - 0.3);
    ctx.lineTo(w.x + d * 0.8, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.18;
    ctx.beginPath();
    ctx.moveTo(w.x - d * 2.6, y - 0.1);
    ctx.quadraticCurveTo(w.x - d * 0.8, y - 2.5, w.x + d * 0.9, y - 0.55);
    ctx.stroke();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "#c8b890";
    for (let k = 1; k <= 4; k++) {
      circle(ctx, w.x - d * (1.5 + k * 1.2), y - 0.5 - ((t / 40 + k * 2) % 3) * 0.35, 0.4 + (k % 2) * 0.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    v.eyes.push(w.x, y - 0.8, 1.4, "#ff9a3a");
  }

  /* ------------------------------------------------------ missiles, powers */

  function barbell(ctx, x, y, spin) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.scale(1.1, 1.1);
    barbellShape(ctx, 1.5, 1.0, false);
    ctx.restore();
  }

  // Cotton Candy's badge: a paper cone striped pink and white with a cloud of pink floss on top.
  function floss(ctx, x, y) {
    ctx.fillStyle = "#fff6f0";
    poly(ctx, [[x - 0.5, y + 0.1], [x + 0.5, y + 0.1], [x, y + 1.15]]);
    ctx.fill();
    ctx.fillStyle = "#e84a9a";
    poly(ctx, [[x - 0.17, y + 0.1], [x + 0.17, y + 0.1], [x + 0.03, y + 0.8], [x - 0.07, y + 0.8]]);
    ctx.fill();
    ctx.strokeStyle = "#5a2a4a";
    ctx.lineWidth = 0.09;
    poly(ctx, [[x - 0.5, y + 0.1], [x + 0.5, y + 0.1], [x, y + 1.15]]);
    ctx.stroke();
    for (const [dx, dy, r, c] of [[-0.55, -0.1, 0.5, "#ff7ab8"], [0.55, -0.1, 0.5, "#ff7ab8"], [0, -0.6, 0.62, "#ff9ad5"], [-0.25, -0.2, 0.5, "#ffb0e0"], [0.3, -0.25, 0.45, "#ffb0e0"]]) {
      ctx.fillStyle = c;
      circle(ctx, x + dx, y + dy, r);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    circle(ctx, x - 0.2, y - 0.8, 0.14);
    ctx.fill();
    circle(ctx, x + 0.35, y - 0.4, 0.1);
    ctx.fill();
  }

  /* ----------------------------------------------------- over the monsters */

  // Pink floss over a monster that Cotton Candy has slowed: puffs along its box and a sticky strand.
  function flossPuff(ctx, v, m) {
    const FH = v.g.FIELD_H;
    const t = v.clock;
    const cx = m.x;
    const by = FH - m.y;
    ctx.globalAlpha = 0.78;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + m.id;
      const px = cx + Math.cos(a) * m.w * 0.5;
      const py = by - m.h * (0.5 + 0.45 * Math.sin(a)) + Math.sin(t / 260 + i) * 0.12;
      ctx.fillStyle = i % 2 ? "#ff9ad5" : "#ffb8e4";
      circle(ctx, px, py, 0.5 + (i % 3) * 0.15);
      ctx.fill();
    }
    ctx.strokeStyle = "#ff9ad5";
    ctx.lineWidth = 0.1;
    line(ctx, cx - m.w * 0.3, by - m.h * 0.7, cx - m.w * 0.55, by - 0.1);
    line(ctx, cx + m.w * 0.3, by - m.h * 0.5, cx + m.w * 0.5, by - 0.1);
    ctx.globalAlpha = 1;
  }

  // Custard cream on what a pie stunned: dollops over its top and a dripping smear.
  function piedCream(ctx, v, m) {
    const FH = v.g.FIELD_H;
    const by = FH - m.y;
    const cx = m.x;
    ctx.fillStyle = CREAM;
    ctx.strokeStyle = "#b8983a";
    ctx.lineWidth = 0.08;
    for (const [dx, dy, r] of [[-0.25, 0.78, 0.62], [0.2, 0.9, 0.5], [0.0, 0.55, 0.7], [-0.28, 0.4, 0.4]]) {
      circle(ctx, cx + dx * m.w, by - m.h * dy, r * Math.min(1.2, m.w / 3));
      ctx.fill();
      ctx.stroke();
    }
    for (const dx of [-0.3, 0.12]) ctx.fillRect(cx + dx * m.w, by - m.h * 0.6, 0.28, 0.9 + m.h * 0.08);
  }

  function front(ctx, v) {
    world.front?.(ctx, v);
    const round = v.round;
    if (!round) return;
    const lo = round.camX - 6;
    const hi = round.camX + v.g.FIELD_W + 6;
    for (const m of round.monsters) {
      if (m.dead || m.x < lo || m.x > hi) continue;
      if (m.floss && m.hasteMs > 0) flossPuff(ctx, v, m);
      if (m.pied && m.stunMs > 0) piedCream(ctx, v, m);
    }
    const bolts = round.twist && round.twist.bolts;
    if (Array.isArray(bolts)) {
      const FH = v.g.FIELD_H;
      for (const b of bolts) {
        const y = FH - b.y;
        const dx = Math.sign(b.vx || 1) * 3;
        ctx.strokeStyle = "rgba(150, 230, 255, 0.45)";
        ctx.lineWidth = 0.9;
        line(ctx, b.x - dx, y, b.x, y);
        ctx.strokeStyle = GLASS;
        ctx.lineWidth = 0.4;
        line(ctx, b.x - dx * 0.6, y, b.x, y);
        ctx.fillStyle = "#ffffff";
        circle(ctx, b.x, y, 0.32);
        ctx.fill();
        // A glassy shard trailing.
        ctx.fillStyle = "rgba(210, 245, 255, 0.8)";
        poly(ctx, [[b.x - dx * 0.9, y - 0.4], [b.x - dx * 1.5, y], [b.x - dx * 0.9, y + 0.35]]);
        ctx.fill();
        v.eyes.push(b.x, y, 0.6, "#9fe6ff");
      }
    }
  }

  /* -------------------------------------------------------------- lights */

  function lights(v, add) {
    const round = v.round;
    const spec = v.spec;
    world.lights(v, add);
    if (!round || !spec || !LOOKS[spec.id]) return;
    for (const m of round.monsters) {
      if (m.dead) continue;
      if (m.kind === "grinner") add(m.x, m.y + 4, 4, 0.4);
      else if (m.kind === "balloon") add(m.x, m.y + 1.6, 3.5, 0.4);
      else if (m.kind === "marionette") add(m.x, m.y + 3, 3.5, 0.3);
      else if (m.kind === "mirror") add(m.x, m.y + 2.5, m.act === "wait" ? 3 : 4.5, m.act === "wait" ? 0.2 : 0.4);
      else if (m.kind === "strongman") add(m.x, m.y + 4, 4, 0.35);
      else if (m.kind === "circushound") add(m.x, m.y + 1.5, m.act === "crouch" || m.act === "leap" ? 9 : 4, m.act === "crouch" || m.act === "leap" ? 0.8 : 0.4);
    }
    for (const h of round.hazards) {
      if (h.kind === "pfoot") add(h.x, h.y + 1, 12, 0.9);
      else if (h.kind === "lash") add(h.x - (h.dir || -1) * (h.w / 2), h.y, 10, 0.8);
      else if (h.kind === "pcharge") add(h.x, h.y + 3, 12, 0.8);
    }
    const bolts = round.twist && round.twist.bolts;
    if (Array.isArray(bolts)) for (const b of bolts) add(b.x, b.y, 5, 0.6);
    const b = round.boss;
    if (b && b.kind === "ringmaster" && b.state !== "sleep" && b.state !== "down") {
      add(b.x, b.y + 1, 13, 0.7);
      if (b.puppet !== "down") add(b.px ?? b.x, (b.floor ?? 6) + 9 + (b.lift || 0), 14, 0.5);
      if (b.open) add(b.x, b.y + 4, 9, 0.7);
    }
  }

  /* -------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }

  // What the pack's events look and sound like; true when the event is its own.
  // Each of its sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, glow, float, ring, banner, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    // The quick cues are throttled: a spread of bolts is one sticky sound, not three.
    const quick = { flossStick: ["flossMs", 140], mirrorShot: ["mirShotMs", 110], stringHit: ["strHitMs", 90] }[e.type];
    if (quick && !gateOnce(fx, quick[0], quick[1])) return true;
    // A cut string on a marionette has its own snip.
    const mario = e.type === "stringCut" && e.what === "marionette";
    say(tone, mario ? "marionette" : voice[0], mario ? "cut" : voice[1], voice[0] === "ringmaster" ? 0.6 : 0.5);
    switch (e.type) {
      case "grinnerHonk":
        float(e.x + 1, e.y + 3, "HONK!", GOLD, 2.2);
        burst(e.x + 1.5, e.y + 1, "#ffe27a", 5, 8, 260);
        break;
      case "balloonPop":
        burst(e.x, e.y, ACID, 12, 10, 450);
        burst(e.x, e.y, "#ffffff", 5, 7, 220);
        if (e.floor !== null && e.floor !== undefined) burst(e.x, e.floor + 0.4, ACID, 6, 5, 500);
        break;
      case "marionetteJerk":
        float(e.x, e.y + 5, "!", DANGER, 2.4);
        break;
      case "marionetteDrop":
        burst(e.x, e.y + 3, "#e8d8b0", 4, 6, 260);
        break;
      case "marionetteLand":
        shake(110, 0.35);
        burst(e.x, (e.floor ?? e.y) + 0.5, "#c8b890", 8, 8, 400);
        break;
      case "stringHit":
        burst(e.x, e.y, "#ffffff", 4, 5, 200);
        break;
      case "stringCut":
        burst(e.x, e.y, "#ffffff", 8, 9, 300);
        if (!mario) {
          float(e.x, e.y + 1.5, "SNAP", GOLD, 2.2);
          shake(120, 0.4);
        }
        break;
      case "mirrorStep":
        ring(e.x, e.y, "#9fe6ff", 1, 6, 450);
        glow(e.x, e.y, 6, 0.5, 400);
        break;
      case "mirrorShot":
        burst(e.x, e.y, "#9fe6ff", 3, 5, 180);
        break;
      case "mirrorCancel":
        burst(e.x, e.y, "#ffffff", 8, 8, 260);
        ring(e.x, e.y, "#9fe6ff", 1, 4, 260);
        break;
      case "mirrorShatter":
        flash("#bfeeff", 160);
        shake(160, 0.5);
        burst(e.x, e.y, "#bfeeff", 22, 14, 600);
        burst(e.x, e.y, "#ffffff", 10, 10, 400);
        break;
      case "strongWind":
        float(e.x + (e.dir || 1) * 2, e.y + 3, "!", DANGER, 2.6);
        break;
      case "strongThrow":
        burst(e.x, e.y, "#d8d0c0", 4, 6, 220);
        break;
      case "barbellLand":
        shake(100, 0.3);
        burst(e.x, e.y + 0.4, "#c8b890", 6, 7, 320);
        break;
      case "houndLand":
        burst(e.x, e.y - 1, "#c8b890", 5, 6, 260);
        break;
      case "houndCrouch":
        float(e.x, e.y + 3, "!", DANGER, 2.4);
        burst(e.x + (e.dir || 1) * 4, e.y + 1, "#ff9a3a", 6, 6, 350);
        break;
      case "houndLeap":
        burst(e.x + (e.dir || 1) * 4, e.y + 1, "#ffd23a", 10, 10, 350);
        break;
      case "cageOpen":
        shake(200, 0.5);
        burst(e.x, e.y, "#8a8a9a", 10, 10, 400);
        float(e.x, e.y + 3, "GRRR", DANGER, 2.2);
        break;
      case "flossStick":
        burst(e.x, e.y, PINK, 4, 5, 260);
        break;
      case "puppetWind":
        float(e.x, e.y + 5, "!", DANGER, 3);
        break;
      case "puppetStomp":
        shake(380, 0.9);
        flash("#ffb050", 120);
        burst(e.x, e.y + 0.5, "#c8b890", 18, 16, 600);
        ring(e.x, e.y + 0.5, "#ff9a3a", 2, 14, 500);
        break;
      case "puppetCrouch":
        float(e.x, e.y + 8, "!", DANGER, 3);
        burst(e.x, e.y + 0.6, "#c8b890", 6, 7, 300);
        break;
      case "puppetLeap":
        burst(e.x, e.y + 0.6, "#c8b890", 12, 12, 450);
        ring(e.x, e.y + 0.5, "#ffd23a", 1, 8, 350);
        break;
      case "puppetRear":
        float(e.x, e.y + 9, "!", DANGER, 3);
        burst(e.x, e.y + 0.6, "#c8b890", 8, 8, 400);
        break;
      case "puppetCharge":
        shake(220, 0.5);
        burst(e.x - (e.dir || 1) * 3, e.y + 0.8, "#c8b890", 14, 14, 500);
        break;
      case "puppetCrash":
        shake(450, 1.0);
        flash("#fff0d0", 140);
        burst(e.x + (e.dir || 1) * 2, e.y + 3, "#c8b890", 22, 16, 650);
        burst(e.x, e.y + 8, "#ffe27a", 10, 12, 500);
        float(e.x, e.y + 12, "CRASH", GOLD, 2.6);
        break;
      case "puppetDown":
        flash("#ffffff", 200);
        shake(420, 1.0);
        burst(e.x, e.y - 4, "#e8d8b0", 22, 16, 700);
        banner("The puppet falls", "Now he is open", GOLD, 1500);
        break;
      case "ringOpen":
        burst(e.x, e.y - 3, "#c8b890", 16, 12, 500);
        float(e.x, e.y + 6, "Shoot him!", GOLD, 2.4);
        ring(e.x, e.y, "#ffe27a", 2, 10, 500);
        break;
      case "ringClimb":
        float(e.x, e.y + 5, "He climbs back!", DANGER, 2);
        break;
      case "ringString":
        burst(e.x, e.y, "#ffffff", 8, 8, 300);
        float(e.x, e.y + 6, "Strings again", "#e8d8b0", 2);
        break;
      case "lashWind":
        float(e.x, e.y + 5, "DUCK!", DANGER, 2.8);
        break;
      case "lashCrack":
        shake(200, 0.6);
        flash("#fff0d0", 90);
        burst(e.x + (e.dir || -1) * 6, e.lashY ?? e.y, "#fff0d0", 10, 14, 300);
        break;
      case "ringRage":
        flash("#ff3a1a", 320);
        shake(380, 0.9);
        ring(e.x, e.y, "#ff3a1a", 2, 16, 700);
        banner("The Ringmaster rages", "Hounds out of the cages, tougher strings", "#ff5a3a", 1800);
        break;
      default:
        break;
    }
    return true;
  }

  return freeze({
    ...world,
    looks: LOOKS,
    front,
    monsters: freeze({ grinner, balloon, marionette, mirror, strongman, circushound }),
    bosses: freeze({ ringmaster }),
    missiles: freeze({ barbell }),
    hazards: freeze({ pfoot, lash, pcharge }),
    waves: freeze({ puppet: puppetWave }),
    powers: freeze({ floss }),
    lights,
    react,
  });
}
