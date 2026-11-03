// Plan2Code Web Console - Ghoul Rush's Bottle Rocket, the common weapon every stage sells: one use lights THREE rockets, one ahead, one up and one behind.
//
// - AHEAD flies level with his chest at ROCKET_SPEED, straight, until a monster in
//   view on its side sits above or below that line (on a shelf, in a pit's mouth):
//   then it bends toward the nearest such monster at LEVEL_TURN, never turning back.
// - UP leaves straight up at ROCKET_UP_SPEED for ROCKET_UP_MS, then curves over
//   (turning ROCKET_TURN radians a second) and homes on the nearest monster in
//   view that is ahead of him or above him: a bat, a flyer, whatever sits on a
//   shelf. With nothing to chase it steers for a point far ahead and below, so it
//   arcs forward and drops.
// - BEHIND leaves backward at ROCKET_BACK_SPEED, for the horde and the stragglers
//   on his heels, bending toward one above or below it the same way.
//
// A rocket explodes on touching a monster, a wall or the floor, a target (an
// organ pipe, a crate), or at ROCKET_LIFE_MS. The blast reaches ROCKET_BLAST_R
// from the rocket, does ROCKET_DMG (a kill for anything ordinary) to every
// monster in it once, and ROCKET_BOSS to a boss in it through armBossDamage (a
// guard shows, a hidden boss is not hit, the share cap holds across all three).
// Its kills leave no drops. Three rockets cost the bag one use. Nothing here
// hurts Planny.
//
// Sparks are only for the eye: they live on the rocket (and, once it has gone off,
// on its burst), never touch a rule, are capped at SPARK_CAP across the field,
// and are drawn from a time-and-serial pattern (`mix`), never a random draw, so a
// round replays the same and a seed does not shift.
//
// No imports: ghoul-arms.js hands the rules its helpers (see `tools`).

const TAU = Math.PI * 2;

export const ROCKET_COUNT = 3;
export const ROCKET_SPEED = 105;
export const ROCKET_BACK_SPEED = 95;
export const ROCKET_UP_SPEED = 80;
export const ROCKET_UP_MS = 220;
export const ROCKET_ARC_SPEED = 80;
export const ROCKET_TURN = 6.5;
// Within HOME_NEAR of its mark it turns HOME_BOOST times as fast, so it closes on a
// target to the side of it instead of circling.
export const HOME_NEAR = 26;
export const HOME_BOOST = 2.8;
// The level rockets (ahead and behind) bend toward a monster whose middle is more than
// LEVEL_OFF above or below them, on their side of the room, inside a cone that rises
// LEVEL_CONE units for every unit of distance (plus LEVEL_SLACK), at LEVEL_TURN.
export const LEVEL_TURN = 3.2;
export const LEVEL_OFF = 1.4;
export const LEVEL_CONE = 1.1;
export const LEVEL_SLACK = 6;
export const ROCKET_LIFE_MS = 2000;
export const ROCKET_BLAST_R = 6;
export const ROCKET_DMG = 40;
export const ROCKET_BOSS = 4;
export const ROCKET_PIPE = 3;
// How far a rocket's nose reaches past a monster's box to count as touching.
export const ROCKET_HIT = 0.9;
// A slice this long at most, so a fast rocket never skips over a monster.
const SLICE_MS = 6;
const CEILING = 56;
// Where the up rocket aims when nothing is there: far ahead and below.
const ARC_DX = 40;
const ARC_DY = -40;

// Sparks: one every SPARK_STEP of travel (6 to 10 a frame at 60 fps), living
// SPARK_LIFE_MS to SPARK_LIFE_MS + SPARK_LIFE_VARY, at most SPARK_CAP on the field
// (the trail stops shedding at SPARK_TRAIL_CAP so a burst always has room), a burst
// of SPARK_BURST flying out of a blast, SPARK_COLORS in turn.
export const SPARK_STEP = 0.2;
export const SPARK_LIFE_MS = 270;
export const SPARK_LIFE_VARY = 110;
export const SPARK_CAP = 480;
export const SPARK_TRAIL_CAP = 410;
export const SPARK_BURST = 44;
export const SPARK_COLORS = Object.freeze(["#ff3b30", "#ff9500", "#ffe14d", "#3ddc5a", "#33e0ff", "#ff4fd8"]);
const SPARK_G = 34;
export const BOOM_MS = 620;
export const MUZZLE_MS = 460;
// The launch sound plays once per volley; the blasts share one, this often at most.
export const BOOM_SOUND_MS = 90;

// A number from 0 to 1 that depends on `n` alone (a hash, not a random draw).
export function mix(n) {
  let x = Math.imul(n | 0, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 3266489917) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const sparkCount = (round) => {
  let n = 0;
  for (const h of round.hazards) if (h.sparks) n += h.sparks.length;
  return n;
};

// A spark at (x, y): `vx`, `vy` its start, color the next of the six.
function spark(round, x, y, vx, vy, life) {
  const n = (round.sparkN = (round.sparkN || 0) + 1);
  return { x, y, vx, vy, age: 0, life, c: n % SPARK_COLORS.length, s: 0.5 + mix(n * 7 + 3) * 0.5 };
}

function ageSparks(list, ms) {
  const dt = ms / 1000;
  let n = 0;
  for (const p of list) {
    p.age += ms;
    if (p.age >= p.life) continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= SPARK_G * dt;
    list[n++] = p;
  }
  list.length = n;
}

// The use: three rockets and the flash at his hand.
export function useRockets(round, k) {
  const you = round.you;
  const face = you.face;
  const y = you.y + k.shotY(you);
  const make = (dir, x, yy, vx, vy) => ({ kind: "armRocket", dir, face, x, y: yy, vx, vy, t: 0, acc: 0, sparks: [], w: 0.1, h: 0.1, live: 0, cause: "" });
  round.hazards.push(make("fwd", you.x + face * 1.8, y, face * ROCKET_SPEED, 0));
  round.hazards.push(make("up", you.x + face * 0.4, y + 0.6, 0, ROCKET_UP_SPEED));
  round.hazards.push(make("back", you.x - face * 1.8, y, -face * ROCKET_BACK_SPEED, 0));
  round.hazards.push({ kind: "armMuzzle", x: you.x + face * 1.8, y, face, life: MUZZLE_MS, max: MUZZLE_MS, w: 0.1, h: 0.1, live: 0, cause: "" });
}

// Turn toward (tx, ty) by at most `turn` radians, at speed `v`.
function steer(h, tx, ty, turn, v) {
  const want = Math.atan2(ty - h.y, tx - h.x);
  const now = Math.atan2(h.vy, h.vx);
  let da = want - now;
  while (da > Math.PI) da -= TAU;
  while (da < -Math.PI) da += TAU;
  const a = now + Math.max(-turn, Math.min(turn, da));
  h.vx = Math.cos(a) * v;
  h.vy = Math.sin(a) * v;
}

// The up rocket's mark: the nearest monster in view that is ahead of where it was
// fired or above it; else a point far ahead and below, so it arcs and drops.
function markOf(round, h, k, tools) {
  const lo = round.camX - 2;
  const hi = round.camX + k.FIELD_W + 2;
  let best = null;
  let d = Infinity;
  const consider = (x, y) => {
    const dm = Math.hypot(x - h.x, y - h.y);
    if (dm < d) {
      d = dm;
      best = { x, y };
    }
  };
  for (const m of round.monsters) {
    if (m.dead || !k.solid(m) || k.stone(m) || k.harmlessNow(m) || m.x < lo || m.x > hi) continue;
    const mid = m.y + m.h / 2;
    if ((m.x - h.x0) * h.face >= -4 || mid > h.y0 + 3) consider(m.x, mid);
  }
  const b = tools.bossUp(round);
  if (b && !k.guarded(b)) consider(b.x, b.y + b.h / 2);
  return best ? { ...best, near: d < HOME_NEAR } : { x: h.x + h.face * ARC_DX, y: h.y + ARC_DY, near: false };
}

// A level rocket's mark: the nearest monster in view on its side of the room whose
// middle is off the rocket's line (more than LEVEL_OFF) and inside the cone. None
// means it flies straight on.
function levelMark(round, h, k, tools) {
  const lo = round.camX - 2;
  const hi = round.camX + k.FIELD_W + 2;
  const way = Math.sign(h.vx) || h.face;
  let best = null;
  let d = Infinity;
  const consider = (x, y) => {
    const dx = (x - h.x) * way;
    const dy = Math.abs(y - h.y);
    if (dx <= 0 || dy <= LEVEL_OFF || dy > LEVEL_CONE * dx + LEVEL_SLACK) return;
    const dm = Math.hypot(x - h.x, y - h.y);
    if (dm < d) {
      d = dm;
      best = { x, y, near: dm < HOME_NEAR };
    }
  };
  for (const m of round.monsters) {
    if (m.dead || !k.solid(m) || k.stone(m) || k.harmlessNow(m) || m.x < lo || m.x > hi) continue;
    consider(m.x, m.y + m.h / 2);
  }
  const b = tools.bossUp(round);
  if (b && !k.guarded(b)) consider(b.x, b.y + b.h / 2);
  return best;
}

// Whether a point is inside a box w by h standing at (x, y), `r` to spare.
const inside = (m, px, py, r) => px >= m.x - m.w / 2 - r && px <= m.x + m.w / 2 + r && py >= m.y - r && py <= m.y + m.h + r;
// The distance from (px, py) to the nearest point of a monster's box.
const reach = (m, px, py) => Math.hypot(px - Math.max(m.x - m.w / 2, Math.min(m.x + m.w / 2, px)), py - Math.max(m.y, Math.min(m.y + m.h, py)));

// It goes off at (x, y): the burst, the blast and the sound.
function explode(round, h, k, tools) {
  const { x, y } = h;
  const sparks = h.sparks;
  const room = Math.max(0, SPARK_CAP - sparkCount(round));
  const burst = Math.min(SPARK_BURST, room);
  for (let i = 0; i < burst; i++) {
    const n = (round.sparkN || 0) + 1;
    const a = (i / SPARK_BURST) * TAU + mix(n) * 0.5;
    const v = 16 + mix(n * 3 + 1) * 34;
    const p = spark(round, x, y, Math.cos(a) * v, Math.sin(a) * v + 4, 380 + mix(n * 5 + 2) * 260);
    p.s += 0.35;
    sparks.push(p);
  }
  round.hazards.push({ kind: "armRocketBoom", x, y, life: BOOM_MS, max: BOOM_MS, sparks, w: 0.1, h: 0.1, live: 0, cause: "" });
  const view = x > round.camX - 4 && x < round.camX + k.FIELD_W + 4;
  if (view && !(round.rocketSoundMs > 0)) {
    round.rocketSoundMs = BOOM_SOUND_MS;
    round.events.push({ type: "armBoom", x, y });
  }
  const holy = round.effects.holy > 0;
  for (const m of round.monsters) {
    if (m.dead || !(k.solid(m) || k.stone(m)) || k.harmlessNow(m) || reach(m, x, y) > ROCKET_BLAST_R) continue;
    if (k.stone(m)) {
      if (holy) k.hurt(round, m, 99, "holy", tools.noDrops);
      continue;
    }
    k.hurt(round, m, ROCKET_DMG, "blast", tools.noDrops);
  }
  tools.sweepDead(round);
  const b = tools.bossUp(round);
  if (b && reach(b, x, y) <= ROCKET_BLAST_R) tools.hitBoss(round, Math.max(b.x - b.w / 2, Math.min(b.x + b.w / 2, x)), Math.max(b.y, Math.min(b.y + b.h, y)), ROCKET_BOSS, "blast", k);
  for (const p of b?.pipes || []) {
    if (p.on && Math.abs(p.x - x) <= ROCKET_BLAST_R && y >= p.y - ROCKET_BLAST_R && y <= p.y + p.h + ROCKET_BLAST_R) k.strike(round, { x: p.x, y: Math.max(p.y, Math.min(p.y + p.h, y)), pipeDmg: ROCKET_PIPE });
  }
}

// Whether the rocket is spent now: on a monster, the boss, a target, a wall or
// the floor, out of life, or lost in a pit or the roof.
function spent(round, h, k, tools) {
  if (h.t >= ROCKET_LIFE_MS || h.y < k.PIT_Y || h.y > CEILING || k.groundAt(round.spec, h.x) > h.y) return true;
  for (const m of round.monsters) if (!m.dead && (k.solid(m) || k.stone(m)) && !k.harmlessNow(m) && inside(m, h.x, h.y, ROCKET_HIT)) return true;
  const b = tools.bossUp(round);
  if (b && inside(b, h.x, h.y, ROCKET_HIT * 0.5)) return true;
  return k.strike(round, { x: h.x, y: h.y, pipeDmg: ROCKET_PIPE, dmg: 1 });
}

// Sparks shed along the way between two slices: one every SPARK_STEP of travel,
// thrown back and to the sides, falling.
function shed(round, h, px, py) {
  const d = Math.hypot(h.x - px, h.y - py);
  if (!d) return;
  h.acc += d;
  const speed = Math.hypot(h.vx, h.vy) || 1;
  const bx = -h.vx / speed;
  const by = -h.vy / speed;
  let total = -1;
  while (h.acc >= SPARK_STEP) {
    h.acc -= SPARK_STEP;
    if (total < 0) total = sparkCount(round);
    if (total >= SPARK_TRAIL_CAP) continue;
    total++;
    const f = 1 - h.acc / d;
    const n = (round.sparkN || 0) + 1;
    const back = 6 + mix(n) * 16;
    const side = (mix(n * 3 + 1) - 0.5) * 34;
    const p = spark(round, px + (h.x - px) * Math.min(1, Math.max(0, f)) + bx * 1.2, py + (h.y - py) * Math.min(1, Math.max(0, f)) + by * 1.2, bx * back - by * side, by * back + bx * side + 4, SPARK_LIFE_MS + mix(n * 5 + 2) * SPARK_LIFE_VARY);
    h.sparks.push(p);
  }
}

// One slice of a rocket in flight. `tools` is { bossUp, hitBoss, sweepDead, noDrops } from ghoul-arms.js.
export function stepRocket(round, h, ms, k, tools) {
  if (h.t === 0) {
    h.x0 = h.x;
    h.y0 = h.y;
  }
  for (let left = ms; left > 0; left -= SLICE_MS) {
    const dt = Math.min(SLICE_MS, left);
    const s = dt / 1000;
    h.t += dt;
    ageSparks(h.sparks, dt);
    if (h.dir === "up" && h.t > ROCKET_UP_MS) {
      const to = markOf(round, h, k, tools);
      steer(h, to.x, to.y, ROCKET_TURN * (to.near ? HOME_BOOST : 1) * s, ROCKET_ARC_SPEED);
    }
    if (h.dir !== "up") {
      const to = levelMark(round, h, k, tools);
      if (to) steer(h, to.x, to.y, LEVEL_TURN * (to.near ? HOME_BOOST : 1) * s, h.dir === "fwd" ? ROCKET_SPEED : ROCKET_BACK_SPEED);
    }
    const px = h.x;
    const py = h.y;
    h.x += h.vx * s;
    h.y += h.vy * s;
    shed(round, h, px, py);
    if (spent(round, h, k, tools)) {
      explode(round, h, k, tools);
      return false;
    }
  }
  return true;
}

export function stepBoom(round, h, ms) {
  ageSparks(h.sparks, ms);
  return (h.life -= ms) > 0;
}

export function stepMuzzle(round, h, ms) {
  return (h.life -= ms) > 0;
}
