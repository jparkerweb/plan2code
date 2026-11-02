// Plan2Code Web Console - Ghoul Rush's Hollow End Village, its werewolf: one skeleton, drawn for both the Beast of Hollow End (ten and a half units tall, shaggy, a ruff of fur) and a turned villager (the same figure at half size in the rags of his clothes). A figure is a set of joints (hip, chest, neck, head, a leg and an arm to each side, a tail) that a pose names; poses blend, so a wind-up is the stand pose pulled toward the raised one by how far the wind-up has run.
//
// ghoul-village-draw.js plugs it in: wolfKit(d) takes ghoul-draw.js's own
// drawing helpers (`d`) and returns `figure(ctx, v, o)`, which draws one
// werewolf, and `POSES` for the tests. Everything is drawn in a local frame
// facing +x with y counted up from the feet (the context is scaled by the way it
// faces and flipped), then the eyes are handed to the dark's glowing pass in
// room coordinates. Joints are [x, y].

const freeze = (o) => Object.freeze(o);

// What a werewolf is made of: fur, its shadow side, the moonlit rim, the belly, the
// mane, the claws, the eyes. The Beast's rage turns the fur red and the mane gold.
export const STYLES = freeze({
  beast: freeze({ fur: "#4a4058", dark: "#2a2434", lit: "#dcc79c", belly: "#6c5c66", mane: "#8a7c9e", maneDark: "#3c3446", claw: "#ece4d0", eye: "#ffb028", out: "#14101a", ear: "#8a5a6a" }),
  rage: freeze({ fur: "#6c4452", dark: "#42283a", lit: "#e2b07a", belly: "#8a5a5a", mane: "#d2a26c", maneDark: "#7a4a3a", claw: "#fff0d0", eye: "#ff4a20", out: "#180d12", ear: "#a05060" }),
  wolfman: freeze({ fur: "#5a4c40", dark: "#342a22", lit: "#d4c4a0", belly: "#80705e", mane: "#74685a", maneDark: "#463c34", claw: "#e6dec8", eye: "#ff9a20", out: "#15100e", ear: "#8a5a5a" }),
  flash: freeze({ fur: "#efe6d6", dark: "#d8cfc0", lit: "#ffffff", belly: "#efe6d6", mane: "#efe6d6", maneDark: "#d8cfc0", claw: "#ffffff", eye: "#efe6d6", out: "#efe6d6", ear: "#efe6d6" }),
});

const P = (hip, chest, neck, head, ha, jaw, ln, lf, an, ac, af, acf, tail, extra = {}) => ({ hip, chest, neck, head, ha, jaw, ln, lf, an, ac, af, acf, tail, bulk: 1, ear: 0, hf: 1, ...extra });

// The poses (design height 10.5): walking upright and hunched, rearing for a
// swipe and for the howl, the swipe itself, coiled to spring, in the air, down on
// a knee after landing, clinging to a wall (facing the wall, the head turned back
// over the shoulder), cowering from Wolfsbane, and asleep or fallen.
export const POSES = freeze({
  stand: P([-1.2, 4.6], [0.9, 7.6], [1.9, 8.4], [3.1, 8.9], -0.15, 0.12, [[-1.2, 4.6], [0.2, 2.9], [-1.1, 1.5], [0.6, 0.1]], [[-1.2, 4.6], [-0.6, 2.9], [-1.9, 1.4], [-0.4, 0.1]], [[0.8, 7.2], [2.2, 5.3], [2.8, 3.3]], -1.0, [[0.6, 7.3], [1.5, 5.4], [2.2, 3.4]], -1.1, [[-1.6, 4.6], [-3.6, 4.0], [-4.9, 2.6]]),
  rear: P([-1.2, 4.8], [0.4, 8.0], [1.0, 9.0], [2.1, 9.8], 0.25, 0.55, [[-1.2, 4.8], [0.1, 3.0], [-1.2, 1.5], [0.5, 0.1]], [[-1.2, 4.8], [-0.7, 3.0], [-2.0, 1.4], [-0.5, 0.1]], [[0.4, 7.8], [0.9, 9.8], [-0.7, 11.7]], 2.3, [[0.2, 7.5], [1.5, 6.0], [2.4, 4.4]], -1.0, [[-1.6, 4.8], [-3.6, 4.4], [-5, 3.2]], { bulk: 1.08 }),
  swipe: P([-1.0, 4.4], [1.7, 7.0], [2.7, 7.6], [3.8, 7.9], -0.3, 0.7, [[-1.0, 4.4], [0.6, 2.8], [-0.6, 1.4], [1.2, 0.1]], [[-1.0, 4.4], [-1.2, 2.8], [-2.4, 1.4], [-0.9, 0.1]], [[1.5, 6.8], [3.6, 6.2], [5.8, 3.6]], -0.7, [[1.2, 7.0], [2.0, 5.2], [2.8, 3.6]], -1.1, [[-1.4, 4.4], [-3.6, 3.8], [-5, 2.2]], { bulk: 1.05 }),
  howl: P([-1.0, 4.6], [0.2, 7.8], [0.6, 9.2], [0.9, 10.4], 1.15, 0.85, [[-1.0, 4.6], [0.4, 2.9], [-0.9, 1.5], [0.8, 0.1]], [[-1.0, 4.6], [-0.8, 2.9], [-2.0, 1.4], [-0.6, 0.1]], [[0.2, 7.4], [0.9, 5.6], [0.3, 3.9]], -1.4, [[0.1, 7.5], [-0.3, 5.7], [-0.7, 4.0]], -1.5, [[-1.4, 4.6], [-3.4, 4.2], [-5.0, 3.0]], { bulk: 1.14 }),
  crouch: P([-1.6, 2.7], [0.7, 4.5], [1.8, 5.0], [3.0, 5.1], -0.2, 0.3, [[-1.6, 2.7], [0.5, 1.9], [-1.2, 0.8], [0.4, 0.1]], [[-1.6, 2.7], [0, 1.9], [-1.8, 0.8], [-0.2, 0.1]], [[0.7, 4.2], [2.0, 2.4], [2.9, 0.7]], -1.3, [[0.5, 4.2], [1.5, 2.5], [2.3, 0.7]], -1.3, [[-2, 2.8], [-4, 3.8], [-5, 5.4]], { bulk: 1.05 }),
  leap: P([-1.8, 4.4], [1.2, 5.0], [2.4, 5.3], [3.6, 5.3], -0.1, 0.9, [[-1.8, 4.4], [-0.8, 3.6], [-2.8, 3.8], [-3.8, 3.4]], [[-1.8, 4.4], [-1.2, 3.2], [-3.0, 3.0], [-4.0, 2.5]], [[1.1, 5.2], [2.8, 5.8], [4.4, 5.6]], 0.2, [[1.0, 5.0], [2.6, 4.6], [4.2, 4.2]], 0.1, [[-2.2, 4.5], [-4.2, 5.0], [-6, 4.6]], { bulk: 1.03 }),
  land: P([-1.4, 4.0], [1.1, 5.6], [2.2, 5.9], [3.4, 5.8], -0.1, 0.9, [[-1.4, 4.0], [0.6, 2.4], [-0.4, 1.2], [1.2, 0.1]], [[-1.4, 4.0], [-0.4, 2.2], [-1.8, 1.2], [-0.2, 0.1]], [[1.0, 5.4], [2.6, 3.8], [4.2, 2.0]], -0.6, [[0.9, 5.2], [2.2, 3.6], [3.4, 1.8]], -0.7, [[-1.8, 4.0], [-3.8, 3.4], [-5.2, 2.2]], { bulk: 1.05 }),
  rest: P([-1.4, 3.6], [0.4, 6.0], [1.3, 6.7], [2.4, 6.9], -0.35, 0.45, [[-1.4, 3.6], [0.6, 2.4], [-1.0, 1.2], [0.8, 0.1]], [[-1.4, 3.6], [-0.2, 2.2], [-1.9, 1.1], [-0.5, 0.1]], [[0.2, 5.8], [1.4, 3.6], [2.2, 0.8]], -1.5, [[0.1, 5.8], [0.2, 4.0], [1.0, 2.8]], -1.2, [[-1.8, 3.6], [-3.6, 3.0], [-5, 1.6]], { bulk: 1.08 }),
  cling: P([-0.8, 3.2], [-0.5, 7.2], [0.1, 8.8], [0.0, 10.0], 0.15, 0.6, [[-0.8, 3.2], [1.3, 2.6], [1.9, 1.0], [2.7, 0.5]], [[-0.8, 3.4], [1.4, 4.0], [2.1, 2.6], [2.9, 2.2]], [[0.5, 8.0], [1.6, 9.8], [2.5, 11.4]], 0.3, [[0.3, 7.8], [1.4, 9.0], [2.4, 10.2]], 0.2, [[-1.2, 3.2], [-2.2, 1.8], [-2.4, 0.2]], { bulk: 1.08, hf: -1 }),
  shy: P([-1.0, 3.8], [0.3, 6.4], [1.1, 6.6], [2.0, 6.0], -0.8, 0.0, [[-1.0, 3.8], [0.3, 2.5], [-1.0, 1.4], [0.6, 0.1]], [[-1.0, 3.8], [-0.6, 2.5], [-1.8, 1.4], [-0.4, 0.1]], [[0.3, 6.1], [1.5, 6.6], [2.2, 6.0]], 1.6, [[0.1, 6.1], [1.0, 4.3], [1.6, 3.0]], -1.2, [[-1.4, 3.6], [-0.8, 2.0], [0.2, 1.2]], { ear: 1 }),
  down: P([-3.2, 1.2], [-0.4, 1.9], [1.2, 1.7], [2.8, 1.1], -0.45, 0.2, [[-3.2, 1.2], [-1.8, 1.8], [-3.2, 0.8], [-1.8, 0.2]], [[-3.2, 1.2], [-2.4, 0.6], [-4, 0.5], [-3, 0.1]], [[-0.2, 1.7], [1.2, 0.8], [2.8, 0.3]], -0.3, [[-0.4, 1.8], [0.6, 0.6], [1.8, 0.2]], -0.2, [[-4.0, 1.2], [-5.4, 0.8], [-6.4, 0.3]], { ear: 1 }),
  sleep: P([-2.8, 1.4], [-0.6, 2.4], [0.8, 2.0], [2.0, 1.2], -0.5, 0, [[-2.8, 1.4], [-1.4, 2.0], [-2.8, 0.8], [-1.2, 0.2]], [[-2.8, 1.4], [-2.2, 0.8], [-3.6, 0.6], [-2.8, 0.1]], [[-0.2, 2.0], [1.0, 0.9], [2.4, 0.4]], -0.3, [[-0.3, 2.0], [0.6, 0.8], [1.8, 0.3]], -0.2, [[-3.6, 1.4], [-4.4, 0.4], [-2.4, 0.15]], { ear: 1 }),
});

// A pose blended `k` of the way from a to b (numbers and joints alike).
export function mixPose(a, b, k) {
  if (typeof a === "number") return a + (b - a) * k;
  if (Array.isArray(a)) return a.map((v, i) => mixPose(v, b[i], k));
  const o = {};
  for (const key of Object.keys(a)) o[key] = mixPose(a[key], b[key], k);
  return o;
}

export function wolfKit(d) {
  const { ellipse, circle } = d;

  const poly = (ctx, pts) => {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };

  // A tapered limb from p0 to p1: a dark outline, then the fur.
  function limb(ctx, S, p0, p1, r0, r1, fill, thick = 0.2) {
    const dx = p1[0] - p0[0];
    const dy = p1[1] - p0[1];
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L;
    const ny = dx / L;
    const pass = (a, b, color) => {
      ctx.fillStyle = color;
      poly(ctx, [[p0[0] + nx * a, p0[1] + ny * a], [p1[0] + nx * b, p1[1] + ny * b], [p1[0] - nx * b, p1[1] - ny * b], [p0[0] - nx * a, p0[1] - ny * a]]);
      ctx.fill();
      circle(ctx, p0[0], p0[1], a);
      ctx.fill();
      circle(ctx, p1[0], p1[1], b);
      ctx.fill();
    };
    pass(r0 + thick, r1 + thick, S.out);
    pass(r0, r1, fill);
  }

  // Claws spread from a paw at `at`, pointing along `ang`.
  function claws(ctx, S, at, ang, n, len) {
    ctx.fillStyle = S.claw;
    for (let i = 0; i < n; i++) {
      const a = ang + (i - (n - 1) / 2) * 0.3;
      const bx = at[0] + Math.cos(ang) * 0.1 + Math.cos(a + 1.57) * (i - (n - 1) / 2) * 0.18;
      const by = at[1] + Math.sin(ang) * 0.1 + Math.sin(a + 1.57) * (i - (n - 1) / 2) * 0.18;
      poly(ctx, [[bx + Math.cos(a + 1.57) * 0.14, by + Math.sin(a + 1.57) * 0.14], [bx + Math.cos(a) * len, by + Math.sin(a) * len], [bx - Math.cos(a + 1.57) * 0.14, by - Math.sin(a + 1.57) * 0.14]]);
      ctx.fill();
    }
  }

  function head(ctx, S, Ph, open) {
    const [hx, hy] = Ph.head;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(Ph.ha);
    ctx.scale(Ph.hf, 1);
    // The ears: up and pointed, or laid flat back when it cowers.
    const flat = Ph.ear;
    for (const [dx, far] of [[-0.55, true], [0.15, false]]) {
      ctx.save();
      ctx.translate(dx, 1.05);
      ctx.rotate(-flat * 1.1);
      ctx.fillStyle = S.out;
      poly(ctx, [[-0.75, -0.1], [-0.15, 1.75], [0.62, -0.1]]);
      ctx.fill();
      ctx.fillStyle = far ? S.dark : S.fur;
      poly(ctx, [[-0.55, 0], [-0.12, 1.35], [0.45, 0]]);
      ctx.fill();
      ctx.fillStyle = S.ear;
      poly(ctx, [[-0.3, 0.05], [-0.1, 0.9], [0.22, 0.05]]);
      ctx.fill();
      ctx.restore();
    }
    // Skull and the cheek's fur.
    ctx.fillStyle = S.out;
    ellipse(ctx, 0, 0, 1.85, 1.6);
    ctx.fill();
    ctx.fillStyle = S.fur;
    ellipse(ctx, 0, 0, 1.65, 1.4);
    ctx.fill();
    ctx.fillStyle = S.mane;
    for (let k = 0; k < 4; k++) poly(ctx, [[-1.5 + k * 0.15, -0.6 - k * 0.25], [-2.5 + k * 0.1, -0.9 - k * 0.45], [-1.2 + k * 0.15, -1.2 - k * 0.2]]), ctx.fill();
    // The lower jaw swings open about its hinge.
    ctx.save();
    ctx.translate(0.7, -0.55);
    ctx.rotate(-open * 0.8);
    ctx.fillStyle = S.out;
    poly(ctx, [[-0.2, 0.2], [2.7, 0.1], [2.8, -0.55], [2.3, -0.95], [-0.1, -0.85]]);
    ctx.fill();
    ctx.fillStyle = S.dark;
    poly(ctx, [[0, 0.1], [2.5, 0.05], [2.6, -0.4], [2.2, -0.75], [0, -0.7]]);
    ctx.fill();
    ctx.fillStyle = "#e8e2d0";
    for (const fx of [2.35, 1.5]) poly(ctx, [[fx - 0.18, 0.1], [fx + 0.18, 0.1], [fx, 0.7]]), ctx.fill();
    ctx.restore();
    // The mouth's inside, when it is open.
    if (open > 0.08) {
      ctx.fillStyle = "#4a0e14";
      poly(ctx, [[0.8, -0.5], [3.0, -0.5], [2.9 - 0.1, -0.5 - open * 1.5], [0.8 - 0.2, -0.55 - open * 0.6]]);
      ctx.fill();
      ctx.fillStyle = "#c04858";
      ellipse(ctx, 1.8, -0.55 - open * 0.55, 0.55, 0.16 + open * 0.2);
      ctx.fill();
    }
    // The upper snout, with its fangs and nose.
    ctx.fillStyle = S.out;
    poly(ctx, [[0.5, 0.95], [3.15, 0.45], [3.4, 0.0], [3.15, -0.5], [0.8, -0.6]]);
    ctx.fill();
    ctx.fillStyle = S.fur;
    poly(ctx, [[0.6, 0.78], [3.0, 0.35], [3.2, 0.0], [2.95, -0.38], [0.9, -0.45]]);
    ctx.fill();
    ctx.fillStyle = S.belly;
    poly(ctx, [[1.0, -0.1], [2.9, -0.1], [2.95, -0.38], [0.9, -0.45]]);
    ctx.fill();
    ctx.fillStyle = "#e8e2d0";
    for (const fx of [2.55, 1.7]) poly(ctx, [[fx - 0.2, -0.38], [fx + 0.18, -0.4], [fx, -1.05 - open * 0.15]]), ctx.fill();
    ctx.fillStyle = "#08060a";
    circle(ctx, 3.2, 0.12, 0.3);
    ctx.fill();
    if (open <= 0.08 || Ph.ear) {
      // A snarl's wrinkles over the muzzle.
      ctx.strokeStyle = S.dark;
      ctx.lineWidth = 0.1;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(1.8 + k * 0.3, 0.35);
        ctx.lineTo(1.6 + k * 0.3, 0.05);
      }
      ctx.stroke();
    }
    // The brow, heavy and angry, over the eye.
    ctx.fillStyle = S.out;
    poly(ctx, [[0.2, 0.9], [1.6, 0.35], [1.55, 0.7], [0.3, 1.1]]);
    ctx.fill();
    ctx.restore();
  }

  // One werewolf. o: { x, y (feet, canvas), dir, sc, pose (a pose object), t,
  // style, rot (turned in the air), pivot, open (jaw override), weak (a glowing
  // mark on its flank), rags (a villager's tunic color), eyeR }.
  function figure(ctx, v, o) {
    const S = STYLES[o.style];
    const Pz = o.pose;
    const dir = o.dir || 1;
    const sc = o.sc;
    const rot = o.rot || 0;
    const pv = o.pivot || [0, 4.6];
    const at = (lx, ly) => {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      const rx = pv[0] + (lx - pv[0]) * c - (ly - pv[1]) * s;
      const ry = pv[1] + (lx - pv[0]) * s + (ly - pv[1]) * c;
      return [o.x + dir * sc * rx, o.y - sc * ry];
    };
    ctx.save();
    ctx.translate(o.x, o.y);
    ctx.scale(dir * sc, -sc);
    if (rot) {
      ctx.translate(pv[0], pv[1]);
      ctx.rotate(rot);
      ctx.translate(-pv[0], -pv[1]);
    }
    const bulk = Pz.bulk;
    const limbs = (leg, arm, far) => {
      const f = far ? S.dark : S.fur;
      // Thigh, shin and foot; then the arm.
      limb(ctx, S, leg[0], leg[1], 1.45 * bulk, 1.0, f);
      limb(ctx, S, leg[1], leg[2], 0.95, 0.65, f);
      limb(ctx, S, leg[2], leg[3], 0.62, 0.55, f);
      claws(ctx, S, leg[3], 0.1, 3, 0.55);
      // A villager's trousers, torn off at the knee.
      if (o.rags) limb(ctx, { ...S, out: "rgba(0,0,0,0)" }, leg[0], [(leg[0][0] + leg[1][0]) / 2, (leg[0][1] + leg[1][1]) / 2], 1.5 * bulk, 1.25, o.rags, 0);
      limb(ctx, S, arm[0], arm[1], 0.95 * bulk, 0.72, f);
      limb(ctx, S, arm[1], arm[2], 0.72, 0.62, f);
    };
    const [ln, lf, an, af] = [Pz.ln, Pz.lf, Pz.an, Pz.af];
    // The far side: its leg and its arm, darker.
    limb(ctx, S, lf[0], lf[1], 1.3 * bulk, 0.95, S.dark);
    limb(ctx, S, lf[1], lf[2], 0.9, 0.62, S.dark);
    limb(ctx, S, lf[2], lf[3], 0.58, 0.5, S.dark);
    claws(ctx, S, lf[3], 0.1, 3, 0.5);
    limb(ctx, S, af[0], af[1], 0.85 * bulk, 0.68, S.dark);
    limb(ctx, S, af[1], af[2], 0.68, 0.58, S.dark);
    claws(ctx, S, af[2], Pz.acf, 4, 0.8);
    // The tail, bushy.
    const [t0, t1, t2] = Pz.tail;
    limb(ctx, S, t0, t1, 0.8 * bulk, 0.95, S.fur);
    limb(ctx, S, t1, t2, 0.95, 0.35, S.fur);
    // The body: hip to chest, a hump at the shoulder, a lighter belly.
    const [hp, ch] = [Pz.hip, Pz.chest];
    limb(ctx, S, hp, ch, 2.25 * bulk, 2.85 * bulk, S.fur, 0.24);
    const tx = ch[0] - hp[0];
    const ty = ch[1] - hp[1];
    const tl = Math.hypot(tx, ty) || 1;
    const nx = ty / tl;
    const ny = -tx / tl;
    ctx.fillStyle = S.belly;
    ellipse(ctx, (hp[0] + ch[0]) / 2 + nx * 1.1 * bulk, (hp[1] + ch[1]) / 2 + ny * 1.1 * bulk, 1.0 * bulk, tl * 0.4 + 0.5, Math.atan2(ty, tx) - Math.PI / 2);
    ctx.fill();
    if (o.rags) {
      // A tunic in tatters over the chest, split where the fur has burst it.
      ctx.fillStyle = o.rags;
      poly(ctx, [[hp[0] - nx * 2.2, hp[1] - ny * 2.2], [ch[0] - nx * 2.7 + tx * 0.1, ch[1] - ny * 2.7], [ch[0] + nx * 0.4, ch[1] + ny * 0.4 - 0.4], [hp[0] + nx * 0.2, hp[1] + ny * 0.2 - 0.9]]);
      ctx.fill();
      ctx.fillStyle = S.fur;
      for (let k = 0; k < 3; k++) poly(ctx, [[hp[0] - nx * 2 + tx * (0.3 + k * 0.2), hp[1] - ny * 2 + ty * (0.3 + k * 0.2)], [hp[0] - nx * 0.6 + tx * (0.35 + k * 0.2), hp[1] - ny * 0.6 + ty * (0.35 + k * 0.2)], [hp[0] - nx * 1.2 + tx * (0.55 + k * 0.2), hp[1] - ny * 1.2 + ty * (0.55 + k * 0.2)]]), ctx.fill();
    }
    // Fur: tufts down the back, strokes across the flank.
    ctx.fillStyle = S.maneDark;
    for (let k = 0; k <= 11; k++) {
      const q = k / 11;
      const bx = hp[0] + tx * q - nx * (2.2 + 0.6 * q) * bulk;
      const by = hp[1] + ty * q - ny * (2.2 + 0.6 * q) * bulk;
      const ux = tx / tl;
      const uy = ty / tl;
      poly(ctx, [[bx - ux * 0.22, by - uy * 0.22], [bx + ux * 0.22, by + uy * 0.22], [bx - nx * 0.65 - ux * 0.4, by - ny * 0.65 - uy * 0.4]]);
      ctx.fill();
    }
    ctx.strokeStyle = S.dark;
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const q = (k + 0.5) / 9;
      const fx = hp[0] + tx * q - nx * 0.3;
      const fy = hp[1] + ty * q - ny * 0.3;
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx - nx * 0.8 - tx * 0.1, fy - ny * 0.8 - ty * 0.1);
    }
    ctx.stroke();
    // The moon along its back.
    ctx.strokeStyle = S.lit;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 0.22;
    ctx.beginPath();
    ctx.moveTo(hp[0] - nx * 2.2 * bulk, hp[1] - ny * 2.2 * bulk);
    ctx.lineTo(ch[0] - nx * 2.85 * bulk, ch[1] - ny * 2.85 * bulk);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // A weak spot: a patch of bare, pale skin on the flank that pulses.
    if (o.weak) {
      const pulse = 0.55 + 0.45 * Math.sin((v.clock || 0) / 90);
      const wx = (hp[0] + ch[0]) / 2 + nx * 0.4;
      const wy = (hp[1] + ch[1]) / 2 + ny * 0.4;
      ctx.fillStyle = `rgba(255, 214, 120, ${0.25 + 0.3 * pulse})`;
      circle(ctx, wx, wy, 1.5 + pulse * 0.4);
      ctx.fill();
      ctx.fillStyle = `rgba(255, 244, 200, ${0.75 + 0.25 * pulse})`;
      ellipse(ctx, wx, wy, 0.62, 0.9);
      ctx.fill();
      ctx.strokeStyle = "#8a2a1a";
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(wx - 0.3, wy + 0.4);
      ctx.lineTo(wx + 0.3, wy - 0.4);
      ctx.moveTo(wx + 0.3, wy + 0.4);
      ctx.lineTo(wx - 0.3, wy - 0.4);
      ctx.stroke();
    }
    // The ruff round the neck: spikes of mane.
    const nk = Pz.neck;
    for (let k = 0; k < 11; k++) {
      const a = Math.PI * 0.4 + k * 0.33 + Pz.ha * 0.4;
      const r = 1.25 * bulk;
      const len = (o.style === "beast" || o.style === "rage" ? 1.25 : 0.9) * (0.8 + (k % 3) * 0.25);
      ctx.fillStyle = k % 2 ? S.mane : S.maneDark;
      poly(ctx, [[nk[0] + Math.cos(a) * r, nk[1] + Math.sin(a) * r], [nk[0] + Math.cos(a + 0.3) * (r + len), nk[1] + Math.sin(a + 0.3) * (r + len)], [nk[0] + Math.cos(a + 0.34) * r, nk[1] + Math.sin(a + 0.34) * r]]);
      ctx.fill();
    }
    // The near leg, then the head, then the near arm in front of it all.
    limbs(ln, an, false);
    head(ctx, S, Pz, o.open ?? Pz.jaw);
    claws(ctx, S, an[2], Pz.ac, 4, 0.9);
    ctx.restore();
    // Its eyes burn in the dark: in the head's frame, then the room's.
    const Hh = Pz.head;
    const cs = Math.cos(Pz.ha);
    const sn = Math.sin(Pz.ha);
    const ex = Pz.hf * 0.95;
    const ey = 0.38;
    const [wx, wy] = at(Hh[0] + ex * cs - ey * sn, Hh[1] + ex * sn + ey * cs);
    if (o.style !== "flash" && !o.shut) {
      v.eyes.push(wx, wy, (o.eyeR || 0.32) * sc * 1.05, S.eye);
    } else if (o.shut) {
      ctx.strokeStyle = S.out;
      ctx.lineWidth = 0.14;
      ctx.beginPath();
      ctx.moveTo(wx - 0.3 * sc, wy);
      ctx.lineTo(wx + 0.3 * sc, wy + 0.05);
      ctx.stroke();
    }
    return { at, eye: [wx, wy] };
  }

  return freeze({ figure, limb, claws });
}
