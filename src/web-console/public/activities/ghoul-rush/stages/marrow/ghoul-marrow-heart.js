// Plan2Code Web Console - Ghoul Rush's finale, its rules for the third kill, The Heart of Marrow in the Pit, as a pack core/ghoul-tables.js lists in PACKS: the beat and its shockwaves, the ribs that part between beats, the roots, the grabs, the clots and the falling rock, the beat stopping dead, and the HOLD FIRE flood that ends the House.
//
// No imports: every rule is handed the kit `k` (see stages/marrow/ghoul-marrow.js and
// stages/bog/ghoul-bog.js for what a pack holds), and randomness only through the
// `random` a boss's mover is handed.
//
// THE PIT. Absolute dark, the House's true basement. The heart stands in the middle of
// the arena on a plinth of roots (`HEART_X`), its feet below the floor line, with a pit
// on each side of it: YOU fight from the floor and the stone ledges on its left, and a
// fall down either pit costs a life (Bat wings catch one). The heart's box is the plinth
// itself, so YOU never stand beside it while it lives.
//
// THE BEAT is the fight, on the boss's own clock (never the music's). A beat is a double
// thump: the "lub" (the heart squeezes, the room flashes red), then DUB_MS later the "dub"
// sends a shockwave out along the floor each way from the lips of the pits (`heartBeat`,
// jump it). The beat comes every BEAT_MS_MAX at full hp, quickening to BEAT_MS_MIN as
// its hp falls. Between beats THE RIBS PART: from OPEN_AT after a lub, for a share of the
// beat (OPEN_SHARE_MAX at full hp narrowing to OPEN_SHARE_MIN), `b.open` is true and a
// bolt into it counts; while they are shut a bolt clanks off (`guard`).
//
// Between beats it picks a move by weight (never one three times running), each with an
// early warning seen and heard, in two steps for the ones that come up under YOU:
//
// - ROOTS (`roots`): the floor cracks and glows where YOU stand and a step either side,
//   creaks, cracks again, then roots burst up (`heartRoot`). Step between or climb.
// - GRAB (`grab`, only while YOU stand on a ledge): roots curl over YOUR ledge's edges,
//   tense, then whip across its whole top (`heartGrab`). Drop off or jump away.
// - CLOTS (`clots`): the pipes along the roof bulge over YOU (a shadow below, a gurgle),
//   then black clots fall through everything to the floor (`heartClot`). Step aside.
// - QUAKE (`quake`, below a quarter): the room shakes and chunks of the roof come down
//   where their shadows show (`heartChunk`).
//
// Below half, every few beats THE BEAT STOPS DEAD: silence, the red gone, the heart
// swelling (a groan SWELL_MS before the end is its warning), then a huge double wave
// (`heartBig`, two each way BIG_GAP_MS apart) and a long open gasp after it.
//
// THE FINAL BLOW. No bolt takes its last hp: it holds at 1, and then THE HOLD begins
// (`startHold`): the ribs lock open, every root goes limp, HOLD FIRE. `round.flood` is set,
// so the blaster fires nothing and cools (core/ghoul-play.js), and while fire is held a
// meter fills over HOLD_FILL_MS (letting go drains it over HOLD_DRAIN_MS) as YOUR beam
// grows into a flood. Weak beats still come every HOLD_BEAT_MS, each a slow ripple of its
// own (`round.heart.waves`, never the field's): one that reaches YOU only knocks the meter
// back. Full: the screen goes white, the heart stops, one last thump at LAST_AT, silence,
// and at FALL_AT `k.hurtBoss` gives the ordinary fall (a life, the points, the key).
// DAYLIGHT_AT after the fall a shaft of daylight comes down to the room's door, a door of
// light (`b.gone`); until then the door stays shut. There is no retreat: it lingers dead.
//
// A respawn makes a new boss object with only its hp kept, so the hold lives on
// `round.heart`, keyed by `round.room`.

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const BOSSES = freeze({
  marrowheart: freeze({ name: "The Heart of Marrow", sub: "Far below it all, still beating", w: 34, h: 40, hp: 85, points: 9000, color: "#d0283c" }),
});

// Where it stands, and its real box (the plinth of roots between the two pits): BOSSES'
// w and h size the intro card's spotlight to the whole heart instead.
export const HEART_X = 132;
export const HEART_BOX_W = 16;
export const HEART_BOX_H = 26;
// The lips of the pits either side of the heart, where its waves start.
export const LEFT_LIP = 118;
export const RIGHT_LIP = 146;

// The beat: its interval from full hp to none, the dub after the lub, when the ribs part
// after a lub and for what share of the beat, by hp from full to none.
export const BEAT_MS_MAX = 1500;
export const BEAT_MS_MIN = 750;
export const DUB_MS = 300;
export const OPEN_AT = 380;
export const OPEN_SHARE_MAX = 0.4;
export const OPEN_SHARE_MIN = 0.25;
// The heart swells this long before a lub (the art's warning).
export const SWELL_LEAD_MS = 420;
// The first beat after it wakes, this long into the fight.
export const FIRST_BEAT_MS = 700;
export const beatFor = (share) => Math.round(BEAT_MS_MIN + (BEAT_MS_MAX - BEAT_MS_MIN) * clamp(share, 0, 1));
export const openFor = (share) => OPEN_SHARE_MIN + (OPEN_SHARE_MAX - OPEN_SHARE_MIN) * clamp(share, 0, 1);
// Its phase by hp share: 0, then 1 at or below half (the beat stops dead), 2 at or below a quarter (the quake).
export const PHASE_AT = freeze([0.5, 0.25]);
export const phaseFor = (share) => (share <= PHASE_AT[1] ? 2 : share <= PHASE_AT[0] ? 1 : 0);

// The beat stopping dead (phase 1 on): every STOP_EVERY beats or so (a spread of
// STOP_SPREAD more), silent STOP_MS, its swell heard SWELL_MS before the end, then the big
// wave and its echo BIG_GAP_MS later, and the ribs open GASP times as long after it.
export const STOP_EVERY = 6;
export const STOP_SPREAD = 3;
export const STOP_MS = 1800;
export const SWELL_MS = 800;
export const BIG_GAP_MS = 320;
export const GASP = 1.8;

// The moves: a wait between (shorter by phase, quicker with the room's pace).
export const IDLE_MS = 1700;
export const IDLE_JITTER = 0.25;
export const PHASE_PACE = freeze([1, 0.85, 0.72]);
// Roots: each warns ROOT_WARN_MS (the later ones ROOT_STAGGER_MS after), creaking at the
// start and cracking at ROOT_CRACK of it, then stands ROOT_UP_MS, ROOT_W by ROOT_H.
export const ROOT_WARN_MS = 1100;
export const ROOT_CRACK = 0.55;
export const ROOT_STAGGER_MS = 140;
export const ROOT_UP_MS = 650;
export const ROOT_W = 2.6;
export const ROOT_H = 6.5;
export const ROOT_GAP = 7;
export const ROOT_N = freeze([2, 3, 3]);
// The grab: roots curl over YOUR ledge GRAB_WARN_MS (tensing at GRAB_TENSE of it), then
// whip across its top GRAB_LIVE_MS, GRAB_H high.
export const GRAB_WARN_MS = 1150;
export const GRAB_TENSE = 0.55;
export const GRAB_LIVE_MS = 650;
export const GRAB_H = 3.4;
// Clots: a bulge on the pipe over YOU for CLOT_WARN_MS (the later ones CLOT_STAGGER_MS
// after), then a fall from CLOT_TOP to the floor in CLOT_FALL_MS, through ledges.
export const CLOT_WARN_MS = 1000;
export const CLOT_STAGGER_MS = 150;
export const CLOT_FALL_MS = 380;
export const CLOT_TOP = 46;
export const CLOT_W = 2.6;
export const CLOT_H = 2.2;
export const CLOT_GAP = 6;
export const CLOT_N = freeze([1, 2, 3]);
// The quake: CHUNK_N chunks of roof, each warning CHUNK_WARN_MS (staggered), falling from CHUNK_TOP.
export const CHUNK_WARN_MS = 950;
export const CHUNK_STAGGER_MS = 180;
export const CHUNK_FALL_MS = 420;
export const CHUNK_TOP = 52;
export const CHUNK_W = 3.2;
export const CHUNK_H = 2.6;
export const CHUNK_N = 3;
// Each move's weight by phase; `grab` only while YOU are on a ledge (and then it is likeliest).
export const WEIGHTS = freeze({
  roots: freeze([3, 3, 3]),
  clots: freeze([3, 3, 2.5]),
  grab: freeze([4, 4, 4]),
  quake: freeze([0, 0, 3]),
});

// The hold: the meter's fill and drain, the knock a ripple takes off it, the weak beat
// and its slow ripple (HOLD_WAVE_H high, as a shockwave), and the flood's words at each quarter.
export const HOLD_FILL_MS = 4000;
export const HOLD_DRAIN_MS = 9000;
export const HOLD_KNOCK = 0.18;
export const HOLD_BEAT_MS = 1500;
export const HOLD_WAVE_SPEED = 24;
export const HOLD_WAVE_H = 2.2;
export const FLOOD_STEPS = freeze([0.25, 0.5, 0.75]);
// The end, from the meter full: the white, the last thump, the fall; then after the fall,
// the daylight and its door.
export const WHITE_IN_MS = 260;
export const WHITE_HOLD_MS = 1500;
export const LAST_AT = 900;
export const FALL_AT = 2100;
export const WHITE_OUT_MS = 1300;
export const DAYLIGHT_AT = 1800;

/* ------------------------------------------------------------ state */

// The heart's fight for this room, kept across a life lost.
export function heartOf(round) {
  if (!round.heart || round.heart.room !== round.room) round.heart = { room: round.room, hold: false, meter: 0, beatMs: 0, waves: [], step: 0, final: false, endT: 0, last: false };
  return round.heart;
}

const live = (round) => (round.heart && round.heart.room === round.room ? round.heart : null);

// How white the screen is, 0 to 1: up as the meter fills, held, then fading after the fall.
export function whiteOf(round) {
  const h = live(round);
  const b = round.boss;
  if (!h || !h.final || !b || b.kind !== "marrowheart") return 0;
  // One clock from the meter full: the hold's own until the fall, then the fall's.
  const t = b.state === "down" ? FALL_AT + (b.t || 0) : h.endT;
  if (t < WHITE_IN_MS) return t / WHITE_IN_MS;
  if (t < WHITE_HOLD_MS) return 1;
  return clamp(1 - (t - WHITE_HOLD_MS) / WHITE_OUT_MS, 0, 1);
}

// The hp share the beat and the ribs go by.
const shareOf = (b) => (b.max > 0 ? b.hp / b.max : 1);

// The floor or ledge YOU stand on (or are over in the air): its height and shelf index.
function standing(round, k) {
  const you = round.you;
  if (you.state === "run") return { y: you.y, shelf: you.shelf };
  let top = k.groundAt(round.spec, you.x);
  let shelf = -1;
  round.spec.shelves.forEach(([x0, x1, y], i) => {
    if (you.x >= x0 && you.x <= x1 && y <= you.y && y > top) {
      top = y;
      shelf = i;
    }
  });
  return { y: top, shelf };
}

// Where a thing on the floor may go: the left floor of the arena, clear of the pit's lip.
const floorRange = (spec, x) => clamp(x, spec.arena + 3, LEFT_LIP - 1.6);

/* ------------------------------------------------------------ the moves */

// Its next move by weight: never a third time running, `grab` only on a ledge, `quake`
// only below a quarter. `b.plan` forces one (tests).
export function pickMove(b, phase, random, ledge = false) {
  let pick = null;
  if (b.plan) {
    pick = b.plan;
    b.plan = null;
  } else {
    const w = {};
    for (const [n, by] of Object.entries(WEIGHTS)) {
      let v = by[phase];
      if (n === "grab" && !ledge) v = 0;
      if (n === b.last) v *= b.streak >= 2 ? 0 : 0.4;
      if (v > 0) w[n] = v;
    }
    const names = Object.keys(w);
    let r = random() * names.reduce((sum, n) => sum + w[n], 0);
    pick = names[0] || "roots";
    for (const n of names) {
      pick = n;
      if ((r -= w[n]) < 0) break;
    }
  }
  b.streak = pick === b.last ? (b.streak || 1) + 1 : 1;
  b.last = pick;
  return pick;
}

function startMove(round, b, move, phase, random, k) {
  const spec = round.spec;
  const you = round.you;
  const ahead = Math.sign(you.vx) || you.face || 1;
  const ev = (type, extra = {}) => round.events.push({ type, kind: "marrowheart", x: HEART_X, y: b.y + 20, ...extra });
  b.act = move;
  if (move === "roots") {
    const offs = [0, ahead, -ahead].slice(0, ROOT_N[phase]);
    const xs = [];
    offs.forEach((o, i) => {
      const x = floorRange(spec, you.x + o * ROOT_GAP);
      if (xs.some((q) => Math.abs(q - x) < ROOT_W + 1)) return;
      xs.push(x);
      const warn = ROOT_WARN_MS + i * ROOT_STAGGER_MS;
      round.hazards.push({ kind: "heartRoot", x, y: k.groundAt(spec, x), w: ROOT_W, h: ROOT_H, warn, full: warn, live: 0, cause: "heartRoot", id: i });
    });
    b.wait = ROOT_WARN_MS + ROOT_STAGGER_MS * Math.max(0, xs.length - 1) + ROOT_UP_MS;
    ev("heartRootWind", { xs, y: k.groundAt(spec, xs[0] ?? you.x) });
  } else if (move === "grab") {
    const at = standing(round, k);
    const s = spec.shelves[at.shelf];
    if (!s) return startMove(round, b, "roots", phase, random, k);
    const x = (s[0] + s[1]) / 2;
    round.hazards.push({ kind: "heartGrab", x, y: s[2], w: s[1] - s[0] + 0.6, h: GRAB_H, warn: GRAB_WARN_MS, full: GRAB_WARN_MS, live: 0, cause: "heartGrab", shelf: at.shelf, x0: s[0], x1: s[1] });
    b.wait = GRAB_WARN_MS + GRAB_LIVE_MS;
    ev("heartGrabWind", { x, y: s[2] });
  } else if (move === "clots") {
    const offs = [0, ahead, -ahead].slice(0, CLOT_N[phase]);
    const xs = [];
    const floor = k.groundAt(spec, floorRange(spec, you.x));
    offs.forEach((o, i) => {
      const x = floorRange(spec, you.x + o * CLOT_GAP);
      if (xs.some((q) => Math.abs(q - x) < CLOT_W + 1)) return;
      xs.push(x);
      const warn = CLOT_WARN_MS + i * CLOT_STAGGER_MS;
      round.hazards.push({ kind: "heartClot", x, y: CLOT_TOP, w: CLOT_W, h: CLOT_H, floor, top: CLOT_TOP, fallMs: CLOT_FALL_MS, warn, full: warn, fall: 0, live: 0, cause: "heartClot", id: i });
    });
    b.wait = CLOT_WARN_MS + CLOT_STAGGER_MS * Math.max(0, xs.length - 1) + CLOT_FALL_MS;
    ev("heartClotWind", { xs, y: CLOT_TOP });
  } else if (move === "quake") {
    // One where YOU stand, the rest anywhere on the floor, never on top of each other.
    const xs = [floorRange(spec, you.x)];
    for (let i = 1, tries = 0; i < CHUNK_N && tries < 20; tries++) {
      const x = floorRange(spec, spec.arena + 3 + random() * (LEFT_LIP - spec.arena - 4));
      if (xs.some((q) => Math.abs(q - x) < CHUNK_W + 2)) continue;
      xs.push(x);
      i++;
    }
    xs.forEach((x, i) => {
      const warn = CHUNK_WARN_MS + i * CHUNK_STAGGER_MS;
      round.hazards.push({ kind: "heartChunk", x, y: CHUNK_TOP, w: CHUNK_W, h: CHUNK_H, floor: k.groundAt(spec, x), top: CHUNK_TOP, fallMs: CHUNK_FALL_MS, warn, full: warn, fall: 0, live: 0, cause: "heartChunk", id: i });
    });
    b.wait = CHUNK_WARN_MS + CHUNK_STAGGER_MS * (xs.length - 1) + CHUNK_FALL_MS;
    ev("heartQuake", { xs, y: b.y });
  }
}

// A wave out of each pit's lip: the left one runs at YOU, the right one off to the end.
function beatWaves(round, b, kind) {
  round.waves.push({ x: LEFT_LIP - 0.5, y: b.y, dir: -1, life: 6000, kind, cause: kind });
  round.waves.push({ x: RIGHT_LIP + 0.5, y: b.y, dir: 1, life: 6000, kind, cause: kind });
}

/* ------------------------------------------------------------ the hold */

// Its last hp: the ribs lock open, the roots go limp, HOLD FIRE.
export function startHold(round, b) {
  const h = heartOf(round);
  if (h.hold) return;
  Object.assign(h, { hold: true, meter: 0, beatMs: 0, waves: [], step: 0, final: false, endT: 0, last: false });
  b.hp = Math.max(1, Math.min(b.hp, 1));
  b.open = true;
  round.hazards.length = 0;
  round.waves.length = 0;
  round.flood = true;
  round.events.push({ type: "heartHold", kind: "marrowheart", x: HEART_X, y: b.y + 20 });
}

function stepHold(round, b, h, ms, k) {
  const you = round.you;
  b.open = true;
  b.act = "hold";
  if (h.final) {
    h.endT += ms;
    if (!h.last && h.endT >= LAST_AT) {
      h.last = true;
      round.events.push({ type: "heartLast", kind: "marrowheart", x: HEART_X, y: b.y + 20 });
    }
    if (h.endT >= FALL_AT) k.hurtBoss(round, b.hp, "shot", { x: HEART_X, y: b.y + 20 });
    return;
  }
  // The weak beat, and its slow ripple out of the left pit.
  h.beatMs += ms;
  if (h.beatMs >= HOLD_BEAT_MS) {
    h.beatMs -= HOLD_BEAT_MS;
    h.waves.push({ x: LEFT_LIP - 0.5, y: b.y, dir: -1 });
    round.events.push({ type: "heartWeakBeat", kind: "marrowheart", x: HEART_X, y: b.y + 20 });
  }
  const dt = ms / 1000;
  let n = 0;
  for (const w of h.waves) {
    w.x += w.dir * HOLD_WAVE_SPEED * dt;
    if (you.out <= 0 && Math.abs(w.x - you.x) < 1.4 && you.y < w.y + HOLD_WAVE_H) {
      h.meter = Math.max(0, h.meter - HOLD_KNOCK);
      round.events.push({ type: "heartKnock", kind: "marrowheart", x: you.x, y: you.y + 2, meter: h.meter });
      continue;
    }
    if (w.x > round.spec.arena - 2) h.waves[n++] = w;
  }
  h.waves.length = n;
  const held = round.input.fire && you.out <= 0;
  h.meter = clamp(h.meter + (held ? ms / HOLD_FILL_MS : -ms / HOLD_DRAIN_MS), 0, 1);
  // The flood swells out loud at each quarter, a step higher each time it climbs past one.
  while (h.step < FLOOD_STEPS.length && h.meter >= FLOOD_STEPS[h.step]) {
    h.step++;
    round.events.push({ type: "heartFlood", kind: "marrowheart", x: you.x, y: you.y + 3, n: h.step });
  }
  while (h.step > 0 && h.meter < FLOOD_STEPS[h.step - 1] - 0.08) h.step--;
  if (h.meter >= 1) {
    h.final = true;
    h.endT = 0;
    h.waves.length = 0;
    round.events.push({ type: "heartWhite", kind: "marrowheart", x: HEART_X, y: b.y + 20 });
  }
}

/* ------------------------------------------------------------ the fight */

function moveHeart(round, b, ms, random, k) {
  const h = heartOf(round);
  if (h.hold) return stepHold(round, b, h, ms, k);
  const spec = round.spec;
  const share = shareOf(b);
  const phase = phaseFor(share);
  const ev = (type, extra = {}) => round.events.push({ type, kind: "marrowheart", x: HEART_X, y: b.y + 20, ...extra });
  if (!b.beatT) {
    b.beatT = beatFor(share);
    b.beatMs = b.beatT - FIRST_BEAT_MS;
    b.beats = 0;
    b.stopAt = STOP_EVERY + Math.floor(random() * (STOP_SPREAD + 1));
    b.act = "idle";
    b.wait = IDLE_MS;
    b.dubbed = true;
    b.opened = true;
  }
  // The beat stopped dead: silence, the swell, then the big wave and its echo.
  if (b.stopMs > 0) {
    b.open = false;
    b.stopMs -= ms;
    if (!b.swelled && b.stopMs <= SWELL_MS) {
      b.swelled = true;
      ev("heartSwell");
    }
    if (b.stopMs > 0) return;
    b.stopMs = 0;
    beatWaves(round, b, "heartBig");
    ev("heartSlam", { x: LEFT_LIP, y: b.y });
    b.echo = BIG_GAP_MS;
    b.gasp = true;
    b.beatMs = DUB_MS;
    b.beatT = beatFor(share);
    b.dubbed = true;
    b.opened = false;
    return;
  }
  if (b.echo > 0 && (b.echo -= ms) <= 0) {
    b.echo = 0;
    beatWaves(round, b, "heartBig");
    ev("heartSlam", { x: LEFT_LIP, y: b.y, echo: true });
  }
  b.beatMs += ms;
  if (b.beatMs >= b.beatT) {
    b.beatMs -= b.beatT;
    b.beats++;
    // Below half, now and then the beat that was due never comes.
    if (phase >= 1 && b.beats >= b.stopAt) {
      b.beats = 0;
      b.stopAt = STOP_EVERY + Math.floor(random() * (STOP_SPREAD + 1));
      b.stopMs = STOP_MS;
      b.swelled = false;
      b.open = false;
      b.beatMs = 0;
      ev("heartStop");
      return;
    }
    b.beatT = beatFor(share);
    b.dubbed = false;
    b.opened = false;
    b.gasp = false;
    ev("heartBeat", { t: b.beatT });
  }
  if (!b.dubbed && b.beatMs >= DUB_MS) {
    b.dubbed = true;
    beatWaves(round, b, "heartBeat");
    ev("heartWave", { x: LEFT_LIP, y: b.y });
  }
  const span = openFor(share) * b.beatT * (b.gasp ? GASP : 1);
  b.open = b.beatMs >= OPEN_AT && b.beatMs < OPEN_AT + span;
  if (b.open && !b.opened) {
    b.opened = true;
    ev("heartOpen");
  }
  // How near the next lub is, 0 to 1 over SWELL_LEAD_MS (the art's swell).
  b.swell = clamp(1 - (b.beatT - b.beatMs) / SWELL_LEAD_MS, 0, 1);
  // The moves, between the beats.
  b.wait -= ms;
  if (b.wait > 0) return;
  const wait = (v) => (v * PHASE_PACE[phase]) / spec.pace;
  if (b.act === "idle") {
    const at = standing(round, k);
    startMove(round, b, pickMove(b, phase, random, at.shelf >= 0), phase, random, k);
    b.attacks = (b.attacks || 0) + 1;
    return;
  }
  b.act = "idle";
  b.wait = wait(IDLE_MS * (1 - IDLE_JITTER + 2 * IDLE_JITTER * random()));
}

/* -------------------------------------------------------------- hazards */

// A root: the floor cracking for `warn` (a second crack at ROOT_CRACK of it), then up.
function stepRoot(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (!h.cracked && 1 - h.warn / (h.full || 1) >= ROOT_CRACK) {
      h.cracked = true;
      if (!h.id) round.events.push({ type: "heartRootCrack", kind: "marrowheart", x: h.x, y: h.y });
    }
    if (h.warn > 0) return true;
    h.live = ROOT_UP_MS;
    round.events.push({ type: "heartRootUp", kind: "marrowheart", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A grab: roots curling over the ledge for `warn` (tensing at GRAB_TENSE), then across it.
function stepGrab(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (!h.tensed && 1 - h.warn / (h.full || 1) >= GRAB_TENSE) {
      h.tensed = true;
      round.events.push({ type: "heartGrabTense", kind: "marrowheart", x: h.x, y: h.y });
    }
    if (h.warn > 0) return true;
    h.live = GRAB_LIVE_MS;
    round.events.push({ type: "heartGrabLash", kind: "marrowheart", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A clot or a chunk of roof: its shadow for `warn`, then falling through everything to the floor.
function stepFall(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = 1;
    h.fall = 0;
    return true;
  }
  h.fall += ms;
  const p = Math.min(1, h.fall / h.fallMs);
  h.y = h.top + (h.floor - h.top) * p * p;
  if (p < 1) return true;
  round.events.push({ type: h.kind === "heartClot" ? "heartClotLand" : "heartChunkLand", kind: "marrowheart", x: h.x, y: h.floor });
  return false;
}

/* --------------------------------------------------------- the stage's tick */

// The heart in its place and its box the plinth; the hold's flood on while it holds; after
// the fall, the door shut until the daylight comes down to it.
function heartTick(round, ms, k) {
  const b = round.boss;
  if (!b || b.kind !== "marrowheart") return;
  const spec = round.spec;
  const h = heartOf(round);
  if (!b.placed) {
    b.placed = true;
    b.x = HEART_X;
    b.y = k.groundAt(spec, HEART_X);
    b.w = HEART_BOX_W;
    b.h = HEART_BOX_H;
    // A weapon's hit that could take its last hp at once glances off below this (guard).
    const base = BOSSES.marrowheart.hp;
    b.reserve = Math.ceil((10 * spec.bossHp) / base) + 1;
    if (h.hold) {
      b.hp = 1;
      b.open = true;
    }
  }
  round.flood = h.hold && b.state !== "down";
  if (b.state !== "down") return;
  if (!b.gone && b.t >= DAYLIGHT_AT) {
    b.gone = true;
    round.events.push({ type: "heartDaylight", kind: "marrowheart", x: spec.door, y: k.groundAt(spec, spec.door) + 8 });
  }
  round.hasKey = !!b.gone;
}

// A bolt (or a thrown weapon) into the heart: while the ribs are open it counts, never past
// its last hp, and that last hp begins the hold; while shut it falls to the guard, a clank.
const touchBox = (x, y, r, bx, by, w, h) => Math.hypot(x - clamp(x, bx - w / 2, bx + w / 2), y - clamp(y, by, by + h)) < r;
function heartShot(round, s, k) {
  const b = round.boss;
  if (!b || b.kind !== "marrowheart" || b.state !== "fight" || !b.placed) return false;
  if (!touchBox(s.x, s.y, 0.5, b.x, b.y, b.w, b.h)) return false;
  if (!b.open || (round.heart && round.heart.hold)) return false;
  const dmg = s.arm ? k.armBossDamage(round, s.bossDmg || 1) : s.dmg || 1;
  const d = Math.min(dmg, b.hp - 1);
  if (d > 0) k.hurtBoss(round, d, "shot", { x: s.x, y: s.y });
  if (b.hp <= 1) startHold(round, b);
  return true;
}

export const HEART = freeze({
  id: "pit",
  monsters: freeze({}),
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  swoops: freeze({}),
  solid: freeze({}),
  move: freeze({}),
  kill: freeze({}),
  horde: freeze({}),
  tick: freeze([heartTick]),
  target: heartShot,
  bosses: BOSSES,
  boss: freeze({ marrowheart: moveHeart }),
  // Shut ribs clank; so does any weapon's blow late in the fight (it could skip the hold) and everything in the hold.
  guard: freeze({ marrowheart: (b) => !b.open || b.hp <= (b.reserve || 0) || b.act === "hold" }),
  cause: freeze({ marrowheart: () => "marrowheart" }),
  hazards: freeze({ heartRoot: stepRoot, heartGrab: stepGrab, heartClot: stepFall, heartChunk: stepFall }),
});
