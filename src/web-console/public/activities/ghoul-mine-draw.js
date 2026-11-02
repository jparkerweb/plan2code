// Plan2Code Web Console - Ghoul Rush's Deep Seam Mine stage, its drawing: the rooms' looks (rough rock held up with timber props, rails along the floor, oil lamps on hooks), the knocker imp, canary ghost, dead miner, blind crawler and cage lift, the Tommyknocker, the rocks (dust, fall, rubble), the dynamite stick and its blast, the pickaxe and hammer swings, the water along the floor, the lights going out, the Hard Hat's and Dynamite's badges, and what its events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS and
// LOSE_SOUNDS are plain data (the voices borrow the house's, the Chapel's, the
// Sanatorium's and the Village's tones until the stage's own sounds are
// picked); mineArt(d) takes ghoul-draw.js's own drawing helpers (`d`) and hands
// back the drawing by kind, so this file never reaches back into it. Drawn in
// room units, the way ghoul-draw.js draws: y counted down from the field's top,
// a monster from (x, y) at its feet. What the art reads off the rules
// (ghoul-mine.js):
//
// - `round.twist` ({ next, quiet, noise, reach, wade }, null outside the
//   Mine); `round.blackout` (the Tommyknocker's lights out: the room is drawn
//   near black but for what is lit); Dynamite's stick and blast are thrown by ghoul-arms.js;
//   `you.hat` (the Hard Hat on Planny's head, worn till used).
// - Planny: `you.dimMs` (ms of light an imp stole; ghoul-draw.js shrinks the
//   glow and drops the cone, nothing is read here), `you.wet` (on the floor in
//   water), and the room's `spec.water` ([x0, x1] spans, drawn by `front`).
// - an imp: `m.dir`, `m.act` ("skitter", "flee"), `m.stole` (holds a spark),
//   `m.decoy` (carries the Tommyknocker's lantern, "pace").
// - a canary: `m.act` ("flit", "scream" for 450 ms, "flee"), `m.dir`.
// - a dead miner: `m.act` ("buried" in the wall, "dig" with `m.wait` ms of
//   the 650 left, "walk", "wind" with `m.wait` ms of the 400 left, "rest"),
//   `m.dir`.
// - a blind crawler: `m.act` ("lost" or "hunt"), `m.dir`.
// - a cage: `m.y` (its bottom), `m.lo`, `m.hi` (its track's ends, bottoms),
//   `m.rest` (ms it waits at an end), `m.v` (7 up or -7 down).
// - the Tommyknocker: `b.act` ("idle", "knock" with `b.knockIn` ms to its
//   next beat and `b.beat` 0 to 3, "sweepWind" with `b.wait` of 500, "rest",
//   "dark" for its 600 ms of sinking, "hidden", "dazed"), `b.hidden` (under the
//   floor: draw nothing), `b.darkOn`, `b.burstX` (where the dust of the real
//   knocking trickles, while hidden), `b.decoyX`, `b.dazed` (ms of daze left),
//   `b.raged`, `b.dir`, `b.hurt`.
// - hazards: `rock` ({ x, y (its bottom), w, h, floor, state: "warn" | "fall" |
//   "rubble", warn, total, rub }), `stick` ({ x, y, spin, fuse, max, rest }),
//   `blast` ({ x, y, w, h, boom, max }), `pick` ({ x, y, w, h, dir, live, max })
//   and `hammer` ({ x, y, w, h, dir, live, max }: the Tommyknocker's low sweep).

import { tommyKit } from "./ghoul-mine-tommy.js";
import { mineWorld } from "./ghoul-mine-world.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

// Underground: the "wall" is the rock (`wallTop` to `wallLow`, `paper` the
// strata, `wainscot` the timber), `window` the lamplight; `pack` names this
// file's drawing for ghoul-draw.js (a `custom` look: it hands the walls, the
// rails and the boards to mineArt()), `mine` marks the stage's picture.
const pit = (o) => freeze({ pack: "mine", custom: true, noMoon: true, mine: true, pit: "#010101", ...o });
export const LOOKS = freeze({
  shaft: pit({ wallTop: "#0e0b09", wallLow: "#2a2018", paper: "#3a2c20", wainscot: "#4a3420", floorTop: "#6a5a46", floor: "#2e251c", floorEdge: "#0c0907", shelf: "#4a3220", shelfTop: "#8a6a44", window: "#e0a050", decor: "timber", color: "#d0a060", dark: 0.9 }),
  tunnels: pit({ wallTop: "#080d10", wallLow: "#1a282c", paper: "#27393c", wainscot: "#3a3224", floorTop: "#58645c", floor: "#22302e", floorEdge: "#080c0c", shelf: "#3a3022", shelfTop: "#7a6c4c", window: "#9fd0d0", decor: "timber", color: "#7fb4b8", dark: 0.9 }),
  collapse: pit({ wallTop: "#0d0c0b", wallLow: "#2c2926", paper: "#3c3834", wainscot: "#44382a", floorTop: "#6a6258", floor: "#2a2724", floorEdge: "#0a0908", shelf: "#40342a", shelfTop: "#7a6a54", window: "#d8b078", decor: "timber", color: "#b0a090", dark: 0.91 }),
  seam: pit({ wallTop: "#0b0705", wallLow: "#2a1a0c", paper: "#3a2410", wainscot: "#4a3018", floorTop: "#6a4a28", floor: "#2c1e10", floorEdge: "#0c0806", shelf: "#4a2e18", shelfTop: "#8a5e30", window: "#f0b040", decor: "timber", color: "#e0a040", dark: 0.92 }),
});

// How each new kind sounds, by act (the sounds in ghoul-sfx-mine.js).
// `rock` is the ceiling, `water` the wading, `dyn` and `hat` the power-ups.
export const VOICES = freeze({
  imp: freeze({ appear: "ghoulImpAppear", steal: "ghoulImpSteal", drop: "ghoulImpDrop", hurt: "ghoulImpHurt", die: "ghoulImpDie" }),
  canary: freeze({ appear: "ghoulCanaryAppear", scream: "ghoulCanaryScream", hurt: "ghoulCanaryHurt", die: "ghoulCanaryDie" }),
  miner: freeze({ appear: "ghoulMinerAppear", dig: "ghoulMinerDig", wind: "ghoulMinerWind", swing: "ghoulMinerSwing", hurt: "ghoulMinerHurt", die: "ghoulMinerDie" }),
  blind: freeze({ appear: "ghoulBlindAppear", lost: "ghoulBlindLost", hear: "ghoulBlindHear", hurt: "ghoulBlindHurt", die: "ghoulBlindDie" }),
  cage: freeze({ appear: "ghoulCageAppear", die: "ghoulCageDie" }),
  tommy: freeze({ wake: "ghoulTommyWake", knock: "ghoulTommyKnock", sweepWind: "ghoulTommySweepWind", sweep: "ghoulTommySweep", dark: "ghoulTommyDark", sink: "ghoulTommySink", knockDark: "ghoulTommyKnockDark", burst: "ghoulTommyBurst", rage: "ghoulTommyRage", hurt: "ghoulTommyHurt", weak: "ghoulTommyWeak", die: "ghoulTommyDie" }),
  rock: freeze({ warn: "ghoulRockWarn", fall: "ghoulRockFall", land: "ghoulRockLand", bounce: "ghoulRockBounce" }),
  water: freeze({ wade: "ghoulWaterWade" }),
  hat: freeze({ active: "ghoulHatActive" }),
  dyn: freeze({ active: "ghoulDynActive", throw: "ghoulDynThrow", blast: "ghoulDynBlast" }),
});

// What each of the pack's events plays: [kind, act], once. A hit, a kill, a
// spawn and a boss's wake, hit and fall are the game's own (they carry their kind).
export const EVENT_VOICE = freeze({
  rockWarn: ["rock", "warn"],
  rockFall: ["rock", "fall"],
  rockLand: ["rock", "land"],
  rockBounce: ["rock", "bounce"],
  hatKnock: ["rock", "bounce"],
  wade: ["water", "wade"],
  impSteal: ["imp", "steal"],
  impDrop: ["imp", "drop"],
  canaryScream: ["canary", "scream"],
  minerDig: ["miner", "dig"],
  pickWind: ["miner", "wind"],
  pickSwing: ["miner", "swing"],
  blindLost: ["blind", "lost"],
  blindHear: ["blind", "hear"],
  dynThrow: ["dyn", "throw"],
  dynBlast: ["dyn", "blast"],
  tommyKnock: ["tommy", "knock"],
  sweepWind: ["tommy", "sweepWind"],
  tommySweep: ["tommy", "sweep"],
  tommyDark: ["tommy", "dark"],
  tommySink: ["tommy", "sink"],
  tommyKnockDark: ["tommy", "knockDark"],
  tommyBurst: ["tommy", "burst"],
  tommyRage: ["tommy", "rage"],
});
// The words on a life lost to each new cause, and the sound beside the crash.
export const LOSE_WORDS = freeze({ rock: "Buried", miner: "Worked over", pickaxe: "Pickaxed", blind: "Felt out", tommy: "Knocked out", hammer: "Hammered" });
export const LOSE_SOUNDS = freeze({
  rock: ["smash", 0.6, 0.6],
  miner: ["crunch", 0.5, 0.9],
  pickaxe: ["clank", 0.5, 0.8],
  blind: ["squish", 0.5, 0.9],
  tommy: ["smash", 0.6, 0.5],
  hammer: ["smash", 0.65, 0.45],
});

const IRON = "#3a3a42";
const LAMP = "#ffb84a";
const DUST = "#8a7a68";

export function mineArt(d) {
  const world = mineWorld(d);
  const { ellipse, circle, line, say, hash, FLASH, EYE_AMBER, EYE_PALE, EYE_RED, DANGER, GOLD } = d;
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

  /* ------------------------------------------------------------- the room */

  // The rock wall, its timber and its lamps: ghoul-mine-world.js draws them.
  const { backdrop, ground, shelf, front } = world;



  // The blackout: the dark layer at nearly full.
  function dim(v) {
    const r = v.round;
    if (!r || !v.spec || !LOOKS[v.spec.id]) return 0;
    return r.blackout ? 0.965 : 0;
  }


  /* ------------------------------------------------------------ monsters */

  // Runs fn(glow) in a frame at (x, y) facing `dir`, y counted up from the
  // feet; glow(lx, ly, r, color) hands a light to the dark's pass (room coordinates).
  function upright(ctx, v, x, y, dir, fn) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, -1);
    fn((lx, ly, r, color) => v.eyes.push(x + dir * lx, y - ly, r, color));
    ctx.restore();
  }
  // A limb with a dark outline under it, through the points `pts`.
  function bone(ctx, pts, w, color, out) {
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [lw, c] of [[w + 0.14, out], [w, color]]) {
      ctx.strokeStyle = c;
      ctx.lineWidth = lw;
      ctx.beginPath();
      pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";
  }
  const outlined = (ctx, pts, fill, out, lw = 0.1) => {
    poly(ctx, pts);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = lw;
    ctx.stroke();
  };
  // A little pickaxe held at (hx, hy), its handle at angle a (math angle, y up), `len` long.
  function pickTool(ctx, hx, hy, a, len, scale, flash) {
    const ex = hx + Math.cos(a) * len;
    const ey = hy + Math.sin(a) * len;
    bone(ctx, [[hx - Math.cos(a) * len * 0.2, hy - Math.sin(a) * len * 0.2], [ex, ey]], 0.12 * scale, flash ? FLASH : "#7a5630", flash ? FLASH : "#17120c");
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    const w = 0.55 * scale;
    ctx.fillStyle = flash ? FLASH : "#9a9aa8";
    poly(ctx, [[ex + nx * w, ey + ny * w], [ex + Math.cos(a) * 0.12 * scale, ey + Math.sin(a) * 0.12 * scale + ny * 0.0], [ex - nx * w, ey - ny * w], [ex - nx * w * 0.5 - Math.cos(a) * 0.1 * scale, ey - ny * w * 0.5 - Math.sin(a) * 0.1 * scale], [ex + nx * w * 0.5 - Math.cos(a) * 0.1 * scale, ey + ny * w * 0.5 - Math.sin(a) * 0.1 * scale]]);
    ctx.fill();
  }

  // A knocker imp: a wiry, hunched mine goblin, green-grey, with great ears swept
  // back, a hooked nose, a grin and big amber eyes, a tiny pick in his fist. Running
  // (skitter, flee) his legs blur and he leans into it; with the stolen spark he
  // cups it in both hands, giggling; the decoy paces with the Tommyknocker's lantern
  // held up on a hooked stick.
  function imp(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const act = m.act || "skitter";
    const fleeing = act === "flee";
    const run = act === "skitter" || fleeing;
    const hop = run ? Math.abs(Math.sin(t / 58)) * 0.3 : Math.abs(Math.sin(t / 170)) * 0.07;
    const skin = flash ? FLASH : "#7c9058";
    const skinD = flash ? FLASH : "#506238";
    const cloth = flash ? FLASH : "#7a4e2e";
    const clothD = flash ? FLASH : "#4a2e1c";
    const out = flash ? FLASH : "#14100a";
    upright(ctx, v, x, y, dir, (glow) => {
      const lean = run ? (fleeing ? 0.42 : 0.3) : 0.08;
      const hipY = 0.92 + hop;
      // Speed streaks and kicked dust behind a runner.
      if (run && !flash) {
        ctx.strokeStyle = "rgba(220, 200, 160, 0.4)";
        ctx.lineWidth = 0.1;
        for (let k = 0; k < 3; k++) line(ctx, -1.0 - k * 0.5, 0.5 + k * 0.5, -2.4 - k * 0.8, 0.5 + k * 0.5);
        ctx.fillStyle = "rgba(150, 130, 100, 0.45)";
        for (let k = 0; k < 3; k++) {
          const f = ((t / 220 + k / 3) % 1);
          circle(ctx, -0.9 - f * 1.6, 0.15 + f * 0.5, 0.18 + f * 0.15);
          ctx.fill();
        }
      }
      // The legs: ghosted copies make the blur of a runner.
      const ph = t / (fleeing ? 36 : run ? 44 : 190);
      for (let k = run ? 2 : 0; k >= 0; k--) {
        ctx.globalAlpha = k ? 0.3 : 1;
        for (let i = 0; i < 2; i++) {
          const a = ph + i * Math.PI + k * 0.55;
          const fx = 0.1 + Math.sin(a) * (run ? 0.8 : 0.4);
          const fy = Math.max(0, Math.cos(a)) * (run ? 0.4 : 0.15);
          bone(ctx, [[-0.05 + i * 0.1, hipY - 0.1], [(fx - 0.05) / 2 + 0.28, hipY * 0.5 + fy * 0.5 + 0.1], [fx, fy + 0.12]], 0.3, i ? skin : skinD, out);
          ctx.fillStyle = i ? skin : skinD;
          poly(ctx, [[fx - 0.2, fy + 0.2], [fx + 0.7, fy + 0.15], [fx + 0.75, fy], [fx - 0.2, fy]]);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.save();
      ctx.translate(0, hipY);
      ctx.rotate(-lean);
      const tp = (px, py) => [px * Math.cos(lean) + py * Math.sin(lean), -px * Math.sin(lean) + py * Math.cos(lean) + hipY];
      const gl = (px, py, r, c) => {
        const [gx, gy] = tp(px, py);
        glow(gx, gy, r, c);
      };
      // A ragged tunic over a bent back.
      outlined(ctx, [[-0.55, 0.1], [-0.7, 0.9], [-0.2, 1.3], [0.45, 1.15], [0.6, 0.15], [0.35, -0.05], [0.1, 0.15], [-0.15, -0.1]], cloth, out);
      ctx.fillStyle = clothD;
      ctx.fillRect(-0.62, 0.55, 1.2, 0.14);
      ctx.fillStyle = skinD;
      ellipse(ctx, -0.4, 0.95, 0.35, 0.3);
      ctx.fill();
      // The far arm, swinging back.
      const swing = run ? Math.sin(ph + 1.6) * 0.5 : 0.1;
      if (!fleeing && !m.decoy) bone(ctx, [[0.0, 1.0], [-0.35 - swing * 0.4, 0.55], [-0.5 - swing, 0.2]], 0.24, skinD, out);
      // The head: big, bald, a hooked nose and a grin.
      const hx = 0.5;
      const hy = 1.52;
      const flap = run ? Math.sin(t / 70) * 0.18 : Math.sin(t / 400) * 0.05;
      outlined(ctx, [[hx - 0.2, hy + 0.35], [hx - 1.5, hy + 0.95 + flap], [hx - 1.15, hy + 0.35], [hx - 0.1, hy - 0.2]], skinD, out);
      outlined(ctx, [[hx + 0.05, hy + 0.5], [hx - 1.0, hy + 1.35 + flap], [hx - 1.85, hy + 0.95 + flap * 1.4], [hx - 0.95, hy + 0.55], [hx - 0.2, hy + 0.1]], skin, out);
      ctx.fillStyle = flash ? FLASH : "#c88a7a";
      poly(ctx, [[hx - 0.2, hy + 0.5], [hx - 0.95, hy + 1.1 + flap], [hx - 1.45, hy + 0.9 + flap], [hx - 0.8, hy + 0.55]]);
      ctx.fill();
      ctx.fillStyle = skin;
      circle(ctx, hx, hy, 0.66);
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.1;
      ctx.stroke();
      outlined(ctx, [[hx + 0.55, hy + 0.1], [hx + 1.3, hy - 0.35], [hx + 0.95, hy - 0.08], [hx + 0.6, hy - 0.2]], skin, out, 0.08);
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.09;
      const grin = fleeing ? 0.25 : 0.1;
      ctx.beginPath();
      ctx.moveTo(hx + 0.2, hy - 0.4);
      ctx.quadraticCurveTo(hx + 0.55, hy - 0.62 - grin, hx + 0.9, hy - 0.32);
      ctx.stroke();
      ctx.fillStyle = flash ? FLASH : "#f2ecd8";
      for (const tx of [0.34, 0.52, 0.7]) ctx.fillRect(hx + tx - 0.04, hy - 0.52 - grin * 0.4, 0.09, 0.16);
      // Eyes burning over the dark.
      ctx.fillStyle = flash ? FLASH : "#ffc040";
      ellipse(ctx, hx + 0.38, hy + 0.12, 0.2, 0.16);
      ctx.fill();
      ellipse(ctx, hx + 0.02, hy + 0.1, 0.17, 0.14);
      ctx.fill();
      ctx.fillStyle = out;
      ctx.fillRect(hx + 0.4, hy + 0.04, 0.08, 0.2);
      ctx.fillRect(hx + 0.04, hy + 0.03, 0.07, 0.18);
      gl(hx + 0.38, hy + 0.12, 0.2, EYE_AMBER);
      gl(hx + 0.02, hy + 0.1, 0.16, EYE_AMBER);
      // The near arm: the pick, the cupped spark or the lantern on its stick.
      const sh = [0.3, 1.0];
      if (fleeing || m.stole) {
        const cup = [1.0, 0.85];
        bone(ctx, [sh, [0.7, 0.6], cup], 0.25, skin, out);
        bone(ctx, [[0.05, 0.95], [0.55, 0.55], [cup[0] - 0.1, cup[1] - 0.1]], 0.22, skinD, out);
        if (m.stole) {
          const pulse = 0.85 + 0.15 * Math.sin(t / 70);
          ctx.fillStyle = "rgba(255, 230, 120, 0.3)";
          circle(ctx, cup[0], cup[1] + 0.2, 0.62 * pulse);
          ctx.fill();
          ctx.fillStyle = "#fff6b0";
          circle(ctx, cup[0], cup[1] + 0.2, 0.26);
          ctx.fill();
          ctx.strokeStyle = "rgba(255, 244, 170, 0.8)";
          ctx.lineWidth = 0.07;
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU + t / 300;
            line(ctx, cup[0] + Math.cos(a) * 0.38, cup[1] + 0.2 + Math.sin(a) * 0.38, cup[0] + Math.cos(a) * 0.62, cup[1] + 0.2 + Math.sin(a) * 0.62);
          }
          gl(cup[0], cup[1] + 0.2, 0.34, "#fff0a0");
        }
        ctx.fillStyle = skin;
        circle(ctx, cup[0] + 0.05, cup[1] - 0.12, 0.2);
        ctx.fill();
      } else if (m.decoy) {
        const hand = [0.9, 1.75];
        bone(ctx, [sh, [0.75, 1.3], hand], 0.25, skin, out);
        ctx.strokeStyle = out;
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(hand[0], 0.5);
        ctx.lineTo(hand[0], hand[1] + 1.35);
        ctx.quadraticCurveTo(hand[0], hand[1] + 1.8, hand[0] + 0.5, hand[1] + 1.65);
        ctx.stroke();
        const lx = hand[0] + 0.5;
        const ly = hand[1] + 0.95;
        ctx.fillStyle = flash ? FLASH : "#5a4a30";
        ctx.fillRect(lx - 0.38, ly + 0.62, 0.76, 0.14);
        ctx.fillRect(lx - 0.38, ly - 0.42, 0.76, 0.14);
        ctx.fillStyle = LAMP;
        ctx.fillRect(lx - 0.3, ly - 0.28, 0.6, 0.9);
        ctx.fillStyle = "#fff4c0";
        ctx.fillRect(lx - 0.13, ly - 0.1, 0.26, 0.5);
        ctx.strokeStyle = out;
        ctx.lineWidth = 0.06;
        ctx.strokeRect(lx - 0.3, ly - 0.28, 0.6, 0.9);
        gl(lx, ly + 0.15, 0.6, LAMP);
      } else {
        const a = run ? 0.5 + Math.sin(ph) * 0.6 : 0.9;
        const hand = [0.95, 0.75 + (run ? Math.sin(ph) * 0.25 : 0)];
        bone(ctx, [sh, [0.7, 0.62], hand], 0.25, skin, out);
        pickTool(ctx, hand[0], hand[1], a, 1.15, 1, flash);
        ctx.fillStyle = skin;
        circle(ctx, hand[0], hand[1], 0.2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  // A canary ghost: the pale, see-through ghost of a mine canary, glowing yellow-white,
  // its tail trailing off in wisps, its wings beating. Screaming it swells and throws its
  // head back, beak wide, and shock rings roll out; fleeing it streams.
  function canary(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const act = m.act || "flit";
    const scream = act === "scream";
    const flee = act === "flee";
    const beat = Math.sin(t / (flee ? 42 : scream ? 100 : 72));
    const bob = Math.sin(t / 260) * 0.1;
    const body = flash ? FLASH : "#fff5a8";
    const core = flash ? FLASH : "#fffde8";
    const out = flash ? FLASH : "#c8b44a";
    upright(ctx, v, x, y, dir, (glow) => {
      ctx.translate(0, 0.9 + bob);
      const puff = scream ? 1.2 : 1;
      // The halo.
      ctx.fillStyle = "rgba(255, 244, 150, 0.14)";
      ellipse(ctx, 0.1, 0.1, 1.9 * puff, 1.3 * puff);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 244, 150, 0.12)";
      ellipse(ctx, 0.1, 0.1, 1.35 * puff, 0.95 * puff);
      ctx.fill();
      // Wisps trailing from the tail and the wings' tips, fading with distance.
      const wl = flee ? 12 : 8;
      for (let i = 0; i < 3; i++) {
        for (let k = 1; k <= wl; k++) {
          const wx = -0.95 - k * 0.38;
          const wy = -0.05 - i * 0.2 + Math.sin(t / 190 - k * 0.65 + i * 1.7) * 0.09 * k;
          ctx.globalAlpha = (1 - k / (wl + 1)) * 0.55;
          ctx.fillStyle = body;
          circle(ctx, wx, wy, 0.2 - k * 0.012 + (i === 1 ? 0.05 : 0));
          ctx.fill();
        }
      }
      ctx.globalAlpha = 0.82;
      // The far wing, then the body, then the near wing.
      const wing = (alpha, up) => {
        const ang = 0.55 + beat * 0.95 * up;
        const sx = 0.05;
        const sy = 0.3;
        const pts = [[sx, sy]];
        for (let i = 0; i < 5; i++) {
          const a = ang + 1.57 + (i - 2) * 0.27;
          const l = 2.0 - Math.abs(i - 1.6) * 0.22;
          const tip = [sx + Math.cos(a) * l * 0.55 - 0.15, sy + Math.sin(a) * l];
          pts.push(tip);
          const mid = [sx + Math.cos(a + 0.14) * l * 0.62, sy + Math.sin(a + 0.14) * l * 0.82];
          pts.push(mid);
        }
        ctx.globalAlpha = alpha;
        outlined(ctx, pts, body, out, 0.06);
        ctx.fillStyle = core;
        ctx.globalAlpha = alpha * 0.6;
        poly(ctx, [[sx, sy], pts[3], pts[5], pts[7]]);
        ctx.fill();
      };
      wing(0.5, 0.7);
      ctx.globalAlpha = 0.82;
      outlined(ctx, [[-1.0, 0.0], [-0.6, 0.55 * puff], [0.4, 0.75 * puff], [1.0, 0.35 * puff], [0.9, -0.3], [0.2, -0.65 * puff], [-0.6, -0.4]], body, out, 0.06);
      ctx.fillStyle = core;
      ctx.globalAlpha = 0.8;
      ellipse(ctx, 0.15, 0.0, 0.62 * puff, 0.38 * puff);
      ctx.fill();
      ctx.globalAlpha = 0.82;
      wing(0.85, 1);
      // The head and beak.
      const up = scream ? 0.35 : 0;
      const hx = 0.95 - up * 0.3;
      const hy = 0.5 + up;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = body;
      circle(ctx, hx, hy, 0.52);
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.06;
      ctx.stroke();
      poly(ctx, [[hx - 0.3, hy + 0.35], [hx - 0.15, hy + 0.85], [hx + 0.05, hy + 0.45]]);
      ctx.fillStyle = body;
      ctx.fill();
      const gape = scream ? 0.62 : 0.06;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = flash ? FLASH : "#f0a030";
      poly(ctx, [[hx + 0.35, hy + 0.08], [hx + 1.25, hy + 0.02 + gape * 0.55], [hx + 0.4, hy - 0.04]]);
      ctx.fill();
      poly(ctx, [[hx + 0.35, hy - 0.06], [hx + 1.15, hy - 0.1 - gape], [hx + 0.4, hy - 0.2]]);
      ctx.fill();
      if (scream) {
        ctx.fillStyle = "#6a2a1a";
        poly(ctx, [[hx + 0.4, hy - 0.04], [hx + 1.1, hy + 0.0 + gape * 0.4], [hx + 1.05, hy - 0.08 - gape * 0.8], [hx + 0.4, hy - 0.18]]);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#4a4010";
      circle(ctx, hx + 0.12, hy + 0.14, 0.17);
      ctx.fill();
      ctx.fillStyle = "#fffbe0";
      circle(ctx, hx + 0.15, hy + 0.16, 0.09);
      ctx.fill();
      glow(hx + 0.15, hy + 0.16 + 0.9 + bob, scream ? 0.2 : 0.13, EYE_PALE);
      // The scream: shock rings rolling out of the beak.
      if (scream && !flash) {
        for (let k = 0; k < 3; k++) {
          const f = (t / 280 + k / 3) % 1;
          ctx.globalAlpha = (1 - f) * 0.8;
          ctx.strokeStyle = "#fff3a0";
          ctx.lineWidth = 0.14 + (1 - f) * 0.1;
          ctx.beginPath();
          ctx.arc(hx + 1.1, hy - gape * 0.4, 0.6 + f * 3.0, -0.9, 0.9);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    });
  }

  // The dead miner's whole figure at (x, y): stooped, sunken, in rotted overalls and a dented
  // hard hat with its lamp still lit and a pickaxe; `o` = { sw: leg swing, ang: the pick's
  // angle (math, y up), lean, rest, rise (1 whole) }.
  function minerBody(ctx, v, m, x, y, t, flash, o) {
    const dir = m.dir || 1;
    const skin = flash ? FLASH : "#8d9a7c";
    const skinD = flash ? FLASH : "#5c6850";
    const bib = flash ? FLASH : "#3e4c5e";
    const shirt = flash ? FLASH : "#6a3a30";
    const out = flash ? FLASH : "#10100c";
    upright(ctx, v, x, y, dir, (glow) => {
      const sw = o.sw;
      const lean = o.lean;
      // Legs and boots.
      for (let i = 0; i < 2; i++) {
        const s = i ? sw : -sw;
        const hip = [-0.3 + i * 0.6, 1.8];
        const knee = [hip[0] + s * 0.35 + 0.1, 0.95];
        const foot = [hip[0] + s * 0.8, 0.1 + Math.max(0, s) * 0.12];
        bone(ctx, [hip, knee, foot], 0.62, i ? bib : flash ? FLASH : "#2e3a48", out);
        outlined(ctx, [[foot[0] - 0.4, foot[1] + 0.2], [foot[0] + 0.85, foot[1] + 0.2], [foot[0] + 0.85, foot[1] - 0.1], [foot[0] - 0.4, foot[1] - 0.1]], flash ? FLASH : "#1c1612", out, 0.08);
      }
      ctx.save();
      ctx.translate(0, 1.8);
      ctx.rotate(-lean);
      const tp = (px, py) => [px * Math.cos(lean) + py * Math.sin(lean), -px * Math.sin(lean) + py * Math.cos(lean) + 1.8];
      const gl = (px, py, r, c) => {
        const [gx, gy] = tp(px, py);
        glow(gx, gy, r, c);
      };
      // The far arm, hanging.
      bone(ctx, [[-0.2, 1.5], [-0.6, 0.7], [-0.45 - sw * 0.3, 0.0]], 0.42, skinD, out);
      // The torso: a rotted shirt, the overalls' bib with a tear showing ribs, a strap.
      outlined(ctx, [[-0.9, 0.0], [-0.95, 1.1], [-0.55, 1.95], [0.35, 2.1], [0.85, 1.4], [0.8, 0.0]], shirt, out);
      ctx.fillStyle = bib;
      poly(ctx, [[-0.8, 0.0], [-0.8, 1.2], [0.6, 1.2], [0.75, 0.0]]);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#cfd2bc";
      for (const ry of [1.5, 1.72, 1.94]) ctx.fillRect(-0.45, ry, 0.9, 0.09);
      ctx.fillStyle = flash ? FLASH : "#1c242e";
      poly(ctx, [[-0.5, 1.4], [0.4, 1.38], [0.45, 2.0], [-0.4, 2.02]]);
      ctx.globalAlpha = 0.35;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = flash ? FLASH : "#c8a040";
      circle(ctx, 0.5, 1.15, 0.12);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#2a1c14";
      ctx.fillRect(-0.85, 0.55, 1.65, 0.2);
      // The head: sunken, jaw slack, bare teeth, under a battered hard hat.
      const hx = 0.35;
      const hy = 2.75;
      const droop = o.rest ? 0.2 : 0;
      outlined(ctx, [[hx - 0.5, hy - 0.65 - droop], [hx + 0.5, hy - 0.7 - droop], [hx + 0.62, hy + 0.1], [hx - 0.55, hy + 0.2]], skin, out, 0.09);
      ctx.fillStyle = flash ? FLASH : "#1a1e16";
      ellipse(ctx, hx + 0.32, hy - 0.12, 0.2, 0.22);
      ctx.fill();
      ellipse(ctx, hx - 0.1, hy - 0.1, 0.18, 0.2);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#e0dcc4";
      for (let k = 0; k < 4; k++) ctx.fillRect(hx - 0.3 + k * 0.2, hy - 0.62 - droop, 0.12, 0.2);
      ctx.fillStyle = skinD;
      poly(ctx, [[hx + 0.62, hy + 0.1], [hx + 0.9, hy - 0.1], [hx + 0.62, hy - 0.2]]);
      ctx.fill();
      if (!flash) {
        ctx.fillStyle = "#4a5a3a";
        circle(ctx, hx - 0.38, hy - 0.25, 0.15);
        ctx.fill();
      }
      // The hard hat: a dented dome, the brim, a brass lamp housing, the lamp lit.
      outlined(ctx, [[hx - 0.85, hy + 0.2], [hx - 0.8, hy + 0.75], [hx - 0.3, hy + 1.2], [hx + 0.4, hy + 1.2], [hx + 0.85, hy + 0.75], [hx + 1.0, hy + 0.2]], flash ? FLASH : "#d8b030", out, 0.1);
      ctx.fillStyle = flash ? FLASH : "#f2d870";
      poly(ctx, [[hx - 0.55, hy + 0.65], [hx - 0.2, hy + 1.05], [hx + 0.25, hy + 1.1], [hx - 0.2, hy + 0.7]]);
      ctx.fill();
      ctx.fillStyle = flash ? FLASH : "#a88a1c";
      ctx.fillRect(hx - 0.9, hy + 0.1, 2.0, 0.17);
      outlined(ctx, [[hx + 0.75, hy + 0.35], [hx + 1.25, hy + 0.32], [hx + 1.25, hy + 0.88], [hx + 0.75, hy + 0.9]], flash ? FLASH : "#8a6a24", out, 0.07);
      // The beam first (a pale wedge), then the lens.
      if (!flash) {
        ctx.fillStyle = "rgba(255, 236, 160, 0.17)";
        poly(ctx, [[hx + 1.25, hy + 0.6], [hx + 5.6, hy - 0.5], [hx + 5.6, hy + 1.9]]);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 244, 190, 0.2)";
        poly(ctx, [[hx + 1.25, hy + 0.6], [hx + 3.6, hy + 0.0], [hx + 3.6, hy + 1.3]]);
        ctx.fill();
      }
      ctx.fillStyle = flash ? FLASH : "#fff6c0";
      ellipse(ctx, hx + 1.25, hy + 0.6, 0.14, 0.26);
      ctx.fill();
      gl(hx + 1.3, hy + 0.6, 0.26, "#fff2b0");
      gl(hx + 1.3, hy + 0.6, 0.5, "#ffd878");
      // Dead eyes, pale pinpricks in the sockets.
      gl(hx + 0.32, hy - 0.12, 0.1, EYE_PALE);
      gl(hx - 0.1, hy - 0.1, 0.09, EYE_PALE);
      // The near arm and the pickaxe.
      const sh = [0.35, 1.55];
      const hand = o.hand;
      bone(ctx, [sh, [(sh[0] + hand[0]) / 2 + 0.1, (sh[1] + hand[1]) / 2 - 0.3], hand], 0.46, skin, out);
      ctx.restore();
      // The pick is in the unleaned frame so its swing stays true.
      const hp = tp(o.hand[0], o.hand[1]);
      const a = o.ang;
      pickTool(ctx, hp[0], hp[1], a, 3.5, 2.1, flash);
      ctx.fillStyle = skin;
      circle(ctx, hp[0], hp[1], 0.3);
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.08;
      ctx.stroke();
    });
  }

  // A dead miner: buried he is a crack in the wall and a glint; digging, he comes
  // through it in a burst of rubble; then he walks, winds the pick back and swings.
  function miner(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const buried = m.act === "buried";
    const dig = m.act === "dig";
    if (buried || dig) {
      const p = dig ? clamp(1 - (m.wait || 0) / 650, 0, 1) : 0;
      // A crack in the rock, a faint lamp glint behind it.
      ctx.strokeStyle = "#07050a";
      ctx.lineWidth = 0.18;
      const cx = x;
      ctx.beginPath();
      ctx.moveTo(cx - 0.2, y - 5.4);
      ctx.lineTo(cx + 0.5, y - 4.2);
      ctx.lineTo(cx - 0.3, y - 3.1);
      ctx.lineTo(cx + 0.4, y - 1.9);
      ctx.lineTo(cx, y - 0.6);
      ctx.moveTo(cx + 0.5, y - 4.2);
      ctx.lineTo(cx + 1.3, y - 3.6);
      ctx.moveTo(cx - 0.3, y - 3.1);
      ctx.lineTo(cx - 1.1, y - 2.6);
      ctx.stroke();
      if (buried) {
        ctx.fillStyle = DUST;
        for (let k = 0; k < 4; k++) ctx.fillRect(cx - 1.5 + k * 0.9 + (k % 2) * 0.2, y - 0.25 - (k % 3) * 0.1, 0.35, 0.22);
        const glint = 0.55 + 0.45 * Math.sin(t / 380);
        ctx.fillStyle = `rgba(255, 224, 140, ${0.35 + glint * 0.5})`;
        ctx.fillRect(cx - 0.12, y - 3.3, 0.26, 0.26);
        v.eyes.push(cx, y - 3.2, 0.1 + glint * 0.08, "#ffe08a");
        return;
      }
      // Bursting out: a dark hollow, the figure coming through, rubble flung.
      ctx.fillStyle = "#07050a";
      ellipse(ctx, x, y - 2.8, 0.7 + p * 1.5, 1.8 + p * 1.6);
      ctx.fill();
      if (p > 0.15) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 4, y - 8, 8, 8.4);
        ctx.clip();
        ctx.globalAlpha = clamp((p - 0.15) / 0.5, 0, 1);
        const q = 1 - ease(p);
        minerBody(ctx, v, m, x - dir * q * 0.8, y + q * 0.5, t, flash, { sw: Math.sin(t / 120) * 0.4, ang: 1.9, lean: 0.35, rest: false, hand: [0.9, 0.9] });
        ctx.restore();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = "#6a5a46";
      for (let k = 0; k < 10; k++) {
        const ang = -0.2 - (k / 9) * 2.7;
        const sp = 2.5 + (k % 4) * 1.4;
        const px = x + Math.cos(ang) * sp * p * 1.5 * (k % 2 ? 1 : -1) * 0.8;
        const py = y - 2.8 + Math.sin(ang) * sp * p * 1.4 + p * p * 7;
        ctx.globalAlpha = 1 - p * 0.6;
        ctx.fillRect(px - 0.25, Math.min(py, y) - 0.25, 0.5 + (k % 3) * 0.12, 0.45);
      }
      ctx.globalAlpha = (1 - p) * 0.6;
      ctx.fillStyle = DUST;
      for (let k = 0; k < 6; k++) {
        circle(ctx, x - 2.4 + k * 1.0, y - 0.4 - p * (1.5 + (k % 3)), 0.5 + p * 0.5);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    const wind = m.act === "wind" ? ease(clamp(1 - (m.wait || 0) / 400, 0, 1)) : 0;
    const rest = m.act === "rest";
    const walking = m.act === "walk";
    // The pick: shouldered while walking, hauled back at the wind-up, hanging at rest.
    let ang = 1.0;
    let hand = [0.95, 1.35];
    if (wind > 0) {
      ang = lerp(1.0, 2.45, wind);
      hand = [lerp(0.95, 0.15, wind), lerp(1.35, 2.6, wind)];
    } else if (rest) {
      ang = -0.55;
      hand = [1.0, 0.7];
    } else if (walking) ang = 1.1 + Math.sin(t / 150) * 0.12;
    const lean = rest ? 0.32 : wind > 0 ? -0.2 * wind : 0.2;
    minerBody(ctx, v, m, x, y, t, flash, { sw: walking ? Math.sin(t / 150) * 0.6 : 0, ang, lean, rest, hand });
  }

  // A blind crawler: a pale, long-limbed thing with no eyes and a head that is all ear,
  // flared like a bat's. Hunting it is low and fast, head up, ears thrown forward; lost
  // it sways its head from side to side, sniffing, one long arm groping the air.
  function blind(ctx, v, m, x, y, t, flash) {
    const dir = m.dir || 1;
    const hunt = m.act === "hunt";
    const skin = flash ? FLASH : "#d4ccba";
    const skinD = flash ? FLASH : "#a89f8c";
    const ear = flash ? FLASH : "#dca898";
    const out = flash ? FLASH : "#201a16";
    upright(ctx, v, x, y, dir, (glow) => {
      const ph = t / (hunt ? 55 : 240);
      const sway = hunt ? 0 : Math.sin(t / 700);
      // The four long limbs, knees up over the back.
      const limb = (sx, sy, k, far) => {
        const a = ph + k * 1.7;
        const fx = sx + Math.sin(a) * (hunt ? 1.1 : 0.45) + (k < 2 ? 0.7 : -0.5);
        const fy = Math.max(0, Math.cos(a)) * (hunt ? 0.5 : 0.25);
        const kx = (sx + fx) / 2 - (k < 2 ? 0.1 : 0.4);
        const ky = 1.55 + (hunt ? -0.2 : 0);
        bone(ctx, [[sx, sy], [kx, ky], [fx, fy + 0.05]], 0.2, far ? skinD : skin, out);
        outlined(ctx, [[fx - 0.1, fy + 0.15], [fx + 0.55, fy + 0.05], [fx + 0.1, fy - 0.05]], far ? skinD : skin, out, 0.05);
      };
      limb(-0.55, 0.75, 3, true);
      limb(0.55, 0.8, 1, true);
      // The low body, a ribbed spine.
      const bodyLow = hunt ? 0.78 : 0.88;
      outlined(ctx, [[-1.6, bodyLow - 0.35], [-1.2, bodyLow + 0.4], [0.2, bodyLow + 0.5], [1.2, bodyLow + 0.35], [1.2, bodyLow - 0.3], [-0.2, bodyLow - 0.45]], skin, out, 0.09);
      ctx.strokeStyle = skinD;
      ctx.lineWidth = 0.07;
      for (let k = 0; k < 5; k++) line(ctx, -1.0 + k * 0.5, bodyLow + 0.42, -0.9 + k * 0.5, bodyLow - 0.1);
      limb(-0.8, 0.8, 2, false);
      // The head: a big bald dome, hunt: lifted and thrust forward, lost: swaying.
      const hx = 1.45 + (hunt ? 0.2 : sway * 0.15);
      const hy = hunt ? 1.55 : 1.25 + Math.abs(sway) * 0.08;
      const tilt = hunt ? 0.5 : sway * 0.4;
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(tilt);
      bone(ctx, [[-0.9, -0.5 - (hunt ? 0.2 : 0)], [-0.2, -0.1]], 0.45, skin, out);
      // Ears as great fans, thrown forward when hunting, drooping when lost.
      const spread = hunt ? 0.6 : -0.15 + Math.sin(t / 500) * 0.12;
      for (const [far, sc] of [[true, 0.85], [false, 1]]) {
        const base = far ? -0.15 : 0;
        const ang = 1.1 + spread - base;
        const pts = [[0.0, 0.2], [Math.cos(ang - 0.7) * 1.7 * sc, 0.2 + Math.sin(ang - 0.7) * 1.7 * sc], [Math.cos(ang - 0.1) * 2.0 * sc, 0.2 + Math.sin(ang - 0.1) * 2.0 * sc], [Math.cos(ang + 0.5) * 1.5 * sc, 0.2 + Math.sin(ang + 0.5) * 1.5 * sc], [-0.4, 0.4]];
        outlined(ctx, pts, far ? skinD : skin, out, 0.08);
        ctx.fillStyle = ear;
        ctx.globalAlpha = far ? 0.5 : 0.85;
        poly(ctx, [[0.0, 0.3], pts[1].map((q, i) => q * 0.8 + (i ? 0.04 : 0)), pts[2].map((q, i) => q * 0.78 + (i ? 0.04 : 0)), pts[3].map((q, i) => q * 0.8 + (i ? 0.04 : 0))]);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = skinD;
        ctx.lineWidth = 0.05;
        for (let r = 1; r <= 2; r++) {
          ctx.beginPath();
          ctx.arc(0.1, 0.35, 0.45 * r * sc, ang - 0.7, ang + 0.5);
          ctx.stroke();
        }
      }
      outlined(ctx, [[-0.6, -0.1], [-0.4, 0.55], [0.4, 0.75], [1.0, 0.35], [1.15, -0.2], [0.6, -0.7], [-0.2, -0.65]], skin, out, 0.09);
      // No eyes: smooth, but for the nose slits that flare and the thin toothy mouth.
      const sniff = 0.5 + 0.5 * Math.sin(t / (hunt ? 90 : 220));
      ctx.fillStyle = out;
      ellipse(ctx, 0.95, 0.12, 0.05 + sniff * 0.04, 0.12 + sniff * 0.07);
      ctx.fill();
      ellipse(ctx, 0.7, 0.14, 0.04 + sniff * 0.03, 0.1 + sniff * 0.06);
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.07;
      ctx.beginPath();
      ctx.moveTo(0.1, -0.35);
      ctx.quadraticCurveTo(0.65, -0.5, 1.05, -0.2);
      ctx.stroke();
      ctx.fillStyle = flash ? FLASH : "#f2eee0";
      for (let k = 0; k < 4; k++) ctx.fillRect(0.28 + k * 0.17, -0.42 - (k % 2) * 0.03, 0.06, 0.12);
      ctx.restore();
      // The groping arm (lost) or the other forefoot reaching (hunt).
      const reach = hunt ? 0.2 : 0.7 + Math.sin(t / 420) * 0.35;
      bone(ctx, [[0.95, 0.85], [1.7 + reach * 0.6, 1.0 + reach * 0.6], [2.7 + reach, 0.55 + reach * 0.9]], 0.2, skin, out);
      for (const f of [-0.28, 0, 0.28]) {
        const fx = 2.7 + reach;
        const fy = 0.55 + reach * 0.9;
        line(ctx, fx, fy, fx + 0.45, fy + f);
      }
      // A faint wet gleam on the ears' rims keeps it findable in the dark.
      glow(hx - 0.2 + Math.sin(tilt) * 0.2, hy + 1.1, 0.08, "#b8c4cc");
    });
  }

  // A cage lift on its cable, drawn by ghoul-mine-world.js.
  function cage(ctx, v, m, x, y, t, flash) {
    world.cage(ctx, v, m, x, y, t, flash);
  }

  /* ---------------------------------------------------- the Tommyknocker */

  // The boss: ghoul-mine-tommy.js draws him (a miner-giant half grown into the seam).
  const tommyArt = tommyKit(d);
  const tommy = (ctx, v, b) => tommyArt.figure(ctx, v, b);

  /* ------------------------------------------------------------- hazards */

  // A rock in its three states, drawn by ghoul-mine-world.js.
  function rock(ctx, v, h) {
    world.rock(ctx, v, h);
  }

  // A lit stick of dynamite: a fat red stick banded in paper with a tin cap and a fuse that
  // burns shorter and spits sparks; it tumbles through the air and blinks red as the fuse runs out.
  function stick(ctx, v, h) {
    const H = v.g.FIELD_H;
    const t = v.clock || 0;
    const y = H - h.y;
    const ang = h.rest ? 0.18 : h.spin;
    const left = clamp(h.fuse / h.max, 0, 1);
    const blink = h.fuse < 380 && Math.floor(t / 70) % 2 === 0;
    const L = 0.2 + 0.8 * left;
    ctx.save();
    ctx.translate(h.x, y);
    ctx.rotate(ang);
    // The stick.
    ctx.fillStyle = blink ? "#ff8a70" : "#c8342a";
    poly(ctx, [[-1.05, -0.38], [1.0, -0.38], [1.0, 0.38], [-1.05, 0.38]]);
    ctx.fill();
    ctx.fillStyle = blink ? "#ffd0c0" : "#e86a5a";
    ctx.fillRect(-1.0, -0.34, 2.0, 0.16);
    ctx.fillStyle = "#8a1e18";
    ctx.fillRect(-1.0, 0.18, 2.0, 0.2);
    ctx.fillStyle = "#e8dcb0";
    for (const bx of [-0.55, 0.4]) ctx.fillRect(bx, -0.4, 0.3, 0.8);
    ctx.fillStyle = "#2a2220";
    ctx.fillRect(-0.18, -0.1, 0.5, 0.06);
    ctx.fillRect(-0.18, 0.06, 0.34, 0.06);
    ctx.fillStyle = "#a8a098";
    ctx.fillRect(1.0, -0.3, 0.16, 0.6);
    ctx.strokeStyle = "#1c100c";
    ctx.lineWidth = 0.09;
    ctx.strokeRect(-1.05, -0.38, 2.05, 0.76);
    // The fuse curling off the cap.
    const tipX = 1.15 + 0.6 * L;
    const tipY = -0.75 * L;
    ctx.strokeStyle = "#2a2220";
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(1.15, 0);
    ctx.quadraticCurveTo(1.15 + 0.4 * L, -0.05 - 0.2 * L, tipX, tipY);
    ctx.stroke();
    ctx.restore();
    // The spark at its tip, in room coordinates.
    const sx = h.x + Math.cos(ang) * tipX - Math.sin(ang) * tipY;
    const sy = y + Math.sin(ang) * tipX + Math.cos(ang) * tipY;
    const fast = Math.floor(t / (h.fuse < 300 ? 36 : 80));
    ctx.strokeStyle = fast % 2 ? GOLD : "#ff9a3a";
    ctx.lineWidth = 0.12;
    for (let k = 0; k < 6; k++) {
      const a = (hash(fast, k) % 7) * 0.2 + k * 1.05;
      line(ctx, sx, sy, sx + Math.cos(a) * 0.55, sy + Math.sin(a) * 0.55);
    }
    ctx.fillStyle = "#fff4c0";
    circle(ctx, sx, sy, 0.16);
    ctx.fill();
    ctx.fillStyle = "#ffb050";
    for (let k = 0; k < 3; k++) {
      const f = ((t / 260 + k / 3) % 1);
      ctx.globalAlpha = 1 - f;
      ctx.fillRect(sx + Math.sin(k * 5 + fast) * 0.5 - 0.08, sy + f * 1.2 - 0.08, 0.16, 0.16);
    }
    ctx.globalAlpha = 1;
    v.eyes.push(sx, sy, 0.3, "#ffd070");
  }

  // The blast: a white flash, a roiling fireball swelling and fading, a shock ring along
  // the floor, chips of rock flung out and a ring of smoke rising from it.
  function blast(ctx, v, h) {
    const H = v.g.FIELD_H;
    const f = clamp(h.boom / h.max, 0, 1);
    const p = 1 - f;
    const R = h.w / 2;
    const fy = H - h.y;
    const cy = fy - 1.8 - p * 2.2;
    // The flash: a spiked star in the first moments.
    if (p < 0.2) {
      const k = 1 - p / 0.2;
      ctx.globalAlpha = k;
      ctx.fillStyle = "#fffbe8";
      const pts = [];
      for (let i = 0; i < 20; i++) pts.push([h.x + Math.cos((i / 20) * TAU) * R * (i % 2 ? 0.45 : 0.95) * (1.1 - k * 0.3), cy + Math.sin((i / 20) * TAU) * R * (i % 2 ? 0.28 : 0.6) * (1.1 - k * 0.3)]);
      poly(ctx, pts);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // The fireball: lobes of red, orange, yellow and white, hot at the heart.
    const grow = ease(clamp(p / 0.45, 0, 1));
    const fade = Math.pow(f, 0.7);
    const lobes = [[0, 0, 1], [-0.5, 0.05, 0.7], [0.5, 0.1, 0.72], [-0.2, -0.38, 0.62], [0.25, -0.3, 0.6], [-0.75, 0.2, 0.45], [0.78, 0.22, 0.46]];
    for (const [color, sz] of [["rgba(190, 50, 24, 0.72)", 1], ["rgba(255, 126, 36, 0.82)", 0.78], ["rgba(255, 214, 90, 0.9)", 0.5], ["rgba(255, 252, 220, 0.95)", 0.24]]) {
      ctx.fillStyle = color;
      ctx.globalAlpha = fade;
      for (const [lx, ly, ls] of lobes) {
        const wob = 1 + Math.sin(v.clock / 70 + lx * 9) * 0.05;
        ellipse(ctx, h.x + lx * R * 0.6 * grow, cy + ly * R * 0.4 * grow - (sz < 0.6 ? 0.3 : 0), R * 0.34 * ls * sz * (0.35 + 0.65 * grow) * wob, R * 0.26 * ls * sz * (0.35 + 0.65 * grow) * wob);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    // The shock ring along the floor.
    ctx.strokeStyle = `rgba(255, 238, 190, ${(f * 0.8).toFixed(2)})`;
    ctx.lineWidth = 0.15 + f * 0.35;
    ellipse(ctx, h.x, fy - 0.2, R * (0.2 + 1.0 * ease(p)), 0.5 + 1.1 * ease(p));
    ctx.stroke();
    // Chips of rock flung out and falling.
    ctx.fillStyle = "#8a7a68";
    for (let i = 0; i < 14; i++) {
      const a = -0.25 - (i / 13) * 2.65;
      const sp = R * (0.5 + (i % 4) * 0.2);
      const px = h.x + Math.cos(a) * sp * p * 1.1;
      const py = fy - 1.5 + Math.sin(a) * sp * p * 1.2 * 0.7 + p * p * 9;
      ctx.globalAlpha = clamp(1.4 - p * 1.2, 0, 1);
      ctx.fillRect(px - 0.2, Math.min(py, fy) - 0.2, 0.4 + (i % 3) * 0.12, 0.34);
    }
    ctx.globalAlpha = 1;
    // The smoke ring: dark puffs round a ring that climbs as the fire dies.
    if (p > 0.25) {
      const k = clamp((p - 0.25) / 0.75, 0, 1);
      const sy = cy - 0.8 - k * 3.8;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + 0.4;
        const rx = R * (0.28 + 0.5 * k);
        ctx.globalAlpha = clamp(k * 3, 0, 1) * (1 - k * 0.7) * 0.75;
        ctx.fillStyle = i % 3 ? "#403830" : "#5a5048";
        circle(ctx, h.x + Math.cos(a) * rx, sy + Math.sin(a) * rx * 0.28, 0.9 + k * 0.8 + (i % 2) * 0.3);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    v.eyes.push(h.x, cy, 1.4 * f, "#ffd890");
    v.eyes.push(h.x, cy, 2.4 * f * f, "#ff9a3a");
  }

  // The pickaxe's swing in front of a miner: a pale crescent of air swept from over
  // his head down to the floor, the iron head at its leading end, a few sparks.
  function pick(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const f = clamp(h.live / h.max, 0, 1);
    const dir = h.dir || 1;
    const x0 = h.x - dir * h.w * 0.5;
    const y0 = fy - h.h * 0.95;
    const cx = h.x + dir * h.w * 0.6;
    const cy = fy - h.h * 0.8;
    const x1 = h.x + dir * h.w * 0.5;
    const y1 = fy - h.h * 0.1;
    const at = (s) => {
      const q = 1 - s;
      return [q * q * x0 + 2 * q * s * cx + s * s * x1, q * q * y0 + 2 * q * s * cy + s * s * y1];
    };
    const pivot = [x0 - dir * 0.4, fy - h.h * 1.0];
    const sweep = clamp(1.25 - f, 0.12, 1);
    const outer = [];
    const inner = [];
    for (let i = 0; i <= 10; i++) {
      const s = (i / 10) * sweep;
      const [px, py] = at(s);
      const k = 0.55 * Math.sin((i / 10) * Math.PI) ** 0.8;
      outer.push([px, py]);
      inner.push([px + (pivot[0] - px) * k * (1 - i / 14), py + (pivot[1] - py) * k * 0.5 + k * 0.5]);
    }
    ctx.globalAlpha = 0.25 + 0.6 * f;
    poly(ctx, [...outer, ...inner.reverse()]);
    ctx.fillStyle = "#e8e0d0";
    ctx.fill();
    ctx.globalAlpha = 0.4 + 0.6 * f;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.22;
    ctx.lineCap = "round";
    ctx.beginPath();
    outer.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
    ctx.lineCap = "butt";
    // The pick head at the leading end.
    const [hx, hy] = outer[outer.length - 1];
    const [bx, by] = outer[outer.length - 2];
    const ta = Math.atan2(hy - by, hx - bx);
    ctx.globalAlpha = 0.5 + 0.5 * f;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ta);
    ctx.fillStyle = "#b8b8c8";
    poly(ctx, [[0.3, 0], [-0.1, -1.0], [-0.3, 0], [-0.1, 1.0]]);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = FLASH;
    for (let k = 0; k < 4; k++) ctx.fillRect(hx + dir * (0.3 + k * 0.4), hy - 0.6 + (k % 2) * 0.9, 0.22, 0.2);
    ctx.globalAlpha = 1;
  }

  // The hammer's sweep along the floor: the iron head ploughing across, a long pale wake
  // behind it and a rolling wave of dust and splinters.
  function hammerSweep(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const f = clamp(h.live / h.max, 0, 1);
    const dir = h.dir || 1;
    const x0 = h.x - dir * h.w * 0.5;
    const x1 = h.x + dir * h.w * 0.5;
    const head = x0 + (x1 - x0) * clamp((1 - f) * 1.15 + 0.08, 0.08, 1);
    // The wake: a wedge thickening toward the head.
    ctx.globalAlpha = 0.3 + 0.6 * f;
    poly(ctx, [[x0, fy], [x0, fy - 0.3], [head - dir * 1.2, fy - h.h * 0.9], [head, fy - h.h], [head, fy]]);
    ctx.fillStyle = "#f0e4c8";
    ctx.fill();
    ctx.globalAlpha = 0.25 + 0.5 * f;
    poly(ctx, [[x0 + dir * 4, fy], [head - dir * 1.2, fy - h.h * 0.55], [head, fy - h.h * 0.7], [head, fy]]);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.globalAlpha = 0.35 + 0.6 * f;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.2;
    line(ctx, x0 + dir * 1, fy - 0.4, head - dir * 1.2, fy - h.h * 0.92);
    // Dust rolling ahead of and above the head.
    ctx.fillStyle = "#a89878";
    for (let k = 0; k < 9; k++) {
      const px = head - dir * (0.8 + k * 1.1);
      const py = fy - 0.5 - (k % 3) * 0.55 - Math.sin(v.clock / 120 + k) * 0.25;
      ctx.globalAlpha = (0.55 - k * 0.04) * f;
      circle(ctx, px, py, 0.6 + (k % 3) * 0.25);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The hammer head.
    ctx.save();
    ctx.translate(head, fy - h.h * 0.5);
    ctx.scale(dir, 1);
    ctx.globalAlpha = 0.5 + 0.5 * f;
    ctx.fillStyle = "#4a4a54";
    poly(ctx, [[-0.9, -1.3], [0.7, -1.2], [0.9, 1.3], [-0.8, 1.3]]);
    ctx.fill();
    ctx.fillStyle = "#9a9aa8";
    ctx.fillRect(0.3, -1.2, 0.5, 2.5);
    ctx.restore();
    ctx.fillStyle = FLASH;
    for (let k = 0; k < 7; k++) ctx.fillRect(head + dir * (0.4 + k * 0.5), fy - 0.5 - (k * 7 % 4) * 0.55, 0.3, 0.2);
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- powers */

  // The Hard Hat's badge (inside the ring every power-up shares): a yellow helmet, side on,
  // with a ridge, a wide brim and its lamp lit with a short beam.
  function hat(ctx, x, y) {
    ctx.fillStyle = "rgba(255, 244, 170, 0.35)";
    poly(ctx, [[x + 0.85, y - 0.1], [x + 1.55, y - 0.5], [x + 1.55, y + 0.3]]);
    ctx.fill();
    ctx.fillStyle = "#f2b630";
    ctx.beginPath();
    ctx.moveTo(x - 1.0, y + 0.4);
    ctx.quadraticCurveTo(x - 1.0, y - 0.95, x, y - 0.95);
    ctx.quadraticCurveTo(x + 1.0, y - 0.95, x + 1.0, y + 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#7a5206";
    ctx.lineWidth = 0.1;
    ctx.stroke();
    ctx.fillStyle = "#ffd96a";
    ctx.beginPath();
    ctx.moveTo(x - 0.7, y - 0.05);
    ctx.quadraticCurveTo(x - 0.65, y - 0.6, x - 0.15, y - 0.75);
    ctx.quadraticCurveTo(x - 0.5, y - 0.4, x - 0.45, y - 0.05);
    ctx.fill();
    ctx.fillStyle = "#c88a10";
    ctx.fillRect(x - 0.13, y - 0.95, 0.26, 0.9);
    ctx.fillStyle = "#e0a020";
    ctx.fillRect(x - 1.3, y + 0.32, 2.6, 0.3);
    ctx.strokeRect(x - 1.3, y + 0.32, 2.6, 0.3);
    ctx.fillStyle = "#6a5a40";
    ctx.fillRect(x + 0.55, y - 0.3, 0.45, 0.5);
    ctx.fillStyle = "#fff6c0";
    circle(ctx, x + 0.85, y - 0.05, 0.17);
    ctx.fill();
  }

  // Dynamite's badge: three red sticks tied with a cord, a fuse lit.
  function dyn(ctx, x, y) {
    for (const [dx, tilt] of [[-0.42, -0.1], [0.42, 0.1], [0, 0]]) {
      ctx.save();
      ctx.translate(x + dx, y + 0.1);
      ctx.rotate(tilt);
      ctx.fillStyle = "#c8342a";
      ctx.fillRect(-0.28, -0.75, 0.56, 1.6);
      ctx.fillStyle = "#e86a5a";
      ctx.fillRect(-0.24, -0.72, 0.14, 1.5);
      ctx.fillStyle = "#8a1e18";
      ctx.fillRect(0.1, -0.72, 0.14, 1.5);
      ctx.fillStyle = "#a8a098";
      ctx.fillRect(-0.28, -0.75, 0.56, 0.14);
      ctx.strokeStyle = "#1c100c";
      ctx.lineWidth = 0.07;
      ctx.strokeRect(-0.28, -0.75, 0.56, 1.6);
      ctx.restore();
    }
    ctx.fillStyle = "#e8d8a0";
    ctx.fillRect(x - 0.85, y + 0.25, 1.7, 0.2);
    ctx.strokeStyle = "#2a2220";
    ctx.lineWidth = 0.1;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y - 0.75);
    ctx.quadraticCurveTo(x + 0.1, y - 1.1, x + 0.4, y - 1.2);
    ctx.stroke();
    ctx.lineCap = "butt";
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.1;
    for (let k = 0; k < 5; k++) line(ctx, x + 0.4, y - 1.25, x + 0.4 + Math.cos(k * 1.3 + 0.4) * 0.34, y - 1.25 + Math.sin(k * 1.3 + 0.4) * 0.34);
    ctx.fillStyle = "#fff4c0";
    circle(ctx, x + 0.4, y - 1.25, 0.12);
    ctx.fill();
  }

  /* -------------------------------------------------------------- lights */

  // The lamps on the wall (out in a blackout), miners' helmet lamps, a spark in
  // an imp's hands, the Tommyknocker's lantern, a stick's fuse and the blast.
  function lights(v, add) {
    const round = v.round;
    const spec = v.spec;
    if (!spec || !LOOKS[spec.id]) return;
    world.lights(v, add);
    for (const m of round.monsters) {
      if (m.dead) continue;
      if (m.kind === "miner" && m.act !== "buried") add(m.x + (m.dir || 1) * 1, m.y + m.h - 0.6, 7, 0.55);
      else if (m.kind === "imp" && m.stole) add(m.x, m.y + 1.5, 4, 0.55);
      else if (m.kind === "imp" && m.decoy) add(m.x + (m.dir || 1), m.y + 3, 11, 0.8);
      else if (m.kind === "canary") add(m.x, m.y + 1, 3.5, 0.4);
      // A faint pale shine off the blind crawler's skin, so it can be found in the dark.
      else if (m.kind === "blind") add(m.x, m.y + 1, 4, m.act === "hunt" ? 0.32 : 0.22);
    }
    for (const h of round.hazards) {
      if (h.kind === "stick") add(h.x, h.y, 4, 0.7);
      else if (h.kind === "blast") add(h.x, h.y + 1.5, 16, 0.9 * (h.boom / h.max));
    }
    const b = round.boss;
    if (b && b.kind === "tommy" && b.state !== "sleep" && b.state !== "down" && !b.hidden && (!b.darkOn || b.act === "dazed")) add(b.x + (b.dir || -1) * 3.5, b.y + 12.5, 9, 0.6);
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
    // The splash of a wading step is quiet, and not more than one at a time.
    if (e.type === "wade") {
      if (gateOnce(fx, "wadeMs", 200)) {
        say(tone, voice[0], voice[1], 0.3);
        burst(e.x, e.y + 1, "#8ac0d0", 4, 6, 300);
      }
      return true;
    }
    say(tone, voice[0], voice[1], voice[0] === "tommy" ? 0.6 : 0.5);
    switch (e.type) {
      case "rockWarn":
        burst(e.x, 46, DUST, 4, 4, 600);
        break;
      case "rockLand":
        shake(160, 0.5);
        burst(e.x, e.y + 0.6, DUST, 10, 10, 500);
        break;
      case "rockBounce":
      case "hatKnock":
        burst(e.x, e.y, "#fff2b0", 6, 10, 260);
        float(e.x, e.y + 3, "Clang!", GOLD, 2);
        break;
      case "impSteal":
        float(e.x, e.y + 3, "My light!", DANGER, 2);
        burst(e.x, e.y, "#ffd94a", 6, 8, 400);
        break;
      case "impDrop":
        glow(e.x, e.y, 8, 0.7, 500);
        float(e.x, e.y + 3, "Light back!", GOLD, 2);
        break;
      case "canaryScream":
        ring(e.x, e.y, "#f2e46a", 1, 12, 600);
        shake(220, 0.5);
        float(e.x, e.y + 3, "!", DANGER, 2.8);
        break;
      case "minerDig":
        burst(e.x, e.y, DUST, 12, 10, 600);
        shake(120, 0.3);
        break;
      case "pickWind":
        float(e.x + (e.dir || 1) * 4, e.y + 3, "!", DANGER, 2.4);
        break;
      case "pickSwing":
        burst(e.x + (e.dir || 1) * 4, e.y, "#fff2d8", 5, 12, 240);
        break;
      case "blindLost":
        float(e.x, e.y + 2, "?", "#c8c0b0", 2.2);
        break;
      case "blindHear":
        float(e.x, e.y + 2, "!", DANGER, 2.2);
        break;
      case "dynBlast":
        flash("#ffb050", 260);
        shake(320, 0.9);
        burst(e.x, e.y + 1, "#ff9a2e", 22, 22, 600);
        burst(e.x, e.y + 1, DUST, 12, 14, 700);
        ring(e.x, e.y + 1, "#ffe27a", 2, 12, 500);
        glow(e.x, e.y + 1.5, 16, 0.9, 500);
        break;
      case "tommyKnock":
        shake(150, 0.5);
        burst(e.x + (e.dir || 1) * 4, e.y, DUST, 8, 9, 400);
        float(e.x + (e.dir || 1) * 5, e.y + 5, "KNOCK", GOLD, 2);
        break;
      case "sweepWind":
        float(e.x + (e.dir || 1) * 6, e.y + 3, "!", DANGER, 2.8);
        break;
      case "tommySweep":
        shake(200, 0.6);
        burst(e.x + (e.dir || 1) * 8, e.y + 1, "#c8b890", 12, 16, 400);
        break;
      case "tommyDark":
        flash("#000000", 260);
        banner("Lights out", "Follow the knocking, not the light", "#ffb84a", 1600);
        break;
      case "tommySink":
        burst(e.x, e.y - 4, DUST, 16, 12, 700);
        shake(260, 0.7);
        break;
      case "tommyKnockDark":
        burst(e.x, e.y, DUST, 4, 4, 600);
        break;
      case "tommyBurst":
        flash("#ffd890", 240);
        shake(420, 1.0);
        burst(e.x, e.y, DUST, 26, 20, 700);
        ring(e.x, e.y, "#d8c8a8", 2, 14, 500);
        float(e.x, e.y + 9, "Shoot him!", GOLD, 2.4);
        break;
      case "tommyRage":
        flash("#ff7a2a", 320);
        shake(340, 0.8);
        ring(e.x, e.y, "#ff7a2a", 2, 16, 700);
        banner("The Tommyknocker rages", "Quicker knocks, longer dark", "#ff7a2a", 1700);
        break;
      default:
        break;
    }
    return true;
  }

  // Over Planny: the world's front (the water, the cage's bars), then the Hard
  // Hat on his head while he wears it, its lamp the way he faces.
  function frontAndHat(ctx, v) {
    front(ctx, v);
    const you = v.round.you;
    if (!you.hat || you.out > 0) return;
    const top = v.g.FIELD_H - you.y - v.g.YOU_H * (you.ducking ? 0.55 : 1);
    ctx.save();
    ctx.translate(you.x, top - 0.35);
    ctx.scale((you.face || 1) * 1.25, 1.25);
    hat(ctx, 0, 0);
    ctx.restore();
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    front: frontAndHat,
    moving: world.moving,
    dim,
    monsters: freeze({ imp, canary, miner, blind, cage }),
    bosses: freeze({ tommy }),
    missiles: freeze({}),
    hazards: freeze({ rock, stick, blast, pick, hammer: hammerSweep }),
    powers: freeze({ hat, dyn }),
    lights,
    react,
  });
}
