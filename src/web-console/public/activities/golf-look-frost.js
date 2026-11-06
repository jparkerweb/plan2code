// Plan2Code Web Console - mini golf's Frosty Peaks look: the course's palette, ground, water, props and scenery.
//
// Drawing only, listed in golf-looks.js (which documents what a look holds).
// Soft blue-gray snow so the white ball stands out, glassy cyan ice, candy
// red rails, and bright winter props: snowmen, penguins, a yeti, a ski lift,
// pines, a cozy cabin, an igloo and the northern lights.

import { circle, ellipse, fill, label, line, polygon, radial, scatter, stroke, t, turned } from "./golf-paint.js";

const WHITE = "#ffffff";
const SNOW = "#f4f8ff";
const SNOW_SHADE = "#d3def0";
const COAL = "#23262e";
const CARROT = "#ff8a2a";
const SCARF = "#e2323f";
const PINE = "#2f8a57";
const PINE_DARK = "#1f6a43";
const WOOD = "#8a5a34";
const WOOD_DARK = "#5a3a1e";
const WARM = "#ffd36b";

// A snow-capped pine seen from the front, `s` its scale.
function pine(ctx, x, y, s) {
  ctx.fillStyle = WOOD_DARK;
  ctx.fillRect(x - 1.6 * s, y - 2 * s, 3.2 * s, 6 * s);
  for (const [dy, w] of [[0, 11], [-7, 8.5], [-13, 6]]) {
    polygon(ctx, [{ x: x - w * s, y: y + dy * s }, { x: x + w * s, y: y + dy * s }, { x, y: y + (dy - 10) * s }]);
    fill(ctx, dy ? PINE : PINE_DARK);
    // Snow on the tips of each tier.
    polygon(ctx, [{ x: x - w * 0.55 * s, y: y + (dy - 4.5) * s }, { x: x + w * 0.55 * s, y: y + (dy - 4.5) * s }, { x, y: y + (dy - 10) * s }]);
    fill(ctx, SNOW);
  }
}

// A snowflake: six arms with little side twigs.
function flake(ctx, x, y, r, angle, color, width) {
  turned(ctx, x, y, angle, () => {
    ctx.lineCap = "round";
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      line(ctx, 0, 0, c * r, s * r, color, width);
      const b = r * 0.55;
      for (const side of [-1, 1]) {
        const a2 = a + side * 0.7;
        line(ctx, c * b, s * b, c * b + Math.cos(a2) * r * 0.3, s * b + Math.sin(a2) * r * 0.3, color, width * 0.8);
      }
    }
  });
}

// A penguin's body, facing the viewer, `r` its size.
function penguinBody(ctx, x, y, r, flap) {
  ellipse(ctx, x, y, r * 0.8, r);
  fill(ctx, "#1f2433");
  ellipse(ctx, x, y + r * 0.15, r * 0.55, r * 0.75);
  fill(ctx, WHITE);
  for (const side of [-1, 1]) {
    ellipse(ctx, x + side * r * 0.82, y + r * 0.1, r * 0.2, r * 0.5, side * (0.3 + flap));
    fill(ctx, "#1f2433");
    ellipse(ctx, x + side * r * 0.3, y + r * 0.95, r * 0.25, r * 0.12);
    fill(ctx, "#ff9a2e");
    circle(ctx, x + side * r * 0.22, y - r * 0.45, r * 0.12);
    fill(ctx, COAL);
  }
  polygon(ctx, [{ x: x - r * 0.15, y: y - r * 0.28 }, { x: x + r * 0.15, y: y - r * 0.28 }, { x, y: y - r * 0.05 }]);
  fill(ctx, "#ff9a2e");
}

export default {
  palette: {
    rough: "#3b5f93",
    roughMark: "#5a80b4",
    foam: "rgba(240, 248, 255, 0.55)",
    shore: "#eef4fc",
    turf: "#b3c3de",
    stripe: "#abbcd9",
    sand: "#eef3fb",
    speckle: "#b9c8e2",
    ice: "#7fd2ef",
    iceLine: "#e8fbff",
    wall: "#c7343f",
    wallTop: "#ffc3c8",
    slope: "#9fb3d6",
    arrow: "rgba(255, 255, 255, 0.8)",
    bridge: "#a06b3c",
    plank: "#6a4322",
    spinner: "#e86a1c",
    hub: "#ffd23f",
    portalA: "#bdefff",
    portalB: "#ffd0ef",
    cup: "#14203a",
    flag: "#e2323f",
    flagMark: "#ffffff",
    pad: "#ffe27a",
    spy: "#ffe27a",
    banner: "#f2f8ff",
    bannerLine: "#3d7cc9",
    bannerInk: "#1f3a5f",
    bannerRound: 10,
    dark: 0,
  },

  liquids: {
    // A hole cut in the ice: dark, cold water with drifting slush.
    icewater: { fill: "#1d5c97", ripple: "#9ad9f5", glow: null },
    // A glacier's crevasse: a blue crack falling away forever.
    crevasse: { fill: "#0e2d57", ripple: "#4f8fcf", glow: null, still: true },
  },

  grounds: {
    // Soft snow: wind ripples and a few sparkles.
    snow(ctx, p, course) {
      ctx.fillStyle = p.turf;
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.strokeStyle = p.stripe;
      ctx.lineWidth = 2;
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 26, 7)) {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 9, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 11, 3)) ctx.fillRect(q.x, q.y, 0.9, 0.9);
    },
    // A groomed ski run: fine corduroy lines.
    piste(ctx, p, course) {
      ctx.fillStyle = p.turf;
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.fillStyle = p.stripe;
      for (let x = 0; x < course.w; x += 4) ctx.fillRect(x, 0, 1.4, course.h);
      ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 13, 5)) ctx.fillRect(q.x, q.y, 0.9, 0.9);
    },
    // A Christmas tree's branches: deep green, needles and dabs of snow.
    needles(ctx, p, course) {
      ctx.fillStyle = "#2e8a52";
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.strokeStyle = "#277a48";
      ctx.lineWidth = 1.2;
      let i = 0;
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 9, 17)) {
        const a = i++ % 2 ? 0.5 : -0.5;
        ctx.beginPath();
        ctx.moveTo(q.x - Math.cos(a) * 4, q.y - Math.sin(a) * 4);
        ctx.lineTo(q.x + Math.cos(a) * 4, q.y + Math.sin(a) * 4);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(240, 248, 255, 0.55)";
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 30, 41)) {
        ellipse(ctx, q.x, q.y, 4, 1.6);
        ctx.fill();
      }
    },
  },

  // Beyond the green: deep alpine blue, snow drifting across it.
  rough(ctx, p, course) {
    ctx.fillStyle = p.roughMark;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 9, 13)) {
      circle(ctx, q.x, q.y, 0.9);
      ctx.fill();
    }
    let i = 0;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 34, 29)) {
      if (i++ % 2) flake(ctx, q.x, q.y, 3.2, i, "rgba(200, 222, 250, 0.45)", 0.8);
    }
  },

  // An ice cave mouth: a dark hollow under a snowy arch with icicle teeth.
  tunnel(ctx, p, m, k, i, clock, r) {
    const { x, y } = m;
    ellipse(ctx, x, y + 1.5, r + 4, r + 2);
    fill(ctx, SNOW_SHADE);
    circle(ctx, x, y, r + 2.5);
    fill(ctx, k ? "#a9e6ff" : "#c8f0ff");
    circle(ctx, x, y, r);
    const g = radial(ctx, x, y, 1, r, [[0, "#04101f"], [1, "#1c4f86"]]);
    fill(ctx, g || "#0b2343");
    // The shimmer inside, spinning slowly.
    const spin = t(clock) * 1.5 + k * 2;
    ctx.lineCap = "round";
    for (let a = 0; a < 2; a++) {
      ctx.beginPath();
      ctx.arc(x, y, r * (0.45 + a * 0.25), spin + a * 2, spin + a * 2 + 1.6);
      stroke(ctx, "rgba(160, 230, 255, 0.7)", 1.2);
    }
    for (let j = -2; j <= 2; j++) {
      const ix = x + j * r * 0.38;
      const top = y - Math.sqrt(Math.max(0, (r + 1.5) ** 2 - (ix - x) ** 2));
      polygon(ctx, [{ x: ix - 1.8, y: top }, { x: ix + 1.8, y: top }, { x: ix, y: top + 4.5 - Math.abs(j) }]);
      fill(ctx, "#e9fbff");
    }
  },

  bumpers: {
    // A lumpy packed snowball, blue in its shade, so it never passes for
    // the golf ball.
    snowball(ctx, p, b) {
      const { x, y, r } = b;
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      for (const [a, k] of [[0.6, 0.42], [2.4, 0.38], [4.2, 0.4]]) {
        circle(ctx, x + Math.cos(a) * r * 0.78, y + Math.sin(a) * r * 0.78, r * k);
        fill(ctx, "#a9bde0");
      }
      circle(ctx, x, y, r);
      fill(ctx, "#a9bde0");
      circle(ctx, x - r * 0.12, y - r * 0.12, r * 0.82);
      fill(ctx, "#d5e1f5");
      circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.4);
      fill(ctx, "#f2f7ff");
      for (const [dx, dy] of [[0.35, 0.1], [-0.1, 0.45], [0.2, -0.45]]) {
        circle(ctx, x + dx * r, y + dy * r, r * 0.09);
        fill(ctx, "#7f97c4");
      }
      circle(ctx, x, y, r);
      stroke(ctx, "#5f79aa", 1.1);
    },
    // A snowman's head: coal eyes, carrot nose, red scarf, black hat.
    snowman(ctx, p, b, clock) {
      const { x, y, r } = b;
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      ctx.fillStyle = SCARF;
      ctx.fillRect(x - r * 0.95, y + r * 0.45, r * 1.9, r * 0.38);
      circle(ctx, x, y, r);
      fill(ctx, WHITE);
      stroke(ctx, "#9fb1cf", 1);
      const wob = Math.sin(t(clock) * 3 + x) * 0.6;
      ctx.fillStyle = SCARF;
      ctx.fillRect(x - r * 0.9, y + r * 0.5, r * 1.8, r * 0.32);
      ctx.fillRect(x + r * 0.35, y + r * 0.5, r * 0.3, r * 0.8 + wob);
      ctx.fillStyle = COAL;
      ctx.fillRect(x - r * 0.75, y - r * 0.82, r * 1.5, r * 0.2);
      ctx.fillRect(x - r * 0.5, y - r * 1.4, r, r * 0.6);
      for (const side of [-1, 1]) {
        circle(ctx, x + side * r * 0.33, y - r * 0.2, r * 0.12);
        fill(ctx, COAL);
      }
      polygon(ctx, [{ x, y: y - r * 0.05 }, { x, y: y + r * 0.2 }, { x: x + r * 0.7, y: y + r * 0.12 }]);
      fill(ctx, CARROT);
    },
    // A candy-striped slalom pole seen from above, with a flag.
    pole(ctx, p, b, clock) {
      const { x, y, r } = b;
      circle(ctx, x + 1.2, y + 1.6, r);
      fill(ctx, p.shadow);
      circle(ctx, x, y, r);
      fill(ctx, WHITE);
      ctx.save();
      circle(ctx, x, y, r);
      ctx.clip();
      for (let k = -2; k <= 2; k++) line(ctx, x - r + k * r * 0.8, y + r, x + k * r * 0.8 + r, y - r, SCARF, r * 0.38);
      ctx.restore();
      circle(ctx, x, y, r);
      stroke(ctx, "#8a1c26", 0.9);
      const wave = Math.sin(t(clock) * 5 + x) * 1.2;
      polygon(ctx, [{ x: x, y: y - r }, { x: x + r * 1.8, y: y - r * 0.7 + wave }, { x: x, y: y - r * 0.1 }]);
      fill(ctx, (Math.round(x) % 2) ? "#2f7fe0" : SCARF);
    },
    // A shiny glass bauble, its color picked by where it hangs.
    ornament(ctx, p, b, clock) {
      const { x, y, r } = b;
      const colors = ["#e2323f", "#2f7fe0", "#ffc21a", "#a04ee0", "#26b36b"];
      const c = colors[Math.floor((x + y * 3) / 10) % colors.length];
      circle(ctx, x + 1.5, y + 2, r);
      fill(ctx, p.shadow);
      circle(ctx, x, y, r);
      fill(ctx, c);
      ctx.save();
      circle(ctx, x, y, r);
      ctx.clip();
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(x - r, y - r * 0.15, r * 2, r * 0.3);
      ctx.restore();
      ctx.fillStyle = "#d9b23a";
      ctx.fillRect(x - r * 0.3, y - r - 2, r * 0.6, 3);
      const shine = 0.5 + 0.5 * Math.sin(t(clock) * 2.5 + x);
      circle(ctx, x - r * 0.4, y - r * 0.4, r * (0.18 + shine * 0.08));
      fill(ctx, WHITE);
    },
    // A block of clear blue ice.
    iceblock(ctx, p, b) {
      const { x, y, r } = b;
      const s = r * 0.9;
      ctx.fillStyle = p.shadow;
      ctx.fillRect(x - s + 1.5, y - s + 2, s * 2, s * 2);
      ctx.fillStyle = "#8fdcf5";
      ctx.fillRect(x - s, y - s, s * 2, s * 2);
      polygon(ctx, [{ x: x - s, y: y - s }, { x: x + s, y: y - s }, { x: x + s * 0.6, y: y - s * 0.6 }, { x: x - s * 0.6, y: y - s * 0.6 }]);
      fill(ctx, "#d6f6ff");
      line(ctx, x - s * 0.4, y + s * 0.3, x + s * 0.2, y - s * 0.3, WHITE, 1.2);
      ctx.strokeStyle = "#3d8fbf";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - s, y - s, s * 2, s * 2);
    },
  },

  movers: {
    // A penguin belly-sliding along, flippers out.
    penguin(ctx, p, m, clock) {
      ellipse(ctx, m.x + 1.5, m.y + m.r * 0.9, m.r * 0.8, m.r * 0.3);
      fill(ctx, p.shadow);
      penguinBody(ctx, m.x, m.y, m.r, Math.sin(t(clock) * 9 + m.x) * 0.35);
    },
    // A big friendly yeti, arms up, stomping across.
    yeti(ctx, p, m, clock) {
      const { x, y, r } = m;
      const stomp = Math.abs(Math.sin(t(clock) * 6)) * 1.5;
      ellipse(ctx, x + 2, y + r * 0.9, r, r * 0.35);
      fill(ctx, p.shadow);
      for (const side of [-1, 1]) {
        const lift = Math.sin(t(clock) * 6 + side) * 2;
        ellipse(ctx, x + side * r * 0.95, y - r * 0.35 + lift, r * 0.3, r * 0.55, side * 0.5);
        fill(ctx, "#eaf2ff");
      }
      circle(ctx, x, y - stomp, r);
      fill(ctx, "#f2f7ff");
      // Shaggy fur along the edge.
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        circle(ctx, x + Math.cos(a) * r * 0.92, y - stomp + Math.sin(a) * r * 0.92, r * 0.18);
        fill(ctx, "#dfe9f8");
      }
      ellipse(ctx, x, y - stomp + r * 0.05, r * 0.62, r * 0.5);
      fill(ctx, "#7fa6d6");
      for (const side of [-1, 1]) {
        circle(ctx, x + side * r * 0.25, y - stomp - r * 0.12, r * 0.12);
        fill(ctx, COAL);
      }
      ellipse(ctx, x, y - stomp + r * 0.25, r * 0.28, r * 0.14);
      fill(ctx, "#3a2440");
      ctx.fillStyle = WHITE;
      ctx.fillRect(x - r * 0.15, y - stomp + r * 0.14, r * 0.1, r * 0.1);
      ctx.fillRect(x + r * 0.05, y - stomp + r * 0.14, r * 0.1, r * 0.1);
    },
    // A giant snowball rolling down the slope, rocks stuck in it.
    boulder(ctx, p, m, clock) {
      const { x, y, r } = m;
      circle(ctx, x + 2, y + 2.5, r);
      fill(ctx, p.shadow);
      circle(ctx, x, y, r);
      fill(ctx, "#eef4ff");
      const roll = y / r;
      for (let i = 0; i < 4; i++) {
        const a = roll + (i * Math.PI) / 2;
        const k = Math.cos(a);
        if (k < -0.2) continue;
        circle(ctx, x + Math.sin(i * 2.1) * r * 0.5, y + Math.sin(a) * r * 0.7, r * 0.14 * (0.6 + k * 0.4));
        fill(ctx, "#6d7488");
      }
      circle(ctx, x, y, r);
      stroke(ctx, "#a9b9d6", 1.2);
    },
    // A red sled with a rider in a bobble hat.
    sled(ctx, p, m, clock) {
      const { x, y, r } = m;
      ctx.fillStyle = p.shadow;
      ctx.fillRect(x - r + 1.5, y - r * 0.55 + 2, r * 2, r * 1.1);
      line(ctx, x - r, y - r * 0.6, x + r * 1.1, y - r * 0.6, "#5a3a1e", 1.4);
      line(ctx, x - r, y + r * 0.6, x + r * 1.1, y + r * 0.6, "#5a3a1e", 1.4);
      ctx.fillStyle = "#d8323e";
      ctx.fillRect(x - r * 0.9, y - r * 0.5, r * 1.8, r);
      circle(ctx, x, y, r * 0.42);
      fill(ctx, "#2f7fe0");
      circle(ctx, x - r * 0.1, y - r * 0.1, r * 0.28);
      fill(ctx, "#ffd9b8");
      const bob = Math.sin(t(clock) * 8) * 0.8;
      circle(ctx, x - r * 0.45, y - r * 0.2 + bob, r * 0.16);
      fill(ctx, WHITE);
    },
  },

  spinners: {
    // A ski lift: a cable with a chair hanging from each end, a tower in the middle.
    lift(ctx, p, s, clock) {
      line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, p.shadow, 4);
      line(ctx, s.x1, s.y1, s.x2, s.y2, "#3a3f4c", 2.2);
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      for (const [ex, ey, c] of [[s.x1, s.y1, "#2f7fe0"], [s.x2, s.y2, SCARF]]) {
        turned(ctx, ex, ey, angle, () => {
          ctx.fillStyle = p.shadow;
          ctx.fillRect(-4, -3, 9, 8);
          ctx.fillStyle = c;
          ctx.fillRect(-5, -4, 9, 8);
          ctx.fillStyle = "#1d2433";
          ctx.fillRect(-5, -4, 9, 2);
        });
      }
      circle(ctx, s.x, s.y, 6.5);
      fill(ctx, "#5b6273");
      circle(ctx, s.x, s.y, 3.5);
      fill(ctx, p.hub);
    },
    // A snowplow's orange blade, hazard stripes and a flashing light.
    plow(ctx, p, s, clock) {
      ctx.lineCap = "butt";
      line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, p.shadow, 6);
      line(ctx, s.x1, s.y1, s.x2, s.y2, p.spinner, 5.5);
      ctx.save();
      ctx.setLineDash([3, 3]);
      line(ctx, s.x1, s.y1, s.x2, s.y2, "#2a2a2a", 1.6);
      ctx.restore();
      ctx.lineCap = "round";
      circle(ctx, s.x, s.y, 7);
      fill(ctx, "#ffb21a");
      circle(ctx, s.x, s.y, 7);
      stroke(ctx, "#8a4a10", 1);
      const blink = Math.floor(t(clock) * 3) % 2;
      circle(ctx, s.x, s.y, 3);
      fill(ctx, blink ? "#ff3b2f" : "#ffe08a");
    },
  },

  gates: {
    // A row of giant icicles: up and dripping while open, crashing down
    // while shut, wobbling just before they drop.
    icicles(ctx, p, g, clock) {
      const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      const angle = Math.atan2(g.y2 - g.y1, g.x2 - g.x1);
      const soon = !g.shut && g.phase > g.open - 0.15;
      const shake = soon ? Math.sin(clock / 20) * 1 : 0;
      turned(ctx, (g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2, angle, () => {
        if (g.shut) {
          ctx.fillStyle = p.shadow;
          ctx.fillRect(-len / 2 + 1.5, -3, len, 10);
          for (let x = -len / 2 + 4; x < len / 2; x += 8) {
            polygon(ctx, [{ x: x - 3.5, y: 4 }, { x: x + 3.5, y: 4 }, { x, y: 10 }]);
            fill(ctx, "#2f78b8");
          }
          ctx.fillStyle = "#2f78b8";
          ctx.fillRect(-len / 2, -5, len, 10);
          ctx.fillStyle = "#7fd0f2";
          ctx.fillRect(-len / 2 + 1, -4, len - 2, 6);
          ctx.fillStyle = "#e6fbff";
          ctx.fillRect(-len / 2 + 1, -4, len - 2, 2);
        } else {
          // The shadow of the icicles waiting overhead, a drip falling.
          ctx.globalAlpha = soon ? 0.7 : 0.4;
          for (let x = -len / 2 + 4; x < len / 2; x += 8) {
            polygon(ctx, [{ x: x - 2.5 + shake, y: -2 }, { x: x + 2.5 + shake, y: -2 }, { x: x + shake, y: 3 }]);
            fill(ctx, soon ? "#3d8fd6" : "#5d7fa8");
          }
          ctx.globalAlpha = 1;
          const k = (t(clock) * 1.3) % 1;
          circle(ctx, -len / 4, -3 + k * 6, 1);
          fill(ctx, "rgba(220, 250, 255, 0.9)");
        }
      });
    },
  },

  wells: {
    // A whirlpool under a hole in the ice: spiral arms turning inward.
    whirlpool(ctx, p, w, clock) {
      const spin = t(clock) * 2.2;
      ctx.save();
      ctx.lineCap = "round";
      for (let arm = 0; arm < 4; arm++) {
        ctx.beginPath();
        for (let i = 0; i <= 20; i++) {
          const u = i / 20;
          const a = spin + arm * (Math.PI / 2) + u * 3.2;
          const rr = 6 + u * (w.r - 6);
          if (i === 0) ctx.moveTo(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr);
          else ctx.lineTo(w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr);
        }
        ctx.globalAlpha = 0.55;
        stroke(ctx, WHITE, 1.4);
      }
      ctx.restore();
    },
    // A snow globe's swirl: sparkles circling down into the cup.
    globe(ctx, p, w, clock) {
      const time = t(clock);
      ctx.save();
      circle(ctx, w.x, w.y, w.r);
      ctx.setLineDash([2, 4]);
      stroke(ctx, "rgba(255, 255, 255, 0.45)", 1);
      ctx.setLineDash([]);
      for (let i = 0; i < 14; i++) {
        const k = ((i / 14 + time * 0.25) % 1 + 1) % 1;
        const rr = w.r * (1 - k);
        const a = i * 2.4 + time * (1.2 + k * 2);
        ctx.globalAlpha = 0.9 * (1 - k * 0.6);
        flake(ctx, w.x + Math.cos(a) * rr, w.y + Math.sin(a) * rr, 2 + (1 - k) * 1.5, a, WHITE, 0.7);
      }
      ctx.restore();
    },
  },

  decor: {
    pine: {
      layer: "low",
      draw(ctx, p, d) {
        ellipse(ctx, d.x + 2, d.y + 4 * d.s, 10 * d.s, 3 * d.s);
        fill(ctx, "rgba(20, 40, 80, 0.25)");
        pine(ctx, d.x, d.y, d.s);
      },
    },
    // A log cabin: snowy roof, warm windows, smoke from the chimney.
    cabin: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        ctx.fillStyle = "#6a4322";
        ctx.fillRect(x - 18 * s, y - 10 * s, 36 * s, 20 * s);
        ctx.fillStyle = WOOD_DARK;
        for (let k = 0; k < 4; k++) ctx.fillRect(x - 18 * s, y - 8 * s + k * 5 * s, 36 * s, 0.8 * s);
        ctx.fillStyle = "#5a3a1e";
        ctx.fillRect(x + 9 * s, y - 24 * s, 5 * s, 10 * s);
        polygon(ctx, [{ x: x - 23 * s, y: y - 9 * s }, { x: x + 23 * s, y: y - 9 * s }, { x, y: y - 26 * s }]);
        fill(ctx, "#8b2a2a");
        polygon(ctx, [{ x: x - 24 * s, y: y - 8 * s }, { x: x + 24 * s, y: y - 8 * s }, { x: x + 15 * s, y: y - 13 * s }, { x, y: y - 27 * s }, { x: x - 15 * s, y: y - 13 * s }]);
        fill(ctx, SNOW);
        const glow = 0.85 + Math.sin(t(clock) * 7 + x) * 0.15;
        ctx.globalAlpha = glow;
        ctx.fillStyle = WARM;
        ctx.fillRect(x - 13 * s, y - 4 * s, 7 * s, 6 * s);
        ctx.fillRect(x + 6 * s, y - 4 * s, 7 * s, 6 * s);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#3a2410";
        ctx.fillRect(x - 3 * s, y - 2 * s, 6 * s, 12 * s);
        for (let i = 0; i < 3; i++) {
          const k = (t(clock) * 0.5 + i / 3) % 1;
          circle(ctx, x + 11.5 * s + k * 6 * s, y - 27 * s - k * 16 * s, (2 + k * 3) * s);
          fill(ctx, `rgba(235, 240, 250, ${0.8 - k * 0.8})`);
        }
      },
    },
    // An igloo of snow blocks with a dark doorway.
    igloo: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        const { x, y } = d;
        ellipse(ctx, x + 2, y + 1, 22 * s, 4 * s);
        fill(ctx, "rgba(20, 40, 80, 0.25)");
        ctx.beginPath();
        ctx.arc(x, y, 20 * s, Math.PI, 0);
        ctx.closePath();
        fill(ctx, SNOW);
        ctx.strokeStyle = "#a9bcd9";
        ctx.lineWidth = 0.9 * s;
        for (const k of [0.33, 0.66]) {
          ctx.beginPath();
          const ry = y - k * 20 * s;
          const half = Math.sqrt(1 - k * k) * 20 * s;
          ctx.moveTo(x - half, ry);
          ctx.lineTo(x + half, ry);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(x, y, 20 * s, Math.PI, 0);
        ctx.stroke();
        for (const [dx, dy] of [[-12, -3], [0, -3], [12, -3], [-6, -10], [6, -10], [0, -16]]) line(ctx, x + dx * s, y + dy * s, x + dx * s, y + (dy + 3.5) * s, "#a9bcd9", 0.8 * s);
        ctx.beginPath();
        ctx.arc(x, y, 7 * s, Math.PI, 0);
        ctx.closePath();
        fill(ctx, "#1d2a44");
      },
    },
    // A snowman with a scarf, a hat and a waving stick arm.
    snowman: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        ellipse(ctx, x + 2, y + 9 * s, 11 * s, 3 * s);
        fill(ctx, "rgba(20, 40, 80, 0.25)");
        circle(ctx, x, y, 10 * s);
        fill(ctx, WHITE);
        circle(ctx, x, y - 14 * s, 7 * s);
        fill(ctx, WHITE);
        const wave = Math.sin(t(clock) * 3 + x) * 0.4;
        line(ctx, x + 6 * s, y - 2 * s, x + 6 * s + Math.cos(-0.8 + wave) * 11 * s, y - 2 * s + Math.sin(-0.8 + wave) * 11 * s, WOOD_DARK, 1.2 * s);
        line(ctx, x - 6 * s, y - 2 * s, x - 15 * s, y + 2 * s, WOOD_DARK, 1.2 * s);
        ctx.fillStyle = SCARF;
        ctx.fillRect(x - 6.5 * s, y - 8.5 * s, 13 * s, 3 * s);
        ctx.fillRect(x + 2 * s, y - 7 * s, 3 * s, 8 * s);
        ctx.fillStyle = COAL;
        ctx.fillRect(x - 7 * s, y - 20.5 * s, 14 * s, 1.8 * s);
        ctx.fillRect(x - 4.5 * s, y - 28 * s, 9 * s, 8 * s);
        ctx.fillStyle = SCARF;
        ctx.fillRect(x - 4.5 * s, y - 22.5 * s, 9 * s, 1.6 * s);
        for (const dx of [-2.5, 2.5]) {
          circle(ctx, x + dx * s, y - 16 * s, 1 * s);
          fill(ctx, COAL);
        }
        polygon(ctx, [{ x, y: y - 14.5 * s }, { x, y: y - 12.5 * s }, { x: x + 6 * s, y: y - 13 * s }]);
        fill(ctx, CARROT);
        for (const dy of [-3, 1, 5]) {
          circle(ctx, x, y + dy * s, 0.9 * s);
          fill(ctx, COAL);
        }
      },
    },
    // A polar bear lying in the snow, breathing slowly.
    polarbear: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const breathe = 1 + Math.sin(t(clock) * 1.6) * 0.04;
        ellipse(ctx, x + 2, y + 7 * s, 22 * s, 4 * s);
        fill(ctx, "rgba(20, 40, 80, 0.25)");
        ellipse(ctx, x, y, 18 * s, 9 * s * breathe);
        fill(ctx, "#fbf7ec");
        for (const dx of [-12, 10]) {
          ellipse(ctx, x + dx * s, y + 7 * s, 4.5 * s, 2.5 * s);
          fill(ctx, "#f1ead8");
        }
        circle(ctx, x - 17 * s, y - 3 * s, 7 * s);
        fill(ctx, "#fbf7ec");
        for (const dx of [-21, -13]) {
          circle(ctx, x + dx * s, y - 9 * s, 2.2 * s);
          fill(ctx, "#f1ead8");
        }
        ellipse(ctx, x - 22 * s, y - 1.5 * s, 3 * s, 2.2 * s);
        fill(ctx, "#f1ead8");
        circle(ctx, x - 24 * s, y - 2 * s, 1.1 * s);
        fill(ctx, COAL);
        // Asleep: a closed eye and a slow Z.
        line(ctx, x - 19 * s, y - 4.5 * s, x - 16 * s, y - 4.5 * s, COAL, 0.8 * s);
        const k = (t(clock) % 3) / 3;
        label(ctx, "z", x - 12 * s + k * 6 * s, y - 14 * s - k * 12 * s, (5 + k * 4) * s, `rgba(255, 255, 255, ${1 - k})`);
      },
    },
    // A penguin waddling on the spot.
    penguin: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const tip = Math.sin(t(clock) * 5 + d.x) * 0.15;
        turned(ctx, d.x, d.y, tip, () => {
          ellipse(ctx, 1.5, 9 * d.s, 6 * d.s, 2 * d.s);
          fill(ctx, "rgba(20, 40, 80, 0.25)");
          penguinBody(ctx, 0, 0, 8 * d.s, tip);
        });
      },
    },
    // A skier carving back and forth with a trail of powder.
    skier: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const time = t(clock) * 1.4 + d.x;
        const x = d.x + Math.sin(time) * 16 * s;
        const y = d.y + Math.cos(time * 2) * 2 * s;
        const lean = Math.cos(time) * 0.4;
        for (let i = 1; i <= 5; i++) {
          circle(ctx, d.x + Math.sin(time - i * 0.12) * 16 * s, y + 6 * s - i * 0.5, (2.2 - i * 0.3) * s);
          fill(ctx, "rgba(255, 255, 255, 0.6)");
        }
        turned(ctx, x, y, lean, () => {
          line(ctx, -6 * s, 6 * s, 7 * s, 6 * s, "#ffd23f", 1.4 * s);
          line(ctx, 0, 6 * s, 0, -2 * s, "#2f3a66", 2.2 * s);
          ctx.fillStyle = "#2f7fe0";
          ctx.fillRect(-2.5 * s, -8 * s, 5 * s, 7 * s);
          circle(ctx, 0, -10.5 * s, 2.3 * s);
          fill(ctx, "#ffd9b8");
          circle(ctx, 0, -12 * s, 2.3 * s);
          fill(ctx, SCARF);
          circle(ctx, 0, -14.5 * s, 1.1 * s);
          fill(ctx, WHITE);
          line(ctx, 2 * s, -5 * s, 7 * s, 5 * s, "#555555", 0.7 * s);
          line(ctx, -2 * s, -5 * s, -6 * s, 5 * s, "#555555", 0.7 * s);
        });
      },
    },
    // The northern lights: green and pink ribbons rippling.
    aurora: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const time = t(clock);
        const w = 150 * d.s;
        ctx.save();
        ctx.lineCap = "round";
        for (const [k, color] of [[0, "rgba(90, 255, 170, 0.35)"], [1, "rgba(255, 120, 210, 0.28)"], [2, "rgba(120, 220, 255, 0.3)"]]) {
          ctx.beginPath();
          for (let i = 0; i <= 24; i++) {
            const u = i / 24;
            const x = d.x - w / 2 + u * w;
            const y = d.y + k * 7 + Math.sin(u * 7 + time * (0.8 + k * 0.3) + k) * 6 * d.s;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          stroke(ctx, color, 6 - k);
        }
        ctx.restore();
      },
    },
    // A snowy mountain peak.
    peak: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        const { x, y } = d;
        polygon(ctx, [{ x: x - 34 * s, y }, { x: x + 34 * s, y }, { x: x + 4 * s, y: y - 40 * s }, { x: x - 4 * s, y: y - 38 * s }]);
        fill(ctx, "#6d86b3");
        polygon(ctx, [{ x: x + 4 * s, y: y - 40 * s }, { x: x + 34 * s, y }, { x: x + 8 * s, y }]);
        fill(ctx, "#57709c");
        polygon(ctx, [{ x: x - 4 * s, y: y - 38 * s }, { x: x + 4 * s, y: y - 40 * s }, { x: x + 15 * s, y: y - 24 * s }, { x: x + 7 * s, y: y - 27 * s }, { x: x, y: y - 22 * s }, { x: x - 7 * s, y: y - 27 * s }, { x: x - 14 * s, y: y - 22 * s }]);
        fill(ctx, SNOW);
      },
    },
    // Snowflakes drifting down over the course.
    flurry: {
      layer: "high",
      draw(ctx, p, d, clock) {
        const time = t(clock);
        const box = 70 * d.s;
        for (let i = 0; i < 7; i++) {
          const k = ((time * 0.12 + i * 0.37) % 1 + 1) % 1;
          const x = d.x + ((i * 23) % box) - box / 2 + Math.sin(time * 1.3 + i * 2) * 5;
          const y = d.y - box / 2 + k * box;
          ctx.globalAlpha = Math.sin(k * Math.PI) * 0.85;
          flake(ctx, x, y, 2.2 + (i % 3) * 0.6, time + i, WHITE, 0.7);
        }
        ctx.globalAlpha = 1;
      },
    },
    // A big snowflake turning slowly.
    flake: {
      layer: "low",
      draw(ctx, p, d, clock) {
        flake(ctx, d.x, d.y, 10 * d.s, t(clock) * 0.4, "rgba(235, 248, 255, 0.85)", 1.6 * d.s);
      },
    },
    // A yellow "penguin crossing" sign on a post.
    xing: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        const { x, y } = d;
        line(ctx, x, y, x, y - 14 * s, "#6d7488", 1.6 * s);
        polygon(ctx, [{ x, y: y - 30 * s }, { x: x + 10 * s, y: y - 20 * s }, { x, y: y - 10 * s }, { x: x - 10 * s, y: y - 20 * s }]);
        fill(ctx, "#ffd23f");
        stroke(ctx, COAL, 1.1 * s);
        penguinBody(ctx, x, y - 20 * s, 4.5 * s, 0);
      },
    },
    // A street lamp with a warm glow.
    lamp: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const g = radial(ctx, x, y - 22 * s, 0, 16 * s, [[0, "rgba(255, 215, 120, 0.55)"], [1, "rgba(255, 215, 120, 0)"]]);
        if (g) {
          circle(ctx, x, y - 22 * s, 16 * s);
          fill(ctx, g);
        }
        line(ctx, x, y, x, y - 20 * s, "#2a3040", 1.8 * s);
        ctx.fillStyle = "#2a3040";
        ctx.fillRect(x - 4 * s, y - 26 * s, 8 * s, 2 * s);
        circle(ctx, x, y - 22 * s, 3 * s * (0.95 + Math.sin(t(clock) * 6 + x) * 0.05));
        fill(ctx, WARM);
        polygon(ctx, [{ x: x - 4.5 * s, y: y - 26 * s }, { x: x + 4.5 * s, y: y - 26 * s }, { x, y: y - 29 * s }]);
        fill(ctx, SNOW);
      },
    },
    // A red ice-fishing hut with a fishing line out the side.
    fishhut: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        ctx.fillStyle = "#c7343f";
        ctx.fillRect(x - 10 * s, y - 12 * s, 20 * s, 14 * s);
        polygon(ctx, [{ x: x - 12 * s, y: y - 11 * s }, { x: x + 12 * s, y: y - 11 * s }, { x, y: y - 20 * s }]);
        fill(ctx, SNOW);
        ctx.fillStyle = WARM;
        ctx.fillRect(x - 6 * s, y - 8 * s, 5 * s, 4 * s);
        ctx.fillStyle = "#5a1a1e";
        ctx.fillRect(x + 2 * s, y - 6 * s, 5 * s, 8 * s);
        const bob = Math.sin(t(clock) * 2) * 1;
        line(ctx, x + 10 * s, y - 6 * s, x + 18 * s, y - 10 * s, WOOD_DARK, 1 * s);
        line(ctx, x + 18 * s, y - 10 * s, x + 18 * s, y + 4 * s + bob, "rgba(255,255,255,0.8)", 0.5 * s);
        ellipse(ctx, x + 18 * s, y + 5 * s, 4 * s, 1.6 * s);
        fill(ctx, "#1d5c97");
        circle(ctx, x + 18 * s, y + 4 * s + bob, 1 * s);
        fill(ctx, SCARF);
      },
    },
    // Giant yeti footprints marching off.
    footprints: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        for (let i = 0; i < 4; i++) {
          const x = d.x + i * 14 * s;
          const y = d.y + (i % 2 ? 6 : -6) * s;
          ellipse(ctx, x, y, 5 * s, 3 * s);
          fill(ctx, "rgba(225, 236, 255, 0.55)");
          for (let k = -1; k <= 1; k++) {
            circle(ctx, x + 5.5 * s, y + k * 2 * s, 1.1 * s);
            fill(ctx, "rgba(225, 236, 255, 0.55)");
          }
        }
      },
    },
    // A gold star for the top of the tree, twinkling.
    star: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s * (1 + Math.sin(t(clock) * 3) * 0.06);
        const g = radial(ctx, d.x, d.y, 0, 20 * s, [[0, "rgba(255, 230, 120, 0.6)"], [1, "rgba(255, 230, 120, 0)"]]);
        if (g) {
          circle(ctx, d.x, d.y, 20 * s);
          fill(ctx, g);
        }
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const r = (i % 2 ? 4.5 : 11) * s;
          pts.push({ x: d.x + Math.cos(a) * r, y: d.y + Math.sin(a) * r });
        }
        polygon(ctx, pts);
        fill(ctx, "#ffd23f");
        stroke(ctx, "#c78a10", 1);
      },
    },
    // A wrapped present with a ribbon and bow.
    gift: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        const { x, y } = d;
        const colors = ["#e2323f", "#2f7fe0", "#26b36b", "#a04ee0"];
        const c = colors[Math.round(x / 13) % colors.length];
        ctx.fillStyle = "rgba(20, 40, 80, 0.25)";
        ctx.fillRect(x - 8 * s + 2, y - 8 * s + 2, 16 * s, 14 * s);
        ctx.fillStyle = c;
        ctx.fillRect(x - 8 * s, y - 8 * s, 16 * s, 14 * s);
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(x - 1.5 * s, y - 8 * s, 3 * s, 14 * s);
        ctx.fillRect(x - 8 * s, y - 2.5 * s, 16 * s, 3 * s);
        for (const side of [-1, 1]) {
          ellipse(ctx, x + side * 3 * s, y - 10 * s, 3.2 * s, 2 * s, side * 0.5);
          fill(ctx, "#ffd23f");
        }
      },
    },
    // A snow globe's wooden base, under the glass.
    plinth: {
      layer: "low",
      draw(ctx, p, d) {
        const { x, y } = d;
        polygon(ctx, [{ x: x - 70, y: y - 10 }, { x: x + 70, y: y - 10 }, { x: x + 82, y: y + 10 }, { x: x - 82, y: y + 10 }]);
        fill(ctx, WOOD);
        ctx.fillStyle = WOOD_DARK;
        ctx.fillRect(x - 76, y - 1, 152, 1.5);
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(x - 22, y - 6, 44, 9);
        label(ctx, "FROSTY", x, y - 1.3, 6.5, "#6a4322");
      },
    },
    // A frozen waterfall pouring off a cliff, light running down the ice.
    falls: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const w = 70 * s;
        const h = 70 * s;
        // The cliff on either side.
        polygon(ctx, [{ x: x - w, y: y - h / 2 }, { x: x - w / 2, y: y - h / 2 - 8 * s }, { x: x - w / 2 + 4 * s, y: y + h / 2 }, { x: x - w - 6 * s, y: y + h / 2 }]);
        fill(ctx, "#5c6f94");
        polygon(ctx, [{ x: x + w / 2, y: y - h / 2 - 8 * s }, { x: x + w, y: y - h / 2 }, { x: x + w + 6 * s, y: y + h / 2 }, { x: x + w / 2 - 4 * s, y: y + h / 2 }]);
        fill(ctx, "#4d5f83");
        for (const side of [-1, 1]) {
          const cx = x + side * w * 0.75;
          polygon(ctx, [{ x: cx - w * 0.3, y: y - h / 2 + 2 * s }, { x: cx - w * 0.22, y: y - h / 2 - 5 * s }, { x: cx + w * 0.22, y: y - h / 2 - 5 * s }, { x: cx + w * 0.3, y: y - h / 2 + 2 * s }, { x: cx + w * 0.1, y: y - h / 2 + 6 * s }, { x: cx - w * 0.05, y: y - h / 2 + 2 * s }, { x: cx - w * 0.18, y: y - h / 2 + 7 * s }]);
          fill(ctx, SNOW);
        }
        // The ice itself, in long frozen columns.
        polygon(ctx, [{ x: x - w / 2, y: y - h / 2 - 8 * s }, { x: x + w / 2, y: y - h / 2 - 8 * s }, { x: x + w / 2 - 4 * s, y: y + h / 2 }, { x: x - w / 2 + 4 * s, y: y + h / 2 }]);
        fill(ctx, "#9fe3fb");
        for (let i = 0; i < 7; i++) {
          const cx = x - w / 2 + 6 * s + i * (w - 12 * s) / 6;
          line(ctx, cx, y - h / 2 - 6 * s, cx + Math.sin(i * 1.7) * 2 * s, y + h / 2 + 3 * s, i % 2 ? "#d8f7ff" : "#6cc6ea", 3 * s);
        }
        // A glint sliding down.
        const k = (t(clock) * 0.35) % 1;
        circle(ctx, x - w / 4 + Math.sin(k * 9) * 3 * s, y - h / 2 + k * h, 2.5 * s);
        fill(ctx, `rgba(255, 255, 255, ${0.9 - k * 0.6})`);
        // Snow on top, and a pile of ice at the foot.
        ellipse(ctx, x, y - h / 2 - 8 * s, w * 0.75, 7 * s);
        fill(ctx, SNOW);
        ellipse(ctx, x, y + h / 2 + 3 * s, w * 0.6, 7 * s);
        fill(ctx, "#c8f0ff");
        for (let i = 0; i < 9; i++) {
          const ix = x - w / 2 + i * (w / 8);
          polygon(ctx, [{ x: ix - 2.5 * s, y: y - h / 2 - 4 * s }, { x: ix + 2.5 * s, y: y - h / 2 - 4 * s }, { x: ix, y: y - h / 2 + (6 + (i % 3) * 4) * s }]);
          fill(ctx, "#e9fbff");
        }
      },
    },
  },
};
