// Plan2Code Web Console - Ghoul Rush's Deep Seam Mine, the Tommyknocker: a hulking miner-giant who has grown into the seam (a crust of rock over one shoulder and down that arm, pale gems sprouting from it), in overalls and a hard hat with a miner's lamp on its front, a broad scowling face under a big soot-gray beard, and a sledgehammer the size of a door that he never lets sink below the floor. One figure, drawn by what he is doing: leaning on the hammer, the three overhead knocks (the head swings up behind him, then slams down in dust and sparks), the hammer drawn back low for the sweep, the dragged hammer of a rest, sinking into the floor when the lights go out, bursting up out of it dazed with stars about his head, and raged (red eyes, cracks that glow, brighter gems).
//
// ghoul-mine-draw.js plugs it in: tommyKit(d) takes ghoul-draw.js's own drawing
// helpers (`d`) and returns `figure(ctx, v, b)`. Everything is drawn in a local
// frame facing +x with y counted up from the feet as negative (the context is
// translated to his feet and flipped by the way he faces); glows are handed to
// the dark's eye pass in room coordinates, so his eyes, lamp and gems burn over
// a blackout. What it reads off the boss `b` (ghoul-mine.js): `act` ("idle",
// "knock" with `knockIn` ms to the next beat, "sweepWind" with `wait` of 500,
// "rest", "dark" with `wait` of the 600 ms of sinking, "hidden", "dazed"),
// `state` ("sleep", "fight", "down"), `hidden`, `darkOn`, `dazed` (ms left of
// 2000), `raged`, `dir`, `hurt`.

const freeze = (o) => Object.freeze(o);
const TAU = Math.PI * 2;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const lerp = (a, b, k) => a + (b - a) * k;

export const DAZE_MS = 1500;
const BEAT_MS = 380;
const SINK_MS = 600;
const WIND_MS = 500;

// The colors: seam rock (dark, middle, lit), his skin, clothes, helmet, beard,
// gloves, the hammer's iron and haft, the pale gems, the rage and the cool edge light.
const C = freeze({
  rock: "#4e443c", rockDark: "#2c2520", rockLit: "#85786a", skin: "#9a7560", skinDark: "#684a3c", skinLit: "#b8917a",
  shirt: "#7a3f34", shirtDark: "#4e2822", shirtLit: "#9a5444", bib: "#34465a", bibDark: "#243344", bibLite: "#4f6a86",
  belt: "#251912", brass: "#c8a040", helmet: "#d6a62a", helmetLit: "#f4d668", helmetDark: "#98720f",
  beard: "#5b5b60", beardLit: "#97979e", beardDark: "#38383d", glove: "#4a3626", gloveLit: "#7a5e46",
  iron: "#4a4a54", ironLit: "#9a9aaa", haft: "#7a5632", haftDark: "#2c1c10",
  gem: "#a8b8ff", gemLit: "#ffffff", gemDark: "#6a58d0", gemR: "#e0b8ff", gemRDark: "#a040e8",
  crack: "#ff6a2a", out: "#120d0a", lamp: "#ffb84a", rim: "#93adc2",
});
const FLASHES = freeze({ rock: 1, rockDark: 1, rockLit: 1, skin: 1, skinDark: 1, skinLit: 1, shirt: 1, shirtDark: 1, shirtLit: 1, bib: 1, bibDark: 1, bibLite: 1, belt: 1, brass: 1, helmet: 1, helmetLit: 1, helmetDark: 1, beard: 1, beardLit: 1, beardDark: 1, glove: 1, gloveLit: 1, iron: 1, ironLit: 1, haft: 1, haftDark: 1, gem: 1, gemLit: 1, gemDark: 1, gemR: 1, gemRDark: 1, rim: 1 });

// The hammer: from the top hand to the head's center (L), the head's half
// length across the haft and half depth along it, the haft behind the top hand
// (butt) and the lower hand's reach down the haft.
const HAM = freeze({ L: 4.8, HL: 3.4, HD: 2.3, butt: 3.4, low: 2.6 });
// How far below the top hand the head's lowest edge reaches, haft angle a (0 along his facing, positive down).
const lowest = (a) => HAM.L * Math.sin(a) + HAM.HL * Math.abs(Math.cos(a)) + HAM.HD * Math.abs(Math.sin(a));

// Where the top hand is and which way the haft points, by pose. The slam has
// the head flat on the floor in front of him.
const SLAM = freeze({ hand: [7.4, -lowest(1.4)], a: 1.4 });
const RAISED = freeze({ hand: [-0.7, -12.4], a: -2.5 });
const DRAWN = freeze({ hand: [-2.4, -4.6], a: Math.PI - 0.1 });

const ease = (k) => k * k * (3 - 2 * k);

export function tommyKit(d) {
  const { ellipse, circle, line, FLASH, EYE_AMBER, EYE_RED, GOLD } = d;

  const poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };

  // The outline of a tapered limb: a round cap at each end, radius r1 at a and r2 at b.
  function capsule(a, b, r1, r2) {
    const th = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const q = th + Math.PI / 2 + (i / 5) * Math.PI;
      pts.push([a[0] + Math.cos(q) * r1, a[1] + Math.sin(q) * r1]);
    }
    for (let i = 0; i <= 5; i++) {
      const q = th - Math.PI / 2 + (i / 5) * Math.PI;
      pts.push([b[0] + Math.cos(q) * r2, b[1] + Math.sin(q) * r2]);
    }
    return pts;
  }

  // The elbow of a two-bone arm from the shoulder s to the hand h (bend 1 drops it, -1 lifts it back).
  function elbow(s, h, l1, l2, bend) {
    const dx = h[0] - s[0];
    const dy = h[1] - s[1];
    const len = Math.hypot(dx, dy) || 0.01;
    const dist = Math.min(len, l1 + l2 - 0.02);
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const ux = dx / len;
    const uy = dy / len;
    return [s[0] + ux * a - uy * hh * bend, s[1] + uy * a + ux * hh * bend];
  }

  function figure(ctx, v, b) {
    if (b.hidden || b.act === "hidden") return;
    const asleep = b.state === "sleep";
    const H = v.g.FIELD_H;
    const t = v.clock || 0;
    const dir = b.dir || -1;
    const act = asleep ? "sleep" : b.state === "down" ? "down" : b.act || "idle";
    const hurt = b.hurt > 0 && Math.floor(b.hurt / 55) % 2 === 0;
    const raged = Boolean(b.raged) && !asleep;
    const col = (k) => (hurt && FLASHES[k] ? FLASH : C[k]);
    const out = hurt ? FLASH : C.out;
    const y0 = H - b.y;

    // How far he has sunk (lights out) or has yet to rise (the burst), in units.
    let drop = 0;
    const dazedP = act === "dazed" ? clamp(1 - (b.dazed ?? DAZE_MS) / DAZE_MS, 0, 1) : 1;
    if (act === "dark") drop = ease(clamp(1 - (b.wait ?? SINK_MS) / (SINK_MS * (raged ? 0.7 : 1)), 0, 1)) * 15.5;
    else if (act === "dazed") drop = (1 - ease(clamp(dazedP / 0.12, 0, 1))) * 15.5;
    const sunk = drop > 0.05;

    // A glow handed to the dark's pass (room coordinates), not under the floor.
    let gx = 0;
    let gy = 0;
    const glow = (lx, ly, r, color) => {
      if (ly + gy + drop > 0.1) return;
      v.eyes.push(b.x + dir * (lx + gx), y0 + ly + gy + drop, r, color);
    };

    ctx.save();
    ctx.translate(b.x, y0);
    ctx.scale(dir > 0 ? 1 : -1, 1);

    // Under the floor: only what is above the feet's line shows.
    if (sunk) {
      ctx.beginPath();
      ctx.rect(-30, -40, 60, 40.2);
      ctx.clip();
    }
    ctx.translate(0, drop);

    // ---------------------------------------------------------- pose
    let lean = 0;
    let crouch = 0;
    let hand = SLAM.hand;
    let a = SLAM.a;
    let grounded = true;
    let behind = false;
    let bend = 1;
    let headDy = 0;
    let headDx = 0;
    let mouth = 0.1;
    let strike = 0;
    const breath = Math.sin(t / 430);
    if (act === "idle" || act === "sleep") {
      lean = 0.4;
      crouch = 0.15 + breath * 0.08;
      headDy = breath * 0.1;
    } else if (act === "knock") {
      const beat = BEAT_MS * (raged ? 0.7 : 1);
      const p = clamp(1 - (b.knockIn ?? beat) / beat, 0, 1);
      let k;
      if (p < 0.78) k = ease(p / 0.78);
      else k = 1 - Math.pow((p - 0.78) / 0.22, 2);
      hand = [lerp(SLAM.hand[0], RAISED.hand[0], k), lerp(SLAM.hand[1], RAISED.hand[1], k)];
      a = lerp(SLAM.a, RAISED.a, k);
      grounded = false;
      behind = k > 0.4;
      bend = lerp(1, -1, clamp(k * 1.4, 0, 1));
      lean = lerp(0.7, -0.9, k);
      crouch = lerp(0.6, -0.3, k);
      headDy = lerp(0.3, -0.5, k);
      mouth = p > 0.7 ? 0.5 : p < 0.14 ? 0.9 : 0.15;
      strike = p < 0.16 ? 1 - p / 0.16 : 0;
    } else if (act === "sweepWind") {
      const q = clamp(1 - (b.wait ?? WIND_MS) / WIND_MS, 0, 1);
      const e = ease(Math.min(1, q * 2.4));
      hand = [lerp(2.4, DRAWN.hand[0], e), lerp(-6.4, DRAWN.hand[1], e)];
      a = lerp(0.8, DRAWN.a, e);
      grounded = false;
      behind = e > 0.5;
      lean = -1.1 * Math.min(1, q * 2.4);
      crouch = 1.0 * q;
      headDy = 0.4 * q;
      mouth = 0.6;
      hand = [hand[0] + Math.sin(t / 30) * 0.12 * q, hand[1]];
    } else if (act === "rest") {
      hand = [2.6, 0];
      a = 0.45;
      lean = 0.8;
      crouch = 0.9;
      headDy = 0.9 + breath * 0.2;
      mouth = 0.5 + Math.abs(breath) * 0.3;
    } else if (act === "dark") {
      hand = [7.0, 0];
      a = 1.3;
      lean = 0.3;
      crouch = 0.5;
      headDy = 0.4;
      mouth = 0.4;
    } else if (act === "dazed" || act === "down") {
      const wob = Math.sin(t / 210);
      hand = [7.4, 0];
      a = 1.45;
      lean = 0.6 + wob * 0.6;
      crouch = 1.7;
      headDy = 1.4 + Math.sin(t / 170) * 0.3;
      headDx = 0.2 + wob * 0.4;
      mouth = 0.65;
    }
    // The head never goes below the floor: resting poses sit it on the floor, the rest stop at it.
    const low = lowest(a);
    if (grounded || hand[1] > -low) hand = [hand[0], -low];
    const sway = lean * 0.6;

    // ----------------------------------------------------------- the parts
    // A shape with a thin pale rim on its back edge (the cool edge light that lifts him off the tunnel).
    const part = (pts, color, lw = 0.16, rim = true) => {
      if (rim) {
        ctx.save();
        ctx.translate(-0.3, -0.25);
        ctx.fillStyle = col("rim");
        poly(ctx, pts);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = color;
      poly(ctx, pts);
      ctx.fill();
      ctx.strokeStyle = out;
      ctx.lineWidth = lw;
      ctx.stroke();
    };
    const shade = (pts, color, alpha) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      poly(ctx, pts);
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    // A faceted stone: a jagged body, a lit face on its upper left, a dark one below.
    const stone = (cx, cy, r, n, sx = 1, sy = 1) => {
      const pts = [];
      for (let i = 0; i < 9; i++) {
        const j = 0.74 + 0.26 * Math.abs(Math.sin(n * 12.9 + i * 7.3));
        const ang = (i / 9) * TAU - 0.3;
        pts.push([cx + Math.cos(ang) * r * j * sx, cy + Math.sin(ang) * r * j * sy]);
      }
      part(pts, col("rock"), 0.14, false);
      shade([pts[5], pts[6], pts[7], [cx - r * 0.1, cy - r * 0.15]], col("rockLit"), 0.75);
      shade([pts[0], pts[1], pts[2], [cx + r * 0.15, cy + r * 0.2]], col("rockDark"), 0.8);
    };
    // A gem growing from the rock, tilted by ang (0 is straight up): pale faces, a white glint, a sparkle.
    const gem = (cx, cy, h, w, ang, phase = 0) => {
      const mid = raged ? "gemR" : "gem";
      const dark = raged ? "gemRDark" : "gemDark";
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      const body = [[-w, 0.2], [-w * 0.85, -h * 0.62], [0, -h], [w * 0.85, -h * 0.6], [w, 0.2]];
      ctx.fillStyle = col(dark);
      poly(ctx, body);
      ctx.fill();
      shade([[0, 0.2], [0, -h], [w * 0.85, -h * 0.6], [w, 0.2]], col(mid), 0.9);
      shade([[-w, 0.2], [-w * 0.85, -h * 0.62], [0, -h], [-w * 0.1, -h * 0.35]], col("gemLit"), raged ? 0.9 : 0.7);
      ctx.strokeStyle = col("gemLit");
      ctx.lineWidth = 0.1;
      line(ctx, -w * 0.45, -h * 0.18, -w * 0.5, -h * 0.55);
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.1;
      poly(ctx, body);
      ctx.stroke();
      ctx.restore();
      const tx = cx + Math.sin(ang) * h;
      const ty = cy - Math.cos(ang) * h;
      const tw = 0.5 + 0.5 * Math.sin(t / (raged ? 120 : 260) + phase * 2.1);
      ctx.strokeStyle = col("gemLit");
      ctx.lineWidth = 0.1;
      ctx.globalAlpha = 0.35 + 0.65 * tw;
      const sp = 0.3 + 0.35 * tw + (raged ? 0.2 : 0);
      line(ctx, tx - sp, ty, tx + sp, ty);
      line(ctx, tx, ty - sp, tx, ty + sp);
      ctx.globalAlpha = 1;
      glow(cx + Math.sin(ang) * h * 0.55, cy - Math.cos(ang) * h * 0.55, (0.08 + h * 0.03) * (raged ? 1.8 : 1), raged ? C.gemR : C.gem);
    };

    // A big leather glove gripping the haft at p, the fist turned along the haft angle.
    const glove = (p) => {
      ctx.save();
      ctx.translate(p[0], p[1]);
      ctx.rotate(a);
      const fist = [];
      for (let i = 0; i < 12; i++) fist.push([Math.cos((i / 12) * TAU) * 1.5, Math.sin((i / 12) * TAU) * 1.3]);
      part(fist, col("glove"), 0.14, false);
      ctx.fillStyle = col("gloveLit");
      for (const k of [-0.8, 0, 0.8]) {
        circle(ctx, 0.15, k * 0.6, 0.38);
        ctx.fill();
      }
      shade([[-1.3, -0.5], [-0.2, -1.1], [0.9, -0.9], [-0.2, -0.5]], col("gloveLit"), 0.5);
      ctx.fillStyle = col("brass");
      circle(ctx, -1.2, 0.3, 0.17);
      ctx.fill();
      ctx.restore();
    };

    // The hammer: haft and iron head. The head's lowest edge is at the floor or above it.
    const u = [Math.cos(a), Math.sin(a)];
    const nn = [-u[1], u[0]];
    const g2 = [hand[0] + u[0] * HAM.low, hand[1] + u[1] * HAM.low];
    const hc = [hand[0] + u[0] * HAM.L, hand[1] + u[1] * HAM.L];
    const hammer = () => {
      const butt = [hand[0] - u[0] * HAM.butt, hand[1] - u[1] * HAM.butt];
      ctx.lineCap = "round";
      ctx.strokeStyle = out;
      ctx.lineWidth = 1.05;
      line(ctx, butt[0], butt[1], hc[0], hc[1]);
      ctx.strokeStyle = col("haft");
      ctx.lineWidth = 0.78;
      line(ctx, butt[0], butt[1], hc[0], hc[1]);
      ctx.strokeStyle = col("haftDark");
      ctx.lineWidth = 0.14;
      line(ctx, butt[0] + nn[0] * 0.2, butt[1] + nn[1] * 0.2, hc[0] + nn[0] * 0.2, hc[1] + nn[1] * 0.2);
      ctx.lineCap = "butt";
      ctx.fillStyle = col("brass");
      circle(ctx, butt[0], butt[1], 0.45);
      ctx.fill();
      const cr = (s, k) => [hc[0] + nn[0] * s * HAM.HL + u[0] * k * HAM.HD, hc[1] + nn[1] * s * HAM.HL + u[1] * k * HAM.HD];
      part([cr(1, -1), cr(-1, -1), cr(-1, 1), cr(1, 1)], col("iron"), 0.17, false);
      // The lit top half, the bands near each end, the striking faces worn bright.
      shade([cr(1, -1), cr(-1, -1), cr(-1, 0), cr(1, 0)], col("ironLit"), 0.7);
      ctx.strokeStyle = col("haftDark");
      ctx.lineWidth = 0.2;
      for (const s of [0.62, -0.62]) line(ctx, cr(s, -1)[0], cr(s, -1)[1], cr(s, 1)[0], cr(s, 1)[1]);
      shade([cr(1, -1), cr(0.86, -1), cr(0.86, 1), cr(1, 1)], col("ironLit"), 0.55);
      shade([cr(-1, -1), cr(-0.86, -1), cr(-0.86, 1), cr(-1, 1)], col("ironLit"), 0.55);
    };

    // ----------------------------------------------------------- the far arm
    // Behind the body, gripping the haft lower down (drawn dark, its glove comes late).
    const farS = [-3.0 + sway, -9.3 + crouch];
    const farE = elbow(farS, g2, 4.6, 4.2, bend);
    part(capsule(farS, farE, 1.6, 1.4), col("shirtDark"), 0.16, false);
    part(capsule(farE, g2, 1.4, 1.1), col("skinDark"), 0.16, false);

    // --------------------------------------------------------------- the legs
    // Planted wide on the floor: thick overall legs, big boots, a few pebbles.
    const hipY = -4.4 + crouch * 0.8;
    for (const [hx, fx, kn] of [[-2.1, -3.0, -0.4], [2.1, 3.0, 0.9]]) {
      const hip = [hx + sway * 0.3, hipY];
      const knee = [lerp(hip[0], fx, 0.5) + kn * 0.5 + crouch * 0.5, -2.4];
      const ank = [fx, -1.5];
      part(capsule(hip, knee, 1.9, 1.6), col("bib"));
      part(capsule(knee, ank, 1.6, 1.4), col("bib"));
      shade([[knee[0] - 1.2, knee[1] - 0.6], [knee[0] + 1.0, knee[1] - 0.8], [knee[0] + 1.0, knee[1] + 0.2]], col("bibLite"), 0.55);
      part([[fx - 1.7, -1.8], [fx + 1.3, -1.9], [fx + 3.1, -0.9], [fx + 3.2, 0], [fx - 1.8, 0]], col("belt"), 0.15);
      shade([[fx - 1.5, -1.7], [fx + 1.2, -1.8], [fx + 1.4, -1.2], [fx - 1.5, -1.2]], col("gloveLit"), 0.5);
      ctx.fillStyle = col("rockDark");
      ctx.fillRect(fx - 1.8, -0.35, 5.0, 0.35);
    }
    ctx.fillStyle = col("rockLit");
    for (const [px, pw] of [[-5.6, 0.7], [-0.4, 0.5], [0.4, 0.9], [5.6, 0.6], [7.0, 0.4]]) {
      poly(ctx, [[px - pw, 0], [px - pw * 0.4, -pw * 0.9], [px + pw * 0.6, -pw * 0.7], [px + pw, 0]]);
      ctx.fill();
    }

    if (behind) hammer();

    // ------------------------------------------------------------- the torso
    ctx.save();
    ctx.translate(sway, crouch);
    gx = sway;
    gy = crouch;
    const bob = breath * 0.1;
    // A barrel chest and a heavy hunched back, shoulders no higher than the neck.
    const trunk = [[-4.2, -3.9], [-5.5, -7.0], [-5.3, -9.4 + bob], [-3.4, -10.9 + bob], [0.0, -11.3 + bob], [3.2, -10.9 + bob], [5.0, -9.2 + bob], [5.4, -6.8], [4.6, -3.9]];
    part(trunk, col("shirt"), 0.18);
    shade([[-5.3, -9.4 + bob], [-3.4, -10.9 + bob], [0.0, -11.3 + bob], [0, -10.2], [-4.6, -8.6]], col("shirtLit"), 0.5);
    // The overalls: bib, straps over the shoulders, buttons, pocket, belt.
    ctx.fillStyle = col("bib");
    poly(ctx, [[-3.8, -3.9], [-3.9, -7.6], [3.4, -7.6], [4.4, -3.9]]);
    ctx.fill();
    ctx.strokeStyle = out;
    ctx.lineWidth = 0.14;
    ctx.stroke();
    ctx.fillStyle = col("bibLite");
    ctx.fillRect(-2.4, -6.7, 2.8, 1.5);
    ctx.strokeStyle = out;
    ctx.lineWidth = 0.1;
    ctx.strokeRect(-2.4, -6.7, 2.8, 1.5);
    for (const [sx, ex] of [[-3.0, -3.6], [2.2, 3.0]]) {
      part(capsule([sx, -7.8], [ex, -10.9 + bob], 0.7, 0.75), col("bibDark"), 0.12, false);
    }
    ctx.fillStyle = col("brass");
    for (const sx of [-3.0, 2.3]) circle(ctx, sx, -7.9, 0.24), ctx.fill();
    ctx.fillStyle = col("belt");
    ctx.fillRect(-4.3, -4.9, 8.9, 1.0);
    ctx.fillStyle = col("brass");
    ctx.fillRect(-0.7, -4.85, 1.4, 0.85);

    // The cracks of his rage: lines that glow through shirt and stone.
    if (raged && !hurt) {
      const pulse = 0.65 + 0.35 * Math.sin(t / 150);
      ctx.strokeStyle = C.crack;
      ctx.globalAlpha = pulse;
      ctx.lineWidth = 0.34;
      ctx.beginPath();
      ctx.moveTo(-4.6, -9.8);
      ctx.lineTo(-3.7, -8.2);
      ctx.lineTo(-4.4, -6.6);
      ctx.lineTo(-3.4, -5.2);
      ctx.moveTo(0.6, -7.2);
      ctx.lineTo(1.4, -5.9);
      ctx.lineTo(0.6, -5.0);
      ctx.moveTo(4.2, -9.4);
      ctx.lineTo(4.8, -7.9);
      ctx.stroke();
      ctx.globalAlpha = 1;
      for (const [cx, cy] of [[-3.7, -8.2], [-3.4, -5.2], [1.4, -5.9], [4.8, -7.9]]) glow(cx, cy, 0.2 * pulse, C.crack);
    }
    // A patch of seam grown over the back shoulder, a few small gems in it.
    stone(-4.3, -9.5, 1.5, 3, 0.9, 1.1);
    gem(-4.9, -10.5, 1.5, 0.4, -0.5, 1);
    gem(-3.8, -10.7, 1.1, 0.3, 0.1, 2);
    ctx.restore();
    gx = 0;
    gy = 0;

    // ---------------------------------------------------------- the near arm
    // A thick sleeved upper arm under a crust of rock that runs from the shoulder down it.
    const nearS = [-1.7 + sway, -8.9 + crouch];
    const nearE = elbow(nearS, hand, 4.8, 4.4, bend);
    part(capsule(nearS, nearE, 2.1, 1.75), col("shirt"), 0.18, false);
    shade(capsule([nearS[0], nearS[1] + 0.2], [nearE[0], nearE[1] + 0.2], 1.0, 0.8), col("shirtLit"), 0.35);
    // A strip of rock along the top of a limb from a to b, wide at its root, jagged; returns where it sits.
    const crust = (p, q, k1, w0, w1) => {
      const dx = q[0] - p[0];
      const dy = q[1] - p[1];
      const len = Math.hypot(dx, dy) || 0.01;
      const dd = [dx / len, dy / len];
      const nr = [dd[1], -dd[0]];
      const upper = [];
      const lower = [];
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        const w = lerp(w0, w1, k) + (i % 2 ? 0.45 : -0.1);
        const pc = [p[0] + dd[0] * len * k * k1, p[1] + dd[1] * len * k * k1];
        upper.push([pc[0] + nr[0] * w, pc[1] + nr[1] * w]);
        lower.push([pc[0] - nr[0] * (0.3 - (i % 2 ? 0.5 : 0)), pc[1] - nr[1] * (0.3 - (i % 2 ? 0.5 : 0))]);
      }
      part(upper.concat(lower.reverse()), col("rock"), 0.14, false);
      shade(upper.slice(0, 5), col("rockLit"), 0.4);
      return { at: (k, o) => [p[0] + dd[0] * len * k + nr[0] * o, p[1] + dd[1] * len * k + nr[1] * o], ang: Math.atan2(nr[0], -nr[1]) };
    };
    const armCrust = crust(nearS, nearE, 0.9, 2.5, 1.5);
    stone(nearS[0] + 0.1, nearS[1] + 0.2, 2.1, 7, 1.2, 0.85);
    {
      const g1 = armCrust.at(0.3, 2.6);
      const g3 = armCrust.at(0.62, 1.8);
      gem(g1[0], g1[1], 2.0, 0.5, armCrust.ang + 0.2, 3);
      gem(g3[0], g3[1], 1.3, 0.36, armCrust.ang - 0.3, 4);
    }

    // The near forearm: thick, tapering to the wrist, a stripe of light along it and a cuff.
    part(capsule(nearE, hand, 1.65, 1.25), col("skin"), 0.18, false);
    shade(capsule([nearE[0], nearE[1] - 0.45], [hand[0], hand[1] - 0.4], 0.55, 0.35), col("skinLit"), 0.5);
    crust(nearE, hand, 0.8, 1.7, 1.2);
    // A leather bracer on the lower forearm, studded.
    {
      const bp = [lerp(nearE[0], hand[0], 0.5), lerp(nearE[1], hand[1], 0.5)];
      part(capsule(bp, hand, 1.5, 1.35), col("glove"), 0.15, false);
      shade(capsule([bp[0], bp[1] - 0.4], [hand[0], hand[1] - 0.4], 0.45, 0.35), col("gloveLit"), 0.5);
      ctx.fillStyle = col("brass");
      for (const k of [0.25, 0.55, 0.85]) circle(ctx, lerp(bp[0], hand[0], k), lerp(bp[1], hand[1], k) + 0.2, 0.17), ctx.fill();
    }
    ctx.strokeStyle = col("skinDark");
    ctx.lineWidth = 0.12;
    {
      const mx = lerp(nearE[0], hand[0], 0.5);
      const my = lerp(nearE[1], hand[1], 0.5);
      line(ctx, mx - 0.5, my + 0.3, mx + 0.4, my + 0.3);
      line(ctx, mx - 0.3, my + 0.7, mx + 0.5, my + 0.7);
    }

    // -------------------------------------------------------------- the head
    const hx = 1.7 + sway + headDx;
    const hy = -11.4 + crouch + headDy;
    // The skull and ear, a heavy jaw, a lump of a nose.
    part([[-2.7, -1.0], [-2.5, 1.2], [-1.2, 2.5], [2.0, 2.5], [3.2, 1.5], [3.3, -1.0], [2.4, -2.3], [-0.8, -2.5]].map(([x, y]) => [hx + x, hy + y]), col("skin"), 0.17);
    ctx.fillStyle = col("skinDark");
    ellipse(ctx, hx - 1.5, hy + 0.2, 0.55, 0.8);
    ctx.fill();
    part([[2.9, 0.4], [4.3, 1.5], [3.7, 2.2], [2.6, 1.9]].map(([x, y]) => [hx + x, hy + y]), col("skinLit"), 0.14);
    // The heavy brow: a dark ridge over sunk eye sockets.
    ctx.fillStyle = col("skinDark");
    poly(ctx, [[-0.5, -0.5], [3.5, -0.7], [3.9, 0.3], [3.1, 0.65], [-0.5, 0.5]].map(([x, y]) => [hx + x, hy + y]));
    ctx.fill();
    ctx.fillStyle = out;
    for (const ex of [0.3, 1.9]) ctx.fillRect(hx + ex, hy + 0.45, 1.5, 0.75);
    // The beard: a great soot-gray mass from the ears to the chest, streaked, with the mouth in it.
    part([[-2.6, 0.4], [-2.7, 2.4], [-1.9, 4.0], [-0.9, 4.4 + mouth * 0.3], [0.2, 5.2 + mouth * 0.4], [1.4, 4.6 + mouth * 0.4], [2.4, 5.1 + mouth * 0.4], [3.2, 3.8], [3.9, 2.8], [3.9, 2.2], [2.8, 2.15], [1.0, 2.3], [-0.6, 1.9], [-1.6, 1.0]].map(([x, y]) => [hx + x, hy + y]), col("beard"), 0.17);
    shade([[-2.4, 1.0], [-1.0, 1.9], [-0.6, 3.2], [-2.0, 3.6]].map(([x, y]) => [hx + x, hy + y]), col("beardLit"), 0.45);
    shade([[0.6, 3.0], [2.8, 2.8], [3.3, 3.9], [2.2, 4.6], [1.0, 4.1]].map(([x, y]) => [hx + x, hy + y]), col("beardDark"), 0.55);
    ctx.strokeStyle = col("beardDark");
    ctx.lineWidth = 0.12;
    for (const [x1, y1, x2, y2] of [[-1.5, 1.6, -1.3, 3.7], [-0.2, 2.2, 0.0, 4.5], [1.3, 3.1, 1.5, 4.4], [2.7, 2.4, 3.1, 3.9]]) line(ctx, hx + x1, hy + y1, hx + x2, hy + y2);
    ctx.fillStyle = out;
    poly(ctx, [[1.0, 2.35], [3.0, 2.35], [2.9, 2.45 + mouth * 1.2], [1.2, 2.45 + mouth * 1.2]].map(([x, y]) => [hx + x, hy + y]));
    ctx.fill();
    ctx.fillStyle = col("beardLit");
    for (const tx of [1.3, 1.9, 2.5]) ctx.fillRect(hx + tx, hy + 2.35, 0.3, 0.3 + mouth * 0.3);
    // The hard hat: a dented dome, a ridge, a brim over the brow, and the lamp on its front.
    const dome = [[-3.1, -0.7], [-3.0, -2.3], [-1.7, -3.6], [0.6, -4.1], [2.6, -3.5], [3.4, -2.1], [3.5, -0.9]].map(([x, y]) => [hx + x, hy + y]);
    part(dome, col("helmet"), 0.17);
    shade([[-2.4, -2.2], [-1.4, -3.4], [0.4, -3.8], [-0.6, -2.2]].map(([x, y]) => [hx + x, hy + y]), col("helmetLit"), 0.85);
    shade([[1.6, -3.4], [2.6, -3.3], [3.3, -2.0], [3.4, -0.9], [2.2, -1.0]].map(([x, y]) => [hx + x, hy + y]), col("helmetDark"), 0.6);
    ctx.fillStyle = col("helmetDark");
    ctx.fillRect(hx - 0.4, hy - 4.0, 0.8, 3.3);
    part([[-3.4, -1.1], [4.6, -1.3], [4.7, -0.55], [-3.4, -0.4]].map(([x, y]) => [hx + x, hy + y]), col("helmetDark"), 0.14);
    // The lamp: a brass housing, a lens that burns unless he has doused it.
    const lit = !b.darkOn || act === "dazed";
    const lx = hx + 3.6;
    const ly = hy - 2.2;
    part([[lx - 1.3, ly - 0.8], [lx + 0.5, ly - 0.9], [lx + 0.9, ly + 0.9], [lx - 1.3, ly + 0.9]], col("brass"), 0.14);
    ctx.fillStyle = lit && !hurt ? C.lamp : col("haftDark");
    ellipse(ctx, lx + 0.7, ly, 0.45, 0.78);
    ctx.fill();
    if (lit && !hurt) {
      ctx.fillStyle = "#fff4c0";
      ellipse(ctx, lx + 0.8, ly, 0.2, 0.4);
      ctx.fill();
      glow(lx + 0.9, ly, 0.5, C.lamp);
    } else if (act === "dark") {
      ctx.fillStyle = "rgba(190, 190, 190, 0.4)";
      for (let k = 0; k < 4; k++) {
        const rise = ((t / 400 + k * 0.25) % 1) * 2.6;
        circle(ctx, lx + 0.9 + Math.sin(rise * 2 + k) * 0.4, ly - 0.8 - rise, 0.2 + rise * 0.12);
        ctx.fill();
      }
    }
    // Eyes under the brow: wedges that burn, red when raged, dim and crossed when dazed, shut asleep.
    const eyeColor = raged ? EYE_RED : EYE_AMBER;
    if (act === "dazed") {
      ctx.strokeStyle = C.gem;
      ctx.lineWidth = 0.15;
      for (const ex of [1.0, 2.5]) {
        line(ctx, hx + ex - 0.3, hy + 0.5, hx + ex + 0.3, hy + 1.1);
        line(ctx, hx + ex + 0.3, hy + 0.5, hx + ex - 0.3, hy + 1.1);
      }
      glow(hx + 1.7, hy + 0.8, 0.3, "#a88a4a");
    } else if (act !== "sleep") {
      ctx.fillStyle = eyeColor;
      poly(ctx, [[0.4, 0.5], [1.7, 0.7], [1.5, 1.15], [0.5, 1.1]].map(([x, y]) => [hx + x, hy + y]));
      ctx.fill();
      poly(ctx, [[2.0, 0.7], [3.3, 0.5], [3.1, 1.1], [2.1, 1.15]].map(([x, y]) => [hx + x, hy + y]));
      ctx.fill();
      ctx.fillStyle = "#ffe8b0";
      ctx.fillRect(hx + 0.9, hy + 0.72, 0.5, 0.25);
      ctx.fillRect(hx + 2.4, hy + 0.72, 0.5, 0.25);
      glow(hx + 1.0, hy + 0.85, 0.22, eyeColor);
      glow(hx + 2.6, hy + 0.85, 0.22, eyeColor);
    } else {
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.13;
      line(ctx, hx + 0.5, hy + 0.9, hx + 1.6, hy + 0.9);
      line(ctx, hx + 2.0, hy + 0.9, hx + 3.1, hy + 0.9);
      glow(hx + 1.7, hy + 0.9, 0.12, "#7a5a2a");
    }

    if (!behind) hammer();

    // ------------------------------------------------------------- the gloves
    glove(g2);
    glove(hand);

    // ------------------------------------------------------------ the effects
    // The slam: dust and sparks where the head lands.
    if (strike > 0) {
      const sx = hc[0];
      const sy = -0.1;
      ctx.globalAlpha = strike;
      ctx.fillStyle = "#c8b890";
      for (let k = 0; k < 7; k++) {
        const ang = Math.PI + (k / 6) * Math.PI;
        const r = (1 - strike) * 3.6 + 0.6;
        circle(ctx, sx + Math.cos(ang) * r * 1.5, sy + Math.sin(ang) * r * 0.7, 0.25 + (k % 3) * 0.12);
        ctx.fill();
      }
      ctx.fillStyle = GOLD;
      for (let k = 0; k < 8; k++) {
        const ang = Math.PI * (1.1 + (k / 7) * 0.8);
        const r = (1 - strike) * 3.2 + 0.4;
        ctx.fillRect(sx + Math.cos(ang) * r - 0.12, sy + Math.sin(ang) * r - 0.12, 0.28, 0.28);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = out;
      ctx.lineWidth = 0.14;
      line(ctx, sx - 1.2, 0, sx - 0.2, sy - 0.1);
      line(ctx, sx + 0.9, 0, sx + 0.1, sy - 0.1);
      glow(sx, sy - 0.4, 0.9 * strike, "#ffd890");
    }
    // The burst: rubble flung up from the floor as he rises.
    if (act === "dazed" && dazedP < 0.5) {
      const k = dazedP / 0.5;
      for (let i = 0; i < 12; i++) {
        const ang = -0.4 - (i / 11) * (Math.PI - 0.8);
        const sp = 9 + (i % 4) * 3.5;
        const px = Math.cos(ang) * sp * k * 1.7;
        const py = Math.sin(ang) * sp * k * 2.3 + 16 * k * k;
        ctx.globalAlpha = 1 - k * 0.7;
        ctx.fillStyle = i % 3 ? col("rockLit") : col("rock");
        ctx.fillRect(px - 0.35, Math.min(py, 0) - 0.35, 0.7 + (i % 3) * 0.2, 0.6 + (i % 2) * 0.2);
      }
      ctx.fillStyle = "rgba(170, 150, 120, 0.4)";
      for (let i = 0; i < 7; i++) {
        ctx.globalAlpha = (1 - k) * 0.7;
        circle(ctx, -6 + i * 2, -0.6 - k * (2 + (i % 3)), 0.9 + k * 1.2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    // Sinking: dust rising where he goes under.
    if (act === "dark" && drop > 0.5) {
      ctx.fillStyle = "rgba(170, 150, 120, 0.5)";
      for (let k = 0; k < 6; k++) {
        const rise = ((t / 380 + k / 6) % 1) * 3;
        circle(ctx, -4 + k * 1.6, -rise, 0.35 + rise * 0.12);
        ctx.fill();
      }
    }
    // Dazed: stars circling over his head.
    if (act === "dazed" && dazedP > 0.12) {
      for (let k = 0; k < 5; k++) {
        const q = t / 240 + (k * TAU) / 5;
        const sx = hx + Math.cos(q) * 3.2;
        const sy = hy - 5.2 + Math.sin(q) * 0.8;
        ctx.fillStyle = GOLD;
        poly(ctx, [[sx, sy - 0.5], [sx + 0.15, sy - 0.15], [sx + 0.5, sy], [sx + 0.15, sy + 0.15], [sx, sy + 0.5], [sx - 0.15, sy + 0.15], [sx - 0.5, sy], [sx - 0.15, sy - 0.15]]);
        ctx.fill();
        glow(sx, sy, 0.12, GOLD);
      }
    }
    ctx.restore();
  }

  return freeze({ figure });
}
