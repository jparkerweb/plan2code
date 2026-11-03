// Plan2Code Web Console - Ghoul Rush's bosses and damage: a boss's fight and fall, hurting and killing a monster, and losing a life.
//
// One of the parts of ghoul.js (see its header and the list of parts there).

import { BONUS_SAFE_MS } from "./ghoul-bonus.js";
import { answerAsk, beginRoll } from "./ghoul-dice.js";
import { ARM_DROP, POWERS, applyPower as applyPowerWith, armDrop, pickPower } from "./ghoul-powers.js";
import { FIELD_W } from "./ghoul-rooms.js";
import { BOSS_MOVERS, HAZARDS, ON_KILL, nextSerial, spawnMonster, throwBone } from "./ghoul-monsters.js";
import { footing, groundAt, landing, leftEdge, rightEdge } from "./ghoul-planny.js";
import { KIT } from "./ghoul-kit.js";
import { BOSSES, BOSS_INTRO_MS, CHAIN_MS, CRASH_MS, DROP_CANDY, DROP_MS, DROP_POWER, FALL_MAX, GARLIC_SAFE_MS, GOURD_ACTS, GOURD_BIG_V, GOURD_HOP_V, GOURD_QUAKE_V, GOURD_SPIT, GOURD_SPIT_MS, GOURD_WAIT_MS, GRAVITY, HIT_H, HIT_W, MAX_SEEDS, MONSTERS, PIT_Y, QUICK_LOSS_MS, SAFE_MS, STRAY_FADE, STRAY_MIN, chainMult, clamp, seeded } from "./ghoul-tables.js";

/* --------------------------------------------------------------- bosses */

// One slice of each hazard by its kind's rule; gone once its rule says so.
export function moveHazards(round, ms) {
  if (!round.hazards.length) return;
  let n = 0;
  for (const h of round.hazards) if (HAZARDS[h.kind] && HAZARDS[h.kind](round, h, ms, KIT)) round.hazards[n++] = h;
  // A hazard that felled the boss has just emptied the list.
  round.hazards.length = Math.min(n, round.hazards.length);
}

export function makeBoss(round) {
  const spec = round.spec;
  const def = BOSSES[spec.boss];
  const x = spec.length - 24;
  return { kind: spec.boss, x, y: groundAt(spec, x), vx: 0, vy: 0, w: def.w, h: def.h, hp: spec.bossHp, max: spec.bossHp, state: "sleep", t: 0, wait: GOURD_WAIT_MS, hops: 0, attacks: 0, windup: 0, act: "", run: 0, landX: x, hurt: 0, dir: -1 };
}

// The arena's ends for the boss: it keeps ARENA_POCKET clear of each, so
// a corner is always somewhere a hop cannot land on you.
export const ARENA_POCKET = 6;
export const arenaMin = (round, b) => round.spec.arena + ARENA_POCKET + b.w / 2;
export const arenaMax = (round, b) => round.spec.length - ARENA_POCKET - b.w / 2;

// The Gourd's next move: any of GOURD_ACTS at random, but never one three
// times running (and only a spit at you up on a balcony over its head).
export function gourdAct(b, random) {
  let act = GOURD_ACTS[Math.floor(random() * GOURD_ACTS.length) % GOURD_ACTS.length];
  if (act === b.act && b.run >= 2) act = GOURD_ACTS[(GOURD_ACTS.indexOf(act) + 1 + Math.floor(random() * 2)) % GOURD_ACTS.length];
  b.run = act === b.act ? b.run + 1 : 1;
  return act;
}

export function moveBoss(round, ms, random) {
  const b = round.boss;
  if (!b || b.state === "sleep") return;
  if (b.state === "down") {
    b.t += ms;
    return;
  }
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  b.t += ms;
  b.hurt = Math.max(0, b.hurt - ms);
  if (b.state === "intro") {
    if (b.t >= BOSS_INTRO_MS) {
      b.state = "fight";
      round.events.push({ type: "bossGo", kind: b.kind });
    }
    return;
  }
  // Dazed by Flash Powder or pinned by a Bear Trap (ghoul-arms.js).
  if (b.stunMs > 0) {
    b.stunMs -= ms;
    return;
  }
  if (BOSS_MOVERS[b.kind]) return BOSS_MOVERS[b.kind](round, b, ms, random, KIT);
  const floor = groundAt(spec, b.x);
  if (b.kind === "gourd") {
    if (b.vy !== 0 || b.y > floor) {
      b.vy -= GRAVITY * dt;
      const py = b.y;
      b.x = clamp(b.x + b.vx * dt, arenaMin(round, b), arenaMax(round, b));
      b.y += b.vy * dt;
      if (b.vy < 0 && py >= floor && b.y <= floor) {
        b.y = floor;
        b.vy = 0;
        b.vx = 0;
        b.wait = GOURD_WAIT_MS / pace;
        if (b.act === "quake") {
          for (const d of [-1, 1]) round.waves.push({ x: b.x + d * (b.w / 2), y: floor, dir: d, life: 6000, kind: "gourd" });
          round.events.push({ type: "slam", kind: "gourd", x: b.x, y: b.y, big: true });
          return;
        }
        const big = b.hops % 3 === 0;
        round.events.push({ type: "slam", kind: "gourd", x: b.x, y: b.y, big });
        const seeds = round.monsters.filter((m) => m.kind === "seed").length;
        for (let k = 0; k < (big ? 2 : 1) && seeds + k < MAX_SEEDS; k++) {
          const side = k % 2 ? 1 : -1;
          spawnMonster(round, "seed", b.x + side * (b.w / 2), b.y + 4, { vx: side * (8 + random() * 10), vy: 26 + random() * 14, dir: side, force: true });
        }
      }
      return;
    }
    b.dir = Math.sign(you.x - b.x) || b.dir;
    if (b.windup > 0) {
      b.windup = Math.max(0, b.windup - ms);
      if (b.windup > 0) return;
      for (const s of GOURD_SPIT) throwBone(round, b.x + b.dir * b.w * 0.3, b.y + b.h * 0.6, s, "acid", b.kind);
      round.events.push({ type: "spit", kind: b.kind, x: b.x, y: b.y + b.h * 0.6 });
      b.wait = GOURD_WAIT_MS / pace;
      return;
    }
    b.wait -= ms;
    if (b.wait > 0) return;
    // Up on a balcony over its head, you are out of a hop's reach: it spits.
    const high = you.state === "run" && you.shelf >= 0 && you.y >= floor + b.h + 2;
    b.act = high ? "spit" : gourdAct(b, random);
    if (high) b.run = 0;
    if (b.act === "spit") {
      b.windup = GOURD_SPIT_MS / pace;
      round.events.push({ type: "windup", x: b.x, y: b.y, boss: true, act: b.act });
      return;
    }
    if (b.act === "quake") {
      b.vx = 0;
      b.vy = GOURD_QUAKE_V;
      b.y += 0.01;
      round.events.push({ type: "hop", kind: "gourd", x: b.x, y: b.y, landX: b.x });
      return;
    }
    b.hops++;
    const v = b.hops % 3 === 0 ? GOURD_BIG_V : GOURD_HOP_V;
    const air = (2 * v) / GRAVITY;
    b.landX = clamp(you.x, arenaMin(round, b), arenaMax(round, b));
    b.vx = (b.landX - b.x) / air;
    b.vy = v;
    b.y += 0.01;
    round.events.push({ type: "hop", kind: "gourd", x: b.x, y: b.y, landX: b.landX });
    return;
  }
}

// Damage to the boss; at none it falls and the door opens.
export function hurtBoss(round, dmg, how) {
  const b = round.boss;
  if (!b || b.state !== "fight") return false;
  b.hp = Math.max(0, b.hp - dmg);
  b.hurt = 120;
  round.events.push({ type: "bossHit", kind: b.kind, x: b.x, y: b.y + b.h / 2, how, weak: how === "weak" });
  if (b.hp > 0) return true;
  b.state = "down";
  b.t = 0;
  const points = round.spec.bossPoints;
  award(round, points);
  round.stats.bosses++;
  round.hasKey = true;
  const life = true;
  round.lives++;
  for (const m of round.monsters) round.events.push({ type: "poof", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  round.monsters.length = 0;
  round.bones.length = 0;
  round.waves.length = 0;
  round.puddles.length = 0;
  round.hazards.length = 0;
  round.events.push({ type: "bossDown", kind: b.kind, x: b.x, y: b.y + b.h / 2, points, life });
  return true;
}

/* ---------------------------------------------------------- hits, kills */

export const award = (round, points) => {
  round.score += points;
};

// A shot, a stomp or a chandelier on monster `m`: hp off, and at none a kill.
export function hurt(round, m, dmg, how, random = Math.random) {
  if (m.dead) return false;
  m.hp -= dmg;
  m.hurt = 110;
  if (m.hp > 0) {
    round.events.push({ type: "hit", kind: m.kind, x: m.x, y: m.y + m.h / 2, how });
    return false;
  }
  kill(round, m, how, random);
  return true;
}

// A monster gone: its points times the chain, doubled for a headshot, a
// stomp or a chandelier, and now and then candy or a power-up left behind.
export function kill(round, m, how = "shot", random = Math.random) {
  m.dead = true;
  round.chain = round.chainMs > 0 ? round.chain + 1 : 1;
  round.chainMs = CHAIN_MS;
  const mult = chainMult(round.chain);
  const bonus = how === "head" || how === "stomp" || how === "crush" ? 2 : 1;
  const fade = m.horde ? Math.max(STRAY_MIN, STRAY_FADE ** round.strays++) : 1;
  const points = Math.round(MONSTERS[m.kind].points * mult * bonus * fade);
  award(round, points);
  round.stats.kills++;
  if (how === "head") round.stats.headshots++;
  if (how === "stomp") round.stats.stomps++;
  round.stats.bestChain = Math.max(round.stats.bestChain, round.chain);
  round.events.push({ type: "kill", kind: m.kind, x: m.x, y: m.y + m.h / 2, points, mult, how });
  // A bloater bursts in a harmless splash: only the acid it spits burns.
  if (m.kind === "spitter") round.events.push({ type: "burst", x: m.x, y: m.y + m.h / 2 });
  if (ON_KILL[m.kind]) ON_KILL[m.kind](round, m, how, KIT);
  if (m.horde) return points;
  const r = random();
  if (r < DROP_POWER) dropItem(round, pickPower(random, round, "", true), m.x, m.y + m.h / 2);
  else if (r < DROP_POWER + DROP_CANDY) dropItem(round, "candy", m.x, m.y + m.h / 2);
  // A weapon: its own band of the same roll, so no later roll shifts (ghoul-powers.js).
  else if (r < DROP_POWER + DROP_CANDY + ARM_DROP) dropItem(round, armDrop(round, (r - DROP_POWER - DROP_CANDY) / ARM_DROP), m.x, m.y + m.h / 2);
  return points;
}

// A weapon's drop takes no monster serial, so it shifts nothing later (a monster's id sets how long it ponders).
export function dropItem(round, kind, x, y) {
  round.drops.push({ id: POWERS[kind]?.arm ? 0 : nextSerial(), kind, x, y, vx: 0, vy: 22, life: DROP_MS, rest: false });
}

// A life lost: with Lucky dice in hand the round first holds to roll one
// (ghoul-dice.js); else, or when it lands on 3 or lower, it holds while Planny
// tumbles, then puts him back.
export function lose(round, cause) {
  if (round.phase !== "play" || round.you.out > 0) return false;
  round.you.lift = null;
  // A bonus room's hearts are its own: no Lucky die is rolled for one.
  if (!round.bonusRound && beginRoll(round, cause, DICE_KIT)) return true;
  return takeLife(round, cause);
}

function takeLife(round, cause) {
  const you = round.you;
  if (!round.infinite) round.bonusRound ? round.bonusRound.hearts-- : round.lives--;
  round.chain = 0;
  round.chainMs = 0;
  round.roomLost = true;
  // The dark ride and the Runaway Cart play on after a hit that is not the last heart
  // (ghoul-ride.js; the cart blinks safe a moment, and a derail is re-seated by ghoul-cart.js).
  const b = round.bonusRound;
  const rolling = round.gallery || (round.cart && !round.cart.done) || (round.sled && !round.sled.done) || (round.runner && !round.runner.done);
  if (rolling && b && (round.infinite || b.hearts > 0)) {
    if (!round.gallery) you.safeMs = Math.max(you.safeMs, BONUS_SAFE_MS);
    round.events.push({ type: "lose", cause, x: you.x, y: you.y, lives: round.lives, hearts: b.hearts });
    return true;
  }
  you.out = CRASH_MS;
  you.outKind = cause;
  round.quickLoss = (you.aliveMs || 0) < QUICK_LOSS_MS;
  round.phase = "crash";
  round.phaseMs = CRASH_MS;
  round.input.jump = 0;
  round.events.push({ type: "lose", cause, x: you.x, y: you.y, lives: round.lives, hearts: round.bonusRound ? round.bonusRound.hearts : undefined });
  return true;
}

// Something touched you: the Garlic shield takes it (seeing off the monster
// that touched you), else a life.
export function struck(round, cause, m = null) {
  const you = round.you;
  if (you.safeMs > 0) return false;
  if (you.garlic) {
    you.garlic = false;
    you.safeMs = GARLIC_SAFE_MS;
    if (m && !m.dead && MONSTERS[m.kind]) {
      kill(round, m, "garlic", () => 1);
      round.monsters = round.monsters.filter((q) => !q.dead);
    }
    round.events.push({ type: "garlic", x: you.x, y: you.y });
    return false;
  }
  return lose(round, cause);
}

/* ------------------------------------------------------------- powers */

// What ghoul-powers.js needs from here, handed to its rules the way KIT is
// handed to a stage pack.
export const POWER_KIT = Object.freeze({ footing, leftEdge, rightEdge, seeded, landing, GRAVITY, FALL_MAX, PIT_Y, HIT_W, HIT_H });
// And what ghoul-dice.js needs.
export const DICE_KIT = Object.freeze({ SAFE_MS, PIT_Y, FIELD_W, footing, groundAt, leftEdge, rightEdge, takeLife, kill, give: (round, kind) => applyPowerWith(round, kind, POWER_KIT) });

export const applyPower = (round, kind) => applyPowerWith(round, kind, POWER_KIT);

// Answer "Use a Lucky Die?": true spends one and rolls, false keeps every die and lets the loss go ahead.
export const answerDie = (round, yes) => answerAsk(round, yes, DICE_KIT);
