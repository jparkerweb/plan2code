// Plan2Code Web Console - Ghoul Rush's Drowned Lantern, its drawing: Gallows Bog's bonus round seen from above, a black island of mossy hummocks and plank walks round Old Mother Bog's pool, lit by Planny's lantern. The whole field is drawn by this room's own art (`field`) the way Holy Roller's is (ghoul-pew-draw.js); the hearts, the flash, the banner and the cards go over it as they do there.
//
// ghoul-draw.js plugs it in. LOOKS, VOICES, EVENT_VOICE, LOSE_WORDS, LOSE_SOUNDS and TAGS are plain data (the voices
// are the room's own tones, in ghoul-sfx-lantern.js); lanternArt(d) takes ghoul-draw.js's drawing helpers (`d`) and
// hands back the pack the usual way plus `field`, so this file never reaches back into it (it reads only the rules'
// numbers from ghoul-lantern.js). Drawn in field units with y counted DOWN from the field's top, the rules' own
// coordinates; the events leave short-lived bits in the view's `fx`, whose effect makers count y UP from the bottom
// (so they are handed FIELD_H - y). NO random numbers: everything comes from a hash and the clock.
//
// THE DARK NEVER HIDES A DECISION: the night is one layer with a hole for each light, but the island's moonlit
// edges, the shrines' flames, the wisps, the Lurker's eyes and its lane, the leeches' eyes at the edge of the light,
// the bodies' bubbles and reach, and Mother's shadow are all drawn over it. The ring round Planny is the light's
// real edge (the leeches' line), and it reddens as the oil runs low.
//
// What the art reads (see ghoul-lantern.js): `spec.ride`, `round.runner` (id "lantern"), `round.you.safeMs`,
// `round.timeMs`, and the view's `fx.lanternTags` (a hunter's rule, shown once when it is first met).

import { BODY_NOTICE, BODY_REACH, BODY_RISE_MS, BODY_UP_MS, DASH_HIT, FLARE_MS, FLARE_OIL, FLARE_R, HAND_LOCK_MS, HAND_R, OIL_LOW, PLANK_HALF, RISE_MS, SHRINE_LIGHT, SHRINE_MS, SHRINES, geomOf, lightOf } from "./ghoul-lantern.js";

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

const look = (o) => freeze({ pack: "lantern", custom: true, noMoon: true, pit: "#010304", ...o });
export const LOOKS = freeze({
  lantern: look({ wallTop: "#03080a", wallLow: "#06100f", paper: "#0b1a18", wainscot: "#08120f", floorTop: "#26382c", floor: "#16221a", floorEdge: "#050a08", shelf: "#2a2a20", shelfTop: "#4a4a38", window: "#c8e8d8", decor: "plants", color: "#e8c870", dark: 0.9 }),
});

// How each new kind sounds, by act (the room's own tones, ghoul-sfx-lantern.js).
export const VOICES = freeze({
  lantern: freeze({
    step: "ghoulLanternStep", flare: "ghoulLanternFlare", sputter: "ghoulLanternSputter", shrine: "ghoulLanternShrine", gutter: "ghoulLanternGutter",
    catch: "ghoulLanternCatch", finish: "ghoulLanternFinish", meet: "ghoulLanternMeet", close: "ghoulLanternClose",
  }),
  lanternpop: freeze({ pop: "ghoulLanternPop" }),
  lanternhunter: freeze({ lurker: "ghoulLanternLurker", aim: "ghoulLanternAim", dash: "ghoulLanternDash", leech: "ghoulLanternLeech", wisp: "ghoulLanternWisp", body: "ghoulLanternBody" }),
  lanternmother: freeze({ wake: "ghoulLanternWake", rise: "ghoulLanternRise", hand: "ghoulLanternHand", slam: "ghoulLanternSlam" }),
});

// What each of the pack's events plays: [kind, act], once.
export const EVENT_VOICE = freeze({
  lanternStep: ["lantern", "step"],
  lanternFlare: ["lantern", "flare"],
  lanternSputter: ["lantern", "sputter"],
  lanternPop: ["lanternpop", "pop"],
  lanternShrine: ["lantern", "shrine"],
  lanternGutter: ["lantern", "gutter"],
  lanternCatch: ["lantern", "catch"],
  lanternFinish: ["lantern", "finish"],
  lanternMeet: ["lantern", "meet"],
  lanternClose: ["lantern", "close"],
  lanternLurkerCue: ["lanternhunter", "lurker"],
  lanternAim: ["lanternhunter", "aim"],
  lanternDash: ["lanternhunter", "dash"],
  lanternWispCue: ["lanternhunter", "wisp"],
  lanternLeechCue: ["lanternhunter", "leech"],
  lanternBodyCue: ["lanternhunter", "body"],
  lanternWake: ["lanternmother", "wake"],
  lanternRise: ["lanternmother", "rise"],
  lanternHand: ["lanternmother", "hand"],
  lanternSlam: ["lanternmother", "slam"],
});
export const LOSE_WORDS = freeze({ lanternLurker: "Heard and taken", lanternLeech: "Swarmed in the dark", lanternWisp: "Led into the water", lanternBody: "Dragged under", lanternMother: "Mother's hand" });
export const LOSE_SOUNDS = freeze({
  lanternLurker: ["crunch", 0.55, 0.7],
  lanternLeech: ["squish", 0.5, 0.8],
  lanternWisp: ["wail", 0.35, 0.6],
  lanternBody: ["squish", 0.5, 0.6],
  lanternMother: ["crunch", 0.6, 0.5],
});
// Each hunter's rule, shown once over it the first time it comes near: short enough to read at a glance.
export const TAGS = freeze({
  lurker: "It hears steps on wood",
  wisp: "SPACE flare pops wisps",
  leech: "Leeches fear your light",
  body: "Don't stop by the bubbles",
  mother: "Keep moving!",
});
export const TAG_MS = 2800;
// The HUD band across the field's top (the map starts below it).
export const HUD_Y = 4.6;

export function lanternArt(d) {
  const { ellipse, circle, hash, say, label, GOLD, paintDark } = d;
  const runnerOf = (round) => (round && round.runner && round.runner.id === "lantern" ? round.runner : null);
  const noise = (a, b) => hash(a, b) / 997;
  const wave = (p) => ((p % 1) + 1) % 1;

  // The still layers never draw this room (the field is the room's own), so they only get the night.
  function backdrop(ctx, v, lk, x0, x1) {
    ctx.fillStyle = lk.wallLow;
    ctx.fillRect(x0, 0, x1 - x0, v.g.FIELD_H);
  }
  const ground = () => {};
  const shelf = () => {};
  const lights = () => {};
  const dim = () => 0;

  /* ----------------------------------------------------------- the world */

  function water(ctx, v, c, R) {
    const { g, fx } = v;
    ctx.fillStyle = "#041012";
    ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
    // Slow ripples that come and go, each in its own place (a hash), never in step.
    ctx.lineWidth = 0.14;
    ctx.strokeStyle = "#2a5a5e";
    for (let i = 0; i < 34; i++) {
      const p = wave(fx.clock / 2600 + noise(i, 3));
      ctx.globalAlpha = (1 - p) * 0.3;
      ellipse(ctx, 2 + noise(i, 1) * (g.FIELD_W - 4), 8 + noise(i, 2) * (g.FIELD_H - 10), 0.4 + p * 3.2, 0.2 + p * 1.7);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Mother's pool: deeper water that turns slowly, and her eyes under it, opening a fifth for each shrine lit.
    const [px, py] = R.pool;
    ctx.fillStyle = "#020708";
    circle(ctx, px, py, 9);
    ctx.fill();
    ctx.strokeStyle = "#163a34";
    ctx.lineWidth = 0.2;
    for (let k = 0; k < 3; k++) {
      const a = fx.clock / (1800 + k * 500) + k * 2;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(px, py, 3 + k * 2.2, a, a + 2.2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function island(ctx, v, c, R) {
    const geo = geomOf(R);
    // The mud the planks stand in, then the boards.
    ctx.lineCap = "round";
    for (const p of geo.planks) {
      const dx = p.x2 - p.x1;
      const dy = p.y2 - p.y1;
      const len = Math.hypot(dx, dy);
      const nx = -dy / len;
      const ny = dx / len;
      ctx.strokeStyle = "#2a1c10";
      ctx.lineWidth = PLANK_HALF * 2 + 0.5;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      ctx.strokeStyle = "#7a5634";
      ctx.lineWidth = PLANK_HALF * 2 - 0.4;
      ctx.beginPath();
      ctx.moveTo(p.x1, p.y1);
      ctx.lineTo(p.x2, p.y2);
      ctx.stroke();
      // The boards' seams, a rotten gap here and there (by a hash).
      ctx.strokeStyle = "#3a2716";
      ctx.lineWidth = 0.16;
      for (let t = 1.2; t < len; t += 1.5) {
        const px = p.x1 + (dx / len) * t;
        const py = p.y1 + (dy / len) * t;
        ctx.beginPath();
        ctx.moveTo(px + nx * (PLANK_HALF - 0.25), py + ny * (PLANK_HALF - 0.25));
        ctx.lineTo(px - nx * (PLANK_HALF - 0.25), py - ny * (PLANK_HALF - 0.25));
        ctx.stroke();
      }
    }
    ctx.lineCap = "butt";
    // The hummocks: moss, a rim, tufts and knobs of cypress root, each where its hash puts it.
    geo.disks.forEach((s, i) => {
      ctx.fillStyle = "#14261a";
      circle(ctx, s.x, s.y, s.r + 0.5);
      ctx.fill();
      ctx.fillStyle = "#24442b";
      circle(ctx, s.x, s.y, s.r);
      ctx.fill();
      ctx.fillStyle = "#30573a";
      for (let k = 0; k < 7; k++) {
        const a = noise(i * 7 + k, 4) * TAU;
        const r = noise(i * 7 + k, 5) * (s.r - 1);
        ellipse(ctx, s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, 0.9, 0.5);
        ctx.fill();
      }
      ctx.fillStyle = "#4a3a24";
      for (let k = 0; k < 3; k++) {
        const a = noise(i * 5 + k, 8) * TAU;
        circle(ctx, s.x + Math.cos(a) * (s.r - 0.6), s.y + Math.sin(a) * (s.r - 0.6), 0.45);
        ctx.fill();
      }
    });
    boat(ctx, v, c, R);
  }

  // The rowboat at the landing: the way in, and (once the five are lit) the way out.
  function boat(ctx, v, c, R) {
    const [bx, by] = R.boat;
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(-Math.PI / 2 + 0.12 * Math.sin(v.fx.clock / 900));
    ctx.fillStyle = "#3a2716";
    ellipse(ctx, 0, 0, 3.6, 1.7);
    ctx.fill();
    ctx.fillStyle = "#6a4a2c";
    ellipse(ctx, 0, 0, 3, 1.15);
    ctx.fill();
    ctx.fillStyle = "#3a2716";
    ctx.fillRect(-0.3, -1.1, 0.6, 2.2);
    ctx.restore();
  }

  // What the light shows, under the dark: the leeches' bodies, the bog bodies' shapes in the water.
  function under(ctx, v, c) {
    for (const B of c.bodies) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#1c3a34";
      ellipse(ctx, B.x, B.y, 1.4, 2.4, 0.3);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    c.leeches.forEach((S, i) => swarm(ctx, v, S, i, 1));
  }

  function swarm(ctx, v, S, i, alpha) {
    const t = v.fx.clock / 140;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#16240f";
    for (let k = 0; k < 11; k++) {
      const a = noise(i * 13 + k, 6) * TAU + Math.sin(t + k) * 0.5;
      const r = 0.4 + noise(i * 13 + k, 7) * 1.8;
      ellipse(ctx, S.x + Math.cos(a) * r, S.y + Math.sin(a) * r, 0.6, 0.22, a);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- the dark */

  // Every light of the moment as [x, y, r, strength] for the dark layer to leave a hole for.
  function holes(v, c, R) {
    const out = [];
    const r = lightOf(c);
    out.push([c.x, c.y, r * 1.35, c.gutter ? 0.5 : 1]);
    if (c.flare) {
      const k = clamp(c.flare.t / FLARE_MS, 0, 1);
      out.push([c.flare.x, c.flare.y, FLARE_R * (1.8 - 0.4 * k), k]);
    }
    R.shrines.forEach((h, i) => {
      const [hx, hy] = R.hummocks[h];
      const lit = c.shrines[i] >= SHRINE_MS;
      out.push([hx, hy, lit ? SHRINE_LIGHT * 1.3 : 3.6, lit ? 0.9 : 0.5]);
    });
    for (const w of c.wisps) if (alive(w)) out.push([w.x, w.y, 4, 0.5]);
    if (c.mother.risen) out.push([R.pool[0], R.pool[1], 12, 0.35]);
    if (c.lit >= SHRINES) out.push([R.boat[0], R.boat[1], 6, 0.7]);
    return out;
  }
  const alive = (w) => w.state !== "popped" && w.state !== "gone" && w.state !== "asleep";

  /* ------------------------------------------------- over the dark */

  // The island's moonlit edges, so its shape is always there to plan by.
  function edges(ctx, v, R) {
    const geo = geomOf(R);
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = "#7aa898";
    ctx.lineWidth = 0.18;
    for (const p of geo.planks) {
      const dx = p.x2 - p.x1;
      const dy = p.y2 - p.y1;
      const len = Math.hypot(dx, dy);
      const nx = (-dy / len) * PLANK_HALF;
      const ny = (dx / len) * PLANK_HALF;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(p.x1 + nx * s, p.y1 + ny * s);
        ctx.lineTo(p.x2 + nx * s, p.y2 + ny * s);
        ctx.stroke();
      }
    }
    for (const s of geo.disks) {
      circle(ctx, s.x, s.y, s.r);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function shrine(ctx, v, c, R, i) {
    const [hx, hy] = R.hummocks[R.shrines[i]];
    const clock = v.fx.clock;
    const lit = c.shrines[i] >= SHRINE_MS;
    // The stone.
    ctx.fillStyle = "#7a8478";
    circle(ctx, hx, hy, 1.6);
    ctx.fill();
    ctx.strokeStyle = "#2a3028";
    ctx.lineWidth = 0.25;
    ctx.stroke();
    const flick = 0.85 + 0.15 * Math.sin(clock / 90 + i * 2);
    if (lit) {
      ctx.fillStyle = "#ffcf5a";
      ctx.globalAlpha = 0.22;
      circle(ctx, hx, hy, 3.6 * flick);
      ctx.fill();
      ctx.globalAlpha = 1;
      flame(ctx, hx, hy - 0.4, 1.5 * flick, "#ffb347", "#fff0b0");
      return;
    }
    // Unlit: a cold blue flame and a slow beacon ring calling you over.
    const p = wave(clock / 1600 + i * 0.2);
    ctx.strokeStyle = "#8ac8ff";
    ctx.lineWidth = 0.22;
    ctx.globalAlpha = (1 - p) * 0.7;
    circle(ctx, hx, hy, 2 + p * 4);
    ctx.stroke();
    ctx.globalAlpha = 1;
    flame(ctx, hx, hy - 0.3, 1 * flick, "#3a7ad8", "#c8e8ff");
    // The flame taking: a gold ring filling as Planny stands there.
    const k = clamp(c.shrines[i] / SHRINE_MS, 0, 1);
    if (k > 0) {
      ctx.strokeStyle = "#ffd75a";
      ctx.lineWidth = 0.55;
      ctx.beginPath();
      ctx.arc(hx, hy, 2.5, -Math.PI / 2, -Math.PI / 2 + TAU * k);
      ctx.stroke();
    }
  }

  // A teardrop flame standing at (x, y): an outer color and a hot heart.
  function flame(ctx, x, y, s, outer, heart) {
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(x, y - 1.9 * s);
    ctx.quadraticCurveTo(x + 1.1 * s, y - 0.2 * s, x, y + 0.6 * s);
    ctx.quadraticCurveTo(x - 1.1 * s, y - 0.2 * s, x, y - 1.9 * s);
    ctx.fill();
    ctx.fillStyle = heart;
    ellipse(ctx, x, y - 0.1 * s, 0.38 * s, 0.6 * s);
    ctx.fill();
  }

  function wisp(ctx, v, c, w) {
    if (!alive(w)) return;
    const clock = v.fx.clock;
    const i = w.i;
    const bob = Math.sin(clock / 220 + i * 3) * 0.4;
    const angry = w.state === "chase";
    const near = Math.hypot(w.x - c.x, w.y - c.y);
    const hot = angry ? 1 : near < 16 ? 0.7 : 0.45;
    ctx.fillStyle = angry ? "#a8e0ff" : "#5a9ac8";
    for (const [r, a] of [[3.6, 0.08], [2.4, 0.14], [1.6, 0.24]]) {
      ctx.globalAlpha = a * (0.6 + hot * 0.6);
      circle(ctx, w.x, w.y + bob, r * (angry ? 1.15 : 1));
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#eef9ff";
    ellipse(ctx, w.x, w.y + bob, 0.85, 1.15);
    ctx.fill();
    // A face once it comes for you: two hollow eyes and a mouth.
    if (angry) {
      ctx.fillStyle = "#0a2a4a";
      circle(ctx, w.x - 0.32, w.y + bob - 0.25, 0.16);
      ctx.fill();
      circle(ctx, w.x + 0.32, w.y + bob - 0.25, 0.16);
      ctx.fill();
      ellipse(ctx, w.x, w.y + bob + 0.4, 0.2, 0.28);
      ctx.fill();
    }
    // A trailing wisp of smoke.
    ctx.strokeStyle = "#7ab8e0";
    ctx.lineWidth = 0.18;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(w.x, w.y + bob + 1);
    ctx.quadraticCurveTo(w.x + Math.sin(clock / 300 + i) * 1.4, w.y + 2.4, w.x + Math.sin(clock / 260 + i) * 0.9, w.y + 3.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The leeches over the dark: a writhing ring of small eyes at the light's edge (bright when they stalk you).
  function leechEyes(ctx, v, c, S, i) {
    const d = Math.hypot(S.x - c.x, S.y - c.y);
    if (S.state === "drift" && d > 30) return;
    const a = S.state === "drift" ? 0.35 : S.state === "scatter" ? 0.45 : 0.95;
    swarm(ctx, v, S, i, a * 0.75);
    const t = v.fx.clock / 300;
    for (let k = 0; k < 5; k++) {
      const ang = noise(i * 9 + k, 11) * TAU + Math.sin(t + k * 1.3) * 0.6;
      const r = 0.6 + noise(i * 9 + k, 12) * 1.5;
      const blink = Math.sin(v.fx.clock / 160 + k * 2.1 + i) > -0.7 ? 1 : 0;
      ctx.globalAlpha = a * blink;
      ctx.fillStyle = S.state === "swarm" ? "#ff5040" : "#d8e05a";
      circle(ctx, S.x + Math.cos(ang) * r, S.y + Math.sin(ang) * r, 0.17);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // A bog body: bubbles always (so you know where one lies), boiling as it rises, its reach ringed red, then the hand.
  function body(ctx, v, c, B, i) {
    const clock = v.fx.clock;
    const boil = B.state === "rise" || B.state === "up";
    const rate = boil ? 380 : 1500;
    ctx.strokeStyle = boil ? "#b8e0c8" : "#7ab8a0";
    ctx.lineWidth = boil ? 0.16 : 0.2;
    for (let k = 0; k < (boil ? 5 : 3); k++) {
      const p = wave(clock / rate + noise(i, k));
      ctx.globalAlpha = (1 - p) * (boil ? 0.9 : 0.7);
      circle(ctx, B.x + (noise(i * 3 + k, 2) - 0.5) * 2.2, B.y + (noise(i * 3 + k, 3) - 0.5) * 1.6 - p * 0.8, 0.2 + p * 0.5);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Asleep with Planny near: the ground where standing still would wake it, faintly.
    const near = Math.hypot(B.x - c.x, B.y - c.y);
    if (B.state === "sunk" && near < BODY_NOTICE + 8) {
      ctx.globalAlpha = 0.45 * clamp((BODY_NOTICE + 8 - near) / 6, 0, 1) * (B.t > 0 ? 1.8 : 1);
      ctx.strokeStyle = "#ff8a6a";
      ctx.lineWidth = 0.18;
      ctx.setLineDash && ctx.setLineDash([0.6, 0.9]);
      circle(ctx, B.x, B.y, BODY_NOTICE);
      ctx.stroke();
      ctx.setLineDash && ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (B.state === "rise") {
      const k = 1 - B.t / BODY_RISE_MS;
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ctx.strokeStyle = "#ff5a4a";
      ctx.lineWidth = 0.3;
      ctx.setLineDash && ctx.setLineDash([0.8, 0.6]);
      circle(ctx, B.x, B.y, BODY_REACH);
      ctx.stroke();
      ctx.setLineDash && ctx.setLineDash([]);
      ctx.globalAlpha = 0.18 * k;
      ctx.fillStyle = "#ff5a4a";
      circle(ctx, B.x, B.y, BODY_REACH);
      ctx.fill();
      ctx.globalAlpha = 1;
      hand(ctx, B.x, B.y, k * 0.4, 0.8);
    } else if (B.state === "up") {
      const k = clamp(B.t / BODY_UP_MS, 0, 1);
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = "#ff5a4a";
      circle(ctx, B.x, B.y, BODY_REACH);
      ctx.fill();
      ctx.globalAlpha = 1;
      hand(ctx, B.x, B.y, 0.6 + 0.4 * k, 1);
    } else if (B.state === "rest") {
      hand(ctx, B.x, B.y, 0.25, 0.5);
    }
  }

  // A pale, bony hand clawing up out of the water, `k` 0 to 1 of the way.
  function hand(ctx, x, y, k, alpha) {
    const h = 3.8 * k;
    ctx.globalAlpha = 0.95 * alpha;
    ctx.strokeStyle = "#cfdcc8";
    ctx.lineWidth = 0.7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - h);
    ctx.stroke();
    ctx.lineWidth = 0.3;
    for (let f = -2; f <= 2; f++) {
      ctx.beginPath();
      ctx.moveTo(x, y - h);
      ctx.lineTo(x + f * 0.5 * k, y - h - (1.2 - Math.abs(f) * 0.2) * k);
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    ctx.globalAlpha = 1;
  }

  // The Bog Lurker: always its eyes and wake (so you can always find it); its lane when it lines up; its jaws in the dash.
  function lurker(ctx, v, c) {
    const L = c.lurker;
    const clock = v.fx.clock;
    const heading = L.state === "aim" || L.state === "dash" ? Math.atan2(L.by - L.ay, L.bx - L.ax) : L.state === "hunt" ? Math.atan2(L.ty - L.y, L.tx - L.x) : Math.atan2(c.y - L.y, c.x - L.x);
    if (L.state === "aim") {
      // The lane, a red band through the spot it heard you, chevrons running down it: get off it.
      const k = 1 - L.t / 800;
      const len = Math.hypot(L.bx - L.ax, L.by - L.ay);
      ctx.save();
      ctx.translate(L.ax, L.ay);
      ctx.rotate(heading);
      ctx.globalAlpha = 0.16 + 0.22 * k;
      ctx.fillStyle = "#ff3a2a";
      ctx.fillRect(0, -DASH_HIT, len, DASH_HIT * 2);
      ctx.globalAlpha = 0.5 + 0.4 * k;
      ctx.strokeStyle = "#ff6a4a";
      ctx.lineWidth = 0.22;
      ctx.strokeRect(0, -DASH_HIT, len, DASH_HIT * 2);
      ctx.lineWidth = 0.35;
      for (let t = wave(clock / 300) * 3; t < len - 1; t += 3) {
        ctx.beginPath();
        ctx.moveTo(t, -1.2);
        ctx.lineTo(t + 1.1, 0);
        ctx.lineTo(t, 1.2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // The wake.
    ctx.strokeStyle = "#9ad0c8";
    ctx.lineWidth = 0.18;
    const p = wave(clock / (L.state === "drift" ? 900 : 450));
    ctx.globalAlpha = (1 - p) * (L.state === "rest" ? 0.2 : 0.55);
    ellipse(ctx, L.x, L.y, 1.2 + p * 3.6, 0.6 + p * 1.6, heading);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (L.state === "dash" || L.state === "aim") {
      // Its back and jaws breaking the water.
      ctx.save();
      ctx.translate(L.x, L.y);
      ctx.rotate(heading);
      ctx.fillStyle = "#14201a";
      ellipse(ctx, -2.2, 0, 4.2, 1.5);
      ctx.fill();
      ctx.fillStyle = "#1e3026";
      for (let s = -3; s < 2; s += 1.1) {
        ctx.beginPath();
        ctx.moveTo(s - 2.2, -0.3);
        ctx.lineTo(s - 1.7, -0.9);
        ctx.lineTo(s - 1.2, -0.3);
        ctx.fill();
      }
      const open = L.state === "dash" ? 0.9 : 0.25 + 0.15 * Math.sin(clock / 60);
      ctx.fillStyle = "#1a2a20";
      ctx.beginPath();
      ctx.moveTo(1.2, 0);
      ctx.lineTo(4, -open);
      ctx.lineTo(4, -open - 0.6);
      ctx.lineTo(0.8, -0.8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(1.2, 0);
      ctx.lineTo(4, open);
      ctx.lineTo(4, open + 0.6);
      ctx.lineTo(0.8, 0.8);
      ctx.fill();
      ctx.fillStyle = "#e8e0c8";
      for (let t = 1.6; t < 4; t += 0.6) {
        circle(ctx, t, -open * ((t - 1.2) / 2.8) - 0.05, 0.1);
        ctx.fill();
        circle(ctx, t, open * ((t - 1.2) / 2.8) + 0.05, 0.1);
        ctx.fill();
      }
      ctx.restore();
    }
    // The eyes: two red points, wide and bright while it hunts, shut while it rests.
    const shut = L.state === "rest" || L.state === "cower";
    const bright = L.state === "drift" ? 0.55 : 1;
    const blink = Math.sin(clock / 700 + 1) > 0.97 ? 0 : 1;
    ctx.fillStyle = "#ff4a2a";
    for (const s of [-1, 1]) {
      const ex = L.x + Math.cos(heading) * 0.9 - Math.sin(heading) * s * 0.75;
      const ey = L.y + Math.sin(heading) * 0.9 + Math.cos(heading) * s * 0.75;
      ctx.globalAlpha = shut ? 0.12 : 0.25 * bright;
      circle(ctx, ex, ey, 1);
      ctx.fill();
      ctx.globalAlpha = shut ? 0.35 : bright;
      if (shut) ellipse(ctx, ex, ey, 0.35, 0.06, heading);
      else circle(ctx, ex, ey, 0.34 * blink + 0.02);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // A "!" while it swims to what it heard, so you know it has you by ear.
    if (L.state === "hunt") {
      label(ctx, "!", L.x, L.y - 2.6, 2.4, "#ff6a4a");
    }
  }

  // Old Mother Bog: before she rises, only her eyes under her pool; then her head; and always her hand's shadow.
  function mother(ctx, v, c, R) {
    const M = c.mother;
    const clock = v.fx.clock;
    const [px, py] = R.pool;
    const up = M.risen ? clamp(1 - M.riseT / RISE_MS, 0, 1) : 0;
    const open = M.risen ? 1 : M.stir / SHRINES;
    if (up > 0) {
      // Her head breaking the pool: a mossy dome hung with weed, two great lamp eyes.
      ctx.globalAlpha = 0.95 * up;
      ctx.fillStyle = "#1a2a1c";
      ellipse(ctx, px, py, 7 * up, 6 * up);
      ctx.fill();
      ctx.strokeStyle = "#2e4a2a";
      ctx.lineWidth = 0.4;
      for (let k = 0; k < 9; k++) {
        const x = px - 6 + k * 1.5;
        ctx.beginPath();
        ctx.moveTo(x, py - 4 * up);
        ctx.quadraticCurveTo(x + Math.sin(clock / 400 + k) * 0.8, py + 1, x + Math.sin(clock / 300 + k) * 0.6, py + 5 * up);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (open > 0) {
      for (const s of [-1, 1]) {
        const ex = px + s * 2.6;
        const ey = py - 1 - up * 1.2;
        const lid = Math.sin(clock / 1700 + s) > 0.96 ? 0.1 : 1;
        ctx.globalAlpha = 0.18 + 0.3 * open;
        ctx.fillStyle = "#c8f0a8";
        circle(ctx, ex, ey, 2.2);
        ctx.fill();
        ctx.globalAlpha = 0.5 + 0.5 * open;
        ctx.fillStyle = "#e8ffc8";
        ellipse(ctx, ex, ey, 1.4, 0.75 * open * lid + 0.05);
        ctx.fill();
        ctx.fillStyle = "#0a1a08";
        ellipse(ctx, ex, ey, 0.22, 0.7 * open * lid + 0.04);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    const H = M.hand;
    if (!H) return;
    if (H.state === "track" || H.state === "lock") {
      const lock = H.state === "lock";
      const k = lock ? 1 - H.t / HAND_LOCK_MS : 0;
      // The shadow of her hand coming down: dark, webbed, ringed red once it stops.
      ctx.globalAlpha = lock ? 0.55 + 0.3 * k : 0.4;
      ctx.fillStyle = "#000805";
      ellipse(ctx, H.x, H.y, HAND_R * (lock ? 1 - 0.15 * k : 1.1), HAND_R * 0.8 * (lock ? 1 - 0.15 * k : 1.1));
      ctx.fill();
      for (let f = -2; f <= 2; f++) {
        const a = -Math.PI / 2 + f * 0.38;
        ellipse(ctx, H.x + Math.cos(a) * HAND_R * 1.15, H.y + Math.sin(a) * HAND_R * 1.15, 0.6, 1.6, a + Math.PI / 2);
        ctx.fill();
      }
      ctx.globalAlpha = lock ? 0.9 : 0.45;
      ctx.strokeStyle = lock ? "#ff4a3a" : "#8ab89a";
      ctx.lineWidth = lock ? 0.45 : 0.25;
      circle(ctx, H.x, H.y, HAND_R);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (H.state === "rest") {
      // The hand itself, slapped down on the spot, sinking.
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#4a6a4a";
      ellipse(ctx, H.x, H.y, HAND_R * 0.75, HAND_R * 0.6);
      ctx.fill();
      ctx.fillStyle = "#3a5a3a";
      for (let f = -2; f <= 2; f++) {
        const a = -Math.PI / 2 + f * 0.42;
        ellipse(ctx, H.x + Math.cos(a) * HAND_R * 0.95, H.y + Math.sin(a) * HAND_R * 0.95, 0.55, 1.5, a + Math.PI / 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* -------------------------------------------------------------- Planny */

  // Planny from above: the box, the star eye, two feet, and the lantern held out the way he faces; round him, the ring of his light.
  function planny(ctx, v, c) {
    const { round, fx } = v;
    const r = lightOf(c);
    const low = c.oil < OIL_LOW;
    // The light's edge: where the leeches stop. Warm while there is oil, red and quick as it runs low.
    const pulse = 0.5 + 0.5 * Math.sin(fx.clock / (low ? 120 : 600));
    ctx.globalAlpha = c.gutter ? 0.8 : low ? 0.45 + 0.35 * pulse : 0.22;
    ctx.strokeStyle = c.gutter || low ? "#ff5a3a" : "#ffd98a";
    ctx.lineWidth = 0.22;
    ctx.setLineDash && ctx.setLineDash([1.2, 0.9]);
    circle(ctx, c.x, c.y, r);
    ctx.stroke();
    ctx.setLineDash && ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    const safe = round.you.safeMs > 0;
    if (safe && Math.floor(fx.clock / 90) % 2 === 0) return;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = "#04080a";
    ctx.globalAlpha = 0.6;
    ellipse(ctx, 0.2, 1.4, 1.9, 0.6);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Feet.
    ctx.fillStyle = "#c8d0dc";
    const step = c.moving ? Math.sin(fx.clock / 70) * 0.5 : 0;
    ellipse(ctx, -0.8, 1.5 + step, 0.5, 0.35);
    ctx.fill();
    ellipse(ctx, 0.8, 1.5 - step, 0.5, 0.35);
    ctx.fill();
    // The box.
    ctx.fillStyle = "#e4eaf4";
    ellipse(ctx, 0, 0, 1.7, 1.5);
    ctx.fill();
    ctx.strokeStyle = "#5a6478";
    ctx.lineWidth = 0.2;
    ctx.stroke();
    // The star for an eye.
    ctx.fillStyle = "#f5b301";
    ctx.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * TAU) / 10;
      const rr = k % 2 === 0 ? 0.75 : 0.32;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr - 0.1;
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // The lantern on a stick arm, out the way he faces; its flame low when the oil is.
    const lx = c.x + c.fx * 2.4;
    const ly = c.y + c.fy * 2.4 - 0.4;
    ctx.strokeStyle = "#c8d0dc";
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(c.x + c.fx * 1.2, c.y + c.fy * 1.2);
    ctx.lineTo(lx, ly);
    ctx.stroke();
    ctx.fillStyle = "#3a3024";
    ctx.fillRect(lx - 0.55, ly - 0.6, 1.1, 1.2);
    const flick = 0.85 + 0.15 * Math.sin(fx.clock / 80);
    ctx.fillStyle = c.gutter ? "#8a5a20" : "#ffe08a";
    circle(ctx, lx, ly, (0.2 + 0.3 * clamp(c.oil, 0, 1)) * flick + 0.05);
    ctx.fill();
  }

  // Once the five are lit: the boat's beacon, and an arrow at Planny's light pointing the way.
  function beacon(ctx, v, c, R) {
    if (c.lit < SHRINES) return;
    const [bx, by] = R.boat;
    const p = wave(v.fx.clock / 700);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.35;
    ctx.globalAlpha = 1 - p;
    circle(ctx, bx, by, 2 + p * 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const dx = bx - c.x;
    const dy = by - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 10) return;
    const ux = dx / d;
    const uy = dy / d;
    const ax = c.x + ux * 5;
    const ay = c.y + uy * 5;
    ctx.fillStyle = GOLD;
    ctx.globalAlpha = 0.6 + 0.4 * Math.sin(v.fx.clock / 150);
    ctx.beginPath();
    ctx.moveTo(ax + ux * 1.4, ay + uy * 1.4);
    ctx.lineTo(ax - uy * 0.9, ay + ux * 0.9);
    ctx.lineTo(ax + uy * 0.9, ay - ux * 0.9);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------------- the HUD */

  // The line that says what to do now: the goal, or what is wrong.
  function hint(c) {
    if (c.lit >= SHRINES) return ["RUN TO THE BOAT!", GOLD];
    if (c.gutter) return ["THE FLAME GUTTERS! LIGHT A SHRINE", "#ff6a4a"];
    if (c.oil < OIL_LOW) return ["OIL LOW: LIGHT A SHRINE", "#ff9a5a"];
    return [`LIGHT THE ${SHRINES} SHRINES`, "#f0e8d8"];
  }

  function hud(ctx, v, c) {
    const { g, fx } = v;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = "#020608";
    ctx.fillRect(0, 0, g.FIELD_W, HUD_Y * 2 - 0.4);
    ctx.globalAlpha = 1;
    // The shrines, as five little flames: gold once lit, blue till then, a ring filling as one takes.
    for (let i = 0; i < SHRINES; i++) {
      const lit = c.shrines[i] >= SHRINE_MS;
      const x = 3.8 + i * 4;
      flame(ctx, x, HUD_Y + 1, lit ? 1.3 : 1, lit ? "#ffb347" : "#3a6ab0", lit ? "#fff0b0" : "#9ac0f0");
      if (!lit && c.shrines[i] > 0) {
        ctx.strokeStyle = "#ffd75a";
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.arc(x, HUD_Y, 1.6, -Math.PI / 2, -Math.PI / 2 + TAU * (c.shrines[i] / SHRINE_MS));
        ctx.stroke();
      }
    }
    const [text, color] = hint(c);
    const urgent = c.lit >= SHRINES || c.oil < OIL_LOW;
    ctx.globalAlpha = urgent ? 0.75 + 0.25 * Math.sin(fx.clock / 140) : 1;
    label(ctx, text, g.FIELD_W / 2, HUD_Y, 2.5, color, "center", 46);
    ctx.globalAlpha = 1;
    // The oil: a bar that is the light, a tick for each flare it holds, and the key that spends it.
    const x0 = g.FIELD_W - 26;
    const w = 22;
    label(ctx, "OIL", x0 - 1, HUD_Y, 1.9, "#f0e8d8", "right");
    ctx.fillStyle = "#1a1410";
    ctx.fillRect(x0, HUD_Y - 0.9, w, 1.8);
    const k = clamp(c.oil, 0, 1);
    ctx.fillStyle = c.oil < OIL_LOW ? "#ff6a3a" : "#ffc85a";
    ctx.fillRect(x0, HUD_Y - 0.9, w * k, 1.8);
    ctx.fillStyle = "#020608";
    for (let t = FLARE_OIL; t < 1; t += FLARE_OIL) ctx.fillRect(x0 + w * t - 0.1, HUD_Y - 0.9, 0.2, 1.8);
    ctx.strokeStyle = "#6a5a40";
    ctx.lineWidth = 0.2;
    ctx.strokeRect(x0, HUD_Y - 0.9, w, 1.8);
    label(ctx, c.oil >= FLARE_OIL ? "SPACE: FLARE" : "NO OIL TO FLARE", x0 + w / 2, HUD_Y + 2.6, 1.5, c.oil >= FLARE_OIL ? "#c8b890" : "#8a6a5a", "center");
  }

  // The hunters' rules, each shown once over the hunter the first time it comes near, one after another (never two at once).
  function tags(ctx, v) {
    const list = v.fx.lanternTags || [];
    for (const t of list) {
      const age = v.fx.clock - t.show;
      if (age < 0 || age > TAG_MS) continue;
      const a = Math.min(1, age / 200, (TAG_MS - age) / 400);
      ctx.globalAlpha = a * 0.75;
      ctx.fillStyle = "#020608";
      const w = TAGS[t.kind].length * 1.15 + 2;
      const x = clamp(t.x, w / 2 + 0.5, v.g.FIELD_W - w / 2 - 0.5);
      const y = clamp(t.y - 5, HUD_Y * 2 + 1.5, v.g.FIELD_H - 2);
      ctx.fillRect(x - w / 2, y - 1.5, w, 3);
      ctx.globalAlpha = a;
      label(ctx, TAGS[t.kind], x, y, 1.9, t.kind === "mother" ? "#ff8a6a" : "#f5e6b0", "center", w);
    }
    ctx.globalAlpha = 1;
  }

  /* ----------------------------------------------------------- the frame */

  // The whole field: the island, the dark, what the dark cannot hide, Planny and the HUD, then the effects the events left.
  function field(ctx, v) {
    const { round, g } = v;
    const c = runnerOf(round);
    if (!c) return;
    const R = round.spec.ride;
    ctx.save();
    if (v.shake) ctx.translate(v.shake.x * 0.6, v.shake.y * 0.6);
    water(ctx, v, c, R);
    island(ctx, v, c, R);
    under(ctx, v, c);
    // The dark: night with a hole for each light (a fallback, where the page cannot make one, is a plain dimming).
    const dark = paintDark ? paintDark(ctx, v, c.gutter ? 0.96 : 0.92, holes(v, c, R)) : false;
    if (!dark) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = "#020608";
      ctx.fillRect(0, 0, g.FIELD_W, g.FIELD_H);
      ctx.globalAlpha = 1;
    }
    edges(ctx, v, R);
    c.bodies.forEach((B, i) => body(ctx, v, c, B, i));
    for (let i = 0; i < SHRINES; i++) shrine(ctx, v, c, R, i);
    c.leeches.forEach((S, i) => leechEyes(ctx, v, c, S, i));
    mother(ctx, v, c, R);
    lurker(ctx, v, c);
    for (const w of c.wisps) wisp(ctx, v, c, w);
    beacon(ctx, v, c, R);
    planny(ctx, v, c);
    if (c.flare) {
      const k = clamp(c.flare.t / FLARE_MS, 0, 1);
      ctx.strokeStyle = "#fff0c0";
      ctx.lineWidth = 0.5 * k + 0.1;
      ctx.globalAlpha = k;
      circle(ctx, c.flare.x, c.flare.y, FLARE_R * (1 - k * 0.7));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    effects(ctx, v);
    tags(ctx, v);
    hud(ctx, v, c);
  }

  // Bursts and rings that events left (field units, y counted up from the bottom).
  function effects(ctx, v) {
    const { g } = v;
    const Y = (y) => g.FIELD_H - y;
    for (const q of v.fx.parts) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color;
      ctx.fillRect(q.x - q.size / 2, Y(q.y) - q.size / 2, q.size, q.size);
    }
    for (const r of v.fx.rings) {
      const k = 1 - r.life / r.max;
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 0.5 * (1 - k) + 0.15;
      ctx.beginPath();
      ctx.arc(r.x, Y(r.y), r.r0 + k * r.grow, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /* -------------------------------------------------------------- events */

  const up = (y) => 54 - y;
  // How loud each event is.
  const LOUD = freeze({ lanternStep: 0.22, lanternLurkerCue: 0.6, lanternLeechCue: 0.4, lanternWispCue: 0.35, lanternBodyCue: 0.5, lanternMeet: 0.3 });

  // What the pack's events look and sound like; true when the event is its own. Each of its sounds plays once, from EVENT_VOICE.
  function react(e, k) {
    const { tone, shake, flash, burst, float, ring, fx } = k;
    const voice = EVENT_VOICE[e.type];
    if (!voice) return false;
    const x = e.x === undefined ? 48 : e.x;
    const y = e.y === undefined ? 27 : e.y;
    if (!(e.type === "lanternPop" && e.combo)) say(tone, voice[0], voice[1], LOUD[e.type] ?? 0.5);
    switch (e.type) {
      case "lanternStep":
        // The sound of a step on wood, seen: what the Lurker hears.
        ring(x, up(y), "#e8f0f0", 0.6, 5, 520);
        break;
      case "lanternFlare":
        ring(x, up(y), "#fff0c0", 1, FLARE_R, 520);
        burst(x, up(y), "#ffc070", 18, 16, 520);
        flash("#ffe8b0", 120);
        shake(140, 0.3);
        break;
      case "lanternSputter":
        burst(x, up(y), "#8a5a3a", 4, 5, 260);
        float(x, up(y) + 4, "No oil!", "#ff8a5a", 2);
        break;
      case "lanternPop":
        if (e.combo) {
          float(x, up(y) + 6, `${e.combo} at once! +${e.points}`, GOLD, 2.6);
          break;
        }
        burst(x, up(y), "#bfe8ff", 14, 12, 460);
        ring(x, up(y), "#9ad8ff", 1, 6, 420);
        if (e.points) float(x, up(y) + 3, `+${e.points}`, GOLD, 2.2);
        break;
      case "lanternShrine":
        ring(x, up(y), "#ffd75a", 1, 14, 700);
        ring(x, up(y), "#fff0b0", 0.5, 8, 500);
        burst(x, up(y), "#ffd36a", 22, 14, 640);
        flash("#ffd36a", 160);
        float(x, up(y) + 5, e.n >= SHRINES ? "The last shrine!" : `Shrine ${e.n} of ${SHRINES}`, GOLD, 2.6);
        break;
      case "lanternGutter":
        flash("#401008", 260);
        break;
      case "lanternCatch":
        shake(340, 1);
        flash("#e0402a", 220);
        burst(x, up(y), e.kind === "wisp" ? "#9ad8ff" : e.kind === "leech" ? "#4a7a2a" : e.kind === "mother" ? "#4a6a4a" : "#8aa09a", 18, 16, 520);
        break;
      case "lanternFinish":
        shake(300, 0.7);
        flash("#fffbe8", 300);
        burst(x, up(y), "#ffd36a", 30, 18, 700);
        float(48, 30, "The bog lets you go", GOLD, 3);
        break;
      case "lanternMeet":
        if (!fx.lanternTags) fx.lanternTags = [];
        {
          const last = fx.lanternTags[fx.lanternTags.length - 1];
          fx.lanternTags.push({ kind: e.kind, x, y, show: Math.max(fx.clock, last ? last.show + TAG_MS - 500 : 0) });
        }
        break;
      case "lanternClose":
        float(x, up(y) + 4, `Close! +${e.points}`, "#9ad8ff", 2.2);
        break;
      case "lanternAim":
        ring(x, up(y), "#ff6a4a", 1, 4, 500);
        break;
      case "lanternDash":
        burst(x, up(y), "#9ad0c8", 12, 14, 380);
        shake(160, 0.35);
        break;
      case "lanternBodyCue":
        ring(x, up(y), "#c8d4c0", 1, BODY_NOTICE * 0.6, 500);
        break;
      case "lanternWake":
        shake(500, 0.45);
        flash("#1a3a22", 380);
        float(x, up(y) + 8, "Old Mother Bog stirs", "#b8f0c8", 2.8);
        break;
      case "lanternRise":
        shake(900, 1);
        flash("#2a4a2a", 500);
        ring(x, up(y), "#b8f0c8", 3, 30, 1100);
        burst(x, up(y), "#5a8a5a", 30, 20, 900);
        float(x, up(y) + 10, "SHE RISES", "#ff8a6a", 3.4);
        break;
      case "lanternHand":
        break;
      case "lanternSlam":
        shake(240, 0.8);
        ring(x, up(y), "#9ad0c8", 1, HAND_R * 2.2, 520);
        burst(x, up(y), "#6a9a8a", 16, 14, 480);
        break;
      default:
        break;
    }
    return true;
  }

  return freeze({
    looks: LOOKS,
    backdrop,
    ground,
    shelf,
    dim,
    monsters: freeze({}),
    bosses: freeze({}),
    missiles: freeze({}),
    hazards: freeze({}),
    powers: freeze({}),
    lights,
    react,
    field,
  });
}
