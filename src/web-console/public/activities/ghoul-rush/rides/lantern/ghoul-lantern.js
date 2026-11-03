// Plan2Code Web Console - Ghoul Rush's Drowned Lantern, its rules: Gallows Bog's bonus round, a top-down game on one fixed screen and not a ride. YOU carry a lantern over a black bog island of mossy hummocks joined by plank walks, light the five wisp shrines, then run back to the boat while Old Mother Bog rises out of her pool. Four kinds of hunter each play by one rule you can see and use: the Bog Lurker hears footsteps on wood, the wisps guard the shrines and burst in a flare, the leeches never enter your light, and the bog bodies grab whatever stops beside them. A stage pack that ghoul.js plugs in.
//
// Like Holy Roller (ghoul-pew.js) it is handed a kit `k` of ghoul.js's own helpers and never imports
// ghoul.js. Pack fields used: `ride` (a hook that moves Planny himself, so no key walks him) and `place`
// (Planny put down in the room). It adds no monster, boss or hazard kind, and it draws NO random number:
// every hunter follows a table in the room's `ride` and a fixed rule, stepped on the slice. Its state lives
// in the shared ride slot `round.runner` (`id` "lantern"; null in any other room). Every event it puts on
// the field starts with `lantern`.
//
// THE FIELD IS THE ART'S ALONE (like the pew's): ghoul-draw.js hands the whole field to lanternArt's `field`.
// Positions here are field units with y counted DOWN from the field's top (the way the art draws). `you.x`
// mirrors Planny's x and `you.y` stays on the room's floor, so the engine's own checks never see a fall;
// what the banners must keep clear of is listed in `runner.marks` ([x, y up] pairs, read by ghoul.js's
// underBanner).
//
// THE KEYS (the game has the four arrows and SPACE only): the ARROWS walk (two at once walk a diagonal; a
// walk that runs into the water slides along the shore or the plank, so one arrow follows a crooked plank).
// SPACE flares the lantern: a ring of light FLARE_R wide that bursts every wisp in it and scatters the
// leeches, at the price of FLARE_OIL of the oil and a bang the Lurker hears from anywhere.
//
// THE OBJECTIVE: stand on a shrine's stone for SHRINE_MS (the time is kept if you step off) to light it;
// the fifth lit wakes Old Mother Bog for good, and the boat (`boat`) at the landing you started on is the
// way out. The oil burns down over OIL_MS and the lantern's light shrinks with it (`lightR`); a lit shrine
// fills it again.
//
// THE HUNTERS, one rule each:
// - The BOG LURKER hunts SOUND: a step on the planks (heard within STEP_HEAR; the moss is silent), a flare
//   (heard anywhere) and a shrine catching (SHRINE_HEAR). It swims to the last place it heard you; within
//   AIM_FROM of it, it stops, lines up a lane through that spot (AIM_MS, the lane drawn red) and dashes down
//   it (DASH_V, DASH_PAST beyond the spot). It strikes where it HEARD you, never where you are: off the lane,
//   or on the moss, you are safe. After a dash it rests, deaf, for REST_MS. Once Mother rises it cowers (state
//   "cower"), deaf, under the far water: the run to the boat is hers.
// - The WISPS guard the shrines: each unlit shrine has one circling it that rushes a lantern within
//   GUARD_SENSE (on a leash of LEASH round its shrine) and has you at WISP_CATCH. A flare bursts it; it comes
//   back after WISP_REFORM_MS unless its shrine is lit by then. From the third shrine on, Old Mother Bog sends
//   roaming wisps out of her pool (`wake`), which drift after a lantern within ROAM_SENSE.
// - The LEECHES never enter your light. They follow you at its edge, and once the oil is out (the flame
//   gutters) they swarm in and bite (LEECH_BITE). A flare scatters them for SCATTER_MS.
// - The BOG BODIES lie beside the planks, bubbling: stand still within BODY_NOTICE of one for BODY_STILL_MS and
//   the water boils (BODY_RISE_MS), then a hand comes up for BODY_UP_MS and takes anything within BODY_REACH.
//   Walking past is always safe; stopping is not (which the Lurker, who hears you walk, makes hard).
// - OLD MOTHER BOG stirs in her pool as the shrines are lit (her eyes open a fifth each). From the third
//   shrine (or MOTHER_LATE_S into the round) her hand's shadow finds you every so often: it follows you
//   (HAND_TRACK_MS), stops and reddens (HAND_LOCK_MS), then slams (HAND_R). Keep moving and it misses. Once the
//   fifth shrine is lit she RISES and the slams come one after another until you reach the boat.
//
// A catch costs one of the round's five hearts (ghoul-bonus.js), never a life, and never moves Planny: he
// blinks safe for BONUS_SAFE_MS and the hunter that took him backs off. The last heart gone ends the round
// with nothing. The room's clock (`round.timeMs`, TIME_S) at nought is the end too, unless the endless-lives
// code is on (the clock then starts again).
//
// THE GRADE (ghoul-bonus.js's `perf`): `total` is the five kinds that can take you (HUNTERS), `hits` the kinds
// that did, `acts` the wisps burst and the close calls (a dash or a slam that missed by less than CLOSE_R;
// the goal is ACTS_GOAL), and `steady` falls if the flame ever gutters.
//
// WHAT THE ART READS: `spec.ride`, `round.runner` (see `place`), `round.you.safeMs`, `round.timeMs`, the
// events in EVENTS, and the exported numbers and helpers.

const freeze = (o) => Object.freeze(o);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export const MONSTERS = freeze({});

// Every event this pack puts on the field, for the art and the sounds to answer.
export const EVENTS = freeze([
  "lanternStep", "lanternFlare", "lanternSputter", "lanternPop", "lanternShrine", "lanternGutter", "lanternCatch", "lanternFinish", "lanternMeet",
  "lanternLurkerCue", "lanternAim", "lanternDash", "lanternClose", "lanternWispCue", "lanternLeechCue", "lanternBodyCue",
  "lanternWake", "lanternRise", "lanternHand", "lanternSlam",
]);

// What costs a heart, by hunter (and the round's grade counts these five kinds).
export const CAUSES = freeze({ lurker: "lanternLurker", leech: "lanternLeech", wisp: "lanternWisp", body: "lanternBody", mother: "lanternMother" });
export const HUNTERS = freeze(["lurker", "leech", "wisp", "body", "mother"]);

// The field's map, in field units (y down): where Planny and the hunters can be (the band above y0 is the HUD's).
export const MAP = freeze({ x0: 3, x1: 93, y0: 11, y1: 52 });
// Planny. Speeds are units a second.
export const WALK_V = 9.5;
export const PLANK_HALF = 2.4;
// The room's clock.
export const TIME_S = 90;
// The shrines: stand on one SHRINE_MS (kept if you step off) to light it.
export const SHRINES = 5;
export const SHRINE_MS = 1800;
export const SHRINE_R = 2.8;
export const SHRINE_POINTS = 200;
// The light a lit shrine casts, which the art draws.
export const SHRINE_LIGHT = 9;
// The way out: within BOAT_R of the boat, once all five are lit.
export const BOAT_R = 4;
export const ESCAPE_POINTS = 500;
// The oil: full burns down in OIL_MS; the light's radius follows it.
export const OIL_MS = 26000;
export const LIGHT_MIN = 1.6;
export const LIGHT_MAX = 15;
export const OIL_LOW = 0.3;
export const lightR = (oil) => (oil > 0 ? LIGHT_MIN + 2.4 + (LIGHT_MAX - LIGHT_MIN - 2.4) * clamp(oil, 0, 1) : LIGHT_MIN);
// The flare.
export const FLARE_OIL = 0.22;
export const FLARE_CD_MS = 700;
export const FLARE_R = 12;
export const FLARE_MS = 900;
export const POP_POINTS = 80;
// The Bog Lurker.
export const STEP_MS = 330;
export const STEP_HEAR = 28;
export const SHRINE_HEAR = 45;
export const LURKER_V = 9;
export const LURKER_DRIFT_V = 4;
export const AIM_FROM = 14;
export const AIM_MS = 800;
export const DASH_V = 46;
export const DASH_PAST = 8;
export const DASH_HIT = 2.7;
export const REST_MS = 2200;
// A dash or a slam that missed Planny by less than this was a close call (an act).
export const CLOSE_R = 6.5;
export const CLOSE_POINTS = 50;
// The wisps.
export const ORBIT_R = 5.5;
export const ORBIT_W = 1.1;
export const GUARD_SENSE = 12;
export const LEASH = 19;
export const WISP_V = 7;
export const WISP_RETURN_V = 5;
export const ROAM_V = 3.5;
export const ROAM_SENSE = 20;
export const ROAM_CHASE_V = 6;
export const WISP_CATCH = 2;
export const WISP_REFORM_MS = 6000;
// The leeches.
export const LEECH_V = 7;
export const LEECH_DRIFT_V = 3;
export const LEECH_SENSE = 30;
export const LEECH_EDGE = 0.8;
export const LEECH_BITE = 2.4;
export const SCATTER_MS = 3000;
export const SCATTER_V = 10;
// What the leeches' bite leaves in the lantern (Planny shakes them off and fans the flame).
export const OIL_AFTER_BITE = 0.4;
// The bog bodies: they feel Planny stand still within BODY_NOTICE for BODY_STILL_MS.
export const BODY_NOTICE = 6;
export const BODY_STILL_MS = 250;
export const BODY_REACH = 3.4;
export const BODY_RISE_MS = 700;
export const BODY_UP_MS = 900;
export const BODY_REST_MS = 2600;
// Old Mother Bog: her hand's cycle, the gap between hands by shrines lit (risen: MOTHER_RISEN_GAP), and the late wake.
export const HAND_TRACK_MS = 1000;
export const HAND_TRACK_RISEN_MS = 750;
export const HAND_LOCK_MS = 420;
export const HAND_REST_MS = 450;
export const HAND_V = 8;
export const HAND_RISEN_V = 9.5;
export const HAND_R = 4;
export const MOTHER_GAP = freeze([0, 0, 0, 5500, 4000]);
export const MOTHER_LATE_S = 55;
export const MOTHER_RISEN_GAP = 250;
export const RISE_MS = 1300;
// A hunter's tag the first time it comes this near (the art shows its rule once).
export const MEET_R = 22;
// Cues heard before a thing is close: how near, and how often.
export const CUE_R = freeze({ leech: 24, wisp: 22 });
export const CUE_MS = freeze({ leech: 2600, wisp: 1800 });
// The things done on purpose that are worth a die.
export const ACTS_GOAL = 6;

const mine = (round) => (round.runner && round.runner.id === "lantern" ? round.runner : null);
// How far into the round it is (ms), from the room's clock.
export const elapsedOf = (round) => Math.max(0, (round.spec.ride ? round.spec.ride.time : TIME_S * 1000) - round.timeMs);
// The lantern's light radius now.
export const lightOf = (c) => lightR(c.oil);

/* ------------------------------------------------------------- the island */

// The island's walkable shapes, built once per ride: hummock disks and plank capsules.
const GEOM = new WeakMap();
export function geomOf(R) {
  let g = GEOM.get(R);
  if (!g) {
    const disks = R.hummocks.map(([x, y, r]) => freeze({ x, y, r }));
    const planks = R.planks.map(([a, b]) => freeze({ x1: R.hummocks[a][0], y1: R.hummocks[a][1], x2: R.hummocks[b][0], y2: R.hummocks[b][1], a, b }));
    g = freeze({ disks: freeze(disks), planks: freeze(planks) });
    GEOM.set(R, g);
  }
  return g;
}

// The point of plank `p` nearest (x, y), and how far it is.
function onPlankAxis(p, x, y) {
  const dx = p.x2 - p.x1;
  const dy = p.y2 - p.y1;
  const t = clamp(((x - p.x1) * dx + (y - p.y1) * dy) / (dx * dx + dy * dy), 0, 1);
  const sx = p.x1 + dx * t;
  const sy = p.y1 + dy * t;
  return [sx, sy, dist(x, y, sx, sy)];
}

// The nearest point of the island to (x, y) (the point itself when it is on it).
export function project(R, x, y) {
  const g = geomOf(R);
  let best = null;
  let bd = Infinity;
  const take = (px, py) => {
    const d = dist(x, y, px, py);
    if (d < bd) {
      bd = d;
      best = [px, py];
    }
  };
  for (const s of g.disks) {
    const d = dist(x, y, s.x, s.y);
    if (d <= s.r) return [x, y];
    take(s.x + ((x - s.x) / d) * s.r, s.y + ((y - s.y) / d) * s.r);
  }
  for (const p of g.planks) {
    const [sx, sy, d] = onPlankAxis(p, x, y);
    if (d <= PLANK_HALF) return [x, y];
    take(sx + ((x - sx) / d) * PLANK_HALF, sy + ((y - sy) / d) * PLANK_HALF);
  }
  return best || [x, y];
}

export const onIsland = (R, x, y) => {
  const p = project(R, x, y);
  return dist(p[0], p[1], x, y) < 1e-6;
};
// Whether (x, y) is on the moss of a hummock (silent) rather than on a plank (heard).
export const onMoss = (R, x, y) => geomOf(R).disks.some((s) => dist(x, y, s.x, s.y) <= s.r);

// The shrine i's stone.
export const shrineAt = (R, i) => R.hummocks[R.shrines[i]];

/* -------------------------------------------------------------- placing */

const wispOf = (w, i) => ({ i, x: w.home[0], y: w.home[1], wp: 0, state: w.wake > 0 ? "asleep" : w.shrine >= 0 ? "guard" : "roam", t: 0, cue: 0 });

// Planny put down in the room: on the landing at the start, or (the same room, after a respawn) with the shrines already lit kept as they were.
function place(round, k) {
  const R = round.spec.ride;
  if (!R || R.runner !== "lantern") {
    // (Another ride's state in the shared slot is not ours to touch.)
    if (mine(round)) round.runner = null;
    return;
  }
  const again = mine(round) && round.runner.room === round.room ? round.runner : null;
  const [sx, sy] = R.start;
  const you = round.you;
  Object.assign(you, { x: sx, y: k.groundAt(round.spec, sx), vy: 0, state: "run", shelf: -1, face: 1, ducking: false, coyote: 0, drop: -1 });
  const shrines = R.shrines.map((s, i) => (again ? again.shrines[i] : 0));
  round.runner = {
    id: "lantern", room: round.room, x: sx, y: sy, fx: 1, fy: 0, moving: false, plank: false, stepMs: 0, clock: 0, hf: false,
    shrines, lit: shrines.filter((v) => v >= SHRINE_MS).length, oil: 1, gutter: false, flareCd: 0, flare: null, done: false,
    lurker: { x: R.lurker.home[0], y: R.lurker.home[1], wp: 0, state: "drift", t: 0, tx: 0, ty: 0, ax: 0, ay: 0, bx: 0, by: 0, near: Infinity },
    wisps: R.wisps.map(wispOf),
    leeches: R.leeches.map((h, i) => ({ i, x: h.home[0], y: h.home[1], wp: 0, state: "drift", t: 0, cue: 0 })),
    bodies: R.bodies.map(([x, y]) => ({ x, y, state: "sunk", t: 0 })),
    mother: { stir: 0, risen: false, riseT: 0, gap: 0, hand: null },
    met: {}, caught: { lurker: 0, leech: 0, wisp: 0, body: 0, mother: 0 }, marks: [],
  };
  const b = round.bonusRound;
  if (b) {
    b.perf.total = HUNTERS.length;
    b.perf.goal = ACTS_GOAL;
    if (!again) b.perf.steady = true;
  }
  round.camLead = 0;
}

/* ------------------------------------------------------------ the round */

// Planny and the whole island for one slice. Returns true once it has moved Planny (every slice of the
// round); false once he is in the boat and has been put at the door.
function ride(round, ms, k) {
  const R = round.spec.ride;
  const c = mine(round);
  if (!R || R.runner !== "lantern" || !c || c.done) return false;
  const you = round.you;
  const inp = round.input;
  const ev = (type, extra = {}) => round.events.push({ type, x: c.x, y: c.y, ...extra });
  inp.jump = 0;
  // The door is past the map's edge, so no walk reaches it; a Planny put at it (the suites, a bot) has the room done, as a ride's finish line does.
  if (you.x >= round.spec.door) return finish(round, c, R, k, ev);
  c.clock += ms;
  const noises = [];
  // SPACE: a flare, once a press.
  const fire = Boolean(inp.fire);
  if (fire && !c.hf) flare(round, c, noises, ev);
  c.hf = fire;
  walk(round, c, R, ms, noises, ev);
  you.x = c.x;
  Object.assign(you, { y: k.groundAt(round.spec, c.x), vy: 0, state: "run", ducking: false, face: c.fx < 0 ? -1 : 1 });
  oil(round, c, ms, ev);
  shrines(round, c, R, ms, noises, ev);
  if (c.flare && (c.flare.t -= ms) <= 0) c.flare = null;
  c.flareCd = Math.max(0, c.flareCd - ms);
  // All five lit and Planny at the boat: away.
  if (c.lit >= SHRINES && dist(c.x, c.y, R.boat[0], R.boat[1]) <= BOAT_R) return finish(round, c, R, k, ev);
  if (hunters(round, c, R, ms, noises, k, ev) || round.phase !== "play") return true;
  marks(c, round);
  // The clock ran out: the bog keeps the light.
  if (round.timeMs <= 0) return drowned(round, k);
  return true;
}

// The walk: the arrows, sliding along the shore when the straight way is water; a step on the planks is heard.
function walk(round, c, R, ms, noises, ev) {
  const inp = round.input;
  let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  c.moving = false;
  if (dx || dy) {
    const m = Math.hypot(dx, dy);
    dx /= m;
    dy /= m;
    c.fx = dx;
    c.fy = dy;
    const want = WALK_V * (ms / 1000);
    const at = slide(R, c.x, c.y, dx, dy, want);
    if (dist(at[0], at[1], c.x, c.y) > want * 0.05) {
      c.x = clamp(at[0], MAP.x0, MAP.x1);
      c.y = clamp(at[1], MAP.y0, MAP.y1);
      c.moving = true;
    }
  }
  c.plank = !onMoss(R, c.x, c.y);
  if (c.moving && c.plank) {
    c.stepMs -= ms;
    if (c.stepMs <= 0) {
      c.stepMs += STEP_MS;
      noises.push({ x: c.x, y: c.y, r: STEP_HEAR, kind: "step" });
      ev("lanternStep");
    }
  } else c.stepMs = 0;
}

// Where a step of `len` the way (dx, dy) lands: straight on if it can, else turned up to 85 degrees toward
// whichever way the shore or the plank runs, the first that keeps at least half the step going forward.
const TURNS = [0, 0.5, -0.5, 1, -1, 1.48, -1.48];
export function slide(R, x, y, dx, dy, len) {
  let best = null;
  let bestGo = -Infinity;
  for (const a of TURNS) {
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const ux = dx * ca - dy * sa;
    const uy = dx * sa + dy * ca;
    const [px, py] = project(R, x + ux * len, y + uy * len);
    const go = (px - x) * dx + (py - y) * dy;
    if (a === 0 && go >= len * 0.6) return [px, py];
    if (go >= len * 0.5 * Math.cos(a) && go > bestGo + 1e-9) {
      best = [px, py];
      bestGo = go;
      if (a !== 0) break;
    }
  }
  return best || project(R, x, y);
}

// The oil burns down; out, the flame gutters (the leeches' moment); a shrine fills it again.
function oil(round, c, ms, ev) {
  const was = c.oil;
  c.oil = Math.max(0, c.oil - ms / OIL_MS);
  if (was > 0 && c.oil <= 0) {
    c.gutter = true;
    ev("lanternGutter");
    if (round.bonusRound) round.bonusRound.perf.steady = false;
  }
  if (c.oil > 0) c.gutter = false;
}

// SPACE: a ring of light FLARE_R round Planny, if there is oil for it.
function flare(round, c, noises, ev) {
  if (c.flareCd > 0) return;
  if (c.oil < FLARE_OIL) {
    c.flareCd = FLARE_CD_MS;
    ev("lanternSputter");
    return;
  }
  c.oil -= FLARE_OIL;
  c.flareCd = FLARE_CD_MS;
  c.flare = { x: c.x, y: c.y, t: FLARE_MS };
  noises.push({ x: c.x, y: c.y, r: Infinity, kind: "flare" });
  ev("lanternFlare");
  let popped = 0;
  for (const w of c.wisps) {
    if (!live(w) || dist(w.x, w.y, c.x, c.y) > FLARE_R) continue;
    pop(round, c, w, ev, true);
    popped++;
  }
  if (popped >= 2) ev("lanternPop", { combo: popped, x: c.x, y: c.y, points: POP_POINTS * popped });
  if (popped >= 2) round.score += POP_POINTS * popped;
  for (const S of c.leeches) if (dist(S.x, S.y, c.x, c.y) <= FLARE_R * 2) Object.assign(S, { state: "scatter", t: SCATTER_MS });
}

const live = (w) => w.state !== "popped" && w.state !== "gone" && w.state !== "asleep";

function act(round, points) {
  round.score += points;
  if (round.bonusRound) round.bonusRound.perf.acts++;
}

// A wisp bursts (an act when it was a flare's doing); it comes back unless its shrine is lit by then.
function pop(round, c, w, ev, byFlare) {
  const R = round.spec.ride;
  const spec = R.wisps[w.i];
  Object.assign(w, { state: spec.shrine >= 0 && c.shrines[spec.shrine] >= SHRINE_MS ? "gone" : "popped", t: WISP_REFORM_MS });
  if (byFlare) act(round, POP_POINTS);
  ev("lanternPop", { x: w.x, y: w.y, points: byFlare ? POP_POINTS : 0 });
}

/* ----------------------------------------------------------------- shrines */

function shrines(round, c, R, ms, noises, ev) {
  R.shrines.forEach((h, i) => {
    if (c.shrines[i] >= SHRINE_MS) return;
    const [hx, hy] = R.hummocks[h];
    if (dist(c.x, c.y, hx, hy) > SHRINE_R) return;
    c.shrines[i] += ms;
    if (c.shrines[i] < SHRINE_MS) return;
    c.shrines[i] = SHRINE_MS;
    c.lit++;
    c.oil = 1;
    c.gutter = false;
    round.score += SHRINE_POINTS;
    noises.push({ x: hx, y: hy, r: SHRINE_HEAR, kind: "shrine" });
    ev("lanternShrine", { n: c.lit, x: hx, y: hy, points: SHRINE_POINTS });
    // Its guardian is laid to rest.
    c.wisps.forEach((w) => {
      if (R.wisps[w.i].shrine !== i) return;
      if (live(w)) ev("lanternPop", { x: w.x, y: w.y, points: 0 });
      w.state = "gone";
    });
    // Mother stirs; from the third shrine her hand comes now and then, and the fifth raises her.
    const M = c.mother;
    M.stir = c.lit;
    if (c.lit === 3) ev("lanternWake", { x: R.pool[0], y: R.pool[1] });
    if (c.lit >= SHRINES) {
      Object.assign(M, { risen: true, riseT: RISE_MS, hand: null, gap: RISE_MS });
      Object.assign(c.lurker, { state: "cower", t: 0 });
      ev("lanternRise", { x: R.pool[0], y: R.pool[1] });
    } else if (c.lit >= 3 && !M.hand) M.gap = Math.min(M.gap || Infinity, 1500);
  });
}

// In the boat: Planny is put at the door, which the next slice walks through.
function finish(round, c, R, k, ev) {
  const you = round.you;
  if (!c.done && c.lit >= SHRINES) {
    round.score += ESCAPE_POINTS;
    ev("lanternFinish", { lit: c.lit, x: R.boat[0], y: R.boat[1], points: ESCAPE_POINTS });
  }
  c.done = true;
  round.hasKey = true;
  Object.assign(you, { x: round.spec.door, y: k.groundAt(round.spec, round.spec.door), vy: 0, state: "run", ducking: false });
  return false;
}

// The clock is at nought: the last heart goes, and the round with it (the endless-lives code starts the clock again).
function drowned(round, k) {
  const b = round.bonusRound;
  if (round.infinite || !b) {
    round.timeMs = round.spec.ride.time;
    return true;
  }
  b.hearts = Math.min(b.hearts, 1);
  k.lose(round, "time");
  return true;
}

// What a banner over the field must keep clear of: Planny and anything that can hurt him, as [x, y up].
function marks(c, round) {
  const up = (y) => 54 - y;
  const out = [[c.x, up(c.y)]];
  const L = c.lurker;
  if (L.state === "aim" || L.state === "dash" || L.state === "hunt") out.push([L.x, up(L.y)]);
  for (const w of c.wisps) if (live(w) && dist(w.x, w.y, c.x, c.y) < 20) out.push([w.x, up(w.y)]);
  if (c.mother.hand) out.push([c.mother.hand.x, up(c.mother.hand.y)]);
  c.marks = out;
}

/* ----------------------------------------------------------------- hunters */

// A heart lost to `kind`: Planny blinks safe (the engine's) where he stands. False when the blink (or the Garlic) took it.
function grab(round, c, kind, k, ev) {
  if (!k.struck(round, CAUSES[kind])) return false;
  c.caught[kind]++;
  const b = round.bonusRound;
  if (b && !b.perf.hits.includes(kind)) b.perf.hits.push(kind);
  // The engine's "hearts left" float goes over Planny where he really is (the floor is all `you.y` knows).
  const lose = round.events.findLast((e) => e.type === "lose");
  if (lose) lose.y = 54 - c.y - 2.5;
  ev("lanternCatch", { kind });
  return true;
}

// Moves `e` toward (tx, ty) by `v` a second; returns what is left of the way.
function stepTo(e, tx, ty, v, dt) {
  const d = dist(e.x, e.y, tx, ty);
  if (d < 1e-6) return 0;
  const m = Math.min(d, v * dt);
  e.x += ((tx - e.x) / d) * m;
  e.y += ((ty - e.y) / d) * m;
  return d - m;
}

// Along a route: head for the next waypoint, and take the one after on arrival.
function patrol(e, route, v, dt) {
  const [tx, ty] = route[e.wp % route.length];
  if (stepTo(e, tx, ty, v, dt) < 0.8) e.wp = (e.wp + 1) % route.length;
}

const keep = (e) => {
  e.x = clamp(e.x, MAP.x0 - 2, MAP.x1 + 2);
  e.y = clamp(e.y, MAP.y0 - 2, MAP.y1 + 2);
};

// The first time a hunter comes near, it is named (the art shows its rule once).
function meet(c, kind, x, y, ev) {
  if (c.met[kind]) return;
  c.met[kind] = true;
  ev("lanternMeet", { kind, x, y });
}

// A cue the ear gets before the eye: at most one a CUE_MS, while `e` is within CUE_R.
function cue(c, e, kind, ms, ev) {
  e.cue = Math.max(0, (e.cue || 0) - ms);
  if (e.cue > 0 || dist(e.x, e.y, c.x, c.y) > CUE_R[kind]) return;
  e.cue = CUE_MS[kind];
  ev(kind === "leech" ? "lanternLeechCue" : "lanternWispCue", { x: e.x, y: e.y });
}

// Every hunter for one slice. Returns true when the round is no longer in play (a last heart).
function hunters(round, c, R, ms, noises, k, ev) {
  const steps = [lurker, wisps, leeches, bodies, mother];
  for (const f of steps) if (f(round, c, R, ms, noises, k, ev)) return true;
  return false;
}

// The distance from (px, py) to the segment (ax, ay)-(bx, by).
function toSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
  return dist(px, py, ax + dx * t, ay + dy * t);
}

// THE LURKER: drift on its route; hunt the last noise it heard; within AIM_FROM, line up and dash through it; rest.
function lurker(round, c, R, ms, noises, k, ev) {
  const L = c.lurker;
  const dt = ms / 1000;
  const heard = L.state === "drift" || L.state === "hunt" ? noises.filter((n) => dist(L.x, L.y, n.x, n.y) <= n.r).pop() : null;
  if (heard) {
    if (L.state === "drift") ev("lanternLurkerCue", { x: L.x, y: L.y });
    Object.assign(L, { state: "hunt", tx: heard.x, ty: heard.y });
    if (dist(L.x, L.y, c.x, c.y) <= MEET_R + 10) meet(c, "lurker", L.x, L.y, ev);
  }
  if (L.state === "drift") {
    patrol(L, R.lurker.route, LURKER_DRIFT_V, dt);
  } else if (L.state === "hunt") {
    const left = stepTo(L, L.tx, L.ty, LURKER_V, dt);
    if (left <= AIM_FROM) {
      // The lane: from where it stops, through the spot it heard, DASH_PAST beyond.
      const d = Math.max(0.5, dist(L.x, L.y, L.tx, L.ty));
      const ux = (L.tx - L.x) / d;
      const uy = (L.ty - L.y) / d;
      Object.assign(L, { state: "aim", t: AIM_MS, ax: L.x, ay: L.y, bx: clamp(L.tx + ux * DASH_PAST, MAP.x0 - 2, MAP.x1 + 2), by: clamp(L.ty + uy * DASH_PAST, MAP.y0 - 2, MAP.y1 + 2), near: Infinity });
      ev("lanternAim", { x: L.x, y: L.y, bx: L.bx, by: L.by });
    }
  } else if (L.state === "aim") {
    L.t -= ms;
    if (L.t <= 0) {
      L.state = "dash";
      ev("lanternDash", { x: L.x, y: L.y });
    }
  } else if (L.state === "dash") {
    const x0 = L.x;
    const y0 = L.y;
    const left = stepTo(L, L.bx, L.by, DASH_V, dt);
    const d = toSegment(c.x, c.y, x0, y0, L.x, L.y);
    L.near = Math.min(L.near, d);
    if (d <= DASH_HIT && grab(round, c, "lurker", k, ev)) {
      Object.assign(L, { state: "rest", t: REST_MS });
      return round.phase !== "play";
    }
    if (left <= 0.01) {
      if (L.near > DASH_HIT && L.near <= CLOSE_R && round.you.safeMs <= 0) {
        act(round, CLOSE_POINTS);
        ev("lanternClose", { x: c.x, y: c.y, points: CLOSE_POINTS, by: "lurker" });
      }
      Object.assign(L, { state: "rest", t: REST_MS });
    }
  } else if (L.state === "cower") {
    // Away from her pool, as far as its route goes.
    let far = R.lurker.route[0];
    for (const p of R.lurker.route) if (dist(p[0], p[1], R.pool[0], R.pool[1]) > dist(far[0], far[1], R.pool[0], R.pool[1])) far = p;
    stepTo(L, far[0], far[1], LURKER_V, dt);
  } else if (L.state === "rest") {
    L.t -= ms;
    if (L.t <= 0) {
      L.state = "drift";
      // Back to the nearest point of its route.
      let bi = 0;
      R.lurker.route.forEach(([x, y], i) => {
        if (dist(L.x, L.y, x, y) < dist(L.x, L.y, ...R.lurker.route[bi])) bi = i;
      });
      L.wp = bi;
    }
  }
  keep(L);
  if (dist(L.x, L.y, c.x, c.y) <= MEET_R && L.state !== "rest" && L.state !== "cower") meet(c, "lurker", L.x, L.y, ev);
  return false;
}

// THE WISPS: guardians circle their shrine and rush a lantern near it; roamers from Mother's pool drift after one. A flare bursts them.
function wisps(round, c, R, ms, noises, k, ev) {
  const dt = ms / 1000;
  for (const w of c.wisps) {
    const spec = R.wisps[w.i];
    if (w.state === "gone") continue;
    if (w.state === "asleep") {
      if (c.lit >= spec.wake) {
        Object.assign(w, { state: "roam", x: R.pool[0], y: R.pool[1] });
        ev("lanternWispCue", { x: w.x, y: w.y });
      }
      continue;
    }
    if (w.state === "popped") {
      w.t -= ms;
      if (w.t <= 0) {
        if (spec.shrine >= 0 && c.shrines[spec.shrine] >= SHRINE_MS) w.state = "gone";
        else Object.assign(w, { state: spec.shrine >= 0 ? "guard" : "roam", x: spec.home[0], y: spec.home[1], wp: 0 });
      }
      continue;
    }
    const d = dist(w.x, w.y, c.x, c.y);
    if (spec.shrine >= 0) {
      const [sx, sy] = shrineAt(R, spec.shrine);
      const yours = dist(c.x, c.y, sx, sy) <= LEASH;
      if (yours && (w.state === "chase" || d <= GUARD_SENSE)) {
        w.state = "chase";
        stepTo(w, c.x, c.y, WISP_V, dt);
      } else {
        // Back to its circle, then round it.
        const a = spec.phase + (c.clock / 1000) * ORBIT_W;
        const ox = sx + Math.cos(a) * ORBIT_R;
        const oy = sy + Math.sin(a) * ORBIT_R;
        if (w.state === "chase" || w.state === "back") w.state = stepTo(w, ox, oy, WISP_RETURN_V, dt) < 0.5 ? "guard" : "back";
        else {
          w.x = ox;
          w.y = oy;
        }
      }
    } else if (d <= ROAM_SENSE) {
      w.state = "chase";
      stepTo(w, c.x, c.y, ROAM_CHASE_V, dt);
    } else {
      w.state = "roam";
      patrol(w, spec.route, ROAM_V, dt);
    }
    keep(w);
    cue(c, w, "wisp", ms, ev);
    if (w.state === "chase") meet(c, "wisp", w.x, w.y, ev);
    if (dist(w.x, w.y, c.x, c.y) <= WISP_CATCH && grab(round, c, "wisp", k, ev)) {
      pop(round, c, w, ev, false);
      return round.phase !== "play";
    }
  }
  return false;
}

// THE LEECHES: they follow you at the edge of your light and never come into it; the flame out, they bite. A flare scatters them.
function leeches(round, c, R, ms, noises, k, ev) {
  const dt = ms / 1000;
  const r = lightOf(c);
  for (const S of c.leeches) {
    const d = dist(S.x, S.y, c.x, c.y);
    if (S.state === "scatter") {
      S.t -= ms;
      if (d > 0.01) stepTo(S, S.x + (S.x - c.x) * 4, S.y + (S.y - c.y) * 4, SCATTER_V, dt);
      if (S.t <= 0) S.state = "drift";
    } else if (d <= LEECH_SENSE || c.gutter) {
      S.state = c.gutter ? "swarm" : "stalk";
      if (c.gutter) stepTo(S, c.x, c.y, LEECH_V * 1.4, dt);
      else {
        // To the light's edge, a little round from where it is (each swarm its own way), never inside.
        const a = Math.atan2(S.y - c.y, S.x - c.x) + (S.i % 2 ? 0.35 : -0.35) * dt;
        const edge = r + LEECH_EDGE;
        if (d < edge) stepTo(S, c.x + Math.cos(a) * edge, c.y + Math.sin(a) * edge, LEECH_V * 1.3, dt);
        else stepTo(S, c.x + Math.cos(a) * edge, c.y + Math.sin(a) * edge, LEECH_V, dt);
      }
      if (d <= r + 3) meet(c, "leech", S.x, S.y, ev);
    } else {
      S.state = "drift";
      patrol(S, R.leeches[S.i].route, LEECH_DRIFT_V, dt);
    }
    keep(S);
    cue(c, S, "leech", ms, ev);
    if (c.gutter && dist(S.x, S.y, c.x, c.y) <= LEECH_BITE && grab(round, c, "leech", k, ev)) {
      c.oil = OIL_AFTER_BITE;
      c.gutter = false;
      for (const T of c.leeches) Object.assign(T, { state: "scatter", t: SCATTER_MS });
      return round.phase !== "play";
    }
  }
  return false;
}

// THE BOG BODIES: stand still near one and the water boils, then a hand comes up and takes what is within reach.
function bodies(round, c, R, ms, noises, k, ev) {
  for (const B of c.bodies) {
    const d = dist(B.x, B.y, c.x, c.y);
    if (d <= BODY_NOTICE + 2) meet(c, "body", B.x, B.y, ev);
    if (B.state === "sunk") {
      B.t = d <= BODY_NOTICE && !c.moving ? B.t + ms : 0;
      if (B.t >= BODY_STILL_MS) {
        Object.assign(B, { state: "rise", t: BODY_RISE_MS });
        ev("lanternBodyCue", { x: B.x, y: B.y });
      }
    } else if (B.state === "rise") {
      B.t -= ms;
      if (B.t <= 0) Object.assign(B, { state: "up", t: BODY_UP_MS });
    } else if (B.state === "up") {
      B.t -= ms;
      if (d <= BODY_REACH && grab(round, c, "body", k, ev)) {
        Object.assign(B, { state: "rest", t: BODY_REST_MS });
        return round.phase !== "play";
      }
      if (B.t <= 0) Object.assign(B, { state: "rest", t: BODY_REST_MS });
    } else if (B.state === "rest") {
      B.t -= ms;
      if (B.t <= 0) Object.assign(B, { state: "sunk", t: 0 });
    }
  }
  return false;
}

// OLD MOTHER BOG: her hand's shadow finds you, stops, and slams; from the third shrine now and then, once risen one after another.
function mother(round, c, R, ms, noises, k, ev) {
  const M = c.mother;
  const dt = ms / 1000;
  if (M.riseT > 0) M.riseT -= ms;
  const late = elapsedOf(round) >= MOTHER_LATE_S * 1000;
  const awake = M.risen || c.lit >= 3 || late;
  if (!awake) return false;
  const H = M.hand;
  if (!H) {
    M.gap = (M.gap || (M.risen ? MOTHER_RISEN_GAP : MOTHER_GAP[Math.min(4, Math.max(3, c.lit))])) - ms;
    if (M.gap > 0) return false;
    M.gap = 0;
    // The shadow falls a little behind where Planny is heading, so a walk carries him out of it.
    M.hand = { x: c.x - c.fx * 2, y: c.y - c.fy * 2, state: "track", t: M.risen ? HAND_TRACK_RISEN_MS : HAND_TRACK_MS };
    ev("lanternHand", { x: M.hand.x, y: M.hand.y });
    meet(c, "mother", c.x, c.y, ev);
    return false;
  }
  H.t -= ms;
  if (H.state === "track") {
    stepTo(H, c.x, c.y, M.risen ? HAND_RISEN_V : HAND_V, dt);
    if (H.t <= 0) Object.assign(H, { state: "lock", t: HAND_LOCK_MS });
  } else if (H.state === "lock") {
    if (H.t <= 0) {
      const d = dist(H.x, H.y, c.x, c.y);
      ev("lanternSlam", { x: H.x, y: H.y });
      Object.assign(H, { state: "rest", t: HAND_REST_MS });
      if (d <= HAND_R) {
        if (grab(round, c, "mother", k, ev)) {
          H.t = HAND_REST_MS * 3;
          return round.phase !== "play";
        }
      } else if (d <= CLOSE_R && round.you.safeMs <= 0) {
        act(round, CLOSE_POINTS);
        ev("lanternClose", { x: c.x, y: c.y, points: CLOSE_POINTS, by: "mother" });
      }
    }
  } else if (H.t <= 0) {
    M.hand = null;
    M.gap = M.risen ? MOTHER_RISEN_GAP : MOTHER_GAP[Math.min(4, Math.max(3, c.lit))];
  }
  return false;
}

// The held sounds this room wants now, as [id, hum name, level, pitch] (ghoul.js plays them; sounds never touch the round).
export function lanternHums(round) {
  const c = mine(round);
  if (!c || c.done || round.phase !== "play") return [];
  const out = [];
  const L = c.lurker;
  const d = dist(L.x, L.y, c.x, c.y);
  if (L.state !== "rest" && L.state !== "cower" && d < 34) out.push(["ghoul:lurker", "ghoulLanternLurk", (1 - d / 34) ** 1.4 * (L.state === "drift" ? 0.5 : 1), L.state === "aim" ? 1.4 : L.state === "hunt" ? 1.15 : 1]);
  if (c.mother.risen) out.push(["ghoul:mother", "ghoulLanternMother", 0.9, 1]);
  else if (c.mother.stir >= 3) out.push(["ghoul:mother", "ghoulLanternMother", 0.35, 0.85]);
  return out;
}

export const LANTERN = freeze({
  id: "lantern",
  monsters: MONSTERS,
  walkers: freeze([]),
  zombies: freeze([]),
  stackers: freeze([]),
  climbers: freeze([]),
  act: freeze({}),
  horde: freeze({}),
  ride: freeze([ride]),
  place: freeze([place]),
});
