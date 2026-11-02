// Plan2Code Web Console - mini golf's Candy Carnival look: the course's palette, ground, water, props and scenery.
//
// Drawing only, listed in golf-looks.js (which documents what a look holds).
// A sugar-sky fairground strewn with sprinkles: mint frosting, cotton candy,
// waffle and grape greens, candy cane rails, chocolate and strawberry soda,
// gumdrops, gummy bears, peppermint pinwheels and a chocolate fountain.

import { circle, ellipse, fill, label, line, polygon, scatter, stroke, t, turned } from "./golf-paint.js";

// The candy colors the props pick from, by a fixed number of their own.
const CANDY = ["#ff5c8a", "#ffb347", "#ffe066", "#6fd47b", "#5fb8ff", "#b48cff"];
const pick = (n) => CANDY[Math.abs(Math.round(n)) % CANDY.length];

// A rounded box, for wrappers, tents and waffle plates.
function box(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A ground shadow under a prop.
const shadow = (ctx, p, x, y, rx, ry) => {
  ellipse(ctx, x, y, rx, ry);
  fill(ctx, p.shadow);
};

// A peppermint disc: white with red wedges, turned by `spin`.
function peppermint(ctx, x, y, r, spin) {
  circle(ctx, x, y, r);
  fill(ctx, "#ffffff");
  for (let i = 0; i < 6; i++) {
    const a = spin + (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r * 0.92, a, a + Math.PI / 6);
    ctx.closePath();
    fill(ctx, "#e8314a");
  }
  circle(ctx, x, y, r);
  stroke(ctx, "#c92a40", Math.max(0.6, r * 0.12));
  circle(ctx, x - r * 0.35, y - r * 0.4, r * 0.18);
  fill(ctx, "rgba(255,255,255,0.8)");
}

// A lollipop's swirl disc, turning with `spin`.
function swirl(ctx, x, y, r, color, spin) {
  circle(ctx, x, y, r);
  fill(ctx, "#fff7fb");
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const u = i / 40;
    const a = spin + u * Math.PI * 5;
    const q = { x: x + Math.cos(a) * r * u, y: y + Math.sin(a) * r * u };
    if (i) ctx.lineTo(q.x, q.y);
    else ctx.moveTo(q.x, q.y);
  }
  stroke(ctx, color, r * 0.32);
  circle(ctx, x, y, r);
  stroke(ctx, color, r * 0.14);
}

// A gummy bear seen from above, `r` its reach, in `color`; its legs paddle with the clock.
function gummyBear(ctx, x, y, r, color, clock) {
  const step = Math.sin(t(clock) * 9) * r * 0.12;
  ctx.globalAlpha = 0.92;
  for (const [dx, dy] of [[-0.55, 0.75], [0.55, 0.75]]) {
    ellipse(ctx, x + dx * r, y + dy * r + (dx < 0 ? step : -step), r * 0.32, r * 0.26);
    fill(ctx, color);
  }
  for (const [dx, dy] of [[-0.75, 0.1], [0.75, 0.1]]) {
    ellipse(ctx, x + dx * r, y + dy * r + (dx < 0 ? -step : step), r * 0.26, r * 0.32);
    fill(ctx, color);
  }
  ellipse(ctx, x, y + r * 0.3, r * 0.62, r * 0.6);
  fill(ctx, color);
  for (const dx of [-0.42, 0.42]) {
    circle(ctx, x + dx * r, y - r * 0.85, r * 0.2);
    fill(ctx, color);
  }
  circle(ctx, x, y - r * 0.5, r * 0.46);
  fill(ctx, color);
  ctx.globalAlpha = 1;
  // A glossy shine, a snout and two dot eyes.
  ellipse(ctx, x - r * 0.2, y + r * 0.1, r * 0.14, r * 0.28, -0.4);
  fill(ctx, "rgba(255,255,255,0.55)");
  ellipse(ctx, x, y - r * 0.38, r * 0.2, r * 0.14);
  fill(ctx, "rgba(255,255,255,0.45)");
  for (const dx of [-0.17, 0.17]) {
    circle(ctx, x + dx * r, y - r * 0.6, r * 0.07 + 0.3);
    fill(ctx, "#3b1e12");
  }
}

// A gingerbread man, `s` its size; his arm waves with the clock.
function gingerman(ctx, x, y, s, clock) {
  const wave = Math.sin(t(clock) * 4 + x) * 0.5;
  const body = "#b8692e";
  ctx.lineCap = "round";
  line(ctx, x - 4 * s, y + 2 * s, x - 6 * s, y + 10 * s, body, 3.4 * s);
  line(ctx, x + 4 * s, y + 2 * s, x + 6 * s, y + 10 * s, body, 3.4 * s);
  line(ctx, x - 3 * s, y - 3 * s, x - 9 * s, y - 1 * s, body, 3.2 * s);
  line(ctx, x + 3 * s, y - 3 * s, x + 9 * s, y - 5 * s - wave * 5 * s, body, 3.2 * s);
  ellipse(ctx, x, y + 0.5 * s, 5 * s, 6.5 * s);
  fill(ctx, body);
  circle(ctx, x, y - 8 * s, 4.4 * s);
  fill(ctx, body);
  // Icing: eyes, a smile, buttons and cuffs.
  for (const dx of [-1.5, 1.5]) {
    circle(ctx, x + dx * s, y - 8.6 * s, 0.7 * s);
    fill(ctx, "#ffffff");
  }
  ctx.beginPath();
  ctx.arc(x, y - 7.6 * s, 2 * s, 0.3, Math.PI - 0.3);
  stroke(ctx, "#ffffff", 0.7 * s);
  for (const [dy, c] of [[-1.5, "#ff5c8a"], [1.5, "#6fd47b"]]) {
    circle(ctx, x, y + dy * s, 1 * s);
    fill(ctx, c);
  }
}

// A wavy row of piped icing along a band, for the frosting ground.
function piped(ctx, x0, x1, y, amp, color, width) {
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 4) {
    const wy = y + Math.sin(x / 7) * amp;
    if (x === x0) ctx.moveTo(x, wy);
    else ctx.lineTo(x, wy);
  }
  stroke(ctx, color, width);
}

export default {
  palette: {
    rough: "#a9dcf4",
    roughMark: "#ffffff",
    foam: "rgba(255, 128, 186, 0.9)",
    shore: "#fff7fb",
    turf: "#56bf98",
    stripe: "#4fb38d",
    sand: "#f0bd72",
    speckle: "#a85a24",
    ice: "#c4e9ff",
    iceLine: "#ffffff",
    wall: "#e2364c",
    wallTop: "#ffffff",
    slope: "#3a2833",
    arrow: "rgba(255, 176, 216, 0.9)",
    bridge: "#ecb965",
    plank: "#b67b2c",
    spinner: "#e2364c",
    hub: "#ffffff",
    portalA: "#d81b60",
    portalB: "#2a1d26",
    cup: "#3b1e12",
    flag: "#ff4f9a",
    flagMark: "#ffffff",
    pad: "#fff06e",
    spy: "#fff06e",
    banner: "#fff1f8",
    bannerLine: "#ff6fae",
    bannerInk: "#9a1f5c",
    bannerRound: 10,
    dark: 0,
  },

  liquids: {
    // A glossy chocolate river, slow ripples.
    chocolate: { fill: "#6b3820", ripple: "#a4643b", glow: null },
    // Strawberry soda, fizzing.
    soda: { fill: "#f2557f", ripple: "#ffb8cc", glow: null, bubbles: "#fff3f7" },
  },

  grounds: {
    // Mint frosting: wide piped bands and a few sugar pearls.
    frosting(ctx, p, course) {
      ctx.fillStyle = p.turf;
      ctx.fillRect(0, 0, course.w, course.h);
      for (let y = 10; y < course.h; y += 30) piped(ctx, 0, course.w, y, 3, p.stripe, 12);
      ctx.globalAlpha = 0.5;
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 19, 7)) {
        circle(ctx, q.x, q.y, 0.9);
        fill(ctx, "#e9fff6");
      }
      ctx.globalAlpha = 1;
    },
    // Cotton candy: pink fluff in soft puffs.
    cotton(ctx, p, course) {
      ctx.fillStyle = "#d9759f";
      ctx.fillRect(0, 0, course.w, course.h);
      let i = 0;
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 16, 23)) {
        circle(ctx, q.x, q.y, 5 + (i++ % 3) * 2);
        fill(ctx, i % 2 ? "#df7fa8" : "#d16c97");
      }
    },
    // A golden waffle: a grid of square pockets.
    waffle(ctx, p, course) {
      ctx.fillStyle = "#c98d42";
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.fillStyle = "#b9792f";
      for (let y = 0; y < course.h; y += 16) {
        for (let x = 0; x < course.w; x += 16) ctx.fillRect(x + 3, y + 3, 10, 10);
      }
      ctx.fillStyle = "rgba(255, 226, 160, 0.35)";
      for (let y = 0; y < course.h; y += 16) ctx.fillRect(0, y, course.w, 1.2);
      for (let x = 0; x < course.w; x += 16) ctx.fillRect(x, 0, 1.2, course.h);
    },
    // Grape frosting: lavender stripes with sugar dots.
    grape(ctx, p, course) {
      ctx.fillStyle = "#8f78cf";
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.fillStyle = "#8670c6";
      for (let x = 0; x < course.w; x += 40) ctx.fillRect(x, 0, 20, course.h);
      ctx.globalAlpha = 0.5;
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 17, 9)) {
        circle(ctx, q.x, q.y, 0.9);
        fill(ctx, "#f1eaff");
      }
      ctx.globalAlpha = 1;
    },
  },

  // The sky round the green: rainbow sprinkles and white sugar dots.
  rough(ctx, p, course) {
    let i = 0;
    ctx.lineCap = "round";
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 13, 31)) {
      const a = (i * 2.4) % Math.PI;
      if (i % 4 === 3) {
        circle(ctx, q.x, q.y, 1.6);
        fill(ctx, "rgba(255,255,255,0.7)");
      } else {
        line(ctx, q.x - Math.cos(a) * 2.6, q.y - Math.sin(a) * 2.6, q.x + Math.cos(a) * 2.6, q.y + Math.sin(a) * 2.6, CANDY[i % CANDY.length], 1.6);
      }
      i++;
    }
  },

  // A licorice pipe's mouth: a twisted red rope going in, a black one coming out.
  tunnel(ctx, p, m, k, i, clock, r) {
    const rope = k ? "#2a1d26" : "#d81b60";
    const twist = k ? "#5a4352" : "#ff6f9f";
    circle(ctx, m.x + 1.2, m.y + 1.8, r + 3);
    fill(ctx, p.shadow);
    circle(ctx, m.x, m.y, r + 3);
    fill(ctx, rope);
    for (let j = 0; j < 10; j++) {
      const a = (j / 10) * Math.PI * 2 + t(clock) * (k ? -1 : 1);
      line(ctx, m.x + Math.cos(a) * (r - 0.5), m.y + Math.sin(a) * (r - 0.5), m.x + Math.cos(a + 0.3) * (r + 3), m.y + Math.sin(a + 0.3) * (r + 3), twist, 1.2);
    }
    circle(ctx, m.x, m.y, r - 1);
    fill(ctx, "#140b10");
    circle(ctx, m.x, m.y, r - 1);
    stroke(ctx, "rgba(255,255,255,0.25)", 0.8);
  },

  bumpers: {
    // A sugared gumdrop: a colored dome with a shine and sugar crystals.
    gumdrop(ctx, p, b) {
      const { x, y, r } = b;
      const color = pick(x / 7 + y / 11);
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      circle(ctx, x, y, r);
      fill(ctx, color);
      circle(ctx, x, y, r);
      stroke(ctx, "rgba(0,0,0,0.18)", 1);
      circle(ctx, x - r * 0.1, y - r * 0.15, r * 0.7);
      fill(ctx, "rgba(255,255,255,0.18)");
      ellipse(ctx, x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.16, -0.6);
      fill(ctx, "rgba(255,255,255,0.75)");
      for (const [dx, dy] of [[0.3, -0.5], [0.5, 0.1], [-0.4, 0.35], [0.05, 0.55], [0.2, 0.2]]) {
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fillRect(x + dx * r - 0.5, y + dy * r - 0.5, 1, 1);
      }
    },
    // A frosted donut with sprinkles.
    donut(ctx, p, b) {
      const { x, y, r } = b;
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      circle(ctx, x, y, r);
      fill(ctx, "#e0a75e");
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const rr = r * (0.84 + Math.sin(i * 2.7) * 0.06);
        if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.moveTo(x + rr, y);
      }
      ctx.closePath();
      fill(ctx, "#ff8fc0");
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const d = r * (i % 2 ? 0.55 : 0.68);
        turned(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, a * 2, () => {
          ctx.fillStyle = CANDY[i % CANDY.length];
          ctx.fillRect(-1.3, -0.45, 2.6, 0.9);
        });
      }
      circle(ctx, x, y, r * 0.3);
      fill(ctx, "#8f5a26");
      circle(ctx, x, y, r * 0.24);
      fill(ctx, p.shadow);
    },
    // A swirl lollipop seen end on, turning slowly.
    lollipop(ctx, p, b, clock) {
      const { x, y, r } = b;
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      swirl(ctx, x, y, r, pick(x / 5 + y / 3), t(clock) * 1.2);
    },
    // A glossy gumball.
    gumball(ctx, p, b) {
      const { x, y, r } = b;
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      circle(ctx, x, y, r);
      fill(ctx, pick(x / 3 + y / 9 + r));
      circle(ctx, x + r * 0.15, y + r * 0.2, r * 0.75);
      fill(ctx, "rgba(0,0,0,0.12)");
      circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.28);
      fill(ctx, "rgba(255,255,255,0.8)");
    },
    // A candy heart.
    heart(ctx, p, b, clock) {
      const { x, y, r } = b;
      const beat = 1 + Math.max(0, Math.sin(t(clock) * 5)) * 0.06;
      const s = r * beat;
      const draw = (dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy + s * 0.95);
        ctx.bezierCurveTo(x + dx - s * 1.5, y + dy, x + dx - s * 0.9, y + dy - s * 1.15, x + dx, y + dy - s * 0.45);
        ctx.bezierCurveTo(x + dx + s * 0.9, y + dy - s * 1.15, x + dx + s * 1.5, y + dy, x + dx, y + dy + s * 0.95);
        ctx.closePath();
      };
      draw(1.5, 2);
      fill(ctx, p.shadow);
      draw(0, 0);
      fill(ctx, "#b6f2d0");
      draw(0, 0);
      stroke(ctx, "#3fa874", 1);
      label(ctx, "SWEET", x, y - s * 0.05, s * 0.38, "#2e7d57");
    },
    default(ctx, p, b, clock) {
      this.gumdrop(ctx, p, b, clock);
    },
  },

  movers: {
    // A gummy bear: its color by its size, so a parade is a rainbow.
    gummy(ctx, p, m, clock) {
      shadow(ctx, p, m.x + 1.5, m.y + 2.5, m.r * 0.95, m.r * 0.9);
      gummyBear(ctx, m.x, m.y, m.r * 1.1, pick(m.r), clock);
    },
    // A gingerbread man on the march.
    gingerman(ctx, p, m, clock) {
      shadow(ctx, p, m.x + 1.5, m.y + 2.5, m.r, m.r * 0.9);
      gingerman(ctx, m.x, m.y + m.r * 0.15, m.r / 9.5, clock);
    },
    default(ctx, p, m, clock) {
      this.gummy(ctx, p, m, clock);
    },
  },

  spinners: {
    // A striped peppermint stick through a big peppermint hub.
    pinwheel(ctx, p, s, clock) {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      ctx.lineCap = "round";
      line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, p.shadow, 6);
      line(ctx, s.x1, s.y1, s.x2, s.y2, "#ffffff", 5);
      ctx.save();
      ctx.setLineDash([3, 3]);
      line(ctx, s.x1, s.y1, s.x2, s.y2, "#e2364c", 5);
      ctx.restore();
      line(ctx, s.x1, s.y1, s.x2, s.y2, "rgba(255,255,255,0.35)", 1.2);
      circle(ctx, s.x + 1.5, s.y + 2, 10);
      fill(ctx, p.shadow);
      peppermint(ctx, s.x, s.y, 10, angle);
    },
    // A candy cane: a striped bar with its hook at one end.
    candycane(ctx, p, s) {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const arm = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
      ctx.lineCap = "round";
      line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, p.shadow, 6);
      turned(ctx, s.x, s.y, angle, () => {
        ctx.beginPath();
        ctx.moveTo(-arm, 0);
        ctx.lineTo(arm - 5, 0);
        ctx.arc(arm - 5, 5, 5, -Math.PI / 2, Math.PI * 0.2);
        stroke(ctx, "#ffffff", 5);
        ctx.save();
        ctx.setLineDash([3.5, 3.5]);
        stroke(ctx, "#e2364c", 5);
        ctx.restore();
        line(ctx, -arm, -1.2, arm - 5, -1.2, "rgba(255,255,255,0.45)", 1);
      });
      circle(ctx, s.x, s.y, 4);
      fill(ctx, "#2ea86a");
      circle(ctx, s.x, s.y, 4);
      stroke(ctx, "#ffffff", 1);
    },
    default(ctx, p, s, clock) {
      this.pinwheel(ctx, p, s, clock);
    },
  },

  gates: {
    // A waffle iron: shut, a hot golden plate with its grid; open, a dashed
    // slot that glows red and the plate shakes just before it slams.
    waffle(ctx, p, g, clock) {
      const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      const angle = Math.atan2(g.y2 - g.y1, g.x2 - g.x1);
      const soon = !g.shut && g.phase > g.open - 0.15;
      const shake = soon ? Math.sin(clock / 18) * 1.2 : 0;
      turned(ctx, (g.x1 + g.x2) / 2 + shake, (g.y1 + g.y2) / 2, angle, () => {
        if (g.shut) {
          box(ctx, -len / 2 + 1.5, -5, len, 12, 3);
          fill(ctx, p.shadow);
          box(ctx, -len / 2, -6.5, len, 13, 3);
          fill(ctx, "#3e3a45");
          box(ctx, -len / 2 + 3, -3.5, len - 6, 7, 2);
          fill(ctx, "#eab15a");
          ctx.fillStyle = "#b8772a";
          for (let x = -len / 2 + 5; x < len / 2 - 6; x += 5) ctx.fillRect(x, -2.2, 3.2, 4.4);
          line(ctx, -len / 2 + 2, -5.4, len / 2 - 2, -5.4, "rgba(255,255,255,0.35)", 1);
          // Steam off the hot iron.
          for (let i = 0; i < 3; i++) {
            const k = (t(clock) * 0.8 + i / 3) % 1;
            circle(ctx, (i - 1) * len * 0.3, -8 - k * 10, 1.5 + k * 2.5);
            fill(ctx, `rgba(255,255,255,${0.6 * (1 - k)})`);
          }
        } else {
          ctx.fillStyle = soon ? "rgba(255, 70, 50, 0.75)" : "rgba(62, 58, 69, 0.55)";
          for (let x = -len / 2; x < len / 2; x += 9) ctx.fillRect(x, -1.5, 5, 3);
          for (const end of [-len / 2, len / 2]) {
            circle(ctx, end, 0, 3);
            fill(ctx, "#3e3a45");
          }
        }
      });
    },
    default(ctx, p, g, clock) {
      this.waffle(ctx, p, g, clock);
    },
  },

  wells: {
    // A whirlpool: three swirling arms winding into the middle.
    whirl(ctx, p, w, clock) {
      const spin = t(clock) * 1.6;
      ctx.save();
      ctx.lineCap = "round";
      for (let arm = 0; arm < 3; arm++) {
        for (let i = 0; i < 18; i++) {
          const u = i / 18;
          const u2 = (i + 1) / 18;
          const a = spin + (arm / 3) * Math.PI * 2 + u * 4;
          const a2 = spin + (arm / 3) * Math.PI * 2 + u2 * 4;
          const r1 = w.r * (1 - u);
          const r2 = w.r * (1 - u2);
          ctx.globalAlpha = 0.15 + 0.55 * u;
          line(ctx, w.x + Math.cos(a) * r1, w.y + Math.sin(a) * r1, w.x + Math.cos(a2) * r2, w.y + Math.sin(a2) * r2, "#ffe9f2", 1.6);
        }
      }
      ctx.restore();
    },
    // A sugar swirl round the cup: golden rings sliding in.
    sugar(ctx, p, w, clock) {
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const k = (((i / 4 - t(clock) * 0.4) % 1) + 1) % 1;
        ctx.globalAlpha = 0.7 * (1 - k * 0.8) * k;
        ctx.setLineDash([2, 3]);
        circle(ctx, w.x, w.y, 7 + k * (w.r - 7));
        stroke(ctx, "#fff06e", 1.4);
      }
      ctx.restore();
    },
    default(ctx, p, w, clock) {
      this.whirl(ctx, p, w, clock);
    },
  },

  decor: {
    // A big swirl lollipop on its stick.
    lollipop: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        line(ctx, d.x + 1, d.y + 2, d.x + 1, d.y + 22 * s, "#ffffff", 2 * s);
        line(ctx, d.x + 2, d.y + 2, d.x + 2, d.y + 22 * s, "rgba(0,0,0,0.12)", 0.8 * s);
        circle(ctx, d.x + 1.5, d.y + 2, 12 * s);
        fill(ctx, p.shadow);
        swirl(ctx, d.x, d.y, 12 * s, pick(d.x / 9 + d.y / 7), t(clock) * 0.8);
        circle(ctx, d.x - 4 * s, d.y - 4 * s, 2.5 * s);
        fill(ctx, "rgba(255,255,255,0.7)");
      },
    },
    // A cupcake: a striped wrapper, a frosting swirl and a cherry.
    cupcake: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        const { x, y } = d;
        shadow(ctx, p, x + 1, y + 11 * s, 11 * s, 3 * s);
        polygon(ctx, [{ x: x - 10 * s, y: y }, { x: x + 10 * s, y: y }, { x: x + 7 * s, y: y + 11 * s }, { x: x - 7 * s, y: y + 11 * s }]);
        fill(ctx, "#5fb8ff");
        for (let k = -2; k <= 2; k++) line(ctx, x + k * 3.6 * s, y, x + k * 2.6 * s, y + 11 * s, "#a8dcff", 1.2 * s);
        const icing = pick(d.x / 13 + 2);
        for (const [dx, dy, r] of [[-6, -1, 5], [6, -1, 5], [0, -2, 6], [-3, -6, 4.5], [3, -6, 4.5], [0, -10, 3.5]]) {
          circle(ctx, x + dx * s, y + dy * s, r * s);
          fill(ctx, icing);
        }
        circle(ctx, x - 2 * s, y - 6 * s, 1.6 * s);
        fill(ctx, "rgba(255,255,255,0.6)");
        circle(ctx, x, y - 14 * s, 2.6 * s);
        fill(ctx, "#e2364c");
        line(ctx, x, y - 16 * s, x + 2.5 * s, y - 19 * s, "#3e8a3a", 0.8 * s);
      },
    },
    // An ice cream cone, two scoops, a drip that swings.
    cone: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        polygon(ctx, [{ x: x - 7 * s, y: y }, { x: x + 7 * s, y: y }, { x: x, y: y + 20 * s }]);
        fill(ctx, "#e0a75e");
        ctx.save();
        polygon(ctx, [{ x: x - 7 * s, y: y }, { x: x + 7 * s, y: y }, { x: x, y: y + 20 * s }]);
        ctx.clip();
        for (let k = -3; k <= 3; k++) {
          line(ctx, x + k * 4 * s - 8 * s, y, x + k * 4 * s + 8 * s, y + 20 * s, "#b47a35", 0.8 * s);
          line(ctx, x + k * 4 * s + 8 * s, y, x + k * 4 * s - 8 * s, y + 20 * s, "#b47a35", 0.8 * s);
        }
        ctx.restore();
        circle(ctx, x, y - 3 * s, 7.5 * s);
        fill(ctx, "#ffb3cf");
        circle(ctx, x, y - 12 * s, 6.5 * s);
        fill(ctx, "#a8f0c8");
        const drip = 2 + Math.sin(t(clock) * 1.5 + x) * 1.2;
        ellipse(ctx, x + 4 * s, y + 3 * s + drip * s * 0.5, 1.6 * s, drip * s);
        fill(ctx, "#ffb3cf");
        circle(ctx, x - 2.5 * s, y - 14.5 * s, 1.8 * s);
        fill(ctx, "rgba(255,255,255,0.7)");
        circle(ctx, x, y - 19 * s, 2 * s);
        fill(ctx, "#e2364c");
      },
    },
    // A balloon on a string, bobbing.
    balloon: {
      layer: "high",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const bob = Math.sin(t(clock) * 1.4 + d.x) * 2;
        const sway = Math.sin(t(clock) * 1.1 + d.y) * 2;
        const x = d.x + sway;
        const y = d.y + bob;
        ctx.beginPath();
        ctx.moveTo(x, y + 9 * s);
        ctx.quadraticCurveTo(x + 3 * s, y + 15 * s, d.x, y + 22 * s);
        stroke(ctx, "rgba(255,255,255,0.9)", 0.7);
        ellipse(ctx, x, y, 7 * s, 8.5 * s);
        fill(ctx, pick(d.x / 11 + d.y / 17 + 4));
        polygon(ctx, [{ x: x - 1.5 * s, y: y + 9.5 * s }, { x: x + 1.5 * s, y: y + 9.5 * s }, { x: x, y: y + 7.5 * s }]);
        fill(ctx, "rgba(0,0,0,0.25)");
        ellipse(ctx, x - 2.5 * s, y - 3.5 * s, 1.6 * s, 2.6 * s, 0.4);
        fill(ctx, "rgba(255,255,255,0.7)");
      },
    },
    // A candy cane stuck in the ground.
    cane: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        const { x, y } = d;
        ctx.lineCap = "round";
        line(ctx, x + 1.5, y - 10 * s + 2, x + 1.5, y + 14 * s + 2, p.shadow, 4 * s);
        ctx.beginPath();
        ctx.moveTo(x, y + 14 * s);
        ctx.lineTo(x, y - 10 * s);
        ctx.arc(x - 5 * s, y - 10 * s, 5 * s, 0, Math.PI, true);
        stroke(ctx, "#ffffff", 3.6 * s);
        ctx.save();
        ctx.setLineDash([3 * s, 3 * s]);
        stroke(ctx, "#e2364c", 3.6 * s);
        ctx.restore();
      },
    },
    // A cotton candy cloud drifting a little.
    cloud: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const x = d.x + Math.sin(t(clock) * 0.4 + d.y) * 4;
        const y = d.y;
        for (const [dx, dy, r, c] of [[-14, 2, 8, "#ffd6ea"], [14, 2, 8, "#d9ecff"], [-5, -3, 10, "#ffe6f2"], [6, -2, 9, "#ffffff"], [0, 4, 9, "#fff2f8"]]) {
          circle(ctx, x + dx * s, y + dy * s, r * s);
          fill(ctx, c);
        }
      },
    },
    // A gingerbread man waving.
    gingerman: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = Math.abs(d.s);
        shadow(ctx, p, d.x + 1, d.y + 11 * s, 7 * s, 2 * s);
        gingerman(ctx, d.x, d.y, s, clock);
      },
    },
    // A wrapped candy, rocking.
    wrapped: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const color = pick(d.x / 13 + d.y / 7 + 1);
        turned(ctx, d.x, d.y, Math.sin(t(clock) * 1.2 + d.x) * 0.25, () => {
          for (const dir of [-1, 1]) {
            polygon(ctx, [{ x: dir * 6 * s, y: 0 }, { x: dir * 14 * s, y: -6 * s }, { x: dir * 12 * s, y: 0 }, { x: dir * 14 * s, y: 6 * s }]);
            fill(ctx, color);
          }
          ellipse(ctx, 0, 0, 8 * s, 6 * s);
          fill(ctx, color);
          for (let k = -1; k <= 1; k++) line(ctx, k * 3.5 * s - 1.5 * s, -5 * s, k * 3.5 * s + 1.5 * s, 5 * s, "rgba(255,255,255,0.6)", 1.3 * s);
          ellipse(ctx, -2.5 * s, -2.5 * s, 2.5 * s, 1.2 * s);
          fill(ctx, "rgba(255,255,255,0.65)");
        });
      },
    },
    // A big sprinkle donut lying in the sky.
    donut: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        shadow(ctx, p, d.x + 1.5, d.y + 2, 15 * s, 13 * s);
        circle(ctx, d.x, d.y, 15 * s);
        fill(ctx, "#e0a75e");
        circle(ctx, d.x, d.y, 13 * s);
        fill(ctx, "#8a4f2a");
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2 + t(clock) * 0.2;
          const r = (i % 2 ? 7.5 : 10.5) * s;
          turned(ctx, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, a * 3, () => {
            ctx.fillStyle = CANDY[i % CANDY.length];
            ctx.fillRect(-1.6 * s, -0.5 * s, 3.2 * s, 1 * s);
          });
        }
        circle(ctx, d.x, d.y, 4.5 * s);
        fill(ctx, p.rough);
      },
    },
    // A gingerbread house with icing on the roof and gumdrops on top.
    gingerhouse: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        shadow(ctx, p, x + 2, y + 26 * s, 30 * s, 5 * s);
        ctx.fillStyle = "#b8692e";
        ctx.fillRect(x - 24 * s, y - 4 * s, 48 * s, 30 * s);
        polygon(ctx, [{ x: x - 30 * s, y: y - 2 * s }, { x: x, y: y - 30 * s }, { x: x + 30 * s, y: y - 2 * s }]);
        fill(ctx, "#94511f");
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const q = u < 0.5 ? { x: x - 30 * s + u * 60 * s, y: y - 2 * s - u * 56 * s } : { x: x - 30 * s + u * 60 * s, y: y - 30 * s + (u - 0.5) * 56 * s };
          if (i) ctx.lineTo(q.x, q.y + (i % 2) * 2.5 * s);
          else ctx.moveTo(q.x, q.y);
        }
        stroke(ctx, "#ffffff", 2.4 * s);
        // The door, two candy windows and a peppermint on the gable.
        box(ctx, x - 6 * s, y + 10 * s, 12 * s, 16 * s, 5 * s);
        fill(ctx, "#ff8fc0");
        circle(ctx, x + 3 * s, y + 19 * s, 1 * s);
        fill(ctx, "#ffe066");
        for (const dx of [-16, 16]) {
          ctx.fillStyle = "#ffe8a3";
          ctx.fillRect(x + dx * s - 4.5 * s, y + 4 * s, 9 * s, 8 * s);
          line(ctx, x + dx * s, y + 4 * s, x + dx * s, y + 12 * s, "#ffffff", 1.2 * s);
          line(ctx, x + dx * s - 4.5 * s, y + 8 * s, x + dx * s + 4.5 * s, y + 8 * s, "#ffffff", 1.2 * s);
        }
        peppermint(ctx, x, y - 14 * s, 5 * s, t(clock) * 0.6);
        for (const [dx, dy, i] of [[-18, -10, 0], [18, -10, 2], [-8, -24, 4]]) {
          circle(ctx, x + dx * s, y + dy * s, 2.4 * s);
          fill(ctx, CANDY[i]);
        }
        // A wisp of smoke from the chimney.
        ctx.fillStyle = "#7a4019";
        ctx.fillRect(x + 12 * s, y - 26 * s, 6 * s, 10 * s);
        for (let i = 0; i < 3; i++) {
          const k = (t(clock) * 0.5 + i / 3) % 1;
          circle(ctx, x + 15 * s + Math.sin(k * 6) * 2, y - 28 * s - k * 16 * s, (2 + k * 3) * s);
          fill(ctx, `rgba(255,255,255,${0.7 * (1 - k)})`);
        }
      },
    },
    // A peppermint candy, turning.
    peppermint: {
      layer: "low",
      draw(ctx, p, d, clock) {
        circle(ctx, d.x + 1.5, d.y + 2, 9 * d.s);
        fill(ctx, p.shadow);
        peppermint(ctx, d.x, d.y, 9 * d.s, t(clock) * 0.5 + d.x);
      },
    },
    // A striped carnival tent, its pennant flapping.
    tent: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const top = y - 24 * s;
        ctx.fillStyle = p.shadow;
        ctx.fillRect(x - 22 * s + 2, y - 6 * s + 2, 44 * s, 16 * s);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k % 2 ? "#ffffff" : "#ff5c8a";
          ctx.fillRect(x - 22 * s + k * (44 / 6) * s, y - 6 * s, (44 / 6) * s + 0.3, 16 * s);
        }
        for (let k = 0; k < 6; k++) {
          polygon(ctx, [{ x: x, y: top }, { x: x - 24 * s + k * 8 * s, y: y - 6 * s }, { x: x - 24 * s + (k + 1) * 8 * s, y: y - 6 * s }]);
          fill(ctx, k % 2 ? "#ffffff" : "#ff5c8a");
        }
        for (let k = 0; k < 6; k++) {
          ctx.beginPath();
          ctx.arc(x - 20 * s + k * 8 * s, y - 6 * s, 4 * s, 0, Math.PI);
          fill(ctx, k % 2 ? "#5fb8ff" : "#ffe066");
        }
        polygon(ctx, [{ x: x - 5 * s, y: y + 10 * s }, { x: x + 5 * s, y: y + 10 * s }, { x: x, y: y - 2 * s }]);
        fill(ctx, "#3b1e12");
        line(ctx, x, top, x, top - 8 * s, "#5a5560", 1);
        const wave = Math.sin(t(clock) * 5) * 1.5;
        polygon(ctx, [{ x: x, y: top - 8 * s }, { x: x + 9 * s, y: top - 6 * s + wave }, { x: x, y: top - 4 * s }]);
        fill(ctx, "#6fd47b");
      },
    },
    // The chocolate fountain: three tiers in the pool, chocolate pouring down
    // each one.
    fountain: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const flow = t(clock) * 3;
        // Bowls from the bottom up: half width, half depth, height, and how far
        // its chocolate curtain falls.
        const tiers = [[27, 9, 8, 12], [18, 6, -6, 12], [10, 3.6, -18, 10]];
        ellipse(ctx, x + 2, y + 14 * s, 30 * s, 8 * s);
        fill(ctx, "rgba(40,16,6,0.35)");
        tiers.forEach(([rx, ry, dy, drop], i) => {
          const by = y + dy * s;
          if (i) {
            ctx.fillStyle = "#e9e5ee";
            ctx.fillRect(x - 2.5 * s, by, 5 * s, (tiers[i - 1][2] - dy) * s);
          }
          ellipse(ctx, x, by + 1.5 * s, rx * s, ry * s);
          fill(ctx, "#a9a3b2");
          ellipse(ctx, x, by, rx * s, ry * s);
          fill(ctx, "#f7f4fa");
          ellipse(ctx, x, by, (rx - 2.2) * s, (ry - 1.4) * s);
          fill(ctx, "#5c2e18");
          ellipse(ctx, x - rx * 0.3 * s, by - ry * 0.25 * s, rx * 0.3 * s, ry * 0.25 * s);
          fill(ctx, "#8d5232");
          // The curtain pouring over the front rim, its edge rippling down.
          ctx.beginPath();
          for (let k = 0; k <= 12; k++) {
            const a = Math.PI - (k / 12) * Math.PI;
            ctx.lineTo(x + Math.cos(a) * (rx - 1) * s, by + Math.sin(a) * (ry - 0.6) * s);
          }
          for (let k = 0; k <= 8; k++) {
            const u = 1 - k / 8;
            const wob = Math.sin(flow + k * 1.7 + i) * 1.6;
            ctx.lineTo(x + (u * 2 - 1) * (rx - 2) * s, by + (ry + drop * (0.8 + 0.2 * Math.sin(k * 2.1))) * s + wob * s);
          }
          ctx.closePath();
          fill(ctx, "#6e3a1f");
          for (let k = 0; k < 4; k++) {
            const u = (k + 0.5) / 4;
            const sx = x + (u * 2 - 1) * (rx - 4) * s;
            line(ctx, sx, by + ry * 0.8 * s, sx, by + (ry + drop * 0.6) * s, "rgba(160,96,58,0.7)", 1 * s);
          }
        });
        // The chocolate welling out of the top, and strawberries for dipping.
        const k = flow % 1;
        circle(ctx, x, y - 21 * s, 3.4 * s);
        fill(ctx, "#6e3a1f");
        circle(ctx, x, y - 23 * s - k * 3 * s, (1.5 + k * 1.5) * s);
        fill(ctx, `rgba(110,58,31,${1 - k})`);
        for (const [dx, dy] of [[-15, 24], [16, 22], [-24, 14], [25, 12]]) {
          ellipse(ctx, x + dx * s, y + dy * s, 3 * s, 3.6 * s);
          fill(ctx, "#ff3d5e");
          ellipse(ctx, x + dx * s, y + dy * s - 3 * s, 2.2 * s, 1 * s);
          fill(ctx, "#3fae4f");
        }
      },
    },
  },
};
