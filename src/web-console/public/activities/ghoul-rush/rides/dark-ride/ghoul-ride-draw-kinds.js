// Plan2Code Web Console - Ghoul Rush's dark ride, the things in it: every figure, beast, lantern, blade, door, hand, head, mirror, web and boss, drawn.
//
// A port of the prototype's draw code (prototypes/ghoul-rush-ride/gallery.html),
// the rules (when a thing wakes, lunges or dies) left to ghoul-ride.js. Holds:
//
// - DRAW            { pop, lant, axe, chand, door, hand, head, eyes, boss, inno, mir, web, mini }, each (e) => void,
//                   drawing one entity the way the rules left it (its fields are the prototype's mk* fields)
// - drawBarkerFront (e, x) the teeth drawn over the car as it rides into the Barker's mouth
// - figure, beast   the humanoid and the four-legged animatronics, called with the prototype's `o`
// - flames, portrait   small pieces the sets also use
// - drawGiant, drawGiantLate   the giant in the Dark (before and after the flashlight)
//
// Reads the bound state G (ghoul-ride-core.js) and draws with the bound context
// (ghoul-ride-gfx.js). Visual jitter uses vrand, never the rules' stream.

import { W, CAR_X, STAGE, TAU, clamp, lerp, ease, G, X, sx, vrand } from "./ghoul-ride-core.js";
import { c, F, S, rr, circ, ell, ln, poly, rect, grad, glow, lgrad, BLOOD } from "./ghoul-ride-gfx.js";

// The scale and the build of each pop kind (the rules' POPS table, drawing columns only).
const POP_S = {
  ghoul: { s: 0.95 },
  skeleton: { s: 0.95 },
  butcher: { s: 1.05 },
  corpse: { s: 0.95 },
  host: { s: 1.05 },
  headless: { s: 1 },
  wax: { s: 0.95 },
  hood: { s: 1.2 },
  clown: { s: 0.95 },
  hound: { s: 1, beast: true },
  horse: { s: 1, beast: true },
  spiderling: { s: 0.85, beast: true },
  bat: { s: 0.9, beast: true },
  mourner: { s: 0.95 },
  patient: { s: 0.95 },
  bride: { s: 1.25 },
};

const LOOK = {
  ghoul: { skin: "#7f9470", cloth: "#3b2a35", eye: "#d6ff4a" }, skeleton: { skin: "#e0d8bc", cloth: "#2a2630", eye: "#8dff4a" },
  butcher: { skin: "#b99484", cloth: "#4a3a2a", eye: "#ffcf40" }, corpse: { skin: "#8f9c98", cloth: "#22222e", eye: "#e8e0b0" },
  host: { skin: "#b0ac96", cloth: "#14141c", eye: "#ff4a3a" }, headless: { skin: "#8a7a70", cloth: "#5a2a2a", eye: "#fff" },
  wax: { skin: "#e9dcc0", cloth: "#6a3a5a", eye: "#fff" }, hood: { skin: "#2a2226", cloth: "#1a1418", eye: "#ff3a20" }, clown: { skin: "#f0e8e0", cloth: "#c43030", eye: "#ffe040" },
  mourner: { skin: "#9aa090", cloth: "#1a1a22", eye: "#e0e0b0" }, patient: { skin: "#a8b0a0", cloth: "#6a8aa0", eye: "#e8f0a0" }, bride: { skin: "#c8c8c0", cloth: "#e8e8e0", eye: "#ff2020" }
};

export function figure(o) {
  const L = LOOK[o.t], hs = o.hurt, skin = hs ? "#fff0ea" : L.skin, cl = hs ? "#ffd0c8" : L.cloth, sk = o.t === "skeleton";
  c.save(); c.translate(o.x + (o.jit ? vrand(-o.jit, o.jit) : 0), o.y + (o.jit ? vrand(-o.jit, o.jit) : 0)); c.scale(o.s, o.s);
  const bob = Math.sin(o.a * 5) * 0.12;
  // legs
  F(cl); rr(-1.7, -4.5, 1.4, 4.5, 0.3); c.fill(); rr(0.3, -4.5, 1.4, 4.5, 0.3); c.fill();
  F("#15101a"); ell(-1.1, -0.2, 1, 0.4); c.fill(); ell(1.1, -0.2, 1, 0.4); c.fill();
  if (sk) { S(skin, 0.45); ln(-1, -4.5, -1, -0.5); ln(1, -4.5, 1, -0.5); }
  // torso
  F(cl); poly([[-2, -8.2], [2, -8.2], [1.6, -4.3], [-1.6, -4.3]]); c.fill();
  if (sk) { F("#0a0810"); poly([[-1.6, -8], [1.6, -8], [1.3, -4.6], [-1.3, -4.6]]); c.fill(); S(skin, 0.28); for (let i = 0; i < 4; i++) ln(-1.4, -7.6 + i * 0.8, 1.4, -7.6 + i * 0.8); ln(0, -8, 0, -4.6); }
  else {
    if (o.t === "butcher") { F(hs ? "#fff" : "#d9d2c4"); poly([[-1.7, -7.8], [1.7, -7.8], [2, -3.2], [-2, -3.2]]); c.fill(); F("#8a0f16"); poly([[-1.7, -6], [1.8, -6.8], [2, -3.2], [-2, -3.2], [-1.2, -4.5]]); c.fill(); ell(0.4, -7, 0.7, 0.5); c.fill(); }
    else if (o.t === "host") { F("#e8e4d8"); poly([[-0.8, -8.2], [0.8, -8.2], [0.5, -5], [-0.5, -5]]); c.fill(); F("#a01820"); poly([[0, -8], [-0.7, -7.2], [0.7, -7.2]]); c.fill(); }
    else if (o.t === "corpse") { F("#e0dccc"); poly([[-0.8, -8.2], [0.8, -8.2], [0.5, -5], [-0.5, -5]]); c.fill(); }
    F("#7a0c12"); ell(-0.6, -6.3, 0.8, 1.1); c.fill(); ell(0.9, -5, 0.4, 0.7); c.fill();
    S("#2a1418", 0.14); ln(-1.2, -7, -0.2, -5.4); ln(0.3, -7.4, 1, -5.6);
  }
  // arms (reach at the car as arm -> 1)
  const ar = o.arm || 0, sw = Math.sin(o.a * 4) * 0.4;
  for (const side of [-1, 1]) {
    const hx = side * lerp(2.7, 3.4, ar), hy = lerp(-4.6, -11.2, ar) + sw * (side > 0 ? 1 : -1) * ar * 0.6;
    S(sk ? skin : cl, 0.95); ln(side * 1.9, -7.6, side * (1.9 + (hx - side * 1.9) * 0.5), (-7.6 + hy) / 2 + 0.5);
    S(skin, 0.8); ln(side * (1.9 + (hx - side * 1.9) * 0.5), (-7.6 + hy) / 2 + 0.5, hx, hy);
    F(skin); circ(hx, hy, 0.62); c.fill();
    if (ar > 0.5) { S(skin, 0.22); for (let f = -1; f <= 1; f++) ln(hx, hy, hx + f * 0.5, hy - 0.9); }
    if ((o.t === "butcher" || o.t === "hood") && side > 0) { c.save(); c.translate(hx, hy); c.rotate(o.cleaver ?? -1.5); if (o.t === "hood") c.scale(1.5, 1.5); S("#5a3a1c", 0.4); ln(0, 0, 0, -1.8); F(hs ? "#fff" : "#b8c0cc"); poly([[-0.4, -1.6], [2.4, -2.2], [2.4, -4.4], [-0.4, -4.2]]); c.fill(); F("#8a0f16"); poly([[0.6, -2.6], [2.4, -2.8], [2.4, -4.4], [1.4, -4.3]]); c.fill(); c.restore(); }
  }
  // head
  c.save(); c.translate(0, -9.6 + bob); if (o.spin) c.rotate(o.spin); else c.rotate(o.tilt ? o.tilt : Math.sin(o.a * 1.7) * 0.07);
  if (o.t === "headless") {
    F("#7a0c12"); ell(0, 1.4, 0.9, 0.5); c.fill(); F(skin); rect(-0.6, 0.6, 1.2, 0.9);
    for (let i = 0; i < 5; i++) { S(BLOOD[i % 4], 0.22); ln(0, 1, (i - 2) * 0.5, -1.2 - Math.abs(Math.sin(G.clock * 9 + i)) * 2.2); }
  } else {
    F(skin); ell(0, 0, 1.55, 1.75); c.fill();
    if (o.t === "ghoul") { F("#1e1618"); for (let i = -2; i <= 2; i++) poly([[i * 0.6 - 0.35, -1.5], [i * 0.6, -2.6 - (i % 2) * 0.4], [i * 0.6 + 0.35, -1.5]]), c.fill(); F("#6a8a5a"); circ(-1.5, 0.2, 0.3); c.fill(); }
    if (o.t === "butcher") { F("#d9d2c4"); rr(-1.8, -2.2, 3.6, 1.1, 0.4); c.fill(); F("#8a0f16"); rect(-1.8, -1.4, 3.6, 0.3); S("#2a1418", 0.12); ln(-1.2, -0.2, 0.2, 0.3); }
    if (o.t === "host") { F("#14141c"); rr(-1.1, -4.4, 2.2, 2.6, 0.2); c.fill(); rect(-2.1, -2, 4.2, 0.45); F("#a01820"); rect(-1.1, -2.4, 2.2, 0.4); }
    if (o.t === "corpse") { F("#3a2a3a"); ell(0, -1.2, 1.6, 0.8); c.fill(); F("#c9b8a0"); }
    const eye = o.slumpy ? "#1a1010" : L.eye;
    F("#120709"); circ(-0.65, -0.2, sk ? 0.55 : 0.48); c.fill(); circ(0.65, -0.2, sk ? 0.55 : 0.48); c.fill();
    F(eye); circ(-0.65, -0.2, 0.22); c.fill(); circ(0.65, -0.2, 0.22); c.fill();
    if (!o.slumpy && !hs) { c.globalAlpha *= 0.5; glow(-0.65, -0.2, 1.3, "rgba(230,255,90,0.5)"); glow(0.65, -0.2, 1.3, "rgba(230,255,90,0.5)"); c.globalAlpha *= 2; }
    F("#1a0a0c"); poly([[0, 0.3], [-0.25, 0.9], [0.25, 0.9]]); c.fill();
    const op = o.open || 0; F("#2a0508"); ell(0, 1.2, 0.8, 0.22 + op * 0.5); c.fill();
    F("#ece6d0"); for (let i = -2; i <= 2; i++) { rect(i * 0.28 - 0.1, 1.0 - op * 0.12, 0.2, 0.34); if (op > 0.3) rect(i * 0.28 - 0.1, 1.2 + op * 0.4, 0.2, 0.3); }
    if (!sk) { F("#a00e16"); rect(-0.5, 1.5 + op * 0.5, 0.35, 1.3 + (o.t === "butcher" ? 0.6 : 0)); rect(0.3, 1.4 + op * 0.5, 0.25, 0.8); }
  }
  c.restore(); figureExtras(o, hs, bob); c.restore();
}

export function flames(x, y, s) {
  for (let i = 0; i < 5; i++) { const fx = x + (i - 2) * 0.9 * s, h = (1.6 + Math.sin(G.clock * 14 + i * 2 + x) * 0.7) * s; F(i % 2 ? "#ff8a20" : "#ffcf40"); c.beginPath(); c.moveTo(fx - 0.5 * s, y); c.quadraticCurveTo(fx - 0.3 * s, y - h * 0.6, fx, y - h); c.quadraticCurveTo(fx + 0.3 * s, y - h * 0.6, fx + 0.5 * s, y); c.fill(); }
  glow(x, y - 1, 4 * s, "rgba(255,140,30,0.5)");
}

function figureExtras(o, hs, bob) {
  const t = o.t;
  if (o.wax || t === "wax") { c.save(); c.globalAlpha = 0.4; F("#fff"); ell(-0.6, -10 + bob, 0.45, 0.9); c.fill(); ell(-1.7, -7, 0.4, 1.4); c.fill(); c.restore(); }
  if (o.melt) { S("rgba(244,232,196,0.95)", 0.35); for (let i = -1; i <= 1; i++) { const l = 1.4 + Math.abs(Math.sin(G.clock * 3 + i * 2)) * 1.8; ln(i * 0.8, -9.2 + bob, i * 0.8, -9.2 + bob + l); } F("#f4ecd0"); ell(0, -6.2, 0.9, 0.4); c.fill(); }
  if (t === "hood") {
    F("#14101a"); c.beginPath(); c.moveTo(-1.95, -8 + bob); c.quadraticCurveTo(-2.3, -12.8 + bob, 0, -13.2 + bob); c.quadraticCurveTo(2.3, -12.8 + bob, 1.95, -8 + bob); c.lineTo(1.1, -7.3); c.lineTo(-1.1, -7.3); c.closePath(); c.fill();
    F("#050308"); rect(-1.25, -10.2 + bob, 2.5, 1.0); F("#ff4a20"); circ(-0.6, -9.7 + bob, 0.28); c.fill(); circ(0.6, -9.7 + bob, 0.28); c.fill(); glow(0, -9.7 + bob, 2.6, "rgba(255,60,20,0.5)");
    F("#33333a"); for (const sd of [-1, 1]) { ell(sd * 2.2, -7.9, 1, 0.55); c.fill(); poly([[sd * 2.0, -8.4], [sd * 2.4, -9.8], [sd * 2.8, -8.3]]); c.fill(); }
  }
  if (t === "bride") {
    F(hs ? "#fff" : "#ecebe2"); poly([[-1.8, -4.4], [1.8, -4.4], [4.8, 0.1], [-4.8, 0.1]]); c.fill(); F("#8a0f16"); ell(-1.2, -1.8, 1.2, 1.7); c.fill(); ell(2.2, -0.8, 0.8, 1.1); c.fill(); S("#8a0f16", 0.2); ln(0.5, -4, 0.8, -0.5);
    c.save(); c.globalAlpha = 0.55; F("#f4f4f0"); poly([[-1.9, -12 + bob], [1.9, -12 + bob], [3.9, -4], [-3.9, -4]]); c.fill(); c.restore();
    F("#c9a24a"); rect(-1.2, -11.7 + bob, 2.4, 0.45); for (let i = -1; i <= 1; i++) poly([[i * 0.8 - 0.3, -11.7 + bob], [i * 0.8, -12.6 + bob], [i * 0.8 + 0.3, -11.7 + bob]]), c.fill();
  }
  if (t === "clown") {
    F("#ff7a1a"); circ(-1.9, -10.2 + bob, 0.95); c.fill(); circ(1.9, -10.2 + bob, 0.95); c.fill(); circ(-1.3, -11.4 + bob, 0.8); c.fill(); circ(1.3, -11.4 + bob, 0.8); c.fill(); F("#e0182a"); circ(0, -9.4 + bob, 0.55); c.fill();
    if (o.burn) { flames(0, -11.4 + bob, 0.9); flames(-2, -7.4, 0.8); flames(2, -7.4, 0.8); flames(0, -4.4, 1); }
  }
  if (t === "mourner") { F("#0a0a10"); rect(-2.4, -11.1 + bob, 4.8, 0.45); rr(-1.4, -12.5 + bob, 2.8, 1.5, 0.3); c.fill(); c.save(); c.globalAlpha = 0.5; poly([[-1.5, -11 + bob], [1.5, -11 + bob], [1.7, -8.6 + bob], [-1.7, -8.6 + bob]]); c.fill(); c.restore(); }
  if (t === "patient") { F("#dfeaf0"); poly([[-1.4, -7.8], [1.4, -7.8], [1.6, -5.6], [-1.6, -5.6]]); c.fill(); F("#8fb4d0"); rect(-1.1, -9.1 + bob, 2.2, 0.9); S("#8fb4d0", 0.1); ln(-1.1, -8.6 + bob, -1.8, -8.8 + bob); ln(1.1, -8.6 + bob, 1.8, -8.8 + bob); F("#e8f0f4"); rect(-1.4, -4.6, 2.8, 0.3); }
}

export function beast(o) {
  const hs = o.hurt, a = o.a, t = o.t;
  c.save(); c.translate(o.x, o.y); c.scale(o.s, o.s);
  if (t === "hound") {
    const sk = hs ? "#ffd0d0" : "#1c1416", run = o.arm > 0.5 ? 1 : 0.25, ph = a * 16;
    S(sk, 0.55); for (let i = 0; i < 4; i++) { const lx = (i < 2 ? -2.6 : 2.3) + (i % 2) * 0.9; ln(lx, -3.1, lx + Math.sin(ph + i * 1.6) * 1.5 * run, -0.1); }
    F(sk); ell(0, -3.9, 3.8, 1.7); c.fill(); S("#4a3236", 0.14); for (let i = -2; i <= 2; i++) ln(i * 0.8, -4.9, i * 0.8 - 0.2, -3.2);
    S(sk, 0.42); ln(3.5, -4.3, 5, -5.8 + Math.sin(a * 10) * 0.5);
    F(sk); ell(-4.4, -4.9, 1.8, 1.25); c.fill(); poly([[-5.9, -5.1], [-7.6, -4.5], [-5.9, -4.0]]); c.fill(); poly([[-3.7, -5.8], [-3.2, -7.2], [-4.3, -6.2]]); c.fill();
    F("#7a0c12"); poly([[-5.9, -4.5], [-7.4, -4.1], [-6.0, -3.5]]); c.fill(); F("#f0ead8"); for (let i = 0; i < 3; i++) poly([[-6.0 - i * 0.55, -4.45], [-5.8 - i * 0.55, -3.95], [-6.2 - i * 0.55, -4.0]]), c.fill();
    F("#ff3a20"); circ(-4.7, -5.2, 0.34); c.fill(); glow(-4.7, -5.2, 2, "rgba(255,50,20,0.6)");
    if (o.burn) { flames(0, -5.4, 0.9); flames(-3, -5.8, 0.7); }
  } else if (t === "horse") {
    const body = hs ? "#fff" : "#ece4d4";
    S("#c9a24a", 0.6); ln(0, -17, 0, 0.5); F("#c9a24a"); circ(0, -17, 0.9); c.fill();
    F(body); ell(0, -8.4, 3.7, 1.95); c.fill(); F("#c9a24a"); rr(-1.3, -10.5, 2.6, 1.2, 0.4); c.fill();
    S(body, 0.75); ln(-2.5, -7.6, -3.8, -5.2); ln(-3.8, -5.2, -2.4, -3.7); ln(2.5, -7.6, 3.9, -6); ln(3.9, -6, 3.2, -4.2);
    F(body); poly([[-2.7, -9.4], [-4.8, -12.6], [-5.9, -11.8], [-3.5, -7.8]]); c.fill(); ell(-6, -12, 1.6, 0.95, 0.55); c.fill();
    F("#a0121c"); poly([[-2.9, -9.8], [-4.4, -13.3], [-3.6, -13.4], [-2.2, -10.2]]); c.fill();
    F("#fff"); circ(-6.2, -12.3, 0.5); c.fill(); F("#c00"); circ(-6.3, -12.3, 0.2); c.fill();
    F("#6a0a10"); ell(-7.2, -11.6, 0.5, 0.35); c.fill(); F("#f0ead8"); rect(-7.4, -11.45, 0.9, 0.25);
    F("#8a0f16"); rr(-0.5, -10.2, 1, 5.4, 0.4); c.fill(); S("#8a0f16", 0.2); ln(0.5, -6, 0.6, -2.5);
    F("#b8a070"); rect(-2.5, -6.6, 5, 0.3);
  } else if (t === "spiderling") {
    const sk = hs ? "#fff" : "#1a1216";
    S(sk, 0.28); for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const w = Math.sin(a * 18 + i * 1.3) * 0.5; ln(sd * 0.6, -1.7, sd * (1.8 + i * 0.5) + w, -3 + i * 0.4); ln(sd * (1.8 + i * 0.5) + w, -3 + i * 0.4, sd * (2.8 + i * 0.4), -0.1); }
    F(sk); circ(0, -1.9, 1.35); c.fill(); circ(-1.6, -2, 0.85); c.fill(); F("#ff2a20"); circ(-1.9, -2.3, 0.2); c.fill(); circ(-1.4, -2.4, 0.2); c.fill();
    F("#a02020"); ell(0.4, -2.2, 0.35, 0.5); c.fill();
  } else if (t === "bat") {
    const fl = Math.sin(a * 22) * 1.6;
    F(hs ? "#fff" : "#1a141c"); poly([[-0.5, -5], [-5.2, -5 - fl - 1], [-3.6, -4.2], [-2.2, -3.6], [-1, -3.9]]); c.fill(); poly([[0.5, -5], [5.2, -5 - fl - 1], [3.6, -4.2], [2.2, -3.6], [1, -3.9]]); c.fill();
    F("#2a1e2a"); ell(0, -4.6, 0.95, 1.25); c.fill(); poly([[-0.7, -5.6], [-0.6, -6.6], [-0.1, -5.7]]); c.fill(); poly([[0.7, -5.6], [0.6, -6.6], [0.1, -5.7]]); c.fill();
    F("#ff3a20"); circ(-0.35, -4.9, 0.2); c.fill(); circ(0.35, -4.9, 0.2); c.fill(); F("#f0ead8"); poly([[-0.4, -4], [-0.2, -3.4], [0, -4]]); c.fill(); poly([[0.4, -4], [0.2, -3.4], [0, -4]]); c.fill();
  }
  c.restore();
}

export function portrait(x, y, i) {
  F("#c9a24a"); rr(x - 0.6, y - 0.6, 11.2, 14.2, 0.5); c.fill(); F("#1a0e0a"); rect(x, y, 10, 13);
  F(["#6a5a4a", "#7a8a70", "#8a7a8a"][i & 1 ? 1 : (i % 3 + 3) % 3]); ell(x + 5, y + 5.6, 2.6, 3.2); c.fill();
  F("#2a1a14"); poly([[x + 1, y + 13], [x + 2, y + 9.5], [x + 8, y + 9.5], [x + 9, y + 13]]); c.fill();
  const rx = clamp((G.ret.x - (x + 5)) / 60, -1, 1), ry = clamp((G.ret.y - 8) / 40, -1, 1);
  for (const d of [-1, 1]) { F("#f0f0e0"); ell(x + 5 + d * 1.1, y + 4.8, 0.7, 0.45); c.fill(); F("#a01010"); circ(x + 5 + d * 1.1 + rx * 0.32, y + 4.8 + ry * 0.2, 0.28); c.fill(); }
  S("#8a0f16", 0.15); ln(x + 4.2, y + 8.2, x + 5.8, y + 8.2); ln(x + 6, y + 8.2, x + 6, y + 11 + Math.abs(Math.sin(G.clock + i)));
}

/* ---- the Barker ---- */

function drawBarker(e, x) {
  const dead = e.dead > 0, d = dead ? Math.min(1, e.dead / 1.5) : 0;
  c.save();
  // the great round clown face on a striped tent facade
  F("#2a0e3a"); rect(x - 30, 0, 60, STAGE);
  for (let i = 0; i < 10; i++) { F(i % 2 ? "#4a1a60" : "#1a0828"); rect(x - 30 + i * 6, 0, 3, STAGE); }
  F("#f1ead8"); ell(x, 22 + d * 1.5, 22, 24); c.fill();
  F("#ddd2bc"); ell(x - 6, 17, 14, 16); c.fill();
  // hair
  F("#ff7a1a"); for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { circ(x + s * (17 + (i % 2) * 3), 8 + i * 4.8, 5.5); c.fill(); }
  F("#d85a0a"); for (const s of [-1, 1]) { circ(x + s * 20, 20, 3); c.fill(); }
  // eyebrows and the diamond paint
  S("#101010", 0.7); ln(x - 17, 7, x - 4, 9); ln(x + 17, 7, x + 4, 9);
  F("#14146a"); for (const s of [-1, 1]) { poly([[x + s * 10, 7], [x + s * 15, 16], [x + s * 10, 25], [x + s * 5, 16]]); c.fill(); }
  // eyes
  for (let i = 0; i < 2; i++) {
    const ex = x + (i ? 10 : -10), ey = e.eyes[i], dd = ey.hp <= 0;
    F("#fffbe8"); circ(ex, 16, 5.6); c.fill(); S("#8a0f16", 0.2); for (let k = 0; k < 9; k++) { const a = k * 0.7; ln(ex + Math.cos(a) * 5.4, 16 + Math.sin(a) * 5.4, ex + Math.cos(a) * 3.2, 16 + Math.sin(a) * 3.2); }
    if (!dd) {
      const ax = clamp((G.ret.x - ex) / 40, -1, 1) * 1.7, ay = clamp((G.ret.y - 16) / 30, -1, 1) * 1.4;
      F(ey.hurt > 0 ? "#ff3030" : "#ffd028"); circ(ex + ax, 16 + ay, 2.7); c.fill(); F("#101010"); ell(ex + ax, 16 + ay, 0.55, 2.3); c.fill();
      if (!e.dead) { c.globalAlpha = 0.5 + 0.4 * Math.sin(G.clock * 7 + i); S("#8dff4a", 0.3); circ(ex, 16, 6.4 + Math.sin(G.clock * 7) * 0.3); c.stroke(); S("#fff", 0.12); circ(ex, 16, 5.2); c.stroke(); c.globalAlpha = 1; }
    } else { F("#6a0a10"); circ(ex, 16, 5.3); c.fill(); F("#14040a"); circ(ex + 0.4, 16.4, 3); c.fill(); for (let k = 0; k < 4; k++) { S(BLOOD[k], 0.5); ln(ex - 2 + k * 1.3, 20, ex - 2 + k * 1.3, 24 + ((G.clock * 8 + k * 3) % 7)); } }
  }
  // nose
  F("#e0182a"); circ(x, 25.5, 3.6); c.fill(); F("#ff6a6a"); circ(x - 1, 24.4, 1.1); c.fill();
  // mouth
  const op = e.open, my = 31 + d * 2;
  F("#8a0f16"); ell(x, my + 6, 21, 11 + op * 5); c.fill();
  F("#07020a"); ell(x, my + 6, 18.5, 8.5 + op * 5.5); c.fill();
  c.restore();
}

function barkerFront(e, x) {
  // teeth and lips drawn over the car as it drives into the mouth
  const op = e.open, my = 31, dead = e.dead > 0;
  c.save();
  const x0 = x - 18, x1 = x + 18;
  const jaw = e.dead ? 0 : (x < CAR_X + 12 && !e.bit ? 0 : 0);
  c.beginPath(); c.rect(x0 - 1, 28, x1 - x0 + 2, 22); c.clip();
  F("#f4eedc"); for (let i = 0; i < 9; i++) { const tx = x0 + 2 + i * 4.1; poly([[tx - 1.8, my - 3], [tx + 1.8, my - 3], [tx, my + 8 + (i % 2) * 1.4]]); c.fill(); }
  for (let i = 0; i < 9; i++) { const tx = x0 + 4 + i * 4.1; poly([[tx - 1.8, 53], [tx + 1.8, 53], [tx, 47.6 - op * 0 - (i % 2) * 1.2]]); c.fill(); }
  S("#8a0f16", 0.3); for (let i = 0; i < 9; i++) { const tx = x0 + 2 + i * 4.1; ln(tx, my + 4, tx, my + 8 + (i % 2) * 1.4); }
  c.restore();
}

export const drawBarkerFront = barkerFront;

/* ---- variants ---- */

const LANT_NOCHAIN = { jar: 1, bubble: 1 };

const LANT = {
  tooth(e) {
    F(e.lit ? "#f6f2e4" : "#8f8a7d"); poly([[-1.9, 0.4], [1.9, 0.4], [2.3, 2.6], [1.5, 5], [0.5, 3.3], [0, 5.4], [-0.5, 3.3], [-1.5, 5], [-2.3, 2.6]]); c.fill(); S("#1d1a17", 0.14); c.stroke();
    F("#2a1808"); circ(-0.7, 1.5, 0.5); c.fill(); F("#a0121c"); ell(0, 0.5, 2.4, 0.6); c.fill(); S("#a0121c", 0.14); ln(1, 0.9, 1.2, 2.2);
  },
  jar(e) {
    const sh = e.lit && e.maxLit && e.lt > e.maxLit * 0.6 ? Math.sin(G.clock * 60) * 0.12 : 0; c.translate(sh, 0);
    F("rgba(150,235,190,0.30)"); rr(-2.3, -0.5, 4.6, 6.8, 0.9); c.fill(); S("#bfe6d4", 0.16); c.stroke(); F("#6a5a3a"); rect(-2.5, -1.1, 5, 0.8);
    F("rgba(80,200,120,0.35)"); rect(-2.2, 2.2, 4.4, 3.9);
    F("#c9b49a"); circ(0, 3, 1.15); c.fill(); F("#101010"); circ(-0.4, 2.85, 0.22); c.fill(); circ(0.4, 2.85, 0.22); c.fill(); F("#e8e0d0"); ell(0.2, 4.6, 1.3, 0.6); c.fill();
    if (e.lit && e.maxLit) { const p = e.lt / e.maxLit; S("#fff", 0.1); c.beginPath(); c.moveTo(-1, 0); c.lineTo(0.3, 2); c.lineTo(-0.5, 3.4); if (p > 0.4) { c.moveTo(1.4, 1); c.lineTo(0.4, 3); c.lineTo(1.2, 5); } if (p > 0.7) { c.moveTo(-2, 4); c.lineTo(0, 4.6); c.lineTo(2, 3.8); } c.stroke(); }
  },
  bubble(e) {
    c.translate(0, Math.sin(e.age * 3 + e.sway) * 0.6); F("rgba(200,240,255,0.22)"); circ(0, 2, 2.2); c.fill(); S("rgba(220,250,255,0.85)", 0.14); c.stroke(); F("rgba(255,255,255,0.75)"); ell(-0.7, 1.2, 0.5, 0.3); c.fill();
    F("rgba(120,20,30,0.4)"); circ(0.4, 2.6, 0.6); c.fill();
  }
};

function dropBody(v) {
  if (v === "spike") {
    S("#8a8a94", 0.22); ln(0, 0, 0, 2.2); F("#4a4a54"); circ(0, 4.8, 2.9); c.fill(); S("#2a2a30", 0.14); c.stroke();
    for (let i = 0; i < 10; i++) { const a = i * 0.628; F("#aab"); poly([[Math.cos(a - 0.14) * 2.8, 4.8 + Math.sin(a - 0.14) * 2.8], [Math.cos(a) * 4.8, 4.8 + Math.sin(a) * 4.8], [Math.cos(a + 0.14) * 2.8, 4.8 + Math.sin(a + 0.14) * 2.8]]); c.fill(); }
    F("#8a0f16"); for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.3; circ(Math.cos(a) * 4.1, 4.8 + Math.sin(a) * 4.1, 0.35); c.fill(); }
  } else if (v === "beam") {
    S("#6a5a4a", 0.25); ln(-6, 1.3, 0, -0.5); ln(6, 1.3, 0, -0.5); F("#3a2210"); rect(-6.5, 0.8, 13, 1.8); F("#1a0e06"); rect(-6.5, 2.1, 13, 0.5); flames(-4, 1, 0.9); flames(0, 1, 1.1); flames(4.2, 1, 0.9);
  } else if (v === "lamp") {
    S("#8a9098", 0.28); ln(0, 0, 0, 2); F("#dfe8ee"); ell(0, 3.2, 4.8, 1.7); c.fill(); S("#8a9098", 0.14); c.stroke(); for (let i = -2; i <= 2; i++) { F("#fff7c0"); circ(i * 1.7, 3.5, 0.55); c.fill(); }
    glow(0, 5, 7, "rgba(255,250,200,0.5)"); F("#8a0f16"); ell(-2.6, 3.4, 0.5, 0.3); c.fill();
  }
}

function axeVar(v, live) {
  if (v === "horse") {
    S("#c9a24a", 0.5); ln(0, -3.4, 0, 3.4); F("#ece4d4"); ell(0, 0.6, 3.5, 1.6); c.fill(); F("#ece4d4"); poly([[-2.6, -0.3], [-4.6, -2.5], [-5.4, -1.8], [-3.2, 0.8]]); c.fill(); ell(-5.2, -2.2, 1.3, 0.8, 0.5); c.fill();
    F("#a0121c"); poly([[-2.7, -0.6], [-4, -3], [-3.4, -3], [-2.2, -0.8]]); c.fill(); F("#c00"); circ(-5.4, -2.4, 0.35); c.fill(); S("#ece4d4", 0.5); ln(1.5, 1.6, 2.4, 3.6); ln(-1.5, 1.6, -2.2, 3.4);
    F("#8a0f16"); rr(-0.5, -1.2, 1, 3.5, 0.3); c.fill(); F("#8a0f16"); circ(1, 3.8, 0.3); c.fill();
  } else if (v === "beef") {
    S("#9aa0a8", 0.3); ln(0, -3.6, 0, -1); c.beginPath(); c.arc(0, -4, 0.8, 0, TAU); c.stroke();
    F("#9a2424"); ell(0, 1.6, 2.7, 4.4); c.fill(); F("#b83a3a"); ell(-0.7, 0.6, 1.4, 2.8); c.fill(); S("#e8d8c8", 0.2); ln(-1.2, -1, -0.4, 4.4); ln(1.1, -0.4, 0.7, 4.8); ln(0, -2.2, 0.2, 5);
    F("#e8f0f4"); c.save(); c.globalAlpha = 0.5; ell(0, -1.8, 2, 0.8); c.fill(); ell(1.2, 3.6, 1.2, 0.7); c.fill(); c.restore();
  } else if (v === "hoop") {
    S("#ff8a20", 1.0); circ(0, 0, 3.3); c.stroke(); S("#ffd060", 0.35); circ(0, 0, 3.3); c.stroke();
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + G.clock * 3; flames(Math.cos(a) * 3.3, Math.sin(a) * 3.3 + 1, 0.6); }
  } else if (v === "drill") {
    S("#aab0b8", 0.8); ln(0, -4, 0, 1.4); F("#c9ced6"); poly([[-1.3, 1.4], [1.3, 1.4], [0.3, 5.2], [-0.3, 5.2]]); c.fill(); S("#fff", 0.16); for (let i = 0; i < 3; i++) ln(-0.9, 2 + i * 0.9 + (G.clock * 20 % 0.9), 0.9, 2.4 + i * 0.9 + (G.clock * 20 % 0.9));
    F("#a0121c"); circ(0, 5.4, 0.45); c.fill(); circ(-1.3, 4, 0.25); c.fill(); F("#e8f0f4"); ell(0, -1.4, 1.6, 0.8); c.fill();
  }
  if (live) { c.save(); c.globalAlpha = 0.25 + 0.2 * Math.sin(G.clock * 14); S("#fff", 0.15); circ(0, 0, 4.6); c.stroke(); c.restore(); }
}

const DOORV = {
  maiden(e, x, o) {
    const sh = e.st === "shut" && e.knock > 0 ? Math.sin(G.clock * 90) * 0.2 : 0;
    F("#2a2c34"); poly([[x - 5, STAGE - 25], [x + 5, STAGE - 25], [x + 5.8, STAGE - 14], [x + 4, STAGE], [x - 4, STAGE], [x - 5.8, STAGE - 14]]); c.fill();
    if (o > 0) {
      F("#14040a"); poly([[x - 4.1, STAGE - 24], [x + 4.1, STAGE - 24], [x + 4.8, STAGE - 14], [x + 3.2, STAGE - 1], [x - 3.2, STAGE - 1], [x - 4.8, STAGE - 14]]); c.fill();
      F("#aab0ba"); for (let r = 0; r < 7; r++) for (let q = -1; q <= 1; q++) poly([[x + q * 2.4 - 0.4, STAGE - 22 + r * 3.1], [x + q * 2.4 + 0.4, STAGE - 22 + r * 3.1], [x + q * 2.4, STAGE - 20 + r * 3.1]]), c.fill();
      F("#8a0f16"); ell(x, STAGE - 12, 1.2, 4); c.fill(); glow(x, STAGE - 10, 9, "rgba(220,20,30,0.35)");
      F("#3a3c46"); poly([[x - 5, STAGE - 25], [x - 5 - 2.4 * Math.min(1, o), STAGE - 24], [x - 5.8 - 2.4, STAGE - 14], [x - 4, STAGE]]); c.fill(); poly([[x + 5, STAGE - 25], [x + 5 + 2.4, STAGE - 24], [x + 5.8 + 2.4, STAGE - 14], [x + 4, STAGE]]); c.fill();
    } else {
      c.save(); c.translate(sh, 0); F("#6e7280"); poly([[x - 4.2, STAGE - 23.5], [x + 4.2, STAGE - 23.5], [x + 5, STAGE - 14], [x + 3.4, STAGE - 1], [x - 3.4, STAGE - 1], [x - 5, STAGE - 14]]); c.fill();
      F("#8a8e9a"); ell(x, STAGE - 19, 2, 2.6); c.fill(); F("#3a3c46"); rect(x - 1.2, STAGE - 20, 0.6, 0.5); rect(x + 0.6, STAGE - 20, 0.6, 0.5); S("#3a3c46", 0.14); c.beginPath(); c.arc(x, STAGE - 17.4, 0.8, 0, Math.PI); c.stroke();
      F("#aab0ba"); for (let i = 0; i < 4; i++) circ(x + (i % 2 ? 3.2 : -3.2), STAGE - 22 + i * 5, 0.28), c.fill();
      S("#9c0b14", 0.22); ln(x - 0.5, STAGE - 14, x - 0.5, STAGE - 5); ln(x + 1.6, STAGE - 14, x + 1.6, STAGE - 8); c.restore();
    }
  },
  freezer(e, x, o) {
    F("#6a7078"); rr(x - 6.5, STAGE - 28, 13, 28, 0.6); c.fill();
    if (o > 0) { F("#06080c"); rect(x - 5.2, STAGE - 26.6, 10.4, 26.6); glow(x, STAGE - 12, 13, "rgba(190,230,255,0.4)"); c.save(); c.globalAlpha = 0.5; F("#e8f4ff"); for (let i = 0; i < 4; i++) ell(x + Math.sin(G.clock + i) * 3, STAGE - 4 - i * 4, 5, 1.8), c.fill(); c.restore(); F("#aab4bc"); poly([[x - 5.2, STAGE - 26.6], [x - 5.2 - 4 * (1 - o) - 1, STAGE - 25.6], [x - 5.2 - 4 * (1 - o) - 1, STAGE - 1], [x - 5.2, STAGE]]); c.fill(); }
    else { const k = e.knock > 0 ? Math.sin(G.clock * 90) * 0.2 : 0; c.save(); c.translate(k, 0); F("#aab4bc"); rect(x - 5.2, STAGE - 26.6, 10.4, 26.6); F("#c8d4dc"); rect(x - 5.2, STAGE - 26.6, 10.4, 3); F("#0a1018"); circ(x, STAGE - 19, 2.2); c.fill(); S("#e8f4ff", 0.2); c.stroke(); F("#e8f4ff"); ell(x, STAGE - 18, 1.2, 0.8); c.fill(); F("#4a5058"); rect(x + 3, STAGE - 12, 0.9, 4); c.save(); c.globalAlpha = 0.6; F("#fff"); ell(x - 3, STAGE - 3, 2.6, 1.2); c.fill(); ell(x + 3, STAGE - 24, 2, 1); c.fill(); c.restore(); c.restore(); }
  }
};

const MIR_SP = 12.5;

function mirRect(e, i) { const px = X(e.x) + (i - (e.n - 1) / 2) * MIR_SP; return { x: px - 4.6, y: STAGE - 25, w: 9.2, h: 25, cx: px }; }

function handTip(e) { const k = Math.pow(clamp(e.prog, 0, 1), 1.4), bx = e.rel ? e.rx : e.bx; return { x: lerp(bx, CAR_X + 3, k), y: lerp(e.y, 39, k) + Math.sin(G.clock * 7 + e.seed) * 0.5 * (1 - k), k }; }

/* ---- the draw of each kind ---- */

function drawPop(e) {
  if (e.ph === "hid" && !e.slump && !e.chop && !e.stand) return;
  const x = sx(e); if (x < -10 || x > W + 10) return;
  const d = POP_S[e.t];
  let y = e.rel ? e.ry : e.y, off = 0;
  if (e.ph === "rise" && !e.slump && !e.stand && !e.orbit) off = (1 - ease(e.pt / 0.45)) * 11;
  const lunge = e.ph === "lunge", atk = e.ph === "atk" || e.ph === "leave";
  const o = { t: e.t, x, y: y + off, s: d.s * (e.sc || 1), a: e.age, hurt: e.flinch > 0, arm: lunge || atk ? 1 : e.ph === "rise" ? 0.6 : 0.15, open: lunge || atk ? 1 : 0.2, tilt: 0, jit: 0, burn: !!e.burn };
  if (e.slump && e.ph === "hid") { o.tilt = 0.55; o.arm = 0; o.slumpy = true; }
  if (e.slump && e.ph === "rise") { o.tilt = 0.55 * (1 - ease(e.pt / 0.45)); }
  if (e.stand && e.ph === "hid") { o.arm = 0.05; o.slumpy = true; o.wax = true; }
  if (e.stand && e.ph === "rise") { o.jit = 0.18; o.melt = true; }
  if (e.t === "wax") { o.wax = true; if (e.ph !== "hid" && e.ph !== "rise") o.melt = true; }
  if (e.t === "butcher" || e.t === "hood") {
    if (e.ph === "hid") { o.cleaver = -1.2 + Math.sin(G.clock * 6.5) * 1.1; o.arm = 0.5; }
    else if (e.ph === "glitch") { o.cleaver = -2 + Math.sin(G.clock * 40) * 0.6; o.jit = 0.35; o.spin = G.clock * 22; o.arm = 1; o.open = 1; }
    else if (atk) o.cleaver = -1.2;
    else o.cleaver = -2.4;
    if (e.ph === "atk" && e.atk < 0) o.cleaver = -0.6 + e.atk * 2.0;
    if (e.ph === "atk" && e.atk >= 0) o.cleaver = -2.6 + e.atk * 3.4;
  }
  const draw1 = d.beast ? beast : figure;
  if (e.dying) { const u = e.dying / 0.45; c.save(); c.globalAlpha = 1 - u; c.translate(x, y); c.rotate(u * 1.3); c.translate(-x, -y); o.hurt = u < 0.3; draw1(o); c.restore(); return; }
  draw1(o);
  if (atk && e.ph === "atk" && e.atk < 0) { c.save(); F("rgba(255,30,30," + (0.3 + 0.3 * Math.sin(G.clock * 30)) + ")"); circ(CAR_X, 40, 6); c.fill(); c.restore(); }
}

function drawLant(e) {
  const x = X(e.x); if (x < -6 || x > W + 6) return;
  const sw = Math.sin(e.age * 1.7 + e.sway) * 0.7 * (e.v === "carc" ? 1.5 : 1), y = e.y;
  if (!LANT_NOCHAIN[e.v]) { S("#2a2424", 0.2); ln(x, 0, x + sw * 0.4, y - 1); }
  c.save(); c.translate(x + sw * 0.4, y); c.rotate(sw * 0.05);
  if (e.dying) { c.globalAlpha = 1 - e.dying / 0.3; }
  if (e.v === "skull") {
    F(e.lit ? "#e8e0c4" : "#6a645a"); ell(0, 1.7, 1.9, 2.1); c.fill();
    F("#d8d0b8"); rr(-1.1, 3.2, 2.2, 1.5, 0.3); c.fill(); S("#2a2020", 0.12); for (let i = -0.6; i <= 0.7; i += 0.6) ln(i, 3.3, i, 4.6);
    F(e.lit ? "#8dff4a" : "#101010"); circ(-0.85, 1.4, 0.6); c.fill(); circ(0.85, 1.4, 0.6); c.fill();
    F("#1a1010"); poly([[0, 2.2], [-0.35, 2.9], [0.35, 2.9]]); c.fill();
    if (e.lit) { S("#c4121c", 0.1); ln(-1.8, 0.6, -1.2, 2.2); }
  } else if (LANT[e.v]) { LANT[e.v](e);
  } else {
    // a carcass on a hook: a hanging body bag with a face
    F("#7a1a1a"); ell(0, 3.3, 2.2, 3.6); c.fill(); F("#a52626"); ell(-0.4, 2.6, 1.3, 2.4); c.fill();
    S("#d8c8b0", 0.15); ln(-1.2, 1, -0.4, 6); ln(1, 1.6, 0.6, 6.5);
    F("#e6d6b4"); circ(0, -0.1, 1.2); c.fill();
    F(e.lit ? "#8dff4a" : "#201010"); circ(-0.45, -0.3, 0.32); c.fill(); circ(0.45, -0.3, 0.32); c.fill();
  }
  if (e.lit) {
    const p = 1 + Math.sin(e.age * 8) * 0.12;
    S("#8dff4a", 0.28); circ(0, 2, 3.5 * p); c.stroke(); S("#fff", 0.12); circ(0, 2, 2.3 * p); c.stroke();
    c.globalAlpha *= 0.8; glow(0, 2, 6, "rgba(140,255,80,0.5)"); c.globalAlpha /= 0.8;
  }
  c.restore();
}

function drawChand(e) {
  const x = X(e.x); if (x < -20 || x > W + 20) return;
  const sw = e.st === "warn" ? Math.sin(e.t * 22) * 0.7 : Math.sin(e.age * 1.4) * 0.3;
  const y = e.y + (e.st === "fall" || e.st === "shot" ? e.fall : 0);
  if (e.st === "crash") { S("#c9a24a", 0.4); const h = Math.min(1, e.t * 6); rr(x - 5, STAGE - 1.5, 10, 1.5, 0.4); c.stroke(); for (let i = 0; i < 5; i++) { const fx = x - 4 + i * 2; const a = 0.6 + 0.4 * Math.sin(G.clock * 12 + i); glow(fx, STAGE - 3 - (i % 2), 3, `rgba(255,150,40,${a})`); } return; }
  c.save(); c.translate(x + sw, 0);
  S("#2a2420", 0.28); if (e.st === "hang" || e.st === "warn") ln(0, 0, 0, y - 1); else { ln(0, 0, -0.6, 6); ln(-0.6, 6, 0.4, 10); }
  c.translate(0, y);
  if (e.v !== "chand") { dropBody(e.v); c.restore(); return; }
  S("#c9a24a", 0.5); ln(-5, 1, 5, 1); ln(-5, 1, -5, -1.2); ln(5, 1, 5, -1.2); ln(-2.5, 1, -2.5, 3); ln(2.5, 1, 2.5, 3);
  S("#b8923a", 0.3); c.beginPath(); c.arc(0, 1, 5.2, 0.1, Math.PI - 0.1); c.stroke();
  for (const cx of [-5, -2.5, 0, 2.5, 5]) { F("#e8e0cc"); rect(cx - 0.3, -2.4, 0.6, 1.6); const fl = 0.8 + Math.sin(G.clock * 11 + cx) * 0.25; F("#ffb040"); ell(cx, -3, 0.35, 0.8 * fl); c.fill(); glow(cx, -3, 2.4, "rgba(255,170,60,0.5)"); }
  F("#8a0f16"); ell(-3.8, 3.2, 0.3, 0.8); c.fill(); ell(1, 2.5, 0.25, 0.6); c.fill();
  c.restore();
}

function drawDoor(e) {
  const x = X(e.x); if (x < -14 || x > W + 14) return;
  const o = e.st === "open" ? ease(e.t / 0.18) : 0;
  if (e.v && DOORV[e.v]) { DOORV[e.v](e, x, o); return; }
  F("#2a1810"); rr(x - 6, STAGE - 28, 12, 28, 0.6); c.fill();
  F(o ? "#14040a" : "#3a2616"); rect(x - 5, STAGE - 27, 10, 27);
  if (o) { const g = lgrad(x, STAGE - 27, x, STAGE); g.addColorStop(0, "#050102"); g.addColorStop(1, "#6a0a12"); c.fillStyle = g; rect(x - 5, STAGE - 27, 10, 27); glow(x, STAGE - 6, 12, "rgba(220,20,30,0.45)"); }
  if (!o) { const k = e.knock > 0 ? Math.sin(G.clock * 90) * 0.25 : 0; c.save(); c.translate(k, 0); F("#6a4424"); rect(x - 5, STAGE - 27, 10, 27); S("#2a1808", 0.2); for (const dx of [-2.5, 0, 2.5]) ln(x + dx, STAGE - 27, x + dx, STAGE); F("#c9a24a"); circ(x + 3, STAGE - 13, 0.55); c.fill(); F("#e8d8a0"); ell(x, STAGE - 22, 1.6, 1); c.fill(); F("#101010"); circ(x - 0.5, STAGE - 22, 0.5); c.fill(); c.restore(); S("#c4121c", 0.15); ln(x - 4, STAGE - 27, x - 4.5, STAGE - 16); }
  else { c.save(); F("#5a3a1c"); poly([[x - 5, STAGE - 27], [x - 5 - 3 * (1 - o) - 0.6, STAGE - 26], [x - 5 - 3 * (1 - o) - 0.6, STAGE - 1], [x - 5, STAGE]]); c.fill(); poly([[x + 5, STAGE - 27], [x + 5 + 3 * (1 - o) + 0.6, STAGE - 26], [x + 5 + 3 * (1 - o) + 0.6, STAGE - 1], [x + 5, STAGE]]); c.fill(); c.restore(); }
  F("#2a1810"); rect(x - 7, STAGE - 29, 14, 1.3);
}

function drawHand(e) {
  if (e.prog < 0) return; const bx = e.bx, t = handTip(e); if (bx < -20 || bx > W + 20) return;
  c.save(); if (e.dying) c.globalAlpha = 1 - e.dying / 0.4;
  const k = t.k, w = 0.9 + k * 0.7;
  S("#6a5a52", w); c.beginPath(); c.moveTo(bx, e.y);
  const mx = (bx + t.x) / 2, my = (e.y + t.y) / 2 + 2 + Math.sin(G.clock * 9 + e.seed) * 0.8;
  c.quadraticCurveTo(mx, my, t.x, t.y); c.stroke();
  S("#8a0f16", w * 0.3); c.beginPath(); c.moveTo(bx, e.y); c.quadraticCurveTo(mx, my, t.x, t.y); c.stroke();
  // the hand: palm and clawing fingers
  const s = 0.9 + k * 0.9; F("#7c6c62"); ell(t.x, t.y, 0.95 * s, 0.8 * s); c.fill();
  S("#7c6c62", 0.34 * s); for (let i = -2; i <= 1; i++) { const a = -0.4 + i * 0.45 + Math.sin(G.clock * 12 + i + e.seed) * 0.2; ln(t.x + 0.4 * s, t.y + i * 0.25 * s, t.x + (1.1 + 1.2 * s) * Math.cos(a) + 0.4 * s, t.y + i * 0.3 * s + 1.5 * s * Math.sin(a)); }
  S("#e0d4b8", 0.12 * s); for (let i = -2; i <= 1; i++) { const a = -0.4 + i * 0.45; ln(t.x + (1 + 1.2 * s) * Math.cos(a) + 0.4 * s, t.y + i * 0.3 * s + 1.5 * s * Math.sin(a), t.x + (1.4 + 1.2 * s) * Math.cos(a) + 0.5 * s, t.y + i * 0.3 * s + 1.7 * s * Math.sin(a)); }
  c.restore();
}

function drawHead(e) {
  if (e.dying) { c.save(); c.globalAlpha = 1 - e.dying / 0.3; }
  c.save(); c.translate(e.rx, e.ry); c.rotate(e.t * 7 + e.spin); c.scale(e.sc, e.sc);
  if (e.web) { F("rgba(235,235,240,0.9)"); circ(0, 0, 1.7); c.fill(); S("#fff", 0.12); for (let i = 0; i < 6; i++) { const a = i * 1.05; ln(0, 0, Math.cos(a) * 2.4, Math.sin(a) * 2.4); } } else if (e.skull) { F("#e8e0c4"); ell(0, 0, 1.6, 1.7); c.fill(); F("#8dff4a"); circ(-0.6, -0.2, 0.45); c.fill(); circ(0.6, -0.2, 0.45); c.fill(); F("#1a1010"); rect(-0.8, 0.8, 1.6, 0.6); }
  else { F(e.skin); ell(0, 0, 1.5, 1.7); c.fill(); F("#3a2418"); ell(0, -1.2, 1.55, 0.7); c.fill(); F("#f4f0e0"); circ(-0.6, -0.1, 0.45); c.fill(); circ(0.6, -0.1, 0.45); c.fill(); F("#101010"); circ(-0.6, -0.1, 0.2); c.fill(); circ(0.6, -0.1, 0.2); c.fill(); F("#3a0508"); ell(0, 0.9, 0.6, 0.45); c.fill(); F("#a00e16"); ell(0.2, 1.7, 1.2, 0.7); c.fill(); }
  c.restore(); if (e.dying) c.restore();
}

function drawEyes(e) {
  const lit = clamp(1 - Math.hypot(e.rx - G.ret.x, e.ry - G.ret.y) / 12, 0, 1), s = e.sc, a = (e.dying ? 1 - e.dying / 0.35 : 1);
  c.save(); c.globalAlpha = a;
  if (lit > 0) { c.globalAlpha = a * lit; F("#6a6458"); ell(e.rx, e.ry + 1.4 * s, 3.4 * s, 4.4 * s); c.fill(); F("#14080a"); ell(e.rx, e.ry + 3.4 * s, 1.6 * s, 1.1 * s + Math.sin(G.clock * 6 + e.seed) * 0.2); c.fill(); F("#e8e0c8"); for (let i = -3; i <= 3; i++) { rect(e.rx + i * 0.38 * s - 0.15 * s, e.ry + 2.7 * s, 0.3 * s, 0.7 * s); rect(e.rx + i * 0.38 * s - 0.15 * s, e.ry + 4 * s, 0.3 * s, 0.6 * s); } F("#7a0c12"); rect(e.rx - 1.4 * s, e.ry + 4.8 * s, 0.3 * s, 2 * s); }
  c.globalAlpha = a * (0.5 + 0.5 * lit);
  const bl = Math.sin(G.clock * 3 + e.seed) > 0.96 ? 0.2 : 1;
  for (const d of [-1, 1]) { glow(e.rx + d * 1.4 * s, e.ry, 3.4 * s, "rgba(255,40,30,0.55)"); F("#ff5a30"); ell(e.rx + d * 1.4 * s, e.ry, 0.9 * s, 0.55 * s * bl); c.fill(); F("#1a0000"); ell(e.rx + d * 1.4 * s, e.ry, 0.2 * s, 0.5 * s * bl); c.fill(); }
  c.restore();
}

function drawBoss(e) { const x = X(e.x); if (x < -35 || x > W + 40) return; drawBarker(e, x); }

function drawInno(e) {
  const x = X(e.x); if (x < -6 || x > W + 6) return;
  c.save(); if (e.dying) { c.globalAlpha = 1 - e.dying / 0.5; c.translate(x, STAGE); c.rotate(e.dying * 2); c.translate(-x, -STAGE); }
  const wv = Math.sin(e.age * 4) * 0.5, big = e.v === "tourist" ? 1.15 : e.v === "nurse" ? 1.1 : 0.9;
  c.translate(x, STAGE); c.scale(big, big);
  // a friendly halo and a green heart
  const pl = 1 + Math.sin(e.age * 5) * 0.08; const bad = e.bad && G.st.exit && G.st.exit.tell; c.save(); c.globalAlpha = 0.7; S(bad ? "#ff3a30" : "#6aff8a", bad ? 0.35 : 0.2); circ(0, -4.2, 5.2 * pl); c.stroke(); c.restore(); glow(0, -4.2, 6, bad ? "rgba(255,50,40,0.35)" : "rgba(100,255,140,0.25)");
  F(e.v === "nurse" ? "#e8f0f4" : e.v === "tourist" ? "#d8a040" : "#4a9ae0"); rr(-1.5, -5.2, 3, 3.8, 0.6); c.fill();
  F("#2a2a3a"); rect(-1.1, -1.6, 0.9, 1.6); rect(0.2, -1.6, 0.9, 1.6);
  S("#e8c8a8", 0.5); ln(-1.5, -4.5, -2.6, -3.2 + wv); ln(1.5, -4.5, 2.6, -6.2 + wv);
  F("#f0d0b0"); circ(0, -6.6, 1.5); c.fill(); F(bad ? "#ff2a20" : "#1a1a1a"); circ(-0.55, -6.7, bad ? 0.3 : 0.2); c.fill(); circ(0.55, -6.7, bad ? 0.3 : 0.2); c.fill(); S("#a05030", 0.12); c.beginPath(); c.arc(0, -6.2, 0.6, 0.2, Math.PI - 0.2); c.stroke();
  if (e.v === "kid") { F("#ff5ab0"); poly([[-1, -7.9], [1, -7.9], [0, -10]]); c.fill(); F("#ffe040"); circ(0, -10.1, 0.35); c.fill(); }
  if (e.v === "nurse") { F("#fff"); rr(-1.5, -8.4, 3, 1.1, 0.3); c.fill(); F("#e03030"); rect(-0.2, -8.3, 0.4, 0.8); rect(-0.4, -8.1, 0.8, 0.4); }
  if (e.v === "tourist") { F("#d8c080"); ell(0, -7.9, 2.3, 0.45); c.fill(); rr(-1.2, -9, 2.4, 1.2, 0.4); c.fill(); F("#222"); rect(-0.5, -5.4, 1, 0.8); }
  F(bad ? "#ff2a30" : "#3ae06a"); circ(-0.5, -4.1, 0.45); c.fill(); circ(0.5, -4.1, 0.45); c.fill(); poly([[-0.95, -3.9], [0.95, -3.9], [0, -3]]); c.fill();
  c.restore();
}

function drawMir(e) {
  const x0 = X(e.x); if (x0 < -50 || x0 > W + 50) return;
  const real = e.pops.find((p) => p.alive) || e.pops[0];
  for (let i = 0; i < e.n; i++) {
    const r = mirRect(e, i), isReal = e.reals.includes(i);
    F("#c9a24a"); rr(r.x - 0.9, r.y - 0.9, r.w + 1.8, r.h + 1.8, 0.8); c.fill();
    c.fillStyle = grad(r.x, r.y, r.x + r.w, r.y + r.h, [[0, "#1c2a38"], [0.5, "#34506a"], [1, "#16222e"]]); rect(r.x, r.y, r.w, r.h);
    c.save(); c.beginPath(); c.rect(r.x, r.y, r.w, r.h); c.clip();
    if (!isReal && !e.cracked[i] && !e.done && real) {
      // the reflection: the same ghoul, mirrored, tinted glass blue, a beat late
      const lunge = real.ph === "lunge", k = lunge ? clamp(real.pt / real.L, 0, 1) : 0, sc = 0.85 + k * 0.7;
      c.save(); c.translate(r.cx, STAGE - 1 + k * 3); c.scale(-1, 1); c.translate(-r.cx, -(STAGE - 1 + k * 3));
      figure({ t: "ghoul", x: r.cx, y: STAGE - 1 + k * 3, s: sc, a: e.age + 0.4, hurt: false, arm: lunge ? 1 : 0.2, open: lunge ? 1 : 0.2, tilt: 0, jit: 0 }); c.restore();
      F("rgba(110,200,255,0.42)"); rect(r.x, r.y, r.w, r.h);
    }
    c.globalAlpha = 0.22; F("#fff"); poly([[r.x + 1.5, r.y], [r.x + 3.6, r.y], [r.x + 1.2, r.y + r.h], [r.x - 0.9, r.y + r.h]]); c.fill(); c.globalAlpha = 1;
    if (e.cracked[i]) { F("rgba(0,0,0,0.5)"); rect(r.x, r.y, r.w, r.h); S("#e8f4ff", 0.12); c.beginPath(); c.moveTo(r.cx, r.y + 9); for (let k = 0; k < 7; k++) { const a = k * 0.9 + i; c.moveTo(r.cx, r.y + 9); c.lineTo(r.cx + Math.cos(a) * 7, r.y + 9 + Math.sin(a) * 9); } c.stroke(); }
    if (e.shat && e.shat > 0.15) { F("rgba(0,0,0,0.55)"); rect(r.x, r.y, r.w, r.h); S("#e8f4ff", 0.1); for (let k = 0; k < 9; k++) { const a = k * 0.7 + i; ln(r.cx, r.y + 12, r.cx + Math.cos(a) * 8, r.y + 12 + Math.sin(a) * 10); } }
    c.restore();
  }
}

function drawWeb(e) {
  const x = X(e.x); if (x < -16 || x > W + 16) return; const R = 13, y = e.y, cut = e.st === "cut" || e.st === "torn", fade = cut ? 1 - e.t / 1.2 : 1;
  c.save(); c.globalAlpha = 0.85 * fade; S("#e8e8f0", 0.12);
  const sag = cut ? e.t * 12 : 0;
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ln(x, y, x + Math.cos(a) * R, y + Math.sin(a) * R + sag * (Math.sin(a) > 0 ? 1 : 0)); }
  for (let r = 3; r <= R; r += 3) { c.beginPath(); for (let i = 0; i <= 12; i++) { const a = i * TAU / 12, rr2 = r * (1 - 0.06 * Math.sin(i * 2.1 + r)); const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2 + sag * (Math.sin(a) > 0 ? 1 : 0); i ? c.lineTo(px, py + 0.7 * Math.sin(i * 3 + r) * 0) : c.moveTo(px, py); } c.stroke(); }
  S("#e8e8f0", 0.2); ln(x, y - R, x + 1.5, 0); ln(x, y + R, x - 1, STAGE + 6);
  if (e.st === "stuck") { S("#e8e8f0", 0.2); ln(x, y, CAR_X + 1, 41); ln(x, y + 3, CAR_X - 2, 43); ln(x + 2, y - 2, CAR_X + 4, 40); }
  c.restore();
  if (e.st === "up") { const p = 1 + Math.sin(e.age * 9) * 0.1; c.save(); S("#ff4a3a", 0.3); circ(x, y, 4 * p); c.stroke(); S("#fff", 0.12); circ(x, y, 2.8 * p); c.stroke(); F("rgba(255,60,40,0.9)"); for (let i = 0; i < e.hp; i++) { circ(x - 1.4 + i * 1.4, y + 6.2, 0.4); c.fill(); } c.restore(); }
}

function drawMini(e) { const x = X(e.x); if (x < -40 || x > W + 45) return; c.save(); if (e.dead) { c.globalAlpha = Math.max(0, 1 - e.dead / 2.6); c.translate(0, Math.min(14, e.dead * 6)); } MINI_DRAW[e.id](e, x); c.restore(); }

function drawAxe(e) {
  const x = X(e.x); if (x < -45 || x > W + 45) return;
  if (e.cut) { const t = e.cut; c.save(); c.translate(e.tx, e.ty + t * t * 40); c.rotate(t * 5); blade(0, e.v); c.restore(); S("#2a2424", 0.2); ln(x, 0, x + 0.4, 7 - t * 2); return; }
  S("#3a2e26", 0.28); ln(x, -1, e.tx, e.ty - 2.2);
  F("#2a1a10"); circ(x, -0.5, 0.9); c.fill();
  c.save(); c.translate(e.tx, e.ty); c.rotate(-e.ang); blade(1, e.v); c.restore();
}

function blade(live, v) {
  if (v && v !== "axe") { axeVar(v, live); return; }
  S("#4a3220", 0.5); ln(0, -4, 0, 0.5);
  F("#9aa2ae"); poly([[-0.4, -2.2], [-3.2, -1.4], [-3.8, 1.2], [-1.6, 2.4], [-0.4, 1.6]]); c.fill(); poly([[0.4, -2.2], [3.2, -1.4], [3.8, 1.2], [1.6, 2.4], [0.4, 1.6]]); c.fill();
  F("#d6dbe4"); poly([[-3.8, 1.2], [-1.6, 2.4], [-1.3, 1.7], [-3.4, 0.7]]); c.fill(); poly([[3.8, 1.2], [1.6, 2.4], [1.3, 1.7], [3.4, 0.7]]); c.fill();
  F("#8a0f16"); poly([[-3.4, 0.4], [-2.4, 1.9], [-1.6, 1.0]]); c.fill(); ell(2.6, 0.6, 0.7, 0.4); c.fill(); circ(-0.2, 0, 0.4); c.fill();
  if (live) { c.save(); c.globalAlpha = 0.25 + 0.2 * Math.sin(G.clock * 14); S("#fff", 0.15); circ(0, 0, 4.6); c.stroke(); c.restore(); }
}

const MINI_DRAW = {
  swan(e, x) {
    const hurt = e.spots[0].hurt > 0, bc = hurt ? "#fff" : "#2a2634";
    // body low in the water, wings up, tail
    F(bc); ell(x + 1, 41.5, 17, 6.5); c.fill(); F("#3a3444"); ell(x + 3, 39.4, 13, 4.5); c.fill();
    F("#1a1620"); poly([[x + 1, 37], [x + 14, 27], [x + 20, 30], [x + 12, 39]]); c.fill(); poly([[x - 4, 37.5], [x + 4, 24], [x + 9, 27], [x + 2, 39]]); c.fill();
    S("#4a4458", 0.2); for (let i = 0; i < 5; i++) ln(x + 2 + i * 2.4, 37.2 - i * 0.5, x + 10 + i * 2, 29 + i * 0.6);
    F("#8a0f16"); ell(x + 6, 40.5, 2.4, 1.2); c.fill(); ell(x - 6, 41.5, 1.6, 0.8); c.fill();
    // neck and head
    const hx = e.hx, hy = e.hy, bx = x - 8, by = 38;
    c.beginPath(); c.moveTo(bx + 2, by); c.quadraticCurveTo((bx + hx) / 2 + 6, (by + hy) / 2 + 6 - Math.sin(e.age * 2) * 2, hx + 0.5, hy + 1.2); c.lineTo(hx - 1, hy - 0.5); c.quadraticCurveTo((bx + hx) / 2 + 1, (by + hy) / 2 + 3, bx - 2.5, by); c.closePath(); F(bc); c.fill(); S("#14101a", 0.2); c.stroke();
    F(bc); ell(hx, hy, 3.2, 2.3); c.fill();
    // beak with teeth
    F("#c8661a"); poly([[hx - 2.5, hy - 0.8], [hx - 8.2, hy + 0.8], [hx - 2.5, hy + 1.2]]); c.fill(); F("#8a3a0a"); poly([[hx - 2.5, hy + 1.2], [hx - 7.2, hy + 1.4], [hx - 2.6, hy + 2.6]]); c.fill();
    F("#f0ead8"); for (let i = 0; i < 4; i++) poly([[hx - 3.2 - i * 1.2, hy + 1.05], [hx - 3.8 - i * 1.2, hy + 1.05], [hx - 3.6 - i * 1.2, hy + 2]]), c.fill();
    F("#a0121c"); rect(hx - 6.5, hy + 1.4, 0.4, 2.4);
    // eye: the weak point
    F(hurt ? "#fff" : "#ff2a20"); circ(hx - 0.8, hy - 0.7, 1.15); c.fill(); F("#000"); ell(hx - 0.8, hy - 0.7, 0.3, 0.9); c.fill(); glow(hx - 0.8, hy - 0.7, 4, "rgba(255,40,30,0.5)");
    if (e.active && !e.dead) { c.save(); c.globalAlpha = 0.55 + 0.4 * Math.sin(G.clock * 8); S("#8dff4a", 0.25); circ(hx - 0.8, hy - 0.7, 3.4); c.stroke(); c.restore(); }
  },
  spider(e, x) {
    const hx = e.hx, hy = e.hy, h0 = e.spots[0].hurt > 0, h1 = e.spots[1].hurt > 0, bodyc = h0 || h1 ? "#fff" : "#1a1218", lc = "#2a1a22";
    S("#e8e8f0", 0.12); ln(hx + 2, 0, hx + 2, hy - 4);
    // legs
    for (let i = 0; i < 8; i++) { const sd = i < 4 ? -1 : 1, k = i % 4, w = Math.sin(e.age * 3 + i * 0.9) * 1.2, ax = hx - 1.5 + k * 1.6, ay = hy + 0.6; S(i < 4 ? lc : "#14090e", 0.65); c.beginPath(); c.moveTo(ax, ay); const kx = ax + (k - 1.5) * 3.2 + sd * 1.5, ky = ay - 5.2 + w; c.lineTo(kx, ky); c.lineTo(kx + (k - 1.5) * 2 + sd * 2.5, ay + 5.5 + w * 0.7 + k * 0.5); c.stroke(); }
    F(bodyc); ell(hx + 4.8, hy + 1.2, 6.3, 4.8); c.fill(); F("#a0121c"); poly([[hx + 4.5, hy - 1], [hx + 6, hy - 1], [hx + 5.4, hy + 1.2], [hx + 6, hy + 3.4], [hx + 4.5, hy + 3.4], [hx + 5.1, hy + 1.2]]); c.fill();
    F(bodyc); ell(hx - 1.2, hy + 0.2, 3.4, 2.7); c.fill(); ell(hx - 3.8, hy + 0.4, 2.2, 2); c.fill();
    F("#e8e0d0"); poly([[hx - 5.2, hy + 1.8], [hx - 4.5, hy + 1.8], [hx - 4.9, hy + 4]]); c.fill(); poly([[hx - 3.6, hy + 2], [hx - 2.9, hy + 2], [hx - 3.3, hy + 3.8]]); c.fill();
    F("#8dff4a"); circ(hx - 4.9, hy + 4.4, 0.3); c.fill();
    for (const [ex, ey, er] of [[-5.2, -0.6, 0.55], [-4.2, -1.2, 0.5], [-3.2, -0.7, 0.5], [-4.6, 0.3, 0.38], [-3.6, 0.4, 0.38], [-2.8, -1.4, 0.3]]) { F(h0 ? "#fff" : "#ff2a20"); circ(hx + ex, hy + ey, er); c.fill(); }
    glow(hx - 4.2, hy - 0.4, 4.5, "rgba(255,40,30,0.4)");
    if (e.active && !e.dead) { c.save(); c.globalAlpha = 0.5 + 0.4 * Math.sin(G.clock * 8); S("#8dff4a", 0.25); for (const sp of e.spots) if (sp.hp > 0) { circ(sp.x, sp.y, sp.r); c.stroke(); } c.restore(); }
  },
};

export const DRAW = { pop: drawPop, lant: drawLant, axe: drawAxe, chand: drawChand, door: drawDoor, hand: drawHand, head: drawHead, eyes: drawEyes, boss: drawBoss, inno: drawInno, mir: drawMir, web: drawWeb, mini: drawMini };

/* ---- the dark's giant ---- */

export function drawGiant() {
  const s = G.stall; if (s.giant <= 0) return;
  const g = clamp(s.giant, 0, 1), x = CAR_X + 12;
  c.save(); c.globalAlpha = 0.55 * g;
  F("#0c0a10"); ell(x, 12, 36, 26); c.fill();
  F("#1c1820"); ell(x, 14, 30, 20); c.fill();
  // huge nostrils and a brow
  F("#050308"); ell(x - 3, 26, 1.8, 2.4); c.fill(); ell(x + 3, 26, 1.8, 2.4); c.fill();
  c.restore();
}

export function drawGiantLate() {
  const s = G.stall; if (s.giant <= 0) return;
  const g = clamp(s.giant, 0, 1), x = CAR_X + 12, tell = s.tell > 0;
  c.save();
  for (const d of [-1, 1]) { const ex = x + d * 11, ey = 14; c.globalAlpha = (tell ? 1 : 0.55) * g; glow(ex, ey, 11, tell ? "rgba(255,30,20,0.6)" : "rgba(255,200,40,0.4)"); F(tell ? "#ff3020" : "#ffd028"); ell(ex, ey, 3.6, 2.2); c.fill(); F("#000"); ell(ex, ey, 0.7, 2.1); c.fill(); }
  // breath fog on the lens
  c.globalAlpha = 0.18 * g * (0.5 + 0.5 * Math.sin(G.clock * 2.1)); F("#cfd8e0"); ell(CAR_X + 6, 30, 22, 12); c.fill();
  if (s.slam > 0) {
    // the jaws: a slab of black with a row of long teeth that slams down to the car
    c.globalAlpha = 1; const u = ease(clamp(s.slam / 0.22, 0, 1)), jy = lerp(-14, 42.5, u);
    F("#06040a"); rect(CAR_X - 18, -14, 36, jy + 14); F("#e8e0c4");
    for (let i = 0; i < 8; i++) { const tx = CAR_X - 15.5 + i * 4.4; poly([[tx - 1.6, jy - 3], [tx + 1.6, jy - 3], [tx, jy + 3.2 + (i % 2) * 1.6]]); c.fill(); }
    F("#7a0c12"); for (let i = 0; i < 4; i++) rect(CAR_X - 12 + i * 8, jy, 0.4, 3 + 2 * Math.sin(G.clock * 4 + i) + 3);
  }
  c.restore();
}
