// Plan2Code Web Console - mini golf's Dino Valley look: the course's palette, ground, water, props and scenery.
//
// Drawing only, listed in golf-looks.js (which documents what a look holds).
// Jungle greens and earthy browns with hot lava oranges: fern-thick rough,
// mown jungle turf, dirt and basalt, murky swamp and black tar, eggs, bones
// and amber to bank off, dinosaurs that stomp, spin and stretch across the
// way, and a smoking volcano or two. Everything that moves follows the
// round's clock.

import { circle, ellipse, fill, label, line, polygon, radial, scatter, stroke, t, turned } from "./golf-paint.js";

const TAU = Math.PI * 2;

// A ground shadow under a prop.
const shadow = (ctx, p, x, y, rx, ry) => {
  ellipse(ctx, x + 1.5, y + 2.5, rx, ry);
  fill(ctx, p.shadow);
};

// A small speckled egg, standing on x, y and leaning by `lean` radians.
function egg(ctx, x, y, rx, ry, lean = 0) {
  turned(ctx, x, y, lean, () => {
    ellipse(ctx, 0, 0, rx, ry);
    fill(ctx, "#f4ecd4");
    for (const [dx, dy, s, c] of [[-0.35, -0.35, 0.22, "#7aa34a"], [0.3, 0.1, 0.18, "#c58a4a"], [-0.15, 0.45, 0.16, "#7aa34a"], [0.35, -0.5, 0.12, "#c58a4a"]]) {
      ellipse(ctx, dx * rx, dy * ry, s * rx * 1.3, s * ry);
      fill(ctx, c);
    }
    ellipse(ctx, -rx * 0.35, -ry * 0.4, rx * 0.22, ry * 0.18);
    fill(ctx, "rgba(255, 255, 255, 0.8)");
    ellipse(ctx, 0, 0, rx, ry);
    stroke(ctx, "#b8a77e", 0.8);
  });
}

// A dinosaur's head facing +x from 0, 0: `w` long, `h` wide, with eyes.
function head(ctx, w, h, color, eye = "#ffd23a") {
  ellipse(ctx, w * 0.5, 0, w * 0.55, h * 0.5);
  fill(ctx, color);
  for (const side of [-1, 1]) {
    circle(ctx, w * 0.35, side * h * 0.32, Math.max(0.9, h * 0.13));
    fill(ctx, eye);
    circle(ctx, w * 0.38, side * h * 0.32, Math.max(0.45, h * 0.06));
    fill(ctx, "#111111");
  }
}

// Two legs either side of a body, stepping in turn with the clock.
function legs(ctx, at, side, color, clock, speed, size) {
  const step = Math.sin(t(clock) * speed);
  for (const [dx, k] of at) {
    for (const s of [-1, 1]) {
      ellipse(ctx, dx + step * k * s * size * 0.5, s * side, size, size * 0.6);
      fill(ctx, color);
    }
  }
}

export default {
  palette: {
    rough: "#1f4a26",
    roughMark: "#2c6233",
    foam: "rgba(14, 34, 12, 0.6)",
    shore: "#7a5a33",
    turf: "#5aa548",
    stripe: "#529a42",
    dirt: "#b38b5a",
    dirtLine: "#98744a",
    rock: "#857569",
    rockLine: "#6b5d53",
    sand: "#e8d39e",
    speckle: "#b9995c",
    ice: "#3a3450",
    iceLine: "#b9a8ff",
    wall: "#5b3a1d",
    wallTop: "#a27a48",
    slope: "#8c6a3f",
    arrow: "rgba(255, 240, 205, 0.7)",
    bridge: "#eadfc4",
    plank: "#bfae8a",
    spinner: "#efe4c8",
    hub: "#e8a33a",
    portalA: "#f0a83c",
    portalB: "#8fd46a",
    cup: "#1a120a",
    flag: "#e8562a",
    flagMark: "#fff1c4",
    pad: "#ffd35a",
    spy: "#ffd35a",
    banner: "#f3e7c6",
    bannerLine: "#5f8a2c",
    bannerInk: "#3b2a12",
    bannerRound: 10,
    thickWalls: true,
    dark: 0,
  },

  // Murky green swamp water, and black tar that bubbles slowly.
  liquids: {
    swamp: { fill: "#2e6a64", ripple: "#8fd6c0", glow: null },
    tar: { fill: "#1d1714", ripple: "#4b3d33", glow: null, bubbles: "#6a5646" },
  },

  grounds: {
    // Mown jungle turf, with tufts and the odd yellow flower.
    jungle(ctx, p, course) {
      ctx.fillStyle = p.turf;
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.fillStyle = p.stripe;
      for (let x = 0; x < course.w; x += 40) ctx.fillRect(x, 0, 20, course.h);
      ctx.strokeStyle = "#4a8f3b";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 13, 7)) {
        ctx.moveTo(q.x - 2, q.y - 3);
        ctx.lineTo(q.x, q.y);
        ctx.lineTo(q.x + 2, q.y - 3);
      }
      ctx.stroke();
      ctx.fillStyle = "#e9d45a";
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 47, 21)) ctx.fillRect(q.x, q.y, 1.6, 1.6);
    },
    // Packed earth with pebbles and cracks.
    dirt(ctx, p, course) {
      ctx.fillStyle = p.dirt;
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.strokeStyle = p.dirtLine;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 34, 13)) {
        ctx.moveTo(q.x - 6, q.y);
        ctx.lineTo(q.x, q.y + 2);
        ctx.lineTo(q.x + 3, q.y - 3);
        ctx.lineTo(q.x + 8, q.y - 2);
      }
      ctx.stroke();
      let i = 0;
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 11, 5)) {
        ellipse(ctx, q.x, q.y, 1.4, 1);
        fill(ctx, i++ % 2 ? "#c9a271" : "#8e6b43");
      }
    },
    // Basalt: the tops of old lava columns, six-sided.
    rock(ctx, p, course) {
      ctx.fillStyle = p.rock;
      ctx.fillRect(0, 0, course.w, course.h);
      ctx.strokeStyle = p.rockLine;
      ctx.lineWidth = 1.1;
      const r = 13;
      const dx = r * Math.sqrt(3);
      ctx.beginPath();
      for (let y = 0, row = 0; y < course.h + r; y += r * 1.5, row++) {
        for (let x = (row % 2) * (dx / 2); x < course.w + dx; x += dx) {
          for (let k = 0; k < 6; k++) {
            const a = (k / 6) * TAU + Math.PI / 6;
            const px = x + Math.cos(a) * r;
            const py = y + Math.sin(a) * r;
            if (k === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
        }
      }
      ctx.stroke();
      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 9, 3)) ctx.fillRect(q.x, q.y, 1.2, 1.2);
    },
  },

  // The jungle beyond the green: leaves on leaves.
  rough(ctx, p, course) {
    let i = 0;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 15, 9)) {
      ellipse(ctx, q.x, q.y, 6, 2.6, (i * 1.7) % Math.PI);
      fill(ctx, i % 3 ? p.roughMark : "#37703b");
      i++;
    }
  },

  // A hollow log's open end, banded amber or green so each pair reads as one.
  tunnel(ctx, p, m, k, i, clock, r) {
    shadow(ctx, p, m.x, m.y, r + 4, r + 4);
    circle(ctx, m.x, m.y, r + 4);
    fill(ctx, "#6b4422");
    circle(ctx, m.x, m.y, r + 4);
    stroke(ctx, i % 2 ? p.portalB : p.portalA, 2);
    circle(ctx, m.x, m.y, r + 1.2);
    stroke(ctx, "#c79a5a", 2.4);
    circle(ctx, m.x, m.y, r);
    fill(ctx, "#1a100a");
    // A tuft of moss on top, and a beetle wandering round the rim.
    ellipse(ctx, m.x - 3, m.y - r - 3, 5, 2.4);
    fill(ctx, "#5aa548");
    const a = t(clock) * 0.8 + k * Math.PI + i;
    circle(ctx, m.x + Math.cos(a) * (r + 2.5), m.y + Math.sin(a) * (r + 2.5), 1.2);
    fill(ctx, "#2a5fa8");
  },

  bumpers: {
    // A speckled dino egg that wobbles now and then.
    egg(ctx, p, b, clock) {
      const wob = Math.sin(t(clock) * 9 + b.x) * 0.15 * Math.max(0, Math.sin(t(clock) * 0.9 + b.y));
      shadow(ctx, p, b.x, b.y, b.r * 0.85, b.r);
      egg(ctx, b.x, b.y, b.r * 0.82, b.r, wob);
    },
    // A twig nest with three eggs in it.
    nest(ctx, p, b, clock) {
      const { x, y, r } = b;
      shadow(ctx, p, x, y, r, r);
      circle(ctx, x, y, r * 0.8);
      fill(ctx, "#5a3d20");
      circle(ctx, x, y, r * 0.8);
      stroke(ctx, "#a07a44", r * 0.4);
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        ctx.moveTo(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
        ctx.lineTo(x + Math.cos(a + 0.6) * r * 1.02, y + Math.sin(a + 0.6) * r * 1.02);
      }
      stroke(ctx, "#6e4c26", 0.9);
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.4;
        const wob = k === 1 ? Math.sin(t(clock) * 10) * 0.2 * (Math.sin(t(clock) * 0.7) > 0.6 ? 1 : 0) : 0;
        egg(ctx, x + Math.cos(a) * r * 0.32, y + Math.sin(a) * r * 0.32, r * 0.24, r * 0.32, a + wob);
      }
    },
    // A mossy boulder.
    boulder(ctx, p, b) {
      const { x, y, r } = b;
      shadow(ctx, p, x, y, r, r);
      circle(ctx, x, y, r);
      fill(ctx, "#6d635c");
      circle(ctx, x - r * 0.15, y - r * 0.15, r * 0.7);
      fill(ctx, "#8b8076");
      circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.25);
      fill(ctx, "#ada296");
      ellipse(ctx, x + r * 0.3, y + r * 0.45, r * 0.45, r * 0.25);
      fill(ctx, "#5aa548");
    },
    // A big horned skull, staring.
    skull(ctx, p, b, clock) {
      const { x, y, r } = b;
      shadow(ctx, p, x, y, r * 1.1, r * 0.85);
      ellipse(ctx, x - r * 0.15, y, r * 0.8, r * 0.75);
      fill(ctx, "#efe4c8");
      ellipse(ctx, x + r * 0.55, y, r * 0.55, r * 0.42);
      fill(ctx, "#efe4c8");
      for (const s of [-1, 1]) {
        ellipse(ctx, x - r * 0.05, y + s * r * 0.35, r * 0.22, r * 0.18);
        fill(ctx, "#3a2a1a");
        polygon(ctx, [{ x: x - r * 0.55, y: y + s * r * 0.5 }, { x: x - r * 1.15, y: y + s * r * 0.95 }, { x: x - r * 0.35, y: y + s * r * 0.7 }]);
        fill(ctx, "#d9c9a0");
      }
      // Eyes that glow now and then.
      const glint = Math.sin(t(clock) * 1.3 + x) > 0.85;
      if (glint) {
        for (const s of [-1, 1]) {
          circle(ctx, x - r * 0.05, y + s * r * 0.35, r * 0.08);
          fill(ctx, "#ffd23a");
        }
      }
      ctx.beginPath();
      for (let k = -2; k <= 2; k++) {
        ctx.moveTo(x + r * 0.95, y + k * r * 0.12);
        ctx.lineTo(x + r * 1.08, y + k * r * 0.12);
      }
      stroke(ctx, "#b8a77e", 1);
    },
    // A lump of amber with a mosquito stuck inside, glinting.
    amber(ctx, p, b, clock) {
      const { x, y, r } = b;
      shadow(ctx, p, x, y, r, r);
      const pts = [];
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + 0.3;
        const rr = r * (k % 2 ? 0.92 : 1);
        pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
      }
      polygon(ctx, pts);
      fill(ctx, "#e48a16");
      circle(ctx, x - r * 0.1, y - r * 0.1, r * 0.7);
      fill(ctx, "#f7b33c");
      // The mosquito: a body, two wings and legs.
      turned(ctx, x, y + r * 0.05, 0.5, () => {
        line(ctx, -r * 0.3, 0, r * 0.3, 0, "#4a2a0c", 1.3);
        ellipse(ctx, -r * 0.05, -r * 0.18, r * 0.2, r * 0.09, -0.5);
        fill(ctx, "rgba(90, 50, 10, 0.5)");
        ellipse(ctx, -r * 0.05, r * 0.18, r * 0.2, r * 0.09, 0.5);
        fill(ctx, "rgba(90, 50, 10, 0.5)");
      });
      const shine = 0.5 + 0.5 * Math.sin(t(clock) * 2.5 + x);
      circle(ctx, x - r * 0.4, y - r * 0.4, r * 0.14 + shine * r * 0.08);
      fill(ctx, "#fff3c4");
      polygon(ctx, pts);
      stroke(ctx, "#9a5a0a", 1.1);
    },
  },

  movers: {
    // A T-rex seen from above, stomping the way it walks, jaws snapping.
    trex(ctx, p, m, clock) {
      const { x, y, r } = m;
      const a = Math.abs(m.vx) + Math.abs(m.vy) > 1 ? Math.atan2(m.vy, m.vx) : Math.PI / 2;
      shadow(ctx, p, x, y, r * 1.3, r * 1.1);
      turned(ctx, x, y, a, () => {
        legs(ctx, [[-r * 0.15, 1]], r * 0.62, "#3f7a2c", clock, 7, r * 0.32);
        polygon(ctx, [{ x: -r * 0.5, y: -r * 0.38 }, { x: -r * 1.9, y: Math.sin(t(clock) * 4) * r * 0.25 }, { x: -r * 0.5, y: r * 0.38 }]);
        fill(ctx, "#4f8a35");
        ellipse(ctx, 0, 0, r * 0.85, r * 0.6);
        fill(ctx, "#5d9e3e");
        for (const dx of [-0.45, -0.15, 0.15]) line(ctx, dx * r, -r * 0.45, dx * r + r * 0.08, r * 0.45, "#477e30", 1.2);
        // Tiny arms.
        for (const s of [-1, 1]) line(ctx, r * 0.55, s * r * 0.35, r * 0.85, s * r * 0.42, "#3f7a2c", 1.6);
        turned(ctx, r * 0.6, 0, 0, () => {
          head(ctx, r * 1.05, r * 0.8, "#68ad46");
          // Snapping jaws: a row of teeth that opens and shuts.
          const snap = Math.abs(Math.sin(t(clock) * 5)) * r * 0.12;
          for (const s of [-1, 1]) {
            ctx.beginPath();
            for (let k = 0; k < 4; k++) {
              const tx = r * (0.65 + k * 0.1);
              ctx.moveTo(tx, s * (r * 0.3 + snap));
              ctx.lineTo(tx + r * 0.05, s * (r * 0.18 + snap));
              ctx.lineTo(tx + r * 0.1, s * (r * 0.3 + snap));
            }
            fill(ctx, "#ffffff");
          }
        });
      });
      // A puff of dust and a STOMP with each step.
      const k = (t(clock) * 7) / Math.PI % 1;
      if (k < 0.3) {
        circle(ctx, x - Math.cos(a) * r * 0.3, y - Math.sin(a) * r * 0.3 + r, r * 0.25 + k * r);
        fill(ctx, `rgba(200, 170, 120, ${0.5 - k})`);
      }
      if (Math.floor(t(clock) / 1.6) % 3 === 0 && k < 0.5) label(ctx, "STOMP!", x, y - r * 1.6, 7, "#fff1c4");
    },
    // A striped raptor, quick on its feet.
    raptor(ctx, p, m, clock) {
      const { x, y, r } = m;
      const a = Math.abs(m.vx) + Math.abs(m.vy) > 1 ? Math.atan2(m.vy, m.vx) : Math.PI / 2;
      shadow(ctx, p, x, y, r * 1.2, r);
      turned(ctx, x, y, a, () => {
        legs(ctx, [[-r * 0.1, 1]], r * 0.55, "#8a4a1c", clock, 16, r * 0.3);
        ctx.lineCap = "round";
        line(ctx, -r * 0.5, 0, -r * 1.9, Math.sin(t(clock) * 8) * r * 0.3, "#b8682a", r * 0.32);
        ellipse(ctx, 0, 0, r * 0.75, r * 0.45);
        fill(ctx, "#c9772f");
        for (const dx of [-0.35, 0, 0.35]) line(ctx, dx * r, -r * 0.4, dx * r + r * 0.1, r * 0.4, "#8a4a1c", 1.2);
        turned(ctx, r * 0.6, 0, 0, () => head(ctx, r * 0.95, r * 0.55, "#d68a3e"));
      });
    },
    // A triceratops with its frill up and three horns forward.
    trike(ctx, p, m, clock) {
      const { x, y, r } = m;
      const a = Math.abs(m.vx) + Math.abs(m.vy) > 1 ? Math.atan2(m.vy, m.vx) : Math.PI / 2;
      shadow(ctx, p, x, y, r * 1.3, r * 1.1);
      turned(ctx, x, y, a, () => {
        legs(ctx, [[-r * 0.45, 1], [r * 0.3, -1]], r * 0.7, "#4f6a74", clock, 6, r * 0.28);
        polygon(ctx, [{ x: -r * 0.6, y: -r * 0.3 }, { x: -r * 1.4, y: 0 }, { x: -r * 0.6, y: r * 0.3 }]);
        fill(ctx, "#5f7f8a");
        ellipse(ctx, -r * 0.1, 0, r * 0.85, r * 0.7);
        fill(ctx, "#6f909b");
        // The frill: a half disc with spots round its edge.
        ctx.beginPath();
        ctx.arc(r * 0.6, 0, r * 0.75, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
        fill(ctx, "#d06a3a");
        for (let k = 0; k < 5; k++) {
          const fa = Math.PI / 2 + ((k + 0.5) / 5) * Math.PI;
          circle(ctx, r * 0.6 + Math.cos(fa) * r * 0.6, Math.sin(fa) * r * 0.6, r * 0.09);
          fill(ctx, "#ffd59a");
        }
        turned(ctx, r * 0.55, 0, 0, () => head(ctx, r * 0.8, r * 0.6, "#7fa0aa"));
        ctx.lineCap = "round";
        for (const s of [-1, 1]) line(ctx, r * 0.85, s * r * 0.18, r * 1.45, s * r * 0.3, "#f6efd8", 1.6);
        line(ctx, r * 1.25, 0, r * 1.5, 0, "#f6efd8", 1.4);
      });
    },
  },

  spinners: {
    // A whole stegosaurus spinning on the spot: head one end, spiked tail
    // the other, plates along its back.
    stego(ctx, p, s, clock) {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const arm = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
      ctx.lineCap = "round";
      line(ctx, s.x1 + 1.5, s.y1 + 2.5, s.x2 + 1.5, s.y2 + 2.5, p.shadow, 9);
      turned(ctx, s.x, s.y, angle, () => {
        for (const dx of [-0.3, 0.3]) {
          for (const side of [-1, 1]) {
            ellipse(ctx, dx * arm, side * arm * 0.24, arm * 0.07, arm * 0.06);
            fill(ctx, "#7d7434");
          }
        }
        // Tail tapering to its spikes.
        polygon(ctx, [{ x: -arm * 0.4, y: -arm * 0.13 }, { x: -arm, y: 0 }, { x: -arm * 0.4, y: arm * 0.13 }]);
        fill(ctx, "#9a9040");
        for (const [u, side] of [[0.82, 1], [0.82, -1], [0.95, 1], [0.95, -1]]) {
          polygon(ctx, [{ x: -arm * u - 2, y: 0 }, { x: -arm * u, y: side * 8 }, { x: -arm * u + 2, y: 0 }]);
          fill(ctx, "#f2e6c4");
        }
        ellipse(ctx, 0, 0, arm * 0.5, arm * 0.2);
        fill(ctx, "#b0a24a");
        // The plates, warm and glowing a little with the clock.
        const warm = 0.5 + 0.5 * Math.sin(t(clock) * 3);
        for (let k = -3; k <= 3; k++) {
          const px = k * arm * 0.12;
          const side = k % 2 ? 1 : -1;
          polygon(ctx, [{ x: px - 3.5, y: 0 }, { x: px, y: side * (5 + (3 - Math.abs(k))) }, { x: px + 3.5, y: 0 }]);
          fill(ctx, warm > 0.7 ? "#f08a44" : "#e07a3a");
        }
        line(ctx, 0, 0, arm * 0.62, 0, "#b0a24a", 6);
        turned(ctx, arm * 0.62, 0, 0, () => head(ctx, arm * 0.36, 7, "#bcae55", "#ffffff"));
      });
    },
    // A pterodactyl, wings out along the bar, flapping as it turns.
    ptero(ctx, p, s, clock) {
      const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
      const arm = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
      const flap = Math.sin(t(clock) * 10) * 3;
      ctx.lineCap = "round";
      line(ctx, s.x1 + 2, s.y1 + 3, s.x2 + 2, s.y2 + 3, p.shadow, 6);
      turned(ctx, s.x, s.y, angle, () => {
        for (const dir of [-1, 1]) {
          polygon(ctx, [{ x: 0, y: -2 }, { x: dir * arm, y: 0 }, { x: dir * arm * 0.55, y: 7 + flap }, { x: dir * arm * 0.2, y: 9 + flap }, { x: 0, y: 6 }]);
          fill(ctx, "#d98a5a");
          line(ctx, 0, -1, dir * arm, 0, "#7a3a24", 2.2);
          line(ctx, dir * arm * 0.5, 0, dir * arm * 0.55, 7 + flap, "rgba(122, 58, 36, 0.6)", 0.8);
        }
        ellipse(ctx, 0, 3, 3.5, 6);
        fill(ctx, "#b5533a");
        // The head, beak and crest point ahead of the wings.
        ellipse(ctx, 0, -4, 3.2, 3.2);
        fill(ctx, "#c8613f");
        polygon(ctx, [{ x: -1.6, y: -6 }, { x: 0, y: -14 }, { x: 1.6, y: -6 }]);
        fill(ctx, "#f2c84b");
        polygon(ctx, [{ x: -1, y: -3 }, { x: 0, y: 4 }, { x: 1, y: -3 }]);
        fill(ctx, "#8a2e1e");
        circle(ctx, -1.6, -5, 0.8);
        fill(ctx, "#111111");
        circle(ctx, 1.6, -5, 0.8);
        fill(ctx, "#111111");
      });
    },
    // A plain big bone.
    default(ctx, p, s) {
      ctx.lineCap = "round";
      line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, p.shadow, 6);
      line(ctx, s.x1, s.y1, s.x2, s.y2, p.spinner, 5);
      for (const [ex, ey] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        circle(ctx, ex, ey, 3.5);
        fill(ctx, p.spinner);
      }
      circle(ctx, s.x, s.y, 4);
      fill(ctx, p.hub);
    },
  },

  gates: {
    // A brachiosaurus's long neck: lowered across the way while shut, raised
    // with only its shadow on the ground while open. Its body stands beyond
    // the gate's first end.
    neck(ctx, p, g, clock) {
      const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      const ux = (g.x2 - g.x1) / len;
      const uy = (g.y2 - g.y1) / len;
      const soon = !g.shut && g.phase > g.open - 0.15;
      const bx = g.x1 - ux * 16;
      const by = g.y1 - uy * 16;
      shadow(ctx, p, bx, by, 15, 11);
      ellipse(ctx, bx, by, 15, 11, Math.atan2(uy, ux));
      fill(ctx, "#6f9a52");
      for (let k = -1; k <= 1; k++) {
        circle(ctx, bx - uy * k * 6, by + ux * k * 6, 1.6);
        fill(ctx, "#5a8442");
      }
      if (g.shut) {
        ctx.lineCap = "round";
        line(ctx, g.x1 + 1.5, g.y1 + 2.5, g.x2 + 1.5, g.y2 + 2.5, p.shadow, 8);
        line(ctx, g.x1, g.y1, g.x2, g.y2, "#6f9a52", 7);
        line(ctx, g.x1 - uy, g.y1 + ux, g.x2 - uy, g.y2 + ux, "#8fbc6a", 2);
        for (let u = 0.15; u < 0.9; u += 0.15) {
          circle(ctx, g.x1 + ux * len * u + uy * 1.5, g.y1 + uy * len * u - ux * 1.5, 1.1);
          fill(ctx, "#5a8442");
        }
        turned(ctx, g.x2, g.y2, Math.atan2(uy, ux), () => {
          head(ctx, 13, 9, "#7fae5e", "#ffffff");
          // Munching a leaf.
          const chew = Math.sin(t(clock) * 12) * 1.2;
          ellipse(ctx, 14 + chew, 1, 4, 2, 0.4);
          fill(ctx, "#3f9a3a");
        });
      } else {
        // Up in the trees: only the neck's shadow, darker as it comes down.
        ctx.save();
        ctx.setLineDash([5, 4]);
        line(ctx, g.x1, g.y1, g.x2, g.y2, soon ? "rgba(40, 20, 0, 0.45)" : "rgba(0, 0, 0, 0.16)", soon ? 5 : 4);
        ctx.restore();
        const lift = soon ? 6 : 0;
        turned(ctx, g.x1 + ux * (10 + lift), g.y1 + uy * (10 + lift), Math.atan2(uy, ux), () => head(ctx, 11, 8, "#7fae5e", "#ffffff"));
      }
    },
    // A volcanic vent: a wall of flame while shut, glowing holes while open.
    fire(ctx, p, g, clock) {
      const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
      const angle = Math.atan2(g.y2 - g.y1, g.x2 - g.x1);
      const soon = !g.shut && g.phase > g.open - 0.15;
      turned(ctx, (g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2, angle, () => {
        if (g.shut) {
          for (const [color, h] of [["#e84a1a", 9], ["#ffa23a", 6], ["#ffe48a", 3]]) {
            ctx.beginPath();
            ctx.moveTo(-len / 2, 2);
            for (let x = -len / 2; x <= len / 2; x += 5) {
              const f = Math.sin(x * 0.7 + t(clock) * 18) * 0.5 + 0.5;
              ctx.lineTo(x, -h * (0.6 + f * 0.6));
            }
            ctx.lineTo(len / 2, 2);
            ctx.closePath();
            fill(ctx, color);
          }
        } else {
          for (let x = -len / 2 + 5; x < len / 2; x += 10) {
            circle(ctx, x, 0, 2.4);
            fill(ctx, soon ? "#ff6a2a" : "#3a2620");
            if (soon) {
              circle(ctx, x + Math.sin(t(clock) * 20 + x) * 1.5, -4 - ((t(clock) * 30 + x) % 6), 0.9);
              fill(ctx, "#ffd84a");
            }
          }
        }
      });
    },
  },

  wells: {
    // A geyser that pushes away: a steaming pool that spouts every few
    // seconds, rings rolling outward.
    geyser(ctx, p, w, clock) {
      const s = t(clock);
      ctx.save();
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        const k = (((i / 3 + s * 0.4) % 1) + 1) % 1;
        ctx.globalAlpha = 0.5 * (1 - k);
        circle(ctx, w.x, w.y, 6 + k * (w.r - 6));
        stroke(ctx, "#e6f6ff", 1.2);
      }
      ctx.restore();
      circle(ctx, w.x, w.y, 9);
      fill(ctx, "#8a7a62");
      circle(ctx, w.x, w.y, 6.5);
      fill(ctx, "#3f8a9a");
      circle(ctx, w.x, w.y, 6.5);
      stroke(ctx, "#bfeaf2", 1);
      const k = (s / 3 + w.x / 97) % 1;
      if (k < 0.3) {
        // The spout: a burst of spray from the middle.
        const u = k / 0.3;
        for (let j = 0; j < 7; j++) {
          const a = (j / 7) * TAU + s;
          circle(ctx, w.x + Math.cos(a) * u * 12, w.y + Math.sin(a) * u * 12 - u * 6, 3.2 * (1 - u) + 1);
          fill(ctx, `rgba(230, 248, 255, ${0.85 - u * 0.6})`);
        }
        circle(ctx, w.x, w.y - u * 8, 5 * (1 - u * 0.5));
        fill(ctx, "rgba(255, 255, 255, 0.85)");
      } else {
        circle(ctx, w.x + Math.sin(s * 2) * 2, w.y - 6 - ((s * 8) % 8), 2.5);
        fill(ctx, "rgba(240, 240, 240, 0.45)");
      }
    },
    // A tar pit's slow swirl, dragging everything toward the middle.
    tarpit(ctx, p, w, clock) {
      const s = t(clock);
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const k = (((i / 3 - s * 0.3) % 1) + 1) % 1;
        ctx.globalAlpha = 0.5 * (1 - k * 0.6);
        circle(ctx, w.x, w.y, 16 + k * (w.r - 16));
        stroke(ctx, "#3b2b20", 1.3);
      }
      ctx.globalAlpha = 0.55;
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * TAU + s * 0.8;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r * 0.7, a, a + 0.6);
        stroke(ctx, "#2a1d15", 2);
      }
      ctx.restore();
    },
    // A meteor crater: a scorched rim and hot rings sliding down to the cup.
    crater(ctx, p, w, clock) {
      const s = t(clock);
      circle(ctx, w.x, w.y, w.r);
      stroke(ctx, "#2a2230", 4);
      circle(ctx, w.x, w.y, w.r + 2.5);
      stroke(ctx, "#8a6a52", 1.5);
      ctx.save();
      for (let i = 0; i < 4; i++) {
        const k = (((i / 4 - s * 0.35) % 1) + 1) % 1;
        ctx.globalAlpha = 0.6 * k;
        circle(ctx, w.x, w.y, 8 + k * (w.r - 10));
        stroke(ctx, "#ff8a3a", 1.2);
      }
      ctx.restore();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * TAU + 0.3;
        const glow = 0.5 + 0.5 * Math.sin(s * 3 + j * 2);
        circle(ctx, w.x + Math.cos(a) * (w.r - 1), w.y + Math.sin(a) * (w.r - 1), 1.3 + glow);
        fill(ctx, glow > 0.6 ? "#ffb04a" : "#c4542a");
      }
    },
  },

  decor: {
    // A fern, fronds swaying.
    fern: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const sway = Math.sin(t(clock) * 1.4 + d.x) * 0.08;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + sway + 0.3;
          const ex = d.x + Math.cos(a) * 15 * s;
          const ey = d.y + Math.sin(a) * 11 * s;
          ctx.beginPath();
          ctx.moveTo(d.x, d.y);
          ctx.quadraticCurveTo(d.x + Math.cos(a + 0.4) * 9 * s, d.y + Math.sin(a + 0.4) * 7 * s, ex, ey);
          for (let k = 1; k <= 4; k++) {
            const u = k / 5;
            const px = d.x + (ex - d.x) * u;
            const py = d.y + (ey - d.y) * u;
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a + 1.2) * 4 * s * (1 - u * 0.5), py + Math.sin(a + 1.2) * 4 * s * (1 - u * 0.5));
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a - 1.2) * 4 * s * (1 - u * 0.5), py + Math.sin(a - 1.2) * 4 * s * (1 - u * 0.5));
          }
          stroke(ctx, i % 2 ? "#3f9a3a" : "#2f7f2e", 1.6 * s);
        }
        circle(ctx, d.x, d.y, 2 * s);
        fill(ctx, "#5a3d20");
      },
    },
    // A palm cycad: a stubby trunk and stiff spiky fronds.
    cycad: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const sway = Math.sin(t(clock) * 1.1 + d.y) * 0.06;
        ellipse(ctx, d.x + 2, d.y + 3, 9 * s, 6 * s);
        fill(ctx, p.shadow);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * TAU + sway;
          turned(ctx, d.x, d.y, a, () => {
            polygon(ctx, [{ x: 0, y: -2.2 * s }, { x: 20 * s, y: 0 }, { x: 0, y: 2.2 * s }]);
            fill(ctx, i % 2 ? "#2e8a3c" : "#3aa047");
            line(ctx, 2 * s, 0, 18 * s, 0, "#7cc46a", 0.6 * s);
          });
        }
        circle(ctx, d.x, d.y, 4.5 * s);
        fill(ctx, "#7a5530");
        circle(ctx, d.x, d.y, 2.2 * s);
        fill(ctx, "#e0a030");
      },
    },
    // A smoking volcano, lava glowing in its crater and running down its sides.
    volcano: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const top = y - 34 * s;
        ellipse(ctx, x + 3, y + 4, 46 * s, 10 * s);
        fill(ctx, p.shadow);
        polygon(ctx, [{ x: x - 44 * s, y: y + 4 * s }, { x: x - 12 * s, y: top }, { x: x + 12 * s, y: top }, { x: x + 44 * s, y: y + 4 * s }]);
        fill(ctx, "#6b4a35");
        polygon(ctx, [{ x: x + 2 * s, y: top }, { x: x + 12 * s, y: top }, { x: x + 44 * s, y: y + 4 * s }, { x: x + 10 * s, y: y + 4 * s }]);
        fill(ctx, "#56392a");
        // Lava runs, pulsing.
        const pulse = 0.5 + 0.5 * Math.sin(t(clock) * 2);
        ctx.lineCap = "round";
        for (const [dx, ex, ey] of [[-6, -18, 0], [4, 10, -8], [0, 26, 2]]) line(ctx, x + dx * s, top + 2 * s, x + ex * s, y + ey * s, pulse > 0.5 ? "#ff8a2a" : "#e8561a", 2.4 * s);
        ellipse(ctx, x, top, 12 * s, 4 * s);
        fill(ctx, "#3a2418");
        ellipse(ctx, x, top + 0.5 * s, 9 * s, 2.6 * s);
        fill(ctx, pulse > 0.5 ? "#ffb03a" : "#ff7a1a");
        // Smoke puffs rising and fading.
        for (let i = 0; i < 4; i++) {
          const k = (t(clock) * 0.35 + i / 4) % 1;
          circle(ctx, x + Math.sin(k * 5 + i) * 6 * s + k * 10 * s, top - 4 * s - k * 30 * s, (4 + k * 9) * s);
          fill(ctx, `rgba(90, 84, 80, ${0.6 * (1 - k)})`);
        }
      },
    },
    // A ribcage and spine, half dug up. A negative s faces it the other way.
    ribs: {
      layer: "low",
      draw(ctx, p, d) {
        const s = Math.abs(d.s);
        const dir = d.s < 0 ? -1 : 1;
        ctx.lineCap = "round";
        line(ctx, d.x - 20 * s * dir, d.y, d.x + 22 * s * dir, d.y, "#e6dbbd", 2.2 * s);
        for (let k = -2; k <= 2; k++) {
          const bx = d.x + k * 7 * s * dir;
          const span = (11 - Math.abs(k) * 2) * s;
          for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(bx, d.y);
            ctx.quadraticCurveTo(bx + 5 * s * dir, d.y + side * span * 0.7, bx + 1 * s * dir, d.y + side * span);
            stroke(ctx, "#e6dbbd", 1.6 * s);
          }
        }
        circle(ctx, d.x + 26 * s * dir, d.y, 4 * s);
        fill(ctx, "#e6dbbd");
        circle(ctx, d.x + 27 * s * dir, d.y - 1 * s, 1.2 * s);
        fill(ctx, "#5a4630");
      },
    },
    // A nest of eggs; every so often one hatches a peeking baby.
    nest: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        ellipse(ctx, d.x, d.y, 15 * s, 10 * s);
        fill(ctx, "#a07a44");
        ellipse(ctx, d.x, d.y, 11 * s, 7 * s);
        fill(ctx, "#6b4a28");
        const k = (t(clock) / 7 + d.x / 50) % 1;
        egg(ctx, d.x - 5 * s, d.y, 3.5 * s, 4.5 * s, -0.2);
        egg(ctx, d.x + 5 * s, d.y + 1 * s, 3.5 * s, 4.5 * s, 0.25);
        if (k > 0.7) {
          // Hatched: a baby head with a bit of shell on top.
          circle(ctx, d.x, d.y - 3 * s, 3.8 * s);
          fill(ctx, "#7cc46a");
          circle(ctx, d.x - 1.2 * s, d.y - 4 * s, 0.9 * s);
          fill(ctx, "#111111");
          polygon(ctx, [{ x: d.x - 3 * s, y: d.y - 5.5 * s }, { x: d.x, y: d.y - 9 * s }, { x: d.x + 3 * s, y: d.y - 5.5 * s }]);
          fill(ctx, "#f4ecd4");
        } else {
          egg(ctx, d.x, d.y - 3 * s, 3.5 * s, 4.5 * s, Math.sin(t(clock) * 12) * 0.25 * (k > 0.5 ? 1 : 0));
        }
      },
    },
    // A brachiosaurus seen from above, its long neck swaying to a snack.
    brachio: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const sway = Math.sin(t(clock) * 0.8) * 8 * s;
        ellipse(ctx, x + 3, y + 4, 24 * s, 16 * s);
        fill(ctx, p.shadow);
        for (const [dx, dy] of [[-12, -13], [12, -13], [-12, 13], [12, 13]]) {
          ellipse(ctx, x + dx * s, y + dy * s, 5 * s, 4 * s);
          fill(ctx, "#5f8a48");
        }
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x - 18 * s, y);
        ctx.quadraticCurveTo(x - 30 * s, y + 8 * s, x - 42 * s, y + 4 * s);
        stroke(ctx, "#6f9a52", 6 * s);
        ellipse(ctx, x, y, 22 * s, 15 * s);
        fill(ctx, "#7fa65a");
        for (const [dx, dy] of [[-8, -4], [4, 5], [10, -6], [-3, 7]]) {
          circle(ctx, x + dx * s, y + dy * s, 2 * s);
          fill(ctx, "#6a924a");
        }
        ctx.beginPath();
        ctx.moveTo(x + 16 * s, y - 4 * s);
        ctx.quadraticCurveTo(x + 30 * s, y - 30 * s, x + 26 * s + sway, y - 48 * s);
        stroke(ctx, "#7fa65a", 7 * s);
        turned(ctx, x + 26 * s + sway, y - 48 * s, -Math.PI / 2 + sway * 0.03, () => head(ctx, 13 * s, 9 * s, "#8fb46a", "#ffffff"));
      },
    },
    // A pterodactyl circling overhead, its shadow on the ground below.
    ptero: {
      layer: "high",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const a = t(clock) * 0.7 + d.x;
        const x = d.x + Math.cos(a) * 22 * s;
        const y = d.y + Math.sin(a) * 12 * s;
        const flap = Math.sin(t(clock) * 7) * 4 * s;
        const dir = a + Math.PI / 2;
        turned(ctx, x + 10, y + 16, dir, () => {
          polygon(ctx, [{ x: 0, y: -16 * s }, { x: 4 * s, y: 0 }, { x: 0, y: 16 * s }, { x: -3 * s, y: 0 }]);
          fill(ctx, "rgba(0, 0, 0, 0.15)");
        });
        turned(ctx, x, y, dir, () => {
          for (const side of [-1, 1]) {
            polygon(ctx, [{ x: 2 * s, y: 0 }, { x: -2 * s + flap * 0.3, y: side * 17 * s }, { x: -6 * s, y: side * 6 * s }]);
            fill(ctx, "#c8704a");
          }
          ellipse(ctx, 0, 0, 6 * s, 2.5 * s);
          fill(ctx, "#9a4a2e");
          polygon(ctx, [{ x: 5 * s, y: -1.2 * s }, { x: 12 * s, y: 0 }, { x: 5 * s, y: 1.2 * s }]);
          fill(ctx, "#f2c84b");
          polygon(ctx, [{ x: 4 * s, y: -1 * s }, { x: -1 * s, y: 0 }, { x: 4 * s, y: 1 * s }]);
          fill(ctx, "#8a2e1e");
        });
      },
    },
    // Lily pads with a pink flower, bobbing on the swamp.
    lily: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        for (const [dx, dy, r, k] of [[0, 0, 7, 0], [11, 6, 5, 1], [-9, 7, 4.5, 2]]) {
          const bob = Math.sin(t(clock) * 1.5 + k * 2 + d.x) * 0.8;
          const cx = d.x + dx * s;
          const cy = d.y + dy * s + bob;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, r * s, 0.4 + k, TAU - 0.1 + k);
          ctx.closePath();
          fill(ctx, k ? "#4f9a3c" : "#5cae46");
        }
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU;
          ellipse(ctx, d.x + Math.cos(a) * 2.2 * s, d.y + Math.sin(a) * 2.2 * s, 2.4 * s, 1.4 * s, a);
          fill(ctx, "#f59ac0");
        }
        circle(ctx, d.x, d.y, 1.2 * s);
        fill(ctx, "#ffe27a");
      },
    },
    // A trail of three-toed footprints; a negative s walks them leftward.
    tracks: {
      layer: "low",
      draw(ctx, p, d) {
        const s = Math.abs(d.s);
        const dir = d.s < 0 ? -1 : 1;
        for (let k = 0; k < 4; k++) {
          const x = d.x + k * 18 * s * dir;
          const y = d.y + (k % 2 ? 5 : -5) * s;
          turned(ctx, x, y, dir > 0 ? 0 : Math.PI, () => {
            ellipse(ctx, -1 * s, 0, 2.6 * s, 2.2 * s);
            fill(ctx, "rgba(50, 30, 10, 0.3)");
            for (const a of [-0.55, 0, 0.55]) {
              ellipse(ctx, Math.cos(a) * 4.5 * s, Math.sin(a) * 4.5 * s, 2.6 * s, 1 * s, a);
              fill(ctx, "rgba(50, 30, 10, 0.3)");
            }
          });
        }
      },
    },
    // A giant dragonfly darting in a figure eight.
    dragonfly: {
      layer: "high",
      draw(ctx, p, d, clock) {
        const a = t(clock) * 1.3 + d.y;
        const x = d.x + Math.sin(a) * 26;
        const y = d.y + Math.sin(a * 2) * 9;
        const dir = Math.atan2(Math.cos(a * 2) * 18, Math.cos(a) * 26);
        const flick = Math.sin(t(clock) * 40) > 0 ? 1 : 0.6;
        turned(ctx, x, y, dir, () => {
          for (const [dx, side] of [[1.5, -1], [1.5, 1], [-1.5, -1], [-1.5, 1]]) {
            ellipse(ctx, dx, side * 5 * flick, 2, 5 * flick, side * 0.3);
            fill(ctx, "rgba(200, 240, 255, 0.6)");
          }
          line(ctx, -9, 0, 4, 0, "#2a8fb0", 1.8);
          circle(ctx, 4.5, 0, 1.6);
          fill(ctx, "#1a5f80");
        });
      },
    },
    // A meteor that streaks across the sky every few seconds.
    meteor: {
      layer: "high",
      draw(ctx, p, d, clock) {
        const k = (t(clock) / 7 + d.x / 400) % 1;
        if (k > 0.18) return;
        const u = k / 0.18;
        const x = d.x - 40 + u * 90;
        const y = d.y + u * 45;
        const g = radial(ctx, x, y, 0, 9, [[0, "rgba(255, 230, 150, 0.9)"], [1, "rgba(255, 120, 30, 0)"]]);
        ctx.lineCap = "round";
        line(ctx, x - 26, y - 13, x, y, "rgba(255, 150, 60, 0.55)", 3);
        line(ctx, x - 14, y - 7, x, y, "rgba(255, 230, 150, 0.8)", 1.6);
        if (g) {
          circle(ctx, x, y, 9);
          fill(ctx, g);
        }
        circle(ctx, x, y, 2.6);
        fill(ctx, "#5a3a2a");
      },
    },
    // A pile of mossy boulders.
    rocks: {
      layer: "low",
      draw(ctx, p, d) {
        const s = d.s;
        for (const [dx, dy, r] of [[-6, 2, 7], [6, 3, 6], [0, -4, 5]]) {
          circle(ctx, d.x + dx * s + 1.5, d.y + dy * s + 2, r * s);
          fill(ctx, p.shadow);
          circle(ctx, d.x + dx * s, d.y + dy * s, r * s);
          fill(ctx, "#7b706a");
          circle(ctx, d.x + (dx - 1.5) * s, d.y + (dy - 1.5) * s, r * 0.5 * s);
          fill(ctx, "#9a8f86");
        }
        ellipse(ctx, d.x - 6 * s, d.y + 6 * s, 5 * s, 2 * s);
        fill(ctx, "#4f9a3c");
      },
    },
    // A brontosaurus wading in the swamp: its back above the water, its
    // neck curling up and its head bobbing.
    bronto: {
      layer: "low",
      draw(ctx, p, d, clock) {
        const s = d.s;
        const { x, y } = d;
        const bob = Math.sin(t(clock) * 1.2) * 3;
        ctx.save();
        ctx.globalAlpha = 0.5;
        for (const r of [28, 34]) {
          ellipse(ctx, x, y + 2, r * s, r * 0.5 * s);
          stroke(ctx, "#8fd6c0", 1);
        }
        ctx.restore();
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x, y + 10 * s);
        ctx.quadraticCurveTo(x - 6 * s, y + 30 * s, x + 6 * s, y + 42 * s);
        stroke(ctx, "#6a8f86", 6 * s);
        ellipse(ctx, x, y, 20 * s, 14 * s);
        fill(ctx, "#6a8f86");
        ellipse(ctx, x - 4 * s, y - 3 * s, 12 * s, 7 * s);
        fill(ctx, "#7fa69c");
        ctx.beginPath();
        ctx.moveTo(x, y - 10 * s);
        ctx.quadraticCurveTo(x + 14 * s, y - 30 * s, x + 4 * s + bob, y - 52 * s);
        stroke(ctx, "#6a8f86", 7 * s);
        turned(ctx, x + 4 * s + bob, y - 52 * s, -Math.PI / 2 - 0.2, () => head(ctx, 13 * s, 9 * s, "#7fa69c", "#ffffff"));
        // A sleepy "z" now and then.
        if (Math.floor(t(clock) / 2) % 3 === 0) label(ctx, "z", x + 16 * s + bob, y - 62 * s - (t(clock) % 2) * 4, 7, "#e6f6ff");
      },
    },
    // A bridge's bone knobs, bulging out beside its two ends: s is half its
    // length over 44, and a negative s stands it upright.
    bone: {
      layer: "low",
      draw(ctx, p, d) {
        const half = 44 * Math.abs(d.s);
        turned(ctx, d.x, d.y, d.s < 0 ? Math.PI / 2 : 0, () => {
          for (const end of [-1, 1]) {
            for (const side of [-1, 1]) {
              circle(ctx, end * (half - 3) + 1.5, side * 13 + 2, 7);
              fill(ctx, p.shadow);
              circle(ctx, end * (half - 3), side * 13, 7);
              fill(ctx, "#efe4c8");
              circle(ctx, end * (half - 3), side * 13, 7);
              stroke(ctx, "#bfae8a", 1);
            }
          }
        });
      },
    },
    // Tiki torches round the summit, flames flickering.
    summit: {
      layer: "low",
      draw(ctx, p, d, clock) {
        for (const [dx, dy] of [[-18, -4], [18, -4], [-11, -15], [11, -15]]) {
          const x = d.x + dx;
          const y = d.y + dy;
          circle(ctx, x, y, 2.6);
          fill(ctx, "#6b4422");
          const f = 0.8 + Math.sin(t(clock) * 14 + dx + dy * 2) * 0.2;
          polygon(ctx, [{ x: x - 2.2, y: y - 1 }, { x: x, y: y - 8 * f }, { x: x + 2.2, y: y - 1 }]);
          fill(ctx, "#ff8a2a");
          polygon(ctx, [{ x: x - 1, y: y - 1.5 }, { x: x, y: y - 5 * f }, { x: x + 1, y: y - 1.5 }]);
          fill(ctx, "#ffe48a");
        }
      },
    },
  },
};

