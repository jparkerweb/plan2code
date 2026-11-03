// Plan2Code Web Console - Ghoul Rush's secondary weapons: the double tap that uses one, the bag it comes out of, and what each of them does on the field.
//
// Fire held is the flashlight blaster. Fire tapped twice uses the weapon on top
// of the bag (`round.arms`, a list of { kind, n }, the latest picked up first,
// filled by addArm in ghoul-powers.js, where each weapon's name, bundle and cap
// are). Keep holding after the second press and the bolts carry on ARM_GAP_MS
// later. The tap is read in the game's key() through pressFire and releaseFire,
// never from `round.input.fire`, so a bot or a test that holds fire never
// throws anything.
//
// What counts as a double tap (see pressFire): a first press let go within
// TAP_HOLD_MS, then a second press within DOUBLE_TAP_MS of letting go. Feathering
// the blaster (a long hold, a short gap, another long hold) is not one, and
// hammering spends one at most: once two taps have counted, further taps do
// nothing until the button has been quiet for DOUBLE_TAP_MS.
//
// A weapon never hurts Planny. Its kinds, in seven behaviors:
//
// - A shot in `round.shots` with `arm` set, flying through ghoul.js's moveShots,
//   so stone, guards, weak spots, pipes and Holy Water treat it as a bolt. `dmg`
//   and `bossDmg` replace a bolt's 1; `pierce` goes on through; `free` lets it
//   leave the view (it comes back); `range` replaces SHOT_RANGE. The Iron Stake
//   flies straight and pierces; the Hedge Sickle turns back at SICKLE_OUT and can hit each monster
//   again on the way home, and Planny catches it.
// - A lob: Dynamite's `stick` (a blast on a fuse) and `armPod` (Grave Salt and
//   Flash Powder, which go off where they land).
// - The Custard Pie (`armPie`), a long lob that sheds blobs of cream all along its
//   path (`armGoop`): they fall to the surface below and lie there as puddles.
// - The Billiard Ball (`armBall`), rolling along the floor, down steps and off
//   ledges, bouncing once off a wall, lost down a pit.
// - The Bottle Rocket (ghoul-rockets.js): three rockets at once, ahead, up (curving
//   over onto the nearest monster) and behind, each going off in a blast.
// - The Cast-Iron Skillet (`armPans`, ghoul-pans.js), three pans that circle him,
//   then spiral outward off screen, one-shotting anything that is not a boss.
// - The Tuning Fork (`armRing`), a ring that spreads from him, through shelves,
//   cracks stone and silences pipes.
// - Grave Salt (`armSalt`), a line on the floor that burns what stands in it,
//   even what is still buried.
// - The Bear Trap (`armTrap`), five a use (two behind, one at his feet, two ahead, TRAP_GAP
//   apart), each snapping on the first walker or boss to step in it.
// - The Road Flare (`armRoadFlare`, `armRoadFire`, ghoul-flare.js), a lob that lands
//   and burns a patch of floor, melting the Frost Widow's veil.
//
// Fairness: a use costs no heat. An area weapon's kills leave no drops (NO_DROPS),
// so no room can be farmed with them. On a boss every weapon goes through
// armBossDamage: scaled with the boss's hp as a run gets deeper, and past
// ARM_BOSS_SHARE of its hp in one fight only 1 a hit, so a full bag helps a lot
// but never wins the fight. No fight needs one. If a boss is at half hp and your
// bag is empty, one of its stage's weapons falls near you, once a fight.

import { ARM_POP_MS, POWERS, STAGE_ARMS, addArm } from "./ghoul-powers.js";
import { stepPans, usePans } from "./ghoul-pans.js";
import { FLARE_VX, FLARE_VY, stepFlareFly, stepRoadFire, useFlare } from "./ghoul-flare.js";
import { stepBoom, stepMuzzle, stepRocket, useRockets } from "./ghoul-rockets.js";

const freeze = Object.freeze;

export const DOUBLE_TAP_MS = 220;
export const TAP_HOLD_MS = 240;
// Between one use and the next, and between a use and the next bolt.
export const ARM_COOL_MS = 350;
export const ARM_GAP_MS = 220;
export const ARM_BOSS_SHARE = 0.35;

// Dynamite: a throw leaves at DYN_VX across and DYN_VY up, blows up DYN_FUSE_MS
// after it leaves, or at once when a monster stands within DYN_PROX of it once it has
// landed; the blast is BLAST_W wide, BLAST_UP over the stick and
// BLAST_DOWN under it, shows BLAST_MS, does BLAST_DAMAGE to a monster (and breaks
// stone) and DYN_BOSS_DMG to a boss.
export const DYN_VX = 30;
export const DYN_VY = 38;
export const DYN_FUSE_MS = 1000;
export const DYN_PROX = 1;
export const BLAST_W = 22;
export const BLAST_UP = 9;
export const BLAST_DOWN = 3;
export const BLAST_MS = 450;
export const BLAST_DAMAGE = 20;
export const DYN_BOSS_DMG = 8;
// The Iron Stake: pierces a whole line, chest high.
export const STAKE_SPEED = 96;
export const STAKE_DMG = 12;
export const STAKE_BOSS = 8;
// The Harpoon: the same straight pierce, heavier and slower, and the only
// bolt that reaches a lurker's eyes under the water (Gallows Bog, see
// `target` in ghoul-bog.js).
export const HARPOON_SPEED = 84;
export const HARPOON_DMG = 14;
export const HARPOON_BOSS = 8;
// The Bottle Rocket: three at once, ahead, up and behind (ghoul-rockets.js).
export * from "./ghoul-rockets.js";
// The Hedge Sickle: SICKLE_OUT out and back, SICKLE_DMG a pass.
export const SICKLE_SPEED = 66;
export const SICKLE_OUT = 34;
export const SICKLE_DMG = 3;
export const SICKLE_BOSS = 5;
const SICKLE_CATCH = 3;
const SICKLE_LIFE_MS = 3000;
// The Billiard Ball: BALL_V along the floor, BALL_LOW_DMG to anything no taller
// than BALL_LOW, BALL_DMG to the rest, each once, for BALL_MS.
export const BALL_V = 46;
export const BALL_MS = 3500;
export const BALL_LOW = 3;
export const BALL_LOW_DMG = 6;
export const BALL_DMG = 3;
export const BALL_BOSS = 5;
const BALL_STEP = 3;
// The Tuning Fork: a ring out to RING_R over RING_MS, RING_DMG once each, double
// to anything ghostly, breaking stone; RING_PIPE to an organ pipe.
export const RING_R = 30;
export const RING_MS = 350;
export const RING_DMG = 4;
export const RING_BOSS = 8;
export const RING_PIPE = 4;
const GHOSTLY = new Set(["ghost", "chorister", "wraith"]);
// A short lob for what goes off where it lands.
export const POD_VX = 22;
export const POD_VY = 26;
const POD_RIDE_MS = 500;
// Grave Salt: SALT_W of floor for SALT_MS, SALT_DMG every SALT_TICK_MS to what
// stands in it, the buried too (SALT_BURIED); SALT_BOSS_MAX to a boss in all.
export const SALT_W = 12;
export const SALT_MS = 4000;
export const SALT_TICK_MS = 350;
export const SALT_DMG = 1;
export const SALT_BOSS_TICK = 1;
export const SALT_BOSS_MAX = 6;
const SALT_H = 6;
const SALT_BURIED = new Set(["hands", "robber"]);
// Flash Powder: everything within FLASH_R stands dazed FLASH_STUN_MS, anything
// unseen is shown FLASH_SHOW_MS (the art reads `m.litMs`), a boss FLASH_BOSS_MS
// and FLASH_BOSS_DMG off it. A guarded boss shrugs it off: dazing it then would
// only shorten the moment it can be hurt.
export const FLASH_R = 24;
export const FLASH_STUN_MS = 2000;
export const FLASH_SHOW_MS = 3000;
export const FLASH_BOSS_MS = 1200;
export const FLASH_DMG = 1;
export const FLASH_BOSS_DMG = 8;
const FLARE_MS = 320;
// The Custard Pie: a long lob (PIE_VX across, PIE_VY up, so it lands about 45
// ahead on the flat) that sheds a blob of cream every PIE_DROP_X of travel or
// PIE_DROP_MS, whichever comes first (no random draw). A blob falls to the
// surface below it and lies there PIE_GOOP_MS as a puddle PIE_GOOP_W wide. A
// monster in the pie's path, in a falling blob's column (down to the surface it
// lands on) or touching a puddle stands stunned PIE_GOOP_STUN_MS (`m.stunMs`,
// `m.pied` for the art; refreshed while it stays in goop; a Mirror You copies
// nothing meanwhile) and takes PIE_GOOP_DMG, once per blob (the pie itself counts
// as one). Where it lands, or on the first boss it meets, it splats: everything
// within PIE_R stands stunned PIE_STUN_MS and takes PIE_SPLAT_DMG; a boss takes
// PIE_BOSS there and PIE_GOOP_BOSS from each blob (all through armBossDamage, no
// stun, a guard shows). Goop never hurts Planny and is not a platform.
export const PIE_VX = 50;
export const PIE_VY = 46;
export const PIE_DROP_X = 2.5;
export const PIE_DROP_MS = 90;
export const PIE_GOOP_MS = 3500;
export const PIE_GOOP_W = 3.2;
export const PIE_GOOP_STUN_MS = 2500;
export const PIE_GOOP_DMG = 1;
export const PIE_GOOP_BOSS = 1;
export const PIE_R = 8;
export const PIE_STUN_MS = 3000;
export const PIE_DMG = 1;
export const PIE_SPLAT_DMG = 2;
export const PIE_BOSS = 4;
export const PIE_SHOW_MS = 420;
// A puddle's sound plays at most this often.
export const PIE_SOUND_MS = 280;
const PIE_BODY = 0.9;
const PIE_COL = 1.2;
const PIE_PUDDLE_H = 1.2;
const PIE_RIDE_MS = 900;
const PIE_FALL_MS = 1500;
// The Bear Trap: one use sets TRAP_SET, TRAP_GAP apart (two behind, one at his feet, two
// ahead); armed TRAP_ARM_MS after it lands, TRAP_MAX on the field at once
// (one more takes the oldest's place), gone after TRAP_LIFE_MS unsprung,
// TRAP_DMG to the first monster on the floor to step in it, TRAP_BOSS to a boss,
// which it pins TRAP_PIN_MS. A monster it does not kill it holds as long.
export const TRAP_ARM_MS = 250;
export const TRAP_MAX = 10;
export const TRAP_SET = 5;
export const TRAP_GAP = 6;
export const TRAP_LIFE_MS = 15000;
export const TRAP_DMG = 20;
export const TRAP_BOSS = 10;
export const TRAP_PIN_MS = 1200;
const TRAP_W = 2.4;
const TRAP_REACH = 1.4;

const NO_DROPS = () => 1;

/* --------------------------------------------------------- the double tap */

const newTap = () => ({ down: false, heldMs: 0, gapMs: 0, armed: false });

export const resetTap = (round) => {
  round.tap = newTap();
};

// A fresh press of fire. The first arms a double tap; the second, inside the
// window, uses the weapon; any others in the same burst do nothing. Returns
// whether a weapon was used.
export function pressFire(round, k) {
  const t = (round.tap ||= newTap());
  if (round.phase !== "play") {
    resetTap(round);
    return false;
  }
  t.down = true;
  t.heldMs = 0;
  if (t.gapMs > 0) {
    const armed = t.armed;
    t.armed = false;
    return armed && useArm(round, k);
  }
  t.armed = true;
  return false;
}

// Fire let go: a short press opens the window for the next, a long one was the
// blaster's and closes it.
export function releaseFire(round) {
  const t = round.tap;
  if (!t || !t.down) return;
  t.down = false;
  if (t.heldMs > TAP_HOLD_MS) {
    t.armed = false;
    t.gapMs = 0;
  } else t.gapMs = DOUBLE_TAP_MS;
}

// What needs a floor stays in the bag on a ride (a room's `ride`, the Runaway
// Cart, is track over a chasm): the next kind down comes out instead.
const NEEDS_FLOOR = new Set(["ball", "salt", "trap", "flare"]);
export const armOnTop = (round) => (round.spec.ride ? round.arms.find((a) => !NEEDS_FLOOR.has(a.kind)) : round.arms[0]) || null;

// Whether a weapon can come out just now: not while frozen, held, thrown or down.
export function canUseArm(round) {
  const you = round.you;
  return round.phase === "play" && you.out <= 0 && !(round.stunMs > 0) && !(you.heldMs > 0) && !(you.flingMs > 0) && !you.lift && !(round.armCool > 0) && Boolean(armOnTop(round));
}

// The top of the bag, used. Bolts held through it pick up ARM_GAP_MS later.
export function useArm(round, k) {
  if (!canUseArm(round)) return false;
  const top = armOnTop(round);
  USES[top.kind](round, k);
  top.n--;
  if (top.n <= 0) round.arms.splice(round.arms.indexOf(top), 1);
  const you = round.you;
  round.armCool = ARM_COOL_MS;
  round.armPopMs = ARM_POP_MS;
  round.armUsed = true;
  round.fireMs = Math.max(round.fireMs || 0, ARM_GAP_MS);
  you.fireFx = 90;
  round.events.push({ type: "armUse", kind: top.kind, x: you.x + you.face * 1.8, y: you.y + k.shotY(you), face: you.face });
  return true;
}

// A practice round (the stage select) comes with the stage's weapon and the
// common ones, so each can be tried at once.
export function fillBag(round, stage) {
  for (const kind of ["dyn", "stake", "rocket", STAGE_ARMS[stage]]) if (kind && POWERS[kind]) for (let i = 0; i <= POWERS[kind].max; i++) addArm(round, kind);
}

/* ------------------------------------------------------------- the throws */

// Where a thrown thing leaves Planny's hand.
const hand = (round, k) => {
  const you = round.you;
  return { x: you.x + you.face * 1.8, y: you.y + k.shotY(you) };
};

function armShot(round, k, arm, speed, over) {
  const you = round.you;
  const at = hand(round, k);
  const aim = over.aimed === false ? 0 : k.aimAt(round);
  round.shots.push({ arm, x: at.x, y: at.y, vx: Math.cos(aim) * speed * you.face, vy: Math.sin(aim) * speed, gone: 0, t: 0, spin: 0, ...over });
}

// Aimed lobs (Dynamite, the Road Flare): the first monster ahead in view, or, when others
// stand within LOB_GROUP of it, the middle of that group, so one blast or fire
// catches as many as it can. The sideways speed is solved so the throw lands there
// (clamped to LOB_MIN_VX..LOB_MAX_VX); with nothing ahead it is the old fixed throw.
export const LOB_GROUP = 9;
const LOB_MIN_VX = 6;
const LOB_MAX_VX = 70;

// `also` names kinds that count though they cannot be shot (the buried hands the salt is for).
export function lobTarget(round, k, also = []) {
  const you = round.you;
  const lo = round.camX;
  const hi = round.camX + k.FIELD_W;
  const ahead = round.monsters
    .filter((m) => !m.dead && (k.solid(m) || k.stone(m) || also.includes(m.kind)) && (m.x - you.x) * you.face > 1 && m.x >= lo && m.x <= hi)
    .sort((a, b) => Math.abs(a.x - you.x) - Math.abs(b.x - you.x));
  if (!ahead.length) return null;
  const first = ahead[0];
  const group = ahead.filter((m) => Math.abs(m.x - first.x) <= LOB_GROUP);
  return group.reduce((sum, m) => sum + m.x, 0) / group.length;
}

export function lobVx(round, k, vy, fixed, also) {
  const tx = lobTarget(round, k, also);
  if (tx === null) return round.you.face * fixed;
  const at = hand(round, k);
  const dy = k.groundAt(round.spec, tx) - at.y;
  const disc = vy * vy + 2 * k.BONE_G * dy;
  const t = disc > 0 ? (vy + Math.sqrt(disc)) / k.BONE_G : (2 * vy) / k.BONE_G;
  const vx = Math.min(LOB_MAX_VX, Math.max(LOB_MIN_VX, Math.abs(tx - at.x) / t));
  return round.you.face * vx;
}

function lobStick(round, k) {
  const you = round.you;
  const at = hand(round, k);
  round.hazards.push({ kind: "stick", x: at.x, y: at.y, vx: lobVx(round, k, DYN_VY, DYN_VX), vy: DYN_VY, fuse: DYN_FUSE_MS, max: DYN_FUSE_MS, spin: 0, rest: false, w: 0.8, h: 0.8, live: 0, cause: "dynamite" });
  // The Mine's art plays Dynamite's own sound from this one.
  round.events.push({ type: "dynThrow", x: at.x, y: at.y, face: you.face });
}

function lobPod(round, k, pay, aimed = false) {
  const you = round.you;
  const at = hand(round, k);
  round.hazards.push({ kind: "armPod", pay, x: at.x, y: at.y, vx: aimed ? lobVx(round, k, POD_VY, POD_VX, ["hands"]) : you.face * POD_VX, vy: POD_VY, spin: 0, w: 0.8, h: 0.8, live: 0, cause: "" });
}

function lobPie(round, k) {
  const you = round.you;
  const at = hand(round, k);
  round.hazards.push({ kind: "armPie", x: at.x, y: at.y, vx: you.face * PIE_VX, vy: PIE_VY, spin: 0, t: 0, dist: 0, since: 0, n: 0, hit: [], w: 0.8, h: 0.8, live: 0, cause: "" });
}

const USES = freeze({
  dyn: lobStick,
  stake: (round, k) => armShot(round, k, "stake", STAKE_SPEED, { dmg: STAKE_DMG, bossDmg: STAKE_BOSS, pipeDmg: STAKE_DMG, pierce: true }),
  rocket: useRockets,
  sickle: (round, k) => armShot(round, k, "sickle", SICKLE_SPEED, { dmg: SICKLE_DMG, bossDmg: SICKLE_BOSS, pipeDmg: SICKLE_DMG, pierce: true, free: true, range: 400, back: false }),
  ball: (round, k) => {
    const you = round.you;
    round.hazards.push({ kind: "armBall", x: you.x + you.face * 1.8, y: you.y + 0.1, vx: you.face * BALL_V, vy: 0, life: BALL_MS, bounced: false, roll: 0, hit: [], hitBoss: false, w: 1.4, h: 1.4, live: 0, cause: "" });
  },
  skillet: usePans,
  fork: (round, k) => {
    const you = round.you;
    round.hazards.push({ kind: "armRing", x: you.x, y: you.y + k.HIT_H / 2, r: 0, life: RING_MS, max: RING_MS, hit: [], hitPipe: [], hitBoss: false, w: 1, h: 1, live: 0, cause: "" });
  },
  salt: (round, k) => lobPod(round, k, "salt", true),
  flash: (round, k) => lobPod(round, k, "flash", true),
  pie: lobPie,
  flare: (round, k) => useFlare(round, k, lobVx(round, k, FLARE_VY, FLARE_VX)),
  harpoon: (round, k) => armShot(round, k, "harpoon", HARPOON_SPEED, { dmg: HARPOON_DMG, bossDmg: HARPOON_BOSS, pierce: true }),
  trap: (round) => {
    const you = round.you;
    // Five at once, TRAP_GAP apart: two behind, one at his feet, two ahead.
    for (let i = -2; i <= 2; i++) {
      const set = round.hazards.filter((h) => h.kind === "armTrap" && !(h.shut > 0));
      if (set.length >= TRAP_MAX) round.hazards.splice(round.hazards.indexOf(set[0]), 1);
      round.hazards.push({ kind: "armTrap", x: you.x + you.face * i * TRAP_GAP, y: you.y, vy: 0, rest: i === 0 && you.state === "run", arm: TRAP_ARM_MS, life: TRAP_LIFE_MS, shut: 0, w: TRAP_W, h: 1, live: 0, cause: "" });
    }
  },
});

/* ---------------------------------------------------------------- damage */

// What a weapon's `dmg` takes off a boss: more the deeper the run (so a stick
// stays worth the same share of a tougher boss), and past ARM_BOSS_SHARE of its
// hp in a fight, 1 a hit. `round.armBossDmg` is kept across a life lost.
export function armBossDamage(round, dmg, k) {
  const b = round.boss;
  const base = k.BOSSES[b.kind]?.hp || round.spec.bossHp;
  const d = Math.max(1, Math.round((dmg * round.spec.bossHp) / base));
  const spent = round.armBossDmg || 0;
  if (spent >= round.spec.bossHp * ARM_BOSS_SHARE) return 1;
  round.armBossDmg = spent + d;
  return d;
}

// Whether a box w by h standing at (x, y) meets the span given.
const inBox = (m, x0, x1, y0, y1) => m.x + m.w / 2 >= x0 && m.x - m.w / 2 <= x1 && m.y + m.h >= y0 && m.y <= y1;
const bossUp = (round) => {
  const b = round.boss;
  return b && b.state === "fight" && !b.hidden ? b : null;
};

// A weapon's hit on the boss at (x, y): a guard shows, a weak spot counts.
function hitBoss(round, x, y, dmg, how, k) {
  const b = bossUp(round);
  if (!b) return false;
  if (k.guarded(b)) {
    round.events.push({ type: "bossBlock", kind: b.kind, x, y });
    return false;
  }
  const weak = k.weakOf(b, { x, y }, round);
  k.hurtBoss(round, armBossDamage(round, dmg * weak, k), weak > 1 ? "weak" : how);
  return true;
}

function sweepDead(round) {
  if (round.monsters.some((m) => m.dead)) round.monsters = round.monsters.filter((m) => !m.dead);
}

// A thing in the air: down onto the floor or a board it crosses, a wall stopping
// it, and `false` when it is lost down a pit (never on a ride: it goes off in the
// air instead). Sets `h.rest` when it lands.
function flyDown(round, h, ms, k) {
  const dt = ms / 1000;
  const spec = round.spec;
  const py = h.y;
  h.vy -= k.BONE_G * dt;
  const nx = h.x + h.vx * dt;
  if (k.groundAt(spec, nx) > h.y) h.vx = 0;
  else h.x = nx;
  h.y += h.vy * dt;
  if (h.vy < 0) {
    let top = k.groundAt(spec, h.x);
    for (const [x0, x1, t] of spec.shelves) if (h.x >= x0 && h.x <= x1 && py >= t - 0.05 && h.y <= t && t > top) top = t;
    if (h.y <= top && py >= top - 0.05) Object.assign(h, { y: top, vx: 0, vy: 0, rest: true });
  }
  return h.y >= k.PIT_Y || Boolean(spec.ride);
}

/* ---------------------------------------------------------------- dynamite */

function blast(round, h, k) {
  round.hazards.push({ kind: "blast", x: h.x, y: h.y, w: BLAST_W, h: BLAST_UP + BLAST_DOWN, boom: BLAST_MS, max: BLAST_MS, live: 0, cause: "dynamite" });
  round.events.push({ type: "dynBlast", x: h.x, y: h.y });
  const x0 = h.x - BLAST_W / 2;
  const x1 = h.x + BLAST_W / 2;
  const y0 = h.y - BLAST_DOWN;
  const y1 = h.y + BLAST_UP;
  for (const m of round.monsters) {
    if (m.dead || !(k.solid(m) || k.stone(m)) || !inBox(m, x0, x1, y0, y1)) continue;
    k.hurt(round, m, k.stone(m) ? 99 : BLAST_DAMAGE, "blast", NO_DROPS);
  }
  sweepDead(round);
  const b = bossUp(round);
  if (b && inBox(b, x0, x1, y0, y1)) hitBoss(round, h.x, Math.max(h.y, b.y + b.h / 2), DYN_BOSS_DMG, "blast", k);
}

function stepStick(round, h, ms, k) {
  h.fuse -= ms;
  h.spin += (ms / 1000) * 14;
  if (!h.rest && !flyDown(round, h, ms, k)) return false;
  // Landed: it also goes off at once when a monster comes within DYN_PROX of it.
  const near = h.rest && round.monsters.some((m) => !m.dead && (k.solid(m) || k.stone(m)) && Math.max(0, Math.abs(m.x - h.x) - m.w / 2) <= DYN_PROX && h.y >= m.y - DYN_PROX && h.y <= m.y + m.h + DYN_PROX);
  if (h.fuse > 0 && !near) return true;
  blast(round, h, k);
  return false;
}

const stepBlast = (round, h, ms) => {
  h.boom -= ms;
  return h.boom > 0;
};

/* ----------------------------------------------------------------- pods */

// A pod lands and goes off where it lands.
function stepPod(round, h, ms, k) {
  h.spin += (ms / 1000) * 12;
  h.t = (h.t || 0) + ms;
  if (!flyDown(round, h, ms, k)) return false;
  if (!h.rest && !(round.spec.ride && h.t >= POD_RIDE_MS)) return true;
  if (h.pay === "salt") {
    round.hazards.push({ kind: "armSalt", x: h.x, y: h.y, life: SALT_MS, max: SALT_MS, tick: 0, bossDone: 0, w: SALT_W, h: 1, live: 0, cause: "" });
    round.events.push({ type: "armSalt", x: h.x, y: h.y });
  } else flare(round, h, k);
  return false;
}

// The surface under (x, y): the floor or the highest board it can fall onto.
function surfaceBelow(round, x, y, k) {
  const spec = round.spec;
  let top = k.groundAt(spec, x);
  for (const [x0, x1, t] of spec.shelves) if (x >= x0 && x <= x1 && t <= y + 0.05 && t > top) top = t;
  return spec.ride ? y - 12 : top;
}

// Stuns and pies a monster that cream is on; the first touch of a blob hurts.
function creamed(round, m, h, k, stun, dmg) {
  m.stunMs = Math.max(m.stunMs || 0, stun);
  m.pied = true;
  if (h.hit.includes(m.id)) return;
  h.hit.push(m.id);
  k.hurt(round, m, dmg, "pie", NO_DROPS);
}

// Every monster in the box that cream can touch.
function creamIn(round, h, x0, x1, y0, y1, stun, dmg, k) {
  for (const m of round.monsters) {
    if (m.dead || !k.solid(m) || k.harmlessNow(m) || !inBox(m, x0, x1, y0, y1)) continue;
    creamed(round, m, h, k, stun, dmg);
  }
  sweepDead(round);
}

// The pie in flight: it sheds a blob every PIE_DROP_X or PIE_DROP_MS, stuns what
// it passes through, and splats where it lands or on the boss.
function stepPie(round, h, ms, k) {
  h.spin += (ms / 1000) * 12;
  h.t += ms;
  h.since += ms;
  const px = h.x;
  if (!flyDown(round, h, ms, k)) return false;
  h.dist += Math.abs(h.x - px);
  if (!h.rest && (h.dist >= PIE_DROP_X || h.since >= PIE_DROP_MS)) {
    h.dist = 0;
    h.since = 0;
    round.hazards.push({ kind: "armGoop", x: h.x, y: h.y, vx: 0, vy: 0, rest: false, fall: 0, life: PIE_GOOP_MS, max: PIE_GOOP_MS, n: h.n++, hit: [], hitBoss: false, w: PIE_GOOP_W, h: 1, live: 0, cause: "" });
  }
  if (!h.rest) {
    creamIn(round, h, h.x - PIE_BODY, h.x + PIE_BODY, h.y - PIE_BODY, h.y + PIE_BODY, PIE_GOOP_STUN_MS, PIE_DMG, k);
    const b = bossUp(round);
    const onBoss = b && inBox(b, h.x - PIE_BODY, h.x + PIE_BODY, h.y - PIE_BODY, h.y + PIE_BODY);
    if (!onBoss && !(round.spec.ride && h.t >= PIE_RIDE_MS)) return true;
  }
  splat(round, h, k);
  return false;
}

// A blob of cream: falling to the surface below, then a puddle till it fades.
function stepGoop(round, h, ms, k) {
  let x0 = h.x - PIE_COL;
  let x1 = h.x + PIE_COL;
  let y0;
  let y1;
  if (!h.rest) {
    h.fall += ms;
    if (!flyDown(round, h, ms, k) || h.fall > PIE_FALL_MS) return false;
    if (h.rest && !(round.pieSoundMs > 0)) {
      round.pieSoundMs = PIE_SOUND_MS;
      round.events.push({ type: "armGoop", x: h.x, y: h.y });
    }
    y0 = surfaceBelow(round, h.x, h.y + 1, k);
    y1 = h.y + 1;
  } else {
    if ((h.life -= ms) <= 0) return false;
    x0 = h.x - h.w / 2;
    x1 = h.x + h.w / 2;
    y0 = h.y - 0.5;
    y1 = h.y + PIE_PUDDLE_H;
  }
  creamIn(round, h, x0, x1, y0, y1, PIE_GOOP_STUN_MS, PIE_GOOP_DMG, k);
  const b = bossUp(round);
  if (b && !h.hitBoss && (round.armBossDmg || 0) < round.spec.bossHp * ARM_BOSS_SHARE && inBox(b, x0, x1, y0, y1)) {
    h.hitBoss = true;
    hitBoss(round, h.x, Math.max(h.y, b.y + 1), PIE_GOOP_BOSS, "pie", k);
  }
  return true;
}

// A pie going off: what is near stands pied and stunned.
function splat(round, h, k) {
  round.hazards.push({ kind: "armSplat", x: h.x, y: h.y, life: PIE_SHOW_MS, max: PIE_SHOW_MS, w: PIE_R, h: 1, live: 0, cause: "" });
  round.events.push({ type: "armSplat", x: h.x, y: h.y });
  for (const m of round.monsters) {
    if (m.dead || Math.hypot(m.x - h.x, m.y + m.h / 2 - h.y) > PIE_R + m.w / 2) continue;
    m.stunMs = Math.max(m.stunMs || 0, PIE_STUN_MS);
    m.pied = true;
    if (k.solid(m) && !k.harmlessNow(m)) k.hurt(round, m, PIE_SPLAT_DMG, "pie", NO_DROPS);
  }
  sweepDead(round);
  const b = bossUp(round);
  if (b && Math.hypot(b.x - h.x, b.y + b.h / 2 - h.y) <= PIE_R + b.w / 2) hitBoss(round, b.x, b.y + b.h / 2, PIE_BOSS, "pie", k);
}

// Flash Powder going off: what is near stands dazed and is seen.
function flare(round, h, k) {
  round.hazards.push({ kind: "armFlare", x: h.x, y: h.y, life: FLARE_MS, max: FLARE_MS, w: FLASH_R, h: 1, live: 0, cause: "" });
  round.events.push({ type: "armFlash", x: h.x, y: h.y });
  for (const m of round.monsters) {
    if (m.dead || Math.hypot(m.x - h.x, m.y + m.h / 2 - h.y) > FLASH_R + m.w / 2) continue;
    m.stunMs = FLASH_STUN_MS;
    m.litMs = FLASH_SHOW_MS;
    m.unseen = false;
    if (k.solid(m)) k.hurt(round, m, FLASH_DMG, "flash", NO_DROPS);
  }
  sweepDead(round);
  const b = bossUp(round);
  if (b && Math.hypot(b.x - h.x, b.y + b.h / 2 - h.y) <= FLASH_R + b.w / 2) {
    if (hitBoss(round, b.x, b.y + b.h / 2, FLASH_BOSS_DMG, "flash", k) && b.state === "fight") {
      b.stunMs = FLASH_BOSS_MS;
      if (b.beam) b.beam.on = false;
      round.events.push({ type: "armDaze", kind: b.kind, x: b.x, y: b.y + b.h });
    }
  }
}

const stepFlare = (round, h, ms) => (h.life -= ms) > 0;

function stepSalt(round, h, ms, k) {
  h.life -= ms;
  h.tick -= ms;
  if (h.tick <= 0) {
    h.tick += SALT_TICK_MS;
    const x0 = h.x - SALT_W / 2;
    const x1 = h.x + SALT_W / 2;
    for (const m of round.monsters) {
      if (m.dead || !inBox(m, x0, x1, h.y - 1, h.y + SALT_H) || !(k.solid(m) || SALT_BURIED.has(m.kind))) continue;
      k.hurt(round, m, SALT_DMG, "salt", NO_DROPS);
    }
    sweepDead(round);
    const b = bossUp(round);
    if (b && h.bossDone < SALT_BOSS_MAX && !k.guarded(b) && inBox(b, x0, x1, h.y - 1, h.y + SALT_H) && hitBoss(round, b.x, b.y + 1, SALT_BOSS_TICK, "salt", k)) h.bossDone += SALT_BOSS_TICK;
  }
  return h.life > 0;
}

/* --------------------------------------------------------------- the ball */

function stepBall(round, h, ms, k) {
  const dt = ms / 1000;
  const spec = round.spec;
  h.life -= ms;
  if (h.life <= 0) return false;
  h.roll += h.vx * dt;
  const nx = h.x + h.vx * dt;
  const g = k.groundAt(spec, nx + Math.sign(h.vx) * 0.7);
  // A step up it rides; a wall it bounces off once, and the second stops it.
  if (g > h.y + BALL_STEP) {
    if (h.bounced) return false;
    h.bounced = true;
    h.vx = -h.vx;
    round.events.push({ type: "armBounce", x: h.x, y: h.y });
  } else {
    h.x = nx;
    if (g > h.y) h.y = g;
  }
  const py = h.y;
  h.vy -= k.GRAVITY * dt;
  h.y += h.vy * dt;
  if (h.vy < 0) {
    let top = k.groundAt(spec, h.x);
    for (const [x0, x1, t, kind] of spec.shelves) if (kind !== "crumble" && h.x >= x0 && h.x <= x1 && py >= t - 0.05 && t > top) top = t;
    if (h.y <= top && py >= top - 0.05) {
      h.y = top;
      h.vy = 0;
    }
  }
  if (h.y < k.PIT_Y) return false;
  for (const m of round.monsters) {
    if (m.dead || h.hit.includes(m.id) || !k.solid(m) || !inBox(m, h.x - 0.7, h.x + 0.7, h.y, h.y + 1.4)) continue;
    h.hit.push(m.id);
    k.hurt(round, m, m.h <= BALL_LOW ? BALL_LOW_DMG : BALL_DMG, "ball", NO_DROPS);
  }
  sweepDead(round);
  const b = bossUp(round);
  if (b && !h.hitBoss && inBox(b, h.x - 0.7, h.x + 0.7, h.y, h.y + 1.4)) {
    h.hitBoss = true;
    hitBoss(round, h.x, h.y + 0.7, BALL_BOSS, "ball", k);
  }
  return true;
}

/* -------------------------------------------------------------- the pans */

const PAN_TOOLS = { bossUp, hitBoss, sweepDead, noDrops: NO_DROPS };
const stepPanFlight = (round, h, ms, k) => stepPans(round, h, ms, k, PAN_TOOLS);
const stepPanBurst = (round, h, ms) => (h.life -= ms) > 0;
const FLARE_TOOLS = { ...PAN_TOOLS, flyDown };
const stepRoadFlareFly = (round, h, ms, k) => stepFlareFly(round, h, ms, k, FLARE_TOOLS);
const stepRoadFireBurn = (round, h, ms, k) => stepRoadFire(round, h, ms, k, FLARE_TOOLS);
const stepRocketFlight = (round, h, ms, k) => stepRocket(round, h, ms, k, PAN_TOOLS);

/* --------------------------------------------------------------- the ring */

function stepRing(round, h, ms, k) {
  const you = round.you;
  h.life -= ms;
  h.x = you.x;
  h.y = you.y + k.HIT_H / 2;
  h.r = RING_R * (1 - Math.max(0, h.life) / h.max);
  const reach = (x, y, w, tall) => Math.hypot(h.x - Math.max(x - w / 2, Math.min(x + w / 2, h.x)), h.y - Math.max(y, Math.min(y + tall, h.y))) <= h.r;
  for (const m of round.monsters) {
    if (m.dead || h.hit.includes(m.id) || !reach(m.x, m.y, m.w, m.h)) continue;
    const stone = k.stone(m);
    if (!stone && !k.solid(m)) continue;
    h.hit.push(m.id);
    k.hurt(round, m, stone ? 99 : GHOSTLY.has(m.kind) ? RING_DMG * 2 : RING_DMG, "ring", NO_DROPS);
  }
  sweepDead(round);
  const b = bossUp(round);
  // An organ pipe takes it like a bolt's strike, each once.
  for (const p of b?.pipes || []) {
    if (!p.on || h.hitPipe.includes(p.i) || !reach(p.x, p.y, p.w, p.h)) continue;
    h.hitPipe.push(p.i);
    k.strike(round, { x: p.x, y: p.y + p.h / 2, pipeDmg: RING_PIPE });
  }
  if (b && !h.hitBoss && reach(b.x, b.y, b.w, b.h)) {
    h.hitBoss = true;
    hitBoss(round, b.x, Math.min(b.y + b.h / 2, h.y), RING_BOSS, "ring", k);
  }
  return h.life > 0;
}

/* --------------------------------------------------------------- the trap */

function stepTrap(round, h, ms, k) {
  if (h.shut > 0) return (h.shut -= ms) > 0;
  h.life -= ms;
  if (h.life <= 0) return false;
  if (!h.rest) {
    h.vx = 0;
    if (!flyDown(round, h, ms, k)) return false;
    return true;
  }
  if (h.arm > 0) {
    h.arm -= ms;
    return true;
  }
  const near = (t) => Math.abs(t.x - h.x) <= t.w / 2 + TRAP_W / 2 && Math.abs(t.y - h.y) <= TRAP_REACH;
  for (const m of round.monsters) {
    if (m.dead || !k.solid(m) || k.harmlessNow(m) || !near(m)) continue;
    h.shut = TRAP_PIN_MS;
    round.events.push({ type: "armSnap", kind: m.kind, x: h.x, y: h.y });
    if (!k.hurt(round, m, TRAP_DMG, "trap", NO_DROPS)) m.stunMs = TRAP_PIN_MS;
    sweepDead(round);
    return true;
  }
  const b = bossUp(round);
  if (b && near(b)) {
    h.shut = TRAP_PIN_MS;
    round.events.push({ type: "armSnap", kind: b.kind, x: h.x, y: h.y });
    if (hitBoss(round, h.x, b.y + 1, TRAP_BOSS, "trap", k)) b.stunMs = TRAP_PIN_MS;
  }
  return true;
}

/* -------------------------------------------------------------- each slice */

// Turn toward (tx, ty) by at most `turn` radians, at speed `v`.
function steer(s, tx, ty, turn, v) {
  const want = Math.atan2(ty - s.y, tx - s.x);
  const now = Math.atan2(s.vy, s.vx);
  let da = want - now;
  while (da > Math.PI) da -= Math.PI * 2;
  while (da < -Math.PI) da += Math.PI * 2;
  const a = now + Math.max(-turn, Math.min(turn, da));
  s.vx = Math.cos(a) * v;
  s.vy = Math.sin(a) * v;
}

function stepThrown(round, ms, k) {
  const dt = ms / 1000;
  const you = round.you;
  for (const s of round.shots) {
    if (!s.arm) continue;
    s.t += ms;
    s.spin += dt * (s.arm === "sickle" ? 22 : 16);
    if (s.arm === "sickle") {
      // Out to SICKLE_OUT, then home; it can hit everything again coming back.
      if (!s.back && s.gone >= SICKLE_OUT) {
        s.back = true;
        s.hit = [];
        // Straight round on the spot: a wide turn would dip into the floor.
        steer(s, you.x, you.y + k.HIT_H / 2, Math.PI, SICKLE_SPEED);
        round.events.push({ type: "armTurn", x: s.x, y: s.y });
      }
      if (s.back) {
        const hy = you.y + k.HIT_H / 2;
        steer(s, you.x, hy, 12 * dt, SICKLE_SPEED);
        // Caught, or gone too long.
        if (Math.hypot(s.x - you.x, s.y - hy) < SICKLE_CATCH || s.t > SICKLE_LIFE_MS) s.gone = Infinity;
      }
    }
  }
}

// One slice of the double tap's clocks, the throws in flight, and the rule that
// a boss at half hp never leaves an empty bag empty for long.
function armTick(round, ms, k) {
  const t = round.tap;
  if (t) {
    if (t.down) t.heldMs += ms;
    else if (t.gapMs > 0) {
      t.gapMs = Math.max(0, t.gapMs - ms);
      if (!t.gapMs) t.armed = false;
    }
  }
  if (round.armCool > 0) round.armCool = Math.max(0, round.armCool - ms);
  if (round.armPopMs > 0) round.armPopMs = Math.max(0, round.armPopMs - ms);
  if (round.pieSoundMs > 0) round.pieSoundMs = Math.max(0, round.pieSoundMs - ms);
  if (round.panSoundMs > 0) round.panSoundMs = Math.max(0, round.panSoundMs - ms);
  if (round.rocketSoundMs > 0) round.rocketSoundMs = Math.max(0, round.rocketSoundMs - ms);
  if (round.shots.length) stepThrown(round, ms, k);
  const b = round.boss;
  if (b && b.state === "fight" && !round.armGift && !round.arms.length && b.hp <= round.spec.bossHp / 2 && STAGE_ARMS[round.stage]) {
    round.armGift = true;
    const you = round.you;
    const x = Math.max(round.lockX + 6, Math.min(round.spec.length - 6, you.x + you.face * 10));
    k.dropItem(round, STAGE_ARMS[round.stage], x, Math.min(you.y + 20, 44));
  }
}

/* ------------------------------------------------------------- the pack */

// Plugged into ghoul.js's PACKS: no monsters of its own, its hazards and its tick.
export const ARMS = freeze({
  id: "arms",
  tick: armTick,
  hazards: freeze({ stick: stepStick, blast: stepBlast, armPod: stepPod, armPie: stepPie, armGoop: stepGoop, armFlare: stepFlare, armSplat: stepFlare, armSalt: stepSalt, armBall: stepBall, armPans: stepPanFlight, armPanBurst: stepPanBurst, armRocket: stepRocketFlight, armRocketBoom: stepBoom, armMuzzle: stepMuzzle, armRing: stepRing, armTrap: stepTrap, armRoadFlare: stepRoadFlareFly, armRoadFire: stepRoadFireBurn }),
});
