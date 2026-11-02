// Plan2Code Web Console - Ghoul Rush's Graveyard stage, its drawing: the rooms' looks out under the night sky (hills, dead trees, iron fences, fog and headstones), the open graves rotters climb out of, its monsters, Mother Mourning, the headstones she flings and her stone fists.
//
// ghoul-draw.js plugs it in. LOOKS is plain data; graveyardArt(d) takes
// ghoul-draw.js's own drawing helpers (`d`: ellipse, circle, roundRect, line,
// rotate, eye, hash, say, DANGER, FLASH and the eye colors) and hands back the drawing
// by kind, so this file never reaches back into it. Everything is drawn in
// room units, the way ghoul-draw.js draws: y counted down from the field's
// top, a monster from (x, y) at its feet.

import { ANGEL_TURN_MS, HANDS_RISE_MS, HANDS_SINK_MS, DIG_MS, ROBBER_UP_MS, WAIL_WIND_MS, FIST_LIVE_MS, FIST_WARN_MS } from "./ghoul-graveyard.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

// Out under the sky: the "wall" is the night, deepest at the top and foggy
// at the horizon (`wallTop`, `wallLow`), `paper` the hills, `wainscot` the
// fences and dead trees, `window` the moon, and `outdoor` tells ghoul-draw.js
// to draw this file's backdrop instead of a room's walls.
const night = (o) => freeze({ wallTop: "#05070f", wallLow: "#232a38", paper: "#121620", wainscot: "#0a0b10", floorTop: "#34422a", floor: "#211a12", floorEdge: "#0a0805", shelf: "#3e4148", shelfTop: "#62666e", pit: "#020202", window: "#dfe6f0", decor: "graves", dark: 0.8, outdoor: true, ...o });
export const LOOKS = freeze({
  lychgate: night({ color: "#9fb4c8", scene: "lychgate" }),
  graves: night({ color: "#a8b88a", floorTop: "#3a3424", scene: "graves" }),
  mausoleums: night({ color: "#b8a8c8", wallLow: "#2a2638", scene: "mausoleums" }),
  angel: night({ color: "#d0d6dc", wallLow: "#2c3038", floorTop: "#3c3e3a", scene: "angel" }),
});

const STONE = "#8d949b";
const STONE_DARK = "#4e545b";
const STONE_LIT = "#b4bcc3";
const DIRT = "#3a2c1e";
const DIRT_DARK = "#1e160e";
// A crow's feathers, their moonlit edge, the paler wing, and how much bigger
// than its body (the rules' w and h) it is drawn.
const CROW_INK = "#2c2836";
const CROW_RIM = "#a9b4cc";
const CROW_WING = "#5a5470";
const CROW_ART = 1.4;
const ROT = "#5f6e45";
const SKIN = "#6b7a5e";

export function graveyardArt(d) {
  const { ellipse, circle, roundRect, line, rotate, eye, hash, say, DANGER, FLASH, EYE_RED, EYE_PALE, EYE_AMBER } = d;

  // A headstone of one of four shapes standing on the floor at (x, fy),
  // leaning a little: rounded, a cross, an obelisk or a broken slab.
  function headstone(ctx, x, fy, n, size = 1) {
    const shape = n % 4;
    const lean = ((n % 7) - 3) * 0.04;
    ctx.save();
    ctx.translate(x, fy);
    rotate(ctx, lean);
    ctx.scale(size, size);
    ctx.fillStyle = STONE_DARK;
    if (shape === 0) {
      roundRect(ctx, -1.3, -3.6, 2.6, 3.6, [1.3, 1.3, 0, 0]);
      ctx.fill();
      ctx.fillStyle = STONE;
      roundRect(ctx, -1.1, -3.4, 2, 3.4, [1, 1, 0, 0]);
      ctx.fill();
    } else if (shape === 1) {
      ctx.fillRect(-0.35, -4.2, 0.7, 4.2);
      ctx.fillRect(-1.3, -3.3, 2.6, 0.7);
      ctx.fillStyle = STONE;
      ctx.fillRect(-0.25, -4.1, 0.45, 4.1);
    } else if (shape === 2) {
      ctx.beginPath();
      ctx.moveTo(-0.9, 0);
      ctx.lineTo(-0.6, -4.6);
      ctx.lineTo(0, -5.4);
      ctx.lineTo(0.6, -4.6);
      ctx.lineTo(0.9, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = STONE;
      ctx.fillRect(-0.45, -4.4, 0.5, 4.4);
    } else {
      ctx.beginPath();
      ctx.moveTo(-1.4, 0);
      ctx.lineTo(-1.4, -2.6);
      ctx.lineTo(-0.3, -3.2);
      ctx.lineTo(0.2, -2.4);
      ctx.lineTo(1.4, -2.9);
      ctx.lineTo(1.4, 0);
      ctx.closePath();
      ctx.fill();
    }
    // Lettering worn to scratches, and moss at the foot.
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    if (shape === 0 || shape === 3) for (const k of [-2.6, -2.1, -1.6]) ctx.fillRect(-0.7, k, 1.2, 0.12);
    ctx.fillStyle = "#2a3a20";
    ctx.fillRect(-1.1, -0.5, 2.2, 0.5);
    ctx.restore();
  }

  // A dead tree, bare and bent, rising from the hill line at (x, base).
  function deadTree(ctx, x, base, n) {
    const h = 12 + (n % 5) * 2.2;
    const bend = ((n % 3) - 1) * 1.4;
    ctx.strokeStyle = "#0a0b10";
    ctx.lineCap = "round";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.quadraticCurveTo(x + bend, base - h * 0.5, x + bend * 1.6, base - h);
    ctx.stroke();
    ctx.lineWidth = 0.4;
    for (let k = 0; k < 5; k++) {
      const at = 0.35 + k * 0.13;
      const bx = x + bend * at * 1.6;
      const by = base - h * at;
      const s = k % 2 ? 1 : -1;
      const len = 3 + (hash(n, k) % 4);
      line(ctx, bx, by, bx + s * len, by - len * 0.7);
      line(ctx, bx + s * len * 0.6, by - len * 0.42, bx + s * len * 0.8, by - len * 1.1);
    }
    ctx.lineCap = "butt";
  }

  // A stretch of iron fence, spiked, along the back of a floor piece.
  function fence(ctx, a, b, fy) {
    ctx.fillStyle = "#0b0c11";
    ctx.fillRect(a, fy - 5.2, b - a, 0.3);
    ctx.fillRect(a, fy - 1.6, b - a, 0.3);
    for (let x = Math.ceil(a / 1.4) * 1.4; x < b; x += 1.4) {
      ctx.fillRect(x - 0.12, fy - 5.8, 0.24, 5.8);
      ctx.beginPath();
      ctx.moveTo(x - 0.3, fy - 5.8);
      ctx.lineTo(x, fy - 6.6);
      ctx.lineTo(x + 0.3, fy - 5.8);
      ctx.fill();
    }
  }

  // A mausoleum's front behind the row: columns, a pediment, a black door.
  function mausoleum(ctx, x, fy, n) {
    const w = 14 + (n % 3) * 3;
    const h = 13 + (n % 2) * 3;
    ctx.fillStyle = "#1a1c24";
    ctx.fillRect(x - w / 2, fy - h, w, h);
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 1, fy - h);
    ctx.lineTo(x, fy - h - 4.5);
    ctx.lineTo(x + w / 2 + 1, fy - h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#262934";
    for (const s of [-1, 1]) for (const k of [0.32, 0.44]) ctx.fillRect(x + s * w * k - 0.6, fy - h + 1, 1.2, h - 1);
    ctx.fillStyle = "#050507";
    roundRect(ctx, x - 2.2, fy - 7.5, 4.4, 7.5, [2.2, 2.2, 0, 0]);
    ctx.fill();
    // A cross atop it.
    ctx.fillStyle = "#1a1c24";
    ctx.fillRect(x - 0.25, fy - h - 7, 0.5, 2.6);
    ctx.fillRect(x - 0.9, fy - h - 6.2, 1.8, 0.45);
  }

  // The night behind a room, from x0 to x1: the sky, stars, the moon, the
  // hills with dead trees, fences and mausoleums by the room, the fog, and
  // headstones along the floor.
  function backdrop(ctx, v, look, x0, x1) {
    const { spec, g } = v;
    const Y = (y) => g.FIELD_H - y;
    const sky = typeof ctx.createLinearGradient === "function" ? ctx.createLinearGradient(0, 0, 0, g.FIELD_H) : null;
    if (sky && typeof sky.addColorStop === "function") {
      sky.addColorStop(0, look.wallTop);
      sky.addColorStop(0.75, look.wallLow);
      sky.addColorStop(1, look.wallLow);
      ctx.fillStyle = sky;
    } else ctx.fillStyle = look.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, g.FIELD_H);
    ctx.fillStyle = "#cfd6e4";
    for (let x = Math.floor(x0 / 3) * 3; x < x1 + 3; x += 3) {
      const h = hash(Math.round(x / 3), 71);
      if (h % 5) continue;
      ctx.globalAlpha = 0.25 + (h % 4) * 0.12;
      ctx.fillRect(x + (h % 3), 1 + (h % 23), 0.18, 0.18);
    }
    ctx.globalAlpha = 1;
    // The moon, ringed, every 240 units, a cloud drawn across it.
    for (let x = Math.floor(x0 / 240) * 240 + 70; x < x1 + 12; x += 240) {
      ctx.fillStyle = look.window;
      ctx.globalAlpha = 0.08;
      circle(ctx, x, 9, 9);
      ctx.fill();
      ctx.globalAlpha = 0.9;
      circle(ctx, x, 9, 3.6);
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#9aa4b4";
      circle(ctx, x - 1.1, 8.2, 0.8);
      ctx.fill();
      circle(ctx, x + 0.9, 10.1, 0.6);
      ctx.fill();
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = "#0b0e18";
      ellipse(ctx, x + 1.5, 10.6, 5.5, 0.9);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Hills, low and rolling, and the trees on them.
    const hill = (x) => g.FIELD_H - 15 - Math.sin(x / 37) * 2.6 - Math.sin(x / 13 + 1) * 0.9;
    ctx.fillStyle = look.paper;
    ctx.beginPath();
    ctx.moveTo(x0, g.FIELD_H);
    for (let x = x0; x <= x1 + 1; x += 2) ctx.lineTo(x, hill(x));
    ctx.lineTo(x1 + 1, g.FIELD_H);
    ctx.closePath();
    ctx.fill();
    for (let x = Math.floor(x0 / 44) * 44 + 9; x < x1 + 20; x += 44) {
      const n = Math.round(x / 44);
      if (hash(n, 13) % 3 === 0) continue;
      deadTree(ctx, x + (hash(n, 4) % 12), hill(x) + 0.5, n);
    }
    const floorAt = (x) => {
      const gy = v.groundAt(spec, x);
      return gy > -Infinity ? Y(gy) : null;
    };
    if (look.scene === "mausoleums" || look.scene === "angel") {
      for (let x = Math.floor(x0 / 52) * 52 + 20; x < x1 + 26; x += 52) {
        const n = Math.round(x / 52);
        const fy = floorAt(x);
        if (fy !== null && hash(n, 8) % 3) mausoleum(ctx, x, fy, n);
      }
    }
    for (const [a, b, top] of spec.ground) {
      if (b < x0 - 1 || a > x1 + 1) continue;
      for (let x = Math.ceil(a / 30) * 30; x < b; x += 30) {
        if (hash(Math.round(x / 30), 19) % 2) continue;
        fence(ctx, Math.max(a, x), Math.min(b, x + 18), Y(top));
      }
    }
    // Fog lying over the ground.
    ctx.fillStyle = "#8a96aa";
    for (let x = Math.floor(x0 / 16) * 16; x < x1 + 16; x += 16) {
      const h = hash(Math.round(x / 16), 27);
      ctx.globalAlpha = 0.05 + (h % 4) * 0.015;
      ellipse(ctx, x + (h % 9), g.FIELD_H - 10 - (h % 5), 11, 2.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Headstones along the floor, in rows.
    for (let x = Math.floor(x0 / 9) * 9 + 3; x < x1 + 9; x += 9) {
      const n = Math.round(x / 9);
      if (hash(n, 5) % 3 === 0) continue;
      const fy = floorAt(x);
      if (fy === null || floorAt(x - 1.5) !== fy || floorAt(x + 1.5) !== fy) continue;
      headstone(ctx, x + (hash(n, 2) % 4), fy, hash(n, 11), 0.8 + (hash(n, 6) % 3) * 0.12);
    }
  }

  // A grave a rotter will climb out of: a mound of turned earth and its stone.
  function grave(ctx, x, fy) {
    headstone(ctx, x + 2.6, fy, Math.round(x), 1);
    ctx.fillStyle = DIRT;
    ellipse(ctx, x, fy, 3.2, 0.9);
    ctx.fill();
    ctx.fillStyle = DIRT_DARK;
    for (const k of [-1.6, 0, 1.4]) {
      ellipse(ctx, x + k, fy - 0.4, 0.5, 0.25);
      ctx.fill();
    }
  }

  // The grave open, something in it watching.
  function openGrave(ctx, v, x, fy) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(x - 2.6, fy - 0.6, 5.2, 1.2);
    ctx.fillStyle = DIRT;
    ellipse(ctx, x - 3.6, fy - 0.5, 1.4, 0.8);
    ctx.fill();
    ellipse(ctx, x + 3.4, fy - 0.4, 1.2, 0.7);
    ctx.fill();
    const blink = Math.floor((v.clock + x * 97) / 1700) % 5 === 0;
    if (!blink) {
      eye(v, x - 0.6, fy - 0.1, 0.17, EYE_RED);
      eye(v, x + 0.6, fy - 0.1, 0.17, EYE_RED);
    }
  }

  /* ---------------------------------------------------------- monsters */

  // A low mound of dirt, trembling (and trailing clods when it moves).
  function mound(ctx, x, y, t, moving) {
    const shake = moving ? Math.sin(t / 30) * 0.2 : Math.sin(t / 400) * 0.05;
    ctx.fillStyle = DIRT;
    ellipse(ctx, x + shake, y - 0.15, 1.8, 0.55);
    ctx.fill();
    ctx.fillStyle = DIRT_DARK;
    for (const k of [-0.8, 0.3, 0.9]) {
      circle(ctx, x + k + shake, y - 0.4 - Math.abs(Math.sin(t / 90 + k)) * (moving ? 0.6 : 0.1), 0.22);
      ctx.fill();
    }
  }

  // Grasping hands: under the dirt a trembling mound; then two grey arms
  // burst up and claw at the air, and sink again.
  function hands(ctx, v, m, x, y, t, flash) {
    if (m.act === "lurk" || m.act === "creep") return mound(ctx, x, y, t, m.act === "creep");
    let up = 1;
    if (m.act === "rise") up = 1 - m.wait / HANDS_RISE_MS;
    else if (m.act === "sink") up = m.wait / HANDS_SINK_MS;
    mound(ctx, x, y, t, true);
    const reach = 3.1 * up;
    ctx.strokeStyle = flash ? FLASH : SKIN;
    ctx.lineCap = "round";
    for (const s of [-1, 1]) {
      const sway = Math.sin(t / 140 + s) * 0.35 * up;
      const bx = x + s * 0.7;
      const tx = bx + s * 0.4 + sway;
      ctx.lineWidth = 0.55;
      line(ctx, bx, y, tx, y - reach);
      // Fingers, clawing open and shut.
      const claw = 0.25 + Math.abs(Math.sin(t / 110 + s)) * 0.35;
      ctx.lineWidth = 0.16;
      for (const k of [-1, 0, 1]) line(ctx, tx, y - reach, tx + k * claw + s * 0.1, y - reach - 0.8 * up);
    }
    ctx.lineCap = "butt";
    if (!flash) {
      ctx.fillStyle = "rgba(20, 14, 8, 0.8)";
      for (const s of [-1, 1]) {
        ellipse(ctx, x + s * 0.75, y - 0.3, 0.45, 0.3);
        ctx.fill();
      }
    }
  }

  // A mourner: a tall figure in black lace drifting just above the grass,
  // her veil down; lifting it to wail shows a white face, the mouth a hole.
  function mourner(ctx, v, m, x, y, t, flash) {
    const float = Math.sin(t / 380) * 0.3;
    const lift = m.windup > 0 ? 1 - m.windup / WAIL_WIND_MS : 0;
    const base = y - 0.4 + float;
    const dress = flash ? FLASH : "#2a2236";
    ctx.fillStyle = dress;
    ctx.beginPath();
    ctx.moveTo(x - 0.8, base - 4.4);
    ctx.lineTo(x + 0.8, base - 4.4);
    for (let k = 0; k <= 6; k++) ctx.lineTo(x + 1.8 - k * 0.6, base + (k % 2 ? -0.5 : 0) + Math.sin(t / 160 + k) * 0.15);
    ctx.closePath();
    ctx.fill();
    // Pale lace at the hem, trailing off into nothing.
    if (!flash) {
      ctx.strokeStyle = "#a9a2b8";
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) ctx.lineTo(x + 1.8 - k * 0.6, base + (k % 2 ? -0.5 : 0) + Math.sin(t / 160 + k) * 0.15);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Thin arms, hands clasped, or flung wide in the wail.
    ctx.strokeStyle = flash ? FLASH : "#c9c4cf";
    ctx.lineWidth = 0.22;
    const wide = lift * 1.6;
    for (const s of [-1, 1]) line(ctx, x + s * 0.6, base - 4, x + s * (0.4 + wide), base - 2.8 - wide * 0.6);
    // The head, then the veil over it: long black lace to her shoulders,
    // gathered up off the face as she lifts it.
    ctx.fillStyle = flash ? FLASH : "#e8e4ee";
    ellipse(ctx, x + m.dir * 0.1, base - 5, 0.7, 0.85);
    ctx.fill();
    if (lift > 0.3 && !flash) {
      ctx.fillStyle = "#0a0608";
      ellipse(ctx, x + m.dir * 0.12, base - 4.6, 0.32, 0.25 + lift * 0.3);
      ctx.fill();
    }
    ctx.fillStyle = flash ? FLASH : "#0d0b12";
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.moveTo(x - 1.1, base - 3.6 - lift * 2);
    ctx.quadraticCurveTo(x, base - 6.6, x + 1.1, base - 3.6 - lift * 2);
    ctx.lineTo(x + 1.3, base - 3.2 - lift * 2.4);
    ctx.quadraticCurveTo(x, base - 3.7 - lift * 2.4, x - 1.3, base - 3.2 - lift * 2.4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    const ec = lift > 0.3 ? "#ffffff" : EYE_PALE;
    eye(v, x - 0.25 + m.dir * 0.15, base - 5.15, lift > 0.3 ? 0.17 : 0.09, ec);
    eye(v, x + 0.25 + m.dir * 0.15, base - 5.15, lift > 0.3 ? 0.17 : 0.09, ec);
  }

  // A grave robber: hunched in a long coat and a hat, a shovel on his
  // shoulder; digging in, the shovel bites and dirt flies; under the ground
  // a mound races along; climbing out, he comes up out of the dirt.
  function robber(ctx, v, m, x, y, t, flash) {
    if (m.act === "under") return mound(ctx, x, y, t, true);
    let sunk = 0;
    if (m.act === "dig") sunk = 1 - m.wait / DIG_MS;
    else if (m.act === "up") sunk = m.wait / ROBBER_UP_MS;
    const d = m.dir;
    const step = m.act === "walk" ? Math.sin(t / 120) : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 6, y - 12, 12, 12);
    if (typeof ctx.clip === "function") ctx.clip();
    ctx.translate(x, y + sunk * 4.8);
    const coat = flash ? FLASH : "#3a2c1c";
    ctx.strokeStyle = flash ? FLASH : "#1a140e";
    ctx.lineWidth = 0.5;
    line(ctx, -0.5, -1.6, -0.5 + step * 0.5, 0);
    line(ctx, 0.5, -1.6, 0.5 - step * 0.5, 0);
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.moveTo(-1.3, -3.9);
    ctx.lineTo(1.1, -3.6);
    ctx.lineTo(1.4, -1.2);
    ctx.lineTo(-1.5, -1.3);
    ctx.closePath();
    ctx.fill();
    // The shovel: over his shoulder walking, driven down digging.
    ctx.strokeStyle = flash ? FLASH : "#6a5034";
    ctx.lineWidth = 0.28;
    if (m.act === "dig") {
      line(ctx, d * 1.2, -3.4, d * 1.8, 0.2);
      ctx.fillStyle = "#7a7e84";
      ctx.fillRect(d * 1.8 - 0.5, -0.4, 1, 1);
      ctx.fillStyle = DIRT;
      for (let k = 0; k < 4; k++) {
        const p = ((t / 300 + k * 0.25) % 1);
        circle(ctx, d * (1.8 - p * 3), -p * 4 + p * p * 3, 0.25);
        ctx.fill();
      }
    } else {
      line(ctx, -d * 1.6, -1.8, d * 1.6, -4.6);
      ctx.fillStyle = "#7a7e84";
      ctx.beginPath();
      ctx.moveTo(-d * 1.6, -1.8);
      ctx.lineTo(-d * 2.3, -1.1);
      ctx.lineTo(-d * 2.1, -2.2);
      ctx.closePath();
      ctx.fill();
    }
    // A long grey face under the hat, a grin of teeth.
    ctx.fillStyle = flash ? FLASH : "#8a8e80";
    ellipse(ctx, d * 0.35, -4.4, 0.8, 0.85);
    ctx.fill();
    ctx.fillStyle = flash ? FLASH : "#141016";
    ctx.fillRect(-1.1, -5.4, 2.4, 0.35);
    roundRect(ctx, -0.6, -6.3, 1.5, 1, 0.3);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#d8d0b8";
      for (const k of [0.1, 0.35, 0.6]) ctx.fillRect(d * k, -4.0, 0.12, 0.2);
    }
    ctx.restore();
    if (sunk < 0.7) eye(v, x + d * 0.6, y + sunk * 4.8 - 4.6, 0.11, EYE_AMBER);
  }

  // A rotter: a zombie gone green and thin, ribs showing, the jaw hanging.
  function rotter(ctx, v, m, x, y, t, flash) {
    const sprint = m.lurching;
    const lean = (sprint ? 0.3 : 0.1) * m.dir;
    const step = Math.sin(t / (sprint ? 60 : 160));
    const d = m.dir;
    const skin = flash ? FLASH : ROT;
    ctx.globalAlpha = m.rise > 0 ? Math.max(0.15, 1 - m.rise / 350) : 1;
    ctx.save();
    ctx.translate(x, y + (m.rise > 0 ? (m.rise / 350) * 3 : 0));
    rotate(ctx, lean);
    ctx.lineCap = "round";
    ctx.strokeStyle = flash ? FLASH : "#2a2a1a";
    ctx.lineWidth = 0.5;
    line(ctx, -0.5, -2, -0.5 + step * 0.6, 0);
    line(ctx, 0.5, -2, 0.5 - step * 0.4, 0);
    // A torn shroud, the ribs through it.
    ctx.fillStyle = flash ? FLASH : "#5a5446";
    ctx.beginPath();
    ctx.moveTo(-1.1, -4);
    ctx.lineTo(1.1, -4);
    ctx.lineTo(1, -1.9);
    ctx.lineTo(-1, -1.9);
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#1a1a10";
      ellipse(ctx, d * 0.3, -3, 0.6, 0.75);
      ctx.fill();
      ctx.strokeStyle = "#cfc4a6";
      ctx.lineWidth = 0.1;
      for (const k of [-3.4, -3, -2.6]) line(ctx, d * -0.1, k, d * 0.7, k + 0.1);
    }
    ctx.strokeStyle = skin;
    ctx.lineWidth = 0.38;
    if (m.lift > 0.5 || m.scale) {
      const claw = Math.sin(t / 90) * 0.5;
      line(ctx, d * 0.7, -3.7, d * (0.9 + claw * 0.4), -6.4);
      line(ctx, -d * 0.4, -3.6, -d * (0.5 - claw * 0.4), -6.1);
    } else {
      const reach = d * (2.5 + Math.sin(t / 130) * 0.3);
      line(ctx, d * 0.8, -3.6, reach, -3.8 + step * 0.2);
      line(ctx, d * 0.2, -3.3, reach - d * 0.5, -3.1 - step * 0.2);
    }
    // The head, half a skull, the jaw hanging loose.
    ctx.fillStyle = skin;
    ellipse(ctx, d * 0.25, -4.7, 0.9, 1, 0.2 * d);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#cfc4a6";
      ellipse(ctx, -d * 0.25, -5.1, 0.45, 0.4);
      ctx.fill();
      ctx.fillStyle = "#0a0806";
      circle(ctx, d * 0.05, -4.9, 0.25);
      ctx.fill();
      circle(ctx, d * 0.6, -4.9, 0.22);
      ctx.fill();
      ctx.fillStyle = skin;
      ctx.fillRect(d * 0.1, -3.9 + Math.abs(Math.sin(t / 220)) * 0.3, d * 0.7, 0.3);
    }
    ctx.lineCap = "butt";
    ctx.restore();
    ctx.globalAlpha = 1;
    eye(v, x + d * 0.05 + lean * 4.9, y - 4.9, 0.1, "#c8ff3a");
  }

  // A rotter's legs, still walking: a hip of bone and two legs, fast.
  function legs(ctx, v, m, x, y, t, flash) {
    const step = Math.sin(t / 45);
    ctx.strokeStyle = flash ? FLASH : "#2a2a1a";
    ctx.lineCap = "round";
    ctx.lineWidth = 0.5;
    line(ctx, x - 0.4, y - 2, x - 0.4 + step * 0.8, y);
    line(ctx, x + 0.4, y - 2, x + 0.4 - step * 0.8, y);
    ctx.lineCap = "butt";
    ctx.fillStyle = flash ? FLASH : "#cfc4a6";
    ellipse(ctx, x, y - 2.2, 0.9, 0.45);
    ctx.fill();
    if (!flash) {
      ctx.fillStyle = "#5a0a0a";
      ellipse(ctx, x, y - 2.55, 0.6, 0.2);
      ctx.fill();
    }
  }

  // A carrion crow: on its headstone it hunches and bobs; in the air its
  // wings beat; diving, they fold back to a dart. Drawn CROW_ART times its
  // size about its middle, in dusky feathers with a moonlit edge, so it reads
  // against the night sky rather than as a pair of red eyes.
  function crow(ctx, v, m, x, y, t, flash) {
    const d = m.dir;
    const k = CROW_ART;
    const cy = y - 0.8;
    // A point (dx, dy) from (x, y), grown about the crow's middle.
    const at = (dx, dy) => [x + dx * k, cy + (dy + 0.8) * k];
    const shape = (draw) => {
      ctx.beginPath();
      draw();
      ctx.fillStyle = flash ? FLASH : CROW_INK;
      ctx.fill();
      if (flash) return;
      ctx.globalAlpha = 0.43;
      ctx.strokeStyle = CROW_RIM;
      ctx.lineWidth = 0.22;
      ctx.stroke();
      ctx.globalAlpha = 1;
    };
    const poly = (...pts) => () => {
      pts.forEach(([dx, dy], i) => ctx[i ? "lineTo" : "moveTo"](...at(dx, dy)));
      ctx.closePath();
    };
    const oval = (dx, dy, rx, ry, rot = 0) => () => {
      const [px, py] = at(dx, dy);
      if (typeof ctx.ellipse === "function") ctx.ellipse(px, py, rx * k, ry * k, rot, 0, TAU);
      else ctx.arc(px, py, Math.max(rx, ry) * k, 0, TAU);
    };
    if (m.act === "perch") {
      const bob = Math.abs(Math.sin(t / 500)) * 0.2;
      shape(poly([-d * 0.6, -0.75], [-d * 1.5, -0.6], [-d * 1.5, -0.95], [-d * 0.6, -1.05]));
      shape(oval(0, -0.8, 0.85, 0.7));
      shape(oval(d * 0.6, -1.6 + bob, 0.45, 0.45));
      shape(poly([d * 0.95, -1.75 + bob], [d * 1.65, -1.55 + bob], [d * 0.95, -1.4 + bob]));
      // A paler wing folded along its side.
      if (!flash) {
        ctx.fillStyle = CROW_WING;
        ellipse(ctx, ...at(-d * 0.15, -0.85), 0.55 * k, 0.32 * k, d * 0.3);
        ctx.fill();
      }
      eye(v, ...at(d * 0.75, -1.7 + bob), 0.11, EYE_RED);
      return;
    }
    const dive = m.act === "dive";
    const flap = dive ? -0.6 : Math.sin(t / 45);
    for (const s of [-1, 1]) {
      shape(poly([0, -0.8], [s * (dive ? 1 : 2.2) - d * (dive ? 1 : 0), -1.1 - flap * 1.1], [s * (dive ? 0.6 : 1.4) - d * (dive ? 1.4 : 0.4), -0.5 - flap * 0.4]));
      // The wing's long feathers, paler toward the tip.
      if (!flash && !dive) {
        ctx.strokeStyle = CROW_WING;
        ctx.lineWidth = 0.16;
        ctx.beginPath();
        ctx.moveTo(...at(s * 0.5, -0.85 - flap * 0.25));
        ctx.lineTo(...at(s * 1.8, -1.05 - flap * 0.95));
        ctx.stroke();
      }
    }
    shape(oval(0, -0.8, 1, 0.45, dive ? Math.atan2(m.vy, m.vx * d) * -d * 0.6 : 0));
    shape(poly([-d * 0.8, -0.8], [-d * 1.5, -0.55], [-d * 1.5, -1.05]));
    shape(poly([d * 0.9, -0.95], [d * 1.65, -0.8], [d * 0.9, -0.62]));
    eye(v, ...at(d * 0.7, -0.95), 0.11, EYE_RED);
  }

  /* --------------------------------------------------------- the angel */

  // Mother Mourning, standing at (b.x, b.y): a stone angel twice your
  // height, her robe falling to a plinth, wings folded behind her (spread
  // wide once she is in a rage), her face in her hands while she weeps; she
  // lowers them as she turns, and watching, her eyes burn white. Stone
  // tears run down her cheeks, and cracks spread as she is hurt.
  function angel(ctx, v, b) {
    const { g } = v;
    const x = b.x;
    const y = g.FIELD_H - b.y;
    const flash = b.hurt > 0;
    const stone = flash ? FLASH : STONE;
    const dark = flash ? FLASH : STONE_DARK;
    const raged = Boolean(b.raged);
    const show = b.act === "watch" ? 1 : b.act === "turn" ? Math.min(1, 1 - Math.max(0, b.wait) / ANGEL_TURN_MS) : 0;
    // The plinth.
    ctx.fillStyle = dark;
    ctx.fillRect(x - 4.6, y - 2.2, 9.2, 2.2);
    ctx.fillStyle = stone;
    ctx.fillRect(x - 4.2, y - 2.6, 8.4, 0.6);
    // Wings: folded tall behind her, or spread wide in a rage.
    ctx.fillStyle = dark;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      if (raged) {
        ctx.moveTo(x + s * 1.4, y - 15);
        ctx.quadraticCurveTo(x + s * 9, y - 22, x + s * 12, y - 17);
        ctx.lineTo(x + s * 10, y - 14.5);
        ctx.lineTo(x + s * 11, y - 12);
        ctx.lineTo(x + s * 8.5, y - 11.5);
        ctx.lineTo(x + s * 9, y - 9);
        ctx.quadraticCurveTo(x + s * 5, y - 10, x + s * 1.6, y - 11);
      } else {
        ctx.moveTo(x + s * 1.2, y - 16);
        ctx.quadraticCurveTo(x + s * 4.6, y - 21, x + s * 4.4, y - 14);
        ctx.quadraticCurveTo(x + s * 4.2, y - 8, x + s * 2.6, y - 4);
        ctx.lineTo(x + s * 1.6, y - 6);
      }
      ctx.closePath();
      ctx.fill();
      if (!flash) {
        ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
        ctx.lineWidth = 0.15;
        for (let k = 1; k <= 4; k++) line(ctx, x + s * 1.6, y - 15 + k * 0.4, x + s * (raged ? 4 + k * 1.6 : 2.4 + k * 0.4), y - (raged ? 15 - k * 0.6 : 15 - k * 2.2));
      }
    }
    // The robe, in long folds.
    ctx.fillStyle = stone;
    ctx.beginPath();
    ctx.moveTo(x - 1.5, y - 15.5);
    ctx.lineTo(x + 1.5, y - 15.5);
    ctx.quadraticCurveTo(x + 2.6, y - 8, x + 3.4, y - 2.6);
    ctx.lineTo(x - 3.4, y - 2.6);
    ctx.quadraticCurveTo(x - 2.6, y - 8, x - 1.5, y - 15.5);
    ctx.closePath();
    ctx.fill();
    if (!flash) {
      ctx.strokeStyle = STONE_DARK;
      ctx.lineWidth = 0.18;
      for (const k of [-1.6, -0.5, 0.6, 1.7]) line(ctx, x + k * 0.5, y - 14, x + k * 1.3, y - 2.8);
      ctx.fillStyle = STONE_LIT;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x - 0.9, y - 15, 0.5, 12);
      ctx.globalAlpha = 1;
    }
    // The head under a hood of stone.
    const hy = y - 17.3;
    ctx.fillStyle = stone;
    ellipse(ctx, x, hy, 1.5, 1.8);
    ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath();
    ctx.moveTo(x - 1.8, hy + 1.4);
    ctx.quadraticCurveTo(x, hy - 3.2, x + 1.8, hy + 1.4);
    ctx.quadraticCurveTo(x, hy - 1.6, x - 1.8, hy + 1.4);
    ctx.fill();
    // Hands: up over the face while she weeps, lowering as she turns.
    const hands = (1 - show) * 2.6;
    ctx.fillStyle = stone;
    for (const s of [-1, 1]) {
      ctx.strokeStyle = stone;
      ctx.lineWidth = 0.75;
      line(ctx, x + s * 1.4, y - 14.8, x + s * (0.8 - show * 0.2), hy + 0.6 + (2.6 - hands) * 1.8);
      ellipse(ctx, x + s * 0.55, hy + 0.3 + (2.6 - hands) * 1.8, 0.65, 0.95);
      ctx.fill();
    }
    if (!flash) {
      // Tears worn into the stone.
      ctx.strokeStyle = "rgba(20, 24, 30, 0.6)";
      ctx.lineWidth = 0.12;
      for (const s of [-1, 1]) line(ctx, x + s * 0.5, hy + 0.2, x + s * 0.6, hy + 3.4);
      // Cracks as she is worn down.
      const worn = 1 - b.hp / Math.max(1, b.max);
      ctx.strokeStyle = "rgba(10, 12, 16, 0.7)";
      for (let k = 0; k < Math.floor(worn * 8); k++) {
        const cx = x + ((hash(k, 3) % 50) / 10 - 2.5);
        const cy = y - 4 - (hash(k, 7) % 110) / 10;
        line(ctx, cx, cy, cx + 0.6, cy + 0.9);
        line(ctx, cx + 0.6, cy + 0.9, cx + 0.2, cy + 1.6);
      }
    }
    // Watching: her eyes open and burn.
    if (show > 0.2) {
      const r = 0.12 + show * 0.16;
      eye(v, x - 0.55, hy - 0.2, r, "#ffffff");
      eye(v, x + 0.55, hy - 0.2, r, "#ffffff");
    }
  }

  // A headstone flung end over end.
  function stone(ctx, x, y, spin) {
    ctx.save();
    ctx.translate(x, y);
    rotate(ctx, spin);
    ctx.fillStyle = STONE_DARK;
    roundRect(ctx, -0.8, -1.1, 1.6, 2.2, [0.8, 0.8, 0, 0]);
    ctx.fill();
    ctx.fillStyle = STONE;
    roundRect(ctx, -0.6, -0.95, 1.2, 1.9, [0.6, 0.6, 0, 0]);
    ctx.fill();
    ctx.restore();
  }

  // A stone fist: first its shadow on the floor, darkening and closing in;
  // then the fist itself, down on the floor with dust; then lifting away.
  function fist(ctx, v, h) {
    const { g } = v;
    const fy = g.FIELD_H - h.y;
    if (h.warn > 0) {
      const p = 1 - h.warn / FIST_WARN_MS;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.globalAlpha = 0.3 + p * 0.6;
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.5 - p * 0.5), 0.6);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
    const lifted = h.live < 0 ? (-h.live / FIST_LIVE_MS) * 26 : 0;
    const bottom = fy - lifted;
    ctx.fillStyle = STONE_DARK;
    ctx.fillRect(h.x - 1.6, 0, 3.2, bottom - h.h + 1);
    ctx.fillStyle = STONE;
    roundRect(ctx, h.x - h.w / 2, bottom - h.h * 0.55, h.w, h.h * 0.55, 1.2);
    ctx.fill();
    ctx.fillStyle = STONE_DARK;
    for (let k = 0; k < 4; k++) {
      roundRect(ctx, h.x - h.w / 2 + 0.3 + k * ((h.w - 0.6) / 4), bottom - 1.6, (h.w - 0.6) / 4 - 0.2, 1.6, 0.5);
      ctx.fill();
    }
    ctx.fillStyle = STONE_LIT;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(h.x - h.w / 2 + 0.4, bottom - h.h * 0.5, 0.5, h.h * 0.4);
    ctx.globalAlpha = 1;
    if (h.live > 0) {
      ctx.fillStyle = "rgba(150, 140, 120, 0.5)";
      for (const s of [-1, 1]) {
        ellipse(ctx, h.x + s * (h.w / 2 + 0.8), fy - 0.5, 1.2, 0.5);
        ctx.fill();
      }
    }
  }

  // What lights the dark here: a mourner's faint glow (her face brighter
  // as she wails), a crow's moonlit sheen, Mother Mourning's eyes while she
  // watches.
  function lights(v, add) {
    for (const m of v.round.monsters) {
      if (m.kind === "mourner") add(m.x, m.y + m.h * 0.7, m.windup > 0 ? 6 : 3.4, m.windup > 0 ? 0.45 : 0.22);
      // A crow catches a little of the moon, so it shows in the dark.
      else if (m.kind === "crow") add(m.x, m.y + 0.8, 3.2, 0.3);
    }
    const b = v.round.boss;
    if (b && b.kind === "angel" && (b.act === "watch" || b.act === "turn") && b.state === "fight") add(b.x, b.y + b.h - 2.7, 9, 0.5);
  }

  // What the Graveyard's events look and sound like, beside ghoul-draw.js's
  // own (the kinds' voices are VOICES there): true when `e` was one of them.
  // `k` is the same kit react() is handed.
  function react(e, k) {
    const { tone, burst, float, ring, flash, glow, shake } = k;
    if (e.type === "grab") {
      say(tone, e.kind, "grab", 0.45);
      burst(e.x, e.y + 0.5, "#3a2c1e", 8, 8, 400);
    } else if (e.type === "wailWind") say(tone, e.kind, "appear", 0.3);
    else if (e.type === "wail") {
      say(tone, e.kind, "wail", 0.5);
      ring(e.x, e.y, "#e8e4ee", 2, 20, 600);
    } else if (e.type === "slowed") {
      float(e.x, e.y + 7, "Slowed", "#c9c4cf", 2);
      tone("ghoulToll", 0.2, 1.6);
    } else if (e.type === "dig") {
      say(tone, e.kind, "dig", 0.4);
      burst(e.x, e.y + 0.5, "#3a2c1e", 10, 10, 450);
    } else if (e.type === "unearth") {
      say(tone, e.kind, "unearth", 0.45);
      burst(e.x, e.y + 0.5, "#3a2c1e", 12, 12, 450);
    } else if (e.type === "legs") {
      // The legs' own footsteps come with their "spawn".
      float(e.x, e.y + 4, "Still walking!", "#c8ff3a", 1.8);
    } else if (e.type === "caw") say(tone, e.kind, "wake", 0.45);
    else if (e.type === "angelWeep") say(tone, e.kind, "weep", 0.4);
    else if (e.type === "angelTurn") {
      say(tone, e.kind, "watch", 0.6);
      float(e.x, e.y + 3, "Don't move", "#ffffff", 2.6);
    } else if (e.type === "angelWatch") glow(e.x, e.y, 10, 0.5, 400);
    else if (e.type === "angelSee") {
      say(tone, "angel", "see", 0.6);
      float(e.x, e.y + 7, "She sees you", DANGER, 2.2);
    } else if (e.type === "fist") {
      say(tone, "angel", "slam", 0.7);
      tone("boom", 0.5, 0.7);
      shake(260, 0.8);
      burst(e.x, e.y + 0.5, "#8d949b", 14, 14, 500);
    } else if (e.type === "angelBlink") {
      // Gone from one spot and standing in the next: stone dust at both.
      tone("boom", 0.25, 1.7);
      burst(e.x, e.y - 4, "#9aa1a8", 16, 16, 500);
      burst(e.tx, e.y - 4, "#b9c2c9", 16, 16, 500);
      float(e.tx, e.y + 14, "She moved", DANGER, 2);
    } else if (e.type === "angelWings") {
      say(tone, e.kind, "wings", 0.7);
      flash("#d0d6dc", 300);
      shake(400, 0.9);
      k.banner("Her wings open", "Shockwaves as she weeps. Jump them", "#d0d6dc", 1600);
    } else return false;
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    grave,
    openGrave,
    monsters: freeze({ hands, mourner, robber, rotter, legs, crow }),
    bosses: freeze({ angel }),
    missiles: freeze({ stone }),
    hazards: freeze({ fist }),
    lights,
    react,
  });
}
