// Plan2Code Web Console - Ghoul Rush's Old Rattlebones, the East Wing's boss: his volleys, slams, boomerang skull, bone rain and the skeletons he raises, as a boss pack that ghoul.js plugs in.
//
// No imports: ghoul.js hands every rule here a kit `k` of its own helpers
// (throwBone, spawnMonster, groundAt, hurtBoss and the arena's ends), so this
// file never reaches back into it. It is a pack in the shape of the stage
// packs (see ghoul-graveyard.js): `bosses`, `boss` (one slice of his fight)
// and `hazards` (the skull in flight, the bones coming down, the floor
// cracking where a skeleton comes up).
//
// Old Rattlebones keeps BONES_KEEP from you and, every BONES_MS, winds up for
// one of his attacks, picked at random but never the same one three times
// running (the first is always a volley):
//
// - a volley, one bone at each VOLLEY scale of the throw that lands on you;
// - a slam, a shockwave along the floor both ways at WAVE_SPEED;
// - the skull: he throws his own, which flies out level at your chest to
//   SKULL_REACH past you, then curves back to his neck. Jump it going and
//   coming. While it is out he is headless: bolts to his body do their one,
//   and a bolt to the skull itself does SKULL_HIT;
// - bone rain (rage only): he hurls bones straight up and RAIN_N of them
//   come down around you, each on a shadow that closes in for RAIN_WARN_MS.
//
// At BONES_RAGE of his hp he shakes and his eyes flare: he attacks every
// BONES_RAGE_MS, a slam comes in a double (the second wave DOUBLE_GAP_MS
// behind the first), and every RAISE_MS he has a skeleton come up out of the
// floor (the floor cracks RAISE_WARN_MS first), never more than MAX_BONY
// skeletons about at once.

const freeze = (o) => Object.freeze(o);

export const BOSSES = freeze({
  bones: freeze({ name: "Old Rattlebones", sub: "Jump the skull, then aim for it", w: 7, h: 18, hp: 90, points: 2500, color: "#d8cdb0" }),
});

export const BONES_KEEP = 18;
export const BONES_MS = 1250;
export const BONES_RAGE_MS = 950;
export const BONES_WINDUP_MS = 420;
export const VOLLEY = freeze([0.6, 0.8, 1, 1.2, 1.4]);
export const BONES_RAGE = 0.5;
export const BONES_SHAKE_MS = 900;
export const DOUBLE_GAP_MS = 420;
// The skull: wound up for SKULL_WINDUP_MS, SKULL_R across, flying at SKULL_V
// (slowing into its turn, quickening home), its turn SKULL_REACH past you; a
// bolt does SKULL_HIT, and it takes the next bolts without harm for
// SKULL_STAGGER_MS.
export const SKULL_WINDUP_MS = 560;
export const SKULL_R = 1.1;
export const SKULL_V = 34;
export const SKULL_REACH = 10;
export const SKULL_HIT = 3;
export const SKULL_STAGGER_MS = 220;
// Bone rain: RAIN_WINDUP_MS to hurl them, RAIN_N bones RAIN_SPREAD apart
// around you, landing RAIN_STAGGER_MS after one another from RAIN_WARN_MS,
// each RAIN_W wide and RAIN_H high for RAIN_LIVE_MS.
export const RAIN_WINDUP_MS = 620;
export const RAIN_N = 5;
export const RAIN_SPREAD = 6;
export const RAIN_WARN_MS = 900;
export const RAIN_STAGGER_MS = 110;
export const RAIN_LIVE_MS = 260;
export const RAIN_W = 2.8;
export const RAIN_H = 6;
// A skeleton comes up RAISE_WARN_MS after the floor cracks, the first
// RAISE_FIRST_MS after the rage begins and then every RAISE_MS.
export const RAISE_FIRST_MS = 1800;
export const RAISE_MS = 5200;
export const RAISE_WARN_MS = 800;
export const MAX_BONY = 2;

const WINDUPS = freeze({ volley: BONES_WINDUP_MS, slam: BONES_WINDUP_MS, skull: SKULL_WINDUP_MS, rain: RAIN_WINDUP_MS });
const ACTS = freeze(["volley", "slam", "skull"]);
const RAGE_ACTS = freeze([...ACTS, "rain"]);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// The next attack: any open to him at random, but never one three times
// running, and the first a volley.
export function pickAct(b, random) {
  if (!b.attacks) return "volley";
  const open = (b.raged ? RAGE_ACTS : ACTS).filter((a) => !(b.last && b.last[0] === a && b.last[1] === a));
  return open[Math.min(open.length - 1, Math.floor(random() * open.length))];
}

// Skeletons about, or about to come up.
const bony = (round) => round.monsters.filter((m) => !m.dead && m.kind === "skeleton").length + round.hazards.filter((h) => h.kind === "raise").length;

const sendWaves = (round, b, floor) => {
  for (const d of [-1, 1]) round.waves.push({ x: b.x + d * (b.w / 2), y: floor, dir: d, life: 6000 });
};

// The skull leaves his neck level at your chest (a shelf's, if you stand on
// one), and turns SKULL_REACH past you.
function throwSkull(round, b, k) {
  const you = round.you;
  const spec = round.spec;
  const dir = Math.sign(you.x - b.x) || b.dir;
  const x = b.x + dir * 1.2;
  const base = you.state === "run" ? you.y : k.groundAt(spec, you.x);
  const fy = (base > -Infinity ? base : k.groundAt(spec, b.x)) + k.SHOT_Y;
  let turn = clamp(you.x + dir * SKULL_REACH, spec.arena + 1, spec.length - 1);
  if ((turn - x) * dir < 6) turn = x + dir * 6;
  round.hazards.push({ kind: "skull", x, y: fy - SKULL_R, w: SKULL_R * 2, h: SKULL_R * 2, fy, dir, mv: dir, turn, state: "out", d0: 1, spin: 0, stagger: 0, live: 1, cause: "skull" });
  b.headless = true;
  round.events.push({ type: "skullThrow", kind: b.kind, x, y: fy });
}

// Bolts that meet the skull in flight are used up on it; the first of each
// stagger does SKULL_HIT.
function skullShots(round, b, k) {
  for (const h of round.hazards) {
    if (h.kind !== "skull") continue;
    for (let i = round.shots.length - 1; i >= 0; i--) {
      const s = round.shots[i];
      if (Math.hypot(s.x - h.x, s.y - h.fy) > SKULL_R + 0.9) continue;
      round.shots.splice(i, 1);
      if (h.stagger > 0) continue;
      h.stagger = SKULL_STAGGER_MS;
      k.hurtBoss(round, SKULL_HIT, "skull");
      if (b.state !== "fight") return;
    }
  }
}

// RAIN_N bones thrown up, each coming down on its own spot around you.
function bonesUp(round, b, random, k) {
  const you = round.you;
  const spec = round.spec;
  for (let i = 0; i < RAIN_N; i++) {
    const x = clamp(you.x + (i - (RAIN_N - 1) / 2) * RAIN_SPREAD + (random() - 0.5) * 3, spec.arena + 2, spec.length - 2);
    const y = k.groundAt(spec, x);
    if (y === -Infinity) continue;
    const warn = RAIN_WARN_MS + ((i * 2) % RAIN_N) * RAIN_STAGGER_MS;
    round.hazards.push({ kind: "rain", x, y, w: RAIN_W, h: RAIN_H, warn, span: warn, live: 0, cause: "rain" });
  }
  round.events.push({ type: "rainThrow", kind: b.kind, x: b.x, y: b.y + b.h });
}

// The floor cracks somewhere near you, clear of him, for a skeleton to come up.
function crackFloor(round, b, random, k) {
  const you = round.you;
  const spec = round.spec;
  const lo = spec.arena + 2;
  const hi = spec.length - 2;
  const side = random() < 0.5 ? -1 : 1;
  let x = clamp(you.x + side * (9 + random() * 5), lo, hi);
  if (Math.abs(x - you.x) < 6 || Math.abs(x - b.x) < b.w / 2 + 3) x = clamp(you.x - side * 11, lo, hi);
  const y = k.groundAt(spec, x);
  if (y === -Infinity) return;
  round.hazards.push({ kind: "raise", x, y, w: 3, h: 0.1, warn: RAISE_WARN_MS, live: 0, cause: "raise" });
  round.events.push({ type: "raiseWind", kind: b.kind, x, y });
}

function moveBones(round, b, ms, random, k) {
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  const floor = k.groundAt(spec, b.x);
  b.dir = Math.sign(you.x - b.x) || b.dir;
  skullShots(round, b, k);
  if (b.state !== "fight") return;
  // At half his hp: he shakes where he stands and his eyes flare.
  if (!b.raged && b.hp <= b.max * BONES_RAGE) {
    b.raged = true;
    b.shake = BONES_SHAKE_MS;
    b.windup = 0;
    b.act = "";
    b.raiseIn = RAISE_FIRST_MS;
    round.events.push({ type: "bonesRage", kind: b.kind, x: b.x, y: b.y + b.h / 2 });
  }
  if (b.shake > 0) {
    b.shake = Math.max(0, b.shake - ms);
    if (!b.shake) b.t = 0;
    return;
  }
  if (b.echo > 0) {
    b.echo -= ms;
    if (b.echo <= 0) {
      sendWaves(round, b, floor);
      round.events.push({ type: "slam", kind: b.kind, x: b.x, y: b.y, big: false, echo: true });
    }
  }
  if (b.raged) {
    b.raiseIn -= ms;
    if (b.raiseIn <= 0) {
      if (bony(round) < MAX_BONY) {
        crackFloor(round, b, random, k);
        b.raiseIn = RAISE_MS;
      } else b.raiseIn = 500;
    }
  }
  if (b.windup > 0) {
    b.windup = Math.max(0, b.windup - ms);
    if (b.windup) return;
    if (b.act === "slam") {
      sendWaves(round, b, floor);
      round.events.push({ type: "slam", kind: b.kind, x: b.x, y: b.y, big: true });
      if (b.raged) b.echo = DOUBLE_GAP_MS;
    } else if (b.act === "skull") throwSkull(round, b, k);
    else if (b.act === "rain") bonesUp(round, b, random, k);
    else for (const s of VOLLEY) k.throwBone(round, b.x + b.dir * 2, b.y + b.h * 0.8, s, "bone", b.kind);
    b.t = 0;
    return;
  }
  const side = Math.sign(b.x - you.x) || 1;
  const goal = clamp(you.x + side * BONES_KEEP, k.arenaMin(round, b), k.arenaMax(round, b));
  if (Math.abs(goal - b.x) > 1) b.x += Math.sign(goal - b.x) * 5 * pace * (ms / 1000);
  // Headless, he waits for his skull to come home.
  if (b.headless || b.t < (b.raged ? BONES_RAGE_MS : BONES_MS) / pace) return;
  const act = pickAct(b, random);
  b.attacks++;
  b.last = [b.last ? b.last[1] : "", act];
  b.act = act;
  b.windup = WINDUPS[act];
  if (act === "skull") round.events.push({ type: "skullWind", kind: b.kind, x: b.x, y: b.y + b.h * 0.9 });
  else if (act === "rain") round.events.push({ type: "rainWind", kind: b.kind, x: b.x, y: b.y + b.h });
  else round.events.push({ type: "windup", x: b.x, y: b.y, boss: true, act });
}

// The skull in flight: out level at your chest, slowing into its turn, then
// back curving up to his neck, quickening. Caught, he has his head again.
function stepSkull(round, h, ms, k) {
  const b = round.boss;
  if (!b || b.state !== "fight") return false;
  const dt = ms / 1000;
  const pace = round.spec.pace;
  h.spin += dt * 14;
  h.stagger = Math.max(0, h.stagger - ms);
  if (h.state === "out") {
    const left = (h.turn - h.x) * h.dir;
    const step = SKULL_V * pace * (0.35 + 0.65 * clamp(left / 8, 0, 1)) * dt;
    h.x += h.dir * Math.min(left, step);
    if (left - step <= 0.01) {
      h.state = "back";
      h.d0 = Math.max(4, Math.abs(h.x - b.x));
      round.events.push({ type: "skullTurn", kind: b.kind, x: h.x, y: h.fy });
    }
    return true;
  }
  const d = Math.abs(b.x - h.x);
  const p = clamp(1 - d / h.d0, 0, 1);
  const step = SKULL_V * pace * (0.5 + 0.7 * p) * dt;
  h.mv = Math.sign(b.x - h.x) || h.mv;
  h.x += h.mv * Math.min(d, step);
  h.fy += (b.y + b.h * 0.9 - h.fy) * p * p * p * Math.min(1, dt * 14);
  h.y = h.fy - SKULL_R;
  if (d - step > 0.6) return true;
  b.headless = false;
  b.t = 0;
  round.events.push({ type: "skullBack", kind: b.kind, x: b.x, y: b.y + b.h * 0.9 });
  return false;
}

// A falling bone: its shadow for `warn`, then it lands (hurting, RAIN_LIVE_MS)
// and lies there as long again.
function stepRain(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = RAIN_LIVE_MS;
    round.events.push({ type: "rainLand", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > -RAIN_LIVE_MS;
}

// The floor cracks, then a skeleton comes up through it.
function stepRaise(round, h, ms, k) {
  h.warn = Math.max(0, h.warn - ms);
  if (h.warn > 0) return true;
  k.spawnMonster(round, "skeleton", h.x, h.y, { force: true, awake: true });
  round.events.push({ type: "raised", x: h.x, y: h.y });
  return false;
}

export const BONES = freeze({
  id: "bones",
  bosses: BOSSES,
  boss: freeze({ bones: moveBones }),
  hazards: freeze({ skull: stepSkull, rain: stepRain, raise: stepRaise }),
});
