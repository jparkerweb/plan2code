// Plan2Code Web Console - Ghoul Rush's finale, its drawing for the third kill, The Heart of Marrow in the Pit: the cavern (rock older than the valley, the broken end of the Bone Stair, chains, roots and the iron pipe along the roof), the heart itself on its plinth of roots between two pits, wrapped in roots, pipes and chains, its ribs parting between beats and its red light on every beat, the beat's shockwaves, the roots, grabs, clots and falling rock, the HOLD FIRE flood with its meter, the white, the stopped heart and the shaft of daylight with its door, and what its events look and sound like. LOOKS, VOICES, LOSE_WORDS, LOSE_SOUNDS and heartArt(d), plugged into draw/ghoul-draw.js.
//
// LOOKS, VOICES, LOSE_WORDS and LOSE_SOUNDS are plain data; heartArt(d) takes
// ghoul-draw.js's own drawing helpers (`d`: ellipse, circle, roundRect, line, rotate,
// hash, say, gate, label, DANGER, GOLD and the rest) and hands back the drawing by kind,
// so this file never reaches back into it. Everything is drawn in room units, y counted
// down from the field's top; the heart in a local frame at its feet (its center on the
// floor line, y counted down, so a height `up` is at -up). Nothing here is random: what
// moves follows `v.clock` or the rules' own clocks, and the decor keeps its place by `hash`.
//
// The backdrop is painted once into the still layers, so nothing in it moves; moving()
// (the veins pulsing in the rock, drips off the pipe) and front() (the red flood, the
// beam, the meter, the white) run each frame, and like lights() they run for every pack
// in every room, so they return at once outside the Pit.

import { CLOT_TOP, DAYLIGHT_AT, DUB_MS, GASP, HEART_X, HOLD_WAVE_H, LEFT_LIP, OPEN_AT, RIGHT_LIP, ROOT_UP_MS, STOP_MS, SWELL_MS, openFor, whiteOf } from "./ghoul-marrow-heart.js";

const freeze = (o) => Object.freeze(o);

// The House's true basement: black rock with a dried-blood warmth low down, the floor
// cold stone, the ledges gray slabs. `custom` hands walls, floor and ledges to this file;
// `noMoon` keeps the indoor window light out; it is the darkest room in the game.
const cave = (o) => freeze({ wallTop: "#030203", wallLow: "#160a0c", paper: "#1c1012", wainscot: "#0c0708", floorTop: "#3a2c28", floor: "#120c0b", floorEdge: "#050303", shelf: "#2c2426", shelfTop: "#4e403c", pit: "#010001", window: "#d04030", decor: "tombs", dark: 0.95, custom: true, noMoon: true, pack: "pit", ...o });
export const LOOKS = freeze({
  // Underground: no lightning flashes here (`noLightning`, read by core/ghoul-window.js).
  pit: cave({ color: "#d0283c", noLightning: true }),
});

// How the heart sounds, by act (the user's picks from the sound vote, heart.html, in ghoul-sfx-marrow-heart.js).
// The hold starts on the intro story's own click: Marrow flinched at YOUR light once before.
export const VOICES = freeze({
  marrowheart: freeze({ wake: "ghoulHeartWake", hurt: "ghoulHeartHurt", die: "ghoulHeartDie", beat: "ghoulHeartBeat", open: "ghoulHeartOpen", rootWind: "ghoulHeartRootWind", rootCrack: "ghoulHeartRootCrack", rootUp: "ghoulHeartRootUp", grabWind: "ghoulHeartGrabWind", grabTense: "ghoulHeartGrabTense", grabLash: "ghoulHeartGrabLash", clotWind: "ghoulHeartClotWind", clotLand: "ghoulHeartClotLand", quake: "ghoulHeartQuake", chunk: "ghoulHeartChunk", stop: "ghoulHeartStop", swell: "ghoulHeartSwell", slam: "ghoulHeartSlam", hold: "ghoulStoryClick", weakBeat: "ghoulHeartWeakBeat", knock: "ghoulHeartKnock", flood: "ghoulHeartFlood", white: "ghoulHeartWhite", last: "ghoulHeartLast", daylight: "ghoulHeartDaylight" }),
});
export const LOSE_WORDS = freeze({ marrowheart: "Crushed by the heart", heartBeat: "Shaken off your feet", heartBig: "Thrown by the beat", heartRoot: "Rooted", heartGrab: "Dragged off the ledge", heartClot: "Clotted", heartChunk: "Buried in the Pit" });
export const LOSE_SOUNDS = freeze({
  marrowheart: ["ghoulHeartSlam", 0.6, 1],
  heartBeat: ["thud", 0.6, 0.7],
  heartBig: ["ghoulHeartSlam", 0.55, 1.2],
  heartRoot: ["crunch", 0.55, 0.8],
  heartGrab: ["ghoulHeartGrabLash", 0.55, 0.8],
  heartClot: ["ghoulHeartClotLand", 0.6, 0.8],
  heartChunk: ["smash", 0.6, 0.8],
});

// Where the cavern's still pieces stand (room units): far chains hanging from the roof,
// the iron pipe along the roof (its underside is where clots bulge), the bone heap where
// the Bone Stair dropped YOU.
const CHAINS = freeze([18, 44, 70, 101]);
const PIPE_X0 = 58;
const PIPE_Y = 54 - CLOT_TOP - 1;
const PIPE_R = 1;

// The inks: rock, bone, muscle, roots, iron, blood, light.
const ROCK = "#1c1416";
const ROCK_LIT = "#342628";
const ROCK_DARK = "#0a0607";
const BONE = "#d8cdb0";
const BONE_SHADE = "#8a7f68";
const MUSCLE = "#5a0a14";
const MUSCLE_LIT = "#8e1a26";
const MUSCLE_DARK = "#2a0308";
const VEIN = "#1e0206";
const CORE = "#ff3a2a";
const CORE_HOT = "#ffb070";
const ROOT = "#24170f";
const ROOT_LIT = "#4a3220";
const ROOT_DEAD = "#3a3430";
// What comes up at YOU is drawn brighter than the roots of the room, to read in the dark.
const SNARE = "#6e4528";
const SNARE_LIT = "#a8703e";
const IRON = "#2c2829";
const IRON_LIT = "#4e4646";
const RUST = "#5a2c1a";
const CHAIN = "#3a3638";
const CHAIN_LIT = "#625c5c";
const CLOT = "#0c0204";
const CLOT_SHINE = "#7a1420";
const RED = "#ff2a18";
const ASH = "#4a4448";
const ASH_LIT = "#6a6266";
const DAY = "#fff3c8";
const DAY_HOT = "#ffffff";
const BEAM = "#fff2b0";

export function heartArt(d) {
  const { ellipse, circle, roundRect, line, hash, say, gate, label, DANGER, GOLD } = d;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
  const mix = (a, b, p) => a + (b - a) * p;
  const ease = (p) => p * p * (3 - 2 * p);
  const ours = (v) => !!(v && v.spec && LOOKS[v.spec.id]);
  // Two #rrggbb inks mixed, `p` of the way to the second.
  const blend = (a, b, p) => {
    const q = clamp(p, 0, 1);
    const ch = (i) => Math.round(mix(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), q));
    return `rgb(${ch(1)}, ${ch(3)}, ${ch(5)})`;
  };

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

  // A limb that tapers from w0 wide at (x0, y0) to w1 at (x1, y1), bowed `bend` across.
  function limb(ctx, x0, y0, x1, y1, w0, w1, bend = 0) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const mx = (x0 + x1) / 2 + nx * bend;
    const my = (y0 + y1) / 2 + ny * bend;
    const wm = (w0 + w1) / 2;
    ctx.beginPath();
    ctx.moveTo(x0 + (nx * w0) / 2, y0 + (ny * w0) / 2);
    ctx.quadraticCurveTo(mx + (nx * wm) / 2, my + (ny * wm) / 2, x1 + (nx * w1) / 2, y1 + (ny * w1) / 2);
    ctx.lineTo(x1 - (nx * w1) / 2, y1 - (ny * w1) / 2);
    ctx.quadraticCurveTo(mx - (nx * wm) / 2, my - (ny * wm) / 2, x0 - (nx * w0) / 2, y0 - (ny * w0) / 2);
    ctx.closePath();
  }

  // A chain from (x0, y0) to (x1, y1), its links turning each way in turn.
  function chain(ctx, x0, y0, x1, y1, lit = false) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / 1.1));
    const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.lineWidth = 0.28;
    for (let i = 0; i <= n; i++) {
      const p = i / n;
      ctx.strokeStyle = lit && i % 3 === 0 ? CHAIN_LIT : CHAIN;
      ellipse(ctx, mix(x0, x1, p), mix(y0, y1, p), i % 2 ? 0.62 : 0.3, i % 2 ? 0.3 : 0.5, a);
      ctx.stroke();
    }
  }

  /* ------------------------------------------------------------ the cavern */

  // The rock wall from the roof down to the floor: black up high, a buried warmth low
  // down, strata, a jagged roof hung with stalactites, far chains, dead roots, red veins.
  function backdrop(ctx, v, look, x0, x1) {
    const H = v.g.FIELD_H;
    const floorY = H - 6;
    const steps = 6;
    for (let i = 0; i < steps; i++) {
      ctx.fillStyle = blend(look.wallTop, look.wallLow, i / (steps - 1));
      ctx.fillRect(x0 - 1, (i * floorY) / steps, x1 - x0 + 2, floorY / steps + 0.2);
    }
    // Strata: wavy bands of older and older rock.
    for (let band = 0; band < 7; band++) {
      const y0 = 8 + band * 5.6;
      ctx.fillStyle = band % 2 ? "#120a0c" : "#1a1012";
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.moveTo(x0 - 1, y0);
      for (let x = Math.floor(x0 / 3) * 3; x <= x1 + 3; x += 3) ctx.lineTo(x, y0 + Math.sin(x * 0.11 + band) * 0.8 + (hash(Math.round(x), band) % 3) * 0.2);
      ctx.lineTo(x1 + 3, y0 + 2.2);
      for (let x = Math.ceil(x1 / 3) * 3; x >= x0 - 3; x -= 3) ctx.lineTo(x, y0 + 2.2 + Math.sin(x * 0.09 + band * 2) * 0.6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Cracks in the wall.
    ctx.strokeStyle = ROCK_DARK;
    ctx.lineWidth = 0.18;
    for (let x = Math.floor(x0 / 9) * 9; x < x1 + 9; x += 9) {
      const h = hash(Math.round(x / 9), 41);
      if (h % 3 === 0) continue;
      let cx = x + (h % 7);
      let cy = 12 + (h % 23);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) {
        cx += ((hash(h, k) % 5) - 2) * 0.6;
        cy += 1.2 + (hash(k, h) % 3) * 0.5;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
    // Old red veins in the rock, thickest toward the heart.
    ctx.strokeStyle = "#3a0a0c";
    for (let x = Math.floor(x0 / 7) * 7; x < x1 + 7; x += 7) {
      const near = clamp(1 - Math.abs(x - HEART_X) / 70, 0, 1);
      const h = hash(Math.round(x / 7), 77);
      if (h % 4 > near * 4) continue;
      ctx.lineWidth = 0.2 + near * 0.3;
      ctx.beginPath();
      let vx = x + (h % 5);
      let vy = 6 + (h % 30);
      ctx.moveTo(vx, vy);
      for (let k = 0; k < 5; k++) {
        vx += (Math.sign(HEART_X - vx) || 1) * (0.8 + (hash(h, k + 3) % 3) * 0.5);
        vy += ((hash(k, h + 9) % 5) - 2) * 0.7;
        ctx.lineTo(vx, vy);
      }
      ctx.stroke();
    }
    // Stalagmites along the foot of the wall, behind the floor.
    for (let x = Math.floor(x0 / 5) * 5; x < x1 + 5; x += 5) {
      const h = hash(Math.round(x / 5), 13);
      if (h % 3) continue;
      const sx = x + (h % 4);
      const tall = 2 + (h % 5) * 0.8;
      ctx.fillStyle = h % 2 ? "#1e1416" : "#261a1c";
      poly(ctx, [sx - 1.2, floorY + 0.2, sx - 0.2, floorY - tall, sx + 0.3, floorY - tall + 0.4, sx + 1.3, floorY + 0.2]);
      ctx.fill();
    }
    boneStair(ctx, v, x0, x1);
    // Far chains hanging out of the dark.
    for (const cx of CHAINS) {
      if (cx < x0 - 4 || cx > x1 + 4) continue;
      const low = 14 + (hash(cx, 5) % 10);
      chain(ctx, cx, 0, cx + 0.6, low);
      ctx.fillStyle = IRON;
      roundRect(ctx, cx - 0.5, low, 1.6, 1.4, 0.4);
      ctx.fill();
    }
    // Dead roots hanging from the roof.
    ctx.strokeStyle = "#160e0a";
    for (let x = Math.floor(x0 / 2.5) * 2.5; x < x1 + 3; x += 2.5) {
      const h = hash(Math.round(x * 4), 23);
      if (h % 3 === 0) continue;
      const len = 3 + (h % 9) * (Math.abs(x - HEART_X) < 40 ? 1.1 : 0.6);
      ctx.lineWidth = 0.15 + (h % 3) * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, 2);
      ctx.quadraticCurveTo(x + ((h % 5) - 2) * 0.5, 2 + len * 0.6, x + ((h % 7) - 3) * 0.3, 2 + len);
      ctx.stroke();
    }
    roof(ctx, x0, x1);
    roofPipe(ctx, x0, x1);
  }

  // The roof: jagged black rock with stalactites, dripping.
  function roof(ctx, x0, x1) {
    ctx.fillStyle = ROCK_DARK;
    ctx.beginPath();
    ctx.moveTo(x0 - 1, 0);
    for (let x = Math.floor(x0 / 1.5) * 1.5; x <= x1 + 1.5; x += 1.5) ctx.lineTo(x, 1.6 + (hash(Math.round(x * 2), 3) % 5) * 0.35);
    ctx.lineTo(x1 + 1.5, 0);
    ctx.closePath();
    ctx.fill();
    for (let x = Math.floor(x0 / 3.4) * 3.4; x < x1 + 3.4; x += 3.4) {
      const h = hash(Math.round(x * 3), 7);
      if (h % 4 === 0) continue;
      const sx = x + (h % 3) * 0.5;
      const len = 1.5 + (h % 6) * 0.9;
      ctx.fillStyle = h % 2 ? ROCK : "#140e10";
      poly(ctx, [sx - 0.7, 1.6, sx + 0.1, 1.6 + len, sx + 0.8, 1.6]);
      ctx.fill();
    }
  }

  // The iron pipe along the roof over the fight, from the dark on the left to the heart:
  // flanged joints, rivets, rust running down. Its underside is where clots bulge.
  function roofPipe(ctx, x0, x1) {
    const a = Math.max(x0 - 1, PIPE_X0);
    const b = Math.min(x1 + 1, HEART_X - 12);
    if (b <= a) return;
    ctx.fillStyle = IRON;
    ctx.fillRect(a, PIPE_Y - PIPE_R, b - a, PIPE_R * 2);
    ctx.fillStyle = IRON_LIT;
    ctx.fillRect(a, PIPE_Y - PIPE_R + 0.15, b - a, 0.3);
    ctx.fillStyle = "#151213";
    ctx.fillRect(a, PIPE_Y + PIPE_R - 0.3, b - a, 0.3);
    // Its hangers up to the roof.
    ctx.strokeStyle = IRON;
    ctx.lineWidth = 0.25;
    for (let x = Math.ceil(a / 12) * 12 + 4; x < b; x += 12) line(ctx, x, 1.5, x, PIPE_Y - PIPE_R);
    for (let x = Math.ceil(a / 6) * 6; x < b; x += 6) {
      ctx.fillStyle = "#3a3434";
      ctx.fillRect(x - 0.35, PIPE_Y - PIPE_R - 0.25, 0.7, PIPE_R * 2 + 0.5);
      ctx.fillStyle = "#6a6060";
      circle(ctx, x, PIPE_Y - 0.5, 0.1);
      ctx.fill();
      circle(ctx, x, PIPE_Y + 0.5, 0.1);
      ctx.fill();
      // Rust streaks under a leaking joint.
      if (hash(Math.round(x), 19) % 2) {
        ctx.fillStyle = RUST;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(x - 0.15, PIPE_Y + PIPE_R, 0.3, 1.2 + (hash(Math.round(x), 4) % 3) * 0.6);
        ctx.globalAlpha = 1;
      }
    }
  }

  // The broken end of the Bone Stair, high on the left where it gave out, and the heap of
  // bones under it where YOU landed.
  function boneStair(ctx, v, x0, x1) {
    if (x0 > 22) return;
    const floorY = v.g.FIELD_H - 6;
    for (let k = 0; k < 7; k++) {
      const sx = -2 + k * 2.2;
      const sy = 4 + k * 3.2;
      ctx.fillStyle = k % 2 ? BONE_SHADE : "#b0a68c";
      roundRect(ctx, sx, sy, 3, 0.9, 0.4);
      ctx.fill();
      ctx.fillStyle = "#5a5040";
      circle(ctx, sx + 0.3, sy + 0.45, 0.35);
      ctx.fill();
      circle(ctx, sx + 2.7, sy + 0.45, 0.35);
      ctx.fill();
    }
    // The last step snapped in two, hanging.
    ctx.save();
    ctx.translate(14, 27);
    if (typeof ctx.rotate === "function") ctx.rotate(0.6);
    ctx.fillStyle = BONE_SHADE;
    roundRect(ctx, 0, 0, 2.2, 0.8, 0.3);
    ctx.fill();
    ctx.restore();
    // The heap: skulls and long bones in a pile on the floor.
    for (let k = 0; k < 22; k++) {
      const h = hash(k, 31);
      const bx = 4 + (h % 14);
      const by = floorY - 0.3 - (h % 4) * 0.5 * (1 - Math.abs(bx - 11) / 9);
      ctx.fillStyle = k % 3 ? BONE_SHADE : "#a89e86";
      if (k % 5 === 0) {
        circle(ctx, bx, by - 0.5, 0.75);
        ctx.fill();
        ctx.fillStyle = "#1a1410";
        circle(ctx, bx - 0.25, by - 0.6, 0.15);
        ctx.fill();
        circle(ctx, bx + 0.25, by - 0.6, 0.15);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(bx, by);
        if (typeof ctx.rotate === "function") ctx.rotate(((h % 9) - 4) * 0.3);
        ctx.fillRect(-1.2, -0.18, 2.4, 0.36);
        circle(ctx, -1.2, 0, 0.3);
        ctx.fill();
        circle(ctx, 1.2, 0, 0.3);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  /* -------------------------------------------------------- floor, ledges */

  // One floor piece: cold rock with a rough top and old bones in it; the plinth between
  // the pits is the heart's roots, twisted together.
  function ground(ctx, v, look, a, b, top) {
    const fy = v.g.FIELD_H - top;
    const plinth = a >= LEFT_LIP && b <= RIGHT_LIP;
    if (plinth) {
      ctx.fillStyle = "#140c08";
      ctx.fillRect(a, fy, b - a, top);
      for (let k = 0; k < 9; k++) {
        const y = fy + 0.4 + k * 0.7;
        ctx.strokeStyle = k % 2 ? ROOT : ROOT_LIT;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(a, y);
        for (let x = a; x <= b; x += 1) ctx.lineTo(x, y + Math.sin(x * 0.9 + k * 1.7) * 0.35);
        ctx.stroke();
      }
      ctx.fillStyle = ROOT_LIT;
      ctx.fillRect(a, fy, b - a, 0.5);
      return;
    }
    ctx.fillStyle = look.floor;
    ctx.fillRect(a, fy, b - a, top);
    // Stones and buried bones in the rock.
    for (let x = Math.ceil(a / 2.1) * 2.1; x < b; x += 2.1) {
      const h = hash(Math.round(x / 2.1), 91);
      ctx.fillStyle = h % 5 === 0 ? "#3a3428" : h % 3 ? "#1a1312" : "#241c1a";
      if (h % 5 === 0) ctx.fillRect(x, fy + 2 + (h % 3), 1.4, 0.3);
      else {
        ellipse(ctx, x + (h % 7) * 0.2, fy + 1.6 + (h % 4) * 1.1, 0.5 + (h % 3) * 0.2, 0.3);
        ctx.fill();
      }
    }
    // A rough top edge, worn, with a few red veins running to the pits.
    ctx.fillStyle = look.floorTop;
    ctx.beginPath();
    ctx.moveTo(a, fy + 0.8);
    for (let x = a; x <= b; x += 0.8) ctx.lineTo(Math.min(x, b), fy + (hash(Math.round(x * 5), 2) % 3) * 0.12);
    ctx.lineTo(b, fy + 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4a0c10";
    ctx.lineWidth = 0.15;
    for (let x = Math.ceil(a / 11) * 11; x < b - 2; x += 11) {
      const h = hash(Math.round(x / 11), 5);
      if (h % 2) continue;
      ctx.beginPath();
      ctx.moveTo(x, fy + 0.2);
      ctx.lineTo(x + 1.5, fy + 1.2);
      ctx.lineTo(x + 2.6, fy + 0.9);
      ctx.lineTo(x + 3.8, fy + 2);
      ctx.stroke();
    }
    // The lips of the pits by the heart, crumbling.
    for (const lip of [LEFT_LIP, RIGHT_LIP]) {
      if (Math.abs(b - lip) < 0.01 || Math.abs(a - lip) < 0.01) {
        const dir = Math.abs(b - lip) < 0.01 ? -1 : 1;
        ctx.fillStyle = ROCK_DARK;
        for (let k = 0; k < 4; k++) poly(ctx, [lip + dir * k * 0.6, fy + 1 + k, lip + dir * (k * 0.6 + 0.8), fy + 1.4 + k, lip, fy + 2 + k]);
        ctx.fill();
      }
    }
  }

  // A ledge: a slab of gray stone, rough underneath, roots hanging off it.
  function shelf(ctx, v, look, a, b, y) {
    const pts = [a - 0.4, y + 0.2, a, y, b, y, b + 0.4, y + 0.3];
    for (let x = b; x >= a; x -= 1) pts.push(x, y + 1.4 + (hash(Math.round(x * 3), 8) % 4) * 0.35);
    ctx.fillStyle = look.shelf;
    poly(ctx, pts);
    ctx.fill();
    ctx.fillStyle = look.shelfTop;
    ctx.fillRect(a, y, b - a, 0.4);
    ctx.strokeStyle = ROCK_DARK;
    ctx.lineWidth = 0.14;
    for (let x = a + 2; x < b - 1; x += 3.5) line(ctx, x, y + 0.5, x + 0.6, y + 1.3);
    // Roots hanging under it, to climb by.
    ctx.strokeStyle = ROOT;
    for (let x = a + 0.8; x < b; x += 1.6) {
      const h = hash(Math.round(x * 7), 15);
      const len = 1.5 + (h % 6) * 0.7;
      ctx.lineWidth = 0.15 + (h % 3) * 0.06;
      ctx.beginPath();
      ctx.moveTo(x, y + 1.4);
      ctx.quadraticCurveTo(x + ((h % 3) - 1) * 0.6, y + 1.4 + len * 0.6, x + ((h % 5) - 2) * 0.3, y + 1.4 + len);
      ctx.stroke();
    }
  }

  /* -------------------------------------------------------- the heart's clocks */

  // This room's hold, as the rules keep it (never made here).
  const holdOf = (v) => {
    const r = v.round;
    return r && r.heart && r.heart.room === r.room ? r.heart : null;
  };

  // How hard it is beating this moment, 0 to 1: the lub, then the dub, by the rules'
  // clock; a slow idle pulse on a card or asleep; the weak beat in the hold; none stopped.
  function pulseOf(v, b) {
    const bump = (t, len) => (t >= 0 && t < len ? 1 - t / len : 0);
    const idle = (period) => {
      const t = ((v.clock % period) + period) % period;
      return Math.max(bump(t, 360), 0.8 * bump(t - DUB_MS, 360));
    };
    if (!v.round) return idle(1600);
    const h = holdOf(v);
    if (b.state === "down" || (h && h.final)) return 0;
    if (h && h.hold) return 0.55 * Math.max(bump(h.beatMs, 420), 0.8 * bump(h.beatMs - 380, 420));
    if (b.state === "sleep" || b.state === "intro" || !b.beatT) return idle(b.state === "sleep" ? 2200 : 1500);
    if (b.stopMs > 0) return 0;
    const t = b.beatMs || 0;
    return Math.max(bump(t, 380), 0.9 * bump(t - DUB_MS, 380));
  }

  // How far the ribs stand open, 0 to 1, eased in and out around the rules' window.
  function ribsOf(v, b) {
    if (!v.round) return 0.3;
    const h = holdOf(v);
    if (b.state === "down" || (h && h.hold)) return 1;
    if (b.state !== "fight" || !b.beatT || b.stopMs > 0) return 0;
    const span = openFor(b.max > 0 ? b.hp / b.max : 1) * b.beatT * (b.gasp ? GASP : 1);
    const t = (b.beatMs || 0) - OPEN_AT;
    if (t < -90 || t > span + 90) return 0;
    if (t < 0) return ease(1 + t / 90) * 0.35;
    if (t > span) return ease(1 - (t - span) / 90);
    return 1;
  }

  /* ------------------------------------------------------------ the heart */

  // The heart's outline at scale `s` (about its middle): two lobes over a tip that sinks
  // below the floor line into its roots.
  function heartPath(ctx) {
    ctx.beginPath();
    ctx.moveTo(1, -31);
    ctx.bezierCurveTo(-3, -41, -18, -41, -17.5, -27);
    ctx.bezierCurveTo(-17, -15, -9, -4, -1, 4);
    ctx.bezierCurveTo(7, -3, 16, -13, 17, -26);
    ctx.bezierCurveTo(17.5, -40, 5, -41, 1, -31);
    ctx.closePath();
  }

  // One rib each side at height `up`, swinging from shut across the front (o 0) to flung
  // wide (o 1), bone with a dark edge.
  function rib(ctx, up, o, side, k, bleach) {
    const ay = -up;
    const ax = side * 14.6;
    const ex = side * mix(1.1, 24 - k * 1.2, o);
    const ey = ay + mix(1.6, -3.5 - k * 0.6, o);
    const cx = side * mix(9.5, 21, o);
    const cy = ay + mix(-4.6, 2.8, o);
    for (const [w, ink] of [[1.9, "#1a1410"], [1.35, blend(BONE_SHADE, "#f0eadc", bleach)], [0.5, blend(BONE, "#ffffff", bleach)]]) {
      ctx.strokeStyle = ink;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(cx, cy, ex, ey);
      ctx.stroke();
    }
  }

  // A root wrapped over the heart, `limp` hanging it slack.
  function wrapRoot(ctx, pts, w, ink, limp) {
    ctx.strokeStyle = ink;
    ctx.lineCap = "round";
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i + 3 < pts.length; i += 4) ctx.quadraticCurveTo(pts[i], pts[i + 1] + limp * 2, pts[i + 2], pts[i + 3] + limp * (i / pts.length) * 5);
    ctx.stroke();
    ctx.lineCap = "butt";
  }

  // The heart, its feet at (b.x, b.y) (or HEART_X in the room): pipes and chains behind,
  // the muscle squeezing on each beat and swelling before it, the core glowing through the
  // ribs as they part, roots wrapped over it; bleached by YOUR light in the hold, ash once
  // stopped. Also, in the room, the rock over its door until the daylight comes, then the
  // shaft of daylight and the door of light.
  function marrowheart(ctx, v, b) {
    const room = !!(v.round && v.spec && ours(v));
    const cx = room ? HEART_X : b.x;
    const fy = v.g.FIELD_H - b.y;
    const t = v.clock;
    const h = holdOf(v);
    const hold = !!(h && h.hold);
    const dead = b.state === "down" || !!(h && h.final);
    const pulse = pulseOf(v, b);
    const o = ribsOf(v, b);
    const meter = hold ? h.meter : 0;
    const bleach = dead ? 0 : meter * 0.75;
    const stopped = !!(b.stopMs > 0);
    const stopP = stopped ? 1 - b.stopMs / STOP_MS : 0;
    // The squeeze on each thump, the swell before a lub, and the long swell when stopped.
    const s = 1 - 0.06 * pulse + 0.035 * (b.swell || 0) + 0.09 * ease(stopP);
    const shud = (b.hurt > 0 ? Math.sin(t / 14) * 0.4 * Math.min(1, b.hurt / 120) : 0) + (stopP > 0.6 ? Math.sin(t / 19) * 0.3 * stopP : 0);
    const asleep = b.state === "sleep";
    const was = ctx.globalAlpha;
    if (room) doorCover(ctx, v, b);
    ctx.save();
    ctx.translate(cx + shud, fy);
    // Behind: its great vessels, iron pipes grown into flesh, up into the dark; chains.
    const vessel = dead ? ASH : blend(MUSCLE_DARK, "#d8c0b8", bleach);
    ctx.fillStyle = vessel;
    limb(ctx, -6, -34 * s, -11, -64, 3.6, 2.8, -2);
    ctx.fill();
    limb(ctx, 5, -35 * s, 9, -64, 3.2, 2.5, 2);
    ctx.fill();
    ctx.fillStyle = dead ? ASH_LIT : IRON_LIT;
    for (const [x, y, w] of [[-8.4, -42, 4.6], [-9.6, -48, 4.2], [7, -43, 4.2], [8, -49, 3.8]]) {
      roundRect(ctx, x - w / 2, y, w, 0.9, 0.3);
      ctx.fill();
    }
    // The roof pipe coming down into its left side.
    if (room) {
      ctx.strokeStyle = IRON;
      ctx.lineWidth = PIPE_R * 2;
      ctx.beginPath();
      ctx.moveTo(-12, PIPE_Y - fy);
      ctx.quadraticCurveTo(-17, PIPE_Y - fy, -16.5, -26 * s);
      ctx.stroke();
      ctx.strokeStyle = IRON_LIT;
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.moveTo(-12, PIPE_Y - fy - 0.6);
      ctx.quadraticCurveTo(-17.6, PIPE_Y - fy - 0.6, -17.1, -26 * s);
      ctx.stroke();
    }
    chain(ctx, -15 * s, -19 * s, -27, -62, true);
    chain(ctx, 15 * s, -21 * s, 28, -62, true);
    chain(ctx, -2, -36 * s, -5, -62, true);
    // The muscle.
    ctx.save();
    ctx.translate(0, -18);
    ctx.scale(s, s);
    ctx.translate(0, 18);
    if (typeof ctx.rotate === "function") ctx.rotate(-0.06);
    const flesh = dead ? ASH : blend(asleep ? MUSCLE_DARK : MUSCLE, "#e8d4cc", bleach);
    const fleshLit = dead ? ASH_LIT : blend(MUSCLE_LIT, "#fff4ee", bleach);
    ctx.fillStyle = flesh;
    heartPath(ctx);
    ctx.fill();
    // Its lit side and a wet sheen that flashes on a thump.
    ctx.fillStyle = fleshLit;
    ctx.globalAlpha = was * (0.55 + 0.35 * pulse);
    ellipse(ctx, -8, -28, 6, 7.5, -0.4);
    ctx.fill();
    ctx.globalAlpha = was * (0.25 + 0.4 * pulse);
    ctx.fillStyle = dead ? "#8a8488" : "#ffd0c8";
    ellipse(ctx, -10, -31, 1.8, 3, -0.5);
    ctx.fill();
    ctx.globalAlpha = was;
    // Veins over it, branching, darker.
    ctx.strokeStyle = dead ? "#2a2628" : VEIN;
    ctx.lineWidth = 0.32;
    for (const [x0, y0, x1, y1, bend] of [[-3, -36, -12, -16, -3], [4, -36, 11, -14, 3], [-1, -30, 2, -6, 1], [-12, -24, -6, -10, 2], [10, -26, 5, -8, -2]]) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo((x0 + x1) / 2 + bend, (y0 + y1) / 2, x1, y1);
      ctx.stroke();
    }
    // The core, glowing through as the ribs part (white-gold in YOUR flood).
    // The swell before the big wave glows up through it: the warning.
    const swellGlow = stopped ? clamp(1 - b.stopMs / SWELL_MS, 0, 1) : 0;
    const core = dead ? 0 : Math.max(o, hold ? 1 : 0, swellGlow * 0.7);
    if (core > 0.02 || pulse > 0.05) {
      const glow = dead ? 0 : core * (0.6 + 0.4 * pulse) + (stopped ? 0.3 * swellGlow : 0.18 * pulse);
      halo(ctx, 0, -20, 13, hold ? blend(CORE, "#fff8e0", meter) : CORE, glow);
      ctx.fillStyle = hold ? blend(CORE, "#ffffff", meter) : blend(MUSCLE_LIT, CORE, core);
      ctx.globalAlpha = was * clamp(core * 1.1, 0, 1);
      ellipse(ctx, 0, -20, 7 + pulse, 10 + pulse);
      ctx.fill();
      ctx.fillStyle = hold ? "#ffffff" : CORE_HOT;
      ctx.globalAlpha = was * clamp(core, 0, 1) * (0.5 + 0.5 * pulse);
      ellipse(ctx, 0, -21, 3.2, 5);
      ctx.fill();
      ctx.globalAlpha = was;
    }
    // Cracks across it once it has stopped.
    if (dead) {
      ctx.strokeStyle = "#1a1618";
      ctx.lineWidth = 0.25;
      for (const [x0, y0, x1, y1] of [[-6, -34, 2, -20], [2, -20, -3, -6], [8, -30, 12, -18]]) line(ctx, x0, y0, x1, y1);
    }
    // The ribs, from its sides: four each way.
    for (let k = 0; k < 4; k++) {
      const up = 11 + k * 6;
      rib(ctx, up, o, -1, k, dead ? 0.2 : bleach);
      rib(ctx, up, o, 1, k, dead ? 0.2 : bleach);
    }
    // The breastbone between them, only while shut.
    if (o < 0.9) {
      ctx.globalAlpha = was * (1 - o);
      ctx.fillStyle = BONE_SHADE;
      roundRect(ctx, -1, -31, 2, 24, 0.8);
      ctx.fill();
      ctx.fillStyle = BONE;
      ctx.fillRect(-0.35, -30, 0.7, 22);
      ctx.globalAlpha = was;
    }
    ctx.restore();
    // Roots wrapped over it, from the plinth; slack in the hold and once stopped.
    const limp = hold || dead ? 1 : 0;
    const rootInk = hold || dead ? ROOT_DEAD : ROOT;
    wrapRoot(ctx, [-9, 1, -20, -10, -14, -24, -6, -34, 4, -36], 1.5, rootInk, limp);
    wrapRoot(ctx, [9, 1, 19, -14, 12, -26, 2, -30, -8, -38], 1.3, rootInk, limp);
    wrapRoot(ctx, [-3, 2, -10, -8, -4, -15, 6, -20, 14, -30], 0.9, hold || dead ? "#4a4440" : ROOT_LIT, limp);
    // Roots spilling off the plinth down into both pits.
    ctx.fillStyle = rootInk;
    for (const side of [-1, 1]) {
      limb(ctx, side * 6, 0.5, side * 11, 9, 1.8, 0.6, side * 1.5);
      ctx.fill();
      limb(ctx, side * 3, 1, side * 9.5, 13, 1.2, 0.4, -side * 1);
      ctx.fill();
    }
    ctx.restore();
    // In the room, the red of each beat on its plinth's lip, as light catches wet roots.
    if (room && !dead && pulse > 0.05) {
      ctx.fillStyle = RED;
      ctx.globalAlpha = was * 0.35 * pulse;
      ctx.fillRect(LEFT_LIP + 6, fy - 0.3, RIGHT_LIP - LEFT_LIP - 12, 0.5);
      ctx.globalAlpha = was;
    }
    if (room) daylight(ctx, v, b);
  }

  // The rock over the room's door, the way out walled up while the heart beats; it
  // crumbles away when the daylight comes.
  function doorCover(ctx, v, b) {
    const door = v.spec.door;
    const fy = v.g.FIELD_H - v.groundAt(v.spec, door);
    const p = b.gone ? clamp((b.t - DAYLIGHT_AT) / 700, 0, 1) : 0;
    if (p >= 1) return;
    const was = ctx.globalAlpha;
    ctx.globalAlpha = was * (1 - p);
    ctx.fillStyle = "#181012";
    poly(ctx, [door - 8, fy, door - 7.5, fy - 9, door - 5, fy - 16, door - 1, fy - 18.5, door + 4, fy - 17.5, door + 7.6, fy - 12, door + 8, fy]);
    ctx.fill();
    ctx.fillStyle = "#241a1c";
    for (let k = 0; k < 7; k++) {
      const h = hash(k, 61);
      ellipse(ctx, door - 6 + (h % 12), fy - 2 - (h % 14), 1.4 + (h % 3) * 0.4, 0.9, (h % 5) * 0.3);
      ctx.fill();
    }
    ctx.strokeStyle = ROCK_DARK;
    ctx.lineWidth = 0.2;
    line(ctx, door - 3, fy - 15, door - 1, fy - 8);
    line(ctx, door + 3, fy - 13, door + 1.5, fy - 5);
    ctx.globalAlpha = was;
  }

  // The shaft of real daylight from far above, down to a door of light at the room's door.
  function daylight(ctx, v, b) {
    if (b.state !== "down" || b.t < DAYLIGHT_AT - 500) return;
    const p = ease(clamp((b.t - DAYLIGHT_AT + 500) / 1400, 0, 1));
    const door = v.spec.door;
    const fy = v.g.FIELD_H - v.groundAt(v.spec, door);
    const was = ctx.globalAlpha;
    ctx.fillStyle = DAY;
    for (const [w0, w1, a] of [[7, 12, 0.12], [5, 9, 0.16], [3, 6, 0.22]]) {
      ctx.globalAlpha = was * a * p;
      poly(ctx, [door - w0 + 1, 0, door + w0 + 1, 0, door + w1, fy, door - w1, fy]);
      ctx.fill();
    }
    // Dust turning in it.
    ctx.fillStyle = DAY_HOT;
    for (let k = 0; k < 14; k++) {
      const q = ((v.clock / (5000 + k * 300) + k / 14) % 1 + 1) % 1;
      ctx.globalAlpha = was * p * 0.6 * Math.sin(q * Math.PI);
      circle(ctx, door - 4 + (hash(k, 3) % 9) + Math.sin(v.clock / 900 + k) * 0.8, fy - q * fy, 0.12 + (k % 3) * 0.05);
      ctx.fill();
    }
    // The door of light, standing in it.
    const dp = ease(clamp((b.t - DAYLIGHT_AT) / 900, 0, 1));
    if (dp > 0) {
      halo(ctx, door, fy - 8, 13, DAY, 0.8 * dp);
      ctx.globalAlpha = was * dp;
      ctx.fillStyle = GOLD;
      roundRect(ctx, door - 5, fy - 16.4, 10, 16.4, [5, 5, 0, 0]);
      ctx.fill();
      ctx.fillStyle = DAY;
      roundRect(ctx, door - 4.3, fy - 15.7, 8.6, 15.7, [4.3, 4.3, 0, 0]);
      ctx.fill();
      ctx.fillStyle = DAY_HOT;
      ctx.globalAlpha = was * dp * (0.6 + 0.3 * Math.sin(v.clock / 260));
      roundRect(ctx, door - 2.7, fy - 14, 5.4, 14, [2.7, 2.7, 0, 0]);
      ctx.fill();
    }
    ctx.globalAlpha = was;
  }

  /* -------------------------------------------------------------- hazards */

  // A root: cracks in the floor glowing red where it will come, shaking, a tip showing
  // at the crack; then a thick thorned root up out of the floor with a hooked tip.
  function heartRoot(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const t = v.clock;
    if (h.warn > 0) {
      const p = clamp(1 - h.warn / (h.full || 1), 0, 1);
      const sh = Math.sin(t / 28 + h.x) * 0.18 * p;
      ctx.strokeStyle = RED;
      ctx.lineWidth = 0.18 + 0.12 * p;
      ctx.globalAlpha = 0.35 + 0.55 * p;
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(h.x + sh, fy);
        ctx.lineTo(h.x + dir * (0.8 + p * 0.8) + sh, fy + 0.25);
        ctx.lineTo(h.x + dir * (1.4 + p * 1.6) + sh, fy + 0.05);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      halo(ctx, h.x, fy, 1.5 + 2 * p, RED, 0.35 + 0.4 * p);
      // Grit jumping off the floor.
      ctx.fillStyle = ROCK_LIT;
      for (let k = 0; k < 3; k++) {
        const q = ((t / 260 + k / 3) % 1);
        circle(ctx, h.x + (k - 1) * 0.9, fy - Math.sin(q * Math.PI) * (0.5 + p), 0.13);
        ctx.fill();
      }
      if (p > 0.55) {
        ctx.fillStyle = SNARE_LIT;
        poly(ctx, [h.x - 0.4 + sh, fy, h.x + sh, fy - (p - 0.55) * 2.4, h.x + 0.4 + sh, fy]);
        ctx.fill();
      }
      return;
    }
    const up = ease(clamp((ROOT_UP_MS - h.live) / 90, 0, 1)) * (h.live < 120 ? h.live / 120 : 1);
    const tall = h.h * up;
    const sway = Math.sin(t / 90 + h.x) * 0.3;
    halo(ctx, h.x, fy - tall * 0.5, 2.5 + tall * 0.4, RED, 0.35);
    ctx.fillStyle = SNARE;
    poly(ctx, [h.x - h.w / 2, fy, h.x - h.w * 0.3 + sway * 0.5, fy - tall * 0.55, h.x - 0.25 + sway, fy - tall, h.x + 0.6 + sway, fy - tall + 0.8, h.x + h.w * 0.32 + sway * 0.5, fy - tall * 0.5, h.x + h.w / 2, fy]);
    ctx.fill();
    // The hook at its tip, its bark and thorns.
    ctx.strokeStyle = SNARE;
    ctx.lineWidth = 0.45;
    ctx.beginPath();
    ctx.moveTo(h.x + sway, fy - tall + 0.3);
    ctx.quadraticCurveTo(h.x + 1.4 + sway, fy - tall - 0.8, h.x + 1.5 + sway, fy - tall + 0.6);
    ctx.stroke();
    ctx.strokeStyle = SNARE_LIT;
    ctx.lineWidth = 0.14;
    for (let k = 1; k < 4; k++) line(ctx, h.x - 0.6 + sway * (k / 4), fy - tall * (k / 4), h.x + 0.4 + sway * (k / 4), fy - tall * (k / 4) - 0.5);
    ctx.fillStyle = "#d09a5a";
    for (let k = 1; k < 4; k++) {
      const yk = fy - tall * (k / 4.5);
      const side = k % 2 ? -1 : 1;
      poly(ctx, [h.x + side * 0.7, yk, h.x + side * 1.5, yk - 0.4, h.x + side * 0.7, yk - 0.5]);
      ctx.fill();
    }
    ctx.fillStyle = ROCK_LIT;
    for (let k = 0; k < 4; k++) {
      ellipse(ctx, h.x - 1.4 + k * 0.95, fy - 0.15, 0.4, 0.22);
      ctx.fill();
    }
  }

  // A grab: roots hooking up over both ends of the ledge from below, curling in and
  // glowing as they tense; then a lashing tangle across the whole top.
  function heartGrab(ctx, v, h) {
    const fy = v.g.FIELD_H - h.y;
    const t = v.clock;
    const x0 = h.x0 ?? h.x - h.w / 2;
    const x1 = h.x1 ?? h.x + h.w / 2;
    if (h.warn > 0) {
      const p = clamp(1 - h.warn / (h.full || 1), 0, 1);
      const shake = Math.sin(t / 25) * 0.15 * p;
      for (const [edge, dir] of [[x0, 1], [x1, -1]]) {
        for (let k = 0; k < 3; k++) {
          const reach = (0.8 + p * 2.6) * (1 - k * 0.25);
          ctx.strokeStyle = k === 0 ? SNARE_LIT : SNARE;
          ctx.lineWidth = 0.42 - k * 0.08;
          ctx.beginPath();
          ctx.moveTo(edge - dir * 0.6, fy + 2.6 + k * 0.6);
          ctx.quadraticCurveTo(edge - dir * 1.4 + shake, fy - 0.8 - k * 0.3, edge + dir * reach + shake, fy - 0.4 - p * 0.6 + k * 0.25);
          ctx.stroke();
        }
        halo(ctx, edge + dir * (0.8 + p * 2.4), fy - 0.5, 1.4 + p * 1.6, RED, 0.3 + 0.45 * p);
      }
      // The ledge's top glowing faintly along its length as the grab comes.
      ctx.fillStyle = RED;
      ctx.globalAlpha = 0.15 + 0.35 * p * (0.6 + 0.4 * Math.sin(t / 60));
      ctx.fillRect(x0, fy - 0.15, x1 - x0, 0.3);
      ctx.globalAlpha = 1;
      return;
    }
    const lash = Math.sin(t / 40);
    halo(ctx, (x0 + x1) / 2, fy - 1.5, (x1 - x0) * 0.6, RED, 0.3);
    for (let k = 0; k < 4; k++) {
      ctx.strokeStyle = k % 2 ? SNARE : SNARE_LIT;
      ctx.lineWidth = 0.55 - k * 0.08;
      ctx.beginPath();
      ctx.moveTo(x0 - 0.5, fy + 0.4);
      for (let x = x0; x <= x1 + 0.5; x += 1) ctx.lineTo(x, fy - 0.6 - (k * 0.7 + 0.8) * (0.6 + 0.4 * Math.sin(x * 1.3 + k * 2 + lash * 2)));
      ctx.stroke();
    }
  }

  // A clot: the pipe bulging black over its spot, a strand dripping, a shadow on the floor
  // below growing; then a fat black glob falling, wet and red where light catches it.
  function heartClot(ctx, v, h) {
    const H = v.g.FIELD_H;
    const floorY = H - h.floor;
    const t = v.clock;
    if (h.warn > 0) {
      const p = clamp(1 - h.warn / (h.full || 1), 0, 1);
      const r = 0.5 + p * 1.1;
      ctx.fillStyle = CLOT;
      ellipse(ctx, h.x, PIPE_Y + PIPE_R + r * 0.6, r * 0.9, r);
      ctx.fill();
      ctx.fillStyle = CLOT_SHINE;
      ctx.globalAlpha = 0.7;
      ellipse(ctx, h.x - r * 0.35, PIPE_Y + PIPE_R + r * 0.35, r * 0.25, r * 0.35);
      ctx.fill();
      ctx.globalAlpha = 1;
      // A strand dripping off it now and then.
      const q = ((t / 420 + h.x) % 1 + 1) % 1;
      ctx.strokeStyle = CLOT;
      ctx.lineWidth = 0.15;
      line(ctx, h.x, PIPE_Y + PIPE_R + r * 1.4, h.x, PIPE_Y + PIPE_R + r * 1.4 + q * 2.4 * p);
      ctx.fillStyle = "#2a0408";
      ctx.globalAlpha = 0.35 + 0.5 * p;
      ellipse(ctx, h.x, floorY + 0.1, 0.8 + p * 1.2, 0.25 + p * 0.15);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const y = H - h.y - h.h / 2;
    ctx.fillStyle = "#2a0408";
    ctx.globalAlpha = 0.7;
    ellipse(ctx, h.x, floorY + 0.1, 2, 0.4);
    ctx.fill();
    ctx.globalAlpha = 1;
    halo(ctx, h.x, y, 2.6, RED, 0.35);
    ctx.fillStyle = CLOT;
    ellipse(ctx, h.x, y, h.w * 0.42, h.h * 0.62);
    ctx.fill();
    poly(ctx, [h.x - 0.5, y - h.h * 0.4, h.x, y - h.h * 1.4, h.x + 0.5, y - h.h * 0.4]);
    ctx.fill();
    ctx.strokeStyle = CLOT_SHINE;
    ctx.lineWidth = 0.18;
    ellipse(ctx, h.x, y, h.w * 0.42, h.h * 0.62);
    ctx.stroke();
    ctx.fillStyle = CLOT_SHINE;
    ellipse(ctx, h.x - 0.4, y - 0.3, 0.3, 0.55);
    ctx.fill();
  }

  // A chunk of roof: its shadow and grit trickling first, then a tumbling block of rock.
  function heartChunk(ctx, v, h) {
    const H = v.g.FIELD_H;
    const floorY = H - h.floor;
    const t = v.clock;
    if (h.warn > 0) {
      const p = clamp(1 - h.warn / (h.full || 1), 0, 1);
      ctx.fillStyle = "#000000";
      ctx.globalAlpha = 0.3 + 0.5 * p;
      ellipse(ctx, h.x, floorY + 0.1, 1 + p * 1.6, 0.3 + p * 0.15);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = ROCK_LIT;
      for (let k = 0; k < 4; k++) {
        const q = ((t / 520 + k / 4 + h.x * 0.1) % 1 + 1) % 1;
        circle(ctx, h.x + (k - 1.5) * 0.7, 2 + q * (floorY - 2), 0.14);
        ctx.fill();
      }
      halo(ctx, h.x, floorY, 1.5 + 1.5 * p, DANGER, 0.25 + 0.3 * p);
      return;
    }
    const y = H - h.y - h.h / 2;
    ctx.fillStyle = "#000000";
    ctx.globalAlpha = 0.6;
    ellipse(ctx, h.x, floorY + 0.1, 2.4, 0.45);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(h.x, y);
    if (typeof ctx.rotate === "function") ctx.rotate(t / 160 + h.x);
    ctx.fillStyle = "#6a5c58";
    poly(ctx, [-1.6, -0.8, -0.4, -1.4, 1.5, -0.9, 1.6, 0.6, 0.3, 1.3, -1.4, 0.9]);
    ctx.fill();
    ctx.fillStyle = "#3a302e";
    poly(ctx, [-0.4, -1.4, 1.5, -0.9, 0.6, 0, -0.6, -0.2]);
    ctx.fill();
    ctx.restore();
  }

  /* -------------------------------------------------------------- waves */

  // The beat's shockwave: a ripple of red light running along the floor, the stone
  // lifting in a crest (the thing to jump), grit thrown off behind it.
  function heartBeat(ctx, v, w, y) {
    const dir = w.dir || -1;
    halo(ctx, w.x, y - 0.8, 3, RED, 0.55);
    ctx.fillStyle = "#3a0c0c";
    ctx.beginPath();
    ctx.moveTo(w.x - dir * 2.6, y);
    ctx.quadraticCurveTo(w.x - dir * 0.9, y - 2.4, w.x + dir * 0.4, y - 2);
    ctx.quadraticCurveTo(w.x + dir * 1.3, y - 1.2, w.x + dir * 1.2, y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = RED;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(w.x - dir * 1.6, y - 1.5);
    ctx.quadraticCurveTo(w.x - dir * 0.4, y - 2.5, w.x + dir * 0.4, y - 2);
    ctx.quadraticCurveTo(w.x + dir * 1.1, y - 1.3, w.x + dir * 1.1, y - 0.2);
    ctx.stroke();
    ctx.fillStyle = ROCK_LIT;
    for (let k = 0; k < 4; k++) {
      const q = ((v.clock / 300 + k / 4) % 1);
      ctx.globalAlpha = 0.8 * (1 - q);
      circle(ctx, w.x - dir * (0.8 + k * 0.5 + q * 1.2), y - 1.6 - q * 1.4 + q * q * 2, 0.16);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // The big wave after the beat stops dead: darker, taller-looking, two crests and a
  // spray of stone.
  function heartBig(ctx, v, w, y) {
    const dir = w.dir || -1;
    halo(ctx, w.x, y - 1, 5, RED, 0.7);
    for (const [off, k] of [[0, 1], [-dir * 1.6, 0.7]]) {
      ctx.fillStyle = k === 1 ? "#4a0a0c" : "#2a0606";
      ctx.beginPath();
      ctx.moveTo(w.x + off - dir * 3.4, y);
      ctx.quadraticCurveTo(w.x + off - dir * 1.2, y - 3 * k, w.x + off + dir * 0.5, y - 2.4 * k);
      ctx.quadraticCurveTo(w.x + off + dir * 1.5, y - 1.4 * k, w.x + off + dir * 1.4, y);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = CORE_HOT;
    ctx.lineWidth = 0.3;
    ctx.beginPath();
    ctx.moveTo(w.x - dir * 1.8, y - 2);
    ctx.quadraticCurveTo(w.x - dir * 0.4, y - 3.1, w.x + dir * 0.5, y - 2.4);
    ctx.stroke();
    ctx.fillStyle = ROCK_LIT;
    for (let k = 0; k < 6; k++) {
      const q = ((v.clock / 260 + k / 6) % 1);
      ctx.globalAlpha = 0.85 * (1 - q);
      circle(ctx, w.x - dir * (0.6 + k * 0.6 + q * 1.6), y - 2.2 - q * 2.4 + q * q * 3, 0.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------ each frame */

  // The heart's pulse in the rock: the veins of the cavern glowing with each thump, and
  // drips falling off the roof pipe's joints.
  function moving(ctx, v, cam) {
    if (!ours(v) || !v.round) return;
    const b = v.round.boss;
    const pulse = b && b.kind === "marrowheart" ? pulseOf(v, b) : 0;
    const H = v.g.FIELD_H;
    if (pulse > 0.04) {
      ctx.strokeStyle = RED;
      ctx.lineWidth = 0.25;
      ctx.globalAlpha = 0.45 * pulse;
      for (let i = 0; i < 9; i++) {
        const side = i % 2 ? -1 : 1;
        let x = HEART_X + side * (14 + (hash(i, 4) % 12));
        let y = 8 + (hash(i, 9) % 32);
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += side * (2 + (hash(i, k) % 3));
          y += ((hash(k, i) % 5) - 2) * 0.9;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // A drip off a leaking joint now and then.
    ctx.fillStyle = CLOT_SHINE;
    for (let x = Math.ceil(Math.max(cam, PIPE_X0) / 6) * 6; x < Math.min(cam + v.g.FIELD_W, HEART_X - 12); x += 6) {
      if (!(hash(Math.round(x), 19) % 2)) continue;
      const q = ((v.clock / (1300 + (hash(Math.round(x), 2) % 5) * 200) + (x % 7) / 7) % 1 + 1) % 1;
      ctx.globalAlpha = 0.7 * (1 - q);
      circle(ctx, x, PIPE_Y + PIPE_R + q * (H - 6 - PIPE_Y - PIPE_R), 0.13);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Over everything (YOU included), before the dark: the red flooding the room on each
  // beat and while the ribs are open; in the hold, YOUR beam growing into a flood, the
  // weak ripples, the meter and HOLD FIRE; the white.
  function front(ctx, v) {
    if (!ours(v) || !v.round) return;
    const round = v.round;
    const b = round.boss;
    if (!b || b.kind !== "marrowheart") return;
    const W = v.g.FIELD_W;
    const H = v.g.FIELD_H;
    const cam = round.camX;
    const h = holdOf(v);
    const hold = !!(h && h.hold);
    if (b.state === "fight" && !hold) {
      const pulse = pulseOf(v, b);
      const o = ribsOf(v, b);
      const a = 0.08 * pulse + 0.12 * o;
      if (a > 0.01) {
        ctx.fillStyle = RED;
        ctx.globalAlpha = a;
        ctx.fillRect(cam - 1, 0, W + 2, H);
        ctx.globalAlpha = 1;
      }
    }
    if (hold && !h.final) {
      const you = round.you;
      const m = h.meter;
      // The beam: from the blaster, wider and longer as the meter fills, till it floods.
      if (you.out <= 0) {
        const bx = you.x + you.face * 2.6;
        const by = H - you.y - (you.ducking ? v.g.DUCK_SHOT_Y : v.g.SHOT_Y);
        const len = 46 + 60 * m;
        const half = 0.36 + 0.95 * m;
        const held = round.input.fire;
        ctx.fillStyle = BEAM;
        for (const [k, a] of [[1, 0.1], [0.7, 0.12], [0.4, 0.14]]) {
          ctx.globalAlpha = (held ? 1 : 0.5) * a * (0.6 + m);
          ctx.beginPath();
          ctx.moveTo(bx, by);
          const ang = you.face > 0 ? 0 : Math.PI;
          ctx.arc(bx, by, len * k + 6, ang - half * k, ang + half * k);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      // The weak beat's ripples.
      for (const w of h.waves) {
        const y = H - w.y;
        ctx.strokeStyle = "#ff8a70";
        ctx.lineWidth = 0.35;
        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        ctx.moveTo(w.x + 1.2, y);
        ctx.quadraticCurveTo(w.x + 0.2, y - HOLD_WAVE_H * 1.1, w.x - 1, y);
        ctx.stroke();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = "#ff5a40";
        ellipse(ctx, w.x, y - 0.3, 1.4, 0.5);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      // HOLD FIRE and the meter, under the boss's bar.
      const mx = cam + W / 2;
      const throb = 1 + 0.06 * Math.sin(v.clock / 140);
      label(ctx, "HOLD FIRE", mx, 10.5, 4.2 * throb, round.input.fire ? "#fff4c0" : GOLD, "center");
      roundRect(ctx, mx - 16, 13.6, 32, 2, 1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
      ctx.fill();
      roundRect(ctx, mx - 15.7, 13.9, 31.4 * clamp(m, 0, 1), 1.4, 0.7);
      ctx.fillStyle = blend("#f5b301", "#ffffff", m);
      ctx.fill();
    }
    const white = whiteOf(round);
    if (white > 0) {
      ctx.fillStyle = DAY_HOT;
      ctx.globalAlpha = clamp(white, 0, 1);
      ctx.fillRect(cam - 2, -2, W + 4, H + 4);
      ctx.globalAlpha = 1;
    }
  }

  /* -------------------------------------------------------------- light */

  // What lights the Pit: the heart's own red on each beat, flooding the room while its
  // ribs are open (a glimmer while it sleeps, nothing while the beat is stopped); its
  // warnings and waves, lit enough to read; in the hold YOUR beam's flood and the meter;
  // the white lifting the dark entirely; the daylight and its door.
  function lights(v, add) {
    if (!ours(v) || !v.round) return;
    const round = v.round;
    const b = round.boss;
    const H = v.g.FIELD_H;
    const cam = round.camX;
    const h = holdOf(v);
    if (b && b.kind === "marrowheart") {
      const pulse = pulseOf(v, b);
      const o = ribsOf(v, b);
      const hold = !!(h && h.hold);
      const top = b.y + 22;
      if (b.state === "sleep") add(HEART_X, top, 12 + 6 * pulse, 0.25 + 0.2 * pulse);
      else if (b.state !== "down" && !(h && h.final)) {
        if (b.stopMs > 0) add(HEART_X, top, 7 + 14 * clamp(1 - b.stopMs / SWELL_MS, 0, 1), 0.12 + 0.5 * clamp(1 - b.stopMs / SWELL_MS, 0, 1));
        else add(HEART_X, top, 18 + 12 * pulse + 12 * o, 0.4 + 0.45 * pulse + 0.15 * o);
        if (o > 0.05 && !hold) add(cam + v.g.FIELD_W * 0.55, 24, 60, 0.32 * o);
        if (pulse > 0.3 && !hold) add(cam + v.g.FIELD_W * 0.5, 22, 50, 0.22 * pulse);
      }
      if (hold && !h.final) {
        const you = round.you;
        const m = h.meter;
        const sy = you.y + (you.ducking ? v.g.DUCK_SHOT_Y : v.g.SHOT_Y);
        if (you.out <= 0 && round.input.fire) {
          for (let d = 6; d < 46 + 60 * m; d += 7) add(you.x + you.face * d, sy, 4 + d * (0.3 + 0.75 * m), 0.55 + 0.4 * m);
        }
        add(cam + v.g.FIELD_W / 2, 27, 20 + 70 * m, 0.7 * m);
        add(cam + v.g.FIELD_W / 2, H - 12, 18, 0.95);
        add(HEART_X, b.y + 20, 16, 0.5);
        for (const w of h.waves) add(w.x, w.y + 1.4, 4, 0.55);
      }
      const white = whiteOf(round);
      if (white > 0) for (const fx of [0.15, 0.5, 0.85]) add(cam + v.g.FIELD_W * fx, 27, 240, clamp(white * 1.2, 0, 1));
      if (b.state === "down" && b.t >= DAYLIGHT_AT - 500) {
        const p = clamp((b.t - DAYLIGHT_AT + 500) / 1400, 0, 1);
        const door = v.spec.door;
        const fy = v.groundAt(v.spec, door);
        for (let y = fy + 4; y < H; y += 9) add(door, y, 9, 0.6 * p);
        add(door, fy + 6, 16, 0.9 * p);
        add(door - 12, fy + 2, 14, 0.4 * p);
      }
    }
    for (const w of round.waves) if (w.kind === "heartBeat" || w.kind === "heartBig") add(w.x, w.y + 1.5, w.kind === "heartBig" ? 8 : 5, 0.6);
    for (const hz of round.hazards) {
      const p = hz.warn > 0 ? clamp(1 - hz.warn / (hz.full || 1), 0, 1) : 1;
      if (hz.kind === "heartRoot") add(hz.x, hz.y + (hz.warn > 0 ? 1 : 3), hz.warn > 0 ? 3 + 3 * p : 5, hz.warn > 0 ? 0.35 + 0.35 * p : 0.55);
      else if (hz.kind === "heartGrab") {
        add(hz.x0 ?? hz.x, hz.y + 1, 4, 0.3 + 0.35 * p);
        add(hz.x1 ?? hz.x, hz.y + 1, 4, 0.3 + 0.35 * p);
        if (hz.live > 0) add(hz.x, hz.y + 2, (hz.w || 6) * 0.7, 0.55);
      } else if (hz.kind === "heartClot") {
        add(hz.x, hz.floor + 1, 3.5, 0.45);
        add(hz.x, hz.warn > 0 ? CLOT_TOP : hz.y + 1, 3, 0.45);
      } else if (hz.kind === "heartChunk") add(hz.x, hz.warn > 0 ? hz.floor + 1 : hz.y + 1, 4, 0.45);
    }
  }

  /* ------------------------------------------------------------- events */

  // A telegraph's words, on the first few times only (counted in fx).
  function told(fx, key, n = 3) {
    fx.heartTold = fx.heartTold || {};
    fx.heartTold[key] = (fx.heartTold[key] || 0) + 1;
    return fx.heartTold[key] <= n;
  }

  // What the heart's events look and sound like, beside ghoul-draw.js's own (the shared
  // bossWake, bossHit, bossDown and bossBlock are its): true when `e` was one of them.
  // Each plays one voice; the ones that come several at once are gated.
  function react(e, k) {
    const { tone, burst, float, ring, glow, shake, flash, banner, fx } = k;
    if (e.type === "heartBeat") {
      say(tone, "marrowheart", "beat", 0.7);
      glow(e.x, e.y, 12, 0.6, 320);
      shake(80, 0.22);
    } else if (e.type === "heartWave") {
      // The dub: no voice of its own (the beat's second thump is it), grit off both lips.
      burst(LEFT_LIP - 0.5, e.y + 0.5, ROCK_LIT, 6, 8, 320);
      burst(RIGHT_LIP + 0.5, e.y + 0.5, ROCK_LIT, 4, 8, 320);
      shake(70, 0.3);
      if (told(fx, "wave", 2)) float(LEFT_LIP - 10, e.y + 6, "Jump the beat!", DANGER, 2.4);
    } else if (e.type === "heartOpen") {
      say(tone, "marrowheart", "open", 0.3);
      glow(e.x, e.y, 9, 0.5, 260);
      if (told(fx, "open", 2)) float(e.x - 14, e.y + 8, "The ribs are open: shoot!", GOLD, 2.4);
    } else if (e.type === "heartRootWind") {
      say(tone, "marrowheart", "rootWind", 0.5);
      for (const x of e.xs || []) ring(x, e.y, DANGER, 0.6, 2.6, 700);
      if (told(fx, "roots")) float(e.xs && e.xs.length ? e.xs[0] : e.x, e.y + 8, "Roots!", DANGER, 2.4);
    } else if (e.type === "heartRootCrack") {
      say(tone, "marrowheart", "rootCrack", 0.5);
      burst(e.x, e.y + 0.4, ROCK_LIT, 6, 6, 300);
    } else if (e.type === "heartRootUp") {
      if (gate(fx, "heartRootMs", 120)) say(tone, "marrowheart", "rootUp", 0.5);
      burst(e.x, e.y + 0.6, ROOT_LIT, 8, 10, 380);
      shake(60, 0.2);
    } else if (e.type === "heartGrabWind") {
      say(tone, "marrowheart", "grabWind", 0.5);
      ring(e.x, e.y, DANGER, 0.8, 4, 700);
      if (told(fx, "grab")) float(e.x, e.y + 7, "Off the ledge!", DANGER, 2.4);
    } else if (e.type === "heartGrabTense") {
      say(tone, "marrowheart", "grabTense", 0.5);
      glow(e.x, e.y + 1, 5, 0.5, 300);
    } else if (e.type === "heartGrabLash") {
      say(tone, "marrowheart", "grabLash", 0.6);
      burst(e.x, e.y + 1, ROOT_LIT, 10, 10, 380);
      shake(80, 0.25);
    } else if (e.type === "heartClotWind") {
      say(tone, "marrowheart", "clotWind", 0.5);
      for (const x of e.xs || []) ring(x, 6, DANGER, 0.6, 2.4, 700);
      if (told(fx, "clots")) float(e.xs && e.xs.length ? e.xs[0] : e.x, 16, "Clots!", DANGER, 2.4);
    } else if (e.type === "heartClotLand") {
      if (gate(fx, "heartClotMs", 120)) say(tone, "marrowheart", "clotLand", 0.45);
      burst(e.x, e.y + 0.4, CLOT_SHINE, 10, 10, 380);
    } else if (e.type === "heartQuake") {
      say(tone, "marrowheart", "quake", 0.7);
      shake(1000, 0.7);
      for (const x of e.xs || []) ring(x, 6, DANGER, 0.6, 3, 800);
      if (told(fx, "quake", 2)) float(e.x - 20, e.y + 14, "The roof is coming down!", DANGER, 2.4);
    } else if (e.type === "heartChunkLand") {
      if (gate(fx, "heartChunkMs", 120)) say(tone, "marrowheart", "chunk", 0.55);
      burst(e.x, e.y + 0.5, ROCK_LIT, 12, 12, 420);
      shake(100, 0.3);
    } else if (e.type === "heartStop") {
      say(tone, "marrowheart", "stop", 0.6);
      if (told(fx, "stop", 2)) float(e.x - 14, e.y + 10, "It stopped...", "#d9e4ff", 2.4);
    } else if (e.type === "heartSwell") {
      say(tone, "marrowheart", "swell", 0.7);
      glow(e.x, e.y, 14, 0.6, 700);
      float(e.x - 16, e.y + 12, "Brace yourself!", DANGER, 2.8);
    } else if (e.type === "heartSlam") {
      say(tone, "marrowheart", "slam", e.echo ? 0.65 : 0.85);
      flash("#600000", 220);
      shake(e.echo ? 260 : 420, e.echo ? 0.7 : 1.1);
      burst(e.x - 0.5, e.y + 0.6, ROCK_LIT, 16, 14, 520);
    } else if (e.type === "heartHold") {
      say(tone, "marrowheart", "hold", 0.9);
      flash("#fff3c4", 260);
      shake(260, 0.6);
      banner("HOLD FIRE", "Keep it held: flood it with YOUR light", GOLD, 2800);
    } else if (e.type === "heartWeakBeat") {
      say(tone, "marrowheart", "weakBeat", 0.45);
      glow(e.x, e.y, 8, 0.35, 300);
    } else if (e.type === "heartKnock") {
      say(tone, "marrowheart", "knock", 0.5);
      burst(e.x, e.y, "#ff8a70", 8, 8, 320);
      float(e.x, e.y + 5, "Hold on!", GOLD, 2.2);
    } else if (e.type === "heartFlood") {
      // A step higher at each quarter, and never the last note: that is the white's.
      tone(VOICES.marrowheart.flood, 0.5, 1 + (Math.max(1, e.n || 1) - 1) * 0.19);
      glow(e.x, e.y, 10 + 6 * (e.n || 1), 0.6, 500);
    } else if (e.type === "heartWhite") {
      say(tone, "marrowheart", "white", 0.85);
      flash("#ffffff", 600);
    } else if (e.type === "heartLast") {
      say(tone, "marrowheart", "last", 0.95);
      shake(520, 1.2);
    } else if (e.type === "heartDaylight") {
      say(tone, "marrowheart", "daylight", 0.6);
      glow(e.x, e.y, 14, 0.8, 900);
      float(e.x - 6, e.y + 10, "Daylight!", "#fff3c8", 2.6);
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
    bosses: freeze({ marrowheart }),
    missiles: freeze({}),
    hazards: freeze({ heartRoot, heartGrab, heartClot, heartChunk }),
    waves: freeze({ heartBeat, heartBig }),
    powers: freeze({}),
    lights,
    react,
    moving,
    front,
  });
}
