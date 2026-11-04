// Plan2Code Web Console - Ghoul Rush's finale, its drawing: the Front Lawn under a storm (a bruised sky, a low moon behind cloud, black hills with the road folded up like paper behind YOU, a rusted fence, leaning graves, the overgrown drive, the broken gate and the stuffed mailbox, the dead oak whose branches are the shelves, rain and lightning), Marrow the house itself as a face (gable eyes, a door for a mouth, porch pickets for teeth, a shingled brow) with every window lit, shuttered or shot out for good, its moves' slates, pickets, bricks, carpet and quake, its retreat (the sag, the false "YOU ESCAPED!", the red eye and the laugh, the sinking), and what its events look and sound like.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, LOSE_WORDS and LOSE_SOUNDS are
// plain data; marrowArt(d) takes ghoul-draw.js's own drawing helpers (`d`:
// ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, label,
// DANGER, GOLD, FLASH and the eye colors) and hands back the drawing by
// kind, so this file never reaches back into it. Everything is drawn in
// room units, the way ghoul-draw.js draws: y counted down from the field's
// top. The house is drawn in a local frame at its feet (its center on the
// floor), y counted down as on screen, so a height `up` is at -up. Each
// function says what it draws and what in the rules (ghoul-marrow.js) it
// follows.
//
// The backdrop is painted once into the still layers, so nothing in it
// moves; the rain, the drifting cloud and the lightning's flash are drawn
// each frame by moving() and front(), which (like lights()) run for every
// pack in every room and so return at once outside this file's rooms.

import { FALSE_AT, GONE_AT, LAUGH_AT, PICKET_UP_MS, BRICK_LIVE_MS, CHARGE_AT, LIGHTNING_LIVE_MS, SINK_AT, WINDOWS, WINDOW_H, WINDOW_W, houseCenter } from "./ghoul-marrow.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Out on the hill in a storm: the "wall" is the sky (`wallTop` to `wallLow`,
// a bruised plum low down), `paper` the far hills, `wainscot` the nearer
// ones, `window` the moon, the floor colors black earth under wet grass, the
// shelf colors the oak's bark. `custom` and `outdoor` hand the room's walls,
// floor and shelves to this file; `noMoon` keeps the indoor window light out.
const storm = (o) => freeze({ wallTop: "#08060e", wallLow: "#2c1a30", paper: "#160f1c", wainscot: "#0c0910", floorTop: "#24301a", floor: "#0d0a08", floorEdge: "#050403", shelf: "#2a2018", shelfTop: "#4a3c2c", pit: "#020103", window: "#d8cfa8", hedge: "#33421f", decor: "tombs", dark: 0.75, outdoor: true, custom: true, noMoon: true, pack: "marrow", ...o });
export const LOOKS = freeze({
  lawn: storm({ color: "#c8a04a" }),
});

// How the House sounds, by act (the user's picks from the sound vote, marrow.html, in ghoul-sfx-marrow.js).
export const VOICES = freeze({
  marrow: freeze({ wake: "ghoulMarrowWake", hurt: "ghoulMarrowHurt", die: "ghoulMarrowDie", roof: "ghoulMarrowRoof", door: "ghoulMarrowDoor", carpet: "ghoulMarrowCarpet", shingle: "ghoulMarrowShingle", picketWind: "ghoulMarrowPicketWind", picketUp: "ghoulMarrowPicketUp", cough: "ghoulMarrowCough", brick: "ghoulMarrowBrick", doormen: "ghoulMarrowDoormen", rear: "ghoulMarrowRear", stomp: "ghoulMarrowStomp", light: "ghoulMarrowLight", windowOut: "ghoulMarrowWindowOut", sag: "ghoulMarrowSag", falseWin: "ghoulMarrowFalseWin", laugh: "ghoulMarrowLaugh", sink: "ghoulMarrowSink", gone: "ghoulMarrowGone", storm: "ghoulMarrowStorm", charge: "ghoulMarrowCharge", strike: "ghoulMarrowStrike", crows: "ghoulMarrowCrows" }),
});
export const LOSE_WORDS = freeze({ marrow: "Shown the door", marrowShingle: "Roofed", marrowCarpet: "Rolled out", marrowPicket: "Fenced in", marrowBrick: "Bricked", marrowQuake: "Thrown down", marrowBolt: "Struck down" });
export const LOSE_SOUNDS = freeze({
  marrow: ["smash", 0.6, 0.6],
  marrowShingle: ["smash", 0.55, 1.1],
  marrowCarpet: ["thud", 0.6, 0.7],
  marrowPicket: ["crunch", 0.55, 0.9],
  marrowBrick: ["smash", 0.6, 0.8],
  marrowQuake: ["thud", 0.65, 0.6],
  marrowBolt: ["ghoulCrack", 0.6, 0.8],
});

// Where the lawn's still pieces stand (room units): the dead oak's trunk (its
// branches are the room's shelves), the broken gate, the mailbox of the
// ending's gag, and the leaning graves.
const OAK_X = 143;
const GATE_X = 70;
const MAILBOX_X = 100;
const GRAVES = freeze([[24, 0], [47, 1], [86, 2], [117, 3], [166, 4]]);

// The house's inks: rotting clapboard in plum and wet gray, black shingles,
// gray trim, the windows' fire, the carpet's red and gold.
const CLAP = "#3a2734";
const CLAP_LIT = "#4e3846";
const CLAP_DARK = "#22151e";
const WET = "#5a5862";
const TRIM = "#6a6470";
const TRIM_DARK = "#2a2630";
const ROOF = "#17131c";
const SHINGLE = "#2a2532";
const SHINGLE_LIT = "#46404e";
const STONE = "#3e3a40";
const STONE_LIT = "#5a5558";
const GLASS_HOT = "#fff0a8";
const GLASS = "#ffc94a";
const GLASS_LOW = "#ff8a1e";
const PUPIL = "#2a0804";
const SHUTTER = "#4a4852";
const SHUTTER_DARK = "#2c2a32";
const SHUTTER_LIT = "#625f6a";
const SHARD = "#8a9aa4";
const SOOT = "#0a0608";
const MOUTH = "#1a0306";
const MOUTH_RED = "#6a0a12";
const TOOTH = "#d8cfb0";
const DOOR = "#3a2418";
const DOOR_DARK = "#1e120c";
const BRASS = "#8a6a2a";
const PICKET = "#e6e0cc";
const PICKET_SHADE = "#a8a090";
const CARPET = "#9a1426";
const CARPET_DARK = "#560a14";
const CARPET_LIT = "#c8384a";
const CARPET_GOLD = "#d8a83a";
const BRICK = "#8a3a24";
const BRICK_LIT = "#b85a3a";
const MORTAR = "#c8b8a0";
const EMBER = "#ff7a20";
const EMBER_HOT = "#ffd070";
const EARTH = "#2a1e12";
const EARTH_LIT = "#4a3a24";
const GRASS = "#2a3a1c";
const GRASS_LIT = "#4a5c30";
const GRASS_WET = "#7a8a6a";
const OAK = "#1c1612";
const OAK_LIT = "#3a3026";
const IRON = "#3a2418";
const IRON_LIT = "#6a3a22";
const RAIN = "#aab2cc";
const DUST = "#6a5e52";
// The storm's bolts: a white core in a pale blue edge.
const BOLT = "#f2f6ff";
const BOLT_EDGE = "#8fb4ff";
const RED_EYE = "#ff2a12";

export function marrowArt(d) {
  const { ellipse, circle, roundRect, line, rotate, eye, hash, say, gate, label, DANGER, GOLD } = d;
  const rnd = (a, b) => hash(a, b) / 997;
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

  // A limb that tapers from w0 wide at (x0, y0) to w1 at (x1, y1), bowed by
  // `bend` units off the straight line (a quadratic), as a filled shape.
  function limb(ctx, x0, y0, x1, y1, w0, w1, bend = 0) {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    const mx = (x0 + x1) / 2 + nx * bend;
    const my = (y0 + y1) / 2 + ny * bend;
    const left = [];
    const right = [];
    for (let k = 0; k <= 8; k++) {
      const t = k / 8;
      const px = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
      const py = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
      const w = mix(w0, w1, t) / 2;
      left.push(px + nx * w, py + ny * w);
      right.unshift(px - nx * w, py - ny * w);
    }
    poly(ctx, left.concat(right));
  }

  // The arched shape of a door, `w` wide and `h` tall, its sill at (x, y).
  function arch(ctx, x, y, w, h) {
    const r = w / 2;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x - r, y - h + r);
    ctx.arc(x, y - h + r, r, Math.PI, 0);
    ctx.lineTo(x + r, y);
    ctx.closePath();
  }

  /* ------------------------------------------------------- the backdrop */

  // The storm over the hill, from x0 to x1: a bruised sky, heavy cloud with
  // moonlit rims, the low moon half behind a bank of it, and two lines of
  // black hills. Painted once (still layer), so the cloud here never drifts;
  // moving() draws the cloud that does.
  function stormSky(ctx, v, look, x0, x1) {
    const H = v.g.FIELD_H;
    const sky = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, H) : null;
    if (sky && typeof sky.addColorStop === "function") {
      sky.addColorStop(0, look.wallTop);
      sky.addColorStop(0.5, "#1c1224");
      sky.addColorStop(0.78, look.wallLow);
      sky.addColorStop(1, "#3a2234");
      ctx.fillStyle = sky;
    } else ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, H);
    // The moon, low over the oak, smeared by the storm.
    const mx = 126;
    const my = 16;
    if (x1 > mx - 16 && x0 < mx + 16) {
      halo(ctx, mx, my, 13, look.window, 0.38);
      ctx.fillStyle = look.window;
      ctx.globalAlpha = 0.9;
      circle(ctx, mx, my, 3.6);
      ctx.fill();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = "#6a6250";
      for (const [cx, cy, cr] of [[-1.1, -0.9, 1], [1.2, 0.8, 0.8], [0.2, -1.8, 0.5], [-1.6, 1.3, 0.45]]) {
        circle(ctx, mx + cx, my + cy, cr);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Heavy cloud: dark banks, lit at their lower rims, one across the moon.
    for (let x = Math.floor(x0 / 9) * 9 - 9; x < x1 + 18; x += 9) {
      const n = Math.round(x / 9);
      const h = hash(n, 41);
      const cy = 2 + (h % 7);
      const rx = 7 + (h % 6);
      ctx.fillStyle = "#4a3a54";
      ctx.globalAlpha = 0.35;
      ellipse(ctx, x + (h % 5), cy + 1.1, rx, 1.6 + (h % 3) * 0.4);
      ctx.fill();
      ctx.fillStyle = h % 2 ? "#120c18" : "#181020";
      ctx.globalAlpha = 0.85;
      ellipse(ctx, x + (h % 5), cy, rx, 1.8 + (h % 3) * 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (x1 > mx - 16 && x0 < mx + 16) {
      // A ragged bank across the moon's lower half, its top edge silvered.
      const puffs = [[-6, 3.4, 3.2, 1.3], [-2.4, 2.6, 3, 1.6], [1.4, 2.2, 3.4, 1.8], [5, 2.9, 3.2, 1.4], [8.4, 3.6, 2.6, 1.1]];
      ctx.fillStyle = "#8a7a7a";
      ctx.globalAlpha = 0.4;
      for (const [dx, dy, rx, ry] of puffs) {
        ellipse(ctx, mx + dx, my + dy - 0.35, rx, ry);
        ctx.fill();
      }
      ctx.fillStyle = "#18101e";
      ctx.globalAlpha = 0.9;
      for (const [dx, dy, rx, ry] of puffs) {
        ellipse(ctx, mx + dx, my + dy, rx, ry);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // The far hills, then the nearer.
    ctx.fillStyle = look.paper;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    for (let x = x0; x <= x1 + 2; x += 2) ctx.lineTo(x, 36 + Math.sin(x / 31) * 2.2 + Math.sin(x / 11 + 1) * 0.6);
    ctx.lineTo(x1 + 2, H);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = look.wainscot;
    ctx.beginPath();
    ctx.moveTo(x0, H);
    for (let x = x0; x <= x1 + 2; x += 2) ctx.lineTo(x, 41 + Math.sin(x / 23 + 2) * 1.3 + Math.sin(x / 7) * 0.3);
    ctx.lineTo(x1 + 2, H);
    ctx.closePath();
    ctx.fill();
  }

  // The road YOU came by, folded up like paper (the intro's page 7): it runs
  // up the far hill, then stands in the sky in creased panels, a dashed line
  // zigzagging up them.
  function foldedRoad(ctx, x0, x1) {
    if (x1 < 26 || x0 > 60) return;
    // The road over the near hill, coming in flat.
    ctx.strokeStyle = "#3a3442";
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "miter";
    ctx.beginPath();
    ctx.moveTo(58, 42.6);
    ctx.lineTo(37, 39.2);
    ctx.stroke();
    // Then up into the sky in a zigzag of folds, like a napkin.
    const folds = [37, 39.2, 31.6, 36, 39.4, 32.6, 31.8, 29.4, 39, 26.2, 32.4, 23.2, 37.4, 20.8];
    ctx.strokeStyle = "#4e4858";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(folds[0], folds[1]);
    for (let i = 2; i < folds.length; i += 2) ctx.lineTo(folds[i], folds[i + 1]);
    ctx.stroke();
    // The lit edge of each fold, and the dashed line down its middle.
    ctx.lineWidth = 0.18;
    for (let i = 0; i + 3 < folds.length; i += 2) {
      const [ax, ay, bx, by] = folds.slice(i, i + 4);
      ctx.strokeStyle = i % 4 ? "#2a2632" : "#8a8494";
      line(ctx, ax, ay - 0.55, bx, by - 0.55);
      ctx.strokeStyle = "#d8c870";
      for (let k = 0.2; k < 0.9; k += 0.3) line(ctx, mix(ax, bx, k), mix(ay, by, k), mix(ax, bx, k + 0.12), mix(ay, by, k + 0.12));
    }
    ctx.strokeStyle = "#d8c870";
    for (let k = 0.1; k < 0.9; k += 0.2) line(ctx, mix(58, 37, k), mix(42.6, 39.2, k), mix(58, 37, k + 0.08), mix(42.6, 39.2, k + 0.08));
  }

  // A rusted iron fence along the back of the lawn, spear-topped posts on two
  // rails, a few bent or gone; a gap at the gate, and none behind the house.
  function fence(ctx, x0, x1, end) {
    const top = 41;
    const foot = 48;
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.28;
    for (const [a, b] of [[0, GATE_X - 6.4], [GATE_X + 6.4, end]]) {
      const lo = Math.max(a, x0 - 1);
      const hi = Math.min(b, x1 + 1);
      if (hi <= lo) continue;
      line(ctx, lo, 42.4, hi, 42.4);
      line(ctx, lo, 46, hi, 46);
      for (let x = Math.ceil(lo / 2.4) * 2.4; x < hi; x += 2.4) {
        const h = hash(Math.round(x / 2.4), 13);
        if (h % 9 === 0) continue;
        const lean = h % 7 === 0 ? ((h % 3) - 1) * 0.9 : 0;
        ctx.strokeStyle = h % 4 ? IRON : IRON_LIT;
        line(ctx, x, foot, x + lean, top + (h % 5 === 0 ? 1.2 : 0));
        ctx.fillStyle = ctx.strokeStyle;
        poly(ctx, [x + lean - 0.35, top + 0.4, x + lean, top - 0.7, x + lean + 0.35, top + 0.4]);
        ctx.fill();
      }
      ctx.strokeStyle = IRON;
    }
  }

  // The broken gate: two stone pillars with ball caps, one leaf hanging off
  // its hinge, the other fallen in the grass.
  function brokenGate(ctx, x0, x1) {
    if (x1 < GATE_X - 10 || x0 > GATE_X + 10) return;
    for (const s of [-1, 1]) {
      const px = GATE_X + s * 6.4;
      ctx.fillStyle = STONE;
      ctx.fillRect(px - 1.2, 38.6, 2.4, 9.6);
      ctx.fillStyle = STONE_LIT;
      ctx.fillRect(px - 1.2, 38.6, 0.5, 9.6);
      ctx.fillStyle = "#2a262c";
      ctx.fillRect(px - 1.5, 38, 3, 0.8);
      ctx.fillStyle = STONE;
      circle(ctx, px, 37.2, 1);
      ctx.fill();
      ctx.fillStyle = "#1e1a20";
      for (let k = 0; k < 4; k++) ctx.fillRect(px - 1.2, 40.4 + k * 2, 2.4, 0.12);
    }
    // The hanging leaf, swung down off its top hinge.
    ctx.save();
    ctx.translate(GATE_X - 5.2, 40);
    rotate(ctx, 0.5);
    ctx.strokeStyle = IRON_LIT;
    ctx.lineWidth = 0.26;
    ctx.strokeRect(0, 0, 5, 6.4);
    for (let k = 1; k < 5; k++) line(ctx, k, 0, k, 6.4);
    line(ctx, 0, 6.4, 5, 0);
    ctx.restore();
    // The fallen leaf, flat in the weeds.
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.24;
    line(ctx, GATE_X + 0.5, 47.6, GATE_X + 6, 47.9);
    line(ctx, GATE_X + 0.8, 46.9, GATE_X + 5.6, 47.2);
    for (let k = 0; k < 5; k++) line(ctx, GATE_X + 1 + k * 1.1, 46.9, GATE_X + 1.1 + k * 1.1, 47.8);
  }

  // A leaning headstone, rounded at the top, mossy at the foot.
  function grave(ctx, x, n) {
    const lean = ((hash(n, 3) % 5) - 2) * 0.09;
    const h = 3.6 + (hash(n, 5) % 3) * 0.8;
    ctx.save();
    ctx.translate(x, 48.2);
    rotate(ctx, lean);
    ctx.fillStyle = "#3e3a46";
    roundRect(ctx, -1.4, -h, 2.8, h, [1.4, 1.4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#5a5662";
    ctx.fillRect(-1.4, -h + 1.2, 0.4, h - 1.2);
    ctx.fillStyle = "#24202a";
    ctx.fillRect(-0.8, -h + 1.4, 1.6, 0.2);
    ctx.fillRect(-0.6, -h + 2, 1.2, 0.2);
    ctx.fillStyle = "#2c3a1e";
    ellipse(ctx, 0, 0, 1.8, 0.5);
    ctx.fill();
    ctx.restore();
  }

  // The mailbox by the drive, stuffed so full its lid will not shut: letters
  // fanned out of it and fallen under it, the flag still up. (The ending's
  // FINAL NOTICE lands here.)
  function mailbox(ctx, x0, x1) {
    const x = MAILBOX_X;
    if (x1 < x - 8 || x0 > x + 8) return;
    ctx.fillStyle = "#2a1e14";
    ctx.fillRect(x - 0.4, 41, 0.8, 7.2);
    ctx.fillRect(x - 2, 40.8, 4, 0.6);
    // Letters fallen under it.
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.translate(x - 4 + k * 1.7, 47.8);
      rotate(ctx, ((hash(k, 77) % 7) - 3) * 0.14);
      ctx.fillStyle = k % 2 ? "#e0d8c0" : "#c8bc98";
      ctx.fillRect(-0.8, -0.45, 1.6, 0.9);
      ctx.restore();
    }
    // The box, a rounded tin tunnel, rusting, its mouth to the left.
    ctx.fillStyle = "#4a4650";
    roundRect(ctx, x - 3.2, 37, 6.4, 3.8, [1.9, 1.9, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#6a6672";
    roundRect(ctx, x - 3.2, 37, 6.4, 1, [1.9, 1.9, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#6a3a22";
    ctx.globalAlpha = 0.55;
    ellipse(ctx, x + 1.2, 39.8, 1.4, 0.6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#1a161c";
    ctx.fillRect(x - 3.3, 37.6, 0.3, 3.2);
    // The bundle bursting out of its mouth, envelopes every way.
    for (let k = 0; k < 6; k++) {
      ctx.save();
      ctx.translate(x - 3.4, 38.2 + k * 0.42);
      rotate(ctx, -0.35 + k * 0.14 + ((hash(k, 5) % 3) - 1) * 0.08);
      ctx.fillStyle = k % 2 ? "#ece4cc" : "#cfc39f";
      ctx.fillRect(-2.2 - (k % 3) * 0.3, -0.42, 2.8, 0.84);
      ctx.strokeStyle = "#8a8070";
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(-2.2 - (k % 3) * 0.3, -0.42);
      ctx.lineTo(-0.8, 0.05);
      ctx.lineTo(0.6, -0.42);
      ctx.stroke();
      if (k === 1 || k === 4) {
        ctx.fillStyle = "#a02a1a";
        ctx.fillRect(-1.8, 0.05, 0.9, 0.22);
      }
      ctx.restore();
    }
    // Its door, sprung open and hanging under the mouth.
    ctx.fillStyle = "#3a3640";
    poly(ctx, [x - 3.3, 40.8, x - 4.6, 42.6, x - 4.2, 42.8, x - 3, 41]);
    ctx.fill();
    // The flag, up.
    ctx.fillStyle = "#2a1e14";
    ctx.fillRect(x + 2.6, 36, 0.26, 3.4);
    ctx.fillStyle = "#b02a1a";
    ctx.fillRect(x + 2.86, 36, 1.4, 1);
  }

  // The dead oak at OAK_X: a black trunk flared at its roots, a limb out to
  // the near end of each branch (the shelves draw the branches themselves),
  // and a crown of bare twigs against the cloud.
  function oak(ctx, v, x0, x1) {
    if (x1 < OAK_X - 30 || x0 > OAK_X + 30) return;
    const { spec, g } = v;
    const H = g.FIELD_H;
    // The limbs to each branch the trunk does not run through.
    ctx.fillStyle = OAK;
    for (const [a, b, y] of spec.shelves) {
      const sy = H - y;
      if (a <= OAK_X && b >= OAK_X) continue;
      const toward = b < OAK_X ? b : a;
      const side = b < OAK_X ? -1 : 1;
      const from = OAK_X + side * 1.6;
      limb(ctx, from, sy - 2.4, toward - side * 0.6, sy + 0.8, 2.6, 1.6, side * 0.6);
      ctx.fill();
    }
    // The trunk.
    ctx.fillStyle = OAK;
    poly(ctx, [135.6, 48.6, 139.4, 46.6, 140.4, 40, 141.1, 30, 141.7, 20, 142.3, 12, 142.8, 7, 143.6, 7, 144.3, 12, 144.9, 20, 145.5, 30, 146.2, 40, 147.2, 46.6, 151, 48.6]);
    ctx.fill();
    // Moonlight down its left side, bark furrows, a knot hole.
    ctx.fillStyle = OAK_LIT;
    poly(ctx, [137.6, 48.4, 139.8, 46.6, 140.8, 40, 141.5, 30, 142, 20, 142.6, 12, 142.9, 8, 142.4, 12, 141.9, 20, 141.3, 30, 140.6, 40, 139.6, 46.8]);
    ctx.fill();
    ctx.strokeStyle = "#0c0a08";
    ctx.lineWidth = 0.18;
    for (let k = 0; k < 6; k++) {
      const bx = 141.6 + k * 0.55;
      ctx.beginPath();
      ctx.moveTo(bx, 46);
      ctx.quadraticCurveTo(bx + 0.3, 30 + k, bx + 0.1 + (k - 3) * 0.12, 14 + k * 1.4);
      ctx.stroke();
    }
    ctx.fillStyle = "#050404";
    ellipse(ctx, 144.4, 38, 0.6, 0.9);
    ctx.fill();
    // Roots into the grass.
    ctx.fillStyle = OAK;
    limb(ctx, 139, 47.6, 133.4, 48.5, 1.2, 0.3, -0.4);
    ctx.fill();
    limb(ctx, 147.4, 47.6, 153, 48.6, 1.2, 0.3, 0.4);
    ctx.fill();
    // The crown: bare limbs forking up into twigs.
    const crown = [[143.2, 8, 138.4, 2.4, 1.1, -0.6], [143.2, 8, 148.4, 1.6, 1.1, 0.6], [143, 9, 141.6, -0.5, 0.8, 0.3], [142.6, 12, 136.8, 7.6, 0.9, -0.8], [144.4, 15, 149.6, 9.6, 0.8, 0.7]];
    crown.forEach(([ax, ay, bx, by, w, bend], i) => {
      limb(ctx, ax, ay, bx, by, w, 0.18, bend);
      ctx.fill();
      ctx.strokeStyle = OAK;
      ctx.lineWidth = 0.16;
      for (let k = 0; k < 3; k++) {
        const t = 0.45 + k * 0.2;
        const tx = mix(ax, bx, t);
        const ty = mix(ay, by, t);
        const dir = (hash(i, k) % 2 ? 1 : -1) * (bx > ax ? 1 : -1);
        line(ctx, tx, ty, tx + dir * (1 + rnd(i, k + 5) * 1.4), ty - 1.2 - rnd(k, i) * 1.2);
      }
    });
  }

  // The lawn's backdrop, x0 to x1: the storm, the folded road, the fence,
  // tall weeds along the drive, the gate, graves, the mailbox and the oak.
  function backdrop(ctx, v, look, x0, x1) {
    const { spec } = v;
    stormSky(ctx, v, look, x0, x1);
    foldedRoad(ctx, x0, x1);
    fence(ctx, x0, x1, spec.length - 39);
    // Tall weeds along the fence foot, thickest down the overgrown drive.
    ctx.fillStyle = "#141c0e";
    for (let x = Math.floor(x0 / 1.6) * 1.6; x < x1 + 2; x += 1.6) {
      const n = Math.round(x / 1.6);
      const h = hash(n, 61);
      const tall = (x < 114 ? 2.2 : 1.2) + (h % 5) * 0.5;
      poly(ctx, [x - 0.5, 48.4, x + ((h % 3) - 1) * 0.5, 48.4 - tall, x + 0.6, 48.4]);
      ctx.fill();
    }
    brokenGate(ctx, x0, x1);
    for (const [gx, n] of GRAVES) if (gx > x0 - 4 && gx < x1 + 4) grave(ctx, gx, n);
    mailbox(ctx, x0, x1);
    oak(ctx, v, x0, x1);
  }

  /* ----------------------------------------------------- floor, branches */

  // One floor piece, [a, b] with its top at `top`: black earth under long
  // wet grass, and the drive up to the porch a paler strip of old gravel and
  // puddles that the grass is taking back.
  function ground(ctx, v, look, a, b, top) {
    const { spec, g } = v;
    const fy = g.FIELD_H - top;
    ctx.fillStyle = look.floor;
    ctx.fillRect(a, fy, b - a, top);
    // Stones and roots in the earth.
    for (let x = Math.ceil(a / 2.3) * 2.3; x < b; x += 2.3) {
      const h = hash(Math.round(x / 2.3), 91);
      ctx.fillStyle = h % 3 ? "#1a1410" : "#24201c";
      ellipse(ctx, x + (h % 7) * 0.2, fy + 1.6 + (h % 4) * 1.1, 0.4 + (h % 3) * 0.2, 0.25);
      ctx.fill();
    }
    ctx.fillStyle = look.floorTop;
    ctx.fillRect(a, fy, b - a, 0.8);
    // The drive: gravel and two worn ruts, puddles in them shining.
    const d1 = Math.min(b, houseCenter(spec) - 3);
    if (d1 > a) {
      ctx.fillStyle = "#3e3a34";
      ctx.fillRect(a, fy, d1 - a, 0.75);
      ctx.fillStyle = "#56504a";
      for (let x = Math.ceil(a / 0.9) * 0.9; x < d1; x += 0.9) {
        const h = hash(Math.round(x / 0.9), 33);
        if (h % 3) ctx.fillRect(x + (h % 4) * 0.1, fy + 0.1 + (h % 5) * 0.12, 0.22, 0.14);
      }
      for (let x = Math.ceil(a / 13) * 13; x < d1 - 3; x += 13) {
        const h = hash(Math.round(x / 13), 7);
        if (h % 3 === 0) continue;
        const px = x + (h % 6);
        ctx.fillStyle = "#0a0c12";
        ellipse(ctx, px, fy + 0.25, 1.6 + (h % 3) * 0.4, 0.22);
        ctx.fill();
        ctx.fillStyle = "#8a90a8";
        ctx.globalAlpha = 0.35;
        ctx.fillRect(px - 0.8, fy + 0.18, 1.1, 0.08);
        ctx.globalAlpha = 1;
      }
    }
    // Long wet grass: blades leaning with the wind, shorter on the drive.
    for (let x = Math.ceil(a / 0.5) * 0.5; x < b; x += 0.5) {
      const n = Math.round(x * 2);
      const h = hash(n, 17);
      const onDrive = x < d1 && h % 4 !== 0;
      const tall = onDrive ? 0.3 + (h % 3) * 0.2 : 0.9 + (h % 6) * 0.35;
      ctx.fillStyle = h % 3 === 0 ? GRASS_LIT : GRASS;
      poly(ctx, [x - 0.22, fy + 0.4, x - 0.5 - (h % 3) * 0.2, fy - tall, x + 0.22, fy + 0.4]);
      ctx.fill();
      if (h % 5 === 0 && !onDrive) {
        ctx.fillStyle = GRASS_WET;
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x - 0.55 - (h % 3) * 0.2, fy - tall, 0.14, 0.3);
        ctx.globalAlpha = 1;
      }
    }
  }

  // One shelf: a branch of the oak, thick where it leaves the trunk and
  // tapering out to its tip, flat enough on top to stand on, bark furrows
  // along it, and twigs at the tip. `y` is its top on screen.
  function shelf(ctx, v, look, a, b, y) {
    const root = clamp(OAK_X, a, b);
    const reach = Math.max(1, root - a, b - root);
    const thick = (x) => 2.1 - 1.2 * (Math.abs(x - root) / reach);
    const pts = [];
    for (let x = a; x <= b + 0.01; x += 1) pts.push(Math.min(x, b), y + ((hash(Math.round(x), 3) % 3) - 1) * 0.06);
    for (let x = b; x >= a - 0.01; x -= 1) {
      const px = Math.max(x, a);
      pts.push(px, y + thick(px) + Math.sin(((px - a) / (b - a)) * Math.PI) * 0.3);
    }
    ctx.fillStyle = look.shelf;
    poly(ctx, pts);
    ctx.fill();
    // Rounded tips where the branch ends in the air.
    for (const end of [a, b]) {
      if (Math.abs(end - root) < 0.5) continue;
      ctx.fillStyle = look.shelf;
      ellipse(ctx, end, y + thick(end) / 2, 0.5, thick(end) / 2);
      ctx.fill();
    }
    // The moonlit top and the furrows.
    ctx.fillStyle = look.shelfTop;
    ctx.fillRect(a, y, b - a, 0.4);
    ctx.strokeStyle = "#120c08";
    ctx.lineWidth = 0.14;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      const fy = y + 0.7 + k * 0.4;
      ctx.moveTo(a + 0.6, fy);
      for (let x = a + 0.6; x < b - 0.6; x += 2) ctx.lineTo(x, fy + Math.sin(x * 1.3 + k) * 0.12 * thick(x));
      ctx.stroke();
    }
    for (let x = a + 3; x < b - 2; x += 5) {
      const h = hash(Math.round(x * 3), 29);
      if (h % 2) continue;
      ctx.fillStyle = "#120c08";
      ellipse(ctx, x, y + thick(x) * 0.55, 0.35, 0.25);
      ctx.fill();
    }
    // Twigs at the tips, reaching out and up.
    ctx.strokeStyle = look.shelf;
    for (const end of [a, b]) {
      if (Math.abs(end - root) < 0.5) continue;
      const dir = end < root ? -1 : 1;
      ctx.lineWidth = 0.3;
      line(ctx, end, y + 0.4, end + dir * 1.8, y - 1.4);
      ctx.lineWidth = 0.2;
      line(ctx, end + dir * 1.1, y - 0.6, end + dir * 2.2, y - 0.4);
      line(ctx, end + dir * 1.5, y - 1.0, end + dir * 1.6, y - 2.2);
      line(ctx, end - dir * 0.4, y + 0.9, end + dir * 1.2, y + 2);
    }
  }

  /* ------------------------------------------------------------ weather */

  // What drifts and flashes over the still sky each frame: a few torn rags
  // of cloud crossing slowly, and, in a flash of lightning (`v.lightning`),
  // the sky washed pale with a bolt down to the hills.
  function moving(ctx, v, cam) {
    if (!ours(v)) return;
    const W = v.g.FIELD_W;
    const t = v.clock;
    ctx.fillStyle = "#2a2034";
    for (let k = 0; k < 4; k++) {
      const span = W + 50;
      const x = cam + ((((hash(k, 5) % 97) + t * (0.0012 + k * 0.0004) - cam * 0.2) % span) + span) % span - 25;
      ctx.globalAlpha = 0.35;
      ellipse(ctx, x, 3 + (hash(k, 9) % 6), 9 + (hash(k, 7) % 6), 1 + (k % 2) * 0.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    const flash = v.lightning || 0;
    if (flash <= 0) return;
    ctx.fillStyle = "#c8c0ff";
    ctx.globalAlpha = 0.2 * flash;
    ctx.fillRect(cam - 1, 0, W + 2, 40);
    ctx.globalAlpha = 1;
    // Which bolt: the moment it started (the clock less its time so far).
    const fx = v.fx || {};
    const seed = Math.round((t - (650 - (fx.bolt || 0))) / 50);
    let bx = cam + 8 + (hash(seed, 3) % 80);
    let by = 0;
    ctx.strokeStyle = "#f0ecff";
    ctx.globalAlpha = Math.min(1, flash * 1.4);
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    for (let k = 0; k < 9; k++) {
      bx += ((hash(seed, k + 10) % 9) - 4) * 0.6;
      by += 3.6 + (hash(k, seed) % 3) * 0.6;
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The rain, slanting down over everything (YOU included), thinner while the
  // house plays dead; splashes where it hits the lawn.
  function front(ctx, v) {
    if (!ours(v) || !v.round) return;
    const round = v.round;
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    const cam = round.camX;
    const t = v.clock;
    const b = round.boss;
    const hush = b && b.kind === "marrow" && b.state === "down" && b.t >= FALSE_AT && b.t < LAUGH_AT;
    const n = hush ? 34 : 110;
    ctx.strokeStyle = RAIN;
    ctx.lineWidth = 0.12;
    for (let i = 0; i < n; i++) {
      const fall = 0.06 + (hash(i, 3) % 5) * 0.006;
      const y = ((((hash(i, 9) % 600) / 10 + t * fall) % 60) + 60) % 60 - 3;
      const x = cam + ((((hash(i, 7) % 1000) / 10 - y * 0.3) % (W + 4)) + W + 4) % (W + 4) - 2;
      ctx.globalAlpha = 0.18 + (i % 3) * 0.08;
      line(ctx, x, y, x - 0.5, y + 1.7);
    }
    ctx.globalAlpha = 0.5;
    const fy = H - 6;
    for (let i = 0; i < (hush ? 6 : 18); i++) {
      const p = ((t / 380 + (hash(i, 21) % 100) / 100) % 1);
      const x = cam + (hash(i, 23 + Math.floor(t / 380 + (hash(i, 21) % 100) / 100)) % (W * 10)) / 10;
      ctx.globalAlpha = 0.45 * (1 - p);
      ellipse(ctx, x, fy - 0.1, 0.25 + p * 0.6, 0.1 + p * 0.12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------- the house */

  // How far the door (its mouth) stands open, eased in and out on the clock
  // as `b.mouth` changes; kept off the rules' state, by boss object. (The
  // only state this file keeps, and it is only the drawing's.)
  const mouths = new WeakMap();
  function mouthOf(v, b) {
    // On a card, a grin: the door ajar on its teeth.
    if (!v.round) return 0.4;
    const was = mouths.get(b) || { open: 0, at: v.clock };
    const dt = clamp(v.clock - was.at, 0, 120);
    const open = clamp(was.open + (b.mouth ? dt / 160 : -dt / 220), 0, 1);
    mouths.set(b, { open, at: v.clock });
    return ease(open);
  }

  // What state each window is in: the rules' (round.marrow) in the fight; a
  // sleeping house watches with its eyes only; with no round at all (the
  // cards) every window is lit. After LAUGH_AT one eye burns red.
  function windowStates(v, b) {
    const round = v.round;
    const m = round && round.marrow && (round.marrow.room === undefined || round.marrow.room === round.room) ? round.marrow : null;
    const states = WINDOWS.map(([row], i) => {
      const s = m && m.windows[i] ? m.windows[i].state : "lit";
      // Asleep, it still watches YOU come up the drive.
      if (round && (b.state === "sleep" || b.state === "intro") && row === 3 && s !== "out") return "lit";
      return s;
    });
    if (b.state === "down" && (b.t || 0) >= LAUGH_AT) states[WINDOWS.length - 1] = "red";
    return states;
  }

  // The rotting clapboard of a wall [x0, x1] from `lo` to `hi` (heights):
  // board lines sagging in the middle, alternate boards a shade off, rot
  // and wet streaks.
  function clapboard(ctx, x0, x1, lo, hi, sag, seed) {
    ctx.fillStyle = CLAP;
    ctx.fillRect(x0, -hi, x1 - x0, hi - lo);
    const w = x1 - x0;
    for (let u = lo + 1.1, k = 0; u < hi - 0.2; u += 1.1, k++) {
      if (k % 2) {
        ctx.fillStyle = CLAP_LIT;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(x0, -u);
        for (let x = x0; x <= x1 + 0.01; x += w / 6) ctx.lineTo(x, -u + Math.sin(((x - x0) / w) * Math.PI) * sag);
        for (let x = x1; x >= x0 - 0.01; x -= w / 6) ctx.lineTo(x, -u - 1.1 + Math.sin(((x - x0) / w) * Math.PI) * sag);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = CLAP_DARK;
      ctx.lineWidth = 0.16;
      ctx.beginPath();
      ctx.moveTo(x0, -u);
      for (let x = x0; x <= x1 + 0.01; x += w / 6) ctx.lineTo(x, -u + Math.sin(((x - x0) / w) * Math.PI) * sag);
      ctx.stroke();
    }
    // Wet streaks down from the eaves, rot blotches low down.
    for (let x = x0 + 1; x < x1 - 0.5; x += 2.3) {
      const h = hash(seed + Math.round(x * 4), 19);
      if (h % 3) continue;
      ctx.fillStyle = WET;
      ctx.globalAlpha = 0.16;
      ctx.fillRect(x, -hi, 0.5, (hi - lo) * (0.4 + (h % 5) * 0.12));
      ctx.globalAlpha = 1;
    }
    for (let x = x0 + 1.5; x < x1 - 1; x += 3.7) {
      const h = hash(seed + Math.round(x * 3), 23);
      if (h % 3) continue;
      ctx.fillStyle = "#16100e";
      ctx.globalAlpha = 0.5;
      ellipse(ctx, x, -(lo + 0.8 + (h % 5) * 0.9), 0.9 + (h % 3) * 0.4, 0.5);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // A row of scalloped shingles across [x0, x1] at height u, each lifted in
  // a wave while the roof is shaking loose (`wave` 0 to 1).
  function shingleRow(ctx, x0, x1, u, row, t, wave) {
    for (let x = x0, k = 0; x < x1 - 0.1; x += 1.5, k++) {
      const lift = wave > 0 ? Math.max(0, Math.sin(t / 80 - k * 0.7 - row * 1.1)) * 0.9 * wave : 0;
      const w = Math.min(1.5, x1 - x);
      if (lift > 0.05) {
        ctx.fillStyle = "#06050a";
        ctx.fillRect(x, -u - 1.3, w, 1.3);
      }
      ctx.fillStyle = (hash(k, row + 40) % 4 === 0) ? SHINGLE_LIT : SHINGLE;
      roundRect(ctx, x + 0.05, -u - 1.4 - lift, w - 0.1, 1.5, [0, 0, 0.6, 0.6]);
      ctx.fill();
    }
  }

  // Where a window's pupil is (house frame): turned toward YOU, or a little
  // to the left on a card.
  function pupilAt(v, dx, up) {
    const you = v.round && v.round.you;
    const wx = (v.round && v.spec ? houseCenter(v.spec) : 0) + dx;
    const turn = you ? clamp((you.x - wx) / 30, -1, 1) : -0.3;
    const lookY = you && v.round.boss ? clamp((you.y - (v.round.boss.y + up + WINDOW_H / 2)) / 30, -1, 1) : 0;
    return [dx + turn * (WINDOW_W / 2 - 1.1), -up - WINDOW_H / 2 - lookY * 0.8];
  }

  // One window, `s` its state, its bottom at height `up` and its middle `dx`
  // off the house's center: the frame, then lit glass with a slit pupil
  // turned toward YOU, closed gray shutters, or (shot out) black with glass
  // teeth round the frame, soot above and a wisp of smoke.
  function windowPane(ctx, v, s, dx, up, row, id) {
    const x = dx - WINDOW_W / 2;
    const y = -up - WINDOW_H;
    const eyeRow = row === 3;
    if (s === "out") {
      ctx.fillStyle = SOOT;
      ctx.globalAlpha = 0.6;
      poly(ctx, [x - 0.3, y, dx - 1.2, y - 2.6, dx + 0.4, y - 3.4, dx + 1.6, y - 2.2, x + WINDOW_W + 0.3, y]);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // The frame and its sill.
    ctx.fillStyle = s === "out" ? "#2a2228" : TRIM;
    ctx.fillRect(x - 0.5, y - 0.5, WINDOW_W + 1, WINDOW_H + 1);
    ctx.fillStyle = s === "out" ? "#18121a" : TRIM_DARK;
    ctx.fillRect(x - 0.8, -up + 0.3, WINDOW_W + 1.6, 0.5);
    ctx.fillRect(x - 0.7, y - 1, WINDOW_W + 1.4, 0.55);
    if (s === "lit" || s === "red") {
      const red = s === "red";
      ctx.fillStyle = red ? "#7a0a08" : GLASS_LOW;
      ctx.fillRect(x, y, WINDOW_W, WINDOW_H);
      ctx.fillStyle = red ? "#c81a10" : GLASS;
      ctx.fillRect(x, y, WINDOW_W, WINDOW_H * 0.62);
      ctx.fillStyle = red ? "#ff4a2a" : GLASS_HOT;
      ctx.globalAlpha = 0.65 + 0.2 * Math.sin(v.clock / (90 + id * 7) + id);
      ctx.fillRect(x + 0.3, y + 0.3, WINDOW_W - 0.6, WINDOW_H * 0.28);
      ctx.globalAlpha = 1;
      const [px, py] = pupilAt(v, dx, up);
      if (eyeRow) {
        ctx.fillStyle = red ? "#ff7a3a" : "#e0561a";
        ellipse(ctx, px, py, 1.6, 2.6);
        ctx.fill();
      }
      ctx.fillStyle = PUPIL;
      ellipse(ctx, px, py, eyeRow ? 0.5 : 0.42, eyeRow ? 2.4 : 2.3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.globalAlpha = 0.8;
      circle(ctx, px - 0.6, py - 1.1, 0.22);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (s === "dark") {
      // Two shutters, slatted, a thread of light where they meet.
      ctx.fillStyle = SHUTTER;
      ctx.fillRect(x, y, WINDOW_W, WINDOW_H);
      for (let k = 0; k < 8; k++) {
        const sy = y + 0.35 + k * 0.76;
        ctx.fillStyle = SHUTTER_DARK;
        ctx.fillRect(x + 0.2, sy + 0.44, WINDOW_W - 0.4, 0.2);
        ctx.fillStyle = SHUTTER_LIT;
        ctx.fillRect(x + 0.2, sy, WINDOW_W - 0.4, 0.14);
      }
      ctx.fillStyle = "#1a181e";
      ctx.fillRect(dx - 0.18, y, 0.36, WINDOW_H);
      ctx.fillStyle = "#ffcf6a";
      ctx.globalAlpha = 0.3 + 0.15 * Math.sin(v.clock / 300 + id * 2);
      ctx.fillRect(dx - 0.07, y + 0.4, 0.14, WINDOW_H - 0.8);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#24222a";
      ctx.fillRect(x - 0.1, y + 1, 0.4, 0.4);
      ctx.fillRect(x + WINDOW_W - 0.3, y + WINDOW_H - 1.4, 0.4, 0.4);
    } else {
      // Shot out for good: black, glass teeth all round the frame.
      ctx.fillStyle = "#020103";
      ctx.fillRect(x, y, WINDOW_W, WINDOW_H);
      ctx.fillStyle = SHARD;
      const teeth = (pts) => {
        poly(ctx, pts);
        ctx.fill();
      };
      ctx.globalAlpha = 0.9;
      for (let k = 0; k < 4; k++) {
        const h = hash(id * 7 + k, 51);
        const tx = x + 0.3 + k * 1.2;
        teeth([tx, y, tx + 1, y, tx + 0.3 + (h % 3) * 0.2, y + 1 + (h % 4) * 0.5]);
        teeth([tx, y + WINDOW_H, tx + 1.1, y + WINDOW_H, tx + 0.6, y + WINDOW_H - 0.7 - (h % 3) * 0.5]);
      }
      for (let k = 0; k < 3; k++) {
        const h = hash(id * 5 + k, 53);
        const ty = y + 0.5 + k * 2;
        teeth([x, ty, x, ty + 1.6, x + 0.8 + (h % 3) * 0.4, ty + 0.5]);
        teeth([x + WINDOW_W, ty + 0.3, x + WINDOW_W, ty + 1.8, x + WINDOW_W - 0.9 - (h % 3) * 0.3, ty + 1.2]);
      }
      ctx.globalAlpha = 1;
      // The broken muntin hanging.
      ctx.strokeStyle = "#2a2228";
      ctx.lineWidth = 0.28;
      line(ctx, dx, y, dx + 0.6, y + 2.2);
    }
  }

  // The smoke off a window shot out (drawn over the house, rising).
  function windowSmoke(ctx, v, dx, up, id) {
    const top = -up - WINDOW_H - 0.6;
    ctx.fillStyle = "#6a6470";
    for (let k = 0; k < 4; k++) {
      const p = ((v.clock / 1600 + k / 4 + id * 0.13) % 1);
      ctx.globalAlpha = 0.28 * (1 - p);
      circle(ctx, dx + Math.sin(p * 5 + id) * 0.8 - p * 1.5, top - p * 6, 0.5 + p * 1.1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The front door, the house's mouth: shut, dark planks and a brass knocker;
  // opening (`open` 0 to 1), the leaf swings in on red dark, teeth above and
  // below, the carpet's root lying in it, and on the doormen's call two pairs
  // of eyes in there.
  function mouth(ctx, v, b, open) {
    const W = 8;
    const Ht = 10;
    ctx.fillStyle = TRIM_DARK;
    arch(ctx, 0, 0.01, W + 1.4, Ht + 0.7);
    ctx.fill();
    ctx.fillStyle = MOUTH;
    arch(ctx, 0, 0, W, Ht);
    ctx.fill();
    if (open > 0.02) {
      ctx.fillStyle = MOUTH_RED;
      ctx.globalAlpha = 0.5 + 0.4 * open;
      ellipse(ctx, 0, -2.4, 3.2, 2.6);
      ctx.fill();
      ctx.globalAlpha = 1;
      // The carpet's root: a tongue lying in the doorway.
      ctx.fillStyle = CARPET;
      ellipse(ctx, 0.4, -0.6, 3 * open + 0.4, 0.9);
      ctx.fill();
      ctx.fillStyle = CARPET_GOLD;
      ctx.fillRect(-2.4 * open, -1.25, 5 * open, 0.18);
      if (b.act === "doormenWind") {
        for (const [ex, ey] of [[-1.8, -6], [1.4, -5.2]]) {
          ctx.fillStyle = "#c8ff6a";
          circle(ctx, ex - 0.4, ey, 0.24);
          ctx.fill();
          circle(ctx, ex + 0.4, ey, 0.24);
          ctx.fill();
        }
      }
      // Teeth: a row hanging from the arch, a few up from the sill.
      ctx.fillStyle = TOOTH;
      for (let k = 0; k < 6; k++) {
        const tx = -3.4 + k * 1.36;
        const top = -Ht + 4 - Math.sqrt(Math.max(0, 16 - tx * tx)) + 0.2;
        poly(ctx, [tx - 0.6, top, tx + 0.6, top, tx, top + 1.5 * open + 0.2]);
        ctx.fill();
      }
      for (let k = 0; k < 4; k++) {
        const tx = -3 + k * 2;
        poly(ctx, [tx - 0.55, 0, tx + 0.55, 0, tx, -1.2 * open - 0.1]);
        ctx.fill();
      }
    }
    // The door leaf, hinged on the left, narrowing as it swings in.
    const lw = W * (1 - open * 0.86);
    if (lw > 0.2) {
      ctx.save();
      arch(ctx, 0, 0, W, Ht);
      if (typeof ctx.clip === "function") ctx.clip();
      ctx.fillStyle = DOOR;
      ctx.fillRect(-W / 2, -Ht, lw, Ht);
      ctx.strokeStyle = DOOR_DARK;
      ctx.lineWidth = 0.18;
      for (let k = 1; k < 4; k++) line(ctx, -W / 2 + (lw * k) / 4, -Ht, -W / 2 + (lw * k) / 4, 0);
      ctx.fillStyle = DOOR_DARK;
      ctx.fillRect(-W / 2, -7.4, lw, 0.4);
      ctx.fillRect(-W / 2, -2.6, lw, 0.4);
      ctx.restore();
      // The knocker, a brass ring through its nose.
      const kx = -W / 2 + lw * 0.78;
      ctx.strokeStyle = BRASS;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.arc(kx, -5, 0.65, 0, TAU);
      ctx.stroke();
    }
    // The lintel over it, like a lip.
    ctx.fillStyle = TRIM_DARK;
    ctx.fillRect(-W / 2 - 1.1, -Ht - 0.9, W + 2.2, 0.6);
  }

  // Cracks in the walls: one more for every window out, each from a fixed
  // place, zigzagging out (they only ever grow).
  const CRACKS = freeze([[-10, 8, 1], [12, 17, -1], [-15, 12, 1], [3, 19, 1], [-6, 26, -1], [15, 3, -1], [-3, 15, 1], [8, 9, 1], [-13, 24, 1], [6, 33, -1], [-7, 38, 1], [13, 22, -1]]);
  function cracks(ctx, out) {
    ctx.strokeStyle = "#0e080c";
    ctx.lineWidth = 0.22;
    for (let i = 0; i < Math.min(out, CRACKS.length); i++) {
      const [sx, su, dir] = CRACKS[i];
      let x = sx;
      let y = -su;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 6; k++) {
        x += dir * (0.4 + (hash(i, k) % 4) * 0.25);
        y += ((hash(k, i) % 5) - 1.5) * 0.7;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  // The house, Marrow, standing on its feet with its center at the house's
  // place (or at b.x on a card): walls, mansard, the gable tower with the eyes
  // and its shingled brow, chimneys, the weathervane, every window by state,
  // the door's mouth and the porch's teeth. It shudders when hit, breathes,
  // rears by b.lift; once down it sags, laughs with one red eye and sinks.
  function marrow(ctx, v, b) {
    if (b.gone) return;
    const cx = b.placed && v.spec ? houseCenter(v.spec) : b.x;
    const fy = v.g.FIELD_H - b.y;
    const t = v.clock;
    const down = b.state === "down";
    const bt = b.t || 0;
    const states = windowStates(v, b);
    const out = states.filter((s) => s === "out").length;
    const sag = down ? ease(clamp(bt / 700, 0, 1)) : 0;
    const sink = down ? ease(clamp((bt - SINK_AT) / (GONE_AT - SINK_AT), 0, 1)) : 0;
    const shud = b.hurt > 0 ? Math.sin(t / 14) * 0.45 * Math.min(1, b.hurt / 120) : 0;
    const quiver = down && bt >= SINK_AT ? Math.sin(t / 21) * 0.35 : 0;
    const cough = b.act === "brickWind" ? Math.sin(t / 25) * 0.25 : 0;
    const lift = b.lift || 0;
    const breath = down ? 0 : Math.sin(t / 760);
    const open = mouthOf(v, b);
    const roofWave = b.act === "roof" ? 1 : b.act === "stompWind" ? 0.5 : 0;
    const was = ctx.globalAlpha;
    // The shadow it casts, wider when it rears off the ground.
    if (sink < 1) {
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = was * (0.45 - lift * 0.06) * (1 - sink);
      ellipse(ctx, cx, fy + 0.2, 20 - lift * 0.6, 0.9);
      ctx.fill();
      ctx.globalAlpha = was;
    }
    ctx.save();
    if (sink > 0) {
      ctx.beginPath();
      ctx.rect(cx - 40, fy - 90, 80, 90);
      if (typeof ctx.clip === "function") ctx.clip();
    }
    ctx.translate(cx + shud + quiver, fy + sag * 1.6 + sink * 44 - lift);
    if (sag > 0 && typeof ctx.transform === "function") ctx.transform(1, 0, 0.07 * sag, 1 - 0.03 * sag, 0, 0);
    ctx.scale(1 + 0.004 * breath, 1 + 0.012 * breath);
    // Its footings, showing while it rears.
    if (lift > 0.05) {
      ctx.fillStyle = STONE;
      for (const fx of [-15, -6, 6, 15]) ctx.fillRect(fx - 1.4, 0, 2.8, lift + 0.3);
      ctx.fillStyle = "#1a1418";
      for (const fx of [-15, -6, 6, 15]) ctx.fillRect(fx - 1.4, lift - 0.4, 2.8, 0.7);
    }
    // Chimneys, behind the roof: the left on the mansard, the right (the
    // bricks' mouth, dx 9 up 42) beside the tower.
    ctx.fillStyle = "#3a1e1a";
    ctx.fillRect(-15.2, -38.4, 3, 9);
    ctx.fillRect(8.2 + cough, -45, 3, 16);
    ctx.fillStyle = "#24120e";
    ctx.fillRect(-15.6, -39, 3.8, 0.9);
    ctx.fillRect(7.8 + cough, -45.6, 3.8, 0.9);
    ctx.fillStyle = "#5a2e24";
    for (let k = 0; k < 6; k++) ctx.fillRect(8.2 + cough + (k % 2) * 1.5, -44 + k * 1.2, 1.4, 0.12);
    if (b.act === "brickWind") {
      halo(ctx, 9.7 + cough, -45.4, 4, EMBER, 0.8);
      ctx.fillStyle = EMBER_HOT;
      ctx.fillRect(8.4 + cough, -45.8, 2.6, 0.4);
    }
    // Smoke off the right chimney, drifting left.
    ctx.fillStyle = "#4a4250";
    for (let k = 0; k < 4; k++) {
      const p = ((t / 1800 + k / 4) % 1);
      ctx.globalAlpha = was * (b.act === "brickWind" ? 0.5 : 0.22) * (1 - p);
      circle(ctx, 9.7 - p * 5, -46.4 - p * 3, 0.6 + p * 1.6);
      ctx.fill();
    }
    ctx.globalAlpha = was;
    // The mansard wings either side of the tower, shingled, iron cresting on top.
    ctx.fillStyle = ROOF;
    poly(ctx, [-18.4, -21, -16.4, -31.2, 16.4, -31.2, 18.4, -21]);
    ctx.fill();
    for (let r = 0; r < 7; r++) {
      const u = 21.2 + r * 1.45;
      const half = 18.4 - (u - 21) * 0.196;
      shingleRow(ctx, -half, -9, u, r, t, roofWave);
      shingleRow(ctx, 9, half, u, r + 9, t, roofWave);
    }
    ctx.strokeStyle = "#141018";
    ctx.lineWidth = 0.16;
    for (let x = -16; x <= 16; x += 1.2) {
      if (Math.abs(x) < 9) continue;
      line(ctx, x, -31.2, x, -32.2);
    }
    line(ctx, -16.4, -31.9, 16.4, -31.9);
    // The walls, then the cornice between them and the roof.
    clapboard(ctx, -17.6, 17.6, 0, 21, 0.25 + out * 0.04, 3);
    ctx.fillStyle = TRIM_DARK;
    ctx.fillRect(-18.9, -21.4, 37.8, 1.1);
    ctx.fillStyle = TRIM;
    ctx.fillRect(-18.9, -21.4, 37.8, 0.3);
    for (let x = -18; x < 18.5; x += 1.6) ctx.fillRect(x, -20.3, 0.5, 0.4);
    // Corner boards.
    ctx.fillStyle = WET;
    ctx.fillRect(-17.9, -20.4, 0.7, 20.4);
    ctx.fillRect(17.2, -20.4, 0.7, 20.4);
    // The tower, the face's forehead: clapboard up to its brow.
    clapboard(ctx, -9, 9, 21, 41.4, 0.12 + out * 0.02, 11);
    ctx.fillStyle = WET;
    ctx.fillRect(-9.3, -41.4, 0.6, 20.4);
    ctx.fillRect(8.7, -41.4, 0.6, 20.4);
    ctx.fillStyle = TRIM_DARK;
    ctx.fillRect(-9.6, -32.4, 19.2, 0.8);
    // The tower's steep roof, then the brow: a heavy shingled eave sloping
    // down over each eye toward the nose, a scowl.
    ctx.fillStyle = ROOF;
    poly(ctx, [-10.6, -42.4, 0, -46.4, 10.6, -42.4, 2.4, -41.2, 0, -41.8, -2.4, -41.2]);
    ctx.fill();
    for (let r = 0; r < 3; r++) {
      const u = 42.6 + r * 1.2;
      const half = 9.6 - (u - 42.4) * 2.4;
      if (half > 0.6) shingleRow(ctx, -half, half, u, r + 20, t, roofWave);
    }
    const scowl = down ? 0 : out >= 8 ? 0.6 : out >= 4 ? 0.3 : 0;
    ctx.fillStyle = "#0c0a10";
    poly(ctx, [-10.9, -43.1, -10.6, -42, -2.4, -40.7 + scowl, -0.2, -41.4, 0.2, -41.4, 2.4, -40.7 + scowl, 10.6, -42, 10.9, -43.1, 2.4, -42 + scowl, 0, -42.6, -2.4, -42 + scowl]);
    ctx.fill();
    ctx.fillStyle = SHINGLE_LIT;
    for (let k = 0; k < 8; k++) {
      const s = k < 4 ? -1 : 1;
      const p = (k % 4) / 4;
      const x = s * mix(10.2, 3, p);
      const y = mix(-42.6, -41.6 + scowl, p);
      ctx.fillRect(x - 0.5, y - 0.15, 1, 0.3);
    }
    // The weathervane, bent over on its rod.
    ctx.strokeStyle = "#5a4a3a";
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(0, -46.3);
    ctx.lineTo(0, -47.3);
    ctx.lineTo(-1.6, -47.7);
    ctx.stroke();
    ctx.fillStyle = "#5a4a3a";
    poly(ctx, [-1.6, -48.1, -2.4, -47.7, -1.6, -47.3]);
    ctx.fill();
    // The glow round every lit window, then the windows, the smoke off the
    // dead ones, and the cracks.
    WINDOWS.forEach(([row, dx, up], i) => {
      const s = states[i];
      if (s === "lit") halo(ctx, dx, -up - WINDOW_H / 2, row === 3 ? 7 : 5, GLASS, row === 3 ? 0.42 : 0.3);
      else if (s === "red") halo(ctx, dx, -up - WINDOW_H / 2, 8, RED_EYE, 0.55);
    });
    // The dormers framing the mansard's outer windows.
    for (const dx of [-13.5, 13.5]) {
      ctx.fillStyle = CLAP;
      ctx.fillRect(dx - 3.3, -30.4, 6.6, 8);
      ctx.fillStyle = ROOF;
      poly(ctx, [dx - 3.9, -30.2, dx, -33.2, dx + 3.9, -30.2]);
      ctx.fill();
      ctx.fillStyle = TRIM_DARK;
      ctx.fillRect(dx - 3.9, -30.6, 7.8, 0.5);
    }
    WINDOWS.forEach(([row, dx, up], i) => windowPane(ctx, v, states[i], dx, up, row, i));
    // The brow comes down over the inner corner of each eye: a scowl, deeper
    // as it loses windows.
    ctx.fillStyle = "#0c0a10";
    for (const s of [-1, 1]) {
      const inner = s * (5.5 - WINDOW_W / 2 - 0.5);
      const outer = s * (5.5 + WINDOW_W / 2 + 0.5);
      const top = -(34.2 + WINDOW_H + 0.5);
      poly(ctx, [inner - s * 0.4, top - 1, outer + s * 0.3, top - 1.2, outer + s * 0.3, top + 0.1, inner, top + 1.9 + scowl * 1.5]);
      ctx.fill();
    }
    cracks(ctx, out);
    WINDOWS.forEach(([, dx, up], i) => {
      if (states[i] === "out") windowSmoke(ctx, v, dx, up, i);
    });
    // The porch: a foundation strip, the mouth, and the pickets for its
    // lower teeth either side.
    ctx.fillStyle = STONE;
    ctx.fillRect(-18, -0.8, 36, 0.8);
    mouth(ctx, v, b, open);
    for (const s of [-1, 1]) {
      ctx.fillStyle = PICKET_SHADE;
      ctx.fillRect(s > 0 ? 5.2 : -17.6, -2.1, 12.4, 0.35);
      for (let k = 0; k < 9; k++) {
        const px = s * (5.8 + k * 1.4);
        const tip = 2.8 + (hash(k, s + 3) % 3) * 0.15;
        ctx.fillStyle = k % 3 === 2 ? PICKET_SHADE : PICKET;
        poly(ctx, [px - 0.42, 0, px - 0.42, -tip + 0.6, px, -tip, px + 0.42, -tip + 0.6, px + 0.42, 0]);
        ctx.fill();
      }
    }
    // The laugh's red eye burns through the dark.
    if (states[WINDOWS.length - 1] === "red") {
      const [, dx, up] = WINDOWS[WINDOWS.length - 1];
      const [px, py] = pupilAt(v, dx, up);
      const ex = cx + shud + quiver + px + 0.07 * sag * py;
      const ey = fy + sag * 1.6 + sink * 44 + py * (1 - 0.03 * sag);
      if (v.eyes && ey < fy) eye(v, ex, ey, 0.6, RED_EYE);
    }
    ctx.restore();
    ctx.globalAlpha = was;
    // Dust along the floor as it sags, and boiling up as it sinks.
    const dusty = down ? (bt < 1100 ? 1 - bt / 1100 : sink > 0 && sink < 1 ? 1 : 0) : 0;
    if (dusty > 0) {
      ctx.fillStyle = DUST;
      for (let k = 0; k < 16; k++) {
        const p = ((t / 900 + k / 16 + (hash(k, 9) % 10) / 30) % 1);
        ctx.globalAlpha = was * 0.4 * dusty * (1 - p);
        circle(ctx, cx - 21 + k * 2.8 + Math.sin(p * 4 + k) * 0.8, fy - 0.4 - p * 3.4, 0.9 + p * 1.6);
        ctx.fill();
      }
      ctx.globalAlpha = was;
    }
    // The false win: big gold words across the screen, and the laugh under it.
    if (down && v.round && bt >= FALSE_AT) {
      const round = v.round;
      const W = v.g.FIELD_W;
      const fade = bt > SINK_AT ? clamp(1 - (bt - SINK_AT) / 1100, 0, 1) : 1;
      if (fade > 0) {
        const p = clamp((bt - FALSE_AT) / 260, 0, 1);
        const pop = 0.7 + 0.3 * p + 0.18 * Math.sin(p * Math.PI);
        const choke = bt >= LAUGH_AT && bt < LAUGH_AT + 500 ? Math.sin(t / 18) * 0.5 : 0;
        const sx = round.camX + W / 2;
        ctx.globalAlpha = was * fade * Math.min(1, p * 2);
        label(ctx, "YOU ESCAPED!", sx + choke, 13, 7.5 * pop, GOLD, "center", W - 8, true);
        if (bt >= LAUGH_AT) {
          const q = clamp((bt - LAUGH_AT) / 900, 0, 1);
          const words = "...NOT YET";
          label(ctx, words.slice(0, Math.max(1, Math.ceil(q * words.length))), sx, 21.5, 4.4, RED_EYE, "center", W - 20, true);
        }
        ctx.globalAlpha = was;
      }
    }
  }

  /* ------------------------------------------------------------ hazards */

  // A slate off the roof: while it warns, its shadow on the lawn at h.floor,
  // darker and wider as it comes, and the loose slate trembling at the top;
  // then the slate tumbling down at h.y.
  function marrowShingle(ctx, v, h) {
    const H = v.g.FIELD_H;
    const fy = H - h.floor;
    const was = ctx.globalAlpha;
    const p = h.warn > 0 ? 1 - h.warn / (h.full || 1) : 1;
    const rx = 1 + p * 1.4;
    const ry = 0.4 + p * 0.3;
    if (h.warn > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(v.clock / 70);
      ctx.fillStyle = DANGER;
      ctx.globalAlpha = was * (0.2 + 0.25 * p + 0.1 * pulse);
      ellipse(ctx, h.x, fy, rx + 0.6, ry + 0.25);
      ctx.fill();
    }
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = was * (0.4 + 0.45 * p);
    ellipse(ctx, h.x, fy, rx, ry);
    ctx.fill();
    if (h.warn > 0) {
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.2;
      ctx.globalAlpha = was * (0.5 + 0.5 * p);
      ellipse(ctx, h.x, fy, rx + 0.6, ry + 0.25);
      ctx.stroke();
    }
    ctx.globalAlpha = was;
    let sy;
    let spin;
    if (h.warn > 0) {
      if (p < 0.4) return;
      sy = H - h.y + 1;
      spin = Math.sin(v.clock / 30 + h.x) * 0.15;
      ctx.globalAlpha = was * Math.min(1, (p - 0.4) * 3);
    } else {
      sy = H - h.y - h.h / 2;
      spin = (h.fall || 0) / 55 + (h.id || 0);
      // Streaks over it as it falls.
      ctx.strokeStyle = "#8a8494";
      ctx.lineWidth = 0.12;
      ctx.globalAlpha = was * 0.4;
      line(ctx, h.x - 0.8, sy - 1, h.x - 0.8, sy - 4);
      line(ctx, h.x + 0.8, sy - 1.4, h.x + 0.8, sy - 3.6);
      ctx.globalAlpha = was;
    }
    ctx.save();
    ctx.translate(h.x, sy);
    rotate(ctx, spin);
    ctx.fillStyle = SHINGLE;
    roundRect(ctx, -1.6, -0.5, 3.2, 1, [0, 0, 0.5, 0.5]);
    ctx.fill();
    ctx.fillStyle = SHINGLE_LIT;
    ctx.fillRect(-1.6, -0.5, 3.2, 0.25);
    ctx.fillStyle = "#0a080c";
    circle(ctx, -0.8, -0.1, 0.14);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = was;
  }

  // A picket: while it warns, the lawn ripples and the soil cracks where it
  // will come; then a white fence post bursts up with a tooth's point,
  // clods flying, and drops back as it ends.
  function marrowPicket(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const was = ctx.globalAlpha;
    if (h.warn > 0) {
      const p = 1 - h.warn / (h.full || 1);
      const pulse = 0.5 + 0.5 * Math.sin(v.clock / 70);
      ctx.fillStyle = DANGER;
      ctx.globalAlpha = was * (0.2 + 0.25 * p + 0.1 * pulse);
      ellipse(ctx, h.x, fy, 2, 0.6);
      ctx.fill();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.2;
      for (let k = 0; k < 2; k++) {
        const q = ((v.clock / 420 + k / 2) % 1);
        ctx.globalAlpha = was * (0.45 + 0.4 * p) * (1 - q);
        ellipse(ctx, h.x, fy, 0.8 + q * 2.2, 0.25 + q * 0.4);
        ctx.stroke();
      }
      ctx.globalAlpha = was;
      // The soil heaving up and splitting.
      ctx.fillStyle = EARTH_LIT;
      ellipse(ctx, h.x, fy, 1.5, 0.35 + p * 0.6);
      ctx.fill();
      ctx.fillStyle = EARTH;
      ellipse(ctx, h.x, fy + 0.15, 1.3, 0.25 + p * 0.45);
      ctx.fill();
      ctx.strokeStyle = "#050302";
      ctx.lineWidth = 0.18;
      for (let k = 0; k < 4; k++) {
        const a = -Math.PI * (0.15 + k * 0.23);
        line(ctx, h.x, fy - 0.1, h.x + Math.cos(a) * (0.4 + p * 1.3), fy - 0.1 + Math.sin(a) * (0.2 + p * 0.5));
      }
      if (p > 0.5) {
        ctx.fillStyle = PICKET;
        ctx.globalAlpha = was * (p - 0.5) * 2;
        poly(ctx, [h.x - 0.5, fy, h.x, fy - 0.6 * p, h.x + 0.5, fy]);
        ctx.fill();
        ctx.globalAlpha = was;
      }
      return;
    }
    if (!(h.live > 0)) return;
    const up = PICKET_UP_MS - h.live;
    const hh = h.h * Math.min(1, up / 70) * Math.min(1, h.live / 100);
    const w = 2.3;
    ctx.fillStyle = PICKET;
    poly(ctx, [h.x - w / 2, fy, h.x - w / 2, fy - hh + 1.1, h.x, fy - hh, h.x + w / 2, fy - hh + 1.1, h.x + w / 2, fy]);
    ctx.fill();
    ctx.fillStyle = PICKET_SHADE;
    poly(ctx, [h.x + 0.25, fy, h.x + 0.25, fy - hh + 0.7, h.x, fy - hh, h.x + w / 2, fy - hh + 1.1, h.x + w / 2, fy]);
    ctx.fill();
    ctx.strokeStyle = "#8a8070";
    ctx.lineWidth = 0.1;
    line(ctx, h.x - 0.4, fy - 0.4, h.x - 0.35, fy - hh + 1.6);
    // Torn turf round its foot, clods in the air.
    ctx.fillStyle = EARTH;
    ellipse(ctx, h.x, fy, 1.6, 0.45);
    ctx.fill();
    ctx.fillStyle = GRASS;
    for (const s of [-1, 1]) {
      poly(ctx, [h.x + s * 1.6, fy, h.x + s * 0.9, fy - 0.7, h.x + s * 0.7, fy]);
      ctx.fill();
    }
    if (up < 300) {
      ctx.fillStyle = EARTH_LIT;
      for (let k = 0; k < 5; k++) {
        const q = up / 300;
        const dx = ((k % 2 ? 1 : -1) * (0.6 + k * 0.4)) * q * 2;
        circle(ctx, h.x + dx, fy - q * (3 + k * 0.6) + q * q * 3, 0.22);
        ctx.fill();
      }
    }
  }

  // A brick coughed up out of the chimney: an arc from (h.sx, h.sy) to where
  // it lands (h.x, h.y) by 1 - warn/full, hot and trailing sparks, a target
  // ring where it will come down; then broken bits and embers there.
  function marrowBrick(ctx, v, h) {
    const H = v.g.FIELD_H;
    const was = ctx.globalAlpha;
    const ly = H - h.y;
    if (h.warn > 0) {
      const p = 1 - h.warn / (h.full || 1);
      // The target ring.
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.2;
      ctx.globalAlpha = was * (0.35 + 0.55 * p);
      ellipse(ctx, h.x, ly + 0.1, 1.9, 0.45);
      ctx.stroke();
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = was * 0.4 * p;
      ellipse(ctx, h.x, ly + 0.1, 0.6 + 1.2 * p, 0.2 + 0.2 * p);
      ctx.fill();
      const sx = h.sx ?? h.x;
      const sy = h.sy ?? h.y + 30;
      const at = (q) => [mix(sx, h.x, q), H - (mix(sy, h.y, q) + 9 * 4 * q * (1 - q))];
      // Sparks along the way it came.
      ctx.fillStyle = EMBER;
      for (let k = 1; k <= 5; k++) {
        const q = p - k * 0.035;
        if (q <= 0) break;
        const [tx, ty] = at(q);
        ctx.globalAlpha = was * (0.7 - k * 0.12);
        circle(ctx, tx, ty, 0.3 - k * 0.03);
        ctx.fill();
      }
      ctx.globalAlpha = was;
      const [bx, by] = at(p);
      halo(ctx, bx, by, 2.4, EMBER, 0.5);
      ctx.save();
      ctx.translate(bx, by);
      rotate(ctx, p * 9);
      ctx.fillStyle = BRICK;
      ctx.fillRect(-0.95, -0.5, 1.9, 1);
      ctx.fillStyle = BRICK_LIT;
      ctx.fillRect(-0.95, -0.5, 1.9, 0.25);
      ctx.fillStyle = MORTAR;
      ctx.fillRect(0.6, -0.5, 0.35, 0.35);
      ctx.fillStyle = EMBER_HOT;
      ctx.fillRect(-0.95, 0.35, 1.9, 0.15);
      ctx.restore();
      return;
    }
    if (!(h.live > 0)) return;
    const f = clamp(h.live / BRICK_LIVE_MS, 0, 1);
    for (let k = 0; k < 5; k++) {
      const hh = hash(Math.round(h.x * 10) + k, 71);
      ctx.save();
      ctx.translate(h.x - 1.6 + k * 0.8 + (hh % 3) * 0.1, ly - 0.3 - (hh % 2) * 0.2);
      rotate(ctx, (hh % 7) * 0.4);
      ctx.fillStyle = k % 2 ? BRICK : BRICK_LIT;
      ctx.fillRect(-0.4, -0.25, 0.8, 0.5);
      ctx.restore();
    }
    ctx.fillStyle = EMBER;
    for (let k = 0; k < 6; k++) {
      const q = ((v.clock / 500 + k / 6) % 1);
      ctx.globalAlpha = was * f * (1 - q);
      circle(ctx, h.x - 1.2 + k * 0.5 + Math.sin(q * 6 + k) * 0.3, ly - 0.4 - q * 2.4, 0.16);
      ctx.fill();
    }
    ctx.globalAlpha = was;
    halo(ctx, h.x, ly - 0.4, 2.2, EMBER, 0.45 * f);
  }

  // A bolt of lightning at YOUR branch: while it warns, a ring crackling on the
  // branch and a faint column of static reaching up to a glow in the clouds,
  // brighter as it nears; then a jagged white bolt from the sky down to the
  // branch, a flare where it lands.
  function marrowBolt(ctx, v, h) {
    const H = v.g.FIELD_H;
    const was = ctx.globalAlpha;
    const ly = H - h.y;
    const seed = Math.round(h.x * 10) + (h.id || 0) * 7;
    if (h.warn > 0) {
      const p = clamp(1 - h.warn / (h.full || 1), 0, 1);
      const late = p > CHARGE_AT[1];
      const pulse = 0.5 + 0.5 * Math.sin(v.clock / (130 - 95 * p));
      // A black storm cloud boiling up over the spot, lit from inside, flickering faster as it charges.
      const cy = 9;
      ctx.fillStyle = "#0c0a14";
      for (let k = 0; k < 5; k++) {
        ctx.globalAlpha = was * (0.35 + 0.5 * p);
        circle(ctx, h.x + (k - 2) * (1.4 + p), cy + Math.sin(k * 2.1 + v.clock / 300) * 0.5, 1.6 + p * 1.6 - Math.abs(k - 2) * 0.3);
        ctx.fill();
      }
      ctx.globalAlpha = was;
      const flicker = hash(Math.floor(v.clock / (late ? 45 : 90)), seed) % 3 === 0 ? 1 : 0.4;
      halo(ctx, h.x, cy, 6 + 5 * p, late ? "#ffd0c8" : BOLT_EDGE, (0.25 + 0.5 * p) * flicker);
      // The column it will fall down: a dashed line from the cloud to the branch, solid red at the end.
      ctx.strokeStyle = late ? DANGER : BOLT_EDGE;
      ctx.lineWidth = late ? 0.3 : 0.18;
      ctx.globalAlpha = was * (late ? 0.55 + 0.45 * pulse : 0.2 + 0.4 * p);
      for (let y = cy + 2; y < ly - 0.6; y += 1.6) line(ctx, h.x, y, h.x, Math.min(ly - 0.6, y + 0.8));
      // The target on the branch: a ring that tightens, red once it is close.
      ctx.lineWidth = 0.26;
      ctx.globalAlpha = was * (0.5 + 0.5 * pulse);
      ellipse(ctx, h.x, ly + 0.1, 2.6 - 1 * p + 0.4 * pulse, 0.5);
      ctx.stroke();
      if (late) {
        ctx.fillStyle = DANGER;
        ctx.globalAlpha = was * (0.3 + 0.3 * pulse);
        ellipse(ctx, h.x, ly + 0.1, 1.5, 0.35);
        ctx.fill();
        ctx.globalAlpha = was * (0.6 + 0.4 * pulse);
        label(ctx, "!", h.x, cy + 3.4, 2.6, DANGER);
      }
      // Static climbing the column: short flickering dashes, more of them as it nears.
      ctx.strokeStyle = BOLT;
      ctx.lineWidth = 0.12;
      const n = 2 + Math.round(6 * p);
      for (let k = 0; k < n; k++) {
        const q = ((v.clock / 260 + k / n + hash(seed, k) / 997) % 1);
        const yy = ly - q * ly;
        ctx.globalAlpha = was * (0.15 + 0.45 * p) * (1 - q * 0.6);
        line(ctx, h.x + ((hash(seed, k + 9) % 7) - 3) * 0.15, yy, h.x + ((hash(seed, k + 3) % 7) - 3) * 0.2, yy - 1.4);
      }
      ctx.globalAlpha = was;
      return;
    }
    if (!(h.live > 0)) return;
    const f = clamp(h.live / LIGHTNING_LIVE_MS, 0, 1);
    const flick = Math.floor(v.clock / 40);
    const pts = [];
    for (let y = 0, k = 0; y < ly; y += 2.2, k++) pts.push([h.x + ((hash(seed + flick, k) % 9) - 4) * 0.28 * (k ? 1 : 0), y]);
    pts.push([h.x, ly]);
    for (const [wd, color, a] of [[0.9, BOLT_EDGE, 0.45], [0.35, BOLT, 1]]) {
      ctx.strokeStyle = color;
      ctx.lineWidth = wd;
      ctx.globalAlpha = was * a * f;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
    // A fork near the bottom.
    const [fx0, fy0] = pts[Math.max(0, pts.length - 4)];
    ctx.lineWidth = 0.18;
    ctx.globalAlpha = was * 0.8 * f;
    line(ctx, fx0, fy0, fx0 + (hash(seed + flick, 99) % 2 ? 1.4 : -1.4), fy0 + 1.8);
    ctx.globalAlpha = was;
    halo(ctx, h.x, ly - 0.4, 4, BOLT, 0.7 * f);
  }

  /* -------------------------------------------------------------- waves */

  // The carpet: a red, gold-trimmed, wet tongue of a runner rolling out of
  // the door along the floor to w.x, where its front edge is a fat roll
  // turning over toward YOU (the roll is what to jump). `y` is the floor.
  function marrowCarpet(ctx, v, w, y) {
    const root = v.spec ? houseCenter(v.spec) - 2.4 : w.x + 12;
    const a = Math.min(w.x, root);
    const b = Math.max(w.x, root);
    ctx.fillStyle = CARPET_DARK;
    ctx.fillRect(a, y - 0.8, b - a, 0.8);
    ctx.fillStyle = CARPET;
    ctx.fillRect(a, y - 0.85, b - a, 0.6);
    ctx.fillStyle = CARPET_GOLD;
    ctx.fillRect(a, y - 0.95, b - a, 0.16);
    ctx.fillRect(a, y - 0.26, b - a, 0.12);
    // Its pattern, and a wet shine sliding along it.
    for (let x = Math.ceil(a / 2) * 2; x < b - 0.5; x += 2) {
      poly(ctx, [x, y - 0.55, x + 0.35, y - 0.74, x + 0.7, y - 0.55, x + 0.35, y - 0.36]);
      ctx.fill();
    }
    ctx.fillStyle = "#ffffff";
    ctx.globalAlpha = 0.3;
    for (let k = 0; k < 3; k++) {
      const x = a + ((((v.clock / 18 + k * 37) % (b - a + 1)) + (b - a + 1)) % (b - a + 1));
      ctx.fillRect(x, y - 0.85, 1.2, 0.1);
    }
    ctx.globalAlpha = 1;
    // The roll at the front, turning, its spiral of gold trim showing.
    const r = 1.5;
    const cy = y - r;
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = 0.4;
    ellipse(ctx, w.x, y + 0.05, r + 0.5, 0.25);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = CARPET_GOLD;
    circle(ctx, w.x, cy, r + 0.18);
    ctx.fill();
    ctx.fillStyle = CARPET;
    circle(ctx, w.x, cy, r);
    ctx.fill();
    ctx.fillStyle = CARPET_LIT;
    ellipse(ctx, w.x - 0.3, cy - 0.5, r * 0.65, r * 0.35);
    ctx.fill();
    const spin = -(v.clock / 120) * (w.dir || -1) * -1;
    ctx.strokeStyle = CARPET_GOLD;
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    for (let k = 0; k <= 24; k++) {
      const a2 = spin + (k / 24) * TAU * 2.2;
      const rr = 0.2 + (k / 24) * (r - 0.3);
      const px = w.x + Math.cos(a2) * rr;
      const py = cy + Math.sin(a2) * rr;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    // Drips off it.
    ctx.fillStyle = CARPET_LIT;
    for (let k = 0; k < 3; k++) {
      const q = ((v.clock / 340 + k / 3) % 1);
      ctx.globalAlpha = 0.7 * (1 - q);
      circle(ctx, w.x - 0.6 + k * 0.6, cy + r + q * 0.3, 0.12);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The stomp's quake: a ridge of torn turf running along the lawn, clods
  // thrown off its crest, a split in the grass behind it.
  function marrowQuake(ctx, v, w, y) {
    const dir = w.dir || -1;
    // Dust thrown up behind the ridge.
    ctx.fillStyle = DUST;
    for (let k = 0; k < 5; k++) {
      const q = ((v.clock / 420 + k / 5) % 1);
      ctx.globalAlpha = 0.35 * (1 - q);
      circle(ctx, w.x - dir * (1.5 + k * 0.9 + q * 1.5), y - 1 - q * 2.6, 0.7 + q * 1.1);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#050302";
    ctx.lineWidth = 0.2;
    ctx.beginPath();
    ctx.moveTo(w.x - dir * 1.4, y + 0.1);
    for (let k = 1; k < 7; k++) ctx.lineTo(w.x - dir * (1.4 + k * 1.3), y + 0.1 + ((k % 2) - 0.5) * 0.25);
    ctx.stroke();
    ctx.fillStyle = EARTH;
    ctx.beginPath();
    ctx.moveTo(w.x - dir * 2.8, y);
    ctx.quadraticCurveTo(w.x - dir * 1.1, y - 3.2, w.x + dir * 0.4, y - 2.5);
    ctx.quadraticCurveTo(w.x + dir * 1.4, y - 1.6, w.x + dir * 1.3, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#6a5434";
    ctx.beginPath();
    ctx.moveTo(w.x - dir * 1.6, y - 1.9);
    ctx.quadraticCurveTo(w.x - dir * 0.8, y - 2.9, w.x + dir * 0.4, y - 2.5);
    ctx.quadraticCurveTo(w.x + dir * 1.1, y - 2, w.x + dir * 1.2, y - 1);
    ctx.quadraticCurveTo(w.x + dir * 0.2, y - 1.9, w.x - dir * 1.6, y - 1.9);
    ctx.fill();
    ctx.fillStyle = "#050302";
    for (let k = 0; k < 3; k++) {
      ctx.fillRect(w.x - dir * (0.4 + k * 0.7) - 0.1, y - 1.2 + k * 0.2, 0.2, 1);
    }
    // Grass tufts torn up on the crest.
    ctx.fillStyle = GRASS_LIT;
    for (let k = 0; k < 4; k++) {
      const tx = w.x - dir * (1.2 - k * 0.6);
      poly(ctx, [tx - 0.25, y - 2 + k * 0.1, tx + dir * 0.4, y - 3 + k * 0.15, tx + 0.25, y - 2 + k * 0.1]);
      ctx.fill();
    }
    ctx.fillStyle = EARTH;
    for (let k = 0; k < 4; k++) {
      const q = ((v.clock / 300 + k / 4) % 1);
      ctx.globalAlpha = 0.85 * (1 - q);
      circle(ctx, w.x + dir * (q * 1.5) - dir * k * 0.4, y - 2.4 - q * 1.6 + q * q * 2, 0.24);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- light */

  // What lights the lawn: every lit window (the eyes most), the open door's
  // red, the chimney's glow as it coughs, the red eye of the laugh, bricks
  // in the air and burning where they land, and the false win's words.
  function lights(v, add) {
    if (!ours(v) || !v.round) return;
    const round = v.round;
    const b = round.boss;
    if (b && b.kind === "marrow" && !b.gone) {
      const cx = b.placed && v.spec ? houseCenter(v.spec) : b.x;
      const down = b.state === "down";
      const bt = b.t || 0;
      const drop = down ? 1.6 + 44 * ease(clamp((bt - SINK_AT) / (GONE_AT - SINK_AT), 0, 1)) : 0;
      const base = b.y + (b.lift || 0) - drop;
      const states = windowStates(v, b);
      WINDOWS.forEach(([row, dx, up], i) => {
        const s = states[i];
        if (s === "lit") add(cx + dx, base + up + WINDOW_H / 2, row === 3 ? 9 : 6, row === 3 ? 0.75 : 0.55);
        else if (s === "red" && base + up > b.y) add(cx + dx, base + up + WINDOW_H / 2, 8, 0.7);
      });
      const open = mouths.get(b);
      if (open && open.open > 0.1) add(cx, base + 4, 6, 0.45 * open.open);
      if (b.act === "brickWind") add(cx + 9.7, base + 45, 5, 0.6);
      if (down && bt >= FALSE_AT && bt < SINK_AT + 1100) add(round.camX + v.g.FIELD_W / 2, v.g.FIELD_H - 15, 42, 1);
    }
    // The carpet's roll and the quake's ridge are lit enough to see coming.
    for (const w of round.waves) if (w.kind === "marrowCarpet" || w.kind === "marrowQuake") add(w.x, w.y + 1.5, 4, 0.45);
    for (const h of round.hazards) {
      // A slate's shadow and a picket's ripple are lit enough to read and dodge in the dark.
      if (h.kind === "marrowShingle" && h.warn > 0) add(h.x, h.floor + 1, 4, 0.45);
      else if (h.kind === "marrowPicket") add(h.x, h.y + 1.5, 4, h.warn > 0 ? 0.42 : 0.5);
      // A bolt's glow on the branch, and the strike lighting the whole oak.
      else if (h.kind === "marrowBolt") {
        const p = h.warn > 0 ? clamp(1 - h.warn / (h.full || 1), 0, 1) : 1;
        add(h.x, h.y + 1.5, h.live > 0 ? 18 : 4 + 4 * p, h.live > 0 ? 0.95 : 0.4 + 0.4 * p);
        if (h.warn > 0) add(h.x, v.g.FIELD_H - 9, 6 + 6 * p, 0.3 + 0.5 * p);
      }
      if (h.kind !== "marrowBrick") continue;
      if (h.warn > 0) {
        const p = 1 - h.warn / (h.full || 1);
        add(mix(h.sx ?? h.x, h.x, p), mix(h.sy ?? h.y, h.y, p) + 36 * p * (1 - p), 3, 0.5);
      } else if (h.live > 0) add(h.x, h.y + 0.6, 4, 0.45 * clamp(h.live / BRICK_LIVE_MS, 0, 1));
    }
  }

  /* ------------------------------------------------------------- events */

  // A telegraph's words, on the first few times only (counted in fx).
  function told(fx, key) {
    fx.marrowTold = fx.marrowTold || {};
    fx.marrowTold[key] = (fx.marrowTold[key] || 0) + 1;
    return fx.marrowTold[key] <= 3;
  }

  // What the House's events look and sound like, beside ghoul-draw.js's own
  // (the shared bossWake, bossHit, bossDown and bossBlock are its): true when
  // `e` was one of them. Each plays one voice; the ones that come several at
  // once are gated. `k` is the same kit react() is handed.
  function react(e, k) {
    const { tone, burst, float, ring, glow, shake, flash, fx } = k;
    if (e.type === "marrowLight") {
      if (gate(fx, "marrowLightMs", 200)) say(tone, "marrow", "light", 0.35);
      glow(e.x, e.y + WINDOW_H / 2, 5, 0.6, 300);
    } else if (e.type === "marrowWindowOut") {
      // The fight's reward: glass everywhere, a flash in the frame, a jolt.
      say(tone, "marrow", "windowOut", 0.7);
      burst(e.x, e.y, SHARD, 20, 16, 600);
      burst(e.x, e.y, GLASS, 12, 12, 450);
      glow(e.x, e.y, 12, 0.95, 380);
      ring(e.x, e.y, GOLD, 1, 7, 450);
      shake(110, 0.6);
      if (e.left > 0) float(e.x, e.y + 5, e.left === 1 ? "1 window left!" : `${e.left} windows left`, GOLD, 2.4);
    } else if (e.type === "marrowRoof") {
      say(tone, "marrow", "roof", 0.5);
      burst(e.x, e.y, SHINGLE_LIT, 8, 8, 400);
      for (const x of e.xs || []) ring(x, 6, DANGER, 0.6, 2.4, 600);
      if (told(fx, "roof")) float(e.x - 12, e.y - 8, "Shingles!", DANGER, 2.4);
    } else if (e.type === "marrowDoor") {
      say(tone, "marrow", "door", 0.45);
      glow(e.x, e.y, 5, 0.5, 400);
    } else if (e.type === "marrowCarpet") {
      say(tone, "marrow", "carpet", e.echo ? 0.45 : 0.55);
      burst(e.x, e.y + 0.6, CARPET_LIT, 8, 8, 350);
      shake(120, 0.3);
      if (!e.echo && told(fx, "carpet")) float(e.x - 8, e.y + 6, "Mind the carpet!", DANGER, 2.4);
    } else if (e.type === "marrowPicketWind") {
      say(tone, "marrow", "picketWind", 0.45);
      for (const x of e.xs || []) ring(x, e.y, DANGER, 0.6, 2.6, 650);
      if (told(fx, "pickets")) float(e.xs && e.xs.length ? e.xs[0] : e.x, e.y + 8, "Pickets!", DANGER, 2.4);
    } else if (e.type === "marrowPicketUp") {
      if (gate(fx, "marrowPicketMs", 120)) say(tone, "marrow", "picketUp", 0.45);
      burst(e.x, e.y + 0.5, EARTH_LIT, 8, 9, 350);
      shake(60, 0.2);
    } else if (e.type === "marrowShingleLand") {
      if (gate(fx, "marrowShingleMs", 120)) say(tone, "marrow", "shingle", 0.4);
      burst(e.x, e.y + 0.4, SHINGLE_LIT, 7, 8, 320);
    } else if (e.type === "marrowCough") {
      say(tone, "marrow", "cough", 0.5);
      burst(e.x, e.y + 2, "#3a3440", 10, 6, 600);
      glow(e.x, e.y + 2, 5, 0.6, 500);
    } else if (e.type === "marrowBrickLand") {
      if (gate(fx, "marrowBrickMs", 120)) say(tone, "marrow", "brick", 0.5);
      burst(e.x, e.y + 0.4, BRICK_LIT, 10, 10, 420);
      burst(e.x, e.y + 0.4, EMBER, 6, 8, 380);
      glow(e.x, e.y + 0.6, 5, 0.6, 350);
      shake(90, 0.3);
    } else if (e.type === "marrowDoormen") {
      say(tone, "marrow", "doormen", 0.45);
      burst(e.x, e.y + 0.6, DUST, 10, 8, 450);
    } else if (e.type === "marrowRear") {
      say(tone, "marrow", "rear", 0.5);
      burst(e.x, 6.4, DUST, 12, 8, 600);
    } else if (e.type === "marrowStomp") {
      say(tone, "marrow", "stomp", 0.7);
      burst(e.x, e.y + 0.4, EARTH_LIT, 18, 12, 520);
      shake(320, 0.8);
    } else if (e.type === "marrowStorm") {
      say(tone, "marrow", "storm", 0.5);
      for (const x of e.xs || []) ring(x, e.y, BOLT_EDGE, 0.6, 2.4, 700);
      if (told(fx, "storm")) float(e.xs && e.xs.length ? e.xs[0] : e.x, e.y + 7, "Lightning! Move!", DANGER, 2.4);
    } else if (e.type === "marrowCharge") {
      // The charge building: louder at each step, a pulse of light and a ring on the branch.
      say(tone, "marrow", "charge", e.n > 1 ? 0.65 : 0.5);
      ring(e.x, e.y, e.n > 1 ? DANGER : BOLT_EDGE, 0.5, 3, 450);
      glow(e.x, e.y + 2, 6, e.n > 1 ? 0.7 : 0.5, 300);
    } else if (e.type === "marrowStrike") {
      if (gate(fx, "marrowStrikeMs", 150)) say(tone, "marrow", "strike", 0.7);
      flash("#dfe8ff", 140);
      burst(e.x, e.y + 0.4, BOLT, 14, 14, 380);
      shake(160, 0.45);
    } else if (e.type === "marrowCrows") {
      say(tone, "marrow", "crows", 0.55);
      burst(e.x, e.y, "#22202a", 10, 10, 450);
      if (told(fx, "crows")) float(e.x - 10, e.y + 8, "Crows!", DANGER, 2.4);
    } else if (e.type === "marrowSag") {
      say(tone, "marrow", "sag", 0.6);
      burst(e.x, 6.6, DUST, 22, 10, 800);
      shake(300, 0.5);
    } else if (e.type === "marrowFalseWin") {
      say(tone, "marrow", "falseWin", 0.6);
      flash(GOLD, 200);
      burst(e.x - 20, e.y + 10, GOLD, 24, 14, 900);
    } else if (e.type === "marrowLaugh") {
      say(tone, "marrow", "laugh", 0.7);
      glow(e.x + 5.5, e.y, 8, 0.8, 600);
      shake(220, 0.3);
    } else if (e.type === "marrowSink") {
      say(tone, "marrow", "sink", 0.7);
      burst(e.x, 6.6, DUST, 26, 12, 900);
      shake(900, 0.7);
    } else if (e.type === "marrowGone") {
      say(tone, "marrow", "gone", 0.6);
      burst(e.x, e.y - 6, DUST, 14, 8, 700);
      glow(e.x, e.y - 6, 8, 0.6, 600);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    decor: freeze({}),
    monsters: freeze({}),
    bosses: freeze({ marrow }),
    missiles: freeze({}),
    hazards: freeze({ marrowShingle, marrowPicket, marrowBrick, marrowBolt }),
    waves: freeze({ marrowCarpet, marrowQuake }),
    powers: freeze({}),
    lights,
    react,
    moving,
    front,
  });
}
