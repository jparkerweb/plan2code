// Plan2Code Web Console - mini golf's Cosmic Glow look: the course's palette, ground, water, props and scenery.
//
// Drawing only, listed in golf-looks.js (which documents what a look holds).
// A black-light glow golf hall in deep space: a night sky of nebulas and
// stars round a dark carpet speckled with neon, hot pink walls with a cyan
// haze, and everything else glowing. Moves only with the round's clock.

import { bounds, circle, ellipse, fill, line, polygon, radial, scatter, stroke, t, turned } from "./golf-paint.js";

const PINK = "#ff3fd0";
const CYAN = "#39f3ff";
const LIME = "#b6ff3b";
const VIOLET = "#9b5cff";
const YELLOW = "#ffe14d";
const ORANGE = "#ff9a3c";
const NEON = [PINK, CYAN, LIME, VIOLET, YELLOW, ORANGE];

// A soft glow: a radial fade from `color` to nothing, r across.
function glow(ctx, x, y, r, color) {
  const g = radial(ctx, x, y, 0, r, [[0, color], [1, "rgba(0, 0, 0, 0)"]]);
  if (!g) return;
  circle(ctx, x, y, r);
  fill(ctx, g);
}

// A four-point sparkle.
function sparkle(ctx, x, y, r, color) {
  polygon(ctx, [{ x, y: y - r }, { x: x + r * 0.25, y: y - r * 0.25 }, { x: x + r, y }, { x: x + r * 0.25, y: y + r * 0.25 }, { x, y: y + r }, { x: x - r * 0.25, y: y + r * 0.25 }, { x: x - r, y }, { x: x - r * 0.25, y: y - r * 0.25 }]);
  fill(ctx, color);
}

// A five-point star, r to its tips.
function star(ctx, x, y, r, inner, turn = 0) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = turn - Math.PI / 2 + (i * Math.PI) / 5;
    const k = i % 2 ? r * inner : r;
    points.push({ x: x + Math.cos(a) * k, y: y + Math.sin(a) * k });
  }
  polygon(ctx, points);
}

// A lumpy rock: eight points pushed in and out by its seed.
function rock(ctx, x, y, r, seed, turn) {
  const points = [];
  for (let i = 0; i < 9; i++) {
    const a = turn + (i / 9) * Math.PI * 2;
    const k = r * (0.82 + 0.18 * Math.sin(seed * 1.7 + i * 2.3));
    points.push({ x: x + Math.cos(a) * k, y: y + Math.sin(a) * k });
  }
  polygon(ctx, points);
}

// A ringed planet: a banded ball with a tilted ring, back half behind it.
function ringedPlanet(ctx, x, y, r, body, band, ring) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.9, r * 0.55, -0.35, Math.PI, Math.PI * 2);
  stroke(ctx, ring, r * 0.22);
  ctx.restore();
  circle(ctx, x, y, r);
  fill(ctx, body);
  ctx.save();
  circle(ctx, x, y, r);
  ctx.clip();
  for (const k of [-0.45, 0.05, 0.5]) {
    turned(ctx, x, y, -0.35, () => {
      ctx.fillStyle = band;
      ctx.fillRect(-r, k * r - r * 0.1, r * 2, r * 0.2);
    });
  }
  circle(ctx, x + r * 0.35, y + r * 0.35, r);
  fill(ctx, "rgba(10, 4, 30, 0.35)");
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.9, r * 0.55, -0.35, 0, Math.PI);
  stroke(ctx, ring, r * 0.22);
  ctx.restore();
}

/* ---------------------------------------------------------------- props */

const bumpers = {
  // A tumbling space rock with a neon rim.
  asteroid(ctx, p, b, clock) {
    const { x, y, r } = b;
    const turn = t(clock) * 0.4 + x;
    rock(ctx, x + 1.5, y + 2, r, x + y, turn);
    fill(ctx, "rgba(0, 0, 0, 0.45)");
    rock(ctx, x, y, r, x + y, turn);
    fill(ctx, "#6d6290");
    stroke(ctx, CYAN, 1.1);
    for (const [dx, dy, k] of [[-0.3, -0.25, 0.28], [0.35, 0.2, 0.2], [-0.1, 0.45, 0.14]]) {
      const a = turn * 0.3;
      circle(ctx, x + (dx * Math.cos(a) - dy * Math.sin(a)) * r, y + (dx * Math.sin(a) + dy * Math.cos(a)) * r, r * k);
      fill(ctx, "#4a4068");
    }
  },
  // A glowing star that pulses.
  star(ctx, p, b, clock) {
    const { x, y, r } = b;
    const pulse = 0.5 + 0.5 * Math.sin(t(clock) * 4 + x);
    glow(ctx, x, y, r * 2.2, `rgba(255, 225, 77, ${0.25 + pulse * 0.2})`);
    star(ctx, x, y, r * 1.15, 0.5, t(clock) * 0.6);
    fill(ctx, YELLOW);
    star(ctx, x, y, r * 0.6, 0.5, t(clock) * 0.6);
    fill(ctx, "#fff8c8");
  },
  // A little ringed planet.
  planet(ctx, p, b) {
    ringedPlanet(ctx, b.x, b.y, b.r, "#ff7ad9", "#c43fae", CYAN);
  },
};
bumpers.default = bumpers.asteroid;

const movers = {
  // A flying saucer, its rim lights chasing round and its tractor beam on.
  ufo(ctx, p, m, clock) {
    const { x, y, r } = m;
    const g = radial(ctx, x, y + r, 0, r * 2.2, [[0, "rgba(182, 255, 59, 0.35)"], [1, "rgba(182, 255, 59, 0)"]]);
    if (g) {
      polygon(ctx, [{ x: x - r * 0.5, y }, { x: x + r * 0.5, y }, { x: x + r * 1.3, y: y + r * 2.2 }, { x: x - r * 1.3, y: y + r * 2.2 }]);
      fill(ctx, g);
    }
    ellipse(ctx, x + 1.5, y + 2.5, r * 1.5, r * 0.55);
    fill(ctx, "rgba(0, 0, 0, 0.4)");
    ellipse(ctx, x, y - r * 0.25, r * 0.6, r * 0.6);
    fill(ctx, "rgba(57, 243, 255, 0.55)");
    circle(ctx, x, y - r * 0.3, r * 0.26);
    fill(ctx, LIME);
    ellipse(ctx, x, y + r * 0.1, r * 1.5, r * 0.5);
    fill(ctx, "#b9b2d9");
    ellipse(ctx, x, y + r * 0.1, r * 1.5, r * 0.5);
    stroke(ctx, VIOLET, 1);
    for (let i = 0; i < 5; i++) {
      const lit = Math.floor(t(clock) * 8) % 5 === i;
      circle(ctx, x + (i - 2) * r * 0.55, y + r * 0.2, lit ? 1.6 : 1.1);
      fill(ctx, lit ? YELLOW : PINK);
    }
  },
  // A flaming meteor, its tail streaming out behind.
  meteor(ctx, p, m, clock) {
    const { x, y, r } = m;
    const speed = Math.hypot(m.vx || 0, m.vy || 0) || 1;
    const ux = (m.vx || 0) / speed;
    const uy = (m.vy || 0) / speed;
    const flick = 1 + Math.sin(t(clock) * 23 + x) * 0.1;
    for (let k = 4; k >= 1; k--) {
      circle(ctx, x - ux * r * k * 0.8 * flick, y - uy * r * k * 0.8 * flick, r * (1 - k * 0.17));
      fill(ctx, k > 2 ? `rgba(255, 63, 208, ${0.5 - k * 0.08})` : `rgba(255, 154, 60, ${0.75 - k * 0.15})`);
    }
    glow(ctx, x, y, r * 2, "rgba(255, 154, 60, 0.4)");
    rock(ctx, x, y, r, 3, t(clock) * 2);
    fill(ctx, "#7a4a3a");
    stroke(ctx, ORANGE, 1.2);
    circle(ctx, x - r * 0.3, y - r * 0.25, r * 0.25);
    fill(ctx, "#5a3428");
  },
};
movers.default = movers.ufo;

const spinners = {
  // A satellite: a gold body with a dish, a solar panel on each arm.
  satellite(ctx, p, s, clock) {
    const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const arm = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
    ctx.lineCap = "round";
    line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, "rgba(0, 0, 0, 0.4)", 6);
    turned(ctx, s.x, s.y, angle, () => {
      line(ctx, -arm, 0, arm, 0, "#c9c3e6", 1.6);
      for (const dir of [-1, 1]) {
        const x0 = dir > 0 ? 8 : -arm;
        const w = arm - 8;
        ctx.fillStyle = "#1d3fbf";
        ctx.fillRect(x0, -3.5, w, 7);
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(x0, -3.5, w, 7);
        for (let k = x0 + 4; k < x0 + w; k += 4) line(ctx, k, -3.5, k, 3.5, "rgba(57, 243, 255, 0.6)", 0.5);
      }
      ctx.fillStyle = "#e8b923";
      ctx.fillRect(-6, -5, 12, 10);
      ctx.strokeStyle = "#8a5f0c";
      ctx.lineWidth = 0.8;
      ctx.strokeRect(-6, -5, 12, 10);
    });
    circle(ctx, s.x, s.y, 2.6);
    fill(ctx, "#f4f1ea");
    const blink = Math.floor(t(clock) * 2) % 2;
    circle(ctx, s.x, s.y, 1.1);
    fill(ctx, blink ? "#ff4d3d" : "#7a1d16");
  },
  // A space station's truss: modules with lit windows round a ring hub.
  station(ctx, p, s, clock) {
    const angle = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    const arm = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) / 2;
    ctx.lineCap = "round";
    line(ctx, s.x1 + 1.5, s.y1 + 2, s.x2 + 1.5, s.y2 + 2, "rgba(0, 0, 0, 0.4)", 7);
    turned(ctx, s.x, s.y, angle, () => {
      ctx.fillStyle = "#d9d4f0";
      ctx.fillRect(-arm, -3.5, arm * 2, 7);
      ctx.strokeStyle = VIOLET;
      ctx.lineWidth = 1;
      ctx.strokeRect(-arm, -3.5, arm * 2, 7);
      for (let k = -arm + 4; k < arm - 2; k += 6) {
        if (Math.abs(k) < 9) continue;
        ctx.fillStyle = Math.floor(t(clock) * 1.5 + k) % 3 ? CYAN : YELLOW;
        ctx.fillRect(k, -1.2, 2.4, 2.4);
      }
    });
    circle(ctx, s.x, s.y, 9);
    fill(ctx, "#2a1d63");
    circle(ctx, s.x, s.y, 9);
    stroke(ctx, PINK, 2);
    circle(ctx, s.x, s.y, 3.5);
    fill(ctx, CYAN);
  },
};
spinners.default = spinners.satellite;

const gates = {
  // An airlock: hazard-striped doors that slide shut, a red light blinking
  // just before they do.
  airlock(ctx, p, g, clock) {
    const len = Math.hypot(g.x2 - g.x1, g.y2 - g.y1);
    const angle = Math.atan2(g.y2 - g.y1, g.x2 - g.x1);
    const soon = !g.shut && g.phase > g.open - 0.15;
    turned(ctx, (g.x1 + g.x2) / 2, (g.y1 + g.y2) / 2, angle, () => {
      if (g.shut) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        ctx.fillRect(-len / 2 + 1.5, -3, len, 9);
        ctx.fillStyle = "#c9c3e6";
        ctx.fillRect(-len / 2, -4.5, len, 9);
        ctx.save();
        ctx.beginPath();
        ctx.rect(-len / 2, -2.5, len, 5);
        ctx.clip();
        for (let x = -len / 2 - 6; x < len / 2; x += 6) {
          polygon(ctx, [{ x, y: 2.5 }, { x: x + 3, y: 2.5 }, { x: x + 6, y: -2.5 }, { x: x + 3, y: -2.5 }]);
          fill(ctx, YELLOW);
        }
        ctx.restore();
        line(ctx, 0, -4.5, 0, 4.5, "#2a1d63", 1);
      } else {
        // The doors tucked into the frame at each end, and the way open.
        const side = len * 0.08;
        ctx.fillStyle = "#c9c3e6";
        ctx.fillRect(-len / 2, -4.5, side, 9);
        ctx.fillRect(len / 2 - side, -4.5, side, 9);
        ctx.fillStyle = soon && Math.floor(clock / 120) % 2 ? "rgba(255, 77, 61, 0.9)" : "rgba(57, 243, 255, 0.45)";
        for (let x = -len / 2 + side + 2; x < len / 2 - side - 2; x += 7) ctx.fillRect(x, -1, 4, 2);
      }
      circle(ctx, -len / 2 + 2, 0, 2.2);
      fill(ctx, g.shut || soon ? "#ff4d3d" : LIME);
    });
  },
  // A pulsar shield: a crackling bar of light while on, a faint dotted line
  // while off.
  shield(ctx, p, g, clock) {
    if (g.shut) {
      const flick = 0.75 + 0.25 * Math.sin(clock / 30 + g.x1);
      line(ctx, g.x1, g.y1, g.x2, g.y2, `rgba(255, 63, 208, ${0.35 * flick})`, 9);
      line(ctx, g.x1, g.y1, g.x2, g.y2, PINK, 3.5);
      line(ctx, g.x1, g.y1, g.x2, g.y2, "#ffe0f6", 1.2);
    } else {
      const soon = g.phase > g.open - 0.12;
      ctx.save();
      ctx.setLineDash([2, 4]);
      line(ctx, g.x1, g.y1, g.x2, g.y2, soon ? "rgba(255, 63, 208, 0.8)" : "rgba(255, 63, 208, 0.3)", 1.5);
      ctx.restore();
    }
    for (const [x, y] of [[g.x1, g.y1], [g.x2, g.y2]]) {
      circle(ctx, x, y, 3);
      fill(ctx, VIOLET);
      circle(ctx, x, y, 1.4);
      fill(ctx, "#f4ecff");
    }
  },
};
gates.default = gates.airlock;

// A well's field: a flat disc a little past its reach, so its pull reads
// as a place of its own on the carpet.
function field(ctx, w, color) {
  circle(ctx, w.x, w.y, w.r + 2.5);
  fill(ctx, color);
}

const wells = {
  // A black hole: an accretion disc of hot rings spiraling in, a glowing
  // photon ring, and the void itself (its water, 11 across, in the course).
  blackhole(ctx, p, w, clock) {
    const { x, y, r } = w;
    field(ctx, w, "#170c3c");
    const g = radial(ctx, x, y, 8, r, [[0, "rgba(255, 120, 60, 0.55)"], [0.35, "rgba(200, 50, 200, 0.35)"], [0.75, "rgba(90, 40, 200, 0.18)"], [1, "rgba(40, 20, 120, 0)"]]);
    circle(ctx, x, y, r);
    fill(ctx, g || "rgba(120, 50, 200, 0.2)");
    const spin = t(clock) * 1.6;
    ctx.lineCap = "round";
    for (let i = 0; i < 5; i++) {
      const k = (((i / 5 - t(clock) * 0.3) % 1) + 1) % 1;
      const rr = 13 + k * (r - 15);
      ctx.globalAlpha = 0.85 * (1 - k);
      ctx.beginPath();
      ctx.arc(x, y, rr, spin * (1.5 - k) + i * 1.3, spin * (1.5 - k) + i * 1.3 + 2.2);
      stroke(ctx, i % 2 ? ORANGE : PINK, 1.6);
    }
    ctx.globalAlpha = 1;
    circle(ctx, x, y, r);
    ctx.save();
    ctx.setLineDash([2, 5]);
    stroke(ctx, "rgba(155, 92, 255, 0.55)", 1);
    ctx.restore();
    circle(ctx, x, y, 13);
    stroke(ctx, YELLOW, 1.5);
    circle(ctx, x, y, 11);
    fill(ctx, "#000000");
  },
  // A repulsor planet: a glowing world sending rings of force outward.
  repulsor(ctx, p, w, clock) {
    const { x, y, r } = w;
    field(ctx, w, "#13184a");
    for (let i = 0; i < 4; i++) {
      const k = (((i / 4 + t(clock) * 0.45) % 1) + 1) % 1;
      circle(ctx, x, y, 8 + k * (r - 8));
      ctx.globalAlpha = 0.75 * (1 - k);
      stroke(ctx, CYAN, 1.6);
    }
    ctx.globalAlpha = 1;
    circle(ctx, x, y, r);
    ctx.save();
    ctx.setLineDash([3, 4]);
    stroke(ctx, "rgba(57, 243, 255, 0.5)", 1);
    ctx.restore();
    // The planet at its heart, its glow throbbing with the push.
    glow(ctx, x, y, 18 + Math.sin(t(clock) * 6) * 2, "rgba(57, 243, 255, 0.6)");
    const g = radial(ctx, x - 3, y - 3, 1, 10, [[0, "#bff8ff"], [0.5, "#3f8cff"], [1, "#2a1d9c"]]);
    circle(ctx, x, y, 9);
    fill(ctx, g || "#3f8cff");
    ellipse(ctx, x + 2, y + 2, 4, 2.2, -0.4);
    fill(ctx, "rgba(182, 255, 59, 0.6)");
    circle(ctx, x, y, 9);
    stroke(ctx, CYAN, 1.5);
  },
  // A tractor beam round the cup: lime arms swirling in.
  tractor(ctx, p, w, clock) {
    const { x, y, r } = w;
    field(ctx, w, "#16173f");
    const g = radial(ctx, x, y, 6, r, [[0, "rgba(182, 255, 59, 0.3)"], [1, "rgba(182, 255, 59, 0.03)"]]);
    circle(ctx, x, y, r);
    fill(ctx, g || "rgba(182, 255, 59, 0.12)");
    const spin = -t(clock) * 1.4;
    ctx.lineCap = "round";
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const a = spin + arm * (Math.PI / 2) + u * 2.4;
        const rr = 10 + u * (r - 12);
        if (i === 0) ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
        else ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      stroke(ctx, "rgba(182, 255, 59, 0.6)", 1.5);
    }
    circle(ctx, x, y, r);
    ctx.save();
    ctx.setLineDash([2, 5]);
    stroke(ctx, "rgba(182, 255, 59, 0.6)", 1);
    ctx.restore();
  },
};
wells.default = wells.blackhole;

// A wormhole mouth: a spiral of light, cyan at one end and pink at the other.
function tunnel(ctx, p, m, k, i, clock, r) {
  const color = k ? PINK : CYAN;
  glow(ctx, m.x, m.y, r * 2, k ? "rgba(255, 63, 208, 0.35)" : "rgba(57, 243, 255, 0.35)");
  circle(ctx, m.x, m.y, r);
  fill(ctx, "#05010f");
  const spin = t(clock) * 3 * (k ? -1 : 1);
  ctx.lineCap = "round";
  for (let arm = 0; arm < 3; arm++) {
    ctx.beginPath();
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      const a = spin + arm * ((Math.PI * 2) / 3) + u * 3;
      const rr = 1 + u * (r - 1.5);
      if (s === 0) ctx.moveTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr);
      else ctx.lineTo(m.x + Math.cos(a) * rr, m.y + Math.sin(a) * rr);
    }
    stroke(ctx, color, 1.3);
  }
  circle(ctx, m.x, m.y, r);
  stroke(ctx, color, 2);
}

/* -------------------------------------------------------------- scenery */

const decor = {
  // A rocket on the launch pad, its flame flickering.
  rocket: {
    layer: "low",
    light: { r: 40, color: "rgba(255, 154, 60, 0.4)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const { x, y } = d;
      const f = Math.sin(t(clock) * 24 + x) * 2 + Math.sin(t(clock) * 15) * 1.5;
      polygon(ctx, [{ x: x - 5 * s, y: y + 10 * s }, { x: x + 5 * s, y: y + 10 * s }, { x: x + f * 0.3 * s, y: y + (24 + f) * s }]);
      fill(ctx, ORANGE);
      polygon(ctx, [{ x: x - 2.5 * s, y: y + 10 * s }, { x: x + 2.5 * s, y: y + 10 * s }, { x, y: y + (17 + f * 0.5) * s }]);
      fill(ctx, YELLOW);
      for (const dir of [-1, 1]) {
        polygon(ctx, [{ x: x + dir * 5 * s, y: y + 1 * s }, { x: x + dir * 11 * s, y: y + 11 * s }, { x: x + dir * 5 * s, y: y + 9 * s }]);
        fill(ctx, PINK);
      }
      ctx.beginPath();
      ctx.moveTo(x, y - 22 * s);
      ctx.quadraticCurveTo(x + 8 * s, y - 10 * s, x + 6 * s, y + 10 * s);
      ctx.lineTo(x - 6 * s, y + 10 * s);
      ctx.quadraticCurveTo(x - 8 * s, y - 10 * s, x, y - 22 * s);
      fill(ctx, "#ece8ff");
      circle(ctx, x, y - 6 * s, 3 * s);
      fill(ctx, CYAN);
      circle(ctx, x, y - 6 * s, 3 * s);
      stroke(ctx, VIOLET, 1.2 * s);
      ctx.beginPath();
      ctx.moveTo(x, y - 22 * s);
      ctx.quadraticCurveTo(x + 4 * s, y - 18 * s, x + 5.5 * s, y - 14 * s);
      ctx.lineTo(x - 5.5 * s, y - 14 * s);
      ctx.quadraticCurveTo(x - 4 * s, y - 18 * s, x, y - 22 * s);
      fill(ctx, PINK);
    },
  },
  // A ringed planet in the sky, a bigger one for a bigger `s`.
  planet: {
    layer: "low",
    draw(ctx, p, d) {
      const s = d.s;
      glow(ctx, d.x, d.y, 30 * s, "rgba(155, 92, 255, 0.3)");
      ringedPlanet(ctx, d.x, d.y, 14 * s, "#7a5cff", "#5a3fd0", "#ffb3ec");
    },
  },
  // A cratered moon with a soft glow.
  moon: {
    layer: "low",
    draw(ctx, p, d) {
      const s = d.s;
      glow(ctx, d.x, d.y, 30 * s, "rgba(230, 225, 255, 0.25)");
      circle(ctx, d.x, d.y, 18 * s);
      fill(ctx, "#d9d4f0");
      for (const [dx, dy, r] of [[-6, -5, 4], [6, 4, 5], [-3, 9, 3], [9, -8, 2.5], [-10, 4, 2]]) {
        circle(ctx, d.x + dx * s, d.y + dy * s, r * s);
        fill(ctx, "#b3acd6");
      }
      circle(ctx, d.x + 5 * s, d.y + 4 * s, 18 * s);
      ctx.save();
      circle(ctx, d.x, d.y, 18 * s);
      ctx.clip();
      circle(ctx, d.x + 7 * s, d.y + 6 * s, 18 * s);
      fill(ctx, "rgba(40, 20, 90, 0.35)");
      ctx.restore();
    },
  },
  // A little cluster of stars twinkling in turn.
  twinkle: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      [[0, 0, 4], [12, 7, 2.5], [-9, 10, 2], [6, -11, 2.2], [-13, -5, 1.6]].forEach(([dx, dy, r], i) => {
        const k = 0.5 + 0.5 * Math.sin(t(clock) * 2.4 + i * 1.9 + d.x);
        sparkle(ctx, d.x + dx * s, d.y + dy * s, r * s * (0.6 + k * 0.6), i % 2 ? `rgba(57, 243, 255, ${0.5 + k * 0.5})` : `rgba(255, 255, 255, ${0.5 + k * 0.5})`);
      });
    },
  },
  // A comet streaking by, its tail fanning back.
  comet: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      const drift = Math.sin(t(clock) * 0.7 + d.x) * 4 * s;
      const x = d.x + drift;
      const y = d.y - drift * 0.4;
      const tail = radial(ctx, x, y, 0, 34 * s, [[0, "rgba(57, 243, 255, 0.7)"], [1, "rgba(57, 243, 255, 0)"]]);
      polygon(ctx, [{ x, y: y - 3 * s }, { x: x - 34 * s, y: y - 14 * s }, { x: x - 30 * s, y: y + 4 * s }, { x, y: y + 3 * s }]);
      fill(ctx, tail || "rgba(57, 243, 255, 0.3)");
      glow(ctx, x, y, 9 * s, "rgba(220, 255, 255, 0.7)");
      circle(ctx, x, y, 3 * s);
      fill(ctx, "#ffffff");
    },
  },
  // A spiral galaxy, slowly turning.
  galaxy: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      glow(ctx, d.x, d.y, 26 * s, "rgba(255, 63, 208, 0.25)");
      const spin = t(clock) * 0.25;
      for (let arm = 0; arm < 2; arm++) {
        for (let i = 1; i < 14; i++) {
          const u = i / 14;
          const a = spin + arm * Math.PI + u * 4.2;
          circle(ctx, d.x + Math.cos(a) * u * 24 * s, d.y + Math.sin(a) * u * 12 * s, (2.4 - u * 1.6) * s);
          fill(ctx, i % 3 ? "rgba(255, 179, 236, 0.8)" : "rgba(57, 243, 255, 0.8)");
        }
      }
      ellipse(ctx, d.x, d.y, 5 * s, 3 * s);
      fill(ctx, "#fff3c4");
    },
  },
  // An astronaut drifting and slowly tumbling, waving.
  astronaut: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      const bob = Math.sin(t(clock) * 1.1 + d.x) * 3;
      turned(ctx, d.x, d.y + bob, Math.sin(t(clock) * 0.6 + d.y) * 0.4, () => {
        line(ctx, -5 * s, 2 * s, -11 * s, -4 * s + Math.sin(t(clock) * 5) * 2 * s, "#f4f1ea", 3.5 * s);
        line(ctx, 5 * s, 2 * s, 10 * s, 7 * s, "#f4f1ea", 3.5 * s);
        line(ctx, -3 * s, 9 * s, -5 * s, 16 * s, "#f4f1ea", 3.8 * s);
        line(ctx, 3 * s, 9 * s, 5 * s, 16 * s, "#f4f1ea", 3.8 * s);
        ctx.fillStyle = "#c9c3e6";
        ctx.fillRect(-7 * s, -2 * s, 4 * s, 10 * s);
        ellipse(ctx, 0, 4 * s, 6 * s, 7 * s);
        fill(ctx, "#f4f1ea");
        ctx.fillStyle = PINK;
        ctx.fillRect(-2 * s, 2 * s, 4 * s, 3 * s);
        circle(ctx, 0, -6 * s, 6.5 * s);
        fill(ctx, "#f4f1ea");
        ellipse(ctx, 1 * s, -6 * s, 4.5 * s, 3.6 * s);
        fill(ctx, "#2a1d63");
        circle(ctx, 2.5 * s, -7.5 * s, 1.2 * s);
        fill(ctx, CYAN);
      });
    },
  },
  // A flying saucer cruising in a figure of eight.
  ufo: {
    layer: "low",
    light: { r: 30, color: "rgba(182, 255, 59, 0.3)" },
    draw(ctx, p, d, clock) {
      const a = t(clock) * 0.8 + d.x;
      movers.ufo(ctx, p, { x: d.x + Math.sin(a) * 14 * d.s, y: d.y + Math.sin(a * 2) * 4 * d.s, r: 9 * d.s }, clock);
    },
  },
  // A little green alien, waving all three arms.
  alien: {
    layer: "low",
    light: { r: 30, color: "rgba(182, 255, 59, 0.35)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const { x, y } = d;
      const wave = Math.sin(t(clock) * 6 + x) * 3 * s;
      ctx.lineCap = "round";
      line(ctx, x - 5 * s, y + 2 * s, x - 11 * s, y - 6 * s + wave, LIME, 2.2 * s);
      line(ctx, x + 5 * s, y + 2 * s, x + 11 * s, y - 6 * s - wave, LIME, 2.2 * s);
      line(ctx, x + 4 * s, y + 6 * s, x + 12 * s, y + 4 * s + wave * 0.5, LIME, 2 * s);
      line(ctx, x - 3 * s, y + 10 * s, x - 4 * s, y + 15 * s, LIME, 2.4 * s);
      line(ctx, x + 3 * s, y + 10 * s, x + 4 * s, y + 15 * s, LIME, 2.4 * s);
      ellipse(ctx, x, y + 5 * s, 5.5 * s, 7 * s);
      fill(ctx, LIME);
      for (const dir of [-1, 1]) {
        line(ctx, x + dir * 3 * s, y - 9 * s, x + dir * 6 * s, y - 17 * s, LIME, 1.4 * s);
        circle(ctx, x + dir * 6 * s, y - 17 * s, 2 * s);
        fill(ctx, PINK);
      }
      ellipse(ctx, x, y - 5 * s, 8 * s, 7 * s);
      fill(ctx, LIME);
      circle(ctx, x, y - 6 * s, 3.4 * s);
      fill(ctx, "#ffffff");
      circle(ctx, x + Math.sin(t(clock) * 1.3) * 1.2 * s, y - 6 * s, 1.7 * s);
      fill(ctx, "#140a2e");
      ctx.beginPath();
      ctx.arc(x, y - 2 * s, 3 * s, 0.2, Math.PI - 0.2);
      stroke(ctx, "#140a2e", 1 * s);
    },
  },
  // A cow being beamed up, slowly turning, very confused.
  cow: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      const rise = Math.sin(t(clock) * 0.9) * 4;
      const beam = radial(ctx, d.x, d.y - 20 * s, 0, 40 * s, [[0, "rgba(182, 255, 59, 0.4)"], [1, "rgba(182, 255, 59, 0)"]]);
      polygon(ctx, [{ x: d.x - 6 * s, y: d.y - 26 * s }, { x: d.x + 6 * s, y: d.y - 26 * s }, { x: d.x + 18 * s, y: d.y + 14 * s }, { x: d.x - 18 * s, y: d.y + 14 * s }]);
      fill(ctx, beam || "rgba(182, 255, 59, 0.15)");
      turned(ctx, d.x, d.y + rise, Math.sin(t(clock) * 0.7) * 0.5, () => {
        for (const dx of [-6, -3, 3, 6]) line(ctx, dx * s, 3 * s, dx * s, 8 * s, "#f4f1ea", 1.8 * s);
        ellipse(ctx, 0, 0, 9 * s, 5 * s);
        fill(ctx, "#f4f1ea");
        circle(ctx, -3 * s, -1 * s, 2.2 * s);
        fill(ctx, "#140a2e");
        circle(ctx, 4 * s, 1.5 * s, 1.6 * s);
        fill(ctx, "#140a2e");
        ellipse(ctx, 10 * s, -3 * s, 3.6 * s, 3 * s);
        fill(ctx, "#f4f1ea");
        ellipse(ctx, 12 * s, -2 * s, 1.8 * s, 1.5 * s);
        fill(ctx, "#ffb3ec");
        circle(ctx, 9.5 * s, -4.5 * s, 0.8 * s);
        fill(ctx, "#140a2e");
      });
    },
  },
  // A satellite drifting, panels out, its light blinking.
  satellite: {
    layer: "low",
    draw(ctx, p, d, clock) {
      const s = d.s;
      const a = Math.sin(t(clock) * 0.5 + d.x) * 0.3 - 0.5;
      const half = 20 * s;
      spinners.satellite(ctx, p, { x: d.x, y: d.y, x1: d.x - Math.cos(a) * half, y1: d.y - Math.sin(a) * half, x2: d.x + Math.cos(a) * half, y2: d.y + Math.sin(a) * half }, clock);
    },
  },
  // A space station: a lit ring turning round its hub, with solar wings.
  station: {
    layer: "low",
    light: { r: 50, color: "rgba(57, 243, 255, 0.25)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const { x, y } = d;
      for (const dir of [-1, 1]) {
        line(ctx, x + dir * 10 * s, y, x + dir * 46 * s, y, "#c9c3e6", 1.5 * s);
        for (const k of [22, 36]) {
          ctx.fillStyle = "#1d3fbf";
          ctx.fillRect(x + dir * k * s - 5 * s, y - 12 * s, 10 * s, 24 * s);
          ctx.strokeStyle = CYAN;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(x + dir * k * s - 5 * s, y - 12 * s, 10 * s, 24 * s);
        }
      }
      ellipse(ctx, x, y, 18 * s, 18 * s);
      stroke(ctx, "#d9d4f0", 4 * s);
      const spin = t(clock) * 0.6;
      for (let i = 0; i < 8; i++) {
        const a = spin + (i / 8) * Math.PI * 2;
        circle(ctx, x + Math.cos(a) * 18 * s, y + Math.sin(a) * 18 * s, 1.3 * s);
        fill(ctx, i % 2 ? YELLOW : CYAN);
      }
      circle(ctx, x, y, 7 * s);
      fill(ctx, "#2a1d63");
      circle(ctx, x, y, 7 * s);
      stroke(ctx, PINK, 2 * s);
    },
  },
  // A sun, its corona flaring and its rays turning.
  sun: {
    layer: "low",
    light: { r: 90, color: "rgba(255, 170, 60, 0.45)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const { x, y } = d;
      glow(ctx, x, y, 70 * s, "rgba(255, 154, 60, 0.45)");
      const spin = t(clock) * 0.3;
      for (let i = 0; i < 12; i++) {
        const a = spin + (i / 12) * Math.PI * 2;
        const len = (48 + Math.sin(t(clock) * 3 + i * 2) * 5) * s;
        polygon(ctx, [{ x: x + Math.cos(a - 0.12) * 34 * s, y: y + Math.sin(a - 0.12) * 34 * s }, { x: x + Math.cos(a) * len, y: y + Math.sin(a) * len }, { x: x + Math.cos(a + 0.12) * 34 * s, y: y + Math.sin(a + 0.12) * 34 * s }]);
        fill(ctx, i % 2 ? ORANGE : YELLOW);
      }
      const g = radial(ctx, x, y, 0, 36 * s, [[0, "#fff8c8"], [0.6, YELLOW], [1, ORANGE]]);
      circle(ctx, x, y, 36 * s);
      fill(ctx, g || YELLOW);
      // Sunglasses. It is very bright.
      for (const dir of [-1, 1]) {
        ellipse(ctx, x + dir * 10 * s, y - 6 * s, 8 * s, 5 * s);
        fill(ctx, "#140a2e");
      }
      line(ctx, x - 3 * s, y - 7 * s, x + 3 * s, y - 7 * s, "#140a2e", 2 * s);
      ctx.beginPath();
      ctx.arc(x, y + 6 * s, 9 * s, 0.25, Math.PI - 0.25);
      stroke(ctx, "#c45a10", 2.2 * s);
    },
  },
  // A space jellyfish drifting over the nebula, tentacles trailing.
  jelly: {
    layer: "low",
    light: { r: 30, color: "rgba(255, 63, 208, 0.3)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const x = d.x + Math.sin(t(clock) * 0.6 + d.y) * 6 * s;
      const y = d.y + Math.sin(t(clock) * 1.2 + d.x) * 5 * s;
      const pulse = 1 + Math.sin(t(clock) * 3 + d.x) * 0.08;
      ctx.lineCap = "round";
      for (let k = -2; k <= 2; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * 3 * s, y);
        for (let i = 1; i <= 5; i++) ctx.lineTo(x + k * 3 * s + Math.sin(t(clock) * 4 + i + k) * 1.8 * s, y + i * 4 * s);
        stroke(ctx, "rgba(255, 179, 236, 0.75)", 1.2 * s);
      }
      ctx.beginPath();
      ctx.ellipse(x, y, 11 * s * pulse, 10 * s / pulse, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      fill(ctx, "rgba(255, 63, 208, 0.75)");
      ctx.beginPath();
      ctx.ellipse(x, y, 7 * s * pulse, 6 * s / pulse, 0, Math.PI, Math.PI * 2);
      ctx.closePath();
      fill(ctx, "rgba(255, 210, 245, 0.6)");
    },
  },
  // A pulsar: a bright core with two beams sweeping round.
  pulsar: {
    layer: "low",
    light: { r: 40, color: "rgba(57, 243, 255, 0.4)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const a = t(clock) * 2.2;
      for (const dir of [0, Math.PI]) {
        const b = radial(ctx, d.x, d.y, 0, 48 * s, [[0, "rgba(57, 243, 255, 0.8)"], [1, "rgba(57, 243, 255, 0)"]]);
        polygon(ctx, [{ x: d.x, y: d.y }, { x: d.x + Math.cos(a + dir - 0.16) * 48 * s, y: d.y + Math.sin(a + dir - 0.16) * 48 * s }, { x: d.x + Math.cos(a + dir + 0.16) * 48 * s, y: d.y + Math.sin(a + dir + 0.16) * 48 * s }]);
        fill(ctx, b || "rgba(57, 243, 255, 0.3)");
      }
      glow(ctx, d.x, d.y, 14 * s, "rgba(220, 255, 255, 0.9)");
      circle(ctx, d.x, d.y, 4 * s);
      fill(ctx, "#ffffff");
    },
  },
  // The alien mothership: a huge saucer, its lights chasing round its rim.
  mothership: {
    layer: "low",
    light: { r: 80, color: "rgba(182, 255, 59, 0.25)" },
    draw(ctx, p, d, clock) {
      const s = d.s;
      const y = d.y + Math.sin(t(clock) * 1.2) * 1.5;
      const { x } = d;
      glow(ctx, x, y, 90 * s, "rgba(182, 255, 59, 0.18)");
      ellipse(ctx, x, y - 6 * s, 30 * s, 16 * s);
      fill(ctx, "rgba(57, 243, 255, 0.5)");
      for (const dx of [-12, 0, 12]) {
        ellipse(ctx, x + dx * s, y - 9 * s, 3.4 * s, 4 * s);
        fill(ctx, LIME);
        circle(ctx, x + dx * s - 1 * s, y - 10 * s, 1.2 * s);
        fill(ctx, "#140a2e");
      }
      ellipse(ctx, x, y + 4 * s, 82 * s, 14 * s);
      fill(ctx, "#b9b2d9");
      ellipse(ctx, x, y + 4 * s, 82 * s, 14 * s);
      stroke(ctx, VIOLET, 1.5 * s);
      ellipse(ctx, x, y + 7 * s, 60 * s, 6 * s);
      fill(ctx, "#7a6fa8");
      for (let i = 0; i < 13; i++) {
        const lit = Math.floor(t(clock) * 10) % 13 === i;
        circle(ctx, x + (i - 6) * 12 * s, y + 4 * s + Math.abs(i - 6) * -0.6 * s, (lit ? 2.6 : 1.8) * s);
        fill(ctx, lit ? "#ffffff" : NEON[i % NEON.length]);
      }
    },
  },
};

/* ---------------------------------------------------------- ground cover */

const grounds = {
  // Black-light carpet: dark violet with neon squiggles, rings and stars
  // scattered across it, the way glow golf halls are carpeted.
  neon(ctx, p, course) {
    ctx.fillStyle = p.turf;
    ctx.fillRect(0, 0, course.w, course.h);
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.5;
    let i = 0;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 19, 7)) {
      const c = NEON[i % NEON.length];
      const kind = (i * 7) % 5;
      if (kind === 0) {
        circle(ctx, q.x, q.y, 2.4);
        stroke(ctx, c, 1);
      } else if (kind === 1) {
        ctx.beginPath();
        ctx.moveTo(q.x - 4, q.y);
        ctx.quadraticCurveTo(q.x - 2, q.y - 3, q.x, q.y);
        ctx.quadraticCurveTo(q.x + 2, q.y + 3, q.x + 4, q.y);
        stroke(ctx, c, 1);
      } else if (kind === 2) {
        sparkle(ctx, q.x, q.y, 2.6, c);
      } else if (kind === 3) {
        polygon(ctx, [{ x: q.x, y: q.y - 2.5 }, { x: q.x + 2.5, y: q.y + 2 }, { x: q.x - 2.5, y: q.y + 2 }]);
        stroke(ctx, c, 0.9);
      } else {
        circle(ctx, q.x, q.y, 1);
        fill(ctx, c);
      }
      i++;
    }
    ctx.globalAlpha = 1;
  },
  // A space station deck: a glowing grid on dark panels.
  grid(ctx, p, course) {
    ctx.fillStyle = "#1a1145";
    ctx.fillRect(0, 0, course.w, course.h);
    for (let x = 0; x <= course.w; x += 20) {
      ctx.fillStyle = x % 80 ? "rgba(57, 243, 255, 0.16)" : "rgba(57, 243, 255, 0.32)";
      ctx.fillRect(x - 0.5, 0, 1, course.h);
    }
    for (let y = 0; y <= course.h; y += 20) {
      ctx.fillStyle = y % 80 ? "rgba(57, 243, 255, 0.16)" : "rgba(57, 243, 255, 0.32)";
      ctx.fillRect(0, y - 0.5, course.w, 1);
    }
    ctx.fillStyle = "rgba(255, 63, 208, 0.45)";
    for (let y = 0; y <= course.h; y += 40) for (let x = 0; x <= course.w; x += 40) ctx.fillRect(x - 1, y - 1, 2, 2);
  },
  // Moon rock: gray violet, pocked with craters.
  crater(ctx, p, course) {
    ctx.fillStyle = "#353058";
    ctx.fillRect(0, 0, course.w, course.h);
    ctx.fillStyle = "rgba(200, 190, 240, 0.12)";
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 6, 9)) ctx.fillRect(q.x, q.y, 1.2, 1.2);
    let i = 0;
    for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 32, 4)) {
      const r = 3 + ((i * 5) % 7);
      circle(ctx, q.x, q.y, r);
      fill(ctx, "rgba(20, 12, 50, 0.35)");
      ctx.beginPath();
      ctx.arc(q.x, q.y, r, Math.PI * 0.9, Math.PI * 1.9);
      stroke(ctx, "rgba(220, 210, 255, 0.35)", 1);
      i++;
    }
  },
};

// Deep space past the green: nebula clouds and a field of stars.
function rough(ctx, p, course) {
  for (const [x, y, r, color] of [
    [70, 60, 150, "rgba(140, 40, 200, 0.35)"],
    [340, 250, 170, "rgba(40, 70, 220, 0.32)"],
    [320, 40, 120, "rgba(255, 63, 208, 0.18)"],
    [50, 270, 130, "rgba(57, 243, 255, 0.12)"],
    [200, 160, 160, "rgba(90, 40, 180, 0.18)"],
  ]) glow(ctx, x, y, r, color);
  let i = 0;
  for (const q of scatter({ x: 0, y: 0, w: course.w, h: course.h }, 11, 3)) {
    const big = i % 9 === 0;
    circle(ctx, q.x, q.y, big ? 1.1 : 0.55);
    fill(ctx, i % 5 === 0 ? "rgba(160, 230, 255, 0.85)" : "rgba(255, 255, 255, 0.7)");
    if (big) sparkle(ctx, q.x, q.y, 3, "rgba(255, 255, 255, 0.55)");
    i++;
  }
}

// What glows in the dim: the wells, the stars and saucers, and the cup.
function lights(v) {
  const glows = [];
  for (const w of v.hole.wells) {
    const color = w.look === "repulsor" ? "rgba(57, 243, 255, 0.3)" : w.look === "tractor" ? "rgba(182, 255, 59, 0.3)" : "rgba(255, 110, 90, 0.35)";
    glows.push({ x: w.x, y: w.y, r: w.r * 1.1, color });
  }
  for (const b of v.hole.bumpers) {
    if (b.look === "star") glows.push({ x: b.x, y: b.y, r: b.r * 4, color: "rgba(255, 225, 77, 0.4)" });
    else if (b.look === "planet") glows.push({ x: b.x, y: b.y, r: b.r * 3, color: "rgba(255, 63, 208, 0.3)" });
    else glows.push({ x: b.x, y: b.y, r: b.r * 2.2, color: "rgba(57, 243, 255, 0.18)" });
  }
  for (const m of v.movers) glows.push({ x: m.x, y: m.y, r: m.r * 4, color: m.look === "meteor" ? "rgba(255, 154, 60, 0.45)" : "rgba(182, 255, 59, 0.3)" });
  for (const s of v.spinners) glows.push({ x: s.x, y: s.y, r: 40, color: "rgba(155, 92, 255, 0.25)" });
  for (const g of v.gates) if (g.shut) glows.push({ x: (g.x1 + g.x2) / 2, y: (g.y1 + g.y2) / 2, r: 30, color: g.look === "shield" ? "rgba(255, 63, 208, 0.35)" : "rgba(255, 225, 77, 0.2)" });
  for (const b of v.hole.bridges) glows.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, r: Math.max(b.w, b.h) * 0.8, color: "rgba(57, 243, 255, 0.25)" });
  return glows;
}

export default {
  palette: {
    rough: "#0a0620",
    roughMark: "#2a1f55",
    foam: "rgba(57, 243, 255, 0.4)",
    shore: "#7a2bff",
    turf: "#251a5c",
    stripe: "#2a1f66",
    deck: "#2a1d63",
    deckLine: "#3d2c85",
    moss: "#251a5c",
    stone: "#353058",
    stoneLine: "#2a2548",
    sand: "#6b6390",
    speckle: "#d6ccff",
    ice: "#1d4a8c",
    iceLine: "#7fecff",
    wall: PINK,
    wallTop: "#ffd2f4",
    slope: "#3a1670",
    arrow: "rgba(182, 255, 59, 0.9)",
    bridge: "#2b1d63",
    plank: CYAN,
    spinner: VIOLET,
    hub: YELLOW,
    portalA: CYAN,
    portalB: PINK,
    cup: "#000000",
    flag: LIME,
    flagMark: "#1a1242",
    pad: LIME,
    spy: LIME,
    banner: "#160d36",
    bannerLine: CYAN,
    bannerInk: "#f4ecff",
    bannerRound: 10,
    thickWalls: true,
    portals: true,
    dark: 0.25,
  },
  liquids: {
    // The void of a black hole: nothing at all, rings sinking into it.
    void: { fill: "#030008", ripple: "#5b2bb5", glow: "rgba(150, 80, 255, 0.35)", still: true },
    // A nebula's glowing plasma, bubbling.
    plasma: { fill: "#a3168a", ripple: "#ff9af0", glow: "rgba(255, 60, 200, 0.45)", bubbles: "#ffd0fa" },
  },
  grounds,
  rough,
  tunnel,
  lights,
  bumpers,
  movers,
  spinners,
  gates,
  wells,
  decor,
};
