// Plan2Code Web Console - Ghoul Rush's boss intro card: a full-field "BOSS FIGHT" card shown when a boss room is entered, before the fight. A big title whose letters slam in one by one (red and orange glow, the whole card shaking at each landing, a heartbeat pulsing under it), the boss itself drawn from its own art at a big scale, spotlit on a dark backdrop in the stage's palette, its name big beneath it, a one-line epithet and a pulsing hint to press a key.
//
// ghoul-draw.js plugs it in, the way it plugs in ghoul-intro-draw.js:
// bossIntroArt(d) takes its drawing helpers (`d`: label, circle, BOSS_ART,
// drawGourdFire, GOLD, BONE) and hands back `(ctx, v)`, drawn over the whole
// field while `round.phase === "bossintro"` (also while paused). `round.introMs`
// is how long the card has been up (it stops with the game). The words live in
// ghoul-boss-intros.js, the colors in the stage's palette in ghoul-intros.js.
// The boss is drawn through the same fake boss the stage pick uses
// (ghoul-picker-draw.js); an art that throws or is missing falls back to a
// big dark silhouette with glowing eyes. Field units (96 by 54).

import { INTRO_MIN_MS } from "../core/ghoul-run.js";
import { introFor } from "./ghoul-intros.js";
import { bossIntroFor } from "./ghoul-boss-intros.js";
import { REACH } from "../draw/ghoul-picker-draw.js";

export const BOSS_HINT = "Press any move key or fire to start the fight";
export const BOSS_TITLE = "BOSS FIGHT";
const TAU = Math.PI * 2;
const SLAM_MS = 190;
const STAGGER_MS = 95;
const START_MS = 200;
const FLOOR_Y = 38.5;
const MAX_H = 25;
const MAX_W = 40;
// How far a boss's art reaches past its box (the stage pick's table, plus the Gourd's stem and the Ringmaster's hat and puppet), and how far its picture is nudged to sit in the middle of the card.
const REACH_BY = Object.freeze({ ...REACH, gourd: 1.2, ringmaster: 1.4 });
const NUDGE = Object.freeze({ ringmaster: 14 });
const FALLBACK = Object.freeze({ a: "#ffb347", b: "#c2410c", glow: "#ff8a1f" });

const rnd = (i, salt = 0) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
// A color eased toward white by `amount`, so a dark boss color still reads on the dark card (anything but #rrggbb is left alone).
export function lift(color, amount = 0.35) {
  const m = /^#([0-9a-f]{6})$/i.exec(color || "");
  if (!m) return color;
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const dot = (ctx, x, y, r, fill) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, r), 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
};

// The ms at which letter `i` of the title lands.
export const landAt = (i) => START_MS + i * STAGGER_MS + SLAM_MS;

// The card's shake at `t` ms: a decaying jolt from each letter that just landed, a faint one with each heartbeat.
export function shakeAt(t) {
  let amp = 0;
  [...BOSS_TITLE].forEach((ch, i) => {
    const dt = t - landAt(i);
    if (ch !== " " && dt >= 0 && dt < 260) amp += 0.9 * (1 - dt / 260);
  });
  const beat = (t % 1000) / 1000;
  if (t > 1200 && beat < 0.08) amp += 0.18;
  return amp;
}

// The heartbeat's pulse in [0, 1]: two thumps a second apart.
export const beatAt = (t) => {
  const p = (t % 1000) / 1000;
  return Math.max(Math.exp(-p * 18), 0.7 * Math.exp(-Math.abs(p - 0.2) * 22));
};

export function bossIntroArt(d) {
  const { label, circle, BOSS_ART, drawGourdFire, GOLD, BONE } = d;

  // The boss standing on its mark, from its real art; false when the art is missing or throws.
  function drawBossPicture(ctx, v, id, t, x, floorY) {
    const def = v.bosses[id];
    const art = BOSS_ART[id];
    if (!def) return false;
    const k = Math.min(MAX_H / (def.h * (REACH_BY[id] || 1)), MAX_W / def.w);
    const pic = { g: { FIELD_H: 0 }, clock: 1000 + t, spec: null, groundAt: () => 0, eyes: [] };
    const b = { kind: id, x: 0, y: 0, w: def.w, h: def.h, hurt: 0, dir: -1, wait: Infinity, landX: 0, windup: 0, act: "", state: "fight", t: 0, hp: 1, max: 1, lit: true };
    const breathe = 1 + 0.018 * Math.sin(t / 430);
    ctx.save();
    ctx.translate(x, floorY);
    ctx.rotate(0.012 * Math.sin(t / 1100));
    ctx.scale(k * breathe, k * (1 + (breathe - 1) * 1.6));
    let ok = false;
    try {
      if (typeof art === "function") {
        art(ctx, pic, b);
        if (id === "gourd" && typeof drawGourdFire === "function") drawGourdFire(ctx, pic, b);
        ok = true;
      }
    } catch (e) {
      ok = false;
    }
    if (ok) {
      const e = pic.eyes || [];
      const pulse = 0.8 + 0.2 * Math.sin(t / 160);
      for (let i = 0; i + 3 < e.length; i += 4) {
        ctx.fillStyle = e[i + 3];
        ctx.globalAlpha = 0.22 * pulse;
        circle(ctx, e[i], e[i + 1], e[i + 2] * 2.8);
        ctx.fill();
        ctx.globalAlpha = 1;
        circle(ctx, e[i], e[i + 1], e[i + 2]);
        ctx.fill();
      }
    } else {
      // A big dark shape with two eyes, so the card never has a hole in it.
      ctx.fillStyle = "#020104";
      ctx.beginPath();
      ctx.ellipse(0, -def.h / 2, def.w / 2, def.h / 2, 0, 0, TAU);
      ctx.fill();
      dot(ctx, -def.w * 0.14, -def.h * 0.64, 0.5, "#ff3b1f");
      dot(ctx, def.w * 0.14, -def.h * 0.64, 0.5, "#ff3b1f");
    }
    ctx.restore();
    return ok;
  }

  return function bossIntroCard(ctx, v) {
    const { g, round } = v;
    const id = round.spec && round.spec.boss;
    const info = bossIntroFor(id);
    if (!info) return;
    const stage = introFor(round.stage);
    const pal = (stage && stage.palette) || FALLBACK;
    const def = v.bosses[id] || {};
    const accent = info.accent || def.color || BONE;
    const t = round.introMs || 0;
    const W = g.FIELD_W;
    const H = g.FIELD_H;
    const fade = Math.min(1, t / 260);
    const beat = beatAt(t);
    const amp = shakeAt(t);
    const n = Math.floor(t / 45);
    ctx.save();
    ctx.translate((rnd(n, 1) - 0.5) * amp, (rnd(n, 2) - 0.5) * amp);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#050308";
    ctx.fillRect(-2, -2, W + 4, H + 4);
    // The stage's color rising from the floor, a red wash that thumps with the heart.
    for (let i = 0; i < 6; i++) {
      ctx.globalAlpha = fade * (0.05 + 0.018 * (5 - i));
      ctx.fillStyle = pal.b;
      ctx.fillRect(-2, H - (i + 1) * (H / 6), W + 4, H / 6);
    }
    ctx.globalAlpha = fade * (0.06 + 0.1 * beat);
    ctx.fillStyle = "#b0120a";
    ctx.fillRect(-2, -2, W + 4, H + 4);
    // The spotlight: a cone from above and a pool of light on the floor.
    const cx = W / 2;
    ctx.globalAlpha = fade * (0.12 + 0.03 * Math.sin(t / 700) + 0.03 * beat);
    ctx.fillStyle = pal.glow;
    ctx.beginPath();
    ctx.moveTo(cx - 4, 12);
    ctx.lineTo(cx + 4, 12);
    ctx.lineTo(cx + 22, FLOOR_Y + 1);
    ctx.lineTo(cx - 22, FLOOR_Y + 1);
    ctx.fill();
    ctx.globalAlpha = fade * 0.18;
    ctx.beginPath();
    ctx.ellipse(cx, FLOOR_Y, 24, 3.2, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = fade * 0.3;
    ctx.beginPath();
    ctx.ellipse(cx, FLOOR_Y, 15, 1.9, 0, 0, TAU);
    ctx.fill();
    // The floor, dark.
    ctx.globalAlpha = fade;
    ctx.fillStyle = "#08050b";
    ctx.fillRect(-2, FLOOR_Y + 0.4, W + 4, H - FLOOR_Y);
    ctx.fillStyle = pal.b;
    ctx.globalAlpha = fade * 0.5;
    ctx.fillRect(-2, FLOOR_Y + 0.2, W + 4, 0.35);
    // Embers drifting up.
    for (let i = 0; i < 26; i++) {
      const p = (t / 4200 + rnd(i)) % 1;
      ctx.globalAlpha = fade * (1 - p) * 0.8;
      dot(ctx, rnd(i, 1) * W + Math.sin(t / 700 + i) * 1.6, FLOOR_Y + 3 - p * (FLOOR_Y + 3), 0.18 + rnd(i, 2) * 0.22, i % 3 ? "#ff7a1a" : "#ffd27a");
    }
    // The boss steps out of the dark.
    const rise = clamp01((t - 500) / 900);
    ctx.globalAlpha = fade * rise;
    drawBossPicture(ctx, v, id, t, cx + (NUDGE[id] || 0), FLOOR_Y);
    // The spotlight's glare over it, so it stands lit, not just in front of a light.
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = pal.glow;
    for (const s of [1, 0.78, 0.56]) {
      ctx.globalAlpha = fade * rise * (0.035 + 0.01 * beat);
      ctx.beginPath();
      ctx.ellipse(cx, FLOOR_Y - 12, 17 * s, 17 * s, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = fade;
    // The title, one letter at a time, each slamming down from big and white-hot.
    const chars = [...BOSS_TITLE];
    const em = chars.reduce((s, ch) => s + (ch === " " ? 0.4 : 0.68), 0);
    const size = Math.min(10, 86 / em);
    let x = cx - (em * size) / 2;
    chars.forEach((ch, i) => {
      const w = (ch === " " ? 0.4 : 0.68) * size;
      const lx = x + w / 2;
      x += w;
      if (ch === " ") return;
      const at = t - START_MS - i * STAGGER_MS;
      if (at <= 0) return;
      const p = clamp01(at / SLAM_MS);
      const sc = 1 + 2.2 * (1 - p) * (1 - p);
      const landed = p >= 1;
      const ly = 7.2 + (landed ? 0 : -(1 - p) * 2);
      ctx.globalAlpha = fade * (0.35 + 0.65 * p);
      if (landed) {
        ctx.globalAlpha = fade * (0.3 + 0.2 * Math.sin(t / 220 - i * 0.7) + 0.2 * beat);
        label(ctx, ch, lx, ly, size * 1.16, "#ff6a00", "center");
        ctx.globalAlpha = fade;
      }
      label(ctx, ch, lx + 0.35, ly + 0.55, size * sc, "rgba(0, 0, 0, 0.7)", "center");
      label(ctx, ch, lx, ly, size * sc, i % 2 ? "#ff3b1f" : "#ff7a1a", "center");
      if (landed) {
        // A white-hot flash as it lands.
        const dt = at - SLAM_MS;
        if (dt < 120) {
          ctx.globalAlpha = fade * (1 - dt / 120) * 0.9;
          label(ctx, ch, lx, ly, size, "#ffffff", "center");
        }
        ctx.globalAlpha = fade;
      }
    });
    // The name, big, then the epithet.
    const nameP = clamp01((t - 1300) / 450);
    ctx.globalAlpha = fade * nameP;
    const nameSize = Math.min(5, 84 / (info.name.length * 0.62));
    label(ctx, info.name.toUpperCase(), cx, 43.3 + (1 - nameP) * 1.4, nameSize * 1.06, "rgba(0, 0, 0, 0.8)", "center", W - 6, true);
    label(ctx, info.name.toUpperCase(), cx, 43.1 + (1 - nameP) * 1.4, nameSize, lift(accent), "center", W - 6, true);
    const epP = clamp01((t - 1750) / 450);
    ctx.globalAlpha = fade * epP;
    label(ctx, info.epithet, cx, 47.6 + (1 - epP) * 1.0, 2.3, BONE, "center", W - 8, true);
    // The hint, pulsing once a key is let through (the card waits for it as long as YOU like).
    if (t >= INTRO_MIN_MS) {
      ctx.globalAlpha = fade * (0.8 + 0.2 * Math.sin(t / 260));
      label(ctx, BOSS_HINT, cx, 51.6, 1.9, pal.glow || GOLD, "center", W - 6);
    }
    // A frame that flushes red with each beat.
    ctx.globalAlpha = fade * (0.55 + 0.45 * beat);
    ctx.strokeStyle = "#ff4a1c";
    ctx.lineWidth = 0.45;
    ctx.strokeRect(1.2, 1.2, W - 2.4, H - 2.4);
    ctx.restore();
    ctx.globalAlpha = 1;
  };
}
