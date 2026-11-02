// Plan2Code Web Console - Ghoul Rush's Midnight Carnival stage, its rules: the monsters of the fairground (grinners that honk out acid balloons, marionettes that drop on their strings, Mirror You that copies your moves and shots half a second late, strongmen that lob barbells, circus hounds that leap through hoops of fire), the funhouse's conveyor floors, Cotton Candy and the Custard Pie, and its boss, the Ringmaster and his puppet, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds,
// and ghoul-mine.js for `tick`, `harmless`, `solid` and `kill`), every rule here
// is handed a kit `k` of ghoul.js's own helpers, so this file has no imports.
// It uses the pack fields `tick`, `shot` (Cotton Candy, the marionette's
// string), `target` (a bolt strikes a string, which is no monster), `guard`,
// `swoops`, `solid`, `kill` and `fourLegged`, and two small things ghoul.js now
// does for every stage: a room's `belts` (below) and `you.belt`. It draws no
// random number, so a seed plays the same as it did before the stage existed.
//
// The stage's rooms, in order, are CARNIVAL_ROOMS. The dark ride (`darkride`,
// a bonus round with its own pack, ghoul-ride.js) sits before the big top.
//
// `round.twist` = { clock, seq, rec, stand, shots, bolts } holds what Mirror You
// needs: `rec` is a ring of REC_N samples, one per slice of play, of where you
// were (`t` ms on `clock`, `x`, `rise` over the surface you stood on, `face`,
// `duck`, and `fire` when a bolt left that slice); `seq` counts them all; `bolts`
// are Mirror You's bolts in flight. It starts over with each room and each life.
//
// Conveyor belts: a room's `belts` is a list of [x0, x1, speed] stretches of
// the floor (speed in units a second, positive runs right). Standing on the
// floor in one, ghoul.js adds its speed to yours (`you.belt`); it never
// carries a jump already begun, and is always much less than a run, so you
// can run against it. Monsters ignore it.
//
// A grinner walks at you to GRIN_KEEP, then honks a balloon out every GRIN_MS
// (`grinnerHonk`, HONK_MS later the balloon is born). A balloon drifts at you at
// BALLOON_V, level with your chest (a swooper: a ducked Planny is passed
// under), shot or touched it pops (`balloonPop`) into a puddle of acid that
// lies BALLOON_PUDDLE_MS, and on its own it pops after BALLOON_LIFE_MS. A
// balloon on you costs a life (cause balloon), and so does its puddle (acid).
//
// A marionette hangs on its string over the floor (a spawn row names the
// height of its feet). When you pass under it (within MARION_NEAR, your head
// below its feet) it jerks (`marionetteJerk`, MARION_WARN_MS), drops
// (`marionetteDrop`), lands (`marionetteLand`) and dances at you at MARION_V.
// While it hangs, one bolt on the string kills it (`stringCut`): a bolt that
// crosses the string over its head (from a board or a jump), or hits the top
// STRING_SHARE of its body. Otherwise it takes MARION_HP bolts to the body.
//
// Mirror You waits in a panel (act "wait", not solid) till you are within
// MIRROR_NEAR, steps out over MIRROR_STEP_MS (`mirrorStep`) and then copies
// you, MIRROR_DELAY_MS late: your run, mirrored (it moves where you moved,
// the other way), your jumps and ducking, and a bolt for every bolt you fire
// (`mirrorShot`), flying back at MBOLT_V the other way. It drifts at you at
// MIRROR_DRIFT. Its bolt and a bolt of yours cancel when they meet
// (`mirrorCancel`; a thrown weapon destroys the bolt and flies on). Stunned (a
// pie) it stands still, copies nothing and fires nothing for the stun. It
// shatters when it dies (`mirrorShatter`).
//
// A strongman is a Glutton that lobs a barbell (the game's `throw` with the
// bone kind "barbell", cause barbell) every STRONG_MS from STRONG_MIN to
// STRONG_RANGE away, winding up STRONG_WIND_MS first (`strongWind`).
//
// A circus hound prowls at HOUND_V; within HOUND_RANGE it crouches HOUND_CROUCH_MS
// (`houndCrouch`, the hoop flares), then leaps (`houndLeap`) in an arc
// that comes down where you stand, rests HOUND_REST_MS and does it again. The
// leap is a swoop: a ducked Planny is passed over. A caged one bursts out
// (act "burst", not solid, HOUND_BURST_MS).
//
// Cotton Candy (`floss`, timed): a bolt that hits a monster slows it to
// FLOSS_SLOW of its speed for FLOSS_SLOW_MS (`m.hasteMs` and `m.haste`, the
// Choirmaster's own mechanism, and `m.floss` for the art).
//
// The Ringmaster works a giant puppet from a gantry high over the ring, which
// follows the puppet at a lag. The puppet hangs on three strings (head and both
// hands, `b.strings`, `hp` each) from the gantry, so as it moves the strings
// angle with it (`stringSegs`, from the limbs' places in `limbs`). It follows a
// fixed script (SCRIPT, no random draw) of moves with a stalk (a walk at you,
// stopping STALK_STOP short) between them:
//   stomp: `puppetWind`, STOMP_WIND_MS of shadow, `puppetStomp` (a `pfoot`
//     hazard and a shockwave each way, cause puppet);
//   leap: `puppetCrouch`, then `puppetLeap` and a flight to where you stood (a
//     shadow there the whole way), landing as a stomp;
//   whip: `lashWind`, LASH_WIND_MS, then `lashCrack`: a `lash` hazard along the level
//     of the surface you stand on, chest high, LASH_LEN long, cause lash: duck it,
//     jump it, or on a board drop or jump;
//   charge: `puppetRear`, then `puppetCharge`: a `pcharge` hazard along the floor
//     to the wall (jump it), `puppetCrash` and a dazed second.
// A bolt that crosses a string cuts into it (`stringHit`, `stringCut` at none). All
// three cut: the puppet collapses where it stands (`puppetDown`) and does not move,
// the gantry lowers him to the ring (DESCEND_MS) and he is open OPEN_MS (`ringOpen`):
// only then can he be hurt (`guard`, so shots show `bossBlock` otherwise). He climbs
// back (`ringClimb`, CLIMB_MS), ties the strings again (`ringString`) and the puppet
// is up where he stands. At RAGE_SHARE of his hp (`ringRage`) every wait is RAGE_QUICK
// as long, the strings take RAGE_STRING_HP, and hounds are let out of the cages
// (`cageOpen`, never more than HOUND_CAP alive), more each time he ties the strings.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  grinner: freeze({ name: "Grinner", w: 3.4, h: 5.4, hp: 4, speed: 6, points: 220, stomp: true, head: true, color: "#c0402a" }),
  balloon: freeze({ name: "Acid Balloon", w: 2.4, h: 3.2, hp: 1, speed: 7, points: 60, stomp: false, head: false, color: "#9acd32" }),
  marionette: freeze({ name: "Marionette", w: 2.6, h: 5, hp: 4, speed: 12, points: 200, stomp: true, head: false, perch: true, color: "#c9a06a" }),
  mirror: freeze({ name: "Mirror You", w: 3, h: 5, hp: 3, speed: 0, points: 250, stomp: true, head: false, color: "#bfe8ff" }),
  strongman: freeze({ name: "Strongman", w: 5.4, h: 6.4, hp: 14, speed: 5, points: 300, stomp: true, stompDamage: 4, head: true, color: "#6a1a10" }),
  circushound: freeze({ name: "Circus Hound", w: 3.8, h: 2.8, hp: 3, speed: 15, points: 180, stomp: true, head: false, color: "#c8641a" }),
});

export const BOSSES = freeze({
  ringmaster: freeze({ name: "The Ringmaster", sub: "Shoot the strings, not the puppet", w: 6, h: 8.5, hp: 90, points: 4000, color: "#b8202a" }),
});

// Every event this pack puts on the field, for the art and the sounds to
// answer (a hit, a kill, a spawn, a throw and a boss's wake, hit and fall are
// the game's own; the Custard Pie's splat is ghoul-arms.js's).
export const EVENTS = freeze([
  "grinnerHonk", "balloonPop", "marionetteJerk", "marionetteDrop", "marionetteLand", "stringHit", "stringCut",
  "mirrorStep", "mirrorShot", "mirrorCancel", "mirrorShatter", "strongWind", "strongThrow", "barbellLand", "houndCrouch", "houndLeap", "houndLand", "cageOpen", "flossStick",
  "puppetWind", "puppetStomp", "puppetCrouch", "puppetLeap", "puppetRear", "puppetCharge", "puppetCrash", "puppetDown", "ringOpen", "ringClimb", "ringString", "lashWind", "lashCrack", "ringRage",
]);

// The stage's rooms, in order.
export const CARNIVAL_ROOMS = freeze(["midway", "mirrors", "funhouse", "darkride", "bigtop"]);
const IN_CARNIVAL = new Set(CARNIVAL_ROOMS);

// A grinner: walks at GRINNER_V to GRIN_KEEP from you, honks a balloon every
// GRIN_MS (the first GRIN_FIRST_MS after it wakes) within GRIN_RANGE of you,
// HONK_MS of wind-up. No more than BALLOON_CAP balloons alive.
export const GRINNER_V = 6;
export const GRIN_KEEP = 14;
export const GRIN_RANGE = 42;
export const GRIN_MS = 3400;
export const GRIN_FIRST_MS = 1200;
export const HONK_MS = 480;
// A balloon: BALLOON_V across, RISE over the surface you stand on (its bottom),
// gone on its own after BALLOON_LIFE_MS; its puddle lies BALLOON_PUDDLE_MS.
export const BALLOON_V = 7;
export const BALLOON_RISE = 1;
export const BALLOON_LIFE_MS = 9000;
export const BALLOON_PUDDLE_MS = 2000;
export const BALLOON_CAP = 4;
// A marionette.
export const MARION_NEAR = 5;
export const MARION_WARN_MS = 380;
export const MARION_V = 12;
export const MARION_HP = 4;
export const STRING_SHARE = 0.35;
export const STRING_R = 0.9;
// Mirror You.
export const MIRROR_NEAR = 38;
export const MIRROR_STEP_MS = 600;
export const MIRROR_DELAY_MS = 500;
export const MIRROR_DRIFT = 5;
export const MBOLT_V = 80;
export const MBOLT_Y = 2.8;
export const MBOLT_RANGE = 90;
export const MBOLT_CAP = 8;
export const CANCEL_R = 1.3;
export const REC_N = 192;
// A strongman.
export const STRONG_MS = 3400;
export const STRONG_FIRST_MS = 1500;
export const STRONG_WIND_MS = 600;
export const STRONG_MIN = 10;
export const STRONG_RANGE = 46;
// A circus hound: leaps up at HOUND_VY, to come down on you, no faster across
// than HOUND_VX_MAX.
export const HOUND_V = 15;
export const HOUND_RANGE = 24;
export const HOUND_CROUCH_MS = 450;
export const HOUND_VY = 50;
export const HOUND_VX_MAX = 60;
export const HOUND_REST_MS = 800;
export const HOUND_BURST_MS = 500;
export const HOUND_CAP = 3;
// Cotton Candy: what a bolt that hits slows a monster to, and for how long.
export const FLOSS_SLOW = 0.5;
export const FLOSS_SLOW_MS = 3000;

// The Ringmaster. The gantry's feet are PLAT_Y over the room's bottom, the
// puppet's head PUP_HEAD_Y and hands PUP_HAND_Y (PUP_REACH either side of it);
// the three strings run from the gantry (4 either side) to them, so they angle
// as the puppet moves: the gantry follows at GANTRY_V, never more than
// GANTRY_LAG behind. Between moves the puppet stalks you at PUP_V (always under
// your run), stopping STALK_STOP short (8 to 10).
export const PLAT_Y = 39;
export const PUP_HEAD_Y = 24;
export const PUP_HAND_Y = 15;
export const PUP_REACH = 6.5;
export const PUP_V = 10;
export const STALK_STOP = 9;
export const GANTRY_V = 7;
export const GANTRY_LAG = 14;
export const STRING_HP = 3;
export const RAGE_STRING_HP = 5;
// The script, one move after another and round again (no random draw); "stalk"
// is a long walk at you with no attack. Enraged, the whip cracks twice running
// (the second does not use up a place in the script).
export const SCRIPT = freeze(["leap", "stomp", "whip", "charge", "leap", "whip", "stalk"]);
export const STALK_MS = 2000;
// A move's wind-up (a leap's crouch, a charge's rear) is never under
// WIND_FLOOR_MS, however fast the depth.
export const WIND_FLOOR_MS = 520;
// A stomp (STOMP_WIND_MS of shadow, a foot PFOOT_W wide for STOMP_LIVE_MS, shockwaves for WAVE_MS), a rest
// STOMP_REST_MS; a whip (LASH_WIND_MS, locked LASH_LOCK_MS
// before the crack, LASH_LEN long, LASH_H high with its underside LASH_Y over
// your surface, live LASH_LIVE_MS), a rest LASH_REST_MS.
export const FIRST_WORK_MS = 2200;
export const STOMP_WIND_MS = 750;
export const STOMP_LIVE_MS = 280;
export const STOMP_REST_MS = 1100;
export const PFOOT_W = 9;
export const PFOOT_H = 6;
export const WAVE_MS = 2600;
export const LASH_WIND_MS = 700;
export const LASH_LOCK_MS = 150;
export const LASH_LIVE_MS = 240;
export const LASH_REST_MS = 1000;
export const LASH_LEN = 70;
export const LASH_Y = 2.7;
export const LASH_H = 1.6;
// A leap: crouch CROUCH_MS (puppetCrouch), then it flies LEAP_MIN_MS to
// LEAP_MAX_MS (the farther the longer, LEAP_SPEED across) LEAP_H high, to land on
// where you stood when it left the ground (LEAP_LEAD further on if you were
// running; a ground shadow marks the spot the whole flight). The landing is the
// stomp's foot and waves; a squash SQUASH_MS, a rest LEAP_REST_MS.
export const CROUCH_MS = 580;
export const LEAP_MIN_MS = 800;
export const LEAP_MAX_MS = 1100;
export const LEAP_SPEED = 55;
export const LEAP_H = 10;
export const LEAP_LEAD = 8;
export const SQUASH_MS = 260;
export const LEAP_REST_MS = 900;
// A charge: it rears REAR_MS (puppetRear), backing off at REAR_BACK_V for a
// run-up (its lane is locked REAR_LOCK_MS before it goes), then runs along the
// floor at CHARGE_V (puppetCharge; a hit box CHARGE_W wide and CHARGE_H high from
// the floor: a jump clears it, a duck does not) to the arena wall and crashes
// (puppetCrash). It is dazed CRASH_MS (no hit on its body counts; the strings can
// still be cut), then rests CHARGE_REST_MS.
export const REAR_MS = 780;
export const REAR_LOCK_MS = 200;
export const REAR_BACK_V = 12;
export const CHARGE_V = 40;
export const CHARGE_W = 6.4;
export const CHARGE_H = 6;
export const CRASH_MS = 1000;
export const CHARGE_REST_MS = 800;
// Puppet down: the gantry lowers him in DESCEND_MS, he is open OPEN_MS, climbs back in CLIMB_MS and rests TIE_MS.
export const DESCEND_MS = 500;
export const OPEN_MS = 4000;
export const CLIMB_MS = 700;
export const TIE_MS = 800;
export const RAGE_SHARE = 0.5;
export const RAGE_QUICK = 0.75;
export const RAGE_HOUNDS = 2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inView = (round, m, k) => m.x > round.camX - 2 && m.x < round.camX + k.FIELD_W + 2;
const alive = (round, kind) => round.monsters.filter((m) => !m.dead && m.kind === kind).length;
const NO_DROPS = () => 1;
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (k) => k * k * (3 - 2 * k);

/* ------------------------------------------------------------ the twist */

function newTwist() {
  return { clock: 0, seq: 0, rec: Array.from({ length: REC_N }, () => ({ t: 0, x: 0, rise: 0, face: 1, duck: false, fire: false })), stand: 0, shots: -1, bolts: [] };
}

// You, as of this slice, in the ring of samples Mirror You reads.
function record(round, tw, ms) {
  const you = round.you;
  tw.clock += ms;
  if (tw.shots < 0) tw.shots = round.stats.shots;
  if (you.state === "run") tw.stand = you.y;
  const fired = round.stats.shots > tw.shots;
  tw.shots = round.stats.shots;
  const s = tw.rec[tw.seq % REC_N];
  s.t = tw.clock;
  s.x = you.x;
  s.rise = Math.max(0, you.y - tw.stand);
  s.face = you.face;
  s.duck = Boolean(you.ducking);
  s.fire = fired;
  tw.seq++;
}

// Mirror You's bolts in flight: cancelling yours, or striking you.
function stepBolts(round, tw, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  let n = 0;
  for (const b of tw.bolts) {
    b.x += b.vx * dt;
    b.gone += Math.abs(b.vx) * dt;
    let dead = b.gone > MBOLT_RANGE || b.x < round.camX - 6 || b.x > round.camX + k.FIELD_W + 6 || k.groundAt(round.spec, b.x) > b.y;
    if (!dead) {
      for (let i = 0; i < round.shots.length; i++) {
        const s = round.shots[i];
        if (Math.hypot(s.x - b.x, s.y - b.y) > CANCEL_R) continue;
        dead = true;
        if (!s.arm) round.shots.splice(i, 1);
        round.events.push({ type: "mirrorCancel", x: b.x, y: b.y });
        break;
      }
    }
    if (!dead && you.out <= 0 && Math.abs(b.x - you.x) < k.HIT_W / 2 + 0.4 && b.y > you.y - 0.2 && b.y < you.y + (you.ducking ? k.DUCK_H : k.HIT_H)) {
      dead = true;
      k.struck(round, "mirrorbolt");
    }
    if (!dead) tw.bolts[n++] = b;
  }
  tw.bolts.length = n;
}

/* ------------------------------------------------------------- grinners */

function moveGrinner(round, m, ms, k) {
  const you = round.you;
  const dx = you.x - m.x;
  m.dir = k.towardYou(round, m);
  if (m.cool === undefined) m.cool = GRIN_FIRST_MS;
  m.cool = Math.max(0, m.cool - ms);
  if (m.act === "honk") {
    m.wait -= ms;
    if (m.wait > 0) return;
    m.act = "walk";
    m.cool = GRIN_MS;
    if (alive(round, "balloon") < BALLOON_CAP) k.spawnMonster(round, "balloon", m.x + m.dir * 2, m.y + m.h * 0.7, { force: true, dir: m.dir });
    return;
  }
  m.act = "walk";
  if (Math.abs(dx) > GRIN_KEEP) k.walk(round, m, m.dir, GRINNER_V * round.spec.pace, ms / 1000);
  if (m.cool > 0 || you.out > 0 || Math.abs(dx) > GRIN_RANGE || !inView(round, m, k) || alive(round, "balloon") >= BALLOON_CAP) return;
  Object.assign(m, { act: "honk", wait: HONK_MS });
  round.events.push({ type: "grinnerHonk", kind: m.kind, x: m.x, y: m.y + m.h * 0.7 });
}

// A balloon's acid, lying where it fell.
function drip(round, m, k) {
  const g = k.groundAt(round.spec, m.x);
  if (g > -Infinity) round.puddles.push({ id: m.id, x: m.x, y: g, life: BALLOON_PUDDLE_MS });
  round.events.push({ type: "balloonPop", kind: m.kind, x: m.x, y: m.y + m.h / 2, floor: g > -Infinity ? g : null });
}

function moveBalloon(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  m.life = (m.life ?? BALLOON_LIFE_MS) - ms;
  if (m.life <= 0) {
    m.dead = true;
    drip(round, m, k);
    return;
  }
  const toward = k.towardYou(round, m);
  m.dir = toward;
  if (Math.abs(you.x - m.x) >= 1) m.x += toward * BALLOON_V * round.spec.pace * dt;
  const ty = you.y + BALLOON_RISE;
  m.y = clamp(m.y + clamp((ty - m.y) * 2.4, -7, 7) * dt + Math.sin(m.t / 330) * 0.35 * dt * 6, k.groundAt(round.spec, m.x) + 0.4, k.CHANDELIER_Y);
}

/* --------------------------------------------------------- marionettes */

function moveMarionette(round, m, ms, k) {
  const you = round.you;
  const dt = ms / 1000;
  const at = () => ({ kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  if (m.home === undefined) m.home = m.y;
  if (m.act === "hang") {
    m.dir = k.towardYou(round, m);
    if (you.out > 0 || !inView(round, m, k) || Math.abs(you.x - m.x) > MARION_NEAR || you.y + k.HIT_H > m.y + 0.3) return;
    Object.assign(m, { act: "warn", wait: MARION_WARN_MS });
    round.events.push({ type: "marionetteJerk", ...at() });
    return;
  }
  if (m.act === "warn") {
    m.wait -= ms;
    if (m.wait > 0) return;
    Object.assign(m, { act: "drop", vy: 0 });
    round.events.push({ type: "marionetteDrop", ...at() });
    return;
  }
  if (m.act === "drop") {
    m.vy = Math.max(-k.FALL_MAX, m.vy - k.GRAVITY * dt);
    m.y += m.vy * dt;
    const g = k.groundAt(round.spec, m.x);
    if (m.y > g) return;
    Object.assign(m, { y: Math.max(g, k.PIT_Y - 1), vy: 0, act: "dance" });
    if (g === -Infinity) m.dead = true;
    else round.events.push({ type: "marionetteLand", ...at(), floor: g });
    return;
  }
  m.dir = k.towardYou(round, m);
  k.walk(round, m, m.dir, MARION_V * round.spec.pace, dt);
}

// Whether a marionette is still on its string.
const strung = (m) => m.kind === "marionette" && (m.act === "hang" || m.act === "warn");

/* ----------------------------------------------------------- Mirror You */

function moveMirror(round, m, ms, k) {
  const you = round.you;
  const tw = round.twist;
  const spec = round.spec;
  if (!tw) return;
  if (m.act === "wait") {
    if (Math.abs(you.x - m.x) > MIRROR_NEAR || !inView(round, m, k) || you.out > 0) return;
    Object.assign(m, { act: "step", wait: MIRROR_STEP_MS, dir: -you.face });
    round.events.push({ type: "mirrorStep", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
    return;
  }
  if (m.act === "step") {
    m.wait -= ms;
    if (m.wait <= 0) Object.assign(m, { act: "copy", cursor: tw.seq, px: you.x, at: tw.clock, rise: 0, duck: false });
    return;
  }
  // Left standing by a stun: start reading from now, so it does not leap to catch up.
  if (tw.clock - m.at > 60 || m.cursor < tw.seq - REC_N + 2) {
    m.cursor = tw.seq;
    m.px = tw.seq ? tw.rec[(tw.seq - 1) % REC_N].x : you.x;
  }
  m.at = tw.clock;
  const horizon = tw.clock - MIRROR_DELAY_MS;
  let dx = 0;
  let shot = null;
  while (m.cursor < tw.seq) {
    const s = tw.rec[m.cursor % REC_N];
    if (s.t > horizon) break;
    dx += s.x - m.px;
    m.px = s.x;
    m.rise = s.rise;
    m.duck = s.duck;
    m.dir = -s.face;
    if (s.fire) shot = s;
    m.cursor++;
  }
  const drift = Math.abs(you.x - m.x) > 1 ? Math.sign(you.x - m.x) * MIRROR_DRIFT * (ms / 1000) : 0;
  const nx = clamp(m.x - dx + drift, 2, spec.length - 2);
  const g0 = k.groundAt(spec, m.x);
  const g = k.groundAt(spec, nx);
  if (nx !== m.x && g > -Infinity && Math.abs(g - g0) <= 3) m.x = nx;
  m.y = k.groundAt(spec, m.x) + m.rise;
  if (shot && inView(round, m, k) && tw.bolts.length < MBOLT_CAP) {
    tw.bolts.push({ x: m.x + m.dir * 1.8, y: m.y + (m.duck ? 1.4 : MBOLT_Y), vx: m.dir * MBOLT_V, gone: 0 });
    round.events.push({ type: "mirrorShot", kind: m.kind, x: m.x + m.dir * 1.8, y: m.y + MBOLT_Y, dir: m.dir });
  }
}

function shatter(round, m) {
  round.events.push({ type: "mirrorShatter", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

/* ------------------------------------------------------------ strongmen */

function moveStrongman(round, m, ms, k) {
  const you = round.you;
  const dx = you.x - m.x;
  m.dir = k.towardYou(round, m);
  if (m.cool === undefined) m.cool = STRONG_FIRST_MS;
  m.cool = Math.max(0, m.cool - ms);
  if (m.act === "wind") {
    m.wait -= ms;
    if (m.wait > 0) return;
    const b = k.throwBone(round, m.x + m.dir * 2.4, m.y + m.h * 0.9, 1, "barbell", m.kind);
    b.cause = "barbell";
    round.events.push({ type: "strongThrow", kind: m.kind, x: b.x, y: b.y, dir: m.dir });
    Object.assign(m, { act: "walk", cool: STRONG_MS });
    return;
  }
  m.act = "walk";
  k.walk(round, m, m.dir, 5 * round.spec.pace, ms / 1000);
  const gap = Math.abs(dx);
  if (m.cool > 0 || you.out > 0 || gap < STRONG_MIN || gap > STRONG_RANGE || !inView(round, m, k)) return;
  Object.assign(m, { act: "wind", wait: STRONG_WIND_MS });
  round.events.push({ type: "strongWind", kind: m.kind, x: m.x, y: m.y + m.h * 0.8, dir: m.dir });
}

/* ---------------------------------------------------------- circus hounds */

function moveHound(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const dt = ms / 1000;
  const pace = spec.pace;
  const at = () => ({ kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  if (m.act === "leap") {
    const py = m.y;
    const nx = m.x + m.vx * dt;
    if (k.groundAt(spec, nx + Math.sign(m.vx || 1) * m.w * 0.4) <= m.y + 0.05) m.x = nx;
    m.vy = Math.max(-k.FALL_MAX, m.vy - k.GRAVITY * dt);
    m.y += m.vy * dt;
    const g = k.groundAt(spec, m.x);
    if (m.vy < 0 && py >= g && m.y <= g) {
      Object.assign(m, { y: g, vx: 0, vy: 0, act: "rest", wait: HOUND_REST_MS });
      round.events.push({ type: "houndLand", ...at(), dir: m.dir });
    }
    if (m.y < k.PIT_Y) m.dead = true;
    return;
  }
  if (m.act === "burst" || m.act === "rest" || m.act === "crouch") {
    m.wait -= ms * (m.act === "crouch" ? 1 : pace);
    if (m.wait > 0) return;
    if (m.act === "crouch") {
      const t = (2 * HOUND_VY) / k.GRAVITY;
      Object.assign(m, { act: "leap", vx: clamp((you.x - m.x) / t, -HOUND_VX_MAX, HOUND_VX_MAX), vy: HOUND_VY });
      m.dir = Math.sign(m.vx) || m.dir;
      round.events.push({ type: "houndLeap", ...at(), dir: m.dir });
      return;
    }
    m.act = "prowl";
  }
  m.dir = k.towardYou(round, m);
  if (Math.abs(you.x - m.x) < HOUND_RANGE && Math.abs(you.y - m.y) < 8 && you.out <= 0 && inView(round, m, k)) {
    Object.assign(m, { act: "crouch", wait: HOUND_CROUCH_MS });
    round.events.push({ type: "houndCrouch", ...at(), dir: m.dir });
    return;
  }
  m.act = "prowl";
  k.walk(round, m, m.dir, HOUND_V * pace, dt);
}

// Hounds out of the arena's cages, up to the cap.
function releaseHounds(round, b, n, k) {
  const spec = round.spec;
  const cages = [spec.arena + 8, spec.length - 8];
  for (let i = 0; i < n && alive(round, "circushound") < HOUND_CAP; i++) {
    const x = cages[(b.cages + i) % 2];
    k.spawnMonster(round, "circushound", x, k.groundAt(spec, x), { force: true, act: "burst", wait: HOUND_BURST_MS });
    round.events.push({ type: "cageOpen", kind: "circushound", x, y: k.groundAt(spec, x) + 3 });
  }
  b.cages += n;
}

/* ----------------------------------------------------- bolts: floss, strings */

// A bolt that hit a monster: Cotton Candy slows it, and a hanging marionette
// hit near its string (the top of its body) dies there (a damage it cannot survive).
function shotRule(round, m, s) {
  if (round.effects.floss > 0 && !s.arm) {
    Object.assign(m, { hasteMs: FLOSS_SLOW_MS, haste: FLOSS_SLOW, floss: true });
    round.events.push({ type: "flossStick", kind: m.kind, x: s.x, y: s.y });
  }
  if (strung(m) && s.y > m.y + m.h * (1 - STRING_SHARE)) {
    round.events.push({ type: "stringCut", kind: m.kind, x: m.x, y: m.y + m.h, what: "marionette" });
    return 99;
  }
  return 1;
}

// The distance from (px, py) to the segment (x0, y0)-(x1, y1).
function toSegment(px, py, x0, y0, x1, y1) {
  const vx = x1 - x0;
  const vy = y1 - y0;
  const t = clamp(((px - x0) * vx + (py - y0) * vy) / (vx * vx + vy * vy || 1), 0, 1);
  return Math.hypot(px - (x0 + vx * t), py - (y0 + vy * t));
}

// The puppet's three strings as segments, from the gantry's crossbar to the head and each hand (head, left hand, right hand): as the puppet moves and the gantry lags they angle, and a bolt is tested against where they are now.
export function stringSegs(b) {
  const top = b.y + 1;
  const [h, l, r] = limbs(b);
  return [
    { i: 0, x0: b.x, y0: top, x1: h[0], y1: h[1] },
    { i: 1, x0: b.x - 4, y0: top, x1: l[0], y1: l[1] },
    { i: 2, x0: b.x + 4, y0: top, x1: r[0], y1: r[1] },
  ];
}

// A bolt that crosses a marionette's string or one of the puppet's strings.
function target(round, s, k) {
  for (const m of round.monsters) {
    if (m.dead || !strung(m) || Math.abs(s.x - m.x) > STRING_R || s.y < m.y + m.h) continue;
    k.hurt(round, m, 99, "string", NO_DROPS);
    round.events.push({ type: "stringCut", kind: m.kind, x: m.x, y: s.y, what: "marionette" });
    return !s.arm;
  }
  const b = round.boss;
  if (!b || b.kind !== "ringmaster" || b.state !== "fight" || b.puppet !== "up") return false;
  const seen = (s.cut ||= []);
  for (const g of stringSegs(b)) {
    const st = b.strings[g.i];
    if (st.hp <= 0 || seen.includes(g.i) || toSegment(s.x, s.y, g.x0, g.y0, g.x1, g.y1) > STRING_R) continue;
    seen.push(g.i);
    st.hp--;
    st.hurt = 160;
    const px = lerp(g.x0, g.x1, clamp((g.y0 - s.y) / (g.y0 - g.y1), 0, 1));
    round.events.push({ type: st.hp > 0 ? "stringHit" : "stringCut", kind: b.kind, x: px, y: s.y, i: g.i, hp: st.hp, what: "puppet" });
    if (b.strings.every((q) => q.hp <= 0)) puppetDown(round, b, k);
    return !s.arm;
  }
  return false;
}

/* ------------------------------------------------------------ the twist (tick) */

function tick(round, ms, k) {
  const spec = round.spec;
  if (!IN_CARNIVAL.has(spec.id)) return;
  const tw = (round.twist ||= newTwist());
  if (round.you.out <= 0) record(round, tw, ms);
  if (tw.bolts.length) stepBolts(round, tw, ms, k);
  const b = round.boss;
  if (b && b.kind === "ringmaster" && !b.rm && b.state !== "down") initRingmaster(round, b, k);
  if (b && b.rm && b.puppet === "up") for (const st of b.strings) st.hurt = Math.max(0, st.hurt - ms);
}

/* ---------------------------------------------------------- the Ringmaster */

const mkStrings = (hp) => [0, 1, 2].map(() => ({ hp, max: hp, hurt: 0 }));
const rage = (b) => b.hp <= b.max * RAGE_SHARE;
const quick = (round, b, ms) => (ms * (b.raged ? RAGE_QUICK : 1)) / round.spec.pace;
const at = (b, up = 0.5) => ({ kind: b.kind, x: b.x, y: b.y + b.h * up });
// A wind-up's length at this depth: faster deeper, never under WIND_FLOOR_MS.
const windMs = (round, ms) => Math.max(WIND_FLOOR_MS, ms / round.spec.pace);

// The gantry high over the ring, the puppet standing under it, all three strings tied.
function initRingmaster(round, b, k) {
  const spec = round.spec;
  const px = spec.arena + 56;
  Object.assign(b, { rm: true, act: "idle", wait: FIRST_WORK_MS, x: px, y: PLAT_Y, px, puppet: "up", open: false, moves: 0, strings: mkStrings(STRING_HP), floor: k.groundAt(spec, px), cages: 0, lashY: 0, lashDir: 1, raged: false, again: false, chain: 0 });
  Object.assign(b, { pdir: -1, cdir: -1, lift: 0, crouch: 0, stretch: 0, rear: 0, lean: 0, squash: 0, walk: 0, dazed: false, toX: px, fromX: px, air: 0, airMs: LEAP_MIN_MS, total: 1 });
  b.pts = limbs(b);
}

// Where the puppet's head and two hands are (the strings' lower ends), from its
// pose: `lift` (a leap), `crouch`, `stretch`, `rear` (0 to 1) and `lean` (-1 to 1,
// toward the way it faces). At rest and walking: the head at PUP_HEAD_Y, the hands
// PUP_REACH either side at PUP_HAND_Y.
export function limbs(b) {
  const lift = b.lift || 0;
  const c = b.crouch || 0;
  const s = b.stretch || 0;
  const r = b.rear || 0;
  const l = b.lean || 0;
  const hy = PUP_HAND_Y + lift - c * 2.5 + r * 4 + s * 3.5;
  const reach = PUP_REACH + s * 1.2 + c * 0.8;
  const hx = -l * 1.5;
  return [
    [b.px + l * 3, PUP_HEAD_Y + lift - c * 2.8 + r * 1.5 + s],
    [b.px - reach + hx, hy],
    [b.px + reach + hx, hy],
  ];
}

// Every string cut: the puppet collapses and the gantry lowers him to the ring.
function puppetDown(round, b, k) {
  const you = round.you;
  b.puppet = "down";
  b.act = "fall";
  b.wait = DESCEND_MS;
  b.fromX = b.x;
  Object.assign(b, { lift: 0, crouch: 0, stretch: 0, rear: 0, lean: 0, squash: 0, walk: 0, dazed: false });
  b.landX = clamp(b.px + (Math.abs(you.x - b.px) < 9 ? (you.x >= b.px ? -10 : 10) : 0), k.arenaMin(round, b), k.arenaMax(round, b));
  round.events.push({ type: "puppetDown", kind: b.kind, x: b.px, y: b.floor + 6, big: true });
}

// The foot comes down at x: a pfoot hazard and a shockwave each way.
function stomp(round, b, x = b.px) {
  const floor = b.floor;
  round.hazards.push({ kind: "pfoot", x, y: floor, w: PFOOT_W, h: PFOOT_H, live: STOMP_LIVE_MS, max: STOMP_LIVE_MS, cause: "puppet" });
  for (const d of [-1, 1]) round.waves.push({ x: x + d * (PFOOT_W / 2), y: floor, dir: d, life: WAVE_MS, kind: "puppet", cause: "puppet" });
  round.events.push({ type: "puppetStomp", kind: b.kind, x, y: floor, big: true });
}

// The whip: its level is the surface you stand on (the floor in the air), chest high.
const lashLevel = (round, b) => (round.you.state === "run" ? round.you.y : b.floor) + LASH_Y;

// The charge's hit box rides on the puppet while it runs, and is gone when it stops.
function stepCharge(round, h) {
  const b = round.boss;
  if (!b || b.kind !== "ringmaster" || b.act !== "charge" || b.state !== "fight" || b.puppet !== "up") return false;
  h.x = b.px;
  h.dir = b.cdir;
  return true;
}

// Between moves the puppet walks at you and stops STALK_STOP short; true when it moved.
function stalk(round, b, ms, lo, hi) {
  const dx = round.you.x - b.px;
  const gap = Math.abs(dx);
  const dir = Math.sign(dx) || b.pdir;
  b.pdir = dir;
  if (gap <= STALK_STOP) return;
  const px = clamp(b.px + dir * Math.min(PUP_V * round.spec.pace * (ms / 1000), gap - STALK_STOP), lo, hi);
  b.walk = Math.abs(px - b.px) / (ms / 1000);
  b.px = px;
}

// The next move of the script.
function pick(round, b) {
  const you = round.you;
  const pace = round.spec.pace;
  const move = b.again ? "whip" : SCRIPT[b.moves % SCRIPT.length];
  if (!b.again) b.moves++;
  b.again = false;
  b.move = move;
  if (move === "whip") {
    Object.assign(b, { act: "lashWind", wait: LASH_WIND_MS / pace, lashDir: Math.sign(you.x - b.x) || 1 });
    b.lashY = lashLevel(round, b);
    round.events.push({ type: "lashWind", ...at(b), dir: b.lashDir });
  } else if (move === "stomp") {
    Object.assign(b, { act: "stompWind", wait: STOMP_WIND_MS / pace });
    round.events.push({ type: "puppetWind", kind: b.kind, x: b.px, y: b.floor });
  } else if (move === "leap") {
    b.total = windMs(round, CROUCH_MS);
    Object.assign(b, { act: "crouch", wait: b.total });
    round.events.push({ type: "puppetCrouch", kind: b.kind, x: b.px, y: b.floor, dir: b.pdir });
  } else if (move === "charge") {
    b.total = windMs(round, REAR_MS);
    Object.assign(b, { act: "rear", wait: b.total, cdir: Math.sign(you.x - b.px) || b.pdir });
    round.events.push({ type: "puppetRear", kind: b.kind, x: b.px, y: b.floor, dir: b.cdir });
  } else Object.assign(b, { act: "stalk", wait: quick(round, b, STALK_MS) });
}

function moveRingmaster(round, b, ms, random, k) {
  const spec = round.spec;
  const you = round.you;
  const dt = ms / 1000;
  const pace = spec.pace;
  if (!b.rm) initRingmaster(round, b, k);
  if (!b.raged && rage(b)) {
    b.raged = true;
    round.events.push({ type: "ringRage", ...at(b) });
    releaseHounds(round, b, RAGE_HOUNDS, k);
  }
  b.dir = Math.sign(you.x - b.x) || b.dir;
  const lo = k.arenaMin(round, b);
  const hi = k.arenaMax(round, b);
  if (b.act === "fall") {
    b.wait -= ms;
    const t = clamp(1 - b.wait / DESCEND_MS, 0, 1);
    b.y = lerp(PLAT_Y, b.floor, t * t);
    b.x = lerp(b.fromX, b.landX, t);
    if (b.wait > 0) return;
    Object.assign(b, { y: b.floor, x: b.landX, act: "open", open: true, wait: OPEN_MS });
    round.events.push({ type: "ringOpen", ...at(b), big: true });
    return;
  }
  if (b.act === "open") {
    b.wait -= ms;
    if (b.wait > 0) return;
    Object.assign(b, { act: "climb", open: false, wait: CLIMB_MS });
    round.events.push({ type: "ringClimb", ...at(b) });
    return;
  }
  if (b.act === "climb") {
    b.wait -= ms;
    const t = clamp(1 - b.wait / CLIMB_MS, 0, 1);
    b.y = lerp(b.floor, PLAT_Y, t);
    if (b.wait > 0) return;
    Object.assign(b, { y: PLAT_Y, px: clamp(b.x, lo, hi), x: clamp(b.x, lo, hi), puppet: "up", strings: mkStrings(b.raged ? RAGE_STRING_HP : STRING_HP), act: "rest", wait: quick(round, b, TIE_MS) });
    b.pts = limbs(b);
    round.events.push({ type: "ringString", ...at(b) });
    if (b.raged) releaseHounds(round, b, 1, k);
    return;
  }
  // The puppet is up: the pose is rebuilt every slice from what it is doing.
  Object.assign(b, { lift: 0, crouch: 0, stretch: 0, rear: 0, lean: 0, walk: 0, dazed: false });
  b.squash = Math.max(0, b.squash - ms);
  if (b.squash > 0) b.crouch = ease(b.squash / SQUASH_MS) * 0.7;
  b.wait -= ms;
  if (b.act === "idle" || b.act === "rest" || b.act === "stalk") {
    stalk(round, b, ms, lo, hi);
    if (b.wait <= 0) pick(round, b);
  } else if (b.act === "stompWind") {
    if (b.wait <= 0) {
      stomp(round, b);
      Object.assign(b, { act: "rest", wait: quick(round, b, STOMP_REST_MS) });
    }
  } else if (b.act === "lashWind") {
    b.lashDir = Math.sign(you.x - b.x) || b.lashDir;
    if (b.wait > LASH_LOCK_MS) b.lashY = lashLevel(round, b);
    if (b.wait <= 0) {
      round.hazards.push({ kind: "lash", x: b.x + b.lashDir * (LASH_LEN / 2), y: b.lashY, w: LASH_LEN, h: LASH_H, dir: b.lashDir, live: LASH_LIVE_MS, max: LASH_LIVE_MS, cause: "lash" });
      round.events.push({ type: "lashCrack", ...at(b), dir: b.lashDir, lashY: b.lashY });
      // Enraged, he cracks it twice running.
      b.chain = b.raged && !b.chain ? 1 : 0;
      b.again = b.chain === 1;
      Object.assign(b, { act: "rest", wait: quick(round, b, LASH_REST_MS) });
    }
  } else if (b.act === "crouch") {
    b.crouch = ease(clamp(1 - b.wait / b.total, 0, 1));
    b.pdir = Math.sign(you.x - b.px) || b.pdir;
    if (b.wait <= 0) {
      // Away: to where you stand now, further on if you are running.
      const run = you.state === "run" && !you.ducking ? (round.input.right ? 1 : 0) - (round.input.left ? 1 : 0) : 0;
      const toX = clamp(you.x + run * LEAP_LEAD, lo, hi);
      const airMs = clamp((Math.abs(toX - b.px) / LEAP_SPEED) * 1000, LEAP_MIN_MS, LEAP_MAX_MS);
      Object.assign(b, { act: "leap", fromX: b.px, toX, air: 0, airMs, pdir: Math.sign(toX - b.px) || b.pdir });
      round.events.push({ type: "puppetLeap", kind: b.kind, x: b.px, y: b.floor, toX, dir: b.pdir });
    }
  } else if (b.act === "leap") {
    b.air += ms;
    const p = clamp(b.air / b.airMs, 0, 1);
    b.px = lerp(b.fromX, b.toX, p);
    b.lift = 4 * LEAP_H * p * (1 - p);
    b.stretch = Math.sin(Math.PI * p);
    b.lean = b.pdir * 0.5 * (1 - p);
    if (p >= 1) {
      Object.assign(b, { px: b.toX, lift: 0, stretch: 0, lean: 0, squash: SQUASH_MS, act: "rest", wait: quick(round, b, LEAP_REST_MS) });
      b.crouch = 0.7;
      stomp(round, b);
    }
  } else if (b.act === "rear") {
    const p = clamp(1 - b.wait / b.total, 0, 1);
    b.rear = ease(p);
    // Backs off for a run-up, and lines up on you until the last moments.
    if (b.wait > REAR_LOCK_MS) b.cdir = Math.sign(you.x - b.px) || b.cdir;
    b.pdir = b.cdir;
    b.lean = -b.cdir * 0.6 * b.rear;
    if (b.wait > REAR_LOCK_MS) {
      const px = clamp(b.px - b.cdir * REAR_BACK_V * dt, lo, hi);
      b.walk = Math.abs(px - b.px) / dt;
      b.px = px;
    }
    if (b.wait <= 0) {
      Object.assign(b, { act: "charge", wait: 0 });
      round.hazards.push({ kind: "pcharge", x: b.px, y: b.floor, w: CHARGE_W, h: CHARGE_H, live: 1, max: 1, dir: b.cdir, cause: "puppet" });
      round.events.push({ type: "puppetCharge", kind: b.kind, x: b.px, y: b.floor, dir: b.cdir });
    }
  } else if (b.act === "charge") {
    const wall = b.cdir > 0 ? hi : lo;
    b.px = clamp(b.px + b.cdir * CHARGE_V * dt, lo, hi);
    b.walk = CHARGE_V;
    b.lean = b.cdir;
    b.pdir = b.cdir;
    if (b.px === wall) {
      Object.assign(b, { act: "crash", wait: CRASH_MS, lean: 0, dazed: true });
      round.events.push({ type: "puppetCrash", kind: b.kind, x: b.px, y: b.floor, dir: b.cdir, big: true });
    }
  } else if (b.act === "crash") {
    b.dazed = true;
    b.crouch = 0.5;
    b.lean = -b.cdir * 0.35;
    if (b.wait <= 0) Object.assign(b, { act: "rest", wait: quick(round, b, CHARGE_REST_MS), dazed: false });
  }
  // The gantry follows the puppet, slower, never far behind.
  const want = clamp(b.px, lo, hi);
  b.x += clamp(want - b.x, -GANTRY_V * pace * dt, GANTRY_V * pace * dt);
  b.x = clamp(b.x, want - GANTRY_LAG, want + GANTRY_LAG);
  b.pts = limbs(b);
}

// A flash of a hazard: out for its short time. Returns whether it is still on the field.
function stepFlash(round, h, ms) {
  h.live -= ms;
  return h.live > 0;
}

export const CARNIVAL = freeze({
  id: "carnival",
  monsters: MONSTERS,
  walkers: freeze(["grinner", "strongman", "circushound"]),
  fourLegged: freeze(["circushound"]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({ grinner: "walk", balloon: "float", marionette: "hang", mirror: "wait", strongman: "walk", circushound: "prowl" }),
  // The leap is a swoop (duck it); so is a balloon drifting at your chest.
  swoops: freeze({ balloon: () => true, circushound: (m) => m.act === "leap" }),
  // A mirror in its panel or stepping out is not there to hit; a caged hound bursts out first.
  solid: freeze({ mirror: (m) => m.act === "copy", circushound: (m) => m.act !== "burst" }),
  move: freeze({ grinner: moveGrinner, balloon: moveBalloon, marionette: moveMarionette, mirror: moveMirror, strongman: moveStrongman, circushound: moveHound }),
  kill: freeze({ balloon: (round, m, how, k) => drip(round, m, k), mirror: shatter }),
  horde: freeze({}),
  tick,
  // The barbell hits the ground: its own event, no clatter.
  land: freeze({ barbell: (round, b, g) => { round.events.push({ type: "barbellLand", kind: "barbell", x: b.x, y: g }); return true; } }),
  shot: shotRule,
  target,
  bosses: BOSSES,
  boss: freeze({ ringmaster: moveRingmaster }),
  // Shots are blocked unless the puppet is down and he is out on the floor.
  guard: freeze({ ringmaster: (b) => !b.open }),
  hazards: freeze({ pfoot: stepFlash, lash: stepFlash, pcharge: stepCharge }),
});
