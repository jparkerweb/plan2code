// Plan2Code Web Console - Ghoul Rush's dark ride, the rooms: each room's far wall, set pieces front and back, aisle and the near pillars, drawn.
//
// A port of the prototype's world draw (prototypes/ghoul-rush-ride/gallery.html),
// the room table's art columns laid out by room id. Holds:
//
// - FAR_OF[id](scroll)   the far wall (0.4 times the ride's speed) of a room; the Barker's turns to the exit's sky
// - BACK[id](), FRONT[id](), OVER[id](), AISLE[id](sc)   the sets behind and in front of the entities,
//                        the room's tint, and the aisle's own floor (the tunnel's water); a room without one has no key
// - FAR             the nine far walls the prototype's first rooms used (kept whole)
// - drawFar, drawSets(front), drawOver, aisle, drawNear   the passes a frame is built from
//
// Set pieces are placed with XS (an author x moved by the room being drawn, see
// ghoul-ride-core.js); the room table is ghoul-ride-scenes.js. Not ported: the
// prototype's four rooms that never made the ride's table (the freak show, the
// dentist, the lockers and the chapel) and its old v1 sets.

import { W, CAR_X, STAGE, FLOOR, TAU, clamp, hash, G, X, XS, setSH } from "./ghoul-ride-core.js";
import { SCENES } from "./ghoul-ride-scenes.js";
import { c, F, S, rr, circ, ell, ln, poly, rect, txt, grad, glow, tile, vgrad, circle } from "./ghoul-ride-gfx.js";
import { beast, flames, portrait } from "./ghoul-ride-draw-kinds.js";

/* ---- the far wall: the prototype's nine, and one for each room of the table ---- */

export const FAR = [
  (s) => { F("#12080e"); rect(0, 0, W, 50); tile(s, 8, (x, i) => { F(i % 2 ? "#4a0f1a" : "#16080c"); rect(x, 0, 4, 44); }); S("#2a1a14", 0.15); ln(0, 6, W, 6); tile(s, 14, (x, i) => { for (let k = 0; k < 3; k++) { const bx = x + k * 4.7, by = 6 + Math.sin((k / 3) * Math.PI) * 2.2; F(Math.sin(G.clock * 3 + i * 7 + k) > -0.3 ? "#ffcf70" : "#6a4a20"); circ(bx, by + 1, 0.55); c.fill(); glow(bx, by + 1, 2.4, "rgba(255,200,100,0.5)"); } }); },
  (s) => { F("#0b0f18"); rect(0, 0, W, 50); tile(s, 9, (x, i) => { for (let r = 0; r < 11; r++) { F(((r + i) % 3 === 0) ? "#1a2130" : "#131a26"); rect(x + (r % 2) * 4.5 - 4.5, r * 4, 8.6, 3.8); } }); tile(s, 40, (x, i) => { F("#05070c"); rr(x + 5, 6, 12, 20, 6); c.fill(); F("#d0e0ff"); circ(x + 11, 13, 3.6); c.fill(); S("#05070c", 0.5); ln(x + 11, 6, x + 11, 26); ln(x + 5, 15, x + 17, 15); }); },
  (s) => { F("#1c2824"); rect(0, 0, W, 50); tile(s, 3.2, (x, i) => { for (let r = 0; r < 14; r++) { F(hash(i * 13 + r) > 0.1 ? "#2a3a34" : "#34463e"); rect(x, r * 3.2, 3.1, 3.1); } }); tile(s, 17, (x, i) => { const h = hash(i * 3.7); S("#7a0c12", 0.5 + h * 0.6); ln(x + 4, 4 + h * 8, x + 4, 22 + h * 14); F("#7a0c12"); circ(x + 4, 22 + h * 14, 0.8); c.fill(); }); S("#10141a", 0.6); ln(0, 7, W, 7); tile(s, 11, (x, i) => { F(Math.sin(G.clock * 9 + i * 5) > -0.7 ? "#f0f0c0" : "#2a3020"); rect(x, 8, 1.8, 0.6); glow(x + 0.9, 9, 4, "rgba(220,230,160,0.35)"); }); },
  (s) => { F("#1a0509"); rect(0, 0, W, 50); tile(s, 6, (x, i) => { c.fillStyle = grad(x, 0, x + 6, 0, [[0, "#2a0610"], [0.5, "#6a0f1e"], [1, "#2a0610"]]); rect(x, 0, 6, 44); }); S("#c9a24a", 0.3); tile(s, 6, (x) => ln(x, 38, x + 3, 40)); c.save(); c.globalAlpha = 0.14; F("#ffe8a0"); tile(s, 30, (x, i) => { poly([[x + 8, 0], [x + 12, 0], [x + 20, 44], [x, 44]]); c.fill(); }); c.restore(); },
  (s) => { F("#1c1209"); rect(0, 0, W, 50); tile(s, 7, (x, i) => { F("#2c1c0e"); poly([[x + 3.5, 2], [x + 6.5, 6], [x + 3.5, 10], [x + 0.5, 6]]); c.fill(); poly([[x + 3.5, 14], [x + 6.5, 18], [x + 3.5, 22], [x + 0.5, 18]]); c.fill(); poly([[x + 3.5, 26], [x + 6.5, 30], [x + 3.5, 34], [x + 0.5, 30]]); c.fill(); }); F("#120a05"); rect(0, 32, W, 12); tile(s, 26, (x, i) => { portrait(x + 6, 6, i); }); },
  (s) => { F("#0e1c1b"); rect(0, 0, W, 50); tile(s, 5, (x, i) => { F(i % 2 ? "#143030" : "#0f2424"); rect(x, 0, 2.5, 44); }); tile(s, 23, (x, i) => { const h = hash(i * 5.1); F("#2a1a12"); rr(x + 3, 14, 5, 22, 0.4); c.fill(); }); tile(s, 9, (x, i) => { S("#8a0f16", 0.35); const h = hash(i * 9.3); ln(x, 0, x + h, 10 + h * 22); }); },
  (s) => { F("#040308"); rect(0, 0, W, 50); S("#0e0c14", 0.3); tile(s, 14, (x, i) => { const h = hash(i); ln(x, 0, x + Math.sin(G.clock * 0.7 + i) * 0.6, 8 + h * 20); }); },
  (s) => { F("#14071f"); rect(0, 0, W, 50); tile(s, 9, (x, i) => { F(i % 2 ? "#3a1450" : "#1c0a2c"); rect(x, 0, 4.5, 44); }); S("#ff3d9a", 0.3); tile(s, 6, (x, i) => { ln(x, 3 + (i % 2) * 3, x + 6, 3 + ((i + 1) % 2) * 3); }); S("#38e8ff", 0.2); tile(s, 6, (x, i) => { ln(x, 9 + (i % 2) * 2, x + 6, 9 + ((i + 1) % 2) * 2); }); },
  (s) => { c.fillStyle = grad(0, 0, 0, 44, [[0, "#070b26"], [0.7, "#3a2060"], [1, "#a0407a"]]); rect(0, 0, W, 50); F("#fff"); for (let i = 0; i < 40; i++) { circle(((hash(i) * 140 - s * 0.2) % 100 + 100) % 100, hash(i + 40) * 24, 0.12 + hash(i + 7) * 0.16); } c.save(); c.translate(70 - s * 0.1 % 40, 22); S("#1a0f30", 0.7); circ(0, 0, 17); c.stroke(); for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + G.clock * 0.1; ln(0, 0, Math.cos(a) * 17, Math.sin(a) * 17); F(["#ff3d9a", "#ffcf40", "#38e8ff", "#8dff4a"][i % 4]); circ(Math.cos(a) * 17, Math.sin(a) * 17, 1.4); c.fill(); } c.restore(); F("#0a0618"); rect(0, 34, W, 16); tile(s, 7, (x, i) => { F(["#ff3d9a", "#ffcf40", "#38e8ff"][i % 3]); circ(x, 33 + Math.sin(i * 2) * 0.7, 0.5); c.fill(); }); },
];

const FARV2 = {
  wax(s) { vgrad("#1c0f1a", "#0a0610"); c.save(); c.globalAlpha = 0.1; F("#ffe8c0"); tile(s, 18, (x) => { poly([[x + 7, 0], [x + 11, 0], [x + 17, 40], [x + 1, 40]]); c.fill(); }); c.restore(); tile(s, 26, (x, i) => portrait(x + 7, 6, i + 1)); F("rgba(255,230,200,0.05)"); rect(0, 30, W, 14); },
  torture(s) { vgrad("#14100e", "#050303"); tile(s, 7, (x, i) => { for (let r = 0; r < 11; r++) { F((r + i) % 3 ? "#1c1714" : "#241c18"); rect(x + (r % 2) * 3.5 - 3.5, r * 4, 6.8, 3.8); } }); tile(s, 30, (x, i) => { F("#2a1a10"); rect(x + 3, 12, 0.9, 3); c.save(); flames(x + 3.4, 12, 0.9); c.restore(); glow(x + 3.4, 11, 11, "rgba(255,130,40,0.22)"); S("#3a3430", 0.2); ln(x + 15, 0, x + 15, 12 + hash(i) * 8); ln(x + 17, 0, x + 17, 8 + hash(i + 3) * 10); }); },
  carousel(s) { vgrad("#2a0a22", "#10040e"); tile(s, 7, (x, i) => { F(i % 2 ? "#6a1a3a" : "#e8d8b0"); c.save(); c.globalAlpha = 0.16; rect(x, 0, 3.5, 44); c.restore(); }); tile(s, 5, (x, i) => { const col = ["#ff3d9a", "#ffcf40", "#38e8ff", "#8dff4a"][i % 4], on = Math.floor(G.clock * 5 + i) % 2; F(on ? col : "#2a1a2a"); circ(x, 4, 0.45); c.fill(); circ(x, 39, 0.45); c.fill(); if (on) glow(x, 4, 2.5, "rgba(255,200,150,0.3)"); }); c.save(); c.globalAlpha = 0.2; tile(s, 17, (x, i) => { F("#cfe8ff"); rr(x + 2, 8, 8, 24, 3); c.fill(); }); c.restore(); },
  mirrors(s) { vgrad("#08121f", "#03060c"); tile(s, 16, (x, i) => { S(i % 2 ? "#ff3d9a" : "#38e8ff", 0.2); c.strokeRect(x + 2, 5, 12, 34); S("rgba(255,255,255,0.15)", 0.12); ln(x + 3, 38, x + 9, 6); ln(x + 6, 38, x + 12, 6); c.save(); c.globalAlpha = 0.2; S(i % 2 ? "#ff3d9a" : "#38e8ff", 0.5); c.strokeRect(x + 4, 9, 8, 26); c.restore(); }); },
  tunnel(s) { vgrad("#1a0a2c", "#07030c"); F("#0a0414"); tile(s, 9, (x, i) => { const h = 4 + hash(i * 2.3) * 9; poly([[x, 0], [x + 4, 0], [x + 2, h]]); c.fill(); }); tile(s, 22, (x, i) => { c.save(); c.globalAlpha = 0.75; F("#ff3d9a"); const hx = x + 8, hy = 14; circ(hx - 1.7, hy, 2.1); c.fill(); circ(hx + 1.7, hy, 2.1); c.fill(); poly([[hx - 3.7, hy + 0.7], [hx + 3.7, hy + 0.7], [hx, hy + 5]]); c.fill(); c.restore(); glow(hx, hy + 1, 8, "rgba(255,60,150,0.3)"); }); tile(s, 4, (x, i) => { F(Math.sin(G.clock * 4 + i) > 0 ? "#ffd0e8" : "#7a3a5a"); circ(x, 6 + Math.sin(i) * 1.5, 0.3); c.fill(); }); },
  web(s) { vgrad("#05080a", "#0a100e"); tile(s, 40, (x, i) => { const wx = x + 20, wy = 14 + hash(i) * 6; S("rgba(220,230,230,0.18)", 0.12); for (let k = 0; k < 10; k++) { const a = k * 0.628; ln(wx, wy, wx + Math.cos(a) * 20, wy + Math.sin(a) * 20); } for (let r = 5; r <= 20; r += 5) { circ(wx, wy, r); c.stroke(); } }); tile(s, 13, (x, i) => { const h = 6 + hash(i * 3) * 14; S("rgba(230,235,230,0.3)", 0.12); ln(x, 0, x, h); F("#c8cfc4"); ell(x, h + 3.5, 1.6, 3.6); c.fill(); S("#8a948a", 0.12); ln(x - 1, h + 2, x + 1, h + 5); }); },
  lift(s) {
    const l = G.p - SCENES[G.zi].a + 8; vgrad("#08060e", "#020204"); tile(s, 6, (x, i) => { F("#1a1620"); rect(x, 0, 0.8, 44); F(Math.floor(G.clock * 6 + i) % 3 ? "#3a2a1a" : "#ffcf70"); circ(x, 6, 0.4); c.fill(); });
    const a = clamp((l - 14) / 6, 0, 1) * clamp(1 - (l - 62) / 6, 0, 1);
    if (a > 0) { c.save(); c.globalAlpha = a; c.fillStyle = grad(0, 0, 0, 44, [[0, "#070b2a"], [0.6, "#3a2064"], [1, "#b04880"]]); rect(0, 0, W, 50); F("#fff"); for (let i = 0; i < 50; i++) { circ(((hash(i) * 150 - s * 0.05) % 100 + 100) % 100, hash(i + 40) * 26, 0.12 + hash(i + 7) * 0.14); c.fill(); } F("#fff4d0"); circ(70, 11, 5); c.fill(); F("#0a0618"); tile(s * 0.6, 7, (x, i) => { const h = 5 + hash(i * 1.7) * 14; rect(x, 44 - h, 6, h); }); F("#ffd060"); tile(s * 0.6, 7, (x, i) => { const h = 5 + hash(i * 1.7) * 14; for (let k = 0; k < 3; k++) if (hash(i * 9 + k) > 0.5) rect(x + 1 + (k % 2) * 2.4, 44 - h + 2 + k * 2.6, 1, 1); }); c.restore(); }
  },
  tent(s) { vgrad("#3a0c04", "#160302"); tile(s, 9, (x, i) => { F(i % 2 ? "#a03a10" : "#2a0a04"); c.save(); c.globalAlpha = 0.5; rect(x, 0, 4.5, 40); c.restore(); }); c.save(); c.globalAlpha = 0.5; F("#0a0402"); tile(s, 20, (x, i) => { ell(x + 8, 6 + hash(i) * 5, 12, 4); c.fill(); }); c.restore(); tile(s, 7, (x, i) => { flames(x + 3, 42, 2.4 + hash(i) * 1.4); }); glow(48, 40, 60, "rgba(255,110,20,0.25)"); },
};

function setEntry() {
  // gate, ropes and the grinning doors
  const x = XS(42); if (x < -22 || x > W + 22) return;
  for (let i = 0; i < 4; i++) { const px = XS(4 + i * 5); S("#8a0f16", 0.15); if (i) ln(px - 5, STAGE - 3, px, STAGE - 3); F("#c9a24a"); rect(px - 0.2, STAGE - 4, 0.4, 4); circ(px, STAGE - 4.2, 0.5); c.fill(); }
  F("#1a0c0c"); rr(x - 11, 6, 22, 34, 1); c.fill(); F("#2a1010"); rr(x - 10, 8, 20, 32, 1); c.fill();
  const d = G.doorOpen;
  if (d > 0) { c.fillStyle = grad(x, 8, x, 40, [[0, "#050102"], [1, "#5a0a12"]]); rect(x - 8.4, 10, 16.8, 30); c.save(); c.globalAlpha = Math.max(0, 1 - d) * 0.8; F("#ffd0a0"); rect(x - 8.4, 10, 16.8, 30); c.restore(); if (Math.sin(G.clock * 17) > 0.5 && d > 0.6) glow(x, 30, 14, "rgba(255,255,255,0.18)"); }
  const pw = 8.4 * (1 - d * 0.88);
  for (const s of [-1, 1]) {
    c.save(); c.translate(x + s * 8.4, 0); c.scale(s, 1);
    F("#6e1620"); rect(-pw, 10, pw, 30); F("#4a0c14"); rect(-pw, 10, pw, 1.4); S("#c9a24a", 0.14); c.strokeRect(-pw + 0.5, 12, pw - 1, 27);
    F("#c9a24a"); for (let k = 0; k < 4; k++) { circ(-pw + 1, 14 + k * 7, 0.3); c.fill(); }
    if (pw > 3) { F("#f0e8d0"); circ(-pw * 0.55, 21, 2.2); c.fill(); F("#101010"); circ(-pw * 0.55 + 0.3, 21.2, 0.9); c.fill(); S("#101010", 0.3); c.beginPath(); c.arc(-pw * 0.4, 28, 3.4, 0.2, Math.PI - 0.2); c.stroke(); }
    c.restore();
  }
  F("#101010"); rr(x - 12, 1.4, 24, 6, 0.6); c.fill(); F("#8a0f16"); rr(x - 11.4, 2, 22.8, 4.8, 0.5); c.fill();
  txt("HOUSE OF", x, 3.6, 1.7, "#ffcf70"); txt("A THOUSAND SCREAMS", x, 5.6, 1.6, "#fff0c0");
  for (let i = 0; i < 12; i++) { const bx = x - 11.5 + i * 2.1; F(Math.floor(G.clock * 4 + i) % 2 ? "#ffcf70" : "#5a3a18"); circ(bx, 1.1, 0.3); c.fill(); }
  // blood running down the doors
  S("#9c0b14", 0.3); const bl = d < 0.1 ? 1 : 0; if (bl) { ln(x - 3, 10, x - 3, 15 + Math.sin(G.clock) * 0.5); ln(x + 4, 10, x + 4, 17); }
}

function waxStations(f) { for (let l = 14; l <= 174; l += 14) f(l, XS(l)); }

function setWax() {
  waxStations((l, x) => { if (x < -8 || x > W + 8) return; c.save(); c.globalAlpha = 0.14; F("#ffe8c0"); poly([[x - 1, 0], [x + 1, 0], [x + 6, STAGE], [x - 6, STAGE]]); c.fill(); c.restore(); F("#3a1a2a"); rr(x - 3.6, STAGE - 1.5, 7.2, 1.5, 0.3); c.fill(); F("#c9a24a"); rect(x - 3.6, STAGE - 1.5, 7.2, 0.3); F("#e8d8a0"); rect(x - 1, STAGE - 0.9, 2, 0.4); });
}

function setWaxF() {
  for (let l = 6; l <= 190; l += 10) { const x = XS(l), x2 = XS(l + 10); if (x2 < -4 || x > W + 4) continue; F("#c9a24a"); rect(x - 0.25, STAGE - 4.2, 0.5, 4.2); circ(x, STAGE - 4.4, 0.55); c.fill(); S("#8a1020", 0.3); c.beginPath(); c.moveTo(x, STAGE - 3.8); c.quadraticCurveTo((x + x2) / 2, STAGE - 2.2, x2, STAGE - 3.8); c.stroke(); }
}

function setTorture() {
  for (const l of [66, 112]) { const x = XS(l); if (x < -12 || x > W + 12) continue; F("#4a2e14"); rect(x - 9, STAGE - 5.4, 18, 1.1); rect(x - 8.5, STAGE - 4.3, 1, 4.3); rect(x + 7.5, STAGE - 4.3, 1, 4.3); F("#3a2410"); circ(x - 9, STAGE - 5, 1.2); c.fill(); circ(x + 9, STAGE - 5, 1.2); c.fill(); F("#8a7a70"); ell(x, STAGE - 6.4, 7, 1.1); c.fill(); circ(x - 7.6, STAGE - 6.6, 1.1); c.fill(); S("#8a7a70", 0.5); ln(x - 7, STAGE - 6.2, x - 10, STAGE - 8); ln(x + 7, STAGE - 6.2, x + 10, STAGE - 4.5); F("#8a0f16"); ell(x + 1, STAGE - 6.2, 2, 0.6); c.fill(); }
  { const x = XS(142); if (x > -14 && x < W + 14) { S("#4a2e14", 1); circ(x, STAGE - 11, 9); c.stroke(); S("#4a2e14", 0.6); for (let i = 0; i < 4; i++) { const a = i * 0.785 + G.clock * 0.1; ln(x + Math.cos(a) * 9, STAGE - 11 + Math.sin(a) * 9, x - Math.cos(a) * 9, STAGE - 11 - Math.sin(a) * 9); } F("#8a7a70"); ell(x, STAGE - 11, 3, 1); c.fill(); F("#8a0f16"); circ(x + 6, STAGE - 15, 1.2); c.fill(); S("#4a2e14", 1); ln(x - 6, STAGE, x - 3, STAGE - 6); ln(x + 6, STAGE, x + 3, STAGE - 6); } }
  c.save(); c.globalAlpha = 0.5; F("#5a0a10"); for (const l of [30, 90, 130, 170]) ell(XS(l), STAGE + 0.8, 5, 0.9), c.fill(); c.restore();
}

function carouselCx() { return XS(95); }

function carouselHorse(i, front) {
  const th = i * TAU / 6 + G.clock * 0.9, sn = Math.sin(th); if ((sn >= 0) !== front) return;
  const x = carouselCx() + 26 * Math.cos(th), sc = 0.62 + 0.38 * (sn + 1) / 2 + 0.1, bob = Math.sin(G.clock * 3 + i) * 1.2;
  beast({ t: "horse", x, y: STAGE - 1 - bob * 0.5 - (sn < 0 ? 0 : 0), s: sc, a: G.clock, arm: 0, hurt: false });
}

function setCarousel() {
  const cx = carouselCx(); if (cx < -50 || cx > W + 50) return;
  F("#3a1a2a"); ell(cx, STAGE - 0.4, 33, 2.6); c.fill(); F("#6a1a3a"); ell(cx, STAGE - 1.2, 31, 2.2); c.fill(); F("#c9a24a"); ell(cx, STAGE - 1.2, 31, 0.5); c.fill();
  S("#c9a24a", 0.6); ln(cx, 9, cx, STAGE - 1); for (const i of [1, 3, 5]) carouselHorse(i, false);
  F("#2a0a1a"); poly([[cx - 36, 12], [cx + 36, 12], [cx + 28, 5], [cx - 28, 5]]); c.fill(); for (let i = 0; i < 12; i++) { F(i % 2 ? "#e8d8b0" : "#a02050"); poly([[cx - 36 + i * 6, 12], [cx - 30 + i * 6, 12], [cx - 28 + i * 4.67, 5]]); c.fill(); }
  F("#c9a24a"); rect(cx - 36, 12, 72, 0.8); for (let i = 0; i < 13; i++) { F(Math.floor(G.clock * 6 + i) % 2 ? "#ffcf70" : "#6a4a20"); circ(cx - 36 + i * 6, 13.4, 0.4); c.fill(); }
  F("#a02050"); poly([[cx - 2, 5], [cx + 2, 5], [cx, 1.5]]); c.fill();
}

function setCarouselF() {
  const cx = carouselCx(); if (cx < -50 || cx > W + 50) return;
  for (const i of [0, 2, 4]) { /* the orbiting horses are ents */ }
  for (const i of [1, 3, 5]) carouselHorse(i, true);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + G.clock * 0.9, x = cx + 33 * Math.cos(a), sn = Math.sin(a); if (sn > 0) { S("#c9a24a", 0.35); ln(x, 12, x, STAGE - 1); } }
  F("#2a1020"); ell(cx, STAGE + 0.7, 33, 0.5); c.fill();
}

function setMirrors() {
  for (let l = 6; l < 180; l += 24) { const x = XS(l); if (x < -14 || x > W + 14) continue; c.save(); c.globalAlpha = 0.5; c.fillStyle = grad(x, 4, x + 11, 40, [[0, "#1c3a50"], [0.5, "#3a6a8a"], [1, "#12242e"]]); rr(x, 4, 11, 36, 0.5); c.fill(); S("#c9a24a", 0.3); c.stroke(); c.restore(); }
  c.save(); c.globalAlpha = 0.2; for (let l = 0; l < 180; l += 6) { const x = XS(l); F((l / 6) % 2 ? "#e8f4ff" : "#0a1a26"); rect(x, STAGE - 0.4, 6, 0.9); } c.restore();
}

function waterRows(sc) {
  c.fillStyle = grad(0, STAGE, 0, FLOOR + 2, [[0, "#06121a"], [0.35, "#0c2a3a"], [1, "#030a10"]]); rect(0, STAGE, W, 12);
  F("#1a0a2a"); rect(0, STAGE, W, 0.5);
  for (let r = 0; r < 6; r++) { c.save(); c.globalAlpha = 0.2; S(r % 2 ? "#6ad8ff" : "#ff7ac0", 0.12); c.beginPath(); for (let x = 0; x <= W; x += 2) { const y = STAGE + 1.5 + r * 1.2 + Math.sin(x * 0.5 + G.clock * 2 + r + G.p * 0.8) * 0.25; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); c.restore(); }
  tile(G.p, 5, (x) => { F("#ff7ac0"); c.save(); c.globalAlpha = 0.35; circ(x + CAR_X, STAGE + 1.1, 0.28); c.fill(); c.restore(); glow(x + CAR_X, STAGE + 1.1, 3, "rgba(255,120,190,0.25)"); });
}

function setTunnel() {
  for (const l of [30, 70, 90, 114]) { const x = XS(l); if (x < -10 || x > W + 10) continue; F("#fff"); ell(x, STAGE + 0.5, 7, 1.7); c.fill(); }
}

function setTunnelF() {
  // swan boats in front of the passengers, and the water's lip
  for (const [l, v] of [[32, 1], [72, 1], [90, 0], [116, 1]]) {
    const x = XS(l); if (x < -12 || x > W + 12) continue; const bob = Math.sin(G.clock * 1.6 + l) * 0.3;
    F("#f4f0f4"); c.beginPath(); c.moveTo(x - 7.5, STAGE - 3 + bob); c.quadraticCurveTo(x - 7, STAGE + 1.4, x - 3, STAGE + 1.8); c.lineTo(x + 5, STAGE + 1.8); c.quadraticCurveTo(x + 8, STAGE + 1, x + 8.5, STAGE - 4 + bob); c.lineTo(x + 6.5, STAGE - 2.4 + bob); c.lineTo(x - 5.6, STAGE - 2.2 + bob); c.closePath(); c.fill(); S("#c0b8c4", 0.15); c.stroke();
    F("#e8c0d8"); rect(x - 5.5, STAGE - 2.4 + bob, 12, 0.7); F("#ff7ac0"); poly([[x - 1, STAGE - 1.6 + bob], [x + 1, STAGE - 1.6 + bob], [x, STAGE - 0.4 + bob]]); c.fill();
    S("#f4f0f4", 0.9); c.beginPath(); c.moveTo(x - 7, STAGE - 3 + bob); c.quadraticCurveTo(x - 10, STAGE - 8 + bob, x - 8.2, STAGE - 9.6 + bob); c.stroke(); F("#f4f0f4"); circ(x - 8, STAGE - 9.8 + bob, 0.9); c.fill(); F("#c8661a"); poly([[x - 8.7, STAGE - 9.8 + bob], [x - 10.4, STAGE - 9.4 + bob], [x - 8.7, STAGE - 9.2 + bob]]); c.fill(); F("#a0121c"); circ(x - 8.3, STAGE - 10 + bob, 0.18); c.fill();
  }
  c.save(); c.globalAlpha = 0.55; F("#0c2a3a"); rect(0, STAGE + 0.2, W, 1.2); c.restore();
}

function setWeb() {
  for (const l of [20, 46, 82, 118, 160]) { const x = XS(l); if (x < -10 || x > W + 10) continue; S("rgba(230,235,230,0.4)", 0.14); ln(x, 0, x, 14 + (l % 7)); F("#c8cfc4"); ell(x, 19 + (l % 7), 2.3, 5.4); c.fill(); S("#8a948a", 0.12); ln(x - 1.8, 16, x + 1.8, 20); ln(x - 1.8, 21, x + 1.8, 25); F("#d8d0b8"); ell(x + 2.2, 24, 0.8, 0.4); c.fill(); }
}

function setTent() {
  for (const l of [20, 76, 130, 186]) { const x = XS(l); if (x < -8 || x > W + 8) continue; F("#2a1408"); rect(x - 1, 0, 2, STAGE); flames(x, STAGE, 2.4); flames(x, STAGE - 14, 1.6); flames(x, STAGE - 26, 1.2); }
  for (let l = 0; l < 220; l += 8) { const x = XS(l); if (x < -8 || x > W + 8) continue; F("#1a0a06"); const h = 6 + hash(l * 1.3) * 5; rect(x, STAGE - h, 5, h); F("#c43030"); ell(x + 2.5, STAGE - h, 2.2, 0.8); c.fill(); }
  c.save(); c.globalAlpha = 0.35; F("#ff8a20"); for (let l = 0; l < 220; l += 12) { const x = XS(l); if (x < -10 || x > W + 10) continue; flames(x + 3, STAGE + 0.5, 2.2); } c.restore();
}

function setExit() {
  const st = G.st.exit || {}, turned = st.turned;
  { const x = XS(56); if (x > -30 && x < W + 30) { F(turned ? "#1a0408" : "#0a3a1a"); rr(x - 12, 6, 24, 9, 0.8); c.fill(); const on = !turned || Math.sin(G.clock * 25) > -0.4; txt(turned ? "NO EXIT" : "EXIT", x, 10.8, 6, on ? (turned ? "#ff2a2a" : "#6aff8a") : "#300"); F(turned ? "#8a0f16" : "#3ae06a"); poly([[x + 8, 18], [x + 14, 18], [x + 14, 16], [x + 18, 20], [x + 14, 24], [x + 14, 22], [x + 8, 22]]); c.fill(); if (turned) { S("#8a0f16", 0.4); ln(x - 6, 15, x - 6, 22); ln(x + 4, 15, x + 4, 19); } } }
  { const x = XS(24); if (x > -30 && x < W + 30) { F("#f4a0c0"); rr(x - 14, 7, 28, 4, 0.8); c.fill(); txt("THANK YOU FOR RIDING!", x, 9.1, 2.2, turned ? "#600" : "#fff"); } }
  for (let l = 10; l < 100; l += 14) { const x = XS(l); if (x < -6 || x > W + 6) continue; const col = ["#ff3d9a", "#ffcf40", "#38e8ff", "#8dff4a"][Math.floor(l / 14) % 4], by = 14 + Math.sin(G.clock + l) * 1.2; S("#ddd", 0.08); ln(x, by + 3, x, STAGE - 2); F(turned ? "#6a0a10" : col); ell(x, by, 1.8, 2.3); c.fill(); }
  { const x = XS(40); if (x > -22 && x < W + 22) { F("#4a3a5a"); rect(x - 16, STAGE - 14, 32, 14); F("#d8c8a8"); rect(x - 15, STAGE - 13, 30, 0.6); txt("GIFT SHOP", x, STAGE - 15.4, 2, "#ffcf70"); for (let i = 0; i < 5; i++) { F(["#ff3d9a", "#8dff4a", "#ffcf40"][i % 3]); rect(x - 13 + i * 6, STAGE - 9, 4, 3); F("#e8d8a8"); circ(x - 11 + i * 6, STAGE - 10, 0.9); c.fill(); if (turned && i % 2) { F("#8a0f16"); circ(x - 11 + i * 6, STAGE - 9.8, 0.4); c.fill(); } } } }
  if (st.gate) { const x = XS(78), p = clamp(st.gate / 0.35, 0, 1); if (x > -30) { F("#2a2c34"); rect(x - 14, 0, 28, STAGE * p + 0.01); S("#14161c", 0.2); for (let y = 2; y < STAGE * p; y += 3) ln(x - 14, y, x + 14, y); F("#8a0f16"); rect(x - 8, STAGE * p - 3, 16, 0.5); if (p >= 1) txt("CLOSED", x, STAGE - 14, 2.6, "#c43030"); } }
}

function setFinale2() {
  const a = XS(600), b = XS(660); if (b < -4 || a > W + 4) return;
  const ex = XS(652); F("#07020a"); rect(ex, 0, 12, STAGE);
  for (let i = 0; i < 6; i++) { const nx = XS(560 + i * 14); if (nx < -8 || nx > W + 8) continue; F("#1c0a2c"); rect(nx - 0.6, 0, 1.2, STAGE); S("#ff3d9a", 0.25); ln(nx, 2, nx, 36); F(Math.floor(G.clock * 4 + i) % 2 ? "#ff3d9a" : "#38e8ff"); circ(nx, 2, 0.6); c.fill(); }
}

function aisleBase(zc) {
  c.fillStyle = grad(0, STAGE, 0, FLOOR + 2, [[0, "#000"], [0.04, zc[0]], [0.18, zc[1]], [1, "#050305"]]); rect(0, STAGE, W, 12);
  F(zc[0]); rect(0, STAGE, W, 0.6);
  tile(G.p, 5, (x) => { const px = x + CAR_X; F("#ffd78a"); circ(px, STAGE + 1.1, 0.28); c.fill(); glow(px, STAGE + 1.1, 3, "rgba(255,190,90,0.35)"); });
}

export function aisle() {
  const sc = SCENES[G.zi];
  if (AISLE[sc.id]) AISLE[sc.id](sc); else aisleBase(sc.floor || ["#2a1a10", "#0c0608"]);
  tile(G.p, 2.2, (x) => { F("#2a1c12"); rect(x + CAR_X - 0.5, FLOOR + 0.9, 1.5, 0.7); });
  F("#6a7080"); rect(0, FLOOR + 0.2, W, 0.45); F("#14161c"); rect(0, FLOOR + 0.65, W, 0.4);
}

export function drawNear() {
  const k = 1.7, s = G.p * k;
  tile(s, 52, (x, i) => {
    const px = x + 14;
    if (hash(i * 4.1) > 0.15) { c.save(); c.globalAlpha = 0.92; F("#0a0608"); rect(px, 0, 1.8, 49); F("#1a1214"); rect(px, 0, 0.5, 49); c.restore(); }
  });
  tile(s, 31, (x, i) => {
    const h = hash(i * 7.7), px = x + 6, sw = Math.sin(G.clock * 1.3 + i) * 0.6;
    if (h > 0.4) { S("#d8d8e0", 0.08); c.globalAlpha = 0.45; for (let r = 0; r < 4; r++) { c.beginPath(); c.moveTo(px, 0); c.quadraticCurveTo(px + 3 + r * 1.6, 4 + r, px + 7 + r * 1.2 + sw, 6 + r * 2.2); c.stroke(); } for (let r = 1; r < 4; r++) { c.beginPath(); c.arc(px, 0, r * 2.2, 0.2, 1.4); c.stroke(); } c.globalAlpha = 1; }
    else { S("#0a0608", 0.3); ln(px, 0, px + sw, 8 + h * 10); F("#6a5a52"); circ(px + sw, 8.4 + h * 10, 0.7); c.fill(); S("#6a5a52", 0.2); ln(px + sw, 8.4 + h * 10, px + sw + 0.4, 10.6 + h * 10); }
  });
  // drips from the ceiling
  c.fillStyle = "#9c0b14"; for (let i = 0; i < 4; i++) { const t = (G.clock * 0.6 + i * 0.27) % 1, dx = (hash(i + Math.floor(G.clock * 0.6 + i * 0.27)) * 80 + 8); circ(dx, t * 30, 0.2); c.fill(); }
}

/* ---- the table: what each room draws, keyed by the room's id ---- */
// The far wall of the Barker's room turns into the exit's sky near its end.
function farBarker(s) {
  const l = G.p - SCENES[G.zi].a + 18;
  FAR[7](s);
  if (l > 106) {
    c.save();
    c.globalAlpha = clamp((l - 106) / 12, 0, 1);
    FAR[8](s);
    c.restore();
  }
}
export const FAR_OF = {
  bay: (s) => FAR[0](s),
  wax: (s) => FARV2.wax(s),
  torture: (s) => FARV2.torture(s),
  carousel: (s) => FARV2.carousel(s),
  mirrors: (s) => FARV2.mirrors(s),
  tunnel: (s) => FARV2.tunnel(s),
  web: (s) => FARV2.web(s),
  lift: (s) => FARV2.lift(s),
  tent: (s) => FARV2.tent(s),
  exit: (s) => FAR[8](s),
  dark: (s) => FAR[6](s),
  barker: farBarker,
};
export const BACK = { bay: setEntry, wax: setWax, torture: setTorture, carousel: setCarousel, mirrors: setMirrors, tunnel: setTunnel, web: setWeb, tent: setTent, exit: setExit, barker: setFinale2 };
export const FRONT = { wax: setWaxF, carousel: setCarouselF, tunnel: setTunnelF };
export const OVER = {
  tent: () => {
    F("rgba(255,90,20,0.11)");
    rect(0, 0, W, 50);
  },
};
export const AISLE = { tunnel: waterRows };

// The far wall of the room the car is in, and the next room's fading in before the door.
export function drawFar() {
  const sc = SCENES[G.zi];
  const s = G.p * 0.4;
  FAR_OF[sc.id](s);
  const nx = SCENES[G.zi + 1];
  if (nx && G.p > nx.a - 12) {
    c.save();
    c.globalAlpha = clamp((G.p - (nx.a - 12)) / 12, 0, 1);
    FAR_OF[nx.id](s);
    c.restore();
  }
}
// Every room's set that is on the screen: the back ones behind the entities, the front ones over them.
export function drawSets(front) {
  const table = front ? FRONT : BACK;
  for (const s of SCENES) {
    const f = table[s.id];
    if (f && X(s.a) < W + 2 && X(s.a + s.len) > -2) {
      setSH(s.sh);
      f();
    }
  }
  setSH(0);
}
// The room's tint over everything (the Big Top's glow), if it has one.
export function drawOver() {
  const f = OVER[SCENES[G.zi].id];
  if (f) f();
}

