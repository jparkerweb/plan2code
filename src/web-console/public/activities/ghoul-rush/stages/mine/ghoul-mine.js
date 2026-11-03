// Plan2Code Web Console - Ghoul Rush's Deep Seam Mine stage, its rules: the monsters of the workings (knocker imps that steal your light, canary ghosts whose scream brings the roof down, dead miners that dig out of the wall, blind crawlers that hunt by sound, the cage lifts you can ride), the rockfall, the knee-deep water, the Hard Hat and Dynamite, and its boss, the Tommyknocker, as a stage pack that ghoul.js plugs in.
//
// Like the other stage packs (see ghoul-graveyard.js for what a pack holds,
// and ghoul-sanatorium.js for `tick`, `harmless`, `platform`, `weak` and a
// boss's blackout), every rule here is handed a kit `k` of ghoul.js's own
// helpers, so this file has no imports. The Mine leans on two small things
// ghoul.js now does for every stage: a room's `water` spans (see below) and
// `you.dimMs` (below).
//
// Every room here is always dark. Everything a stage keeps in `round.twist`
// is { next, quiet, noise, reach, wade }: `next` ms to the next rock, `quiet`
// ms since you last made a noise, `noise` whether you made one this slice,
// `reach` how far it carries, `wade` ms to the next splash. It starts over
// with each room and each life.
//
// Rockfall: a room with `rocks` (ms) lets a rock go every `rocks` ms (a
// little less deeper in a run), the first at ROCK_FIRST of a period. A rock
// is a `rock` hazard that goes through three states, `h.state`: "warn" (dust
// trickles from the ceiling over its spot for `h.warn` ms: `rockWarn`),
// "fall" (`rockFall`, `h.live` 1 so it costs a life, cause `rock`, and it
// crushes any monster it passes through, `h.vy` falling) and "rubble" (it
// lies there ROCK_RUBBLE_MS, harmless, `rockLand`). It is aimed ROCK_LEAD
// ahead of the way you run, or straight over you when you stand still,
// never in the first ROCK_START_SAFE of a room and never within a rock's
// width of another that is still to fall. The canary's scream and the
// Tommyknocker's knocks start rocks of their own. Under the Hard Hat a rock
// that reaches you bounces off (`rockBounce`) and lies as rubble beside you.
//
// The imp's light steal: touching an imp costs no life. It sets `you.dimMs`
// (ms of dimmed light left; ghoul.js counts it down and the art shrinks your
// glow while it is over 0) to IMP_DIM_MS and `you.dimBy` to that imp's id
// (`impSteal`); the imp runs off with the spark (`m.stole`, act "flee") and
// the light comes back when the time is up or the moment the thief dies
// (`impDrop`). An imp that touches you under the Hard Hat (`you.hat`) knocks the
// hat off instead (`hatKnock`) and is thrown back.
//
// Water: a room's `water` is a list of [x0, x1] spans of the floor that are
// knee deep. ghoul.js sets `you.wet` for a slice you run on the floor in one,
// and slows you to WATER_SPEED (and a jump to WATER_JUMP) there. Moving wet
// is a noise that carries HEAR_WET (not HEAR_DRY) to a blind crawler, and
// splashes (`wade`) every WADE_MS.
//
// Noise, for the blind crawler: you make one in the air, while you run
// and for a moment after you fire; you are quiet once none for
// BLIND_LOSE_MS. A crawler hunting you at BLIND_HUNT_V loses you then
// (`blindLost`, act "lost": it wanders at BLIND_WANDER_V) and hears you again
// (`blindHear`) at the next noise within `reach` of it.
//
// A canary flits at CANARY_V, keeps CANARY_KEEP off, and once within
// SCREAM_NEAR of you (in view) screams (`canaryScream`): three rocks, one
// over you and one CANARY_SPREAD either side, each with CANARY_WARN_MS of
// dust. It then flees for CANARY_FLEE_MS and rests CANARY_REST_MS. It never
// hurts by touch. A dead miner lies buried in the wall (act "buried", not
// solid) till you come within MINER_NEAR, bursts out over MINER_DIG_MS
// (`minerDig`, act "dig") and walks at you; within PICK_NEAR of its edge it
// winds up PICK_WIND_MS (`pickWind`) and swings (`pickSwing`: a `pick` hazard
// PICK_REACH long, cause `pickaxe`, live PICK_LIVE_MS), rests PICK_REST_MS.
// A cage (a spawn row ["cage", x, lowest y, highest y]; the row's y is the
// cage's bottom and its floor board is CAGE_H higher) rides its track at
// CAGE_V and rests CAGE_REST_MS at each end; it is no monster to hit or
// shoot (not solid), never hurts, and Planny stands on it (`platform`).
//
// Dynamite is the Mine's own weapon: placed in every room, 3 sticks a pickup
// here, its rules in ghoul-arms.js. The Hard Hat (`you.hat`, worn till used, never
// out of the Mine): see the rocks and imps above.
//
// The Tommyknocker waits in the seam. In turn: a knock (three beats,
// `tommyKnock`, a rock at a spot with its dust each beat), a hammer sweep
// close up (`sweepWind` SWEEP_WIND_MS, `tommySweep`: a low `hammer` hazard,
// cause `hammer`, to jump) and, every third move, lights out (`tommyDark`:
// `round.blackout` for the whole dark, `b.darkOn`), after TOMMY_SINK_MS he
// sinks into the seam (`tommySink`: `b.hidden`, his y way below the floor, so
// nothing hits him) while a decoy imp paces carrying his lantern (`m.decoy`),
// and the dust of the real knocking trickles from where he will burst out
// (`tommyKnockDark` at `b.burstX`). He bursts out (`tommyBurst`) there when
// the dark is over and is dazed DAZE_MS, taking double damage (`weak`). At
// half his hp (`tommyRage`) every wait is TOMMY_QUICK as long, the dark lasts
// DARK_RAGE_MS, and each lights-out sends RAGE_IMPS imps (never more than
// IMP_CAP alive). He draws no random number, nor does anything else here.

const freeze = (o) => Object.freeze(o);

export const MONSTERS = freeze({
  imp: freeze({ name: "Knocker Imp", w: 2, h: 2.4, hp: 2, speed: 22, points: 150, stomp: true, head: false, color: "#8a6a3a" }),
  canary: freeze({ name: "Canary Ghost", w: 2.4, h: 1.8, hp: 1, speed: 11, points: 120, stomp: false, head: false, perch: true, color: "#f2e060" }),
  miner: freeze({ name: "Dead Miner", w: 3, h: 5.2, hp: 4, speed: 8, points: 220, stomp: true, head: true, color: "#5a4a3a" }),
  blind: freeze({ name: "Blind Crawler", w: 3, h: 2.4, hp: 3, speed: 4, points: 150, stomp: true, head: false, color: "#c8c0b0" }),
  cage: freeze({ name: "Cage Lift", w: 8, h: 1.2, hp: 9999, speed: 0, points: 0, stomp: false, head: false, perch: true, color: "#6a6a70" }),
});

export const BOSSES = freeze({
  tommy: freeze({ name: "The Tommyknocker", sub: "Follow the knocking, not the light", w: 10, h: 15, hp: 120, points: 3500, color: "#7a6a52" }),
});

// Every event this pack puts on the field, for the art and the sounds to
// answer (a hit, a kill, a spawn and a boss's wake, hit and fall are the
// game's own).
export const EVENTS = freeze([
  "rockWarn", "rockFall", "rockLand", "rockBounce", "hatKnock", "wade", "impSteal", "impDrop", "canaryScream", "minerDig", "pickWind", "pickSwing",
  "blindLost", "blindHear", "dynThrow", "dynBlast",
  "tommyKnock", "sweepWind", "tommySweep", "tommyDark", "tommySink", "tommyKnockDark", "tommyBurst", "tommyRage",
]);

// The stage's rooms, in order.
export const MINE_ROOMS = freeze(["shaft", "tunnels", "collapse", "cart", "seam"]);
const IN_MINE = new Set(MINE_ROOMS);

// Rocks: ROCK_W by ROCK_H, ROCK_WARN_MS of dust first, aimed ROCK_LEAD ahead
// of a running Planny, none in the first ROCK_START_SAFE of a room, the first
// at ROCK_FIRST of a period; rubble is ROCK_RUBBLE_H high, lies ROCK_RUBBLE_MS
// and no more than RUBBLE_CAP of it at once.
export const ROCK_W = 3.6;
export const ROCK_H = 3;
export const ROCK_WARN_MS = 700;
export const ROCK_LEAD = 9;
export const ROCK_START_SAFE = 14;
export const ROCK_FIRST = 0.9;
export const ROCK_RUBBLE_H = 1.4;
export const ROCK_RUBBLE_MS = 4500;
export const RUBBLE_CAP = 6;
// An imp skitters at IMP_V, runs off with the light at IMP_FLEE_V, and hops
// onto a board up to IMP_REACH over its feet, IMP_HOP_MS between hops. It
// dims your light for IMP_DIM_MS.
export const IMP_V = 22;
export const IMP_FLEE_V = 26;
export const IMP_DIM_MS = 5000;
export const IMP_REACH = 13;
export const IMP_HOP_MS = 900;
// A canary: see the header.
export const CANARY_V = 11;
export const CANARY_FLEE_V = 16;
export const CANARY_KEEP = 12;
export const SCREAM_NEAR = 20;
export const CANARY_SCREAM_MS = 450;
export const CANARY_WARN_MS = 900;
export const CANARY_SPREAD = 6;
export const CANARY_FLEE_MS = 2200;
export const CANARY_REST_MS = 4500;
// A dead miner: see the header.
export const MINER_NEAR = 44;
export const MINER_DIG_MS = 650;
export const MINER_V = 8;
export const PICK_NEAR = 5;
export const PICK_WIND_MS = 400;
export const PICK_REACH = 5;
export const PICK_H = 3.6;
export const PICK_LIVE_MS = 200;
export const PICK_REST_MS = 900;
// A blind crawler: see the header. HEAR_DRY and HEAR_WET are how far a noise
// carries, dry and wading; BLIND_TURN_MS how long a lost one walks one way.
export const BLIND_HUNT_V = 22;
export const BLIND_WANDER_V = 4;
export const BLIND_LOSE_MS = 600;
export const BLIND_TURN_MS = 1500;
export const HEAR_DRY = 44;
export const HEAR_WET = 70;
export const WADE_MS = 320;
// A cage rides at CAGE_V and rests CAGE_REST_MS at each end; its floor board
// is CAGE_H over its bottom.
export const CAGE_V = 7;
export const CAGE_REST_MS = 1500;
export const CAGE_H = 1.2;

// The Tommyknocker. He walks at you at TOMMY_WALK to within 3 of you, waits
// TOMMY_IDLE_MS between moves; a move is a hammer sweep when you are within
// SWEEP_NEAR of his edge (and he has not swept for SWEEP_COOL_MS), every third
// move lights out, else a knock. A knock is KNOCKS beats KNOCK_BEAT_MS apart,
// each starting a rock (the first ahead of you, the others KNOCK_SPREAD to
// each side of you), then rests KNOCK_REST_MS. A sweep winds up SWEEP_WIND_MS,
// then a hammer SWEEP_REACH long and SWEEP_H high is out SWEEP_LIVE_MS and he
// rests SWEEP_REST_MS. Lights out: TOMMY_SINK_MS to sink, then DARK_MS in the
// seam (DARK_RAGE_MS enraged), a knock of dust every KNOCK_DARK_MS from where
// he will burst out; HIDE_Y is how far below the floor he is, DAZE_MS how long
// he stands dazed taking DAZE_MULT times the damage. At TOMMY_RAGE of his hp
// every wait is TOMMY_QUICK as long and each lights-out sends RAGE_IMPS imps,
// no more than IMP_CAP alive.
export const TOMMY_WALK = 7;
export const TOMMY_IDLE_MS = 1000;
export const SWEEP_NEAR = 7;
export const SWEEP_COOL_MS = 1800;
export const SWEEP_WIND_MS = 500;
export const SWEEP_REACH = 15;
export const SWEEP_H = 2.6;
export const SWEEP_LIVE_MS = 260;
export const SWEEP_REST_MS = 900;
export const KNOCKS = 4;
export const KNOCK_BEAT_MS = 380;
export const KNOCK_SPREAD = 14;
export const KNOCK_REST_MS = 700;
export const TOMMY_SINK_MS = 600;
export const DARK_MS = 4000;
export const DARK_RAGE_MS = 6000;
export const KNOCK_DARK_MS = 700;
export const HIDE_Y = -80;
export const DAZE_MS = 1500;
export const DAZE_MULT = 2;
export const TOMMY_RAGE = 0.5;
export const TOMMY_QUICK = 0.7;
export const RAGE_IMPS = 3;
// An imp that knocks the Hard Hat off is thrown HAT_KNOCK back.
export const HAT_KNOCK = 4;
export const IMP_CAP = 5;
// Enraged, the knocks come one more beat and the dust gives less warning; a burst out of the seam
// erupts under him (a floor hazard BURST_W wide, BURST_LIVE_MS) and brings rocks down on you.
export const RAGE_KNOCK_WARN_MS = 550;
export const BURST_W = 9;
export const BURST_LIVE_MS = 320;
export const BURST_SPREAD = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const inView = (round, m, k) => m.x > round.camX - 2 && m.x < round.camX + k.FIELD_W + 2;
const alive = (round, kind) => round.monsters.filter((m) => !m.dead && m.kind === kind).length;
// A kill with nothing left behind, and no random number drawn.
const NO_DROPS = () => 1;

/* ------------------------------------------------------------- rockfall */

// A rock over `x`, dust first for `warn` ms; null over a pit or where another
// rock is still to fall.
function startRock(round, x, warn, k) {
  const floor = k.groundAt(round.spec, x);
  if (!(floor > -Infinity)) return null;
  if (round.hazards.some((h) => h.kind === "rock" && h.state !== "rubble" && Math.abs(h.x - x) < ROCK_W + 1)) return null;
  const rock = { kind: "rock", state: "warn", x, y: k.CHANDELIER_Y, w: ROCK_W, h: ROCK_H, vy: 0, warn, total: warn, floor, live: 0, cause: "rock" };
  round.hazards.push(rock);
  round.events.push({ type: "rockWarn", x, y: floor, ms: warn });
  return rock;
}

// A rock that has come to rest is rubble for a while (the oldest goes if
// there is too much).
function toRubble(round, h) {
  h.state = "rubble";
  h.live = 0;
  h.y = h.floor;
  h.h = ROCK_RUBBLE_H;
  h.rub = ROCK_RUBBLE_MS;
  const heap = round.hazards.filter((q) => q.kind === "rock" && q.state === "rubble" && q !== h);
  if (heap.length >= RUBBLE_CAP) round.hazards.splice(round.hazards.indexOf(heap[0]), 1);
}

// One slice of a rock: dust, then the fall (crushing what it passes through),
// then rubble. Returns whether it is still on the field.
function stepRock(round, h, ms, k) {
  const you = round.you;
  if (h.state === "rubble") {
    h.rub -= ms;
    return h.rub > 0;
  }
  if (h.state === "warn") {
    h.warn -= ms;
    if (h.warn > 0) return true;
    h.state = "fall";
    h.live = 1;
    h.vy = 0;
    round.events.push({ type: "rockFall", x: h.x, y: h.y, floor: h.floor });
  }
  h.vy -= k.GRAVITY * (ms / 1000);
  h.y += h.vy * (ms / 1000);
  let crushed = false;
  for (const m of round.monsters) {
    if (m.dead || !k.solid(m) || Math.abs(m.x - h.x) > (h.w + m.w) / 2 || h.y > m.y + m.h || h.y + h.h < m.y) continue;
    k.hurt(round, m, 99, "crush", NO_DROPS);
    crushed = true;
  }
  if (crushed) round.monsters = round.monsters.filter((m) => !m.dead);
  // The Hard Hat: it bounces off, and lies beside you; the hat is used up.
  if (you.hat && you.out <= 0 && Math.abs(you.x - h.x) < (h.w + k.HIT_W) / 2 && you.y < h.y + h.h && you.y + k.HIT_H > h.y) {
    you.hat = false;
    round.events.push({ type: "rockBounce", x: you.x, y: you.y + k.HIT_H });
    h.x += (h.x >= you.x ? 1 : -1) * ROCK_W;
    toRubble(round, h);
    return true;
  }
  if (h.y > h.floor) return true;
  toRubble(round, h);
  round.events.push({ type: "rockLand", x: h.x, y: h.floor });
  return true;
}

/* ------------------------------------------------------- the twist (tick) */

// What runs each slice in the Mine's rooms: the noise you make (for the
// blind crawlers), the splashes of wading, the Tommyknocker's lights out, and
// the rocks that fall now and then.
function tick(round, ms, k) {
  const spec = round.spec;
  const you = round.you;
  // The Hard Hat stays in the Mine.
  if (!IN_MINE.has(spec.id)) {
    you.hat = false;
    return;
  }
  const b = round.boss;
  const tw = (round.twist ||= { next: (spec.rocks || 0) * ROCK_FIRST, quiet: 0, noise: false, reach: 0, wade: 0 });
  const moving = you.state === "run" && you.runMs > 0;
  const noisy = you.out <= 0 && (you.state === "air" || moving || you.fireFx > 0);
  tw.noise = noisy;
  tw.reach = you.wet && moving ? HEAR_WET : HEAR_DRY;
  tw.quiet = noisy ? 0 : tw.quiet + ms;
  if (you.wet && moving && you.out <= 0) {
    tw.wade -= ms;
    if (tw.wade <= 0) {
      tw.wade = WADE_MS;
      round.events.push({ type: "wade", x: you.x, y: you.y });
    }
  } else tw.wade = 0;
  // The Tommyknocker's dark is the room's blackout (this pack comes after the
  // Sanatorium's, which clears it each slice).
  if (b) round.blackout = b.state === "fight" && Boolean(b.darkOn);
  if (!spec.rocks || (b && b.state !== "fight")) return;
  tw.next -= ms;
  if (tw.next > 0) return;
  tw.next = spec.rocks * spec.every;
  if (you.x < spec.start + ROCK_START_SAFE) {
    tw.next = 1500;
    return;
  }
  const lead = ((round.input.right ? 1 : 0) - (round.input.left ? 1 : 0)) * ROCK_LEAD;
  startRock(round, clamp(you.x + lead, 3, spec.length - 3), ROCK_WARN_MS, k) || startRock(round, you.x, ROCK_WARN_MS, k);
}

/* ----------------------------------------------------------------- imps */

// The imp's light, back with you when its thief dies.
function lightDrop(round, m) {
  const you = round.you;
  if (!(m.stole && you.dimMs > 0 && you.dimBy === m.id)) return;
  you.dimMs = 0;
  you.dimBy = 0;
  round.events.push({ type: "impDrop", kind: m.kind, x: m.x, y: m.y + m.h / 2 });
}

// The decoy imp that carries the Tommyknocker's lantern: it paces where the
// lantern is meant to be seen, and keeps away from you.
function decoyPace(round, m, ms, k) {
  m.act = "pace";
  const away = (m.decoyX ?? m.x) - m.x;
  if (Math.abs(away) > 6) return k.walk(round, m, Math.sign(away), IMP_V * 0.6, ms / 1000);
  m.turnIn = (m.turnIn ?? 0) - ms;
  if (m.turnIn <= 0) {
    m.turnIn = 1200;
    m.pdir = -(m.pdir || 1);
  }
  k.walk(round, m, m.pdir || 1, IMP_V * 0.6, ms / 1000);
}

// A hop up onto the board under you: where it lands, or null.
function boardFor(round, m, k) {
  const you = round.you;
  let to = null;
  round.spec.shelves.forEach(([x0, x1, top], i) => {
    if (round.down[i] > 0 || top <= m.y + 2 || top > m.y + IMP_REACH || top > you.y + 1) return;
    const x = clamp(you.x, x0 + 1.2, x1 - 1.2);
    if (Math.abs(x - m.x) > 12) return;
    if (!to || Math.abs(top - you.y) < Math.abs(to.top - you.y)) to = { top, x };
  });
  return to;
}

function moveImp(round, m, ms, k) {
  const you = round.you;
  const pace = round.spec.pace;
  const dt = ms / 1000;
  m.hopIn = Math.max(0, (m.hopIn || 0) - ms);
  if (m.decoy) return decoyPace(round, m, ms, k);
  if (m.stole && !(you.dimMs > 0 && you.dimBy === m.id)) m.stole = false;
  const toward = k.towardYou(round, m);
  if (m.stole) {
    m.act = "flee";
    // walk() holds still within a unit of you, so step clear of you first.
    const away = Math.sign(m.x - you.x) || -toward;
    if (Math.abs(you.x - m.x) < 1.2) m.x = you.x + away * 1.2;
    k.walk(round, m, away, IMP_FLEE_V * pace, dt);
    return;
  }
  m.act = "skitter";
  // Touching you steals the light, not a life; the Hard Hat stops it once,
  // knocked off, and the imp is thrown back.
  if (you.out <= 0 && you.safeMs <= 0 && Math.abs(you.x - m.x) < (k.HIT_W + m.w * 0.8) / 2 && you.y < m.y + m.h * 0.9 && you.y + k.HIT_H > m.y + m.h * 0.1) {
    if (you.hat) {
      you.hat = false;
      m.x = you.x + (Math.sign(m.x - you.x) || -you.face) * HAT_KNOCK;
      round.events.push({ type: "hatKnock", x: you.x, y: you.y + k.HIT_H });
      return;
    }
    you.dimMs = IMP_DIM_MS;
    you.dimBy = m.id;
    m.stole = true;
    m.act = "flee";
    round.events.push({ type: "impSteal", kind: m.kind, id: m.id, x: m.x, y: m.y + m.h / 2, ms: IMP_DIM_MS });
    return;
  }
  // You up on a board over it: it hops up after you.
  if (m.hopIn <= 0 && you.y > m.y + 2.5 && Math.abs(you.x - m.x) < 30) {
    const to = boardFor(round, m, k);
    if (to) {
      const vy = Math.sqrt(2 * k.GRAVITY * (to.top - m.y + 2));
      const t = (vy + Math.sqrt(2 * k.GRAVITY * 2)) / k.GRAVITY;
      m.hop = { vx: (to.x - m.x) / t, vy };
      m.dir = Math.sign(to.x - m.x) || m.dir;
      m.hopIn = IMP_HOP_MS;
      return;
    }
  }
  k.walk(round, m, toward, IMP_V * pace, dt);
}

/* -------------------------------------------------------------- canaries */

function moveCanary(round, m, ms, k) {
  const you = round.you;
  const pace = round.spec.pace;
  const dt = ms / 1000;
  const dx = you.x - m.x;
  const toward = Math.sign(dx) || m.dir;
  m.cool = Math.max(0, (m.cool || 0) - ms);
  m.y = m.home + Math.sin(m.t / 260) * 1.2;
  if (m.act === "scream") {
    m.wait -= ms;
    if (m.wait <= 0) Object.assign(m, { act: "flee", wait: CANARY_FLEE_MS });
    return;
  }
  if (m.act === "flee") {
    m.wait -= ms;
    m.dir = -toward;
    m.x -= toward * CANARY_FLEE_V * pace * dt;
    if (m.wait <= 0) m.act = "flit";
    return;
  }
  m.dir = toward;
  if (Math.abs(dx) > CANARY_KEEP) m.x += toward * CANARY_V * pace * dt;
  if (m.cool > 0 || Math.abs(dx) > SCREAM_NEAR || you.out > 0 || !inView(round, m, k)) return;
  // The scream: rocks over where you stand and either side of it.
  Object.assign(m, { act: "scream", wait: CANARY_SCREAM_MS, cool: CANARY_REST_MS });
  let n = 0;
  for (const off of [0, -CANARY_SPREAD, CANARY_SPREAD]) if (startRock(round, you.x + off, CANARY_WARN_MS, k)) n++;
  round.events.push({ type: "canaryScream", kind: m.kind, x: m.x, y: m.y, n });
}

/* ---------------------------------------------------------------- miners */

function moveMiner(round, m, ms, k) {
  const you = round.you;
  const spec = round.spec;
  const pace = spec.pace;
  const at = () => ({ kind: m.kind, x: m.x, y: m.y + m.h * 0.6 });
  if (m.act === "buried") {
    if (Math.abs(you.x - m.x) > MINER_NEAR || !inView(round, m, k)) return;
    Object.assign(m, { act: "dig", wait: MINER_DIG_MS });
    round.events.push({ type: "minerDig", ...at(), ms: MINER_DIG_MS });
    return;
  }
  if (m.act === "dig") {
    m.wait -= ms;
    if (m.wait <= 0) Object.assign(m, { act: "walk", wait: 0 });
    return;
  }
  if (m.act === "wind") {
    m.wait -= ms * pace;
    if (m.wait > 0) return;
    round.hazards.push({ kind: "pick", x: m.x + m.dir * (m.w / 2 + PICK_REACH / 2), y: m.y, w: PICK_REACH, h: PICK_H, dir: m.dir, live: PICK_LIVE_MS, max: PICK_LIVE_MS, cause: "pickaxe" });
    round.events.push({ type: "pickSwing", ...at(), dir: m.dir });
    Object.assign(m, { act: "rest", wait: PICK_REST_MS });
    return;
  }
  if (m.act === "rest") {
    m.wait -= ms * pace;
    if (m.wait <= 0) m.act = "walk";
    return;
  }
  m.dir = k.towardYou(round, m);
  const gap = Math.abs(you.x - m.x) - m.w / 2;
  if (gap <= PICK_NEAR && Math.abs(you.y - m.y) < 4 && you.out <= 0 && inView(round, m, k)) {
    Object.assign(m, { act: "wind", wait: PICK_WIND_MS });
    round.events.push({ type: "pickWind", ...at(), dir: m.dir });
    return;
  }
  m.act = "walk";
  k.walk(round, m, m.dir, MONSTERS.miner.speed * pace, ms / 1000);
}

// A swing or a sweep: out for its short time. Returns whether it is still on the field.
function stepFlash(round, h, ms) {
  h.live -= ms;
  return h.live > 0;
}

/* ------------------------------------------------------- blind crawlers */

function moveBlind(round, m, ms, k) {
  const you = round.you;
  const tw = round.twist;
  const pace = round.spec.pace;
  const at = () => ({ kind: m.kind, x: m.x, y: m.y + m.h / 2 });
  const heard = Boolean(tw && tw.noise && Math.abs(you.x - m.x) <= tw.reach);
  if (m.act === "hunt") {
    if (tw && tw.quiet >= BLIND_LOSE_MS) {
      Object.assign(m, { act: "lost", turnIn: BLIND_TURN_MS });
      if (inView(round, m, k)) round.events.push({ type: "blindLost", ...at() });
    }
  } else if (heard) {
    m.act = "hunt";
    if (inView(round, m, k)) round.events.push({ type: "blindHear", ...at() });
  }
  if (m.act === "hunt") {
    k.walk(round, m, k.towardYou(round, m), BLIND_HUNT_V * pace, ms / 1000);
    return;
  }
  // Lost: it feels its way back and forth.
  m.turnIn = (m.turnIn ?? BLIND_TURN_MS) - ms;
  if (m.turnIn <= 0) {
    m.turnIn = BLIND_TURN_MS;
    m.dir = -(m.dir || 1);
  }
  k.walk(round, m, m.dir || 1, BLIND_WANDER_V * pace, ms / 1000);
}

/* ----------------------------------------------------------------- cages */

function moveCage(round, m, ms) {
  if (m.lo === undefined) {
    const row = round.spec.spawns.find((s) => s[0] === "cage" && s[1] === m.x);
    Object.assign(m, { lo: row ? row[2] : m.y, hi: row ? row[3] : m.y, v: CAGE_V, rest: 0 });
  }
  if (m.rest > 0) {
    m.rest -= ms;
    return;
  }
  m.y += m.v * (ms / 1000);
  if (m.y >= m.hi) Object.assign(m, { y: m.hi, v: -CAGE_V, rest: CAGE_REST_MS });
  else if (m.y <= m.lo) Object.assign(m, { y: m.lo, v: CAGE_V, rest: CAGE_REST_MS });
}

/* ------------------------------------------------------------ the Tommyknocker */

const rage = (b) => b.hp <= b.max * TOMMY_RAGE;
const quick = (round, b, ms) => (ms * (b.raged ? TOMMY_QUICK : 1)) / round.spec.pace;
const at = (b, up = 0.5) => ({ kind: b.kind, x: b.x, y: b.y + b.h * up });

// Imps from the arena's ends, to the cap.
function sendImps(round, b, n, k) {
  const spec = round.spec;
  for (let i = 0; i < n && alive(round, "imp") < IMP_CAP; i++) {
    const x = i % 2 ? spec.length - 4 : spec.arena + 4;
    k.spawnMonster(round, "imp", x, k.groundAt(spec, x), { force: true });
  }
}

// The knock's beat `b.beat`: a rock with its dust, the first ahead of you, the
// others to each side.
function knockBeat(round, b, k) {
  const knocks = b.raged ? KNOCKS + 1 : KNOCKS;
  const spec = round.spec;
  const you = round.you;
  b.beat++;
  round.events.push({ type: "tommyKnock", ...at(b, 0.6), n: b.beat, dir: b.dir });
  const lead = ((round.input.right ? 1 : 0) - (round.input.left ? 1 : 0)) * ROCK_LEAD;
  const off = [lead, -KNOCK_SPREAD, KNOCK_SPREAD, KNOCK_SPREAD / 2, -KNOCK_SPREAD / 2][b.beat - 1] ?? 0;
  startRock(round, clamp(you.x + off, spec.arena + 3, spec.length - 3), b.raged ? RAGE_KNOCK_WARN_MS : ROCK_WARN_MS, k);
  if (b.beat >= knocks) Object.assign(b, { act: "rest", wait: quick(round, b, KNOCK_REST_MS) });
  else b.knockIn = quick(round, b, KNOCK_BEAT_MS);
}

// He sinks into the seam: nothing can hit him now, a decoy imp carries the
// lantern off to one side, and the knocking starts from where he will burst out.
function sink(round, b, k) {
  const spec = round.spec;
  const lo = k.arenaMin(round, b);
  const hi = k.arenaMax(round, b);
  const left = b.darks % 2 === 1;
  b.burstX = lo + (hi - lo) * (left ? 0.25 : 0.75);
  b.decoyX = lo + (hi - lo) * (left ? 0.75 : 0.25);
  Object.assign(b, { act: "hidden", hidden: true, y: HIDE_Y, darkLeft: b.raged ? DARK_RAGE_MS : DARK_MS, knockIn: 0 });
  k.spawnMonster(round, "imp", b.decoyX, k.groundAt(spec, b.decoyX), { force: true, decoy: true, decoyX: b.decoyX });
  round.events.push({ type: "tommySink", kind: b.kind, x: b.x, y: b.floor + b.h / 2 });
}

// The dark is over: he bursts out of the wall where the dust was, dazed.
function burst(round, b, k) {
  Object.assign(b, { x: b.burstX, y: b.floor, hidden: false, darkOn: false, dazed: DAZE_MS, act: "dazed" });
  for (const m of round.monsters) if (m.decoy) m.decoy = false;
  round.blackout = false;
  // He erupts: the floor where he rises is a hazard, and rocks come down over you and to each side.
  round.hazards.push({ kind: "hammer", x: b.x, y: b.floor, w: BURST_W, h: SWEEP_H, dir: b.dir, live: BURST_LIVE_MS, max: BURST_LIVE_MS, cause: "hammer" });
  const spec = round.spec;
  for (const dx of [0, -BURST_SPREAD, BURST_SPREAD]) startRock(round, clamp(round.you.x + dx, spec.arena + 3, spec.length - 3), b.raged ? RAGE_KNOCK_WARN_MS : ROCK_WARN_MS, k);
  round.events.push({ type: "tommyBurst", ...at(b), big: true });
}

function moveTommy(round, b, ms, random, k) {
  const spec = round.spec;
  const you = round.you;
  if (!b.act) Object.assign(b, { act: "idle", wait: quick(round, b, TOMMY_IDLE_MS), floor: k.groundAt(spec, b.x), moves: 0, darks: 0, beat: 0, knockIn: 0, swingCool: 0, dazed: 0, hidden: false, darkOn: false, darkLeft: 0, burstX: 0, decoyX: 0 });
  b.swingCool = Math.max(0, b.swingCool - ms);
  b.dazed = Math.max(0, b.dazed - ms);
  if (!b.raged && rage(b)) {
    b.raged = true;
    round.events.push({ type: "tommyRage", ...at(b) });
  }
  if (b.act === "hidden") {
    b.darkLeft -= ms;
    b.knockIn -= ms;
    if (b.knockIn <= 0) {
      b.knockIn = quick(round, b, KNOCK_DARK_MS);
      round.events.push({ type: "tommyKnockDark", kind: b.kind, x: b.burstX, y: b.floor + 9 });
    }
    if (b.darkLeft <= 0) burst(round, b, k);
    return;
  }
  if (b.act === "idle" || b.act === "sweepWind") b.dir = Math.sign(you.x - b.x) || b.dir;
  if (b.act === "dazed") {
    if (b.dazed <= 0) Object.assign(b, { act: "rest", wait: quick(round, b, TOMMY_IDLE_MS * 0.6) });
    return;
  }
  if (b.act === "knock") {
    b.knockIn -= ms;
    if (b.knockIn <= 0) knockBeat(round, b, k);
    return;
  }
  b.wait -= ms;
  if (b.act === "idle") {
    const gap = Math.abs(you.x - b.x) - b.w / 2;
    if (gap > 3) b.x = clamp(b.x + b.dir * TOMMY_WALK * spec.pace * (ms / 1000), k.arenaMin(round, b), k.arenaMax(round, b));
    if (b.wait > 0) return;
    b.moves++;
    if (gap <= SWEEP_NEAR && b.swingCool <= 0) {
      Object.assign(b, { act: "sweepWind", wait: SWEEP_WIND_MS / spec.pace });
      round.events.push({ type: "sweepWind", ...at(b, 0.7), dir: b.dir });
    } else if (b.moves % 3 === 0) {
      b.darks++;
      Object.assign(b, { act: "dark", wait: quick(round, b, TOMMY_SINK_MS), darkOn: true });
      round.blackout = true;
      round.events.push({ type: "tommyDark", ...at(b, 0.7) });
      if (b.raged) sendImps(round, b, RAGE_IMPS, k);
    } else {
      Object.assign(b, { act: "knock", beat: 0, knockIn: quick(round, b, KNOCK_BEAT_MS) });
    }
  } else if (b.act === "sweepWind") {
    if (b.wait > 0) return;
    round.hazards.push({ kind: "hammer", x: b.x + b.dir * (b.w / 2 + SWEEP_REACH / 2), y: b.floor, w: SWEEP_REACH, h: SWEEP_H, dir: b.dir, live: SWEEP_LIVE_MS, max: SWEEP_LIVE_MS, cause: "hammer" });
    round.events.push({ type: "tommySweep", ...at(b, 0.2), dir: b.dir });
    b.swingCool = SWEEP_COOL_MS;
    Object.assign(b, { act: "rest", wait: quick(round, b, SWEEP_REST_MS) });
  } else if (b.act === "dark") {
    if (b.wait <= 0) sink(round, b, k);
  } else if (b.act === "rest") {
    if (b.wait > 0) return;
    Object.assign(b, { act: "idle", wait: quick(round, b, TOMMY_IDLE_MS) });
  }
}

// A shot does double damage while he is dazed.
const tommyWeak = (b) => (b.dazed > 0 ? DAZE_MULT : 1);

export const MINE = freeze({
  id: "mine",
  monsters: MONSTERS,
  walkers: freeze(["imp", "blind"]),
  zombies: freeze(["miner"]),
  stackers: freeze([]),
  climbers: freeze(["imp", "blind", "miner"]),
  act: freeze({ imp: "skitter", canary: "flit", miner: "buried", blind: "lost", cage: "ride" }),
  // A buried or digging miner is in the wall; a cage is no monster to hit.
  solid: freeze({ miner: (m) => m.act !== "buried" && m.act !== "dig", cage: () => false }),
  // An imp steals light, never a life, and a canary only screams.
  harmless: freeze({ imp: () => true, canary: () => true, cage: () => true }),
  platform: freeze({ cage: () => true }),
  move: freeze({ imp: moveImp, canary: moveCanary, miner: moveMiner, blind: moveBlind, cage: moveCage }),
  kill: freeze({ imp: lightDrop }),
  horde: freeze({}),
  tick,
  bosses: BOSSES,
  boss: freeze({ tommy: moveTommy }),
  weak: freeze({ tommy: tommyWeak }),
  hazards: freeze({ rock: stepRock, pick: stepFlash, hammer: stepFlash }),
});
