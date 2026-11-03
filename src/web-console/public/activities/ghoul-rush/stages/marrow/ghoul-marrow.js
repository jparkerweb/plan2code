// Plan2Code Web Console - Ghoul Rush's finale, its rules: Marrow, the house itself, as a stage pack that ghoul.js plugs in. This file holds the first of the three kills, The Lawn; the rest land here (or beside it) as they are built.
//
// No imports: ghoul.js hands every rule here a kit `k` of its own helpers. See
// ghoul-bog.js for what a pack holds and "The finale" in
// prototypes/Ghoul-Rush-TODO.md for the whole fight.
//
// THE LAWN. The manor stands up on the right of the arena and fills it; YOU
// cannot walk into it (`WALL_GAP`). Its windows are the only way to hurt it:
// a bolt crosses the front of the house and strikes the first LIT window at its
// height. Each window has a share of the boss's hp (`b.hp` is always their sum),
// and once shot out it stays black: that is the fight's progress and the story's
// promise ("every window goes dark"). A few are lit at a time, in turn, and a
// row only starts to light once enough others are out (`rowsOpen`), so the fight
// climbs from the ground to the eyes in the gable, up the branches of the oak.
//
// Between shots it picks a move by weight (`pickMove`: never one three times
// running, the slow ones on a cooldown). Each has a wind-up and an event first:
//
// - SHINGLES (`shingles`): the roof shakes, shadows show on the lawn, slates fall
//   through them from the sky. Step between; a shelf is no shelter.
// - CARPET (`carpet`): the door opens and a red carpet of a tongue rolls out along
//   the floor, a wave to jump. Two in a row once it is furious.
// - PICKETS (`pickets`): the lawn ripples where YOU stand and a step either side,
//   then fence-post teeth burst up. Step between, jump, or climb.
// - BRICKS (`bricks`, from the second phase): the chimney coughs up bricks aimed
//   where YOU stand and ahead of where YOU run.
// - DOORMEN (`doormen`, from the second phase): two of the dead shamble out of the
//   door, at most DOORMEN_CAP of its own alive.
// - STOMP (`stomp`, furious only): it rears and comes down: a shockwave to jump
//   and slates after it.
//
// Its phase is 0 at first, 1 with PHASE_OUT[0] windows out, 2 with PHASE_OUT[1].
//
// THE RETREAT. The last window out is a real boss kill (a life, the points,
// `hurtBoss`), then `b.t` runs the scene (`retreatStep`): it sags, a false "YOU
// ESCAPED!", one window lights again in red and it laughs, and it drags itself down
// into the ground, leaving its front door standing alone on the lawn. Only then
// can YOU reach that door (`b.gone`), which is the way down after it.

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export const BOSSES = freeze({
  marrow: freeze({ name: "Marrow", sub: "The house itself", w: 36, h: 44, hp: 90, points: 6000, color: "#c8a04a" }),
});

// The house's place: its left edge HOUSE_BACK short of the room's end, YOU kept
// WALL_GAP clear of it, and its center where the art stands it.
export const HOUSE_W = 36;
export const HOUSE_BACK = 38;
export const WALL_GAP = 1.5;
export const houseLeft = (spec) => spec.length - HOUSE_BACK;
export const houseCenter = (spec) => houseLeft(spec) + HOUSE_W / 2;

// The windows, [row, dx from the house's center, height of the window's bottom over
// the floor]. A bolt flies SHOT_Y (2.4) over YOUR feet and the floor is at 6, so each
// row's middle sits where a bolt flies from the surface that serves it: the floor
// (8.4, a window's box reaches it), the shelf at 18 (20.4), the shelf at 30 (32.4) and
// the shelf at 41 (43.4; the gable's two are its eyes). The door is its mouth.
export const WINDOWS = freeze([
  freeze([0, -12.5, 0.3]), freeze([0, 12.5, 0.3]),
  freeze([1, -13.5, 11.2]), freeze([1, -4.5, 11.2]), freeze([1, 4.5, 11.2]), freeze([1, 13.5, 11.2]),
  freeze([2, -13.5, 23.2]), freeze([2, -4.5, 23.2]), freeze([2, 4.5, 23.2]), freeze([2, 13.5, 23.2]),
  freeze([3, -5.5, 34.2]), freeze([3, 5.5, 34.2]),
]);
export const WINDOW_W = 5;
export const WINDOW_H = 6.4;
// How many windows are lit at once, by phase; how long a set stays lit; the beat
// before another lights after one is shot out.
export const LIT_N = freeze([2, 2, 3]);
export const LIT_MS = 5200;
export const RELIGHT_MS = 650;
// Windows out for the second phase and for the third.
export const PHASE_OUT = freeze([4, 8]);
// The highest row that may light, by windows out.
export const rowsOpen = (out) => (out >= PHASE_OUT[1] ? 3 : out >= PHASE_OUT[0] ? 2 : 1);

export const IDLE_MS = 1500;
export const IDLE_JITTER = 0.25;
// How much quicker its waits are, by phase.
export const PHASE_PACE = freeze([1, 0.85, 0.68]);
// Shingles: the wind-up, then each shadow warns SHINGLE_WARN_MS (the later ones
// SHINGLE_STAGGER_MS after) and the slate falls for SHINGLE_FALL_MS.
export const SHINGLE_WIND_MS = 500;
export const SHINGLE_WARN_MS = 750;
export const SHINGLE_STAGGER_MS = 130;
export const SHINGLE_FALL_MS = 340;
export const SHINGLE_W = 3.2;
export const SHINGLE_H = 2.2;
export const SHINGLE_GAP = 8;
export const SHINGLE_TOP = 52;
export const SHINGLE_N = freeze([3, 4, 5]);
// The carpet: the door opens CARPET_WIND_MS, a second one CARPET_GAP_MS behind the first when furious.
export const CARPET_WIND_MS = 750;
export const CARPET_GAP_MS = 620;
export const CARPET_REST_MS = 1000;
// Pickets: the wind-up, then each ripple warns PICKET_WARN_MS and a tooth is up PICKET_UP_MS.
export const PICKET_WIND_MS = 350;
export const PICKET_WARN_MS = 750;
export const PICKET_STAGGER_MS = 120;
export const PICKET_UP_MS = 600;
export const PICKET_W = 2.8;
export const PICKET_H = 5.6;
export const PICKET_GAP = 8;
export const PICKET_N = freeze([3, 3, 4]);
// Bricks: the cough, then a brick is in the air BRICK_FLY_MS and burns BRICK_LIVE_MS where it lands.
export const BRICK_WIND_MS = 600;
export const BRICK_FLY_MS = 800;
export const BRICK_LIVE_MS = 420;
export const BRICK_W = 3.6;
export const BRICK_H = 2.4;
export const BRICK_LEAD = 10;
// Doormen: the door opens, DOORMEN_N walk out, at most DOORMEN_CAP of its own alive.
export const DOORMEN_WIND_MS = 800;
export const DOORMEN_N = 2;
export const DOORMEN_CAP = 2;
// The stomp: rearing STOMP_WIND_MS (it lifts STOMP_LIFT), then the wave and SHINGLE_N slates.
export const STOMP_WIND_MS = 950;
export const STOMP_LIFT = 2.4;
export const STOMP_REST_MS = 1300;
// How many picks a move sits out after it is used.
export const COOLDOWN = freeze({ doormen: 4, stomp: 2, bricks: 1 });
// Each move's weight by phase.
export const WEIGHTS = freeze({
  shingles: freeze([3, 2.5, 2.5]),
  carpet: freeze([3, 2.5, 2.5]),
  pickets: freeze([3, 2.5, 2.5]),
  bricks: freeze([0, 3, 3]),
  doormen: freeze([0, 1.6, 1.6]),
  stomp: freeze([0, 0, 3]),
});

// The retreat's clock, in ms of `b.t` after the kill.
export const FALSE_AT = 1400;
export const LAUGH_AT = 4300;
export const SINK_AT = 5600;
export const GONE_AT = 8200;

/* ------------------------------------------------------------ the windows */

// The run's windows for this room, kept across a life lost (a respawn makes a new
// boss object with the same hp). `share` is one window's hp.
function windowsOf(round, share) {
  if (!round.marrow || round.marrow.room !== round.room) {
    round.marrow = { room: round.room, windows: WINDOWS.map(([row, dx, up], id) => ({ id, row, dx, up, hp: share, state: "dark" })) };
  }
  return round.marrow.windows;
}

export const windowsOut = (round) => (round.marrow ? round.marrow.windows.filter((w) => w.state === "out").length : 0);
export const phaseOf = (round) => {
  const out = windowsOut(round);
  return out >= PHASE_OUT[1] ? 2 : out >= PHASE_OUT[0] ? 1 : 0;
};

// Lights `want` windows more among those dark and open, starting anywhere.
function lightMore(round, want, random) {
  const left = round.marrow.windows.filter((w) => w.state !== "out");
  // Nothing dark in an open row while some are left: every row opens.
  const top = rowsOpen(left.length ? WINDOWS.length - left.length : 0);
  let pool = left.filter((w) => w.state === "dark" && w.row <= top);
  if (!pool.length && !left.some((w) => w.state === "lit")) pool = left.filter((w) => w.state === "dark");
  for (let i = 0; i < want && pool.length; i++) {
    const w = pool.splice(Math.floor(random() * pool.length) % pool.length, 1)[0];
    w.state = "lit";
    round.events.push({ type: "marrowLight", kind: "marrow", x: houseCenter(round.spec) + w.dx, y: round.boss.y + w.up });
  }
}

// One set of windows out, another in: the shutters swing, in step with LIT_MS.
function changeLights(round, b, random) {
  for (const w of round.marrow.windows) if (w.state === "lit") w.state = "dark";
  lightMore(round, LIT_N[phaseOf(round)], random);
  b.litMs = LIT_MS;
}

// A bolt across the front of the house: it strikes the first lit window at its
// height (the one nearest where it is), or flies on over the shutters. Returns
// true when it has hit one.
function windowShot(round, s, k) {
  const b = round.boss;
  if (!b || b.kind !== "marrow" || b.state !== "fight" || !round.marrow) return false;
  const cx = houseCenter(round.spec);
  for (const w of round.marrow.windows) {
    if (w.state !== "lit" || Math.abs(s.x - (cx + w.dx)) > WINDOW_W / 2 + 0.3) continue;
    if (Math.abs(s.y - (b.y + w.up + WINDOW_H / 2)) > WINDOW_H / 2 + 0.3) continue;
    const dmg = Math.min(w.hp, Math.max(1, s.arm ? k.armBossDamage(round, s.bossDmg || 1) : 1));
    w.hp -= dmg;
    const out = w.hp <= 0;
    if (out) {
      w.state = "out";
      b.relight = RELIGHT_MS;
      round.events.push({ type: "marrowWindowOut", kind: "marrow", x: cx + w.dx, y: b.y + w.up + WINDOW_H / 2, left: round.marrow.windows.filter((q) => q.state !== "out").length });
    }
    k.hurtBoss(round, dmg, "weak");
    return true;
  }
  return false;
}

/* ------------------------------------------------------------ the moves */

// Its next move: the carpet to open, then a weighted pick by phase that favors
// a change (a third time running is out), the slow moves sitting out COOLDOWN
// picks, the doormen only under their cap. `b.plan` forces one (tests).
export function pickMove(b, phase, random, adds = 0) {
  let pick = null;
  if (b.plan) {
    pick = b.plan;
    b.plan = null;
  } else if (!b.picks) pick = "carpet";
  else {
    const w = {};
    for (const [n, by] of Object.entries(WEIGHTS)) {
      let v = by[phase];
      if (b.cool && b.cool[n] > b.picks) v = 0;
      if (n === "doormen" && adds >= DOORMEN_CAP) v = 0;
      if (n === b.last) v *= b.streak >= 2 ? 0 : 0.35;
      if (v > 0) w[n] = v;
    }
    const names = Object.keys(w);
    let r = random() * names.reduce((sum, n) => sum + w[n], 0);
    pick = names[0] || "carpet";
    for (const n of names) {
      pick = n;
      if ((r -= w[n]) < 0) break;
    }
  }
  b.picks = (b.picks || 0) + 1;
  b.streak = pick === b.last ? (b.streak || 1) + 1 : 1;
  b.last = pick;
  if (COOLDOWN[pick]) b.cool = { ...(b.cool || {}), [pick]: b.picks + COOLDOWN[pick] + 1 };
  return pick;
}

const doormenAlive = (round) => round.monsters.filter((m) => !m.dead && m.doorman).length;
const lawnRange = (spec, x) => clamp(x, spec.arena + 3, houseLeft(spec) - 2);

// Slates falling at `n` spots around x, the first where YOU stand: shadows first.
function dropShingles(round, b, n, wind) {
  const spec = round.spec;
  const you = round.you;
  const ahead = Math.sign(you.vx) || you.face || 1;
  const offs = [0, ahead, -ahead, ahead * 2, -ahead * 2];
  const xs = [];
  offs.slice(0, n).forEach((o, i) => {
    const x = lawnRange(spec, you.x + o * SHINGLE_GAP);
    if (xs.some((q) => Math.abs(q - x) < SHINGLE_W + 1)) return;
    xs.push(x);
    const warn = wind + SHINGLE_WARN_MS + i * SHINGLE_STAGGER_MS;
    round.hazards.push({ kind: "marrowShingle", x, y: SHINGLE_TOP, w: SHINGLE_W, h: SHINGLE_H, floor: b.y, warn, full: warn, fall: 0, live: 0, cause: "marrowShingle", id: i });
  });
  return xs;
}

function startMove(round, b, move, k, wait) {
  const you = round.you;
  const spec = round.spec;
  const phase = phaseOf(round);
  const doorX = houseCenter(spec);
  const ev = (type, extra = {}) => round.events.push({ type, kind: "marrow", x: doorX, y: b.y + 6, ...extra });
  b.move = move;
  if (move === "shingles") {
    const xs = dropShingles(round, b, SHINGLE_N[phase], SHINGLE_WIND_MS);
    b.act = "roof";
    b.wait = SHINGLE_WIND_MS + SHINGLE_WARN_MS + SHINGLE_STAGGER_MS * Math.max(0, xs.length - 1) + SHINGLE_FALL_MS;
    ev("marrowRoof", { y: b.y + 40, xs });
  } else if (move === "carpet") {
    b.act = "carpetWind";
    b.twice = phase === 2;
    b.wait = wait(CARPET_WIND_MS);
    ev("marrowDoor");
  } else if (move === "pickets") {
    const ahead = Math.sign(you.vx) || you.face || 1;
    const offs = [0, ahead, -ahead, ahead * 2].slice(0, PICKET_N[phase]);
    const xs = [];
    offs.forEach((o, i) => {
      const x = lawnRange(spec, you.x + o * PICKET_GAP);
      if (xs.some((q) => Math.abs(q - x) < PICKET_W + 1)) return;
      xs.push(x);
      const warn = PICKET_WIND_MS + PICKET_WARN_MS + i * PICKET_STAGGER_MS;
      round.hazards.push({ kind: "marrowPicket", x, y: b.y, w: PICKET_W, h: PICKET_H, warn, full: warn, live: 0, cause: "marrowPicket", id: i });
    });
    b.act = "pickets";
    b.wait = PICKET_WIND_MS + PICKET_WARN_MS + PICKET_STAGGER_MS * Math.max(0, xs.length - 1) + PICKET_UP_MS;
    ev("marrowPicketWind", { xs, y: b.y });
  } else if (move === "bricks") {
    b.act = "brickWind";
    b.wait = wait(BRICK_WIND_MS);
    ev("marrowCough", { x: doorX + 9, y: b.y + 42 });
  } else if (move === "doormen") {
    b.act = "doormenWind";
    b.wait = wait(DOORMEN_WIND_MS);
    ev("marrowDoor");
  } else if (move === "stomp") {
    b.act = "stompWind";
    b.wait = STOMP_WIND_MS;
    b.windFull = STOMP_WIND_MS;
    ev("marrowRear", { y: b.y + 20 });
  }
}

// Where a brick lands: on the surface under `x` at YOUR height when one is there, else the ground.
function brickSpot(round, x, k) {
  const spec = round.spec;
  const you = round.you;
  const ground = k.groundAt(spec, x);
  if (you.state === "run" && you.shelf >= 0 && spec.shelves[you.shelf] && x >= spec.shelves[you.shelf][0] && x <= spec.shelves[you.shelf][1]) return you.y;
  return ground;
}

function moveMarrow(round, b, ms, random, k) {
  const spec = round.spec;
  const phase = phaseOf(round);
  const wait = (v) => (v * PHASE_PACE[phase]) / spec.pace;
  const idle = () => wait(IDLE_MS * (1 - IDLE_JITTER + 2 * IDLE_JITTER * random()));
  const doorX = houseCenter(spec);
  if (!b.act) {
    b.act = "idle";
    b.wait = idle();
    changeLights(round, b, random);
  }
  b.wait -= ms;
  b.litMs -= ms;
  // A window shot out: another lights a beat later. A set's time up: all change.
  if (b.relight > 0 && (b.relight -= ms) <= 0) {
    b.relight = 0;
    const lit = round.marrow.windows.filter((w) => w.state === "lit").length;
    lightMore(round, Math.max(0, LIT_N[phase] - lit), random);
  }
  if (b.litMs <= 0) changeLights(round, b, random);
  // The door stays open through a wind-up and its rest.
  b.mouth = b.act === "carpetWind" || b.act === "doormenWind" || b.act === "carpetRest";
  b.lift = b.act === "stompWind" ? STOMP_LIFT * (1 - Math.max(0, b.wait) / b.windFull) : 0;
  if (b.act === "idle") {
    if (b.wait > 0) return;
    const move = pickMove(b, phase, random, doormenAlive(round));
    b.attacks++;
    startMove(round, b, move, k, wait);
    return;
  }
  if (b.wait > 0 && b.act !== "carpetRest") return;
  if (b.act === "carpetWind") {
    const x = houseLeft(spec) - 0.5;
    round.waves.push({ x, y: b.y, dir: -1, life: 6000, kind: "marrowCarpet", cause: "marrowCarpet" });
    round.events.push({ type: "marrowCarpet", kind: "marrow", x, y: b.y });
    b.echo = b.twice ? wait(CARPET_GAP_MS) : 0;
    b.act = "carpetRest";
    b.wait = wait(CARPET_REST_MS);
    return;
  }
  if (b.act === "carpetRest") {
    if (b.echo > 0 && (b.echo -= ms) <= 0) {
      b.echo = 0;
      const x = houseLeft(spec) - 0.5;
      round.waves.push({ x, y: b.y, dir: -1, life: 6000, kind: "marrowCarpet", cause: "marrowCarpet" });
      round.events.push({ type: "marrowCarpet", kind: "marrow", x, y: b.y, echo: true });
    }
    if (b.wait > 0 || b.echo > 0) return;
    b.act = "idle";
    b.wait = idle();
    return;
  }
  if (b.act === "brickWind") {
    const you = round.you;
    const ahead = (Math.sign(you.vx) || you.face || 1) * BRICK_LEAD;
    const xs = [lawnRange(spec, you.x), lawnRange(spec, you.x + ahead)];
    if (phase === 2) xs.push(lawnRange(spec, you.x - ahead));
    const sx = doorX + 9;
    const sy = b.y + 42;
    xs.forEach((x, i) => {
      if (xs.indexOf(x) !== i) return;
      const y = brickSpot(round, x, k);
      if (!Number.isFinite(y)) return;
      round.hazards.push({ kind: "marrowBrick", x, y, w: BRICK_W, h: BRICK_H, warn: BRICK_FLY_MS, full: BRICK_FLY_MS, live: 0, sx, sy, cause: "marrowBrick" });
    });
    b.act = "idle";
    b.wait = idle();
    return;
  }
  if (b.act === "doormenWind") {
    const n = Math.min(DOORMEN_N, DOORMEN_CAP - doormenAlive(round));
    for (let i = 0; i < n; i++) {
      const x = houseLeft(spec) - 1.5 - i * 4;
      k.spawnMonster(round, "zombie", x, b.y, { doorman: true, force: true, door: true, rise: 300 });
    }
    round.events.push({ type: "marrowDoormen", kind: "marrow", x: houseLeft(spec), y: b.y, n });
    b.act = "idle";
    b.wait = idle();
    return;
  }
  if (b.act === "stompWind") {
    const x = houseLeft(spec) - 0.5;
    round.waves.push({ x, y: b.y, dir: -1, life: 6000, kind: "marrowQuake", cause: "marrowQuake" });
    round.events.push({ type: "marrowStomp", kind: "marrow", x, y: b.y });
    dropShingles(round, b, SHINGLE_N[phase], 0);
    b.act = "stompRest";
    b.wait = wait(STOMP_REST_MS);
    return;
  }
  if (b.act === "roof" || b.act === "pickets" || b.act === "stompRest") {
    b.act = "idle";
    b.wait = idle();
  }
}

/* -------------------------------------------------------------- hazards */

// A slate: a shadow on the lawn for `warn`, then falling through everything to the floor.
function stepShingle(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = 1;
    h.fall = 0;
    return true;
  }
  h.fall += ms;
  const p = Math.min(1, h.fall / SHINGLE_FALL_MS);
  h.y = SHINGLE_TOP + (h.floor - SHINGLE_TOP) * p;
  if (p < 1) return true;
  round.events.push({ type: "marrowShingleLand", kind: "marrow", x: h.x, y: h.floor });
  return false;
}

// A picket: a ripple for `warn`, then up out of the lawn for PICKET_UP_MS.
function stepPicket(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = PICKET_UP_MS;
    round.events.push({ type: "marrowPicketUp", kind: "marrow", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

// A brick: in the air for `warn`, then smashed and burning where it landed.
function stepBrick(round, h, ms) {
  if (h.warn > 0) {
    h.warn = Math.max(0, h.warn - ms);
    if (h.warn > 0) return true;
    h.live = BRICK_LIVE_MS;
    round.events.push({ type: "marrowBrickLand", kind: "marrow", x: h.x, y: h.y });
    return true;
  }
  h.live -= ms;
  return h.live > 0;
}

/* --------------------------------------------------------- the stage's tick */

// The house in its place, its box out of the way (only the windows can be hit), YOU
// kept off its front until it has gone, and the retreat's beats by `b.t`.
function retreatStep(round, b) {
  const stamp = (key, at, type, extra = {}) => {
    if (b[key] || b.t < at) return;
    b[key] = true;
    round.events.push({ type, kind: "marrow", x: houseCenter(round.spec), y: b.y + 18, ...extra });
  };
  stamp("sagged", 0, "marrowSag");
  stamp("falseWin", FALSE_AT, "marrowFalseWin");
  stamp("laughed", LAUGH_AT, "marrowLaugh", { y: b.y + 40 });
  stamp("sinking", SINK_AT, "marrowSink");
  if (b.t >= GONE_AT && !b.gone) {
    b.gone = true;
    round.events.push({ type: "marrowGone", kind: "marrow", x: round.spec.door, y: b.y + 14 });
  }
}

function marrowTick(round) {
  const b = round.boss;
  if (!b || b.kind !== "marrow") return;
  const spec = round.spec;
  if (!b.placed) {
    const share = Math.max(1, Math.ceil(spec.bossHp / WINDOWS.length));
    const windows = windowsOf(round, share);
    b.placed = true;
    b.max = share * WINDOWS.length;
    // Fresh, it has all its hp; after a life lost, the windows' sum (what it had).
    b.hp = windows.reduce((sum, w) => sum + Math.max(0, w.hp), 0);
    b.x = spec.length - 0.75;
    b.w = 1.5;
    b.h = 2;
    b.litMs = LIT_MS;
    b.relight = 0;
  }
  if (b.state === "down") retreatStep(round, b);
  const wall = houseLeft(spec) - WALL_GAP;
  const you = round.you;
  if (!b.gone && you.x > wall) {
    you.x = wall;
    if (you.vx > 0) you.vx = 0;
  }
}

export const MARROW = freeze({
  id: "marrow",
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
  tick: freeze([marrowTick]),
  target: windowShot,
  bosses: BOSSES,
  boss: freeze({ marrow: moveMarrow }),
  // Only its windows can be hurt (windowShot): anything else glances off.
  guard: freeze({ marrow: () => true }),
  cause: freeze({ marrow: () => "marrow" }),
  hazards: freeze({ marrowShingle: stepShingle, marrowPicket: stepPicket, marrowBrick: stepBrick }),
});
