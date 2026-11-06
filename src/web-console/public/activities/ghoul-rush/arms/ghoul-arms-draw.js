// Plan2Code Web Console - Ghoul Rush's secondary weapons, their drawing: each one's badge, what flies and rolls and burns on the field, the HUD's pill, the daze over what is stunned, and what their events look and sound like. The rules are in ghoul-arms.js.
//
// Dynamite's stick, blast and badge stay with the Mine's art (ghoul-mine-draw.js);
// its hazards came from there. armsArt(d) returns what ghoul-draw.js joins from
// every pack (`powers`, `hazards`, `lights`, `react`, `front`) and two of its own:
// `shot`, drawing a thrown weapon in `round.shots` (drawShots hands it any shot
// with `arm`), and `pill`, the HUD's icon, count and the "TAP TAP" prompt.

import { pillInk, PILL } from "../../pills.js";
import { panAngle, panRadius } from "./ghoul-pans.js";
import { rocketArt } from "./ghoul-rockets-draw.js";

const freeze = Object.freeze;
const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function armsArt(d) {
  const { circle, drawPower, roundRect, line, DANGER, GOLD } = d;

  /* ------------------------------------------------- the things themselves */

  // Each is drawn around (0, 0), about a unit in radius; `ink` is dark for a
  // badge and pale for one flying through the dark.
  function stakeShape(ctx, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(-1.05, -0.2);
    ctx.lineTo(0.3, -0.26);
    ctx.lineTo(1.15, 0);
    ctx.lineTo(0.3, 0.26);
    ctx.lineTo(-1.05, 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-1.2, -0.38, 0.28, 0.76);
  }

  function rocketShape(ctx, flame) {
    ctx.fillStyle = "#fff4d8";
    ctx.beginPath();
    ctx.moveTo(1.1, 0);
    ctx.lineTo(0.45, -0.34);
    ctx.lineTo(-0.5, -0.34);
    ctx.lineTo(-0.5, 0.34);
    ctx.lineTo(0.45, 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#7a1414";
    ctx.fillRect(-0.3, -0.34, 0.24, 0.68);
    ctx.fillRect(0.2, -0.34, 0.18, 0.68);
    ctx.fillStyle = "#ffd23e";
    ctx.beginPath();
    ctx.moveTo(-0.5, -0.26);
    ctx.lineTo(-0.5 - flame, 0);
    ctx.lineTo(-0.5, 0.26);
    ctx.closePath();
    ctx.fill();
  }

  function ballShape(ctx, r = 1) {
    ctx.fillStyle = "#14141a";
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.fillStyle = "#f4f1e8";
    circle(ctx, r * 0.1, -r * 0.05, r * 0.42);
    ctx.fill();
    ctx.fillStyle = "#14141a";
    circle(ctx, r * 0.1, -r * 0.05, r * 0.18);
    ctx.fill();
  }

  function skilletShape(ctx) {
    ctx.fillStyle = "#1c1a1e";
    circle(ctx, -0.3, 0.2, 0.82);
    ctx.fill();
    ctx.strokeStyle = "#1c1a1e";
    ctx.lineWidth = 0.34;
    line(ctx, 0.25, -0.35, 1.1, -1.05);
    ctx.fillStyle = "#3a3438";
    circle(ctx, -0.3, 0.2, 0.52);
    ctx.fill();
  }

  function saltShape(ctx) {
    ctx.fillStyle = "#23262c";
    roundRect(ctx, -1.05, 0.42, 2.1, 0.42, 0.14);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#23262c";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.moveTo(-0.85, 0.5);
    ctx.quadraticCurveTo(-0.1, -1.15, 0.85, 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function sickleShape(ctx, blade = "#1d3a14", haft = "#5a3a1a") {
    ctx.fillStyle = blade;
    ctx.beginPath();
    ctx.arc(0.1, 0.1, 1.05, -2.5, 0.75);
    ctx.arc(-0.2, 0.28, 0.72, 0.75, -2.5, true);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = haft;
    ctx.lineWidth = 0.28;
    line(ctx, -0.65, -0.45, -1.1, 0.7);
  }

  function forkShape(ctx) {
    ctx.strokeStyle = "#2c2150";
    ctx.lineWidth = 0.28;
    ctx.beginPath();
    ctx.moveTo(-0.46, -1.05);
    ctx.lineTo(-0.46, -0.05);
    ctx.quadraticCurveTo(-0.46, 0.34, 0, 0.34);
    ctx.quadraticCurveTo(0.46, 0.34, 0.46, -0.05);
    ctx.lineTo(0.46, -1.05);
    ctx.stroke();
    line(ctx, 0, 0.34, 0, 1.1);
    ctx.fillStyle = "#2c2150";
    circle(ctx, 0, 1.08, 0.2);
    ctx.fill();
  }

  function flashShape(ctx) {
    ctx.fillStyle = "#3a3010";
    ctx.fillRect(-0.14, 0.15, 0.28, 0.95);
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#3a3010";
    ctx.lineWidth = 0.13;
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU - Math.PI / 2;
      const r = i % 2 ? 0.34 : 0.92;
      ctx.lineTo(Math.cos(a) * r, -0.25 + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // A custard pie: a foil tin, a dome of cream with a swirl and a cherry.
  // A road flare (the Frozen Lake's): a red paper tube with two cream bands, a white-hot tip spitting sparks.
  function flareBadgeShape(ctx) {
    ctx.fillStyle = "#c8281a";
    ctx.fillRect(-1.1, -0.34, 1.9, 0.68);
    ctx.fillStyle = "#f2e8d0";
    ctx.fillRect(-0.45, -0.34, 0.26, 0.68);
    ctx.fillRect(0.2, -0.34, 0.2, 0.68);
    ctx.strokeStyle = "#3a0a06";
    ctx.lineWidth = 0.1;
    ctx.strokeRect(-1.1, -0.34, 1.9, 0.68);
    ctx.fillStyle = "#fff4c0";
    ctx.beginPath();
    ctx.arc(1.0, 0, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ff8a1a";
    ctx.lineWidth = 0.12;
    for (const [dx, dy] of [[0.5, -0.5], [0.7, 0.55], [0.35, 0.05]]) {
      ctx.beginPath();
      ctx.moveTo(1.0, 0);
      ctx.lineTo(1.0 + dx, dy);
      ctx.stroke();
    }
  }

  function pieShape(ctx) {
    ctx.fillStyle = "#b8bcc8";
    ctx.beginPath();
    ctx.moveTo(-1.05, 0.2);
    ctx.lineTo(1.05, 0.2);
    ctx.lineTo(0.78, 0.82);
    ctx.lineTo(-0.78, 0.82);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4a4e5a";
    ctx.lineWidth = 0.1;
    ctx.stroke();
    ctx.fillStyle = "#fff6d0";
    ctx.beginPath();
    ctx.moveTo(-1.0, 0.3);
    ctx.quadraticCurveTo(-1.1, -0.9, 0, -0.95);
    ctx.quadraticCurveTo(1.1, -0.9, 1.0, 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#a88a3a";
    ctx.lineWidth = 0.1;
    ctx.stroke();
    ctx.strokeStyle = "#e8cf86";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(-0.55, 0.05);
    ctx.quadraticCurveTo(0, -0.45, 0.55, 0.05);
    ctx.stroke();
    ctx.fillStyle = "#d8283a";
    circle(ctx, 0.05, -1.0, 0.24);
    ctx.fill();
  }

  // Jaws from a hinge at the bottom, `open` 0 (shut) to 1 (wide).
  function trapShape(ctx, open = 1, base = "#2c3644", jaw = "#2c3644", teeth = "#2c3644") {
    const a = 0.2 + open * 0.75;
    ctx.fillStyle = base;
    ctx.fillRect(-0.72, 0.62, 1.44, 0.3);
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(0, 0.66);
      ctx.rotate(s * a);
      ctx.strokeStyle = jaw;
      ctx.lineWidth = 0.24;
      line(ctx, 0, 0, 0, -1.3);
      ctx.fillStyle = teeth;
      for (const t of [-0.5, -0.86, -1.22]) {
        ctx.beginPath();
        ctx.moveTo(0, t - 0.16);
        ctx.lineTo(-s * 0.32, t);
        ctx.lineTo(0, t + 0.16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // A shape scaled and placed into a badge (or anywhere).
  const badge = (shape, scale = 0.9, tilt = 0, ...rest) => (ctx, x, y) => {
    ctx.save();
    ctx.translate(x, y);
    if (tilt) ctx.rotate(tilt);
    ctx.scale(scale, scale);
    shape(ctx, ...rest);
    ctx.restore();
  };

  const powers = freeze({
    stake: badge(stakeShape, 0.95, -0.7, "#222a33"),
    rocket: badge(rocketShape, 0.95, -0.7, 0.55),
    ball: badge(ballShape, 0.95),
    skillet: badge(skilletShape, 0.95),
    salt: badge(saltShape, 0.95),
    sickle: badge(sickleShape, 0.95),
    fork: badge(forkShape, 0.92),
    flash: badge(flashShape, 0.95),
    trap: badge(trapShape, 0.82),
    pie: badge(pieShape, 0.95),
    flare: badge(flareBadgeShape, 0.9, -0.6),
  });

  /* ------------------------------------------------------- shots in flight */

  function shot(ctx, v, s, y) {
    ctx.save();
    ctx.translate(s.x, y);
    const heading = Math.atan2(-s.vy, s.vx);
    if (s.arm === "stake") {
      // A glow and a streak behind it, then a big iron stake, its point leading,
      // so it never reads as an ordinary bolt.
      ctx.rotate(heading);
      ctx.fillStyle = "rgba(190, 220, 255, 0.22)";
      circle(ctx, 0, 0, 3.6);
      ctx.fill();
      ctx.strokeStyle = "rgba(190, 210, 230, 0.5)";
      ctx.lineWidth = 1.5;
      line(ctx, -11, 0, -3.6, 0);
      ctx.scale(3.2, 3.2);
      stakeShape(ctx, "#e4eef8");
      ctx.strokeStyle = "#3a4654";
      ctx.lineWidth = 0.07;
      ctx.stroke();
    } else if (s.arm === "sickle") {
      ctx.rotate(s.spin);
      ctx.scale(1.45, 1.45);
      sickleShape(ctx, "#c8f06e", "#7a5228");
    } else {
      // Anything else a weapon shot carries: a plain glowing orb.
      ctx.rotate(s.spin);
      ctx.fillStyle = "#ffcf7a";
      circle(ctx, 0, 0, 0.85);
      ctx.fill();
      ctx.fillStyle = "#fff6d8";
      circle(ctx, 0, 0, 0.42);
      ctx.fill();
    }
    ctx.restore();
  }

  /* --------------------------------------------------------------- hazards */

  function armPod(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    ctx.save();
    ctx.translate(h.x, y);
    ctx.rotate(h.spin);
    if (h.pay === "salt") {
      ctx.fillStyle = "#e9ecf2";
      roundRect(ctx, -0.6, -0.7, 1.2, 1.4, 0.3);
      ctx.fill();
      ctx.fillStyle = "#5c6470";
      ctx.fillRect(-0.45, -0.72, 0.9, 0.22);
    } else {
      ctx.fillStyle = "#3a3010";
      roundRect(ctx, -0.42, -0.72, 0.84, 1.44, 0.2);
      ctx.fill();
      ctx.fillStyle = "#fff27a";
      circle(ctx, 0, -0.2, 0.32);
      ctx.fill();
    }
    ctx.restore();
  }

  // The pie in flight: spinning, with a trail of cream flecks behind it.
  function armPie(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const back = h.vx >= 0 ? -1 : 1;
    ctx.fillStyle = "#fff6d0";
    for (let i = 1; i <= 6; i++) {
      ctx.globalAlpha = 0.75 - i * 0.11;
      circle(ctx, h.x + back * i * 0.85, y + i * 0.12 * Math.sign(h.vy || 1) + Math.sin(h.t / 60 + i) * 0.25, 0.62 - i * 0.07);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(h.x, y);
    ctx.rotate(h.spin);
    ctx.scale(1.15, 1.15);
    pieShape(ctx);
    ctx.restore();
  }

  // A blob of cream: a teardrop while it falls, then a glossy puddle with a cherry fleck that drips and fades.
  function armGoop(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    if (!h.rest) {
      ctx.fillStyle = "#fff6d0";
      ctx.strokeStyle = "#d8bc62";
      ctx.lineWidth = 0.08;
      ctx.beginPath();
      ctx.moveTo(h.x, y - 1.5);
      ctx.quadraticCurveTo(h.x + 0.75, y - 0.2, h.x, y + 0.1);
      ctx.quadraticCurveTo(h.x - 0.75, y - 0.2, h.x, y - 1.5);
      ctx.fill();
      ctx.stroke();
      return;
    }
    const t = clamp01(h.life / h.max);
    const grow = Math.min(1, (h.max - h.life) / 160);
    const W = (h.w / 2) * (0.55 + 0.45 * grow) * (0.55 + 0.45 * Math.min(1, t * 4));
    ctx.globalAlpha = Math.min(1, t * 3.5);
    ctx.fillStyle = "#e8cf84";
    ctx.beginPath();
    ctx.ellipse(h.x, y - 0.2, W * 1.05, 0.55, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#fff6d0";
    ctx.beginPath();
    ctx.ellipse(h.x, y - 0.5, W, 0.62 + 0.3 * grow, 0, 0, TAU);
    ctx.fill();
    // Gloss, and a crumb or cherry fleck (picked by the blob's number, never random).
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(h.x - W * 0.55, y - 0.85, W * 0.6, 0.18);
    if (h.n % 3 === 0) {
      ctx.fillStyle = "#d22b3a";
      circle(ctx, h.x + W * 0.35, y - 0.85, 0.28);
      ctx.fill();
    } else if (h.n % 3 === 1) {
      ctx.fillStyle = "#d8bc62";
      ctx.fillRect(h.x - W * 0.2, y - 0.7, 0.22, 0.2);
    }
    // A drip sliding down the side, then starting again.
    ctx.fillStyle = "#fff6d0";
    for (const d of [-0.55, 0.45]) {
      const ph = ((v.clock || 0) / 700 + h.n * 0.37 + (d > 0 ? 0.5 : 0)) % 1;
      circle(ctx, h.x + W * d, y - 0.2 + ph * 0.9, 0.2 * (1 - ph * 0.5));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function armBall(ctx, v, h) {
    ctx.save();
    ctx.translate(h.x, v.g.FIELD_H - h.y - 1.25);
    ctx.rotate(h.roll * 0.9);
    ctx.fillStyle = "#9a9aaa";
    circle(ctx, 0, 0, 1.38);
    ctx.fill();
    ballShape(ctx, 1.25);
    ctx.restore();
  }

  // One flying pan, edge-on and turning about its handle: the handle trails behind
  // the way it flies, the pan itself thins to a rim and opens to a dark face (and a hot
  // glint when it faces you) as it turns. Drawn around (0, 0), pointing along +x.
  function panFlying(ctx, turn) {
    const open = Math.cos(turn);
    const ry = 0.3 + Math.abs(open) * 1.05;
    // A warm halo so the iron reads against a dark room.
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#ffb15c";
    circle(ctx, -0.3, 0, 2.3);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#3a343c";
    roundRect(ctx, -2.8, -0.24, 2, 0.48, 0.2);
    ctx.fill();
    ctx.fillStyle = "#6a6270";
    ctx.fillRect(-2.8, -0.24, 0.42, 0.48);
    ctx.fillRect(-2.2, -0.24, 1.2, 0.1);
    ctx.fillStyle = "#26232a";
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.45, ry, 0, 0, TAU);
    ctx.fill();
    // The dark face of the pan, when it shows.
    if (ry > 0.5) {
      ctx.fillStyle = "#0e0c10";
      ctx.beginPath();
      ctx.ellipse(0.05, 0, 1.15, ry * 0.76, 0, 0, TAU);
      ctx.fill();
    }
    // A glossy rim.
    ctx.strokeStyle = "#c4bfd0";
    ctx.lineWidth = 0.26;
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.45, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.14;
    ctx.beginPath();
    ctx.ellipse(0, 0, 1.45, ry, 0, Math.PI * 1.25, Math.PI * 1.6);
    ctx.stroke();
    // The hot glint, brightest as the face comes round.
    const g = Math.max(0, open) ** 3;
    if (g > 0.05) {
      ctx.globalAlpha = g;
      ctx.fillStyle = "#ffe3a8";
      circle(ctx, 0.5, -ry * 0.4, 0.26);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      circle(ctx, 0.5, -ry * 0.4, 0.12);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function armPans(ctx, v, h) {
    const FH = v.g.FIELD_H;
    h.pans.forEach((p, i) => {
      if (!p.alive) return;
      // A faint trail along the spiral: where this pan was a moment ago, round the middle it has now.
      for (let j = 7; j >= 1; j--) {
        const t = h.t - j * 22;
        if (t < 0) continue;
        const r = panRadius(t);
        const an = panAngle(i, t);
        ctx.globalAlpha = 0.22 * (1 - j / 8);
        ctx.fillStyle = "#e9c48a";
        circle(ctx, h.x + Math.cos(an) * r, FH - (h.y + Math.sin(an) * r), 0.95 - j * 0.07);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // Heading: along the way round (the tangent), the handle behind it.
      const an = panAngle(i, h.t);
      const ahead = Math.atan2(Math.cos(an), -Math.sin(an));
      ctx.save();
      ctx.translate(p.x, FH - p.y);
      ctx.rotate(-ahead);
      ctx.scale(1.4, 1.4);
      panFlying(ctx, h.t / 55 + i * 2.1);
      ctx.restore();
    });
  }

  // A pan breaking on something: a clang flash, iron chips and sparks flying off.
  function armPanBurst(ctx, v, h) {
    const t = 1 - clamp01(h.life / h.max);
    const y = v.g.FIELD_H - h.y;
    ctx.globalAlpha = 0.9 * (1 - t);
    ctx.fillStyle = "#fff0c8";
    circle(ctx, h.x, y, 0.8 + t * 2.4);
    ctx.fill();
    ctx.strokeStyle = "#ffcf7a";
    ctx.lineWidth = 0.22;
    for (let i = 0; i < 10; i++) {
      const an = (i / 10) * TAU + 0.4;
      const r0 = 1 + t * 3;
      const r1 = r0 + 1.1 * (1 - t) + 0.4;
      line(ctx, h.x + Math.cos(an) * r0, y + Math.sin(an) * r0, h.x + Math.cos(an) * r1, y + Math.sin(an) * r1);
    }
    ctx.fillStyle = "#2a262c";
    for (let i = 0; i < 5; i++) {
      const an = (i / 5) * TAU + 1.1;
      circle(ctx, h.x + Math.cos(an) * (0.6 + t * 4.4), y + Math.sin(an) * (0.6 + t * 4.4) + t * t * 3, 0.4 * (1 - t * 0.6));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function armRing(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = 1 - clamp01(h.life / h.max);
    ctx.globalAlpha = 0.9 * (1 - t * 0.6);
    ctx.strokeStyle = "#c9b8ff";
    ctx.lineWidth = 0.7;
    circle(ctx, h.x, y, Math.max(0.1, h.r));
    ctx.stroke();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 0.25;
    circle(ctx, h.x, y, Math.max(0.1, h.r * 0.72));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function armSalt(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const a = clamp01(h.life / 600);
    const t = v.clock || 0;
    const half = h.w / 2;
    ctx.globalAlpha = a;
    // The line of salt, and a pale burn rising off it.
    ctx.fillStyle = "#eef2f6";
    for (let i = 0; i < 26; i++) {
      const gx = h.x - half + ((i * 7.31) % h.w);
      const gh = 0.22 + ((i * 3.7) % 3) * 0.09;
      ctx.fillRect(gx, y - gh, 0.34, gh);
    }
    ctx.fillStyle = "#bfe8ff";
    for (let i = 0; i < 10; i++) {
      const gx = h.x - half + 0.6 + (i / 10) * h.w;
      const rise = ((t / 620 + i * 0.37) % 1);
      ctx.globalAlpha = a * (1 - rise) * 0.8;
      circle(ctx, gx, y - 0.4 - rise * 4.6, 0.3 * (1 - rise * 0.5));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function armFlare(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = 1 - clamp01(h.life / h.max);
    ctx.globalAlpha = 0.75 * (1 - t);
    ctx.fillStyle = "#fffbe0";
    circle(ctx, h.x, y, 4 + t * h.w);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // The pie going off: a burst of cream, flung blobs and dripping dollops over the ground.
  function armSplat(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    const t = 1 - clamp01(h.life / h.max);
    const R = h.w * (0.35 + 0.65 * Math.min(1, t * 2.2));
    ctx.globalAlpha = 1 - t * 0.6;
    ctx.fillStyle = "#fff6d0";
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + 0.3;
      const r = R * (0.5 + (i % 3) * 0.2);
      circle(ctx, h.x + Math.cos(a) * r, y - 1.4 + Math.sin(a) * r * 0.55 - t * 1.2, 0.5 + (i % 4) * 0.22 * (1 - t));
      ctx.fill();
    }
    ctx.fillStyle = "#f0d890";
    circle(ctx, h.x, y - 0.8, 1.7 * (1 - t * 0.5));
    ctx.fill();
    ctx.fillStyle = "#fff6d0";
    for (const d of [-1.6, -0.5, 0.7, 1.6]) ctx.fillRect(h.x + d - 0.15, y - 0.8, 0.3, 0.6 + t * 2 + (Math.abs(d) % 1));
    ctx.globalAlpha = 1;
  }

  function armTrap(ctx, v, h) {
    const y = v.g.FIELD_H - h.y;
    ctx.save();
    ctx.translate(h.x, y - 1.45);
    ctx.scale(1.6, 1.6);
    // Dark while it sets, and it fades as it is spent.
    if (h.shut > 0) ctx.globalAlpha = clamp01(h.shut / 400);
    // On the field in bright silver, unlike the badge's dark ink.
    trapShape(ctx, h.shut > 0 ? 0 : h.arm > 0 ? 0.55 : 1, "#8c98a8", "#dfe8f2", "#ffffff");
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  const rockets = rocketArt(d);
  const hazards = freeze({ ...rockets.hazards, armPod, armPie, armGoop, armBall, armPans, armPanBurst, armRing, armSalt, armFlare, armSplat, armTrap });

  /* --------------------------------------------------- stars over the dazed */

  function dazed(ctx, v, x, top, w) {
    const t = (v.clock || 0) / 170;
    ctx.fillStyle = GOLD;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * TAU) / 3;
      circle(ctx, x + Math.cos(a) * Math.max(1.2, w * 0.45), top - 0.5 + Math.sin(a) * 0.4, 0.3);
      ctx.fill();
    }
  }

  function front(ctx, v) {
    const { round, g } = v;
    if (!round) return;
    for (const m of round.monsters) if (m.stunMs > 0) dazed(ctx, v, m.x, g.FIELD_H - (m.y + m.h), m.w);
    const b = round.boss;
    if (b && b.stunMs > 0) dazed(ctx, v, b.x, g.FIELD_H - (b.y + b.h), b.w);
    carried(ctx, v);
  }

  // How far an icon swells as the bag changes: nothing, up, back, as `pop` runs 1 to 0.
  const swell = (pop) => (pop > 0 ? Math.sin(Math.PI * (1 - pop)) : 0);

  // The weapon that comes out next, over Planny's head: during a fight the eyes
  // are on him, not on the HUD.
  function carried(ctx, v) {
    const you = v.round.you;
    const arm = v.hud?.arm;
    if (!arm || you.out > 0) return;
    const t = v.clock || 0;
    const x = you.x;
    const y = v.g.FIELD_H - (you.y + v.g.YOU_H + 2.1) + Math.sin(t / 240) * 0.22;
    const up = swell(arm.pop);
    if (up > 0) {
      ctx.globalAlpha = up * 0.9;
      ctx.strokeStyle = arm.color;
      ctx.lineWidth = 0.3;
      circle(ctx, x, y, 1.3 + (1 - arm.pop) * 2.6);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const k = 0.68 * (1 + up * 0.55);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    drawPower(ctx, v, arm.kind, 0, 0);
    ctx.restore();
  }

  /* -------------------------------------------------------------- the dark */

  function lights(v, add) {
    const { round } = v;
    if (!round) return;
    rockets.lights(v, add);
    for (const h of round.hazards) {
      if (h.kind === "armFlare") add(h.x, h.y, 34, 1);
      else if (h.kind === "stick") add(h.x, h.y + 0.5, 5, 0.55);
      else if (h.kind === "blast") add(h.x, h.y + 3, 18, 0.95);
      else if (h.kind === "armRing") add(h.x, h.y, h.r + 4, 0.7);
      else if (h.kind === "armSalt") add(h.x, h.y + 2, 10, 0.5);
      else if (h.kind === "armPans") for (const p of h.pans) p.alive && add(p.x, p.y, 4.5, 0.55);
      else if (h.kind === "armPanBurst") add(h.x, h.y, 7, 0.7 * (h.life / h.max));
      else if (h.kind === "armSplat") add(h.x, h.y + 1.5, 12, 0.6 * (h.life / h.max));
      else if (h.kind === "armPie") add(h.x, h.y, 5, 0.5);
      else if (h.kind === "armGoop") add(h.x, h.y + 0.5, 3.5, h.rest ? 0.3 * Math.min(1, h.life / 600) : 0.35);
    }
  }

  /* ---------------------------------------------------------------- the HUD */

  // The weapon that comes out next: its badge, as in the room, then its count.
  function pill(ctx, p, v, sans) {
    const { x, y, w, h } = p;
    const arm = v.hud.arm;
    if (!arm) return;
    ctx.fillStyle = PILL;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    // A soft glow and rim in the weapon's color, breathing while it is held, and
    // stronger till the first one is used, so the prompt is seen.
    const up = swell(arm.pop);
    const breath = Math.sin((v.clock || 0) / (arm.fresh ? 130 : 260));
    ctx.globalAlpha = Math.min(1, (arm.fresh ? 0.25 + 0.2 * breath : 0.14 + 0.08 * breath) + up * 0.45);
    ctx.fillStyle = arm.color;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    ctx.globalAlpha = Math.min(1, 0.7 + 0.3 * breath + up);
    ctx.strokeStyle = arm.color;
    ctx.lineWidth = h * 0.09;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // The badge a little bigger than the pill, swelling as the bag changes, a ring leaving it.
    const cx = x + h * 0.56;
    const cy = y + h / 2;
    if (up > 0) {
      ctx.globalAlpha = up * 0.9;
      ctx.strokeStyle = arm.color;
      ctx.lineWidth = h * 0.12;
      circle(ctx, cx, cy, h * (0.6 + (1 - arm.pop) * 0.9));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const k = (h / 2.9) * (1 + up * 0.4);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    drawPower(ctx, v, arm.kind, 0, 0);
    ctx.restore();
    ctx.font = `800 ${h * 0.62}px ${sans}`;
    ctx.fillStyle = pillInk(arm.color);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(p.text, x + h * 1.08 + (w - h * 1.08 - h * 0.28) / 2, y + h * 0.54);
  }

  /* ------------------------------------------------------------ the events */

  const THROW = freeze({ stake: "ghoulArmStake", rocket: "ghoulArmRocket", ball: "ghoulArmBall", skillet: "ghoulArmSkillet", salt: "ghoulArmToss", sickle: "ghoulArmSickle", fork: "ghoulArmFork", flash: "ghoulArmToss", pie: "ghoulPieThrow", trap: "ghoulArmTrap", flare: "ghoulFlareThrow" });

  function react(e, k) {
    const { tone, burst, float, ring, flash, shake, glow } = k;
    switch (e.type) {
      case "armUse":
        if (e.kind === "rocket") {
          // One punchy launch for the volley, and a quieter copy for the other two.
          tone("ghoulArmRocket", 0.7);
          tone("ghoulArmRocket", 0.28);
          glow(e.x, e.y, 14, 0.9, 260);
        } else if (THROW[e.kind]) tone(THROW[e.kind], 0.5);
        if (e.kind === "fork") ring(e.x, e.y, "#c9b8ff", 1, 9, 350);
        return true;
      case "armBoom":
        tone("ghoulArmClang", 0.4);
        shake(110, 0.3);
        glow(e.x, e.y, 16, 0.9, 300);
        return true;
      case "armBounce":
        tone("ghoulArmBounce", 0.5);
        burst(e.x, e.y + 1, "#d8ccb0", 5, 8, 260);
        return true;
      case "armClang":
        tone("ghoulArmClang", 0.5);
        shake(90, 0.25);
        burst(e.x, e.y, "#ffcf7a", 8, 12, 260);
        return true;
      case "armTurn":
        tone("ghoulArmTurn", 0.4);
        return true;
      case "armSalt":
        tone("ghoulArmSalt", 0.5);
        tone("ghoulArmSaltBurn", 0.4);
        burst(e.x, e.y + 0.5, "#eef2f6", 16, 9, 420);
        return true;
      case "armFlash":
        tone("ghoulArmFlash", 0.6);
        flash("#fffbe0", 220);
        ring(e.x, e.y + 1, "#fff27a", 2, 22, 340);
        glow(e.x, e.y + 1, 26, 1, 420);
        return true;
      case "armSplat":
        tone("ghoulPieSplat", 0.6);
        burst(e.x, e.y + 1, "#fff6d0", 18, 11, 450);
        burst(e.x, e.y + 1, "#f0d890", 8, 7, 380);
        float(e.x, e.y + 3, "SPLAT", "#f5e6a8", 2.2);
        return true;
      case "armGoop":
        tone("ghoulPieSplat", 0.2);
        burst(e.x, e.y + 0.5, "#fff6d0", 4, 5, 260);
        return true;
      case "armDaze":
        float(e.x, e.y + 1.5, "DAZED", "#fff27a", 2.2);
        return true;
      case "armSnap":
        tone("ghoulArmSnap", 0.65);
        shake(120, 0.4);
        burst(e.x, e.y + 1, "#dfe8f2", 10, 11, 260);
        float(e.x, e.y + 3, "SNAP", DANGER, 2.2);
        return true;
      default:
        return false;
    }
  }

  return freeze({ powers, hazards, lights, front, react, shot, pill });
}
