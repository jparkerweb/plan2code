// Plan2Code Web Console - Ghoul Rush's Lucky die, its drawing: the little die a kill drops, the big die rolling for Planny's life, and what each step of the roll looks and sounds like.
//
// ghoul-draw.js plugs it in. diceArt(d) takes ghoul-draw.js's own drawing
// helpers (`d`: circle, roundRect, rotate, label and the colors) and hands
// back `drop`, `roll` and `react`, the way the stage packs' art does, so this
// file never reaches back into it. Everything is drawn in field units, y
// counted down from the field's top.

import { DICE_FACES, LEAD_MS, TUMBLE_MS } from "./ghoul-dice.js";

const BODY = "#f4f1e8";
const EDGE = "#8f8a7d";
const INK = "#1d1a17";
const ONE = "#c0392b";

// Where a face's pips go, on a grid of -1 to 1 across the die.
const PIPS = Object.freeze([
  [],
  [[0, 0]],
  [[-1, -1], [1, 1]],
  [[-1, -1], [0, 0], [1, 1]],
  [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]],
]);

// The panel the big die rolls on, and the die in it.
const PANEL_W = 44;
const PANEL_H = 40;
// The least gap between the panel and the field's edge.
const MARGIN = 1.5;
const DIE_SIZE = 15;
// Candidate spots for the panel's middle, tried in order: the field's middle
// first, then to either side; a row high on the field and one low.
const PANEL_X = Object.freeze([0.5, 0.74, 0.26]);
const PANEL_ROWS = Object.freeze([0.34, 0.66]);
// The save's sweeping word, and how long it takes to cross the field.
const WORD = "LUCKY-SAVE";
const LUCKY_MS = 2800;

export function diceArt(d) {
  const { circle, roundRect, rotate, label, GOLD, DANGER, hudLayout } = d;

  // A die of side `s` at (x, y), turned `angle`, showing `face`; `ink` is its
  // pips' color (a saving face is gold).
  function die(ctx, x, y, s, face, angle = 0, ink = INK) {
    ctx.save();
    ctx.translate(x, y);
    rotate(ctx, angle);
    ctx.fillStyle = EDGE;
    roundRect(ctx, -s / 2, -s / 2 + s * 0.06, s, s, s * 0.2);
    ctx.fill();
    ctx.fillStyle = BODY;
    roundRect(ctx, -s / 2, -s / 2, s, s, s * 0.2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(0.15, s * 0.05);
    ctx.stroke();
    const r = s * 0.085;
    const reach = s * 0.28;
    for (const [px, py] of PIPS[face] || PIPS[1]) {
      circle(ctx, px * reach, py * reach, r);
      ctx.fillStyle = face === 1 ? ONE : ink;
      ctx.fill();
    }
    ctx.restore();
  }

  // The die a kill leaves, bobbing a little on its dark disc like the other drops.
  function drop(ctx, x, y, clock) {
    const bob = 0.25 * Math.sin(clock / 250 + x);
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    circle(ctx, x, y, 1.7);
    ctx.fill();
    die(ctx, x, y + bob, 2.3, 5, 0.18 * Math.sin(clock / 400 + x));
  }

  // Where the panel's middle goes, as far from Planny's spot as the field
  // lets it: the first candidate that does not touch him.
  // How much the panel is scaled to fit inside the field with a margin.
  function panelFit(g) {
    return Math.min(1, (g.FIELD_H - 2 * MARGIN) / PANEL_H, (g.FIELD_W - 2 * MARGIN) / PANEL_W);
  }

  function panelAt(v, roll) {
    const at = panelSpot(v, roll);
    const { g } = v;
    const hw = (PANEL_W * panelFit(g)) / 2;
    const hh = (PANEL_H * panelFit(g)) / 2;
    return { x: Math.min(g.FIELD_W - hw - MARGIN, Math.max(hw + MARGIN, at.x)), y: Math.min(g.FIELD_H - hh - MARGIN, Math.max(hh + MARGIN, at.y)) };
  }

  function panelSpot(v, roll) {
    const { g, round } = v;
    const cam = Math.round(round.camX * 8) / 8;
    const sx = roll.x - cam;
    const top = g.FIELD_H - (roll.y + g.YOU_H);
    const near = 3;
    const him = { x0: sx - g.YOU_W / 2 - near, x1: sx + g.YOU_W / 2 + near, y0: top - near, y1: top + g.YOU_H + near };
    const high = top + g.YOU_H / 2 > g.FIELD_H * 0.5;
    let first = null;
    for (const row of high ? PANEL_ROWS : [...PANEL_ROWS].reverse()) {
      for (const col of PANEL_X) {
        const at = { x: g.FIELD_W * col, y: g.FIELD_H * row };
        first ||= at;
        const clear = at.x + PANEL_W / 2 < him.x0 || at.x - PANEL_W / 2 > him.x1 || at.y + PANEL_H / 2 < him.y0 || at.y - PANEL_H / 2 > him.y1;
        if (clear) return at;
      }
    }
    return first;
  }

  // Where the die's pill sits in the HUD strip, in field units (the strip is
  // above the field, so y is negative); the strip's right end when it is not shown.
  function hudDiceSpot(v) {
    const { g, round } = v;
    for (const p of hudLayout(v.pillH, g.W, round.infinite ? Infinity : round.lives, v.hud, g.HUD_H)) {
      if (typeof p.text === "string" && p.text.startsWith("DICE")) return { x: p.x + p.w / 2 - g.PAD, y: p.y + p.h / 2 - g.HUD_H };
    }
    return { x: g.W - g.PAD * 2 - 8, y: -g.HUD_H / 2 };
  }

  // The die in hand while the round holds to roll: tumbling in from above,
  // landing on its face with a pop, and a line saying where it stands.
  function roll(ctx, v) {
    const r = v.round.roll;
    if (!r) return;
    const { x, y } = panelAt(v, r);
    // The whole panel shrinks to fit a small field, and sits inside it, so no edge is cut off.
    const fit = panelFit(v.g);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(fit, fit);
    ctx.translate(-x, -y);
    rollIn(ctx, v, r, x, y, fit);
    ctx.restore();
  }

  function rollIn(ctx, v, r, x, y, fit) {
    // The lead-in: the panel grows out of the die, which flies up from its pill in the HUD.
    if (r.t < LEAD_MS) {
      const e = 1 - (1 - r.t / LEAD_MS) ** 3;
      const spot = hudDiceSpot(v);
      // The HUD spot, in the shrunk panel's own space.
      const from = { x: x + (spot.x - x) / fit, y: y + (spot.y - y) / fit };
      const s = 0.12 + 0.88 * e;
      ctx.save();
      ctx.globalAlpha = e;
      ctx.translate(x, y);
      ctx.scale(s, s);
      ctx.translate(-x, -y);
      ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
      roundRect(ctx, x - PANEL_W / 2, y - PANEL_H / 2, PANEL_W, PANEL_H, 2.5);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 0.3;
      ctx.stroke();
      ctx.restore();
      const gx = from.x + (x - from.x) * e;
      const gy = from.y + (y - 6 - from.y) * e;
      ctx.fillStyle = "rgba(244, 241, 232, 0.25)";
      circle(ctx, gx, gy, (3 + DIE_SIZE * 0.6 * e));
      ctx.fill();
      die(ctx, gx, gy, 3 + (DIE_SIZE - 3) * e, 1 + (Math.floor(r.t / 60) * 5) % 6, (1 - e) * 9);
      return;
    }
    const lucky = r.landed && (!!DICE_FACES[r.face].revive || !!r.heart);
    ctx.fillStyle = "rgba(0, 0, 0, 0.62)";
    roundRect(ctx, x - PANEL_W / 2, y - PANEL_H / 2, PANEL_W, PANEL_H, 2.5);
    ctx.fill();
    ctx.strokeStyle = lucky ? GOLD : "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = lucky ? 0.6 : 0.3;
    ctx.stroke();
    const at = y - 6;
    let face;
    let size = DIE_SIZE;
    let angle = 0;
    let dy = 0;
    if (r.landed) {
      face = r.face;
      const since = r.t - TUMBLE_MS;
      size *= 1 + 0.14 * Math.max(0, 1 - since / 180);
      // A 1 shakes with the laugh.
      if (r.face === 1) angle = 0.09 * Math.sin(since / 28);
      if (lucky) {
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(v.clock / 120);
        circle(ctx, x, at, DIE_SIZE * 0.85);
        ctx.fillStyle = GOLD;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      const p = (r.t - LEAD_MS) / (TUMBLE_MS - LEAD_MS);
      face = 1 + (Math.floor(r.t / 70) * 5) % 6;
      angle = (1 - p) ** 1.5 * 12;
      dy = Math.abs(Math.sin(r.t / 105)) * -2.5 * (1 - p) - 3.5 * (1 - Math.min(1, (r.t - LEAD_MS) / 220)) ** 2;
    }
    die(ctx, x, at + dy, size, face, angle, lucky ? "#b8860b" : INK);
    let text = "A 4 or better saves you";
    let color = "#ffffff";
    if (r.landed) {
      // On the last life there is no next one for a gift to wait for.
      const wasted = DICE_FACES[r.face].gift && v.round.lives <= 1 && !r.heart;
      text = r.heart ? `A ${r.face} on your last heart: +1 heart!` : wasted ? `A ${r.face}, and no lives left` : DICE_FACES[r.face].line;
      color = lucky ? GOLD : DICE_FACES[r.face].gift && !wasted ? "#ffffff" : DANGER;
    }
    label(ctx, text, x, y + 9.5, 2.7, color, "center", PANEL_W - 3);
    // After the roll, what is left in hand (the roll has already taken its die).
    if (r.landed) {
      const n = v.round.dice;
      label(ctx, `You have ${n} Lucky ${n === 1 ? "Die" : "Dice"} left!`, x, y + 15, 2.3, "#8fd8ff", "center", PANEL_W - 3);
    }
  }

  // What each step of the roll looks and sounds like (house tones for now);
  // whether `e` was one of them.
  function react(e, k) {
    const { tone, burst, float, ring, flash, glow, shake, banner, fx, powers: POWERS } = k;
    if (e.type === "diceStart") {
      tone("ghoulDiceDrone", 0.6);
      tone("heartbeat", 0.45);
      ring(e.x, e.y + 2.5, BODY, 2, 8, 500);
    } else if (e.type === "diceRoll") {
      tone("rattle", 0.35, 1.2);
      tone("click", 0.3, 0.9);
    } else if (e.type === "diceFace") {
      if (e.face === 1) {
        tone("ghoulDiceLaugh", 0.6);
      } else if (DICE_FACES[e.face].revive || e.heart) {
        // The revive's jingle follows; the landing only clicks.
        tone("click", 0.3, 1.1);
        burst(e.x, e.y + 2.5, GOLD, 18, 14, 600);
        glow(e.x, e.y + 2.5, 9, 0.6, 500);
      } else {
        tone("thunk", 0.4, 0.6);
        tone("click", 0.3, 0.7);
      }
    } else if (e.type === "diceSaved") {
      tone("ghoulLuckySave", 0.6);
      fx.lucky = { life: LUCKY_MS, max: LUCKY_MS };
      ring(e.x, e.y + 2.5, POWERS.garlic.color, 2, 8, 600);
      burst(e.x, e.y + 2.5, "#fffbe8", 14, 12, 500);
      float(e.x, e.y + 8, DICE_FACES[e.face].word, GOLD, 2.8);
      flash("#ffffff", 200);
    } else if (e.type === "diceBlast") {
      // A monster in view blown apart by the saved life.
      burst(e.x, e.y, GOLD, 12, 18, 600);
      burst(e.x, e.y, "#ffffff", 6, 12, 400);
      ring(e.x, e.y, GOLD, 1, 6, 450);
      glow(e.x, e.y, 7, 0.5, 350);
    } else if (e.type === "diceFail") {
      // A 1 has had its laugh.
      if (e.face !== 1) tone("ghoulToll", 0.45, 0.8);
      shake(120, 0.3);
    } else if (e.type === "diceHeart") {
      tone("powerUp", 0.5);
      ring(e.x, e.y + 2.5, GOLD, 2, 8, 600);
      burst(e.x, e.y + 2.5, GOLD, 14, 12, 500);
      float(e.x, e.y + 8, "+1 heart!", GOLD, 2.8);
    } else if (e.type === "diceGift") {
      const color = POWERS[DICE_FACES[e.face].gift[0]].color;
      tone("powerUp", 0.5);
      ring(e.x, e.y + 2.5, POWERS.garlic.color, 2, 8, 600);
      burst(e.x, e.y + 2.5, color, 14, 12, 500);
      banner(DICE_FACES[e.face].word, "A gift from the Lucky die", color, 1600);
    } else return false;
    return true;
  }

  // "L U C K Y - S A V E" sweeping across the field, each letter bobbing on
  // a sine wave as the line passes, on the half of the field away from Planny.
  function lucky(ctx, v) {
    const L = v.fx.lucky;
    const { g, round } = v;
    const p = 1 - L.life / L.max;
    const size = 4.6;
    const step = size * 1.15;
    const width = step * (WORD.length - 1);
    const x0 = -width / 2 - size + (g.FIELD_W + width + size * 2) * p;
    const high = round.you.y > g.FIELD_H * 0.4;
    const base = g.FIELD_H * (high ? 0.8 : 0.2);
    ctx.globalAlpha = p < 0.06 ? p / 0.06 : p > 0.94 ? (1 - p) / 0.06 : 1;
    for (let i = 0; i < WORD.length; i++) {
      if (WORD[i] === " ") continue;
      const x = x0 + i * step;
      const y = base + Math.sin(v.clock / 130 - i * 0.9) * size * 0.55;
      label(ctx, WORD[i], x, y, size, i % 2 ? "#fffbe8" : GOLD, "center");
    }
    ctx.globalAlpha = 1;
  }

  return { drop, roll, lucky, react, die };
}
