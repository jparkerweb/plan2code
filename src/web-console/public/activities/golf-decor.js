// Plan2Code Web Console - mini golf's scenery and props: the sharks, bats and torches round the course, the looks of what the ball hits, and the power-up icons.
//
// Drawing only, like golf-draw.js, which calls in here: no rules and no state.
// Every piece is drawn in course units around its own point, and anything
// that moves (a fin circling, a wing flapping, a flame) follows the round's
// clock, never Math.random(), so a paused frame stays still. The palette `p`
// is the hole's theme from golf-draw.js.

/* --------------------------------------------------------------- helpers */

export function polygon(ctx, points) {
  ctx.beginPath();
  points.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.closePath();
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2);
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  if (typeof ctx.ellipse === "function") ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  else ctx.arc(x, y, Math.max(0.01, rx), 0, Math.PI * 2);
}

// A radial gradient, or null where the context makes none (a stub in Node):
// the caller then fills flat or skips the glow.
export function radial(ctx, x, y, r0, r1, stops) {
  if (typeof ctx.createRadialGradient !== "function") return null;
  let g = null;
  try {
    g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  } catch {
    return null;
  }
  if (!g || typeof g.addColorStop !== "function") return null;
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

const fill = (ctx, color) => {
  ctx.fillStyle = color;
  ctx.fill();
};

const stroke = (ctx, color, width) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};

function line(ctx, x1, y1, x2, y2, color, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  stroke(ctx, color, width);
}

function label(ctx, str, x, y, size, color, font) {
  ctx.font = `700 ${size}px ${font || "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Turns the context to draw along an angle around a point, for the callback.
function turned(ctx, x, y, angle, draw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  draw();
  ctx.restore();
}

const t = (clock) => clock / 1000;

/* ---------------------------------------------------------------- props */

// The looks of a bumper, by `look` or the theme's own.
export function drawBumperLook(ctx, p, b, clock) {
  const look = b.look || (p.theme === "cave" ? "mushroom" : "barrel");
  const { x, y, r } = b;
  circle(ctx, x + 1.5, y + 2, r);
  fill(ctx, p.shadow);
  if (look === "barrel") {
    circle(ctx, x, y, r);
    fill(ctx, "#94602e");
    circle(ctx, x, y, r * 0.72);
    stroke(ctx, "#3a2a1c", 1.4);
    circle(ctx, x, y, r * 0.38);
    fill(ctx, "#6f4520");
    circle(ctx, x, y, r);
    stroke(ctx, "#3a2a1c", 1.6);
  } else if (look === "cannonball") {
    circle(ctx, x, y, r);
    fill(ctx, "#25252c");
    circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.3);
    fill(ctx, "#6d6d7a");
  } else if (look === "chest") {
    const s = r * 1.5;
    ctx.fillStyle = "#7a4a1e";
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = "#d9a520";
    ctx.fillRect(x - s / 2, y - 1.2, s, 2.4);
    ctx.fillRect(x - 1.5, y - 2.5, 3, 5);
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
  } else if (look === "coin") {
    const shine = 0.5 + 0.5 * Math.sin(t(clock) * 3 + x);
    circle(ctx, x, y, r);
    fill(ctx, "#e8b923");
    circle(ctx, x, y, r * 0.7);
    stroke(ctx, "#a87a0c", 1.3);
    label(ctx, "$", x, y + 0.5, r * 1.1, "#a87a0c");
    circle(ctx, x - r * 0.4, y - r * 0.4, r * 0.18 + shine * 0.6);
    fill(ctx, "#fff6c9");
  } else if (look === "mushroom") {
    const squish = 1 + Math.sin(t(clock) * 4 + y) * 0.04;
    circle(ctx, x, y, r * squish);
    fill(ctx, "#e0468a");
    for (const [dx, dy, s] of [[-0.4, -0.3, 0.22], [0.35, -0.2, 0.18], [0, 0.4, 0.2], [0.45, 0.35, 0.13]]) {
      circle(ctx, x + dx * r, y + dy * r, s * r);
      fill(ctx, "#ffe3f1");
    }
  } else if (look === "rock") {
    circle(ctx, x, y, r);
    fill(ctx, "#5a5468");
    circle(ctx, x - r * 0.15, y - r * 0.15, r * 0.62);
    fill(ctx, "#77708a");
    circle(ctx, x - r * 0.25, y - r * 0.25, r * 0.25);
    fill(ctx, "#a49dba");
  } else if (look === "crystal") {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    polygon(ctx, pts);
    fill(ctx, "#8a66ee");
    polygon(ctx, [pts[0], pts[2], pts[4]]);
    fill(ctx, "#b59cff");
    circle(ctx, x - r * 0.25, y - r * 0.3, r * 0.2);
    fill(ctx, "#f1ebff");
  } else {
    circle(ctx, x, y, r);
    fill(ctx, "#9c3327");
  }
}

// A mover at its place this moment.
export function drawMoverLook(ctx, p, m, clock) {
  const { x, y, r } = m;
  const look = m.look || "barrel";
  ellipse(ctx, x + 1.5, y + 2.5, r, r * 0.9);
  fill(ctx, p.shadow);
  if (look === "barrel") {
    // Rolls the way it travels: the hoops slide past.
    const roll = (m.y * 0.4 + m.x * 0.4) % 6;
    circle(ctx, x, y, r);
    fill(ctx, "#a06a34");
    ctx.save();
    circle(ctx, x, y, r);
    ctx.clip();
    for (let k = -2; k <= 2; k++) line(ctx, x - r, y + k * 6 + roll - 3, x + r, y + k * 6 + roll - 3, "#3a2a1c", 1.5);
    ctx.restore();
    label(ctx, "TNT", x, y, r * 0.6, "#ffe9b0");
  } else if (look === "crab") {
    const wig = Math.sin(t(clock) * 14) * 1.5;
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) line(ctx, x + side * r * 0.6, y - 2 + k * 2.5, x + side * (r + 3), y - 3 + k * 3 + wig * side, "#a8261b", 1.2);
      circle(ctx, x + side * (r + 1), y - r * 0.9 + wig, r * 0.42);
      fill(ctx, "#e1402d");
    }
    ellipse(ctx, x, y, r, r * 0.75);
    fill(ctx, "#e1402d");
    for (const side of [-1, 1]) {
      circle(ctx, x + side * 2.2, y - r * 0.55, 1.6);
      fill(ctx, "#ffffff");
      circle(ctx, x + side * 2.2, y - r * 0.55, 0.8);
      fill(ctx, "#111111");
    }
  } else if (look === "cart") {
    const s = r * 1.6;
    ctx.fillStyle = "#3d3a44";
    ctx.fillRect(x - s / 2 - 2, y - s / 2 + 1, 3, s - 2);
    ctx.fillRect(x + s / 2 - 1, y - s / 2 + 1, 3, s - 2);
    ctx.fillStyle = "#6b6373";
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.strokeStyle = "#2a2730";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    for (const [dx, dy, c] of [[-3, -2, "#f2c84b"], [3, 1, "#7fe6ff"], [-1, 3, "#f2c84b"], [2, -4, "#ff7ad9"]]) {
      circle(ctx, x + dx, y + dy, 2.2);
      fill(ctx, c);
    }
  } else if (look === "fireball") {
    const flick = 1 + Math.sin(t(clock) * 25) * 0.08;
    const glow = radial(ctx, x, y, 0, r * 2.4, [[0, "rgba(255,220,120,0.9)"], [0.4, "rgba(255,120,30,0.6)"], [1, "rgba(255,60,0,0)"]]);
    if (glow) {
      circle(ctx, x, y, r * 2.4);
      fill(ctx, glow);
    }
    circle(ctx, x, y, r * flick);
    fill(ctx, "#ff7a1a");
    circle(ctx, x - 1, y - 1, r * 0.55 * flick);
    fill(ctx, "#ffe08a");
    // A goofy face, because why not.
    circle(ctx, x - 2.5, y - 1, 1);
    fill(ctx, "#3a1200");
    circle(ctx, x + 2.5, y - 1, 1);
    fill(ctx, "#3a1200");
  }
}

// A spinner's bar, with its look: a ship's wheel spoke, a kraken tentacle, a
// dragon's tail, or a plain plank.
export function drawSpinnerLook(ctx, p, s, clock) {
  const look = s.look || "plank";
  const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
  const arm = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
  ctx.lineCap = "round";
  line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, p.shadow, 6);
  if (look === "wheel") {
    line(ctx, s.x1, s.y1, s.x2, s.y2, "#7a4a22", 4.5);
    line(ctx, s.x1, s.y1, s.x2, s.y2, "#b07a43", 1.6);
    for (const [ex, ey] of [[s.x1, s.y1], [s.x2, s.y2]]) {
      circle(ctx, ex, ey, 3.2);
      fill(ctx, "#6b3f1d");
    }
    circle(ctx, s.x, s.y, 13);
    stroke(ctx, "#7a4a22", 3);
    circle(ctx, s.x, s.y, 5);
    fill(ctx, "#e0b030");
  } else if (look === "tentacle" || look === "tail") {
    const tentacle = look === "tentacle";
    turned(ctx, s.x, s.y, angle, () => {
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const u = i / 12;
          const w = Math.sin(u * 6 + t(clock) * 5) * 2.2 * u;
          if (i === 0) ctx.moveTo(0, 0);
          else ctx.lineTo(dir * u * arm, w);
        }
        stroke(ctx, tentacle ? "#8e3fa8" : "#b5262a", 5.5);
        for (let i = 2; i < 11; i += 2) {
          const u = i / 12;
          circle(ctx, dir * u * arm, Math.sin(u * 6 + t(clock) * 5) * 2.2 * u + (tentacle ? 1.5 : -1.5), tentacle ? 1.2 : 1.6);
          fill(ctx, tentacle ? "#f0b7ff" : "#f2c84b");
        }
      }
    });
    circle(ctx, s.x, s.y, 6);
    fill(ctx, tentacle ? "#6c2a82" : "#7d1418");
  } else {
    line(ctx, s.x1, s.y1, s.x2, s.y2, p.spinner, 4);
    circle(ctx, s.x, s.y, 5);
    fill(ctx, p.hub);
  }
}

// A power-up's icon, `r` across, centered on x, y.
export function drawPowerIcon(ctx, kind, x, y, r) {
  if (kind === "doubloon") {
    circle(ctx, x, y, r);
    fill(ctx, "#f0c22c");
    circle(ctx, x, y, r * 0.7);
    stroke(ctx, "#a87a0c", r * 0.18);
    label(ctx, "1", x, y + r * 0.05, r * 1.1, "#a87a0c");
  } else if (kind === "cannon") {
    circle(ctx, x - r * 0.15, y + r * 0.15, r * 0.8);
    fill(ctx, "#25252c");
    line(ctx, x + r * 0.35, y - r * 0.35, x + r * 0.75, y - r * 0.85, "#c8a26a", r * 0.18);
    circle(ctx, x + r * 0.8, y - r * 0.9, r * 0.25);
    fill(ctx, "#ffb020");
  } else if (kind === "ghost") {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.15, r * 0.75, Math.PI, 0);
    ctx.lineTo(x + r * 0.75, y + r * 0.8);
    for (let i = 0; i < 4; i++) ctx.lineTo(x + r * 0.75 - (i + 0.5) * r * 0.375, y + (i % 2 ? r * 0.8 : r * 0.5));
    ctx.lineTo(x - r * 0.75, y + r * 0.8);
    ctx.closePath();
    fill(ctx, "#f4f7ff");
    for (const dx of [-0.28, 0.28]) {
      circle(ctx, x + dx * r, y - r * 0.2, r * 0.15);
      fill(ctx, "#1c1c2a");
    }
  } else if (kind === "magnet") {
    ctx.beginPath();
    ctx.arc(x, y - r * 0.05, r * 0.6, Math.PI, 0, false);
    stroke(ctx, "#d4342a", r * 0.45);
    ctx.fillStyle = "#d9d9e3";
    ctx.fillRect(x - r * 0.83, y, r * 0.45, r * 0.55);
    ctx.fillRect(x + r * 0.38, y, r * 0.45, r * 0.55);
  } else if (kind === "bouncy") {
    ellipse(ctx, x, y + r * 0.25, r * 0.85, r * 0.55);
    fill(ctx, "#ffd43b");
    circle(ctx, x - r * 0.35, y - r * 0.35, r * 0.42);
    fill(ctx, "#ffd43b");
    polygon(ctx, [{ x: x - r * 0.75, y: y - r * 0.4 }, { x: x - r * 1.05, y: y - r * 0.25 }, { x: x - r * 0.72, y: y - r * 0.18 }]);
    fill(ctx, "#ff8a1f");
    circle(ctx, x - r * 0.42, y - r * 0.45, r * 0.1);
    fill(ctx, "#111111");
  } else if (kind === "bigcup") {
    ctx.fillStyle = "#efdcae";
    ctx.fillRect(x - r * 0.85, y - r * 0.7, r * 1.7, r * 1.4);
    ctx.strokeStyle = "#a7834c";
    ctx.lineWidth = r * 0.1;
    ctx.strokeRect(x - r * 0.85, y - r * 0.7, r * 1.7, r * 1.4);
    line(ctx, x - r * 0.35, y - r * 0.3, x + r * 0.35, y + r * 0.3, "#d4342a", r * 0.22);
    line(ctx, x + r * 0.35, y - r * 0.3, x - r * 0.35, y + r * 0.3, "#d4342a", r * 0.22);
  } else if (kind === "spyglass") {
    ctx.lineCap = "round";
    line(ctx, x - r * 0.75, y + r * 0.55, x + r * 0.55, y - r * 0.45, "#a8792b", r * 0.42);
    line(ctx, x - r * 0.2, y + r * 0.12, x + r * 0.55, y - r * 0.45, "#d9a94a", r * 0.55);
    circle(ctx, x + r * 0.62, y - r * 0.5, r * 0.3);
    fill(ctx, "#bfe8ff");
  }
}

/* --------------------------------------------------------------- scenery */

// Each kind of scenery: the layer it goes on ("low" under the walls, "high"
// over the ball, "glow" over a cave's darkness) and how it is drawn. `light`
// is the glow a cave casts around it, if any.
const DECOR = {
  /* pirate */
  shark: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const a = t(clock) * 0.9 * (d.s > 0.85 ? 1 : -1) + d.x;
      const x = d.x + Math.cos(a) * 32 * d.s;
      const y = d.y + Math.sin(a) * 9 * d.s;
      const dir = Math.sign(-Math.sin(a) * (d.s > 0.85 ? 1 : -1)) || 1;
      ctx.lineCap = "round";
      line(ctx, x - dir * 4, y + 4, x - dir * 18, y + 5, "rgba(255,255,255,0.55)", 1.2);
      polygon(ctx, [{ x: x - 5 * d.s, y: y + 4 }, { x: x + 5 * d.s, y: y + 4 }, { x: x - dir * 3 * d.s, y: y - 9 * d.s }]);
      fill(ctx, "#5d6b78");
    },
  },
  ship: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const bob = Math.sin(t(clock) * 1.6) * 1.5;
      const y = d.y + bob;
      polygon(ctx, [{ x: d.x - 22, y: y }, { x: d.x + 22, y: y }, { x: d.x + 15, y: y + 9 }, { x: d.x - 16, y: y + 9 }]);
      fill(ctx, "#5c3416");
      line(ctx, d.x, y, d.x, y - 30, "#3a2410", 1.6);
      polygon(ctx, [{ x: d.x - 13, y: y - 26 }, { x: d.x + 13, y: y - 26 }, { x: d.x + 11, y: y - 6 }, { x: d.x - 11, y: y - 6 }]);
      fill(ctx, "#f1ead6");
      ctx.fillStyle = "#111111";
      ctx.fillRect(d.x, y - 36, 9, 6);
      circle(ctx, d.x + 4.5, y - 33, 1.5);
      fill(ctx, "#ffffff");
    },
  },
  bottle: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const a = Math.sin(t(clock) * 2 + d.x) * 0.5;
      turned(ctx, d.x, d.y + Math.sin(t(clock) * 1.7) * 1.5, a, () => {
        ellipse(ctx, 0, 0, 7, 3);
        fill(ctx, "rgba(90,170,110,0.85)");
        ctx.fillStyle = "#f4ead0";
        ctx.fillRect(-3, -1.2, 5, 2.4);
        ctx.fillStyle = "#8a5a2b";
        ctx.fillRect(6, -1.3, 3, 2.6);
      });
    },
  },
  palm: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      ellipse(ctx, d.x, d.y + 4 * s, 16 * s, 8 * s);
      fill(ctx, "#ecd79c");
      const sway = Math.sin(t(clock) * 1.3 + d.x) * 0.12;
      line(ctx, d.x, d.y + 4 * s, d.x + 4 * s, d.y - 14 * s, "#8a5a2b", 2.5 * s);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + sway;
        ctx.beginPath();
        ctx.moveTo(d.x + 4 * s, d.y - 14 * s);
        ctx.quadraticCurveTo(d.x + 4 * s + Math.cos(a) * 9 * s, d.y - 18 * s + Math.sin(a) * 6 * s, d.x + 4 * s + Math.cos(a) * 15 * s, d.y - 12 * s + Math.sin(a) * 8 * s);
        stroke(ctx, "#2f8f3c", 3 * s);
      }
      circle(ctx, d.x + 3 * s, d.y - 12 * s, 1.8 * s);
      fill(ctx, "#6b4a2a");
    },
  },
  wreck: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const tilt = -0.35 + Math.sin(t(clock) * 0.8) * 0.03;
      turned(ctx, d.x, d.y, tilt, () => {
        polygon(ctx, [{ x: -50, y: -6 }, { x: 40, y: -10 }, { x: 52, y: 4 }, { x: 30, y: 14 }, { x: -44, y: 12 }]);
        fill(ctx, "#5c3416");
        for (let x = -40; x < 40; x += 10) line(ctx, x, -6, x + 3, 12, "#3a2410", 1);
        polygon(ctx, [{ x: -8, y: -8 }, { x: 6, y: -9 }, { x: 0, y: 6 }]);
        fill(ctx, "#1b6d99");
        line(ctx, 10, -8, 22, -46, "#3a2410", 2);
        polygon(ctx, [{ x: 13, y: -40 }, { x: 34, y: -36 }, { x: 18, y: -24 }]);
        fill(ctx, "rgba(241,234,214,0.8)");
      });
    },
  },
  crab: {
    layer: "low",
    draw(ctx, p, d, clock) {
      drawMoverLook(ctx, p, { x: d.x + Math.sin(t(clock) * 1.5) * 10, y: d.y, r: 6 * d.s, look: "crab" }, clock);
    },
  },
  parrot: {
    layer: "high",
    draw(ctx, p, d, clock) {
      const bob = Math.abs(Math.sin(t(clock) * 3)) * -3;
      const y = d.y + bob;
      ellipse(ctx, d.x, y, 5, 8);
      fill(ctx, "#e4312b");
      ellipse(ctx, d.x + 3, y + 2, 3, 6, 0.3);
      fill(ctx, "#2f7fd8");
      circle(ctx, d.x, y - 8, 4);
      fill(ctx, "#e4312b");
      polygon(ctx, [{ x: d.x - 3, y: y - 8 }, { x: d.x - 7, y: y - 6 }, { x: d.x - 3, y: y - 5 }]);
      fill(ctx, "#f2c84b");
      circle(ctx, d.x - 1, y - 9, 1);
      fill(ctx, "#111111");
      polygon(ctx, [{ x: d.x - 2, y: y + 7 }, { x: d.x + 2, y: y + 7 }, { x: d.x + 1, y: y + 15 }]);
      fill(ctx, "#2e9e48");
      // Squawks now and then.
      if (Math.floor(t(clock) / 2.5) % 3 === 0) label(ctx, "SQUAWK!", d.x, y - 18, 6, "#fff6c9");
    },
  },
  island: {
    layer: "low",
    draw(ctx, p, d) {
      ellipse(ctx, d.x, d.y, 18 * d.s, 9 * d.s);
      fill(ctx, "#ecd79c");
      line(ctx, d.x - 3, d.y - 3, d.x + 3, d.y + 3, "#d4342a", 1.6);
      line(ctx, d.x + 3, d.y - 3, d.x - 3, d.y + 3, "#d4342a", 1.6);
    },
  },
  cannon: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const dir = d.s < 0 ? -1 : 1;
      ctx.fillStyle = "#6b3f1d";
      ctx.fillRect(d.x - 8, d.y - 3, 16, 7);
      turned(ctx, d.x, d.y, dir * Math.PI / 2, () => {
        ctx.fillStyle = "#2b2b30";
        ctx.fillRect(-4, -4, 18, 8);
        circle(ctx, -4, 0, 5);
        fill(ctx, "#2b2b30");
      });
      // A puff of smoke every few seconds.
      const k = (t(clock) + d.x / 50) % 3;
      if (k < 0.8) {
        const r = 3 + k * 9;
        circle(ctx, d.x, d.y + dir * (16 + k * 10), r);
        fill(ctx, `rgba(230,230,230,${0.8 - k})`);
        if (k < 0.15) label(ctx, "BOOM!", d.x, d.y + dir * 30, 7, "#ffb020");
      }
    },
  },
  anchor: {
    layer: "low",
    draw(ctx, p, d) {
      ctx.lineCap = "round";
      line(ctx, d.x, d.y - 10, d.x, d.y + 8, "#5b6470", 2.2);
      line(ctx, d.x - 5, d.y - 6, d.x + 5, d.y - 6, "#5b6470", 2);
      ctx.beginPath();
      ctx.arc(d.x, d.y + 1, 7, 0.2, Math.PI - 0.2);
      stroke(ctx, "#5b6470", 2.2);
      circle(ctx, d.x, d.y - 12, 2.2);
      stroke(ctx, "#5b6470", 1.5);
    },
  },
  tentacle: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      ctx.lineCap = "round";
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const u = i / 10;
        const x = d.x + Math.sin(u * 4 + t(clock) * 2 + d.y) * 6 * s * u;
        const y = d.y + 10 * s - u * 26 * s;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      stroke(ctx, "#8e3fa8", 5 * s);
      ellipse(ctx, d.x, d.y + 10 * s, 7 * s, 2.5 * s);
      stroke(ctx, "rgba(255,255,255,0.5)", 1);
    },
  },
  kraken: {
    layer: "low",
    draw(ctx, p, d, clock) {
      ellipse(ctx, d.x, d.y + 6, 40, 16);
      fill(ctx, "#6c2a82");
      const blink = Math.floor(t(clock) * 10) % 40 === 0;
      for (const dx of [-16, 16]) {
        ellipse(ctx, d.x + dx, d.y - 2, 8, blink ? 1 : 7);
        fill(ctx, "#fff6c9");
        if (!blink) {
          circle(ctx, d.x + dx + Math.sin(t(clock)) * 2, d.y - 1, 3);
          fill(ctx, "#111111");
        }
      }
    },
  },
  ghost: {
    layer: "high",
    draw(ctx, p, d, clock) {
      const y = d.y + Math.sin(t(clock) * 1.8 + d.x) * 5;
      const x = d.x + Math.sin(t(clock) * 0.7 + d.y) * 14;
      ctx.globalAlpha = 0.6 + Math.sin(t(clock) * 2.3) * 0.2;
      drawPowerIcon(ctx, "ghost", x, y, 12 * d.s);
      if (Math.floor(t(clock) / 3) % 2 === 0) label(ctx, "Booo!", x + 16 * d.s, y - 12 * d.s, 6, "#f4f7ff");
      ctx.globalAlpha = 1;
    },
  },
  jolly: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const wave = Math.sin(t(clock) * 4) * 1.5;
      line(ctx, d.x, d.y + 14, d.x, d.y - 14, "#3a2410", 1.5);
      ctx.beginPath();
      ctx.moveTo(d.x, d.y - 14);
      ctx.quadraticCurveTo(d.x + 9, d.y - 16 + wave, d.x + 18, d.y - 14 + wave);
      ctx.lineTo(d.x + 18, d.y - 2 + wave);
      ctx.quadraticCurveTo(d.x + 9, d.y - 4 + wave, d.x, d.y - 2);
      ctx.closePath();
      fill(ctx, "#111111");
      circle(ctx, d.x + 9, d.y - 9 + wave * 0.6, 2.5);
      fill(ctx, "#f4f1ea");
    },
  },
  skullrock: {
    layer: "low",
    draw(ctx, p, d, clock) {
      ellipse(ctx, d.x, d.y + 40, 70, 20);
      fill(ctx, "#ecd79c");
      ellipse(ctx, d.x, d.y, 42, 38);
      fill(ctx, "#8a8478");
      ellipse(ctx, d.x, d.y - 4, 36, 30);
      fill(ctx, "#a29c8f");
      const glow = 0.5 + 0.5 * Math.sin(t(clock) * 2);
      for (const dx of [-14, 14]) {
        ellipse(ctx, d.x + dx, d.y - 6, 9, 10);
        fill(ctx, "#1d1a17");
        circle(ctx, d.x + dx, d.y - 5, 2 + glow);
        fill(ctx, `rgba(255,80,40,${0.5 + glow * 0.5})`);
      }
      polygon(ctx, [{ x: d.x, y: d.y + 2 }, { x: d.x - 4, y: d.y + 10 }, { x: d.x + 4, y: d.y + 10 }]);
      fill(ctx, "#1d1a17");
      for (let i = -3; i <= 3; i++) {
        ctx.fillStyle = "#f1ead6";
        ctx.fillRect(d.x + i * 5 - 2, d.y + 16, 4, 6);
      }
    },
  },
  chest: {
    layer: "low",
    draw(ctx, p, d, clock) {
      ctx.fillStyle = "#7a4a1e";
      ctx.fillRect(d.x - 12, d.y - 4, 24, 14);
      ctx.fillStyle = "#5c3416";
      ctx.fillRect(d.x - 12, d.y - 14, 24, 8);
      for (let i = 0; i < 6; i++) {
        circle(ctx, d.x - 9 + i * 3.6, d.y - 4 - (i % 2) * 2, 2.4);
        fill(ctx, "#f0c22c");
      }
      const sparkle = Math.floor(t(clock) * 4) % 6;
      circle(ctx, d.x - 8 + sparkle * 3, d.y - 8, 1.2);
      fill(ctx, "#ffffff");
    },
  },

  /* cave */
  bat: {
    layer: "high",
    draw(ctx, p, d, clock) {
      const s = d.s;
      const a = t(clock) * 1.1 + d.x;
      const x = d.x + Math.sin(a) * 40 * s;
      const y = d.y + Math.sin(a * 2) * 12 * s;
      const flap = Math.sin(t(clock) * 18 + d.y) * 5 * s;
      for (const dir of [-1, 1]) {
        polygon(ctx, [{ x, y }, { x: x + dir * 6 * s, y: y - 4 * s - flap }, { x: x + dir * 13 * s, y: y - 1 * s - flap * 0.6 }, { x: x + dir * 9 * s, y: y + 2 * s }, { x: x + dir * 5 * s, y: y + 1 * s }]);
        fill(ctx, "#0b0910");
      }
      circle(ctx, x, y, 3 * s);
      fill(ctx, "#0b0910");
      for (const dir of [-1, 1]) {
        circle(ctx, x + dir * 1.2 * s, y - 0.6 * s, 0.7 * s);
        fill(ctx, "#ff4d4d");
      }
    },
  },
  stalactite: {
    layer: "high",
    draw(ctx, p, d) {
      const s = d.s;
      for (const [dx, h, w] of [[-14, 18, 6], [0, 30, 8], [12, 14, 5], [24, 22, 6]]) {
        polygon(ctx, [{ x: d.x + dx * s - w * s, y: d.y }, { x: d.x + dx * s + w * s, y: d.y }, { x: d.x + dx * s, y: d.y + h * s }]);
        fill(ctx, "#3d3747");
        polygon(ctx, [{ x: d.x + dx * s - w * s * 0.3, y: d.y }, { x: d.x + dx * s + w * s * 0.2, y: d.y }, { x: d.x + dx * s, y: d.y + h * s * 0.85 }]);
        fill(ctx, "#5d566a");
      }
    },
  },
  crystal: {
    layer: "glow",
    light: { r: 34, color: "rgba(150,110,255,0.45)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const pulse = 0.8 + Math.sin(t(clock) * 2 + d.x) * 0.2;
      for (const [dx, h, a, c] of [[-6, 16, -0.4, "#7b5cf0"], [0, 22, 0, "#a68cff"], [6, 14, 0.45, "#5fd3ff"]]) {
        turned(ctx, d.x + dx * s, d.y, a, () => {
          polygon(ctx, [{ x: -3 * s, y: 0 }, { x: 3 * s, y: 0 }, { x: 2 * s, y: -h * s }, { x: 0, y: -(h + 4) * s }, { x: -2 * s, y: -h * s }]);
          ctx.globalAlpha = pulse;
          fill(ctx, c);
          ctx.globalAlpha = 1;
        });
      }
    },
  },
  torch: {
    layer: "glow",
    light: { r: 60, color: "rgba(255,170,60,0.5)" },
    draw(ctx, p, d, clock) {
      ctx.lineCap = "round";
      line(ctx, d.x, d.y + 10, d.x, d.y - 2, "#6b4a2a", 2.5);
      const f = Math.sin(t(clock) * 21 + d.x) * 1.2 + Math.sin(t(clock) * 13) * 0.8;
      polygon(ctx, [{ x: d.x - 4, y: d.y - 2 }, { x: d.x + 4, y: d.y - 2 }, { x: d.x + f * 0.6, y: d.y - 13 - f }]);
      fill(ctx, "#ff8a1f");
      polygon(ctx, [{ x: d.x - 2, y: d.y - 2 }, { x: d.x + 2, y: d.y - 2 }, { x: d.x + f * 0.3, y: d.y - 8 - f * 0.5 }]);
      fill(ctx, "#ffe08a");
    },
  },
  lantern: {
    layer: "glow",
    light: { r: 50, color: "rgba(255,210,110,0.45)" },
    draw(ctx, p, d, clock) {
      const swing = Math.sin(t(clock) * 1.5) * 4;
      line(ctx, d.x, 0, d.x + swing, d.y + 4, "#3d3747", 1);
      ctx.fillStyle = "#3d3747";
      ctx.fillRect(d.x + swing - 4, d.y + 4, 8, 10);
      ctx.fillStyle = "#ffd36b";
      ctx.fillRect(d.x + swing - 2.5, d.y + 6, 5, 6);
    },
  },
  eyes: {
    layer: "glow",
    draw(ctx, p, d, clock) {
      // Two eyes in the dark that blink, and now and then look at you.
      const k = Math.floor(t(clock) * 8 + d.x) % 30;
      const open = k > 1 ? 1 : 0.15;
      const look = Math.sin(t(clock) * 0.6 + d.y) * 1.5;
      for (const dx of [-5, 5]) {
        ellipse(ctx, d.x + dx * d.s, d.y, 3.2 * d.s, 2.2 * d.s * open);
        fill(ctx, "#ffe14d");
        if (open > 0.5) {
          ellipse(ctx, d.x + dx * d.s + look, d.y, 0.9 * d.s, 2 * d.s);
          fill(ctx, "#111111");
        }
      }
    },
  },
  skeleton: {
    layer: "low",
    draw(ctx, p, d, clock) {
      ctx.lineCap = "round";
      line(ctx, d.x - 9, d.y + 6, d.x + 9, d.y - 2, "#d8d2c2", 2.2);
      line(ctx, d.x - 9, d.y - 2, d.x + 9, d.y + 6, "#d8d2c2", 2.2);
      circle(ctx, d.x, d.y - 8, 6);
      fill(ctx, "#ece6d6");
      // The jaw chatters.
      const jaw = Math.abs(Math.sin(t(clock) * 6)) * 1.5;
      ctx.fillStyle = "#ece6d6";
      ctx.fillRect(d.x - 3.5, d.y - 3 + jaw, 7, 2.5);
      for (const dx of [-2.2, 2.2]) {
        circle(ctx, d.x + dx, d.y - 9, 1.6);
        fill(ctx, "#1d1a17");
      }
    },
  },
  rails: {
    layer: "low",
    draw(ctx, p, d) {
      for (let y = d.y - 105; y <= d.y + 105; y += 9) {
        ctx.fillStyle = "#4a3a2a";
        ctx.fillRect(d.x - 10, y, 20, 3);
      }
      line(ctx, d.x - 6, d.y - 108, d.x - 6, d.y + 108, "#8b8796", 1.6);
      line(ctx, d.x + 6, d.y - 108, d.x + 6, d.y + 108, "#8b8796", 1.6);
    },
  },
  gems: {
    layer: "glow",
    light: { r: 26, color: "rgba(255,120,220,0.35)" },
    draw(ctx, p, d) {
      const s = d.s;
      for (const [dx, dy, c] of [[-6, 2, "#ff5bd6"], [4, 3, "#4de3ff"], [-1, -3, "#f2c84b"], [8, -2, "#5bff9a"], [-9, -4, "#f2c84b"]]) {
        polygon(ctx, [{ x: d.x + dx * s, y: d.y + (dy - 3) * s }, { x: d.x + (dx + 3) * s, y: d.y + dy * s }, { x: d.x + dx * s, y: d.y + (dy + 3) * s }, { x: d.x + (dx - 3) * s, y: d.y + dy * s }]);
        fill(ctx, c);
      }
    },
  },
  spider: {
    layer: "high",
    draw(ctx, p, d, clock) {
      const y = d.y + Math.sin(t(clock) * 1.2) * 18;
      line(ctx, d.x, 0, d.x, y, "rgba(220,220,230,0.6)", 0.6);
      for (const dir of [-1, 1]) {
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(d.x, y);
          ctx.lineTo(d.x + dir * 5, y - 3 + k * 2);
          ctx.lineTo(d.x + dir * 8, y + k * 2.4);
          stroke(ctx, "#15121b", 1);
        }
      }
      circle(ctx, d.x, y, 3.5);
      fill(ctx, "#15121b");
      for (const dir of [-1, 1]) {
        circle(ctx, d.x + dir * 1.3, y - 1, 0.8);
        fill(ctx, "#ff4d4d");
      }
    },
  },
  web: {
    layer: "low",
    draw(ctx, p, d) {
      ctx.strokeStyle = "rgba(220,220,235,0.35)";
      ctx.lineWidth = 0.6;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + Math.cos(a) * 26, d.y + Math.sin(a) * 26);
        ctx.stroke();
      }
      for (const r of [8, 15, 22]) {
        circle(ctx, d.x, d.y, r);
        ctx.stroke();
      }
    },
  },
  glowworms: {
    layer: "glow",
    light: { r: 40, color: "rgba(110,255,200,0.3)" },
    draw(ctx, p, d, clock) {
      for (let i = 0; i < 9; i++) {
        const x = d.x - 40 + i * 10 + Math.sin(t(clock) + i) * 3;
        const y = d.y + Math.sin(t(clock) * 1.4 + i * 0.9) * 6;
        circle(ctx, x, y, 1.4 + (Math.sin(t(clock) * 3 + i) + 1) * 0.5);
        fill(ctx, "#8cffd9");
      }
    },
  },
  mushroom: {
    layer: "glow",
    light: { r: 30, color: "rgba(255,90,180,0.35)" },
    draw(ctx, p, d) {
      for (const [dx, dy, r] of [[-5, 3, 5], [4, -2, 6.5], [7, 6, 3.5]]) {
        circle(ctx, d.x + dx, d.y + dy, r);
        fill(ctx, "#e0468a");
        circle(ctx, d.x + dx - r * 0.3, d.y + dy - r * 0.3, r * 0.25);
        fill(ctx, "#ffe3f1");
      }
    },
  },
  dragon: {
    layer: "glow",
    light: { r: 70, color: "rgba(255,90,40,0.3)" },
    draw(ctx, p, d, clock) {
      // A sleeping dragon's head poking in from the right edge, snoring.
      const cx = d.x - 6;
      const breathe = Math.sin(t(clock) * 1.4) * 1.5;
      ellipse(ctx, cx, d.y, 44 + breathe, 32);
      fill(ctx, "#a3202a");
      for (let i = 0; i < 4; i++) {
        polygon(ctx, [{ x: cx - 26 + i * 12, y: d.y - 28 + i * 2 }, { x: cx - 20 + i * 12, y: d.y - 40 + i * 2 }, { x: cx - 14 + i * 12, y: d.y - 27 + i * 2 }]);
        fill(ctx, "#f2c84b");
      }
      // The closed eye, a sleepy curve.
      ctx.beginPath();
      ctx.arc(cx - 14, d.y - 12, 6, 0.2, Math.PI - 0.2);
      stroke(ctx, "#1d0608", 1.8);
      for (const dy of [-2, 6]) {
        circle(ctx, cx - 36 - breathe, d.y + dy, 2);
        fill(ctx, "#1d0608");
      }
      const k = (t(clock) % 3) / 3;
      label(ctx, "Z", cx - 46 - k * 14, d.y - 10 - k * 26, 7 + k * 5, `rgba(255,240,200,${1 - k})`);
      label(ctx, "z", cx - 52 - k * 8, d.y - 2 - k * 14, 5 + k * 3, `rgba(255,240,200,${0.8 - k * 0.8})`);
    },
  },
};

export const DECOR_KINDS = Object.freeze(Object.keys(DECOR));

// Draws the hole's scenery that belongs on `layer`.
export function drawDecor(ctx, p, decor, clock, layer) {
  for (const d of decor) {
    const kind = DECOR[d.kind];
    if (kind && kind.layer === layer) kind.draw(ctx, p, d, clock);
  }
}

// The glows the scenery casts, for a cave's darkness: { x, y, r, color }.
export function decorLights(decor) {
  const lights = [];
  for (const d of decor) {
    const kind = DECOR[d.kind];
    if (kind && kind.light) lights.push({ x: d.x, y: d.y - 4, r: kind.light.r * (d.s || 1), color: kind.light.color });
    if (d.kind === "eyes") lights.push({ x: d.x, y: d.y, r: 12, color: "rgba(255,225,80,0.25)" });
  }
  return lights;
}
