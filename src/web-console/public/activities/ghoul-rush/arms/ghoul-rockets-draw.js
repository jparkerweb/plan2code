// Plan2Code Web Console - Ghoul Rush's Bottle Rocket, its drawing: the flash and smoke at the muzzle, a flared bottle rocket on a stick with a glowing head, the fountain of multicolored sparks it sheds, and the burst when it goes off. The rules are in ghoul-rockets.js.
//
// rocketArt(d) returns the `hazards` (armRocket, armRocketBoom, armMuzzle) and the
// `lights` that ghoul-arms-draw.js joins to its own, so a rocket and its sparks
// are lit in a dark room. Sparks are drawn from the state the rules keep (a list
// of { x, y, age, life, c, s }); nothing here draws a random number.

import { BOOM_MS, MUZZLE_MS, ROCKET_BLAST_R, SPARK_COLORS } from "./ghoul-rockets.js";

const freeze = Object.freeze;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function rocketArt(d) {
  const { circle } = d;

  // The sparks, one color at a time: a short bright streak along the way each flies, shrinking as it fades, and a white-hot dot on the young ones.
  function sparks(ctx, v, list) {
    if (!list.length) return;
    const FH = v.g.FIELD_H;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.5;
    for (let c = 0; c < SPARK_COLORS.length; c++) {
      ctx.strokeStyle = SPARK_COLORS[c];
      ctx.beginPath();
      for (const p of list) {
        if (p.c !== c) continue;
        const f = 1 - p.age / p.life;
        const len = 0.028 * (0.3 + 0.7 * f) * (0.7 + 0.6 * p.s);
        ctx.moveTo(p.x, FH - p.y);
        ctx.lineTo(p.x - p.vx * len, FH - (p.y - p.vy * len));
      }
      ctx.stroke();
    }
    ctx.fillStyle = "#fffbe8";
    for (const p of list) {
      const f = 1 - p.age / p.life;
      if (f < 0.5) continue;
      const r = 0.12 + 0.1 * p.s;
      ctx.fillRect(p.x - r, FH - p.y - r, r * 2, r * 2);
    }
  }

  // The rocket, pointing along +x with its middle at (0, 0): a bottle with red bands, a gold nose, flared fins and a stick behind.
  function body(ctx, flick) {
    // A stick trailing back, with a light edge.
    ctx.fillStyle = "#9c6a32";
    ctx.fillRect(-4.1, -0.13, 3.3, 0.26);
    ctx.fillStyle = "#d9a862";
    ctx.fillRect(-4.1, -0.13, 3.3, 0.08);
    // Fins that flare out at the tail.
    ctx.fillStyle = "#d9302a";
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(-0.2, 0.42 * s);
      ctx.lineTo(-1.25, 1.2 * s);
      ctx.lineTo(-1.15, 0.42 * s);
      ctx.closePath();
      ctx.fill();
    }
    // The bottle, cream with two red bands.
    ctx.fillStyle = "#fff0cc";
    ctx.beginPath();
    ctx.moveTo(-1.1, -0.46);
    ctx.lineTo(0.9, -0.46);
    ctx.lineTo(0.9, 0.46);
    ctx.lineTo(-1.1, 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#c8201c";
    ctx.fillRect(-0.7, -0.46, 0.34, 0.92);
    ctx.fillRect(0.2, -0.46, 0.3, 0.92);
    // The nose cone, gold, and the head's hot white tip.
    ctx.fillStyle = "#ffc72e";
    ctx.beginPath();
    ctx.moveTo(0.9, -0.46);
    ctx.lineTo(1.9, 0);
    ctx.lineTo(0.9, 0.46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fffdf0";
    circle(ctx, 1.55, 0, 0.3);
    ctx.fill();
    // The flame at the tail, flickering.
    ctx.fillStyle = "#ffb42e";
    ctx.beginPath();
    ctx.moveTo(-1.1, -0.34);
    ctx.lineTo(-1.1 - flick, 0);
    ctx.lineTo(-1.1, 0.34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff6c0";
    ctx.beginPath();
    ctx.moveTo(-1.1, -0.16);
    ctx.lineTo(-1.1 - flick * 0.55, 0);
    ctx.lineTo(-1.1, 0.16);
    ctx.closePath();
    ctx.fill();
  }

  function armRocket(ctx, v, h) {
    sparks(ctx, v, h.sparks);
    const FH = v.g.FIELD_H;
    ctx.save();
    ctx.translate(h.x, FH - h.y);
    // The glow round the head, so it reads against a dark room.
    ctx.fillStyle = "#ffd36a";
    ctx.globalAlpha = 0.07;
    for (let r = 4.4; r > 1; r -= 0.65) {
      circle(ctx, 0, 0, r);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.rotate(Math.atan2(-h.vy, h.vx));
    ctx.scale(1.15, 1.15);
    body(ctx, 1.1 + 0.6 * Math.sin(h.t / 21));
    ctx.restore();
  }

  // A fireball that swells and clears, a ring out to the blast's edge, and the sparks flying.
  function armRocketBoom(ctx, v, h) {
    const FH = v.g.FIELD_H;
    const t = 1 - h.life / h.max;
    const swell = clamp01(t / 0.3);
    const fade = clamp01(1 - t / 0.75);
    if (fade > 0) {
      ctx.fillStyle = "#ff7a1c";
      ctx.globalAlpha = 0.5 * fade;
      circle(ctx, h.x, FH - h.y, ROCKET_BLAST_R * (0.35 + 0.65 * swell));
      ctx.fill();
      ctx.fillStyle = "#ffd25a";
      ctx.globalAlpha = 0.8 * fade;
      circle(ctx, h.x, FH - h.y, ROCKET_BLAST_R * (0.2 + 0.45 * swell));
      ctx.fill();
      ctx.fillStyle = "#fffbe8";
      ctx.globalAlpha = fade;
      circle(ctx, h.x, FH - h.y, ROCKET_BLAST_R * 0.22 * (1 - 0.5 * t));
      ctx.fill();
      ctx.globalAlpha = 0.9 * fade;
      ctx.strokeStyle = "#fff0b0";
      ctx.lineWidth = 0.55;
      circle(ctx, h.x, FH - h.y, ROCKET_BLAST_R * swell);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    sparks(ctx, v, h.sparks);
  }

  // The flash at his hand and a puff of smoke that rises and thins.
  function armMuzzle(ctx, v, h) {
    const FH = v.g.FIELD_H;
    const t = 1 - h.life / h.max;
    const ms = t * MUZZLE_MS;
    const flash = clamp01(1 - ms / 200);
    if (flash > 0) {
      ctx.save();
      ctx.translate(h.x + h.face * 0.8, FH - h.y);
      ctx.fillStyle = "#fff6c8";
      ctx.globalAlpha = flash;
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + 0.2;
        const len = (i % 2 ? 2.6 : 4.4) * (0.5 + 0.5 * flash);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a + 0.22) * 0.5, Math.sin(a + 0.22) * 0.5);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.lineTo(Math.cos(a - 0.22) * 0.5, Math.sin(a - 0.22) * 0.5);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = "#ffb52e";
      ctx.globalAlpha = 0.7 * flash;
      circle(ctx, 0, 0, 2.6);
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // Four puffs, each drifting its own way: ahead, up and back.
    const way = [[0.9, 0.5], [-0.3, 1.1], [-1.1, 0.4], [0.2, 1.7]];
    ctx.fillStyle = "#c9c4bc";
    for (let i = 0; i < way.length; i++) {
      const life = clamp01(t * 1.15 - i * 0.05);
      if (life <= 0 || life >= 1) continue;
      ctx.globalAlpha = 0.5 * (1 - life);
      circle(ctx, h.x + h.face * (0.6 + way[i][0] * 4.2 * life), FH - h.y - 0.3 - way[i][1] * 3.6 * life, 0.8 + life * 1.9);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const hazards = freeze({ armRocket, armRocketBoom, armMuzzle });

  // Lit in a dark room: the head, the burst and the flash.
  function lights(v, add) {
    for (const h of v.round.hazards) {
      if (h.kind === "armRocket") add(h.x, h.y, 11, 0.95);
      else if (h.kind === "armRocketBoom") add(h.x, h.y, ROCKET_BLAST_R * 2.6, 0.95 * clamp01(h.life / BOOM_MS));
      else if (h.kind === "armMuzzle") add(h.x, h.y, 13, clamp01(h.life / h.max - 0.1));
    }
  }

  return freeze({ hazards, lights });
}
