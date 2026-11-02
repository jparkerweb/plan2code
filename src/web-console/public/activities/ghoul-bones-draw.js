// Plan2Code Web Console - Ghoul Rush's Old Rattlebones, his drawing: the boss (headless while his skull is out, shaking with flaring eyes in his rage), the skull in flight, the bones coming down on their shadows, the floor cracking where a skeleton comes up, and what his new moves look and sound like.
//
// ghoul-draw.js plugs it in. boneArt(d) takes ghoul-draw.js's own drawing
// helpers (`d`: ellipse, circle, line, rotate, eye, say, gate,
// drawBoneShape and the colors) and hands back the drawing by kind, the way
// the stage packs' art does, so this file never reaches back into it.
// Everything is drawn in room units: y counted down from the field's top, the
// boss from (x, y) at his feet.

import { RAIN_LIVE_MS, RAISE_WARN_MS, SKULL_R } from "./ghoul-bones.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;

export const LOSE_WORDS = freeze({ skull: "Skull-struck", rain: "Bone-rained" });
export const LOSE_SOUNDS = freeze({
  skull: ["clank", 0.55, 0.6],
  rain: ["clank", 0.5, 0.8],
});

const DIRT = "#3a2c1e";
const FIRE = "#ff7a2a";

export function boneArt(d) {
  const { ellipse, circle, roundRect, line, eye, say, gate, drawBoneShape, BONE, FLASH, EYE_RED, EYE_AMBER, DANGER } = d;

  // The skull as a face looking `dir`: cranium, cheek and jaw, the sockets
  // dark with a burning point in each (kept for the dark pass).
  function skull(ctx, v, x, y, r, dir, ink, ember, tilt = 0) {
    ctx.save();
    ctx.translate(x, y);
    if (typeof ctx.rotate === "function") ctx.rotate(tilt);
    ctx.fillStyle = ink;
    circle(ctx, 0, 0, r);
    ctx.fill();
    ctx.fillRect(-r * 0.6, r * 0.3, r * 1.2, r * 0.75);
    ctx.fillStyle = "#0a0806";
    for (const s of [-1, 1]) {
      circle(ctx, s * r * 0.39 + dir * r * 0.14, -r * 0.14, r * 0.27);
      ctx.fill();
    }
    for (let k = -2; k <= 2; k++) ctx.fillRect(k * r * 0.2 - r * 0.04, r * 0.6, r * 0.08, r * 0.32);
    ctx.restore();
    if (ember === null) return;
    // The ember points turn with the skull.
    const c = Math.cos(tilt);
    const s = Math.sin(tilt);
    for (const sx of [-1, 1]) {
      const ex = sx * r * 0.39 + dir * r * 0.14;
      const ey = -r * 0.14;
      eye(v, x + ex * c - ey * s, y + ex * s + ey * c, r * ember, ember > 0.2 ? EYE_AMBER : EYE_RED);
    }
  }

  function rattlebones(ctx, v, b) {
    const { g } = v;
    const t = v.clock;
    const quake = b.shake > 0 ? Math.sin(t / 22) * 0.4 : 0;
    const x = b.x + quake;
    const y = g.FIELD_H - b.y;
    const flash = b.hurt > 0;
    const ink = flash ? FLASH : BONE;
    const dir = b.dir || -1;
    const up = b.windup > 0;
    const headless = Boolean(b.headless) && b.state === "fight";
    const raged = Boolean(b.raged);
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineCap = "round";
    ctx.lineWidth = 0.9;
    const step = Math.sin(t / 220) * 0.6;
    line(ctx, x - 1.4, y - 7, x - 1.8 + step, y);
    line(ctx, x + 1.4, y - 7, x + 1.8 - step, y);
    ellipse(ctx, x, y - 7, 2.4, 0.9);
    ctx.fill();
    ctx.lineWidth = 0.7;
    line(ctx, x, y - 7, x, y - 13.4);
    for (let k = 0; k < 4; k++) {
      const ry = y - 9 - k * 1.1;
      ctx.beginPath();
      if (typeof ctx.ellipse === "function") ctx.ellipse(x, ry, 2.6 - k * 0.2, 0.6, 0, Math.PI, TAU);
      else ctx.arc(x, ry, 2.4, Math.PI, TAU);
      ctx.stroke();
    }
    // Arms: both up for a slam, both to the skull for the skull, both high
    // for bone rain, one back for a volley.
    ctx.lineWidth = 0.7;
    for (const s of [-1, 1]) {
      const act = up ? b.act : "";
      const raise = up && (act === "slam" || act === "rain" || (act === "volley" && s === dir));
      const grip = up && act === "skull";
      const hx = x + s * (grip ? 2.5 : raise ? (act === "rain" ? 3.6 : 2.6) : 4.2);
      const hy = y - (grip ? 16.2 : raise ? (act === "rain" ? 21 : 19) : 9 + Math.sin(t / 300 + s) * 0.6);
      line(ctx, x + s * 1.8, y - 13.4, x + s * 3.6, y - (grip ? 14.4 : raise ? 16 : 11));
      line(ctx, x + s * 3.6, y - (grip ? 14.4 : raise ? 16 : 11), hx, hy);
      if (raise && act === "volley") drawBoneShape(ctx, hx, hy - 0.8, t / 60, 1.1);
      if (raise && act === "rain") drawBoneShape(ctx, hx, hy - 1 - Math.abs(Math.sin(t / 70)) * 0.6, t / 50 + s, 1.1);
    }
    ctx.lineCap = "butt";
    if (headless) {
      // A neck stub with nothing on it, and the stump smoldering.
      ctx.fillStyle = ink;
      ctx.fillRect(x - 0.45, y - 14.6, 0.9, 1.3);
      ctx.fillStyle = "#0a0806";
      ellipse(ctx, x, y - 14.7, 0.9, 0.3);
      ctx.fill();
      return;
    }
    // Winding up the skull, he shakes it in his hands, burning.
    const grip = up && b.act === "skull";
    const sx = x + (grip ? Math.sin(t / 25) * 0.25 : 0);
    if (grip) {
      ctx.fillStyle = FIRE;
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t / 40);
      circle(ctx, sx, y - 16, 3.1);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    skull(ctx, v, sx, y - 16, 2.2, dir, ink, raged || up ? 0.28 : 0.18);
  }

  // His skull in flight: spinning, with the last of its path fading behind.
  function skullFlying(ctx, v, h) {
    const { g } = v;
    const y = g.FIELD_H - h.fy;
    ctx.fillStyle = BONE;
    for (let k = 4; k >= 1; k--) {
      ctx.globalAlpha = 0.07 + (4 - k) * 0.04;
      circle(ctx, h.x - h.mv * k * 1.1, y, SKULL_R * (1 - k * 0.07));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    skull(ctx, v, h.x, y, SKULL_R, h.mv, h.stagger > 0 ? FLASH : BONE, 0.22, h.spin);
  }

  // A falling bone: its shadow on the floor closing in; the bone dropping
  // out of the dark in the last half; then splintering where it landed.
  function rain(ctx, v, h) {
    const { g } = v;
    const fy = g.FIELD_H - h.y;
    if (h.warn > 0) {
      const p = 1 - h.warn / h.span;
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.globalAlpha = 0.3 + p * 0.6;
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.8 - p * 0.6), 0.65);
      ctx.fill();
      // The ring tightens and reddens as the bone nears.
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 0.18;
      ctx.globalAlpha = p * 0.8;
      ellipse(ctx, h.x, fy - 0.1, (h.w / 2) * (1.8 - p * 0.6), 0.65);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const f = h.warn / h.span;
      if (f < 0.5) {
        const q = f / 0.5;
        const by = fy - 0.9 - q * q * 44;
        ctx.strokeStyle = "rgba(207, 196, 166, 0.35)";
        ctx.lineWidth = 0.35;
        line(ctx, h.x, by, h.x, by - 2.5 - q * 5);
        drawBoneShape(ctx, h.x, by, v.clock / 40 + h.x, 1.5);
      }
      return;
    }
    const gone = h.live < 0 ? 1 + h.live / RAIN_LIVE_MS : 1;
    ctx.globalAlpha = Math.max(0, gone);
    drawBoneShape(ctx, h.x - 0.7, fy - 0.35, 0.3, 1.4);
    drawBoneShape(ctx, h.x + 0.8, fy - 0.3, -0.4, 1.1);
    if (h.live > 0) {
      ctx.fillStyle = "rgba(207, 196, 166, 0.55)";
      for (const s of [-1, 1]) {
        ellipse(ctx, h.x + s * (h.w / 2 + 0.5), fy - 0.5, 1, 0.45);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // The floor cracking, dust rising, then a bony hand clawing up.
  function raise(ctx, v, h) {
    const { g } = v;
    const fy = g.FIELD_H - h.y;
    const p = 1 - h.warn / RAISE_WARN_MS;
    ctx.fillStyle = "#0a0806";
    ctx.globalAlpha = 0.5 + p * 0.4;
    ellipse(ctx, h.x, fy - 0.1, 1.8 + p * 1.8, 0.5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "#0a0806";
    ctx.lineWidth = 0.3;
    for (const s of [-1, 0, 1]) line(ctx, h.x + s * 0.5, fy, h.x + s * (1.3 + p * 2.2), fy + 0.2 + Math.abs(s) * 0.2);
    if (p > 0.35) {
      const rise = (p - 0.35) * 3.4;
      ctx.strokeStyle = BONE;
      ctx.lineWidth = 0.42;
      for (const s of [-1, 0, 1]) line(ctx, h.x + s * 0.7, fy, h.x + s * 0.9 + Math.sin(v.clock / 80 + s) * 0.2, fy - rise * 1.3 * (s ? 0.8 : 1));
    }
    ctx.fillStyle = DIRT;
    ctx.globalAlpha = 0.6;
    for (let k = 0; k < 3; k++) {
      circle(ctx, h.x + (k - 1) * 1.1, fy - 0.6 - ((p * 4 + k * 0.37) % 1) * 1.8, 0.2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // What lights the dark: the skull burning as it is wound up and in flight.
  function lights(v, add) {
    const b = v.round.boss;
    if (b && b.kind === "bones" && b.state === "fight" && b.windup > 0 && b.act === "skull") add(b.x, b.y + 16, 6, 0.4);
    for (const h of v.round.hazards) {
      if (h.kind === "skull") add(h.x, h.fy, 4, 0.35);
      else if (h.kind === "raise") add(h.x, h.y + 1, 4, 0.3);
    }
  }

  // What Old Rattlebones' new moves look and sound like, beside ghoul-draw.js's
  // own (his voice is VOICES there): true when `e` was one of them. `k` is the
  // same kit react() is handed. His volley and slam stay ghoul-draw.js's own;
  // the double slam's second wave is a "slam" with `echo`.
  function react(e, k) {
    const { tone, burst, float, flash, glow, shake, fx } = k;
    if (e.type === "skullWind") {
      say(tone, "bones", "windup", 0.5);
      glow(e.x, e.y, 6, 0.5, 450);
    } else if (e.type === "skullThrow") {
      say(tone, "bones", "throw", 0.55);
      tone("whoosh", 0.35, 1.3);
      burst(e.x, e.y, "#ff9a4a", 6, 8, 250);
    } else if (e.type === "skullTurn") {
      tone("clank", 0.2, 1.6);
    } else if (e.type === "skullBack") {
      tone("clank", 0.4, 0.8);
      tone("thud", 0.25, 1.1);
      burst(e.x, e.y, "#d8cdb0", 8, 8, 300);
    } else if (e.type === "rainWind") {
      say(tone, "bones", "windup", 0.5);
      float(e.x, e.y + 2, "Look up", DANGER, 2.4);
    } else if (e.type === "rainThrow") {
      tone("swoosh", 0.35, 0.8);
      burst(e.x, e.y, "#d8cdb0", 10, 12, 450);
    } else if (e.type === "rainLand") {
      if (gate(fx, "rainMs", 70)) tone("clank", 0.28, 1.2);
      burst(e.x, e.y + 0.5, "#d8cdb0", 6, 8, 300);
    } else if (e.type === "bonesRage") {
      say(tone, e.kind, "wake", 0.8);
      flash("#400000", 320);
      shake(900, 0.8);
      k.banner("Rattlebones rages", "Double waves. Bones rain. Skeletons rise", "#ff7a2a", 1900);
    } else if (e.type === "raiseWind") {
      tone("creakBoard", 0.35, 0.7);
      burst(e.x, e.y + 0.5, DIRT, 8, 8, 400);
    } else if (e.type === "raised") {
      burst(e.x, e.y + 0.8, "#d8cdb0", 10, 10, 400);
    } else return false;
    return true;
  }

  return freeze({
    bosses: freeze({ bones: rattlebones }),
    hazards: freeze({ skull: skullFlying, rain, raise }),
    lights,
    react,
  });
}
