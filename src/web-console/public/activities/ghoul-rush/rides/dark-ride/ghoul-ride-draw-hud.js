// Plan2Code Web Console - Ghoul Rush's dark ride, the car and the screen around it: Planny in his car, blood and sparks, the lens, the hearts, the progress bar, the room plaque, the aim, the title and the cleared card.
//
// A port of the prototype's car, HUD and screens (prototypes/ghoul-rush-ride/gallery.html).
// The rules are in ghoul-ride.js; this file only draws what they leave in the
// state. Holds:
//
// - plannyCar, drawParts, drawLens   the car with Planny in it, particles, blood on the lens
// - hud, plaque, reticle, floaters, bossBar (inside hud)   the strips and the aim
// - drawTitle(t)        the ready screen: title, controls, the mouse tip, the prompt to start (t in seconds)
// - drawEnd(T, n)       the cleared card at T seconds into it: stats, grade stamp, ride photo and
//                       the cascade of n Lucky Dice with the "LUCKY DICE x N" counter (timing from ghoul-ride.js)
// - drawDead(u)         the dark red fade of a lost ride (u 0 to 1); the BONUS LOST card is the game's own
// - bindDie(die)        the game's Lucky die drawing, `die(ctx, x, y, size, face, angle, ink)`

import { W, H, CAR_X, FLOOR, DUCK_Y, TAU, MAXHP, clamp, lerp, ease, hash, G } from "./ghoul-ride-core.js";
import { SCENES, END_P, BOSS_SCENES } from "./ghoul-ride-scenes.js";
import { c, MODE, setMode, F, S, rr, circ, ell, ln, poly, rect, star, txt, grad, glow, dash } from "./ghoul-ride-gfx.js";
import { CARD_FALL_MS, CARD_LEAD_MS, CARD_STEP_MS, miniHp, overTarget } from "./ghoul-ride.js";
import { FAR } from "./ghoul-ride-draw-sets.js";

// The die the game draws (ghoul-draw.js hands it to rideArt).
let DIE = null;
export const bindDie = (die) => {
  DIE = die;
};
function drawDie(x, y, s, face, angle = 0, ink = "#1d1a17") {
  if (DIE) DIE(c, x, y, s, face, angle, ink);
}

export function plannyCar() {
  const duck = G.ducked, hit = G.hurtT > 0, dead = MODE === "dead";
  const jolt = G.jolt > 0 ? Math.sin(G.clock * 60) * 0.25 : Math.sin(G.p * 2.4) * 0.07 * Math.min(1, G.v / 6);
  c.save(); c.translate(CAR_X + (dead ? 0 : jolt), (G.v > 1 ? Math.sin(G.clock * 33) * 0.06 : 0));
  // wheels
  for (const dx of [-3.6, 3.6]) { F("#14161c"); circ(dx, FLOOR - 0.4, 1.35); c.fill(); S("#4a4e5a", 0.18); circ(dx, FLOOR - 0.4, 0.8); c.stroke(); S("#8a8e9a", 0.14); const a = G.wheel; ln(dx, FLOOR - 0.4, dx + Math.cos(a) * 0.8, FLOOR - 0.4 + Math.sin(a) * 0.8); }
  // Planny first (he is in the car), then the car body in front of his lower half
  const S2 = 2.2, bx = 0.2, bottom = FLOOR - 3.6 + (duck ? 2.7 : 0) + (dead ? 3 : 0);
  const face = G.ret.x < CAR_X - 1 ? -1 : 1;
  const ax = G.ret.x - CAR_X, ay = G.ret.y - (bottom - S2 * 1.4);
  let ang = Math.atan2(ay, ax * face); ang = clamp(ang, -1.25, 1.1);
  const ink = "#1d1a17";
  const top = bottom - S2 * 2;
  // free arm behind
  S(ink, 0.42); ln(bx - face * S2, top + S2 * 0.8, bx - face * (S2 + 0.5), top + S2 * (duck ? -0.2 : 1.1));
  // box
  rr(bx - S2, top, S2 * 2, S2 * 2, S2 * 0.32); F(hit ? "#ffe0e0" : "#ffffff"); c.fill(); S(ink, 0.26); c.stroke();
  star(bx + face * 0.25, top + S2 * 0.78, S2 * 0.58, S2 * 0.25, hit ? G.clock * 18 : 0); F("#3b8cff"); c.fill();
  S(ink, 0.2); c.beginPath();
  if (hit || dead) c.arc(bx + face * 0.25, top + S2 * 1.55, S2 * (dead ? 0.3 : 0.2), 0, TAU); else if (duck) c.arc(bx + face * 0.25, top + S2 * 1.5, S2 * 0.18, 0, TAU); else c.arc(bx + face * 0.25, top + S2 * 1.38, S2 * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  if (G.stall.st === 2 || duck) { F("rgba(120,200,255,0.8)"); const sw = Math.sin(G.clock * 3) * 0.2; poly([[bx + face * (S2 + 0.1), top + 0.4], [bx + face * (S2 + 0.5), top + 1.2], [bx + face * (S2 - 0.3), top + 1.2]]); c.fill(); }
  // blaster arm toward the reticle
  if (!duck && !dead) {
    c.save(); c.translate(bx + face * S2, top + S2 * 0.7); c.scale(face, 1); c.rotate(ang);
    S(ink, 0.42); ln(0, 0, 1.2, 0); F("#4a4f5a"); rect(0.9, -0.55, 2.2, 1.1); F("#c9ced6"); rect(2.9, -0.8, 0.6, 1.6); F("#2a2e36"); rect(1.1, 0.2, 0.8, 1.1);
    if (G.muzzle > 0) { F("#fff3b0"); poly([[3.5, 0], [5.8, -1.2], [5, 0], [5.8, 1.2]]); c.fill(); glow(4, 0, 4, "rgba(255,240,170,0.8)"); }
    c.restore();
  } else if (duck) { S(ink, 0.42); ln(bx + face * S2, top + S2 * 0.9, bx + face * (S2 - 0.8), top - 0.3); }
  // car body
  c.fillStyle = grad(0, FLOOR - 4.2, 0, FLOOR + 0.2, [[0, "#8a1424"], [1, "#3a0810"]]);
  poly([[-6.2, FLOOR - 3.8], [5, FLOOR - 3.8], [7.4, FLOOR - 2.8], [7.4, FLOOR - 0.2], [-6.4, FLOOR - 0.2], [-6.6, FLOOR - 2.6]]); c.fill();
  S("#14040a", 0.18); c.stroke();
  F("#c9a24a"); rect(-6.4, FLOOR - 3.8, 13.8, 0.45); F("#e8d8a0"); circ(7, FLOOR - 1.8, 0.45); c.fill();
  // skull on the nose
  F("#e8e0c4"); circ(5.4, FLOOR - 2, 1.1); c.fill(); F("#1a0a0a"); circ(5, FLOOR - 2.2, 0.28); c.fill(); circ(5.8, FLOOR - 2.2, 0.28); c.fill();
  // lap bar
  S("#c9ced6", 0.45); ln(bx - 2.4, bottom - 0.5, bx + 4.2, bottom - 0.5); S("#7a0c12", 0.7); ln(bx - 1.6, bottom - 0.5, bx + 3.2, bottom - 0.5);
  c.restore();
}

export function drawParts() {
  for (const p of G.parts) {
    const a = clamp(1 - p.t / p.life, 0, 1); c.globalAlpha = a; F(p.col);
    if (p.sp) rect(p.x - p.s / 2, p.y - p.s / 2, p.s * 1.4, p.s * 0.6); else if (p.ch) { rect(p.x - p.s, p.y - p.s, p.s * 2.2, p.s * 1.6); } else { circ(p.x, p.y, p.s); c.fill(); }
  }
  c.globalAlpha = 1;
}

export function drawLens() {
  for (const l of G.lens) {
    const a = clamp(1 - l.t / 7, 0, 1) * 0.8; c.globalAlpha = a;
    F("#7a0910"); circ(l.x, l.y, l.r); c.fill(); F("#9c0b14"); circ(l.x - l.r * 0.18, l.y - l.r * 0.2, l.r * 0.7); c.fill();
    for (let i = 0; i < 5; i++) { const ang = hash(l.seed + i) * TAU, rr2 = l.r * (0.9 + hash(l.seed + i * 3) * 0.7); circ(l.x + Math.cos(ang) * rr2, l.y + Math.sin(ang) * rr2, l.r * 0.2); c.fill(); }
    const dl = Math.min(l.t * 1.3, l.drip); S("#7a0910", Math.max(0.2, l.r * 0.22)); ln(l.x, l.y, l.x, l.y + dl); F("#7a0910"); circ(l.x, l.y + dl, Math.max(0.25, l.r * 0.16)); c.fill();
  }
  c.globalAlpha = 1;
}

function hearts() {
  for (let i = 0; i < MAXHP; i++) {
    const x = 3.6 + i * 3.1, y = 52.5, full = i < G.hp, beat = G.hp === 1 && full ? 1 + Math.abs(Math.sin(G.clock * 7)) * 0.2 : 1;
    c.save(); c.translate(x, y); c.scale(beat * 0.95, beat * 0.95); F(full ? "#e8283a" : "#2a1418"); circ(-0.55, -0.25, 0.7); c.fill(); circ(0.55, -0.25, 0.7); c.fill(); poly([[-1.2, 0.05], [1.2, 0.05], [0, 1.4]]); c.fill();
    if (full) { F("#ff9aa0"); circ(-0.8, -0.5, 0.2); c.fill(); }
    c.restore();
  }
}

function progressBar() {
  const x0 = 4, x1 = W - 4, y = 50.55, k = (x1 - x0) / END_P;
  F("rgba(255,255,255,0.14)"); rect(x0, y, x1 - x0, 0.4); F("#c4121c"); rect(x0, y, clamp(G.p, 0, END_P) * k, 0.4);
  for (let i = 0; i < SCENES.length; i++) { const s = SCENES[i], bx = x0 + s.a * k, boss = G.ents.concat([]).length >= 0 && BOSS_SCENES[s.id]; F(i < G.zi ? "#ffcf70" : "rgba(255,255,255,0.4)"); rect(bx - 0.08, y - 0.3, 0.16, 1); if (boss) { F(i < G.zi ? "#ffcf70" : "#ff4a3a"); poly([[bx + s.len * k - 0.5, y - 0.9], [bx + s.len * k + 0.1, y - 0.9], [bx + s.len * k - 0.2, y - 0.1]]); c.fill(); } }
  F("#ffe9a0"); rr(x0 + clamp(G.p, 0, END_P) * k - 0.8, y - 0.35, 1.6, 1.1, 0.3); c.fill();
}

export function plaque() {
  const t = G.card.t, T = 1.15; if (t > T || MODE === "end") return;
  const s = SCENES[G.card.z], off = t < 0.2 ? -(1 - ease(t / 0.2)) * 7 : t > T - 0.25 ? -ease((t - (T - 0.25)) / 0.25) * 7 : 0;
  c.save(); c.translate(0, 1.2 + off); const w = 40, x = 48 - w / 2;
  F("rgba(20,6,12,0.82)"); rr(x, 0, w, 5.2, 0.8); c.fill(); S("#c9a24a", 0.22); c.stroke();
  txt(s.name, 48, 2.2, 2.4, "#ffe9a0"); txt("ROOM " + (G.card.z + 1) + " OF " + SCENES.length + "   " + s.tag, 48, 4.3, 0.95, "#c9a24a", "center", "Georgia, serif");
  c.restore();
}

export function hud() {
  F("#050205"); rect(0, 50, W, 4); F("#14080c"); rect(0, 50, W, 0.25);
  hearts(); progressBar();
  const z = SCENES[G.zi], t = G.card.t;
  txt(z.name, 48, 52.2, 1.7, t < 4 ? "#ffcf70" : "#a8844a");
  txt("ROOM " + (G.zi + 1) + " / " + SCENES.length + "   HEARTS " + G.hp, 48, 53.5, 1, "#6a5a48", "center", "'Courier New', monospace");
  txt(String(G.score).padStart(6, "0"), W - 4, 52, 2.4, "#ffe9a0", "right");
  const m = 1 + Math.min(3, Math.floor(G.combo / 5));
  if (G.combo > 1) txt("COMBO " + G.combo + (m > 1 ? "  x" + m : ""), W - 4, 53.6, 1.2, m > 1 ? "#ff9a3a" : "#b89a6a", "right", "'Courier New', monospace");
  const warn = G.duckWarn > 0;
  if (MODE === "ride") {
    c.save(); F(G.ducked ? "rgba(120,0,16,0.42)" : warn ? "rgba(160,0,20,0.34)" : "rgba(50,0,10,0.26)"); rect(0, DUCK_Y, W, 50 - DUCK_Y); S(warn ? "#ff3a30" : "rgba(255,255,255,0.3)", warn ? 0.22 : 0.12); dash([0.8, 0.9]); ln(0, DUCK_Y, W, DUCK_Y); dash([]);
    c.globalAlpha = warn || G.ducked ? 0.95 : G.hint > 0 ? 0.7 : 0.45; for (let i = 0; i < 4; i++) txt(G.ducked ? "DUCKED" : "v  DUCK  v", 8 + i * 26, DUCK_Y + 4.6, 1.6, warn || G.ducked ? "#ff8a70" : "#d8c8c0", "center", "'Courier New', monospace"); c.restore();
    if (warn) { c.save(); c.globalAlpha = 0.6 + 0.4 * Math.sin(G.clock * 30); txt(G.ducked ? "" : "DUCK!", CAR_X + 3, 30, 4.4, "#ff2a20"); c.restore(); }
    if (G.hint > 0 && G.zi === 0 && G.p < 70) { c.save(); c.globalAlpha = Math.min(1, G.hint); txt("ARROWS or MOUSE aim    SPACE or CLICK fire", 48, 46.2, 1.6, "#fff0c0", "center", "'Courier New', monospace"); c.restore(); }
  }
  bossBar();
}

export function reticle() {
  if (MODE !== "ride") return;
  const r = G.ret, over = overTarget();
  c.save();
  if (G.ducked) { S("rgba(255,255,255,0.4)", 0.2); circ(r.x, r.y, 1.2); c.stroke(); c.restore(); return; }
  const col = over ? "#ff3a30" : "#ffffff", p = 1 + Math.sin(G.clock * 14) * (over ? 0.1 : 0.03);
  S(col, 0.22); circ(r.x, r.y, 1.9 * p); c.stroke(); S(col, 0.2);
  ln(r.x - 3.2, r.y, r.x - 1.1, r.y); ln(r.x + 1.1, r.y, r.x + 3.2, r.y); ln(r.x, r.y - 3.2, r.x, r.y - 1.1); ln(r.x, r.y + 1.1, r.x, r.y + 3.2);
  F(col); circ(r.x, r.y, 0.18); c.fill();
  if (G.tracer) { S("rgba(255,240,170,0.8)", 0.14); ln(CAR_X + 4, 40, r.x, r.y); }
  c.restore();
}

export function floaters() { for (const f of G.floats) { c.save(); c.globalAlpha = 1 - f.t / 1.1; txt(f.s, f.x, f.y - f.t * 5, 1.9, "#ffe9a0"); c.restore(); } }

function bossBar() {
  const b = G.ents.find((e) => e.boss && e.alive && !e.dying && (e.k === "mini" ? e.active : e.ph !== "hid" && e.ph !== "rise"));
  if (!b) return;
  const hp = b.k === "mini" ? miniHp(b) : b.hp, mx = b.maxhp, w = 42;
  F("rgba(0,0,0,0.6)"); rr(48 - w / 2 - 1, 1.6, w + 2, 3.4, 0.5); c.fill(); F("#3a0a10"); rect(48 - w / 2, 2.8, w, 1.6); F(hp / mx < 0.35 ? "#ff3a30" : "#d8202c"); rect(48 - w / 2, 2.8, w * clamp(hp / mx, 0, 1), 1.6);
  txt(b.boss, 48, 2.1, 1.3, "#ffe9a0");
}

function aisleTitle(t) {
  c.fillStyle = grad(0, 46, 0, 54, [[0, "#1a0c10"], [1, "#050205"]]); rect(0, 46, W, 8); F("#6a7080"); rect(0, 49.6, W, 0.45);
  c.save(); c.translate(26, 3.4); const sv = { m: MODE, d: G.ducked, h: G.hurtT, r: G.ret }; setMode("title"); G.ducked = false; G.hurtT = 0; G.ret = { x: 40, y: 34 }; plannyCar(); setMode(sv.m); G.ret = sv.r; c.restore();
}

export function drawTitle(t) {
  F("#06030a"); rect(0, 0, W, H); FAR[0](t * 3); c.save(); c.globalAlpha = 0.8; F("#050208"); rect(0, 0, W, H); c.restore();
  aisleTitle(t);
  txt("GHOUL RUSH", 48, 6.6, 7.6, "#c4121c"); txt("GHOUL RUSH", 47.7, 6.3, 7.6, "#ff4a3a");
  txt("BONUS ROUND", 48, 12.6, 3.8, "#ffd24a"); txt("THE HOUSE OF A THOUSAND SCREAMS", 48, 15.8, 1.8, "#d8c8a8", "center", "Georgia, serif");
  txt("5 HEARTS. Lose them all and the bonus is lost.", 48, 19.4, 2.1, "#ff6a5a", "center", "'Courier New', monospace");
  const rows = [["ARROWS", "move the reticle"], ["SPACE", "fire (hold to keep firing)"], ["MOUSE", "Mouse: move to aim, click or hold to fire"], ["AIM LOW", "move the reticle below the line to DUCK"], ["GREEN HEART", "friendly. do not shoot"]];
  rows.forEach((r, i) => { txt(r[0], 36, 22.4 + i * 2.2, 1.6, r[0] === "GREEN HEART" ? "#6aff8a" : "#fff0c0", "right", "'Courier New', monospace"); txt(r[1], 38, 22.4 + i * 2.2, 1.6, "#c8b898", "left", "'Courier New', monospace"); });
  txt("Reach the end alive: 5 to 9 Lucky Dice, then on to the boss", 48, 33.8, 1.7, "#ffe9a0", "center", "Georgia, serif");
  drawDie(12, 33.8, 2.8, 6, -0.2, "#b8860b"); drawDie(84, 33.8, 2.8, 6, 0.2, "#b8860b");
  // The tip, in a lit box so it gets read.
  c.save(); F("rgba(90,60,0,0.85)"); rect(7, 35.6, 82, 5.6); S("#ffd24a", 0.3); c.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3); c.strokeRect(7, 35.6, 82, 5.6); c.restore();
  txt("TIP: USE YOUR MOUSE FOR THE BEST RESULTS", 48, 37.2, 2, "#ffd24a");
  txt("To duck, just move your aim cursor below the dashed line near the bottom", 48, 39.7, 1.65, "#fff6d8");
  c.save(); c.globalAlpha = 0.8 + 0.2 * Math.sin(t * 5); txt("PRESS ANY KEY OR CLICK TO START", 48, 42.6, 2.4, "#ffe9a0"); c.restore();
  for (let i = 0; i < 5; i++) { const ex = 6 + hash(i) * 84, ey = 19 + hash(i + 9) * 16; if (Math.sin(t * 0.8 + i * 3) > 0.55) { for (const d of [-1, 1]) { glow(ex + d * 1.1, ey, 2.4, "rgba(255,40,30,0.6)"); F("#ff5a30"); ell(ex + d * 1.1, ey, 0.55, 0.32); c.fill(); } } }
  txt("keyboard or mouse  |  headphones recommended", 48, 53.2, 1.3, "#6a5a48", "center", "'Courier New', monospace");
}

export function drawEnd(T, n) {
  const u = clamp(T / 0.7, 0, 1);
  c.save(); c.globalAlpha = u * 0.72; F("#050208"); rect(0, 0, W, H); c.restore();
  txt("BONUS CLEARED", 48, 4.4, 4.6, "#ffcf70"); txt("on to the boss", 48, 8.4, 1.8, "#d8c8a8", "center", "Georgia, serif");
  c.save(); c.translate(19, 17.6); c.rotate(-0.07); F("rgba(0,0,0,0.5)"); rect(-13.4, -14.2, 28, 31); F("#f2ece0"); rect(-14, -14.8, 28, 31);
  if (G.photo && typeof c.drawImage === "function") c.drawImage(G.photo, -12.5, -13.2, 25, 20.8); else { F("#14041a"); rect(-12.5, -13.2, 25, 20.8); }
  S("#c4121c", 0.25); c.strokeRect(-12.5, -13.2, 25, 20.8); txt("RIDE PHOTO #1", 0, 9.6, 1.2, "#3a2a22", "center", "'Courier New', monospace"); txt("smile!", 0, 13.2, 1.9, "#8a0f16", "center", "Georgia, serif"); c.restore();
  const acc = G.shots ? Math.round(100 * G.hits / G.shots) : 0, kr = G.kills + G.missed > 0 ? Math.round(100 * G.kills / (G.kills + G.missed)) : 0;
  const rows = [["SCORE", G.score, true], ["ACCURACY", acc + "%", acc >= 55], ["KILL RATE", kr + "%", kr >= 75], ["HEARTS LEFT", G.hp + " / " + MAXHP, G.hp >= 3], ["CLOSE CALLS", G.ducksOK, G.ducksOK >= 3], ["BEST STREAK", G.best, G.best >= 15]];
  rows.forEach((r, i) => { const a = clamp((T - 0.4 - i * 0.14) / 0.15, 0, 1); if (a <= 0) return; c.save(); c.globalAlpha = a; txt(r[0], 40, 12.4 + i * 3.6, 1.6, "#c8b898", "left", "'Courier New', monospace"); txt(String(r[1]), 84, 12.4 + i * 3.6, 2.2, "#ffe9a0", "right"); if (r[2] && i > 0) txt("*", 86.6, 12.4 + i * 3.6, 2, "#6aff8a"); c.restore(); });
  const gt = 1.4;
  if (T > gt) { const pop = Math.min(1, (T - gt) * 3); c.save(); c.translate(90, 17); c.rotate(-0.12); c.scale(1 + (1 - pop) * 2, 1 + (1 - pop) * 2); c.globalAlpha = pop; S("#c4121c", 0.4); circ(0, 0, 5); c.stroke(); txt(G.grade, 0, 0.5, 7.6, "#ff2a30"); c.restore(); }
  // the Lucky Dice cascade: dice pop out of the ride photo in an arc, land in the tray with a gold burst and a rising ping; a counter climbs
  const d0 = CARD_LEAD_MS / 1000, gap = CARD_STEP_MS / 1000, fall = CARD_FALL_MS / 1000;
  F("rgba(0,0,0,0.55)"); rr(4, 36, 88, 9, 1.2); c.fill(); S(T > d0 + n * gap + fall ? "#ffd24a" : "rgba(255,255,255,0.25)", 0.25); c.stroke();
  let landed = 0, lastLand = -9;
  for (let i = 0; i < 9; i++) {
    const sx0 = 11.4 + i * 9.4, sy0 = 40.5, t0 = d0 + i * gap;
    F("rgba(255,255,255,0.07)"); rr(sx0 - 3.6, sy0 - 3.6, 7.2, 7.2, 1); c.fill(); S("rgba(255,255,255,0.16)", 0.12); dash([0.5, 0.5]); c.stroke(); dash([]);
    if (i < n && T > t0) {
      const k = T - t0;
      if (k < fall) { const q = k / fall, ex = (1 - q) * (1 - q), y = lerp(22, sy0, q * q) - Math.sin(q * Math.PI) * 15, face = 1 + (Math.floor(k * 26) + i * 3) % 6; drawDie(lerp(24, sx0, q), y, 5.6 + 2.2 * Math.sin(q * Math.PI), face, (1 - q) * 11 * (i % 2 ? -1 : 1)); }
      else {
        landed++; lastLand = Math.max(lastLand, k - fall);
        const b = Math.max(0, 1 - (k - fall) / 0.22); c.save(); c.globalAlpha = 0.25 + 0.15 * Math.sin(T * 6 + i); glow(sx0, sy0, 7, "rgba(255,210,70,0.8)"); c.restore();
        drawDie(sx0, sy0 - Math.sin(b * 3) * b * 1.2, 5.6 * (1 + 0.14 * b), 6, 0, "#b8860b");
        const sp = k - fall; if (sp < 0.7) { c.save(); for (let q = 0; q < 9; q++) { const a = q * 0.698 + i, r = sp * 13 * (0.6 + 0.4 * ((q * 7) % 3) / 2); c.globalAlpha = 1 - sp / 0.7; F(q % 2 ? "#ffd24a" : "#fff7c0"); star(sx0 + Math.cos(a) * r, sy0 + Math.sin(a) * r * 0.9 - sp * 4, 0.55, 0.22, a); c.fill(); } c.restore(); }
      }
    }
  }
  const tAll = d0 + (n - 1) * gap + fall;
  if (T > d0 + 0.3) {
    const pulse = Math.max(0, 1 - lastLand / 0.18), fin = T > tAll, big = fin ? 1.2 + 0.18 * Math.max(0, 1 - (T - tAll) / 0.5) : 1;
    c.save(); c.translate(48, 48.4); c.scale(big + 0.18 * pulse, big + 0.18 * pulse);
    if (fin) { c.save(); c.globalAlpha = 0.35 + 0.15 * Math.sin(T * 7); glow(0, 0, 22, "rgba(255,210,70,0.85)"); c.restore(); }
    txt("LUCKY DICE x " + landed, 0, 0, 3.8, fin ? "#ffd24a" : "#f4e8c0"); c.restore();
    if (fin) { c.save(); c.globalAlpha = clamp((T - tAll) / 0.4, 0, 1); txt(G.reason, 48, 51.6, 1.2, "#e8e0c8", "center", "Georgia, serif"); c.restore(); }
  }
}

// What the crash leaves over the frozen ride: the screen going dark red (the game draws its own BONUS LOST card after).
export function drawDead(u) {
  c.save();
  c.globalAlpha = clamp(u, 0, 1) * 0.78;
  F("#12000a");
  rect(0, 0, W, H);
  c.restore();
}
