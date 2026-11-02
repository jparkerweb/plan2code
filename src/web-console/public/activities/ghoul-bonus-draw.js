// Plan2Code Web Console - Ghoul Rush's bonus rounds, their drawing: the "BONUS ROUND" intro, a heart lost, and the card that ends one ("BONUS CLEARED! +N LUCKY DICE" with the dice tumbling in, or a short, friendly "BONUS LOST").
//
// ghoul-draw.js plugs it in, the way it plugs in ghoul-dice-draw.js:
// bonusArt(d, die) takes its own drawing helpers (`d`) and the Lucky die's
// `die(ctx, x, y, size, face, angle, ink)` and hands back `card(ctx, v)` (drawn
// over the field while the phase is "clear" and the round is over), `react(e, k)`
// (the sounds and flourishes of `bonusStart`, `bonusEnd` and a heart lost; true
// when it took the event) and `tick(round, k)` (a click for every die that has
// landed, called each frame). Field units, y counted down from the field's top.
// The rules are in ghoul-bonus.js.

import { BONUS_READY_MS } from "./ghoul-bonus.js";

export const BONUS_COLOR = "#ffcf4a";
// A die falls in for TUMBLE_IN_MS, lands at LAND_FIRST_MS + i * LAND_STEP_MS.
const TUMBLE_IN_MS = 450;
const LAND_FIRST_MS = 700;
const LAND_STEP_MS = 300;

export function bonusArt(d, die) {
  const { roundRect, label, GOLD, DANGER } = d;

  // The card: a dark panel in the field's middle, the title, the dice and the count.
  function card(ctx, v) {
    const { g, round } = v;
    const b = round.bonusRound;
    if (!b || !b.over) return;
    const t = Math.max(0, b.cardMs - round.phaseMs);
    const won = b.won;
    const w = 80;
    const h = won ? 34 : 16;
    const cx = g.FIELD_W / 2;
    const cy = g.FIELD_H * 0.46;
    const fade = Math.min(1, t / 200);
    ctx.globalAlpha = fade;
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 3);
    ctx.fill();
    ctx.strokeStyle = won ? GOLD : "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
    if (!won) {
      label(ctx, "BONUS LOST, on to the boss", cx, cy - 3, 4, "#ffffff", "center", w - 4);
      label(ctx, "No dice. Your lives are safe", cx, cy + 4, 2.4, GOLD, "center", w - 4);
      ctx.globalAlpha = 1;
      return;
    }
    const pop = t < 260 ? 0.7 + (t / 260) * 0.4 : t < 380 ? 1.1 - ((t - 260) / 120) * 0.1 : 1;
    label(ctx, "BONUS CLEARED!", cx, cy - 11.5, 5.2 * pop, GOLD, "center", w - 4);
    label(ctx, b.dice === 1 ? "+1 LUCKY DIE" : `+${b.dice} LUCKY DICE`, cx, cy - 5.4, 3.2, "#ffffff", "center", w - 4);
    // The dice, one beat apart: tumbling down in, then landing on a gold six.
    const size = 6.4;
    const step = Math.min(8.2, (w - 8) / Math.max(1, b.dice));
    const x0 = cx - (step * (b.dice - 1)) / 2;
    const y0 = cy + 2.6;
    for (let i = 0; i < b.dice; i++) {
      const land = LAND_FIRST_MS + i * LAND_STEP_MS;
      const since = t - (land - TUMBLE_IN_MS);
      if (since < 0) continue;
      const p = Math.min(1, since / TUMBLE_IN_MS);
      const landed = p >= 1;
      const after = t - land;
      const drop = (1 - p) ** 2 * -7;
      const bounce = landed ? Math.abs(Math.sin(after / 90)) * -1.6 * Math.max(0, 1 - after / 260) : 0;
      const face = landed ? 6 : 1 + (Math.floor(since / 60) + i) % 5;
      die(ctx, x0 + i * step, y0 + drop + bounce, size, face, landed ? 0 : (1 - p) * 9 * (i % 2 ? -1 : 1), landed ? "#b8860b" : "#1d1a17");
    }
    const tail = b.gained < b.dice ? `${round.dice} of 9 in hand (full)` : `${round.dice} in hand`;
    label(ctx, tail, cx, cy + 12, 2.4, t > LAND_FIRST_MS + (b.dice - 1) * LAND_STEP_MS ? GOLD : "rgba(255,255,255,0.5)", "center", w - 4);
    ctx.globalAlpha = 1;
  }

  function react(e, k) {
    const { tone, burst, float, flash, banner, fx } = k;
    if (e.type === "bonusStart") {
      tone("fanfare", 0.4, 1.1);
      tone("sparkle", 0.35);
      flash(BONUS_COLOR, 240);
      banner("BONUS ROUND", e.how || `${e.max} hearts of your own. Your lives are safe`, BONUS_COLOR, BONUS_READY_MS);
    } else if (e.type === "bonusEnd") {
      fx.bonusLanded = 0;
      // The dark ride's cards have their own sounds (ghoul-ride-draw.js tick), so only the flourish plays here.
      if (e.won) {
        if (!e.ride) {
          tone("fanfare", 0.5);
          tone("sparkle", 0.4);
        }
        flash("#fffbe8", 260);
        burst(e.x, e.y + 3, GOLD, 24, 16, 700);
      } else if (!e.ride) {
        tone("ghoulToll", 0.35, 1.1);
        tone("whoosh", 0.25, 0.7);
      }
    } else if (e.type === "lose" && e.hearts !== undefined) {
      // The ordinary sounds of a hit play too (ghoul-draw.js); this adds the heart.
      float(e.x, Math.max(6, e.y + 11), e.hearts > 0 ? `${e.hearts} ${e.hearts === 1 ? "heart" : "hearts"} left` : "Out of hearts", e.hearts > 1 ? "#ffffff" : DANGER, 2.4);
      return false;
    } else return false;
    return true;
  }

  // A click for every die the card has landed.
  function tick(round, k) {
    const b = round.bonusRound;
    if (!b || !b.over || !b.won || round.phase !== "clear") return;
    const t = b.cardMs - round.phaseMs;
    const n = Math.min(b.dice, Math.max(0, Math.floor((t - LAND_FIRST_MS) / LAND_STEP_MS) + 1));
    const fx = k.fx;
    while ((fx.bonusLanded || 0) < n) {
      fx.bonusLanded = (fx.bonusLanded || 0) + 1;
      k.tone("thunk", 0.35, 0.8 + 0.06 * fx.bonusLanded);
      k.tone("click", 0.3, 1.1);
    }
  }

  return { card, react, tick };
}
