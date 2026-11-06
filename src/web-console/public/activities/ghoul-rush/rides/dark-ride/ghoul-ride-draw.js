// Plan2Code Web Console - Ghoul Rush's dark ride, its drawing entry: rideArt(d, die) paints the whole 96 by 54 field of the bonus ride, and plays the cleared card's dice sounds.
//
// ghoul-draw.js plugs it in the way it plugs in bonusArt: rideArt(d, die) takes
// the game's drawing helpers (`d`, little needed here: the ride draws with its
// own, ghoul-ride-gfx.js) and the Lucky die's `die(ctx, x, y, size, face,
// angle, ink)`, and hands back:
//
// - field(ctx, v)    the field for the current frame, ctx already scaled to field units and clipped.
//                    By v.round.phase: "ready" the title with the car at rest; "play" the ride (the
//                    world, the car, the HUD, the aim, the lens, the dark); "crash", or "clear" when
//                    the bonus was lost, the ride frozen under a dark red fade (the game draws the
//                    BONUS LOST card after); "clear" with the bonus won, the cleared card (stats,
//                    grade, ride photo, the Lucky Dice cascade). It also takes the ride photo when
//                    the rules ask (round.gallery.photoWant).
// - tick(round, k)   each frame: the cascade's sounds through k.tone, once each, tracked in k.fx.
//
// The rules and the state are ghoul-ride.js (round.gallery); the art is the
// ghoul-ride-draw-*.js files. A context with only the basic calls will do: the
// dark mask is skipped without a document, and the helpers guard the rest.

import { CAR_X, H, W, bindG, G, clamp, vrand } from "./ghoul-ride-core.js";
import { c, bindCtx, setMode, F, rect, poly, rgrad } from "./ghoul-ride-gfx.js";
import { DRAW, drawBarkerFront, drawGiant, drawGiantLate } from "./ghoul-ride-draw-kinds.js";
import { aisle, drawFar, drawNear, drawOver, drawSets } from "./ghoul-ride-draw-sets.js";
import { bindDie, drawDead, drawEnd, drawLens, drawParts, drawTitle, floaters, hud, plaque, plannyCar, reticle } from "./ghoul-ride-draw-hud.js";
import { CARD_FALL_MS, CARD_LEAD_MS, CARD_STEP_MS } from "./ghoul-ride.js";
import { VOICES } from "./ghoul-ride-voices.js";

const DARK_W = 960;
const DARK_H = 540;
// The grade stamp lands this long into the cleared card.
const STAMP_S = 1.4;

// The darkness mask is painted on a canvas of its own (made once, only where there is a document).
let dark = null;
function darkCanvas(ctx) {
  if (dark || !ctx.canvas || typeof document === "undefined") return dark;
  try {
    const cv = document.createElement("canvas");
    cv.width = DARK_W;
    cv.height = DARK_H;
    const dc = cv.getContext("2d");
    if (dc && typeof dc.createRadialGradient === "function") dark = { cv, dc };
  } catch {
    dark = null;
  }
  return dark;
}

// The darkness: the flashlight is the only light.
function paintDark(ctx) {
  const dk = darkCanvas(ctx);
  if (!dk) return;
  const { cv, dc } = dk;
  dc.globalCompositeOperation = "source-over";
  dc.clearRect(0, 0, DARK_W, DARK_H);
  dc.fillStyle = `rgba(1,0,4,${0.985 * G.dark})`;
  dc.fillRect(0, 0, DARK_W, DARK_H);
  dc.globalCompositeOperation = "destination-out";
  const k = DARK_W / W;
  const rx = G.ret.x * k;
  const ry = G.ret.y * k;
  const fl = G.stall.tell > 0 ? 0.75 + vrand(0, 1) * 0.25 : 1;
  const R = (G.ducked ? 40 : 125) * fl;
  let g = dc.createRadialGradient(rx, ry, 8, rx, ry, R);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(0.55, "rgba(0,0,0,0.8)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  dc.fillStyle = g;
  dc.fillRect(0, 0, DARK_W, DARK_H);
  g = dc.createRadialGradient(CAR_X * k, 435, 5, CAR_X * k, 435, 70);
  g.addColorStop(0, "rgba(0,0,0,0.6)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  dc.fillStyle = g;
  dc.fillRect(0, 0, DARK_W, DARK_H);
  if (typeof c.drawImage === "function") c.drawImage(cv, 0, 0, W, H);
}

// The view of the frame being drawn, for the photo.
let view = null;

// The ride, one frame (the prototype's render): the world, the car, the HUD.
// `mode` is "ride", "dead" (frozen under the crash) or "end" (under the cleared card).
function render(mode) {
  setMode(mode);
  c.save();
  if (G.shake > 0) c.translate(vrand(-1, 1) * G.shake * 0.7, vrand(-1, 1) * G.shake * 0.5);
  c.save();
  c.beginPath();
  c.rect(-2, -2, W + 4, 52.5);
  c.clip();
  if (G.tilt) {
    c.translate(CAR_X, 47);
    c.rotate(G.tilt);
    c.translate(-CAR_X, -47);
  }
  drawFar();
  drawGiant();
  aisle();
  drawSets(false);
  for (const e of G.ents) if (!e.rel && DRAW[e.k] && !e.late) DRAW[e.k](e);
  drawSets(true);
  const bossE = G.boss && G.boss.alive;
  c.save();
  if (G.tilt) {
    c.translate(CAR_X, 47);
    c.rotate(-G.tilt);
    c.translate(-CAR_X, -47);
  }
  plannyCar();
  c.restore();
  for (const e of G.ents) if (e.rel && DRAW[e.k] && !e.late) DRAW[e.k](e);
  if (bossE) {
    const bx = CAR_X + (G.boss.x - G.p);
    if (bx > -30 && bx < W + 30 && G.p > G.boss.x - 40) drawBarkerFront(G.boss, bx);
  }
  drawParts();
  drawNear();
  if (G.tint > 0.01) {
    F(`rgba(30,0,6,${G.tint})`);
    rect(-20, -20, W + 40, 90);
  }
  drawOver();
  if (G.dark > 0.01) {
    paintDark(c);
    if (!G.ducked && mode === "ride") {
      c.save();
      c.globalAlpha = 0.16;
      F("#fff3c0");
      poly([[CAR_X + 4, 39.4], [G.ret.x - 6 * ((G.ret.y - 39) / 12 > 0 ? 0 : 1), G.ret.y - 5], [G.ret.x + 6, G.ret.y + 5]]);
      c.fill();
      c.restore();
    }
  }
  for (const e of G.ents) if (e.late && DRAW[e.k]) DRAW[e.k](e);
  drawGiantLate();
  c.restore();
  // The ride photo, of the scene just painted: before the lens, its own flash and the HUD go over it.
  if (G.photoWant) takePhoto(c, view);
  drawLens();
  if (G.flash > 0) {
    c.globalAlpha = Math.min(1, G.flash);
    F(G.flashCol);
    rect(0, 0, W, H);
    c.globalAlpha = 1;
  }
  // Vignette and the low health pulse.
  const vg = rgrad(48, 27, 22, 48, 27, 62);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, G.hp <= 1 ? `rgba(80,0,8,${0.55 + 0.2 * Math.sin(G.clock * 7)})` : "rgba(0,0,0,0.62)");
  c.fillStyle = vg;
  rect(0, 0, W, H);
  c.restore();
  floaters();
  if (mode !== "end") {
    hud();
    if (mode === "ride") plaque();
    reticle();
  }
}

// The ride photo: the frame around the car, from the canvas as it stands. Only render() may
// call it: until then this frame's canvas holds nothing but the board color.
function takePhoto(ctx, v) {
  G.photoWant = false;
  G.photo = null;
  try {
    const cv = ctx.canvas;
    if (!cv || typeof document === "undefined") return;
    const k = cv.width / v.g.W;
    const pc = document.createElement("canvas");
    pc.width = 360;
    pc.height = 300;
    pc.getContext("2d").drawImage(cv, (CAR_X - 14) * k, (v.g.HUD_H + 21) * k, 33 * k, 27.5 * k, 0, 0, 360, 300);
    G.photo = pc;
  } catch {
    G.photo = null;
  }
}

export function rideArt(d, die) {
  bindDie(die);

  function field(ctx, v) {
    const round = v.round;
    const g = round.gallery;
    if (!g) return;
    bindCtx(ctx);
    bindG(g);
    view = v;
    const phase = round.phase;
    const b = round.bonusRound;
    const won = !!(b && b.won);
    if (phase === "ready") {
      setMode("title");
      drawTitle((round.phaseMs || 0) / 1000);
    } else if (phase === "crash" || (phase === "clear" && !won)) {
      render("dead");
      drawDead(phase === "crash" ? clamp((v.g.CRASH_MS - (round.phaseMs || 0)) / 600, 0, 1) : 1);
    } else if (phase === "clear") {
      render("end");
      drawEnd(Math.max(0, (b.cardMs - round.phaseMs) / 1000), b.dice);
    } else {
      render(G.mode === "end" ? "end" : "ride");
    }
    setMode("ride");
  }

  // The result card's sounds, each once, through the picked voices (ghoul-ride-voices.js): the card itself
  // when it appears (the lost card's own sound when the bonus is lost), then for each die a ping rising as it
  // lands with the counter's tick, the stab when the grade stamps and the fan when the count finishes.
  function tick(round, k) {
    const b = round.bonusRound;
    const V = VOICES.ride;
    if (b && b.over && !b.won && round.phase === "clear") {
      if (!k.fx.rideLost) {
        k.fx.rideLost = true;
        k.tone(V.endLost, 0.45, 1);
      }
      return;
    }
    k.fx.rideLost = false;
    if (!b || !b.over || !b.won || round.phase !== "clear") return;
    const T = (b.cardMs - round.phaseMs) / 1000;
    let fx = k.fx.rideCard;
    if (!fx || T < fx.T) {
      fx = k.fx.rideCard = { T, popped: 0, landed: 0, stab: false, fan: false };
      k.tone(V.endCard, 0.4, 1);
    }
    fx.T = T;
    const d0 = CARD_LEAD_MS / 1000;
    const gap = CARD_STEP_MS / 1000;
    const fall = CARD_FALL_MS / 1000;
    const n = b.dice;
    const popped = Math.min(n, Math.max(0, Math.floor((T - d0) / gap) + 1));
    const landed = Math.min(n, Math.max(0, Math.floor((T - d0 - fall) / gap) + 1));
    fx.popped = popped; // a die leaving the photo is silent: the counter ticks as each one lands
    while (fx.landed < landed) {
      k.tone(V.diceLand, 0.3, 0.9 + 0.08 * fx.landed);
      k.tone(V.endCount, 0.25, 0.9 + 0.08 * fx.landed);
      fx.landed++;
    }
    if (!fx.stab && T > STAMP_S) {
      fx.stab = true;
      k.tone(V.stab, 0.3, 1);
    }
    if (!fx.fan && n > 0 && T > d0 + (n - 1) * gap + fall) {
      fx.fan = true;
      k.tone(V.fan, 0.35, 1);
    }
  }

  return { field, tick };
}
