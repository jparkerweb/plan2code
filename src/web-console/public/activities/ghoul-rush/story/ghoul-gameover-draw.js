// Plan2Code Web Console - Ghoul Rush's game over banner: "G A M E - O V E R" across the field, each letter dropping in with a stagger, bouncing once, then bobbing on a sine wave under a slow red and bone pulse.
//
// ghoul-draw.js plugs it in, the way it plugs in ghoul-dice-draw.js:
// gameOverBanner(d) takes its drawing helpers (`d`: label, BONE, DANGER) and
// hands back `(ctx, v)`, drawn over the field on the lost end screen, above the
// score and the tally panel (the field is 96 by 54 units, the panel starts at
// FIELD_H - 17, the score above it at FIELD_H - 29). `v.overMs` is how long the
// screen has been up. Field units, y counted down from the field's top.

export const OVER_WORD = "GAME-OVER";
const STAGGER_MS = 110;
const DROP_MS = 520;

// How far above its rest a letter is `t` ms after it began falling: 1 high up,
// 0 at rest, with one small bounce on landing.
export function dropAt(t) {
  if (t <= 0) return 1;
  if (t >= DROP_MS) return 0;
  const p = t / DROP_MS;
  if (p < 0.6) return 1 - (p / 0.6) ** 2;
  const b = (p - 0.6) / 0.4;
  return Math.sin(b * Math.PI) * 0.14;
}

export function gameOverBanner(d) {
  const { label, BONE, DANGER } = d;
  return function banner(ctx, v) {
    const { g } = v;
    const t = v.overMs || 0;
    const size = 8.4;
    const step = size * 1.12;
    const n = OVER_WORD.length;
    const x0 = g.FIELD_W / 2 - (step * (n - 1)) / 2;
    const base = g.FIELD_H * 0.25;
    const pulse = 1 + Math.sin(t / 420) * 0.04;
    ctx.save();
    ctx.translate(g.FIELD_W / 2, base);
    ctx.scale(pulse, pulse);
    ctx.translate(-g.FIELD_W / 2, -base);
    for (let i = 0; i < n; i++) {
      const fall = dropAt(t - i * STAGGER_MS);
      const landed = t - i * STAGGER_MS >= DROP_MS;
      const x = x0 + i * step;
      const bob = landed ? Math.sin(v.clock / 170 - i * 0.7) * size * 0.14 : 0;
      const y = base - fall * g.FIELD_H * 0.3 + bob;
      ctx.globalAlpha = Math.min(1, Math.max(0, (t - i * STAGGER_MS) / 80 + 0.2));
      // A dark shadow under each letter, then red and bone alternating.
      label(ctx, OVER_WORD[i], x + 0.5, y + 0.7, size, "rgba(0, 0, 0, 0.6)", "center");
      label(ctx, OVER_WORD[i], x, y, size, i % 2 ? BONE : DANGER, "center");
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };
}
