// Plan2Code Web Console - Ghoul Rush's play loop: the kits it hands its packs and ghoul-run.js (KIT, RUN_KIT), the blaster and bolts, hits, stomps and timers, one slice of play, and advance().
//
// One of the parts of ghoul.js (see its header and the list of parts there).

import { armBossDamage, fillBag } from "../arms/ghoul-arms.js";
import { bossIntroFor } from "../story/ghoul-boss-intros.js";
import { introFor } from "../story/ghoul-intros.js";
import { stepStory } from "../story/ghoul-story.js";
import { BONUS_READY_MS, endBonus as endBonusWith, makeBonus } from "./ghoul-bonus.js";
import { START_DICE, askStep, giveDiceGift, markRest, reviveSpot, rollDice } from "./ghoul-dice.js";
import { FLAP_CLEAR, TIMED, pickPower, pickups, powerHere, retryMercy } from "./ghoul-powers.js";
import { CHANDELIER_Y, FIELD_H, FIELD_W, ROOMS, STAGES, stageById } from "./ghoul-rooms.js";
import { camera as cameraWith, clearRoom as clearRoomWith, horde as hordeWith, hurry as hurryWith, lockArena, newRound as newRoundWith, nextRoom as nextRoomWith, onCard, pickStage as pickStageWith, respawn as respawnWith, setupRoom as setupRoomWith, spawners as spawnersWith, stagesLeft as stagesLeftWith, steerSelect as steerSelectWith, stepIntro as stepIntroWith, takeIntro as takeIntroWith, takeSelect as takeSelectWith } from "./ghoul-run.js";
import { pressFire as pressFireWith } from "../arms/ghoul-arms.js";
import { KIT } from "./ghoul-kit.js";
import { DICE_KIT, POWER_KIT, arenaMax, arenaMin, award, dropItem, hurt, hurtBoss, lose, makeBoss, moveBoss, moveHazards, struck } from "./ghoul-fight.js";
import { CAUSES, CUT, HARMLESS, HORDE_WITH, PLACES, RIDES, SHOTS, STONE, TARGETS, TICKS, WEAK, guarded, moveMissiles, moveMonsters, piles, roused, solid, spawnMonster, throwBone, towardYou, walk } from "./ghoul-monsters.js";
import { footing, groundAt, jump, makeYou, moveYou, shelfThere, wallAt } from "./ghoul-planny.js";
import { AIM_DY, AIM_MAX, AIM_RANGE, ARMS_UP, BANNER_REACH, BONE_G, BONE_POINTS, BONE_R, BONUS_START, BONUS_STEP, BOSSES, BOSS_LOCK, CAM_AT, CAM_EASE, CAM_LEAD, CHANDELIER_NEAR, CHANDELIER_SHAKE_MS, CHANDELIER_W, CLEAR_MS, COOL_DELAY_MS, COOL_RATE, CRAWL_NEAR, CRUMBLE_BACK_MS, CRUMBLE_MS, CUT_AFTER_MS, CUT_V, DARK_BEHIND, DARK_CHANCE, DOOR_CLEAR, DOOR_REACH, DUCK_H, DUCK_SHOT_Y, EMERGE_MS, FALL_MAX, FLAWLESS_POINTS, GHOST_HIDE_MS, GHOST_SHOW_MS, GRAVITY, HEAD_BONK, HEAD_SHARE, HEAT_MAX, HIT_H, HIT_W, HORDE_ROOM, HURRY_MS, JUMP_V, MAX_MONSTERS, MONSTERS, OFFER_N, PICK_HOLD_MS, PIT_Y, PUDDLE_W, RAPID_MS, READY_MS, ROOM_POINTS, SAFE_MS, SHOT_R, SHOT_RANGE, SHOT_SPEED, SHOT_Y, SKULL_FROM, SLICE_MS, SPAWN_AHEAD, SPIDER_Y, SPREAD_ANGLE, START_LIVES, STOMP_DAMAGE, STOMP_V, TIME_WARN_MS, WAVE_H, WING_SAVE_ARC, WING_SAVE_MS, YOU_H, clamp, fireGap, reaching, roomFor, seeded, timeFor, variant } from "./ghoul-tables.js";

/* ---------------------------------------------------------------- run */

// The double tap, for the tests (the game calls it from key()).
export const pressFire = (round) => pressFireWith(round, KIT);

// What ghoul-run.js needs from here: the room and stage tables, the timings
// and the helpers that set a room up, handed to its rules the way KIT is
// handed to a stage pack.
const RUN_KIT = Object.freeze({
  ROOMS, STAGES, stageById, FIELD_W, CHANDELIER_Y, START_LIVES, START_DICE, TIMED, DARK_CHANCE, BONUS_START, HURRY_MS, OFFER_N, PICK_HOLD_MS,
  READY_MS, BONUS_READY_MS, makeBonus, endBonus: (round, won) => endBonusWith(round, won, { award, ROOM_POINTS }), SAFE_MS, CLEAR_MS, BOSS_LOCK, ROOM_POINTS, FLAWLESS_POINTS, CAM_AT, CAM_LEAD, CAM_EASE,
  SPAWN_AHEAD, DOOR_CLEAR, EMERGE_MS, CRAWL_NEAR, SPIDER_Y, GHOST_SHOW_MS, GHOST_HIDE_MS, DARK_BEHIND, MAX_MONSTERS, HORDE_ROOM, HORDE_WITH, MONSTERS,
  roomFor, seeded, powerHere, pickPower, makeYou, makeBoss, groundAt, timeFor, award, clamp, variant, spawnMonster, introFor, bossIntroFor,
  mercy: (round) => retryMercy(round, POWER_KIT),
  diceGift: (round) => giveDiceGift(round, DICE_KIT.give),
  place: (round) => PLACES.forEach((f) => f(round, KIT)),
});

export const newRound = (seed = (Math.random() * 2 ** 31) >>> 0) => newRoundWith(seed, RUN_KIT);
// Puts the round in a room by id, outside any stage's order (the suites reach a room no stage lists this way).
export const setupRoom = (round, id) => setupRoomWith(round, id, RUN_KIT);
export const stagesLeft = (round) => stagesLeftWith(round, RUN_KIT);
export const pickStage = (round, i = round.pick) => pickStageWith(round, i, RUN_KIT);
export const steerSelect = (round, dStage, dRoom) => steerSelectWith(round, dStage, dRoom, RUN_KIT);
export const takeSelect = (round) => {
  if (!takeSelectWith(round, RUN_KIT)) return false;
  fillBag(round, round.stage);
  return true;
};
const nextRoom = (round, random) => nextRoomWith(round, random, RUN_KIT);
// A stage's intro card moves on (ghoul-run.js): a move key, fire or a click.
export const takeIntro = (round) => takeIntroWith(round, RUN_KIT);
const camera = (round, ms) => cameraWith(round, ms, RUN_KIT);
const respawn = (round) => respawnWith(round, RUN_KIT);
const clearRoom = (round) => clearRoomWith(round, RUN_KIT);
const spawners = (round, ms, random) => spawnersWith(round, ms, random, RUN_KIT);
const horde = (round, ms, random) => hordeWith(round, ms, random, RUN_KIT);
const hurry = (round, ms, random) => hurryWith(round, ms, random, RUN_KIT);

// The tilt for your next bolt: toward the nearest monster (or bone) ahead
// whose middle is near your chest's height (a wraith anywhere the tilt
// reaches), never more than AIM_MAX; 0 for none.
export function aimAt(round) {
  const you = round.you;
  let best = AIM_RANGE;
  let aim = 0;
  for (const m of round.monsters) {
    if (m.dead || !roused(m)) continue;
    const dx = (m.x - you.x) * you.face;
    const dy = m.y + m.h / 2 - (you.y + shotY(you));
    const reach = m.kind === "wraith" ? Math.max(AIM_DY, dx * Math.tan(AIM_MAX)) : AIM_DY;
    if (dx <= 0 || dx >= best || Math.abs(dy) > reach) continue;
    best = dx;
    aim = clamp(Math.atan2(dy, dx), -AIM_MAX, AIM_MAX);
  }
  for (const b of round.bones) {
    const dx = (b.x - you.x) * you.face;
    const dy = b.y - (you.y + shotY(you));
    if (b.dead || dx <= 0 || dx >= best || Math.abs(dy) > AIM_DY) continue;
    best = dx;
    aim = clamp(Math.atan2(dy, dx), -AIM_MAX, AIM_MAX);
  }
  return aim;
}

// The blaster: while fire is held, a bolt (or three) every fireGap() of its
// heat (RAPID_MS with Rapid fire), and while it is not, it cools.
export function fire(round, ms) {
  round.fireMs = Math.max(0, round.fireMs - ms);
  const you = round.you;
  if (!round.input.fire || you.out > 0 || round.gallery || (round.runner && round.runner.id === "lantern")) {
    round.coolMs += ms;
    const cooling = Math.min(ms, round.coolMs - COOL_DELAY_MS);
    if (cooling > 0) round.heat = Math.max(0, round.heat - (COOL_RATE * cooling) / 1000);
    return;
  }
  round.coolMs = 0;
  if (round.fireMs > 0) return;
  if (round.effects.rapid > 0) round.fireMs = RAPID_MS;
  else {
    round.heat = Math.min(HEAT_MAX, round.heat + 1);
    round.fireMs = fireGap(round.heat);
  }
  const aim = aimAt(round);
  const angles = round.effects.spread > 0 ? [0, SPREAD_ANGLE, -SPREAD_ANGLE] : [0];
  for (const a of angles) round.shots.push({ x: you.x + you.face * 1.8, y: you.y + shotY(you), vx: Math.cos(a + aim) * SHOT_SPEED * you.face, vy: Math.sin(a + aim) * SHOT_SPEED, gone: 0 });
  you.fireFx = 90;
  round.stats.shots++;
  round.events.push({ type: "fire", x: you.x, y: you.y + shotY(you), face: you.face, spread: angles.length > 1 });
}

// Whether a circle at (x, y) of radius r touches a box w by h standing at (bx, by).
const touchBox = (x, y, r, bx, by, w, h) => {
  const cx = clamp(x, bx - w / 2, bx + w / 2);
  const cy = clamp(y, by, by + h);
  return Math.hypot(x - cx, y - cy) < r;
};

// One slice of the bolts: each flies until it hits a monster, a bone, the
// boss or a wall, or has gone SHOT_RANGE.
function moveShots(round, ms, random) {
  const dt = ms / 1000;
  const spec = round.spec;
  let n = 0;
  for (const s of round.shots) {
    const step = Math.hypot(s.vx, s.vy) * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.gone += step;
    let used = false;
    if (wallAt(spec, s.x, s.y)) {
      round.events.push({ type: "puff", x: s.x, y: s.y });
      continue;
    }
    // A silver bolt (or the Bone Saw's) goes on through every monster it hits, once each.
    const silver = round.effects.silver > 0 || round.effects.saw > 0;
    for (const m of round.monsters) {
      const stone = !m.dead && STONE[m.kind]?.(m);
      if (m.dead || !(stone || solid(m)) || (s.hit && s.hit.includes(m.id)) || !touchBox(s.x, s.y, SHOT_R, m.x, m.y, m.w, m.h)) continue;
      // Stone: a shot glances off, Holy Water breaks it.
      if (stone) {
        if (round.effects.holy > 0) hurt(round, m, 99, "holy", random);
        else round.events.push({ type: "glance", kind: m.kind, x: s.x, y: s.y });
        used = true;
        break;
      }
      const head = MONSTERS[m.kind].head && s.y > m.y + m.h * (1 - HEAD_SHARE);
      const cut = round.effects.shears > 0 && CUT.has(m.kind);
      const mult = SHOTS.reduce((d, f) => d * f(round, m, s, KIT, random), 1) * (s.dmg || 1);
      hurt(round, m, cut ? 99 : mult, cut ? "shears" : head ? "head" : "shot", random);
      if (silver || s.pierce) {
        s.hit = [...(s.hit || []), m.id];
        continue;
      }
      used = true;
      break;
    }
    if (!used) {
      for (const b of round.bones) {
        if (b.dead || Math.hypot(b.x - s.x, b.y - s.y) > BONE_R + SHOT_R) continue;
        b.dead = true;
        award(round, BONE_POINTS);
        round.events.push({ type: "bone", kind: b.kind, x: b.x, y: b.y, points: BONE_POINTS });
        // A thrown weapon breaks what it meets and flies on.
        used = !s.arm;
        break;
      }
    }
    if (!used) used = TARGETS.some((f) => f(round, s, KIT));
    const boss = round.boss;
    if (!used && boss && boss.state === "fight" && touchBox(s.x, s.y, SHOT_R, boss.x, boss.y, boss.w, boss.h) && guarded(boss)) {
      round.events.push({ type: "bossBlock", kind: boss.kind, x: s.x, y: s.y });
      used = true;
    }
    if (!used && boss && boss.state === "fight" && touchBox(s.x, s.y, SHOT_R, boss.x, boss.y, boss.w, boss.h)) {
      const skull = boss.kind === "bones" && !boss.headless && s.y > boss.y + boss.h * SKULL_FROM;
      const weak = WEAK[boss.kind] ? WEAK[boss.kind](boss, s, round, KIT) : 1;
      const dmg = (skull ? 2 : 1) * weak;
      hurtBoss(round, s.arm ? armBossDamage(round, dmg * s.bossDmg, KIT) : dmg, weak > 1 ? "weak" : skull ? "head" : "shot");
      used = true;
    }
    if (!used && s.gone < (s.range || SHOT_RANGE) && (s.free || (s.x > round.camX - 4 && s.x < round.camX + FIELD_W + 4))) round.shots[n++] = s;
  }
  round.shots.length = n;
  if (round.bones.some((b) => b.dead)) round.bones = round.bones.filter((b) => !b.dead);
  if (round.monsters.some((m) => m.dead)) round.monsters = round.monsters.filter((m) => !m.dead);
}

// Your feet came down on a monster's head (or the boss's): it is stomped
// and you bounce. A ghost cannot be stomped. Returns true for a stomp.
export function stomps(round, py, random) {
  const you = round.you;
  if (you.vy >= 0 && !(you.state === "run" && py > you.y)) return false;
  if (you.out > 0) return false;
  for (const m of round.monsters) {
    if (m.dead || !MONSTERS[m.kind].stomp || !solid(m)) continue;
    const top = m.y + m.h;
    if (py < top - 0.9 || you.y > top + 0.01 || Math.abs(you.x - m.x) > (reaching(m) ? HEAD_BONK : (HIT_W + m.w) / 2)) continue;
    hurt(round, m, MONSTERS[m.kind].stompDamage ?? 99, "stomp", random);
    round.events.push({ type: "stomp", x: m.x, y: top });
    jump(round, round.input.up ? JUMP_V : STOMP_V);
    round.monsters = round.monsters.filter((q) => !q.dead);
    return true;
  }
  const b = round.boss;
  if (b && b.state === "fight") {
    const top = b.y + b.h;
    if (py >= top - 1.2 && you.y <= top + 0.01 && Math.abs(you.x - b.x) <= (HIT_W + b.w) / 2) {
      if (guarded(b)) round.events.push({ type: "bossBlock", kind: b.kind, x: you.x, y: top });
      else hurtBoss(round, STOMP_DAMAGE, "stomp");
      round.events.push({ type: "stomp", x: b.x, y: top });
      jump(round, STOMP_V + 8);
      return true;
    }
  }
  return false;
}

// How tall you are to what hits you, and where your bolts fly from.
const hitH = (you) => (you.ducking ? DUCK_H : HIT_H);
const shotY = (you) => (you.ducking ? DUCK_SHOT_Y : SHOT_Y);

// Whether a box (the monster's, shrunk a little) overlaps your hit box.
const boxHits = (you, x, y, w, h) => Math.abs(you.x - x) < (HIT_W + w * 0.8) / 2 && you.y < y + h * 0.9 && you.y + hitH(you) > y + h * 0.1;

// Whether a climbing walker's raised arms, ARMS_UP over its head either side
// of it, reach you.
const armsHit = (you, m) => {
  const dx = Math.abs(you.x - m.x);
  return reaching(m) && dx > HEAD_BONK && dx < (HIT_W + m.w * 0.8) / 2 && you.y < m.y + m.h + ARMS_UP && you.y + hitH(you) > m.y + m.h * 0.9;
};

// The first thing touching you, unless you are safe for a moment.
function hits(round) {
  const you = round.you;
  if (you.safeMs > 0 || you.out > 0) return;
  for (const m of round.monsters) {
    if (m.dead || !solid(m) || HARMLESS[m.kind]?.(m) || !(boxHits(you, m.x, m.y, m.w, m.h) || armsHit(you, m))) continue;
    struck(round, m.kind, m);
    return;
  }
  for (const b of round.bones) {
    if (!touchBox(b.x, b.y, BONE_R, you.x, you.y, HIT_W, hitH(you))) continue;
    b.dead = true;
    round.bones = round.bones.filter((q) => !q.dead);
    struck(round, b.cause || (b.kind === "acid" ? "acid" : b.kind === "stone" ? "stone" : "bone"));
    return;
  }
  for (const h of round.hazards) {
    if (!(h.live > 0) || Math.abs(you.x - h.x) >= (h.w + HIT_W) / 2 || you.y >= h.y + h.h || you.y + hitH(you) <= h.y) continue;
    struck(round, h.cause);
    return;
  }
  for (const p of round.puddles) {
    if (you.state !== "run" || you.y !== p.y || Math.abs(you.x - p.x) >= (PUDDLE_W + HIT_W) / 2 - 0.6) continue;
    struck(round, "acid");
    return;
  }
  for (const w of round.waves) {
    if (Math.abs(w.x - you.x) < 1.4 && you.y < w.y + WAVE_H) {
      struck(round, w.cause || "wave");
      return;
    }
  }
  const b = round.boss;
  if (b && (b.state === "fight" || b.state === "intro") && boxHits(you, b.x, b.y, b.w, b.h)) struck(round, CAUSES[b.kind] ? CAUSES[b.kind](b) : b.kind);
}

// The chandeliers: one shakes as you run under it, then drops and crushes
// whatever is under it where it lands.
function chandeliers(round, ms, random) {
  const dt = ms / 1000;
  const you = round.you;
  const spec = round.spec;
  for (const c of round.falls) {
    if (c.state === "hang") {
      if (Math.abs(you.x - c.x) < CHANDELIER_NEAR && you.y < c.y - 6) {
        c.state = "shake";
        c.shake = CHANDELIER_SHAKE_MS;
        round.events.push({ type: "creak", x: c.x, y: c.y });
      }
      continue;
    }
    if (c.state === "shake") {
      c.shake -= ms;
      if (c.shake <= 0) c.state = "fall";
      continue;
    }
    if (c.state !== "fall") continue;
    c.vy -= GRAVITY * dt;
    c.y += c.vy * dt;
    const bottom = c.y - 2;
    for (const m of round.monsters) {
      if (m.dead || Math.abs(m.x - c.x) > (CHANDELIER_W + m.w) / 2 || bottom > m.y + m.h || bottom < m.y) continue;
      hurt(round, m, 99, "crush", random);
    }
    round.monsters = round.monsters.filter((m) => !m.dead);
    if (Math.abs(you.x - c.x) < (CHANDELIER_W + HIT_W) / 2 - 0.4 && bottom < you.y + HIT_H && bottom > you.y) struck(round, "chandelier");
    const g = groundAt(spec, c.x);
    if (bottom <= g) {
      c.y = g + 2;
      c.state = "down";
      round.events.push({ type: "crash", x: c.x, y: g });
    }
  }
}

// The crumbling boards: one you stand on shakes, then falls away, then
// comes back.
function crumble(round, ms) {
  const { shelves } = round.spec;
  const you = round.you;
  for (let i = 0; i < shelves.length; i++) {
    if (shelves[i][3] !== "crumble") continue;
    if (round.down[i] > 0) {
      round.down[i] = Math.max(0, round.down[i] - ms);
      if (!round.down[i]) round.events.push({ type: "back", shelf: i });
    } else if (round.shake[i] > 0) {
      round.shake[i] = Math.max(0, round.shake[i] - ms);
      if (!round.shake[i]) {
        round.down[i] = CRUMBLE_BACK_MS;
        round.events.push({ type: "drop", shelf: i });
      }
    } else if (you.state === "run" && you.shelf === i) {
      round.shake[i] = CRUMBLE_MS;
      round.events.push({ type: "crumble", shelf: i, x: you.x, y: you.y });
    }
  }
}

// The clocks that run while you play: the bonus, the power-ups, being safe,
// the chain's window.
function timers(round, ms) {
  const you = round.you;
  round.bonusMs += ms;
  while (round.bonusMs >= 1000) {
    round.bonusMs -= 1000;
    if (round.bonus > 0) {
      round.bonus = Math.max(0, round.bonus - BONUS_STEP);
      if (!round.bonus && !round.hurry && !round.bonusRound) {
        round.hurry = true;
        round.events.push({ type: "hurry" });
      }
    }
  }
  if (round.timeMs > 0) {
    const was = Math.ceil(round.timeMs / 1000);
    round.timeMs = Math.max(0, round.timeMs - ms);
    const now = Math.ceil(round.timeMs / 1000);
    if (now < was && round.timeMs > 0 && round.timeMs <= TIME_WARN_MS) round.events.push({ type: "tick", left: now });
    if (!round.timeMs) {
      round.events.push({ type: "timeUp", x: you.x, y: you.y });
      lose(round, "time");
      return;
    }
  }
  for (const k of TIMED) {
    if (round.effects[k] > 0) {
      round.effects[k] = Math.max(0, round.effects[k] - ms);
      if (!round.effects[k]) round.events.push({ type: "expire", kind: k });
    }
  }
  round.stunMs = Math.max(0, (round.stunMs || 0) - ms);
  you.heldMs = Math.max(0, (you.heldMs || 0) - ms);
  you.flingMs = Math.max(0, (you.flingMs || 0) - ms);
  you.safeMs = Math.max(0, you.safeMs - ms);
  you.aliveMs = (you.aliveMs || 0) + ms;
  you.slowMs = Math.max(0, (you.slowMs || 0) - ms);
  you.dimMs = Math.max(0, (you.dimMs || 0) - ms);
  you.fireFx = Math.max(0, you.fireFx - ms);
  if (round.chainMs > 0) {
    round.chainMs = Math.max(0, round.chainMs - ms);
    if (!round.chainMs) round.chain = 0;
  }
}

// The top of the highest surface under you (the ground, or a shelf there),
// or -Infinity over a pit.
function surfaceBelow(round) {
  const you = round.you;
  let top = groundAt(round.spec, you.x);
  if (top > you.y) top = -Infinity;
  round.spec.shelves.forEach(([x0, x1, y], i) => {
    if (shelfThere(round, i) && i !== you.drop && you.x >= x0 && you.x <= x1 && y <= you.y && y > top) top = y;
  });
  return top;
}

// A jump press, first in its slice: from the ground or a shelf, from the
// air a moment after running off an edge, or saved a moment for the landing.
function takeOff(round, ms) {
  const you = round.you;
  const inp = round.input;
  if (inp.jump <= 0) return false;
  if (you.state === "run" || you.coyote > 0) {
    inp.jump = 0;
    return jump(round);
  }
  // With Bat wings, a press in the air flaps once for another jump, unless
  // you are coming down within FLAP_CLEAR of a surface: then it is a press
  // saved for the landing, as without them.
  if (round.effects.wings > 0 && !you.flapped && you.out <= 0 && !(you.vy < 0 && you.y - surfaceBelow(round) < FLAP_CLEAR)) {
    inp.jump = 0;
    you.flapped = true;
    jump(round);
    round.events.push({ type: "flap", x: you.x, y: you.y });
    return true;
  }
  inp.jump = Math.max(0, inp.jump - ms);
  return false;
}

// Whether you are at the open door, standing.
function atDoor(round) {
  const you = round.you;
  return round.hasKey && you.state === "run" && Math.abs(you.x - round.spec.door) < DOOR_REACH && you.y === groundAt(round.spec, round.spec.door);
}

// Your keys for one slice of walking: a jump press, a short hop (up let go
// while a jump still rises), then moveYou.
function walkYou(round, ms, frozen) {
  const you = round.you;
  if (frozen || you.heldMs > 0 || you.flingMs > 0) round.input.jump = 0;
  else takeOff(round, ms);
  if (you.state === "air") you.airMs = (you.airMs || 0) + ms;
  if (you.cuttable && !round.input.up && you.vy > CUT_V && you.airMs >= CUT_AFTER_MS) {
    you.vy = CUT_V;
    you.cuttable = false;
  }
  moveYou(round, ms);
}

function play(round, ms, random) {
  for (const f of TICKS) f(round, ms, KIT);
  timers(round, ms);
  if (round.phase !== "play") return;
  // The bell has frozen you (see moveYou) and everything else on the field,
  // but for the bolts in flight: no key does anything till it passes.
  const frozen = round.stunMs > 0;
  const you = round.you;
  const py = you.y;
  if (you.lift) stepLift(round, ms);
  else if (frozen || !RIDES.some((f) => f(round, ms, KIT))) walkYou(round, ms, frozen);
  markRest(you);
  if (atDoor(round)) return clearRoom(round);
  const spec = round.spec;
  if (round.boss && round.lockX < 0 && you.x > spec.arena + BOSS_LOCK) lockArena(round);
  if (!frozen) fire(round, ms);
  // While the Church bell rings, the dead stand still and no more come.
  if (!(round.effects.bell > 0 || frozen)) {
    spawners(round, ms, random);
    horde(round, ms, random);
    hurry(round, ms, random);
    moveMonsters(round, ms, random);
    piles(round, ms);
  }
  if (!frozen) {
    moveBoss(round, ms, random);
    moveHazards(round, ms);
    moveMissiles(round, ms);
  }
  moveShots(round, ms, random);
  stomps(round, py, random);
  chandeliers(round, ms, random);
  if (round.phase !== "play") return;
  hits(round);
  if (round.phase !== "play") return;
  pickups(round, ms, POWER_KIT);
  crumble(round, ms);
  if (you.y < PIT_Y && !you.lift && !wingSave(round)) {
    struckFall(round);
    return;
  }
  // Monsters far behind the camera are let go.
  if (round.monsters.some((m) => m.x < round.camX - 30 || m.y < PIT_Y)) round.monsters = round.monsters.filter((m) => m.x >= round.camX - 30 && m.y >= PIT_Y);
  camera(round, ms);
}

// What a stage pack's rules may use of this file's.
Object.assign(KIT, { BOSSES, shotY, aimAt, dropItem, guarded, weakOf: (b, s, round) => (WEAK[b.kind] ? WEAK[b.kind](b, s, round, KIT) : 1), stone: (m) => Boolean(STONE[m.kind]?.(m)), strike: (round, s) => TARGETS.some((f) => f(round, s, KIT)), harmlessNow: (m) => Boolean(HARMLESS[m.kind]?.(m)), walk, towardYou, throwBone, spawnMonster, groundAt, footing, struck, hurt, hurtBoss, fling, arenaMin, arenaMax, solid, FIELD_W, CHANDELIER_Y, SHOT_Y, YOU_H, HIT_W, HIT_H, GRAVITY, FALL_MAX, PIT_Y, BONE_G, DUCK_H, lose });
Object.freeze(KIT);

// Throws Planny: up at `v` and `dx` units across (signed) by the time he is
// back at the height he left, no key doing anything till he lands. What he
// lands on (a pit, a monster) is what it costs, never the throw.
function fling(round, dx, v) {
  const you = round.you;
  const t = (2 * v) / GRAVITY;
  Object.assign(you, { vy: v, state: "air", shelf: -1, coyote: 0, drop: -1, cuttable: false, airMs: 0, flapped: false, flingVx: dx / t, flingMs: Math.round(t * 1000) + 200 });
  return true;
}

// Bat wings catch a fall down a pit, before a life or a Lucky die is at stake:
// no key works while they carry him back. A ride has no ground to go back to.
function wingSave(round) {
  if (!(round.effects.wings > 0) || round.spec.ride) return false;
  const you = round.you;
  const at = reviveSpot(round, DICE_KIT);
  round.effects.wings = 0;
  round.input.jump = 0;
  Object.assign(you, { lift: { x0: you.x, y0: you.y, x: at.x, y: at.y, shelf: at.shelf, t: 0 }, vy: 0, state: "air", shelf: -1, coyote: 0, drop: -1, cuttable: false, flapped: false, flingMs: 0, ducking: false, safeMs: Math.max(you.safeMs, WING_SAVE_MS + SAFE_MS) });
  if (at.x !== you.x) you.face = Math.sign(at.x - you.x);
  round.events.push({ type: "wingSave", x: you.x, y: 1 });
  return true;
}

// One slice of the flight back, and setting him down at the end of it.
function stepLift(round, ms) {
  const you = round.you;
  const l = you.lift;
  l.t += ms;
  const k = Math.min(1, l.t / WING_SAVE_MS);
  const ease = k * (2 - k);
  you.x = l.x0 + (l.x - l.x0) * ease;
  you.y = l.y0 + (l.y - l.y0) * ease + Math.sin(Math.PI * k) * WING_SAVE_ARC;
  if (k < 1) return;
  Object.assign(you, { lift: null, x: l.x, y: l.y, shelf: l.shelf, state: "run", vy: 0 });
  round.events.push({ type: "land", x: you.x, y: you.y });
}

// A fall down a pit: always a life, garlic or not.
function struckFall(round) {
  round.you.garlic = false;
  lose(round, "pit");
}

export function advance(round, ms, random = Math.random) {
  let left = ms;
  while (left > 0 && !round.over) {
    const slice = Math.min(left, SLICE_MS);
    left -= slice;
    if (round.phase === "ready") {
      // The dark ride's title screen holds for a key or a press, its clock running on for the art.
      if (round.gallery?.waiting) {
        round.phaseMs += slice;
        continue;
      }
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) {
        round.phase = "play";
        round.input.jump = 0;
        round.events.push({ type: "go" });
      }
      continue;
    }
    if (round.phase === "clear") {
      round.phaseMs -= slice;
      if (round.phaseMs <= 0) nextRoom(round, random);
      continue;
    }
    // Waiting on a choice of stage: nothing moves.
    if (round.phase === "pick") {
      round.phaseMs = Math.max(0, round.phaseMs - slice - left);
      return "pick";
    }
    if (round.phase === "select") return "select";
    if (onCard(round)) {
      stepIntroWith(round, slice);
      continue;
    }
    // The intro story, before the first room: only its pages move.
    if (round.phase === "story") {
      stepStory(round, slice);
      continue;
    }
    round.clock += slice;
    // Asking whether to use a Lucky die for a life: nothing else moves.
    if (round.phase === "ask") {
      askStep(round, slice);
      continue;
    }
    // Rolling the Lucky dice for a life: nothing else moves.
    if (round.phase === "roll") {
      rollDice(round, slice, random, DICE_KIT);
      continue;
    }
    if (round.phase === "crash") {
      round.phaseMs -= slice;
      round.you.out = Math.max(1, round.phaseMs);
      moveMonsters(round, slice, random);
      moveMissiles(round, slice);
      if (round.phaseMs <= 0) respawn(round);
      continue;
    }
    play(round, slice, random);
  }
  return round.over ? "over" : round.phase;
}

/* ------------------------------------------------------------- banners */

// Whether anything that matters to you is in a banner's strip, its middle
// `y` units down from the field's top: you, a monster on screen that can
// hurt you (not a roosting bat, a widow still on the ceiling, a faded ghost
// or one still coming up), the boss, a bone, a glob of acid, a puddle or a
// shockwave.
export function underBanner(round, y) {
  const lo = round.camX - 2;
  const hi = round.camX + FIELD_W + 2;
  const inStrip = (x, bottom, h) => x > lo && x < hi && FIELD_H - (bottom + h) < y + BANNER_REACH && FIELD_H - bottom > y - BANNER_REACH;
  const you = round.you;
  if (inStrip(you.x, you.y, YOU_H)) return true;
  // A roosting bat, or anything not yet able to hurt you, does not count.
  if (round.monsters.some((m) => roused(m) && inStrip(m.x, m.y, m.h))) return true;
  if (round.bones.some((b) => inStrip(b.x, b.y - BONE_R, BONE_R * 2))) return true;
  if (round.puddles.some((p) => inStrip(p.x, p.y, 1))) return true;
  if (round.waves.some((w) => inStrip(w.x, w.y, WAVE_H))) return true;
  // A room drawn whole by its own art (the Drowned Lantern) lists what matters there as [x, y up].
  if (round.runner && round.runner.marks && round.runner.marks.some(([x, y]) => inStrip(x, y - YOU_H / 2, YOU_H))) return true;
  const b = round.boss;
  return Boolean(b && b.state !== "sleep" && b.state !== "down" && inStrip(b.x, b.y, b.h));
}

// Where a banner goes: high on the field while you are low on it, low
// while you are high.
export const bannerY = (round) => (round.you.y > FIELD_H * 0.42 ? FIELD_H * 0.72 : FIELD_H * 0.3);
