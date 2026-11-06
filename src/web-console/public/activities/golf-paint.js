// Plan2Code Web Console - mini golf's paint box: the small canvas helpers every golf drawing file shares.
//
// No imports and no state, so golf-draw.js, golf-decor.js and every course
// look (golf-look-<id>.js) can use them without importing one another.
// Everything here draws in course units on whatever context it is handed,
// and nothing reads the clock or Math.random(): a caller hands in the round's
// clock, so a paused frame stays still.

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

export const fill = (ctx, color) => {
  ctx.fillStyle = color;
  ctx.fill();
};

export const stroke = (ctx, color, width) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
};

export function line(ctx, x1, y1, x2, y2, color, width) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  stroke(ctx, color, width);
}

export function label(ctx, str, x, y, size, color, font) {
  ctx.font = `700 ${size}px ${font || "sans-serif"}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// Turns the context to draw along an angle around a point, for the callback.
export function turned(ctx, x, y, angle, draw) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  draw();
  ctx.restore();
}

// The round's clock in seconds, for anything that moves with time.
export const t = (clock) => clock / 1000;

// A fixed scatter of points in a box: the same every frame, with no random.
export function* scatter(box, step, seed) {
  let n = seed;
  for (let y = box.y + step / 2; y < box.y + box.h; y += step) {
    for (let x = box.x + step / 2; x < box.x + box.w; x += step) {
      n = (n * 9301 + 49297) % 233280;
      const jx = (n / 233280 - 0.5) * step;
      n = (n * 9301 + 49297) % 233280;
      const jy = (n / 233280 - 0.5) * step;
      yield { x: x + jx, y: y + jy };
    }
  }
}

// The box a polygon fits in: { x, y, w, h }.
export const bounds = (points) => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
