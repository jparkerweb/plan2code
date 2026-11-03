// Plan2Code Web Console - Ghoul Rush's monsters: spawning them, how each kind walks, hops, climbs and swoops, and what they throw.
//
// One of the parts of ghoul.js (see its header and the list of parts there).

import { CHANDELIER_Y, FIELD_W } from "./ghoul-rooms.js";
import { hurt } from "./ghoul-fight.js";
import { footing, groundAt, landing, leftEdge, shelfThere, wallAt } from "./ghoul-planny.js";
import { KIT } from "./ghoul-kit.js";
import { BAT_NEAR, BAT_STEER, BAT_TURN, BONE_G, BONE_V, BONE_VX, BOUND_UP, BOUND_V, CLIMBERS, CLIMB_V, FALL_MAX, GHOST_APPEAR_MS, GHOST_CLEAR, GHOST_HIDE_MS, GHOST_SHOW_MS, GRAVITY, HEAVY, HIT_W, HOP_IN, HOP_V, HOUND_CROUCH_MS, HOUND_LUNGE_V, HOUND_LUNGE_VX, HOUND_RANGE, HOUND_REST_MS, HUNT_CROUCH_MS, HUNT_HIGH, HUNT_RANGE, HUNT_REST_MS, HUNT_UP, HUNT_VX, LURCH_RANGE, MAX_MONSTERS, MONSTERS, PIT_Y, PONDER_MS, PONDER_STEP_MS, PUDDLE_MS, RISE_MS, RUNNER_WARN, SEED_LAND_MS, SHOT_Y, SKEL_MS, SKEL_NEAR, SKEL_RANGE, SKEL_WINDUP_MS, SPIDER_DROP_V, SPIDER_NEAR, SPIT_KEEP, SPIT_MS, SPIT_RANGE, SPIT_WINDUP_MS, STACKERS, STACK_MIN, STACK_NEAR, STACK_REACH, STACK_STEP, STEP_UP, SWOOP_CLEAR, SWOOP_NEAR, UNSTACK_V, WALKERS, WALL_MAX, WALL_V, WAVE_SPEED, WRAITH_ABOVE, WRAITH_DIVE_V, WRAITH_HOVER_MS, WRAITH_KEEP, WRAITH_NEAR, WRAITH_PAST, WRAITH_WIND_MS, YOU_H, ZOMBIES, bounds, clamp, fromPacks, hopReach, listPacks } from "./ghoul-tables.js";

/* ------------------------------------------------------------ monsters */

let serial = 0;
// The next id, for what the other parts make (a module's binding can only be changed from inside it).
export const nextSerial = () => ++serial;

// A monster of `kind` at (x, y), facing you; `over` adds or replaces fields.
export function spawnMonster(round, kind, x, y, over = {}) {
  if (round.monsters.length >= MAX_MONSTERS && !over.force) return null;
  const def = MONSTERS[kind];
  const spec = round.spec;
  const extra = ZOMBIES.has(kind) || kind === "skeleton" || kind === "hound" || kind === "spitter" || kind === "huntsman" ? spec.tough : 0;
  const m = {
    id: ++serial,
    kind,
    x,
    y,
    w: def.w,
    h: def.h,
    hp: def.hp + extra,
    max: def.hp + extra,
    vx: 0,
    vy: 0,
    dir: round.you.x < x ? -1 : 1,
    t: 0,
    rise: kind === "crawler" ? RISE_MS : 0,
    awake: kind !== "bat",
    act: ACT_START[kind] || "",
    wait: 0,
    phase: 0,
    throwIn: (kind === "spitter" ? SPIT_MS : SKEL_MS) * 0.45,
    windup: 0,
    hurt: 0,
    home: y,
    lift: 0,
    ...over,
  };
  delete m.force;
  round.monsters.push(m);
  round.events.push({ type: "spawn", kind, x, y });
  return m;
}

// What a hellhound, a widow and a wraith start out doing.
const ACT_START = Object.freeze({ hound: "prowl", spider: "hang", wraith: "idle", huntsman: "prowl", ...fromPacks("act") });
// The packs' rules by kind: whether one is solid, its moving, what its death
// leaves, what a horde one comes in with; a boss's fight, whether it shrugs
// off a hit, and each kind of hazard a boss leaves on the field.
const SOLIDS = fromPacks("solid");
const MOVERS = fromPacks("move");
export const ON_KILL = fromPacks("kill");
export const HORDE_WITH = fromPacks("horde");
export const BOSS_MOVERS = fromPacks("boss");
const GUARDS = fromPacks("guard");
export const HAZARDS = fromPacks("hazards");
// Kinds the Hedge Shears kill outright, a boss's weak spot (the damage
// multiplier of a shot) and what a boss's touch is called when it costs a life.
export const CUT = new Set(listPacks("cut"));
export const WEAK = fromPacks("weak");
export const CAUSES = fromPacks("cause");
// Kinds that are stone just now (a shot glances off), a stage-wide twist run
// each slice (the Chapel's bell, which may set `round.stunMs`), what a bolt
// that hit a monster does besides its damage, and what else a bolt can strike.
export const STONE = fromPacks("stone");
export const TICKS = listPacks("tick");
export const SHOTS = listPacks("shot");
export const TARGETS = listPacks("target");
// What a pack does to carry Planny itself (the Runaway Cart's ride: a hook that
// returns true has moved him), and when he is put down in a room (a room set up,
// a respawn).
export const RIDES = listPacks("ride");
export const PLACES = listPacks("place");
export const POINTERS = listPacks("pointer");
// Kinds that are out of sight just now (a shot goes through, a touch does
// nothing), that hurt nothing by touch, that Planny can stand on, and what a
// missile of a kind does where it lands (see ghoul-sanatorium.js).
const UNSEEN = fromPacks("unseen");
export const HARMLESS = fromPacks("harmless");
const LANDS = fromPacks("land");
// Whether the boss shrugs off shots and stomps just now.
export const guarded = (b) => Boolean(GUARDS[b.kind] && GUARDS[b.kind](b));

// Whether a monster can be hit and can hurt: a crawler or a door's zombie
// still coming up, a gourdling still in the air, a faded ghost and a wraith
// not yet come cannot.
export function solid(m) {
  if (m.unseen) return false;
  if (SOLIDS[m.kind]) return SOLIDS[m.kind](m);
  if (m.kind === "crawler" || ZOMBIES.has(m.kind)) return m.rise <= 0;
  // A gourdling flung out of the Gourd is harmless till it lands and finds its feet.
  if (m.kind === "seed") return m.vy === 0 && m.rise <= 0;
  if (m.kind === "ghost") {
    const t = (m.t + m.phase) % (GHOST_SHOW_MS + GHOST_HIDE_MS);
    return t >= GHOST_APPEAR_MS && t < GHOST_SHOW_MS;
  }
  if (m.kind === "wraith") return m.act !== "idle";
  return true;
}

// Whether a monster is up and after you: solid, and not a roosting bat or a
// widow still on the ceiling.
export const roused = (m) => (m.kind !== "bat" || m.awake) && !(m.kind === "spider" && m.act === "hang") && solid(m);

// The ghost's share of full sight, 0 to 1, for the drawing.
export function ghostSight(m) {
  const t = (m.t + m.phase) % (GHOST_SHOW_MS + GHOST_HIDE_MS);
  if (t < GHOST_APPEAR_MS) return t / GHOST_APPEAR_MS;
  if (t < GHOST_SHOW_MS) return 1;
  const fade = Math.min(1, (t - GHOST_SHOW_MS) / 250);
  return 1 - fade * 0.88;
}

// Within UNDER_DX of straight under (or over) you a monster stops where it
// is, still facing the way it went, rather than turning back and forth
// every frame; once you move off it turns and comes on.
export const UNDER_DX = 1;
export const towardYou = (round, m) => (Math.abs(round.you.x - m.x) < UNDER_DX ? m.dir : Math.sign(round.you.x - m.x) || m.dir);

// A walker's step toward `dx` (the sign of the way it goes) at `speed`:
// never off an edge or up a wall; it stands and sways instead, or at a pit
// narrow enough, thinks about it and then leaps (ponder). Under you, it
// stands (UNDER_DX).
export function walk(round, m, dir, speed, dt) {
  // One up a pile is moved by the pile.
  if (!dir || m.lift > 0 || Math.abs(round.you.x - m.x) < UNDER_DX) return;
  if (m.dir !== dir) m.ponder = 0;
  m.dir = dir;
  const nx = m.x + dir * speed * dt;
  if (wallAt(round.spec, nx + dir * m.w * 0.4, m.y + STEP_UP)) return wall(round, m, nx + dir * m.w * 0.4, dir, dt);
  // Walkers keep to the ground, but cross a board laid level with it over a
  // pit (a bridge) while it is there; never up onto a shelf.
  const f = footing(round, nx, m.y);
  // A gourdling runs straight off a shelf's end after you.
  if (!f && m.kind === "seed" && Number.isFinite(groundAt(round.spec, nx)) && groundAt(round.spec, nx) < m.y) {
    m.hop = { vx: dir * speed, vy: 6 };
    return;
  }
  if (!f) return ponder(round, m, nx, dir, dt);
  if (f.shelf >= 0 && Math.abs(f.y - m.y) > 0.01) return;
  m.ponder = 0;
  m.x = nx;
  m.y = f.y;
}

// A leap's time in the air, rising at `v`, to come down `drop` below where it
// left (a negative drop is floor above it).
const hopTime = (drop, v) => (v + Math.sqrt(v * v + 2 * GRAVITY * drop)) / GRAVITY;

// Where a leap from the edge at `nx` going `dir` lands, as { x, y, t, v }:
// HOP_IN past the first floor no higher than a step up (BOUND_UP on four legs) that a leap reaches
// (hopReach across on the level, more the further down); null for floor out
// of reach, too high, or past the arena's wall.
export function farSide(round, m, nx, dir) {
  const spec = round.spec;
  if (groundAt(spec, nx) >= m.y - STEP_UP) return null;
  const bound = bounds(m);
  const v = bound ? BOUND_V : HOP_V;
  const up = bound ? BOUND_UP : STEP_UP;
  const flat = hopTime(0, v);
  const reach = hopReach(m);
  for (let d = 0; d <= reach * 2; d += 0.5) {
    const x = nx + dir * d;
    const g = groundAt(spec, x);
    if (!Number.isFinite(g)) continue;
    if (g > m.y + up) return null;
    const t = hopTime(bound ? m.y - g : Math.max(0, m.y - g), v);
    if (d > (reach * t) / flat) return null;
    const to = x + dir * HOP_IN;
    const left = round.lockX >= 0 ? round.lockX + 2 : 2;
    return to >= left && to <= spec.length - 2 && groundAt(spec, to) === g ? { x: to, y: g, t, v } : null;
  }
  return null;
}

// Whether a walker has stood thinking long enough (a "ponder" event as it
// starts).
function thought(round, m, dt) {
  if (!m.ponder) round.events.push({ type: "ponder", x: m.x, y: m.y + m.h });
  m.ponder = (m.ponder || 0) + dt * 1000;
  if (m.ponder < PONDER_MS + (m.id % 4) * PONDER_STEP_MS) return false;
  m.ponder = 0;
  return true;
}

// A walker at a pit's edge: it stands thinking, then leaps across. One too
// heavy to leap still steps off a ledge onto the floor below.
function ponder(round, m, nx, dir, dt) {
  const below = groundAt(round.spec, nx);
  if (HEAVY.has(m.kind) && Number.isFinite(below) && below < m.y) {
    m.ponder = 0;
    m.hop = { vx: dir * MONSTERS[m.kind].speed * round.spec.pace, vy: 0 };
    return;
  }
  const to = HEAVY.has(m.kind) ? null : farSide(round, m, nx, dir);
  if (!to) {
    m.ponder = 0;
    return;
  }
  if (!thought(round, m, dt)) return;
  m.hop = { vx: (to.x - m.x) / to.t, vy: to.v };
  round.events.push({ type: "leap", kind: m.kind, x: m.x, y: m.y });
}

// A climber at a wall (its face at `wx`): it stands thinking, then climbs.
function wall(round, m, wx, dir, dt) {
  const spec = round.spec;
  const top = groundAt(spec, wx);
  if (!CLIMBERS.has(m.kind) || !Number.isFinite(top) || top - m.y > WALL_MAX) {
    m.ponder = 0;
    return;
  }
  if (!thought(round, m, dt)) return;
  const on = wx + dir * (m.w / 2 + 0.3);
  m.scale = { top, x: groundAt(spec, on) === top ? on : wx + dir * 0.5 };
  round.events.push({ type: "scale", kind: m.kind, x: m.x, y: m.y });
}

// A walker up a wall: on up its face, then onto the floor at its top.
function scaleOn(m, dt) {
  m.y += WALL_V * dt;
  if (m.y < m.scale.top) return;
  m.y = m.scale.top;
  m.x = m.scale.x;
  m.scale = null;
}

// A walker in the air: down onto the floor or shelf it crosses, or into
// the dark below.
function hopOn(round, m, dt) {
  const py = m.y;
  m.hop.vy = Math.max(-FALL_MAX, m.hop.vy - GRAVITY * dt);
  m.x += m.hop.vx * dt;
  m.y += m.hop.vy * dt;
  const f = m.hop.vy < 0 ? landing(round, m.x, py, m.y, -1) : null;
  if (f) {
    m.y = f.y;
    m.hop = null;
  } else if (m.y < PIT_Y) m.dead = true;
}

// Gourdlings chase you up and down the shelves: with you above, one under a
// shelf no more than SEED_REACH over it crouches SEED_CROUCH_MS and jumps up
// onto it (toward where you are along it), SEED_JUMP_MS between jumps; with
// you below, it runs off its shelf's end and drops (see walk).
export const SEED_REACH = 13;
export const SEED_CROUCH_MS = 250;
export const SEED_JUMP_MS = 700;
function seedJump(round, m, ms) {
  const you = round.you;
  m.jumpIn = Math.max(0, (m.jumpIn || 0) - ms);
  if (m.crouch > 0) {
    m.crouch = Math.max(0, m.crouch - ms);
    if (m.crouch > 0) return true;
    const vy = Math.sqrt(2 * GRAVITY * (m.to.top - m.y + 2));
    const t = (vy + Math.sqrt(2 * GRAVITY * 2)) / GRAVITY;
    m.hop = { vx: (m.to.x - m.x) / t, vy };
    m.dir = Math.sign(m.to.x - m.x) || m.dir;
    m.jumpIn = SEED_JUMP_MS;
    round.events.push({ type: "leap", kind: m.kind, x: m.x, y: m.y });
    return true;
  }
  if (m.jumpIn > 0 || you.y < m.y + 2.5 || Math.abs(you.x - m.x) > 40) return false;
  let to = null;
  round.spec.shelves.forEach(([x0, x1, top], i) => {
    if (!shelfThere(round, i) || top <= m.y + 2 || top > m.y + SEED_REACH || top > you.y + 1) return;
    const x = clamp(you.x, x0 + 1.2, x1 - 1.2);
    if (Math.abs(x - m.x) > 12) return;
    if (!to || Math.abs(top - you.y) < Math.abs(to.top - you.y)) to = { top, x };
  });
  if (!to) return false;
  m.to = to;
  m.crouch = SEED_CROUCH_MS;
  return true;
}

// A thrown bone (or glob of acid, `kind`) from (x, y) at your chest: its
// flight timed to come down there, across no faster than BONE_VX. `by`, the
// thrower's kind, rides on the "throw" event so each thrower sounds its own.
export function throwBone(round, x, y, scale = 1, kind = "bone", by = null) {
  const you = round.you;
  const dy = you.y + 2 - y;
  const disc = BONE_V * BONE_V - 2 * BONE_G * dy;
  const t = disc > 0 ? (BONE_V + Math.sqrt(disc)) / BONE_G : (2 * BONE_V) / BONE_G;
  const vx = clamp(((you.x - x) / t) * scale, -BONE_VX * scale, BONE_VX * scale);
  const b = { id: ++serial, kind, x, y, vx, vy: BONE_V, spin: 0, life: 4000 };
  round.bones.push(b);
  round.events.push({ type: "throw", kind, by, x, y });
  return b;
}

// One slice of each monster's moving, by kind.
export function moveMonsters(round, slice, random) {
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  for (const m of round.monsters) {
    // A choir ghost's song (`hasteMs`) runs a monster's time `haste` times as fast.
    const ms = m.hasteMs > 0 ? slice * m.haste : slice;
    const dt = ms / 1000;
    if (UNSEEN[m.kind]) m.unseen = Boolean(UNSEEN[m.kind](round, m));
    if (m.hasteMs > 0) m.hasteMs -= slice;
    // A faded ghost never turns solid on top of you: it waits till you are clear.
    if (!(m.kind === "ghost" && !solid(m) && Math.abs(you.x - m.x) < GHOST_CLEAR && Math.abs(you.y + YOU_H / 2 - (m.y + m.h / 2)) < GHOST_CLEAR)) m.t += ms;
    m.hurt = Math.max(0, m.hurt - ms);
    // Dazed by Flash Powder or held by a Bear Trap (ghoul-arms.js): shown a while, and still deadly to touch.
    if (m.litMs > 0) m.litMs -= slice;
    if (m.stunMs > 0) {
      m.stunMs -= slice;
      continue;
    }
    if (m.hop) {
      hopOn(round, m, dt);
      continue;
    }
    if (m.scale) {
      scaleOn(m, dt);
      continue;
    }
    // A bridge gone from under a walker: it drops into the pit.
    if (WALKERS.has(m.kind) && m.rise <= 0 && !m.vy && !(m.lift > 0) && !footing(round, m.x, m.y)) {
      m.hop = { vx: 0, vy: 0 };
      hopOn(round, m, dt);
      continue;
    }
    if (MOVERS[m.kind]) {
      MOVERS[m.kind](round, m, ms, KIT);
      continue;
    }
    const dx = you.x - m.x;
    const toward = towardYou(round, m);
    if (ZOMBIES.has(m.kind)) {
      if (m.kind === "runner" && !m.warned && m.x > round.camX - RUNNER_WARN && m.x < round.camX + FIELD_W + RUNNER_WARN) {
        m.warned = true;
        round.events.push({ type: "runner", x: clamp(m.x, round.camX + 3, round.camX + FIELD_W - 3), y: m.y + m.h, side: Math.sign(m.x - you.x) || 1 });
      }
      if (m.rise > 0) {
        m.rise = Math.max(0, m.rise - ms);
        continue;
      }
      const near = Math.abs(dx) < LURCH_RANGE && Math.abs(you.y - m.y) < 6;
      walk(round, m, toward, (near ? MONSTERS[m.kind].lurch : MONSTERS[m.kind].speed) * pace, dt);
      m.lurching = near;
    } else if (m.kind === "crawler" || m.kind === "seed") {
      if (m.rise > 0) {
        m.rise = Math.max(0, m.rise - ms);
        continue;
      }
      if (m.kind === "seed" && m.vy !== 0) {
        // Flung out of the Gourd: in the air till it lands.
        m.vy -= GRAVITY * dt;
        const py = m.y;
        const nx = clamp(m.x + m.vx * dt, round.lockX >= 0 ? round.lockX + 2 : 2, spec.length - 2);
        m.x = nx;
        m.y += m.vy * dt;
        const f = m.vy < 0 ? landing(round, m.x, py, m.y, -1) : null;
        if (f) {
          m.y = f.y;
          m.vy = 0;
          m.vx = 0;
          // A moment to find its feet before it runs at you.
          m.rise = SEED_LAND_MS;
        }
        if (m.y < PIT_Y) m.dead = true;
        continue;
      }
      if (m.kind === "seed" && seedJump(round, m, ms)) continue;
      walk(round, m, toward, MONSTERS[m.kind].speed * pace, dt);
    } else if (m.kind === "bat") {
      if (!m.awake) {
        if (Math.abs(dx) < BAT_NEAR) {
          m.awake = true;
          round.events.push({ type: "bat", x: m.x, y: m.y });
        }
        continue;
      }
      // Swoops: level passes at your chest, turning BAT_TURN past you and
      // climbing a little before it comes back down for the next.
      const speed = MONSTERS.bat.speed * pace;
      if (!m.pass) m.pass = toward;
      const ahead = (m.x - you.x) * m.pass;
      if (ahead > BAT_TURN) {
        m.pass = -m.pass;
        m.climb = 300;
      }
      m.climb = Math.max(0, (m.climb || 0) - ms);
      const ty = m.climb > 0 ? you.y + 12 : you.y + SHOT_Y - MONSTERS.bat.h / 2;
      // Once close it holds its height: it never drops onto your head.
      const close = Math.abs(dx) <= 9 && m.climb <= 0;
      const steer = close ? 0 : clamp((ty - m.y) * 5, -BAT_STEER, BAT_STEER);
      m.vx = clamp(m.vx + m.pass * BAT_STEER * 2 * dt, -speed, speed);
      m.vy = clamp(m.vy + (steer - m.vy) * Math.min(1, (close ? 20 : 6) * dt), -speed * 0.8, speed * 0.8);
      m.x += m.vx * dt;
      m.y = Math.max(groundAt(spec, m.x) + 0.6, Math.min(CHANDELIER_Y, m.y + (m.vy + Math.sin(m.t / 140) * 1.5) * dt));
      m.dir = Math.sign(m.vx) || m.dir;
    } else if (m.kind === "ghost") {
      const speed = MONSTERS.ghost.speed * pace;
      const ty = you.y + 1;
      const d = Math.hypot(dx, ty - m.y) || 1;
      m.x += (dx / d) * speed * dt;
      m.y += ((ty - m.y) / d) * speed * dt;
      m.dir = toward;
    } else if (m.kind === "hound") moveHound(round, m, ms, toward);
    else if (m.kind === "spider") moveSpider(round, m, ms, toward);
    else if (m.kind === "huntsman") moveHuntsman(round, m, ms, toward);
    else if (m.kind === "wraith") moveWraith(round, m, ms);
    else if (m.kind === "spitter") {
      m.dir = toward;
      if (m.windup > 0) {
        m.windup = Math.max(0, m.windup - ms);
        if (!m.windup) throwBone(round, m.x + m.dir * 1.8, m.y + m.h * 0.7, 0.9 + random() * 0.2, "acid", m.kind);
        continue;
      }
      if (Math.abs(dx) > SPIT_KEEP) walk(round, m, toward, MONSTERS.spitter.speed * pace, dt);
      const inView = m.x > round.camX - 2 && m.x < round.camX + FIELD_W + 2;
      if (!inView || Math.abs(dx) > SPIT_RANGE || Math.abs(dx) < SKEL_NEAR) continue;
      m.throwIn -= ms * pace;
      if (m.throwIn <= 0) {
        m.throwIn = SPIT_MS * (0.85 + random() * 0.3);
        m.windup = SPIT_WINDUP_MS;
        round.events.push({ type: "spit", kind: m.kind, x: m.x, y: m.y });
      }
    } else if (m.kind === "skeleton") {
      m.dir = toward;
      const inView = m.x > round.camX - 2 && m.x < round.camX + FIELD_W + 2;
      if (m.windup > 0) {
        m.windup = Math.max(0, m.windup - ms);
        if (!m.windup) throwBone(round, m.x + m.dir * 1.2, m.y + m.h * 0.85, 0.9 + random() * 0.2, "bone", m.kind);
        continue;
      }
      if (!inView || Math.abs(dx) > SKEL_RANGE || Math.abs(dx) < SKEL_NEAR) continue;
      m.throwIn -= ms * pace;
      if (m.throwIn <= 0) {
        m.throwIn = SKEL_MS * (0.85 + random() * 0.3);
        m.windup = SKEL_WINDUP_MS;
        round.events.push({ type: "windup", x: m.x, y: m.y });
      }
    }
  }
  skimOver(round);
}

// What swoops, and when: a ducked Planny is passed overhead (see SWOOP_CLEAR).
const SWOOPS = Object.freeze({ bat: () => true, wraith: (m) => m.act === "dive", ...fromPacks("swoops") });

// Holds each swooper near a ducked Planny on a ramp up over his head. A ramp by
// distance, not a rate, so no dive is too fast for it.
function skimOver(round) {
  const you = round.you;
  if (!you.ducking) return;
  for (const m of round.monsters) {
    if (m.dead || !SWOOPS[m.kind]?.(m)) continue;
    const short = Math.abs(m.x - you.x) - (HIT_W + m.w * 0.8) / 2;
    if (short > SWOOP_NEAR || m.y < you.y - 1) continue;
    m.y = Math.max(m.y, you.y + SWOOP_CLEAR - Math.max(0, short));
  }
}

// The piles: walkers on the same floor in a run each within STACK_NEAR of
// the next, STACK_MIN or more of them, climb over each other toward you
// while you are above and near; every walker not in a climbing pile comes
// back down. Returns the piles found, oldest walker first in each, for the
// unit suite.
export function piles(round, ms) {
  const dt = ms / 1000;
  const you = round.you;
  const floorOf = (m) => m.y - (m.lift || 0);
  const walkers = round.monsters.filter((m) => STACKERS.has(m.kind) && !m.dead && solid(m) && !m.vy && !m.hop && !m.scale);
  walkers.sort((a, b) => a.x - b.x);
  const found = [];
  let run = [];
  const close = () => {
    if (run.length >= STACK_MIN) found.push(run.slice().sort((a, b) => a.id - b.id));
    run = [];
  };
  for (const m of walkers) {
    const last = run[run.length - 1];
    if (last && (m.x - last.x > STACK_NEAR || Math.abs(floorOf(m) - floorOf(last)) > 0.5)) close();
    run.push(m);
  }
  close();
  const target = new Map();
  const pileOf = new Map();
  for (const pile of found) {
    const base = pile[0];
    const floor = floorOf(base);
    const need = you.y - floor;
    if (need < base.h * 0.5 || Math.abs(you.x - base.x) > STACK_REACH || you.out > 0) continue;
    let lift = 0;
    pile.forEach((m, i) => {
      if (i > 0 && lift + STACK_STEP * pile[i - 1].h <= need) lift += STACK_STEP * pile[i - 1].h;
      target.set(m, lift);
      pileOf.set(m, pile);
    });
    if (!round.climbSeen && pile.some((m) => m.lift > 1)) {
      round.climbSeen = true;
      round.events.push({ type: "climb", x: base.x, y: floor + lift });
    }
  }
  for (const m of round.monsters) {
    if (!STACKERS.has(m.kind) || m.dead) continue;
    const want = target.get(m) ?? 0;
    if (!m.lift && !want) continue;
    const floor = floorOf(m);
    m.lift = want > m.lift ? Math.min(want, m.lift + CLIMB_V * dt) : Math.max(want, m.lift - UNSTACK_V * dt);
    m.y = floor + m.lift;
    if (want > 0 && m.lift > 0) {
      // Up the pile: drawn in over the one at the bottom, a little to one side.
      const pile = pileOf.get(m);
      const sway = pile.indexOf(m) % 2 ? 0.35 : -0.35;
      m.x += (pile[0].x + sway - m.x) * Math.min(1, 6 * dt);
      m.dir = towardYou(round, m);
    }
  }
  return found;
}

// A hellhound: prowls toward you, crouches growling once close on your
// level, lunges in a low arc, and rests a moment after it lands. One that
// lunges into a pit is gone.
function moveHound(round, m, ms, toward) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "leap") {
    const py = m.y;
    const nx = m.x + m.vx * dt;
    if (!wallAt(spec, nx + Math.sign(m.vx) * m.w * 0.4, m.y + 0.05)) m.x = nx;
    m.vy = Math.max(-FALL_MAX, m.vy - GRAVITY * dt);
    m.y += m.vy * dt;
    const g = groundAt(spec, m.x);
    if (m.vy < 0 && py >= g && m.y <= g) Object.assign(m, { y: g, vx: 0, vy: 0, act: "rest", wait: HOUND_REST_MS });
    if (m.y < PIT_Y) m.dead = true;
    return;
  }
  if (m.wait > 0) {
    m.wait = Math.max(0, m.wait - ms * (m.act === "crouch" ? 1 : pace));
    if (m.wait > 0) return;
    if (m.act === "crouch") {
      Object.assign(m, { act: "leap", vx: m.dir * HOUND_LUNGE_VX * pace, vy: HOUND_LUNGE_V });
      round.events.push({ type: "lunge", x: m.x, y: m.y });
      return;
    }
  }
  if (Math.abs(you.x - m.x) < HOUND_RANGE && Math.abs(you.y - m.y) < 5) {
    Object.assign(m, { dir: toward, act: "crouch", wait: HOUND_CROUCH_MS });
    round.events.push({ type: "growl", x: m.x, y: m.y });
    return;
  }
  m.act = "prowl";
  walk(round, m, toward, MONSTERS.hound.speed * pace, dt);
}

// A Huntsman: runs at you along the floor, crouches once close, and springs
// at you, high and fast; one that springs into a pit is gone.
function moveHuntsman(round, m, ms, toward) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "leap") {
    const py = m.y;
    const nx = m.x + m.vx * dt;
    if (!wallAt(spec, nx + Math.sign(m.vx) * m.w * 0.4, m.y + 0.05)) m.x = nx;
    m.vy = Math.max(-FALL_MAX, m.vy - GRAVITY * dt);
    m.y += m.vy * dt;
    const g = groundAt(spec, m.x);
    if (m.vy < 0 && py >= g && m.y <= g) Object.assign(m, { y: g, vx: 0, vy: 0, act: "rest", wait: HUNT_REST_MS });
    if (m.y < PIT_Y) m.dead = true;
    return;
  }
  if (m.wait > 0) {
    m.wait = Math.max(0, m.wait - ms * (m.act === "crouch" ? 1 : pace));
    if (m.wait > 0) return;
    if (m.act === "crouch") return springAt(round, m);
  }
  const up = you.y - m.y;
  if (Math.abs(you.x - m.x) < HUNT_RANGE && up > -3 && up < HUNT_HIGH && you.out <= 0) {
    Object.assign(m, { dir: toward, act: "crouch", wait: HUNT_CROUCH_MS });
    round.events.push({ type: "growl", kind: m.kind, x: m.x, y: m.y });
    return;
  }
  m.act = "prowl";
  walk(round, m, toward, MONSTERS.huntsman.speed * pace, dt);
}

// A Huntsman's spring: up to HUNT_UP over your height, coming down on where
// you are now.
export function springAt(round, m) {
  const you = round.you;
  const rise = Math.max(0, you.y + 1 - m.y);
  const vy = Math.sqrt(2 * GRAVITY * (rise + HUNT_UP));
  const t = (vy + Math.sqrt(2 * GRAVITY * HUNT_UP)) / GRAVITY;
  const vx = clamp((you.x - m.x) / t, -HUNT_VX, HUNT_VX);
  Object.assign(m, { act: "leap", vx, vy, dir: Math.sign(vx) || m.dir, y: m.y + 0.01 });
  round.events.push({ type: "lunge", kind: m.kind, x: m.x, y: m.y });
}

// A widow: hangs from the ceiling till you come near, drops on its thread
// onto whatever is under it, then skitters after you.
function moveSpider(round, m, ms, toward) {
  const you = round.you;
  if (m.act === "hang") {
    if (Math.abs(you.x - m.x) < SPIDER_NEAR && you.y < m.y - 4) {
      m.act = "drop";
      round.events.push({ type: "skitter", x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "drop") {
    const py = m.y;
    m.y -= SPIDER_DROP_V * round.spec.pace * (ms / 1000);
    const f = landing(round, m.x, py, m.y, -1);
    if (f) {
      m.y = f.y;
      m.act = "walk";
    } else if (m.y < PIT_Y) m.dead = true;
    return;
  }
  walk(round, m, toward, MONSTERS.spider.speed * round.spec.pace, ms / 1000);
}

// A wraith: unseen till you come near, then hovers ahead of you, shrieks,
// dives straight at where your chest was and on past, and climbs back to
// hover again. Walls never stop it; the floor turns it.
function moveWraith(round, m, ms) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  if (m.act === "idle") {
    if (Math.abs(you.x - m.x) < WRAITH_NEAR) {
      Object.assign(m, { act: "hover", wait: WRAITH_HOVER_MS * 0.6 });
      round.events.push({ type: "wraith", x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "hover" || m.act === "rise") {
    const side = Math.sign(m.x - you.x) || 1;
    const tx = you.x + side * WRAITH_KEEP;
    const ty = Math.min(m.home, you.y + WRAITH_ABOVE) + Math.sin(m.t / 400) * 1.5;
    const step = MONSTERS.wraith.speed * pace * (m.act === "rise" ? 1.8 : 1) * dt;
    m.x += clamp(tx - m.x, -step * 3, step * 3);
    m.y += clamp(ty - m.y, -step, step);
    m.dir = -side;
    if (m.act === "rise") {
      if (Math.abs(ty - m.y) < 1.5) Object.assign(m, { act: "hover", wait: WRAITH_HOVER_MS });
      return;
    }
    m.wait -= ms * pace;
    const inView = m.x > round.camX + 2 && m.x < round.camX + FIELD_W - 2;
    if (m.wait <= 0 && inView) {
      Object.assign(m, { act: "wind", wait: WRAITH_WIND_MS });
      round.events.push({ type: "shriek", x: m.x, y: m.y });
    }
    return;
  }
  if (m.act === "wind") {
    m.wait -= ms;
    if (m.wait > 0) return;
    const tx = you.x - m.x;
    const ty = you.y + (YOU_H - m.h) / 2 - m.y;
    const d = Math.hypot(tx, ty) || 1;
    Object.assign(m, { act: "dive", vx: (tx / d) * WRAITH_DIVE_V * pace, vy: (ty / d) * WRAITH_DIVE_V * pace, left: d + WRAITH_PAST, dir: Math.sign(tx) || m.dir });
    round.events.push({ type: "dive", x: m.x, y: m.y });
    return;
  }
  m.x += m.vx * dt;
  m.y += m.vy * dt;
  m.left -= Math.hypot(m.vx, m.vy) * dt;
  const floor = groundAt(spec, m.x);
  if (floor > -Infinity && m.y < floor + 0.3) {
    m.y = floor + 0.3;
    m.vy = Math.max(0, m.vy);
  }
  if (m.left <= 0) m.act = "rise";
}

// One slice of the thrown bones and acid, the puddles and the shockwaves.
export function moveMissiles(round, ms) {
  const dt = ms / 1000;
  const spec = round.spec;
  let n = 0;
  for (const b of round.bones) {
    b.vy -= BONE_G * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.spin += dt * 12 * (Math.sign(b.vx) || 1);
    b.life -= ms;
    const g = groundAt(spec, b.x);
    if (b.vy < 0 && b.y <= g) {
      if (b.kind === "acid") {
        round.puddles.push({ id: ++serial, x: b.x, y: g, life: PUDDLE_MS });
        round.events.push({ type: "splash", x: b.x, y: g });
      } else if (!(LANDS[b.kind] && LANDS[b.kind](round, b, g, KIT))) round.events.push({ type: "clatter", x: b.x, y: g });
      continue;
    }
    if (b.life > 0 && b.y > PIT_Y && b.x > round.camX - 20 && b.x < round.camX + FIELD_W + 20) round.bones[n++] = b;
  }
  round.bones.length = n;
  n = 0;
  for (const p of round.puddles) if ((p.life -= ms) > 0) round.puddles[n++] = p;
  round.puddles.length = n;
  n = 0;
  for (const w of round.waves) {
    w.x += w.dir * WAVE_SPEED * spec.pace * dt;
    w.life -= ms;
    if (w.life > 0 && groundAt(spec, w.x) === w.y && w.x > leftEdge(round) - 2 && w.x < spec.length) round.waves[n++] = w;
  }
  round.waves.length = n;
}
