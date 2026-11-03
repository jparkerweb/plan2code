// Plan2Code Web Console - Ghoul Rush's stage intro card: a full-field title card with the stage's name in big colored letters dropping in one by one and then glowing, a small themed flourish drawn with canvas shapes (frost crystals, bunting, pickaxe sparks, drifting leaves, candle flames, ...), a few lines of flavor text fading in, the boss's name and a hint to press a key.
//
// ghoul-draw.js plugs it in, the way it plugs in ghoul-gameover-draw.js:
// introArt(d) takes its drawing helpers (`d`: label, GOLD, BONE) and hands back
// `(ctx, v)`, drawn over the whole field while `round.phase === "intro"` (also
// while paused). `round.introMs` is how long the card has been up (it stops with
// the game, so a pause holds the animation). The words and colors live in
// ghoul-intros.js. Field units (96 by 54), y counted down from the field's top.

import { INTRO_MIN_MS } from "./ghoul-run.js";
import { introFor } from "./ghoul-intros.js";

export const INTRO_HINT = "Press any move key or fire to enter";
export const TITLE_SIZE = 5.6;
export const LINE_SIZE = 2.3;
const DROP_MS = 520;
const STAGGER_MS = 70;
const TAU = Math.PI * 2;

// How wide a letter runs, in ems: narrow, wide, and the rest.
const advance = (ch) => (" .,:;'!iIjl".includes(ch) ? 0.36 : "mwMW".includes(ch) ? 0.95 : 0.66);

// The title's letters: x offsets from its middle, and the size that keeps it inside `max` units.
export function titleLayout(title, max = 88) {
  const em = [...title].reduce((s, ch) => s + advance(ch), 0);
  const size = Math.min(TITLE_SIZE, max / em);
  let x = -(em * size) / 2;
  const xs = [...title].map((ch) => {
    const at = x + (advance(ch) * size) / 2;
    x += advance(ch) * size;
    return at;
  });
  return { size, xs };
}

// A letter's height above its rest `t` ms after it began to fall: 1 high up, 0 at rest, one small bounce.
export function dropAt(t) {
  if (t <= 0) return 1;
  if (t >= DROP_MS) return 0;
  const p = t / DROP_MS;
  if (p < 0.6) return 1 - (p / 0.6) ** 2;
  return Math.sin(((p - 0.6) / 0.4) * Math.PI) * 0.14;
}

// A steady pseudo-random number in [0, 1) for item `i` and a salt.
export const rnd = (i, salt = 0) => {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const poly = (ctx, pts, fill) => {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
};
export const dot = (ctx, x, y, r, fill) => {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.05, r), 0, TAU);
  ctx.fillStyle = fill;
  ctx.fill();
};
export const stroke = (ctx, x1, y1, x2, y2, color, w) => {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
};
// Draws `fn` at `alpha` times the alpha it was called with.
export const faint = (ctx, alpha, fn) => {
  const was = ctx.globalAlpha;
  ctx.globalAlpha = was * Math.max(0, Math.min(1, alpha));
  fn();
  ctx.globalAlpha = was;
};
// A flame: a teardrop of height h at (x, y), wavering.
export const flame = (ctx, x, y, h, t, i, color) => {
  const sway = Math.sin(t / 120 + i * 2) * h * 0.18;
  const hh = h * (0.9 + 0.1 * Math.sin(t / 90 + i));
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x - h * 0.45, y - hh * 0.4, x + sway, y - hh);
  ctx.quadraticCurveTo(x + h * 0.45, y - hh * 0.4, x, y);
  ctx.fillStyle = color;
  ctx.fill();
};
// A frost crystal: three crossing arms and a diamond heart.
const flake = (ctx, x, y, r, rot, color) => {
  for (let k = 0; k < 3; k++) {
    const a = rot + (k * Math.PI) / 3;
    stroke(ctx, x - Math.cos(a) * r, y - Math.sin(a) * r, x + Math.cos(a) * r, y + Math.sin(a) * r, color, Math.max(0.12, r * 0.14));
  }
  poly(ctx, [[x, y - r * 0.5], [x + r * 0.3, y], [x, y + r * 0.5], [x - r * 0.3, y]], color);
};

// Each stage's flourish: (ctx, t, pal, W, H) drawn behind the words.
const FLOURISH = {
  // Bats crossing the sky.
  manor(ctx, t, pal, W) {
    for (let i = 0; i < 4; i++) {
      const x = ((t / 30 + i * 31) % (W + 16)) - 8;
      const y = 6 + i * 9 + Math.sin(t / 400 + i) * 2;
      const f = Math.sin(t / 80 + i) * 1.6;
      poly(ctx, [[x, y], [x - 3, y - 1.6 + f], [x - 1.4, y + 0.4], [x, y + 0.8], [x + 1.4, y + 0.4], [x + 3, y - 1.6 + f]], pal.glow);
    }
  },
  // Dust in the lamplight and a spider on a thread.
  wing(ctx, t, pal, W, H) {
    for (let i = 0; i < 26; i++) dot(ctx, rnd(i) * W + Math.sin(t / 900 + i) * 2, H - ((t / 40 + rnd(i, 1) * H) % H), 0.2 + rnd(i, 2) * 0.35, pal.glow);
    const drop = 8 + Math.sin(t / 700) * 3;
    stroke(ctx, W - 10, 0, W - 10, drop, pal.glow, 0.15);
    dot(ctx, W - 10, drop + 0.8, 0.9, pal.a);
  },
  // Headstones in a rolling mist.
  graveyard(ctx, t, pal, W, H) {
    for (let i = 0; i < 6; i++) {
      const x = 7 + i * 16 + (i % 2) * 3;
      const h = 5 + (i % 3) * 1.8;
      ctx.fillStyle = "rgba(10, 18, 14, 0.9)";
      ctx.fillRect(x - 2, H - h, 4, h);
      ctx.beginPath();
      ctx.arc(x, H - h, 2, Math.PI, 0);
      ctx.fill();
    }
    for (let i = 0; i < 5; i++) {
      faint(ctx, 0.35, () => {
        ctx.beginPath();
        ctx.ellipse(((t / 90 + i * 23) % (W + 30)) - 15, H - 2.2 - (i % 2), 14, 1.8, 0, 0, TAU);
        ctx.fillStyle = pal.glow;
        ctx.fill();
      });
    }
  },
  // Leaves drifting down.
  grounds(ctx, t, pal, W, H) {
    for (let i = 0; i < 16; i++) {
      const y = ((t / 28 + rnd(i) * H * 2) % (H + 6)) - 3;
      const x = rnd(i, 1) * W + Math.sin(t / 600 + i * 1.7) * 4;
      ctx.beginPath();
      ctx.ellipse(x, y, 1.1, 0.55, t / 500 + i, 0, TAU);
      ctx.fillStyle = i % 3 ? pal.a : pal.glow;
      ctx.fill();
    }
  },
  // Candles in two rows with wavering flames.
  chapel(ctx, t, pal, W, H) {
    for (let i = 0; i < 8; i++) {
      const x = i < 4 ? 4 + i * 3.4 : W - 4 - (i - 4) * 3.4;
      const h = 5 + (i % 3) * 1.5;
      ctx.fillStyle = "#efe6cf";
      ctx.fillRect(x - 0.7, H - h, 1.4, h);
      flame(ctx, x, H - h, 2.6, t, i, pal.glow);
      flame(ctx, x, H - h - 0.1, 1.4, t + 40, i, "#fff3c4");
    }
  },
  // A heartbeat that runs across the bottom, and a blinking cross.
  sanatorium(ctx, t, pal, W, H) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 0.8) {
      const p = (((x + t / 22) % 40) + 40) % 40;
      const y = p > 14 && p < 15 ? -5 : p >= 15 && p < 16.5 ? 3 : p >= 16.5 && p < 17.5 ? -1 : 0;
      if (x) ctx.lineTo(x, H - 4 + y);
      else ctx.moveTo(x, H - 4 + y);
    }
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 0.35;
    ctx.stroke();
    if (Math.sin(t / 700) > -0.2) {
      ctx.fillStyle = pal.glow;
      ctx.fillRect(W - 9, 3, 3, 1);
      ctx.fillRect(W - 8, 2, 1, 3);
    }
  },
  // A crescent moon and windows that blink.
  village(ctx, t, pal, W, H) {
    dot(ctx, W - 14, 11, 4.5, pal.glow);
    dot(ctx, W - 12.4, 10, 4.2, "#0e0c28");
    for (let i = 0; i < 9; i++) {
      const lit = Math.sin(t / 900 + i * 2.3) > -0.4;
      ctx.fillStyle = "rgba(8, 6, 24, 0.9)";
      ctx.fillRect(3 + i * 10.4, H - 6, 6, 6);
      ctx.fillStyle = lit ? pal.glow : "rgba(40, 40, 80, 0.8)";
      ctx.fillRect(4.6 + i * 10.4, H - 4.6, 2.8, 2.4);
    }
  },
  // Sparks flying off a pickaxe's strike, low at both sides.
  mine(ctx, t, pal, W, H) {
    for (const side of [0, 1]) {
      const bx = side ? W - 7 : 7;
      stroke(ctx, bx - 3, H - 3, bx + 3, H - 9, "#8a6a42", 0.6);
      stroke(ctx, bx - 3.5, H - 8, bx + 3.5, H - 9.5, "#cfd5da", 0.9);
      for (let i = 0; i < 12; i++) {
        const p = (t / 700 + rnd(i, side)) % 1;
        const a = -Math.PI * (0.15 + 0.7 * rnd(i, 3 + side));
        const sp = 7 + rnd(i, 5) * 8;
        faint(ctx, 1 - p, () => dot(ctx, bx + Math.cos(a) * sp * p, H - 8 + Math.sin(a) * sp * p + 24 * p * p, 0.35, i % 2 ? pal.glow : "#fff3c4"));
      }
    }
  },
  // Bunting along the top, swaying, with bulbs.
  carnival(ctx, t, pal) {
    const cols = [pal.a, pal.glow, "#fde047", pal.b];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 12; i++) {
        const x = 4 + i * 8;
        const sag = Math.sin((i / 11) * Math.PI) * (3 + row * 2.5) + row * 3;
        const sw = Math.sin(t / 400 + i + row) * 0.5;
        poly(ctx, [[x - 2, sag], [x + 2, sag], [x + sw, sag + 4]], cols[(i + row) % 4]);
        dot(ctx, x, sag - 0.3, 0.3 + 0.15 * Math.sin(t / 150 + i), "#fffbe8");
      }
    }
  },
  // Frost crystals falling and twinkling.
  frozen(ctx, t, pal, W, H) {
    for (let i = 0; i < 14; i++) {
      const y = ((t / 40 + rnd(i) * H * 2) % (H + 8)) - 4;
      const x = rnd(i, 1) * W + Math.sin(t / 800 + i) * 3;
      faint(ctx, 0.5 + 0.5 * Math.sin(t / 220 + i * 1.9) ** 2, () => flake(ctx, x, y, 0.8 + rnd(i, 2) * 1.6, t / 1500 + i, pal.glow));
    }
  },
  // Wisp motes drifting over rising mud bubbles.
  bog(ctx, t, pal, W, H) {
    for (let i = 0; i < 7; i++) {
      const x = ((rnd(i, 4) * W + t / 60 + Math.sin(t / 700 + i) * 6) % (W + 8)) - 4;
      const y = H * 0.25 + rnd(i, 5) * H * 0.5 + Math.sin(t / 500 + i * 1.7) * 3;
      faint(ctx, 0.5 + 0.5 * Math.sin(t / 300 + i * 2.1), () => dot(ctx, x, y, 0.7 + rnd(i, 6) * 0.6, pal.glow));
    }
    for (let i = 0; i < 6; i++) {
      const p = (t / 1600 + rnd(i, 7)) % 1;
      const x = 8 + rnd(i, 8) * (W - 16);
      faint(ctx, 1 - p, () => {
        ctx.beginPath();
        ctx.arc(x, H - 3 - p * 10, 0.5 + p * 0.8, 0, TAU);
        ctx.strokeStyle = pal.a;
        ctx.lineWidth = 0.2;
        ctx.stroke();
      });
    }
  },
  // The hall: dust and a flickering torch at each end.
  hall(ctx, t, pal, W, H) {
    for (let i = 0; i < 18; i++) dot(ctx, rnd(i) * W, H - ((t / 45 + rnd(i, 1) * H) % H), 0.25, pal.glow);
    for (const x of [5, W - 5]) {
      ctx.fillStyle = "#3a2a18";
      ctx.fillRect(x - 0.5, H - 8, 1, 5);
      flame(ctx, x, H - 8, 3.2, t, x, pal.glow);
    }
  },
};

export function introArt(d) {
  const { label, GOLD, BONE } = d;
  return function introCard(ctx, v) {
    const { g, round } = v;
    const info = introFor(round.stage);
    if (!info) return;
    const t = round.introMs || 0;
    const W = g.FIELD_W;
    const H = g.FIELD_H;
    const pal = info.palette;
    const fade = Math.min(1, t / 320);
    ctx.save();
    ctx.globalAlpha = fade * 0.97;
    ctx.fillStyle = "#07050c";
    ctx.fillRect(0, 0, W, H);
    // Bands of the stage's color rising from the floor, a glow behind the title.
    for (let i = 0; i < 8; i++) {
      ctx.globalAlpha = fade * (0.05 + 0.02 * (7 - i));
      ctx.fillStyle = pal.b;
      ctx.fillRect(0, H - (i + 1) * (H / 8), W, H / 8);
    }
    ctx.globalAlpha = fade * (0.1 + 0.04 * Math.sin(t / 500));
    ctx.beginPath();
    ctx.ellipse(W / 2, 16, 38, 11, 0, 0, TAU);
    ctx.fillStyle = pal.glow;
    ctx.fill();
    ctx.globalAlpha = fade;
    (FLOURISH[round.stage] || FLOURISH.hall)(ctx, t, pal, W, H);
    ctx.globalAlpha = fade;
    // A frame in the stage's color.
    ctx.strokeStyle = pal.glow;
    ctx.lineWidth = 0.4;
    ctx.strokeRect(1.2, 1.2, W - 2.4, H - 2.4);
    // The kicker, then the title letter by letter.
    label(ctx, info.kicker.toUpperCase(), W / 2, 6, 1.9, BONE, "center", W - 8);
    const { size, xs } = titleLayout(info.title);
    const chars = [...info.title];
    for (let i = 0; i < chars.length; i++) {
      if (chars[i] === " ") continue;
      const at = t - 200 - i * STAGGER_MS;
      const landed = at >= DROP_MS;
      const x = W / 2 + xs[i];
      const y = 15 - dropAt(at) * 20 + (landed ? Math.sin(t / 260 - i * 0.6) * size * 0.05 : 0);
      ctx.globalAlpha = fade * Math.min(1, Math.max(0, at / 80 + 0.2));
      // The glow breathes under each landed letter.
      if (landed) {
        ctx.globalAlpha = fade * (0.25 + 0.2 * Math.sin(t / 300 - i * 0.5));
        label(ctx, chars[i], x, y, size * 1.12, pal.glow, "center");
        ctx.globalAlpha = fade;
      }
      label(ctx, chars[i], x + 0.3, y + 0.5, size, "rgba(0, 0, 0, 0.65)", "center");
      label(ctx, chars[i], x, y, size, i % 2 ? pal.b : pal.a, "center");
      // A lighter top edge once landed.
      if (landed) {
        ctx.globalAlpha = fade * 0.55;
        label(ctx, chars[i], x, y - size * 0.06, size * 0.94, pal.a, "center");
        ctx.globalAlpha = fade;
      }
    }
    // A divider, then the flavor lines fading up one at a time.
    const lineAt = 1000;
    ctx.globalAlpha = fade * Math.min(1, Math.max(0, (t - 800) / 400));
    stroke(ctx, W / 2 - 20, 22, W / 2 + 20, 22, pal.glow, 0.3);
    dot(ctx, W / 2, 22, 0.8 + 0.2 * Math.sin(t / 250), pal.glow);
    info.lines.forEach((line, i) => {
      const p = Math.min(1, Math.max(0, (t - lineAt - i * 550) / 450));
      ctx.globalAlpha = fade * p;
      label(ctx, line, W / 2, 27.5 + i * 4.4 + (1 - p) * 1.2, LINE_SIZE, BONE, "center", W - 4);
    });
    if (info.boss) {
      const p = Math.min(1, Math.max(0, (t - lineAt - info.lines.length * 550) / 450));
      ctx.globalAlpha = fade * p;
      label(ctx, `BOSS: ${info.boss.toUpperCase()}`, W / 2, 46.5, 2, GOLD, "center", W - 8);
    }
    // The hint, pulsing once a key is let through (the card waits for it as long as YOU like).
    if (t >= INTRO_MIN_MS) {
      ctx.globalAlpha = fade * (0.55 + 0.45 * Math.sin(t / 260));
      label(ctx, INTRO_HINT, W / 2, 51.2, 1.9, pal.glow, "center");
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  };
}
