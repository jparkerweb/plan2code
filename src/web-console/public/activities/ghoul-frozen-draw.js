// Plan2Code Web Console - Ghoul Rush's Frozen Lake stage, its drawing: the rooms' looks (the Ice Fishing Huts, the Snowbound Lodge, the Black Ice, the Widow's Web), the under-ice hand, the snow shade and its footprints, the frozen ghoul in its crust of ice, the ice wraith, the Frost Widow with her veil, heart and webs, the shards, ice spikes, web globs and patches, the fire barrels, the Road Flare and its fire, Hot Cocoa, the blizzard, Planny cast in ice, and what the stage's events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and
// LOSE_SOUNDS are plain data (the voices borrow the house's and the other
// stages' tones until the stage's own sounds are picked); frozenArt(d) takes
// ghoul-draw.js's own drawing helpers (`d`) and hands back the drawing by
// kind, so this file never reaches back into it. The room's sky, walls, floors,
// boards, thin ice, open water and falling snow are ghoul-frozen-world.js's
// (`frozenWorld(d)`, composed in `frozenArt`). Drawn in room units, y counted
// down from the field's top, a monster from (x, y) at its feet. What the art
// reads off the rules (ghoul-frozen.js, ghoul-flare.js):
//
// - Planny: `you.heldMs` (an ice cast over him while it runs, 700 ms), `you.slide`,
//   `you.onIce` (snow spray off his heels), `round.effects.cocoa` (steam and a warm glow).
// - an under-ice hand: `m.act` ("trail" and "lurk" under the ice, "warn" with `m.wait`
//   of 500 left, "grab" with `m.wait` of 1000 left, "sink" with `m.wait` of 300 left).
// - a snow shade: `m.unseen`, `m.shownMs`, `m.litMs`, `m.prints` ({ x, y, age } ms),
//   `m.act` ("stalk", "wind", "lunge", "rest"), `m.dir`.
// - a frozen ghoul: `m.dir`, `m.sv` (its slide), `m.lurching`, `m.rise`.
// - an ice wraith: `m.act` ("idle", "hover", "wind", "dive", "rise"), `m.dir`, `m.vx`, `m.vy`.
// - the Frost Widow (`b`): `b.act` ("hang", "drop", "low", "rise"), `b.veil`, `b.veilMs`
//   (ms the veil stays down), `b.mouth`, `b.spitWind` (ms of a spit's wind-up), `b.toX`
//   (where a drop lands), `b.floor`, `b.raged`, `b.hurt`, `b.dir`, `b.state`.
// - hazards: `shard` ({ warn, off, vx }), `spike` ({ warn, live, up }), `webGlob`, `webPatch`
//   ({ life, max, w }), `barrel` ({ state: "still" | "roll", roll }), `armRoadFlare`
//   ({ spin }), `armRoadFire` ({ life, max, w, h }).
// - `round.twist.wind` ({ state: "calm" | "warn" | "blow", ms, dir }): the blizzard.

import { frozenWorld } from "./ghoul-frozen-world.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

const look = (o) => freeze({ pack: "frozen", custom: true, noMoon: true, frozen: true, pit: "rgba(0, 0, 0, 0)", ...o });
export const LOOKS = freeze({
  huts: look({ wallTop: "#071a38", wallLow: "#1d4a74", paper: "#2c5f8a", wainscot: "#16324e", floorTop: "#e6f2fa", floor: "#3a678a", floorEdge: "#0f2438", shelf: "#6a4a2c", shelfTop: "#eaf5fc", window: "#ffd27a", color: "#9fd8ff", dark: 0.8 }),
  lodge: look({ wallTop: "#17120f", wallLow: "#33291f", paper: "#40342a", wainscot: "#221a14", floorTop: "#cfe3f0", floor: "#34506a", floorEdge: "#0c141c", shelf: "#2a1c12", shelfTop: "#4a3320", window: "#a8d0f0", color: "#d8c9a8", dark: 0.86 }),
  blackice: look({ wallTop: "#02060e", wallLow: "#0c2036", paper: "#143452", wainscot: "#0a1a2c", floorTop: "#9cc4dc", floor: "#1a3a58", floorEdge: "#050d16", shelf: "#1b3d5c", shelfTop: "#6aaed6", window: "#7ab8e0", color: "#7ab0d8", dark: 0.84 }),
  widow: look({ wallTop: "#040b1e", wallLow: "#10315a", paper: "#1c4a78", wainscot: "#0c2342", floorTop: "#cfeaf8", floor: "#2a6088", floorEdge: "#081a2e", shelf: "#17415f", shelfTop: "#9fdcf5", window: "#bfe8ff", color: "#bfe4f2", dark: 0.82 }),
});

// How each new kind sounds, by act (the sounds picked by ear, in ghoul-sfx-frozen.js).
// `ice` is the lake itself (a crack, a break, a refreezing), `barrel` the burning barrels, `flare` the Road Flare's fire, `cocoa` the power-up.
export const VOICES = freeze({
  hand: freeze({ appear: "ghoulIceHandAppear", warn: "ghoulIceHandWarn", grab: "ghoulIceHandGrab", hurt: "ghoulIceHandHurt", die: "ghoulIceHandDie" }),
  shade: freeze({ appear: "ghoulShadeAppear", show: "ghoulShadeShow", wind: "ghoulShadeWind", lunge: "ghoulShadeLunge", hurt: "ghoulShadeHurt", die: "ghoulShadeDie" }),
  frozen: freeze({ appear: "ghoulFrozenGhoulAppear", shatter: "ghoulFrozenGhoulShatter", melt: "ghoulFrozenGhoulMelt", hurt: "ghoulFrozenGhoulHurt", die: "ghoulFrozenGhoulDie" }),
  icewraith: freeze({ wake: "ghoulIceWraithWake", wind: "ghoulIceWraithWind", dive: "ghoulIceWraithDive", chill: "ghoulIceWraithChill", hurt: "ghoulIceWraithHurt", die: "ghoulIceWraithDie" }),
  frostwidow: freeze({ wake: "ghoulFrostWidowWake", drop: "ghoulFrostWidowDrop", rise: "ghoulFrostWidowRise", rage: "ghoulFrostWidowRage", melt: "ghoulFrostWidowMelt", up: "ghoulFrostWidowUp", gust: "ghoulFrostWidowGust", blow: "ghoulFrostWidowBlow", warn: "ghoulFrostWidowWarn", spike: "ghoulFrostWidowSpike", spit: "ghoulFrostWidowSpit", shot: "ghoulFrostWidowShot", land: "ghoulFrostWidowLand", call: "ghoulFrostWidowCall", kick: "ghoulFrostWidowKick", burst: "ghoulFrostWidowBurst", hurt: "ghoulFrostWidowHurt", weak: "ghoulFrostWidowWeak", die: "ghoulFrostWidowDie" }),
  ice: freeze({ crack: "ghoulThinIceCrack", break: "ghoulThinIceBreak", back: "ghoulThinIceBack" }),
  barrel: freeze({ burn: "ghoulBarrelBurn" }),
  flare: freeze({ throw: "ghoulFlareThrow", land: "ghoulFlareLand" }),
  cocoa: freeze({ active: "ghoulCocoaActive" }),
});

// What each of the pack's events plays: [kind, act], once. A hit, a kill, a spawn and a boss's wake, hit and fall are the
// game's own (they carry their kind). Silent on purpose: `veilDown` (it comes with `veilMelt`), `barrelPlace`,
// `blizzardEnd` and `flareThrow` (the weapon's own `armUse` sounds it).
export const EVENT_VOICE = freeze({
  iceCrack: ["ice", "crack"],
  iceBreak: ["ice", "break"],
  iceBack: ["ice", "back"],
  handWarn: ["hand", "warn"],
  handUp: ["hand", "grab"],
  shadeShow: ["shade", "show"],
  shadeWind: ["shade", "wind"],
  shadeLunge: ["shade", "lunge"],
  shatter: ["frozen", "shatter"],
  frozenMelt: ["frozen", "melt"],
  iceWraithWake: ["icewraith", "wake"],
  iceWraithWind: ["icewraith", "wind"],
  iceWraithDive: ["icewraith", "dive"],
  freezeHit: ["icewraith", "chill"],
  widowDrop: ["frostwidow", "drop"],
  widowRise: ["frostwidow", "rise"],
  widowRage: ["frostwidow", "rage"],
  veilMelt: ["frostwidow", "melt"],
  veilUp: ["frostwidow", "up"],
  barrelKick: ["frostwidow", "kick"],
  barrelKnock: ["frostwidow", "kick"],
  barrelBurst: ["frostwidow", "burst"],
  blizzard: ["frostwidow", "gust"],
  blizzardBlow: ["frostwidow", "blow"],
  spikeWarn: ["frostwidow", "warn"],
  spikeUp: ["frostwidow", "spike"],
  webWind: ["frostwidow", "spit"],
  webShot: ["frostwidow", "shot"],
  webLand: ["frostwidow", "land"],
  wraithCall: ["frostwidow", "call"],
  flareLand: ["flare", "land"],
});
// Events that make no sound of their own (see above), so a test can tell a slip from a choice.
export const SILENT = freeze(["veilDown", "barrelPlace", "blizzardEnd", "flareThrow"]);

// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({
  ice: "Went through the ice",
  shard: "Shredded by ice",
  spike: "Skewered",
  frostwidow: "Wrapped in frost",
  icewraith: "Frozen stiff",
  hand: "Pulled under the ice",
  frozen: "Held by the cold",
  shade: "Lost in the snow",
});
export const LOSE_SOUNDS = freeze({
  ice: ["ghoulGlass", 0.6, 0.7],
  shard: ["ghoulGlass", 0.5, 1.2],
  spike: ["crunch", 0.55, 0.7],
  frostwidow: ["smash", 0.6, 0.6],
  icewraith: ["wail", 0.35, 0.6],
  hand: ["squish", 0.5, 0.6],
  frozen: ["crunch", 0.5, 0.9],
  shade: ["wail", 0.3, 0.45],
});

const INK = "#06121c";
const ICE = "#bfe9ff";
const ICE_MID = "#7fbfe0";
const ICE_DK = "#2a5f86";
const FROST = "#eaf8ff";
const CHITIN = "#c4e4f4";
const CHITIN_DK = "#6a9cbc";
const COCOA = "#c8793a";
const FLAME = freeze(["#ff4a1a", "#ff8a1a", "#ffc83a", "#fff0a0"]);

export function frozenArt(d) {
  const world = frozenWorld(d);
  const { ellipse, circle, line, say, FLASH, EYE_PALE, DANGER, GOLD } = d;

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
  const outlined = (ctx, pts, fill, out = INK, lw = 0.1) => {
    poly(ctx, pts);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  const blob = (ctx, x, y, rx, ry, fill, out = INK, lw = 0.1) => {
    ellipse(ctx, x, y, rx, ry);
    ctx.fillStyle = fill;
    ctx.fill();
    if (out) {
      ctx.strokeStyle = out;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  };
  // Little chips of ice flung up round (x, y) (canvas coordinates), `p` of the way through.
  function chips(ctx, x, y, p, n, spread) {
    ctx.fillStyle = `rgba(226, 246, 255, ${0.9 * (1 - p)})`;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.15 + 0.7 * ((i * 0.618) % 1));
      const r = spread * (0.4 + 0.6 * ((i * 0.37) % 1)) * p;
      ctx.fillRect(x + Math.cos(a) * r, y + Math.sin(a) * r + p * p * 1.6, 0.26, 0.26);
    }
  }

  /* --------------------------------------------------------- the under-ice hand */

  // A hand under the ice: a dark shape sliding beneath with a wake of ripples on the surface; it presses
  // up with cracks racing out (warn), then bursts through, fingers splayed and clawing (grab), and sinks.
  function hand(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const wait = m.wait || 0;
    if (m.act === "grab" || m.act === "sink") {
      const rise = m.act === "grab" ? clamp((1000 - wait) / 150, 0, 1) : clamp(wait / 300, 0, 1);
      ctx.save();
      // Nothing of it shows below the surface.
      ctx.beginPath();
      ctx.rect(x - 5, y - 9, 10, 9.6);
      if (typeof ctx.clip === "function") ctx.clip();
      ctx.translate(x, y + (1 - rise) * 4);
      ctx.scale(1.15, 1.15);
      const skin = flash ? FLASH : "#9fd4ea";
      const skinDk = flash ? FLASH : "#5f9fc0";
      // The forearm, a cuff of frost, the palm.
      outlined(ctx, [[-0.62, 1.4], [-0.5, -1.3], [0.5, -1.3], [0.62, 1.4]], skin);
      ctx.fillStyle = flash ? FLASH : "#eaf8ff";
      poly(ctx, [[-0.7, -0.5], [-0.3, -0.8], [0, -0.45], [0.3, -0.85], [0.7, -0.5], [0.6, -0.1], [-0.6, -0.1]]);
      ctx.fill();
      blob(ctx, 0, -1.55, 0.78, 0.6, skin);
      // Five fingers, bent into claws, working.
      for (let i = 0; i < 5; i++) {
        const base = -Math.PI / 2 + (i - 2) * 0.36;
        const sway = Math.sin(t / 130 + i * 1.3) * 0.15;
        const a1 = base + sway;
        const a2 = a1 + (i === 0 || i === 4 ? 0.1 : 0) + (i < 2 ? 0.5 : i > 2 ? -0.5 : 0.1) * 0.7 + 0.15 * Math.sin(t / 90 + i);
        const len = i === 2 ? 0.95 : i === 0 || i === 4 ? 0.7 : 0.85;
        const p0 = [Math.cos(base) * 0.55, -1.7 + Math.sin(base) * 0.3];
        const p1 = [p0[0] + Math.cos(a1) * len, p0[1] + Math.sin(a1) * len];
        const p2 = [p1[0] + Math.cos(a2) * len * 0.75, p1[1] + Math.sin(a2) * len * 0.75];
        bone(ctx, [p0, p1, p2], 0.34, skin);
        ctx.fillStyle = flash ? FLASH : "#f4fcff";
        circle(ctx, p2[0], p2[1], 0.13);
        ctx.fill();
      }
      ctx.strokeStyle = skinDk;
      ctx.lineWidth = 0.07;
      line(ctx, -0.25, -1.2, -0.2, -1.8);
      line(ctx, 0.25, -1.2, 0.2, -1.8);
      ctx.restore();
      // The broken ice round the hole.
      ctx.fillStyle = "#dff4ff";
      for (const [dx, h] of [[-1.7, 0.7], [-1.0, 0.5], [1.0, 0.55], [1.8, 0.8]]) poly(ctx, [[x + dx - 0.35, y + 0.05], [x + dx + 0.05, y - h], [x + dx + 0.4, y + 0.05]]), ctx.fill();
      if (m.act === "grab" && wait > 850) chips(ctx, x, y - 0.4, clamp((1000 - wait) / 150, 0, 1), 9, 3.4);
      return;
    }
    if (m.act === "warn") {
      const p = clamp(1 - wait / 500, 0, 1);
      const on = Math.floor(t / 70) % 2 === 0;
      // The hand pressing up from below, the ice bulging, cracks racing out.
      ctx.fillStyle = `rgba(190, 232, 255, ${0.25 + 0.4 * p})`;
      ellipse(ctx, x, y + 1.0, 1.5, 0.9);
      ctx.fill();
      for (let i = 0; i < 4; i++) line(ctx, x - 0.9 + i * 0.6, y + 1.1, x - 1.0 + i * 0.66, y + 0.35 - p * 0.15);
      ctx.strokeStyle = on ? "#ffffff" : "#bfe9ff";
      ctx.lineWidth = 0.14;
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI * ((i + 0.5) / 7);
        const len = (0.7 + (i % 3) * 0.45) * (0.4 + p * 1.5);
        line(ctx, x, y + 0.15, x + Math.cos(a) * len * 1.4, y + 0.15 + Math.sin(a) * len * 0.5 + 0.3);
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.06;
      for (let i = 0; i < 4; i++) line(ctx, x + (i - 1.5) * 0.7, y + 0.2, x + (i - 1.5) * 1.1, y + 0.8);
      if (p > 0.55) chips(ctx, x, y - 0.1, ((t / 90) % 1) * 0.5, 4, 1.6);
      return;
    }
    // Trailing under the ice: a dark smear under the surface, its wake showing as ripples and a hairline crack.
    const wake = -dir;
    ctx.fillStyle = "rgba(2, 14, 30, 0.5)";
    ellipse(ctx, x, y + 1.3, 1.6, 0.62);
    ctx.fill();
    ctx.fillStyle = "rgba(2, 14, 30, 0.28)";
    ellipse(ctx, x + wake * 1.8, y + 1.3, 1.5, 0.42);
    ctx.fill();
    ctx.strokeStyle = "rgba(205, 238, 255, 0.55)";
    ctx.lineWidth = 0.1;
    for (let i = 0; i < 3; i++) {
      const k = (t / 500 + i * 0.33) % 1;
      ctx.globalAlpha = 1 - k;
      ellipse(ctx, x + wake * k * 1.2, y + 0.18, 0.7 + k * 1.4, 0.14 + k * 0.1);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Pale fingertips pushing at the underside.
    ctx.strokeStyle = "rgba(170, 215, 240, 0.5)";
    ctx.lineWidth = 0.14;
    for (let i = 0; i < 4; i++) line(ctx, x + dir * (0.5 + i * 0.25), y + 1.5, x + dir * (0.7 + i * 0.3), y + 0.95);
  }

  /* ----------------------------------------------------------------- the shade */

  // The snow shade: out of sight it is only a trail of footprints pressed in the snow; shown (a bolt coming,
  // a wind-up, a lunge, a flare's light) it is a tall shroud of snow with a hollow face and long arms.
  function shade(ctx, v, m, x, y, t, flash) {
    const FH = v.g.FIELD_H;
    const dir = m.dir || 1;
    const prints = m.prints || [];
    for (let i = 0; i < prints.length; i++) {
      const p = prints[i];
      const a = clamp(1 - p.age / 5000, 0, 1);
      if (a <= 0) continue;
      const py = FH - p.y;
      const side = (i % 2 ? 1 : -1) * 0.45;
      ctx.fillStyle = `rgba(240, 250, 255, ${a * 0.75})`;
      ellipse(ctx, p.x + side, py + 0.1, 0.85, 0.34);
      ctx.fill();
      ctx.fillStyle = `rgba(6, 22, 42, ${a * 0.8})`;
      ellipse(ctx, p.x + side, py, 0.72, 0.27);
      ctx.fill();
      ctx.fillStyle = `rgba(6, 22, 42, ${a * 0.8})`;
      circle(ctx, p.x + side + dir * 0.75, py - 0.02, 0.17);
      ctx.fill();
    }
    const striking = m.act === "wind" || m.act === "lunge";
    const shown = Math.max(m.shownMs || 0, m.litMs || 0);
    if (!striking && shown <= 0) return;
    const a = (striking ? 1 : clamp(shown / 220, 0.15, 1)) * (0.88 + 0.12 * Math.sin(t / 60));
    const lunge = m.act === "lunge";
    const wind = m.act === "wind";
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(x, y);
    ctx.rotate(lunge ? dir * 0.34 : wind ? -dir * 0.14 : dir * 0.04);
    const sway = Math.sin(t / 240) * 0.2;
    const body = flash ? FLASH : "rgba(236, 247, 254, 0.9)";
    // A trailing streak of snow behind a lunge.
    if (lunge) {
      ctx.fillStyle = "rgba(226, 244, 255, 0.45)";
      poly(ctx, [[-dir * 1, -3.6], [-dir * 5.6, -2.4], [-dir * 1.4, -1.0]]);
      ctx.fill();
    }
    // The shroud: a hood, a long tapering body, a ragged hem that drags in the snow.
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-1.5 + sway, 0);
    ctx.quadraticCurveTo(-1.8, -3.4, -0.9, -4.5);
    ctx.quadraticCurveTo(0, -5.6, 0.9, -4.5);
    ctx.quadraticCurveTo(1.8, -3.4, 1.5 + sway, 0);
    for (let k = 0; k < 6; k++) {
      const sx = 1.5 - (k + 0.5) * 0.5;
      ctx.lineTo(sx + sway, -0.2 + (k % 2) * 0.55 + Math.sin(t / 110 + k * 2) * 0.18);
    }
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(120, 170, 205, 0.4)";
      ellipse(ctx, 0, -2.3, 0.95, 1.6);
      ctx.fill();
      ctx.strokeStyle = "rgba(190, 225, 245, 0.6)";
      ctx.lineWidth = 0.08;
      for (let k = 0; k < 4; k++) line(ctx, -1 + k * 0.65, -0.3, -0.8 + k * 0.6, -3.2);
    }
    // The hollow face.
    ctx.fillStyle = "#04101e";
    ellipse(ctx, dir * 0.3, -3.9, 0.95, 1.05);
    ctx.fill();
    ctx.fillStyle = "rgba(10, 36, 66, 0.9)";
    ellipse(ctx, dir * 0.45, -3.2, 0.35, striking ? 0.75 : 0.28);
    ctx.fill();
    // The arms, long and thin: down and trailing, raised in a wind-up, reaching in a lunge.
    ctx.lineCap = "round";
    for (const s of [0, 1]) {
      const sy = -3.3 + s * 0.3;
      const tip = lunge ? [dir * (3.8 + s * 0.4), -3.1 + s * 0.5] : wind ? [dir * (2.6 + s * 0.5), -5.3 - s * 0.5 + Math.sin(t / 50 + s) * 0.2] : [dir * (1.1 - s * 1.6) + sway * 2, -1.1 + Math.sin(t / 300 + s) * 0.2];
      ctx.strokeStyle = flash ? FLASH : "rgba(226, 244, 255, 0.92)";
      ctx.lineWidth = 0.42;
      ctx.beginPath();
      ctx.moveTo(dir * (0.7 - s * 0.9), sy);
      ctx.quadraticCurveTo(dir * (1.8 - s * 1.2), sy - 0.7 + (lunge ? 0.8 : 0), tip[0], tip[1]);
      ctx.stroke();
      ctx.lineWidth = 0.12;
      for (const f of [-0.45, 0, 0.45]) line(ctx, tip[0], tip[1], tip[0] + dir * 0.7, tip[1] + f);
    }
    ctx.lineCap = "butt";
    ctx.restore();
    // Snow whirling about it.
    ctx.fillStyle = "rgba(240, 250, 255, 0.8)";
    for (let i = 0; i < 7; i++) {
      const ang = t / 380 + (i * TAU) / 7;
      ctx.fillRect(x + Math.cos(ang) * (1.7 + (i % 3) * 0.3), y - 2.6 + Math.sin(ang * 1.3) * 2.3, 0.18, 0.18);
    }
    v.eyes.push(x + dir * 0.0, y - 3.9, 0.12, EYE_PALE);
    v.eyes.push(x + dir * 0.6, y - 3.9, 0.12, EYE_PALE);
  }

  /* ------------------------------------------------------------ the frozen ghoul */

  // A zombie caught by the lake: blue-white skin cracked like glass, a crust of ice on its shoulders and head, a beard
  // of icicles, hollow pale eyes, its breath smoking. Sliding on the ice it skates stiff-legged, leaning back.
  function frozen(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const g = v.g;
    const slide = clamp((m.sv || 0) * dir / 10, -1, 1);
    const sliding = Math.abs(m.sv || 0) > 3;
    const lurch = m.lurching;
    const step = Math.sin(t / (lurch ? 60 : 150));
    ctx.save();
    if (m.rise > 0) ctx.globalAlpha = Math.max(0.15, 1 - m.rise / (g.EMERGE_MS || 700));
    ctx.translate(x, y);
    ctx.rotate(dir * (lurch ? 0.3 : 0.1) - (sliding ? slide * dir * 0.12 : 0));
    ctx.lineCap = "round";
    const skin = flash ? FLASH : "#9cc6dc";
    const skinDk = flash ? FLASH : "#5f8fae";
    const coat = flash ? FLASH : "#3a5f7e";
    // Legs: stiff and braced when it slides, striding when it walks.
    const legs = sliding ? [[-0.6, -1.9, -1.2 * dir * slide, 0], [0.6, -1.9, 1.0 * dir * slide + 0.2, 0]] : [[-0.55, -1.9, -0.55 + step * 0.6, 0], [0.55, -1.9, 0.65 - step * 0.35, -0.1]];
    for (const [hx, hy, fx, fy] of legs) {
      bone(ctx, [[hx, hy], [fx, fy - 0.1]], 0.62, coat);
      blob(ctx, fx + dir * 0.3, fy - 0.1, 0.55, 0.26, flash ? FLASH : "#e6f4fc");
    }
    // A coat in tatters, a plate of ice over the chest.
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-1.25, -4.0);
    ctx.lineTo(1.25, -4.0);
    ctx.lineTo(1.15, -1.7);
    for (let k = 0; k <= 4; k++) ctx.lineTo(1.15 - k * 0.575, -1.7 + (k % 2 ? 0.5 : 0));
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(205, 238, 255, 0.55)";
      poly(ctx, [[-1.0, -3.9], [0.9, -3.9], [1.0, -2.5], [0.1, -2.0], [-0.9, -2.6]]);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 0.07;
      line(ctx, -0.6, -3.7, -0.2, -2.6);
      line(ctx, 0.2, -3.7, 0.6, -2.7);
    }
    // Arms stiff in front of it, fingers frozen into hooks.
    const reach = dir * (2.6 + (lurch ? 0.5 : Math.sin(t / 130) * 0.2));
    for (const [sy, fy] of [[-3.5, -3.7 + step * 0.15], [-3.2, -3.1 + step * 0.15]]) {
      bone(ctx, [[dir * 0.7, sy], [reach, fy]], 0.4, skin);
      ctx.strokeStyle = skinDk;
      ctx.lineWidth = 0.1;
      for (const f of [-0.28, 0, 0.28]) line(ctx, reach, fy, reach + dir * 0.55, fy + f + 0.2);
    }
    // The crust: jagged crystals on the shoulders.
    ctx.fillStyle = flash ? FLASH : "rgba(214, 242, 255, 0.92)";
    for (const [cx, cy, h, lean] of [[-1.1, -3.9, 1.3, -0.4], [-0.55, -4.1, 0.9, -0.1], [1.0, -3.95, 1.1, 0.3], [0.5, -4.1, 0.8, 0.1]]) {
      poly(ctx, [[cx - 0.32, cy], [cx + lean * h, cy - h], [cx + 0.32, cy]]);
      ctx.fill();
    }
    // The head: blue skull skin, a mop of frost, hollow eyes, an open mouth with a beard of icicles under it.
    const hx = dir * 0.15;
    blob(ctx, hx, -5.0, 0.92, 0.95, skin);
    ctx.fillStyle = flash ? FLASH : "#eaf8ff";
    for (const [dx, h] of [[-0.55, 0.9], [-0.15, 1.2], [0.3, 1.0], [0.65, 0.7]]) poly(ctx, [[hx + dx - 0.25, -5.6], [hx + dx, -5.6 - h], [hx + dx + 0.25, -5.6]]), ctx.fill();
    ctx.fillStyle = "#031322";
    for (const s of [-0.28, 0.42]) {
      ellipse(ctx, hx + dir * s, -5.15, 0.2, 0.26);
      ctx.fill();
    }
    ellipse(ctx, hx + dir * 0.4, -4.45, 0.3, 0.2 + Math.abs(Math.sin(t / 260)) * 0.12);
    ctx.fill();
    ctx.fillStyle = flash ? FLASH : "#d8f2ff";
    for (let k = 0; k < 4; k++) poly(ctx, [[hx - 0.4 + k * 0.28, -4.25], [hx - 0.3 + k * 0.28, -3.5 - (k % 2) * 0.35], [hx - 0.2 + k * 0.28, -4.25]]), ctx.fill();
    ctx.restore();
    // Its breath, smoking in the cold.
    ctx.fillStyle = "rgba(226, 244, 255, 0.5)";
    for (let i = 0; i < 4; i++) {
      const k = (t / 700 + i * 0.25) % 1;
      circle(ctx, x + dir * (1.1 + k * 1.2), y - 4.5 - k * 1.1, 0.15 + k * 0.3);
      ctx.globalAlpha = (1 - k) * 0.5;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    v.eyes.push(x - dir * 0.1, y - 5.2, 0.1, EYE_PALE);
    v.eyes.push(x + dir * 0.7, y - 5.2, 0.1, EYE_PALE);
  }

  /* ------------------------------------------------------------- the ice wraith */

  // A shroud of blue ice: a crown of shards over the hood, a fringe of icicles for a hem, eyes that burn pale.
  // It gapes and shakes before it dives, and streaks along its own wake of crystals once it does.
  function icewraith(ctx, v, m, x, y, t, flash) {
    if (m.act === "idle") return;
    const wind = m.act === "wind";
    const dive = m.act === "dive";
    const dir = m.dir || 1;
    const shiver = wind ? Math.sin(t / 18) * 0.25 : 0;
    ctx.save();
    ctx.translate(x + shiver, y);
    if (dive) {
      const ang = Math.atan2(-(m.vy || 0), Math.abs(m.vx) || 1) * dir;
      ctx.rotate(clamp(ang, -0.9, 0.9));
      // The wake: crystals and a pale streak behind it.
      ctx.fillStyle = "rgba(190, 233, 255, 0.35)";
      poly(ctx, [[-dir * 1.2, -3.8], [-dir * 7.5, -2.5], [-dir * 1.2, -1.0]]);
      ctx.fill();
      ctx.fillStyle = "rgba(235, 250, 255, 0.8)";
      for (let i = 0; i < 6; i++) ctx.fillRect(-dir * (2 + i * 0.95), -2.6 + Math.sin(t / 60 + i * 2) * 1.0, 0.24, 0.24);
    }
    const body = flash ? FLASH : "rgba(150, 205, 238, 0.94)";
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-1.5, -1.6);
    ctx.quadraticCurveTo(-1.6, -4.7, 0, -4.7);
    ctx.quadraticCurveTo(1.6, -4.7, 1.5, -1.6);
    for (let k = 0; k < 6; k++) {
      const sx = 1.5 - (k + 0.5) * 0.5;
      ctx.lineTo(sx + Math.sin(t / 100 + k) * 0.2 - dir * (dive ? 0.9 : 0), 0.7 + (k % 2) * 1.1);
      ctx.lineTo(sx - 0.18, -0.8);
    }
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "rgba(235, 250, 255, 0.55)";
      poly(ctx, [[-0.9, -4.3], [0.2, -4.5], [0.1, -2.2], [-0.8, -2.0]]);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.lineWidth = 0.08;
      line(ctx, -0.5, -4.2, -0.4, -2.4);
      // A crown of ice shards.
      ctx.fillStyle = "#eaf8ff";
      for (const [cx, h, lean] of [[-0.9, 1.2, -0.5], [-0.35, 1.7, -0.15], [0.25, 1.5, 0.2], [0.8, 1.0, 0.5]]) {
        poly(ctx, [[cx - 0.26, -4.45], [cx + lean * h * 0.5, -4.45 - h], [cx + 0.26, -4.45]]);
        ctx.fill();
      }
    }
    // The face: black hollows, and when it shrieks a wide jagged mouth.
    ctx.fillStyle = "#020a14";
    ellipse(ctx, dir * 0.25, -3.4, 0.75, 0.85);
    ctx.fill();
    if (wind || dive) {
      ctx.fillStyle = "#000000";
      ellipse(ctx, dir * 0.3, -2.6, 0.38, 0.7 + (wind ? Math.abs(Math.sin(t / 40)) * 0.15 : 0));
      ctx.fill();
      ctx.fillStyle = "#eaf8ff";
      for (const s of [-0.28, -0.1, 0.1, 0.28]) poly(ctx, [[dir * 0.3 + s - 0.08, -3.25], [dir * 0.3 + s, -2.85], [dir * 0.3 + s + 0.08, -3.25]]), ctx.fill();
      // Ragged hands out in front of it.
      ctx.strokeStyle = flash ? FLASH : "#cfeeff";
      ctx.lineWidth = 0.17;
      for (const s of [-0.3, 0.3]) {
        line(ctx, dir * 0.6, -2.4 + s, dir * 2.2, -2.6 + s * 2);
        for (const f of [-0.25, 0, 0.25]) line(ctx, dir * 2.2, -2.6 + s * 2, dir * 2.8, -2.6 + s * 2 + f);
      }
    }
    ctx.restore();
    const big = wind ? 0.15 : 0.11;
    const eyeColor = wind ? "#ffffff" : EYE_PALE;
    v.eyes.push(x + shiver, y - 3.5, big, eyeColor);
    v.eyes.push(x + shiver + dir * 0.5, y - 3.5, big, eyeColor);
    // The mist a shrieking one breathes out.
    if (wind) {
      ctx.fillStyle = "rgba(226, 246, 255, 0.4)";
      for (let i = 0; i < 4; i++) {
        const k = (t / 220 + i * 0.25) % 1;
        circle(ctx, x + dir * (1.2 + k * 2.5), y - 2.6 + (i - 1.5) * k * 0.8, 0.2 + k * 0.45);
        ctx.fill();
      }
    }
  }

  /* ------------------------------------------------------------ the Frost Widow */

  // Her legs reach for the floor on both sides; hung from the roof they dangle and curl. Local coordinates, y up,
  // x toward Planny; the hips on her back and shoulders, then where each foot goes low and hanging.
  const HIPS = freeze([[-0.4, 5.6], [0.6, 6.0], [1.7, 5.9], [2.8, 5.4]]);
  const FOOT_LOW = freeze([-8.8, -5.4, 6.2, 9.8]);
  const FOOT_HANG = freeze([-3.6, -1.6, 3.4, 5.6]);
  const KNEE_LOW = freeze([11.4, 12.4, 12.6, 11.6]);
  const MAW = freeze([4.2, 2.7]);

  // One leg: hip, knee, foot, with a crystal of frost at the knee and a hooked claw at the foot.
  function leg(ctx, hip, knee, foot, w, color, flash) {
    bone(ctx, [hip, knee, foot], w, color);
    ctx.fillStyle = flash ? FLASH : FROST;
    poly(ctx, [[knee[0] - 0.32, knee[1] - 0.05], [knee[0] + 0.04, knee[1] + 0.95], [knee[0] + 0.32, knee[1] - 0.05]]);
    ctx.fill();
    bone(ctx, [foot, [foot[0] + (foot[0] > hip[0] ? 0.4 : -0.4), foot[1] - 0.4]], w * 0.6, flash ? FLASH : "#eaf8ff");
  }

  // The veil: a curtain of frozen web hung from her back and shoulders to the floor, its hem scalloped, frost
  // ferns on it. `grow` is how far down it has come (1 whole; it comes back from the top in its last moments).
  function veilShape(ctx, t, grow, flash) {
    const top = 13.4;
    const hem = lerp(top - 0.6, 0.4, grow);
    ctx.beginPath();
    ctx.moveTo(-6.8, top - 1.4);
    ctx.quadraticCurveTo(-2, top + 1.2, 3, top + 0.2);
    ctx.quadraticCurveTo(6.2, top - 0.6, 7.2, top - 2.2);
    ctx.lineTo(7.4, hem + 0.9);
    const n = 8;
    for (let k = 0; k < n; k++) {
      const x0 = 7.4 - (k * 14.2) / n;
      const x1 = 7.4 - ((k + 1) * 14.2) / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, hem - 0.9 + Math.sin(t / 700 + k) * 0.12 - (k % 2) * 0.35, x1, hem + 0.9);
    }
    ctx.closePath();
    ctx.fillStyle = flash ? FLASH : "rgba(172, 224, 250, 0.66)";
    ctx.fill();
    if (flash) return;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 252, 255, 0.95)";
    ctx.lineWidth = 0.14;
    ctx.stroke();
    // Frost ferns running down it, and the folds.
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.lineWidth = 0.09;
    for (const fx of [-4.6, -1.4, 2.0, 5.0]) {
      const y0 = top - 0.8 - (fx > 0 ? 0.6 : 0);
      ctx.beginPath();
      ctx.moveTo(fx, y0);
      ctx.lineTo(fx + 0.2, Math.max(hem + 1.6, y0 - 7.5 * grow));
      ctx.stroke();
      for (let s = 1; s < 5; s++) {
        const sy = y0 - s * 1.5 * grow;
        if (sy < hem + 1.4) break;
        line(ctx, fx + 0.1, sy, fx + 1.0, sy + 0.7);
        line(ctx, fx + 0.1, sy, fx - 0.9, sy + 0.7);
      }
    }
    ctx.strokeStyle = "rgba(90, 150, 190, 0.35)";
    for (let k = 0; k < 6; k++) line(ctx, -6 + k * 2.4, top - 1.6, -6.2 + k * 2.4, hem + 1.6);
    // Glints on it.
    for (let i = 0; i < 5; i++) {
      const k = Math.max(0, Math.sin(t / 380 + i * 2.1));
      ctx.fillStyle = `rgba(255, 255, 255, ${k * 0.9})`;
      ctx.fillRect(-5 + i * 2.6, hem + 2 + ((i * 2.3) % 6), 0.22, 0.22);
    }
  }

  // The heart: a crystal of red, beating, in the dark of her open mouth.
  function heart(ctx, x, y, s, beat) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * beat, s * beat);
    ctx.fillStyle = "#ff3a5a";
    ctx.beginPath();
    ctx.moveTo(0, -0.7);
    ctx.bezierCurveTo(-1.2, 0.1, -0.6, 0.9, 0, 0.4);
    ctx.bezierCurveTo(0.6, 0.9, 1.2, 0.1, 0, -0.7);
    ctx.fill();
    ctx.restore();
  }

  function widow(ctx, v, b) {
    const FH = v.g.FIELD_H;
    const card = !v.spec;
    const t = v.clock;
    const dir = b.dir || 1;
    const floor = card ? 0 : b.floor ?? 6;
    const lowK = card ? 1 : clamp(1 - (b.y - floor) / 20, 0, 1);
    const hanging = lowK < 0.5;
    const flash = b.hurt > 0 && Math.floor(b.hurt / 55) % 2 === 0;
    const awake = card || b.state === "fight";
    const raged = Boolean(b.raged);
    const veilUp = card ? true : b.veil !== false;
    const back = !veilUp && !card && (b.veilMs || 0) < 900 ? 1 - (b.veilMs || 0) / 900 : 0;
    const spitP = !card && b.spitWind > 0 ? ease(clamp(1 - b.spitWind / 600, 0, 1)) : 0;
    const open = card ? 0.12 : spitP > 0 ? spitP : b.mouth ? 1 : 0.1 + 0.05 * Math.sin(t / 260);
    const wide = card ? 0.62 : 1;
    const oy = FH - b.y;
    const bob = hanging && !card ? Math.sin(t / 520) * 0.25 : 0;
    const eyeColor = raged ? "#ff3a2a" : awake ? "#bfe9ff" : "#6a8fa8";
    // Her shadow on the floor, and where she will land (a ring that closes in the drop's last moments).
    if (!card) {
      ctx.fillStyle = `rgba(0, 10, 24, ${0.32 * (1 - lowK)})`;
      ellipse(ctx, b.x, FH - floor - 0.05, 5.2 * (1 - 0.3 * (1 - lowK)), 0.7);
      ctx.fill();
      if (b.act === "drop" && b.toX !== undefined) {
        const p = clamp(1 - (b.wait || 0) / 700, 0, 1);
        ctx.fillStyle = `rgba(0, 10, 24, ${0.2 + 0.3 * p})`;
        ellipse(ctx, b.toX, FH - floor - 0.05, 6.2 * (0.55 + 0.45 * p), 0.8);
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 90, 90, ${0.35 + 0.5 * p})`;
        ctx.lineWidth = 0.22;
        ellipse(ctx, b.toX, FH - floor - 0.05, 6.4, 0.9);
        ctx.stroke();
      }
      // Her thread, up to the roof.
      ctx.strokeStyle = `rgba(232, 247, 255, ${0.35 + 0.4 * (1 - lowK)})`;
      ctx.lineWidth = 0.16;
      const tx = b.x - dir * 2.7;
      ctx.beginPath();
      ctx.moveTo(tx, oy - 12.9 - bob);
      ctx.lineTo(tx + Math.sin(t / 900) * 0.2 * lowK, -1);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(card ? 0 : b.x, oy);
    ctx.scale(dir, -1);
    const chitin = flash ? FLASH : CHITIN;
    const chitinDk = flash ? FLASH : CHITIN_DK;
    const walking = !card && b.act === "low";
    const skitter = !card && b.act === "hang";
    const footAt = (i, far) => {
      const phase = t / (skitter ? 70 : 150) + i * 1.7 + (far ? 2.6 : 0);
      const x = lerp(FOOT_HANG[i], FOOT_LOW[i] * wide, lowK) + (far ? 1.4 : 0) + (skitter ? Math.sin(phase) * 0.7 : walking ? Math.sin(phase) * 0.4 : 0);
      const y = lerp(-6.6 - (i % 2) * 1.6 + Math.sin(t / 600 + i) * 0.5, walking ? Math.max(0, Math.sin(phase)) * 0.9 : 0, lowK);
      return [x, y];
    };
    const kneeAt = (i, far) => {
      const hip = HIPS[i];
      const foot = footAt(i, far);
      const out = Math.sign(foot[0] - hip[0]) || 1;
      return [lerp(hip[0] + out * 2.4, lerp(hip[0], foot[0], 0.46), lowK) + (far ? 0.6 : 0), lerp(7.6 + (i % 2) * 0.6, KNEE_LOW[i], lowK) + bob];
    };
    // The far legs first, darker.
    for (let i = 0; i < 4; i++) leg(ctx, [HIPS[i][0] + 0.5, HIPS[i][1] + bob - 0.3], kneeAt(i, true), footAt(i, true), 0.5, chitinDk, flash);
    // The abdomen: a great pale bulb, frosted, with a crystal hourglass on it; spines when she rages.
    const ax = -2.7;
    const ay = 8.3 + bob;
    if (raged && !flash) {
      ctx.strokeStyle = `rgba(255, 60, 90, ${0.28 + 0.15 * Math.sin(t / 110)})`;
      ctx.lineWidth = 0.3;
      ellipse(ctx, 0, 7 + bob, 8.8, 9.4);
      ctx.stroke();
    }
    blob(ctx, ax, ay, 4.4, 4.8, chitin);
    if (!flash) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ellipse(ctx, ax - 0.9, ay + 1.9, 2.1, 1.6);
      ctx.fill();
      ctx.strokeStyle = "rgba(100, 160, 196, 0.6)";
      ctx.lineWidth = 0.1;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        ctx.ellipse?.(ax, ay, 4.0 - k * 0.2, 4.4 - k * 0.55, 0, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.fillStyle = raged ? "#ff4a6a" : "#7fd0f0";
      poly(ctx, [[ax - 1.3, ay + 1.8], [ax + 1.3, ay + 1.8], [ax, ay + 0.2], [ax + 1.3, ay - 1.6], [ax - 1.3, ay - 1.6], [ax, ay + 0.2]]);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      poly(ctx, [[ax - 0.5, ay + 1.5], [ax + 0.5, ay + 1.5], [ax, ay + 0.5]]);
      ctx.fill();
      if (raged) {
        ctx.fillStyle = "#eaf8ff";
        for (let k = 0; k < 6; k++) {
          const a = Math.PI * (0.18 + k * 0.13);
          poly(ctx, [[ax + Math.cos(a) * 4.2 - 0.3, ay + Math.sin(a) * 4.6], [ax + Math.cos(a) * 5.7, ay + Math.sin(a) * 6.2], [ax + Math.cos(a) * 4.2 + 0.3, ay + Math.sin(a) * 4.6]]);
          ctx.fill();
        }
      }
    }
    // The front: cephalothorax, the jaws and the maw with the heart in it, the eyes.
    blob(ctx, 1.7, 4.5 + bob * 0.5, 3.2, 2.7, chitin);
    if (!flash) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ellipse(ctx, 1.2, 5.6 + bob * 0.5, 1.5, 0.8);
      ctx.fill();
    }
    const mx = MAW[0];
    const my = MAW[1] + bob * 0.5;
    const rx = 0.55 + open * 1.5;
    const ry = 0.8 + open * 2.1;
    ctx.fillStyle = "#2a0614";
    ellipse(ctx, mx, my, rx, ry);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.1;
    ctx.stroke();
    if (open > 0.3) {
      const beat = 1 + 0.16 * Math.max(0, Math.sin(t / 150));
      heart(ctx, mx - 0.2, my - 0.1, 0.5 + 0.95 * open, beat);
      if (open > 0.9 && !veilUp && !card) {
        // The weak spot: a ring that pulses round the heart while it is bare.
        ctx.strokeStyle = `rgba(245, 179, 1, ${0.5 + 0.4 * Math.sin(t / 110)})`;
        ctx.lineWidth = 0.2;
        circle(ctx, mx - 0.2, my - 0.1, 2.3 + 0.25 * Math.sin(t / 110));
        ctx.stroke();
      }
    }
    // Fangs: down from the top lip, up from the lower.
    ctx.fillStyle = flash ? FLASH : "#f4fcff";
    for (const s of [-1, 1]) {
      poly(ctx, [[mx + s * rx * 0.75 - 0.22, my + ry * 0.7], [mx + s * rx * 0.7, my - ry - 0.9], [mx + s * rx * 0.75 + 0.22, my + ry * 0.7]]);
      ctx.fill();
      poly(ctx, [[mx + s * rx * 0.45 - 0.18, my - ry * 0.8], [mx + s * rx * 0.4, my + ry + 0.55], [mx + s * rx * 0.45 + 0.18, my - ry * 0.8]]);
      ctx.fill();
    }
    // Eight eyes: two big, six small.
    for (const [ex, ey, r] of [[3.4, 5.9, 0.46], [4.4, 5.4, 0.4], [2.8, 5.4, 0.2], [3.7, 6.7, 0.22], [4.9, 4.7, 0.2], [2.4, 6.0, 0.17]]) {
      ctx.fillStyle = INK;
      circle(ctx, ex, ey + bob * 0.5, r + 0.1);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : eyeColor;
      circle(ctx, ex, ey + bob * 0.5, r * 0.78);
      ctx.fill();
    }
    // The near legs, over the body.
    for (let i = 0; i < 4; i++) leg(ctx, [HIPS[i][0], HIPS[i][1] + bob], kneeAt(i, false), footAt(i, false), 0.66, chitin, flash);
    // The veil, or what is left of it.
    const vgrow = veilUp ? 1 : back;
    if (vgrow > 0.02) veilShape(ctx, t, vgrow, flash);
    if (!veilUp) {
      ctx.fillStyle = "rgba(226, 246, 255, 0.8)";
      for (let k = 0; k < 5; k++) poly(ctx, [[-6 + k * 3 - 0.3, 13.2], [-6 + k * 3, 13.2 - 1.3 - (k % 3) * 0.6], [-6 + k * 3 + 0.3, 13.2]]), ctx.fill();
      for (let i = 0; i < 4; i++) {
        const k = (t / 560 + i * 0.27) % 1;
        ctx.fillStyle = `rgba(190, 232, 255, ${0.9 * (1 - k)})`;
        circle(ctx, -4 + i * 2.8, 12.4 - k * 9, 0.15);
        ctx.fill();
        ctx.fillStyle = `rgba(226, 244, 255, ${0.22 * (1 - k)})`;
        circle(ctx, -3.5 + i * 2.6 + Math.sin(t / 300 + i) * 0.5, 11 + k * 3, 0.5 + k * 0.7);
        ctx.fill();
      }
    }
    ctx.restore();
    // The glow of her eyes in the dark (canvas coordinates, mirrored for the way she faces).
    if (!flash) for (const [ex, ey] of [[3.4, 5.9], [4.4, 5.4]]) v.eyes.push((card ? 0 : b.x) + dir * ex, oy - ey - bob * 0.5, 0.5, eyeColor);
    if (!veilUp && open > 0.5 && !card) v.eyes.push(b.x + dir * (mx - 0.2), oy - my, 0.7, "#ff3a5a");
  }

  /* ------------------------------------------------------ hazards and missiles */

  // An ice shard: tinkling where it fell (warn), then a diamond of ice skating along the floor, or flying at chest height.
  function shard(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = v.clock;
    if (h.warn > 0) {
      const p = 1 - h.warn / 220;
      ctx.fillStyle = "#dff4ff";
      for (let i = -1; i <= 1; i++) {
        const j = Math.sin(t / 28 + i * 2) * 0.1;
        poly(ctx, [[h.x + i * 0.75 - 0.3 + j, y], [h.x + i * 0.75 + j, y - 0.7 - (i === 0 ? 0.45 : 0)], [h.x + i * 0.75 + 0.3 + j, y]]);
        ctx.fill();
      }
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.4 + 0.5 * p})`;
      ctx.lineWidth = 0.1;
      line(ctx, h.x - 0.9, y - 0.9, h.x + 0.9, y - 0.2);
      line(ctx, h.x + 0.9, y - 0.9, h.x - 0.9, y - 0.2);
      return;
    }
    const dir = Math.sign(h.vx) || 1;
    ctx.save();
    ctx.translate(h.x, y - h.h / 2);
    ctx.fillStyle = "rgba(190, 233, 255, 0.4)";
    poly(ctx, [[-dir * 1.3, 0], [-dir * 4.6, -0.2], [-dir * 1.3, 0.5]]);
    ctx.fill();
    if (h.off > 0) ctx.rotate(Math.sin(t / 90) * 0.12);
    outlined(ctx, [[-dir * 1.25, 0], [-dir * 0.2, -h.h * 0.62], [dir * 1.45, 0], [-dir * 0.2, h.h * 0.62]], ICE, "#2a6a96", 0.1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    poly(ctx, [[-dir * 0.8, 0], [-dir * 0.2, -h.h * 0.4], [dir * 0.7, -0.05]]);
    ctx.fill();
    ctx.restore();
    v.eyes.push(h.x, y - h.h / 2, 0.3, "#bfe9ff");
  }

  // An ice spike: the floor splitting along a jagged line that glows white as the time runs out (warn),
  // then a stand of ice driving up out of it, the tallest in the middle.
  function spike(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = v.clock;
    if (h.warn > 0) {
      const p = 1 - h.warn / 800;
      const half = (h.w / 2 + 0.6) * (0.55 + 0.45 * p);
      const last = h.warn < 260;
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const px = h.x - half + (i / 10) * half * 2;
        const py = y + 0.08 + (i % 2 ? -0.2 : 0.14) * (0.5 + p);
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.strokeStyle = last ? "rgba(255, 255, 255, 0.98)" : `rgba(225, 245, 255, ${0.4 + 0.5 * p})`;
      ctx.lineWidth = 0.18 + 0.2 * p;
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 0.07;
      ctx.stroke();
      if (last) {
        ctx.fillStyle = `rgba(255, 120, 100, ${0.25 + 0.25 * Math.sin(t / 40)})`;
        ellipse(ctx, h.x, y, half + 0.4, 0.5);
        ctx.fill();
      }
      for (let i = 0; i < 3; i++) {
        const k = (t / 260 + i * 0.33) % 1;
        ctx.fillStyle = `rgba(235, 250, 255, ${(1 - k) * 0.8 * p})`;
        ctx.fillRect(h.x + (i - 1) * half * 0.7, y - k * 1.5 * p, 0.22, 0.22);
      }
      return;
    }
    const up = h.up || 1000;
    const k = ease(clamp((up - h.live) / 110, 0, 1)) * clamp(h.live / 160, 0, 1);
    if (k <= 0.01) return;
    const lean = Math.sin(t / 200) * 0.03;
    // Rubble thrown out round the foot of it.
    ctx.fillStyle = "#dff4ff";
    for (const [dx, s] of [[-2.2, 0.38], [-1.7, 0.28], [1.9, 0.34], [2.3, 0.26]]) {
      poly(ctx, [[h.x + dx - s, y], [h.x + dx, y - s * 1.6], [h.x + dx + s, y]]);
      ctx.fill();
    }
    for (const [dx, hh, bw] of [[-1.4, 0.58, 0.8], [1.4, 0.5, 0.75], [0, 1, 1.15]]) {
      const H = h.h * hh * k;
      const cx = h.x + dx;
      poly(ctx, [[cx - bw, y], [cx + lean * H, y - H], [cx, y]]);
      ctx.fillStyle = "#f4fcff";
      ctx.fill();
      poly(ctx, [[cx, y], [cx + lean * H, y - H], [cx + bw, y]]);
      ctx.fillStyle = "#7fbfe0";
      ctx.fill();
      poly(ctx, [[cx - bw, y], [cx + lean * H, y - H], [cx + bw, y]]);
      ctx.strokeStyle = "#2a6a96";
      ctx.lineWidth = 0.1;
      ctx.stroke();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
      ctx.lineWidth = 0.08;
      line(ctx, cx - bw * 0.45, y - H * 0.2, cx + lean * H - 0.05, y - H * 0.9);
    }
    v.eyes.push(h.x, y - h.h * 0.5, 0.6, "#bfe9ff");
  }

  // A glob of web in flight: a sticky white ball, threads streaming back along its path.
  function webGlob(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const sp = Math.hypot(h.vx || 0, h.vy || 0) || 1;
    const bx = -(h.vx || 0) / sp;
    const by = (h.vy || 0) / sp;
    ctx.strokeStyle = "rgba(235, 248, 255, 0.7)";
    ctx.lineWidth = 0.1;
    for (let i = 0; i < 5; i++) {
      const sway = Math.sin(v.clock / 90 + i * 1.7) * 0.4;
      ctx.beginPath();
      ctx.moveTo(h.x, y);
      ctx.quadraticCurveTo(h.x + bx * 1.6 + sway, y + by * 1.6 + (i - 2) * 0.3, h.x + bx * (3 + i * 0.5), y + by * (3 + i * 0.5) + (i - 2) * 0.55);
      ctx.stroke();
    }
    ctx.fillStyle = "#f4fcff";
    circle(ctx, h.x, y, 0.85);
    ctx.fill();
    ctx.fillStyle = "rgba(150, 205, 235, 0.7)";
    circle(ctx, h.x + 0.2, y + 0.2, 0.5);
    ctx.fill();
    ctx.strokeStyle = "#7fbfe0";
    ctx.lineWidth = 0.08;
    for (let i = 0; i < 4; i++) {
      const a = (h.spin || 0) + (i * Math.PI) / 2;
      line(ctx, h.x, y, h.x + Math.cos(a) * 0.8, y + Math.sin(a) * 0.8);
    }
    v.eyes.push(h.x, y, 0.4, "#eaf8ff");
  }

  // A patch of web on the floor: spokes and rings, strands standing up out of it, fading as it dries.
  function webPatch(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const fade = clamp(h.life / 1000, 0, 1) * clamp((h.max - h.life) / 200, 0, 1);
    if (fade <= 0) return;
    ctx.globalAlpha = fade;
    const rx = h.w / 2;
    ctx.fillStyle = "rgba(226, 244, 255, 0.5)";
    ellipse(ctx, h.x, y - 0.1, rx, 0.62);
    ctx.fill();
    ctx.strokeStyle = "rgba(244, 252, 255, 0.85)";
    ctx.lineWidth = 0.1;
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (i / 8);
      line(ctx, h.x, y - 0.1, h.x + Math.cos(a) * rx * 1.04, y - 0.1 - Math.sin(a) * 0.62);
      line(ctx, h.x, y - 0.1, h.x - Math.cos(a) * rx * 1.04, y - 0.1 + Math.sin(a) * 0.1);
    }
    for (const k of [0.4, 0.7, 1]) {
      ellipse(ctx, h.x, y - 0.1, rx * k, 0.62 * k);
      ctx.stroke();
    }
    ctx.lineWidth = 0.08;
    for (let i = 0; i < 6; i++) {
      const sx = h.x + (i - 2.5) * (h.w / 6.5);
      const hh = 0.7 + ((i * 7) % 4) * 0.25 + Math.sin(v.clock / 300 + i) * 0.1;
      line(ctx, sx, y - 0.2, sx + Math.sin(v.clock / 500 + i) * 0.2, y - 0.2 - hh);
    }
    ctx.globalAlpha = 1;
  }

  // A barrel of fire: a tarred cask with iron hoops and a flame painted on it, a fuse burning on the lid; kicked, it rolls
  // blazing, its fire streaming behind it.
  function flames(ctx, x, y, w, h, t, seed, back = 0) {
    for (let i = 0; i < 4; i++) {
      const cx = x + (i - 1.5) * w * 0.28 + back * (0.6 + i * 0.35);
      const fh = h * (0.55 + 0.45 * Math.abs(Math.sin(t / (90 + i * 23) + i * 2 + seed)));
      for (const [k, c] of [[1, FLAME[0]], [0.7, FLAME[1]], [0.42, FLAME[2]]]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.2 * k, y);
        ctx.quadraticCurveTo(cx - w * 0.16 * k + back * 0.2, y - fh * 0.5 * k, cx + Math.sin(t / 70 + i + seed) * 0.15 + back * 0.3 * k, y - fh * k);
        ctx.quadraticCurveTo(cx + w * 0.16 * k, y - fh * 0.5 * k, cx + w * 0.2 * k, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  function barrel(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = v.clock;
    const rolling = h.state === "roll";
    const dir = Math.sign(h.vx) || 1;
    if (rolling) flames(ctx, h.x - dir * 2.2, y - 1.2, 3.2, 3.6, t, h.x, -dir * 1.6);
    ctx.save();
    ctx.translate(h.x, y - 1.7);
    if (rolling) ctx.rotate((h.roll || 0) / 1.5);
    ctx.fillStyle = "#6a2a18";
    poly(ctx, [[-1.0, -1.7], [1.0, -1.7], [1.27, -0.6], [1.27, 0.6], [1.0, 1.7], [-1.0, 1.7], [-1.27, 0.6], [-1.27, -0.6]]);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.12;
    ctx.stroke();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 0.07;
    for (const sx of [-0.65, 0, 0.65]) line(ctx, sx, -1.6, sx * 1.15, 1.6);
    ctx.fillStyle = "#9aa4ae";
    for (const hy of [-1.2, 1.0]) ctx.fillRect(-1.27, hy - 0.12, 2.54, 0.26);
    ctx.fillStyle = "#6a7480";
    for (const hy of [-1.2, 1.0]) ctx.fillRect(-1.27, hy + 0.1, 2.54, 0.08);
    // The flame painted on its side, so it reads as a thing to light.
    ctx.fillStyle = "#ff8a1a";
    ctx.beginPath();
    ctx.moveTo(0, -0.7);
    ctx.quadraticCurveTo(-0.55, 0.1, 0, 0.55);
    ctx.quadraticCurveTo(0.55, 0.1, 0, -0.7);
    ctx.fill();
    ctx.fillStyle = "#ffd23a";
    ctx.beginPath();
    ctx.moveTo(0, -0.2);
    ctx.quadraticCurveTo(-0.25, 0.2, 0, 0.45);
    ctx.quadraticCurveTo(0.25, 0.2, 0, -0.2);
    ctx.fill();
    ctx.restore();
    // A small flame smoldering on the lid, a big one once it rolls.
    if (!rolling) flames(ctx, h.x, y - 3.3, 1.5, 1.2, t, h.x * 3);
    else flames(ctx, h.x, y - 3.3, 2.6, 2.2, t, h.x * 3, -dir * 0.8);
    v.eyes.push(h.x, y - 1.7, rolling ? 0.8 : 0.4, "#ff8a1a");
  }

  // A road flare in flight: a red stick, its tip white-hot, sparks flying off it.
  function flareShape(ctx) {
    ctx.fillStyle = "#c8281a";
    ctx.fillRect(-0.9, -0.28, 1.6, 0.56);
    ctx.fillStyle = "#f2e8d0";
    ctx.fillRect(-0.2, -0.28, 0.22, 0.56);
    ctx.fillRect(0.38, -0.28, 0.16, 0.56);
    ctx.fillStyle = "#fff4c0";
    ctx.fillRect(0.7, -0.2, 0.3, 0.4);
  }
  function armRoadFlare(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = v.clock;
    ctx.save();
    ctx.translate(h.x, y);
    ctx.rotate(-(h.spin || 0));
    ctx.scale(1.2, 1.2);
    flareShape(ctx);
    ctx.restore();
    ctx.fillStyle = "rgba(255, 244, 200, 0.95)";
    circle(ctx, h.x + Math.cos(-(h.spin || 0)) * 1.2, y + Math.sin(-(h.spin || 0)) * 1.2, 0.5);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const k = (t / 160 + i * 0.17) % 1;
      ctx.fillStyle = `rgba(255, ${150 + i * 18}, 60, ${1 - k})`;
      ctx.fillRect(h.x - (h.vx > 0 ? 1 : -1) * k * 3 + Math.sin(i * 3 + t / 40) * 0.4, y + (k - 0.4) * 1.6 + Math.sin(i * 5) * 0.6, 0.22, 0.22);
    }
    v.eyes.push(h.x, y, 0.9, "#ff8a3a");
  }
  // Where it landed: a patch of fire on the ice, tongues leaping, meltwater spreading under it.
  function armRoadFire(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = v.clock;
    const age = h.max - h.life;
    const k = ease(clamp(age / 260, 0, 1)) * clamp(h.life / 700, 0, 1);
    if (k <= 0.01) return;
    ctx.fillStyle = `rgba(110, 190, 235, ${0.5 * k})`;
    ellipse(ctx, h.x, y + 0.1, h.w * 0.62 * Math.min(1, age / 900 + 0.5), 0.34);
    ctx.fill();
    const n = 9;
    for (let i = 0; i < n; i++) {
      const cx = h.x + ((i + 0.5) / n - 0.5) * h.w;
      const mid = 1 - Math.abs((i + 0.5) / n - 0.5) * 1.3;
      const fh = h.h * 0.8 * k * (0.35 + 0.65 * mid) * (0.65 + 0.35 * Math.abs(Math.sin(t / (80 + (i % 4) * 20) + i * 2)));
      for (const [s, c] of [[1, FLAME[0]], [0.72, FLAME[1]], [0.45, FLAME[2]], [0.2, FLAME[3]]]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx - 0.55 * s, y);
        ctx.quadraticCurveTo(cx - 0.5 * s, y - fh * 0.55 * s, cx + Math.sin(t / 60 + i * 3) * 0.3 * s, y - fh * s);
        ctx.quadraticCurveTo(cx + 0.5 * s, y - fh * 0.55 * s, cx + 0.55 * s, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // Steam and embers lifting off it.
    for (let i = 0; i < 6; i++) {
      const q = (t / 900 + i * 0.17) % 1;
      ctx.fillStyle = `rgba(226, 244, 255, ${0.28 * (1 - q) * k})`;
      circle(ctx, h.x + (i - 2.5) * h.w * 0.16 + Math.sin(t / 400 + i) * 0.4, y - h.h * 0.7 - q * 3, 0.4 + q * 0.7);
      ctx.fill();
    }
    ctx.fillStyle = `rgba(255, 190, 80, ${0.9 * k})`;
    for (let i = 0; i < 5; i++) {
      const q = (t / 500 + i * 0.21) % 1;
      ctx.fillRect(h.x + (i - 2) * h.w * 0.18 + Math.sin(t / 150 + i) * 0.5, y - h.h * 0.5 - q * h.h * 0.9, 0.18, 0.18);
    }
    v.eyes.push(h.x, y - h.h * 0.4, 2 * k, "#ff8a3a");
  }

  // Hot Cocoa's badge: a mug on a saucer, marshmallows on the cocoa, steam rising.
  function cocoa(ctx, x, y) {
    ctx.fillStyle = "#e8e0d0";
    ellipse(ctx, x, y + 0.85, 1.05, 0.28);
    ctx.fill();
    ctx.strokeStyle = "#3a2a1c";
    ctx.lineWidth = 0.09;
    ctx.stroke();
    outlined(ctx, [[x - 0.72, y - 0.5], [x + 0.72, y - 0.5], [x + 0.58, y + 0.78], [x - 0.58, y + 0.78]], "#c0392b", "#3a1410", 0.1);
    ctx.fillStyle = "#f2e8d0";
    ctx.fillRect(x - 0.7, y - 0.12, 1.4, 0.26);
    ctx.strokeStyle = "#3a1410";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.arc(x + 0.82, y + 0.12, 0.38, -1.4, 1.4);
    ctx.stroke();
    ellipse(ctx, x, y - 0.5, 0.72, 0.2);
    ctx.fillStyle = COCOA;
    ctx.fill();
    ctx.fillStyle = "#fff6e8";
    for (const dx of [-0.34, 0.1, 0.4]) {
      circle(ctx, x + dx, y - 0.62, 0.2);
      ctx.fill();
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 0.09;
    for (const dx of [-0.3, 0.3]) {
      ctx.beginPath();
      ctx.moveTo(x + dx, y - 0.95);
      ctx.bezierCurveTo(x + dx - 0.3, y - 1.25, x + dx + 0.3, y - 1.45, x + dx, y - 1.8);
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------- over the monsters */

  // Planny in a cast of ice: a faceted shell round him, frost on it, icicles at his feet, cracking as it thaws.
  function iceCast(ctx, v, you, left) {
    const FH = v.g.FIELD_H;
    const hh = you.ducking ? 2.4 : v.g.YOU_H || 5;
    const hw = (v.g.YOU_W || 3.6) / 2 + 0.55;
    const x = you.x;
    const y = FH - you.y;
    const t = v.clock;
    const grow = ease(clamp((700 - left) / 90, 0, 1));
    const thaw = clamp(1 - left / 220, 0, 1);
    ctx.save();
    ctx.translate(x, y - hh / 2);
    ctx.scale(0.8 + 0.2 * grow, 0.8 + 0.2 * grow);
    ctx.globalAlpha = Math.min(1, grow * 1.4) * (1 - 0.45 * thaw);
    const top = hh / 2 + 0.5;
    const shell = [[-hw * 0.6, -top], [hw * 0.6, -top], [hw, -top * 0.45], [hw * 1.08, top * 0.3], [hw * 0.9, top * 0.75], [-hw * 0.9, top * 0.75], [-hw * 1.08, top * 0.3], [-hw, -top * 0.45]];
    poly(ctx, shell);
    ctx.fillStyle = "rgba(180, 228, 252, 0.5)";
    ctx.fill();
    ctx.strokeStyle = "rgba(244, 252, 255, 0.95)";
    ctx.lineWidth = 0.18;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 0.09;
    line(ctx, -hw * 0.6, -top, -hw * 0.2, top * 0.75);
    line(ctx, hw * 0.6, -top, hw * 0.3, top * 0.75);
    line(ctx, -hw, -top * 0.45, hw, -top * 0.1);
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    poly(ctx, [[-hw * 0.8, -top * 0.7], [-hw * 0.3, -top * 0.9], [-hw * 0.4, -top * 0.2]]);
    ctx.fill();
    // Icicles hanging off the base.
    ctx.fillStyle = "rgba(226, 246, 255, 0.9)";
    for (const [dx, len] of [[-1.5, 0.9], [-0.5, 1.3], [0.6, 1.0], [1.5, 0.7]]) {
      poly(ctx, [[dx - 0.28, top * 0.7], [dx, top * 0.7 + len], [dx + 0.28, top * 0.7]]);
      ctx.fill();
    }
    // The cracks that show as it gives.
    if (thaw > 0) {
      ctx.strokeStyle = `rgba(20, 60, 100, ${thaw})`;
      ctx.lineWidth = 0.12;
      line(ctx, 0, -top, -0.4, -0.2);
      line(ctx, -0.4, -0.2, 0.6, top * 0.4);
      line(ctx, -0.4, -0.2, -hw * 0.8, top * 0.1);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const k = Math.max(0, Math.sin(t / 150 + i * 2.2));
      ctx.fillStyle = `rgba(255, 255, 255, ${k})`;
      ctx.fillRect(x - 1.3 + i * 1.3, y - hh * (0.25 + i * 0.25), 0.22, 0.22);
    }
  }

  function front(ctx, v) {
    const round = v.round;
    const spec = v.spec;
    if (!round || !spec || !LOOKS[spec.id]) return;
    const FH = v.g.FIELD_H;
    const FW = v.g.FIELD_W;
    const you = round.you;
    const cam = round.camX;
    const t = v.clock;
    // A skid on the ice kicks up a spray behind his heels.
    if (you.onIce && Math.abs(you.slide || 0) > 10 && you.out <= 0) {
      const sd = Math.sign(you.slide);
      for (let i = 0; i < 5; i++) {
        const k = (t / 220 + i * 0.2) % 1;
        ctx.fillStyle = `rgba(240, 250, 255, ${0.7 * (1 - k)})`;
        ctx.fillRect(you.x - sd * (0.8 + k * 3.2), FH - you.y - 0.2 - k * 0.9 - (i % 2) * 0.3, 0.2 + (1 - k) * 0.16, 0.2);
      }
    }
    // Hot Cocoa: steam off his head, a warm glow at his feet.
    if (round.effects.cocoa > 0) {
      const hh = v.g.YOU_H || 5;
      ctx.fillStyle = "rgba(255, 170, 90, 0.16)";
      ellipse(ctx, you.x, FH - you.y, 2.8, 0.55);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const k = (t / 900 + i * 0.33) % 1;
        ctx.fillStyle = `rgba(255, 236, 214, ${0.7 * (1 - k)})`;
        circle(ctx, you.x + Math.sin(t / 380 + i * 2) * 0.5 + (i - 1) * 0.6, FH - you.y - hh - 0.3 - k * 2.4, 0.3 + k * 0.5);
        ctx.fill();
      }
    }
    if (you.heldMs > 0) iceCast(ctx, v, you, you.heldMs);
    // The blizzard: a wash of white and streaks of snow across the field, from her side toward you.
    const w = round.twist && round.twist.wind;
    if (w && w.state !== "calm") {
      const blow = w.state === "blow";
      const b = round.boss;
      const dir = blow ? w.dir || 1 : Math.sign(you.x - (b ? b.x : you.x)) || 1;
      const k = blow ? clamp(Math.min(3000 - w.ms, w.ms) / 350, 0, 1) : 0.75 * clamp((1000 - w.ms) / 500, 0.3, 1);
      ctx.fillStyle = `rgba(206, 228, 246, ${0.2 * k})`;
      ctx.fillRect(cam, 0, FW, FH);
      const n = blow ? 110 : 40;
      ctx.lineCap = "round";
      for (let i = 0; i < n; i++) {
        const hx = d.hash(i, 21) / 997;
        const hy = d.hash(i, 23) / 997;
        const speed = 80 + 70 * hy;
        const span = FW + 40;
        const x = ((((hx * span + dir * speed * (t / 1000)) % span) + span) % span) - 20;
        const len = 3 + hx * 5;
        ctx.strokeStyle = `rgba(244, 252, 255, ${0.85 * k})`;
        ctx.lineWidth = 0.14 + (i % 3) * 0.08;
        line(ctx, cam + x - dir * len, hy * FH, cam + x, hy * FH + 0.3);
      }
      ctx.lineCap = "butt";
      // The windward edge whitens, and chevrons show which way it will push.
      const edge = dir > 0 ? cam : cam + FW;
      ctx.fillStyle = `rgba(236, 248, 255, ${0.26 * k})`;
      ctx.fillRect(dir > 0 ? edge : edge - 10, 0, 10, FH);
      if (!blow) {
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 + 0.35 * Math.sin(t / 90)})`;
        ctx.lineWidth = 0.3;
        for (let i = 0; i < 3; i++) {
          const cx = cam + FW / 2 + dir * (i * 3 - 3);
          ctx.beginPath();
          ctx.moveTo(cx - dir * 0.9, 6);
          ctx.lineTo(cx, 7.2);
          ctx.lineTo(cx - dir * 0.9, 8.4);
          ctx.stroke();
        }
      }
    }
  }

  /* -------------------------------------------------------------------- lights */

  function lights(v, add) {
    const round = v.round;
    const spec = v.spec;
    world.lights(v, add);
    if (!round || !spec || !LOOKS[spec.id]) return;
    for (const m of round.monsters) {
      if (m.dead) continue;
      if (m.kind === "frozen") add(m.x, m.y + 4.5, 3.6, 0.32);
      else if (m.kind === "hand" && (m.act === "grab" || m.act === "warn")) add(m.x, m.y + 1.2, 4, 0.4);
      else if (m.kind === "shade" && (m.act === "wind" || m.act === "lunge" || m.shownMs > 0 || m.litMs > 0)) add(m.x, m.y + 3, 5, 0.55);
      else if (m.kind === "icewraith" && m.act !== "idle") add(m.x, m.y + 2.4, m.act === "dive" || m.act === "wind" ? 8 : 5, m.act === "wind" ? 0.7 : 0.45);
    }
    for (const h of round.hazards) {
      if (h.kind === "barrel") add(h.x, h.y + 2, h.state === "roll" ? 13 : 7, h.state === "roll" ? 0.95 : 0.6);
      else if (h.kind === "armRoadFire") add(h.x, h.y + 2, 14, 0.95 * clamp(h.life / 700, 0, 1));
      else if (h.kind === "armRoadFlare") add(h.x, h.y, 9, 0.9);
      else if (h.kind === "spike" && h.warn <= 0) add(h.x, h.y + 4, 7, 0.5);
      else if (h.kind === "spike" && h.warn < 260) add(h.x, h.y + 1, 5, 0.5);
      else if (h.kind === "shard" && h.warn <= 0) add(h.x, h.y + 0.8, 3.4, 0.4);
      else if (h.kind === "webGlob") add(h.x, h.y, 4, 0.5);
    }
    const b = round.boss;
    if (b && b.kind === "frostwidow" && b.state !== "sleep" && b.state !== "down") {
      add(b.x, b.y + 6, 13, 0.7);
      if (b.mouth && !b.veil) add(b.x + (b.dir || 1) * 4.2, b.y + 2.7, 6, 0.8);
    }
    if (round.you.heldMs > 0) add(round.you.x, round.you.y + 2.5, 7, 0.5);
  }

  /* -------------------------------------------------------------------- events */

  // A throttle on a repeating cue.
  function gateOnce(fx, key, ms) {
    if ((fx[key] || 0) > fx.clock) return false;
    fx[key] = fx.clock + ms;
    return true;
  }

  // What the pack's events look and sound like; true when the event is its own. Each of its sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, glow, float, ring, banner, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice && !SILENT.includes(e.type)) return false;
    if (voice) {
      // A hairline cracking in a tile or two is one tick, a spread of shots one cue.
      const quick = { iceCrack: ["crackMs", 200], shadeShow: ["shadeShowMs", 150], webLand: ["webLandMs", 90], barrelKick: ["kickMs", 120] }[e.type];
      if (quick && !gateOnce(fx, quick[0], quick[1])) return true;
      say(tone, voice[0], voice[1], voice[0] === "frostwidow" ? 0.6 : 0.5);
    }
    switch (e.type) {
      case "iceCrack":
        burst(e.x, e.y, "#dff4ff", 5, 7, 240);
        float(e.x, e.y + 2.4, "CRACK", "#dff4ff", 2.2);
        break;
      case "iceBreak":
        shake(220, 0.6);
        burst(e.x, e.y, "#dff4ff", 18, 14, 520);
        burst(e.x, e.y - 0.5, "#2a8cc0", 14, 9, 600);
        ring(e.x, e.y, "#8fd0ff", 1, 7, 450);
        if (e.under) flash("#8fd0ff", 220);
        break;
      case "iceBack":
        burst(e.x, e.y, "#ffffff", 8, 6, 360);
        ring(e.x, e.y, "#dff4ff", 1, 5, 400);
        break;
      case "handWarn":
        float(e.x, e.y + 3, "!", DANGER, 2.4);
        break;
      case "handUp":
        shake(100, 0.3);
        burst(e.x, e.y + 0.5, "#dff4ff", 10, 12, 350);
        break;
      case "shadeShow":
        ring(e.x, e.y, "#eaf8ff", 1, 4, 300);
        burst(e.x, e.y, "#eaf8ff", 5, 6, 260);
        break;
      case "shadeWind":
        float(e.x, e.y + 3.4, "!", DANGER, 2.4);
        break;
      case "shadeLunge":
        burst(e.x, e.y, "#eaf8ff", 8, 12, 280);
        break;
      case "shatter":
        shake(120, 0.4);
        burst(e.x, e.y, "#dff4ff", 24, 18, 620);
        burst(e.x, e.y, "#ffffff", 10, 12, 400);
        glow(e.x, e.y, 8, 0.6, 260);
        break;
      case "frozenMelt":
        burst(e.x, e.y, "#8fd0ff", 14, 8, 520);
        burst(e.x, e.y + 1, "#ffb050", 8, 10, 360);
        float(e.x, e.y + 3, "MELTED", "#ffb050", 2.2);
        break;
      case "iceWraithWake":
        ring(e.x, e.y, "#bfe9ff", 1, 5, 360);
        break;
      case "iceWraithWind":
        float(e.x, e.y + 3.4, "!", DANGER, 2.6);
        burst(e.x, e.y, "#dff4ff", 6, 8, 260);
        break;
      case "iceWraithDive":
        burst(e.x, e.y, "#bfe9ff", 8, 12, 300);
        break;
      case "freezeHit":
        if (e.immune) {
          float(e.x, e.y + 2.5, "WARM", COCOA, 2.2);
          ring(e.x, e.y, COCOA, 1, 6, 400);
        } else {
          flash("#cfeeff", 240);
          burst(e.x, e.y, "#dff4ff", 18, 12, 600);
          ring(e.x, e.y, "#ffffff", 1, 6, 400);
          float(e.x, e.y + 4, "FROZEN!", "#bfe9ff", 2.4);
        }
        break;
      case "widowDrop":
        float(e.x, e.y + 8, "!", DANGER, 3);
        ring(e.x, e.y, DANGER, 2, 8, 600);
        break;
      case "widowRise":
        burst(e.x, e.y + 3, "#dff4ff", 8, 8, 320);
        break;
      case "widowRage":
        flash("#ff3a5a", 320);
        shake(380, 0.9);
        ring(e.x, e.y, "#ff3a5a", 2, 16, 700);
        banner("The Frost Widow rages", "Faster, two spikes at once, wraiths from the dark", "#ff5a7a", 1800);
        break;
      case "veilMelt":
        shake(200, 0.5);
        flash("#ffb050", 140);
        burst(e.x, e.y, "#ff8a1a", 14, 14, 520);
        burst(e.x, e.y, "#8fd0ff", 16, 12, 600);
        glow(e.x, e.y, 16, 0.9, 500);
        float(e.x, e.y + 8, "VEIL MELTED", GOLD, 2.4);
        break;
      case "veilDown":
        banner("Her veil is down", "Shoot her open mouth for triple", GOLD, 1500);
        break;
      case "veilUp":
        burst(e.x, e.y, "#dff4ff", 14, 10, 480);
        float(e.x, e.y + 8, "The veil is back", "#bfe9ff", 2);
        break;
      case "barrelPlace":
        burst(e.x, e.y + 1.7, "#ff8a1a", 6, 6, 260);
        ring(e.x, e.y + 1.7, "#ff8a1a", 1, 4, 300);
        break;
      case "barrelKnock":
        shake(60, 0.15);
        burst(e.x, e.y + 1.7, "#ffb050", 3 + e.n, 8, 220);
        break;
      case "barrelKick":
        shake(80, 0.25);
        burst(e.x, e.y + 1.7, "#ffb050", 8, 12, 300);
        break;
      case "barrelBurst":
        shake(160, 0.5);
        burst(e.x, e.y + 1, "#ff8a1a", 20, 16, 520);
        burst(e.x, e.y + 1, "#ffd23a", 8, 12, 380);
        glow(e.x, e.y + 1, 14, 0.9, 400);
        break;
      case "blizzard":
        banner("Blizzard", "Get low, or hide behind a barrel", "#bfe9ff", 1400);
        break;
      case "blizzardBlow":
        shake(260, 0.25);
        break;
      case "blizzardEnd":
        break;
      case "spikeWarn":
        break;
      case "spikeUp":
        shake(140, 0.5);
        burst(e.x, e.y + 0.5, "#dff4ff", 12, 14, 360);
        break;
      case "webWind":
        float(e.x, e.y + 3, "!", DANGER, 2.4);
        break;
      case "webShot":
        burst(e.x, e.y, "#eaf8ff", 6, 8, 260);
        break;
      case "webLand":
        burst(e.x, e.y + 0.5, "#eaf8ff", e.shot ? 10 : 7, 8, 360);
        break;
      case "wraithCall":
        ring(e.x, e.y, "#bfe9ff", 1, 6, 500);
        burst(e.x, e.y, "#dff4ff", 8, 8, 400);
        break;
      case "flareThrow":
        burst(e.x, e.y, "#ffd23a", 5, 8, 220);
        break;
      case "flareLand":
        burst(e.x, e.y + 0.5, "#ffb050", 12, 12, 420);
        glow(e.x, e.y + 2, 14, 0.9, 500);
        ring(e.x, e.y + 0.5, "#ff8a1a", 1, 6, 400);
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
    monsters: freeze({ hand, shade, frozen, icewraith }),
    bosses: freeze({ frostwidow: widow }),
    hazards: freeze({ shard, spike, webGlob, webPatch, barrel, armRoadFlare, armRoadFire }),
    powers: freeze({ cocoa }),
    lights,
    react,
  });
}
